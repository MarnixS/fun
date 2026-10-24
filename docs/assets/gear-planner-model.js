(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./gear-planner-data'));else root.UGGearModel=factory(root.UGGearData)})(typeof window==='object'?window:this,function(D){
'use strict';
const finite=n=>Number.isSafeInteger(Number(n))&&Number(n)>=0&&Number(n)<=1000000;
const copyMap=m=>new Map([...m].map(([key,value])=>[key,value instanceof Map?new Map(value):value]));
function clone(s){return{...s,shared:new Map(s.shared),personal:copyMap(s.personal),held:copyMap(s.held),spent:new Map(s.spent),events:[...s.events],warnings:[...s.warnings]}}
function adopt(s,t){for(const key of ['shared','personal','held','spent','events','warnings'])s[key]=t[key]}
const resourceKey=(name,owner)=>owner?'p|'+owner+'|'+name:'g|'+name;
function quantity(s,name,owner){return(owner?s.personal.get(owner):s.shared)?.get(name)||0}
function debit(s,name,count,owner,player){const map=owner?s.personal.get(owner):s.shared;map.set(name,(map.get(name)||0)-count);const key=resourceKey(name,owner);s.spent.set(key,(s.spent.get(key)||0)+count);s.events.push({type:'consume',name,count,owner,player})}
function manual(s,name,owner){return Object.hasOwn(owner?s.overrides.personal?.[owner]||{}:s.overrides.group||{},name)}
function remainingDonors(s,item,need,existing){
 // Bounded knapsack: minimum waste, then fewest dismantled items. Never consume
 // an allocated item, or reinterpret an explicit remaining-bank override as spent.
 const donors=item.conversions.filter(d=>!existing||!manual(s,d.item));
 const maxYield=Math.max(0,...donors.map(d=>d.yield)),limit=need+maxYield;
 let plans=new Map([[0,{count:0,take:[]}]]);
 for(const donor of donors){const next=new Map(plans),max=Math.min(quantity(s,donor.item),Math.ceil(limit/donor.yield));
  for(const [value,plan] of plans)for(let count=1;count<=max;count++){
   const total=value+count*donor.yield;if(total>limit)break;
   const candidate={count:plan.count+count,take:[...plan.take,{...donor,count}]},prior=next.get(total);
   if(!prior||candidate.count<prior.count)next.set(total,candidate);
  }plans=next;
 }
 return [...plans].filter(([value])=>value>=need).sort((a,b)=>a[0]-b[0]||a[1].count-b[1].count)[0]||null;
}
function spend(s,name,count,owner,player,stack=new Set(),existing=false,otherPersonal=false){
 if(!count)return true;
 if(existing&&manual(s,name,owner))return true;
 const item=D.items[name]||{name},personal=!!item.personal||s.assumed.has(player+'|'+name)&&quantity(s,name,player)>0;
 if(personal&&!owner)owner=player;
 if(personal&&otherPersonal){
  for(const key of [player,...s.players.map(p=>p.key).filter(k=>k!==player)]){const trial=clone(s);if(spend(trial,name,count,key,player,stack,existing,false)){adopt(s,trial);return true}}
  return false;
 }
 const have=quantity(s,name,personal?owner:null),direct=Math.min(have,count);
 if(direct)debit(s,name,direct,personal?owner:null,player);
 const missing=count-direct;if(!missing)return true;
 const cycle=(personal?owner+'|':'')+name;if(stack.has(cycle))return false;
 const next=new Set(stack).add(cycle);
 if(item.conversions){
  const plan=remainingDonors(s,item,missing,existing);if(!plan)return false;
  for(const donor of plan[1].take)debit(s,donor.item,donor.count,null,player);
  s.shared.set(name,(s.shared.get(name)||0)+plan[0]-missing);
  s.events.push({type:'convert',name,count:plan[0],player,donors:plan[1].take});return true;
 }
 if(!item.recipe||!s.settings.craft&&!existing)return false;
 if(item.sameCrafter){
  let crafted=false;for(const crafter of s.players){const trial=clone(s);let valid=true;for(const [ingredient,amount] of Object.entries(item.recipe))if(!spend(trial,ingredient,amount*missing,D.items[ingredient]?.personal?crafter.key:null,player,next,existing,false)){valid=false;break}if(valid){adopt(s,trial);crafted=true;break}}
  if(!crafted)return false;
 }else for(const [ingredient,amount] of Object.entries(item.recipe))if(!spend(s,ingredient,amount*missing,D.items[ingredient]?.personal?owner:null,player,next,existing,!personal&&!!D.items[ingredient]?.personal))return false;
 s.events.push({type:'craft',name,count:missing,player});return true;
}
function stock(model,players,settings={}){
 const overrides=settings.overrides||{},ids=new Map(),totals=new Map(),personal=new Map(players.map(p=>[p.key,new Map()])),shared=new Map();
 const names=new Map([...model.names].map(([id,name])=>[id,D.normalise(name)]));
 for(const item of Object.values(D.items)){
  const aliases=new Set([item.name,...item.aliases||[]].map(D.normalise)),matches=[...names].filter(([,name])=>aliases.has(name)).map(([id])=>id);
  ids.set(item.name,matches[0]||item.id||null);
  let total=0;
  for(const p of players){const counts=matches.map(id=>model.known.has(p.key)?model.counts.get(p.key)?.get(id)||0:0),count=item.sumAliases?counts.reduce((a,b)=>a+b,0):Math.max(0,...counts);total+=count;if(item.personal)personal.get(p.key).set(item.name,count)}
  totals.set(item.name,total);if(!item.personal)shared.set(item.name,total);
 }
 for(const [name,value] of Object.entries(overrides.group||{}))if(D.items[name]&&!D.items[name].personal&&finite(value))shared.set(name,Number(value));
 for(const p of players)for(const [name,value] of Object.entries(overrides.personal?.[p.key]||{}))if(D.items[name]?.personal&&finite(value))personal.get(p.key).set(name,Number(value));
 // Opt-in baseline represents one standard quest/shop item per account. Never
 // infer capes, raid rewards, void, endgame boots or a personal drop from a teammate.
 const assumed=new Set();
 if(settings.baseline)for(const p of players)for(const item of Object.values(D.items))if(item.baseline&&!Object.hasOwn(overrides.group||{},item.name)&&!Object.hasOwn(overrides.personal?.[p.key]||{},item.name)){const key=p.key+'|'+item.name;if(!quantity({personal},item.name,p.key)){personal.get(p.key).set(item.name,1);assumed.add(key)}}
 const state={players,settings:{craft:true,respectLevels:true,...settings},overrides,ids,totals,known:model.known,shared,personal,assumed,held:new Map(players.map(p=>[p.key,new Map()])),spent:new Map(),events:[],warnings:[],levels:settings.levels||{}};
 state.input={shared:new Map(shared),personal:copyMap(personal)};
 // A confirmed finished item reserves its inputs from inferred lifetime drops.
 // Explicit component overrides mean remaining physical stock and are not debited.
 for(const p of [null,...players.map(p=>p.key)]){
  const values=p?overrides.personal?.[p]||{}:overrides.group||{};
  for(const [name,n] of Object.entries(values))if(D.items[name]?.recipe&&finite(n)&&Number(n)>0){
   for(const [ingredient,amount] of Object.entries(D.items[name].recipe)){
    const trial=clone(state),owner=D.items[ingredient]?.personal?p:null;
    if(spend(trial,ingredient,amount*Number(n),owner,p||players[0].key,new Set([name]),true,!D.items[name].personal&&!!D.items[ingredient]?.personal))adopt(state,trial);
    else state.warnings.push('Confirmed '+name+': not all '+ingredient+' inputs are visible in the log. Explicit remaining-stock overrides take precedence.');
   }
  }
 }
 state.reserved=new Map(state.spent);state.events=[];return state;
}
function eligible(s,name,player){
 if(!s.settings.respectLevels)return true;
 const req=D.items[name]?.requirements||{},levels=s.levels[player]||{};
 return Object.entries(req).every(([skill,n])=>Number.isFinite(levels[skill])&&levels[skill]>=n);
}
function equip(s,name,player){
 if(!eligible(s,name,player))return null;
 const held=s.held.get(player);if(held.has(name))return{...held.get(name),source:'reused'};
 const trial=clone(s),item=D.items[name];if(!item)return null;
 // Baseline tradeable supplies are per-account assumptions, not extra shared drops.
 const assumed=trial.assumed.has(player+'|'+name),personal=item.personal||assumed;
 const beforeEvents=trial.events.length;
 if(assumed&&quantity(trial,name,player)>0)debit(trial,name,1,player,player);
 else if(!spend(trial,name,1,personal?player:null,player))return null;
 const events=trial.events.slice(beforeEvents),crafted=events.some(e=>e.type==='craft'&&e.name===name);
 const result={name,id:s.ids.get(name),source:assumed?'assumed':crafted?'craft':manual(s,name,item.personal?player:null)?'confirmed':'log',materials:events.filter(e=>e.type==='consume').map(e=>({name:e.name,count:e.count}))};
 trial.held.get(player).set(name,result);adopt(s,trial);return result;
}
function pick(s,options,player){for(let i=0;i<options.length;i++){const chosen=equip(s,options[i],player);if(chosen)return{...chosen,rank:i+1,options}}return{name:null,source:'missing',rank:null,options}}
function emptySet(role,style){return{label:role.label,style,weaponOnly:!!role.weaponOnly,slots:{},role}}
function makeSet(s,role,player,encounter,forced){
 const routes=role.routes.filter(route=>!forced||forced==='auto'||route.style===forced),task=encounter.task==='required'||s.settings.onTask&&encounter.task==='optional';
 for(const route of routes)for(let index=0;index<route.weapons.length;index++){
  const name=route.weapons[index],trial=clone(s),weapon=equip(trial,name,player);if(!weapon)continue;
  const set=emptySet(role,route.style);set.slots.weapon={...weapon,rank:index+1,options:route.weapons};
  const bundle={...Object.fromEntries((D.items[name]?.bundle||[]).filter(piece=>!task||piece!=='Crystal helm').map(piece=>[piece.endsWith('helm')?'head':piece.split(' ')[1],piece])),...route.bundle};
  let viable=true;for(const [slot,piece] of Object.entries(bundle)){const chosen=equip(trial,piece,player);if(!chosen){viable=false;break}set.slots[slot]={...chosen,rank:1,options:[piece]}}
  if(!viable)continue;
  adopt(s,trial);return set;
 }
 const first=routes[0]||role.routes[0];const set=emptySet(role,first?.style||'melee');set.slots.weapon={name:null,source:'missing',options:routes.flatMap(r=>r.weapons)};return set;
}
function fillGear(s,set,player,encounter){
 if(set.weaponOnly)return;
 const task=encounter.task==='required'||s.settings.onTask&&encounter.task==='optional';
 const defaults=D.gear[set.style],slots={...defaults,...encounter.gear,...set.role.gear};
 if(encounter.id==='vorkath'&&set.style==='melee')slots.offhand=defaults.offhand;
 if(encounter.crush&&set.style==='melee')Object.assign(slots,{head:['Inquisitor\'s great helm',...slots.head],body:['Inquisitor\'s hauberk',...slots.body],legs:['Inquisitor\'s plateskirt',...slots.legs]});
 if(task&&!encounter.undead)slots.head=set.style==='melee'?['Slayer helmet (i)','Black mask']:['Slayer helmet (i)'];
 if(encounter.undead)slots.neck=set.style==='melee'?['Salve amulet(ei)','Salve amulet(e)',...defaults.neck]:['Salve amulet(ei)',...defaults.neck];
 for(const [slot,options] of Object.entries(slots)){
  if(set.slots[slot])continue;
  if(slot==='offhand'&&D.items[set.slots.weapon.name]?.twoHanded){set.slots.offhand={name:null,source:'two-handed',options:[]};continue}
  set.slots[slot]=pick(s,options,player);
 }
 // Bowfa crystal head must yield to a task helm, while body/legs stay reserved.
 if(task&&!encounter.undead&&set.slots.head?.name==='Crystal helm')set.slots.head=pick(s,slots.head,player);
}
function plan(model,players,encounter,settings={}){
 if(!encounter)throw new RangeError('Choose a supported encounter');
 const requested=[...new Set(settings.selected||players.map(p=>p.key))].filter(key=>players.some(p=>p.key===key));
 if(requested.length<1||requested.length>5)throw new RangeError('Choose 1–5 players');
 const order=[...new Set([...(settings.order||[]),...players.map(p=>p.key)])].filter(key=>requested.includes(key));
 const s=stock(model,players,settings),loadouts=order.map(key=>({player:players.find(p=>p.key===key),sets:[],special:null}));
 if(encounter.kind==='self-contained'||encounter.kind==='unreviewed')return{encounter,loadouts,state:s,ledger:[],missing:0};
 if(encounter.kind==='skilling'){
  for(const row of loadouts){const set={label:'Tools & outfit',style:'skilling',slots:{}};for(const [slot,options] of Object.entries(encounter.toolSlots))set.slots[slot]=pick(s,options,row.player.key);row.sets.push(set)}
 }else{
  // All main weapons precede all switches. A player's reusable equipment is held
  // once across every phase, but can never be loaned to a second simultaneous player.
  for(const row of loadouts)row.sets.push(makeSet(s,encounter.roles[0],row.player.key,encounter,settings.method));
  if(settings.switches!==false)for(const role of encounter.switches||[])for(const row of loadouts){
   if(role.unlessWeapon&&row.sets[0].slots.weapon.name===role.unlessWeapon)continue;
   row.sets.push(makeSet(s,role,row.player.key,encounter));
  }
  for(const row of loadouts)for(const set of row.sets)fillGear(s,set,row.player.key,encounter);
  if(settings.specials!==false&&encounter.spec)for(const row of loadouts)row.special=pick(s,encounter.spec,row.player.key);
 }
 const ledger=[];
 for(const [name,start] of s.input.shared){const key=resourceKey(name),used=s.spent.get(key)||0,reserved=s.reserved.get(key)||0,left=s.shared.get(name)||0;if(start||used||left)ledger.push({name,owner:null,start,used:used-reserved,reserved,left})}
 for(const p of players)for(const [name,start] of s.input.personal.get(p.key)||[]){const key=resourceKey(name,p.key),used=s.spent.get(key)||0,reserved=s.reserved.get(key)||0;if(start||used)ledger.push({name,owner:p.key,start,used:used-reserved,reserved,left:s.personal.get(p.key).get(name)||0,assumed:s.assumed.has(p.key+'|'+name)})}
 // Generated component leftovers have no initial stock row.
 for(const [name,left] of s.shared)if(left&&!ledger.some(row=>row.name===name&&!row.owner))ledger.push({name,owner:null,start:0,used:0,reserved:0,left});
 const missing=loadouts.reduce((n,row)=>n+row.sets.reduce((a,set)=>a+Object.values(set.slots).filter(slot=>slot.source==='missing').length,0),0);
 return{encounter,loadouts,state:s,ledger,missing};
}
function encounterList(model,metricKeys=[]){
 const out=[...D.encounters],seen=new Set(out.map(e=>e.id));
 const keys=new Set([...model.categories.filter(c=>['bosses','raids'].includes(c.tab)).map(c=>c.key),...metricKeys]);
 for(const raw of keys){const key=D.aliases[raw]||raw;if(seen.has(key))continue;seen.add(key);const name=raw.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());out.push({id:key,name,kind:'unreviewed',group:'Awaiting verified preset',roles:[],note:'No verified encounter preset is available. No generic list is presented as BIS.',source:D.wiki(name+'/Strategies')})}
 return out.sort((a,b)=>a.name.localeCompare(b.name));
}
return{stock,plan,encounterList,eligible,finite};
});
