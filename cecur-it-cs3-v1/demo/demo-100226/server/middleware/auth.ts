import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { isPanelAllowed, isActionAllowed } from '../rbac';
import { User, UserRole } from '../../src/types';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set; refusing to sign or verify tokens.');
  }
  return secret;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function signToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (err) {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required. Please log in with an authorized SOC account.',
    });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session expired or token invalid. Please log in again.',
    });
    return;
  }

  const user = db.getUserById(decoded.id) || db.getUserByUsername(decoded.username);
  if (!user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'User account no longer exists in SOC directory.',
    });
    return;
  }

  req.user = user;
  next();
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Action requires one of the following roles: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

export function requirePanel(panelId: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const role = req.user.role;
    const allowed = isPanelAllowed(role, panelId);

    if (!allowed) {
      // Server-side audit log for security breach / unauthorized access attempt
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      db.logAudit({
        actorId: req.user.id,
        actorUsername: req.user.username,
        actorRole: req.user.role,
        action: `ACCESS_PANEL_DENIED`,
        panel: panelId,
        targetResource: req.originalUrl,
        ipAddress: clientIp,
        status: 'DENY_403',
        details: `Access to panel '${panelId}' was blocked by server RBAC policy. Role '${role}' lacks clearance.`,
      });

      res.status(403).json({
        error: 'Forbidden',
        panel: panelId,
        role: role,
        message: `Access Denied: Role '${role}' does not have authorization to access the '${panelId}' console panel. This attempt has been logged in the SOC audit trail.`,
      });
      return;
    }

    next();
  };
}

export function requireAction(actionId: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const role = req.user.role;
    const allowed = isActionAllowed(role, actionId);

    if (!allowed) {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      db.logAudit({
        actorId: req.user.id,
        actorUsername: req.user.username,
        actorRole: req.user.role,
        action: `ACTION_DENIED_${actionId.toUpperCase()}`,
        panel: 'action_gate',
        targetResource: `${req.method} ${req.originalUrl}`,
        ipAddress: clientIp,
        status: 'DENY_403',
        details: `Action '${actionId}' was rejected by server RBAC policy for role '${role}'.`,
      });

      res.status(403).json({
        error: 'Forbidden',
        action: actionId,
        role: role,
        message: `Action Denied: Role '${role}' is not permitted to execute action '${actionId}'. Action logged to audit trail.`,
      });
      return;
    }

    next();
  };
}
