(()=>{
'use strict';
const U=window.UGV21,M=window.UGClogBetaModel,L=window.UGClogLuck;
if(!U||!M||!L||document.body.dataset.page!=='gim')return;
const {$,$$,fmt,compact,escapeHtml:esc}=U;
let doc=null,wom=null,model=null,selected=U.loadMemberSelection(),subject='group',mode='raw',prices=null,priceRequest=null,metricCache=new Map();

function selectedPlayers(){return U.PLAYERS.filter(p=>selected.has(p.key)&&model?.known.has(p.key))}
function modelIds(){const ids=new Set(model?.names?.keys?.()||[]);for(const m of model?.counts?.values?.()||[])for(const id of m.keys())ids.add(id);return [...ids]}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function invNorm(p){
 p=clamp(+p,1e-6,1-1e-6);
 const a=[-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239];
 const b=[-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572];
 const c=[-.007784894002430293,-.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
 const d=[.007784695709041462,.3224671290700398,2.445134137142996,3.754408661907416];
 const lo=.02425,hi=1-lo;
 if(p<lo){const q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
 if(p>hi){const q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
 const q=p-.5,r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
}
function sig(z){return (z>0?'+':'')+z.toFixed(2)+'σ'}
function money(n){if(!Number.isFinite(+n)||+n<=0)return'—';n=+n;return n>=1e9?(n/1e9).toFixed(2)+'b':n>=1e6?(n/1e6).toFixed(1)+'m':n>=1e3?(n/1e3).toFixed(1)+'k':fmt(n)}
function scoreMoney(n){if(!Number.isFinite(n)||!n)return'0';const s=n>0?'+':'−',a=Math.abs(n);return s+money(a)}
function tone(z){return z>.15?'positive':z<-.15?'negative':'neutral'}

async function loadPrices(){
 if(prices)return prices;if(priceRequest)return priceRequest;
 priceRequest=(async()=>{try{const r=await fetch('https://prices.runescape.wiki/api/v1/osrs/latest',{cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});if(!r.ok)throw new Error('GE '+r.status);prices=(await r.json()).data||{}}catch(e){console.warn('Lucky or Not prices unavailable',e);prices=null}return prices})();
 try{return await priceRequest}finally{priceRequest=null}
}
function price(id){id=+id;const ge=x=>{const p=prices?.[x];if(!p)return 0;const h=+p.high,l=+p.low;return h>0&&l>0?(h+l)/2:h>0?h:l>0?l:0};if(id===29799)return Math.max(0,ge(29801)-ge(19553));if(id===29790||id===29792||id===29794)return ge(29796)/3;if(id===28319||id===28321||id===28323||id===28325)return ge(28338)/4;if(id===28279)return Math.max(0,ge(28316)-ge(28301)-500*ge(565)-3*ge(28276));if(id===28281)return Math.max(0,ge(28313)-ge(28304)-500*ge(565)-3*ge(28276));if(id===28283)return Math.max(0,ge(28310)-ge(28298)-500*ge(565)-3*ge(28276));if(id===28285)return Math.max(0,ge(28307)-ge(28295)-500*ge(565)-3*ge(28276));return ge(id)}

function metricsFor(ps){
 const key=ps.map(p=>p.key).sort().join('|');if(metricCache.has(key))return metricCache.get(key);
 const out=[];
 for(const id of modelIds()){
  const name=model.names.get(id)||'Item '+id;let r=null;
  try{r=L.calculate(id,name,ps,wom,model,U)}catch{}
  if(!r||!Number.isFinite(r.percentile))continue;
  const z=invNorm(r.percentile);
  if(!Number.isFinite(z))continue;
  out.push({id,name,r,z});
 }
 metricCache.set(key,out);return out
}
function exposure(metrics){
 const src=new Map();
 for(const m of metrics)for(const s of m.r.sources||[]){const old=src.get(s.source)||0;src.set(s.source,Math.max(old,+s.kc||0))}
 return{attempts:[...src.values()].reduce((a,b)=>a+b,0),sources:src.size}
}
function sample(metrics){
 const e=exposure(metrics),n=metrics.length;
 if(n<12||e.attempts<75)return{key:'insufficient',label:'insufficient sample',detail:n+' scored items · '+fmt(e.attempts)+' source attempts'};
 if(n<35||e.attempts<350)return{key:'limited',label:'limited sample',detail:n+' scored items · '+fmt(e.attempts)+' source attempts'};
 return{key:'usable',label:'usable sample',detail:n+' scored items · '+fmt(e.attempts)+' source attempts'}
}
function indices(metrics){
 const raw=metrics.length?metrics.reduce((n,m)=>n+m.z,0)/metrics.length:null;
 const valued=prices?metrics.map(m=>({m,w:price(m.id)})).filter(x=>x.w>0):[];
 const den=valued.reduce((n,x)=>n+x.w,0),value=den?valued.reduce((n,x)=>n+x.m.z*x.w,0)/den:null;
 return{raw,value,priced:valued.length}
}
function subjectPlayers(){
 if(subject==='group')return selectedPlayers();
 const p=U.PLAYERS.find(x=>x.key===subject);return p&&model.known.has(p.key)?[p]:[]
}
function entityStats(ps){const metrics=metricsFor(ps),idx=indices(metrics),s=sample(metrics);return{metrics,idx,s}}

function populateSubject(){
 const el=$('#clogLuckSubject');if(!el)return;
 const cur=subject;
 el.innerHTML='<option value="group">Selected group</option>'+U.PLAYERS.map(p=>'<option value="'+esc(p.key)+'">'+esc(p.name)+(model.known.has(p.key)?'':' · no CLog')+'</option>').join('');
 el.value=[...el.options].some(o=>o.value===cur)?cur:'group';subject=el.value;
 if(!el.dataset.bound){el.dataset.bound='1';el.onchange=()=>{subject=el.value;render()}}
}
function overview(){
 const h=$('#clogLuckOverview');if(!h)return;
 const ps=selectedPlayers();if(!ps.length){h.innerHTML='<div class="notice">No selected member has a synced Collection Log.</div>';return}
 const s=entityStats(ps),names=ps.map(p=>p.name).join(', ');
 h.innerHTML='<div class="clog-luck-kpi"><span>Selected group · raw RNG index</span><b class="clog-luck-'+tone(s.idx.raw||0)+'">'+(s.idx.raw==null?'—':sig(s.idx.raw))+'</b><small>Mean standardized item-level deviation across '+fmt(s.metrics.length)+' calculable items.</small></div>'+
 '<div class="clog-luck-kpi"><span>Selected group · value weighted</span><b class="clog-luck-'+tone(s.idx.value||0)+'">'+(s.idx.value==null?'—':sig(s.idx.value))+'</b><small>GE-value-weighted mean deviation across '+fmt(s.idx.priced)+' priced calculable items.</small></div>'+
 '<div class="clog-luck-kpi"><span>Current group selection</span><b>'+fmt(ps.length)+' member'+(ps.length===1?'':'s')+'</b><small>'+esc(names)+' · '+esc(s.s.detail)+'</small></div>';
}
function itemRow(m){
 const p=price(m.id),expected=Number.isFinite(m.r.expected)?m.r.expected:null,actual=fmt(m.r.observed),pct=m.r.text,impact=p?m.z*p:0;
 const score=mode==='value'?scoreMoney(impact)+' score':sig(m.z);
 const sub=mode==='value'?(sig(m.z)+' × '+money(p)+' gp'):(actual+' actual · '+(expected==null?'expected n/a':expected.toFixed(expected<10?2:1)+' expected')+' · '+pct+' percentile');
 return '<article class="clog-luck-item"><img src="https://static.runelite.net/cache/item/icon/'+m.id+'.png" alt=""><div class="clog-luck-item-copy"><b>'+U.itemLink(m.id,m.name)+'</b><small>'+sub+'</small></div><div class="clog-luck-item-score"><strong class="clog-luck-'+tone(m.z)+'">'+score+'</strong><small>'+(mode==='value'?(actual+' actual · '+pct):((m.r.sources||[]).slice(0,1).map(s=>fmt(s.kc)+' '+esc(s.label)).join('')||'modelled rolls'))+'</small></div></article>'
}
function ranked(metrics){
 if(mode==='value'){
  if(!prices)return[];
  return metrics.filter(m=>price(m.id)>0).map(m=>({...m,sort:m.z*price(m.id)})).sort((a,b)=>b.sort-a.sort)
 }
 return metrics.map(m=>({...m,sort:m.z})).sort((a,b)=>b.sort-a.sort)
}
function renderLists(){
 const ps=subjectPlayers(),subjectLabel=subject==='group'?'selected group':ps[0]?.name||'selected player',metrics=ps.length?entityStats(ps).metrics:[];
 const rows=ranked(metrics),lucky=rows.slice(0,8),dry=[...rows].sort((a,b)=>a.sort-b.sort).slice(0,8);
 $('#clogLuckLuckyTitle').textContent=mode==='value'?'Biggest valuable spoons':'Most statistically lucky';
 $('#clogLuckDryTitle').textContent=mode==='value'?'Biggest valuable dry streaks':'Most statistically unlucky';
 $('#clogLuckLuckySub').textContent=subjectLabel;$('#clogLuckDrySub').textContent=subjectLabel;
 $('#clogLuckLucky').innerHTML=lucky.length?lucky.map(itemRow).join(''):'<div class="clog-luck-empty">'+(mode==='value'&&!prices?'Current GE prices are unavailable.':'No calculable items for this subject.')+'</div>';
 $('#clogLuckDry').innerHTML=dry.length?dry.map(itemRow).join(''):'<div class="clog-luck-empty">'+(mode==='value'&&!prices?'Current GE prices are unavailable.':'No calculable items for this subject.')+'</div>';
}
function renderPlayers(){
 const h=$('#clogLuckPlayers');if(!h)return;
 const rows=U.PLAYERS.map(p=>{
  if(!model.known.has(p.key))return{p,metrics:[],idx:{raw:null,value:null},s:{key:'insufficient',label:'no Collection Log',detail:'No synced Collection Log'}};
  const x=entityStats([p]);return{p,...x}
 }).sort((a,b)=>(b.idx.value??-99)-(a.idx.value??-99)||(b.idx.raw??-99)-(a.idx.raw??-99));
 h.innerHTML=rows.map((x,i)=>'<article class="clog-luck-player-row" style="--pc:'+x.p.color+'"><div class="clog-luck-player-name"><i></i><div><b>'+(i+1)+'. '+esc(x.p.name)+'</b><small>'+esc(x.s.detail)+'</small></div></div><div class="clog-luck-player-metric"><span>Raw RNG index</span><b class="clog-luck-'+tone(x.idx.raw||0)+'">'+(x.idx.raw==null?'—':sig(x.idx.raw))+'</b></div><div class="clog-luck-player-metric"><span>Value-weighted index</span><b class="clog-luck-'+tone(x.idx.value||0)+'">'+(x.idx.value==null?'—':sig(x.idx.value))+'</b></div><span class="clog-luck-sample '+x.s.key+'">'+esc(x.s.label)+'</span></article>').join('');
}
function render(){
 if(!model||!wom)return;populateSubject();overview();renderLists();renderPlayers();
}
function bind(){
 $$('[data-luck-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.luckMode;$$('[data-luck-mode]').forEach(x=>x.classList.toggle('active',x===b));if(mode==='value'&&!prices)loadPrices().then(()=>render());render()});
 const tab=$('[data-gim-tab="luck"]');if(tab&&!tab.dataset.luckBound){tab.dataset.luckBound='1';tab.addEventListener('click',()=>{render();if(!prices)loadPrices().then(()=>render())})}
}
function reset(){metricCache=new Map()}
window.addEventListener('ug:members-changed',e=>{selected=U.cleanSelection(e.detail?.keys,U.ALL_KEYS);reset();render()});
window.addEventListener('ug:data-updated',async e=>{if(e.detail?.key===U.TKEY){doc=await U.loadClog();model=M.build(doc,U.PLAYERS);reset();render()}else if(e.detail?.key===U.WKEY){wom=await U.loadWom();reset();render()}});
async function init(){[doc,wom]=await Promise.all([U.loadClog(),U.loadWom()]);model=M.build(doc,U.PLAYERS);bind();populateSubject();render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();