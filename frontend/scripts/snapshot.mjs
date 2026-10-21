#!/usr/bin/env node
/**
 * Build-time data snapshot.
 *
 * Runs the app's own service functions (src/services) under Node against the
 * live OpenF1 and Jolpica APIs and saves every JSON response to
 * public/snapshot/, keyed by request URL. The deployed site falls back to
 * these files when a live request fails, or uses them exclusively with ?demo.
 *
 * Because the requests come from the same code the browser runs, the saved
 * keys match exactly what the UI will ask for.
 *
 * Never fails the build: any error is logged and whatever was captured is kept.
 *
 * Usage: node scripts/snapshot.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'public', 'snapshot');

// ── Load the browser service modules as ESM ────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-snapshot-'));
for (const name of ['snapshot', 'openf1', 'jolpica']) {
  const src = fs.readFileSync(path.join(root, 'src', 'services', `${name}.js`), 'utf8')
    .replace(/from '\.\/snapshot'/g, "from './snapshot.mjs'");
  fs.writeFileSync(path.join(tmp, `${name}.mjs`), src);
}

// ── Polite, rate-limited fetch ─────────────────────────────────────────────
// OpenF1's free tier allows a few requests per second with a per-minute cap;
// Jolpica allows ~4/s. Space requests out per host.
// SNAPSHOT_NO_THROTTLE=1 disables the spacing for offline runs against mocks.
const MIN_GAP_MS = process.env.SNAPSHOT_NO_THROTTLE ? {} : { 'api.openf1.org': 2100, 'api.jolpi.ca': 350 };
const lastRequest = {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const host = new URL(url).host;
  const wait = (lastRequest[host] || 0) + (MIN_GAP_MS[host] || 0) - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequest[host] = Date.now();
  return realFetch(url, opts);
};

const saved = new Map();
globalThis.__F1_SNAPSHOT_RECORD__ = (key, data) => saved.set(key, data);

const { hashKey, snapshotKey } = await import(pathToFileURL(path.join(tmp, 'snapshot.mjs')));
const openf1 = await import(pathToFileURL(path.join(tmp, 'openf1.mjs')));
const jolpica = await import(pathToFileURL(path.join(tmp, 'jolpica.mjs')));

async function step(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✓ ${label}`);
    return result;
  } catch (err) {
    console.warn(`  ✗ ${label}: ${err.message}`);
    return null;
  }
}

const manifest = { generatedAt: new Date().toISOString() };

// ── Jolpica: dashboard, driver comparison, race flow ───────────────────────
console.log('Jolpica');
const schedule = await step('schedule (current)', () => jolpica.getSchedule('current'));
await step('driver standings', () => jolpica.getDriverStandings('current'));
await step('constructor standings', () => jolpica.getConstructorStandings('current'));
const lastRace = await step('last race result', () => jolpica.getLastRaceResult());
const season = schedule?.[0]?.season || lastRace?.season;
let results = null;
if (season) {
  manifest.season = season;
  results = await step(`${season} race results`, () => jolpica.getRaceResults(season));
  await step(`${season} sprint results`, () => jolpica.getSprintResults(season));
  // Race Flow requests the schedule by numeric year rather than 'current'.
  await step(`${season} schedule`, () => jolpica.getSchedule(Number(season)));
}
if (season && results?.length) {
  // Team Ops page: every round's pit stops.
  await step(`${season} pit stops (${results.length} rounds)`,
    () => jolpica.getSeasonPitStops(Number(season), results.map(r => r.round)));
}
if (lastRace) {
  await step(`R${lastRace.round} results`, () => jolpica.getRaceResults(Number(lastRace.season), lastRace.round));
  await step(`R${lastRace.round} lap positions`, () => jolpica.getLapTimes(Number(lastRace.season), lastRace.round));
}

// ── OpenF1: telemetry, sectors, tyres, undercut, calibration ──────────────
console.log('OpenF1');
await step('latest session', () => openf1.getLatestSession());

const year = new Date().getUTCFullYear();
let sessions = await step(`${year} race sessions`, () => openf1.getRaceSessions(year));
let race = sessions?.find(s => s.session_name === 'Race');
if (!race) {
  sessions = await step(`${year - 1} race sessions`, () => openf1.getRaceSessions(year - 1));
  race = sessions?.find(s => s.session_name === 'Race');
}

async function snapshotRaceLaps(session, { perDriver }) {
  const sk = session.session_key;
  const label = `${session.meeting_name || session.circuit_short_name || sk} ${session.year || ''}`.trim();
  const laps = await step(`laps (${label})`, () => openf1.getLaps(sk));
  const stints = await step(`stints (${label})`, () => openf1.getStints(sk));
  if (!perDriver) return;

  const drivers = await step('drivers', () => openf1.getDrivers(sk));
  for (const d of openf1.uniqueDrivers(drivers || [])) {
    const dn = d.driver_number;
    // Per-driver views request /laps and /stints filtered by driver; derive
    // those responses from the full-session data instead of 2 calls each.
    if (laps) {
      saved.set(snapshotKey(openf1.buildUrl('/laps', { session_key: sk, driver_number: dn })),
        laps.filter(l => l.driver_number === dn));
    }
    if (stints) {
      saved.set(snapshotKey(openf1.buildUrl('/stints', { session_key: sk, driver_number: dn })),
        stints.filter(s => s.driver_number === dn));
    }
    // Car telemetry for each driver's fastest lap (the viewer's default lap).
    const fastest = (laps || [])
      .filter(l => l.driver_number === dn && l.lap_duration && l.date_start)
      .reduce((best, l) => (!best || l.lap_duration < best.lap_duration ? l : best), null);
    if (fastest) {
      const end = new Date(new Date(fastest.date_start).getTime() + fastest.lap_duration * 1000).toISOString();
      await step(`car data #${dn} lap ${fastest.lap_number}`, () => openf1.getCarData(sk, dn, fastest.date_start, end));
    }
  }
}

if (race) {
  manifest.race = { session_key: race.session_key, meeting_name: race.meeting_name, year: race.year, date: race.date_start };
  await snapshotRaceLaps(race, { perDriver: true });

  // Same circuit, previous season: powers the out-of-sample backtest.
  const prevSessions = await step(`${race.year - 1} race sessions`, () => openf1.getRaceSessions(race.year - 1));
  const prev = prevSessions?.find(s => s.session_name === 'Race' && s.circuit_key === race.circuit_key);
  if (prev) {
    manifest.previousRace = { session_key: prev.session_key, meeting_name: prev.meeting_name, year: prev.year };
    await snapshotRaceLaps(prev, { perDriver: false });
  }
}

// ── Write ──────────────────────────────────────────────────────────────────
if (saved.size === 0) {
  console.warn('No responses captured; leaving any existing snapshot untouched.');
  process.exit(0);
}
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
let bytes = 0;
for (const [key, data] of saved) {
  const body = JSON.stringify(data);
  bytes += body.length;
  fs.writeFileSync(path.join(outDir, `${hashKey(key)}.json`), body);
}
manifest.keys = [...saved.keys()];
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(manifest, null, 1));
console.log(`Saved ${saved.size} responses (${(bytes / 1e6).toFixed(1)} MB) to public/snapshot/`);
fs.rmSync(tmp, { recursive: true, force: true });
