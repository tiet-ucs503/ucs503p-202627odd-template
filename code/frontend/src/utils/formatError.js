/**
 * formatError.js - Helper to parse backend error responses cleanly.
 *
 * Handles:
 * - FastAPI validation error arrays: [{ loc: [...], msg: "..." }]
 * - Detail strings: { detail: "User already exists" }
 * - Detail objects or message fields
 * - Network errors (backend not running or connection refused)
 */
export function formatError(err, fallback = 'An unexpected error occurred. Please try again.') {
  if (!err) return fallback;

  // 1. Check response data
  const data = err.response?.data;
  if (data) {
    // If detail is an array (FastAPI 422 validation errors)
    if (Array.isArray(data.detail)) {
      const messages = data.detail.map((item) => {
        if (typeof item === 'string') return item;
        const field = item.loc ? item.loc[item.loc.length - 1] : '';
        const msg = item.msg || JSON.stringify(item);
        return field && field !== 'body' ? `${field}: ${msg}` : msg;
      });
      return messages.join('; ');
    }

    // If detail is a plain string
    if (typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail;
    }

    // If detail is an object
    if (data.detail && typeof data.detail === 'object') {
      return JSON.stringify(data.detail);
    }

    // If message is a string
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
  }

  // 2. Check Axios network error
  if (err.message) {
    if (err.message.toLowerCase().includes('network error')) {
      return 'Unable to connect to server. Please check if the backend is running at http://localhost:8000';
    }
    return err.message;
  }

  return fallback;
}