'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let calls=0,now=1000000,fail=false;
 const data={13263:{high:30000000,low:30000000},33639:{high:80000000,low:80000000},19547:{high:20000000,low:20000000},29796:{high:900},28338:{low:800},29801:{high:300},19553:{high:400}};
 const context={window:{},Date:{now:()=>now},AbortSignal,console:{warn(){}},fetch:async()=>{calls++;await Promise.resolve();if(fail)throw Error('offline');return{ok:true,json:async()=>({data})}}};
 vm.runInNewContext(fs.readFileSync('docs/assets/ge-prices.js','utf8'),context);
 const p=context.window.UGPrices;
 await Promise.all([p.load(),p.load(),p.load()]);assert.equal(calls,1);
 for(const id of [13274,13275,13276])assert.equal(p.price(id),10000000);
 assert.equal(p.price(33634),60000000);assert.equal(p.price(29790),300);assert.equal(p.price(28319),200);assert.equal(p.price(29799),0);assert.equal(p.price(999),0);
 await p.load();assert.equal(calls,1);assert.equal(p.status().stale,false);
 now+=300001;fail=true;await p.load();assert.equal(calls,2);assert.equal(p.status().stale,true);assert.equal(p.price(33634),60000000);
 await p.load();assert.equal(calls,2,'failed refresh backs off');
 fail=false;now+=60001;await p.load();assert.equal(p.status().stale,false);
 console.log('Shared GE prices passed: one request, five-minute cache, component prices, retained stale values and recovery.');
})().catch(e=>{console.error(e);process.exit(1)});
