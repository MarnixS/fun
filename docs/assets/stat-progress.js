(()=>{
'use strict';
const U=window.UGV21,C=window.UGV21Charts,M=window.UGStatProgress;
if(!U||!C||!M||document.body.dataset.page!=='progress')return;
const {$,$$,escapeHtml:esc,fmt}=U,TYPES=['total-xp','skill-xp','skill-level','total-level','boss','ehp','ehb'];
let model=null,selected=U.loadMemberSelection(),type='total-xp',metric='',days=7,view='timeline',sortKey='',revision=0;
const keys=()=>U.ALL_KEYS.filter(k=>selected.has(k));
const nice=k=>({runecrafting:'Runecraft',kree_arra:'Kree’arra',kril_tsutsaroth:'K’ril Tsutsaroth',vetion:'Vet’ion'}[k]||U.nice(k));
const kind=()=>type==='boss'?'boss':type.includes('level')?'level':['ehp','ehb'].includes(type)?'computed':'xp';
const metricKey=()=>['total-xp','total-level'].includes(type)?'overall':['ehp','ehb'].includes(type)?type:metric;
const unit=()=>kind()==='boss'?'KC':kind()==='level'?'levels':kind()==='computed'?'hours':'XP';
const label=()=>type==='total-xp'?'Total XP':type==='total-level'?'Total level':kind()==='computed'?type.toUpperCase():nice(metric)+(type==='boss'?' KC':type==='skill-level'?' levels':' XP');
const number=n=>kind()==='computed'?U.fmt1(n):fmt(n);
const date=t=>t===null?'—':new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const stamp=t=>new Date(t).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC';
const span=t=>t<M.DAY?(t/3600000).toLocaleString('en-GB',{maximumFractionDigits:1})+'h':(t/M.DAY).toLocaleString('en-GB',{maximumFractionDigits:1})+' days';
function options(){
 const list=type==='boss'?model.metrics.bosses:model.metrics.skills,show=['skill-xp','skill-level','boss'].includes(type);
 $('#progressType').value=type;
 $('#progressMetricLabel').hidden=!show;
 $('#progressMetricCaption').textContent=type==='boss'?'Boss':'Skill';
 if(!list.includes(metric))metric=type==='boss'&&list.includes('chambers_of_xeric')?'chambers_of_xeric':list[0]||'';
 const select=$('#progressMetric');select.innerHTML=list.map(k=>`<option value="${esc(k)}">${esc(nice(k))}</option>`).join('');select.value=metric;
 $('#progressMetricPicker').hidden=kind()==='computed';
 $('#progressBrowseLabel').textContent=type==='boss'?'Browse or search bosses':'Browse or search skills';
 $('#progressSearchCaption').textContent=type==='boss'?'Find a boss':'Find a skill';
 searchMetrics();
}
function searchMetrics(){
 const query=$('#progressSearch').value.trim().toLowerCase(),boss=type==='boss',level=kind()==='level';
 const list=(boss?model.metrics.bosses:model.metrics.skills).map(key=>({key,kind:boss?'boss':level?'level':'xp',label:nice(key)}));
 if(!boss)list.unshift({key:'overall',kind:level?'level':'xp',label:level?'Total level':'Total XP'});
 const matches=list.filter(item=>{
  const aliases=item.key.startsWith('chambers_of_xeric')?' cox':item.key.startsWith('tombs_of_amascut')?' toa':item.key.startsWith('theatre_of_blood')?' tob':'';
  return (item.label+' '+item.key+aliases).toLowerCase().includes(query);
 });
 $('#progressMetrics').innerHTML=matches.length?matches.map(item=>`<button type="button" data-progress-metric="${item.kind}:${esc(item.key)}" aria-pressed="${kind()===item.kind&&metricKey()===item.key}">${!boss?(item.key==='overall'?'<img class="skill-icon" src="img/ui/skills.png" alt="">':U.skillIcon(item.key)):''}<span>${esc(item.label)}</span></button>`).join(''):'<p class="section-note" role="status">No matching stats.</p>';
}
function readURL(){
 const params=new URL(location.href).searchParams,legacy=params.get('kind');
 type=TYPES.includes(params.get('type'))?params.get('type'):legacy==='boss'?'boss':legacy==='level'?(params.get('metric')==='overall'?'total-level':'skill-level'):legacy==='skill'&&params.get('metric')!=='overall'?'skill-xp':'total-xp';
 days=M.PERIODS.some(p=>p.days===Number(params.get('period')))?Number(params.get('period')):7;
 metric=params.get('metric')||'';view=params.get('view')==='bars'?'bars':'timeline';
 const members=params.get('members')?.split(',').filter(k=>U.ALL_KEYS.includes(k)),owner=params.get('player');
 if(members?.length)selected=new Set(members);else if(U.ALL_KEYS.includes(owner))selected=new Set([owner]);
 options();
}
function writeURL(){
 const url=new URL(location.href);
 for(const key of ['type','metric','period','view','members','kind','player'])url.searchParams.delete(key);
 if(type!=='total-xp')url.searchParams.set('type',type);
 if(['skill-xp','skill-level','boss'].includes(type))url.searchParams.set('metric',metric);
 if(days!==7)url.searchParams.set('period',days);
 if(view!=='timeline')url.searchParams.set('view',view);
 if(selected.size!==U.ALL_KEYS.length)url.searchParams.set('members',keys().join(','));
 history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
function picker(){
 U.renderMemberPicker('#statsMemberPicker',selected,next=>{selected=next;U.saveMemberSelection(next);render();writeURL()},{title:'Players to compare',subtitle:'The same players are used in the rankings, graph and gain tables.',compact:true});
 $('#progressAll').hidden=selected.size===U.ALL_KEYS.length;
}
function highlights(){
 const family=kind(),boss=family==='boss',computed=family==='computed',level=family==='level';
 const list=computed?['ehp','ehb']:boss?model.metrics.bosses:model.metrics.skills;
 const changes=list.map(key=>{
  const rows=model.compare(family,key,days,keys()).rows.filter(r=>r.gain!==null);
  return {key,rows,gain:rows.reduce((sum,r)=>sum+r.gain,0)};
 }).filter(item=>item.gain>0).sort((a,b)=>b.gain-a.gain||a.key.localeCompare(b.key)).slice(0,6);
 $('#progressHighlightsTitle').textContent='What progressed · '+M.PERIODS.find(p=>p.days===days).label;
 $('#progressHighlightsNote').textContent=(boss?'Largest boss KC gains':computed?'Efficiency hours gained':level?'Largest skill level gains':'Largest skill XP gains')+' across the selected players. Choose a stat to inspect it.';
 $('#progressHighlights').innerHTML=changes.length?changes.map(item=>{
  const leader=item.rows[0],p=U.player(leader.key),id=family+':'+item.key;
  const levels=!boss&&!computed&&!level?model.compare('level',item.key,days,keys()).rows.reduce((sum,r)=>sum+(r.gain??0),0):0;
  return `<button type="button" class="progress-highlight" data-progress-metric="${esc(id)}" aria-pressed="${metricKey()===item.key&&kind()===family}" style="--pc:${p.color}"><span class="progress-highlight-name">${!boss&&!computed?U.skillIcon(item.key):''}${esc(computed?item.key.toUpperCase():nice(item.key))}</span><b>+${computed?U.fmt1(item.gain):U.compact(item.gain)} <small>${unit()}</small></b><span class="progress-highlight-note">${levels>0?'+'+fmt(levels)+(levels===1?' level · ':' levels · '):''}Top: <span>${esc(p.name)}</span></span></button>`;
 }).join(''):'<p class="section-note">No positive gains confirmed for these players in this period. Try a longer period to see more progress.</p>';
}
function matrix(){
 const ps=keys(),level=kind()==='level',boss=type==='boss',rowKind=boss?'boss':level?'level':'xp';
 const metrics=boss?model.metrics.bosses:['overall',...model.metrics.skills],table=$('#skillGainTable');
 let rows=metrics.map(key=>({key,rows:model.compare(rowKind,key,days,ps).rows}));
 if(sortKey&&ps.includes(sortKey))rows.sort((a,b)=>{
  if(a.key==='overall')return -1;if(b.key==='overall')return 1;
  return (b.rows.find(r=>r.key===sortKey)?.gain??-Infinity)-(a.rows.find(r=>r.key===sortKey)?.gain??-Infinity)||a.key.localeCompare(b.key);
 });
 $('#progressTableLabel').textContent=boss?'All boss gains':level?'All skill level gains':'All skill XP gains';
 table.innerHTML=`<caption class="sr-only">${boss?'Boss KC':level?'Skill level':'Skill XP'} gained within the selected ${days}-day window</caption><thead><tr><th scope="col"><button type="button" class="metric-link" data-progress-sort="">${boss?'Boss':'Skill'}</button></th>${ps.map(key=>`<th scope="col" aria-sort="${sortKey===key?'descending':'none'}"><button type="button" class="metric-link" data-progress-sort="${esc(key)}" title="Sort by ${esc(U.player(key).name)} gains">${esc(U.player(key).name)}${sortKey===key?' ↓':''}</button></th>`).join('')}</tr></thead><tbody>`+rows.map(item=>{
  const name=item.key==='overall'?(level?'Total level':'Total XP'):nice(item.key);
  return `<tr ${item.key==='overall'&&level?'id="current-stats-total-level" class="total-level-row"':''}><th scope="row"><button type="button" class="metric-link" data-progress-metric="${rowKind}:${esc(item.key)}">${!boss?(item.key==='overall'?'<img class="skill-icon" src="img/ui/skills.png" alt="">':U.skillIcon(item.key)):''}<span>${esc(name)}</span></button></th>`+ps.map(key=>{
   const row=item.rows.find(r=>r.key===key);
   return `<td class="${row.gain>0?'progress-positive':''}" title="${row.gain===null?'No comparable observations':esc(stamp(row.start)+' → '+stamp(row.end))}">${row.gain===null?'—':`+${fmt(row.gain)}<span class="rank-chip">#${row.rank}</span>`}</td>`;
  }).join('')+'</tr>';
 }).join('')+'</tbody>';
}
function render(){
 if(!model)return;
 const focus=document.activeElement,windowFocus=focus?.dataset.progressWindow,periodHost=focus?.closest('#progressGraphPeriods')?'#progressGraphPeriods':'#progressPeriods';
 const {domain,rows}=model.compare(kind(),metricKey(),days,keys()),known=rows.filter(r=>r.gain!==null),top=known[0]?.gain||0,total=known.reduce((sum,r)=>sum+r.gain,0);
 picker();
 const periodButtons=M.PERIODS.map(p=>`<button type="button" data-progress-window="${p.days}" aria-pressed="${p.days===days}" aria-controls="xpChart gainCards progressHighlights">${p.label}${p.days>=30?`<small>${p.days} days</small>`:''}</button>`).join('');
 $('#progressPeriods').innerHTML=periodButtons;$('#progressGraphPeriods').innerHTML=periodButtons;
 $('#progressHeading').innerHTML=(kind()==='xp'&&metricKey()!=='overall'?U.skillIcon(metricKey()):'')+`<span>${esc(label())} gained · ${M.PERIODS.find(p=>p.days===days).label}</span>`;
 $('#progressRange').textContent=domain?stamp(domain.start)+' → '+stamp(domain.end):'No saved WOM observations.';
 $('#progressTotal').textContent=known.length?'+'+number(total)+' '+unit():'—';
 $('#progressTotalNote').textContent=known.length?'combined gain · '+known.length+' of '+rows.length+' selected players with observations':'No comparable observations in this window';
 $('#progressStatus').textContent='Recent gains within this window. Each player’s observed dates are shown below; shorter coverage can affect the comparison.';
 $('#gainCards').innerHTML=rows.map(row=>{
  const p=U.player(row.key),width=row.gain!==null&&top?100*row.gain/top:0;
  return `<article class="records-row ${row.rank===1?'records-leader':''}" data-progress-player="${esc(row.key)}" data-progress-rank="${row.rank??''}" style="--pc:${p.color}"><span class="records-rank" aria-label="${row.rank?'Rank '+row.rank:'Unranked'}">${row.rank?'#'+row.rank:'—'}</span><div class="records-run"><strong>${esc(p.name)}</strong><span class="records-run-note" title="${row.gain!==null?esc(stamp(row.start)+' → '+stamp(row.end)):''}">${row.gain!==null?date(row.start)+' → '+date(row.end)+' · '+span(row.span)+' observed'+(row.corrections?' · after counter correction':''):'Not enough history in this window'}</span><span class="records-bar" aria-hidden="true"><i style="width:${width}%"></i></span></div><div class="records-gain"><b>${row.gain!==null?'+'+number(row.gain):'—'}</b><span>${unit()} gained</span></div></article>`;
 }).join('');
 $('#progressChartTitle').textContent=label()+(view==='bars'?' · player comparison':' · gain over time');
 $('#progressAxis').textContent=unit()+' gained · starts at zero';
 $$('[data-progress-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.progressView===view)));
 const entries=rows.map(row=>({name:U.player(row.key).name,color:U.player(row.key).color,value:row.gain})),format=kind()==='computed'?'hours':'compact';
 if(!known.length)$('#xpChart').innerHTML='<div class="chart-empty" role="status">At least two valid observations in this window are needed to measure gains. Try a longer period.</div>';
 else if(view==='bars')C.drawBars('#xpChart',entries,{format,note:'Each bar shows the same observed gain as the player ranking. Missing history is excluded.'});
 else C.drawLine('#xpChart',rows.map(row=>({name:U.player(row.key).name,color:U.player(row.key).color,data:row.gain===null?[]:row.points})),{format,gainMode:true,bars:entries,domain});
 $('#progressChartNote').textContent=view==='timeline'?'Each line starts at the player’s first valid observation in the window. Points are saved counters; lines connect observations across gaps. Tap or use arrow keys on the graph to inspect gains.':'Players are ranked by the observed gain in the selected window. Zero means a confirmed unchanged counter; — means insufficient history.';
 const goalKind=kind()==='xp'?'xp':kind(),goal=$('#progressGoal');goal.hidden=!['xp','level','boss'].includes(goalKind);
 if(!goal.hidden){const params=new URLSearchParams({kind:goalKind,metric:metricKey()});if(selected.size===1)params.set('player',keys()[0]);goal.href='goals.html?'+params+'#new-goal'}
 const records=$('#progressRecords'),params=new URLSearchParams({type:['ehp','ehb'].includes(type)?'total-xp':type,period:days});
 if(['skill-xp','skill-level','boss'].includes(type))params.set('metric',metric);
 if(selected.size!==U.ALL_KEYS.length)params.set('members',keys().join(','));records.href='time-records.html?'+params;
 highlights();matrix();
 const coverage=$('#progressCoverage');coverage.innerHTML='<thead><tr><th scope="col">Player</th><th scope="col">Observed from</th><th scope="col">Observed to</th><th scope="col">Points</th><th scope="col">Largest gap</th></tr></thead><tbody>'+rows.map(row=>`<tr><th scope="row">${esc(U.player(row.key).name)}</th><td>${date(row.start)}</td><td>${date(row.end)}</td><td>${row.points.length}</td><td>${row.gain===null?'—':span(row.maxGap)}</td></tr>`).join('')+'</tbody>';
 searchMetrics();
 if(windowFocus)$(`${periodHost} [data-progress-window="${windowFocus}"]`)?.focus({preventScroll:true});
}
function choose(id){
 const [family,key]=id.split(':');metric=key;
 type=family==='computed'?key:family==='boss'?'boss':family==='level'?(key==='overall'?'total-level':'skill-level'):key==='overall'?'total-xp':'skill-xp';
 options();render();writeURL();
 $(`[data-progress-metric="${esc(id)}"]`)?.focus({preventScroll:true});
}
async function load(){
 const current=++revision,doc=await U.loadWom();if(current!==revision)return false;
 model=M.build(doc,U.ALL_KEYS);return true;
}
async function init(){
 try{
  if(!await load())return;readURL();render();
  $('#progressType').onchange=()=>{type=$('#progressType').value;$('#progressSearch').value='';options();render();writeURL()};
  $('#progressMetric').onchange=()=>{metric=$('#progressMetric').value;render();writeURL()};
  $('#progressSearch').oninput=searchMetrics;
  $('#progressAll').onclick=()=>{selected=new Set(U.ALL_KEYS);U.saveMemberSelection(selected);render();writeURL()};
  document.addEventListener('click',event=>{
   const choice=event.target.closest('[data-progress-metric]');if(choice){choose(choice.dataset.progressMetric);return}
   const period=event.target.closest('[data-progress-window]');if(period){days=Number(period.dataset.progressWindow);render();writeURL();return}
   const graph=event.target.closest('[data-progress-view]');if(graph){view=graph.dataset.progressView;render();writeURL();return}
   const sort=event.target.closest('[data-progress-sort]');if(sort){sortKey=sort.dataset.progressSort===sortKey?'':sort.dataset.progressSort;matrix();$(`[data-progress-sort="${esc(sort.dataset.progressSort)}"]`)?.focus({preventScroll:true})}
  });
  if(location.hash==='#current-stats-total-level'){type='total-level';options();render();$('#progressTable').open=true}
 }catch(error){$('#progressStatus').textContent='Saved WOM history could not load. Reload to try again.';console.error(error)}
}
window.addEventListener('ug:members-changed',event=>{const next=U.cleanSelection(event.detail?.keys);if(U.sameSelection(next,selected))return;selected=next;render();if(model)writeURL()});
window.addEventListener('ug:data-updated',event=>{if(event.detail?.key!==U.WKEY)return;load().then(changed=>{if(changed){options();render()}}).catch(error=>{console.error(error);$('#progressStatus').textContent='The updated history could not load. Previous gains are still shown.'})});
window.addEventListener('popstate',()=>{if(model){readURL();render()}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
