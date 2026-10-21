/**
 * Deterministic mock responses for the OpenF1 and Jolpica APIs, used by the
 * end-to-end suite and for exercising the snapshot script offline.
 *
 * Dates are relative to "now" so the suite keeps working as seasons roll over.
 */
const DAY = 86400000;
const NOW = Date.now();
const YEAR = new Date(NOW).getUTCFullYear();
const iso = (ms) => new Date(ms).toISOString();
const ymd = (ms) => iso(ms).slice(0, 10);

const PAST_RACE = NOW - 9 * DAY;
const EARLIER_RACE = NOW - 16 * DAY;
const NEXT_RACE = NOW + 5 * DAY;

// ── Jolpica ────────────────────────────────────────────────────────────────
const driver = (driverId, code, givenName, familyName, nationality, team, constructorId) =>
  ({ driverId, code, givenName, familyName, nationality, team, constructorId });
const DRIVERS = [
  driver('antonelli', 'ANT', 'Andrea Kimi', 'Antonelli', 'Italian', 'Mercedes', 'mercedes'),
  driver('russell', 'RUS', 'George', 'Russell', 'British', 'Mercedes', 'mercedes'),
  driver('hamilton', 'HAM', 'Lewis', 'Hamilton', 'British', 'Ferrari', 'ferrari'),
  driver('perez', 'PER', 'Sergio', 'Pérez', 'Mexican', 'Cadillac F1 Team', 'cadillac'),
];
const asDriver = ({ team, constructorId, ...d }) => d;
const asConstructor = (d) => ({ constructorId: d.constructorId, name: d.team });

const RACES = [
  { round: '1', raceName: 'Australian Grand Prix', when: EARLIER_RACE, circuit: 'Albert Park Grand Prix Circuit' },
  { round: '2', raceName: 'Singapore Grand Prix', when: PAST_RACE, circuit: 'Marina Bay Street Circuit' },
  { round: '3', raceName: 'United States Grand Prix', when: NEXT_RACE, circuit: 'Circuit of the Americas' },
].map(r => ({
  season: String(YEAR), round: r.round, raceName: r.raceName,
  date: ymd(r.when), time: `${iso(r.when).slice(11, 19)}Z`, Circuit: { circuitName: r.circuit },
}));

const results = () => DRIVERS.map((d, i) => ({
  number: String(i + 1), position: String(i + 1), positionText: i === 3 ? 'R' : String(i + 1),
  points: String([25, 18, 15, 0][i]), grid: String(i === 2 ? 0 : 4 - i),
  status: ['Finished', 'Lapped', 'Finished', 'Retired'][i],
  Driver: asDriver(d), Constructor: asConstructor(d),
  Time: i === 0 ? { time: '1:32:11.123' } : undefined,
}));
const mr = (o) => JSON.stringify({ MRData: { total: '2', ...o } });

