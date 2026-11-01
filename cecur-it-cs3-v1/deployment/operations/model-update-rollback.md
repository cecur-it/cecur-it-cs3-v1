# Model update and rollback SOP

The source of truth for approved local model tags is `onboarding/models.json`. Air-gapped bundles are built by `scripts/build-airgap-bundle.mjs`, verified by `scripts/verify-bundle.mjs`, and optionally published by `.github/workflows/model-bundle.yml`.

## Pre-checks

- confirm the target tag matches `onboarding/models.json.releaseTag`
- confirm the model ids you plan to ship are present in `onboarding/models.json.models[*].id`
- confirm every Ollama node has enough free disk and VRAM for the incoming model set
- keep the previous bundle tarball or volume backup until rollback is no longer needed

## Build the air-gapped bundle on a connected staging host

`scripts/build-airgap-bundle.mjs` must never run on the target enclave. Use the real flags the repo supports:

```bash
node scripts/build-airgap-bundle.mjs       --out cs3-model-bundle-v1.4.0.tar       --release-tag v1.4.0       --models gemma4:26b,nemotron-3-nano:30b       --include-ollama-binary       --include-console-image

node scripts/verify-bundle.mjs --bundle cs3-model-bundle-v1.4.0.tar --verbose
```

The release workflow uses the same script shape:

```bash
node scripts/build-airgap-bundle.mjs --out cs3-model-bundle-${TAG}.tar --release-tag ${TAG} --include-ollama-binary
node scripts/verify-bundle.mjs --bundle cs3-model-bundle-${TAG}.tar --verbose
```

## Verify on the target side before extraction

```bash
node scripts/verify-bundle.mjs       --bundle /srv/cs3/bundles/cs3-model-bundle-v1.4.0.tar       --sha256 /srv/cs3/bundles/cs3-model-bundle-v1.4.0.tar.sha256       --verbose

node scripts/verify-bundle.mjs --status --verbose
```

Do not use `--allow-tag-mismatch` in production. The launcher already fails closed if the hash or release tag does not match.

## Canary rollout (connected on-prem)

1. Drain one Ollama node from `nginx.conf` or `haproxy.cfg`.
2. Pull the new model only on the drained node.
3. Run canary prompts directly against that node.
4. Return the node to service.
5. Repeat for the rest of the pool.
6. Only after all nodes are warm, update the console's `OLLAMA_PRIMARY_MODEL` / `OLLAMA_FALLBACK_MODEL` and restart console replicas.

Example canary on a compose node:

```bash
docker compose stop ollama-lb
OLLAMA_HOST=ollama-1:11434 ollama pull nemotron-3-nano:30b
OLLAMA_HOST=ollama-1:11434 ollama pull gemma4:26b
curl -fsS http://ollama-1:11434/api/generate -d '{"model":"nemotron-3-nano:30b","prompt":"reply only with ok","stream":false}'
docker compose up -d ollama-lb
```

## Canary rollout (air gap)

1. Verify the bundle.
2. Extract it on a staging path inside the enclave.
3. Drain one node.
4. Copy the bundle's `models/` content into that node's model store.
5. Start the node and run acceptance checks.

```bash
sudo install -d -m 0750 /srv/cs3/model-bundles/v1.4.0
tar -xf /srv/cs3/bundles/cs3-model-bundle-v1.4.0.tar -C /srv/cs3/model-bundles/v1.4.0

docker compose stop ollama-1
docker run --rm -v cs3_ollama-1:/dst busybox sh -c 'rm -rf /dst/*'
docker run --rm       -v cs3_ollama-1:/dst       -v /srv/cs3/model-bundles/v1.4.0/models:/src:ro       busybox sh -c 'cp -a /src/. /dst/'
docker compose up -d ollama-1
```

For non-container installs, the repo's `install.sh` / `install.ps1` copy verified bundle contents into `/var/lib/cs3-ollama/.ollama/models`.

## Ansible entrypoints

Use the deployment playbooks when you want the rollout codified:

```bash
cd deployment/ansible
ansible-playbook playbooks/model-update.yml -e model_bundle=/srv/cs3/bundles/cs3-model-bundle-v1.4.0.tar
ansible-playbook playbooks/model-rollback.yml -e model_bundle=/srv/cs3/bundles/cs3-model-bundle-v1.3.2.tar
```

Keep both the new and previous bundle available until the rollback window closes.

## Rollback

Roll back if any of these occur during canary or full rollout:

- direct inference on the canary node fails
- p95 Ollama latency regresses beyond the approved SLO
- console workflows using the primary model fail functional checks
- `ollama list` no longer shows the approved fallback model

Rollback sequence:

1. Drain the failing node.
2. Restore the previous volume tarball or previous verified bundle.
3. Set `OLLAMA_PRIMARY_MODEL` / `OLLAMA_FALLBACK_MODEL` back to the last approved values.
4. Restart only the drained node first; validate; then return traffic.

Example volume restore:

```bash
docker compose stop ollama-1
docker run --rm -v cs3_ollama-1:/dst busybox sh -c 'rm -rf /dst/*'
docker run --rm -v cs3_ollama-1:/dst -v /srv/cs3/backups/ollama:/backup:ro       busybox sh -c 'cd /dst && tar -xf /backup/ollama-1-20261012T020000Z.tar'
docker compose up -d ollama-1
```

## Acceptance checks

Run these before advancing from canary to broad rollout and again at the end:

```bash
node scripts/verify-bundle.mjs --status --verbose
curl -fsS http://localhost:11434/api/tags | python3 -m json.tool
curl -fsS http://localhost:3000/api/health | python3 -m json.tool
curl -fsS http://localhost:11434/api/generate -d '{"model":"nemotron-3-nano:30b","prompt":"reply only with ok","stream":false}'
```

Record the release tag, bundle SHA-256, nodes updated, nodes rolled back (if any), and the time the previous bundle can finally be purged.
