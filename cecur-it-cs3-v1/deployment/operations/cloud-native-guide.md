# Cloud-native deployment guide

This guide covers the Kubernetes/GitOps deployment path for the CS3 platform using the artifacts that live outside this directory:

- Helm chart: `deployment/helm/cs3`
- Helm values: `deployment/helm/cs3/values-cloud.yaml`, `values-onprem.yaml`, `values-airgap.yaml`
- Kustomize base: `deployment/kustomize/base`
- Kustomize overlays: `deployment/kustomize/overlays/{cloud,onprem,airgap}`
- Argo CD manifests: `deployment/argocd/{appproject.yaml,application-helm.yaml,application-kustomize.yaml,applicationset-sites.yaml}`

## 1. Cluster prerequisites

- Kubernetes 1.29+
- Ingress controller (NGINX, HAProxy, or cloud-managed ingress)
- Storage classes for Postgres and OpenSearch
- Internal or external PKI for ingress TLS and client mTLS where required
- Secrets management: **External Secrets**, **SOPS**, or **Sealed Secrets**
- Image policy that pins digests instead of mutable tags

## 2. Helm deployment

### Cloud profile

```bash
kubectl create namespace cs3 --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install cs3 deployment/helm/cs3 \
  --namespace cs3 \
  --create-namespace \
  -f deployment/helm/cs3/values-cloud.yaml
kubectl -n cs3 rollout status deploy/cs3-console --timeout=10m
```

### Connected on-prem profile

```bash
kubectl create namespace cs3 --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install cs3 deployment/helm/cs3 \
  --namespace cs3 \
  --create-namespace \
  -f deployment/helm/cs3/values-onprem.yaml
kubectl -n cs3 rollout status deploy/cs3-console --timeout=10m
```

### Air-gap profile

Before installation, mirror images to the internal registry and update the values file to use internal image references pinned by digest.

```bash
kubectl create namespace cs3 --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install cs3 deployment/helm/cs3 \
  --namespace cs3 \
  --create-namespace \
  -f deployment/helm/cs3/values-airgap.yaml
kubectl -n cs3 rollout status deploy/cs3-console --timeout=10m
```

## 3. Kustomize deployment

Use Kustomize when you want environment-specific overlays while keeping the base common.

### Render only

```bash
kustomize build deployment/kustomize/overlays/onprem
```

### Apply directly

```bash
kustomize build deployment/kustomize/overlays/cloud | kubectl apply -f -
kustomize build deployment/kustomize/overlays/onprem | kubectl apply -f -
kustomize build deployment/kustomize/overlays/airgap | kubectl apply -f -
```

### Validation

```bash
kubectl -n cs3 get deploy,sts,svc,ingress
kubectl -n cs3 get pods -o wide
kubectl -n cs3 logs deploy/cs3-console --tail=200
curl -fsS https://cs3.example.mil/api/health
```

## 4. Argo CD patterns

### App-of-apps

Use `deployment/argocd/application-helm.yaml` or `application-kustomize.yaml` as child apps, then group them under a parent “platform” app. Recommended sync waves:

| Sync wave | Content |
|---|---|
| `-1` | CRDs, namespaces, repo credentials |
| `0` | Secrets, CA bundles, ExternalSecret / SealedSecret / SOPS sources |
| `1` | Postgres, OpenSearch, internal registry dependencies |
| `2` | CS3 console, ingress, Ollama pool |
| `3` | Policy objects, monitors, synthetic checks |

### ApplicationSet per site

Use `deployment/argocd/applicationset-sites.yaml` to stamp one app per site or enclave. A typical generator maps:

- site code
- profile (`cloud`, `onprem`, `airgap`)
- ingress hostname
- values/overlay path
- destination cluster/namespace

### AppProject restrictions

Define the project in `deployment/argocd/appproject.yaml` so apps can deploy only to approved clusters/namespaces and pull manifests only from approved repos.

Recommended restrictions:

- source repos: Git mirrors you control
- destinations: only the intended cluster and namespace
- cluster-scoped resources: allow only what CS3 requires
- orphaned-resources monitoring: enabled

## 5. Secret handling

Never commit live secrets into Helm values or Kustomize overlays.

### Preferred patterns

- **External Secrets** for cloud secret managers or Vault
- **SOPS** for Git-encrypted YAML committed alongside manifests
- **Sealed Secrets** where a controller-managed decryption path is already standard

### Required secret categories

- `JWT_SECRET`
- database credentials (`CS3_APP_PASSWORD`, `CS3_MIGRATOR_PASSWORD`, `CS3_ARCHIVER_PASSWORD`)
- `SOC_INGESTION_SECRET` when shared ingest auth is enabled
- ingress TLS secret / client CA bundle / CRL bundle
- hosted-model API keys for the `cloud` profile only

## 6. Image pinning and artifact provenance

Pin images by digest, not `:latest`.

```yaml
image:
  repository: ghcr.io/dascient/cs3-soc-console
  digest: sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

Also pin:

- chart version
- OCI artifact digest for internal mirrors
- Git revision used by Argo CD
- model bundle checksum for `airgap`

## 7. Air-gap specifics

For the `airgap` profile:

1. Mirror images into an internal registry.
2. Mirror the Git repo or export a signed manifest bundle.
3. Mirror Helm dependencies or vendor them into the internal repo.
4. Point Argo CD to the **internal** Git/OCI source only.
5. Disable any outbound repo server access.
6. Import model bundles and chart updates through the approved one-way process documented in `networking-architecture.md`.

## 8. Progressive delivery

CS3 does not require a separate progressive-delivery controller, but the platform supports it cleanly.

Recommended approach:

- start with a canary site or enclave using ApplicationSet labels
- then canary a subset of pods via an ingress weight or service mesh
- hold promotion until ingest success, SSE responsiveness, and database health remain inside the SLO window

Guardrails:

- never canary schema-breaking changes without a rollback-tested migration plan
- keep Postgres and OpenSearch upgrades separate from console upgrades
- in `airgap`, stage the exact same image digests in lower environments before production import

## 9. Upgrade and rollback with Argo CD

### Sync to the next approved revision

```bash
argocd app get cs3
argocd app sync cs3
argocd app wait cs3 --health --timeout 600
```

### Review history and roll back

```bash
argocd app history cs3
argocd app rollback cs3 3
argocd app wait cs3 --health --timeout 600
```

### Helm-native rollback

```bash
helm -n cs3 history cs3
helm -n cs3 rollback cs3 3
```

### Kustomize / Git rollback

- Revert the manifest commit or retarget the Argo CD app to the last approved Git SHA.
- Re-sync the application.
- Verify `/api/health`, `/api/events`, enrollment claim, ingest, and database connectivity.

## 10. Post-deployment smoke test

```bash
curl -fsS https://cs3.example.mil/api/health
curl -N https://cs3.example.mil/api/events | head
curl -fsS -X POST https://ingest.cs3.example.mil/api/cecur/logs/ingest \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: YOUR_INGEST_KEY' \
  -d '{"message":"cloud-native smoke test","source":"syslog","severity":"info"}'
```

The deployment is ready for production cutover only after health, ingest, SSE, and the data-tier checks all succeed under the selected profile.
