/* Apply the saved member filter before the header paints. Artwork stays unchanged. */
(()=>{
'use strict';
const key='ug-v25-member-selection',names=['poep aura','dikste','big dog aura','lijpste','lompste'],root=document.documentElement;
let displayed;
function clean(value){const keys=Array.isArray(value)?value:Array.isArray(value?.keys)?value.keys:[],chosen=names.filter(name=>keys.includes(name));return chosen.length?new Set(chosen):new Set(names)}
function saved(){try{return clean(JSON.parse(localStorage.getItem(key)||'null'))}catch{return new Set(names)}}
function apply(selection){
 displayed=selection;
 for(const name of names)root.style.setProperty('--banner-'+name.replace(/ /g,'-')+'-opacity',selection.has(name)?'1':'.22');
 root.dataset.bannerMembers=String(selection.size);
 document.querySelectorAll('[data-banner-player]').forEach(pair=>pair.dataset.bannerSelected=String(selection.has(pair.dataset.bannerPlayer)));
}
apply(saved());
window.addEventListener('ug:members-changed',e=>apply(clean(e.detail?.keys)));
window.addEventListener('ug:display-members',e=>apply(clean(e.detail?.keys)));
window.addEventListener('storage',e=>{if(e.key===key)apply(e.newValue===null?new Set(names):(()=>{try{return clean(JSON.parse(e.newValue))}catch{return saved()}})());else if(e.key===null)apply(new Set(names))});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>apply(displayed),{once:true});else apply(displayed);
})();
