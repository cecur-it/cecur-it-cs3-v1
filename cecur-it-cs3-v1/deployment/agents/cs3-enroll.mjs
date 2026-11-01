#!/usr/bin/env node
/**
 * cs3-enroll — bulk endpoint enrollment CLI for the Cecur CS3 console.
 *
 *   cs3-enroll bulk --file hosts.csv --url https://cs3.example.internal [options]
 *   cs3-enroll summary --url https://cs3.example.internal
 *
 * Node >= 18, core modules only (works on air-gapped admin hosts).
 *
 * Authentication (never pass secrets on the command line):
 *   CS3_TOKEN                      pre-issued admin bearer token, or
 *   CS3_USERNAME + CS3_PASSWORD    exchanged for a token via /api/auth/login
 *
 * Input: CSV (header row required) or JSON array. Columns/keys:
 *   hostname (required), ip, platform (linux|windows|macos|container),
 *   osName, osVersion, arch, workloadType, group
 *
 * Output (--out, default ./cs3-enrollment-<batch>.json, mode 0600) contains one-time
 * enrollment tokens. Treat it as a secret: feed it to the Ansible/PowerShell installers,
 * then shred it. Tokens expire (--ttl-hours, default 24, max 168) and are single use.
 */
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

const USAGE = `Usage:
  cs3-enroll bulk    --file <hosts.csv|hosts.json> --url <console-url> [--group <name>]...
                     [--ttl-hours 24] [--batch-size 500] [--dry-run] [--out <file>]
                     [--ca-file <pem>] [--delay-ms 0]
  cs3-enroll summary --url <console-url> [--ca-file <pem>]

Environment: CS3_URL, CS3_TOKEN | (CS3_USERNAME + CS3_PASSWORD), CS3_CA_FILE
Exit codes: 0 ok, 1 usage/error, 2 completed with invalid or duplicate hosts`;

const MAX_SERVER_BATCH = 1000;

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = { cmd, group: [] };
  const flags = new Set(['dry-run', 'help']);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) throw new Error(`Unexpected argument: ${a}`);
    const k = a.slice(2);
    if (flags.has(k)) {
      opts[k] = true;
      continue;
    }
    const v = rest[++i];
    if (v === undefined) throw new Error(`Missing value for --${k}`);
    if (k === 'group') opts.group.push(v);
    else opts[k] = v;
  }
  return opts;
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function loadHosts(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const hosts = file.toLowerCase().endsWith('.json') ? JSON.parse(raw) : parseCsv(raw);
  if (!Array.isArray(hosts) || hosts.length === 0) throw new Error(`${file}: no hosts found`);
  return hosts.map((h) => {
    const out = { ...h };
    for (const k of Object.keys(out)) if (out[k] === '') delete out[k];
    return out;
  });
}

