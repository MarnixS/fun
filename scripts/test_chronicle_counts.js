'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {derivedRecentRows}=require('../api/temple-collection-log')._test;
const {mergeTemple}=require('../docs/assets/wom-store');
const source=fs.readFileSync('docs/assets/app.js','utf8');
const keys=['dikste','big dog aura','lijpste','poep aura','lompste'];
const players=keys.map(key=>({key,name:key}));
const id=19529;
const document=(counts,fetchedAt=100000)=>({fetchedAt,players:Object.fromEntries(keys.map((key,i)=>[key,{data:{items:{Bosses:[{id,name:'Zenyte shard',count:counts[i],date:1}]}}}]))});
const before=document([4,7,2,0,0]),after=document([5,7,2,0,0],200000);
const derived=derivedRecentRows(after.players,before,[],200000);
assert.equal(derived.length,1);
assert.deepEqual([derived[0].previous_count,derived[0].current_count,derived[0].group_previous_count,derived[0].group_current_count],[4,5,13,14]);
assert.equal(derived[0].group_count_scope,'refresh');

// Several members changing the same item in one refresh share its actual
// before/after totals; there is no evidence for an order within that refresh.
const simultaneous=derivedRecentRows(document([6,10,2,0,0]).players,before,[],300000);
assert.equal(simultaneous.length,2);
assert(simultaneous.every(row=>row.group_previous_count===13&&row.group_current_count===18));
const partial=document([5,7,2,0,0]);delete partial.players.lompste;
assert(derivedRecentRows(partial.players,before,[],200000).every(row=>!('group_current_count' in row)),'missing members cannot produce a full group total');

// An upstream recent-item response omits count metadata. Its repetition must
// not erase the historical snapshot previously saved for that exact event.
const saved={...after,recent:derived};
const raw={id,name:'Zenyte shard',player:'dikste',date_unix:200};
const merged=JSON.parse(JSON.stringify(mergeTemple(saved,{...after,fetchedAt:300000,recent:[raw]})));
assert.equal(merged.recent.length,1);
assert.deepEqual([merged.recent[0].previous_count,merged.recent[0].current_count,merged.recent[0].group_previous_count,merged.recent[0].group_current_count],[4,5,13,14]);

let logs=document([6,10,2,0,0]).players;
const context=vm.createContext({PLAYERS:players,playerKey:name=>keys.find(key=>key===String(name).toLowerCase()),playerByKey:key=>players.find(p=>p.key===key),templeItemsFor:key=>logs[key]?.data.items.Bosses||[],state:{temple:merged},fmt:value=>value.toLocaleString('en-GB')});
for(const name of ['templeDateMs','cleanTempleRecent','templeCount','templeRecent'])vm.runInContext(source.split('\n').find(line=>line.startsWith(`function ${name}(`)),context);
const start=source.indexOf('function chronicleGroupCounts('),end=source.indexOf('\nfunction chronicleDropEvents(',start);
vm.runInContext(source.slice(start,end),context);
const detailStart=source.indexOf('function chronicleCountDetail('),detailEnd=source.indexOf('\nasync function renderChronicle(',detailStart);
vm.runInContext(source.slice(detailStart,detailEnd),context);
const counts=rows=>context.chronicleGroupCounts(rows,keys);
const row=(player,previousCount,currentCount,detectedAt,extra={})=>({id,name:'Zenyte shard',player,previousCount,currentCount,detectedAt,date:detectedAt,countDelta:currentCount-previousCount,...extra});
const pair=value=>value?[value.groupPreviousCount,value.groupCurrentCount]:null;
const history=[row('dikste',4,5,200),row('big dog aura',7,9,300),row('dikste',5,6,400),row('big dog aura',9,10,500)];
let result=counts(history);
assert.deepEqual(history.map(d=>pair(result.get(d))),[[13,14],[14,16],[16,17],[17,18]],'historical totals rewind all members, not the selected player or only eligible broadcasts');
assert.deepEqual([...counts(history.toReversed()).values()].map(pair),[...result.values()].map(pair),'input order cannot change the historical totals');

