#!/usr/bin/env python3
import json, time, urllib.parse, urllib.request
from datetime import datetime
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



def normalized_metric_key(value):
    return ''.join(ch for ch in str(value or '').lower() if ch.isalnum())


def extract_boss_kc(payload):
    if not isinstance(payload, dict) or payload.get('error') or payload.get('errors'):
        return {}
    data = payload.get('data', payload)
    if not isinstance(data, dict):
        return {}
    wanted = {
        'demonicgorilla': 'demonic_gorilla',
        'demonicgorillas': 'demonic_gorilla',
        'torturedgorilla': 'tortured_gorilla',
        'torturedgorillas': 'tortured_gorilla',
    }
    out = {}
    for raw_key, raw_value in data.items():
        key = wanted.get(normalized_metric_key(raw_key))
        if not key:
            continue
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        if value >= 0:
            out[key] = int(value) if value.is_integer() else value
    return out


def recent_time(row):
    try:
        value = float(row.get('date_unix') or row.get('date') or 0)
    except Exception:
        value = 0
    if value:
        return value / 1000 if value > 1e12 else value
    raw = row.get('date')
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace('Z', '+00:00')).timestamp()
        except Exception:
            pass
    return 0


def normalize_recent(row, player=''):
    if not isinstance(row, dict) or row.get('Code') or row.get('code') or row.get('error') or row.get('errors'):
        return None
    try:
        item_id = int(row.get('id') or row.get('item_id') or 0)
    except Exception:
        item_id = 0
    item_name = str(row.get('name') or row.get('item_name') or '').strip()
    owner = str(row.get('player_name_with_capitalization') or row.get('player') or player).strip()
    when = recent_time(row)
    if item_id <= 0 or not item_name or not owner or when <= 0:
        return None
    out = dict(row)
    out.update({'id': item_id, 'name': item_name, 'player': owner, 'player_name_with_capitalization': owner, 'date_unix': int(when), 'date': datetime.fromtimestamp(when).strftime('%Y-%m-%d %H:%M:%S')})
    return out


def recent_key(row):
    return str(row.get('player_name_with_capitalization') or row.get('player') or '').lower(), int(row['id']), int(row['date_unix'])


def log_items(log):
    if not valid_temple(log):
        return {}
    data = log.get('data', log)
    found = {}

    def walk(node):
        if isinstance(node, list):
            for value in node:
                walk(value)
            return
        if not isinstance(node, dict):
            return
        try:
            item_id = int(node.get('id') or node.get('item_id') or 0)
        except Exception:
            item_id = 0
        if item_id > 0:
            try:
                count = max(0, int(node.get('count') or node.get('quantity') or 0))
            except Exception:
                count = 0
            item = {'id': item_id, 'count': count, 'time': recent_time(node), 'name': str(node.get('name') or node.get('item_name') or '').strip()}
            old = found.get(item_id)
            if not old or item['count'] > old['count'] or item['time'] > old['time']:
                found[item_id] = item
            return
        for value in node.values():
            walk(value)

    walk(data.get('items') or {})
    return found


def derived_recent_rows(current, previous):
    rows = []
    cutoff = float(previous.get('fetchedAt') or 0) / 1000
    previous_players = previous.get('players') or {}
    for key, name in PLAYERS.items():
        if not valid_temple(current.get(key)) or not valid_temple(previous_players.get(key)):
            continue
        before = log_items(previous_players[key])
        for item in log_items(current[key]).values():
            old = before.get(item['id']) or {}
            new_unique = int(old.get('count') or 0) == 0 and item['count'] > 0
            newer_drop = item['time'] > max(float(old.get('time') or 0), cutoff)
            if item['count'] <= 0 or item['time'] <= 0 or not item['name'] or not (new_unique or newer_drop):
                continue
            row = normalize_recent({'id': item['id'], 'name': item['name'], 'date_unix': int(item['time']), 'player': name, 'source': 'full Temple Collection Log'}, name)
            if row:
                rows.append(row)
    return rows

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



