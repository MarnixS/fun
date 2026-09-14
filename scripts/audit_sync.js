'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {openPage,waitFor,click}=require('./audit_v25_jsdom');
const keys=['dikste','big dog aura','lijpste','poep aura','lompste'];
const W='ug-v20-wom-cache',T='ug-v20-temple-cache';
function updated(){
 const w=JSON.parse(fs.readFileSync('docs/data/wom-cache.json'));
 const t=JSON.parse(fs.readFileSync('docs/data/temple-clog.json'));
 w.fetchedAt=t.fetchedAt=Date.now()+1000;
 const snap=w.profiles.dikste.latestSnapshot;
 const future=new Date(Date.now()+86400000);future.setHours(12,0,0,0);snap.createdAt=future.toISOString();snap.id=999999999;
 snap.data.skills.attack.level=98;snap.data.skills.attack.experience=12345678;
 snap.data.skills.overall.level=2222;snap.data.skills.overall.experience=123456789;
 snap.data.bosses.zulrah.kills=4321;
 for(const period of ['week','month','year'])w.gains[period].dikste.data.skills.overall.experience.gained=9876543;
 t.players.dikste={data:{items:{General:[{id:700001,name:'Sync regression item',count:3,date:Math.floor(Date.now()/1000)}]},total_collections_finished:1}};
 t.recent=[{id:700001,name:'Sync regression item',player:'Dikste',date_unix:Math.floor(Date.now()/1000)}];
 return {w,t};
}
function send(window,key,document){window.dispatchEvent(new window.CustomEvent('ug:data-updated',{detail:{key,document,source:'storage'}}))}
async function run(){
 const {w,t}=updated();
 for(const page of ['index.html','hiscores.html','progress.html','gim.html','history.html','time-machine.html','chronicle.html']){
  console.log('sync regression',page);
  const {dom,errors}=await openPage(page);const win=dom.window,d=win.document;
  if(page==='time-machine.html'){d.querySelector('#timeDate').value=w.profiles.dikste.latestSnapshot.createdAt.slice(0,10);click(win,d.querySelector('#timeGo'));await waitFor(()=>d.querySelector('#timeStanding tbody'),'time initial');}
  if(page==='hiscores.html'){click(win,d.querySelector('[data-v21-skill="attack"]'));await waitFor(()=>d.querySelector('#v21ModalChart svg'),'modal');click(win,d.querySelector('[data-v21-modal-view="bars"]'));}
  send(win,W,structuredClone(w));send(win,T,structuredClone(t));
  await waitFor(()=>d.querySelector('[data-wom-status] b').textContent.includes('2026'),'status');
  if(page==='index.html'){
   await waitFor(()=>d.querySelector('#standingTable').textContent.includes('2,222'),'standing refreshed');
   await waitFor(()=>d.querySelector('.player-card .v22-clog-quick')?.textContent.includes('Unlocked1'),'overview clog refreshed');
   click(win,d.querySelector('[data-period-button="7"]'));
   await waitFor(()=>d.querySelector('.player-card .v22-clog-quick'),'overview survives period render');
  }
  if(page==='hiscores.html'){
   await waitFor(()=>d.querySelector('#currentSkillsTable').textContent.includes('Lv 98'),'skill refresh');
   assert(d.querySelector('#bossTable').textContent.includes('4,321'));
   await waitFor(()=>d.querySelector('#v21ModalChart').textContent.includes('12.3M'),'open graph refresh');
  }
  if(page==='progress.html')await waitFor(()=>d.querySelector('#gainCards').textContent.includes('9.88M'),'gain refresh');
  if(page==='gim.html'){
   await waitFor(()=>d.querySelector('#recentDrops').textContent.includes('Sync regression item'),'drop refresh');
   for(const b of d.querySelectorAll('[data-gim-tab]')){click(win,b);await new Promise(r=>setTimeout(r,30));}
   click(win,d.querySelector('[data-gim-tab="items"]')||d.querySelector('[data-gim-tab]'));
   d.querySelector('#clogSearch').value='Sync regression item';d.querySelector('#clogSearch').dispatchEvent(new win.Event('input',{bubbles:true}));
   await waitFor(()=>d.querySelector('#clogItemTable').textContent.includes('Sync regression item'),'search latest data');
   await new Promise(r=>setTimeout(r,1100));assert.equal(d.querySelectorAll('#clogItemTable thead th').length,9,'old renderer must never overwrite table');
  }
  if(page==='time-machine.html')await waitFor(()=>d.querySelector('#timeStanding').textContent.includes('2,222'),'time recomputed');
  if(page==='chronicle.html')await waitFor(()=>d.querySelector('#chronicle').textContent.includes('Sync regression item'),'chronicle drop');
  if(page==='history.html')assert(d.querySelector('#historyCoverage').textContent.includes('2026'));
  assert.equal(errors.length,0,errors.join('; '));
 }
 // A proxy response may include stale fallback logs; those must not be counted as fresh.
 const partial={...structuredClone(t),refreshDiagnostics:{freshPlayers:['dikste'],failedPlayers:keys.slice(1)}};
 const {dom:pd}=await openPage('gim.html',{templeResponse:partial});
 const pw=pd.window;
 click(pw,pw.document.querySelector('[data-refresh-temple]'));
 await waitFor(()=>pw.document.querySelector('#pageNotice').textContent.includes('updated from Temple for 1/5'),'partial refresh count');
 assert(pw.document.querySelector('#pageNotice').textContent.includes('saved data retained'));
 // Storage quota errors must not prevent the specialised module from seeing successful sync data.
 const {dom:qd}=await openPage('gim.html',{templeResponse:t});
 const qw=qd.window;
 qw.Storage.prototype.setItem=function(){throw new Error('simulated storage quota')};
 click(qw,qw.document.querySelector('[data-refresh-temple]'));
 await waitFor(()=>qw.document.querySelector('#pageNotice').textContent.includes('browser storage failed'),'quota warning');
 await waitFor(()=>qw.document.querySelector('#recentDrops').textContent.includes('Sync regression item'),'quota in-memory redraw');
 assert.equal(qw.localStorage.getItem(T),null);
 // An unavailable selection remains unknown throughout the Collection Log.
 const {dom:ud}=await openPage('gim.html',{selection:['lompste']});
 await waitFor(()=>ud.window.document.querySelector('#clogSummary').textContent.includes('Unknown'),'unsynced summary');
 assert(ud.window.document.querySelector('#clogItemTable').textContent.includes('unknown data'));
 const {dom:rd}=await openPage('developer.html');const rw=rd.window;
 const restore=rw.document.querySelector('[data-reload-temple]');
 assert.equal(restore.textContent,'Restore shared Collection Log');
 rw.localStorage.setItem(T,JSON.stringify(t));send(rw,T,t);
 const originalFetch=rw.fetch;
 rw.fetch=async(input,options)=>String(input).includes('data/temple-clog.json')?new Response('{}',{status:503}):originalFetch(input,options);
 click(rw,restore);
 await waitFor(()=>rw.document.querySelector('#pageNotice').textContent.includes('Restore failed'),'failed restore');
 assert.equal(JSON.parse(rw.localStorage.getItem(T)).fetchedAt,t.fetchedAt,'failed restore retains newer browser data');
 rw.fetch=originalFetch;click(rw,restore);
 await waitFor(()=>rw.document.querySelector('#pageNotice').textContent.includes('Shared Collection Log restored'),'restore success');
 assert.equal(rw.localStorage.getItem(T),null);
 assert.notEqual((await rw.UGV21.loadClog()).fetchedAt,t.fetchedAt,'restore updates module cache');
 console.log('SYNC REGRESSION AUDIT PASSED');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
