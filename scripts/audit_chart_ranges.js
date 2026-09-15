const assert=require('node:assert/strict');
const {openPage,waitFor}=require('./audit_v25_jsdom');
async function run(){
 const {dom,errors}=await openPage('progress.html');const w=dom.window,d=w.document,C=w.UGV21Charts;
 await waitFor(()=>d.querySelector('#skillGainTable tbody tr'),'skill gains');
 const skillOrder=()=>Array.from(d.querySelectorAll('#skillGainTable tbody tr'),r=>r.querySelector('button').dataset.v21Skill);
 const normal=skillOrder();
 assert.equal(d.querySelector('#skillGainTable [aria-sort="descending"]'),null,'no default XP sort');
 for(const key of ['lijpste','dikste']){
  d.querySelector(`[data-gain-sort="${key}"]`).click();
  const th=d.querySelector('#skillGainTable [aria-sort="descending"]');
  const column=Array.from(th.parentNode.children).indexOf(th);
  const values=Array.from(d.querySelectorAll('#skillGainTable tbody tr'),r=>r.children[column].textContent);
  const number=t=>parseFloat(t.replaceAll(',',''))*({K:1e3,M:1e6,B:1e9}[t.slice(-1).toUpperCase()]||1);
  assert(values.every((v,i)=>!i||number(values[i-1])>=number(v)),'descending XP gains');
 }
 d.querySelector('[data-gain-sort="dikste"]').click();assert.deepEqual(skillOrder(),normal,'repeat click restores order');
 d.querySelector('[data-gain-sort="lijpste"]').click();
 const fixture={profiles:{p:{latestSnapshot:{createdAt:'2026-09-14T12:00:00Z',data:{}}}},snapshots:{p:[{createdAt:'2025-01-01T12:00:00Z',data:{}},{createdAt:'2026-09-13T12:00:00Z',data:{}}]}};
 assert.equal(C.windowSnaps(fixture,'p',7).length,2,'older boundary snapshot is excluded');
 for(const days of [7,30,90,180,365]){
  d.querySelector(`[data-period-button="${days}"]`).click();
  await waitFor(()=>{const s=d.querySelector('#xpChart svg');return s&&+s.dataset.rangeEnd-+s.dataset.rangeStart===days*86400000},`${days}-day chart range`);
  assert.equal(d.querySelector('#skillGainTable [aria-sort="descending"] button').dataset.gainSort,'lijpste','sort retained on period change');
  for(const selector of ['#xpChart','#levelChart','#ehpChart','#ehbChart','#skillChart','#bossChart']){
   const svg=d.querySelector(selector+' svg');assert(svg,selector);assert.equal(+svg.dataset.rangeEnd-+svg.dataset.rangeStart,days*86400000);
   for(const point of svg.querySelectorAll('circle'))assert(+point.getAttribute('cx')>=61.9&&+point.getAttribute('cx')<=882.1,'point remains within selected time axis');
  }
 }
 d.querySelector('[data-gain-sort=""]').click();assert.deepEqual(skillOrder(),normal,'Skill header restores order');
 d.querySelector('[data-v21-skill="attack"]').click();
 await waitFor(()=>d.querySelector('#v21ModalChart svg'),'skill modal');
 for(const days of [7,30,90,180]){
  d.querySelector(`[data-v21-range="${days}"]`).click();
  await waitFor(()=>{const s=d.querySelector('#v21ModalChart svg');return s&&+s.dataset.rangeEnd-+s.dataset.rangeStart===days*86400000},'modal exact range');
 }
 assert.equal(errors.length,0,errors.join('; '));
 console.log('All progress charts and skill modals keep exact selected date ranges');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
