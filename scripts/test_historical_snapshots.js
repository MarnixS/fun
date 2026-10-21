'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{apply,SKILLS}=require('./import_historical_snapshots'),{thresholds,levelForXp}=require('../docs/assets/cumulative-xp-model'),R=require('../docs/assets/xp-records-model'),{mergeWom}=require('../docs/assets/wom-store');
const source=require('../docs/data/historical-snapshots.json'),doc=require('../docs/data/wom-cache.json'),key='big dog aura',rows=doc.snapshots[key].filter(row=>row.provenance?.kind==='historical-screenshot');
assert.equal(rows.length,7);assert.deepEqual(rows.map(row=>row.createdAt.slice(0,10)),['2021-10-21','2022-01-24','2023-04-25','2023-05-04','2023-05-05','2024-01-01','2024-07-16']);
assert.deepEqual(rows.map(row=>row.data.skills.overall.level),[589,1295,1605,1617,1627,1798,1827]);
assert.deepEqual(rows.map(row=>row.data.skills.overall.experience),[1062100,14680662,51028786,52677748,52697332,76075086,84109604]);
for(const row of rows){
 const skills=row.data.skills;assert.equal(Object.keys(skills).length,24);assert(!skills.sailing,'no Sailing invented before release');assert.equal(Object.keys(row.data.bosses).length,0);assert.equal(Object.keys(row.data.computed).length,0);assert.equal(Object.keys(row.data.activities).length,0);
 let xp=0,levels=0;for(const skill of SKILLS){const value=skills[skill];assert.equal(value.experience,thresholds[value.level]);assert.equal(levelForXp(value.experience),value.level);xp+=value.experience;levels+=value.level;assert.equal(value.rank,-1);assert(value.experienceRange.max>=value.experience)}
 assert.equal(xp,skills.overall.experience);assert.equal(skills.overall.level-levels,row.provenance.unallocatedLevels);assert.equal(row.provenance.datePrecision,'day');
}
assert.equal(rows[0].data.skills.hitpoints.level,52,'read the base HP, not the drained 15');assert.equal(rows[0].data.skills.prayer.level,50,'read the base Prayer, not the drained zero');
assert.equal(rows[3].data.skills.farming.level,31);assert.equal(rows[4].data.skills.farming.level,38);assert.equal(rows[5].data.skills.magic.experience,8771558,'even visible exact XP uses the owner’s minimum-XP policy');
for(const skill of ['prayer','fletching','woodcutting'])assert(rows[5].data.skills[skill].assumed);
assert.deepEqual(rows.slice(-2).map(row=>row.provenance.unallocatedLevels),[12,12],'do not silently invent hidden level-ups to force the visible total');
assert.deepEqual(apply(doc,source).document,doc,'reimport is deterministic and idempotent');
for(const row of rows.slice(-2))for(const skill of row.provenance.assumedSkills)assert.equal(row.data.skills[skill].assumedFrom,'2023-05-05T00:00:00.000Z','do not use an intervening assumed value as a new observation');
const withPrior=structuredClone(doc),prior=structuredClone(rows[4]);prior.createdAt='2023-12-01T12:00:00.000Z';delete prior.provenance;
for(const skill of ['prayer','fletching','woodcutting'])prior.data.skills[skill].level+=1;
withPrior.snapshots[key].push(prior);
const inherited=apply(withPrior,source).document.snapshots[key].find(row=>row.createdAt.startsWith('2024-01-01'));
assert.equal(inherited.data.skills.prayer.level,75);assert.equal(inherited.data.skills.prayer.assumedFrom,prior.createdAt,'the closest earlier WOM observation takes priority over an older screenshot');
const fresh={profiles:{[key]:structuredClone(doc.profiles[key])},snapshots:{[key]:[structuredClone(doc.profiles[key].latestSnapshot)]},fetchedAt:doc.fetchedAt+1000};
const merged=mergeWom(doc,fresh);assert.equal(merged.snapshots[key].filter(row=>row.provenance?.kind==='historical-screenshot').length,7,'future manual WOM refreshes retain screenshot entries');assert.deepEqual(merged.profiles[key],doc.profiles[key],'an old entry cannot replace the current profile');
const at=Date.parse('2023-01-01'),day=R.DAY;
let bounds=R.boundedPoints([{time:at,value:100,maximum:199,estimated:true},{time:at+day,value:200}],1);
assert.equal(bounds.record.gain,1,'minimum-XP starting counters must not inflate a guaranteed gain');assert.equal(bounds.record.proof.startMaximum,199);
bounds=R.boundedPoints([{time:at,value:150},{time:at+day/2,value:100,maximum:199,estimated:true},{time:at+day,value:200}],1);
assert.equal(bounds.coverage.corrections,0,'an overlapping historical XP range is not a genuine reset');assert.equal(bounds.record.gain,50);
bounds=R.boundedPoints([{time:at,latestTime:at+day-1,value:0},{time:at+day,latestTime:at+2*day-1,value:100}],1);
assert.equal(bounds.record.gain,50,'two date-only observations on adjacent dates can be nearly 48 hours apart');assert.equal(bounds.record.inferred,true);assert(bounds.record.proof.timeUncertain);
let seed=7;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32};
for(let trial=0;trial<100;trial++){
 let xp=0;const actual=[],uncertain=[];
 for(let i=0;i<30;i++){xp+=Math.floor(random()*100);actual.push({time:at+i*day/2,value:xp});uncertain.push({time:at+i*day/2,value:Math.max(0,xp-Math.floor(random()*90)),maximum:xp+Math.floor(random()*90),estimated:true})}
 for(const days of [1,7,30]){const measured=R.bestPoints(actual,days).record.gain,result=R.boundedPoints(uncertain,days).record;assert(result.gain<=measured&&measured<=result.upperBound,'uncertain source bounds must enclose the real hidden history')}
}
console.log('Historical entries passed: seven dates, minimum XP, all base levels, known totals, explicit inherited skills, no invented KC/EHP/Sailing, idempotent imports, refresh retention and 300 uncertain-history bound checks.');
