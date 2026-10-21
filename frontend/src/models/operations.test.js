import {
  parseDuration,
  buildPitStopRows,
  teamScorecard,
  pitTrend,
  headlineFindings,
  ANOMALY_THRESHOLD_S,
} from './operations';

const result = (driverId, constructorId, { position, grid, points = 0, classified = true }) => ({
  Driver: { driverId },
  Constructor: { constructorId, name: constructorId.toUpperCase() },
  position: String(position),
  positionText: classified ? String(position) : 'R',
  grid: String(grid),
  points: String(points),
});

const races = [
  {
    round: '1', raceName: 'Short Lane GP',
    Results: [
      result('a1', 'alpha', { position: 1, grid: 3, points: 25 }),
      result('a2', 'alpha', { position: 2, grid: 1, points: 18 }),
      result('b1', 'beta', { position: 3, grid: 2, points: 15 }),
      result('b2', 'beta', { position: 4, grid: 4, classified: false }),
    ],
  },
  {
    round: '2', raceName: 'Long Lane GP',
    Results: [
      result('a1', 'alpha', { position: 2, grid: 1, points: 18 }),
      result('a2', 'alpha', { position: 3, grid: 2, points: 15 }),
      result('b1', 'beta', { position: 1, grid: 4, points: 25 }),
      result('b2', 'beta', { position: 4, grid: 3, points: 12 }),
    ],
  },
];

// Alpha's crew is ~0.5 s quicker than Beta's at both tracks, even though the
// second track's pit lane is 8 s longer.
const seasonStops = [
  { round: '1', stops: [
    { driverId: 'a1', lap: '20', duration: '20.0' },
    { driverId: 'a2', lap: '22', duration: '20.1' },
    { driverId: 'b1', lap: '21', duration: '20.6' },
    { driverId: 'b2', lap: '23', duration: '20.5' },
  ] },
  { round: '2', stops: [
    { driverId: 'a1', lap: '30', duration: '28.0' },
    { driverId: 'a2', lap: '31', duration: '28.2' },
    { driverId: 'b1', lap: '29', duration: '28.6' },
    { driverId: 'b2', lap: '32', duration: '28.7' },
    { driverId: 'b2', lap: '40', duration: '48.9' }, // drive-through penalty
  ] },
];

describe('parseDuration', () => {
  it('handles seconds and m:ss formats', () => {
    expect(parseDuration('22.345')).toBeCloseTo(22.345);
    expect(parseDuration('1:02.5')).toBeCloseTo(62.5);
    expect(parseDuration('')).toBeNaN();
  });
});

describe('buildPitStopRows', () => {
  const rows = buildPitStopRows(seasonStops, races);

  it('normalises each stop to its race median so circuits are comparable', () => {
    const r1 = rows.filter(r => r.round === 1);
    const r2 = rows.filter(r => r.round === 2 && !r.anomalous);
    const avg = (list, team) => list.filter(r => r.teamId === team).reduce((a, r) => a + r.delta, 0) / 2;
    expect(avg(r1, 'alpha')).toBeLessThan(avg(r1, 'beta'));
    expect(avg(r2, 'alpha')).toBeLessThan(avg(r2, 'beta'));
    expect(Math.abs(avg(r1, 'alpha') - avg(r2, 'alpha'))).toBeLessThan(0.3);
  });

  it('flags penalties and repairs as anomalies', () => {
    const penalty = rows.find(r => r.lap === 40);
    expect(penalty.delta).toBeGreaterThan(ANOMALY_THRESHOLD_S);
    expect(penalty.anomalous).toBe(true);
  });
});

describe('teamScorecard', () => {
  const rows = buildPitStopRows(seasonStops, races);
  const sprints = [{ round: '2', SprintResults: [{ points: '8', Constructor: { constructorId: 'beta' } }] }];
  const card = teamScorecard(rows, races, sprints);
  const alpha = card.find(t => t.teamId === 'alpha');
  const beta = card.find(t => t.teamId === 'beta');

  it('totals race and sprint points', () => {
    expect(alpha.points).toBe(76);
    expect(beta.points).toBe(60);
    expect(card[0].teamId).toBe('alpha');
  });

  it('measures reliability and race-day gains from classified results', () => {
    expect(beta.dnfRate).toBeCloseTo(0.25);
    expect(alpha.dnfRate).toBe(0);
    expect(beta.avgGain).toBeCloseTo((-1 + 3 - 1) / 3);
  });

  it('ranks pit crews on normalised time and excludes anomalies', () => {
    expect(alpha.pitMedian).toBeLessThan(beta.pitMedian);
    expect(beta.stops).toBe(4);
    expect(beta.anomalies).toBe(1);
  });

  it('produces headline findings', () => {
    const h = headlineFindings(card, { minStops: 2 });
    expect(h.fastest.teamId).toBe('alpha');
    expect(h.reliable.teamId).toBe('alpha');
  });
});

describe('pitTrend', () => {
  it('gives one point per round with a median per team', () => {
    const trend = pitTrend(buildPitStopRows(seasonStops, races));
    expect(trend).toHaveLength(2);
    expect(trend[0].alpha).toBeLessThan(trend[0].beta);
  });
});
