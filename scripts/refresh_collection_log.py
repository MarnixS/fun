#!/usr/bin/env python3
import json, time, urllib.parse, urllib.request
from datetime import datetime
from urllib.error import HTTPError
from pathlib import Path

ROOT = Path('docs/data')
ROOT.mkdir(parents=True, exist_ok=True)
OUT = ROOT / 'temple-clog.json'
PLAYERS = {
    'dikste': 'Dikste',
    'big dog aura': 'Big Dog Aura',
    'lijpste': 'Lijpste',
    'poep aura': 'Poep Aura',
    'lompste': 'Lompste',
}
UA = 'United-Gimps-Collection-Log/24.0 (github.com/MarnixS/fun)'


def get(url, attempts=5, delay=0.0):
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                data = json.load(r)
            if delay:
                time.sleep(delay)
            return data
        except HTTPError as e:
            last = e
            if i == attempts - 1:
                raise
            try:
                retry = float(e.headers.get('Retry-After') or 0)
            except Exception:
                retry = 0
            wait = max(retry, min(45, (8 if e.code == 429 else 2) * (i + 1)))
            print(f'HTTP {e.code}; retrying in {wait:.1f}s: {url.split("?")[0]}')
            time.sleep(wait)
        except Exception as e:
            last = e
            if i == attempts - 1:
                raise
            time.sleep(min(30, 2 ** i))
    raise last


def load_old():
    try:
        return json.loads(OUT.read_text(encoding='utf-8'))
    except Exception:
        return {}


def valid_log(x):
    if not isinstance(x, dict) or x.get('error') or x.get('errors'):
        return False
    data = x.get('data', x)
    return isinstance(data, dict) and isinstance(data.get('items'), (dict, list))


def recent_rows(payload, name):
    data = payload.get('data', payload) if isinstance(payload, dict) else payload
    rows = list(data.values()) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    out = []
    for row in rows:
        z = normalize_recent(row, name)
        if z:
            out.append(z)
    return out


def recent_key(row):
    player = str(row.get('player_name_with_capitalization') or row.get('player') or '').lower()
    item = str(row.get('id') or row.get('item_id') or '')
    when = str(row.get('date_unix') or row.get('date') or '')
    return player, item, when


def recent_time(row):
    try:
        n = float(row.get('date_unix') or row.get('date') or 0)
    except Exception:
        n = 0
    if n:
        return n / 1000 if n > 1e12 else n
    raw = row.get('date')
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace('Z', '+00:00')).timestamp()
        except Exception:
            pass
    return 0


def normalize_recent(row, name=''):
    if not isinstance(row, dict) or row.get('Code') or row.get('code') or row.get('error') or row.get('errors'):
        return None
    try:
        item_id = int(row.get('id') or row.get('item_id') or 0)
    except Exception:
        item_id = 0
    item_name = str(row.get('name') or row.get('item_name') or '').strip()
    player = str(row.get('player_name_with_capitalization') or row.get('player') or name).strip()
    when = recent_time(row)
    if item_id <= 0 or not item_name or not player or when <= 0:
        return None
    z = dict(row)
    z.update({
        'id': item_id,
        'name': item_name,
        'player': player,
        'player_name_with_capitalization': player,
        'date_unix': int(when),
        'date': datetime.fromtimestamp(when).strftime('%Y-%m-%d %H:%M:%S'),
    })
    return z


def log_items(log):
    if not valid_log(log):
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
            value = {'id': item_id, 'count': count, 'time': recent_time(node), 'name': str(node.get('name') or node.get('item_name') or '').strip()}
            prior = found.get(item_id)
            if not prior or count > prior['count'] or value['time'] > prior['time']:
                found[item_id] = value
            return
        for value in node.values():
            walk(value)

    walk(data.get('items') or {})
    return found


