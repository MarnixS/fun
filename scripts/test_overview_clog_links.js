'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const ALL=['dikste','big dog aura','lijpste','poep aura','lompste'];
const ITEMS=[
 [1001,'Dikste only',[1,0,0,0,0]],
 [1002,'Dikste and Big Dog',[1,1,0,0,0]],
 [1003,'Dikste and Lijpste',[2,0,1,0,0]],
 [1004,'Big Dog only',[0,4,0,0,0]],
 [1005,'All five',[1,1,1,1,1]],
 [1006,'Poep only',[0,0,0,3,0]],
 [1007,'Lompste only',[0,0,0,0,1]],
 [27277,"Osmumten's fang",[2,0,0,0,1]]
];
const temple={fetchedAt:Date.now(),players:Object.fromEntries(ALL.map((key,i)=>[key,{data:{items:{test:ITEMS.map(([id,name,counts])=>({id,name,count:counts[i]}))}}}])),catalog:ITEMS.map(([id,name])=>({id,name})),categories:{test:ITEMS.map(([id])=>id)},recent:[]};
const prices=Object.fromEntries([[1001,1000],[1002,700],[1003,2000],[1004,400],[1005,100],[1006,0],[1007,5000],[27277,999]].map(([id,value])=>[id,{high:value,low:value}]));
const EXPECTED={
 'dikste':{unlocked:[1001,1002,1003,1005,27277],exclusive:[1001],shared:[1002,1003,1005,27277]},
 'big dog aura':{unlocked:[1002,1004,1005],exclusive:[1004],shared:[1002,1005]},
 'lijpste':{unlocked:[1003,1005],exclusive:[],shared:[1003,1005]},
 'poep aura':{unlocked:[1005,1006],exclusive:[1006],shared:[1005]},
 'lompste':{unlocked:[1005,1007,27277],exclusive:[1007],shared:[1005,27277]}
};
const server=http.createServer((req,res)=>{const file=path.join(process.cwd(),'docs',new URL(req.url,'http://localhost').pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
const itemIds=d=>[...d.querySelectorAll('#clogItemTable tbody tr .item-cell>img')].map(x=>+x.src.match(/icon\/(\d+)\.png/)[1]);
server.listen(0,'127.0.0.1',async()=>{
 process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;
 const {openPage,waitFor}=require('./audit_v25_jsdom'),wom=require('../docs/data/wom-cache.json'),doms=[];
 const options=selection=>({selection,sharedDocs:{wom,temple},templeDocument:temple,priceData:prices});
 const open=async(url,selection=ALL)=>{const result=await openPage(url,options(selection));doms.push(result.dom);return result};
 try{
  const home=await open('index.html'),hd=home.dom.window.document;
  await waitFor(()=>hd.querySelectorAll('[data-clog-metric]').length===15,'all five card links');
  const topSkills=hd.querySelectorAll('#gainCards [data-skill]').length;assert(topSkills>0,'top skill graph links exist');
  hd.querySelector('[data-period-button="7"]').click();await waitFor(()=>hd.querySelector('#gainCards small')?.textContent.includes('1 week'),'weekly gains');
  hd.querySelector('[data-period-button="365"]').click();await waitFor(()=>hd.querySelector('#gainCards small')?.textContent.includes('1 year'),'yearly gains');
  await new Promise(resolve=>setTimeout(resolve,50));assert.equal(hd.querySelectorAll('#gainCards [data-skill]').length,topSkills,'top skill links survive period changes');
  for(const member of ALL)for(const slots of ['unlocked','exclusive','shared']){
   const link=hd.querySelector(`.player-card[data-player-key="${member}"] [data-clog-metric="${slots}"]`),url=new URL(link.href);
   assert.equal(+link.querySelector('b').textContent,EXPECTED[member][slots].length);
   assert.equal(url.searchParams.get('member'),member);assert.equal(url.hash,'#collection');
   const target=await open(url.pathname.slice(1)+url.search+url.hash,['poep aura']),d=target.dom.window.document;
   await waitFor(()=>d.querySelector('#clogItemTable thead')&&d.querySelector('[data-ownership-member]'),'filtered item table');
   assert.deepEqual(itemIds(d).sort((a,b)=>a-b),EXPECTED[member][slots],member+' '+slots);
   assert.deepEqual([...target.dom.window.UGV21.loadMemberSelection()],ALL,'link preserves comparison context');
   assert.equal(d.querySelector(`[data-ownership-member="${member}"]`).value,'has');
   assert.equal(target.errors.length,0,target.errors.join('; '));
  }
  const subset=await open('index.html',['dikste','big dog aura']),sd=subset.dom.window.document;
  await waitFor(()=>sd.querySelectorAll('[data-clog-metric]').length===6,'subset card links');
  const href=sd.querySelector('[data-player-key="dikste"] [data-clog-metric="exclusive"]').getAttribute('href');
  const focused=await open(href),fd=focused.dom.window.document;
  await waitFor(()=>fd.querySelector('#clogItemTable thead'),'subset target');
  assert.deepEqual(itemIds(fd).sort((a,b)=>a-b),[1001,1003,27277]);
  fd.querySelector('#clogMemberPicker input[value="big dog aura"]').click();
  await waitFor(()=>itemIds(fd).length===5,'member changes still update linked view');
  fd.querySelector('#clogClearRules').click();assert.equal(itemIds(fd).length,8,'rules can be cleared');
  const single=await open('gim.html?member=dikste&slots=shared&members=dikste#collection'),singleDoc=single.dom.window.document;
  await waitFor(()=>singleDoc.querySelector('#clogItemTable thead'),'zero shared target');
  assert.equal(itemIds(singleDoc).length,0,'one member has no shared slots');
  assert.equal(singleDoc.querySelector('[data-ownership-bound="minOwners"]').value,'2','impossible minimum remains explicit');
  const invalid=await open('gim.html?member=unknown&slots=shared&members=unknown#collection',['big dog aura']);
  assert.deepEqual([...invalid.dom.window.UGV21.loadMemberSelection()],['big dog aura'],'invalid links do not alter selection');
  const sorted=await open('gim.html'),d=sorted.dom.window.document;
  await waitFor(()=>d.querySelector('[data-clog-value-sort]'),'clickable GE value');
  d.querySelector('[data-clog-value-sort]').click();
  await waitFor(()=>d.querySelector('th[aria-sort="descending"]'),'descending GE sort');
  assert.deepEqual(itemIds(d),[1003,1007,27277,1004,1002,1001,1005,1006],'uses GE price times selected quantity');
  assert.equal(d.querySelector('#clogSort').value,'value');
  d.querySelector('[data-clog-value-sort]').click();
  await waitFor(()=>d.querySelector('th[aria-sort="ascending"]'),'ascending GE sort');
  assert.deepEqual(itemIds(d),[1006,1005,1001,1002,1004,27277,1007,1003]);
  assert.equal(d.querySelector('#clogSort').value,'value-asc');
  assert.equal(d.activeElement,d.querySelector('[data-clog-value-sort]'),'keyboard focus survives table redraw');
  for(const result of [home,subset,focused,single,invalid,sorted])assert.equal(result.errors.length,0,result.errors.join('; '));
  console.log('Top skill links after period changes, all 15 card links, subset context, zero shared slots, editable filters, invalid URLs and reversible GE stack-value sorting passed.');
  doms.forEach(dom=>dom.window.close());server.close();process.exit(0);
 }catch(error){console.error(error);doms.forEach(dom=>dom.window.close());server.close();process.exit(1)}
});
