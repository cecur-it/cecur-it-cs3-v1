#!/usr/bin/env node
/**
 * onboarding/wizard.mjs — populates .env from the profile-specific template
 * and prompts only for the fields valid on that profile.
 *
 * Invoked by cs3-launcher.mjs via runWizard(), but can also run standalone:
 *
 *   node onboarding/wizard.mjs --profile <cloud|onprem|airgap> [--non-interactive]
 *
 * Security invariants enforced here (not just documented):
 *   - Only prompts for the keys listed under profiles.<profile>.prompts in
 *     wizard.config.json.
 *   - Force-blanks every key listed under profiles.<profile>.forbidden,
 *     regardless of any preset environment variable or prior .env content —
 *     an operator cannot smuggle cloud API keys into an airgap/onprem .env.
 *   - Secret-flagged prompts are read with terminal echo disabled.
 *   - .env is written with 0600 permissions (best effort; ignored on
 *     platforms/filesystems that do not support POSIX permission bits).
 *   - For the airgap profile, installAirgapEgressGuard() is armed before any
 *     other work happens: the air-gap profile must never make an outbound
 *     network call, and this guard fails LOUDLY (aborts the process) the
 *     instant one is attempted rather than silently allowing or ignoring it.
 */

import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(__dirname);

// Hostnames/addresses that are never considered "outbound" for the purposes
// of the air-gap egress guard below. `null`/undefined is included because
// Node treats a missing host as an implicit 127.0.0.1.
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost', '0.0.0.0']);

function isLoopbackHost(host) {
  if (host == null || host === '') return true;
  const h = String(host).toLowerCase();
  return LOOPBACK_HOSTS.has(h) || h.startsWith('127.');
}

/** Best-effort extraction of the target host from the various net/tls.connect() call shapes. */
function extractHost(connectArgs) {
  const [first, second] = connectArgs;
  if (first !== null && typeof first === 'object') {
    if (first.path) return null; // UNIX domain socket — local IPC, not network egress.
    return first.host ?? first.hostname ?? null;
  }
  if (typeof first === 'number' && typeof second === 'string') {
    return second;
  }
  return null; // string path, bare port with no host, etc. — not a remote hostname.
}

let egressGuardInstalled = false;

/**
 * SECURITY (fail loud, not silent): arms an in-process network-egress guard
 * for the airgap profile. This is defense in depth on top of the physical
 * air gap, not a replacement for it — it monkey-patches the low-level
 * socket/DNS entry points that node:http, node:https, and the global
 * fetch()/undici implementation all funnel through, so that ANY attempt to
 * reach a non-loopback destination during an airgap run halts the process
 * immediately with a clear message, instead of degrading gracefully or
 * completing a call the operator never sees. Loopback traffic (the local
 * Ollama endpoint, the local console) remains explicitly allowed.
 */
