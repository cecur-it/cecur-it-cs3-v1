import http from 'k6/http';
import { check } from 'k6';

const scenarioName = (__ENV.SCENARIO || 'small').toLowerCase();
const url = __ENV.CS3_URL || 'https://ingest.cs3.example.mil/api/cecur/logs/ingest';
const apiKey = __ENV.CS3_API_KEY || 'CHANGE_ME';

const presets = {
  small: {
    rate: Number(__ENV.SMALL_EPS || 100),
    duration: __ENV.SMALL_DURATION || '30m',
    timeUnit: '1s',
    preAllocatedVUs: Number(__ENV.SMALL_PREALLOCATED_VUS || 50),
    maxVUs: Number(__ENV.SMALL_MAX_VUS || 200),
  },
  medium: {
    rate: Number(__ENV.MEDIUM_EPS || 1000),
    duration: __ENV.MEDIUM_DURATION || '60m',
    timeUnit: '1s',
    preAllocatedVUs: Number(__ENV.MEDIUM_PREALLOCATED_VUS || 250),
    maxVUs: Number(__ENV.MEDIUM_MAX_VUS || 1500),
  },
  large: {
    rate: Number(__ENV.LARGE_EPS || 10000),
    duration: __ENV.LARGE_DURATION || '90m',
    timeUnit: '1s',
    preAllocatedVUs: Number(__ENV.LARGE_PREALLOCATED_VUS || 1500),
    maxVUs: Number(__ENV.LARGE_MAX_VUS || 12000),
  },
};

const selected = presets[scenarioName] || presets.small;

export const options = {
  scenarios: {
    ingest: {
      executor: 'constant-arrival-rate',
      exec: 'ingest',
      rate: selected.rate,
      timeUnit: selected.timeUnit,
      duration: selected.duration,
      preAllocatedVUs: selected.preAllocatedVUs,
      maxVUs: selected.maxVUs,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    checks: ['rate>0.99'],
  },
};

function payload() {
  const n = __ITER;
  return JSON.stringify({
    message: `k6 synthetic event ${n}`,
    source: n % 5 === 0 ? 'cloudtrail' : n % 2 === 0 ? 'syslog' : 'auditd',
    severity: n % 17 === 0 ? 'high' : n % 11 === 0 ? 'medium' : 'info',
    agentId: `k6-agent-${(__VU % 5000) + 1}`,
    agentName: `k6-host-${(__VU % 5000) + 1}`,
    fields: {
      scenario: scenarioName,
      vu: __VU,
      iter: n,
      generatedAt: new Date().toISOString(),
    },
  });
}

export function ingest() {
  const res = http.post(url, payload(), {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    timeout: '30s',
  });

  check(res, {
    'status is 201': (r) => r.status === 201,
    'body indicates success': (r) => r.json('success') === true,
  });
}
