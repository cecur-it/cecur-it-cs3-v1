import React from 'react';
import { X, CheckCircle2, Shield, Lock, FileText, AlertTriangle, Terminal, Award, Copy, Check } from 'lucide-react';
import { HATS_METHOD_PILLARS } from '../data/mockSecurityData';
import { PRIVACY_POLICY, TERMS_OF_SERVICE, RULES_OF_ENGAGEMENT, SECURITY_PORTAL_DATA } from '../data/legalLiterature';
import { LegalComplianceModal, LegalTabType } from './LegalComplianceModal';

export { LegalComplianceModal };
export type { LegalTabType };

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badge?: string;
  children: React.ReactNode;
}

export const BaseModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  badge,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-sans">
      <div
        className="relative w-full max-w-3xl bg-[#060B12] border border-[#1A3959] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#FFFFFF]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0C1B2B] border-b border-[#1A3959]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.6)]" />
            <h3 className="font-display font-bold text-[#FFFFFF] text-base tracking-tight">
              {title}
            </h3>
            {badge && (
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-[#12283E] border border-[#00E5FF]/40 text-[#00E5FF] font-medium uppercase tracking-wider">
                {badge}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#12283E] hover:bg-[#1A3959] text-[#94A3B8] hover:text-[#FFFFFF] transition-colors cursor-pointer border border-[#1A3959]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto text-sm text-[#94A3B8] font-sans leading-relaxed space-y-4">
          {children}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#0C1B2B] border-t border-[#1A3959] flex items-center justify-between text-xs text-[#94A3B8] font-mono">
          <span>CECUR-IT CS3 Platform Governance</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#00E5FF] text-[#060B12] font-bold rounded hover:bg-[#33EBFF] transition-colors cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.3)]"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const FedrampModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => (
  <LegalComplianceModal isOpen={isOpen} onClose={onClose} initialTab="security" />
);

export const PrivacyModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => (
  <LegalComplianceModal isOpen={isOpen} onClose={onClose} initialTab="privacy" />
);

export const TermsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => (
  <LegalComplianceModal isOpen={isOpen} onClose={onClose} initialTab="terms" />
);

export const RulesOfEngagementModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => (
  <LegalComplianceModal isOpen={isOpen} onClose={onClose} initialTab="roe" />
);

export const MethodModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => (
  <BaseModal isOpen={isOpen} onClose={onClose} title="The CECUR-IT 'Hats' Operational Doctrine" badge="5-Pillar Defense">
    <div className="space-y-4 font-sans text-xs text-[#94A3B8]">
      <p className="text-left text-sm text-[#FFFFFF]">
        Built by principal operators with 35+ years in critical infrastructure defense, the Hats Method combines five synchronized tactical disciplines:
      </p>

      <div className="space-y-3">
        {HATS_METHOD_PILLARS.map((pillar) => (
          <div key={pillar.code} className="p-3.5 rounded-lg bg-[#0C1B2B] border border-[#1A3959] space-y-1">
            <div className="font-display font-bold text-[#00E5FF] text-xs">
              {pillar.code}: {pillar.name}
            </div>
            <p className="text-xs text-[#94A3B8] font-sans text-left leading-relaxed">
              {pillar.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  </BaseModal>
);

