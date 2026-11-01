import React from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ShieldAlert,
  ArrowRight,
  Crosshair,
  Terminal,
  Activity,
  CheckCircle2,
  Lock,
  Zap,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { AttackPath, AttackPathStep, FusionGraphNode } from '../../../types';

interface AttackPathTracerProps {
  attackPaths: AttackPath[];
  activePathId: string;
  onSelectPath: (pathId: string) => void;
  activeStepIndex: number;
  onSelectStep: (stepIndex: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  nodes: FusionGraphNode[];
  onRemediateStep?: (step: AttackPathStep) => void;
  onFocusNode?: (nodeId: string) => void;
}

export const AttackPathTracer: React.FC<AttackPathTracerProps> = ({
  attackPaths,
  activePathId,
  onSelectPath,
  activeStepIndex,
  onSelectStep,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
  nodes,
  onRemediateStep,
  onFocusNode,
}) => {
  const currentPath = attackPaths.find((p) => p.id === activePathId) || attackPaths[0];

  if (!currentPath) {
    return (
      <div id="attack-path-tracer-empty" className="p-4 text-xs text-slate-400 bg-[#12141A] border border-slate-800 rounded-lg">
        No active attack paths identified in current topology snapshot.
      </div>
    );
  }

  const steps = currentPath.steps || [];
  const currentStep = steps[activeStepIndex] || steps[0];

  const sourceNode = nodes.find((n) => n.id === currentStep?.sourceNodeId);
  const targetNode = nodes.find((n) => n.id === currentStep?.targetNodeId);

  return (
    <div id="attack-path-tracer-container" className="flex flex-col gap-3 bg-[#111318] border border-slate-800/80 rounded-xl p-3.5 text-slate-200">
      {/* Header & Path Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Crosshair className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide uppercase">Trace Lateral Attack Path</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  currentPath.severity === 'CRITICAL'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {currentPath.severity}
              </span>
              {currentPath.associatedIncidentId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                  {currentPath.associatedIncidentId}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">Interactive hop-by-hop lateral movement & MITRE kill-chain playback</p>
          </div>
        </div>

        {/* Path Selection Dropdown */}
        <select
          id="attack-path-select"
          value={activePathId}
          onChange={(e) => {
            onSelectPath(e.target.value);
            onSelectStep(0);
          }}
          aria-label="Select Correlated Attack Path"
          className="text-xs bg-[#1A1D24] border border-slate-700/80 text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#00E5FF] max-w-[280px] font-medium"
        >
          {attackPaths.map((path) => (
            <option key={path.id} value={path.id}>
              {path.name}
            </option>
          ))}
        </select>
      </div>

      {/* Path Summary & Playback Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#161922] p-2 rounded-lg border border-slate-800">
        {/* Play / Step Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            id="attack-path-prev-step-btn"
            onClick={() => onSelectStep(Math.max(0, activeStepIndex - 1))}
            disabled={activeStepIndex === 0}
            className="p-1.5 rounded-md bg-[#1F232E] hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous Step"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            id="attack-path-play-toggle-btn"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-lg shadow-amber-500/20'
                : 'bg-[#00E5FF] hover:bg-[#00cce6] text-black font-bold shadow-lg shadow-[#00E5FF]/20'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-black" />
                <span>Pause Trace</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Play Live Trace</span>
              </>
            )}
          </button>

          <button
            id="attack-path-next-step-btn"
            onClick={() => onSelectStep(Math.min(steps.length - 1, activeStepIndex + 1))}
            disabled={activeStepIndex === steps.length - 1}
            className="p-1.5 rounded-md bg-[#1F232E] hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next Step"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            id="attack-path-reset-btn"
            onClick={() => onSelectStep(0)}
            className="p-1.5 rounded-md bg-[#1F232E] hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Reset to Step 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span>Speed:</span>
          {[0.5, 1, 2].map((spd) => (
            <button
              key={spd}
              id={`playback-speed-${spd}x-btn`}
              onClick={() => onChangeSpeed(spd)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                playbackSpeed === spd ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Step Indicator Badges */}
        <div className="flex items-center gap-1">
          {steps.map((s, idx) => (
            <button
              key={s.stepNumber}
              id={`attack-step-jump-${s.stepNumber}`}
              onClick={() => onSelectStep(idx)}
              className={`w-6 h-6 rounded-full text-[10px] font-mono font-bold flex items-center justify-center transition-all ${
                idx === activeStepIndex
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/50 scale-110 ring-2 ring-red-400/50'
                  : idx < activeStepIndex
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              title={`Step ${s.stepNumber}: ${s.title}`}
            >
              {s.stepNumber}
            </button>
          ))}
        </div>
      </div>

      {/* Active Step Details Card */}
      {currentStep && (
        <div className="bg-[#151821] border border-slate-800 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                STEP {currentStep.stepNumber} OF {steps.length}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase">
                {currentStep.stage.replace('_', ' ')}
              </span>
              <span className="text-xs font-bold text-white">{currentStep.title}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Confidence:</span>
              <span className="text-[11px] font-mono font-bold text-emerald-400">{currentStep.confidence}%</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 mb-3">{currentStep.description}</p>

          {/* Hop Asset Connectivity Visualizer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-[#0D0F14] p-2.5 rounded-lg border border-slate-800/80 mb-3">
            <div
              className="flex items-center justify-between p-1.5 rounded bg-[#161922] border border-slate-700/60 cursor-pointer hover:border-slate-500 transition-colors"
              onClick={() => onFocusNode && onFocusNode(currentStep.sourceNodeId)}
              title="Click to focus on source asset in map"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">SRC</span>
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate">{sourceNode?.label || currentStep.sourceNodeId}</div>
                  <div className="text-[10px] font-mono text-slate-400">{sourceNode?.ip || 'Internal Host'}</div>
                </div>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">{sourceNode?.zone || 'INTERNAL'}</span>
            </div>

            <div
              className="flex items-center justify-between p-1.5 rounded bg-[#161922] border border-slate-700/60 cursor-pointer hover:border-slate-500 transition-colors"
              onClick={() => onFocusNode && onFocusNode(currentStep.targetNodeId)}
              title="Click to focus on target asset in map"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800/50 uppercase">TGT</span>
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate">{targetNode?.label || currentStep.targetNodeId}</div>
                  <div className="text-[10px] font-mono text-slate-400">{targetNode?.ip || 'Target Node'}</div>
                </div>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-red-400">{targetNode?.zone || 'CORE'}</span>
            </div>
          </div>

          {/* Technical Telemetry & Payload */}
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase">MITRE Technique:</span>
              <span className="text-[11px] font-mono font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {currentStep.mitreTechnique}
              </span>
              <span className="text-[10px] font-mono text-slate-500">|</span>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Protocol:</span>
              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {currentStep.protocol}
              </span>
            </div>

            {/* Injected Command / Detection */}
            <div className="bg-[#090A0D] border border-slate-800 rounded p-2 font-mono text-[11px] text-slate-300 flex items-start gap-2 overflow-x-auto">
              <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <div className="truncate">
                <span className="text-slate-500 select-none">$ </span>
                <span className="text-red-300 font-medium">{currentStep.payloadCommand}</span>
              </div>
            </div>

            {/* Detection Engine */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Detection: <strong className="text-slate-200">{currentStep.detectionSource}</strong></span>
              </div>

              {onRemediateStep && (
                <button
                  id={`remediate-step-${currentStep.stepNumber}-btn`}
                  onClick={() => onRemediateStep(currentStep)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[11px] font-semibold transition-colors shadow-sm"
                >
                  <Lock className="w-3 h-3" />
                  <span>Execute Step Containment</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
