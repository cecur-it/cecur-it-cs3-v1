# Terraform / OpenTofu

HCL targets OpenTofu >= 1.6 and Terraform >= 1.6.

| Path | What it builds |
|---|---|
| `aws/` | Root module: 3-tier VPC (dmz/app/data), per-tier security groups, immutable KMS-encrypted backup bucket |
| `modules/network` | VPC, subnets per AZ, IGW/NAT, data tier with **no** default route, VPC flow logs |
| `modules/security_groups` | Relay → console → {Ollama, PostgreSQL, indexer} least-privilege chain (see `../operations/firewall/cloud-security-groups.md`) |
| `modules/backup_bucket` | S3 Object Lock + versioning + KMS + TLS-only policy for PostgreSQL/OpenSearch backups |
| `modules/helm_release` | Installs `../helm/cs3` with `values-<profile>.yaml` (cloud, onprem, airgap) |

```bash
cd deployment/terraform/aws
cp terraform.tfvars.example terraform.tfvars     # edit; never commit
tofu init -backend-config=backend.hcl            # remote, locked, encrypted state
tofu plan -out cs3.plan && tofu apply cs3.plan
```

Notes
- `agent_cidrs` / `admin_cidrs` reject `0.0.0.0/0` by design.
- `backup_lock_mode = "COMPLIANCE"` is irreversible for the retention window; use `GOVERNANCE` while testing.
- Commit `.terraform.lock.hcl` after the first `init` in your environment (provider checksums).
- Air-gapped sites mirror providers: `tofu providers mirror ./providers` on a connected host, then set a `filesystem_mirror` in `.tofurc`.
