import json
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

root=Path('docs')
class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=[];self.links=[];self.scripts=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get('id'):self.ids.append(a['id'])
        for key in ('src','href'):
            if a.get(key):self.links.append(a[key])
        if tag=='script' and a.get('src'):self.scripts.append(a['src'])

for path in root.glob('*.html'):
    text=path.read_text(encoding='utf-8');p=Page();p.feed(text)
    assert len(p.ids)==len(set(p.ids)),f'{path}: duplicate IDs'
    for link in p.links:
        u=urlsplit(link)
        if not u.scheme and u.path:
            assert (path.parent/unquote(u.path)).exists(),f'{path}: broken local resource {link}'
    assert not any('live-sync.js' in x for x in p.scripts),f'{path}: automatic sync must be disabled'
    script_paths=[urlsplit(s).path for s in p.scripts]
    assert script_paths.index('assets/history-model.js')<script_paths.index('assets/app.js')
    assert script_paths.index('assets/wom-store.js')<script_paths.index('assets/app.js')
    assert len(p.scripts)==len(set(p.scripts)),f'{path}: duplicate scripts'
    assert 'Reload saved Collection Log' not in text
    print('Page resources, IDs, script order:',path.name)
w=json.loads((root/'data/wom-cache.json').read_text());t=json.loads((root/'data/temple-clog.json').read_text())
for key,profile in w['profiles'].items():
    assert profile['latestSnapshot']['data']['skills']['overall']['level']>0
    rows=w['snapshots'][key];dates=[x['createdAt'] for x in rows]
    assert len(dates)==len(set(dates)),f'{key}: duplicate history timestamps'
    assert all(x['data'] for x in rows)
assert all(x.get('id') and x.get('name') and x.get('date_unix') for x in t['recent'])
assert [x['date_unix'] for x in t['recent']]==sorted((x['date_unix'] for x in t['recent']),reverse=True)
print('Saved data: five WOM profiles, unique history timestamps, valid chronologically sorted unlocks')
