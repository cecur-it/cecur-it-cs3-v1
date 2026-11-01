#!/usr/bin/env node
import http from 'node:http';
import https from 'node:https';
import process from 'node:process';
import { URL } from 'node:url';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = 'true';
    }
  }
  return out;
}

function toNumber(value, fallback, name, { allowZero = false } = {}) {
  if (value === undefined) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || (!allowZero && num === 0)) {
    throw new Error(`${name} must be ${allowZero ? 'a non-negative number' : 'a positive number'}`);
  }
  return num;
}

function usage() {
  console.log(`Usage:
  node deployment/operations/testing/eps-loadgen.mjs \
    --url https://ingest.cs3.example.mil/api/cecur/logs/ingest \
    --api-key YOUR_INGEST_KEY \
    --eps 1000 \
    --duration 600 \
    --concurrency 200 \
    --ramp 60

Options:
  --url           Full ingest URL
  --api-key       Value for X-API-Key
  --eps           Target events per second
  --duration      Test duration in seconds
  --concurrency   Maximum in-flight requests
  --ramp          Linear ramp-up time in seconds (default: 0)
  --agent-prefix  Prefix for synthetic agent IDs (default: loadgen)
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  usage();
  process.exit(0);
}

if (!args.url || !args['api-key']) {
  usage();
  process.exit(1);
}

const endpoint = new URL(args.url);
const targetEps = toNumber(args.eps, 100, '--eps');
const durationSeconds = toNumber(args.duration, 60, '--duration');
const concurrency = Math.floor(toNumber(args.concurrency, 25, '--concurrency'));
const rampSeconds = args.ramp === undefined ? 0 : toNumber(args.ramp, 0, '--ramp', { allowZero: true });
const agentPrefix = args['agent-prefix'] || 'loadgen';
const transport = endpoint.protocol === 'https:' ? https : http;
const agent = endpoint.protocol === 'https:'
  ? new https.Agent({ keepAlive: true, maxSockets: concurrency })
  : new http.Agent({ keepAlive: true, maxSockets: concurrency });

const latencyBuckets = new Uint32Array(60001);
const sources = ['syslog', 'auth.log', 'auditd', 'windows_event', 'nginx', 'k8s_audit', 'cloudtrail'];
const severities = ['info', 'low', 'medium', 'high', 'critical'];

let started = 0;
let completed = 0;
let succeeded = 0;
let failed = 0;
let http429 = 0;
let http5xx = 0;
let inFlight = 0;
let saturatedTicks = 0;
let maxLag = 0;
let shuttingDown = false;
let latencySamples = 0;
const startedAt = Date.now();

function desiredRequestsAt(elapsedSeconds) {
  if (rampSeconds <= 0) return targetEps * elapsedSeconds;
  if (elapsedSeconds <= rampSeconds) {
    return (targetEps * elapsedSeconds * elapsedSeconds) / (2 * rampSeconds);
  }
  return targetEps * (elapsedSeconds - rampSeconds / 2);
}

const targetTotal = Math.floor(desiredRequestsAt(durationSeconds));

function buildPayload(seq) {
  const source = sources[seq % sources.length];
  const severity = severities[seq % severities.length];
  return JSON.stringify({
    message: `synthetic event ${seq} from ${source}`,
    source,
    severity,
    agentId: `${agentPrefix}-${String((seq % 5000) + 1).padStart(5, '0')}`,
    agentName: `${agentPrefix}-host-${String((seq % 5000) + 1).padStart(5, '0')}`,
    fields: {
      seq,
      scenario: 'eps-loadgen',
      generatedAt: new Date().toISOString(),
      site: seq % 2 === 0 ? 'primary' : 'secondary',
      category: seq % 10 === 0 ? 'auth_failure' : 'baseline',
    },
  });
}

function recordLatency(ms) {
  const idx = Math.max(0, Math.min(latencyBuckets.length - 1, Math.round(ms)));
  latencyBuckets[idx] += 1;
  latencySamples += 1;
}

function quantile(p) {
  const goal = Math.ceil(latencySamples * p);
  if (goal <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < latencyBuckets.length; i += 1) {
    seen += latencyBuckets[i];
    if (seen >= goal) return i;
  }
  return latencyBuckets.length - 1;
}

function summarize() {
  const elapsedSeconds = Math.max(0.001, (Date.now() - startedAt) / 1000);
  const achievedEps = succeeded / elapsedSeconds;
  const errorRate = started === 0 ? 0 : (failed / started) * 100;
  const rate429 = started === 0 ? 0 : (http429 / started) * 100;
  console.log('--- CS3 ingest load summary ---');
  console.log(`target_eps=${targetEps}`);
  console.log(`duration_seconds=${durationSeconds}`);
  console.log(`target_total=${targetTotal}`);
  console.log(`started=${started}`);
  console.log(`completed=${completed}`);
  console.log(`succeeded=${succeeded}`);
  console.log(`failed=${failed}`);
  console.log(`http_429=${http429}`);
  console.log(`http_5xx=${http5xx}`);
  console.log(`achieved_eps=${achievedEps.toFixed(2)}`);
  console.log(`error_rate_pct=${errorRate.toFixed(3)}`);
  console.log(`rate_429_pct=${rate429.toFixed(3)}`);
  console.log(`p50_ms=${quantile(0.50)}`);
  console.log(`p95_ms=${quantile(0.95)}`);
  console.log(`p99_ms=${quantile(0.99)}`);
  console.log(`max_scheduler_lag=${maxLag}`);
  console.log(`saturated_ticks=${saturatedTicks}`);
}

function maybeFinish() {
  if (shuttingDown && inFlight === 0) {
    summarize();
    process.exit(failed > 0 ? 2 : 0);
  }
  if (!shuttingDown && started >= targetTotal && inFlight === 0 && (Date.now() - startedAt) / 1000 >= durationSeconds) {
    shuttingDown = true;
    summarize();
    process.exit(failed > 0 ? 2 : 0);
  }
}

function dispatchRequest(seq) {
  started += 1;
  inFlight += 1;
  const payload = buildPayload(seq);
  const requestStarted = process.hrtime.bigint();

  const req = transport.request({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    port: endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80),
    path: `${endpoint.pathname}${endpoint.search}`,
    method: 'POST',
    agent,
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
      'x-api-key': args['api-key'],
    },
    timeout: 30000,
  }, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      const latencyMs = Number(process.hrtime.bigint() - requestStarted) / 1e6;
      recordLatency(latencyMs);
      completed += 1;
      inFlight -= 1;
      if (res.statusCode === 201) {
        succeeded += 1;
      } else {
        failed += 1;
        if (res.statusCode === 429) http429 += 1;
        if ((res.statusCode || 0) >= 500) http5xx += 1;
      }
      maybeFinish();
    });
  });

  req.on('timeout', () => {
    req.destroy(new Error('request timeout'));
  });

  req.on('error', () => {
    completed += 1;
    failed += 1;
    inFlight -= 1;
    maybeFinish();
  });

  req.write(payload);
  req.end();
}

const scheduler = setInterval(() => {
  if (shuttingDown) return;
  const elapsed = (Date.now() - startedAt) / 1000;
  const desired = Math.min(targetTotal, Math.floor(desiredRequestsAt(Math.min(elapsed, durationSeconds))));
  if (desired > started && inFlight >= concurrency) {
    saturatedTicks += 1;
    maxLag = Math.max(maxLag, desired - started);
  }
  while (started < desired && inFlight < concurrency) {
    dispatchRequest(started + 1);
  }
  if (elapsed >= durationSeconds && started >= targetTotal && inFlight === 0) {
    clearInterval(scheduler);
    maybeFinish();
  }
}, 50);

process.on('SIGINT', () => {
  shuttingDown = true;
  clearInterval(scheduler);
  if (inFlight === 0) {
    summarize();
    process.exit(130);
  }
});

process.on('SIGTERM', () => {
  shuttingDown = true;
  clearInterval(scheduler);
  if (inFlight === 0) {
    summarize();
    process.exit(143);
  }
});
