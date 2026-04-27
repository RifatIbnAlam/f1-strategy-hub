import React, { useMemo, useState } from 'react';
import { getFlag } from './data/flags';

/* ─── Team / Constructor Color Map ────────────────────────────────────────── */
const CHAMPION_TEAM_COLORS = {
  // Driver team names
  'Alfa Romeo': '#900000', 'Ferrari': '#E8002D', 'Maserati': '#8B0000',
  'Maserati / Mercedes': '#8B0000', 'Mercedes': '#27F4D2',
  'Cooper-Climax': '#006633', 'BRM': '#004225',
  'Lotus-Climax': '#DAA520', 'Lotus-Ford': '#DAA520',
  'Brabham-Repco': '#006847', 'Matra-Ford': '#002395',
  'Tyrrell-Ford': '#003DA5', 'McLaren-Ford': '#FF8000',
  'McLaren-TAG': '#FF8000', 'McLaren-Honda': '#FF8000',
  'McLaren-Mercedes': '#FF8000', 'McLaren': '#FF8000',
  'Williams-Ford': '#1868DB', 'Williams-Honda': '#1868DB',
  'Williams-Renault': '#1868DB', 'Brabham-Ford': '#006847',
  'Brabham-BMW': '#006847', 'Renault': '#FFD700',
  'Benetton-Ford': '#00B140', 'Benetton-Renault': '#00B140',
  'Red Bull-Renault': '#3671C6', 'Red Bull-Honda': '#3671C6',
  'Red Bull Racing': '#3671C6', 'Brawn-Mercedes': '#C8F000',
  'Vanwall': '#006633',
  // Constructor championship name lookups (champion IS the team)
  'Cooper-Climax (C)': '#006633', 'Lotus-Climax (C)': '#DAA520',
  'Williams': '#1868DB', 'Tyrrell-Ford (C)': '#003DA5',
  'Lotus-Ford (C)': '#DAA520', 'Brabham-Repco (C)': '#006847',
  'McLaren-Ford (C)': '#FF8000', 'Williams-Ford (C)': '#1868DB',
  'Williams-Honda (C)': '#1868DB', 'McLaren-TAG (C)': '#FF8000',
  'McLaren-Honda (C)': '#FF8000', 'Williams-Renault (C)': '#1868DB',
  'Benetton-Renault (C)': '#00B140',
};

// Resolve a color for any champion entry (works for both drivers & constructors)
function getChampionColor(c) {
  return CHAMPION_TEAM_COLORS[c.team] || CHAMPION_TEAM_COLORS[c.champion] || '#555555';
}

/* ─── F1 Eras ─────────────────────────────────────────────────────────────── */
const F1_ERAS = [
  { id: 'pioneer',     name: 'Pioneer Era',               years: [1950, 1960], color: '#CD853F',
    description: "Front-engine cars, minimal safety, gentlemen racers. Dominated by Fangio's genius." },
  { id: 'revolution',  name: 'The Revolution',             years: [1961, 1970], color: '#DAA520',
    description: "Rear-engine revolution, aero innovation. Jim Clark's brilliance, tragic losses." },
  { id: 'garagiste',   name: 'Garagiste & Ground Effect',  years: [1971, 1982], color: '#228B22',
    description: 'British constructors dominate. Ground effect. Stewart, Lauda, and Fittipaldi shine.' },
  { id: 'turbo',       name: 'Turbo Era',                  years: [1983, 1993], color: '#9400D3',
    description: 'Turbocharged monsters. Senna vs Prost — the greatest rivalry.' },
  { id: 'schumacher',  name: 'Schumacher Era',             years: [1994, 2008], color: '#E8002D',
    description: "Michael rewrites every record. Ferrari's unstoppable dynasty." },
  { id: 'hybrid-dawn', name: 'Red Bull & Hybrid Dawn',     years: [2009, 2016], color: '#3671C6',
    description: "Vettel's four-peat, then Mercedes' hybrid dominance begins." },
  { id: 'hamilton',    name: 'Hamilton Era',               years: [2017, 2021], color: '#27F4D2',
    description: "Hamilton matches Schumacher's 7 titles. Mercedes unprecedented dominance." },
  { id: 'modern',      name: 'Ground Effect Returns',      years: [2022, 2026], color: '#FF8000',
    description: "New regulations, Verstappen's dominance, McLaren's resurgence." },
];

