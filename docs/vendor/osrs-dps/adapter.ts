/* SPDX-License-Identifier: GPL-3.0-only
 * United Gimps adapter for the unmodified OSRS Wiki combat engine.
 * See README.md for the pinned upstream source and data attribution. */
import PlayerVsNPCCalc from '@/lib/PlayerVsNPCCalc';
import { availableEquipment, calculateEquipmentBonusesFromGear, calculateAttackSpeed, getCanonicalItem, ammoApplicability, AmmoApplicability } from '@/lib/Equipment';
import { getMonsters, INITIAL_MONSTER_INPUTS } from '@/lib/Monsters';
import { scaleMonster } from '@/lib/MonsterScaling';
import { getDefenceFloor } from '@/lib/scaling/DefenceReduction';
import { PotionMap, getCombatStylesForCategory, calculateCombatLevel, FeatureStatus } from '@/utils';
import Potion from '@/enums/Potion';
import { Prayer, PrayerMap } from '@/enums/Prayer';
import UserIssueType from '@/enums/UserIssueType';
import { spells } from '@/types/Spell';
import { Player, EquipmentPiece } from '@/types/Player';
import { Monster } from '@/types/Monster';
import tradeable from './cdn/json/tradeable.json';
import { BLOWPIPE_IDS } from '@/lib/constants';

