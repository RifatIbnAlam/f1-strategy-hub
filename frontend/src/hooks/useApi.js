import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for API calls with loading/error states and caching
 */
export function useApi(fetchFn, deps = [], enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err.message || 'An error occurred');
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

/**
 * Format a lap time from seconds to MM:SS.mmm
 */
export function formatLapTime(seconds) {
  if (!seconds || seconds <= 0) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
}

/**
 * Format seconds to a gap string (+X.XXXs)
 */
export function formatGap(seconds) {
  if (!seconds) return '--';
  if (seconds === 0) return 'LEADER';
  return `+${seconds.toFixed(3)}s`;
}

/**
 * Parse an ISO time string to seconds
 */
export function timeToSeconds(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(timeStr);
}
