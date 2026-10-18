'use strict';
const assert=require('node:assert/strict'),{openPage,waitFor}=require('./audit_v25_jsdom');
(async()=>{
 const requests=[],{dom,errors}=await openPage('history.html',{fetchLog:requests}),w=dom.window,d=w.document;
 await waitFor(()=>d.querySelector('.era-story'),'readable eras');assert.equal(d.querySelectorAll('.era-player').length,5);assert(d.querySelectorAll('.era-story').length>20);assert.equal(d.querySelectorAll('.timeline-row').length,5);
 assert.equal(d.querySelector('[data-timeline-range][aria-pressed=true]').dataset.timelineRange,'365');
 assert.equal(d.querySelector('.nav-link[href="history.html"]').textContent.trim(),'TTimeline');
 assert.equal(d.querySelector('.nav-link[href="collection-log.html"]').textContent.trim(),'GCollection Log Classic');
 let previous=Infinity;
 for(const range of ['max','365','90','30','7']){d.querySelector(`[data-timeline-range="${range}"]`).click();const chart=d.querySelector('.activity-timeline'),start=+chart.dataset.start,end=+chart.dataset.end;if(range!=='max')assert.equal(end-start,+range*864e5);const cards=[...d.querySelectorAll('.era-story')];assert(cards.length<=previous,'shorter ranges cannot add eras');previous=cards.length;assert.equal(cards.length,d.querySelectorAll('[data-era-target]').length);for(const card of cards){assert(+card.dataset.end>start);assert(+card.dataset.start<=end)}for(const bar of d.querySelectorAll('[data-era-target]')){assert(parseFloat(bar.style.left)>=0);assert(parseFloat(bar.style.left)+parseFloat(bar.style.width)<=100.000001)}}
 d.querySelector('[data-timeline-range="max"]').click();const firstBar=d.querySelector('[data-era-target]');firstBar.click();const evidence=d.getElementById(firstBar.dataset.eraTarget);assert(evidence.open);if(evidence.closest('.era-older'))assert(evidence.closest('.era-older').open);
 d.querySelector('[data-timeline-range="365"]').click();
 const historyPicker=d.querySelector('#statsMemberPicker');for(const key of ['big dog aura','lijpste','poep aura','lompste'])historyPicker.querySelector(`input[value="${key}"]`).click();assert.equal(d.querySelectorAll('.timeline-row').length,1);assert.equal(d.querySelectorAll('.era-player').length,1);assert(d.querySelector('.timeline-player').textContent.includes('Dikste'));assert.equal(d.querySelector('[data-timeline-range][aria-pressed=true]').dataset.timelineRange,'365');for(const key of ['big dog aura','lijpste','poep aura','lompste'])historyPicker.querySelector(`input[value="${key}"]`).click();

 const old=d.querySelector('.era-details').textContent;d.querySelector('#eraResolution').value='28';d.querySelector('#eraResolution').dispatchEvent(new w.Event('change'));assert.notEqual(d.querySelector('.era-details').textContent,old,'time resolution recomputes stories');assert.equal(d.querySelector('#eraResolution').value,'28');
 assert(d.querySelector('.era-story.era-unknown').textContent.includes('gap'));assert(d.querySelector('.era-story [data-v21-skill]'));assert(d.querySelector('.era-story [data-v21-boss]'));
 assert.equal(errors.length,0,errors.join('; '));
 for(const page of ['progress.html','hiscores.html']){
 const {dom,errors}=await openPage(page,{fetchLog:requests}),w=dom.window,d=w.document;
 if(page==='progress.html'){
  const select=d.querySelector('#progressMetric');assert.equal(select.value,'');assert(d.querySelector('#progressResults').hidden);
  d.querySelector('#progressPeriods [data-progress-window="365"]').click();
  select.value='attack';select.dispatchEvent(new w.Event('change'));d.querySelector('[data-progress-view="share"]').click();
  const model=w.UGStatProgress.build(await w.UGV21.loadWom(),Array.from(w.UGV21.ALL_KEYS));
  for(const option of [...select.options].filter(option=>option.value)){
   select.value=option.value;select.dispatchEvent(new w.Event('change'));
   const rows=model.compare('xp',option.value,365).rows.filter(row=>row.gain>0),total=rows.reduce((sum,row)=>sum+row.gain,0),svg=d.querySelector('#xpChart svg');
   assert.equal(d.querySelectorAll('#gainCards [data-progress-player]').length,5);assert(!d.querySelector('#xpChart').innerHTML.includes('NaN'));
   if(total){assert(svg);for(const row of rows)assert(svg.getAttribute('aria-label').includes(w.UGV21.player(row.key).name+': '+(100*row.gain/total).toFixed(1)+' percent'))}else assert(!svg);
  }
  select.value='overall';select.dispatchEvent(new w.Event('change'));
  const picker=d.querySelector('#statsMemberPicker');for(const key of ['big dog aura','lijpste','poep aura','lompste'])picker.querySelector(`input[value="${key}"]`).click();
  assert.equal(d.querySelectorAll('#gainCards [data-progress-player]').length,1);assert(d.querySelector('#xpChart svg').getAttribute('aria-label').includes('Dikste: 100.0 percent'));
  d.querySelector('[data-progress-view="timeline"]').click();assert(d.querySelector('#xpChart svg[data-y-min="0"]'));assert.equal(errors.length,0,errors.join('; '));continue;
 }
 const trigger=d.querySelector('[data-v21-skill]');trigger.click();await waitFor(()=>d.querySelector('#v21MetricModal:not([hidden])'),'skill dialog');d.querySelector('[data-v21-modal-view="share"]').click();assert.equal(d.querySelectorAll('#v21ModalChart svg').length,2);assert(d.querySelector('#v21MetricModal .modal-periods').hidden);assert.equal(w.getComputedStyle(d.querySelector('#v21MetricModal .modal-periods')).display,'none','date controls are visually hidden in share mode');assert.equal(d.querySelectorAll('#v21ModalChart tbody tr').length,5);
 const picker=d.querySelector('#statsMemberPicker');for(const key of ['big dog aura','lijpste','poep aura','lompste'])picker.querySelector(`input[value="${key}"]`).click();await waitFor(()=>d.querySelectorAll('#v21ModalChart tbody tr').length===1,'shares follow selected members');assert(d.querySelector('#v21ModalChart svg').getAttribute('aria-label').includes('100.0 percent'));assert(!d.querySelector('#v21ModalChart').innerHTML.includes('NaN'));
 d.querySelector('[data-v21-modal-view="timeline"]').click();assert(!d.querySelector('#v21MetricModal .modal-periods').hidden);assert(d.querySelector('#v21ModalChart svg'));d.querySelector('[data-modal-close]').click();assert(d.querySelector('#v21MetricModal').hidden);assert.equal(errors.length,0,errors.join('; '));
 }
 assert(!requests.some(r=>r.method==='POST'||r.url.includes('api.wiseoldman.net')||r.url.includes('/api/temple-collection-log')),'no upstream refresh from eras or pie interactions');
 console.log('Activity eras, progress gain shares and Current Stats XP/level contribution pies passed: resolution, evidence, all skills, filters, modes, one-member pies and no automatic updates.');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
