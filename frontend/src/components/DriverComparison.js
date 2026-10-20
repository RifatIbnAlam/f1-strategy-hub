import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine,
  Cell,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { getDriverStandings, getRaceResults, getSprintResults } from '../services/jolpica';
import { getTeamColor, currentConstructor, distinctColor } from '../data/constants';
import { GitCompare, Search, Loader, Trophy, Flag, Award, TrendingUp } from 'lucide-react';
import { getFlag } from '../data/flags';
import TeamBadge from './TeamBadge';

/* ─── Card Primitive ──────────────────────────────────────────────────────── */
const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--panel-bg)',
    border: '1px solid var(--panel-border)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

/* ─── Section Title ──────────────────────────────────────────────────────── */
const ChartTitle = ({ title, subtitle }) => (
  <div style={{ marginBottom: 16 }}>
    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
    {subtitle && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0' }}>{subtitle}</p>}
  </div>
);

// Jolpica marks retirements/DSQs with a non-numeric positionText (R, D, W, N…).
// Newer seasons report lapped finishers as "Lapped" rather than "+1 Lap", so
// the status string alone is not a reliable DNF signal.
const isClassified = (r) => /^\d+$/.test(r?.positionText || '');

const shortRaceName = (name) => name?.replace(' Grand Prix', '').substring(0, 10);

/* ─── Driver Selector ────────────────────────────────────────────────────── */
const DriverSelector = ({ drivers, selected, onSelect, label, color, exclude }) => (
  <div>
    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: 8, display: 'block' }}>
      {label}
    </label>
    <select
      value={selected}
      onChange={e => onSelect(e.target.value)}
      style={{
        width: '100%', background: 'var(--input-bg)', border: `1px solid ${color}44`,
        borderRadius: 8, color: 'var(--text-primary)', padding: '10px 14px', fontSize: 14,
        fontFamily: "'Inter', sans-serif", cursor: 'pointer',
      }}
    >
      <option value="">Select a driver...</option>
      {drivers.filter(d => d.Driver.driverId !== exclude).map(d => (
        <option key={d.Driver.driverId} value={d.Driver.driverId}>
          {getFlag(d.Driver.nationality)} {d.Driver.givenName} {d.Driver.familyName} — {currentConstructor(d)?.name}
        </option>
      ))}
    </select>
  </div>
);