def latest_snapshot_millis(current_profiles):
    values = []
    for profile in current_profiles.values():
        snapshot = profile.get('latestSnapshot') if isinstance(profile, dict) else None
        created = snapshot.get('createdAt') if isinstance(snapshot, dict) else None
        if not created:
            continue
        try:
            values.append(int(datetime.fromisoformat(str(created).replace('Z', '+00:00')).timestamp() * 1000))
        except Exception:
            pass
    return max(values or [0])

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
            updated = get('https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name), method='POST', data=b'{}', attempts=2, delay=3.2)
            print('WOM update requested:', name)
        except Exception as e:
            updated = None
            print('WOM update warning:', name, repr(e))
        if isinstance(updated, dict) and isinstance(updated.get('latestSnapshot'), dict):
            profiles[key] = updated
        else:
            profiles[key] = get('https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name), attempts=4, delay=3.2)
        print('WOM profile:', name)
    except Exception as e:
        print('WOM profile failed; preserving last known good:', name, repr(e))

# Save gains for all five so XP & Progress can graph/compare any member.
for period in ('week', 'month', 'year'):
    for key, name in PLAYERS.items():
        try:
            gains[period][key] = get(
                'https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name) + '/gained?period=' + period,
                attempts=3, delay=3.2
            )
            print('WOM gain:', name, period)
        except Exception as e:
            print('WOM gain failed; preserving previous:', name, period, repr(e))

# Chronicle source: WOM achievements for all five.
for key, name in PLAYERS.items():
    try:
        a = get('https://api.wiseoldman.net/v2/players/' + urllib.parse.quote(name) + '/achievements', attempts=3, delay=3.2)
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
    'sourceLatestAt': latest_snapshot_millis(profiles),
    'profiles': profiles,
    'gains': gains,
    'achievements': achievements,
    'snapshots': snapshots,
    'snapshotCounts': {k: len(v or []) for k, v in snapshots.items()},
    'historyMode': 'all available WOM snapshots; persisted in repository on manual refresh',
}

# Collection Log via Temple: attempt every member. Invalid/missing means unknown, never zero.
temple = {k: v for k, v in dict(oldt.get('players') or {}).items() if k in PLAYERS and valid_temple(v)}
boss_kc = {k: dict(v or {}) for k, v in dict(oldt.get('bossKc') or {}).items() if k in PLAYERS}
boss_kc_players = []
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
        stats_q = urllib.parse.urlencode({'player': name, 'bosses': '1'})
        stats = get('https://templeosrs.com/api/player_stats.php?' + stats_q, attempts=3, delay=.8)
        extracted = extract_boss_kc(stats)
        if extracted:
            boss_kc[key] = {**boss_kc.get(key, {}), **extracted}
            boss_kc_players.append(key)
            print('Temple boss KC:', name, extracted)
        else:
            print('Temple boss KC unavailable; preserving prior values if present:', name)
    except Exception as e:
        print('Temple boss KC failed; preserving prior values if present:', name, repr(e))

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

recent_map = {}
for raw in list(oldt.get('recent') or []):
    row = normalize_recent(raw)
    if row:
        recent_map[recent_key(row)] = row
for key, name in PLAYERS.items():
    if not valid_temple(temple.get(key)):
        print('Collection Log recent unlocks skipped; not synced:', name)
        continue
    q = urllib.parse.urlencode({'player': name, 'count': 100})
    try:
        p = get('https://templeosrs.com/api/collection-log/player_recent_items.php?' + q, attempts=3, delay=.8)
        d = p.get('data', p) if isinstance(p, dict) else p
        rows = list(d.values()) if isinstance(d, dict) else (d if isinstance(d, list) else [])
        for raw in rows:
            row = normalize_recent(raw, name)
            if row:
                recent_map[recent_key(row)] = row
        print('Collection Log recent unlocks:', name, len(rows))
    except Exception as e:
        print('Collection Log recent unlocks failed:', name, repr(e))

derived_recent = derived_recent_rows(temple, oldt)
for row in derived_recent:
    recent_map[recent_key(row)] = row
recent = sorted(recent_map.values(), key=recent_time, reverse=True)

synced_names = {PLAYERS[k].lower() for k in PLAYERS if valid_temple(temple.get(k))}
recent = [r for r in recent if str(r.get('player_name_with_capitalization') or r.get('player') or '').lower() in synced_names]

temple_doc = {
    'source': 'Collection Log via TempleOSRS',
    'fetchedAt': int(time.time() * 1000),
    'players': temple,
    'bossKc': boss_kc,
    'catalog': catalog,
    'categories': categories,
    'recent': recent[:300],
    'membersWithClog': sum(1 for k in PLAYERS if valid_temple(temple.get(k))),
    'groupSize': 5,
    'refreshDiagnostics': {'derivedRecentItems': len(derived_recent), 'bossKcPlayers': boss_kc_players},
}

(ROOT / 'wom-cache.json').write_text(json.dumps(wom_doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
(ROOT / 'temple-clog.json').write_text(json.dumps(temple_doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print('WOM profiles:', sorted(profiles))
print('WOM snapshot counts:', {k: len(v or []) for k, v in snapshots.items()})
print('Collection Logs synced:', [PLAYERS[k] for k in PLAYERS if valid_temple(temple.get(k))])
