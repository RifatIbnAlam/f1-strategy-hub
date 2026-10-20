import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart, Legend,
} from 'recharts';
import { Timer, Plus, Trash2, Settings, Zap, AlertTriangle, Cpu, Wand2 } from 'lucide-react';
import { TIRE_COMPOUNDS, DRY_COMPOUNDS, tone } from '../data/constants';
import {
  CIRCUIT_PRESETS,
  DEFAULT_MODEL_OPTIONS,
  compoundCliffLap,
  simulateStrategy,
  findOptimalStrategies,
  formatRaceTime,
} from '../models/strategy';
import RealTireData from './RealTireData';
import ModelCalibration from './ModelCalibration';
import MonteCarloPanel from './MonteCarloPanel';
import { toneLegend } from './chartUtils';

/* ─── Card Primitive ──────────────────────────────────────────────────────── */
const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--panel-bg)',
    border: '1px solid var(--panel-border)',
    borderRadius: 12,
    padding: 24,
    ...style,
  }}>{children}</div>
);

const labelStyle = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const selectStyle = {
  width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6,
  color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13,
};
const tooltipStyle = { background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 12 };

/* ─── Stint Bar ───────────────────────────────────────────────────────────── */
const StintBar = ({ stints, height = 8 }) => (
  <div style={{ display: 'flex', height, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
    {stints.map((s, i) => (
      <div key={i} title={`${TIRE_COMPOUNDS[s.compound].label} · ${s.laps} laps`} style={{
        flex: s.laps,
        background: TIRE_COMPOUNDS[s.compound].color,
        opacity: 0.85,
      }} />
    ))}
  </div>
);

/* ─── Stint Editor ────────────────────────────────────────────────────────── */
const StintEditor = ({ stint, index, onUpdate, onRemove, maxLaps }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px',
    background: 'var(--app-bg-alt)',
    borderRadius: 8,
    borderLeft: `4px solid ${TIRE_COMPOUNDS[stint.compound].color}`,
  }}>
    <span style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      S{index + 1}
    </span>
    <select
      value={stint.compound}
      onChange={e => onUpdate(index, 'compound', e.target.value)}
      aria-label={`Stint ${index + 1} compound`}
      style={{
        background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6,
        color: 'var(--text-primary)',
        padding: '6px 10px', fontSize: 12, fontWeight: 600,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: 'pointer',
      }}
    >
      {DRY_COMPOUNDS.map(c => (
        <option key={c} value={c}>{TIRE_COMPOUNDS[c].label}</option>
      ))}
    </select>
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="range"
        min={1}
        max={maxLaps}
        value={stint.laps}
        aria-label={`Stint ${index + 1} laps`}
        onChange={e => onUpdate(index, 'laps', parseInt(e.target.value, 10))}
        style={{ flex: 1, minWidth: 0, accentColor: TIRE_COMPOUNDS[stint.compound].color }}
      />
      <span style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 30, textAlign: 'right',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {stint.laps}
      </span>
    </div>
    {index > 0 && (
      <button onClick={() => onRemove(index)} aria-label={`Remove stint ${index + 1}`} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-text)', padding: 4,
      }}>
        <Trash2 size={14} />
      </button>
    )}
  </div>
);

// Strategy series colours: the app's brand red and a violet that no team
// uses, so plans are never mistaken for a team's data.
const STRATEGY_COLORS = ['#e10600', '#8b5cf6'];

