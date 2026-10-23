(()=>{
'use strict';
const U=window.UGV21,C=window.UGV21Charts,M=window.UGStatProgress;
if(!U||!C||!M||document.body.dataset.page!=='progress')return;
const {$,$$,escapeHtml:esc,fmt}=U;
let model=null,selected=U.loadMemberSelection(),family='xp',metric='',days=7,view='timeline',sort='name',revision=0,knownSkills=[],knownBosses=[];
const keys=()=>U.ALL_KEYS.filter(key=>selected.has(key));
const compare=key=>model.compare(family,key,days,keys(),'recent');
const nice=key=>({runecrafting:'Runecraft',kreearra:'Kree’arra',kree_arra:'Kree’arra',kril_tsutsaroth:'K’ril Tsutsaroth',vetion:'Vet’ion',phosanis_nightmare:'Phosani’s Nightmare'}[key]||U.nice(key));
const unit=()=>({xp:'XP',level:'levels',boss:'KC',computed:'hours'})[family];
const number=value=>family==='computed'?U.fmt1(value):fmt(value);
const metricName=key=>key==='overall'?(family==='level'?'Total level':'Total XP'):family==='computed'?key.toUpperCase():nice(key);
const cardName=key=>({chambers_of_xeric:'Chambers of Xeric',chambers_of_xeric_challenge_mode:'CoX · Challenge',theatre_of_blood:'Theatre of Blood',theatre_of_blood_hard_mode:'ToB · Hard mode',tombs_of_amascut:'Tombs of Amascut',tombs_of_amascut_expert:'ToA · Expert'}[key]||metricName(key));
const label=()=>metric==='overall'?metricName(metric):metricName(metric)+(family==='xp'?' XP':family==='level'?' levels':family==='boss'?' KC':'');
const date=time=>time===null?'—':new Date(time).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const stamp=time=>new Date(time).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC';
const span=time=>time<M.DAY?(time/3600000).toLocaleString('en-GB',{maximumFractionDigits:1})+'h':(time/M.DAY).toLocaleString('en-GB',{maximumFractionDigits:1})+' days';
const catalogue=()=>family==='boss'?knownBosses:family==='computed'?['ehp','ehb']:['overall',...knownSkills];
const icon=key=>['xp','level'].includes(family)?key==='overall'?'<img class="skill-icon" src="img/ui/skills.png" alt="">':U.skillIcon(key):'';
function overview(){
 const list=catalogue();if(metric&&!list.includes(metric))metric='';
 $$('[data-progress-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.progressType===family)));
 $('#progressSearch').placeholder=family==='boss'?'Find a boss…':family==='computed'?'Find a measure…':'Find a skill…';
 const query=$('#progressSearch').value.trim().toLowerCase();
 const matches=list.filter(key=>{
  const aliases=key.startsWith('chambers_of_xeric')?' cox':key.startsWith('tombs_of_amascut')?' toa':key.startsWith('theatre_of_blood')?' tob':'';
  return (metricName(key)+' '+key+aliases).toLowerCase().includes(query);
 }).map(key=>{
  const rows=compare(key).rows,known=rows.filter(row=>row.gain!==null);
  return {key,gain:known.length?known.reduce((sum,row)=>sum+row.gain,0):null,known:known.length};
 });
 matches.sort((a,b)=>sort==='gain'?(b.gain??-Infinity)-(a.gain??-Infinity)||metricName(a.key).localeCompare(metricName(b.key)):(a.key==='overall'?-1:b.key==='overall'?1:metricName(a.key).localeCompare(metricName(b.key))));
 $('#progressGridHeading').textContent=(family==='boss'?'Bosses':family==='computed'?'Efficiency':'Skills')+' · '+matches.length+(query?' / '+list.length:'');
 $('#progressMetrics').innerHTML=matches.length?matches.map(row=>{
  const exact=row.gain===null?'Insufficient history':'+'+number(row.gain)+' '+unit(),compact=row.gain===null?'—':'+'+(family==='computed'?U.fmt1(row.gain):row.gain>=100000?new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(row.gain):number(row.gain));
  const detail=metricName(row.key)+': '+exact+'; '+row.known+' of '+selected.size+' players with observations. Compare players';
  return `<button type="button" class="progress-metric-card" data-progress-metric="${esc(row.key)}" data-gain="${row.gain??''}" aria-haspopup="dialog" aria-label="${esc(detail)}" title="${esc(detail)}"><span class="progress-metric-icon" aria-hidden="true">${icon(row.key)}</span><span class="progress-metric-name">${esc(cardName(row.key))}</span><b class="progress-metric-gain ${row.gain>0?'progress-positive':''}">${compact}</b></button>`;
 }).join(''):'<p class="progress-no-matches">No matching stats. Try another name.</p>';
 for(const button of $$('#progressMetrics [data-progress-metric]')){
  const host=$('.progress-metric-icon',button),key=button.dataset.progressMetric;
  if(family==='boss'){
   const image=window.UGBossIcons?.icon(key);if(image){image.querySelectorAll('img').forEach(img=>img.alt='');host.append(image)}
   else host.innerHTML='<img src="img/osrs-theme/menu-icons/kc-comparison.svg" alt="">';
  }else if(family==='computed')host.innerHTML='<img src="img/osrs-theme/menu-icons/stat-progress.svg" alt="">';
 }
 const period=M.PERIODS.find(item=>item.days===days);
 $('#progressStatus').textContent='Combined '+unit()+' gained · '+(days==='max'?'all saved history':'latest '+period.label)+' · '+(selected.size===5?'all five players':selected.size===1?U.player(keys()[0]).name:selected.size+' players')+'. Zero = no observed change; — = insufficient history.';
}
function readURL(){
 const params=new URL(location.href).searchParams,type=params.get('type'),legacy=params.get('kind');
 family=type==='boss'||legacy==='boss'?'boss':['skill-level','total-level'].includes(type)||legacy==='level'?'level':['ehp','ehb'].includes(type)||legacy==='computed'?'computed':'xp';
 metric=params.get('metric')||(['total-xp','total-level'].includes(type)?'overall':['ehp','ehb'].includes(type)?type:params.has('period')&&!type&&!legacy||location.hash==='#gainCards'?'overall':'');
 const period=params.get('period')==='max'?'max':Number(params.get('period'));
 days=M.PERIODS.some(item=>item.days===period)?period:7;
 view=['bars','share'].includes(params.get('view'))?params.get('view'):'timeline';
 const members=params.get('members')?.split(',').filter(key=>U.ALL_KEYS.includes(key)),owner=params.get('player');
 if(members?.length)selected=new Set(members);else if(U.ALL_KEYS.includes(owner))selected=new Set([owner]);
 if(metric&&!catalogue().includes(metric))metric='';
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
 if(selected.size!==U.ALL_KEYS.length)url.searchParams.set('members',keys().join(','));
 history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
function picker(){
 U.renderMemberPicker('#statsMemberPicker',selected,next=>{selected=next;U.saveMemberSelection(next);render();writeURL()},{title:'Players',subtitle:'These players are compared in every result below.',compact:true});
 $('#progressAll').hidden=selected.size===U.ALL_KEYS.length;
}
function periods(){
 const buttons=M.PERIODS.map(period=>`<button type="button" data-progress-window="${period.days}" aria-pressed="${period.days===days}" aria-controls="progressMetrics xpChart gainCards">${period.label}</button>`).join('');
 $('#progressPeriods').innerHTML=buttons;$('#progressGraphPeriods').innerHTML=buttons;
}
function render(){
 if(!model)return;
 const focus=document.activeElement,windowFocus=focus?.dataset.progressWindow,periodHost=focus?.closest('#progressGraphPeriods')?'#progressGraphPeriods':'#progressPeriods';
 const restorePeriod=()=>{if(windowFocus)$(`${periodHost} [data-progress-window="${windowFocus}"]`)?.focus({preventScroll:true})};
 picker();periods();overview();
 const dialog=$('#progressDetail');
 if(!metric){if(dialog.open)dialog.close();$('#gainCards').innerHTML='';$('#xpChart').innerHTML='';restorePeriod();return}
 if(!dialog.open)dialog.showModal();
 const {domain,rows}=compare(metric),known=rows.filter(row=>row.gain!==null),total=known.reduce((sum,row)=>sum+row.gain,0),period=M.PERIODS.find(item=>item.days===days),full=days==='max';
 $('#progressHeading').innerHTML=icon(metric)+`<span>${esc(label())} gained · ${full?'full history':'latest '+period.label}</span>`;
 $('#progressRange').textContent=domain?date(domain.start)+' → '+date(domain.end)+' · UTC':'No saved observations.';
 $('#progressTotal').textContent=known.length?'+'+number(total)+' '+unit():'—';
 $('#progressTotalNote').textContent=known.length?(full?'combined gain across saved history':'combined recent gain')+' · '+known.length+' of '+rows.length+' players with observations':'Insufficient history for this comparison';
 $('#gainCards').innerHTML='<colgroup><col class="progress-rank-col"><col><col class="progress-value-col"></colgroup><thead><tr><th scope="col" aria-label="Rank">#</th><th scope="col">Player</th><th scope="col">'+unit()+' gained</th></tr></thead><tbody>'+rows.map(row=>{
  const player=U.player(row.key);
  return `<tr data-progress-player="${esc(row.key)}" data-progress-rank="${row.rank??''}" style="--pc:${player.color}"><td class="progress-rank" title="Rank">${row.rank??'—'}</td><th scope="row"><span class="progress-player-name">${esc(player.name)}</span><span class="progress-observed" title="${row.start===null?'':esc(stamp(row.start)+' → '+stamp(row.end))}">${row.gain===null?'Insufficient history':date(row.start)+' → '+date(row.end)+(row.corrections?' · after correction':'')}</span></th><td class="records-gain ${row.gain>0?'progress-positive':''}"><b>${row.gain===null?'—':'+'+number(row.gain)}</b></td></tr>`;
 }).join('')+'</tbody>';
 $('#progressChartTitle').textContent=label()+(full?' · full history':' · recent gains');
 $('#progressAxis').textContent=view==='share'?'Share of '+unit()+' gained':unit()+' gained · zero baseline';
 $$('[data-progress-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.progressView===view)));
 const entries=rows.map(row=>({name:U.player(row.key).name,color:U.player(row.key).color,value:row.gain})),format=family==='computed'?'hours':'compact';
 if(!known.length)$('#xpChart').innerHTML='<div class="chart-empty" role="status">At least two valid observations '+(full?'are needed to measure gains.':'in this period are needed to measure gains. Try a longer period.')+'</div>';
 else if(view==='bars')C.drawBars('#xpChart',entries,{format,note:'Observed gains for the selected players.'});
 else if(view==='share')C.drawPie('#xpChart',entries,{format,note:'Share of the selected players’ '+unit()+' gained in this period.'});
 else C.drawLine('#xpChart',rows.map(row=>({name:U.player(row.key).name,color:U.player(row.key).color,data:row.gain===null?[]:row.points})),{format,gainMode:true,bars:entries,domain,timeZone:'UTC'});
 $('#progressChartNote').textContent=view==='timeline'?'Tap the graph or use arrow keys to inspect gains at saved dates. Each line starts at zero at that player’s first displayed observation.':view==='share'?'Only positive gains contribute to the share.':'The bars and player comparison show the same gains.';
 const goal=$('#progressGoal');goal.hidden=family==='computed';
 if(!goal.hidden){const params=new URLSearchParams({kind:family,metric});if(selected.size===1)params.set('player',keys()[0]);goal.href='goals.html?'+params+'#new-goal'}
 const type=family==='xp'?(metric==='overall'?'total-xp':'skill-xp'):family==='level'?(metric==='overall'?'total-level':'skill-level'):'boss';
 const params=new URLSearchParams({type:family==='computed'?'total-xp':type});if(!full)params.set('period',days);
 if(!['overall','ehp','ehb'].includes(metric))params.set('metric',metric);
 if(selected.size!==U.ALL_KEYS.length)params.set('members',keys().join(','));$('#progressRecords').href='time-records.html?'+params;$('#progressRecords').hidden=family==='computed';
 $('#progressCoverage').innerHTML=rows.map(row=>`<li><b>${esc(U.player(row.key).name)}</b><span>${date(row.start)+' → '+date(row.end)+' · '+row.points.length+' observations'+(row.gain===null?'':' · largest gap '+span(row.maxGap))}</span></li>`).join('');
 restorePeriod();
}
function choose(key){
 if(!catalogue().includes(key))return;
 metric=key;render();writeURL();
}
function closeDetail(){
 const previous=metric;metric='';if($('#progressDetail').open)$('#progressDetail').close();writeURL();
 $(`#progressMetrics [data-progress-metric="${previous}"]`)?.focus({preventScroll:true});
}
async function load(){
 const current=++revision,doc=await U.loadWom();if(current!==revision)return false;
 model=M.build(doc,U.ALL_KEYS);
 knownSkills=[...new Set([...knownSkills,...model.metrics.skills])].sort();knownBosses=[...new Set([...knownBosses,...model.metrics.bosses])].sort();return true;
}
async function init(){
 try{
  if(!await load())return;readURL();render();if(new URL(location.href).searchParams.has('mode'))writeURL();document.body.dataset.progressReady='true';
  $('#progressSearch').oninput=overview;
  $('#progressSort').onchange=()=>{sort=$('#progressSort').value;overview()};
  $('#progressClose').onclick=closeDetail;
  $('#progressDetail').addEventListener('cancel',event=>{event.preventDefault();closeDetail()});
  $('#progressDetail').addEventListener('click',event=>{if(event.target===$('#progressDetail'))closeDetail()});
  $('#progressAll').onclick=()=>{selected=new Set(U.ALL_KEYS);U.saveMemberSelection(selected);render();writeURL()};
  document.addEventListener('click',event=>{
   const type=event.target.closest('[data-progress-type]');if(type){family=type.dataset.progressType;metric='';$('#progressSearch').value='';render();writeURL();return}
   const choice=event.target.closest('[data-progress-metric]');if(choice){choose(choice.dataset.progressMetric);return}
   const period=event.target.closest('[data-progress-window]');if(period){days=period.dataset.progressWindow==='max'?'max':Number(period.dataset.progressWindow);render();writeURL();return}
   const graph=event.target.closest('[data-progress-view]');if(graph){view=graph.dataset.progressView;render();writeURL()}
  });
 }catch(error){$('#progressStatus').textContent='Saved history could not load. Reload to try again.';console.error(error)}
}
window.addEventListener('ug:members-changed',event=>{const next=U.cleanSelection(event.detail?.keys);if(U.sameSelection(next,selected))return;selected=next;render();if(model)writeURL()});
window.addEventListener('ug:data-updated',event=>{
 if(event.detail?.key!==U.WKEY)return;
 const update=load().then(changed=>{if(changed)render()});
 event.detail.waitUntil?.(update);
 update.catch(error=>{console.error(error);$('#progressStatus').textContent='The updated history could not load. Previous gains are still shown.'});
});
window.addEventListener('popstate',()=>{if(model){readURL();render()}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
