'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let calls=0,now=1000000,fail=false,snapshotTime=now;
 const storage=new Map(),key='ug-ge-price-snapshot-v1',urls=[];
 const data={13263:{high:30000000,low:30000000,highTime:900,lowTime:950},33639:{high:80000000,low:80000000,highTime:920,lowTime:940},19547:{high:20000000,low:20000000},29796:{high:900},28338:{low:800},29801:{high:300},19553:{high:400}};
 data.invalid={high:0,highTime:999,low:50,lowTime:NaN};data.future={high:1,highTime:2000};
 function open(){
  const context={window:{localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}},Date:{now:()=>now},AbortSignal,console:{warn(){}},fetch:async url=>{calls++;urls.push(url);await Promise.resolve();if(fail)throw Error('offline');return{ok:true,json:async()=>({fetchedAt:snapshotTime,data})}}};
  vm.runInNewContext(fs.readFileSync('docs/assets/ge-prices.js','utf8'),context);
  return context.window.UGPrices;
 }
 let p=open();
 await Promise.all([p.load(),p.load(),p.load()]);assert.equal(calls,1);assert.equal(p.status().sourceLatestAt,950000,'source time comes from priced quotes');assert.equal(p.status().checkedAt,snapshotTime);assert.equal(p.status().refreshIntervalHours,12);
 for(const id of [13274,13275,13276])assert.equal(p.price(id),10000000);
 assert.equal(p.price(33634),60000000);assert.equal(p.price(29790),300);assert.equal(p.price(28319),200);assert.equal(p.price(29799),0);assert.equal(p.price(999),0);
 assert(storage.has(key),'the saved snapshot survives page navigation');
 now+=12*3600000-1;p=open();await p.load();assert.equal(calls,1,'a new page still uses the saved prices for 12 hours');assert.equal(p.status().stale,false);
 now+=1;fail=true;await p.load();assert.equal(calls,2);assert.equal(p.status().stale,true);assert.equal(p.price(33634),60000000);assert.equal(p.status().sourceLatestAt,950000,'failed reads preserve price values and source time');
 await p.load();assert.equal(calls,2,'failed snapshot reads back off');
 fail=false;now+=60001;snapshotTime=now;await p.load();assert.equal(p.status().stale,false);
 delete data[13263].highTime;delete data[13263].lowTime;delete data[33639].highTime;delete data[33639].lowTime;delete data.future;
 now+=12*3600000;snapshotTime=now;await p.load();assert.equal(p.status().sourceLatestAt,0,'missing source timestamps are not fabricated');
 assert(urls.every(url=>!url.includes('prices.runescape.wiki')),'browser requests never reach the Wiki');
 console.log('GE prices: one shared snapshot, 12-hour cache across pages, component prices, retained values offline, source timestamps and recovery passed.');
})().catch(e=>{console.error(e);process.exit(1)});
