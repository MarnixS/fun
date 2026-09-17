'use strict';
const assert=require('node:assert/strict'),H=require('../docs/assets/history-model');
const snap=(date,skills={},bosses={})=>({createdAt:date,data:{skills,bosses}});
const skill=(xp,level=50,ehp=0)=>({experience:xp,level,ehp}),boss=(kills,ehb=0)=>({kills,ehb});
function pair(skills,bosses={},days=7){const a=snap('2026-01-01',Object.fromEntries(Object.keys(skills).map(k=>[k,skill(1000000)])),Object.fromEntries(Object.keys(bosses).map(k=>[k,boss(0)])));const b=snap(new Date(Date.UTC(2026,0,1+days)).toISOString(),Object.fromEntries(Object.entries(skills).map(([k,v])=>[k,skill(1000000+v,51)])),Object.fromEntries(Object.entries(bosses).map(([k,v])=>[k,boss(v)])));return [a,b]}
const era=(sk,bo,days)=>H.describe(H.interval(...pair(sk,bo,days)));
assert.equal(era({magic:4000000,hitpoints:1300000},{zulrah:500}).type,'Zulrah','combat byproduct does not compete with recorded bossing');
assert.equal(era({strength:173673,ranged:186775,hitpoints:120105},{maggot_king:22}).type,'Maggot King');
assert.equal(era({ranged:10000000},{obor:1}).type,'Ranged training','a single kill must not erase an independent combat grind');
assert.equal(era({fishing:3000000,crafting:5000}).type,'Fishing');
assert.equal(era({fishing:1000000,agility:600000,mining:150000}).type,'Varied skilling');
assert.equal(era({magic:5000000,slayer:1320000},{alchemical_hydra:1000}).type,'Alchemical Hydra','Slayer bosses do not double-count Slayer');
assert.equal(era({firemaking:3000000},{wintertodt:200}).type,'Wintertodt');
assert(era({firemaking:10000000},{wintertodt:1}).skillsRanked.find(x=>x.key==='firemaking').score>0,'one skilling boss kill cannot absorb all skill XP');
assert(era({farming:10000000},{hespori:1}).skillsRanked.find(x=>x.key==='farming').score>0,'Hespori is not all farming');
const rates=era({}, {chambers_of_xeric:10,brutus:100});assert.equal(rates.type,'Chambers Of Xeric','raid KC weighs more than quick KC');
const unknown=H.interval(snap('2026-01-01',{}, {obor:boss(-1)}),snap('2026-01-08',{fishing:skill(2000000)},{obor:boss(500)}));assert.equal(unknown.xp,0);assert.equal(Object.keys(unknown.bosses).length,0);assert.equal(H.describe(unknown).type,'Insufficient comparable data');
const reset=H.interval(snap('2026-01-01',{fishing:skill(2000000)}),snap('2026-01-08',{fishing:skill(1000000)}));assert.equal(reset.xp,0);assert.equal(reset.resets,1);
const changing=pair({fishing:1000000},{zulrah:0});changing.push(snap('2026-01-15',{fishing:skill(2000000)},{zulrah:boss(500)}));assert.equal(H.eras(changing).length,2,'different weekly grinds remain separate');assert.equal(H.eras(changing)[0].type,'Fishing');assert.equal(H.eras(changing)[1].type,'Zulrah');
const sparse=H.eras(pair({fishing:10000000},{},90));assert.equal(sparse[0].confidence,'Sparse history');assert.equal(sparse[0].type,'Mixed or changing activity');assert.equal(sparse[0].focus,'Fishing');
const normal=pair({fishing:1000000});const revision=structuredClone(normal);revision[1].data.skills.fishing.ehp=1e9;assert.deepEqual(H.eras(normal),H.eras(revision),'EHP revisions cannot change the inferred activity');
assert.deepEqual(H.eras([...normal,normal[1]].reverse()),H.eras(normal),'duplicate dates and order are deterministic');
const events=[51,52,53,54].map(level=>({date:123,key:'player',metric:'fishing',type:'level',level}));events.push({date:124,key:'other',type:'drop'});events.sort(H.compareEvents);assert.deepEqual(events.slice(1).map(e=>e.level),[54,53,52,51]);
const w=require('../docs/data/wom-cache.json');for(const [k,a]of Object.entries(w.snapshots)){
 for(const windowDays of [7,14,28]){const es=H.eras(a,{windowDays}),raw=a.slice().sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));let xp=0,kc=0;for(let i=1;i<raw.length;i++){const v=H.interval(raw[i-1],raw[i]);xp+=v.xp;kc+=Object.values(v.bosses).reduce((n,x)=>n+x.kc,0)}assert.equal(es.reduce((n,e)=>n+e.xp,0),xp,k+' XP conserved');assert.equal(es.reduce((n,e)=>n+e.kc,0),kc,k+' KC conserved');for(const e of es){assert(e.weights.every(x=>Number.isFinite(x.score)&&x.score>=0));assert(e.skillsRanked.every(x=>x.score>=0));if(e.gaps)assert.equal(e.confidence,'Sparse history')}}
}
console.log('Activity model: causal XP overlap, boss rates, varied skilling, changing eras, gaps, resets, duplicates, EHP stability, all-player conservation and Chronicle ordering passed');
