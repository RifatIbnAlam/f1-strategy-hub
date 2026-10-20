import React, { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { snapshotState, onSnapshotChange, getSnapshotIndex } from '../services/snapshot';

/**
 * Tells the viewer when they're looking at the build-time snapshot instead of
 * live API data, either because a live request failed or because ?demo
 * forced offline mode.
 */
export default function SnapshotBanner() {
  const [state, setState] = useState({ ...snapshotState });
  const [index, setIndex] = useState(null);

  useEffect(() => onSnapshotChange(setState), []);
  useEffect(() => {
    if (state.forced || state.active) getSnapshotIndex().then(setIndex);
  }, [state.forced, state.active]);

  if (!state.forced && !state.active) return null;

  const when = index?.generatedAt
    ? new Date(index.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  let message;
  if (state.forced && !index) {
    message = 'Demo mode is on, but this build has no offline snapshot. Remove ?demo from the URL to use live data.';
  } else if (state.forced) {
    message = `Demo mode: serving the offline snapshot captured ${when}${index.race ? ` (latest race: ${index.race.meeting_name})` : ''}. Remove ?demo for live data.`;
  } else {
    message = `A live data source is unavailable, so some panels are showing the snapshot captured ${when || 'at build time'}.`;
  }

  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
      padding: '10px 14px', borderRadius: 10, fontSize: 12,
      background: 'rgba(212, 168, 0, 0.12)', border: '1px solid rgba(212, 168, 0, 0.35)',
      color: 'var(--text-secondary)',
    }}>
      <Database size={16} color="#D4A800" style={{ flexShrink: 0 }} />
      <span>{message}</span>
    </div>
  );
}
