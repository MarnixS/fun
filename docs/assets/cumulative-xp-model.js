(function(root){
'use strict';
// OSRS XP formula: floor(sum(floor(n + 300 * 2^(n/7))) / 4).
const thresholds=[0,0];let points=0;
for(let n=1;n<250;n++){points+=Math.floor(n+300*Math.pow(2,n/7));thresholds[n+1]=Math.floor(points/4)}
function levelForXp(xp){if(!Number.isFinite(xp)||xp<0)return null;let lo=1,hi=thresholds.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(thresholds[mid]<=xp)lo=mid;else hi=mid-1}return lo}
const validXp=x=>x!=null&&Number.isFinite(+x)&&+x>=0?+x:null;
function snapshot(doc,key){return doc?.profiles?.[key]?.latestSnapshot||doc?.profiles?.[key]?.latest_snapshot||null}
function skillKeys(doc){return [...new Set(Object.keys(doc?.profiles||{}).flatMap(k=>Object.keys(snapshot(doc,k)?.data?.skills||{})))].filter(k=>k!=='overall')}
function aggregate(doc,keys,skills=skillKeys(doc)){
 const rows=skills.map(skill=>{const members=keys.map(key=>({key,xp:validXp(snapshot(doc,key)?.data?.skills?.[skill]?.experience)}));const known=members.filter(p=>p.xp!=null),xp=known.length?known.reduce((n,p)=>n+p.xp,0):null,level=levelForXp(xp);return{skill,members,xp,level,gameLevel:level==null?null:Math.min(99,level),complete:known.length===keys.length,known:known.length,nextXp:level==null?null:thresholds[level+1]}});
 const contributions=keys.map(key=>{const values=rows.map(r=>r.members.find(p=>p.key===key).xp),known=values.filter(v=>v!=null);return{key,xp:known.length?known.reduce((n,x)=>n+x,0):null,known:known.length,complete:known.length===skills.length,date:snapshot(doc,key)?.createdAt||null}});
 const knownRows=rows.filter(r=>r.xp!=null),xp=knownRows.length?knownRows.reduce((n,r)=>n+r.xp,0):null,level=levelForXp(xp);
 return{rows,contributions,xp,level,nextXp:level==null?null:thresholds[level+1],complete:rows.length>0&&rows.every(r=>r.complete),gameTotal:knownRows.reduce((n,r)=>n+r.gameLevel,0),equivalentTotal:knownRows.reduce((n,r)=>n+r.level,0),maxed:knownRows.filter(r=>r.gameLevel===99).length};
}
const api={thresholds,levelForXp,skillKeys,aggregate};if(typeof module==='object'&&module.exports)module.exports=api;else root.UGCumulativeXP=api;
})(typeof window==='object'?window:globalThis);
