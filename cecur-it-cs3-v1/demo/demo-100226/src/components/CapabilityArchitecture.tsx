import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, ArrowUpRight, Cpu, Layers, CheckCircle2 } from 'lucide-react';
import { CAPABILITY_ITEMS } from '../data/mockSecurityData';
import { CapabilityItem } from '../types';

interface CapabilityArchitectureProps {
  onRequestBriefing: () => void;
}

export const CapabilityArchitecture: React.FC<CapabilityArchitectureProps> = ({
  onRequestBriefing,
}) => {
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    '01': false,
    '02': false,
    '03': false,
  });

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section
      id="capabilities"
      className="relative py-20 lg:py-28 border-b border-slate-800/80 bg-[#050914]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-14 lg:mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-[#22d3ee] text-xs font-sans font-medium tracking-wide">
            <span>Pillar I • Capability Architecture</span>
          </div>

          <h2
            id="capabilities-headline"
            className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold text-white tracking-tight leading-[1.18] text-left"
          >
            Bridging enterprise IT security and critical operational systems.
          </h2>

          <p
            id="capabilities-subtext"
            className="text-base sm:text-lg text-slate-300 font-sans leading-relaxed text-left"
          >
            Every engagement is led directly by the senior architect who scopes it — ensuring proven field strategy, zero junior hand-offs, and continuous alignment.
          </p>
        </div>

        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {CAPABILITY_ITEMS.map((item: CapabilityItem) => {
            const isExpanded = expandedCards[item.id];
            
            return (
              <div
                key={item.id}
                id={`capability-card-${item.id}`}
                className="relative flex flex-col justify-between rounded-xl bg-[#070e1b] border border-slate-800/90 hover:border-cyan-500/40 transition-all duration-300 p-6 sm:p-7 shadow-lg"
              >
                <div>
                  {/* Top Column Number & Tag */}
                  <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800 text-xs">
                    <span className="font-heading font-bold text-sm text-[#22d3ee]">
                      Pillar {item.columnNumber}
                    </span>
                    <span className="text-xs text-slate-400 font-medium px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
                      {item.categoryTag}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl sm:text-2xl font-heading font-bold text-white mb-3 text-left tracking-tight">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-slate-300 font-sans leading-relaxed mb-6 text-left">
                    {item.description}
                  </p>

                  {/* Core High-Level Highlights (Always Visible) */}
                  <div className="space-y-3">
                    <ul className="space-y-2.5">
                      {item.bullets.slice(0, 2).map((bullet, bIdx) => (
                        <li
                          key={bIdx}
                          className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 font-sans"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#22d3ee] shrink-0 mt-0.5" />
                          <span className="leading-snug text-left">
                            {bullet.isNew && (
                              <span className="inline-block px-1.5 py-0.2 mr-1.5 text-[10px] font-semibold bg-cyan-950 text-cyan-300 rounded border border-cyan-500/30">
                                NEW
                              </span>
                            )}
                            {bullet.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Expandable Deep Technical Specifications */}
                  {item.bullets.length > 2 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="w-full flex items-center justify-between text-xs text-[#22d3ee] hover:text-cyan-200 font-medium py-1.5 cursor-pointer transition-colors"
                      >
                        <span>
                          {isExpanded 
                            ? "Hide Technical Specifications" 
                            : `View ${item.bullets.length - 2} More Technical Specs`}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {isExpanded && (
                        <ul className="space-y-2.5 pt-3 pb-1 animate-fadeIn">
                          {item.bullets.slice(2).map((bullet, bIdx) => (
                            <li
                              key={bIdx + 2}
                              className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 font-sans"
                            >
                              <CheckCircle2 className="w-4 h-4 text-[#a78bfa] shrink-0 mt-0.5" />
                              <span className="leading-snug text-left">
                                {bullet.isNew && (
                                  <span className="inline-block px-1.5 py-0.2 mr-1.5 text-[10px] font-semibold bg-purple-950 text-purple-300 rounded border border-purple-500/30">
                                    NEW
                                  </span>
                                )}
                                {bullet.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Sensor Telemetry Status */}
                <div className="mt-8 pt-4 border-t border-slate-800">
                  <div className="p-2.5 rounded-lg bg-[#050914] text-xs font-sans text-slate-300 border border-slate-800 flex items-center justify-between">
                    <span className="truncate text-slate-400">{item.sensorFeed}</span>
                    <span className="text-emerald-400 font-mono text-[11px] font-semibold ml-2 shrink-0 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Architectural Callout */}
        <div className="mt-12 p-6 sm:p-8 rounded-xl bg-[#070e1b] border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="space-y-1">
            <span className="text-xs font-sans font-semibold uppercase text-[#22d3ee] tracking-wider">
              Principal Architect Review
            </span>
            <p className="text-sm sm:text-base text-slate-200 font-sans">
              Need a targeted capability assessment for your federal enclave, FinTech gateway, or SCADA facility?
            </p>
          </div>
          <a
            href="#engagement"
            onClick={onRequestBriefing}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-950 bg-[#22d3ee] hover:bg-[#67e8f9] rounded-lg transition-all shrink-0 shadow-md cursor-pointer font-sans"
          >
            <span>Request Architect Review</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </section>
  );
};
