import React from 'react';
import { ShieldAlert, Lock, AlertTriangle, ArrowRight, KeyRound, Fingerprint } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ForbiddenCardProps {
  panelName: string;
  onOpenLogin?: () => void;
  onOpenProfile?: () => void;
  onNavigateToAllowed?: () => void;
}

export const ForbiddenCard: React.FC<ForbiddenCardProps> = ({
  panelName,
  onOpenLogin,
  onOpenProfile,
  onNavigateToAllowed,
}) => {
  const { user } = useAuth();

  const roleLabels: Record<UserRole, string> = {
    analyst: 'Security Analyst (Tier 2/3)',
    admin: 'Security Administrator & Engineer',
    auditor: 'Compliance & Audit Officer',
    executive: 'Executive / CISO Leadership',
  };

  return (
    <div
      id="forbidden-gate-card"
      className="p-8 max-w-3xl mx-auto my-12 bg-[#0C1B2B] border border-[#1A3959] border-t-4 border-t-rose-500 rounded-md shadow-2xl text-[#FFFFFF] font-sans"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-rose-950/60 text-rose-400 rounded-md border border-rose-800/80">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800 rounded">
              HTTP 403 FORBIDDEN
            </span>
            <span className="text-xs font-sans font-semibold text-[#64748B]">ENTERPRISE-ENFORCED RBAC SECURITY POLICY</span>
          </div>
          <h2 className="text-xl font-extrabold text-[#FFFFFF] tracking-tight font-display">
            Access Denied: Clearance Level Insufficient
          </h2>
          <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">
            Your authenticated operator profile <strong className="text-[#FFFFFF]">[{user?.username}]</strong> with clearance role{' '}
            <strong className="text-[#00E5FF]">[{user?.role.toUpperCase()}]</strong> (
            {user ? roleLabels[user.role] : 'Unknown'}) is restricted from accessing the{' '}
            <strong className="text-[#FFFFFF] uppercase font-sans font-bold">{panelName}</strong> module.
          </p>

          <div className="mt-4 p-3 bg-[#060B12] rounded border border-[#1A3959] text-xs font-mono text-[#94A3B8]">
            <div className="text-rose-400 flex items-center gap-1.5 font-semibold mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Security Audit Event Logged:
            </div>
            <div>Action: ACCESS_PANEL_DENIED | Target: /api/{panelName}</div>
            <div>Actor: {user?.username} ({user?.role}) | Policy Engine: server/rbac.ts & Security Rules</div>
            <div>Audit Status: DENY_403 (Logged in Immutable Audit Trail)</div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#1A3959] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {onOpenLogin && (
                <button
                  id="btn-switch-account-forbidden"
                  onClick={onOpenLogin}
                  className="px-4 py-2 text-xs font-extrabold bg-[#0A84FF] hover:bg-[#0070E0] text-white rounded transition-colors flex items-center gap-1.5 shadow-md uppercase tracking-wider cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-white" />
                  <span>Authenticate with Authorized Account</span>
                </button>
              )}

              {onOpenProfile && (
                <button
                  id="btn-inspect-clearance-forbidden"
                  onClick={onOpenProfile}
                  className="px-3.5 py-2 text-xs font-semibold bg-[#12283E] hover:bg-[#1A3959] text-[#FFFFFF] border border-[#1A3959] rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Fingerprint className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Inspect Clearance Permissions</span>
                </button>
              )}
            </div>

            {onNavigateToAllowed && (
              <button
                id="btn-return-overview"
                onClick={onNavigateToAllowed}
                className="px-3.5 py-2 text-xs font-semibold bg-[#12283E] hover:bg-[#1A3959] text-[#94A3B8] hover:text-[#FFFFFF] border border-[#1A3959] rounded transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Return to Overview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