/* ─── Stat Comparison Row ─────────────────────────────────────────────────── */
const CompStat = ({ label, val1, val2, color1, color2, icon: Icon, format = v => v, lowerIsBetter = false }) => {
  const v1 = parseFloat(val1) || 0;
  const v2 = parseFloat(val2) || 0;
  const maxVal = Math.max(v1, v2) || 1;
  const d1Wins = lowerIsBetter ? v1 <= v2 : v1 >= v2;
  const d2Wins = lowerIsBetter ? v2 <= v1 : v2 >= v1;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontSize: 16, fontWeight: 700, color: d1Wins ? color1 : 'var(--text-soft)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {format(v1)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Icon && <Icon size={13} color="var(--text-muted)" />}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {label}
          </span>
        </div>
        <span style={{
          fontSize: 16, fontWeight: 700, color: d2Wins ? color2 : 'var(--text-soft)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {format(v2)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, height: 6 }}>
        <div style={{
          flex: v1 / maxVal, background: `linear-gradient(90deg, transparent, ${color1})`,
          borderRadius: '3px 0 0 3px', transition: 'flex 0.5s ease',
        }} />
        <div style={{
          flex: v2 / maxVal, background: `linear-gradient(90deg, ${color2}, transparent)`,
          borderRadius: '0 3px 3px 0', transition: 'flex 0.5s ease',
        }} />
      </div>
    </div>
  );
};

/* ─── Result Distribution Mini-Bar ────────────────────────────────────────── */
const ResultDistribution = ({ results, driverId, color, name }) => {
  const stats = useMemo(() => {
    let wins = 0, podiums = 0, points = 0, outside = 0, dnfs = 0;
    if (!results) return { wins, podiums, points, outside, dnfs, total: 0 };
    results.forEach(race => {
      const r = race.Results?.find(r => r.Driver?.driverId === driverId);
      if (!r) return;
      const pos = parseInt(r.position, 10);
      if (!isClassified(r)) { dnfs++; return; }
      if (pos === 1) wins++;
      else if (pos <= 3) podiums++;
      else if (pos <= 10) points++;
      else outside++;
    });
    return { wins, podiums, points, outside, dnfs, total: wins + podiums + points + outside + dnfs };
  }, [results, driverId]);

  if (stats.total === 0) return null;

  const segments = [
    { key: 'wins',    count: stats.wins,    label: 'Wins',    color: '#D4A800' },
    { key: 'podiums', count: stats.podiums,  label: 'P2–P3',   color },
    { key: 'points',  count: stats.points,   label: 'P4–P10',  color: `${color}88` },
    { key: 'outside', count: stats.outside,  label: 'P11+',    color: 'var(--app-bg-alt)' },
    { key: 'dnfs',    count: stats.dnfs,     label: 'DNF',     color: 'var(--accent)' },
  ].filter(s => s.count > 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stats.total} races</span>
      </div>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', gap: 1, marginBottom: 8 }}>
        {segments.map(s => (
          <div
            key={s.key}
            style={{
              flex: s.count,
              background: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'flex 0.5s ease',
            }}
            title={`${s.label}: ${s.count}`}
          >
            {(s.count / stats.total) > 0.08 && (
              <span style={{
                fontSize: 9, fontWeight: 700,
                color: s.key === 'outside' ? 'var(--text-muted)' : '#fff',
                textShadow: s.key === 'outside' ? 'none' : '0 1px 2px rgba(0,0,0,0.4)',
              }}>
                {s.count}
              </span>
            )}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {segments.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label} ({s.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Shared Tooltip Style ────────────────────────────────────────────────── */
const tooltipStyle = {
  background: 'var(--tooltip-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: 8,
  fontSize: 12,
};

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function DriverComparison() {
  const [driver1Id, setDriver1Id] = useState('');
  const [driver2Id, setDriver2Id] = useState('');

  const currentYear = new Date().getFullYear();
  const { data: standings, loading } = useApi(() => getDriverStandings('current'), []);
  const { data: results } = useApi(() => getRaceResults(currentYear), []);
  const { data: sprints } = useApi(() => getSprintResults(currentYear), []);

  const driver1 = standings?.find(d => d.Driver.driverId === driver1Id);
  const driver2 = standings?.find(d => d.Driver.driverId === driver2Id);

  const color1 = driver1 ? getTeamColor(currentConstructor(driver1)?.constructorId) : '#e10600';
  // Teammates share a colour; switch driver 2 to a contrasting one.
  const color2 = distinctColor(driver2 ? getTeamColor(currentConstructor(driver2)?.constructorId) : '#3671C6', color1);

  const name1 = driver1?.Driver?.familyName || 'Driver 1';
  const name2 = driver2?.Driver?.familyName || 'Driver 2';

  // ── Computed data ────────────────────────────────────────────────────────

  // H2H from race results
  const h2h = useMemo(() => {
    const r = { d1: 0, d2: 0 };
    if (!results || !driver1Id || !driver2Id) return r;
    results.forEach(race => {
      const r1 = race.Results?.find(r => r.Driver?.driverId === driver1Id);
      const r2 = race.Results?.find(r => r.Driver?.driverId === driver2Id);
      if (r1 && r2) {
        if (parseInt(r1.position) < parseInt(r2.position)) r.d1++;
        else if (parseInt(r2.position) < parseInt(r1.position)) r.d2++;
      }
    });
    return r;
  }, [results, driver1Id, driver2Id]);

  // 1) Points accumulation over the season (Grand Prix + Sprint points, so the
  // final value matches the official standings)
  const pointsAccum = useMemo(() => {
    if (!results || !driver1Id || !driver2Id) return [];
    const sprintByRound = {};
    (sprints || []).forEach(s => { sprintByRound[s.round] = s.SprintResults || []; });
    const sprintPoints = (round, id) =>
      parseFloat(sprintByRound[round]?.find(r => r.Driver?.driverId === id)?.points || 0);
    let cum1 = 0, cum2 = 0;
    return results.map((race) => {
      const r1 = race.Results?.find(r => r.Driver?.driverId === driver1Id);
      const r2 = race.Results?.find(r => r.Driver?.driverId === driver2Id);
      cum1 += parseFloat(r1?.points || 0) + sprintPoints(race.round, driver1Id);
      cum2 += parseFloat(r2?.points || 0) + sprintPoints(race.round, driver2Id);
      return {
        race: shortRaceName(race.raceName),
        round: parseInt(race.round),
        [name1]: cum1,
        [name2]: cum2,
      };
    });
  }, [results, sprints, driver1Id, driver2Id, name1, name2]);

  // 2) H2H position delta per race (positive = driver2 beat driver1)
  const deltaData = useMemo(() => {
    if (!results || !driver1Id || !driver2Id) return [];
    return results.map((race) => {
      const r1 = race.Results?.find(r => r.Driver?.driverId === driver1Id);
      const r2 = race.Results?.find(r => r.Driver?.driverId === driver2Id);
      if (!r1 || !r2) return null;
      const p1 = parseInt(r1.position);
      const p2 = parseInt(r2.position);
      // Positive delta means driver1 finished higher (better)
      const delta = p2 - p1;
      return {
        race: shortRaceName(race.raceName),
        delta,
        winner: delta > 0 ? 1 : delta < 0 ? 2 : 0,
      };
    }).filter(Boolean);
  }, [results, driver1Id, driver2Id]);

  // 3) Grid vs finish. Uses the actual starting grid (after penalties), and
  // only races where the driver started from the grid and was classified, so
  // a DNF doesn't masquerade as "positions lost".
  const gridVsFinish = useMemo(() => {
    if (!results || !driver1Id || !driver2Id) return null;
    const summarise = (id) => {
      const rows = results
        .map(race => race.Results?.find(r => r.Driver?.driverId === id))
        .filter(r => r && isClassified(r) && parseInt(r.grid, 10) > 0);
      if (!rows.length) return null;
      const avg = (f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
      return {
        count: rows.length,
        avgGrid: +avg(r => parseInt(r.grid, 10)).toFixed(1),
        avgFinish: +avg(r => parseInt(r.position, 10)).toFixed(1),
      };
    };
    const s1 = summarise(driver1Id);
    const s2 = summarise(driver2Id);
    if (!s1 && !s2) return null;
    return [
      s1 && { name: name1, color: color1, ...s1 },
      s2 && { name: name2, color: color2, ...s2 },
    ].filter(Boolean);
  }, [results, driver1Id, driver2Id, name1, name2, color1, color2]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <GitCompare size={28} color="var(--accent)" />
          Driver Comparison
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Head-to-head analysis with live {currentYear} championship data
        </p>
      </div>

      {/* Driver Selectors */}
      <Card style={{ marginBottom: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
            <Loader size={16} style={{ animation: 'pulse 1s infinite' }} /> Loading drivers...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 24, alignItems: 'end' }}>
            <DriverSelector drivers={standings || []} selected={driver1Id} onSelect={setDriver1Id} label="DRIVER 1" color={color1} exclude={driver2Id} />
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: 'var(--accent-soft)', border: '2px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)', fontSize: 14, fontWeight: 800,
            }}>
              VS
            </div>
            <DriverSelector drivers={standings || []} selected={driver2Id} onSelect={setDriver2Id} label="DRIVER 2" color={color2} exclude={driver1Id} />
          </div>
        )}
      </Card>

      {/* Comparison Content */}
      {driver1 && driver2 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 24 }}>

          {/* ── Stats Card ─────────────────────────────────────────────────── */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: color1 }}>
                  <span style={{ marginRight: 6 }}>{getFlag(driver1.Driver.nationality)}</span>
                  {driver1.Driver.givenName} {driver1.Driver.familyName}
                </div>
                <div style={{ marginTop: 4 }}><TeamBadge team={currentConstructor(driver1)?.name} size="md" /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: color2 }}>
                  {driver2.Driver.givenName} {driver2.Driver.familyName}
                  <span style={{ marginLeft: 6 }}>{getFlag(driver2.Driver.nationality)}</span>
                </div>
                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}><TeamBadge team={currentConstructor(driver2)?.name} size="md" /></div>
              </div>
            </div>

            <CompStat label="Points" val1={driver1.points} val2={driver2.points} color1={color1} color2={color2} icon={TrendingUp} />
            <CompStat label="Wins" val1={driver1.wins} val2={driver2.wins} color1={color1} color2={color2} icon={Trophy} />
            <CompStat label="Championship Pos" val1={driver1.position} val2={driver2.position} color1={color1} color2={color2} icon={Award}
              format={v => `P${v}`} lowerIsBetter />
            <CompStat label="Head to Head" val1={h2h.d1} val2={h2h.d2} color1={color1} color2={color2} icon={Flag}
              format={v => `${v} races`} />
          </Card>

          {/* ── Result Distribution ────────────────────────────────────────── */}
          <Card>
            <ChartTitle title="Result Distribution" subtitle="Wins, podiums, points finishes, and DNFs" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <ResultDistribution results={results} driverId={driver1Id} color={color1} name={name1} />
              <div style={{ height: 1, background: 'var(--panel-border)' }} />
              <ResultDistribution results={results} driverId={driver2Id} color={color2} name={name2} />
            </div>
          </Card>

          {/* ── Points Accumulation ────────────────────────────────────────── */}
          <Card style={{ gridColumn: '1 / -1' }}>
            <ChartTitle title="Championship Points Progression" subtitle="Cumulative points over the season — reveals momentum, turning points, and consistency" />
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pointsAccum} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="race" stroke="var(--text-muted)" fontSize={10} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `${v} pts`} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={l => l} formatter={(v, n) => [`${v} pts`, n]} />
                <Line type="monotone" dataKey={name1} stroke={color1} strokeWidth={2.5} dot={{ r: 3, fill: color1 }} />
                <Line type="monotone" dataKey={name2} stroke={color2} strokeWidth={2.5} dot={{ r: 3, fill: color2 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* ── Head-to-Head Race Delta ────────────────────────────────────── */}
          <Card style={{ gridColumn: '1 / -1' }}>
            <ChartTitle
              title="Race-by-Race Position Delta"
              subtitle={`Bars above the line = ${name1} finished ahead · Below = ${name2} finished ahead`}
            />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deltaData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="race" stroke="var(--text-muted)" fontSize={10} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="var(--text-muted)" fontSize={11}
                  tickFormatter={v => v > 0 ? `+${v}` : `${v}`}
                  label={{ value: 'Position delta', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={l => l}
                  formatter={(v) => {
                    const abs = Math.abs(v);
                    const who = v > 0 ? name1 : name2;
                    return [`${who} ahead by ${abs} position${abs !== 1 ? 's' : ''}`, 'Delta'];
                  }}
                />
                <ReferenceLine y={0} stroke="var(--text-secondary)" strokeDasharray="3 3" />
                <Bar dataKey="delta" radius={[4, 4, 4, 4]}>
                  {deltaData.map((entry, i) => (
                    <Cell key={i} fill={entry.delta > 0 ? color1 : entry.delta < 0 ? color2 : 'var(--text-soft)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* ── Qualifying vs Race ─────────────────────────────────────────── */}
          {gridVsFinish && (
            <Card style={{ gridColumn: '1 / -1' }}>
              <ChartTitle title="Grid vs Finish" subtitle="Average starting grid slot vs average finishing position in classified races. Who gains on Sunday?" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 24 }}>
                {gridVsFinish.map((d) => {
                  const gained = d.avgFinish < d.avgGrid;
                  const delta = (d.avgGrid - d.avgFinish).toFixed(1);
                  return (
                    <div key={d.name} style={{
                      padding: 16, borderRadius: 10,
                      background: 'var(--app-bg-alt)', border: `1px solid ${d.color}30`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: d.color }}>{d.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.count} classified races</span>
                      </div>

                      {/* Avg positions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Avg Grid</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                            P{d.avgGrid}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22, color: 'var(--text-secondary)', fontWeight: 300,
                        }}>
                          →
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Avg Finish</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                            P{d.avgFinish}
                          </div>
                        </div>
                      </div>

                      {/* Gain/loss badge */}
                      <div style={{
                        padding: '6px 12px', borderRadius: 8, textAlign: 'center',
                        background: gained ? 'rgba(0, 200, 83, 0.1)' : 'rgba(225, 6, 0, 0.1)',
                        border: `1px solid ${gained ? 'rgba(0, 200, 83, 0.25)' : 'rgba(225, 6, 0, 0.25)'}`,
                      }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: gained ? '#00C853' : 'var(--accent)',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {gained ? '↑' : '↓'} {Math.abs(delta)} positions {gained ? 'gained' : 'lost'} on average
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

        </div>
      ) : (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <Search size={48} color="var(--text-soft)" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600 }}>Select two drivers to compare</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Choose from the current championship standings above
          </div>
        </Card>
      )}
    </div>
  );
}
