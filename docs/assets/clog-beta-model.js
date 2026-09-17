/* Saved Collection Log projection. Shared items are global log counters, not source-specific drops. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.UGClogBetaModel=factory()})(typeof window==='object'?window:this,function(){
'use strict';
const TABS=['bosses','raids','clues','minigames','other'];
function build(doc,players){
 const names=new Map(),counts=new Map(),known=new Set(),categories=[];
 const raw=doc?.catalog?.items??doc?.catalog??{};
 for(const [key,value] of Object.entries(raw)){const id=Number(value?.id??key),name=typeof value==='string'?value:value?.name;if(id>0&&name)names.set(id,name)}
 for(const p of players){const entry=doc?.players?.[p.key],data=entry?.data??entry,map=new Map();counts.set(p.key,map);
  if(!entry||entry.error||entry.errors||!data?.items||typeof data.items!=='object')continue;
  known.add(p.key);
  function walk(node){if(Array.isArray(node)){node.forEach(walk);return}if(!node||typeof node!=='object')return;
   const id=Number(node.id??node.item_id);if(Number.isInteger(id)&&id>0){const n=Number(node.count??node.quantity??0);if(Number.isFinite(n)&&n>=0)map.set(id,Math.max(map.get(id)||0,n));if(node.name)names.set(id,node.name);return}Object.values(node).forEach(walk)}
  walk(data.items);
 }
 const source=doc?.categories?.data??doc?.categories??{};
 for(const tab of TABS)for(const [key,values] of Object.entries(source[tab]??{})){
  if(!Array.isArray(values))continue;
  const ids=[...new Set(values.map(v=>Number(v?.id??v?.item_id??v)).filter(id=>Number.isInteger(id)&&id>0))];
  categories.push({tab,key,ids});
 }
 return{categories,names,counts,known};
}
function shares(model,id,players){
 const entries=players.map(p=>({...p,count:model.known.has(p.key)?model.counts.get(p.key)?.get(id)||0:null}));
 const total=entries.reduce((n,p)=>n+(p.count??0),0);
 return{total,known:entries.filter(p=>p.count!==null).length,entries:entries.map(p=>({...p,share:total&&p.count!==null?p.count/total:0}))};
}
return{TABS,build,shares};
});