export const revision = '98e4fac38b580901cc3f8d485bbaa48bbb3277ed';
const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export const monsterKey = (m: any) => `${m.id}:${m.version || ''}:${m.name}`;
const monsters = getMonsters();
const monsterByKey = new Map(monsters.map(m=>[monsterKey(m),m]));
const targetCache = new Map<string,any[]>();
const groupNames: Record<string, string[]> = {
  barrows_chests: ['Ahrim the Blighted', 'Dharok the Wretched', 'Guthan the Infested', 'Karil the Tainted', 'Torag the Corrupted', 'Verac the Defiled'],
  dagannoth_kings: ['Dagannoth Supreme', 'Dagannoth Prime', 'Dagannoth Rex'],
  grotesque_guardians: ['Dusk', 'Dawn'],
  lunar_chests: ['Blue Moon', 'Blood Moon', 'Eclipse Moon'],
  the_royal_titans: ['Branda the Fire Queen', 'Eldric the Ice King', 'Fire elemental (Royal Titans)', 'Ice elemental (Royal Titans)'],
  abyssal_sire: ['Abyssal Sire','Respiratory system'],
  hespori: ['Hespori','Flower'],
  scurrius: ['Scurrius','Giant rat (Scurrius)'],
  yama: ['Yama','Void Flare'],
  nightmare: ['The Nightmare','Totem (The Nightmare)'],
  phosanis_nightmare: ["Phosani's Nightmare","Totem (Phosani's Nightmare)"],
  sol_heredit: ['Javelin colossus', 'Serpent shaman', 'Jaguar warrior', 'Minotaur', 'Sol Heredit'],
  tztok_jad: ['TzTok-Jad', 'Yt-HurKot'],
  tzkal_zuk: ['TzKal-Zuk', 'Jal-MejJak'],
  the_fractured_archive: ['Archive Guardian'],
  mad_angel: ['Mad Angel'],
};
const raidRoomData: Record<string, any[]> = {
  cox: [
    {key:'olm',label:'Great Olm',names:['Great Olm'],styles:['melee','magic','ranged']},
    {key:'tekton',label:'Tekton',names:['Tekton'],styles:['melee']},
    {key:'vasa',label:'Vasa Nistirio & crystals',names:['Vasa Nistirio','Glowing crystal'],styles:['ranged','melee']},
    {key:'vanguards',label:'Vanguards',names:['Vanguard'],styles:['melee','magic','ranged']},
    {key:'muttadiles',label:'Muttadiles',names:['Muttadile'],styles:['ranged','magic','melee']},
    {key:'vespula',label:'Vespula & portal',names:['Abyssal portal','Vespula'],styles:['magic','ranged']},
    {key:'guardians',label:'Guardians',names:['Guardian (Chambers of Xeric)'],styles:['melee']},
    {key:'mystics',label:'Skeletal Mystics',names:['Skeletal Mystic'],styles:['ranged','magic','melee']},
    {key:'shamans',label:'Lizardman shamans',names:['Lizardman shaman (Chambers of Xeric)'],styles:['ranged']},
    {key:'ice_demon',label:'Ice demon',names:['Ice demon'],styles:['magic']},
    {key:'tightrope',label:'Tightrope',names:['Deathly mage','Deathly ranger'],styles:['ranged','magic']},
    {key:'crabs',label:'Jewelled Crabs puzzle',names:[],styles:[],reason:'Jewelled Crabs are an orb puzzle; conventional combat DPS does not measure its completion.'},
    {key:'thieving',label:'Corrupted scavenger / Thieving',names:[],styles:[],reason:'The corrupted scavenger room is a Thieving puzzle, without a conventional combat DPS target.'},
    {key:'scavengers',label:'Scavenger beasts',names:['Scavenger beast'],styles:['melee','ranged','magic']},
  ],
  tob: [
    {key:'maiden',label:'The Maiden of Sugadinti',names:['The Maiden of Sugadinti','Nylocas Matomenos'],styles:['melee','ranged','magic']},
    {key:'bloat',label:'Pestilent Bloat',names:['Pestilent Bloat'],styles:['melee']},
    {key:'nylocas',label:'Nylocas',names:['Nylocas Vasilias','Nylocas Prinkipas','Nylocas Ischyros','Nylocas Toxobolos','Nylocas Hagios'],styles:['melee','ranged','magic']},
    {key:'sotetseg',label:'Sotetseg',names:['Sotetseg'],styles:['melee','ranged','magic']},
    {key:'xarpus',label:'Xarpus',names:['Xarpus'],styles:['melee','ranged']},
    {key:'verzik',label:'Verzik Vitur',names:['Verzik Vitur','Nylocas Matomenos','Nylocas Athanatos','Nylocas Ischyros','Nylocas Toxobolos','Nylocas Hagios'],styles:['melee','ranged','magic']},
  ],
  toa: [
    {key:'akkha',label:'Akkha',names:['Akkha',"Akkha's Shadow"],styles:['magic','melee','ranged']},
    {key:'baba',label:'Ba-Ba',names:['Ba-Ba','Baboon'],styles:['melee']},
    {key:'kephri',label:'Kephri',names:['Kephri','Soldier Scarab','Spitting Scarab','Arcane Scarab','Scarab Swarm (Tombs of Amascut)'],styles:['melee']},
    {key:'zebak',label:'Zebak',names:['Zebak'],styles:['ranged']},
    {key:'wardens',label:'The Wardens',names:["Tumeken's Warden","Elidinis' Warden",'Obelisk (Tombs of Amascut)'],styles:['ranged','magic','melee']},
    {key:'apmeken',label:'Path of Apmeken · baboons',names:['Baboon Brawler','Baboon Thrower','Baboon Mage','Baboon Shaman','Baboon Thrall','Cursed Baboon','Volatile Baboon'],styles:['melee','ranged','magic']},
    {key:'scabaras',label:'Path of Scabaras · puzzle',names:['Scarab (Tombs of Amascut)'],styles:['melee','ranged','magic']},
    {key:'het',label:'Path of Het · light puzzle',names:[],styles:[],reason:'The Path of Het light and mining puzzle has no conventional combat DPS target.'},
    {key:'crondis',label:'Path of Crondis · crocodile',names:['Crocodile (Tombs of Amascut)'],styles:['ranged','magic']},
  ],
};
function raid(e: any) { return e.id.startsWith('chambers_') ? 'cox' : e.id.startsWith('tombs_') ? 'toa' : e.id.startsWith('theatre_') ? 'tob' : ''; }
export function raidRooms(e: any) { return raidRoomData[raid(e)] || []; }
export function raidRoom(e: any, key: string) { return raidRooms(e).find(r=>r.key===key); }
export function targets(e: any) {
  if (e.kind) return [];
  if(targetCache.has(e.id))return targetCache.get(e.id)!;
  const names = raid(e) ? raidRooms(e).flatMap(r=>r.names) : groupNames[e.id] || [e.name];
  const keys=new Set(names.map(norm));
  const result=monsters.filter(m => keys.has(norm(m.name))).filter(m => {
    if (raid(e) !== 'tob') return true;
    const version=m.version||'';
    if (/entry/i.test(version)||m.name==='Nylocas Prinkipas'&&!e.id.endsWith('hard_mode')) return false;
    return e.id.endsWith('hard_mode') ? !/normal|health/i.test(version) : !/hard/i.test(version);
  }).map(m => ({ key: monsterKey(m), id: m.id, name: m.name, version: m.version || '', label: m.name + (m.version ? ' · ' + m.version : '') }));
  targetCache.set(e.id,result);return result;
}
export function roomTargets(e: any, key: string) {
  const room=raidRoom(e,key);
  if(!room)return targets(e);
  return targets(e).filter(t=>!room||room.names.includes(t.name)).filter(t=>{
    if(!room||!t.name.startsWith('Nylocas')||t.name==='Nylocas Vasilias'||t.name==='Nylocas Prinkipas')return true;
    return room.key==='maiden'?/Maiden/i.test(t.version):room.key==='verzik'?/Verzik/i.test(t.version)||t.name==='Nylocas Athanatos':!/Verzik/i.test(t.version);
  });
}
export function automaticTarget(e: any, set: any, choices = targets(e), roomKey='all') {
  const find = (name: string, version?: string) => choices.find(m => norm(m.name) === norm(name) && (!version || m.version.toLowerCase().includes(version.toLowerCase())));
  const room=raidRoom(e,roomKey);
  if(room){
    if(!room.names.length)return undefined;
    if(room.key==='olm')return find('Great Olm',set.style==='magic'?'right claw':set.style==='ranged'?'head':'left claw');
    if(room.key==='vanguards')return find('Vanguard',set.style==='magic'?'Melee':set.style==='ranged'?'Magic':'Ranged');
    if(room.key==='vasa'&&set.style==='melee')return find('Glowing crystal');
    if(room.key==='verzik')return find('Verzik Vitur','Phase 3');
    if(room.key==='wardens')return find("Tumeken's Warden",'Damaged');
    if(room.key==='kephri')return find('Kephri','Shielded');
    const primary=choices.filter(m=>m.name===room.names[0]);return primary.find(m=>!m.version||/^Normal$/i.test(m.version))||primary[0]||choices[0];
  }
  if (e.id === 'the_whisperer' && set.label==='Souls') return undefined;
  if (e.id === 'barrows_chests') return find(set.label === 'Ahrim' ? 'Ahrim the Blighted' : set.label === 'Karil' ? 'Karil the Tainted' : 'Dharok the Wretched');
  if (e.id === 'abyssal_sire' && set.weaponOnly) return find('Respiratory system');
  if (e.id === 'hespori' && set.weaponOnly) return find('Flower');
  if (e.id === 'scurrius' && set.weaponOnly) return find('Giant rat (Scurrius)');
  if (e.id === 'yama' && set.weaponOnly) return find('Void Flare','Shadow');
  if (e.id.includes('nightmare') && set.label === 'Pillars') return find(e.id === 'nightmare' ? 'Totem (The Nightmare)' : "Totem (Phosani's Nightmare)");
  if (raid(e) === 'cox') return find('Great Olm', set.style === 'magic' ? 'right claw' : set.style === 'ranged' ? 'head' : 'left claw');
  if (raid(e) === 'toa') return find(set.style === 'magic' ? 'Akkha' : set.style === 'ranged' ? 'Zebak' : 'Ba-Ba', set.style === 'ranged' ? 'Normal' : undefined);
  if (raid(e) === 'tob') return find(set.style === 'magic' ? 'Nylocas Vasilias' : set.style === 'ranged' ? 'Xarpus' : 'Verzik Vitur', set.style === 'melee' ? 'Phase 3' : undefined);
  if (e.id === 'dagannoth_kings') return find(set.style === 'magic' ? 'Dagannoth Rex' : set.style === 'ranged' ? 'Dagannoth Prime' : 'Dagannoth Supreme');
  if (e.id === 'grotesque_guardians') return find(set.label === 'Dawn' ? 'Dawn' : 'Dusk', set.label === 'Dawn' ? undefined : 'First');
  if (e.id === 'lunar_chests') return find(set.label.includes('Eclipse') ? 'Eclipse Moon' : set.label.includes('Blood') ? 'Blood Moon' : 'Blue Moon');
  if (e.id === 'sol_heredit') return find(set.label.includes('Sol') ? 'Sol Heredit' : 'Javelin colossus');
  if (e.id === 'the_royal_titans') return find(set.label === 'Elementals' ? 'Ice elemental (Royal Titans)' : 'Branda the Fire Queen');
  if (e.id === 'phantom_muspah') return find(e.name, set.label === 'Melee phase' ? 'Melee' : set.label === 'Prayer shield' ? 'Shielded' : 'Ranged');
  if (e.id === 'zulrah') return find(e.name, set.label.includes('Tanzanite') ? 'Tanzanite' : 'Serpentine');
  if (e.id === 'kalphite_queen') return find(e.name, set.label === 'Phase two' ? 'Airborne' : 'Crawling');
  if (e.id === 'the_hueycoatl') return find(e.name, set.label === 'Tail' ? 'Tail' : 'Normal');
  if (e.id === 'tztok_jad' && set.weaponOnly) return find('Yt-HurKot');
  if (e.id === 'tzkal_zuk' && set.weaponOnly) return find('Jal-MejJak');
  const preferred: Record<string,string> = {alchemical_hydra:'Serpentine',vardorvis:'Post-quest',duke_sucellus:'Post-quest, Awake',the_leviathan:'Post-quest',the_whisperer:'Post-quest',vorkath:'Post-quest',abyssal_sire:'Phase 2',doom_of_mokhaiotl:'Delve 1',maggot_king:'Nearby',scurrius:'Group',yama:'Normal',mad_angel:'Post-quest',the_fractured_archive:'Grounded'};
  return (preferred[e.id] && choices.find(m => m.version === preferred[e.id])) || choices.find(m => !m.version || /^(Normal|Standard)$/i.test(m.version)) || choices[0];
}

