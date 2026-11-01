# Endpoint agents (forwarders) and bulk enrollment

| File | Purpose |
|---|---|
| `cs3-enroll.mjs` | Bulk enrollment CLI (Node ≥ 18, core modules only). Reads CSV/JSON, calls `POST /api/fleet/enroll/bulk` in batches ≤ 1000, writes one-time tokens to a 0600 file |
| `install-forwarder.sh` | Linux installer: Fluent Bit + systemd unit + watchdog timer; claims the enrollment token |
| `Install-CecurForwarder.ps1` | Windows installer: Fluent Bit service + scheduled-task watchdog; claims the enrollment token |
| `cs3-forwarder-watchdog.sh` / `Test-CecurForwarder.ps1` | Health check + bounded auto-remediation (Linux / Windows) |
| `templates/fluent-bit-{linux,windows}.conf` | Forwarder configs (filesystem buffering, gzip, TLS verify, optional mTLS) |
| `systemd/` | `cecur-forwarder.service`, watchdog `.service` + `.timer` |

## Flow

```bash
# 1. Admin: enroll hosts (dry run first)
export CS3_TOKEN=...            # or CS3_USERNAME + CS3_PASSWORD
node cs3-enroll.mjs bulk --url https://soc.example.internal --file hosts.csv --group prod --dry-run
node cs3-enroll.mjs bulk --url https://soc.example.internal --file hosts.csv --group prod --out cs3-enrollment.json

# 2. Roll out in waves (Ansible) – or run the installers by hand / via MDM
ansible-playbook ../ansible/playbooks/deploy-forwarders.yml -e @../ansible/vars/onprem.yml \
    -e cs3_enrollment_file=$PWD/cs3-enrollment.json

# 3. Destroy the token file
shred -u cs3-enrollment.json
```

`hosts.csv` columns: `hostname` (required), `ip`, `platform` (`linux|windows|macos|container`), `osName`, `osVersion`, `arch`, `workloadType`, `group`.

## Security properties

- Enrollment tokens are single use, expire (default 24 h, max 168 h) and are stored server-side only as SHA-256.
- The agent receives a **per-agent ingest key**; with `CS3_INGEST_REQUIRE_KEY=true` the console pins every event to that agent's id, so a compromised endpoint cannot impersonate another host.
- Installers refuse plaintext HTTP, pass the token via stdin/env (never argv), verify the Fluent Bit package checksum, and restrict config/key files to root / SYSTEM+Administrators.
- TLS: `--ca-file` for the internal PKI and optional `--pin-sha256` (SPKI pin). For mTLS client certificates see `../operations/mtls-certificate-pinning.md`; rotation: `../operations/certificate-rotation.md`.
- The ingest endpoint accepts single events or JSON arrays (≤ `CS3_INGEST_MAX_BATCH`, default 1000), matching Fluent Bit's `Format json` batches.

Windows requirements: `curl.exe` (Windows 10 1803+/Server 2019+) and a locally supplied Fluent Bit Windows ZIP (air-gap friendly).
