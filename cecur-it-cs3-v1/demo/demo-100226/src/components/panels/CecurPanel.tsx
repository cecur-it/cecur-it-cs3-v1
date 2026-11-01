import React, { useState, useEffect, useMemo } from 'react';
import {
  Terminal,
  Shield,
  Server,
  Activity,
  AlertTriangle,
  FileCheck2,
  Lock,
  Search,
  RefreshCw,
  Cpu,
  HardDrive,
  Database,
  Radio,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  FileCode2,
  FileText,
  Copy,
  ExternalLink,
  Info,
  Check,
  Play,
  RotateCcw,
  Sliders,
  Filter,
  Eye,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  CecurAgent,
  CecurAlert,
  CecurLogEvent,
  CecurVulnerability,
  CecurFIMEvent,
  CecurSCAScan,
  CecurComplianceStandard,
  CecurServerStatus,
} from '../../types';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

type CecurTab = 'fleet' | 'logs' | 'alerts' | 'vulnerabilities' | 'fim' | 'sca' | 'compliance' | 'server';

export const CecurPanel: React.FC = () => {
  const { canPerformAction, user } = useAuth();
  const [activeTab, setActiveTab] = useState<CecurTab>('fleet');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core Cecur State
  const [serverStatus, setServerStatus] = useState<CecurServerStatus | null>(null);
  const [agents, setAgents] = useState<CecurAgent[]>([]);
  const [alerts, setAlerts] = useState<CecurAlert[]>([]);
  const [logs, setLogs] = useState<CecurLogEvent[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<CecurVulnerability[]>([]);
  const [fimEvents, setFimEvents] = useState<CecurFIMEvent[]>([]);
  const [scaScans, setScaScans] = useState<CecurSCAScan[]>([]);
  const [complianceStandards, setComplianceStandards] = useState<CecurComplianceStandard[]>([]);
  const [decoders, setDecoders] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<CecurAgent | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  // AI Modal States
  const [aiModalType, setAiModalType] = useState<'log' | 'vuln' | 'fim' | 'compliance' | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [selectedItemForAI, setSelectedItemForAI] = useState<any>(null);

  // Load all initial Cecur platform data
  const loadData = async () => {
    try {
      setRefreshing(true);
      const [
        statusRes,
        agentsRes,
        alertsRes,
        logsRes,
        vulnsRes,
        fimRes,
        scaRes,
        complianceRes,
        decodersRes,
        rulesRes,
      ] = await Promise.all([
        apiRequest<CecurServerStatus>('/api/cecur/status'),
        apiRequest<{ total: number; agents: CecurAgent[] }>('/api/cecur/agents'),
        apiRequest<{ total: number; alerts: CecurAlert[] }>('/api/cecur/alerts'),
        apiRequest<{ total: number; logs: CecurLogEvent[] }>('/api/cecur/logs?limit=80'),
        apiRequest<{ total: number; vulnerabilities: CecurVulnerability[] }>('/api/cecur/vulnerabilities'),
        apiRequest<{ total: number; fimEvents: CecurFIMEvent[] }>('/api/cecur/fim'),
        apiRequest<{ totalScans: number; scans: CecurSCAScan[] }>('/api/cecur/sca'),
        apiRequest<{ standards: CecurComplianceStandard[] }>('/api/cecur/compliance'),
        apiRequest<{ total: number; decoders: any[] }>('/api/cecur/decoders'),
        apiRequest<{ total: number; rules: any[] }>('/api/cecur/rules'),
      ]);

      setServerStatus(statusRes);
      setAgents(agentsRes.agents);
      setAlerts(alertsRes.alerts);
      setLogs(logsRes.logs);
      setVulnerabilities(vulnsRes.vulnerabilities);
      setFimEvents(fimRes.fimEvents);
      setScaScans(scaRes.scans);
      setComplianceStandards(complianceRes.standards);
      setDecoders(decodersRes.decoders);
      setRules(rulesRes.rules);
    } catch (err: any) {
      console.error('Failed to load Cecur data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Execute Active Response
  const handleActiveResponse = async (agentId: string, command: string, params?: { targetIp?: string; processName?: string }) => {
    try {
      const res = await apiRequest<{ success: boolean; result: { message: string } }>(
        `/api/cecur/agents/${agentId}/action`,
        {
          method: 'POST',
          body: JSON.stringify({ command, ...params }),
        }
      );
      setActionMessage({ text: res.result.message, type: 'success' });
      setTimeout(() => setActionMessage(null), 5000);
      loadData();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Action failed', type: 'error' });
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  // Trigger AI Log Analysis
  const triggerAILogAnalysis = async (logItem: CecurLogEvent) => {
    setSelectedItemForAI(logItem);
    setAiModalType('log');
    setAiLoading(true);
    setAiAnalysisResult(null);

    try {
      const res = await apiRequest<{ success: boolean; analysis: any }>('/api/cecur/ai/analyze-log', {
        method: 'POST',
        body: JSON.stringify({
          logMessage: logItem.message,
          source: logItem.source,
          agentName: logItem.agentName,
          anomalyScore: logItem.anomalyScore,
        }),
      });
      setAiAnalysisResult(res.analysis);
    } catch (err: any) {
      setAiAnalysisResult({ error: err.message || 'AI Triage unavailable' });
    } finally {
      setAiLoading(false);
    }
  };

  // Trigger AI Vulnerability Remediation
  const triggerAIVulnRemediation = async (vulnItem: CecurVulnerability) => {
    setSelectedItemForAI(vulnItem);
    setAiModalType('vuln');
    setAiLoading(true);
    setAiAnalysisResult(null);

    try {
      const res = await apiRequest<{ success: boolean; remediation: any }>('/api/cecur/ai/remediate-vuln', {
        method: 'POST',
        body: JSON.stringify({
          cve: vulnItem.cve,
          title: vulnItem.title,
          package: vulnItem.package,
          installedVersion: vulnItem.installedVersion,
          fixedVersion: vulnItem.fixedVersion,
          agentOs: vulnItem.agentOs,
          cvss: vulnItem.cvss,
        }),
      });
      setAiAnalysisResult(res.remediation);
    } catch (err: any) {
      setAiAnalysisResult({ error: err.message || 'AI Remediation unavailable' });
    } finally {
      setAiLoading(false);
    }
  };

  // Trigger AI FIM Tamper Analysis
  const triggerAIFIMAnalysis = async (fimItem: CecurFIMEvent) => {
    setSelectedItemForAI(fimItem);
    setAiModalType('fim');
    setAiLoading(true);
    setAiAnalysisResult(null);

    try {
      const res = await apiRequest<{ success: boolean; triage: any }>('/api/cecur/ai/fim-triage', {
        method: 'POST',
        body: JSON.stringify({
          path: fimItem.path,
          eventType: fimItem.eventType,
          oldHash: fimItem.oldHash,
          newHash: fimItem.newHash,
          user: fimItem.user,
          processName: fimItem.processName,
          agentName: fimItem.agentName,
        }),
      });
      setAiAnalysisResult(res.triage);
    } catch (err: any) {
      setAiAnalysisResult({ error: err.message || 'AI Forensics unavailable' });
    } finally {
      setAiLoading(false);
    }
  };

  // Trigger AI Compliance Gap Analysis
  const triggerAIComplianceAnalysis = async (standard: CecurComplianceStandard) => {
    setSelectedItemForAI(standard);
    setAiModalType('compliance');
    setAiLoading(true);
    setAiAnalysisResult(null);

    try {
      const res = await apiRequest<{ success: boolean; briefing: any }>('/api/cecur/ai/compliance-gap', {
        method: 'POST',
        body: JSON.stringify({
          standardId: standard.id,
          failedChecksCount: standard.failedControls,
          topGaps: standard.topGaps,
        }),
      });
      setAiAnalysisResult(res.briefing);
    } catch (err: any) {
      setAiAnalysisResult({ error: err.message || 'AI Compliance Advisor unavailable' });
    } finally {
      setAiLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2500);
  };

  // Filtered lists based on search
  const filteredAgents = useMemo(() => {
    if (!searchQuery) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.ip.includes(q) ||
        a.os.name.toLowerCase().includes(q) ||
        a.workloadType.toLowerCase().includes(q)
    );
  }, [agents, searchQuery]);

  const filteredAlerts = useMemo(() => {
    if (!searchQuery) return alerts;
    const q = searchQuery.toLowerCase();
    return alerts.filter(
      (a) =>
        a.ruleTitle.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.agentName.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [alerts, searchQuery]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((l) => l.message.toLowerCase().includes(q) || l.agentName.toLowerCase().includes(q) || l.source.includes(q));
  }, [logs, searchQuery]);

  const filteredVulns = useMemo(() => {
    if (!searchQuery) return vulnerabilities;
    const q = searchQuery.toLowerCase();
    return vulnerabilities.filter(
      (v) => v.cve.toLowerCase().includes(q) || v.title.toLowerCase().includes(q) || v.package.toLowerCase().includes(q)
    );
  }, [vulnerabilities, searchQuery]);

  const filteredFIM = useMemo(() => {
    if (!searchQuery) return fimEvents;
    const q = searchQuery.toLowerCase();
    return fimEvents.filter((f) => f.path.toLowerCase().includes(q) || f.agentName.toLowerCase().includes(q));
  }, [fimEvents, searchQuery]);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-[var(--color-text-muted)] font-sans text-xs space-y-3 font-semibold">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <div>Connecting to Cecur Open-Source SIEM & XDR Indexer...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto font-sans">
      {/* Top Banner / Platform Identity */}
      <div className="app-card p-5 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-sm bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] flex items-center justify-center text-[var(--color-primary)] shrink-0">
              <Terminal className="w-6 h-6 text-[var(--color-primary)]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold text-[var(--color-text-dark)] font-sans uppercase tracking-tight">
                  Cecur SIEM & XDR Security Platform
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-[var(--color-surface-subtle)] text-[var(--color-primary)] rounded-sm border border-[var(--color-border-card)]">
                  {serverStatus?.version || 'v2.4.0-opensource'}
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-sm border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  INDEXER ONLINE
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-2xl font-sans leading-relaxed">
                Free open-source threat detection, log management, file integrity monitoring, vulnerability auditing, and regulatory compliance (PCI DSS, HIPAA, GDPR, NIST).
              </p>
            </div>
          </div>

          {/* Diagnostics Quick Badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3 py-1.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm text-xs font-sans">
              <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-bold">INGESTION EPS</span>
              <span className="text-[var(--color-primary)] font-bold font-mono">{serverStatus?.indexerStatus.eps.toLocaleString() || '18,450'} /s</span>
            </div>
            <div className="px-3 py-1.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm text-xs font-sans">
              <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-bold">AI REASONING</span>
              <span className="text-[var(--color-primary)] font-bold flex items-center gap-1 font-mono">
                <Sparkles className="w-3 h-3 text-[var(--color-primary)]" />
                {serverStatus?.aiCapabilities.geminiActive ? 'CS3-AI Dual Engine' : 'Heuristic Mode'}
              </span>
            </div>
            <button
              onClick={loadData}
              disabled={refreshing}
              className="p-2 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-dark)] rounded-sm border border-[var(--color-border-card)] text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Refresh Cecur Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Action Banner */}
        {actionMessage && (
          <div
            className={`mt-4 p-3 rounded-sm border text-xs flex items-center gap-2 font-sans font-semibold ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}
      </div>

      {/* Sub-tab Navigation Matrix */}
      <div className="flex border border-[var(--color-border-card)] bg-[var(--color-surface)] rounded-sm p-1 gap-1 overflow-x-auto">
        {[
          { id: 'fleet', name: 'Endpoint Fleet', icon: Server, count: agents.length },
          { id: 'logs', name: 'SIEM Log Management', icon: FileText, count: logs.length },
          { id: 'alerts', name: 'Threat Detection & XDR', icon: ShieldAlert, count: alerts.length },
          { id: 'vulnerabilities', name: 'Vulnerability Detection', icon: Shield, count: vulnerabilities.length },
          { id: 'fim', name: 'File Integrity (FIM)', icon: FileCheck2, count: fimEvents.length },
          { id: 'sca', name: 'SCA CIS Benchmarks', icon: Sliders, count: scaScans.length },
          { id: 'compliance', name: 'Regulatory Compliance', icon: Layers, count: complianceStandards.length },
          { id: 'server', name: 'Cecur Core Diagnostics', icon: Activity, count: decoders.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`cecur-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as CecurTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-sm text-xs font-sans font-bold transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[var(--color-primary)] text-white font-bold'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[var(--color-text-muted)]'}`} />
              <span>{tab.name}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-sm ${
                isActive ? 'bg-[#0070E0] text-white' : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border-card)]'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Global Filter Bar */}
      <div className="flex items-center justify-between gap-3 app-card p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${activeTab} data (hostname, CVE, IP, process, rule)...`}
            className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border-card)] rounded-sm text-xs text-[var(--color-text-dark)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] font-sans"
          />
        </div>
        <div className="text-xs text-[var(--color-text-muted)] font-sans hidden sm:block">
          Active Fleet: <span className="text-emerald-700 font-bold">{agents.filter((a) => a.status === 'active').length}</span> Online &bull;{' '}
          <span className="text-rose-700 font-bold">{agents.filter((a) => a.status === 'isolated').length}</span> Isolated
        </div>
      </div>

      {/* -------------------------------------------------------------
          TAB 1: ENDPOINT FLEET & WORKLOADS
      ------------------------------------------------------------- */}
      {activeTab === 'fleet' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                id={`cecur-agent-card-${agent.id}`}
                className={`app-card p-4 space-y-3 transition-all ${
                  agent.isolationStatus
                    ? 'bg-rose-50/40 border-rose-300'
                    : 'hover:border-[var(--color-primary)]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-[var(--color-text-dark)] font-sans">{agent.name}</span>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                          agent.isolationStatus
                            ? 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {agent.isolationStatus ? 'ISOLATED' : agent.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">{agent.ip} &bull; {agent.os.name}</p>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border-card)] uppercase font-semibold">
                    {agent.workloadType}
                  </span>
                </div>

                {/* Telemetry Gauge Mini-Grid */}
                <div className="grid grid-cols-3 gap-2 bg-[var(--color-surface-subtle)] p-2 rounded-sm border border-[var(--color-border-card)] text-[11px] font-mono">
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[9px] uppercase font-bold">CPU / MEM</span>
                    <span className="text-[var(--color-text-dark)] font-bold">{agent.cpuUsage}% / {agent.memoryUsage}%</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[9px] uppercase font-bold">FIM WATCH</span>
                    <span className="text-[var(--color-primary)] font-bold">{agent.fimMonitoredFilesCount} files</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[9px] uppercase font-bold">SCA CIS SCORE</span>
                    <span className={agent.scaScore > 80 ? 'text-emerald-700 font-bold' : 'text-blue-700 font-bold'}>{agent.scaScore}%</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {agent.group.map((g) => (
                    <span key={g} className="text-[10px] font-mono px-1.5 py-0.2 bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] rounded-sm border border-[var(--color-border-card)]">
                      #{g}
                    </span>
                  ))}
                  {agent.vulnerabilitiesCount.critical > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-rose-50 text-rose-800 rounded border border-rose-200 font-bold">
                      {agent.vulnerabilitiesCount.critical} Critical CVEs
                    </span>
                  )}
                </div>

                {/* Active Response Controls */}
                <div className="pt-2 border-t border-[var(--color-border-card)] flex items-center justify-between gap-2">
                  {agent.isolationStatus ? (
                    <button
                      onClick={() => handleActiveResponse(agent.id, 'unisolate-host')}
                      className="flex-1 py-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-sm text-xs font-sans font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Lift Isolation
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActiveResponse(agent.id, 'isolate-host')}
                      className="flex-1 py-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-sm text-xs font-sans font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      <Lock className="w-3 h-3" />
                      Zero-Trust Isolate
                    </button>
                  )}
                  <button
                    onClick={() => handleActiveResponse(agent.id, 'trigger-fim-scan')}
                    className="py-1 px-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-dark)] border border-[var(--color-border-card)] rounded-sm text-xs font-sans font-bold transition-colors cursor-pointer"
                    title="Trigger Instant FIM SHA-256 Scan"
                  >
                    Scan FIM
                  </button>
                  <button
                    onClick={() => handleActiveResponse(agent.id, 'trigger-sca-scan')}
                    className="py-1 px-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-dark)] border border-[var(--color-border-card)] rounded-sm text-xs font-sans font-bold transition-colors cursor-pointer"
                    title="Run CIS SCA Benchmark"
                  >
                    Run SCA
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 2: SIEM LOG MANAGEMENT & INGESTION EXPLORER
      ------------------------------------------------------------- */}
      {activeTab === 'logs' && (
        <div className="space-y-4 font-sans">
          <div className="app-card overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-surface-subtle)] border-b border-[var(--color-border-card)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="text-xs font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider">SIEM Log Ingestion Stream</span>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">Decoders: RFC5424, Auditd, WinEvtx, K8s, CloudTrail</span>
            </div>

            <div className="divide-y divide-[var(--color-border-card)] max-h-[600px] overflow-y-auto text-xs font-sans">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-3 hover:bg-[var(--color-surface-hover)] transition-colors space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.2 rounded-sm text-[10px] uppercase font-bold border ${
                          log.severity === 'critical' || log.severity === 'high'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : log.severity === 'medium'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border-[var(--color-border-card)]'
                        }`}
                      >
                        {log.severity}
                      </span>
                      <span className="text-[var(--color-text-muted)] text-[11px] font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className="text-[var(--color-primary)] font-bold">{log.agentName}</span>
                      <span className="text-[var(--color-text-muted)]">[{log.source}]</span>
                      <span className="text-[10px] font-mono px-1 bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] rounded border border-[var(--color-border-card)]">
                        {log.decoder}
                      </span>
                    </div>

                    {log.isAnomaly && (
                      <div className="flex items-center gap-2">
                        <span className="text-rose-700 text-[10px] bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded font-mono font-bold">
                          ANOMALY SCORE: {(log.anomalyScore * 100).toFixed(0)}%
                        </span>
                        <button
                          onClick={() => triggerAILogAnalysis(log)}
                          className="px-2 py-0.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-primary)] border border-[var(--color-border-card)] rounded-sm text-[10px] font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Sparkles className="w-3 h-3 text-[var(--color-primary)]" />
                          AI Triage
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-[var(--color-text-dark)] text-xs font-mono break-all leading-relaxed">{log.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 3: THREAT DETECTION & XDR ALERTS
      ------------------------------------------------------------- */}
      {activeTab === 'alerts' && (
        <div className="space-y-4 font-sans">
          <div className="grid grid-cols-1 gap-3">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`app-card p-4 space-y-3 transition-all ${
                  alert.ruleLevel >= 12 ? 'border-rose-300 bg-rose-50/20' : ''
                }`}
              >
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                          alert.ruleLevel >= 12
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : alert.ruleLevel >= 8
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border-[var(--color-border-card)]'
                        }`}
                      >
                        LEVEL {alert.ruleLevel}
                      </span>
                      <h3 className="text-sm font-extrabold text-[var(--color-text-dark)] font-sans">{alert.ruleTitle}</h3>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] font-sans mt-1">
                      Rule #{alert.ruleId} &bull; Host: <span className="text-[var(--color-primary)] font-bold">{alert.agentName}</span> ({alert.agentIp}) &bull;{' '}
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${
                      alert.status === 'new'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : alert.status === 'investigating'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>

                <p className="text-xs text-[var(--color-text-muted)] font-sans leading-relaxed">{alert.description}</p>

                {/* Raw Event Context */}
                <div className="bg-[var(--color-surface-subtle)] p-2.5 rounded-sm border border-[var(--color-border-card)] text-xs font-mono text-[var(--color-text-muted)] break-all">
                  {alert.fullLog}
                </div>

                {/* MITRE and Compliance Badges */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[var(--color-border-card)] text-xs font-sans">
                  <div className="flex items-center gap-2 flex-wrap font-mono">
                    {alert.mitreTechnique && (
                      <span className="text-[10px] bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-border-card)] px-2 py-0.5 rounded font-bold">
                        MITRE: {alert.mitreTechnique}
                      </span>
                    )}
                    {alert.complianceTags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border-card)] px-1.5 py-0.2 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        triggerAILogAnalysis({
                          id: alert.id,
                          timestamp: alert.timestamp,
                          agentId: alert.agentId,
                          agentName: alert.agentName,
                          source: 'auth.log',
                          severity: 'critical',
                          message: alert.fullLog,
                          fields: {},
                          isAnomaly: true,
                          anomalyScore: 0.95,
                          decoder: alert.decoderMatched,
                        })
                      }
                      className="px-2.5 py-1 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-primary)] border border-[var(--color-border-card)] rounded-sm text-xs font-sans font-bold flex items-center gap-1.5 cursor-pointer transition-colors uppercase tracking-wider"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      AI Threat Triage
                    </button>
                    {canPerformAction('cecur_isolate_host') && (
                      <button
                        onClick={() => handleActiveResponse(alert.agentId, 'isolate-host')}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-sm text-xs font-sans font-bold transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        Quarantine Agent
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 4: VULNERABILITY DETECTION & CVE REMEDIATION
      ------------------------------------------------------------- */}
      {activeTab === 'vulnerabilities' && (
        <div className="space-y-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVulns.map((vuln) => (
              <div key={vuln.id} className="app-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-[var(--color-primary)] font-mono">{vuln.cve}</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                          vuln.severity === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : vuln.severity === 'HIGH'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border-[var(--color-border-card)]'
                        }`}
                      >
                        CVSS {vuln.cvss} ({vuln.severity})
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-[var(--color-text-dark)] mt-1 font-sans">{vuln.title}</h4>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      vuln.status === 'VULNERABLE'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {vuln.status}
                  </span>
                </div>

                <div className="bg-[var(--color-surface-subtle)] p-2.5 rounded-sm border border-[var(--color-border-card)] text-xs font-sans space-y-1">
                  <div className="flex justify-between text-[var(--color-text-muted)]">
                    <span>Package:</span>
                    <span className="text-[var(--color-text-dark)] font-bold font-mono">{vuln.package}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-text-muted)]">
                    <span>Installed Version:</span>
                    <span className="text-rose-700 font-bold font-mono">{vuln.installedVersion}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-text-muted)]">
                    <span>Fixed in Version:</span>
                    <span className="text-emerald-700 font-bold font-mono">{vuln.fixedVersion}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-text-muted)]">
                    <span>Affected Host:</span>
                    <span className="text-[var(--color-primary)] font-bold font-mono">{vuln.agentName} ({vuln.agentOs})</span>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-text-muted)] font-sans leading-relaxed">{vuln.remediationGuide}</p>

                <div className="pt-2 border-t border-[var(--color-border-card)] flex items-center justify-between">
                  <div className="flex gap-1 text-[10px] font-mono">
                    {vuln.compliance.map((c) => (
                      <span key={c} className="px-1.5 py-0.2 bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border-card)] rounded-sm">
                        {c}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => triggerAIVulnRemediation(vuln)}
                    className="px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[#0070E0] text-white rounded-sm text-xs font-sans font-bold flex items-center gap-1.5 cursor-pointer transition-colors uppercase tracking-wider"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    Generate Patch Scripts
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 5: FILE INTEGRITY MONITORING (FIM)
      ------------------------------------------------------------- */}
      {activeTab === 'fim' && (
        <div className="space-y-4 font-sans">
          <div className="app-card overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-surface-subtle)] border-b border-[var(--color-border-card)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="text-xs font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider">
                  Cryptographic File Integrity Monitoring (FIM)
                </span>
              </div>
              <button
                onClick={() => apiRequest('/api/cecur/fim/scan', { method: 'POST' }).then(() => loadData())}
                className="px-2.5 py-1 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-dark)] border border-[var(--color-border-card)] rounded-sm text-xs font-sans font-bold transition-colors flex items-center gap-1 cursor-pointer uppercase tracking-wider"
              >
                <Play className="w-3 h-3 text-[var(--color-primary)]" />
                Run Fleet Integrity Sweep
              </button>
            </div>

            <div className="divide-y divide-[var(--color-border-card)]">
              {filteredFIM.map((fim) => (
                <div key={fim.id} className="p-4 hover:bg-[var(--color-surface-hover)] transition-colors space-y-2">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.2 rounded border ${
                            fim.isTamperAlert ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border-[var(--color-border-card)]'
                          }`}
                        >
                          {fim.eventType}
                        </span>
                        <span className="text-xs font-mono font-bold text-[var(--color-text-dark)]">{fim.path}</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] font-sans mt-0.5">
                        Host: <span className="text-[var(--color-primary)] font-bold font-mono">{fim.agentName}</span> &bull; Executing Process:{' '}
                        <span className="text-[var(--color-text-dark)] font-mono">{fim.processName || 'N/A'}</span> &bull; Actor:{' '}
                        <span className="text-[var(--color-text-dark)] font-mono">{fim.user || 'root'}</span> &bull; {new Date(fim.timestamp).toLocaleString()}
                      </p>
                    </div>

                    <button
                      onClick={() => triggerAIFIMAnalysis(fim)}
                      className="px-2.5 py-1 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-primary)] border border-[var(--color-border-card)] rounded-sm text-xs font-sans font-bold flex items-center gap-1.5 cursor-pointer transition-colors uppercase tracking-wider"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      AI Tamper Forensics
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[var(--color-surface-subtle)] p-2.5 rounded-sm border border-[var(--color-border-card)] text-xs font-mono">
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-bold">OLD SHA-256 HASH</span>
                      <span className="text-[var(--color-text-muted)] break-all">{fim.oldHash || 'N/A (New File Created)'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-bold">NEW SHA-256 HASH (COMPUTED)</span>
                      <span className="text-[var(--color-primary)] font-bold break-all">{fim.newHash || 'N/A (File Removed)'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 6: SECURITY CONFIGURATION ASSESSMENT (SCA / CIS)
      ------------------------------------------------------------- */}
      {activeTab === 'sca' && (
        <div className="space-y-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scaScans.map((scan) => (
              <div key={scan.id} className="bg-[#0C1B2B] border border-[#1A3959] border-t-3 border-t-[#00E5FF] rounded-none p-4 space-y-3 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#FFFFFF] font-sans">{scan.benchmark.replace(/_/g, ' ')}</h3>
                    <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
                      Host: <span className="text-[#00E5FF] font-bold">{scan.agentName}</span> ({scan.agentOs})
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className={`text-lg font-bold ${scan.score > 85 ? 'text-emerald-400' : 'text-[#00E5FF]'}`}>
                      {scan.score}%
                    </span>
                    <span className="text-[#94A3B8] block text-[10px] font-sans uppercase font-bold">PASS SCORE</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#1A3959]">
                  {scan.checks.map((check) => (
                    <div key={check.id} className="bg-[#12283E] p-2.5 rounded-[2px] border border-[#1A3959] space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#FFFFFF] font-semibold">{check.checkId} - {check.title}</span>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                            check.status === 'PASS'
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                              : 'bg-rose-950/40 text-rose-300 border-rose-800'
                          }`}
                        >
                          {check.status}
                        </span>
                      </div>
                      <p className="text-[#94A3B8] text-[11px] font-sans leading-relaxed">{check.rationale}</p>
                      {check.status === 'FAIL' && (
                        <div className="bg-[#0C1B2B] p-1.5 rounded border border-rose-900/50 text-[11px] font-mono text-rose-300 flex items-center justify-between">
                          <span className="truncate">{check.remediation}</span>
                          <button
                            onClick={() => copyToClipboard(check.remediation, check.id)}
                            className="text-[#00E5FF] hover:text-[#FFFFFF] text-[10px] ml-2 shrink-0 font-bold"
                          >
                            {copiedScript === check.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 7: REGULATORY COMPLIANCE MATRIX (NIST 800-53, NIST 800-171, PCI, HIPAA, GDPR)
      ------------------------------------------------------------- */}
      {activeTab === 'compliance' && (
        <div className="space-y-6 font-sans">
          {/* NIST Federal & CUI Spotlight Banner */}
          <div className="bg-[#0C1B2B] border border-[#00E5FF]/40 p-4 rounded-[2px] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-[#00E5FF] rounded">
                <ShieldCheck className="w-6 h-6 text-[#00E5FF]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-[#FFFFFF] tracking-tight font-sans">
                    NIST SP 800-53 Rev 5 &amp; NIST SP 800-171 Rev 3 Dual Baseline
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950/60 text-emerald-300 border border-emerald-700 rounded font-bold">
                    CONTINUOUS AUTHORIZATION
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] font-sans mt-0.5">
                  Governing Federal Systems &amp; Nonfederal Defense Industrial Base (DIB) CUI Enclaves with DoD SPRS scoring and cryptographic chain integrity.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-stretch md:self-auto shrink-0">
              <div className="bg-[#12283E] px-3.5 py-1.5 rounded border border-[#1A3959] text-center">
                <span className="text-xs text-[#94A3B8] block uppercase font-mono font-bold">DoD SPRS Score</span>
                <span className="text-base font-extrabold text-emerald-400 font-mono">104 / 110</span>
              </div>
              <div className="bg-[#12283E] px-3.5 py-1.5 rounded border border-[#1A3959] text-center">
                <span className="text-xs text-[#94A3B8] block uppercase font-mono font-bold">CMMC 2.0 / 3.0</span>
                <span className="text-base font-extrabold text-[#00E5FF] font-mono">Level 2 (94.5%)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complianceStandards.map((std) => (
              <div key={std.id} className="bg-[#0C1B2B] border border-[#1A3959] border-t-3 border-t-[#00E5FF] rounded-none p-5 space-y-4 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-[#FFFFFF] font-sans">{std.name}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-[#12283E] text-[#00E5FF] border border-[#00E5FF]/40 rounded-[2px] font-bold">
                        {std.version}
                      </span>
                      {std.sprsScore !== undefined && (
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-950/60 text-amber-300 border border-amber-600 rounded font-bold">
                          SPRS: {std.sprsScore}/110
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#94A3B8] font-sans mt-1 leading-relaxed">{std.description}</p>
                    {std.cuiEnclaveStatus && (
                      <div className="mt-2 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{std.cuiEnclaveStatus}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right font-mono shrink-0 pl-2">
                    <span className="text-xl font-bold text-[#00E5FF]">{std.complianceScore}%</span>
                    <span className="text-[#94A3B8] block text-[10px] font-sans uppercase font-bold">
                      {std.passedControls}/{std.controlsCount} CONTROLS
                    </span>
                  </div>
                </div>

                {/* Domain Breakdown */}
                <div className="space-y-2 pt-2 border-t border-[#1A3959]">
                  <span className="text-xs font-sans font-extrabold text-[#FFFFFF] uppercase tracking-wider">Control Domain Posture</span>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {std.domains.map((dom) => (
                      <div key={dom.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-sans">
                          <span className="text-[#94A3B8] truncate max-w-[280px] font-semibold">{dom.name}</span>
                          <span className="text-[#FFFFFF] font-bold font-mono">
                            {dom.passingRules}/{dom.rulesCount} ({dom.score}%)
                          </span>
                        </div>
                        <div className="w-full bg-[#12283E] h-1.5 rounded-full overflow-hidden border border-[#1A3959]">
                          <div
                            className={`h-full rounded-full ${dom.score >= 95 ? 'bg-emerald-400' : dom.score >= 90 ? 'bg-[#00E5FF]' : 'bg-amber-400'}`}
                            style={{ width: `${dom.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plan of Action & Milestones (POA&M) Table for NIST SP 800-171 */}
                {std.poamItems && std.poamItems.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#1A3959]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-sans font-extrabold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Active POA&amp;M Remediation Items ({std.poamItems.length})
                      </span>
                      <span className="text-[10px] font-mono text-[#94A3B8]">03.12.02 Compliant</span>
                    </div>

                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {std.poamItems.map((item) => (
                        <div key={item.id} className="bg-[#12283E] p-2 rounded-[2px] border border-[#1A3959] text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[#00E5FF] font-bold">{item.controlId}</span>
                              <span className="font-semibold text-[#FFFFFF] truncate max-w-[200px]">{item.title}</span>
                            </div>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                                item.status === 'VALIDATING'
                                  ? 'bg-blue-950/60 text-blue-300 border border-blue-700'
                                  : item.status === 'IN_PROGRESS'
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-700'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8] leading-tight">{item.description}</p>
                          <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono pt-1">
                            <span>Owner: {item.owner}</span>
                            <span>Target: {item.scheduledCompletion}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Gaps */}
                <div className="bg-[#12283E] p-3 rounded-[2px] border border-[#1A3959] space-y-1.5 text-xs">
                  <span className="font-sans font-bold text-rose-400 uppercase text-[10px]">Identified Audit Findings</span>
                  {std.topGaps.map((gap, i) => (
                    <div key={i} className="text-[#94A3B8] font-sans text-xs flex items-start gap-1.5">
                      <span className="text-rose-400 shrink-0">&bull;</span>
                      <span>{gap}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => triggerAIComplianceAnalysis(std)}
                  className="w-full py-2 bg-[#00E5FF]/15 hover:bg-[#00E5FF]/25 text-[#00E5FF] border border-[#00E5FF]/40 rounded-[2px] text-xs font-sans font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors uppercase tracking-wider"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
                  Generate AI Executive Audit Briefing &amp; Gap Mitigation
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 8: CECUR CORE SERVER & DECODERS DIAGNOSTICS
      ------------------------------------------------------------- */}
      {activeTab === 'server' && (
        <div className="space-y-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Decoders Catalog */}
            <div className="bg-[#0C1B2B] border border-[#1A3959] border-t-3 border-t-[#00E5FF] rounded-none p-4 space-y-3 shadow-xs">
              <h3 className="text-xs font-sans font-extrabold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[#00E5FF]" />
                Active Decoders Engine ({decoders.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {decoders.map((dec) => (
                  <div key={dec.name} className="bg-[#12283E] p-2.5 rounded-[2px] border border-[#1A3959] text-xs space-y-1 font-sans">
                    <div className="flex items-center justify-between">
                      <span className="text-[#00E5FF] font-extrabold font-mono">{dec.name}</span>
                      <span className="text-[#94A3B8] uppercase text-[10px] font-bold font-mono">{dec.type}</span>
                    </div>
                    <p className="text-[#94A3B8] font-sans text-xs">{dec.description}</p>
                    <div className="text-[10px] text-[#94A3B8] truncate font-mono">
                      Extracted Fields: {dec.fieldsExtracted.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rules Catalog */}
            <div className="bg-[#0C1B2B] border border-[#1A3959] border-t-3 border-t-[#00E5FF] rounded-none p-4 space-y-3 shadow-xs">
              <h3 className="text-xs font-sans font-extrabold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Built-in Detection Rules Catalog ({rules.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {rules.map((rule) => (
                  <div key={rule.id} className="bg-[#12283E] p-2.5 rounded-[2px] border border-[#1A3959] text-xs space-y-1 font-sans">
                    <div className="flex items-center justify-between">
                      <span className="text-[#FFFFFF] font-bold font-mono">Rule #{rule.id}</span>
                      <span className="text-[#00E5FF] text-[10px] font-bold font-mono">LEVEL {rule.level}</span>
                    </div>
                    <h4 className="text-[#94A3B8] font-sans text-xs font-bold">{rule.title}</h4>
                    <div className="text-[10px] text-[#00E5FF] font-mono font-bold">{rule.mitreTechnique}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          AI MODAL DIALOG (CS3-AI DUAL ENGINE)
      ------------------------------------------------------------- */}
      {aiModalType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-[#060B12] border border-[#1A3959] border-t-4 border-t-[#00E5FF] rounded-md shadow-[0_0_40px_rgba(0,229,255,0.15)] overflow-hidden flex flex-col max-h-[85vh] font-sans text-[#FFFFFF]">
            {/* Header */}
            <div className="px-6 py-4 bg-[#0C1B2B] border-b border-[#1A3959] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#00E5FF]/10 border border-[#00E5FF]/30 rounded text-[#00E5FF]">
                  <Sparkles className="w-5 h-5 text-[#00E5FF]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#FFFFFF] font-sans">
                    {aiModalType === 'log' && 'AI SIEM Anomaly Triage & ATT&CK Correlation'}
                    {aiModalType === 'vuln' && 'AI Vulnerability Remediation Script Generator'}
                    {aiModalType === 'fim' && 'AI Cryptographic FIM Tamper Forensics'}
                    {aiModalType === 'compliance' && 'AI GRC Compliance Briefing & Gap Mitigation'}
                  </h3>
                  <p className="text-xs text-[#94A3B8] font-mono">
                    Powered by CS3-AI Dual Engine &bull; CS3 Agent & CECUR-IT Agent
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAiModalType(null)}
                className="text-[#94A3B8] hover:text-[#FFFFFF] text-xs p-1 font-bold cursor-pointer"
              >
                Close &times;
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {aiLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3 text-[#00E5FF] font-sans text-xs font-bold">
                  <div className="w-6 h-6 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
                  <div>Synthesizing Deep Security Reasoning across MITRE ATT&CK & CVE Database...</div>
                </div>
              ) : aiAnalysisResult ? (
                <div className="space-y-4">
                  {/* Engine Used Badge */}
                  <div className="flex items-center justify-between text-xs font-sans text-[#94A3B8] border-b border-[#1A3959] pb-2">
                    <span>Inference Engine: <strong className="text-[#00E5FF]">{aiAnalysisResult.engineUsed || 'Cecur Hybrid AI'}</strong></span>
                    {aiAnalysisResult.confidenceScore && (
                      <span>Confidence Score: <strong className="text-emerald-400 font-mono">{aiAnalysisResult.confidenceScore}%</strong></span>
                    )}
                  </div>

                  {/* 1. Log Anomaly Result */}
                  {aiModalType === 'log' && (
                    <div className="space-y-3 font-sans text-xs">
                      <div className="p-3 bg-[#0C1B2B] rounded border border-[#1A3959] space-y-1">
                        <span className="text-[#94A3B8] font-sans uppercase text-[10px] font-bold block">Executive Triage Summary</span>
                        <p className="text-[#FFFFFF] text-sm leading-relaxed">{aiAnalysisResult.triageSummary}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-[#0C1B2B] p-3 rounded border border-[#1A3959]">
                          <span className="text-[#94A3B8] text-[10px] font-bold block uppercase">MITRE TACTIC & TECHNIQUE</span>
                          <span className="text-[#00E5FF] font-bold font-mono">{aiAnalysisResult.mitreTactic}</span>
                          <p className="text-[#94A3B8] text-xs mt-0.5">{aiAnalysisResult.mitreTechnique}</p>
                        </div>
                        <div className="bg-[#0C1B2B] p-3 rounded border border-[#1A3959]">
                          <span className="text-[#94A3B8] text-[10px] font-bold block uppercase">SEVERITY RATING</span>
                          <span className="text-rose-400 font-bold font-mono">{aiAnalysisResult.severityAssessment}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-[#0C1B2B] rounded border border-[#1A3959] space-y-1">
                        <span className="text-[#94A3B8] font-sans uppercase text-[10px] font-bold block">Probable Root Cause</span>
                        <p className="text-[#94A3B8] leading-relaxed">{aiAnalysisResult.probableRootCause}</p>
                      </div>

                      <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded space-y-1">
                        <span className="text-emerald-400 font-sans uppercase text-[10px] font-bold block">Immediate Containment Action</span>
                        <p className="text-emerald-300 leading-relaxed font-mono">{aiAnalysisResult.recommendedImmediateAction}</p>
                      </div>
                    </div>
                  )}

                  {/* 2. Vulnerability Remediation Result */}
                  {aiModalType === 'vuln' && (
                    <div className="space-y-4 font-sans text-xs">
                      <div className="p-3 bg-[#0C1B2B] rounded border border-[#1A3959] space-y-1">
                        <span className="text-[#94A3B8] uppercase text-[10px] font-bold block">Executive Patch Plan</span>
                        <p className="text-[#FFFFFF] text-sm leading-relaxed">{aiAnalysisResult.executiveSummary}</p>
                      </div>

                      {/* Bash Script Output */}
                      {aiAnalysisResult.bashScript && (
                        <div className="space-y-1.5 font-sans">
                          <div className="flex items-center justify-between text-xs text-[#94A3B8] font-bold">
                            <span>Linux Bash Remediation Script:</span>
                            <button
                              onClick={() => copyToClipboard(aiAnalysisResult.bashScript, 'bash')}
                              className="px-2 py-0.5 bg-[#12283E] hover:bg-[#1A3959] text-[#FFFFFF] border border-[#1A3959] rounded text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                            >
                              <Copy className="w-3 h-3 text-[#00E5FF]" />
                              {copiedScript === 'bash' ? 'Copied' : 'Copy Script'}
                            </button>
                          </div>
                          <pre className="p-3 bg-[#0C1B2B] rounded border border-[#1A3959] text-xs text-[#00E5FF] overflow-x-auto whitespace-pre font-mono">
                            {aiAnalysisResult.bashScript}
                          </pre>
                        </div>
                      )}

                      {/* PowerShell Script Output */}
                      {aiAnalysisResult.powerShellScript && (
                        <div className="space-y-1.5 font-sans">
                          <div className="flex items-center justify-between text-xs text-[#94A3B8] font-bold">
                            <span>Windows PowerShell Remediation Script:</span>
                            <button
                              onClick={() => copyToClipboard(aiAnalysisResult.powerShellScript, 'ps')}
                              className="px-2 py-0.5 bg-[#12283E] hover:bg-[#1A3959] text-[#FFFFFF] border border-[#1A3959] rounded text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                            >
                              <Copy className="w-3 h-3 text-[#00E5FF]" />
                              {copiedScript === 'ps' ? 'Copied' : 'Copy Script'}
                            </button>
                          </div>
                          <pre className="p-3 bg-[#0C1B2B] rounded border border-[#1A3959] text-xs text-[#00E5FF] overflow-x-auto whitespace-pre font-mono">
                            {aiAnalysisResult.powerShellScript}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. FIM Tamper Result */}
                  {aiModalType === 'fim' && (
                    <div className="space-y-3 font-sans text-xs">
                      <div className="p-3 bg-[#0C1B2B] rounded border border-[#1A3959] space-y-1">
                        <span className="text-[#94A3B8] font-sans uppercase text-[10px] font-bold block">Forensic Explanation</span>
                        <p className="text-[#FFFFFF] text-sm leading-relaxed">{aiAnalysisResult.tamperExplanation}</p>
                      </div>

                      <div className="p-3 bg-[#0C1B2B] rounded border border-[#1A3959] space-y-1 font-sans">
                        <span className="text-[#94A3B8] text-[10px] font-bold uppercase block">CORRELATED FORENSIC ARTIFACTS</span>
                        {aiAnalysisResult.forensicArtifacts?.map((art: string, i: number) => (
                          <div key={i} className="text-[#94A3B8] text-xs font-mono">
                            &bull; {art}
                          </div>
                        ))}
                      </div>

                      <div className="p-3 bg-rose-950/40 border border-rose-900 rounded space-y-1">
                        <span className="text-rose-400 font-sans uppercase text-[10px] font-bold block">Suggested Containment</span>
                        <p className="text-rose-300 leading-relaxed font-mono">{aiAnalysisResult.suggestedContainment}</p>
                      </div>
                    </div>
                  )}

                  {/* 4. Compliance Gap Result */}
                  {aiModalType === 'compliance' && (
                    <div className="space-y-3 font-sans text-xs">
                      <div className="p-3 bg-[#0C1B2B] rounded border border-[#1A3959] space-y-1">
                        <span className="text-[#94A3B8] font-sans uppercase text-[10px] font-bold block">Compliance Audit Posture</span>
                        <p className="text-[#FFFFFF] text-sm leading-relaxed">{aiAnalysisResult.compliancePosture}</p>
                      </div>

                      <div className="p-3 bg-[#0C1B2B] rounded border border-[#1A3959] space-y-2">
                        <span className="text-[#94A3B8] font-sans uppercase text-[10px] font-bold block">Remediation Roadmap</span>
                        {aiAnalysisResult.remediationRoadmap?.map((road: any, idx: number) => (
                          <div key={idx} className="bg-[#12283E] p-2.5 rounded border border-[#1A3959] space-y-0.5">
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="text-[#00E5FF] font-bold">{road.phase}</span>
                              <span className="text-rose-400 font-semibold">{road.priority}</span>
                            </div>
                            <p className="text-[#94A3B8] text-xs leading-relaxed font-sans">{road.description}</p>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 bg-[#00E5FF]/10 border border-[#00E5FF]/30 rounded space-y-1">
                        <span className="text-[#00E5FF] font-sans uppercase text-[10px] font-bold block">Auditor Attestation Briefing</span>
                        <p className="text-[#FFFFFF] leading-relaxed text-xs">{aiAnalysisResult.auditorBriefing}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
