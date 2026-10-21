(()=>{
'use strict';
const U=window.UGV21,M=window.UGXPRecords;if(!U||!M||document.body.dataset.page!=='time-records')return;
const {$,$$,fmt,escapeHtml:esc}=U,TYPES=['total-xp','skill-xp','skill-level','total-level','boss'];
let model=null,selected=U.loadMemberSelection(),type='total-xp',metric='',days=7,evidenceKey='',loadRevision=0;
const keys=()=>U.ALL_KEYS.filter(k=>selected.has(k));
const date=t=>t===null?'—':new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const stamp=t=>new Date(t).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC';
const duration=t=>t<M.DAY?(t/3600000).toLocaleString('en-GB',{maximumFractionDigits:1})+' hours':(t/M.DAY).toLocaleString('en-GB',{maximumFractionDigits:2})+' days';
const nice=k=>({runecrafting:'Runecraft',kree_arra:"Kree’arra",kril_tsutsaroth:"K’ril Tsutsaroth",vetion:"Vet’ion",phosanis_nightmare:"Phosani’s Nightmare"}[k]||U.nice(k));
const unit=()=>type==='boss'?'KC':type.endsWith('level')?'levels':'XP';
const metricId=()=>type==='total-xp'?'xp:overall':type==='total-level'?'level:overall':(type==='boss'?'boss:':type==='skill-level'?'level:':'xp:')+metric;
const label=()=>type==='total-xp'?'Total XP':type==='total-level'?'Total level':nice(metric)+(type==='boss'?' KC':type==='skill-level'?' levels':' XP');
function options(){
 const list=type==='boss'?model.metrics.bosses:model.metrics.skills,show=['boss','skill-xp','skill-level'].includes(type),host=$('#recordsMetricLabel');
 host.hidden=!show;host.firstChild.textContent=type==='boss'?'Boss':'Skill';
 if(!list.includes(metric))metric=type==='boss'&&list.includes('chambers_of_xeric')?'chambers_of_xeric':list[0]||'';
 $('#recordsMetric').innerHTML=list.map(k=>`<option value="${esc(k)}">${esc(nice(k))}</option>`).join('');
 $('#recordsMetric').value=metric;$('#recordsType').value=type;
}
function readURL(){
 const params=new URL(location.href).searchParams;
 type=TYPES.includes(params.get('type'))?params.get('type'):'total-xp';
 days=M.PERIODS.some(p=>p.days===Number(params.get('period')))?Number(params.get('period')):7;
 metric=params.get('metric')||'';
 const members=params.get('members')?.split(',').filter(k=>U.ALL_KEYS.includes(k));
 if(members?.length)selected=new Set(members);
 evidenceKey=U.ALL_KEYS.includes(params.get('player'))?params.get('player'):'';
 options();
}
function writeURL(){
 const url=new URL(location.href);
 for(const key of ['type','metric','period','members','player'])url.searchParams.delete(key);
 if(type!=='total-xp')url.searchParams.set('type',type);
 if(['boss','skill-xp','skill-level'].includes(type))url.searchParams.set('metric',metric);
 if(days!==7)url.searchParams.set('period',days);
 if(selected.size!==U.ALL_KEYS.length)url.searchParams.set('members',keys().join(','));
 if(evidenceKey)url.searchParams.set('player',evidenceKey);
 history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
function picker(){
 U.renderMemberPicker('#recordsMembers',selected,next=>{selected=next;evidenceKey='';U.saveMemberSelection(next);render();writeURL()},{title:'Players to compare',subtitle:'Rank the selected players by their best observed gains.'});
 $('#recordsAll').hidden=selected.size===U.ALL_KEYS.length;
}
function evidence(rows){
 const row=rows.find(r=>r.key===evidenceKey&&r.record)||rows.find(r=>r.record),host=$('#recordsEvidence');
 if(!row){host.hidden=true;host.innerHTML='';return}
 host.hidden=false;const p=U.player(row.key),r=row.record;
 host.innerHTML=`<div class="records-evidence-head"><span class="records-player-mark" style="--pc:${p.color}">${esc(p.name)}</span><strong>${esc(label())} · +${fmt(r.gain)} ${unit()}</strong></div><div class="records-endpoints"><div><span>Starting observation</span><b>${fmt(r.startValue)} ${unit()}</b><time datetime="${new Date(r.start).toISOString()}">${stamp(r.start)}</time></div><span class="records-arrow" aria-hidden="true">→</span><div><span>Ending observation</span><b>${fmt(r.endValue)} ${unit()}</b><time datetime="${new Date(r.end).toISOString()}">${stamp(r.end)}</time></div></div><p><b>${duration(r.span)}</b> observed within the ${days}-day limit · ${r.observations} valid observations · largest gap ${duration(r.maxGap)}.</p><p class="section-note">These endpoints confirm the gain in this run. Unsaved periods may contain a higher record.${row.coverage.corrections?' Decreasing counters elsewhere in this history were excluded.':''}</p>`;
}
function comparison(){
 const all=new Map(M.PERIODS.map(p=>[p.days,model.records(metricId(),p.days,keys())]));
 $('#recordsComparison').innerHTML='<caption class="sr-only">'+esc(label())+' records and player ranks for every window</caption><thead><tr><th scope="col">Player</th>'+M.PERIODS.map(p=>`<th scope="col" ${days===p.days?'class="records-selected-window"':''}>${p.label}${p.days>=30?`<small>${p.days} days</small>`:''}</th>`).join('')+'</tr></thead><tbody>'+keys().map(key=>{
  const p=U.player(key);return `<tr><th scope="row"><span class="records-player-mark" style="--pc:${p.color}">${esc(p.name)}</span></th>`+M.PERIODS.map(period=>{
   const row=all.get(period.days).find(r=>r.key===key),r=row.record;
   return `<td ${days===period.days?'class="records-selected-window"':''}>${r?`<button type="button" data-record-player="${esc(key)}" data-record-period="${period.days}" aria-label="${esc(p.name+', '+period.label+', '+fmt(r.gain)+' '+unit()+', rank '+row.rank+'. View observations.')}" title="${esc(stamp(r.start)+' → '+stamp(r.end))}"><b>${fmt(r.gain)}</b><small>${unit()} · #${row.rank}</small></button>`:'<span class="records-unknown">—<small>No comparable pair</small></span>'}</td>`;
  }).join('')+'</tr>';
 }).join('')+'</tbody>';
 $$('[data-record-period]',$('#recordsComparison')).forEach(button=>button.onclick=()=>{days=Number(button.dataset.recordPeriod);evidenceKey=button.dataset.recordPlayer;render();writeURL();$('#recordsEvidence').scrollIntoView?.({block:'nearest',behavior:'smooth'})});
}
function render(){
 if(!model)return;
 const active=document.activeElement;
 const focus=active?.dataset.recordWindow?`[data-record-window="${active.dataset.recordWindow}"]`:active?.dataset.recordInspect?`[data-record-inspect="${active.dataset.recordInspect}"]`:active?.dataset.recordPeriod?`[data-record-period="${active.dataset.recordPeriod}"][data-record-player="${active.dataset.recordPlayer}"]`:'';
 const rows=model.records(metricId(),days,keys()),known=rows.filter(r=>r.record),top=known[0]?.record.gain||0,period=M.PERIODS.find(p=>p.days===days);
 if(evidenceKey&&!known.some(r=>r.key===evidenceKey))evidenceKey='';
 picker();
 $('#recordsPeriods').innerHTML=M.PERIODS.map(p=>`<button type="button" data-record-window="${p.days}" aria-pressed="${p.days===days}">${p.label}${p.days>=30?`<small>${p.days} days</small>`:''}</button>`).join('');
 $$('[data-record-window]').forEach(button=>button.onclick=()=>{days=Number(button.dataset.recordWindow);evidenceKey='';render();writeURL()});
 $('#recordsHeading').textContent=label()+' · '+period.label;
 $('#recordsSubtitle').textContent='Personal bests anywhere in the saved history, within the same '+days+'-day limit.';
 $('#recordsStatus').textContent=known.length+' of '+keys().length+' players have comparable observations. Best observed gains; unsaved gaps may hide higher records.';
 $('#recordsLeaderboard').innerHTML=rows.map(row=>{
  const p=U.player(row.key),r=row.record,width=r&&top?100*r.gain/top:0;
  return `<div class="records-row ${row.rank===1?'records-leader':''}" data-record-rank="${row.rank??''}" data-record-key="${esc(p.key)}" style="--pc:${p.color}"><span class="records-rank" aria-label="${row.rank?'Rank '+row.rank:'Unranked'}">${row.rank===null?'—':'#'+row.rank}</span><div class="records-run"><strong>${esc(p.name)}</strong><span class="records-run-note">${r?date(r.start)+' → '+date(r.end)+' · '+duration(r.span):'No valid snapshot pair within '+days+' days'}</span><span class="records-bar" aria-hidden="true"><i style="width:${width}%"></i></span></div><div class="records-gain"><b>${r?'+'+fmt(r.gain):'—'}</b><span>${unit()}</span></div><button class="records-inspect" type="button" data-record-inspect="${esc(p.key)}" ${r?'':'disabled'} aria-label="${esc('View '+p.name+' record observations')}" aria-pressed="${!!r&&(evidenceKey?evidenceKey===p.key:known[0]?.key===p.key)}">Observations <span aria-hidden="true">↗</span></button></div>`;
 }).join('');
 $$('[data-record-inspect]').forEach(button=>button.onclick=()=>{evidenceKey=button.dataset.recordInspect;render();writeURL()});
 evidence(rows);comparison();
 $('#recordsCoverage').innerHTML='<caption>Saved history for '+esc(label())+'</caption><thead><tr><th scope="col">Player</th><th scope="col">First observation</th><th scope="col">Latest</th><th scope="col">Valid observations</th><th scope="col">Corrections</th></tr></thead><tbody>'+rows.map(row=>`<tr><th scope="row">${esc(U.player(row.key).name)}</th><td>${date(row.coverage.start)}</td><td>${date(row.coverage.end)}</td><td>${fmt(row.coverage.count)}</td><td>${fmt(row.coverage.corrections)}</td></tr>`).join('')+'</tbody>';
 if(focus)$(focus)?.focus({preventScroll:true});
}
async function load(){
 const revision=++loadRevision,doc=await U.loadWom();if(revision!==loadRevision)return;
 model=M.build(doc,U.ALL_KEYS);options();render();
}
async function init(){
 try{
  await load();readURL();picker();render();
  $('#recordsType').onchange=()=>{type=$('#recordsType').value;metric='';evidenceKey='';options();render();writeURL()};
  $('#recordsMetric').onchange=()=>{metric=$('#recordsMetric').value;evidenceKey='';render();writeURL()};
  $('#recordsAll').onclick=()=>{selected=new Set(U.ALL_KEYS);evidenceKey='';U.saveMemberSelection(selected);render();writeURL()};
 }catch(error){$('#recordsStatus').textContent='Saved WOM history could not load. Reload this page to retry.';$('#recordsLeaderboard').innerHTML='<div class="notice">Records are unavailable until the saved history loads.</div>';console.error(error)}
}
window.addEventListener('ug:members-changed',event=>{const next=U.cleanSelection(event.detail?.keys);if(U.sameSelection(next,selected))return;selected=next;evidenceKey='';render();writeURL()});
window.addEventListener('ug:data-updated',event=>{
 if(event.detail?.key!==U.WKEY)return;
 const update=load();event.detail.waitUntil?.(update);
 update.catch(error=>{console.error(error);$('#recordsStatus').textContent='The updated history could not load. The previous records are still shown.'});
});
window.addEventListener('popstate',()=>{if(model){readURL();render()}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
