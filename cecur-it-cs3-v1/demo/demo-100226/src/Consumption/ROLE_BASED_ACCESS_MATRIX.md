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
| **HexStrike AI Offensive Recon (`hexstrike`)** | Denied (HTTP 403) | Full Authority | Denied (HTTP 403) | Denied (HTTP 403) |
| **Operational Audit Trail (`audit`)** | View Logs | Full Export | Full Export | View Logs |
| **Executive CISO KPIs (`executive`)** | Denied (HTTP 403) | Full Access | Full Access | Full Access |
| **DB Reseed / System Reset (`reseed_db`)** | Denied | Allowed | Denied | Denied |
