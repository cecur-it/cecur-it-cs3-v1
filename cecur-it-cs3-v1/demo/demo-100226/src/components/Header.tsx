import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Activity,
  UserCheck,
  RefreshCw,
  LogIn,
  ChevronDown,
  Database,
  Lock,
  Cpu,
  Wifi,
  Sparkles,
  Users,
  Fingerprint,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { apiRequest } from '../lib/api';

interface HeaderProps {
  onOpenLogin: () => void;
  onOpenProfile: () => void;
  onOpenDirectory: () => void;
  liveStatus: 'connected' | 'reconnecting' | 'offline';
  epsRate: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenLogin,
  onOpenProfile,
  onOpenDirectory,
  liveStatus,
  epsRate,
}) => {
  const { user, permissions, logout, canPerformAction } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [reseeding, setReseeding] = useState(false);
  const [reseedMsg, setReseedMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleColors: Record<UserRole, string> = {
    analyst: 'bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/30',
    admin: 'bg-[#0A84FF]/10 text-[#0A84FF] border-[#0A84FF]/30',
    auditor: 'bg-[#BAE3FF]/15 text-[#BAE3FF] border-[#4A90E2]/30',
    executive: 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/40',
  };

  const handleReseed = async () => {
    if (!canPerformAction('reseed_db')) {
      alert('Reseed action is restricted to Admin role.');
      return;
    }
    setReseeding(true);
    setReseedMsg(null);
    try {
      await apiRequest('/api/system/reseed', { method: 'POST' });
      setReseedMsg('Database reseeded to baseline!');
      setTimeout(() => {
        setReseedMsg(null);
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Reseed failed');
    } finally {
      setReseeding(false);
    }
  };

  return (
    <header
      id="soc-header"
      className="bg-[#0C1B2B] border-b border-[#1A3959] sticky top-0 z-30 px-4 lg:px-6 py-3 flex items-center justify-between gap-4 shadow-md"
    >
      {/* Brand & SOC Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#00E5FF] flex items-center justify-center text-[#060B12] font-extrabold shadow-[0_0_12px_rgba(0,229,255,0.4)]">
            <Shield className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold tracking-tight text-[#FFFFFF] text-base">
                CECUR<span className="text-[#00E5FF]">-IT</span>
              </span>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 bg-[#12283E] text-[#00E5FF] rounded border border-[#00E5FF]/40">
                CS3
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8] hidden sm:block">Mormar Technology, Inc.</p>
          </div>
        </div>

        {/* Live SSE Status Badge */}
        <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[#1A3959] text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#12283E] border border-[#1A3959] rounded-full">
            <span
              className={`w-2 h-2 rounded-full ${
                liveStatus === 'connected'
                  ? 'bg-[#00FF66] animate-pulse'
                  : liveStatus === 'reconnecting'
                  ? 'bg-[#FFB300]'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-[11px] font-mono text-[#94A3B8] uppercase tracking-wide">
              {liveStatus === 'connected' ? 'LIVE TELEMETRY ACTIVE' : liveStatus}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-[#00E5FF] px-2.5 py-0.5 bg-[#00E5FF]/10 border border-[#00E5FF]/30 rounded-full font-semibold">
            <Activity className="w-3 h-3 animate-pulse text-[#00E5FF]" />
            <span>{epsRate.toLocaleString()} EPS</span>
          </div>
        </div>
      </div>

      {/* Action Controls & Operator Account Menu */}
      <div className="flex items-center gap-2.5">
        <a
          id="header-btn-briefing"
          href="mailto:contact@cecur-it.io?subject=Briefing%20Request"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 rounded text-xs font-semibold uppercase tracking-wider transition-all"
        >
          <span>Request Briefing</span>
        </a>

        {/* Reseed DB button (Admin only) */}
        {user?.role === 'admin' && (
          <button
            id="btn-reseed-db"
            onClick={handleReseed}
            disabled={reseeding}
            title="Reset & reseed in-memory database to pristine baseline"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-[#12283E] hover:bg-[#1A3959] text-[#FFFFFF] border border-[#1A3959] rounded transition-colors cursor-pointer"
          >
            <Database className={`w-3.5 h-3.5 ${reseeding ? 'animate-spin text-[#00E5FF]' : 'text-[#00E5FF]'}`} />
            <span>{reseeding ? 'Reseeding...' : reseedMsg || 'Reseed DB'}</span>
          </button>
        )}

        {/* Personnel Directory Shortcut */}
        <button
          id="btn-open-directory"
          onClick={onOpenDirectory}
          title="View registered SOC personnel roster"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[#12283E] hover:bg-[#1A3959] text-[#FFFFFF] border border-[#1A3959] rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
        >
          <Users className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span>Personnel</span>
        </button>

        {/* Authenticated Profile Menu */}
        <div className="relative" ref={menuRef}>
          <button
            id="btn-user-profile-menu-toggle"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 bg-[#0C1B2B] hover:bg-[#12283E] border border-[#1A3959] rounded transition-colors text-left shadow-xs cursor-pointer"
          >
            <img
              src={user?.avatar || '/avatars/av-1.svg'}
              alt={user?.displayName}
              className="w-6 h-6 rounded-full object-cover border border-[#00E5FF]/40"
            />
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-[#FFFFFF] leading-tight">
                {user?.displayName.split(' ')[0] || 'Operator'}
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`text-[10px] font-sans font-bold uppercase px-1 py-0.2 rounded border ${
                    user ? roleColors[user.role] : 'text-[#64748B] border-[#1A3959]'
                  }`}
                >
                  {user?.role || 'Guest'}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
          </button>

          {dropdownOpen && (
            <div
              id="user-profile-dropdown"
              className="absolute right-0 mt-2 w-64 bg-[#0C1B2B] border border-[#1A3959] rounded-md shadow-[0_0_25px_rgba(0,229,255,0.15)] p-2 z-50 text-[#FFFFFF]"
            >
              <div className="px-3 py-2 border-b border-[#1A3959] mb-1 bg-[#12283E] rounded-t">
                <div className="text-xs font-bold text-[#FFFFFF] truncate">{user?.displayName}</div>
                <div className="text-[11px] font-mono text-[#00E5FF] truncate">{user?.email}</div>
                <div className="text-[10px] text-[#94A3B8] mt-0.5">
                  Clearance: <span className="font-sans uppercase font-bold text-[#FFFFFF]">{user?.role}</span>
                </div>
              </div>

              <div className="space-y-1">
                <button
                  id="btn-menu-open-profile"
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium hover:bg-[#12283E] text-[#FFFFFF] transition-colors text-left cursor-pointer"
                >
                  <Fingerprint className="w-4 h-4 text-[#00E5FF] shrink-0" />
                  <span>My Security Profile & Clearance</span>
                </button>

                <button
                  id="btn-menu-open-directory"
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenDirectory();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium hover:bg-[#12283E] text-[#FFFFFF] transition-colors text-left cursor-pointer"
                >
                  <Users className="w-4 h-4 text-[#00E5FF] shrink-0" />
                  <span>SOC Personnel Directory</span>
                </button>
              </div>

              <div className="pt-2 mt-1 border-t border-[#1A3959] space-y-1">
                <button
                  id="btn-menu-switch-account"
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenLogin();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium hover:bg-[#12283E] text-[#00E5FF] transition-colors text-left cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>Switch Account / Sign In</span>
                </button>

                <button
                  id="btn-menu-logout"
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                    onOpenLogin();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[2px] text-xs font-medium hover:bg-rose-950/40 text-rose-400 transition-colors text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Secure Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
