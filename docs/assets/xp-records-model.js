/* Personal bests supported by saved WOM observations, without interpolation. */
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
 const node=data?.skills?.[key],number=kind==='xp'?node?.experience:kind==='level'?node?.level:null;
 return valid(number)&&(kind!=='level'||number>=1)?number:null;
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
 if(!Number.isFinite(days)||days<=0)throw new RangeError('A positive record window is required');
 const points=rows.map(s=>({time:Date.parse(s.createdAt),value:value(s,metric)})).filter(p=>Number.isFinite(p.time)&&p.value!==null);
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
 const coverage={count:points.length,start:points[0]?.time??null,end:points.at(-1)?.time??null,missing:rows.length-points.length,corrections};
 if(!winner)return {record:null,coverage};
 let maxGap=0;for(let i=winner.first+1;i<=winner.last;i++)maxGap=Math.max(maxGap,points[i].time-points[i-1].time);
 const {first,last,...record}=winner;
 return {record:{...record,days,observations:last-first+1,maxGap},coverage};
}
function rank(entries){
 const sorted=entries.slice().sort((a,b)=>a.record===null?b.record===null?a.key.localeCompare(b.key):1:b.record===null?-1:b.record.gain-a.record.gain||a.key.localeCompare(b.key));
 let previous=null,position=0;
 return sorted.map((entry,i)=>{
  if(!entry.record)return {...entry,rank:null};
  if(previous!==entry.record.gain)position=i+1;
  previous=entry.record.gain;return {...entry,rank:position};
 });
}
function build(doc,keys){
 const index=new Map(keys.map(key=>[key,snapshots(doc,key)])),metrics=catalogue(index),cache=new Map();
 function records(metric,days,selected=keys){
  return rank(selected.map(key=>{
   const id=key+'|'+metric+'|'+days;
   if(!cache.has(id))cache.set(id,best(index.get(key)||[],metric,days));
   return {key,...cache.get(id)};
  }));
 }
 return {index,metrics,records};
}
const api={DAY,PERIODS,snapshots,value,best,rank,build};
if(typeof module==='object'&&module.exports)module.exports=api;else root.UGXPRecords=api;
})(typeof window==='object'?window:globalThis);
