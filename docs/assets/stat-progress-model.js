/* Period gains and timelines use the same observed WOM endpoints. */
(function(root){
'use strict';
const records=typeof module==='object'&&module.exports?require('./xp-records-model'):root.UGXPRecords;
const {DAY,PERIODS,snapshots}=records;
function value(data,kind,key){
 return records.value({data},kind+':'+key);
}
function build(doc,keys){
 const history=records.build(doc,keys),{index,metrics}=history;
 let latest=null;
 for(const rows of index.values())for(const row of rows){
  const time=Date.parse(row.createdAt);latest=latest===null?time:Math.max(latest,time);
 }
 function compare(kind,key,days,selected=keys,mode='recent'){
  if(!PERIODS.some(p=>p.days===days))throw new RangeError('Unsupported gain period');
  if(!['recent','records'].includes(mode))throw new RangeError('Unsupported gain comparison');
  if(mode==='records'){
   const rows=history.records(kind+':'+key,days,selected).map(({key:player,record,rank,rankRange,observedRecord,coverage})=>({
    key:player,rank,gain:record?.gain??null,start:record?.start??null,end:record?.end??null,
    span:record?.span??null,maxGap:record?.maxGap??null,corrections:coverage.corrections,
    inferred:record?.inferred??false,proof:record?.proof??null,upperBound:record?.upperBound??null,rankRange,observedRecord,
    points:record&&!record.inferred&&!record.proof.uncertain?history.points(player,kind+':'+key).filter(p=>p.time>=record.start&&p.time<=record.end):[]
   }));
   const known=rows.filter(row=>row.start!==null);
   const domain=known.length?{start:Math.min(...known.map(row=>row.start)),end:Math.max(...known.map(row=>row.end))}:null;
   return {domain,rows};
  }
  const domain=latest===null?null:{start:latest-days*DAY,end:latest};
  const rows=selected.map(player=>{
   let observed=domain?history.points(player,kind+':'+key).filter(p=>p.time>=domain.start&&p.time<=domain.end):[],corrections=0,lastReset=0;
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
