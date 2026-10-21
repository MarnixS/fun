'use strict';
const assert=require('node:assert/strict'),M=require('../docs/assets/stat-progress-model');
const time=Date.parse('2026-10-18T08:00:00Z'),at=days=>new Date(time+days*M.DAY).toISOString();
const snap=(day,xp,extra={})=>({createdAt:at(day),data:{skills:{overall:{experience:xp,level:100},attack:{experience:xp,level:50}},...extra}});
const rows=[snap(-8,10),snap(-6,100),snap(-3,200),snap(0,400)];
const doc={profiles:{a:{latestSnapshot:rows.at(-1)}},snapshots:{a:rows,b:[snap(-5,1000),snap(-1,1300)],zero:[snap(-2,50),snap(0,50)],missing:[snap(0,900)]}};
const keys=['a','b','zero','missing'],model=M.build(doc,keys);
let result=model.compare('xp','overall',7);
assert.equal(result.domain.end,time);assert.equal(result.domain.start,time-7*M.DAY);
assert.deepEqual(result.rows.map(r=>[r.key,r.gain,r.rank]),[['a',300,1],['b',300,1],['zero',0,3],['missing',null,null]]);
assert.equal(result.rows[0].start,time-6*M.DAY,'an older boundary snapshot must not inflate the gain');
assert.equal(model.compare('xp','overall',7,['b']).domain.end,time,'player selection does not move the time window');
assert.equal(model.compare('xp','overall',1).rows.find(r=>r.key==='a').gain,null,'one point is not a confirmed zero');
for(const row of result.rows)if(row.gain!==null)assert.equal(row.gain,row.points.at(-1).value-row.points[0].value,'rank and timeline use identical endpoints');
const summary=structuredClone(doc);summary.gains={week:{a:{startsAt:at(-7),endsAt:at(0),data:{skills:{overall:{experience:{start:50,end:400,gained:999999}}}}}}};
result=M.build(summary,keys).compare('xp','overall',7);
assert.equal(result.rows.find(r=>r.key==='a').gain,350,'use summary counters and dates, never an unrelated gained field');
assert.equal(result.rows.find(r=>r.key==='a').points[0].time,time-7*M.DAY);
summary.gains.week.a.startsAt=at(-7.1);
assert.equal(M.build(summary,keys).compare('xp','overall',7).rows.find(r=>r.key==='a').gain,300,'out-of-window summary baselines stay excluded');
summary.gains.week.a.data.skills.overall.experience.end=9999;
assert.equal(M.build(summary,keys).compare('xp','overall',7).rows.find(r=>r.key==='a').points.at(-1).value,400,'a full snapshot takes priority at the same timestamp');
const correction={snapshots:{a:[snap(-6,100),snap(-4,500),snap(-2,200),snap(0,250)]}};
const corrected=M.build(correction,['a']).compare('xp','overall',7).rows[0];
assert.equal(corrected.gain,50);assert.equal(corrected.corrections,1);assert.equal(corrected.start,time-2*M.DAY);
correction.snapshots.a.push(snap(.1,100));
assert.equal(M.build(correction,['a']).compare('xp','overall',7).rows[0].gain,null,'a reset with no subsequent observation remains unknown');
for(const value of [null,undefined,NaN,-1,Infinity,'100'])assert.equal(M.value({skills:{attack:{experience:value}}},'xp','attack'),null);
assert.equal(M.value({bosses:{zulrah:{kills:0,rank:-1}}},'boss','zulrah'),null);
assert.equal(M.value({bosses:{zulrah:{kills:0,rank:100}}},'boss','zulrah'),0);
assert.equal(M.value({computed:{ehp:{value:1.25}}},'computed','ehp'),1.25);
assert.equal(M.value({skills:{attack:{level:0}}},'level','attack'),null);
assert.equal(M.build({},['a']).compare('xp','overall',7).rows[0].gain,null);
assert.throws(()=>model.compare('xp','overall',2),RangeError);
const fs=require('node:fs'),R=require('../docs/assets/xp-records-model'),saved=JSON.parse(fs.readFileSync('docs/data/wom-cache.json')),players=Object.keys(saved.profiles),progress=M.build(saved,players),records=R.build(saved,players);
const recent=progress.compare('xp','agility',90).rows.find(row=>row.key==='lijpste');
const historic=progress.compare('xp','agility',90,players,'records').rows.find(row=>row.key==='lijpste');
assert(historic.gain>=6406522&&historic.gain>recent.gain,'Lijpste’s earlier Agility run must outrank his recent three months');
assert.equal(new Date(historic.start).toISOString().slice(0,10),'2026-05-07');
let comparisons=0;
for(const [kind,metric]of [['xp','overall'],['level','overall'],...progress.metrics.skills.flatMap(key=>[['xp',key],['level',key]]),...progress.metrics.bosses.map(key=>['boss',key]),['computed','ehp'],['computed','ehb']])for(const period of M.PERIODS){
 const expected=records.records(kind+':'+metric,period.days),best=progress.compare(kind,metric,period.days,players,'records').rows,latest=progress.compare(kind,metric,period.days).rows;
 assert.deepEqual(best.map(row=>[row.key,row.gain,row.rank]),expected.map(row=>[row.key,row.record?.gain??null,row.rank]),'both pages rank the same records');
 for(const row of best){
  const current=latest.find(current=>current.key===row.key);
  if(current.gain!==null)assert(row.gain>=current.gain,'a personal best cannot be lower than an observed recent run');
  if(row.gain!==null){
   if(row.inferred){assert.equal(row.start,null);assert.equal(row.end,null);assert.equal(row.points.length,0,'an inferred minimum cannot fabricate a timeline');assert(row.proof.span>period.days*M.DAY)}
   else{assert.equal(row.gain,row.points.at(-1).value-row.points[0].value);assert(row.span<=period.days*M.DAY)}
   assert.deepEqual(row.proof,expected.find(other=>other.key===row.key).record.proof);
  }
  comparisons++;
 }
}
assert.throws(()=>model.compare('xp','overall',7,keys,'invalid'),RangeError);
console.log(`Historical records agree across both pages for ${comparisons} player/metric/window comparisons; every observed recent gain is bounded by its personal best, with matching evidence and no invented inferred timelines.`);
console.log('Stat Progress model passed: common windows, matching graph/rank endpoints, summary dates, ties, missing data, zero gains, corrections and invalid counters.');
