import React, { useState } from 'react';
import { 
  Landmark, Coins, Shield, Factory, CheckCircle2, ChevronDown, ChevronUp, ArrowUpRight
} from 'lucide-react';
import { SECTOR_SOLUTIONS } from '../data/mockSecurityData';
import { SectorSolution } from '../types';

interface SectorDefenseProps {
  onRequestBriefing: () => void;
}

export const SectorDefense: React.FC<SectorDefenseProps> = ({
  onRequestBriefing,
}) => {
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({
    'fintech-banking': false,
    'crypto-blockchain': false,
    'federal-bureaus': false,
    'private-public-sectors': false,
  });

  const toggleSector = (id: string) => {
    setExpandedSectors((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getSectorIcon = (id: string) => {
    switch (id) {
      case 'fintech-banking':
        return <Landmark className="w-5 h-5 text-[#22d3ee]" />;
      case 'crypto-blockchain':
        return <Coins className="w-5 h-5 text-[#a78bfa]" />;
      case 'federal-bureaus':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case 'private-public-sectors':
        return <Factory className="w-5 h-5 text-[#22d3ee]" />;
      default:
        return <Shield className="w-5 h-5 text-[#22d3ee]" />;
    }
  };

  return (
    <section
      id="clients"
      className="relative py-20 lg:py-28 border-b border-slate-800/80 bg-[#050914]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="max-w-3xl mb-14 lg:mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-[#22d3ee] text-xs font-sans font-medium tracking-wide">
            <span>Pillar III • Sector Defense</span>
          </div>

          <h2
            id="sector-defense-headline"
            className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold text-white tracking-tight leading-[1.18] text-left"
          >
            Tailored defense for industries where downtime carries real-world consequences.
          </h2>

          <p className="text-base sm:text-lg text-slate-300 font-sans leading-relaxed text-left">
            Mission-critical organizations require sector-specific threat modeling. We integrate active threat hunting and telemetry directly into the core protocols of your industry.
          </p>
        </div>

        {/* 2x2 Matrix Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {SECTOR_SOLUTIONS.map((solution: SectorSolution) => {
            const isExpanded = expandedSectors[solution.id];

            return (
              <div
                key={solution.id}
                id={`sector-card-${solution.id}`}
                className="relative rounded-xl bg-[#070e1b] p-6 sm:p-8 border border-slate-800 hover:border-cyan-500/40 transition-all duration-300 flex flex-col justify-between shadow-lg"
              >
                <div>
                  {/* Top Badge & Icon */}
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-[#050914] border border-slate-800">
                        {getSectorIcon(solution.id)}
                      </div>
                      <h3 className="text-xl sm:text-2xl font-heading font-bold text-white tracking-tight text-left">
                        {solution.sectorName}
                      </h3>
                    </div>

                    <span className="text-xs font-sans font-medium px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                      {solution.badge}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-300 font-sans leading-relaxed mb-6 text-left">
                    {solution.description}
                  </p>

                  {/* Bullets List (Primary 2 visible) */}
                  <div className="space-y-2.5">
                    <ul className="space-y-2">
                      {solution.bullets.slice(0, 2).map((bullet, bIdx) => (
                        <li
                          key={bIdx}
                          className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 font-sans"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#22d3ee] shrink-0 mt-0.5" />
                          <span className="text-left leading-snug">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Expandable More Bullets */}
                  {solution.bullets.length > 2 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => toggleSector(solution.id)}
                        className="w-full flex items-center justify-between text-xs text-[#22d3ee] hover:text-cyan-200 font-medium py-1 cursor-pointer transition-colors"
                      >
                        <span>
                          {isExpanded ? "Hide Sector Details" : `View ${solution.bullets.length - 2} Additional Capabilities`}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {isExpanded && (
                        <ul className="space-y-2 pt-3 animate-fadeIn">
                          {solution.bullets.slice(2).map((bullet, bIdx) => (
                            <li
                              key={bIdx + 2}
                              className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 font-sans"
                            >
                              <CheckCircle2 className="w-4 h-4 text-[#a78bfa] shrink-0 mt-0.5" />
                              <span className="text-left leading-snug">{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Protocol Note & Threat Surface */}
                <div className="mt-8 pt-5 border-t border-slate-800 space-y-2 text-xs font-sans">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-slate-500 font-medium">Protocol Sentinel:</span>
                    <span className="text-[#22d3ee] font-semibold">{solution.protocolNote}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Threat Profile:</span>
                    <span className="text-emerald-400 font-semibold">{solution.threatSurface}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Bar */}
        <div className="mt-12 p-6 sm:p-8 rounded-xl bg-[#070e1b] border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
          <p className="text-sm sm:text-base font-sans text-slate-300">
            Operating in a hybrid or air-gapped enclave? We deploy rapid ESOC sensor integrations in under 48 hours.
          </p>
          <a
            href="#engagement"
            onClick={onRequestBriefing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-950 bg-[#22d3ee] hover:bg-[#67e8f9] transition-all shrink-0 shadow-md cursor-pointer font-sans"
          >
            <span>Initiate Sector Briefing</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </section>
  );
};
