/**
 * Jolpica F1 API Service (Ergast replacement)
 * Historical standings, results, schedules, and driver/constructor info
 * Docs: https://github.com/jolpica/jolpica-f1
 *
 * Free, no auth required. Rate limited (burst ~4 req/s, ~500 requests/hour).
 * Drop-in replacement for Ergast: api.jolpi.ca/ergast/f1/
 */

import { fetchJson } from './snapshot';

const BASE_URL = 'https://api.jolpi.ca/ergast/f1';

const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min (historical data changes rarely)

/**
 * Paginate through a Jolpica endpoint (max limit per request = 100).
 * Returns all collected MRData responses merged into one array.
 * `extractFn(MRData)` should return the array of items from each page.
 */
async function fetchAllPages(basePath, extractFn) {
  const PAGE = 100;
  let all = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const sep = basePath.includes('?') ? '&' : '?';
    const data = await fetchJolpica(`${basePath}${sep}limit=${PAGE}&offset=${offset}`);
    const items = extractFn(data) || [];
    const total = parseInt(data?.total) || 0;

    all = all.concat(items);
    offset += PAGE;
    if (!items.length || offset >= total || total === 0) break;
  }
  return all;
}

/** Full request URL for a Jolpica path (also used by the snapshot script). */
export function buildUrl(path) {
  const [pathname, queryString] = path.split('?');
  return `${BASE_URL}${pathname}.json${queryString ? `?${queryString}` : ''}`;
}

async function fetchJolpica(path) {
  const url = buildUrl(path);
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Jolpica enforces a burst limit (~4 req/s) that paginated season queries
    // can trip; fetchJson backs off on 429 and falls back to the snapshot.
    const data = await fetchJson(url, { backoffMs: 600 });
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
  const data = await fetchJolpica(`/${year}?limit=100`);
  return data?.RaceTable?.Races || [];
}

// ─── Race Results ─────────────────────────────────────────────────────────────

/**
 * Get results for a specific race or all races in a season
 */
export async function getRaceResults(year, round = null) {
  if (round) {
    const data = await fetchJolpica(`/${year}/${round}/results?limit=100`);
    return data?.RaceTable?.Races || [];
  }
  // Full season: 24 races × 20 results = 480 entries — needs pagination
  const allResults = await fetchAllPages(
    `/${year}/results`,
    data => data?.RaceTable?.Races || []
  );
  // Merge races — same race can span multiple pages
  const merged = {};
  for (const race of allResults) {
    if (!merged[race.round]) {
      merged[race.round] = { ...race, Results: [...(race.Results || [])] };
    } else {
      merged[race.round].Results.push(...(race.Results || []));
    }
  }
  return Object.values(merged).sort((a, b) => parseInt(a.round) - parseInt(b.round));
}

/**
 * Get sprint results for a whole season. Sprint points count toward the
 * championship, so any points-progression chart must include them.
 */
export async function getSprintResults(year) {
  const allResults = await fetchAllPages(
    `/${year}/sprint`,
    data => data?.RaceTable?.Races || []
  );
  const merged = {};
  for (const race of allResults) {
    if (!merged[race.round]) {
      merged[race.round] = { ...race, SprintResults: [...(race.SprintResults || [])] };
    } else {
      merged[race.round].SprintResults.push(...(race.SprintResults || []));
    }
  }
  return Object.values(merged).sort((a, b) => parseInt(a.round) - parseInt(b.round));
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
 * Get qualifying results (single round or full season)
 */
export async function getQualifyingResults(year, round = null) {
  if (round) {
    const data = await fetchJolpica(`/${year}/${round}/qualifying?limit=100`);
    return data?.RaceTable?.Races?.[0]?.QualifyingResults || [];
  }
  // Full season: 24 races × 20 drivers = 480 entries — needs pagination
  const allResults = await fetchAllPages(
    `/${year}/qualifying`,
    data => data?.RaceTable?.Races || []
  );
  const merged = {};
  for (const race of allResults) {
    if (!merged[race.round]) {
      merged[race.round] = { ...race, QualifyingResults: [...(race.QualifyingResults || [])] };
    } else {
      merged[race.round].QualifyingResults.push(...(race.QualifyingResults || []));
    }
  }
  return Object.values(merged).sort((a, b) => parseInt(a.round) - parseInt(b.round));
}

// ─── Driver & Constructor Info ────────────────────────────────────────────────

/**
 * Get all drivers for a season
 */
export async function getDriversForSeason(year = 'current') {
  const data = await fetchJolpica(`/${year}/drivers?limit=100`);
  return data?.DriverTable?.Drivers || [];
}

/**
 * Get all constructors for a season
 */
export async function getConstructors(year = 'current') {
  const data = await fetchJolpica(`/${year}/constructors?limit=100`);
  return data?.ConstructorTable?.Constructors || [];
}

// ─── Lap Times ────────────────────────────────────────────────────────────────

/**
 * Get lap times for a specific race.
 * The API paginates on individual Timing entries (not Laps), so a 57-lap
 * race with 20 drivers = 1140 entries. We auto-paginate and merge any laps
 * that get split across page boundaries.
 */
export async function getLapTimes(year, round, lapNumber = null) {
  if (lapNumber) {
    const data = await fetchJolpica(`/${year}/${round}/laps/${lapNumber}?limit=100`);
    return data?.RaceTable?.Races?.[0]?.Laps || [];
  }

  // Jolpica API max limit is 100 and it paginates on Timing entries
  // (not Laps). A 57-lap race × 20 drivers = 1140 entries → 12 pages.
  const PAGE = 100;
  let allLaps = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await fetchJolpica(
      `/${year}/${round}/laps?limit=${PAGE}&offset=${offset}`
    );
    const laps = data?.RaceTable?.Races?.[0]?.Laps || [];
    const total = parseInt(data?.total) || 0;

    if (!laps.length) break;

    // Merge — a single lap's Timings can span two pages
    for (const lap of laps) {
      const existing = allLaps.find(l => l.number === lap.number);
      if (existing) {
        existing.Timings = [...(existing.Timings || []), ...(lap.Timings || [])];
      } else {
        allLaps.push({ ...lap, Timings: [...(lap.Timings || [])] });
      }
    }

    offset += PAGE;
    if (offset >= total || total === 0) break;
  }

  return allLaps;
}

// ─── Pit Stops ────────────────────────────────────────────────────────────────

/**
 * Get pit stop data for a race
 */
export async function getPitStops(year, round) {
  const data = await fetchJolpica(`/${year}/${round}/pitstops?limit=100`);
  return data?.RaceTable?.Races?.[0]?.PitStops || [];
}

/**
 * Pit stops for several rounds. Requests run a couple at a time to stay
 * under Jolpica's burst limit; a round that fails is skipped, not fatal.
 * Returns [{ round, stops }] in round order.
 */
export async function getSeasonPitStops(year, rounds, concurrency = 2) {
  const out = [];
  const queue = [...rounds];
  const worker = async () => {
    while (queue.length) {
      const round = queue.shift();
      try {
        out.push({ round: String(round), stops: await getPitStops(year, round) });
      } catch (_) {
        // Missing data for one race shouldn't hide the rest of the season.
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out.sort((a, b) => Number(a.round) - Number(b.round));
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
  getSprintResults,
  getLastRaceResult,
  getDriverStandings,
  getConstructorStandings,
  getQualifyingResults,
  getDriversForSeason,
  getConstructors,
  getLapTimes,
  getPitStops,
  getSeasonPitStops,
  getSeasons,
};

export default jolpica;
