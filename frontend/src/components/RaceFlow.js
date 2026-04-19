import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { getSchedule, getRaceResults, getLapTimes } from '../services/jolpica';
import { getTeamColor } from '../data/constants';
import { getFlag } from '../data/flags';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, Loader, Eye, EyeOff } from 'lucide-react';

const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

/* ─── Position Flow (Bump Chart) ──────────────────────────────────────────── */
export default function RaceFlow() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [round, setRound] = useState(null);
  const [highlightDriver, setHighlightDriver] = useState(null);
  const [showTop10Only, setShowTop10Only] = useState(false);

  const { data: schedule, loading: schedLoading } = useApi(
    () => getSchedule(year), [year]
  );

  const { data: raceData, loading: resultsLoading } = useApi(
    () => round ? getRaceResults(year, round) : Promise.resolve([]),
    [year, round], !!round
  );

  const { data: lapData, loading: lapsLoading } = useApi(
    () => round ? getLapTimes(year, round) : Promise.resolve([]),
    [year, round], !!round
  );

  const race = raceData?.[0];
  const results = race?.Results;

  // Driver info from race results
  const driverInfo = useMemo(() => {
    const map = {};
    (results || []).forEach(r => {
      map[r.Driver?.driverId] = {
        code: r.Driver?.code || r.Driver?.familyName?.substring(0, 3).toUpperCase(),
        name: `${r.Driver?.givenName} ${r.Driver?.familyName}`,
        team: r.Constructor?.name,
        nationality: r.Driver?.nationality,
        grid: parseInt(r.grid) || 20,
        finalPos: parseInt(r.position) || 20,
        status: r.status,
      };
    });
    return map;
  }, [results]);

  // Build bump chart data
  const { chartData, drivers } = useMemo(() => {
    if (!lapData?.length || !Object.keys(driverInfo).length) {
      return { chartData: [], drivers: [] };
    }

    const driverIds = Object.keys(driverInfo);

    // Lap 0 = grid positions
    const gridPoint = { lap: 0 };
    driverIds.forEach(id => { gridPoint[id] = driverInfo[id].grid; });
    const points = [gridPoint];

    lapData.forEach(lap => {
      const point = { lap: parseInt(lap.number) };
      lap.Timings?.forEach(t => {
        point[t.driverId] = parseInt(t.position);
      });
      points.push(point);
    });

    return { chartData: points, drivers: driverIds };
  }, [lapData, driverInfo]);

  // Filtered drivers for top-10 mode
  const visibleDrivers = useMemo(() => {
    if (!showTop10Only) return drivers;
    return drivers.filter(id => driverInfo[id]?.finalPos <= 10);
  }, [drivers, driverInfo, showTop10Only]);

  // Overtake statistics
  const overtakeStats = useMemo(() => {
    if (chartData.length < 2) return [];
    return drivers.map(id => {
      let overtakes = 0;
      for (let i = 1; i < chartData.length; i++) {
        const prev = chartData[i - 1][id];
        const curr = chartData[i][id];
        if (prev != null && curr != null && curr < prev) {
          overtakes += (prev - curr);
        }
      }
      const info = driverInfo[id];
      return { id, overtakes, gained: info.grid - info.finalPos, ...info };
    }).sort((a, b) => b.overtakes - a.overtakes);
  }, [chartData, drivers, driverInfo]);

  const totalLaps = lapData?.length || 0;
  const loading = schedLoading || resultsLoading || lapsLoading;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const sorted = [...payload].filter(p => p.value != null).sort((a, b) => a.value - b.value);
    return (
      <div style={{
        background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)',
        borderRadius: 8, padding: '10px 14px', fontSize: 11, maxHeight: 360, overflowY: 'auto',
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          {label === 0 ? 'Starting Grid' : `Lap ${label}`}
        </div>
        {sorted.slice(0, 12).map(entry => {
          const info = driverInfo[entry.dataKey];
          if (!info) return null;
          return (
            <div key={entry.dataKey} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0',
            }}>
              <span style={{
                width: 22, fontWeight: 700, color: 'var(--text-primary)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              }}>P{entry.value}</span>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: getTeamColor(info.team), flexShrink: 0,
              }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                {getFlag(info.nationality)} {info.code}
              </span>
            </div>
          );
        })}
        {sorted.length > 12 && (
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>+{sorted.length - 12} more</div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <TrendingUp size={28} color="var(--accent)" />
          Race Position Flow
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Lap-by-lap position changes — see overtakes, pit strategy effects, and race dynamics unfold
        </p>
      </div>

      {/* Selectors */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>SEASON</label>
            <select value={year} onChange={e => { setYear(parseInt(e.target.value)); setRound(null); setHighlightDriver(null); }}
              style={{
                width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13,
              }}>
              {Array.from({ length: 6 }, (_, i) => currentYear - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 6, display: 'block' }}>RACE</label>
            <select value={round || ''} onChange={e => { setRound(e.target.value); setHighlightDriver(null); }}
              disabled={schedLoading}
              style={{
                width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13,
              }}>
              <option value="">Select a race...</option>
              {schedule?.map(r => (
                <option key={r.round} value={r.round}>R{r.round} — {r.raceName}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', padding: 20 }}>
          <Loader size={16} style={{ animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: 13 }}>Loading race data...</span>
        </div>
      )}

      {!round && !loading && (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <TrendingUp size={48} color="var(--text-soft)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Select a race to visualize position flow
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            The bump chart shows how every driver's position changed lap by lap
          </div>
        </Card>
      )}

      {chartData.length > 0 && (
        <>
          {/* Race info + podium */}
          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {race?.raceName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {race?.Circuit?.circuitName} — {race?.date} — {totalLaps} laps
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {results.slice(0, 3).map((r, i) => (
                  <span key={r.Driver?.driverId} style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: i === 0 ? 'rgba(212,168,0,0.15)' : i === 1 ? 'rgba(138,138,138,0.15)' : 'rgba(166,102,40,0.15)',
                    color: i === 0 ? '#D4A800' : i === 1 ? '#8A8A8A' : '#A66628',
                    border: `1px solid ${i === 0 ? 'rgba(212,168,0,0.35)' : i === 1 ? 'rgba(138,138,138,0.35)' : 'rgba(166,102,40,0.35)'}`,
                  }}>
                    P{i + 1} {getFlag(r.Driver?.nationality)} {r.Driver?.code || r.Driver?.familyName?.substring(0, 3).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* Bump Chart */}
          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Position Flow — Lap by Lap
              </h3>
              <button
                onClick={() => setShowTop10Only(!showTop10Only)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                  background: 'var(--surface-hover)', border: '1px solid var(--input-border)',
                  borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11,
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                {showTop10Only ? <Eye size={12} /> : <EyeOff size={12} />}
                {showTop10Only ? 'Show All' : 'Top 10 Only'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={520}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis
                  dataKey="lap" stroke="var(--text-muted)" fontSize={11}
                  tickFormatter={v => v === 0 ? 'G' : v}
                />
                <YAxis
                  reversed domain={[1, showTop10Only ? 10 : 20]}
                  ticks={showTop10Only ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 5, 10, 15, 20]}
                  stroke="var(--text-muted)" fontSize={11}
                  tickFormatter={v => `P${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={10} stroke="var(--accent)" strokeDasharray="4 4" strokeOpacity={0.3} />
                {visibleDrivers.map(driverId => {
                  const info = driverInfo[driverId];
                  const color = getTeamColor(info?.team);
                  const isHighlighted = !highlightDriver || highlightDriver === driverId;
                  return (
                    <Line
                      key={driverId} type="monotone" dataKey={driverId}
                      stroke={color}
                      strokeWidth={highlightDriver === driverId ? 3.5 : isHighlighted ? 2 : 1}
                      strokeOpacity={highlightDriver && !isHighlighted ? 0.12 : 0.85}
                      dot={false} connectNulls={false} isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Driver Legend + Overtake Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {/* Driver Legend */}
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                Drivers — Click to Highlight
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {drivers
                  .sort((a, b) => (driverInfo[a]?.finalPos || 99) - (driverInfo[b]?.finalPos || 99))
                  .map(driverId => {
                    const info = driverInfo[driverId];
                    const color = getTeamColor(info?.team);
                    const isActive = !highlightDriver || highlightDriver === driverId;
                    const gained = info.grid - info.finalPos;
                    return (
                      <div
                        key={driverId}
                        onClick={() => setHighlightDriver(highlightDriver === driverId ? null : driverId)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                          background: highlightDriver === driverId ? 'var(--surface-hover)' : 'transparent',
                          opacity: highlightDriver && !isActive ? 0.4 : 1,
                          borderLeft: `3px solid ${color}`,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', width: 24,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>P{info.finalPos}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
                          {getFlag(info.nationality)} {info.code}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 4 }}>
                          G{info.grid}→P{info.finalPos}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: gained > 0 ? '#27F4D2' : gained < 0 ? 'var(--accent)' : 'var(--text-muted)',
                          fontFamily: "'JetBrains Mono', monospace", width: 28, textAlign: 'right',
                        }}>
                          {gained > 0 ? `+${gained}` : gained === 0 ? '—' : `${gained}`}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </Card>

            {/* Overtake Leaders */}
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                Overtake Statistics
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {overtakeStats.slice(0, 10).map((d, i) => {
                  const color = getTeamColor(d.team);
                  const maxOvertakes = overtakeStats[0]?.overtakes || 1;
                  return (
                    <div key={d.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', width: 20,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>{i + 1}</span>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 40 }}>
                        {getFlag(d.nationality)} {d.code}
                      </span>
                      <div style={{ flex: 1, height: 6, background: 'var(--app-bg-alt)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${(d.overtakes / maxOvertakes) * 100}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}88)`,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', width: 30, textAlign: 'right',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>{d.overtakes}</span>
                    </div>
                  );
                })}
              </div>
              {overtakeStats.length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, fontStyle: 'italic' }}>
                  Positions gained on-track (includes pit stop undercutting/overcutting)
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
