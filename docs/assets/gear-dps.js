/* Combat controls and calculation scheduling; uses local saved snapshots only. */
(()=>{
'use strict';
const E=window.UGWikiDps,P=window.UGGearLoadouts,U=window.UGV21;
if(!E||!P||!U||document.body.dataset.page!=='gear-planner')return;
const $=s=>document.querySelector(s),esc=U.escapeHtml,KEY='ug:gear-combat:v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
let defaults={potion:'none',prayer:'none',ammo:'auto',...saved.defaults},players=saved.players||{},bosses=saved.bosses||{},encounter,worker,pending,serial=0;
const options=(list,value,inherit=false)=> (inherit?'<option value="inherit">Use team setting</option>':'')+list.map(([key,label])=>'<option value="'+esc(key)+'"'+(key===value?' selected':'')+'>'+esc(label)+'</option>').join('');
const field=(label,id,html)=>'<label class="gp-field">'+label+html.replace('<select','<select id="'+id+'"')+'</label>';
$('#gp-combat').innerHTML='<div class="gp-combat-heading"><div><h3>DPS &amp; combat settings</h3><p>Each setup uses that player’s saved levels and equipped items.</p></div><button type="button" class="btn" id="gp-reset-equipment">Reset all gear to DPS defaults</button></div><div class="gp-combat-grid">'+field('Potions & boosts','gp-dps-potion','<select>'+options(E.potionOptions,defaults.potion)+'</select>')+field('Offensive prayers','gp-dps-prayer','<select>'+options(E.prayerOptions,defaults.prayer)+'</select>')+field('Ammunition assumption','gp-dps-ammo','<select>'+options(E.ammoOptions,defaults.ammo)+'</select>')+field('Raid encounter','gp-dps-raidRoom','<select><option value="all">Whole raid · automatic targets</option></select>')+field('Target monster / phase','gp-dps-target','<select><option value="auto">Automatic for each setup</option></select>')+'</div><details class="gp-dps-advanced"><summary>Defence reductions &amp; encounter scaling</summary><div class="gp-combat-grid">'+field('Defence curse','gp-dps-curse','<select><option value="none">None</option><option value="vulnerability">Vulnerability</option><option value="accursed">Accursed sceptre</option></select>')+number('Elder maul · landed hits','elderMaul',0,20)+number('Dragon warhammer · landed hits','dwh',0,20)+number('Bandos godsword · total damage','bgs',0,2000)+number('Arclight · landed hits','arclight',0,20)+number('Emberlight · landed hits','emberlight',0,20)+number('Eye of Ayak · magic defence drained','ayak',0,200)+number('Target HP remaining (%)','hpPercent',100,100,1)+field('Party size','gp-dps-partySize','<select><option value="0">Selected players</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+'</option>').join('')+'</select>')+'<label class="gp-field" data-toa-scaling>ToA raid level<input id="gp-dps-invocation" type="number" min="0" max="600" step="5" value="150"></label><label class="gp-field" data-toa-scaling>ToA path level<input id="gp-dps-pathLevel" type="number" min="0" max="6" step="1" value="0"></label></div><p>Enter successful specs already landed, not attempts. The engine applies curse → maul → warhammer → Arclight/Emberlight → BGS, with the monster’s defence floor. These are scenario inputs; reserving a spec weapon does not automatically apply its debuff.</p></details><p class="gp-dps-method-note">DPS assumes continuous attacks and maintained boosts. Missing equipment counts as an empty slot. Ammo, charges, repairs and prayer unlocks are assumptions; combat downtime and movement are excluded. <a href="faq.html#gear-dps">How DPS and availability work ↗</a></p><p id="gp-dps-status" role="status" aria-live="polite"></p>';
function number(label,key,value,max,min=0){return'<label class="gp-field">'+label+'<input id="gp-dps-'+key+'" type="number" min="'+min+'" max="'+max+'" step="1" value="'+value+'"></label>'}
function save(){try{localStorage.setItem(KEY,JSON.stringify({defaults,players,bosses}))}catch{}}
function readContext(){
 const get=id=>$('#gp-dps-'+id)?.value;
 return{raidRoom:get('raidRoom')||'all',target:get('target')||'auto',partySize:Number(get('partySize'))||0,invocation:Number(get('invocation')),pathLevel:Number(get('pathLevel')),hpPercent:Number(get('hpPercent'))||100,reductions:Object.fromEntries(['curse','elderMaul','dwh','bgs','arclight','emberlight','ayak'].map(k=>[k,get(k)]))};
}
function configure(e){
 const changed=encounter?.id!==e.id;encounter=e;$('#gp-combat').hidden=!!e.kind;
 if(!changed)return;
 const c=bosses[e.id]||{},rooms=E.raidRooms(e),room=$('#gp-dps-raidRoom');
 room.closest('label').hidden=!rooms.length;room.innerHTML='<option value="all">Whole raid · automatic targets</option>'+rooms.map(r=>'<option value="'+esc(r.key)+'">'+esc(r.label)+'</option>').join('');
 room.value=rooms.some(r=>r.key===c.raidRoom)?c.raidRoom:'all';configureTargets(c.target);
 for(const key of ['partySize','hpPercent','invocation','pathLevel'])$('#gp-dps-'+key).value=c[key]??({partySize:0,hpPercent:100,invocation:e.id.endsWith('expert')?350:150,pathLevel:0}[key]);
 for(const key of ['curse','elderMaul','dwh','bgs','arclight','emberlight','ayak'])$('#gp-dps-'+key).value=c.reductions?.[key]??(key==='curse'?'none':0);
 for(const node of document.querySelectorAll('[data-toa-scaling]'))node.hidden=!e.id.startsWith('tombs_');
 for(const opt of $('#gp-dps-potion').options)opt.disabled=!E.potionAllowed(opt.value,e);
 if(!E.potionAllowed(defaults.potion,e)){defaults.potion='none';$('#gp-dps-potion').value='none'}
 for(const value of Object.values(players))if(value.potion&&value.potion!=='inherit'&&!E.potionAllowed(value.potion,e))value.potion='inherit';
}
function configureTargets(selected='auto'){const target=$('#gp-dps-target'),items=E.roomTargets(encounter,$('#gp-dps-raidRoom').value);target.innerHTML='<option value="auto">Automatic for each setup</option>'+items.map(t=>'<option value="'+esc(t.key)+'">'+esc(t.label)+'</option>').join('');target.value=items.some(t=>t.key===selected)?selected:'auto';target.disabled=!items.length}
for(const id of ['raidRoom','potion','prayer','ammo','target','partySize','hpPercent','invocation','pathLevel','curse','elderMaul','dwh','bgs','arclight','emberlight','ayak'])$('#gp-dps-'+id).addEventListener('change',()=>{
 if(id==='raidRoom')configureTargets();
 if(['potion','prayer','ammo'].includes(id))defaults[id]=$('#gp-dps-'+id).value;
 if(encounter)bosses[encounter.id]=readContext();save();window.UGGearPlanner?.recalculate();
});
document.addEventListener('change',ev=>{const input=ev.target.closest('[data-player-combat]');if(!input)return;const key=input.dataset.player,field=input.dataset.playerCombat;players[key]||={};players[key][field]=input.type==='checkbox'?input.checked:input.value;save();window.UGGearPlanner?.recalculate()});
function settings(){return{defaults:{...defaults},players,context:readContext()}}
function playerHTML(player){
 const value=players[player.key]||{},select=(key,label,list)=>'<label class="gp-field">'+label+'<select data-player-combat="'+key+'" data-player="'+esc(player.key)+'">'+options(list,value[key]||'inherit',true)+'</select></label>';
 return'<details class="gp-player-combat"><summary>Player combat options</summary><div>'+select('potion','Boosts',E.potionOptions.filter(([key])=>!encounter||E.potionAllowed(key,encounter)))+select('prayer','Prayers',E.prayerOptions)+select('ammo','Ammo',E.ammoOptions)+select('spell','Spell',E.spellOptions)+select('style','Melee style',[['auto','Best available attack style'],['stab','Stab'],['slash','Slash'],['crush','Crush']])+'<label class="gp-field">Soulreaper stacks<input type="number" min="0" max="5" value="'+(Number(value.stacks)||0)+'" data-player-combat="stacks" data-player="'+esc(player.key)+'"></label><label><input type="checkbox" data-player-combat="markOfDarkness" data-player="'+esc(player.key)+'"'+(value.markOfDarkness?' checked':'')+'> Mark of Darkness</label><label><input type="checkbox" data-player-combat="kandarin" data-player="'+esc(player.key)+'"'+(value.kandarin?' checked':'')+'> Kandarin hard diary</label></div></details>';
}
function resultHTML(set){
 const r=set.dps;
 if(!r||r.status!=='ok')return'<div class="gp-dps-result gp-dps-unknown"><b>DPS unavailable</b><p>'+esc(r?.reason||'No standard combat calculation for this setup.')+'</p></div>';
 return'<div class="gp-dps-result" data-dps="'+r.dps+'">'+(set.hypothetical?'<strong class="gp-hypothetical">Hypothetical · gear unavailable</strong>':'')+'<div class="gp-dps-numbers"><div><b>'+r.dps.toFixed(2)+'</b><span>DPS</span></div><div><b>'+r.maxHit+'</b><span>Max / attack</span></div><div><b>'+(r.accuracy*100).toFixed(1)+'%</b><span>Accuracy</span></div></div><p class="gp-dps-target">'+esc(r.target)+'</p><details class="gp-dps-evidence"><summary>Calculation details</summary><p>'+esc(r.style.type+' · '+r.style.stance)+' · '+r.attackTicks.toFixed(2).replace(/\.00$/,'')+' ticks ('+(r.attackTicks*.6).toFixed(2)+'s)</p><p>Mean damage per attack: '+r.expectedDamage.toFixed(3)+'. DPS = mean damage ÷ '+(r.attackTicks*.6).toFixed(3)+' seconds.</p><p>Target Defence '+r.defence+' (base '+r.baseDefence+', floor '+r.defenceFloor+'); Magic '+r.magic+'.</p><p>Equipment Prayer bonus: +'+r.bonuses.prayer+'.</p><p>Prayers: '+esc(r.prayers.join(' + ')||'None')+'.<br>Boosts: '+esc(r.potions.join(' + ')||'None')+'.</p><p>Levels: '+Object.entries(r.skills).map(([k,n])=>esc(k)+' '+n+(r.boosts[k]?' + '+r.boosts[k]:'')).join(' · ')+'.</p>'+(r.notes.length?'<ul>'+r.notes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>':'')+'</details></div>';
}
function plan(model,players,e,s){
 configure(e);s.combat=settings();
 if(typeof Worker!=='function')return P.plan(model,players,e,s);
 if(worker){worker.terminate();pending?.(null)}
 const id=++serial;$('#gp-dps-status').textContent='Calculating DPS and assigning available equipment…';
 return new Promise((resolve,reject)=>{
  pending=resolve;
  try{worker=new Worker(new URL('assets/gear-dps-worker.js?v=3',document.baseURI));worker.onmessage=ev=>{if(ev.data.id!==id)return;worker.terminate();worker=null;pending=null;$('#gp-dps-status').textContent='';if(ev.data.error)reject(new Error(ev.data.error));else resolve(ev.data.result)};worker.onerror=()=>{worker.terminate();worker=null;pending=null;try{resolve(P.plan(model,players,e,s))}catch(error){reject(error)}};worker.postMessage({id,model,players,encounter:e,settings:s})}catch(error){worker=null;resolve(P.plan(model,players,e,s))}
 });
}
window.UGGearDpsUI={configure,settings,playerHTML,resultHTML,plan};
})();
