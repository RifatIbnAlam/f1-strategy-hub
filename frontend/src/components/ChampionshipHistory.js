import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { getWorldChampions, getConstructorChampions } from '../services/jolpica';
import { Trophy, Crown, Users, Star, Loader, Calendar } from 'lucide-react';

const Card = ({ children, style }) => (
  <div style={{
    background: 'linear-gradient(135deg, #13132b 0%, #1a1a2e 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

const ERA_COLORS = {
  '1950s': '#8B4513', '1960s': '#CD853F', '1970s': '#DAA520',
  '1980s': '#B22222', '1990s': '#4169E1', '2000s': '#228B22',
  '2010s': '#9400D3', '2020s': '#e10600',
};

function getDecade(year) {
  return `${Math.floor(year / 10) * 10}s`;
}

const NATIONALITY_COLORS = {
  British: '#012169', German: '#000000', Brazilian: '#009739',
  Finnish: '#003580', Spanish: '#AA151B', French: '#002395',
  Australian: '#00843D', Argentine: '#74ACDF', Austrian: '#EF3340',
  Italian: '#009246', Dutch: '#FF6F00', South_African: '#007A4D',
  default: '#888888',
};

export default function ChampionshipHistory() {
  const [activeTab, setActiveTab] = useState('drivers');

  const { data: driverChampions, loading: driversLoading } =
    useApi(() => getWorldChampions(100), []);

  const { data: constructorChampions, loading: constLoading } =
    useApi(() => getConstructorChampions(100), []);

  // Process driver championship data
  const driverData = useMemo(() => {
    if (!driverChampions) return { champions: [], titleCounts: [], nationalityData: [], decadeData: [] };

    const champions = driverChampions.map(sl => ({
      year: parseInt(sl.season),
      driver: `${sl.DriverStandings[0]?.Driver?.givenName} ${sl.DriverStandings[0]?.Driver?.familyName}`,
      nationality: sl.DriverStandings[0]?.Driver?.nationality,
      team: sl.DriverStandings[0]?.Constructors?.[0]?.name,
      points: parseFloat(sl.DriverStandings[0]?.points),
      wins: parseInt(sl.DriverStandings[0]?.wins),
    }));

    // Count titles per driver
    const titleMap = {};
    champions.forEach(c => {
      titleMap[c.driver] = (titleMap[c.driver] || 0) + 1;
    });
    const titleCounts = Object.entries(titleMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Nationality breakdown
    const natMap = {};
    champions.forEach(c => {
      natMap[c.nationality] = (natMap[c.nationality] || 0) + 1;
    });
    const nationalityData = Object.entries(natMap)
      .map(([nationality, count]) => ({ nationality, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Titles by decade
    const decadeMap = {};
    champions.forEach(c => {
      const decade = getDecade(c.year);
      if (!decadeMap[decade]) decadeMap[decade] = {};
      decadeMap[decade][c.driver] = (decadeMap[decade][c.driver] || 0) + 1;
    });

    return { champions, titleCounts, nationalityData, decadeData: [] };
  }, [driverChampions]);

  // Process constructor data
  const constructorData = useMemo(() => {
    if (!constructorChampions) return { titleCounts: [] };

    const titleMap = {};
    constructorChampions.forEach(sl => {
      const name = sl.ConstructorStandings?.[0]?.Constructor?.name;
      if (name) titleMap[name] = (titleMap[name] || 0) + 1;
    });

    const titleCounts = Object.entries(titleMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { titleCounts };
  }, [constructorChampions]);

  const PIE_COLORS = ['#e10600', '#3671C6', '#FF8000', '#27F4D2', '#358C75', '#FF87BC', '#1868DB', '#FFD700', '#B6BABD', '#52E252'];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Trophy size={28} color="#FFD700" />
          Championship History
        </h1>
        <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
          Every World Champion from 1950 to present — powered by Jolpica F1 API
        </p>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'drivers', label: 'Driver Championships', icon: Crown },
          { id: 'constructors', label: 'Constructor Championships', icon: Users },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 8,
            background: activeTab === tab.id ? 'rgba(225, 6, 0, 0.15)' : 'rgba(255,255,255,0.03)',
            border: activeTab === tab.id ? '1px solid rgba(225, 6, 0, 0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: activeTab === tab.id ? '#fff' : '#888',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
          }}>
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {(driversLoading || constLoading) && (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <Loader size={32} color="#FFD700" style={{ animation: 'pulse 1s infinite', marginBottom: 16 }} />
          <div style={{ color: '#888' }}>Loading championship history...</div>
        </Card>
      )}

      {activeTab === 'drivers' && driverData.titleCounts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Most Titles Bar Chart */}
          <Card style={{ gridColumn: 'span 2' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={16} color="#FFD700" /> Most World Driver Championships
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={driverData.titleCounts} layout="vertical" margin={{ top: 5, right: 20, left: 120, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                <XAxis type="number" stroke="#555" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#888" fontSize={12} width={110} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#e10600" radius={[0, 6, 6, 0]} name="Championships">
                  {driverData.titleCounts.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#e10600'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Nationality Pie Chart */}
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              Championships by Nationality
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={driverData.nationalityData}
                  dataKey="count"
                  nameKey="nationality"
                  cx="50%" cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  label={({ nationality, count }) => `${nationality} (${count})`}
                >
                  {driverData.nationalityData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Champions Timeline */}
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              Recent Champions
            </h3>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {driverData.champions.slice(-20).reverse().map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 0',
                  borderBottom: '1px solid #1a1a2e',
                }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: '#e10600', width: 44,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {c.year}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{c.driver}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>{c.team}</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#FFD700', fontFamily: "'JetBrains Mono', monospace" }}>
                    {c.points} pts
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'constructors' && constructorData.titleCounts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Card style={{ gridColumn: 'span 2' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="#27F4D2" /> Constructor Championship Titles
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={constructorData.titleCounts} layout="vertical" margin={{ top: 5, right: 20, left: 120, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                <XAxis type="number" stroke="#555" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#888" fontSize={12} width={110} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Championships">
                  {constructorData.titleCounts.map((entry, i) => {
                    const colorMap = {
                      'Ferrari': '#E8002D', 'Williams': '#1868DB', 'McLaren': '#FF8000',
                      'Mercedes': '#27F4D2', 'Red Bull': '#3671C6', 'Lotus': '#FFD700',
                      'Brabham': '#006847', 'Cooper': '#8B4513', 'Renault': '#FFD700',
                    };
                    const color = Object.entries(colorMap).find(([k]) =>
                      entry.name.toLowerCase().includes(k.toLowerCase())
                    )?.[1] || PIE_COLORS[i % PIE_COLORS.length];
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  );
}
