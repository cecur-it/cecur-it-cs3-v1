import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, requirePanel, requireAction, AuthenticatedRequest } from '../middleware/auth';
import { generateIncidentAnalysisWithAI } from '../gemini';

export const incidentsRouter = Router();

// List all incidents
incidentsRouter.get('/', requireAuth, requirePanel('incidents'), (req: AuthenticatedRequest, res: Response) => {
  const { severity, status, search } = req.query;

  let results = [...db.incidents];

  if (severity && typeof severity === 'string') {
    results = results.filter((i) => i.severity.toLowerCase() === severity.toLowerCase());
  }

  if (status && typeof status === 'string') {
    results = results.filter((i) => i.status.toLowerCase() === status.toLowerCase());
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    results = results.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.mitreTactic.toLowerCase().includes(q) ||
        i.affectedAssets.some((a) => a.toLowerCase().includes(q))
    );
  }

  res.json({ incidents: results });
});

// Get single incident
incidentsRouter.get('/:id', requireAuth, requirePanel('incidents'), (req: AuthenticatedRequest, res: Response) => {
  const incident = db.incidents.find((i) => i.id === req.params.id);
  if (!incident) {
    res.status(404).json({ error: 'Incident Not Found' });
    return;
  }

  // Correlate with underlying Cecur alerts and ActivTrak sessions
  const correlatedCecur = db.cecurAlerts.filter((a) => incident.correlatedAlertIds.includes(a.id));
  const correlatedActivTrak = db.activtrakSessions.filter((s) => incident.correlatedAlertIds.includes(s.id));

  res.json({
    incident,
    correlatedCecur,
    correlatedActivTrak,
  });
});

// Update incident status / assignee
incidentsRouter.patch(
  '/:id',
  requireAuth,
  requirePanel('incidents'),
  requireAction('update_incident'),
  (req: AuthenticatedRequest, res: Response) => {
    const incident = db.incidents.find((i) => i.id === req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident Not Found' });
      return;
    }

    const { status, assignedTo, rootCause, timelineNote } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (status) incident.status = status;
    if (assignedTo) incident.assignedTo = assignedTo;
    if (rootCause) incident.rootCause = rootCause;
    incident.updatedAt = new Date().toISOString();

    if (timelineNote) {
      incident.timeline.push({
        time: new Date().toISOString(),
        source: `SOC Analyst (${req.user?.username})`,
        event: timelineNote,
        severity: incident.severity,
      });
    }

    db.logAudit({
      actorId: req.user?.id || 'unknown',
      actorUsername: req.user?.username || 'unknown',
      actorRole: req.user?.role || 'analyst',
      action: 'UPDATE_INCIDENT',
      panel: 'incidents',
      targetResource: incident.id,
      ipAddress: clientIp,
      status: 'SUCCESS',
      details: `Updated incident ${incident.id}: status=${incident.status}, assignee=${incident.assignedTo}`,
    });

    res.json({ success: true, incident });
  }
);

// Toggle or update playbook step status
incidentsRouter.post(
  '/:id/playbook-step',
  requireAuth,
  requirePanel('incidents'),
  requireAction('update_incident'),
  (req: AuthenticatedRequest, res: Response) => {
    const incident = db.incidents.find((i) => i.id === req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident Not Found' });
      return;
    }

    const { stepNumber, status } = req.body;
    const step = incident.playbookSteps.find((s) => s.step === stepNumber);
    if (!step) {
      res.status(404).json({ error: 'Playbook step not found' });
      return;
    }

    step.status = status;
    incident.updatedAt = new Date().toISOString();

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    db.logAudit({
      actorId: req.user?.id || 'unknown',
      actorUsername: req.user?.username || 'unknown',
      actorRole: req.user?.role || 'analyst',
      action: 'UPDATE_PLAYBOOK_STEP',
      panel: 'incidents',
      targetResource: `${incident.id} [Step ${stepNumber}]`,
      ipAddress: clientIp,
      status: 'SUCCESS',
      details: `Marked playbook step ${stepNumber} ('${step.title}') as ${status}.`,
    });

    res.json({ success: true, incident });
  }
);

// AI Incident Analysis via CS3-AI
incidentsRouter.post(
  '/:id/ai-analyze',
  requireAuth,
  requirePanel('incidents'),
  requireAction('generate_ai_playbook'),
  async (req: AuthenticatedRequest, res: Response) => {
    const incident = db.incidents.find((i) => i.id === req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident Not Found' });
      return;
    }

    try {
      const analysis = await generateIncidentAnalysisWithAI(incident);
      incident.aiSummary = analysis.aiSummary;
      incident.updatedAt = new Date().toISOString();

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      db.logAudit({
        actorId: req.user?.id || 'unknown',
        actorUsername: req.user?.username || 'unknown',
        actorRole: req.user?.role || 'analyst',
        action: 'RUN_AI_INCIDENT_ANALYSIS',
        panel: 'incidents',
        targetResource: incident.id,
        ipAddress: clientIp,
        status: 'SUCCESS',
        details: `Generated automated CS3-AI threat triage and MITRE ATT&CK mitigation analysis for ${incident.id}.`,
      });

      res.json({
        success: true,
        analysis,
        incident,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'AI Analysis Failed', message: err.message });
    }
  }
);
