import {
  CIRCUIT_PRESETS,
  lapTime,
  simulateStrategy,
  validateStrategy,
  findOptimalStrategies,
  formatRaceTime,
} from './strategy';

const monza = CIRCUIT_PRESETS.monza;

describe('lapTime', () => {
  it('gets faster as fuel burns off on a fresh tyre', () => {
    const opts = { trackEvolution: 0 };
    expect(lapTime(monza, opts, 'HARD', 1, 0)).toBeGreaterThan(lapTime(monza, opts, 'HARD', 50, 0));
  });

  it('ranks fresh compounds soft < medium < hard', () => {
    const soft = lapTime(monza, {}, 'SOFT', 10, 0);
    const medium = lapTime(monza, {}, 'MEDIUM', 10, 0);
    const hard = lapTime(monza, {}, 'HARD', 10, 0);
    expect(soft).toBeLessThan(medium);
    expect(medium).toBeLessThan(hard);
  });

  it('adds a cliff penalty only past the compound cliff', () => {
    const opts = { degModel: 'cliff', cliffLap: 20 };
    const linear = { ...opts, degModel: 'linear' };
    // MEDIUM cliff is at age 20
    expect(lapTime(monza, opts, 'MEDIUM', 30, 20)).toBeCloseTo(lapTime(monza, linear, 'MEDIUM', 30, 20));
    expect(lapTime(monza, opts, 'MEDIUM', 30, 25)).toBeGreaterThan(lapTime(monza, linear, 'MEDIUM', 30, 25));
  });

  it('applies track evolution by race lap, not tyre age', () => {
    const opts = { trackEvolution: -0.02, startFuel: 0 };
    expect(lapTime(monza, opts, 'HARD', 40, 0) - lapTime(monza, opts, 'HARD', 1, 0)).toBeCloseTo(-0.78);
  });
});

describe('validateStrategy', () => {
  it('flags a strategy that does not cover the race distance', () => {
    expect(validateStrategy([{ compound: 'MEDIUM', laps: 20 }, { compound: 'HARD', laps: 20 }], monza))
      .toContain('Stints cover 40 of 53 laps');
  });

  it('enforces the two-compound rule', () => {
    expect(validateStrategy([{ compound: 'HARD', laps: 25 }, { compound: 'HARD', laps: 28 }], monza))
      .toContain('Must use at least two different dry compounds');
  });

  it('accepts a legal one-stop', () => {
    expect(validateStrategy([{ compound: 'MEDIUM', laps: 25 }, { compound: 'HARD', laps: 28 }], monza)).toEqual([]);
  });
});

describe('simulateStrategy', () => {
  it('produces one lap entry per race lap and charges each stop once', () => {
    const oneStop = simulateStrategy([{ compound: 'MEDIUM', laps: 25 }, { compound: 'HARD', laps: 28 }], monza);
    expect(oneStop.laps).toHaveLength(53);
    expect(oneStop.pitStops).toBe(1);
    expect(oneStop.laps.filter(l => l.pit)).toHaveLength(1);
    expect(oneStop.laps[24].pit).toBe(true);
    expect(oneStop.totalTime).toBeCloseTo(oneStop.laps[52].totalTime);
  });
});

describe('findOptimalStrategies', () => {
  it('returns legal strategies sorted fastest first', () => {
    const best = findOptimalStrategies(monza);
    expect(best.length).toBeGreaterThan(0);
    best.forEach(r => expect(validateStrategy(r.stints, monza)).toEqual([]));
    for (let i = 1; i < best.length; i++) {
      expect(best[i].totalTime).toBeGreaterThanOrEqual(best[i - 1].totalTime);
    }
  });

  it('matches the full simulation and beats a hand-picked strategy', () => {
    const [best] = findOptimalStrategies(monza);
    const sim = simulateStrategy(best.stints, monza);
    expect(sim.totalTime).toBeCloseTo(best.totalTime, 6);

    const manual = simulateStrategy([{ compound: 'SOFT', laps: 15 }, { compound: 'HARD', laps: 38 }], monza);
    expect(best.totalTime).toBeLessThanOrEqual(manual.totalTime);
  });
});

describe('formatRaceTime', () => {
  it('formats hours, minutes and seconds', () => {
    expect(formatRaceTime(4468.04)).toBe('1:14:28.0');
    expect(formatRaceTime(83.4)).toBe('1:23.4');
  });
});
