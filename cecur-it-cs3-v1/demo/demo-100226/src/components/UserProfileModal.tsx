import React, { useState } from 'react';
import {
  X,
  Shield,
  User as UserIcon,
  Briefcase,
  Building,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
  Edit2,
  Save,
  LogOut,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Fingerprint,
  Database,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenLogin,
}) => {
  const { user, permissions, updateProfile, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [title, setTitle] = useState(user?.title || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const roleStyles: Record<UserRole, { badge: string; label: string; clearance: string }> = {
    analyst: {
      badge: 'bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/30',
      label: 'SOC Defense Analyst (Tier 2/3)',
      clearance: 'Secret / SecOps Tier 2',
    },
    admin: {
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      label: 'Security Administrator & Engineer',
      clearance: 'Top Secret / Full Admin Authority',
    },
    auditor: {
      badge: 'bg-[#00E5FF]/15 text-[#00E5FF] border-[#00E5FF]/40',
      label: 'GRC Lead & Compliance Auditor',
      clearance: 'Confidential / Audit Read-Only',
    },
    executive: {
      badge: 'bg-[#0A84FF]/15 text-[#0A84FF] border-[#0A84FF]/30',
      label: 'CISO / Executive Leadership',
      clearance: 'Executive Oversight / Strategic KPIs',
    },
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        displayName,
        title,
        department,
        avatar,
      });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        id="user-profile-modal"
        className="w-full max-w-2xl bg-[#060B12] border border-[#1A3959] border-t-4 border-t-[#00E5FF] rounded-md shadow-[0_0_40px_rgba(0,229,255,0.15)] overflow-hidden text-[#FFFFFF] flex flex-col max-h-[90vh] font-sans"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0C1B2B] border-b border-[#1A3959] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] rounded">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#FFFFFF] font-sans uppercase tracking-wider">
                Operator Security Profile & Credentials
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Database-Synchronized RBAC Identity Record
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-[#FFFFFF] rounded hover:bg-[#12283E] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6">
          {saveSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Profile details updated and synchronized with database!</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Profile Identity Card */}
          <div className="p-5 bg-[#0C1B2B] border border-[#1A3959] rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={user.avatar || '/avatars/av-1.svg'}
                alt={user.displayName}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#00E5FF]"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-[#FFFFFF]">{user.displayName}</h3>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-mono font-bold uppercase rounded border ${
                      roleStyles[user.role].badge
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <div className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>{user.title || 'SOC Operator'}</span>
                </div>
                <div className="text-xs text-[#64748B] flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-[#475569]" />
                  <span>{user.department || 'Security Operations'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
              <button
                id="btn-toggle-edit-profile"
                onClick={() => {
                  setIsEditing(!isEditing);
                  setDisplayName(user.displayName);
                  setTitle(user.title || '');
                  setDepartment(user.department || '');
                  setAvatar(user.avatar || '');
                }}
                className="px-3.5 py-1.5 bg-[#12283E] hover:bg-[#1A3959] text-[#FFFFFF] border border-[#1A3959] rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
              </button>
              <div className="text-[11px] font-sans text-[#94A3B8] bg-[#12283E] px-2.5 py-1 rounded border border-[#1A3959]">
                Clearance: {roleStyles[user.role].clearance}
              </div>
            </div>
          </div>

          {/* Edit Form */}
          {isEditing && (
            <form onSubmit={handleSave} className="p-4 bg-[#0C1B2B] border border-[#1A3959] rounded space-y-4">
              <h4 className="text-xs font-sans font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-2">
                <Edit2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                Update Profile Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                    Full Name / Call Sign
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                    Operational Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                    Assigned Department
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                    Avatar Image URL
                  </label>
                  <input
                    type="text"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#FFFFFF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-[#0A84FF] hover:bg-[#0070E0] text-white font-extrabold rounded text-xs flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                >
                  <Save className="w-3.5 h-3.5 text-white" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Account Meta & Security Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-[#0C1B2B] border border-[#1A3959] rounded space-y-2.5">
              <div className="text-xs font-sans font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-[#00E5FF]" />
                Account Credentials & Metadata
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1A3959]">
                  <span className="text-[#64748B]">Username</span>
                  <span className="font-mono text-[#FFFFFF] font-bold">{user.username}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1A3959]">
                  <span className="text-[#64748B]">Registered Email</span>
                  <span className="font-mono text-[#FFFFFF]">{user.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1A3959]">
                  <span className="text-[#64748B]">Operator ID</span>
                  <span className="font-mono text-[#94A3B8] text-[11px]">{user.id}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#64748B]">Account Created</span>
                  <span className="font-mono text-[#94A3B8] text-[11px]">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Baseline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#0C1B2B] border border-[#1A3959] rounded space-y-2.5">
              <div className="text-xs font-sans font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Security Enforcement & Session
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1A3959]">
                  <span className="text-[#64748B]">Auth Mechanism</span>
                  <span className="font-mono text-emerald-400 font-semibold">JWT + Bcrypt (Cost 10)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1A3959]">
                  <span className="text-[#64748B]">Database Sync</span>
                  <span className="font-mono text-[#FFFFFF] flex items-center gap-1">
                    <Database className="w-3 h-3 text-[#00E5FF]" /> Database Persistent
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1A3959]">
                  <span className="text-[#64748B]">Role Switching</span>
                  <span className="font-mono text-rose-400 font-bold">LOCKED (Strict RBAC)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#64748B]">Session Status</span>
                  <span className="font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active & Verified
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Granular RBAC Permissions Matrix */}
          <div className="p-4 bg-[#0C1B2B] border border-[#1A3959] rounded space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-sans font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[#00E5FF]" />
                Operational Clearances for [{user.role.toUpperCase()}]
              </div>
              <span className="text-[10px] text-[#64748B] font-mono">
                {permissions?.allowedPanels.length || 0} Panels Authorized
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { id: 'overview', name: 'Overview' },
                { id: 'incidents', name: 'SIEM Incidents' },
                { id: 'fusion', name: 'Asset Fusion' },
                { id: 'sensors', name: 'CS3 Sensors' },
                { id: 'wazuh', name: 'Wazuh EDR' },
                { id: 'activtrak', name: 'Insider Risk' },
                { id: 'hexstrike', name: 'HexStrike AI' },
                { id: 'audit', name: 'Audit Trail' },
                { id: 'executive', name: 'Executive KPIs' },
              ].map((p) => {
                const allowed = permissions?.allowedPanels.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`p-2 rounded border flex items-center justify-between ${
                      allowed
                        ? 'bg-[#00E5FF]/10 border-[#00E5FF]/40 text-[#00E5FF] font-semibold'
                        : 'bg-rose-950/40 border-rose-900 text-rose-400 opacity-70'
                    }`}
                  >
                    <span className="font-mono text-[11px]">{p.name}</span>
                    {allowed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#0C1B2B] border-t border-[#1A3959] flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onOpenLogin();
            }}
            className="px-3.5 py-2 bg-[#12283E] hover:bg-[#1A3959] text-[#FFFFFF] border border-[#1A3959] rounded text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-[#00E5FF]" />
            <span>Switch Account / Sign In</span>
          </button>

          <button
            id="btn-profile-logout"
            onClick={() => {
              logout();
              onClose();
              onOpenLogin();
            }}
            className="px-4 py-2 bg-rose-900 hover:bg-rose-800 text-white border border-rose-700 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Secure Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
