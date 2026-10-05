"""Save one Wiki price snapshot for all visitors, at most once per 12 hours."""
import json
import math
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'docs/data/ge-prices.json'
INTERVAL_SECONDS = 12 * 60 * 60
SOURCE_URL = 'https://prices.runescape.wiki/api/v1/osrs/latest'
USER_AGENT = 'United Gimps shared price snapshot (https://ugimps.com/; https://github.com/MarnixS/fun)'


def save(path, snapshot):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot, separators=(',', ':')) + '\n')
    temporary.replace(path)


def refresh(path=SNAPSHOT, now=None, opener=urllib.request.urlopen):
    now = time.time() if now is None else now
    if path.exists():
        saved = json.loads(path.read_text())
        checked = max(saved.get('fetchedAt', 0), saved.get('attemptedAt', 0)) / 1000
        if checked > 0 and now - checked < INTERVAL_SECONDS:
            print('The previous price check is under 12 hours old; no Wiki request.')
            return False
        # Record the attempt before contacting the Wiki. A failed request keeps
        # the previous prices and is also limited to one attempt per 12 hours.
        saved['attemptedAt'] = int(now * 1000)
        save(path, saved)

    request = urllib.request.Request(SOURCE_URL, headers={
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
    })
    with opener(request, timeout=30) as response:
        data = json.load(response).get('data')
    if not isinstance(data, dict) or not data:
        raise ValueError('Wiki returned no price data; keeping the previous snapshot.')
    if not any(isinstance(item, dict) and any(
        isinstance(item.get(side), (int, float))
        and math.isfinite(item[side]) and item[side] > 0
        for side in ('high', 'low')
    ) for item in data.values()):
        raise ValueError('Wiki returned no priced items; keeping the previous snapshot.')

    snapshot = {
        'version': 1,
        'fetchedAt': int(now * 1000),
        'attemptedAt': int(now * 1000),
        'refreshIntervalHours': 12,
        'source': SOURCE_URL,
        'data': data,
    }
    save(path, snapshot)
    print(f'Saved Wiki prices for {len(data)} items; next refresh after 12 hours.')
    return True


if __name__ == '__main__':
    refresh()
