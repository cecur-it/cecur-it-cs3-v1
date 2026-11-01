import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import type { CecurLogEvent } from '../../src/types';

/**
 * Durable indexing sink for the OpenSearch / Wazuh Indexer cluster (the `indexer`
 * service in deployment/docker/docker-compose.yml, profile "siem").
 *
 * Closes the gap where /api/cecur/logs/ingest only pushed accepted events into
 * db.cecurLogs, an in-memory ring buffer capped at 300 rows (see cecurRouter in
 * ../routes/cecur.ts). That cap is fine as a "recent events" hot cache for the
 * console UI, but it silently discarded everything older than the last 300
 * events for any real on-prem deployment feeding 1,000+ endpoints. This module
 * additionally indexes every accepted event into OpenSearch under the
 * `cs3-logs` rollover alias, governed by the ISM lifecycle policy already
 * authored at deployment/operations/ism/cs3-logs-lifecycle.json (hot 30d / warm
 * 90d / cold 1y with snapshot-before-delete).
 *
 * Disabled by default (CS3_INDEXER_ENABLED must be explicitly "true"), matching
 * the repo's convention for every optional durability feature (see
 * isPostgresEnabled() in ../pg/pool.ts). Never throws into the request path:
 * all failures are caught and logged by the caller, which always treats
 * indexing as fire-and-forget relative to the HTTP response already sent to
 * the forwarder.
 */

// Keep this literally in sync with deployment/operations/ism/cs3-logs-lifecycle.json.
// Inlined (rather than read from disk) so the built dist/server.cjs does not depend
// on a repository-relative path that may not exist inside a container image.
const ISM_POLICY_ID = 'cs3-logs-lifecycle';
const ISM_POLICY_BODY = {
  policy: {
    policy_id: ISM_POLICY_ID,
    description: 'Hot 30d, warm 90d, cold 1y with snapshot before delete for CS3 and Wazuh log indices.',
    default_state: 'hot',
    states: [
      {
        name: 'hot',
        actions: [{ replica_count: { number_of_replicas: 1 } }, { rollover: { min_index_age: '1d', min_primary_shard_size: '35gb' } }],
        transitions: [{ state_name: 'warm', conditions: { min_index_age: '30d' } }],
      },
      {
        name: 'warm',
        actions: [
          { allocation: { require: { tier: 'warm' }, wait_for: false } },
          { replica_count: { number_of_replicas: 1 } },
          { force_merge: { max_num_segments: 1 } },
        ],
        transitions: [{ state_name: 'cold', conditions: { min_index_age: '90d' } }],
      },
      {
        name: 'cold',
        actions: [
          { read_only: {} },
          { allocation: { require: { tier: 'cold' }, wait_for: false } },
          { snapshot: { repository: 'cs3-cold', snapshot: '{{ctx.index}}-{{ctx.indexUuid}}' } },
        ],
        transitions: [{ state_name: 'delete', conditions: { min_index_age: '365d' } }],
      },
      { name: 'delete', actions: [{ delete: {} }], transitions: [] },
    ],
    ism_template: [{ index_patterns: ['cs3-*', 'wazuh-alerts-*'], priority: 100 }],
  },
};

export const LOGS_WRITE_ALIAS = 'cs3-logs';
const LOGS_INDEX_TEMPLATE = 'cs3-logs-template';
const LOGS_INITIAL_INDEX = 'cs3-logs-000001';

export function isIndexerEnabled(): boolean {
  return process.env.CS3_INDEXER_ENABLED === 'true' && !!process.env.CECUR_INDEXER_URL;
}

interface SinkResult {
  ok: boolean;
  indexed: number;
  error?: string;
}

function baseUrl(): URL {
  return new URL(process.env.CECUR_INDEXER_URL || 'http://127.0.0.1:9200');
}