function jolpica(u) {
  const p = u.pathname.replace('/ergast/f1', '');
  const y = String(YEAR);
  if (p === '/current.json' || p === `/${y}.json`) return mr({ RaceTable: { season: y, Races: RACES } });
  if (p.includes('driverStandings')) {
    return mr({ StandingsTable: { StandingsLists: [{ DriverStandings: DRIVERS.map((d, i) => ({
      position: String(i + 1), points: String(50 - i * 10), wins: String(i < 2 ? 1 : 0),
      Driver: asDriver(d), Constructors: [asConstructor(d)],
    })) }] } });
  }
  if (p.includes('constructorStandings')) {
    return mr({ StandingsTable: { StandingsLists: [{ ConstructorStandings: [
      { position: '1', points: '90', Constructor: { constructorId: 'mercedes', name: 'Mercedes' } },
      { position: '2', points: '30', Constructor: { constructorId: 'ferrari', name: 'Ferrari' } },
      { position: '3', points: '0', Constructor: { constructorId: 'cadillac', name: 'Cadillac F1 Team' } },
    ] }] } });
  }
  if (p.endsWith('/last/results.json')) return mr({ RaceTable: { Races: [{ ...RACES[1], Results: results() }] } });
  if (p === `/${y}/results.json`) return mr({ RaceTable: { Races: RACES.slice(0, 2).map(r => ({ ...r, Results: results() })) } });
  if (p === `/${y}/sprint.json`) {
    return mr({ total: '1', RaceTable: { Races: [{ ...RACES[1], SprintResults: DRIVERS.map((d, i) => ({
      position: String(i + 1), positionText: String(i + 1), points: String([8, 7, 6, 5][i]), Driver: asDriver(d),
    })) }] } });
  }
  const pits = p.match(new RegExp(`^/${y}/(\\d+)/pitstops\\.json$`));
  if (pits) {
    // Mercedes crew ~0.4 s quicker than the field; one drive-through penalty.
    const base = pits[1] === '1' ? 21 : 28;
    const PitStops = DRIVERS.flatMap((d, i) => [
      { driverId: d.driverId, stop: '1', lap: String(18 + i), duration: (base + [-0.3, -0.5, 0.2, 0.6][i] + Number(pits[1]) * 0.05).toFixed(3) },
      { driverId: d.driverId, stop: '2', lap: String(36 + i), duration: (base + [-0.4, -0.2, 0.4, 1.4][i]).toFixed(3) },
    ]);
    if (pits[1] === '2') PitStops.push({ driverId: 'perez', stop: '3', lap: '44', duration: (base + 20).toFixed(3) });
    return mr({ RaceTable: { Races: [{ PitStops }] } });
  }
  const round = p.match(new RegExp(`^/${y}/(\\d+)/(results|laps)\\.json$`));
  if (round) {
    const race = RACES.find(r => r.round === round[1]);
    if (round[2] === 'results') return mr({ RaceTable: { Races: [{ ...race, Results: results() }] } });
    return mr({ total: '8', RaceTable: { Races: [{ Laps: [1, 2].map(n => ({
      number: String(n),
      Timings: DRIVERS.map((d, i) => ({ driverId: d.driverId, position: String(n === 1 ? [2, 1, 3, 4][i] : i + 1), time: '1:35.000' })),
    })) }] } });
  }
  return mr({});
}

// ── OpenF1 ─────────────────────────────────────────────────────────────────
const SESSION = 9999;      // latest race
const PREV_SESSION = 7777; // same circuit, previous season
const CIRCUIT_KEY = 61;
const F1_DRIVERS = [
  [12, 'Kimi ANTONELLI', 'ANT', 'Mercedes', '27F4D2', 'ITA'],
  [63, 'George RUSSELL', 'RUS', 'Mercedes', '27F4D2', 'GBR'],
  [44, 'Lewis HAMILTON', 'HAM', 'Ferrari', 'E8002D', 'GBR'],
  [16, 'Charles LECLERC', 'LEC', 'Ferrari', 'E8002D', 'MON'],
  [3, 'Max VERSTAPPEN', 'VER', 'Red Bull Racing', '3671C6', 'NED'],
  [1, 'Lando NORRIS', 'NOR', 'McLaren', 'FF8000', 'GBR'],
  [81, 'Oscar PIASTRI', 'PIA', 'McLaren', 'FF8000', 'AUS'],
  [14, 'Fernando ALONSO', 'ALO', 'Aston Martin', '229971', 'ESP'],
  [55, 'Carlos SAINZ', 'SAI', 'Williams', '1868DB', 'ESP'],
  [23, 'Alexander ALBON', 'ALB', 'Williams', '1868DB', 'THA'],
].map(([driver_number, full_name, name_acronym, team_name, team_colour, country_code]) =>
  ({ driver_number, full_name, name_acronym, team_name, team_colour, country_code }));

/**
 * A 50-lap, 10-car dry race with known physics: medium 0.5 s faster than
 * hard when new, wear 0.07 / 0.03 s/lap, fuel+track gain 0.06 s/lap.
 */
