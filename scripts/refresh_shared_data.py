#!/usr/bin/env python3
import json, time, urllib.parse, urllib.request
from urllib.error import HTTPError
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path('docs/data')
ROOT.mkdir(parents=True, exist_ok=True)
PLAYERS = {
    'dikste': 'Dikste',
    'big dog aura': 'Big Dog Aura',
    'lijpste': 'Lijpste',
    'poep aura': 'Poep Aura',
    'lompste': 'Lompste',
}
CORE = ['dikste', 'big dog aura', 'lijpste']
UA = 'United-Gimps-Group-Ironman-Tracker/20.0 (github.com/MarnixS/fun)'


def get(url, method='GET', data=None, attempts=5, delay=0.0):
    err = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(
                url, method=method, data=data,
                headers={'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA}
            )
            with urllib.request.urlopen(req, timeout=40) as r:
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
            wait = max(retry, min(35, (8 if e.code == 429 else 2) * (i + 1)))
            print(f'HTTP {e.code}, retry in {wait:.1f}s: {url.split("?")[0]}')
            time.sleep(wait)
        except Exception as e:
            err = e
            if i == attempts - 1:
                raise
            time.sleep(min(25, 2 ** i))
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
    by = {}
    for s in list(old or []) + list(new or []):
        if not isinstance(s, dict) or not s.get('createdAt'):
            continue
        key = str(s.get('id') or s.get('createdAt'))
        by[key] = s
    arr = list(by.values())
    arr.sort(key=lambda x: str(x.get('createdAt') or ''))
    return arr[-120:]


oldw = load('wom-cache.json')
oldt = load('temple-clog.json')
profiles = {k: v for k, v in dict(oldw.get('profiles') or oldw.get('players') or {}).items() if k in PLAYERS}
gains = {p: {k: v for k, v in dict((oldw.get('gains') or {}).get(p) or {}).items() if k in CORE} for p in ('week', 'month', 'year')}
achievements = {k: v for k, v in dict(oldw.get('achievements') or {}).items() if k in PLAYERS}
snapshots = {k: v for k, v in dict(oldw.get('snapshots') or oldw.get('history') or {}).items() if k in PLAYERS}

# WOM: only this explicitly triggered workflow asks for fresh community data.
for key, name in PLAYERS.items():
    try:
        try:
            get('https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name), method='POST', data=b'{}', attempts=2, delay=1.1)
            print('WOM update requested:', name)
        except Exception as e:
            print('WOM update warning:', name, repr(e))
        profiles[key] = get('https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name), attempts=4, delay=1.1)
        print('WOM profile:', name)
    except Exception as e:
        print('WOM profile failed; preserving last known good:', name, repr(e))

for period in ('week', 'month', 'year'):
    for key in CORE:
        name = PLAYERS[key]
        try:
            gains[period][key] = get(
                'https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name) + '/gained?period=' + period,
                attempts=3, delay=1.1
            )
            print('WOM gain:', name, period)
        except Exception as e:
            print('WOM gain failed; preserving previous:', name, period, repr(e))

# Chronicle source: WOM achievements for all five.
for key, name in PLAYERS.items():
    try:
        a = get('https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name) + '/achievements', attempts=3, delay=1.0)
        if isinstance(a, list):
            achievements[key] = a
            print('WOM achievements:', name, len(a))
    except Exception as e:
        print('WOM achievements failed; preserving previous:', name, repr(e))

# Saved Time Machine / Activity Eras history. Keep previous points and merge the latest two years.
end = datetime.now(timezone.utc)
start = end - timedelta(days=730)
for key, name in PLAYERS.items():
    q = urllib.parse.urlencode({
        'startDate': start.isoformat().replace('+00:00', 'Z'),
        'endDate': end.isoformat().replace('+00:00', 'Z'),
        'limit': 50,
        'offset': 0,
    })
    try:
        s = get('https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name) + '/snapshots?' + q, attempts=3, delay=1.1)
        if isinstance(s, list):
            snapshots[key] = merge_snapshots(snapshots.get(key), s)
            print('WOM snapshots:', name, len(snapshots[key]))
    except Exception as e:
        print('WOM snapshots failed; preserving previous:', name, repr(e))

wom_doc = {
    'source': 'Wise Old Man',
    'fetchedAt': int(time.time() * 1000),
    'profiles': profiles,
    'gains': gains,
    'achievements': achievements,
    'snapshots': snapshots,
}

# Temple: attempt every member. Invalid/missing means unknown, never zero.
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
            print('Temple Collection Log:', name)
        else:
            print('Temple has no valid synced log; preserving prior valid log if present:', name)
            if key in temple and not valid_temple(temple[key]):
                temple.pop(key, None)
    except Exception as e:
        print('Temple Collection Log failed; preserving last known good:', name, repr(e))

try:
    cp = get('https://templeosrs.com/api/collection-log/items.php', attempts=4, delay=1.0)
    catalog = cp.get('data', cp) if isinstance(cp, dict) else cp
    if not isinstance(catalog, (list, dict)) or not catalog:
        raise ValueError('empty catalog')
except Exception as e:
    print('Temple item catalogue failed; preserving previous:', repr(e))
    catalog = oldt.get('catalog') or oldt.get('catalogue') or []

try:
    categories = get('https://templeosrs.com/api/collection-log/categories.php', attempts=4, delay=1.0)
    if not isinstance(categories, (list, dict)) or not categories:
        raise ValueError('empty categories')
except Exception as e:
    print('Temple categories failed; preserving previous:', repr(e))
    categories = oldt.get('categories') or {}

recent = []
for key, name in PLAYERS.items():
    if not valid_temple(temple.get(key)):
        print('Temple recent skipped; no synced Collection Log:', name)
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
        print('Temple recent:', name, len(rows))
    except Exception as e:
        print('Temple recent failed:', name, repr(e))


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
    'source': 'TempleOSRS',
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
print('WOM snapshot members:', {k: len(v or []) for k, v in snapshots.items()})
print('Temple synced:', [PLAYERS[k] for k in PLAYERS if valid_temple(temple.get(k))])
