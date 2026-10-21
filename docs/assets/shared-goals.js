(()=>{
'use strict';
const U=window.UGV21,G=window.UGGoalProgress;
if(!U||!G||document.body.dataset.page!=='goals'||window.__sharedGoalsLoaded)return;
window.__sharedGoalsLoaded=true;
const API='https://united-gimps-temple-proxy.vercel.app/api/player-goals',esc=U.escapeHtml;
const kinds=['level','xp','boss','collection','item','manual','none'];
let doc={goals:{}},wom,temple,enabled=false,scrolledGoal='',chooser;
const host=document.createElement('section');host.className='section';host.id='sharedGoals';
document.querySelector('#chronicleGoals')?.closest('section')?.before(host);
host.innerHTML='<div class="section-head"><div><h2>Shared player goals <span class="feature-beta">Beta</span></h2><div class="section-note">Choose any target. Goals are visible to everyone; tracked progress uses the latest loaded WOM and Temple data.</div></div><button type="button" id="reloadSharedGoals">Reload shared goals</button></div><p id="sharedGoalNotice" aria-live="polite"></p><div class="goal-grid" id="sharedGoalCards"></div>';
host.querySelector('#reloadSharedGoals').onclick=()=>reload();
function scrollToGoal(){const hash=location.hash;if(!/^#goal-[a-z-]+$/.test(hash)||hash===scrolledGoal)return;const el=document.getElementById(hash.slice(1));if(el){scrolledGoal=hash;requestAnimationFrame(()=>el.scrollIntoView?.({block:'start'}))}}
window.addEventListener('hashchange',scrollToGoal);
async function request(body){const r=await fetch(API,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});const data=await r.json().catch(()=>({error:'Shared goal publishing is temporarily unavailable.'}));if(!r.ok)throw new Error(data.error||'Shared goals are unavailable.');return data;}
function metrics(player,kind){
 const family=kind==='boss'?'bosses':'skills',own=U.snapData(wom,player)?.[family]||{};
 const keys=new Set([...Object.keys(own),...U.PLAYERS.flatMap(p=>Object.keys(U.snapData(wom,p.key)?.[family]||{}))]);
 return [...keys].sort((a,b)=>a==='overall'?-1:b==='overall'?1:U.nice(a).localeCompare(U.nice(b))).map(k=>[k,k==='overall'?(kind==='level'?'Total level':'Total XP'):U.nice(k)]);
}
function itemOptions(){return Object.entries(temple?.catalog?.items||{}).filter(([id,name])=>/^\d+$/.test(id)&&typeof name==='string').map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));}
function fields(prefix,current={}){
 const catalog=itemOptions();
 return `<label>Goal type<select name="kind"><option value="level">Skill or total level</option><option value="xp">Skill or total XP</option><option value="boss">Boss kill count</option><option value="collection">Total Collection Log uniques</option><option value="item">A specific Collection Log item</option><option value="manual">Custom goal with manual progress</option><option value="none">Any goal or quest, without a counter</option></select></label><label id="${prefix}MetricLabel"><span data-metric-label>Skill</span><select name="metric"></select></label><label id="${prefix}ItemLabel">Collection Log item<input name="item" list="${prefix}ItemChoices" value="${current.kind==='item'?esc(catalog.find(x=>x.id===current.metric)?.name||''):''}" placeholder="Start typing an item name"><datalist id="${prefix}ItemChoices">${catalog.map(x=>`<option value="${esc(x.name)}"></option>`).join('')}</datalist><small>Choose the exact item from the list.</small></label><label id="${prefix}CurrentLabel">Current amount<input name="current" type="number" min="0" max="1000000000000" value="${esc(current.current??0)}" step="any"></label><label id="${prefix}TargetLabel"><span data-target-label>Target amount</span><input name="targetValue" type="number" min="1" max="1000000000000" step="1" required value="${esc(current.targetValue??100)}"></label><p class="goal-choice-preview" id="${prefix}Preview" aria-live="polite"></p>`;
}
function configure(form,prefix,getPlayer,current={},auto=false){
 const field=name=>form.elements.namedItem(name),catalog=itemOptions();
 field('kind').value=kinds.includes(current.kind)?current.kind:'none';field('text').dataset.auto=auto?'1':'0';
 const selectedMetric=()=>field('kind').value==='item'?catalog.find(x=>x.name.toLowerCase()===field('item').value.trim().toLowerCase())?.id||'':field('metric').value;
 function goal(){return {text:field('text').value.trim(),kind:field('kind').value,metric:selectedMetric(),targetValue:Number(field('targetValue').value),current:Number(field('current').value)}}
 function preview(){
  const g=goal(),player=getPlayer(),s=G.progress(g,player,wom,temple),name=U.nice(g.metric),amount=U.fmt(g.targetValue);
  if(field('text').dataset.auto==='1')field('text').value=g.kind==='level'?`Reach ${amount} ${g.metric==='overall'?'total level':name}`:g.kind==='xp'?`Reach ${amount} ${g.metric==='overall'?'total XP':name+' XP'}`:g.kind==='boss'?`Reach ${amount} ${name} KC`:g.kind==='collection'?`Reach ${amount} Collection Log uniques`:g.kind==='item'?`Obtain ${field('item').value}`:'';
  form.querySelector('#'+prefix+'Preview').textContent=s?(s.unknown?'Current progress is unknown until the source data is available.':`${U.player(player).name}: ${U.fmt(s.value)} / ${amount} · ${s.complete?'Complete':Math.floor(s.percent)+'%'} · ${s.source}`):'Write any personal goal or quest below.';
 }
 function controls(reset=false){
  const kind=field('kind').value,oldMetric=field('metric').value,list=['level','xp','boss'].includes(kind)?metrics(getPlayer(),kind):[];
  field('metric').innerHTML=list.map(([key,name])=>`<option value="${esc(key)}">${esc(name)}</option>`).join('');
  const preferred=oldMetric||current.metric;if(list.some(([key])=>key===preferred))field('metric').value=preferred;
  form.querySelector('#'+prefix+'MetricLabel').hidden=!['level','xp','boss'].includes(kind);
  form.querySelector('#'+prefix+'ItemLabel').hidden=kind!=='item';field('item').required=kind==='item';
  form.querySelector('#'+prefix+'CurrentLabel').hidden=kind!=='manual';form.querySelector('#'+prefix+'TargetLabel').hidden=['none','item'].includes(kind);
  form.querySelector('[data-metric-label]').textContent=kind==='boss'?'Boss':'Skill';
  form.querySelector('[data-target-label]').textContent={level:'Target level',xp:'Target XP',boss:'Target KC',collection:'Target unique items'}[kind]||'Target amount';
  const target=field('targetValue');target.step=kind==='manual'?'any':'1';target.min=kind==='manual'?'0.000001':'1';target.max=kind==='level'?(field('metric').value==='overall'?'3000':'99'):'1000000000000';
  if(kind==='item')target.value='1';
  if(reset&&kind!=='none'&&kind!=='item'){
   const s=G.progress({kind,metric:selectedMetric(),targetValue:1,current:0},getPlayer(),wom,temple),value=s&&!s.unknown?s.value:0;
   target.value=kind==='level'?String(Math.min(Number(target.max),field('metric').value==='overall'?Math.ceil((value+1)/100)*100:value+1)):String(Math.ceil((value+1)/(kind==='xp'?1000000:kind==='collection'?25:100))*(kind==='xp'?1000000:kind==='collection'?25:100));
  }
  for(const name of ['metric','item','current','targetValue'])field(name).disabled=field(name).closest('label').hidden;
  target.required=!target.disabled;preview();
 }
 field('text').addEventListener('input',()=>field('text').dataset.auto='0');
 field('kind').onchange=()=>{if(!field('text').value.trim())field('text').dataset.auto='1';controls(true)};
 field('metric').onchange=()=>controls(true);
 for(const name of ['targetValue','current','item'])field(name).addEventListener('input',preview);
 controls();
 return {controls,preview,goal};
}
function buildChooser(){
 if(chooser)return;
 const section=document.createElement('section');section.className='section goal-chooser';section.id='new-goal';
 section.innerHTML=`<div class="section-head"><div><h2>Set any goal</h2><div class="section-note">Choose the player, metric and target. You can also enter a quest or any personal goal.</div></div></div><form id="goalChoiceForm"><div class="goal-choice-fields"><label>Player<select name="player">${U.PLAYERS.map(p=>`<option value="${esc(p.key)}">${esc(p.name)}</option>`).join('')}</select></label>${fields('goalChoice')}</div><label>Goal description<input name="text" maxlength="140" required placeholder="Describe what you want to achieve"></label><div class="goal-choice-actions"><button type="submit" class="btn" id="chooseSharedGoal" disabled>Set this goal</button><a id="goalChoiceStats" hidden>View related stats ↗</a></div><p class="section-note">Your player edit code is required to publish or change a shared goal.</p></form>`;
 host.before(section);const form=section.querySelector('form'),params=new URLSearchParams(location.search),player=params.get('player');
 form.elements.player.value=U.ALL_KEYS.includes(player)?player:[...U.loadMemberSelection()][0];
 const kind=kinds.includes(params.get('kind'))?params.get('kind'):'level',target=Number(params.get('target'));
 form.elements.targetValue.value=target>0&&target<=1e12?String(target):'100';
 const controls=configure(form,'goalChoice',()=>form.elements.player.value,{kind,metric:params.get('metric')||''},true);
 if(!(target>0&&target<=1e12))controls.controls(true);else controls.preview();
 function link(){const href=G.statsHref(controls.goal(),form.elements.player.value),a=section.querySelector('#goalChoiceStats');a.hidden=!href;if(href)a.href=href;}
 form.addEventListener('input',link);form.addEventListener('change',link);form.elements.player.onchange=()=>{controls.controls(true);link()};link();
 form.onsubmit=e=>{e.preventDefault();if(enabled&&form.reportValidity())edit(form.elements.player.value,controls.goal())};
 chooser={form,controls,section};
 if(location.hash==='#new-goal')requestAnimationFrame(()=>section.scrollIntoView?.({block:'start'}));
}
function render(){
 host.querySelector('#sharedGoalCards').innerHTML=U.PLAYERS.filter(p=>U.loadMemberSelection().has(p.key)).map(p=>{
  const g=doc.goals?.[p.key],active=Boolean(g?.text),s=active?G.progress(g,p.key,wom,temple):null,href=active?G.statsHref(g,p.key):'';
  return `<article class="goal-card" id="goal-${p.key.replace(/ /g,'-')}" style="--pc:${p.color}"><div class="v22-player-goal-head"><h3>${esc(p.name)}</h3><button type="button" data-edit-shared="${esc(p.key)}" ${enabled?'':'disabled'}>${active?'Update goal':'Set a goal'}</button></div><p>${active?esc(g.text):'No shared goal yet.'}</p>${s?(s.unknown?`<p>Progress unknown · ${s.source} data unavailable</p>`:`<progress max="100" value="${s.percent}" aria-label="${esc(p.name)} goal progress"></progress><p>${U.fmt(s.value)} / ${U.fmt(s.target)} · ${s.complete?'Complete':Math.floor(s.percent)+'%'} · ${s.source}</p>`):''}${href?`<a class="goal-stats-link" href="${esc(href)}">${g.kind==='boss'?'View boss KC':g.kind==='level'?'View level stats':'View XP stats'} ↗</a>`:''}${active&&g.updatedAt?`<small>Goal updated ${esc(new Date(g.updatedAt).toLocaleString('en-GB'))}</small>`:''}</article>`;
 }).join('');
 host.querySelectorAll('[data-edit-shared]').forEach(b=>b.onclick=()=>edit(b.dataset.editShared));
 if(chooser)chooser.section.querySelector('#chooseSharedGoal').disabled=!enabled;
 document.querySelectorAll('[data-pick-goal]').forEach(b=>b.disabled=!enabled);scrollToGoal();
}
async function stats(){[wom,temple]=await Promise.all([U.loadWom(),U.loadClog()]);buildChooser();chooser.controls.controls();render()}
async function reload(){const b=host.querySelector('#reloadSharedGoals');b.disabled=true;try{doc=await request();enabled=doc.enabled===true;render();host.querySelector('#sharedGoalNotice').textContent='Shared goals loaded.'}catch(e){host.querySelector('#sharedGoalNotice').textContent=e.message}finally{b.disabled=false}}
function edit(player,preset){
 if(!enabled)return;
 document.querySelector('#sharedGoalDialog')?.remove();const saved=doc.goals[player]||{},current={...saved,...preset},catalog=itemOptions(),dialog=document.createElement('dialog');dialog.id='sharedGoalDialog';dialog.className='v22-goal-dialog';
 dialog.innerHTML=`<form><h2>${esc(U.player(player).name)} · shared goal</h2><label>Short goal<input name="text" maxlength="140" required value="${esc(current.text)}" placeholder="e.g. Complete Desert Treasure II"></label><details id="sharedProgressOptions"><summary>Progress tracking</summary>${fields('shared',current)}</details><label>Player edit code<input name="code" type="password" required autocomplete="off" maxlength="200"></label><p>Your goal is visible to everyone. Use this player’s edit code to publish the change.</p><div class="v22-goal-actions"><button type="submit" class="btn">Publish goal</button><button type="button" id="removeSharedGoal" ${saved.text?'':'hidden'}>Remove goal</button><button type="button" id="cancelSharedGoal">Cancel</button></div><p id="sharedGoalError" role="status"></p></form>`;
 document.body.append(dialog);const form=dialog.querySelector('form'),field=name=>form.elements.namedItem(name),controls=configure(form,'shared',()=>player,current,false);
 dialog.querySelector('#sharedProgressOptions').open=field('kind').value!=='none';
 const close=()=>{dialog.close();dialog.remove()};dialog.querySelector('#cancelSharedGoal').onclick=close;dialog.addEventListener('cancel',()=>dialog.remove());
 async function save(clear=false){
  const error=dialog.querySelector('#sharedGoalError');if(clear?!field('code').reportValidity():!form.reportValidity())return;
  const buttons=dialog.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
  try{const goal=controls.goal();if(!clear&&goal.kind==='item'&&!goal.metric)throw new Error('Choose an item from the Collection Log list.');doc=await request({player,clear,version:saved.updatedAt||null,...goal,code:field('code').value});close();render();host.querySelector('#sharedGoalNotice').textContent='Goal published for everyone.'}
  catch(e){error.textContent=e.message}finally{buttons.forEach(b=>b.disabled=false)}
 }
 form.onsubmit=e=>{e.preventDefault();save()};dialog.querySelector('#removeSharedGoal').onclick=()=>save(true);dialog.showModal();field('text').focus();
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-pick-goal]');if(!b||b.disabled)return;const player=b.closest('[data-goal-player]')?.dataset.goalPlayer;if(U.ALL_KEYS.includes(player))edit(player,{kind:b.dataset.goalKind,metric:b.dataset.goalMetric,targetValue:Number(b.dataset.goalTarget),text:b.dataset.goalText})});
window.addEventListener('ug:goal-pick',e=>{const p=e.detail;if(U.ALL_KEYS.includes(p?.player))edit(p.player,p)});
U.onDataUpdate(e=>{if([U.WKEY,U.TKEY].includes(e.detail?.key))return stats()});
window.addEventListener('ug:members-changed',render);
window.addEventListener('ug:page-rendered',render);
async function init(){try{const r=await fetch('data/goals.json',{cache:'no-store'});if(r.ok)doc=await r.json()}catch{}await stats();await reload()}
init();
})();