export function installAirgapEgressGuard() {
  if (egressGuardInstalled) return;
  egressGuardInstalled = true;

  const blockEgress = (host, port, label) => {
    process.stderr.write(
      `\n[FAIL-CLOSED] Blocked outbound network attempt during airgap profile: ` +
        `${label} -> ${host ?? '(unresolved host)'}${port ? `:${port}` : ''}. ` +
        'The airgap profile must never make an outbound network call. Refusing to proceed.\n',
    );
    process.exit(1);
  };

  const origSocketConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function guardedSocketConnect(...args) {
    const host = extractHost(args);
    if (!isLoopbackHost(host)) {
      blockEgress(host, typeof args[0] === 'number' ? args[0] : args[0]?.port, 'net.Socket.connect');
      return this;
    }
    return origSocketConnect.apply(this, args);
  };

  const origNetConnect = net.connect;
  const guardedNetConnect = function guardedNetConnectFn(...args) {
    const host = extractHost(args);
    if (!isLoopbackHost(host)) {
      blockEgress(host, typeof args[0] === 'number' ? args[0] : args[0]?.port, 'net.connect');
      return new net.Socket();
    }
    return origNetConnect.apply(this, args);
  };
  net.connect = guardedNetConnect;
  net.createConnection = guardedNetConnect;

  const origTlsConnect = tls.connect;
  tls.connect = function guardedTlsConnect(...args) {
    const host = extractHost(args);
    if (!isLoopbackHost(host)) {
      blockEgress(host, typeof args[0] === 'number' ? args[0] : args[0]?.port, 'tls.connect');
      return new net.Socket();
    }
    return origTlsConnect.apply(this, args);
  };

  // Cheap defense against DNS-only exfiltration (no socket ever opens, but a
  // resolver query still leaves the host) — scoped to the two entry points
  // net.connect()/fetch() actually use for hostname resolution.
  if (typeof dns.lookup === 'function') {
    const origLookup = dns.lookup;
    dns.lookup = function guardedLookup(hostname, ...rest) {
      if (!isLoopbackHost(hostname)) {
        blockEgress(hostname, null, 'dns.lookup');
        return;
      }
      return origLookup.call(dns, hostname, ...rest);
    };
  }

  if (typeof globalThis.fetch === 'function') {
    const origFetch = globalThis.fetch;
    globalThis.fetch = function guardedFetch(input, init) {
      let url = null;
      try {
        url = new URL(typeof input === 'string' ? input : input?.url ?? String(input));
      } catch {
        // Non-URL input (e.g. a Request already carrying an invalid URL) —
        // treat as blocked below rather than letting it slip through.
      }
      if (!url || !isLoopbackHost(url.hostname)) {
        blockEgress(url?.hostname ?? String(input), url?.port, 'fetch()');
        return Promise.reject(new Error('blocked by airgap egress guard'));
      }
      return origFetch.call(this, input, init);
    };
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function loadWizardConfig() {
  return readJson(path.join(__dirname, 'wizard.config.json'));
}

function loadModelsRegistry() {
  try {
    return readJson(path.join(__dirname, 'models.json'));
  } catch {
    return { models: [] };
  }
}

function parseEnvTemplate(text) {
  // Preserve the template verbatim (comments included); only rewrite the
  // value portion of KEY=VALUE lines we know about.
  return text.split(/\r?\n/);
}

function setEnvLine(lines, key, value) {
  const prefix = `${key}=`;
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(prefix)) {
      found = true;
      return `${prefix}${value ?? ''}`;
    }
    return line;
  });
  if (!found) {
    next.push(`${prefix}${value ?? ''}`);
  }
  return next;
}

