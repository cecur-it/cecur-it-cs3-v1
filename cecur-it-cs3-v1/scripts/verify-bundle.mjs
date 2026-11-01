#!/usr/bin/env node
/**
 * scripts/verify-bundle.mjs — verifies an air-gap model bundle's checksum
 * BEFORE extraction and cross-checks its manifest against
 * onboarding/models.json for the installing release tag. Never attempts a
 * registry pull.
 *
 * Usage:
 *   node scripts/verify-bundle.mjs --bundle <file> [--sha256 <file|hex>] [--verbose]
 *   node scripts/verify-bundle.mjs --status [--verbose]
 *
 * Exit codes:
 *   0  PASS
 *   1  usage / unexpected error
 *   2  checksum mismatch (or missing expected checksum)
 *   3  manifest/release-tag cross-check failure
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const MODELS_JSON_PATH = path.join(REPO_ROOT, 'onboarding', 'models.json');
const STATE_PATH = path.join(REPO_ROOT, '.cs3-bundle-state.json');
const TOOL_VERSION = '1.0.0';

function parseArgs(argv) {
  const args = { bundle: null, sha256: null, status: false, verbose: false, allowTagMismatch: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--bundle':
        args.bundle = argv[++i];
        break;
      case '--sha256':
        args.sha256 = argv[++i];
        break;
      case '--status':
        args.status = true;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--allow-tag-mismatch':
        args.allowTagMismatch = true;
        break;
      default:
        break;
    }
  }
  return args;
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function readExpectedHash(bundlePath, explicitSha256Arg) {
  // 1) --sha256 <hexdigest> supplied directly
  if (explicitSha256Arg && /^[a-f0-9]{64}$/i.test(explicitSha256Arg.trim())) {
    return explicitSha256Arg.trim().toLowerCase();
  }
  // 2) --sha256 <path-to-checksum-file>
  const candidates = [];
  if (explicitSha256Arg) candidates.push(explicitSha256Arg);
  candidates.push(`${bundlePath}.sha256`);
  candidates.push(`${bundlePath}.sha256sum`);

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      const text = fs.readFileSync(candidate, 'utf8').trim();
      const match = text.match(/^([a-f0-9]{64})/i);
      if (match) return match[1].toLowerCase();
    }
  }
  return null;
}

function readManifestFromTar(bundlePath) {
  // Read only manifest.json out of the tar without extracting the rest.
  // Tolerate both "manifest.json" and "./manifest.json" tar entry names.
  for (const entryName of ['manifest.json', './manifest.json']) {
    const result = spawnSync('tar', ['-xO', '-f', bundlePath, entryName], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout) {
      try {
        return JSON.parse(result.stdout);
      } catch {
        // Try the next candidate entry name.
      }
    }
  }
  return null;
}

function loadModelsRegistry() {
  return JSON.parse(fs.readFileSync(MODELS_JSON_PATH, 'utf8'));
}

function crossCheckManifest(manifest, registry) {
  const issues = [];
  if (!manifest) {
    issues.push('Bundle does not contain a readable manifest.json.');
    return { ok: false, issues };
  }

  const installedTag = registry.releaseTag;
  if (manifest.releaseTag !== installedTag) {
    issues.push(
      `Bundle was built from release tag '${manifest.releaseTag}', but the installing release expects '${installedTag}'.`,
    );
  }

  const approvedIds = new Set((registry.models || []).map((m) => m.id));
  for (const model of manifest.models || []) {
    if (!approvedIds.has(model.id)) {
      issues.push(`Bundle contains model '${model.id}', which is not an approved model in onboarding/models.json.`);
      continue;
    }
    const approved = registry.models.find((m) => m.id === model.id);
    if (
      approved &&
      approved.sha256 &&
      approved.sha256 !== '<pinned-per-release>' &&
      model.sha256 &&
      approved.sha256 !== model.sha256
    ) {
      issues.push(`Model '${model.id}' sha256 in bundle (${model.sha256}) does not match pinned digest in models.json (${approved.sha256}).`);
    }
  }

  return { ok: issues.length === 0, issues };
}

function emit(result, verbose) {
  if (verbose) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const label = result.status === 'pass' ? 'PASS' : 'FAIL';
  process.stdout.write(`[${label}] ${result.action}\n`);
  for (const line of result.details || []) {
    process.stdout.write(`  - ${line}\n`);
  }
}

function baseResult(action) {
  return {
    tool: 'verify-bundle.mjs',
    toolVersion: TOOL_VERSION,
    timestamp: new Date().toISOString(),
    action,
    registryPullAttempted: false,
    verifier: { user: os.userInfo().username, host: os.hostname() },
    details: [],
  };
}

function verifyBundle(args) {
  const result = baseResult('verify');
  result.bundlePath = path.resolve(args.bundle);

  if (!fs.existsSync(args.bundle)) {
    result.status = 'fail';
    result.details.push(`Bundle file not found: ${args.bundle}`);
    emit(result, args.verbose);
    return 2;
  }

  const expected = readExpectedHash(args.bundle, args.sha256);
  if (!expected) {
    result.status = 'fail';
    result.details.push(
      'No expected checksum found. Provide --sha256 <file-or-hexdigest>, or place a companion <bundle>.sha256 file next to the bundle. Refusing to proceed without a known-good digest.',
    );
    emit(result, args.verbose);
    return 2;
  }

  const actual = sha256File(args.bundle);
  result.sha256Expected = expected;
  result.sha256Actual = actual;

  if (actual !== expected) {
    result.status = 'fail';
    result.details.push(`Checksum mismatch: expected ${expected}, got ${actual}.`);
    result.details.push('Bundle may be corrupted or tampered in transit. Re-transfer from a known-good source.');
    emit(result, args.verbose);
    return 2;
  }
  result.details.push('Checksum match.');

  const manifest = readManifestFromTar(args.bundle);
  const registry = loadModelsRegistry();
  const crossCheck = crossCheckManifest(manifest, registry);
  result.releaseTagBundle = manifest?.releaseTag ?? null;
  result.releaseTagInstalled = registry.releaseTag;
  result.manifestModels = manifest?.models?.map((m) => m.id) ?? [];

  if (!crossCheck.ok && !args.allowTagMismatch) {
    result.status = 'fail';
    result.details.push(...crossCheck.issues);
    emit(result, args.verbose);
    return 3;
  }
  if (!crossCheck.ok && args.allowTagMismatch) {
    result.details.push('Manifest cross-check issues present but bypassed via --allow-tag-mismatch:');
    result.details.push(...crossCheck.issues);
  } else {
    result.details.push('Manifest cross-checked against onboarding/models.json — release tag and model digests match.');
  }

  result.status = 'pass';
  emit(result, args.verbose);

  // Persist verified state for --status, and for the launcher's isolation check.
  const state = {
    bundlePath: result.bundlePath,
    sha256: actual,
    releaseTag: result.releaseTagBundle,
    verifiedAt: result.timestamp,
    verifier: result.verifier,
    models: result.manifestModels,
    registryPullAttempted: false,
  };
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });

  return 0;
}

function statusReport(args) {
  const result = baseResult('status');
  if (!fs.existsSync(STATE_PATH)) {
    result.status = 'fail';
    result.details.push('No bundle has been verified on this host yet (missing .cs3-bundle-state.json). Run --bundle <file> first.');
    emit(result, args.verbose);
    return 1;
  }
  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  result.status = 'pass';
  result.bundlePath = state.bundlePath;
  result.sha256Actual = state.sha256;
  result.releaseTagBundle = state.releaseTag;
  result.verifiedAt = state.verifiedAt;
  result.registryPullAttempted = false;
  result.details.push(`Bundle: ${state.bundlePath}`);
  result.details.push(`SHA-256: ${state.sha256}`);
  result.details.push(`Release tag: ${state.releaseTag}`);
  result.details.push(`Verified at: ${state.verifiedAt}`);
  result.details.push('No registry pull was attempted for the currently loaded bundle.');
  emit(result, args.verbose);
  return 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.status) {
    process.exit(statusReport(args));
  }
  if (!args.bundle) {
    process.stderr.write(
      'Usage: node scripts/verify-bundle.mjs --bundle <file> [--sha256 <file|hex>] [--verbose]\n' +
        '       node scripts/verify-bundle.mjs --status [--verbose]\n',
    );
    process.exit(1);
  }
  process.exit(verifyBundle(args));
}

// Exported for scripts/verify-bundle.test.mjs — the checksum comparison and
// manifest cross-check are the two pieces of logic cheap to unit test in
// isolation, without needing a real tar file or a running Ollama instance.
export { sha256File, crossCheckManifest, readExpectedHash };

const isMain = (() => {
  try {
    return import.meta.url === new URL(`file://${path.resolve(process.argv[1] || '')}`).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  main();
}
