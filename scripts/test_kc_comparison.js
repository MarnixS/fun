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
console.log('KC comparison: selected counts, exact totals/gaps, ranks, shares, ties, known zero and unknown/missing data passed.');
