import { getPool } from './pool';

/**
 * Firestore collection -> PostgreSQL table. Table names are a fixed allow-list and
 * are never derived from user input, so they are safe to interpolate.
 */
export const COLLECTION_TABLES = {
  users: 'users',
  credentials: 'credentials',
  incidents: 'incidents',
  sensors: 'sensors',
  transactions: 'transactions',
  hexstrikeAllowlist: 'hexstrike_allowlist',
  hexstrikeJobs: 'hexstrike_jobs',
  wazuhAlerts: 'wazuh_alerts',
  activtrakSessions: 'activtrak_sessions',
  agents: 'agents',
} as const;

export type CollectionName = keyof typeof COLLECTION_TABLES;

function tableFor(collection: CollectionName): string {
  const table = COLLECTION_TABLES[collection];
  if (!table) throw new Error(`Unknown collection: ${collection}`);
  return `cs3.${table}`;
}

/** Firestore setDoc(..., { merge: true }) equivalent. */
export async function upsertDoc(collection: CollectionName, id: string, data: unknown): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return false;
  await pool.query(
    `INSERT INTO ${tableFor(collection)} (id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = ${tableFor(collection)}.data || EXCLUDED.data`,
    [id, JSON.stringify(data)]
  );
  return true;
}

export async function getDoc<T = unknown>(collection: CollectionName, id: string): Promise<T | null> {
  const pool = await getPool();
  if (!pool) return null;
  const r = await pool.query(`SELECT data FROM ${tableFor(collection)} WHERE id = $1`, [id]);
  return r.rows[0]?.data ?? null;
}

export async function listDocs<T = unknown>(collection: CollectionName, limit = 100): Promise<T[]> {
  const pool = await getPool();
  if (!pool) return [];
  const r = await pool.query(
    `SELECT data FROM ${tableFor(collection)} ORDER BY updated_at DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 1000)]
  );
  return r.rows.map((row) => row.data as T);
}

/** Append-only audit ledger insert. Hash chaining is done by the cs3.audit_chain() trigger. */
export async function appendAudit(entry: { id: string } & Record<string, unknown>): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return false;
  await pool.query(`INSERT INTO cs3.audit_logs (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING`, [
    entry.id,
    JSON.stringify(entry),
  ]);
  return true;
}

/** Returns the first broken chain_no, or null when the ledger is intact. */
export async function verifyAuditChain(): Promise<number | null | undefined> {
  const pool = await getPool();
  if (!pool) return undefined;
  const r = await pool.query('SELECT cs3.verify_audit_chain() AS broken_at');
  return r.rows[0].broken_at === null ? null : Number(r.rows[0].broken_at);
}
