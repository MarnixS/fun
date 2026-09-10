#!/usr/bin/env python3
import json, time, urllib.parse, urllib.request
from urllib.error import HTTPError
from pathlib import Path

ROOT=Path('docs/data'); ROOT.mkdir(parents=True,exist_ok=True)
PLAYERS={'dikste':'Dikste','big dog aura':'Big Dog Aura','lijpste':'Lijpste','lompste':'Lompste','dikste jr':'Dikste Jr'}
UA='United-Gimps-Group-Ironman-Tracker/19.0 (github.com/MarnixS/fun)'

def get(url,method='GET',data=None,attempts=5,delay=0.0):
    err=None
    for i in range(attempts):
        try:
            req=urllib.request.Request(url,method=method,headers={'Accept':'application/json','Content-Type':'application/json','User-Agent':UA},data=data)
            with urllib.request.urlopen(req,timeout=35) as r: out=json.load(r)
            if delay: time.sleep(delay)
            return out
        except HTTPError as e:
            err=e
            if i==attempts-1: raise
            retry=e.headers.get('Retry-After') if e.headers else None
            try: wait=max(float(retry),2.0)
            except Exception: wait=min(30.0,2.5*(2**i))
            if e.code==429: wait=max(wait,8.0)
            print(f'HTTP {e.code}; retrying in {wait:.1f}s: {url.split("?")[0]}')
            time.sleep(wait)
        except Exception as e:
            err=e
            if i==attempts-1: raise
            time.sleep(min(20.0,2**i))
    raise err

def read(path,default):
    try:return json.loads(Path(path).read_text(encoding='utf-8'))
    except Exception:return default

def stable(x,stamp):
    y=dict(x);y.pop(stamp,None);return y

old_temple=read(ROOT/'temple-clog.json',{})
old_wom=read(ROOT/'wom-cache.json',{})

# Preserve every last-known-good player payload. A transient 429 must never erase a member.
temple={'source':'TempleOSRS','fetchedAt':int(time.time()*1000),'groupId':old_temple.get('groupId'),'catalogue':old_temple.get('catalogue',{'items':[]}), 'players':dict(old_temple.get('players') or {}), 'recent':list(old_temple.get('recent') or [])}
recent=[]
for key,rsn in PLAYERS.items():
    q=urllib.parse.urlencode({'player':rsn,'categories':'all','includenames':'1','onlyitems':'1','dateformat':'unix'})
    try:
        temple['players'][key]=get('https://templeosrs.com/api/collection-log/player_collection_log.php?'+q,attempts=6,delay=3.0)
        print('Fetched TempleOSRS',rsn)
    except Exception as e:
        if key in temple['players']:
            print('Temple player fetch failed; preserved previous cache for',rsn,e)
        else:
            print('Temple player fetch failed; no previous cache for',rsn,e)
    try:
        rq=urllib.parse.urlencode({'player':rsn,'count':40})
        r=get('https://templeosrs.com/api/collection-log/player_recent_items.php?'+rq,attempts=3,delay=1.5)
        rows=r.get('data',r) if isinstance(r,dict) else r
        if isinstance(rows,dict): rows=list(rows.values())
        for x in rows or []:
            if isinstance(x,dict):
                z=dict(x);z.setdefault('player',rsn);recent.append(z)
    except Exception as e:
        print('Recent-items fetch failed for',rsn,e)

def rtime(x):
    try:return int(x.get('date_unix') or x.get('date') or x.get('created_at') or 0)
    except Exception:return 0
if recent:
    recent.sort(key=rtime,reverse=True);temple['recent']=recent[:100]

# WOM current profiles are required; gains/snapshots are best-effort and preserve prior history on throttling.
wom={'source':'Wise Old Man','savedAt':int(time.time()*1000),'players':dict(old_wom.get('players') or {}),'gains':{'week':dict((old_wom.get('gains') or {}).get('week') or {}),'month':dict((old_wom.get('gains') or {}).get('month') or {}),'year':dict((old_wom.get('gains') or {}).get('year') or {})},'snapshots':dict(old_wom.get('snapshots') or {})}
def wom_get(path): return get('https://api.wiseoldman.net/v2'+path,delay=1.35,attempts=4)
def wom_update(rsn): return get('https://api.wiseoldman.net/v2/players/'+urllib.parse.quote(rsn),method='POST',data=b'{}',delay=1.35,attempts=3)
for key,rsn in PLAYERS.items():
    try:
        try:wom['players'][key]=wom_update(rsn)
        except Exception as e:
            print('WOM update failed; trying read',rsn,e);wom['players'][key]=wom_get('/players/'+urllib.parse.quote(rsn))
        print('Fetched WOM profile',rsn)
    except Exception as e:
        if key in wom['players']: print('WOM profile fetch failed; preserved previous cache for',rsn,e)
        else: print('WOM profile unavailable with no previous cache for',rsn,e)
for period in ('week','month','year'):
    for key,rsn in PLAYERS.items():
        try:wom['gains'][period][key]=wom_get('/players/'+urllib.parse.quote(rsn)+'/gained?period='+period)
        except Exception as e: print('WOM gains failed; preserved previous value',period,rsn,e)
for key,rsn in PLAYERS.items():
    try:
        rows=wom_get('/players/'+urllib.parse.quote(rsn)+'/snapshots?period=year&limit=50&offset=0')
        if isinstance(rows,list): rows.sort(key=lambda x:x.get('createdAt',''))
        wom['snapshots'][key]=rows
    except Exception as e: print('WOM snapshots failed; preserved previous value',rsn,e)

changed=False
if stable(temple,'fetchedAt')!=stable(old_temple,'fetchedAt'):
    (ROOT/'temple-clog.json').write_text(json.dumps(temple,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');changed=True
if stable(wom,'savedAt')!=stable(old_wom,'savedAt'):
    (ROOT/'wom-cache.json').write_text(json.dumps(wom,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');changed=True
print('Temple cached members:',sorted(temple['players']))
print('WOM cached members:',sorted(wom['players']))
print('Shared cache changed:',changed)
