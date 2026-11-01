# Cross-Platform Forwarder Installation & Resource Footprint

## Overview

This specification details the architecture, resource consumption limits, and deployment scripts for streaming event forwarders deployed across endpoint fleets, Linux servers, Kubernetes clusters, and air-gapped industrial control systems (ICS/SCADA).

---

## Resource Footprint Matrix

| Target Platform | Package / Binary Type | RAM Allocation | CPU Footprint | Ingestion Protocol |
| :--- | :--- | :--- | :--- | :--- |
| **Windows 11 & Server** | Fluent Bit Service / MSI | < 30 MB RAM | < 0.5% CPU | TLS / HTTPS POST |
| **Linux (Debian / RHEL)** | Native systemd Daemon | < 25 MB RAM | < 0.2% CPU | TLS / HTTPS POST |
| **Kubernetes Pods** | DaemonSet / Sidecar Container | cgroup capped | Dynamic | gRPC / HTTPS |
| **Air-Gapped ICS / SCADA** | Hardware CS3 Tap Relay | Isolated | Hardware-based | Physical Serial / Diode |
