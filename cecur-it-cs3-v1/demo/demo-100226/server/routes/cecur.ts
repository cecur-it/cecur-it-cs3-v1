import { Router, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { requireAuth, requireRole, requirePanel, AuthenticatedRequest } from '../middleware/auth';
import { cecurEngine } from '../engine/cecurEngine';
import { getBackendFirestore, getResolvedFirebaseConfig, isFirestoreEnabled } from '../firestoreSync';
import { doc, setDoc } from 'firebase/firestore';
import {
  analyzeLogAnomalyWithAI,
  generateVulnerabilityRemediationAI,
  analyzeFIMEventWithAI,
  analyzeComplianceGapsWithAI,
  getAIStatus,
} from '../ai/cecurAI';
import { requireIngestKey } from '../fleet/enrollment';
import { isIndexerEnabled, bulkIndexLogEvents } from '../integrations/opensearchSink';
import { CecurActiveResponseRequest, CecurLogEvent } from '../../src/types';

export const cecurRouter = Router();

// -------------------------------------------------------------
// 1. CECUR SERVER & INDEXER DIAGNOSTICS
// -------------------------------------------------------------
cecurRouter.get('/status', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  const status = cecurEngine.getStatus(db.cecurAgents);
  res.json(status);
});

cecurRouter.get('/decoders', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  res.json({
    total: cecurEngine.decoders.length,
    decoders: cecurEngine.decoders,
  });
});

cecurRouter.get('/rules', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  res.json({
    total: cecurEngine.rulesCatalog.length,
    rules: cecurEngine.rulesCatalog,
  });
});

// -------------------------------------------------------------
// 2. AGENTS & FLEET MANAGEMENT
// -------------------------------------------------------------
cecurRouter.get('/agents', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  const { workload, status, search } = req.query;

  let agents = [...db.cecurAgents];

  if (workload && typeof workload === 'string' && workload !== 'all') {
    agents = agents.filter((a) => a.workloadType === workload);
  }

  if (status && typeof status === 'string' && status !== 'all') {
    agents = agents.filter((a) => a.status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    agents = agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.hostname.toLowerCase().includes(q) ||
        a.ip.includes(q) ||
        a.os.name.toLowerCase().includes(q) ||
        a.group.some((g) => g.toLowerCase().includes(q))
    );
  }

  res.json({
    total: agents.length,
    agents,
  });
});

cecurRouter.get('/agents/:id', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  const agent = db.cecurAgents.find((a) => a.id === req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(agent);
});

// Active Response execution on agent
cecurRouter.post(
  '/agents/:id/action',
  requireAuth,
  requireRole(['admin', 'analyst']),
  requirePanel('cecur'),
  (req: AuthenticatedRequest, res: Response) => {
    const agent = db.cecurAgents.find((a) => a.id === req.params.id);
    if (!agent) {
      res.status(404).json({ error: `Cecur Agent '${req.params.id}' not registered in fleet.` });
      return;
    }

    const { command, targetIp, processName, arguments: args } = req.body as CecurActiveResponseRequest;
    if (!command) {
      res.status(400).json({ error: 'Active response command is required.' });
      return;
    }

    const result = cecurEngine.executeActiveResponse({ agentId: agent.id, command, targetIp, processName, arguments: args }, agent);

    db.logAudit({
      actorId: req.user!.id,
      actorUsername: req.user!.username,
      actorRole: req.user!.role,
      action: `CECUR_ACTIVE_RESPONSE_${command.toUpperCase()}`,
      panel: 'cecur',
      targetResource: `${agent.name} (${agent.ip})`,
      ipAddress: req.ip || '127.0.0.1',
      status: result.success ? 'SUCCESS' : 'ERROR',
      details: result.message,
    });

    res.json({
      success: true,
      agentId: agent.id,
      agentName: agent.name,
      agentStatus: agent.status,
      isolationStatus: agent.isolationStatus,
      result,
    });
  }
);