/* ─── Records ─────────────────────────────────────────────────────────────── */
const DRIVER_RECORDS = [
  { label: 'Most Titles',         value: '7',        holders: 'Lewis Hamilton, Michael Schumacher', icon: '🏆' },
  { label: 'Most Consecutive',    value: '4',        holders: 'Vettel (2010–13), Verstappen (2021–24)', icon: '🔥' },
  { label: 'Youngest Champion',   value: '23y 134d', holders: 'Sebastian Vettel (2010)', icon: '⚡' },
  { label: 'Oldest Champion',     value: '46y 41d',  holders: 'Juan Manuel Fangio (1957)', icon: '⏱' },
  { label: 'Closest Title Fight', value: '0 pts',    holders: '2008 — Hamilton beat Massa on countback in the final corner', icon: '🎯' },
  { label: 'Posthumous Champion', value: '1970',     holders: 'Jochen Rindt — won title after fatal crash at Monza', icon: '⭐' },
];

const CONSTRUCTOR_RECORDS = [
  { label: 'Most Titles',         value: '16',       holders: 'Ferrari (1961, 1964, 1975–77, 1979, 1982–83, 1999–2004, 2007–08)', icon: '🏆' },
  { label: 'Most Consecutive',    value: '8',        holders: 'Mercedes (2014–2021)', icon: '🔥' },
  { label: 'First Champion',      value: '1958',     holders: 'Vanwall — the first constructor title ever awarded', icon: '⭐' },
  { label: 'One-Season Wonder',   value: '2009',     holders: 'Brawn GP — won title in their only full season', icon: '⚡' },
  { label: 'Longest Streak',      value: '75 yrs',   holders: 'Ferrari — every season since 1950', icon: '📅' },
  { label: 'Latest Champion',     value: '2024–25',  holders: 'McLaren — back-to-back after 26-year drought', icon: '🎯' },
];

/* ─── Card ────────────────────────────────────────────────────────────────── */
const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--panel-bg)',
    border: '1px solid var(--panel-border)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

