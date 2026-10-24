(()=>{
'use strict';
const U=window.UGV21,D=window.UGGearData,M=window.UGGearModel,C=window.UGClogBetaModel;
if(!U||!D||!M||!C||document.body.dataset.page!=='gear-planner')return;
const $=s=>document.querySelector(s),esc=U.escapeHtml,KEY='ug:gear-planner:v2',params=new URLSearchParams(location.search);
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
let selected=U.loadMemberSelection(),order=[...new Set([...(Array.isArray(saved.order)?saved.order:[]),...U.ALL_KEYS])].filter(k=>U.ALL_KEYS.includes(k)),overrides={group:{},personal:{},...saved.overrides},model,encounters=[],result,levels={};
const dialog=$('#gp-stock-dialog'),labels={log:'Log estimate',craft:'Potential craft',assumed:'Assumed',confirmed:'Confirmed',reused:'Same player: reused',missing:'No available option','two-handed':'Two-handed weapon'};
const settings=()=>({selected:[...selected],order,overrides,levels,craft:$('#gp-crafted').checked,baseline:$('#gp-baseline').checked,respectLevels:$('#gp-levels').checked,onTask:$('#gp-task').checked,switches:$('#gp-switches').checked,specials:$('#gp-specials').checked,method:$('#gp-method').value});
function persist(){try{localStorage.setItem(KEY,JSON.stringify({order,overrides,boss:$('#gp-boss').value,options:Object.fromEntries(['crafted','baseline','levels','task','switches','specials'].map(id=>[id,$('#gp-'+id).checked]))}))}catch{$('#gp-edits').textContent='Browser storage unavailable; current changes still apply.'}}
for(const id of ['crafted','baseline','levels','task','switches','specials'])if(typeof saved.options?.[id]==='boolean')$('#gp-'+id).checked=saved.options[id];
const link=name=>'<a href="'+esc(D.wiki(name))+'" target="_blank" rel="noopener">'+esc(name)+'</a>';
const icon=id=>id?'<img class="gp-item-icon" src="https://static.runelite.net/cache/item/icon/'+Number(id)+'.png" alt="" loading="lazy" decoding="async">':'<span class="gp-item-icon gp-icon-empty" aria-hidden="true">◇</span>';
function slotHTML(slot,v){
 const info=D.items[v.name],options=[...new Set(v.options||[])];
 return'<div class="gp-slot'+(v.source==='missing'?' gp-missing':'')+'"><span class="gp-slot-label">'+esc(U.nice(slot))+'</span><details><summary>'+icon(v.id)+'<span>'+esc(v.name||labels[v.source])+'</span>'+(v.name?'<small class="gp-badge gp-'+v.source+'">'+esc(labels[v.source])+'</small>':'')+'</summary><div class="gp-slot-info">'+(v.name?'<p>'+link(v.name)+'</p>':'')+(info?.note?'<p>'+esc(info.note)+'</p>':'')+(v.source==='craft'&&v.materials?.length?'<p>Reserves: '+v.materials.map(i=>i.count+' × '+esc(i.name)).join(', ')+'.</p>':'')+(options.length?'<p>Preset priority'+(v.rank?' · selected option '+v.rank:'')+':</p><ol>'+options.map(n=>'<li'+(n===v.name?' class="gp-choice"':'')+'>'+link(n)+'</li>').join('')+'</ol>':'')+(v.rank>1||v.source==='missing'?'<p>Earlier options could not be assigned from the remaining stock, equipment levels or required set pieces. The supply ledger shows where scarce gear went.</p>':'')+'</div></details></div>';
}
const setHTML=set=>'<section class="gp-set"><h4>'+esc(set.label)+' <small>'+esc(U.nice(set.style))+'</small></h4>'+Object.entries(set.slots).map(([slot,v])=>slotHTML(slot,v)).join('')+(D.items[set.slots.weapon?.name]?.supplies?'<p class="gp-set-supplies"><strong>Ammo / charges:</strong> '+esc(D.items[set.slots.weapon.name].supplies)+'</p>':'')+'</section>';
function renderPriority(){const active=order.filter(k=>selected.has(k));$('#gp-priority').innerHTML=active.map((key,i)=>'<li><b>'+esc(U.player(key).name)+'</b><span><button type="button" data-gp-move="-1" data-player="'+esc(key)+'" aria-label="Move '+esc(U.player(key).name)+' earlier" '+(!i?'disabled':'')+'>↑</button><button type="button" data-gp-move="1" data-player="'+esc(key)+'" aria-label="Move '+esc(U.player(key).name)+' later" '+(i===active.length-1?'disabled':'')+'>↓</button></span></li>').join('')}
function renderBosses(keep){
 const term=$('#gp-find').value.trim().toLowerCase(),filtered=encounters.filter(e=>(e.name+' '+e.id+' '+e.group).toLowerCase().includes(term));
 $('#gp-boss').innerHTML=[...new Set(filtered.map(e=>e.group))].map(g=>'<optgroup label="'+esc(g)+'">'+filtered.filter(e=>e.group===g).map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+(e.kind==='unreviewed'?' · preset pending':'')+'</option>').join('')+'</optgroup>').join('');
 if(filtered.some(e=>e.id===keep))$('#gp-boss').value=keep;$('#gp-boss').disabled=!filtered.length;
 if(filtered.length)run();else{$('#gp-status').textContent='No encounters match this search.';for(const id of ['loadouts','encounter','warnings'])$('#gp-'+id).replaceChildren()}
}
function run(){
 if(!model)return;const e=encounters.find(e=>e.id===$('#gp-boss').value);if(!e)return;
 $('#gp-task').disabled=e.task==='required'||!e.task;$('#gp-method').disabled=!!e.kind;
 const methods=new Set((e.roles[0]?.routes||[]).map(route=>route.style));
 for(const option of $('#gp-method').options)option.disabled=option.value!=='auto'&&!methods.has(option.value);
 if($('#gp-method').value!=='auto'&&!methods.has($('#gp-method').value))$('#gp-method').value='auto';
 result=M.plan(model,U.PLAYERS,e,settings());window.UGGearPlanner={get result(){return result},get model(){return model},get settings(){return settings()}};
 renderPriority();const n=Object.keys(overrides.group||{}).length+Object.values(overrides.personal||{}).reduce((a,v)=>a+Object.keys(v).length,0);
 $('#gp-edits').textContent=n?n+' stock adjustment'+(n===1?'':'s')+' · saved in this browser':'Using Collection Log estimates';
 $('#gp-status').textContent=result.loadouts.length+' simultaneous loadout'+(result.loadouts.length===1?'':'s')+' · all five members supply tradeable stock · '+(e.kind?U.nice(e.kind):result.missing+' unfilled slot'+(result.missing===1?'':'s'));
 $('#gp-encounter').innerHTML='<div><h3>'+esc(e.name)+'</h3><p>'+esc(e.note)+'</p>'+(e.task==='required'?'<p><strong>Matching Slayer task required.</strong> Task headgear is prioritised automatically.</p>':'')+'</div><a href="'+esc(e.source)+'" target="_blank" rel="noopener">Strategy &amp; gear source ↗</a>';
 const warnings=[];
 if(model.known.size<5)warnings.push('Collection Log available for '+model.known.size+'/5 members. Missing logs are unknown and do not add stock.');
 if(!$('#gp-baseline').checked)warnings.push('Strict log mode: common quest/shop equipment stays unavailable until you confirm stock or enable standard gear.');
 if(e.kind==='unreviewed')warnings.push('This encounter is listed for coverage, but has no verified BIS recommendation.');
 if($('#gp-crafted').checked&&!e.kind)warnings.push('Potential crafts need the additional quests, skills, currency and charges listed on the item. Log quantities estimate acquired gear.');
 warnings.push(...new Set(result.state.warnings));
 $('#gp-warnings').innerHTML=warnings.length?'<details class="gp-assumption-note"><summary>'+esc(warnings[0])+(warnings.length>1?' <small>+'+(warnings.length-1)+' notes</small>':'')+'</summary><ul>'+warnings.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul></details>':'';
 $('#gp-loadouts').innerHTML=['self-contained','unreviewed'].includes(e.kind)?'<div class="gp-empty">'+esc(e.note)+'</div>':'<div class="gp-grid" style="--gp-count:'+result.loadouts.length+'">'+result.loadouts.map((row,i)=>'<article class="gp-card" style="--pc:'+row.player.color+'"><header><span class="gp-number">'+(i+1)+'</span><h3>'+esc(row.player.name)+'</h3></header>'+setHTML(row.sets[0])+(row.sets.length>1?'<details class="gp-switch-details"><summary>Phase switches <b>'+(row.sets.length-1)+'</b></summary>'+row.sets.slice(1).map(setHTML).join('')+'</details>':'')+(row.special?'<section class="gp-set gp-special"><h4>Special attack</h4>'+slotHTML('weapon',row.special)+'</section>':'')+'</article>').join('')+'</div>';
 const materials=['Armadyl helmet','Armadyl chestplate','Armadyl chainskirt','Armadylean plate','Crystal armour seed','Enhanced crystal weapon seed','Zenyte shard','Bandos chestplate','Bandos tassets','Bandosian components'];
 $('#gp-ledger-rows').innerHTML=result.ledger.filter(r=>r.used||r.reserved||materials.includes(r.name)&&r.start).map(r=>'<tr><th>'+link(r.name)+'<small>'+esc(r.owner?U.player(r.owner)?.name||r.owner:'Group pool')+(r.assumed?' · assumed':'')+'</small></th><td>'+r.start+'</td><td>'+r.reserved+'</td><td>'+r.used+'</td><td>'+r.left+'</td></tr>').join('')||'<tr><td colspan="5">No group equipment allocated for this encounter.</td></tr>';
 const crafts=result.state.events.filter(ev=>ev.type==='craft'||ev.type==='convert');$('#gp-crafts').innerHTML=crafts.length?'<h4>Planned crafts &amp; dismantles</h4><ul>'+crafts.map(ev=>'<li>'+esc(U.player(ev.player)?.name||ev.player)+': '+(ev.type==='convert'?'dismantle '+ev.donors.map(d=>d.count+' × '+esc(d.item)).join(' + ')+' → '+ev.count+' × '+esc(ev.name):ev.count+' × '+esc(ev.name))+'</li>').join('')+'</ul>':'';
 const q=new URLSearchParams(location.search);q.set('boss',e.id);if($('#gp-method').value!=='auto')q.set('method',$('#gp-method').value);else q.delete('method');history.replaceState(null,'',location.pathname+'?'+q);persist();
}
function stockRows(){
 if(!model)return;const owner=$('#gp-stock-owner').value,term=$('#gp-stock-search').value.trim().toLowerCase(),base=M.stock(model,U.PLAYERS,{craft:false,respectLevels:false}),values=owner==='group'?overrides.group:overrides.personal[owner]||{};
 const rows=Object.values(D.items).filter(i=>i.personal?owner!=='group':owner==='group').filter(i=>(i.name+' '+Object.keys(i.recipe||{}).join(' ')).toLowerCase().includes(term)).sort((a,b)=>a.name.localeCompare(b.name));
 $('#gp-stock-rows').innerHTML=rows.map(i=>{const n=owner==='group'?base.input.shared.get(i.name)||0:base.input.personal.get(owner)?.get(i.name)||0;return'<tr><th>'+link(i.name)+(i.recipe?'<small>Craft: '+Object.entries(i.recipe).map(([n,c])=>c+' × '+esc(n)).join(' + ')+'</small>':'')+(i.note?'<small>'+esc(i.note)+'</small>':'')+'</th><td>'+n+'</td><td><input type="number" min="0" max="1000000" step="1" inputmode="numeric" data-stock-item="'+esc(i.name)+'" aria-label="Remaining '+esc(i.name)+'" placeholder="'+n+' (log)" value="'+(Object.hasOwn(values,i.name)?values[i.name]:'')+'"></td></tr>'}).join('')||'<tr><td colspan="3">No matches. Personal capes, armour and quest gear are under each player’s inventory.</td></tr>';
}
$('#gp-priority').addEventListener('click',ev=>{const b=ev.target.closest('[data-gp-move]');if(!b)return;const active=order.filter(k=>selected.has(k)),i=active.indexOf(b.dataset.player),j=i+Number(b.dataset.gpMove);if(j<0||j>=active.length)return;[active[i],active[j]]=[active[j],active[i]];order=[...active,...order.filter(k=>!selected.has(k))];run();$('#gp-priority [data-player="'+b.dataset.player+'"][data-gp-move="'+b.dataset.gpMove+'"]')?.focus()});
$('#gp-find').addEventListener('input',()=>renderBosses($('#gp-boss').value));$('#gp-boss').addEventListener('change',()=>{$('#gp-method').value='auto';run()});
for(const id of ['method','crafted','baseline','levels','task','switches','specials'])$('#gp-'+id).addEventListener('change',run);
$('#gp-edit').addEventListener('click',()=>{stockRows();if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');$('#gp-stock-search').focus()});
$('#gp-stock-close').addEventListener('click',()=>{if(dialog.close)dialog.close();else dialog.removeAttribute('open');$('#gp-edit').focus()});
$('#gp-stock-search').addEventListener('input',stockRows);$('#gp-stock-owner').addEventListener('change',stockRows);
$('#gp-stock-rows').addEventListener('change',ev=>{const input=ev.target.closest('[data-stock-item]');if(!input)return;const name=input.dataset.stockItem,owner=$('#gp-stock-owner').value,values=owner==='group'?overrides.group:(overrides.personal[owner]||={});if(input.value==='')delete values[name];else if(M.finite(input.value))values[name]=Number(input.value);else{$('#gp-stock-message').textContent='Enter a whole quantity from 0 to 1,000,000, or leave blank for the log estimate.';return}$('#gp-stock-message').textContent='Stock saved; loadouts updated.';run()});
$('#gp-stock-reset').addEventListener('click',()=>{overrides={group:{},personal:{}};run();stockRows();$('#gp-stock-message').textContent='Stock adjustments cleared; using log estimates.'});
$('#gp-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);$('#gp-copy').textContent='Encounter link copied'}catch{$('#gp-copy').textContent='Use this page’s URL to share the encounter'}});
function renderMembers(){U.renderMemberPicker($('#gp-members'),selected,next=>{selected=U.saveMemberSelection(next);renderMembers();run()},{title:'Players to equip (1–5)',subtitle:'Selected players need their gear at the same time; all five members still supply the pool.',availability:model.known,compact:true})}
async function updateLogs(){const doc=await U.loadClog(),previous=$('#gp-boss').value;model=C.build(doc,U.PLAYERS);const keys=Object.keys((await U.loadWom().catch(()=>null))?.profiles?.[U.ALL_KEYS[0]]?.latestSnapshot?.data?.bosses||{});encounters=M.encounterList(model,keys);renderBosses(previous||params.get('boss')||saved.boss||'tombs_of_amascut');renderMembers()}
async function updateLevels(){const doc=await U.loadWom();levels=Object.fromEntries(U.PLAYERS.map(p=>[p.key,Object.fromEntries(Object.entries(U.snapData(doc,p.key)?.skills||{}).map(([n,v])=>[n,v.level]))]));if(model)run()}
for(const p of U.PLAYERS)$('#gp-stock-owner').add(new Option(p.name+' · personal gear',p.key));
if(['auto','melee','ranged','magic'].includes(params.get('method')))$('#gp-method').value=params.get('method');
U.onDataUpdate(async ev=>{if(ev.detail?.key===U.TKEY){await updateLogs();run()}else if(ev.detail?.key===U.WKEY)await updateLevels()});
window.addEventListener('ug:members-changed',ev=>{const next=new Set(ev.detail?.keys||[]);if(next.size&&!U.sameSelection(next,selected)){selected=next;if(model){renderMembers();run()}}});
Promise.all([updateLevels(),updateLogs()]).then(run).catch(error=>{$('#gp-status').textContent='Saved gear data could not be loaded: '+error.message});
})();
