'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {openPage,waitFor}=require('./audit_v25_jsdom');
const keys=['dikste','big dog aura','lijpste','poep aura','lompste'];
const names=['Dikste','Big Dog Aura','Lijpste','Poep Aura','Lompste'];
const wom=JSON.parse(fs.readFileSync('docs/data/wom-cache.json'));
const temple=JSON.parse(fs.readFileSync('docs/data/temple-clog.json'));
const pause=()=>{let release;const promise=new Promise(resolve=>{release=resolve});return{promise,release}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const panel=(document,source)=>document.querySelector(`[data-sync-source="${source}"]`);
const percent=element=>Number(element.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'));

async function simultaneous(){
 const requests=[],{dom,errors}=await openPage('index.html',{womResponse:wom,templeResponse:temple,fetchLog:requests});
 const w=dom.window,d=w.document;
 {
  assert(!d.querySelector('#syncProgress'),'ordinary page loads show no sync progress');
  assert(!requests.some(request=>request.method==='POST'),'ordinary page loads do not request a refresh');
  const memberGates=keys.map(pause),templeGate=pause(),readGates={wom:pause(),temple:pause()},applyGates={wom:pause(),temple:pause()};
  const originalRefresh=w.UGSharedData.refresh,originalRead=w.UGSharedData.read;
  let active=0,refreshes=0;
  w.UGSharedData.refresh=async(source,key)=>{
   refreshes++;if(source==='wom'){active++;await memberGates[keys.indexOf(key)].promise;active--}else await templeGate.promise;
   return originalRefresh(source,key);
  };
  w.UGSharedData.read=async receipt=>{await readGates[receipt.source].promise;return originalRead(receipt)};
  for(const source of ['wom','temple']){
   const store=source==='wom'?w.UGWomStore:w.UGTempleStore,save=store.save;
   store.save=async(...args)=>{await applyGates[source].promise;return save(...args)};
  }
  d.querySelector('[data-refresh-wom]').click();d.querySelector('[data-refresh-temple]').click();
  await waitFor(()=>panel(d,'wom')&&panel(d,'temple'),'both progress bars');
  assert.equal(d.querySelectorAll('#syncProgress').length,1);
  assert.equal(d.querySelectorAll('.sync-progress-run').length,2);
  assert.equal(percent(panel(d,'wom')),0);assert.equal(percent(panel(d,'temple')),0);
  assert.equal(panel(d,'wom').querySelector('[data-sync-step="dikste"]').dataset.stepState,'running');
  assert(panel(d,'temple').textContent.includes('Temple returns the group together'));
  assert(panel(d,'wom').querySelector('.sync-progress-close').hidden,'in-flight progress cannot be dismissed');
  const aria=panel(d,'wom').querySelector('[role="progressbar"]');
  assert.equal(aria.getAttribute('aria-valuemin'),'0');assert.equal(aria.getAttribute('aria-valuemax'),'100');
  await sleep(120);assert.equal(percent(panel(d,'wom')),0,'time alone never advances progress');
  d.querySelector('[data-refresh-wom]').dispatchEvent(new w.Event('click'));
  await sleep(30);assert.equal(refreshes,2,'duplicate clicks reuse the active sync');assert.equal(active,1);
  const values=[];
  for(let i=0;i<keys.length;i++){
   memberGates[i].release();
   await waitFor(()=>panel(d,'wom').querySelector(`[data-sync-step="${keys[i]}"]`).dataset.stepState==='done','member confirmation '+i);
   const value=percent(panel(d,'wom'));values.push(value);assert(value<100);
   assert(panel(d,'wom').querySelector('.sync-progress-completed').textContent.includes(names[i]));
  }
  assert.deepEqual(values,[16,33,50,66,83]);
  assert.equal(panel(d,'wom').querySelector('[data-sync-step="snapshot"]').dataset.stepState,'running');
  readGates.wom.release();
  await waitFor(()=>panel(d,'wom').querySelector('[data-sync-step="apply"]').dataset.stepState==='running','WOM applying');
  assert.equal(percent(panel(d,'wom')),91,'WOM stays unfinished while browser data is saving');
  templeGate.release();
  await waitFor(()=>panel(d,'temple').querySelector('[data-sync-step="snapshot"]').dataset.stepState==='running','Temple response');
  assert.equal(percent(panel(d,'temple')),80);assert.equal(percent(panel(d,'wom')),91,'independent sources do not overwrite each other');
  readGates.temple.release();
  await waitFor(()=>panel(d,'temple').querySelector('[data-sync-step="apply"]').dataset.stepState==='running','Temple applying');
  assert.equal(percent(panel(d,'temple')),90);
  applyGates.wom.release();applyGates.temple.release();
  await waitFor(()=>panel(d,'wom').dataset.syncState==='done'&&panel(d,'temple').dataset.syncState==='done','both completed');
  assert.equal(percent(panel(d,'wom')),100);assert.equal(percent(panel(d,'temple')),100);
  assert.equal(panel(d,'wom').querySelectorAll('[data-step-state="done"]').length,7);
  assert.equal(panel(d,'temple').querySelectorAll('[data-step-state="done"]').length,3);
  await waitFor(()=>!d.querySelector('[data-refresh-wom]').disabled&&!d.querySelector('[data-refresh-temple]').disabled,'controls ready');
  assert(!d.querySelector('[data-refresh-wom]').hasAttribute('aria-busy'));
  panel(d,'wom').querySelector('.sync-progress-close').click();assert(!panel(d,'wom'));assert(panel(d,'temple'));
  panel(d,'temple').querySelector('.sync-progress-close').click();assert(!d.querySelector('#syncProgress'));
  d.querySelector('[data-refresh-wom]').click();
  await waitFor(()=>panel(d,'wom')?.dataset.syncState==='done','new sync after dismiss');
  assert.equal(d.querySelectorAll('[data-sync-source="wom"]').length,1);
  assert.equal(errors.length,0,errors.join('; '));
 }
 console.log('Progress: confirmed steps, simultaneous sources, delays, deduplication and retry passed');
}

async function failures(){
 const sharedDocs={wom:structuredClone(wom),temple:structuredClone(temple),failPlayers:['big dog aura']};
 const partial={...structuredClone(temple),refreshDiagnostics:{freshPlayers:['dikste'],failedPlayers:keys.slice(1)}};
 const {dom,errors}=await openPage('gim.html',{womResponse:wom,templeResponse:partial,sharedDocs});const w=dom.window,d=w.document;
 {
  d.querySelector('[data-refresh-wom]').click();
  await waitFor(()=>panel(d,'wom')?.dataset.syncState==='warning','partial WOM');
  assert.equal(panel(d,'wom').querySelector('[data-sync-step="big dog aura"]').dataset.stepState,'failed');
  assert(!panel(d,'wom').querySelector('.sync-progress-completed').textContent.includes('Big Dog Aura'));
  assert(panel(d,'wom').querySelector('.sync-progress-current').textContent.includes('saved data retained for Big Dog Aura'));
  assert.equal(percent(panel(d,'wom')),100,'all attempted steps completed does not imply all members succeeded');
  d.querySelector('[data-refresh-temple]').click();
  await waitFor(()=>panel(d,'temple')?.dataset.syncState==='warning','partial Temple');
  assert.equal(panel(d,'temple').querySelector('[data-sync-step="logs"]').dataset.stepState,'warning');
  assert(panel(d,'temple').textContent.includes('1/5 refreshed: Dikste'));
  assert(panel(d,'temple').textContent.includes('saved data retained'));
  sharedDocs.failSaves=true;
  d.querySelector('[data-refresh-temple]').click();
  await waitFor(()=>panel(d,'temple')?.dataset.syncState==='failed','Temple failed request');
  assert.equal(panel(d,'temple').querySelector('[data-sync-step="logs"]').dataset.stepState,'failed');
  assert.equal(panel(d,'temple').querySelector('[data-sync-step="snapshot"]').dataset.stepState,'skipped');
  assert(percent(panel(d,'temple'))<100);assert(!d.querySelector('[data-refresh-temple]').disabled);
  d.querySelector('[data-refresh-wom]').click();
  await waitFor(()=>panel(d,'wom')?.dataset.syncState==='failed','all WOM members failed');
  assert.equal(panel(d,'wom').querySelectorAll('[data-step-state="failed"]').length,5);
  assert.equal(panel(d,'wom').querySelectorAll('[data-step-state="done"]').length,0);
  assert.equal(percent(panel(d,'wom')),83);assert(!d.querySelector('[data-refresh-wom]').disabled);
  sharedDocs.failSaves=false;
  const read=w.UGSharedData.read;
  w.UGSharedData.read=async()=>{throw new Error('Saved update could not be loaded')};
  d.querySelector('[data-refresh-temple]').click();
  await waitFor(()=>panel(d,'temple')?.dataset.syncState==='failed','saved snapshot read failure');
  assert.equal(panel(d,'temple').querySelector('[data-sync-step="snapshot"]').dataset.stepState,'failed');
  assert.equal(panel(d,'temple').querySelector('[data-sync-step="apply"]').dataset.stepState,'skipped');
  assert(panel(d,'temple').textContent.includes('Saved update could not be loaded'));
  w.UGSharedData.read=read;
  w.UGTempleStore.save=async()=>false;
  w.Storage.prototype.setItem=()=>{throw new Error('simulated storage quota')};
  d.querySelector('[data-refresh-temple]').click();
  await waitFor(()=>panel(d,'temple')?.dataset.syncState==='warning','storage warning');
  assert.equal(panel(d,'temple').querySelector('[data-sync-step="apply"]').dataset.stepState,'warning');
  assert(panel(d,'temple').textContent.includes('shared baseline is safely saved'));
  assert.equal(errors.length,0,errors.join('; '));
 }
 console.log('Progress: partial updates, total failures, download failures and storage warnings passed');
}

async function diagnostics(){
 const {dom,errors}=await openPage('faq.html',{womResponse:wom,templeResponse:temple});const w=dom.window,d=w.document;
 {
  const refresh=w.UGSharedData.refresh;
  w.UGSharedData.refresh=async(source,key)=>{const receipt=await refresh(source,key);if(key==='dikste')receipt.diagnostics={...receipt.diagnostics,detailFailures:['week gains'],historyFailures:['dikste'],trackedOnly:['dikste']};return receipt};
  d.querySelector('[data-refresh-wom]').click();
  await waitFor(()=>panel(d,'wom')?.dataset.syncState==='warning','WOM fallback diagnostics');
  const row=panel(d,'wom').querySelector('[data-sync-step="dikste"]');
  assert.equal(row.dataset.stepState,'warning');assert(row.textContent.includes('history kept'));assert(row.textContent.includes('hiscores update unavailable'));
  assert(d.querySelector('main .data-strip').nextElementSibling.id==='syncProgress','every page mounts progress beside the refresh controls');
  assert.equal(errors.length,0,errors.join('; '));
 }
 console.log('Progress: fallback diagnostics and shared controls on secondary pages passed');
}

(async()=>{await simultaneous();await failures();await diagnostics();console.log('SYNC PROGRESS AUDIT PASSED')})().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1)});
