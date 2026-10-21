'use strict';
// Import owner-provided levels into the canonical shared history. This never
// creates a current profile, invents boss KC, or sends data to WOM.
const fs=require('node:fs'),{thresholds}=require('../docs/assets/cumulative-xp-model');
const SKILLS=['attack','defence','strength','hitpoints','ranged','prayer','magic','cooking','woodcutting','fletching','fishing','firemaking','crafting','smithing','mining','herblore','agility','thieving','slayer','farming','runecrafting','hunter','construction'];
function apply(doc,source){
 const result=structuredClone(doc);result.snapshots??={};const previous=new Map(),summaries=[];
 for(const entry of source.entries.slice().sort((a,b)=>a.date.localeCompare(b.date))){
  const key=entry.player||source.defaultPlayer,profile=result.profiles?.[key];
  if(!profile)throw Error('Unknown historical player: '+key);
  const createdAt=entry.date+'T00:00:00.000Z';if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Number.isFinite(Date.parse(createdAt))||new Date(createdAt).toISOString().slice(0,10)!==entry.date)throw Error('Invalid historical date');
  const inherited=entry.carryForward||[],levels={...entry.levels};
  for(const skill of inherited){if(!previous.get(key)?.[skill])throw Error('No earlier supplied level for '+skill);levels[skill]=previous.get(key)[skill]}
  if(SKILLS.some(skill=>!Number.isInteger(levels[skill])||levels[skill]<1||levels[skill]>99)||Object.keys(levels).some(skill=>!SKILLS.includes(skill)))throw Error('Every historical base skill must be accounted for');
  const derivedLevel=SKILLS.reduce((total,skill)=>total+levels[skill],0),totalLevel=entry.totalLevel??derivedLevel,unallocatedLevels=totalLevel-derivedLevel;
  if(unallocatedLevels<0||unallocatedLevels&&!inherited.length)throw Error('Skill levels do not match the screenshot total');
  const skills=Object.fromEntries(SKILLS.map(metric=>{
   const level=levels[metric],experience=thresholds[level],uncertain=inherited.includes(metric);
   return [metric,{metric,level,experience,rank:-1,experienceRange:{min:experience,max:uncertain||level===99?200000000:thresholds[level+1]-1},...(uncertain?{levelRange:{min:level,max:99},assumed:true}:{})}];
  }));
  skills.overall={metric:'overall',level:totalLevel,experience:SKILLS.reduce((total,skill)=>total+skills[skill].experience,0),rank:-1,experienceRange:{min:SKILLS.reduce((total,skill)=>total+skills[skill].experience,0),max:SKILLS.reduce((total,skill)=>total+skills[skill].experienceRange.max,0)}};
  const row={id:-1,playerId:profile.id,createdAt,importedAt:null,provenance:{kind:'historical-screenshot',datePrecision:'day',xpPolicy:'minimum-level-xp',alias:entry.alias,assumedSkills:inherited,derivedTotalLevel:derivedLevel,unallocatedLevels,...(entry.imageDate?{imageDate:entry.imageDate,dateSource:entry.dateSource}:{}),...(entry.note?{note:entry.note}:{})},data:{skills,bosses:{},activities:{},computed:{}}};
  const rows=result.snapshots[key]||[],existing=rows.findIndex(point=>point.createdAt===createdAt);
  // A genuine snapshot at precisely the same timestamp remains authoritative.
  if(existing<0)rows.push(row);else if(rows[existing].provenance?.kind==='historical-screenshot')rows[existing]=row;
  result.snapshots[key]=rows.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  result.snapshotCounts??={};result.snapshotCounts[key]=rows.length;
  previous.set(key,levels);summaries.push({player:key,date:entry.date,level:totalLevel,minimumXP:skills.overall.experience,unallocatedLevels});
 }
 return {document:result,summaries};
}
if(require.main===module){
 const target='docs/data/wom-cache.json',original=fs.readFileSync(target,'utf8'),source=JSON.parse(fs.readFileSync('docs/data/historical-snapshots.json')),result=apply(JSON.parse(original),source),serialized=JSON.stringify(result.document)+'\n';
 if(process.argv.includes('--check')){if(!require('node:util').isDeepStrictEqual(JSON.parse(original),result.document))throw Error('Historical snapshot import is out of date')}
 else fs.writeFileSync(target,serialized);
 console.table(result.summaries);
}
module.exports={apply,SKILLS};
