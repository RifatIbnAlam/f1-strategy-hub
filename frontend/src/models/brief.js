/**
 * Strategy brief: turns simulator output into a short, decision-ready
 * recommendation, the way a strategist would brief a team principal.
 *
 * Structure: the call, why, what could change it (safety-car sensitivity),
 * the in-race contingency, and the assumptions it rests on.
 */
import { simulateStrategy, formatRaceTime, compoundCliffLap } from './strategy';
import { monteCarlo, REACT_WINDOW } from './montecarlo';

const LABEL = { SOFT: 'Soft', MEDIUM: 'Medium', HARD: 'Hard' };

export const describePlan = (stints) => stints.map(s => `${LABEL[s.compound]} ${s.laps}`).join(' → ');
const shortPlan = (stints) => stints.map(s => `${s.compound[0]}${s.laps}`).join('-');
// Plans with the same tyre sequence are the same strategy with a different
// pit lap; comparing them only measures noise, so keep one of each.
const planKey = (stints) => stints.map(s => s.compound).join('|');

// Below this expected-time margin the ranking is within simulation noise.
export const TOO_CLOSE_S = 1.0;

/** Laps on which each stop is planned. */
export function plannedStops(stints) {
  const laps = [];
  let lap = 0;
  stints.slice(0, -1).forEach(s => { lap += s.laps; laps.push(lap); });
  return laps;
}

/**
 * Candidate plans: the user's legal plans plus the optimiser's picks, one per
 * tyre sequence (the user's version wins, so their plan is what gets judged).
 */
export function candidatePlans(userPlans, optimal) {
  const seen = new Set();
  const out = [];
  const add = (name, stints) => {
    const key = planKey(stints);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, stints });
  };
  userPlans.filter(p => p.valid !== false).forEach(p => add(p.name, p.stints));
  optimal.forEach((o, i) => add(`Optimiser #${i + 1}`, o.stints));
  return out;
}

/**
 * Which plan has the best expected race time at each safety-car rate.
 * Returns contiguous bands: [{ from, to, plan }].
 */
export function scSensitivity(candidates, circuit, options, { rates = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3], sims = 600, seed = 7 } = {}) {
  const winners = rates.map(rate => {
    const { stats } = monteCarlo(candidates, circuit, options, { sims, rate, react: true, seed });
    const best = [...stats].sort((a, b) => a.mean - b.mean)[0];
    return { rate, plan: candidates.find(c => c.name === best.name) };
  });
  const bands = [];
  for (const w of winners) {
    const last = bands[bands.length - 1];
    if (last && last.plan.name === w.plan.name) last.to = w.rate;
    else bands.push({ from: w.rate, to: w.rate, plan: w.plan });
  }
  return bands;
}

/**
 * Build the brief. `userPlans` are the simulator's strategies (with .valid),
 * `optimal` the optimiser's ranked list.
 */
