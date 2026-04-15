import React, { useMemo, useState } from 'react';

/* ─── Inline Data (preview only) ──────────────────────────────────────────── */
const CHAMPION_TEAM_COLORS = {
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
};

const F1_ERAS = [
  { id: 'pioneer', name: 'Pioneer Era', years: [1950, 1960], color: '#CD853F',
    description: 'Front-engine cars, minimal safety, gentlemen racers. Dominated by Fangio\'s genius.' },
  { id: 'revolution', name: 'The Revolution', years: [1961, 1970], color: '#DAA520',
    description: 'Rear-engine revolution, aero innovation. Jim Clark\'s brilliance, tragic losses.' },
  { id: 'garagiste', name: 'Garagiste & Ground Effect', years: [1971, 1982], color: '#228B22',
    description: 'British constructors dominate. Ground effect. Stewart, Lauda, and Fittipaldi shine.' },
  { id: 'turbo', name: 'Turbo Era', years: [1983, 1993], color: '#9400D3',
    description: 'Turbocharged monsters. Senna vs Prost — the greatest rivalry.' },
  { id: 'schumacher', name: 'Schumacher Era', years: [1994, 2008], color: '#E8002D',
    description: 'Michael rewrites every record. Ferrari\'s unstoppable dynasty.' },
  { id: 'hybrid-dawn', name: 'Red Bull & Hybrid Dawn', years: [2009, 2016], color: '#3671C6',
    description: 'Vettel\'s four-peat, then Mercedes\' hybrid dominance begins.' },
  { id: 'hamilton', name: 'Hamilton Era', years: [2017, 2021], color: '#27F4D2',
    description: 'Hamilton matches Schumacher\'s 7 titles. Mercedes unprecedented dominance.' },
  { id: 'modern', name: 'Ground Effect Returns', years: [2022, 2026], color: '#FF8000',
    description: 'New regulations, Verstappen\'s dominance, McLaren\'s resurgence.' },
];

const RECORDS = [
  { label: 'Most Titles', value: '7', holders: 'Lewis Hamilton, Michael Schumacher' },
  { label: 'Most Consecutive', value: '4', holders: 'Vettel (2010-13), Verstappen (2021-24)' },
  { label: 'Youngest Champion', value: '23y 134d', holders: 'Sebastian Vettel (2010)' },
  { label: 'Oldest Champion', value: '46y 41d', holders: 'Juan Manuel Fangio (1957)' },
  { label: 'Closest Fight', value: '0 pts', holders: '2008 — Hamilton beat Massa on countback' },
  { label: 'Posthumous Champion', value: '1970', holders: 'Jochen Rindt — after fatal crash at Monza' },
];

