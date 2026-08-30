import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for API calls with loading/error/data states.
 * @param {Function} apiFn - The API function to call
 * @param {Array} deps - Dependencies to trigger re-fetch
 * @param {boolean} immediate - Whether to fetch immediately
 */
export function useApi(apiFn, deps = [], immediate = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'Something went wrong');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFn]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [...deps, immediate]);

  return { data, loading, error, execute, setData };
}
