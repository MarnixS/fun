'use strict';
const assert=require('node:assert/strict'),E=require('../docs/assets/gear-dps-engine'),D=require('../docs/assets/gear-planner-data');
const levels={attack:99,strength:99,defence:99,hitpoints:99,ranged:99,magic:99,prayer:99,mining:99,herblore:99};
const encounter=id=>D.encounters.find(e=>e.id===id);
function calc(weapon,style='melee',id='general_graardor',extra={}){return E.calculateSet({encounter:encounter(id),row:{player:{name:'Fixture'},sets:[{label:'Main setup',style,slots:{weapon:{name:weapon}}}]},levels,...extra})}
// Reference basic rolls: upstream src/tests/calc/BasicRolls.test.ts.
let r=calc('Bow of faerdhinen','ranged');assert.equal(r.status,'ok');assert.equal(r.maxHit,28);assert.equal(r.maxAttackRoll,20544);assert.equal(r.attackTicks,4);assert.equal(r.ammo,'','crystal bow does not invent external arrows');
r=calc('Trident of the seas','magic');assert.equal(r.maxHit,28);assert.equal(r.maxAttackRoll,8690);assert.equal(r.spell,null,'powered staves use their built-in attack');
assert(Math.abs(r.dps-r.expectedDamage/(r.attackTicks*.6))<1e-12,'reported mean attack damage and interval reproduce displayed DPS');
const moon=E.calculateSet({encounter:encounter('general_graardor'),row:{player:{name:'Blood Moon'},sets:[{label:'Main setup',style:'melee',slots:Object.fromEntries(Object.entries({weapon:'Dual macuahuitl',head:'Blood moon helm',body:'Blood moon chestplate',legs:'Blood moon tassets'}).map(([slot,name])=>[slot,{name}]))}]},levels});
assert(moon.attackTicks<moon.baseAttackTicks,'Blood Moon speed procs change the expected attack interval');assert(Math.abs(moon.attackTicks-(moon.baseAttackTicks-moon.accuracy/3-2*moon.accuracy**2/9))<1e-12);
assert.equal(calc('Trident of the seas','magic','general_graardor',{levels:{...levels,magic:75}}).maxHit,20);
const bare=calc('Abyssal whip');const buffed=calc('Abyssal whip','melee','general_graardor',{modifiers:{potion:'super',prayer:'best'}});assert(buffed.dps>bare.dps);assert(buffed.prayers.includes('Piety'));assert.equal(buffed.boosts.atk,19);assert.equal(buffed.boosts.str,19);
r=calc('Abyssal whip','melee','general_graardor',{levels:{...levels,prayer:1},modifiers:{prayer:'piety'}});assert.deepEqual(r.prayers,[]);assert(r.notes.some(n=>n.includes('requires higher')));
const drain=reductions=>calc('Abyssal whip','melee','general_graardor',{context:{reductions}});
assert.equal(drain({dwh:1}).defence,175);assert.equal(drain({dwh:2}).defence,123);assert.equal(drain({elderMaul:1,dwh:1,bgs:50}).defence,65);assert(drain({dwh:2}).dps>bare.dps);
r=calc("Osmumten's fang",'melee','nex',{context:{reductions:{elderMaul:20,dwh:20,bgs:2000}}});assert.equal(r.defence,250,'Nex defence floor is respected');
assert.equal(calc('Abyssal whip','melee','general_graardor',{levels:{}}).status,'unavailable','unknown stats never become 99');
assert.equal(calc('Abyssal whip','melee','general_graardor',{modifiers:{potion:'salts'}}).status,'unavailable','raid-only boosts stay restricted');
const normal=calc('Trident of the seas','magic','tombs_of_amascut',{context:{invocation:150,partySize:1}}),expert=calc('Trident of the seas','magic','tombs_of_amascut',{context:{invocation:400,partySize:5}});assert(expert.hp>normal.hp);assert(expert.dps<normal.dps);assert.equal(normal.target,'Akkha');
for(const [style,id] of [['melee',7552],['magic',7550],['ranged',7551]]){const choice=E.automaticTarget(encounter('chambers_of_xeric'),{style,label:'Main setup'});assert.equal(choice.id,id)}
assert.equal(E.automaticTarget(encounter('grotesque_guardians'),{style:'ranged',label:'Dawn'}).name,'Dawn');
assert.equal(E.automaticTarget(encounter('phantom_muspah'),{style:'ranged',label:'Prayer shield'}).version,'Shielded');
for(const id of ['vardorvis','duke_sucellus','the_leviathan','the_whisperer'])assert.match(E.automaticTarget(encounter(id),{style:'melee',label:'Main setup'}).version,/^Post-quest/,'normal DT2 encounters never default to Awakened');
const vard=calc('Abyssal whip','melee','vardorvis');assert.equal(vard.target,'Vardorvis · Post-quest');assert.equal(vard.defence,215);assert.equal(vard.baseDefence,215);assert.equal(vard.defenceFloor,215);
const injured=calc('Abyssal whip','melee','vardorvis',{context:{hpPercent:50,reductions:{dwh:20}}});assert.equal(injured.defence,180);assert.equal(injured.defenceFloor,180,'HP-scaled floor is shown, not the raw JSON placeholder');
for(const [id,count] of [['chambers_of_xeric',14],['chambers_of_xeric_challenge_mode',14],['theatre_of_blood',6],['theatre_of_blood_hard_mode',6],['tombs_of_amascut',9],['tombs_of_amascut_expert',9]]){
 const e=encounter(id);assert.equal(E.raidRooms(e).length,count);
 for(const room of E.raidRooms(e))if(room.names.length)assert(E.roomTargets(e,room.key).length,id+' / '+room.key+' has target data');
}
assert.equal(E.roomTargets(encounter('chambers_of_xeric'),'guardians')[0].id,7569);
assert(E.roomTargets(encounter('chambers_of_xeric'),'mystics').every(t=>t.name==='Skeletal Mystic'));
assert(E.roomTargets(encounter('theatre_of_blood_hard_mode'),'nylocas').some(t=>t.name==='Nylocas Prinkipas'));
assert(!E.roomTargets(encounter('theatre_of_blood'),'nylocas').some(t=>t.name==='Nylocas Prinkipas'));
assert.equal(calc('Twisted bow','ranged','tombs_of_amascut',{context:{raidRoom:'zebak'}}).target,'Zebak · Normal');
assert.equal(calc('Abyssal whip','melee','chambers_of_xeric',{context:{raidRoom:'thieving'}}).status,'unavailable','puzzles do not invent combat DPS');
for(const e of D.encounters.filter(e=>!e.kind))assert(E.targets(e).length,e.id+' has verified target data');
const dragon=calc('Twisted bow','ranged','kreearra',{modifiers:{ammo:'dragon'}}),rune=calc('Twisted bow','ranged','kreearra',{modifiers:{ammo:'rune'}});assert(dragon.dps>rune.dps);assert.equal(dragon.ammo,'Dragon arrow');
assert.equal(calc('Venator bow','ranged').ammo,'Amethyst arrow','Venator bow consumes arrows');
assert.equal(calc("Karil's crossbow",'ranged').ammo,'Bolt rack');assert(calc("Karil's crossbow",'ranged').dps>0);assert(E.equipment("Ahrim's robetop").offensive.magic>0,'degraded and broken variants resolve to functional equipment stats');
assert.equal(calc('Dorgeshuun crossbow','ranged').ammo,'Bone bolts');
assert.equal(calc('Magic shortbow (i)','ranged').ammo,'Amethyst arrow');
assert.equal(calc('Heavy ballista','ranged').ammo,'Amethyst javelin','ballistae require javelins, not bolts');
assert.equal(calc('Toxic blowpipe','ranged','kreearra',{modifiers:{ammo:'dragon'}}).ammo,'Dragon dart');
const vm=require('node:vm'),fs=require('node:fs'),browser={};vm.runInNewContext(fs.readFileSync(require.resolve('../docs/assets/gear-dps-engine'),'utf8'),browser);assert.equal(browser.UGWikiDps.calculateSet({encounter:encounter('general_graardor'),row:{player:{name:'Browser'},sets:[{label:'Main setup',style:'melee',slots:{weapon:{name:'Abyssal whip'}}}]},levels}).status,'ok','bundle runs without Node process or module globals');
console.log('DPS passed: upstream reference rolls, saved levels, real equipment bonuses, powered staves, potions, prayer requirements, ammo, landed defence reductions and floors, raid scaling, exact target phases and missing-data handling.');
