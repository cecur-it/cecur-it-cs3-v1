import React, { useState, useEffect } from 'react';
import {
  UserX,
  Search,
  AlertTriangle,
  HardDrive,
  CloudUpload,
  Clock,
  ShieldAlert,
  Flame,
  CheckCircle,
  Activity,
  Terminal,
  Share2,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { ActivTrakSession } from '../../types';
import { ExportModal } from '../common/ExportModal';
import { buildActivTrakExportPayload, ExportPayload } from '../../lib/exportUtils';

export const ActivTrakPanel: React.FC = () => {
  const [sessions, setSessions] = useState<ActivTrakSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPayload, setExportPayload] = useState<ExportPayload | null>(null);

  const fetchActivTrak = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);

      const res = await apiRequest<{ total: number; sessions: ActivTrakSession[] }>(
        `/api/activtrak?${params.toString()}`
      );
      setSessions(res.sessions);
    } catch (err: any) {
      console.error('Failed to load ActivTrak sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivTrak();
  }, [search, categoryFilter]);

  const handleExport = () => {
    const payload = buildActivTrakExportPayload(sessions);
    setExportPayload(payload);
    setExportModalOpen(true);
  };

  const highRiskSessions = sessions.filter((s) => s.riskScore >= 75);

  return (
    <div id="panel-activtrak" className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Export & Sharing Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        payload={exportPayload}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1A3959]">
        <div>
          <div className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-[#00E5FF]" />
            <h1 className="text-xl font-sans font-extrabold text-[#FFFFFF] uppercase tracking-wide">
              ActivTrak Insider Risk & Telemetry
            </h1>
          </div>
          <p className="text-xs text-[#94A3B8] font-sans mt-0.5">
            Workstation process auditing, cloud exfiltration detection, removable media logs, and high-risk user monitoring.
          </p>
        </div>

        {/* Filter Controls & Export */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            id="btn-export-activtrak"
            onClick={handleExport}
            className="px-3.5 py-1.5 bg-[#0C1B2B] hover:bg-[#1A3959] text-[#00E5FF] border border-[#1A3959] rounded text-xs font-bold font-sans flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Export Risk Ledger</span>
          </button>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, device, app, title..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#0C1B2B] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] placeholder-[#64748B]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#0C1B2B] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
          >
            <option value="ALL">All Categories</option>
            <option value="suspicious">Suspicious</option>
            <option value="risky">Risky</option>
            <option value="productive">Productive</option>
          </select>
        </div>
      </div>

      {/* High-Risk Leaderboard / Alert Callouts */}
      {highRiskSessions.length > 0 && (
        <div className="p-4 bg-rose-950/30 border border-rose-900 border-t-3 border-t-rose-500 rounded-md space-y-3">
          <div className="flex items-center gap-2 text-rose-300 text-xs font-sans font-extrabold uppercase tracking-wider">
            <Flame className="w-4 h-4 text-rose-400" />
            <span>High Risk Behavioral Flags ({highRiskSessions.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {highRiskSessions.map((session) => (
              <div
                key={session.id}
                className="p-3 bg-[#0C1B2B] border border-[#1A3959] rounded text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#FFFFFF]">{session.userName}</span>
                  <span className="px-2 py-0.5 font-mono font-bold text-rose-300 bg-rose-950/60 border border-rose-800 rounded text-[10px]">
                    Risk Score: {session.riskScore}/100
                  </span>
                </div>
                <div className="text-[#94A3B8] text-[11px] font-mono">
                  {session.department} • {session.deviceId}
                </div>
                <p className="text-rose-300 text-xs font-semibold">{session.flaggedActivity}</p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-[#94A3B8] pt-1 border-t border-[#1A3959]">
                  {session.cloudStorageUpload && (
                    <span className="text-rose-400 flex items-center gap-1 font-bold">
                      <CloudUpload className="w-3 h-3" /> Cloud Storage Sync
                    </span>
                  )}
                  {session.usbConnected && (
                    <span className="text-[#00E5FF] flex items-center gap-1 font-bold">
                      <HardDrive className="w-3 h-3" /> Removable USB
                    </span>
                  )}
                  <span>Egress: {session.dataTransferredMb.toFixed(1)} MB</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Sessions Table */}
      <div className="app-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#12283E] border-b border-[#1A3959] text-[11px] font-sans font-extrabold uppercase text-[#94A3B8] tracking-wider">
              <tr>
                <th className="py-3 px-4">User & Department</th>
                <th className="py-3 px-4">Active Application & Window</th>
                <th className="py-3 px-4">Device</th>
                <th className="py-3 px-4">Risk Level</th>
                <th className="py-3 px-4">Egress MB</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A3959] font-sans text-[#FFFFFF]">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-[#12283E]/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#FFFFFF]">{session.userName}</div>
                    <div className="text-[11px] text-[#94A3B8] font-mono">{session.department}</div>
                  </td>

                  <td className="py-3 px-4 max-w-sm">
                    <div className="font-mono font-bold text-[#00E5FF] flex items-center gap-1.5">
                      <Terminal className="w-3 h-3 text-[#64748B]" />
                      <span>{session.currentApp}</span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] truncate">{session.windowTitle}</div>
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-[#94A3B8]">
                    {session.deviceId}
                  </td>

                  <td className="py-3 px-4 font-mono">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                          session.riskScore >= 75
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : session.riskScore >= 40
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {session.riskScore}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8]">
                        {session.category}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono text-[#94A3B8]">
                    {session.dataTransferredMb > 0 ? `${session.dataTransferredMb.toFixed(1)} MB` : '-'}
                  </td>

                  <td className="py-3 px-4 text-right font-mono text-[11px] text-[#94A3B8]">
                    {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