const DRIVER_CHAMPIONS = [
  { year: 1950, champion: 'Nino Farina', nationality: 'Italian', team: 'Alfa Romeo' },
  { year: 1951, champion: 'Juan Manuel Fangio', nationality: 'Argentine', team: 'Alfa Romeo' },
  { year: 1952, champion: 'Alberto Ascari', nationality: 'Italian', team: 'Ferrari' },
  { year: 1953, champion: 'Alberto Ascari', nationality: 'Italian', team: 'Ferrari' },
  { year: 1954, champion: 'Juan Manuel Fangio', nationality: 'Argentine', team: 'Maserati / Mercedes' },
  { year: 1955, champion: 'Juan Manuel Fangio', nationality: 'Argentine', team: 'Mercedes' },
  { year: 1956, champion: 'Juan Manuel Fangio', nationality: 'Argentine', team: 'Ferrari' },
  { year: 1957, champion: 'Juan Manuel Fangio', nationality: 'Argentine', team: 'Maserati' },
  { year: 1958, champion: 'Mike Hawthorn', nationality: 'British', team: 'Ferrari' },
  { year: 1959, champion: 'Jack Brabham', nationality: 'Australian', team: 'Cooper-Climax' },
  { year: 1960, champion: 'Jack Brabham', nationality: 'Australian', team: 'Cooper-Climax' },
  { year: 1961, champion: 'Phil Hill', nationality: 'American', team: 'Ferrari' },
  { year: 1962, champion: 'Graham Hill', nationality: 'British', team: 'BRM' },
  { year: 1963, champion: 'Jim Clark', nationality: 'British', team: 'Lotus-Climax' },
  { year: 1964, champion: 'John Surtees', nationality: 'British', team: 'Ferrari' },
  { year: 1965, champion: 'Jim Clark', nationality: 'British', team: 'Lotus-Climax' },
  { year: 1966, champion: 'Jack Brabham', nationality: 'Australian', team: 'Brabham-Repco' },
  { year: 1967, champion: 'Denny Hulme', nationality: 'New Zealander', team: 'Brabham-Repco' },
  { year: 1968, champion: 'Graham Hill', nationality: 'British', team: 'Lotus-Ford' },
  { year: 1969, champion: 'Jackie Stewart', nationality: 'British', team: 'Matra-Ford' },
  { year: 1970, champion: 'Jochen Rindt', nationality: 'Austrian', team: 'Lotus-Ford' },
  { year: 1971, champion: 'Jackie Stewart', nationality: 'British', team: 'Tyrrell-Ford' },
  { year: 1972, champion: 'Emerson Fittipaldi', nationality: 'Brazilian', team: 'Lotus-Ford' },
  { year: 1973, champion: 'Jackie Stewart', nationality: 'British', team: 'Tyrrell-Ford' },
  { year: 1974, champion: 'Emerson Fittipaldi', nationality: 'Brazilian', team: 'McLaren-Ford' },
  { year: 1975, champion: 'Niki Lauda', nationality: 'Austrian', team: 'Ferrari' },
  { year: 1976, champion: 'James Hunt', nationality: 'British', team: 'McLaren-Ford' },
  { year: 1977, champion: 'Niki Lauda', nationality: 'Austrian', team: 'Ferrari' },
  { year: 1978, champion: 'Mario Andretti', nationality: 'American', team: 'Lotus-Ford' },
  { year: 1979, champion: 'Jody Scheckter', nationality: 'South African', team: 'Ferrari' },
  { year: 1980, champion: 'Alan Jones', nationality: 'Australian', team: 'Williams-Ford' },
  { year: 1981, champion: 'Nelson Piquet', nationality: 'Brazilian', team: 'Brabham-Ford' },
  { year: 1982, champion: 'Keke Rosberg', nationality: 'Finnish', team: 'Williams-Ford' },
  { year: 1983, champion: 'Nelson Piquet', nationality: 'Brazilian', team: 'Brabham-BMW' },
  { year: 1984, champion: 'Niki Lauda', nationality: 'Austrian', team: 'McLaren-TAG' },
  { year: 1985, champion: 'Alain Prost', nationality: 'French', team: 'McLaren-TAG' },
  { year: 1986, champion: 'Alain Prost', nationality: 'French', team: 'McLaren-TAG' },
  { year: 1987, champion: 'Nelson Piquet', nationality: 'Brazilian', team: 'Williams-Honda' },
  { year: 1988, champion: 'Ayrton Senna', nationality: 'Brazilian', team: 'McLaren-Honda' },
  { year: 1989, champion: 'Alain Prost', nationality: 'French', team: 'McLaren-Honda' },
  { year: 1990, champion: 'Ayrton Senna', nationality: 'Brazilian', team: 'McLaren-Honda' },
  { year: 1991, champion: 'Ayrton Senna', nationality: 'Brazilian', team: 'McLaren-Honda' },
  { year: 1992, champion: 'Nigel Mansell', nationality: 'British', team: 'Williams-Renault' },
  { year: 1993, champion: 'Alain Prost', nationality: 'French', team: 'Williams-Renault' },
  { year: 1994, champion: 'Michael Schumacher', nationality: 'German', team: 'Benetton-Ford' },
  { year: 1995, champion: 'Michael Schumacher', nationality: 'German', team: 'Benetton-Renault' },
  { year: 1996, champion: 'Damon Hill', nationality: 'British', team: 'Williams-Renault' },
  { year: 1997, champion: 'Jacques Villeneuve', nationality: 'Canadian', team: 'Williams-Renault' },
  { year: 1998, champion: 'Mika Hakkinen', nationality: 'Finnish', team: 'McLaren-Mercedes' },
  { year: 1999, champion: 'Mika Hakkinen', nationality: 'Finnish', team: 'McLaren-Mercedes' },
  { year: 2000, champion: 'Michael Schumacher', nationality: 'German', team: 'Ferrari' },
  { year: 2001, champion: 'Michael Schumacher', nationality: 'German', team: 'Ferrari' },
  { year: 2002, champion: 'Michael Schumacher', nationality: 'German', team: 'Ferrari' },
  { year: 2003, champion: 'Michael Schumacher', nationality: 'German', team: 'Ferrari' },
  { year: 2004, champion: 'Michael Schumacher', nationality: 'German', team: 'Ferrari' },
  { year: 2005, champion: 'Fernando Alonso', nationality: 'Spanish', team: 'Renault' },
  { year: 2006, champion: 'Fernando Alonso', nationality: 'Spanish', team: 'Renault' },
  { year: 2007, champion: 'Kimi Raikkonen', nationality: 'Finnish', team: 'Ferrari' },
  { year: 2008, champion: 'Lewis Hamilton', nationality: 'British', team: 'McLaren-Mercedes' },
  { year: 2009, champion: 'Jenson Button', nationality: 'British', team: 'Brawn-Mercedes' },
  { year: 2010, champion: 'Sebastian Vettel', nationality: 'German', team: 'Red Bull-Renault' },
  { year: 2011, champion: 'Sebastian Vettel', nationality: 'German', team: 'Red Bull-Renault' },
  { year: 2012, champion: 'Sebastian Vettel', nationality: 'German', team: 'Red Bull-Renault' },
  { year: 2013, champion: 'Sebastian Vettel', nationality: 'German', team: 'Red Bull-Renault' },
  { year: 2014, champion: 'Lewis Hamilton', nationality: 'British', team: 'Mercedes' },
  { year: 2015, champion: 'Lewis Hamilton', nationality: 'British', team: 'Mercedes' },
  { year: 2016, champion: 'Nico Rosberg', nationality: 'German', team: 'Mercedes' },
  { year: 2017, champion: 'Lewis Hamilton', nationality: 'British', team: 'Mercedes' },
  { year: 2018, champion: 'Lewis Hamilton', nationality: 'British', team: 'Mercedes' },
  { year: 2019, champion: 'Lewis Hamilton', nationality: 'British', team: 'Mercedes' },
  { year: 2020, champion: 'Lewis Hamilton', nationality: 'British', team: 'Mercedes' },
  { year: 2021, champion: 'Max Verstappen', nationality: 'Dutch', team: 'Red Bull-Honda' },
  { year: 2022, champion: 'Max Verstappen', nationality: 'Dutch', team: 'Red Bull Racing' },
  { year: 2023, champion: 'Max Verstappen', nationality: 'Dutch', team: 'Red Bull Racing' },
  { year: 2024, champion: 'Max Verstappen', nationality: 'Dutch', team: 'Red Bull Racing' },
];

