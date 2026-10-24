'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),M=require('../docs/assets/stat-progress-model');
const server=http.createServer((req,res)=>{const file=path.join(process.cwd(),'docs',new URL(req.url,'http://localhost').pathname);try{res.setHeader('Connection','close');res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
server.listen(0,'127.0.0.1',async()=>{const doms=[];try{
 process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;const {openPage,waitFor}=require('./audit_v25_jsdom'),requests=[];
 const result=await openPage('progress.html',{fetchLog:requests});doms.push(result.dom);
 const w=result.dom.window,d=w.document,doc=JSON.parse(fs.readFileSync('docs/data/wom-cache.json')),keys=Array.from(w.UGV21.ALL_KEYS),model=M.build(doc,keys);
 const change=(id,value)=>{const select=d.querySelector(id);select.value=value;select.dispatchEvent(new w.Event('change'))};
 const cards=()=>[...d.querySelectorAll('#progressMetrics [data-progress-metric]')];
 const close=()=>{if(!d.querySelector('#progressDetail').hidden)d.querySelector('#progressClose').click()};
 const choose=key=>d.querySelector(`#progressMetrics [data-progress-metric="${key}"]`).click();
 const type=kind=>{close();d.querySelector(`[data-progress-type="${kind}"]`).click()};
 function overview(kind,days,selected=keys){
  const catalogue=kind==='boss'?model.metrics.bosses:kind==='computed'?['ehp','ehb']:['overall',...model.metrics.skills];
  assert.equal(cards().length,catalogue.length,'every metric is visible, including zero and unknown gains');
  for(const key of catalogue){
   const node=d.querySelector(`#progressMetrics [data-progress-metric="${key}"]`),known=model.compare(kind,key,days,selected).rows.filter(row=>row.gain!==null),gain=known.length?known.reduce((sum,row)=>sum+row.gain,0):null;
   assert(node);assert.equal(node.getAttribute('data-gain'),gain===null?'':String(gain));assert.equal(node.getAttribute('aria-haspopup'),null);assert.equal(node.getAttribute('aria-controls'),'progressDetail');assert(node.querySelector('img'),'each card has a skill or boss icon');
   if(gain===null)assert.equal(node.querySelector('b').textContent,'—');
  }
  const gridStyle=w.getComputedStyle(d.querySelector('#progressMetrics'));assert.equal(gridStyle.overflow,'visible');assert.equal(gridStyle.maxHeight,'none','the overview has no internally scrolling stat picker');
 }
 function check(kind,metric,days,selected=keys){
  const {rows,domain}=model.compare(kind,metric,days,selected);
  assert(!d.querySelector('#progressDetail').hidden,'selection reveals the inline comparison');
  assert.equal(d.querySelector('[data-progress-metric][aria-expanded="true"]')?.dataset.progressMetric,metric,'the overview highlights the current comparison');
  assert.deepEqual([...d.querySelectorAll('[data-progress-player]')].map(node=>node.dataset.progressPlayer),rows.map(row=>row.key));
  assert.deepEqual([...d.querySelectorAll('[data-progress-rank]')].map(node=>node.dataset.progressRank),rows.map(row=>String(row.rank??'')));
  assert.equal(d.querySelectorAll('#gainCards thead th').length,3);
  for(const row of rows){const actual=d.querySelector(`[data-progress-player="${row.key}"] .records-gain b`).textContent;assert.equal(actual,row.gain===null?'—':'+'+(kind==='computed'?row.gain.toLocaleString('en-GB',{maximumFractionDigits:1}):Math.round(row.gain).toLocaleString('en-GB')))}
  const svg=d.querySelector('#xpChart svg');if(svg&&d.querySelector('[data-progress-view="timeline"]').getAttribute('aria-pressed')==='true'){
   assert(svg.getAttribute('aria-label').includes(new Date(domain.end).toLocaleDateString('en-GB',{timeZone:'UTC'})),'graph dates agree with the UTC comparison even in another browser timezone');
   assert.equal(Number(svg.dataset.rangeEnd)-Number(svg.dataset.rangeStart),domain.end-domain.start);assert.equal(Number(svg.dataset.rangeEnd),domain.end);assert.equal(Number(svg.dataset.yMin),0);
   for(const point of svg.querySelectorAll('circle'))assert(Number(point.getAttribute('cx'))>=61.9&&Number(point.getAttribute('cx'))<=882.1);
  }
 }
 assert(d.querySelector('#progressDetail').hidden,'arrival shows the overview without an arbitrary selected stat');
 assert.equal(d.querySelector('#progressDetail').tagName,'SECTION');assert(!d.querySelector('dialog,[role="dialog"],[aria-modal="true"]'),'comparisons stay in the page without a modal');
 assert.equal(d.querySelectorAll('[data-progress-player]').length,0);assert(!d.querySelector('#historicalSourceNote'));
 assert.notEqual(w.getComputedStyle(d.querySelector('.mast-status-six')).display,'none','shared header cards remain visible');assert.notEqual(w.getComputedStyle(d.querySelector('.banner-frame')).display,'none','shared banner remains visible');
 assert(!d.querySelector('[data-progress-mode]'));assert(!d.querySelector('#skillShares'));overview('xp',7);
 for(const period of M.PERIODS){
  const button=d.querySelector(`#progressPeriods [data-progress-window="${period.days}"]`);button.focus();button.click();
  assert.equal(d.activeElement.dataset.progressWindow,String(period.days));assert(d.querySelector('#progressDetail').hidden);overview('xp',period.days);
 }
 const blankReload=await openPage('progress.html'+w.location.search);doms.push(blankReload.dom);assert(blankReload.dom.window.document.querySelector('#progressDetail').hidden,'shared overview does not open an unrelated stat');
 choose('agility');check('xp','agility','max');assert(d.querySelector('#progressHeading').textContent.includes('full history'));
 assert.equal(d.activeElement.id,'progressHeading','choosing a stat moves keyboard focus to its inline heading');
 choose('attack');check('xp','attack','max');choose('agility');check('xp','agility','max');
 d.querySelector('#progressDetail').click();assert(!d.querySelector('#progressDetail').hidden,'clicking the page does not dismiss the comparison');
 choose('agility');assert(d.querySelector('#progressDetail').hidden,'the expanded stat can collapse its inline comparison');choose('agility');check('xp','agility','max');
 for(const period of M.PERIODS){
  const button=d.querySelector(`#progressGraphPeriods [data-progress-window="${period.days}"]`);button.focus();button.click();check('xp','agility',period.days);overview('xp',period.days);
  assert.equal(d.activeElement.closest('#progressGraphPeriods')?.id,'progressGraphPeriods');assert.equal(d.querySelector('#progressPeriods [aria-pressed=true]').dataset.progressWindow,String(period.days));
 }
 assert.equal(new URL(w.location.href).searchParams.get('period'),'max');assert(!new URL(d.querySelector('#progressRecords').href).searchParams.has('period'));
 for(const graph of ['bars','share','timeline']){d.querySelector(`[data-progress-view="${graph}"]`).click();check('xp','agility','max')}
 const maxReload=await openPage('progress.html'+w.location.search);doms.push(maxReload.dom);assert(!maxReload.dom.window.document.querySelector('#progressDetail').hidden);assert.equal(maxReload.dom.window.document.querySelector('#progressGraphPeriods [aria-pressed=true]').dataset.progressWindow,'max');assert.equal(maxReload.errors.length,0,maxReload.errors.join('; '));
 close();assert.equal(d.activeElement.dataset.progressMetric,'agility','closing returns keyboard focus to its card');assert(!d.querySelector('[data-progress-metric][aria-expanded="true"]'));assert(!new URL(w.location.href).searchParams.has('metric'));
 d.querySelector('#progressPeriods [data-progress-window="365"]').click();
 for(const [kind,key]of [['xp','overall'],['xp','attack'],['level','overall'],['level','agility'],['boss','zulrah'],['computed','ehp'],['computed','ehb']]){type(kind);overview(kind,365);choose(key);check(kind,key,365)}
 type('boss');assert.equal(cards().length,model.metrics.bosses.length);const search=d.querySelector('#progressSearch');search.value='cox';search.dispatchEvent(new w.Event('input'));assert.equal(cards().length,2);assert(cards().every(node=>node.dataset.progressMetric.startsWith('chambers_of_xeric')));
 type('xp');search.value='agil';search.dispatchEvent(new w.Event('input'));assert.equal(cards().length,1);choose('agility');close();assert.equal(d.activeElement.dataset.progressMetric,'agility');
 search.value='no such skill';search.dispatchEvent(new w.Event('input'));assert(d.querySelector('#progressMetrics').textContent.includes('No matching'));search.value='';search.dispatchEvent(new w.Event('input'));
 change('#progressSort','gain');const gains=cards().map(node=>node.dataset.gain===''?-Infinity:Number(node.dataset.gain));assert(gains.every((gain,index)=>!index||gains[index-1]>=gain));
 change('#progressSort','name');const names=cards().filter(node=>node.dataset.progressMetric!=='overall').map(node=>node.querySelector('.progress-metric-name').textContent);assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b)));
 d.querySelector('#progressPeriods [data-progress-window="30"]').click();d.querySelector('#statsMemberPicker input[value="lompste"]').click();overview('xp',30,keys.filter(key=>key!=='lompste'));assert(!d.querySelector('#progressAll').hidden);choose('agility');check('xp','agility',30,keys.filter(key=>key!=='lompste'));close();d.querySelector('#progressAll').click();overview('xp',30);assert(d.querySelector('#progressAll').hidden);choose('agility');
 const params=new URL(d.querySelector('#progressRecords').href).searchParams;assert.equal(params.get('type'),'skill-xp');assert.equal(params.get('metric'),'agility');assert.equal(params.get('period'),'30');assert.equal(new URL(d.querySelector('#progressGoal').href).searchParams.get('kind'),'xp');
 for(const graph of ['bars','share','timeline']){d.querySelector(`[data-progress-view="${graph}"]`).click();assert(d.querySelector('#xpChart svg'));check('xp','agility',30)}
 const hit=d.querySelector('#xpChart [role="slider"]');hit.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(hit.getAttribute('aria-valuenow'),'0');
 const bestReload=await openPage('progress.html?type=skill-xp&metric=agility&period=90&mode=records');doms.push(bestReload.dom);const bd=bestReload.dom.window.document;assert(!bd.querySelector('[data-progress-mode]'));assert(bd.querySelector('#progressHeading').textContent.includes('latest 3 months'));assert(!new URL(bestReload.dom.window.location.href).searchParams.has('mode'));assert.equal(bestReload.errors.length,0,bestReload.errors.join('; '));
 const updated=structuredClone(doc),next=structuredClone(updated.profiles.dikste.latestSnapshot);next.createdAt=new Date(Date.parse(next.createdAt)+3600000).toISOString();next.data.skills.agility.experience+=1000000000;updated.profiles.dikste.latestSnapshot=next;
 w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:w.UGV21.WKEY,document:updated}}));await waitFor(()=>d.querySelector('[data-progress-player]')?.dataset.progressPlayer==='dikste'&&d.querySelector('.records-gain b').textContent.includes('1,000,'),'fresh data updates gains');assert(Number(d.querySelector('[data-progress-metric="agility"]').dataset.gain)>1000000000,'the overview updates with the detail');
 w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:w.UGV21.WKEY,document:{profiles:{},snapshots:{}}}}));await waitFor(()=>d.querySelectorAll('[data-progress-rank=""]').length===5,'missing history stays unknown');assert(d.querySelector('#progressHeading').textContent.includes('Agility'));assert(d.querySelector('#xpChart').textContent.includes('At least two'));assert(cards().every(node=>node.querySelector('b').textContent==='—'));assert(!d.querySelector('main').textContent.includes('NaN'));
 assert.equal(result.errors.length,0,result.errors.join('; '));assert(!requests.some(request=>request.method==='POST'||request.url.includes('api.wiseoldman.net')||request.url.includes('/api/temple-collection-log')));
 const linked=await openPage('progress.html?kind=skill&metric=attack&player=dikste&period=7');doms.push(linked.dom);assert.equal(linked.dom.window.document.querySelectorAll('[data-progress-player]').length,1);assert(linked.dom.window.document.querySelector('#progressHeading').textContent.includes('Attack'));
 const weekly=await openPage('progress.html?period=7');doms.push(weekly.dom);assert(weekly.dom.window.document.querySelector('#progressHeading').textContent.includes('Total XP'),'the weekly overview shortcut retains its explicit intent');
 console.log('Stat Progress passed: all stat/boss cards and honest gains, shared header/banner and non-scrolling grid, four families, search/raid aliases/sort, accessible inline comparison, seven synchronized periods including Max, three graphs, focus restoration, filters, shared/legacy URLs, fresh and missing data, and no upstream refresh.');
 doms.forEach(dom=>dom.window.close());server.close();process.exit(0);
}catch(error){console.error(error);doms.forEach(dom=>dom.window.close());server.close();process.exit(1)}});
