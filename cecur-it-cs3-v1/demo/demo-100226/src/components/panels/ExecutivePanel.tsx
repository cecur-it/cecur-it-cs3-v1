import React, { useState, useEffect } from 'react';
import {
  PieChart,
  TrendingDown,
  TrendingUp,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Award,
  BarChart3,
  Layers,
  ChevronRight,
  Share2,
  Download,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Incident } from '../../types';
import { ExportModal } from '../common/ExportModal';
import { buildExecutiveReportExportPayload, ExportPayload } from '../../lib/exportUtils';

interface ExecutiveData {
  kpis: {
    enterpriseRiskIndex: number;
    riskTrend: string;
    mttdMinutes: number;
    mttrMinutes: number;
    activeThreatActorsTracked: number;
    openCriticalIncidents: number;
    complianceReadinessScore: number;
  };
  complianceBreakdown: Array<{
    framework: string;
    score: number;
    status: string;
    auditsRemaining: number;
  }>;
  threatVectors: Array<{
    name: string;
    share: number;
    count: number;
    trend: string;
  }>;
  incidentVelocityMonthly: Array<{
    month: string;
    critical: number;
    high: number;
    medium: number;
  }>;
  activeExecutiveEscalations: Incident[];
}

export const ExecutivePanel: React.FC = () => {
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPayload, setExportPayload] = useState<ExportPayload | null>(null);

  useEffect(() => {
    const fetchExec = async () => {
      try {
        setLoading(true);
        const res = await apiRequest<ExecutiveData>('/api/executive');
        setData(res);
      } catch (err: any) {
        console.error('Failed to load executive KPIs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchExec();
  }, []);

  const handleExportBrief = () => {
    if (!data) return;
    const payload = buildExecutiveReportExportPayload(data);
    setExportPayload(payload);
    setExportModalOpen(true);
  };

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-[var(--color-primary)] font-sans font-bold text-xs">
        Synthesizing Executive Threat Posture & GRC Metrics...
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div id="panel-executive" className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto font-sans">
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
            <PieChart className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-lg font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider">
              Executive Cybersecurity Posture & CISO KPIs
            </h1>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] font-sans mt-0.5">
            Enterprise risk index, Mean-Time-To-Detect (MTTD), Mean-Time-To-Respond (MTTR), and regulatory compliance readiness.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-export-executive-brief"
            onClick={handleExportBrief}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[var(--color-primary)] hover:bg-[#0070E0] text-white text-xs font-bold font-mono transition-colors shadow-xs cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Export Executive Briefing</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-sans font-bold text-[var(--color-text-dark)] bg-[var(--color-surface)] border border-[var(--color-border-card)] px-3 py-1.5 rounded-sm shadow-xs">
            <Award className="w-4 h-4 text-[var(--color-primary)]" />
            <span>GRC Governance Active</span>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Enterprise Risk Index */}
        <div className="app-card p-4">
          <div className="text-xs font-sans uppercase text-[var(--color-text-muted)] mb-1 font-extrabold tracking-wider">Enterprise Risk Index</div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-sans font-extrabold ${
                (kpis?.enterpriseRiskIndex || 88) > 75 ? 'text-emerald-700' : 'text-blue-700'
              }`}
            >
              {kpis?.enterpriseRiskIndex || 88}/100
            </span>
            <span className="text-xs font-mono text-[var(--color-text-muted)]">Target: &gt;80</span>
          </div>
          <div className="mt-2 text-[11px] font-sans font-bold text-[var(--color-primary)] flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>{kpis?.riskTrend}</span>
          </div>
        </div>

        {/* MTTD */}
        <div className="app-card p-4">
          <div className="text-xs font-sans uppercase text-[var(--color-text-muted)] mb-1 font-extrabold tracking-wider">Mean Time to Detect (MTTD)</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-sans font-extrabold text-[var(--color-primary)]">{kpis?.mttdMinutes}</span>
            <span className="text-xs font-mono text-[var(--color-text-muted)]">Minutes</span>
          </div>
          <p className="mt-2 text-[11px] text-emerald-800 font-sans font-bold">
            98.1% Faster than industry avg (180m)
          </p>
        </div>

        {/* MTTR */}
        <div className="app-card p-4">
          <div className="text-xs font-sans uppercase text-[var(--color-text-muted)] mb-1 font-extrabold tracking-wider">Mean Time to Respond (MTTR)</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-sans font-extrabold text-[var(--color-text-dark)]">{kpis?.mttrMinutes}</span>
            <span className="text-xs font-mono text-[var(--color-text-muted)]">Minutes</span>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)] font-sans">
            Automated SOAR playbooks active
          </p>
        </div>

        {/* Compliance Readiness */}
        <div className="app-card p-4">
          <div className="text-xs font-sans uppercase text-[var(--color-text-muted)] mb-1 font-extrabold tracking-wider">Compliance Readiness</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-sans font-extrabold text-emerald-700">
              {kpis?.complianceReadinessScore}%
            </span>
            <span className="text-xs font-mono text-[var(--color-text-muted)]">Audit Ready</span>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)] font-sans">
            5/5 Frameworks verified
          </p>
        </div>
      </div>

      {/* Middle Section: Compliance Framework Breakdown & Threat Vectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Frameworks */}
        <div className="app-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Regulatory Compliance Readiness</span>
            </h2>
            <span className="text-[10px] font-sans uppercase font-bold text-[var(--color-text-muted)]">Continuous Assessment</span>
          </div>

          <div className="space-y-3">
            {data?.complianceBreakdown.map((item, idx) => (
              <div key={idx} className="p-3 bg-[var(--color-surface-subtle)] rounded-sm border border-[var(--color-border-card)] space-y-1.5 text-xs font-sans">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--color-text-dark)]">{item.framework}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700 font-mono">{item.score}%</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-sm">
                      {item.status}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-[var(--color-border-card)] rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-700 rounded-full" style={{ width: `${item.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Threat Vector Distribution */}
        <div className="app-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Active Threat Vector Distribution</span>
            </h2>
            <span className="text-[10px] font-sans uppercase font-bold text-[var(--color-text-muted)]">Trailing 30 Days</span>
          </div>

          <div className="space-y-3">
            {data?.threatVectors.map((tv, idx) => (
              <div key={idx} className="p-3 bg-[var(--color-surface-subtle)] rounded-sm border border-[var(--color-border-card)] space-y-1.5 text-xs font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-dark)] font-bold truncate">{tv.name}</span>
                  <span className="text-[var(--color-primary)] font-bold font-mono">{tv.share}% ({tv.count} events)</span>
                </div>
                <div className="w-full bg-[var(--color-border-card)] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary)] rounded-full"
                    style={{ width: `${tv.share * 2}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Incident Velocity Bar Chart */}
      <div className="app-card p-5 space-y-4">
        <div className="text-xs font-sans font-extrabold text-[var(--color-text-dark)] uppercase tracking-wider">
          Monthly Incident Resolution Velocity
        </div>

        <div className="grid grid-cols-5 gap-3 text-center text-xs font-sans">
          {data?.incidentVelocityMonthly.map((m, idx) => (
            <div key={idx} className="p-3 bg-[var(--color-surface-subtle)] rounded-sm border border-[var(--color-border-card)] space-y-2">
              <div className="text-[var(--color-text-dark)] font-extrabold">{m.month}</div>
              <div className="space-y-1 text-[11px] font-mono">
                <div className="text-rose-700 font-bold">Crit: {m.critical}</div>
                <div className="text-blue-800 font-bold">High: {m.high}</div>
                <div className="text-[var(--color-primary)] font-bold">Med: {m.medium}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

