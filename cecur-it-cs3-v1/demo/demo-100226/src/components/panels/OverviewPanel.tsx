import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Activity,
  AlertTriangle,
  Radio,
  Server,
  Zap,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Cpu,
  Layers,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sliders,
  RadioTower,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { SensorNode, Incident, CecurAlert } from '../../types';
import { getSeverityBadgeStyle } from '../../theme';

interface OverviewData {
  posture: {
    score: number;
    status: string;
    lastAssessment: string;
  };
  metrics: {
    activeIncidentsCount: number;
    criticalIncidentsCount: number;
    totalEps: number;
    avgDroppedPercentage: number;
    unacknowledgedAlertsCount: number;
    highRiskUsersCount: number;
    sensorSummary: {
      total: number;
      online: number;
      degraded: number;
      offline: number;
    };
  };
  recentIncidents: Incident[];
  recentAlerts: CecurAlert[];
  activeSensors: SensorNode[];
}

interface OverviewPanelProps {
  onNavigate: (panelId: string) => void;
  liveSensors: SensorNode[];
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({ onNavigate, liveSensors }) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive controls
  const [timeframe, setTimeframe] = useState<'live' | '1h' | '24h' | '7d'>('live');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const fetchOverview = async () => {
    try {
      const res = await apiRequest<OverviewData>('/api/overview');
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 4000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-[#00E5FF] font-sans text-sm font-semibold">
          <Activity className="w-5 h-5 animate-spin text-[#00E5FF]" />
          <span>Polling telemetry from SOC core nodes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[#0C1B2B] border border-[#1A3959] text-[#94A3B8] rounded font-sans">
        <div className="font-bold mb-1 text-[#00E5FF]">Failed to load command center overview</div>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  const sensors = liveSensors.length > 0 ? liveSensors : data?.activeSensors || [];
  const postureScore = data?.posture.score || 85;

  const filteredIncidents = (data?.recentIncidents || []).filter((inc) => {
    if (severityFilter === 'ALL') return true;
    return inc.severity === severityFilter;
  });

  return (
    <div id="panel-overview" className="space-y-6 max-w-[1200px] mx-auto font-sans text-[#FFFFFF]">
      {/* Timeframe & SOC Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 bg-[#0C1B2B] border border-[#1A3959] border-t-3 border-t-[#0A84FF] rounded-md shadow-md">
        <div>
          <h1 className="text-xl font-extrabold text-[#FFFFFF] font-sans uppercase tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00E5FF]" />
            Unified SOC Command Dashboard
          </h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Real-time multi-vector threat correlation, sensor telemetry, and incident containment
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex items-center bg-[#12283E] p-1 rounded border border-[#1A3959] text-xs font-sans">
            {(['live', '1h', '24h', '7d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded capitalize transition-colors cursor-pointer text-xs ${
                  timeframe === tf ? 'bg-[#0A84FF] text-[#FFFFFF] font-extrabold shadow-sm' : 'text-[#94A3B8] hover:text-[#FFFFFF]'
                }`}
              >
                {tf === 'live' ? 'Live Telemetry' : tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Stat Row - Standardized .app-card surface layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Threat Posture Meter */}
        <div className="app-card p-4 transition-all">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2 font-sans uppercase tracking-wider font-bold">
            <span>Threat Posture Index</span>
            <ShieldCheck className="w-4 h-4 text-[#00E5FF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-sans text-[#FFFFFF]">
              {postureScore}/100
            </span>
            <span className="text-xs font-sans font-semibold text-[#00E5FF] uppercase">
              {data?.posture.status.replace('_', ' ')}
            </span>
          </div>
          <div className="mt-3 w-full bg-[#12283E] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-[#00E5FF]"
              style={{ width: `${postureScore}%` }}
            />
          </div>
        </div>

        {/* Active Correlated Incidents */}
        <div
          onClick={() => onNavigate('incidents')}
          className="app-card p-4 cursor-pointer hover:border-[#00E5FF] hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2 font-sans uppercase tracking-wider font-bold">
            <span>Active Incidents</span>
            <ShieldAlert className="w-4 h-4 text-[#00E5FF] group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-sans text-[#FFFFFF]">
              {data?.metrics.activeIncidentsCount || 0}
            </span>
            {data?.metrics.criticalIncidentsCount ? (
              <span className="text-xs font-mono font-bold text-[#00E5FF] px-1.5 py-0.5 bg-[#12283E] rounded border border-[#00E5FF]/40">
                {data.metrics.criticalIncidentsCount} CRITICAL
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-[#94A3B8] flex items-center gap-1 font-medium">
            <span>Review SIEM/SOAR queue</span>
            <ChevronRight className="w-3 h-3 text-[#00E5FF] group-hover:text-[#33EBFF]" />
          </p>
        </div>

        {/* Live Event Throughput (EPS) */}
        <div
          onClick={() => onNavigate('sensors')}
          className="app-card p-4 cursor-pointer hover:border-[#00E5FF] hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2 font-sans uppercase tracking-wider font-bold">
            <span>Ingress Throughput</span>
            <Activity className="w-4 h-4 text-[#00E5FF] group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-sans text-[#FFFFFF]">
              {(data?.metrics.totalEps || 0).toLocaleString()}
            </span>
            <span className="text-xs font-mono text-[#94A3B8] font-semibold">EPS</span>
          </div>
          <p className="mt-2 text-xs text-[#94A3B8] flex items-center justify-between font-medium">
            <span>Avg Drop: {data?.metrics.avgDroppedPercentage}%</span>
            <span className="text-[#00E5FF] font-semibold font-mono">Sampling Active</span>
          </p>
        </div>

        {/* CS3 Sensor Node Grid Status */}
        <div
          onClick={() => onNavigate('sensors')}
          className="app-card p-4 cursor-pointer hover:border-[#00E5FF] hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2 font-sans uppercase tracking-wider font-bold">
            <span>Sensor Grid Nodes</span>
            <Radio className="w-4 h-4 text-[#00E5FF] group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-sans text-[#FFFFFF]">
              {data?.metrics.sensorSummary.online || 0}/{data?.metrics.sensorSummary.total || 0}
            </span>
            {data?.metrics.sensorSummary.degraded ? (
              <span className="text-xs font-mono text-[#00E5FF] px-1.5 py-0.5 bg-[#12283E] rounded border border-[#00E5FF]/40">
                {data.metrics.sensorSummary.degraded} Degraded
              </span>
            ) : (
              <span className="text-xs font-mono text-[#00E5FF] font-semibold">100% Operational</span>
            )}
          </div>
          <p className="mt-2 text-xs text-[#94A3B8] flex items-center gap-1 font-medium">
            <span>Inspect edge taps & probes</span>
            <ChevronRight className="w-3 h-3 text-[#00E5FF] group-hover:text-[#33EBFF]" />
          </p>
        </div>
      </div>

      {/* Main Content Grid: Incidents & Sensor Grid Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Incident Stream (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#00E5FF]" />
              <h2 className="text-sm font-sans font-bold text-[#FFFFFF] uppercase tracking-wider">
                Priority Correlated Incidents
              </h2>
            </div>

            {/* Severity Filter Tabs */}
            <div className="flex items-center gap-1 bg-[#12283E] p-1 rounded border border-[#1A3959] text-[11px] font-sans">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                    severityFilter === sev ? 'bg-[#0A84FF] text-[#FFFFFF] font-extrabold' : 'text-[#94A3B8] hover:text-[#FFFFFF]'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredIncidents.map((incident) => {
              const sevBadge = getSeverityBadgeStyle(incident.severity);
              return (
                <div
                  key={incident.id}
                  onClick={() => onNavigate('incidents')}
                  className="p-4 bg-[#0C1B2B] border border-[#1A3959] border-t-3 border-t-[#0A84FF] rounded-md cursor-pointer transition-all hover:border-[#00E5FF] hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${sevBadge.bg} ${sevBadge.text} ${sevBadge.border}`}
                        >
                          {incident.severity}
                        </span>
                        <span className="text-xs font-mono text-[#00E5FF] font-semibold">{incident.id}</span>
                        <span className="text-xs font-mono text-[#1A3959]">•</span>
                        <span className="text-xs font-mono text-[#94A3B8]">{incident.status}</span>
                      </div>
                      <h3 className="text-sm font-bold text-[#FFFFFF] tracking-tight">{incident.title}</h3>
                      <p className="text-xs text-[#94A3B8] mt-1 line-clamp-2">{incident.rootCause}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-mono text-[#94A3B8]">
                        {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#1A3959] flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
                    <div className="flex items-center gap-1.5 text-[#00E5FF] font-mono text-[11px] font-semibold">
                      <Layers className="w-3 h-3" />
                      <span>MITRE: {incident.mitreTactic}</span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8]">
                      Assignee: <span className="text-[#FFFFFF] font-semibold">{incident.assignedTo}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Sensor Matrix & Live Alert Feed */}
        <div className="space-y-6">
          {/* Live Sensor Grid Nodes */}
          <div className="p-4 bg-[#0C1B2B] border border-[#1A3959] border-t-3 border-t-[#0A84FF] rounded-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#00E5FF]" />
                <h3 className="text-xs font-sans font-bold text-[#FFFFFF] uppercase tracking-wider">
                  CS3 Network Probes
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#00E5FF]">Live Telemetry</span>
            </div>

            <div className="space-y-2">
              {sensors.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 bg-[#12283E] border border-[#1A3959] rounded flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <div className="font-mono font-bold text-[#FFFFFF] truncate">{s.name}</div>
                    <div className="text-[10px] text-[#94A3B8] font-mono">{s.ipAddress}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
                      <span className="font-mono text-[11px] text-[#FFFFFF] font-semibold">
                        {s.packetRate.toFixed(0)} p/s
                      </span>
                    </div>
                    <div className="text-[10px] text-[#94A3B8] font-mono">
                      CPU: {s.cpuUsage}% | Anomaly: {s.anomalyRate}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Cecur SIEM/XDR Alert Stream */}
          <div className="p-4 bg-[#0C1B2B] border border-[#1A3959] border-t-3 border-t-[#0A84FF] rounded-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#00E5FF]" />
                <h3 className="text-xs font-sans font-bold text-[#FFFFFF] uppercase tracking-wider">
                  Ingress Cecur SIEM/XDR Alerts
                </h3>
              </div>
              <button
                onClick={() => onNavigate('cecur')}
                className="text-[11px] font-sans font-bold text-[#00E5FF] hover:text-[#33EBFF] uppercase tracking-wider cursor-pointer"
              >
                Inspect
              </button>
            </div>

            <div className="space-y-2">
              {data?.recentAlerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="p-2.5 bg-[#12283E] border border-[#1A3959] rounded text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono text-[#00E5FF] font-bold">
                      Rule {alert.ruleId} (Lvl {alert.ruleLevel})
                    </span>
                    <span className="text-[10px] font-mono text-[#94A3B8]">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-[#FFFFFF] line-clamp-1">{alert.ruleTitle || alert.description}</p>
                  <div className="text-[10px] font-mono text-[#94A3B8] flex items-center justify-between">
                    <span>Host: {alert.agentName.split('.')[0]}</span>
                    <span className="uppercase text-[#0A84FF] font-semibold">{alert.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

