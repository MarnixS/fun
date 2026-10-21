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

// Full logs also contain valuable copies never returned by the recent feed.
coverage=PLAYERS.map(p=>p.key);recent=[];prices={11834:12000000,20:500000,21:499999};
logs=Object.fromEntries(coverage.map(key=>[key,[]]));
logs.lijpste=[{id:11834,name:'Bandos tassets',count:3,date:200},{id:11834,name:'Bandos tassets',count:1,date:200},{id:20,name:'Boundary item',count:50},{id:21,name:'Cheap stack',count:100}];
logs['big dog aura']=[{id:11834,name:'Bandos tassets',count:2,date:200}];
let restored=events();
assert.equal(restored.length,2,'one historical entry per player/item, regardless of duplicate categories');
assert(restored.every(e=>e.historicalLog&&e.date===0&&!e.newPlayerUnlock&&!e.newGroupUnlock),'bulk-import dates cannot become drop dates or first-group claims');
assert.deepEqual(restored.map(e=>[e.key,e.recordedCount,e.unrecordedCount,e.groupRecordedCount]),[['big dog aura',2,2,5],['lijpste',3,3,5]]);
assert(restored.every(e=>e.previousCount==null&&e.currentCount==null),'current totals cannot invent historical count transitions');
recent=[row(11834,{date:300,previousCount:2,currentCount:3,repeatDrop:true}),row(11834,{date:300})];
restored=events().find(e=>e.historicalLog&&e.key==='lijpste');
assert.equal(restored.unrecordedCount,2,'a count transition and matching raw feed row cover one copy, not two');
recent.push(row(11834,{date:250,previousCount:0,currentCount:2}),row(11834,{date:200,previousCount:0,currentCount:1}));
assert(!events().some(e=>e.historicalLog&&e.key==='lijpste'),'overlapping transitions cover all three copies without creating an extra history entry');
recent=[row(11834,{date:200}),row(11834,{date:200}),row(11834,{date:250})];
assert.equal(events().find(e=>e.historicalLog&&e.key==='lijpste').unrecordedCount,1,'duplicate raw rows are counted once; separate dated events remain distinct');
coverage=coverage.filter(key=>key!=='lompste');
assert(events().filter(e=>e.historicalLog).every(e=>e.groupRecordedCount==null),'partial logs cannot supply a complete group count');
prices={};assert(!events().some(e=>e.historicalLog),'missing prices cannot admit valuable-history summaries');

// Regression against the actual saved tassets, chestplates and raid duplicates.
const real=JSON.parse(fs.readFileSync('docs/data/temple-clog.json')),ge=JSON.parse(fs.readFileSync('docs/data/ge-prices.json')).data;
coverage=PLAYERS.map(p=>p.key);logs=Object.fromEntries(coverage.map(key=>[key,[]]));
function collect(node,out){if(Array.isArray(node))node.forEach(value=>collect(value,out));else if(node&&typeof node==='object'){if(node.id)out.push(node);else Object.values(node).forEach(value=>collect(value,out))}}
for(const key of coverage)collect(real.players[key].data.items,logs[key]);
prices=Object.fromEntries(Object.entries(ge).map(([id,p])=>[id,p.high>0&&p.low>0?(p.high+p.low)/2:p.high>0?p.high:p.low||0]));
recent=real.recent.filter(r=>![11834,11832,27277].includes(r.id)).map(r=>({id:r.id,name:r.name,player:r.player.toLowerCase(),date:r.date_unix*1000,previousCount:r.previous_count??null,currentCount:r.current_count??null,repeatDrop:!!r.repeat_drop}));
restored=events().filter(e=>e.historicalLog);
const tassets=restored.filter(e=>e.itemId===11834);
const savedCount=(key,id)=>Math.max(0,...logs[key].filter(item=>item.id===id).map(item=>item.count));
const groupTassets=coverage.reduce((n,key)=>n+savedCount(key,11834),0);
assert.deepEqual(tassets.map(e=>[e.key,e.recordedCount,e.groupRecordedCount]),coverage.filter(key=>savedCount(key,11834)>0).map(key=>[key,savedCount(key,11834),groupTassets]),'all real tassets owners reappear with their saved counts');
assert(restored.some(e=>e.itemId===11832&&e.key==='big dog aura'&&e.recordedCount===savedCount('big dog aura',11832)),'saved Bandos chestplate duplicates reappear');
assert(restored.some(e=>e.itemId===27277&&e.key==='lijpste'&&e.recordedCount===savedCount('lijpste',27277)),'saved Tumeken shadow duplicates reappear');
console.log(`Chronicle full-log recovery: ${restored.length} missing valuable histories, both tassets owners, expensive duplicates, category/event deduplication, partial coverage and unknown dates passed.`);
console.log('Chronicle items: all personal unlocks, strict 500k unit threshold, duplicate metadata, all-member group history, later owners, tied/unknown dates and missing prices passed.');
