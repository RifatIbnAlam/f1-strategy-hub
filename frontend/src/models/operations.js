/**
 * Team operations scorecard.
 *
 * Turns a season of race results and pit stops into the kind of KPIs an
 * operations team tracks: execution speed, consistency, failure rate, and
 * what under-performance costs.
 *
 * Pit-stop times from Jolpica are pit-lane times (entry to exit), which vary
 * by circuit far more than between crews: Monaco's lane is short, Singapore's
 * long. So every stop is measured as a delta to that race's field median,
 * which isolates the crew's execution from the circuit.
 */

// Stops this far above the race median are drive-through penalties, repairs
// or red-flag stops, not crew execution. They're counted but not scored.
export const ANOMALY_THRESHOLD_S = 12;
// A stop more than this over the race median counts as "slow".
export const SLOW_STOP_THRESHOLD_S = 1.0;

const median = (arr) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const quantile = (arr, q) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

/** "22.345" or "1:02.345" → seconds. */
export function parseDuration(str) {
  if (str == null || str === '') return NaN;
  const parts = String(str).split(':');
  return parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(parts[0]);
}

const isClassified = (r) => /^\d+$/.test(r?.positionText || '');

/**
 * One row per pit stop, tagged with the driver's team in that race and the
 * delta to the race's field median.
 */
export function buildPitStopRows(seasonStops, races) {
  const raceByRound = Object.fromEntries((races || []).map(r => [String(r.round), r]));
  const rows = [];
  for (const { round, stops } of seasonStops || []) {
    const race = raceByRound[String(round)];
    if (!race) continue;
    const teamOf = Object.fromEntries((race.Results || []).map(r => [r.Driver?.driverId, r.Constructor]));
    const durations = stops.map(s => parseDuration(s.duration)).filter(Number.isFinite);
    const raceMedian = median(durations);
    for (const s of stops) {
      const duration = parseDuration(s.duration);
      const team = teamOf[s.driverId];
      if (!Number.isFinite(duration) || !team) continue;
      const delta = duration - raceMedian;
      rows.push({
        round: Number(round),
        raceName: race.raceName,
        driverId: s.driverId,
        teamId: team.constructorId,
        teamName: team.name,
        lap: Number(s.lap),
        duration,
        delta,
        anomalous: delta > ANOMALY_THRESHOLD_S,
      });
    }
  }
  return rows;
}

/**
 * Per-team KPIs from pit stops, race results and sprint results.
 */
export function teamScorecard(pitRows, races, sprints = []) {
  const teams = {};
  const team = (id, name) => (teams[id] ||= {
    teamId: id, teamName: name, starts: 0, classified: 0, points: 0, gains: [], deltas: [], anomalies: 0, rounds: new Set(),
  });

  for (const race of races || []) {
    for (const r of race.Results || []) {
      const t = team(r.Constructor?.constructorId, r.Constructor?.name);
      t.starts++;
      t.rounds.add(Number(race.round));
      t.points += parseFloat(r.points || 0);
      if (isClassified(r)) {
        t.classified++;
        const grid = parseInt(r.grid, 10);
        if (grid > 0) t.gains.push(grid - parseInt(r.position, 10));
      }
    }
  }
  for (const sprint of sprints || []) {
    for (const r of sprint.SprintResults || []) {
      const t = teams[r.Constructor?.constructorId];
      if (t) t.points += parseFloat(r.points || 0);
    }
  }
  for (const row of pitRows || []) {
    const t = team(row.teamId, row.teamName);
    if (row.anomalous) t.anomalies++;
    else t.deltas.push(row.delta);
  }

  return Object.values(teams)
    .filter(t => t.teamId)
    .map(t => {
      const med = median(t.deltas);
      // Time a crew loses against its own typical stop: the cost of inconsistency.
      const consistencyCost = t.deltas.reduce((a, d) => a + Math.max(0, d - med), 0);
      return {
        teamId: t.teamId,
        teamName: t.teamName,
        races: t.rounds.size,
        points: t.points,
        pointsPerRace: t.rounds.size ? t.points / t.rounds.size : 0,
        starts: t.starts,
        dnfRate: t.starts ? 1 - t.classified / t.starts : 0,
        avgGain: t.gains.length ? t.gains.reduce((a, g) => a + g, 0) / t.gains.length : 0,
        stops: t.deltas.length,
        anomalies: t.anomalies,
        pitMedian: med,
        pitP25: quantile(t.deltas, 0.25),
        pitP75: quantile(t.deltas, 0.75),
        pitIQR: quantile(t.deltas, 0.75) - quantile(t.deltas, 0.25),
        slowRate: t.deltas.length ? t.deltas.filter(d => d > SLOW_STOP_THRESHOLD_S).length / t.deltas.length : 0,
        consistencyCost,
      };
    })
    .sort((a, b) => b.points - a.points);
}

/** Median pit delta per team per round, for trend charts. */
export function pitTrend(pitRows) {
  const byRound = {};
  for (const r of pitRows || []) {
    if (r.anomalous) continue;
    const key = r.round;
    byRound[key] ||= { round: r.round, raceName: r.raceName, byTeam: {} };
    (byRound[key].byTeam[r.teamId] ||= []).push(r.delta);
  }
  return Object.values(byRound)
    .sort((a, b) => a.round - b.round)
    .map(({ round, raceName, byTeam }) => ({
      round,
      raceName,
      ...Object.fromEntries(Object.entries(byTeam).map(([team, ds]) => [team, +median(ds).toFixed(3)])),
    }));
}

/**
 * Headline findings: the best team on each KPI, written as sentences.
 * Teams with too few stops aren't ranked on pit metrics.
 */
export function headlineFindings(card, { minStops = 8 } = {}) {
  const pitTeams = card.filter(t => t.stops >= minStops);
  const by = (list, key, dir = 1) => [...list].sort((a, b) => dir * (a[key] - b[key]))[0];
  const fastest = by(pitTeams, 'pitMedian');
  const consistent = by(pitTeams, 'pitIQR');
  const reliable = by(card.filter(t => t.starts >= 4), 'dnfRate');
  const racer = by(card.filter(t => t.starts >= 4), 'avgGain', -1);
  const costly = by(pitTeams, 'consistencyCost', -1);
  return { fastest, consistent, reliable, racer, costly };
}
