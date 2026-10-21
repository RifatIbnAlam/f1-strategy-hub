import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { Wrench, Loader, Timer, ShieldCheck, TrendingUp, Gauge, ArrowUpDown } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { getRaceResults, getSprintResults, getSeasonPitStops } from '../services/jolpica';
import { getTeamColor, distinctColor, tone } from '../data/constants';
import {
  buildPitStopRows, teamScorecard, pitTrend, headlineFindings, SLOW_STOP_THRESHOLD_S, ANOMALY_THRESHOLD_S,
} from '../models/operations';
import { toneLegend } from './chartUtils';

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const signed = (v, d = 2) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(d)}` : '—');
const pct = (v) => `${(v * 100).toFixed(0)}%`;

const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

const Headline = ({ icon: Icon, label, team, value, sub, loading }) => (
  <Card style={{ padding: 18 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Icon size={16} color="var(--accent)" />
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{label}</span>
    </div>
    {team ? (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: getTeamColor(team.teamId), flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{team.teamName}</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: tone(getTeamColor(team.teamId)), marginTop: 4, ...mono }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
      </>
    ) : (
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loading ? 'Loading pit stops…' : 'Not enough data yet'}</div>
    )}
  </Card>
);

const COLUMNS = [
  { key: 'teamName', label: 'Team', align: 'left' },
  { key: 'points', label: 'Points', fmt: v => v.toFixed(0), dir: -1 },
  { key: 'pointsPerRace', label: 'Pts/race', fmt: v => v.toFixed(1), dir: -1 },
  { key: 'dnfRate', label: 'DNF rate', fmt: pct, dir: 1, title: 'Share of starts that were not classified' },
  { key: 'avgGain', label: 'Avg gain', fmt: v => signed(v, 1), dir: -1, title: 'Average positions gained from grid to flag (classified finishes)' },
  { key: 'pitMedian', label: 'Pit Δ', fmt: v => `${signed(v)}s`, dir: 1, title: 'Median pit-lane time vs the race median' },
  { key: 'pitIQR', label: 'Spread', fmt: v => `${Number.isFinite(v) ? v.toFixed(2) : '—'}s`, dir: 1, title: 'Interquartile range of pit deltas (lower = more consistent)' },
  { key: 'slowRate', label: 'Slow stops', fmt: pct, dir: 1, title: `Stops more than ${SLOW_STOP_THRESHOLD_S}s slower than the race median` },
  { key: 'consistencyCost', label: 'Inconsistency cost', fmt: v => `${v.toFixed(1)}s`, dir: 1, title: "Total time lost against the team's own typical stop" },
];

/**
 * Season operations scorecard: pit-crew execution, reliability and race-day
 * performance per team, with circuit effects removed from pit times.
 */
export default function TeamOps() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [sort, setSort] = useState({ key: 'points', dir: -1 });
  const [hiddenTeams, setHiddenTeams] = useState(null);

  const { data: races, loading: racesLoading, error } = useApi(() => getRaceResults(year), [year]);
  const { data: sprints } = useApi(() => getSprintResults(year), [year]);
  const rounds = (races || []).map(r => r.round);
  const roundsKey = rounds.join(',');
  const { data: pitData, loading: stopsLoading } = useApi(
    () => getSeasonPitStops(year, rounds), [year, roundsKey], rounds.length > 0
  );

  const { rows, card, trend, headlines } = useMemo(() => {
    if (!races?.length) return { rows: [], card: [], trend: [], headlines: {} };
    const pitRows = buildPitStopRows(pitData?.rounds || [], races);
    const scorecard = teamScorecard(pitRows, races, sprints || []);
    return { rows: pitRows, card: scorecard, trend: pitTrend(pitRows), headlines: headlineFindings(scorecard) };
  }, [races, sprints, pitData]);

  // One line per team, but two teams can share a colour (e.g. older
  // seasons with unmapped constructors falling back to grey); keep them apart.
  const teamColors = useMemo(() => {
    const used = [];
    return Object.fromEntries(card.map(t => {
      let c = getTeamColor(t.teamId);
      used.forEach(u => { c = distinctColor(c, u, '#A855F7'); });
      used.push(c);
      return [t.teamId, c];
    }));
  }, [card]);

  const sorted = [...card].sort((a, b) => {
    const { key, dir } = sort;
    if (key === 'teamName') return dir * a.teamName.localeCompare(b.teamName);
    const av = Number.isFinite(a[key]) ? a[key] : Infinity;
    const bv = Number.isFinite(b[key]) ? b[key] : Infinity;
    return dir * (av - bv);
  });

  // Trend chart shows the top five teams by points until the viewer picks.
  const visible = hiddenTeams || new Set(card.slice(5).map(t => t.teamId));
  const toggleTeam = (id) => {
    const next = new Set(visible);
    if (next.has(id)) next.delete(id); else next.add(id);
    setHiddenTeams(next);
  };

  const pitTeams = card.filter(t => t.stops > 0).sort((a, b) => a.pitMedian - b.pitMedian);
  const range = pitTeams.length
    ? [Math.min(-1, ...pitTeams.map(t => t.pitP25)) - 0.2, Math.max(1, ...pitTeams.map(t => t.pitP75)) + 0.2]
    : [-1, 1];
  const xPct = (v) => ((v - range[0]) / (range[1] - range[0])) * 100;

  const loading = racesLoading || stopsLoading;
  const anomalies = rows.filter(r => r.anomalous).length;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Wrench size={28} color="var(--accent)" />
          Team Operations
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Season scorecard: pit-crew execution, reliability and race-day performance, with circuit effects removed from pit times
        </p>
      </div>

      <Card style={{ marginBottom: 24, padding: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px' }}>SEASON</label>
          <select value={year} onChange={e => { setYear(parseInt(e.target.value, 10)); setHiddenTeams(null); }}
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', padding: '6px 12px', fontSize: 13 }}>
            {Array.from({ length: currentYear - 2011 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {races && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {races.length} races · {rows.length} pit stops{anomalies ? ` (${anomalies} penalt${anomalies === 1 ? 'y or repair' : 'ies or repairs'} excluded)` : ''}
            </span>
          )}
          {pitData?.missing?.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--warning)' }}>
              Pit data unavailable for round{pitData.missing.length > 1 ? 's' : ''} {pitData.missing.join(', ')} (API rate limit). Pit metrics cover the remaining races.
            </span>
          )}
          {loading && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <Loader size={14} style={{ animation: 'pulse 1s infinite' }} /> Loading the season's pit stops...
            </span>
          )}
        </div>
      </Card>

      {error && <Card style={{ color: 'var(--accent-text)', fontSize: 13 }}>Couldn't load {year} results: {error}</Card>}

      {card.length > 0 && (
        <>
          {/* Headlines */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16, marginBottom: 24 }}>
            <Headline icon={Timer} label="Fastest pit crew" team={headlines.fastest}
              value={headlines.fastest && `${signed(headlines.fastest.pitMedian)}s`} sub="median stop vs race median" loading={stopsLoading} />
            <Headline icon={Gauge} label="Most consistent crew" team={headlines.consistent}
              value={headlines.consistent && `${headlines.consistent.pitIQR.toFixed(2)}s`} sub="spread between typical good and bad stops" loading={stopsLoading} />
            <Headline icon={ShieldCheck} label="Most reliable" team={headlines.reliable}
              value={headlines.reliable && pct(headlines.reliable.dnfRate)} sub="of starts not classified" />
            <Headline icon={TrendingUp} label="Best race-day gains" team={headlines.racer}
              value={headlines.racer && `${signed(headlines.racer.avgGain, 1)} pos`} sub="average, grid to flag" />
          </div>

          {headlines.costly && headlines.costly.consistencyCost > 0 && (
            <div style={{
              padding: '12px 16px', borderRadius: 10, marginBottom: 24, fontSize: 13, color: 'var(--text-secondary)',
              background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Biggest operational leak:</strong>{' '}
              {headlines.costly.teamName} lost {headlines.costly.consistencyCost.toFixed(1)}s this season to stops slower than
              their own typical stop, across {headlines.costly.stops} stops. That's {(headlines.costly.consistencyCost / Math.max(headlines.costly.races, 1)).toFixed(2)}s
              of avoidable time per race, often the gap that decides a position.
            </div>
          )}

          {/* Scorecard */}
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Scorecard</h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Click a column to sort. Hover headers for definitions.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 820 }}>
                <thead>
                  <tr>
                    {COLUMNS.map(c => (
                      <th key={c.key} title={c.title}
                        onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key ? -s.dir : (c.dir || 1) }))}
                        style={{
                          padding: '8px', textAlign: c.align || 'right', cursor: 'pointer', whiteSpace: 'nowrap',
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                          color: sort.key === c.key ? 'var(--text-primary)' : 'var(--text-muted)',
                          borderBottom: '1px solid var(--panel-border)',
                        }}>
                        {c.label}{sort.key === c.key && <ArrowUpDown size={10} style={{ marginLeft: 4, verticalAlign: 'middle' }} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(t => (
                    <tr key={t.teamId} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                      {COLUMNS.map(c => (
                        <td key={c.key} style={{ padding: '8px', textAlign: c.align || 'right', color: 'var(--text-primary)', whiteSpace: 'nowrap', ...(c.key === 'teamName' ? {} : mono) }}>
                          {c.key === 'teamName' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                              <span style={{ width: 4, height: 18, borderRadius: 2, background: teamColors[t.teamId] }} />
                              {t.teamName}
                            </span>
                          ) : (t.stops === 0 && ['pitMedian', 'pitIQR', 'slowRate', 'consistencyCost'].includes(c.key)) ? '—' : c.fmt(t[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 24, marginBottom: 24 }}>
            {/* Pit distribution */}
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Pit-crew execution</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                Each bar spans a team's middle 50% of stops; the tick is its median. Left of the line = faster than the race median.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pitTeams.map(t => (
                  <div key={t.teamId} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 140px) 1fr 56px', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.teamName}</span>
                    <div style={{ position: 'relative', height: 16, background: 'var(--surface-hover)', borderRadius: 4 }}>
                      <div style={{ position: 'absolute', left: `${xPct(0)}%`, top: -3, bottom: -3, width: 1, background: 'var(--text-muted)' }} />
                      <div style={{
                        position: 'absolute', top: 3, bottom: 3, borderRadius: 3, background: teamColors[t.teamId], opacity: 0.85,
                        left: `${xPct(t.pitP25)}%`, width: `${Math.max(xPct(t.pitP75) - xPct(t.pitP25), 0.8)}%`,
                      }} />
                      <div style={{ position: 'absolute', top: 0, bottom: 0, width: 3, borderRadius: 1, background: 'var(--text-primary)', left: `calc(${xPct(t.pitMedian)}% - 1px)` }} />
                    </div>
                    <span style={{ fontSize: 11, textAlign: 'right', color: 'var(--text-secondary)', ...mono }}>{signed(t.pitMedian)}s</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 140px) 1fr 56px', gap: 10, marginTop: 6 }}>
                <span />
                <div style={{ position: 'relative', height: 14, fontSize: 10, color: 'var(--text-muted)', ...mono }}>
                  <span style={{ position: 'absolute', left: 0 }}>{signed(range[0], 1)}s</span>
                  <span style={{ position: 'absolute', left: `${xPct(0)}%`, transform: 'translateX(-50%)' }}>0</span>
                  <span style={{ position: 'absolute', right: 0 }}>{signed(range[1], 1)}s</span>
                </div>
                <span />
              </div>
            </Card>

            {/* Trend */}
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Pit performance through the season</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Median stop vs race median, per round. Toggle teams below.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {card.map(t => (
                  <button key={t.teamId} onClick={() => toggleTeam(t.teamId)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                    background: visible.has(t.teamId) ? 'transparent' : 'var(--app-bg-alt)',
                    border: `1px solid ${visible.has(t.teamId) ? 'var(--panel-border)' : teamColors[t.teamId]}`,
                    color: visible.has(t.teamId) ? 'var(--text-soft)' : 'var(--text-primary)',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: teamColors[t.teamId], opacity: visible.has(t.teamId) ? 0.35 : 1 }} />
                    {t.teamName}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                  <XAxis dataKey="round" stroke="var(--text-muted)" fontSize={10} tickFormatter={r => `R${r}`} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                    labelFormatter={(r) => trend.find(p => p.round === r)?.raceName || `Round ${r}`}
                    formatter={(v, n) => [`${signed(Number(v))}s`, n]}
                  />
                  <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
                  <Legend formatter={toneLegend} wrapperStyle={{ fontSize: 11 }} />
                  {card.filter(t => !visible.has(t.teamId)).map(t => (
                    <Line key={t.teamId} dataKey={t.teamId} name={t.teamName} stroke={teamColors[t.teamId]} strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Methodology.</strong>{' '}
            Pit times are pit-lane times (entry to exit) from the Jolpica F1 API. Lane length differs by circuit by more than
            ten seconds, so each stop is scored as its difference from that race's median stop; this isolates crew execution
            and car release from the track. Stops more than {ANOMALY_THRESHOLD_S}s over the median (drive-through penalties,
            repairs, red-flag stops) are counted but not scored. "Inconsistency cost" sums each stop's time above the team's
            own median: what the team would have saved by repeating its typical stop every time. DNF rate is the share of
            starts not classified; race-day gain averages grid-to-flag places for classified finishes from a grid slot.
          </Card>
        </>
      )}
    </div>
  );
}
