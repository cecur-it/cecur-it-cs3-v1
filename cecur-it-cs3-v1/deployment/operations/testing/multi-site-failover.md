# Multi-site failover test procedures

This runbook validates CS3 across two sites. Use it for both active/passive and active/active designs.

## 1. Topologies

### Active / passive

- **Site A**: primary ingest, primary console, primary Postgres writer, primary OpenSearch writers
- **Site B**: warm standby console, Postgres replica, OpenSearch CCR follower, standby ingress
- DNS/GSLB normally points forwarders and analysts to Site A

### Active / active

- **Site A and Site B** both accept ingest
- Postgres uses a single-writer pattern with a promoted standby or a managed cross-site HA service
- OpenSearch uses cross-cluster replication or a shard-aware dual-site design
- GSLB distributes by geography/health

## 2. Data-path assumptions

| Component | Requirement |
|---|---|
| Postgres | Cross-site replication with tested promotion procedure |
| OpenSearch | Cross-cluster replication (CCR) or equivalent verified replica feed |
| DNS / GSLB | Health-checked failover with low enough TTL to meet RTO |
| Forwarders | Ordered failover list, for example `ingest-a`, then `ingest-b` |
| PKI | Both sites present certs chaining to the same trust bundle or overlapping bundle during rotation |

## 3. Example forwarder failover list

For Linux or containerized forwarders, keep the primary and secondary URLs in config management:

```ini
PrimaryURL=https://ingest-a.cs3.example.mil/api/cecur/logs/ingest
SecondaryURL=https://ingest-b.cs3.example.mil/api/cecur/logs/ingest
HealthURL=https://cs3-a.cs3.example.mil/api/health
```

For Windows service wrappers or watchdog tasks, implement the same order and retry budget.

## 4. Test timeline

| Time | Action | Evidence to capture |
|---|---|---|
| T0 | Confirm both sites healthy and replication current | `/api/health`, replication lag, CCR status |
| T1 | Start continuous ingest to Site A and background health probes to both sites | loadgen output, probe logs |
| T2 | Freeze change activity outside the test | CAB/ticket reference |
| T3 | Induce failure of Site A ingress or primary service | DNS change record, node/pod event logs |
| T4 | Observe failover to Site B | RTO stopwatch, 5xx/429 counts |
| T5 | Keep traffic on Site B for at least 30 minutes | latency and backlog metrics |
| T6 | Restore Site A and verify replication resync | lag graphs, cluster status |
| T7 | Fail back or re-enter active/active steady state | final health and routing confirmation |

## 5. Procedure - active / passive

### Pre-checks

```bash
curl -fsS https://cs3-a.cs3.example.mil/api/health
curl -fsS https://cs3-b.cs3.example.mil/api/health
```

Capture database and search replication state using your platform tools before the cut.

### Induce primary-site outage

Possible triggers:

- withdraw Site A VIP / ingress
- stop Site A reverse proxy
- sever Site A WAN edge
- promote Site B Postgres replica if automatic failover does not occur

### DNS / GSLB failover

- Reduce TTL before the test window (for example 30-60 seconds).
- Trigger the failover policy or update the active record.
- Record when clients begin hitting Site B.

### Pass criteria

- RTO meets the target
- RPO matches observed replication lag at T3
- no data corruption or split-brain condition

## 6. Procedure - active / active

### Pre-checks

- verify both sites are accepting traffic
- verify traffic distribution matches the expected GSLB weight
- confirm one clear writer policy for Postgres

### Failure test

1. Remove Site A from the GSLB answer set.
2. Keep Site B fully active.
3. Confirm ingest continues without changing endpoint configuration on agents.
4. Restore Site A and gradually reintroduce it.

### Pass criteria

- GSLB withdraws the failed site inside target RTO
- no duplicate writes or shard divergence occurs
- reintroduced site catches up before taking production weight again

## 7. RTO / RPO measurement

### RTO

Measure from the first confirmed failure at T3 until all of the following are true:

- `POST /api/cecur/logs/ingest` returns `201` on the surviving site
- `/api/health` for the surviving user path is `200`
- analyst login / dashboard loads succeed

### RPO

Measure by comparing the last acknowledged event at Site A before cutover with the first searchable/available event at Site B after failover.

Record:

- source event timestamp
- Site A ack timestamp
- Site B searchable timestamp
- any dropped or duplicated event IDs

## 8. Fail-back procedure

1. Restore Site A networking and dependencies.
2. Verify Postgres replication is fully caught up.
3. Verify OpenSearch CCR or index synchronization is healthy.
4. Return Site A to standby or active service according to the design.
5. Re-enable GSLB weight gradually.
6. Confirm forwarders prefer the intended primary again.

Do **not** fail back while replication lag is unknown or while either site is still degraded.

## 9. Evidence checklist

- [ ] health output from both sites at T0, T4, T7
- [ ] load-generator summary covering the entire drill
- [ ] DNS/GSLB change log or health-event log
- [ ] Postgres replication screenshots or command output
- [ ] OpenSearch CCR/shard health evidence
- [ ] analyst console reachability proof
- [ ] final RTO and RPO calculation
