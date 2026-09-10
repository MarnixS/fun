(()=>{
'use strict';
const PLAYERS=[
 {key:'dikste',name:'Dikste',color:'#a99bb8'},
 {key:'big dog aura',name:'Big Dog Aura',color:'#e6ad43'},
 {key:'lijpste',name:'Lijpste',color:'#d94ff0'},
 {key:'poep aura',name:'Poep Aura',color:'#d77878'},
 {key:'lompste',name:'Lompste',color:'#d3b35d'}
];
const PERIODS={7:'1 week',30:'1 month',90:'3 months',180:'6 months',365:'1 year'};
const WKEY='ug-v20-wom-cache',TKEY='ug-v20-temple-cache';
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
const TERMS=[
 [/Actual WOM snapshot/g,'Closest WOM snapshot in time'],
 [/Temple catalogue/gi,'Collection Log'],
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
function installObserver(){normalizeVisibleTerminology();const o=new MutationObserver(ms=>{for(const m of ms){for(const n of m.addedNodes){if(n.nodeType===Node.TEXT_NODE)replaceTextNode(n);else if(n.nodeType===Node.ELEMENT_NODE)normalizeVisibleTerminology(n)}}});o.observe(document.documentElement,{childList:true,subtree:true})}
function closeGraphModal(el){const m=el?.closest?.('.modal')||$('.modal');if(m)m.hidden=true}
document.addEventListener('click',e=>{const close=e.target.closest?.('.modal-close,[data-modal-close]');if(close){e.preventDefault();e.stopImmediatePropagation();closeGraphModal(close)}},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeGraphModal($('.modal'))},true);
function loadNav(){if(document.querySelector('script[data-v21-nav]'))return;const s=document.createElement('script');s.src='assets/v21-nav.js';s.dataset.v21Nav='1';document.head.append(s)}
window.UGV21={PLAYERS,PERIODS,$,$$,fmt,fmt1,compact,nice,loadWom,loadClog,snapData,player,WKEY,TKEY};
function init(){installObserver();loadNav()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();