/**
 * Preload for running scripts/snapshot.mjs offline against the e2e fixtures:
 *   SNAPSHOT_NO_THROTTLE=1 node --import ./e2e/mock-fetch.mjs scripts/snapshot.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mockBody } = require('./fixtures.cjs');

globalThis.fetch = async (url) => {
  const body = mockBody(String(url));
  if (body == null) return new Response('not mocked', { status: 404 });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
};
