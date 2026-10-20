import { getTeamColor, getOpenF1DriverColor, distinctColor, currentConstructor } from './data/constants';
import { getFlag } from './data/flags';
import { buildDistanceTrace } from './components/CarTelemetry';
import { lineCrossings } from './components/UndercutAnalyzer';
import { formatSessionLabel, uniqueDrivers } from './services/openf1';

describe('getTeamColor', () => {
  it('resolves Jolpica ids, Jolpica names and OpenF1 names to the same colour', () => {
    expect(getTeamColor('red_bull')).toBe(getTeamColor('Red Bull'));
    expect(getTeamColor('Red Bull Racing')).toBe(getTeamColor('red_bull'));
    expect(getTeamColor('aston_martin')).toBe(getTeamColor('Aston Martin'));
  });

  it('does not confuse Racing Bulls with Red Bull', () => {
    expect(getTeamColor('rb')).toBe(getTeamColor('Racing Bulls'));
    expect(getTeamColor('Racing Bulls')).not.toBe(getTeamColor('Red Bull Racing'));
  });

  it('knows the 2026 entrants', () => {
    expect(getTeamColor('audi')).not.toBe('#888888');
    expect(getTeamColor('Cadillac')).not.toBe('#888888');
  });
});

describe('driver colour helpers', () => {
  it('prefers the OpenF1 team_colour', () => {
    expect(getOpenF1DriverColor({ team_colour: '3671C6', team_name: 'Ferrari' })).toBe('#3671C6');
    expect(getOpenF1DriverColor({ team_colour: null, team_name: 'Ferrari' })).toBe(getTeamColor('Ferrari'));
  });

  it('separates teammates', () => {
    expect(distinctColor('#FF8000', '#ff8000')).not.toBe('#FF8000');
    expect(distinctColor('#FF8000', '#3671C6')).toBe('#FF8000');
  });

  it('uses the latest team for mid-season transfers', () => {
    expect(currentConstructor({ Constructors: [{ name: 'RB' }, { name: 'Red Bull' }] }).name).toBe('Red Bull');
  });
});

describe('getFlag', () => {
  it('handles nationalities and OpenF1 three-letter codes', () => {
    expect(getFlag('Dutch')).toBe('🇳🇱');
    expect(getFlag('NED')).toBe('🇳🇱');
    expect(getFlag('Unknownian')).toBe('');
  });
});

describe('buildDistanceTrace', () => {
  it('integrates speed into distance', () => {
    const start = '2025-01-01T00:00:00.000Z';
    const samples = [0, 1, 2].map(s => ({
      date: new Date(Date.parse(start) + s * 1000).toISOString(),
      speed: 360, throttle: 100, brake: 0, n_gear: 8, rpm: 11000,
    }));
    const trace = buildDistanceTrace(samples, start);
    // 360 km/h = 100 m/s for 2 s
    expect(trace[2].distance).toBe(200);
    expect(trace[2].time).toBe(2);
  });
});

describe('lineCrossings', () => {
  it('uses the next lap start as the line crossing and fills the final lap', () => {
    const laps = [
      { lap_number: 1, date_start: '2025-01-01T00:00:00.000Z', lap_duration: null },
      { lap_number: 2, date_start: '2025-01-01T00:01:40.000Z', lap_duration: 90 },
    ];
    const cross = lineCrossings(laps);
    expect(cross[1]).toBe(Date.parse('2025-01-01T00:01:40.000Z'));
    expect(cross[2]).toBe(Date.parse('2025-01-01T00:03:10.000Z'));
  });
});

describe('OpenF1 helpers', () => {
  it('labels sessions with the meeting name and session type', () => {
    expect(formatSessionLabel({ meeting_name: 'Italian Grand Prix', session_name: 'Sprint', date_start: '2025-09-06T10:00:00Z' }))
      .toMatch(/^Italian Grand Prix — Sprint \(Sep [67]\)$/);
  });

  it('dedupes drivers by number', () => {
    expect(uniqueDrivers([{ driver_number: 1 }, { driver_number: 1 }, { driver_number: 4 }])).toHaveLength(2);
  });
});
