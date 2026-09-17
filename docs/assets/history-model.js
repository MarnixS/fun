(function(root){
'use strict';
const R=typeof module==='object'&&module.exports?require('./history-rates'):root.UGHistoryRates;
const DAY=86400000,COMBAT=new Set(['attack','strength','defence','ranged','magic']);
const TASK_BOSSES=new Set(['abyssal_sire','alchemical_hydra','araxxor','cerberus','grotesque_guardians','kraken','thermonuclear_smoke_devil']);
const SKILL_BOSSES={wintertodt:'firemaking',tempoross:'fishing',zalcano:'mining'};
const FALLBACK={attack:100000,strength:100000,defence:100000,ranged:100000,magic:100000,hitpoints:0,woodcutting:60000,construction:150000,sailing:100000};
const name=k=>k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
function delta(a,b){return valid(a)&&valid(b)?Math.max(0,b-a):0}
// Integrate the same frozen rate schedule over both endpoints. EHP recalculations
// and bonus reallocations must never create an apparent change in activity.
function skillWeight(key,start,end){
 if(key==='hitpoints')return 0;
 if(COMBAT.has(key))return(end-start)/100000;
 const methods=R.skills[key]||[],fallback=FALLBACK[key]||100000;
 if(!methods.length)return(end-start)/fallback;
 let hours=0;for(let i=0;i<methods.length;i++){const lo=Math.max(start,methods[i][0]),hi=Math.min(end,methods[i+1]?.[0]??Infinity);if(hi>lo)hours+=(hi-lo)/(methods[i][1]||fallback)}return hours;
}
function interval(a,b){
 const days=(+new Date(b.createdAt)-+new Date(a.createdAt))/DAY;
 const out={start:a.createdAt,end:b.createdAt,skills:{},bosses:{},xp:0,levels:0,gaps:days>21?1:0,maxGap:days,observations:1,unknown:0,resets:0};
 for(const [key,v] of Object.entries(b.data?.skills||{})){
  if(key==='overall')continue;const old=a.data?.skills?.[key];
  if(!valid(old?.experience)||!valid(v.experience)){out.unknown++;continue}
  if(v.experience<old.experience){out.resets++;continue}
  const xp=delta(old.experience,v.experience),levels=delta(old?.level,v.level);
  if(xp||levels)out.skills[key]={xp,levels,effort:skillWeight(key,old.experience,v.experience)};
  out.xp+=xp;out.levels+=levels;
 }
 for(const [key,v] of Object.entries(b.data?.bosses||{})){
  const old=a.data?.bosses?.[key];
  if(!valid(old?.kills)||!valid(v.kills)){if(valid(v.kills)&&v.kills>0)out.unknown++;continue}
  if(v.kills<old.kills){out.resets++;continue}
  const kc=delta(old.kills,v.kills);if(kc)out.bosses[key]={kc,effort:kc/(R.bosses[key]||({wintertodt:12,tempoross:10,zalcano:20}[key])||30),estimated:!R.bosses[key]};
 }
 return out;
}
function merge(a,b){
 const out={...a,end:b.end,xp:a.xp+b.xp,levels:a.levels+b.levels,gaps:a.gaps+b.gaps,maxGap:Math.max(a.maxGap||0,b.maxGap||0),observations:(a.observations||1)+(b.observations||1),unknown:(a.unknown||0)+(b.unknown||0),resets:(a.resets||0)+(b.resets||0),skills:{},bosses:{}};
 for(const kind of ['skills','bosses'])for(const key of new Set([...Object.keys(a[kind]),...Object.keys(b[kind])])){
  out[kind][key]={};for(const field of kind==='skills'?['xp','levels','effort']:['kc','effort'])out[kind][key][field]=(a[kind][key]?.[field]||0)+(b[kind][key]?.[field]||0);
  if(kind==='bosses')out[kind][key].estimated=!!(a[kind][key]?.estimated||b[kind][key]?.estimated);
 }return out;
}
function describe(e){
 const bosses=Object.entries(e.bosses).map(([key,v])=>({key,...v,score:v.effort??v.kc/(R.bosses[key]||30)}));
 const skills=Object.entries(e.skills).map(([key,v])=>({key,...v,score:v.effort??v.xp/(FALLBACK[key]||100000),overlap:0}));
 const bySkill=Object.fromEntries(skills.map(x=>[x.key,x])),notes=[];
 // A skilling boss and its main skill are two observations of the same activity.
 for(const b of bosses){const sk=bySkill[SKILL_BOSSES[b.key]];if(sk){const overlap=Math.min(sk.score,b.score*2);b.score=Math.max(b.score,overlap);sk.overlap=overlap;sk.score-=overlap;notes.push('Primary '+name(sk.key)+' XP overlapping '+name(b.key)+' is counted once; excess XP stays separate.')}}
 const taskHours=bosses.filter(b=>TASK_BOSSES.has(b.key)).reduce((n,b)=>n+b.score,0);
 const slayer=bySkill.slayer;if(slayer&&taskHours){const overlap=Math.min(slayer.score,taskHours);slayer.score-=overlap;slayer.overlap+=overlap;notes.push('Task-only bossing and Slayer are counted once; additional Slayer evidence remains separate.')}
 // A bounded allowance, not blanket suppression: a handful of kills cannot erase
 // millions of independently trained combat XP. HP is always supporting evidence.
 const combatXp=skills.filter(s=>COMBAT.has(s.key)).reduce((n,s)=>n+s.xp,0);
 const combatBossHours=bosses.filter(b=>!SKILL_BOSSES[b.key]).reduce((n,b)=>n+b.score,0);
 const allowance=combatBossHours*600000+(bySkill.slayer?.xp||0)*4;
 const residual=combatXp?Math.max(0,combatXp-allowance)/combatXp:0;
 for(const s of skills)if(COMBAT.has(s.key)){s.overlap=s.score*(1-residual);s.score*=residual}
 if(bySkill.hitpoints){bySkill.hitpoints.overlap=bySkill.hitpoints.effort;bySkill.hitpoints.score=0}
 if(combatXp&&allowance)notes.push('Combat XP plausibly earned during bossing or Slayer is supporting evidence. Excess combat XP still counts as training.');
 const candidates=[...bosses.map(b=>({...b,category:SKILL_BOSSES[b.key]?'skilling':'bossing',source:'boss'})),...skills.filter(s=>s.score>0).map(s=>({...s,category:COMBAT.has(s.key)?'combat':'skilling',source:'skill'}))].filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
 const total=candidates.reduce((n,x)=>n+x.score,0),top=candidates[0];let kind='quiet',type='No recorded gains',signature='quiet';
 const totals={bossing:0,skilling:0,combat:0};for(const c of candidates)totals[c.category]+=c.score;
 const groups=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
 if(total){
  if(top.score/total>=.60){kind=top.category;type=COMBAT.has(top.key)?name(top.key)+' training':name(top.key);signature=top.source+':'+top.key}
  else if(groups[0][1]/total>=.65){kind=groups[0][0];type={bossing:'Varied bossing',skilling:'Varied skilling',combat:'Combat training'}[kind];signature=kind;if(top.category===kind&&top.score/groups[0][1]>=.60){type=(kind==='bossing'?'Bossing':kind==='skilling'?'Skilling':'Combat')+' · mainly '+name(top.key);signature=kind+':'+top.key}}
  else{kind='mixed';type=groups.filter(x=>x[1]/total>=.25).map(x=>({bossing:'Bossing',skilling:'skilling',combat:'combat training'}[x[0]])).join(' + ')||'Mixed activity';signature='mixed'}
 }
 if(!total&&(e.unknown||e.resets)){type='Insufficient comparable data';signature='unknown';kind='unknown'}
 const share=total?top.score/total:0;
 const confidence=e.gaps?'Sparse history':e.resets||e.unknown?'Incomplete evidence':total<2?'Small sample':share>=.75?'Clear lead':share>=.60?'Likely focus':'No clear single focus';
 const headline=e.gaps&&total?'Mixed or changing activity':type;
 if(e.gaps)notes.push('More than 21 days between observations: these totals cannot establish one continuous grind or its timing.');
 if(e.unknown)notes.push('New or unranked metrics without a valid baseline are excluded.');
 if(e.resets)notes.push('Decreasing counters are excluded; this interval may contain a correction.');
 if(bosses.some(b=>b.estimated))notes.push('Some activities use approximate rates because no WOM boss rate is available.');
 return {...e,type:headline,focus:type,signature:e.gaps?'sparse':signature,kind:e.gaps?'unknown':kind,confidence,notes,weights:candidates,totalWeight:total,share,skillsRanked:skills.sort((a,b)=>b.score-a.score||b.xp-a.xp),bossesRanked:bosses.sort((a,b)=>b.score-a.score),kc:bosses.reduce((n,x)=>n+x.kc,0)};
}
function eras(snapshots,{windowDays=7}={}){
 const unique=new Map();for(const s of snapshots||[])if(s?.data&&Number.isFinite(+new Date(s.createdAt)))unique.set(+new Date(s.createdAt),s);
 const arr=[...unique.values()].sort((a,b)=>+new Date(a.createdAt)-+new Date(b.createdAt)),buckets=[];let pending=null;
 const flush=()=>{if(pending){buckets.push(pending);pending=null}};
 for(let i=1;i<arr.length;i++){
  const e=interval(arr[i-1],arr[i]);
  if(e.gaps||e.resets){flush();buckets.push(e);continue}
  if(pending&&(+new Date(e.end)-+new Date(pending.start))/DAY>windowDays)flush();
  pending=pending?merge(pending,e):e;
  if((+new Date(pending.end)-+new Date(pending.start))/DAY>=windowDays)flush();
 }flush();
 const similar=(a,b)=>{const aw=new Map(a.weights.map(x=>[x.source+':'+x.key,x.score/(a.totalWeight||1)]));return a.totalWeight===0&&b.totalWeight===0||b.weights.reduce((n,x)=>n+Math.min(aw.get(x.source+':'+x.key)||0,x.score/(b.totalWeight||1)),0)>=.7};
 const periods=[];for(const b of buckets){const e=describe(b),prev=periods.at(-1);if(prev&&!prev.gaps&&!e.gaps&&!prev.resets&&!e.resets&&e.signature===prev.signature&&similar(prev,e)&&(+new Date(e.end)-+new Date(prev.start))/DAY<=42){periods[periods.length-1]=describe(merge(prev,e))}else periods.push(e)}return periods;
}
function compareEvents(a,b){return b.date-a.date||String(a.key).localeCompare(String(b.key))||String(a.type).localeCompare(String(b.type))||String(a.metric||'').localeCompare(String(b.metric||''))||((b.level||0)-(a.level||0))}
const api={interval,merge,describe,eras,compareEvents,skillWeight};if(typeof module==='object'&&module.exports)module.exports=api;else root.UGHistory=api;
})(typeof window==='object'?window:globalThis);
