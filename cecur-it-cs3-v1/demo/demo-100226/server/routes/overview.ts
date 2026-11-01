import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, requirePanel, AuthenticatedRequest } from '../middleware/auth';

export const overviewRouter = Router();

overviewRouter.get('/', requireAuth, requirePanel('overview'), (req: AuthenticatedRequest, res: Response) => {
  const activeIncidents = db.incidents.filter((i) => i.status !== 'RESOLVED');
  const criticalIncidents = db.incidents.filter((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED');
  const onlineSensors = db.sensors.filter((s) => s.status === 'ONLINE').length;
  const degradedSensors = db.sensors.filter((s) => s.status === 'DEGRADED').length;
  const offlineSensors = db.sensors.filter((s) => s.status === 'OFFLINE').length;

  const totalEps = db.sensors.reduce((acc, s) => acc + s.packetRate, 0);
  const avgDropped = Number(
    (db.sensors.reduce((acc, s) => acc + s.droppedPackets, 0) / (db.sensors.length || 1)).toFixed(2)
  );

  const highRiskUsers = db.activtrakSessions.filter((s) => s.riskScore >= 75).length;
  const unacknowledgedAlerts = db.cecurAlerts.filter((a) => a.status === 'new').length;

  // Threat Posture Score Calculation (0-100, where 100 is nominal, lower is higher risk)
  let threatScore = 88;
  if (criticalIncidents.length > 0) threatScore -= criticalIncidents.length * 15;
  if (degradedSensors > 0) threatScore -= degradedSensors * 8;
  if (highRiskUsers > 0) threatScore -= highRiskUsers * 5;
  threatScore = Math.max(12, Math.min(100, threatScore));

  res.json({
    posture: {
      score: threatScore,
      status: threatScore > 75 ? 'GUARDED' : threatScore > 50 ? 'ELEVATED_THREAT' : 'CRITICAL_CONDITION',
      lastAssessment: new Date().toISOString(),
    },
    metrics: {
      activeIncidentsCount: activeIncidents.length,
      criticalIncidentsCount: criticalIncidents.length,
      totalEps,
      avgDroppedPercentage: avgDropped,
      unacknowledgedAlertsCount: unacknowledgedAlerts,
      highRiskUsersCount: highRiskUsers,
      sensorSummary: {
        total: db.sensors.length,
        online: onlineSensors,
        degraded: degradedSensors,
        offline: offlineSensors,
      },
    },
    recentIncidents: db.incidents.slice(0, 3),
    recentAlerts: db.cecurAlerts.slice(0, 5),
    activeSensors: db.sensors,
  });
});
