#!/usr/bin/env node
/**
 * scripts/build-airgap-bundle.mjs — run this on an internet-connected
 * STAGING host, never on the target enclave. Pre-pulls the approved models
 * listed in onboarding/models.json (or a --models subset) via `ollama pull`,
 * packages them into a portable, checksummed archive
 * (cs3-model-bundle-<version>.tar) alongside a manifest.json that
 * scripts/verify-bundle.mjs cross-checks against onboarding/models.json at
 * install time.
 *
 * Usage:
 *   node scripts/build-airgap-bundle.mjs --out cs3-model-bundle-1.0.0.tar \
 *     [--release-tag v1.0.0] [--models gemma4:26b,nemotron-3-nano:30b] \
 *     [--no-include-ollama-binary] [--no-include-console-image]
 *
 * The Ollama binary and the console image are bundled by default because an
 * air-gapped enclave cannot fetch either; pass the --no-include-* flags only
 * for a models-only refresh (e.g. a model update on an already-provisioned host).
 *
 * Output:
 *   <out>          the bundle tarball
 *   <out>.sha256   its SHA-256 checksum, in `sha256sum`-compatible format
 */

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const MODELS_JSON_PATH = path.join(REPO_ROOT, 'onboarding', 'models.json');

function parseArgs(argv) {
  const args = {
    out: null,
    releaseTag: null,
    models: null,
    includeOllamaBinary: true,
    includeConsoleImage: true,
    includeErrowImage: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--out':
        args.out = argv[++i];
        break;
      case '--release-tag':
        args.releaseTag = argv[++i];
        break;
      case '--models':
        args.models = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '--include-ollama-binary':
        args.includeOllamaBinary = true;
        break;
      case '--no-include-ollama-binary':
        args.includeOllamaBinary = false;
        break;
      case '--include-console-image':
        args.includeConsoleImage = true;
        break;
      case '--no-include-console-image':
        args.includeConsoleImage = false;
        break;
      case '--include-errow-image':
        args.includeErrowImage = true;
        break;
      case '--no-include-errow-image':
        args.includeErrowImage = false;
        break;
      default:
        break;
    }
  }
  return args;
}

function loadModelsRegistry() {
  return JSON.parse(fs.readFileSync(MODELS_JSON_PATH, 'utf8'));
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertNotTargetEnclave() {
  if (process.env.CS3_AIRGAP_ENCLAVE === 'true') {
    process.stderr.write(
      '[FAIL] CS3_AIRGAP_ENCLAVE=true is set. This script pulls from the network and must ' +
        'only run on an internet-connected staging host, never the target enclave. Aborting.\n',
    );
    process.exit(1);
  }
}

function ensureOllamaAvailable() {
  const check = spawnSync('ollama', ['--version'], { encoding: 'utf8' });
  if (check.error || check.status !== 0) {
    process.stderr.write('[FAIL] `ollama` was not found on PATH. Install it on this staging host before building a bundle.\n');
    process.exit(1);
  }
}

function pullModel(modelId) {
  process.stdout.write(`[build-airgap-bundle] Pulling ${modelId} ...\n`);
  const result = spawnSync('ollama', ['pull', modelId], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`ollama pull ${modelId} failed with exit code ${result.status}`);
  }
}

