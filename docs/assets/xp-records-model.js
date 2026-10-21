/* Rolling record bounds proved by saved counters, without inventing samples. */
(function(root){
'use strict';
const DAY=86400000;
const PERIODS=[{days:1,label:'1 day'},{days:7,label:'7 days'},{days:30,label:'1 month'},{days:90,label:'3 months'},{days:180,label:'6 months'},{days:365,label:'1 year'}];
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
function snapshots(doc,key){
 const rows=new Map(),profile=doc?.profiles?.[key];
 for(const row of [...(doc?.snapshots?.[key]||doc?.history?.[key]||[]),profile?.latestSnapshot||profile?.latest_snapshot]){
  const time=Date.parse(row?.createdAt);if(row?.data&&Number.isFinite(time))rows.set(time,row);
 }
 return [...rows.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
}
function value(snapshot,metric){
 const [kind,key]=metric.split(':'),data=snapshot?.data;
 if(kind==='boss'){
  const node=data?.bosses?.[key];
  // WOM uses zero for some unranked bosses: that is not a known zero-KC baseline.
  return valid(node?.kills)&&!(node.kills===0&&node.rank===-1)?node.kills:null;
 }
 const node=data?.[kind==='computed'?'computed':'skills']?.[key],number=kind==='xp'?node?.experience:kind==='level'?node?.level:kind==='computed'?node?.value:null;
 return valid(number)&&(kind!=='level'||number>=1)?number:null;
}
// Both period gains and records use the same dated observations. WOM gain
// summaries can contain real endpoint counters absent from the snapshot list.
function observations(doc,player,metric,rows=snapshots(doc,player)){
 const [kind,key]=metric.split(':'),observed=new Map();
 for(const period of Object.values(doc?.gains||{})){
  const run=period?.[player],node=run?.data?.[kind==='boss'?'bosses':kind==='computed'?'computed':'skills']?.[key];
  const counter=node?.[{xp:'experience',level:'level',boss:'kills',computed:'value'}[kind]];
  const start=Date.parse(run?.startsAt),end=Date.parse(run?.endsAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)continue;
  for(const [time,endpoint]of [[start,'start'],[end,'end']]){
   const n=counter?.[endpoint];
   if(valid(n)&&!(kind==='level'&&n<1)&&!(kind==='boss'&&n===0&&node.rank?.[endpoint]===-1))observed.set(time,{value:n,maximum:n});
  }
 }
 // Full snapshots are authoritative, including an explicitly unknown counter.
 for(const row of rows){
  const time=Date.parse(row.createdAt),n=value(row,metric);if(n===null){observed.delete(time);continue}
  const node=row.data?.skills?.[key],range=kind==='xp'?node?.experienceRange:kind==='level'?node?.levelRange:null;
  const maximum=range&&valid(range.max)&&range.max>=n?range.max:n;
  observed.set(time,{value:n,maximum,estimated:maximum!==n,source:row.provenance?.kind||null,latestTime:row.provenance?.datePrecision==='day'?time+DAY-1:time});
 }
 return [...observed].map(([time,point])=>({time,date:new Date(time).toISOString(),...point})).sort((a,b)=>a.time-b.time);
}
function catalogue(index){
 const skills=new Set(),bosses=new Set();
 for(const rows of index.values())for(const s of rows){
  for(const k of Object.keys(s.data.skills||{}))if(k!=='overall')skills.add(k);
  for(const k of Object.keys(s.data.bosses||{}))bosses.add(k);
 }
 return {skills:[...skills].sort(),bosses:[...bosses].sort()};
}
function best(rows,metric,days){
 const points=rows.map(s=>({time:Date.parse(s.createdAt),value:value(s,metric)})).filter(p=>Number.isFinite(p.time)&&p.value!==null);
 return bestPoints(points,days,rows.length-points.length);
}
function bestPoints(points,days,missing=0){
 if(!Number.isFinite(days)||days<=0)throw new RangeError('A positive record window is required');
 let left=0,winner=null,corrections=0;
 for(let end=0;end<points.length;end++){
  if(end&&points[end].value<points[end-1].value){left=end;corrections++}
  while(points[end].time-points[left].time>days*DAY)left++;
  if(left===end)continue;
  const a=points[left],b=points[end],gain=b.value-a.value,span=b.time-a.time;
  // The earliest point still in the window has the lowest counter in this
  // non-decreasing segment. Search every end date, not just the latest update.
  if(!winner||gain>winner.gain||gain===winner.gain&&(span>winner.span||span===winner.span&&b.time>winner.end)){
   winner={gain,span,start:a.time,end:b.time,startValue:a.value,endValue:b.value,first:left,last:end};
  }
 }
 const coverage={count:points.length,start:points[0]?.time??null,end:points.at(-1)?.time??null,missing,corrections};
 if(!winner)return {record:null,coverage};
 let maxGap=0;for(let i=winner.first+1;i<=winner.last;i++)maxGap=Math.max(maxGap,points[i].time-points[i-1].time);
 const {first,last,...record}=winner;
 return {record:{...record,days,observations:last-first+1,maxGap},coverage};
}
// An observed gain G over T can be partitioned into ceil(T / W) runs of
// at most W. At least one gained >= G / ceil(T / W). Inspect EVERY interval,
// including ones longer than the largest displayed window. Endpoint-only
// records miss this evidence whenever the sampling gap exceeds W.
// Tighten uncertain screenshot counters using earlier/later observations. A
// genuine decrease splits segments; an overlapping XP range is not a reset.
function boundedHistory(input){
 const points=input.map(p=>({...p,maximum:p.maximum??p.value,latestTime:p.latestTime??p.time}));let start=0,floor=-Infinity;
 function finish(end){let ceiling=Infinity;for(let i=end;i>=start;i--){ceiling=Math.min(ceiling,points[i].maximum);points[i].maximum=ceiling}}
 for(let i=0;i<points.length;i++){
  if(points[i].maximum<floor){finish(i-1);start=i;floor=-Infinity}
  points[i].value=Math.max(points[i].value,floor);floor=points[i].value;
 }
 finish(points.length-1);return points;
}
function boundedPoints(input,days,integer=true){
 const points=boundedHistory(input),{coverage}=bestPoints(points,days),limit=days*DAY;
 let proof=null,gain=null,observed=null,upper=0,left=0;
 for(let end=1,segment=0;end<points.length;end++){
  if(points[end].value<points[end-1].value){segment=end;left=end;continue}
  while(left+1<end&&points[end-1].time-points[left+1].latestTime>limit)left++;
  upper=Math.max(upper,points[end].maximum-points[left].value);
  for(let start=segment;start<end;start++){
   const a=points[start],b=points[end],span=b.latestTime-a.time,parts=Math.ceil(span/limit);
   if(!parts)continue;
   // For a level-derived starting point, subtract its largest possible XP,
   // not its assigned minimum. Otherwise a fictitious gain becomes a record.
   const total=Math.max(0,b.value-a.maximum),minimum=integer?Math.ceil(total/parts):total/parts;
   const observedBetter=parts===1&&(!observed||total>observed.gain||total===observed.gain&&(span>observed.span||span===observed.span&&b.time>observed.end));
   const minimumBetter=gain===null||minimum>gain||minimum===gain&&(parts===1&&proof.parts>1||parts===proof.parts&&(total>proof.gain||total===proof.gain&&(span>proof.span||span===proof.span&&b.time>proof.end)));
   if(!observedBetter&&!minimumBetter)continue;
   const candidate={gain:total,span,start:a.time,end:b.time,startValue:a.value,endValue:b.value,startMaximum:a.maximum,endMaximum:b.maximum,startLatest:a.latestTime,endLatest:b.latestTime,timeUncertain:a.latestTime!==a.time||b.latestTime!==b.time,uncertain:!!(a.estimated||b.estimated),historical:!!(a.source||b.source),parts,first:start,last:end};
   if(observedBetter)observed=candidate;
   if(minimumBetter){gain=minimum;proof=candidate}
  }
 }
 function details(run){
  if(!run)return null;
  let maxGap=0;for(let i=run.first+1;i<=run.last;i++)maxGap=Math.max(maxGap,points[i].latestTime-points[i-1].time);
  const {first,last,...rest}=run;return {...rest,days,observations:last-first+1,maxGap};
 }
 const observedRecord=details(observed);proof=details(proof);
 if(!proof)return {record:null,observedRecord,coverage};
 const inferred=proof.parts>1;
 return {record:{...(inferred?{start:null,end:null,span:null,startValue:null,endValue:null,observations:0,maxGap:null}:proof),days,gain,inferred,proof,upperBound:coverage.corrections?null:upper},observedRecord,coverage};
}

function rank(entries){
 const sorted=entries.slice().sort((a,b)=>a.record===null?b.record===null?a.key.localeCompare(b.key):1:b.record===null?-1:b.record.gain-a.record.gain||a.key.localeCompare(b.key));
 let previous=null,position=0;
 return sorted.map((entry,i)=>{
  if(!entry.record)return {...entry,rank:null};
  if(previous!==entry.record.gain)position=i+1;
  previous=entry.record.gain;
  const upper=entry.record.upperBound??Infinity,others=sorted.filter(other=>other.key!==entry.key&&other.record);
  const rankRange={best:1+others.filter(other=>other.record.gain>upper).length,worst:1+others.filter(other=>(other.record.upperBound??Infinity)>entry.record.gain).length};
  return {...entry,rank:position,rankRange};
 });
}
function build(doc,keys){
 const index=new Map(keys.map(key=>[key,snapshots(doc,key)])),metrics=catalogue(index),cache=new Map(),observed=new Map();
 function points(player,metric){
  const id=player+'|'+metric;
  if(!observed.has(id))observed.set(id,observations(doc,player,metric,index.get(player)||[]));
  return observed.get(id);
 }
 function records(metric,days,selected=keys){
  return rank(selected.map(key=>{
   const id=key+'|'+metric+'|'+days;
   if(!cache.has(id))cache.set(id,boundedPoints(points(key,metric),days,!metric.startsWith('computed:')));
   return {key,...cache.get(id)};
  }));
 }
 return {index,metrics,records,points};
}
const api={DAY,PERIODS,snapshots,value,observations,best,bestPoints,boundedHistory,boundedPoints,rank,build};
if(typeof module==='object'&&module.exports)module.exports=api;else root.UGXPRecords=api;
})(typeof window==='object'?window:globalThis);
