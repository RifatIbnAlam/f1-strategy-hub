import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { getSessions, getDrivers, getLaps, getStints } from '../services/openf1';
import { getDriverColor, TIRE_COMPOUNDS } from '../data/constants';
import { getFlag } from '../data/flags';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ArrowDownUp, Loader, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';

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

/* ─── Undercut / Overcut Analyzer ─────────────────────────────────────────── */
export default function UndercutAnalyzer() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [sessionKey, setSessionKey] = useState(null);
  const [driver1, setDriver1] = useState(null);
  const [driver2, setDriver2] = useState(null);

  const { data: sessions, loading: sessLoad } = useApi(
    () => getSessions(year, 'Race'), [year]
  );
  const { data: drivers, loading: drvLoad } = useApi(
    () => sessionKey ? getDrivers(sessionKey) : Promise.resolve([]),
    [sessionKey], !!sessionKey
  );
  const { data: laps1, loading: l1Load } = useApi(
    () => (sessionKey && driver1) ? getLaps(sessionKey, driver1) : Promise.resolve([]),
    [sessionKey, driver1], !!(sessionKey && driver1)
  );
  const { data: laps2, loading: l2Load } = useApi(
    () => (sessionKey && driver2) ? getLaps(sessionKey, driver2) : Promise.resolve([]),
    [sessionKey, driver2], !!(sessionKey && driver2)
  );
  const { data: stints1 } = useApi(
    () => (sessionKey && driver1) ? getStints(sessionKey, driver1) : Promise.resolve([]),
    [sessionKey, driver1], !!(sessionKey && driver1)
  );
  const { data: stints2 } = useApi(
    () => (sessionKey && driver2) ? getStints(sessionKey, driver2) : Promise.resolve([]),
    [sessionKey, driver2], !!(sessionKey && driver2)
  );

  const uniqueDrivers = useMemo(() => {
    if (!drivers) return [];
    const seen = new Set();
    return drivers.filter(d => {
      if (seen.has(d.driver_number)) return false;
      seen.add(d.driver_number); return true;
    });
  }, [drivers]);

  const sessionOpts = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a, b) =>
      (b.date_start ? new Date(b.date_start).getTime() : 0) -
      (a.date_start ? new Date(a.date_start).getTime() : 0)
    );
  }, [sessions]);

  const d1Info = uniqueDrivers.find(d => d.driver_number === driver1);
  const d2Info = uniqueDrivers.find(d => d.driver_number === driver2);
  const color1 = getDriverColor(driver1);
  const color2 = getDriverColor(driver2);

  // ── Core undercut/overcut analysis ──
  const analysis = useMemo(() => {
    if (!laps1?.length || !laps2?.length || !stints1?.length || !stints2?.length) return null;

    const valid = laps => laps.filter(l => l.lap_duration > 10 && l.lap_duration < 200);
    const v1 = valid(laps1);
    const v2 = valid(laps2);

    // Build lap maps
    const lapMap1 = {};
    v1.forEach(l => { lapMap1[l.lap_number] = l.lap_duration; });
    const lapMap2 = {};
    v2.forEach(l => { lapMap2[l.lap_number] = l.lap_duration; });

    // Build cumulative time maps (race time elapsed)
    const cumTime1 = {};
    let cum1 = 0;
    v1.sort((a, b) => a.lap_number - b.lap_number).forEach(l => {
      cum1 += l.lap_duration;
      cumTime1[l.lap_number] = cum1;
    });
    const cumTime2 = {};
    let cum2 = 0;
    v2.sort((a, b) => a.lap_number - b.lap_number).forEach(l => {
      cum2 += l.lap_duration;
      cumTime2[l.lap_number] = cum2;
    });

    // Find all pit stops for both drivers
    const pitLaps1 = stints1
      .filter((_, i) => i > 0)
      .map(s => s.lap_start ? s.lap_start - 1 : null)
      .filter(Boolean);
    const pitLaps2 = stints2
      .filter((_, i) => i > 0)
      .map(s => s.lap_start ? s.lap_start - 1 : null)
      .filter(Boolean);

    // Compound per lap
    const compound1 = {};
    stints1.forEach(s => {
      for (let l = s.lap_start; l <= (s.lap_end || 999); l++) compound1[l] = s.compound;
    });
    const compound2 = {};
    stints2.forEach(s => {
      for (let l = s.lap_start; l <= (s.lap_end || 999); l++) compound2[l] = s.compound;
    });

    // Calculate gap: positive = D2 behind D1 (D1 ahead)
    const maxLap = Math.max(
      ...Object.keys(cumTime1).map(Number),
      ...Object.keys(cumTime2).map(Number)
    );
    const minLap = Math.min(
      ...Object.keys(cumTime1).map(Number),
      ...Object.keys(cumTime2).map(Number)
    );

    const gapData = [];
    for (let lap = minLap; lap <= maxLap; lap++) {
      if (cumTime1[lap] != null && cumTime2[lap] != null) {
        gapData.push({
          lap,
          gap: parseFloat((cumTime2[lap] - cumTime1[lap]).toFixed(3)),
          lapTime1: lapMap1[lap] || null,
          lapTime2: lapMap2[lap] || null,
          compound1: compound1[lap] || null,
          compound2: compound2[lap] || null,
          isPit1: pitLaps1.includes(lap),
          isPit2: pitLaps2.includes(lap),
        });
      }
    }

    // Detect undercut/overcut windows around pit stops
    const windows = [];
    const allPitLaps = [
      ...pitLaps1.map(l => ({ lap: l, driver: 1 })),
      ...pitLaps2.map(l => ({ lap: l, driver: 2 })),
    ].sort((a, b) => a.lap - b.lap);

    // For each pair of nearby pit stops (one from each driver), analyze the effect
    for (const pit of allPitLaps) {
      const otherPits = pit.driver === 1 ? pitLaps2 : pitLaps1;
      // Find the nearest pit from the other driver within 5 laps
      const nearestOther = otherPits.reduce((best, pl) => {
        const dist = Math.abs(pl - pit.lap);
        return dist < Math.abs(best - pit.lap) && dist <= 5 ? pl : best;
      }, 999);

      if (nearestOther === 999) continue;
      // Avoid duplicates
      if (windows.some(w => w.firstPitLap === Math.min(pit.lap, nearestOther))) continue;

      const firstPitLap = Math.min(pit.lap, nearestOther);
      const secondPitLap = Math.max(pit.lap, nearestOther);
      const firstPitter = pit.lap <= nearestOther ? pit.driver : (pit.driver === 1 ? 2 : 1);

      // Gap before first pit
      const gapBefore = gapData.find(g => g.lap === firstPitLap - 1);
      // Gap after second pit (2 laps after for outlap settling)
      const gapAfter = gapData.find(g => g.lap === secondPitLap + 2) || gapData.find(g => g.lap === secondPitLap + 1);

      if (!gapBefore || !gapAfter) continue;

      const gapChange = gapAfter.gap - gapBefore.gap;
      // Positive gapChange = D2 lost time relative to D1
      // If D1 pitted first and gapChange is negative → D1's undercut worked (gained time)
      // If D1 pitted first and gapChange is positive → D1's undercut failed

      const isUndercut = firstPitter === 1
        ? gapChange < -0.3  // D1 pitted first and gained
        : gapChange > 0.3;  // D2 pitted first and gained
      const isOvercut = firstPitter === 1
        ? gapChange > 0.3   // D1 pitted first but D2 gained by staying out
        : gapChange < -0.3;

      const effectiveGain = firstPitter === 1 ? -gapChange : gapChange;

      windows.push({
        firstPitLap,
        secondPitLap,
        firstPitter,
        gapBefore: gapBefore.gap,
        gapAfter: gapAfter.gap,
        gapChange,
        effectiveGain,
        type: isUndercut ? 'undercut' : isOvercut ? 'overcut' : 'neutral',
        compoundBefore1: compound1[firstPitLap] || '?',
        compoundAfter1: compound1[secondPitLap + 1] || '?',
        compoundBefore2: compound2[firstPitLap] || '?',
        compoundAfter2: compound2[secondPitLap + 1] || '?',
      });
    }

    // Lap time delta (D1 - D2, negative = D1 faster)
    const deltaData = gapData.map(g => ({
      lap: g.lap,
      delta: g.lapTime1 && g.lapTime2 ? parseFloat((g.lapTime1 - g.lapTime2).toFixed(3)) : null,
      compound1: g.compound1,
      compound2: g.compound2,
    })).filter(d => d.delta !== null);

    return { gapData, windows, deltaData, pitLaps1, pitLaps2, stints1, stints2 };
  }, [laps1, laps2, stints1, stints2]);

  const loading = sessLoad || drvLoad || l1Load || l2Load;
  const bothSelected = driver1 && driver2;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <ArrowDownUp size={28} color="var(--accent)" />
          Undercut / Overcut Analyzer
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
          Analyze pit strategy battles — detect undercuts, overcuts, and their effectiveness in real time
        </p>
      </div>

      {/* Selectors */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>YEAR</label>
            <select value={year} onChange={e => { setYear(parseInt(e.target.value)); setSessionKey(null); setDriver1(null); setDriver2(null); }}
              style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13 }}>
              {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>RACE</label>
            <select value={sessionKey || ''} onChange={e => { setSessionKey(e.target.value); setDriver1(null); setDriver2(null); }}
              disabled={sessLoad}
              style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13 }}>
              <option value="">Select race...</option>
              {sessionOpts.map(s => (
                <option key={s.session_key} value={s.session_key}>{formatSessionLabel(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: color1, fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>DRIVER 1</label>
            <select value={driver1 || ''} onChange={e => setDriver1(parseInt(e.target.value))}
              disabled={!sessionKey}
              style={{ width: '100%', background: 'var(--input-bg)', border: `1px solid ${color1}44`, borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13 }}>
              <option value="">Select...</option>
              {uniqueDrivers.filter(d => d.driver_number !== driver2).map(d => (
                <option key={d.driver_number} value={d.driver_number}>
                  {getFlag(d.country_code)} #{d.driver_number} {d.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: color2, fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>DRIVER 2</label>
            <select value={driver2 || ''} onChange={e => setDriver2(parseInt(e.target.value))}
              disabled={!sessionKey}
              style={{ width: '100%', background: 'var(--input-bg)', border: `1px solid ${color2}44`, borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13 }}>
              <option value="">Select...</option>
              {uniqueDrivers.filter(d => d.driver_number !== driver1).map(d => (
                <option key={d.driver_number} value={d.driver_number}>
                  {getFlag(d.country_code)} #{d.driver_number} {d.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', padding: 20 }}>
          <Loader size={16} style={{ animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: 13 }}>Loading pit strategy data...</span>
        </div>
      )}

      {!bothSelected && !loading && (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <ArrowDownUp size={48} color="var(--text-soft)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Select a race and two drivers to analyze
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            The analyzer will detect undercuts, overcuts, and quantify their effectiveness
          </div>
        </Card>
      )}

      {analysis && bothSelected && (
        <>
          {/* Tire Strategy Timeline */}
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Tire Strategy Comparison
            </h3>
            {[
              { stints: analysis.stints1, label: d1Info?.name_acronym || `#${driver1}`, color: color1 },
              { stints: analysis.stints2, label: d2Info?.name_acronym || `#${driver2}`, color: color2 },
            ].map(({ stints, label, color }) => {
              const maxLap = Math.max(...stints.map(s => s.lap_end || s.lap_start + 20));
              return (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color, width: 40 }}>{label}</span>
                    <div style={{ flex: 1, display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                      {stints.map((s, i) => {
                        const compound = s.compound || 'UNKNOWN';
                        const compColor = TIRE_COMPOUNDS[compound]?.color || '#888';
                        const width = ((s.lap_end || s.lap_start + 15) - s.lap_start + 1) / maxLap * 100;
                        return (
                          <div key={i} style={{
                            width: `${width}%`, background: `${compColor}cc`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 700, color: compound === 'HARD' ? '#333' : '#fff',
                          }}>
                            {compound?.[0]}{compound === 'MEDIUM' ? 'ED' : compound?.slice(1, 3)?.toUpperCase()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {Object.entries(TIRE_COMPOUNDS).filter(([k]) => !['INTERMEDIATE', 'WET'].includes(k)).map(([k, v]) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: v.color }} />
                  {v.label}
                </span>
              ))}
            </div>
          </Card>

          {/* Undercut/Overcut Windows */}
          {analysis.windows.length > 0 && (
            <Card style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                Pit Strategy Windows Detected
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {analysis.windows.map((w, i) => {
                  const firstLabel = w.firstPitter === 1
                    ? (d1Info?.name_acronym || `#${driver1}`)
                    : (d2Info?.name_acronym || `#${driver2}`);
                  const secondLabel = w.firstPitter === 1
                    ? (d2Info?.name_acronym || `#${driver2}`)
                    : (d1Info?.name_acronym || `#${driver1}`);
                  const winnerColor = w.type === 'undercut'
                    ? (w.firstPitter === 1 ? color1 : color2)
                    : w.type === 'overcut'
                      ? (w.firstPitter === 1 ? color2 : color1)
                      : 'var(--text-muted)';
                  const typeIcon = w.type === 'neutral'
                    ? null
                    : w.type === 'undercut'
                      ? <CheckCircle size={14} color="#27F4D2" />
                      : <AlertTriangle size={14} color="#FFD700" />;

                  return (
                    <div key={i} style={{
                      padding: 16, borderRadius: 8,
                      background: 'var(--surface-hover)',
                      border: `1px solid ${winnerColor}30`,
                      borderLeft: `4px solid ${winnerColor}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {typeIcon}
                          <span style={{
                            fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                            textTransform: 'capitalize',
                          }}>
                            {w.type === 'neutral' ? 'No significant effect' : `${w.type} ${w.type === 'undercut' ? 'succeeded' : 'opportunity'}`}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: winnerColor,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {w.effectiveGain > 0 ? '+' : ''}{w.effectiveGain.toFixed(3)}s
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600 }}>{firstLabel}</span>
                        <span style={{ color: 'var(--text-muted)' }}>pits L{w.firstPitLap}</span>
                        <ChevronRight size={12} color="var(--text-muted)" />
                        <span style={{ fontWeight: 600 }}>{secondLabel}</span>
                        <span style={{ color: 'var(--text-muted)' }}>pits L{w.secondPitLap}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                          ({w.secondPitLap - w.firstPitLap} lap offset)
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>Gap before: <strong style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{w.gapBefore > 0 ? '+' : ''}{w.gapBefore.toFixed(3)}s</strong></span>
                        <span>Gap after: <strong style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{w.gapAfter > 0 ? '+' : ''}{w.gapAfter.toFixed(3)}s</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Gap Chart */}
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Race Gap — {d1Info?.name_acronym || `#${driver1}`} vs {d2Info?.name_acronym || `#${driver2}`}
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              Positive = {d2Info?.name_acronym || 'D2'} behind · Vertical lines = pit stops
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={analysis.gapData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="lap" stroke="var(--text-soft)" fontSize={11} />
                <YAxis stroke="var(--text-soft)" fontSize={11}
                  tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                  labelFormatter={l => `Lap ${l}`}
                  formatter={(v, name) => {
                    if (name === 'gap') return [`${v > 0 ? '+' : ''}${v.toFixed(3)}s`, 'Gap'];
                    return [v, name];
                  }}
                />
                <ReferenceLine y={0} stroke="var(--text-soft)" strokeDasharray="2 2" />
                {analysis.pitLaps1.map(l => (
                  <ReferenceLine key={`p1-${l}`} x={l} stroke={color1} strokeDasharray="4 2" strokeWidth={2} opacity={0.6} />
                ))}
                {analysis.pitLaps2.map(l => (
                  <ReferenceLine key={`p2-${l}`} x={l} stroke={color2} strokeDasharray="4 2" strokeWidth={2} opacity={0.6} />
                ))}
                <Line type="monotone" dataKey="gap" stroke="#FFD700" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 16, height: 2, background: color1, display: 'inline-block', borderRadius: 1 }} />
                {d1Info?.name_acronym || `D1`} pit stop
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 16, height: 2, background: color2, display: 'inline-block', borderRadius: 1 }} />
                {d2Info?.name_acronym || `D2`} pit stop
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 16, height: 2, background: '#FFD700', display: 'inline-block', borderRadius: 1 }} />
                Gap
              </span>
            </div>
          </Card>

          {/* Lap Time Delta */}
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Lap Time Delta
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              Per-lap time difference — below zero = {d1Info?.name_acronym || 'D1'} faster
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analysis.deltaData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="lap" stroke="var(--text-soft)" fontSize={11} />
                <YAxis stroke="var(--text-soft)" fontSize={11}
                  tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                  labelFormatter={l => `Lap ${l}`}
                  formatter={(v) => [
                    `${v > 0 ? '+' : ''}${v.toFixed(3)}s`,
                    v < 0 ? `${d1Info?.name_acronym || 'D1'} faster` : `${d2Info?.name_acronym || 'D2'} faster`,
                  ]}
                />
                <ReferenceLine y={0} stroke="var(--text-soft)" strokeDasharray="2 2" />
                {analysis.pitLaps1.map(l => (
                  <ReferenceLine key={`pd1-${l}`} x={l} stroke={color1} strokeDasharray="4 2" opacity={0.5} />
                ))}
                {analysis.pitLaps2.map(l => (
                  <ReferenceLine key={`pd2-${l}`} x={l} stroke={color2} strokeDasharray="4 2" opacity={0.5} />
                ))}
                <Line type="monotone" dataKey="delta" stroke="var(--accent)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* Explainer */}
      <div style={{
        marginTop: 24, padding: 16, borderRadius: 8,
        background: 'var(--surface-hover)', border: '1px solid var(--panel-border)',
        fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>How it works:</strong> An <strong>undercut</strong> occurs
        when a driver pits before their rival to gain an advantage from fresh tires. An <strong>overcut</strong> is
        when a driver stays out longer, betting on clear air and falling tire performance of the pitter. The analyzer
        compares cumulative race time gaps before and after each pit window to quantify the effect in seconds.
      </div>
    </div>
  );
}
