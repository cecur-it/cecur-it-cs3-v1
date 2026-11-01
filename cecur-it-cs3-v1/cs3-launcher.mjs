#!/usr/bin/env node
/**
 * cs3-launcher.mjs — the single entry point for the CS3 Platform installer.
 *
 * An operator only ever invokes this file:
 *
 *   node cs3-launcher.mjs --profile <cloud|onprem|airgap> [--bundle <path>]
 *
 * Responsibilities, in strict order:
 *   1. Parse --profile / --bundle and fail closed if prerequisites for the
 *      selected profile are not met (missing bundle in airgap, missing API
 *      keys in cloud, etc.) — see checkPrerequisites() and enforceIsolation().
 *   2. For airgap, verify the bundle (scripts/verify-bundle.mjs) BEFORE doing
 *      anything else. A hash or release-tag mismatch aborts the run.
 *   3. Dispatch to the onboarding wizard (onboarding/wizard.mjs) to populate
 *      .env from the profile-specific template.
 *   4. Invoke the OS-specific installer script for the current platform
 *      (install.sh on Linux, install.command on macOS, install.ps1 on
 *      Windows) to perform OS-level provisioning.
 *   5. Run post-install health checks and print a summary report.
 *
 * No third-party dependencies — Node.js core modules only.
 */

import { spawnSync } from 'node:child_process';
import { Socket } from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALID_PROFILES = ['cloud', 'onprem', 'airgap'];
const ENV_PATH = path.join(__dirname, '.env');
const WIZARD_CONFIG_PATH = path.join(__dirname, 'onboarding', 'wizard.config.json');
const VERIFY_BUNDLE_SCRIPT = path.join(__dirname, 'scripts', 'verify-bundle.mjs');

class FailClosedError extends Error {}

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function warn(msg) {
  process.stderr.write(`[warn] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[FAIL-CLOSED] ${msg}\n`);
}

function printBanner() {
  const bannerPath = path.join(__dirname, 'onboarding', 'assets', 'banner.txt');
  try {
    log(fs.readFileSync(bannerPath, 'utf8'));
  } catch {
    // Banner is cosmetic only; never block install on a missing asset.
  }
}

function printUsage() {
  log(`Usage: node cs3-launcher.mjs --profile <cloud|onprem|airgap> [--bundle <path>] [options]

Options:
  --profile <name>     Required. One of: cloud, onprem, airgap.
  --bundle <path>      Required for --profile airgap. Path to a pre-staged,
                        checksummed cs3-model-bundle-<version>.tar.
  --non-interactive     Do not prompt; read required values from environment
                        variables and fail closed if any are missing.
  --skip-wizard         Skip the onboarding wizard (assumes .env already
                        populated for the selected profile). Not recommended.
  --skip-install        Skip the OS-specific installer script step.
  --skip-health         Skip post-install health checks.
  -h, --help            Show this help message.
`);
}

