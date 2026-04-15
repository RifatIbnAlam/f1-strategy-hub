import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';
import { Timer, Plus, Trash2, Settings, Zap, AlertTriangle } from 'lucide-react';
import { TIRE_COMPOUNDS } from '../data/constants';

/* ─── Tire Physics Model ──────────────────────────────────────────────────── */
function simulateLapTime({
  baseLapTime,      // seconds
  fuelLoad,         // kg, decreases each lap
  fuelEffect,       // seconds per kg
  compound,         // SOFT, MEDIUM, HARD
  tireAge,          // laps on this tire set
  trackEvolution,   // improvement per lap (negative)
  tireDegModel,     // 'linear' | 'cliff'
  cliffLap,         // lap at which cliff occurs
}) {
  const tire = TIRE_COMPOUNDS[compound];
  const gripBonus = compound === 'SOFT' ? -0.4 : compound === 'MEDIUM' ? -0.15 : 0;

  // Tire degradation — linear or cliff model
  let tireDeg;
  if (tireDegModel === 'cliff' && tireAge >= cliffLap) {
    tireDeg = tire.degradation * tireAge + (tireAge - cliffLap) * 0.15;
  } else {
    tireDeg = tire.degradation * tireAge;
  }

  // Fuel effect
  const fuelTime = fuelLoad * fuelEffect;

  // Track evolution (rubber builds up, track gets faster)
  const trackBonus = trackEvolution * tireAge * 0.3;

  return baseLapTime + gripBonus + tireDeg + fuelTime + trackBonus;
}

/* ─── Default Circuit Configs ─────────────────────────────────────────────── */
// All 24 rounds of the 2025 F1 World Championship calendar
// baseLap: representative qualifying/race lap in seconds (recent season avg)
// pitLoss: total time lost per pit stop (in-lap + out-lap delta vs flying lap)
// fuelEffect: lap time penalty per kg of fuel (s/kg)
const CIRCUIT_PRESETS = {
  // ── Round 1 ──────────────────────────────────────────────────────────────
  bahrain:     { name: 'Bahrain — Sakhir',           baseLap:  90.5, totalLaps: 57, pitLoss: 22, fuelEffect: 0.036 },
  // ── Round 2 ──────────────────────────────────────────────────────────────
  jeddah:      { name: 'Saudi Arabia — Jeddah',       baseLap:  90.1, totalLaps: 50, pitLoss: 24, fuelEffect: 0.033 },
  // ── Round 3 ──────────────────────────────────────────────────────────────
  albert_park: { name: 'Australia — Albert Park',     baseLap:  80.2, totalLaps: 58, pitLoss: 24, fuelEffect: 0.034 },
  // ── Round 4 ──────────────────────────────────────────────────────────────
  suzuka:      { name: 'Japan — Suzuka',              baseLap:  91.0, totalLaps: 53, pitLoss: 23, fuelEffect: 0.037 },
  // ── Round 5 ──────────────────────────────────────────────────────────────
  shanghai:    { name: 'China — Shanghai',            baseLap:  96.5, totalLaps: 56, pitLoss: 25, fuelEffect: 0.036 },
  // ── Round 6 ──────────────────────────────────────────────────────────────
  miami:       { name: 'USA — Miami',                 baseLap:  89.2, totalLaps: 57, pitLoss: 22, fuelEffect: 0.035 },
  // ── Round 7 ──────────────────────────────────────────────────────────────
  imola:       { name: 'Emilia Romagna — Imola',      baseLap:  77.1, totalLaps: 63, pitLoss: 26, fuelEffect: 0.034 },
  // ── Round 8 ──────────────────────────────────────────────────────────────
  monaco:      { name: 'Monaco — Monte Carlo',        baseLap:  72.5, totalLaps: 78, pitLoss: 20, fuelEffect: 0.030 },
  // ── Round 9 ──────────────────────────────────────────────────────────────
  montreal:    { name: 'Canada — Montréal',           baseLap:  74.0, totalLaps: 70, pitLoss: 23, fuelEffect: 0.033 },
  // ── Round 10 ─────────────────────────────────────────────────────────────
  barcelona:   { name: 'Spain — Barcelona',           baseLap:  82.4, totalLaps: 66, pitLoss: 21, fuelEffect: 0.037 },
  // ── Round 11 ─────────────────────────────────────────────────────────────
  red_bull_ring:{ name: 'Austria — Red Bull Ring',    baseLap:  64.8, totalLaps: 71, pitLoss: 23, fuelEffect: 0.032 },
  // ── Round 12 ─────────────────────────────────────────────────────────────
  silverstone: { name: 'Britain — Silverstone',       baseLap:  87.0, totalLaps: 52, pitLoss: 22, fuelEffect: 0.038 },
  // ── Round 13 ─────────────────────────────────────────────────────────────
  hungaroring: { name: 'Hungary — Hungaroring',       baseLap:  78.6, totalLaps: 70, pitLoss: 20, fuelEffect: 0.034 },
  // ── Round 14 ─────────────────────────────────────────────────────────────
  spa:         { name: 'Belgium — Spa-Francorchamps', baseLap: 106.0, totalLaps: 44, pitLoss: 23, fuelEffect: 0.040 },
  // ── Round 15 ─────────────────────────────────────────────────────────────
  zandvoort:   { name: 'Netherlands — Zandvoort',     baseLap:  74.0, totalLaps: 72, pitLoss: 23, fuelEffect: 0.033 },
  // ── Round 16 ─────────────────────────────────────────────────────────────
  monza:       { name: 'Italy — Monza',               baseLap:  81.0, totalLaps: 53, pitLoss: 24, fuelEffect: 0.035 },
  // ── Round 17 ─────────────────────────────────────────────────────────────
  baku:        { name: 'Azerbaijan — Baku',           baseLap: 103.0, totalLaps: 51, pitLoss: 18, fuelEffect: 0.033 },
  // ── Round 18 ─────────────────────────────────────────────────────────────
  singapore:   { name: 'Singapore — Marina Bay',      baseLap:  97.5, totalLaps: 62, pitLoss: 22, fuelEffect: 0.031 },
  // ── Round 19 ─────────────────────────────────────────────────────────────
  cota:        { name: 'USA — Circuit of the Americas', baseLap: 96.2, totalLaps: 56, pitLoss: 22, fuelEffect: 0.036 },
  // ── Round 20 ─────────────────────────────────────────────────────────────
  mexico_city: { name: 'Mexico — Autodromo Hermanos Rodríguez', baseLap: 79.4, totalLaps: 71, pitLoss: 23, fuelEffect: 0.030 },
  // ── Round 21 ─────────────────────────────────────────────────────────────
  interlagos:  { name: 'Brazil — Interlagos',         baseLap:  73.1, totalLaps: 71, pitLoss: 24, fuelEffect: 0.034 },
  // ── Round 22 ─────────────────────────────────────────────────────────────
  las_vegas:   { name: 'USA — Las Vegas Strip',       baseLap:  97.8, totalLaps: 50, pitLoss: 20, fuelEffect: 0.034 },
  // ── Round 23 ─────────────────────────────────────────────────────────────
  lusail:      { name: 'Qatar — Lusail',              baseLap:  83.0, totalLaps: 57, pitLoss: 22, fuelEffect: 0.036 },
  // ── Round 24 ─────────────────────────────────────────────────────────────
  yas_marina:  { name: 'Abu Dhabi — Yas Marina',      baseLap:  85.3, totalLaps: 58, pitLoss: 25, fuelEffect: 0.035 },
};

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