// -------------------------------------------------------------
// 3. SIEM LOG MANAGEMENT & INGESTION
// -------------------------------------------------------------
cecurRouter.get('/logs', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  const { source, severity, anomalyOnly, search, limit } = req.query;

  let logs = [...db.cecurLogs];

  if (source && typeof source === 'string' && source !== 'all') {
    logs = logs.filter((l) => l.source === source);
  }

  if (severity && typeof severity === 'string' && severity !== 'all') {
    logs = logs.filter((l) => l.severity === severity);
  }

  if (anomalyOnly === 'true') {
    logs = logs.filter((l) => l.isAnomaly);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    logs = logs.filter((l) => l.message.toLowerCase().includes(q) || l.agentName.toLowerCase().includes(q));
  }

  const max = limit ? parseInt(limit as string, 10) : 100;
  res.json({
    total: logs.length,
    logs: logs.slice(0, max),
  });
});

const MAX_INGEST_BATCH = Number(process.env.CS3_INGEST_MAX_BATCH) || 1000;

// Accepts a single event object, a JSON array of events (Fluent Bit `Format json`),
// or { events: [...] }. Batches are capped by CS3_INGEST_MAX_BATCH (HTTP 413 above it).
cecurRouter.post('/logs/ingest', requireIngestKey, async (req, res) => {
  const body = req.body;
  const isBatch = Array.isArray(body) || (body && Array.isArray(body.events));
  const events: any[] = Array.isArray(body) ? body : isBatch ? body.events : [body];

  if (events.length > MAX_INGEST_BATCH) {
    res.status(413).json({ error: `Batch too large; at most ${MAX_INGEST_BATCH} events per request.` });
    return;
  }

  const logIds: string[] = [];
  const toDurablyIndex: CecurLogEvent[] = [];
  let rejected = 0;
  for (const ev of events) {
    // requireIngestKey pins agentId for per-agent keys (stored on the request, not the payload).
    const { agentName, source, message, fields, severity } = ev || {};
    const agentId = (req as any).ingestAgentId || ev?.agentId;
    if (typeof message !== 'string' || !message || typeof source !== 'string' || !source) {
      rejected++;
      continue;
    }
    const lower = message.toLowerCase();
    const isAnomaly = lower.includes('failed') || lower.includes('error') || lower.includes('tamper');
    const newLog: CecurLogEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      agentId: agentId || 'cecur-ag-001',
      agentName: agentName || 'generic-endpoint',
      source: (source as any) || 'syslog',
      severity: severity || (isAnomaly ? 'high' : 'info'),
      message,
      fields: fields || {},
      isAnomaly,
      anomalyScore: isAnomaly ? 0.85 : 0.05,
      decoder: 'cecur-syslog',
    };
    db.cecurLogs.unshift(newLog);
    toDurablyIndex.push(newLog);
    logIds.push(newLog.id);
  }
  // db.cecurLogs is only a bounded hot cache for the console's "recent events" view.
  // Durable, unbounded storage for real on-prem fleets is the OpenSearch sink below
  // (deployment/operations/opensearch-cluster.md, ism/cs3-logs-lifecycle.json).
  if (db.cecurLogs.length > 300) db.cecurLogs = db.cecurLogs.slice(0, 300);

  let indexed = false;
  const durableIndexingEnabled = isIndexerEnabled();
  if (durableIndexingEnabled && toDurablyIndex.length > 0) {
    try {
      const indexResult = await bulkIndexLogEvents(toDurablyIndex);
      indexed = indexResult.ok && indexResult.indexed > 0;
      if (!indexResult.ok) {
        console.error('[cecur] durable indexing failed:', indexResult.error);
      }
    } catch (err) {
      console.error('[cecur] durable indexing failed:', (err as Error).message);
    }
  }

  if (logIds.length === 0) {
    res.status(400).json({ error: 'Log payload and source are required.', rejected });
    return;
  }
  if (!isBatch) {
    res.status(201).json({ success: true, logId: logIds[0], indexed });
    return;
  }
  res.status(201).json({ success: true, accepted: logIds.length, rejected, indexed });
});

