export interface PricingTier {
  id: string;
  name: string;
  priceMonthly: number;
  priceDisplay: string;
  scope: string;
  popular?: boolean;
  aiCreditsMonthly: number; // 0 for Tier 1, 10000 for Tier 2, 50000 for Tier 3
  aiCreditsDisplay: string;
  badge: string;
  badgeColor: string;
  description: string;
  features: string[];
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'tier-1',
    name: 'DEFENSE ESSENTIALS',
    priceMonthly: 2800,
    priceDisplay: '$2,800 / mo',
    scope: 'Up to 250 Endpoints',
    aiCreditsMonthly: 0,
    aiCreditsDisplay: 'Baseline / Metered',
    badge: 'TIER 1',
    badgeColor: 'border-[#1A3959] text-[#94A3B8] bg-[#12283E]',
    description: 'Core SIEM log aggregation and physical CS3 network tap monitoring for targeted infrastructure fleets.',
    features: [
      'SIEM + CS3 Sensor Taps',
      'Read-Only Incident Queue',
      '30-Day Hot Data Retention',
    ],
  },
  {
    id: 'tier-2',
    name: 'ADVANCED ENTERPRISE XDR',
    priceMonthly: 6500,
    priceDisplay: '$6,500 / mo',
    scope: 'Up to 1,000 Endpoints',
    popular: true,
    aiCreditsMonthly: 10000,
    aiCreditsDisplay: '10,000 AI Fuel Credits/mo',
    badge: 'TIER 2 • RECOMMENDED',
    badgeColor: 'border-[#00E5FF]/40 text-[#00E5FF] bg-[#00E5FF]/10',
    description: 'Unified cross-domain threat defense with insider risk tracking and automated AI Copilot incident triage.',
    features: [
      'Includes Tier 1 + ActivTrak Insider Risk',
      'Asset Fusion Blast Radius Topology',
      'CS3 Agent Copilot (10k AI Fuel Credits/mo)',
      '90-Day Retention + SOAR Playbooks',
    ],
  },
  {
    id: 'tier-3',
    name: 'CRITICAL INFRASTRUCTURE',
    priceMonthly: 14500,
    priceDisplay: '$14,500 / mo',
    scope: 'Up to 5,000 Endpoints',
    aiCreditsMonthly: 50000,
    aiCreditsDisplay: '50,000 AI Fuel Credits/mo',
    badge: 'TIER 3 • SOVEREIGN',
    badgeColor: 'border-[#0A84FF]/40 text-[#BAE3FF] bg-[#0A84FF]/15',
    description: 'Mission-critical defense featuring allowlist-gated offensive recon and dual-engine (CS3 Agent + CECUR-IT Agent) consensus.',
    features: [
      'Includes Tier 2 + errow Offensive Recon',
      'CS3-AI Dual Engine (CS3 Agent + CECUR-IT Agent) - 50,000 Credits/mo',
      'Full GRC Compliance Attestation Engine',
      '365-Day BigQuery Immutable Cold Retention',
    ],
  },
];

export const AI_METERING_CONFIG = {
  overageRatePerTx: 0.05, // $0.05 per overage transaction
  annualRetainerDiscount: 0.20, // 20% discount on prepaid AI fuel packs for annual commitment
  unitDefinition: '1 Unit = 1 Incident Triage or 1 Remediation Script Generation',
  tier2IncludedQuota: 10000,
  tier3IncludedQuota: 50000,
};

export interface UnitCostItem {
  component: string;
  scale: string;
  providerUnitCost: string;
  optimizationStrategy: string;
}

export const UNIT_COST_ANALYSIS: UnitCostItem[] = [
  {
    component: 'CS3 Cloud Security Database',
    scale: '50M document reads, 10M writes / month',
    providerUnitCost: '≈ $20--$45 / tenant/mo',
    optimizationStrategy: 'Use in-memory worker caches for DHCP lease resolutions; write only normalized incident states to database.',
  },
  {
    component: 'CS3 Cloud Application Service (API Backend)',
    scale: '4 vCPU, 8 GB RAM containerized workers',
    providerUnitCost: '≈ $35--$70 / month',
    optimizationStrategy: 'Stateless horizontal scaling with zero minimum instances during low-traffic windows.',
  },
  {
    component: 'AI Fueling: CS3 Agent',
    scale: '10M input tokens, 2M output tokens / month',
    providerUnitCost: '≈ $2.50--$7.00 / tenant/mo',
    optimizationStrategy: 'Enforce strict JSON output schemas with low temperature (0.2) and prompt context caching.',
  },
  {
    component: 'AI Fueling: CECUR-IT Agent',
    scale: 'Secondary fallback / deep code auditing (2M tokens)',
    providerUnitCost: '≈ $1.00--$2.50 / tenant/mo',
    optimizationStrategy: 'Route simple alert summaries to CS3 Agent; reserve CECUR-IT Agent for complex multi-file scripts.',
  },
  {
    component: 'BigQuery / Cold Storage',
    scale: '1 TB historical logs / month',
    providerUnitCost: '≈ $20--$30 / month',
    optimizationStrategy: 'Daily partitioning with 90-day automatic transition to Coldline Cloud Storage.',
  },
];

