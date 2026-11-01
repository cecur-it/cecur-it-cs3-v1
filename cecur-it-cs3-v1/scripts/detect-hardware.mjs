#!/usr/bin/env node
/**
 * scripts/detect-hardware.mjs — probes GPU, VRAM, OS, and available RAM, then
 * recommends a model tier from onboarding/models.json (Entry / Frontier /
 * Agentic). Works on Linux, macOS (Apple Silicon), and Windows using only
 * platform-native CLI tools (nvidia-smi, system_profiler, PowerShell/CIM) —
 * no third-party dependencies.
 *
 * Usage:
 *   node scripts/detect-hardware.mjs            # human-readable report
 *   node scripts/detect-hardware.mjs --json     # machine-readable JSON only
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_JSON_PATH = path.join(__dirname, '..', 'onboarding', 'models.json');

function bytesToGb(bytes) {
  return Math.round((bytes / 1024 ** 3) * 10) / 10;
}

function tryExec(cmd, cmdArgs) {
  try {
    return execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** NVIDIA GPUs on Linux/Windows via nvidia-smi (installed with the driver, not CUDA toolkit). */
function detectNvidiaGpus() {
  const out = tryExec('nvidia-smi', [
    '--query-gpu=name,memory.total',
    '--format=csv,noheader,nounits',
  ]);
  if (!out) return [];
  return out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((s) => s.trim());
      const name = parts[0];
      const vramMb = Number(parts[1]);
      return { name, vramGb: Number.isFinite(vramMb) ? Math.round(vramMb / 1024) : null, backend: 'cuda' };
    });
}

/** Best-effort GPU listing on Linux without an NVIDIA driver present. */
function detectLinuxPciGpus() {
  const out = tryExec('lspci', ['-mm']);
  if (!out) return [];
  return out
    .split(/\r?\n/)
    .filter((l) => /VGA compatible controller|3D controller/i.test(l))
    .map((l) => ({ name: l, vramGb: null, backend: 'unknown' }));
}

/** Apple Silicon reports a unified memory pool shared between CPU and GPU. */
function detectAppleSiliconGpu() {
  const isAppleSilicon = os.arch() === 'arm64';
  const out = tryExec('system_profiler', ['SPDisplaysDataType', '-json']);
  let chipsetModel = isAppleSilicon ? 'Apple Silicon GPU (unified memory)' : 'Unknown';
  try {
    if (out) {
      const parsed = JSON.parse(out);
      const displays = parsed.SPDisplaysDataType || [];
      if (displays[0]?.sppci_model) chipsetModel = displays[0].sppci_model;
    }
  } catch {
    // Fall back to the generic label above.
  }
  return [
    {
      name: chipsetModel,
      vramGb: isAppleSilicon ? bytesToGb(os.totalmem()) : null,
      backend: isAppleSilicon ? 'metal-unified-memory' : 'metal',
      unifiedMemory: isAppleSilicon,
    },
  ];
}

/** Windows GPUs via CIM/WMI (AdapterRAM is unreliable above 4 GB on some drivers — noted). */
function detectWindowsGpus() {
  const psCommand =
    'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json';
  const out =
    tryExec('powershell.exe', ['-NoProfile', '-Command', psCommand]) ||
    tryExec('pwsh', ['-NoProfile', '-Command', psCommand]);
  if (!out) return [];
  try {
    const parsed = JSON.parse(out);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((gpu) => ({
      name: gpu.Name,
      vramGb: typeof gpu.AdapterRAM === 'number' && gpu.AdapterRAM > 0 ? bytesToGb(gpu.AdapterRAM) : null,
      backend: 'directml-or-cuda',
      note: 'AdapterRAM via WMI can under-report VRAM above 4GB on some driver stacks; cross-check with vendor tooling (nvidia-smi, dxdiag) if this looks wrong.',
    }));
  } catch {
    return [];
  }
}

