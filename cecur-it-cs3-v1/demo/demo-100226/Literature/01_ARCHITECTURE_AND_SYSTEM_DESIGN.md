# 01. Architecture & System Design
## CS3 (CECUR-IT Cyber Security Operations Console) Full-Stack System Design

---

## 1. Executive Summary

The **CS3 Platform** is engineered as a unified Security Operations Center (SOC), Extended Detection & Response (XDR), and Security Orchestration, Automation, and Response (SOAR) architecture. The platform unifies high-velocity event telemetry, user behavior analytics (UBA / ActivTrak), offensive threat reconnaissance (HexStrike AI), interactive 3D asset topology fusion graphs, and dual-agent LLM reasoning into a single cohesive pane of glass.

---

## 2. High-Level System Topology

```
+----------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                         |
|                                                                                        |
|   React 18 + TypeScript + Tailwind CSS + Lucide Icons + Three.js / Canvas 2D / SSE     |
|   - Real-time Console Panels: Overview, Incidents, Cecur SIEM, ActivTrak, Sensor Grid  |
|   - Advanced Modules: 3D Asset Fusion, HexStrike AI Recon, Operational Audit, CISO KPI |
|   - Authentication Context, Role Switching, Dynamic Modals, Real-Time Toasts           |
+-------------------------------------------+--------------------------------------------+
                                            |
                                            | HTTPS REST & SSE (/api/*)
                                            v
+----------------------------------------------------------------------------------------+
|                                   APPLICATION TIER                                     |
|                                                                                        |
|   Express.js / Node.js Backend Server (Port 3000)                                      |
|   +----------------------------------------------------------------------------------+ |
|   | Security & Middleware Layer:                                                     | |
|   | - Token-based Session Verification (Bearer / Cookie)                             | |
|   | - Server-Side Role-Based Access Control (RBAC/RBAM) & Clearance Gating           | |
|   | - Audit Logging Interceptor (Immutable Actor Actions)                            | |
|   +----------------------------------------------------------------------------------+ |
|   | Core Functional Engines:                                                         | |
|   | - CecurEngine: Multi-format Log Decoders, MITRE ATT&CK Rules Engine              | |
|   | - Dual-Agent LLM Dispatcher: Gemini 3.7 Flash + DeepSeek Chat + Local Heuristics | |
|   | - Sensor Grid Daemon: Jitter Damping, Packet Drop Recalibration, Node Lifecycle  | |
|   | - Asset Fusion Engine: Graph Topology, Lateral Propagation, Blast Radius Sim     | |
|   | - HexStrike Connector: Scoped Safe Reconnaissance Execution Engine               | |
|   | - ActivTrak Bridge: Insider Risk Scoring & Productivity Deviation Analysis       | |
|   | - SSE Live Stream Broadcaster: Real-time Telemetry Loop (3500ms Interval)       | |
|   +----------------------------------------------------------------------------------+ |
+-------------------------------------------+--------------------------------------------+
                                            |
                     +----------------------+----------------------+
                     |                                             |
                     v                                             v
+-----------------------------------------+   +------------------------------------------+
|       IN-MEMORY ACTIVE DATA STORE       |   |       CLOUD FIRESTORE PERSISTENCE        |
| - High-throughput Incident Cache        |   | - User Profiles & Credentials            |
| - Sensor Grid Metrics & Live Status     |   | - Immutable Transaction Billing Records  |
| - Target Recon Allowlist & Job Queue    |   | - Retainer Subscription Verification     |
| - In-Memory Actor Audit Trails          |   | - Security Rules Gated by UID & Roles    |
+-----------------------------------------+   +------------------------------------------+
```

---

## 3. Core Functional Components

### 3.1. Cecur SIEM / XDR Core Engine (`server/engine/cecurEngine.ts`)
The `CecurEngine` serves as the central log parsing and signature detection engine. It maintains:
* **Plug-in Decoders**: Six specialized decoders that parse heterogeneous raw syslog streams into standardized JSON envelopes.
* **Rules Catalog**: Rules mapped to numeric severity levels (1 to 15), MITRE ATT&CK tactics/techniques, and multi-regulatory compliance frameworks (PCI DSS, NIST 800-53, HIPAA, GDPR).
* **Live Ingestion**: Ingests raw log lines via `/api/cecur/logs/ingest`, executes regex extractions, triggers detection rules, updates severity scoring, and spawns actionable alerts.
* **Active Response (SOAR)**: Evaluates automated containment actions such as IP host isolation, firewall drop-rule insertion, process termination, and account locking.

