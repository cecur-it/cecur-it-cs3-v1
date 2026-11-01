import React, { useState, useEffect } from 'react';
import {
  Crosshair,
  ShieldCheck,
  Play,
  Plus,
  Trash2,
  AlertTriangle,
  FileCode,
  Terminal,
  Activity,
  CheckCircle,
  ExternalLink,
  ShieldAlert,
  Server,
  X,
  Share2,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  TargetAllowlistEntry,
  ErrowTask,
  ErrowFinding,
} from '../../types';
import { getSeverityBadgeStyle } from '../../theme';
import { ExportModal } from '../common/ExportModal';
import { buildErrowExportPayload, ExportPayload } from '../../lib/exportUtils';

interface ErrowStatus {
  mode: 'LIVE' | 'DEMO';
  baseUrl?: string;
  authenticated: boolean;
  activeScanCount: number;
  availableTools: string[];
  agentMode?: string;
  sandboxRuntime?: string;
  message: string;
}

export const ErrowPanel: React.FC = () => {
  const { canPerformAction, user } = useAuth();
  const [status, setStatus] = useState<ErrowStatus | null>(null);
  const [targets, setTargets] = useState<TargetAllowlistEntry[]>([]);
  const [jobs, setJobs] = useState<ErrowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<ErrowTask | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPayload, setExportPayload] = useState<ExportPayload | null>(null);

  // Scan Trigger Modal State
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanTargetId, setScanTargetId] = useState('');
  const [scanTool, setScanTool] = useState<string>('nuclei_scan');
  const [scanning, setScanning] = useState(false);

  // Add Target Modal State
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [newHostname, setNewHostname] = useState('');
  const [newIpRange, setNewIpRange] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statusRes, targetsRes, jobsRes] = await Promise.all([
        apiRequest<ErrowStatus>('/api/errow/status'),
        apiRequest<{ count: number; targets: TargetAllowlistEntry[] }>('/api/errow/allowlist'),
        apiRequest<{ total: number; jobs: ErrowTask[] }>('/api/errow/jobs'),
      ]);
      setStatus(statusRes);
      setTargets(targetsRes.targets);
      setJobs(jobsRes.jobs);
      if (jobsRes.jobs.length > 0 && !selectedJob) {
        setSelectedJob(jobsRes.jobs[0]);
      }
      if (targetsRes.targets.length > 0 && !scanTargetId) {
        setScanTargetId(targetsRes.targets[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load Errow data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = targets.find((t) => t.id === scanTargetId);
    if (!target) return;

    setScanning(true);
    try {
      const res = await apiRequest<{ success: boolean; job: ErrowTask }>('/api/errow/run-scan', {
        method: 'POST',
        body: JSON.stringify({
          targetId: target.id,
          targetHost: target.hostname,
          tool: scanTool,
        }),
      });
      setJobs((prev) => [res.job, ...prev]);
      setSelectedJob(res.job);
      setScanModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Scan execution failed');
    } finally {
      setScanning(false);
    }
  };

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ success: boolean; target: TargetAllowlistEntry }>(
        '/api/errow/allowlist',
        {
          method: 'POST',
          body: JSON.stringify({
            hostname: newHostname,
            ipRange: newIpRange,
            ownerDepartment: newDept,
            notes: newNotes,
          }),
        }
      );
      setTargets((prev) => [res.target, ...prev]);
      setTargetModalOpen(false);
      setNewHostname('');
      setNewIpRange('');
      setNewDept('');
      setNewNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to add target to allowlist');
    }
  };

  const handleDeleteTarget = async (id: string) => {
    if (!confirm('Are you sure you want to revoke authorization and remove this target from the allowlist?')) return;
    try {
      await apiRequest(`/api/errow/allowlist/${id}`, { method: 'DELETE' });
      setTargets((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to remove target');
    }
  };

  const handleExportFindings = () => {
    const payload = buildErrowExportPayload(jobs, targets);
    setExportPayload(payload);
    setExportModalOpen(true);
  };

  return (
    <div id="panel-errow" className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Export & Sharing Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        payload={exportPayload}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-lg font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider">
              errow Offensive Reconnaissance & Auditing
            </h1>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-sans">
            Automated defensive reconnaissance, port auditing, vulnerability template sweeps, and strict target allowlist gating.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-export-errow-findings"
            onClick={handleExportFindings}
            className="px-3.5 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-primary)] border border-[var(--color-border-card)] rounded-sm text-xs font-bold font-mono flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Export Findings &amp; Scope</span>
          </button>

          {canPerformAction('run_scan') && (
            <button
              id="btn-open-run-scan-modal"
              onClick={() => setScanModalOpen(true)}
              className="px-3.5 py-2 bg-[var(--color-primary)] hover:bg-[#0070E0] text-[var(--color-text-light)] font-extrabold text-xs rounded-sm transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Trigger Scoped Recon Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode Status & Guardrails Banner */}
      <div className="app-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-sans">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-sm border ${
                status?.mode === 'LIVE'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-[var(--color-surface-subtle)] text-[var(--color-primary)] border-[var(--color-border-card)]'
              }`}
            >
              {status?.mode === 'LIVE' ? 'LIVE CONNECTOR ONLINE' : 'SOC SIMULATION MODE'}
            </span>
            <span className="text-[var(--color-text-muted)] font-mono text-[11px]">
              {status?.baseUrl ? `Host: ${status.baseUrl}` : 'Deterministic Heuristic Engine'}
              {status?.sandboxRuntime ? ` · Sandbox: ${status.sandboxRuntime} (${status.agentMode})` : ''}
            </span>
          </div>
          <p className="text-[var(--color-text-dark)] font-sans text-xs">{status?.message}</p>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)] font-bold">
          <ShieldCheck className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
          <span>Strict Allowlist & Safe Tool Constraints Active</span>
        </div>
      </div>

      {/* Target Allowlist Section */}
      <div className="app-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider">
              Authorized Target Allowlist ({targets.length})
            </h2>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Scans can ONLY be executed against verified, allowlisted infrastructure hosts.
            </p>
          </div>

          {canPerformAction('manage_allowlist') && (
            <button
              onClick={() => setTargetModalOpen(true)}
              className="px-2.5 py-1.5 text-xs font-bold bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-dark)] border border-[var(--color-border-card)] rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Target</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {targets.map((tgt) => (
            <div
              key={tgt.id}
              className="p-3.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm text-xs space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <div className="font-mono font-bold text-[var(--color-text-dark)] truncate">{tgt.hostname}</div>
                  <span className="px-1.5 py-0.2 text-[9px] font-sans font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-sm">
                    AUTHORIZED
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[var(--color-primary)] font-bold">{tgt.ipRange}</div>
                <div className="text-[11px] text-[var(--color-text-muted)] font-bold mt-1">{tgt.ownerDepartment}</div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1 line-clamp-2">{tgt.notes}</p>
              </div>

              <div className="pt-2 border-t border-[var(--color-border-card)] flex items-center justify-between text-[10px] font-mono text-[var(--color-text-muted)]">
                <span>Scans: {tgt.scanCount}</span>
                {canPerformAction('manage_allowlist') && (
                  <button
                    onClick={() => handleDeleteTarget(tgt.id)}
                    className="text-[var(--color-text-muted)] hover:text-rose-700 p-1 transition-colors cursor-pointer"
                    title="Revoke and Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scan Jobs & Findings Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs List */}
        <div className="space-y-3">
          <h2 className="text-xs font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider">
            Recon Job History ({jobs.length})
          </h2>

          <div className="space-y-2">
            {jobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`p-3.5 rounded-sm border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[var(--color-surface)] border-[var(--color-primary)] border-l-4 shadow-sm'
                      : 'bg-[var(--color-surface)] border-[var(--color-border-card)] hover:border-[var(--color-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-bold text-[var(--color-text-dark)]">{job.tool}</span>
                    <span
                      className={`text-[10px] font-sans font-extrabold uppercase px-1.5 py-0.2 rounded-sm border ${
                        job.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : job.status === 'RUNNING'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-[var(--color-text-muted)] truncate">{job.targetHost}</div>

                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[var(--color-text-muted)]">
                    <span>Findings: {job.findingsCount}</span>
                    <span>{new Date(job.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Job Findings & Output Inspector */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider">
            Job Telemetry & Vulnerability Findings
          </h2>

          {selectedJob ? (
            <div className="app-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-[var(--color-border-card)] pb-3">
                <div>
                  <div className="text-xs font-mono text-[var(--color-primary)] font-bold">{selectedJob.tool}</div>
                  <h3 className="text-sm font-extrabold text-[var(--color-text-dark)] font-sans">{selectedJob.targetHost}</h3>
                  <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    Executed by: {selectedJob.triggeredBy} • Job ID: {selectedJob.id}
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-sm">
                  {selectedJob.findings.length} Vulnerabilities Found
                </span>
              </div>

              {/* Findings Cards */}
              <div className="space-y-3">
                {selectedJob.findings.map((fnd) => (
                  <div key={fnd.id} className="p-3.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-extrabold text-[var(--color-text-dark)] text-sm font-sans">{fnd.title}</div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-sans font-extrabold rounded-sm border shrink-0 uppercase ${getSeverityBadgeStyle(
                          fnd.severity
                        )}`}
                      >
                        {fnd.severity} {fnd.cvss ? `(CVSS ${fnd.cvss})` : ''}
                      </span>
                    </div>

                    <p className="text-[var(--color-text-muted)] leading-relaxed font-sans">{fnd.description}</p>

                    <div className="p-2.5 bg-[var(--color-surface)] rounded-sm border border-[var(--color-border-card)] text-[11px] space-y-1">
                      <div className="text-emerald-800 font-sans font-bold">Remediation Recommendation:</div>
                      <p className="text-[var(--color-text-dark)]">{fnd.remediation}</p>
                    </div>

                    <div className="text-[10px] font-mono text-[var(--color-text-muted)] flex gap-4">
                      {fnd.cve && <span className="text-rose-700 font-bold">CVE: {fnd.cve}</span>}
                      {fnd.port && <span>Port: {fnd.port}</span>}
                      {fnd.endpoint && <span>Endpoint: {fnd.endpoint}</span>}
                    </div>
                  </div>
                ))}

                {selectedJob.findings.length === 0 && (
                  <div className="p-4 text-center text-xs text-[var(--color-text-muted)] font-mono bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm">
                    No critical vulnerabilities flagged in this scan sweep.
                  </div>
                )}
              </div>

              {/* Raw Terminal Output */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-sans uppercase text-[var(--color-text-muted)] font-extrabold flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                  <span>Raw Terminal Execution Log</span>
                </div>
                <pre className="p-3 bg-[var(--color-sidebar-nav)] border border-[var(--color-border-subtle)] rounded-sm text-[11px] font-mono text-[var(--color-cyan)] whitespace-pre-wrap overflow-x-auto max-h-56">
                  {selectedJob.rawOutput}
                </pre>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-[var(--color-text-muted)] app-card text-xs">
              Select a recon job from the history to view findings.
            </div>
          )}
        </div>
      </div>

      {/* Trigger Scan Modal */}
      {scanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1B32]/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border-card)] border-t-4 border-t-[var(--color-primary)] rounded-md shadow-xl p-6 text-[var(--color-text-dark)] relative font-sans">
            <button
              onClick={() => setScanModalOpen(false)}
              className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)] p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] text-[var(--color-primary)] rounded-sm">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[var(--color-text-dark)]">Execute Scoped Recon Scan</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Strictly allowlisted safe profiles only</p>
              </div>
            </div>

            <form onSubmit={handleRunScan} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--color-text-dark)] font-bold mb-1">Target Host (Allowlist)</label>
                <select
                  value={scanTargetId}
                  onChange={(e) => setScanTargetId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-primary)] font-mono font-bold"
                >
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.hostname} ({t.ipRange})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[var(--color-text-dark)] font-bold mb-1">Safe Tool Profile</label>
                <select
                  value={scanTool}
                  onChange={(e) => setScanTool(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-primary)] font-mono font-bold"
                >
                  <option value="nuclei_scan">nuclei_scan (Vulnerability Template Sweep)</option>
                  <option value="nmap_scan">nmap_scan (Port & Service Audit)</option>
                  <option value="gobuster_scan">gobuster_scan (URI & Directory Mapping)</option>
                  <option value="subfinder_scan">subfinder_scan (Subdomain Reconnaissance)</option>
                </select>
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  Exploitation tools and arbitrary command execution are strictly disabled by architectural design.
                </p>
              </div>

              <button
                type="submit"
                disabled={scanning}
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[#0070E0] text-[var(--color-text-light)] font-extrabold rounded-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                {scanning ? 'Executing Scan...' : 'Launch Recon Job'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Target Modal */}
      {targetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1B32]/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border-card)] border-t-4 border-t-[var(--color-primary)] rounded-md shadow-xl p-6 text-[var(--color-text-dark)] relative font-sans">
            <button
              onClick={() => setTargetModalOpen(false)}
              className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)] p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] text-[var(--color-primary)] rounded-sm">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[var(--color-text-dark)]">Register Target to Allowlist</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Authorizes scoped automated auditing</p>
              </div>
            </div>

            <form onSubmit={handleAddTarget} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--color-text-dark)] font-bold mb-1">Hostname / FQDN</label>
                <input
                  type="text"
                  value={newHostname}
                  onChange={(e) => setNewHostname(e.target.value)}
                  placeholder="e.g. sso-auth-gateway.cecur-it.internal"
                  required
                  className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-primary)] font-mono"
                />
              </div>

              <div>
                <label className="block text-[var(--color-text-dark)] font-bold mb-1">IP Range / CIDR</label>
                <input
                  type="text"
                  value={newIpRange}
                  onChange={(e) => setNewIpRange(e.target.value)}
                  placeholder="e.g. 10.100.12.5/32"
                  required
                  className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-primary)] font-mono"
                />
              </div>

              <div>
                <label className="block text-[var(--color-text-dark)] font-bold mb-1">Owner Department</label>
                <input
                  type="text"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  placeholder="e.g. Identity & Access Management"
                  required
                  className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--color-text-dark)] font-bold mb-1">Authorization Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Approved under SOC Change Request CR-9921."
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border-card)] rounded-sm text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[#0070E0] text-[var(--color-text-light)] font-extrabold rounded-sm transition-colors cursor-pointer"
              >
                Authorize & Register Target
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

