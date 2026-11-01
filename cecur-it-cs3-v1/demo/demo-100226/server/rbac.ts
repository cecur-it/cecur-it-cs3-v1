import { UserRole } from '../src/types';

export interface PanelPermission {
  id: string;
  name: string;
  description: string;
  allowedRoles: UserRole[];
}

export interface ActionPermission {
  id: string;
  description: string;
  allowedRoles: UserRole[];
}

// SOURCE OF TRUTH: Server-enforced panel permissions
export const PANEL_PERMISSIONS: Record<string, UserRole[]> = {
  overview: ['analyst', 'admin', 'auditor', 'executive'],
  incidents: ['analyst', 'admin', 'auditor', 'executive'],
  cecur: ['analyst', 'admin', 'auditor'], // Cecur SIEM & XDR platform (Denied to executive)
  activtrak: ['analyst', 'admin', 'auditor'], // Denied to executive
  sensors: ['analyst', 'admin', 'auditor'], // Denied to executive
  fusion: ['analyst', 'admin'], // Denied to auditor, executive
  errow: ['admin'], // Strictly admin only!
  audit: ['analyst', 'admin', 'auditor', 'executive'],
  executive: ['admin', 'auditor', 'executive'], // Denied to analyst
  pricing: ['analyst', 'admin', 'auditor', 'executive'], // Allowed to all roles
  settings: ['admin'], // Strictly admin only!
};

// SOURCE OF TRUTH: Server-enforced action permissions
export const ACTION_PERMISSIONS: Record<string, UserRole[]> = {
  run_scan: ['admin'],
  manage_allowlist: ['admin'],
  reseed_db: ['admin'],
  sensor_calibrate: ['admin', 'analyst'],
  sensor_reboot: ['admin'],
  update_incident: ['admin', 'analyst'],
  create_incident: ['admin', 'analyst'],
  ack_alert: ['admin', 'analyst'],
  cecur_active_response: ['admin', 'analyst'],
  cecur_isolate_host: ['admin', 'analyst'],
  cecur_trigger_audit: ['admin', 'analyst'],
  export_audit: ['admin', 'auditor'],
  generate_ai_playbook: ['admin', 'analyst', 'executive'],
  manage_users: ['admin'],
  manage_fleet: ['admin'], // bulk agent enrollment (POST /api/fleet/enroll/bulk)
};

export function isPanelAllowed(role: UserRole, panelId: string): boolean {
  const allowed = PANEL_PERMISSIONS[panelId];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function isActionAllowed(role: UserRole, actionId: string): boolean {
  const allowed = ACTION_PERMISSIONS[actionId];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function getRoleSummary(role: UserRole) {
  return {
    role,
    allowedPanels: Object.keys(PANEL_PERMISSIONS).filter((p) => PANEL_PERMISSIONS[p].includes(role)),
    allowedActions: Object.keys(ACTION_PERMISSIONS).filter((a) => ACTION_PERMISSIONS[a].includes(role)),
  };
}
