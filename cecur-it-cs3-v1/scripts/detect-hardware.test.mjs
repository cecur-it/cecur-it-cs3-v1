#!/usr/bin/env node
/**
 * scripts/detect-hardware.test.mjs — unit tests for recommendTier(), the
 * pure decision function that maps detected VRAM/RAM to one of the three
 * published model tiers (entry/edge workstation, frontier/reasoning,
 * agentic tool-use). Cheap to test with fixture registries — no real GPU,
 * OS probe, or child process required.
 *
 * Run with:
 *   node --test scripts/
 *   node --test scripts/detect-hardware.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { recommendTier } from './detect-hardware.mjs';

const registry = {
  tiers: {
    entry: { label: 'Entry / edge workstation', models: ['gemma4:26b'] },
    frontier: { label: 'Frontier / reasoning tier', models: ['gemma4:31b'] },
    agentic: { label: 'Agentic tool-use tier', models: ['nemotron-3-nano:30b'] },
  },
  models: [
    { id: 'gemma4:26b', minVramGb: 16, minSystemRamGb: 32 },
    { id: 'gemma4:31b', minVramGb: 24, minSystemRamGb: 64 },
    { id: 'nemotron-3-nano:30b', minVramGb: 24, minSystemRamGb: 64 },
  ],
};

test('recommends the agentic tier when hardware satisfies its VRAM and RAM minimums', () => {
  const result = recommendTier(registry, 24, 64);
  assert.equal(result.recommended, 'agentic');
  assert.equal(result.fallback, undefined);
});

test('falls back from agentic to entry when VRAM only satisfies the entry tier', () => {
  const result = recommendTier(registry, 16, 32);
  assert.equal(result.recommended, 'entry');
});

test('when agentic and frontier share the same minimums, the higher-priority tier (agentic) wins', () => {
  // agentic and frontier both require 24GB VRAM / 64GB RAM in this fixture,
  // so 24/64 satisfies both — recommendTier evaluates highest tier first
  // (agentic), so agentic wins. This test documents that ordering.
  const result = recommendTier(registry, 24, 64);
  assert.equal(result.recommended, 'agentic');
});

test('defaults to entry with fallback=true when no tier is satisfied (e.g. no GPU detected)', () => {
  const result = recommendTier(registry, null, 8);
  assert.equal(result.recommended, 'entry');
  assert.equal(result.fallback, true);
});

test('treats maxVramGb=null (VRAM unknown) as "do not block on VRAM" but RAM is still enforced', () => {
  // Unknown VRAM (e.g. probe failed) should not silently recommend a tier
  // whose RAM requirement is also unmet.
  const result = recommendTier(registry, null, 16);
  assert.equal(result.recommended, 'entry');
  assert.equal(result.fallback, true);
});

test('every tier in the evaluated report carries its label and constituent models', () => {
  const result = recommendTier(registry, 24, 64);
  const evaluatedIds = result.evaluated.map((e) => e.tier);
  assert.deepEqual(evaluatedIds, ['agentic']); // stops evaluating once a tier is satisfied
  assert.equal(result.evaluated[0].label, 'Agentic tool-use tier');
  assert.deepEqual(result.evaluated[0].models, ['nemotron-3-nano:30b']);
});

test('handles an empty/missing tiers registry without throwing (fails closed to entry)', () => {
  const result = recommendTier({ tiers: {}, models: [] }, 24, 64);
  assert.equal(result.recommended, 'entry');
  assert.equal(result.fallback, true);
});
