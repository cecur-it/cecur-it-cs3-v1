import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Network,
  ShieldAlert,
  Server,
  Database,
  Cloud,
  Laptop,
  Shield,
  Layers,
  ArrowRight,
  Crosshair,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Pause,
  Sliders,
  CheckCircle,
  Lock,
  Flame,
  Cpu,
  Terminal,
  Activity,
  Search,
  Maximize2,
  Minimize2,
  RotateCw,
  Zap,
  Ban,
  RefreshCw,
  Eye,
  Link2,
  Filter,
  Radio,
  SlidersHorizontal,
  Share2,
  Download,
  Info,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import {
  FusionGraphData,
  FusionGraphNode,
  FusionGraphLink,
  AttackPath,
  AttackPathStep,
  BlastSimulationResult,
} from '../../types';
import { AttackPathTracer } from './fusion/AttackPathTracer';
import { BlastSimulator } from './fusion/BlastSimulator';
import { ThreatExportModal } from './fusion/ThreatExportModal';
import { NodeDetailsDrawer } from './fusion/NodeDetailsDrawer';

export const FusionPanel: React.FC = () => {
  const [data, setData] = useState<FusionGraphData | null>(null);
  const [nodes, setNodes] = useState<FusionGraphNode[]>([]);
  const [links, setLinks] = useState<FusionGraphLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<FusionGraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<FusionGraphLink | null>(null);
  const [loading, setLoading] = useState(true);

  // Layout View Modes: Concentric Zone Ring, Tiered Network Flow, Freeform Physics
  const [layoutMode, setLayoutMode] = useState<'CONCENTRIC_RING' | 'HIERARCHICAL_FLOW' | 'FREEFORM_FORCE'>('CONCENTRIC_RING');

  // Concentric Zone Controls (Strictly no use of the word "orbital" or "ORBITAL")
  const [ringRotationAngle, setRingRotationAngle] = useState<number>(0);
  const [isAutoRotatingRings, setIsAutoRotatingRings] = useState<boolean>(false);
  const [ringRadiusScale, setRingRadiusScale] = useState<number>(1.0);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [threatFilter, setThreatFilter] = useState<string>('ALL');

  // Interactive Canvas State: Zoom, Pan, Drag
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [customNodePositions, setCustomNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Attack Path Trace State
  const [activeAttackPathId, setActiveAttackPathId] = useState<string>('path-apt-lateral-01');
  const [activeAttackStepIndex, setActiveAttackStepIndex] = useState<number>(0);
  const [isPlayingAttackTrace, setIsPlayingAttackTrace] = useState<boolean>(false);
  const [playbackSpeedMultiplier, setPlaybackSpeedMultiplier] = useState<number>(1);

  // Blast Radius Simulation State
  const [blastSimResult, setBlastSimResult] = useState<BlastSimulationResult | null>(null);

  // Isolation & Quarantine State
  const [isolatedNodeIds, setIsolatedNodeIds] = useState<string[]>(['node-ws-fin-104']);
  const [severedLinkIds, setSeveredLinkIds] = useState<string[]>([]);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Modals & Panels
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [activeSideTool, setActiveSideTool] = useState<'ATTACK_PATH' | 'BLAST_SIM' | 'NODE_INSPECT'>('ATTACK_PATH');

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load backend fusion data
  const fetchFusionData = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<FusionGraphData>('/api/fusion');
      setData(res);
      setNodes(res.nodes);
      setLinks(res.links || []);
      if (res.attackPaths && res.attackPaths.length > 0) {
        setActiveAttackPathId(res.attackPaths[0].id);
      }
      if (res.nodes.length > 0 && !selectedNode) {
        setSelectedNode(res.nodes[0]);
      }
    } catch (err: any) {
      console.error('Failed to load asset fusion graph:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFusionData();
  }, []);

  // Concentric Ring Auto-Rotation Timer
  useEffect(() => {
    let animTimer: any = null;
    if (isAutoRotatingRings && layoutMode === 'CONCENTRIC_RING') {
      animTimer = setInterval(() => {
        setRingRotationAngle((prev) => (prev + 0.4) % 360);
      }, 50);
    }
    return () => {
      if (animTimer) clearInterval(animTimer);
    };
  }, [isAutoRotatingRings, layoutMode]);

  // Attack Path Playback Timer
  useEffect(() => {
    let traceTimer: any = null;
    if (isPlayingAttackTrace && data?.attackPaths) {
      const currentPath = data.attackPaths.find((p) => p.id === activeAttackPathId);
      const totalSteps = currentPath?.steps.length || 0;

      const stepDelay = 2200 / playbackSpeedMultiplier;

      traceTimer = setInterval(() => {
        setActiveAttackStepIndex((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlayingAttackTrace(false);
            return prev;
          }
          return prev + 1;
        });
      }, stepDelay);
    }

    return () => {
      if (traceTimer) clearInterval(traceTimer);
    };
  }, [isPlayingAttackTrace, activeAttackPathId, data, playbackSpeedMultiplier]);

  // Handle Isolation
  const handleToggleIsolateNode = (nodeId: string) => {
    setIsolatedNodeIds((prev) => {
      const exists = prev.includes(nodeId);
      const next = exists ? prev.filter((id) => id !== nodeId) : [...prev, nodeId];
      setActionSuccessMessage(exists ? `Restored ${nodeId} from quarantine` : `Quarantined ${nodeId} at network edge`);
      setTimeout(() => setActionSuccessMessage(null), 3000);
      return next;
    });
  };

  // Handle Sever Link
  const handleToggleSeverLink = (linkId: string) => {
    setSeveredLinkIds((prev) => {
      const exists = prev.includes(linkId);
      const next = exists ? prev.filter((id) => id !== linkId) : [...prev, linkId];
      setActionSuccessMessage(exists ? `Restored traffic link ${linkId}` : `Severed lateral link ${linkId}`);
      setTimeout(() => setActionSuccessMessage(null), 3000);
      return next;
    });
  };

  // Calculate Node Coordinates based on layout mode
  const getCalculatedNodeCoordinates = (node: FusionGraphNode, index: number, total: number) => {
    // If custom dragged
    if (customNodePositions[node.id]) {
      return customNodePositions[node.id];
    }

    const centerX = 440;
    const centerY = 320;

    if (layoutMode === 'CONCENTRIC_RING') {
      // Zone 0: Enclave Core (Center)
      if (node.id === 'node-dc-primary') {
        return { x: centerX, y: centerY - 25 };
      }
      if (node.id === 'node-db-vault') {
        return { x: centerX, y: centerY + 35 };
      }

      // Ring 1: Internal Workloads & Endpoints
      const ring1Nodes = ['node-ws-fin-104', 'node-k8s-worker', 'node-mac-exec'];
      if (ring1Nodes.includes(node.id)) {
        const ring1Idx = ring1Nodes.indexOf(node.id);
        const ring1Radius = 140 * ringRadiusScale;
        const baseAngle = (ring1Idx * (360 / ring1Nodes.length) + ringRotationAngle) * (Math.PI / 180);
        return {
          x: centerX + ring1Radius * Math.cos(baseAngle),
          y: centerY + ring1Radius * Math.sin(baseAngle),
        };
      }

      // Ring 2: DMZ & Edge Perimeter
      const ring2Nodes = ['node-dmz-web-01', 'node-edge-fw', 'node-cs3-tap-dmz'];
      if (ring2Nodes.includes(node.id)) {
        const ring2Idx = ring2Nodes.indexOf(node.id);
        const ring2Radius = 240 * ringRadiusScale;
        const baseAngle = (ring2Idx * (360 / ring2Nodes.length) - ringRotationAngle * 0.7 + 45) * (Math.PI / 180);
        return {
          x: centerX + ring2Radius * Math.cos(baseAngle),
          y: centerY + ring2Radius * Math.sin(baseAngle),
        };
      }

      // Ring 3: Cloud Infrastructure & External Partners
      const ring3Nodes = ['node-cloud-s3', 'node-contractor-lap'];
      const ring3Idx = Math.max(0, ring3Nodes.indexOf(node.id));
      const ring3Radius = 330 * ringRadiusScale;
      const baseAngle = (ring3Idx * (360 / Math.max(1, ring3Nodes.length)) + ringRotationAngle * 0.5 + 90) * (Math.PI / 180);
      return {
        x: centerX + ring3Radius * Math.cos(baseAngle),
        y: centerY + ring3Radius * Math.sin(baseAngle),
      };
    }

    if (layoutMode === 'HIERARCHICAL_FLOW') {
      // Hierarchical Tiered Flow (Zone columns)
      const zoneColumns: Record<string, number> = {
        EDGE: 130,
        DMZ: 330,
        INTERNAL: 550,
        CLOUD: 760,
      };
      const colX = zoneColumns[node.zone] || 450;
      const nodesInZone = nodes.filter((n) => n.zone === node.zone);
      const zoneIdx = nodesInZone.findIndex((n) => n.id === node.id);
      const rowY = 140 + zoneIdx * 160;
      return { x: colX, y: rowY };
    }

    // FREEFORM / FORCE default
    return {
      x: node.x || 400 + (index % 3) * 160,
      y: node.y || 160 + Math.floor(index / 3) * 140,
    };
  };

  // Canvas Drag & Pan Handlers
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'fusion-canvas-bg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    } else if (draggingNodeId && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const currentX = (e.clientX - rect.left - panX) / zoom;
      const currentY = (e.clientY - rect.top - panY) / zoom;
      setCustomNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: { x: currentX, y: currentY },
      }));
    }
  };

  const handleMouseUpCanvas = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleResetView = () => {
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
    setCustomNodePositions({});
    setRingRotationAngle(0);
    setRingRadiusScale(1.0);
  };

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchQuery =
        !searchQuery ||
        n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.ip.includes(searchQuery) ||
        n.os?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.services?.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchZone = zoneFilter === 'ALL' || n.zone === zoneFilter;
      const matchThreat =
        threatFilter === 'ALL' ||
        (threatFilter === 'COMPROMISED' && n.compromised) ||
        (threatFilter === 'CRITICAL' && n.threatLevel === 'CRITICAL') ||
        (threatFilter === 'ELEVATED' && (n.threatLevel === 'HIGH' || n.threatLevel === 'ELEVATED'));

      return matchQuery && matchZone && matchThreat;
    });
  }, [nodes, searchQuery, zoneFilter, threatFilter]);

  // Current Attack Path & Step
  const currentAttackPath = useMemo(() => {
    if (!data?.attackPaths) return null;
    return data.attackPaths.find((p) => p.id === activeAttackPathId) || data.attackPaths[0];
  }, [data, activeAttackPathId]);

  const currentAttackStep = useMemo(() => {
    if (!currentAttackPath) return null;
    return currentAttackPath.steps[activeAttackStepIndex] || currentAttackPath.steps[0];
  }, [currentAttackPath, activeAttackStepIndex]);

  // Connected links to selected node
  const selectedNodeConnectedLinks = useMemo(() => {
    if (!selectedNode) return [];
    return links.filter((l) => l.source === selectedNode.id || l.target === selectedNode.id);
  }, [selectedNode, links]);

  // Node Icon Helper
  const renderNodeIcon = (type: string) => {
    switch (type) {
      case 'domain_controller':
        return <Server className="w-5 h-5 text-purple-300" />;
      case 'db_cluster':
        return <Database className="w-5 h-5 text-blue-300" />;
      case 'workstation':
        return <Laptop className="w-5 h-5 text-cyan-300" />;
      case 'web_server':
        return <Layers className="w-5 h-5 text-emerald-300" />;
      case 'cloud_s3':
        return <Cloud className="w-5 h-5 text-amber-300" />;
      case 'sensor_tap':
        return <Radio className="w-5 h-5 text-[#00E5FF]" />;
      case 'firewall':
      default:
        return <Shield className="w-5 h-5 text-orange-300" />;
    }
  };

  if (loading) {
    return (
      <div id="fusion-panel-loading" className="flex flex-col items-center justify-center min-h-[600px] text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#00E5FF]" />
        <span className="text-sm font-mono font-medium">Constructing Asset Fusion & Lateral Threat Topology...</span>
      </div>
    );
  }

  return (
    <div
      id="fusion-panel-root"
      ref={containerRef}
      className={`flex flex-col gap-4 text-slate-200 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0A0B0E] p-4 overflow-y-auto' : ''}`}
    >
      {/* Top Header & High-Level Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111318] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF] shadow-md shadow-[#00E5FF]/10">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Asset Fusion & Lateral Threat Topology
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                CONCENTRIC ZONE MAP
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Zero-Trust enclave hierarchy, live lateral attack vector tracing, & dynamic blast simulation
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="refresh-fusion-btn"
            onClick={fetchFusionData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181B24] hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/80 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Topology</span>
          </button>

          <button
            id="open-export-modal-btn"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00E5FF] hover:bg-[#00cce6] text-black text-xs font-bold transition-all shadow-md shadow-[#00E5FF]/20"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Export Threat Insights</span>
          </button>
        </div>
      </div>

      {/* Network Health & Posture Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#111318] border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Fused Assets</span>
          <div className="text-xl font-mono font-extrabold text-white mt-1">{nodes.length} Hosts</div>
          <span className="text-[9px] text-slate-500">100% Agent/Tap Sync</span>
        </div>

        <div className="bg-[#111318] border border-red-900/40 p-3 rounded-xl flex flex-col justify-between bg-red-950/10">
          <span className="text-[10px] font-mono text-red-400 uppercase">Compromised</span>
          <div className="text-xl font-mono font-extrabold text-red-400 mt-1">
            {nodes.filter((n) => n.compromised).length} Hosts
          </div>
          <span className="text-[9px] text-red-400/80">Active Infiltration</span>
        </div>

        <div className="bg-[#111318] border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-mono text-purple-400 uppercase">Quarantined</span>
          <div className="text-xl font-mono font-extrabold text-purple-300 mt-1">{isolatedNodeIds.length} Nodes</div>
          <span className="text-[9px] text-slate-500">VLAN 999 Isolation</span>
        </div>

        <div className="bg-[#111318] border border-amber-900/40 p-3 rounded-xl flex flex-col justify-between bg-amber-950/10">
          <span className="text-[10px] font-mono text-amber-400 uppercase">Threat Hops</span>
          <div className="text-xl font-mono font-extrabold text-amber-400 mt-1">
            {links.filter((l) => l.threat && !severedLinkIds.includes(l.id || '')).length} Vectors
          </div>
          <span className="text-[9px] text-amber-400/80">Lateral Propagation</span>
        </div>

        <div className="bg-[#111318] border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-mono text-orange-400 uppercase">Risk Posture</span>
          <div className="text-xl font-mono font-extrabold text-orange-400 mt-1">84 / 100</div>
          <span className="text-[9px] text-slate-500">High Risk Enclave</span>
        </div>

        <div className="bg-[#111318] border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-mono text-cyan-400 uppercase">Zero-Trust Cover</span>
          <div className="text-xl font-mono font-extrabold text-cyan-300 mt-1">78.5%</div>
          <span className="text-[9px] text-cyan-400/80">Policy Enforced</span>
        </div>
      </div>

      {/* Main Interactive Grid: Left Visualizer + Right Tool Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Canvas + Map Controls + Search Filters (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Visualizer Canvas Card */}
          <div className="bg-[#111318] border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-xl">
            {/* Canvas Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#151821] border-b border-slate-800 text-xs">
              {/* Layout Switcher */}
              <div className="flex items-center gap-1 bg-[#0E1015] p-1 rounded-xl border border-slate-800">
                <button
                  id="layout-mode-concentric-btn"
                  onClick={() => setLayoutMode('CONCENTRIC_RING')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    layoutMode === 'CONCENTRIC_RING'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Concentric Map
                </button>
                <button
                  id="layout-mode-hierarchical-btn"
                  onClick={() => setLayoutMode('HIERARCHICAL_FLOW')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    layoutMode === 'HIERARCHICAL_FLOW'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Security Tier Flow
                </button>
                <button
                  id="layout-mode-force-btn"
                  onClick={() => setLayoutMode('FREEFORM_FORCE')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    layoutMode === 'FREEFORM_FORCE'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Force Mesh
                </button>
              </div>

              {/* Concentric Rotation & Spacing Controls */}
              {layoutMode === 'CONCENTRIC_RING' && (
                <div className="flex items-center gap-2">
                  <button
                    id="toggle-ring-autorotate-btn"
                    onClick={() => setIsAutoRotatingRings(!isAutoRotatingRings)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      isAutoRotatingRings
                        ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50'
                        : 'bg-[#181B23] text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    <RotateCw className={`w-3 h-3 ${isAutoRotatingRings ? 'animate-spin' : ''}`} />
                    <span>{isAutoRotatingRings ? 'Rotating' : 'Rotate Map'}</span>
                  </button>

                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[10px]">
                    <span>Spacing:</span>
                    <input
                      id="ring-radius-scale-slider"
                      type="range"
                      min="0.75"
                      max="1.3"
                      step="0.05"
                      value={ringRadiusScale}
                      onChange={(e) => setRingRadiusScale(parseFloat(e.target.value))}
                      className="w-16 h-1 bg-slate-700 rounded-lg accent-[#00E5FF] cursor-pointer"
                      title="Adjust zone ring spacing"
                    />
                  </div>
                </div>
              )}

              {/* Zoom & Pan Controls */}
              <div className="flex items-center gap-1">
                <button
                  id="canvas-zoom-in-btn"
                  onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  id="canvas-zoom-out-btn"
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  id="canvas-reset-view-btn"
                  onClick={handleResetView}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Reset View"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  id="canvas-fullscreen-toggle-btn"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-[#12141A] border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2 flex-1 max-w-xs bg-[#181B24] border border-slate-700/80 rounded-lg px-2.5 py-1">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  id="fusion-search-input"
                  type="text"
                  placeholder="Filter nodes, IPs, services, CVEs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-white placeholder-slate-500 text-xs outline-none w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                {/* Zone Filter */}
                <select
                  id="fusion-zone-filter-select"
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="bg-[#181B24] border border-slate-700/80 text-slate-300 rounded-lg px-2 py-1 outline-none text-xs"
                >
                  <option value="ALL">All Zones</option>
                  <option value="INTERNAL">Internal Enclave</option>
                  <option value="DMZ">DMZ Ingress</option>
                  <option value="EDGE">Edge Firewall</option>
                  <option value="CLOUD">Cloud Storage</option>
                </select>

                {/* Threat Filter */}
                <select
                  id="fusion-threat-filter-select"
                  value={threatFilter}
                  onChange={(e) => setThreatFilter(e.target.value)}
                  className="bg-[#181B24] border border-slate-700/80 text-slate-300 rounded-lg px-2 py-1 outline-none text-xs"
                >
                  <option value="ALL">All Threat Levels</option>
                  <option value="COMPROMISED">Compromised Only</option>
                  <option value="CRITICAL">Critical Severity</option>
                  <option value="ELEVATED">Elevated & High</option>
                </select>
              </div>
            </div>

            {/* SVG Topology Viewport */}
            <div
              id="fusion-canvas-container"
              className="relative w-full h-[540px] bg-[#0A0B0E] overflow-hidden cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDownCanvas}
              onMouseMove={handleMouseMoveCanvas}
              onMouseUp={handleMouseUpCanvas}
            >
              {/* Background Grid Pattern */}
              <div
                id="fusion-canvas-bg"
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, #00E5FF 1px, transparent 0)',
                  backgroundSize: '32px 32px',
                }}
              />

              <svg
                ref={svgRef}
                id="fusion-topology-svg"
                className="w-full h-full"
                viewBox="0 0 880 640"
              >
                <defs>
                  {/* Glowing Arrow Markers */}
                  <marker
                    id="arrow-threat"
                    viewBox="0 0 10 10"
                    refX="22"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
                  </marker>
                  <marker
                    id="arrow-nominal"
                    viewBox="0 0 10 10"
                    refX="22"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#00E5FF" />
                  </marker>
                  <marker
                    id="arrow-active-hop"
                    viewBox="0 0 10 10"
                    refX="22"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#F59E0B" />
                  </marker>

                  {/* Filter Glows */}
                  <filter id="glow-threat" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
                  {/* Concentric Guide Rings (When in Concentric Mode) */}
                  {layoutMode === 'CONCENTRIC_RING' && (
                    <g id="concentric-guide-rings">
                      {/* Center Zero-Trust Shield Hub (Zone 0) */}
                      <circle
                        cx="440"
                        cy="320"
                        r={45 * ringRadiusScale}
                        fill="#6B21A8"
                        fillOpacity="0.08"
                        stroke="#A855F7"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                      />
                      <text x="440" y="325" textAnchor="middle" fill="#C084FC" fontSize="9" fontFamily="monospace" fontWeight="bold">
                        ZONE 0: CORE ENCLAVE
                      </text>

                      {/* Ring 1: Internal Workloads */}
                      <circle
                        cx="440"
                        cy="320"
                        r={140 * ringRadiusScale}
                        fill="none"
                        stroke="#00E5FF"
                        strokeOpacity="0.18"
                        strokeWidth="1.2"
                        strokeDasharray="6 4"
                      />
                      <text x="440" y={320 - 144 * ringRadiusScale} textAnchor="middle" fill="#00E5FF" fillOpacity="0.6" fontSize="9" fontFamily="monospace">
                        RING 1: INTERNAL WORKLOADS
                      </text>

                      {/* Ring 2: DMZ & Edge Perimeter */}
                      <circle
                        cx="440"
                        cy="320"
                        r={240 * ringRadiusScale}
                        fill="none"
                        stroke="#F59E0B"
                        strokeOpacity="0.15"
                        strokeWidth="1.2"
                        strokeDasharray="8 6"
                      />
                      <text x="440" y={320 - 244 * ringRadiusScale} textAnchor="middle" fill="#F59E0B" fillOpacity="0.6" fontSize="9" fontFamily="monospace">
                        RING 2: DMZ & EDGE PERIMETER
                      </text>

                      {/* Ring 3: Cloud & Remote Endpoints */}
                      <circle
                        cx="440"
                        cy="320"
                        r={330 * ringRadiusScale}
                        fill="none"
                        stroke="#64748B"
                        strokeOpacity="0.2"
                        strokeWidth="1"
                        strokeDasharray="10 8"
                      />
                      <text x="440" y={320 - 334 * ringRadiusScale} textAnchor="middle" fill="#94A3B8" fillOpacity="0.6" fontSize="9" fontFamily="monospace">
                        RING 3: CLOUD & PARTNERS
                      </text>
                    </g>
                  )}

                  {/* Dynamic Blast Radius Halo (If origin node selected in simulation) */}
                  {blastSimResult && (
                    <g id="blast-simulation-halo">
                      {(() => {
                        const originNode = nodes.find((n) => n.id === blastSimResult.originNodeId);
                        if (!originNode) return null;
                        const originIdx = nodes.indexOf(originNode);
                        const coords = getCalculatedNodeCoordinates(originNode, originIdx, nodes.length);
                        const haloRadius = (blastSimResult.exposureScore / 100) * 260 + 40;

                        return (
                          <>
                            <circle
                              cx={coords.x}
                              cy={coords.y}
                              r={haloRadius}
                              fill="#EF4444"
                              fillOpacity="0.08"
                              stroke="#EF4444"
                              strokeWidth="2"
                              strokeDasharray="6 4"
                              className="animate-pulse"
                            />
                            <circle
                              cx={coords.x}
                              cy={coords.y}
                              r={haloRadius * 0.5}
                              fill="#EF4444"
                              fillOpacity="0.12"
                              stroke="#F59E0B"
                              strokeWidth="1"
                            />
                          </>
                        );
                      })()}
                    </g>
                  )}

                  {/* Render Links / Edges */}
                  <g id="topology-links">
                    {links.map((link, idx) => {
                      const sourceNode = nodes.find((n) => n.id === link.source);
                      const targetNode = nodes.find((n) => n.id === link.target);
                      if (!sourceNode || !targetNode) return null;

                      const sourceIdx = nodes.indexOf(sourceNode);
                      const targetIdx = nodes.indexOf(targetNode);
                      const srcPos = getCalculatedNodeCoordinates(sourceNode, sourceIdx, nodes.length);
                      const tgtPos = getCalculatedNodeCoordinates(targetNode, targetIdx, nodes.length);

                      const isSevered = severedLinkIds.includes(link.id || '');
                      const isSelected = selectedLink?.id === link.id;

                      // Check if active attack step hop
                      const isActiveAttackHop =
                        currentAttackStep &&
                        ((currentAttackStep.sourceNodeId === link.source && currentAttackStep.targetNodeId === link.target) ||
                          (currentAttackStep.sourceNodeId === link.target && currentAttackStep.targetNodeId === link.source));

                      return (
                        <g key={link.id || idx} className="cursor-pointer" onClick={() => setSelectedLink(link)}>
                          {/* Underlying clickable fat path */}
                          <line
                            x1={srcPos.x}
                            y1={srcPos.y}
                            x2={tgtPos.x}
                            y2={tgtPos.y}
                            stroke="transparent"
                            strokeWidth="14"
                          />

                          {/* Link Line */}
                          <line
                            x1={srcPos.x}
                            y1={srcPos.y}
                            x2={tgtPos.x}
                            y2={tgtPos.y}
                            stroke={
                              isSevered
                                ? '#475569'
                                : isActiveAttackHop
                                ? '#F59E0B'
                                : link.threat
                                ? '#EF4444'
                                : '#00E5FF'
                            }
                            strokeWidth={isActiveAttackHop ? 3.5 : isSelected ? 3 : link.threat ? 2.2 : 1.4}
                            strokeDasharray={isSevered ? '4 4' : link.threat ? '6 4' : undefined}
                            strokeOpacity={isSevered ? 0.4 : isActiveAttackHop ? 1 : 0.75}
                            markerEnd={
                              isSevered
                                ? undefined
                                : isActiveAttackHop
                                ? 'url(#arrow-active-hop)'
                                : link.threat
                                ? 'url(#arrow-threat)'
                                : 'url(#arrow-nominal)'
                            }
                            filter={isActiveAttackHop || link.threat ? 'url(#glow-threat)' : undefined}
                          />

                          {/* Protocol / Port Label midway */}
                          <g transform={`translate(${(srcPos.x + tgtPos.x) / 2}, ${(srcPos.y + tgtPos.y) / 2})`}>
                            <rect
                              x="-34"
                              y="-8"
                              width="68"
                              height="16"
                              rx="4"
                              fill="#0E1015"
                              stroke={isSevered ? '#475569' : link.threat ? '#EF4444' : '#1E293B'}
                              strokeWidth="1"
                            />
                            <text
                              x="0"
                              y="3"
                              textAnchor="middle"
                              fill={isSevered ? '#94A3B8' : link.threat ? '#FCA5A5' : '#94A3B8'}
                              fontSize="8"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {isSevered ? 'SEVERED' : link.protocol?.split(' ')[0] || 'TCP'}
                            </text>
                          </g>
                        </g>
                      );
                    })}
                  </g>

                  {/* Render Nodes */}
                  <g id="topology-nodes">
                    {filteredNodes.map((node, index) => {
                      const coords = getCalculatedNodeCoordinates(node, index, nodes.length);
                      const isSelected = selectedNode?.id === node.id;
                      const isIsolated = isolatedNodeIds.includes(node.id);
                      const isReachableInBlast = blastSimResult?.reachableNodeIds.includes(node.id);

                      // Check if part of active attack hop
                      const isAttackSource = currentAttackStep?.sourceNodeId === node.id;
                      const isAttackTarget = currentAttackStep?.targetNodeId === node.id;

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${coords.x}, ${coords.y})`}
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedNode(node);
                            setActiveSideTool('NODE_INSPECT');
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingNodeId(node.id);
                          }}
                        >
                          {/* Compromised / Active Hop Pulsing Outer Ring */}
                          {(node.compromised || isAttackSource || isAttackTarget) && (
                            <circle
                              r="32"
                              fill="none"
                              stroke={isAttackTarget ? '#EF4444' : isAttackSource ? '#F59E0B' : '#DC2626'}
                              strokeWidth="2"
                              strokeOpacity="0.6"
                              className="animate-ping"
                            />
                          )}

                          {/* Selected Ring */}
                          {isSelected && (
                            <circle
                              r="28"
                              fill="none"
                              stroke="#00E5FF"
                              strokeWidth="2.5"
                              strokeDasharray="4 2"
                              className="animate-spin"
                            />
                          )}

                          {/* Node Base Circle */}
                          <circle
                            r="22"
                            fill={
                              isIsolated
                                ? '#3B0764'
                                : node.threatLevel === 'CRITICAL'
                                ? '#450A0A'
                                : node.threatLevel === 'HIGH'
                                ? '#451A03'
                                : '#0F172A'
                            }
                            stroke={
                              isIsolated
                                ? '#A855F7'
                                : node.threatLevel === 'CRITICAL'
                                ? '#EF4444'
                                : node.threatLevel === 'HIGH'
                                ? '#F59E0B'
                                : '#38BDF8'
                            }
                            strokeWidth={node.compromised ? 2.5 : 1.8}
                            filter={node.threatLevel === 'CRITICAL' ? 'url(#glow-threat)' : undefined}
                          />

                          {/* Node Icon */}
                          <g transform="translate(-10, -10)">
                            {renderNodeIcon(node.type)}
                          </g>

                          {/* Isolation Lock Badge */}
                          {isIsolated && (
                            <g transform="translate(10, -16)">
                              <circle r="8" fill="#7E22CE" stroke="#fff" strokeWidth="1" />
                              <Lock className="w-2.5 h-2.5 text-white -translate-x-1.5 -translate-y-1.5" />
                            </g>
                          )}

                          {/* Node Label & IP */}
                          <text
                            y="34"
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="10"
                            fontFamily="monospace"
                            fontWeight="bold"
                            className="drop-shadow"
                          >
                            {node.label}
                          </text>
                          <text
                            y="46"
                            textAnchor="middle"
                            fill="#94A3B8"
                            fontSize="8"
                            fontFamily="monospace"
                          >
                            {node.ip}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </g>
              </svg>
            </div>
          </div>

          {/* Integrated Attack Path Tracer Module */}
          <AttackPathTracer
            attackPaths={data?.attackPaths || []}
            activePathId={activeAttackPathId}
            onSelectPath={(id) => {
              setActiveAttackPathId(id);
              setActiveAttackStepIndex(0);
            }}
            activeStepIndex={activeAttackStepIndex}
            onSelectStep={(idx) => setActiveAttackStepIndex(idx)}
            isPlaying={isPlayingAttackTrace}
            onTogglePlay={() => setIsPlayingAttackTrace(!isPlayingAttackTrace)}
            playbackSpeed={playbackSpeedMultiplier}
            onChangeSpeed={(spd) => setPlaybackSpeedMultiplier(spd)}
            nodes={nodes}
            onRemediateStep={(step) => {
              handleToggleIsolateNode(step.sourceNodeId);
            }}
            onFocusNode={(nodeId) => {
              const target = nodes.find((n) => n.id === nodeId);
              if (target) {
                setSelectedNode(target);
                setActiveSideTool('NODE_INSPECT');
              }
            }}
          />

          {/* Integrated Blast Radius Simulation Engine */}
          <BlastSimulator
            scenarios={data?.simulationScenarios || []}
            nodes={nodes}
            selectedNodeId={selectedNode?.id || 'node-ws-fin-104'}
            onSelectOriginNode={(id) => {
              const target = nodes.find((n) => n.id === id);
              if (target) setSelectedNode(target);
            }}
            onSimulationUpdate={(result) => setBlastSimResult(result)}
            onApplyMitigationAction={(actionText) => {
              setActionSuccessMessage(`Executed containment command: ${actionText}`);
              setTimeout(() => setActionSuccessMessage(null), 3500);
            }}
          />
        </div>

        {/* Right Column: Dynamic Tool Drawer based on activeSideTool (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Side Tool Switcher */}
          <div className="flex items-center gap-1 bg-[#111318] p-1.5 rounded-xl border border-slate-800 shadow-sm">
            <button
              id="side-tab-node-inspect"
              onClick={() => setActiveSideTool('NODE_INSPECT')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSideTool === 'NODE_INSPECT'
                  ? 'bg-slate-700 text-white shadow-sm border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Asset Details</span>
            </button>

            <button
              id="side-tab-attack-trace"
              onClick={() => {
                setActiveSideTool('ATTACK_PATH');
                if (data?.attackPaths && data.attackPaths.length > 0 && !activeAttackPathId) {
                  setActiveAttackPathId(data.attackPaths[0].id);
                }
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSideTool === 'ATTACK_PATH'
                  ? 'bg-slate-700 text-white shadow-sm border border-red-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 text-red-400" />
              <span>Kill-Chain</span>
            </button>

            <button
              id="side-tab-blast-sim"
              onClick={() => setActiveSideTool('BLAST_SIM')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSideTool === 'BLAST_SIM'
                  ? 'bg-slate-700 text-white shadow-sm border border-orange-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Blast Halo</span>
            </button>
          </div>

          {/* Active Tool Content */}
          {activeSideTool === 'NODE_INSPECT' && (
            selectedNode ? (
              <NodeDetailsDrawer
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onIsolateNode={handleToggleIsolateNode}
                isIsolated={isolatedNodeIds.includes(selectedNode.id)}
                connectedLinks={selectedNodeConnectedLinks}
                onSeverLink={handleToggleSeverLink}
                onSelectConnectedNode={(nodeId) => {
                  const target = nodes.find((n) => n.id === nodeId);
                  if (target) setSelectedNode(target);
                }}
              />
            ) : (
              <div className="bg-[#111318] border border-slate-800 rounded-xl p-4 flex flex-col gap-3 min-h-[360px]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#00E5FF]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Asset Fleet Directory</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{nodes.length} Hosts Active</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Click any asset below or select an SVG node to view OS telemetry, CVE exposure, running daemons, and trigger rapid isolation.
                </p>
                <div className="space-y-1.5 overflow-y-auto max-h-[320px] pr-1">
                  {nodes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedNode(n)}
                      className="w-full text-left p-2 rounded-lg bg-[#161922] hover:bg-[#1C202C] border border-slate-800/80 hover:border-cyan-500/40 transition-all flex items-center justify-between gap-2 text-xs group"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 group-hover:text-white truncate font-mono">{n.label}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{n.ip} • {n.zone}</div>
                      </div>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          n.threatLevel === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400'
                            : n.threatLevel === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {n.threatLevel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          {activeSideTool === 'ATTACK_PATH' && (
            <AttackPathTracer
              attackPaths={data?.attackPaths || []}
              activePathId={activeAttackPathId}
              onSelectPath={(id) => {
                setActiveAttackPathId(id);
                setActiveAttackStepIndex(0);
              }}
              activeStepIndex={activeAttackStepIndex}
              onSelectStep={(idx) => setActiveAttackStepIndex(idx)}
              isPlaying={isPlayingAttackTrace}
              onTogglePlay={() => setIsPlayingAttackTrace(!isPlayingAttackTrace)}
              playbackSpeed={playbackSpeedMultiplier}
              onChangeSpeed={(spd) => setPlaybackSpeedMultiplier(spd)}
              nodes={nodes}
              onRemediateStep={(step) => {
                handleToggleIsolateNode(step.sourceNodeId);
              }}
              onFocusNode={(nodeId) => {
                const target = nodes.find((n) => n.id === nodeId);
                if (target) {
                  setSelectedNode(target);
                  setActiveSideTool('NODE_INSPECT');
                }
              }}
            />
          )}

          {activeSideTool === 'BLAST_SIM' && (
            <BlastSimulator
              scenarios={data?.simulationScenarios || []}
              nodes={nodes}
              selectedNodeId={selectedNode?.id || 'node-ws-fin-104'}
              onSelectOriginNode={(id) => {
                const target = nodes.find((n) => n.id === id);
                if (target) setSelectedNode(target);
              }}
              onSimulationUpdate={(result) => setBlastSimResult(result)}
              onApplyMitigationAction={(actionText) => {
                setActionSuccessMessage(`Executed containment command: ${actionText}`);
                setTimeout(() => setActionSuccessMessage(null), 3500);
              }}
            />
          )}

          {/* Quick Enclave Topology Summary Card */}
          <div className="bg-[#111318] border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Zero-Trust Enclave Layout</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">4 Tier Zones</span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between p-1.5 rounded bg-[#161922] border border-purple-900/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="font-semibold text-white">Zone 0: Crown Jewel Core</span>
                </div>
                <span className="font-mono text-purple-300">2 Assets</span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-[#161922] border border-cyan-900/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="font-semibold text-white">Zone 1: Internal Workloads</span>
                </div>
                <span className="font-mono text-cyan-300">3 Assets</span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-[#161922] border border-amber-900/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="font-semibold text-white">Zone 2: DMZ & Edge</span>
                </div>
                <span className="font-mono text-amber-300">3 Assets</span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-[#161922] border border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="font-semibold text-white">Zone 3: Cloud & Partners</span>
                </div>
                <span className="font-mono text-slate-300">2 Assets</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Threat Export Modal */}
      {data && (
        <ThreatExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          graphData={data}
        />
      )}
    </div>
  );
};
