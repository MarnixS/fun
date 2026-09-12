'use strict';

const ALLOWED_ORIGIN = 'https://marnixs.github.io';
const SNAPSHOT_URL = 'https://marnixs.github.io/fun/docs/data/temple-clog.json';
const TEMPLE_BASE = 'https://templeosrs.com/api/collection-log';
const CACHE_MS = 90_000;
const PLAYERS = {
  dikste: 'Dikste',
  'big dog aura': 'Big Dog Aura',
  lijpste: 'Lijpste',
  'poep aura': 'Poep Aura',
  lompste: 'Lompste',
};
const USER_AGENT = 'United-Gimps-Collection-Log/25.0 (github.com/MarnixS/fun)';

let memoryCache = null;
let memoryCachedAt = 0;
let inflight = null;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function mapWithConcurrency(entries, limit, worker) {
  const results = new Array(entries.length);
  let cursor = 0;
  async function consume() {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(entries[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, entries.length) }, consume));
  return results;
}

function validLog(value) {
  if (!value || typeof value !== 'object' || value.error || value.errors) return false;
  const data = value.data ?? value;
  return Boolean(data && typeof data === 'object' && data.items && typeof data.items === 'object');
}

async function fetchJson(url, { attempts = 2, timeout = 20_000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      if (response.ok) return await response.json();
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      lastError = error;
      if (response.status !== 429 && response.status < 500) throw error;
      const retryAfter = Number(response.headers.get('Retry-After')) || 0;
      await wait(Math.max(retryAfter * 1000, 500 * (attempt + 1)));
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
      await wait(400 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function recentRows(payload, player) {
  const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
  const rows = Array.isArray(data) ? data : data && typeof data === 'object' ? Object.values(data) : [];
  return rows.filter((row) => row && typeof row === 'object').map((row) => ({
    ...row,
    player: row.player || player,
    player_name_with_capitalization: row.player_name_with_capitalization || player,
  }));
}

function recentKey(row) {
  return [
    String(row.player_name_with_capitalization || row.player || '').toLowerCase(),
    String(row.id || row.item_id || ''),
    String(row.date_unix || row.date || ''),
  ].join('|');
}

function recentTime(row) {
  const unix = Number(row.date_unix);
  if (Number.isFinite(unix) && unix > 0) return unix > 1e12 ? unix : unix * 1000;
  const parsed = Number(new Date(row.date));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function buildDocument() {
  let previous = {};
  try {
    previous = await fetchJson(SNAPSHOT_URL, { attempts: 1, timeout: 10_000 });
  } catch {
    previous = {};
  }

  const players = {};
  for (const key of Object.keys(PLAYERS)) {
    if (validLog(previous.players?.[key])) players[key] = previous.players[key];
  }

  const playerEntries = Object.entries(PLAYERS);
  const playerResults = await mapWithConcurrency(playerEntries, 2, async ([key, player], index) => {
    if (index % 2) await wait(225);
    const query = new URLSearchParams({
      player,
      categories: 'all',
      includenames: '1',
      includemissingitems: '1',
      onlyitems: '0',
      dateformat: 'unix',
    });
    try {
      const payload = await fetchJson(`${TEMPLE_BASE}/player_collection_log.php?${query}`, {
        attempts: 1,
        timeout: 15_000,
      });
      if (!validLog(payload)) throw new Error('invalid Collection Log response');
      return { key, payload, ok: true };
    } catch (error) {
      return { key, ok: false };
    }
  });
  const freshPlayers = playerResults.filter((result) => result.ok).map((result) => result.key);
  const failedPlayers = playerResults.filter((result) => !result.ok).map((result) => result.key);
  playerResults.filter((result) => result.ok).forEach((result) => { players[result.key] = result.payload; });

  if (!freshPlayers.length) throw new Error('Temple returned no valid Collection Logs');

  let catalog = previous.catalog || previous.catalogue || [];
  let categories = previous.categories || {};
  const catalogMissing = !catalog || typeof catalog !== 'object' || !Object.keys(catalog).length;
  const categoriesMissing = !categories || typeof categories !== 'object' || !Object.keys(categories).length;
  const staticTasks = [];
  if (catalogMissing) staticTasks.push(['catalog', `${TEMPLE_BASE}/items.php`]);
  if (categoriesMissing) staticTasks.push(['categories', `${TEMPLE_BASE}/categories.php`]);
  const staticResults = await mapWithConcurrency(staticTasks, 2, async ([kind, url], index) => {
    if (index % 2) await wait(225);
    try {
      const payload = await fetchJson(url, { attempts: 1, timeout: 15_000 });
      return { kind, payload, ok: true };
    } catch {
      return { kind, ok: false };
    }
  });
  for (const result of staticResults) {
    if (!result.ok) continue;
    if (result.kind === 'catalog') {
      const next = result.payload?.data ?? result.payload;
      if (next && typeof next === 'object' && Object.keys(next).length) catalog = next;
    } else if (result.payload && typeof result.payload === 'object' && Object.keys(result.payload).length) {
      categories = result.payload;
    }
  }

  const mergedRecent = new Map(
    (Array.isArray(previous.recent) ? previous.recent : [])
      .filter((row) => row && typeof row === 'object')
      .map((row) => [recentKey(row), row]),
  );
  const recentEntries = playerEntries.filter(([key]) => validLog(players[key]));
  const recentResults = await mapWithConcurrency(recentEntries, 2, async ([key, player], index) => {
    if (index % 2) await wait(225);
    try {
      const query = new URLSearchParams({ player, count: '200' });
      const payload = await fetchJson(`${TEMPLE_BASE}/player_recent_items.php?${query}`, {
        attempts: 1,
        timeout: 15_000,
      });
      return { key, rows: recentRows(payload, player), ok: true };
    } catch {
      return { key, rows: [], ok: false };
    }
  });
  const recentPlayers = recentResults.filter((result) => result.ok).map((result) => result.key);
  recentResults.forEach((result) => result.rows.forEach((row) => mergedRecent.set(recentKey(row), row)));

  const validNames = new Set(
    Object.keys(PLAYERS).filter((key) => validLog(players[key])).map((key) => PLAYERS[key].toLowerCase()),
  );
  const recent = [...mergedRecent.values()]
    .filter((row) => validNames.has(String(row.player_name_with_capitalization || row.player || '').toLowerCase()))
    .sort((a, b) => recentTime(b) - recentTime(a))
    .slice(0, 500);
  const fetchedAt = Date.now();

  return {
    source: 'Collection Log via TempleOSRS manual site update',
    fetchedAt,
    players,
    catalog,
    categories,
    recent,
    membersWithClog: Object.keys(PLAYERS).filter((key) => validLog(players[key])).length,
    groupSize: 5,
    refreshDiagnostics: { freshPlayers, failedPlayers, recentPlayers, refreshedAt: fetchedAt },
  };
}

async function getDocument() {
  if (memoryCache && Date.now() - memoryCachedAt < CACHE_MS) return memoryCache;
  if (!inflight) {
    inflight = buildDocument()
      .then((document) => {
        memoryCache = document;
        memoryCachedAt = Date.now();
        return document;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function setCommonHeaders(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function send(res, status, value) {
  res.statusCode = status;
  res.end(JSON.stringify(value));
}

module.exports = async function handler(req, res) {
  setCommonHeaders(req, res);
  const origin = req.headers?.origin;
  if (origin && origin !== ALLOWED_ORIGIN) return send(res, 403, { error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  if (req.query?.health === '1' || /(?:\?|&)health=1(?:&|$)/.test(req.url || '')) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, { ok: true, service: 'united-gimps-temple-proxy' });
  }

  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=90, stale-while-revalidate=300');
  try {
    const document = await getDocument();
    res.setHeader('X-Temple-Fresh-Players', String(document.refreshDiagnostics.freshPlayers.length));
    return send(res, 200, document);
  } catch (error) {
    return send(res, 502, { error: error?.message || 'Temple refresh failed' });
  }
};

module.exports._test = {
  ALLOWED_ORIGIN,
  PLAYERS,
  mapWithConcurrency,
  validLog,
  recentRows,
  resetCache() {
    memoryCache = null;
    memoryCachedAt = 0;
    inflight = null;
  },
};
