import {
  mulberry32,
  sampleSafetyCars,
  pitLaps,
  raceTime,
  monteCarlo,
  pairedDelta,
  SC_PIT_FACTOR,
} from './montecarlo';
import { CIRCUIT_PRESETS, simulateStrategy } from './strategy';

const monza = CIRCUIT_PRESETS.monza;
const oneStop = [{ compound: 'MEDIUM', laps: 24 }, { compound: 'HARD', laps: 29 }];
const twoStop = [{ compound: 'SOFT', laps: 16 }, { compound: 'MEDIUM', laps: 18 }, { compound: 'MEDIUM', laps: 19 }];
const noSC = new Array(monza.totalLaps + 1).fill(false);

describe('mulberry32', () => {
  it('is deterministic for a seed and stays in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('sampleSafetyCars', () => {
  it('averages close to the requested rate of SC periods', () => {
    const rng = mulberry32(1);
    let periods = 0;
    const races = 4000;
    for (let i = 0; i < races; i++) {
      const sc = sampleSafetyCars(rng, 53, 1.0);
      for (let l = 1; l <= 53; l++) if (sc[l] && !sc[l - 1]) periods++;
    }
    // Overlapping periods merge, so the observed count is slightly below the rate.
    expect(periods / races).toBeGreaterThan(0.85);
    expect(periods / races).toBeLessThan(1.05);
  });
});

describe('raceTime', () => {
  it('matches the deterministic simulator when there is no safety car', () => {
    expect(raceTime(oneStop, monza, {}, noSC, true)).toBeCloseTo(simulateStrategy(oneStop, monza).totalTime, 6);
  });

  it('pits early under a safety car when reacting, and charges the reduced loss', () => {
    const sc = [...noSC];
    sc[19] = sc[20] = sc[21] = true;
    expect(pitLaps(oneStop, sc, true)).toEqual([19]);
    expect(pitLaps(oneStop, sc, false)).toEqual([24]);
    const reacted = raceTime(oneStop, monza, {}, sc, true);
    const stubborn = raceTime(oneStop, monza, {}, sc, false);
    // The reactive car saves most of a pit stop
    expect(stubborn - reacted).toBeGreaterThan(monza.pitLoss * (1 - SC_PIT_FACTOR) * 0.6);
  });
});

describe('monteCarlo', () => {
  it('is reproducible and reports sane statistics', () => {
    const strategies = [{ name: 'A', stints: oneStop }, { name: 'B', stints: twoStop }];
    const r1 = monteCarlo(strategies, monza, {}, { sims: 500, seed: 3 });
    const r2 = monteCarlo(strategies, monza, {}, { sims: 500, seed: 3 });
    expect(r1.stats[0].mean).toBe(r2.stats[0].mean);
    const totalWins = r1.stats.reduce((a, s) => a + s.winRate, 0);
    expect(totalWins).toBeCloseTo(1);
    r1.stats.forEach(s => {
      expect(s.p10).toBeLessThanOrEqual(s.p50);
      expect(s.p50).toBeLessThanOrEqual(s.p90);
    });
  });

  it('safety cars help the strategy with more stops', () => {
    const strategies = [{ name: 'A', stints: oneStop }, { name: 'B', stints: twoStop }];
    const calm = monteCarlo(strategies, monza, {}, { sims: 1000, rate: 0, seed: 5 });
    const chaotic = monteCarlo(strategies, monza, {}, { sims: 1000, rate: 2.5, seed: 5 });
    const gap = r => r.stats[1].mean - r.stats[0].mean;
    expect(gap(chaotic)).toBeLessThan(gap(calm));
  });
});

describe('pairedDelta', () => {
  it('computes win share and a histogram covering every race', () => {
    const a = Float64Array.from([10, 10, 10, 10]);
    const b = Float64Array.from([11, 12, 9, 13]);
    const d = pairedDelta(a, b, 4);
    expect(d.aWins).toBe(0.75);
    expect(d.hist.reduce((s, h) => s + h.count, 0)).toBe(4);
    expect(d.mean).toBeCloseTo(1.25);
  });
});

describe('win attribution', () => {
  it('splits ties instead of favouring the first strategy', () => {
    const same = [{ name: 'A', stints: oneStop }, { name: 'A2', stints: oneStop }];
    const r = monteCarlo(same, monza, {}, { sims: 200, seed: 1 });
    expect(r.stats[0].winRate).toBeCloseTo(0.5);
    expect(r.stats[1].winRate).toBeCloseTo(0.5);
  });
});