### 3.2. Real-Time Telemetry & SSE Engine (`server.ts`)
* **Server-Sent Events (SSE)**: The `/api/live/stream` endpoint maintains persistent HTTP connections with active frontend clients.
* **Simulation & Ticking Loop**: Every 3.5 seconds, `db.simulateTick()` dynamically adjusts sensor bandwidth, injects transient anomaly spikes, advances ongoing HexStrike scan jobs, and pushes structured updates across all active SSE listeners.
* **Fallback Polling**: Dashboards gracefully fall back to `/api/live/telemetry` if SSE connections encounter network partition.

### 3.3. Dual-Agent LLM Pipeline (`server/ai/cecurAI.ts`)
* **Primary Agent (CS3 Agent)**: Powered by Google Gemini 3.7 Flash (`gemini-3.7-flash`). Operates with strict JSON-schema enforcement, low sampling temperature (`0.2`), and pre-warmed context caches for sub-second analysis.
* **Secondary Agent (CECUR-IT Agent)**: Powered by DeepSeek Chat (`deepseek-chat`). Automatically engaged if the primary agent key is unconfigured or rate-limited.
* **Deterministic Heuristic Engine**: Embedded local security reasoning engine that guarantees zero-downtime, fully valid structured JSON responses even in air-gapped or offline operating modes.

### 3.4. Asset Fusion 3D Topology & Blast Radius Simulator (`server/fusion.ts`)
* **Node & Edge Topology**: Correlates network endpoints, domain controllers, cloud storage buckets, databases, firewall gateways, and IoT/OT sensors into a multi-layer directed graph.
* **Blast Radius Simulation**: Evaluates lateral movement paths based on credential cascade, unpatched CVE exploitation, cross-VPC peering, and active mitigations (e.g., zero-trust network segmentation, MFA enforcement).
* **Threat Intelligence Export**: Generates standardized TLP-classified JSON reports containing topological risk scores, critical path analysis, and recommended countermeasures.

### 3.5. HexStrike AI Offensive Reconnaissance Connector (`server/connectors/hexstrikeClient.ts`)
* **Target Allowlist Gate**: All reconnaissance actions are strictly bounded to approved target identifiers (`db.targetAllowlist`). Any probe against unapproved IP/hostname is rejected at the API layer.
* **Safe Tool Profiles**: Restricted to defensive reconnaissance: `nmap_scan`, `nuclei_scan`, `gobuster_scan`, and `subfinder_scan`.
* **Hybrid Execution**: Connects to live HexStrike REST server if `HEXSTRIKE_BASE_URL` is configured; otherwise operates in deterministic high-fidelity SOC simulation mode.

### 3.6. ActivTrak Insider Threat & Behavioral Analytics (`server/routes/activtrak.ts`)
* Evaluates insider risk indicators, anomalous off-hours authentication, privileged data staging, and productivity metric deviations.
* Provides risk-tiered user scoring (Low, Medium, High, Critical) with automated policy enforcement and compliance tracking.

---

## 4. Architectural Design Principles

| Principle | Implementation in CS3 |
| :--- | :--- |
| **Strict Defense-in-Depth** | Multi-layer validation: client-side view filters, server middleware RBAC clearance checks, input parameter sanitization, and database-level security rules. |
| **Zero Mock Infrastructure** | Real API endpoints, live event loops, structured JSON outputs, valid status codes, and deterministic fallback logic for all operational actions. |
| **Low Latency & High Throughput** | In-memory hot caching for sensor and incident telemetry; batch-buffering log writes before committing to durable Firestore storage. |
| **Air-Gap Readiness** | Graceful degradation of LLM and threat intelligence modules to local heuristic engines when external internet egress is blocked. |
| **Immutable Auditability** | Every user action (calibration, reboot, rule modification, scan trigger, incident status change) is logged with actor metadata, IP address, timestamp, and result status. |
