# CECUR-IT SOC Platform — Backend Consumption Documentation Matrix

This directory contains the internal backend documentation for system unit economics, infrastructure overhead calculations, governance access matrices, agent forwarder footprints, and transactional persistence synchronization.

---

## Documentation Modules

### 1. [Unit Cost Infrastructure & Overhead](./UNIT_COST_INFRASTRUCTURE.md)
* **Scope**: Estimated provider unit cost per tenant, cloud resource allocation, Gemini AI token consumption economics, and infrastructure optimization strategies.
* **Key Components**:
  * Cloud Security Firestore (50M reads / 10M writes)
  * Cloud Application Service (Containerized 4 vCPU / 8 GB RAM)
  * CS3 Agent & CECUR-IT Agent Token Metering
  * BigQuery Cold Log Storage Partitioning

### 2. [Comprehensive Role-Based Access Matrix (RBAC / RBAM)](./ROLE_BASED_ACCESS_MATRIX.md)
* **Scope**: Server-enforced panel clearance matrix governing security personas across Analyst (Tier 2/3), Admin (Infra/Red), Auditor (GRC), and Executive (CISO).
* **Key Enforcement**:
  * HTTP 403 Forbidden response boundaries
  * SIEM / SOAR, ActivTrak, Sensor Grid, Asset Fusion, and Errow clearance tiers
  * Database reseed and administrative authority gates

### 3. [Cross-Platform Forwarder Installation & Footprint](./CROSS_PLATFORM_FORWARDERS.md)
* **Scope**: Operational specifications for forwarder agents across Windows 11 Enterprise, Linux, Kubernetes, and air-gapped ICS/SCADA hardware taps.
* **Key Scripts**:
  * `Deploy-CecurForwarder.ps1` (PowerShell Windows Deployment)
  * `deploy_forwarder.yml` (Ansible / Linux Systemd Integration)

### 4. [Transaction Persistence & Firestore Sync](./TRANSACTION_PERSISTENCE_SYNC.md)
* **Scope**: Specifications for enterprise payment recording, transaction data models, and Firebase Firestore `transactions` collection sync mechanisms.
* **Key Specifications**:
  * Firestore document structure
  * RBAC token authorization & environment API key verification
  * Retainer discount application logic
