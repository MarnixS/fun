(()=>{
'use strict';
const U=window.UGV21,D=window.UGGearData,M=window.UGGearModel,C=window.UGClogBetaModel,P=window.UGGearLoadouts,F=window.UGGearDpsUI,E=window.UGWikiDps;
if(!U||!D||!M||!C||!P||!F||document.body.dataset.page!=='gear-planner')return;
const $=s=>document.querySelector(s),esc=U.escapeHtml,KEY='ug:gear-planner:v2',params=new URLSearchParams(location.search);
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
let selected=U.loadMemberSelection(),order=[...new Set([...(Array.isArray(saved.order)?saved.order:[]),...U.ALL_KEYS])].filter(k=>U.ALL_KEYS.includes(k)),overrides={group:{},personal:{},...saved.overrides},model,encounters=[],result,levels={},edits=saved.edits||{},revision=0,picker=null,pickerLimit=60;
const dialog=$('#gp-stock-dialog'),labels={log:'Log estimate',craft:'Potential craft',assumed:'Assumed',confirmed:'Confirmed',reused:'Same player: reused',missing:'No available option','two-handed':'Two-handed weapon',contended:'Acquired · out of stock',unavailable:'Not available'};
const editKey=()=>{const room=F.settings().context.raidRoom;return $('#gp-boss').value+(room&&room!=='all'?'::'+room:'')};
const settings=()=>({selected:[...selected],order,overrides,levels,craft:$('#gp-crafted').checked,baseline:$('#gp-baseline').checked,respectLevels:$('#gp-levels').checked,switches:$('#gp-switches').checked,specials:$('#gp-specials').checked,method:$('#gp-method').value,edits:edits[editKey()]||{},combat:F.settings()});
function persist(){try{localStorage.setItem(KEY,JSON.stringify({order,overrides,edits,boss:$('#gp-boss').value,options:Object.fromEntries(['crafted','baseline','levels','switches','specials'].map(id=>[id,$('#gp-'+id).checked]))}))}catch{$('#gp-edits').textContent='Browser storage unavailable; current changes still apply.'}}
for(const id of ['crafted','baseline','levels','switches','specials'])if(typeof saved.options?.[id]==='boolean')$('#gp-'+id).checked=saved.options[id];
const link=name=>'<a href="'+esc(D.wiki(name))+'" target="_blank" rel="noopener">'+esc(name)+'</a>';
const icon=id=>id?'<img class="gp-item-icon" src="https://static.runelite.net/cache/item/icon/'+Number(id)+'.png" alt="" loading="lazy" decoding="async">':'<span class="gp-item-icon gp-icon-empty" aria-hidden="true">◇</span>';
function slotHTML(slot,v,key,phase){
 const name=v?.name,status=v?.hypothetical?(v.source==='contended'?'allocated':'unavailable'):v?.ammoAssumption?'assumed':name?'stock':'empty',label=name?(labels[v.source]||'In stock'):(v?.source==='two-handed'?'Two-handed weapon':'Empty slot');
 const id=v?.id||E.equipment(name||'')?.id;
 return '<button type="button" class="gp-equip-button gp-equip-'+status+'" data-slotpick="'+esc(slot)+'" data-player="'+esc(key)+'" data-phase="'+esc(phase)+'" title="'+esc(U.nice(slot)+': '+(name||label)+' · '+label)+'" data-tooltip="'+esc((name||label)+' · '+(v?.ownership==='logged'?'In own Collection Log · ':v?.ownership==='borrowed'?'Borrowed from group · ':'')+label)+'" aria-label="Change '+esc(U.nice(slot))+' for '+esc(U.player(key)?.name||key)+': '+esc(name||label)+'"><span class="gp-equip-label">'+esc(slot==='offhand'?'Shield':U.nice(slot))+'</span>'+icon(id)+'<span class="gp-equip-name">'+esc(name||label)+'</span><span class="gp-equip-state">'+esc(status==='stock'?(v?.source==='assumed'?'Assumed':v?.source==='craft'?'Craftable':'In stock'):status==='assumed'?'Ammo assumed':status==='allocated'?'Out of stock':status==='unavailable'?'Unavailable':'—')+'</span></button>';
}
function setHTML(set,key){
 const inherited=set.weaponOnly?{...result.loadouts.find(r=>r.player.key===key)?.sets[0]?.slots,...set.slots}:set.slots;
 return '<section class="gp-set"><h4>'+esc(set.label)+' <small>'+esc(U.nice(set.style))+'</small></h4>'+F.resultHTML(set)+'<div class="gp-equipment-grid">'+P.slots.map(slot=>slotHTML(slot,inherited[slot]||{},key,set.label)).join('')+'</div>'+(set.dps?.ammoInQuiver?'<p class="gp-equipment-hint">Quiver: '+esc(set.dps.ammo)+' · ammo assumed</p>':'')+'<p class="gp-equipment-hint">Select a slot to change equipment</p><details class="gp-gear-details"><summary>Equipment &amp; recipes</summary>'+Object.entries(inherited).filter(([,v])=>v.name).map(([slot,v])=>'<div><b>'+esc(U.nice(slot))+': '+link(v.name)+'</b>'+(D.items[v.name]?.recipe?'<p>Recipe: '+Object.entries(D.items[v.name].recipe).map(([n,c])=>c+' × '+esc(n)).join(' + ')+'.</p>':'')+(D.items[v.name]?.note?'<p>'+esc(D.items[v.name].note)+'</p>':'')+(v.materials?.length?'<p>Reserves: '+v.materials.map(i=>i.count+' × '+esc(i.name)).join(', ')+'.</p>':'')+'</div>').join('')+'</details></section>';
}
function renderPriority(){const active=order.filter(k=>selected.has(k));$('#gp-priority').innerHTML=active.map((key,i)=>'<li><b>'+esc(U.player(key).name)+'</b><span><button type="button" data-gp-move="-1" data-player="'+esc(key)+'" aria-label="Move '+esc(U.player(key).name)+' earlier" '+(!i?'disabled':'')+'>↑</button><button type="button" data-gp-move="1" data-player="'+esc(key)+'" aria-label="Move '+esc(U.player(key).name)+' later" '+(i===active.length-1?'disabled':'')+'>↓</button></span></li>').join('')}
function renderBosses(keep){
 const term=$('#gp-find').value.trim().toLowerCase(),filtered=encounters.filter(e=>(e.name+' '+e.id+' '+e.group).toLowerCase().includes(term));
 $('#gp-boss').innerHTML=[...new Set(filtered.map(e=>e.group))].map(g=>'<optgroup label="'+esc(g)+'">'+filtered.filter(e=>e.group===g).map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+(e.kind==='unreviewed'?' · preset pending':'')+'</option>').join('')+'</optgroup>').join('');
 if(filtered.some(e=>e.id===keep))$('#gp-boss').value=keep;$('#gp-boss').disabled=!filtered.length;
 if(filtered.length)run();else{revision++;$('#gp-status').textContent='No encounters match this search.';for(const id of ['loadouts','encounter','warnings'])$('#gp-'+id).replaceChildren()}
}
function run(options={}){
 if(!model)return;const e=encounters.find(e=>e.id===$('#gp-boss').value);if(!e)return;F.configure(e);
 $('#gp-method').disabled=!!e.kind;
 const room=E.raidRoom(e,F.settings().context.raidRoom),methods=new Set(room?.styles.length?room.styles:(e.roles[0]?.routes||[]).map(route=>route.style));
 for(const option of $('#gp-method').options)option.disabled=option.value!=='auto'&&!methods.has(option.value);
 if($('#gp-method').value!=='auto'&&!methods.has($('#gp-method').value))$('#gp-method').value='auto';
 const refreshed=options.combatOnly===true&&result?.encounter.id===e.id;
 if(refreshed)renderPlan(P.refreshDps(result,settings()),e);
 const serial=++revision;const computed=F.plan(model,U.PLAYERS,e,settings());
 if(computed?.then){$('#gp-status').textContent=refreshed?'DPS updated for equipped gear · optimising available equipment…':'Calculating player loadouts…';computed.then(next=>{if(serial===revision&&next)renderPlan(next,e)}).catch(error=>{if(serial===revision)$('#gp-status').textContent='Gear calculation could not finish: '+error.message});return}
 renderPlan(computed,e);
}
function renderPlan(next,e){
 const openSwitches=new Set([...document.querySelectorAll('.gp-switch-details[open]')].map(n=>n.closest('.gp-card').dataset.gpPlayer)),focus=document.activeElement?.dataset;
 result=next;window.UGGearPlanner={get result(){return result},get model(){return model},get settings(){return settings()},recalculate:run};
 renderPriority();const n=Object.keys(overrides.group||{}).length+Object.values(overrides.personal||{}).reduce((a,v)=>a+Object.keys(v).length,0);
 $('#gp-edits').textContent=n?n+' stock adjustment'+(n===1?'':'s')+' · saved in this browser':'Using Collection Log estimates';
 $('#gp-status').textContent=result.loadouts.length+' simultaneous loadout'+(result.loadouts.length===1?'':'s')+' · all five members supply tradeable stock · '+(e.kind?U.nice(e.kind):result.missing+' unfilled slot'+(result.missing===1?'':'s'));
 $('#gp-encounter').innerHTML='<div><h3>'+esc(e.name)+'</h3><p>'+esc(e.note)+'</p>'+(e.task==='required'?'<p><strong>Matching Slayer task required.</strong> Task headgear is prioritised automatically.</p>':'')+'</div><a href="'+esc(e.source)+'" target="_blank" rel="noopener">Strategy &amp; gear source ↗</a>';
 const warnings=[];
 if(model.known.size<5)warnings.push('Collection Log available for '+model.known.size+'/5 members. Missing logs are unknown and do not add stock.');
 if(!$('#gp-baseline').checked)warnings.push('Common quest/shop equipment needs confirmed stock or the standard-gear option. Each account’s normal Ava’s accumulator is already assumed for this group.');
 if(e.kind==='unreviewed')warnings.push('This encounter is listed for coverage, but has no verified BIS recommendation.');
 if($('#gp-crafted').checked&&!e.kind)warnings.push('Potential crafts need the additional quests, skills, currency and charges listed on the item. Log quantities estimate acquired gear.');
 warnings.push(...new Set(result.state.warnings));
 $('#gp-warnings').innerHTML=warnings.length?'<details class="gp-assumption-note"><summary>'+esc(warnings[0])+(warnings.length>1?' <small>+'+(warnings.length-1)+' notes</small>':'')+'</summary><ul>'+warnings.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul></details>':'';
 $('#gp-loadouts').innerHTML=['self-contained','unreviewed'].includes(e.kind)?'<div class="gp-empty">'+esc(e.note)+'</div>':'<div class="gp-grid" style="--gp-count:'+result.loadouts.length+'">'+result.loadouts.map((row,i)=>'<article class="gp-card" data-gp-player="'+esc(row.player.key)+'" style="--pc:'+row.player.color+'"><header><span class="gp-number">'+(i+1)+'</span><h3>'+esc(row.player.name)+'</h3></header>'+F.playerHTML(row.player)+'<div class="gp-owned-actions"><button class="gp-player-reset" type="button" data-reset-player="'+esc(row.player.key)+'">Use DPS defaults</button><button type="button" data-add-owned-player="'+esc(row.player.key)+'">Add owned gear</button></div>'+setHTML(row.sets[0],row.player.key)+(row.sets.length>1?'<details class="gp-switch-details"><summary>Phase switches <b>'+(row.sets.length-1)+'</b></summary>'+row.sets.slice(1).map(set=>setHTML(set,row.player.key)).join('')+'</details>':'')+(row.special?'<section class="gp-set gp-special"><h4>Special attack</h4>'+slotHTML('weapon',row.special,row.player.key,'Special attack')+F.specialHTML(row.special)+'</section>':'')+'</article>').join('')+'</div>';
 for(const card of document.querySelectorAll('.gp-card')){if(openSwitches.has(card.dataset.gpPlayer)&&card.querySelector('.gp-switch-details'))card.querySelector('.gp-switch-details').open=true}
 if(focus?.slotpick)[...document.querySelectorAll('[data-slotpick]')].find(n=>n.dataset.player===focus.player&&n.dataset.phase===focus.phase&&n.dataset.slotpick===focus.slotpick)?.focus({preventScroll:true});
 const materials=['Armadyl helmet','Armadyl chestplate','Armadyl chainskirt','Armadylean plate','Crystal armour seed','Enhanced crystal weapon seed','Zenyte shard','Bandos chestplate','Bandos tassets','Bandosian components'];
 $('#gp-ledger-rows').innerHTML=result.ledger.filter(r=>r.used||r.reserved||materials.includes(r.name)&&r.start).map(r=>'<tr><th>'+link(r.name)+'<small>'+esc(r.owner?U.player(r.owner)?.name||r.owner:'Group pool')+(r.assumed?' · assumed':'')+'</small></th><td>'+r.start+'</td><td>'+r.reserved+'</td><td>'+r.used+'</td><td>'+r.left+'</td></tr>').join('')||'<tr><td colspan="5">No group equipment allocated for this encounter.</td></tr>';
 const crafts=result.state.events.filter(ev=>ev.type==='craft'||ev.type==='convert');$('#gp-crafts').innerHTML=crafts.length?'<h4>Planned crafts &amp; dismantles</h4><ul>'+crafts.map(ev=>'<li>'+esc(U.player(ev.player)?.name||ev.player)+': '+(ev.type==='convert'?'dismantle '+ev.donors.map(d=>d.count+' × '+esc(d.item)).join(' + ')+' → '+ev.count+' × '+esc(ev.name):ev.count+' × '+esc(ev.name))+'</li>').join('')+'</ul>':'';
 const q=new URLSearchParams(location.search);q.set('boss',e.id);if($('#gp-method').value!=='auto')q.set('method',$('#gp-method').value);else q.delete('method');history.replaceState(null,'',location.pathname+'?'+q);persist();
}
function stockRows(){
 if(!model)return;const owner=$('#gp-stock-owner').value,term=$('#gp-stock-search').value.trim().toLowerCase(),base=M.stock(model,U.PLAYERS,{craft:false,respectLevels:false}),values=owner==='group'?overrides.group:overrides.personal[owner]||{};
 const rows=Object.values(D.items).filter(i=>i.personal?owner!=='group':owner==='group').filter(i=>(i.name+' '+(i.aliases||[]).join(' ')+' '+Object.keys(i.recipe||{}).join(' ')).toLowerCase().includes(term)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,150);
 $('#gp-stock-rows').innerHTML=rows.map(i=>{const n=owner==='group'?base.input.shared.get(i.name)||0:base.input.personal.get(owner)?.get(i.name)||0;return'<tr><th>'+link(i.name)+(i.recipe?'<small>Craft: '+Object.entries(i.recipe).map(([n,c])=>c+' × '+esc(n)).join(' + ')+'</small>':'')+(i.note?'<small>'+esc(i.note)+'</small>':'')+'</th><td>'+n+'</td><td><input type="number" min="0" max="1000000" step="1" inputmode="numeric" data-stock-item="'+esc(i.name)+'" aria-label="Remaining '+esc(i.name)+'" placeholder="'+n+' (log)" value="'+(Object.hasOwn(values,i.name)?values[i.name]:'')+'"></td></tr>'}).join('')||'<tr><td colspan="3">No matches. Personal capes, armour and quest gear are under each player’s inventory.</td></tr>';
}
const slotDialog=$('#gp-equipment-dialog');
function openPicker(button){
 const key=button.dataset.player,phase=button.dataset.phase,slot=button.dataset.slotpick,row=result.loadouts.find(r=>r.player.key===key),set=row.sets.find(s=>s.label===phase);
 const state=P.availabilityState(model,U.PLAYERS,result,settings(),key),initial=M.stock(model,U.PLAYERS,settings());
 picker={key,phase,slot,state,initial,current:phase==='Special attack'?row.special?.name:set?.slots[slot]?.name,weapon:set?.slots.weapon?.name,result,settings:JSON.parse(JSON.stringify(settings())),previews:new Map()};pickerLimit=60;$('#gp-equipment-filter').value='all';
 $('#gp-equipment-title').textContent=U.player(key).name+' · '+U.nice(slot)+' · '+phase;
 $('#gp-equipment-search').value='';renderPicker();
 if(slotDialog.showModal)slotDialog.showModal();else slotDialog.setAttribute('open','');$('#gp-equipment-search').focus();
}
function renderPicker(){
 if(!picker)return;const term=$('#gp-equipment-search').value.trim().toLowerCase(),filter=$('#gp-equipment-filter').value,rank={stock:0,allocated:1,unavailable:2};
 const rows=P.catalogue.filter(item=>item.slot===picker.slot||picker.slot==='ammo'&&E.usesDarts(picker.weapon||'')&&/ dart$/.test(item.name)).filter(item=>(item.name+' '+(D.items[item.name]?.aliases||[]).join(' ')).toLowerCase().includes(term)).map(item=>({...item,...P.inventoryStatus(picker.state,picker.initial,item.name,picker.key)})).filter(item=>filter==='all'||filter==='stock'&&item.status==='stock'||filter==='acquired'&&item.status!=='unavailable').sort((a,b)=>rank[a.status]-rank[b.status]||a.name.localeCompare(b.name));
 const shown=rows.slice(0,pickerLimit);for(const item of shown)if(!picker.previews.has(item.name)){let preview;try{preview=P.compareItem(picker.result,picker.settings,picker.key,picker.phase,picker.slot,item.name)}catch(error){preview={status:'unavailable',reason:error.message}}picker.previews.set(item.name,preview)}
 const previewHTML=item=>{const r=picker.previews.get(item.name);if(!r||r.status!=='ok')return'<small class="gp-picker-calculation">'+esc(r?.reason||'No combat calculation')+'</small>';const delta=Number.isFinite(r.delta)?' ('+(r.delta>=0?'+':'')+r.delta.toFixed(2)+')':'';return'<small class="gp-picker-calculation"><b>'+r.dps.toFixed(2)+' DPS'+delta+'</b>'+(picker.phase==='Special attack'?' · '+r.expectedDamage.toFixed(1)+' mean / spec':'')+(Number.isFinite(r.cycleDps)?'<br>Damage-only cycle '+r.cycleDps.toFixed(2)+' DPS':'')+'</small>'};
 const statHTML=item=>{const p=E.equipment(item.name,item.id);if(!p)return'';const b=p.bonuses||{},style=picker.previews.get(item.name)?.style?.type,a=p.offensive?.[style]||0,values=[b.str?'Strength '+(b.str>0?'+':'')+b.str:'',b.ranged_str?'Ranged Str '+(b.ranged_str>0?'+':'')+b.ranged_str:'',b.magic_str?'Magic '+(b.magic_str/10)+'%':'',a?U.nice(style)+' '+(a>0?'+':'')+a:'',b.prayer?'Prayer '+(b.prayer>0?'+':'')+b.prayer:''].filter(Boolean);return values.length?'<small>'+esc(values.join(' · '))+'</small>':''};
 $('#gp-equipment-list').innerHTML=shown.map(item=>'<button type="button" role="option" aria-selected="'+(item.name===picker.current)+'" class="gp-picker-item gp-picker-'+item.status+'" data-equipment-choice="'+esc(item.name)+'">'+icon(item.id)+'<span><b>'+esc(item.name)+'</b><small>'+esc(item.label)+(D.items[item.name]?.personal?' · personal item':'')+'</small>'+statHTML(item)+previewHTML(item)+'</span></button>').join('')||'<p>No equipment matches this search.</p>';
 $('#gp-equipment-count').textContent=rows.length+' matching items · '+Math.min(pickerLimit,rows.length)+' shown';$('#gp-equipment-more').hidden=rows.length<=pickerLimit;
 const info=D.items[picker.current];$('#gp-equipment-current').innerHTML=picker.current?'<b>Current: '+esc(picker.current)+'</b>'+(info?.recipe||info?.note?'<details><summary>Recipe &amp; conditions</summary>'+(info?.recipe?'<p>'+Object.entries(info.recipe).map(([n,c])=>c+' × '+esc(n)).join(' + ')+'.</p>':'')+(info?.note?'<p>'+esc(info.note)+'</p>':'')+'</details>':''):'';
}
function closePicker(){if(slotDialog.close)slotDialog.close();else slotDialog.removeAttribute('open');const p=picker;if(p)[...document.querySelectorAll('[data-slotpick]')].find(n=>n.dataset.player===p.key&&n.dataset.phase===p.phase&&n.dataset.slotpick===p.slot)?.focus()}
function selectEquipment(name,automatic=false){
 if(!picker)return;const boss=editKey();edits[boss]||={};edits[boss][picker.key]||={};const locked=edits[boss][picker.key][picker.phase]||={};
 if(automatic)delete locked[picker.slot];else locked[picker.slot]=name;
 if(picker.slot==='weapon'&&name&&D.items[name]?.twoHanded)delete locked.offhand;
 if(picker.slot==='offhand'&&name&&D.items[locked.weapon]?.twoHanded)delete locked.weapon;
 closePicker();persist();run();
}
$('#gp-loadouts').addEventListener('click',ev=>{const button=ev.target.closest('[data-slotpick]');if(button){openPicker(button);return}const add=ev.target.closest('[data-add-owned-player]');if(add){openStock(add.dataset.addOwnedPlayer,'');return}const reset=ev.target.closest('[data-reset-player]');if(reset){delete (edits[editKey()]||{})[reset.dataset.resetPlayer];persist();run()}});
$('#gp-reset-equipment').addEventListener('click',()=>{delete edits[editKey()];persist();run()});
$('#gp-equipment-search').addEventListener('input',()=>{pickerLimit=60;renderPicker()});$('#gp-equipment-filter').addEventListener('change',()=>{pickerLimit=60;renderPicker()});$('#gp-equipment-more').addEventListener('click',()=>{pickerLimit+=60;renderPicker()});
$('#gp-equipment-search').addEventListener('keydown',ev=>{if(ev.key==='ArrowDown'){ev.preventDefault();$('#gp-equipment-list [role=option]')?.focus()}});
$('#gp-equipment-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-equipment-choice]');if(b)selectEquipment(b.dataset.equipmentChoice)});
$('#gp-equipment-list').addEventListener('keydown',ev=>{const options=[...document.querySelectorAll('#gp-equipment-list [role=option]')],i=options.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(ev.key)){ev.preventDefault();options[ev.key==='Home'?0:ev.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,i+(ev.key==='ArrowDown'?1:-1)))]?.focus()}});
$('#gp-equipment-close').addEventListener('click',closePicker);$('#gp-equipment-auto').addEventListener('click',()=>selectEquipment(null,true));$('#gp-equipment-empty').addEventListener('click',()=>selectEquipment(null));
$('#gp-priority').addEventListener('click',ev=>{const b=ev.target.closest('[data-gp-move]');if(!b)return;const active=order.filter(k=>selected.has(k)),i=active.indexOf(b.dataset.player),j=i+Number(b.dataset.gpMove);if(j<0||j>=active.length)return;[active[i],active[j]]=[active[j],active[i]];order=[...active,...order.filter(k=>!selected.has(k))];run();$('#gp-priority [data-player="'+b.dataset.player+'"][data-gp-move="'+b.dataset.gpMove+'"]')?.focus()});
$('#gp-find').addEventListener('input',()=>renderBosses($('#gp-boss').value));$('#gp-boss').addEventListener('change',()=>{$('#gp-method').value='auto';run()});
for(const id of ['method','crafted','baseline','levels','switches','specials'])$('#gp-'+id).addEventListener('change',run);
let stockTrigger=$('#gp-edit');
function openStock(owner,search,trigger){if(owner)$('#gp-stock-owner').value=owner;if(search!==undefined)$('#gp-stock-search').value=search;stockTrigger=trigger||document.activeElement||$('#gp-edit');stockRows();if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');$('#gp-stock-search').focus()}
$('#gp-edit').addEventListener('click',()=>openStock());
$('#gp-add-nonlog').addEventListener('click',()=>openStock([...selected][0],'MA2'));
$('#gp-stock-close').addEventListener('click',()=>{if(dialog.close)dialog.close();else dialog.removeAttribute('open');if(stockTrigger?.isConnected)stockTrigger.focus();else $('#gp-edit').focus()});
$('#gp-stock-shortcuts').addEventListener('click',ev=>{const button=ev.target.closest('[data-stock-quick]');if(!button)return;if($('#gp-stock-owner').value==='group')$('#gp-stock-owner').value=[...selected][0];$('#gp-stock-search').value=button.dataset.stockQuick;stockRows()});
$('#gp-stock-search').addEventListener('input',stockRows);$('#gp-stock-owner').addEventListener('change',stockRows);
$('#gp-stock-rows').addEventListener('change',ev=>{const input=ev.target.closest('[data-stock-item]');if(!input)return;const name=input.dataset.stockItem,owner=$('#gp-stock-owner').value,values=owner==='group'?overrides.group:(overrides.personal[owner]||={});if(input.value==='')delete values[name];else if(M.finite(input.value))values[name]=Number(input.value);else{$('#gp-stock-message').textContent='Enter a whole quantity from 0 to 1,000,000, or leave blank for the log estimate.';return}$('#gp-stock-message').textContent='Stock saved; loadouts updated.';run()});
$('#gp-stock-reset').addEventListener('click',()=>{overrides={group:{},personal:{}};run();stockRows();$('#gp-stock-message').textContent='Stock adjustments cleared; using log estimates.'});
$('#gp-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);$('#gp-copy').textContent='Encounter link copied'}catch{$('#gp-copy').textContent='Use this page’s URL to share the encounter'}});
function renderMembers(){U.renderMemberPicker($('#gp-members'),selected,next=>{selected=U.saveMemberSelection(next);renderMembers();run()},{title:'Players to equip (1–5)',subtitle:'Selected players need their gear at the same time; all five members still supply the pool.',availability:model.known,compact:true})}
function migrateLegacyStock(){for(const item of Object.values(D.items).filter(item=>item.legacyPersonal)){const owners=Object.values(overrides.personal||{}).filter(values=>Object.hasOwn(values,item.name));if(!owners.length)continue;if(!Object.hasOwn(overrides.group,item.name)){const stock=M.stock(model,U.PLAYERS,{overrides,craft:false,respectLevels:false});overrides.group[item.name]=stock.shared.get(item.name)||0}for(const values of owners)delete values[item.name]}}
async function updateLogs(){const doc=await U.loadClog(),previous=$('#gp-boss').value;model=C.build(doc,U.PLAYERS);migrateLegacyStock();const keys=Object.keys((await U.loadWom().catch(()=>null))?.profiles?.[U.ALL_KEYS[0]]?.latestSnapshot?.data?.bosses||{});encounters=M.encounterList(model,keys);renderBosses(previous||params.get('boss')||saved.boss||'tombs_of_amascut');renderMembers()}
async function updateLevels(){const doc=await U.loadWom();levels=Object.fromEntries(U.PLAYERS.map(p=>[p.key,Object.fromEntries(Object.entries(U.snapData(doc,p.key)?.skills||{}).map(([n,v])=>[n,v.level]))]));if(model)run()}
for(const p of U.PLAYERS)$('#gp-stock-owner').add(new Option(p.name+' · personal gear',p.key));
if(['auto','melee','ranged','magic'].includes(params.get('method')))$('#gp-method').value=params.get('method');
U.onDataUpdate(async ev=>{if(ev.detail?.key===U.TKEY){await updateLogs();run()}else if(ev.detail?.key===U.WKEY)await updateLevels()});
window.addEventListener('ug:members-changed',ev=>{const next=new Set(ev.detail?.keys||[]);if(next.size&&!U.sameSelection(next,selected)){selected=next;if(model){renderMembers();run()}}});
window.UGGearPlanner={get result(){return result},get model(){return model},get settings(){return settings()},recalculate:run};
Promise.all([updateLevels(),updateLogs()]).then(run).catch(error=>{$('#gp-status').textContent='Saved gear data could not be loaded: '+error.message});
})();
