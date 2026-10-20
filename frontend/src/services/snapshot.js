/* global globalThis */
/**
 * Offline snapshot layer.
 *
 * At deploy time, CI runs `scripts/snapshot.mjs`, which calls the real service
 * functions against the live APIs and saves every JSON response under
 * `public/snapshot/`, keyed by request URL. At runtime, if a live request
 * fails (API down, rate limited, no network) the services transparently
 * serve the saved response instead, and the app shows a banner saying so.
 *
 * Adding `?demo` to the URL forces snapshot-only mode, which makes a live
 * demo independent of venue Wi-Fi or third-party uptime.
 */

const SNAPSHOT_BASE = `${process.env.PUBLIC_URL || ''}/snapshot`;

/** FNV-1a hash → stable, filesystem-safe file name for a request key. */
export function hashKey(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Request key: host + path + query, without the scheme. */
export function snapshotKey(url) {
  return url.replace(/^https?:\/\//, '');
}

// ─── Runtime state (read by the UI banner) ─────────────────────────────────

const listeners = new Set();
export const snapshotState = {
  forced: typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo'),
  active: false,       // at least one response has been served from the snapshot
  generatedAt: null,
};

export function onSnapshotChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function markActive(generatedAt) {
  if (snapshotState.active) return;
  snapshotState.active = true;
  snapshotState.generatedAt = generatedAt;
  listeners.forEach(fn => fn({ ...snapshotState }));
}

let indexPromise = null;
function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${SNAPSHOT_BASE}/index.json`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return indexPromise;
}

/** The snapshot manifest (season, race, timestamp), or null if none is deployed. */
export function getSnapshotIndex() {
  return loadIndex();
}

async function readSnapshot(url) {
  const index = await loadIndex();
  const key = snapshotKey(url);
  if (!index?.keys?.includes(key)) return undefined;
  const res = await fetch(`${SNAPSHOT_BASE}/${hashKey(key)}.json`);
  if (!res.ok) return undefined;
  const data = await res.json();
  markActive(index.generatedAt);
  return data;
}

// Recording hook used only by the snapshot script under Node.
function record(url, data) {
  if (typeof globalThis.__F1_SNAPSHOT_RECORD__ === 'function') {
    globalThis.__F1_SNAPSHOT_RECORD__(snapshotKey(url), data);
  }
}

/**
 * Fetch JSON with retry on HTTP 429, falling back to the offline snapshot
 * when the live request fails. Returns the raw response body.
 */
export async function fetchJson(url, { retries = 3, backoffMs = 700 } = {}) {
  if (snapshotState.forced) {
    const saved = await readSnapshot(url);
    if (saved !== undefined) return saved;
    throw new Error('Not available in the offline snapshot');
  }

  try {
    let response;
    for (let attempt = 0; attempt < retries; attempt++) {
      response = await fetch(url);
      if (response.status !== 429) break;
      await new Promise(resolve => setTimeout(resolve, backoffMs * 2 ** attempt));
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    record(url, data);
    return data;
  } catch (error) {
    const saved = await readSnapshot(url).catch(() => undefined);
    if (saved !== undefined) return saved;
    throw error;
  }
}
