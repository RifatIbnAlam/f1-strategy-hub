import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { FlaskConical, Loader, AlertTriangle, Upload } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { getRaceSessions, getLaps, getStints, getDrivers, formatSessionLabel, uniqueDrivers } from '../services/openf1';
import { TIRE_COMPOUNDS } from '../data/constants';
import {
  cleanRaceLaps, fitRaceModel, backtest, estimatePitLoss, finishingOrder, actualStrategy, toSimulatorCircuit,
} from '../models/calibration';
import { COMPOUND_MODEL, simulateStrategy, findOptimalStrategies, formatRaceTime } from '../models/strategy';
import { toneLegend } from './chartUtils';

const FUEL_EFFECT = 0.033;
const START_FUEL = 100;
const DEFAULT_PIT_LOSS = 22;

const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

const labelStyle = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 4, display: 'block' };
const selectStyle = { width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12 };
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const signed = (v, digits = 3) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;

const Metric = ({ label, value, sub, highlight }) => (
  <div style={{ padding: '10px 12px', borderRadius: 8, background: highlight ? 'var(--accent-soft)' : 'var(--app-bg-alt)', border: highlight ? '1px solid var(--accent-border)' : '1px solid transparent' }}>
    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', ...mono }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
  </div>
);

const StintBar = ({ stints }) => (
  <div style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
    {stints.map((s, i) => (
      <div key={i} title={`${s.compound} · ${s.laps} laps`} style={{ flex: s.laps, background: TIRE_COMPOUNDS[s.compound].color }} />
    ))}
  </div>
);

const describe = (stints) => stints.map(s => `${TIRE_COMPOUNDS[s.compound].label[0]}${s.laps}`).join(' → ');

/**
 * Fit the strategy model to a real race, score it on clean laps (in-sample or
 * against the previous season's race at the same circuit), and compare the
 * winner's actual strategy with the model's optimum.
 */
