'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');

const BASE = process.env.SITE_TEST_URL || 'http://127.0.0.1:8123/';
const PAGES = ['index.html', 'gim.html', 'hiscores.html', 'progress.html', 'history.html', 'time-machine.html', 'chronicle.html'];
const ALL = ['dikste', 'big dog aura', 'lijpste', 'poep aura', 'lompste'];
const MEMBER_KEY = 'ug-v25-member-selection';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(test, label, timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await test()) return;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function openPage(path, { selection, templeResponse, templeDocument, womResponse, womDocument, liveSync=false, savedTemple, fetchLog, sharedDocs, indexedDB, deferredReadyState=false, priceData={}, priceResponse } = {}) {
  const {mergeWom,mergeTemple}=require('../docs/assets/wom-store');
  const templeTools=require('../api/temple-collection-log')._test;
  const backend=sharedDocs||{wom:JSON.parse(fs.readFileSync('docs/data/wom-cache.json')),temple:savedTemple||JSON.parse(fs.readFileSync('docs/data/temple-clog.json'))};
  backend.revisions??=new Map();backend.serial??=0;
  const receipt=source=>{const revision=(++backend.serial).toString(16).padStart(40,'0');backend.revisions.set(revision,structuredClone(backend[source]));return {source,revision,saved:true,diagnostics:backend[source].refreshDiagnostics||{}}};
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  virtualConsole.on('error', (error) => errors.push(String(error)));
  const dom = await JSDOM.fromURL(BASE + path, {
    // jsdom has no IndexedDB; allow the legacy fallback to hold full history.
    // Storage failure behavior is covered separately in audit_sync.js.
    storageQuota: 50_000_000,
    // Exercise a fast cached portrait response while the next deferred script is still loading.
    resources: deferredReadyState ? {interceptors:[requestInterceptor(async request=>{
      if(new URL(request.url).pathname.endsWith('/assets/v21-common.js'))await sleep(200);
    })]} : 'usable',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // Real deferred scripts execute while readyState is interactive, before DOMContentLoaded.
      if(deferredReadyState){const get=Object.getOwnPropertyDescriptor(window.Document.prototype,'readyState').get;Object.defineProperty(window.document,'readyState',{get(){const value=get.call(this);return value==='loading'?'interactive':value}})}
      if(indexedDB)window.indexedDB=indexedDB;
      // Skip only the production WOM courtesy delay against mocked API responses.
      const realTimer=window.setTimeout.bind(window);
      window.setTimeout=(fn,ms,...args)=>realTimer(fn,ms===3200?0:ms,...args);
      if(!liveSync)for(const source of ['temple','wom'])window.localStorage.setItem('ug-v28-live-'+source,JSON.stringify({checkedAt:Date.now()}));
      if (selection) window.localStorage.setItem(MEMBER_KEY, JSON.stringify(selection));
      if (womDocument) window.localStorage.setItem('ug-v20-wom-cache', JSON.stringify(womDocument));
      if (templeDocument) window.localStorage.setItem('ug-v20-temple-cache', JSON.stringify(templeDocument));
      window.fetch = async (input, options) => {
        const url = new URL(String(input), window.location.href).href;
        if(fetchLog)fetchLog.push({url,method:options?.method||'GET',body:options?.body});
        if(deferredReadyState&&new URL(url).pathname.endsWith('/assets/portrait-source.txt'))return new Response(fs.readFileSync('docs/assets/portrait-source.txt','utf8'));
        if(url.includes('/api/shared-data')){
          if((options?.method||'GET')==='GET')return sharedDocs?jsonResponse(receipt(new URL(url).searchParams.get('source'))):jsonResponse({error:'Testing saved fallback'},503);
          const {source,player}=JSON.parse(options.body);
          if(backend.failSaves)return jsonResponse({error:'Could not confirm the shared save'},502);
          if(source==='temple'){
            if(!templeResponse)return jsonResponse({error:'Temple test response not configured'},502);
            const candidate=structuredClone(templeResponse),fresh=candidate.refreshDiagnostics?.freshPlayers||Object.keys(candidate.players||{});
            candidate.players=Object.fromEntries(Object.entries(candidate.players||{}).filter(([key])=>fresh.includes(key)&&templeTools.validLog(candidate.players[key])));
            const derived=templeTools.derivedRecentRows(candidate.players,backend.temple);
            candidate.recent=[...(candidate.recent||[]),...derived].map(row=>templeTools.normalizeRecent(row)).filter(Boolean);
            candidate.source='TempleOSRS manual site update';
            candidate.refreshDiagnostics={...candidate.refreshDiagnostics,freshPlayers:fresh,derivedRecentItems:derived.length};
            backend.temple=mergeTemple(backend.temple,candidate);
          }else{
            if(!womResponse||backend.failPlayers?.includes(player))return jsonResponse({error:'WOM test response unavailable'},502);
            const previous=backend.wom.profiles[player]?.latestSnapshot,profile=womResponse.profiles[player];
            backend.wom=mergeWom(backend.wom,{fetchedAt:Date.now(),profiles:{[player]:profile},snapshots:{[player]:[profile.latestSnapshot]},achievements:{[player]:womResponse.achievements?.[player]||[]},gains:Object.fromEntries(['week','month','year'].map(period=>[period,{[player]:womResponse.gains?.[period]?.[player]}])),refreshDiagnostics:{successfulPlayers:[player],newerSnapshots:Date.parse(profile.latestSnapshot.createdAt)>Date.parse(previous?.createdAt)?1:0}});
          }
          return jsonResponse(receipt(source));
        }
        if(url.startsWith('https://raw.githubusercontent.com/MarnixS/fun/')){
          const revision=new URL(url).pathname.split('/')[3];
          return backend.revisions.has(revision)?jsonResponse(backend.revisions.get(revision)):jsonResponse({error:'Unknown revision'},404);
        }
        if(savedTemple&&url.endsWith('/data/temple-clog.json'))return jsonResponse(savedTemple);
        if (url.includes('__TEMPLE_PROXY_URL__') || url.includes('/api/temple-collection-log')) {
          if (!templeResponse) return jsonResponse({ error: 'Temple test response not configured' }, 502);
          return jsonResponse(templeResponse);
        }
        if (url.startsWith('https://prices.runescape.wiki/')) return priceResponse?priceResponse():jsonResponse({ data: priceData });
        if (url.startsWith('https://api.wiseoldman.net/')) {
          if (!womResponse) return jsonResponse({ error: 'Network disabled in UI audit' }, 503);
          const parsed = new URL(url);
          const tail = parsed.pathname.split('/players/')[1] || '';
          const username = decodeURIComponent(tail.split('/')[0]).toLowerCase();
          const key = ALL.find((value) => value === username);
          if (!key) return jsonResponse({ error: 'Unknown WOM test member' }, 404);
          if (parsed.pathname.endsWith('/snapshots')) return jsonResponse([]);
          if (parsed.pathname.endsWith('/achievements')) return jsonResponse(womResponse.achievements?.[key] || []);
          if (parsed.pathname.endsWith('/gained')) {
            const period = parsed.searchParams.get('period');
            return jsonResponse(womResponse.gains?.[period]?.[key] || { data: { skills: {}, bosses: {} } });
          }
          if ((options?.method || 'GET').toUpperCase() === 'POST') return jsonResponse(womResponse.profiles[key]);
          return jsonResponse(womResponse.profiles[key]);
        }
        return fetch(url, options);
      };
      window.open = () => null;
      window.scrollTo = () => {};
    },
  });
  await waitFor(() => dom.window.document.readyState === 'complete', `${path} load`);
  await waitFor(
    () => dom.window.document.querySelector('[data-temple-status] b')?.textContent !== 'loading…',
    `${path} saved data`,
  );
  if (path === 'hiscores.html') {
    await waitFor(() => dom.window.document.querySelectorAll('#currentSkillsTable thead th').length > 1, 'Hiscores module');
  }
  if (path === 'progress.html') {
    await waitFor(() => dom.window.document.querySelectorAll('#skillGainTable thead th').length > 1, 'Progress module');
  }
  if (path === 'gim.html') {
    await waitFor(() => dom.window.document.querySelector('#clogMemberPicker fieldset'), 'Collection Log module');
  }
  if (path === 'chronicle.html') {
    await waitFor(
      () => dom.window.document.querySelectorAll('.chronicle-event').length > 0
        && dom.window.document.querySelector('#chroniclePagerTop [data-chrono-size="all"]')
        && /of \d[\d,]* events/.test(dom.window.document.querySelector('#chronicleMeta')?.textContent || ''),
      'paginated Chronicle render',
      30_000,
    );
  }
  await sleep(1_000);
  return { dom, errors };
}

