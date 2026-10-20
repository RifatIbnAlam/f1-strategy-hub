/**
 * Race strategy model.
 *
 * Lap time is built up from independent, explainable terms:
 *
 *   lapTime = basePace                       fuel-corrected race pace on a fresh hard tyre
 *           + compoundOffset[compound]       softer = faster when new
 *           + degRate[compound] * tyreAge    linear wear
 *           + cliffPenalty                   extra loss once the tyre is past its life
 *           + fuelEffect * fuelOnBoard       heavier car = slower (s/kg)
 *           + trackEvolution * (lap - 1)     rubbering-in makes the track faster
 *
 * Every pit stop costs the circuit's pit-lane time loss. The numbers are
 * representative, not team data: they are tuned to land in the range of
 * published Pirelli/FIA figures so that the trade-offs (soft vs hard, one vs
 * two stops) behave the way they do in real races.
 */

export const COMPOUND_MODEL = {
  SOFT:   { offset: -0.80, degRate: 0.090, cliffFactor: 0.65 },
  MEDIUM: { offset: -0.40, degRate: 0.055, cliffFactor: 1.00 },
  HARD:   { offset:  0.00, degRate: 0.035, cliffFactor: 1.45 },
};

// Seconds lost per lap, per lap past the cliff.
export const CLIFF_RATE = 0.15;

export const DEFAULT_MODEL_OPTIONS = {
  degModel: 'cliff',       // 'linear' | 'cliff'
  cliffLap: 22,            // tyre age where a MEDIUM falls off; SOFT/HARD scale from it
  trackEvolution: -0.010,  // s/lap
  startFuel: 100,          // kg at lights out
};

/**
 * Circuit library. basePace is fuel-corrected race pace in seconds (roughly
 * pole time + 2–3 s), pitLoss is the total time lost to a stop (pit-lane
 * transit + stationary time), fuelEffect is lap time per kg of fuel.
 */
export const CIRCUIT_PRESETS = {
  albert_park:   { name: 'Australia — Albert Park',          basePace:  78.6, totalLaps: 58, pitLoss: 19.5, fuelEffect: 0.032 },
  shanghai:      { name: 'China — Shanghai',                 basePace:  93.8, totalLaps: 56, pitLoss: 22.5, fuelEffect: 0.035 },
  suzuka:        { name: 'Japan — Suzuka',                   basePace:  90.0, totalLaps: 53, pitLoss: 22.5, fuelEffect: 0.036 },
  bahrain:       { name: 'Bahrain — Sakhir',                 basePace:  93.0, totalLaps: 57, pitLoss: 23.0, fuelEffect: 0.035 },
  jeddah:        { name: 'Saudi Arabia — Jeddah',            basePace:  90.0, totalLaps: 50, pitLoss: 20.5, fuelEffect: 0.033 },
  miami:         { name: 'USA — Miami',                      basePace:  89.5, totalLaps: 57, pitLoss: 21.0, fuelEffect: 0.034 },
  imola:         { name: 'Emilia Romagna — Imola',           basePace:  77.5, totalLaps: 63, pitLoss: 28.0, fuelEffect: 0.032 },
  monaco:        { name: 'Monaco — Monte Carlo',             basePace:  73.0, totalLaps: 78, pitLoss: 19.0, fuelEffect: 0.028 },
  barcelona:     { name: 'Spain — Barcelona-Catalunya',      basePace:  76.5, totalLaps: 66, pitLoss: 22.0, fuelEffect: 0.034 },
  montreal:      { name: 'Canada — Montréal',                basePace:  74.5, totalLaps: 70, pitLoss: 18.5, fuelEffect: 0.032 },
  red_bull_ring: { name: 'Austria — Red Bull Ring',          basePace:  67.0, totalLaps: 71, pitLoss: 20.5, fuelEffect: 0.030 },
  silverstone:   { name: 'Britain — Silverstone',            basePace:  89.5, totalLaps: 52, pitLoss: 20.5, fuelEffect: 0.036 },
  spa:           { name: 'Belgium — Spa-Francorchamps',      basePace: 105.0, totalLaps: 44, pitLoss: 21.0, fuelEffect: 0.040 },
  hungaroring:   { name: 'Hungary — Hungaroring',            basePace:  79.5, totalLaps: 70, pitLoss: 20.5, fuelEffect: 0.032 },
  zandvoort:     { name: 'Netherlands — Zandvoort',          basePace:  73.0, totalLaps: 72, pitLoss: 21.5, fuelEffect: 0.031 },
  monza:         { name: 'Italy — Monza',                    basePace:  82.0, totalLaps: 53, pitLoss: 24.0, fuelEffect: 0.034 },
  baku:          { name: 'Azerbaijan — Baku',                basePace: 105.0, totalLaps: 51, pitLoss: 20.5, fuelEffect: 0.036 },
  singapore:     { name: 'Singapore — Marina Bay',           basePace:  94.0, totalLaps: 62, pitLoss: 28.5, fuelEffect: 0.036 },
  cota:          { name: 'USA — Circuit of the Americas',    basePace:  97.0, totalLaps: 56, pitLoss: 20.5, fuelEffect: 0.036 },
  mexico_city:   { name: 'Mexico — Hermanos Rodríguez',      basePace:  79.5, totalLaps: 71, pitLoss: 22.0, fuelEffect: 0.029 },
  interlagos:    { name: 'Brazil — Interlagos',              basePace:  73.5, totalLaps: 71, pitLoss: 21.0, fuelEffect: 0.031 },
  las_vegas:     { name: 'USA — Las Vegas Strip',            basePace:  96.0, totalLaps: 50, pitLoss: 21.0, fuelEffect: 0.036 },
  lusail:        { name: 'Qatar — Lusail',                   basePace:  85.0, totalLaps: 57, pitLoss: 25.0, fuelEffect: 0.034 },
  yas_marina:    { name: 'Abu Dhabi — Yas Marina',           basePace:  86.5, totalLaps: 58, pitLoss: 21.5, fuelEffect: 0.034 },
};