function request(url, { method = 'GET', headers = {}, body, ca } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = lib.request(
      u,
      {
        method,
        ca,
        timeout: 60_000,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json;
          try {
            json = text ? JSON.parse(text) : undefined;
          } catch {
            /* non-JSON error page */
          }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('request timed out')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getToken(base, ca) {
  if (process.env.CS3_TOKEN) return process.env.CS3_TOKEN;
  const { CS3_USERNAME: username, CS3_PASSWORD: password } = process.env;
  if (!username || !password) throw new Error('Set CS3_TOKEN, or CS3_USERNAME and CS3_PASSWORD.');
  const r = await request(`${base}/api/auth/login`, { method: 'POST', body: { username, password }, ca });
  if (r.status !== 200 || !r.json?.token) throw new Error(`Login failed (HTTP ${r.status}).`);
  return r.json.token;
}

const bearer = (token) => ({ Authorization: ['Bearer', token].join(' ') });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cmdBulk(opts, base, ca) {
  if (!opts.file) throw new Error('--file is required');
  const batchSize = Math.min(Number(opts['batch-size'] || 500), MAX_SERVER_BATCH);
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('--batch-size must be a positive integer');
  const ttlHours = opts['ttl-hours'] === undefined ? undefined : Number(opts['ttl-hours']);
  const dryRun = Boolean(opts['dry-run']);
  const delayMs = Number(opts['delay-ms'] || 0);

  const hosts = loadHosts(opts.file);
  const token = await getToken(base, ca);
  const auth = bearer(token);

  console.error(`Enrolling ${hosts.length} host(s) in batches of ${batchSize}${dryRun ? ' (dry run)' : ''}...`);
  const results = [];
  const batches = [];
  for (let i = 0; i < hosts.length; i += batchSize) {
    const chunk = hosts.slice(i, i + batchSize);
    const r = await request(`${base}/api/fleet/enroll/bulk`, {
      method: 'POST',
      headers: auth,
      ca,
      body: { agents: chunk, group: opts.group, ttlHours, dryRun },
    });
    if (r.status !== 200 && r.status !== 201) {
      const msg = r.json?.message || r.json?.error || r.text.slice(0, 200);
      // Earlier batches are already enrolled; save what we have so tokens are not lost.
      if (results.length && !dryRun) writeOut(opts, batches, results);
      throw new Error(`Batch starting at row ${i + 1} failed: HTTP ${r.status} ${msg}`);
    }
    batches.push({ batchId: r.json.batchId, expiresAt: r.json.expiresAt });
    results.push(...r.json.results);
    console.error(`  batch ${batches.length}: enrolled=${r.json.enrolled} duplicates=${r.json.duplicates} invalid=${r.json.invalid}`);
    if (delayMs) await sleep(delayMs);
  }

  const count = (s) => results.filter((x) => x.status === s).length;
  const enrolled = count('enrolled');
  const duplicates = count('duplicate');
  const invalid = count('invalid');
  for (const r of results.filter((x) => x.status !== 'enrolled')) {
    console.error(`  ${r.status.toUpperCase()}: ${r.hostname || '(blank)'} - ${r.error}`);
  }
  if (!dryRun && enrolled) {
    const file = writeOut(opts, batches, results);
    console.error(`Wrote ${enrolled} one-time token(s) to ${file} (mode 0600). Protect and delete after rollout.`);
  }
  console.error(`Done: enrolled=${enrolled} duplicates=${duplicates} invalid=${invalid}`);
  return duplicates + invalid > 0 ? 2 : 0;
}

function writeOut(opts, batches, results) {
  const file = opts.out || `cs3-enrollment-${batches[0]?.batchId || Date.now()}.json`;
  const doc = {
    consoleUrl: normalizeBase(opts.url || process.env.CS3_URL),
    generatedAt: new Date().toISOString(),
    batches,
    agents: results
      .filter((r) => r.status === 'enrolled')
      .map(({ hostname, agentId, enrollmentToken }) => ({ hostname, agentId, enrollmentToken })),
  };
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

async function cmdSummary(_opts, base, ca) {
  const token = await getToken(base, ca);
  const r = await request(`${base}/api/fleet/summary`, { headers: bearer(token), ca });
  if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.json?.message || r.text.slice(0, 200)}`);
  console.log(JSON.stringify(r.json, null, 2));
  return 0;
}

function normalizeBase(u) {
  if (!u) throw new Error('--url (or CS3_URL) is required');
  const url = new URL(u);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    throw new Error('Refusing to send credentials over plain HTTP to a non-loopback host; use https://');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.cmd || opts.cmd === '--help' || opts.help || !['bulk', 'summary'].includes(opts.cmd)) {
    console.error(USAGE);
    return opts.cmd && opts.cmd !== '--help' && !opts.help ? 1 : 0;
  }
  const base = normalizeBase(opts.url || process.env.CS3_URL);
  const caFile = opts['ca-file'] || process.env.CS3_CA_FILE;
  const ca = caFile ? fs.readFileSync(caFile) : undefined;
  return opts.cmd === 'bulk' ? cmdBulk(opts, base, ca) : cmdSummary(opts, base, ca);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  );
}
