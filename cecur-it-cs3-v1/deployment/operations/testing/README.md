# Testing assets

This directory contains production-style test procedures and load tools for CS3.

## Contents

| File | Purpose |
|---|---|
| `load-test-scenarios.md` | Workload models and pass/fail thresholds for 100 / 1,000 / 10,000 EPS |
| `eps-loadgen.mjs` | Node.js core-only load generator for `POST /api/cecur/logs/ingest` |
| `k6-ingest.js` | k6 constant-arrival-rate ingest test |
| `chaos-playbook.md` | Controlled failure experiments for console, Ollama, Postgres, OpenSearch, and network partitions |
| `multi-site-failover.md` | Active/passive and active/active failover drills |
| `sla-baseline-template.md` | SLI/SLO and baseline reporting template |

## Prerequisites

- A reachable CS3 endpoint exposing `POST /api/cecur/logs/ingest`
- A valid `X-API-Key` accepted by `requireIngestKey()`
- A change window and rollback plan for chaos or failover testing
- For `k6-ingest.js`, a working `k6` installation
- For Kubernetes drills, `kubectl` access to the target namespace

## Quick start

### Validate the Node.js generator

```bash
node --check deployment/operations/testing/eps-loadgen.mjs
```

### Run a short ingest smoke test

```bash
node deployment/operations/testing/eps-loadgen.mjs \
  --url https://ingest.cs3.example.mil/api/cecur/logs/ingest \
  --api-key YOUR_INGEST_KEY \
  --eps 25 \
  --duration 60 \
  --concurrency 10 \
  --ramp 10
```

### Run the k6 medium scenario

```bash
k6 run \
  -e CS3_URL=https://ingest.cs3.example.mil/api/cecur/logs/ingest \
  -e CS3_API_KEY=YOUR_INGEST_KEY \
  -e SCENARIO=medium \
  deployment/operations/testing/k6-ingest.js
```

## Recommended order of operations

1. Confirm `/api/health` is nominal.
2. Run the Node.js smoke test.
3. Run the k6 scenario that matches the target EPS band.
4. Review `load-test-scenarios.md` thresholds.
5. Perform chaos and failover drills only after baseline load tests pass.
