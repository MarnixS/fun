(function(){
'use strict';
const KEY='ug-v20-wom-cache',SIGNAL='ug-v29-wom-version';
async function access(write,value,key=KEY){
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
     const op=write?store.put(value,key):store.get(key);op.onsuccess=()=>{result=write?true:op.result};
     tx.oncomplete=()=>finish(result);tx.onerror=tx.onabort=()=>finish(null);
    }catch{finish(null)}
   };
  }catch{finish(null)}
 });
}
async function latest(local){const saved=await access(false);if(saved?.profiles&&+(saved.fetchedAt||0)>=+(local?.fetchedAt||0))return saved;if(local?.profiles)await save(local);return local}
async function save(doc){
 if(!await access(true,doc))return false;
 // Remove only the obsolete duplicate after IndexedDB has committed the complete history.
 try{localStorage.removeItem(KEY);localStorage.setItem(SIGNAL,String(doc.fetchedAt||Date.now()))}catch{}
 return true;
}
window.UGWomStore={latest,save};
const TKEY='ug-v20-temple-cache',TSIGNAL='ug-temple-version';
function validLog(log){const d=log?.data??log;return !!(log&&!log.error&&!log.errors&&d?.items&&typeof d.items==='object')}
function millis(value){const n=Number(value);return Number.isFinite(n)&&n>0?(n<1e12?n*1000:n):(Date.parse(value)||0)}
function logTime(log,doc){const d=log?.data??log;return Math.max(millis(d?.last_checked),millis(d?.last_changed))||millis(doc?.fetchedAt||doc?.savedAt)}
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
async function templeSave(doc){if(!await access(true,doc,TKEY))return false;try{localStorage.removeItem(TKEY);localStorage.setItem(TSIGNAL,String(Date.now()))}catch{}return true}
async function templeClear(shared){await access(true,shared,TKEY);try{localStorage.removeItem(TKEY);localStorage.setItem(TSIGNAL,String(Date.now()))}catch{}}
window.UGTempleStore={latest:templeLatest,save:templeSave,clear:templeClear,merge:mergeTemple};
window.addEventListener('storage',async e=>{if(e.key!==TSIGNAL)return;const doc=await templeLatest(null);if(doc?.players)window.dispatchEvent(new CustomEvent('ug:data-updated',{detail:{key:TKEY,document:doc,source:'storage'}}))});
window.addEventListener('storage',async e=>{if(e.key!==SIGNAL)return;const doc=await access(false);if(doc?.profiles)window.dispatchEvent(new CustomEvent('ug:data-updated',{detail:{key:KEY,document:doc,source:'storage'}}))});
})();
