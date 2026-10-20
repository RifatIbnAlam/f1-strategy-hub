/**
 * Fit the strategy model to a real race.
 *
 * Every clean racing lap of every driver is one observation in a
 * fixed-effects least-squares regression:
 *
 *   lapTime = driverPace[d] + compoundOffset[c] + degRate[c] * tyreAge + k * (lap - 1)
 *
 * - driverPace absorbs car + driver speed, so compound and wear effects are
 *   estimated from within-driver variation (a fast car on hards doesn't make
 *   hards look quick).
 * - k is the combined per-lap gain from fuel burn and track evolution. These
 *   two can't be separated from timing data alone; the simulator gets them
 *   back by splitting k using its assumed fuel effect.
 * - tyreAge is the real age of the set, including laps run before the stint,
 *   so tyres used in qualifying are handled correctly.
 *
 * Compound offsets are relative to the hardest compound that was raced.
 */
import { COMPOUND_MODEL } from './strategy';

const DRY = ['SOFT', 'MEDIUM', 'HARD'];
const MIN_COMPOUND_LAPS = 15;
const MIN_DRIVER_LAPS = 8;

const median = (arr) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function stintsByDriver(stints) {
  const by = {};
  (stints || []).forEach(s => { (by[s.driver_number] ||= []).push(s); });
  Object.values(by).forEach(list => list.sort((a, b) => a.lap_start - b.lap_start));
  return by;
}

/**
 * Clean racing laps as regression rows. Drops lap 1, pit in/out laps, laps
 * without a time, non-slick stints, and laps outside [-5%, +7%] of the
 * driver's median (safety car, VSC, traffic, mistakes).
 */
export function cleanRaceLaps(laps, stints) {
  const rows = [];
  const byDriver = stintsByDriver(stints);
  for (const [dnKey, driverStints] of Object.entries(byDriver)) {
    const dn = Number(dnKey);
    const inLaps = new Set(driverStints.slice(0, -1).map(s => s.lap_end));
    const candidates = (laps || []).filter(l =>
      l.driver_number === dn && l.lap_duration > 0 && l.lap_number > 1 &&
      !l.is_pit_out_lap && !inLaps.has(l.lap_number)
    );
    const med = median(candidates.map(l => l.lap_duration));
    for (const l of candidates) {
      if (l.lap_duration > med * 1.07 || l.lap_duration < med * 0.95) continue;
      const stint = driverStints.find(s => l.lap_number >= s.lap_start && l.lap_number <= (s.lap_end ?? Infinity));
      if (!stint || !DRY.includes(stint.compound)) continue;
      rows.push({
        driver: dn,
        lap: l.lap_number,
        time: l.lap_duration,
        compound: stint.compound,
        age: (stint.tyre_age_at_start || 0) + (l.lap_number - stint.lap_start),
      });
    }
  }
  return rows;
}

/** Solve A x = b (A symmetric positive definite) by Gaussian elimination with partial pivoting. */
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const p = M[col][col];
    if (Math.abs(p) < 1e-12) throw new Error('Singular system');
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / p;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

/**
 * Fit the fixed-effects model. Returns { error } when the race can't support
 * a fit (wet race, too few clean laps, a single compound).
 */
