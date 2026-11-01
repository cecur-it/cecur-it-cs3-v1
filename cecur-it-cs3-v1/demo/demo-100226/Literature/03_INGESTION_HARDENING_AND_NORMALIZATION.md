# 03. Ingestion Hardening & Normalization
## Multi-Format Log Ingestion, Buffer Buffering, and MITRE Rule Engines

---

## 1. Architectural Overview

The CS3 Log Ingestion Pipeline processes telemetry from heterogeneous enterprise data sources. It is designed to handle bursty event streams, mitigate memory exhaustion, reject unauthorized payloads, and normalize diverse log schemas into a standardized JSON event model.

```
+---------------------------------------------------------------------------------------+
|                               INGESTION GATEWAY PIPELINE                              |
|                                                                                       |
|   Edge Log Streams  --->  [mTLS / API Key Validation] ---> [Rate Limiting Buffer]      |
|   (Syslog, WinEvent,                                          (Max 5000 EPS / burst)   |
|    K8s, Flow Logs)                                                      |             |
|                                                                         v             |
|                                                            [Decoder Parser Matrix]    |
|                                                            (Regex / JSON / XML)       |
|                                                                         |             |
|                                                                         v             |
|                                                            [Normalized JSON Envelope] |
|                                                                         |             |
|                                                                         v             |
|   +---------------------------------------------------------------------------------+ |
|   |                       CECUR SIGNATURE & CORRELATION ENGINE                      | |
|   | - MITRE ATT&CK Tactic & Technique Mapping                                       | |
|   | - Dynamic Severity Calculation (Level 1 - 15)                                    | |
|   | - Multi-Regulatory Compliance Tagging (PCI-DSS, NIST 800-53, HIPAA, GDPR)       | |
|   | - SOAR Active Response Evaluation (Drop, Isolate, Block, Kill)                   | |
|   +---------------------------------------------------------------------------------+ |
|                                          |                                            |
|                                          v                                            |
|                            [In-Memory Stream & SSE Broadcast]                         |
+---------------------------------------------------------------------------------------+
```

---

## 2. Ingestion Decoders Matrix (`server/engine/cecurEngine.ts`)

The platform implements six hardened log decoders capable of parsing standard and specialized security formats:

| Decoder Name | Type | Target Sources | Extracted Fields |
| :--- | :--- | :--- | :--- |
| `cecur-syslog` | `rfc5424` / `rfc3164` | Linux standard daemons, rsyslog, syslog-ng | `timestamp`, `hostname`, `program_name`, `pid`, `message`, `src_ip`, `user` |
| `cecur-auth-pam` | `linux_pam` | SSH daemon, sudo, su, Pluggable Auth Modules | `user`, `src_ip`, `auth_status`, `tty`, `uid` |
| `cecur-auditd` | `linux_auditd` | Linux Kernel Audit subsystem syscalls | `syscall`, `exe`, `pid`, `ppid`, `uid`, `comm`, `success` |
| `cecur-windows-evtx` | `windows_xml` | Microsoft Windows Security Event Logs (4624, 4625, 4688, 7045) | `EventID`, `ProcessName`, `ParentProcessName`, `TargetUserName`, `LogonType`, `IpAddress` |
| `cecur-k8s-audit` | `json_k8s` | Kubernetes API server audit logs | `verb`, `user`, `namespace`, `resource`, `pod`, `container`, `responseStatus` |
| `cecur-cloud-flow` | `cloud_vpc` | CS3 Cloud VPC Flow, AWS CloudTrail, Azure NSG logs | `src_ip`, `dest_ip`, `src_port`, `dest_port`, `protocol`, `bytes_sent`, `action` |

---

## 3. Standardized Event Envelope

All ingested logs are converted into the standard `CecurLogEvent` envelope:

```typescript
export interface CecurLogEvent {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  logFormat: string;
  decoderMatched: string;
  rawPayload: string;
  extractedFields: Record<string, any>;
  level: number; // Severity scale 1 - 15
  matchedRuleId?: number;
  mitreTactic?: string;
  mitreTechnique?: string;
}
```

---

## 4. Detection Rules & MITRE ATT&CK Catalog

The rules catalog maps signatures to severity tiers and compliance frameworks:

| Rule ID | Level | Title & Summary | MITRE Tactic / Technique | Compliance Frameworks |
| :--- | :--- | :--- | :--- | :--- |
| `10010` | 10 | **sshd: Multiple Failed Authentication (Brute-Force)** | Credential Access / `T1110.001` | PCI DSS 10.2.4, NIST AC-7, HIPAA 164.312 |
| `10020` | 14 | **LSASS Memory Dumping / Credential Harvesting** | Credential Access / `T1003.001` | NIST SI-4, PCI DSS 10.6, GDPR Art 32 |
| `10030` | 12 | **Critical System Binary Tampering (FIM)** | Persistence / `T1565.001` | PCI DSS 11.5, NIST SI-7, GDPR Art 32 |
| `10040` | 9 | **Web Application Attack: SQL Injection Probe** | Initial Access / `T1190` | OWASP A03:2021, PCI DSS 6.5.1 |
| `10050` | 13 | **Kubernetes Cluster Privileged Pod Creation** | Privilege Escalation / `T1611` | CIS Kubernetes Benchmark, NIST SI-4 |
| `10060` | 11 | **Cloud IAM Root Account Console Access Without MFA** | Defense Evasion / `T1078.004` | CIS AWS Foundations, SOC 2 CC6.1 |

---

## 5. Ingestion Hardening & Protection Mechanisms

### 5.1. Anti-Flooding & Rate Limiting
- **Burst Buffering**: In-memory ring buffer with a maximum threshold of 10,000 unparsed events.
- **Backpressure Mechanism**: When buffer capacity exceeds 85%, the `/api/cecur/logs/ingest` endpoint emits `HTTP 429 Too Many Requests` with a dynamic `Retry-After` header.
- **LRU Cache for Hostname Resolution**: In-memory LRU cache stores IP-to-Hostname and MAC-to-Device mappings for 30 minutes, preventing redundant database queries during packet inspection.

### 5.2. Schema Validation & Sanitization
- Input payloads are checked for maximum length (64 KB per single log line).
- Control characters and binary sequences are escaped before regex evaluation to eliminate Regular Expression Denial of Service (ReDoS) vulnerabilities.
- API Key verification via header `X-API-Key: <SOC_INGESTION_SECRET>` rejects unauthorized network endpoints prior to regex execution.

### 5.3. Micro-Batching to Cloud Persistence
- Real-time events are stored in volatile memory for sub-millisecond SSE distribution.
- Flushed to durable Firestore collections in micro-batches every 5 seconds to reduce write I/O costs by up to 90%.