logs=document([5,9,2,0,0]).players;
const batch=[row('dikste',4,5,500),row('big dog aura',7,9,500,{date:100})];
result=counts(batch);
assert(batch.every(d=>JSON.stringify(pair(result.get(d)))==='[13,16]'),'count transitions follow their refresh even when a precise item timestamp differs');
logs=document([5,7,2,0,0]).players;
const stack=row('dikste',1,5,500);
assert.deepEqual(pair(counts([stack]).get(stack)),[10,14],'a four-copy stack adds four to the group');
logs.dikste.data.items.Bosses.push({id,count:5},{id,count:1});
assert.deepEqual(pair(counts([stack]).get(stack)),[10,14],'an item appearing in several categories is counted once');
logs=document([8,7,2,0,0]).players;
assert.equal(counts([stack]).has(stack),false,'unrecorded changes or a correction cannot be guessed');
logs=document([5,7,2,0,0]).players;
assert.equal(counts([stack,row('big dog aura',null,null,600)]).has(stack),false,'a later item event without counts blocks unsupported historical reconstruction');
assert.deepEqual(pair(counts([stack,row('unknown member',null,null,600)]).get(stack)),[10,14],'unknown players cannot change the group');
assert.equal(context.chronicleGroupCounts([stack],keys.slice(0,4)).size,0);

context.state.temple=merged;
const snapshot=context.templeRecent()[0];
logs=document([99,99,99,0,0]).players;
assert.deepEqual(pair(counts([snapshot]).get(snapshot)),[13,14],'saved historical totals remain stable after later changes');
assert.deepEqual(pair(context.chronicleGroupCounts([snapshot],keys.slice(0,4)).get(snapshot)),[13,14],'a previously complete snapshot remains valid when a current member is unavailable');
const invalid={...snapshot,groupCurrentCount:2};
assert.equal(counts([invalid]).has(invalid),false,'impossible snapshot totals are rejected');
context.state.temple={recent:[{...raw,previous_count:null,current_count:null,group_previous_count:null},{...raw,previous_count:'0',current_count:'1',group_previous_count:-1,group_current_count:1.5}]};
const normalized=context.templeRecent();
assert.equal(normalized[0].previousCount,null,'null does not mean zero');
assert.equal(normalized[0].currentCount,null);
assert.equal(normalized[0].groupPreviousCount,null);
assert.equal(normalized[1].previousCount,0);
assert.equal(normalized[1].currentCount,1);
assert.equal(normalized[1].groupPreviousCount,null);
assert.equal(normalized[1].groupCurrentCount,null);
assert.equal(context.chronicleCountDetail({type:'drop',previousCount:null,currentCount:5}), '','missing individual history is not invented');
assert.match(context.chronicleCountDetail({type:'drop',previousCount:4,currentCount:5,groupPreviousCount:13,groupCurrentCount:14}),/Individual Collection Log count 4 → 5, .*Group Collection Log count 13 → 14/);

// Check the user's real example against all five saved member logs.
const real=JSON.parse(fs.readFileSync('docs/data/temple-clog.json'));
logs=Object.fromEntries(keys.map(key=>[key,{data:{items:{Bosses:[]}}}]));
function collect(node,out){if(Array.isArray(node))node.forEach(value=>collect(value,out));else if(node&&typeof node==='object'){if(Number(node.id)===id)out.push(node);else Object.values(node).forEach(value=>collect(value,out))}}
for(const key of keys)collect(real.players[key].data.items,logs[key].data.items.Bosses);
context.state.temple=real;
const realRecent=context.templeRecent(),example=realRecent.find(d=>d.id===id&&d.player==='Dikste'&&d.previousCount===4&&d.currentCount===5);
assert(example,'the requested saved example exists');
assert.deepEqual(pair(counts(realRecent).get(example)),[13,14]);
console.log('Chronicle counts passed: Dikste Zenyte shard 4 → 5, group 13 → 14; saved snapshots, retention, historical rewinding, stacks, simultaneous updates, category deduplication, missing history and all-five scope.');
