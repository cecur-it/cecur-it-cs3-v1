# Comprehensive Role-Based Access Matrix (RBAC / RBAM)

## Overview

This document defines the backend permission boundaries, persona access scopes, and server-enforced clearance levels for all panels and administrative endpoints within the CECUR-IT SOC Console.

---

## Server Clearance Matrix

| Console Panel / Action | Analyst (Tier 2/3) | Admin (Infra/Red) | Auditor (GRC) | Executive (CISO) |
| :--- | :--- | :--- | :--- | :--- |
| **Overview Dashboard (`overview`)** | Allowed | Allowed | Allowed | Allowed |
| **SIEM / SOAR Incidents (`incidents`)** | Full Read/Write | Full Read/Write | Read-Only | Read-Only |
| **Cecur SIEM/XDR Core (`cecur`)** | Full Access | Full Access | Read-Only | Denied (HTTP 403) |
| **ActivTrak Insider Risk (`activtrak`)** | Full Access | Full Access | Read-Only | Denied (HTTP 403) |
| **CS3 Sensor Grid (`sensors`)** | Calibrate / View | Full Admin / Reboot | Read-Only | Denied (HTTP 403) |
| **Asset Fusion 3D Graph (`fusion`)** | Allowed | Allowed | Denied (HTTP 403) | Denied (HTTP 403) |
| **errow Offensive Recon (`errow`)** | Denied (HTTP 403) | Full Authority | Denied (HTTP 403) | Denied (HTTP 403) |
| **Operational Audit Trail (`audit`)** | View Logs | Full Export | Full Export | View Logs |
| **Executive CISO KPIs (`executive`)** | Denied (HTTP 403) | Full Access | Full Access | Full Access |
| **DB Reseed / System Reset (`reseed_db`)** | Denied | Allowed | Denied | Denied |

---

## Security Persona Scopes

### 1. Analyst (`analyst`)
* Focused on operational incident triage, sensor calibration, and telemetry correlation.
* Access to operational tools (SIEM, ActivTrak, Sensor Grid, Fusion).
* Restricted from offensive recon tools (Errow) and executive KPI panels.

### 2. Administrator (`admin`)
* Complete system clearance across all panels, node reboots, offensive recon execution, and database resets.
* Handles system configuration and cross-domain policy enforcement.

### 3. Auditor (`auditor`)
* Read-only observation privileges across security queues and telemetry pipelines.
* Full export authority for GRC reports, audit trails, and compliance verification.
* Restricted from active remediation, sensor reboots, and offensive recon tools.

### 4. Executive (`executive`)
* High-level CISO and board governance reporting.
* Full access to executive metrics, ROI reports, and audit trail summaries.
* Access strictly blocked for raw operational data, sensory node configurations, and offensive pen-test triggers (HTTP 403).