export function fitRaceModel(allRows) {
  const compoundLaps = {};
  allRows.forEach(r => { compoundLaps[r.compound] = (compoundLaps[r.compound] || 0) + 1; });
  const compounds = DRY.filter(c => (compoundLaps[c] || 0) >= MIN_COMPOUND_LAPS);
  if (compounds.length < 2) {
    return { error: 'Fewer than two slick compounds with enough clean laps. Likely a wet or heavily interrupted race.' };
  }

  const driverLaps = {};
  allRows.forEach(r => { if (compounds.includes(r.compound)) driverLaps[r.driver] = (driverLaps[r.driver] || 0) + 1; });
  const drivers = Object.keys(driverLaps).map(Number).filter(d => driverLaps[d] >= MIN_DRIVER_LAPS);
  const rows = allRows.filter(r => compounds.includes(r.compound) && drivers.includes(r.driver));
  if (rows.length < 100) return { error: `Only ${rows.length} clean laps; not enough to fit.` };

  const reference = compounds[compounds.length - 1]; // hardest raced compound
  const offsetCompounds = compounds.filter(c => c !== reference);

  // Column layout: [driver pace…, compound offsets…, deg rates…, k]
  const col = {};
  let p = 0;
  drivers.forEach(d => { col[`d${d}`] = p++; });
  offsetCompounds.forEach(c => { col[`o${c}`] = p++; });
  compounds.forEach(c => { col[`g${c}`] = p++; });
  col.k = p++;

  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (const r of rows) {
    const x = [[col[`d${r.driver}`], 1], [col[`g${r.compound}`], r.age], [col.k, r.lap - 1]];
    if (r.compound !== reference) x.push([col[`o${r.compound}`], 1]);
    for (const [i, vi] of x) {
      Xty[i] += vi * r.time;
      for (const [j, vj] of x) XtX[i][j] += vi * vj;
    }
  }
  for (let i = 0; i < p; i++) XtX[i][i] += 1e-6; // tiny ridge for numerical stability

  const beta = solveLinear(XtX, Xty);

  const fit = {
    reference,
    compounds,
    laps: compoundLaps,
    driverPace: Object.fromEntries(drivers.map(d => [d, beta[col[`d${d}`]]])),
    offsets: Object.fromEntries(compounds.map(c => [c, c === reference ? 0 : beta[col[`o${c}`]]])),
    degRates: Object.fromEntries(compounds.map(c => [c, beta[col[`g${c}`]]])),
    lapSlope: beta[col.k],
    n: rows.length,
  };

  const predictions = rows.map(r => fit.driverPace[r.driver] + predictDelta(fit, r));
  const mean = rows.reduce((a, r) => a + r.time, 0) / rows.length;
  const ssRes = rows.reduce((a, r, i) => a + (r.time - predictions[i]) ** 2, 0);
  const ssTot = rows.reduce((a, r) => a + (r.time - mean) ** 2, 0);
  fit.r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  fit.residualStd = Math.sqrt(ssRes / Math.max(rows.length - p, 1));
  return fit;
}

/**
 * Model lap time relative to the driver's pace level. Compounds the fit never
 * saw fall back to the simulator's default offsets and wear rates.
 */
export function predictDelta(fit, row) {
  const c = row.compound;
  const seen = fit.compounds.includes(c);
  const offset = seen ? fit.offsets[c] : COMPOUND_MODEL[c].offset - COMPOUND_MODEL[fit.reference].offset;
  const deg = seen ? fit.degRates[c] : COMPOUND_MODEL[c].degRate;
  return offset + deg * row.age + fit.lapSlope * (row.lap - 1);
}

/**
 * Median time lost to a pit stop: (in-lap + out-lap) minus two normal laps,
 * where "normal" is the average of the laps just before and after the stop.
 */
export function estimatePitLoss(laps, stints) {
  const losses = [];
  const byDriver = stintsByDriver(stints);
  for (const [dnKey, driverStints] of Object.entries(byDriver)) {
    const dn = Number(dnKey);
    const own = (laps || []).filter(l => l.driver_number === dn && l.lap_duration > 0);
    const byLap = Object.fromEntries(own.map(l => [l.lap_number, l.lap_duration]));
    const normal = median(own.filter(l => l.lap_number > 1 && !l.is_pit_out_lap).map(l => l.lap_duration));
    for (const s of driverStints.slice(0, -1)) {
      const inLap = byLap[s.lap_end];
      const outLap = byLap[s.lap_end + 1];
      if (!inLap || !outLap) continue;
      // Compare against the laps either side of the stop, which carry the
      // same fuel load and tyre state; fall back to the race median.
      const before = byLap[s.lap_end - 1];
      const after = byLap[s.lap_end + 2];
      const reference = before && after ? (before + after) / 2 : normal;
      const loss = inLap + outLap - 2 * reference;
      if (loss > 10 && loss < 45) losses.push(loss);
    }
  }
  return losses.length ? median(losses) : null;
}

