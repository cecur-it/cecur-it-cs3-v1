# Compliance mapping and data residency

This document is a control-mapping aid for architects, ISSOs, and assessors. It does **not** certify CS3, does **not** replace a customer SSP/SAR/ATO package, and does **not** claim that deploying this repository alone satisfies any framework in full.

## 1. Data residency by profile

| Profile | Where telemetry lives | Where model inference happens | Where audit data lives | Cross-border transfer posture | Evidence |
|---|---|---|---|---|---|
| `cloud` | Cloud-hosted CS3 app + selected data services | Hosted providers and/or cloud-resident services | Postgres/OpenSearch in the tenant VPC/VNet | Possible if the tenant or hosted provider is outside the required geography; customer must constrain region selection and egress | `onboarding/env.cloud.template`, `README.md`, `deployment/operations/networking-architecture.md` |
| `onprem` | Customer-controlled network / cluster / hosts | Local Ollama (`OLLAMA_BASE_URL=http://127.0.0.1:11434/v1`) | Customer Postgres/OpenSearch | Cross-border transfer is avoidable when the customer keeps IdP, registry, and backup destinations in-region | `onboarding/env.onprem.template`, `deployment/docker/docker-compose.yml` |
| `airgap` | Customer enclave only | Local Ollama only | Customer Postgres/OpenSearch in the enclave | No routine external transfer; only approved one-way import/export workflows | `onboarding/env.airgap.template`, `deployment/operations/networking-architecture.md` |

### Residency conclusions

- `onprem` and `airgap` profiles intentionally leave `GEMINI_API_KEY` and `DEEPSEEK_API_KEY` blank; external hosted-model use is forbidden on those profiles.
- `airgap` additionally disables telemetry/update checks and requires verified bundle metadata before launch.
- Any cross-border or out-of-region movement is therefore a **deployment decision**, not an unavoidable property of the software.

## 2. Control evidence highlights

| Control objective | CS3 implementation | Evidence location |
|---|---|---|
| Audit-log tamper protection | Postgres append-only audit ledger with forced RLS, mutation-deny triggers, and chain verification | `deployment/docker/postgres/init/003_audit_protection.sql` |
| Profile isolation | Launcher / env templates prevent mixing cloud-only secrets into `onprem` or `airgap` | `SECURITY.md`, `onboarding/env.onprem.template`, `onboarding/env.airgap.template` |
| Health monitoring | `/api/health` health endpoint and `/api/events` SSE stream | `demo/demo-100226/server.ts` |
| Fleet authentication | Single-use enrollment tokens and per-agent ingest keys | `demo/demo-100226/server/routes/fleet.ts`, `demo/demo-100226/server/fleet/enrollment.ts` |
| Network segmentation | DMZ, internal app, data, and management tiers | `deployment/operations/networking-architecture.md`, `deployment/operations/firewall/*` |
| mTLS and pinning | Edge-enforced client certs and pinning guidance | `deployment/operations/mtls-certificate-pinning.md` |
| Private-repo and release integrity | Checksums, SBOM, pinned versions, security review | `SECURITY.md`, `README.md` |

## 3. GDPR mapping

| GDPR article / theme | CS3 control or feature | Applicable profile(s) | Evidence location |
|---|---|---|---|
| Art. 5(1)(c) data minimization | Keep inference local in `onprem`/`airgap`; avoid hosted-model disclosure when residency requires it | onprem, airgap | `onboarding/env.onprem.template`, `onboarding/env.airgap.template` |
| Art. 5(1)(f) integrity/confidentiality | TLS, recommended mTLS, RBAC, segmented network design | cloud, onprem, airgap | `deployment/operations/networking-architecture.md`, `deployment/operations/mtls-certificate-pinning.md` |
| Art. 24 controller accountability | Customer-controlled region/profile choice and evidence paths | cloud, onprem, airgap | this document, `README.md` |
| Art. 25 privacy by design / default | Profile gating prevents cloud-only secrets on isolated profiles | onprem, airgap | `SECURITY.md`, env templates |
| Art. 32 security of processing | Audit tamper protection, key separation, CRL-driven cert revocation | cloud, onprem, airgap | `003_audit_protection.sql`, `certificate-rotation.md` |
| Chapter V international transfers | Cloud profile may require contractual and regional controls; `airgap` avoids routine transfers entirely | cloud vs. onprem/airgap | `onboarding/env.cloud.template`, `networking-architecture.md` |

## 4. HIPAA Security Rule mapping

| HIPAA citation / theme | CS3 control or feature | Applicable profile(s) | Evidence location |
|---|---|---|---|
| 164.308(a)(1)(ii)(D) information system activity review | Central log ingestion plus live events/SIEM workflows | cloud, onprem, airgap | `demo/demo-100226/server/routes/cecur.ts`, `server.ts` |
| 164.308(a)(5) security awareness / procedures | Operational runbooks for cert rotation, fleet rollout, and incident testing | cloud, onprem, airgap | `certificate-rotation.md`, `agent-fleet-management.md`, `testing/chaos-playbook.md` |
| 164.312(a)(1) access control | JWT-authenticated admin APIs, RBAC, management segmentation | cloud, onprem, airgap | `server/routes/fleet.ts`, `networking-architecture.md` |
| 164.312(b) audit controls | Append-only audit ledger with chain verification | cloud, onprem, airgap | `003_audit_protection.sql` |
| 164.312(c)(1) integrity | TLS/mTLS, cert revocation, API-key enforcement for ingest | cloud, onprem, airgap | `mtls-certificate-pinning.md`, `enrollment.ts` |
| 164.312(e)(1) transmission security | HTTPS for ingest and UI; recommended mTLS for forwarders | cloud, onprem, airgap | `networking-architecture.md`, `mtls-certificate-pinning.md` |

