(function(root){
'use strict';
const field={log:'uniques',xp:'xp',boss:'breadth'};
function score(team,metric){return team?.[field[metric]]??0}
function complete(team,metric){return !!team?.[{log:'logComplete',xp:'xpComplete',boss:'bossComplete'}[metric]]}
function analyse(wom,doc,players,XP,CL){
 const log=CL.build(doc,players),teams=[],n=players.length;
 for(let mask=1;mask<(1<<n);mask++){
  const members=players.filter((p,i)=>mask&(1<<i)),keys=members.map(p=>p.key),ids=new Set(),bosses=new Set();let copies=0,bossComplete=true;
  for(const p of members){for(const [id,count]of log.counts.get(p.key)||[])if(count>0){ids.add(id);copies+=count}const data=wom?.profiles?.[p.key]?.latestSnapshot?.data||wom?.profiles?.[p.key]?.latest_snapshot?.data;if(!data?.bosses)bossComplete=false;for(const [key,v]of Object.entries(data?.bosses||{}))if(v.kills!=null&&Number.isFinite(+v.kills)&&+v.kills>0)bosses.add(key)}
  const xp=XP.aggregate(wom,keys);teams.push({mask,members,keys,size:members.length,ids,uniques:ids.size,copies,breadth:bosses.size,xp:xp.xp??0,xpComplete:xp.complete,gameTotal:xp.gameTotal,equivalentTotal:xp.equivalentTotal,logComplete:keys.every(k=>log.known.has(k)),bossComplete});
 }
 return{players,log,teams,full:teams.find(t=>t.mask===(1<<n)-1)||null};
}
function best(model,size,metric){const candidates=model.teams.filter(t=>t.size===size&&complete(t,metric));if(!candidates.length)return[];const top=Math.max(...candidates.map(t=>score(t,metric)));return candidates.filter(t=>score(t,metric)===top)}
function preserve(model,target,metric){if(!complete(model.full,metric)||!score(model.full,metric))return[];const candidates=model.teams.filter(t=>complete(t,metric)&&score(t,metric)>=score(model.full,metric)*target/100),size=Math.min(...candidates.map(t=>t.size));return candidates.filter(t=>t.size===size).sort((a,b)=>score(b,metric)-score(a,metric)||a.mask-b.mask)}
function credit(model,metric){if(!complete(model.full,metric))return model.players.map(p=>({...p,value:null}));const n=model.players.length,fact=[1];for(let i=1;i<=n;i++)fact[i]=fact[i-1]*i;const byMask=new Map(model.teams.map(t=>[t.mask,t]));return model.players.map((p,i)=>{let value=0;for(let mask=0;mask<(1<<n);mask++){if(mask&(1<<i))continue;const team=byMask.get(mask),size=team?.size||0,weight=fact[size]*fact[n-size-1]/fact[n];value+=weight*(score(byMask.get(mask|(1<<i)),metric)-score(team,metric))}return{...p,value}})}
function lost(model,team){const ids=[...(model.full?.ids||[])].filter(id=>!team.ids.has(id));return ids.map(id=>({id,name:model.log.names.get(id)||'Item '+id,owners:model.players.filter(p=>(model.log.counts.get(p.key)?.get(id)||0)>0)})).sort((a,b)=>a.name.localeCompare(b.name))}
const api={analyse,score,complete,best,preserve,credit,lost};if(typeof module==='object'&&module.exports)module.exports=api;else root.UGGroupChemistry=api;
})(typeof window==='undefined'?globalThis:window);
