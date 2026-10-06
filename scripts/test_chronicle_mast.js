'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const temple=JSON.parse(fs.readFileSync('docs/data/temple-clog.json'));
const stamp=Math.floor(Date.now()/1000)+86400;
const row=(id,name,offset,extra={})=>({id,name,player:'Lijpste',date_unix:stamp-offset,previous_count:1,current_count:3,count_delta:2,repeat_drop:true,...extra});
temple.recent=[
 row(9001,'Cheap duplicate stack',0,{current_count:101,count_delta:100,notable_item:true}),
 row(9002,'Exactly 500k duplicate',1),
 row(9003,'Valuable duplicate',2),
 row(9004,'Unpriced personal unlock',3,{previous_count:0,current_count:1,repeat_drop:false}),
 row(9005,'Unknown player item',4,{player:'Unknown member',previous_count:0,repeat_drop:false})
];
const prices={9001:{high:400000,low:400000},9002:{high:500000,low:500000},9003:{high:500001,low:500001}};
const server=http.createServer((req,res)=>{const file=path.join(process.cwd(),'docs',new URL(req.url,'http://localhost').pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
server.listen(0,'127.0.0.1',async()=>{
 process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;
 const {openPage,waitFor}=require('./audit_v25_jsdom');let dom;
 try{
  const result=await openPage('chronicle.html',{templeDocument:temple,savedTemple:temple,priceData:prices});dom=result.dom;
  const w=dom.window,d=w.document;
  const latestId=()=>+d.querySelector('[data-mast-drop-icon]').src.match(/icon\/(\d+)\.png/)[1];
  const dropIds=()=>[...d.querySelectorAll('#chronicle [data-event-type="drop"] .chronicle-main>img')].map(x=>+x.src.match(/icon\/(\d+)\.png/)[1]);
  await waitFor(()=>d.querySelector('[data-mast-drop]')?.textContent.includes('Valuable duplicate'),'eligible latest item after prices load');
  await waitFor(()=>dropIds().length===2,'same eligible Chronicle events');
  assert.equal(latestId(),9003);assert.equal(latestId(),dropIds()[0]);
  assert(d.querySelector('[data-mast-drop]').textContent.includes('copy #3'),'repeat copies use the Chronicle label');
  assert.equal(d.querySelector('[data-mast-drop-avatar]').alt,'Lijpste');
  assert.deepEqual(dropIds(),[9003,9004],'cheap stacks, exactly 500k and unknown players are excluded');
  // Changing a quote must immediately re-evaluate the same eligibility in both places.
  w.UGPrices.peek()[9003]={high:500000,low:500000};w.dispatchEvent(new w.CustomEvent('ug:prices-updated'));
  await waitFor(()=>dropIds().length===1,'Chronicle updates when a duplicate falls below the threshold');
  assert.equal(latestId(),9004);assert.equal(latestId(),dropIds()[0]);
  assert.equal(d.querySelector('[data-mast-drop]').textContent,'Unpriced personal unlock');
  w.UGV21.saveMemberSelection(new Set(['dikste']));
  assert.equal(latestId(),9004,'header still covers all five members');
  const onlyDuplicates=structuredClone(temple);onlyDuplicates.recent=onlyDuplicates.recent.slice(0,3);
  w.dispatchEvent(new w.CustomEvent('ug:data-updated',{detail:{key:'ug-v20-temple-cache',document:onlyDuplicates}}));
  assert.equal(d.querySelector('[data-mast-drop]').textContent,'No recent item activity');
  assert.equal(d.querySelector('[data-mast-drop-icon]').hidden,true);assert.equal(d.querySelector('[data-mast-drop-avatar]').hidden,true);
  assert.equal(result.errors.length,0,result.errors.join('; '));
  console.log('Latest item matches Chronicle eligibility and copy labels: personal unlocks, strict 500k unit threshold, cheap stacks, price updates, unknown players, all-member scope and empty states passed.');
  dom.window.close();server.close();process.exit(0);
 }catch(e){console.error(e);dom?.window.close();server.close();process.exit(1)}
});
