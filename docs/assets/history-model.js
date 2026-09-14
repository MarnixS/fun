(function(root){
'use strict';
const DAY=86400000;
const combat=new Set(['attack','strength','defence','ranged','magic','hitpoints']);
const name=k=>k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
function delta(a,b){return Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&b>=0?Math.max(0,b-a):0}
function interval(a,b){
 const out={start:a.createdAt,end:b.createdAt,skills:{},bosses:{},xp:0,levels:0,gaps:0};
 out.gaps=+new Date(b.createdAt)-+new Date(a.createdAt)>45*DAY?1:0;
 for(const [key,v] of Object.entries(b.data?.skills||{})){
  if(key==='overall')continue;const old=a.data?.skills?.[key];
  const xp=delta(old?.experience,v.experience),levels=delta(old?.level,v.level);
  if(xp||levels)out.skills[key]={xp,levels,effort:xp?delta(old?.ehp,v.ehp):0};
  out.xp+=xp;out.levels+=levels;
 }
 for(const [key,v] of Object.entries(b.data?.bosses||{})){
  const old=a.data?.bosses?.[key],kc=delta(old?.kills,v.kills);
  if(kc)out.bosses[key]={kc,effort:delta(old?.ehb,v.ehb)};
 }
 return out;
}
function merge(a,b){
 const out={...a,end:b.end,xp:a.xp+b.xp,levels:a.levels+b.levels,gaps:a.gaps+b.gaps,skills:{},bosses:{}};
 for(const kind of ['skills','bosses'])for(const key of new Set([...Object.keys(a[kind]),...Object.keys(b[kind])])){
  out[kind][key]={};for(const field of kind==='skills'?['xp','levels','effort']:['kc','effort'])out[kind][key][field]=(a[kind][key]?.[field]||0)+(b[kind][key]?.[field]||0);
 }
 return out;
}
function describe(e){
 const bosses=Object.entries(e.bosses).map(([key,v])=>({key,...v,score:v.effort||v.kc/25})).sort((a,b)=>b.score-a.score);
 // Combat XP often accompanies boss kills: do not count it as a separate skilling focus.
 const skills=Object.entries(e.skills).map(([key,v])=>({key,...v,score:(v.effort||v.xp/100000)*(bosses.length&&combat.has(key)?0:1)})).sort((a,b)=>b.score-a.score);
 const bs=bosses.reduce((n,x)=>n+x.score,0),ss=skills.reduce((n,x)=>n+x.score,0),total=bs+ss;
 let type='No recorded gains',kind='quiet',focus=[];
 if(total){
  if(bs/total>=.25&&bosses[0])focus.push(bosses[0]);
  if(ss/total>=.25&&skills[0]?.score)focus.push(skills[0]);
  if(!focus.length)focus=[...(bosses[0]?[bosses[0]]:[]),...(skills[0]?[skills[0]]:[])].sort((a,b)=>b.score-a.score).slice(0,1);
  kind=bs/total>=.75?'bossing':ss/total>=.75?'skilling':'mixed';
  if(focus.length===1){const group=kind==='bossing'?bosses:skills,groupTotal=kind==='bossing'?bs:ss;if(group[1]&&group[1].score/groupTotal>=.25)focus.push(group[1])}
  type=focus.map(x=>name(x.key)).join(' + ')+(kind==='mixed'?' · mixed':'');
 }
 return {...e,type,kind,skillsRanked:skills,bossesRanked:bosses,kc:bosses.reduce((n,x)=>n+x.kc,0)};
}
function eras(snapshots){
 const arr=[...snapshots].filter(x=>Number.isFinite(+new Date(x.createdAt))).sort((a,b)=>+new Date(a.createdAt)-+new Date(b.createdAt));
 const periods=[];let pending=null;
 for(let i=1;i<arr.length;i++){
  if(arr[i].createdAt===arr[i-1].createdAt)continue;
  const e=interval(arr[i-1],arr[i]);pending=pending?merge(pending,e):e;
  // Roughly monthly, bounded by actual snapshots. Never invent dates inside a gap.
  if(+new Date(pending.end)-+new Date(pending.start)>=28*DAY){periods.push(pending);pending=null}
 }
 if(pending)periods.push(pending);
 return periods.map(describe);
}
function compareEvents(a,b){
 return b.date-a.date||String(a.key).localeCompare(String(b.key))||String(a.type).localeCompare(String(b.type))||String(a.metric||'').localeCompare(String(b.metric||''))||((b.level||0)-(a.level||0));
}
const api={interval,merge,describe,eras,compareEvents};
if(typeof module==='object'&&module.exports)module.exports=api;else root.UGHistory=api;
})(typeof window==='object'?window:globalThis);
