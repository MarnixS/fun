(()=>{
'use strict';
const L=window.UGClogLuck;
if(!L||typeof L.simulationCatalog!=='function')return;
const STORAGE='ug-hypothetical-log-v1';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const fmt=n=>Number.isFinite(+n)?Math.round(+n).toLocaleString('en-GB'):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sources=[],bySource=new Map(),names={},state=loadState(),logStatus='obtained',logSource='all',logSearch='',logSort='source';

function loadState(){
 try{
  const x=JSON.parse(localStorage.getItem(STORAGE)||'null');
  if(x&&typeof x==='object')return{kc:x.kc&&typeof x.kc==='object'?x.kc:{},drops:x.drops&&typeof x.drops==='object'?x.drops:{},history:Array.isArray(x.history)?x.history.slice(0,80):[]}
 }catch{}
 return{kc:{},drops:{},history:[]}
}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state))}catch(e){console.warn('Hypothetical Log save failed',e)}}
function rand(){
 if(window.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296}
 return Math.random()
}
function randint(a,b){a=Math.ceil(+a||0);b=Math.floor(+b||a);return a+Math.floor(rand()*(Math.max(a,b)-a+1))}
function chanceText(p,rolls=1){
 const eff=1-Math.pow(1-Math.max(0,Math.min(1,+p||0)),Math.max(1,+rolls||1));
 if(eff<=0)return'—';
 if(eff>=.1)return(100*eff).toFixed(eff>=.5?0:1)+'%';
 const d=1/eff;return d>=10000?'1 / '+Math.round(d/100)*100: d>=100?'1 / '+Math.round(d):'1 / '+d.toFixed(1)
}
function itemQty(item){
 if(item.type==='u'&&Array.isArray(item.param)&&item.param.length>=2)return randint(item.param[0],item.param[1]);
 if(item.type==='s'&&Number.isFinite(+item.param)&&+item.param>1)return Math.max(1,Math.round(+item.param));
 return 1
}
function sourceDrops(source){
 const raw=state.drops[source];
 return raw&&typeof raw==='object'?raw:{}
}
function globalCounts(){
 const out={};
 for(const bag of Object.values(state.drops||{}))for(const [id,q] of Object.entries(bag||{}))out[id]=(out[id]||0)+Math.max(0,+q||0);
 return out
}
function addDrop(source,item,qty,batch){
 if(qty<=0)return;
 if(!state.drops[source])state.drops[source]={};
 state.drops[source][item.id]=(state.drops[source][item.id]||0)+qty;
 batch.set(item.id,(batch.get(item.id)||0)+qty)
}
function sourceAssumptions(src){
 const set=new Set();
 for(const item of src.items)for(const n of item.notes||[])if(n)set.add(n);
 const notes=[...set];
 return notes.length?notes.slice(0,3).join(' · '):'Uses the current Collection Log rate model for this source.'
}
function rollEncounter(src,batch){
 state.kc[src.source]=(state.kc[src.source]||0)+1;
 const currentKc=state.kc[src.source];
 const bag=sourceDrops(src.source);
 const exclusive=src.items.filter(x=>x.exclusive==='raid-unique');
 if(exclusive.length){
  const weights=exclusive.map(x=>Math.max(0,+x.prob||0));
  const total=Math.min(1,weights.reduce((a,b)=>a+b,0));
  const r=rand();
  if(r<total){
   let t=r,chosen=exclusive[exclusive.length-1];
   for(let i=0;i<exclusive.length;i++){t-=weights[i];if(t<0){chosen=exclusive[i];break}}
   addDrop(src.source,chosen,itemQty(chosen),batch)
  }
 }
 for(const item of src.items){
  if(item.exclusive==='raid-unique')continue;
  const pity=(item.type==='y'||item.type==='g')&&Number.isFinite(+item.param)&&+item.param>0;
  if(pity&&!(+bag[item.id]||0)&&currentKc>=+item.param){
   addDrop(src.source,item,itemQty(item),batch);
   continue
  }
  const trials=Math.max(1,Math.round(+item.rolls||1));
  for(let i=0;i<trials;i++)if(rand()<item.prob)addDrop(src.source,item,itemQty(item),batch)
 }
}
function currentSource(){return bySource.get($('#hypoSource')?.value)||sources[0]||null}
function renderSourceSelect(){
 const s=$('#hypoSource');if(!s)return;
 const raids=sources.filter(x=>x.raid),bosses=sources.filter(x=>!x.raid);
 const group=(label,arr)=>'<optgroup label="'+label+'">'+arr.map(x=>'<option value="'+esc(x.source)+'">'+esc(x.label)+'</option>').join('')+'</optgroup>';
 const cur=s.value;s.innerHTML=group('Raids',raids)+group('Bosses & boss chests',bosses);
 if(cur&&bySource.has(cur))s.value=cur;
 renderSource()
}
function renderSource(){
 const src=currentSource();if(!src)return;
 const meta=$('#hypoSourceMeta');
 const pool=$('#hypoPool');
 const kc=state.kc[src.source]||0;
 if(meta)meta.innerHTML='<div><b>'+esc(src.label)+'</b><p>'+esc(sourceAssumptions(src))+'</p></div><span>'+fmt(src.items.length)+' tracked Collection Log drops · '+fmt(kc)+' hypothetical '+(src.raid?'completions':'kills/chests')+'</span>';
 if(pool)pool.innerHTML=src.items.map(item=>'<div class="hypo-pool-row"><img src="https://static.runelite.net/cache/item/icon/'+item.id+'.png" alt=""><div><b>'+esc(item.name)+'</b><small>'+(item.exclusive?'exclusive raid unique · ':'')+(item.rolls>1?item.rolls+' rolls per encounter':'one tracked roll')+'</small></div><strong>'+chanceText(item.prob,item.rolls)+'</strong></div>').join('');
 const reset=$('#hypoResetSource');if(reset)reset.disabled=!kc&&!Object.keys(sourceDrops(src.source)).length
}
function renderRecent(){
 const h=$('#hypoRecent');if(!h)return;
 if(!state.history.length){h.innerHTML='<div class="hypo-empty">No hypothetical loot yet. Pick a source and roll it.</div>';return}
 h.innerHTML=state.history.slice(0,40).map(x=>'<div class="hypo-drop-row"><img src="https://static.runelite.net/cache/item/icon/'+x.id+'.png" alt=""><div><b>'+esc(x.name)+'</b><small>'+esc(x.label)+' · '+fmt(x.from)+'–'+fmt(x.to)+' KC</small></div><strong>×'+fmt(x.qty)+'</strong></div>').join('')
}
function allItems(){
 const m=new Map();
 for(const src of sources)for(const item of src.items){
  const old=m.get(item.id)||{id:item.id,name:item.name,sources:new Set(),raid:false};
  old.sources.add(src.source);old.raid=old.raid||src.raid;m.set(item.id,old)
 }
 return [...m.values()]
}
function renderKpis(){
 const counts=globalCounts(),encounters=Object.values(state.kc).reduce((n,x)=>n+(+x||0),0),used=Object.values(state.kc).filter(x=>+x>0).length,unique=Object.values(counts).filter(x=>+x>0).length,copies=Object.values(counts).reduce((n,x)=>n+(+x||0),0);
 const h=$('#hypoKpis');if(h)h.innerHTML=[
  ['Sources rolled',fmt(used),fmt(sources.length)+' available'],
  ['Encounters',fmt(encounters),'hypothetical only'],
  ['Unique slots',fmt(unique),fmt(allItems().length)+' tracked slots'],
  ['Total drops',fmt(copies),'including duplicates']
 ].map(x=>'<div class="hypo-kpi"><span>'+x[0]+'</span><b>'+x[1]+'</b><small>'+x[2]+'</small></div>').join('')
}
function renderLogFilters(){
 const s=$('#hypoLogSource');if(!s)return;
 const cur=s.value||logSource;
 s.innerHTML='<option value="all">All bosses & raids</option>'+sources.map(x=>'<option value="'+esc(x.source)+'">'+esc(x.label)+'</option>').join('');
 s.value=[...s.options].some(o=>o.value===cur)?cur:'all';logSource=s.value
}
function renderLog(){
 const h=$('#hypoGrid');if(!h)return;
 const counts=globalCounts(),needle=logSearch.trim().toLowerCase();
 let items=allItems().map(x=>({...x,count:counts[x.id]||0}));
 if(logSource!=='all')items=items.filter(x=>x.sources.has(logSource));
 if(logStatus==='obtained')items=items.filter(x=>x.count>0);
 else if(logStatus==='missing')items=items.filter(x=>x.count<=0);
 if(needle)items=items.filter(x=>x.name.toLowerCase().includes(needle));
 if(logSort==='count')items.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 else if(logSort==='name')items.sort((a,b)=>a.name.localeCompare(b.name));
 else items.sort((a,b)=>{const sa=[...a.sources].map(s=>bySource.get(s)?.label||s).sort()[0]||'',sb=[...b.sources].map(s=>bySource.get(s)?.label||s).sort()[0]||'';return sa.localeCompare(sb)||a.name.localeCompare(b.name)});
 if(!items.length){h.innerHTML='<div class="hypo-empty">No items match these hypothetical-log filters.</div>';return}
 h.innerHTML=items.map(x=>{
  const srcs=[...x.sources].map(s=>bySource.get(s)?.label||s);
  return '<article class="hypo-item '+(x.count?'':'missing')+'"><img src="https://static.runelite.net/cache/item/icon/'+x.id+'.png" alt=""><div><b>'+esc(x.name)+'</b><small>'+esc(srcs.slice(0,2).join(' · '))+(srcs.length>2?' · +'+(srcs.length-2):'')+'</small></div><span class="hypo-count">×'+fmt(x.count)+'</span></article>'
 }).join('')
}
function renderAll(){renderKpis();renderSource();renderRecent();renderLogFilters();renderLog()}
function doRoll(){
 const src=currentSource();if(!src)return;
 const input=$('#hypoAmount'),n=Math.max(1,Math.min(5000,Math.round(+input?.value||1)));if(input)input.value=n;
 const start=(state.kc[src.source]||0)+1,batch=new Map();
 for(let i=0;i<n;i++)rollEncounter(src,batch);
 const end=state.kc[src.source]||0,lookup=new Map(src.items.map(x=>[x.id,x]));
 const rows=[...batch.entries()].sort((a,b)=>b[1]-a[1]);
 for(const [id,qty] of rows){const item=lookup.get(+id);state.history.unshift({source:src.source,label:src.label,id:+id,name:item?.name||names[id]||('Item '+id),qty,from:start,to:end,time:Date.now()})}
 state.history=state.history.slice(0,80);save();renderAll();
 const summary=$('#hypoBatch');
 if(summary)summary.textContent=rows.length?fmt(n)+' '+(src.raid?'raid completions':'encounters')+' → '+rows.length+' different Collection Log drop'+(rows.length===1?'':'s'):'No tracked Collection Log drops in '+fmt(n)+' '+(src.raid?'raid completions':'encounters')+'.'
}
function bind(){
 $('#hypoSource').onchange=()=>renderSource();
 $('#hypoRoll').onclick=doRoll;
 $$('[data-hypo-amount]').forEach(b=>b.onclick=()=>{$('#hypoAmount').value=b.dataset.hypoAmount;doRoll()});
 $('#hypoResetSource').onclick=()=>{const src=currentSource();if(!src)return;if(!confirm('Reset all hypothetical KC and drops from '+src.label+'?'))return;delete state.kc[src.source];delete state.drops[src.source];state.history=state.history.filter(x=>x.source!==src.source);save();renderAll();$('#hypoBatch').textContent='Reset '+src.label+'.'};
 $('#hypoResetAll').onclick=()=>{if(!confirm('Reset the entire Hypothetical Log? This does not affect the real Collection Log.'))return;state={kc:{},drops:{},history:[]};save();renderAll();$('#hypoBatch').textContent='Hypothetical Log reset.'};
 $('#hypoSearch').oninput=e=>{logSearch=e.target.value;renderLog()};
 $('#hypoStatus').onchange=e=>{logStatus=e.target.value;renderLog()};
 $('#hypoLogSource').onchange=e=>{logSource=e.target.value;renderLog()};
 $('#hypoSort').onchange=e=>{logSort=e.target.value;renderLog()}
}
async function init(){
 const notice=$('#hypoBatch');
 try{
  const r=await fetch('data/clog-impact-audit.json',{cache:'no-store'});if(!r.ok)throw new Error('item catalogue HTTP '+r.status);
  const audit=await r.json();for(const x of audit.entries||[])names[+x.id]=x.name;
  sources=L.simulationCatalog(names);bySource=new Map(sources.map(x=>[x.source,x]));
  if(!sources.length)throw new Error('no boss/raid simulation sources');
  renderSourceSelect();renderLogFilters();bind();renderAll();
  if(notice)notice.textContent=fmt(sources.length)+' boss and raid sources available. Hypothetical data is stored only in this browser.'
 }catch(e){console.error(e);if(notice)notice.textContent='Hypothetical Log could not load its boss/raid rate catalogue.'}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();