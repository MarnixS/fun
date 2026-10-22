'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),M=require('../docs/assets/stat-progress-model');
const server=http.createServer((req,res)=>{const file=path.join(process.cwd(),'docs',new URL(req.url,'http://localhost').pathname);try{res.setHeader('Connection','close');res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
server.listen(0,'127.0.0.1',async()=>{const doms=[];try{
 process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;const {openPage,waitFor}=require('./audit_v25_jsdom'),requests=[];
 const result=await openPage('progress.html',{fetchLog:requests});doms.push(result.dom);
 const w=result.dom.window,d=w.document,doc=JSON.parse(fs.readFileSync('docs/data/wom-cache.json')),keys=Array.from(w.UGV21.ALL_KEYS),model=M.build(doc,keys);
 const change=(id,value)=>{const select=d.querySelector(id);select.value=value;select.dispatchEvent(new w.Event('change'))};
 assert.equal(d.querySelector('#progressMetric').value,'','no arbitrary skill or weekly result on arrival');
 assert(d.querySelector('#progressResults').hidden);assert(d.querySelector('#progressSupplement').hidden);assert(!d.querySelector('#progressEmpty').hidden);
 assert.equal(d.querySelectorAll('[data-progress-player]').length,0);assert.equal(d.querySelector('#xpChart').children.length,0);
 assert(!d.querySelector('#progressMetric').closest('[hidden],details'),'skill selection is visible without another control');
 assert(d.querySelector('#progressMetric').compareDocumentPosition(d.querySelector('#progressResults'))&w.Node.DOCUMENT_POSITION_FOLLOWING,'selection precedes results');
 assert.equal(w.getComputedStyle(d.querySelector('.mast-status-six')).display,'none','unrelated fixed weekly/current summaries are hidden on this page');
 assert(!d.querySelector('[data-mode="absolute"]'));assert(!d.querySelector('#skillShares'));
 d.querySelector('#progressPeriods [data-progress-window="30"]').click();assert(d.querySelector('#progressResults').hidden,'period selection alone does not show unrelated gains');
 const blankReload=await openPage('progress.html'+w.location.search);doms.push(blankReload.dom);assert(blankReload.dom.window.document.querySelector('#progressResults').hidden,'an unfinished selection survives a shared/reloaded URL');
 change('#progressMetric','agility');assert(!d.querySelector('#progressResults').hidden);assert(d.querySelector('#progressEmpty').hidden);
 function check(kind,metric,days,selected=keys,mode='recent'){
  const {rows,domain}=model.compare(kind,metric,days,selected,mode);
  assert.deepEqual([...d.querySelectorAll('[data-progress-player]')].map(node=>node.dataset.progressPlayer),rows.map(row=>row.key));
  assert.deepEqual([...d.querySelectorAll('[data-progress-rank]')].map(node=>node.dataset.progressRank),rows.map(row=>String(row.rank??'')));
  assert.equal(d.querySelectorAll('#gainCards thead th').length,3,'player table stays three columns');
  assert.equal(d.querySelectorAll('#skillGainTable thead th').length,2,'metric list stays two columns');
  assert.equal(d.querySelectorAll('#skillGainTable .rank-chip').length,0,'no rank badges inside the metric values');
  for(const row of rows){const actual=d.querySelector(`[data-progress-player="${row.key}"] .records-gain b`).textContent;assert.equal(actual,row.gain===null?'—':(mode==='records'?'≥ +':'+')+(kind==='computed'?row.gain.toLocaleString('en-GB',{maximumFractionDigits:1}):Math.round(row.gain).toLocaleString('en-GB')))}
  const svg=d.querySelector('#xpChart svg');if(svg&&d.querySelector('[data-progress-view="timeline"]').getAttribute('aria-pressed')==='true'){
   assert.equal(Number(svg.dataset.rangeEnd)-Number(svg.dataset.rangeStart),domain.end-domain.start);assert.equal(Number(svg.dataset.rangeEnd),domain.end);assert.equal(Number(svg.dataset.yMin),0);
   for(const point of svg.querySelectorAll('circle'))assert(Number(point.getAttribute('cx'))>=61.9&&Number(point.getAttribute('cx'))<=882.1,'observations remain within the period');
  }
 }
 check('xp','agility',30);
 for(const host of ['#progressPeriods','#progressGraphPeriods'])for(const period of M.PERIODS){
  const button=d.querySelector(`${host} [data-progress-window="${period.days}"]`);button.focus();button.click();check('xp','agility',period.days);
  assert.equal(d.activeElement.closest(host)?.id,host.slice(1),'keyboard focus stays at the chosen period control');
  assert.equal(d.querySelector('#progressPeriods [aria-pressed=true]').dataset.progressWindow,String(period.days));
  assert.equal(d.querySelector('#progressGraphPeriods [aria-pressed=true]').dataset.progressWindow,String(period.days));
 }
 assert.equal(new URL(w.location.href).searchParams.get('period'),'max');
 assert(d.querySelector('#progressHeading').textContent.includes('full history'));
 assert(!d.querySelector('#progressTableNote').textContent.includes('max days'));
 assert(!new URL(d.querySelector('#progressRecords').href).searchParams.has('period'),'the separate Time Records page receives no unsupported Max window');
 for(const graph of ['bars','share','timeline']){d.querySelector(`[data-progress-view="${graph}"]`).click();check('xp','agility','max')}
 const maxReload=await openPage('progress.html'+w.location.search);doms.push(maxReload.dom);
 assert.equal(maxReload.dom.window.document.querySelector('#progressPeriods [aria-pressed=true]').dataset.progressWindow,'max','Max survives a shared/reloaded URL');
 assert.equal(maxReload.dom.window.document.querySelector('#progressGraphPeriods [aria-pressed=true]').dataset.progressWindow,'max');
 assert.equal(maxReload.errors.length,0,maxReload.errors.join('; '));
 d.querySelector('#progressPeriods [data-progress-window="365"]').click();
 for(const [family,metric]of [['xp','overall'],['xp','attack'],['level','overall'],['level','agility'],['boss','zulrah'],['computed','ehp'],['computed','ehb']]){
  change('#progressType',family);assert(d.querySelector('#progressResults').hidden,'a new measure waits for its metric');change('#progressMetric',metric);check(family,metric,365);
 }
 change('#progressType','xp');change('#progressMetric','agility');
 for(const graph of ['bars','share','timeline']){d.querySelector(`[data-progress-view="${graph}"]`).click();assert(d.querySelector('#xpChart svg'));assert.equal(d.querySelector(`[data-progress-view="${graph}"]`).getAttribute('aria-pressed'),'true');check('xp','agility',365)}
 const hit=d.querySelector('#xpChart [role="slider"]');hit.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(hit.getAttribute('aria-valuenow'),'0');
 const search=d.querySelector('#progressSearch');d.querySelector('#progressMetricPicker').open=true;search.value='agil';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('#progressMetrics button').length,1);d.querySelector('#progressMetrics button').click();assert.equal(d.activeElement.dataset.progressMetric,'agility');
 search.value='no such skill';search.dispatchEvent(new w.Event('input'));assert(d.querySelector('#progressMetrics').textContent.includes('No matching metrics'));search.value='';search.dispatchEvent(new w.Event('input'));d.querySelector('#progressMetricPicker').open=false;
 const listed=()=>[...d.querySelectorAll('#skillGainTable tbody tr')].filter(row=>row.querySelector('button')).map(row=>({key:row.querySelector('button').dataset.progressMetric,gain:Number(row.lastElementChild.textContent.replace(/[^0-9]/g,''))}));
 assert(listed().every(row=>row.gain>0),'unchanged metrics do not clutter the default gain list');assert(listed().every((row,index,all)=>!index||all[index-1].gain>=row.gain));
 change('#progressSort','name');const names=[...d.querySelectorAll('#skillGainTable tbody button')].map(button=>button.textContent.trim());assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b)));
 d.querySelector('#progressUnchanged').click();assert.equal(listed().length,model.metrics.skills.length+1);
 d.querySelector('#skillGainTable [data-progress-metric="attack"]').click();assert.equal(d.querySelector('#progressMetric').value,'attack');check('xp','attack',365);change('#progressMetric','agility');
 d.querySelector('#progressPeriods [data-progress-window="30"]').click();
 d.querySelector('#statsMemberPicker input[value="lompste"]').click();check('xp','agility',30,keys.filter(key=>key!=='lompste'));assert(!d.querySelector('#progressAll').hidden);
 d.querySelector('#progressAll').click();check('xp','agility',30);assert(d.querySelector('#progressAll').hidden);
 const params=new URL(d.querySelector('#progressRecords').href).searchParams;assert.equal(params.get('type'),'skill-xp');assert.equal(params.get('metric'),'agility');assert.equal(params.get('period'),'30');assert.equal(new URL(d.querySelector('#progressGoal').href).searchParams.get('kind'),'xp');
 assert(!d.querySelector('[data-progress-mode]'),'personal best tabs are absent from Stat Progress');
 assert(d.querySelector('#progressHeading').textContent.includes('latest'));
 const bestReload=await openPage('progress.html?type=skill-xp&metric=agility&period=90&mode=records');doms.push(bestReload.dom);
 const bd=bestReload.dom.window.document;
 assert(!bd.querySelector('[data-progress-mode]'));
 assert(bd.querySelector('#progressHeading').textContent.includes('latest 3 months'),'legacy personal-best URLs show the recent progress view');
 assert(!new URL(bestReload.dom.window.location.href).searchParams.has('mode'),'the removed mode is cleared from shared URLs');
 assert.equal(bd.querySelector('[data-progress-player="lijpste"] .records-gain b').textContent,'+'+model.compare('xp','agility',90,keys,'recent').rows.find(row=>row.key==='lijpste').gain.toLocaleString('en-GB'));
 assert.equal(bestReload.errors.length,0,bestReload.errors.join('; '));
 const updated=structuredClone(doc),next=structuredClone(updated.profiles.dikste.latestSnapshot);next.createdAt=new Date(Date.parse(next.createdAt)+3600000).toISOString();next.data.skills.agility.experience+=1000000000;updated.profiles.dikste.latestSnapshot=next;
 w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:w.UGV21.WKEY,document:updated}}));
 await waitFor(()=>d.querySelector('[data-progress-player]')?.dataset.progressPlayer==='dikste'&&d.querySelector('.records-gain b').textContent.includes('1,000,'),'fresh data updates gains');
 w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:w.UGV21.WKEY,document:{profiles:{},snapshots:{}}}}));
 await waitFor(()=>d.querySelectorAll('[data-progress-rank=""]').length===5,'missing history stays unknown');assert.equal(d.querySelector('#progressMetric').value,'agility','a partial update retains the user’s selected skill');assert(d.querySelector('#xpChart').textContent.includes('At least two'));assert(!d.querySelector('main').textContent.includes('NaN'));
 assert.equal(result.errors.length,0,result.errors.join('; '));assert(!requests.some(request=>request.method==='POST'||request.url.includes('api.wiseoldman.net')||request.url.includes('/api/temple-collection-log')),'browsing gains does not refresh upstream data');
 const linked=await openPage('progress.html?kind=skill&metric=attack&player=dikste&period=7');doms.push(linked.dom);assert.equal(linked.dom.window.document.querySelectorAll('[data-progress-player]').length,1);assert.equal(linked.dom.window.document.querySelector('#progressMetric').value,'attack');
 const weekly=await openPage('progress.html?period=7');doms.push(weekly.dom);assert.equal(weekly.dom.window.document.querySelector('#progressMetric').value,'overall','the existing weekly overview shortcut retains its explicit intent');
 console.log('Stat Progress passed: visible selection before results; gains-only views; all retained metrics; seven synchronized graph periods including Max; full-history graphs and shared URLs; clean three/two-column tables; sort/filter/search; shared selection; legacy links; updates and unknown history.');
 doms.forEach(dom=>dom.window.close());server.close();process.exit(0);
}catch(error){console.error(error);doms.forEach(dom=>dom.window.close());server.close();process.exit(1)}});
