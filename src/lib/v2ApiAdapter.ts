/**
 * Controlled Frontend Cutover Adapter: Legacy /api/* -> Normalized FastAPI /v1/*.
 * Enabled via VITE_USE_NORMALIZED_V2_API=true (and optional VITE_V2_API_BASE_URL).
 * Logs a clear dev warning if an unmigrated legacy route is called while v2 mode is active,
 * ensuring no frontend page silently depends on legacy server.ts.
 */

const LEGACY_TO_V2_PREFIX_MAP: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^\/api\/academic\/courses(?:\/(.*))?$/, (m) => (m[1] ? `/v1/academic/courses/${m[1]}` : '/v1/academic/courses')],
  [/^\/api\/academic\/departments(?:\/(.*))?$/, (m) => (m[1] ? `/v1/catalog/departments/${m[1]}` : '/v1/catalog/departments')],
  [/^\/api\/academic\/programs(?:\/(.*))?$/, (m) => (m[1] ? `/v1/catalog/programs/${m[1]}` : '/v1/catalog/programs')],
  [/^\/api\/academic\/groups(?:\/(.*))?$/, (m) => (m[1] ? `/v1/catalog/sections/${m[1]}` : '/v1/catalog/sections')],
  [/^\/api\/academic\/rooms(?:\/(.*))?$/, (m) => (m[1] ? `/v1/resources/rooms/${m[1]}` : '/v1/resources/rooms')],
  [/^\/api\/timetable\/generate$/, () => '/v1/scheduling/generate'],
  [/^\/api\/timetable\/sessions$/, () => '/v1/timetable/sessions'],
  [/^\/api\/timetable\/move$/, () => '/v1/timetable/sessions/move'],
  [/^\/api\/timetable\/swap$/, () => '/v1/timetable/sessions/swap'],
  [/^\/api\/timetable\/approve$/, () => '/v1/timetable/admin-approval'],
  [/^\/api\/timetable\/department-approval$/, () => '/v1/timetable/hod-approval'],
  [/^\/api\/voting\/polls$/, () => '/v1/voting/polls'],
  [/^\/api\/voting\/polls\/([^/]+)\/close$/, (m) => `/v1/voting/polls/${m[1]}/close`],
  [/^\/api\/voting\/polls\/([^/]+)\/apply$/, (m) => `/v1/voting/polls/${m[1]}/apply`],
  [/^\/api\/notifications$/, () => '/v1/notifications'],
  [/^\/api\/notifications\/([^/]+)\/read$/, (m) => `/v1/notifications/${m[1]}/read`],
  [/^\/api\/audit$/, () => '/v1/governance/audit'],
  [/^\/api\/admin\/users$/, () => '/v1/admin/users'],
  [/^\/api\/health\/live$/, () => '/health'],
  [/^\/api\/health\/ready$/, () => '/ready'],
];

export function isNormalizedV2ApiEnabled(): boolean {
  return String(import.meta.env.VITE_USE_NORMALIZED_V2_API || '').toLowerCase() === 'true';
}

export function resolveNormalizedV2Endpoint(endpoint: string): string {
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!isNormalizedV2ApiEnabled()) return normalized;

  const base = String(import.meta.env.VITE_V2_API_BASE_URL || '').replace(/\/+$/, '');
  for (const [pattern, builder] of LEGACY_TO_V2_PREFIX_MAP) {
    const match = normalized.match(pattern);
    if (match) {
      return `${base}${builder(match)}`;
    }
  }
  if (import.meta.env.DEV && normalized.startsWith('/api/')) {
    console.warn(`[V2 CUTOVER WARNING] Endpoint "${normalized}" still targets legacy server.ts compatibility route.`);
  }
  return normalized;
}
