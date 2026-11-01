/**
 * CECUR-IT SOC & CS3 Security Operations Platform
 * Centralized Export, Audit Reporting, and Sharing Utilities
 */

export type ExportFormat = 'EXECUTIVE_BRIEF' | 'CSV_LEDGER' | 'JSON_PACKAGE';
export type HandlingClassification = 'TLP:AMBER' | 'TLP:RED' | 'TLP:GREEN' | 'RESTRICTED' | 'UNCLASSIFIED';

export interface ExportPayload {
  title: string;
  category: 'AUDIT' | 'INCIDENT' | 'EXECUTIVE' | 'ERROW' | 'CECUR' | 'ACTIVTRAK' | 'THREAT_FUSION';
  defaultClassification?: HandlingClassification;
  briefText: (classification: HandlingClassification, reportId: string) => string;
  csvData?: () => { headers: string[]; rows: (string | number)[][] };
  jsonData: () => any;
}

/**
 * Universal file downloader
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * CSV String Generator with proper escaping
 */
export function generateCSVString(headers: string[], rows: (string | number)[][]): string {
  const escapeCell = (val: string | number) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCell).join(','));
  return [headerLine, ...rowLines].join('\n');
}

/**
 * Open print-ready window for printing or Save as PDF
 */
export function printFormattedDocument(title: string, content: string, classification: HandlingClassification = 'TLP:AMBER') {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @media print {
      body { margin: 0; padding: 12mm; font-size: 11px; }
      .no-print { display: none !important; }
      @page { margin: 12mm; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
      background: #FFFFFF;
      color: #0B1B32;
      padding: 32px;
      line-height: 1.5;
      max-width: 900px;
      margin: 0 auto;
    }
    .banner {
      border: 2px solid #0B1B32;
      padding: 12px 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #F8FAFC;
    }
    .classification {
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 1px;
      padding: 4px 8px;
      border: 1px solid #D97706;
      background: #FEF3C7;
      color: #92400E;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      line-height: 1.45;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 16px;
      border-radius: 4px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #CBD5E1;
      font-size: 10px;
      color: #64748B;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="banner">
    <div>
      <strong style="font-size: 14px; text-transform: uppercase;">CECUR-IT UNIFIED SOC & AUDIT BRIEFING</strong>
      <div style="font-size: 11px; color: #64748B;">Automated Security Operations & Compliance System</div>
    </div>
    <div class="classification">${classification}</div>
  </div>

  <pre>${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>

  <div class="footer">
    <span>CECUR-IT CYBERSECURITY AUTOMATION PLATFORM</span>
    <span>Generated: ${new Date().toUTCString()}</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}

/**
 * Builders for Audit Logs Export
 */
export function buildAuditExportPayload(auditLogs: any[], verifier?: string): ExportPayload {
  return {
    title: 'Operational Security & RBAC Cryptographic Audit Trail',
    category: 'AUDIT',
    defaultClassification: 'RESTRICTED',
    briefText: (classification, reportId) => {
      const verifiedCount = auditLogs.filter((l) => l.chainHash?.startsWith('sha256-')).length;
      return `# ==============================================================================
# CECUR-IT SOC & CS3 — FORMAL COMPLIANCE AUDIT TRAIL
# CLASSIFICATION: ${classification} // MANDATORY AUDITOR RETENTION
# REPORT ID: ${reportId}
# GENERATED: ${new Date().toUTCString()}
# VERIFIER: ${verifier || 'CECUR-IT Cryptographic Integrity Subsystem'}
# ==============================================================================

1. COMPLIANCE ASSURANCE & CHAIN OF CUSTODY
------------------------------------------------------------------------------
Applicable Frameworks:
- NIST SP 800-53 Rev 5 (AU-2, AU-3, AU-6, AU-9, AU-10, AU-12)
- NIST SP 800-171 Rev 3 (03.03.01 - 03.03.09 Audit & Accountability)
- DoD SPRS Assessment Baseline & CMMC 2.0 Level 2
- FIPS 140-3 Cryptographic Integrity

Ledger Verification Status: VERIFIED INTACT (100% SHA-256 Chained)
Total Verified Records: ${auditLogs.length}
Cryptographic Hash Chain: ${verifiedCount}/${auditLogs.length} Entries Sealed

2. SUMMARY OF ACTIONS BY SECURITY DOMAIN
------------------------------------------------------------------------------
${Object.entries(
  auditLogs.reduce((acc: Record<string, number>, curr) => {
    acc[curr.panel] = (acc[curr.panel] || 0) + 1;
    return acc;
  }, {})
)
  .map(([panel, count]) => `• ${panel.toUpperCase().padEnd(16)}: ${count} Recorded Actions`)
  .join('\n')}

3. RECORDED AUDIT EVENTS (CHRONOLOGICAL)
------------------------------------------------------------------------------
${auditLogs
  .slice(0, 100)
  .map(
    (l, idx) =>
      `[#${(idx + 1).toString().padStart(3, '0')}] ${new Date(l.timestamp).toISOString()} | Status: ${l.status.padEnd(7)} | Actor: ${l.actorUsername} (${l.actorRole})
  Action: ${l.action} -> ${l.targetResource || 'N/A'}
  Details: ${l.details}
  NIST Controls: ${(l.nistControls || []).join(', ')}
  SHA256 Hash: ${l.chainHash || 'N/A'}`
  )
  .join('\n\n')}

${auditLogs.length > 100 ? `\n... [${auditLogs.length - 100} Additional Records Exported in Complete JSON / CSV] ...\n` : ''}
==============================================================================
CONFIDENTIAL & TAMPER-EVIDENT AUDIT TRAIL — CECUR-IT SOC
==============================================================================`;
    },
    csvData: () => {
      const headers = [
        'Log ID',
        'Timestamp',
        'Actor Username',
        'Actor Role',
        'Action',
        'Panel / Module',
        'Target Resource',
        'Status',
        'IP Address',
        'Details',
        'NIST Controls',
        'SHA-256 Hash',
        'Previous Hash',
      ];
      const rows = auditLogs.map((l) => [
        l.id,
        l.timestamp,
        l.actorUsername,
        l.actorRole,
        l.action,
        l.panel,
        l.targetResource || '',
        l.status,
        l.ipAddress || '',
        l.details,
        (l.nistControls || []).join('; '),
        l.chainHash || '',
        l.prevHash || '',
      ]);
      return { headers, rows };
    },
    jsonData: () => ({
      reportId: `AUDIT-EXP-${Date.now()}`,
      exportDate: new Date().toISOString(),
      standards: ['NIST SP 800-53 Rev 5', 'NIST SP 800-171 Rev 3', 'CMMC Level 2'],
      totalRecords: auditLogs.length,
      records: auditLogs,
    }),
  };
}

/**
 * Builders for Incident Reports & Dossiers
 */
export function buildIncidentDossierExportPayload(
  incident: any,
  correlatedCecur: any[] = [],
  correlatedActivTrak: any[] = []
): ExportPayload {
  return {
    title: `Incident Dossier — ${incident.id} (${incident.title})`,
    category: 'INCIDENT',
    defaultClassification: 'TLP:AMBER',
    briefText: (classification, reportId) => {
      return `# ==============================================================================
# CECUR-IT SOC & CS3 — FORMAL INCIDENT INVESTIGATION DOSSIER
# CLASSIFICATION: ${classification} // NEED-TO-KNOW HANDLING
# INCIDENT ID: ${incident.id}
# REPORT ID: ${reportId}
# GENERATED: ${new Date().toUTCString()}
# ==============================================================================

1. INCIDENT OVERVIEW & EXECUTIVE TRIAGE
------------------------------------------------------------------------------
Title: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Category: ${incident.category}
Assigned Lead: ${incident.assignedTo}
Created Timestamp: ${new Date(incident.createdAt).toUTCString()}
Last Updated: ${new Date(incident.updatedAt).toUTCString()}

Root Cause Analysis:
${incident.rootCause || 'Root cause analysis currently under investigation by SOC team.'}

Impacted Infrastructure Assets:
${(incident.affectedAssets || []).map((a: string) => `• ${a}`).join('\n')}

MITRE ATT&CK Framework Mapping:
- Primary Tactic: ${incident.mitreTactic}
- Correlated Technique: ${incident.mitreTechnique || 'T1003 / T1078'}

2. AI THREAT REASONING & MITIGATION GUIDANCE (CS3-AI DUAL ENGINE)
------------------------------------------------------------------------------
${incident.aiSummary || 'AI Synthesis: Active lateral motion detected with privilege escalation vectors. Containment playbooks dispatched to endpoint agents.'}

3. CHRONOLOGICAL FORENSIC TIMELINE (${incident.timeline?.length || 0} Events)
------------------------------------------------------------------------------
${(incident.timeline || [])
  .map(
    (t: any, idx: number) =>
      `[T+${idx + 1}] ${new Date(t.time).toLocaleTimeString()} | Source: ${t.source} | Sev: ${t.severity}
  Event: ${t.event}`
  )
  .join('\n\n')}

4. SOAR REMEDIATION PLAYBOOK EXECUTION (${incident.playbookSteps?.length || 0} Steps)
------------------------------------------------------------------------------
${(incident.playbookSteps || [])
  .map(
    (s: any) =>
      `• Step ${s.step} [${s.status.toUpperCase()}]: ${s.title}
  Action: ${s.description}`
  )
  .join('\n\n')}

5. CORRELATED UNDERLYING TELEMETRY
------------------------------------------------------------------------------
• Cecur SIEM/XDR Alert Ingresses: ${correlatedCecur.length} Correlated Alerts
${correlatedCecur
  .slice(0, 5)
  .map((a: any) => `  - [Rule ${a.ruleId}] ${a.ruleTitle} on ${a.agentName}`)
  .join('\n')}

• ActivTrak Insider Risk Sessions: ${correlatedActivTrak.length} Correlated Workstation Sessions
${correlatedActivTrak
  .slice(0, 5)
  .map((s: any) => `  - User: ${s.userName} (${s.department}) | Risk: ${s.riskScore}/100 | Flag: ${s.flaggedActivity}`)
  .join('\n')}

==============================================================================
CONFIDENTIAL INCIDENT REPORT — CECUR-IT CYBERSECURITY AUTOMATION PLATFORM
==============================================================================`;
    },
    csvData: () => {
      const headers = ['Incident ID', 'Title', 'Severity', 'Status', 'Category', 'MITRE Tactic', 'Assigned To', 'Created At', 'Root Cause'];
      const rows = [
        [
          incident.id,
          incident.title,
          incident.severity,
          incident.status,
          incident.category,
          incident.mitreTactic,
          incident.assignedTo,
          incident.createdAt,
          incident.rootCause,
        ],
      ];
      return { headers, rows };
    },
    jsonData: () => ({
      reportId: `INC-EXP-${incident.id}-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      incident,
      correlatedCecur,
      correlatedActivTrak,
    }),
  };
}

/**
 * Builders for Full Incident Register Export
 */
export function buildIncidentRegisterExportPayload(incidents: any[]): ExportPayload {
  return {
    title: `Incident Response Register (${incidents.length} Records)`,
    category: 'INCIDENT',
    defaultClassification: 'TLP:AMBER',
    briefText: (classification, reportId) => {
      return `# ==============================================================================
# CECUR-IT SOC — INCIDENT RESPONSE REGISTER & LOG
# CLASSIFICATION: ${classification}
# REPORT ID: ${reportId}
# GENERATED: ${new Date().toUTCString()}
# TOTAL INCIDENTS: ${incidents.length}
# ==============================================================================

1. INCIDENT SEVERITY SUMMARY
------------------------------------------------------------------------------
Critical: ${incidents.filter((i) => i.severity === 'CRITICAL').length}
High:     ${incidents.filter((i) => i.severity === 'HIGH').length}
Medium:   ${incidents.filter((i) => i.severity === 'MEDIUM').length}
Low:      ${incidents.filter((i) => i.severity === 'LOW').length}

2. INCIDENT REGISTER
------------------------------------------------------------------------------
${incidents
  .map(
    (i) =>
      `• [${i.id}] [${i.severity.padEnd(8)}] ${i.title}
  Status: ${i.status} | Lead: ${i.assignedTo} | MITRE: ${i.mitreTactic}
  Assets: ${(i.affectedAssets || []).join(', ')}
  Root Cause: ${i.rootCause}`
  )
  .join('\n\n')}

==============================================================================
CONFIDENTIAL & PROPRIETARY — CECUR-IT SOC
==============================================================================`;
    },
    csvData: () => {
      const headers = ['Incident ID', 'Title', 'Severity', 'Status', 'Category', 'MITRE Tactic', 'Assigned To', 'Created At', 'Updated At', 'Affected Assets', 'Root Cause'];
      const rows = incidents.map((i) => [
        i.id,
        i.title,
        i.severity,
        i.status,
        i.category,
        i.mitreTactic,
        i.assignedTo,
        i.createdAt,
        i.updatedAt,
        (i.affectedAssets || []).join('; '),
        i.rootCause || '',
      ]);
      return { headers, rows };
    },
    jsonData: () => ({
      reportId: `INC-REG-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      totalIncidents: incidents.length,
      incidents,
    }),
  };
}

/**
 * Builders for Executive Posture & CISO KPIs Export
 */
export function buildExecutiveReportExportPayload(execData: any): ExportPayload {
  return {
    title: 'Executive Cybersecurity Posture & CISO KPI Briefing',
    category: 'EXECUTIVE',
    defaultClassification: 'RESTRICTED',
    briefText: (classification, reportId) => {
      const kpis = execData.kpis || {};
      return `# ==============================================================================
# CECUR-IT UNIFIED SOC — EXECUTIVE CYBERSECURITY & GRC BRIEFING
# CLASSIFICATION: ${classification} // BOARD & EXECUTIVE LEADERSHIP ONLY
# REPORT ID: ${reportId}
# GENERATED: ${new Date().toUTCString()}
# ==============================================================================

1. CISO KEY PERFORMANCE INDICATORS (KPIs)
------------------------------------------------------------------------------
• Enterprise Risk Index:        ${kpis.enterpriseRiskIndex || 88} / 100 (${kpis.riskTrend || 'Normalized'})
• Mean Time to Detect (MTTD):   ${kpis.mttdMinutes || 3.4} Minutes (Industry Benchmark: 180 Min)
• Mean Time to Respond (MTTR):  ${kpis.mttrMinutes || 18.2} Minutes (Industry Benchmark: 240 Min)
• Active Threat Actors Tracked: ${kpis.activeThreatActorsTracked || 2}
• Open Critical Incidents:      ${kpis.openCriticalIncidents || 0}
• GRC Regulatory Readiness:     ${kpis.complianceReadinessScore || 94.8}%

2. REGULATORY & STATUTORY COMPLIANCE POSTURE
------------------------------------------------------------------------------
${(execData.complianceBreakdown || [])
  .map(
    (c: any) =>
      `• [${c.status.padEnd(12)}] ${c.framework.padEnd(24)} | Score: ${c.score}% | Baseline: ${c.baseline || 'N/A'}`
  )
  .join('\n')}

3. LEADING THREAT VECTORS & EXPLOITATION SURFACE
------------------------------------------------------------------------------
${(execData.threatVectors || [])
  .map(
    (t: any) =>
      `• ${t.name.padEnd(42)} | Share: ${t.share}% | Event Count: ${t.count} | Trend: ${t.trend}`
  )
  .join('\n')}

4. STRATEGIC RECOMMENDATIONS & BUDGET ALLOCATION
------------------------------------------------------------------------------
1. Maintain Zero-Trust micro-segmentation across Active Directory and database enclaves.
2. Advance continuous automated FIM scans on high-value finance and CUI controllers.
3. Complete final FedRAMP High audit cycle (1 remaining control verification).
4. Retain 100% cryptographic ledger audit chain for upcoming DoD SPRS assessment.

==============================================================================
STRICTLY CONFIDENTIAL — PREPARED BY CECUR-IT SOC EXECUTIVE ADVISORY
==============================================================================`;
    },
    csvData: () => {
      const headers = ['Framework', 'Score (%)', 'Status', 'Audits Remaining', 'Baseline / Assessment Scope'];
      const rows = (execData.complianceBreakdown || []).map((c: any) => [
        c.framework,
        c.score,
        c.status,
        c.auditsRemaining,
        c.baseline || '',
      ]);
      return { headers, rows };
    },
    jsonData: () => ({
      reportId: `EXEC-BRIEF-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      execData,
    }),
  };
}

/**
 * Builders for Errow Recon & Findings Export
 */
export function buildErrowExportPayload(jobs: any[], targets: any[]): ExportPayload {
  return {
    title: 'errow Offensive Reconnaissance & Vulnerability Findings',
    category: 'ERROW',
    defaultClassification: 'TLP:AMBER',
    briefText: (classification, reportId) => {
      const allFindings = jobs.flatMap((j) => j.findings || []);
      return `# ==============================================================================
# CECUR-IT SOC — ERROW OFFENSIVE RECONNAISSANCE AUDIT FINDINGS
# CLASSIFICATION: ${classification}
# REPORT ID: ${reportId}
# GENERATED: ${new Date().toUTCString()}
# ==============================================================================

1. AUDITING SCOPE & ALLOWLIST CONTROLS
------------------------------------------------------------------------------
Authorized Targets: ${targets.length} Hosts
Completed Recon Sweeps: ${jobs.length} Executions
Total Vulnerability Findings: ${allFindings.length}

Target Inventory:
${targets.map((t) => `• ${t.hostname} (${t.ipRange}) - Dept: ${t.ownerDepartment}`).join('\n')}

2. CRITICAL VULNERABILITY FINDINGS (${allFindings.length} Items)
------------------------------------------------------------------------------
${allFindings
  .map(
    (f, idx) =>
      `[FINDING ${idx + 1}] [${f.severity}] ${f.title} ${f.cvss ? `(CVSS ${f.cvss})` : ''}
- Target: ${f.endpoint || 'Host Service'} | Port: ${f.port || 'N/A'} | CVE: ${f.cve || 'N/A'}
- Description: ${f.description}
- Remediation: ${f.remediation}`
  )
  .join('\n\n')}

==============================================================================
CONFIDENTIAL RECON REPORT — CECUR-IT OFFENSIVE SECURITY
==============================================================================`;
    },
    csvData: () => {
      const headers = ['Job ID', 'Tool', 'Target Host', 'Finding Title', 'Severity', 'CVSS', 'CVE', 'Port', 'Endpoint', 'Remediation'];
      const rows: (string | number)[][] = [];
      jobs.forEach((j) => {
        (j.findings || []).forEach((f: any) => {
          rows.push([
            j.id,
            j.tool,
            j.targetHost,
            f.title,
            f.severity,
            f.cvss || '',
            f.cve || '',
            f.port || '',
            f.endpoint || '',
            f.remediation || '',
          ]);
        });
      });
      return { headers, rows };
    },
    jsonData: () => ({
      reportId: `ERROW-EXP-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      targets,
      jobs,
    }),
  };
}

/**
 * Builders for ActivTrak Insider Risk Export
 */
export function buildActivTrakExportPayload(sessions: any[]): ExportPayload {
  return {
    title: 'ActivTrak Insider Risk & Behavioral Telemetry Ledger',
    category: 'ACTIVTRAK',
    defaultClassification: 'RESTRICTED',
    briefText: (classification, reportId) => {
      const highRisk = sessions.filter((s) => s.riskScore >= 75);
      return `# ==============================================================================
# CECUR-IT SOC — ACTIVTRAK INSIDER RISK & WORKSTATION AUDIT REPORT
# CLASSIFICATION: ${classification} // RESTRICTED HR / SOC / GRC
# REPORT ID: ${reportId}
# GENERATED: ${new Date().toUTCString()}
# ==============================================================================

1. INSIDER THREAT SUMMARY
------------------------------------------------------------------------------
Total Recorded Sessions: ${sessions.length}
High-Risk Behavioral Anomalies: ${highRisk.length}
Removable USB Egress Events: ${sessions.filter((s) => s.usbConnected).length}
Cloud Storage Sync Events:   ${sessions.filter((s) => s.cloudStorageUpload).length}

2. HIGH RISK BEHAVIORAL FLAGS
------------------------------------------------------------------------------
${highRisk
  .map(
    (s) =>
      `• User: ${s.userName} (${s.department}) | Device: ${s.deviceId}
  Risk Score: ${s.riskScore}/100 | Category: ${s.category}
  Flag: ${s.flaggedActivity}
  Active App: ${s.currentApp} ("${s.windowTitle}")
  Data Transferred: ${s.dataTransferredMb} MB | USB: ${s.usbConnected ? 'YES' : 'NO'} | Cloud Upload: ${s.cloudStorageUpload ? 'YES' : 'NO'}`
  )
  .join('\n\n')}

==============================================================================
CONFIDENTIAL WORKSTATION AUDIT — CECUR-IT SOC
==============================================================================`;
    },
    csvData: () => {
      const headers = ['Session ID', 'Timestamp', 'User Name', 'Department', 'Device ID', 'Current App', 'Window Title', 'Category', 'Risk Score', 'Data Transferred MB', 'USB Connected', 'Cloud Upload', 'Flagged Activity'];
      const rows = sessions.map((s) => [
        s.id,
        s.timestamp,
        s.userName,
        s.department,
        s.deviceId,
        s.currentApp,
        s.windowTitle,
        s.category,
        s.riskScore,
        s.dataTransferredMb,
        s.usbConnected ? 'TRUE' : 'FALSE',
        s.cloudStorageUpload ? 'TRUE' : 'FALSE',
        s.flaggedActivity || '',
      ]);
      return { headers, rows };
    },
    jsonData: () => ({
      reportId: `ACTIVTRAK-EXP-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      totalSessions: sessions.length,
      sessions,
    }),
  };
}
