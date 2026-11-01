import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  Sparkles,
  Layers,
  ArrowRight,
  AlertTriangle,
  FileText,
  Activity,
  ChevronRight,
  X,
  Share2,
  Download,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Incident, CecurAlert, ActivTrakSession } from '../../types';
import { getSeverityBadgeStyle } from '../../theme';
import { ExportModal } from '../common/ExportModal';
import {
  buildIncidentDossierExportPayload,
  buildIncidentRegisterExportPayload,
  ExportPayload,
} from '../../lib/exportUtils';

export const IncidentsPanel: React.FC = () => {
  const { canPerformAction, user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [correlatedCecur, setCorrelatedCecur] = useState<CecurAlert[]>([]);
  const [correlatedActivTrak, setCorrelatedActivTrak] = useState<ActivTrakSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [timelineNote, setTimelineNote] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPayload, setExportPayload] = useState<ExportPayload | null>(null);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      let query = '';
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (severityFilter !== 'ALL') params.append('severity', severityFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (params.toString()) query = `?${params.toString()}`;

      const res = await apiRequest<{ incidents: Incident[] }>(`/api/incidents${query}`);
      setIncidents(res.incidents);
    } catch (err: any) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [search, severityFilter, statusFilter]);

  const selectIncident = async (incident: Incident) => {
    setSelectedIncident(incident);
    try {
      const res = await apiRequest<{
        incident: Incident;
        correlatedCecur: CecurAlert[];
        correlatedActivTrak: ActivTrakSession[];
      }>(`/api/incidents/${incident.id}`);
      setSelectedIncident(res.incident);
      setCorrelatedCecur(res.correlatedCecur || []);
      setCorrelatedActivTrak(res.correlatedActivTrak || []);
    } catch (err) {
      console.error('Failed to fetch incident details:', err);
    }
  };

  const handleUpdateStatus = async (newStatus: Incident['status']) => {
    if (!selectedIncident) return;
    try {
      const res = await apiRequest<{ success: boolean; incident: Incident }>(
        `/api/incidents/${selectedIncident.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        }
      );
      setSelectedIncident(res.incident);
      setIncidents((prev) => prev.map((i) => (i.id === res.incident.id ? res.incident : i)));
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleTogglePlaybookStep = async (stepNumber: number, currentStatus: string) => {
    if (!selectedIncident) return;
    const nextStatus = currentStatus === 'completed' ? 'in_progress' : currentStatus === 'in_progress' ? 'pending' : 'completed';
    try {
      const res = await apiRequest<{ success: boolean; incident: Incident }>(
        `/api/incidents/${selectedIncident.id}/playbook-step`,
        {
          method: 'POST',
          body: JSON.stringify({ stepNumber, status: nextStatus }),
        }
      );
      setSelectedIncident(res.incident);
      setIncidents((prev) => prev.map((i) => (i.id === res.incident.id ? res.incident : i)));
    } catch (err: any) {
      alert(err.message || 'Failed to update playbook step');
    }
  };

  const handleRunAiAnalysis = async () => {
    if (!selectedIncident) return;
    setAiAnalyzing(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        analysis: any;
        incident: Incident;
      }>(`/api/incidents/${selectedIncident.id}/ai-analyze`, {
        method: 'POST',
      });
      setSelectedIncident(res.incident);
      setIncidents((prev) => prev.map((i) => (i.id === res.incident.id ? res.incident : i)));
    } catch (err: any) {
      alert(err.message || 'AI analysis failed');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleAddTimelineNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !timelineNote.trim()) return;
    try {
      const res = await apiRequest<{ success: boolean; incident: Incident }>(
        `/api/incidents/${selectedIncident.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ timelineNote }),
        }
      );
      setSelectedIncident(res.incident);
      setIncidents((prev) => prev.map((i) => (i.id === res.incident.id ? res.incident : i)));
      setTimelineNote('');
    } catch (err: any) {
      alert(err.message || 'Failed to post note');
    }
  };

  const handleExportRegister = () => {
    const payload = buildIncidentRegisterExportPayload(incidents);
    setExportPayload(payload);
    setExportModalOpen(true);
  };

  const handleExportSingleIncident = () => {
    if (!selectedIncident) return;
    const payload = buildIncidentDossierExportPayload(selectedIncident, correlatedCecur, correlatedActivTrak);
    setExportPayload(payload);
    setExportModalOpen(true);
  };

  return (
    <div id="panel-incidents" className="space-y-6 max-w-[1200px] mx-auto font-sans text-[#FFFFFF]">
      {/* Export & Sharing Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        payload={exportPayload}
      />

      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[#0C1B2B] border border-[#1A3959] border-t-3 border-t-[#0A84FF] rounded-md shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#00E5FF]" />
            <h1 className="text-xl font-extrabold text-[#FFFFFF] font-sans uppercase tracking-tight">
              Correlated Incidents (SIEM/SOAR)
            </h1>
          </div>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Multi-telemetry security cases fused from Cecur EDR, ActivTrak telemetry, and CS3 network anomaly probes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Export Register Button */}
          <button
            id="btn-export-incident-register"
            onClick={handleExportRegister}
            className="px-3 py-1.5 bg-[#12283E] hover:bg-[#1A3959] text-[#00E5FF] border border-[#1A3959] rounded text-xs font-bold font-sans flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Export full incident response register"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Export Register</span>
          </button>

          {/* Search bar */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search incidents, CVE..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] placeholder-[#94A3B8] focus:outline-none focus:border-[#00E5FF] font-sans"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] font-sans"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] font-sans"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="CONTAINED">Contained</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Incident List */}
      <div className="grid grid-cols-1 gap-4">
        {incidents.map((incident) => {
          const completedSteps = incident.playbookSteps.filter((s) => s.status === 'completed').length;
          const totalSteps = incident.playbookSteps.length;
          const sevStyle = getSeverityBadgeStyle(incident.severity);

          return (
            <div
              key={incident.id}
              onClick={() => selectIncident(incident)}
              className="app-card p-5 transition-all cursor-pointer hover:border-[#0A84FF] hover:shadow-md"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${sevStyle.bg} ${sevStyle.text} ${sevStyle.border}`}
                    >
                      {incident.severity}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#00E5FF]">{incident.id}</span>
                    <span className="text-xs font-mono text-[#1A3959]">•</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded ${
                        incident.status === 'INVESTIGATING'
                          ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40'
                          : incident.status === 'CONTAINED'
                          ? 'bg-[#0A84FF]/20 text-[#BAE3FF] border border-[#0A84FF]/50'
                          : incident.status === 'RESOLVED'
                          ? 'bg-[#12283E] text-[#94A3B8] border border-[#1A3959]'
                          : 'bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30'
                      }`}
                    >
                      {incident.status}
                    </span>
                    <span className="text-xs text-[#94A3B8] font-mono hidden sm:inline">
                      ({incident.category})
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-[#FFFFFF] tracking-tight">{incident.title}</h2>
                  <p className="text-xs text-[#94A3B8] line-clamp-2 max-w-4xl">{incident.rootCause}</p>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#1A3959]">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-[#FFFFFF]">{incident.assignedTo}</div>
                    <div className="text-[10px] font-mono text-[#94A3B8]">
                      Created: {new Date(incident.createdAt).toLocaleDateString()} {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-[#00E5FF] font-bold bg-[#12283E] border border-[#1A3959] px-2 py-0.5 rounded">
                    <span>Playbook: {completedSteps}/{totalSteps}</span>
                  </div>
                </div>
              </div>

              {/* MITRE & Affected Assets footer */}
              <div className="mt-4 pt-3 border-t border-[#1A3959] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[#00E5FF] font-mono text-xs font-bold">
                  <Layers className="w-3.5 h-3.5" />
                  <span>MITRE ATT&CK: {incident.mitreTactic}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#94A3B8] font-mono text-[11px]">
                  <span>Assets:</span>
                  {incident.affectedAssets.map((asset, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 bg-[#12283E] text-[#BAE3FF] border border-[#1A3959] rounded">
                      {asset.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {incidents.length === 0 && !loading && (
          <div className="p-8 text-center text-[#94A3B8] bg-[#0C1B2B] border border-[#1A3959] rounded-md font-sans">
            No incidents matched the selected filter criteria.
          </div>
        )}
      </div>

      {/* Incident Inspector Modal / Drawer */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            id="incident-detail-modal"
            className="w-full max-w-4xl bg-[#0C1B2B] border border-[#1A3959] border-t-3 border-t-[#0A84FF] rounded-md shadow-2xl max-h-[92vh] flex flex-col text-[#FFFFFF] relative my-auto font-sans"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1A3959] flex items-start justify-between gap-4 sticky top-0 bg-[#0B1B32] z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${getSeverityBadgeStyle(selectedIncident.severity).bg} ${getSeverityBadgeStyle(selectedIncident.severity).text} ${getSeverityBadgeStyle(selectedIncident.severity).border}`}
                  >
                    {selectedIncident.severity}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#00E5FF]">{selectedIncident.id}</span>
                  <span className="text-xs font-mono text-[#1A3959]">•</span>
                  <span className="text-xs font-mono text-[#0A84FF] uppercase font-bold">{selectedIncident.category}</span>
                </div>
                <h2 className="text-lg font-extrabold text-[#FFFFFF]">{selectedIncident.title}</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-export-incident-dossier"
                  onClick={handleExportSingleIncident}
                  className="px-3 py-1.5 bg-[#12283E] hover:bg-[#1A3959] text-[#00E5FF] border border-[#1A3959] text-xs font-bold font-sans rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Export formal incident investigation dossier"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Export Dossier</span>
                </button>

                {canPerformAction('update_incident') && (
                  <select
                    value={selectedIncident.status}
                    onChange={(e) => handleUpdateStatus(e.target.value as Incident['status'])}
                    className="px-3 py-1.5 bg-[#12283E] border border-[#1A3959] text-xs font-mono text-[#00E5FF] font-bold rounded focus:outline-none focus:border-[#00E5FF]"
                  >
                    <option value="OPEN">Status: OPEN</option>
                    <option value="INVESTIGATING">Status: INVESTIGATING</option>
                    <option value="CONTAINED">Status: CONTAINED</option>
                    <option value="RESOLVED">Status: RESOLVED</option>
                  </select>
                )}
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="p-1.5 text-[#94A3B8] hover:text-[#FFFFFF] rounded hover:bg-[#12283E] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* CS3-AI Copilot Briefing & Mitigation Generator */}
              <div className="p-4 bg-[#12283E] border border-[#1A3959] border-l-4 border-l-[#0A84FF] rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#00E5FF]" />
                    <span className="font-sans font-extrabold text-[#FFFFFF] text-xs uppercase tracking-wider">
                      CS3 Agent Threat Briefing
                    </span>
                  </div>
                  {canPerformAction('generate_ai_playbook') && (
                    <button
                      id="btn-run-cs3-incident-analysis"
                      onClick={handleRunAiAnalysis}
                      disabled={aiAnalyzing}
                      className="px-3 py-1 text-xs font-semibold bg-[#0A84FF] hover:bg-[#00E5FF] text-white hover:text-black rounded transition-colors flex items-center gap-1.5 disabled:opacity-50 uppercase tracking-wider cursor-pointer font-bold shadow-xs"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${aiAnalyzing ? 'animate-spin' : ''}`} />
                      <span>{aiAnalyzing ? 'Generating Briefing...' : 'Re-Run AI Triage'}</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-[#94A3B8] leading-relaxed font-sans">
                  {selectedIncident.aiSummary || 'Click "Re-Run AI Triage" to execute CS3-AI root cause & MITRE synthesis.'}
                </p>
              </div>

              {/* MITRE ATT&CK & Root Cause */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-[#12283E] border border-[#1A3959] rounded space-y-1.5">
                  <div className="text-[11px] font-sans text-[#94A3B8] uppercase font-bold">
                    MITRE ATT&CK Mapping
                  </div>
                  <div className="text-xs font-bold text-[#00E5FF]">{selectedIncident.mitreTactic}</div>
                  <div className="text-[11px] text-[#94A3B8] font-mono">{selectedIncident.mitreTechnique}</div>
                </div>

                <div className="p-3.5 bg-[#12283E] border border-[#1A3959] rounded space-y-1.5">
                  <div className="text-[11px] font-sans text-[#94A3B8] uppercase font-bold">
                    Affected Assets & Scope
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedIncident.affectedAssets.map((asset, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-[#0C1B2B] border border-[#1A3959] rounded text-[#00E5FF] text-xs font-mono font-semibold">
                        {asset}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Containment Playbook Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-sans font-extrabold uppercase text-[#FFFFFF] tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" />
                    <span>Containment & Remediation Playbook</span>
                  </div>
                  <span className="text-[11px] font-sans text-[#94A3B8]">
                    Click step to toggle status
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedIncident.playbookSteps.map((step) => (
                    <div
                      key={step.step}
                      onClick={() => handleTogglePlaybookStep(step.step, step.status)}
                      className={`p-3 rounded border flex items-center justify-between cursor-pointer transition-all ${
                        step.status === 'completed'
                          ? 'bg-[#0A84FF]/20 border-[#0A84FF] text-[#FFFFFF]'
                          : step.status === 'in_progress'
                          ? 'bg-[#00E5FF]/10 border-[#00E5FF]/40 text-[#00E5FF]'
                          : 'bg-[#12283E] border-[#1A3959] text-[#94A3B8] hover:border-[#00E5FF]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#0C1B2B] border border-[#1A3959] flex items-center justify-center font-mono font-bold text-xs text-[#00E5FF]">
                          {step.step}
                        </span>
                        <span className="font-semibold text-xs text-[#FFFFFF]">{step.title}</span>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                          step.status === 'completed'
                            ? 'bg-[#0A84FF] text-[#FFFFFF] border-[#0A84FF]'
                            : step.status === 'in_progress'
                            ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]'
                            : 'bg-[#0C1B2B] text-[#94A3B8] border-[#1A3959]'
                        }`}
                      >
                        {step.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Correlated Multi-Telemetry Timeline */}
              <div className="space-y-3">
                <div className="text-xs font-sans font-extrabold uppercase text-[#FFFFFF] tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#00E5FF]" />
                  <span>Fused Telemetry Timeline</span>
                </div>

                <div className="relative border-l-2 border-[#1A3959] ml-3 space-y-4 pl-4 py-1">
                  {selectedIncident.timeline.map((evt, idx) => (
                    <div key={idx} className="relative group">
                      <div
                        className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 bg-[#0C1B2B] ${
                          evt.severity === 'CRITICAL'
                            ? 'border-[#0A84FF]'
                            : evt.severity === 'HIGH'
                            ? 'border-[#00E5FF]'
                            : 'border-[#00E5FF]/40'
                        }`}
                      />
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono font-bold text-[#00E5FF]">
                          {evt.source}
                        </span>
                        <span className="text-[10px] font-mono text-[#94A3B8]">
                          {new Date(evt.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-[#FFFFFF] font-medium">{evt.event}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Note form */}
              {canPerformAction('update_incident') && (
                <form onSubmit={handleAddTimelineNote} className="pt-4 border-t border-[#1A3959] flex gap-2">
                  <input
                    type="text"
                    value={timelineNote}
                    onChange={(e) => setTimelineNote(e.target.value)}
                    placeholder="Append investigator triage note to incident timeline..."
                    className="flex-1 px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] placeholder-[#94A3B8] focus:outline-none focus:border-[#00E5FF]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0A84FF] hover:bg-[#00E5FF] text-white hover:text-black rounded font-bold text-xs transition-colors cursor-pointer uppercase tracking-wider shadow-xs"
                  >
                    Post Note
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
