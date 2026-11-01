import { CapabilityItem, SectorSolution, LeaderProfile, ProgramTier, CredentialBadge, TelemetryLog } from '../types';

export const CAPABILITY_ITEMS: CapabilityItem[] = [
  {
    id: 'soc-ops',
    columnNumber: '01',
    title: 'SOC & Threat Operations',
    categoryTag: 'Continuous Operations',
    description: 'Unified, vendor-neutral security operations. We provide 24/7 log correlation, active threat hunting, and rapid incident response tailored to your existing architecture.',
    sensorFeed: 'BYOS / Nano-VM Ingestion @ 24,800 EPS',
    badge: 'Tier-1 Threat Hunting',
    bullets: [
      { text: 'SIEM consolidation, tuning, and noise reduction' },
      { text: '24/7 continuous monitoring across cloud and on-premise estates' },
      { text: 'Behavioral threat hunting with customized detection models' },
      { text: 'Real-time transaction and AML telemetry for immediate anomaly containment', isNew: true },
    ]
  },
  {
    id: 'ics-ot',
    columnNumber: '02',
    title: 'ICS / OT & Critical Infrastructure',
    categoryTag: 'Cyber-Physical Defense',
    description: 'Specialized cyber-physical assessments for high-consequence environments including energy utilities, refineries, transportation hubs, and satellite facilities.',
    sensorFeed: 'Modbus / DNP3 Protocol Active',
    badge: 'Zero-Downtime Assurance',
    bullets: [
      { text: 'Industrial control systems (ICS/SCADA) vulnerability assessments' },
      { text: 'Red team and blue team operational simulation exercises' },
      { text: 'Safety-instrumented systems and cyber-consequence reviews' },
      { text: 'Decentralized node health and ledger bridge monitoring', isNew: true },
    ]
  },
  {
    id: 'zero-trust',
    columnNumber: '03',
    title: 'Zero Trust & Compliance Architecture',
    categoryTag: 'Governance & Authorization',
    description: 'Enterprise security architecture and regulatory authorization engineered to pass federal and financial audits on the first pass.',
    sensorFeed: 'NIST 800-53 Rev 5 / Continuous Validation',
    badge: 'Audit-Proof Governance',
    bullets: [
      { text: 'Fast-track ATO packages, System Security Plans (SSPs), and RMF workflows' },
      { text: 'Zero-trust micro-segmentation and air-gap network boundary design' },
      { text: 'Cloud infrastructure authorization through FedRAMP and StateRAMP' },
      { text: 'Continuous regulatory mapping for PCI-DSS, GLBA, and central bank directives', isNew: true },
    ]
  }
];

export const SECTOR_SOLUTIONS: SectorSolution[] = [
  {
    id: 'fintech-banking',
    sectorName: 'FinTech & Banking',
    badge: 'Financial Defense',
    description: 'Real-time anti-fraud detection and AML telemetry integrated directly into your central operations dashboard.',
    protocolNote: 'ISO 20022 / Swift MT / Open Banking API Sentinel',
    threatSurface: 'Sub-second anomaly interdiction (< 4ms latency)',
    bullets: [
      'Real-time fraud and AML telemetry tracking',
      'Continuous compliance mapping for PCI-DSS v4.0 & GLBA',
      'Open Banking API protection against credential stuffing and unauthorized access',
      'Wire routing velocity and multi-account structuring alerts'
    ]
  },
  {
    id: 'crypto-blockchain',
    sectorName: 'Cryptographic & Blockchain',
    badge: 'Distributed Systems',
    description: 'Securing digital asset infrastructure and distributed consensus systems against protocol-level vulnerabilities.',
    protocolNote: 'EVM / Cosmos IBC / Cross-Chain Liquidity Verifier',
    threatSurface: 'Mempool surveillance & invariant proof verification',
    bullets: [
      'Smart contract validation and protocol telemetry feeds',
      'Decentralized node health tracking and consensus split alerts',
      'Cold and hot wallet custody forensic verification',
      'Cross-chain bridge relay invariant proof monitoring'
    ]
  },
  {
    id: 'federal-bureaus',
    sectorName: 'Federal Bureaus & DoD',
    badge: 'Cloud Enclaves',
    description: 'Cloud architectures and air-gapped sensor deployments meeting strict national security isolation requirements.',
    protocolNote: 'FedRAMP High / DoD CC SRG / CJIS Strict Isolation',
    threatSurface: 'Advanced persistent threat defense & zero exfiltration paths',
    bullets: [
      'Secure cloud and unidirectional air-gapped deployments',
      'Advanced threat hunting with curated intelligence feeds',
      'Supply chain integrity and FedRAMP / StateRAMP authorization alignment',
      'Zero-trust cryptographic diode verification'
    ]
  },
  {
    id: 'private-public-sectors',
    sectorName: 'Private & Public Enterprises',
    badge: 'Enterprise Convergence',
    description: 'Bridging OT/IT gaps and uncovering insider threats across complex hybrid corporate environments.',
    protocolNote: 'Purdue Model Levels 0-4 / Enterprise Directory Federation',
    threatSurface: 'Privilege escalation & lateral movement suppression',
    bullets: [
      'Industrial control systems (ICS/SCADA) and IoT fleet protection',
      'Behavioral anomaly analytics for insider threat detection',
      'Data exfiltration prevention and privilege escalation defense',
      'Hybrid multi-cloud perimeter consolidation'
    ]
  }
];