const equipmentNames = new Map<string, EquipmentPiece[]>();
const equipmentCache = new Map<string,EquipmentPiece|null>();
for (const piece of availableEquipment) equipmentNames.set(norm(piece.name), [...(equipmentNames.get(norm(piece.name)) || []), piece]);
export function equipment(name: string, id?: number) {
  const cacheKey=name+'|'+(id||'');
  if(equipmentCache.has(cacheKey))return copyPiece(equipmentCache.get(cacheKey));
  const key = norm((name === 'Imbued god cape' ? 'Imbued Saradomin cape' : name).replace(/ \(u\)$/, ''));
  const matches = equipmentNames.get(key) || [];
  const scored = matches.map(p => ({ p, score: (/Uncharged|Empty|Broken|Inactive|Degraded|^0$/i.test(p.version) ? -100 : 0) + (/Charged|Fully charged|Normal|New/i.test(p.version) ? 10 : /^\d+$/.test(p.version)?Number(p.version)/10:0) + (p.id === id ? 2 : 0) }));
  const found=scored.sort((a,b) => b.score-a.score)[0]?.p || availableEquipment.find(p => p.id === id);
  const canonical=found?getCanonicalItem(found):null;equipmentCache.set(cacheKey,canonical);return copyPiece(canonical);
}
// Calculator instances receive their own writable item variables and stats;
// immutable catalogue data is looked up once, without JSON round-tripping.
function copyPiece(piece:EquipmentPiece|null|undefined):EquipmentPiece|null{return piece?{...piece,bonuses:{...piece.bonuses},offensive:{...piece.offensive},defensive:{...piece.defensive},...(piece.itemVars?{itemVars:{...piece.itemVars}}:{})}:null;}
function copyPlayer(p:Player,style:any):Player{return{...p,skills:{...p.skills},boosts:{...p.boosts},equipment:Object.fromEntries(Object.entries(p.equipment).map(([slot,piece])=>[slot,piece?{...piece,...(piece.itemVars?{itemVars:{...piece.itemVars}}:{})}:null])) as any,buffs:{...p.buffs,potions:[...p.buffs.potions]},prayers:[...p.prayers],bonuses:{...p.bonuses},offensive:{...p.offensive},defensive:{...p.defensive},spell:p.spell?{...p.spell}:null,style};}

