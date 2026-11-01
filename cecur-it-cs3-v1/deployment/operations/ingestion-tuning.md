# Ingestion tuning SOP

This runbook tunes the path from forwarders to the CS3 console and on to the indexer. The defaults in `deployment/docker/ollama-lb/nginx.conf`, `deployment/docker/ollama-lb/haproxy.cfg`, and `demo/demo-100226/server.ts` are safe for lab traffic; production sites should tune them by sustained EPS tier.

## Forwarder buffering (Fluent Bit)

Use filesystem buffering so short console or indexer outages do not drop telemetry:

```ini
[SERVICE]
    Flush                     1
    Daemon                    Off
    Log_Level                 info
    storage.path              /var/lib/fluent-bit/storage
    storage.sync              normal
    storage.checksum          on
    storage.backlog.mem_limit 256MB
    storage.max_chunks_up     256

[INPUT]
    Name           tail
    Path           /var/log/*.log
    Tag            cs3.logs
    Mem_Buf_Limit  64MB
    Skip_Long_Lines On
    storage.type   filesystem

[OUTPUT]
    Name           http
    Match          cs3.logs
    Host           soc.example.internal
    Port           443
    URI            /api/cecur/logs/ingest
    Format         json
    tls            On
    Retry_Limit    False
```

Tuning rules:

- `Mem_Buf_Limit`: set per input; keep it low enough that a wedged source cannot starve the host.
- `storage.max_chunks_up`: raise this before raising process RAM.
- keep the disk-backed buffer on a filesystem with its own quota and alerting.

## Backpressure and retry behavior

The repo already enforces backpressure at the Ollama front-end:

- NGINX: `limit_conn ollama_total 64` and `limit_conn_status 503`
- HAProxy: `timeout queue 30s` and `default-server ... maxconn 8`

Client policy for `429` / `503` from any CS3 ingress hop:

```bash
attempt=0
until curl -fsS -XPOST https://soc.example.internal/api/cecur/logs/ingest       -H 'Content-Type: application/json'       -H "X-API-Key: ${CS3_INGEST_KEY}"       -d @event.json; do
  attempt=$((attempt + 1))
  sleep "$(( (RANDOM % 3) + attempt ))"
  [ "$attempt" -lt 8 ] || exit 1
done
```

Keep retries bounded and jittered. A synchronized fleet retry is worse than a short drop.

## Console-side limits

`demo/demo-100226/server.ts` applies `express.json({ limit: process.env.CS3_JSON_LIMIT || '2mb' })`. Fleet enrollment caps batches with `CS3_ENROLL_MAX_BATCH` (`1000` by default). Set both explicitly in production.

Recommended starting points:

| Setting | 100 EPS | 1,000 EPS | 10,000 EPS |
|---|---:|---:|---:|
| `CS3_JSON_LIMIT` | `2mb` | `4mb` | `8mb` |
| `CS3_ENROLL_MAX_BATCH` | `250` | `1000` | `2000` |
| `CS3_PG_POOL_MAX` per console replica | `10` | `20` | `30` |

## OpenSearch sharding and routing

Use daily indices and size primaries for 20-40 GiB each. Apply a template before traffic starts:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT https://indexer-mgr-1.example.internal:9200/_index_template/cs3-ingest       -d '{
    "index_patterns":["cs3-logs-*"],
    "template":{
      "settings":{
        "number_of_shards":4,
        "number_of_replicas":1,
        "refresh_interval":"30s"
      }
    },
    "priority":100
  }'
```

If your bulk clients support custom routing, route by first agent group to keep related documents together:

```text
{"index":{"_index":"cs3-logs-2026.10.19","_id":"evt-001","routing":"windows-workstations"}}
{"agentId":"cecur-ag-123","group":["windows-workstations"],"message":"log line"}
```

If the client cannot set `_routing`, split index names by group instead, for example `cs3-logs-windows-2026.10.19`.

## Bulk sizing

Use bytes first, record count second:

| Tier | Max docs / bulk | Max bulk size | Flush interval |
|---|---:|---:|---:|
| 100 EPS | 200 | 2 MiB | 1 s |
| 1,000 EPS | 500 | 5 MiB | 1 s |
| 10,000 EPS | 1000 | 10 MiB | 500 ms |

Never let a single bulk request exceed the front-end `client_max_body_size` or ingress body-size limit.

## NGINX front-end settings

The shipped config already disables response buffering for streamed inference. For heavy ingest on the console ingress, use the same discipline:

```nginx
limit_conn_zone $server_name zone=console_total:1m;
server {
  listen 443 ssl;
  client_max_body_size 8m;
  proxy_request_buffering off;
  proxy_buffering off;
  proxy_connect_timeout 3s;
  proxy_read_timeout 120s;
  limit_conn console_total 512;
  limit_conn_status 503;
}
```

## HAProxy front-end settings

```haproxy
frontend cs3_ingest
  bind :443 ssl crt /etc/haproxy/certs/cs3.pem
  default_backend cs3_console

backend cs3_console
  balance roundrobin
  option httpchk GET /api/health
  default-server inter 5s fall 3 rise 2 maxconn 200 slowstart 30s
  server console-1 10.0.10.11:3000 check
  server console-2 10.0.10.12:3000 check
```

Keep `slowstart` on so new replicas do not take a full burst before caches and DB pools are warm.

## EPS tuning table

| Knob | 100 EPS | 1,000 EPS | 10,000 EPS |
|---|---:|---:|---:|
| Fluent Bit `Mem_Buf_Limit` | 32 MiB | 64 MiB | 128 MiB |
| Fluent Bit `storage.max_chunks_up` | 128 | 256 | 512 |
| Daily shards (`cs3-logs-*`) | 1 | 4 | 12 |
| Console replicas | 1-2 | 2-4 | 6-10 |
| HAProxy `maxconn` per console | 100 | 200 | 500 |
| NGINX `client_max_body_size` | 2 MiB | 4 MiB | 8 MiB |
| OpenSearch replicas | 1 | 1 | 1-2 |

## Acceptance checks after a tuning change

```bash
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:3000/api/fleet/summary
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" https://indexer-mgr-1.example.internal:9200/_cluster/health?pretty
```

Watch p95 ingest latency, queue depth, and dropped-buffer counters for at least one business cycle before declaring the new settings steady.
