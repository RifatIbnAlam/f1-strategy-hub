import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { getDriverStandings, getConstructorStandings, getSchedule, getLastRaceResult } from '../services/jolpica';
import { getLatestSession } from '../services/openf1';
import { getTeamColor } from '../data/constants';
import { Trophy, Flag, Users, Calendar, TrendingUp, Loader, AlertCircle, Clock } from 'lucide-react';

/* ─── Shared UI Primitives ─────────────────────────────────────────────────── */
const Card = ({ children, style, glow }) => (
  <div style={{
    background: 'linear-gradient(135deg, #13132b 0%, #1a1a2e 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 24,
    animation: 'fadeIn 0.5s ease',
    ...(glow ? { boxShadow: '0 0 30px rgba(225, 6, 0, 0.08)' } : {}),
    ...style,
  }}>
    {children}
  </div>
);

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      {Icon && <Icon size={18} color="#e10600" />}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>{title}</h2>
    </div>
    {subtitle && <p style={{ fontSize: 12, color: '#666', marginLeft: Icon ? 28 : 0 }}>{subtitle}</p>}
  </div>
);

const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', padding: 20 }}>
    <Loader size={16} style={{ animation: 'pulse 1s infinite' }} />
    <span style={{ fontSize: 13 }}>Loading live data...</span>
  </div>
);

const ErrorMessage = ({ message }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e10600', padding: 16, fontSize: 13 }}>
    <AlertCircle size={16} />
    <span>{message} (API may be temporarily unavailable)</span>
  </div>
);

/* ─── Stat Card ────────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, icon: Icon, color = '#e10600', sub }) => (
  <Card style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
    <div style={{
      position: 'absolute', top: -20, right: -20,
      width: 80, height: 80, borderRadius: '50%',
      background: `radial-gradient(circle, ${color}15, transparent)`,
    }} />
    <Icon size={24} color={color} style={{ marginBottom: 8 }} />
    <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
      {value}
    </div>
    <div style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px', marginTop: 4 }}>
      {label}
    </div>
    {sub && <div style={{ fontSize: 11, color, marginTop: 4 }}>{sub}</div>}
  </Card>
);

/* ─── Standing Row ─────────────────────────────────────────────────────────── */
const StandingRow = ({ position, name, points, team, color, isFirst }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px',
    borderRadius: 8,
    background: isFirst ? 'rgba(225, 6, 0, 0.08)' : 'transparent',
    borderLeft: `3px solid ${color || '#555'}`,
    transition: 'background 0.2s ease',
    cursor: 'default',
  }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
    onMouseLeave={e => e.currentTarget.style.background = isFirst ? 'rgba(225, 6, 0, 0.08)' : 'transparent'}
  >
    <span style={{
      width: 28, height: 28, borderRadius: '50%',
      background: isFirst ? '#e10600' : '#222',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color: '#fff',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {position}
    </span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{name}</div>
      <div style={{ fontSize: 11, color: '#666' }}>{team}</div>
    </div>
    <span style={{
      fontSize: 16, fontWeight: 700, color: '#fff',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {points}
      <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>PTS</span>
    </span>
  </div>
);

/* ─── Race Calendar Item ───────────────────────────────────────────────────── */
const RaceItem = ({ race, isPast }) => {
  const date = new Date(race.date);
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 12px',
      opacity: isPast ? 0.5 : 1,
      borderRadius: 6,
    }}>
      <div style={{
        width: 44, height: 44,
        background: isPast ? '#1a1a2e' : 'rgba(225, 6, 0, 0.1)',
        borderRadius: 8,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: isPast ? '1px solid #222' : '1px solid rgba(225, 6, 0, 0.3)',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: isPast ? '#555' : '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
          {date.getDate()}
        </span>
        <span style={{ fontSize: 8, fontWeight: 600, color: isPast ? '#444' : '#e10600', letterSpacing: '1px' }}>
          {monthNames[date.getMonth()]}
        </span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isPast ? '#666' : '#fff' }}>
          {race.raceName}
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>
          {race.Circuit?.circuitName}
        </div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 4,
        background: isPast ? '#1a1a2e' : 'rgba(225, 6, 0, 0.1)',
        color: isPast ? '#555' : '#e10600',
      }}>
        R{race.round}
      </span>
    </div>
  );
};