export function compoundCliffLap(compound, cliffLap) {
  return Math.round(cliffLap * COMPOUND_MODEL[compound].cliffFactor);
}

/**
 * Lap time for a given race lap (1-based) on a tyre that has already done
 * `tyreAge` laps.
 */
export function lapTime(circuit, options, compound, raceLap, tyreAge) {
  const { degModel, cliffLap, trackEvolution, startFuel } = { ...DEFAULT_MODEL_OPTIONS, ...options };
  const tyre = COMPOUND_MODEL[compound];
  if (!tyre) throw new Error(`Unknown compound: ${compound}`);

  let wear = tyre.degRate * tyreAge;
  if (degModel === 'cliff') {
    const cliff = compoundCliffLap(compound, cliffLap);
    if (tyreAge > cliff) wear += (tyreAge - cliff) * CLIFF_RATE;
  }

  // Fuel burns linearly to ~zero at the flag.
  const fuel = startFuel * (1 - (raceLap - 1) / circuit.totalLaps);
  const fuelTime = Math.max(fuel, 0) * circuit.fuelEffect;
  const evolution = trackEvolution * (raceLap - 1);

  return circuit.basePace + tyre.offset + wear + fuelTime + evolution;
}

/**
 * Check a strategy against the race distance and the sporting regulations.
 */
export function validateStrategy(stints, circuit) {
  const issues = [];
  const laps = stints.reduce((sum, s) => sum + s.laps, 0);
  if (laps !== circuit.totalLaps) {
    issues.push(`Stints cover ${laps} of ${circuit.totalLaps} laps`);
  }
  // Dry races require at least two different slick compounds.
  if (new Set(stints.map(s => s.compound)).size < 2) {
    issues.push('Must use at least two different dry compounds');
  }
  return issues;
}

/**
 * Simulate a full strategy lap by lap.
 */
export function simulateStrategy(stints, circuit, options = {}) {
  const laps = [];
  let totalTime = 0;
  let raceLap = 0;

  stints.forEach((stint, stintIdx) => {
    for (let age = 0; age < stint.laps && raceLap < circuit.totalLaps; age++) {
      raceLap++;
      let t = lapTime(circuit, options, stint.compound, raceLap, age);
      const isInLap = age === stint.laps - 1 && stintIdx < stints.length - 1;
      if (isInLap) t += circuit.pitLoss;
      totalTime += t;
      laps.push({
        lap: raceLap,
        lapTime: t,
        totalTime,
        compound: stint.compound,
        tyreAge: age + 1,
        stint: stintIdx + 1,
        pit: isInLap,
      });
    }
  });

  const issues = validateStrategy(stints, circuit);
  return {
    laps,
    totalTime,
    pitStops: Math.max(stints.length - 1, 0),
    totalLaps: raceLap,
    issues,
    valid: issues.length === 0,
  };
}

/**
 * Total time of a single stint, without building per-lap objects. Used by the
 * optimiser, which evaluates tens of thousands of candidate strategies.
 */
function stintTime(circuit, options, compound, startLap, length) {
  let t = 0;
  for (let age = 0; age < length; age++) {
    t += lapTime(circuit, options, compound, startLap + age, age);
  }
  return t;
}

/**
 * Exhaustively search one- and two-stop strategies and return the fastest
 * legal ones. Stint times are memoised by (compound, start lap, length), which
 * turns ~30k candidate strategies into a few thousand stint evaluations.
 */
export function findOptimalStrategies(circuit, options = {}, { maxStops = 2, minStint = 5, top = 5 } = {}) {
  const N = circuit.totalLaps;
  const compounds = Object.keys(COMPOUND_MODEL);
  const memo = new Map();
  const cost = (c, start, len) => {
    const key = `${c}|${start}|${len}`;
    if (!memo.has(key)) memo.set(key, stintTime(circuit, options, c, start, len));
    return memo.get(key);
  };

  const results = [];
  const consider = (stints) => {
    if (new Set(stints.map(s => s.compound)).size < 2) return;
    let t = (stints.length - 1) * circuit.pitLoss;
    let start = 1;
    for (const s of stints) {
      t += cost(s.compound, start, s.laps);
      start += s.laps;
    }
    results.push({ stints, totalTime: t, pitStops: stints.length - 1 });
  };

  for (const c1 of compounds) {
    for (const c2 of compounds) {
      for (let p1 = minStint; p1 <= N - minStint; p1++) {
        consider([{ compound: c1, laps: p1 }, { compound: c2, laps: N - p1 }]);
        if (maxStops < 2) continue;
        for (const c3 of compounds) {
          for (let p2 = p1 + minStint; p2 <= N - minStint; p2++) {
            consider([
              { compound: c1, laps: p1 },
              { compound: c2, laps: p2 - p1 },
              { compound: c3, laps: N - p2 },
            ]);
          }
        }
      }
    }
  }

  results.sort((a, b) => a.totalTime - b.totalTime);

  // Keep only the best ordering/timing for each set of compounds so the list
  // shows genuinely different strategies, not M-H vs H-M or a one-lap shift.
  const seen = new Set();
  const best = [];
  for (const r of results) {
    const key = r.stints.map(s => s.compound).sort().join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    best.push(r);
    if (best.length >= top) break;
  }
  return best;
}

export function formatRaceTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