/* ─── Card ────────────────────────────────────────────────────────────────── */
const Card = ({ children, style }) => (
  <div style={{
    background: 'linear-gradient(135deg, #13132b 0%, #1a1a2e 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12, padding: 24, ...style,
  }}>{children}</div>
);

/* ─── Dominance Timeline ──────────────────────────────────────────────────── */
function DominanceTimeline({ champions }) {
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
        current = { champion: c.champion, start: c.year, end: c.year, count: 1, team: c.team };
      }
    });
    if (current) result.push(current);
    return result;
  }, [champions]);

  const hoveredData = hoveredYear ? champions.find(c => c.year === hoveredYear) : null;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>Driver Dominance Timeline</h3>
          <p style={{ fontSize: 11, color: '#666', margin: '4px 0 0' }}>
            Every championship since 1950. Hover to explore — consecutive titles form visible streaks.
          </p>
        </div>
        {hoveredData && (
          <div style={{
            padding: '6px 14px', borderRadius: 8,
            background: `${CHAMPION_TEAM_COLORS[hoveredData.team] || '#555'}22`,
            border: `1px solid ${CHAMPION_TEAM_COLORS[hoveredData.team] || '#555'}44`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{hoveredData.year}</span>
            <span style={{ fontSize: 12, color: '#ccc', marginLeft: 8 }}>{hoveredData.champion}</span>
            <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>{hoveredData.team}</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {champions.map((c) => {
          const color = CHAMPION_TEAM_COLORS[c.team] || '#555';
          const isHovered = hoveredYear === c.year;
          const isDimmed = selectedChampion && selectedChampion !== c.champion;
          return (
            <div key={c.year}
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
                zIndex: isHovered ? 10 : 1, opacity: isDimmed ? 0.2 : 1,
              }}
              title={`${c.year}: ${c.champion} (${c.team})`}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace", textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {String(c.year).slice(-2)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {streaks.filter(s => s.count >= 2).map((s, i) => {
          const color = CHAMPION_TEAM_COLORS[s.team] || '#555';
          return (
            <button key={i} onClick={() => setSelectedChampion(selectedChampion === s.champion ? null : s.champion)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6,
                background: selectedChampion === s.champion ? `${color}33` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedChampion === s.champion ? color : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer', color: '#ccc', fontSize: 11, fontWeight: 500, fontFamily: "'Inter', sans-serif",
              }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              {s.champion}
              <span style={{ color: '#666', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                {s.count}x ({s.start}{s.end !== s.start ? `–${s.end}` : ''})
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Era Section ─────────────────────────────────────────────────────────── */
function EraSection({ champions }) {
  const [expandedEra, setExpandedEra] = useState(null);
  return (
    <Card>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>The Eras of Formula 1</h3>
      <p style={{ fontSize: 11, color: '#666', marginBottom: 20 }}>75 years of evolution, revolution, and rivalry</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {F1_ERAS.map(era => {
          const eraChampions = champions.filter(c => c.year >= era.years[0] && c.year <= era.years[1]);
          const isExpanded = expandedEra === era.id;
          const champCounts = {};
          eraChampions.forEach(c => champCounts[c.champion] = (champCounts[c.champion] || 0) + 1);
          const dominant = Object.entries(champCounts).sort((a, b) => b[1] - a[1])[0];
          const dominantChampion = dominant
            ? eraChampions.find(c => c.champion === dominant[0])
            : null;
          const dominantColor = dominantChampion
            ? CHAMPION_TEAM_COLORS[dominantChampion.team] || era.color
            : era.color;
          return (
            <div key={era.id}>
              <button onClick={() => setExpandedEra(isExpanded ? null : era.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  background: isExpanded ? `${era.color}15` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isExpanded ? `${era.color}40` : 'rgba(255,255,255,0.04)'}`,
                  cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif",
                }}>
                <div style={{ width: 6, height: 36, borderRadius: 3, background: era.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    {era.name}
                    <span style={{ fontSize: 11, color: '#666', fontWeight: 400, marginLeft: 8 }}>{era.years[0]}–{era.years[1]}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{era.description}</div>
                </div>
                <div style={{ textAlign: 'right', marginRight: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: era.color, fontFamily: "'JetBrains Mono', monospace" }}>{eraChampions.length}</div>
                  <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>titles</div>
                </div>
              </button>
              {isExpanded && (
                <div style={{ padding: '12px 16px 12px 34px' }}>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                    {[...new Set(eraChampions.map(c => c.champion))].length} unique champions
                    {dominant && <span> · Most dominant: <span style={{ color: dominantColor, fontWeight: 600 }}>{dominant[0]}</span> ({dominant[1]})</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {eraChampions.map(c => {
                      const color = CHAMPION_TEAM_COLORS[c.team] || era.color;
                      return (
                        <div key={c.year} style={{
                          padding: '4px 10px', borderRadius: 6,
                          background: `${color}18`, border: `1px solid ${color}30`,
                          fontSize: 11, color: '#ccc',
                        }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color, marginRight: 6, fontSize: 10 }}>{c.year}</span>
                          {c.champion}
                        </div>
                      );
                    })}
                  </div>
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
function RecordCards() {
  return (
    <Card>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Records & Milestones</h3>
      <p style={{ fontSize: 11, color: '#666', marginBottom: 20 }}>The numbers that define F1 greatness</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {RECORDS.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '12px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(225, 6, 0, 0.1)', border: '1px solid rgba(225, 6, 0, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              fontSize: 14,
            }}>
              {i === 0 ? '🏆' : i === 1 ? '🔥' : i === 2 ? '⚡' : i === 3 ? '⏱' : i === 4 ? '🎯' : '⭐'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{r.value}</span>
              </div>
              <div style={{ fontSize: 11, color: '#777', lineHeight: 1.4 }}>{r.holders}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── Titles Chart ────────────────────────────────────────────────────────── */
function TitlesChart({ champions }) {
  const titleCounts = useMemo(() => {
    const counts = {};
    champions.forEach(c => counts[c.champion] = (counts[c.champion] || 0) + 1);
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12);
  }, [champions]);
  const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'];
  return (
    <Card>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>Drivers by Title Count</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {titleCounts.map((item, i) => {
          const pct = (item.count / titleCounts[0].count) * 100;
          const color = i < 3 ? MEDAL[i] : '#e10600';
          return (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: i < 3 ? color : '#222',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: i < 3 ? '#000' : '#888',
              }}>{i + 1}</span>
              <div style={{ width: 130, fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
              <div style={{ flex: 1, height: 20, background: '#0a0a12', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}CC, ${color}44)`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
                  {pct > 20 && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{item.count}</span>}
                </div>
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
    champions.forEach(c => map[c.nationality] = (map[c.nationality] || 0) + 1);
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [champions]);
  const NAT_COLORS = {
    British: '#012169', German: '#DD0000', Brazilian: '#009739', Finnish: '#003580', French: '#002395',
    Argentine: '#74ACDF', Austrian: '#EF3340', Australian: '#00843D', Italian: '#009246', Spanish: '#AA151B',
    Dutch: '#FF6F00', American: '#3C3B6E', 'South African': '#007A4D', Canadian: '#FF0000', 'New Zealander': '#000000',
  };
  const total = counts.reduce((a, c) => a + c.count, 0);
  return (
    <Card>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 16 }}>Championships by Nationality</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {counts.map(c => {
          const color = NAT_COLORS[c.name] || '#555';
          const size = Math.max(56, 30 + (c.count / total) * 400);
          return (
            <div key={c.name} style={{
              width: size, height: size, maxWidth: 120, maxHeight: 120,
              borderRadius: 10, background: `${color}25`, border: `1px solid ${color}50`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 6, cursor: 'default',
            }}>
              <span style={{ fontSize: size > 80 ? 22 : 16, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{c.count}</span>
              <span style={{ fontSize: 8, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>{c.name}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Main Preview ────────────────────────────────────────────────────────── */
export default function ChampionshipHistoryPreview({ champions = DRIVER_CHAMPIONS }) {
  const titleCounts = useMemo(() => {
    const counts = {};
    champions.forEach(c => counts[c.champion] = (counts[c.champion] || 0) + 1);
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [champions]);
  const mostTitles = titleCounts[0];
  const latest = champions[champions.length - 1];

  return (
    <div style={{ background: '#0a0a12', minHeight: '100vh', padding: '24px 32px', color: '#e0e0e0', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1a1a2e; }
        ::-webkit-scrollbar-thumb { background: #e10600; border-radius: 3px; }
      `}</style>

      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>
          Championship History
        </h1>
        <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{champions.length} seasons of the pinnacle of motorsport</p>
      </div>

      <div style={{ display: 'flex', gap: 24, padding: '16px 0', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { label: 'Seasons', value: champions.length, color: '#FFD700' },
          { label: 'Unique Champions', value: titleCounts.length, color: '#e10600' },
          { label: 'Most Titles', value: `${mostTitles.name} (${mostTitles.count})`, color: '#27F4D2' },
          { label: 'Reigning Champion', value: latest.champion, color: '#FF8000' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ width: 3, height: 16, borderRadius: 2, background: s.color, alignSelf: 'center' }} />
            <div>
              <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: typeof s.value === 'number' ? 20 : 13, fontWeight: 800, color: '#fff', fontFamily: typeof s.value === 'number' ? "'JetBrains Mono', monospace" : 'inherit' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <DominanceTimeline champions={champions} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <TitlesChart champions={champions} />
        <RecordCards />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <EraSection champions={champions} />
        <NationalityGrid champions={champions} />
      </div>
    </div>
  );
}
