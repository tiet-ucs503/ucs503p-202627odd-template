import { tt } from '@/lib/i18n/active-locale';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function formatFieldErrors(fields?: Record<string, string[]>) {
  if (!fields) return '';
  return Object.entries(fields)
    .flatMap(([key, messages]) => messages.map((message) => `${key}: ${message}`))
    .join(' · ');
}

export function getErrorMessage(error: unknown, fallback?: string) {
  if (error instanceof ApiError) {
    const fieldDetail = formatFieldErrors(error.fields);
    if (fieldDetail) {
      return `${error.message} (${fieldDetail})`;
    }
    return error.message;
  }
  if (error instanceof Error) {
    if (/failed to fetch|networkerror|load failed|econnrefused/i.test(error.message)) {
      return tt('errors.network');
    }
    return error.message;
  }
  return fallback ?? tt('common.errorGeneric');
}
