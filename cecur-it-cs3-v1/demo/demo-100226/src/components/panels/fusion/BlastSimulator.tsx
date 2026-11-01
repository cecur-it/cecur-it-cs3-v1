import React, { useState, useEffect } from 'react';
import {
  Flame,
  ShieldCheck,
  AlertTriangle,
  Layers,
  ShieldAlert,
  SlidersHorizontal,
  DollarSign,
  Database,
  Lock,
  Zap,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { BlastSimulationScenario, BlastSimulationResult, FusionGraphNode } from '../../../types';
import { apiRequest } from '../../../lib/api';

interface BlastSimulatorProps {
  scenarios: BlastSimulationScenario[];
  nodes: FusionGraphNode[];
  selectedNodeId: string;
  onSelectOriginNode: (nodeId: string) => void;
  onSimulationUpdate?: (result: BlastSimulationResult) => void;
  onApplyMitigationAction?: (actionText: string) => void;
}

export const BlastSimulator: React.FC<BlastSimulatorProps> = ({
  scenarios,
  nodes,
  selectedNodeId,
  onSelectOriginNode,
  onSimulationUpdate,
  onApplyMitigationAction,
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(scenarios[0]?.scenarioId || 'CREDENTIAL_CASCADE');
  const [originNodeId, setOriginNodeId] = useState<string>(selectedNodeId || nodes[0]?.id || 'node-ws-fin-104');

  // Interactive What-If Containment Sandbox Toggles
  const [activeMitigations, setActiveMitigations] = useState<{
    zero_trust_microsegmentation: boolean;
    revoke_tokens: boolean;
    sever_firewall_links: boolean;
    quarantine_subnet: boolean;
  }>({
    zero_trust_microsegmentation: true,
    revoke_tokens: false,
    sever_firewall_links: true,
    quarantine_subnet: false,
  });

  const [simResult, setSimResult] = useState<BlastSimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync selectedNodeId if prop changes
  useEffect(() => {
    if (selectedNodeId && selectedNodeId !== originNodeId) {
      setOriginNodeId(selectedNodeId);
    }
  }, [selectedNodeId]);

  // Run simulation whenever scenario, origin, or mitigations change
  useEffect(() => {
    const runSimulation = async () => {
      try {
        setLoading(true);
        const appliedKeys = Object.entries(activeMitigations)
          .filter(([_, active]) => active)
          .map(([key]) => key);

        const res = await apiRequest<BlastSimulationResult>('/api/fusion/simulate-blast', {
          method: 'POST',
          body: JSON.stringify({
            scenarioId: activeScenarioId,
            originNodeId,
            appliedMitigations: appliedKeys,
          }),
        });

        setSimResult(res);
        if (onSimulationUpdate) {
          onSimulationUpdate(res);
        }
      } catch (err: any) {
        console.error('Blast simulation failed:', err);
      } finally {
        setLoading(false);
      }
    };

    runSimulation();
  }, [activeScenarioId, originNodeId, activeMitigations]);

  const toggleMitigation = (key: keyof typeof activeMitigations) => {
    setActiveMitigations((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const currentScenario = scenarios.find((s) => s.scenarioId === activeScenarioId) || scenarios[0];

  // Helper for exposure color
  const getExposureColor = (score: number) => {
    if (score < 25) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', fill: '#10B981' };
    if (score < 60) return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', fill: '#F59E0B' };
    return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', fill: '#EF4444' };
  };

  const exposure = simResult?.exposureScore ?? 75;
  const colorStyle = getExposureColor(exposure);

  return (
    <div id="blast-simulator-container" className="flex flex-col gap-3.5 bg-[#111318] border border-slate-800/80 rounded-xl p-3.5 text-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide uppercase">Zero-Trust Blast Radius Simulation</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono font-bold">
                CS3 ENGINE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">Simulate lateral propagation reach, financial risk, & containment efficiency</p>
          </div>
        </div>

        {/* Origin Node Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Origin Asset:</span>
          <select
            id="blast-origin-node-select"
            value={originNodeId}
            onChange={(e) => {
              setOriginNodeId(e.target.value);
              onSelectOriginNode(e.target.value);
            }}
            aria-label="Select Simulation Origin Node"
            className="text-xs bg-[#1A1D24] border border-slate-700/80 text-white rounded-lg px-2.5 py-1 outline-none focus:border-[#00E5FF] font-mono"
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label} ({n.ip}) - {n.zone}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Scenario Selector Pills */}
      <div className="flex flex-wrap gap-1.5">
        {scenarios.map((sc) => (
          <button
            key={sc.scenarioId}
            id={`blast-scenario-btn-${sc.scenarioId}`}
            onClick={() => setActiveScenarioId(sc.scenarioId)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeScenarioId === sc.scenarioId
                ? 'bg-slate-700 text-white border border-[#00E5FF]/60 shadow-sm shadow-[#00E5FF]/10'
                : 'bg-[#181B23] text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>{sc.title.split(' ')[0]} {sc.title.split(' ')[1]}</span>
          </button>
        ))}
      </div>

      {/* Scenario Description */}
      {currentScenario && (
        <div className="bg-[#161922] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">{currentScenario.title}: </span>
            <span className="text-slate-300">{currentScenario.description}</span>
          </div>
        </div>
      )}

      {/* Exposure Score & Dynamic Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Exposure Gauge Metric */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${colorStyle.bg} ${colorStyle.border}`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={colorStyle.text}>Exposure Rating</span>
            <Flame className="w-4 h-4" />
          </div>
          <div className="my-1 flex items-baseline gap-2">
            <span className={`text-2xl font-mono font-extrabold ${colorStyle.text}`}>{exposure}%</span>
            <span className="text-[10px] text-slate-400 uppercase font-mono">
              {exposure < 30 ? 'Low Reach' : exposure < 65 ? 'Elevated' : 'Critical Blast'}
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{ width: `${exposure}%`, backgroundColor: colorStyle.fill }}
            />
          </div>
        </div>

        {/* Reachable Assets */}
        <div className="p-3 rounded-lg bg-[#161922] border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Reachable Assets</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-extrabold text-white">
              {simResult?.atRiskAssetsCount || 1}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ {nodes.length} Nodes</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {simResult?.compromisedHops || 1} Lateral Pivot Hops
          </span>
        </div>

        {/* Financial Risk Valuation */}
        <div className="p-3 rounded-lg bg-[#161922] border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Financial Risk Exposure</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="text-xl font-mono font-extrabold text-emerald-400">
              ${((simResult?.atRiskValueUSD || 450000) / 1000).toLocaleString()}k
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Asset Value at Risk</span>
        </div>

        {/* Sensitive Records at Risk */}
        <div className="p-3 rounded-lg bg-[#161922] border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>PII / ePHI Records</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="text-xl font-mono font-extrabold text-purple-400">
              {(simResult?.atRiskRecordsCount || 12000).toLocaleString()}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Confidential Data Surface</span>
        </div>
      </div>

      {/* What-If Containment Sandbox Toggles */}
      <div className="bg-[#151821] border border-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">What-If Containment Sandbox</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Toggle real-time policy mitigations</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Toggle 1: Microsegmentation */}
          <button
            id="toggle-zero-trust-mitigation"
            onClick={() => toggleMitigation('zero_trust_microsegmentation')}
            className={`flex items-center justify-between p-2 rounded-lg border text-xs font-medium transition-all ${
              activeMitigations.zero_trust_microsegmentation
                ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                : 'bg-[#181B23] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${activeMitigations.zero_trust_microsegmentation ? 'text-cyan-400' : 'text-slate-500'}`} />
              <div className="text-left">
                <div>Enforce Zero-Trust Microsegmentation</div>
                <div className="text-[10px] text-slate-400">Blocks cross-zone DMZ to Internal pivot</div>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${activeMitigations.zero_trust_microsegmentation ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500'}`}>
              -35%
            </span>
          </button>

          {/* Toggle 2: Kerberos Revoke */}
          <button
            id="toggle-revoke-tokens-mitigation"
            onClick={() => toggleMitigation('revoke_tokens')}
            className={`flex items-center justify-between p-2 rounded-lg border text-xs font-medium transition-all ${
              activeMitigations.revoke_tokens
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                : 'bg-[#181B23] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className={`w-4 h-4 ${activeMitigations.revoke_tokens ? 'text-amber-400' : 'text-slate-500'}`} />
              <div className="text-left">
                <div>Revoke Kerberos TGT & Admin Tokens</div>
                <div className="text-[10px] text-slate-400">Purges KRBTGT ticket forgery surface</div>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${activeMitigations.revoke_tokens ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
              -25%
            </span>
          </button>

          {/* Toggle 3: Sever Firewall Links */}
          <button
            id="toggle-sever-links-mitigation"
            onClick={() => toggleMitigation('sever_firewall_links')}
            className={`flex items-center justify-between p-2 rounded-lg border text-xs font-medium transition-all ${
              activeMitigations.sever_firewall_links
                ? 'bg-red-950/40 border-red-500/50 text-red-200'
                : 'bg-[#181B23] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Lock className={`w-4 h-4 ${activeMitigations.sever_firewall_links ? 'text-red-400' : 'text-slate-500'}`} />
              <div className="text-left">
                <div>Sever Lateral Ingress Traffic Links</div>
                <div className="text-[10px] text-slate-400">Drops TCP 445 SMB and RPC pivots</div>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${activeMitigations.sever_firewall_links ? 'bg-red-500/20 text-red-300' : 'bg-slate-800 text-slate-500'}`}>
              -20%
            </span>
          </button>

          {/* Toggle 4: Subnet Quarantine */}
          <button
            id="toggle-quarantine-subnet-mitigation"
            onClick={() => toggleMitigation('quarantine_subnet')}
            className={`flex items-center justify-between p-2 rounded-lg border text-xs font-medium transition-all ${
              activeMitigations.quarantine_subnet
                ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
                : 'bg-[#181B23] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className={`w-4 h-4 ${activeMitigations.quarantine_subnet ? 'text-purple-400' : 'text-slate-500'}`} />
              <div className="text-left">
                <div>Quarantine Exploited Host & VLAN</div>
                <div className="text-[10px] text-slate-400">Isolates origin into sandbox VLAN 999</div>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${activeMitigations.quarantine_subnet ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-500'}`}>
              -30%
            </span>
          </button>
        </div>
      </div>

      {/* Recommended Interventions Runbook */}
      {simResult?.recommendedInterventions && simResult.recommendedInterventions.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Prescriptive Containment Interventions</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {simResult.recommendedInterventions.slice(0, 2).map((inv, idx) => (
              <div
                key={idx}
                className="bg-[#161922] border border-slate-800/80 p-2.5 rounded-lg flex items-start justify-between gap-2"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                      {inv.priority}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400">
                      -{inv.impactReductionPercent}% Exposure
                    </span>
                  </div>
                  <div className="text-xs text-slate-200 font-medium leading-tight">{inv.action}</div>
                </div>

                {onApplyMitigationAction && (
                  <button
                    id={`apply-intervention-${idx}-btn`}
                    onClick={() => onApplyMitigationAction(inv.action)}
                    className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0"
                    title="Apply action"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