def derived_recent_rows(current_players, previous):
    rows = []
    cutoff = float(previous.get('fetchedAt') or 0) / 1000
    previous_players = previous.get('players') or {}
    for key, name in PLAYERS.items():
        if not valid_log(current_players.get(key)) or not valid_log(previous_players.get(key)):
            continue
        current = log_items(current_players[key])
        before = log_items(previous_players[key])
        for item in current.values():
            old_item = before.get(item['id']) or {}
            new_unique = int(old_item.get('count') or 0) == 0 and item['count'] > 0
            newer_drop = item['time'] > max(float(old_item.get('time') or 0), cutoff)
            if item['count'] <= 0 or item['time'] <= 0 or not item['name'] or not (new_unique or newer_drop):
                continue
            row = normalize_recent({'id': item['id'], 'name': item['name'], 'date_unix': int(item['time']), 'player': name, 'source': 'full Temple Collection Log'}, name)
            if row:
                rows.append(row)
    return rows

old = load_old()
players = {k: v for k, v in dict(old.get('players') or {}).items() if k in PLAYERS and valid_log(v)}
fresh_players = []
failed_players = []

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
        payload = get('https://templeosrs.com/api/collection-log/player_collection_log.php?' + q, attempts=5, delay=1.2)
        if not valid_log(payload):
            raise ValueError('Temple returned no valid Collection Log')
        players[key] = payload
        fresh_players.append(key)
        d = payload.get('data', payload)
        print('Collection Log refreshed:', name, 'last_checked=', d.get('last_checked'), 'last_changed=', d.get('last_changed'), 'obtained=', d.get('total_collections_finished'))
    except Exception as e:
        failed_players.append(key)
        print('Collection Log refresh failed; preserving last known good:', name, repr(e))

if not fresh_players:
    raise RuntimeError('Temple refresh failed for every member; refusing to stamp stale cache as fresh')

try:
    payload = get('https://templeosrs.com/api/collection-log/items.php', attempts=4, delay=.8)
    catalog = payload.get('data', payload) if isinstance(payload, dict) else payload
    if not isinstance(catalog, (dict, list)) or not catalog:
        raise ValueError('empty Collection Log item list')
except Exception as e:
    print('Collection Log item list failed; preserving previous:', repr(e))
    catalog = old.get('catalog') or old.get('catalogue') or []

try:
    categories = get('https://templeosrs.com/api/collection-log/categories.php', attempts=4, delay=.8)
    if not isinstance(categories, (dict, list)) or not categories:
        raise ValueError('empty Collection Log categories')
except Exception as e:
    print('Collection Log categories failed; preserving previous:', repr(e))
    categories = old.get('categories') or {}

merged_recent = {}
for raw in list(old.get('recent') or []):
    row = normalize_recent(raw)
    if row:
        merged_recent[recent_key(row)] = row
recent_success = []
for key, name in PLAYERS.items():
    if not valid_log(players.get(key)):
        continue
    q = urllib.parse.urlencode({'player': name, 'count': 200})
    try:
        rows = recent_rows(get('https://templeosrs.com/api/collection-log/player_recent_items.php?' + q, attempts=4, delay=.6), name)
        for row in rows:
            merged_recent[recent_key(row)] = row
        recent_success.append(key)
        print('Recent item unlocks refreshed:', name, len(rows))
    except Exception as e:
        print('Recent item unlocks failed; preserving previous rows:', name, repr(e))

derived_recent = derived_recent_rows(players, old)
for row in derived_recent:
    merged_recent[recent_key(row)] = row

synced_names = {PLAYERS[k].lower() for k in PLAYERS if valid_log(players.get(k))}
recent = [r for r in merged_recent.values() if str(r.get('player_name_with_capitalization') or r.get('player') or '').lower() in synced_names]
recent.sort(key=recent_time, reverse=True)

now = int(time.time() * 1000)
doc = {
    'source': 'Collection Log via TempleOSRS',
    'fetchedAt': now,
    'players': players,
    'catalog': catalog,
    'categories': categories,
    'recent': recent[:500],
    'membersWithClog': sum(1 for k in PLAYERS if valid_log(players.get(k))),
    'groupSize': 5,
    'refreshDiagnostics': {
        'freshPlayers': fresh_players,
        'failedPlayers': failed_players,
        'recentPlayers': recent_success,
        'derivedRecentItems': len(derived_recent),
        'refreshedAt': now,
    },
}
OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print('Collection Logs currently valid:', [PLAYERS[k] for k in PLAYERS if valid_log(players.get(k))])
print('Fresh player fetches:', [PLAYERS[k] for k in fresh_players])
print('Recent feeds refreshed:', [PLAYERS[k] for k in recent_success])
