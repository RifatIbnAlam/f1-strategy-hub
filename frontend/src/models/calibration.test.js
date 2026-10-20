import {
  cleanRaceLaps,
  fitRaceModel,
  estimatePitLoss,
  finishingOrder,
  actualStrategy,
  backtest,
  toSimulatorCircuit,
  solveLinear,
} from './calibration';
import { lapTime, simulateStrategy, findOptimalStrategies } from './strategy';
import { mulberry32 } from './montecarlo';

// Ground truth for a synthetic 50-lap race
const TRUTH = {
  offsets: { MEDIUM: -0.5, HARD: 0 },
  deg: { MEDIUM: 0.07, HARD: 0.03 },
  lapSlope: -0.06,
  pitLoss: 21,
};
const N = 50;

function syntheticRace({ drivers = 10, noise = 0.08, seed = 1 } = {}) {
  const rng = mulberry32(seed);
  const laps = [];
  const stints = [];
  const t0 = Date.parse('2026-06-01T13:00:00Z');
  for (let d = 0; d < drivers; d++) {
    const dn = d + 1;
    const pace = 95 + d * 0.15;
    const pit = 18 + (d % 6) * 2; // varied pit laps → identifies deg vs lap slope
    const order = d % 2 ? ['HARD', 'MEDIUM'] : ['MEDIUM', 'HARD'];
    stints.push(
      { driver_number: dn, compound: order[0], lap_start: 1, lap_end: pit, tyre_age_at_start: d % 3 === 0 ? 3 : 0 },
      { driver_number: dn, compound: order[1], lap_start: pit + 1, lap_end: N, tyre_age_at_start: 0 },
    );
    let clock = t0 + d * 400;
    for (let lap = 1; lap <= N; lap++) {
      const s = lap <= pit ? stints[stints.length - 2] : stints[stints.length - 1];
      const age = s.tyre_age_at_start + lap - s.lap_start;
      let t = pace + TRUTH.offsets[s.compound] + TRUTH.deg[s.compound] * age + TRUTH.lapSlope * (lap - 1)
        + (rng() - 0.5) * 2 * noise;
      if (lap === 1) t += 6;
      if (lap === pit) t += TRUTH.pitLoss * 0.4;
      if (lap === pit + 1) t += TRUTH.pitLoss * 0.6;
      if (lap === 30 && d === 4) t += 25; // an incident lap that cleaning must drop
      laps.push({ driver_number: dn, lap_number: lap, lap_duration: t, date_start: new Date(clock).toISOString(), is_pit_out_lap: lap === pit + 1 });
      clock += t * 1000;
    }
  }
  return { laps, stints };
}

describe('solveLinear', () => {
  it('solves a small system', () => {
    const x = solveLinear([[4, 1], [1, 3]], [1, 2]);
    expect(x[0]).toBeCloseTo(1 / 11);
    expect(x[1]).toBeCloseTo(7 / 11);
  });
});

describe('cleanRaceLaps', () => {
  it('drops lap 1, pit in/out laps and incident laps', () => {
    const { laps, stints } = syntheticRace();
    const rows = cleanRaceLaps(laps, stints);
    expect(rows.some(r => r.lap === 1)).toBe(false);
    expect(rows.some(r => r.driver === 1 && (r.lap === 18 || r.lap === 19))).toBe(false);
    expect(rows.some(r => r.driver === 5 && r.lap === 30)).toBe(false);
  });

  it('uses real tyre age for used sets', () => {
    const { laps, stints } = syntheticRace();
    const row = cleanRaceLaps(laps, stints).find(r => r.driver === 1 && r.lap === 2);
    expect(row.age).toBe(3 + 1); // started on a 3-lap-old set
  });
});

describe('fitRaceModel', () => {
  it('recovers the true compound offsets, degradation and lap slope', () => {
    const { laps, stints } = syntheticRace();
    const fit = fitRaceModel(cleanRaceLaps(laps, stints));
    expect(fit.error).toBeUndefined();
    expect(fit.reference).toBe('HARD');
    expect(fit.offsets.MEDIUM).toBeCloseTo(TRUTH.offsets.MEDIUM, 1);
    expect(fit.degRates.MEDIUM).toBeCloseTo(TRUTH.deg.MEDIUM, 2);
    expect(fit.degRates.HARD).toBeCloseTo(TRUTH.deg.HARD, 2);
    expect(fit.lapSlope).toBeCloseTo(TRUTH.lapSlope, 2);
    expect(fit.r2).toBeGreaterThan(0.9);
  });

  it('refuses to fit a single-compound (e.g. wet) race', () => {
    const { laps, stints } = syntheticRace();
    const allMedium = stints.map(s => ({ ...s, compound: 'MEDIUM' }));
    expect(fitRaceModel(cleanRaceLaps(laps, allMedium)).error).toMatch(/two slick compounds/);
  });
});

describe('race helpers', () => {
  it('estimates pit loss from in-lap + out-lap', () => {
    const { laps, stints } = syntheticRace({ noise: 0.01 });
    expect(estimatePitLoss(laps, stints)).toBeCloseTo(TRUTH.pitLoss, 0);
  });

  it('derives finishing order from line-crossing times', () => {
    const { laps } = syntheticRace();
    expect(finishingOrder(laps)[0]).toBe(1);
  });

  it('extracts a driver strategy', () => {
    const { stints } = syntheticRace();
    expect(actualStrategy(stints, 1)).toEqual([{ compound: 'MEDIUM', laps: 18 }, { compound: 'HARD', laps: 32 }]);
  });
});

describe('backtest', () => {
  it('beats the per-driver-median baseline out of sample', () => {
    const train = syntheticRace({ seed: 1 });
    const test = syntheticRace({ seed: 2, drivers: 8 });
    const fit = fitRaceModel(cleanRaceLaps(train.laps, train.stints));
    const result = backtest(fit, cleanRaceLaps(test.laps, test.stints));
    expect(result.maeModel).toBeLessThan(result.maeBaseline);
    expect(result.improvement).toBeGreaterThan(0.5);
  });
});

describe('toSimulatorCircuit', () => {
  it('reproduces the fitted lap times inside the simulator', () => {
    const { laps, stints } = syntheticRace({ noise: 0 });
    const fit = fitRaceModel(cleanRaceLaps(laps, stints));
    const pace = fit.driverPace[1];
    const { circuit, options } = toSimulatorCircuit(fit, {
      name: 'test', pace, totalLaps: N, pitLoss: 21, fuelEffect: 0.033, startFuel: 100,
    });
    // Lap 10 on a 4-lap-old medium for driver 1
    const expected = pace + fit.offsets.MEDIUM + fit.degRates.MEDIUM * 4 + fit.lapSlope * 9;
    expect(lapTime(circuit, options, 'MEDIUM', 10, 4)).toBeCloseTo(expected, 6);

    const sim = simulateStrategy([{ compound: 'MEDIUM', laps: 20 }, { compound: 'HARD', laps: 30 }], circuit, options);
    expect(sim.valid).toBe(true);
  });
});

describe('calibrated optimiser', () => {
  it('only recommends compounds that were actually raced', () => {
    const { laps, stints } = syntheticRace();
    const fit = fitRaceModel(cleanRaceLaps(laps, stints));
    const { circuit, options } = toSimulatorCircuit(fit, {
      name: 'test', pace: fit.driverPace[1], totalLaps: N, pitLoss: 21, fuelEffect: 0.033, startFuel: 100,
    });
    const best = findOptimalStrategies(circuit, options);
    best.forEach(r => r.stints.forEach(s => expect(['MEDIUM', 'HARD']).toContain(s.compound)));
  });
});
