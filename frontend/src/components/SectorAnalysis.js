import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { getSessions, getDrivers, getLaps } from '../services/openf1';
import { getDriverColor } from '../data/constants';
import { getFlag } from '../data/flags';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Layers, Loader } from 'lucide-react';

function formatTime(s) {
  if (!s || s <= 0) return '---';
  return s < 60 ? `${s.toFixed(3)}s` : `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}`;
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

/* ─── Sector Comparison ───────────────────────────────────────────────────── */
export default function SectorAnalysis() {
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

  const { data: laps1, loading: lap1Load } = useApi(
    () => (sessionKey && driver1) ? getLaps(sessionKey, driver1) : Promise.resolve([]),
    [sessionKey, driver1], !!(sessionKey && driver1)
  );

  const { data: laps2, loading: lap2Load } = useApi(
    () => (sessionKey && driver2) ? getLaps(sessionKey, driver2) : Promise.resolve([]),
    [sessionKey, driver2], !!(sessionKey && driver2)
  );

  const uniqueDrivers = useMemo(() => {
    if (!drivers) return [];
    const seen = new Set();
    return drivers.filter(d => { if (seen.has(d.driver_number)) return false; seen.add(d.driver_number); return true; });
  }, [drivers]);

  const sessionOpts = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a, b) => (b.date_start ? new Date(b.date_start).getTime() : 0) - (a.date_start ? new Date(a.date_start).getTime() : 0));
  }, [sessions]);

  const d1Info = uniqueDrivers.find(d => d.driver_number === driver1);
  const d2Info = uniqueDrivers.find(d => d.driver_number === driver2);
  const color1 = getDriverColor(driver1);
  const color2 = getDriverColor(driver2);

  // Sector analysis
  const sectorData = useMemo(() => {
    if (!laps1?.length || !laps2?.length) return null;

    const valid1 = laps1.filter(l => l.duration_sector_1 > 0 && l.duration_sector_2 > 0 && l.duration_sector_3 > 0 && l.lap_duration > 10 && l.lap_duration < 200);
    const valid2 = laps2.filter(l => l.duration_sector_1 > 0 && l.duration_sector_2 > 0 && l.duration_sector_3 > 0 && l.lap_duration > 10 && l.lap_duration < 200);

    if (!valid1.length || !valid2.length) return null;

    // Average sector times (trimmed mean — remove top/bottom 10%)
    const trimmedMean = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const trim = Math.max(1, Math.floor(sorted.length * 0.1));
      const trimmed = sorted.slice(trim, -trim);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    };

    const avg = (laps, sector) => trimmedMean(laps.map(l => l[sector]));

    const s1_d1 = avg(valid1, 'duration_sector_1');
    const s2_d1 = avg(valid1, 'duration_sector_2');
    const s3_d1 = avg(valid1, 'duration_sector_3');
    const s1_d2 = avg(valid2, 'duration_sector_1');
    const s2_d2 = avg(valid2, 'duration_sector_2');
    const s3_d2 = avg(valid2, 'duration_sector_3');

    const sectors = [
      { sector: 'S1', d1: s1_d1, d2: s1_d2, delta: s1_d2 - s1_d1 },
      { sector: 'S2', d1: s2_d1, d2: s2_d2, delta: s2_d2 - s2_d1 },
      { sector: 'S3', d1: s3_d1, d2: s3_d2, delta: s3_d2 - s3_d1 },
    ];

    const totalDelta = sectors.reduce((a, s) => a + s.delta, 0);

    // Best sector times
    const bestS1_d1 = Math.min(...valid1.map(l => l.duration_sector_1));
    const bestS2_d1 = Math.min(...valid1.map(l => l.duration_sector_2));
    const bestS3_d1 = Math.min(...valid1.map(l => l.duration_sector_3));
    const bestS1_d2 = Math.min(...valid2.map(l => l.duration_sector_1));
    const bestS2_d2 = Math.min(...valid2.map(l => l.duration_sector_2));
    const bestS3_d2 = Math.min(...valid2.map(l => l.duration_sector_3));

    const bestSectors = [
      { sector: 'S1', d1: bestS1_d1, d2: bestS1_d2, delta: bestS1_d2 - bestS1_d1 },
      { sector: 'S2', d1: bestS2_d1, d2: bestS2_d2, delta: bestS2_d2 - bestS2_d1 },
      { sector: 'S3', d1: bestS3_d1, d2: bestS3_d2, delta: bestS3_d2 - bestS3_d1 },
    ];

    // Lap-by-lap delta chart (matching laps)
    const lapMap1 = {};
    valid1.forEach(l => { lapMap1[l.lap_number] = l; });
    const lapDeltas = valid2
      .filter(l => lapMap1[l.lap_number])
      .map(l => {
        const l1 = lapMap1[l.lap_number];
        return {
          lap: l.lap_number,
          s1Delta: (l.duration_sector_1 - l1.duration_sector_1),
          s2Delta: (l.duration_sector_2 - l1.duration_sector_2),
          s3Delta: (l.duration_sector_3 - l1.duration_sector_3),
        };
      });

    // Cumulative advantage
    let cumS1 = 0, cumS2 = 0, cumS3 = 0;
    const cumulativeData = lapDeltas.map(d => {
      cumS1 += d.s1Delta; cumS2 += d.s2Delta; cumS3 += d.s3Delta;
      return { lap: d.lap, s1: parseFloat(cumS1.toFixed(3)), s2: parseFloat(cumS2.toFixed(3)), s3: parseFloat(cumS3.toFixed(3)), total: parseFloat((cumS1 + cumS2 + cumS3).toFixed(3)) };
    });

    return { sectors, totalDelta, bestSectors, lapDeltas, cumulativeData, lapsCompared: valid1.length };
  }, [laps1, laps2]);

  const loading = sessLoad || drvLoad || lap1Load || lap2Load;
  const bothSelected = driver1 && driver2;

  return (
    <Card style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Layers size={16} color="var(--accent)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          Sector-Level Driver Comparison
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 8px', background: 'var(--surface-hover)', borderRadius: 4 }}>
          OpenF1 Data · 2023+
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 16 }}>
        Compare two drivers sector by sector — see exactly where time is gained or lost
      </p>

      {/* Selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 4, display: 'block' }}>YEAR</label>
          <select value={year} onChange={e => { setYear(parseInt(e.target.value)); setSessionKey(null); setDriver1(null); setDriver2(null); }}
            style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12 }}>
            {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 4, display: 'block' }}>RACE</label>
          <select value={sessionKey || ''} onChange={e => { setSessionKey(e.target.value); setDriver1(null); setDriver2(null); }}
            style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12 }}>
            <option value="">Select race...</option>
            {sessionOpts.map(s => (
              <option key={s.session_key} value={s.session_key}>{formatSessionLabel(s)}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, color: color1, fontWeight: 600, letterSpacing: '1px', marginBottom: 4, display: 'block' }}>DRIVER 1</label>
          <select value={driver1 || ''} onChange={e => setDriver1(parseInt(e.target.value))}
            disabled={!sessionKey}
            style={{ width: '100%', background: 'var(--input-bg)', border: `1px solid ${color1}44`, borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12 }}>
            <option value="">Select...</option>
            {uniqueDrivers.filter(d => d.driver_number !== driver2).map(d => (
              <option key={d.driver_number} value={d.driver_number}>
                {getFlag(d.country_code)} #{d.driver_number} {d.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, color: color2, fontWeight: 600, letterSpacing: '1px', marginBottom: 4, display: 'block' }}>DRIVER 2</label>
          <select value={driver2 || ''} onChange={e => setDriver2(parseInt(e.target.value))}
            disabled={!sessionKey}
            style={{ width: '100%', background: 'var(--input-bg)', border: `1px solid ${color2}44`, borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12 }}>
            <option value="">Select...</option>
            {uniqueDrivers.filter(d => d.driver_number !== driver1).map(d => (
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
          <span style={{ fontSize: 12 }}>Loading sector data...</span>
        </div>
      )}

      {sectorData && bothSelected && (
        <>
          {/* Sector Summary Bars */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Average Sector Times — {d1Info?.name_acronym || `#${driver1}`} vs {d2Info?.name_acronym || `#${driver2}`}
            </h4>
            {sectorData.sectors.map((s, i) => {
              const faster = s.delta > 0 ? 1 : s.delta < 0 ? 2 : 0;
              return (
                <div key={s.sector} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', width: 24 }}>{s.sector}</span>
                    <div style={{ flex: 1, display: 'flex', gap: 4, height: 24 }}>
                      <div style={{
                        flex: 1, background: `${color1}20`, borderRadius: '4px 0 0 4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                        border: faster === 1 ? `2px solid ${color1}` : `1px solid ${color1}33`,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: color1, fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatTime(s.d1)}
                        </span>
                      </div>
                      <div style={{
                        flex: 1, background: `${color2}20`, borderRadius: '0 4px 4px 0',
                        display: 'flex', alignItems: 'center', paddingLeft: 8,
                        border: faster === 2 ? `2px solid ${color2}` : `1px solid ${color2}33`,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: color2, fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatTime(s.d2)}
                        </span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, width: 70, textAlign: 'right',
                      color: s.delta > 0 ? color1 : s.delta < 0 ? color2 : 'var(--text-muted)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {s.delta > 0 ? `D1 ${(-s.delta * 1000).toFixed(0)}ms` : s.delta < 0 ? `D2 ${(s.delta * 1000).toFixed(0)}ms` : 'EQUAL'}
                    </span>
                  </div>
                </div>
              );
            })}
            {/* Total */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 6, marginTop: 8,
              background: sectorData.totalDelta > 0 ? `${color1}10` : `${color2}10`,
              border: `1px solid ${sectorData.totalDelta > 0 ? `${color1}30` : `${color2}30`}`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                Total Average Advantage
              </span>
              <span style={{
                fontSize: 14, fontWeight: 800,
                color: sectorData.totalDelta > 0 ? color1 : color2,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {d1Info?.name_acronym || `#${driver1}`} {sectorData.totalDelta > 0 ? 'faster' : 'slower'} by {Math.abs(sectorData.totalDelta * 1000).toFixed(0)}ms/lap
              </span>
            </div>
          </div>

          {/* Cumulative Sector Advantage Chart */}
          {sectorData.cumulativeData.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Cumulative Sector Advantage Over Race
              </h4>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                Positive = {d2Info?.name_acronym || `#${driver2}`} slower (D1 advantage) · Negative = {d1Info?.name_acronym || `#${driver1}`} slower (D2 advantage)
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sectorData.cumulativeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                  <XAxis dataKey="lap" stroke="var(--text-soft)" fontSize={10} />
                  <YAxis stroke="var(--text-soft)" fontSize={10} tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                    labelFormatter={l => `After Lap ${l}`}
                    formatter={(v, name) => {
                      const label = name === 's1' ? 'Sector 1' : name === 's2' ? 'Sector 2' : name === 's3' ? 'Sector 3' : 'Total';
                      return [`${v > 0 ? '+' : ''}${v.toFixed(3)}s`, label];
                    }}
                  />
                  <ReferenceLine y={0} stroke="var(--text-soft)" />
                  <Bar dataKey="s1" stackId="sectors" fill="#FF1E1E" opacity={0.7} name="s1" />
                  <Bar dataKey="s2" stackId="sectors" fill="#FFD700" opacity={0.7} name="s2" />
                  <Bar dataKey="s3" stackId="sectors" fill="#00FF87" opacity={0.7} name="s3" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Best Sector Comparison */}
          <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Best Sector Times
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {sectorData.bestSectors.map(s => {
              const faster = s.delta > 0 ? 1 : s.delta < 0 ? 2 : 0;
              const winColor = faster === 1 ? color1 : color2;
              return (
                <div key={s.sector} style={{
                  padding: 12, borderRadius: 8, textAlign: 'center',
                  background: 'var(--surface-hover)',
                  border: `1px solid ${winColor}30`,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{s.sector}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: color1, fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatTime(s.d1)}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d1Info?.name_acronym || `D1`}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: color2, fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatTime(s.d2)}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d2Info?.name_acronym || `D2`}</div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: winColor,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    Δ {Math.abs(s.delta * 1000).toFixed(0)}ms
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!sectorData && bothSelected && !loading && (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-soft)', fontSize: 13 }}>
          No sector data available for this combination. Try a different race.
        </div>
      )}
    </Card>
  );
}
