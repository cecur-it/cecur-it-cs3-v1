# Capacity planning SOP

Size CS3 from sustained ingest and analyst concurrency, not just endpoint count. The tables below assume mixed Windows/Linux workstation telemetry, Wazuh-style alert volume, and the default CS3 local model pair (`nemotron-3-nano:30b` primary, `gemma4:26b` fallback).

## Planning assumptions

- average sustained telemetry: **~1 EPS per endpoint**
- average retained event size in OpenSearch after compression and mappings: **0.45-0.70 KiB**
- average JSONB row footprint in PostgreSQL for operational objects and audit entries: **1.2-2.0 KiB**
- keep **30% CPU**, **20% RAM**, and **25% disk** free at steady state

## Reference sizes

| Estate | Endpoints | Sustained EPS | Burst EPS | Concurrent analysts |
|---|---:|---:|---:|---:|
| Small | 100 | 100 | 500 | 5 |
| Medium | 1,000 | 1,000 | 5,000 | 25 |
| Large | 10,000 | 10,000 | 50,000 | 100 |

## Per-component starting sizes

| Component | 100 endpoints | 1,000 endpoints | 10,000 endpoints |
|---|---|---|---|
| Console | 2 vCPU / 4 GiB / 20 GiB, 1-2 replicas | 4 vCPU / 8 GiB / 40 GiB, 2-4 replicas | 8 vCPU / 16 GiB / 80 GiB, 6-10 replicas |
| PostgreSQL | 4 vCPU / 16 GiB / 200 GiB SSD | 8 vCPU / 32 GiB / 1 TiB SSD | 16-32 vCPU / 64-128 GiB / 4 TiB NVMe |
| OpenSearch hot tier | 3 x (4 vCPU / 16 GiB / 300 GiB NVMe) | 3 x (8 vCPU / 32 GiB / 2 TiB NVMe) | 6 x (16 vCPU / 64 GiB / 8 TiB NVMe) |
| OpenSearch warm tier | not required | 2 x (4 vCPU / 16 GiB / 4 TiB SSD) | 3 x (8 vCPU / 32 GiB / 12 TiB SSD/HDD) |
| Ollama | 2 x GPU nodes, 24 GiB VRAM each | 3 x GPU nodes, 24-48 GiB VRAM each | 6+ GPU nodes, 48 GiB VRAM preferred |
| Load balancers / ingress | 2 vCPU / 2 GiB | 2 vCPU / 4 GiB | 4 vCPU / 8 GiB |

## Storage growth formulas

### OpenSearch / Wazuh Indexer

```text
daily_hot_gib = (EPS × avg_event_bytes × 86400 × replica_factor) / 2^30
required_hot_storage = daily_hot_gib × hot_days × 1.25
```

Example for 1,000 EPS, 650-byte compressed documents, 1 replica, 30 hot days:

```text
daily_hot_gib = (1000 × 650 × 86400 × 2) / 2^30 ≈ 104.6 GiB/day
required_hot_storage ≈ 104.6 × 30 × 1.25 ≈ 3.9 TiB
```

### PostgreSQL

```text
daily_pg_gib = (writes_per_day × avg_row_bytes × 1.30) / 2^30
total_pg_storage = (daily_pg_gib × retention_days) + base_backup_space + WAL_space
```

Use `1.30` to account for indexes, TOAST, VACUUM headroom, and WAL spill. For append-only audit-heavy estates, size WAL separately for at least 24 hours of peak write traffic.

## LLM concurrency sizing

Treat each Ollama node as a finite prompt budget:

```text
safe_parallel_requests = nodes × OLLAMA_NUM_PARALLEL × 0.7
```

The `0.7` factor leaves room for context spikes, model reloads, and one degraded node. Example: 3 nodes × `OLLAMA_NUM_PARALLEL=4` × 0.7 ≈ **8 safe parallel requests**. If your analysts exceed that regularly, add nodes before increasing `NUM_PARALLEL`.

## Headroom rules

- CPU: alert above 70% sustained for 15 minutes
- RAM: alert when free memory drops below 20%
- PostgreSQL connections: keep below 80% of `max_connections`
- OpenSearch disk: keep hot nodes below 75% used and warm/cold below 80% used
- Ollama VRAM: reserve ~20% for model swaps and tokenizer spikes
- WAL archive: store at least 24 hours of WAL even after the last successful base backup

## Scale triggers

| Trigger | Action |
|---|---|
| Console p95 API latency > 500 ms for 15 min | add console replicas and lower `CS3_PG_POOL_MAX` per replica if needed |
| PostgreSQL CPU > 70% or checkpoints stall | add CPU/IOPS, tune autovacuum, or move reads to replicas |
| OpenSearch unassigned shards or hot-node disk > 75% | add hot data nodes or raise shard count for new indices |
| Ollama queue growth for 10 min | add a node or lower `OLLAMA_NUM_PARALLEL` |
| Agent enrollment requests hit `413` | lower batch size or raise `CS3_ENROLL_MAX_BATCH` with matching JSON/body limits |

## Procurement checklist

Before signing off a new estate size, confirm:

- expected EPS with 2x burst factor
- hot / warm / archive retention requirements
- peak analyst concurrency using AI-assisted workflows
- GPU availability and lead time
- backup repository capacity for PostgreSQL base backups, WAL, and OpenSearch snapshots
