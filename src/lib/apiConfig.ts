import { resolveNormalizedV2Endpoint } from './v2ApiAdapter';

export const API_BASE_URL: string = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function getResolvedApiBaseUrl(): string {
  return API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
}

export function apiUrl(endpoint: string): string {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const resolved = resolveNormalizedV2Endpoint(endpoint);
  if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
    return resolved;
  }
  return `${API_BASE_URL}${resolved.startsWith('/') ? resolved : `/${resolved}`}`;
}
