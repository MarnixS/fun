(()=>{
'use strict';
const PLAYERS=[
 {key:'dikste',name:'Dikste',color:'#a99bb8'},
 {key:'big dog aura',name:'Big Dog Aura',color:'#e6ad43'},
 {key:'lijpste',name:'Lijpste',color:'#d94ff0'},
 {key:'poep aura',name:'Poep Aura',color:'#d77878'},
 {key:'lompste',name:'Lompste',color:'#d3b35d'}
];
const CORE_KEYS=['dikste','big dog aura','lijpste'];
const ALL_KEYS=PLAYERS.map(p=>p.key);
const PERIODS={7:'1 week',30:'1 month',90:'3 months',180:'6 months',365:'1 year'};
const WKEY='ug-v20-wom-cache',TKEY='ug-v20-temple-cache',MKEY='ug-v25-member-selection';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const fmt=n=>Number.isFinite(+n)?Math.round(+n).toLocaleString('en-GB'):'—';
const fmt1=n=>Number.isFinite(+n)?(+n).toLocaleString('en-GB',{maximumFractionDigits:1}):'—';
const compact=n=>{n=+n;if(!Number.isFinite(n))return'—';const a=Math.abs(n);if(a>=1e9)return(n/1e9).toFixed(a>=1e10?1:2).replace(/\.0+$/,'')+'B';if(a>=1e6)return(n/1e6).toFixed(a>=1e7?1:2).replace(/\.0+$/,'')+'M';if(a>=1e3)return(n/1e3).toFixed(a>=1e4?1:2).replace(/\.0+$/,'')+'K';return fmt(n)};
const nice=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase()).replace(/Of /g,'of ').replace(/The /g,'the ');
function localJSON(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}}
async function staticJSON(path){const r=await fetch(path,{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
async function loadWom(){let shared=null;try{shared=await staticJSON('data/wom-cache.json')}catch(e){console.warn('v21 WOM cache',e)}const local=localJSON(WKEY),st=+(shared?.fetchedAt||0),lt=+(local?.fetchedAt||local?.savedAt||0);return lt>st&&local?.profiles?local:(shared?.profiles?shared:local)||{profiles:{},gains:{},snapshots:{},achievements:{}}}
async function loadClog(){let shared=null;try{shared=await staticJSON('data/temple-clog.json')}catch(e){console.warn('v21 Collection Log cache',e)}const local=localJSON(TKEY),st=+(shared?.fetchedAt||0),lt=+(local?.fetchedAt||local?.savedAt||0);return lt>st&&local?.players?local:(shared?.players?shared:local)||{players:{}}}
function snapData(w,key){return w?.profiles?.[key]?.latestSnapshot?.data||w?.profiles?.[key]?.latest_snapshot?.data||null}
function player(key){return PLAYERS.find(p=>p.key===key)}
function cleanSelection(sel,fallback=ALL_KEYS){const ok=new Set(ALL_KEYS),out=new Set([...(sel||[])].filter(k=>ok.has(k)));if(!out.size)fallback.forEach(k=>out.add(k));return out}
function loadMemberSelection(){const saved=localJSON(MKEY),raw=Array.isArray(saved)?saved:saved?.keys;return cleanSelection(raw,ALL_KEYS)}
function saveMemberSelection(selection){const next=cleanSelection(selection,ALL_KEYS),keys=ALL_KEYS.filter(k=>next.has(k));try{localStorage.setItem(MKEY,JSON.stringify(keys))}catch{}window.dispatchEvent(new CustomEvent('ug:members-changed',{detail:{keys}}));return next}
function sameSelection(a,b){return ALL_KEYS.every(k=>a?.has?.(k)===b?.has?.(k))}
function memberSummary(sel){const a=PLAYERS.filter(p=>sel.has(p.key));return a.length===PLAYERS.length?'All five selected':a.length===1?`${a[0].name} selected`:`${a.length} members selected`}
let pickerSeq=0;
function renderMemberPicker(host,selection,onChange,{title='Members',subtitle='Add or remove members',fallback=ALL_KEYS,availability=null}={}){
 if(typeof host==='string')host=$(host);if(!host)return;
 const sel=cleanSelection(selection,fallback),base=(host.id||`v21-members-${++pickerSeq}`).replace(/[^a-z0-9_-]/gi,'-'),helpId=`${base}-help`,statusId=`${base}-status`;
 host.classList.add('v21-member-picker');
 host.innerHTML=`<fieldset class="v21-member-fieldset"><legend>${title}</legend><div class="v21-member-head"><span id="${statusId}" class="v21-member-status" aria-live="polite">${memberSummary(sel)}</span><div class="v21-member-actions"><button type="button" data-v21-preset="all">All five</button><button type="button" data-v21-preset="core">Core three</button></div></div><div class="v21-member-list" role="group" aria-label="${title}">${PLAYERS.map(p=>{const known=availability?availability.has(p.key):true;return `<label style="--pc:${p.color}"><input type="checkbox" value="${p.key}" ${sel.has(p.key)?'checked':''} aria-describedby="${helpId}"><i aria-hidden="true"></i><span>${p.name}</span>${known?'':'<em>no Collection Log data yet</em>'}</label>`}).join('')}</div><div id="${helpId}" class="v21-member-help">${subtitle} Each username is an independent additive filter.</div></fieldset>`;
 const status=$(`#${statusId}`,host),checks=$$('input[type="checkbox"]',host);
 const commit=next=>{if(!next.size){if(status)status.textContent='Keep at least one member selected';return false}if(status)status.textContent=memberSummary(next);onChange(new Set(next));return true};
 checks.forEach(c=>c.onchange=()=>{const n=new Set(checks.filter(x=>x.checked).map(x=>x.value));if(!n.size){c.checked=true;const restored=new Set([c.value]);if(status)status.textContent='At least one member must stay selected';onChange(restored);return}commit(n)});
 const preset=keys=>{const next=new Set(keys);checks.forEach(c=>c.checked=next.has(c.value));commit(next)};
 $('[data-v21-preset="all"]',host).onclick=()=>preset(PLAYERS.map(p=>p.key));
 $('[data-v21-preset="core"]',host).onclick=()=>preset(CORE_KEYS);
}
const TERMS=[
 [/Actual WOM snapshot/g,'Closest WOM snapshot in time'],
 [/Temple snapshot/g,'Collection Log snapshot'],
 [/Temple recent items/g,'Collection Log recent unlocks via Temple'],
 [/Temple recent unlocks/g,'Collection Log recent unlocks via Temple'],
 [/WOM \+ Temple stay saved until you refresh/g,'WOM + Collection Log stay saved until you refresh'],
 [/WOM \+ Temple/g,'WOM + Collection Log'],
 [/Temple refresh finished/g,'Collection Log refresh finished'],
 [/shared saved Temple snapshot restored/g,'shared saved Collection Log snapshot restored'],
 [/Supporting cast/g,'Additional group members'],
 [/supporting cast/g,'additional group members']
];
function replaceTextNode(n){if(!n||n.nodeType!==Node.TEXT_NODE)return;let s=n.nodeValue||'',z=s;for(const [a,b] of TERMS)z=z.replace(a,b);if(z!==s)n.nodeValue=z}
function normalizeVisibleTerminology(root=document){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))replaceTextNode(n)}
function installObserver(){normalizeVisibleTerminology();let scheduled=false;const flush=()=>{scheduled=false;normalizeVisibleTerminology(document);enhanceAccessibility(document)},o=new MutationObserver(()=>{if(scheduled)return;scheduled=true;if(window.requestAnimationFrame)window.requestAnimationFrame(flush);else setTimeout(flush,0)});o.observe(document.documentElement,{childList:true,subtree:true})}
let modalReturnFocus=null;
function focusables(root){return $$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])',root).filter(x=>!x.hidden&&x.getAttribute('aria-hidden')!=='true')}
function closeGraphModal(el){const m=el?.closest?.('.modal')||$('.modal:not([hidden])');if(m){m.hidden=true;m.style.display='none';m.setAttribute('aria-hidden','true');if(modalReturnFocus?.isConnected)modalReturnFocus.focus();modalReturnFocus=null}}
function showGraphModal(m){if(!m)return;modalReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;m.hidden=false;m.style.display='flex';m.setAttribute('aria-hidden','false');m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');if($('#v21ModalTitle',m))m.setAttribute('aria-labelledby','v21ModalTitle');requestAnimationFrame(()=>$('.modal-close',m)?.focus())}
document.addEventListener('click',e=>{const close=e.target.closest?.('.modal-close,[data-modal-close]');if(close){e.preventDefault();e.stopImmediatePropagation();closeGraphModal(close)}else if(e.target.classList?.contains('modal'))closeGraphModal(e.target)},true);
document.addEventListener('keydown',e=>{const m=$('.modal:not([hidden])');if(!m)return;if(e.key==='Escape'){e.preventDefault();closeGraphModal(m);return}if(e.key==='Tab'){const a=focusables(m);if(!a.length)return;const first=a[0],last=a[a.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}},true);
function enhanceAccessibility(root=document){
 const main=root.matches?.('main')?root:$('main',root)||$('main');if(main&&!main.id)main.id='main-content';
 if(document.body&&!$('.v21-skip-link'))document.body.insertAdjacentHTML('afterbegin','<a class="v21-skip-link" href="#main-content">Skip to main content</a>');
 const nav=root.matches?.('.main-nav')?root:$('.main-nav',root);if(nav&&!nav.hasAttribute('aria-label'))nav.setAttribute('aria-label','Primary');
 $$('.table-scroll',root).forEach((x,i)=>{if(!x.hasAttribute('tabindex'))x.tabIndex=0;if(!x.hasAttribute('role'))x.setAttribute('role','region');if(!x.hasAttribute('aria-label')){const cap=x.closest('.table-card')?.querySelector('.table-caption strong')?.textContent?.trim();x.setAttribute('aria-label',cap?`${cap} table, horizontally scrollable`:`Data table ${i+1}, horizontally scrollable`)}});
 const labels={clogSearch:'Search Collection Log items',clogCategory:'Collection Log category',clogStatus:'Collection Log item status',clogSort:'Sort Collection Log items',clogImportTarget:'Collection Log import member',skillSelect:'Skill to graph',bossSelect:'Boss to graph',timeDate:'Time Machine date'};
 for(const [id,label] of Object.entries(labels)){const el=$(`#${id}`);if(el&&!el.hasAttribute('aria-label')&&!el.labels?.length)el.setAttribute('aria-label',label)}
 const tabs=$$('[data-gim-tab]',root);const subs=$$('.collection-shell>.subnav',root);subs.forEach(bar=>{bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Collection Log views')});tabs.forEach(b=>{b.setAttribute('role','tab');b.removeAttribute('aria-pressed');b.setAttribute('aria-selected',b.classList.contains('active')?'true':'false')});
 $$('[data-gim-panel]',root).forEach(p=>{p.setAttribute('role','tabpanel');if(!p.hasAttribute('tabindex'))p.tabIndex=0});
 $$('.seg button,.modal-periods button',root).forEach(b=>{b.setAttribute('aria-pressed',b.classList.contains('active')?'true':'false')});
 const modal=root.matches?.('.modal')?root:$('.modal',root);if(modal){modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');if($('#v21ModalTitle',modal))modal.setAttribute('aria-labelledby','v21ModalTitle')}
}
document.addEventListener('click',e=>{if(e.target.closest?.('.seg button,.modal-periods button,[data-gim-tab]'))requestAnimationFrame(()=>enhanceAccessibility(document))});
function installDataNotifications(){if(window.__ugDataNotifyInstalled)return;window.__ugDataNotifyInstalled=true;const proto=Storage.prototype,orig=proto.setItem;proto.setItem=function(k,v){orig.call(this,k,v);if(this===localStorage&&(k===WKEY||k===TKEY))window.dispatchEvent(new CustomEvent('ug:data-updated',{detail:{key:k}}))}}
function renderSharedMemberPicker(){const page=document.body?.dataset?.page;if(!['home','history','time'].includes(page))return;let host=$('#statsMemberPicker');if(!host){host=document.createElement('div');host.id='statsMemberPicker';host.className='v21-filter-wrap';$('#pageNotice')?.insertAdjacentElement('afterend',host)}renderMemberPicker(host,loadMemberSelection(),next=>saveMemberSelection(next),{title:'Members across this site',subtitle:'This same selection controls cards, tables, charts, Time Machine and Chronicle comparisons.',fallback:ALL_KEYS})}
function installMemberSelection(){window.addEventListener('storage',e=>{if(e.key===MKEY)window.dispatchEvent(new CustomEvent('ug:members-changed',{detail:{keys:[...loadMemberSelection()]}}))});window.addEventListener('ug:members-changed',renderSharedMemberPicker);renderSharedMemberPicker()}
function loadNav(){if(document.querySelector('script[data-v21-nav]'))return;const s=document.createElement('script');s.src='assets/v21-nav.js';s.dataset.v21Nav='1';document.head.append(s)}
window.UGV21={PLAYERS,CORE_KEYS,ALL_KEYS,PERIODS,$,$$,fmt,fmt1,compact,nice,loadWom,loadClog,snapData,player,WKEY,TKEY,MKEY,cleanSelection,loadMemberSelection,saveMemberSelection,sameSelection,renderMemberPicker,closeGraphModal,showGraphModal,enhanceAccessibility};
function init(){installObserver();installDataNotifications();installMemberSelection();loadNav();enhanceAccessibility(document)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
