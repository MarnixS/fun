'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {openPage,waitFor}=require('./audit_v25_jsdom');
const temple=JSON.parse(fs.readFileSync('docs/data/temple-clog.json'));
// Reproduce the reported incident independently of future shared-data updates.
temple.fetchedAt=Date.now();
temple.recent=[{id:26227,name:'Ancient ceremonial gloves',player:'Big Dog Aura',date_unix:Math.floor(Date.now()/1000)}];
const wom=JSON.parse(fs.readFileSync('docs/data/wom-cache.json'));
const old=structuredClone(temple);
old.fetchedAt=1;old.recent=[{id:26231,name:'Nihil shard',player:'Big Dog Aura',date_unix:Math.floor(Date.now()/1000)-86400}];
function removeGloves(node){if(!node||typeof node!=='object')return;if(node.id===26227){node.count=0;node.date=null}Object.values(node).forEach(removeGloves)}
removeGloves(old.players['big dog aura']);
async function run(){
 for(const path of ['index.html','gim.html','hiscores.html','progress.html','history.html','time-machine.html','chronicle.html']){
  console.log('automatic live data',path);const requests=[];
  const {dom,errors}=await openPage(path,{liveSync:true,savedTemple:old,templeResponse:temple,womResponse:wom,fetchLog:requests});
  const w=dom.window,d=w.document;
  await waitFor(()=>d.querySelector('[data-mast-drop]')?.textContent==='Ancient ceremonial gloves','automatic gloves mast');
  assert.equal(d.querySelector('[data-mast-drop-sub]').textContent.split(' · ')[0],'Big Dog Aura');
  assert(requests.some(x=>x.url.includes('/api/temple-collection-log')),'opening a menu automatically queries Temple');
  assert(!requests.some(x=>x.method==='POST'),'automatic WOM checks read tracked data without requesting hiscores updates');
  if(path==='gim.html')await waitFor(()=>d.querySelector('#recentDrops').textContent.includes('Ancient ceremonial gloves'),'automatic Collection Log recent');
  if(path==='chronicle.html')await waitFor(()=>d.querySelector('#chronicle').textContent.includes('Ancient ceremonial gloves'),'automatic Chronicle');
  await waitFor(()=>d.querySelector('#liveSyncStatus').textContent.includes('WOM: checked'),'WOM automatic check');
  const stored=JSON.parse(w.localStorage.getItem('ug-v20-temple-cache'));
  assert(stored.recent.some(x=>x.id===26227),'automatic response persisted for navigation');
  assert.equal(errors.length,0,errors.join('; '));w.ugLiveSync.stop();
 }
 console.log('ALL MENUS AUTOMATIC SYNC AUDIT PASSED');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
