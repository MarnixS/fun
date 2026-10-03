(function(root){
'use strict';
function data(wom,key){return wom?.profiles?.[key]?.latestSnapshot?.data||wom?.profiles?.[key]?.latest_snapshot?.data}
function count(wom,player,boss){const raw=data(wom,player)?.bosses?.[boss]?.kills;if(raw==null||raw===''||!Number.isFinite(+raw)||+raw<0)return null;return Math.floor(+raw)}
function compare(wom,players,key){
 const rows=players.map(p=>({...p,kc:count(wom,p.key,key)})).sort((a,b)=>a.kc==null?b.kc==null?a.name.localeCompare(b.name):1:b.kc==null?-1:b.kc-a.kc||a.name.localeCompare(b.name));
 const known=rows.filter(p=>p.kc!=null),total=known.reduce((n,p)=>n+p.kc,0),max=known[0]?.kc??0,leaders=max>0?known.filter(p=>p.kc===max):[];
 return{key,total,max,leaders,gap:max>0&&known.length>1?max-known[1].kc:null,known:known.length,rows:rows.map(p=>({...p,rank:p.kc==null||!max?null:1+known.filter(x=>x.kc>p.kc).length,share:p.kc==null?null:total?100*p.kc/total:0,behind:p.kc==null?null:max-p.kc}))};
}
function build(wom,players,catalogPlayers=players){const keys=new Set(catalogPlayers.flatMap(p=>Object.keys(data(wom,p.key)?.bosses||{})));return[...keys].map(k=>compare(wom,players,k))}
const api={compare,build};if(typeof module==='object'&&module.exports)module.exports=api;else root.UGKCComparison=api;
})(typeof window==='undefined'?globalThis:window);
