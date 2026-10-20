import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { getRaceSessions, getDrivers, getLaps, getStints, formatSessionLabel, uniqueDrivers as dedupeDrivers } from '../services/openf1';
import { getOpenF1DriverColor, distinctColor, tone, textOn, TIRE_COMPOUNDS } from '../data/constants';
import { getFlag } from '../data/flags';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ArrowDownUp, Loader, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * Time each driver crossed the line at the end of every lap, in ms.
 * The end of lap N is the start of lap N+1; the final lap ends at its start
 * plus its duration. Using timestamps (rather than summing lap durations)
 * keeps the gap correct even when a lap has no recorded duration, and
 * includes the gap built on lap 1.
 */
export function lineCrossings(laps) {
  const cross = {};
  laps.forEach(l => {
    if (!l.date_start) return;
    const start = new Date(l.date_start).getTime();
    cross[l.lap_number - 1] = start;
    if (l.lap_duration && cross[l.lap_number] == null) {
      cross[l.lap_number] = start + l.lap_duration * 1000;
    }
  });
  // A following lap's start is more precise than start + duration.
  laps.forEach(l => {
    if (l.date_start) cross[l.lap_number - 1] = new Date(l.date_start).getTime();
  });
  return cross;
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
    () => getRaceSessions(year), [year]
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

  const uniqueDrivers = useMemo(() => dedupeDrivers(drivers), [drivers]);
  const sessionOpts = sessions || [];

  const d1Info = uniqueDrivers.find(d => d.driver_number === driver1);
  const d2Info = uniqueDrivers.find(d => d.driver_number === driver2);
  const color1 = getOpenF1DriverColor(d1Info);
  const color2 = distinctColor(getOpenF1DriverColor(d2Info), color1);

  // ── Core undercut/overcut analysis ──
  const analysis = useMemo(() => {
    if (!laps1?.length || !laps2?.length || !stints1?.length || !stints2?.length) return null;

    const valid = laps => laps.filter(l => l.lap_duration > 10 && l.lap_duration < 200);
    const v1 = valid(laps1);
    const v2 = valid(laps2);

    const lapMap1 = {};
    v1.forEach(l => { lapMap1[l.lap_number] = l.lap_duration; });
    const lapMap2 = {};
    v2.forEach(l => { lapMap2[l.lap_number] = l.lap_duration; });

    // Real on-track gap at the end of each lap, from line-crossing timestamps
    const cross1 = lineCrossings(laps1);
    const cross2 = lineCrossings(laps2);

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
    const commonLaps = Object.keys(cross1).map(Number).filter(l => l >= 1 && cross2[l] != null).sort((a, b) => a - b);

    const gapData = [];
    for (const lap of commonLaps) {
      gapData.push({
        lap,
        gap: parseFloat(((cross2[lap] - cross1[lap]) / 1000).toFixed(3)),
        lapTime1: lapMap1[lap] || null,
        lapTime2: lapMap2[lap] || null,
        compound1: compound1[lap] || null,
        compound2: compound2[lap] || null,
        isPit1: pitLaps1.includes(lap),
        isPit2: pitLaps2.includes(lap),
      });
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
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Analyze pit strategy battles — detect undercuts, overcuts, and their effectiveness in real time
        </p>
      </div>

      {/* Selectors */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>YEAR</label>
            <select value={year} onChange={e => { setYear(parseInt(e.target.value, 10)); setSessionKey(null); setDriver1(null); setDriver2(null); }}
              style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13 }}>
              {Array.from({ length: new Date().getFullYear() - 2022 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
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
            <label style={{ fontSize: 11, color: tone(color1), fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>DRIVER 1</label>
            <select value={driver1 || ''} onChange={e => setDriver1(parseInt(e.target.value, 10) || null)}
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
            <label style={{ fontSize: 11, color: tone(color2), fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>DRIVER 2</label>
            <select value={driver2 || ''} onChange={e => setDriver2(parseInt(e.target.value, 10) || null)}
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: tone(color), width: 40 }}>{label}</span>
                    <div style={{ flex: 1, display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                      {stints.map((s, i) => {
                        const compound = s.compound || 'UNKNOWN';
                        const compColor = TIRE_COMPOUNDS[compound]?.color || '#888';
                        const width = ((s.lap_end || s.lap_start + 15) - s.lap_start + 1) / maxLap * 100;
                        return (
                          <div key={i} style={{
                            width: `${width}%`, background: compColor,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 700, color: textOn(compColor), letterSpacing: '0.5px',
                          }} title={`${compound} · laps ${s.lap_start}–${s.lap_end ?? '?'}`}>
                            {TIRE_COMPOUNDS[compound]?.label?.toUpperCase() || compound}
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
                      : 'var(--text-soft)';
                  const typeIcon = w.type === 'neutral'
                    ? null
                    : w.type === 'undercut'
                      ? <CheckCircle size={14} color="var(--positive)" />
                      : <AlertTriangle size={14} color="#D4A800" />;

                  return (
                    <div key={i} style={{
                      padding: 16, borderRadius: 8,
                      background: 'var(--app-bg-alt)',
                      border: `1px solid color-mix(in srgb, ${winnerColor} 20%, transparent)`,
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
                          fontSize: 12, fontWeight: 700, color: tone(winnerColor),
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
                <XAxis dataKey="lap" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11}
                  tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                  labelFormatter={l => `Lap ${l}`}
                  formatter={(v, name) => {
                    if (name === 'gap') return [`${v > 0 ? '+' : ''}${v.toFixed(3)}s`, 'Gap'];
                    return [v, name];
                  }}
                />
                <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="2 2" />
                {analysis.pitLaps1.map(l => (
                  <ReferenceLine key={`p1-${l}`} x={l} stroke={color1} strokeDasharray="4 2" strokeWidth={2} opacity={0.6} />
                ))}
                {analysis.pitLaps2.map(l => (
                  <ReferenceLine key={`p2-${l}`} x={l} stroke={color2} strokeDasharray="4 2" strokeWidth={2} opacity={0.6} />
                ))}
                <Line type="monotone" dataKey="gap" stroke="#D4A800" strokeWidth={2} dot={false} />
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
                <span style={{ width: 16, height: 2, background: '#D4A800', display: 'inline-block', borderRadius: 1 }} />
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
                <XAxis dataKey="lap" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11}
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
                <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="2 2" />
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
        background: 'var(--app-bg-alt)', border: '1px solid var(--panel-border)',
        fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>How it works:</strong> An <strong>undercut</strong> occurs
        when a driver pits before their rival to gain an advantage from fresh tires. An <strong>overcut</strong> is
        when a driver stays out longer, betting on clear air and falling tire performance of the pitter. The analyzer
        measures the real on-track gap from line-crossing timestamps (summed lap times drift whenever a lap has no
        recorded time), one lap before the first stop and two laps after the second, and reports the net swing.
      </div>
    </div>
  );
}
