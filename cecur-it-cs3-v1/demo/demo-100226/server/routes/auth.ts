import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { signToken, requireAuth, requireAction, AuthenticatedRequest } from '../middleware/auth';
import { getRoleSummary } from '../rbac';
import { UserRole, User } from '../../src/types';
import { syncUserToFirestore } from '../firestoreSync';

export const authRouter = Router();

// Register new SOC Operator account (Real profile creation with Firestore synchronization)
authRouter.post('/register', requireAuth, requireAction('manage_users'), (req: Request, res: Response) => {
  const { username, email, password, role, displayName, title, department, avatar } = req.body;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!username || !email || !password || !role || !displayName) {
    res.status(400).json({
      error: 'Missing Required Fields',
      message: 'Username, email, password, role, and full name are required for account registration.',
    });
    return;
  }

  const validRoles: UserRole[] = ['analyst', 'admin', 'auditor', 'executive'];
  if (!validRoles.includes(role)) {
    res.status(400).json({
      error: 'Invalid Role',
      message: `Role must be one of: ${validRoles.join(', ')}`,
    });
    return;
  }

  // Check username collision
  if (db.getUserByUsername(username)) {
    res.status(409).json({
      error: 'Account Conflict',
      message: `Username '${username}' is already registered in the SOC personnel registry.`,
    });
    return;
  }

  // Check email collision
  if (db.getUserByEmail(email)) {
    res.status(409).json({
      error: 'Account Conflict',
      message: `Email '${email}' is already registered with an existing operator account.`,
    });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newUser: User = {
    id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    username: username.trim().toLowerCase(),
    email: email.trim().toLowerCase(),
    passwordHash,
    role,
    displayName: displayName.trim(),
    title: title?.trim() || getDefaultTitle(role),
    department: department?.trim() || getDefaultDepartment(role),
    avatar: avatar?.trim() || getDefaultAvatar(role),
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  db.createUser(newUser);
  syncUserToFirestore(newUser);

  const token = signToken(newUser);
  const permissions = getRoleSummary(newUser.role);

  db.logAudit({
    actorId: newUser.id,
    actorUsername: newUser.username,
    actorRole: newUser.role,
    action: 'USER_REGISTER_SUCCESS',
    panel: 'auth',
    ipAddress: clientIp,
    status: 'SUCCESS',
    details: `Created new SOC operator account '${newUser.username}' (${newUser.displayName}) with clearance level '${newUser.role}'.`,
  });

  res.status(201).json({
    token,
    user: sanitizeUser(newUser),
    permissions,
  });
});

// Login endpoint (supports username or email)
authRouter.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!username || !password) {
    res.status(400).json({ error: 'Missing Credentials', message: 'Username/Email and password required.' });
    return;
  }

  const user = db.getUserByUsername(username) || db.getUserByEmail(username);
  if (!user) {
    db.logAudit({
      actorId: 'anonymous',
      actorUsername: username,
      actorRole: 'analyst' as UserRole,
      action: 'LOGIN_FAILED_UNKNOWN_USER',
      panel: 'auth',
      ipAddress: clientIp,
      status: 'DENY_403',
      details: `Failed authentication attempt for unknown identity '${username}'.`,
    });
    res.status(401).json({ error: 'Authentication Failed', message: 'Invalid credentials. Please verify username and password.' });
    return;
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    db.logAudit({
      actorId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: 'LOGIN_FAILED_BAD_PASSWORD',
      panel: 'auth',
      ipAddress: clientIp,
      status: 'DENY_403',
      details: `Bad password attempt for account '${user.username}'.`,
    });
    res.status(401).json({ error: 'Authentication Failed', message: 'Invalid credentials. Please verify username and password.' });
    return;
  }

  user.lastLogin = new Date().toISOString();
  const token = signToken(user);
  const permissions = getRoleSummary(user.role);

  db.logAudit({
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: 'LOGIN_SUCCESS',
    panel: 'auth',
    ipAddress: clientIp,
    status: 'SUCCESS',
    details: `User '${user.username}' successfully authenticated with clearance role '${user.role}'.`,
  });

  res.json({
    token,
    user: sanitizeUser(user),
    permissions,
  });
});

// Current user profile & permissions
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const permissions = getRoleSummary(req.user.role);
  res.json({
    user: sanitizeUser(req.user),
    permissions,
  });
});

// Update Profile endpoint
authRouter.patch('/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { displayName, title, department, avatar } = req.body;
  const updates: Partial<User> = {};

  if (displayName) updates.displayName = displayName.trim();
  if (title) updates.title = title.trim();
  if (department) updates.department = department.trim();
  if (avatar) updates.avatar = avatar.trim();

  const updated = db.updateUser(req.user.id, updates);
  if (!updated) {
    res.status(404).json({ error: 'User Not Found' });
    return;
  }
  syncUserToFirestore(updated);

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  db.logAudit({
    actorId: updated.id,
    actorUsername: updated.username,
    actorRole: updated.role,
    action: 'PROFILE_UPDATED',
    panel: 'auth',
    ipAddress: clientIp,
    status: 'SUCCESS',
    details: `Updated profile details for operator '${updated.username}'.`,
  });

  const permissions = getRoleSummary(updated.role);
  res.json({
    user: sanitizeUser(updated),
    permissions,
  });
});

// List all registered SOC personnel (for team roster & audit verification)
authRouter.get('/users', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const sanitizedList = db.users.map(sanitizeUser);
  res.json({ users: sanitizedList });
});

// Helper utilities
function sanitizeUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    displayName: u.displayName,
    email: u.email,
    avatar: u.avatar,
    title: u.title,
    department: u.department,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin,
  };
}

function getDefaultTitle(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Senior Security Operations Admin';
    case 'analyst':
      return 'Cyber Defense Incident Responder';
    case 'auditor':
      return 'Compliance & Threat Auditor';
    case 'executive':
      return 'Cyber Risk & Security Officer';
  }
}

function getDefaultDepartment(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'SecOps Infrastructure & Engineering';
    case 'analyst':
      return 'Threat Detection & Incident Response';
    case 'auditor':
      return 'Governance, Risk & Compliance';
    case 'executive':
      return 'Executive Information Security';
  }
}

function getDefaultAvatar(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/avatars/av-2.svg';
    case 'analyst':
      return '/avatars/av-1.svg';
    case 'auditor':
      return '/avatars/av-3.svg';
    case 'executive':
      return '/avatars/av-4.svg';
  }
}