/** Classified finishing order (by laps completed, then time over the line). */
export function finishingOrder(laps) {
  const byDriver = {};
  (laps || []).forEach(l => {
    if (!l.date_start) return;
    const end = new Date(l.date_start).getTime() + (l.lap_duration || 0) * 1000;
    const cur = byDriver[l.driver_number];
    if (!cur || l.lap_number > cur.laps || (l.lap_number === cur.laps && end > cur.finish)) {
      byDriver[l.driver_number] = { driver: l.driver_number, laps: l.lap_number, finish: end };
    }
  });
  return Object.values(byDriver).sort((a, b) => b.laps - a.laps || a.finish - b.finish).map(d => d.driver);
}

/** A driver's actual strategy as simulator stints, or null if they ran non-slicks. */
export function actualStrategy(stints, driver) {
  const own = (stints || []).filter(s => s.driver_number === driver).sort((a, b) => a.lap_start - b.lap_start);
  if (!own.length || own.some(s => !DRY.includes(s.compound) || s.lap_end == null)) return null;
  return own.map(s => ({ compound: s.compound, laps: s.lap_end - s.lap_start + 1 }));
}

/**
 * Score the fitted tyre/fuel model on a race's clean laps.
 *
 * Each driver's pace level is anchored to the median of their own laps (one
 * number per driver); everything else comes from `fit`. The baseline predicts
 * every lap as the driver's median lap, so "improvement" is how much of the
 * lap-to-lap variation the tyre/fuel model actually explains.
 */
export function backtest(fit, rows) {
  const byDriver = {};
  rows.forEach(r => { (byDriver[r.driver] ||= []).push(r); });

  const levels = {};
  const series = {};
  let absModel = 0;
  let absBase = 0;
  let sqModel = 0;
  let n = 0;
  for (const [d, list] of Object.entries(byDriver)) {
    if (list.length < MIN_DRIVER_LAPS) continue;
    const level = median(list.map(r => r.time - predictDelta(fit, r)));
    const base = median(list.map(r => r.time));
    levels[d] = level;
    series[d] = list
      .sort((a, b) => a.lap - b.lap)
      .map(r => ({ lap: r.lap, actual: r.time, predicted: level + predictDelta(fit, r), compound: r.compound }));
    for (const r of list) {
      const e = r.time - (level + predictDelta(fit, r));
      absModel += Math.abs(e);
      sqModel += e * e;
      absBase += Math.abs(r.time - base);
      n++;
    }
  }
  if (!n) return null;
  const maeModel = absModel / n;
  const maeBaseline = absBase / n;
  return {
    n,
    maeModel,
    rmseModel: Math.sqrt(sqModel / n),
    maeBaseline,
    improvement: 1 - maeModel / maeBaseline,
    levels,
    series,
  };
}

/**
 * Convert a fit into a simulator circuit + options for one driver's pace.
 *
 * In the simulator, lapTime = basePace + offset + deg*age + fuelEffect*fuel +
 * trackEvolution*(lap-1). Matching that to the fit at lap 1 on a new
 * reference tyre gives basePace = pace - offset[ref] - fuelEffect*startFuel,
 * and matching the per-lap slope gives trackEvolution = k + fuelEffect*startFuel/N.
 */
export function toSimulatorCircuit(fit, { name, pace, totalLaps, pitLoss, fuelEffect, startFuel, scRate }) {
  const anchor = COMPOUND_MODEL[fit.reference].offset;
  const compounds = Object.fromEntries(DRY.map(c => {
    const seen = fit.compounds.includes(c);
    return [c, {
      offset: seen ? anchor + fit.offsets[c] : COMPOUND_MODEL[c].offset,
      degRate: seen ? Math.max(fit.degRates[c], 0) : COMPOUND_MODEL[c].degRate,
      cliffFactor: COMPOUND_MODEL[c].cliffFactor,
    }];
  }));
  return {
    circuit: {
      name,
      basePace: pace - anchor - fuelEffect * startFuel,
      totalLaps,
      pitLoss,
      fuelEffect,
      scRate,
      compounds,
      raced: fit.compounds,
    },
    options: {
      degModel: 'linear',
      startFuel,
      trackEvolution: fit.lapSlope + (fuelEffect * startFuel) / totalLaps,
    },
  };
}
