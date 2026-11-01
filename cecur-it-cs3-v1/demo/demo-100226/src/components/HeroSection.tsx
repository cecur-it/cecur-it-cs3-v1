import React from 'react';
import { ArrowUpRight, ShieldCheck, Lock, Clock, Cpu, Server, Zap } from 'lucide-react';
import { LivePosturePanel } from './LivePosturePanel';

interface HeroSectionProps {
  onRequestBriefing: () => void;
  onExploreMethod: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onRequestBriefing,
  onExploreMethod,
}) => {
  return (
    <section
      id="hero"
      className="relative pt-32 pb-16 lg:pt-40 lg:pb-24 overflow-hidden border-b border-slate-800/80 bg-[#050914]"
    >
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-600/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Hero Text */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Clean Breadcrumb Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-[#22d3ee] text-xs font-sans font-medium tracking-wide">
              <span className="w-2 h-2 rounded-full bg-[#22d3ee] animate-pulse" />
              <span>Federal • DoD • Critical Infrastructure • FinTech</span>
            </div>

            {/* Headline */}
            <h1
              id="hero-headline"
              className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl tracking-tight text-white leading-[1.18] text-left"
            >
              Thirty-five years of stopping breaches before they reach the field.
            </h1>

            {/* Sub-headline */}
            <p
              id="hero-subheadline"
              className="text-base sm:text-lg text-slate-300 font-sans leading-relaxed text-left max-w-xl"
            >
              CECUR-IT is an independent cyber security and IT architecture practice built by senior operators. We design, hunt, and defend inside high-consequence environments where downtime is a substation, a runway, a financial ledger, or national defense.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <a
                id="hero-cta-briefing"
                href="#engagement"
                onClick={onRequestBriefing}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold uppercase tracking-wider text-slate-950 bg-[#22d3ee] hover:bg-[#67e8f9] transition-all shadow-[0_0_25px_rgba(34,211,238,0.35)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] active:scale-95 cursor-pointer font-sans"
              >
                <span>Request a Briefing</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>

              <a
                id="hero-cta-method"
                href="#hats-method"
                onClick={onExploreMethod}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-medium tracking-wide text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition-all active:scale-95 cursor-pointer font-sans"
              >
                <span>Explore the HATS Method</span>
              </a>
            </div>

            {/* Operator Guarantee Indicators */}
            <div className="pt-3 flex flex-wrap items-center gap-5 text-xs text-slate-400 font-sans">
              <span className="flex items-center gap-1.5 text-slate-300">
                <ShieldCheck className="w-4 h-4 text-[#22d3ee]" /> Principal Architect Led
              </span>
              <span className="text-slate-700">•</span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <Lock className="w-4 h-4 text-emerald-400" /> Zero Junior-Bench Hand-off
              </span>
            </div>

          </div>

          {/* Right Column: Live Posture Terminal Element */}
          <div className="lg:col-span-6">
            <LivePosturePanel />
          </div>

        </div>

        {/* Stats Bar */}
        <div
          id="hero-stats-bar"
          className="mt-14 sm:mt-16 pt-8 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6"
        >
          {/* Stat 1 */}
          <div className="bg-[#070e1b] p-5 rounded-xl border border-slate-800/80 hover:border-cyan-500/40 transition-all">
            <div className="flex items-center gap-2 text-[#22d3ee] mb-2 font-sans">
              <Clock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Experience</span>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-heading font-extrabold text-white tracking-tight">
              35+
            </div>
            <div className="text-xs text-slate-400 mt-1 font-sans">
              Years Active in Field Practice
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-[#070e1b] p-5 rounded-xl border border-slate-800/80 hover:border-cyan-500/40 transition-all">
            <div className="flex items-center gap-2 text-[#22d3ee] mb-2 font-sans">
              <Cpu className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Scale</span>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-heading font-extrabold text-white tracking-tight">
              60,000+
            </div>
            <div className="text-xs text-slate-400 mt-1 font-sans">
              Nodes Under Single ESOC
            </div>
          </div>

          {/* Stat 3 */}
          <div className="bg-[#070e1b] p-5 rounded-xl border border-slate-800/80 hover:border-emerald-500/40 transition-all">
            <div className="flex items-center gap-2 text-emerald-400 mb-2 font-sans">
              <Server className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Reliability</span>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-heading font-extrabold text-white tracking-tight">
              43,000,000
            </div>
            <div className="text-xs text-emerald-400/90 mt-1 font-sans">
              Hours Uncompromised Uptime
            </div>
          </div>

          {/* Stat 4 */}
          <div className="bg-[#070e1b] p-5 rounded-xl border border-purple-500/30 hover:border-purple-400/60 transition-all relative overflow-hidden">
            <div className="flex items-center gap-2 text-[#a78bfa] mb-2 font-sans">
              <Zap className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Sentinel</span>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-heading font-extrabold text-purple-200 tracking-tight">
              24/7/365
            </div>
            <div className="text-xs text-[#a78bfa] mt-1 font-sans">
              FinTech &amp; Blockchain Defense
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
