import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { getSessions, getRaceControl } from '../services/openf1';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { ShieldAlert, Loader, Flag, AlertTriangle } from 'lucide-react';

const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

/* ─── Safety Car Probability Model ────────────────────────────────────────── */
export default function SafetyCarModel() {
  const [selectedCircuit, setSelectedCircuit] = useState(null);

  // Fetch Race sessions for multiple years to build the model
  const { data: sessions2024, loading: l24 } = useApi(() => getSessions(2024, 'Race'), []);
  const { data: sessions2023, loading: l23 } = useApi(() => getSessions(2023, 'Race'), []);

  // Build session list
  const allSessions = useMemo(() => {
    const s = [...(sessions2024 || []), ...(sessions2023 || [])];
    return s.filter(sess => sess.session_key);
  }, [sessions2024, sessions2023]);

  // Fetch race control for all sessions (batch)
  const { data: allRaceControl, loading: rcLoading } = useApi(
    async () => {
      if (!allSessions.length) return [];
      // Fetch race control for each session
      const results = await Promise.allSettled(
        allSessions.map(async (sess) => {
          try {
            const rc = await getRaceControl(sess.session_key);
            return { session: sess, events: rc || [] };
          } catch {
            return { session: sess, events: [] };
          }
        })
      );
      return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
    },
    [allSessions.length],
    allSessions.length > 0
  );

  // ── Analysis ──
  const model = useMemo(() => {
    if (!allRaceControl?.length) return null;

    const circuitData = {};
    let totalRaces = 0;
    let racesWithSC = 0;
    let racesWithVSC = 0;
    let racesWithRedFlag = 0;
    let totalSCDeployments = 0;
    let totalVSCDeployments = 0;

    // SC deployment lap distribution (aggregate)
    const scLapCounts = {}; // lap_bucket → count

    for (const { session, events } of allRaceControl) {
      if (!events.length) continue;
      totalRaces++;

      const circuitName = session.circuit_short_name || session.meeting_name || 'Unknown';
      if (!circuitData[circuitName]) {
        circuitData[circuitName] = {
          name: circuitName,
          fullName: session.meeting_name || circuitName,
          races: 0, scCount: 0, vscCount: 0, redFlagCount: 0,
          scLaps: [],
        };
      }
      circuitData[circuitName].races++;

      let hasSC = false;
      let hasVSC = false;
      let hasRedFlag = false;

      for (const evt of events) {
        const msg = (evt.message || '').toUpperCase();
        const cat = (evt.category || '').toUpperCase();

        // Detect Safety Car
        if (
          (cat === 'SAFETYCAR' && msg.includes('DEPLOYED')) ||
          (msg.includes('SAFETY CAR') && msg.includes('DEPLOYED') && !msg.includes('VIRTUAL'))
        ) {
          hasSC = true;
          totalSCDeployments++;
          circuitData[circuitName].scCount++;

          // Try to get the lap number
          const lapMatch = evt.lap_number;
          if (lapMatch) {
            circuitData[circuitName].scLaps.push(lapMatch);
            const bucket = Math.floor((lapMatch - 1) / 5) * 5 + 1; // 5-lap buckets
            scLapCounts[bucket] = (scLapCounts[bucket] || 0) + 1;
          }
        }

        // Detect VSC
        if (
          msg.includes('VIRTUAL SAFETY CAR') && msg.includes('DEPLOYED')
        ) {
          hasVSC = true;
          totalVSCDeployments++;
          circuitData[circuitName].vscCount++;
        }

        // Detect Red Flag
        if (cat === 'FLAG' && msg.includes('RED FLAG')) {
          hasRedFlag = true;
          circuitData[circuitName].redFlagCount++;
        }
      }

      if (hasSC) racesWithSC++;
      if (hasVSC) racesWithVSC++;
      if (hasRedFlag) racesWithRedFlag++;
    }

    // Build per-circuit probability table
    const circuits = Object.values(circuitData)
      .map(c => ({
        ...c,
        scProb: c.races > 0 ? (c.scCount / c.races) : 0,
        vscProb: c.races > 0 ? (c.vscCount / c.races) : 0,
        anyInterruptionProb: c.races > 0 ? (Math.min(c.scCount + c.vscCount, c.races) / c.races) : 0,
      }))
      .sort((a, b) => b.scProb - a.scProb);

    // Build SC lap distribution chart data
    const maxBucket = Math.max(...Object.keys(scLapCounts).map(Number), 60);
    const lapDistribution = [];
    for (let b = 1; b <= maxBucket; b += 5) {
      lapDistribution.push({
        label: `L${b}-${b + 4}`,
        bucket: b,
        count: scLapCounts[b] || 0,
      });
    }

    // Cumulative probability: chance of at least one SC by lap X
    const totalSCEvents = Object.values(scLapCounts).reduce((a, b) => a + b, 0);
    let cumCount = 0;
    const cumulativeProb = lapDistribution.map(d => {
      cumCount += d.count;
      return {
        ...d,
        cumProb: totalSCEvents > 0 ? parseFloat((cumCount / totalRaces * 100).toFixed(1)) : 0,
      };
    });

    return {
      totalRaces,
      racesWithSC,
      racesWithVSC,
      racesWithRedFlag,
      totalSCDeployments,
      totalVSCDeployments,
      scProbOverall: totalRaces > 0 ? racesWithSC / totalRaces : 0,
      vscProbOverall: totalRaces > 0 ? racesWithVSC / totalRaces : 0,
      circuits,
      lapDistribution,
      cumulativeProb,
    };
  }, [allRaceControl]);

  const loading = l24 || l23 || rcLoading;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <ShieldAlert size={28} color="var(--accent)" />
          Safety Car Probability Model
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
          Historical safety car deployment analysis — per-circuit probabilities and lap distribution
        </p>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginTop: 8, padding: '4px 12px',
          background: 'var(--surface-hover)', borderRadius: 20,
          border: '1px solid var(--panel-border)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Model built from OpenF1 race control data · 2023–2024 seasons
          </span>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', padding: 20 }}>
          <Loader size={16} style={{ animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: 13 }}>Building probability model from {allSessions.length} race sessions...</span>
        </div>
      )}

      {model && (
        <>
          {/* Headline Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Races Analyzed', value: model.totalRaces, color: 'var(--text-primary)' },
              { label: 'SC Probability', value: `${(model.scProbOverall * 100).toFixed(0)}%`, color: '#FFD700' },
              { label: 'VSC Probability', value: `${(model.vscProbOverall * 100).toFixed(0)}%`, color: '#FF8000' },
              { label: 'SC Deployments', value: model.totalSCDeployments, color: 'var(--accent)' },
              { label: 'Red Flags', value: model.racesWithRedFlag, color: '#FF3333' },
            ].map(stat => (
              <Card key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 28, fontWeight: 800, color: stat.color,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginTop: 4 }}>
                  {stat.label}
                </div>
              </Card>
            ))}
          </div>

          {/* Cumulative SC Probability by Lap */}
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Cumulative Safety Car Probability by Race Lap
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              Chance of at least one SC deployment by a given lap (all circuits combined)
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={model.cumulativeProb} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="label" stroke="var(--text-soft)" fontSize={10} interval={1} />
                <YAxis stroke="var(--text-soft)" fontSize={10} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v) => [`${v}%`, 'Cumulative SC probability']}
                />
                <Area type="monotone" dataKey="cumProb" stroke="#FFD700" fill="#FFD70020" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* SC Deployment Lap Distribution */}
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Safety Car Deployment — Lap Distribution
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              When do safety cars tend to happen? (5-lap buckets)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={model.lapDistribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                <XAxis dataKey="label" stroke="var(--text-soft)" fontSize={10} interval={1} />
                <YAxis stroke="var(--text-soft)" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v) => [v, 'SC deployments']}
                />
                <Bar dataKey="count" fill="#FFD700" radius={[3, 3, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Per-Circuit Probability Table */}
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Per-Circuit Safety Car Probability
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {model.circuits.map((c, i) => {
                const scPct = (c.scProb * 100).toFixed(0);
                const vscPct = (c.vscProb * 100).toFixed(0);
                return (
                  <div
                    key={c.name}
                    onClick={() => setSelectedCircuit(selectedCircuit === c.name ? null : c.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      background: selectedCircuit === c.name ? 'var(--accent-soft)' : 'var(--surface-hover)',
                      border: selectedCircuit === c.name ? '1px solid var(--accent-border)' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', width: 20,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                      {c.fullName}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.races} races</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {/* SC bar */}
                      <div style={{ width: 80, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--app-bg-alt)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${scPct}%`,
                            background: '#FFD700',
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: '#FFD700', width: 32, textAlign: 'right',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>{scPct}%</span>
                      </div>
                      {/* VSC indicator */}
                      <span style={{
                        fontSize: 10, color: '#FF8000', fontWeight: 600, width: 40, textAlign: 'right',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {vscPct}% V
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 10, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FFD700' }} /> SC %
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FF8000' }} /> VSC %
              </span>
            </div>
          </Card>

          {/* Strategic Insight */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Flag size={16} color="var(--accent)" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Strategic Implications
              </h3>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {model.scProbOverall > 0.5 ? (
                <p>
                  With a <strong style={{ color: '#FFD700' }}>{(model.scProbOverall * 100).toFixed(0)}%</strong> overall
                  SC probability, teams should incorporate safety car scenarios into every strategy simulation.
                  The optimal approach is to keep pit windows flexible — particularly around
                  laps {model.lapDistribution.reduce((best, d) => d.count > best.count ? d : best, { count: 0 }).label || '?'} where
                  SC deployments cluster most heavily.
                </p>
              ) : (
                <p>
                  SC probability across the analyzed period sits
                  at <strong style={{ color: '#FFD700' }}>{(model.scProbOverall * 100).toFixed(0)}%</strong>.
                  While not guaranteed, teams should still model SC scenarios in Monte Carlo
                  strategy simulations, especially at high-risk circuits.
                </p>
              )}
              <p style={{ marginTop: 8 }}>
                {model.circuits.filter(c => c.scProb >= 0.75).length > 0 && (
                  <>
                    <AlertTriangle size={12} color="#FFD700" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    <strong>High-risk circuits:</strong>{' '}
                    {model.circuits.filter(c => c.scProb >= 0.75).map(c => c.name).join(', ')}
                    {' — consider aggressive strategy gambles at these venues, as a SC will likely shuffle the field.'}
                  </>
                )}
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
