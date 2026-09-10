#!/usr/bin/env python3
import json,time,urllib.parse,urllib.request
from urllib.error import HTTPError
from pathlib import Path

ROOT=Path('docs/data'); ROOT.mkdir(parents=True,exist_ok=True)
PLAYERS={'dikste':'Dikste','big dog aura':'Big Dog Aura','lijpste':'Lijpste','poep aura':'Poep Aura','lompste':'Lompste'}
CORE=['dikste','big dog aura','lijpste']
UA='United-Gimps-Group-Ironman-Tracker/19.0 (github.com/MarnixS/fun)'

def get(url,method='GET',data=None,attempts=5,delay=0):
    err=None
    for i in range(attempts):
        try:
            req=urllib.request.Request(url,method=method,data=data,headers={'Accept':'application/json','Content-Type':'application/json','User-Agent':UA})
            with urllib.request.urlopen(req,timeout=35) as r: out=json.load(r)
            if delay: time.sleep(delay)
            return out
        except HTTPError as e:
            err=e
            if i==attempts-1: raise
            try: wait=max(float(e.headers.get('Retry-After') or 0),2.0)
            except Exception: wait=2.0
            if e.code==429: wait=max(wait,min(30,8*(i+1)))
            else: wait=max(wait,min(20,2**i))
            print(f'HTTP {e.code}, retry in {wait:.1f}s: {url.split("?")[0]}');time.sleep(wait)
        except Exception as e:
            err=e
            if i==attempts-1: raise
            time.sleep(min(20,2**i))
    raise err

def load(name):
    try:return json.loads((ROOT/name).read_text(encoding='utf-8'))
    except Exception:return {}

def valid_temple(x):
    if not isinstance(x,dict): return False
    if x.get('error') or x.get('errors'): return False
    d=x.get('data',x)
    if not isinstance(d,dict): return False
    # Valid logs expose items directly or somewhere inside their structured data.
    if isinstance(d.get('items'),(list,dict)): return True
    def has_items(n,depth=0):
        if depth>5 or not isinstance(n,dict): return False
        if isinstance(n.get('items'),(list,dict)): return True
        return any(has_items(v,depth+1) for v in n.values() if isinstance(v,dict))
    return has_items(d)

def stable(doc,stamp):
    if not isinstance(doc,dict): return doc
    x=dict(doc);x.pop(stamp,None);return x

oldw=load('wom-cache.json'); oldt=load('temple-clog.json')
oldprofiles=dict(oldw.get('profiles') or oldw.get('players') or {})
oldgains=oldw.get('gains') or {}
profiles=dict(oldprofiles)
gains={p:dict(oldgains.get(p) or {}) for p in ('week','month','year')}

# WOM: all five current profiles; historical/deep gain defaults remain core three.
for key,name in PLAYERS.items():
    try:
        try:get('https://api.wiseoldman.net/v2/players/'+urllib.parse.quote(name),method='POST',data=b'{}',attempts=2,delay=1.1)
        except Exception as e: print('WOM update warning:',name,repr(e))
        profiles[key]=get('https://api.wiseoldman.net/v2/players/'+urllib.parse.quote(name),attempts=4,delay=1.1)
        print('WOM profile:',name)
    except Exception as e: print('WOM profile failed; preserving previous if present:',name,repr(e))
for period in ('week','month','year'):
    for key in CORE:
        name=PLAYERS[key]
        try:
            gains[period][key]=get('https://api.wiseoldman.net/v2/players/'+urllib.parse.quote(name)+'/gained?period='+period,attempts=3,delay=1.1)
            print('WOM gain:',name,period)
        except Exception as e: print('WOM gain failed; preserving previous:',name,period,repr(e))

wom={'source':'Wise Old Man','fetchedAt':int(time.time()*1000),'profiles':profiles,'gains':gains}

# Temple: attempt every group member. Missing/invalid response means unknown, never zero.
# Once Lompste syncs Temple, the next successful refresh automatically adds him.
temple=dict(oldt.get('players') or {})
for key,name in PLAYERS.items():
    q=urllib.parse.urlencode({'player':name,'categories':'all','includenames':'1','includemissingitems':'1','onlyitems':'1','dateformat':'unix'})
    try:
        payload=get('https://templeosrs.com/api/collection-log/player_collection_log.php?'+q,attempts=5,delay=1.5)
        if valid_temple(payload):
            temple[key]=payload; print('Temple Clog:',name)
        else:
            # If this account has never had a valid log, it stays absent/unsynced.
            # If it used to be valid, preserve last known good data.
            print('Temple response not a valid synced log; preserving previous if present:',name)
    except Exception as e: print('Temple Clog failed; preserving previous if present:',name,repr(e))

try:
    cp=get('https://templeosrs.com/api/collection-log/items.php',attempts=4,delay=1.0)
    catalog=cp.get('data',cp) if isinstance(cp,dict) else cp
    if not isinstance(catalog,(list,dict)) or not catalog: raise ValueError('empty catalog')
except Exception as e:
    print('Temple catalog failed; preserving previous:',repr(e));catalog=oldt.get('catalog') or oldt.get('catalogue') or []

recent=[]
for key,name in PLAYERS.items():
    q=urllib.parse.urlencode({'player':name,'count':100})
    try:
        p=get('https://templeosrs.com/api/collection-log/player_recent_items.php?'+q,attempts=3,delay=.8)
        d=p.get('data',p) if isinstance(p,dict) else p
        rows=list(d.values()) if isinstance(d,dict) else (d if isinstance(d,list) else [])
        for row in rows:
            if isinstance(row,dict):
                z=dict(row);z.setdefault('player',name);z.setdefault('player_name_with_capitalization',name);recent.append(z)
        print('Temple recent:',name,len(rows))
    except Exception as e: print('Temple recent failed:',name,repr(e))

def rtime(x):
    try:return int(x.get('date_unix') or x.get('date') or x.get('created_at') or 0)
    except Exception:return 0
if recent: recent.sort(key=rtime,reverse=True)
else: recent=list(oldt.get('recent') or [])

temple_doc={'source':'TempleOSRS','fetchedAt':int(time.time()*1000),'players':temple,'catalog':catalog,'recent':recent[:200],'membersWithClog':sum(1 for k in PLAYERS if valid_temple(temple.get(k))),'groupSize':5}

changed=False
if stable(wom,'fetchedAt')!=stable(oldw,'fetchedAt'):
    (ROOT/'wom-cache.json').write_text(json.dumps(wom,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');changed=True
if stable(temple_doc,'fetchedAt')!=stable(oldt,'fetchedAt'):
    (ROOT/'temple-clog.json').write_text(json.dumps(temple_doc,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');changed=True
print('WOM profiles:',sorted(profiles))
print('Temple synced:',[PLAYERS[k] for k in PLAYERS if valid_temple(temple.get(k))])
print('Shared cache changed:',changed)
