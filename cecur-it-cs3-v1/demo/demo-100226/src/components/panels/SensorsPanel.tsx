import React, { useState } from 'react';
import {
  Radio,
  RefreshCw,
  Power,
  Activity,
  Cpu,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  Server,
  Zap,
  Sliders,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { SensorNode } from '../../types';

interface SensorsPanelProps {
  sensors: SensorNode[];
  onRefresh?: () => void;
}

export const SensorsPanel: React.FC<SensorsPanelProps> = ({ sensors, onRefresh }) => {
  const { canPerformAction, user } = useAuth();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ id: string; text: string } | null>(null);

  const handleCalibrate = async (sensor: SensorNode) => {
    setActionInProgress(sensor.id);
    setStatusMsg(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string; sensor: SensorNode }>(
        `/api/sensors/${sensor.id}/calibrate`,
        { method: 'POST' }
      );
      setStatusMsg({ id: sensor.id, text: res.message });
      setTimeout(() => setStatusMsg(null), 3000);
      onRefresh?.();
    } catch (err: any) {
      alert(err.message || 'Calibration failed');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReboot = async (sensor: SensorNode) => {
    if (!confirm(`Confirm hard reboot sequence for sensor node ${sensor.name}?`)) return;
    setActionInProgress(sensor.id);
    setStatusMsg(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string; sensor: SensorNode }>(
        `/api/sensors/${sensor.id}/reboot`,
        { method: 'POST' }
      );
      setStatusMsg({ id: sensor.id, text: res.message });
      setTimeout(() => setStatusMsg(null), 3000);
      onRefresh?.();
    } catch (err: any) {
      alert(err.message || 'Reboot failed');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div id="panel-sensors" className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1A3959]">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#00E5FF]" />
            <h1 className="text-xl font-sans font-extrabold text-[#FFFFFF] uppercase tracking-wide">
              CS3 Distributed Sensor Grid
            </h1>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Real-time packet inspection nodes, DMZ mirrors, database enclaves, and OT/SCADA telemetry taps.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] bg-[#0C1B2B] border border-[#1A3959] px-3 py-1.5 rounded shadow-xs">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-[#FFFFFF]">Continuous Sampling Loop</span>
        </div>
      </div>

      {/* Sensor Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sensors.map((sensor) => {
          const isBusy = actionInProgress === sensor.id;
          const msg = statusMsg?.id === sensor.id ? statusMsg.text : null;

          return (
            <div
              key={sensor.id}
              className="p-5 app-card space-y-4 shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          sensor.status === 'ONLINE'
                            ? 'bg-emerald-400 animate-pulse'
                            : sensor.status === 'DEGRADED'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                      />
                      <h2 className="text-sm font-sans font-extrabold text-[#FFFFFF] truncate">{sensor.name}</h2>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] font-mono mt-0.5">{sensor.location}</p>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                      sensor.status === 'ONLINE'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : sensor.status === 'DEGRADED'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {sensor.status}
                  </span>
                </div>

                {/* Primary Metrics Box */}
                <div className="p-3 bg-[#12283E] rounded border border-[#1A3959] grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] font-sans font-bold text-[#94A3B8] uppercase">Throughput</div>
                    <div className="text-base font-mono font-extrabold text-[#FFFFFF]">
                      {sensor.packetRate.toLocaleString()} <span className="text-[10px] font-normal text-[#94A3B8]">p/s</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-sans font-bold text-[#94A3B8] uppercase">Packet Loss</div>
                    <div
                      className={`text-base font-mono font-extrabold ${
                        sensor.droppedPackets > 1.0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {sensor.droppedPackets.toFixed(2)}%
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-sans font-bold text-[#94A3B8] uppercase">Jitter</div>
                    <div className="text-xs font-mono text-[#FFFFFF] font-semibold">{sensor.jitterMs.toFixed(2)} ms</div>
                  </div>

                  <div>
                    <div className="text-[10px] font-sans font-bold text-[#94A3B8] uppercase">Anomaly Rate</div>
                    <div
                      className={`text-xs font-mono font-extrabold ${
                        sensor.anomalyRate > 2.0 ? 'text-rose-400' : 'text-[#FFFFFF]'
                      }`}
                    >
                      {sensor.anomalyRate.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Hardware Resource Usage */}
                <div className="space-y-1.5 text-xs text-[#94A3B8] font-mono">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span>CPU: {sensor.cpuUsage}%</span>
                    <span>MEM: {sensor.memoryUsage}%</span>
                  </div>
                  <div className="w-full bg-[#12283E] rounded-full h-1.5 overflow-hidden flex border border-[#1A3959]">
                    <div
                      className={`h-full ${sensor.cpuUsage > 80 ? 'bg-rose-500' : 'bg-[#00E5FF]'}`}
                      style={{ width: `${sensor.cpuUsage}%` }}
                    />
                  </div>
                </div>

                <div className="text-[10px] font-mono text-[#94A3B8] flex justify-between pt-1">
                  <span>IP: {sensor.ipAddress}</span>
                  <span>FW: {sensor.firmwareVersion}</span>
                </div>

                {msg && (
                  <div className="p-2 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs rounded font-mono font-bold">
                    {msg}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#1A3959] flex items-center justify-end gap-2">
                {canPerformAction('sensor_calibrate') && (
                  <button
                    onClick={() => handleCalibrate(sensor)}
                    disabled={isBusy}
                    className="px-2.5 py-1 text-xs font-sans font-bold bg-[#12283E] hover:bg-[#1A3959] text-[#FFFFFF] border border-[#1A3959] rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span>Calibrate</span>
                  </button>
                )}

                {canPerformAction('sensor_reboot') && (
                  <button
                    onClick={() => handleReboot(sensor)}
                    disabled={isBusy}
                    className="px-2.5 py-1 text-xs font-sans font-bold bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Reboot Node</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
