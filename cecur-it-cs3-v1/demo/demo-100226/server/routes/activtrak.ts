import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, requirePanel, AuthenticatedRequest } from '../middleware/auth';

export const activtrakRouter = Router();

// List user activity telemetry (Gated to analyst, admin, auditor)
activtrakRouter.get('/', requireAuth, requirePanel('activtrak'), (req: AuthenticatedRequest, res: Response) => {
  const { category, minRisk, search } = req.query;

  let results = [...db.activtrakSessions];

  if (category && typeof category === 'string') {
    results = results.filter((s) => s.category === category);
  }

  if (minRisk && typeof minRisk === 'string') {
    const risk = parseInt(minRisk, 10);
    if (!isNaN(risk)) {
      results = results.filter((s) => s.riskScore >= risk);
    }
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    results = results.filter(
      (s) =>
        s.userName.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.currentApp.toLowerCase().includes(q) ||
        s.windowTitle.toLowerCase().includes(q) ||
        s.deviceId.toLowerCase().includes(q)
    );
  }

  res.json({
    total: results.length,
    sessions: results,
  });
});

// Risky users leaderboard
activtrakRouter.get('/risky-users', requireAuth, requirePanel('activtrak'), (req: AuthenticatedRequest, res: Response) => {
  const risky = db.activtrakSessions
    .filter((s) => s.riskScore > 50)
    .sort((a, b) => b.riskScore - a.riskScore);

  res.json({
    count: risky.length,
    users: risky,
  });
});
