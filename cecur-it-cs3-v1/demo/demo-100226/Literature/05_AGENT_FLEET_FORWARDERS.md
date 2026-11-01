# 05. Agent Fleet Forwarders
## Cross-Platform Forwarder Installation, Scripts, and Resource Footprints

---

## 1. Overview & Footprint Matrix

The **CS3 Event Forwarder Agent** is a lightweight, high-performance log-shipper and telemetry forwarder designed for deployment across enterprise workstations, Linux servers, containerized workloads, and air-gapped industrial control systems.

### Resource Consumption Specification

| Target Platform | Package / Binary Type | RAM Footprint | CPU Utilization | Ingestion Protocol | Failure Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Windows 11 & Server** | Windows Service / MSI installer | `< 30 MB` | `< 0.5%` core | TLS 1.3 / HTTPS POST | Disk-backed buffer (100MB max) |
| **Linux (Debian / RHEL)** | Systemd Daemon / Binary | `< 25 MB` | `< 0.2%` core | TLS 1.3 / HTTPS POST | Memory ring buffer + journal fallback |
| **Kubernetes Pods** | DaemonSet / Sidecar Container | Capped `64Mi` | Capped `100m` | gRPC / HTTPS | stdout capture & backpressure |
| **Air-Gapped ICS / SCADA** | Hardware CS3 Tap Relay | Isolated | Hardware-based | Physical Serial / Diode | Hardware FIFO buffer |

---

## 2. Automated Fleet Deployment Scripts

### 2.1. Windows Fleet Deployment (`Deploy-CecurForwarder.ps1`)

Automates installation, service creation, and heartbeat registration across Windows 10/11 Enterprise and Windows Server 2019/2022/2025:

```powershell
# Deploy-CecurForwarder.ps1 - Automated Windows Fleet Installation Script
Param(
  [Parameter(Mandatory=$false)][string]$IngestEndpoint = "https://soc.cecur-it.internal/api/cecur/logs/ingest",
  [Parameter(Mandatory=$false)][string]$ApiKey = "cecur-ingest-key-prod-01",
  [Parameter(Mandatory=$false)][string]$InstallDir = "C:\Program Files\CecurIT"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CECUR-IT CS3 Windows Forwarder Deployment Engine" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Verify Administrator Privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
If (-not $isAdmin) {
    Write-Error "[-] Deployment failed: Script must be executed as Local Administrator."
    Exit 1
}

# Create Target Directory
If (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Write-Host "[+] Created target directory: $InstallDir" -ForegroundColor Green
}

$ServicePath = Join-Path $InstallDir "CecurForwarder.exe"

# Register & Start Service
If (Get-Service -Name "CecurForwarder" -ErrorAction SilentlyContinue) {
    Write-Host "[i] Forwarder service already registered. Restarting with updated configuration..." -ForegroundColor Yellow
    Restart-Service -Name "CecurForwarder"
} Else {
    Write-Host "[+] Registering CecurForwarder as Automatic Windows Service..." -ForegroundColor Cyan
    New-Service -Name "CecurForwarder" `
                -BinaryPathName "`"$ServicePath`" --endpoint=`"$IngestEndpoint`" --apikey=`"$ApiKey`"" `
                -DisplayName "CECUR-IT SOC Telemetry Forwarder" `
                -Description "Streams Windows Security Event Logs to CS3 SOC Console" `
                -StartupType Automatic

    Start-Service -Name "CecurForwarder"
    Write-Host "[+] Service successfully started and streaming telemetry." -ForegroundColor Green
}
```

---

### 2.2. Linux Server Fleet Deployment (`deploy_forwarder.yml`)

Ansible playbook for mass distribution across Ubuntu, Debian, RHEL, CentOS, Rocky Linux, and Fedora:

```yaml
---
- name: Deploy CECUR-IT Linux Systemd Event Forwarder Fleet
  hosts: all
  become: yes
  vars:
    ingest_endpoint: "https://soc.cecur-it.internal/api/cecur/logs/ingest"
    api_key: "cecur-ingest-key-prod-01"
    binary_dest: "/usr/local/bin/cecur-forwarder"
    config_dest: "/etc/cecur/forwarder.conf"

  tasks:
    - name: Create Configuration Directory
      file:
        path: /etc/cecur
        state: directory
        owner: root
        group: root
        mode: '0750'

    - name: Write Forwarder Configuration File
      copy:
        dest: "{{ config_dest }}"
        owner: root
        group: root
        mode: '0600'
        content: |
          # CECUR-IT SOC Forwarder Configuration
          endpoint: {{ ingest_endpoint }}
          api_key: {{ api_key }}
          log_sources:
            - /var/log/auth.log
            - /var/log/syslog
            - /var/log/audit/audit.log
          buffer_max_mb: 50
          flush_interval_ms: 1000

    - name: Create Systemd Service Unit
      copy:
        dest: /etc/systemd/system/cecur-forwarder.service
        owner: root
        group: root
        mode: '0644'
        content: |
          [Unit]
          Description=CECUR-IT Log Stream Forwarder
          After=network.target
          Documentation=https://soc.cecur-it.internal/docs

          [Service]
          Type=simple
          ExecStart={{ binary_dest }} --config={{ config_dest }}
          Restart=always
          RestartSec=3s
          LimitNOFILE=65536
          StandardOutput=journal
          StandardError=journal

          [Install]
          WantedBy=multi-user.target

    - name: Reload Systemd Daemon and Enable Service
      systemd:
        name: cecur-forwarder
        daemon_reload: yes
        enabled: yes
        state: started
```

---

### 2.3. Kubernetes Fleet DaemonSet

Deploys forwarders onto every worker node to stream container stdout and node journal logs:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: cecur-forwarder-daemonset
  namespace: kube-system
  labels:
    app: cecur-forwarder
spec:
  selector:
    matchLabels:
      app: cecur-forwarder
  template:
    metadata:
      labels:
        app: cecur-forwarder
    spec:
      tolerations:
        - key: node-role.kubernetes.io/master
          effect: NoSchedule
      containers:
        - name: forwarder
          image: ghcr.io/dascient/cecur-forwarder:latest
          resources:
            limits:
              memory: 64Mi
              cpu: 100m
            requests:
              memory: 32Mi
              cpu: 25m
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
            - name: varlibdockercontainers
              mountPath: /var/lib/docker/containers
              readOnly: true
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
        - name: varlibdockercontainers
          hostPath:
            path: /var/lib/docker/containers
```

---

## 3. Air-Gapped ICS / SCADA Optical Diode Relay

For high-security critical infrastructure (SCADA/ICS, nuclear, defense substations):
1. **Unidirectional Hardware Tap**: Data flows through a transmit-only fiber optic transceiver connected to the CS3 Ingestion Tap.
2. **Deterministic Serialization**: The forwarder flushes fixed-width binary packets without receiving bidirectional ACKs.
3. **Loss Verification**: Sequence identifiers allow the CS3 Console to detect dropped frames and flag sensor calibration warnings automatically.
