'use strict';
const assert=require('node:assert/strict');
const L=require('../docs/assets/clog-luck');
const U={snapData:(w,k)=>w[k]};
const players=[{key:'a',name:'A'},{key:'b',name:'B'}];
function model(counts){return{known:new Set(players.map(p=>p.key)),counts:new Map(players.map(p=>[p.key,new Map(Object.entries(counts[p.key]||{}).map(([id,n])=>[+id,n]))]))}}
const wom={
 a:{bosses:{tombs_of_amascut:{kills:100},tombs_of_amascut_expert:{kills:100},chambers_of_xeric:{kills:0},chambers_of_xeric_challenge_mode:{kills:100}},activities:{}},
 b:{bosses:{tombs_of_amascut:{kills:50},tombs_of_amascut_expert:{kills:50},chambers_of_xeric:{kills:0},chambers_of_xeric_challenge_mode:{kills:50}},activities:{}}
};
const m=model({a:{27226:1,27232:0},b:{27226:2,27232:3}});
const mask=L.calculate(27226,'Masori mask',players,wom,m,U);
const chaps=L.calculate(27232,'Masori chaps',players,wom,m,U);
assert(mask&&chaps);
assert.equal(mask.observed,3);assert.equal(chaps.observed,3);
assert(Math.abs(mask.percentile-chaps.percentile)<1e-12,'equal-rate Masori pieces with equal pooled count must have identical percentiles');

const c=model({a:{21034:0,20997:0},b:{21034:0,20997:0}});
const dex=L.calculate(21034,'Dexterous prayer scroll',[players[0]],wom,c,U);
const tbow=L.calculate(20997,'Twisted bow',[players[0]],wom,c,U);
assert(dex&&tbow&&dex.expected>0&&tbow.expected>0);
assert(Math.abs(dex.expected/tbow.expected-6)<1e-10,'CoX CM Dex/Tbow weight ratio must be 12/2');
console.log('Classic CLog luck tests passed: pooled-selection invariance and 2026 CoX CM weights.');


// Historical CoX split: 60 of 100 CM KC before rework, 40 after.
const histWom={a:{bosses:{chambers_of_xeric:{kills:0},chambers_of_xeric_challenge_mode:{kills:100}},activities:{}},snapshots:{a:[
 {createdAt:'2026-08-10T00:00:00Z',data:{bosses:{chambers_of_xeric:{kills:0},chambers_of_xeric_challenge_mode:{kills:60}}}},
 {createdAt:'2026-08-13T00:00:00Z',data:{bosses:{chambers_of_xeric:{kills:0},chambers_of_xeric_challenge_mode:{kills:60}}}}
]}};
const histDex=L.calculate(21034,'Dexterous prayer scroll',[players[0]],histWom,c,U);
const preChance=(62000/867600)*(20/69),postChance=(62000/867600)*(12/56),expectedSplit=60*preChance+40*postChance;
assert(Math.abs(histDex.expected-expectedSplit)<1e-10,'CoX history must split KC across pre/post-12-Aug-2026 tables');
assert.equal(L.assumptions.toa,16667);
assert.equal(L.assumptions.toaLevel,150);
assert.equal(L.assumptions.toaExpert,21875);
assert.equal(L.assumptions.toaExpertLevel,350);

assert.equal(L.assumptions.toaPurple,1/45);
assert.equal(L.assumptions.toaExpertPurple,1/16);

const capModel=model({a:{12934:65535},b:{}});
const capReason=L.exclusion(12934,"Zulrah's scales",[players[0]],wom,capModel,U);
assert(capReason&&capReason.kind==='cap'&&capReason.cap===65535,'capped Collection Log counters must be excluded');