function authHeader(): string | undefined {
  const user = process.env.CECUR_INDEXER_USERNAME || 'admin';
  const pass = process.env.CECUR_INDEXER_PASSWORD || '';
  if (!pass) return undefined;
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

let warnedTlsInsecure = false;

/**
 * Lab-only escape hatch for self-signed certs on a single-node OpenSearch instance.
 * Requires an explicit CECUR_INDEXER_TLS_INSECURE=true opt-in (never the default).
 * Production on-prem/airgap deployments must supply a verifiable internal CA and leave
 * this unset/false -- see on-prem/server-extensions/README.md.
 */
function isTlsInsecureAllowed(): boolean {
  const allowed = process.env.CECUR_INDEXER_TLS_INSECURE === 'true';
  if (allowed && !warnedTlsInsecure) {
    warnedTlsInsecure = true;
    console.warn(
      '[cecur] CECUR_INDEXER_TLS_INSECURE=true: skipping TLS certificate verification for the OpenSearch ' +
        'indexer connection. This is a lab-only escape hatch; never enable it in production.'
    );
  }
  return allowed;
}

/** Low-level helper: single HTTP(S) request against the indexer, JSON in / JSON out. */
function request(method: string, pathAndQuery: string, body?: unknown): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const url = baseUrl();
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;
    const payload = body === undefined ? undefined : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const auth = authHeader();

    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: pathAndQuery,
        method,
        timeout: Number(process.env.CS3_INDEXER_TIMEOUT_MS) || 5000,
        headers: {
          'Content-Type': payload && pathAndQuery.includes('_bulk') ? 'application/x-ndjson' : 'application/json',
          'Content-Length': payload ? payload.length : 0,
          ...(auth ? { Authorization: auth } : {}),
        },
        // Lab-only escape hatch for a self-signed OpenSearch cert; requires the explicit,
        // non-default CECUR_INDEXER_TLS_INSECURE=true opt-in (see isTlsInsecureAllowed above).
        ...(isHttps && isTlsInsecureAllowed() ? { rejectUnauthorized: false } : {}), // codeql[js/disabling-certificate-validation]
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: any = undefined;
          try {
            json = text ? JSON.parse(text) : undefined;
          } catch {
            json = { raw: text };
          }
          resolve({ status: res.statusCode || 0, json });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('indexer request timed out')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let bootstrapped = false;
let bootstrapInFlight: Promise<void> | null = null;

/**
 * Idempotently ensures the ISM policy, index template, and initial rollover-alias
 * backing index exist. Safe to call on every bulk index attempt; short-circuits
 * once a bootstrap has succeeded. Never throws — logs and lets indexing proceed
 * (OpenSearch will auto-create a plain index on first write if the alias/template
 * setup above has not completed yet).
 */
async function ensureBootstrap(): Promise<void> {
  if (bootstrapped) return;
  if (bootstrapInFlight) return bootstrapInFlight;

  bootstrapInFlight = (async () => {
    try {
      // Ensure ISM policy exists; failure is non-fatal as it may already exist.
      const ismRes = await request('PUT', `/_plugins/_ism/policies/${ISM_POLICY_ID}`, ISM_POLICY_BODY);
      if (ismRes.status < 200 || ismRes.status >= 300) {
        console.warn(`[opensearch-sink] ISM policy setup returned HTTP ${ismRes.status}, continuing`);
      }

      // Install or update the template. OpenSearch rejects multiple composable templates
      // with overlapping patterns at the same priority; the existing cs3-wazuh-daily has
      // priority 100, so we use 101 to take precedence if both patterns match.
      const templateRes = await request('PUT', `/_index_template/${LOGS_INDEX_TEMPLATE}`, {
        index_patterns: ['cs3-logs-*'],
        template: {
          settings: {
            'plugins.index_state_management.rollover_alias': LOGS_WRITE_ALIAS,
            'plugins.index_state_management.policy_id': ISM_POLICY_ID,
            number_of_shards: 1,
            number_of_replicas: 1,
          },
        },
        priority: 101,
      });
      if (templateRes.status < 200 || templateRes.status >= 300) {
        throw new Error(`index template PUT returned HTTP ${templateRes.status}`);
      }

      // Ensure the write alias exists and is properly configured. Verify the alias resolves
      // to an index, not just that a name exists.
      const aliasCheck = await request('GET', `/_alias/${LOGS_WRITE_ALIAS}`);
      if (aliasCheck.status === 404 || !aliasCheck.json || Object.keys(aliasCheck.json).length === 0) {
        // Create the initial backing index with the write alias.
        const indexRes = await request('PUT', `/${LOGS_INITIAL_INDEX}`, {
          aliases: { [LOGS_WRITE_ALIAS]: { is_write_index: true } },
        });
        if (indexRes.status < 200 || indexRes.status >= 300) {
          throw new Error(`initial index creation returned HTTP ${indexRes.status}`);
        }
      }
      bootstrapped = true;
    } catch (err) {
      console.error('[opensearch-sink] bootstrap (ISM policy / index template / alias) failed, will retry next call:', (err as Error).message);
    } finally {
      bootstrapInFlight = null;
    }
  })();

  return bootstrapInFlight;
}

/**
 * Bulk-indexes a batch of accepted log events into the `cs3-logs` rollover alias.
 * Fire-and-forget from the caller's perspective: never rejects in a way that
 * should block the HTTP response already sent to the forwarder — callers should
 * still `.catch()` this to avoid an unhandled rejection and to log failures.
 */
export async function bulkIndexLogEvents(events: CecurLogEvent[]): Promise<SinkResult> {
  if (events.length === 0) return { ok: true, indexed: 0 };
  if (!isIndexerEnabled()) return { ok: false, indexed: 0, error: 'indexer disabled (CS3_INDEXER_ENABLED != true)' };

  await ensureBootstrap();

  // Map events by their IDs so we can retry individual failures without duplicating successes.
  const eventsById = new Map(events.map((ev) => [ev.id, ev]));

  const attempt = async (toIndex: CecurLogEvent[]): Promise<{ result: SinkResult; failedIds: string[] }> => {
    const lines: string[] = [];
    for (const ev of toIndex) {
      lines.push(JSON.stringify({ index: { _index: LOGS_WRITE_ALIAS, _id: ev.id } }));
      lines.push(JSON.stringify(ev));
    }
    const ndjson = lines.join('\n') + '\n';

    const res = await request('POST', '/_bulk', ndjson);

    // Handle HTTP-level failures (429, 503, 5xx, etc.).
    if (res.status === 429 || res.status === 503) {
      return { result: { ok: false, indexed: 0, error: `HTTP ${res.status} (transient)` }, failedIds: toIndex.map((e) => e.id) };
    }
    if (res.status < 200 || res.status >= 300) {
      // Permanent failures (4xx auth/config issues, unrecoverable 5xx) shouldn't retry.
      return { result: { ok: false, indexed: 0, error: `bulk index HTTP ${res.status}` }, failedIds: [] };
    }

    // Parse per-item results.
    const hasErrors = Boolean(res.json?.errors);
    const items = res.json?.items || [];
    const successfulIds = new Set<string>();
    const failedIds: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i]?.index;
      const id = toIndex[i]?.id;
      if (!id) continue;
      if (item?.error) {
        failedIds.push(id);
      } else {
        successfulIds.add(id);
      }
    }

    return {
      result: { ok: !hasErrors, indexed: successfulIds.size, error: hasErrors ? 'one or more bulk items failed' : undefined },
      failedIds,
    };
  };

  // First attempt.
  const first = await attempt(events);
  if (first.result.ok || first.failedIds.length === 0) {
    return first.result;
  }

  // Retry transient failures (429/503) with backoff, preserving successful results.
  const toRetry = Array.from(first.failedIds).map((id) => eventsById.get(id)!).filter((e) => e);
  if (toRetry.length === 0) {
    return first.result;
  }

  await new Promise((r) => setTimeout(r, 500));
  const retry = await attempt(toRetry);

  // Combine results: successful from first attempt + results from retry.
  const totalIndexed = first.result.indexed + retry.result.indexed;
  const allSucceeded = retry.result.ok && first.result.ok;
  return {
    ok: allSucceeded,
    indexed: totalIndexed,
    error: !allSucceeded ? `initial: ${first.result.error}; retry: ${retry.result.error}` : undefined,
  };
}
