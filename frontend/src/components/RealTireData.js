import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { getRaceSessions, getDrivers, getLaps, getStints, formatSessionLabel, uniqueDrivers as dedupeDrivers } from '../services/openf1';
import { TIRE_COMPOUNDS, tone } from '../data/constants';
import { getFlag } from '../data/flags';
import {
  ComposedChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Database, Loader, TrendingUp } from 'lucide-react';

/* ─── Linear regression helper ─────────────────────────────────────────────── */
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0, r2: 0 };
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (const { x, y } of points) { sx += x; sy += y; sxy += x * y; sx2 += x * x; }
  const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const mean = sy / n;
  const ssTot = points.reduce((s, { y }) => s + (y - mean) ** 2, 0);
  const ssRes = points.reduce((s, { x, y }) => s + (y - (slope * x + intercept)) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2 };
}

function formatTime(s) {
  if (!s || s <= 0) return '---';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return m > 0 ? `${m}:${sec.padStart(6, '0')}` : `${parseFloat(sec).toFixed(3)}`;
}

// Fuel burn masks tyre wear: the car gets ~0.06 s/lap faster as fuel burns
// off, so a raw lap-time slope understates degradation. These are typical
// values used to fuel-correct the fitted slope.
const START_FUEL_KG = 100;
const FUEL_EFFECT_S_PER_KG = 0.033;

const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

