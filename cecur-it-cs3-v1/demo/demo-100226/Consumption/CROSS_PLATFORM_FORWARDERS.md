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

---

## Forwarder Deployment Scripts

### PowerShell (Windows Fleet): `Deploy-CecurForwarder.ps1`
```powershell
# Deploy-CecurForwarder.ps1 - Automated Windows Fleet Installation Script
Param(
  [Parameter(Mandatory=$true)][string]$IngestEndpoint = "https://soc.cecur-it.internal/api/cecur/logs/ingest",
  [Parameter(Mandatory=$true)][string]$ApiKey
)

Write-Host "[+] Installing CECUR-IT Cross-Platform Event Forwarder Service..." -ForegroundColor Cyan
$ServicePath = "C:\Program Files\CecurIT\CecurForwarder.exe"
If (Test-Path $ServicePath) {
    Write-Host "[i] Forwarder service already installed. Verifying heartbeat..." -ForegroundColor Yellow
} Else {
    # Download and register system service
    Invoke-RestMethod -Uri "$IngestEndpoint/binary" -OutFile $ServicePath
    New-Service -Name "CecurForwarder" -BinaryPathName "$ServicePath --endpoint=$IngestEndpoint --apikey=$ApiKey" -StartupType Automatic
    Start-Service -Name "CecurForwarder"
    Write-Host "[+] CecurForwarder Service successfully started." -ForegroundColor Green
}
```

### Ansible (Linux Fleet): `deploy_forwarder.yml`
```yaml
---
- name: Deploy CECUR-IT Linux Systemd Event Forwarder
  hosts: all
  become: yes
  tasks:
    - name: Download CecurForwarder Binary
      get_url:
        url: https://soc.cecur-it.internal/api/cecur/logs/ingest/binary/linux-amd64
        dest: /usr/local/bin/cecur-forwarder
        mode: '0755'

    - name: Create Systemd Service Configuration
      copy:
        dest: /etc/systemd/system/cecur-forwarder.service
        content: |
          [Unit]
          Description=CECUR-IT Log Stream Forwarder
          After=network.target

          [Service]
          Type=simple
          ExecStart=/usr/local/bin/cecur-forwarder --config=/etc/cecur/forwarder.conf
          Restart=always
          RestartSec=5s

          [Install]
          WantedBy=multi-user.target

    - name: Enable and Start CecurForwarder
      systemd:
        name: cecur-forwarder
        enabled: yes
        state: started
```

---

## Log Ingestion Endpoint

Forwarder nodes stream JSON-formatted telemetry events directly to:
* **Endpoint**: `/api/cecur/logs/ingest`
* **Security Header**: `X-API-Key: <SOC_INGESTION_SECRET>`
* **Encryption**: TLS 1.3 with mutual certificate verification (mTLS) for critical infrastructure nodes.
