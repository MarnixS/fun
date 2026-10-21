'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../docs/assets/xp-records-model');
const origin=Date.parse('2020-01-01T00:00:00Z');
const snapshot=(day,xp,{level=1,kills=10,rank=1}={})=>({createdAt:new Date(origin+day*M.DAY).toISOString(),data:{skills:{overall:{experience:xp,level},agility:{experience:xp,level}},bosses:{vorkath:{kills,rank}}}});
const rows=[snapshot(0,0),snapshot(.5,100),snapshot(1,350),snapshot(2,400),snapshot(10,800),snapshot(11,1400)];
assert.equal(M.best(rows,'xp:overall',1).record.gain,600,'search old and recent windows, not a current-period total');
assert.equal(M.best(rows.slice(0,4),'xp:overall',1).record.gain,350,'exact 24-hour endpoints are included');
assert.equal(M.best([snapshot(0,0),snapshot(1.00001,1000)],'xp:overall',1).record,null,'a longer gap cannot become a daily record');
assert.equal(M.best(rows,'xp:overall',30).record.gain,1400,'month records can use a shorter confirmed run');
assert.equal(M.best([snapshot(0,500),snapshot(.2,100),snapshot(.5,250)],'xp:overall',1).record.gain,150,'counter correction splits comparisons');
assert.equal(M.best([snapshot(0,0),snapshot(.2,-1),snapshot(.5,50)],'xp:overall',1).record.gain,50,'unknown intermediates do not invent a baseline');
assert.equal(M.best([snapshot(0,-1),snapshot(.5,50)],'xp:overall',1).record,null);
assert.equal(M.best([snapshot(0,0),snapshot(.5,0)],'xp:overall',1).record.gain,0,'two known equal counters are a real zero gain');
assert.equal(M.value(snapshot(0,0,{kills:0,rank:-1}),'boss:vorkath'),null,'unranked zero KC is unknown');
assert.equal(M.value(snapshot(0,0,{kills:3,rank:-1}),'boss:vorkath'),3,'a positive saved low KC remains usable');
assert.equal(M.best([snapshot(0,0,{level:100}),snapshot(1,999,{level:105})],'level:overall',1).record.gain,5);
assert.throws(()=>M.best(rows,'xp:overall',0),RangeError);
// The reported six-month total contains an earlier, larger three-month run.
// Apply the historical-window requirement to XP, levels and boss counters.
const example=[['2026-05-01',0,50,100],['2026-07-29',4623816,80,500],['2026-10-20',6664780,99,600]].map(([date,xp,level,kills])=>({...snapshot(0,xp,{level,kills}),createdAt:date+'T12:00:00Z'}));
for(const [metric,expected]of [['xp:agility',4623816],['xp:overall',4623816],['level:agility',30],['level:overall',30],['boss:vorkath',400]]){
 const record=M.best(example,metric,90).record;
 assert.equal(record.gain,expected,metric+' searches the earlier window');
 assert.equal(new Date(record.start).toISOString().slice(0,10),'2026-05-01');
 assert.equal(new Date(record.end).toISOString().slice(0,10),'2026-07-29');
}
const summaries={snapshots:{a:[snapshot(0,0),snapshot(10,7000000)]},gains:{week:{a:{startsAt:new Date(origin+2*M.DAY).toISOString(),endsAt:new Date(origin+2.5*M.DAY).toISOString(),data:{skills:{agility:{experience:{start:0,end:7000000,gained:999999999}}}}}}}};
assert.equal(M.build(summaries,['a']).records('xp:agility',1)[0].record.gain,7000000,'dated summary counters can prove a record absent from full snapshots; gained is never trusted');
summaries.snapshots.a.push(snapshot(2.5,-1));
assert.equal(M.build(summaries,['a']).records('xp:agility',1)[0].record,null,'an unknown full snapshot overrides a conflicting summary endpoint');
const doc={profiles:{a:{latestSnapshot:snapshot(1,80)}},snapshots:{a:[snapshot(1,50),snapshot(0,10),{createdAt:'invalid',data:{}},snapshot(1,60)]}};
assert.deepEqual(M.snapshots(doc,'a').map(s=>s.data.skills.overall.experience),[10,80],'timestamps are sorted/deduplicated; latest snapshot wins');
const ranked=M.rank([{key:'z',record:null},{key:'b',record:{gain:20}},{key:'a',record:{gain:20}},{key:'c',record:{gain:0}}]);
assert.deepEqual(ranked.map(x=>[x.key,x.rank]),[['a',1],['b',1],['c',3],['z',null]],'competition ranks handle ties, zeroes and missing history');
// Exhaustive endpoint-pair oracle checks the efficient scan across irregular
// history, unknown counters and corrections. No gains are interpolated.
let seed=41;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
for(let trial=0;trial<80;trial++){
 let day=0,xp=100;const input=[];
 for(let i=0;i<40;i++){day+=random()*3;xp=random()<.08?Math.floor(random()*100):xp+Math.floor(random()*200);input.push(snapshot(day,random()<.12?-1:xp))}
 for(const limit of [1,7,30]){
  let expected=null;const points=input.map(s=>({time:Date.parse(s.createdAt),value:M.value(s,'xp:overall')})).filter(p=>p.value!==null);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   if(points[j].time-points[i].time>limit*M.DAY)continue;
   if(points.slice(i+1,j+1).some((p,k)=>p.value<points[i+k].value))continue;
   const gain=points[j].value-points[i].value;expected=Math.max(expected??0,gain);
  }
  const result=M.best(input,'xp:overall',limit).record;
  assert.equal(result?.gain??null,expected);if(result)assert(result.span<=limit*M.DAY&&result.gain>=0);
 }
}
const saved=JSON.parse(fs.readFileSync('docs/data/wom-cache.json')),keys=Object.keys(saved.profiles),model=M.build(saved,keys);
assert(model.metrics.skills.includes('agility')&&model.metrics.skills.includes('sailing'));assert(model.metrics.bosses.length>60);
let checked=0;
for(const metric of ['xp:overall','level:overall',...model.metrics.skills.flatMap(k=>['xp:'+k,'level:'+k]),...model.metrics.bosses.map(k=>'boss:'+k)])for(const p of M.PERIODS){
 for(const row of model.records(metric,p.days))if(row.record){assert(row.record.span<=p.days*M.DAY);assert.equal(row.record.gain,row.record.endValue-row.record.startValue);assert(row.record.observations>=2);assert(Number.isFinite(row.record.gain));checked++}
}
console.log(`XP Records model passed: irregular windows, exact boundaries, missing/unranked counters, corrections, ties, deduplication, exhaustive comparisons and ${checked} saved-history records.`);
