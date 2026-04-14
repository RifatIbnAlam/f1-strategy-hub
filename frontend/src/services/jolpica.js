/**
 * Jolpica F1 API Service (Ergast replacement)
 * Historical standings, results, schedules, and driver/constructor info
 * Docs: https://github.com/jolpica/jolpica-f1
 *
 * Free, no auth required. Rate limit: 200 requests/hour.
 * Drop-in replacement for Ergast: api.jolpi.ca/ergast/f1/
 */

const BASE_URL = 'https://api.jolpi.ca/ergast/f1';

const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min (historical data changes rarely)

async function fetchJolpica(path) {
  const [pathname, queryString] = path.split('?');
  const url = `${BASE_URL}${pathname}.json${queryString ? `?${queryString}` : ''}`;
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Jolpica API error: ${response.status}`);
    const data = await response.json();
    const result = data.MRData;

    cache.set(url, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error(`Jolpica fetch failed: ${path}`, error);
    throw error;
  }
}

// ─── Season Schedule ──────────────────────────────────────────────────────────

/**
 * Get the race schedule for a season
 */
export async function getSchedule(year = 'current') {
  const data = await fetchJolpica(`/${year}`);
  return data?.RaceTable?.Races || [];
}

// ─── Race Results ─────────────────────────────────────────────────────────────

/**
 * Get results for a specific race or all races in a season
 */
export async function getRaceResults(year, round = null) {
  const path = round ? `/${year}/${round}/results` : `/${year}/results`;
  const data = await fetchJolpica(path);
  return data?.RaceTable?.Races || [];
}

/**
 * Get the last race result
 */
export async function getLastRaceResult() {
  const data = await fetchJolpica('/current/last/results');
  return data?.RaceTable?.Races?.[0] || null;
}

// ─── Standings ────────────────────────────────────────────────────────────────

/**
 * Get driver standings for a season (or after a specific round)
 */
export async function getDriverStandings(year = 'current', round = null) {
  const path = round
    ? `/${year}/${round}/driverStandings`
    : `/${year}/driverStandings`;
  const data = await fetchJolpica(path);
  return data?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
}

/**
 * Get constructor standings for a season
 */
export async function getConstructorStandings(year = 'current', round = null) {
  const path = round
    ? `/${year}/${round}/constructorStandings`
    : `/${year}/constructorStandings`;
  const data = await fetchJolpica(path);
  return data?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
}

// ─── Qualifying ───────────────────────────────────────────────────────────────

/**
 * Get qualifying results
 */
export async function getQualifyingResults(year, round) {
  const data = await fetchJolpica(`/${year}/${round}/qualifying`);
  return data?.RaceTable?.Races?.[0]?.QualifyingResults || [];
}

// ─── Driver & Constructor Info ────────────────────────────────────────────────

/**
 * Get all drivers for a season
 */
export async function getDriversForSeason(year = 'current') {
  const data = await fetchJolpica(`/${year}/drivers`);
  return data?.DriverTable?.Drivers || [];
}

/**
 * Get all constructors for a season
 */
export async function getConstructors(year = 'current') {
  const data = await fetchJolpica(`/${year}/constructors`);
  return data?.ConstructorTable?.Constructors || [];
}

// ─── Lap Times ────────────────────────────────────────────────────────────────

/**
 * Get lap times for a specific race
 */
export async function getLapTimes(year, round, lapNumber = null) {
  const path = lapNumber
    ? `/${year}/${round}/laps/${lapNumber}`
    : `/${year}/${round}/laps`;
  const data = await fetchJolpica(path);
  return data?.RaceTable?.Races?.[0]?.Laps || [];
}

// ─── Pit Stops ────────────────────────────────────────────────────────────────

/**
 * Get pit stop data for a race
 */
export async function getPitStops(year, round) {
  const data = await fetchJolpica(`/${year}/${round}/pitstops`);
  return data?.RaceTable?.Races?.[0]?.PitStops || [];
}

// ─── Championship History ─────────────────────────────────────────────────────

/**
 * Get all world champions
 */
export async function getWorldChampions(limit = 100) {
  const seasons = await getSeasons(limit);
  const results = await Promise.allSettled(
    seasons.map(async ({ season }) => {
      const standings = await getDriverStandings(season);
      if (!standings?.length) return null;
      return {
        season,
        round: standings[0]?.position ? standings[0].position : undefined,
        DriverStandings: [standings[0]],
      };
    })
  );

  return results
    .filter(result => result.status === 'fulfilled' && result.value)
    .map(result => result.value);
}

/**
 * Get all constructor champions
 */
export async function getConstructorChampions(limit = 100) {
  const seasons = await getSeasons(limit);
  const results = await Promise.allSettled(
    seasons.map(async ({ season }) => {
      const standings = await getConstructorStandings(season);
      if (!standings?.length) return null;
      return {
        season,
        round: standings[0]?.position ? standings[0].position : undefined,
        ConstructorStandings: [standings[0]],
      };
    })
  );

  return results
    .filter(result => result.status === 'fulfilled' && result.value)
    .map(result => result.value);
}

// ─── Season list ──────────────────────────────────────────────────────────────

/**
 * Get all F1 seasons
 */
export async function getSeasons(limit = 100) {
  const data = await fetchJolpica(`/seasons?limit=${limit}`);
  return data?.SeasonTable?.Seasons || [];
}

export const jolpica = {
  getSchedule,
  getRaceResults,
  getLastRaceResult,
  getDriverStandings,
  getConstructorStandings,
  getQualifyingResults,
  getDriversForSeason,
  getConstructors,
  getLapTimes,
  getPitStops,
  getWorldChampions,
  getConstructorChampions,
  getSeasons,
};

export default jolpica;
