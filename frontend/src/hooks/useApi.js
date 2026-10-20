import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for API calls with loading/error states.
 *
 * - When `enabled` turns false the previous data is cleared, so a view never
 *   shows the last driver's laps under a newly selected session.
 * - Responses from superseded requests are dropped, so quickly switching
 *   selections can't let a slow, older response overwrite a newer one.
 */
export function useApi(fetchFn, deps = [], enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const execute = useCallback(async () => {
    const id = ++requestId.current;
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) {
        setData(null);
        setError(err.message || 'An error occurred');
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
