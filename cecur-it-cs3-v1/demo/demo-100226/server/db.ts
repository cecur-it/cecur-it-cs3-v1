import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { isDemoMode } from './profile';
import {
  User,
  SensorNode,
  CecurAgent,
  CecurAlert,
  CecurLogEvent,
  CecurVulnerability,
  CecurFIMEvent,
  CecurSCAScan,
  CecurComplianceStandard,
  ActivTrakSession,
  Incident,
  TargetAllowlistEntry,
  HexStrikeJob,
  AuditLogEntry,
} from '../src/types';
import {
  generateInitialUsers,
  generateInitialSensors,
  generateInitialCecurAgents,
  generateInitialCecurAlerts,
  generateInitialCecurLogs,
  generateInitialCecurVulnerabilities,
  generateInitialCecurFIMEvents,
  generateInitialCecurSCAScans,
  generateInitialCecurCompliance,
  generateInitialActivTrakSessions,
  generateInitialIncidents,
  generateInitialTargetAllowlist,
  generateInitialHexStrikeJobs,
  generateInitialAuditLogs,
} from './data/generators';

export class SOCDatabase {
  public users: User[] = [];
  public sensors: SensorNode[] = [];
  public cecurAgents: CecurAgent[] = [];
  public cecurAlerts: CecurAlert[] = [];
  public cecurLogs: CecurLogEvent[] = [];
  public cecurVulnerabilities: CecurVulnerability[] = [];
  public cecurFIMEvents: CecurFIMEvent[] = [];
  public cecurSCAScans: CecurSCAScan[] = [];
  public cecurCompliance: CecurComplianceStandard[] = [];
  public activtrakSessions: ActivTrakSession[] = [];
  public incidents: Incident[] = [];
  public targetAllowlist: TargetAllowlistEntry[] = [];
  public hexstrikeJobs: HexStrikeJob[] = [];
  public auditLogs: AuditLogEntry[] = [];
  public initializedAt: string = '';
  /** Hooks invoked for every audit entry (e.g. PostgreSQL append-only mirror). */
  public auditListeners: Array<(entry: AuditLogEntry) => void> = [];

  constructor() {
    if (isDemoMode()) {
      this.seed();
    } else {
      this.initializedAt = new Date().toISOString();
      this.bootstrapAdmin();
    }
  }

  /** Non-demo mode: create a single admin from CS3_BOOTSTRAP_ADMIN_PASSWORD (set by onboarding/wizard.mjs). */
  private bootstrapAdmin() {
    const password = process.env.CS3_BOOTSTRAP_ADMIN_PASSWORD;
    if (!password || this.users.length > 0) return;
    const now = new Date().toISOString();
    this.users.push({
      id: 'usr-bootstrap-admin',
      username: 'admin',
      email: 'admin@localhost',
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'admin',
      displayName: 'Bootstrap Administrator',
      title: 'SOC Administrator',
      department: 'Security Operations',
      avatar: '',
      createdAt: now,
      lastLogin: now,
    } as User);
  }

  public seed() {
    this.users = generateInitialUsers();
    this.sensors = generateInitialSensors();
    this.cecurAgents = generateInitialCecurAgents();
    this.cecurAlerts = generateInitialCecurAlerts();
    this.cecurLogs = generateInitialCecurLogs();
    this.cecurVulnerabilities = generateInitialCecurVulnerabilities();
    this.cecurFIMEvents = generateInitialCecurFIMEvents();
    this.cecurSCAScans = generateInitialCecurSCAScans();
    this.cecurCompliance = generateInitialCecurCompliance();
    this.activtrakSessions = generateInitialActivTrakSessions();
    this.incidents = generateInitialIncidents();
    this.targetAllowlist = generateInitialTargetAllowlist();
    this.hexstrikeJobs = generateInitialHexStrikeJobs();
    this.auditLogs = generateInitialAuditLogs();
    this.initializedAt = new Date().toISOString();
    console.log('[SOCDatabase] Cecur SIEM/XDR Database initialized and seeded successfully.');
  }

  public logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    const prevHash = this.auditLogs.length > 0 ? (this.auditLogs[0].chainHash || 'genesis-root-000000000000') : 'genesis-root-000000000000';
    const timestamp = new Date().toISOString();
    
    // Auto-map NIST control references based on action/panel
    let nistControls = entry.nistControls || [];
    if (nistControls.length === 0) {
      if (entry.status === 'DENY_403') {
        nistControls = ['AC-3', 'AC-6', '03.01.07'];
      } else if (entry.panel === 'incidents') {
        nistControls = ['IR-4', 'IR-5', '03.06.01'];
      } else if (entry.panel === 'hexstrike') {
        nistControls = ['CA-8', 'RA-5', '03.11.02'];
      } else if (entry.panel === 'audit') {
        nistControls = ['AU-2', 'AU-3', 'AU-9', '03.03.01', '03.03.03'];
      } else if (entry.panel === 'cecur') {
        nistControls = ['SI-4', 'CM-6', '03.14.01'];
      } else {
        nistControls = ['AU-2', 'AU-3', '03.03.01'];
      }
    }

    // Deterministic pseudo-hash calculation for demonstration ledger integrity
    const hashSeed = `${prevHash}:${timestamp}:${entry.actorUsername}:${entry.action}:${entry.status}:${entry.targetResource || ''}`;
    const chainHash = `sha256-${createHash('sha256').update(hashSeed).digest('hex')}`;

