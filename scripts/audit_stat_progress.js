'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),M=require('../docs/assets/stat-progress-model');
const server=http.createServer((req,res)=>{const file=path.join(process.cwd(),'docs',new URL(req.url,'http://localhost').pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
server.listen(0,'127.0.0.1',async()=>{const doms=[];try{
 process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;const {openPage,waitFor}=require('./audit_v25_jsdom'),requests=[];
 const result=await openPage('progress.html?type=skill-xp&metric=agility&period=1',{fetchLog:requests});doms.push(result.dom);
 const w=result.dom.window,d=w.document,doc=JSON.parse(fs.readFileSync('docs/data/wom-cache.json')),keys=Array.from(w.UGV21.ALL_KEYS),model=M.build(doc,keys);
 await waitFor(()=>d.querySelectorAll('[data-progress-player]').length===5,'progress loaded');
 assert.equal(d.querySelector('#progressHeading').textContent,'Agility XP gained · 1 day');
 assert.equal(d.querySelectorAll('#progressPeriods [data-progress-window]').length,6);assert.equal(d.querySelectorAll('#progressGraphPeriods [data-progress-window]').length,6);
 assert(d.querySelectorAll('#progressHighlights [data-progress-metric]').length>0,'biggest progressed stats are highlighted immediately');
 assert(!d.querySelector('[data-mode="absolute"]'));assert(!d.querySelector('#skillShares'));
 function check(kind,metric,days,selected=keys){
  const {rows,domain}=model.compare(kind,metric,days,selected);
  assert.deepEqual([...d.querySelectorAll('[data-progress-player]')].map(n=>n.dataset.progressPlayer),rows.map(r=>r.key));
  assert.deepEqual([...d.querySelectorAll('[data-progress-rank]')].map(n=>n.dataset.progressRank),rows.map(r=>String(r.rank??'')));
  for(const row of rows){const actual=d.querySelector(`[data-progress-player="${row.key}"] .records-gain b`).textContent;assert.equal(actual,row.gain===null?'—':'+'+(kind==='computed'?row.gain.toLocaleString('en-GB',{maximumFractionDigits:1}):Math.round(row.gain).toLocaleString('en-GB')))}
  const svg=d.querySelector('#xpChart svg');if(svg&&d.querySelector('[data-progress-view="timeline"]').getAttribute('aria-pressed')==='true'){
   assert.equal(Number(svg.dataset.rangeEnd)-Number(svg.dataset.rangeStart),days*M.DAY);assert.equal(Number(svg.dataset.rangeEnd),domain.end);assert.equal(Number(svg.dataset.yMin),0);
   for(const point of svg.querySelectorAll('circle'))assert(Number(point.getAttribute('cx'))>=61.9&&Number(point.getAttribute('cx'))<=882.1,'all observations stay within selected dates');
  }
 }
 for(const p of M.PERIODS){const b=d.querySelector(`[data-progress-window="${p.days}"]`);b.focus();b.click();check('xp','agility',p.days);assert.equal(d.activeElement.dataset.progressWindow,String(p.days))}
 for(const p of M.PERIODS){const b=d.querySelector(`#progressGraphPeriods [data-progress-window="${p.days}"]`);b.focus();b.click();check('xp','agility',p.days);assert.equal(d.activeElement.closest('#progressGraphPeriods')?.id,'progressGraphPeriods');assert.equal(d.querySelector('#progressPeriods [aria-pressed=true]').dataset.progressWindow,String(p.days));assert(d.querySelector('#progressHighlightsTitle').textContent.includes(p.label))}
 const change=(id,value)=>{const select=d.querySelector(id);select.value=value;select.dispatchEvent(new w.Event('change'))};
 for(const [type,kind,key]of [['total-xp','xp','overall'],['total-level','level','overall'],['skill-level','level','agility'],['boss','boss','chambers_of_xeric'],['ehp','computed','ehp'],['ehb','computed','ehb']]){change('#progressType',type);check(kind,key,365)}
 change('#progressType','skill-xp');change('#progressMetric','attack');check('xp','attack',365);
 const search=d.querySelector('#progressSearch');search.value='agil';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('#progressMetrics button').length,1);assert.equal(d.querySelector('#progressMetrics button').textContent.trim(),'Agility');d.querySelector('#progressMetrics button').click();check('xp','agility',365);assert.equal(d.activeElement.dataset.progressMetric,'xp:agility');
 search.value='no such skill';search.dispatchEvent(new w.Event('input'));assert(d.querySelector('#progressMetrics').textContent.includes('No matching stats'));search.value='';search.dispatchEvent(new w.Event('input'));
 d.querySelector('[data-progress-view="bars"]').click();assert(d.querySelector('#xpChart svg rect'));assert.equal(new URL(w.location.href).searchParams.get('view'),'bars');check('xp','agility',365);
 d.querySelector('[data-progress-view="timeline"]').click();assert.equal(new URL(w.location.href).searchParams.get('view'),null);check('xp','agility',365);
 const hit=d.querySelector('#xpChart [role="slider"]');if(hit){hit.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(hit.getAttribute('aria-valuenow'),'0');assert(d.querySelector('.v21-chart-readout').textContent.includes('Dikste'))}
 d.querySelector('[data-progress-sort="lijpste"]').click();assert.equal(d.querySelector('#skillGainTable th[aria-sort="descending"] button').dataset.progressSort,'lijpste');
 d.querySelector('[data-progress-window="30"]').click();assert.equal(d.querySelector('#skillGainTable th[aria-sort="descending"] button').dataset.progressSort,'lijpste');
 d.querySelector('#statsMemberPicker input[value="lompste"]').click();check('xp','agility',30,keys.filter(k=>k!=='lompste'));assert.equal(d.querySelectorAll('#skillGainTable thead th').length,5);assert(!d.querySelector('#progressAll').hidden);
 d.querySelector('#progressAll').click();check('xp','agility',30);assert(d.querySelector('#progressAll').hidden);
 const params=new URL(d.querySelector('#progressRecords').href).searchParams;assert.equal(params.get('type'),'skill-xp');assert.equal(params.get('metric'),'agility');assert.equal(params.get('period'),'30');
 assert.equal(new URL(d.querySelector('#progressGoal').href).searchParams.get('metric'),'agility');
 const updated=structuredClone(doc),next=structuredClone(updated.profiles.dikste.latestSnapshot);next.createdAt=new Date(Date.parse(next.createdAt)+3600000).toISOString();next.data.skills.agility.experience+=1000000000;updated.profiles.dikste.latestSnapshot=next;
 w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:w.UGV21.WKEY,document:updated}}));
 await waitFor(()=>d.querySelector('[data-progress-player]')?.dataset.progressPlayer==='dikste'&&d.querySelector('.records-gain b').textContent.includes('1,000,'),'fresh data updates gains');
 w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:w.UGV21.WKEY,document:{profiles:{},snapshots:{}}}}));
 await waitFor(()=>d.querySelectorAll('[data-progress-rank=""]').length===5,'missing history is unknown');assert(d.querySelector('#xpChart').textContent.includes('At least two'));assert(!d.querySelector('main').textContent.includes('NaN'));
 assert.equal(result.errors.length,0,result.errors.join('; '));assert(!requests.some(r=>r.method==='POST'||r.url.includes('api.wiseoldman.net')||r.url.includes('/api/temple-collection-log')),'viewing and choosing metrics never refresh external data');
 const linked=await openPage('progress.html?kind=skill&metric=attack&player=dikste&period=7');doms.push(linked.dom);assert.equal(linked.dom.window.document.querySelectorAll('[data-progress-player]').length,1);assert.equal(linked.dom.window.document.querySelector('#progressMetric').value,'attack');
 console.log('Stat Progress UI passed: six windows, XP/level/KC/EHP/EHB, actual ranks and values, search, graphs and zero baseline, keyboard inspector, sorting, filters, goal/record/legacy links, data updates and missing history.');
 doms.forEach(dom=>dom.window.close());server.close();process.exit(0);
}catch(error){console.error(error);doms.forEach(dom=>dom.window.close());server.close();process.exit(1)}});