/* ─── Real Tire Degradation Component ─────────────────────────────────────── */
export default function RealTireData() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [sessionKey, setSessionKey] = useState(null);
  const [driverNum, setDriverNum] = useState(null);

  const { data: sessions, loading: sessLoad } = useApi(
    () => getRaceSessions(year), [year]
  );

  const { data: drivers, loading: drvLoad } = useApi(
    () => sessionKey ? getDrivers(sessionKey) : Promise.resolve([]),
    [sessionKey], !!sessionKey
  );

  const { data: laps, loading: lapLoad } = useApi(
    () => (sessionKey && driverNum) ? getLaps(sessionKey, driverNum) : Promise.resolve([]),
    [sessionKey, driverNum], !!(sessionKey && driverNum)
  );

  const { data: stints } = useApi(
    () => (sessionKey && driverNum) ? getStints(sessionKey, driverNum) : Promise.resolve([]),
    [sessionKey, driverNum], !!(sessionKey && driverNum)
  );

  const uniqueDrivers = useMemo(() => dedupeDrivers(drivers), [drivers]);
  const sessionOpts = sessions || [];

  // Analyze tire degradation per stint
  const analysis = useMemo(() => {
    if (!laps?.length || !stints?.length) return null;

    const orderedStints = [...stints].sort((a, b) => a.lap_start - b.lap_start);
    const raceLaps = Math.max(...laps.map(l => l.lap_number));
    const fuelGainPerLap = (START_FUEL_KG / raceLaps) * FUEL_EFFECT_S_PER_KG;

    // In-laps (last lap before a stop) and out-laps include pit-lane time.
    const inLaps = new Set(orderedStints.slice(0, -1).map(s => s.lap_end));
    const validLaps = laps.filter(l =>
      l.lap_duration && l.lap_duration > 10 && l.lap_duration < 200 &&
      !l.is_pit_out_lap && !inLaps.has(l.lap_number) && l.lap_number > 1
    );

    const stintAnalysis = orderedStints.map((stint, idx) => {
      const stintLaps = validLaps.filter(l =>
        l.lap_number >= stint.lap_start && l.lap_number <= (stint.lap_end || 999)
      );

      // Drop safety-car / traffic outliers relative to the stint median
      const times = stintLaps.map(l => l.lap_duration).sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)] || 0;
      const filtered = stintLaps.filter(l => l.lap_duration < median * 1.07 && l.lap_duration > median * 0.95);

      // x = actual tyre age, including laps run before this stint (used sets)
      const ageAtStart = stint.tyre_age_at_start || 0;
      const points = filtered.map(l => ({
        x: ageAtStart + (l.lap_number - stint.lap_start) + 1,
        y: l.lap_duration,
      }));

      const reg = linearRegression(points);
      const compound = stint.compound || 'UNKNOWN';

      return {
        stintNumber: idx + 1,
        compound,
        lapStart: stint.lap_start,
        lapEnd: stint.lap_end || stintLaps[stintLaps.length - 1]?.lap_number || stint.lap_start,
        ageAtStart,
        totalLaps: filtered.length,
        degradation: reg.slope, // raw seconds per lap
        fuelCorrected: reg.slope + fuelGainPerLap,
        basePace: reg.intercept,
        r2: reg.r2,
        points,
        trendLine: points.length >= 2 ? [
          { x: points[0].x, y: reg.intercept + reg.slope * points[0].x },
          { x: points[points.length - 1].x, y: reg.intercept + reg.slope * points[points.length - 1].x },
        ] : [],
      };
    });

    // Build chart data — all laps with compound coloring
    const chartData = validLaps
      .filter(l => l.lap_duration < (validLaps.reduce((a, b) => a + b.lap_duration, 0) / validLaps.length) * 1.5)
      .map(l => {
        const stint = stints.find(s => l.lap_number >= s.lap_start && l.lap_number <= (s.lap_end || 999));
        return {
          lap: l.lap_number,
          time: parseFloat(l.lap_duration.toFixed(3)),
          compound: stint?.compound || 'UNKNOWN',
          tireAge: stint ? l.lap_number - stint.lap_start + 1 : 0,
        };
      });

    return { stintAnalysis, chartData };
  }, [laps, stints]);

  const loading = sessLoad || drvLoad || lapLoad;

  // Split chart data by compound for colored scatter
  const compoundData = useMemo(() => {
    if (!analysis?.chartData) return {};
    const groups = {};
    analysis.chartData.forEach(d => {
      if (!groups[d.compound]) groups[d.compound] = [];
      groups[d.compound].push(d);
    });
    return groups;
  }, [analysis]);

  return (
    <Card style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Database size={16} color="var(--accent)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          Real Tire Degradation Analysis
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 8px', background: 'var(--app-bg-alt)', borderRadius: 4 }}>
          OpenF1 Data · 2023+
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Analyze real stint degradation rates from actual race data — compare with the simulation model above
      </p>

      {/* Selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 4, display: 'block' }}>YEAR</label>
          <select value={year} onChange={e => { setYear(parseInt(e.target.value)); setSessionKey(null); setDriverNum(null); }}
            style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12 }}>
            {Array.from({ length: new Date().getFullYear() - 2022 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 4, display: 'block' }}>RACE</label>
          <select value={sessionKey || ''} onChange={e => { setSessionKey(e.target.value); setDriverNum(null); }}
            disabled={sessLoad}
            style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12 }}>
            <option value="">Select race...</option>
            {sessionOpts.map(s => (
              <option key={s.session_key} value={s.session_key}>{formatSessionLabel(s)}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 4, display: 'block' }}>DRIVER</label>
          <select value={driverNum || ''} onChange={e => setDriverNum(parseInt(e.target.value, 10) || null)}
            disabled={drvLoad || !sessionKey}
            style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12 }}>
            <option value="">Select driver...</option>
            {uniqueDrivers.map(d => (
              <option key={d.driver_number} value={d.driver_number}>
                {getFlag(d.country_code)} #{d.driver_number} {d.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', padding: 16 }}>
          <Loader size={14} style={{ animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: 12 }}>Fetching real race data...</span>
        </div>
      )}

      {analysis && (
        <>
          {/* Degradation Chart */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Lap Time by Race Lap, Coloured by Compound
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="lap" type="number" stroke="var(--text-muted)" fontSize={10}
                  label={{ value: 'Lap', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis stroke="var(--text-muted)" fontSize={10} domain={['auto', 'auto']}
                  tickFormatter={v => `${v.toFixed(1)}s`} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v, name) => [`${formatTime(v)}`, name]}
                  labelFormatter={l => `Lap ${l}`}
                />
                {Object.entries(compoundData).map(([compound, data]) => (
                  <Scatter
                    key={compound}
                    data={data}
                    dataKey="time"
                    fill={TIRE_COMPOUNDS[compound]?.color || '#888'}
                    name={compound}
                    r={3}
                    opacity={0.8}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Stint Degradation Cards */}
          <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
            <TrendingUp size={12} style={{ marginRight: 4 }} />
            Fitted Degradation Rates per Stint
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: 12 }}>
            {analysis.stintAnalysis.map((stint, i) => {
              const compColor = TIRE_COMPOUNDS[stint.compound]?.color || '#888';
              return (
                <div key={i} style={{
                  padding: 14, borderRadius: 8,
                  background: 'var(--app-bg-alt)',
                  borderLeft: `4px solid ${compColor}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Stint {stint.stintNumber}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                      background: `${compColor}20`, color: tone(compColor), border: `1px solid ${compColor}40`,
                    }}>
                      {stint.compound}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Laps</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {stint.lapStart}–{stint.lapEnd} ({stint.totalLaps})
                      </span>
                    </div>
                    {stint.ageAtStart > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Tyre age at fit</span>
                        <span style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                          used ({stint.ageAtStart} laps)
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Raw slope</span>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {stint.degradation > 0 ? '+' : ''}{stint.degradation.toFixed(3)} s/lap
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Fuel-corrected deg</span>
                      <span style={{
                        color: stint.fuelCorrected > 0.12 ? 'var(--accent-text)' : stint.fuelCorrected > 0.06 ? 'var(--warning)' : 'var(--positive)',
                        fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {stint.fuelCorrected > 0 ? '+' : ''}{stint.fuelCorrected.toFixed(3)} s/lap
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Base pace</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatTime(stint.basePace)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Fit R²</span>
                      <span style={{
                        color: stint.r2 > 0.7 ? 'var(--positive)' : stint.r2 > 0.4 ? 'var(--warning)' : 'var(--text-muted)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {stint.r2.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          {analysis.stintAnalysis.length > 0 && (
            <div style={{
              marginTop: 16, padding: 12, borderRadius: 8,
              background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
              fontSize: 11, color: 'var(--text-secondary)',
            }}>
              <strong>How to read:</strong> The raw slope is a least-squares fit of lap time against tyre age within each stint,
              after removing the first lap, pit in/out laps, and laps more than 7% off the stint median (safety car, traffic).
              Burning fuel makes the car ~{((START_FUEL_KG * FUEL_EFFECT_S_PER_KG) / 60).toFixed(3)} s/lap faster on a 60-lap race,
              which hides wear, so the fuel-corrected figure adds that back ({START_FUEL_KG} kg start, {FUEL_EFFECT_S_PER_KG} s/kg).
              High R² (≥0.7) means consistent, predictable degradation. Compare these values with the simulator's compound model above.
            </div>
          )}
        </>
      )}

      {!analysis && sessionKey && driverNum && !loading && (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
          No stint data available for this selection. Try a different race or driver.
        </div>
      )}
    </Card>
  );
}
