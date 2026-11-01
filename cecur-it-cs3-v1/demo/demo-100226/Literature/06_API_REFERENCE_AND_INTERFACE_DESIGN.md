# 06. API Reference & Interface Design
## RESTful Endpoints, Server-Sent Events (SSE), and Schema Specification

---

## 1. API Architecture Overview

The CS3 Backend exposes a modular, RESTful API layer coupled with a persistent Server-Sent Events (SSE) stream for real-time telemetry updates. The API adheres to OpenAPI 3.0 standards and aligns with the Wazuh v4.14.7 API specification structure.

### Base URL & Protocol
* **Base URL**: `http://localhost:3000/api`
* **Transport**: HTTPS / TLS 1.3
* **Content-Type**: `application/json`
* **Authentication**: Bearer Token via `Authorization: Bearer <TOKEN>` header

---

## 2. Authentication & Identity (`/api/auth`)

| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticates credentials; returns user profile and bearer token. |
| `GET` | `/api/auth/me` | Authenticated | Returns currently authenticated user session and role capabilities. |
| `POST` | `/api/auth/switch-role` | Authenticated | Switches current session role for testing RBAC clearance. |
| `POST` | `/api/auth/logout` | Authenticated | Terminates active session. |

#### Request Example (`POST /api/auth/login`):
```json
{
  "username": "analyst",
  "password": "any"
}
```
#### Response Example:
```json
{
  "token": "mock-token-analyst-1",
  "user": {
    "id": "u-analyst",
    "username": "analyst",
    "name": "Sarah Chen",
    "role": "analyst",
    "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2"
  }
}
```

---

## 3. Real-Time Telemetry & SSE (`/api/live`)

| Method | Endpoint | Protocol | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/live/stream` | `text/event-stream` | Persistent Server-Sent Events connection streaming sensor & incident deltas every 3.5s. |
| `GET` | `/api/live/telemetry` | `application/json` | Polling fallback for retrieving instantaneous sensor and incident counts. |

---

## 4. SIEM & SOAR Incidents (`/api/incidents`)

| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/incidents` | All Roles | Lists all security incidents with filtering by status and severity. |
| `GET` | `/api/incidents/:id` | All Roles | Retrieves complete incident details, telemetry trace, and timeline. |
| `POST` | `/api/incidents/:id/status` | Analyst, Admin | Updates incident lifecycle status (`OPEN`, `INVESTIGATING`, `CONTAINED`, `RESOLVED`). |
| `POST` | `/api/incidents/:id/ai-analyze`| Analyst, Admin | Invokes dual-agent LLM to generate root cause analysis and impact breakdown. |
| `POST` | `/api/incidents/:id/playbook` | Analyst, Admin | Synthesizes an automated SOAR containment playbook with safety checks. |
| `POST` | `/api/incidents/:id/execute-action` | Analyst, Admin | Executes an automated SOAR action (e.g., Host Isolation, IP Block, Account Lock). |

---

## 5. Cecur SIEM / XDR Core Engine (`/api/cecur`)

| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/cecur/status` | Analyst, Admin, Auditor | Retrieves engine health, decoders list, active rules count, and AI status. |
| `GET` | `/api/cecur/agents` | Analyst, Admin, Auditor | Lists all enrolled endpoints, OS details, IP addresses, and sync statuses. |
| `GET` | `/api/cecur/rules` | Analyst, Admin, Auditor | Returns rules catalog with MITRE tactics and compliance tags. |
| `GET` | `/api/cecur/alerts` | Analyst, Admin, Auditor | Lists parsed alerts filtered by level and rule ID. |
| `POST` | `/api/cecur/logs/ingest` | Ingest Key / Auth | Ingestion gateway for raw log streams. Parses via decoders and emits alerts. |
| `POST` | `/api/cecur/active-response`| Analyst, Admin | Manually triggers active response action against an enrolled endpoint. |

---

## 6. CS3 Sensor Grid (`/api/sensors`)

| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sensors` | Analyst, Admin, Auditor | Lists all 8 sensor nodes with live bandwidth, jitter, and drop rates. |
| `POST` | `/api/sensors/:id/calibrate`| Analyst, Admin | Recalibrates zero-loss buffers, resets anomaly rate to 0.05, and clears jitter. |
| `POST` | `/api/sensors/:id/reboot` | Admin Only | Executes hardware/daemon reset sequence; logs audit record. |

---

## 7. Asset Fusion 3D Topology & Blast Simulation (`/api/fusion`)

| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/fusion` | Analyst, Admin | Returns full node and edge graph topology for 3D/2D visualization. |
| `POST` | `/api/fusion/simulate-blast`| Analyst, Admin | Evaluates lateral movement cascade based on scenario and active mitigations. |
| `POST` | `/api/fusion/export-report`| Analyst, Admin | Generates TLP-classified Threat Intelligence summary report. |

---

## 8. HexStrike AI Offensive Reconnaissance (`/api/hexstrike`)

| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/hexstrike/status` | Admin Only | Returns connector mode (`LIVE` vs `DEMO`), base URL, and available tools. |
| `GET` | `/api/hexstrike/targets` | Admin Only | Lists authorized reconnaissance target entries in `db.targetAllowlist`. |
| `GET` | `/api/hexstrike/jobs` | Admin Only | Lists recent and running offensive scan jobs. |
| `POST` | `/api/hexstrike/scan` | Admin Only | Triggers scoped scan (`nmap`, `nuclei`, `gobuster`, `subfinder`) against allowlisted host. |

---

## 9. Operational Audit Trail (`/api/audit`)

| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/audit` | All Roles | Lists chronological audit events (filters by actor, action, panel, status). |
| `POST` | `/api/audit/export` | Admin, Auditor | Exports cryptographic compliance audit report (JSON/CSV). |

---

## 10. System Administration & Database Reseed (`/api/system`)

| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/system/reseed` | Admin Only | Reseeds in-memory database with pristine demo records; logs audit record. |
