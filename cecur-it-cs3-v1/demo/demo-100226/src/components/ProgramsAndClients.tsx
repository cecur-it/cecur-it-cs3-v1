import React from 'react';
import { CheckCircle2, ArrowUpRight, ShieldCheck, Award } from 'lucide-react';
import { CREDENTIALS_LIST, PROGRAMS_LIST } from '../data/mockSecurityData';

interface ProgramsAndClientsProps {
  onRequestBriefing: () => void;
}

export const ProgramsAndClients: React.FC<ProgramsAndClientsProps> = ({
  onRequestBriefing,
}) => {
  return (
    <>
      {/* Programs Section */}
      <section
        id="programs"
        className="relative py-20 lg:py-24 border-b border-slate-800/80 bg-[#050914]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-[#22d3ee] text-xs font-sans font-medium tracking-wide">
              <span>Pillar V • Defense Programs</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white tracking-tight leading-[1.18] text-left">
              Structured defense programs built for critical operational cadence.
            </h2>
            <p className="text-base sm:text-lg text-slate-300 font-sans leading-relaxed text-left">
              From rapid sprint authorization to 24/7 continuous threat hunting across 60,000 distributed infrastructure nodes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {PROGRAMS_LIST.map((program) => (
              <div
                key={program.id}
                className="p-6 sm:p-8 rounded-xl bg-[#070e1b] border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-800 text-xs font-sans">
                    <span className="text-[#22d3ee] font-semibold">{program.cadence}</span>
                    <span className="text-slate-400 text-xs uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono">
                      Tier 1
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-heading font-bold text-white mb-2 text-left tracking-tight">
                    {program.name}
                  </h3>

                  <p className="text-xs text-slate-400 mb-6 text-left font-sans">
                    Target: <span className="text-slate-200 font-medium">{program.target}</span>
                  </p>

                  <div className="space-y-3">
                    {program.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 font-sans">
                        <CheckCircle2 className="w-4 h-4 text-[#22d3ee] shrink-0 mt-0.5" />
                        <span className="text-left leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-slate-800">
                  <a
                    href="#engagement"
                    onClick={onRequestBriefing}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-slate-200 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/40 transition-colors cursor-pointer font-sans"
                  >
                    <span>Inquire Program Spec</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credentials & Standards Section */}
      <section
        id="credentials-grid"
        className="relative py-16 lg:py-20 border-b border-slate-800/80 bg-[#050914]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-sans uppercase font-semibold text-[#22d3ee] tracking-wider mb-1 block">
                Compliance &amp; Authorization Standards
              </span>
              <h3 className="text-2xl sm:text-3xl font-heading font-bold text-white text-left">
                Engineered to pass federal, FinTech, and critical energy audits.
              </h3>
            </div>
            <span className="text-xs font-sans font-medium text-emerald-400 bg-emerald-950/40 px-3.5 py-1.5 rounded-full border border-emerald-500/30">
              100% 3PAO Pass Rate
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {CREDENTIALS_LIST.map((cred) => (
              <div
                key={cred.code}
                className="p-4 rounded-xl bg-[#070e1b] border border-slate-800 hover:border-cyan-500/30 transition-all text-center flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-heading font-bold text-[#22d3ee] mb-1">
                    {cred.code}
                  </div>
                  <div className="text-xs font-sans text-white font-medium mb-1">
                    {cred.name}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[11px] font-sans text-slate-400">
                  {cred.level}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
