import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { getSessions, getDrivers, getLaps, getStints } from '../services/openf1';
import { TIRE_COMPOUNDS } from '../data/constants';
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

function formatSessionLabel(session) {
  const name = session.meeting_name?.trim() || session.circuit_short_name || `Session ${session.session_key}`;
  const date = session.date_start
    ? new Date(session.date_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  return date ? `${name} (${date})` : name;
}

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
    () => getSessions(year, 'Race'), [year]
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

  const uniqueDrivers = useMemo(() => {
    if (!drivers) return [];
    const seen = new Set();
    return drivers.filter(d => { if (seen.has(d.driver_number)) return false; seen.add(d.driver_number); return true; });
  }, [drivers]);

  const sessionOpts = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a, b) => {
      const at = a.date_start ? new Date(a.date_start).getTime() : 0;
      const bt = b.date_start ? new Date(b.date_start).getTime() : 0;
      return bt - at;
    });
  }, [sessions]);

  // Analyze tire degradation per stint
  const analysis = useMemo(() => {
    if (!laps?.length || !stints?.length) return null;

    const validLaps = laps.filter(l => l.lap_duration && l.lap_duration > 10 && l.lap_duration < 200);

    const stintAnalysis = stints.map((stint, idx) => {
      const stintLaps = validLaps.filter(l =>
        l.lap_number >= stint.lap_start && l.lap_number <= (stint.lap_end || 999)
      );

      // Filter out outliers (pit in/out laps, SC laps) — laps > 150% of median
      const times = stintLaps.map(l => l.lap_duration).sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)] || 0;
      const filtered = stintLaps.filter(l => l.lap_duration < median * 1.5 && l.lap_duration > median * 0.85);

      // Build data points with tire age
      const points = filtered.map(l => ({
        x: l.lap_number - stint.lap_start + 1, // tire age
        y: l.lap_duration,
      }));

      const reg = linearRegression(points);
      const compound = stint.compound || 'UNKNOWN';

      return {
        stintNumber: idx + 1,
        compound,
        lapStart: stint.lap_start,
        lapEnd: stint.lap_end || stintLaps[stintLaps.length - 1]?.lap_number || stint.lap_start,
        totalLaps: filtered.length,
        degradation: reg.slope, // seconds per lap
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
        <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 8px', background: 'var(--surface-hover)', borderRadius: 4 }}>
          OpenF1 Data · 2023+
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 16 }}>
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
          <select value={driverNum || ''} onChange={e => setDriverNum(parseInt(e.target.value))}
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
              Lap Time vs Tire Age — Compound-Colored
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="lap" type="number" stroke="var(--text-soft)" fontSize={10}
                  label={{ value: 'Lap', position: 'insideBottom', offset: -2, fill: 'var(--text-soft)', fontSize: 10 }} />
                <YAxis stroke="var(--text-soft)" fontSize={10} domain={['auto', 'auto']}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {analysis.stintAnalysis.map((stint, i) => {
              const compColor = TIRE_COMPOUNDS[stint.compound]?.color || '#888';
              return (
                <div key={i} style={{
                  padding: 14, borderRadius: 8,
                  background: 'var(--surface-hover)',
                  borderLeft: `4px solid ${compColor}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Stint {stint.stintNumber}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                      background: `${compColor}20`, color: compColor, border: `1px solid ${compColor}40`,
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
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Degradation</span>
                      <span style={{
                        color: stint.degradation > 0.08 ? 'var(--accent)' : stint.degradation > 0.04 ? '#FFD700' : '#27F4D2',
                        fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {stint.degradation > 0 ? '+' : ''}{stint.degradation.toFixed(3)} s/lap
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
                        color: stint.r2 > 0.7 ? '#27F4D2' : stint.r2 > 0.4 ? '#FFD700' : 'var(--text-muted)',
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
              <strong>How to read:</strong> Degradation rate is the slope of a linear fit to lap times within each stint.
              A value of +0.050 s/lap means each successive lap is ~50ms slower. High R² (≥0.7) indicates
              consistent, predictable degradation. Low R² suggests safety car periods, traffic, or weather affected the stint.
              Compare these real values with the simulation model's tire degradation parameters above.
            </div>
          )}
        </>
      )}

      {!analysis && sessionKey && driverNum && !loading && (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-soft)', fontSize: 13 }}>
          No stint data available for this selection. Try a different race or driver.
        </div>
      )}
    </Card>
  );
}
