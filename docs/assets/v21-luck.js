(()=>{
'use strict';
const U=window.UGV21,M=window.UGClogBetaModel,L=window.UGClogLuck;
if(!U||!M||!L||document.body.dataset.page!=='gim')return;
const {$,$$,fmt,escapeHtml:esc}=U;
let doc=null,wom=null,model=null,selected=U.loadMemberSelection(),view='scored',lens='meaningful',prices=null,priceRequest=null,metricCache=new Map(),excludedCache=new Map();

function selectedPlayers(){return U.PLAYERS.filter(p=>selected.has(p.key)&&model?.known.has(p.key))}
function modelIds(){const ids=new Set(model?.names?.keys?.()||[]);for(const m of model?.counts?.values?.()||[])for(const id of m.keys())ids.add(id);return [...ids]}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function invNorm(p){
 p=clamp(+p,1e-6,1-1e-6);
 const a=[-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239],b=[-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572],c=[-.007784894002430293,-.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783],d=[.007784695709041462,.3224671290700398,2.445134137142996,3.754408661907416],lo=.02425,hi=1-lo;
 if(p<lo){const q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
 if(p>hi){const q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
 const q=p-.5,r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
}
function sig(z){return(z>0?'+':'')+z.toFixed(2)+'σ'}
function signed(n){return(n>0?'+':'')+n.toFixed(2)}
function money(n){if(!Number.isFinite(+n)||+n<=0)return'—';n=+n;return n>=1e9?(n/1e9).toFixed(2)+'b':n>=1e6?(n/1e6).toFixed(1)+'m':n>=1e3?(n/1e3).toFixed(1)+'k':fmt(n)}
function tone(z){return z>.15?'positive':z<-.15?'negative':'neutral'}
function sourceText(m){return(m?.r?.sources||[]).map(x=>String(x.label||x.source||'')).join(' ').toLowerCase()}
const COMMUNITY_RULES=[
 {w:10.0,label:'iconic megarare · account-defining',kind:'major-shareable',re:/^(twisted bow|tumeken's shadow(?: \\(uncharged\\))?)$/i},
 {w:9.0,label:'iconic megarare · account-defining',kind:'major-shareable',re:/^scythe of vitur(?: \\(uncharged\\))?$/i},
 {w:7.6,label:'progression-defining ranged unlock',kind:'major-shareable',re:/^enhanced crystal weapon seed$/i},
 {w:7.0,label:'permanent ranged progression unlock',kind:'personal-unlock',re:/^dexterous prayer scroll$/i},
 {w:6.5,label:'major raid / defence progression tool',kind:'major-shareable',re:/^(elder maul|dragon warhammer)$/i},
 {w:6.1,label:'high-breadth raid weapon',kind:'major-shareable',re:/^osmumten's fang$/i},
 {w:5.8,label:'high-impact special-attack weapon',kind:'major-shareable',re:/^dragon claws$/i},
 {w:5.5,label:'progression-opening demonbane choice',kind:'major-shareable',re:/^tormented synapse$/i},
 {w:5.8,label:'major magic progression / rare permanent utility',kind:'major-shareable',re:/^(imbued heart|saturated heart)$/i},
 {w:4.8,label:'high-impact special-attack progression',kind:'major-shareable',re:/^burning claw$/i},
 {w:5.4,label:'high-breadth utility ring',kind:'shareable',re:/^lightbearer$/i},
 {w:5.0,label:'major specialist weapon',kind:'major-shareable',re:/^(dragon hunter crossbow|kodai insignia|hydra's claw|hydra claw)$/i},
 {w:4.7,label:'major account upgrade',kind:'shareable',re:/^(zamorakian spear|basilisk jaw)$/i},
 {w:4.5,label:'high-impact raid armour',kind:'shareable',re:/^(ancestral hat|ancestral robe top|ancestral robe bottom)$/i},
 {w:4.2,label:'high-impact ranged armour',kind:'shareable',re:/^(masori mask|masori body|masori chaps)$/i},
 {w:4.1,label:'major melee upgrade',kind:'shareable',re:/^(avernic defender hilt|araxtye fang|araxyte fang|primordial crystal|zenyte shard)$/i},
 {w:4.0,label:'major raid armour',kind:'shareable',re:/^(torva full helm|torva platebody|torva platelegs)$/i},
 {w:3.8,label:'high-value raid unique',kind:'shareable',re:/^(dinh's bulwark|twisted buckler)$/i},
 {w:3.4,label:'meaningful PvM equipment',kind:'shareable',re:/^(bandos chestplate|bandos tassets|nightmare staff|inquisitor's mace|elidinis' ward|hydra leather|ferocious gloves|occult necklace|venator bow)$/i},
 {w:3.0,label:'Noxious halberd component',kind:'component',set:'nox',re:/^(noxious point|noxious blade|noxious pommel)$/i},
 {w:2.7,label:'Soulreaper axe component',kind:'component',set:'soulreaper',re:/^(eye of the duke|siren's staff|leviathan's lure|executioner's axe head)$/i},
 {w:2.8,label:'meaningful equipment upgrade',kind:'shareable',re:/^(ultor vestige|magus vestige|venator vestige|bellator vestige|virtus mask|virtus robe top|virtus robe bottom)$/i},
 {w:2.6,label:'useful equipment upgrade',kind:'shareable',re:/^(armadyl crossbow|saradomin sword|staff of the dead|toxic blowpipe|serpentine visage|magic fang|ranger boots)$/i}
];
const PET_RE=/^(nid|noon|midnight|muphin|butch|smolcano|herbi|chompy chick|youngllef|gauntlet pet|ikkle hydra|lil' zik|tumeken's guardian|toa pet|olmlet|sraracha|mole pet|kalphite princess|prince black dragon|pet chaos elemental|pet dagannoth|pet snakeling|abyssal orphan|hellpuppy|skotos|jal-nib-rek|baby chinchompa|rocky|tangleroot|rift guardian|heron|beaver|giant squirrel|rock golem|phoenix)$/i;
const COMPONENT_SETS={
 nox:{names:['noxious point','noxious blade','noxious pommel'],label:'Noxious halberd'},
 soulreaper:{names:['eye of the duke',"siren's staff","leviathan's lure","executioner's axe head"],label:'Soulreaper axe'}
};
let portfolioCache=null;
function fullGroupPlayers(){return U.PLAYERS.filter(p=>model?.known.has(p.key))}
function portfolioCounts(){
 if(portfolioCache)return portfolioCache;
 const map=new Map(),ps=fullGroupPlayers();
 for(const id of modelIds()){
  const name=String(model.names.get(id)||'').trim().toLowerCase();if(!name)continue;
  const q=countFor(id,ps);map.set(name,(map.get(name)||0)+q)
 }
 portfolioCache=map;return map
}
function portfolioCount(name){return portfolioCounts().get(String(name||'').toLowerCase())||0}
function sumPortfolio(regex){let n=0;for(const [name,q] of portfolioCounts())if(regex.test(name))n+=q;return n}
function impactProfile(m){
 const name=String(m?.name||'').trim();
 for(const r of COMMUNITY_RULES)if(r.re.test(name))return{base:r.w,label:r.label,kind:r.kind||'shareable',set:r.set||null};
 const src=sourceText(m),clue=/clue/.test(src);
 if(clue)return{base:.04,label:'clue reward / cosmetic',kind:'cosmetic'};
 if(PET_RE.test(name)||/\bpet\b/i.test(name))return{base:.18,label:'pet / vanity chase',kind:'vanity'};
 if(/^(jar of |.* ornament kit$|.* kit$)/i.test(name)||/ornament|cosmetic|transmog/i.test(name))return{base:.08,label:'cosmetic / vanity',kind:'cosmetic'};
 if(/^(heads?|jars?)$/i.test(name)||/\bhead$|stuffed/i.test(name))return{base:.12,label:'trophy / cosmetic',kind:'cosmetic'};
 if(/chambers of xeric|tombs of amascut|theatre of blood|theater of blood/.test(src))return{base:2.2,label:'raid unique',kind:'shareable'};
 if(/barrows/.test(src))return{base:.65,label:'replaceable equipment',kind:'shareable'};
 if(/gauntlet/.test(src))return{base:1.2,label:'PvM equipment',kind:'shareable'};
 if(/kills|completion|kc|boss|slayer/.test(src))return{base:.95,label:'PvM unique',kind:'shareable'};
 if(/sword|bow|staff|mace|spear|halberd|axe|claw|fang|helm|mask|body|plate|robe|legs|chaps|tassets|boots|gloves|ring|amulet|necklace|shield|ward|defender|hilt|seed|crystal/i.test(name))return{base:.9,label:'equipment / progression',kind:'shareable'};
 return{base:.35,label:'low-impact collection item',kind:'low-impact'}
}
function marginalCurve(profile){
 if(profile.kind==='personal-unlock')return{curve:[1,1,1,1,1],tail:.04};
 if(profile.kind==='major-shareable')return{curve:[1,.86,.74,.63,.53],tail:.16};
 if(profile.kind==='shareable')return{curve:[1,.74,.57,.44,.34],tail:.12};
 return{curve:[1],tail:1}
}
function marginalAt(q,profile){
 const x=marginalCurve(profile),i=Math.max(0,Math.floor(+q||0));return i<x.curve.length?x.curve[i]:x.tail
}
function averageMarginal(q,profile){
 q=Math.max(0,Math.floor(+q||0));if(q<=0)return 1;
 let total=0;for(let i=0;i<q;i++)total+=marginalAt(i,profile);
 return total/q
}
function copyUtility(profile,m){return averageMarginal(portfolioCount(m.name),profile)}
function itemIdByName(name){
 const low=String(name||'').toLowerCase();for(const id of modelIds())if(String(model.names.get(id)||'').toLowerCase()===low)return +id;return null
}
function completedUntradeableSets(set){
 const ids=set.names.map(itemIdByName);if(ids.some(x=>x==null))return 0;
 let complete=0;
 for(const p of fullGroupPlayers()){
  const counts=ids.map(id=>model.counts.get(p.key)?.get(+id)||0);
  complete+=Math.min(...counts)
 }
 return complete
}
function componentUtility(profile){
 if(!profile.set||!COMPONENT_SETS[profile.set])return{f:1,label:null};
 const set=COMPONENT_SETS[profile.set],complete=completedUntradeableSets(set),pieces=set.names.filter(n=>portfolioCount(n)>0).length;
 if(complete>0)return{f:clamp(1.35+.12*Math.min(complete-1,3),1,1.7),label:complete+' complete '+set.label+(complete===1?'':'s')+' assembled by individual group members'};
 return{f:.45+.15*pieces,label:pieces+'/'+set.names.length+' component types represented, but no confirmed complete set on one member'}
}
function exactPortfolio(name){return portfolioCount(name)}
function setCapacity(names){return Math.min(...names.map(exactPortfolio))}
function matchedFraction(a,b){a=Math.max(0,+a||0);b=Math.max(0,+b||0);return a>0?Math.min(a,b)/a:0}
function synergyUtility(m,profile){
 const n=String(m.name||'').toLowerCase(),reasons=[];let f=1;
 const tbow=exactPortfolio('twisted bow'),dex=exactPortfolio('dexterous prayer scroll');
 const shadow=exactPortfolio("tumeken's shadow (uncharged)"),enhanced=exactPortfolio('enhanced crystal weapon seed'),armourSeeds=exactPortfolio('crystal armour seed');
 const masoriSet=setCapacity(['masori mask','masori body','masori chaps']);
 const ancNames=['ancestral hat','ancestral robe top','ancestral robe bottom'],ancPieces=ancNames.reduce((x,name)=>x+Math.min(exactPortfolio(name),Math.max(1,shadow)),0);
 const claws=exactPortfolio('dragon claws')+exactPortfolio('burning claw'),zcb=exactPortfolio('zaryte crossbow'),lb=exactPortfolio('lightbearer');
 const spec=Math.max(0,claws+zcb);
 // Each side receives roughly half of a capped interaction bonus.
 if(n==='twisted bow'&&dex>0){const x=.06*matchedFraction(tbow,dex);f+=x;if(x>.005)reasons.push('matched Rigour capacity')}
 if(n==='dexterous prayer scroll'&&tbow>0){const x=.06*matchedFraction(dex,tbow);f+=x;if(x>.005)reasons.push('matched Tbow capacity')}
 if(n==='twisted bow'&&masoriSet>0){const x=.03*matchedFraction(tbow,masoriSet);f+=x;if(x>.005)reasons.push('complete Masori loadout support')}
 if(/^masori (mask|body|chaps)$/.test(n)&&tbow>0){const piece=exactPortfolio(n),x=.03*matchedFraction(piece,tbow);f+=x;if(x>.005)reasons.push('Tbow loadout support')}
 if(n==="tumeken's shadow (uncharged)"&&ancPieces>0){const coverage=shadow>0?Math.min(1,ancPieces/(3*shadow)):0,x=.06*coverage;f+=x;if(x>.005)reasons.push('Ancestral magic-damage support')}
 if(/^ancestral (hat|robe top|robe bottom)$/.test(n)&&shadow>0){const x=.06*matchedFraction(exactPortfolio(n),shadow);f+=x;if(x>.005)reasons.push('Shadow loadout support')}
 if(n==='enhanced crystal weapon seed'&&armourSeeds>=6){const sets=Math.floor(armourSeeds/6),x=.06*matchedFraction(enhanced,sets);f+=x;if(x>.005)reasons.push('crystal armour capacity')}
 if(n==='lightbearer'&&spec>0){const x=.05*matchedFraction(lb,spec);f+=x;if(x>.005)reasons.push('matched special-attack weapon capacity')}
 if((n==='dragon claws'||n==='burning claw'||n==='zaryte crossbow')&&lb>0){const q=exactPortfolio(n),x=.05*matchedFraction(q,lb);f+=x;if(x>.005)reasons.push('Lightbearer support')}
 const component=componentUtility(profile);f*=component.f;if(component.label)reasons.push(component.label);
 return{f:clamp(f,.35,1.30),label:reasons.join(' · ')||null}
}
function geModifier(gp){if(!Number.isFinite(+gp)||+gp<=0)return 1;const x=clamp((Math.log10(+gp)-5)/5,0,1);return .94+.12*x}
function rollGroupReliability(g){
 const src=String(g?.source||''),player=String(g?.player||'').toLowerCase();
 if(src==='CHAMBERS_OF_XERIC_COMPLETIONS'||src==='CHAMBERS_OF_XERIC_CM_COMPLETIONS')return player==='big dog aura'?.82:.90;
 if(src==='TOMBS_OF_AMASCUT_COMPLETIONS'||src==='TOMBS_OF_AMASCUT_EXPERT_COMPLETIONS')return .90;
 if(src==='THEATRE_OF_BLOOD_COMPLETIONS'||src==='THEATRE_OF_BLOOD_HARD_COMPLETIONS')return .85;
 if(/^(NIGHTMARE_KILLS|HUEYCOATL_KILLS|ROYAL_TITAN_KILLS|CALLISTO_KILLS|VENENATIS_KILLS|VETION_KILLS|ZALCANO_KILLS)$/.test(src))return .78;
 return 1
}
function modelConfidence(m){
 const notes=(m?.r?.notes||[]).join(' | ').toLowerCase(),groups=Array.isArray(m?.r?.groups)?m.r.groups:[];
 if(/pre\/post-rework split unavailable/.test(notes))return{f:.70,label:'historical split uncertain'};
 let f=1,label='direct / accepted model';
 if(groups.length){
  let num=0,den=0,hasEstimated=false,hasBigDog=false;
  for(const g of groups){
   const rel=rollGroupReliability(g),mass=Math.max(1e-9,(+g.n||0)*(+g.p||0));
   num+=rel*mass;den+=mass;if(rel<.999)hasEstimated=true;
   if(String(g?.player||'').toLowerCase()==='big dog aura'&&String(g?.source||'').startsWith('CHAMBERS_OF_XERIC'))hasBigDog=true
  }
  if(den>0)f=num/den;
  if(hasEstimated)label=hasBigDog?'mixed confidence · Big Dog scaled-CoX share damped separately':'assumption-weighted source confidence'
 }else{
  if(/big dog aura cox caveat/.test(notes)){f=.82;label='scaled CoX points estimated'}
  else if(/normal cox assumes|cox cm assumes|toa expert uses a fixed|toa normal uses a fixed/.test(notes)){f=.90;label='raid points / level estimated'}
  else if(/nightmare assumes|hueycoatl assumes|royal titans assumes|callisto assumes|venenatis assumes|vet'ion assumes|zalcano assumes/.test(notes)){f=.78;label='assumed contribution'}
  else if(/theatre of blood.*assumes/.test(notes)){f=.85;label='assumed raid share'}
 }
 if(/variable stack-size.*approximation/.test(notes)){f*=.90;label=label==='direct / accepted model'?'distribution approximation':label+' · distribution approximation'}
 return{f:clamp(f,.5,1),label}
}
function memberOnePieceFrom(set,targetName){
 const target=String(targetName||'').toLowerCase(),others=set.names.filter(x=>x!==target),ids=others.map(itemIdByName);
 if(ids.some(x=>x==null))return false;
 return fullGroupPlayers().some(p=>ids.every(id=>(model.counts.get(p.key)?.get(+id)||0)>0))
}
function deficitCompensation(profile,m,z){
 if(!(Number.isFinite(z)&&z<0))return{f:1,label:null};
 if(profile.kind==='component'&&profile.set&&COMPONENT_SETS[profile.set]){
  const set=COMPONENT_SETS[profile.set],complete=completedUntradeableSets(set);
  if(complete>0)return{f:.55,label:'completed '+set.label+' already exists in group'};
  if(memberOnePieceFrom(set,String(m.name||'').toLowerCase()))return{f:1.22,label:'this component can complete a personal '+set.label+' set'};
  return{f:1,label:null}
 }
 if(!['personal-unlock','major-shareable','shareable'].includes(profile.kind))return{f:1,label:null};
 const q=portfolioCount(m.name),f=marginalAt(q,profile),members=Math.max(1,fullGroupPlayers().length);
 let label=null;
 if(profile.kind==='personal-unlock'&&q>0)label=Math.min(q,members)+'/'+members+' group unlock capacity already supplied; next unlock retains '+Math.round(f*100)+'% marginal value';
 else if(q>0)label=q+' existing group cop'+(q===1?'y':'ies')+'; next copy retains '+Math.round(f*100)+'% marginal progression value';
 return{f,label}
}
function impactWeight(m,z=null){
 const p=impactProfile(m),isDry=Number.isFinite(z)&&z<0;
 const copy=isDry?1:copyUtility(p,m),synergy=isDry?{f:1,label:null}:synergyUtility(m,p),deficit=deficitCompensation(p,m,z),ge=p.base>=.5?geModifier(price(m.id)):1,confidence=modelConfidence(m);
 const w=clamp(p.base*copy*synergy.f*deficit.f*ge,.03,10.5);
 return{...p,copy,synergy,deficit,ge,confidence,w,reliability:confidence.f}
}
function financialWeight(m){
 const gp=price(m.id);if(!Number.isFinite(gp)||gp<=0)return{gp:0,w:0,reliability:0};
 const confidence=modelConfidence(m),base=clamp(Math.pow(gp/1e6,.28),.12,6.5);
 return{gp,w:base,reliability:confidence.f,confidence}
}
function financialFamilyCap(key){
 const low=String(key||'').toLowerCase();
 if(/clue/.test(low))return 2.5;
 if(/chambers_of_xeric|tombs_of_amascut|theatre_of_blood/.test(low))return 8;
 return 6
}
function financialIndex(metrics){
 const units=[];
 for(const rows of dependencyGroups(metrics)){
  const parts=rows.map(m=>({m,z:cappedZ(m.z),...financialWeight(m)})).filter(x=>x.w>0);
  if(!parts.length)continue;
  const sumW=parts.reduce((n,x)=>n+x.w,0),z=sumW?parts.reduce((n,x)=>n+x.z*x.w,0)/sumW:0;
  const reliability=sumW?parts.reduce((n,x)=>n+x.reliability*x.w,0)/sumW:1;
  const strongest=parts.reduce((x,y)=>y.w>x.w?y:x);
  units.push({rows,z:cappedZ(z),w:strongest.w,reliability,gp:strongest.gp})
 }
 const fam=new Map();
 for(const u of units){const key=sourceFamilyKey(u.rows),arr=fam.get(key)||[];arr.push(u);fam.set(key,arr)}
 for(const [key,arr] of fam){
  const norm=Math.sqrt(arr.reduce((n,u)=>n+u.w*u.w,0)),cap=financialFamilyCap(key);
  if(norm>cap&&norm>0){const scale=cap/norm;for(const u of arr)u.w*=scale}
 }
 const numerator=units.reduce((n,x)=>n+x.z*x.w*x.reliability,0),denom=Math.sqrt(units.reduce((n,x)=>n+x.w*x.w,0));
 const z=denom?numerator/denom:null;
 const deltaRows=metrics.filter(m=>Number.isFinite(m.r.expected)&&financialWeight(m).gp>0);
 const deltaGp=deltaRows.reduce((n,m)=>n+(m.r.observed-m.r.expected)*financialWeight(m).gp,0);
 return{z,numerator,denom,deltaGp,count:units.length,pricedItems:metrics.filter(m=>financialWeight(m).gp>0).length,deltaCount:deltaRows.length}
}

const RAID_PORTFOLIOS=[
 {key:'cox',label:'CoX purple portfolio',weight:9,names:new Set(['Twisted bow','Kodai insignia','Elder maul','Dragon claws','Ancestral hat','Ancestral robe top','Ancestral robe bottom',"Dinh's bulwark",'Dragon hunter crossbow','Twisted buckler','Dexterous prayer scroll','Arcane prayer scroll'])},
 {key:'toa',label:'ToA purple portfolio',weight:9,names:new Set(["Tumeken's shadow (uncharged)","Osmumten's fang",'Lightbearer',"Elidinis' ward",'Masori mask','Masori body','Masori chaps'])},
 {key:'tob',label:'ToB purple portfolio',weight:8,names:new Set(['Avernic defender hilt','Ghrazi rapier','Sanguinesti staff (uncharged)','Scythe of Vitur (uncharged)','Justiciar faceguard','Justiciar chestguard','Justiciar legguards'])}
];
function intrinsicCommunityWeight(m){return clamp(impactProfile(m).base,.03,10)}
function raidPortfolio(metrics,def){
 const rows=metrics.filter(m=>def.names.has(m.name)&&Number.isFinite(m.r.expected)&&Number.isFinite(m.r.observed));
 const expected=rows.reduce((n,m)=>n+m.r.expected,0),observed=rows.reduce((n,m)=>n+m.r.observed,0);
 if(!rows.length||expected<1)return null;
 const volumeZ=cappedZ((observed-expected)/Math.sqrt(Math.max(.25,expected)));
 const weighted=rows.map(m=>({m,w:intrinsicCommunityWeight(m)}));
 const meanW=weighted.reduce((n,x)=>n+x.m.r.expected*x.w,0)/expected;
 const qNum=weighted.reduce((n,x)=>n+(x.m.r.observed-x.m.r.expected)*(x.w-meanW),0);
 const qDen=Math.sqrt(weighted.reduce((n,x)=>n+x.m.r.expected*Math.pow(x.w-meanW,2),0));
 const qualityZ=qDen>.05?cappedZ(qNum/qDen):0;
 const cNum=weighted.reduce((n,x)=>{const q=1-Math.exp(-x.m.r.expected),got=x.m.r.observed>0?1:0;return n+x.w*(got-q)},0);
 const cDen=Math.sqrt(weighted.reduce((n,x)=>{const q=1-Math.exp(-x.m.r.expected);return n+x.w*x.w*q*(1-q)},0));
 const coverageZ=cDen>.05?cappedZ(cNum/cDen):0;
 const z=cappedZ((.70*volumeZ+.50*qualityZ+.30*coverageZ)/Math.sqrt(.70*.70+.50*.50+.30*.30));
 const confidenceDen=rows.reduce((n,m)=>n+m.r.expected,0);
 const confidenceWeighted=confidenceDen?rows.reduce((n,m)=>n+m.r.expected*modelConfidence(m).f,0)/confidenceDen:1;
 const effectiveWeight=def.weight,contribution=z*effectiveWeight*confidenceWeighted;
 return{...def,rows,observed,expected,volumeZ,qualityZ,coverageZ,z,confidence:confidenceWeighted,effectiveWeight,contribution}
}

function portfolioResidual(m){
 const d=RAID_PORTFOLIOS.find(x=>x.names.has(m.name));
 if(!d)return 1;
 return impactProfile(m).base>=8?.62:impactProfile(m).base>=5?.42:.28
}
function sourceFamilyKey(rows){
 const src=new Set();
 for(const m of rows)for(const s of m.r.sources||[])src.add(String(s.source||''));
 return [...src].sort().join('|')||'unknown';
}
function sourceFamilyCap(key){
 const low=key.toLowerCase();
 if(/clue/.test(low))return .70;
 if(/barrows/.test(low))return 2.50;
 if(/chambers_of_xeric|tombs_of_amascut|theatre_of_blood/.test(low))return 5.50;
 return 4.25;
}
function saturateSourceFamilies(units){
 const fam=new Map();
 for(const u of units){const key=sourceFamilyKey(u.rows),arr=fam.get(key)||[];arr.push(u);fam.set(key,arr)}
 for(const [key,arr] of fam){
  const norm=Math.sqrt(arr.reduce((n,u)=>n+u.w*u.w,0)),cap=sourceFamilyCap(key);
  if(norm<=cap||norm<=0)continue;
  const scale=cap/norm;
  for(const u of arr){u.w*=scale;u.sourceScale=scale}
 }
 return units
}
function independentUnits(metrics){
 const groups=new Map();
 for(const m of metrics){
  const dep=L.dependencyKey?.(m.id),key=dep||('item:'+m.id);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m)
 }
 const units=[];
 for(const [key,rows] of groups){
  if(rows.length===1){
   const m=rows[0],imp=impactWeight(m,cappedZ(m.z)),residual=portfolioResidual(m);
   units.push({key,rows,m,z:cappedZ(m.z),imp,residual,w:imp.w*residual,reliability:imp.reliability});continue
  }
  const parts=rows.map(m=>({m,imp:impactWeight(m,cappedZ(m.z)),residual:portfolioResidual(m),z:cappedZ(m.z)}));
  const sumW=parts.reduce((n,x)=>n+x.imp.w*x.residual,0);
  const z=sumW?parts.reduce((n,x)=>n+x.z*x.imp.w*x.residual,0)/sumW:0;
  const reliability=sumW?parts.reduce((n,x)=>n+x.imp.reliability*x.imp.w*x.residual,0)/sumW:1;
  const strongest=parts.reduce((a,b)=>b.imp.w*b.residual>a.imp.w*a.residual?b:a);
  units.push({key,rows,m:strongest.m,z:cappedZ(z),imp:{...strongest.imp,label:strongest.imp.label+' · shared roll group'},residual:strongest.residual,w:strongest.imp.w*strongest.residual,reliability})
 }
 return saturateSourceFamilies(units)
}
function cappedZ(z){return clamp(z,-3.5,3.5)}
function luckScore(z){if(!Number.isFinite(z))return null;const t=Math.tanh(.35*z);return clamp(z>=0?5+5*t:5+4*t,1,10)}
function scoreText(v){return Number.isFinite(v)?v.toFixed(1)+'/10':'—'}
async function loadPrices(){
 if(prices)return prices;if(priceRequest)return priceRequest;
 priceRequest=(async()=>{try{const r=await fetch('https://prices.runescape.wiki/api/v1/osrs/latest',{cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});if(!r.ok)throw new Error('GE '+r.status);prices=(await r.json()).data||{}}catch(e){console.warn('Lucky or Not prices unavailable',e);prices=null}return prices})();
 try{return await priceRequest}finally{priceRequest=null}
}
function price(id){id=+id;const ge=x=>{const p=prices?.[x];if(!p)return 0;const h=+p.high,l=+p.low;return h>0&&l>0?(h+l)/2:h>0?h:l>0?l:0};if(id===29799)return Math.max(0,ge(29801)-ge(19553));if(id===29790||id===29792||id===29794)return ge(29796)/3;if(id===28319||id===28321||id===28323||id===28325)return ge(28338)/4;if(id===28279)return Math.max(0,ge(28316)-ge(28301)-500*ge(565)-3*ge(28276));if(id===28281)return Math.max(0,ge(28313)-ge(28304)-500*ge(565)-3*ge(28276));if(id===28283)return Math.max(0,ge(28310)-ge(28298)-500*ge(565)-3*ge(28276));if(id===28285)return Math.max(0,ge(28307)-ge(28295)-500*ge(565)-3*ge(28276));return ge(id)}
function countFor(id,ps){let n=0;for(const p of ps){const v=model.counts.get(p.key)?.get(+id);if(Number.isFinite(v))n+=v}return n}

function metricsFor(ps){
 const key=ps.map(p=>p.key).sort().join('|');if(metricCache.has(key))return metricCache.get(key);
 const out=[];
 for(const id of modelIds()){const name=model.names.get(id)||'Item '+id;let r=null;try{r=L.calculate(id,name,ps,wom,model,U)}catch{}if(!r||!Number.isFinite(r.percentile))continue;const z=invNorm(r.percentile);if(Number.isFinite(z))out.push({id,name,r,z})}
 metricCache.set(key,out);return out
}
function excludedFor(ps){
 const key=ps.map(p=>p.key).sort().join('|');if(excludedCache.has(key))return excludedCache.get(key);
 const out=[];
 for(const id of modelIds()){
  const name=model.names.get(id)||'Item '+id;let reason=null,r=null;
  try{reason=L.exclusion(id,name,ps,wom,model,U)}catch{}
  if(!reason){try{r=L.calculate(id,name,ps,wom,model,U)}catch{};if(r)continue;reason={kind:'unknown',label:'Denominator or mechanic unavailable',detail:'The saved data does not contain enough information to reconstruct the eligible rolls reliably.'}}
  out.push({id,name,reason,count:countFor(id,ps)})
 }
 excludedCache.set(key,out);return out
}
function exposure(metrics){
 const src=new Map();for(const m of metrics)for(const x of m.r.sources||[]){const old=src.get(x.source)||0;src.set(x.source,Math.max(old,+x.kc||0))}
 return{attempts:[...src.values()].reduce((a,b)=>a+b,0),sources:src.size}
}
function dependencyGroups(metrics){
 const groups=new Map();
 for(const m of metrics){const dep=L.dependencyKey?.(m.id),key=dep||('item:'+m.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m)}
 return [...groups.values()]
}
function rawIndex(metrics){
 const depUnits=dependencyGroups(metrics).map(rows=>({rows,z:cappedZ(rows.reduce((n,m)=>n+cappedZ(m.z),0)/Math.max(1,rows.length))}));
 const fam=new Map();
 for(const u of depUnits){const key=sourceFamilyKey(u.rows),arr=fam.get(key)||[];arr.push(u);fam.set(key,arr)}
 const families=[];
 for(const [key,arr] of fam){
  const z=cappedZ(arr.reduce((n,u)=>n+u.z,0)/Math.sqrt(Math.max(1,arr.length)));
  families.push({key,z,count:arr.length})
 }
 const sum=families.reduce((n,x)=>n+x.z,0),den=Math.sqrt(families.length||0),z=den?sum/den:null;
 return{z,sum,den,families,depCount:depUnits.length}
}
function expectedFor(m){return(m.r.sources||[]).reduce((n,x)=>n+(Number.isFinite(+x.expected)?+x.expected:0),0)}
function evidenceMass(metrics){
 const fam=new Map();
 for(const rows of dependencyGroups(metrics)){
  const expected=Math.max(0,...rows.map(expectedFor)),base=Math.max(...rows.map(intrinsicCommunityWeight));
  const mass=Math.min(3,expected)*clamp(base/3,.03,2),key=sourceFamilyKey(rows);
  fam.set(key,(fam.get(key)||0)+mass)
 }
 return[...fam.values()].reduce((n,x)=>n+Math.min(6,x),0)
}
function sample(metrics){
 const e=exposure(metrics),raw=rawIndex(metrics),mass=evidenceMass(metrics),families=raw.families.length,n=metrics.length;
 const detail=n+' scored items · '+families+' source families · '+mass.toFixed(1)+' meaningful expected-drop evidence · '+fmt(e.attempts)+' source attempts';
 if(n<8||families<2||mass<.8)return{key:'insufficient',label:'insufficient sample',detail};
 if(families<4||mass<2.5)return{key:'limited',label:'limited sample',detail};
 return{key:'usable',label:'usable sample',detail}
}
function indices(metrics){
 const rawInfo=rawIndex(metrics),weighted=independentUnits(metrics);
 const itemNumerator=weighted.reduce((n,x)=>n+x.z*x.w*x.reliability,0);
 const itemWeightSq=weighted.reduce((n,x)=>n+x.w*x.w,0);
 const portfolios=RAID_PORTFOLIOS.map(d=>raidPortfolio(metrics,d)).filter(Boolean);
 const portfolioNumerator=portfolios.reduce((n,p)=>n+p.contribution,0);
 const portfolioWeightSq=portfolios.reduce((n,p)=>n+p.effectiveWeight*p.effectiveWeight,0);
 const numerator=itemNumerator+portfolioNumerator,denom=Math.sqrt(itemWeightSq+portfolioWeightSq);
 const meaningful=denom?numerator/denom:null,score=luckScore(meaningful),financial=financialIndex(metrics);
 return{raw:rawInfo.z,rawSum:rawInfo.sum,rawCount:metrics.length,rawFamilies:rawInfo.families.length,meaningful,numerator,denom,score,financial,weightedCount:weighted.length,dependentCollapsed:metrics.length-weighted.length,portfolios,itemNumerator,portfolioNumerator,sourceSaturated:weighted.filter(x=>x.sourceScale&&x.sourceScale<.999).length}
}
function entityStats(ps){const metrics=metricsFor(ps),idx=indices(metrics),s=sample(metrics);return{metrics,idx,s}}
function renderPicker(){
 const h=$('#clogLuckMembers');if(!h)return;
 U.renderMemberPicker(h,selected,keys=>{const next=new Set(keys);if(U.sameSelection(selected,next))return;selected=next;U.saveMemberSelection(selected);reset();render()},{title:'Members in luck analysis',subtitle:'Add or remove RNG sources. Raw percentiles use exactly those players; the overall-impact score values their drops in the context of the full five-man GIM portfolio, because shared gear and teammate unlocks can compensate for personal deficits.',fallback:U.ALL_KEYS,availability:model.known})
}
function syncHealth(){
 const t=+doc?.fetchedAt,w=+wom?.fetchedAt;if(!Number.isFinite(t)||!Number.isFinite(w))return{key:'unknown',text:'Temple/WOM synchronization time unavailable.'};
 const hours=Math.abs(t-w)/36e5;if(hours<.5)return{key:'good',text:'Temple and WOM snapshots are closely aligned.'};
 const newer=t>w?'Collection Log':'WOM',bias=t>w?'Recent drops may temporarily look slightly luckier because the KC denominator can lag.':'Recent KC may temporarily look slightly drier because the Collection Log count can lag.';
 return{key:hours<=6?'minor':hours<=24?'notice':'stale',text:newer+' snapshot is '+hours.toFixed(1)+'h newer. '+bias}
}
function overview(){
 const h=$('#clogLuckOverview');if(!h)return;const ps=selectedPlayers();
 if(!ps.length){h.innerHTML='<div class="notice">No selected member has a synced Collection Log.</div>';return}
 const s=entityStats(ps),excluded=excludedFor(ps),names=ps.map(p=>p.name).join(', '),sync=syncHealth();
 h.innerHTML='<div class="clog-luck-kpi"><span>Overall luck score</span><b class="clog-luck-'+tone(s.idx.meaningful||0)+'">'+scoreText(s.idx.score)+'</b><small>The headline score uses probability, gameplay significance, confidence and pooled raid outcomes. It is not a bank-value ranking.</small></div>'+
 '<div class="clog-luck-kpi"><span>Raw drop-rate RNG</span><b class="clog-luck-'+tone(s.idx.raw||0)+'">'+(s.idx.raw==null?'—':sig(s.idx.raw))+'</b><small>Source-family-normalized statistical deviation across '+fmt(s.idx.rawCount)+' calculable entries in '+fmt(s.idx.rawFamilies)+' source families. Correlated component representations are collapsed first.</small></div>'+
 '<div class="clog-luck-kpi"><span>GE-weighted RNG</span><b class="clog-luck-'+tone(s.idx.financial.z||0)+'">'+(s.idx.financial.z==null?'—':signed(s.idx.financial.z))+'</b><small>'+fmt(s.idx.financial.count)+' de-correlated priced evidence units. Direct-count GP delta is '+(s.idx.financial.deltaGp>=0?'+':'−')+money(Math.abs(s.idx.financial.deltaGp))+' gp across '+fmt(s.idx.financial.deltaCount)+' entries with a comparable expected count. This is a value-impact index, not a bank-value total.</small></div>'+
 '<div class="clog-luck-kpi"><span>Data quality</span><b>'+esc(s.s.label)+'</b><small>'+esc(s.s.detail)+' · '+esc(sync.text)+'</small></div>';
 const badge=$('#clogLuckImpossibleCount');if(badge)badge.textContent=fmt(excluded.length)
}
function itemRow(m){
 const expected=Number.isFinite(m.r.expected)?m.r.expected:null,actual=fmt(m.r.observed),pct=m.r.text,z=cappedZ(m.z);
 if(lens==='raw'){
  const sub=actual+' actual · '+(expected==null?'expected n/a':expected.toFixed(expected<10?2:1)+' expected')+' · '+pct+' percentile';
  return '<article class="clog-luck-item"><img src="https://static.runelite.net/cache/item/icon/'+m.id+'.png" alt=""><div class="clog-luck-item-copy"><b>'+U.itemLink(m.id,m.name)+'</b><small>'+sub+'</small></div><div class="clog-luck-item-score"><strong class="clog-luck-'+tone(z)+'">'+sig(z)+'</strong><small>pure statistical deviation</small></div></article>'
 }
 if(lens==='value'){
  const fw=financialWeight(m),delta=expected==null?null:(m.r.observed-expected)*fw.gp,contribution=z*fw.w*fw.reliability;
  const sub=actual+' actual · '+(expected==null?'expected n/a':expected.toFixed(expected<10?2:1)+' expected')+' · '+pct+' percentile · GE '+money(fw.gp)+' gp'+(delta==null?'':' · Δ '+(delta>=0?'+':'−')+money(Math.abs(delta))+' gp');
  return '<article class="clog-luck-item"><img src="https://static.runelite.net/cache/item/icon/'+m.id+'.png" alt=""><div class="clog-luck-item-copy"><b>'+U.itemLink(m.id,m.name)+'</b><small>'+sub+'</small></div><div class="clog-luck-item-score"><strong class="clog-luck-'+tone(contribution)+'">'+signed(contribution)+'</strong><small>'+sig(z)+' × '+fw.w.toFixed(2)+' value weight</small></div></article>'
 }
 const imp=impactWeight(m,z),contribution=z*imp.w*imp.reliability;
 const modifiers=[];
 if(imp.copy<.98)modifiers.push('duplicate utility '+Math.round(imp.copy*100)+'%');
 if(imp.synergy?.label)modifiers.push(imp.synergy.label);
 if(imp.deficit?.f<.98&&imp.deficit.label)modifiers.push('dryness softened: '+imp.deficit.label);
 if(imp.confidence.f<1)modifiers.push(Math.round(imp.confidence.f*100)+'% model confidence');
 const sub=actual+' actual · '+(expected==null?'expected n/a':expected.toFixed(expected<10?2:1)+' expected')+' · '+pct+' percentile · '+imp.label+(modifiers.length?' · '+modifiers.join(' · '):'');
 return '<article class="clog-luck-item"><img src="https://static.runelite.net/cache/item/icon/'+m.id+'.png" alt=""><div class="clog-luck-item-copy"><b>'+U.itemLink(m.id,m.name)+'</b><small>'+sub+'</small></div><div class="clog-luck-item-score"><strong class="clog-luck-'+tone(contribution)+'">'+signed(contribution)+'</strong><small>'+sig(z)+' × '+imp.w.toFixed(2)+' impact</small></div></article>'
}
function ranked(metrics){
 return metrics.map(m=>{
  const z=cappedZ(m.z);
  if(lens==='raw')return{...m,sort:z};
  if(lens==='value'){const fw=financialWeight(m);return{...m,fw,sort:z*fw.w*fw.reliability}}
  const imp=impactWeight(m,z);return{...m,imp,sort:z*imp.w*imp.reliability}
 }).filter(m=>lens!=='value'||m.fw?.w>0).sort((a,b)=>b.sort-a.sort)
}
function renderLists(){
 const ps=selectedPlayers(),subjectLabel=ps.map(p=>p.name).join(', ')||'no selected members',stats=ps.length?entityStats(ps):null,metrics=stats?.metrics||[],rows=ranked(metrics),lucky=rows.slice(0,8),dry=[...rows].sort((a,b)=>a.sort-b.sort).slice(0,8);
 const formula=$('#clogLuckFormula');
 if(formula){
  if(!stats)formula.innerHTML='';
  else if(lens==='raw')formula.innerHTML='<b>Raw drop-rate view:</b> item rows are ordered only by percentile-derived σ deviation. The aggregate raw signal first collapses linked representations, then combines items within each source family before combining source families. No GE price or gameplay-importance weighting enters this view. Aggregate raw signal: <strong>'+sig(stats.idx.raw)+'</strong>.';
  else if(lens==='value')formula.innerHTML='<b>Financial-impact view:</b> probability deviation is multiplied by a log-scaled live GE weight, with linked entries collapsed and large source families capped. Aggregate GE-impact index: <strong>'+signed(stats.idx.financial.z)+'</strong>. The direct-count subset is '+(stats.idx.financial.deltaGp>=0?'+':'−')+money(Math.abs(stats.idx.financial.deltaGp))+' gp versus expectation across '+fmt(stats.idx.financial.deltaCount)+' comparable entries. This is deliberately separate from the final overall luck score.';
  else formula.innerHTML='<b>Final 1–10 score:</b> weighted item signal '+signed(stats.idx.itemNumerator)+' + pooled raid portfolios '+signed(stats.idx.portfolioNumerator)+' = '+signed(stats.idx.numerator)+' ÷ '+stats.idx.denom.toFixed(2)+' = <strong>'+signed(stats.idx.meaningful)+' impact index</strong> → <strong>'+scoreText(stats.idx.score)+'</strong>. '+(stats.idx.portfolios.length?stats.idx.portfolios.map(p=>p.label+': '+fmt(p.observed)+' actual vs '+p.expected.toFixed(1)+' expected · volume '+sig(p.volumeZ)+' · quality '+sig(p.qualityZ)+' · coverage '+sig(p.coverageZ)+' → '+sig(p.z)).join(' · '):'No raid portfolio with a usable expected-drop denominator.')+' Assumption-heavy mechanics are reliability-damped in the numerator rather than merely receiving a smaller weight, so uncertainty genuinely pulls evidence toward neutral. Big Dog Aura's scaled-CoX uncertainty is applied only to his share of combined CoX evidence. Overall-impact weights are portfolio-aware: community progression value comes first, early useful group copies are worth more than redundant copies, complementary gear can add a capped synergy bonus, and a personal dry streak is softened when teammates have already solved that slot for the GIM. Raid items already represented in a pooled portfolio retain only part of their ordinary item-level weight to avoid counting the same evidence twice. Large source tables are L2-capped so having more Collection Log slots does not create more statistical power. Item σ is capped at ±3.50.';
 }
 const titles=lens==='raw'?['Most statistically lucky','Most statistically unlucky']:lens==='value'?['Biggest valuable spoons','Biggest valuable dry streaks']:['Luckiest meaningful drops','Unluckiest meaningful grinds'];
 $('#clogLuckLuckyTitle').textContent=titles[0];$('#clogLuckDryTitle').textContent=titles[1];
 $('#clogLuckLuckySub').textContent=subjectLabel;$('#clogLuckDrySub').textContent=subjectLabel;
 $('#clogLuckLucky').innerHTML=lucky.length?lucky.map(itemRow).join(''):'<div class="clog-luck-empty">No calculable items for this selection.</div>';
 $('#clogLuckDry').innerHTML=dry.length?dry.map(itemRow).join(''):'<div class="clog-luck-empty">No calculable items for this selection.</div>'
}
function combinations(ps){
 const out=[];for(let mask=1;mask<(1<<ps.length);mask++){const group=[];for(let i=0;i<ps.length;i++)if(mask&(1<<i))group.push(ps[i]);const x=entityStats(group);out.push({group,...x})}
 return out.sort((a,b)=>(b.idx.score??-99)-(a.idx.score??-99)||a.group.length-b.group.length||a.group.map(p=>p.name).join(', ').localeCompare(b.group.map(p=>p.name).join(', ')))
}
function bestWorst(metrics,mode){
 const prev=lens;lens=mode;const r=ranked(metrics);lens=prev;
 return{best:r[0]||null,worst:r.length?[...r].sort((a,b)=>a.sort-b.sort)[0]:null}
}
function renderIndividuals(){
 const h=$('#clogLuckIndividuals');if(!h)return;const ps=selectedPlayers();
 h.innerHTML=ps.map(p=>{
  const x=entityStats([p]),raw=bestWorst(x.metrics,'raw'),val=bestWorst(x.metrics,'value');
  const spoon=raw.best?raw.best.name:'—',dry=raw.worst?raw.worst.name:'—',vSpoon=val.best?val.best.name:'—',vDry=val.worst?val.worst.name:'—';
  return '<article class="clog-luck-individual"><div class="clog-luck-individual-head"><b>'+esc(p.name)+'</b><strong class="clog-luck-'+tone(x.idx.meaningful||0)+'">'+scoreText(x.idx.score)+'</strong><span class="clog-luck-sample '+x.s.key+'">'+esc(x.s.label)+'</span></div><div class="clog-luck-individual-grid"><span><small>Raw spoon</small><b>'+esc(spoon)+'</b></span><span><small>Raw dry</small><b>'+esc(dry)+'</b></span><span><small>Valuable spoon</small><b>'+esc(vSpoon)+'</b></span><span><small>Valuable dry</small><b>'+esc(vDry)+'</b></span></div><small class="clog-luck-individual-note">'+esc(x.s.detail)+(x.s.key!=='usable'?' · treat this account comparison cautiously until more relevant KC/drop opportunities are recorded':'')+'</small></article>'
 }).join('')||'<div class="clog-luck-empty">No selected synced members.</div>'
}
function renderPlayers(){
 const h=$('#clogLuckPlayers');if(!h)return;const ps=selectedPlayers(),rows=combinations(ps);
 h.innerHTML=rows.map((x,i)=>{const names=x.group.map(p=>p.name).join(' + '),all=x.group.length===ps.length&&ps.length>1;return '<article class="clog-luck-player-row"><div class="clog-luck-player-name"><div><b>'+(i+1)+'. '+esc(names)+'</b><small>'+esc(x.s.detail)+(all?' · full selected group':'')+'</small></div></div><div class="clog-luck-player-metric"><span>Luck score</span><b class="clog-luck-'+tone(x.idx.meaningful||0)+'">'+scoreText(x.idx.score)+'</b></div><div class="clog-luck-player-metric"><span>Raw RNG</span><b class="clog-luck-'+tone(x.idx.raw||0)+'">'+(x.idx.raw==null?'—':sig(x.idx.raw))+'</b></div><div class="clog-luck-player-metric"><span>GE RNG</span><b class="clog-luck-'+tone(x.idx.financial.z||0)+'">'+(x.idx.financial.z==null?'—':sig(x.idx.financial.z))+'</b></div><span class="clog-luck-sample '+x.s.key+'">'+x.group.length+' account'+(x.group.length===1?'':'s')+' · '+esc(x.s.label)+'</span></article>'}).join('')||'<div class="clog-luck-empty">No selected synced members.</div>'
}
function renderImpossible(){
 const h=$('#clogLuckImpossible');if(!h)return;const ps=selectedPlayers(),rows=ps.length?excludedFor(ps):[];
 const order={cap:0,nex:1,barrows:2,mechanic:3,rate:4,unknown:5,selection:6};rows.sort((a,b)=>(order[a.reason.kind]??9)-(order[b.reason.kind]??9)||b.count-a.count||a.name.localeCompare(b.name));
 const capped=rows.filter(x=>x.reason.kind==='cap').length,nex=rows.filter(x=>x.reason.kind==='nex').length;
 h.innerHTML=rows.length?'<div class="clog-luck-impossible-summary"><b>'+fmt(rows.length)+' excluded items</b><span>'+fmt(capped)+' capped counters · '+fmt(nex)+' Nex entries · remaining rows lack a defensible denominator/mechanic</span></div>'+rows.map(x=>'<article class="clog-luck-impossible-row"><img src="https://static.runelite.net/cache/item/icon/'+x.id+'.png" alt=""><div><b>'+U.itemLink(x.id,x.name)+'</b><small>'+esc(x.reason.detail)+'</small></div><div><strong>'+esc(x.reason.label)+'</strong><small>'+fmt(x.count)+' logged in current selection</small></div></article>').join(''):'<div class="clog-luck-empty">No excluded items for this selection.</div>'
}
function renderView(){
 const scored=$('#clogLuckScored'),impossible=$('#clogLuckImpossiblePanel');
 if(scored)scored.classList.toggle('hidden',view!=='scored');if(impossible)impossible.classList.toggle('hidden',view!=='impossible');
 $$('[data-luck-view]').forEach(b=>b.classList.toggle('active',b.dataset.luckView===view))
}
function render(){if(!model||!wom)return;renderPicker();overview();renderLists();renderIndividuals();renderPlayers();renderImpossible();renderView()}
function bind(){
 document.querySelectorAll('[data-luck-view]').forEach(b=>b.onclick=()=>{view=b.dataset.luckView;renderView()});
 document.querySelectorAll('[data-luck-lens]').forEach(b=>b.onclick=()=>{lens=b.dataset.luckLens||'meaningful';document.querySelectorAll('[data-luck-lens]').forEach(x=>x.classList.toggle('active',x===b));renderLists()});
 const tab=$('[data-gim-tab="luck"]');if(tab&&!tab.dataset.luckBound){tab.dataset.luckBound='1';tab.addEventListener('click',()=>{render();if(!prices)loadPrices().then(()=>render())})}
}
function reset(){metricCache=new Map();excludedCache=new Map();portfolioCache=null}
window.addEventListener('ug:members-changed',e=>{const keys=U.cleanSelection(e.detail?.keys,U.ALL_KEYS);if(U.sameSelection(selected,keys))return;selected=keys;reset();render()});
window.addEventListener('ug:data-updated',async e=>{if(e.detail?.key===U.TKEY){doc=await U.loadClog();model=M.build(doc,U.PLAYERS);reset();render()}else if(e.detail?.key===U.WKEY){wom=await U.loadWom();reset();render()}});
async function init(){[doc,wom]=await Promise.all([U.loadClog(),U.loadWom()]);model=M.build(doc,U.PLAYERS);bind();render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();