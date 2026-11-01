import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, requirePanel, requireAction, AuthenticatedRequest } from '../middleware/auth';

export const sensorsRouter = Router();

// List all sensor nodes (Gated to analyst, admin, auditor)
sensorsRouter.get('/', requireAuth, requirePanel('sensors'), (req: AuthenticatedRequest, res: Response) => {
  res.json({
    count: db.sensors.length,
    sensors: db.sensors,
  });
});

// Calibrate sensor (Analyst or Admin)
sensorsRouter.post(
  '/:id/calibrate',
  requireAuth,
  requirePanel('sensors'),
  requireAction('sensor_calibrate'),
  (req: AuthenticatedRequest, res: Response) => {
    const sensor = db.sensors.find((s) => s.id === req.params.id);
    if (!sensor) {
      res.status(404).json({ error: 'Sensor node not found' });
      return;
    }

    sensor.status = 'ONLINE';
    sensor.anomalyRate = 0.05;
    sensor.jitterMs = 0.8;
    sensor.droppedPackets = 0.01;
    sensor.lastPing = new Date().toISOString();

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    db.logAudit({
      actorId: req.user?.id || 'unknown',
      actorUsername: req.user?.username || 'unknown',
      actorRole: req.user?.role || 'analyst',
      action: 'CALIBRATE_SENSOR',
      panel: 'sensors',
      targetResource: `${sensor.name} (${sensor.id})`,
      ipAddress: clientIp,
      status: 'SUCCESS',
      details: `Recalibrated zero-loss sampling buffers and cleared anomaly threshold jitter for sensor node ${sensor.name}.`,
    });

    res.json({ success: true, message: `Sensor ${sensor.name} calibrated successfully.`, sensor });
  }
);

// Reboot sensor node (Admin only)
sensorsRouter.post(
  '/:id/reboot',
  requireAuth,
  requirePanel('sensors'),
  requireAction('sensor_reboot'),
  (req: AuthenticatedRequest, res: Response) => {
    const sensor = db.sensors.find((s) => s.id === req.params.id);
    if (!sensor) {
      res.status(404).json({ error: 'Sensor node not found' });
      return;
    }

    sensor.cpuUsage = 18;
    sensor.memoryUsage = 35;
    sensor.status = 'ONLINE';
    sensor.lastPing = new Date().toISOString();

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    db.logAudit({
      actorId: req.user?.id || 'unknown',
      actorUsername: req.user?.username || 'unknown',
      actorRole: req.user?.role || 'admin',
      action: 'REBOOT_SENSOR_NODE',
      panel: 'sensors',
      targetResource: `${sensor.name} (${sensor.id})`,
      ipAddress: clientIp,
      status: 'SUCCESS',
      details: `Hard reset & reboot sequence executed on telemetry node ${sensor.name}. Firmware integrity verified.`,
    });

    res.json({ success: true, message: `Sensor node ${sensor.name} rebooted and back online.`, sensor });
  }
);
