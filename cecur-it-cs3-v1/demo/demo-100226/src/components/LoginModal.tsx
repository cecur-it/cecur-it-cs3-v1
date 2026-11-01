import React, { useState } from 'react';
import {
  X,
  Shield,
  KeyRound,
  UserPlus,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Lock,
  User,
  Mail,
  Briefcase,
  Building,
  Sparkles,
  ShieldAlert,
  Fingerprint,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_PRESETS = [
  { id: 'av-1', label: 'SecOps Tier 1', url: '/avatars/av-1.svg' },
  { id: 'av-2', label: 'Chief Engineer', url: '/avatars/av-2.svg' },
  { id: 'av-3', label: 'GRC Lead', url: '/avatars/av-3.svg' },
  { id: 'av-4', label: 'CISO Executive', url: '/avatars/av-4.svg' },
  { id: 'av-5', label: 'Threat Hunter', url: '/avatars/av-5.svg' },
];

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, register, canPerformAction } = useAuth();
  const canManageUsers = canPerformAction('manage_users');
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('analyst');
  const [regTitle, setRegTitle] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regAvatar, setRegAvatar] = useState(AVATAR_PRESETS[0].url);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginIdentifier, loginPassword);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials and clearance profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (regPassword.length < 6) {
      setError('Password must contain at least 6 characters for compliance with SOC security guidelines.');
      setSubmitting(false);
      return;
    }

    try {
      await register({
        displayName: regDisplayName,
        username: regUsername,
        email: regEmail,
        password: regPassword,
        role: regRole,
        title: regTitle,
        department: regDepartment,
        avatar: regAvatar,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Account registration failed. Please ensure your username and email are unique.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleDescriptions: Record<UserRole, { title: string; desc: string; badgeColor: string; clearance: string }> = {
    analyst: {
      title: 'SOC Defense Analyst',
      clearance: 'Secret / SecOps Tier 2',
      desc: 'Active threat triage, incident playbooks, SIEM cases, sensors telemetry, and Wazuh EDR host investigations.',
      badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30',
    },
    admin: {
      title: 'Security Administrator',
      clearance: 'Top Secret / Full Admin Authority',
      desc: 'Full administrative authority, offensive Errow scans, target allowlist management, and DB reseeding.',
      badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30',
    },
    auditor: {
      title: 'GRC Compliance Auditor',
      clearance: 'Confidential / Audit Read-Only',
      desc: 'Immutable audit logs, ISO/PCI compliance verification, and read-only cross-telemetry inspection.',
      badgeColor: 'border-amber-500/40 text-amber-400 bg-amber-950/30',
    },
    executive: {
      title: 'Executive CISO Leadership',
      clearance: 'Executive Oversight / Strategic Posture',
      desc: 'Strategic MTTD/MTTR metrics, enterprise threat posture index, and compliance framework posture.',
      badgeColor: 'border-purple-500/40 text-purple-400 bg-purple-950/30',
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        id="login-modal-container"
        className="w-full max-w-lg bg-[#060B12] border border-[#1A3959] border-t-4 border-t-[#00E5FF] rounded-md shadow-[0_0_40px_rgba(0,229,255,0.15)] overflow-hidden text-[#FFFFFF] flex flex-col max-h-[92vh] font-sans"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C1B2B] border-b border-[#1A3959] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] rounded">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#FFFFFF] font-sans uppercase tracking-wider">
                CECUR-IT SOC Authentication
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Database-Backed Credential Verification & RBAC Policy Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#FFFFFF] p-1 rounded hover:bg-[#12283E] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector: Sign In vs Create Account */}
        <div className="flex border-b border-[#1A3959] bg-[#0C1B2B]">
          <button
            id="tab-sign-in"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
              tab === 'login'
                ? 'border-[#00E5FF] text-[#FFFFFF] bg-[#060B12] font-bold'
                : 'border-transparent text-[#94A3B8] hover:text-[#FFFFFF]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Sign In to Console</span>
          </button>
          {canManageUsers && (
            <button
              id="tab-create-account"
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
                tab === 'register'
                  ? 'border-[#00E5FF] text-[#FFFFFF] bg-[#060B12] font-bold'
                  : 'border-transparent text-[#94A3B8] hover:text-[#FFFFFF]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Manage Accounts</span>
            </button>
          )}
        </div>

        {/* Form Body Scrollable */}
        <div className="p-6 overflow-y-auto space-y-4 font-sans">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'login' ? (
            /* Sign In Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="p-3.5 bg-[#0C1B2B] border border-[#1A3959] rounded text-xs text-[#94A3B8] space-y-1">
                <div className="font-sans text-[#FFFFFF] font-bold flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5 text-[#00E5FF]" />
                  Secure Operator Access Gateway
                </div>
                <p className="text-[#64748B] leading-relaxed">
                  Enter your registered username or official email with your corresponding password to unlock the CECUR-IT SOC console with server-enforced clearance permissions.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wider font-sans">
                  Username or Registered Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                  <input
                    id="input-login-username"
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. your.username or operator@cecur-it.internal"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#12283E] border border-[#1A3959] rounded text-sm text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] placeholder-[#64748B] font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wider font-sans">
                  Account Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                  <input
                    id="input-login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter account password"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#12283E] border border-[#1A3959] rounded text-sm text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] placeholder-[#64748B] font-sans"
                  />
                </div>
              </div>

              <button
                id="btn-submit-signin"
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#0A84FF] hover:bg-[#0070E0] text-white font-extrabold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
              >
                <KeyRound className="w-4 h-4 text-white" />
                <span>{submitting ? 'Verifying Credentials...' : 'Authenticate & Unlock Console'}</span>
              </button>

              {canManageUsers && (
                <div className="pt-3 border-t border-[#1A3959] text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('register');
                      setError(null);
                    }}
                    className="text-xs text-[#94A3B8] hover:text-[#00E5FF] font-medium transition-colors cursor-pointer"
                  >
                    Manage operator accounts →
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* Real Account Creation / Profile Registration Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-3 bg-[#0C1B2B] border border-[#1A3959] rounded text-xs text-[#94A3B8]">
                <span className="font-bold text-[#FFFFFF]">Administrator Account Management:</span> Create operator accounts with cryptographically hashed credentials and assigned clearance policies.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1 uppercase font-sans">
                    Full Operator Name *
                  </label>
                  <input
                    id="input-reg-displayname"
                    type="text"
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    placeholder="e.g. Samantha Wu"
                    required
                    className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] placeholder-[#64748B] font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1 uppercase font-sans">
                    Unique Username *
                  </label>
                  <input
                    id="input-reg-username"
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. samantha.wu"
                    required
                    className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] placeholder-[#64748B] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1 uppercase font-sans">
                    Official Email *
                  </label>
                  <input
                    id="input-reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. s.wu@cecur-it.internal"
                    required
                    className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] placeholder-[#64748B] font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1 uppercase font-sans">
                    Secure Password *
                  </label>
                  <input
                    id="input-reg-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] placeholder-[#64748B] font-sans"
                  />
                </div>
              </div>

              {/* Role Selection with Clear Breakdown */}
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 uppercase font-sans">
                  Assigned Security Role & Clearance Level *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['analyst', 'admin', 'auditor', 'executive'] as UserRole[]).map((r) => (
                    <div
                      key={r}
                      id={`select-role-${r}`}
                      onClick={() => setRegRole(r)}
                      className={`p-2.5 rounded border cursor-pointer transition-all ${
                        regRole === r
                          ? 'border-[#00E5FF] bg-[#00E5FF]/15 text-[#FFFFFF]'
                          : 'border-[#1A3959] bg-[#0C1B2B] hover:bg-[#12283E] text-[#94A3B8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold capitalize font-sans text-[#FFFFFF]">{r}</span>
                        <span className={`text-[9px] font-mono px-1 py-0.2 rounded border ${roleDescriptions[r].badgeColor}`}>
                          {r.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#64748B] leading-snug">
                        {roleDescriptions[r].desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1 uppercase font-sans">
                    Operational Title
                  </label>
                  <input
                    id="input-reg-title"
                    type="text"
                    value={regTitle}
                    onChange={(e) => setRegTitle(e.target.value)}
                    placeholder="e.g. Senior Threat Hunter"
                    className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] placeholder-[#64748B] font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1 uppercase font-sans">
                    Department
                  </label>
                  <input
                    id="input-reg-department"
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    placeholder="e.g. Threat Intel & SecOps"
                    className="w-full px-3 py-2 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] placeholder-[#64748B] font-sans"
                  />
                </div>
              </div>

              {/* Avatar Preset Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 uppercase font-sans">
                  Operator Avatar Icon
                </label>
                <div className="flex items-center gap-2.5">
                  {AVATAR_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setRegAvatar(p.url)}
                      className={`relative rounded-full p-0.5 border-2 transition-all cursor-pointer ${
                        regAvatar === p.url ? 'border-[#00E5FF] scale-105 ring-2 ring-[#00E5FF]/30' : 'border-[#1A3959] hover:border-[#64748B] opacity-80'
                      }`}
                    >
                      <img src={p.url} alt={p.label} className="w-8 h-8 rounded-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <button
                id="btn-submit-register"
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#0A84FF] hover:bg-[#0070E0] text-white font-extrabold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
              >
                <UserPlus className="w-4 h-4 text-white" />
                <span>{submitting ? 'Creating Profile & Syncing Database...' : 'Create Operator Account'}</span>
              </button>

              <div className="pt-2 border-t border-[#1A3959] text-center">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError(null);
                  }}
                  className="text-xs text-[#94A3B8] hover:text-[#FFFFFF] font-medium transition-colors cursor-pointer"
                >
                  Already have an account? Sign In →
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
