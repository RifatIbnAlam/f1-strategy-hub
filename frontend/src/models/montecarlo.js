/**
 * Monte Carlo race simulation with random safety cars.
 *
 * A deterministic plan ignores the single biggest source of strategy luck: a
 * safety car (SC) makes a pit stop far cheaper because the field is slowed
 * while you're in the pit lane. This module samples thousands of races with
 * randomly timed SC periods and reports each strategy's distribution of race
 * times and how often it wins.
 *
 * Modelling choices (kept deliberately simple and explicit):
 * - SC count per race ~ Poisson(scRate); each starts on a uniformly random
 *   lap and lasts 3–5 laps.
 * - SC laps run at SC_PACE x base pace for everyone, so tyre and fuel
 *   differences don't matter on those laps.
 * - A stop made under SC costs SC_PIT_FACTOR x the normal pit loss.
 * - With `react` on, a planned stop is brought forward to the first SC lap
 *   within REACT_WINDOW laps before it, as teams do ("free" stop).
 * - All strategies in one simulated race see the same SC timing (common
 *   random numbers), so comparisons between them have much lower variance.
 */
import { lapTime } from './strategy';

export const SC_PACE = 1.4;
export const SC_PIT_FACTOR = 0.45;
export const REACT_WINDOW = 8;
const MIN_STINT = 3;

/** Small, fast, seedable PRNG (mulberry32) so results are reproducible. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

/** Boolean array indexed by race lap (1..N): true where the SC is out. */
export function sampleSafetyCars(rng, totalLaps, rate) {
  const sc = new Array(totalLaps + 1).fill(false);
  const count = poisson(rng, rate);
  for (let i = 0; i < count; i++) {
    const start = 2 + Math.floor(rng() * Math.max(totalLaps - 4, 1));
    const length = 3 + Math.floor(rng() * 3);
    for (let lap = start; lap < start + length && lap <= totalLaps; lap++) sc[lap] = true;
  }
  return sc;
}

/** Laps on which the car pits (end of each stint but the last), after reacting to SCs. */
export function pitLaps(stints, sc, react) {
  const planned = [];
  let lap = 0;
  stints.slice(0, -1).forEach(s => { lap += s.laps; planned.push(lap); });
  if (!react) return planned;

  const actual = [];
  let last = 0;
  for (const p of planned) {
    let chosen = p;
    for (let l = Math.max(p - REACT_WINDOW, last + MIN_STINT); l < p; l++) {
      if (sc[l]) { chosen = l; break; }
    }
    actual.push(chosen);
    last = chosen;
  }
  return actual;
}

/** Race time for one strategy in one sampled race. */
export function raceTime(stints, circuit, options, sc, react) {
  const pits = pitLaps(stints, sc, react);
  const N = circuit.totalLaps;
  const scLap = circuit.basePace * SC_PACE;
  let total = 0;
  let stint = 0;
  let age = 0;
  for (let lap = 1; lap <= N; lap++) {
    total += sc[lap] ? scLap : lapTime(circuit, options, stints[stint].compound, lap, age);
    age++;
    if (stint < pits.length && lap === pits[stint]) {
      total += circuit.pitLoss * (sc[lap] ? SC_PIT_FACTOR : 1);
      stint++;
      age = 0;
    }
  }
  return total;
}

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

/**
 * Simulate `sims` races and summarise each strategy.
 * Returns per-strategy stats plus the raw per-race times for pairwise use.
 */
export function monteCarlo(strategies, circuit, options, { sims = 2000, rate = circuit.scRate ?? 0.7, react = true, seed = 42 } = {}) {
  const rng = mulberry32(seed);
  const times = strategies.map(() => new Float64Array(sims));
  const wins = new Array(strategies.length).fill(0);
  let racesWithSC = 0;

  for (let i = 0; i < sims; i++) {
    const sc = sampleSafetyCars(rng, circuit.totalLaps, rate);
    if (sc.some(Boolean)) racesWithSC++;
    let best = Infinity;
    strategies.forEach((s, j) => {
      times[j][i] = raceTime(s.stints, circuit, options, sc, react);
      best = Math.min(best, times[j][i]);
    });
    // Similar plans often finish in an identical time (e.g. both pit on the
    // same SC lap); share the win instead of crediting whichever is listed first.
    const winners = strategies.map((_, j) => j).filter(j => times[j][i] - best < 1e-6);
    winners.forEach(j => { wins[j] += 1 / winners.length; });
  }

  const stats = strategies.map((s, j) => {
    const sorted = Array.from(times[j]).sort((a, b) => a - b);
    const mean = sorted.reduce((a, t) => a + t, 0) / sims;
    return {
      ...s,
      mean,
      p10: quantile(sorted, 0.1),
      p50: quantile(sorted, 0.5),
      p90: quantile(sorted, 0.9),
      winRate: wins[j] / sims,
    };
  });

  return { stats, times, sims, scShare: racesWithSC / sims };
}

/** Distribution of (b - a) race-time deltas from paired simulations. */
export function pairedDelta(timesA, timesB, bins = 30) {
  const deltas = Array.from(timesB, (t, i) => t - timesA[i]);
  const aWins = deltas.filter(d => d > 0).length / deltas.length;
  const lo = Math.min(...deltas);
  const hi = Math.max(...deltas);
  const width = (hi - lo) / bins || 1;
  const hist = Array.from({ length: bins }, (_, i) => ({ x: lo + (i + 0.5) * width, count: 0 }));
  deltas.forEach(d => { hist[Math.min(bins - 1, Math.floor((d - lo) / width))].count++; });
  const mean = deltas.reduce((a, d) => a + d, 0) / deltas.length;
  return { aWins, mean, hist };
}
