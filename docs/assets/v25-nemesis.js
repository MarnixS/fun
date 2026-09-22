(()=>{
'use strict';
const U=window.UGV21;if(!U)return;
const {$,$$,PLAYERS,fmt,compact,nice,escapeHtml}=U;
const SKILLS=['attack','strength','defence','hitpoints','ranged','prayer','magic','cooking','woodcutting','fletching','fishing','firemaking','crafting','smithing','mining','herblore','agility','thieving','slayer','farming','runecrafting','hunter','construction','sailing'];
let external=null,ownWom=null,ownClog=null,selection=U.loadMemberSelection();

function cleanName(v){return String(v||'').replace(/\s+/g,' ').trim().slice(0,12)}
function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
function millis(v){const x=+new Date(v);return Number.isFinite(x)?x:0}
function apiError(j){return !j||typeof j!=='object'||j.error||j.errors||j.success===false}
async function fetchJson(url,ms=15000){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);
 try{
  const r=await fetch(url,{cache:'no-store',credentials:'omit',headers:{Accept:'application/json'},signal:c.signal});
  let j=null;try{j=await r.json()}catch{}
  if(r.status===404)return{kind:'missing',status:404,data:null};
  if(!r.ok)return{kind:'error',status:r.status,error:j?.error||j?.message||('HTTP '+r.status),data:null};
  if(apiError(j))return{kind:'missing',status:r.status,error:j?.error||j?.message||null,data:null};
  return{kind:'ok',status:r.status,data:j};
 }catch(e){return{kind:'error',status:0,error:e?.name==='AbortError'?'request timed out':String(e?.message||e),data:null}}
 finally{clearTimeout(timer)}
}
function womSnapshot(raw){return raw?.latestSnapshot?.data||raw?.latest_snapshot?.data||raw?.data?.latestSnapshot?.data||null}
function womProfile(raw){
 const d=womSnapshot(raw);if(!d?.skills)return null;
 const skills={};for(const k of SKILLS){const x=d.skills?.[k]||{};skills[k]={level:n(x.level),experience:n(x.experience),rank:n(x.rank)}}
 const o=d.skills?.overall||{},bosses={};
 for(const [k,v] of Object.entries(d.bosses||{})){const kills=n(v?.kills??v?.killCount??v);if(kills!=null)bosses[k]=kills}
 return{
  source:'WOM',displayName:raw?.displayName||raw?.username||raw?.player?.displayName||raw?.player?.username||'Nemesis',
  type:raw?.type||raw?.player?.type||null,updatedAt:raw?.updatedAt||raw?.latestSnapshot?.createdAt||raw?.latest_snapshot?.createdAt||null,
  overall:{level:n(o.level),experience:n(o.experience),rank:n(o.rank)},ehp:n(d.computed?.ehp?.value??d.computed?.ehp),ehb:n(d.computed?.ehb?.value??d.computed?.ehb),
  skills,bosses
 }
}
function templeData(raw){return raw?.data&&typeof raw.data==='object'?raw.data:raw}
function ciMap(obj){const m=new Map();for(const [k,v] of Object.entries(obj||{}))m.set(String(k).toLowerCase(),v);return m}
function getCi(m,...keys){for(const k of keys){const v=m.get(String(k).toLowerCase());if(v!==undefined)return v}return undefined}
function templeStatsProfile(raw,name){
 const d=templeData(raw);if(!d||typeof d!=='object')return null;const m=ciMap(d),skills={};
 let levelSum=0,xpSum=0,known=0;
 for(const k of SKILLS){
  const label=k==='runecrafting'?'runecraft':k;
  const level=n(getCi(m,label+'_level',k+'_level')),experience=n(getCi(m,label,k));
  skills[k]={level,experience,rank:n(getCi(m,label+'_rank',k+'_rank'))};
  if(level!=null){levelSum+=level;known++}if(experience!=null)xpSum+=experience;
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
  if(Array.isArray(x)){for(const v of x)walk(v);return}
  if(typeof x!=='object')return;
  if(seen.has(x))return;seen.add(x);
  const id=n(x.id??x.item_id??x.itemId),count=n(x.count??x.quantity??x.amount??(x.obtained?1:null));
  if(id!=null&&id>0&&(count==null||count>0)){ids.set(id,{id,count:count??1,name:x.name||x.item_name||x.itemName||null});return}
  for(const [k,v] of Object.entries(x)){
   if(/^\d+$/.test(k)){
    const kid=+k,kv=n(v);
    if(kid>0&&kv!=null&&kv>0){ids.set(kid,{id:kid,count:kv,name:null});continue}
   }
   walk(v)
  }
 }
 walk(d?.items??d);
 return ids
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
 if(r.kind==='ok')return{ok:true,label,text:label+' available',cls:'ok'};
 if(r.kind==='missing')return{ok:false,label,text:label+' not synced / not found',cls:'missing'};
 return{ok:false,label,text:label+' request failed',cls:'error',detail:r.error||''}
}
async function lookup(name){
 const enc=encodeURIComponent(name);
 const urls={
  wom:'https://api.wiseoldman.net/v2/players/'+enc,
  templeStats:'https://templeosrs.com/api/player_stats.php?player='+enc+'&bosses=1',
  templeClog:'https://templeosrs.com/api/collection-log/player_collection_log.php?player='+enc+'&categories=all&includenames=1&dateformat=unix'
 };
 const [wom,ts,tc]=await Promise.all([fetchJson(urls.wom),fetchJson(urls.templeStats),fetchJson(urls.templeClog,20000)]);
 const wp=wom.kind==='ok'?womProfile(wom.data):null, tsp=ts.kind==='ok'?templeStatsProfile(ts.data,name):null, tcp=tc.kind==='ok'?clogProfile(tc.data):null;
 if(wom.kind==='ok'&&!wp)wom.kind='missing';
 if(ts.kind==='ok'&&!tsp)ts.kind='missing';
 if(tc.kind==='ok'&&!tcp)tc.kind='missing';
 return{name,wom,templeStats:ts,templeClog:tc,womProfile:wp,templeStatsProfile:tsp,clog:tcp,stats:wp||tsp}
}
function statusHtml(){
 const states=[sourceState(external.wom,'WOM'),sourceState(external.templeStats,'Temple stats'),sourceState(external.templeClog,'Temple Collection Log')];
 return states.map(s=>'<span class="nem-source '+s.cls+'" title="'+escapeHtml(s.detail||'')+'"><i></i>'+escapeHtml(s.text)+'</span>').join('')
}
function selectedPlayers(){return PLAYERS.filter(p=>selection.has(p.key))}
function f1(v){return Number.isFinite(+v)?(+v).toLocaleString('en-GB',{maximumFractionDigits:1}):'—'}
function signed(v){if(!Number.isFinite(+v))return'—';const x=Math.round(v);return(x>0?'+':'')+x.toLocaleString('en-GB')}
function summaryRow(name,stats,clog,source,enemy=false){
 return '<tr class="'+(enemy?'nemesis-row':'')+'"><th>'+escapeHtml(name)+'</th><td>'+escapeHtml(source||'—')+'</td><td>'+fmt(stats?.overall?.level)+'</td><td>'+compact(stats?.overall?.experience)+'</td><td>'+f1(stats?.ehp)+'</td><td>'+f1(stats?.ehb)+'</td><td>'+(clog?fmt(clog.total):'—')+'</td></tr>'
}
function renderSummary(){
 const h=$('#nemesisSummary');if(!h)return;const rows=[];
 rows.push(summaryRow(external.stats?.displayName||external.name,external.stats,external.clog,[external.womProfile?'WOM':null,(external.templeStatsProfile||external.clog)?'Temple':null].filter(Boolean).join(' + '),true));
 for(const p of selectedPlayers()){const w=ownWomProfile(p.key),c=ownClogProfile(p.key);rows.push(summaryRow(p.name,w,c,[w?'WOM':null,c?'Temple':null].filter(Boolean).join(' + ')))}
 h.innerHTML='<div class="table-scroll"><table class="nem-table"><thead><tr><th>Player</th><th>Source</th><th>Total level</th><th>Total XP</th><th>EHP</th><th>EHB</th><th>Collection Log</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'
}
function renderSkills(){
 const h=$('#nemesisSkills');if(!h)return;const ext=external.stats;if(!ext?.skills){h.innerHTML='<div class="notice">No WOM or Temple skill data is available for this account.</div>';return}
 const ours=selectedPlayers().map(p=>({p,s:ownWomProfile(p.key)})).filter(x=>x.s);
 const rows=SKILLS.map(k=>{
  const ev=n(ext.skills?.[k]?.level),vals=ours.map(x=>({name:x.p.name,v:n(x.s.skills?.[k]?.level)})).filter(x=>x.v!=null),avg=vals.length?vals.reduce((a,b)=>a+b.v,0)/vals.length:null,best=vals.sort((a,b)=>b.v-a.v)[0];
  return '<tr><th>'+U.skillIcon(k,{alt:''})+'<span>'+escapeHtml(nice(k))+'</span></th><td>'+fmt(ev)+'</td><td>'+f1(avg)+'</td><td>'+(best?escapeHtml(best.name)+' · '+fmt(best.v):'—')+'</td><td class="'+(ev!=null&&avg!=null?(ev-avg>=0?'pos':'neg'):'')+'">'+(ev!=null&&avg!=null?signed(ev-avg):'—')+'</td></tr>'
 }).join('');
 h.innerHTML='<div class="table-scroll"><table class="nem-table nem-skills"><thead><tr><th>Skill</th><th>Nemesis</th><th>Selected avg</th><th>Best selected</th><th>vs avg</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
}
function renderBosses(){
 const h=$('#nemesisBosses');if(!h)return;const ext=external.womProfile;
 if(!ext){h.innerHTML='<div class="notice">Boss KC comparison needs WOM data. Temple-only comparisons still work for stats and Collection Log.</div>';return}
 const ours=selectedPlayers().map(p=>({p,s:ownWomProfile(p.key)})).filter(x=>x.s),keys=new Set(Object.keys(ext.bosses||{}));
 for(const x of ours)Object.keys(x.s.bosses||{}).forEach(k=>keys.add(k));
 const rows=[...keys].map(k=>{
   const ev=n(ext.bosses?.[k])??0,vals=ours.map(x=>({name:x.p.name,v:n(x.s.bosses?.[k])??0})),avg=vals.length?vals.reduce((a,b)=>a+b.v,0)/vals.length:0,best=[...vals].sort((a,b)=>b.v-a.v)[0];
   return{k,ev,avg,best,max:Math.max(ev,best?.v||0)}
 }).filter(x=>x.max>0).sort((a,b)=>b.max-a.max).slice(0,30);
 h.innerHTML=rows.length?'<div class="table-scroll"><table class="nem-table"><thead><tr><th>Boss</th><th>Nemesis KC</th><th>Selected avg</th><th>Best selected</th><th>vs avg</th></tr></thead><tbody>'+rows.map(x=>'<tr><th>'+escapeHtml(nice(x.k))+'</th><td>'+fmt(x.ev)+'</td><td>'+f1(x.avg)+'</td><td>'+escapeHtml(x.best?.name||'—')+' · '+fmt(x.best?.v)+'</td><td class="'+(x.ev-x.avg>=0?'pos':'neg')+'">'+signed(x.ev-x.avg)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="notice">No comparable boss KC was found.</div>'
}
function setOps(a,b){let shared=0;for(const id of a.keys())if(b.has(id))shared++;return{shared,aOnly:a.size-shared,bOnly:b.size-shared}}
function renderClog(){
 const h=$('#nemesisClog');if(!h)return;const e=external.clog;
 if(!e){h.innerHTML='<div class="notice">This account has no Temple Collection Log sync available. WOM comparisons above remain usable.</div>';return}
 const ours=selectedPlayers().map(p=>({p,c:ownClogProfile(p.key)})).filter(x=>x.c);
 const union=new Map();for(const x of ours)for(const [id,v] of x.c.items)union.set(id,v);
 const u=setOps(e.items,union),pct=(shared,total)=>total?100*shared/total:0;
 let top='<div class="nem-clog-kpis"><div><span>Nemesis slots</span><b>'+fmt(e.total)+'</b></div><div><span>Selected union</span><b>'+fmt(union.size)+'</b></div><div><span>Shared with selection</span><b>'+fmt(u.shared)+'</b></div><div><span>Nemesis-only</span><b>'+fmt(u.aOnly)+'</b></div><div><span>Selected-only</span><b>'+fmt(u.bOnly)+'</b></div></div>';
 if(!ours.length){h.innerHTML=top+'<div class="notice">No selected United Gimps account currently has Collection Log data.</div>';return}
 const rows=ours.map(x=>{const q=setOps(e.items,x.c.items);return '<tr><th>'+escapeHtml(x.p.name)+'</th><td>'+fmt(x.c.total)+'</td><td>'+fmt(q.shared)+'</td><td>'+fmt(q.aOnly)+'</td><td>'+fmt(q.bOnly)+'</td><td>'+f1(pct(q.shared,new Set([...e.items.keys(),...x.c.items.keys()]).size))+'%</td></tr>'}).join('');
 h.innerHTML=top+'<div class="table-scroll"><table class="nem-table"><thead><tr><th>Compared with</th><th>Their slots</th><th>Shared</th><th>Nemesis-only</th><th>Member-only</th><th>Jaccard overlap</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
}
function render(){
 const status=$('#nemesisSourceStatus'),empty=$('#nemesisEmpty'),results=$('#nemesisResults');
 if(!external){if(status)status.innerHTML='';if(empty)empty.hidden=false;if(results)results.hidden=true;return}
 if(status)status.innerHTML=statusHtml();
 const any=!!(external.womProfile||external.templeStatsProfile||external.clog);
 if(!any){
  empty.hidden=false;results.hidden=true;
  empty.innerHTML='<strong>'+escapeHtml(external.name)+'</strong> is not synced on WOM or Temple, or neither source returned usable data. Nothing has been invented for the comparison.';
  return
 }
 empty.hidden=true;results.hidden=false;
 $('#nemesisResultTitle').textContent=(external.stats?.displayName||external.name)+' vs selected United Gimps';
 renderSummary();renderSkills();renderBosses();renderClog()
}
function bindPicker(){
 const host=$('#nemesisMemberPicker');if(!host)return;
 U.renderMemberPicker(host,selection,next=>{selection=U.saveMemberSelection(next);render()},{title:'United Gimps in comparison',subtitle:'Choose any additive combination. This selection stays shared with the rest of the site.'})
}
async function run(){
 const input=$('#nemesisName'),button=$('#nemesisGo'),name=cleanName(input?.value);
 if(!name){$('#nemesisLookupNote').textContent='Enter an OSRS username first.';input?.focus();return}
 button.disabled=true;button.textContent='Checking WOM + Temple…';$('#nemesisLookupNote').textContent='Querying WOM and Temple independently. An unsynced source will not block the other.';
 try{external=await lookup(name);$('#nemesisLookupNote').textContent='Lookup complete. Data is only shown where a source actually returned this account.';render()}
 catch(e){$('#nemesisLookupNote').textContent='Lookup failed: '+String(e?.message||e)}
 finally{button.disabled=false;button.textContent='Compare'}
}
async function init(){
 try{[ownWom,ownClog]=await Promise.all([U.loadWom(),U.loadClog()])}catch(e){console.warn('Nemesis baseline load',e)}
 bindPicker();
 $('#nemesisLookupForm')?.addEventListener('submit',e=>{e.preventDefault();run()});
 window.addEventListener('ug:members-changed',()=>{selection=U.loadMemberSelection();bindPicker();render()});
 render()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();