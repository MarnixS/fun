const assert=require('node:assert/strict'),fs=require('node:fs');
const {openPage,waitFor}=require('./audit_v25_jsdom');
(async()=>{
 const full=JSON.parse(fs.readFileSync('docs/data/temple-clog.json'));
 const partial=structuredClone(full);delete partial.players.lompste;partial.fetchedAt=Date.now()+100000;
 const {dom,errors}=await openPage('gim.html',{savedTemple:partial});const w=dom.window;
 // Model an older successful browser refresh followed by a newer four-player default.
 w.localStorage.setItem('ug-v20-temple-cache',JSON.stringify(full));
 const merged=w.UGTempleStore.merge(partial,await w.UGTempleStore.latest(JSON.parse(w.localStorage.getItem('ug-v20-temple-cache'))));
 assert.equal(merged.players.lompste.data.total_collections_finished,47);
 assert.equal(merged.membersWithClog,5);
 const stale=structuredClone(full);stale.fetchedAt=partial.fetchedAt+1000;stale.players.lompste.data.last_checked-=86400;stale.players.lompste.data.last_changed=0;stale.players.lompste.data.total_collections_finished=1;
 assert.equal(w.UGTempleStore.merge(full,stale).players.lompste.data.total_collections_finished,47,'fetch date cannot override newer player data');
 const failed=structuredClone(partial);failed.players.lompste={error:'unavailable'};
 assert.equal(w.UGTempleStore.merge(full,failed).membersWithClog,5);
 assert.equal(w.UGTempleStore.merge(failed,full).membersWithClog,5);
 // A fresh page must render the retained player in both its common and specialised modules.
 const next=await openPage('gim.html',{savedTemple:partial,templeDocument:full,selection:['lompste']});
 await waitFor(()=>next.dom.window.document.querySelector('#clogSummary').textContent.includes('47'),'Lompste retained after navigation');
 assert.equal((await next.dom.window.UGV21.loadClog()).membersWithClog,5);
 assert.equal(errors.length+next.errors.length,0);
 console.log('Temple retention passed: missing/failed players, stale source dates, navigation and all-player coverage');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