export interface RBACMatrixRow {
  panelAction: string;
  analyst: string;
  admin: string;
  auditor: string;
  executive: string;
}

export const RBAC_ACCESS_MATRIX: RBACMatrixRow[] = [
  {
    panelAction: 'Overview Dashboard (overview)',
    analyst: 'Allowed',
    admin: 'Allowed',
    auditor: 'Allowed',
    executive: 'Allowed',
  },
  {
    panelAction: 'SIEM / SOAR Incidents (incidents)',
    analyst: 'Full Read/Write',
    admin: 'Full Read/Write',
    auditor: 'Read-Only',
    executive: 'Read-Only',
  },
  {
    panelAction: 'Cecur SIEM/XDR Core (cecur)',
    analyst: 'Full Access',
    admin: 'Full Access',
    auditor: 'Read-Only',
    executive: 'Denied (HTTP 403)',
  },
  {
    panelAction: 'ActivTrak Insider Risk (activtrak)',
    analyst: 'Full Access',
    admin: 'Full Access',
    auditor: 'Read-Only',
    executive: 'Denied (HTTP 403)',
  },
  {
    panelAction: 'CS3 Sensor Grid (sensors)',
    analyst: 'Calibrate / View',
    admin: 'Full Admin / Reboot',
    auditor: 'Read-Only',
    executive: 'Denied (HTTP 403)',
  },
  {
    panelAction: 'Asset Fusion 3D Graph (fusion)',
    analyst: 'Allowed',
    admin: 'Allowed',
    auditor: 'Denied (HTTP 403)',
    executive: 'Denied (HTTP 403)',
  },
  {
    panelAction: 'errow Offensive Recon (errow)',
    analyst: 'Denied (HTTP 403)',
    admin: 'Full Authority',
    auditor: 'Denied (HTTP 403)',
    executive: 'Denied (HTTP 403)',
  },
  {
    panelAction: 'Operational Audit Trail (audit)',
    analyst: 'View Logs',
    admin: 'Full Export',
    auditor: 'Full Export',
    executive: 'View Logs',
  },
  {
    panelAction: 'Executive CISO KPIs (executive)',
    analyst: 'Denied (HTTP 403)',
    admin: 'Full Access',
    auditor: 'Full Access',
    executive: 'Full Access',
  },
  {
    panelAction: 'DB Reseed / System Reset (reseed_db)',
    analyst: 'Denied',
    admin: 'Allowed',
    auditor: 'Denied',
    executive: 'Denied',
  },
];

export const PLATFORM_VALUE_PROPOSITION = {
  traditionalMTTD: '180 Minutes',
  cecurMTTD: '3.4 Minutes',
  mttdReduction: '98.1% reduction',
  traditionalMTTR: '4 - 12 Hours',
  cecurMTTR: '18.2 Minutes',
  valuePoints: [
    {
      title: 'Massive Reduction in Mean-Time-To-Detect (MTTD)',
      desc: 'Reductions from industry averages of ~180 minutes down to 3.4 minutes by correlating physical sensor packet anomalies directly with host-level SIEM events and insider behavior.',
    },
    {
      title: 'Accelerated Mean-Time-To-Respond (MTTR)',
      desc: 'Fast response times (18.2 minutes) through pre-orchestrated active responses, zero-trust host isolation, and auto-generated Bash/PowerShell/Ansible patch scripts.',
    },
    {
      title: 'Elimination of Multi-Vendor Alert Fatigue',
      desc: 'Operators no longer juggle separate tabs for EDR, SIEM, employee monitoring, and network sensors. Every alert is tied to a single canonical entity.',
    },
    {
      title: 'Audit-Proof Regulatory Assurance',
      desc: 'Automatic generation of compliance artifacts for PCI-DSS v4.0, HIPAA, GDPR, and NIST 800-53 Rev 5 eliminates weeks of manual audit preparation.',
    },
  ],
};
