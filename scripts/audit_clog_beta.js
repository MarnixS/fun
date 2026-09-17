'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../docs/assets/clog-beta-model'),{openPage,waitFor}=require('./audit_v25_jsdom');
const doc=JSON.parse(fs.readFileSync('docs/data/temple-clog.json'));
const keys=Object.keys(doc.players),players=keys.map(key=>({key}));
const model=M.build(doc,players),ids=[...new Set(model.categories.flatMap(c=>c.ids))];
assert(model.categories.length>100,'full saved category map');assert(ids.length>1500,'full saved item catalogue');assert.deepEqual([...new Set(model.categories.map(c=>c.tab))],M.TABS);
for(const id of ids){const s=M.shares(model,id,players);assert(Number.isFinite(s.total));assert(s.entries.every(p=>p.count>=0));assert(Math.abs(s.entries.reduce((n,p)=>n+p.share,0)-(s.total?1:0))<1e-10)}
const synthetic=M.build({players:{a:{data:{items:{one:[{id:1,count:3}],two:[{id:1,count:3},{id:2,count:0}]}}},b:{data:{items:[{id:1,count:1}]}},c:{error:'offline'}}},[{key:'a'},{key:'b'},{key:'c'}]);
assert.deepEqual(M.shares(synthetic,1,[{key:'a'},{key:'b'},{key:'c'}]).entries.map(p=>[p.count,p.share]),[[3,.75],[1,.25],[null,0]],'shared-category items are counted once per player; unavailable stays unknown');
assert.equal(M.shares(synthetic,2,[{key:'a'},{key:'b'}]).total,0);
(async()=>{
 const requests=[],{dom,errors}=await openPage('clog-beta.html',{fetchLog:requests}),w=dom.window,d=w.document;
 await waitFor(()=>d.querySelectorAll('[data-beta-tab]').length===5,'beta saved log');
 assert.equal(d.querySelectorAll('#betaMembers input[type=checkbox]').length,5);
 let checked=0;
 for(const tab of M.TABS){d.querySelector(`[data-beta-tab="${tab}"]`).click();
  const cats=model.categories.filter(c=>c.tab===tab);assert.equal(d.querySelectorAll('[data-beta-category]').length,cats.length);
  for(const c of cats){d.querySelector(`[data-beta-category="${c.key}"]`).click();const buttons=[...d.querySelectorAll('[data-beta-item]')];assert.equal(buttons.length,c.ids.length,c.key);assert.deepEqual(buttons.map(b=>+b.dataset.betaItem),c.ids);
   for(const b of buttons){const id=+b.dataset.betaItem,s=M.shares(model,id,players);assert.equal(!!b.querySelector('.beta-item-pie'),s.total>0);assert(b.getAttribute('aria-label').includes(model.names.get(id)));assert(!b.outerHTML.includes('NaN'));}
   buttons[0].click();assert.equal(d.querySelectorAll('.beta-counts>div').length,5);assert(d.querySelector('#betaItemDetail a').href.includes('id='+c.ids[0]));checked++;
  }
 }
 const search=d.querySelector('#betaSearch');search.value='Osmumten';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('[data-beta-item]').length,1);assert.equal(d.querySelector('#betaCategoryTitle').textContent,'Search results');assert.equal(d.querySelector('#betaKills').textContent,'');assert(d.querySelector('#betaObtained').textContent.endsWith('/1'));assert.equal(d.querySelector('[data-beta-item]').dataset.betaItem,'26219');d.querySelector('[data-beta-item]').click();
 const expected=M.shares(model,26219,players);assert.deepEqual([...d.querySelectorAll('.beta-counts strong')].map(n=>Number(n.textContent.replace(/,/g,''))),expected.entries.map(p=>p.count));
 const picker=d.querySelector('#betaMembers');for(const k of keys.slice(1))picker.querySelector(`input[value="${k}"]`).click();assert.equal(d.querySelectorAll('.beta-counts>div').length,1);assert(d.querySelector('.beta-counts small').textContent==='100.0%'||expected.entries[0].count===0);
 assert.equal(JSON.parse(w.localStorage.getItem('ug-v25-member-selection')).length,1);
 d.querySelector('#betaOverlay').click();assert(d.querySelector('#betaGame').classList.contains('beta-hide-pies'));d.querySelector('#betaOverlay').click();assert(!d.querySelector('#betaGame').classList.contains('beta-hide-pies'));
 search.value='not an existing item xyz';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('[data-beta-item]').length,0);assert(d.querySelector('#betaGrid').textContent.includes('No matching'));
 d.querySelector('[data-beta-tab="bosses"]').click();assert.equal(search.value,'');assert(d.querySelector('[data-beta-item]'));
 // A successful data notification replaces the display without an upstream refresh.
 const updated=structuredClone(doc);updated.players.dikste.data.items.abyssal_sire[0].count=99;
 w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:'ug-v20-temple-cache',document:updated,source:'test'}}));
 await waitFor(()=>d.querySelector('[data-beta-item="13262"]')?.getAttribute('aria-label').includes('99 logged'),'new saved baseline in beta');
 const unknown=structuredClone(updated);unknown.players.dikste={error:'unavailable'};
 w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:'ug-v20-temple-cache',document:unknown,source:'test'}}));
 await waitFor(()=>d.querySelector('#betaCoverage').textContent.includes('No synced log for Dikste'),'unknown member');d.querySelector('[data-beta-item="13262"]').click();assert.equal(d.querySelector('.beta-counts strong').textContent,'Unknown');assert.equal(d.querySelectorAll('.beta-item-pie').length,0);assert(d.querySelector('#betaObtained').textContent.startsWith('?/'));assert(d.querySelector('#betaTotal').textContent.startsWith('? /'));
 assert.equal(errors.length,0,errors.join('; '));assert(!requests.some(r=>r.method==='POST'||r.url.includes('api.wiseoldman.net')||r.url.includes('/api/temple-collection-log')),'no automatic upstream updates');
 console.log(`Collection Log beta passed: ${checked} categories, ${ids.length} items, quantity shares, global duplicate counters, search, filters, links, overlay toggle, saved updates, unknown data and no automatic refresh.`);
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
