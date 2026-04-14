import React, { useState, useEffect } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { getDriverStandings, getRaceResults } from '../services/jolpica';
import { getTeamColor } from '../data/constants';
import { GitCompare, Search, Loader, Trophy, Flag, Award, TrendingUp } from 'lucide-react';

/* ─── Card Primitive ──────────────────────────────────────────────────────── */
const Card = ({ children, style }) => (
  <div style={{
    background: 'linear-gradient(135deg, #13132b 0%, #1a1a2e 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

/* ─── Driver Selector Card ────────────────────────────────────────────────── */
const DriverSelector = ({ drivers, selected, onSelect, label, color }) => (
  <div>
    <label style={{ fontSize: 11, color: '#888', fontWeight: 600, letterSpacing: '1px', marginBottom: 8, display: 'block' }}>
      {label}
    </label>
    <select
      value={selected}
      onChange={e => onSelect(e.target.value)}
      style={{
        width: '100%', background: '#0a0a12', border: `1px solid ${color}44`,
        borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14,
        fontFamily: "'Inter', sans-serif", cursor: 'pointer',
      }}
    >
      <option value="">Select a driver...</option>
      {drivers.map(d => (
        <option key={d.Driver.driverId} value={d.Driver.driverId}>
          {d.Driver.givenName} {d.Driver.familyName} — {d.Constructors?.[0]?.name}
        </option>
      ))}
    </select>
  </div>
);

/* ─── Stat Comparison Row ─────────────────────────────────────────────────── */
const CompStat = ({ label, val1, val2, color1, color2, icon: Icon, format = v => v }) => {
  const v1 = parseFloat(val1) || 0;
  const v2 = parseFloat(val2) || 0;
  const maxVal = Math.max(v1, v2) || 1;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontSize: 16, fontWeight: 700, color: v1 >= v2 ? color1 : '#555',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {format(v1)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Icon && <Icon size={13} color="#888" />}
          <span style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {label}
          </span>
        </div>
        <span style={{
          fontSize: 16, fontWeight: 700, color: v2 >= v1 ? color2 : '#555',
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

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function DriverComparison() {
  const [driver1Id, setDriver1Id] = useState('');
  const [driver2Id, setDriver2Id] = useState('');

  const { data: standings, loading } = useApi(() => getDriverStandings('current'), []);
  const { data: results } = useApi(() => getRaceResults(new Date().getFullYear()), []);

  const driver1 = standings?.find(d => d.Driver.driverId === driver1Id);
  const driver2 = standings?.find(d => d.Driver.driverId === driver2Id);

  const color1 = driver1 ? getTeamColor(driver1.Constructors?.[0]?.name) : '#e10600';
  const color2 = driver2 ? getTeamColor(driver2.Constructors?.[0]?.name) : '#3671C6';

  // Calculate H2H from race results
  const h2h = { d1: 0, d2: 0 };
  if (results && driver1Id && driver2Id) {
    results.forEach(race => {
      const r1 = race.Results?.find(r => r.Driver?.driverId === driver1Id);
      const r2 = race.Results?.find(r => r.Driver?.driverId === driver2Id);
      if (r1 && r2) {
        if (parseInt(r1.position) < parseInt(r2.position)) h2h.d1++;
        else if (parseInt(r2.position) < parseInt(r1.position)) h2h.d2++;
      }
    });
  }

  // Points per race
  const pointsPerRace1 = driver1 ? (parseFloat(driver1.points) / (parseInt(driver1.wins) || 1 + (results?.length || 1))).toFixed(1) : 0;
  const pointsPerRace2 = driver2 ? (parseFloat(driver2.points) / (parseInt(driver2.wins) || 1 + (results?.length || 1))).toFixed(1) : 0;

  // Build race-by-race position chart data
  const racePositions = results?.map((race, i) => {
    const r1 = race.Results?.find(r => r.Driver?.driverId === driver1Id);
    const r2 = race.Results?.find(r => r.Driver?.driverId === driver2Id);
    return {
      race: race.raceName?.replace(' Grand Prix', '').substring(0, 8),
      [driver1?.Driver?.familyName || 'Driver 1']: r1 ? parseInt(r1.position) : null,
      [driver2?.Driver?.familyName || 'Driver 2']: r2 ? parseInt(r2.position) : null,
    };
  }) || [];

  // Radar data (simulated performance metrics based on standings position)
  const radarData = driver1 && driver2 ? [
    { metric: 'Points', d1: parseFloat(driver1.points), d2: parseFloat(driver2.points) },
    { metric: 'Wins', d1: parseInt(driver1.wins) * 20, d2: parseInt(driver2.wins) * 20 },
    { metric: 'Consistency', d1: Math.max(0, 100 - parseInt(driver1.position) * 5), d2: Math.max(0, 100 - parseInt(driver2.position) * 5) },
    { metric: 'H2H', d1: h2h.d1 * 10, d2: h2h.d2 * 10 },
    { metric: 'Position', d1: Math.max(0, (21 - parseInt(driver1.position)) * 5), d2: Math.max(0, (21 - parseInt(driver2.position)) * 5) },
  ] : [];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <GitCompare size={28} color="#e10600" />
          Driver Comparison
        </h1>
        <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
          Head-to-head analysis with live championship data
        </p>
      </div>

      {/* Driver Selectors */}
      <Card style={{ marginBottom: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888' }}>
            <Loader size={16} style={{ animation: 'pulse 1s infinite' }} /> Loading drivers...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'end' }}>
            <DriverSelector
              drivers={standings || []}
              selected={driver1Id}
              onSelect={setDriver1Id}
              label="DRIVER 1"
              color={color1}
            />
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: 'rgba(225, 6, 0, 0.1)',
              border: '2px solid rgba(225, 6, 0, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#e10600', fontSize: 14, fontWeight: 800,
            }}>
              VS
            </div>
            <DriverSelector
              drivers={standings || []}
              selected={driver2Id}
              onSelect={setDriver2Id}
              label="DRIVER 2"
              color={color2}
            />
          </div>
        )}
      </Card>

      {/* Comparison Content */}
      {driver1 && driver2 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Stats Comparison */}
          <Card>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginBottom: 24,
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: color1 }}>
                  {driver1.Driver.givenName} {driver1.Driver.familyName}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>{driver1.Constructors?.[0]?.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: color2 }}>
                  {driver2.Driver.givenName} {driver2.Driver.familyName}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>{driver2.Constructors?.[0]?.name}</div>
              </div>
            </div>

            <CompStat label="Points" val1={driver1.points} val2={driver2.points} color1={color1} color2={color2} icon={TrendingUp} />
            <CompStat label="Wins" val1={driver1.wins} val2={driver2.wins} color1={color1} color2={color2} icon={Trophy} />
            <CompStat label="Championship Pos" val1={driver1.position} val2={driver2.position} color1={color1} color2={color2} icon={Award}
              format={v => `P${v}`} />
            <CompStat label="Head to Head" val1={h2h.d1} val2={h2h.d2} color1={color1} color2={color2} icon={Flag}
              format={v => `${v} races`} />
          </Card>

          {/* Radar Chart */}
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              Performance Profile
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#222" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#888', fontSize: 11 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name={driver1.Driver.familyName} dataKey="d1"
                  stroke={color1} fill={color1} fillOpacity={0.2} strokeWidth={2} />
                <Radar name={driver2.Driver.familyName} dataKey="d2"
                  stroke={color2} fill={color2} fillOpacity={0.2} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>

          {/* Race by Race Positions */}
          <Card style={{ gridColumn: 'span 2' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              Race-by-Race Finishing Positions
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={racePositions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="race" stroke="#555" fontSize={10} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#555" fontSize={11} reversed domain={[1, 20]} label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: '#555', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey={driver1.Driver.familyName} fill={color1} radius={[4, 4, 0, 0]} />
                <Bar dataKey={driver2.Driver.familyName} fill={color2} radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      ) : (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <Search size={48} color="#333" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 16, color: '#555', fontWeight: 600 }}>Select two drivers to compare</div>
          <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>
            Choose from the current championship standings above
          </div>
        </Card>
      )}
    </div>
  );
}