/* ─── Stint Editor ────────────────────────────────────────────────────────── */
const StintEditor = ({ stint, index, onUpdate, onRemove, maxLaps }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px',
    background: 'var(--surface-hover)',
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
      style={{
        background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6,
        color: TIRE_COMPOUNDS[stint.compound].color,
        padding: '6px 10px', fontSize: 12, fontWeight: 600,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: 'pointer',
      }}
    >
      {Object.keys(TIRE_COMPOUNDS).filter(k => !['INTERMEDIATE', 'WET'].includes(k)).map(c => (
        <option key={c} value={c}>{TIRE_COMPOUNDS[c].label}</option>
      ))}
    </select>
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>Laps:</span>
      <input
        type="range"
        min={1}
        max={maxLaps}
        value={stint.laps}
        onChange={e => onUpdate(index, 'laps', parseInt(e.target.value))}
        style={{ flex: 1, accentColor: TIRE_COMPOUNDS[stint.compound].color }}
      />
      <span style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 30, textAlign: 'right',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {stint.laps}
      </span>
    </div>
    {index > 0 && (
      <button onClick={() => onRemove(index)} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4,
      }}>
        <Trash2 size={14} />
      </button>
    )}
  </div>
);

/* ─── Strategy Simulator ──────────────────────────────────────────────────── */
export default function StrategySimulator() {
  const [circuit, setCircuit] = useState('monza');
  const [tireDegModel, setTireDegModel] = useState('cliff');
  const [cliffLap, setCliffLap] = useState(18);
  const [trackEvolution, setTrackEvolution] = useState(-0.01);
  const [strategies, setStrategies] = useState([
    {
      name: 'Strategy A',
      color: '#e10600',
      stints: [
        { compound: 'MEDIUM', laps: 25 },
        { compound: 'HARD', laps: 28 },
      ],
    },
    {
      name: 'Strategy B',
      color: '#3671C6',
      stints: [
        { compound: 'SOFT', laps: 15 },
        { compound: 'HARD', laps: 20 },
        { compound: 'MEDIUM', laps: 18 },
      ],
    },
  ]);

  const config = CIRCUIT_PRESETS[circuit];
  const startFuel = config.totalLaps * 1.75; // ~1.75 kg per lap

  // Calculate strategy simulation data
  const simData = useMemo(() => {
    return strategies.map(strategy => {
      const laps = [];
      let totalTime = 0;
      let currentLap = 0;
      let pitStops = 0;

      strategy.stints.forEach((stint, stintIdx) => {
        // Add pit stop time (except first stint)
        if (stintIdx > 0) {
          totalTime += config.pitLoss;
          pitStops++;
        }

        for (let i = 0; i < stint.laps && currentLap < config.totalLaps; i++) {
          currentLap++;
          const fuelRemaining = startFuel - (currentLap * 1.75);
          const lapTime = simulateLapTime({
            baseLapTime: config.baseLap,
            fuelLoad: Math.max(fuelRemaining, 0),
            fuelEffect: config.fuelEffect,
            compound: stint.compound,
            tireAge: i,
            trackEvolution,
            tireDegModel,
            cliffLap,
          });
          totalTime += lapTime;
          laps.push({
            lap: currentLap,
            lapTime: parseFloat(lapTime.toFixed(3)),
            totalTime: parseFloat(totalTime.toFixed(3)),
            compound: stint.compound,
            tireAge: i + 1,
            stint: stintIdx + 1,
          });
        }
      });

      return {
        ...strategy,
        laps,
        totalTime,
        pitStops,
        totalLaps: currentLap,
      };
    });
  }, [strategies, tireDegModel, cliffLap, trackEvolution, config, startFuel]);

  // Build chart data
  const chartData = useMemo(() => {
    const maxLaps = Math.max(...simData.map(s => s.laps.length));
    return Array.from({ length: maxLaps }, (_, i) => {
      const point = { lap: i + 1 };
      simData.forEach((s, si) => {
        if (s.laps[i]) {
          point[`lapTime_${si}`] = s.laps[i].lapTime;
          point[`total_${si}`] = s.laps[i].totalTime;
          point[`compound_${si}`] = s.laps[i].compound;
        }
      });
      return point;
    });
  }, [simData]);

  // Gap analysis
  const gapData = useMemo(() => {
    if (simData.length < 2) return [];
    return chartData.map(p => ({
      lap: p.lap,
      gap: p.total_1 && p.total_0 ? parseFloat((p.total_1 - p.total_0).toFixed(3)) : null,
    }));
  }, [chartData, simData]);

  const updateStint = useCallback((stratIdx, stintIdx, field, value) => {
    setStrategies(prev => {
      const updated = [...prev];
      updated[stratIdx] = {
        ...updated[stratIdx],
        stints: updated[stratIdx].stints.map((s, i) =>
          i === stintIdx ? { ...s, [field]: value } : s
        ),
      };
      return updated;
    });
  }, []);

  const addStint = useCallback((stratIdx) => {
    setStrategies(prev => {
      const updated = [...prev];
      updated[stratIdx] = {
        ...updated[stratIdx],
        stints: [...updated[stratIdx].stints, { compound: 'HARD', laps: 10 }],
      };
      return updated;
    });
  }, []);

  const removeStint = useCallback((stratIdx, stintIdx) => {
    setStrategies(prev => {
      const updated = [...prev];
      updated[stratIdx] = {
        ...updated[stratIdx],
        stints: updated[stratIdx].stints.filter((_, i) => i !== stintIdx),
      };
      return updated;
    });
  }, []);

  // Calculate who's winning
  const winner = simData.length >= 2
    ? (simData[0].totalTime <= simData[1].totalTime ? 0 : 1)
    : 0;
  const timeDiff = simData.length >= 2
    ? Math.abs(simData[0].totalTime - simData[1].totalTime).toFixed(3)
    : 0;

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
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
          Model tire degradation, pit windows, and race pace to find the optimal strategy
        </p>
      </div>

      {/* Circuit + Physics Config */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Settings size={16} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Simulation Parameters</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>CIRCUIT</label>
            <select value={circuit} onChange={e => setCircuit(e.target.value)} style={{
              width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6,
              color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
            }}>
              {Object.entries(CIRCUIT_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.name} ({v.totalLaps} laps)</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>TIRE MODEL</label>
            <select value={tireDegModel} onChange={e => setTireDegModel(e.target.value)} style={{
              width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6,
              color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13,
            }}>
              <option value="linear">Linear Degradation</option>
              <option value="cliff">Cliff Degradation</option>
            </select>
          </div>
          {tireDegModel === 'cliff' && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                CLIFF LAP: {cliffLap}
              </label>
              <input type="range" min={8} max={35} value={cliffLap}
                onChange={e => setCliffLap(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
              TRACK EVOLUTION: {trackEvolution.toFixed(3)}s/lap
            </label>
            <input type="range" min={-30} max={0} value={trackEvolution * 1000}
              onChange={e => setTrackEvolution(e.target.value / 1000)}
              style={{ width: '100%', accentColor: '#27F4D2' }}
            />
          </div>
        </div>
      </Card>

      {/* Strategy Builders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 24 }}>
        {strategies.map((strat, si) => {
          const totalStintLaps = strat.stints.reduce((a, s) => a + s.laps, 0);
          const lapsOff = totalStintLaps !== config.totalLaps;
          return (
            <Card key={si} style={{ borderTop: `3px solid ${strat.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: strat.color }}>{strat.name}</span>
                  <span style={{
                    fontSize: 11, color: 'var(--text-soft)', marginLeft: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {strat.stints.length - 1} stop{strat.stints.length > 2 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {lapsOff && (
                    <span style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={12} />
                      {totalStintLaps}/{config.totalLaps} laps
                    </span>
                  )}
                </div>
              </div>

              {/* Stint visual bar */}
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16, gap: 2 }}>
                {strat.stints.map((s, i) => (
                  <div key={i} style={{
                    flex: s.laps,
                    background: TIRE_COMPOUNDS[s.compound].color,
                    opacity: 0.8,
                  }} />
                ))}
              </div>

              {/* Stint editors */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {strat.stints.map((stint, i) => (
                  <StintEditor
                    key={i}
                    stint={stint}
                    index={i}
                    onUpdate={(stintIdx, field, value) => updateStint(si, stintIdx, field, value)}
                    onRemove={(stintIdx) => removeStint(si, stintIdx)}
                    maxLaps={config.totalLaps}
                  />
                ))}
                {strat.stints.length < 4 && (
                  <button onClick={() => addStint(si)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 16px', background: 'var(--surface-hover)',
                    border: '1px dashed var(--input-border)', borderRadius: 8,
                    color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}>
                    <Plus size={14} /> Add Pit Stop
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Results */}
      {simData.length >= 2 && (
        <Card style={{
          marginBottom: 24,
          background: `linear-gradient(135deg, ${simData[winner].color}10, var(--app-bg-alt))`,
          borderLeft: `4px solid ${simData[winner].color}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Zap size={24} color={simData[winner].color} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                {simData[winner].name} wins by {timeDiff}s
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Total race time: {Math.floor(simData[winner].totalTime / 60)}m {(simData[winner].totalTime % 60).toFixed(1)}s
                &middot; {simData[winner].pitStops} pit stop{simData[winner].pitStops !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        {/* Lap Time Chart */}
        <Card>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Lap Time Comparison
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
              <XAxis dataKey="lap" stroke="var(--text-soft)" fontSize={11} />
              <YAxis stroke="var(--text-soft)" fontSize={11} domain={['auto', 'auto']}
                tickFormatter={v => `${v.toFixed(1)}s`} />
              <Tooltip
                contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 12 }}
                labelFormatter={l => `Lap ${l}`}
                formatter={(v, name) => [`${v.toFixed(3)}s`, name.includes('_0') ? strategies[0].name : strategies[1].name]}
              />
              {simData.map((s, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`lapTime_${i}`}
                  stroke={s.color}
                  dot={false}
                  strokeWidth={2}
                  name={s.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Gap Chart */}
        <Card>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Gap Between Strategies
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={gapData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
              <XAxis dataKey="lap" stroke="var(--text-soft)" fontSize={11} />
              <YAxis stroke="var(--text-soft)" fontSize={11} tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`} />
              <Tooltip
                contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 12 }}
                labelFormatter={l => `Lap ${l}`}
                formatter={(v) => [`${v > 0 ? '+' : ''}${v.toFixed(3)}s`, 'B vs A Gap']}
              />
              <ReferenceLine y={0} stroke="var(--accent)" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="gap"
                stroke="#3671C6"
                fill="#3671C620"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