export const LEADERSHIP_PROFILES: LeaderProfile[] = [
  {
    name: 'Floyd Marshall Jr.',
    role: 'Founder & Chief Executive Officer / CISO',
    callsign: 'Principal Architect',
    experience: '35+ Years in Critical Defense Architecture',
    bio: 'The chief architect of the CS3 platform. Floyd brings over three decades of field experience in critical infrastructure defense, uniting hands-on threat operations with comprehensive compliance leadership.',
    specialties: [
      'Critical Infrastructure Defense',
      'Zero-Trust Systems Engineering',
      'Strategic Compliance & RMF Oversight',
      'High-Stakes Incident Command'
    ]
  },
  {
    name: 'Don Tadaya',
    role: 'Chief Technology Officer (CTO)',
    callsign: 'Engineering Lead',
    experience: 'Sensor & Telemetry Architecture Lead',
    bio: 'The technical driver behind the sensor suite. Don leads sensor integration across SIEM, blockchain networks, and behavioral models, ensuring low-latency threat visibility.',
    specialties: [
      'CS3 Sensor Suite Integration',
      'FinTech & Blockchain AML Telemetry',
      'Behavioral Anomaly Detection Models',
      'Ultra-Low Latency Telemetry Pipelines'
    ]
  }
];

export const INITIAL_TELEMETRY_LOGS: TelemetryLog[] = [
  {
    id: 'tx-8841',
    timestamp: '14:59:02.114',
    source: 'AML_ENGINE',
    level: 'NOMINAL',
    message: 'Wire routing velocity normal: Swift MT103 batch #8914 verified',
    txId: '0x8f2a...c091',
    metric: '$4,280,000.00 Settled',
    status: 'CLEARED'
  },
  {
    id: 'tx-8842',
    timestamp: '14:59:04.492',
    source: 'AML_ENGINE',
    level: 'ANOMALY_BLOCKED',
    message: 'Rapid structuring pattern intercepted: 14 sub-threshold transfers in 800ms',
    txId: '0x3c99...e72b',
    metric: 'Risk Score: 98.4 / 100',
    status: 'FROZEN & QUARANTINED'
  },
  {
    id: 'scada-104',
    timestamp: '14:59:05.781',
    source: 'ICS_SCADA',
    level: 'NOMINAL',
    message: 'Substation B-4 telemetry: Modbus function code 0x03 within threshold',
    metric: 'Frequency: 60.002 Hz',
    status: 'SYNCHRONIZED'
  },
  {
    id: 'node-901',
    timestamp: '14:59:06.210',
    source: 'BYOS_NANO_VM',
    level: 'NOMINAL',
    message: 'Nano-VM cluster delta check: 60,000 nodes heartbeat verified (0 drift)',
    metric: 'Nodes: 60,000 / 60,000',
    status: 'ACTIVE'
  },
  {
    id: 'bridge-411',
    timestamp: '14:59:07.899',
    source: 'BLOCKCHAIN_BRIDGE',
    level: 'INSPECT',
    message: 'Cross-chain bridge relay: Invariant proof confirmed for Ethereum-L2 pool',
    txId: '0xae41...55da',
    metric: 'Hash Proof: Valid',
    status: 'VERIFIED'
  },
  {
    id: 'fed-770',
    timestamp: '14:59:08.502',
    source: 'FED_GATEWAY',
    level: 'NOMINAL',
    message: 'Air-gap unidirectional diode link: Zero reverse packet reflection detected',
    metric: 'Isolation: 100%',
    status: 'ENFORCED'
  }
];

