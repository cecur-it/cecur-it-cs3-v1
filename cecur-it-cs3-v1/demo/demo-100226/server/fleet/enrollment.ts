import crypto from 'node:crypto';
import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../db';
import { getPool } from '../pg/pool';
import { upsertDoc } from '../pg/store';
import type { CecurAgent, CecurWorkloadType } from '../../src/types';

export const MAX_BULK_BATCH = Number(process.env.CS3_ENROLL_MAX_BATCH) || 1000;
export const DEFAULT_TOKEN_TTL_HOURS = 24;
export const MAX_TOKEN_TTL_HOURS = 168;

const PLATFORMS = ['linux', 'windows', 'macos', 'container'] as const;
const WORKLOADS: CecurWorkloadType[] = ['local', 'virtual', 'container', 'cloud'];
const HOSTNAME_RE = /^[A-Za-z0-9]([A-Za-z0-9._-]{0,251}[A-Za-z0-9])?$/;
const GROUP_RE = /^[A-Za-z0-9._-]{1,64}$/;

export interface EnrollmentRecord {
  agentId: string;
  tokenSha256: string;
  keySha256?: string;
  batchId: string;
  requestedBy: string;
  expiresAt: number;
  claimedAt?: number;
}

const enrollments = new Map<string, EnrollmentRecord>();
const keyIndex = new Map<string, string>(); // key sha256 -> agentId

// SHA-256 is used only on server-generated 256-bit random tokens/keys (not user passwords), so a
// slow password hash adds nothing; digests are compared in constant time.
export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export interface BulkAgentInput {
  hostname?: unknown;
  ip?: unknown;
  platform?: unknown;
  osName?: unknown;
  osVersion?: unknown;
  arch?: unknown;
  workloadType?: unknown;
  group?: unknown;
}

export interface BulkEnrollResult {
  hostname: string;
  status: 'enrolled' | 'duplicate' | 'invalid';
  agentId?: string;
  enrollmentToken?: string;
  error?: string;
}

