(function(root){
  'use strict';
  function items(log) {
    if (!log || log.error || log.errors) return null;
    const data=log.data||log;if (!data.items || typeof data.items!=='object') return null;
    const out=new Set();
    function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;if(n.id!=null){if(Number(n.count??n.quantity)>0)out.add(String(n.id));return;}Object.values(n).forEach(walk)}
    walk(data.items);return out;
  }
  function progress(goal,player,wom,temple) {
    if (!goal?.kind || goal.kind==='none') return null;
    let value, source='Reported by player';
    const d=wom?.profiles?.[player]?.latestSnapshot?.data;
    if(goal.kind==='manual') value=goal.current;
    else if(goal.kind==='level') {value=d?.skills?.[goal.metric]?.level;source='WOM';}
    else if(goal.kind==='xp') {value=d?.skills?.[goal.metric]?.experience;source='WOM';}
    else if(goal.kind==='boss') {value=d?.bosses?.[goal.metric]?.kills;source='WOM';}
    else {const ids=items(temple?.players?.[player]);source='Temple';value=ids?(goal.kind==='item'?(ids.has(String(goal.metric))?1:0):ids.size):null;}
    const target=Number(goal.targetValue);
    if(value==null||!Number.isFinite(Number(value))||Number(value)<0||!Number.isFinite(target)||target<=0)return {unknown:true,source};
    return {value:Number(value),target,percent:Math.min(100,Math.max(0,Number(value)/target*100)),source,complete:Number(value)>=target};
  }
  const api={progress,items};if(typeof module==='object'&&module.exports)module.exports=api;else root.UGGoalProgress=api;
})(typeof window==='undefined'?globalThis:window);
