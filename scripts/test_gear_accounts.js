'use strict';
const assert=require('node:assert/strict');
const D=require('../docs/assets/gear-planner-data'),M=require('../docs/assets/gear-planner-model'),P=require('../docs/assets/gear-loadout-model');
const levels=Object.fromEntries(['attack','strength','defence','hitpoints','ranged','magic','prayer','mining','herblore','agility'].map(k=>[k,99]));
const members=keys=>keys.map(key=>({key,name:key}));
const accounts=members(['dikste','big dog aura','lijpste']);
function fixture(players,entries){
 const names=new Map(),counts=new Map(players.map(p=>[p.key,new Map()]));let id=1;
 for(const [name,values]of Object.entries(entries)){names.set(id,name);for(const [key,count]of Object.entries(typeof values==='number'?{[players[0].key]:values}:values))counts.get(key).set(id,count);id++}
 return{names,counts,known:new Set(players.map(p=>p.key)),categories:[]};
}
const encounter=(style,weapons,id='general_graardor')=>({...D.encounters.find(e=>e.id===id),roles:[{label:'Main setup',routes:[{style,weapons}]}]});
const settings=players=>({selected:players.map(p=>p.key),levels:Object.fromEntries(players.map(p=>[p.key,levels])),switches:false,specials:false,respectLevels:true});
const main=(result,key)=>result.loadouts.find(r=>r.player.key===key).sets[0];
const shadow=encounter('magic',["Tumeken's shadow",'Trident of the seas']);
let stock=fixture(accounts,{"Tumeken's shadow":{lijpste:2},'Trident of the seas':{dikste:1}}),s=settings(accounts);
let plan=P.plan(stock,accounts,shadow,s);
assert.equal(main(plan,'lijpste').slots.weapon.name,"Tumeken's shadow",'logged owner keeps first use');
assert.equal(main(plan,'big dog aura').slots.weapon.name,"Tumeken's shadow",'Big Dog Aura receives the spare Shadow before Dikste');
assert.equal(main(plan,'dikste').slots.weapon.name,'Trident of the seas');
assert.equal(plan.ledger.find(r=>r.name==="Tumeken's shadow").used,2);
stock=fixture(accounts,{"Tumeken's shadow":{lijpste:1},'Trident of the seas':{dikste:2}});
plan=P.plan(stock,accounts,shadow,s);
assert.equal(main(plan,'lijpste').slots.weapon.name,"Tumeken's shadow",'loan preference cannot take the only copy from its owner');
assert.notEqual(main(plan,'big dog aura').slots.weapon.name,"Tumeken's shadow");
stock=fixture(accounts,{"Tumeken's shadow":{lijpste:2},'Trident of the seas':{dikste:2}});
plan=P.plan(stock,accounts,shadow,{...s,edits:{'big dog aura':{'Main setup':{weapon:'Trident of the seas'}}}});
assert.equal(main(plan,'dikste').slots.weapon.name,"Tumeken's shadow",'explicitly choosing another weapon releases the preferred loan');
plan=P.plan(stock,accounts,shadow,{...s,levels:{...s.levels,'big dog aura':{...levels,magic:80}}});
assert.equal(main(plan,'dikste').slots.weapon.name,"Tumeken's shadow",'an ineligible borrower cannot strand the spare copy');

const pair=members(['a','b']),ranged=encounter('ranged',['Bow of faerdhinen']);s=settings(pair);
stock=fixture(pair,{'Bow of faerdhinen':2,"Vorkath's head":{a:1}});
plan=P.plan(stock,pair,ranged,s);
assert.equal(main(plan,'a').slots.cape.name,"Ava's assembler");
assert.equal(main(plan,'b').slots.cape.name,"Ava's accumulator",'normal Ava is confirmed without opting into all quest gear');
assert.equal(plan.ledger.find(r=>r.name==="Vorkath's head").used,1);
assert.equal(plan.ledger.find(r=>r.name==="Ava's accumulator"&&r.owner==='b').start,1);
plan=P.plan(stock,pair,ranged,{...s,overrides:{personal:{b:{"Ava's accumulator":0}}}});
assert.notEqual(main(plan,'b').slots.cape.name,"Ava's accumulator",'an explicit stock correction remains authoritative');
assert(!M.eligible(M.stock(stock,pair,{...s,levels:{...s.levels,b:{...levels,ranged:49}}}),"Ava's accumulator",'b'));

// Different accounts and different styles must retain independent prayers.
stock=fixture(pair,{'Abyssal whip':2,'Trident of the seas':2});
const multi={...encounter('melee',['Abyssal whip']),switches:[{label:'Magic switch',routes:[{style:'magic',weapons:['Trident of the seas']}]}]};
s={...settings(pair),switches:true,combat:{players:{a:{prayerMelee:'piety',prayerMagic:'none',potion:'super'},b:{prayerMelee:'none',prayerMagic:'augury',potion:'none'}}}};
plan=P.plan(stock,pair,multi,s);
assert.deepEqual(main(plan,'a').dps.prayers,['Piety']);assert.deepEqual(main(plan,'b').dps.prayers,[]);
assert.deepEqual(plan.loadouts[0].sets[1].dps.prayers,[]);assert.deepEqual(plan.loadouts[1].sets[1].dps.prayers,['Augury']);
assert(main(plan,'a').dps.boosts.str>0);assert.equal(main(plan,'b').dps.boosts.str,0);
const before=JSON.stringify(plan.loadouts),ledger=JSON.stringify(plan.ledger),held=[...plan.state.held].map(([key,items])=>[key,[...items.keys()]]);
const refreshed=P.refreshDps(plan,{...s,combat:{players:{...s.combat.players,a:{...s.combat.players.a,prayerMelee:'none'}}}});
assert(refreshed.loadouts[0].sets[0].dps.dps<main(plan,'a').dps.dps);
assert.equal(main(refreshed,'b').dps.dps,main(plan,'b').dps.dps,'another account’s DPS stays independent');
assert.equal(JSON.stringify(plan.loadouts),before,'refresh does not overwrite the previous result');
assert.equal(JSON.stringify(refreshed.ledger),ledger);assert.deepEqual([...refreshed.state.held].map(([key,items])=>[key,[...items.keys()]]),held,'refresh does not reallocate physical items');

