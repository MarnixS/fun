'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),M=require('../docs/assets/xp-records-model');
const server=http.createServer((req,res)=>{const file=path.join(process.cwd(),'docs',new URL(req.url,'http://localhost').pathname);try{res.setHeader('Connection','close');res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
server.listen(0,'127.0.0.1',async()=>{const doms=[];try{
 process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;const {openPage,waitFor}=require('./audit_v25_jsdom'),requests=[];
 const result=await openPage('time-records.html?type=skill-xp&metric=agility&period=1',{fetchLog:requests});doms.push(result.dom);const w=result.dom.window,d=w.document;
 await waitFor(()=>d.querySelectorAll('[data-record-key]').length===5&&d.querySelector('#recordsHeading').textContent==='Agility XP · 1 day','saved records with URL state');
 assert.equal(d.querySelector('#nav-record a[href="time-records.html"]').getAttribute('aria-current'),'page');
 assert.equal(d.querySelectorAll('[data-record-window]').length,6);assert.equal(d.querySelectorAll('#recordsComparison tbody tr').length,5);
 assert.equal(d.querySelectorAll('[data-record-type]').length,3,'only three record families');assert(!d.querySelector('.records-intro select'),'record and stat selection use cards');
 assert(d.querySelector('[data-record-metric="overall"] img'));assert(d.querySelector('[data-record-metric="agility"] img'));
 const saved=JSON.parse(fs.readFileSync('docs/data/wom-cache.json')),keys=Array.from(w.UGV21.ALL_KEYS),model=M.build(saved,keys);
 const check=(id,days)=>{
  const expected=model.records(id,days);
  assert.deepEqual([...d.querySelectorAll('[data-record-key]')].map(n=>n.dataset.recordKey),expected.map(r=>r.key));
  assert.deepEqual([...d.querySelectorAll('[data-record-rank]')].map(n=>n.dataset.recordRank),expected.map(r=>String(r.rank??'')));
  expected.forEach(row=>{if(row.record)assert(d.querySelector(`[data-record-key="${row.key}"] .records-gain b`).textContent.includes(row.record.gain.toLocaleString('en-GB')))});
 };
 const choose=(attribute,value)=>d.querySelector(`[data-record-${attribute}="${value}"]`).click();
 check('xp:agility',1);
 for(const p of M.PERIODS){const button=d.querySelector(`[data-record-window="${p.days}"]`);button.focus();button.click();check('xp:agility',p.days);assert.equal(d.querySelector('[data-record-window][aria-pressed=true]').dataset.recordWindow,String(p.days));assert.equal(d.activeElement.dataset.recordWindow,String(p.days),'keyboard focus survives rerender')}
 choose('type','skill-level');check('level:agility',365);choose('metric','overall');check('level:overall',365);assert.equal(d.querySelector('[data-record-metric="overall"]').textContent.trim().replace('✓','').trim(),'Total level');
 choose('type','skill-xp');check('xp:overall',365);assert(d.querySelector('[data-record-metric="overall"]').textContent.includes('Total XP'));
 choose('type','boss');check('boss:chambers_of_xeric',365);
 const search=d.querySelector('#recordsSearch'),find=value=>{search.value=value;search.dispatchEvent(new w.Event('input'))};
 find('vork');assert.equal(d.querySelectorAll('[data-record-metric]').length,1);const vorkath=d.querySelector('[data-record-metric="vorkath"]');assert(vorkath.querySelector('img').src.endsWith('vorkath-icon.png'));vorkath.focus();vorkath.click();check('boss:vorkath',365);assert.equal(d.activeElement.dataset.recordMetric,'vorkath');
 find('no matching boss');assert.equal(d.querySelectorAll('[data-record-metric]').length,0);assert(d.querySelector('#recordsSearchStatus').textContent.includes('No matching'));
 find('cox');assert.equal(d.querySelectorAll('[data-record-metric]').length,2,'raid aliases work');find('');
 choose('type','skill-xp');choose('metric','farming');choose('window','30');check('xp:farming',30);choose('inspect','big dog aura');
 const farming=d.querySelector('[data-record-key="big dog aura"]');assert(farming.querySelector('.records-gain b').textContent.includes('2,189,811'));assert(farming.querySelector('.records-run-note').textContent.includes('exact run dates unknown'));assert(!farming.textContent.includes('5 Jun 2025'));
 assert(d.querySelector('#recordsEvidence').textContent.includes('6,569,431 ÷ 3, rounded up'));assert(d.querySelector('#recordsEvidence').textContent.includes('1,719,359'),'the older observed run remains inspectable, not mislabelled as the maximum');
 const cell=d.querySelector('[data-record-period="7"]');cell.click();assert.equal(d.querySelector('[data-record-window][aria-pressed=true]').dataset.recordWindow,'7');assert.equal(new URL(w.location.href).searchParams.get('player'),cell.dataset.recordPlayer);
 d.querySelector('#recordsMembers input[value="lompste"]').click();assert.equal(d.querySelectorAll('[data-record-key]').length,4);assert.equal(d.querySelectorAll('#recordsComparison tbody tr').length,4);assert(!d.querySelector('#recordsAll').hidden);assert(new URL(w.location.href).searchParams.has('members'));
 d.querySelector('#recordsAll').click();assert.equal(d.querySelectorAll('[data-record-key]').length,5);assert(d.querySelector('#recordsAll').hidden);
 choose('metric','overall');choose('window','1');
 const updated=structuredClone(saved),last=updated.profiles.dikste.latestSnapshot,next=structuredClone(last);next.createdAt=new Date(Date.parse(last.createdAt)+3600000).toISOString();next.data.skills.overall.experience+=1000000000;updated.profiles.dikste.latestSnapshot=next;
 const updates=[];w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:w.UGV21.WKEY,document:updated,waitUntil:promise=>updates.push(promise)}}));
 await Promise.all(updates);await waitFor(()=>d.querySelector('[data-record-key]')?.dataset.recordKey==='dikste'&&Number(d.querySelector('.records-gain b').textContent.replace(/[^0-9]/g,''))>=1000000000,'updated record');assert(updates.length,'sync waits for record recalculation');
 const missing={profiles:{},snapshots:{}};w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:w.UGV21.WKEY,document:missing}}));
 await waitFor(()=>d.querySelectorAll('[data-record-rank=""]').length===5,'unknown history stays unranked');assert(d.querySelector('#recordsEvidence').hidden);assert(!d.querySelector('#main-content').textContent.includes('NaN'));
 for(const [legacy,family]of [['total-xp','skill-xp'],['total-level','skill-level']]){const linked=await openPage('time-records.html?type='+legacy);doms.push(linked.dom);const page=linked.dom.window.document;assert.equal(page.querySelector('[data-record-type][aria-pressed=true]').dataset.recordType,family);assert.equal(page.querySelector('[data-record-metric][aria-pressed=true]').dataset.recordMetric,'overall')}
 assert.equal(result.errors.length,0,result.errors.join('; '));assert(!requests.some(r=>r.method==='POST'||r.url.includes('api.wiseoldman.net')||r.url.includes('/api/temple-collection-log')),'no automatic upstream refresh');
 console.log('Time Records UI passed: three families, icon cards, totals, search, all windows, Farming proof and unknown dates, possible ranks, keyboard focus, comparison matrix, legacy URLs, member filters, saved updates and no automatic WOM requests.');
 doms.forEach(dom=>dom.window.close());server.close();process.exit(0);
}catch(error){console.error(error);doms.forEach(dom=>dom.window.close());server.close();process.exit(1)}});
