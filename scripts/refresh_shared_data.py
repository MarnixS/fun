#!/usr/bin/env python3
import json, time, urllib.parse, urllib.request
from urllib.error import HTTPError
from pathlib import Path

ROOT = Path('docs/data')
ROOT.mkdir(parents=True, exist_ok=True)
PLAYERS = {
    'dikste': 'Dikste',
    'big dog aura': 'Big Dog Aura',
    'lijpste': 'Lijpste',
    'poep aura': 'Poep Aura',
    'lompste': 'Lompste',
}
UA = 'United-Gimps-Collection-Log/21.0 (github.com/MarnixS/fun)'


def get(url, method='GET', data=None, attempts=5, delay=0.0):
    err = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(
                url, method=method, data=data,
                headers={'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA}
            )
            with urllib.request.urlopen(req, timeout=45) as r:
                out = json.load(r)
            if delay:
                time.sleep(delay)
            return out
        except HTTPError as e:
            err = e
            if i == attempts - 1:
                raise
            try:
                retry = float(e.headers.get('Retry-After') or 0)
            except Exception:
                retry = 0
            wait = max(retry, min(45, (8 if e.code == 429 else 2) * (i + 1)))
            print(f'HTTP {e.code}, retry in {wait:.1f}s: {url.split("?")[0]}')
            time.sleep(wait)
        except Exception as e:
            err = e
            if i == attempts - 1:
                raise
            time.sleep(min(30, 2 ** i))
    raise err


def load(name):
    try:
        return json.loads((ROOT / name).read_text(encoding='utf-8'))
    except Exception:
        return {}


def valid_temple(x):
    if not isinstance(x, dict) or x.get('error') or x.get('errors'):
        return False
    d = x.get('data', x)
    return isinstance(d, dict) and isinstance(d.get('items'), (list, dict))


def merge_snapshots(old, new):
    """Merge WOM snapshots by timestamp.

    WOM can return the sentinel id -1 on many historical snapshots, so id is
    not a safe deduplication key. createdAt is the stable identity we need for
    chart/history purposes.
    """
    by = {}
    for s in list(old or []) + list(new or []):
        if not isinstance(s, dict) or not s.get('createdAt') or not s.get('data'):
            continue
        key = str(s['createdAt'])
        by[key] = s
    arr = list(by.values())
    arr.sort(key=lambda x: str(x.get('createdAt') or ''))
    return arr


def fetch_all_snapshots(name):
    """Fetch every WOM snapshot available for a player, respecting pagination."""
    out, offset, limit = [], 0, 50
    while True:
        q = urllib.parse.urlencode({'limit': limit, 'offset': offset})
        batch = get(
            'https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name) + '/snapshots?' + q,
            attempts=4, delay=3.2
        )
        if not isinstance(batch, list) or not batch:
            break
        out.extend(batch)
        print('WOM snapshot page:', name, offset, len(batch))
        if len(batch) < limit:
            break
        offset += limit
        if offset > 20000:
            raise RuntimeError(f'WOM snapshot pagination safety limit reached for {name}')
    return out


oldw = load('wom-cache.json')
oldt = load('temple-clog.json')
profiles = {k: v for k, v in dict(oldw.get('profiles') or oldw.get('players') or {}).items() if k in PLAYERS}
gains = {p: {k: v for k, v in dict((oldw.get('gains') or {}).get(p) or {}).items() if k in PLAYERS} for p in ('week', 'month', 'year')}
achievements = {k: v for k, v in dict(oldw.get('achievements') or {}).items() if k in PLAYERS}
snapshots = {k: list(v or []) for k, v in dict(oldw.get('snapshots') or oldw.get('history') or {}).items() if k in PLAYERS}

# WOM is refreshed only when this manual workflow is explicitly run.
for key, name in PLAYERS.items():
    try:
        try:
            get('https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name), method='POST', data=b'{}', attempts=2, delay=1.2)
            print('WOM update requested:', name)
        except Exception as e:
            print('WOM update warning:', name, repr(e))
        profiles[key] = get('https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name), attempts=4, delay=1.2)
        print('WOM profile:', name)
    except Exception as e:
        print('WOM profile failed; preserving last known good:', name, repr(e))

# Save gains for all five so XP & Progress can graph/compare any member.
for period in ('week', 'month', 'year'):
    for key, name in PLAYERS.items():
        try:
            gains[period][key] = get(
                'https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name) + '/gained?period=' + period,
                attempts=3, delay=1.2
            )
            print('WOM gain:', name, period)
        except Exception as e:
            print('WOM gain failed; preserving previous:', name, period, repr(e))

# Chronicle source: WOM achievements for all five.
for key, name in PLAYERS.items():
    try:
        a = get('https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name) + '/achievements', attempts=3, delay=1.2)
        if isinstance(a, list):
            achievements[key] = a
            print('WOM achievements:', name, len(a))
    except Exception as e:
        print('WOM achievements failed; preserving previous:', name, repr(e))

# Backfill and persist ALL WOM snapshots. Opening the website never performs this backfill.
for key, name in PLAYERS.items():
    try:
        all_remote = fetch_all_snapshots(name)
        snapshots[key] = merge_snapshots(snapshots.get(key), all_remote)
        latest = profiles.get(key, {}).get('latestSnapshot') if isinstance(profiles.get(key), dict) else None
        snapshots[key] = merge_snapshots(snapshots[key], [latest] if latest else [])
        print('WOM snapshots stored:', name, len(snapshots[key]))
    except Exception as e:
        print('WOM full snapshot history failed; preserving previous:', name, repr(e))

wom_doc = {
    'source': 'Wise Old Man',
    'fetchedAt': int(time.time() * 1000),
    'profiles': profiles,
    'gains': gains,
    'achievements': achievements,
    'snapshots': snapshots,
    'snapshotCounts': {k: len(v or []) for k, v in snapshots.items()},
    'historyMode': 'all available WOM snapshots; persisted in repository on manual refresh',
}

# Collection Log via Temple: attempt every member. Invalid/missing means unknown, never zero.
temple = {k: v for k, v in dict(oldt.get('players') or {}).items() if k in PLAYERS and valid_temple(v)}
for key, name in PLAYERS.items():
    q = urllib.parse.urlencode({
        'player': name,
        'categories': 'all',
        'includenames': '1',
        'includemissingitems': '1',
        'onlyitems': '0',
        'dateformat': 'unix',
    })
    try:
        payload = get('https://templeosrs.com/api/collection-log/player_collection_log.php?' + q, attempts=5, delay=1.4)
        if valid_temple(payload):
            temple[key] = payload
            print('Collection Log via Temple:', name)
        else:
            print('No valid Collection Log via Temple; preserving prior valid log if present:', name)
    except Exception as e:
        print('Collection Log via Temple failed; preserving last known good:', name, repr(e))

try:
    cp = get('https://templeosrs.com/api/collection-log/items.php', attempts=4, delay=1.0)
    catalog = cp.get('data', cp) if isinstance(cp, dict) else cp
    if not isinstance(catalog, (list, dict)) or not catalog:
        raise ValueError('empty Collection Log item list')
except Exception as e:
    print('Collection Log item list failed; preserving previous:', repr(e))
    catalog = oldt.get('catalog') or oldt.get('catalogue') or []

try:
    categories = get('https://templeosrs.com/api/collection-log/categories.php', attempts=4, delay=1.0)
    if not isinstance(categories, (list, dict)) or not categories:
        raise ValueError('empty Collection Log categories')
except Exception as e:
    print('Collection Log categories failed; preserving previous:', repr(e))
    categories = oldt.get('categories') or {}

recent = []
for key, name in PLAYERS.items():
    if not valid_temple(temple.get(key)):
        print('Collection Log recent unlocks skipped; not synced:', name)
        continue
    q = urllib.parse.urlencode({'player': name, 'count': 100})
    try:
        p = get('https://templeosrs.com/api/collection-log/player_recent_items.php?' + q, attempts=3, delay=.8)
        d = p.get('data', p) if isinstance(p, dict) else p
        rows = list(d.values()) if isinstance(d, dict) else (d if isinstance(d, list) else [])
        for row in rows:
            if isinstance(row, dict):
                z = dict(row)
                z.setdefault('player', name)
                z.setdefault('player_name_with_capitalization', name)
                recent.append(z)
        print('Collection Log recent unlocks:', name, len(rows))
    except Exception as e:
        print('Collection Log recent unlocks failed:', name, repr(e))


def rtime(x):
    try:
        return int(x.get('date_unix') or 0)
    except Exception:
        return 0

if recent:
    recent.sort(key=rtime, reverse=True)
else:
    recent = list(oldt.get('recent') or [])

synced_names = {PLAYERS[k].lower() for k in PLAYERS if valid_temple(temple.get(k))}
recent = [r for r in recent if str(r.get('player_name_with_capitalization') or r.get('player') or '').lower() in synced_names]

temple_doc = {
    'source': 'Collection Log via TempleOSRS',
    'fetchedAt': int(time.time() * 1000),
    'players': temple,
    'catalog': catalog,
    'categories': categories,
    'recent': recent[:300],
    'membersWithClog': sum(1 for k in PLAYERS if valid_temple(temple.get(k))),
    'groupSize': 5,
}

(ROOT / 'wom-cache.json').write_text(json.dumps(wom_doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
(ROOT / 'temple-clog.json').write_text(json.dumps(temple_doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print('WOM profiles:', sorted(profiles))
print('WOM snapshot counts:', {k: len(v or []) for k, v in snapshots.items()})
print('Collection Logs synced:', [PLAYERS[k] for k in PLAYERS if valid_temple(temple.get(k))])
