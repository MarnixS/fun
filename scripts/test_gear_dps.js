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
function blessed(weapon,style,locked=false){return calc(weapon,style,'general_graardor',{row:{player:{name:'Blessing'},sets:[{label:'Main setup',style,slots:{weapon:{name:weapon},ammo:{name:'Holy blessing',locked}}}]}})}
for(const [weapon,style] of [['Abyssal whip','melee'],['Trident of the seas','magic'],['Bow of faerdhinen','ranged'],['Toxic blowpipe','ranged']]){const base=calc(weapon,style),withBlessing=blessed(weapon,style);assert.equal(withBlessing.bonuses.prayer,1,weapon+' includes the blessing’s Prayer bonus');assert.equal(withBlessing.dps,base.dps,'a blessing does not create direct DPS');assert(E.ammoSlotFree(weapon));}
assert.equal(blessed('Toxic blowpipe','ranged',true).ammo,'Amethyst dart','a manually selected blessing is not loaded into the blowpipe as a dart');assert.equal(blessed('Toxic blowpipe','ranged',true).bonuses.prayer,1);
assert(!E.ammoSlotFree('Twisted bow'));assert(!E.ammoSlotFree('Armadyl crossbow'));assert(!E.ammoSlotFree('Heavy ballista'));assert(!E.ammoSlotFree('Eclipse atlatl'));assert.equal(E.ammoSlotFree(null),false);
assert.equal(blessed('Twisted bow','ranged',true).status,'unavailable','a required ammo slot cannot hold a blessing and arrows together');
assert(E.ammoSlotFree('Twisted bow',"Dizana's quiver"));assert(E.ammoSlotFree('Armadyl crossbow',"Dizana's quiver"));assert(!E.ammoSlotFree('Heavy ballista',"Dizana's quiver"));assert(!E.ammoSlotFree('Eclipse atlatl',"Dizana's quiver"));assert(!E.ammoSlotFree("Karil's crossbow","Dizana's quiver"));
const quiverCalc=blessing=>calc('Twisted bow','ranged','general_graardor',{row:{player:{name:'Quiver'},sets:[{label:'Main setup',style:'ranged',slots:{weapon:{name:'Twisted bow'},cape:{name:"Dizana's quiver"},...(blessing?{ammo:{name:'Holy blessing',locked:true}}:{})}}]}});
const quiverBase=quiverCalc(false),quiverBlessed=quiverCalc(true);assert.equal(quiverBlessed.status,'ok');assert.equal(quiverBlessed.ammoInQuiver,true);assert.equal(quiverBlessed.ammo,'Amethyst arrow');assert.equal(quiverBlessed.bonuses.prayer,quiverBase.bonuses.prayer+1);assert.equal(quiverBlessed.dps,quiverBase.dps,'stored quiver ammo retains the arrow stats and charged-quiver bonuses without fake DPS from the blessing');
const vm=require('node:vm'),fs=require('node:fs'),browser={};vm.runInNewContext(fs.readFileSync(require.resolve('../docs/assets/gear-dps-engine'),'utf8'),browser);assert.equal(browser.UGWikiDps.calculateSet({encounter:encounter('general_graardor'),row:{player:{name:'Browser'},sets:[{label:'Main setup',style:'melee',slots:{weapon:{name:'Abyssal whip'}}}]},levels}).status,'ok','bundle runs without Node process or module globals');
// Seeking variants preserve the bow's ammo tier and use the upstream accurate-hit
// distribution (minimum 3 on a hit, zero on a miss), not a flat DPS multiplier.
for(const [key,name] of E.ammoOptions.filter(([key])=>key.startsWith('seeking'))){const shot=calc('Twisted bow','ranged','general_graardor',{modifiers:{ammo:key}});assert.equal(shot.ammo,name.replace(' (bows)',''));assert.equal(shot.offensive.ranged,90,'bow +70 and seeking arrow +20');assert(Math.abs(shot.expectedDamage-shot.accuracy*(shot.maxHit/2+6/(shot.maxHit+1)))<1e-10,'only successful hits are raised to three');}
const seeking=calc('Twisted bow','ranged','kreearra',{modifiers:{ammo:'seekingAmethyst'}});assert(seeking.dps>calc('Twisted bow','ranged','kreearra').dps);assert.equal(seeking.maxHit,calc('Twisted bow','ranged','kreearra').maxHit);
assert.equal(calc('Magic shortbow (i)','ranged','general_graardor',{modifiers:{ammo:'seekingDragon'}}).ammo,'Amethyst arrow','unsupported dragon arrows fall back to compatible ammunition');
const seekingQuiver=E.calculateSet({encounter:encounter('kreearra'),row:{player:{name:'Quiver'},sets:[{label:'Main setup',style:'ranged',slots:{weapon:{name:'Twisted bow'},cape:{name:"Dizana's quiver"},ammo:{name:'Holy blessing'}}}]},levels,modifiers:{ammo:'seekingAmethyst'}});assert.equal(seekingQuiver.ammo,'Seeking amethyst arrow');assert(seekingQuiver.ammoInQuiver);assert(seekingQuiver.notes.some(n=>n.includes('successful hits')));
const inq=(items,style='crush')=>E.calculateSet({encounter:encounter('general_graardor'),row:{player:{name:'Inquisitor'},sets:[{label:'Main setup',style:'melee',slots:Object.fromEntries(Object.entries({weapon:"Inquisitor's mace",...items}).map(([slot,name])=>[slot,{name}]))}]},levels,modifiers:{style}});
assert.equal(inq({legs:"Inquisitor's plateskirt"}).maxAttackRoll,19236,'one leg piece supplies +12 crush and its 1% crush multiplier');assert.equal(inq({body:"Inquisitor's hauberk",legs:"Inquisitor's plateskirt"}).maxAttackRoll,21173,'body and legs retain a 2% crush bonus with a different helm');assert.equal(inq({head:"Inquisitor's great helm",body:"Inquisitor's hauberk",legs:"Inquisitor's plateskirt"}).maxAttackRoll,22373,'full Inquisitor gives 2.5% crush accuracy');assert.equal(inq({legs:"Inquisitor's plateskirt"},'stab').maxAttackRoll,calc("Inquisitor's mace",'melee','general_graardor',{modifiers:{style:'stab'}}).maxAttackRoll,'crush bonus is not applied to stab');
const task=(onTask,style='ranged',neck=null)=>E.calculateSet({encounter:encounter('king_black_dragon'),row:{player:{name:'Task'},sets:[{label:'Main setup',style,slots:{weapon:{name:style==='ranged'?'Twisted bow':style==='magic'?'Trident of the seas':'Abyssal whip'},head:{name:'Slayer helmet (i)'},...(neck?{neck:{name:neck}}:{})}}]},levels,context:{onTask}});
for(const style of ['melee','ranged','magic']){assert(task(true,style).dps>task(false,style).dps,'imbued Slayer helmet improves '+style+' on task');assert(task(true,style).onSlayerTask);}
const salveTask=onTask=>E.calculateSet({encounter:encounter('vorkath'),row:{player:{name:'Salve'},sets:[{label:'Main setup',style:'ranged',slots:{weapon:{name:'Twisted bow'},head:{name:'Slayer helmet (i)'},neck:{name:'Salve amulet(ei)'}}}]},levels,context:{onTask}});assert.equal(salveTask(true).dps,salveTask(false).dps,'Slayer and Salve bonuses do not stack');
assert.deepEqual(calc('Twisted bow','ranged','kreearra',{modifiers:{prayer:'best'}}).prayers,['Rigour']);assert.deepEqual(calc('Trident of the seas','magic','kreearra',{modifiers:{prayer:'best'}}).prayers,['Augury']);assert.deepEqual(calc('Twisted bow','ranged','kreearra',{levels:{...levels,prayer:73},modifiers:{prayer:'best'}}).prayers,['Deadeye'],'unlocks do not waive prayer-level requirements');
assert.equal(drain({tonalztic:1}).defence,240);assert.equal(drain({seercull:20}).magic,60);
console.log('DPS passed: reference rolls, Inquisitor pieces and crush effects, every Seeking arrow variant and hit distribution, Slayer tasks and Salve, permanent prayer unlocks with level requirements, ammo/quivers, landed drains and floors, raid scaling and target phases.');
