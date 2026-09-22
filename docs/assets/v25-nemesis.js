(()=>{
'use strict';
const U=window.UGV21;if(!U)return;
const {$,PLAYERS,fmt,compact,nice,escapeHtml}=U;
const SKILLS=['attack','strength','defence','hitpoints','ranged','prayer','magic','cooking','woodcutting','fletching','fishing','firemaking','crafting','smithing','mining','herblore','agility','thieving','slayer','farming','runecrafting','hunter','construction','sailing'];
const MAX_EXTERNAL=10;
let externals=[],ownWom=null,ownClog=null,selection=U.loadMemberSelection();

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
 const o=d.skills?.overall||{},bosses={};
 for(const [k,v] of Object.entries(d.bosses||{})){const kills=n(v?.kills??v?.killCount??v);if(kills!=null)bosses[k]=Math.max(0,kills)}
 return{
  source:'WOM',displayName:raw?.displayName||raw?.username||raw?.player?.displayName||raw?.player?.username||'Nemesis',
  type:raw?.type||raw?.player?.type||null,updatedAt:raw?.updatedAt||raw?.latestSnapshot?.createdAt||raw?.latest_snapshot?.createdAt||null,
  overall:{level:n(o.level),experience:n(o.experience),rank:n(o.rank)},ehp:n(d.computed?.ehp?.value??d.computed?.ehp),ehb:n(d.computed?.ehb?.value??d.computed?.ehb),
  skills,bosses
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
 return{id:keyName(name),name,displayName:wp?.displayName||tsp?.displayName||name,wom,templeStats:ts,templeClog:tc,womProfile:wp,templeStatsProfile:tsp,clog:tcp,stats:wp||tsp}
}
function selectedPlayers(){return PLAYERS.filter(p=>selection.has(p.key))}
function f1(v){return v!=null&&Number.isFinite(+v)?(+v).toLocaleString('en-GB',{maximumFractionDigits:1}):'—'}
function fi(v){return v!=null&&Number.isFinite(+v)?fmt(v):'—'}
function ci(v){return v!=null&&Number.isFinite(+v)?compact(v):'—'}
function signed(v,digits=0){
 if(v==null||!Number.isFinite(+v))return'—';const x=+v,opts=digits?{maximumFractionDigits:digits,minimumFractionDigits:digits}:{maximumFractionDigits:0};
 return(x>0?'+':'')+x.toLocaleString('en-GB',opts)
}
function sumValues(values){const a=values.filter(v=>Number.isFinite(+v)).map(Number);return{value:a.length?a.reduce((x,y)=>x+y,0):null,count:a.length}}
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
  return '<div class="nem-external-member"><div class="nem-external-name"><strong>'+escapeHtml(x.displayName||x.name)+'</strong><small>'+escapeHtml(x.name)+'</small></div><div class="nem-external-sources">'+states.map(s=>pill(s.label,s.cls,s.detail||s.text)).join('')+'</div><button type="button" class="nem-remove" data-remove-external="'+escapeHtml(x.id)+'" aria-label="Remove '+escapeHtml(x.name)+'">Remove</button></div>'
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
 return '<tr class="'+(enemy?'nemesis-row':'')+'"><th>'+escapeHtml(name)+'</th><td>'+escapeHtml(source||'—')+'</td><td>'+fmt(stats?.overall?.level)+'</td><td>'+compact(stats?.overall?.experience)+'</td><td>'+f1(stats?.ehp)+'</td><td>'+f1(stats?.ehb)+'</td><td>'+(clog?fmt(clog.total):'—')+'</td></tr>'
}
function renderSummary(){
 const h=$('#nemesisSummary');if(!h)return;
 const ours=ownRows(),em=groupMetrics(extStats(),extClogs(),externals.length),om=groupMetrics(ours.map(x=>x.stats).filter(Boolean),ours.map(x=>x.clog).filter(Boolean),ours.length);
 const groupRows='<tr class="nemesis-row nem-group-row"><th>External group</th><td>'+em.members+' members · stats '+em.statsMembers+'/'+em.members+' · CLog '+em.clogMembers+'/'+em.members+'</td><td>'+fi(em.level.value)+'</td><td>'+ci(em.xp.value)+'</td><td>'+f1(em.ehp.value)+'</td><td>'+f1(em.ehb.value)+'</td><td>'+fmt(em.union.size)+'</td></tr>'+
 '<tr class="nem-group-row"><th>United Gimps selection</th><td>'+om.members+' members · stats '+om.statsMembers+'/'+om.members+' · CLog '+om.clogMembers+'/'+om.members+'</td><td>'+fi(om.level.value)+'</td><td>'+ci(om.xp.value)+'</td><td>'+f1(om.ehp.value)+'</td><td>'+f1(om.ehb.value)+'</td><td>'+fmt(om.union.size)+'</td></tr>';
 const members=externals.map(x=>summaryRow(x.displayName||x.name,x.stats,x.clog,sourceLabel(x),true)).join('')+ours.map(x=>summaryRow(x.p.name,x.stats,x.clog,[x.stats?'WOM':null,x.clog?'Temple':null].filter(Boolean).join(' + '))).join('');
 h.innerHTML='<div class="table-scroll"><table class="nem-table"><thead><tr><th>Group / player</th><th>Coverage / source</th><th>Total level</th><th>Total XP</th><th>EHP</th><th>EHB</th><th>Collection Log</th></tr></thead><tbody>'+groupRows+'<tr class="nem-table-divider"><td colspan="7">Individual members</td></tr>'+members+'</tbody></table></div>'
}
function renderSkills(){
 const h=$('#nemesisSkills');if(!h)return;const es=extStats(),os=ownRows().map(x=>x.stats).filter(Boolean);
 if(!es.length){h.innerHTML='<div class="notice">None of the external accounts returned WOM or Temple skill data.</div>';return}
 const rows=SKILLS.map(k=>{
  const ea=sumValues(es.map(x=>x.skills?.[k]?.level)),oa=sumValues(os.map(x=>x.skills?.[k]?.level));
  const eavg=ea.count?ea.value/ea.count:null,oavg=oa.count?oa.value/oa.count:null,diff=ea.value!=null&&oa.value!=null?ea.value-oa.value:null;
  return '<tr><th>'+U.skillIcon(k,{alt:''})+'<span>'+escapeHtml(nice(k))+'</span></th><td>'+fi(ea.value)+' <small>'+ea.count+'/'+externals.length+'</small></td><td>'+fi(oa.value)+' <small>'+oa.count+'/'+selectedPlayers().length+'</small></td><td class="'+(diff==null?'':diff>=0?'pos':'neg')+'">'+signed(diff)+'</td><td>'+f1(eavg)+'</td><td>'+f1(oavg)+'</td></tr>'
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
 h.innerHTML=rows.length?'<div class="nem-coverage-note">Boss KC is summed across '+es.length+'/'+externals.length+' external WOM accounts and '+os.length+'/'+selectedPlayers().length+' selected United Gimps accounts.</div><div class="table-scroll"><table class="nem-table"><thead><tr><th>Boss</th><th>External group KC</th><th>United Gimps KC</th><th>Difference</th></tr></thead><tbody>'+rows.map(x=>'<tr><th>'+escapeHtml(nice(x.k))+'</th><td>'+fmt(x.ev)+'</td><td>'+fmt(x.ov)+'</td><td class="'+(x.diff>=0?'pos':'neg')+'">'+signed(x.diff)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="notice">No comparable boss KC was found.</div>'
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
 h.innerHTML=top+coverage+'<div class="table-scroll"><table class="nem-table"><thead><tr><th>External member</th><th>Their slots</th><th>Shared with United union</th><th>External-only</th><th>United-only</th><th>Overlap</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
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
 renderSummary();renderSkills();renderBosses();renderClog()
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
 bindPicker();
 form?.addEventListener('submit',e=>{e.preventDefault();addAccount()});
 window.addEventListener('ug:members-changed',()=>{selection=U.loadMemberSelection();bindPicker();render()});
 render()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();