// Controlled inventories previously missed these complete-set upgrades.
const solo=members(['a']);
const bolts=P.plan(fixture(solo,{'Armadyl crossbow':1}),solo,encounter('ranged',['Armadyl crossbow']),settings(solo));
const dragonBolts=P.refreshDps(bolts,{...settings(solo),combat:{players:{a:{ammo:'dragon',prayerRanged:'rigour'}}}});
assert.equal(main(dragonBolts,'a').slots.ammo.name,'Diamond dragon bolts (e)','quick refresh updates the visible assumed ammo with the DPS');
assert.equal(main(bolts,'a').slots.ammo.name,'Diamond bolts (e)');assert.deepEqual(main(dragonBolts,'a').dps.prayers,['Rigour']);
function optimalSet(entries,style,weapon,expected,id='general_graardor',modifiers={}){
 const inventory=fixture(solo,Object.fromEntries(entries.map(name=>[name,1]))),e=encounter(style,[weapon],id),s={...settings(solo),combat:{players:{a:modifiers}}};
 const automatic=P.plan(inventory,solo,e,s),explicit=P.plan(inventory,solo,e,{...s,edits:{a:{'Main setup':expected}}});
 assert(main(automatic,'a').dps.dps>=main(explicit,'a').dps.dps-1e-9,weapon+' automatic search must find the known full-set DPS');
 for(const [slot,name]of Object.entries(expected))assert.equal(main(automatic,'a').slots[slot].name,name);
 assert(automatic.ledger.every(r=>r.left>=0&&r.used+r.reserved<=r.start),'complete sets still consume finite stock');
 return automatic;
}
const dh={weapon:"Dharok's greataxe",head:"Dharok's helm",body:"Dharok's platebody",legs:"Dharok's platelegs"};
const dhInventory=[...Object.values(dh),'Abyssal whip','Zombie axe','Dragon scimitar','Dragon mace','Dragon longsword','Dragon battleaxe','Dragon dagger','Dragon 2h sword','Helm of neitiznot','Fighter torso','Bandos tassets','Barrows gloves'];
optimalSet(dhInventory,'melee',dh.weapon,dh,'giant_mole',{playerHpPercent:1});
const meleeVoid={weapon:'Abyssal whip',head:'Void melee helm',body:'Void knight top',legs:'Elite void robe',hands:'Void knight gloves'};
optimalSet([...Object.values(meleeVoid),'Helm of neitiznot','Rune platebody','Rune platelegs','Combat bracelet'],'melee',meleeVoid.weapon,meleeVoid);
const magicVoid={weapon:'Trident of the seas',head:'Void mage helm',body:'Elite void top',legs:'Elite void robe',hands:'Void knight gloves'};
optimalSet([...Object.values(magicVoid),'Mystic hat','Mystic robe top','Mystic robe bottom'],'magic',magicVoid.weapon,magicVoid);
for(const [owner,weapon,head,body,legs,style,alternative]of [['Ahrim',"Ahrim's staff",'hood','robetop','robeskirt','magic','Ancestral hat'],['Karil',"Karil's crossbow",'coif','leathertop','leatherskirt','ranged','Armadyl helmet'],['Verac',"Verac's flail",'helm','brassard','plateskirt','melee','Helm of neitiznot']]){
 const full={weapon,head:owner+"'s "+head,body:owner+"'s "+body,legs:owner+"'s "+legs,...(owner==='Verac'?{}:{neck:'Amulet of the Damned'})};
 optimalSet([...Object.values(full),alternative,'Amulet of fury'],style,weapon,full);
}
const low=M.stock(fixture(solo,Object.fromEntries([...Object.values(dh),...Object.values(meleeVoid)].map(name=>[name,1]))),solo,{...settings(solo),levels:{a:{...levels,defence:69}}});
assert(!M.eligible(low,"Dharok's platelegs",'a'));assert(M.eligible(low,'Void melee helm','a'));
const weak=M.stock(fixture(solo,{}),solo,{...settings(solo),levels:{a:{...levels,strength:69}}});
assert(!M.eligible(weak,"Inquisitor's plateskirt",'a'));assert(!M.eligible(weak,'Blood moon tassets','a'));
console.log('Account and set regressions passed: independent style prayers and boosts, owner-first spare Shadow priority and release, normal Ava/head upgrades, immutable DPS refresh, low-HP Dharok, mixed/elite Void, Barrows + Damned combinations and equipment requirements.');