export function buildBrief({ circuit, options, userPlans, optimal, rate = circuit.scRate ?? 0.7, sims = 2000 }) {
  const candidates = candidatePlans(userPlans, optimal.slice(0, 4));
  if (!candidates.length) return null;

  const mc = monteCarlo(candidates, circuit, options, { sims, rate, react: true, seed: 2026 });
  const ranked = [...mc.stats].sort((a, b) => a.mean - b.mean);
  const call = ranked[0];
  const runnerUp = ranked[1];
  const cleanBest = [...mc.stats]
    .map(s => ({ ...s, clean: simulateStrategy(s.stints, circuit, options).totalTime }))
    .sort((a, b) => a.clean - b.clean)[0];

  const stops = plannedStops(call.stints);
  const contingency = stops.map((lap, i) => ({
    stop: i + 1,
    planned: lap,
    windowFrom: Math.max(lap - REACT_WINDOW, 2),
    windowTo: lap - 1,
    nextCompound: call.stints[i + 1].compound,
  }));

  const bands = scSensitivity(candidates, circuit, options);

  const cliff = options.degModel === 'cliff'
    ? `Tyres fall off a cliff after ~${compoundCliffLap('SOFT', options.cliffLap)}/${options.cliffLap}/${compoundCliffLap('HARD', options.cliffLap)} laps (S/M/H)`
    : 'Linear tyre wear';

  return {
    circuit: circuit.name,
    laps: circuit.totalLaps,
    rate,
    sims,
    call: {
      name: call.name,
      plan: describePlan(call.stints),
      short: shortPlan(call.stints),
      stints: call.stints,
      stops: stops.length,
      expected: call.mean,
      p10: call.p10,
      p90: call.p90,
      winRate: call.winRate,
    },
    runnerUp: runnerUp && {
      name: runnerUp.name,
      plan: describePlan(runnerUp.stints),
      margin: runnerUp.mean - call.mean,
      winRate: runnerUp.winRate,
      tooClose: runnerUp.mean - call.mean < TOO_CLOSE_S,
    },
    cleanRaceDisagrees: cleanBest.name !== call.name ? {
      name: cleanBest.name,
      plan: describePlan(cleanBest.stints),
    } : null,
    contingency,
    sensitivity: bands.map(b => ({ from: b.from, to: b.to, name: b.plan.name, plan: describePlan(b.plan.stints) })),
    assumptions: [
      `Pit loss ${circuit.pitLoss}s per stop`,
      `${options.startFuel ?? 100} kg starting fuel at ${circuit.fuelEffect}s/kg`,
      cliff,
      `Track evolution ${(options.trackEvolution ?? -0.01).toFixed(3)}s per lap`,
      `${rate.toFixed(1)} safety cars per race on average; a stop under SC costs 45% of a normal stop`,
      'Clean air throughout: no traffic, overtaking difficulty or team orders',
    ],
    candidates: ranked.map(s => ({ name: s.name, plan: describePlan(s.stints), expected: s.mean, winRate: s.winRate })),
  };
}

/** Markdown version of the brief, for pasting into a doc, email or Slack. */
export function briefToMarkdown(b) {
  const t = formatRaceTime;
  const lines = [
    `# Race Strategy Brief: ${b.circuit} (${b.laps} laps)`,
    '',
    `## Recommendation`,
    `**${b.call.plan}** (${b.call.stops}-stop). Expected race time ${t(b.call.expected)}, ` +
      `range ${t(b.call.p10)}–${t(b.call.p90)} (P10–P90), fastest in ${(b.call.winRate * 100).toFixed(0)}% of ${b.sims.toLocaleString()} simulated races.`,
    '',
    `## Why`,
  ];
  if (b.runnerUp) {
    lines.push(`- Beats the next-best strategy (${b.runnerUp.plan}) by ${b.runnerUp.margin.toFixed(1)}s on average.`);
    if (b.runnerUp.tooClose) lines.push('- That margin is within simulation noise: either plan is defensible, so decide on track position and tyre availability.');
  }
  if (b.cleanRaceDisagrees) {
    lines.push(`- In a clean race ${b.cleanRaceDisagrees.plan} is faster, but it loses more when a safety car falls badly; this plan is the better bet once incidents are priced in.`);
  } else {
    lines.push('- It is also the fastest plan in a clean race, so the call does not depend on luck.');
  }
  lines.push('', '## In-race contingency');
  if (b.contingency.length) {
    b.contingency.forEach(c => lines.push(
      `- Stop ${c.stop} (planned lap ${c.planned}, onto ${LABEL[c.nextCompound]}): if a safety car is deployed on laps ${c.windowFrom}–${c.windowTo}, box immediately for a cheap stop.`
    ));
  } else {
    lines.push('- No planned stops.');
  }
  lines.push('', '## What would change the call');
  if (b.sensitivity.length === 1) {
    lines.push(`- None of the tested safety-car rates (0–3 per race) changes the recommendation.`);
  } else {
    b.sensitivity.forEach(s => lines.push(
      `- ${s.from === s.to ? `${s.from}` : `${s.from}–${s.to}`} safety cars per race: ${s.plan}`
    ));
  }
  lines.push('', '## Assumptions', ...b.assumptions.map(a => `- ${a}`));
  lines.push('', '## Plans considered', '| Plan | Expected | Wins |', '| --- | --- | --- |',
    ...b.candidates.map(c => `| ${c.plan} | ${t(c.expected)} | ${(c.winRate * 100).toFixed(0)}% |`));
  lines.push('', '_Generated by Undercut. Model estimates, not team data._');
  return lines.join('\n');
}
