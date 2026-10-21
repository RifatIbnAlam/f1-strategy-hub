import { buildBrief, briefToMarkdown, candidatePlans, plannedStops, scSensitivity } from './brief';
import { CIRCUIT_PRESETS, DEFAULT_MODEL_OPTIONS, findOptimalStrategies, simulateStrategy } from './strategy';

const monza = CIRCUIT_PRESETS.monza;
const options = DEFAULT_MODEL_OPTIONS;
const oneStop = [{ compound: 'MEDIUM', laps: 24 }, { compound: 'HARD', laps: 29 }];
const twoStop = [{ compound: 'SOFT', laps: 15 }, { compound: 'HARD', laps: 20 }, { compound: 'MEDIUM', laps: 18 }];
const userPlans = [
  { name: 'Strategy A', stints: oneStop, ...simulateStrategy(oneStop, monza, options) },
  { name: 'Strategy B', stints: twoStop, ...simulateStrategy(twoStop, monza, options) },
];
const optimal = findOptimalStrategies(monza, options);

describe('plannedStops', () => {
  it('returns the lap of each stop', () => {
    expect(plannedStops(twoStop)).toEqual([15, 35]);
  });
});

describe('candidatePlans', () => {
  it('drops illegal user plans and keeps one plan per tyre sequence', () => {
    const illegal = { name: 'Bad', stints: [{ compound: 'HARD', laps: 53 }], valid: false };
    // Same compounds as the optimiser's best, pitting a lap later
    const shifted = optimal[0].stints.map((s, i, all) => ({ ...s, laps: s.laps + (i === 0 ? 1 : i === all.length - 1 ? -1 : 0) }));
    const mine = { name: 'Mine', stints: shifted, valid: true };
    const list = candidatePlans([illegal, mine], optimal.slice(0, 2));
    expect(list.map(c => c.name)).toEqual(['Mine', 'Optimiser #2']);
  });
});

describe('scSensitivity', () => {
  it('returns contiguous bands covering every tested rate', () => {
    const bands = scSensitivity(candidatePlans(userPlans, optimal.slice(0, 3)), monza, options, { sims: 200 });
    expect(bands[0].from).toBe(0);
    expect(bands[bands.length - 1].to).toBe(3);
    for (let i = 1; i < bands.length; i++) expect(bands[i].plan.name).not.toBe(bands[i - 1].plan.name);
  });
});

describe('buildBrief', () => {
  const brief = buildBrief({ circuit: monza, options, userPlans, optimal, sims: 500 });

  it('recommends the plan with the best expected time', () => {
    const best = [...brief.candidates].sort((a, b) => a.expected - b.expected)[0];
    expect(brief.call.plan).toBe(best.plan);
    expect(brief.call.p10).toBeLessThanOrEqual(brief.call.p90);
    expect(brief.runnerUp.margin).toBeGreaterThanOrEqual(0);
  });

  it('gives a safety-car window before each planned stop', () => {
    brief.contingency.forEach(c => {
      expect(c.windowTo).toBe(c.planned - 1);
      expect(c.windowFrom).toBeLessThanOrEqual(c.windowTo);
    });
  });

  it('renders markdown with every section', () => {
    const md = briefToMarkdown(brief);
    ['# Race Strategy Brief', '## Recommendation', '## Why', '## In-race contingency', '## What would change the call', '## Assumptions', '| Plan |']
      .forEach(h => expect(md).toContain(h));
  });
});
