# Ollama multi-node scaling SOP

CS3 already ships a two-node Ollama pool behind `deployment/docker/ollama-lb/nginx.conf`, with an HAProxy alternative in `deployment/docker/ollama-lb/haproxy.cfg`. Use this SOP to scale that pool safely.

## Runtime knobs

`deployment/docker/.env.example` exposes the three primary concurrency controls:

| Variable | Default | Effect |
|---|---:|---|
| `OLLAMA_NUM_PARALLEL` | `4` | concurrent requests per node |
| `OLLAMA_MAX_LOADED_MODELS` | `2` | resident models kept in memory |
| `OLLAMA_KEEP_ALIVE` | `30m` | how long unused models stay loaded |

Starting points:

| Node class | `OLLAMA_NUM_PARALLEL` | `OLLAMA_MAX_LOADED_MODELS` | `OLLAMA_KEEP_ALIVE` |
|---|---:|---:|---|
| 1x 24 GiB GPU, one model | 2 | 1 | 15m |
| 1x 48 GiB GPU, primary + fallback | 4 | 2 | 30m |
| CPU-only emergency node | 1 | 1 | 5m |

Raise `OLLAMA_NUM_PARALLEL` only after confirming latency and VRAM headroom. Raising it first is the fastest way to turn queue time into GPU thrash.

## GPU pinning

The repo already includes `deployment/docker/docker-compose.gpu.yml` with one GPU per node:

```bash
docker compose -f deployment/docker/docker-compose.yml       -f deployment/docker/docker-compose.gpu.yml up -d
```

The override sets:

- `ollama-1 -> NVIDIA_VISIBLE_DEVICES=0`
- `ollama-2 -> NVIDIA_VISIBLE_DEVICES=1`

Keep one GPU per container unless you have measured multi-GPU gains for your exact model set.

## Front-end choices

- **NGINX**: already configured for `least_conn`, passive health checks, `proxy_buffering off`, and `proxy_read_timeout 600s`.
- **HAProxy**: already configured for active `/api/tags` checks, queue backpressure (`timeout queue 30s`), and `leastconn` balancing.

Switch to HAProxy when you need active health checks or queue observability:

```bash
docker compose --profile haproxy up -d ollama-lb-haproxy
```

## Session affinity

If prompt chains benefit from KV-cache reuse, switch NGINX from `least_conn` to a consistent hash on a sticky session header:

```nginx
upstream ollama_pool {
  hash $http_x_cs3_session consistent;
  server ollama-1:11434 max_fails=2 fail_timeout=15s;
  server ollama-2:11434 max_fails=2 fail_timeout=15s;
}
```

Then make the caller send `X-CS3-Session: <stable-id>`. Use affinity only for long-lived analyst conversations; stateless batch prompts still fit `least_conn` better.

## Add a node (Docker Compose)

1. Copy an existing `ollama-*` service stanza and create `ollama-3` with its own volume.
2. If using GPUs, pin a unique device in `docker-compose.gpu.yml`.
3. Add the node to `nginx.conf` or `haproxy.cfg`.
4. Start the new service and pre-load models.

Example warm-up:

```bash
docker compose up -d ollama-3
OLLAMA_HOST=127.0.0.1:11434 ollama pull nemotron-3-nano:30b
OLLAMA_HOST=127.0.0.1:11434 ollama pull gemma4:26b
docker compose exec -T ollama-lb nginx -s reload
curl -fsS http://localhost:11434/healthz
```

## Drain a node

With the current static configs, drain by removing the server line and reloading the LB before you stop the node.

NGINX:

```bash
# edit deployment/docker/ollama-lb/nginx.conf and remove or comment the node
docker compose up -d ollama-lb
docker compose exec -T ollama-lb nginx -s reload
docker compose stop ollama-2
```

HAProxy:

```bash
# edit deployment/docker/ollama-lb/haproxy.cfg and remove or comment the node
docker compose up -d ollama-lb-haproxy
docker compose stop ollama-2
```

Wait for active requests to drain first:

```bash
docker compose exec -T ollama-2 ollama ps
```

## Health checks

Check every hop, not just the LB:

```bash
curl -fsS http://localhost:11434/healthz
curl -fsS http://localhost:11434/api/tags | python3 -m json.tool
docker compose exec -T ollama-1 ollama list
docker compose exec -T ollama-2 ollama list
```

For canarying a new node, send a direct request before putting it behind the balancer:

```bash
curl -fsS http://ollama-3:11434/api/generate -d '{"model":"nemotron-3-nano:30b","prompt":"reply only with ok","stream":false}'
```

## Kubernetes equivalent

The Helm chart exposes the pooled endpoint as service **`<release>-ollama-lb`** and the backing StatefulSet as **`<release>-ollama`**.

Useful commands:

```bash
kubectl get svc <release>-ollama-lb -n cs3
kubectl scale statefulset/<release>-ollama -n cs3 --replicas=3
kubectl rollout status statefulset/<release>-ollama -n cs3
```

Keep the LB service stable and scale the StatefulSet behind it.

## Capacity guardrails

- keep one spare Ollama node for maintenance if analyst workflows depend on local inference
- use one primary model family per node pool where possible
- do not raise `OLLAMA_MAX_LOADED_MODELS` above what fits in VRAM with 20% headroom
- treat repeated queue growth as a scale-out trigger, not a reason to keep increasing `NUM_PARALLEL`
