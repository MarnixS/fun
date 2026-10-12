'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),M=require('../docs/assets/xp-records-model');
const server=http.createServer((req,res)=>{const file=path.join(process.cwd(),'docs',new URL(req.url,'http://localhost').pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
server.listen(0,'127.0.0.1',async()=>{let dom;try{
 process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;const {openPage,waitFor}=require('./audit_v25_jsdom'),requests=[];
 const result=await openPage('xp-records.html?type=skill-xp&metric=agility&period=1',{fetchLog:requests});dom=result.dom;const w=dom.window,d=w.document;
 await waitFor(()=>d.querySelectorAll('[data-record-key]').length===5&&d.querySelector('#recordsHeading').textContent==='Agility XP · 1 day','saved records with URL state');
 assert.equal(d.querySelector('#nav-record a[href="xp-records.html"]').getAttribute('aria-current'),'page');
 assert.equal(d.querySelectorAll('[data-record-window]').length,6);assert.equal(d.querySelectorAll('#recordsComparison tbody tr').length,5);
 const saved=JSON.parse(fs.readFileSync('docs/data/wom-cache.json')),keys=Array.from(w.UGV21.ALL_KEYS),model=M.build(saved,keys);
 const check=(id,days)=>{
  const expected=model.records(id,days);
  assert.deepEqual([...d.querySelectorAll('[data-record-key]')].map(n=>n.dataset.recordKey),expected.map(r=>r.key));
  assert.deepEqual([...d.querySelectorAll('[data-record-rank]')].map(n=>n.dataset.recordRank),expected.map(r=>String(r.rank??'')));
  expected.forEach(row=>{if(row.record)assert(d.querySelector(`[data-record-key="${row.key}"] .records-gain b`).textContent.includes(row.record.gain.toLocaleString('en-GB')))});
 };
 check('xp:agility',1);
 for(const p of M.PERIODS){const button=d.querySelector(`[data-record-window="${p.days}"]`);button.focus();button.click();check('xp:agility',p.days);assert.equal(d.querySelector('[data-record-window][aria-pressed=true]').dataset.recordWindow,String(p.days));assert.equal(d.activeElement.dataset.recordWindow,String(p.days),'keyboard focus survives rerender')}
 const type=d.querySelector('#recordsType'),change=()=>type.dispatchEvent(new w.Event('change'));
 for(const [choice,id] of [['total-xp','xp:overall'],['total-level','level:overall'],['skill-level','level:agility'],['boss','boss:chambers_of_xeric']]){type.value=choice;change();check(id,365)}
 const metric=d.querySelector('#recordsMetric');metric.value='vorkath';metric.dispatchEvent(new w.Event('change'));check('boss:vorkath',365);
 const inspect=d.querySelector('[data-record-inspect]:not([disabled])');inspect.click();assert(d.querySelector('#recordsEvidence').textContent.includes(w.UGV21.player(inspect.dataset.recordInspect).name));
 const cell=d.querySelector('[data-record-period="7"]');cell.click();assert.equal(d.querySelector('[data-record-window][aria-pressed=true]').dataset.recordWindow,'7');assert.equal(new URL(w.location.href).searchParams.get('player'),cell.dataset.recordPlayer);
 d.querySelector('#recordsMembers input[value="lompste"]').click();assert.equal(d.querySelectorAll('[data-record-key]').length,4);assert.equal(d.querySelectorAll('#recordsComparison tbody tr').length,4);assert(!d.querySelector('#recordsAll').hidden);assert(new URL(w.location.href).searchParams.has('members'));
 d.querySelector('#recordsAll').click();assert.equal(d.querySelectorAll('[data-record-key]').length,5);assert(d.querySelector('#recordsAll').hidden);
 // A new shared baseline rerenders the records, without fetching upstream.
 type.value='total-xp';change();d.querySelector('[data-record-window="1"]').click();
 const updated=structuredClone(saved),last=updated.profiles.dikste.latestSnapshot,next=structuredClone(last);
 next.createdAt=new Date(Date.parse(last.createdAt)+3600000).toISOString();next.data.skills.overall.experience+=1000000000;updated.profiles.dikste.latestSnapshot=next;
 w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:w.UGV21.WKEY,document:updated}}));
 await waitFor(()=>d.querySelector('[data-record-key]')?.dataset.recordKey==='dikste'&&Number(d.querySelector('.records-gain b').textContent.replace(/[^0-9]/g,''))>=1000000000,'updated record');
 const missing={profiles:{},snapshots:{}};w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:w.UGV21.WKEY,document:missing}}));
 await waitFor(()=>d.querySelectorAll('[data-record-rank=""]').length===5,'unknown history stays unranked');assert(d.querySelector('#recordsEvidence').hidden);assert(!d.querySelector('#main-content').textContent.includes('NaN'));
 assert.equal(result.errors.length,0,result.errors.join('; '));assert(!requests.some(r=>r.method==='POST'||r.url.includes('api.wiseoldman.net')||r.url.includes('/api/temple-collection-log')),'no automatic upstream refresh');
 console.log('XP Records UI passed: all windows, XP/level/boss metrics, actual values and ranks, evidence, matrix, URL state, member comparison, saved updates, missing history and no automatic WOM requests.');
 dom.window.close();server.close();process.exit(0);
}catch(error){console.error(error);dom?.window.close();server.close();process.exit(1)}});
