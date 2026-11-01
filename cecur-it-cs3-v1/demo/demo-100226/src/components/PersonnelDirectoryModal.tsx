import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Search,
  Shield,
  Briefcase,
  Building,
  Mail,
  Clock,
  UserCheck,
  Filter,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { User, UserRole } from '../types';

interface PersonnelDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PersonnelDirectoryModal: React.FC<PersonnelDirectoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ users: User[] }>('/api/auth/users');
      setUsers(res.users);
    } catch (err) {
      console.error('Failed to load personnel directory:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const roleStyles: Record<UserRole, { badge: string; border: string }> = {
    analyst: { badge: 'bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/30', border: 'hover:border-[#00E5FF]/50' },
    admin: { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', border: 'hover:border-emerald-500/50' },
    auditor: { badge: 'bg-[#00E5FF]/15 text-[#00E5FF] border-[#00E5FF]/40', border: 'hover:border-[#00E5FF]/50' },
    executive: { badge: 'bg-[#0A84FF]/15 text-[#0A84FF] border-[#0A84FF]/30', border: 'hover:border-[#0A84FF]/50' },
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.title && u.title.toLowerCase().includes(search.toLowerCase())) ||
      (u.department && u.department.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        id="personnel-directory-modal"
        className="w-full max-w-3xl bg-[#060B12] border border-[#1A3959] border-t-4 border-t-[#00E5FF] rounded-md shadow-[0_0_40px_rgba(0,229,255,0.12)] overflow-hidden text-[#FFFFFF] flex flex-col max-h-[88vh] font-sans"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C1B2B] border-b border-[#1A3959] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] rounded">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#FFFFFF] font-sans uppercase tracking-wider">
                SOC Personnel & Access Registry
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Verified operators registered in the enterprise security directory
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

        {/* Filter Controls */}
        <div className="px-6 py-3 bg-[#0C1B2B] border-b border-[#1A3959] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by operator name, username, email, title..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] placeholder-[#64748B] font-sans"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#12283E] border border-[#1A3959] rounded text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00E5FF] font-sans"
            >
              <option value="ALL">All Security Roles</option>
              <option value="analyst">Analyst (SecOps)</option>
              <option value="admin">Admin (Infra/Red)</option>
              <option value="auditor">Auditor (GRC)</option>
              <option value="executive">Executive (CISO)</option>
            </select>
          </div>
        </div>

        {/* List of Personnel */}
        <div className="p-6 overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-12 text-center font-sans text-xs text-[#94A3B8]">
              Loading SOC personnel directory...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center font-sans text-xs text-[#94A3B8]">
              No registered operators matched your search filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((op) => (
                <div
                  key={op.id}
                  className="p-4 bg-[#0C1B2B] border border-[#1A3959] border-t-2 border-t-[#00E5FF] rounded-md flex items-start gap-3.5 hover:shadow-md hover:border-[#00E5FF]/60 transition-all"
                >
                  <img
                    src={op.avatar || '/avatars/av-1.svg'}
                    alt={op.displayName}
                    className="w-12 h-12 rounded-full object-cover border border-[#1A3959] shrink-0"
                  />
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-[#FFFFFF] truncate">{op.displayName}</h4>
                      <span
                        className={`px-1.5 py-0.2 text-[10px] font-mono font-bold uppercase rounded border shrink-0 ${
                          roleStyles[op.role]?.badge || ''
                        }`}
                      >
                        {op.role}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#94A3B8] truncate flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-[#64748B] shrink-0" />
                      <span className="truncate">{op.title || 'SOC Operator'}</span>
                    </div>

                    <div className="text-[11px] text-[#64748B] truncate flex items-center gap-1">
                      <Building className="w-3 h-3 text-[#64748B] shrink-0" />
                      <span className="truncate">{op.department || 'Security Operations'}</span>
                    </div>

                    <div className="pt-1.5 flex items-center justify-between text-[10px] font-mono text-[#64748B] border-t border-[#1A3959] mt-1">
                      <span className="truncate">@{op.username}</span>
                      <span>
                        Active: {op.lastLogin ? new Date(op.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Online'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#0C1B2B] border-t border-[#1A3959] flex items-center justify-between text-xs text-[#94A3B8]">
          <div className="font-sans text-[11px]">
            Total Registered Operators: <span className="text-[#FFFFFF] font-extrabold">{users.length}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#12283E] hover:bg-[#1A3959] text-[#FFFFFF] border border-[#1A3959] rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Close Directory
          </button>
        </div>
      </div>
    </div>
  );
};