export const HATS_METHOD_PILLARS = [
  {
    code: 'Red Hat',
    name: 'Adversary Emulation & Kinetic Red Teaming',
    color: 'border-rose-500/40 text-rose-400 bg-rose-950/20',
    dotColor: 'bg-rose-500',
    focus: 'Offensive Simulation',
    detail: 'Field-tested exploits evaluating SCADA boundaries, cross-chain bridges, and enterprise directories to eliminate blind spots.'
  },
  {
    code: 'Blue Hat',
    name: 'Embedded Defense & Active Hunting',
    color: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20',
    dotColor: 'bg-cyan-400',
    focus: '24/7 Threat Interdiction',
    detail: 'Continuous ESOC monitoring, behavioral hunting, log correlation, and real-time transaction anomaly containment.'
  },
  {
    code: 'White Hat',
    name: 'Architectural Authorization & Auditing',
    color: 'border-slate-300/40 text-slate-200 bg-slate-800/20',
    dotColor: 'bg-slate-200',
    focus: 'Audit-Proof Compliance',
    detail: 'Direct drafting of FedRAMP High SSPs, NIST 800-53 Rev 5 controls, PCI-DSS v4.0 matrices, and DoD ATO packages.'
  },
  {
    code: 'Yellow Hat',
    name: 'OT/ICS & Cyber-Physical Hardening',
    color: 'border-amber-500/40 text-amber-400 bg-amber-950/20',
    dotColor: 'bg-amber-400',
    focus: 'Zero-Downtime Environments',
    detail: 'Purdue Model air-gaps, substation breaker telemetry, airfield safety loops, and industrial fail-safe verification.'
  },
  {
    code: 'Purple Hat',
    name: 'Collaborative Senior Engineering',
    color: 'border-purple-500/40 text-purple-400 bg-purple-950/20',
    dotColor: 'bg-purple-400',
    focus: 'Senior Architect Delivery',
    detail: 'Every engagement is executed directly by the principal architects who define the defense roadmap—no junior handoffs.'
  }
];

export const CREDENTIALS_LIST: CredentialBadge[] = [
  { code: 'NIST 800-53', name: 'Security & Privacy Controls', authority: 'NIST', standard: 'Rev 5 High Baseline', level: 'Level 4 Continuous' },
  { code: 'FedRAMP', name: 'Federal Risk & Authorization', authority: 'GSA / FedRAMP PMO', standard: 'High Impact Baseline', level: 'Ready / Authorized' },
  { code: 'DoD IL5 / IL6', name: 'Cloud Computing SRG', authority: 'DISA', standard: 'CUI & Secret Enclaves', level: 'Air-Gapped Deployment' },
  { code: 'NERC CIP', name: 'Critical Infrastructure Protection', authority: 'NERC / FERC', standard: 'CIP-002 to CIP-014', level: 'High-Impact Substation' },
  { code: 'PCI-DSS v4.0', name: 'Payment Card Industry Standard', authority: 'PCI SSC', standard: 'FinTech & Gateway Level 1', level: 'Real-time Anti-Fraud' },
  { code: 'CMMC 2.0', name: 'Cybersecurity Maturity Model', authority: 'DoD Cyber AB', standard: 'Level 2 & Level 3 Advanced', level: 'Defense Industrial Base' }
];

export const PROGRAMS_LIST: ProgramTier[] = [
  {
    id: 'program-esoc',
    name: 'Dedicated ESOC & Hunt Retainer',
    cadence: 'Continuous 24/7/365',
    target: 'FinTech, Critical Utilities, DoD Contractors',
    features: [
      'Dedicated senior hunt architect on call',
      'Nano-VM & BYOS real-time sensor integration',
      'Real-time fraud, AML, and bridge telemetry',
      '15-minute guaranteed SLA on severity-1 containment'
    ]
  },
  {
    id: 'program-ato',
    name: 'Rapid ATO & Authorization Sprint',
    cadence: '90-Day Fixed Window',
    target: 'Platforms entering GovCloud / Sovereign Enclaves',
    features: [
      'Complete SSP, SAR, and POA&M drafting',
      'FIPS 140-3 cryptography validation',
      'Zero-trust micro-segmentation enforcement',
      '3PAO audit defense led by Floyd Marshall Jr.'
    ]
  },
  {
    id: 'program-cyber-physical',
    name: 'Critical Infrastructure Exercise & Audit',
    cadence: 'Bi-Annual / Annual Exercise',
    target: 'Energy Grids, Airports, Refineries, Logistics Ports',
    features: [
      'Safety-instrumented systems (SIS) integrity review',
      'Physical-to-digital intrusion simulation',
      'Hardware-in-the-loop firmware vulnerability analysis',
      'Executive consequence reduction roadmap'
    ]
  }
];

export const CONTACT_EMAILS = [
  { label: 'Briefing Requests', email: 'contact@cecur-it.io', description: 'Schedule strategic assessment with principal architects' },
  { label: 'Partnerships', email: 'partners@cecur-it.io', description: 'Technology integration & SIEM sensor partnerships' },
  { label: 'Sales', email: 'sales@cecur-it.io', description: 'Enterprise contracts, ESOC retainers, and ATO sprints' },
  { label: 'Security Intelligence', email: 'security@cecur-it.io', description: 'PGP-encrypted threat intelligence & emergency dispatch' },
  { label: 'Compliance', email: 'compliance@cecur-it.io', description: 'FedRAMP, NIST 800-53, PCI-DSS & CIP audit inquiries' },
  { label: 'General Inquiries', email: 'contact@cecur-it.io', description: 'General corporate correspondence' }
];
