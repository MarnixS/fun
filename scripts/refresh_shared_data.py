#!/usr/bin/env python3
import json, time, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path('docs/data'); ROOT.mkdir(parents=True,exist_ok=True)
PLAYERS={'dikste':'Dikste','big dog aura':'Big Dog Aura','lijpste':'Lijpste','lompste':'Lompste','dikste jr':'Dikste Jr'}
UA='United-Gimps-Group-Ironman-Tracker/19.0 (github.com/MarnixS/fun)'

def get(url,method='GET',data=None,attempts=4,delay=0.0):
    err=None
    for i in range(attempts):
        try:
            req=urllib.request.Request(url,method=method,headers={'Accept':'application/json','Content-Type':'application/json','User-Agent':UA},data=data)
            with urllib.request.urlopen(req,timeout=35) as r: out=json.load(r)
            if delay: time.sleep(delay)
            return out
        except Exception as e:
            err=e
            if i==attempts-1: raise
            time.sleep(2**i)
    raise err

def read(path,default):
    try:return json.loads(Path(path).read_text(encoding='utf-8'))
    except Exception:return default

def stable(x,stamp):
    y=dict(x);y.pop(stamp,None);return y

old_temple=read(ROOT/'temple-clog.json',{})
old_wom=read(ROOT/'wom-cache.json',{})

# Keep the existing catalogue because it is already generated from Temple's item/category maps.
temple={'source':'TempleOSRS','fetchedAt':int(time.time()*1000),'groupId':old_temple.get('groupId'),'catalogue':old_temple.get('catalogue',{'items':[]}), 'players':{}, 'recent':[]}
recent=[]
for key,rsn in PLAYERS.items():
    q=urllib.parse.urlencode({'player':rsn,'categories':'all','includenames':'1','onlyitems':'1','dateformat':'unix'})
    temple['players'][key]=get('https://templeosrs.com/api/collection-log/player_collection_log.php?'+q)
    try:
        rq=urllib.parse.urlencode({'player':rsn,'count':40})
        r=get('https://templeosrs.com/api/collection-log/player_recent_items.php?'+rq)
        rows=r.get('data',r) if isinstance(r,dict) else r
        if isinstance(rows,dict): rows=list(rows.values())
        for x in rows or []:
            if isinstance(x,dict):
                z=dict(x);z.setdefault('player',rsn);recent.append(z)
    except Exception as e:
        print('Recent-items fetch failed for',rsn,e)
    print('Fetched TempleOSRS',rsn)

def rtime(x):
    try:return int(x.get('date_unix') or x.get('date') or x.get('created_at') or 0)
    except Exception:return 0
recent.sort(key=rtime,reverse=True);temple['recent']=recent[:100]

wom={'source':'Wise Old Man','savedAt':int(time.time()*1000),'players':{},'gains':{'week':{},'month':{},'year':{}},'snapshots':{}}
def wom_get(path): return get('https://api.wiseoldman.net/v2'+path,delay=1.05,attempts=3)
def wom_update(rsn): return get('https://api.wiseoldman.net/v2/players/'+urllib.parse.quote(rsn),method='POST',data=b'{}',delay=1.05,attempts=3)
for key,rsn in PLAYERS.items():
    try:wom['players'][key]=wom_update(rsn)
    except Exception as e:
        print('WOM update failed; trying read',rsn,e);wom['players'][key]=wom_get('/players/'+urllib.parse.quote(rsn))
    print('Fetched WOM profile',rsn)
for period in ('week','month','year'):
    for key,rsn in PLAYERS.items():
        try:wom['gains'][period][key]=wom_get('/players/'+urllib.parse.quote(rsn)+'/gained?period='+period)
        except Exception as e:
            print('WOM gains failed',period,rsn,e);wom['gains'][period][key]=(old_wom.get('gains',{}).get(period,{}).get(key) or {})
for key,rsn in PLAYERS.items():
    try:
        rows=wom_get('/players/'+urllib.parse.quote(rsn)+'/snapshots?period=year&limit=50&offset=0')
        if isinstance(rows,list): rows.sort(key=lambda x:x.get('createdAt',''))
        wom['snapshots'][key]=rows
    except Exception as e:
        print('WOM snapshots failed',rsn,e);wom['snapshots'][key]=(old_wom.get('snapshots',{}).get(key) or [])

changed=False
if stable(temple,'fetchedAt')!=stable(old_temple,'fetchedAt'):
    (ROOT/'temple-clog.json').write_text(json.dumps(temple,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');changed=True
if stable(wom,'savedAt')!=stable(old_wom,'savedAt'):
    (ROOT/'wom-cache.json').write_text(json.dumps(wom,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');changed=True
print('Shared cache changed:',changed)
