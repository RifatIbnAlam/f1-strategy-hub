import React, { useDeferredValue, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { Dices } from 'lucide-react';
import { TIRE_COMPOUNDS, tone } from '../data/constants';
import { simulateStrategy, formatRaceTime } from '../models/strategy';
import { monteCarlo, pairedDelta, SC_PACE, SC_PIT_FACTOR, REACT_WINDOW } from '../models/montecarlo';

const SIMS = 2000;
const mono = { fontFamily: "'JetBrains Mono', monospace" };

const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

const describe = (stints) => stints.map(s => `${TIRE_COMPOUNDS[s.compound].label[0]}${s.laps}`).join(' → ');

/**
 * Re-ranks strategies under safety-car uncertainty. The deterministic best
 * plan is often not the best *expected* plan once you account for the chance
 * of a cheap stop under SC.
 */
export default function MonteCarloPanel({ circuit, options, strategies, optimal }) {
  const [rateOverride, setRateOverride] = useState(null);
  const [react, setReact] = useState(true);
  const rate = rateOverride ?? circuit.scRate ?? 0.7;

  // Candidates: the user's two plans (if legal) plus the optimiser's picks.
  const candidates = useMemo(() => {
    const list = [];
    const seen = new Set();
    const add = (name, stints, color) => {
      const key = describe(stints);
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ name, stints, color, deterministic: simulateStrategy(stints, circuit, options).totalTime });
    };
    strategies.forEach(s => { if (s.valid) add(s.name, s.stints, s.color); });
    optimal.forEach((o, i) => add(`Optimiser #${i + 1}`, o.stints, null));
    return list;
  }, [strategies, optimal, circuit, options]);

  // Memoise the inputs so the 2,000-race simulation only reruns when they
  // change, and defer it so sliders stay responsive while it computes.
  const inputs = useMemo(() => ({ candidates, circuit, options, rate, react }), [candidates, circuit, options, rate, react]);
  const input = useDeferredValue(inputs);
  const sim = useMemo(
    () => monteCarlo(input.candidates, input.circuit, input.options, { sims: SIMS, rate: input.rate, react: input.react, seed: 2026 }),
    [input]
  );

  const ranked = [...sim.stats].map((s, i) => ({ ...s, idx: i })).sort((a, b) => a.mean - b.mean);
  const bestDeterministic = [...sim.stats].sort((a, b) => a.deterministic - b.deterministic)[0];
  const bestExpected = ranked[0];
  const flipped = bestDeterministic && bestExpected && describe(bestDeterministic.stints) !== describe(bestExpected.stints);

  const aIdx = sim.stats.findIndex(s => s.name === strategies[0]?.name);
  const bIdx = sim.stats.findIndex(s => s.name === strategies[1]?.name);
  const head = aIdx >= 0 && bIdx >= 0 ? pairedDelta(sim.times[aIdx], sim.times[bIdx]) : null;

  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Dices size={16} color="var(--accent)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Safety-Car Monte Carlo</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        {SIMS.toLocaleString()} simulated races with randomly timed safety cars. Every strategy faces the same incidents in each
        race (common random numbers), so the comparison reflects strategy, not luck of the draw.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 16, marginBottom: 16, alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
            SAFETY CARS PER RACE: {rate.toFixed(1)} <span style={{ color: 'var(--text-soft)' }}>(circuit estimate {circuit.scRate ?? 0.7})</span>
          </label>
          <input type="range" min={0} max={30} value={Math.round(rate * 10)}
            onChange={e => setRateOverride(e.target.value / 10)}
            style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={react} onChange={e => setReact(e.target.checked)} />
          Pit under a safety car if it comes within {REACT_WINDOW} laps of a planned stop
        </label>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {(sim.scShare * 100).toFixed(0)}% of simulated races had at least one safety car
        </div>
      </div>

      {flipped && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(212, 168, 0, 0.12)', border: '1px solid rgba(212, 168, 0, 0.35)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Uncertainty changes the answer: <strong>{describe(bestExpected.stints)}</strong> has the best expected race time,
          even though <strong>{describe(bestDeterministic.stints)}</strong> is fastest in a clean race.
        </div>
      )}

      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
              {['Strategy', 'Plan', 'Clean race', 'Expected', 'P10 – P90', 'Wins'].map(h => (
                <th key={h} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((s, i) => (
              <tr key={s.idx} style={{ borderTop: '1px solid var(--panel-border)', background: i === 0 ? 'var(--accent-soft)' : 'transparent' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: s.color ? tone(s.color) : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{s.name}</td>
                <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', ...mono, whiteSpace: 'nowrap' }}>{describe(s.stints)}</td>
                <td style={{ padding: '6px 8px', ...mono }}>{formatRaceTime(s.deterministic)}</td>
                <td style={{ padding: '6px 8px', ...mono, fontWeight: 700 }}>{formatRaceTime(s.mean)}</td>
                <td style={{ padding: '6px 8px', ...mono, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatRaceTime(s.p10)} – {formatRaceTime(s.p90)}</td>
                <td style={{ padding: '6px 8px', ...mono }}>{(s.winRate * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {head && (
        <>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {strategies[0].name} beats {strategies[1].name} in {(head.aWins * 100).toFixed(1)}% of races
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · mean margin {Math.abs(head.mean).toFixed(1)}s to {head.mean > 0 ? strategies[0].name : strategies[1].name}</span>
          </h4>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            Distribution of race-time difference (B − A). Bars right of zero are races A won.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={head.hist} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} stroke="var(--text-muted)" fontSize={10}
                tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}s`} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip
                contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                labelFormatter={v => `B − A ≈ ${Number(v).toFixed(1)}s`}
                formatter={v => [v, 'races']}
              />
              <ReferenceLine x={0} stroke="var(--text-secondary)" strokeDasharray="3 3" />
              <Bar dataKey="count" isAnimationActive={false}>
                {head.hist.map((h, i) => <Cell key={i} fill={h.x > 0 ? strategies[0].color : strategies[1].color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
        Model: safety-car count ~ Poisson(rate), each lasting 3–5 laps at {SC_PACE}× base pace; a stop under the safety car
        costs {Math.round(SC_PIT_FACTOR * 100)}% of the normal pit loss. Circuit rates are rough estimates from recent seasons.
        Virtual safety cars, red flags and position effects are not modelled.
      </p>
    </Card>
  );
}