## 5. FedRAMP Moderate / High mapping

| FedRAMP focus area | CS3 control or feature | Applicable profile(s) | Evidence location |
|---|---|---|---|
| Boundary protection / segmentation | DMZ + internal + data + management zoning | cloud, onprem, airgap | `networking-architecture.md`, firewall docs |
| Audit protection | AU-9 style append-only ledger and verification function | cloud, onprem, airgap | `003_audit_protection.sql` |
| Least privilege / role separation | Separate DB roles and restricted API actions | cloud, onprem, airgap | `docker-compose.yml`, `server/routes/fleet.ts` |
| Configuration management | GitOps guidance, chart/overlay separation, image digest pinning | cloud, onprem, airgap | `cloud-native-guide.md` |
| Supply-chain integrity | SBOM and checksum expectations for releases and air-gap bundles | cloud, onprem, airgap | `SECURITY.md`, `README.md` |
| High-baseline isolation needs | `airgap` profile eliminates routine external egress and hosted-model dependence | airgap | `onboarding/env.airgap.template`, `networking-architecture.md` |

## 6. CJIS Security Policy mapping

| CJIS theme | CS3 control or feature | Applicable profile(s) | Evidence location |
|---|---|---|---|
| 5.5 access control | JWT-authenticated admin routes and management-plane isolation | cloud, onprem, airgap | `server/routes/fleet.ts`, firewall docs |
| 5.6 identification and authentication | Enrollment token + per-agent ingest key + recommended mTLS | cloud, onprem, airgap | `enrollment.ts`, `mtls-certificate-pinning.md` |
| 5.8 media protection / offline transfer | Verified one-way transfer path for `airgap` bundles and exports | airgap | `networking-architecture.md` |
| 5.9 physical / environmental dependent controls | Customer-controlled hosting boundary for on-prem/air-gap | onprem, airgap | customer facility evidence + this repository’s profile model |
| 5.10 system communications protection | Segmented network and TLS guidance | cloud, onprem, airgap | firewall docs, mTLS guidance |
| 5.11 formal audits | Append-only audit chain and export capability | cloud, onprem, airgap | `003_audit_protection.sql`, backup/export operational docs |

## 7. NIST SP 800-53 Rev. 5 mapping

| Control family / example control | CS3 control or feature | Applicable profile(s) | Evidence location |
|---|---|---|---|
| AC-3 / AC-6 least privilege | App roles, restricted DB roles, segmented management access | cloud, onprem, airgap | `docker-compose.yml`, firewall docs |
| AU-2 / AU-6 audit events and review | Central log ingestion and operational testing guidance | cloud, onprem, airgap | `server/routes/cecur.ts`, `testing/load-test-scenarios.md` |
| **AU-9 protection of audit information** | Forced RLS + no UPDATE/DELETE policies + deny-mutation triggers + chain verification | cloud, onprem, airgap | `deployment/docker/postgres/init/003_audit_protection.sql` |
| AU-10 non-repudiation | Hash-chained audit rows with verification function | cloud, onprem, airgap | `003_audit_protection.sql` |
| CM-2 / CM-6 baseline configuration | Helm/Kustomize/ArgoCD deployment baselines and digest pinning | cloud, onprem, airgap | `cloud-native-guide.md` |
| IA-2 / IA-5 identification and authenticator management | Enrollment tokens, ingest keys, client cert lifecycle | cloud, onprem, airgap | `agent-fleet-management.md`, `certificate-rotation.md` |
| SC-7 boundary protection | DMZ and one-way transfer pattern | cloud, onprem, airgap | `networking-architecture.md`, firewall docs |
| SC-8 / SC-12 transmission confidentiality / cryptographic key establishment | TLS, mTLS, PKI hierarchy, certificate pinning | cloud, onprem, airgap | `mtls-certificate-pinning.md` |
| SI-4 monitoring | SSE/live telemetry plus fleet health checks | cloud, onprem, airgap | `server.ts`, `agent-fleet-management.md` |

## 8. NIST SP 800-171 Rev. 3 mapping

| Requirement family / example | CS3 control or feature | Applicable profile(s) | Evidence location |
|---|---|---|---|
| 03.01 access control | Segmented management access and authenticated admin APIs | cloud, onprem, airgap | firewall docs, `server/routes/fleet.ts` |
| 03.03 audit and accountability | Append-only audit ledger and chain validation | cloud, onprem, airgap | `003_audit_protection.sql` |
| 03.04 configuration management | GitOps, chart values per profile, image digest pinning | cloud, onprem, airgap | `cloud-native-guide.md` |
| 03.05 identification and authentication | Enrollment token bootstrap, per-agent keys, client certs | cloud, onprem, airgap | `enrollment.ts`, `mtls-certificate-pinning.md` |
| 03.08 media protection | Offline verified bundle handling for `airgap` | airgap | `README.md`, `networking-architecture.md` |
| 03.13 system and communications protection | TLS/mTLS, DMZ segmentation, no direct data-tier exposure | cloud, onprem, airgap | firewall docs, mTLS guidance |
| 03.14 system and information integrity | Certificate rotation, CRL updates, chaos/failover testing | cloud, onprem, airgap | `certificate-rotation.md`, `testing/chaos-playbook.md` |

## 9. Assessor notes

- This mapping intentionally cites repository paths so a control reviewer can trace the implementation or operational guidance.
- Customer-specific items still require local evidence: IAM configuration, IdP MFA settings, cloud-region choices, HSM use, admin workstation controls, and physical protections.
- When an assessor asks “is this certified,” the correct answer is: **this repository provides engineering controls and evidence paths; certification or authorization remains the customer’s formal process.**
