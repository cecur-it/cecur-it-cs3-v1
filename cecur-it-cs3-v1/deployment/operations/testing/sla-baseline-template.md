# Performance baseline and SLA template

Use this template after a representative load test or failover drill.

## 1. Baseline measurement table

| Metric | Measurement window | Baseline value | Peak value | Notes |
|---|---|---:|---:|---|
| Ingest availability (%) | | | | |
| Ingest-to-index p50 (ms) | | | | |
| Ingest-to-index p95 (ms) | | | | |
| Console API p95 (ms) | | | | |
| Console UI page load p95 (ms) | | | | |
| LLM first-token p95 (ms) | | | | |
| Agent heartbeat freshness p95 (s) | | | | |
| Postgres CPU (%) | | | | |
| OpenSearch JVM heap (%) | | | | |
| Ollama queue depth | | | | |

## 2. SLI definitions

| SLI | Definition | Measurement method |
|---|---|---|
| Ingest availability | Successful `201` responses from `POST /api/cecur/logs/ingest` divided by total valid requests | load generator + edge logs |
| Ingest-to-index latency | Time from ingest acceptance to searchable/indexed visibility | synthetic marker events + search timestamps |
| Console p95 latency | p95 of analyst-facing API/UI requests | reverse proxy / APM / browser synthetic checks |
| LLM p95 first-token latency | p95 time to first token from the configured inference backend | application or gateway timing logs |
| Agent heartbeat freshness | Age of the last known keepalive for active agents | fleet summary plus per-agent inventory metrics |

## 3. SLO targets

| Service tier | Ingest availability | Ingest-to-index p95 | Console p95 | LLM first-token p95 | Agent heartbeat freshness |
|---|---:|---:|---:|---:|---:|
| Standard | 99.5% | 5 s | 2 s | 8 s | 300 s |
| Mission | 99.9% | 2 s | 1 s | 5 s | 120 s |
| High-assurance / air-gap | 99.9% | 3 s | 1.5 s | 7 s | 180 s |

## 4. SLA tiers

| SLA tier | Recommended profile | Support window | Notes |
|---|---|---|---|
| Bronze | cloud or pilot onprem | Business hours | Best for non-mission workloads or internal pilots |
| Silver | cloud or onprem | 24x7 response for Sev-1/2 | Default enterprise production tier |
| Gold | onprem or airgap | 24x7 with pre-approved change windows and failover testing | Use where regulatory or enclave requirements apply |

## 5. Error budget policy

| Tier | Monthly error budget | Burn alert | Action when exhausted |
|---|---:|---:|---|
| Standard (99.5%) | 3h 39m | 25% in 7 days | Pause non-essential feature rollout until stability is restored |
| Mission (99.9%) | 43m 50s | 10% in 7 days | Freeze risky deploys and require incident review |
| High-assurance (99.9%) | 43m 50s | 5% in 7 days | CAB review before any non-emergency change |

## 6. Report template

### Test / reporting period

- Environment:
- Profile (`cloud`, `onprem`, `airgap`):
- Dates:
- Build / chart / Git revision:
- Regions / sites included:

### Workload summary

- Scenario used:
- Average EPS:
- Peak EPS:
- Test duration:
- Data mix:

### Results summary

| SLI | Objective | Observed | Pass/Fail | Evidence |
|---|---|---:|---|---|
| Ingest availability | | | | |
| Ingest-to-index p95 | | | | |
| Console p95 | | | | |
| LLM first-token p95 | | | | |
| Agent heartbeat freshness | | | | |

### Incidents / anomalies during period

| Timestamp | Symptom | Impact | Mitigation | Follow-up owner |
|---|---|---|---|---|

### Improvement actions

| Action | Priority | Owner | Due date |
|---|---|---|---|
