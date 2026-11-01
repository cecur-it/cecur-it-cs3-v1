import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, requirePanel, AuthenticatedRequest } from '../middleware/auth';

export const executiveRouter = Router();

// Executive KPI Dashboard (Denied to Analyst role)
executiveRouter.get('/', requireAuth, requirePanel('executive'), (req: AuthenticatedRequest, res: Response) => {
  const openIncidents = db.incidents.filter((i) => i.status !== 'RESOLVED');
  const criticalCount = db.incidents.filter((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED').length;

  res.json({
    kpis: {
      enterpriseRiskIndex: criticalCount > 0 ? 64 : 88, // out of 100
      riskTrend: criticalCount > 0 ? '+14% Risk Elevation' : '-4% Normalized',
      mttdMinutes: 3.4, // Mean Time to Detect (Industry standard: 180 min)
      mttrMinutes: 18.2, // Mean Time to Respond
      activeThreatActorsTracked: 2,
      openCriticalIncidents: criticalCount,
      complianceReadinessScore: 94.8, // %
    },
    complianceBreakdown: [
      { framework: 'NIST SP 800-53 Rev 5', score: 91.4, status: 'COMPLIANT', auditsRemaining: 0, baseline: 'Federal Level 4' },
      { framework: 'NIST SP 800-171 Rev 3', score: 94.5, status: 'COMPLIANT', auditsRemaining: 0, baseline: 'SPRS Score: 104 / 110 (CMMC Level 2)' },
      { framework: 'PCI-DSS v4.0', score: 94.2, status: 'COMPLIANT', auditsRemaining: 0, baseline: 'Level 1 Merchant' },
      { framework: 'FedRAMP High', score: 92.8, status: 'AUDIT_ACTIVE', auditsRemaining: 1, baseline: '421 Controls' },
      { framework: 'HIPAA Security Rule', score: 96.5, status: 'COMPLIANT', auditsRemaining: 0, baseline: 'ePHI Safeguards' },
      { framework: 'SOC 2 Type II', score: 93.8, status: 'COMPLIANT', auditsRemaining: 0, baseline: 'Security & Availability' },
    ],
    threatVectors: [
      { name: 'Credential Dumping (LSASS)', share: 38, count: 12, trend: 'UP' },
      { name: 'Data Exfiltration to Cloud Storage', share: 26, count: 8, trend: 'UP' },
      { name: 'External Ingress Brute Force', share: 22, count: 1840, trend: 'DOWN' },
      { name: 'Web Application Exploitation (SQLi/XSS)', share: 14, count: 42, trend: 'STABLE' },
    ],
    incidentVelocityMonthly: [
      { month: 'Apr', critical: 1, high: 4, medium: 12 },
      { month: 'May', critical: 0, high: 3, medium: 15 },
      { month: 'Jun', critical: 2, high: 6, medium: 18 },
      { month: 'Jul', critical: 1, high: 5, medium: 14 },
      { month: 'Aug', critical: criticalCount, high: 4, medium: 9 },
    ],
    activeExecutiveEscalations: openIncidents.slice(0, 2),
  });
});
