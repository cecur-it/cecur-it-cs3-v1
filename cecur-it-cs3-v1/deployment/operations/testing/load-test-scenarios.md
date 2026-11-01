# Load-test scenarios

The CS3 ingest path accepts JSON events at `POST /api/cecur/logs/ingest` and requires `X-API-Key` when `CS3_INGEST_REQUIRE_KEY=true`. The scenarios below model steady SOC ingest at three fleet sizes.

## 1. Shared workload model

### Event mix

| Event type / source | Share | Example severity mix |
|---|---:|---|
| Syslog / infrastructure (`syslog`, `nginx`) | 40% | 80% `info`, 15% `medium`, 5% `high` |
| Auth activity (`auth.log`, Windows auth, IAM) | 25% | 60% `info`, 30% `medium`, 10% `high` |
| Endpoint telemetry (`auditd`, `windows_event`) | 20% | 70% `info`, 20% `medium`, 10% `high` |
| Container / Kubernetes audit (`k8s_audit`) | 10% | 50% `info`, 35% `medium`, 15% `high` |
| Cloud control-plane / threat burst (`cloudtrail` or equivalent) | 5% | 30% `medium`, 50% `high`, 20% `critical` |

### Event shape

Each event should contain:

- `message`
- `source`
- `severity`
- `agentId`
- `agentName`
- `fields` (object)

### Common test conditions

- TLS enabled end-to-end
- Valid `X-API-Key`
- Reverse proxy, console, and database logs captured
- NTP synchronized
- No unrelated maintenance during the run

## 2. Scenario matrix

| Scenario | Target EPS | Duration | Ramp | Suggested concurrency | Use case |
|---|---:|---:|---:|---:|---|
| Small SOC | 100 | 30 min | 10 min | 50 | Single site, pilot rollout, small MSSP tenant |
| Mid-size SOC | 1,000 | 60 min | 15 min | 250 | Regional SOC, multiple business units |
| Large SOC | 10,000 | 90 min | 20 min | 1,500 | National SOC, multi-site or high-frequency telemetry |

## 3. Pass / fail thresholds

### Small SOC (100 EPS)

| Metric | Pass threshold | Fail trigger |
|---|---|---|
| Achieved EPS | `>= 95 EPS` over steady-state window | `< 95 EPS` sustained for 5 min |
| HTTP success rate | `>= 99.9%` | `< 99.5%` |
| 429 rate | `0%` steady-state | Any sustained 429s after ramp |
| p95 ingest latency | `<= 250 ms` | `> 500 ms` for 5 min |
| p99 ingest latency | `<= 500 ms` | `> 1 s` |
| `/api/health` | Always `200` | Two consecutive failures |

### Mid-size SOC (1,000 EPS)

| Metric | Pass threshold | Fail trigger |
|---|---|---|
| Achieved EPS | `>= 950 EPS` | `< 900 EPS` sustained for 5 min |
| HTTP success rate | `>= 99.5%` | `< 99.0%` |
| 429 rate | `< 0.5%` during ramp, `0%` steady-state | `>= 1%` after ramp |
| p95 ingest latency | `<= 500 ms` | `> 1 s` for 5 min |
| p99 ingest latency | `<= 1 s` | `> 2 s` |
| Console p95 UI latency | `<= 1.5 s` | `> 3 s` |

### Large SOC (10,000 EPS)

| Metric | Pass threshold | Fail trigger |
|---|---|---|
| Achieved EPS | `>= 9,500 EPS` | `< 9,000 EPS` sustained for 10 min |
| HTTP success rate | `>= 99.0%` | `< 98.5%` |
| 429 rate | `< 2%` during ramp and burst recovery | `>= 2%` sustained for 10 min |
| p95 ingest latency | `<= 1.5 s` | `> 3 s` |
| p99 ingest latency | `<= 3 s` | `> 5 s` |
| Data-tier health | No failed primary/replica role change; no red cluster state | Any unplanned failover or red state |

## 4. Test execution plan

### Step 1 - preflight

- `curl -fsS https://cs3.example.mil/api/health`
- Verify enough disk, CPU, and file descriptors.
- Confirm no certs or enrollment tokens are within 24 hours of expiry.

### Step 2 - warm-up

Run `eps-loadgen.mjs` at 10% of target EPS for 5 minutes.

### Step 3 - full scenario

Run the matching Node.js or k6 scenario.

### Step 4 - soak or burst extension

For the 1,000 and 10,000 EPS bands, add one of the following:

- 2x burst for 60 seconds
- 4-hour soak at 70% of target EPS

### Step 5 - evidence capture

Record:

- load-generator summary
- reverse proxy metrics
- console CPU and memory
- Postgres wait events / connections
- OpenSearch ingest backlog / shard health
- `/api/health` poll history

## 5. Exit criteria

The scenario is complete only when:

- all target thresholds pass
- no silent data loss is observed
- no sustained `429` or `5xx` pattern remains at the end of ramp
- the platform returns to baseline within 15 minutes after load ends
