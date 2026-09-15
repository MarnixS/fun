(function(){
'use strict';
const KEY='ug-v20-wom-cache',SIGNAL='ug-v29-wom-version';
if(typeof module==='object'&&module.exports){module.exports={mergeWom,mergeTemple};return}
async function access(write,value,key=KEY,merge){
 if(!window.indexedDB)return null;
 return new Promise(resolve=>{
  let db,done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);db?.close();resolve(value)};
  const timer=setTimeout(()=>finish(null),5000);
  try{
   const request=indexedDB.open('united-gimps-cache',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('documents'))request.result.createObjectStore('documents')};
   request.onerror=request.onblocked=()=>finish(null);
   request.onsuccess=()=>{
    db=request.result;if(done){db.close();return}
    try{const tx=db.transaction('documents',write?'readwrite':'readonly'),store=tx.objectStore('documents');let result=null;
     const op=store.get(key);op.onsuccess=()=>{if(write){result=merge?merge(op.result,value):value;store.put(result,key)}else result=op.result};
     tx.oncomplete=()=>finish(result);tx.onerror=tx.onabort=()=>finish(null);
    }catch{finish(null)}
   };
  }catch{finish(null)}
 });
}
async function latest(local){return mergeWom(await access(false),local)}
async function save(doc){
 const saved=await access(true,doc,KEY,mergeWom);if(!saved)return false;
 // Remove only the obsolete duplicate after IndexedDB has committed the complete history.
 try{localStorage.removeItem(KEY);localStorage.setItem(SIGNAL,String(saved.fetchedAt||Date.now()))}catch{}
 return saved;
}
window.UGWomStore={latest,save,merge:mergeWom};
const TKEY='ug-v20-temple-cache',TSIGNAL='ug-temple-version';
function validLog(log){const d=log?.data??log;return !!(log&&!log.error&&!log.errors&&d?.items&&typeof d.items==='object')}
function millis(value){const n=Number(value);return Number.isFinite(n)&&n>0?(n<1e12?n*1000:n):(Date.parse(value)||0)}
function logTime(log,doc){const d=log?.data??log;return Math.max(millis(d?.last_checked),millis(d?.last_changed))||millis(doc?.fetchedAt||doc?.savedAt)}
function mergeWom(a,b){
 if(!a?.profiles)return b;if(!b?.profiles)return a;
 const newer=millis(b.fetchedAt||b.savedAt)>=millis(a.fetchedAt||a.savedAt)?b:a,older=newer===a?b:a;
 const profiles={},snapshots={},achievements={},gains={};
 const snap=p=>p?.latestSnapshot||p?.latest_snapshot;
 const valid=p=>!!(snap(p)?.createdAt&&snap(p)?.data);
 for(const key of new Set([...Object.keys(a.profiles),...Object.keys(b.profiles)])){
  const x=a.profiles[key],y=b.profiles[key];
  if(valid(x)&&valid(y)){const xt=millis(snap(x).createdAt),yt=millis(snap(y).createdAt);profiles[key]=yt>xt?y:xt>yt?x:newer.profiles[key]||older.profiles[key]}
  else if(valid(x)||valid(y))profiles[key]=valid(x)?x:y;
  const rows=new Map();
  for(const doc of [older,newer])for(const row of [...(doc.snapshots?.[key]||doc.history?.[key]||[]),snap(doc.profiles[key])])if(row?.createdAt&&row?.data)rows.set(row.createdAt,row);
  snapshots[key]=[...rows.values()].sort((x,y)=>millis(x.createdAt)-millis(y.createdAt));
  const awards=new Map();for(const doc of [older,newer])for(const row of doc.achievements?.[key]||[])awards.set([row.metric,row.name,row.threshold,row.createdAt].join('|'),row);
  achievements[key]=[...awards.values()];
 }
 for(const period of new Set([...Object.keys(a.gains||{}),...Object.keys(b.gains||{})])){
  gains[period]={};for(const key of Object.keys(profiles)){
   const x=a.gains?.[period]?.[key],y=b.gains?.[period]?.[key];
   const xt=millis(x?.endsAt),yt=millis(y?.endsAt);
   const chosen=x?.data&&y?.data?(yt>xt?y:xt>yt?x:newer.gains?.[period]?.[key]||older.gains?.[period]?.[key]):x?.data?x:y?.data?y:null;
   if(chosen)gains[period][key]=chosen;
  }
 }
 return {...older,...newer,profiles,snapshots,achievements,gains,sourceLatestAt:Math.max(0,...Object.values(profiles).map(p=>millis(snap(p).createdAt))),snapshotCounts:Object.fromEntries(Object.entries(snapshots).map(([k,v])=>[k,v.length]))};
}
function mergeTemple(a,b){
 if(!a?.players)return b;if(!b?.players)return a;
 const newer=millis(b.fetchedAt||b.savedAt)>=millis(a.fetchedAt||a.savedAt)?b:a,older=newer===a?b:a;
 const players={};
 for(const key of new Set([...Object.keys(a.players),...Object.keys(b.players)])){
  const x=a.players[key],y=b.players[key];
  if(validLog(x)&&validLog(y))players[key]=logTime(y,b)>logTime(x,a)?y:logTime(y,b)<logTime(x,a)?x:((y.data??y).total_collections_finished||0)>=((x.data??x).total_collections_finished||0)?y:x;
  else if(validLog(x)||validLog(y))players[key]=validLog(x)?x:y;
 }
 const recent=new Map();for(const row of [...(older.recent||[]),...(newer.recent||[])]){const who=String(row.player_name_with_capitalization||row.player||'').toLowerCase(),when=millis(row.date_unix||row.date);recent.set([who,row.id||row.item_id,when].join('|'),row)}
 return {...older,...newer,players,membersWithClog:Object.keys(players).length,recent:[...recent.values()].sort((x,y)=>millis(y.date_unix||y.date)-millis(x.date_unix||x.date))};
}
async function templeLatest(local){const saved=await access(false,null,TKEY);return mergeTemple(saved,local)}
async function templeSave(doc){const saved=await access(true,doc,TKEY,mergeTemple);if(!saved)return false;try{localStorage.removeItem(TKEY);localStorage.setItem(TSIGNAL,String(Date.now()))}catch{}return saved}
async function templeClear(shared){await access(true,shared,TKEY);try{localStorage.removeItem(TKEY);localStorage.setItem(TSIGNAL,String(Date.now()))}catch{}}
window.UGTempleStore={latest:templeLatest,save:templeSave,clear:templeClear,merge:mergeTemple};
window.addEventListener('storage',async e=>{if(e.key!==TSIGNAL)return;const doc=await templeLatest(null);if(doc?.players)window.dispatchEvent(new CustomEvent('ug:data-updated',{detail:{key:TKEY,document:doc,source:'storage'}}))});
window.addEventListener('storage',async e=>{if(e.key!==SIGNAL)return;const doc=await access(false);if(doc?.profiles)window.dispatchEvent(new CustomEvent('ug:data-updated',{detail:{key:KEY,document:doc,source:'storage'}}))});
// The service returns an immutable commit URL: page loads read saved data only.
// Full WOM history is downloaded directly from GitHub, outside function body limits.
const SHARED='https://united-gimps-temple-proxy.vercel.app/api/shared-data';
async function sharedRequest(source,player){
 const manual=player!==undefined;
 const response=await fetch(SHARED+(manual?'':'?source='+encodeURIComponent(source)),{method:manual?'POST':'GET',cache:'no-store',credentials:'omit',headers:{Accept:'application/json',...(manual?{'Content-Type':'application/json'}:{})},...(manual?{body:JSON.stringify({source,...(player?{player}:{})})}:{}),signal:AbortSignal.timeout(manual?290000:15000)});
 const receipt=await response.json();if(!response.ok)throw new Error(receipt.error||`Shared data HTTP ${response.status}`);
 if(receipt.source!==source||!/^[a-f0-9]{40}$/.test(receipt.revision))throw new Error('No confirmed shared snapshot');
 return receipt;
}
async function readShared(receipt){
 const file=receipt.source==='wom'?'wom-cache.json':receipt.source==='temple'?'temple-clog.json':null;
 if(!file||!/^[a-f0-9]{40}$/.test(receipt.revision))throw new Error('Invalid shared snapshot');
 const response=await fetch(`https://raw.githubusercontent.com/MarnixS/fun/${receipt.revision}/docs/data/${file}`,{cache:'no-store',signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw new Error('The shared update was saved but could not be loaded. Reload to try again.');
 const doc=await response.json();if(!(receipt.source==='wom'?doc?.profiles:doc?.players))throw new Error('Invalid shared data');
 return doc;
}
window.UGSharedData={load:async source=>readShared(await sharedRequest(source)),refresh:(source,player='')=>sharedRequest(source,player),read:readShared};
})();