function parseArgs(argv) {
  const args = {
    profile: null,
    bundle: null,
    nonInteractive: false,
    skipWizard: false,
    skipInstall: false,
    skipHealth: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--profile':
        args.profile = argv[++i] ?? null;
        break;
      case '--bundle':
        args.bundle = argv[++i] ?? null;
        break;
      case '--non-interactive':
        args.nonInteractive = true;
        break;
      case '--skip-wizard':
        args.skipWizard = true;
        break;
      case '--skip-install':
        args.skipInstall = true;
        break;
      case '--skip-health':
        args.skipHealth = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      default:
        warn(`Ignoring unrecognized argument: ${arg}`);
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseEnvText(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    values[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return values;
}

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return {};
  return parseEnvText(fs.readFileSync(ENV_PATH, 'utf8'));
}

/** Step 1: validate --profile before touching anything else (fail closed). */
function checkPrerequisites(args) {
  if (args.help) {
    printUsage();
    process.exit(0);
  }
  if (!args.profile) {
    printUsage();
    throw new FailClosedError('--profile is required (cloud | onprem | airgap).');
  }
  if (!VALID_PROFILES.includes(args.profile)) {
    throw new FailClosedError(
      `Unknown --profile '${args.profile}'. Must be one of: ${VALID_PROFILES.join(', ')}.`,
    );
  }
  if (args.profile === 'airgap' && !args.bundle) {
    throw new FailClosedError(
      '--profile airgap requires --bundle <path-to-verified-bundle>. Refusing to proceed without a pre-staged, checksummed model bundle.',
    );
  }
  if (args.profile === 'airgap' && !fs.existsSync(args.bundle)) {
    throw new FailClosedError(`Bundle path does not exist: ${args.bundle}`);
  }
}

/**
 * Step 2 (airgap only): verify the bundle BEFORE doing anything else.
 * Refuses to proceed on hash mismatch, per the non-negotiable requirement.
 */
function verifyAirgapBundle(bundlePath) {
  log(`\n[cs3-launcher] Verifying air-gap bundle before proceeding: ${bundlePath}`);
  const result = spawnSync(
    process.execPath,
    [VERIFY_BUNDLE_SCRIPT, '--bundle', bundlePath, '--verbose'],
    { encoding: 'utf8' },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new FailClosedError(
      'scripts/verify-bundle.mjs reported a failure (hash mismatch, missing checksum, or release-tag cross-check failure). Refusing to proceed.',
    );
  }
  let parsed = null;
  try {
    // --verbose makes verify-bundle.mjs emit exactly one pretty-printed JSON
    // object as its entire stdout, so parse from the first '{' to the last
    // '}' rather than assuming the object fits on a single line.
    const start = result.stdout.indexOf('{');
    const end = result.stdout.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      parsed = JSON.parse(result.stdout.slice(start, end + 1));
    }
  } catch {
    // Non-fatal: the human-readable PASS above already gates progress.
  }
  return parsed;
}

/** Step 3: run the onboarding wizard for the selected profile. */
async function runOnboardingWizard(profile, args, bundleInfo) {
  if (args.skipWizard) {
    warn('Skipping onboarding wizard (--skip-wizard). Assuming .env is already populated.');
    return;
  }
  log(`\n[cs3-launcher] Launching onboarding wizard for profile: ${profile}`);
  const wizardMod = await import(path.join(__dirname, 'onboarding', 'wizard.mjs'));
  await wizardMod.runWizard(profile, {
    repoRoot: __dirname,
    bundlePath: args.bundle,
    bundleInfo,
    nonInteractive: args.nonInteractive || !process.stdin.isTTY,
  });
}

/**
 * Enforce strict profile isolation: an operator must not be able to mix
 * profiles. Checks the freshly written .env against wizard.config.json's
 * `forbidden` and `requiredForLaunch` lists for the selected profile.
 */
function enforceIsolation(profile) {
  const config = readJson(WIZARD_CONFIG_PATH);
  const profileConfig = config.profiles[profile];
  if (!profileConfig) {
    throw new FailClosedError(`No wizard configuration found for profile '${profile}'.`);
  }
  const env = readEnvFile();

  const leaked = (profileConfig.forbidden || []).filter((key) => (env[key] || '').trim() !== '');
  if (leaked.length > 0) {
    throw new FailClosedError(
      `.env contains values for keys that are forbidden on profile '${profile}': ${leaked.join(', ')}. ` +
        'This would mix profiles (e.g. cloud API keys inside an airgap/onprem .env). Refusing to proceed.',
    );
  }

  const missing = (profileConfig.requiredForLaunch || []).filter(
    (key) => (env[key] || '').trim() === '',
  );
  if (missing.length > 0) {
    throw new FailClosedError(
      `.env is missing required values for profile '${profile}': ${missing.join(', ')}. Refusing to proceed.`,
    );
  }

  if (profile === 'airgap') {
    const expected = (env.CS3_AIRGAP_BUNDLE_SHA256 || '').toLowerCase();
    if (!expected) {
      throw new FailClosedError('CS3_AIRGAP_BUNDLE_SHA256 was not recorded by the wizard/verify step.');
    }
  }

  return { config: profileConfig, env };
}

/** Step 4: invoke the OS-specific installer script. */
function runOsInstaller(profile, args) {
  if (args.skipInstall) {
    warn('Skipping OS-specific installer script (--skip-install).');
    return;
  }
  const platform = os.platform();
  let command;
  let scriptArgs;

  if (platform === 'linux') {
    command = 'bash';
    scriptArgs = [path.join(__dirname, 'install.sh'), '--profile', profile];
  } else if (platform === 'darwin') {
    command = 'bash';
    scriptArgs = [path.join(__dirname, 'install.command'), '--profile', profile];
  } else if (platform === 'win32') {
    command = process.env.CS3_PWSH_BIN || 'powershell.exe';
    scriptArgs = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(__dirname, 'install.ps1'),
      '-Profile',
      profile,
    ];
  } else {
    throw new FailClosedError(`Unsupported platform: ${platform}`);
  }

  if (args.bundle) {
    scriptArgs.push(platform === 'win32' ? '-Bundle' : '--bundle', args.bundle);
  }

  log(`\n[cs3-launcher] Running OS-specific installer for ${platform}: ${scriptArgs.join(' ')}`);
  const result = spawnSync(command, scriptArgs, { stdio: 'inherit', cwd: __dirname });
  if (result.error) {
    throw new FailClosedError(`Failed to launch OS-specific installer: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new FailClosedError(`OS-specific installer exited with status ${result.status}.`);
  }
}

/** Best-effort TCP reachability probe with a short timeout, used by health checks. */
function probeTcp(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const client = new Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      client.destroy();
      resolve(ok);
    };
    client.setTimeout(timeoutMs);
    client.once('connect', () => finish(true));
    client.once('timeout', () => finish(false));
    client.once('error', () => finish(false));
    client.connect(port, host);
  });
}

function httpGet(urlStr, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(urlStr, { timeout: timeoutMs }, (res) => {
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, statusCode: res.statusCode });
      res.resume();
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, statusCode: null });
    });
    req.on('error', () => resolve({ ok: false, statusCode: null }));
  });
}

/** Step 5: post-install health checks (profile-aware). */
async function runHealthChecks(profile, args) {
  if (args.skipHealth) {
    warn('Skipping post-install health checks (--skip-health).');
    return true;
  }
  log(`\n[cs3-launcher] Running post-install health checks for profile: ${profile}`);
  const env = readEnvFile();
  const checks = [];

  const consolePort = Number(env.CS3_CONSOLE_PORT || 3000);
  const consoleHealth = await httpGet(`http://127.0.0.1:${consolePort}/api/health`);
  checks.push({
    name: 'CS3 ESOC Console reachable',
    ok: consoleHealth.ok,
    detail: consoleHealth.ok
      ? `HTTP ${consoleHealth.statusCode}`
      : 'Not reachable yet (container may still be starting, or this is a dry-run environment).',
  });

  if (profile === 'onprem' || profile === 'airgap') {
    const ollamaUp = await probeTcp('127.0.0.1', 11434);
    checks.push({
      name: 'Local Ollama endpoint bound to loopback',
      ok: ollamaUp,
      detail: ollamaUp ? 'Listening on 127.0.0.1:11434' : 'Not reachable on 127.0.0.1:11434',
    });
  }

  if (profile === 'airgap') {
    const result = spawnSync(process.execPath, [VERIFY_BUNDLE_SCRIPT, '--status', '--verbose'], {
      encoding: 'utf8',
    });
    let statusOk = result.status === 0;
    checks.push({
      name: 'Air-gap bundle status recorded (no registry pull attempted)',
      ok: statusOk,
      detail: statusOk ? 'verify-bundle.mjs --status confirms verified bundle in place' : 'No verified bundle status found',
    });
  }

  if (profile === 'cloud') {
    checks.push({
      name: 'Telemetry/update checks enabled (expected for cloud)',
      ok: env.CS3_TELEMETRY_ENABLED === 'true',
      detail: `CS3_TELEMETRY_ENABLED=${env.CS3_TELEMETRY_ENABLED}`,
    });
  } else if (profile === 'airgap') {
    checks.push({
      name: 'Telemetry/update checks disabled (required for airgap)',
      ok: env.CS3_TELEMETRY_ENABLED === 'false' && env.CS3_UPDATE_CHECK_ENABLED === 'false',
      detail: `CS3_TELEMETRY_ENABLED=${env.CS3_TELEMETRY_ENABLED}, CS3_UPDATE_CHECK_ENABLED=${env.CS3_UPDATE_CHECK_ENABLED}`,
    });
  }

  log('\n--- Health check summary ---');
  let allOk = true;
  for (const check of checks) {
    const status = check.ok ? 'PASS' : 'WARN';
    if (!check.ok) allOk = false;
    log(`[${status}] ${check.name} — ${check.detail}`);
  }
  log('----------------------------\n');
  return allOk;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  printBanner();
  checkPrerequisites(args);

  let bundleInfo = null;
  if (args.profile === 'airgap') {
    // SECURITY (fail loud, not silent): arm the network-egress guard before
    // ANY airgap work, including bundle verification and the case where
    // --skip-wizard bypasses onboarding/wizard.mjs entirely. Reusing
    // wizard.mjs's guard (rather than re-implementing it here) keeps the
    // egress allow-list (loopback only) defined in exactly one place.
    const wizardMod = await import(path.join(__dirname, 'onboarding', 'wizard.mjs'));
    wizardMod.installAirgapEgressGuard();
    bundleInfo = verifyAirgapBundle(args.bundle);
  }

  await runOnboardingWizard(args.profile, args, bundleInfo);
  enforceIsolation(args.profile);
  runOsInstaller(args.profile, args);
  const healthy = await runHealthChecks(args.profile, args);

  log(`[cs3-launcher] Profile '${args.profile}' install complete.`);
  if (!healthy) {
    warn('One or more post-install health checks did not pass. Review the summary above.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  if (err instanceof FailClosedError) {
    fail(err.message);
  } else {
    fail(err.stack || String(err));
  }
  process.exitCode = 1;
});