/* ─── Dashboard Component ──────────────────────────────────────────────────── */
export default function Dashboard() {
  const currentYear = new Date().getFullYear();

  const { data: driverStandings, loading: driversLoading, error: driversError } =
    useApi(() => getDriverStandings('current'), []);

  const { data: constructorStandings, loading: constLoading } =
    useApi(() => getConstructorStandings('current'), []);

  const { data: schedule, loading: schedLoading } =
    useApi(() => getSchedule('current'), []);

  const { data: lastRace, loading: lastRaceLoading } =
    useApi(() => getLastRaceResult(), []);

  const { data: latestSession } =
    useApi(() => getLatestSession(), []);

  const today = new Date();

  const leader = driverStandings?.[0];
  const topConstructor = constructorStandings?.[0];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32, fontWeight: 900, color: '#fff',
          letterSpacing: '-1px',
          background: 'linear-gradient(90deg, #fff 0%, #e10600 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          F1 Analytics Dashboard
        </h1>
        <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
          Live data from the {currentYear} Formula 1 World Championship
        </p>
        {latestSession && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 8, padding: '4px 12px',
            background: 'rgba(225, 6, 0, 0.1)',
            borderRadius: 20,
            border: '1px solid rgba(225, 6, 0, 0.2)',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#00ff87',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 11, color: '#ccc' }}>
              Latest: {latestSession.session_name} - {latestSession.meeting_name}
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard
          icon={Trophy}
          label="Championship Leader"
          value={leader ? `${leader.Driver?.givenName?.[0]}. ${leader.Driver?.familyName}` : '...'}
          sub={leader ? `${leader.points} pts` : ''}
          color="#FFD700"
        />
        <StatCard
          icon={Users}
          label="Top Constructor"
          value={topConstructor?.Constructor?.name || '...'}
          sub={topConstructor ? `${topConstructor.points} pts` : ''}
          color="#e10600"
        />
        <StatCard
          icon={Flag}
          label="Races Complete"
          value={lastRace ? `${lastRace.round}/${schedule?.length || '?'}` : '...'}
          sub={lastRace?.raceName || ''}
          color="#27F4D2"
        />
        <StatCard
          icon={Calendar}
          label="Season"
          value={currentYear}
          sub="Formula 1 World Championship"
          color="#FF8000"
        />
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Driver Standings */}
        <Card glow>
          <SectionTitle icon={TrendingUp} title="Driver Standings" subtitle="Live championship points" />
          {driversLoading && <LoadingSpinner />}
          {driversError && <ErrorMessage message={driversError} />}
          {driverStandings && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 440, overflowY: 'auto' }}>
              {driverStandings.slice(0, 20).map((d, i) => (
                <StandingRow
                  key={d.Driver?.driverId}
                  position={i + 1}
                  name={`${d.Driver?.givenName} ${d.Driver?.familyName}`}
                  team={d.Constructors?.[0]?.name}
                  points={d.points}
                  color={getTeamColor(d.Constructors?.[0]?.name)}
                  isFirst={i === 0}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Race Calendar */}
        <Card>
          <SectionTitle icon={Calendar} title="Race Calendar" subtitle={`${currentYear} schedule`} />
          {schedLoading && <LoadingSpinner />}
          {schedule && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 440, overflowY: 'auto' }}>
              {schedule.map(race => (
                <RaceItem
                  key={race.round}
                  race={race}
                  isPast={new Date(race.date) < today}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Constructor Standings */}
        <Card>
          <SectionTitle icon={Users} title="Constructor Standings" subtitle="Team championship" />
          {constLoading && <LoadingSpinner />}
          {constructorStandings && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {constructorStandings.map((c, i) => {
                const color = getTeamColor(c.Constructor?.name);
                const maxPoints = parseFloat(constructorStandings[0]?.points) || 1;
                const pct = (parseFloat(c.points) / maxPoints) * 100;
                return (
                  <div key={c.Constructor?.constructorId} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                  }}>
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: '#fff', width: 24,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
                        {c.Constructor?.name}
                      </div>
                      <div style={{
                        height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}88)`,
                          borderRadius: 2,
                          transition: 'width 1s ease',
                        }} />
                      </div>
                    </div>
                    <span style={{
                      fontSize: 15, fontWeight: 700, color: '#fff',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {c.points}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Last Race Result */}
        <Card>
          <SectionTitle icon={Flag} title="Last Race Result" subtitle={lastRace?.raceName || 'Loading...'} />
          {lastRaceLoading && <LoadingSpinner />}
          {lastRace && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {lastRace.Results?.slice(0, 10).map((r, i) => (
                <div key={r.Driver?.driverId} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: i < 3 ? 'rgba(255, 215, 0, 0.04)' : 'transparent',
                  borderLeft: `3px solid ${
                    i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#333'
                  }`,
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: '#fff', width: 24,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    P{r.position}
                  </span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                      {r.Driver?.givenName} {r.Driver?.familyName}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: '#888', fontFamily: "'JetBrains Mono', monospace" }}>
                    {r.Time?.time || r.status}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#FFD700',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    +{r.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
