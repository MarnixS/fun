(()=>{
'use strict';
const U=window.UGV21,M=window.UGClogBetaModel,L=window.UGClogLuck;
if(!U||!M||!L||!['gim','rng'].includes(document.body.dataset.page))return;
const {$,$$,fmt,escapeHtml:esc}=U;
let doc=null,wom=null,model=null,selected=U.loadMemberSelection(),view='scored',lens='meaningful',search='',prices=null,priceRequest=null,metricCache=new Map(),excludedCache=new Map();

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
const EXPLICIT_IMPACT=window.GIM_CLOG_IMPACT||Object.freeze({});
const COMMUNITY_RULES=[
 {w:10.0,label:'iconic megarare · account-defining',kind:'major-shareable',re:/^(twisted bow|tumeken's shadow(?: \(uncharged\))?)$/i},
 {w:9.0,label:'iconic megarare · account-defining',kind:'major-shareable',re:/^scythe of vitur(?: \(uncharged\))?$/i},
 {w:7.6,label:'progression-defining ranged unlock',kind:'major-shareable',re:/^enhanced crystal weapon seed$/i},
 {w:7.0,label:'permanent ranged progression unlock',kind:'personal-unlock',re:/^dexterous prayer scroll$/i},
 {w:6.5,label:'major raid / defence progression tool',kind:'major-shareable',re:/^(elder maul|dragon warhammer)$/i},
 {w:6.1,label:'high-breadth raid weapon',kind:'major-shareable',re:/^osmumten's fang$/i},
 {w:5.8,label:'high-impact special-attack weapon',kind:'major-shareable',re:/^dragon claws$/i},
 {w:5.5,label:'progression-opening demonbane choice',kind:'major-shareable',re:/^tormented synapse$/i},
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
let portfolioCache=new Map();
function fullGroupPlayers(){return U.PLAYERS.filter(p=>model?.known.has(p.key))}
function contextPlayers(m){
 const keys=new Set(Array.isArray(m?.players)?m.players:[]);
 return keys.size?fullGroupPlayers().filter(p=>keys.has(p.key)):fullGroupPlayers()
}
function portfolioCounts(m){
 const ps=contextPlayers(m),key=ps.map(p=>p.key).sort().join('|')||'none';
 if(portfolioCache.has(key))return portfolioCache.get(key);
 const map=new Map();
 for(const id of modelIds()){
  const name=String(model.names.get(id)||'').trim().toLowerCase();if(!name)continue;
  const q=countFor(id,ps);map.set(name,(map.get(name)||0)+q)
 }
 portfolioCache.set(key,map);return map
}
function portfolioCount(name,m){return portfolioCounts(m).get(String(name||'').toLowerCase())||0}
function sumPortfolio(regex,m){let n=0;for(const [name,q] of portfolioCounts(m))if(regex.test(name))n+=q;return n}
function impactProfile(m){
 const id=+m?.id,explicit=EXPLICIT_IMPACT[id];
 if(explicit&&Number.isFinite(+explicit.score))return{base:+explicit.score,label:explicit.label||'reviewed item utility',kind:explicit.kind||'shareable',set:explicit.set||null};
 // Fallback only: the explicit impact asset currently covers every rate-model item.
 // Keep this path so a future newly-added rate does not crash the entire page before
 // its impact review is added; it is deliberately tiny and visibly labelled.
 const name=String(m?.name||'').trim();
 console.warn('RNG Index: missing explicit impact review for item',id,name);
 return{base:.05,label:'impact review missing',kind:'low-impact',set:null}
}
function averageMarginal(q,curve,tail=.12){
 q=Math.max(0,Math.floor(+q||0));if(q<=0)return 1;
 let total=0;for(let i=0;i<q;i++)total+=i<curve.length?curve[i]:tail;
 return total/q
}
function copyUtility(profile,m){
 const q=portfolioCount(m.name,m);
 if(profile.kind==='personal-unlock')return averageMarginal(q,[1,.96,.92,.88,.84],.12);
 if(profile.kind==='major-shareable')return averageMarginal(q,[1,.82,.66,.52,.42],.14);
 if(profile.kind==='shareable')return averageMarginal(q,[1,.72,.54,.40,.30],.12);
 return 1
}
function itemIdByName(name){
 const low=String(name||'').toLowerCase();for(const id of modelIds())if(String(model.names.get(id)||'').toLowerCase()===low)return +id;return null
}
function completedUntradeableSets(set,m){
 const ids=set.names.map(itemIdByName);if(ids.some(x=>x==null))return 0;
 let complete=0;
 for(const p of contextPlayers(m)){
  const counts=ids.map(id=>model.counts.get(p.key)?.get(+id)||0);
  complete+=Math.min(...counts)
 }
 return complete
}
function componentUtility(profile,m){
 if(!profile.set||!COMPONENT_SETS[profile.set])return{f:1,label:null};
 const set=COMPONENT_SETS[profile.set],complete=completedUntradeableSets(set,m),pieces=set.names.filter(n=>portfolioCount(n,m)>0).length;
 if(complete>0)return{f:clamp(1.35+.12*Math.min(complete-1,3),1,1.7),label:complete+' complete '+set.label+(complete===1?'':'s')+' assembled by individual group members'};
 return{f:.45+.15*pieces,label:pieces+'/'+set.names.length+' component types represented, but no confirmed complete set on one member'}
}
function synergyUtility(m,profile){
 const n=String(m.name||'').toLowerCase(),reasons=[];let f=1;
 const tbow=portfolioCount('twisted bow',m),dex=portfolioCount('dexterous prayer scroll',m);
 const shadow=portfolioCount("tumeken's shadow (uncharged)",m),scythe=portfolioCount('scythe of vitur (uncharged)',m);
 const enhanced=portfolioCount('enhanced crystal weapon seed',m),armourSeeds=portfolioCount('crystal armour seed',m);
 const ancestral=sumPortfolio(/^ancestral (hat|robe top|robe bottom)$/,m),masori=sumPortfolio(/^masori (mask|body|chaps)$/,m);
 const claws=portfolioCount('dragon claws',m),zcb=portfolioCount('zaryte crossbow',m),lb=portfolioCount('lightbearer',m);
 if(n==='twisted bow'&&dex>0){f+=.12;reasons.push('Rigour access in group')}
 if(n==='twisted bow'&&masori>=3){f+=.06;reasons.push('Masori support')}
 if(n==='dexterous prayer scroll'&&tbow>0){f+=.10;reasons.push('Tbow in group')}
 else if(n==='dexterous prayer scroll'&&enhanced>0){f+=.05;reasons.push('Bowfa progression in group')}
 if(n==="tumeken's shadow (uncharged)"&&ancestral>=2){f+=.12;reasons.push('Ancestral support')}
 if(/^ancestral (hat|robe top|robe bottom)$/.test(n)&&shadow>0){f+=.15;reasons.push('Shadow in group')}
 if(/^masori (mask|body|chaps)$/.test(n)&&tbow>0){f+=.12;reasons.push('Tbow in group')}
 if(n==='enhanced crystal weapon seed'&&armourSeeds>=6){f+=.12;reasons.push('full crystal armour access')}
 if(n==='lightbearer'&&(claws>0||zcb>0)){f+=.10;reasons.push('high-impact spec weapon access')}
 if((n==='dragon claws'||n==='zaryte crossbow')&&lb>0){f+=.08;reasons.push('Lightbearer in group')}
 if(n==='avernic defender hilt'&&(scythe>0||portfolioCount("osmumten's fang",m)>0)){f+=.06;reasons.push('endgame melee weapon support')}
 const component=componentUtility(profile,m);f*=component.f;if(component.label)reasons.push(component.label);
 return{f:clamp(f,.35,1.55),label:reasons.join(' · ')||null}
}
function geModifier(gp){if(!Number.isFinite(+gp)||+gp<=0)return 1;const x=clamp((Math.log10(+gp)-5)/5,0,1);return .94+.12*x}
function modelConfidence(m){
 const notes=(m?.r?.notes||[]).join(' | ').toLowerCase();
 if(/pre\/post-rework split unavailable/.test(notes))return{f:.7,label:'historical split uncertain'};
 if(/big dog aura cox caveat/.test(notes))return{f:.82,label:'scaled CoX points estimated'};
 if(/normal cox assumes|cox cm assumes/.test(notes))return{f:.90,label:'CoX points estimated'};
 if(/toa expert uses a fixed|toa normal uses a fixed/.test(notes))return{f:.90,label:'ToA raid level estimated'};
 if(/nightmare assumes|callisto uses an 80%|zalcano assumes/.test(notes))return{f:.78,label:'assumed contribution'};
 if(/theatre of blood.*assumes/.test(notes))return{f:.85,label:'assumed raid share'};
 if(/variable stack-size.*approximation/.test(notes))return{f:.9,label:'distribution approximation'};
 return{f:1,label:'direct / accepted model'}
}
function deficitCompensation(profile,m,z){
 if(!(Number.isFinite(z)&&z<0))return{f:1,label:null};
 const q=portfolioCount(m.name,m),members=Math.max(1,contextPlayers(m).length);
 if(profile.kind==='personal-unlock'){
  const coverage=clamp(q/members,0,1),f=1-.82*coverage;
  return{f,label:coverage>0?'group already covers '+Math.round(coverage*100)+'% of personal unlock capacity':null}
 }
 if(profile.kind==='major-shareable'){
  const f=q<=0?1:q===1?.48:q===2?.34:q===3?.27:.22;
  return{f,label:q>0?q+' group cop'+(q===1?'y':'ies')+' already provide shared access':null}
 }
 if(profile.kind==='shareable'){
  const f=q<=0?1:q===1?.42:q===2?.30:q===3?.24:.20;
  return{f,label:q>0?q+' group cop'+(q===1?'y':'ies')+' already reduce the practical deficit':null}
 }
 if(profile.kind==='component'&&profile.set&&COMPONENT_SETS[profile.set]){
  const set=COMPONENT_SETS[profile.set],complete=completedUntradeableSets(set,m);
  return complete>0?{f:.28,label:'group already has '+complete+' completed '+set.label+(complete===1?'':'s')+' from personal component sets'}:{f:1,label:null}
 }
 return{f:1,label:null}
}
function impactWeight(m,z=null){
 const p=impactProfile(m),copy=copyUtility(p,m),synergy=synergyUtility(m,p),deficit=deficitCompensation(p,m,z),ge=p.base>=.5?geModifier(price(m.id)):1,confidence=modelConfidence(m);
 const w=clamp(p.base*copy*synergy.f*deficit.f*ge*confidence.f,.03,10.5);
 return{...p,copy,synergy,deficit,ge,confidence,w}
}
function financialWeight(m){
 const gp=price(m.id);if(!Number.isFinite(gp)||gp<=0)return{gp:0,w:0};
 const confidence=modelConfidence(m),base=clamp(Math.pow(gp/1e6,.28),.12,6.5);
 return{gp,w:base*confidence.f,confidence}
}
function financialIndex(metrics){
 const rows=metrics.map(m=>({m,z:cappedZ(m.z),...financialWeight(m)})).filter(x=>x.w>0);
 const numerator=rows.reduce((n,x)=>n+x.z*x.w,0),denom=Math.sqrt(rows.reduce((n,x)=>n+x.w*x.w,0));
 const z=denom?numerator/denom:null;
 const deltaGp=rows.reduce((n,x)=>n+(Number.isFinite(x.m.r.expected)?(x.m.r.observed-x.m.r.expected)*x.gp:0),0);
 return{z,numerator,denom,deltaGp,count:rows.length}
}

const RAID_PORTFOLIOS=[
 {key:'cox',label:'CoX purple portfolio',weight:9,names:new Set(['twisted bow','kodai insignia','elder maul','dragon claws','ancestral hat','ancestral robe top','ancestral robe bottom',"dinh's bulwark",'dragon hunter crossbow','twisted buckler','dexterous prayer scroll','arcane prayer scroll'])},
 {key:'toa',label:'ToA purple portfolio',weight:9,names:new Set(["tumeken's shadow (uncharged)","osmumten's fang",'lightbearer',"elidinis' ward",'masori mask','masori body','masori chaps'])},
 {key:'tob',label:'ToB purple portfolio',weight:8,names:new Set(['avernic defender hilt','ghrazi rapier','sanguinesti staff (uncharged)','scythe of vitur (uncharged)','justiciar faceguard','justiciar chestguard','justiciar legguards'])}
];
function raidPortfolio(metrics,def){
 const rows=metrics.filter(m=>def.names.has(String(m.name||'').toLowerCase())&&Number.isFinite(m.r.expected)&&Number.isFinite(m.r.observed));
 const expected=rows.reduce((n,m)=>n+m.r.expected,0),observed=rows.reduce((n,m)=>n+m.r.observed,0);
 if(!rows.length||expected<1)return null;
 const volumeZ=cappedZ((observed-expected)/Math.sqrt(Math.max(.25,expected)));
 const weighted=rows.map(m=>({m,w:impactWeight(m).w}));
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
 const effectiveWeight=def.weight*confidenceWeighted;
 return{...def,rows,observed,expected,volumeZ,qualityZ,coverageZ,z,confidence:confidenceWeighted,effectiveWeight,contribution:z*effectiveWeight}
}

function portfolioResidual(m){
 const d=RAID_PORTFOLIOS.find(x=>x.names.has(String(m.name||'').toLowerCase()));
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
function meaningfulContext(m,z){
 z=clamp(+z,-3.5,3.5);
 const expected=Number.isFinite(m?.r?.expected)?+m.r.expected:null,observed=Number.isFinite(+m?.r?.observed)?+m.r.observed:0,profile=impactProfile(m);
 let dryGate=1,drySeverity=1,earlyUnlockBoost=0,signal=z;
 // Meaningful dryness is deliberately asymmetric. Mild below-expectation outcomes
 // can contribute a small negative once fewer than half of comparable players
 // would be this dry. Below a 25% lower tail the evidence ramps much harder, and
 // genuinely rare dry streaks become increasingly more costly than equally-sized
 // positive deviations are useful.
 if(z<0&&Number.isFinite(+m?.r?.dryTail)){
  const tail=clamp(+m.r.dryTail,0,1);
  // Below-expectation outcomes can still carry a small negative signal when
  // fewer than half of comparable players would be this dry. The 25% mark is
  // therefore no longer an on/off switch; it separates background bad luck
  // from genuinely meaningful dryness.
  if(tail>=.25){
   dryGate=clamp((.50-tail)/.25,0,1)*.30;   // 0 at 50%+, rising only to 0.30 at 25%
  }else{
   const maturity=clamp((.25-tail)/.20,0,1);
   dryGate=.30+.70*Math.sqrt(maturity);     // continuous at 25%, fully mature by 5%
  }
  const rarity=tail>0?clamp(Math.log(.10/tail)/Math.log(100),0,1):1;
  drySeverity=1+.45*rarity;                 // up to 45% extra weight for extreme established dryness
  signal=clamp(z*dryGate*drySeverity,-3.5,3.5);
 }
 // Progression is asymmetric in the other direction too: landing the first
 // major item before one expected copy can matter without being an absurd spoon.
 if(z>0&&observed>0&&expected!=null&&expected<1&&profile.base>=5){
  earlyUnlockBoost=.08*Math.min(5,Math.max(0,profile.base-5))*(1-expected);
  signal=clamp(z+earlyUnlockBoost,-3.5,3.5);
 }
 return{signal,dryGate,drySeverity,earlyUnlockBoost,expected,observed,profile}
}
function independentUnits(metrics){
 const groups=new Map();
 for(const m of metrics){
  const dep=L.dependencyKey?.(m.id);
  const key=dep||('item:'+m.id);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(m);
 }
 const units=[];
 for(const [key,rows] of groups){
  if(rows.length===1){
   const m=rows[0],ctx=meaningfulContext(m,cappedZ(m.z)),imp=impactWeight(m,ctx.signal),residual=portfolioResidual(m);
   units.push({key,rows,m,z:ctx.signal,rawZ:cappedZ(m.z),context:ctx,imp,residual,w:imp.w*residual});continue
  }
  const parts=rows.map(m=>{const ctx=meaningfulContext(m,cappedZ(m.z));return{m,ctx,imp:impactWeight(m,ctx.signal),residual:portfolioResidual(m),z:ctx.signal}});
  const sumW=parts.reduce((n,x)=>n+x.imp.w*x.residual,0);
  const z=sumW?parts.reduce((n,x)=>n+x.z*x.imp.w*x.residual,0)/sumW:0;
  const strongest=parts.reduce((a,b)=>b.imp.w*b.residual>a.imp.w*a.residual?b:a);
  units.push({key,rows,m:strongest.m,z:cappedZ(z),rawZ:cappedZ(strongest.m.z),context:strongest.ctx,imp:{...strongest.imp,label:strongest.imp.label+' · shared roll group'},residual:strongest.residual,w:strongest.imp.w*strongest.residual});
 }
 return saturateSourceFamilies(units)
}
function cappedZ(z){return clamp(z,-3.5,3.5)}
function luckScore(z){if(!Number.isFinite(z))return null;const t=Math.tanh(.35*z);return clamp(z>=0?5+5*t:5+4*t,1,10)}
function scoreText(v){return Number.isFinite(v)?v.toFixed(1)+'/10':'—'}
async function loadPrices(){
 if(prices)return prices;if(priceRequest)return priceRequest;
 priceRequest=(async()=>{try{const r=await fetch('https://prices.runescape.wiki/api/v1/osrs/latest',{cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});if(!r.ok)throw new Error('GE '+r.status);prices=(await r.json()).data||{}}catch(e){console.warn('RNG Index prices unavailable',e);prices=null}return prices})();
 try{return await priceRequest}finally{priceRequest=null}
}
function price(id){id=+id;const ge=x=>{const p=prices?.[x];if(!p)return 0;const h=+p.high,l=+p.low;return h>0&&l>0?(h+l)/2:h>0?h:l>0?l:0};if(id===29799)return Math.max(0,ge(29801)-ge(19553));if(id===29790||id===29792||id===29794)return ge(29796)/3;if(id===28319||id===28321||id===28323||id===28325)return ge(28338)/4;if(id===28279)return Math.max(0,ge(28316)-ge(28301)-500*ge(565)-3*ge(28276));if(id===28281)return Math.max(0,ge(28313)-ge(28304)-500*ge(565)-3*ge(28276));if(id===28283)return Math.max(0,ge(28310)-ge(28298)-500*ge(565)-3*ge(28276));if(id===28285)return Math.max(0,ge(28307)-ge(28295)-500*ge(565)-3*ge(28276));return ge(id)}
function countFor(id,ps){let n=0;for(const p of ps){const v=model.counts.get(p.key)?.get(+id);if(Number.isFinite(v))n+=v}return n}

function metricsFor(ps){
 const key=ps.map(p=>p.key).sort().join('|');if(metricCache.has(key))return metricCache.get(key);
 const out=[];
 for(const id of modelIds()){const name=model.names.get(id)||'Item '+id;let r=null;try{r=L.calculate(id,name,ps,wom,model,U)}catch{}if(!r||!Number.isFinite(r.percentile))continue;const z=invNorm(r.percentile);if(Number.isFinite(z))out.push({id,name,r,z,players:ps.map(p=>p.key)})}
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
function exposure(metrics){const src=new Map();for(const m of metrics)for(const s of m.r.sources||[]){const old=src.get(s.source)||0;src.set(s.source,Math.max(old,+s.kc||0))}return{attempts:[...src.values()].reduce((a,b)=>a+b,0),sources:src.size}}
function sample(metrics){const e=exposure(metrics),n=metrics.length;if(n<12||e.attempts<75)return{key:'insufficient',label:'insufficient sample',detail:n+' scored items · '+fmt(e.attempts)+' source attempts'};if(n<35||e.attempts<350)return{key:'limited',label:'limited sample',detail:n+' scored items · '+fmt(e.attempts)+' source attempts'};return{key:'usable',label:'usable sample',detail:n+' scored items · '+fmt(e.attempts)+' source attempts'}}
function indices(metrics){
 const rawSum=metrics.reduce((n,m)=>n+cappedZ(m.z),0),rawDen=Math.sqrt(metrics.length||0),raw=rawDen?rawSum/rawDen:null;
 const weighted=independentUnits(metrics);
 const itemNumerator=weighted.reduce((n,x)=>n+x.z*x.w,0);
 const itemWeightSq=weighted.reduce((n,x)=>n+x.w*x.w,0);
 const portfolios=RAID_PORTFOLIOS.map(d=>raidPortfolio(metrics,d)).filter(Boolean);
 const portfolioNumerator=portfolios.reduce((n,p)=>n+p.contribution,0);
 const portfolioWeightSq=portfolios.reduce((n,p)=>n+p.effectiveWeight*p.effectiveWeight,0);
 const numerator=itemNumerator+portfolioNumerator;
 const denom=Math.sqrt(itemWeightSq+portfolioWeightSq);
 const meaningful=denom?numerator/denom:null,score=luckScore(meaningful),financial=financialIndex(metrics);
 return{raw,rawSum,rawCount:metrics.length,meaningful,numerator,denom,score,financial,weightedCount:weighted.length,dependentCollapsed:metrics.length-weighted.length,portfolios,itemNumerator,portfolioNumerator,sourceSaturated:weighted.filter(x=>x.sourceScale&&x.sourceScale<.999).length}
}
function entityStats(ps){const metrics=metricsFor(ps),idx=indices(metrics),s=sample(metrics);return{metrics,idx,s}}
function renderPicker(){
 const h=$('#clogLuckMembers');if(!h)return;
 U.renderMemberPicker(h,selected,keys=>{const next=new Set(keys);if(U.sameSelection(selected,next))return;selected=next;U.saveMemberSelection(selected);reset();render()},{title:'Members in luck analysis',subtitle:'Add or remove RNG sources. Raw percentiles and the overall-impact portfolio use exactly those players. Teammate compensation and synergy only apply when that teammate is included in the selected combination.',fallback:U.ALL_KEYS,availability:model.known})
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
 '<div class="clog-luck-kpi"><span>Raw drop-rate RNG</span><b class="clog-luck-'+tone(s.idx.raw||0)+'">'+(s.idx.raw==null?'—':sig(s.idx.raw))+'</b><small>Unweighted statistical deviation across '+fmt(s.idx.rawCount)+' calculable Collection Log entries. This answers pure spoon-versus-dry probability.</small></div>'+
 '<div class="clog-luck-kpi"><span>GE-weighted RNG</span><b class="clog-luck-'+tone(s.idx.financial.z||0)+'">'+(s.idx.financial.z==null?'—':sig(s.idx.financial.z))+'</b><small>'+fmt(s.idx.financial.count)+' priced entries · approximate observed-minus-expected value '+(s.idx.financial.deltaGp>=0?'+':'−')+money(Math.abs(s.idx.financial.deltaGp))+' gp. Price is log-scaled so one ultra-expensive item matters much more without becoming the whole score.</small></div>'+
 '<div class="clog-luck-kpi"><span>Data quality</span><b>'+esc(s.s.label)+'</b><small>'+esc(s.s.detail)+' · '+esc(sync.text)+'</small></div>';
 const badge=$('#clogLuckImpossibleCount');if(badge)badge.textContent=fmt(excluded.length)
}
function rngDetailTitle(m){
 const parts=[];
 const sources=m?.r?.sources||[];
 if(sources.length)parts.push(sources.map(s=>{
  const kc=Number.isFinite(+s.kc)?fmt(s.kc)+' KC':'KC unavailable';
  const exp=Number.isFinite(+s.expected)?' → '+(+s.expected).toFixed(+s.expected<10?2:1)+' expected':'';
  return String(s.label||s.source||'Source')+': '+kc+exp
 }).join(' · '));
 const expected=Number.isFinite(m?.r?.expected)?+m.r.expected:null,observed=Number.isFinite(+m?.r?.observed)?+m.r.observed:null;
 const chance=x=>{x=100*(+x||0);return x<.01?'<0.01%':x>99.99?'>99.99%':x<1||x>99?x.toFixed(2)+'%':Math.round(x)+'%'};
 if(expected!=null&&observed!=null){
  if(observed<expected&&Number.isFinite(+m?.r?.dryTail))parts.push('Chance of this count or fewer: '+chance(m.r.dryTail));
  else if(observed>expected&&Number.isFinite(+m?.r?.luckyTail))parts.push('Chance of this count or more: '+chance(m.r.luckyTail));
 }
 const notes=(m?.r?.notes||[]).filter(Boolean);
 if(notes.length)parts.push('Model notes: '+notes.join(' · '));
 return parts.join(' · ')
}
function rngInfo(m){
 const detail=rngDetailTitle(m);return detail?'<span class="rng-assumption-info" tabindex="0" title="'+esc(detail)+'" aria-label="'+esc(detail)+'">ⓘ</span>':''
}
function itemRow(m){
 const expected=Number.isFinite(m.r.expected)?m.r.expected:null,actual=fmt(m.r.observed),pct=m.r.text,z=cappedZ(m.z);
 if(lens==='raw'){
  const sub=actual+' actual · '+(expected==null?'expected n/a':expected.toFixed(expected<10?2:1)+' expected')+' · '+pct+' percentile';
  return '<article class="clog-luck-item"><img src="https://static.runelite.net/cache/item/icon/'+m.id+'.png" alt=""><div class="clog-luck-item-copy"><b>'+U.itemLink(m.id,m.name)+'</b><small>'+sub+rngInfo(m)+'</small></div><div class="clog-luck-item-score"><strong class="clog-luck-'+tone(z)+'">'+sig(z)+'</strong><small>pure statistical deviation</small></div></article>'
 }
 if(lens==='value'){
  const fw=financialWeight(m),delta=expected==null?null:(m.r.observed-expected)*fw.gp,contribution=z*fw.w;
  const sub=actual+' actual · '+(expected==null?'expected n/a':expected.toFixed(expected<10?2:1)+' expected')+' · '+pct+' percentile · GE '+money(fw.gp)+' gp'+(delta==null?'':' · Δ '+(delta>=0?'+':'−')+money(Math.abs(delta))+' gp');
  return '<article class="clog-luck-item"><img src="https://static.runelite.net/cache/item/icon/'+m.id+'.png" alt=""><div class="clog-luck-item-copy"><b>'+U.itemLink(m.id,m.name)+'</b><small>'+sub+rngInfo(m)+'</small></div><div class="clog-luck-item-score"><strong class="clog-luck-'+tone(contribution)+'">'+signed(contribution)+'</strong><small>'+sig(z)+' × '+fw.w.toFixed(2)+' value weight</small></div></article>'
 }
 const rank=m.meaningfulRank||meaningfulRank(m,z),imp=rank.imp,contribution=rank.score;
 const modifiers=[];
 if(imp.copy<.98)modifiers.push('duplicate utility '+Math.round(imp.copy*100)+'%');
 if(imp.synergy?.label)modifiers.push(imp.synergy.label);
 if(imp.deficit?.f<.98&&imp.deficit.label)modifiers.push('dryness softened: '+imp.deficit.label);
 if(imp.confidence.f<1)modifiers.push(Math.round(imp.confidence.f*100)+'% model confidence');
 if(rank.earlyUnlockBonus>0)modifiers.push('early major-unlock timing');
 if(z<0&&rank.dryGate<1)modifiers.push(rank.dryGate<=0?'not meaningfully dry yet':'dryness evidence still maturing');
 const sub=actual+' actual · '+(expected==null?'expected n/a':expected.toFixed(expected<10?2:1)+' expected')+' · '+pct+' percentile · '+imp.label+(modifiers.length?' · '+modifiers.join(' · '):'');
 const evidenceLabel=Math.abs((rank.signal??z)-z)>.01?sig(rank.signal)+' contextual evidence (raw '+sig(z)+')':sig(z)+' evidence';
 return '<article class="clog-luck-item"><img src="https://static.runelite.net/cache/item/icon/'+m.id+'.png" alt=""><div class="clog-luck-item-copy"><b>'+U.itemLink(m.id,m.name)+'</b><small>'+sub+rngInfo(m)+'</small></div><div class="clog-luck-item-score"><strong class="clog-luck-'+tone(contribution)+'">'+signed(contribution)+'</strong><small>'+evidenceLabel+' · '+imp.w.toFixed(2)+' impact · '+rank.impactFactor.toFixed(2)+'× rank modifier</small></div></article>'
}
function excludedSearchRow(x){
 return '<article class="clog-luck-item clog-luck-search-excluded"><img src="https://static.runelite.net/cache/item/icon/'+x.id+'.png" alt=""><div class="clog-luck-item-copy"><b>'+U.itemLink(x.id,x.name)+'</b><small>'+esc(x.reason.detail)+'</small></div><div class="clog-luck-item-score"><strong>Excluded</strong><small>'+esc(x.reason.label)+' · '+fmt(x.count)+' logged</small></div></article>'
}
function renderSearch(){
 const host=$('#clogLuckSearchResults'),count=$('#clogLuckSearchCount'),input=$('#clogLuckSearch');if(!host)return;
 const q=String(search||input?.value||'').trim().toLowerCase();
 if(input&&input.value!==search)input.value=search;
 if(!q){if(count)count.textContent='';host.innerHTML='<div class="clog-luck-empty">Type an item name to search the full RNG database.</div>';return}
 const ps=selectedPlayers();if(!ps.length){if(count)count.textContent='0 matches';host.innerHTML='<div class="clog-luck-empty">No selected synced members.</div>';return}
 const allMetrics=entityStats(ps).metrics,rankedRows=ranked(allMetrics),rankedById=new Map(rankedRows.map(m=>[m.id,m]));
 const scored=allMetrics.filter(m=>String(m.name||'').toLowerCase().includes(q)||String(m.id)===q).map(m=>rankedById.get(m.id)||({...m,sort:0})).sort((a,b)=>(b.sort||0)-(a.sort||0)||a.name.localeCompare(b.name));
 const excluded=excludedFor(ps).filter(x=>String(x.name||'').toLowerCase().includes(q)||String(x.id)===q).sort((a,b)=>a.name.localeCompare(b.name));
 const total=scored.length+excluded.length;if(count)count.textContent=fmt(total)+' match'+(total===1?'':'es');
 host.innerHTML=total?scored.map(itemRow).join('')+excluded.map(excludedSearchRow).join(''):'<div class="clog-luck-empty">No RNG items match “'+esc(search)+'”.</div>'
}
function meaningfulLuckyEligible(m){
 const p=impactProfile(m);
 // Pure statistical oddities still belong in the Raw view. The meaningful
 // positive list is reserved for drops with actual equipment/progression use.
 return p.base>=.5&&!['cosmetic','vanity','low-impact'].includes(p.kind)
}
function luckyFamilySizes(metrics){
 const groups=new Map(),out=new Map();
 for(const m of metrics){
   const family=sourceFamilyKey([m]),dep=L.dependencyKey?.(m.id)||('item:'+m.id);
   if(!groups.has(family))groups.set(family,new Set());
   groups.get(family).add(dep)
 }
 for(const m of metrics)out.set(m.id,groups.get(sourceFamilyKey([m]))?.size||1);
 return out
}
function meaningfulRank(m,z=null,familySize=1){
 z=z==null?cappedZ(m.z):cappedZ(z);
 const ctx=meaningfulContext(m,z),signal=ctx.signal,imp=impactWeight(m,signal),severity=Math.abs(signal);
 let evidence=severity*severity,earlyUnlockBonus=0;
 const importanceBoost=1+.20*Math.max(0,Math.min(5,imp.base-5));
 if(signal<0){
   // Once dryness has cleared the stricter evidence gate, important dry streaks
   // should bite harder than a comparable spoon helps. This prevents a pile of
   // modest positive outcomes from washing out one genuinely punishing grind.
   const impactFactor=(.90+1.65*(1-Math.exp(-imp.w/3)))*importanceBoost;
   return{imp,impactFactor,importanceBoost,evidence,searchPenalty:1,familySize,score:-evidence*impactFactor,side:'dry',signal,dryGate:ctx.dryGate,drySeverity:ctx.drySeverity,earlyUnlockBonus:0}
 }
 // First-copy timing gets a modest progression bonus for major items that
 // arrived before one expected copy. This is not treated as extra raw RNG.
 if(signal>0&&ctx.observed>0&&ctx.expected!=null&&ctx.expected<1&&imp.base>=5){
  earlyUnlockBonus=Math.min(1.25,.30*Math.min(5,Math.max(0,imp.base-5))*(1-ctx.expected));
  evidence+=earlyUnlockBonus;
 }
 const impactFactor=(.35+1.85*(1-Math.exp(-imp.w/3)))*importanceBoost;
 const searchPenalty=1/Math.sqrt(1+Math.log2(Math.max(1,familySize))/4);
 return{imp,impactFactor,importanceBoost,evidence,searchPenalty,familySize,score:evidence*impactFactor*searchPenalty,side:'lucky',signal,dryGate:ctx.dryGate,earlyUnlockBonus}
}
function ranked(metrics){
 const familySizes=lens==='meaningful'?luckyFamilySizes(metrics):null;
 return metrics.map(m=>{
  const z=cappedZ(m.z);
  if(lens==='raw')return{...m,sort:z};
  if(lens==='value'){const fw=financialWeight(m);return{...m,fw,sort:z*fw.w}}
  const rank=meaningfulRank(m,z,familySizes?.get(m.id)||1);return{...m,imp:rank.imp,meaningfulRank:rank,sort:rank.score}
 }).filter(m=>lens!=='value'||m.fw?.w>0).sort((a,b)=>b.sort-a.sort)
}
function renderLists(){
 const ps=selectedPlayers(),subjectLabel=ps.map(p=>p.name).join(', ')||'no selected members',stats=ps.length?entityStats(ps):null,metrics=stats?.metrics||[],rows=ranked(metrics),lucky=(lens==='meaningful'?rows.filter(m=>meaningfulLuckyEligible(m)):rows).filter(m=>m.sort>0&&(+m.r?.observed||0)>0).slice(0,8),dry=[...rows].filter(m=>m.sort<0).sort((a,b)=>a.sort-b.sort).slice(0,8);
 const formula=$('#clogLuckFormula');
 if(formula){
  if(!stats)formula.innerHTML='';
  else if(lens==='raw')formula.innerHTML='<div class="rng-formula-summary"><span>Raw drop-rate signal</span><strong>'+sig(stats.idx.raw)+'</strong><small>Pure probability only</small></div><p>Items are ordered only by their percentile-derived σ deviation. No GE price or gameplay-impact weighting is used.</p>';
  else if(lens==='value')formula.innerHTML='<div class="rng-formula-summary"><span>GE-weighted signal</span><strong>'+sig(stats.idx.financial.z)+'</strong><small>'+(stats.idx.financial.deltaGp>=0?'+':'−')+money(Math.abs(stats.idx.financial.deltaGp))+' gp vs expected</small></div><p>Probability deviation is multiplied by a log-scaled live GE weight. This lens is deliberately separate from the headline RNG Index.</p>';
  else {
   const raidText=stats.idx.portfolios.length?stats.idx.portfolios.map(p=>'<li><b>'+esc(p.label)+'</b><span>'+fmt(p.observed)+' actual vs '+p.expected.toFixed(1)+' expected</span><small>volume '+sig(p.volumeZ)+' · quality '+sig(p.qualityZ)+' · coverage '+sig(p.coverageZ)+' → '+sig(p.z)+'</small></li>').join(''):'<li><span>No raid portfolio with a usable expected-drop denominator.</span></li>';
   formula.innerHTML='<div class="rng-formula-summary"><span>Headline RNG Index</span><strong>'+scoreText(stats.idx.score)+'</strong><small>'+sig(stats.idx.meaningful)+' normalized impact signal</small></div>'+
   '<div class="rng-formula-equation"><span><small>Items</small><b>'+signed(stats.idx.itemNumerator)+'</b></span><em>+</em><span><small>Raid portfolios</small><b>'+signed(stats.idx.portfolioNumerator)+'</b></span><em>÷</em><span><small>Weight norm</small><b>'+stats.idx.denom.toFixed(2)+'</b></span><em>=</em><span><small>Combined</small><b>'+sig(stats.idx.meaningful)+'</b></span></div>'+
   '<details class="rng-formula-detail"><summary>Calculation breakdown</summary><div><p><b>Evidence × impact × context.</b> Item impact comes from the explicit 885-item mature-GIM utility table. Assumption-heavy mechanics are confidence-damped; useful copies diminish with group coverage; complementary gear can add capped synergy; dry streaks can be softened when teammates already solved the slot.</p><ul>'+raidText+'</ul><p>Meaningful lucky drops use stronger relevance filtering plus a modest source-family look-elsewhere discount. A below-expectation item can contribute a small negative when fewer than half of comparable players would have this count or fewer. Below a 25% one-sided lower tail, dryness becomes meaningfully stronger; extreme established dry streaks are deliberately penalized more strongly than comparable positive deviations are rewarded. Major first copies obtained before one expected copy can receive a modest progression-timing bonus. Raid items represented in a pooled portfolio retain only part of their ordinary item-level weight to avoid double counting. Large source tables are L2-capped and item σ is capped at ±3.50.</p></div></details>';
  }
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
 const best=r.find(x=>x.sort>0&&(+x.r?.observed||0)>0)||null;
 const worst=[...r].filter(x=>x.sort<0).sort((a,b)=>a.sort-b.sort)[0]||null;
 return{best,worst}
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
function render(){if(!model||!wom)return;renderPicker();overview();renderLists();renderSearch();renderIndividuals();renderPlayers();renderImpossible();renderView()}
function bind(){
 document.querySelectorAll('[data-luck-view]').forEach(b=>b.onclick=()=>{view=b.dataset.luckView;renderView()});
 document.querySelectorAll('[data-luck-lens]').forEach(b=>b.onclick=()=>{lens=b.dataset.luckLens||'meaningful';document.querySelectorAll('[data-luck-lens]').forEach(x=>x.classList.toggle('active',x===b));renderLists();renderSearch()});
 const searchInput=$('#clogLuckSearch'),clear=$('#clogLuckSearchClear');
 if(searchInput&&!searchInput.dataset.bound){searchInput.dataset.bound='1';searchInput.addEventListener('input',()=>{search=searchInput.value;renderSearch()})}
 if(clear&&!clear.dataset.bound){clear.dataset.bound='1';clear.onclick=()=>{search='';if(searchInput)searchInput.value='';renderSearch();searchInput?.focus()}}
 const tab=$('[data-gim-tab="luck"]');if(tab&&!tab.dataset.luckBound){tab.dataset.luckBound='1';tab.addEventListener('click',()=>{render();if(!prices)loadPrices().then(()=>render())})}
}
function reset(){metricCache=new Map();excludedCache=new Map();portfolioCache=new Map()}
window.addEventListener('ug:members-changed',e=>{const keys=U.cleanSelection(e.detail?.keys,U.ALL_KEYS);if(U.sameSelection(selected,keys))return;selected=keys;reset();render()});
window.addEventListener('ug:data-updated',async e=>{if(e.detail?.key===U.TKEY){doc=await U.loadClog();model=M.build(doc,U.PLAYERS);reset();render()}else if(e.detail?.key===U.WKEY){wom=await U.loadWom();reset();render()}});
async function init(){[doc,wom]=await Promise.all([U.loadClog(),U.loadWom()]);model=M.build(doc,U.PLAYERS);bind();render();loadPrices().then(()=>render())}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();