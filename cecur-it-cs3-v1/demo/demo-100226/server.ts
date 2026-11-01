import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { db } from './server/db';
import { authRouter } from './server/routes/auth';
import { overviewRouter } from './server/routes/overview';
import { incidentsRouter } from './server/routes/incidents';
import { cecurRouter } from './server/routes/cecur';
import { activtrakRouter } from './server/routes/activtrak';
import { sensorsRouter } from './server/routes/sensors';
import { fusionRouter } from './server/routes/fusion';
import { hexstrikeRouter } from './server/routes/hexstrike';
import { auditRouter } from './server/routes/audit';
import { executiveRouter } from './server/routes/executive';
import { systemRouter } from './server/routes/system';
import { fleetRouter } from './server/routes/fleet';
import { isPostgresEnabled } from './server/pg/pool';
import { appendAudit } from './server/pg/store';
import { startPgEventBridge } from './server/pg/events';
import { getProfile, isDemoMode } from './server/profile';
import { getResolvedFirebaseConfig, isFirestoreEnabled, seedFirestoreDemonstrativeCredentials } from './server/firestoreSync';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  const demoMode = isDemoMode();

  // Seed Firestore with demonstrative credentials only in explicit demo mode (CS3_DEMO_MODE=true)
  if (demoMode) {
    seedFirestoreDemonstrativeCredentials();
  }

  // JSON Body Parser (limit sized for bulk enrollment batches of up to CS3_ENROLL_MAX_BATCH agents)
  app.use(express.json({ limit: process.env.CS3_JSON_LIMIT || '2mb' }));

  // Runtime config for the SPA (loaded by index.html before the bundle). Lets the same
  // prebuilt image honour CS3_PROFILE: onprem/airgap clients get no hosted Firebase config.
  app.get('/cs3-runtime-config.js', (req, res) => {
    const fb = getResolvedFirebaseConfig();
    const firebase = isFirestoreEnabled() ? fb : null;
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(
      `window.__CS3_CONFIG__ = ${JSON.stringify({ profile: getProfile(), demoMode, firebase }).replace(/</g, '\\u003c')};\n`
    );
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'nominal',
      service: 'CECUR-IT Unified SOC Console',
      timestamp: new Date().toISOString(),
      sensorsCount: db.sensors.length,
      incidentsCount: db.incidents.length,
      cecurAgentsCount: db.cecurAgents.length,
    });
  });

  // Track active SSE client connections for real-time live events
  const sseClients = new Set<express.Response>();

  // Real-time live event stream (Server-Sent Events); /api/events is the canonical alias.
  app.get(['/api/live/stream', '/api/events'], (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial handshake
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  const broadcast = (payload: unknown) => {
    if (sseClients.size === 0) return;
    const frame = `data: ${JSON.stringify(payload)}\n\n`;
    sseClients.forEach((client) => {
      try {
        client.write(frame);
      } catch (e) {
        sseClients.delete(client);
      }
    });
  };

  // PostgreSQL persistence (optional): mirror the audit ledger into the append-only
  // cs3.audit_logs table and replace Firestore onSnapshot with LISTEN/NOTIFY -> SSE.
  let stopPgEvents = () => {};
  if (isPostgresEnabled()) {
    db.auditListeners.push((entry) => {
      appendAudit(entry as any).catch((err) => console.error('[pg] audit append failed:', err.message));
    });
    stopPgEvents = startPgEventBridge((change) =>
      broadcast({ type: 'DB_CHANGE', change, timestamp: new Date().toISOString() })
    );
    console.log('[CECUR-IT SOC] PostgreSQL persistence enabled (CS3_PERSISTENCE=postgres)');
  }

  // Polling fallback endpoint for live telemetry
  app.get('/api/live/telemetry', (req, res) => {
    res.json({
      sensors: db.sensors,
      activeIncidentsCount: db.incidents.filter((i) => i.status !== 'RESOLVED').length,
      recentCecurAlerts: db.cecurAlerts.slice(0, 5),
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API Resource Routers
  app.use('/api/auth', authRouter);
  app.use('/api/overview', overviewRouter);
  app.use('/api/incidents', incidentsRouter);
  app.use('/api/cecur', cecurRouter);
  app.use('/api/activtrak', activtrakRouter);
  app.use('/api/sensors', sensorsRouter);
  app.use('/api/fusion', fusionRouter);
  app.use('/api/hexstrike', hexstrikeRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/executive', executiveRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/fleet', fleetRouter);

  // Background mock simulation loop: every 3.5 seconds. Demo mode only (CS3_DEMO_MODE=true);
  // production profiles must never emit synthetic telemetry.
  if (demoMode) {
    setInterval(() => {
      const events = db.simulateTick();
      if (events.length > 0) {
        broadcast({ events, timestamp: new Date().toISOString() });
      }
    }, 3500);
  } else {
    console.log('[CECUR-IT SOC] CS3_DEMO_MODE is not "true": mock simulation loop and demo seeding are disabled.');
  }

  // Vite middleware for development vs Static dist for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CECUR-IT SOC] Server active and listening on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown (Kubernetes SIGTERM / rolling updates)
  const shutdown = () => {
    stopPgEvents();
    sseClients.forEach((c) => c.end());
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
