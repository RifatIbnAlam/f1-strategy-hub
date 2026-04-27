/**
 * OpenF1 API Service
 * Real-time and historical Formula 1 data
 * Docs: https://openf1.org
 *
 * Free for historical data. No authentication required.
 * Rate limit: Be respectful, cache aggressively.
 */

const BASE_URL = 'https://api.openf1.org/v1';

// Simple in-memory cache to avoid redundant API calls
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchWithCache(endpoint, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
  const cacheKey = url;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OpenF1 API error: ${response.status}`);
    const data = await response.json();

    cache.set(cacheKey, { data, timestamp: Date.now() });
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