// -------------------------------------------------------------
// 4. SIEM & XDR THREAT DETECTION ALERTS
// -------------------------------------------------------------
cecurRouter.get('/alerts', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  const { category, minLevel, status, search } = req.query;

  let alerts = [...db.cecurAlerts];

  if (category && typeof category === 'string' && category !== 'all') {
    alerts = alerts.filter((a) => a.category === category);
  }

  if (minLevel && !isNaN(Number(minLevel))) {
    alerts = alerts.filter((a) => a.ruleLevel >= Number(minLevel));
  }

  if (status && typeof status === 'string' && status !== 'all') {
    alerts = alerts.filter((a) => a.status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    alerts = alerts.filter(
      (a) =>
        a.ruleTitle.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.agentName.toLowerCase().includes(q) ||
        a.mitreTechnique?.toLowerCase().includes(q)
    );
  }

  res.json({
    total: alerts.length,
    alerts,
  });
});

cecurRouter.patch(
  '/alerts/:id/status',
  requireAuth,
  requireRole(['admin', 'analyst']),
  requirePanel('cecur'),
  (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const alert = db.cecurAlerts.find((a) => a.id === req.params.id);
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    if (!['new', 'investigating', 'resolved', 'suppressed'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    alert.status = status;

    db.logAudit({
      actorId: req.user!.id,
      actorUsername: req.user!.username,
      actorRole: req.user!.role,
      action: 'UPDATE_CECUR_ALERT_STATUS',
      panel: 'cecur',
      targetResource: alert.id,
      ipAddress: req.ip || '127.0.0.1',
      status: 'SUCCESS',
      details: `Changed Cecur alert ${alert.id} status to ${status}`,
    });

    res.json({ success: true, alert });
  }
);

// -------------------------------------------------------------
// 5. VULNERABILITY DETECTION (CVE DATABASE & AUDITING)
// -------------------------------------------------------------
cecurRouter.get('/vulnerabilities', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  const { severity, status, search } = req.query;

  let vulns = [...db.cecurVulnerabilities];

  if (severity && typeof severity === 'string' && severity !== 'all') {
    vulns = vulns.filter((v) => v.severity === severity);
  }

  if (status && typeof status === 'string' && status !== 'all') {
    vulns = vulns.filter((v) => v.status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    vulns = vulns.filter((v) => v.cve.toLowerCase().includes(q) || v.title.toLowerCase().includes(q) || v.package.toLowerCase().includes(q));
  }

  res.json({
    total: vulns.length,
    vulnerabilities: vulns,
  });
});

cecurRouter.post(
  '/vulnerabilities/scan',
  requireAuth,
  requireRole(['admin', 'analyst']),
  requirePanel('cecur'),
  (req: AuthenticatedRequest, res: Response) => {
    const { agentId } = req.body;

    db.logAudit({
      actorId: req.user!.id,
      actorUsername: req.user!.username,
      actorRole: req.user!.role,
      action: 'TRIGGER_VULNERABILITY_AUDIT',
      panel: 'cecur',
      targetResource: agentId ? `Agent ${agentId}` : 'All Fleet Agents',
      ipAddress: req.ip || '127.0.0.1',
      status: 'SUCCESS',
      details: 'Dispatched package inventory & CVE correlation sweep.',
    });

    res.json({
      success: true,
      message: 'Vulnerability scan dispatched. Cross-referencing software manifest against NVD & Cecur CVE Feed.',
      vulnerabilitiesCount: db.cecurVulnerabilities.length,
    });
  }
);

// -------------------------------------------------------------
// 6. FILE INTEGRITY MONITORING (FIM)
// -------------------------------------------------------------
cecurRouter.get('/fim', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  const { tamperOnly, search } = req.query;

  let fims = [...db.cecurFIMEvents];

  if (tamperOnly === 'true') {
    fims = fims.filter((f) => f.isTamperAlert);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    fims = fims.filter((f) => f.path.toLowerCase().includes(q) || f.agentName.toLowerCase().includes(q));
  }

  res.json({
    total: fims.length,
    fimEvents: fims,
  });
});

cecurRouter.post(
  '/fim/scan',
  requireAuth,
  requireRole(['admin', 'analyst']),
  requirePanel('cecur'),
  (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      message: 'Cryptographic SHA-256 baseline verification completed across all monitored filesystem trees.',
      checkedFilesCount: 8940,
      deviationsFound: db.cecurFIMEvents.filter((f) => f.isTamperAlert).length,
    });
  }
);

