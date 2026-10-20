/**
 * OpenF1 API Service
 * Real-time and historical Formula 1 data
 * Docs: https://openf1.org
 *
 * Free for historical data. No authentication required.
 * Rate limit: Be respectful, cache aggressively.
 */

import { fetchJson } from './snapshot';

const BASE_URL = 'https://api.openf1.org/v1';

// Simple in-memory cache to avoid redundant API calls
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Full request URL for an endpoint + params (also used by the snapshot script). */
export function buildUrl(endpoint, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  return `${BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
}

async function fetchWithCache(endpoint, params = {}) {
  const url = buildUrl(endpoint, params);
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // OpenF1's free tier is rate limited, and views like the undercut analyzer
    // fire several calls at once: fetchJson retries on HTTP 429 and falls back
    // to the offline snapshot if the API stays unavailable.
    const data = await fetchJson(url, { backoffMs: 700 });
    cache.set(url, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`OpenF1 fetch failed: ${endpoint}`, error);
    throw error;
  }
}

// ─── Session Endpoints ────────────────────────────────────────────────────────

/**
 * Get sessions (practice, qualifying, race) for a given year
 */
export async function getSessions(year, sessionType = null) {
  const params = { year };
  if (sessionType) params.session_type = sessionType;
  return fetchWithCache('/sessions', params);
}

/**
 * Get meetings (Grand Prix weekends) for a year. /sessions has no
 * meeting_name, so this is used to label sessions with their event name.
 */
export async function getMeetings(year) {
  return fetchWithCache('/meetings', { year });
}

/**
 * Race-type sessions (Grand Prix and Sprint) for a year that have already
 * started, newest first, each enriched with its meeting_name.
 */
export async function getRaceSessions(year) {
  const [sessions, meetings] = await Promise.all([
    fetchWithCache('/sessions', { year, session_type: 'Race' }),
    getMeetings(year).catch(() => []),
  ]);
  const names = {};
  (meetings || []).forEach(m => { names[m.meeting_key] = m.meeting_name; });
  const now = Date.now();
  return (sessions || [])
    .filter(s => !s.date_start || new Date(s.date_start).getTime() <= now)
    .map(s => ({ ...s, meeting_name: s.meeting_name || names[s.meeting_key] }))
    .sort((a, b) => new Date(b.date_start || 0) - new Date(a.date_start || 0));
}

/**
 * Human-readable session label: "Italian Grand Prix — Race (Sep 7)".
 */
export function formatSessionLabel(session) {
  const event = session.meeting_name?.trim()
    || [session.location, session.country_name].filter(Boolean).join(', ')
    || session.circuit_short_name
    || `Session ${session.session_key}`;
  const name = session.session_name?.trim() || 'Race';
  const date = session.date_start
    ? new Date(session.date_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  return `${event} — ${name}${date ? ` (${date})` : ''}`;
}

/**
 * OpenF1 returns one driver row per session; dedupe by driver number and
 * sort by team so teammates sit together in dropdowns.
 */
export function uniqueDrivers(drivers) {
  if (!drivers) return [];
  const seen = new Set();
  return drivers
    .filter(d => {
      if (seen.has(d.driver_number)) return false;
      seen.add(d.driver_number);
      return true;
    })
    .sort((a, b) => (a.team_name || '').localeCompare(b.team_name || '') || a.driver_number - b.driver_number);
}

/**
 * Get the most recent session
 *
 * OpenF1's /sessions endpoint does not return meeting_name; it lives on
 * /meetings. We fetch the matching meeting in parallel so callers can rely
 * on meeting_name being populated. Falls back gracefully if the meeting
 * lookup fails — the session fields (location, country_name,
 * circuit_short_name) are always available as a last resort.
 */
export async function getLatestSession() {
  const data = await fetchWithCache('/sessions', { session_key: 'latest' });
  const session = Array.isArray(data) ? data[0] : data;
  if (!session) return session;

  // Best-effort enrichment with meeting_name. Never let a failure here
  // bubble up — the dashboard should still render something useful.
  if (!session.meeting_name && session.meeting_key) {
    try {
      const meetings = await fetchWithCache('/meetings', {
        meeting_key: session.meeting_key,
      });
      const meeting = Array.isArray(meetings) ? meetings[0] : meetings;
      if (meeting?.meeting_name) {
        session.meeting_name = meeting.meeting_name;
      }
    } catch (_) {
      // Swallow — fallback chain in the consumer handles the empty case.
    }
  }

  // Final fallback so the consumer never has to repeat this logic.
  if (!session.meeting_name) {
    session.meeting_name =
      session.circuit_short_name ||
      session.location ||
      session.country_name ||
      '';
  }

  return session;
}

// ─── Driver Endpoints ─────────────────────────────────────────────────────────

/**
 * Get drivers in a session
 */
export async function getDrivers(sessionKey) {
  return fetchWithCache('/drivers', { session_key: sessionKey });
}

// ─── Lap Data ─────────────────────────────────────────────────────────────────

/**
 * Get lap times for a session
 */
export async function getLaps(sessionKey, driverNumber = null) {
  const params = { session_key: sessionKey };
  if (driverNumber) params.driver_number = driverNumber;
  return fetchWithCache('/laps', params);
}

// ─── Position Data ────────────────────────────────────────────────────────────

/**
 * Get position data (live timing intervals)
 */
export async function getPositions(sessionKey) {
  return fetchWithCache('/position', { session_key: sessionKey });
}

// ─── Car Telemetry ────────────────────────────────────────────────────────────

/**
 * Get car telemetry data (speed, throttle, brake, RPM, gear, DRS)
 * Warning: Large dataset — always filter by driver and optionally by time range
 */
export async function getCarData(sessionKey, driverNumber, dateGte = null, dateLte = null) {
  const params = { session_key: sessionKey, driver_number: driverNumber };
  if (dateGte) params['date>'] = dateGte;
  if (dateLte) params['date<'] = dateLte;
  return fetchWithCache('/car_data', params);
}

// ─── Stints (Tire Data) ──────────────────────────────────────────────────────

/**
 * Get stint/tire data — compound, stint number, lap start/end
 */
export async function getStints(sessionKey, driverNumber = null) {
  const params = { session_key: sessionKey };
  if (driverNumber) params.driver_number = driverNumber;
  return fetchWithCache('/stints', params);
}

// ─── Weather ──────────────────────────────────────────────────────────────────

/**
 * Get weather data for a session
 */
export async function getWeather(sessionKey) {
  return fetchWithCache('/weather', { session_key: sessionKey });
}

// ─── Race Control ─────────────────────────────────────────────────────────────

/**
 * Get race control messages (flags, penalties, VSC, SC, red flags)
 */
export async function getRaceControl(sessionKey) {
  return fetchWithCache('/race_control', { session_key: sessionKey });
}

// ─── Intervals ────────────────────────────────────────────────────────────────

/**
 * Get interval data (gap to leader and gap ahead)
 */
export async function getIntervals(sessionKey) {
  return fetchWithCache('/intervals', { session_key: sessionKey });
}

// ─── Pit Data ─────────────────────────────────────────────────────────────────

/**
 * Get pit stop data
 */
export async function getPitData(sessionKey, driverNumber = null) {
  const params = { session_key: sessionKey };
  if (driverNumber) params.driver_number = driverNumber;
  return fetchWithCache('/pit', params);
}

// ─── Location (GPS) ──────────────────────────────────────────────────────────

/**
 * Get car location data on track (x, y, z coordinates)
 * Warning: Very large dataset — always filter by driver and time range
 */
export async function getLocation(sessionKey, driverNumber, dateGte = null, dateLte = null) {
  const params = { session_key: sessionKey, driver_number: driverNumber };
  if (dateGte) params['date>'] = dateGte;
  if (dateLte) params['date<'] = dateLte;
  return fetchWithCache('/location', params);
}

// ─── Team Radio ──────────────────────────────────────────────────────────────

/**
 * Get team radio messages
 */
export async function getTeamRadio(sessionKey, driverNumber = null) {
  const params = { session_key: sessionKey };
  if (driverNumber) params.driver_number = driverNumber;
  return fetchWithCache('/team_radio', params);
}

export const openf1 = {
  getSessions,
  getMeetings,
  getRaceSessions,
  getLatestSession,
  getDrivers,
  getLaps,
  getPositions,
  getCarData,
  getStints,
  getWeather,
  getRaceControl,
  getIntervals,
  getPitData,
  getLocation,
  getTeamRadio,
};

export default openf1;
