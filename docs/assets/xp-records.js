(()=>{
'use strict';
const U=window.UGV21,M=window.UGXPRecords;if(!U||!M||document.body.dataset.page!=='time-records')return;
const {$,$$,fmt,escapeHtml:esc}=U,TYPES=['skill-xp','skill-level','boss'];
let model=null,selected=U.loadMemberSelection(),type='skill-xp',metric='overall',days=7,evidenceKey='',loadRevision=0;
const keys=()=>U.ALL_KEYS.filter(k=>selected.has(k));
const date=t=>t===null?'—':new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const stamp=t=>new Date(t).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC';
const duration=t=>t<M.DAY?(t/3600000).toLocaleString('en-GB',{maximumFractionDigits:1})+' hours':(t/M.DAY).toLocaleString('en-GB',{maximumFractionDigits:2})+' days';
const nice=k=>({runecrafting:'Runecraft',kreearra:'Kree’arra',kril_tsutsaroth:'K’ril Tsutsaroth',vetion:'Vet’ion',phosanis_nightmare:'Phosani’s Nightmare'}[k]||U.nice(k));
const unit=()=>type==='boss'?'KC':type==='skill-level'?'levels':'XP';
const metricId=()=>(type==='boss'?'boss:':type==='skill-level'?'level:':'xp:')+metric;
const metricName=k=>k==='overall'?(type==='skill-level'?'Total level':'Total XP'):nice(k);
const label=()=>metric==='overall'?metricName(metric):nice(metric)+(type==='boss'?' KC':type==='skill-level'?' levels':' XP');
const rankLabel=row=>!row.record?'—':row.rankRange.best===row.rankRange.worst?'#'+row.rankRange.best:'#'+row.rankRange.best+'–'+row.rankRange.worst;
function searchMetrics(){
 const query=$('#recordsSearch').value.trim().toLowerCase(),list=type==='boss'?model.metrics.bosses:['overall',...model.metrics.skills];
 const matches=list.filter(k=>(metricName(k)+' '+k+(k.startsWith('chambers_of_xeric')?' cox':k.startsWith('tombs_of_amascut')?' toa':k.startsWith('theatre_of_blood')?' tob':'')).toLowerCase().includes(query));
 $('#recordsMetrics').innerHTML=matches.map(k=>`<button type="button" class="records-metric-card" data-record-metric="${esc(k)}" aria-pressed="${metric===k}"><span class="records-metric-icon" aria-hidden="true"></span><span>${esc(metricName(k))}</span><span class="records-card-check" aria-hidden="true">✓</span></button>`).join('');
 for(const button of $$('[data-record-metric]')){
  const host=$('.records-metric-icon',button),k=button.dataset.recordMetric;
  if(type==='boss'){
   const icon=window.UGBossIcons?.icon(k);
   if(icon){for(const img of icon.querySelectorAll('img'))img.alt='';host.append(icon)}
   else host.innerHTML='<img src="img/osrs-theme/menu-icons/kc-comparison.svg" alt="">';
  }else host.innerHTML=k==='overall'?'<img src="img/ui/skills.png" alt="">':U.skillIcon(k);
 }
 $('#recordsSearchStatus').textContent=matches.length?matches.length+' '+(type==='boss'?'bosses':'stats')+' · Selected: '+metricName(metric):'No matching '+(type==='boss'?'bosses':'skills')+'. Try another name.';
}
function options(){
 const list=type==='boss'?model.metrics.bosses:['overall',...model.metrics.skills];
 if(!list.includes(metric))metric=type==='boss'&&list.includes('chambers_of_xeric')?'chambers_of_xeric':list[0]||'';
 $$('[data-record-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.recordType===type)));
 $('#recordsSearchLabel').textContent=type==='boss'?'Find a boss':'Find a skill or total';
 $('#recordsMetricHeading').textContent=type==='boss'?'Choose a boss':'Choose a stat';
 searchMetrics();
}
function readURL(){
 const params=new URL(location.href).searchParams,requested=params.get('type');
 type=requested==='total-level'?'skill-level':TYPES.includes(requested)?requested:'skill-xp';
 days=M.PERIODS.some(p=>p.days===Number(params.get('period')))?Number(params.get('period')):7;
 metric=['total-xp','total-level'].includes(requested)?'overall':params.get('metric')||(type==='boss'?'chambers_of_xeric':'overall');
 const members=params.get('members')?.split(',').filter(k=>U.ALL_KEYS.includes(k));
 if(members?.length)selected=new Set(members);
 evidenceKey=U.ALL_KEYS.includes(params.get('player'))?params.get('player'):'';
 options();
}
function writeURL(){
 const url=new URL(location.href);
 for(const key of ['type','metric','period','members','player'])url.searchParams.delete(key);
 url.searchParams.set('type',type);url.searchParams.set('metric',metric);
 if(days!==7)url.searchParams.set('period',days);
 if(selected.size!==U.ALL_KEYS.length)url.searchParams.set('members',keys().join(','));
 if(evidenceKey)url.searchParams.set('player',evidenceKey);
 history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
function picker(){
 U.renderMemberPicker('#recordsMembers',selected,next=>{selected=next;evidenceKey='';U.saveMemberSelection(next);render();writeURL()},{title:'Players to compare',subtitle:'Compare the records proved by their saved history.'});
 $('#recordsAll').hidden=selected.size===U.ALL_KEYS.length;
}
function evidence(rows){
 const row=rows.find(r=>r.key===evidenceKey&&r.record)||rows.find(r=>r.record),host=$('#recordsEvidence');
 if(!row){host.hidden=true;host.innerHTML='';return}
 host.hidden=false;const p=U.player(row.key),r=row.record,proof=r.proof,observed=row.observedRecord;
 const reasoning=r.inferred?`<p class="records-proof"><b>+${fmt(proof.gain)} ${unit()}</b> in ${duration(proof.span)} fits into ${proof.parts} runs of at most ${days} days. At least one must have gained <b>${fmt(r.gain)} ${unit()}</b> or more (${fmt(proof.gain)} ÷ ${proof.parts}, rounded up). The exact dates of that run were not saved.</p>`:`<p>These endpoints prove <b>+${fmt(r.gain)} ${unit()}</b> within ${days} days. Gaps may contain a higher record.</p>`;
 host.innerHTML=`<div class="records-evidence-head"><span class="records-player-mark" style="--pc:${p.color}">${esc(p.name)}</span><strong>${esc(label())} · at least +${fmt(r.gain)} ${unit()}</strong></div><h4>${r.inferred?'Proof from a longer interval':'Observed supporting run'}</h4><div class="records-endpoints"><div><span>Starting observation</span><b>${fmt(proof.startValue)} ${unit()}</b><time datetime="${new Date(proof.start).toISOString()}">${stamp(proof.start)}</time></div><span class="records-arrow" aria-hidden="true">→</span><div><span>Ending observation</span><b>${fmt(proof.endValue)} ${unit()}</b><time datetime="${new Date(proof.end).toISOString()}">${stamp(proof.end)}</time></div></div>${reasoning}<p>${proof.observations} valid observations · largest gap ${duration(proof.maxGap)}.</p>${r.inferred&&observed?`<p class="section-note">Largest directly observed run within ${days} days: +${fmt(observed.gain)} ${unit()} (${date(observed.start)} → ${date(observed.end)}). The longer interval proves a higher minimum.</p>`:''}<p class="section-note">Possible record in the saved history: <b>${fmt(r.gain)}–${r.upperBound===null?'unknown':fmt(r.upperBound)} ${unit()}</b>. Possible rank among players with observations: ${rankLabel(row)}. Dates outside the saved history are unknown.${row.coverage.corrections?' Decreasing counters start separate segments; the gain across a correction is unknown.':''}</p>`;
}
function comparison(){
 const all=new Map(M.PERIODS.map(p=>[p.days,model.records(metricId(),p.days,keys())]));
 $('#recordsComparison').innerHTML='<caption class="sr-only">'+esc(label())+' proven minimum records and possible player ranks for every window</caption><thead><tr><th scope="col">Player</th>'+M.PERIODS.map(p=>`<th scope="col" ${days===p.days?'class="records-selected-window"':''}>${p.label}${p.days>=30?`<small>${p.days} days</small>`:''}</th>`).join('')+'</tr></thead><tbody>'+keys().map(key=>{
  const p=U.player(key);return `<tr><th scope="row"><span class="records-player-mark" style="--pc:${p.color}">${esc(p.name)}</span></th>`+M.PERIODS.map(period=>{
   const row=all.get(period.days).find(r=>r.key===key),r=row.record;
   return `<td ${days===period.days?'class="records-selected-window"':''}>${r?`<button type="button" data-record-player="${esc(key)}" data-record-period="${period.days}" aria-label="${esc(p.name+', '+period.label+', at least '+fmt(r.gain)+' '+unit()+'. View evidence.')}" title="${r.inferred?'Minimum proved by a longer interval; exact run dates unknown':esc(stamp(r.start)+' → '+stamp(r.end))}"><b>≥ ${fmt(r.gain)}</b><small>${unit()} · ${rankLabel(row)}</small></button>`:'<span class="records-unknown">—<small>Insufficient history</small></span>'}</td>`;
  }).join('')+'</tr>';
 }).join('')+'</tbody>';
 $$('[data-record-period]',$('#recordsComparison')).forEach(button=>button.onclick=()=>{days=Number(button.dataset.recordPeriod);evidenceKey=button.dataset.recordPlayer;render();writeURL();$('#recordsEvidence').scrollIntoView?.({block:'nearest',behavior:'smooth'})});
}
function render(){
 if(!model)return;
 const active=document.activeElement;
 const attr=['recordWindow','recordInspect','recordType','recordMetric'].find(key=>active?.dataset[key]);
 const focus=attr?`[data-${attr.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}="${active.dataset[attr]}"]`:active?.dataset.recordPeriod?`[data-record-period="${active.dataset.recordPeriod}"][data-record-player="${active.dataset.recordPlayer}"]`:'';
 const rows=model.records(metricId(),days,keys()),known=rows.filter(r=>r.record),top=known[0]?.record.gain||0,period=M.PERIODS.find(p=>p.days===days);
 if(evidenceKey&&!known.some(r=>r.key===evidenceKey))evidenceKey='';
 picker();
 $$('[data-record-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.recordType===type)));
 $$('[data-record-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.recordMetric===metric)));
 $('#recordsSearchStatus').textContent=$$('[data-record-metric]').length?$$('[data-record-metric]').length+' '+(type==='boss'?'bosses':'stats')+' · Selected: '+metricName(metric):'No matches. Selected: '+metricName(metric);
 $('#recordsPeriods').innerHTML=M.PERIODS.map(p=>`<button type="button" data-record-window="${p.days}" aria-pressed="${p.days===days}">${p.label}${p.days>=30?`<small>${p.days} days</small>`:''}</button>`).join('');
 $$('[data-record-window]').forEach(button=>button.onclick=()=>{days=Number(button.dataset.recordWindow);evidenceKey='';render();writeURL()});
 $('#recordsHeading').textContent=label()+' · '+period.label;
 $('#recordsSubtitle').textContent='At least this much was gained in a run of '+days+' days or less. ≥ means a proven minimum.';
 $('#recordsStatus').textContent=known.length+' of '+keys().length+' players have usable history. Sorted by proven minimum; rank ranges reflect gaps in observations.';
 $('#recordsLeaderboard').innerHTML=rows.map(row=>{
  const p=U.player(row.key),r=row.record,width=r&&top?100*r.gain/top:0;
  return `<div class="records-row ${row.rank===1?'records-leader':''}" data-record-rank="${row.rank??''}" data-record-key="${esc(p.key)}" style="--pc:${p.color}"><span class="records-rank" aria-label="Possible rank ${rankLabel(row)}">${rankLabel(row)}</span><div class="records-run"><strong>${esc(p.name)}</strong><span class="records-run-note">${!r?'Insufficient saved history':r.inferred?'Proved from a longer interval · exact run dates unknown':date(r.start)+' → '+date(r.end)+' · '+duration(r.span)}</span><span class="records-bar" aria-hidden="true"><i style="width:${width}%"></i></span></div><div class="records-gain"><small>At least</small><b>${r?'+'+fmt(r.gain):'—'}</b><span>${unit()}</span></div><button class="records-inspect" type="button" data-record-inspect="${esc(p.key)}" ${r?'':'disabled'} aria-label="${esc('View '+p.name+' record evidence')}" aria-pressed="${!!r&&(evidenceKey?evidenceKey===p.key:known[0]?.key===p.key)}">Evidence <span aria-hidden="true">↗</span></button></div>`;
 }).join('');
 $$('[data-record-inspect]').forEach(button=>button.onclick=()=>{evidenceKey=button.dataset.recordInspect;render();writeURL()});
 evidence(rows);comparison();
 $('#recordsCoverage').innerHTML='<caption>Saved history for '+esc(label())+'</caption><thead><tr><th scope="col">Player</th><th scope="col">First observation</th><th scope="col">Latest</th><th scope="col">Valid observations</th><th scope="col">Corrections</th></tr></thead><tbody>'+rows.map(row=>`<tr><th scope="row">${esc(U.player(row.key).name)}</th><td>${date(row.coverage.start)}</td><td>${date(row.coverage.end)}</td><td>${fmt(row.coverage.count)}</td><td>${fmt(row.coverage.corrections)}</td></tr>`).join('')+'</tbody>';
 if(focus)$(focus)?.focus({preventScroll:true});
}
async function load(){
 const revision=++loadRevision,doc=await U.loadWom();if(revision!==loadRevision)return;
 const previous=model?.metrics;model=M.build(doc,U.ALL_KEYS);
 for(const family of ['skills','bosses'])model.metrics[family]=[...new Set([...(previous?.[family]||[]),...model.metrics[family]])].sort();
 options();render();
}
async function init(){
 try{
  await load();readURL();render();
  $('#recordsSearch').oninput=searchMetrics;
  document.addEventListener('click',event=>{
   const choice=event.target.closest('[data-record-type]');
   if(choice){type=choice.dataset.recordType;evidenceKey='';$('#recordsSearch').value='';options();render();writeURL();return}
   const card=event.target.closest('[data-record-metric]');
   if(card){metric=card.dataset.recordMetric;evidenceKey='';render();writeURL()}
  });
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