const str = (v: unknown, max = 128) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function bulkEnroll(opts: {
  agents: BulkAgentInput[];
  defaultGroups: string[];
  ttlHours: number;
  dryRun: boolean;
  requestedBy: string;
}) {
  const batchId = `enr-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const expiresAt = Date.now() + opts.ttlHours * 3600_000;
  const known = new Set(db.cecurAgents.map((a) => a.hostname.toLowerCase()));
  const results: BulkEnrollResult[] = [];
  const toPersist: { agent: CecurAgent; record: EnrollmentRecord }[] = [];

  for (const input of opts.agents) {
    const hostname = str(input?.hostname, 253);
    if (!hostname || !HOSTNAME_RE.test(hostname)) {
      results.push({ hostname, status: 'invalid', error: 'hostname missing or malformed' });
      continue;
    }
    const platform = str(input.platform, 16).toLowerCase() as CecurAgent['os']['platform'];
    if (!PLATFORMS.includes(platform)) {
      results.push({ hostname, status: 'invalid', error: `platform must be one of ${PLATFORMS.join(', ')}` });
      continue;
    }
    const ip = str(input.ip, 64);
    if (ip && !isIP(ip)) {
      results.push({ hostname, status: 'invalid', error: 'ip is not a valid IPv4/IPv6 address' });
      continue;
    }
    const workload = (str(input.workloadType, 16) || 'local') as CecurWorkloadType;
    if (!WORKLOADS.includes(workload)) {
      results.push({ hostname, status: 'invalid', error: `workloadType must be one of ${WORKLOADS.join(', ')}` });
      continue;
    }
    const groups = (Array.isArray(input.group) ? input.group : input.group ? [input.group] : [])
      .map((g) => str(g, 64))
      .filter(Boolean);
    if ([...groups, ...opts.defaultGroups].some((g) => !GROUP_RE.test(g))) {
      results.push({ hostname, status: 'invalid', error: 'group names must match [A-Za-z0-9._-]{1,64}' });
      continue;
    }
    if (known.has(hostname.toLowerCase())) {
      results.push({ hostname, status: 'duplicate', error: 'hostname already enrolled' });
      continue;
    }
    known.add(hostname.toLowerCase());

    const agentId = `cecur-ag-${crypto.randomBytes(6).toString('hex')}`;
    const token = crypto.randomBytes(24).toString('base64url');
    results.push({ hostname, status: 'enrolled', agentId, enrollmentToken: opts.dryRun ? undefined : token });
    if (opts.dryRun) continue;

    const now = new Date().toISOString();
    toPersist.push({
      record: {
        agentId,
        tokenSha256: sha256(token),
        batchId,
        requestedBy: opts.requestedBy,
        expiresAt,
      },
      agent: {
        id: agentId,
        name: hostname,
        hostname,
        ip: ip || '0.0.0.0',
        os: {
          name: str(input.osName) || platform,
          platform,
          version: str(input.osVersion, 64) || 'unknown',
          arch: str(input.arch, 32) || 'x86_64',
        },
        workloadType: workload,
        status: 'pending',
        version: 'unenrolled',
        lastKeepAlive: now,
        registeredAt: now,
        group: [...new Set([...opts.defaultGroups, ...groups, 'default'])],
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        installedPackagesCount: 0,
        vulnerabilitiesCount: { critical: 0, high: 0, medium: 0, low: 0 },
        fimMonitoredFilesCount: 0,
        scaScore: 0,
        isolationStatus: false,
      },
    });
  }

  for (const { agent, record } of toPersist) {
    enrollments.set(record.agentId, record);
    db.cecurAgents.push(agent);
  }
  await persistEnrollments(toPersist);

  return {
    batchId,
    expiresAt: new Date(expiresAt).toISOString(),
    requested: opts.agents.length,
    enrolled: results.filter((r) => r.status === 'enrolled').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    dryRun: opts.dryRun,
    results,
  };
}

async function persistEnrollments(rows: { agent: CecurAgent; record: EnrollmentRecord }[]) {
  if (rows.length === 0) return;
  const pool = await getPool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { agent, record } of rows) {
      await client.query(
        `INSERT INTO cs3.agents (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING`,
        [agent.id, JSON.stringify(agent)]
      );
      await client.query(
        `INSERT INTO cs3.enrollments (agent_id, token_sha256, batch_id, requested_by, expires_at)
         VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))`,
        [record.agentId, record.tokenSha256, record.batchId, record.requestedBy, record.expiresAt]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Roll back the in-memory state so memory and Postgres never diverge.
    for (const { agent, record } of rows) {
      enrollments.delete(record.agentId);
      const i = db.cecurAgents.findIndex((a) => a.id === agent.id);
      if (i >= 0) db.cecurAgents.splice(i, 1);
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Redeems a one-time enrollment token and mints the per-agent ingest key (returned once). */
export async function claimEnrollment(agentId: string, token: string) {
  let rec = enrollments.get(agentId);
  const pool = await getPool();
  if (pool) {
    // Postgres is authoritative so a claim is single-use across console replicas.
    // The token digest is part of the predicate: a wrong token never touches the row.
    const r = await pool.query(
      `UPDATE cs3.enrollments SET claimed_at = now()
        WHERE agent_id = $1 AND token_sha256 = $2 AND claimed_at IS NULL AND expires_at > now()
        RETURNING token_sha256, batch_id, requested_by, extract(epoch from expires_at) * 1000 AS exp`,
      [agentId, sha256(token)]
    );
    if (r.rowCount === 0) return null;
    const row = r.rows[0];
    rec = {
      agentId,
      tokenSha256: row.token_sha256,
      batchId: row.batch_id,
      requestedBy: row.requested_by,
      expiresAt: Number(row.exp),
      claimedAt: Date.now(),
    };
  } else {
    if (!rec || rec.claimedAt || rec.expiresAt < Date.now()) return null;
    if (!safeEqualHex(rec.tokenSha256, sha256(token))) return null;
    rec.claimedAt = Date.now();
  }

  const ingestKey = `cs3k_${crypto.randomBytes(32).toString('base64url')}`;
  const keySha = sha256(ingestKey);
  rec.keySha256 = keySha;
  enrollments.set(agentId, rec);
  keyIndex.set(keySha, agentId);
  if (pool) await pool.query('UPDATE cs3.enrollments SET key_sha256 = $2 WHERE agent_id = $1', [agentId, keySha]);

  const agent = db.cecurAgents.find((a) => a.id === agentId);
  if (agent) {
    agent.status = 'active';
    agent.lastKeepAlive = new Date().toISOString();
    await upsertDoc('agents', agentId, agent);
  }
  return { agentId, ingestKey, batchId: rec.batchId };
}

async function lookupAgentByKey(key: string): Promise<string | null> {
  const digest = sha256(key);
  const cached = keyIndex.get(digest);
  if (cached) return cached;
  const pool = await getPool();
  if (!pool) return null;
  const r = await pool.query('SELECT agent_id FROM cs3.enrollments WHERE key_sha256 = $1', [digest]);
  if (r.rowCount === 0) return null;
  keyIndex.set(digest, r.rows[0].agent_id);
  return r.rows[0].agent_id;
}

/**
 * Optional ingest authentication (CS3_INGEST_REQUIRE_KEY=true). Accepts either the shared
 * SOC_INGESTION_SECRET or a per-agent key minted by claimEnrollment(). Per-agent keys pin
 * the event to the enrolled agent id (req.ingestAgentId) so a compromised endpoint cannot spoof another host.
 */
export async function requireIngestKey(req: Request, res: Response, next: NextFunction) {
  if (process.env.CS3_INGEST_REQUIRE_KEY !== 'true') return next();
  const key = req.header('x-api-key') || '';
  const reject = () => res.status(401).json({ error: 'Unauthorized', message: 'Valid X-API-Key required.' });
  if (!key) return reject();
  const shared = process.env.SOC_INGESTION_SECRET;
  if (shared && key.length === shared.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(shared))) {
    return next();
  }
  try {
    const agentId = await lookupAgentByKey(key);
    if (!agentId) return reject();
    (req as any).ingestAgentId = agentId;
    const agent = db.cecurAgents.find((a) => a.id === agentId);
    if (agent) agent.lastKeepAlive = new Date().toISOString();
    return next();
  } catch (err) {
    console.error('[fleet] ingest key lookup failed:', (err as Error).message);
    return res.status(503).json({ error: 'Service Unavailable' });
  }
}

export function fleetSummary() {
  const byStatus: Record<string, number> = {};
  for (const a of db.cecurAgents) byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  const now = Date.now();
  let pendingEnrollments = 0;
  for (const e of enrollments.values()) if (!e.claimedAt && e.expiresAt > now) pendingEnrollments++;
  return { total: db.cecurAgents.length, byStatus, pendingEnrollments };
}