export default function ModelCalibration({ onApply }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [sessionKey, setSessionKey] = useState(null);
  const [mode, setMode] = useState('out-of-sample');

  const { data: sessions, loading: sessLoad } = useApi(() => getRaceSessions(year), [year]);
  const races = (sessions || []).filter(s => s.session_name === 'Race');
  const session = races.find(s => String(s.session_key) === String(sessionKey));

  const { data: laps, loading: lapsLoad } = useApi(() => getLaps(sessionKey), [sessionKey], !!sessionKey);
  const { data: stints, loading: stintsLoad } = useApi(() => getStints(sessionKey), [sessionKey], !!sessionKey);
  const { data: drivers } = useApi(() => getDrivers(sessionKey), [sessionKey], !!sessionKey);

  // Out-of-sample source: the same circuit's race one season earlier.
  const wantPrev = !!session && mode === 'out-of-sample';
  const { data: prevSessions, loading: prevSessLoad } = useApi(() => getRaceSessions(year - 1), [year, wantPrev], wantPrev);
  const prevRace = wantPrev ? (prevSessions || []).find(s => s.session_name === 'Race' && s.circuit_key === session.circuit_key) : null;
  const { data: prevLaps, loading: prevLapsLoad } = useApi(() => getLaps(prevRace.session_key), [prevRace?.session_key], !!prevRace);
  const { data: prevStints, loading: prevStintsLoad } = useApi(() => getStints(prevRace.session_key), [prevRace?.session_key], !!prevRace);

  const loading = sessLoad || lapsLoad || stintsLoad || prevSessLoad || prevLapsLoad || prevStintsLoad;
  const prevMissing = wantPrev && !prevSessLoad && prevSessions && !prevRace;

  const result = useMemo(() => {
    if (!laps?.length || !stints?.length) return null;
    const testRows = cleanRaceLaps(laps, stints);
    let fit;
    let source;
    if (mode === 'out-of-sample') {
      if (!prevLaps?.length || !prevStints?.length) return null;
      fit = fitRaceModel(cleanRaceLaps(prevLaps, prevStints));
      source = prevRace;
    } else {
      fit = fitRaceModel(testRows);
      source = session;
    }
    if (fit.error) return { error: fit.error };

    const scores = backtest(fit, testRows);
    if (!scores) return { error: 'Not enough clean laps in the test race to score the model.' };

    const order = finishingOrder(laps);
    const winner = order.find(d => scores.levels[d] != null);
    const totalLaps = Math.max(...laps.filter(l => l.driver_number === order[0]).map(l => l.lap_number));
    const pitLoss = estimatePitLoss(laps, stints) ?? DEFAULT_PIT_LOSS;
    const { circuit, options } = toSimulatorCircuit(fit, {
      name: `Calibrated — ${session?.meeting_name || 'race'} ${year}`,
      pace: scores.levels[winner],
      totalLaps,
      pitLoss: +pitLoss.toFixed(1),
      fuelEffect: FUEL_EFFECT,
      startFuel: START_FUEL,
      scRate: 0.7,
    });

    const winnerPlan = actualStrategy(stints, winner);
    const winnerSim = winnerPlan && winnerPlan.reduce((a, s) => a + s.laps, 0) === totalLaps
      ? simulateStrategy(winnerPlan, circuit, options) : null;
    const optimal = findOptimalStrategies(circuit, options, { top: 3 });

    return { fit, source, scores, winner, winnerPlan, winnerSim, optimal, circuit, options, pitLoss };
  }, [laps, stints, prevLaps, prevStints, mode, prevRace, session, year]);

  const driverName = (dn) => {
    const d = uniqueDrivers(drivers).find(x => x.driver_number === Number(dn));
    return d ? d.full_name : `#${dn}`;
  };

  const chartData = result?.scores?.series?.[result.winner] || [];

  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <FlaskConical size={16} color="var(--accent)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Calibrate &amp; Backtest on Real Races</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 8px', background: 'var(--app-bg-alt)', borderRadius: 4 }}>OpenF1 · 2023+</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Fits compound pace, tyre wear and fuel/track gain with a fixed-effects regression over every clean lap of a race,
        then scores the fit on a race it hasn't seen and checks whether the winner's strategy matches the model's optimum
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>YEAR</label>
          <select value={year} onChange={e => { setYear(parseInt(e.target.value, 10)); setSessionKey(null); }} style={selectStyle}>
            {Array.from({ length: new Date().getFullYear() - 2022 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>TEST RACE</label>
          <select value={sessionKey || ''} onChange={e => setSessionKey(e.target.value || null)} disabled={sessLoad} style={selectStyle}>
            <option value="">Select race...</option>
            {races.map(s => <option key={s.session_key} value={s.session_key}>{formatSessionLabel(s)}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>FIT THE MODEL ON</label>
          <select value={mode} onChange={e => setMode(e.target.value)} style={selectStyle}>
            <option value="out-of-sample">Same circuit, previous season (out-of-sample)</option>
            <option value="in-sample">The test race itself (in-sample)</option>
          </select>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
          <Loader size={14} style={{ animation: 'pulse 1s infinite' }} /> Fetching every lap of the race...
        </div>
      )}
      {prevMissing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-text)', fontSize: 12 }}>
          <AlertTriangle size={14} /> No {year - 1} race at this circuit in OpenF1. Switch to in-sample, or pick another race.
        </div>
      )}
      {result?.error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-text)', fontSize: 12 }}>
          <AlertTriangle size={14} /> {result.error}
        </div>
      )}

      {result && !result.error && (
        <>
          {/* Fitted parameters */}
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
            Fitted on {result.source?.meeting_name} {result.source?.year} · {result.fit.n} clean laps · R² {result.fit.r2.toFixed(3)} · residual σ {result.fit.residualStd.toFixed(3)}s
          </h4>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                  {['Compound', 'Clean laps', `Pace vs ${result.fit.reference.toLowerCase()}`, 'Wear (fitted)', 'Wear (sim default)'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['SOFT', 'MEDIUM', 'HARD'].map(c => {
                  const seen = result.fit.compounds.includes(c);
                  return (
                    <tr key={c} style={{ borderTop: '1px solid var(--panel-border)', color: seen ? 'var(--text-primary)' : 'var(--text-soft)' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: TIRE_COMPOUNDS[c].color, marginRight: 6 }} />
                        {TIRE_COMPOUNDS[c].label}
                      </td>
                      <td style={{ padding: '6px 8px', ...mono }}>{result.fit.laps[c] || 0}</td>
                      <td style={{ padding: '6px 8px', ...mono }}>{seen ? `${signed(result.fit.offsets[c])}s` : 'not raced'}</td>
                      <td style={{ padding: '6px 8px', ...mono }}>{seen ? `${signed(result.fit.degRates[c])} s/lap` : 'default'}</td>
                      <td style={{ padding: '6px 8px', ...mono, color: 'var(--text-muted)' }}>{COMPOUND_MODEL[c].degRate.toFixed(3)} s/lap</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 8, marginBottom: 20 }}>
            <Metric label="Fuel + track gain" value={`${signed(result.fit.lapSlope)}s`} sub="per lap, all compounds" />
            <Metric label="Pit loss (measured)" value={`${result.pitLoss.toFixed(1)}s`} sub="in-lap + out-lap vs neighbours" />
            <Metric
              label={`Backtest MAE (${mode === 'out-of-sample' ? 'out-of-sample' : 'in-sample'})`}
              value={`${result.scores.maeModel.toFixed(3)}s`}
              sub={`${result.scores.n} laps · RMSE ${result.scores.rmseModel.toFixed(3)}s`}
              highlight
            />
            <Metric label="Baseline MAE" value={`${result.scores.maeBaseline.toFixed(3)}s`} sub="each driver's median lap" />
            <Metric
              label="Error reduction"
              value={`${(result.scores.improvement * 100).toFixed(0)}%`}
              sub="vs baseline"
              highlight
            />
          </div>

          {/* Winner: actual vs predicted */}
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Race winner {driverName(result.winner)}: actual vs predicted lap times (clean laps)
          </h4>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
              <XAxis dataKey="lap" type="number" domain={['dataMin', 'dataMax']} stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} domain={['auto', 'auto']} tickFormatter={v => `${v.toFixed(1)}s`} />
              <Tooltip
                contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                labelFormatter={l => `Lap ${l}`}
                formatter={(v, n) => [`${Number(v).toFixed(3)}s`, n]}
              />
              <Legend formatter={toneLegend} wrapperStyle={{ fontSize: 11 }} />
              <Scatter dataKey="actual" name="Actual" fill="var(--text-secondary)" r={2} />
              <Line dataKey="predicted" name="Model" stroke="var(--accent)" dot={false} strokeWidth={2} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Strategy verdict */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 12, marginTop: 16 }}>
            <div style={{ padding: 14, borderRadius: 8, background: 'var(--app-bg-alt)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Winner's actual strategy</div>
              {result.winnerPlan ? (
                <>
                  <StintBar stints={result.winnerPlan} />
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 8, ...mono }}>
                    {describe(result.winnerPlan)}
                    {result.winnerSim && <span style={{ color: 'var(--text-muted)' }}> · model {formatRaceTime(result.winnerSim.totalTime)}</span>}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Used non-slick tyres or incomplete stint data.</div>
              )}
            </div>
            <div style={{ padding: 14, borderRadius: 8, background: 'var(--app-bg-alt)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Model's optimum</div>
              {result.optimal[0] && (
                <>
                  <StintBar stints={result.optimal[0].stints} />
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 8, ...mono }}>
                    {describe(result.optimal[0].stints)} · {formatRaceTime(result.optimal[0].totalTime)}
                    {result.winnerSim && (() => {
                      const gap = result.winnerSim.totalTime - result.optimal[0].totalTime;
                      return gap > 0.05
                        ? <span style={{ color: 'var(--accent-text)' }}> ({gap.toFixed(1)}s faster than the winner's plan)</span>
                        : <span style={{ color: 'var(--positive)' }}> (the winner's plan is optimal under the model)</span>;
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
            The model sees a clean race with no traffic, so a winner who stopped under a safety car, covered a rival, or
            managed pace from the front will look "slower than optimal". That gap is the cost of racing reality, not a bug.
          </p>

          <button
            onClick={() => onApply(result.circuit, result.options)}
            style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Upload size={14} /> Load calibrated model into the simulator
          </button>
        </>
      )}
    </Card>
  );
}
