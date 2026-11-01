import React, { useState } from 'react';
import { Layers, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

export interface HatsTableRow {
  layer: string;
  threats: string;
  governance: string;
  monitoring: string;
  baseline: string;
  executiveSummary: string;
}

export const HATS_TABLE_DATA: HatsTableRow[] = [
  {
    layer: '01. Inventory',
    threats: 'Threat modeling & perimeter assessment',
    governance: 'ISO 27001 / ITIL standards',
    monitoring: 'Full device operability and physical telemetry',
    baseline: 'Placement and verified network topology',
    executiveSummary: 'Complete physical and logical enumeration of all hardware, cloud endpoints, and remote field sensors.'
  },
  {
    layer: '02. Assets',
    threats: 'Static & dynamic vulnerability analysis',
    governance: 'PCI-DSS v4.0, HIPAA, SEC Cyb-Rules',
    monitoring: 'Real-time delta tracking against approved baselines',
    baseline: 'Multi-tenant & hybrid enclave boundary',
    executiveSummary: 'Continuous fingerprinting and delta detection across software packages, APIs, and data stores.'
  },
  {
    layer: '03. Risk',
    threats: 'In-band & out-of-band adversary modeling',
    governance: 'Federal, State, and Local regulatory mandates',
    monitoring: 'Unified SIEM, SOAR, and file integrity telemetry',
    baseline: 'Enclave network topology & trust domains',
    executiveSummary: 'Dynamic risk scoring and immediate interdiction prioritization before lateral movement occurs.'
  },
  {
    layer: '04. Segmentation',
    threats: 'Application whitelisting & lateral killswitch',
    governance: 'COBIT, SOX, CFATS, NIST-CIP',
    monitoring: 'Nano-VM micro-isolation and memory integrity',
    baseline: 'Logical and physical airgap architectures',
    executiveSummary: 'Zero-trust cryptographic isolation ensuring that compromised nodes cannot access core ledger or SCADA domains.'
  },
  {
    layer: '05. Compliance',
    threats: 'NERC / FERC & Critical exposure mapping',
    governance: 'NIST 800-53, 800-171, FedRAMP High',
    monitoring: 'Continuous automated posture validation',
    baseline: 'Hardened cryptographic golden endpoints',
    executiveSummary: 'Direct translation of engineering controls into continuous audit-ready compliance packages.'
  }
];

interface HatsFrameworkTableProps {
  onRequestBriefing?: () => void;
}

export const HatsFrameworkTable: React.FC<HatsFrameworkTableProps> = ({
  onRequestBriefing,
}) => {
  const [activeLayerIndex, setActiveLayerIndex] = useState<number | null>(null);
  const [showFullMatrix, setShowFullMatrix] = useState(false);

  return (
    <section
      id="hats-method"
      className="relative py-20 lg:py-28 border-b border-slate-800/80 bg-[#050914]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-12 lg:mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-[#22d3ee] text-xs font-sans font-medium tracking-wide">
            <span>Pillar II • Proprietary Operating Framework</span>
          </div>

          <h2
            id="hats-framework-title"
            className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold text-white tracking-tight leading-[1.18] text-left"
          >
            HATS: Holistic Approach to Security
          </h2>

          <p
            id="hats-framework-subtext"
            className="text-base sm:text-lg text-slate-300 font-sans leading-relaxed text-left"
          >
            Our battle-tested five-layer framework for high-assurance environments, in continuous active field use since 2016.
          </p>
        </div>

        {/* 5-Layer Executive Stepper Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {HATS_TABLE_DATA.map((layer, idx) => {
            const isSelected = activeLayerIndex === idx;

            return (
              <div
                key={layer.layer}
                onClick={() => setActiveLayerIndex(isSelected ? null : idx)}
                className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#09152b] border-[#22d3ee] shadow-[0_0_25px_rgba(34,211,238,0.2)]'
                    : 'bg-[#070e1b] border-slate-800 hover:border-cyan-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-heading font-bold text-sm text-[#22d3ee]">
                      Layer {idx + 1}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  </div>
                  <h3 className="font-heading font-bold text-white text-base mb-2">
                    {layer.layer.replace(/^\d+\.\s*/, '')}
                  </h3>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    {layer.executiveSummary}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-cyan-300 font-medium">
                  <span>{isSelected ? "Collapse Details" : "View Standards"}</span>
                  {isSelected ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Layer Deep Dive (Shows when a card is clicked) */}
        {activeLayerIndex !== null && (
          <div className="mb-10 p-6 sm:p-7 rounded-xl bg-[#070f20] border border-cyan-500/40 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-cyan-950 text-[#22d3ee] border border-cyan-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <span className="text-xs uppercase font-mono text-cyan-400">Layer 0{activeLayerIndex + 1} Specification</span>
                  <h4 className="text-xl font-heading font-bold text-white">
                    {HATS_TABLE_DATA[activeLayerIndex].layer} Architecture Details
                  </h4>
                </div>
              </div>
              <button
                onClick={() => setActiveLayerIndex(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-800 cursor-pointer"
              >
                Close View ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-[#050914] border border-slate-800">
                <span className="text-slate-400 font-medium block mb-1">Threat Mitigation</span>
                <span className="text-slate-200 font-sans">{HATS_TABLE_DATA[activeLayerIndex].threats}</span>
              </div>
              <div className="p-4 rounded-lg bg-[#050914] border border-slate-800">
                <span className="text-slate-400 font-medium block mb-1">Governance &amp; Frameworks</span>
                <span className="text-cyan-300 font-sans font-medium">{HATS_TABLE_DATA[activeLayerIndex].governance}</span>
              </div>
              <div className="p-4 rounded-lg bg-[#050914] border border-slate-800">
                <span className="text-slate-400 font-medium block mb-1">Continuous Monitoring</span>
                <span className="text-emerald-300 font-sans">{HATS_TABLE_DATA[activeLayerIndex].monitoring}</span>
              </div>
              <div className="p-4 rounded-lg bg-[#050914] border border-slate-800">
                <span className="text-slate-400 font-medium block mb-1">Baseline Standard</span>
                <span className="text-purple-300 font-sans">{HATS_TABLE_DATA[activeLayerIndex].baseline}</span>
              </div>
            </div>
          </div>
        )}

        {/* Toggle Full Matrix View */}
        <div className="text-center mb-6">
          <button
            type="button"
            onClick={() => setShowFullMatrix(!showFullMatrix)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-xs font-sans font-medium text-slate-200 border border-slate-700 hover:border-cyan-500/40 transition-colors cursor-pointer"
          >
            <Layers className="w-4 h-4 text-[#22d3ee]" />
            <span>{showFullMatrix ? "Hide Complete Compliance Matrix" : "View Complete 5-Layer Compliance Matrix"}</span>
            {showFullMatrix ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Complete Matrix Table (Expandable) */}
        {showFullMatrix && (
          <div className="rounded-xl bg-[#070e1b] border border-slate-800 shadow-xl overflow-hidden animate-fadeIn mb-10">
            <div className="px-5 py-3.5 bg-[#0a1426] border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-heading font-bold text-white">
                CECUR-IT 5-Layer Operational Governance Matrix
              </span>
              <span className="text-emerald-400 font-mono text-[11px]">
                Active Field Standards 2016-Present
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm font-sans">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#091122]/90 text-[11px] text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6 font-bold text-[#22d3ee] border-r border-slate-800">Layer</th>
                    <th className="py-3.5 px-4 sm:px-6 font-semibold text-slate-300 border-r border-slate-800">Threats &amp; Vulnerabilities</th>
                    <th className="py-3.5 px-4 sm:px-6 font-semibold text-slate-300 border-r border-slate-800">Governance &amp; Compliance</th>
                    <th className="py-3.5 px-4 sm:px-6 font-semibold text-slate-300 border-r border-slate-800">Continuous Monitoring</th>
                    <th className="py-3.5 px-4 sm:px-6 font-semibold text-slate-300">Baseline Architecture</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {HATS_TABLE_DATA.map((row, idx) => (
                    <tr key={row.layer} className={idx % 2 === 0 ? 'bg-[#070e1b]' : 'bg-[#060c18]'}>
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-white border-r border-slate-800 font-heading">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee]" />
                          <span className="text-cyan-300">{row.layer}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-300 border-r border-slate-800">{row.threats}</td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-300 border-r border-slate-800">{row.governance}</td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-300 border-r border-slate-800">{row.monitoring}</td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-300">{row.baseline}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3 Executive Assurance Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs sm:text-sm font-sans">
          <div className="p-5 rounded-xl bg-[#070e1b] border border-slate-800">
            <h4 className="font-heading font-bold text-white text-base mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22d3ee]" /> Dual-Discipline Integration
            </h4>
            <p className="text-slate-300 leading-relaxed text-left">
              Combines hands-on threat hunting with regulatory authorization so every compliance artifact is verified against real adversary techniques.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#070e1b] border border-slate-800">
            <h4 className="font-heading font-bold text-white text-base mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22d3ee]" /> Zero-Blind-Spot Cadence
            </h4>
            <p className="text-slate-300 leading-relaxed text-left">
              Continuous monitoring tracks micro-deltas against mathematical baselines across nano-VM clusters, SCADA RTUs, and financial ledger bridges.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#070e1b] border border-slate-800">
            <h4 className="font-heading font-bold text-white text-base mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22d3ee]" /> Governance Translation
            </h4>
            <p className="text-slate-300 leading-relaxed text-left">
              Directly translates engineering telemetry into audit-ready packages for DISA IL5/IL6, NERC CIP-002 through CIP-014, and ISO/IEC 27001.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
