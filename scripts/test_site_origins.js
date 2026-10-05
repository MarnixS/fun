'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const temple = require('../api/temple-collection-log');
const { createHandler } = require('../api/shared-data');
const goals = require('../api/player-goals');

const LEGACY = 'https://marnixs.github.io';
const CUSTOM = ['https://ugimps.com', 'https://www.ugimps.com'];
const UNTRUSTED = ['https://example.com', 'http://ugimps.com', 'https://ugimps.com.attacker.test', 'https://other.ugimps.com', 'null'];

function response() {
  return {
    headers: new Map(), statusCode: 200, body: null,
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    end(value) { this.body = value ? JSON.parse(value) : null; return this; },
  };
}

async function call(handler, { origin, method = 'OPTIONS', body, url = '/api/test?health=1', contentType = 'application/json' } = {}) {
  const res = response();
  const headers = { 'content-type': contentType };
  if (origin !== undefined) headers.origin = origin;
  await handler({ method, headers, body, url, query: {} }, res);
  return res;
}

async function run() {
  const keys = ['UGIMPS_DOMAIN_ENABLED', 'GOALS_GITHUB_TOKEN', 'GOAL_EDIT_CODE_HASHES'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = global.fetch;
  let writes = 0, upstreamCalls = 0;
  const shared = createHandler({
    store: {
      manifest: async () => ({ revision: 'saved' }),
      read: async () => ({ doc: {} }),
      save: async () => { writes++; return { saved: true }; },
    },
    refreshWom: async () => ({}),
  });
  try {
    delete process.env.UGIMPS_DOMAIN_ENABLED;
    for (const handler of [temple, shared, goals]) {
      for (const origin of [LEGACY, ...CUSTOM]) {
        const res = await call(handler, { origin });
        assert.equal(res.headers.get('vary'), 'Origin');
        assert.equal(res.headers.get('access-control-allow-origin'), origin === LEGACY ? LEGACY : undefined,
          'unregistered custom origins remain disabled');
        if (handler !== goals) assert.equal(res.statusCode, origin === LEGACY ? 204 : 403);
      }
    }

    process.env.UGIMPS_DOMAIN_ENABLED = 'true';
    for (const handler of [temple, shared, goals]) {
      for (const origin of [LEGACY, ...CUSTOM]) {
        const res = await call(handler, { origin });
        assert.equal(res.statusCode, 204);
        assert.equal(res.headers.get('access-control-allow-origin'), origin);
        assert.equal(res.headers.get('vary'), 'Origin');
      }
      for (const origin of UNTRUSTED) {
        const res = await call(handler, { origin });
        assert.equal(res.headers.get('access-control-allow-origin'), undefined);
        if (handler !== goals) assert.equal(res.statusCode, 403);
      }
    }

    for (const origin of [LEGACY, ...CUSTOM]) {
      const health = await call(temple, { origin, method: 'GET' });
      assert.equal(health.statusCode, 200);
      assert.equal(health.body.ok, true);
      const beforeRead = writes;
      const read = await call(shared, { origin, method: 'GET', url: '/api/shared-data?source=wom' });
      assert.equal(read.statusCode, 200);
      assert.equal(writes, beforeRead, 'reading a saved baseline cannot publish an update');
      const saved = await call(shared, { origin, method: 'POST', body: { source: 'wom', player: 'dikste' } });
      assert.equal(saved.statusCode, 200);
      assert.equal(saved.body.saved, true);
      assert.equal(saved.headers.get('access-control-allow-origin'), origin);
    }
    const count = writes;
    for (const origin of [...UNTRUSTED, undefined]) {
      const res = await call(shared, { origin, method: 'POST', body: { source: 'wom', player: 'dikste' } });
      assert.equal(res.statusCode, 403);
    }
    assert.equal(writes, count, 'untrusted and originless writes remain rejected');
    assert.equal((await call(shared, { origin: CUSTOM[0], method: 'POST', contentType: 'text/plain', body: {} })).statusCode, 415);

    process.env.GOALS_GITHUB_TOKEN = 'test-only';
    process.env.GOAL_EDIT_CODE_HASHES = JSON.stringify(Object.fromEntries(
      ['dikste', 'big dog aura', 'lijpste', 'poep aura', 'lompste'].map(player =>
        [player, createHash('sha256').update('test-code').digest('hex')]),
    ));
    global.fetch = async (_url, options) => {
      upstreamCalls++;
      return options.method === 'PUT'
        ? { ok: true, status: 200 }
        : { ok: true, json: async () => ({ sha: 'test-version', content: Buffer.from(JSON.stringify({ goals: {} })).toString('base64') }) };
    };
    const body = { player: 'dikste', text: '99 Slayer', code: 'test-code', version: null };
    for (const origin of [LEGACY, ...CUSTOM]) {
      const denied = await call(goals, { origin, method: 'POST', body: { ...body, code: 'wrong' } });
      assert.equal(denied.statusCode, 403);
      assert.equal(upstreamCalls, 0, 'a valid website origin does not replace a private goal code');
    }
    for (const origin of [LEGACY, ...CUSTOM]) {
      const saved = await call(goals, { origin, method: 'POST', body });
      assert.equal(saved.statusCode, 200);
      assert.equal(saved.headers.get('access-control-allow-origin'), origin);
    }
    const goalCalls = upstreamCalls;
    for (const origin of [...UNTRUSTED, undefined]) {
      assert.equal((await call(goals, { origin, method: 'POST', body })).statusCode, 403);
    }
    assert.equal(upstreamCalls, goalCalls, 'untrusted goal writes never reach GitHub');

    process.env.UGIMPS_DOMAIN_ENABLED = 'false';
    assert.equal((await call(shared, { origin: CUSTOM[0] })).statusCode, 403,
      'disabling the domain flag reverses custom-origin access');
    assert.equal((await call(shared, { origin: LEGACY })).statusCode, 204);
    console.log('Domain origins: activation, CORS, preflight, saved reads, authorized writes, private codes and rejection tests passed');
  } finally {
    global.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
