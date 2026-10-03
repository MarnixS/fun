/* Appearance only. No account data, API calls or shared filter changes. */
(()=>{
'use strict';
const key='ug:experimental:osrs-theme:v1',root=document.documentElement;
let enabled=false,ready=false,storageAvailable=true;
const playerFiles={'dikste':'dikste','big dog aura':'big-dog-aura','lijpste':'lijpste','poep aura':'poep-aura','lompste':'lompste'},originalImages=new Map();
let imageObserver=null;
function swapImage(image,target,player='',banner=false){
 const current=image.getAttribute('src');if(!current||current===target)return;
 originalImages.set(image,Object.fromEntries(['src','srcset','alt','width','height'].map(name=>[name,image.getAttribute(name)])));
 image.setAttribute('src',target);image.removeAttribute('srcset');if(player)image.dataset.osrsPlayer=player;
 if(banner){image.alt='Original in-game appearances of Dikste, Big Dog Aura, Lijpste, Poep Aura and Lompste in an Old School courtyard';image.width=2048;image.height=690}
}
function refreshImages(){
 if(!enabled||typeof document==='undefined'||!document.body)return;
 document.querySelectorAll('.player-portrait,.mast-player-avatar,.side-card>img,.goal-head>img,.era-player-head>img').forEach(image=>{
  const key=(image.alt||image.closest('[data-goal-player]')?.dataset.goalPlayer||image.closest('.era-player-head')?.querySelector('h3')?.textContent||'').trim().toLowerCase();
  if(playerFiles[key])swapImage(image,'img/osrs-theme/players/'+playerFiles[key]+'.png',key);
 });
 document.querySelectorAll('.group-banner').forEach(image=>swapImage(image,'img/osrs-theme/united-gimps-plain-banner.webp','',true));
 for(const image of originalImages.keys())if(!image.isConnected)originalImages.delete(image);
}
function watchImages(){
 refreshImages();
 if(!imageObserver&&document.body){imageObserver=new MutationObserver(refreshImages);imageObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','alt']})}
}
function restoreImages(){
 imageObserver?.disconnect();imageObserver=null;
 for(const [image,original] of originalImages){for(const [name,value] of Object.entries(original))if(value===null)image.removeAttribute(name);else image.setAttribute(name,value);delete image.dataset.osrsPlayer}
 originalImages.clear();
}
try{enabled=localStorage.getItem(key)==='on'}catch{storageAvailable=false}
const iconMap={'index.html':'play.gif','clog-beta.html':'manual.gif','gim.html':'shop.gif','hypothetical.html':'vote.gif','rng.html':'bonds.gif','hiscores.html':'hiscore.gif','progress.html':'status-icon.gif','time-machine.html':'worldmap.gif','chronicle.html':'manual.gif','history.html':'globe.gif','goals.html':'vote.gif','kc-comparison.html':'hiscore.gif','nemesis-beta.html':'create.gif','faq.html':'support.png','news.html':'comment.gif','experimental.html':'beta.gif'};
function decoratedLink(link){
 const copy=link.cloneNode(true),icon=document.createElement('img');
 copy.className='osrs-menu-link'+(link.classList.contains('active')?' active':'');
 copy.querySelector('.nav-rune')?.remove();icon.src='img/osrs-theme/'+(iconMap[(link.getAttribute('href')||'').split('#')[0]]||'settings.png');icon.alt='';icon.width=22;icon.height=20;copy.prepend(icon);return copy;
}
function mount(){
 if(!ready||!enabled)return;
 watchImages();
 if(!document.querySelector('[data-osrs-banner]')){
  const mast=document.querySelector('.mast');
  if(mast){const banner=document.createElement('a');banner.href='index.html';banner.className='osrs-banner';banner.dataset.osrsBanner='';banner.setAttribute('aria-label','United Gimps overview');const image=document.createElement('img');image.src='img/osrs-theme/rslogo3.png';image.alt='Old School RuneScape';image.width=747;image.height=137;banner.append(image);mast.before(banner)}
 }
 if(!document.querySelector('[data-osrs-nav]')){
  const source=document.querySelector('.nav-inner'),host=document.querySelector('.main-nav');
  if(source&&host){
   const nav=document.createElement('div');nav.className='wrap osrs-navigation';nav.dataset.osrsNav='';
   const overview=source.querySelector(':scope > .nav-link[href="index.html"]');if(overview){const home=decoratedLink(overview);home.classList.add('osrs-overview');nav.append(home)}
   const groups=document.createElement('div');groups.className='osrs-navigation-groups';
   source.querySelectorAll('.nav-dropdown').forEach(group=>{
    const box=document.createElement('section'),heading=document.createElement('h2'),list=document.createElement('div');
    box.className='osrs-menu-box';heading.textContent=group.querySelector('.nav-trigger>span:nth-child(2)').textContent;list.className='osrs-menu-list';
    group.querySelectorAll('.nav-dropdown-panel a').forEach(link=>list.append(decoratedLink(link)));box.append(heading,list);groups.append(box);
   });nav.append(groups);host.append(nav);
  }
 }
}
function syncControls(){
 document.querySelectorAll('[data-osrs-theme-switch]').forEach(input=>input.checked=enabled);
 document.querySelectorAll('[data-osrs-theme-status]').forEach(node=>node.textContent=(enabled?'OSRS theme is on. Switch it off to return to the original appearance.':'OSRS theme is off. The original appearance is active.')+(storageAvailable?' Your choice is remembered on this browser.':' This browser cannot save preferences; the choice lasts for this page.'));
}
function apply(){
 if(enabled){
  root.dataset.theme='osrs';
  if(!document.querySelector('#osrsThemeStyles')){const link=document.createElement('link');link.id='osrsThemeStyles';link.rel='stylesheet';link.href='assets/osrs-theme.css?v=1';document.head.append(link)}
  mount();
 }else{restoreImages();delete root.dataset.theme;document.querySelector('#osrsThemeStyles')?.remove();document.querySelectorAll('[data-osrs-banner],[data-osrs-nav]').forEach(node=>node.remove())}
 syncControls();window.dispatchEvent(new CustomEvent('ug:theme-changed',{detail:{enabled}}));
}
function setEnabled(value){enabled=value===true;try{if(enabled)localStorage.setItem(key,'on');else localStorage.removeItem(key);storageAvailable=true}catch{storageAvailable=false}apply()}
window.UGExperimentalTheme={get enabled(){return enabled},setEnabled};
// This script is deliberately in the head, after ordinary CSS: restore a saved
// preference before first paint, fetching the theme stylesheet only when on.
apply();
function init(){ready=true;mount();syncControls();document.querySelectorAll('[data-osrs-theme-switch]').forEach(input=>input.addEventListener('change',()=>setEnabled(input.checked)))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.addEventListener('storage',event=>{if(event.key===key||event.key===null){try{enabled=localStorage.getItem(key)==='on'}catch{enabled=false;storageAvailable=false}apply()}});
})();
