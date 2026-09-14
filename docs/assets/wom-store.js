(function(){
'use strict';
const KEY='ug-v20-wom-cache',SIGNAL='ug-v29-wom-version';
async function access(write,value){
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
     const op=write?store.put(value,KEY):store.get(KEY);op.onsuccess=()=>{result=write?true:op.result};
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
window.addEventListener('storage',async e=>{if(e.key!==SIGNAL)return;const doc=await access(false);if(doc?.profiles)window.dispatchEvent(new CustomEvent('ug:data-updated',{detail:{key:KEY,document:doc,source:'storage'}}))});
})();
