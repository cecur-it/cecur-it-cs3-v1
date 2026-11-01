# CECUR-IT CS3 Platform

**CS3 with errow**: A defense-grade ESOC platform integrating local/air-gapped inference and the `errow` offensive security engine.

The **CECUR-IT CS3 Platform** (`cecur-it-cs3-v1`) is an Enterprise Security Operations Center (ESOC) designed for high-compliance environments. It features the **`errow` Offensive Security Engine** (`errow-agent` v1.7.0) for autonomous security validation, containerized sandboxing, tamper-evident cryptographic audit logs, and tri-mode deployment isolation (`cloud`, `onprem`, and `airgap`).

---

## Quick Start

### 1. Prerequisites

Ensure the host system has the following installed:

* **Docker** (v24.0+) & **Docker Compose** (v2.20+)
* **Node.js** (v20 LTS or later)
* **Git**

---

### 2. Clone and Configure

Clone the repository and run the interactive onboarding wizard to configure your deployment profile:

```bash
git clone https://github.com/cecur-it/cecur-it-cs3-v1.git
cd cecur-it-cs3-v1

# Run the onboarding wizard to generate your environment configuration (.env)
node onboarding/wizard.mjs
```

The wizard will prompt you to choose an operational profile:
* **`cloud`**: Hosted external AI APIs (OpenAI, Anthropic).
* **`onprem`**: Local inference with Ollama or local LLM instances.
* **`airgap`**: Disconnected mode using bundled offline assets and verified model tars.

---

### 3. Launch Services

Start the core services (PostgreSQL, CS3 backend console, and the `errow` engine):

```bash
docker compose -f deployment/docker/docker-compose.yml up -d
```

Check the health of running containers:

```bash
docker compose -f deployment/docker/docker-compose.yml ps
```

---

### 4. Access the Console

Once services are running, open your browser:

* **ESOC Web Console:** `http://localhost:3000` (or `http://localhost:8088` depending on profile configuration)
* **Default Ingestion Gateway:** `http://localhost:3000/api/cecur/logs/ingest`
* **Real-time Event Stream:** `http://localhost:3000/api/events`

---

### 5. Verify Cryptographic Audit Integrity

Confirm the PostgreSQL tamper-evident audit ledger (NIST AU-9) is verified:

```bash
docker compose -f deployment/docker/docker-compose.yml exec postgres psql -U cs3_app -d cs3_db -c "SELECT cs3.verify_audit_chain();"
```

A return value of `NULL` indicates the cryptographic hash chain is valid and untampered.

---

## Enrolling Endpoint Forwarders

To deploy the Fluent Bit forwarder to Linux or Windows endpoints:

1. **Generate an enrollment token:**
   ```bash
   node deployment/agents/cs3-enroll.mjs single --hostname host-01.local
   ```
2. **Run the installer on the target host:**
   ```bash
   # On Linux
   sudo bash deployment/agents/install-forwarder.sh --server https://<CS3_HOST>:3000 --token <ENROLLMENT_TOKEN>

   # On Windows (PowerShell Administrator)
   .\deployment\agents\Install-CecurForwarder.ps1 -Server "https://<CS3_HOST>:3000" -Token "<ENROLLMENT_TOKEN>"
   ```

---

## Stopping & Maintenance

```bash
# Stop all services
docker compose -f deployment/docker/docker-compose.yml down

# Stop and wipe persistent data (clean restart)
docker compose -f deployment/docker/docker-compose.yml down -v
```

---

## Security & Licensing

* **License:** Apache License 2.0. See `NOTICE` for third-party attributions.
* **Acceptable Use:** The `errow` engine knowledge packs (`errow/skills/`) are restricted to authorized security testing, defense validation, and authorized ESOC operations per Section 4 of `LICENSE.md`.
