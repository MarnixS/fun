'use strict';

const assert = require('node:assert/strict');
const handler = require('../api/temple-collection-log');

function response(value, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    json: async () => value,
  };
}

function mockResponse() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: '',
    headers,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    end(body) { this.body = body || ''; },
  };
}

async function call({ origin = 'https://marnixs.github.io', method = 'GET', url = '/api/temple-collection-log' } = {}) {
  const res = mockResponse();
  await handler({ method, url, headers: origin ? { origin } : {}, query: {} }, res);
  return { ...res, json: res.body ? JSON.parse(res.body) : null };
}

async function run() {
  const originalFetch = global.fetch;
  try {
    handler._test.resetCache();
    let calls = [];
    global.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes('temple-clog.json')) {
        return response({ players: { 'poep aura': { data: { items: { old: [] } } } }, recent: [] });
      }
      if (String(url).includes('player_collection_log.php')) {
        const player = new URL(url).searchParams.get('player');
        return response({ data: { items: { General: [{ id: 1, name: 'Test item', count: 1 }] }, player } });
      }
      if (String(url).includes('player_recent_items.php')) {
        const player = new URL(url).searchParams.get('player');
        return response({ data: [{ id: 1, name: 'Test item', date_unix: 1_700_000_000, player }] });
      }
      if (String(url).includes('items.php')) return response({ data: { 1: 'Test item' } });
      if (String(url).includes('categories.php')) return response({ data: { General: [1] } });
      throw new Error(`Unexpected URL: ${url}`);
    };

    const first = await call();
    assert.equal(first.statusCode, 200);
    assert.equal(first.headers.get('access-control-allow-origin'), 'https://marnixs.github.io');
    assert.equal(first.json.refreshDiagnostics.freshPlayers.length, 5);
    assert.equal(Object.keys(first.json.players).length, 5);
    assert.equal(first.json.recent.length, 5);
    assert.equal(calls.filter((url) => url.includes('player_collection_log.php')).length, 5);
    assert.equal(calls.filter((url) => url.includes('player_recent_items.php')).length, 5);

    const callCount = calls.length;
    const second = await call();
    assert.equal(second.statusCode, 200);
    assert.equal(calls.length, callCount, '90-second in-memory cache should shield Temple');

    const forbidden = await call({ origin: 'https://example.com' });
    assert.equal(forbidden.statusCode, 403);

    const health = await call({ url: '/api/temple-collection-log?health=1' });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json.ok, true);

    console.log('Temple proxy tests passed');
  } finally {
    global.fetch = originalFetch;
    handler._test.resetCache();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
