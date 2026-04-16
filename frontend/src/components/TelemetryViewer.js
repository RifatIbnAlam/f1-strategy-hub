import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { getSessions, getDrivers, getLaps, getStints } from '../services/openf1';
import { getDriverColor } from '../data/constants';
import { TIRE_COMPOUNDS } from '../data/constants';
import { Activity, Loader, Radio, Gauge } from 'lucide-react';
import { getFlag } from '../data/flags';
import SectorAnalysis from './SectorAnalysis';

const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--panel-bg)',
    border: '1px solid var(--panel-border)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

/* ─── Lap Time Table ──────────────────────────────────────────────────────── */
const LapTimeTable = ({ laps, stints, driverColor }) => {
  if (!laps || laps.length === 0) return null;

  // Find best lap
  const validLaps = laps.filter(l => l.lap_duration && l.lap_duration > 0);
  const bestLap = validLaps.reduce((best, l) => l.lap_duration < best.lap_duration ? l : best, validLaps[0]);

  return (
    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
            {['Lap', 'Time', 'S1', 'S2', 'S3', 'Compound'].map(h => (
              <th key={h} style={{
                padding: '8px 6px', fontSize: 10, fontWeight: 600,
                color: 'var(--text-soft)', textAlign: 'left', textTransform: 'uppercase',
                letterSpacing: '0.5px', position: 'sticky', top: 0,
                background: 'var(--panel-solid)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {validLaps.map((lap, i) => {
            const isBest = lap === bestLap;
            const stint = stints?.find(s =>
              lap.lap_number >= s.lap_start && lap.lap_number <= s.lap_end
            );
            const compound = stint?.compound || 'UNKNOWN';
            const compoundColor = TIRE_COMPOUNDS[compound]?.color || '#888';

            return (
              <tr key={i} style={{
                borderBottom: '1px solid var(--app-bg-alt)',
                background: isBest ? 'rgba(147, 51, 234, 0.1)' : 'transparent',
              }}>
                <td style={{
                  padding: '6px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {lap.lap_number}
                </td>
                <td style={{
                  padding: '6px', fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: isBest ? '#a855f7' : 'var(--text-primary)',
                  fontWeight: isBest ? 700 : 400,
                }}>
                  {formatTime(lap.lap_duration)}
                  {isBest && <span style={{ marginLeft: 4, fontSize: 10, color: '#a855f7' }}>BEST</span>}
                </td>
                <td style={{ padding: '6px', fontSize: 12, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatTime(lap.duration_sector_1)}
                </td>
                <td style={{ padding: '6px', fontSize: 12, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatTime(lap.duration_sector_2)}
                </td>
                <td style={{ padding: '6px', fontSize: 12, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatTime(lap.duration_sector_3)}
                </td>
                <td style={{ padding: '6px' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    padding: '2px 6px', borderRadius: 4,
                    background: `${compoundColor}20`,
                    color: compoundColor,
                    border: `1px solid ${compoundColor}40`,
                  }}>
                    {compound}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '---';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  if (mins > 0) return `${mins}:${secs.padStart(6, '0')}`;
  return `${parseFloat(secs).toFixed(3)}`;
}

function formatSessionLabel(session) {
  const grandPrixName = session.meeting_name?.trim();
  const locationLabel = [session.location, session.country_name].filter(Boolean).join(', ');
  const sessionName = session.session_name?.trim() || session.session_type?.trim() || 'Session';
  const sessionDate = session.date_start
    ? new Date(session.date_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const eventLabel = grandPrixName || locationLabel || session.circuit_short_name || `Session ${session.session_key}`;
  const detailLabel = [sessionDate, session.circuit_short_name].filter(Boolean).join(' • ');

  return detailLabel
    ? `${eventLabel} — ${sessionName} (${detailLabel})`
    : `${eventLabel} — ${sessionName}`;
}

/* ─── Main Telemetry Viewer ───────────────────────────────────────────────── */
export default function TelemetryViewer() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);

  // Fetch sessions for the year
  const { data: sessions, loading: sessionsLoading } = useApi(
    () => getSessions(year, 'Race'),
    [year]
  );

  // Fetch drivers for selected session
  const { data: drivers, loading: driversLoading } = useApi(
    () => selectedSession ? getDrivers(selectedSession) : Promise.resolve([]),
    [selectedSession],
    !!selectedSession
  );

  // Fetch lap data
  const { data: laps, loading: lapsLoading } = useApi(
    () => (selectedSession && selectedDriver)
      ? getLaps(selectedSession, selectedDriver)
      : Promise.resolve([]),
    [selectedSession, selectedDriver],
    !!(selectedSession && selectedDriver)
  );

  // Fetch stint/tire data
  const { data: stints } = useApi(
    () => (selectedSession && selectedDriver)
      ? getStints(selectedSession, selectedDriver)
      : Promise.resolve([]),
    [selectedSession, selectedDriver],
    !!(selectedSession && selectedDriver)
  );

  const driverColor = getDriverColor(selectedDriver);

  // Build lap time chart data
  const lapChartData = useMemo(() => {
    if (!laps) return [];
    return laps
      .filter(l => l.lap_duration && l.lap_duration > 0)
      .map(l => ({
        lap: l.lap_number,
        time: parseFloat(l.lap_duration?.toFixed(3)),
        s1: parseFloat(l.duration_sector_1?.toFixed(3)) || null,
        s2: parseFloat(l.duration_sector_2?.toFixed(3)) || null,
        s3: parseFloat(l.duration_sector_3?.toFixed(3)) || null,
      }));
  }, [laps]);

  // Get unique drivers for dropdown
  const uniqueDrivers = useMemo(() => {
    if (!drivers) return [];
    const seen = new Set();
    return drivers.filter(d => {
      if (seen.has(d.driver_number)) return false;
      seen.add(d.driver_number);
      return true;
    });
  }, [drivers]);

  const sessionOptions = useMemo(() => {
    if (!sessions) return [];

    return [...sessions].sort((a, b) => {
      const aTime = a.date_start ? new Date(a.date_start).getTime() : 0;
      const bTime = b.date_start ? new Date(b.date_start).getTime() : 0;
      return bTime - aTime;
    });
  }, [sessions]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Activity size={28} color="var(--accent)" />
          Telemetry Viewer
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
          Live lap times, sector data, and tire strategies from OpenF1
        </p>
      </div>

      {/* Session Selector */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>YEAR</label>
            <select value={year} onChange={e => { setYear(parseInt(e.target.value)); setSelectedSession(null); setSelectedDriver(null); }}
              style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13 }}>
              {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>SESSION</label>
            {sessionsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-soft)', padding: 8, fontSize: 12 }}>
                <Loader size={14} style={{ animation: 'pulse 1s infinite' }} /> Loading sessions...
              </div>
            ) : (
              <select value={selectedSession || ''} onChange={e => { setSelectedSession(e.target.value); setSelectedDriver(null); }}
                style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13 }}>
                <option value="">Select a race...</option>
                {sessionOptions.map(s => (
                  <option key={s.session_key} value={s.session_key}>
                    {formatSessionLabel(s)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>DRIVER</label>
            {driversLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-soft)', padding: 8, fontSize: 12 }}>
                <Loader size={14} style={{ animation: 'pulse 1s infinite' }} /> Loading drivers...
              </div>
            ) : (
              <select value={selectedDriver || ''} onChange={e => setSelectedDriver(parseInt(e.target.value))}
                style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13 }}>
                <option value="">Select a driver...</option>
                {uniqueDrivers.map(d => (
                  <option key={d.driver_number} value={d.driver_number}>
                    {getFlag(d.country_code)} #{d.driver_number} {d.full_name} ({d.team_name})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Card>

      {/* Telemetry Content */}
      {lapsLoading ? (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <Loader size={32} color="var(--accent)" style={{ animation: 'pulse 1s infinite', marginBottom: 16 }} />
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Fetching telemetry data from OpenF1...</div>
        </Card>
      ) : laps && laps.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {/* Lap Time Chart */}
          <Card style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Lap Time Progression
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lapChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="lap" stroke="var(--text-soft)" fontSize={11} label={{ value: 'Lap', position: 'insideBottom', offset: -2, fill: 'var(--text-soft)', fontSize: 11 }} />
                <YAxis stroke="var(--text-soft)" fontSize={11} domain={['auto', 'auto']}
                  tickFormatter={v => `${v.toFixed(1)}s`} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={l => `Lap ${l}`}
                  formatter={(v) => [`${v.toFixed(3)}s`]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="time" stroke={driverColor} strokeWidth={2} dot={{ r: 2, fill: driverColor }} name="Lap Time" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Sector Times Chart */}
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Sector Times
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lapChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="lap" stroke="var(--text-soft)" fontSize={11} />
                <YAxis stroke="var(--text-soft)" fontSize={11} tickFormatter={v => `${v.toFixed(1)}s`} />
                <Tooltip contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="s1" stroke="#FF1E1E" dot={false} strokeWidth={1.5} name="Sector 1" />
                <Line type="monotone" dataKey="s2" stroke="#FFD700" dot={false} strokeWidth={1.5} name="Sector 2" />
                <Line type="monotone" dataKey="s3" stroke="#00FF87" dot={false} strokeWidth={1.5} name="Sector 3" />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Tire Strategy Visual */}
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Tire Strategy
            </h3>
            {stints && stints.length > 0 ? (
              <div>
                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 16, gap: 2 }}>
                  {stints.map((s, i) => {
                    const compound = s.compound || 'UNKNOWN';
                    const color = TIRE_COMPOUNDS[compound]?.color || '#888';
                    const width = ((s.lap_end - s.lap_start + 1) / (laps[laps.length - 1]?.lap_number || 1)) * 100;
                    return (
                      <div key={i} style={{
                        width: `${width}%`, background: color, borderRadius: i === 0 ? '6px 0 0 6px' : i === stints.length - 1 ? '0 6px 6px 0' : 0,
                        position: 'relative',
                      }}
                        title={`${compound}: Laps ${s.lap_start}-${s.lap_end}`}
                      />
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stints.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: TIRE_COMPOUNDS[s.compound]?.color || '#888',
                      }} />
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                        Stint {i + 1}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {s.compound} — Laps {s.lap_start}–{s.lap_end} ({s.lap_end - s.lap_start + 1} laps)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-soft)', fontSize: 13 }}>No stint data available</div>
            )}
          </Card>

          {/* Lap Time Table */}
          <Card style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Detailed Lap Times
            </h3>
            <LapTimeTable laps={laps} stints={stints} driverColor={driverColor} />
          </Card>
        </div>
      ) : selectedSession && selectedDriver ? (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <Radio size={48} color="var(--text-soft)" style={{ marginBottom: 16 }} />
          <div style={{ color: 'var(--text-soft)', fontSize: 14 }}>No lap data available for this selection</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Try a different session or driver</div>
        </Card>
      ) : (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <Gauge size={48} color="var(--text-soft)" style={{ marginBottom: 16 }} />
          <div style={{ color: 'var(--text-soft)', fontSize: 16, fontWeight: 600 }}>Select a session and driver</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Choose a race and driver above to view telemetry data
          </div>
        </Card>
      )}

      {/* Sector-Level Driver Comparison */}
      <div style={{ marginTop: 24 }}>
        <SectorAnalysis />
      </div>
    </div>
  );
}
