(()=>{
'use strict';
const U=window.UGV21,M=window.UGClogBetaModel,L=window.UGClogLuck;
if(!U||!M||!L||document.body.dataset.page!=='gim')return;
const {$,$$,fmt,escapeHtml:esc}=U;
let doc=null,wom=null,model=null,selected=U.loadMemberSelection(),mode='raw',view='scored',prices=null,priceRequest=null,metricCache=new Map(),excludedCache=new Map();

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
function valueImportanceWeight(gp){if(!Number.isFinite(+gp)||+gp<=0)return 0;const w=.2+Math.log10(Math.max(1,+gp/1e5));return Math.min(5,Math.max(.2,w))}
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
function exposure(metrics){const src=new Map();for(const m of metrics)for(const s of m.r.sources||[]){const old=src.get(s.source)||0;src.set(s.source,Math.max(old,+s.kc||0))}return{attempts:[...src.values()].reduce((a,b)=>a+b,0),sources:src.size}}
function sample(metrics){const e=exposure(metrics),n=metrics.length;if(n<12||e.attempts<75)return{key:'insufficient',label:'insufficient sample',detail:n+' scored items · '+fmt(e.attempts)+' source attempts'};if(n<35||e.attempts<350)return{key:'limited',label:'limited sample',detail:n+' scored items · '+fmt(e.attempts)+' source attempts'};return{key:'usable',label:'usable sample',detail:n+' scored items · '+fmt(e.attempts)+' source attempts'}}
function indices(metrics){
 const rawSum=metrics.reduce((n,m)=>n+m.z,0),raw=metrics.length?rawSum/metrics.length:null;
 const valued=prices?metrics.map(m=>({m,w:valueImportanceWeight(price(m.id))})).filter(x=>x.w>0):[];
 const valueWeight=valued.reduce((n,x)=>n+x.w,0),valueNumerator=valued.reduce((n,x)=>n+x.m.z*x.w,0),value=valueWeight?valueNumerator/valueWeight:null;
 return{raw,rawSum,rawCount:metrics.length,value,valueNumerator,valueWeight,priced:valued.length}
}
function entityStats(ps){const metrics=metricsFor(ps),idx=indices(metrics),s=sample(metrics);return{metrics,idx,s}}
function renderPicker(){
 const h=$('#clogLuckMembers');if(!h)return;
 U.renderMemberPicker(h,selected,keys=>{const next=new Set(keys);if(U.sameSelection(selected,next))return;selected=next;U.saveMemberSelection(selected);reset();render()},{title:'Members in luck analysis',subtitle:'Add or remove usernames. Percentiles, combined rolls and both luck rankings recalculate for exactly this selection.',fallback:U.ALL_KEYS,availability:model.known})
}
function overview(){
 const h=$('#clogLuckOverview');if(!h)return;const ps=selectedPlayers();
 if(!ps.length){h.innerHTML='<div class="notice">No selected member has a synced Collection Log.</div>';return}
 const s=entityStats(ps),excluded=excludedFor(ps),names=ps.map(p=>p.name).join(', ');
 h.innerHTML='<div class="clog-luck-kpi"><span>Raw RNG index</span><b class="clog-luck-'+tone(s.idx.raw||0)+'">'+(s.idx.raw==null?'—':sig(s.idx.raw))+'</b><small>Every calculable item gets exactly one equal vote. '+(s.idx.raw==null?'No score.':signed(s.idx.rawSum)+' total σ ÷ '+fmt(s.idx.rawCount)+' items.')+'</small></div>'+
 '<div class="clog-luck-kpi"><span>Value-weighted RNG index</span><b class="clog-luck-'+tone(s.idx.value||0)+'">'+(s.idx.value==null?'—':signed(s.idx.value))+'</b><small>'+(s.idx.value==null?'Needs live prices.':signed(s.idx.valueNumerator)+' weighted σ ÷ '+s.idx.valueWeight.toFixed(2)+' total weight.')+' Cheap items are deliberately down-weighted; the economic-importance multiplier ranges from 0.20× to 5.00×.</small></div>'+
 '<div class="clog-luck-kpi"><span>Current selection</span><b>'+fmt(ps.length)+' member'+(ps.length===1?'':'s')+'</b><small>'+esc(names)+' · '+fmt(excluded.length)+' items excluded/impossible to tell.</small></div>';
 const badge=$('#clogLuckImpossibleCount');if(badge)badge.textContent=fmt(excluded.length)
}
function itemRow(m){
 const p=price(m.id),expected=Number.isFinite(m.r.expected)?m.r.expected:null,actual=fmt(m.r.observed),pct=m.r.text,w=valueImportanceWeight(p),weighted=m.z*w;
 const score=mode==='value'?signed(weighted)+' numerator':sig(m.z);
 const sub=mode==='value'?(sig(m.z)+' item σ × '+w.toFixed(2)+' weight = '+signed(weighted)+' · '+money(p)+' gp'):(actual+' actual · '+(expected==null?'expected n/a':expected.toFixed(expected<10?2:1)+' expected')+' · '+pct+' percentile');
 return '<article class="clog-luck-item"><img src="https://static.runelite.net/cache/item/icon/'+m.id+'.png" alt=""><div class="clog-luck-item-copy"><b>'+U.itemLink(m.id,m.name)+'</b><small>'+sub+'</small></div><div class="clog-luck-item-score"><strong class="clog-luck-'+tone(m.z)+'">'+score+'</strong><small>'+(mode==='value'?pct+' raw percentile':((m.r.sources||[]).slice(0,1).map(s=>fmt(s.kc)+' '+esc(s.label)).join('')||'modelled rolls'))+'</small></div></article>'
}
function ranked(metrics){
 if(mode==='value'){if(!prices)return[];return metrics.filter(m=>price(m.id)>0).map(m=>({...m,sort:m.z*valueImportanceWeight(price(m.id))})).sort((a,b)=>b.sort-a.sort)}
 return metrics.map(m=>({...m,sort:m.z})).sort((a,b)=>b.sort-a.sort)
}
function renderLists(){
 const ps=selectedPlayers(),subjectLabel=ps.map(p=>p.name).join(', ')||'no selected members',stats=ps.length?entityStats(ps):null,metrics=stats?.metrics||[],rows=ranked(metrics),lucky=rows.slice(0,8),dry=[...rows].sort((a,b)=>a.sort-b.sort).slice(0,8);
 const formula=$('#clogLuckFormula');
 if(formula){
  if(!stats)formula.innerHTML='';
  else if(mode==='value')formula.innerHTML=stats.idx.value==null?'<b>Value-weighted formula:</b> live GE prices unavailable.':'<b>Value-weighted formula:</b> '+signed(stats.idx.valueNumerator)+' weighted σ ÷ '+stats.idx.valueWeight.toFixed(2)+' total weight = <strong>'+signed(stats.idx.value)+'</strong>. Economic-importance multiplier range: 0.20×–5.00×.';
  else formula.innerHTML='<b>Raw formula:</b> '+signed(stats.idx.rawSum)+' total σ ÷ '+fmt(stats.idx.rawCount)+' calculable items = <strong>'+sig(stats.idx.raw)+'</strong>. Every item has exactly one equal vote.';
 }
 $('#clogLuckLuckyTitle').textContent=mode==='value'?'Lucky + economically meaningful':'Most statistically lucky';
 $('#clogLuckDryTitle').textContent=mode==='value'?'Unlucky + economically meaningful':'Most statistically unlucky';
 $('#clogLuckLuckySub').textContent=subjectLabel;$('#clogLuckDrySub').textContent=subjectLabel;
 $('#clogLuckLucky').innerHTML=lucky.length?lucky.map(itemRow).join(''):'<div class="clog-luck-empty">'+(mode==='value'&&!prices?'Current GE prices are unavailable.':'No calculable items for this selection.')+'</div>';
 $('#clogLuckDry').innerHTML=dry.length?dry.map(itemRow).join(''):'<div class="clog-luck-empty">'+(mode==='value'&&!prices?'Current GE prices are unavailable.':'No calculable items for this selection.')+'</div>'
}
function renderPlayers(){
 const h=$('#clogLuckPlayers');if(!h)return;
 const rows=selectedPlayers().map(p=>{const x=entityStats([p]);return{p,...x}}).sort((a,b)=>((b.idx.value??b.idx.raw)??-99)-((a.idx.value??a.idx.raw)??-99));
 h.innerHTML=rows.map((x,i)=>'<article class="clog-luck-player-row" style="--pc:'+x.p.color+'"><div class="clog-luck-player-name"><i></i><div><b>'+(i+1)+'. '+esc(x.p.name)+'</b><small>'+esc(x.s.detail)+'</small></div></div><div class="clog-luck-player-metric"><span>Raw RNG index</span><b class="clog-luck-'+tone(x.idx.raw||0)+'">'+(x.idx.raw==null?'—':sig(x.idx.raw))+'</b></div><div class="clog-luck-player-metric"><span>Value-weighted index</span><b class="clog-luck-'+tone(x.idx.value||0)+'">'+(x.idx.value==null?'—':signed(x.idx.value))+'</b></div><span class="clog-luck-sample '+x.s.key+'">'+esc(x.s.label)+'</span></article>').join('')||'<div class="clog-luck-empty">No selected synced members.</div>'
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
function render(){if(!model||!wom)return;renderPicker();overview();renderLists();renderPlayers();renderImpossible();renderView()}
function bind(){
 $$('[data-luck-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.luckMode;$$('[data-luck-mode]').forEach(x=>x.classList.toggle('active',x===b));if(mode==='value'&&!prices)loadPrices().then(()=>render());render()});
 $$('[data-luck-view]').forEach(b=>b.onclick=()=>{view=b.dataset.luckView;renderView()});
 const tab=$('[data-gim-tab="luck"]');if(tab&&!tab.dataset.luckBound){tab.dataset.luckBound='1';tab.addEventListener('click',()=>{render();if(!prices)loadPrices().then(()=>render())})}
}
function reset(){metricCache=new Map();excludedCache=new Map()}
window.addEventListener('ug:members-changed',e=>{const keys=U.cleanSelection(e.detail?.keys,U.ALL_KEYS);if(U.sameSelection(selected,keys))return;selected=keys;reset();render()});
window.addEventListener('ug:data-updated',async e=>{if(e.detail?.key===U.TKEY){doc=await U.loadClog();model=M.build(doc,U.PLAYERS);reset();render()}else if(e.detail?.key===U.WKEY){wom=await U.loadWom();reset();render()}});
async function init(){[doc,wom]=await Promise.all([U.loadClog(),U.loadWom()]);model=M.build(doc,U.PLAYERS);bind();render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();