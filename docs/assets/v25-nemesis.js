(()=>{
'use strict';
const U=window.UGV21,C=window.UGV21Charts;if(!U||!C)return;
const {$,PLAYERS,fmt,compact,nice,escapeHtml}=U;
const SKILLS=['attack','strength','defence','hitpoints','ranged','prayer','magic','cooking','woodcutting','fletching','fishing','firemaking','crafting','smithing','mining','herblore','agility','thieving','slayer','farming','runecrafting','hunter','construction','sailing'];
const MAX_EXTERNAL=10;
const EXT_COLORS=['#d66bea','#7db5ff','#ed8e65','#78c7a2','#d5b65b','#a88bea','#e27a9e','#78b7c2','#c39064','#a8bd68'];
const GROUP_COLORS={external:'#d66bea',united:'#e6ad43'};
let externals=[],ownWom=null,ownClog=null,selection=U.loadMemberSelection();
let comparePeriod=365,compareMode='gain',compareView='timeline',compareScope='group',compareMetric='total_xp',compareSkill='slayer',compareBoss='',compareActivity='',compareAtDate=null;
let historyPromise=null;

function cleanName(v){return String(v||'').replace(/\s+/g,' ').trim().slice(0,12)}
function keyName(v){return cleanName(v).toLowerCase()}
function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
function apiError(j){return !j||typeof j!=='object'||j.error||j.errors||j.success===false}
async function fetchJson(url,ms=15000){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);
 try{
  const r=await fetch(url,{cache:'no-store',credentials:'omit',headers:{Accept:'application/json'},signal:c.signal});
  let j=null;try{j=await r.json()}catch{}
  if(r.status===404)return{kind:'missing',status:404,data:null};
  if(!r.ok)return{kind:'error',status:r.status,error:j?.error||j?.message||('HTTP '+r.status),data:null};
  if(apiError(j))return{kind:'missing',status:r.status,error:j?.error||j?.message||null,data:null};
  return{kind:'ok',status:r.status,data:j}
 }catch(e){return{kind:'error',status:0,error:e?.name==='AbortError'?'request timed out':String(e?.message||e),data:null}}
 finally{clearTimeout(timer)}
}
function womSnapshot(raw){return raw?.latestSnapshot?.data||raw?.latest_snapshot?.data||raw?.data?.latestSnapshot?.data||null}
function womProfile(raw){
 const d=womSnapshot(raw);if(!d?.skills)return null;
 const skills={};for(const k of SKILLS){const x=d.skills?.[k]||{};skills[k]={level:n(x.level),experience:n(x.experience),rank:n(x.rank)}}
 const o=d.skills?.overall||{},bosses={},activities={};
 for(const [k,v] of Object.entries(d.bosses||{})){const kills=n(v?.kills??v?.killCount??v);if(kills!=null)bosses[k]=Math.max(0,kills)}
 for(const [k,v] of Object.entries(d.activities||{})){const score=n(v?.score??v);if(score!=null)activities[k]=Math.max(0,score)}
 return{
  source:'WOM',displayName:raw?.displayName||raw?.username||raw?.player?.displayName||raw?.player?.username||'Nemesis',
  type:raw?.type||raw?.player?.type||null,updatedAt:raw?.updatedAt||raw?.latestSnapshot?.createdAt||raw?.latest_snapshot?.createdAt||null,
  overall:{level:n(o.level),experience:n(o.experience),rank:n(o.rank)},ehp:n(d.computed?.ehp?.value??d.computed?.ehp),ehb:n(d.computed?.ehb?.value??d.computed?.ehb),
  skills,bosses,activities
 }
}
function templeData(raw){return raw?.data&&typeof raw.data==='object'?raw.data:raw}
function ciMap(obj){const m=new Map();for(const [k,v] of Object.entries(obj||{}))m.set(String(k).toLowerCase(),v);return m}
function getCi(m,...keys){for(const k of keys){if(k==null)continue;const v=m.get(String(k).toLowerCase());if(v!==undefined)return v}return undefined}
function templeStatsProfile(raw,name){
 const d=templeData(raw);if(!d||typeof d!=='object')return null;const m=ciMap(d),skills={};
 let levelSum=0,xpSum=0,known=0;
 for(const k of SKILLS){
  const label=k==='runecrafting'?'runecraft':k;
  const level=n(getCi(m,label+'_level',k+'_level')),experience=n(getCi(m,label,k));
  skills[k]={level,experience,rank:n(getCi(m,label+'_rank',k+'_rank'))};
  if(level!=null){levelSum+=level;known++}if(experience!=null)xpSum+=experience
 }
 if(!known)return null;
 const level=n(getCi(m,'overall_level','total_level'))??levelSum;
 const experience=n(getCi(m,'overall','overall_xp','total_xp'))??xpSum;
 const primaryEhp=getCi(m,'primary_ehp'),primaryEhb=getCi(m,'primary_ehb');
 const ehp=n(getCi(m,'ehp','im_ehp','uim_ehp',typeof primaryEhp==='string'?primaryEhp:null));
 const ehb=n(getCi(m,'ehb','im_ehb','uim_ehb',typeof primaryEhb==='string'?primaryEhb:null));
 return{source:'Temple',displayName:getCi(m,'player_name_with_capitalization','player')||name,updatedAt:getCi(m,'date','last_update','last_updated')||null,overall:{level,experience,rank:n(getCi(m,'overall_rank'))},ehp,ehb,skills,bosses:{}}
}
function collectItemIds(raw){
 const d=templeData(raw),ids=new Map(),seen=new Set();
 function walk(x){
  if(x==null)return;
  if(Array.isArray(x)){
   if(x.length&&x.every(v=>Number.isInteger(+v)&&+v>0)){for(const v of x){const id=+v;ids.set(id,{id,count:1,name:null})};return}
   for(const v of x)walk(v);return
  }
  if(typeof x!=='object'||seen.has(x))return;seen.add(x);
  const id=n(x.id??x.item_id??x.itemId),count=n(x.count??x.quantity??x.amount??(x.obtained?1:null));
  if(id!=null&&id>0&&(count==null||count>0)){ids.set(id,{id,count:count??1,name:x.name||x.item_name||x.itemName||null});return}
  for(const [k,v] of Object.entries(x)){
   if(/^\d+$/.test(k)){const kid=+k,kv=n(v);if(kid>0&&kv!=null&&kv>0){ids.set(kid,{id:kid,count:kv,name:null});continue}}
   walk(v)
  }
 }
 walk(d?.items??d);return ids
}
function clogProfile(raw){
 const d=templeData(raw);if(!d||typeof d!=='object')return null;
 const items=collectItemIds(raw),finished=n(d.total_collections_finished??d.total_collections??d.collections_finished);
 if(!items.size&&finished==null)return null;
 return{items,total:finished??items.size,totalAvailable:n(d.total_collections_available??d.total_collections_possible),lastChanged:d.last_changed??d.last_checked??null}
}
function ownWomProfile(key){
 const p=ownWom?.profiles?.[key];if(!p)return null;
 return womProfile({displayName:PLAYERS.find(x=>x.key===key)?.name,latestSnapshot:p.latestSnapshot||p.latest_snapshot,type:p.type,updatedAt:p.updatedAt})
}
function ownClogProfile(key){const log=ownClog?.players?.[key];return log?clogProfile(log):null}
function sourceState(r,label){
 if(r?.kind==='ok')return{ok:true,label,text:label+' available',cls:'ok'};
 if(r?.kind==='missing')return{ok:false,label,text:label+' not synced / not found',cls:'missing'};
 return{ok:false,label,text:label+' request failed',cls:'error',detail:r?.error||''}
}
async function lookup(name){
 const enc=encodeURIComponent(name);
 const urls={
  wom:'https://api.wiseoldman.net/v2/players/'+enc,
  templeStats:'https://templeosrs.com/api/player_stats.php?player='+enc+'&bosses=1',
  templeClog:'https://templeosrs.com/api/collection-log/player_collection_log.php?player='+enc+'&categories=all&includenames=1&dateformat=unix'
 };
 const [wom,ts,tc]=await Promise.all([fetchJson(urls.wom),fetchJson(urls.templeStats),fetchJson(urls.templeClog,20000)]);
 const wp=wom.kind==='ok'?womProfile(wom.data):null,tsp=ts.kind==='ok'?templeStatsProfile(ts.data,name):null,tcp=tc.kind==='ok'?clogProfile(tc.data):null;
 if(wom.kind==='ok'&&!wp)wom.kind='missing';
 if(ts.kind==='ok'&&!tsp)ts.kind='missing';
 if(tc.kind==='ok'&&!tcp)tc.kind='missing';
 return{id:keyName(name),name,displayName:wp?.displayName||tsp?.displayName||name,wom,templeStats:ts,templeClog:tc,womProfile:wp,templeStatsProfile:tsp,clog:tcp,stats:wp||tsp,womRaw:wom.data||null,color:EXT_COLORS[externals.length%EXT_COLORS.length],history:{snapshots:[],yearLoaded:false,allLoaded:false,loading:false,error:null}}
}

function latestRawSnapshot(raw){return raw?.latestSnapshot||raw?.latest_snapshot||raw?.data?.latestSnapshot||raw?.data?.latest_snapshot||null}
function uniqSnapshots(rows){
 const map=new Map();
 for(const row of rows||[]){if(!row?.createdAt||!row?.data)continue;map.set(String(row.createdAt),row)}
 return [...map.values()].sort((a,b)=>+new Date(a.createdAt)-+new Date(b.createdAt))
}
function externalSnapshots(x){
 const latest=latestRawSnapshot(x?.womRaw),rows=[...(x?.history?.snapshots||[])];
 if(latest?.createdAt&&latest?.data)rows.push(latest);
 return uniqSnapshots(rows)
}
function ownSnapshots(p){return C.snaps(ownWom,p.key)}
function periodLabel(v){return v==='all'?'All history':({365:'1 year',180:'6 months',90:'3 months',30:'1 month',7:'1 week'}[String(v)]||String(v)+' days')}
function latestComparisonTime(){
 const times=[];
 for(const p of selectedPlayers())for(const row of ownSnapshots(p))times.push(+new Date(row.createdAt));
 for(const x of externals)for(const row of externalSnapshots(x))times.push(+new Date(row.createdAt));
 return times.filter(Number.isFinite).length?Math.max(...times.filter(Number.isFinite)):Date.now()
}
function comparisonWindow(){
 if(comparePeriod==='all')return null;
 const end=latestComparisonTime(),days=+comparePeriod||365;
 return{start:end-days*864e5,end}
}
function withinWindow(rows){
 const w=comparisonWindow();if(!w)return rows.slice();
 return rows.filter(r=>{const t=+new Date(r.createdAt);return t>=w.start&&t<=w.end})
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function loadExternalHistory(x,all=false){
 if(!x?.womProfile)return;
 const h=x.history||(x.history={snapshots:[],yearLoaded:false,allLoaded:false,loading:false,error:null});
 if((all&&h.allLoaded)||(!all&&(h.yearLoaded||h.allLoaded))||h.loading)return;
 h.loading=true;h.error=null;renderExternalRoster();renderProgressComparison();
 try{
  const latest=latestRawSnapshot(x.womRaw),endMs=latest?.createdAt?+new Date(latest.createdAt):Date.now();
  if(!Number.isFinite(endMs))throw new Error('latest WOM snapshot date unavailable');
  const startMs=all?Date.UTC(2013,0,1):endMs-370*864e5;
  const base='https://api.wiseoldman.net/v2/players/'+encodeURIComponent(x.name);
  const rows=[];
  for(let offset=0;offset<1000;offset+=50){
   const q=new URLSearchParams({startDate:new Date(startMs).toISOString(),endDate:new Date(endMs).toISOString(),limit:'50',offset:String(offset)});
   const res=await fetchJson(base+'/snapshots?'+q,22000);
   if(res.kind!=='ok')throw new Error(res.error||('WOM history HTTP '+res.status));
   const batch=Array.isArray(res.data)?res.data:(Array.isArray(res.data?.data)?res.data.data:null);
   if(!batch)throw new Error('WOM returned an invalid history response');
   rows.push(...batch.filter(r=>r?.createdAt&&r?.data));
   if(batch.length<50)break;
   if(offset===950)throw new Error('WOM history exceeded the 1,000-snapshot safety limit');
   await sleep(90)
  }
  h.snapshots=uniqSnapshots([...(h.snapshots||[]),...rows,latest].filter(Boolean));
  if(all){h.allLoaded=true;h.yearLoaded=true}else h.yearLoaded=true
 }catch(e){h.error=String(e?.message||e)}
 finally{h.loading=false;renderExternalRoster();renderProgressComparison()}
}
async function ensureExternalHistory(){
 const all=comparePeriod==='all';
 const targets=externals.filter(x=>x.womProfile&&!(all?x.history?.allLoaded:(x.history?.yearLoaded||x.history?.allLoaded))&&!x.history?.loading);
 if(!targets.length)return;
 for(const x of targets)await loadExternalHistory(x,all)
}
function metricSpec(){
 if(compareMetric==='total_xp')return{kind:'skill',key:'overall',label:'Total XP',format:'compact'};
 if(compareMetric==='total_level')return{kind:'level',key:'overall',label:'Total level',format:'integer'};
 if(compareMetric==='ehp')return{kind:'computed',key:'ehp',label:'EHP',format:'hours'};
 if(compareMetric==='ehb')return{kind:'computed',key:'ehb',label:'EHB',format:'hours'};
 if(compareMetric==='raids')return{kind:'raids',key:'raids',label:'Raid KC',format:'integer'};
 if(compareMetric==='maxed')return{kind:'maxed',key:'maxed',label:'Skills at 99',format:'integer'};
 if(compareMetric==='skill')return{kind:'skill',key:compareSkill||'slayer',label:nice(compareSkill||'slayer')+' XP',format:'compact'};
 if(compareMetric==='boss')return{kind:'boss',key:compareBoss,label:nice(compareBoss||'boss')+' KC',format:'integer'};
 return{kind:'activity',key:compareActivity,label:nice(compareActivity||'activity')+' score',format:'integer'}
}
function currentFromStats(stats,spec){
 if(!stats)return null;
 if(spec.kind==='skill'){
  if(spec.key==='overall')return n(stats.overall?.experience);
  return n(stats.skills?.[spec.key]?.experience)
 }
 if(spec.kind==='level')return n(stats.overall?.level);
 if(spec.kind==='computed')return n(stats[spec.key]);
 if(spec.kind==='boss')return n(stats.bosses?.[spec.key]);
 if(spec.kind==='activity')return n(stats.activities?.[spec.key]);
 return null
}
function externalLatestData(x){return latestRawSnapshot(x?.womRaw)?.data||null}
function externalCurrentMetric(x,spec){
 const d=externalLatestData(x),direct=d?C.metricValue(d,spec.kind,spec.key):null;
 if(direct!=null)return direct;
 if(spec.kind==='raids'||spec.kind==='maxed')return null;
 return currentFromStats(x.stats,spec)
}
function ownCurrentMetric(p,spec){return C.metricValue(U.snapData(ownWom,p.key)||{},spec.kind,spec.key)}
function metricSeries(rows,spec){
 const w=comparisonWindow();
 return rows.map(r=>({date:r.createdAt,value:C.metricValue(r.data,spec.kind,spec.key)}))
   .filter(x=>x.value!=null&&(!w||(+new Date(x.date)>=w.start&&+new Date(x.date)<=w.end)))
   .sort((a,b)=>+new Date(a.date)-+new Date(b.date))
}
function aggregateSeries(memberSeries){
 const streams=memberSeries.filter(a=>a.length);
 if(!streams.length)return[];
 const first=Math.max(...streams.map(a=>+new Date(a[0].date)));
 const times=[...new Set(streams.flatMap(a=>a.map(x=>+new Date(x.date))).filter(t=>t>=first))].sort((a,b)=>a-b);
 const pos=streams.map(()=>0),last=streams.map(()=>null),out=[];
 for(const t of times){
  let ok=true,total=0;
  for(let i=0;i<streams.length;i++){
   const a=streams[i];
   while(pos[i]<a.length&&+new Date(a[pos[i]].date)<=t){last[i]=a[pos[i]];pos[i]++}
   if(!last[i]){ok=false;break}
   total+=+last[i].value||0
  }
  if(ok)out.push({date:new Date(t).toISOString(),value:total})
 }
 return out
}
function externalGroupSeries(spec){return aggregateSeries(externals.filter(x=>x.womProfile).map(x=>metricSeries(externalSnapshots(x),spec)))}
function unitedGroupSeries(spec){return aggregateSeries(selectedPlayers().map(p=>metricSeries(ownSnapshots(p),spec)))}
function deltaFromSeries(a){return a.length>=2?(+a.at(-1).value||0)-(+a[0].value||0):null}
function nearestSnapshot(rows,target){
 const a=(rows||[]).filter(r=>r?.createdAt&&r?.data);
 if(!a.length)return null;
 const snap=a.reduce((best,row)=>Math.abs(+new Date(row.createdAt)-target)<Math.abs(+new Date(best.createdAt)-target)?row:best,a[0]);
 return{snap,diffDays:Math.abs(+new Date(snap.createdAt)-target)/864e5}
}
function historicalValue(snap,spec){return snap?.data?C.metricValue(snap.data,spec.kind,spec.key):null}
function dateLabel(ms){return new Date(ms).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
function timeQuality(days){
 if(days==null)return'No snapshot';
 if(days<.6)return'Same day';
 if(days<=7)return Math.round(days)+' days away';
 return Math.round(days)+' days away'
}
function externalMemberValue(x,spec){
 if(compareMode==='current')return externalCurrentMetric(x,spec);
 return deltaFromSeries(metricSeries(externalSnapshots(x),spec))
}
function ownMemberValue(p,spec){
 if(compareMode==='current')return ownCurrentMetric(p,spec);
 return deltaFromSeries(metricSeries(ownSnapshots(p),spec))
}
function groupBarEntries(spec){
 const ev=sumValues(externals.map(x=>externalMemberValue(x,spec))).value,uv=sumValues(selectedPlayers().map(p=>ownMemberValue(p,spec))).value;
 return[
  {name:'External group',color:GROUP_COLORS.external,value:ev},
  {name:'United Gimps',color:GROUP_COLORS.united,value:uv}
 ]
}
function memberBarEntries(spec){
 return[
  ...externals.map(x=>({name:x.displayName||x.name,color:x.color,value:externalMemberValue(x,spec)})),
  ...selectedPlayers().map(p=>({name:p.name,color:p.color,value:ownMemberValue(p,spec)}))
 ]
}
function memberLineSeries(spec){
 return[
  ...externals.filter(x=>x.womProfile).map(x=>({name:x.displayName||x.name,color:x.color,data:metricSeries(externalSnapshots(x),spec)})),
  ...selectedPlayers().map(p=>({name:p.name,color:p.color,data:metricSeries(ownSnapshots(p),spec)}))
 ]
}
function selectedPlayers(){return PLAYERS.filter(p=>selection.has(p.key))}
function f1(v){return v!=null&&Number.isFinite(+v)?(+v).toLocaleString('en-GB',{maximumFractionDigits:1}):'—'}
function fi(v){return v!=null&&Number.isFinite(+v)?fmt(v):'—'}
function ci(v){return v!=null&&Number.isFinite(+v)?compact(v):'—'}
function signed(v,digits=0){
 if(v==null||!Number.isFinite(+v))return'—';const x=+v,opts=digits?{maximumFractionDigits:digits,minimumFractionDigits:digits}:{maximumFractionDigits:0};
 return(x>0?'+':'')+x.toLocaleString('en-GB',opts)
}
function sumValues(values){const a=values.filter(v=>v!=null&&Number.isFinite(+v)).map(Number);return{value:a.length?a.reduce((x,y)=>x+y,0):null,count:a.length}}
function unionClogs(rows){const items=new Map();for(const c of rows.filter(Boolean))for(const [id,v] of c.items)items.set(id,v);return items}
function setOps(a,b){let shared=0;for(const id of a.keys())if(b.has(id))shared++;return{shared,aOnly:a.size-shared,bOnly:b.size-shared}}
function extStats(){return externals.map(x=>x.stats).filter(Boolean)}
function extWom(){return externals.map(x=>x.womProfile).filter(Boolean)}
function extClogs(){return externals.map(x=>x.clog).filter(Boolean)}
function ownRows(){return selectedPlayers().map(p=>({p,stats:ownWomProfile(p.key),clog:ownClogProfile(p.key)}))}
function groupMetrics(stats,clogs,totalMembers){
 const level=sumValues(stats.map(x=>x?.overall?.level)),xp=sumValues(stats.map(x=>x?.overall?.experience)),ehp=sumValues(stats.map(x=>x?.ehp)),ehb=sumValues(stats.map(x=>x?.ehb)),union=unionClogs(clogs);
 return{members:totalMembers,statsMembers:stats.length,clogMembers:clogs.length,level,xp,ehp,ehb,union}
}
function pill(text,cls='ok',title=''){return '<span class="nem-source '+cls+'" title="'+escapeHtml(title)+'"><i></i>'+escapeHtml(text)+'</span>'}
function renderExternalRoster(){
 let host=$('#nemesisExternalRoster');
 if(!host){
  host=document.createElement('div');host.id='nemesisExternalRoster';host.className='nem-external-roster';
  $('#nemesisSourceStatus')?.insertAdjacentElement('afterend',host)
 }
 if(!externals.length){host.innerHTML='';return}
 const rows=externals.map(x=>{
  const states=[sourceState(x.wom,'WOM'),sourceState(x.templeStats,'Temple stats'),sourceState(x.templeClog,'Temple CLog')];
  let history='';
  if(x.womProfile){
   const h=x.history||{};
   if(h.loading)history=pill('History loading','missing','WOM snapshot history is loading');
   else if(h.error)history=pill('History unavailable','error',h.error);
   else if(h.allLoaded)history=pill('History · all · '+externalSnapshots(x).length,'ok','All retrieved WOM snapshots');
   else if(h.yearLoaded)history=pill('History · 1Y · '+externalSnapshots(x).length,'ok','At least one year of WOM snapshot history loaded');
   else history=pill('History queued','missing','History loads automatically when a timeline or gain view needs it')
  }
  return '<div class="nem-external-member"><div class="nem-external-name"><strong>'+escapeHtml(x.displayName||x.name)+'</strong><small>'+escapeHtml(x.name)+'</small></div><div class="nem-external-sources">'+states.map(s=>pill(s.label,s.cls,s.detail||s.text)).join('')+history+'</div><button type="button" class="nem-remove" data-remove-external="'+escapeHtml(x.id)+'" aria-label="Remove '+escapeHtml(x.name)+'">Remove</button></div>'
 }).join('');
 host.innerHTML='<div class="nem-roster-head"><div><strong>External comparison group</strong><small>'+externals.length+' account'+(externals.length===1?'':'s')+' added</small></div><button type="button" class="nem-clear" id="nemesisClear">Clear group</button></div>'+rows;
 host.querySelectorAll('[data-remove-external]').forEach(b=>b.addEventListener('click',()=>{externals=externals.filter(x=>x.id!==b.dataset.removeExternal);render()}));
 $('#nemesisClear')?.addEventListener('click',()=>{externals=[];render()})
}
function renderCoverage(){
 const h=$('#nemesisSourceStatus');if(!h)return;
 if(!externals.length){h.innerHTML='';return}
 const wom=externals.filter(x=>x.womProfile).length,ts=externals.filter(x=>x.templeStatsProfile).length,tc=externals.filter(x=>x.clog).length,total=externals.length;
 h.innerHTML=pill('WOM '+wom+'/'+total,wom===total?'ok':'missing')+pill('Temple stats '+ts+'/'+total,ts===total?'ok':'missing')+pill('Temple CLog '+tc+'/'+total,tc===total?'ok':'missing')
}
function sourceLabel(x){return[x.womProfile?'WOM':null,(x.templeStatsProfile||x.clog)?'Temple':null].filter(Boolean).join(' + ')||'—'}
function summaryRow(name,stats,clog,source,enemy=false){
 return '<tr class="'+(enemy?'nemesis-row':'')+'"><th>'+escapeHtml(name)+'</th><td>'+escapeHtml(source||'—')+'</td><td>'+fi(stats?.overall?.level)+'</td><td>'+ci(stats?.overall?.experience)+'</td><td>'+f1(stats?.ehp)+'</td><td>'+f1(stats?.ehb)+'</td><td>'+(clog?fmt(clog.total):'—')+'</td></tr>'
}
function renderSummary(){
 const h=$('#nemesisSummary');if(!h)return;
 const ours=ownRows(),em=groupMetrics(extStats(),extClogs(),externals.length),om=groupMetrics(ours.map(x=>x.stats).filter(Boolean),ours.map(x=>x.clog).filter(Boolean),ours.length);
 const groupRows='<tr class="nemesis-row nem-group-row"><th>External group</th><td>'+em.members+' members · stats '+em.statsMembers+'/'+em.members+' · CLog '+em.clogMembers+'/'+em.members+'</td><td>'+fi(em.level.value)+'</td><td>'+ci(em.xp.value)+'</td><td>'+f1(em.ehp.value)+'</td><td>'+f1(em.ehb.value)+'</td><td>'+(em.clogMembers?fmt(em.union.size):'—')+'</td></tr>'+
 '<tr class="nem-group-row"><th>United Gimps selection</th><td>'+om.members+' members · stats '+om.statsMembers+'/'+om.members+' · CLog '+om.clogMembers+'/'+om.members+'</td><td>'+fi(om.level.value)+'</td><td>'+ci(om.xp.value)+'</td><td>'+f1(om.ehp.value)+'</td><td>'+f1(om.ehb.value)+'</td><td>'+(om.clogMembers?fmt(om.union.size):'—')+'</td></tr>';
 const members=externals.map(x=>summaryRow(x.displayName||x.name,x.stats,x.clog,sourceLabel(x),true)).join('')+ours.map(x=>summaryRow(x.p.name,x.stats,x.clog,[x.stats?'WOM':null,x.clog?'Temple':null].filter(Boolean).join(' + '))).join('');
 h.innerHTML='<div class="table-scroll"><table class="nem-table"><thead><tr><th>Group / player</th><th>Coverage / source</th><th>Total level</th><th>Total XP</th><th>EHP</th><th>EHB</th><th>Collection Log</th></tr></thead><tbody>'+groupRows+'<tr class="nem-table-divider"><td colspan="7">Individual members</td></tr>'+members+'</tbody></table></div>'
}
function renderSkills(){
 const h=$('#nemesisSkills');if(!h)return;const es=extStats(),os=ownRows().map(x=>x.stats).filter(Boolean);
 if(!es.length){h.innerHTML='<div class="notice">None of the external accounts returned WOM or Temple skill data.</div>';return}
 const rows=SKILLS.map(k=>{
  const ea=sumValues(es.map(x=>x.skills?.[k]?.level)),oa=sumValues(os.map(x=>x.skills?.[k]?.level));
  const eavg=ea.count?ea.value/ea.count:null,oavg=oa.count?oa.value/oa.count:null,diff=ea.value!=null&&oa.value!=null?ea.value-oa.value:null;
  return '<tr><th><button class="metric-link nem-metric-link" data-nem-skill="'+escapeHtml(k)+'">'+U.skillIcon(k,{alt:''})+'<span>'+escapeHtml(nice(k))+'</span></button></th><td>'+fi(ea.value)+' <small>'+ea.count+'/'+externals.length+'</small></td><td>'+fi(oa.value)+' <small>'+oa.count+'/'+selectedPlayers().length+'</small></td><td class="'+(diff==null?'':diff>=0?'pos':'neg')+'">'+signed(diff)+'</td><td>'+f1(eavg)+'</td><td>'+f1(oavg)+'</td></tr>'
 }).join('');
 h.innerHTML='<div class="nem-coverage-note">Totals are additive across each side. Averages are shown as a member-count sanity check when the two groups have different sizes.</div><div class="table-scroll"><table class="nem-table nem-skills"><thead><tr><th>Skill</th><th>External group total</th><th>United Gimps total</th><th>Difference</th><th>External avg</th><th>United avg</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
}
function renderBosses(){
 const h=$('#nemesisBosses');if(!h)return;const es=extWom(),os=ownRows().map(x=>x.stats).filter(Boolean);
 if(!es.length){h.innerHTML='<div class="notice">No external member has WOM data, so boss KC cannot be compared yet. Temple-only stats and Collection Log comparisons still work.</div>';return}
 const keys=new Set();for(const x of es)Object.keys(x.bosses||{}).forEach(k=>keys.add(k));for(const x of os)Object.keys(x.bosses||{}).forEach(k=>keys.add(k));
 const rows=[...keys].map(k=>{
  const ea=sumValues(es.map(x=>n(x.bosses?.[k])??0)),oa=sumValues(os.map(x=>n(x.bosses?.[k])??0)),diff=(ea.value??0)-(oa.value??0);
  return{k,ev:ea.value??0,ov:oa.value??0,diff,max:Math.max(ea.value??0,oa.value??0)}
 }).filter(x=>x.max>0).sort((a,b)=>b.max-a.max).slice(0,40);
 h.innerHTML=rows.length?'<div class="nem-coverage-note">Boss KC is summed across '+es.length+'/'+externals.length+' external WOM accounts and '+os.length+'/'+selectedPlayers().length+' selected United Gimps accounts.</div><div class="table-scroll"><table class="nem-table"><thead><tr><th>Boss</th><th>External group KC</th><th>United Gimps KC</th><th>Difference</th></tr></thead><tbody>'+rows.map(x=>'<tr><th><button class="metric-link nem-metric-link" data-nem-boss="'+escapeHtml(x.k)+'">'+escapeHtml(nice(x.k))+'</button></th><td>'+fmt(x.ev)+'</td><td>'+fmt(x.ov)+'</td><td class="'+(x.diff>=0?'pos':'neg')+'">'+signed(x.diff)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="notice">No comparable boss KC was found.</div>'
}

function selectorKeys(){
 const own=selectedPlayers().map(p=>U.snapData(ownWom,p.key)||{}),ext=externals.map(externalLatestData).filter(Boolean);
 const bosses=[...new Set([...own,...ext].flatMap(d=>Object.keys(d?.bosses||{})).filter(k=>[...own,...ext].some(d=>Math.max(0,+d?.bosses?.[k]?.kills||0)>0)))].sort((a,b)=>nice(a).localeCompare(nice(b)));
 const activities=[...new Set([...own,...ext].flatMap(d=>Object.keys(d?.activities||{})).filter(k=>[...own,...ext].some(d=>Math.max(0,+d?.activities?.[k]?.score||0)>0)))].sort((a,b)=>nice(a).localeCompare(nice(b)));
 return{bosses,activities}
}
function populateProgressSelectors(){
 const metric=$('#nemesisMetric'),skill=$('#nemesisSkill'),boss=$('#nemesisBoss'),activity=$('#nemesisActivity'),timeGo=$('#nemesisTimeGo'),timeDate=$('#nemesisTimeDate');
 if(!metric||!skill||!boss||!activity)return;
 metric.value=compareMetric;
 skill.innerHTML=SKILLS.map(k=>'<option value="'+escapeHtml(k)+'">'+escapeHtml(nice(k))+'</option>').join('');
 if(!SKILLS.includes(compareSkill))compareSkill='slayer';skill.value=compareSkill;
 const keys=selectorKeys();
 boss.innerHTML=keys.bosses.length?keys.bosses.map(k=>'<option value="'+escapeHtml(k)+'">'+escapeHtml(nice(k))+'</option>').join(''):'<option value="">No boss data</option>';
 if(!keys.bosses.includes(compareBoss))compareBoss=keys.bosses[0]||'';boss.value=compareBoss;
 activity.innerHTML=keys.activities.length?keys.activities.map(k=>'<option value="'+escapeHtml(k)+'">'+escapeHtml(nice(k))+'</option>').join(''):'<option value="">No activity data</option>';
 if(!keys.activities.includes(compareActivity))compareActivity=keys.activities[0]||'';activity.value=compareActivity;
 $('#nemesisSkillWrap').hidden=compareMetric!=='skill';
 $('#nemesisBossWrap').hidden=compareMetric!=='boss';
 $('#nemesisActivityWrap').hidden=compareMetric!=='activity';
 document.querySelectorAll('[data-nem-mode]').forEach(b=>b.classList.toggle('active',b.dataset.nemMode===compareMode));
 document.querySelectorAll('[data-nem-view]').forEach(b=>b.classList.toggle('active',b.dataset.nemView===compareView));
 document.querySelectorAll('[data-nem-scope]').forEach(b=>b.classList.toggle('active',b.dataset.nemScope===compareScope));
 document.querySelectorAll('[data-nem-period]').forEach(b=>b.classList.toggle('active',b.dataset.nemPeriod===String(comparePeriod)));
}
function comparisonCoverage(spec){
 const extWom=externals.filter(x=>x.womProfile),own=selectedPlayers();
 const extSeries=extWom.filter(x=>metricSeries(externalSnapshots(x),spec).length>=2).length;
 const ownSeries=own.filter(p=>metricSeries(ownSnapshots(p),spec).length>=2).length;
 return{extWom:extWom.length,extSeries,ownWom:own.length,ownSeries}
}
function renderShareChart(host,spec){
 host.innerHTML='<div class="nem-share-grid"><section><h4>External group</h4><div data-nem-share-external></div></section><section><h4>United Gimps</h4><div data-nem-share-united></div></section></div>';
 const extEntries=externals.map(x=>({name:x.displayName||x.name,color:x.color,value:externalMemberValue(x,spec)}));
 const ownEntries=selectedPlayers().map(p=>({name:p.name,color:p.color,value:ownMemberValue(p,spec)}));
 C.drawPie(host.querySelector('[data-nem-share-external]'),extEntries,{format:spec.format,note:(compareMode==='gain'?'Gain':'Current')+' share within the external group.'});
 C.drawPie(host.querySelector('[data-nem-share-united]'),ownEntries,{format:spec.format,note:(compareMode==='gain'?'Gain':'Current')+' share within the selected United Gimps accounts.'})
}
function renderProgressComparison(){
 const host=$('#nemesisCompareChart'),status=$('#nemesisProgressStatus');if(!host||!status)return;
 populateProgressSelectors();
 if(!externals.length){host.innerHTML='';status.textContent='Add external accounts to compare progress.';return}
 const spec=metricSpec(),needsHistory=compareMode==='gain'||compareView==='timeline'||(compareView==='share'&&compareMode==='gain');
 if(needsHistory&&!historyPromise){
  const need=externals.some(x=>x.womProfile&&(comparePeriod==='all'?!x.history?.allLoaded:!(x.history?.yearLoaded||x.history?.allLoaded))&&!x.history?.loading);
  if(need){historyPromise=ensureExternalHistory().finally(()=>{historyPromise=null;renderProgressComparison()})}
 }
 const cov=comparisonCoverage(spec),loading=externals.filter(x=>x.history?.loading).length,errors=externals.filter(x=>x.history?.error).length;
 const extMetric=externals.filter(x=>externalMemberValue(x,spec)!=null).length,ownMetric=selectedPlayers().filter(p=>ownMemberValue(p,spec)!=null).length;
 const range=periodLabel(comparePeriod),modeLabel=compareMode==='gain'?'gains':'current totals';
 status.textContent=range+' · '+modeLabel+' · metric coverage '+extMetric+'/'+externals.length+' external vs '+ownMetric+'/'+selectedPlayers().length+' United · timeline '+cov.extSeries+'/'+cov.extWom+' external WOM vs '+cov.ownSeries+'/'+cov.ownWom+' United WOM'+(loading?' · loading '+loading+' external histor'+(loading===1?'y':'ies'):'')+(errors?' · '+errors+' external history request'+(errors===1?' failed':'s failed'):'');
 const groupBars=groupBarEntries(spec),memberBars=memberBarEntries(spec);
 if(compareView==='bars'){
  const bars=compareScope==='members'?memberBars:groupBars;
  C.drawBars(host,bars,{format:spec.format,note:(compareMode==='gain'?'Gain over '+range:'Current')+' '+(compareScope==='members'?'member-by-member':'group-vs-group')+' '+spec.label+' comparison.'});return
 }
 if(compareView==='share'){renderShareChart(host,spec);return}
 if(compareScope==='members'){
  const lines=memberLineSeries(spec),usable=lines.filter(x=>x.data.length>=2);
  if(!usable.length){
   C.drawBars(host,memberBars,{format:spec.format,note:'Member bars shown because no individual account has two usable WOM timeline points for '+range+'.'});return
  }
  C.drawLine(host,lines,{format:spec.format,gainMode:compareMode==='gain',bars:memberBars,domain:comparisonWindow()});return
 }
 const ext=externalGroupSeries(spec),uni=unitedGroupSeries(spec);
 if(ext.length<2&&uni.length<2){
  C.drawBars(host,groupBars,{format:spec.format,note:'Bar comparison shown because neither side has two usable WOM timeline points for '+range+'.'});
  return
 }
 C.drawLine(host,[
  {name:'External group',color:GROUP_COLORS.external,data:ext},
  {name:'United Gimps',color:GROUP_COLORS.united,data:uni}
 ],{format:spec.format,gainMode:compareMode==='gain',bars:groupBars,domain:comparisonWindow()})
}
async function runNemesisTimeMachine(){
 const input=$('#nemesisTimeDate'),status=$('#nemesisTimeStatus'),button=$('#nemesisTimeGo');
 const raw=input?.value;if(!raw)return;
 const target=+new Date(raw+'T12:00:00');if(!Number.isFinite(target))return;
 compareAtDate=target;
 if(button){button.disabled=true;button.textContent='Loading history…'}
 if(status)status.textContent='Loading external WOM history where available…';
 try{
  for(const x of externals.filter(x=>x.womProfile))await loadExternalHistory(x,true);
 }finally{
  if(button){button.disabled=false;button.textContent='Compare date'}
  renderTimeMachineComparison()
 }
}
function renderTimeMachineComparison(){
 const host=$('#nemesisTimeChart'),table=$('#nemesisTimeTable'),status=$('#nemesisTimeStatus');
 if(!host||!table||!status)return;
 if(!compareAtDate){host.innerHTML='';table.innerHTML='';status.textContent='Choose a date to compare the closest real WOM snapshots. No interpolation is used.';return}
 const spec=metricSpec(),target=compareAtDate;
 const ext=externals.map(x=>({name:x.displayName||x.name,color:x.color,side:'External',near:nearestSnapshot(externalSnapshots(x),target)}));
 const own=selectedPlayers().map(p=>({name:p.name,color:p.color,side:'United',near:nearestSnapshot(ownSnapshots(p),target)}));
 const rows=[...ext,...own].map(x=>({...x,value:historicalValue(x.near?.snap,spec)}));
 const extVals=rows.filter(x=>x.side==='External').map(x=>x.value),ownVals=rows.filter(x=>x.side==='United').map(x=>x.value);
 const ev=sumValues(extVals).value,uv=sumValues(ownVals).value;
 C.drawBars(host,[
  {name:'External group',color:GROUP_COLORS.external,value:ev},
  {name:'United Gimps',color:GROUP_COLORS.united,value:uv}
 ],{format:spec.format,note:spec.label+' at the closest saved WOM snapshots to '+dateLabel(target)+'.'});
 const usable=rows.filter(x=>x.value!=null).length;
 status.textContent=dateLabel(target)+' · '+spec.label+' · '+usable+'/'+rows.length+' members have a usable historical value · closest real snapshot per account, never interpolated.';
 table.innerHTML='<div class="table-scroll"><table class="nem-table"><thead><tr><th>Member</th><th>Side</th><th>'+escapeHtml(spec.label)+'</th><th>Snapshot</th><th>Distance</th></tr></thead><tbody>'+
 rows.map(x=>'<tr><th style="color:'+escapeHtml(x.color)+'">'+escapeHtml(x.name)+'</th><td>'+x.side+'</td><td>'+(x.value==null?'—':spec.format==='compact'?compact(x.value):spec.format==='hours'?f1(x.value):fmt(x.value))+'</td><td>'+(x.near?.snap?.createdAt?escapeHtml(new Date(x.near.snap.createdAt).toLocaleString('en-GB')):'—')+'</td><td>'+escapeHtml(timeQuality(x.near?.diffDays))+'</td></tr>').join('')+
 '</tbody></table></div>'
}
function bindProgressControls(){
 const metric=$('#nemesisMetric'),skill=$('#nemesisSkill'),boss=$('#nemesisBoss'),activity=$('#nemesisActivity');
 if(metric&&!metric.dataset.bound){metric.dataset.bound='1';metric.onchange=()=>{compareMetric=metric.value;populateProgressSelectors();renderProgressComparison();renderTimeMachineComparison()}}
 if(skill&&!skill.dataset.bound){skill.dataset.bound='1';skill.onchange=()=>{compareSkill=skill.value;renderProgressComparison();renderTimeMachineComparison()}}
 if(boss&&!boss.dataset.bound){boss.dataset.bound='1';boss.onchange=()=>{compareBoss=boss.value;renderProgressComparison();renderTimeMachineComparison()}}
 if(activity&&!activity.dataset.bound){activity.dataset.bound='1';activity.onchange=()=>{compareActivity=activity.value;renderProgressComparison();renderTimeMachineComparison()}}
 if(timeGo&&!timeGo.dataset.bound){timeGo.dataset.bound='1';timeGo.onclick=runNemesisTimeMachine}
 document.querySelectorAll('[data-nem-time-preset]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.onclick=()=>{const d=new Date();if(b.dataset.nemTimePreset==='1y')d.setFullYear(d.getFullYear()-1);else if(b.dataset.nemTimePreset==='6m')d.setMonth(d.getMonth()-6);else d.setTime(+new Date(b.dataset.nemTimePreset+'T12:00:00'));if(timeDate)timeDate.value=d.toISOString().slice(0,10);runNemesisTimeMachine()}})
 document.querySelectorAll('[data-nem-mode]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.onclick=()=>{compareMode=b.dataset.nemMode;renderProgressComparison()}});
 document.querySelectorAll('[data-nem-view]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.onclick=()=>{compareView=b.dataset.nemView;renderProgressComparison()}});
 document.querySelectorAll('[data-nem-scope]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.onclick=()=>{compareScope=b.dataset.nemScope;renderProgressComparison()}});
 document.querySelectorAll('[data-nem-period]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.onclick=()=>{comparePeriod=b.dataset.nemPeriod==='all'?'all':+b.dataset.nemPeriod;renderProgressComparison()}});
 document.addEventListener('click',e=>{
  const sk=e.target.closest?.('[data-nem-skill]');if(sk){compareMetric='skill';compareSkill=sk.dataset.nemSkill;renderProgressComparison();$('#nemesisProgress')?.scrollIntoView?.({behavior:'smooth',block:'start'});return}
  const bk=e.target.closest?.('[data-nem-boss]');if(bk){compareMetric='boss';compareBoss=bk.dataset.nemBoss;renderProgressComparison();$('#nemesisProgress')?.scrollIntoView?.({behavior:'smooth',block:'start'})}
 })
}
function renderClog(){
 const h=$('#nemesisClog');if(!h)return;
 const ec=extClogs(),ours=ownRows().filter(x=>x.clog),eu=unionClogs(ec),ou=unionClogs(ours.map(x=>x.clog));
 if(!ec.length){h.innerHTML='<div class="notice">None of the external accounts has a Temple Collection Log sync. WOM and Temple-stat comparisons above remain usable.</div>';return}
 const q=setOps(eu,ou),denom=new Set([...eu.keys(),...ou.keys()]).size,pct=denom?100*q.shared/denom:0;
 const top='<div class="nem-clog-kpis"><div><span>External group union</span><b>'+fmt(eu.size)+'</b></div><div><span>United Gimps union</span><b>'+fmt(ou.size)+'</b></div><div><span>Shared</span><b>'+fmt(q.shared)+'</b></div><div><span>External-only</span><b>'+fmt(q.aOnly)+'</b></div><div><span>United-only</span><b>'+fmt(q.bOnly)+'</b></div><div><span>Overlap</span><b>'+f1(pct)+'%</b></div></div>';
 const coverage='<div class="nem-coverage-note">Temple Collection Log coverage: '+ec.length+'/'+externals.length+' external accounts and '+ours.length+'/'+selectedPlayers().length+' selected United Gimps accounts. Group totals are unique-item unions, not the sum of each member\'s log.</div>';
 const rows=externals.map(x=>{
  if(!x.clog)return '<tr><th>'+escapeHtml(x.displayName||x.name)+'</th><td colspan="5">No Temple Collection Log sync</td></tr>';
  const m=setOps(x.clog.items,ou),d=new Set([...x.clog.items.keys(),...ou.keys()]).size;
  return '<tr><th>'+escapeHtml(x.displayName||x.name)+'</th><td>'+fmt(x.clog.total)+'</td><td>'+fmt(m.shared)+'</td><td>'+fmt(m.aOnly)+'</td><td>'+fmt(m.bOnly)+'</td><td>'+f1(d?100*m.shared/d:0)+'%</td></tr>'
 }).join('');
 h.innerHTML=top+coverage+'<div class="nem-clog-visual"><div data-nem-clog-pie></div></div><div class="table-scroll"><table class="nem-table"><thead><tr><th>External member</th><th>Their slots</th><th>Shared with United union</th><th>External-only</th><th>United-only</th><th>Overlap</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 C.drawPie(h.querySelector('[data-nem-clog-pie]'),[
  {name:'Shared',color:'#d5b65b',value:q.shared},
  {name:'External-only',color:GROUP_COLORS.external,value:q.aOnly},
  {name:'United-only',color:GROUP_COLORS.united,value:q.bOnly}
 ],{format:'integer',note:'Unique Collection Log slot composition across both group unions.'})
}
function render(){
 renderExternalRoster();renderCoverage();
 const empty=$('#nemesisEmpty'),results=$('#nemesisResults');
 if(!externals.length){if(empty){empty.hidden=false;empty.textContent='Add one or more external accounts above to start a group comparison.'}if(results)results.hidden=true;return}
 const any=externals.some(x=>x.womProfile||x.templeStatsProfile||x.clog);
 if(!any){
  if(empty){empty.hidden=false;empty.innerHTML='None of the '+externals.length+' external account'+(externals.length===1?' is':'s are')+' currently returning usable WOM or Temple data. The accounts stay listed above so you can see which sources failed or are unsynced.'}
  if(results)results.hidden=true;return
 }
 if(empty)empty.hidden=true;if(results)results.hidden=false;
 $('#nemesisResultTitle').textContent='External group ('+externals.length+') vs United Gimps ('+selectedPlayers().length+')';
 renderSummary();renderProgressComparison();renderTimeMachineComparison();renderSkills();renderBosses();renderClog()
}
function bindPicker(){
 const host=$('#nemesisMemberPicker');if(!host)return;
 U.renderMemberPicker(host,selection,next=>{selection=U.saveMemberSelection(next);render()},{title:'United Gimps in comparison',subtitle:'Choose any additive combination. The external side is built separately by adding RSNs.'})
}
async function addAccount(){
 const input=$('#nemesisName'),button=$('#nemesisGo'),name=cleanName(input?.value),id=keyName(name);
 if(!name){$('#nemesisLookupNote').textContent='Enter an OSRS username first.';input?.focus();return}
 if(externals.some(x=>x.id===id)){const existing=externals.find(x=>x.id===id);$('#nemesisLookupNote').textContent=(existing?.displayName||name)+' is already in the external group.';input?.select();return}
 if(externals.length>=MAX_EXTERNAL){$('#nemesisLookupNote').textContent='The beta currently supports up to '+MAX_EXTERNAL+' external accounts in one comparison.';return}
 button.disabled=true;button.textContent='Checking…';$('#nemesisLookupNote').textContent='Checking '+name+' on WOM and Temple independently…';
 try{
  const row=await lookup(name);externals.push(row);input.value='';
  const hasAny=row.womProfile||row.templeStatsProfile||row.clog;
  $('#nemesisLookupNote').textContent=hasAny?(row.displayName||name)+' added. Add another RSN to build the opposing GIM group.':name+' added, but no usable WOM or Temple sync was found. It remains listed so the missing coverage is explicit.';
  render();input.focus()
 }catch(e){$('#nemesisLookupNote').textContent='Lookup failed: '+String(e?.message||e)}
 finally{button.disabled=false;button.textContent='Add account'}
}
async function init(){
 try{[ownWom,ownClog]=await Promise.all([U.loadWom(),U.loadClog()])}catch(e){console.warn('Nemesis baseline load',e)}
 const form=$('#nemesisLookupForm'),button=$('#nemesisGo');
 if(button)button.textContent='Add account';
 const heading=$('.nemesis-panel h2');if(heading)heading.textContent='Build the external comparison group';
 const intro=$('.nemesis-panel p');if(intro)intro.textContent='Add one or more OSRS usernames. Each account is checked independently on WOM and Temple, then the available members are combined into an external GIM-style group.';
 const note=$('#nemesisLookupNote');if(note)note.textContent='Add accounts one at a time. Unsynced WOM or Temple data stays visible as missing coverage instead of being guessed.';
 const input=$('#nemesisName');if(input)input.placeholder='Add RSN…';
 bindPicker();bindProgressControls();populateProgressSelectors();
 form?.addEventListener('submit',e=>{e.preventDefault();addAccount()});
 window.addEventListener('ug:members-changed',()=>{selection=U.loadMemberSelection();bindPicker();render()});
 window.addEventListener('ug:data-updated',async e=>{
  if(e.detail?.key===U.WKEY){ownWom=await U.loadWom();render()}
  else if(e.detail?.key===U.TKEY){ownClog=await U.loadClog();render()}
 });
 render()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();