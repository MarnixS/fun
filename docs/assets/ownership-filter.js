(function(root){
'use strict';
function matches(row,selected,known,rules,bounds={}){
 for(const key of selected){const rule=rules.get(key)||'any';if(rule==='any')continue;if(!known.includes(key))return false;const count=row.counts[key]||0;if(rule==='has'&&count<1||rule==='missing'&&count>0||rule==='dupes'&&count<2)return false}
 const available=selected.filter(k=>known.includes(k)),owners=available.filter(k=>(row.counts[k]||0)>0).length,quantity=available.reduce((n,k)=>n+(row.counts[k]||0),0);
 for(const [value,min,max] of [[owners,bounds.minOwners,bounds.maxOwners],[quantity,bounds.minCopies,bounds.maxCopies]]){if(min!==''&&min!=null&&value<+min)return false;if(max!==''&&max!=null&&value>+max)return false}return true;
}
const api={matches};if(typeof module==='object'&&module.exports)module.exports=api;else root.UGOwnershipFilter=api;
})(typeof window==='object'?window:globalThis);
