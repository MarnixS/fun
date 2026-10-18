/* Period gains and timelines use the same observed WOM endpoints. */
(function(root){
'use strict';
const DAY=86400000;
const PERIODS=[{days:1,label:'1 day'},{days:7,label:'7 days'},{days:30,label:'1 month'},{days:90,label:'3 months'},{days:180,label:'6 months'},{days:365,label:'1 year'}];
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
function value(data,kind,key){
 const node=data?.[kind==='boss'?'bosses':kind==='computed'?'computed':'skills']?.[key];
 const number=node?.[{xp:'experience',level:'level',boss:'kills',computed:'value'}[kind]];
 return valid(number)&&!(kind==='level'&&number<1)&&!(kind==='boss'&&number===0&&node.rank===-1)?number:null;
}
function snapshots(doc,key){
 const rows=new Map();
 for(const row of [...(doc?.snapshots?.[key]||doc?.history?.[key]||[]),doc?.profiles?.[key]?.latestSnapshot||doc?.profiles?.[key]?.latest_snapshot]){
  const time=Date.parse(row?.createdAt);if(row?.data&&Number.isFinite(time))rows.set(time,row);
 }
 return [...rows.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
}
function build(doc,keys){
 const index=new Map(keys.map(key=>[key,snapshots(doc,key)])),skills=new Set(),bosses=new Set(),cache=new Map();
 let latest=null;
 for(const rows of index.values())for(const row of rows){
  const time=Date.parse(row.createdAt);latest=latest===null?time:Math.max(latest,time);
  for(const key of Object.keys(row.data.skills||{}))if(key!=='overall')skills.add(key);
  for(const key of Object.keys(row.data.bosses||{}))bosses.add(key);
 }
 const metrics={skills:[...skills].sort(),bosses:[...bosses].sort()};
 function points(player,kind,key){
  const id=player+'|'+kind+'|'+key;if(cache.has(id))return cache.get(id);
  const observed=new Map();
  // WOM summaries contain observed start/end counters, not a reconstructed rate.
  // Include their endpoints so cards and charts cannot use different baselines.
  for(const period of Object.values(doc?.gains||{})){
   const run=period?.[player],node=run?.data?.[kind==='boss'?'bosses':kind==='computed'?'computed':'skills']?.[key];
   const counter=node?.[{xp:'experience',level:'level',boss:'kills',computed:'value'}[kind]];
   const start=Date.parse(run?.startsAt),end=Date.parse(run?.endsAt);
   if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)continue;
   for(const [time,endpoint]of [[start,'start'],[end,'end']]){
    const n=counter?.[endpoint];
    if(valid(n)&&!(kind==='level'&&n<1)&&!(kind==='boss'&&n===0&&node.rank?.[endpoint]===-1))observed.set(time,n);
   }
  }
  // Full snapshots take precedence over summary endpoints at the same timestamp.
  for(const row of index.get(player)||[]){const time=Date.parse(row.createdAt),n=value(row.data,kind,key);if(n===null)observed.delete(time);else observed.set(time,n)}
  const result=[...observed].map(([time,value])=>({time,date:new Date(time).toISOString(),value})).sort((a,b)=>a.time-b.time);
  cache.set(id,result);return result;
 }
 function compare(kind,key,days,selected=keys){
  if(!PERIODS.some(p=>p.days===days))throw new RangeError('Unsupported gain period');
  const domain=latest===null?null:{start:latest-days*DAY,end:latest};
  const rows=selected.map(player=>{
   let observed=domain?points(player,kind,key).filter(p=>p.time>=domain.start&&p.time<=domain.end):[],corrections=0,lastReset=0;
   for(let i=1;i<observed.length;i++)if(observed[i].value<observed[i-1].value){lastReset=i;corrections++}
   observed=observed.slice(lastReset);
   const first=observed[0],last=observed.at(-1),known=observed.length>=2;
   let maxGap=0;for(let i=1;i<observed.length;i++)maxGap=Math.max(maxGap,observed[i].time-observed[i-1].time);
   return {key:player,gain:known?last.value-first.value:null,points:observed,start:first?.time??null,end:last?.time??null,span:known?last.time-first.time:0,maxGap,corrections};
  }).sort((a,b)=>(b.gain===null?-Infinity:b.gain)-(a.gain===null?-Infinity:a.gain)||keys.indexOf(a.key)-keys.indexOf(b.key));
  let rank=null,previous=null;
  rows.forEach((row,i)=>{if(row.gain!==null&&row.gain!==previous)rank=i+1;row.rank=row.gain===null?null:rank;previous=row.gain});
  return {domain,rows};
 }
 return {metrics,compare,latest};
}
const api={DAY,PERIODS,value,snapshots,build};
if(typeof module==='object'&&module.exports)module.exports=api;else root.UGStatProgress=api;
})(typeof window==='object'?window:globalThis);
