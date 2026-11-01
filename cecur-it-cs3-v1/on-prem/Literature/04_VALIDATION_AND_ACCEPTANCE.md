# 04. Validation & Acceptance — Proving No Mock Data and Durable Ingestion

This is the acceptance procedure referenced by `checklists/go-live-checklist.md`. Each step cites
the exact code path it exercises so the result is falsifiable, not a vibe check.

## 1. Prove demo mode is off

```bash
on-prem/bin/preflight-check.sh
```

Fails closed if `CS3_DEMO_MODE=true`, which is the single switch controlling both mock-data seeding
(`server/db.ts` constructor calling `server/data/generators.ts#generateInitial*`) and the simulated
tick loop (`setInterval(() => db.simulateTick(), 3500)` in `server.ts`). If this check passes, no
code path in the running console can be generating synthetic data.

## 2. Prove the console starts with zero seed data

On a freshly provisioned on-prem console (before any enrollment), `GET /api/cecur/agents` and
`GET /api/cecur/logs` should return only the single bootstrap admin context and no synthetic
agents/log history — contrast with `demo/demo-100226` where `generateInitial*()` pre-populates many
rows. There is no dedicated script for this because it is inherently a "before you do anything
else" observation; capture it in your go-live evidence (e.g. a screenshot or saved API response) if
your compliance framework requires attestation.

## 3. Prove a real endpoint can enroll and forward telemetry

```bash
on-prem/bin/enroll-real-endpoints.sh --url https://cs3.example.internal --file hosts.csv --group prod
# ... roll out the forwarder per Literature/03_REAL_ENDPOINT_ONBOARDING.md ...
on-prem/bin/verify-real-telemetry.sh --url https://cs3.example.internal --ingest-key <per-agent key> --token "$CS3_TOKEN"
```

`verify-real-telemetry.sh` posts a uniquely marked event through the real ingest path
(`POST /api/cecur/logs/ingest`, authenticated with the forwarder's own per-agent key — not a shared
secret) and confirms it is retrievable via `GET /api/cecur/logs`. This is the hot-cache,
immediate-visibility check.

## 4. Prove telemetry is durable (survives a restart), not just in the 300-row hot cache

With `CS3_INDEXER_ENABLED=true`, `verify-real-telemetry.sh` additionally queries OpenSearch's
`_search` API directly for the marker event. This is deliberately **not** done by re-polling
`GET /api/cecur/logs` after a restart, because that route only ever reads the in-memory hot cache
(`db.cecurLogs`) — it does not read back from OpenSearch (see `server-extensions/README.md` for why).
A direct OpenSearch query is therefore the actual proof of durability: if the marker is found there,
it will still be found after the console process restarts, because OpenSearch is a separate,
persistent service.

For a stronger acceptance test, actually restart the console (`docker compose restart console` or
the equivalent for your `--vehicle`) between steps 3 and 4 and confirm:

- `GET /api/cecur/logs?search=<marker>` returns **nothing** (hot cache is empty again — expected).
- The OpenSearch `_search` query in `verify-real-telemetry.sh` still returns the marker (durable
  store is intact).

Both outcomes together are the actual acceptance criterion: on-prem CS3 is accepting and *durably
retaining* real telemetry, independent of console process lifetime.

## 5. Prove scale (1,000+ endpoints)

Run the appropriate load scenario from `deployment/operations/testing/load-test-scenarios.md`
(`eps-loadgen.mjs` or `k6-ingest.js`, 100/1,000/10,000 EPS) against a staging console with the same
profile/indexer configuration as production, and record the results against
`deployment/operations/testing/sla-baseline-template.md`.

## 6. Prove the audit ledger is intact

```bash
# requires DATABASE_URL / CS3_PERSISTENCE=postgres
psql "$DATABASE_URL" -c "select cs3.verify_audit_chain();"   # NULL == intact
```

This is unrelated to log durability but is the other half of "no mock data, nothing silently
dropped" for a real on-prem install — see root `README.md` §10.1 and §6.4.2.
