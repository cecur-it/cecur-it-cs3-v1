#!/usr/bin/env node
/**
 * scripts/verify-bundle.test.mjs — unit tests for the two pieces of logic
 * that gate every air-gap install: the checksum comparison and the bundle
 * manifest cross-check against onboarding/models.json. These are cheap to
 * test in isolation (no real tar file, no Ollama, no network) and they are
 * the exact functions a reviewer needs to trust for the "never bypass a
 * checksum mismatch" guarantee documented in README.md Section 6.3.
 *
 * Run with:
 *   node --test scripts/
 *   node --test scripts/verify-bundle.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { sha256File, crossCheckManifest, readExpectedHash } from './verify-bundle.mjs';

function tmpFile(contents) {
  const p = path.join(os.tmpdir(), `cs3-verify-bundle-test-${process.pid}-${Math.random().toString(16).slice(2)}`);
  fs.writeFileSync(p, contents);
  return p;
}

test('sha256File matches Node crypto for the same bytes', () => {
  const contents = 'cs3-test-bundle-contents\n';
  const p = tmpFile(contents);
  try {
    const expected = createHash('sha256').update(contents).digest('hex');
    assert.equal(sha256File(p), expected);
  } finally {
    fs.rmSync(p, { force: true });
  }
});

test('sha256File detects any single-byte change (tamper/corruption detection)', () => {
  const p1 = tmpFile('cs3-bundle-A');
  const p2 = tmpFile('cs3-bundle-B');
  try {
    assert.notEqual(sha256File(p1), sha256File(p2));
  } finally {
    fs.rmSync(p1, { force: true });
    fs.rmSync(p2, { force: true });
  }
});

test('readExpectedHash accepts a bare hex digest via --sha256', () => {
  const hex = 'a'.repeat(64);
  assert.equal(readExpectedHash('/does/not/matter.tar', hex), hex);
});

test('readExpectedHash reads a companion <bundle>.sha256 file when no explicit digest is given', () => {
  const bundlePath = tmpFile('irrelevant-bundle-bytes');
  const checksumPath = `${bundlePath}.sha256`;
  const hex = 'b'.repeat(64);
  fs.writeFileSync(checksumPath, `${hex}  cs3-model-bundle-v1.0.0.tar\n`);
  try {
    assert.equal(readExpectedHash(bundlePath, null), hex);
  } finally {
    fs.rmSync(bundlePath, { force: true });
    fs.rmSync(checksumPath, { force: true });
  }
});

test('readExpectedHash returns null when no digest is available anywhere (fail closed, not silently pass)', () => {
  assert.equal(readExpectedHash('/tmp/definitely-missing-bundle-and-checksum.tar', null), null);
});

test('crossCheckManifest passes when release tag and model ids/digests all match the registry', () => {
  const registry = {
    releaseTag: 'v1.0.0',
    models: [
      { id: 'gemma4:26b', sha256: 'deadbeef' },
      { id: 'nemotron-3-nano:30b', sha256: 'feedface' },
    ],
  };
  const manifest = {
    releaseTag: 'v1.0.0',
    models: [
      { id: 'gemma4:26b', sha256: 'deadbeef' },
      { id: 'nemotron-3-nano:30b', sha256: 'feedface' },
    ],
  };
  const result = crossCheckManifest(manifest, registry);
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('crossCheckManifest fails when the bundle was built from a different release tag', () => {
  const registry = { releaseTag: 'v1.0.0', models: [{ id: 'gemma4:26b', sha256: 'deadbeef' }] };
  const manifest = { releaseTag: 'v0.9.0', models: [{ id: 'gemma4:26b', sha256: 'deadbeef' }] };
  const result = crossCheckManifest(manifest, registry);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((line) => line.includes("release tag 'v0.9.0'")));
});

test('crossCheckManifest fails when the bundle contains a model not approved in models.json', () => {
  const registry = { releaseTag: 'v1.0.0', models: [{ id: 'gemma4:26b', sha256: 'deadbeef' }] };
  const manifest = { releaseTag: 'v1.0.0', models: [{ id: 'some-unapproved-model:1b', sha256: 'x' }] };
  const result = crossCheckManifest(manifest, registry);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((line) => line.includes('not an approved model')));
});

test('crossCheckManifest fails when an approved model digest does not match the pinned registry digest', () => {
  const registry = { releaseTag: 'v1.0.0', models: [{ id: 'gemma4:26b', sha256: 'deadbeef' }] };
  const manifest = { releaseTag: 'v1.0.0', models: [{ id: 'gemma4:26b', sha256: 'not-deadbeef' }] };
  const result = crossCheckManifest(manifest, registry);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((line) => line.includes('does not match pinned digest')));
});

test('crossCheckManifest tolerates the "<pinned-per-release>" placeholder (pre-release registry state)', () => {
  const registry = { releaseTag: 'unreleased', models: [{ id: 'gemma4:26b', sha256: '<pinned-per-release>' }] };
  const manifest = { releaseTag: 'unreleased', models: [{ id: 'gemma4:26b', sha256: 'anything-goes-pre-release' }] };
  const result = crossCheckManifest(manifest, registry);
  assert.equal(result.ok, true);
});

test('crossCheckManifest fails closed (not silently passes) when the manifest is missing entirely', () => {
  const registry = { releaseTag: 'v1.0.0', models: [] };
  const result = crossCheckManifest(null, registry);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((line) => line.includes('does not contain a readable manifest.json')));
});
