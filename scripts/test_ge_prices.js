'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let calls=0,now=1000000,fail=false;
 const data={13263:{high:30000000,low:30000000,highTime:900,lowTime:950},33639:{high:80000000,low:80000000,highTime:920,lowTime:940},19547:{high:20000000,low:20000000},29796:{high:900},28338:{low:800},29801:{high:300},19553:{high:400}};
 data.invalid={high:0,highTime:999,low:50,lowTime:NaN};data.future={high:1,highTime:2000};
 const context={window:{},Date:{now:()=>now},AbortSignal,console:{warn(){}},fetch:async()=>{calls++;await Promise.resolve();if(fail)throw Error('offline');return{ok:true,json:async()=>({data})}}};
 vm.runInNewContext(fs.readFileSync('docs/assets/ge-prices.js','utf8'),context);
 const p=context.window.UGPrices;
 await Promise.all([p.load(),p.load(),p.load()]);assert.equal(calls,1);assert.equal(p.status().sourceLatestAt,950000,'source time comes from priced quotes, not retrieval time');assert.equal(p.status().checkedAt,now);
 for(const id of [13274,13275,13276])assert.equal(p.price(id),10000000);
 assert.equal(p.price(33634),60000000);assert.equal(p.price(29790),300);assert.equal(p.price(28319),200);assert.equal(p.price(29799),0);assert.equal(p.price(999),0);
 await p.load();assert.equal(calls,1);assert.equal(p.status().stale,false);
 now+=300001;fail=true;await p.load();assert.equal(calls,2);assert.equal(p.status().stale,true);assert.equal(p.price(33634),60000000);assert.equal(p.status().sourceLatestAt,950000,'failed refresh preserves source timestamp');
 await p.load();assert.equal(calls,2,'failed refresh backs off');
 fail=false;now+=60001;await p.load();assert.equal(p.status().stale,false);
 delete data[13263].highTime;delete data[13263].lowTime;delete data[33639].highTime;delete data[33639].lowTime;delete data.future;now+=300001;await p.load();assert.equal(p.status().sourceLatestAt,0,'missing source timestamps are not fabricated');
 console.log('Shared GE prices passed: one request, five-minute cache, component prices, retained stale values and recovery.');
})().catch(e=>{console.error(e);process.exit(1)});