/* ─── Strategy Simulator ──────────────────────────────────────────────────── */
export default function StrategySimulator() {
  const [circuitKey, setCircuitKey] = useState('monza');
  const [degModel, setDegModel] = useState(DEFAULT_MODEL_OPTIONS.degModel);
  const [cliffLap, setCliffLap] = useState(DEFAULT_MODEL_OPTIONS.cliffLap);
  const [trackEvolution, setTrackEvolution] = useState(DEFAULT_MODEL_OPTIONS.trackEvolution);
  const [startFuel, setStartFuel] = useState(DEFAULT_MODEL_OPTIONS.startFuel);
  const [strategies, setStrategies] = useState([
    {
      name: 'Strategy A',
      stints: [
        { compound: 'MEDIUM', laps: 24 },
        { compound: 'HARD', laps: 29 },
      ],
    },
    {
      name: 'Strategy B',
      stints: [
        { compound: 'SOFT', laps: 15 },
        { compound: 'HARD', laps: 20 },
        { compound: 'MEDIUM', laps: 18 },
      ],
    },
  ]);

  // A circuit fitted from a real race (via "Calibrate & Backtest") joins the presets.
  const [calibrated, setCalibrated] = useState(null);
  const allCircuits = useMemo(
    () => (calibrated ? { calibrated, ...CIRCUIT_PRESETS } : CIRCUIT_PRESETS),
    [calibrated]
  );
  const circuit = allCircuits[circuitKey];
  const options = useMemo(
    () => ({ degModel, cliffLap, trackEvolution, startFuel }),
    [degModel, cliffLap, trackEvolution, startFuel]
  );

  const simData = useMemo(
    () => strategies.map((s, i) => ({ ...s, color: STRATEGY_COLORS[i], ...simulateStrategy(s.stints, circuit, options) })),
    [strategies, circuit, options]
  );

  // The optimiser evaluates ~30k strategies; defer it so sliders stay smooth.
  const deferredCircuit = useDeferredValue(circuit);
  const deferredOptions = useDeferredValue(options);
  const optimal = useMemo(
    () => findOptimalStrategies(deferredCircuit, deferredOptions),
    [deferredCircuit, deferredOptions]
  );

  const chartData = useMemo(() => {
    const maxLaps = Math.max(...simData.map(s => s.laps.length));
    return Array.from({ length: maxLaps }, (_, i) => {
      const point = { lap: i + 1 };
      simData.forEach((s, si) => {
        const lap = s.laps[i];
        if (!lap) return;
        // Pit in-laps include the pit-lane loss; plot racing pace only.
        point[`lapTime_${si}`] = lap.pit ? null : +lap.lapTime.toFixed(3);
        point[`total_${si}`] = lap.totalTime;
      });
      if (point.total_0 != null && point.total_1 != null) {
        point.gap = +(point.total_1 - point.total_0).toFixed(3);
      }
      return point;
    });
  }, [simData]);

  const updateStint = useCallback((stratIdx, stintIdx, field, value) => {
    setStrategies(prev => prev.map((strat, i) => i !== stratIdx ? strat : {
      ...strat,
      stints: strat.stints.map((s, j) => j === stintIdx ? { ...s, [field]: value } : s),
    }));
  }, []);

  const addStint = useCallback((stratIdx) => {
    setStrategies(prev => prev.map((strat, i) => i !== stratIdx ? strat : {
      ...strat,
      stints: [...strat.stints, { compound: 'HARD', laps: 10 }],
    }));
  }, []);

  const removeStint = useCallback((stratIdx, stintIdx) => {
    setStrategies(prev => prev.map((strat, i) => i !== stratIdx ? strat : {
      ...strat,
      stints: strat.stints.filter((_, j) => j !== stintIdx),
    }));
  }, []);

  // Stretch or shrink the final stint so the plan covers the race distance.
  const fitToDistance = useCallback((stratIdx) => {
    setStrategies(prev => prev.map((strat, i) => {
      if (i !== stratIdx) return strat;
      const others = strat.stints.slice(0, -1).reduce((a, s) => a + s.laps, 0);
      const last = strat.stints[strat.stints.length - 1];
      return {
        ...strat,
        stints: [...strat.stints.slice(0, -1), { ...last, laps: Math.max(1, circuit.totalLaps - others) }],
      };
    }));
  }, [circuit.totalLaps]);

  const loadStrategy = useCallback((stratIdx, stints) => {
    setStrategies(prev => prev.map((strat, i) => i !== stratIdx ? strat : { ...strat, stints: stints.map(s => ({ ...s })) }));
  }, []);

  // When switching circuit, rescale every plan to the new race distance.
  const rescaleTo = (next) => {
    setStrategies(prev => prev.map(strat => {
      const total = strat.stints.reduce((a, s) => a + s.laps, 0) || 1;
      const scaled = strat.stints.map(s => ({ ...s, laps: Math.max(1, Math.round(s.laps * next.totalLaps / total)) }));
      const drift = next.totalLaps - scaled.reduce((a, s) => a + s.laps, 0);
      scaled[scaled.length - 1].laps = Math.max(1, scaled[scaled.length - 1].laps + drift);
      return { ...strat, stints: scaled };
    }));
  };

  const changeCircuit = (key) => {
    rescaleTo(allCircuits[key]);
    setCircuitKey(key);
  };

  const applyCalibration = (fitted, fittedOptions) => {
    setCalibrated(fitted);
    rescaleTo(fitted);
    setCircuitKey('calibrated');
    setDegModel(fittedOptions.degModel);
    setStartFuel(fittedOptions.startFuel);
    setTrackEvolution(Math.min(0.02, Math.max(-0.06, +fittedOptions.trackEvolution.toFixed(3))));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bothValid = simData.every(s => s.valid);
  const winner = simData[0].totalTime <= simData[1].totalTime ? 0 : 1;
  const timeDiff = Math.abs(simData[0].totalTime - simData[1].totalTime).toFixed(3);
  const bestTime = optimal[0]?.totalTime;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Timer size={28} color="var(--accent)" />
          Race Strategy Simulator
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Model tyre wear, fuel burn and pit loss lap by lap, search every legal 1- and 2-stop plan, stress-test them against
          random safety cars, and calibrate the model against real races
        </p>
      </div>

      {/* Circuit + Physics Config */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Settings size={16} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Simulation Parameters</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16 }}>
          <div>
            <label style={labelStyle}>CIRCUIT</label>
            <select value={circuitKey} onChange={e => changeCircuit(e.target.value)} style={{ ...selectStyle, fontFamily: "'JetBrains Mono', monospace" }}>
              {Object.entries(allCircuits).map(([k, v]) => (
                <option key={k} value={k}>{v.name} ({v.totalLaps} laps)</option>
              ))}
            </select>
            <div style={{ fontSize: 10, color: 'var(--text-soft)', marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
              pit loss {circuit.pitLoss}s · fuel {circuit.fuelEffect}s/kg
            </div>
          </div>
          <div>
            <label style={labelStyle}>TYRE MODEL</label>
            <select value={degModel} onChange={e => setDegModel(e.target.value)} style={selectStyle}>
              <option value="linear">Linear Degradation</option>
              <option value="cliff">Linear + Performance Cliff</option>
            </select>
          </div>
          {degModel === 'cliff' && (
            <div>
              <label style={labelStyle}>
                CLIFF (TYRE AGE): S{compoundCliffLap('SOFT', cliffLap)} · M{cliffLap} · H{compoundCliffLap('HARD', cliffLap)}
              </label>
              <input type="range" min={10} max={40} value={cliffLap}
                onChange={e => setCliffLap(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
          )}
          <div>
            <label style={labelStyle}>
              TRACK EVOLUTION: {trackEvolution.toFixed(3)}s/lap
            </label>
            <input type="range" min={-60} max={20} value={Math.round(trackEvolution * 1000)}
              onChange={e => setTrackEvolution(e.target.value / 1000)}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>
          <div>
            <label style={labelStyle}>
              START FUEL: {startFuel} kg
            </label>
            <input type="range" min={60} max={110} value={startFuel}
              onChange={e => setStartFuel(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>
        </div>
      </Card>

      {/* Optimal Strategies */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Cpu size={16} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Optimal Strategies</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Exhaustive search over every 1- and 2-stop plan (minimum 5-lap stints, two-compound rule enforced), with memoised stint costs
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {optimal.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '24px minmax(120px, 1fr) auto', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8, background: 'var(--app-bg-alt)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? 'var(--warning)' : 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {i + 1}
              </span>
              <div>
                <StintBar stints={r.stints} height={10} />
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                  {r.stints.map(s => `${TIRE_COMPOUNDS[s.compound].label[0]}${s.laps}`).join(' → ')}
                  <span style={{ color: 'var(--text-muted)' }}> · {r.pitStops} stop{r.pitStops !== 1 ? 's' : ''}</span>
                  <span style={{ color: 'var(--text-muted)' }}> · {formatRaceTime(r.totalTime)}</span>
                  {i > 0 && <span style={{ color: 'var(--accent-text)' }}> (+{(r.totalTime - bestTime).toFixed(1)}s)</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {strategies.map((s, si) => (
                  <button key={si} onClick={() => loadStrategy(si, r.stints)} title={`Load into ${s.name}`} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: 'transparent', color: tone(STRATEGY_COLORS[si]), border: `1px solid ${STRATEGY_COLORS[si]}66`,
                  }}>
                    → {s.name.slice(-1)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Strategy Builders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 24, marginBottom: 24 }}>
        {simData.map((strat, si) => (
          <Card key={si} style={{ borderTop: `3px solid ${strat.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 16, fontWeight: 700, color: tone(strat.color) }}>{strat.name}</span>
                <span style={{
                  fontSize: 11, color: 'var(--text-muted)', marginLeft: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {strat.pitStops} stop{strat.pitStops !== 1 ? 's' : ''}
                  {strat.valid && ` · ${formatRaceTime(strat.totalTime)}`}
                </span>
              </div>
              {strat.stints.reduce((a, s) => a + s.laps, 0) !== circuit.totalLaps && (
                <button onClick={() => fitToDistance(si)} style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
                  background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
                  color: 'var(--text-primary)', fontSize: 11, cursor: 'pointer',
                }}>
                  <Wand2 size={12} /> Fit to {circuit.totalLaps} laps
                </button>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <StintBar stints={strat.stints} />
            </div>

            {strat.issues.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {strat.issues.map(issue => (
                  <span key={issue} style={{ fontSize: 11, color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} /> {issue}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {strat.stints.map((stint, i) => (
                <StintEditor
                  key={i}
                  stint={stint}
                  index={i}
                  onUpdate={(stintIdx, field, value) => updateStint(si, stintIdx, field, value)}
                  onRemove={(stintIdx) => removeStint(si, stintIdx)}
                  maxLaps={circuit.totalLaps}
                />
              ))}
              {strat.stints.length < 4 && (
                <button onClick={() => addStint(si)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 16px', background: 'var(--app-bg-alt)',
                  border: '1px dashed var(--input-border)', borderRadius: 8,
                  color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
                }}>
                  <Plus size={14} /> Add Pit Stop
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Result */}
      <Card style={{
        marginBottom: 24,
        background: bothValid
          ? `linear-gradient(135deg, ${simData[winner].color}10, var(--app-bg-alt))`
          : 'var(--app-bg-alt)',
        borderLeft: `4px solid ${bothValid ? simData[winner].color : 'var(--accent)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {bothValid ? <Zap size={24} color={simData[winner].color} /> : <AlertTriangle size={24} color="var(--accent)" />}
          <div>
            {bothValid ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {simData[winner].name} wins by {timeDiff}s
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Race time {formatRaceTime(simData[winner].totalTime)}
                  {' '}&middot; {(simData[winner].totalTime - bestTime).toFixed(1)}s off the optimal strategy
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Fix the highlighted issues to compare strategies
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  A plan that is short of the race distance or breaks the two-compound rule can't be compared fairly.
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      <MonteCarloPanel
        key={circuit.name}
        circuit={circuit}
        options={options}
        strategies={simData}
        optimal={optimal.slice(0, 4)}
      />

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 24 }}>
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Lap Time Comparison
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            Racing laps only; pit in-laps are omitted so the stop doesn't flatten the scale
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
              <XAxis dataKey="lap" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} domain={['auto', 'auto']}
                tickFormatter={v => `${v.toFixed(1)}s`} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={l => `Lap ${l}`}
                formatter={(v, name) => [`${Number(v).toFixed(3)}s`, name]}
              />
              <Legend formatter={toneLegend} wrapperStyle={{ fontSize: 12 }} />
              {simData.map((s, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`lapTime_${i}`}
                  stroke={s.color}
                  dot={false}
                  strokeWidth={2}
                  name={s.name}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Gap Between Strategies
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            Cumulative race time of B minus A. Above zero means A is ahead on the road.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
              <XAxis dataKey="lap" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}s`} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={l => `Lap ${l}`}
                formatter={(v) => [`${Math.abs(Number(v)).toFixed(3)}s`, v > 0 ? 'A ahead by' : 'B ahead by']}
              />
              <ReferenceLine y={0} stroke="var(--accent)" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="gap"
                stroke={STRATEGY_COLORS[1]}
                fill={`${STRATEGY_COLORS[1]}20`}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Fit the model to a real race and backtest it */}
      <div style={{ marginTop: 24 }}>
        <ModelCalibration onApply={applyCalibration} />
      </div>

      {/* Real Tire Degradation Analysis */}
      <RealTireData />
    </div>
  );
}