/* ─── Dominance Timeline ──────────────────────────────────────────────────── */
function DominanceTimeline({ champions, mode }) {
  const [hoveredYear, setHoveredYear] = useState(null);
  const [selectedChampion, setSelectedChampion] = useState(null);

  const streaks = useMemo(() => {
    const result = [];
    let current = null;
    champions.forEach((c) => {
      if (current && current.champion === c.champion) {
        current.end = c.year; current.count++;
      } else {
        if (current) result.push(current);
        current = { ...c, start: c.year, end: c.year, count: 1 };
      }
    });
    if (current) result.push(current);
    return result;
  }, [champions]);

  const hoveredData = hoveredYear ? champions.find(c => c.year === hoveredYear) : null;
  const hoveredColor = hoveredData ? getChampionColor(hoveredData) : '#555';

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {mode === 'drivers' ? 'Driver' : 'Constructor'} Dominance Timeline
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Every championship since {champions[0]?.year}. Hover to explore — dynasties form visible colour streaks.
          </p>
        </div>
        {hoveredData && (
          <div style={{
            padding: '6px 14px', borderRadius: 8,
            background: `${hoveredColor}22`,
            border: `1px solid ${hoveredColor}44`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{hoveredData.year}</span>
            <span style={{ fontSize: 14, marginLeft: 8 }}>{getFlag(hoveredData.nationality)}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>{hoveredData.champion}</span>
            {hoveredData.team && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{hoveredData.team}</span>
            )}
          </div>
        )}
      </div>

      {/* Year tiles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {champions.map((c) => {
          const color = getChampionColor(c);
          const isHovered = hoveredYear === c.year;
          const isDimmed = selectedChampion && selectedChampion !== c.champion;
          return (
            <div
              key={c.year}
              onMouseEnter={() => setHoveredYear(c.year)}
              onMouseLeave={() => setHoveredYear(null)}
              onClick={() => setSelectedChampion(selectedChampion === c.champion ? null : c.champion)}
              style={{
                width: 38, height: 38, borderRadius: 6,
                background: isHovered ? color : `${color}BB`,
                border: selectedChampion === c.champion ? `2px solid ${color}` : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s ease',
                transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                zIndex: isHovered ? 10 : 1,
                opacity: isDimmed ? 0.15 : 1,
                position: 'relative',
              }}
              title={`${c.year}: ${c.champion}${c.team ? ` (${c.team})` : ''}`}
            >
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#fff',
                fontFamily: "'JetBrains Mono', monospace",
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}>
                {String(c.year).slice(-2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Dynasty streak pills */}
      <div style={{ marginTop: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '1.2px',
          color: 'var(--text-muted)', textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          Consecutive title streaks
          <span style={{
            fontSize: 10, fontWeight: 500, letterSpacing: 'normal',
            color: 'var(--text-muted)', textTransform: 'none',
            marginLeft: 6, opacity: 0.8,
          }}>
            — back-to-back wins only, not career totals
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {streaks.filter(s => s.count >= 2).map((s, i) => {
            const color = getChampionColor(s);
            const range = s.end !== s.start ? `${s.start}–${s.end}` : `${s.start}`;
            return (
              <button
                key={i}
                onClick={() => setSelectedChampion(selectedChampion === s.champion ? null : s.champion)}
                title={`${s.champion} won ${s.count} championships in a row (${range}). This is a consecutive streak, not a career title count.`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 6,
                  background: selectedChampion === s.champion ? `${color}33` : 'var(--app-bg-alt)',
                  border: `1px solid ${selectedChampion === s.champion ? color : 'var(--panel-border)'}`,
                  cursor: 'pointer', color: 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 500, fontFamily: "'Inter', sans-serif",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                {s.champion}
                <span style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                  {s.count} in a row ({range})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ─── Era Section ─────────────────────────────────────────────────────────── */
function EraSection({ champions }) {
  const [expandedEra, setExpandedEra] = useState(null);
  return (
    <Card>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>The Eras of Formula 1</h3>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>75 years of evolution, revolution, and rivalry</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {F1_ERAS.map(era => {
          const eraChampions = champions.filter(c => c.year >= era.years[0] && c.year <= era.years[1]);
          const isExpanded = expandedEra === era.id;
          const champCounts = {};
          eraChampions.forEach(c => { champCounts[c.champion] = (champCounts[c.champion] || 0) + 1; });
          const dominant = Object.entries(champCounts).sort((a, b) => b[1] - a[1])[0];
          const dominantEntry = dominant ? eraChampions.find(c => c.champion === dominant[0]) : null;
          const dominantColor = dominantEntry ? getChampionColor(dominantEntry) : era.color;
          return (
            <div key={era.id}>
              <button
                onClick={() => setExpandedEra(isExpanded ? null : era.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  background: isExpanded ? `${era.color}15` : 'var(--app-bg-alt)',
                  border: `1px solid ${isExpanded ? `${era.color}40` : 'var(--panel-border)'}`,
                  cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif",
                }}
              >
                <div style={{ width: 6, height: 36, borderRadius: 3, background: era.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {era.name}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                      {era.years[0]}–{era.years[1]}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{era.description}</div>
                </div>
                <div style={{ textAlign: 'right', marginRight: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: era.color, fontFamily: "'JetBrains Mono', monospace" }}>
                    {eraChampions.length}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>titles</div>
                </div>
              </button>
              {isExpanded && eraChampions.length > 0 && (
                <div style={{ padding: '12px 16px 12px 34px', animation: 'fadeIn 0.2s ease' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                    {[...new Set(eraChampions.map(c => c.champion))].length} unique champions
                    {dominant && (
                      <span>
                        {' '}· Most dominant:{' '}
                        <span style={{ color: dominantColor, fontWeight: 600 }}>{dominant[0]}</span>
                        {' '}({dominant[1]})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {eraChampions.map(c => {
                      const color = getChampionColor(c);
                      return (
                        <div key={c.year} style={{
                          padding: '4px 10px', borderRadius: 6,
                          background: `${color}18`, border: `1px solid ${color}30`,
                          fontSize: 11, color: 'var(--text-secondary)',
                        }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 600, color, marginRight: 6, fontSize: 10,
                          }}>{c.year}</span>
                          {getFlag(c.nationality)}{' '}{c.champion}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {isExpanded && eraChampions.length === 0 && (
                <div style={{ padding: '8px 16px 8px 34px', fontSize: 11, color: 'var(--text-muted)' }}>
                  No championships in this era for the selected view.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Records ─────────────────────────────────────────────────────────────── */
function RecordCards({ mode }) {
  const records = mode === 'constructors' ? CONSTRUCTOR_RECORDS : DRIVER_RECORDS;
  return (
    <Card>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Records & Milestones</h3>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>The numbers that define F1 greatness</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {records.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 14px', borderRadius: 10,
              background: 'var(--app-bg-alt)', border: '1px solid var(--panel-border)',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-soft)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--app-bg-alt)'}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              fontSize: 16,
            }}>
              {r.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{r.value}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{r.holders}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── Titles Chart ────────────────────────────────────────────────────────── */
function TitlesChart({ champions, mode }) {
  const titleCounts = useMemo(() => {
    const counts = {};
    champions.forEach(c => { counts[c.champion] = (counts[c.champion] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [champions]);

  const MEDAL = ['#D4A800', '#8A8A8A', '#A66628'];

  return (
    <Card>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>
        {mode === 'drivers' ? 'Drivers' : 'Constructors'} by Title Count
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {titleCounts.map((item, i) => {
          const pct = (item.count / titleCounts[0].count) * 100;
          const barColor = i < 3 ? MEDAL[i] : 'var(--accent)';
          return (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: i < 3 ? barColor : 'var(--app-bg-alt)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                color: i < 3 ? '#000' : 'var(--text-muted)',
                flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <div style={{
                width: 140, fontSize: 12, fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {item.name}
              </div>
              <div style={{ flex: 1, height: 20, background: 'var(--app-bg-alt)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: `linear-gradient(90deg, ${i < 3 ? MEDAL[i] : '#e10600'}CC, ${i < 3 ? MEDAL[i] : '#e10600'}44)`,
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                  transition: 'width 0.6s ease',
                }}>
                  {pct > 20 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.count}
                    </span>
                  )}
                </div>
                {pct <= 20 && (
                  <span style={{
                    position: 'absolute', left: `calc(${pct}% + 6px)`, top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 10, fontWeight: 700,
                    color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {item.count}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Nationality Grid ────────────────────────────────────────────────────── */
function NationalityGrid({ champions }) {
  const counts = useMemo(() => {
    const map = {};
    champions.forEach(c => { map[c.nationality] = (map[c.nationality] || 0) + 1; });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [champions]);

  const NAT_COLORS = {
    British: '#012169', German: '#DD0000', Brazilian: '#009739',
    Finnish: '#003580', French: '#002395', Argentine: '#74ACDF',
    Austrian: '#EF3340', Australian: '#00843D', Italian: '#009246',
    Spanish: '#AA151B', Dutch: '#FF6F00', American: '#3C3B6E',
    'South African': '#007A4D', Canadian: '#FF0000', 'New Zealander': '#2B7A0B',
  };

  const total = counts.reduce((a, c) => a + c.count, 0);

  return (
    <Card>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
        Championships by Nationality
      </h3>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
        {counts.length} nationalities have produced a champion
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {counts.map(c => {
          const color = NAT_COLORS[c.name] || '#555555';
          const size = Math.max(56, 30 + (c.count / total) * 400);
          return (
            <div
              key={c.name}
              style={{
                width: size, height: size, maxWidth: 120, maxHeight: 120,
                borderRadius: 10,
                background: `${color}25`, border: `1px solid ${color}50`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 6, cursor: 'default',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              title={`${c.name}: ${c.count} title${c.count !== 1 ? 's' : ''}`}
            >
              <span style={{ fontSize: size > 80 ? 20 : 14, lineHeight: 1 }}>
                {getFlag(c.name)}
              </span>
              <span style={{
                fontSize: size > 80 ? 22 : 15, fontWeight: 800,
                color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace",
              }}>
                {c.count}
              </span>
              <span style={{
                fontSize: size > 70 ? 9 : 8, color: 'var(--text-muted)',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px',
                textAlign: 'center', lineHeight: 1.2,
              }}>
                {c.name}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Main Export ─────────────────────────────────────────────────────────── */
export default function ChampionshipHistoryPreview({ champions = [], mode = 'drivers' }) {
  const titleCounts = useMemo(() => {
    const counts = {};
    champions.forEach(c => { counts[c.champion] = (counts[c.champion] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [champions]);

  const mostTitles = titleCounts[0];
  const latest = champions[champions.length - 1];

  if (!champions.length) return null;

  return (
    <div style={{ color: 'var(--text-secondary)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px' }}>
          Championship History
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {champions.length} seasons of the pinnacle of motorsport
        </p>
      </div>

      {/* Hero stats strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16, padding: '16px 0', marginBottom: 24,
        borderBottom: '1px solid var(--panel-border)',
      }}>
        {[
          { label: 'Seasons',           value: champions.length,                     color: '#D4A800', mono: true },
          { label: 'Unique Champions',  value: titleCounts.length,                   color: '#e10600', mono: true },
          { label: 'Most Titles',       value: `${mostTitles?.name} (${mostTitles?.count})`, color: '#27F4D2', mono: false },
          { label: 'Reigning Champion', value: latest?.champion,                     color: '#FF8000', mono: false },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ width: 3, height: 16, borderRadius: 2, background: s.color, alignSelf: 'center', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                {s.label}
              </div>
              <div style={{
                fontSize: s.mono ? 20 : 13, fontWeight: 800,
                color: 'var(--text-primary)',
                fontFamily: s.mono ? "'JetBrains Mono', monospace" : 'inherit',
              }}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dominance Timeline */}
      <div style={{ marginBottom: 24 }}>
        <DominanceTimeline champions={champions} mode={mode} />
      </div>

      {/* Titles + Records */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 24 }}>
        <TitlesChart champions={champions} mode={mode} />
        <RecordCards mode={mode} />
      </div>

      {/* Eras + Nationality */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        <EraSection champions={champions} />
        <NationalityGrid champions={champions} />
      </div>
    </div>
  );
}