const genericModel=model({a:{26370:1,4740:250},b:{}});
const nexReason=L.exclusion(26370,'Ancient hilt',[players[0]],wom,genericModel,U);
assert(nexReason&&nexReason.kind==='nex','Nex items must be excluded because historical contribution is unknown');
const rackReason=L.exclusion(4740,'Bolt rack',[players[0]],wom,genericModel,U);
assert(rackReason&&rackReason.kind==='barrows','Bolt racks must be excluded because Barrows reward potential is unavailable');
assert.equal(L.calculate(26370,'Ancient hilt',[players[0]],wom,genericModel,U),null);
assert.equal(L.calculate(4740,'Bolt rack',[players[0]],wom,genericModel,U),null);
console.log('Luck exclusions passed: capped counters, Nex and bolt racks.');

const zenyteModel=model({a:{19529:2},b:{}});
const zenyteMissing=L.exclusion(19529,'Zenyte shard',[players[0]],wom,zenyteModel,U);
assert(zenyteMissing&&zenyteMissing.kind==='rate','Zenyte must stay excluded until a real Demonic Gorilla KC denominator is saved');
const zenyteTemple={bossKc:{a:{demonic_gorilla:600,tortured_gorilla:30}}};
assert.equal(L.exclusion(19529,'Zenyte shard',[players[0]],wom,zenyteModel,U,zenyteTemple),null);
const zenyte=L.calculate(19529,'Zenyte shard',[players[0]],wom,zenyteModel,U,zenyteTemple);
assert(zenyte,'Zenyte should score when Temple gorilla KC exists');
assert(Math.abs(zenyte.expected-(600/300+30/3000))<1e-12,'Zenyte expected count must use 1/300 Demonic and 1/3000 Tortured Gorilla rates');
const demonicOnly=L.calculate(19529,'Zenyte shard',[players[0]],wom,zenyteModel,U,{bossKc:{a:{demonic_gorilla:600}}});
assert(demonicOnly&&Math.abs(demonicOnly.expected-2)<1e-12,'missing Tortured Gorilla KC must be omitted rather than guessed');
console.log('Zenyte RNG tests passed: Temple gorilla KC denominator and optional Tortured Gorilla contribution.');



// Current saved log capped-entry audit.
const fs=require('node:fs'),path=require('node:path');
const saved=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/data/temple-clog.json'),'utf8'));
const currentModel=require('../docs/assets/clog-beta-model').build(saved,[
 {key:'dikste',name:'Dikste'},{key:'big dog aura',name:'Big Dog Aura'},{key:'lijpste',name:'Lijpste'},{key:'poep aura',name:'Poep Aura'},{key:'lompste',name:'Lompste'}
]);
const currentPlayers=[{key:'dikste',name:'Dikste'},{key:'big dog aura',name:'Big Dog Aura'},{key:'lijpste',name:'Lijpste'},{key:'poep aura',name:'Poep Aura'},{key:'lompste',name:'Lompste'}].filter(p=>currentModel.known.has(p.key));
const cappedExpected=new Map([[12934,65535],[20718,250],[21817,250],[21820,65535],[24711,250],[27616,65535],[28924,250],[28991,250],[29482,250],[31111,65535],[31235,250],[31916,250]]);
for(const [id,cap] of cappedExpected){
 const atCap=currentPlayers.filter(p=>(currentModel.counts.get(p.key)?.get(id)||0)>=cap);
 assert(atCap.length>0,'expected saved log to contain capped item '+id);
 const reason=L.exclusion(id,currentModel.names.get(id)||('Item '+id),atCap,{},currentModel,{snapData:()=>({})});
 assert(reason&&reason.kind==='cap'&&reason.cap===cap,'saved capped item '+id+' must be excluded at '+cap);
}
assert.equal(cappedExpected.size,12);
const rngHtml=fs.readFileSync(path.join(__dirname,'../docs/rng.html'),'utf8');
assert(/id="clogLuckMembers"/.test(rngHtml),'RNG Index must expose the additive member picker host');
assert(!/<select\b/i.test(rngHtml),'Lucky or Not must use additive member checkboxes, not a dropdown');
console.log('Current saved log capped-entry audit passed: 12 capped unique items; RNG Index uses the additive member picker and has no dropdown.');
