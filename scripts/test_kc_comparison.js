'use strict';
const assert=require('node:assert/strict'),M=require('../docs/assets/kc-comparison-model');
const players=[{key:'a',name:'Alpha'},{key:'b',name:'Beta'},{key:'c',name:'Charlie'}];
const profile=kills=>({latestSnapshot:{data:{bosses:{boss:{kills}}}}});
const wom={profiles:{a:profile(120),b:profile(80),c:profile(-1)}};
let r=M.compare(wom,players,'boss');assert.equal(r.total,200);assert.equal(r.gap,40);assert.equal(r.known,2);assert.deepEqual(r.leaders.map(p=>p.key),['a']);assert.equal(r.rows.find(p=>p.key==='a').share,60);assert.equal(r.rows.find(p=>p.key==='b').behind,40);assert.equal(r.rows.find(p=>p.key==='c').kc,null);assert.equal(r.rows.find(p=>p.key==='c').rank,null);
r=M.compare(wom,players.slice(1),'boss');assert.equal(r.total,80);assert.equal(r.gap,null);assert.deepEqual(r.leaders.map(p=>p.key),['b']);
wom.profiles.b=profile(120);r=M.compare(wom,players,'boss');assert.equal(r.gap,0);assert.deepEqual(r.rows.filter(p=>p.rank===1).map(p=>p.key),['a','b']);
wom.profiles.a=profile(0);wom.profiles.b=profile(0);r=M.compare(wom,players,'boss');assert.equal(r.total,0);assert.equal(r.leaders.length,0);assert(r.rows.every(p=>p.rank===null));
for(const missing of [null,undefined,'',NaN]){wom.profiles.c=profile(missing);assert.equal(M.compare(wom,players,'boss').known,2)}
assert.equal(M.build({},players).length,0);assert.equal(M.build(wom,[players[2]],players).length,1);
const ordered=[{key:'obor',total:90000,participants:3},{key:'theatre_of_blood_hard_mode',total:1,participants:1},{key:'chambers_of_xeric',total:400,participants:3},{key:'nex',total:600,participants:2},{key:'tombs_of_amascut_expert',total:150,participants:2},{key:'theatre_of_blood_hard_mode',total:20,participants:2}].sort(M.relevantOrder);
assert.deepEqual(ordered.map(b=>b.key),['theatre_of_blood_hard_mode','tombs_of_amascut_expert','nex','chambers_of_xeric','obor','theatre_of_blood_hard_mode']);
assert.equal(M.relevance('new_unknown_boss'),2);
wom.profiles.a=profile(120);wom.profiles.b=profile(80);r=M.compare(wom,players,'boss');assert.equal(r.participants,2);let slices=M.shares(r);assert.equal(slices.length,2);assert.equal(slices[0].start,0);assert.equal(slices[0].end,216);assert.equal(slices[1].end,360);
wom.profiles.b=profile(0);r=M.compare(wom,players,'boss');assert.equal(M.shares(r).length,1);assert.equal(M.shares(r)[0].end,360);wom.profiles.a=profile(0);assert.deepEqual(M.shares(M.compare(wom,players,'boss')),[]);
console.log('KC comparison: relevance/shared-participation ordering, pie shares,  selected counts, exact totals/gaps, ranks, shares, ties, known zero and unknown/missing data passed.');
