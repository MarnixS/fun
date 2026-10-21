(()=>{
'use strict';
const U=window.UGV21,C=window.UGV21Charts,M=window.UGStatProgress;
if(!U||!C||!M||document.body.dataset.page!=='progress')return;
const {$,$$,escapeHtml:esc,fmt}=U;
let model=null,selected=U.loadMemberSelection(),family='xp',metric='',days=7,view='timeline',mode='recent',sort='gain',includeUnchanged=false,revision=0,knownSkills=[],knownBosses=[];
const keys=()=>U.ALL_KEYS.filter(key=>selected.has(key));
const compare=key=>model.compare(family,key,days,keys(),mode);
const nice=key=>({runecrafting:'Runecraft',kree_arra:'Kree’arra',kril_tsutsaroth:'K’ril Tsutsaroth',vetion:'Vet’ion'}[key]||U.nice(key));
const unit=()=>({xp:'XP',level:'levels',boss:'KC',computed:'hours'})[family];
const number=value=>family==='computed'?U.fmt1(value):fmt(value);
const metricName=key=>key==='overall'?(family==='level'?'Total level':'All skills'):family==='computed'?key.toUpperCase():nice(key);
const label=()=>metricName(metric)+(family==='xp'?' XP':family==='level'&&metric!=='overall'?' levels':family==='boss'?' KC':'');
const date=time=>time===null?'—':new Date(time).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const stamp=time=>new Date(time).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC';
const span=time=>time<M.DAY?(time/3600000).toLocaleString('en-GB',{maximumFractionDigits:1})+'h':(time/M.DAY).toLocaleString('en-GB',{maximumFractionDigits:1})+' days';
const catalogue=()=>family==='boss'?knownBosses:family==='computed'?['ehp','ehb']:['overall',...knownSkills];
const icon=key=>['xp','level'].includes(family)?key==='overall'?'<img class="skill-icon" src="img/ui/skills.png" alt="">':U.skillIcon(key):'';
function options(){
 const list=catalogue(),noun=family==='boss'?'boss':family==='computed'?'measure':'skill';
 if(metric&&!list.includes(metric))metric='';
 $('#progressType').value=family;
 $('#progressMetricCaption').textContent=nice(noun);
 $('#progressMetric').innerHTML=`<option value="">Choose a ${noun}…</option>`+list.map(key=>`<option value="${esc(key)}">${esc(key==='overall'?(family==='xp'?'All skills (total XP)':'All skills (total level)'):metricName(key))}</option>`).join('');
 $('#progressMetric').value=metric;
 $('#progressSkillHelp').textContent=family==='xp'?'Select an individual skill, or all skills for combined XP gains.':family==='level'?'Compare levels gained in one skill, or total levels gained.':family==='boss'?'Compare kills gained for one boss in the selected period.':'Compare EHP or EHB hours gained in the selected period.';
 $('#progressMetricPicker').hidden=family==='computed';
 $('#progressBrowseLabel').textContent='Search '+(family==='boss'?'bosses':'skills');
 $('#progressSearchCaption').textContent='Find a '+noun;
 searchMetrics();
}
function searchMetrics(){
 const query=$('#progressSearch').value.trim().toLowerCase();
 const matches=catalogue().filter(key=>{
  const aliases=key.startsWith('chambers_of_xeric')?' cox':key.startsWith('tombs_of_amascut')?' toa':key.startsWith('theatre_of_blood')?' tob':'';
  return (metricName(key)+' '+key+aliases).toLowerCase().includes(query);
 });
 $('#progressMetrics').innerHTML=matches.length?matches.map(key=>`<button type="button" data-progress-metric="${esc(key)}" aria-pressed="${key===metric}">${icon(key)}<span>${esc(metricName(key))}</span></button>`).join(''):'<p class="section-note" role="status">No matching metrics.</p>';
}
function readURL(){
 const params=new URL(location.href).searchParams,type=params.get('type'),legacy=params.get('kind');
 family=type==='boss'||legacy==='boss'?'boss':['skill-level','total-level'].includes(type)||legacy==='level'?'level':['ehp','ehb'].includes(type)||legacy==='computed'?'computed':'xp';
 metric=params.get('metric')||(['total-xp','total-level'].includes(type)?'overall':['ehp','ehb'].includes(type)?type:params.has('period')&&!type&&!legacy||location.hash==='#gainCards'?'overall':'');
 days=M.PERIODS.some(period=>period.days===Number(params.get('period')))?Number(params.get('period')):7;
 view=['bars','share'].includes(params.get('view'))?params.get('view'):'timeline';
 mode=params.get('mode')==='records'?'records':'recent';
 const members=params.get('members')?.split(',').filter(key=>U.ALL_KEYS.includes(key)),owner=params.get('player');
 if(members?.length)selected=new Set(members);else if(U.ALL_KEYS.includes(owner))selected=new Set([owner]);
 options();
}
function writeURL(){
 const url=new URL(location.href);
 for(const key of ['type','metric','period','view','mode','members','kind','player'])url.searchParams.delete(key);
 if(metric){
  const type=family==='xp'?(metric==='overall'?'total-xp':'skill-xp'):family==='level'?(metric==='overall'?'total-level':'skill-level'):family==='computed'?metric:'boss';
  url.searchParams.set('type',type);
  if(!['overall','ehp','ehb'].includes(metric))url.searchParams.set('metric',metric);
 }else url.searchParams.set('kind',family==='xp'?'skill':family);
 if(days!==7)url.searchParams.set('period',days);
 if(view!=='timeline')url.searchParams.set('view',view);
 if(mode==='records')url.searchParams.set('mode',mode);
 if(selected.size!==U.ALL_KEYS.length)url.searchParams.set('members',keys().join(','));
 history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
function picker(){
 U.renderMemberPicker('#statsMemberPicker',selected,next=>{selected=next;U.saveMemberSelection(next);render();writeURL()},{title:'Players',subtitle:'These players are compared in every result below.',compact:true});
 $('#progressAll').hidden=selected.size===U.ALL_KEYS.length;
}
function gainList(){
 const all=catalogue().map(key=>{
  const known=compare(key).rows.filter(row=>row.gain!==null);
  return {key,gain:known.length?known.reduce((sum,row)=>sum+row.gain,0):null};
 }).filter(row=>includeUnchanged||row.gain>0);
 all.sort((a,b)=>sort==='name'?metricName(a.key).localeCompare(metricName(b.key)):(b.gain??-Infinity)-(a.gain??-Infinity)||metricName(a.key).localeCompare(metricName(b.key)));
 $('#progressTableLabel').textContent=family==='boss'?'Gains across bosses':family==='computed'?'Efficiency gains':'Gains across all skills';
 $('#progressTableNote').textContent=mode==='records'?'Sum of each player’s best observed '+days+'-day run for each metric. Record dates can differ. Choose a row to compare.':'Combined '+unit()+' gained by the selected players in the latest '+days+' days. Choose a row to compare that metric.';
 $('#skillGainTable').innerHTML='<colgroup><col><col class="progress-value-col"></colgroup><thead><tr><th scope="col">'+(family==='boss'?'Boss':family==='computed'?'Measure':'Skill')+'</th><th scope="col">'+unit()+' gained</th></tr></thead><tbody>'+all.map(row=>`<tr class="${row.key===metric?'progress-selected-metric':''}"><th scope="row"><button type="button" class="metric-link" data-progress-metric="${esc(row.key)}" aria-pressed="${row.key===metric}">${icon(row.key)}<span>${esc(metricName(row.key))}</span></button></th><td class="${row.gain>0?'progress-positive':''}">${row.gain===null?'—':'+'+number(row.gain)}</td></tr>`).join('')+(all.length?'':'<tr><td colspan="2" class="progress-no-gains">No confirmed positive gains in this period. Include unchanged or unknown metrics to see every row.</td></tr>')+'</tbody>';
}
function periods(){
 const buttons=M.PERIODS.map(period=>`<button type="button" data-progress-window="${period.days}" aria-pressed="${period.days===days}" aria-controls="xpChart gainCards skillGainTable">${period.label}</button>`).join('');
 $('#progressPeriods').innerHTML=buttons;$('#progressGraphPeriods').innerHTML=buttons;
}
function render(){
 if(!model)return;
 const focus=document.activeElement,windowFocus=focus?.dataset.progressWindow,periodHost=focus?.closest('#progressGraphPeriods')?'#progressGraphPeriods':'#progressPeriods';
 picker();periods();
 $$('[data-progress-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.progressMode===mode)));
 $('#progressModeNote').textContent=mode==='records'?'Personal bests: the largest observed gain anywhere in the saved history, within the selected time limit.':'Latest period: gains leading up to the latest group update. Switch to Personal bests to find historical records.';
 $('#progressResults').hidden=!metric;$('#progressSupplement').hidden=!metric;$('#progressEmpty').hidden=!!metric;
 searchMetrics();
 if(!metric){$('#progressStatus').textContent='Choose what to compare above. Results will use the selected players and period.';$('#gainCards').innerHTML='';$('#skillGainTable').innerHTML='';$('#xpChart').innerHTML='';return}
 const {domain,rows}=compare(metric),known=rows.filter(row=>row.gain!==null),total=known.reduce((sum,row)=>sum+row.gain,0),period=M.PERIODS.find(item=>item.days===days),records=mode==='records';
 $('#progressHeading').innerHTML=icon(metric)+`<span>${esc(label())} gained · ${records?'personal bests within':'latest'} ${period.label}</span>`;
 $('#progressRange').textContent=records?'Best runs across all saved dates. Each player’s record dates appear below.':domain?date(domain.start)+' → '+date(domain.end):'No saved observations.';
 $('#progressTotal').textContent=known.length?'+'+number(total)+' '+unit():'—';
 $('#progressTotalNote').textContent=known.length?(records?'sum of personal bests · dates vary':'combined recent gain')+' · '+known.length+' of '+rows.length+' players with observations':'Insufficient history for this comparison';
 $('#progressStatus').textContent=records?'Showing '+period.label+' personal bests from the full saved history.':'Showing '+label()+' gained in the latest '+period.label+'; these are recent gains.';
 $('#gainCards').innerHTML='<colgroup><col class="progress-rank-col"><col><col class="progress-value-col"></colgroup><thead><tr><th scope="col" aria-label="Rank">#</th><th scope="col">Player</th><th scope="col">'+unit()+' gained</th></tr></thead><tbody>'+rows.map(row=>{
  const player=U.player(row.key);
  return `<tr data-progress-player="${esc(row.key)}" data-progress-rank="${row.rank??''}" style="--pc:${player.color}"><td class="progress-rank">${row.rank??'—'}</td><th scope="row"><span class="progress-player-name">${esc(player.name)}</span><span class="progress-observed" title="${row.gain===null?'':esc(stamp(row.start)+' → '+stamp(row.end))}">${row.gain===null?'Insufficient history':date(row.start)+' → '+date(row.end)+(row.corrections?' · after correction':'')}</span></th><td class="records-gain ${row.gain>0?'progress-positive':''}"><b>${row.gain===null?'—':'+'+number(row.gain)}</b></td></tr>`;
 }).join('')+'</tbody>';
 $('#progressChartTitle').textContent=label()+(records?' · best runs':' · recent gains');
 $('#progressAxis').textContent=view==='share'?'Share of '+unit()+' gained':unit()+' gained · zero baseline';
 $$('[data-progress-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.progressView===view)));
 const entries=rows.map(row=>({name:U.player(row.key).name,color:U.player(row.key).color,value:row.gain})),format=family==='computed'?'hours':'compact';
 if(!known.length)$('#xpChart').innerHTML='<div class="chart-empty" role="status">At least two valid observations in this period are needed to measure gains. Try a longer period.</div>';
 else if(view==='bars')C.drawBars('#xpChart',entries,{format,note:'Observed gains for the selected players.'});
 else if(view==='share')C.drawPie('#xpChart',entries,{format,note:'Share of the selected players’ '+unit()+' gained in this period.'});
 else C.drawLine('#xpChart',rows.map(row=>({name:U.player(row.key).name,color:U.player(row.key).color,data:row.gain===null?[]:row.points})),{format,gainMode:true,bars:entries,domain});
 $('#progressChartNote').textContent=(records?'Each player’s best run can fall on different dates. ':'')+(view==='timeline'?'Tap the graph or use arrow keys to inspect gains at saved dates. Each line starts at zero at that player’s first displayed observation.':view==='share'?'Only positive gains contribute to the share.':'The bars and player comparison show the same gains.');
 const goal=$('#progressGoal');goal.hidden=family==='computed';
 if(!goal.hidden){const params=new URLSearchParams({kind:family,metric});if(selected.size===1)params.set('player',keys()[0]);goal.href='goals.html?'+params+'#new-goal'}
 const type=family==='xp'?(metric==='overall'?'total-xp':'skill-xp'):family==='level'?(metric==='overall'?'total-level':'skill-level'):'boss';
 const params=new URLSearchParams({type:family==='computed'?'total-xp':type,period:days});
 if(!['overall','ehp','ehb'].includes(metric))params.set('metric',metric);
 if(selected.size!==U.ALL_KEYS.length)params.set('members',keys().join(','));$('#progressRecords').href='time-records.html?'+params;$('#progressRecords').hidden=family==='computed';
 gainList();
 $('#progressCoverage').innerHTML=rows.map(row=>`<li><b>${esc(U.player(row.key).name)}</b><span>${date(row.start)} → ${date(row.end)} · ${row.points.length} observations${row.gain===null?'':' · largest gap '+span(row.maxGap)}</span></li>`).join('');
 if(windowFocus)$(`${periodHost} [data-progress-window="${windowFocus}"]`)?.focus({preventScroll:true});
}
function choose(key){
 if(!catalogue().includes(key))return;
 metric=key;$('#progressMetric').value=key;render();writeURL();
 if($('#progressMetricPicker').open)$(`#progressMetrics [data-progress-metric="${esc(key)}"]`)?.focus({preventScroll:true});else $('#progressMetric').focus({preventScroll:true});
}
async function load(){
 const current=++revision,doc=await U.loadWom();if(current!==revision)return false;
 model=M.build(doc,U.ALL_KEYS);
 knownSkills=[...new Set([...knownSkills,...model.metrics.skills])].sort();knownBosses=[...new Set([...knownBosses,...model.metrics.bosses])].sort();return true;
}
async function init(){
 try{
  if(!await load())return;readURL();render();document.body.dataset.progressReady='true';
  $('#progressType').onchange=()=>{family=$('#progressType').value;metric='';$('#progressSearch').value='';options();render();writeURL()};
  $('#progressMetric').onchange=()=>{metric=$('#progressMetric').value;render();writeURL()};
  $('#progressSearch').oninput=searchMetrics;
  $('#progressSort').onchange=()=>{sort=$('#progressSort').value;gainList()};
  $('#progressUnchanged').onchange=()=>{includeUnchanged=$('#progressUnchanged').checked;gainList()};
  $('#progressAll').onclick=()=>{selected=new Set(U.ALL_KEYS);U.saveMemberSelection(selected);render();writeURL()};
  document.addEventListener('click',event=>{
   const comparison=event.target.closest('[data-progress-mode]');if(comparison){mode=comparison.dataset.progressMode;render();writeURL();return}
   const choice=event.target.closest('[data-progress-metric]');if(choice){choose(choice.dataset.progressMetric);return}
   const period=event.target.closest('[data-progress-window]');if(period){days=Number(period.dataset.progressWindow);render();writeURL();return}
   const graph=event.target.closest('[data-progress-view]');if(graph){view=graph.dataset.progressView;render();writeURL()}
  });
 }catch(error){$('#progressStatus').textContent='Saved history could not load. Reload to try again.';console.error(error)}
}
window.addEventListener('ug:members-changed',event=>{const next=U.cleanSelection(event.detail?.keys);if(U.sameSelection(next,selected))return;selected=next;render();if(model)writeURL()});
window.addEventListener('ug:data-updated',event=>{
 if(event.detail?.key!==U.WKEY)return;
 const update=load().then(changed=>{if(changed){options();render()}});
 event.detail.waitUntil?.(update);
 update.catch(error=>{console.error(error);$('#progressStatus').textContent='The updated history could not load. Previous gains are still shown.'});
});
window.addEventListener('popstate',()=>{if(model){readURL();render()}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