/** Masked prompt for secret values; falls back to visible input on non-TTY streams. */
function question(rl, message, { secret = false } = {}) {
  const input = rl.input;
  const isTty = Boolean(input.isTTY);
  if (!secret || !isTty) {
    return new Promise((resolve) => rl.question(`${message}: `, resolve));
  }

  return new Promise((resolve) => {
    process.stdout.write(`${message} (input hidden): `);
    let value = '';
    const onData = (chunk) => {
      const str = chunk.toString('utf8');
      for (const ch of str) {
        if (ch === '\n' || ch === '\r') {
          input.removeListener('data', onData);
          input.setRawMode?.(false);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          // Ctrl+C
          process.stdout.write('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      }
    };
    input.setRawMode?.(true);
    input.resume();
    input.on('data', onData);
  });
}

async function promptForProfile(profile, profileConfig, { nonInteractive }) {
  const answers = {};
  const unmet = [];
  const models = loadModelsRegistry().models || [];
  const knownModelIds = new Set(models.map((m) => m.id));

  let rl = null;
  if (!nonInteractive) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  }

  for (const prompt of profileConfig.prompts || []) {
    let value;
    if (nonInteractive) {
      value = process.env[prompt.key] ?? prompt.default ?? '';
    } else {
      const label = prompt.default ? `${prompt.message} [${prompt.default}]` : prompt.message;
      const raw = await question(rl, label, { secret: prompt.secret });
      value = raw.trim() === '' ? (prompt.default ?? '') : raw.trim();
    }

    if (prompt.key.startsWith('OLLAMA_') && prompt.key.endsWith('_MODEL') && value && !knownModelIds.has(value)) {
      process.stderr.write(
        `[warn] '${value}' is not listed in onboarding/models.json as an approved model tag.\n`,
      );
    }

    if (prompt.required && (!value || value.trim() === '')) {
      unmet.push(prompt.key);
    }
    answers[prompt.key] = value;
  }

  if (rl) rl.close();
  return { answers, unmet };
}

function writeEnvAtomic(envPath, contents) {
  const tmpPath = `${envPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, contents, { mode: 0o600 });
  fs.renameSync(tmpPath, envPath);
  try {
    fs.chmodSync(envPath, 0o600);
  } catch {
    // Best effort — some filesystems (e.g. certain Windows volumes) ignore POSIX modes.
  }
}

function printAsset(relPath) {
  try {
    process.stdout.write(`${fs.readFileSync(path.join(__dirname, relPath), 'utf8')}\n`);
  } catch {
    // Cosmetic only.
  }
}

/**
 * Populate .env for `profile` from onboarding/env.<profile>.template.
 *
 * @param {'cloud'|'onprem'|'airgap'} profile
 * @param {object} options
 * @param {string} [options.repoRoot]
 * @param {string} [options.bundlePath] path to a verified airgap bundle
 * @param {object} [options.bundleInfo] parsed --verbose output from verify-bundle.mjs
 * @param {boolean} [options.nonInteractive]
 */
export async function runWizard(profile, options = {}) {
  // Arm the egress guard BEFORE any other airgap work — see
  // installAirgapEgressGuard() docstring for why this must fail loud.
  if (profile === 'airgap') {
    installAirgapEgressGuard();
  }

  const repoRoot = options.repoRoot || REPO_ROOT;
  const config = loadWizardConfig();
  const profileConfig = config.profiles[profile];
  if (!profileConfig) {
    throw new Error(`No wizard configuration for profile '${profile}'.`);
  }

  if (!options.nonInteractive) {
    printAsset(path.join('assets', 'welcome.md'));
  }
  process.stdout.write(`\n[wizard] Profile: ${profileConfig.label} (${profile})\n`);

  const templatePath = path.join(__dirname, profileConfig.template);
  const templateText = fs.readFileSync(templatePath, 'utf8');
  let lines = parseEnvTemplate(templateText);

  const { answers, unmet } = await promptForProfile(profile, profileConfig, {
    nonInteractive: options.nonInteractive,
  });

  for (const [key, value] of Object.entries(answers)) {
    lines = setEnvLine(lines, key, value);
  }

  // Airgap: record the verified bundle's hash/tag so cs3-launcher.mjs can
  // cross-check them again at enforceIsolation() time.
  if (profile === 'airgap') {
    const sha256 = options.bundleInfo?.sha256Actual || options.bundleInfo?.sha256 || '';
    const releaseTag = options.bundleInfo?.releaseTagBundle || options.bundleInfo?.releaseTag || '';
    lines = setEnvLine(lines, 'CS3_AIRGAP_BUNDLE_SHA256', sha256);
    lines = setEnvLine(lines, 'CS3_AIRGAP_BUNDLE_TAG', releaseTag);
  }

  // Generate a unique JWT signing secret when the template/answers left it blank.
  if (!lines.some((l) => /^JWT_SECRET=.+/.test(l))) {
    lines = setEnvLine(lines, 'JWT_SECRET', randomBytes(32).toString('hex'));
  }

  // Bootstrap admin: non-demo deployments are not seeded with default accounts,
  // so generate a one-time admin password (change it after first login).
  if (!lines.some((l) => /^CS3_BOOTSTRAP_ADMIN_PASSWORD=.+/.test(l))) {
    lines = setEnvLine(lines, 'CS3_BOOTSTRAP_ADMIN_PASSWORD', randomBytes(16).toString('hex'));
  }

  // Defense in depth: force-blank every forbidden key regardless of source,
  // even if it was somehow present in process.env or an existing .env.
  for (const key of profileConfig.forbidden || []) {
    lines = setEnvLine(lines, key, '');
  }

  const envPath = path.join(repoRoot, '.env');
  writeEnvAtomic(envPath, lines.join(os.EOL) + os.EOL);

  if (unmet.length > 0) {
    process.stderr.write(
      `[wizard] The following required values were left blank: ${unmet.join(', ')}. ` +
        'cs3-launcher.mjs will fail closed before starting any service.\n',
    );
  }

  process.stdout.write(`[wizard] Wrote ${envPath}\n`);
  return { envPath, answers, unmet };
}

function parseCliArgs(argv) {
  const args = { profile: null, bundle: null, nonInteractive: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--profile':
        args.profile = argv[++i];
        break;
      case '--bundle':
        args.bundle = argv[++i];
        break;
      case '--non-interactive':
        args.nonInteractive = true;
        break;
      default:
        break;
    }
  }
  return args;
}

const isMain = (() => {
  try {
    return import.meta.url === new URL(`file://${path.resolve(process.argv[1] || '')}`).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.profile) {
    process.stderr.write('Usage: node onboarding/wizard.mjs --profile <cloud|onprem|airgap> [--non-interactive]\n');
    process.exit(1);
  }
  runWizard(args.profile, {
    bundlePath: args.bundle,
    nonInteractive: args.nonInteractive || !process.stdin.isTTY,
  }).catch((err) => {
    process.stderr.write(`${err.stack || err}\n`);
    process.exit(1);
  });
}