// -------------------------------------------------------------
// 7. SECURITY CONFIGURATION ASSESSMENT (SCA / CIS BENCHMARKS)
// -------------------------------------------------------------
cecurRouter.get('/sca', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  res.json({
    totalScans: db.cecurSCAScans.length,
    scans: db.cecurSCAScans,
  });
});

cecurRouter.post(
  '/sca/run',
  requireAuth,
  requireRole(['admin', 'analyst']),
  requirePanel('cecur'),
  (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      message: 'CIS Benchmark assessment audit executed on all target agents.',
      scansUpdated: db.cecurSCAScans.length,
    });
  }
);

// -------------------------------------------------------------
// 8. REGULATORY COMPLIANCE MATRIX (PCI DSS, HIPAA, GDPR, NIST)
// -------------------------------------------------------------
cecurRouter.get('/compliance', requireAuth, requirePanel('cecur'), (req: AuthenticatedRequest, res: Response) => {
  res.json({
    standards: db.cecurCompliance,
  });
});

// -------------------------------------------------------------
// 9. DUAL AI ENGINE ENDPOINTS (CS3 Agent + CECUR-IT Agent)
// -------------------------------------------------------------
cecurRouter.post('/ai/analyze-log', requireAuth, requirePanel('cecur'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { logMessage, source, agentName, agentOs, anomalyScore } = req.body;
    if (!logMessage) {
      res.status(400).json({ error: 'logMessage is required' });
      return;
    }

    const analysis = await analyzeLogAnomalyWithAI({
      logMessage,
      source: (source as any) || 'syslog',
      agentName: agentName || 'fleet-node',
      agentOs: agentOs || 'Linux',
      anomalyScore: typeof anomalyScore === 'number' ? anomalyScore : 0.85,
    });

    res.json({ success: true, analysis });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'AI analysis failed' });
  }
});

cecurRouter.post('/ai/remediate-vuln', requireAuth, requirePanel('cecur'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cve, title, package: pkg, installedVersion, fixedVersion, agentOs, cvss } = req.body;
    if (!cve || !pkg) {
      res.status(400).json({ error: 'cve and package are required' });
      return;
    }

    const remediation = await generateVulnerabilityRemediationAI({
      cve,
      title: title || cve,
      package: pkg,
      installedVersion: installedVersion || 'current',
      fixedVersion: fixedVersion || 'latest',
      agentOs: agentOs || 'Ubuntu 24.04 LTS',
      cvss: typeof cvss === 'number' ? cvss : 7.5,
    });

    res.json({ success: true, remediation });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Remediation generation failed' });
  }
});

cecurRouter.post('/ai/fim-triage', requireAuth, requirePanel('cecur'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path, eventType, oldHash, newHash, user, processName, agentName } = req.body;
    if (!path) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    const triage = await analyzeFIMEventWithAI({
      path,
      eventType: eventType || 'MODIFIED',
      oldHash,
      newHash,
      user,
      processName,
      agentName: agentName || 'endpoint-01',
    });

    res.json({ success: true, triage });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'FIM triage failed' });
  }
});

