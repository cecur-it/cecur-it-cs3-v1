import React, { useState } from 'react';
import { Mail, Phone, MapPin, Shield, CheckCircle2, FileText, Lock, Award, Terminal } from 'lucide-react';
import { LegalComplianceModal, LegalTabType } from './LegalComplianceModal';

export const Footer: React.FC = () => {
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTabType>('privacy');

  const openLegalModal = (tab: LegalTabType) => {
    setLegalTab(tab);
    setLegalModalOpen(true);
  };

  const contactEmails = [
    { label: 'General Enquiries', email: 'contact@cecur-it.io' },
    { label: 'Sales & Licensing', email: 'sales@cecur-it.io' },
    { label: 'Partner Network', email: 'partners@cecur-it.io' },
    { label: 'Security Operations', email: 'security@cecur-it.io' },
    { label: 'GRC & Compliance', email: 'compliance@cecur-it.io' },
  ];

  return (
    <>
      <footer id="soc-footer" className="bg-[#060B12] text-[#FFFFFF] py-14 px-6 border-t border-[#1A3959] font-sans">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 mb-10">
          {/* Practice Identity */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-[#00E5FF] text-[#060B12] flex items-center justify-center font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)]">
                <Shield className="w-5 h-5 text-[#060B12]" />
              </div>
              <span className="font-display font-extrabold text-lg text-[#FFFFFF] tracking-tight">
                CECUR<span className="text-[#00E5FF]">-IT</span> Inc.
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#12283E] text-[#00E5FF] border border-[#00E5FF]/40 uppercase tracking-widest">
                FEDERAL SOC
              </span>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed max-w-md">
              Copyright © 2026 CECUR-IT, Inc. — All Rights Reserved.
              <br />
              Independent cyber security &amp; IT architecture practice serving federal, DoD, and commercial critical infrastructure clients since 2002.
            </p>
            <div className="flex items-center gap-3 text-xs text-[#94A3B8] font-mono">
              <button
                id="footer-badge-nist"
                onClick={() => openLegalModal('security')}
                className="flex items-center gap-1.5 text-[#00FF66] hover:underline cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> NIST SP 800-53 REV 5
              </button>
              <span>•</span>
              <button
                id="footer-badge-soc2"
                onClick={() => openLegalModal('security')}
                className="flex items-center gap-1.5 text-[#00E5FF] hover:underline cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> SOC 2 TYPE II
              </button>
            </div>
          </div>

          {/* Contact Information */}
          <div className="md:col-span-4 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#00E5FF] flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-[#00E5FF]" />
              <span>Contact Desks &amp; Routing</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              {contactEmails.map((item, idx) => (
                <div key={idx} className="p-2 rounded bg-[#0C1B2B] border border-[#1A3959] space-y-0.5 hover:border-[#00E5FF]/50 transition-colors shadow-xs">
                  <div className="text-[10px] text-[#64748B] uppercase font-sans font-bold">{item.label}</div>
                  <a
                    href={`mailto:${item.email}`}
                    className="text-[#FFFFFF] hover:text-[#00E5FF] transition-colors truncate block"
                  >
                    {item.email}
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Practice Focus & HQ */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#FFB300] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#FFB300]" />
              <span>Sector Operations HQ</span>
            </div>
            <ul className="space-y-2 text-xs text-[#94A3B8]">
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#FFB300] shrink-0" />
                <span className="font-mono text-[#FFFFFF]">+1 (562) 681-3383</span>
              </li>
              <li className="text-[#94A3B8] font-sans">
                Washington, D.C. / Federal Sector Clearing
              </li>
              <li className="pt-2 border-t border-[#1A3959]">
                <button
                  id="footer-link-scada-defense"
                  onClick={() => openLegalModal('terms')}
                  className="text-[#00E5FF] hover:underline cursor-pointer text-left block"
                >
                  Critical Infrastructure SCADA Defense (Terms Art. 4)
                </button>
              </li>
              <li>
                <button
                  id="footer-link-zerotrust-arch"
                  onClick={() => openLegalModal('privacy')}
                  className="text-[#00E5FF] hover:underline cursor-pointer text-left block"
                >
                  Zero-Trust Data Sovereignty (NIST SP 800-207)
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-[1240px] mx-auto pt-6 border-t border-[#1A3959] flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] font-mono gap-3">
          <div>
            CECUR-IT CS3 Console &bull; Security Operations &amp; Incident Containment
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-sans font-medium">
            <button
              id="footer-link-privacy-policy"
              onClick={() => openLegalModal('privacy')}
              className="text-[#94A3B8] hover:text-[#00E5FF] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Lock className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Privacy Policy</span>
            </button>
            <span className="text-[#1A3959]">•</span>
            <button
              id="footer-link-terms-of-service"
              onClick={() => openLegalModal('terms')}
              className="text-[#94A3B8] hover:text-[#00E5FF] transition-colors cursor-pointer flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Terms of Service</span>
            </button>
            <span className="text-[#1A3959]">•</span>
            <button
              id="footer-link-rules-of-engagement"
              onClick={() => openLegalModal('roe')}
              className="text-[#94A3B8] hover:text-[#00E5FF] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Terminal className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Rules of Engagement (ROE)</span>
            </button>
            <span className="text-[#1A3959]">•</span>
            <button
              id="footer-link-security-portal"
              onClick={() => openLegalModal('security')}
              className="text-[#94A3B8] hover:text-[#00E5FF] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Award className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Security Portal</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Interactive Comprehensive Legal & Compliance Modal */}
      <LegalComplianceModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalTab}
      />
    </>
  );
};