function detectGpus(platform) {
  if (platform === 'linux') {
    const nvidia = detectNvidiaGpus();
    if (nvidia.length > 0) return nvidia;
    return detectLinuxPciGpus();
  }
  if (platform === 'darwin') {
    const nvidia = detectNvidiaGpus(); // eGPU / rare CUDA-on-mac setups
    if (nvidia.length > 0) return nvidia;
    return detectAppleSiliconGpu();
  }
  if (platform === 'win32') {
    const nvidia = detectNvidiaGpus();
    if (nvidia.length > 0) return nvidia;
    return detectWindowsGpus();
  }
  return [];
}

function loadModelsRegistry() {
  try {
    return JSON.parse(fs.readFileSync(MODELS_JSON_PATH, 'utf8'));
  } catch {
    return { tiers: {}, models: [] };
  }
}

/** Recommend the highest tier the detected hardware satisfies. Exported for
 *  scripts/detect-hardware.test.mjs. */
export function recommendTier(registry, maxVramGb, totalRamGb) {
  const tierOrder = ['agentic', 'frontier', 'entry'];
  const results = [];
  for (const tierName of tierOrder) {
    const tier = registry.tiers?.[tierName];
    if (!tier) continue;
    const tierModels = (registry.models || []).filter((m) => tier.models.includes(m.id));
    const meets = tierModels.every(
      (m) => (maxVramGb === null || maxVramGb >= m.minVramGb) && totalRamGb >= (m.minSystemRamGb || 0),
    );
    results.push({ tier: tierName, label: tier.label, models: tier.models, meets });
    if (meets) {
      return { recommended: tierName, label: tier.label, evaluated: results };
    }
  }
  return { recommended: 'entry', label: registry.tiers?.entry?.label || 'Entry', evaluated: results, fallback: true };
}

export function detectHardware() {
  const platform = os.platform();
  const arch = os.arch();
  const totalRamGb = bytesToGb(os.totalmem());
  const freeRamGb = bytesToGb(os.freemem());
  const cpuCount = os.cpus()?.length || 0;
  const gpus = detectGpus(platform);
  const maxVramGb = gpus.reduce((max, g) => (g.vramGb && g.vramGb > (max ?? 0) ? g.vramGb : max), null);
  const registry = loadModelsRegistry();
  const recommendation = recommendTier(registry, maxVramGb, totalRamGb);

  return {
    platform,
    arch,
    hostname: os.hostname(),
    cpuCount,
    totalRamGb,
    freeRamGb,
    gpus,
    maxVramGb,
    recommendation,
  };
}

function printHumanReport(report) {
  process.stdout.write('\n=== CS3 Hardware Detection ===\n');
  process.stdout.write(`Platform:      ${report.platform} (${report.arch})\n`);
  process.stdout.write(`CPU cores:     ${report.cpuCount}\n`);
  process.stdout.write(`System RAM:    ${report.totalRamGb} GB total / ${report.freeRamGb} GB free\n`);
  if (report.gpus.length === 0) {
    process.stdout.write('GPU:           none detected\n');
  } else {
    for (const gpu of report.gpus) {
      process.stdout.write(
        `GPU:           ${gpu.name}${gpu.vramGb ? ` — ${gpu.vramGb} GB VRAM` : ' — VRAM unknown'} (${gpu.backend})\n`,
      );
      if (gpu.note) process.stdout.write(`               note: ${gpu.note}\n`);
    }
  }
  process.stdout.write(`\nRecommended tier: ${report.recommendation.label} (${report.recommendation.recommended})\n`);
  if (report.recommendation.fallback) {
    process.stdout.write('  (No tier fully satisfied by detected hardware — defaulting to Entry; expect reduced performance or OOM on larger models.)\n');
  }
  process.stdout.write('===============================\n\n');
}

const isMain = (() => {
  try {
    return import.meta.url === new URL(`file://${path.resolve(process.argv[1] || '')}`).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  const report = detectHardware();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printHumanReport(report);
  }
}
