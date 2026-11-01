import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Search,
  Download,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Filter,
  User,
  Clock,
  ExternalLink,
  Lock,
  Sparkles,
  KeyRound,
  Layers,
  Share2,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { AuditLogEntry } from '../../types';
import { ExportModal } from '../common/ExportModal';
import { buildAuditExportPayload, ExportPayload } from '../../lib/exportUtils';

export const AuditPanel: React.FC = () => {
  const { canPerformAction, user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [panelFilter, setPanelFilter] = useState<string>('ALL');
  const [nistControlFilter, setNistControlFilter] = useState<string>('ALL');
  const [verifyingLedger, setVerifyingLedger] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPayload, setExportPayload] = useState<ExportPayload | null>(null);
  const [ledgerVerification, setLedgerVerification] = useState<{
    status: string;
    totalEntries: number;
    verifiedCount: number;
    standardsCompliant: string[];
    timestamp: string;
    genesisBlock: string;
  } | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (panelFilter !== 'ALL') params.append('panel', panelFilter);
      if (nistControlFilter !== 'ALL') params.append('nistControl', nistControlFilter);

      const res = await apiRequest<{ total: number; logs: AuditLogEntry[] }>(
        `/api/audit?${params.toString()}`
      );
      setLogs(res.logs);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, statusFilter, panelFilter, nistControlFilter]);

  const handleVerifyLedger = async () => {
    try {
      setVerifyingLedger(true);
      const res = await apiRequest<any>('/api/audit/verify-ledger', { method: 'POST' });
      setLedgerVerification(res);
    } catch (err: any) {
      console.error('Ledger verification failed:', err);
    } finally {
      setVerifyingLedger(false);
    }
  };

  const handleExport = () => {
    const payload = buildAuditExportPayload(
      logs,
      `${user?.displayName} (${user?.username} / ${user?.role})`
    );
    setExportPayload(payload);
    setExportModalOpen(true);
  };

  return (
    <div id="panel-audit" className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto font-sans">
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
            <FileCheck2 className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-lg font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider">
              Operational Security &amp; RBAC Audit Trail
            </h1>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] font-sans mt-0.5">
            Tamper-evident, cryptographically chained audit log compliant with NIST SP 800-53 Rev 5 (AU-2/AU-3/AU-9) and NIST SP 800-171 Rev 3 (03.03.01 - 03.03.09).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-verify-ledger"
            onClick={handleVerifyLedger}
            disabled={verifyingLedger}
            className="px-3.5 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-emerald-800 border border-emerald-300 rounded-sm text-xs font-bold font-mono flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{verifyingLedger ? 'Verifying Hashes...' : 'Verify Cryptographic Ledger'}</span>
          </button>

          {canPerformAction('export_audit') && (
            <button
              id="btn-export-audit-json"
              onClick={handleExport}
              className="px-3.5 py-2 bg-[var(--color-primary)] hover:bg-[#0070E0] text-white rounded-sm text-xs font-bold font-mono flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Export &amp; Share Audit Package</span>
            </button>
          )}
        </div>
      </div>

      {/* Cryptographic Ledger Verification Status Alert */}
      {ledgerVerification && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-sm space-y-2 text-xs font-sans">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <span className="font-extrabold text-emerald-900 uppercase font-mono tracking-wide">
                Tamper-Evident Ledger Integrity: {ledgerVerification.status}
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-800">
              Verified {ledgerVerification.verifiedCount} of {ledgerVerification.totalEntries} Records
            </span>
          </div>
          <p className="text-emerald-800 text-[11px]">
            SHA-256 forward-chaining cryptographic proof confirms zero log modifications, deletions, or unauthorized tampering. Complies with NIST AU-9, AU-10 (Non-Repudiation), and NIST 03.03.03.
          </p>
          <div className="flex items-center gap-4 text-[10px] font-mono text-emerald-800 pt-1 border-t border-emerald-200">
            <span>Genesis: {ledgerVerification.genesisBlock}</span>
            <span>Standards: {ledgerVerification.standardsCompliant.join(' • ')}</span>
          </div>
        </div>
      )}

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] sm:max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, actor, NIST control, SHA-256 hash..."
            className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border-card)] rounded-sm text-xs text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border-card)] rounded-sm text-xs text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-primary)] font-mono"
        >
          <option value="ALL">All Outcomes</option>
          <option value="DENY_403">DENY_403 (Security Blocks)</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="ALLOW">ALLOW</option>
        </select>

        <select
          value={panelFilter}
          onChange={(e) => setPanelFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border-card)] rounded-sm text-xs text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-primary)] font-mono"
        >
          <option value="ALL">All Panels</option>
          <option value="auth">auth</option>
          <option value="cecur">cecur</option>
          <option value="incidents">incidents</option>
          <option value="hexstrike">hexstrike</option>
          <option value="sensors">sensors</option>
          <option value="audit">audit</option>
        </select>

        <select
          value={nistControlFilter}
          onChange={(e) => setNistControlFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border-card)] rounded-sm text-xs text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-primary)] font-mono"
        >
          <option value="ALL">All NIST Controls</option>
          <option value="AC">Access Control (AC / 03.01)</option>
          <option value="AU">Audit & Accountability (AU / 03.03)</option>
          <option value="IR">Incident Response (IR / 03.06)</option>
          <option value="CA">Security Assessment (CA / 03.12)</option>
          <option value="SI">System Integrity (SI / 03.14)</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-border-card)] text-[11px] font-mono uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="py-3 px-4">Status &amp; NIST Controls</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor &amp; Role</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Details &amp; SHA-256 Chain Hash</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-card)] font-sans">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className={`hover:bg-[var(--color-surface-hover)] transition-colors ${
                    log.status === 'DENY_403' ? 'bg-rose-50/50' : ''
                  }`}
                >
                  <td className="py-3 px-4 font-mono space-y-1">
                    <div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-sm border ${
                          log.status === 'DENY_403'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : log.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-blue-50 text-blue-800 border-blue-300'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    {log.nistControls && log.nistControls.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {log.nistControls.map((ctrl) => (
                          <span
                            key={ctrl}
                            className="text-[9px] font-mono px-1 bg-[var(--color-surface-subtle)] text-[var(--color-primary)] rounded border border-[var(--color-border-card)] font-bold"
                          >
                            {ctrl}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono font-bold text-[var(--color-text-dark)] text-xs">
                    <div>{log.action}</div>
                    {log.cuiProtected && (
                      <span className="text-[9px] font-mono text-emerald-700 font-normal">CUI-ENCLAVE</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-semibold text-[var(--color-text-dark)]">{log.actorUsername}</div>
                    <div className="text-[10px] font-mono text-[var(--color-primary)] uppercase">[{log.actorRole}]</div>
                  </td>

                  <td className="py-3 px-4 font-mono text-[var(--color-text-muted)] text-[11px]">
                    {log.targetResource || '-'}
                  </td>

                  <td className="py-3 px-4 text-[var(--color-text-dark)] max-w-md text-xs space-y-1">
                    <div>{log.details}</div>
                    {log.chainHash && (
                      <div className="text-[10px] font-mono text-[var(--color-text-muted)] flex items-center gap-1 truncate" title={log.chainHash}>
                        <Lock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Hash: {log.chainHash}</span>
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right font-mono text-[11px] text-[var(--color-text-muted)]">
                    <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </td>
                </tr>
              ))}

              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--color-text-muted)] font-mono text-xs">
                    No audit records matched the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

