# Playbooks

| Playbook | Purpose |
|---|---|
| `site.yml` | provision + (when `cs3_enrollment_file` is set) forwarder rollout |
| `provision.yml` | OS tuning, container runtime, compose stack (roles `common`, `container_runtime`, `cs3_stack`) |
| `deploy-forwarders.yml` | wave-based forwarder install/enroll on Linux and Windows endpoints |
| `rotate-certs.yml` | server cert + CA bundle rotation with rollback |
| `model-update.yml` / `model-rollback.yml` | verified model bundle rollout, one node at a time, auto-restore on failure |
| `backup.yml` | pg_basebackup, WAL snapshot, audit-chain verification, optional OpenSearch snapshot |
| `health-remediation.yml` | bounded restart/reinstall of forwarders and console |

Profiles: `-e @vars/onprem.yml`, `-e @vars/airgap.yml`, `-e @vars/cloud.yml`. Secrets come from an ansible-vault file
(`inventory/example/group_vars/all/vault.example.yml`). Install collections with `ansible-galaxy collection install -r requirements.yml`.
