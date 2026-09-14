'use strict';
const assert=require('node:assert/strict');
const {create}=require('../docs/assets/live-sync');
async function run(){
 let time=1000000,shown=true,temple=0,wom=0,fail=false;
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const sources={temple:{interval:120000,refresh:async()=>{temple++;if(fail)throw Error('offline');return {}}},wom:{interval:300000,refresh:async()=>{wom++;return {}}}};
 const options={sources,storage,now:()=>time,visible:()=>shown};
 const a=create(options);await a.tick();assert.equal(temple,1);assert.equal(wom,1);
 await a.tick();await create(options).tick();assert.equal(temple,1,'navigation and another tab reuse recent checks');
 time+=120001;await a.tick();assert.equal(temple,2);assert.equal(wom,1);
 shown=false;time+=300001;await a.tick();assert.equal(temple,2,'hidden pages do not poll');
 shown=true;fail=true;await a.tick();assert.equal(temple,3);assert.equal(wom,2);
 await a.tick();assert.equal(temple,3,'failed check backs off');
 fail=false;time+=60001;await a.tick();assert.equal(temple,4,'retry recovers');
 // Quota failures must not cause a request storm every scheduler tick.
 const broken={getItem:()=>null,setItem:()=>{throw Error('quota')}};
 const b=create({...options,storage:broken});await b.tick();const count=temple;await b.tick();assert.equal(temple,count);
 let finish;const c=create({...options,storage:broken,sources:{temple:{interval:120000,refresh:()=>new Promise(r=>{finish=r})}}});
 const first=c.tick(),second=c.tick();finish({});await Promise.all([first,second]);
 console.log('Automatic sync scheduling tests passed');
}
run().catch(e=>{console.error(e);process.exitCode=1});
