/* Finite inventory allocation and DPS-driven equipment choices. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./gear-planner-data'),require('./gear-planner-model'),require('./gear-dps-engine'));else root.UGGearLoadouts=factory(root.UGGearData,root.UGGearModel,root.UGWikiDps)})(typeof window==='object'?window:this,function(D,M,E){
'use strict';
const catalogue=E.catalog(D),slots=['head','cape','neck','ammo','weapon','body','offhand','legs','hands','feet','ring'],armour=['head','body','legs','neck','cape','hands','feet','ring','offhand','ammo'];
const materialNames=new Set(Object.values(D.items).flatMap(item=>[...Object.keys(item.recipe||{}),...(item.conversions||[]).map(donor=>donor.item)]));
for(const name of materialNames)if(D.items[name])D.items[name].craftingMaterial=true;
for(const item of catalogue)D.items[item.name].equipmentSlot=item.slot;
const bySlot=new Map(slots.map(slot=>[slot,catalogue.filter(item=>item.slot===slot)]));
const empty=()=>({name:null,source:'missing',options:[]});
function modifiers(settings,key){const c=settings.combat||{};return{potion:'none',prayer:'none',ammo:'auto',spell:'auto',style:'auto',...c.defaults,...Object.fromEntries(Object.entries(c.players?.[key]||{}).filter(([,v])=>v!=='inherit'))}}
function context(settings){return{...settings.combat?.context,partySize:settings.combat?.context?.partySize||settings.selected?.length||1,partyLevels:settings.combat?.context?.partyLevels||(settings.selected||[]).map(key=>settings.levels?.[key]||{}),onTask:settings.onTask}}
function scoreSettings(settings){return JSON.stringify([settings.levels,settings.combat,settings.onTask])}
function available(s,name,key){return s.held.get(key)?.has(name)||((D.items[name]?.personal?s.personal.get(key)?.get(name):s.shared.get(name))||0)>0||s.assumed.has(key+'|'+name)||D.items[name]?.recipe}
function options(s,slot,key,style,preset=[]){
 const names=[...new Set([...preset,...(bySlot.get(slot)||[]).map(i=>i.name)])];
 return names.filter(name=>D.items[name]&&available(s,name,key)&&M.eligible(s,name,key)&&(slot!=='weapon'||E.weaponStyle(name)===style)&&(slot!=='ammo'||E.isBlessing(name))).filter(name=>!!M.probe(s,name,key));
}
function inventoryStatus(s,initial,name,key){
 if(!name)return{status:'empty',label:'Empty slot'};
 if(M.probe(s,name,key))return{status:'stock',label:'In stock'};
 const owned=(s.totals.get(name)||0)>0||[...s.held.values()].some(items=>items.has(name))||initial?.shared.get(name)>0||initial?.personal.get(key)?.get(name)>0;
 if(owned||initial&&M.probe({...initial,settings:{...initial.settings,respectLevels:false}},name,key))return{status:'allocated',label:M.eligible(s,name,key)?'Acquired · out of stock':'Acquired · level/owner restriction'};
 return{status:'unavailable',label:'Not available'};
}
function build(base,key,names,locked={}){
 const state=M.clone(base),out={};
 for(const slot of ['weapon',...slots.filter(k=>k!=='weapon')]){
  const name=names[slot];
  if(slot==='offhand'&&D.items[out.weapon?.name]?.twoHanded){out[slot]={name:null,source:'two-handed',options:[]};continue}
  if(!name){out[slot]={...empty(),locked:Object.hasOwn(locked,slot)};continue}
  const item=M.equip(state,name,key);
  if(!item){
   if(!Object.hasOwn(locked,slot))return null;
   const original={...M.clone(base),shared:new Map(base.input.shared),personal:new Map([...base.input.personal].map(([k,v])=>[k,new Map(v)])),held:new Map(base.players.map(p=>[p.key,new Map()])),settings:{...base.settings,respectLevels:false}};
   const owned=(base.totals.get(name)||0)>0||base.input.shared.get(name)>0||base.input.personal.get(key)?.get(name)>0||!!M.equip(original,name,key);
   out[slot]={name,id:D.items[name]?.id,source:owned?'contended':'unavailable',hypothetical:true,locked:true,options:[],requirement:!M.eligible(base,name,key)};
  }else out[slot]={...item,locked:Object.hasOwn(locked,slot),options:[]};
 }
 return{state,slots:out};
}
const crystalNames=['Crystal helm','Crystal body','Crystal legs'],crystalSlots=['head','body','legs'];
const bundles=[...Array.from({length:7},(_,i)=>Object.fromEntries(crystalSlots.map((slot,j)=>[slot,(i+1)&(1<<j)?crystalNames[j]:null]))),{head:"Inquisitor's great helm",body:"Inquisitor's hauberk",legs:"Inquisitor's plateskirt"},{head:'Blood moon helm',body:'Blood moon chestplate',legs:'Blood moon tassets'},{head:'Void ranger helm',body:'Elite void top',legs:'Elite void robe',hands:'Void knight gloves'},{head:'Void ranger helm',body:'Void knight top',legs:'Void knight robe',hands:'Void knight gloves'},{head:'Obsidian helmet',body:'Obsidian platebody',legs:'Obsidian platelegs',neck:'Berserker necklace'}];
function quality(result){
 const r=result.dps||{},b=r.bonuses||{},a=r.offensive||{},d=r.defensive||{},style=result.set?.style,atlatl=result.set?.slots.weapon?.name==='Eclipse atlatl';
 return style==='magic'?[b.magic_str||0,a.magic||0,b.prayer||0,Object.values(d).reduce((n,v)=>n+v,0)]:style==='ranged'?[atlatl?b.str||0:b.ranged_str||0,a.ranged||0,b.prayer||0,Object.values(d).reduce((n,v)=>n+v,0)]:[b.str||0,(a.stab||0)+(a.slash||0)+(a.crush||0),b.prayer||0,Object.values(d).reduce((n,v)=>n+v,0)];
}
function better(candidate,current){
 if(!current)return true;
 if(Math.abs(candidate.value-current.value)>1e-9)return candidate.value>current.value;
 const a=quality(candidate),b=quality(current);for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]>b[i];return false;
}
function optimise(base,key,player,e,role,main,settings,locked,cache){
 if(role.weaponOnly)locked={...Object.fromEntries(Object.entries(main?.slots||{}).filter(([slot,item])=>slot!=='weapon'&&slot!=='ammo'&&item.hypothetical).map(([slot,item])=>[slot,item.name])),...locked};
 const styles=[...new Set(role.routes.map(r=>r.style))].filter(style=>!settings.method||settings.method==='auto'||role.label!=='Main setup'||settings.method===style);
 const manualWeapon=Object.hasOwn(locked,'weapon'),weapons=manualWeapon?[locked.weapon]:[...new Set(styles.flatMap(style=>options(base,'weapon',key,style,role.routes.filter(r=>r.style===style).flatMap(r=>r.weapons))))];
 if(!manualWeapon&&role.label==='Prayer shield'){const allowed=new Set(role.routes.flatMap(r=>r.weapons));for(let i=weapons.length-1;i>=0;i--)if(!allowed.has(weapons[i]))weapons.splice(i,1)}
 if(!weapons.length)weapons.push(null);
 const gearCache=new Map(),rawGearCache=new Map();
 const gearFor=(style,weapon)=>{
  const cacheKey=style+'|'+weapon;if(gearCache.has(cacheKey))return gearCache.get(cacheKey);
  if(!rawGearCache.has(style))rawGearCache.set(style,Object.fromEntries(armour.map(slot=>[slot,options(base,slot,key,style,D.gear[style]?.[slot]||[])])));
  const types=E.weaponAttackTypes(weapon||''),atlatl=weapon==='Eclipse atlatl';
  const relevant=name=>/void|salve|slayer|black mask/i.test(name)
   ||style==='magic'&&(/virtus|confliction|tome of/i.test(name)||/Ahrim/i.test(weapon)&&/Ahrim|damned/i.test(name)||/Blue Moon spear/i.test(weapon)&&/Blue moon/i.test(name))
   ||style==='ranged'&&(/Dizana/i.test(name)||/faerdhinen|Crystal bow/i.test(weapon)&&/Crystal/i.test(name)||atlatl&&/Eclipse moon/i.test(name)||/Karil/i.test(weapon)&&/Karil|damned/i.test(name))
   ||style==='melee'&&(types.includes('crush')&&/Inquisitor/i.test(name)||weapon==='Dual macuahuitl'&&/Blood moon/i.test(name)||/Toktz|Tzhaar/i.test(weapon)&&/obsidian|berserker necklace/i.test(name)||/Dharok|Verac|Torag|Guthan/i.test(weapon)&&/Dharok|Verac|Torag|Guthan|damned/i.test(name));
  const gear=Object.fromEntries(armour.map(slot=>{
   const capes=Object.hasOwn(locked,'cape')?[locked.cape]:role.weaponOnly?[main?.slots.cape?.name]:rawGearCache.get(style).cape;const names=slot==='ammo'&&!E.ammoSlotFree(weapon)&&!capes.some(cape=>E.ammoSlotFree(weapon,cape))?[]:rawGearCache.get(style)[slot];if(/Dinh/i.test(weapon))return[slot,names];
   const stats=new Map(names.map(name=>{const i=E.equipment(name),b=i?.bonuses||{},a=i?.offensive||{};return[name,style==='magic'?[a.magic||0,b.magic_str||0,b.prayer||0]:style==='ranged'?[a.ranged||0,atlatl?b.str||0:b.ranged_str||0,b.prayer||0]:[...types.map(type=>a[type]||0),b.str||0,b.prayer||0]]}));
   return[slot,names.filter(name=>relevant(name)||!names.some(other=>{if(name===other)return false;const a=stats.get(other),b=stats.get(name);return a.every((n,j)=>n>=b[j])&&a.some((n,j)=>n>b[j])}))];
  }));gearCache.set(cacheKey,gear);return gear;
 };
 // Compare every feasible weapon in a common, legal starting setup, then refine
 // the leaders and weapons whose full-set effects can overturn that ordering.
 let shortlist=weapons;
 if(!manualWeapon&&weapons.length>6){
  const ranked=weapons.map(weapon=>{
   const style=E.weaponStyle(weapon),gear=gearFor(style,weapon),names={...(role.weaponOnly?Object.fromEntries(Object.entries(main?.slots||{}).filter(([k])=>k!=='ammo').map(([k,v])=>[k,v.name])):{}),weapon,...locked};
   let layout=build(base,key,names,locked);if(!layout)return{weapon,style,value:-1};
   for(const slot of armour)if((!role.weaponOnly||slot==='ammo')&&!Object.hasOwn(locked,slot)&&!(slot==='offhand'&&D.items[weapon]?.twoHanded))for(const name of gear[slot]){const item=M.equip(layout.state,name,key);if(item){names[slot]=name;layout.slots[slot]=item;break}}
   const set={label:role.label,style,weaponOnly:!!role.weaponOnly,slots:layout.slots};let value=-1;
   try{const calc=E.calculateSet({encounter:e,row:{player,sets:role.weaponOnly?[main,set]:[set]},setIndex:role.weaponOnly?1:0,levels:settings.levels?.[key]||{},context:context(settings),modifiers:modifiers(settings,key)});if(calc.status==='ok')value=calc.dps}catch{}
   return{weapon,style,value};
  });
  shortlist=[...new Set([...styles.flatMap(style=>ranked.filter(r=>r.style===style).sort((a,b)=>b.value-a.value).slice(0,3).map(r=>r.weapon)),...weapons.filter(n=>/faerdhinen|Dual macuahuitl|Inquisitor.s mace|Scythe of vitur|Obsidian/i.test(n))])];
 }
 let best=null;
 for(const weapon of shortlist){
  if(locked.offhand&&D.items[weapon]?.twoHanded)continue;
  const style=weapon?E.weaponStyle(weapon):styles[0]||'melee';
  const candidates=gearFor(style,weapon);
  const initial={...(role.weaponOnly?Object.fromEntries(Object.entries(main?.slots||{}).filter(([k])=>k!=='ammo').map(([k,v])=>[k,v.name])):{}),weapon,...locked};
  for(const slot of armour)if((!role.weaponOnly||slot==='ammo')&&!Object.hasOwn(initial,slot))initial[slot]=candidates[slot][0]||null;
  let current=build(base,key,initial,locked);
  // Scarce shared ingredients can make individually feasible first choices conflict.
  if(!current){for(const slot of armour)if(!Object.hasOwn(locked,slot))initial[slot]=null;current=build(base,key,initial,locked)}
  if(!current)continue;
  const evaluate=plan=>{
   const names=slots.map(slot=>plan.slots[slot]?.name||'').join('|'),id=key+'|'+role.label+'|'+style+'|'+names;
   if(cache.has(id)){const dps=cache.get(id);return{...plan,set:{label:role.label,style,weaponOnly:!!role.weaponOnly,slots:plan.slots},dps,value:dps.status==='ok'?dps.dps:-1}}
   const set={label:role.label,style,weaponOnly:!!role.weaponOnly,slots:plan.slots};
   const row={player,sets:role.weaponOnly?[main,set]:[set]};
   let dps;try{dps=E.calculateSet({encounter:e,row,setIndex:role.weaponOnly?1:0,levels:settings.levels?.[key]||{},context:context(settings),modifiers:modifiers(settings,key)})}catch(error){dps={status:'unavailable',reason:'Combat calculation unavailable: '+error.message}}
   const evaluated={...plan,set,dps,value:dps.status==='ok'?dps.dps:-1};cache.set(id,dps);return evaluated;
  };
  let currentResult=evaluate(current);
  const seeds=[initial];
  if(!role.weaponOnly)for(const bundle of bundles){if(Object.entries(bundle).every(([slot,name])=>Object.hasOwn(locked,slot)?!name||locked[slot]===name:!name||candidates[slot].includes(name)))seeds.push({...initial,...bundle,...locked})}
  // Each candidate is reserved from the same base state. Replacements release
  // their previous ingredients instead of leaving invisible spent components.
  for(const seed of seeds){
   let trial=build(base,key,seed,locked);if(!trial)continue;
   let evaluated=evaluate(trial),names={...seed};
   if(!role.weaponOnly)for(let pass=0;pass<2;pass++){
    let changed=false;
    for(const slot of armour){
     if(Object.hasOwn(locked,slot)||slot==='offhand'&&D.items[weapon]?.twoHanded)continue;
     for(const name of [null,...candidates[slot]]){
      if(name===names[slot])continue;
      const preview=evaluate({slots:{...evaluated.set.slots,[slot]:name?{name,id:D.items[name]?.id}:empty()}});
      if(!better(preview,evaluated))continue;
      const possible=build(base,key,{...names,[slot]:name},locked);if(!possible)continue;
      const next=evaluate(possible);
      if(better(next,evaluated)){names[slot]=name;evaluated=next;changed=true}
     }
    }
    if(!changed)break;
   }
   if(better(evaluated,currentResult))currentResult=evaluated;
  }
  if(better(currentResult,best))best=currentResult;
 }
 if(!best){const set={label:role.label,style:styles[0]||'melee',slots:Object.fromEntries(slots.map(k=>[k,empty()])),dps:{status:'unavailable',reason:'No compatible equipment is available.'}};return{state:base,set,dps:set.dps}}
 best.set.dps=best.dps;
 const ammoName=best.dps.ammo||(best.set.style==='ranged'&&best.set.slots.weapon?.name?E.ammunitionFor(best.set.slots.weapon.name,modifiers(settings,key).ammo||'auto',role.label):'');
 if(ammoName&&!E.usesDarts(best.set.slots.weapon?.name||'')&&!best.set.slots.ammo?.name)best.set.slots.ammo={name:ammoName,id:E.equipment(ammoName)?.id,source:'assumed',ammoAssumption:true,options:[]};
 best.set.hypothetical=Object.values(best.set.slots).some(v=>v.hypothetical);
 return best;
}
function ledger(s){const out=[];for(const [name,start]of s.input.shared){const used=s.spent.get('g|'+name)||0,reserved=s.reserved.get('g|'+name)||0,left=s.shared.get(name)||0;if(start||used||left)out.push({name,owner:null,start,used:used-reserved,reserved,left})}for(const p of s.players)for(const [name,start]of s.input.personal.get(p.key)||[]){const used=s.spent.get('p|'+p.key+'|'+name)||0,reserved=s.reserved.get('p|'+p.key+'|'+name)||0;if(start||used)out.push({name,owner:p.key,start,used:used-reserved,reserved,left:s.personal.get(p.key).get(name)||0,assumed:s.assumed.has(p.key+'|'+name)})}for(const [name,left]of s.shared)if(left&&!out.some(r=>r.name===name&&!r.owner))out.push({name,owner:null,start:0,used:0,reserved:0,left});return out}
function allocate(model,players,e,settings={},startingState=null){
 const room=E.raidRoom(e,settings.combat?.context?.raidRoom);
 if(room?.styles.length){
  let styles=room.styles;
  const target=E.roomTargets(e,room.key).find(t=>t.key===settings.combat?.context?.target);
  if(room.key==='olm'&&target)styles=[target.id===7550?'magic':target.id===7551?'ranged':'melee'];
  if(room.key==='vanguards'&&target)styles=[target.version==='Magic'?'ranged':target.version==='Melee'?'magic':'melee'];
  if(room.key==='vasa'&&target)styles=[target.name==='Glowing crystal'?'melee':'ranged'];
  const routes=styles.map(style=>({style,weapons:[]}));
  e={...e,roles:[{label:'Main setup',routes}],switches:styles.length>1?styles.map(style=>({label:room.label+' · '+style,routes:[{style,weapons:[]}]})):[]};
 }
 if(e.kind){
  const result=M.plan(model,players,e,settings);if(e.kind!=='skilling')return result;
  const state=startingState||M.stock(model,players,settings);
  for(const row of result.loadouts){const key=row.player.key,set=row.sets[0],locked=settings.edits?.[key]?.[set.label]||{},next={};
   for(const slot of ['weapon',...slots.filter(s=>s!=='weapon')]){
    if(slot==='offhand'&&D.items[next.weapon?.name]?.twoHanded){next[slot]={name:null,source:'two-handed'};continue}
    if(Object.hasOwn(locked,slot)){const chosen=build(state,key,{[slot]:locked[slot]},{[slot]:locked[slot]});next[slot]=chosen.slots[slot];M.adopt(state,chosen.state)}
    else{next[slot]=empty();for(const name of e.toolSlots[slot]||[]){const item=M.equip(state,name,key);if(item){next[slot]=item;break}}}
   }
   set.slots=next;set.hypothetical=Object.values(next).some(item=>item.hypothetical);set.dps={status:'unavailable',reason:'This is a skilling setup, not a standard combat DPS target.'};
  }
  result.state=state;result.ledger=ledger(state);return result;
 }
 const chosen=settings.selected||players.map(p=>p.key),order=[...new Set([...(settings.order||[]),...chosen])].filter(k=>chosen.includes(k));
 if(!order.length||order.length>5)throw new RangeError('Choose 1–5 players');
 const s=startingState||M.stock(model,players,settings),cache=new Map(),loadouts=[];
 for(const key of order){
  const player=players.find(p=>p.key===key),row={player,sets:[],special:null},edits=settings.edits?.[key]||{};
  const first=optimise(s,key,player,e,{...e.roles[0],label:e.roles[0].label||'Main setup'},null,settings,edits[e.roles[0].label||'Main setup']||{},cache);M.adopt(s,first.state);row.sets.push(first.set);loadouts.push(row);cache.clear();
 }
 for(const row of loadouts){const key=row.player.key,edits=settings.edits?.[key]||{},first=row.sets[0];
  if(settings.switches!==false)for(const role of e.switches||[]){if(role.unlessWeapon&&first.slots.weapon?.name===role.unlessWeapon)continue;const next=optimise(s,key,row.player,e,role,first,settings,edits[role.label]||{},cache);M.adopt(s,next.state);row.sets.push(next.set);cache.clear()}
 }
 for(const row of loadouts){const key=row.player.key,edits=settings.edits?.[key]||{};
  if(settings.specials!==false){const locked=edits['Special attack'];const names=locked&&Object.hasOwn(locked,'weapon')?[locked.weapon]:e.spec||[];for(const name of names){if(!name)break;const item=M.equip(s,name,key);if(item){row.special=item;break}if(locked){const status=inventoryStatus(s,null,name,key);row.special={name,id:D.items[name]?.id,source:status.status==='allocated'?'contended':'unavailable',hypothetical:true};break}}}
 }

 if(room?.reason)for(const row of loadouts)for(const set of row.sets)set.dps={status:'unavailable',reason:room.reason};
 return{encounter:e,loadouts,state:s,ledger:ledger(s),missing:loadouts.reduce((n,r)=>n+r.sets.reduce((a,t)=>a+Object.values(t.slots).filter(v=>v.source==='missing').length,0),0),optimised:true};
}
function replayOtherPlayers(model,players,rows,settings,exclude){
 const state=M.stock(model,players,{...settings,reserveOwners:false});
 for(const row of rows)if(row.player.key!==exclude){
  for(const set of row.sets)for(const item of Object.values(set.slots))if(item.name&&!item.hypothetical&&!item.ammoAssumption&&!M.equip(state,item.name,row.player.key))return null;
  if(row.special?.name&&!row.special.hypothetical&&!M.equip(state,row.special.name,row.player.key))return null;
 }
 return state;
}
function improvesRow(next,current){
 for(let i=0;i<Math.max(next.sets.length,current.sets.length);i++){
  const a=next.sets[i],b=current.sets[i];if(!a||!b)continue;
  const value=set=>({set,dps:set.dps,value:set.dps?.status==='ok'?set.dps.dps:-1});
  if(better(value(a),value(b)))return true;if(better(value(b),value(a)))return false;
 }
 const gaps=row=>row.sets.reduce((sum,set)=>sum+Object.values(set.slots).filter(item=>item.source==='missing'||item.hypothetical).length,0);
 return gaps(next)<gaps(current);
}
function plan(model,players,e,settings={}){
 const chosen=settings.selected||players.map(p=>p.key);
 if(settings.ownerPriority===false||chosen.length<2||e.kind&&e.kind!=='skilling')return allocate(model,players,e,settings);
 // First allocate each selected owner's logged items and ingredients. These
 // claims cover switches as well as main gear; an earlier non-owner cannot
 // consume the last copy or dismantle another owner's reserved armour.
 const result=allocate(model,players,e,{...settings,reserveOwners:true});result.state.claims.clear();
 const sharedContext=context(settings),borrowSettings={...settings,reserveOwners:false,combat:{...settings.combat,context:sharedContext}};
 // Rebuild one complete player's reservations at a time, retaining everyone
 // else's physical equipment. Unused owned gear and duplicate copies can now
 // be borrowed without displacing an owner’s equipped items.
  for(let i=0;i<result.loadouts.length;i++){
   const row=result.loadouts[i],state=replayOtherPlayers(model,players,result.loadouts,borrowSettings,row.player.key);if(!state)continue;
   const next=allocate(model,players,e,{...borrowSettings,selected:[row.player.key],order:[row.player.key]},state),candidate=next.loadouts[0];
   if(improvesRow(candidate,row)){result.loadouts[i]=candidate;result.state=next.state}
  }
 result.state.claims.clear();
 // Replayed crafts may choose different donor pieces. Show the concrete inputs
 // from the final ledger rather than stale material lists from the first pass.
 for(const row of result.loadouts){const seen=new Set();for(const set of row.sets)for(const item of Object.values(set.slots))if(item.name&&!item.hypothetical&&!item.ammoAssumption){const held=result.state.held.get(row.player.key)?.get(item.name);if(held){Object.assign(item,held,{source:seen.has(item.name)?'reused':held.source});seen.add(item.name)}}}
 result.ledger=ledger(result.state);result.ownerPriority=true;
 result.missing=result.loadouts.reduce((n,row)=>n+row.sets.reduce((sum,set)=>sum+Object.values(set.slots).filter(item=>item.source==='missing').length,0),0);
 return result;
}
function availabilityState(model,players,result,settings,key){const s=M.stock(model,players,settings);for(const row of result.loadouts)if(row.player.key!==key){for(const set of row.sets)for(const item of Object.values(set.slots))if(item.name&&!item.hypothetical&&!item.ammoAssumption)M.equip(s,item.name,row.player.key);if(row.special?.name&&!row.special.hypothetical)M.equip(s,row.special.name,row.player.key)}return s}
return{plan,catalogue,slots,modifiers,context,inventoryStatus,availabilityState};
});