export const potionOptions = [
  ['none','No boosts'],['regular','Combat + ranging + magic'],['super','Super combat + ranging + magic'],
  ['imbued','Super combat + ranging + imbued heart'],['saturated','Super combat + ranging + saturated heart'],
  ['overload','Overload (CoX)'],['overloadPlus','Overload (+) (CoX)'],['salts','Smelling salts (ToA)'],['moonlight','Moonlight (Moons)'],
];
export const prayerOptions = [['none','No offensive prayers'],['best','Best eligible prayer'],['mid','15% prayers / Eagle Eye / Mystic Might'],['piety','Piety'],['chivalry','Chivalry'],['rigour','Rigour'],['deadeye','Deadeye'],['eagleEye','Eagle Eye'],['augury','Augury'],['mysticVigour','Mystic Vigour'],['mysticMight','Mystic Might']];
const seekingArrows: Record<string,string> = Object.fromEntries(['dragon','amethyst','rune','adamant','broad','mithril','steel','iron','bronze'].map(tier=>['seeking'+tier[0].toUpperCase()+tier.slice(1),'Seeking '+tier+' arrow'+(tier==='broad'?'s':'')]));
export const ammoOptions = [['adaptive','Auto · ruby / diamond bolts'],['adaptiveDragon','Auto · dragon ammo / enchanted bolts'],['auto','Amethyst ammo · diamond bolts'],['dragon','Dragon ammo · diamond dragon bolts'],['ruby','Dragon ammo · ruby dragon bolts'],['sapphire','Dragon ammo · sapphire dragon bolts'],['rune','Rune ammo · diamond bolts'],...Object.entries(seekingArrows).map(([key,name])=>[key,name+' (bows)'])];
export function slayerTaskAllowed(e:any) {return !e.kind&&(e.task==='required'||targets(e).some(t=>monsterByKey.get(t.key)?.is_slayer_monster));}
export function prayerUnlockEvidence(model:any, players:any[]) {
  return [['Rigour','Dexterous prayer scroll'],['Augury','Arcane prayer scroll'],['Preserve','Torn prayer scroll'],['Deadeye','Deadeye prayer scroll'],['Mystic Vigour','Mystic vigour prayer scroll']].map(([prayer,scroll])=>{
    const ids=[...model.names].filter(([,name]:any)=>norm(name)===norm(scroll)).map(([id]:any)=>id);
    const owners=players.filter(p=>model.known.has(p.key)&&ids.some(id=>(model.counts.get(p.key)?.get(id)||0)>0)).map(p=>p.name||p.key);
    return {prayer,scroll,owners,logged:owners.length>0};
  });
}
export const spellLevels: Record<string,number> = {'Wind Strike':1,'Water Strike':5,'Earth Strike':9,'Fire Strike':13,'Wind Bolt':17,'Water Bolt':23,'Earth Bolt':29,'Fire Bolt':35,'Wind Blast':41,'Water Blast':47,'Earth Blast':53,'Fire Blast':59,'Wind Wave':62,'Water Wave':65,'Earth Wave':70,'Fire Wave':75,'Wind Surge':81,'Water Surge':85,'Earth Surge':90,'Fire Surge':95,'Iban Blast':50,'Magic Dart':50,'Ice Burst':70,'Ice Barrage':94,'Blood Blitz':80,'Blood Barrage':92,'Inferior Demonbane':44,'Superior Demonbane':62,'Dark Demonbane':82,'Saradomin Strike':60,'Claws of Guthix':60,'Flames of Zamorak':60};
export const spellOptions = [['auto','Automatic spell / built-in attack'], ...Object.keys(spellLevels).map(n => [n,n+' ('+spellLevels[n]+')'])];
const skillKeys: Record<string,string> = {atk:'attack',str:'strength',def:'defence',hp:'hitpoints',ranged:'ranged',magic:'magic',prayer:'prayer',mining:'mining',herblore:'herblore'};
function skillsFromLevels(levels: any) { return Object.fromEntries(Object.entries(skillKeys).map(([a,b])=>[a,Math.min(99, Math.max(1, Number(levels?.[b]) || 1))])); }
export const potionAllowed = (key: string, e: any) => key === 'salts' ? raid(e) === 'toa' : key.startsWith('overload') ? raid(e) === 'cox' : key === 'moonlight' ? e.id === 'lunar_chests' : true;
function potions(key: string, style: string) {
  const choices: Record<string,Potion[]> = {none:[],regular:[Potion.ATTACK,Potion.STRENGTH,Potion.RANGING,Potion.MAGIC],super:[Potion.SUPER_COMBAT,Potion.RANGING,Potion.MAGIC],imbued:[Potion.SUPER_COMBAT,Potion.RANGING,Potion.IMBUED_HEART],saturated:[Potion.SUPER_COMBAT,Potion.RANGING,Potion.SATURATED_HEART],overload:[Potion.OVERLOAD],overloadPlus:[Potion.OVERLOAD_PLUS],salts:[Potion.SMELLING_SALTS],moonlight:[Potion.MOONLIGHT]};
  return choices[key] || [];
}
const prayerRequirements: Record<number,[number,number]> = {[Prayer.PIETY]:[70,70],[Prayer.CHIVALRY]:[60,65],[Prayer.RIGOUR]:[74,70],[Prayer.AUGURY]:[77,70],[Prayer.DEADEYE]:[62,1],[Prayer.MYSTIC_VIGOUR]:[63,1],[Prayer.EAGLE_EYE]:[44,1],[Prayer.MYSTIC_MIGHT]:[45,1],[Prayer.INCREDIBLE_REFLEXES]:[34,1],[Prayer.ULTIMATE_STRENGTH]:[31,1],[Prayer.HAWK_EYE]:[26,1],[Prayer.MYSTIC_LORE]:[27,1],[Prayer.IMPROVED_REFLEXES]:[16,1],[Prayer.SUPERHUMAN_STRENGTH]:[13,1],[Prayer.SHARP_EYE]:[8,1],[Prayer.MYSTIC_WILL]:[9,1],[Prayer.CLARITY_OF_THOUGHT]:[7,1],[Prayer.BURST_OF_STRENGTH]:[4,1]};
function prayers(key: string, style: string, s: any, notes: string[]) {
  const can = (p: Prayer) => s.prayer >= (prayerRequirements[p]?.[0] || 1) && s.def >= (prayerRequirements[p]?.[1] || 1);
  const mid = style === 'magic' ? [Prayer.MYSTIC_MIGHT] : style === 'ranged' ? [Prayer.EAGLE_EYE] : [Prayer.INCREDIBLE_REFLEXES,Prayer.ULTIMATE_STRENGTH];
  if (key === 'none') return [];
  if (key === 'best') {
    const ranked = style === 'magic' ? [Prayer.AUGURY,Prayer.MYSTIC_VIGOUR,Prayer.MYSTIC_MIGHT,Prayer.MYSTIC_LORE,Prayer.MYSTIC_WILL] : style === 'ranged' ? [Prayer.RIGOUR,Prayer.DEADEYE,Prayer.EAGLE_EYE,Prayer.HAWK_EYE,Prayer.SHARP_EYE] : [Prayer.PIETY,Prayer.CHIVALRY];
    const top = ranked.find(can); if (top !== undefined) return [top];
    return [Prayer.INCREDIBLE_REFLEXES,Prayer.ULTIMATE_STRENGTH].filter(can);
  }
  if (key === 'mid') return mid.filter(p => {if (!can(p)) notes.push(PrayerMap[p].name+' is above this player’s level.');return can(p);});
  const named: Record<string,Prayer> = {piety:Prayer.PIETY,chivalry:Prayer.CHIVALRY,rigour:Prayer.RIGOUR,deadeye:Prayer.DEADEYE,eagleEye:Prayer.EAGLE_EYE,augury:Prayer.AUGURY,mysticVigour:Prayer.MYSTIC_VIGOUR,mysticMight:Prayer.MYSTIC_MIGHT};
  const p = named[key]; if (p === undefined) return [];
  if (!can(p)) { notes.push(PrayerMap[p].name+' requires higher Prayer/Defence; no offensive prayer applied.');return []; }
  return [p];
}
function ammunition(p: Player, key: string, target: Monster, label: string, notes: string[]) {
  const weapon = p.equipment.weapon!, cat = weapon.category;
  const dragon = ['dragon','ruby','sapphire','seekingDragon','adaptiveDragon'].includes(key);
  let name = '';
  if (BLOWPIPE_IDS.includes(weapon.id)) {
    name = key === 'rune' ? 'Rune dart' : dragon ? 'Dragon dart' : 'Amethyst dart';
    const dart = equipment(name); if (dart) weapon.itemVars = {blowpipeDartId:dart.id,blowpipeDartName:dart.name};
  } else if (weapon.name.includes('ballista')) name = dragon ? 'Dragon javelin' : 'Amethyst javelin';
  else if (cat === 'Crossbow') {
    const dragonCompatible = !['Rune crossbow','Dorgeshuun crossbow'].includes(weapon.name);
    const gem = label === 'Prayer shield' || key === 'sapphire' ? 'Sapphire' : key === 'ruby'||key==='rubyNormal' ? 'Ruby' : 'Diamond';
    name = gem + (dragon && dragonCompatible ? ' dragon bolts (e)' : ' bolts (e)');
  } else if (weapon.name === 'Eclipse atlatl') name = 'Atlatl dart';
  else if (cat === 'Bow' && !/faerdhinen|Crystal bow|Craw|Webweaver/i.test(weapon.name)) {
    name = seekingArrows[key] || (key === 'rune' ? 'Rune arrow' : dragon ? 'Dragon arrow' : 'Amethyst arrow');
  }
  if (name && !BLOWPIPE_IDS.includes(weapon.id)) {
    const preferred=[name,...(cat==='Crossbow'?['Diamond bolts (e)','Runite bolts']:['Amethyst arrow','Rune arrow'])].map(n=>equipment(n)).find(p=>p&&ammoApplicability(weapon.id,p.id)===AmmoApplicability.INCLUDED);
    const fallback=preferred||availableEquipment.filter(p=>p.slot==='ammo'&&ammoApplicability(weapon.id,p.id)===AmmoApplicability.INCLUDED).sort((a,b)=>b.bonuses.ranged_str-a.bonuses.ranged_str)[0];
    if(fallback&&fallback.name!==name)notes.push(name+' is incompatible with '+weapon.name+'; the ammo preset uses '+fallback.name+'.');
    p.equipment.ammo=fallback?clone(fallback):null;name=fallback?.name||'';
  }
  return name;
}
function selectSpell(p: Player, target: Monster, selected: string) {
  const weapon = p.equipment.weapon!;
  const powered = ['Powered Staff','Powered Wand'].includes(weapon.category);
  if (powered) return null;
  if (selected !== 'auto') return spells.find(s => s.name === selected) || null;
  if (/Purging|Slayer's staff/.test(weapon.name)) {
    const name = /Purging/.test(weapon.name) ? ['Dark Demonbane','Superior Demonbane','Inferior Demonbane'].find(n=>p.skills.magic+p.boosts.magic>=spellLevels[n]) : 'Magic Dart';
    return spells.find(s=>s.name===name)||null;
  }
  if (/Iban/.test(weapon.name)) return spells.find(s=>s.name==='Iban Blast')||null;
  const element = target.weakness?.element || 'fire';
  return [...spells].reverse().filter(s=>s.element===element && spellLevels[s.name] && p.skills.magic+p.boosts.magic>=spellLevels[s.name]).sort((a,b)=>spellLevels[b.name]-spellLevels[a.name])[0] || null;
}
export function calculateSet(input: any): any {
  const { encounter:e, row, setIndex=0, levels={}, context={}, modifiers={}, analysis=false, specialAttack=false } = input;
  const set = row.sets[setIndex];
  if (!set || e.kind) return {status:'unavailable',reason:'This activity does not use a standard equipped combat setup.'};
  if (!set.slots.weapon?.name) return {status:'unavailable',reason:'No weapon is assigned to this setup.'};
  const inputSlots=set.weaponOnly?{...row.sets[0].slots,...set.slots}:set.slots;
  if(['adaptive','adaptiveDragon'].includes(modifiers.ammo)&&set.style==='ranged'&&ammoCompatible(set.slots.weapon.name,'Diamond bolts (e)')&&(!inputSlots.ammo?.name||inputSlots.ammo.ammoAssumption||isBlessing(inputSlots.ammo.name))&&!inputSlots.ammo?.locked){
    const keys=modifiers.ammo==='adaptiveDragon'?['ruby','dragon']:['rubyNormal','auto'];
    const attempts=keys.map(ammo=>calculateSet({...input,modifiers:{...modifiers,ammo}})).filter(r=>r.status==='ok').sort((a,b)=>b.dps-a.dps);
    if(attempts.length){const best=attempts[0];return{...best,ammoAlternatives:attempts.map(r=>({name:r.ammo,dps:r.dps})),notes:[...best.notes,'Auto ammo compares ruby and diamond bolts at the selected target HP. It does not simulate switching bolts during a kill.']};}
  }
  const missing = ['attack','strength','defence','hitpoints','ranged','magic','prayer'].filter(k=>!Number.isFinite(Number(levels[k])) || Number(levels[k])<1);
  if (missing.length) return {status:'unavailable',reason:'Saved player stats are missing: '+missing.join(', ')+'.'};
  const room=raidRoom(e,context.raidRoom);
  if(room?.reason)return{status:'unavailable',reason:room.reason};
  const choices = roomTargets(e,context.raidRoom), choice = context.target && context.target !== 'auto' ? choices.find(m=>m.key===context.target) : automaticTarget(e,set,choices,context.raidRoom);
  if (!choice) return {status:'unavailable',reason:'No verified monster data for this phase. Select a target phase above.'};
  if (choice.name==='Phantom Muspah'&&choice.version==='Shielded')return {status:'unavailable',reason:'Muspah’s prayer shield needs prayer damage. Normal HP DPS does not model sapphire bolts or Smite; use the crossbow switch.'};
  const base = monsterByKey.get(choice.key)!;
  const notes: string[] = [], skillValues = skillsFromLevels(levels);
  const party = context.partyLevels?.length ? context.partyLevels.map(skillsFromLevels) : [skillValues];
  const monster: Monster = { ...clone(base), inputs:{...clone(INITIAL_MONSTER_INPUTS),isFromCoxCm:e.id.endsWith('challenge_mode'),toaInvocationLevel:bounded(context.invocation,e.id.endsWith('expert')?350:150,0,600),toaPathLevel:bounded(context.pathLevel,0,0,6),partySize:bounded(context.partySize,row.partySize||1,1,100),partyMaxCombatLevel:Math.max(...party.map(calculateCombatLevel)),partyMaxHpLevel:Math.max(...party.map((s:any)=>s.hp)),partySumMiningLevel:party.reduce((n:number,s:any)=>n+s.mining,0),monsterCurrentHp:base.skills.hp,defenceReductions:{...clone(INITIAL_MONSTER_INPUTS.defenceReductions),...cleanReductions(context.reductions)}}};
  const scaled = scaleMonster(monster);
  monster.inputs.monsterCurrentHp = bounded(context.currentHp,Math.max(1,Math.floor(scaled.skills.hp * bounded(context.hpPercent,100,1,100)/100)),1,scaled.skills.hp);
  const undrained=scaleMonster({...monster,inputs:{...monster.inputs,defenceReductions:cleanReductions()}});
  const current = scaleMonster(monster);
  const emptyEquipment = Object.fromEntries(['head','cape','neck','ammo','weapon','body','shield','legs','hands','feet','ring'].map(k=>[k,null]));
  const slots = set.weaponOnly ? {...row.sets[0].slots,...set.slots} : set.slots;
  const p: Player = {name:row.player.name,skills:skillValues as any,boosts:Object.fromEntries(Object.keys(skillKeys).map(k=>[k,0])) as any,equipment:emptyEquipment as any,style:{name:'',type:null,stance:null},attackSpeed:4,prayers:[],bonuses:{str:0,ranged_str:0,magic_str:0,prayer:0},offensive:{stab:0,slash:0,crush:0,magic:0,ranged:0},defensive:{stab:0,slash:0,crush:0,magic:0,ranged:0},buffs:{potions:[],onSlayerTask:!!context.onTask || e.task==='required',inWilderness:/^(artio|callisto|calvarion|vetion|venenatis|spindel|chaos_|crazy_|scorpia)/.test(e.id),forinthrySurge:false,soulreaperStacks:bounded(modifiers.stacks,0,0,5),baAttackerLevel:0,chinchompaDistance:4,kandarinDiary:!!modifiers.kandarin,chargeSpell:false,markOfDarknessSpell:!!modifiers.markOfDarkness,usingSunfireRunes:false,fragmentOfWind:false,fragmentOfWater:false,fragmentOfEarth:false,fragmentOfFire:false},spell:null};
  for (const [slot,v] of Object.entries(slots) as any) {
    if (!v.name) continue;
    const found = equipment(v.name,v.id);
    if (!found) return {status:'unavailable',reason:'Combat stats unavailable for '+v.name+'.'};
    (p.equipment as any)[slot==='offhand'?'shield':slot]=found;
  }
  if (!p.equipment.weapon) return {status:'unavailable',reason:'Weapon combat stats are unavailable.'};
  if (p.equipment.weapon.isTwoHanded) p.equipment.shield=null;
  const potion = modifiers.potion || 'none';
  if (!potionAllowed(potion,e)) return {status:'unavailable',reason:'This boost is restricted to a different activity. Choose another potion.'};
  p.buffs.potions = potions(potion,set.style);
  for (const potion of p.buffs.potions) for (const [skill,boost] of Object.entries(PotionMap[potion].calculateFn(p.skills))) if (boost!==undefined) (p.boosts as any)[skill]=Math.max((p.boosts as any)[skill],boost);
  const playerHp=Math.max(1,Math.floor(p.skills.hp*bounded(modifiers.playerHpPercent,100,1,100)/100));p.boosts.hp=playerHp-p.skills.hp;
  p.buffs.usingSunfireRunes=!!modifiers.sunfire;p.buffs.chargeSpell=!!modifiers.charge;p.buffs.forinthrySurge=!!modifiers.forinthry&&p.buffs.inWilderness;
  p.buffs.onSlayerTask=(e.task==='required'||!!context.onTask)&&!!base.is_slayer_monster;
  if(context.onTask&&!base.is_slayer_monster)notes.push('This target is not eligible for Slayer-task damage bonuses.');
  p.prayers = prayers(modifiers.prayer||'none',set.style,p.skills,notes);
  if(p.prayers.length)notes.push('Prayer unlocks are treated as permanent for every account, as confirmed for this group; Prayer and Defence levels still apply.');
  let ammo = '',quiverBlessing:EquipmentPiece|null=null;
  const wornBlessing=isBlessing(p.equipment.ammo?.name||'')?p.equipment.ammo:null;
  const usesQuiver=!!wornBlessing&&!ammoSlotFree(p.equipment.weapon.name)&&ammoSlotFree(p.equipment.weapon.name,p.equipment.cape?.name);
  if (set.style==='ranged') {
    if(usesQuiver){quiverBlessing=wornBlessing;ammo=ammunition(p,modifiers.ammo||'auto',monster,set.label,notes);}
    else if (slots.ammo?.locked || slots.ammo?.name&&!slots.ammo.ammoAssumption&&!wornBlessing) {
      ammo=slots.ammo.name||'';
      if (BLOWPIPE_IDS.includes(p.equipment.weapon.id)) {
        if(p.equipment.ammo&&/ dart$/i.test(p.equipment.ammo.name)){p.equipment.weapon.itemVars={blowpipeDartId:p.equipment.ammo.id,blowpipeDartName:p.equipment.ammo.name};p.equipment.ammo=null;}
        else ammo=ammunition(p,modifiers.ammo||'auto',monster,set.label,notes);
      }
    } else ammo=ammunition(p,modifiers.ammo||'auto',monster,set.label,notes);
  }
  if(wornBlessing){
    if(!ammoSlotFree(p.equipment.weapon.name,p.equipment.cape?.name))return{status:'unavailable',reason:'This weapon needs compatible ammunition in the ammo slot. Replace the blessing with the required ammo or use a quiver that can hold its arrows or bolts.'};
    notes.push('The blessing supplies Prayer bonus; it does not directly increase damage or accuracy.');
    if(usesQuiver)notes.push('Arrows or bolts are stored in Dizana’s quiver; the blessing stays in the normal ammo slot.');
  }
  if(p.equipment.ammo&&!wornBlessing&&ammoApplicability(p.equipment.weapon.id)!==AmmoApplicability.ALLOWED&&!ammoCompatible(p.equipment.weapon.name,p.equipment.ammo.name))return{status:'unavailable',reason:p.equipment.ammo.name+' is incompatible with '+p.equipment.weapon.name+'.'};
  if(ammo.includes('Seeking')&&p.equipment.weapon.category==='Bow')notes.push('Seeking arrows add +20 Ranged accuracy and raise successful hits below 3 to 3; misses remain zero.');
  if(p.buffs.onSlayerTask)notes.push('Matching Slayer task is active. Eligible black masks / Slayer helmets apply their combat bonuses; Salve does not stack with them.');
  if(set.style==='melee'&&[p.equipment.head,p.equipment.body,p.equipment.legs].some(piece=>piece?.name.startsWith('Inquisitor')))notes.push('Inquisitor’s crush accuracy/damage bonus: helm 0.5%, body 1%, legs 1%; each applies only when using crush.');
  if (set.style==='magic') {
    p.spell = selectSpell(p,monster,modifiers.spell||'auto');
    if (p.spell && p.skills.magic+p.boosts.magic < (spellLevels[p.spell.name]||1)) return {status:'unavailable',reason:p.spell.name+' exceeds the boosted Magic level.'};
    if (!p.spell && !['Powered Staff','Powered Wand'].includes(p.equipment.weapon.category)) return {status:'unavailable',reason:'Choose a usable combat spell for this weapon.'};
  }
  let styles = getCombatStylesForCategory(p.equipment.weapon.category).filter(s=>set.style==='magic'?s.type==='magic'&&s.stance!=='Defensive Autocast' : set.style==='ranged'?s.type==='ranged'&&s.stance==='Rapid' : ['stab','slash','crush'].includes(s.type||'')&&s.stance!=='Defensive');
  if (set.style==='magic') styles=[styles.find(s=>s.stance!=='Manual Cast') || styles[0]].filter(Boolean);
  if (set.style==='melee' && modifiers.style && modifiers.style!=='auto') styles=styles.filter(s=>s.type===modifiers.style);
  if (!styles.length) return {status:'unavailable',reason:'This weapon cannot use the selected attack style.'};
  const results = styles.map(style=>{
    const player=copyPlayer(p,style);Object.assign(player,calculateEquipmentBonusesFromGear(player,monster));if(quiverBlessing)player.bonuses.prayer+=quiverBlessing.bonuses.prayer;player.attackSpeed=calculateAttackSpeed(player,monster);
    const calc=new PlayerVsNPCCalc(player,monster,{loadoutName:row.player.name,detailedOutput:!!analysis,usingSpecialAttack:!!specialAttack});
    return {calc,player,dps:calc.getDps()};
  }).sort((a,b)=>b.dps-a.dps);
  const {calc,player,dps}=results[0];
  const invalid=calc.userIssues.find(i=>[UserIssueType.SPELL_WRONG_WEAPON,UserIssueType.SPELL_WRONG_MONSTER,UserIssueType.EQUIPMENT_WRONG_AMMO,UserIssueType.EQUIPMENT_MISSING_AMMO].includes(i.type));
  if(invalid)return{status:'unavailable',reason:invalid.message};
  if(specialAttack&&![FeatureStatus.IMPLEMENTED,FeatureStatus.PARTIALLY_IMPLEMENTED].includes(calc.isSpecSupported()))return{status:'unavailable',reason:'This weapon’s special attack is not supported for this setup/target.'};
  for (const issue of calc.userIssues) if ((issue as any).message) notes.push((issue as any).message);
  if (set.weaponOnly) notes.push('Weapon switch calculated with this player’s main armour.');
  const emptySlots=Object.entries(slots).filter(([_,v]:any)=>v.source==='missing' && !v.name).length;
  if (emptySlots) notes.push(emptySlots+' empty equipment slot'+(emptySlots===1?'':'s')+' treated as unequipped.');
  if (ammo) notes.push('Ammo assumed: '+ammo+(usesQuiver?' · stored in quiver':'')+'.');
  if (p.spell) notes.push('Spell: '+p.spell.name+'.');
  if(playerHp!==p.skills.hp)notes.push('Player current HP: '+playerHp+' / '+p.skills.hp+'. HP-sensitive effects use this value.');
  if (!Number.isFinite(dps)) return {status:'unavailable',reason:'This combination is not supported by the combat engine.'};
  const detail = analysis ? combatAnalysis(calc,player,monster,specialAttack) : {};
  return {status:'ok',...detail,dps,maxAttackRoll:calc.getMaxAttackRoll(),maxHit:calc.getDistribution().getMax(),accuracy:calc.getDisplayHitChance(),attackTicks:calc.getExpectedAttackSpeed(),baseAttackTicks:player.attackSpeed,expectedDamage:calc.getExpectedDamage(),target:choice.label,targetKey:choice.key,targetId:monster.id,hp:current.skills.hp,currentHp:monster.inputs.monsterCurrentHp,defence:current.skills.def,magic:current.skills.magic,defenceFloor:getDefenceFloor(undrained),baseDefence:undrained.skills.def,skills:player.skills,boosts:player.boosts,bonuses:player.bonuses,offensive:player.offensive,defensive:player.defensive,style:player.style,onSlayerTask:p.buffs.onSlayerTask,prayers:player.prayers.map(n=>PrayerMap[n].name),potions:p.buffs.potions.map(n=>PotionMap[n].name),spell:p.spell?.name||null,ammo,ammoInQuiver:usesQuiver,notes:[...new Set(notes)]};
}
function combatAnalysis(calc:PlayerVsNPCCalc,player:Player,monster:Monster,specialAttack:boolean) {
  const distribution=calc.getDistribution().asHistogram().filter(p=>p.value>0).map(p=>({damage:Number(p.name),probability:p.value}));
  const details=calc.details.map(d=>({label:d.label,formula:d.displayValue}));
  const effects=details.filter(d=>/black mask|salve|void|inquisitor|fang|dragonhunter|demonbane|obsidian|berserker|tome|spellement|sunfire|soulreaper|revenant|ratbane|golembane|confliction|wardens/i.test(d.label));
  const issues=calc.userIssues.map(i=>i.message).filter(Boolean);
  const hp=monster.inputs.monsterCurrentHp||monster.skills.hp;
  const ttk=!specialAttack&&calc.getExpectedDamage()>0&&hp<=10000?expectedAttackTime(calc,player,monster,hp):null;
  const cost=specialAttack?calc.getSpecCost():undefined;
  const regen=cost?cost*(player.equipment.ring?.name==='Lightbearer'?1.5:3):null;
  return{distribution,details,effects,issues,ttk:Number.isFinite(ttk)?ttk:null,npcDefenceRoll:calc.getNPCDefenceRoll(),playerCurrentHp:player.skills.hp+player.boosts.hp,dotExpected:calc.getDoTExpected(),specialAttack,partialSpecial:specialAttack&&calc.isSpecSupported()===FeatureStatus.PARTIALLY_IMPLEMENTED,specCost:cost??null,specRecoverySeconds:regen};
}
// Backward HP-state DP uses the upstream hit distributions and conditional
// delays. Unlike HP / DPS or a fixed histogram, ruby damage and supported target
// HP effects are re-evaluated as HP falls. Counts the full attack interval of the
// killing attack, matching the planner's active-attacking time convention.
function expectedAttackTime(calc:PlayerVsNPCCalc,player:Player,monster:Monster,startHp:number) {
  const base=calc.getDistribution().singleHitsplat.withProbabilisticDelays(calc.getWeaponDelayProvider());
  const dynamic=calc.distIsCurrentHpDependent(player,monster),times=new Float64Array(startHp+1);
  const summarise=(dist:typeof base)=>({hits:dist.map(([hit,delay])=>({damage:hit.getSum(),probability:hit.probability,delay})),zero:dist.reduce((sum,[hit])=>sum+(hit.getSum()===0?hit.probability:0),0)});
  const initial=summarise(base);
  for(let hp=1;hp<=startHp;hp++){
    const dist=dynamic?calc.distAtHp(base,hp):base,info=dist===base?initial:summarise(dist);if(info.zero>=1-1e-14)return null;
    let value=0;for(const hit of info.hits)value+=hit.probability*(hit.delay+(hit.damage>0?times[Math.max(0,hp-hit.damage)]:0));
    times[hp]=value/(1-info.zero);
  }
  return times[startHp]*.6;
}
export function calculateSpecial(input:any) {
  const {row}=input;if(!row.special?.name||!row.sets[0])return{status:'unavailable',reason:'No special-attack weapon is assigned.'};
  const main=row.sets[0],set={label:main.label,style:weaponStyle(row.special.name),slots:{...main.slots,weapon:{...row.special,locked:true},ammo:{name:null}}};
  const result=calculateSet({...input,row:{...row,sets:[set]},setIndex:0,specialAttack:true,analysis:true,context:{...input.context,target:main.dps?.targetKey||input.context?.target}});
  if(result.status==='ok'&&result.specRecoverySeconds){const seconds=result.attackTicks*.6;result.damagePer100Energy=result.expectedDamage*100/result.specCost;result.cycleDps=main.dps?.status==='ok'?main.dps.dps+(result.expectedDamage-main.dps.dps*seconds)/Math.max(seconds,result.specRecoverySeconds):null;result.notes.push('Damage-only cycle estimate: one spec per natural energy recovery, normal attacks otherwise. It excludes debuff gains, movement, Death Charge, adrenaline and overlapping burn behaviour.');}
  return result;
}
function bounded(v:any,fallback:number,min:number,max:number) { return Number.isFinite(Number(v)) && v!==null && v!=='' ? Math.max(min,Math.min(max,Math.trunc(Number(v)))) : fallback; }
export function cleanReductions(r:any={}) { return {vulnerability:r.curse==='vulnerability',accursed:r.curse==='accursed',elderMaul:bounded(r.elderMaul,0,0,20),dwh:bounded(r.dwh,0,0,20),arclight:bounded(r.arclight,0,0,20),emberlight:bounded(r.emberlight,0,0,20),bgs:bounded(r.bgs,0,0,2000),tonalztic:bounded(r.tonalztic,0,0,20),seercull:bounded(r.seercull,0,0,2000),ayak:bounded(r.ayak,0,0,200)}; }