    const log: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp,
      nistControls,
      chainHash,
      cuiProtected: true,
      nonRepudiationVerified: true,
      ...entry,
    };
    this.auditLogs.unshift(log);
    for (const listener of this.auditListeners) {
      try {
        listener(log);
      } catch (err) {
        console.error('[SOCDatabase] audit listener failed:', (err as Error).message);
      }
    }
    // Keep max 500 logs in memory
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    return log;
  }

  public getUserByUsername(username: string): User | undefined {
    return this.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  public getUserByEmail(email: string): User | undefined {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public getUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  public createUser(user: User): User {
    this.users.push(user);
    return user;
  }

  public updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.users[idx] = { ...this.users[idx], ...updates };
    return this.users[idx];
  }

  // Live simulation tick: updates sensor packet rates, slight jitter, generates subtle live stream events
  public simulateTick(): { type: string; payload: any }[] {
    const events: { type: string; payload: any }[] = [];

    // 1. Mutate sensor telemetry slightly (realistic drift)
    this.sensors = this.sensors.map((sensor) => {
      if (sensor.status === 'OFFLINE') return sensor;
      const drift = (Math.random() - 0.48) * 0.05; // -2.4% to +2.6%
      const newRate = Math.max(1000, Math.round(sensor.packetRate * (1 + drift)));
      const newCpu = Math.min(99, Math.max(5, Math.round(sensor.cpuUsage + (Math.random() * 6 - 3))));
      const newMem = Math.min(98, Math.max(10, Math.round(sensor.memoryUsage + (Math.random() * 2 - 1))));
      const newJitter = Number(Math.max(0.1, sensor.jitterMs + (Math.random() * 0.4 - 0.2)).toFixed(2));
      const newAnomaly = Number(Math.max(0, sensor.anomalyRate + (Math.random() * 0.2 - 0.1)).toFixed(2));

      return {
        ...sensor,
        packetRate: newRate,
        cpuUsage: newCpu,
        memoryUsage: newMem,
        jitterMs: newJitter,
        anomalyRate: newAnomaly,
        lastPing: new Date().toISOString(),
      };
    });

    events.push({
      type: 'SENSOR_TELEMETRY_UPDATE',
      payload: this.sensors,
    });

    // 2. Occasionally simulate live Cecur telemetry log & alert (30% chance per tick)
    if (Math.random() < 0.3) {
      const sampleSources = ['auth.log', 'syslog', 'auditd', 'k8s_audit', 'windows_event', 'nginx'] as const;
      const src = sampleSources[Math.floor(Math.random() * sampleSources.length)];
      const randomAgent = this.cecurAgents[Math.floor(Math.random() * this.cecurAgents.length)];

      const isAnomaly = Math.random() < 0.35;
      const newLog: CecurLogEvent = {
        id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        agentId: randomAgent?.id || 'cecur-ag-001',
        agentName: randomAgent?.name || 'dmz-web-ingress-prod-01',
        source: src,
        severity: isAnomaly ? (Math.random() < 0.5 ? 'high' : 'critical') : 'info',
        message: isAnomaly
          ? `[ANOMALY_DETECTED] Unexpected syscall sequence or auth failure in ${src} on ${randomAgent?.name}`
          : `[TELEMETRY] Nominal heartbeat and process metrics processed for ${src}`,
        fields: { pid: Math.floor(Math.random() * 50000) + 1000, user: isAnomaly ? 'root_admin' : 'system' },
        isAnomaly,
        anomalyScore: isAnomaly ? Number((0.65 + Math.random() * 0.33).toFixed(2)) : 0.05,
        decoder: src === 'auth.log' ? 'cecur-auth-pam' : src === 'auditd' ? 'cecur-auditd' : 'cecur-syslog',
      };

      this.cecurLogs.unshift(newLog);
      if (this.cecurLogs.length > 300) this.cecurLogs = this.cecurLogs.slice(0, 300);

      events.push({
        type: 'NEW_CECUR_LOG',
        payload: newLog,
      });

      // If high anomaly, promote to Cecur SIEM alert
      if (isAnomaly && newLog.anomalyScore > 0.8) {
        const newAlert: CecurAlert = {
          id: `cecur-live-${Date.now()}`,
          timestamp: new Date().toISOString(),
          ruleId: 10010 + Math.floor(Math.random() * 5) * 10,
          ruleLevel: Math.floor(Math.random() * 5) + 10,
          ruleTitle: `Cecur SIEM Alert: High anomaly index detected on ${randomAgent?.name}`,
          description: `Automatic XDR trigger on suspicious telemetry pattern from ${src}.`,
          category: src === 'auth.log' ? 'authentication' : src === 'auditd' ? 'privilege_escalation' : 'log_anomaly',
          agentId: randomAgent?.id || 'cecur-ag-001',
          agentName: randomAgent?.name || 'dmz-web-ingress-prod-01',
          agentIp: randomAgent?.ip || '172.16.20.14',
          agentOs: randomAgent?.os.name || 'Linux',
          complianceTags: ['PCI_DSS_10.2.4', 'NIST_800_53_SI_4', 'GDPR_Art_32'],
          mitreTactic: 'Execution',
          mitreTechnique: 'T1059 - Command and Scripting Interpreter',
          decoderMatched: newLog.decoder,
          fullLog: newLog.message,
          status: 'new',
        };

        this.cecurAlerts.unshift(newAlert);
        if (this.cecurAlerts.length > 200) this.cecurAlerts = this.cecurAlerts.slice(0, 200);

        events.push({
          type: 'NEW_CECUR_ALERT',
          payload: newAlert,
        });
      }
    }

    return events;
  }
}

// Global Singleton Database Instance
export const db = new SOCDatabase();
