'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {IDBFactory}=require('fake-indexeddb');
const {openPage,waitFor}=require('./audit_v25_jsdom');
const clone=structuredClone;
const wom=JSON.parse(fs.readFileSync('docs/data/wom-cache.json')),temple=JSON.parse(fs.readFileSync('docs/data/temple-clog.json'));
const settle=()=>new Promise(r=>setTimeout(r,80));
(async()=>{
 let release;const pending=new Promise(r=>release=r),idb=new IDBFactory(),sharedDocs={wom:clone(wom),temple:clone(temple)},requests=[];
 const {dom,errors}=await openPage('gim.html',{sharedDocs,indexedDB:idb,fetchLog:requests,priceResponse:()=>pending});const w=dom.window,d=w.document;
 const sort=d.querySelector('#clogSort'),search=d.querySelector('#clogSearch');sort.value='value';sort.dispatchEvent(new w.Event('change'));sort.value='name';sort.dispatchEvent(new w.Event('change'));search.value='osmumten';search.dispatchEvent(new w.Event('input'));
 release(new Response(JSON.stringify({data:{26219:{high:10000000,low:10000000}}})));await settle();assert([...d.querySelectorAll('#clogItemTable tbody tr')].every(r=>r.textContent.toLowerCase().includes('osmumten')),'slow value sort must not overwrite a newer search');
 const row=d.querySelector('#clogItemTable tbody tr'),quantity=Number(row.children[7].textContent.replaceAll(',',''));assert.equal(row.lastElementChild.textContent,(quantity*10).toFixed(1)+'m gp','Osmumten fang uses the normal GE quote');
 const button=d.querySelector('[data-v21-skill]');button.focus();button.click();await waitFor(()=>d.querySelector('#v21MetricModal:not([hidden])'),'summary graph');
 const modal=d.querySelector('#v21MetricModal');modal.querySelector('[data-v21-modal-view="bars"]').click();assert(modal.querySelector('svg rect'));d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(modal.hidden);assert.equal(d.activeElement,button);
 button.click();await settle();modal.click();assert(modal.hidden,'backdrop closes graph');
 // A manual shared restore must bypass a lagging static Pages snapshot.
 sharedDocs.temple.fetchedAt=Math.max(Date.now(),temple.fetchedAt)+10000;sharedDocs.temple.recent.unshift({id:700099,name:'Newest shared restore item',player:'Dikste',date_unix:Math.floor(sharedDocs.temple.fetchedAt/1000)});
 d.querySelector('#clogReset').click();await waitFor(()=>d.querySelector('#pageNotice').textContent.includes('override cleared'),'reset completion');assert.equal((await w.UGV21.loadClog()).recent[0].name,'Newest shared restore item','restore loads current shared commit');
 const input=d.querySelector('#clogImport');async function importJSON(value){Object.defineProperty(input,'files',{configurable:true,value:[{text:async()=>JSON.stringify(value)}]});await input.onchange()}
 const imported=clone(sharedDocs.temple);imported.fetchedAt+=60000;imported.recent.unshift({id:700098,name:'Browser import regression item',player:'Dikste',date_unix:Math.floor(imported.fetchedAt/1000)});
 await importJSON(imported);await waitFor(()=>d.querySelector('#recentDrops').textContent.includes('Browser import regression item'),'import redraw');assert(!sharedDocs.temple.recent.some(r=>r.id===700098),'import never changes shared data');
 const next=await openPage('gim.html',{sharedDocs,indexedDB:idb});assert(next.dom.window.document.querySelector('#recentDrops').textContent.includes('Browser import regression item'),'explicit browser import survives navigation');
 const prior=await w.UGV21.loadClog();await importJSON({players:{}});assert(d.querySelector('#pageNotice').textContent.includes('Import failed'),'invalid import rejected');assert.deepEqual(await w.UGV21.loadClog(),prior,'invalid import preserves loaded data');
 let blob;w.URL.createObjectURL=value=>{blob=value;return 'blob:test-only'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};d.querySelector('#clogExport').click();assert(blob&&blob.size>0);assert.equal(blob.type,'application/json');const exported=await new Promise((resolve,reject)=>{const reader=new w.FileReader();reader.onload=()=>resolve(JSON.parse(reader.result));reader.onerror=reject;reader.readAsText(blob)});assert(exported.recent.some(r=>r.id===700098),'export contains the actual imported snapshot');
 next.dom.window.document.querySelector('#clogReset').click();await waitFor(()=>next.dom.window.document.querySelector('#pageNotice').textContent.includes('override cleared'),'reset imported override');const restored=await openPage('gim.html',{sharedDocs,indexedDB:idb});assert(!restored.dom.window.document.querySelector('#recentDrops').textContent.includes('Browser import regression item'));assert(restored.dom.window.document.querySelector('#recentDrops').textContent.includes('Newest shared restore item'));
 assert(!requests.some(r=>r.method==='POST'||r.url.includes('api.wiseoldman.net')||r.url.includes('/api/temple-collection-log')),'recovery, graphs and filter changes never refresh external stats');assert.equal(errors.length+next.errors.length+restored.errors.length,0);
 // Verify every existing component valuation through the real Collection Log renderer.
 const valuedIds=[26219,29799,29790,29792,29794,28319,28321,28323,28325,28279,28281,28283,28285];
 const priceData=Object.fromEntries([26219,19553,28301,28304,28298,28295].map(id=>[id,{high:10000000,low:10000000}]));
 for(const [id,value] of [[29801,50000000],[29796,30000000],[28338,400000000],[28316,100000000],[28313,100000000],[28310,100000000],[28307,100000000],[565,200],[28276,1000000]])priceData[id]={high:value,low:value};
 const priceTemple={fetchedAt:Date.now(),players:{dikste:{data:{items:valuedIds.map(id=>({id,name:'Valuation '+id,count:1})),total_collections_finished:valuedIds.length}}},catalog:Object.fromEntries(valuedIds.map(id=>[id,'Valuation '+id])),recent:[]};
 const valuation=await openPage('gim.html',{selection:['dikste'],sharedDocs:{wom:clone(wom),temple:priceTemple},priceData});const vd=valuation.dom.window.document;
 await waitFor(()=>vd.querySelector('#clogItemTable tbody tr:last-child td:last-child')?.textContent!=='—','component quotes');
 const expected=['10.0m gp','40.0m gp','10.0m gp','10.0m gp','10.0m gp','100.0m gp','100.0m gp','100.0m gp','100.0m gp','86.9m gp','86.9m gp','86.9m gp','86.9m gp'];
 valuedIds.forEach((id,i)=>assert.equal(vd.querySelector(`[data-item-id="${id}"]`).closest('tr').lastElementChild.textContent,expected[i],'existing valuation '+id));assert.equal(valuation.errors.length,0);
 console.log('Existing pricing passed: normal Osmumten Fang, Araxxyte residual, all three Noxious parts, all four Soulreaper parts and all four DT2 vestiges');
 console.log('Interaction edge cases passed: delayed sorting, normal GE Fang value, dialogs, latest shared restore, import navigation, invalid imports, export, reset, and no silent refresh');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