/** One functional entry per name; cosmetic aliases share the same stock row. */
export function catalog(D: any) {
  const known=new Map<string,string>();
  for(const item of Object.values(D.items) as any[]) for(const name of [item.name,...item.aliases||[]]) {known.set(norm(name),item.name);known.set(norm(name.replace(/ \(u\)$/,'')),item.name);}
  const out=new Map<string,any>();
  for(const raw of availableEquipment) {
    const piece=getCanonicalItem(raw), key=norm(piece.name);
    const name=known.get(key)||piece.name;
    if(!D.items[name]) { D.items[name]={name,id:piece.id,personal:!(tradeable as any)[key],twoHanded:piece.isTwoHanded};known.set(key,name); }
    const preferred=equipment(name,D.items[name].id)||piece;D.items[name].twoHanded=preferred.isTwoHanded;
    if(!out.has(name)) out.set(name,{name,id:preferred.id,slot:preferred.slot==='shield'?'offhand':preferred.slot,twoHanded:preferred.isTwoHanded,category:preferred.category});
  }
  for(const item of Object.values(D.items) as any[]){if(out.has(item.name))continue;const p=equipment(item.name,item.id);if(p)out.set(item.name,{name:item.name,id:p.id,slot:p.slot==='shield'?'offhand':p.slot,twoHanded:p.isTwoHanded,category:p.category})}
  return [...out.values()];
}
export function weaponStyle(name:string) {
  const item=equipment(name);if(!item)return 'melee';
  const styles=getCombatStylesForCategory(item.category);
  if(['Powered Staff','Powered Wand','Staff','Bladed Staff','Polestaff'].includes(item.category))return 'magic';
  return styles.some(s=>s.type==='ranged')?'ranged':'melee';
}

