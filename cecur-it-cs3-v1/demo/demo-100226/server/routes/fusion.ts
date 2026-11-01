import { Router, Response } from 'express';
import { requireAuth, requirePanel, AuthenticatedRequest } from '../middleware/auth';
import { buildAssetFusionGraph, simulateBlastRadius, generateThreatExport } from '../fusion';

export const fusionRouter = Router();

// Asset graph & blast radius evaluation (Gated to analyst & admin)
fusionRouter.get('/', requireAuth, requirePanel('fusion'), (req: AuthenticatedRequest, res: Response) => {
  const graphData = buildAssetFusionGraph();
  res.json(graphData);
});

// Dynamic Blast Radius & Lateral Propagation Simulation Engine
fusionRouter.post('/simulate-blast', requireAuth, requirePanel('fusion'), (req: AuthenticatedRequest, res: Response) => {
  const { scenarioId = 'CREDENTIAL_CASCADE', originNodeId = 'node-ws-fin-104', appliedMitigations = [] } = req.body || {};
  const result = simulateBlastRadius(scenarioId, originNodeId, appliedMitigations);
  res.json(result);
});

// Threat Intelligence and Lateral Topology Export Generation
fusionRouter.post('/export-report', requireAuth, requirePanel('fusion'), (req: AuthenticatedRequest, res: Response) => {
  const { format = 'executive_summary', classification = 'TLP:AMBER', notes = '' } = req.body || {};
  const report = generateThreatExport(format, classification, notes);
  res.json(report);
});
