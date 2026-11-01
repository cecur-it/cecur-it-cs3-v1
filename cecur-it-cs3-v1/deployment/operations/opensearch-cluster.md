# OpenSearch / Wazuh Indexer cluster SOP

Use this guide when the optional single-node `indexer` profile in `deployment/docker/docker-compose.yml` is no longer enough and CS3 needs a real Wazuh Indexer / OpenSearch cluster.

## Reference topology

| Tier | Count | `node.roles` | Storage | Notes |
|---|---:|---|---|---|
| Dedicated cluster managers ("masters") | 3 | `cluster_manager` | 50-100 GiB SSD | no data role; quorum only |
| Hot data nodes | 3+ | `data, ingest` | NVMe | current day + hot queries |
| Warm data nodes | 2+ | `data` | large SSD/HDD | 30-365 day retention |

OpenSearch 2.x uses the `cluster_manager` role name even if operators still say "master". Do not mix manager and warm-storage duties on the same host once you exceed a small lab cluster.

## `opensearch.yml` snippets

Dedicated cluster manager:

```yaml
cluster.name: cecur-prod-cluster
node.name: indexer-mgr-1
node.roles:
  - cluster_manager
network.host: 0.0.0.0
discovery.seed_hosts:
  - indexer-mgr-1
  - indexer-mgr-2
  - indexer-mgr-3
cluster.initial_cluster_manager_nodes:
  - indexer-mgr-1
  - indexer-mgr-2
  - indexer-mgr-3
bootstrap.memory_lock: true
plugins.security.ssl.transport.pemcert_filepath: certs/node.pem
plugins.security.ssl.transport.pemkey_filepath: certs/node-key.pem
plugins.security.ssl.transport.pemtrustedcas_filepath: certs/root-ca.pem
plugins.security.ssl.http.enabled: true
plugins.security.ssl.http.pemcert_filepath: certs/node.pem
plugins.security.ssl.http.pemkey_filepath: certs/node-key.pem
plugins.security.ssl.http.pemtrustedcas_filepath: certs/root-ca.pem
plugins.security.nodes_dn:
  - 'CN=indexer-*.example.internal,OU=SOC,O=CECUR-IT,L=San Antonio,ST=TX,C=US'
path.repo:
  - /var/backups/opensearch
```

Hot node:

```yaml
cluster.name: cecur-prod-cluster
node.name: indexer-hot-1
node.roles:
  - data
  - ingest
node.attr.tier: hot
network.host: 0.0.0.0
discovery.seed_hosts:
  - indexer-mgr-1
  - indexer-mgr-2
  - indexer-mgr-3
bootstrap.memory_lock: true
plugins.security.ssl.transport.pemcert_filepath: certs/node.pem
plugins.security.ssl.transport.pemkey_filepath: certs/node-key.pem
plugins.security.ssl.transport.pemtrustedcas_filepath: certs/root-ca.pem
```

Warm node:

```yaml
cluster.name: cecur-prod-cluster
node.name: indexer-warm-1
node.roles:
  - data
node.attr.tier: warm
network.host: 0.0.0.0
discovery.seed_hosts:
  - indexer-mgr-1
  - indexer-mgr-2
  - indexer-mgr-3
bootstrap.memory_lock: true
plugins.security.ssl.transport.pemcert_filepath: certs/node.pem
plugins.security.ssl.transport.pemkey_filepath: certs/node-key.pem
plugins.security.ssl.transport.pemtrustedcas_filepath: certs/root-ca.pem
```

## JVM heap rules

| Node RAM | Heap (`-Xms/-Xmx`) | Rule |
|---:|---:|---|
| 8 GiB | 4 GiB | never exceed 50% of RAM |
| 16 GiB | 8 GiB | good for managers and light warm nodes |
| 32 GiB | 16 GiB | common hot-node baseline |
| 64 GiB | 31 GiB | stop below compressed-oops boundary |

Set identical min/max heap and leave the rest of RAM to the page cache. The compose default (`-Xms2g -Xmx2g`) is for a lab only.

## Shard sizing for 1,000+ endpoints

Use daily indices with a target primary shard size of **20-40 GiB** and avoid tiny shards.

Starting point:

| Workload | Daily primary data | Primaries / day | Replicas |
|---|---:|---:|---:|
| ~100 EPS | 50-100 GiB raw | 1 | 1 |
| ~1,000 EPS | 0.5-1.0 TiB raw | 4 | 1 |
| ~10,000 EPS | 5-10 TiB raw | 12 | 1-2 |

Apply a template before the first production index is created:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT https://indexer-mgr-1.example.internal:9200/_index_template/cs3-wazuh-daily       -d '{
    "index_patterns":["wazuh-alerts-*","cs3-logs-*"],
    "template":{
      "settings":{
        "number_of_shards":4,
        "number_of_replicas":1,
        "routing.allocation.require.tier":"hot",
        "refresh_interval":"30s"
      }
    },
    "priority":100
  }'
```

## Security plugin roles

Create narrow roles instead of using the built-in admin user for daily operations:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT https://indexer-mgr-1.example.internal:9200/_plugins/_security/api/roles/cs3_ops       -d '{
    "cluster_permissions":["cluster_monitor","cluster_composite_ops_ro","manage_snapshots"],
    "index_permissions":[
      {"index_patterns":["wazuh-alerts-*","cs3-*"],"allowed_actions":["read","search","indices:admin/get","indices:data/write/bulk*"]}
    ]
  }'
```

Keep node-to-node TLS mandatory. Rotating to plaintext inside the enclave defeats the entire cluster trust model.

## Health checks

Run these after every change window:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" https://indexer-mgr-1.example.internal:9200/_cluster/health?pretty
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" https://indexer-mgr-1.example.internal:9200/_cat/nodes?v
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" https://indexer-mgr-1.example.internal:9200/_cat/shards?v
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" https://indexer-mgr-1.example.internal:9200/_cluster/allocation/explain?pretty
```

Expected steady state:

- health is `green`
- manager quorum present (`3/3`)
- unassigned shards `0`
- disk watermarks below low watermark on all hot nodes

## Rolling upgrade

1. Confirm the target version is supported for a rolling upgrade from the current version.
2. Snapshot the cluster first.
3. Freeze shard movement while the node is away:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT https://indexer-mgr-1.example.internal:9200/_cluster/settings       -d '{"transient":{"cluster.routing.allocation.enable":"primaries"}}'
```

4. Restart one node at a time: warm nodes, then hot nodes, then managers last.
5. Wait for the node to rejoin and the cluster to return to `yellow` or `green` before moving on.
6. Re-enable allocation when the last node is done:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT https://indexer-mgr-1.example.internal:9200/_cluster/settings       -d '{"transient":{"cluster.routing.allocation.enable":"all"}}'
```

7. Validate with `_cluster/health`, `_cat/recovery`, and a search against the newest alert index.

## Replica policy

- hot indices: `1` replica minimum
- warm indices: keep `1` replica unless storage pressure forces a planned exception
- cold searchable indices: restore from snapshots on demand; do not depend on replicas for multi-year retention

If the cluster cannot sustain `1` replica on hot data, add nodes before ingest grows further.
