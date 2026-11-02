# 01. Architecture — Real Telemetry Data Path

This document describes the data path `on-prem/` deployments use, and how it differs from the
demo console's simulation loop. Every box in the diagram below is a real file in this repository —
no step is hypothetical.

## 1. End-to-end data path

```
+-----------------+     +------------------+     +--------------------------------+
| Real endpoint   |     | Forwarder        |     | CS3 console (Express)          |
| (Linux/Windows/ | --> | (Fluent Bit,     | --> | POST /api/cecur/logs/ingest    |
|  macOS/container)|     |  systemd/service)|     | server/routes/cecur.ts         |
+-----------------+     +------------------+     +----------------+---------------+
                                                                    |
                              requireIngestKey() (server/fleet/enrollment.ts)
                              validates per-agent X-API-Key minted at claim time
                                                                    |
                                                                    v
                                        +----------------------------------------------+
                                        | db.cecurLogs (in-memory, capped at 300 rows)  |
                                        | — hot cache only, for the console's           |
                                        |   "recent events" views                       |
                                        +----------------------------------------------+
                                                                    |
                                                (fire-and-forget, if CS3_INDEXER_ENABLED=true)
                                                                    v
                                        +----------------------------------------------+
                                        | server/integrations/opensearchSink.ts         |
                                        | bulkIndexLogEvents() -> OpenSearch _bulk       |
                                        | alias: cs3-logs (rollover, ISM-managed)        |
                                        +----------------------------------------------+
                                                                    |
                                                                    v
                                        +----------------------------------------------+
                                        | OpenSearch Indexer                            |
                                        | ISM lifecycle: hot 30d / warm 90d / cold 1y   |
                                        | (deployment/operations/ism/                   |
                                        |  cs3-logs-lifecycle.json)                     |
                                        +----------------------------------------------+
```

In parallel, PostgreSQL (`CS3_PERSISTENCE=postgres`) durably stores the agent roster, enrollment
records, and the tamper-evident audit ledger (`server/pg/store.ts`, `deployment/docker/postgres/init/`).
The two durable stores are complementary: Postgres/JSONB for structured application state and the
audit chain, OpenSearch for high-volume, search/aggregation-oriented log and alert data.

## 2. Enrollment path (how a host becomes a "real endpoint")

```
Admin                  Console                        Forwarder host
  | bulk enroll           |                                |
  |---------------------->| POST /api/fleet/enroll/bulk    |
  |                       | (deployment/agents/cs3-enroll.mjs)
  |<----------------------| agentId + one-time token per host
  | distribute token      |                                |
  |------------------------------------------------------->|
  |                       |        POST /api/fleet/enroll/claim
  |                       |<-------------------------------|
  |                       | per-agent ingest key issued     |
  |                       |------------------------------->|
  |                       |        POST /api/cecur/logs/ingest (X-API-Key)
  |                       |<-------------------------------|
```

Code references: `demo/demo-100226/server/fleet/enrollment.ts` (`bulkEnroll`, `claimEnrollment`,
`requireIngestKey`), `demo/demo-100226/server/routes/fleet.ts`, `deployment/agents/cs3-enroll.mjs`,
`deployment/agents/install-forwarder.sh` / `Install-CecurForwarder.ps1`.

## 3. Contrast with `demo/demo-100226`

| Aspect | Demo (`CS3_DEMO_MODE=true`) | On-prem (this directory) |
|---|---|---|
| Seed data | `server/db.ts#seed()` calls every `generateInitial*()` in `server/data/generators.ts` | Never called — `isDemoMode()` is false, so the constructor only runs `bootstrapAdmin()` |
| Background loop | `setInterval(() => db.simulateTick(), 3500)` in `server.ts`, gated by `if (demoMode)` | Loop is skipped entirely; the only writes to `db.cecurLogs` come from real `/api/cecur/logs/ingest` calls |
| Durability | None — everything lives and dies with the process | OpenSearch durable indexing (`CS3_INDEXER_ENABLED=true`) plus Postgres for agents/audit |

`bin/preflight-check.sh` asserts `CS3_DEMO_MODE` is unset or `false` precisely so this contrast can
never be accidentally violated in a production on-prem install.

## 4. Why the durability fix was necessary

Before this change, `cecurRouter.post('/logs/ingest', ...)` (`server/routes/cecur.ts`) pushed every
accepted event into `db.cecurLogs` and then ran:

```ts
if (db.cecurLogs.length > 300) db.cecurLogs = db.cecurLogs.slice(0, 300);
```

The repository already stood up a real OpenSearch container (`indexer` service, profile `siem`, in
`deployment/docker/docker-compose.yml`) and a full operations SOP
(`deployment/operations/opensearch-cluster.md`), but no server code ever wrote an accepted event to it
— `CECUR_INDEXER_URL` was read only by `server/routes/system.ts` to report a status string. For a real
on-prem fleet of 1,000+ endpoints, this meant telemetry was accepted correctly but anything beyond the
most recent 300 events was silently discarded in-process on every restart or rollover.

`server/integrations/opensearchSink.ts` closes this gap: when `CS3_INDEXER_ENABLED=true`, every batch
accepted by `/api/cecur/logs/ingest` is additionally bulk-indexed into the `cs3-logs` rollover alias,
bootstrapped against the ISM policy already authored at
`deployment/operations/ism/cs3-logs-lifecycle.json`. See `server-extensions/README.md` for the full
wiring description.
