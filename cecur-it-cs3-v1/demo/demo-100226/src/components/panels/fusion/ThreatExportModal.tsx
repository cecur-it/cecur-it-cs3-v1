import React, { useState } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  X,
  Shield,
  Layers,
  Database,
  Printer,
  Sparkles,
  Share2,
  Code,
  Table,
} from 'lucide-react';
import { FusionGraphData, ThreatExportReport, FusionGraphNode, FusionGraphLink } from '../../../types';

interface ThreatExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphData: FusionGraphData;
}

export const ThreatExportModal: React.FC<ThreatExportModalProps> = ({
  isOpen,
  onClose,
  graphData,
}) => {
  const [exportFormat, setExportFormat] = useState<'EXECUTIVE_BRIEF' | 'JSON_GRAPH' | 'CSV_LEDGER'>('EXECUTIVE_BRIEF');
  const [classification, setClassification] = useState<'TLP:AMBER' | 'TLP:RED' | 'TLP:GREEN' | 'RESTRICTED'>('TLP:AMBER');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const now = new Date();
  const reportId = `CECUR-SOC-THREAT-REPORT-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;

  // Generate Markdown / Plaintext Executive Brief
  const generateExecutiveBriefText = () => {
    const compromisedNodes = graphData.nodes.filter((n) => n.compromised);
    const criticalThreats = graphData.links.filter((l) => l.threat);

    return `# ==============================================================================
# CECUR-IT & CS3 UNIFIED SOC — EXECUTIVE THREAT INTELLIGENCE & TOPOLOGY BRIEF
# CLASSIFICATION: ${classification} // STRICT HANDLING REQUIRED
# REPORT ID: ${reportId}
# GENERATED AT: ${now.toUTCString()}
# ==============================================================================

1. SITUATION REPORT & EXECUTIVE SUMMARY
------------------------------------------------------------------------------
A high-severity lateral attack path and compromise chain has been identified and
analyzed within the Integrated CS3 Production Enclave. Asset fusion correlation
confirms active host compromise on the internal finance segment with subsequent
privilege escalation targeting primary Active Directory Domain Controllers.

Total Discovered Assets: ${graphData.nodes.length}
Compromised Nodes: ${compromisedNodes.length} (${compromisedNodes.map((n) => n.label).join(', ')})
Active Lateral Threat Vectors: ${criticalThreats.length} Hops
Calculated Network Risk Posture: 84 / 100 (HIGH RISK)
Zero-Trust Policy Coverage: 78.5%

2. CORRELATED ATTACK PATHS (MITRE ATT&CK ALIGNMENT)
------------------------------------------------------------------------------
${(graphData.attackPaths || [])
  .map(
    (p, idx) => `
[PATH ${idx + 1}] ${p.name}
- Status: ${p.status} | Severity: ${p.severity} | Ref: ${p.associatedIncidentId || 'N/A'}
- Kill Chain Stages (${p.steps.length} Steps):
${p.steps
  .map(
    (s) =>
      `  • Step ${s.stepNumber} [${s.stage}]: ${s.title}
    MITRE: ${s.mitreTechnique}
    Vector: ${s.sourceNodeId} -> ${s.targetNodeId} (${s.protocol})
    Command: ${s.payloadCommand}
    Remediation: ${s.remediationAction}`
  )
  .join('\n')}`
  )
  .join('\n\n')}

3. BLAST RADIUS & ZERO-TRUST EXPOSURE ANALYSIS
------------------------------------------------------------------------------
- Unmitigated Propagation Reach: 92% of Enclave Infrastructure
- Mitigated Propagation Reach (with Zero-Trust & Kerberos Isolation): 18%
- Asset Value at Immediate Risk: $1,450,000 USD
- Confidential Records Surface: ~28,500 PII / ePHI Data Records

4. TARGETED ASSET INVENTORY & EXPOSURE MATRIX
------------------------------------------------------------------------------
${graphData.nodes
  .map(
    (n) =>
      `• [${n.zone.padEnd(8)}] ${n.label.padEnd(26)} | IP: ${n.ip.padEnd(15)} | Status: ${n.threatLevel.padEnd(8)} | Vulns: C:${n.vulnerabilitiesCount?.critical || 0}/H:${n.vulnerabilitiesCount?.high || 0} | Quarantined: ${n.quarantined ? 'YES' : 'NO'}`
  )
  .join('\n')}

5. PRESCRIPTIVE CONTAINMENT RUNBOOK & IMMEDIATE ACTIONS
------------------------------------------------------------------------------
1. [COMPLETED] Quarantine Host WS-FIN-104 (10.100.8.44) into Isolation VLAN 999.
2. [IN PROGRESS] Sever SMB TCP 445 cross-subnet traffic links to Domain Controller.
3. [PENDING] Trigger Enterprise KRBTGT double-rotation and invalidate active TGTs.
4. [PENDING] Restrict PostgreSQL DB Vault Enclave to sanitized application pools.

==============================================================================
CONFIDENTIAL & PROPRIETARY — CECUR-IT CYBERSECURITY AUTOMATION PLATFORM
==============================================================================`;
  };

  // Generate JSON Export
  const generateJSONExport = () => {
    return JSON.stringify(
      {
        reportMetadata: {
          reportId,
          generatedAt: now.toISOString(),
          classification,
          generator: 'CECUR-IT SOC Fusion Engine v2.4.0',
          environment: 'Integrated CS3 Production Enclave',
        },
        metrics: graphData.metrics || {
          totalAssets: graphData.nodes.length,
          compromisedCount: graphData.nodes.filter((n) => n.compromised).length,
          overallNetworkRiskScore: 84,
        },
        nodes: graphData.nodes,
        links: graphData.links,
        attackPaths: graphData.attackPaths || [],
      },
      null,
      2
    );
  };

  // Generate CSV Ledger
  const generateCSVExport = () => {
    const headers = [
      'Asset ID',
      'Hostname',
      'Type',
      'IP Address',
      'Security Zone',
      'Threat Level',
      'Compromised',
      'Quarantined',
      'Criticality',
      'Asset Value (USD)',
      'OS',
      'Critical Vulns',
      'High Vulns',
      'Active Alerts',
      'Compliance Tags',
    ];

    const rows = graphData.nodes.map((n) => [
      `"${n.id}"`,
      `"${n.label}"`,
      `"${n.type}"`,
      `"${n.ip}"`,
      `"${n.zone}"`,
      `"${n.threatLevel}"`,
      `"${n.compromised ? 'TRUE' : 'FALSE'}"`,
      `"${n.quarantined ? 'TRUE' : 'FALSE'}"`,
      `"${n.criticality || 'TIER_2_MEDIUM'}"`,
      `"${n.assetValueUSD || 350000}"`,
      `"${n.os || 'Linux/Windows'}"`,
      n.vulnerabilitiesCount?.critical || 0,
      n.vulnerabilitiesCount?.high || 0,
      n.activeAlertsCount || 0,
      `"${(n.complianceTags || []).join('; ')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  };

  const getExportContent = () => {
    switch (exportFormat) {
      case 'JSON_GRAPH':
        return generateJSONExport();
      case 'CSV_LEDGER':
        return generateCSVExport();
      case 'EXECUTIVE_BRIEF':
      default:
        return generateExecutiveBriefText();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownload = () => {
    const content = getExportContent();
    let extension = 'txt';
    let mimeType = 'text/plain';

    if (exportFormat === 'JSON_GRAPH') {
      extension = 'json';
      mimeType = 'application/json';
    } else if (exportFormat === 'CSV_LEDGER') {
      extension = 'csv';
      mimeType = 'text/csv';
    } else {
      extension = 'md';
      mimeType = 'text/markdown';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportId}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${reportId}</title>
            <style>
              body { font-family: monospace; padding: 24px; background: #fff; color: #000; white-space: pre-wrap; font-size: 12px; line-height: 1.4; }
            </style>
          </head>
          <body>${generateExecutiveBriefText()}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <div id="threat-export-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        id="threat-export-modal"
        className="bg-[#111318] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/90 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#151821]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">Export Threat Analysis & Topology Insights</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {classification}
                </span>
              </div>
              <p className="text-xs text-slate-400">Export structured SOC threat intelligence, kill-chain timelines, & asset risk ledgers</p>
            </div>
          </div>

          <button
            id="close-export-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#161922] border-b border-slate-800">
          {/* Format Tabs */}
          <div className="flex items-center gap-1.5 bg-[#0E1015] p-1 rounded-xl border border-slate-800">
            <button
              id="export-tab-brief"
              onClick={() => setExportFormat('EXECUTIVE_BRIEF')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                exportFormat === 'EXECUTIVE_BRIEF'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Executive Intelligence Brief</span>
            </button>

            <button
              id="export-tab-json"
              onClick={() => setExportFormat('JSON_GRAPH')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                exportFormat === 'JSON_GRAPH'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="w-3.5 h-3.5 text-amber-400" />
              <span>JSON Graph Spec</span>
            </button>

            <button
              id="export-tab-csv"
              onClick={() => setExportFormat('CSV_LEDGER')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                exportFormat === 'CSV_LEDGER'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV Asset Risk Ledger</span>
            </button>
          </div>

          {/* Classification Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Handling:</span>
            <select
              id="export-classification-select"
              value={classification}
              onChange={(e: any) => setClassification(e.target.value)}
              className="text-xs bg-[#1A1D24] border border-slate-700/80 text-white rounded-lg px-2.5 py-1.5 outline-none font-mono font-bold focus:border-[#00E5FF]"
            >
              <option value="TLP:AMBER">TLP:AMBER (Restricted Org)</option>
              <option value="TLP:RED">TLP:RED (Named Recipients Only)</option>
              <option value="TLP:GREEN">TLP:GREEN (Community Share)</option>
              <option value="RESTRICTED">RESTRICTED (SOC Internal)</option>
            </select>
          </div>
        </div>

        {/* Document Preview Pane */}
        <div className="flex-1 p-4 overflow-y-auto bg-[#0A0B0E] font-mono text-xs text-slate-300">
          <pre className="whitespace-pre-wrap leading-relaxed select-all">
            {getExportContent()}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-800 bg-[#151821]">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-[#00E5FF]" />
            <span>Ready for SIEM, SOAR, Executive PDF, or GRC Compliance Audit.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="export-print-btn"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              id="export-copy-clipboard-btn"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Content</span>
                </>
              )}
            </button>

            <button
              id="export-download-file-btn"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#00E5FF] hover:bg-[#00cce6] text-black text-xs font-bold transition-all shadow-md shadow-[#00E5FF]/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
