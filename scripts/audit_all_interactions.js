'use strict';
const assert=require('node:assert/strict');
const {openPage,waitFor}=require('./audit_v25_jsdom');
const pages=['index.html','gim.html','hiscores.html','progress.html','history.html','time-machine.html','chronicle.html','developer.html'];
const prices={26219:{high:10000000,low:10000000},29796:{high:30000000,low:30000000},28338:{high:400000000,low:400000000},29801:{high:50000000,low:50000000},19553:{high:10000000,low:10000000},28316:{high:100000000,low:100000000},28301:{high:10000000,low:10000000},565:{high:200,low:200},28276:{high:1000000,low:1000000}};
const names=['Dikste','Big Dog Aura','Lijpste','Poep Aura','Lompste'];
const graphSelector='[data-skill],[data-v21-skill],[data-v21-boss],[data-v21-metric]';
function visible(el){return !el.closest('[hidden],.hidden')}
function assertLinks(d,selector,label){const cells=[...d.querySelectorAll(selector)];assert(cells.length,label+' has items');for(const c of cells){const a=c.querySelector('a[data-item-id]');assert(a,label+' item is linked: '+c.textContent);assert.equal(new URL(a.href).hostname,'oldschool.runescape.wiki');assert.equal(new URL(a.href).searchParams.get('id'),a.dataset.itemId);assert(a.rel.includes('noopener'));assert.equal(a.target,'_blank')}}
(async()=>{
 let graphClicks=0,itemLinks=0;
 for(const page of pages){
  const requests=[],{dom,errors}=await openPage(page,{priceData:prices,fetchLog:requests});const w=dom.window,d=w.document;
  assert.deepEqual([...d.querySelectorAll('.nav-link')].map(a=>a.getAttribute('href')),['index.html','clog-beta.html','gim.html','hiscores.html','time-machine.html','progress.html','history.html','chronicle.html'],page+' navigation');
  assert.equal(d.querySelectorAll('.nav-link[aria-current="page"]').length,page==='developer.html'?0:1);
  const groups=[...d.querySelectorAll('.nav-dropdown')];assert.equal(groups.length,2);
  assert.deepEqual(groups.map(g=>g.querySelector('button span:nth-child(2)').textContent),['Collection Log','Stats']);
  for(const g of groups){const b=g.querySelector('button'),panel=g.querySelector('.nav-dropdown-panel');assert(panel.hidden);b.click();assert(!panel.hidden);assert.equal(b.getAttribute('aria-expanded'),'true');b.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.equal(d.activeElement,panel.querySelector('a'));d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(panel.hidden);assert.equal(d.activeElement,b);b.blur();const enter=new w.Event('pointerenter');Object.defineProperty(enter,'pointerType',{value:'mouse'});g.dispatchEvent(enter);assert(!panel.hidden,'hover opens');g.dispatchEvent(Object.assign(new w.Event('pointerleave'),{pointerType:'mouse'}));assert(panel.hidden,'pointer leave closes');b.click();d.body.click();assert(panel.hidden,'outside click closes')}
  groups[0].querySelector('button').click();groups[1].querySelector('button').click();assert(groups[0].querySelector('.nav-dropdown-panel').hidden,'only one dropdown opens');d.body.click();
  if(page!=='developer.html')assertLinks(d,'[data-mast-drop]','Latest item on '+page);
  if(page==='gim.html'){
   assertLinks(d,'#clogItemTable .item-cell','Collection Log');itemLinks+=d.querySelectorAll('#clogItemTable a[data-item-id]').length;
   const count=()=>d.querySelectorAll('#clogItemTable tbody tr').length;
   assert.equal(count(),100);const first=d.querySelector('#clogItemTable tbody').textContent;d.querySelector('#clogNext').click();assert.notEqual(d.querySelector('#clogItemTable tbody').textContent,first);d.querySelector('#clogPrev').click();assert.equal(d.querySelector('#clogItemTable tbody').textContent,first);
   const search=d.querySelector('#clogSearch');search.value='OSMUMTEN';search.dispatchEvent(new w.Event('input'));assert(count()>0);assert([...d.querySelectorAll('#clogItemTable tbody tr')].every(r=>r.textContent.toLowerCase().includes('osmumten')));assertLinks(d,'#clogItemTable .item-cell','search results');
   search.value='';search.dispatchEvent(new w.Event('input'));
   for(const status of ['obtained','obtained-any','missing','exclusive','shared','dupes']){
    d.querySelector('#clogStatus').value=status;d.querySelector('#clogStatus').dispatchEvent(new w.Event('change'));
    for(const row of d.querySelectorAll('#clogItemTable tbody tr')){const owners=+row.children[6].textContent.split('/')[0],counts=[...row.children].slice(1,6).map(c=>Number(c.textContent.replace(/[×,]/g,''))||0);assert(status==='obtained'?owners===5:status==='obtained-any'?owners>0:status==='missing'?owners===0:status==='exclusive'?owners===1:status==='shared'?owners>=2:counts.some(n=>n>1),status+' ownership preset')}
   }
   d.querySelector('#clogStatus').value='all';d.querySelector('#clogStatus').dispatchEvent(new w.Event('change'));
   const has=d.querySelector('input[name="rule-dikste"][value="has"]'),missing=d.querySelector('input[name="rule-big dog aura"][value="missing"]');has.click();missing.click();assert.equal(d.querySelector('#clogStatus').value,'custom');assert([...d.querySelectorAll('#clogItemTable tbody tr')].every(r=>r.children[1].textContent.startsWith('×')&&r.children[2].textContent==='—'));d.querySelector('[data-rule-clear]').click();assert.equal(d.querySelector('#clogStatus').value,'all');
   for(const tab of d.querySelectorAll('[data-gim-tab]')){tab.click();await waitFor(()=>!d.querySelector(`[data-gim-panel="${tab.dataset.gimTab}"]`).classList.contains('hidden'),'Collection Log tab '+tab.dataset.gimTab);assert.equal(d.querySelectorAll('[data-gim-panel]:not(.hidden)').length,1);if(tab.dataset.gimTab==='value'){await waitFor(()=>d.querySelector('#clogValue tbody tr'),'valued items');assertLinks(d,'#clogValue .item-cell','Item value')}if(tab.dataset.gimTab==='luck'){await waitFor(()=>d.querySelector('#clogLuckLucky .clog-luck-item'),'Lucky or Not raw list');assert(d.querySelectorAll('#clogLuckPlayers .clog-luck-player-row').length===5,'Lucky or Not compares all five players');assertLinks(d,'#clogLuckLucky .clog-luck-item','Lucky or Not items')}if(tab.dataset.gimTab==='recent')assertLinks(d,'#recentDrops .drop-card','Recent drops')}
   d.querySelector('[data-gim-tab="collection"]').click();
  }
  if(page==='time-machine.html'){d.querySelector('#timeDate').value='2026-01-01';d.querySelector('#timeGo').click();await waitFor(()=>d.querySelector('#timeSkills tbody tr'),'Time Machine results');assert(d.querySelector('#timeSkills [data-v21-skill]'));assert(d.querySelector('#timeBosses [data-v21-boss]'))}
  if(page==='history.html'){for(const el of d.querySelectorAll('.era-details details'))el.open=true;assert(d.querySelector('.era-details [data-v21-skill]'));assert(d.querySelector('.era-details [data-v21-boss]'))}
  if(page==='chronicle.html'){assertLinks(d,'.chronicle-event[data-event-type="drop"]','Chronicle drops');assert(d.querySelector('.chronicle-event[data-event-type="level"] [data-v21-skill]'));for(const kind of ['drops','milestones','all']){d.querySelector(`[data-chrono-filter="${kind}"]`).click();assert(d.querySelectorAll('.chronicle-event').length>0);assert([...d.querySelectorAll('.chronicle-event')].every(e=>kind==='drops'?e.dataset.eventType==='drop':kind==='milestones'?e.dataset.eventType!=='drop':true))}}
  const seen=new Set();for(const button of [...d.querySelectorAll(graphSelector)].filter(visible)){
   const key=JSON.stringify({...button.dataset});if(seen.has(key))continue;seen.add(key);button.focus();button.click();await waitFor(()=>d.querySelector('#v21MetricModal[aria-hidden="false"] svg'),'graph from '+page+' '+button.textContent);
   assert.equal(d.querySelectorAll('.modal:not([hidden])').length,1,'exactly one graph opens');assert(!d.querySelector('#v21ModalChart').innerHTML.includes('NaN'),'finite chart geometry');assert.match(d.querySelector('#v21ModalMembers').textContent,/Dikste/);
   d.querySelector('#v21MetricModal [data-modal-close]').click();assert(d.querySelector('#v21MetricModal').hidden);assert.equal(d.activeElement,button,'close restores focus to its trigger');graphClicks++;
  }
  if(page!=='developer.html')assert(seen.size>0,page+' has graph interactions');
  const picker=d.querySelector('#statsMemberPicker,#clogMemberPicker,#chronicleMemberPicker');if(picker){for(const input of [...picker.querySelectorAll('input[type="checkbox"]')].slice(1)){const current=picker.querySelector(`input[value="${input.value}"]`);if(current.checked)current.click()}await waitFor(()=>picker.querySelectorAll('input:checked').length===1,'one selected member');picker.querySelector('input:checked').click();assert.equal(picker.querySelectorAll('input:checked').length,1,'last member cannot be deselected')}
  assert(!requests.some(r=>r.method==='POST'||r.url.includes('api.wiseoldman.net')||r.url.includes('/api/temple-collection-log')),page+' interactions never refresh data');assert.equal(errors.length,0,errors.join('; '));console.log('Interactions passed:',page,seen.size,'different graphs');
 }
 console.log('ALL INTERACTIONS PASSED:',graphClicks,'graph opens;',itemLinks,'item links on the first Collection Log page; all menus, tabs, filters, and manual-only requests.');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
