/**
 * IntelliSchedule HTTP-Level Load Test (k6) — 1,000 / 5,000 / 10,000 Concurrent Active Users.
 * Run against staging:
 *   BASE_URL=https://staging-api.example.com TARGET_VUS=1000 k6 run tests/load/k6_university_load.js
 *   BASE_URL=https://staging-api.example.com TARGET_VUS=5000 k6 run tests/load/k6_university_load.js
 *   BASE_URL=https://staging-api.example.com TARGET_VUS=10000 k6 run tests/load/k6_university_load.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const TARGET_VUS = Number(__ENV.TARGET_VUS || 1000);
const AUTH_COOKIE = __ENV.AUTH_COOKIE || '';

const healthLatency = new Trend('endpoint_health_ms');
const bootstrapLatency = new Trend('endpoint_bootstrap_ms');
const errorRate = new Rate('http_error_rate');

export const options = {
  scenarios: {
    active_campus_users: {
      executor: 'ramping-vus',
      startVUs: Math.max(10, Math.floor(TARGET_VUS * 0.1)),
      stages: [
        { duration: '30s', target: TARGET_VUS },
        { duration: '2m', target: TARGET_VUS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<150', 'p(95)<500', 'p(99)<1200'],
    http_error_rate: ['rate<0.01'],
  },
};

export default function () {
  const headers = AUTH_COOKIE ? { Cookie: AUTH_COOKIE, 'X-Requested-With': 'XMLHttpRequest' } : {};

  const hRes = http.get(`${BASE_URL}/api/health/live`, { tags: { endpoint: 'health_live' } });
  healthLatency.add(hRes.timings.duration);
  const hOk = check(hRes, { 'health 200': (r) => r.status === 200 });
  errorRate.add(!hOk);

  if (AUTH_COOKIE) {
    const bRes = http.get(`${BASE_URL}/api/academic/bootstrap`, { headers, tags: { endpoint: 'academic_bootstrap' } });
    bootstrapLatency.add(bRes.timings.duration);
    const bOk = check(bRes, { 'bootstrap 200/304': (r) => r.status === 200 || r.status === 304 });
    errorRate.add(!bOk);
  }

  sleep(1);
}
