// F1 Team colors and metadata
export const TEAM_COLORS = {
  'red_bull': '#3671C6',
  'ferrari': '#E8002D',
  'mercedes': '#27F4D2',
  'mclaren': '#FF8000',
  'aston_martin': '#358C75',
  'alpine': '#FF87BC',
  'williams': '#1868DB',
  'haas': '#B6BABD',
  'rb': '#6692FF',
  'sauber': '#52E252',
  // Legacy names for API compatibility
  'Red Bull': '#3671C6',
  'Ferrari': '#E8002D',
  'Mercedes': '#27F4D2',
  'McLaren': '#FF8000',
  'Aston Martin': '#358C75',
  'Alpine F1 Team': '#FF87BC',
  'Williams': '#1868DB',
  'Haas F1 Team': '#B6BABD',
  'RB F1 Team': '#6692FF',
  'Kick Sauber': '#52E252',
};

export const TIRE_COMPOUNDS = {
  SOFT: { color: '#FF3333', label: 'Soft', degradation: 0.08 },
  MEDIUM: { color: '#FFD700', label: 'Medium', degradation: 0.05 },
  HARD: { color: '#EEEEEE', label: 'Hard', degradation: 0.03 },
  INTERMEDIATE: { color: '#43B02A', label: 'Inter', degradation: 0.04 },
  WET: { color: '#0067AD', label: 'Wet', degradation: 0.02 },
};

export const FLAG_COLORS = {
  GREEN: '#00FF00',
  YELLOW: '#FFD700',
  RED: '#FF0000',
  CHEQUERED: '#FFFFFF',
  VSC: '#FFD700',
  SC: '#FFD700',
};

// Map driver numbers to team colors (2025 grid)
export const DRIVER_NUMBER_TO_COLOR = {
  1: '#3671C6',   // Verstappen - Red Bull
  11: '#3671C6',  // Perez - Red Bull
  44: '#E8002D',  // Hamilton - Ferrari
  16: '#E8002D',  // Leclerc - Ferrari
  63: '#27F4D2',  // Russell - Mercedes
  12: '#27F4D2',  // Antonelli - Mercedes
  4: '#FF8000',   // Norris - McLaren
  81: '#FF8000',  // Piastri - McLaren
  14: '#358C75',  // Alonso - Aston Martin
  18: '#358C75',  // Stroll - Aston Martin
  10: '#FF87BC',  // Gasly - Alpine
  31: '#FF87BC',  // Ocon - Alpine (check current)
  55: '#1868DB',  // Sainz - Williams
  23: '#1868DB',  // Albon - Williams
  20: '#B6BABD',  // Magnussen - Haas
  27: '#B6BABD',  // Hulkenberg - Haas
  22: '#6692FF',  // Tsunoda - RB
  30: '#6692FF',  // Lawson - RB
  77: '#52E252',  // Bottas - Sauber
  24: '#52E252',  // Zhou - Sauber
};

export function getTeamColor(teamName) {
  if (!teamName) return '#888888';
  const key = Object.keys(TEAM_COLORS).find(
    k => teamName.toLowerCase().includes(k.toLowerCase())
  );
  return key ? TEAM_COLORS[key] : '#888888';
}

export function getDriverColor(driverNumber) {
  return DRIVER_NUMBER_TO_COLOR[driverNumber] || '#888888';
}
