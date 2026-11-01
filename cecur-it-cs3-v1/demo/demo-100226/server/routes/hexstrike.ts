import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, requirePanel, requireAction, AuthenticatedRequest } from '../middleware/auth';
import {
  getHexStrikeStatus,
  runHexStrikeScan,
  SAFE_TOOL_PROFILES,
  SafeTool,
} from '../connectors/hexstrikeClient';
import { TargetAllowlistEntry } from '../../src/types';

export const hexstrikeRouter = Router();

// Panel status (Admin only)
hexstrikeRouter.get('/status', requireAuth, requirePanel('hexstrike'), (req: AuthenticatedRequest, res: Response) => {
  const status = getHexStrikeStatus();
  res.json(status);
});

// Target Allowlist
hexstrikeRouter.get('/allowlist', requireAuth, requirePanel('hexstrike'), (req: AuthenticatedRequest, res: Response) => {
  res.json({
    count: db.targetAllowlist.length,
    targets: db.targetAllowlist,
  });
});

// Add new target to allowlist (Admin only + strict validation)
hexstrikeRouter.post(
  '/allowlist',
  requireAuth,
  requirePanel('hexstrike'),
  requireAction('manage_allowlist'),
  (req: AuthenticatedRequest, res: Response) => {
    const { hostname, ipRange, ownerDepartment, notes } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!hostname || !ipRange || !ownerDepartment) {
      res.status(400).json({ error: 'Missing required target information (hostname, ipRange, ownerDepartment)' });
      return;
    }

    // Check if target hostname already exists
    if (db.targetAllowlist.some((t) => t.hostname.toLowerCase() === hostname.toLowerCase())) {
      res.status(400).json({ error: 'Target hostname is already registered in the allowlist.' });
      return;
    }

    const newTarget: TargetAllowlistEntry = {
      id: `tgt-${Date.now()}`,
      hostname: hostname.trim(),
      ipRange: ipRange.trim(),
      ownerDepartment: ownerDepartment.trim(),
      authorizedBy: `${req.user?.displayName} (${req.user?.username})`,
      authorizationDate: new Date().toISOString().split('T')[0],
      status: 'AUTHORIZED',
      notes: notes || 'Authorized for scoped safe recon sweeps.',
      scanCount: 0,
    };

    db.targetAllowlist.unshift(newTarget);

    db.logAudit({
      actorId: req.user?.id || 'unknown',
      actorUsername: req.user?.username || 'unknown',
      actorRole: req.user?.role || 'admin',
      action: 'ADD_TARGET_ALLOWLIST',
      panel: 'hexstrike',
      targetResource: newTarget.hostname,
      ipAddress: clientIp,
      status: 'SUCCESS',
      details: `Added new authorized target '${newTarget.hostname}' (${newTarget.ipRange}) to HexStrike safe allowlist.`,
    });

    res.json({ success: true, target: newTarget });
  }
);

// Revoke/remove target from allowlist
hexstrikeRouter.delete(
  '/allowlist/:id',
  requireAuth,
  requirePanel('hexstrike'),
  requireAction('manage_allowlist'),
  (req: AuthenticatedRequest, res: Response) => {
    const index = db.targetAllowlist.findIndex((t) => t.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: 'Target not found' });
      return;
    }

    const removed = db.targetAllowlist.splice(index, 1)[0];
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    db.logAudit({
      actorId: req.user?.id || 'unknown',
      actorUsername: req.user?.username || 'unknown',
      actorRole: req.user?.role || 'admin',
      action: 'REVOKE_TARGET_ALLOWLIST',
      panel: 'hexstrike',
      targetResource: removed.hostname,
      ipAddress: clientIp,
      status: 'SUCCESS',
      details: `Revoked authorization and removed target '${removed.hostname}' from HexStrike allowlist.`,
    });

    res.json({ success: true, message: `Target ${removed.hostname} removed.` });
  }
);

// Trigger scan (Admin only, strictly gated to allowlisted target & SAFE_TOOL_PROFILES)
hexstrikeRouter.post(
  '/run-scan',
  requireAuth,
  requirePanel('hexstrike'),
  requireAction('run_scan'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { targetId, targetHost, tool } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!tool || !SAFE_TOOL_PROFILES.includes(tool as SafeTool)) {
      db.logAudit({
        actorId: req.user?.id || 'unknown',
        actorUsername: req.user?.username || 'unknown',
        actorRole: req.user?.role || 'admin',
        action: 'SCAN_TOOL_REJECTED',
        panel: 'hexstrike',
        targetResource: `${targetHost || targetId} [${tool}]`,
        ipAddress: clientIp,
        status: 'DENY_403',
        details: `Rejected scan attempt using unapproved tool '${tool}'. Only safe scoped tools (${SAFE_TOOL_PROFILES.join(', ')}) are allowed.`,
      });

      res.status(400).json({
        error: 'Invalid Tool Profile',
        message: `Tool '${tool}' is not approved. Safe tools: ${SAFE_TOOL_PROFILES.join(', ')}`,
      });
      return;
    }

    try {
      const job = await runHexStrikeScan(
        targetHost,
        targetId,
        tool as SafeTool,
        req.user?.username || 'admin'
      );

      db.logAudit({
        actorId: req.user?.id || 'unknown',
        actorUsername: req.user?.username || 'unknown',
        actorRole: req.user?.role || 'admin',
        action: 'EXECUTE_SAFE_SCAN',
        panel: 'hexstrike',
        targetResource: `${job.targetHost} [${job.tool}]`,
        ipAddress: clientIp,
        status: 'SUCCESS',
        details: `Executed ${job.tool} on authorized target '${job.targetHost}'. Generated ${job.findingsCount} findings.`,
      });

      res.json({ success: true, job });
    } catch (err: any) {
      db.logAudit({
        actorId: req.user?.id || 'unknown',
        actorUsername: req.user?.username || 'unknown',
        actorRole: req.user?.role || 'admin',
        action: 'SCAN_FAILED',
        panel: 'hexstrike',
        targetResource: `${targetHost || targetId} [${tool}]`,
        ipAddress: clientIp,
        status: 'ERROR',
        details: `Scan execution failed: ${err.message}`,
      });

      res.status(400).json({ error: 'Scan Failed', message: err.message });
    }
  }
);

// Scan Jobs history
hexstrikeRouter.get('/jobs', requireAuth, requirePanel('hexstrike'), (req: AuthenticatedRequest, res: Response) => {
  res.json({
    total: db.hexstrikeJobs.length,
    jobs: db.hexstrikeJobs,
  });
});