function checked(document, host = 'statsMemberPicker') {
  return [...document.querySelectorAll(`#${host} input[type="checkbox"]`)]
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function click(window, element) {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

function expectedLevelKeys() {
  const wom = JSON.parse(fs.readFileSync('docs/data/wom-cache.json', 'utf8'));
  const keys = new Set();
  for (const player of ALL) {
    const rows = [...(wom.snapshots?.[player] || [])]
      .filter((row) => row?.createdAt && row?.data)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const latest = wom.profiles?.[player]?.latestSnapshot;
    if (latest?.createdAt && !rows.some((row) => row.id && row.id === latest.id)) rows.push(latest);
    for (let index = 1; index < rows.length; index += 1) {
      const before = rows[index - 1].data?.skills || {};
      const after = rows[index].data?.skills || {};
      for (const [skill, value] of Object.entries(after)) {
        if (skill === 'overall') continue;
        const a = Number(before[skill]?.level);
        const b = Number(value?.level);
        if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b <= a || b > 126) continue;
        for (let level = a + 1; level <= b; level += 1) keys.add(`${player}|${skill}|${level}`);
      }
    }
    for (const achievement of wom.achievements?.[player] || []) {
      const match = String(achievement.name || '').match(/^(\d{1,3})\s+/);
      const level = match ? Number(match[1]) : null;
      if (achievement.measure === 'experience' && achievement.metric !== 'overall' && level >= 2 && level <= 126) {
        keys.add(`${player}|${achievement.metric}|${level}`);
      }
    }
  }
  return keys;
}

function womRefreshFixture() {
  const saved = JSON.parse(fs.readFileSync('docs/data/wom-cache.json', 'utf8'));
  const next = structuredClone(saved);
  const key = 'big dog aura';
  const profile = next.profiles[key];
  const snapshot = structuredClone(profile.latestSnapshot);
  const previousLevel = snapshot.data.skills.thieving.level;
  snapshot.id = -1;
  snapshot.createdAt = new Date(Date.now()+60000).toISOString();
  snapshot.data.skills.thieving.level = previousLevel + 2;
  snapshot.data.skills.thieving.experience += 500_000;
  snapshot.data.skills.overall.level += 2;
  snapshot.data.skills.overall.experience += 500_000;
  profile.latestSnapshot = snapshot;
  return next;
}

async function testShells() {
  for (const page of PAGES) {
    console.log('shell', page);
    const { dom, errors } = await openPage(page);
    const { document } = dom.window;
    const button = document.querySelector('[data-refresh-temple]');
    assert(button, `${page} has Temple update button`);
    assert.equal(button.tagName, 'BUTTON', `${page} Temple control is a button`);
    assert.equal(button.textContent.trim(), 'Update Collection Log via Temple');
    assert.equal(button.getAttribute('href'), null);
    const style = dom.window.getComputedStyle(button);
    assert.equal(style.display, 'inline-flex');
    assert.equal(style.alignItems, 'center');
    assert.equal(style.justifyContent, 'center');
    assert.equal(errors.length, 0, `${page} console errors: ${errors.join('; ')}`);
  }
}

async function testHiscoresFilterAndModal() {
  console.log('interaction hiscores');
  const { dom, errors } = await openPage('hiscores.html');
  const { window } = dom;
  const { document } = window;
  await waitFor(() => document.querySelectorAll('#currentSkillsTable thead th').length === 6, 'five-member Hiscores');
  assert.deepEqual(checked(document), ALL);

  click(window, document.querySelector('#statsMemberPicker input[value="poep aura"]'));
  click(window, document.querySelector('#statsMemberPicker input[value="lompste"]'));
  await waitFor(() => document.querySelectorAll('#currentSkillsTable thead th').length === 4, 'three-member Hiscores');
  assert.deepEqual(checked(document), ALL.slice(0, 3));
  assert.deepEqual(JSON.parse(window.localStorage.getItem(MEMBER_KEY)), ALL.slice(0, 3));

  click(window, document.querySelector('[data-v21-skill]'));
  await waitFor(() => document.querySelector('#v21MetricModal')?.getAttribute('aria-hidden') === 'false', 'skill modal');
  assert.equal(document.querySelectorAll('#v21ModalMembers input').length, 0, 'modal has no conflicting member filter');
  assert.match(document.querySelector('#v21ModalMembers').textContent, /Dikste, Big Dog Aura, Lijpste/);
  assert.doesNotMatch(document.querySelector('#v21ModalMembers').textContent, /Poep Aura|Lompste/);
  assert(document.querySelector('#v21ModalChart svg'));
  assert.equal(errors.length, 0, errors.join('; '));
}

async function testSharedSelectionEverywhere() {
  console.log('shared selection');
  const selection = ['dikste', 'poep aura'];
  for (const page of ['index.html', 'progress.html', 'history.html', 'gim.html']) {
    const { dom, errors } = await openPage(page, { selection });
    const { document } = dom.window;
    const picker = page === 'gim.html' ? 'clogMemberPicker' : 'statsMemberPicker';
    await waitFor(() => document.querySelector(`#${picker} fieldset`), `${page} shared picker`);
    assert.deepEqual(checked(document, picker), selection);
    if (page === 'index.html') {
      await waitFor(() => document.querySelectorAll('#standingTable thead th').length === 3, 'selected overview table');
    } else if (page === 'progress.html') {
      await waitFor(() => document.querySelectorAll('#skillGainTable thead th').length === 3, 'selected progress table');
    } else if (page === 'history.html') {
      await waitFor(() => document.querySelectorAll('#historyCoverage .kpi').length === 2, 'selected history coverage');
      assert.equal(document.querySelectorAll('#activityEras .era-lane').length, 2);
    } else {
      await waitFor(() => document.querySelectorAll('#clogItemTable thead th').length === 6, 'selected Collection Log table');
    }
    assert.equal(errors.length, 0, errors.join('; '));
  }

  const { dom, errors } = await openPage('time-machine.html', { selection });
  const { window } = dom;
  const { document } = window;
  await waitFor(() => document.querySelector('#statsMemberPicker fieldset'), 'Time Machine shared picker');
  document.querySelector('#timeDate').value = '2026-01-01';
  click(window, document.querySelector('#timeGo'));
  await waitFor(() => document.querySelectorAll('#timeStanding thead th').length === 3, 'selected Time Machine table');
  assert.deepEqual(checked(document), selection);
  assert.equal(errors.length, 0, errors.join('; '));
}

async function testChronicleLevelsAndFilter() {
  console.log('chronicle levels');
  const expected = expectedLevelKeys();
  const { dom, errors } = await openPage('chronicle.html');
  const { window } = dom;
  const { document } = window;
  await waitFor(() => document.querySelector('[data-chrono-filter="all"]')?.classList.contains('active'), 'All events default');
  assert(document.querySelectorAll('.chronicle-event').length <= 100, 'Chronicle defaults to the 100-event paginated view');
  click(window, document.querySelector('[data-chrono-size="all"]'));
  await waitFor(
    () => document.querySelector('[data-chrono-size="all"]')?.classList.contains('active')
      && document.querySelectorAll('.chronicle-event[data-event-type="level"]').length === expected.size,
    'all WOM level events after Show All',
    30_000,
  );
  const actual = new Set(
    [...document.querySelectorAll('.chronicle-event[data-event-type="level"]')]
      .map((event) => `${event.dataset.playerKey}|${event.dataset.metric}|${event.dataset.level}`),
  );
  assert.deepEqual(actual, expected, 'Chronicle contains every inferred and official skill level exactly once');
  assert.match(document.querySelector('#chronicleMeta').textContent, /events shown · all at once/);
  assert.deepEqual(checked(document, 'chronicleMemberPicker'), ALL);

  click(window, document.querySelector('#chronicleMemberPicker input[value="big dog aura"]'));
  await waitFor(
    () => ![...document.querySelectorAll('.chronicle-event')].some((event) => event.dataset.playerKey === 'big dog aura'),
    'Chronicle member removal',
  );
  assert(!document.querySelector('#chronicleGoals .goal-card:nth-child(5)') || document.querySelectorAll('#chronicleGoals .goal-card').length === 4);
  assert.equal(errors.length, 0, errors.join('; '));
}

async function testWomRefreshUpdatesChronicleAndPersists() {
  console.log('WOM refresh propagation');
  const womResponse = womRefreshFixture();
  const targetLevel = womResponse.profiles['big dog aura'].latestSnapshot.data.skills.thieving.level;
  const targetDate = womResponse.profiles['big dog aura'].latestSnapshot.createdAt;
  const first = await openPage('chronicle.html', { womResponse });
  const { window } = first.dom;
  const { document } = window;
  click(window, document.querySelector('[data-refresh-wom]'));
  await waitFor(
    () => document.querySelector('#pageNotice')?.textContent.includes('2 new level events added to Chronicle'),
    'WOM refresh and Chronicle derivation',
    30_000,
  );
  await waitFor(
    () => document.querySelector('.chronicle-event[data-player-key="big dog aura"][data-metric="thieving"][data-level="' + targetLevel + '"]'),
    'new Thieving level in current Chronicle',
  );
  assert(document.querySelector('.chronicle-event[data-player-key="big dog aura"][data-metric="thieving"][data-level="' + (targetLevel-1) + '"]'));
  const stored = JSON.parse(window.localStorage.getItem('ug-v20-wom-cache'));
  const newRows = stored.snapshots['big dog aura'].filter((row) => row.createdAt === targetDate);
  assert.equal(newRows.length, 1, 'new WOM snapshot is persisted exactly once even with sentinel id -1');
  assert.match(document.querySelector('[data-wom-status] b').textContent, /2026/);
  assert.equal(first.errors.length, 0, first.errors.join('; '));

  const second = await openPage('chronicle.html', { womDocument: stored });
  await waitFor(
    () => second.dom.window.document.querySelector('.chronicle-event[data-player-key="big dog aura"][data-metric="thieving"][data-level="' + targetLevel + '"]'),
    'persisted Thieving level after navigation',
  );
  assert(second.dom.window.document.querySelector('.chronicle-event[data-player-key="big dog aura"][data-metric="thieving"][data-level="' + (targetLevel-1) + '"]'));
  assert.match(second.dom.window.document.querySelector('[data-wom-status] b').textContent, /2026/);
  assert.equal(second.errors.length, 0, second.errors.join('; '));
}

async function testTempleButtonAction() {
  console.log('Temple button');
  const previousTemple = JSON.parse(fs.readFileSync('docs/data/temple-clog.json', 'utf8'));
  const dateUnix = Math.floor(Date.now() / 1000);
  const templeResponse = {
    fetchedAt: Date.now(),
    players: Object.fromEntries(ALL.map((key, index) => {
      const oldData = previousTemple.players?.[key]?.data || previousTemple.players?.[key] || {};
      return [key, { data: {
        items: { General: [{ id: 700_001 + index, name: `Recovered ${key} item`, count: 1, date: dateUnix }] },
        total_collections_finished: Number(oldData.total_collections_finished || 0) + 1,
        last_checked: dateUnix,
        last_changed: dateUnix,
      } }];
    })),
    catalog: Object.fromEntries(ALL.map((key, index) => [700_001 + index, `Recovered ${key} item`])),
    categories: { General: ALL.map((key, index) => 700_001 + index) },
    recent: [
      { id: 700_001, name: 'Recovered dikste item', date_unix: dateUnix, player: 'Dikste' },
      { Code: 403, Message: 'No new items after initial sync', player: 'Lijpste' },
    ],
    refreshDiagnostics: { freshPlayers: ALL, failedPlayers: [], recentPlayers: ALL },
  };
  const { dom, errors } = await openPage('gim.html', { templeResponse });
  const { window } = dom;
  const { document } = window;
  const before = window.location.href;
  click(window, document.querySelector('[data-refresh-temple]'));
  await waitFor(() => document.querySelector('#pageNotice')?.textContent.includes('updated from Temple for 5/5'), 'Temple button completion');
  assert.equal(window.location.href, before, 'Temple update stays on the site');
  const saved = JSON.parse(window.localStorage.getItem('ug-v20-temple-cache'));
  assert.equal(saved.source, 'TempleOSRS manual site update');
  assert.equal(Object.keys(saved.players).length, 5);
  assert(saved.recent.some((row) => row.name === 'Recovered lijpste item' && row.player === 'Lijpste'), 'full Collection Log recovers a missing recent-feed item');
  assert(!saved.recent.some((row) => row.Code || !row.id || !row.name), 'Temple error objects are removed');
  await waitFor(() => document.querySelector('#recentDrops')?.textContent.includes('Recovered lijpste item'), 'Collection Log recent view redraw');
  assert(!document.querySelector('#recentDrops').textContent.includes('undefined'));
  assert.equal(errors.length, 0, errors.join('; '));

  const partialResponse = {
    ...templeResponse,
    players: Object.fromEntries(ALL.slice(0, 4).map((key) => [key, templeResponse.players[key]])),
    refreshDiagnostics: { freshPlayers: ALL.slice(0, 4), failedPlayers: ['lompste'], recentPlayers: ALL.slice(0, 4) },
  };
  const partial = await openPage('gim.html', { templeResponse: partialResponse });
  click(partial.dom.window, partial.dom.window.document.querySelector('[data-refresh-temple]'));
  await waitFor(
    () => partial.dom.window.document.querySelector('#pageNotice')?.textContent.includes('saved data retained for Lompste'),
    'accurate partial Temple result',
  );
  assert.equal(partial.errors.length, 0, partial.errors.join('; '));
}

if (require.main === module) (async () => {
  await testShells();
  await testHiscoresFilterAndModal();
  await testSharedSelectionEverywhere();
  await testChronicleLevelsAndFilter();
  await testWomRefreshUpdatesChronicleAndPersists();
  await testTempleButtonAction();
  console.log('V25 JSDOM INTERACTION AUDIT PASSED');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

module.exports={openPage,waitFor,click};
