import React, { useState } from 'react';
import {
  Server,
  Database,
  Shield,
  Laptop,
  Cloud,
  Layers,
  AlertTriangle,
  Lock,
  Zap,
  Activity,
  Cpu,
  HardDrive,
  FileCode,
  Terminal,
  X,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Flame,
  Radio,
  Search,
  Check,
  RefreshCw,
  Sliders,
  Play,
  RotateCcw,
} from 'lucide-react';
import { FusionGraphNode, FusionGraphLink } from '../../../types';

interface NodeDetailsDrawerProps {
  node: FusionGraphNode | null;
  onClose: () => void;
  onIsolateNode?: (nodeId: string) => void;
  isIsolated?: boolean;
  connectedLinks?: FusionGraphLink[];
  onSeverLink?: (linkId: string) => void;
  onSelectConnectedNode?: (nodeId: string) => void;
}

export const NodeDetailsDrawer: React.FC<NodeDetailsDrawerProps> = ({
  node,
  onClose,
  onIsolateNode,
  isIsolated,
  connectedLinks = [],
  onSeverLink,
  onSelectConnectedNode,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'VULNERABILITIES' | 'SERVICES' | 'TELEMETRY'>('OVERVIEW');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [cveSearch, setCveSearch] = useState('');
  const [patchedCves, setPatchedCves] = useState<string[]>([]);
  const [isPatching, setIsPatching] = useState<string | null>(null);
  const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false);

  if (!node) return null;

  const handleQuarantine = () => {
    if (onIsolateNode) {
      onIsolateNode(node.id);
      setActionSuccess(isIsolated ? 'Asset restored from isolation' : 'Asset quarantined into isolated VLAN 999');
      setTimeout(() => setActionSuccess(null), 3500);
    }
  };

  const handleVirtualPatch = (cveId: string) => {
    setIsPatching(cveId);
    setTimeout(() => {
      setPatchedCves((prev) => [...prev, cveId]);
      setIsPatching(null);
      setActionSuccess(`Applied IPS virtual patch for ${cveId} at firewall perimeter`);
      setTimeout(() => setActionSuccess(null), 3500);
    }, 800);
  };

  const handleRefreshTelemetry = () => {
    setIsRefreshingTelemetry(true);
    setTimeout(() => {
      setIsRefreshingTelemetry(false);
      setActionSuccess('Telemetry snapshot refreshed from agent tap stream');
      setTimeout(() => setActionSuccess(null), 3000);
    }, 600);
  };

  const getNodeIcon = () => {
    switch (node.type) {
      case 'domain_controller':
        return <Server className="w-5 h-5 text-purple-400" />;
      case 'db_cluster':
        return <Database className="w-5 h-5 text-blue-400" />;
      case 'workstation':
        return <Laptop className="w-5 h-5 text-cyan-400" />;
      case 'web_server':
        return <Layers className="w-5 h-5 text-emerald-400" />;
      case 'cloud_s3':
        return <Cloud className="w-5 h-5 text-amber-400" />;
      case 'sensor_tap':
        return <Radio className="w-5 h-5 text-[#00E5FF]" />;
      case 'firewall':
      default:
        return <Shield className="w-5 h-5 text-orange-400" />;
    }
  };

  const allCves = [
    {
      id: 'CVE-2026-21894',
      cvss: 9.8,
      severity: 'CRITICAL',
      desc: 'Remote RPC buffer overflow in lsass.exe via crafted NTLM request',
      vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      epss: '89.4%',
      status: patchedCves.includes('CVE-2026-21894') ? 'PATCHED' : 'UNPATCHED',
    },
    {
      id: 'CVE-2026-14920',
      cvss: 8.4,
      severity: 'HIGH',
      desc: 'Unchecked privilege escalation in local backup daemon service',
      vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
      epss: '42.1%',
      status: patchedCves.includes('CVE-2026-14920') ? 'PATCHED' : 'UNPATCHED',
    },
    {
      id: 'CVE-2025-49211',
      cvss: 7.5,
      severity: 'HIGH',
      desc: 'Information disclosure in OpenSSL handshake cipher negotiation',
      vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
      epss: '21.0%',
      status: patchedCves.includes('CVE-2025-49211') ? 'PATCHED' : 'UNPATCHED',
    },
    {
      id: 'CVE-2025-33109',
      cvss: 5.3,
      severity: 'MEDIUM',
      desc: 'Denial of service via malformed DNS response recursion loop',
      vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L',
      epss: '8.2%',
      status: patchedCves.includes('CVE-2025-33109') ? 'PATCHED' : 'UNPATCHED',
    },
  ];

  const filteredCves = allCves.filter(
    (c) =>
      c.id.toLowerCase().includes(cveSearch.toLowerCase()) ||
      c.desc.toLowerCase().includes(cveSearch.toLowerCase())
  );

  interface TabItem {
    id: 'OVERVIEW' | 'VULNERABILITIES' | 'SERVICES' | 'TELEMETRY';
    label: string;
    count?: number;
  }

  const tabs: TabItem[] = [
    { id: 'OVERVIEW', label: 'Overview' },
    { id: 'VULNERABILITIES', label: 'Vulnerabilities', count: node.vulnerabilitiesCount?.critical || 2 },
    { id: 'SERVICES', label: 'Services', count: node.services?.length || 4 },
    { id: 'TELEMETRY', label: 'Telemetry' },
  ];

  return (
    <div
      id="node-details-drawer"
      className="bg-[#111318] border border-slate-800 rounded-xl flex flex-col h-full max-h-[720px] overflow-hidden text-slate-200 shadow-xl"
    >
      {/* Header */}
      <div className="p-3.5 bg-[#151821] border-b border-slate-800 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center shrink-0">
            {getNodeIcon()}
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white truncate">{node.label}</h3>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  node.threatLevel === 'CRITICAL'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : node.threatLevel === 'HIGH'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {node.threatLevel}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
              <span>{node.ip}</span>
              <span>•</span>
              <span className="text-cyan-400 uppercase font-semibold">{node.zone} ZONE</span>
              {node.criticality && (
                <>
                  <span>•</span>
                  <span className="text-amber-400">{node.criticality.replace('TIER_', 'T')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          id="close-node-details-btn"
          onClick={onClose}
          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="Close details"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Action Alert Banner */}
      {actionSuccess && (
        <div className="bg-emerald-950/90 border-b border-emerald-800/80 px-3.5 py-1.5 text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{actionSuccess}</span>
        </div>
      )}

      {/* Tab Navigation Slider */}
      <div className="px-2 pt-1.5 border-b border-slate-800 bg-[#13151D]">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`node-tab-${tab.id.toLowerCase()}`}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#1E222D] text-[#00E5FF] shadow-sm border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isSelected
                        ? 'bg-[#00E5FF]/20 text-[#00E5FF]'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs">
        {activeTab === 'OVERVIEW' && (
          <>
            {/* Status & Valuation Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#161922] p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Compromised Status</div>
                <div className={`text-sm font-mono font-bold mt-1 ${node.compromised ? 'text-red-400' : 'text-emerald-400'}`}>
                  {node.compromised ? 'YES (Active Vector)' : 'NO (Nominal)'}
                </div>
              </div>

              <div className="bg-[#161922] p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Blast Exposure</div>
                <div className="text-sm font-mono font-bold text-orange-400 mt-1">{node.blastRadius || 54}% Radius</div>
              </div>

              <div className="bg-[#161922] p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Asset Valuation</div>
                <div className="text-sm font-mono font-bold text-emerald-400 mt-1">
                  ${((node.assetValueUSD || 350000) / 1000).toLocaleString()}k USD
                </div>
              </div>

              <div className="bg-[#161922] p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">SCA Hardening Score</div>
                <div className="text-sm font-mono font-bold text-cyan-400 mt-1">{node.scaScore || 85}% Compliance</div>
              </div>
            </div>

            {/* Operating System & Identity */}
            <div className="bg-[#161922] p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-white">System & Identity Profile</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-slate-500">OS: </span>
                  <span className="font-mono text-slate-200">{node.os || 'Enterprise Linux x86_64'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Agent ID: </span>
                  <span className="font-mono text-[#00E5FF]">{node.agentId || 'cecur-ag-fleet-409'}</span>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <span className="text-slate-500">Connected Identity: </span>
                  <span className="font-mono text-slate-200">{node.connectedUser || 'CORP\\svc-ad-sync'}</span>
                </div>
              </div>
            </div>

            {/* MITRE Techniques */}
            {node.mitreTechniques && node.mitreTechniques.length > 0 && (
              <div className="bg-[#161922] p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-red-400" />
                  <span>Associated MITRE ATT&CK Techniques</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {node.mitreTechniques.map((tech, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/30"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Compliance Tags */}
            {node.complianceTags && node.complianceTags.length > 0 && (
              <div className="bg-[#161922] p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Regulatory & Security Standards</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {node.complianceTags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Topology Links */}
            {connectedLinks.length > 0 && (
              <div className="bg-[#161922] p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="text-[11px] font-semibold text-white">Connected Lateral Links ({connectedLinks.length})</div>
                <div className="space-y-1.5">
                  {connectedLinks.map((link, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded border flex items-center justify-between gap-2 ${
                        link.threat ? 'bg-red-950/20 border-red-800/40 text-red-200' : 'bg-[#12141A] border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="truncate cursor-pointer" onClick={() => onSelectConnectedNode && onSelectConnectedNode(link.source === node.id ? link.target : link.source)}>
                        <div className="flex items-center gap-1.5 text-xs font-mono font-semibold">
                          <span>{link.source === node.id ? '-> ' + link.target : '<- ' + link.source}</span>
                          {link.threat && <span className="text-[9px] px-1 bg-red-500/30 text-red-300 rounded">THREAT</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{link.protocol} • {link.description}</div>
                      </div>

                      {link.threat && onSeverLink && (
                        <button
                          id={`sever-link-${link.id || idx}-btn`}
                          onClick={() => onSeverLink(link.id || '')}
                          className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[10px] font-semibold transition-colors shrink-0"
                        >
                          Sever Link
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'VULNERABILITIES' && (
          <div className="space-y-3">
            {/* CVE Severity Counter Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-red-950/30 border border-red-800/40 p-2.5 rounded-lg text-center">
                <div className="text-xl font-mono font-bold text-red-400">{node.vulnerabilitiesCount?.critical || 1}</div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Critical CVEs</div>
              </div>
              <div className="bg-amber-950/30 border border-amber-800/40 p-2.5 rounded-lg text-center">
                <div className="text-xl font-mono font-bold text-amber-400">{node.vulnerabilitiesCount?.high || 2}</div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">High CVEs</div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700 p-2.5 rounded-lg text-center">
                <div className="text-xl font-mono font-bold text-slate-200">{node.vulnerabilitiesCount?.medium || 1}</div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Medium CVEs</div>
              </div>
            </div>

            {/* CVE Search Filter */}
            <div className="flex items-center gap-2 bg-[#181B24] border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search CVE ID, vector, or description..."
                value={cveSearch}
                onChange={(e) => setCveSearch(e.target.value)}
                className="bg-transparent text-white placeholder-slate-500 text-xs outline-none w-full"
              />
            </div>

            {/* Detailed CVE List */}
            <div className="space-y-2">
              {filteredCves.map((cve) => (
                <div
                  key={cve.id}
                  className={`p-3 rounded-lg border text-xs space-y-2 ${
                    cve.status === 'PATCHED'
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-300'
                      : cve.severity === 'CRITICAL'
                      ? 'bg-red-950/20 border-red-800/40 text-red-200'
                      : 'bg-[#161922] border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{cve.id}</span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          cve.severity === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400'
                            : cve.severity === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        CVSS {cve.cvss} ({cve.severity})
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-slate-400">EPSS: {cve.epss}</span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-snug">{cve.desc}</p>
                  <div className="text-[10px] font-mono text-slate-500 truncate">{cve.vector}</div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-[10px] font-mono text-slate-400">
                      Status: {cve.status === 'PATCHED' ? <span className="text-emerald-400 font-bold">Virtual Patched</span> : <span className="text-red-400 font-bold">Exposed</span>}
                    </span>

                    {cve.status !== 'PATCHED' ? (
                      <button
                        id={`patch-cve-${cve.id}-btn`}
                        onClick={() => handleVirtualPatch(cve.id)}
                        disabled={isPatching === cve.id}
                        className="px-2.5 py-1 rounded bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 text-[#00E5FF] border border-cyan-500/40 text-[10px] font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isPatching === cve.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        <span>Deploy Virtual Patch</span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-semibold">
                        <Check className="w-3 h-3" />
                        <span>Enforced at Edge</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SERVICES' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Running Daemons & Exposed Endpoints</span>
              <span className="text-[10px] font-mono text-slate-400">4 Monitored Ports</span>
            </div>

            <div className="space-y-2">
              {[
                { name: 'Active Directory Kerberos KDC', port: '88/TCP', status: 'RUNNING', pid: 1402, conn: '12 active' },
                { name: 'RPC Endpoint Mapper (lsass.exe)', port: '135/TCP', status: 'RUNNING', pid: 890, conn: '4 active' },
                { name: 'SMB / CIFS File Sharing', port: '445/TCP', status: 'RUNNING', pid: 1104, conn: '28 active' },
                { name: 'OpenSSH Secure Shell Daemon', port: '22/TCP', status: 'RUNNING', pid: 720, conn: '2 active' },
                { name: 'Prometheus Node Exporter', port: '9100/TCP', status: 'RUNNING', pid: 2190, conn: '1 active' },
              ].map((svc, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-[#161922] border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-mono text-slate-200 text-xs font-semibold truncate">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                      <span className="text-cyan-400">{svc.port}</span>
                      <span>•</span>
                      <span>PID {svc.pid}</span>
                      <span>•</span>
                      <span>{svc.conn}</span>
                    </div>
                  </div>

                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    ACTIVE
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'TELEMETRY' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Live Host Resource Telemetry</span>
              <button
                id="refresh-telemetry-btn"
                onClick={handleRefreshTelemetry}
                className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-300 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingTelemetry ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            </div>

            {/* Gauges */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#161922] p-3 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>CPU Load</span>
                  <Cpu className="w-3.5 h-3.5 text-[#00E5FF]" />
                </div>
                <div className="text-lg font-mono font-bold text-white">{node.cpuUsage || 48}%</div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-[#00E5FF]" style={{ width: `${node.cpuUsage || 48}%` }} />
                </div>
                <div className="text-[9px] font-mono text-slate-500 mt-1">8 Cores • 2.80 GHz</div>
              </div>

              <div className="bg-[#161922] p-3 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>RAM Usage</span>
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-lg font-mono font-bold text-white">{node.memoryUsage || 64}%</div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-purple-400" style={{ width: `${node.memoryUsage || 64}%` }} />
                </div>
                <div className="text-[9px] font-mono text-slate-500 mt-1">20.4 GB / 32 GB</div>
              </div>
            </div>

            {/* Additional Telemetry Parameters */}
            <div className="bg-[#161922] p-3 rounded-lg border border-slate-800 space-y-2 text-slate-300">
              <div className="text-[11px] font-semibold text-white">Security Agent Telemetry Feed</div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">FIM Monitored Files:</span>
                  <span className="font-mono text-white">{node.fimMonitoredFilesCount || 1240} paths</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Installed Packages:</span>
                  <span className="font-mono text-white">{node.installedPackagesCount || 342} pkgs</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Network RX / TX:</span>
                  <span className="font-mono text-cyan-300">14.2 Mbps / 8.1 Mbps</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Syscall Audit Filter:</span>
                  <span className="font-mono text-emerald-400">eBPF Active (0 drops)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Containment Actions */}
      <div className="p-3 bg-[#151821] border-t border-slate-800 flex items-center justify-between gap-2">
        <button
          id="node-quarantine-btn"
          onClick={handleQuarantine}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            isIsolated
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{isIsolated ? 'Restore from Quarantine' : 'Quarantine Host at Network Edge'}</span>
        </button>
      </div>
    </div>
  );
};

