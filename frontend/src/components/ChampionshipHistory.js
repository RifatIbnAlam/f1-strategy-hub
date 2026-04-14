import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Trophy, Crown, Users, Star, Flag, Calendar } from 'lucide-react';
import { CONSTRUCTOR_CHAMPIONS, DRIVER_CHAMPIONS } from '../data/championshipHistory';

const Card = ({ children, style }) => (
  <div style={{
    background: 'linear-gradient(135deg, #13132b 0%, #1a1a2e 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 24,
    ...style,
  }}>{children}</div>
);

const SummaryCard = ({ icon: Icon, label, value, sub, color }) => (
  <Card style={{ padding: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 42,
        height: 42,
        borderRadius: 10,
        background: `${color}20`,
        border: `1px solid ${color}33`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ color: '#777', fontSize: 11, letterSpacing: '0.7px', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{value}</div>
        {sub && <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  </Card>
);

const PIE_COLORS = ['#e10600', '#3671C6', '#FF8000', '#27F4D2', '#358C75', '#FF87BC', '#1868DB', '#FFD700', '#B6BABD', '#52E252'];

function buildTitleCounts(champions) {
  const counts = champions.reduce((acc, item) => {
    acc[item.champion] = (acc[item.champion] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function buildNationalityCounts(champions) {
  const counts = champions.reduce((acc, item) => {
    acc[item.nationality] = (acc[item.nationality] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function buildDecadeCounts(champions) {
  const counts = champions.reduce((acc, item) => {
    const decade = `${Math.floor(item.year / 10) * 10}s`;
    acc[decade] = (acc[decade] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade.localeCompare(b.decade));
}

function TimelineList({ items, accentColor, secondaryKey }) {
  return (
    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
      {items.map((item) => (
        <div key={item.year} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 0',
          borderBottom: '1px solid #1a1a2e',
        }}>
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: accentColor,
            width: 48,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {item.year}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{item.champion}</div>
            <div style={{ fontSize: 11, color: '#777' }}>{item[secondaryKey]}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChampionshipHistory() {
  const [activeTab, setActiveTab] = useState('drivers');

  const driverData = useMemo(() => ({
    champions: DRIVER_CHAMPIONS,
    titleCounts: buildTitleCounts(DRIVER_CHAMPIONS).slice(0, 15),
    nationalityCounts: buildNationalityCounts(DRIVER_CHAMPIONS),
    decadeCounts: buildDecadeCounts(DRIVER_CHAMPIONS),
  }), []);

  const constructorData = useMemo(() => ({
    champions: CONSTRUCTOR_CHAMPIONS,
    titleCounts: buildTitleCounts(CONSTRUCTOR_CHAMPIONS).slice(0, 15),
    nationalityCounts: buildNationalityCounts(CONSTRUCTOR_CHAMPIONS),
    decadeCounts: buildDecadeCounts(CONSTRUCTOR_CHAMPIONS),
  }), []);

  const mostSuccessfulDriver = driverData.titleCounts[0];
  const mostSuccessfulConstructor = constructorData.titleCounts[0];
  const latestDriverChampion = driverData.champions[driverData.champions.length - 1];
  const latestConstructorChampion = constructorData.champions[constructorData.champions.length - 1];

  const renderTitleChart = (title, data, highlightColor) => (
    <Card style={{ gridColumn: 'span 2' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Star size={16} color={highlightColor} /> {title}
      </h3>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 120, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
          <XAxis type="number" stroke="#555" fontSize={11} />
          <YAxis type="category" dataKey="name" stroke="#888" fontSize={12} width={110} />
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="count" fill={highlightColor} radius={[0, 6, 6, 0]} name="Championships">
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : highlightColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );

  const renderPieChart = (title, data) => (
    <Card>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={110}
            paddingAngle={2}
            label={({ name, count }) => `${name} (${count})`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );

  const renderDecadeChart = (title, data, color) => (
    <Card>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="decade" stroke="#888" fontSize={11} />
          <YAxis stroke="#555" fontSize={11} />
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} name="Championship seasons" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Trophy size={28} color="#FFD700" />
          Championship History
        </h1>
        <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
          Complete championship history from a built-in archive for consistent, accurate results
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'drivers', label: 'Driver Championships', icon: Crown },
          { id: 'constructors', label: 'Constructor Championships', icon: Users },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 8,
            background: activeTab === tab.id ? 'rgba(225, 6, 0, 0.15)' : 'rgba(255,255,255,0.03)',
            border: activeTab === tab.id ? '1px solid rgba(225, 6, 0, 0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: activeTab === tab.id ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
          }}>
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'drivers' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
            <SummaryCard icon={Trophy} label="Driver Titles" value={driverData.champions.length} sub="Seasons included" color="#FFD700" />
            <SummaryCard icon={Crown} label="Most Successful" value={`${mostSuccessfulDriver.count} titles`} sub={mostSuccessfulDriver.name} color="#e10600" />
            <SummaryCard icon={Flag} label="Unique Champions" value={driverData.titleCounts.length} sub="Different title winners" color="#27F4D2" />
            <SummaryCard icon={Calendar} label="Latest Champion" value={latestDriverChampion.champion} sub={String(latestDriverChampion.year)} color="#FF8000" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {renderTitleChart('Most World Driver Championships', driverData.titleCounts, '#e10600')}
            {renderPieChart('Driver Titles by Nationality', driverData.nationalityCounts)}
            {renderDecadeChart('Championship Seasons by Decade', driverData.decadeCounts, '#3671C6')}
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Recent Driver Champions</h3>
              <TimelineList items={[...driverData.champions].slice(-20).reverse()} accentColor="#e10600" secondaryKey="team" />
            </Card>
          </div>
        </>
      )}

      {activeTab === 'constructors' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
            <SummaryCard icon={Trophy} label="Constructor Titles" value={constructorData.champions.length} sub="Since 1958" color="#FFD700" />
            <SummaryCard icon={Users} label="Most Successful" value={`${mostSuccessfulConstructor.count} titles`} sub={mostSuccessfulConstructor.name} color="#27F4D2" />
            <SummaryCard icon={Flag} label="Unique Champions" value={constructorData.titleCounts.length} sub="Different title-winning teams" color="#e10600" />
            <SummaryCard icon={Calendar} label="Latest Champion" value={latestConstructorChampion.champion} sub={String(latestConstructorChampion.year)} color="#FF8000" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {renderTitleChart('Most World Constructor Championships', constructorData.titleCounts, '#27F4D2')}
            {renderPieChart('Constructor Titles by Nationality', constructorData.nationalityCounts)}
            {renderDecadeChart('Constructor Championship Seasons by Decade', constructorData.decadeCounts, '#FF8000')}
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Recent Constructor Champions</h3>
              <TimelineList items={[...constructorData.champions].slice(-20).reverse()} accentColor="#27F4D2" secondaryKey="nationality" />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
