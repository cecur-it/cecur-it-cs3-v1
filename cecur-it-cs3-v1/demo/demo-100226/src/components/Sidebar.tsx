import React from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Terminal,
  UserX,
  Radio,
  Network,
  Crosshair,
  FileCheck2,
  PieChart,
  Coins,
  Settings,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface NavItem {
  id: string;
  name: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
  description: string;
}

interface SidebarProps {
  activePanel: string;
  onSelectPanel: (id: string) => void;
  unacknowledgedAlertsCount?: number;
  criticalIncidentsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePanel,
  onSelectPanel,
  unacknowledgedAlertsCount = 0,
  criticalIncidentsCount = 0,
}) => {
  const { canAccessPanel, user } = useAuth();

  const navItems: NavItem[] = [
    {
      id: 'overview',
      name: 'Command Center',
      icon: LayoutDashboard,
      description: 'Unified threat overview & gauges',
    },
    {
      id: 'incidents',
      name: 'Incident Queue',
      icon: ShieldAlert,
      badge: criticalIncidentsCount > 0 ? `${criticalIncidentsCount} CRIT` : undefined,
      badgeColor: 'bg-[#0A84FF]/20 text-[#0A84FF] border-[#0A84FF]/50',
      description: 'Correlated SIEM/SOAR cases',
    },
    {
      id: 'cecur',
      name: 'Cecur SIEM & XDR',
      icon: Terminal,
      badge: unacknowledgedAlertsCount > 0 ? `${unacknowledgedAlertsCount}` : 'ACTIVE',
      badgeColor: 'bg-[#12283E] text-[#00E5FF] border-[#00E5FF]/40',
      description: 'Threat detection, logs, FIM & compliance',
    },
    {
      id: 'activtrak',
      name: 'ActivTrak Risk',
      icon: UserX,
      description: 'Insider threat & employee telemetry',
    },
    {
      id: 'sensors',
      name: 'CS3 Sensor Grid',
      icon: Radio,
      description: 'Network probe nodes & drift',
    },
    {
      id: 'fusion',
      name: 'Asset Fusion Graph',
      icon: Network,
      description: '3D topology & blast radius',
    },
    {
      id: 'errow',
      name: 'errow Recon',
      icon: Crosshair,
      badge: 'ADMIN',
      badgeColor: 'bg-[#0A84FF]/20 text-[#0A84FF] border-[#0A84FF]/40',
      description: 'Allowlist-gated safe recon sweeps',
    },
    {
      id: 'audit',
      name: 'Audit & Compliance',
      icon: FileCheck2,
      description: 'Tamper-evident operational logs',
    },
    {
      id: 'executive',
      name: 'Executive KPIs',
      icon: PieChart,
      description: 'CISO posture & MTTD/MTTR',
    },
  ];

  return (
    <aside
      id="soc-sidebar"
      className="w-64 bg-[#0B1B32] border-r border-[#1A3959] flex flex-col shrink-0 overflow-y-auto font-sans"
    >
      <div className="p-3.5 border-b border-[#1A3959] bg-[#0C1B2B]">
        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#00E5FF] flex items-center justify-between">
          <span>SOC Navigation Matrix</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isAllowed = canAccessPanel(item.id);
          const isActive = activePanel === item.id;

          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => onSelectPanel(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-xs font-medium transition-all group cursor-pointer ${
                isActive
                  ? 'bg-[#0A84FF]/20 text-[#00E5FF] border-l-2 border-[#0A84FF] font-bold shadow-xs'
                  : isAllowed
                  ? 'text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-[#12283E] border-l-2 border-transparent'
                  : 'text-[#627D98] hover:text-[#94A3B8] hover:bg-[#12283E] border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive
                      ? 'text-[#00E5FF]'
                      : isAllowed
                      ? 'text-[#94A3B8] group-hover:text-[#FFFFFF]'
                      : 'text-[#627D98]'
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.badge && isAllowed && (
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      isActive
                        ? 'bg-[#0A84FF] text-[#FFFFFF] border-[#00E5FF]'
                        : item.badgeColor || 'bg-[#12283E] text-[#94A3B8] border-[#1A3959]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {!isAllowed && (
                  <span title="Restricted by server-side RBAC policy">
                    <Lock className="w-3.5 h-3.5 text-[#627D98] group-hover:text-[#0A84FF]" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      <div className="p-3.5 border-t border-[#1A3959] bg-[#0C1B2B] text-[11px] text-[#94A3B8] font-sans">
        <div className="flex justify-between items-center text-[#FFFFFF] mb-1">
          <span>Active Persona</span>
          <span className="text-[#00E5FF] font-mono font-bold uppercase">{user?.role}</span>
        </div>
        <div className="text-[10px] font-mono text-[#627D98] truncate">
          Server enforces RBAC on each route
        </div>
      </div>
    </aside>
  );
};