function findOllamaModelsDir() {
  if (process.env.OLLAMA_MODELS) return process.env.OLLAMA_MODELS;
  const platform = os.platform();
  if (platform === 'win32') {
    return path.join(process.env.USERPROFILE || os.homedir(), '.ollama', 'models');
  }
  return path.join(os.homedir(), '.ollama', 'models');
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  assertNotTargetEnclave();

  const args = parseArgs(process.argv.slice(2));
  if (!args.out) {
    process.stderr.write('Usage: node scripts/build-airgap-bundle.mjs --out cs3-model-bundle-<version>.tar [--release-tag vX.Y.Z] [--models id1,id2] [--no-include-ollama-binary] [--no-include-console-image] [--no-include-errow-image]\n');
    process.exit(1);
  }

  ensureOllamaAvailable();

  const registry = loadModelsRegistry();
  const releaseTag = args.releaseTag || registry.releaseTag || 'unreleased';
  const modelIds = args.models && args.models.length > 0 ? args.models : (registry.models || []).map((m) => m.id);

  const approvedIds = new Set((registry.models || []).map((m) => m.id));
  for (const id of modelIds) {
    if (!approvedIds.has(id)) {
      process.stderr.write(`[FAIL] '${id}' is not an approved model in onboarding/models.json. Refusing to bundle unapproved weights.\n`);
      process.exit(1);
    }
  }

  for (const id of modelIds) {
    pullModel(id);
  }

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs3-airgap-bundle-'));
  const modelsStagingDir = path.join(stagingDir, 'models');
  const modelsDir = findOllamaModelsDir();
  if (!fs.existsSync(modelsDir)) {
    process.stderr.write(`[FAIL] Could not locate the local Ollama model store at ${modelsDir}.\n`);
    process.exit(1);
  }
  process.stdout.write(`[build-airgap-bundle] Copying model store from ${modelsDir} ...\n`);
  copyRecursive(modelsDir, modelsStagingDir);

  if (args.includeOllamaBinary) {
    const ollamaPath = spawnSync(os.platform() === 'win32' ? 'where' : 'which', ['ollama'], { encoding: 'utf8' });
    const binPath = ollamaPath.stdout?.split(/\r?\n/)[0]?.trim();
    if (binPath && fs.existsSync(binPath)) {
      const binDir = path.join(stagingDir, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.copyFileSync(binPath, path.join(binDir, path.basename(binPath)));
      fs.chmodSync(path.join(binDir, path.basename(binPath)), 0o755);
    } else {
      process.stderr.write('[warn] --include-ollama-binary requested but the ollama binary could not be located; skipping.\n');
    }

    // Windows hosts run `ollama serve` as a service through NSSM (see install.ps1); ship it too.
    if (os.platform() === 'win32') {
      const nssmPath = spawnSync('where', ['nssm'], { encoding: 'utf8' }).stdout?.split(/\r?\n/)[0]?.trim();
      if (nssmPath && fs.existsSync(nssmPath)) {
        const binDir = path.join(stagingDir, 'bin');
        fs.mkdirSync(binDir, { recursive: true });
        fs.copyFileSync(nssmPath, path.join(binDir, 'nssm.exe'));
      } else {
        process.stderr.write('[warn] nssm.exe not found on PATH; Windows air-gap installs will need it supplied separately.\n');
      }
    }
  }

  if (args.includeConsoleImage) {
    const imageTag = 'cs3-soc-console:airgap';
    const imagesDir = path.join(stagingDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    process.stdout.write(`[build-airgap-bundle] Building and saving console image ${imageTag} ...\n`);
    execFileSync('docker', ['build', '-t', imageTag, path.join(REPO_ROOT, 'demo', 'demo-100226')], { stdio: 'inherit' });
    execFileSync('docker', ['save', '-o', path.join(imagesDir, 'cs3-soc-console-airgap.tar'), imageTag], { stdio: 'inherit' });
  }

  if (args.includeErrowImage) {
    // The errow-agent sandbox image (Kali base, see errow/containers/Dockerfile) is built here, on the
    // connected staging host, so the enclave never fetches wheels, apt packages or images at runtime.
    const imageTag = 'errow-agent:airgap';
    const imagesDir = path.join(stagingDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    process.stdout.write(`[build-airgap-bundle] Building and saving errow image ${imageTag} ...\n`);
    execFileSync('docker', ['build', '-t', imageTag, '-f', path.join(REPO_ROOT, 'errow', 'containers', 'Dockerfile'), path.join(REPO_ROOT, 'errow')], { stdio: 'inherit' });
    execFileSync('docker', ['save', '-o', path.join(imagesDir, 'errow-agent-airgap.tar'), imageTag], { stdio: 'inherit' });
  }

  const manifest = {
    releaseTag,
    builtAt: new Date().toISOString(),
    builtOn: { platform: os.platform(), arch: os.arch(), hostname: os.hostname() },
    models: modelIds.map((id) => {
      const approved = registry.models.find((m) => m.id === id);
      return {
        id,
        family: approved?.family,
        variant: approved?.variant,
        sha256: approved && approved.sha256 !== '<pinned-per-release>' ? approved.sha256 : null,
      };
    }),
    includesOllamaBinary: args.includeOllamaBinary,
    includesConsoleImage: args.includeConsoleImage,
    includesErrowImage: args.includeErrowImage,
  };
  fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const outPath = path.resolve(args.out);
  process.stdout.write(`[build-airgap-bundle] Packaging bundle to ${outPath} ...\n`);
  const stagingEntries = fs.readdirSync(stagingDir);
  execFileSync('tar', ['-cf', outPath, '-C', stagingDir, ...stagingEntries]);

  const checksum = sha256File(outPath);
  const checksumPath = `${outPath}.sha256`;
  fs.writeFileSync(checksumPath, `${checksum}  ${path.basename(outPath)}\n`);

  fs.rmSync(stagingDir, { recursive: true, force: true });

  process.stdout.write(`\n[build-airgap-bundle] Done.\n`);
  process.stdout.write(`  Bundle:   ${outPath}\n`);
  process.stdout.write(`  Checksum: ${checksumPath} (${checksum})\n`);
  process.stdout.write(`  Release:  ${releaseTag}\n`);
  process.stdout.write(`  Models:   ${modelIds.join(', ')}\n`);
  process.stdout.write(
    '\nTransfer both files to the target enclave using your approved cross-domain / removable-media process, then run:\n' +
      `  node scripts/verify-bundle.mjs --bundle ${path.basename(outPath)}\n`,
  );
}

main();
