export interface LegalSection {
  id: string;
  number: string;
  title: string;
  summary: string;
  content: string[];
  subsections?: { title: string; points: string[] }[];
  complianceTags?: string[];
}

export interface LegalDocument {
  id: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  version: string;
  badge: string;
  overview: string;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  id: 'privacy-policy',
  title: 'CECUR-IT, Inc. — CS3 Platform Privacy Policy & Data Sovereignty Governance',
  subtitle: 'Zero-Knowledge Architecture, Telemetry Boundary Enclaves & Regulatory Alignment',
  lastUpdated: 'September 2026',
  version: 'v4.14.7-Rev5',
  badge: 'Zero-Data Exfiltration Guarantee',
  overview:
    'CECUR-IT, Inc. (and affiliated operating entities including Mormar Technology, Inc., collectively "CECUR-IT", "we", "us", or "our") is dedicated to safeguarding organizational data sovereignty. This Privacy Policy details our technical architecture, telemetry ingestion scopes, data handling limitations, and legal commitments for all operators and enterprise clients utilizing the CECUR-IT CS3 (Consolidated Security Sensor Suite & Cyber Security Command System) platform, cross-platform forwarder binaries, and managed Security Operations Center (SOC) services.',
  sections: [
    {
      id: 'data-sovereignty',
      number: 'Section 1.0',
      title: 'Data Sovereignty & Zero-Exfiltration Architecture',
      summary: 'All telemetry analysis is executed at the edge within client-controlled boundaries without external multi-tenant aggregation.',
      content: [
        '1.1 Sovereign Boundary Enforcement: The CS3 platform is engineered on a strict zero-knowledge architecture. When CS3 forwarders or Nano-VM clusters operate within client enterprise perimeters (including cloud VPCs, on-premise hypervisors, and air-gapped industrial control facilities), all raw payload parsing, log extraction, and behavioral heuristic checks occur locally inside the client sovereign enclave.',
        '1.2 No Centralized Data Harvesting: CECUR-IT does not aggregate, pool, monetize, or sell client telemetry, financial records, employee activity metrics, or infrastructure topology graphs to third parties, external advertising exchanges, or commercial brokers.',
        '1.3 In-Memory Edge Analysis: Real-time event correlation and threat detection algorithms execute primarily in-memory on lightweight forwarder agents (<30 MB RAM per node). Raw payloads and ephemeral buffer spikes are cleared upon processing without unencrypted disk persistence.',
      ],
      complianceTags: ['NIST SP 800-53 Rev 5 SC-7', 'FedRAMP High Baseline', 'ISO/IEC 27001:2022 A.8.24'],
    },
    {
      id: 'ingestion-categories',
      number: 'Section 2.0',
      title: 'Categories of Ingested Telemetry & Purpose of Processing',
      summary: 'Explicit enumeration of security metadata, ICS/SCADA metrics, insider risk indicators, and financial hash proofs processed by CS3.',
      content: [
        '2.1 Host & Network Security Telemetry: CS3 ingests system event IDs (e.g., Windows Sysmon, Linux auditd, Wazuh alerts), firewall flow headers (NetFlow/IPFIX), DNS query metadata, and Suricata intrusion signatures exclusively for threat correlation and cyber incident interdiction.',
        '2.2 Industrial Control Systems (ICS/SCADA): Telemetry ingested from OT enclaves is restricted to protocol header frames, function codes (e.g., Modbus FC03/FC16, DNP3, BACnet), register variance thresholds, and unidirectional air-gap diode heartbeat signals. No operational control overrides are initiated without explicit operator intervention.',
        '2.3 ActivTrak Insider Risk & Workforce Productivity Telemetry: Where ActivTrak sensor modules are activated by the client, CS3 processes application usage classifications, active vs. idle duration metrics, and high-risk file movement alerts. Keystroke logging is disabled by default, and PII masking is enforced at the collection point.',
        '2.4 Financial & AML Telemetry: FinTech transaction monitoring is limited to cryptographically hashed transaction proofs, routing velocity metrics, and ISO 20022 message structural metadata. CS3 does not store plaintext Primary Account Numbers (PANs), cardholder CVVs, or unmasked Social Security numbers.',
      ],
      subsections: [
        {
          title: 'Explicitly Excluded Data Categories',
          points: [
            'Client proprietary customer databases or raw commercial trade secrets.',
            'Unencrypted personal communications (email bodies, chats, voice recordings).',
            'Cardholder magnetic stripe data or raw biometric templates.',
          ],
        },
      ],
      complianceTags: ['PCI-DSS v4.0 Req 10', 'NERC CIP-007-6', 'CJIS Policy §5.10'],
    },
    {
      id: 'ai-governance',
      number: 'Section 3.0',
      title: 'AI Model Governance, Ephemerality & Gemini Zero-Retention',
      summary: 'AI inference copilot models process telemetry statelessly with strict zero training data retention.',
      content: [
        '3.1 Stateless Inference Pipeline: When operators invoke CECUR-IT AI analysis (powered by Google Gemini and proprietary CS3 threat inference pipelines), prompt payloads and incident context are transmitted over FIPS 140-3 validated TLS 1.3 tunnels to dedicated server-side inference nodes.',
        '3.2 Absolute Prohibition on Model Retraining: Customer telemetry, incident descriptions, vulnerability hashes, and corporate metadata are NEVER incorporated into the training corpus of public or commercial Large Language Models (LLMs).',
        '3.3 Ephemeral Memory Cycles: AI reasoning memory is bounded strictly to the active operator investigation session and purged upon triage resolution.',
      ],
      complianceTags: ['NIST AI 100-1 (AI RMF)', 'DoD Responsible AI Guidelines', 'SOC 2 Type II Confidentiality'],
    },
    {
      id: 'encryption-retention',
      number: 'Section 4.0',
      title: 'Cryptographic Encryption, Storage & Retention Schedules',
      summary: 'FIPS 140-3 cryptographic modules, tenant-isolated partitions, and automated retention lifecycle controls.',
      content: [
        '4.1 Encryption Standards: All data in transit is encrypted using TLS 1.3 with mandatory mutual certificate authentication (mTLS) for critical infrastructure sensor taps. All data at rest within database partitions is encrypted using AES-256-GCM with customer-managed or KMS-governed encryption keys.',
        '4.2 Configurable Hot Retention: Incident logs, audit records, and sensor metrics are retained in accordance with the client’s designated retention tier (Standard 30 days, Extended 90 days, or Federal Archive 365 days).',
        '4.3 Tamper-Evident Ledger Integrity: System audit trails utilize SHA-256 cryptographic chain-hashing to ensure immutable log records suitable for judicial and regulatory presentation.',
        '4.4 NIST SP 800-88 Sanitization: Upon termination of service or customer written purge request, all stored telemetry on decommissioned virtual volumes is sanitized in full compliance with NIST SP 800-88 Rev 1 (Guidelines for Media Sanitization).',
      ],
      complianceTags: ['FIPS 140-3', 'NIST SP 800-88 Rev 1', 'HIPAA Security Rule §164.312'],
    },
    {
      id: 'regulatory-alignment',
      number: 'Section 5.0',
      title: 'Global Regulatory Alignment & Privacy Rights',
      summary: 'Full support for GDPR, CCPA/CPRA, CJIS, FedRAMP High, and international data subject requests.',
      content: [
        '5.1 Privacy Framework Compliance: CECUR-IT maintains governance programs harmonized with the General Data Protection Regulation (EU/UK GDPR), the California Consumer Privacy Act (CCPA/CPRA), the Texas Data Privacy and Security Act (TDPSA), and global sovereign privacy regulations.',
        '5.2 Data Subject Rights Fulfillment: Enterprise operators and authorized administrators may exercise data subject rights—including rights of access, rectification, data portability, and erasure—by submitting a verified ticket to our GRC desk at compliance@cecur-it.io.',
        '5.3 Cross-Border Data Transfers: When cross-border telemetry routing is required for multinational SOC coordination, Standard Contractual Clauses (SCCs) and Supplementary Technical Measures (end-to-end encryption) are enforced.',
      ],
      complianceTags: ['EU GDPR 2016/679', 'CCPA / CPRA Cal. Civ. Code §1798.100', 'DoD CC SRG IL5/IL6'],
    },
    {
      id: 'incident-notification',
      number: 'Section 6.0',
      title: 'Security Incident Notification & Transparency SLA',
      summary: 'Guaranteed 72-hour customer notification SLA and transparent forensic coordination in the event of an infrastructure breach.',
      content: [
        '6.1 Rapid Notification Protocol: In the unlikely event of a confirmed security incident impacting CECUR-IT cloud infrastructure or shared ingestion relays, CECUR-IT will notify affected designated customer security points of contact without undue delay and no later than 72 hours following confirmation.',
        '6.2 Forensic Cooperation: CECUR-IT will provide affected clients with detailed root-cause summaries, Indicators of Compromise (IoCs), and forensic audit logs necessary to fulfill their respective regulatory filing obligations.',
      ],
      complianceTags: ['CISA Incident Reporting Mandate', 'NIST SP 800-61 Rev 2'],
    },
    {
      id: 'contact-officer',
      number: 'Section 7.0',
      title: 'Governance Contact & Data Protection Officer',
      summary: 'Direct communication channels with CECUR-IT Principal Architects and Compliance Desks.',
      content: [
        'For inquiries regarding data sovereignty, Data Processing Agreements (DPAs), Business Associate Agreements (BAAs), or CJIS clearance verification, please contact our specialized desks:',
        '• GRC & Compliance Enquiries: compliance@cecur-it.io',
        '• Security Operations & Incident Dispatch: security@cecur-it.io',
        '• General Legal Counsel: contact@cecur-it.io',
        '• Telephone Operations Desk: +1 (562) 681-3383 (Washington, D.C. / Federal Sector Clearing)',
      ],
      complianceTags: ['Official Governance Contact'],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  id: 'terms-of-service',
  title: 'CECUR-IT, Inc. — CS3 Platform Terms of Service & Usability Clauses',
  subtitle: 'Enterprise License, Permissible Operational Boundaries, SLAs & Usability Governance',
  lastUpdated: 'September 2026',
  version: 'v4.14.7-Rev5',
  badge: 'Enterprise Master Terms',
  overview:
    'These Terms of Service ("Terms", "Agreement") constitute a legally binding agreement between CECUR-IT, Inc. (including Mormar Technology, Inc., "CECUR-IT", "Provider") and the enterprise client, governmental agency, or authorized individual ("Customer", "Subscriber", "Operator") accessing or utilizing the CS3 Unified SOC Console, BYOS Forwarders, Asset Fusion 3D engines, errow reconnaissance tools, and associated advisory services.',
  sections: [
    {
      id: 'license-grant',
      number: 'Article 1.0',
      title: 'Enterprise License Grant & Access Scope',
      summary: 'Non-exclusive, revocable, subscription-based license to deploy CS3 sensors and access the Unified SOC Console.',
      content: [
        '1.1 License Scope: Subject to compliance with these Terms and payment of applicable subscription or retainer fees, CECUR-IT grants Customer a non-exclusive, non-transferable, revocable enterprise license to install CS3 forwarder binaries, ingest telemetry, and access the CS3 Console interface across authorized digital assets.',
        '1.2 Multi-Domain Deployment: Subscriptions cover designated sensor node counts (e.g., Essential Sentinel up to 50 nodes, Sovereign Grid up to 500 nodes, Federal Apex custom scale). Deployment exceeding allocated node volumes requires tier upgrade or additional capacity licensing.',
      ],
      complianceTags: ['Enterprise Licensing', 'ISO/IEC 27001 A.5.32'],
    },
    {
      id: 'permissible-use-offensive',
      number: 'Article 2.0',
      title: 'Authorized Scopes & Offensive Reconnaissance Guardrails (Errow / BBOT)',
      summary: 'STRICT CLAUSE: Offensive reconnaissance, active port scans, and vulnerability fuzzers must ONLY be directed against verified, customer-authorized assets.',
      content: [
        '2.1 STRICT RESTRICTION — Authorized Targets Only: The CS3 Console incorporates active reconnaissance, port discovery, and adversary simulation capabilities (including errow, BBOT scanners, and LightFuzz modules). Customer explicitly agrees and warrants that ALL active scans, fuzzing campaigns, and penetration testing modules SHALL BE EXECUTED EXCLUSIVELY against IP addresses, subdomains, and networks owned, operated, or contractually designated in writing by Customer.',
        '2.2 Absolute Prohibition on Third-Party Weaponization: Under no circumstances shall Customer utilize CECUR-IT offensive modules to scan, probe, stress-test, or exploit third-party systems, public utility networks, municipal services, or unverified targets without verified written authorization.',
        '2.3 Immediate Termination for Ethical Breach: Any violation of target authorization rules constitutes a material breach of contract resulting in immediate account suspension, revocation of licenses, and reporting to competent regulatory and law enforcement authorities.',
      ],
      subsections: [
        {
          title: 'Mandatory Target Validation Rules',
          points: [
            'All Errow recon scans require explicit domain/CIDR entry into the verified target inventory.',
            'Production SCADA/ICS nodes must be excluded from automated fuzzing loops unless marked for scheduled maintenance.',
            'Audit logs capture the authenticated operator ID for all launched scan tasks.',
          ],
        },
      ],
      complianceTags: ['Computer Fraud and Abuse Act (CFAA) 18 U.S.C. §1030', 'Rules of Engagement (ROE) Strict Compliance'],
    },
    {
      id: 'rbac-clearance',
      number: 'Article 3.0',
      title: 'Role-Based Access Control (RBAC) & Operator Responsibilities',
      summary: 'Server-enforced clearance hierarchy (Analyst, Admin, Auditor, Executive) and credential protection duties.',
      content: [
        '3.1 Clearance Integrity: CS3 enforces server-side RBAC gating. Customers must maintain operator assignments strictly according to verified duties:',
        '• Analyst (Tier 2/3): Real-time alert triage, sensor calibration, and incident containment.',
        '• Administrator: Global configuration, offensive recon execution, target inventory, and DB management.',
        '• Auditor (GRC): Immutable audit trail verification, compliance exports, and read-only telemetry.',
        '• Executive (CISO): High-level posture KPIs, MTTD/MTTR scorecards, and board-level risk metrics.',
        '3.2 Credential Safeguarding: Customer is strictly responsible for safeguarding operator credentials, enabling Multi-Factor Authentication (MFA), and rotating API ingestion keys. Account credential sharing across multiple operators is prohibited.',
      ],
      complianceTags: ['NIST SP 800-53 Rev 5 AC-2/AC-3/AC-6', 'Zero-Trust RBAC'],
    },
    {
      id: 'scada-limitations',
      number: 'Article 4.0',
      title: 'ICS / SCADA & Critical Infrastructure Operational Limitations',
      summary: 'Operational safety loop protection, passive tap default, and maintenance window requirements for OT environments.',
      content: [
        '4.1 Passive OT Telemetry Default: In industrial, power generation, water distribution, and transportation environments, CS3 sensors operate in passive listening/tap mode (Modbus, DNP3, BACnet, Profinet) to guarantee zero physical interference with kinetic processes.',
        '4.2 Safety-Instrumented System (SIS) Isolation: Active testing or sensor calibrations in Level 0–2 Purdue Model domains must be conducted exclusively during certified maintenance windows with safety engineering sign-off.',
        '4.3 Physical Safety Loop Disclaimer: CECUR-IT is not liable for operational downtime resulting from uncoordinated customer execution of active tests on unverified industrial hardware.',
      ],
      complianceTags: ['ISA/IEC 62443-3-3', 'NERC CIP-005-7', 'NIST SP 800-82 Rev 3'],
    },
    {
      id: 'sla-availability',
      number: 'Article 5.0',
      title: 'Service Level Objectives (SLO), Uptime & Service Limitations',
      summary: 'Target 99.99% cloud sync availability, <3.2 min MTTD, automated playbooks, and warranty disclaimers.',
      content: [
        '5.1 Availability Commitment: CECUR-IT targets 99.99% operational availability for the CS3 cloud dashboard and telemetry synchronization relays, excluding scheduled maintenance windows announced at least 48 hours in advance.',
        '5.2 Threat Containment Target: CS3 automated alert pipelines target a Mean Time to Detect (MTTD) of under 3.2 minutes for critical high-severity SIEM events and rapid playbook execution.',
        '5.3 Disclaimer of Comprehensive Threat Immunity: While CECUR-IT implements industry-leading heuristics, zero-day threat models, and real-time defense, cyber security is an inherently evolving threat landscape. CECUR-IT does not warrant that the software will prevent 100% of zero-day exploits, sophisticated state-sponsored APT attacks, or hardware failures outside its direct control.',
      ],
      complianceTags: ['99.99% High Availability SLA', 'FedRAMP Continuous Monitoring (ConMon)'],
    },
    {
      id: 'ai-gas-billing',
      number: 'Article 6.0',
      title: 'AI Token Gas Metering, Compute Fees & Billing Terms',
      summary: 'Usage-based metering of high-compute AI reasoning operations, monthly retainer accounting, and payment terms.',
      content: [
        '6.1 AI Gas Credits & Metering: Certain high-compute operations (including deep automated incident root-cause synthesis, 3D blast radius graph simulation, and batch offensive fuzzing) consume AI Gas Credits metered per token transaction.',
        '6.2 Retainer Accounting: Enterprise retainers include base compute allocations. Monthly usage exceeding base allowances will be invoiced according to standard published unit costs or deducted from prepaid enterprise pools.',
        '6.3 Payment Governance: Invoices are payable within net-30 days of issuance. Late payments may result in temporary throttling of high-compute AI features without impacting core SIEM alert ingestion.',
      ],
      complianceTags: ['Unit Cost Accounting', 'SOC 2 Billing Integrity'],
    },
    {
      id: 'intellectual-property',
      number: 'Article 7.0',
      title: 'Intellectual Property Rights & Mutual Non-Disclosure',
      summary: 'CECUR-IT retains platform, algorithm, and Hats Method IP; Customer retains all rights to their telemetry and proprietary data.',
      content: [
        '7.1 Provider IP: CECUR-IT retains all rights, title, and interest (including patent, copyright, trademark, and trade secret rights) in the CS3 platform, Hats Operational Doctrine, sensor source code, Fusion 3D graph algorithms, and Errow integration libraries.',
        '7.2 Customer Data Ownership: Customer retains sole and exclusive ownership of all customer telemetry, internal log files, proprietary network architecture topologies, and corporate incident records.',
        '7.3 Mutual NDA: Both parties agree to protect and maintain the confidentiality of non-public technical specifications, vulnerability findings, and security postures shared during the course of the engagement.',
      ],
      complianceTags: ['Proprietary IP Protection', 'Mutual NDA Standard'],
    },
    {
      id: 'liability-indemnification',
      number: 'Article 8.0',
      title: 'Limitation of Liability & Mutual Indemnification',
      summary: 'Aggregate liability caps, exclusion of consequential damages, and mutual indemnification for authorized defense exercises.',
      content: [
        '8.1 Liability Cap: To the maximum extent permitted by applicable law, the aggregate liability of either party arising under or related to this Agreement shall be limited to the total fees paid or payable by Customer to CECUR-IT in the twelve (12) months preceding the incident giving rise to liability.',
        '8.2 Consequential Damages Waiver: Neither party shall be liable for indirect, incidental, special, punitive, or consequential damages, including loss of profits, business disruption, or commercial goodwill.',
        '8.3 Customer Indemnity for Unauthorized Scans: Customer agrees to defend, indemnify, and hold harmless CECUR-IT and its officers from any claims, fines, or damages resulting from Customer’s execution of offensive scans against third-party unauthorized targets.',
      ],
      complianceTags: ['Enterprise Liability Standard'],
    },
    {
      id: 'termination-offboarding',
      number: 'Article 9.0',
      title: 'Term, Termination & Data Offboarding Governance',
      summary: 'Orderly offboarding, 30-day export window, and certified cryptographic data sanitization.',
      content: [
        '9.1 Termination for Convenience: Annual subscription contracts may be renewed or terminated with 60 days written notice prior to the expiration of the current billing term.',
        '9.2 Termination for Cause: Either party may terminate immediately in the event of material breach remaining uncured after 30 days of written notice.',
        '9.3 Data Export & Sanitization Window: Following termination, Customer will have 30 days to export all historic incident and audit logs via standard JSON/CSV APIs. Upon conclusion of the export window, all tenant data will be permanently wiped in accordance with NIST SP 800-88 Rev 1 sanitization standards.',
      ],
      complianceTags: ['NIST SP 800-88 Rev 1', 'Clean Offboarding Protocol'],
    },
    {
      id: 'governing-law',
      number: 'Article 10.0',
      title: 'Governing Law, Jurisdiction & Dispute Resolution',
      summary: 'Governing legal jurisdiction and commercial arbitration mechanisms.',
      content: [
        '10.1 Governing Law: This Agreement and any disputes arising out of or related hereto shall be governed exclusively by the federal laws of the United States and the laws of the District of Columbia, without regard to conflicts of law principles.',
        '10.2 Dispute Resolution: Any controversy or claim arising out of this Agreement shall be settled by binding arbitration administered by the American Arbitration Association (AAA) in Washington, D.C.',
      ],
      complianceTags: ['Federal District of Columbia Jurisdiction'],
    },
  ],
};

export const RULES_OF_ENGAGEMENT: LegalDocument = {
  id: 'rules-of-engagement',
  title: 'CECUR-IT, Inc. — Offensive Security Rules of Engagement (ROE)',
  subtitle: 'Operational Guidelines for errow, BBOT Scanners & Red Team Adversary Emulation',
  lastUpdated: 'September 2026',
  version: 'v4.14.7-Rev5',
  badge: 'Operational Directive',
  overview:
    'This Rules of Engagement (ROE) Directive governs all offensive security testing, automated attack-path tracing, external attack surface discovery (BBOT/Errow), and adversary emulation exercises executed through the CS3 platform.',
  sections: [
    {
      id: 'roe-authorization',
      number: 'ROE 1.0',
      title: 'Explicit Authorization & Scope Validation',
      summary: 'Mandatory verification of ownership or explicit written authorization prior to offensive tool execution.',
      content: [
        '1. Operators must possess verifiable authorization (letter of authorization / written penetration testing agreement) for every domain, host, and IP range inputted into the Errow or BBOT scanner engines.',
        '2. Third-party cloud service providers (AWS, Azure, GCP, Cloudflare) must be notified in accordance with their respective penetration testing notification policies where applicable.',
      ],
      complianceTags: ['NIST SP 800-115', 'FedRAMP Penetration Testing Guidance', 'NIST SP 800-53 Rev 5 CA-8'],
    },
    {
      id: 'roe-ot-protection',
      number: 'ROE 2.0',
      title: 'Critical Infrastructure & Life-Safety Exclusions',
      summary: 'Strict safeguards protecting OT, medical, and flight-control networks from disruptive payloads.',
      content: [
        '1. Offensive payloads containing denial-of-service (DoS) vectors, excessive bandwidth consumption, or unconstrained buffer flooding are strictly prohibited on live production networks.',
        '2. Industrial Control Systems (ICS/SCADA) and medical IoT devices must be marked as OUT-OF-BOUNDS for active exploit payloads unless isolated inside a certified hardware-in-the-loop testbed.',
      ],
      complianceTags: ['ISA/IEC 62443', 'NERC CIP-008-6', 'NIST SP 800-82 Rev 3'],
    },
    {
      id: 'roe-audit-logging',
      number: 'ROE 3.0',
      title: 'Full Audit Logging & Attack Traceability',
      summary: 'Every offensive scan, query, and tool execution is immutably logged with operator credentials and timestamps.',
      content: [
        '1. All recon jobs executed via Errow, BBOT, or custom scripts log target URI, source IP, authenticated operator username, and tool parameters to the immutable CS3 audit log.',
        '2. In the event of an anomalous system event during a test window, operators must immediately consult the Audit Trail to correlate activity timestamps.',
      ],
      complianceTags: ['NIST SP 800-53 Rev 5 AU-2/AU-3/AU-12', 'NIST SP 800-171 Rev 3 03.03.01'],
    },
  ],
};

export const NIST_800_53_REV5_GOVERNANCE: LegalDocument = {
  id: 'nist-800-53-rev5',
  title: 'CECUR-IT, Inc. — NIST SP 800-53 Rev 5 Security & Privacy Controls Baseline',
  subtitle: 'Federal Baseline, 20 Control Families, RMF Authorization & Continuous Monitoring (ConMon)',
  lastUpdated: 'September 2026',
  version: 'Rev 5 (Final Release)',
  badge: 'Federal Level 4 Baseline',
  overview:
    'NIST Special Publication 800-53 Revision 5 ("Security and Privacy Controls for Information Systems and Organizations") provides a comprehensive catalog of security and privacy controls to protect organizational operations and assets against diverse cyber threats. CECUR-IT CS3 natively implements, enforces, and continuously verifies these controls across all 20 control families.',
  sections: [
    {
      id: 'nist53-ac',
      number: 'Family 1.0 (AC)',
      title: 'Access Control (AC) Architecture',
      summary: 'Server-side RBAC enforcement, least privilege, session lockouts, and remote access boundaries.',
      content: [
        'AC-2 Account Management: Automated provisioning, role-gating (Analyst, Admin, Auditor, Executive), and real-time credential revocation.',
        'AC-3 Access Enforcement: Strict server-side route guards on all /api/* endpoints. Client-side UI gating is backed by unbypassable 403 Forbidden server validation.',
        'AC-6 Least Privilege: Operators are granted explicit clearances strictly aligned with their operational duties.',
        'AC-7 Unsuccessful Logon Attempts: Enforces account lockouts after 5 consecutive failed authentication attempts within 5 minutes.',
        'AC-11 Device Lock & AC-12 Session Termination: Idle operator sessions automatically lock after 15 minutes of inactivity.',
        'AC-17 Remote Access: Mandatory TLS 1.3 encryption and mutual certificate authentication (mTLS) for all distributed sensor probes.',
      ],
      complianceTags: ['NIST SP 800-53 AC-2', 'NIST SP 800-53 AC-3', 'NIST SP 800-53 AC-6', 'NIST SP 800-53 AC-7'],
    },
    {
      id: 'nist53-au',
      number: 'Family 2.0 (AU)',
      title: 'Audit & Accountability (AU) Ledger',
      summary: 'Cryptographic SHA-256 chain-hashing, non-repudiation, tamper-evident audit trails, and log review.',
      content: [
        'AU-2 Event Logging: Comprehensive ingestion of system events, authentication attempts, panel clearances, and admin actions.',
        'AU-3 Content of Audit Records: Each log entry records precise UTC timestamp, actor ID, username, role, source IP address, target resource, action executed, and status.',
        'AU-6 Audit Record Review, Analysis, and Reporting: Automated correlation of SIEM alerts, anomaly detection, and rapid auditor export capabilities.',
        'AU-9 Protection of Audit Information & AU-10 Non-Repudiation: Audit trail utilizes SHA-256 chain hashes to prevent retroactive tampering or unauthorized modification.',
      ],
      complianceTags: ['NIST SP 800-53 AU-2', 'NIST SP 800-53 AU-3', 'NIST SP 800-53 AU-6', 'NIST SP 800-53 AU-9', 'NIST SP 800-53 AU-10'],
    },
    {
      id: 'nist53-cm-si',
      number: 'Family 3.0 (CM & SI)',
      title: 'Configuration Management (CM) & System/Information Integrity (SI)',
      summary: 'Automated SCA configuration baselines, File Integrity Monitoring (FIM), and vulnerability remediation.',
      content: [
        'CM-2 Baseline Configuration & CM-6 Configuration Settings: Continuous Security Configuration Assessment (SCA) benchmarked against CIS Level 1 & 2 standards.',
        'CM-8 Information System Component Inventory: Complete asset discovery, MAC/IP correlation, and 3D Asset Fusion graph tracking.',
        'SI-2 Flaw Remediation: Automated CVE vulnerability detection with CVSS v3 scoring and prioritized patching SLAs.',
        'SI-3 Malicious Code Protection & SI-4 Information System Monitoring: Real-time SIEM rule matching, behavioral anomaly detection, and host isolation.',
        'SI-7 Software, Firmware, and Information Integrity: Real-time File Integrity Monitoring (FIM) tracking SHA-256 transitions on critical system binaries (/usr/bin, System32).',
      ],
      complianceTags: ['NIST SP 800-53 CM-2', 'NIST SP 800-53 CM-8', 'NIST SP 800-53 SI-2', 'NIST SP 800-53 SI-4', 'NIST SP 800-53 SI-7'],
    },
    {
      id: 'nist53-ia-sc',
      number: 'Family 4.0 (IA & SC)',
      title: 'Identification/Authentication (IA) & System Communications Protection (SC)',
      summary: 'FIPS 140-3 cryptography, mTLS 1.3, perimeter boundary protection, and zero-trust segmentation.',
      content: [
        'IA-2 Multi-Factor Authentication: Multi-factor token verification for all administrative and auditor access channels.',
        'IA-5 Authenticator Management: Bcrypt password hashing with high salt work factors, prohibiting plaintext credential storage.',
        'SC-7 Boundary Protection: Electronic Security Perimeters (ESP), DMZ micro-segmentation, and unidirectional air-gap diode integrations.',
        'SC-8 Transmission Confidentiality & SC-13 Cryptographic Protection: Enforced FIPS 140-3 validated cryptographic suites (AES-256-GCM, TLS 1.3).',
        'SC-28 Protection of Information at Rest: AES-256 encryption across all persistent database partitions and backup archives.',
      ],
      complianceTags: ['NIST SP 800-53 IA-2', 'NIST SP 800-53 IA-5', 'NIST SP 800-53 SC-7', 'NIST SP 800-53 SC-8', 'NIST SP 800-53 SC-13'],
    },
    {
      id: 'nist53-ir-rmf',
      number: 'Family 5.0 (IR & RMF)',
      title: 'Incident Response (IR) & Risk Management Framework (RMF)',
      summary: 'Automated playbooks, root-cause correlation, and continuous authorization (ConMon) lifecycle.',
      content: [
        'IR-4 Incident Handling: Guided step-by-step containment playbooks with assigned response leads and timeline tracking.',
        'IR-5 Incident Monitoring & IR-6 Incident Reporting: Continuous correlation of endpoint indicators and rapid regulatory notification exports.',
        'RMF 6-Step Continuous Monitoring: Categorize (FIPS 199), Select Controls, Implement, Assess, Authorize (ATO), and Continuously Monitor (ConMon).',
      ],
      complianceTags: ['NIST SP 800-53 IR-4', 'NIST SP 800-53 IR-6', 'NIST RMF SP 800-37 Rev 2'],
    },
  ],
};

export const NIST_800_171_REV3_SPEC: LegalDocument = {
  id: 'nist-800-171-rev3',
  title: 'CECUR-IT, Inc. — NIST SP 800-171 Rev 3 CUI Protection & CMMC 2.0/3.0 Governance',
  subtitle: 'Protecting Controlled Unclassified Information in Nonfederal Systems & Defense Industrial Base Enclaves',
  lastUpdated: 'September 2026',
  version: 'Rev 3 (Final Release)',
  badge: 'CUI / CMMC Level 2 & 3',
  overview:
    'NIST Special Publication 800-171 Revision 3 ("Protecting Controlled Unclassified Information in Nonfederal Systems and Organizations") establishes the security requirements for protecting the confidentiality of CUI when processed, stored, or transmitted on nonfederal information systems. CECUR-IT CS3 provides automated continuous compliance monitoring, DoD SPRS score tracking (110-point baseline), and CUI enclave isolation for defense contractors and commercial suppliers.',
  sections: [
    {
      id: 'cui-enclave-boundaries',
      number: 'Section 1.0',
      title: 'CUI Enclave Scoping & Architectural Isolation',
      summary: 'Physical and logical segregation of CUI assets, preventing split tunneling, and cryptographic boundary defense.',
      content: [
        '1.1 Enclave Boundary Definition: All assets processing or storing Controlled Unclassified Information (CUI / CTI) are encapsulated within dedicated network segments with zero-trust ingress/egress filtering.',
        '1.2 Prevention of Split Tunneling (03.13.07): Remote access connections to CUI enclaves are strictly routed through encrypted VPN/mTLS tunnels; simultaneous split routing to non-secure networks is blocked at the kernel level.',
        '1.3 FIPS 140-3 Cryptographic Core (03.13.08): All CUI transmitted across public or internal boundaries is protected using FIPS-validated cryptographic modules (AES-256-GCM).',
      ],
      complianceTags: ['NIST SP 800-171 Rev 3 03.13.01', '03.13.07', '03.13.08', 'DFARS 252.204-7012'],
    },
    {
      id: 'cui-access-audit',
      number: 'Section 2.0',
      title: 'Access Control (03.01) & Audit Accountability (03.03)',
      summary: 'Least privilege, dual-role separation, session termination, and non-repudiable audit logging for CUI transactions.',
      content: [
        '2.1 Authorized User Account Control (03.01.01): System access is limited exclusively to authorized operators with valid CUI clearances.',
        '2.2 Separation of Duties (03.01.03): Administrative duties, audit log management, and offensive security functions are strictly segregated across distinct roles.',
        '2.3 Least Privilege & Privileged Function Control (03.01.07): Non-privileged user accounts are prohibited from executing privileged system commands.',
        '2.4 Inactivity Session Lockouts (03.01.10): Endpoints handling CUI automatically lock the screen after 15 minutes of inactivity requiring re-authentication.',
        '2.5 Audit Record Generation & Retention (03.03.01 / 03.03.02): All CUI read, write, export, and administrative modifications are logged to a tamper-evident SHA-256 ledger.',
      ],
      complianceTags: ['NIST SP 800-171 Rev 3 03.01.01', '03.01.03', '03.01.07', '03.01.10', '03.03.01', '03.03.02'],
    },
    {
      id: 'cui-incident-reporting',
      number: 'Section 3.0',
      title: 'Incident Response & DFARS 252.204-7012 72-Hour Rapid Reporting',
      summary: 'Mandatory CUI cyber incident handling, evidence preservation, and DoD 72-hour reporting SLA.',
      content: [
        '3.1 Cyber Incident Handling & Containment (03.06.01): Automated SIEM correlation and incident tracking workflows to rapidly identify, contain, and remediate CUI exposure.',
        '3.2 DFARS 72-Hour Rapid Notification Mandate: In the event of confirmed or suspected CUI compromise, CS3 generates a standardized DIBNet cyber incident package within 72 hours for reporting to the DoD Cyber Crime Center (DC3).',
        '3.3 Forensic Image Preservation: System state and memory dumps are captured and preserved in write-once audit storage for forensic validation.',
      ],
      complianceTags: ['NIST SP 800-171 Rev 3 03.06.01', '03.06.02', 'DFARS 252.204-7012 (c)'],
    },
    {
      id: 'cui-sprs-poam',
      number: 'Section 4.0',
      title: 'DoD SPRS Score Tracking & Plan of Action and Milestones (POA&M)',
      summary: 'Real-time Supplier Performance Risk System (SPRS) scoring out of 110 points and automated POA&M tracking.',
      content: [
        '4.1 SPRS Score Calculation: CS3 automatically computes your DoD SPRS score based on the 110 NIST SP 800-171 assessment controls (deducting 5, 3, or 1 point for unmet requirements).',
        '4.2 Continuous POA&M Management (03.12.02): All identified security deficiencies are cataloged into an interactive Plan of Action and Milestones with scheduled completion dates, designated risk ratings, and assigned engineering leads.',
        '4.3 CMMC 2.0 / 3.0 Level 2 Certification Readiness: Meets all 110 practices for CMMC Level 2 (Advanced) third-party assessment (C3PAO).',
      ],
      complianceTags: ['NIST SP 800-171 Rev 3 03.12.01', '03.12.02', 'DoD Assessment Methodology', 'CMMC 2.0 Level 2'],
    },
    {
      id: 'cui-media-integrity',
      number: 'Section 5.0',
      title: 'Media Protection (03.08) & System/Information Integrity (03.14)',
      summary: 'Cryptographic marking, NIST SP 800-88 sanitization, FIM integrity checking, and flaw remediation.',
      content: [
        '5.1 Cryptographic Media Marking & Sanitization (03.08.01 / 03.08.03): All digital media containing CUI is marked with cryptographic tags; decommissioned media is sanitized in compliance with NIST SP 800-88 Rev 1.',
        '5.2 File Integrity Monitoring for CUI Repositories (03.14.06): Real-time FIM alerts on unauthorized file modifications, permission shifts, or unexpected hash changes within CUI directories.',
        '5.3 Malicious Code Protection (03.14.02): Continuous scanning and signature updating across all host endpoints, virtual workloads, and container runtimes.',
      ],
      complianceTags: ['NIST SP 800-171 Rev 3 03.08.01', '03.08.03', '03.14.02', '03.14.06', 'NIST SP 800-88 Rev 1'],
    },
  ],
};

export const SECURITY_PORTAL_DATA = {
  id: 'security-portal',
  title: 'CECUR-IT, Inc. — Security, Governance & Compliance Enclave',
  subtitle: 'Federal, DoD, FinTech, and Critical Infrastructure Framework Alignment',
  certifications: [
    {
      code: 'NIST SP 800-53 Rev 5',
      authority: 'NIST / U.S. Dept of Commerce',
      status: 'Continuous Level 4 Validation (91.4%)',
      badge: 'Federal Baseline',
      color: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20',
      description: 'Comprehensive implementation of 20 Control Families: Access Control (AC), Audit & Accountability (AU), Identification & Authentication (IA), System & Communications Protection (SC), and System & Information Integrity (SI).',
    },
    {
      code: 'NIST SP 800-171 Rev 3 / CMMC',
      authority: 'NIST / DoD Defense Industrial Base',
      status: 'SPRS Score: 104 / 110 (CMMC Level 2 Ready)',
      badge: 'CUI Enclave Defense',
      color: 'border-amber-500/40 text-amber-400 bg-amber-950/20',
      description: '14 Requirement Families protecting Controlled Unclassified Information (CUI) in nonfederal systems, DFARS 252.204-7012 72-hour incident reporting, and continuous POA&M tracking.',
    },
    {
      code: 'FedRAMP High Baseline',
      authority: 'GSA / FedRAMP Joint Authorization Board (JAB)',
      status: 'Ready / Authorized Enclave',
      badge: 'Cloud Authorization',
      color: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20',
      description: '421+ baseline controls verified for high-impact federal government cloud deployments, multi-tenant isolation, and continuous ConMon telemetry.',
    },
    {
      code: 'DoD CC SRG IL5 / IL6',
      authority: 'Defense Information Systems Agency (DISA)',
      status: 'Air-Gapped & Secret Enclave Ready',
      badge: 'Defense Enclave',
      color: 'border-amber-500/40 text-amber-400 bg-amber-950/20',
      description: 'Controlled Unclassified Information (CUI), National Security Systems (NSS), and Classified Enclave protection using unidirectional physical diodes and FIPS 140-3 cryptography.',
    },
    {
      code: 'NERC CIP Standards',
      authority: 'North American Electric Reliability Corp. / FERC',
      status: 'High-Impact Substation Certified',
      badge: 'Energy Grid Defense',
      color: 'border-purple-500/40 text-purple-400 bg-purple-950/20',
      description: 'NERC CIP-002 through CIP-014 compliance for critical cyber asset identification, electronic security perimeters (ESP), systems security management, and physical incident reporting.',
    },
    {
      code: 'PCI-DSS v4.0 Level 1',
      authority: 'PCI Security Standards Council',
      status: 'Compliant & Real-Time AML Telemetry (94.2%)',
      badge: 'FinTech Defense',
      color: 'border-blue-500/40 text-blue-400 bg-blue-950/20',
      description: 'Requirement 10 audit trails, continuous network segmentation testing, sub-second transaction anomaly interdiction, and tokenized zero-PAN ingestion.',
    },
    {
      code: 'SOC 2 Type II',
      authority: 'AICPA Trust Services Criteria',
      status: 'Certified (Security, Availability, Confidentiality)',
      badge: 'Annual 3PAO Audit',
      color: 'border-slate-300/40 text-slate-200 bg-slate-800/20',
      description: 'Independent third-party assessment confirming operational efficacy of internal security controls, data encryption, and employee access governance.',
    },
  ],
  cryptographicStandards: [
    { title: 'FIPS 140-3 Cryptographic Core', detail: 'All cryptographic operations execute via NIST-certified modules utilizing AES-256-GCM and SHA-384/512.' },
    { title: 'mTLS 1.3 Transport Encryption', detail: 'Zero unencrypted telemetry ingress; mandatory mutual certificate validation across all forwarder nodes.' },
    { title: 'SHA-256 Immutable Audit Ledger', detail: 'Tamper-evident chain hashing for all incident triage steps, scan executions, and administrative modifications per NIST AU-9 / 03.03.03.' },
    { title: 'Air-Gap Unidirectional Diode Relay', detail: 'Physical diode isolation for nuclear, electric utility, and flight telemetry preventing reverse packet exfiltration.' },
  ],
};
