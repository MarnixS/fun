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
const bar=element=>element.querySelector('[role="progressbar"]');
const percent=element=>Number(bar(element).getAttribute('aria-valuenow'));
const label=element=>element.querySelector('.sync-progress-label').textContent;

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
  assert.equal(label(panel(d,'wom')),'WOM: Dikste · 0%');
  assert.equal(d.querySelectorAll('#syncProgress p,#syncProgress details,#syncProgress h2').length,0,'the status lives only inside the bars');
  assert.equal(label(panel(d,'temple')),'Temple: Syncing logs · 0%');
  assert(bar(panel(d,'temple')).title.includes('Temple returns the group together'));
  assert(panel(d,'wom').querySelector('.sync-progress-close').hidden,'in-flight progress cannot be dismissed');
  const aria=panel(d,'wom').querySelector('[role="progressbar"]');
  assert.equal(aria.getAttribute('aria-valuemin'),'0');assert.equal(aria.getAttribute('aria-valuemax'),'100');
  await sleep(120);assert.equal(percent(panel(d,'wom')),0,'time alone never advances progress');
  d.querySelector('[data-refresh-wom]').dispatchEvent(new w.Event('click'));
  await sleep(30);assert.equal(refreshes,2,'duplicate clicks reuse the active sync');assert.equal(active,1);
  const values=[];
  for(let i=0;i<keys.length;i++){
   memberGates[i].release();
   await waitFor(()=>percent(panel(d,'wom'))===Math.floor(100*(i+1)/6),'member confirmation '+i);
   const value=percent(panel(d,'wom'));values.push(value);assert(value<100);
   assert(bar(panel(d,'wom')).getAttribute('aria-valuetext').includes(`${i+1}/7 steps processed`));
   assert(label(panel(d,'wom')).includes(i<4?names[i+1]:'Loading data'));
  }
  assert.deepEqual(values,[16,33,50,66,83]);
  assert(label(panel(d,'wom')).includes('Loading data'));
  readGates.wom.release();
  await waitFor(()=>label(panel(d,'wom')).includes('Updating site'),'WOM applying');
  assert.equal(percent(panel(d,'wom')),91,'WOM stays unfinished while browser data is saving');
  templeGate.release();
  await waitFor(()=>label(panel(d,'temple')).includes('Loading data'),'Temple response');
  assert.equal(percent(panel(d,'temple')),80);assert.equal(percent(panel(d,'wom')),91,'independent sources do not overwrite each other');
  readGates.temple.release();
  await waitFor(()=>label(panel(d,'temple')).includes('Updating site'),'Temple applying');
  assert.equal(percent(panel(d,'temple')),90);
  applyGates.wom.release();applyGates.temple.release();
  await waitFor(()=>panel(d,'wom').dataset.syncState==='done'&&panel(d,'temple').dataset.syncState==='done','both completed');
  assert.equal(percent(panel(d,'wom')),100);assert.equal(percent(panel(d,'temple')),100);
  assert.equal(label(panel(d,'wom')),'WOM: Done 5/5 · 100%');
  assert(bar(panel(d,'wom')).getAttribute('aria-valuetext').includes('7/7 steps processed'));
  assert.equal(label(panel(d,'temple')),'Temple: Done 5/5 · 100%');
  assert(bar(panel(d,'temple')).getAttribute('aria-valuetext').includes('3/3 steps processed'));
  assert.equal(d.querySelector('#pageNotice').textContent,'','sync results do not add text below the bars');
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
  assert.equal(label(panel(d,'wom')),'WOM: Warning 4/5 · 100%');
  assert(bar(panel(d,'wom')).title.includes('saved data retained for Big Dog Aura'));
  assert.equal(percent(panel(d,'wom')),100,'all attempted steps completed does not imply all members succeeded');
  d.querySelector('[data-refresh-temple]').click();
  await waitFor(()=>panel(d,'temple')?.dataset.syncState==='warning','partial Temple');
  assert.equal(label(panel(d,'temple')),'Temple: Warning 1/5 · 100%');
  assert(bar(panel(d,'temple')).title.includes('updated from Temple for 1/5'));
  assert(bar(panel(d,'temple')).title.includes('saved data retained'));
  sharedDocs.failSaves=true;
  d.querySelector('[data-refresh-temple]').click();
  await waitFor(()=>panel(d,'temple')?.dataset.syncState==='failed','Temple failed request');
  assert.equal(label(panel(d,'temple')),'Temple: Failed · 80%');
  assert(percent(panel(d,'temple'))<100);assert(!d.querySelector('[data-refresh-temple]').disabled);
  d.querySelector('[data-refresh-wom]').click();
  await waitFor(()=>panel(d,'wom')?.dataset.syncState==='failed','all WOM members failed');
  assert.equal(label(panel(d,'wom')),'WOM: Failed · 83%');
  assert(bar(panel(d,'wom')).title.includes('previous baseline is still saved'));
  assert.equal(percent(panel(d,'wom')),83);assert(!d.querySelector('[data-refresh-wom]').disabled);
  sharedDocs.failSaves=false;
  const read=w.UGSharedData.read;
  w.UGSharedData.read=async()=>{throw new Error('Saved update could not be loaded')};
  d.querySelector('[data-refresh-temple]').click();
  await waitFor(()=>panel(d,'temple')?.dataset.syncState==='failed','saved snapshot read failure');
  assert.equal(label(panel(d,'temple')),'Temple: Failed · 90%');
  assert(bar(panel(d,'temple')).title.includes('Saved update could not be loaded'));
  w.UGSharedData.read=read;
  w.UGTempleStore.save=async()=>false;
  w.Storage.prototype.setItem=()=>{throw new Error('simulated storage quota')};
  d.querySelector('[data-refresh-temple]').click();
  await waitFor(()=>panel(d,'temple')?.dataset.syncState==='warning','storage warning');
  assert.equal(label(panel(d,'temple')),'Temple: Warning 1/5 · 100%');
  assert(bar(panel(d,'temple')).title.includes('shared baseline is safely saved'));
  assert.equal(d.querySelector('#pageNotice').textContent,'');
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
  assert.equal(label(panel(d,'wom')),'WOM: Warning 5/5 · 100%');
  assert(bar(panel(d,'wom')).title.includes('some history requests failed'));
  assert(bar(panel(d,'wom')).title.includes('new hiscores update was unavailable'));
  assert(d.querySelector('main .data-strip').nextElementSibling.id==='syncProgress','every page mounts progress beside the refresh controls');
  assert.equal(errors.length,0,errors.join('; '));
 }
 console.log('Progress: fallback diagnostics and shared controls on secondary pages passed');
}

(async()=>{await simultaneous();await failures();await diagnostics();console.log('SYNC PROGRESS AUDIT PASSED')})().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1)});
