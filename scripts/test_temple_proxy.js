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
        return response({
          fetchedAt: 1_700_000_000_000,
          players: Object.fromEntries(Object.keys(handler._test.PLAYERS).map((key) => [key, {
            data: { items: { General: [{ id: 1, name: 'Existing item', count: 1, date: 1_699_000_000 }] } },
          }])),
          recent: [{ Code: 403, Message: 'No new items', player: 'Dikste' }],
        });
      }
      if (String(url).includes('player_collection_log.php')) {
        const player = new URL(url).searchParams.get('player');
        const items = [{ id: 1, name: 'Existing item', count: player === 'Big Dog Aura' ? 2 : 1, date: 1_699_000_000 }];
        if (player === 'Lijpste') items.push({ id: 2, name: 'Recovered full-log item', count: 1, date: 1_700_000_100 });
        return response({ data: { items: { General: items }, player } });
      }
      if (String(url).includes('player_recent_items.php')) {
        const player = new URL(url).searchParams.get('player');
        if (player === 'Lijpste') return response({ Code: 403, Message: 'No items after initial sync' }, 403);
        return response({ data: [{ id: 1, name: 'Existing item', date_unix: 1_700_000_000, player }] });
      }
      if (String(url).includes('items.php')) return response({ data: { 1: 'Test item' } });
      if (String(url).includes('categories.php')) return response({ data: { General: [1] } });
      throw new Error(`Unexpected URL: ${url}`);
    };

    const first = await call();
    assert.equal(first.statusCode, 200);
    assert.equal(first.headers.get('access-control-allow-origin'), 'https://marnixs.github.io');
    assert.equal(first.json.refreshDiagnostics.freshPlayers.length, 5);
    assert.equal(first.json.refreshDiagnostics.recentPlayers.length, 4);
    assert.equal(first.json.refreshDiagnostics.derivedRecentItems, 2);
    assert.equal(Object.keys(first.json.players).length, 5);
    assert.equal(first.json.recent.length, 6);
    assert(first.json.recent.some((row) => row.name === 'Recovered full-log item' && row.player === 'Lijpste'));
    const repeat = first.json.recent.find((row) => row.name === 'Existing item' && row.player === 'Big Dog Aura' && row.repeat_drop);
    assert(repeat, 'count increase with unchanged item timestamp should create a repeat-drop event');
    assert.equal(repeat.previous_count, 1);
    assert.equal(repeat.current_count, 2);
    assert.equal(repeat.count_delta, 1);
    assert.equal(repeat.detected_from_count, true);
    assert(!first.json.recent.some((row) => row.Code || !row.id || !row.name), 'error objects are never published as recent items');
    assert.equal(calls.filter((url) => url.includes('player_collection_log.php')).length, 5);
    assert.equal(calls.filter((url) => url.includes('player_recent_items.php')).length, 5);

    const callCount = calls.length;
    const second = await call();
    assert.equal(second.statusCode, 200);
    assert.equal(calls.length, callCount, '90-second in-memory cache should shield Temple');

    const forced = await call({ url: '/api/temple-collection-log?refresh=1' });
    assert.equal(forced.statusCode, 200);
    assert(calls.length > callCount, 'an explicit button refresh must bypass the in-memory cache');
    assert.equal(forced.headers.get('cache-control'), 'no-store');

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