function synthRace(sessionKey) {
  const N = 50;
  const laps = [];
  const stints = [];
  let seed = Number(sessionKey);
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const start = Number(sessionKey) === PREV_SESSION ? PAST_RACE - 365 * DAY : PAST_RACE;
  F1_DRIVERS.forEach(({ driver_number: dn }, d) => {
    const pace = 95 + d * 0.15;
    const pit = 18 + (d % 6) * 2;
    const order = d % 2 ? ['HARD', 'MEDIUM'] : ['MEDIUM', 'HARD'];
    const s1 = { driver_number: dn, stint_number: 1, compound: order[0], lap_start: 1, lap_end: pit, tyre_age_at_start: 0 };
    const s2 = { driver_number: dn, stint_number: 2, compound: order[1], lap_start: pit + 1, lap_end: N, tyre_age_at_start: 0 };
    stints.push(s1, s2);
    let clock = start + d * 500;
    for (let lap = 1; lap <= N; lap++) {
      const s = lap <= pit ? s1 : s2;
      const age = lap - s.lap_start;
      let t = pace + (s.compound === 'MEDIUM' ? -0.5 : 0) + (s.compound === 'MEDIUM' ? 0.07 : 0.03) * age
        - 0.06 * (lap - 1) + (rnd() - 0.5) * 0.3;
      if (lap === 1) t += 6;
      if (lap === pit) t += 8;
      if (lap === pit + 1) t += 13;
      laps.push({
        driver_number: dn, lap_number: lap, lap_duration: lap === 1 ? null : +t.toFixed(3),
        date_start: iso(clock), is_pit_out_lap: lap === pit + 1,
        duration_sector_1: +(t * 0.31).toFixed(3), duration_sector_2: +(t * 0.37).toFixed(3), duration_sector_3: +(t * 0.32).toFixed(3),
      });
      clock += t * 1000;
    }
  });
  return { laps, stints };
}

const sessionRow = (session_key, when, year) => ({
  session_key, meeting_key: session_key, session_name: 'Race', session_type: 'Race',
  date_start: iso(when), circuit_key: CIRCUIT_KEY, circuit_short_name: 'Singapore', location: 'Marina Bay', year,
});

function openf1(u) {
  const p = u.pathname.replace('/v1', '');
  const q = u.searchParams;
  const sk = q.get('session_key');
  const dn = q.get('driver_number') ? Number(q.get('driver_number')) : null;

  if (p === '/sessions' && sk === 'latest') return [sessionRow(SESSION, PAST_RACE, YEAR)];
  if (p === '/sessions') {
    const y = Number(q.get('year'));
    if (y === YEAR) return [sessionRow(SESSION, PAST_RACE, YEAR), { ...sessionRow(1, NEXT_RACE, YEAR), circuit_key: 9 }];
    if (y === YEAR - 1) return [sessionRow(PREV_SESSION, PAST_RACE - 365 * DAY, YEAR - 1)];
    return [];
  }
  if (p === '/meetings') {
    return [{ meeting_key: SESSION, meeting_name: 'Singapore Grand Prix' }, { meeting_key: PREV_SESSION, meeting_name: 'Singapore Grand Prix' }];
  }
  if (p === '/drivers') return F1_DRIVERS;
  if (p === '/laps') {
    const { laps } = synthRace(sk);
    return dn ? laps.filter(l => l.driver_number === dn) : laps;
  }
  if (p === '/stints') {
    const { stints } = synthRace(sk);
    return dn ? stints.filter(s => s.driver_number === dn) : stints;
  }
  if (p === '/car_data') {
    const start = Date.parse(q.get('date>'));
    return Array.from({ length: 300 }, (_, i) => ({
      date: iso(start + i * 300), speed: 120 + Math.round(180 * Math.abs(Math.sin(i / 20))),
      throttle: i % 40 < 30 ? 100 : 0, brake: i % 40 >= 30 ? 100 : 0, n_gear: 3 + (i % 6), rpm: 10000,
    }));
  }
  return [];
}

/** Response body for any mocked API URL, or null if the host isn't mocked. */
function mockBody(url) {
  const u = new URL(url);
  if (u.hostname === 'api.jolpi.ca') return jolpica(u);
  if (u.hostname === 'api.openf1.org') return JSON.stringify(openf1(u));
  return null;
}

module.exports = { mockBody, SESSION };
