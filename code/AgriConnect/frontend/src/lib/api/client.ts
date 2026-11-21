import { tt } from '@/lib/i18n/active-locale';
import { API_BASE_URL } from '../env';
import { ApiError } from './errors';
import { tokenStore } from './token-store';
import type { Pagination } from './types';

type QueryValue = string | number | boolean | undefined | null;

export interface ApiResult<T> {
  data: T;
  pagination?: Pagination;
  meta?: Record<string, unknown>;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, QueryValue> | object;
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

function toQuery(query?: Record<string, QueryValue> | object): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

async function readEnvelope(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as {
      success?: boolean;
      data?: unknown;
      pagination?: Pagination;
      meta?: Record<string, unknown>;
      error?: { code?: string; message?: string; fields?: Record<string, string[]> };
    };
  } catch {
    return null;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const envelope = await readEnvelope(response);
    if (!response.ok) {
      tokenStore.clear();
      return null;
    }
    const token =
      envelope && typeof envelope.data === 'object' && envelope.data
        ? (envelope.data as { accessToken?: string }).accessToken ?? null
        : null;
    tokenStore.set(token);
    return token;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { body, query, skipAuth, skipRefresh, headers, ...init } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const makeRequest = async () => {
    const token = skipAuth ? null : tokenStore.get();
    const requestHeaders = new Headers(headers);
    if (!isFormData && !requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }

    return fetch(`${API_BASE_URL}${path}${toQuery(query)}`, {
      ...init,
      cache: 'no-store',
      credentials: 'include',
      headers: requestHeaders,
      body: isFormData
        ? (body as FormData)
        : body === undefined
          ? undefined
          : JSON.stringify(body),
    });
  };

  let response = await makeRequest();
  let envelope = await readEnvelope(response);

  if (
    !skipRefresh &&
    !skipAuth &&
    response.status === 401 &&
    envelope?.error?.code === 'TOKEN_EXPIRED'
  ) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      response = await makeRequest();
      envelope = await readEnvelope(response);
    }
  }

  if (!response.ok || envelope?.success === false) {
    throw new ApiError(
      response.status,
      envelope?.error?.code ?? 'INTERNAL_ERROR',
      envelope?.error?.message ?? tt('errors.requestFailed'),
      envelope?.error?.fields,
    );
  }

  return {
    data: (envelope?.data ?? null) as T,
    pagination: envelope?.pagination,
    meta: envelope?.meta,
  };
}

export async function apiRequestBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const { body, query, skipAuth, skipRefresh, headers, ...init } = options;

  const makeRequest = async () => {
    const token = skipAuth ? null : tokenStore.get();
    const requestHeaders = new Headers(headers);
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }

    return fetch(`${API_BASE_URL}${path}${toQuery(query)}`, {
      ...init,
      cache: 'no-store',
      credentials: 'include',
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response = await makeRequest();

  if (!skipRefresh && !skipAuth && response.status === 401) {
    const envelope = await readEnvelope(response.clone());
    if (envelope?.error?.code === 'TOKEN_EXPIRED') {
      const nextToken = await refreshAccessToken();
      if (nextToken) {
        response = await makeRequest();
      }
    }
  }

  if (!response.ok) {
    const envelope = await readEnvelope(response);
    throw new ApiError(
      response.status,
      envelope?.error?.code ?? 'INTERNAL_ERROR',
      envelope?.error?.message ?? tt('errors.requestFailed'),
      envelope?.error?.fields,
    );
  }

  return response.blob();
}
