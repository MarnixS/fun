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
