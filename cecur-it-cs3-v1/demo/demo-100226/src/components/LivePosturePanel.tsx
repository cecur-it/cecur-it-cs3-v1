import React, { useState, useEffect } from 'react';
import { 
  Terminal, Play, Pause, ChevronDown, ChevronUp, ShieldCheck, Activity, Cpu
} from 'lucide-react';
import { INITIAL_TELEMETRY_LOGS } from '../data/mockSecurityData';
import { TelemetryLog } from '../types';

export const LivePosturePanel: React.FC = () => {
  const [logs, setLogs] = useState<TelemetryLog[]>(INITIAL_TELEMETRY_LOGS);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [packetCounter, setPacketCounter] = useState(8492014);
  const [fraudBlockedCount, setFraudBlockedCount] = useState(148);
  const [showDetailedStream, setShowDetailedStream] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CRITICAL' | 'FINTECH' | 'ICS_SCADA' | 'NANO_VM'>('ALL');

  // 5 vertical bars representing threat surface & fraud/AML anomaly levels (0-100%)
  const [threatBars, setThreatBars] = useState<number[]>([42, 68, 85, 34, 58]);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const OPERATIONAL_LAYERS = [
    {
      id: 'l1',
      code: 'L-01',
      name: 'Fraud / AML',
      sub: 'FinTech Stream',
      telemetry: '0.8ms Latency Interdiction',
      status: 'ACTIVE',
    },
    {
      id: 'l2',
      code: 'L-02',
      name: 'ICS / SCADA',
      sub: 'Cyber-Physical',
      telemetry: '60.00 Hz DNP3 Sync',
      status: 'SYNCHRONIZED',
    },
    {
      id: 'l3',
      code: 'L-03',
      name: 'Nano-VM',
      sub: 'BYOS Mesh',
      telemetry: '60,000 Nodes Active',
      status: 'NOMINAL',
    },
    {
      id: 'l4',
      code: 'L-04',
      name: 'Fed Airgap',
      sub: 'DoD Enclave',
      telemetry: 'Zero Diode Reflection',
      status: 'ISOLATED',
    },
    {
      id: 'l5',
      code: 'L-05',
      name: 'Blockchain',
      sub: 'Bridge Relay',
      telemetry: '100% Invariant Validated',
      status: 'VERIFIED',
    },
  ];

  useEffect(() => {
    if (!isLiveStreaming) return;

    const dynamicFeeds: Array<() => TelemetryLog> = [
      () => ({
        id: `tx-${Math.floor(Math.random() * 90000) + 10000}`,
        timestamp: new Date().toISOString().substring(11, 19),
        source: 'AML_ENGINE',
        level: Math.random() > 0.65 ? 'ANOMALY_BLOCKED' : 'NOMINAL',
        message: Math.random() > 0.65 
          ? 'AML Velocity Spike intercepted on crypto-fiat gateway' 
          : 'ISO 20022 clearing batch verified and approved',
        txId: `0x${Math.random().toString(16).substring(2, 8)}...`,
        metric: Math.random() > 0.65 ? 'LATENCY: 1.8ms // CONTAINED' : '$1.84M SETTLED',
        status: Math.random() > 0.65 ? 'INTERCEPTED' : 'CLEARED'
      }),
      () => ({
        id: `scada-${Math.floor(Math.random() * 900) + 100}`,
        timestamp: new Date().toISOString().substring(11, 19),
        source: 'ICS_SCADA',
        level: 'NOMINAL',
        message: 'Substation Alpha-9 RTU integrity verified, DNP3 auth active',
        metric: 'VOLTAGE: 345.1 kV // 60.00 Hz',
        status: 'NOMINAL'
      }),
      () => ({
        id: `node-${Math.floor(Math.random() * 900) + 100}`,
        timestamp: new Date().toISOString().substring(11, 19),
        source: 'BYOS_NANO_VM',
        level: 'NOMINAL',
        message: 'Nano-VM estate sync: 60,000 nodes memory integrity verified',
        metric: '60K NODES ACTIVE',
        status: 'IN-SYNC'
      }),
      () => ({
        id: `bridge-${Math.floor(Math.random() * 900) + 100}`,
        timestamp: new Date().toISOString().substring(11, 19),
        source: 'BLOCKCHAIN_BRIDGE',
        level: Math.random() > 0.7 ? 'INSPECT' : 'NOMINAL',
        message: 'Decentralized liquidity bridge: Merkle root validated against canonical chain',
        txId: `0x${Math.random().toString(16).substring(2, 8)}...`,
        metric: 'PROOF ACCURACY: 100%',
        status: 'AUTHENTICATED'
      })
    ];

    const interval = setInterval(() => {
      const randomFeed = dynamicFeeds[Math.floor(Math.random() * dynamicFeeds.length)]();
      setLogs((prev) => [randomFeed, ...prev.slice(0, 14)]);
      setPacketCounter((prev) => prev + Math.floor(Math.random() * 85) + 15);
      
      // Update threat levels dynamically
      setThreatBars([
        Math.floor(Math.random() * 30) + 30,
        Math.floor(Math.random() * 35) + 40,
        Math.floor(Math.random() * 25) + 65,
        Math.floor(Math.random() * 30) + 20,
        Math.floor(Math.random() * 30) + 45,
      ]);

      if (randomFeed.level === 'ANOMALY_BLOCKED') {
        setFraudBlockedCount((prev) => prev + 1);
      }
    }, 2800);

    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  const filteredLogs = logs.filter((log) => {
    if (selectedFilter === 'CRITICAL') return log.level === 'ANOMALY_BLOCKED';
    if (selectedFilter === 'FINTECH') return log.source === 'AML_ENGINE' || log.source === 'BLOCKCHAIN';
    if (selectedFilter === 'ICS_SCADA') return log.source === 'ICS_SCADA';
    if (selectedFilter === 'NANO_VM') return log.source === 'BYOS_NANO_VM';
    return true;
  });

  return (
    <div
      id="live-posture-terminal"
      className="relative rounded-xl bg-[#070e1b] border border-slate-800 shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden text-slate-300 transition-all duration-300"
    >
      {/* Terminal Top Window Bar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-[#0a1426] border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="font-heading font-bold text-white text-sm tracking-wide">
            CECUR / ESOC
          </span>
          <span className="text-[11px] font-mono text-slate-400 border-l border-slate-700 pl-2">
            Sensor Suite v3.5
          </span>
        </div>

        {/* Live Posture with pulsing dot */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-[#22d3ee] animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#22d3ee]">
              live posture
            </span>
          </div>

          <button
            id="toggle-stream-btn"
            type="button"
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className="p-1.5 rounded-md bg-[#091122] hover:bg-[#0c1830] text-slate-300 hover:text-[#22d3ee] border border-slate-800 transition-colors cursor-pointer"
            title={isLiveStreaming ? "Pause Live Feed" : "Resume Feed"}
          >
            {isLiveStreaming ? <Pause className="w-3.5 h-3.5 text-[#22d3ee]" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Main Status & Threat Surface Summary */}
      <div className="p-5 sm:p-6 bg-[#070e1b] border-b border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Active Security State
            </span>
            <div className="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>THREAT SURFACE</span>
              <span className="text-slate-600 font-light">/</span>
              <span className="text-[#22d3ee] font-mono font-bold">
                CONTAINED
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-[#050914] border border-slate-800 text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                Interdiction Speed
              </div>
              <div className="text-sm font-semibold text-emerald-400 font-mono mt-0.5">
                &lt; 2.1ms (Zero Impact)
              </div>
            </div>
          </div>
        </div>

        {/* Vertical Bar Chart (5 bars with Cyan to Purple gradient & Full X-Axis Definition) */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-sans">
              <Activity className="w-3.5 h-3.5 text-[#22d3ee]" />
              <span className="font-semibold text-slate-200">
                Continuous Threat Surface Analysis (5 Operational Layers)
              </span>
            </span>
            <span className="text-[11px] font-mono text-[#a78bfa] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
              Real-Time Calibration
            </span>
          </div>

          {/* Dedicated Telemetry Chart Container */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#050914] border border-slate-800 relative">
            {/* Background horizontal calibration grid lines */}
            <div className="absolute inset-x-4 top-9 h-28 pointer-events-none opacity-20 flex flex-col justify-between z-0">
              <div className="border-b border-dashed border-slate-500 w-full" />
              <div className="border-b border-dashed border-slate-500 w-full" />
              <div className="border-b border-dashed border-slate-500 w-full" />
            </div>

            {/* 5-Column Bar Grid */}
            <div className="grid grid-cols-5 gap-2 sm:gap-3 items-end relative z-10">
              {threatBars.map((val, bIdx) => {
                const layer = OPERATIONAL_LAYERS[bIdx];
                const isHovered = hoveredBarIndex === bIdx;

                return (
                  <div
                    key={layer.id}
                    onMouseEnter={() => setHoveredBarIndex(bIdx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    className="flex flex-col items-center group cursor-pointer"
                  >
                    {/* Value Badge above bar */}
                    <div className="mb-1.5 flex items-center justify-center">
                      <span
                        className={`text-[10px] sm:text-xs font-mono font-bold transition-transform duration-200 ${
                          isHovered ? 'text-[#22d3ee] scale-110' : 'text-cyan-300'
                        }`}
                      >
                        {val}%
                      </span>
                    </div>

                    {/* Bar Track with dedicated height */}
                    <div className="w-full h-28 sm:h-32 bg-slate-900/90 rounded-t border-t border-x border-slate-800/90 relative flex items-end p-0.5 sm:p-1 overflow-hidden group-hover:border-cyan-500/50 transition-colors">
                      {/* Gradient Bar Fill */}
                      <div
                        style={{ height: `${val}%` }}
                        className={`w-full rounded-t transition-all duration-700 bg-gradient-to-t from-[#22d3ee] via-[#38bdf8] to-[#a78bfa] ${
                          isHovered
                            ? 'shadow-[0_0_14px_rgba(34,211,238,0.7)] brightness-110'
                            : 'shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Baseline & Full Responsive Layer Labels */}
            <div className="border-t border-slate-700/80 mt-2.5 pt-2.5 grid grid-cols-5 gap-2 sm:gap-3 relative z-10">
              {OPERATIONAL_LAYERS.map((layer, bIdx) => {
                const isHovered = hoveredBarIndex === bIdx;
                return (
                  <div
                    key={layer.id}
                    onMouseEnter={() => setHoveredBarIndex(bIdx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    className={`flex flex-col items-center text-center transition-colors cursor-pointer group`}
                  >
                    {/* Layer ID Badge */}
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono font-bold tracking-wider uppercase px-1 py-0.5 rounded transition-all ${
                        isHovered
                          ? 'bg-cyan-950 text-[#22d3ee] border border-cyan-500/50 scale-105'
                          : 'bg-slate-900/90 text-cyan-400/90 border border-slate-800'
                      }`}
                    >
                      {layer.code}
                    </span>

                    {/* X-Axis Main Label Name (No truncate, legible formatting) */}
                    <span
                      className={`text-[10px] sm:text-[11px] font-medium font-sans mt-1.5 leading-tight transition-colors ${
                        isHovered ? 'text-white font-semibold' : 'text-slate-300'
                      }`}
                    >
                      {layer.name}
                    </span>

                    {/* X-Axis Operational Subtitle */}
                    <span className="text-[9px] text-slate-400 font-mono hidden sm:block mt-0.5 leading-tight">
                      {layer.sub}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Telemetry Status Readout Bar */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-300 truncate mr-2">
                <span className="text-cyan-400 font-semibold shrink-0">
                  {hoveredBarIndex !== null ? OPERATIONAL_LAYERS[hoveredBarIndex].code : 'SURFACE'}:
                </span>
                <span className="truncate">
                  {hoveredBarIndex !== null
                    ? `${OPERATIONAL_LAYERS[hoveredBarIndex].name} • ${OPERATIONAL_LAYERS[hoveredBarIndex].telemetry}`
                    : '5/5 Defense Sensor Streams Active'}
                </span>
              </div>
              <div className="text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>
                  {hoveredBarIndex !== null
                    ? OPERATIONAL_LAYERS[hoveredBarIndex].status
                    : 'CONTAINED'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Dropdown Section for Technical Telemetry */}
      <div className="bg-[#050b16]">
        {/* Toggle Dropdown Header */}
        <button
          type="button"
          onClick={() => setShowDetailedStream(!showDetailedStream)}
          className="w-full px-5 py-3 flex items-center justify-between text-xs font-sans text-slate-300 hover:text-white hover:bg-slate-900/40 transition-colors border-b border-slate-800/80 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#22d3ee]" />
            <span className="font-medium text-slate-200">
              {showDetailedStream ? "Hide Technical ESOC Logs" : "View Live ESOC Telemetry & Stream Details"}
            </span>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20 ml-1">
              {packetCounter.toLocaleString()} Events
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#22d3ee] font-medium">
            <span>{showDetailedStream ? "Collapse" : "Expand Stream"}</span>
            {showDetailedStream ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Collapsible Telemetry Content */}
        {showDetailedStream && (
          <div className="p-4 sm:p-5 border-b border-slate-800 animate-fadeIn">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pb-3 mb-3 border-b border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px] mr-1">Filter Stream:</span>
              {(['ALL', 'CRITICAL', 'FINTECH', 'ICS_SCADA', 'NANO_VM'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    selectedFilter === filter
                      ? 'bg-cyan-950 border border-cyan-500/50 text-[#22d3ee] font-semibold'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {filter === 'ALL' && 'All Events'}
                  {filter === 'CRITICAL' && '⚠ Anomalies'}
                  {filter === 'FINTECH' && 'FinTech & AML'}
                  {filter === 'ICS_SCADA' && 'ICS / SCADA'}
                  {filter === 'NANO_VM' && 'Nano-VMs'}
                </button>
              ))}
            </div>

            {/* Live Stream List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 font-mono text-xs">
              {filteredLogs.slice(0, 5).map((log, idx) => {
                const isCritical = log.level === 'ANOMALY_BLOCKED';
                
                return (
                  <div
                    key={log.id + idx}
                    className={`p-2.5 rounded-lg border text-[11px] transition-colors ${
                      isCritical
                        ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                        : 'bg-[#081020] border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">[{log.timestamp}]</span>
                        <span className="text-[#22d3ee] font-bold">{log.source}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <div className="text-slate-300 truncate">{log.message}</div>
                    {log.metric && (
                      <div className="text-[10px] text-slate-400 mt-1">
                        Metric: <span className="text-cyan-300">{log.metric}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer inside panel */}
      <div className="px-5 py-3 bg-[#050914] flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-[#22d3ee]" />
          <span>HATS / 05 LAYERS</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1.5 text-[#22d3ee] font-mono font-bold">
          <span>NODE : 60K+</span>
        </div>
      </div>
    </div>
  );
};
