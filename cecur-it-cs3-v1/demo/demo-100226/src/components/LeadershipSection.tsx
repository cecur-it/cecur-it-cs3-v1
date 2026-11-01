import React from 'react';
import { ShieldCheck, UserCheck, Award } from 'lucide-react';
import { LEADERSHIP_PROFILES, HATS_METHOD_PILLARS } from '../data/mockSecurityData';
import { LeaderProfile } from '../types';

interface LeadershipSectionProps {
  onExploreMethod?: () => void;
}

export const LeadershipSection: React.FC<LeadershipSectionProps> = ({
  onExploreMethod,
}) => {
  return (
    <section
      id="credentials"
      className="relative py-20 lg:py-28 border-b border-slate-800/80 bg-[#050914]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="max-w-3xl mb-14 lg:mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-[#22d3ee] text-xs font-sans font-medium tracking-wide">
            <span>Pillar IV • Executive Leadership</span>
          </div>

          <h2
            id="leadership-headline"
            className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold text-white tracking-tight leading-[1.18] text-left"
          >
            Built by operators, led by the principal architects.
          </h2>

          <p className="text-base sm:text-lg text-slate-300 font-sans leading-relaxed text-left">
            We don't maintain a bench of junior analysts. When you brief CECUR-IT, you collaborate directly with the operators who design the defenses and author the authorization packages.
          </p>
        </div>

        {/* Two-Person Profile Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 mb-14">
          {LEADERSHIP_PROFILES.map((profile: LeaderProfile, idx: number) => {
            return (
              <div
                key={profile.name}
                id={`leader-profile-${idx}`}
                className="relative rounded-xl bg-[#070e1b] border border-slate-800 hover:border-cyan-500/40 p-6 sm:p-8 transition-all duration-300 shadow-lg flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Designation */}
                  <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800 text-xs">
                    <span className="font-heading font-bold tracking-wide text-[#22d3ee]">
                      {profile.callsign}
                    </span>
                    <span className="text-slate-400 font-sans">
                      {profile.experience}
                    </span>
                  </div>

                  {/* Profile Header */}
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-xl bg-[#050914] border border-cyan-500/30 flex items-center justify-center text-[#22d3ee] font-heading font-bold text-xl shrink-0 shadow-inner">
                      {profile.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>

                    <div>
                      <h3 className="text-2xl font-heading font-bold text-white tracking-tight text-left">
                        {profile.name}
                      </h3>
                      <p className="text-sm font-sans font-medium text-[#22d3ee] mt-0.5 text-left">
                        {profile.role}
                      </p>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed mb-6 text-left">
                    {profile.bio}
                  </p>

                  {/* Core Specialties */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-400">
                      Core Disciplines &amp; Oversight:
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {profile.specialties.map((spec, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-3 py-1 text-xs font-sans bg-slate-900/90 border border-slate-800 rounded-md text-slate-300"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Verification Seal */}
                <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-between text-xs font-sans text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <ShieldCheck className="w-4 h-4" /> Active Operator Verified
                  </span>
                  <span className="text-slate-500">Executive Practice Lead</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Operational Doctrine: Hats Operational Methodology (Red, Blue, White, Yellow, Purple) */}
        <div className="rounded-xl bg-[#070e1b] border border-slate-800 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <span className="text-xs font-sans uppercase font-semibold text-[#22d3ee] tracking-wider mb-1 block">
                Operational Doctrine
              </span>
              <h3 className="text-2xl font-heading font-bold text-white text-left">
                The Five "Hats" Field Methodology
              </h3>
            </div>
            <span className="text-xs font-sans text-slate-400 bg-[#050914] px-3 py-1.5 rounded-full border border-slate-800">
              Red • Blue • White • Yellow • Purple
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-6">
            {HATS_METHOD_PILLARS.map((pillar) => (
              <div
                key={pillar.code}
                className="p-4 rounded-xl bg-[#050914] border border-slate-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-800">
                    <span className={`w-2.5 h-2.5 rounded-full ${pillar.dotColor}`} />
                    <span className="font-heading font-bold text-sm text-white">
                      {pillar.code}
                    </span>
                  </div>
                  <div className="text-xs font-sans text-[#22d3ee] mb-2 font-semibold">
                    {pillar.focus}
                  </div>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed text-left">
                    {pillar.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
