# Server extensions — OpenSearch durability fix

## Where this actually lives (plan deviation, documented intentionally)

The original plan for this directory called for a standalone
`on-prem/server-extensions/opensearch-sink.ts`. The real, compiled, wired implementation instead
lives at:

**[`demo/demo-100226/server/integrations/opensearchSink.ts`](../../demo/demo-100226/server/integrations/opensearchSink.ts)**

This is a deliberate deviation, not an oversight: the console's TypeScript build
(`demo/demo-100226`, bundled via esbuild into `dist/server.cjs`, type-checked by `npx tsc --noEmit`
and the `console` CI job in `.github/workflows/deployment-validate.yml`) is the only place this code
can actually compile, import the existing `CecurLogEvent` type, and be covered by CI. A copy living
only under `on-prem/` would be unreferenced dead code that silently drifts out of sync with the real
route handler. Keeping one real file, with this README pointing to it, avoids that.

## What was wrong (the gap)

Before this change, `POST /api/cecur/logs/ingest`
(`demo/demo-100226/server/routes/cecur.ts`) accepted real telemetry from enrolled endpoints but only
ever wrote it into `db.cecurLogs`, an in-memory array capped at 300 rows:

```ts
if (db.cecurLogs.length > 300) db.cecurLogs = db.cecurLogs.slice(0, 300);
```

Meanwhile the stack already runs a real OpenSearch container (`indexer` service, profile `siem`, in
`deployment/docker/docker-compose.yml`) with a full operations SOP
(`deployment/operations/opensearch-cluster.md`) and an authored ISM lifecycle policy
(`deployment/operations/ism/cs3-logs-lifecycle.json`), but `CECUR_INDEXER_URL` was read only by
`server/routes/system.ts` to report a status string — no code ever wrote a document to it. For a
real on-prem fleet of 1,000+ endpoints, this meant events beyond the most recent 300 were silently
discarded on every ingest call, and *all* events were lost on every console restart.

## What the fix does

`server/integrations/opensearchSink.ts` exports:

- `isIndexerEnabled()` — `true` only when **both** `CS3_INDEXER_ENABLED=true` **and**
  `CECUR_INDEXER_URL` is set, mirroring the repo's existing opt-in-plus-check convention for
  optional durability features (see `isPostgresEnabled()` in `server/pg/pool.ts`, which requires
  both `CS3_PERSISTENCE=postgres` and `DATABASE_URL`).
- `bulkIndexLogEvents(events)` — idempotently bootstraps (on first use) the ISM policy, an index
  template (`cs3-logs-template`, pattern `cs3-logs-*`), and the rollover-alias-backed index
  `cs3-logs-000001` aliased to `cs3-logs`, then bulk-indexes the given events into that alias via
  OpenSearch's `_bulk` API, with one retry on failure. It never throws into the request path — all
  failures are caught and logged.

`server/routes/cecur.ts`'s `POST /logs/ingest` handler now, in addition to the existing in-memory
write, collects every accepted event and calls `bulkIndexLogEvents(...)` fire-and-forget (gated by
`isIndexerEnabled()`), and the response's `indexed` field now reflects whether durable indexing is
actually configured, instead of a hardcoded `true`.

## Why `GET /api/cecur/logs` still only reads the hot cache

`GET /api/cecur/logs` is unchanged and intentionally still reads only `db.cecurLogs` — it backs the
console's low-latency "recent events" view, which should not take an extra network round trip to
OpenSearch on every poll. OpenSearch is the durable, searchable, long-retention store; the in-memory
array is a bounded hot cache for the UI. `on-prem/bin/verify-real-telemetry.sh` checks both,
separately, and explains this distinction further — see also
`Literature/04_VALIDATION_AND_ACCEPTANCE.md`.

## Configuration

New environment variables (added to `onboarding/env.onprem.template`,
`onboarding/env.airgap.template`, `demo/demo-100226/.env.example`, and
`deployment/docker/.env.example`/`docker-compose.yml`):

| Variable | Default | Purpose |
|---|---|---|
| `CS3_INDEXER_ENABLED` | `false` | Opt-in switch; must be explicitly `true` to index anything |
| `CECUR_INDEXER_URL` | `https://127.0.0.1:9200` (dev) / `https://indexer:9200` (compose) | OpenSearch endpoint |
| `CECUR_INDEXER_USERNAME` | `admin` | Basic Auth username (OpenSearch 2.x security plugin default) |
| `CECUR_INDEXER_PASSWORD` | *(blank)* | Basic Auth password; set to `OPENSEARCH_INITIAL_ADMIN_PASSWORD` in compose deployments |
| `CECUR_INDEXER_TLS_INSECURE` | `false` | Set `true` only to accept a self-signed OpenSearch cert in lab use; production should use a real CA over `https://` |

## Retention

`deployment/operations/ism/cs3-logs-lifecycle.json` is the source of truth for the ISM policy (hot
30d → warm 90d → cold 1y → delete). `opensearchSink.ts` inlines a copy of this policy body
(`ISM_POLICY_BODY`) because the compiled console does not reliably have access to
`deployment/` at runtime. **If you change the retention windows, update both files.**
