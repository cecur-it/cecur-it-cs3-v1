#!/usr/bin/env node
/**
 * scripts/pin-model-digests.mjs — run on an internet-connected STAGING host.
 * Resolves the SHA-256 digest of each approved model's weight blob from the
 * Ollama registry manifest and writes it into onboarding/models.json (replacing
 * the "<pinned-per-release>" placeholder). Review and commit the result as part
 * of the release; scripts/verify-bundle.mjs enforces the pinned digests.
 *
 * Usage:
 *   node scripts/pin-model-digests.mjs [--release-tag v1.0.0] [--registry https://registry.ollama.ai] [--check]
 *
 *   --check   Do not write; exit 1 if any model still has a placeholder/missing digest.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_JSON_PATH = path.join(__dirname, '..', 'onboarding', 'models.json');
const MODEL_LAYER = 'application/vnd.ollama.image.model';

function parseArgs(argv) {
  const args = { releaseTag: null, registry: 'https://registry.ollama.ai', check: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--release-tag') args.releaseTag = argv[++i];
    else if (argv[i] === '--registry') args.registry = argv[++i].replace(/\/+$/, '');
    else if (argv[i] === '--check') args.check = true;
  }
  return args;
}

export function isPinned(sha256) {
  return typeof sha256 === 'string' && /^[a-f0-9]{64}$/i.test(sha256);
}

export function modelLayerDigest(manifest) {
  const layer = (manifest.layers || []).find((l) => l.mediaType === MODEL_LAYER);
  const match = layer?.digest?.match(/^sha256:([a-f0-9]{64})$/i);
  return match ? match[1].toLowerCase() : null;
}

async function fetchDigest(registry, modelId) {
  const [name, tag = 'latest'] = modelId.split(':');
  const url = `${registry}/v2/library/${encodeURIComponent(name)}/manifests/${encodeURIComponent(tag)}`;
  const res = await fetch(url, { headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const digest = modelLayerDigest(await res.json());
  if (!digest) throw new Error(`No ${MODEL_LAYER} layer found in manifest for ${modelId}`);
  return digest;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let text = fs.readFileSync(MODELS_JSON_PATH, 'utf8');
  const registry = JSON.parse(text);

  if (args.check) {
    const missing = registry.models.filter((m) => !isPinned(m.sha256)).map((m) => m.id);
    if (missing.length) {
      process.stderr.write(`[FAIL] Models without a pinned SHA-256: ${missing.join(', ')}\n`);
      process.exit(1);
    }
    process.stdout.write('[PASS] All models have pinned SHA-256 digests.\n');
    return;
  }

  for (const model of registry.models) {
    const digest = await fetchDigest(args.registry, model.id);
    process.stdout.write(`[pin-model-digests] ${model.id} -> ${digest}\n`);
    const block = new RegExp(`("id":\\s*"${model.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?"sha256":\\s*")[^"]*(")`);
    text = text.replace(block, `$1${digest}$2`);
  }
  if (args.releaseTag) {
    text = text.replace(/("releaseTag":\s*")[^"]*(")/, `$1${args.releaseTag}$2`);
  }
  text = text.replace(/("updated":\s*")[^"]*(")/, `$1${new Date().toISOString().slice(0, 10)}$2`);
  JSON.parse(text); // refuse to write malformed JSON
  fs.writeFileSync(MODELS_JSON_PATH, text);
  process.stdout.write(`[pin-model-digests] Updated ${MODELS_JSON_PATH}. Review and commit.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`[FAIL] ${err.message}\n`);
    process.exit(1);
  });
}