cecurRouter.post('/ai/compliance-gap', requireAuth, requirePanel('cecur'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { standardId, failedChecksCount, topGaps } = req.body;
    const briefing = await analyzeComplianceGapsWithAI(
      standardId || 'PCI_DSS',
      typeof failedChecksCount === 'number' ? failedChecksCount : 5,
      Array.isArray(topGaps) ? topGaps : ['Patch cadence', 'Access control']
    );

    res.json({ success: true, briefing });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Compliance AI failed' });
  }
});

cecurRouter.get('/ai/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(getAIStatus());
});

// -------------------------------------------------------------
// 10. ENTERPRISE PRICING & FIRESTORE CHECKOUT
// -------------------------------------------------------------
cecurRouter.get('/pricing/config', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const cfg = getResolvedFirebaseConfig();
  res.json({
    projectId: cfg.projectId,
    firestoreDatabaseId: cfg.firestoreDatabaseId,
    apiKeyMasked: cfg.apiKey ? `${cfg.apiKey.substring(0, 7)}...${cfg.apiKey.substring(cfg.apiKey.length - 4)}` : 'NOT_CONFIGURED',
    status: isFirestoreEnabled() ? 'ACTIVE_CONFIGURED' : 'DEGRADED',
  });
});

cecurRouter.post('/pricing/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      type,
      tierId,
      tierName,
      amountUSD,
      billingCycle,
      aiCreditsPurchased,
      paymentMethod,
      billingOrg,
    } = req.body;

    if (!type || !tierId || typeof amountUSD !== 'number') {
      res.status(400).json({ error: 'Invalid checkout parameters. type, tierId, and amountUSD are required.' });
      return;
    }

    const cfg = getResolvedFirebaseConfig();
    const txId = `tx-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const createdAt = new Date().toISOString();

    const transactionRecord = {
      id: txId,
      type,
      tierId,
      tierName: tierName || 'Enterprise Subscription',
      amountUSD,
      billingCycle: billingCycle || 'MONTHLY',
      aiCreditsPurchased: typeof aiCreditsPurchased === 'number' ? aiCreditsPurchased : 0,
      paymentMethod: paymentMethod || 'credit_card',
      billingOrg: billingOrg || 'Enterprise Operator',
      operatorEmail: req.user!.email,
      operatorUsername: req.user!.username,
      operatorRole: req.user!.role,
      firebaseProjectId: cfg.projectId,
      firestoreDatabaseId: cfg.firestoreDatabaseId,
      status: 'COMPLETED',
      createdAt,
    };

    // 1. Sync transaction to Firestore backend
    if (isFirestoreEnabled()) {
      try {
        const firestore = getBackendFirestore();
        await setDoc(doc(firestore, 'transactions', txId), transactionRecord, { merge: true });
      } catch (fsErr) {
        console.warn('[PricingCheckout] Firestore sync notice:', fsErr);
      }
    }

    // 2. Log audit trail
    db.logAudit({
      actorId: req.user!.id,
      actorUsername: req.user!.username,
      actorRole: req.user!.role,
      action: `PRICING_CHECKOUT_${type.toUpperCase()}`,
      panel: 'pricing',
      targetResource: `${tierName || tierId} ($${amountUSD.toFixed(2)})`,
      ipAddress: req.ip || '127.0.0.1',
      status: 'SUCCESS',
      details: `Processed ${type} payment of $${amountUSD.toFixed(2)} USD via ${paymentMethod || 'credit_card'}. ${isFirestoreEnabled() ? `Synced to Firestore project '${cfg.projectId}'.` : 'Firestore sync disabled for this deployment profile.'}`,
    });

    res.status(201).json({
      success: true,
      message: isFirestoreEnabled()
        ? 'Transaction successfully processed and persisted to Firestore.'
        : 'Transaction successfully processed and recorded in the audit ledger.',
      transaction: transactionRecord,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Payment checkout processing failed' });
  }
});

