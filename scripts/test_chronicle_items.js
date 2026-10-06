'use strict';

const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('docs/assets/app.js','utf8');
const start=source.indexOf('function chronicleGroupCounts('),end=source.indexOf('\nfunction chronicleEvents(',start);
assert(start>=0&&end>start);
const PLAYERS=['dikste','big dog aura','lijpste','poep aura','lompste'].map(key=>({key,name:key,core:true}));
let coverage=PLAYERS.map(p=>p.key),recent=[],prices={},logs=Object.fromEntries(coverage.map(key=>[key,[]]));
const context=vm.createContext({PLAYERS,syncedKeys:()=>coverage,templeRecent:()=>recent,templeItemsFor:key=>logs[key],playerKey:name=>name,playerByKey:key=>PLAYERS.find(p=>p.key===key),mastItemPrice:id=>prices[id]||0,templeDateMs:value=>Number(value)||0});
vm.runInContext(source.slice(start,end),context);
const row=(id,extra={})=>({id,name:'Item '+id,player:'lijpste',date:200,previousCount:null,repeatDrop:false,...extra});
recent=[
 row(1),
 row(2,{previousCount:0,currentCount:1}),
 row(3,{previousCount:1,currentCount:101,countDelta:100,repeatDrop:true}),
 row(4,{previousCount:1,currentCount:3,countDelta:2,repeatDrop:true}),
 row(5,{previousCount:1,currentCount:3,countDelta:2,repeatDrop:true}),
 row(6,{previousCount:1,repeatDrop:true,notable:true}),
 row(7,{previousCount:1}),
 row(8,{previousCount:0}),
 row(8,{player:'big dog aura',date:300,previousCount:0}),
 row(9),
 row(10),
 row(10,{player:'dikste'}),
 row(11,{previousCount:1,repeatDrop:true}),
];
prices={1:0,2:1,3:400000,4:500000,5:500001,6:10,7:100,11:1000000};
logs.lijpste=[1,2,3,4,5,6,7,8,9,10,11].map(id=>({id,count:1,date:200}));
logs['big dog aura']=[{id:2,count:1,date:100},{id:8,count:1,date:300},{id:9,count:1,date:null}];
logs.dikste=[{id:10,count:1,date:200}];
const events=()=>Array.from(context.chronicleDropEvents());
const first=events();
assert.deepEqual(first.map(e=>[e.itemId,e.key]),[[1,'lijpste'],[2,'lijpste'],[5,'lijpste'],[8,'lijpste'],[8,'big dog aura'],[9,'lijpste'],[10,'lijpste'],[10,'dikste'],[11,'lijpste']]);
assert(first.find(e=>e.itemId===1).newPlayerUnlock,'unpriced and untradeable personal unlocks remain visible');
assert(first.find(e=>e.itemId===1).newGroupUnlock,'first group item is labelled');
assert(!first.find(e=>e.itemId===2).newGroupUnlock,'an earlier owner outside the selected member blocks group novelty');
assert(!first.some(e=>e.itemId===3),'even 100 cheap duplicate copies do not qualify');
assert(!first.some(e=>e.itemId===4),'exactly 500,000 gp per item does not qualify');
assert(first.find(e=>e.itemId===5).broadcast,'500,001 gp per item qualifies');
assert(!first.find(e=>e.itemId===5).newPlayerUnlock&&!first.find(e=>e.itemId===5).newGroupUnlock,'valuable duplicates never become unlocks');
assert(!first.some(e=>e.itemId===6),'Temple notable flags do not admit cheap duplicates');
assert(!first.some(e=>e.itemId===7),'previous count identifies a duplicate when repeat_drop is absent');
assert(first.find(e=>e.itemId===8&&e.key==='lijpste').newGroupUnlock,'historical first remains labelled after a second member obtains the item');
assert(!first.find(e=>e.itemId===8&&e.key==='big dog aura').newGroupUnlock,'later personal unlock is not a new group item');
assert(!first.find(e=>e.itemId===9).newGroupUnlock,'unknown acquisition dates cannot establish the first group owner');
assert(first.filter(e=>e.itemId===10).every(e=>!e.newGroupUnlock),'tied recorded times do not invent a first owner');
assert(!first.find(e=>e.itemId===11).newGroupUnlock,'a sole owner getting another copy is not a group unlock');
coverage=coverage.filter(key=>key!=='lompste');
assert(events().every(e=>!e.newGroupUnlock),'incomplete group coverage cannot establish group novelty');
coverage=PLAYERS.map(p=>p.key);
prices={};
assert(events().every(e=>e.newPlayerUnlock),'unavailable prices keep personal unlocks but cannot qualify duplicates');
prices[5]=500001;
assert(events().some(e=>e.itemId===5),'a loaded unit price restores qualifying duplicate broadcasts');
console.log('Chronicle items: all personal unlocks, strict 500k unit threshold, duplicate metadata, all-member group history, later owners, tied/unknown dates and missing prices passed.');
