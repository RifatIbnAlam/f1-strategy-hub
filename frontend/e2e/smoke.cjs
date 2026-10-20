/**
 * End-to-end smoke test: serves the production build, mocks both APIs with
 * deterministic fixtures, and drives every view in headless Chromium.
 *
 * Checks: no runtime errors, key panels render, model calibration produces a
 * backtest, the offline snapshot is served when the APIs are down and under
 * ?demo, and no view scrolls horizontally on a phone-width screen.
 *
 * Prereqs: a build containing a snapshot generated from the fixtures:
 *   SNAPSHOT_NO_THROTTLE=1 node --import ./e2e/mock-fetch.mjs scripts/snapshot.mjs && npm run build
 * Run:  node e2e/smoke.cjs   (CHROMIUM_PATH=... to use a preinstalled browser)
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const { mockBody, SESSION } = require('./fixtures.cjs');

const BUILD = path.join(__dirname, '..', 'build');
const ORIGIN = 'https://app.test';
const BASE = `${ORIGIN}/f1-strategy-hub/`;
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };

let apiDown = false;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${err.message.split('\n')[0]}`);
  }
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  await page.route('**/*', async route => {
    const url = route.request().url();
    const body = mockBody(url);
    if (body != null) {
      return apiDown
        ? route.fulfill({ status: 503, body: 'unavailable' })
        : route.fulfill({ contentType: 'application/json', body });
    }
    const u = new URL(url);
    if (u.origin === ORIGIN) {
      let file = u.pathname.replace('/f1-strategy-hub', '') || '/';
      if (file === '/') file = '/index.html';
      const full = path.join(BUILD, file);
      if (!fs.existsSync(full)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(full) });
    }
    return route.fulfill({ status: 204, body: '' }); // fonts etc.
  });

  const go = async (hash, query = '') => {
    await page.goto(`${BASE}${query}${hash ? `#/${hash}` : ''}`);
    await page.waitForLoadState('networkidle');
  };
  // Dropdowns are swapped for a spinner while their options load, so wait for
  // the wanted option to exist before selecting it.
  const pick = async (index, value) => {
    const select = page.locator('select').nth(index);
    await select.locator(`option[value="${value}"]`).waitFor({ state: 'attached' });
    await select.selectOption(String(value));
  };
  const card = (title) => page.locator(`text=${title}`).first().locator('xpath=ancestor::div[contains(@style,"border-radius: 12px")][1]');

  console.log('Views');
  await check('dashboard shows standings and next race', async () => {
    await go('');
    await page.getByText('Andrea Kimi Antonelli').first().waitFor();
    await page.getByText('NEXT RACE').waitFor();
  });

  await check('strategy simulator ranks strategies and runs Monte Carlo', async () => {
    await go('strategy');
    await page.getByText('Optimal Strategies').waitFor();
    await page.getByText(/beats Strategy B in \d+(\.\d)?% of races/).waitFor();
  });

  await check('calibration fits a real race and beats the baseline out of sample', async () => {
    const panel = card('Calibrate & Backtest on Real Races');
    await panel.locator('select').nth(1).selectOption(String(SESSION));
    await panel.getByText('Error reduction', { exact: false }).waitFor();
    const text = await panel.innerText();
    const reduction = Number(text.match(/(\d+)%\s*vs baseline/i)[1]);
    assert(reduction > 50, `error reduction only ${reduction}%`);
    await panel.getByRole('button', { name: /Load calibrated model/ }).click();
    const circuit = await page.locator('select').first().evaluate(s => s.options[s.selectedIndex].text);
    assert(circuit.startsWith('Calibrated'), `circuit is "${circuit}"`);
  });

  await check('driver comparison renders head-to-head', async () => {
    await go('comparison');
    const selects = page.locator('select');
    await selects.nth(0).selectOption('antonelli');
    await selects.nth(1).selectOption('russell');
    await page.getByText('Championship Points Progression').waitFor();
  });

  await check('telemetry viewer loads car telemetry', async () => {
    await go('telemetry');
    await pick(1, SESSION);
    await pick(2, '12');
    await page.getByText('Top speed', { exact: false }).first().waitFor();
  });

  await check('race flow lists only completed races', async () => {
    await go('raceflow');
    const options = await page.locator('select').nth(1).locator('option').allTextContents();
    assert(!options.some(o => o.includes('United States')), 'future race listed');
    await pick(1, '2');
    await page.getByText('Position Flow — Lap by Lap').waitFor();
  });

  await check('undercut analyzer computes gaps', async () => {
    await go('undercut');
    await pick(1, SESSION);
    await pick(2, '12');
    await pick(3, '63');
    await page.getByText(/Race Gap/).waitFor();
  });

  await check('championship history renders', async () => {
    await go('history');
    await page.getByText('Records & Milestones').waitFor();
  });

  console.log('Offline resilience');
  await check('falls back to the snapshot when the APIs are down', async () => {
    apiDown = true;
    await go('');
    await page.getByRole('status').getByText(/live data source is unavailable/).waitFor();
    await page.getByText('Andrea Kimi Antonelli').first().waitFor();
    apiDown = false;
  });

  await check('?demo serves the snapshot without touching the APIs', async () => {
    let apiCalls = 0;
    const count = req => { if (mockBody(req.url()) != null) apiCalls++; };
    page.on('request', count);
    await go('telemetry', '?demo');
    await page.getByRole('status').getByText(/Demo mode/).waitFor();
    await pick(1, SESSION);
    await pick(2, '12');
    await page.getByText('Top speed', { exact: false }).first().waitFor();
    page.off('request', count);
    assert.strictEqual(apiCalls, 0, `${apiCalls} live API requests in demo mode`);
  });

  console.log('Mobile layout');
  await page.setViewportSize({ width: 375, height: 800 });
  for (const view of ['', 'strategy', 'comparison', 'telemetry', 'raceflow', 'undercut', 'history']) {
    await check(`no horizontal scroll at 375px: ${view || 'dashboard'}`, async () => {
      await go(view);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 0, `${overflow}px overflow`);
    });
  }

  await check('no uncaught page errors', async () => {
    assert.deepStrictEqual(pageErrors, []);
  });

  await browser.close();
  if (failures.length) {
    console.log(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll checks passed');
})();