export function weaponAttackTypes(name:string) {const item=equipment(name);return item?[...new Set(getCombatStylesForCategory(item.category).filter(s=>['stab','slash','crush'].includes(s.type||'')).map(s=>s.type))]:[];}
export function usesDarts(name:string) {const item=equipment(name);return !!item&&BLOWPIPE_IDS.includes(item.id);}
export function isBlessing(name:string) {return /\bblessing(?: \d)?$/i.test(name);}
export function ammoCompatible(weaponName:string,ammoName:string) {const weapon=equipment(weaponName),ammo=equipment(ammoName);return !!weapon&&!!ammo&&ammoApplicability(weapon.id,ammo.id)===AmmoApplicability.INCLUDED;}
export function ammoSlotFree(name:string,capeName?:string) {
  const item=name?equipment(name):null;if(!item)return false;
  if(ammoApplicability(item.id)===AmmoApplicability.ALLOWED)return true;
  if(!/Dizana.*(?:quiver|max cape)/i.test(capeName||''))return false;
  const ammo=ammunitionFor(name);return /\barrows?\b|\bbolts\b/i.test(ammo);
}

export function ammunitionFor(name:string,key='auto',label='') {const weapon=equipment(name);if(!weapon)return '';return ammunition({equipment:{weapon,ammo:null}} as Player,key,{} as Monster,label,[]);}
