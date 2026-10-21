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
const unknownSummary=M.build(summaries,['a']).records('xp:agility',1)[0];
assert.equal(unknownSummary.observedRecord,null,'an unknown full snapshot overrides a conflicting summary endpoint');
assert.equal(unknownSummary.record.gain,875000,'the remaining summary start and saved end prove a daily minimum');
assert.equal(unknownSummary.record.start,null,'a derived record has no fabricated start date');
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
// All-interval oracle, independent of the two-pointer observed-run scan.
// Dense hidden histories also check that both bounds enclose the real maximum.
for(let trial=0;trial<80;trial++){
 let total=0;const dense=[];
 for(let i=0;i<=80;i++){total+=Math.floor(random()*100);dense.push({time:origin+i*M.DAY/4,value:total})}
 const sparse=dense.filter((_,i)=>i===0||i===80||random()<.14);
 for(const days of [1,2,7,30]){
  const result=M.boundedPoints(sparse,days).record;let expected=0;
  for(let a=0;a<sparse.length;a++)for(let b=a+1;b<sparse.length;b++)expected=Math.max(expected,Math.ceil((sparse[b].value-sparse[a].value)/Math.ceil((sparse[b].time-sparse[a].time)/(days*M.DAY))));
  assert.equal(result.gain,expected,'every observed interval contributes, not only preset window winners');
  const actual=M.bestPoints(dense,days).record.gain;
  assert(result.gain<=actual&&actual<=result.upperBound,'proven minimum <= actual dense record <= possible maximum');
  if(result.inferred){assert.equal(result.start,null);assert.equal(result.end,null);assert(result.proof.span>days*M.DAY)}
 }
}
const farApart=[{time:origin,value:0},{time:origin+800*M.DAY,value:8001}];
assert.equal(M.boundedPoints(farApart,1).record.gain,11,'intervals beyond one year still prove shorter minimums');
assert.equal(M.boundedPoints(farApart,365).record.gain,2667);
assert.equal(M.boundedPoints(farApart,1).record.upperBound,8001,'all gains could occur in one unsaved day');
assert.equal(M.boundedPoints([{time:origin,value:0},{time:origin+2*M.DAY,value:1.5}],1,false).record.gain,.75,'computed hours are not rounded to integer gains');
assert.equal(M.boundedPoints([{time:origin,value:0},{time:origin+2*M.DAY,value:1}],1).record.gain,1,'indivisible gains round up');
assert.equal(M.boundedPoints([{time:origin,value:0},{time:origin+M.DAY,value:100},{time:origin+2*M.DAY,value:0}],1).record.upperBound,null,'a correction leaves unknown gains across that gap');
assert.equal(M.boundedPoints([{time:origin,value:20}],1).record,null,'one observation cannot prove zero');
const farming30=model.records('xp:farming',30).find(row=>row.key==='big dog aura'),farming90=model.records('xp:farming',90).find(row=>row.key==='big dog aura');
assert.equal(farming30.observedRecord.gain,1719359,'the reported insufficient monthly endpoint record is reproduced');
assert.equal(farming90.record.gain,6569431);
assert.equal(farming30.record.gain,2189811,'83.37 days proves a monthly record of at least ceil(6569431 / 3)');
assert.equal(farming30.record.inferred,true);assert.equal(farming30.record.start,null);assert.equal(farming30.record.end,null);assert.equal(farming30.record.proof.parts,3);
assert.equal(farming30.record.proof.gain,6569431);assert(farming30.record.proof.span<90*M.DAY);
const rankBounds=M.rank([{key:'a',record:{gain:10,upperBound:30}},{key:'b',record:{gain:20,upperBound:20}},{key:'c',record:{gain:5,upperBound:5}}]);
assert.deepEqual(rankBounds.map(row=>[row.key,row.rankRange]),[['b',{best:1,worst:2}],['a',{best:1,worst:2}],['c',{best:3,worst:3}]],'overlapping record bounds must not claim a certain winner');
let checked=0,inequalities=0;
for(const metric of ['xp:overall','level:overall',...model.metrics.skills.flatMap(k=>['xp:'+k,'level:'+k]),...model.metrics.bosses.map(k=>'boss:'+k)]){
 const windows=M.PERIODS.map(p=>({days:p.days,rows:model.records(metric,p.days)}));
 for(const {days,rows}of windows)for(const row of rows)if(row.record){
  const r=row.record,p=r.proof;assert.equal(p.gain,p.endValue-p.startValue);assert(p.observations>=2);assert(Number.isFinite(r.gain));
  assert.equal(r.gain,Math.ceil(p.gain/Math.ceil(p.span/(days*M.DAY))));
  if(r.inferred){assert.equal(r.start,null);assert.equal(r.end,null);assert(p.span>days*M.DAY)}
  else{assert(r.span<=days*M.DAY);assert.equal(r.gain,r.endValue-r.startValue)}
  if(r.upperBound!==null)assert(r.gain<=r.upperBound);
  assert(row.rankRange.best<=row.rankRange.worst);checked++;
  for(const larger of windows.filter(w=>w.days>days)){
   const large=larger.rows.find(other=>other.key===row.key).record;assert(large);
   assert(large.gain>=r.gain,'longer records cannot be smaller');
   assert(large.gain<=Math.ceil(larger.days/days)*r.gain,metric+' '+row.key+': longer gains must imply sufficient shorter gains');inequalities++;
  }
 }
}
console.log(`Record bounds passed: Farming regression, all-interval oracle, 320 hidden-history cases, resets, uncertainty, ${checked} saved records and ${inequalities} cross-window inequalities.`);
