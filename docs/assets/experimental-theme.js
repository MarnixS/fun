/* Appearance only. No account data, API calls or shared filter changes. */
(()=>{
'use strict';
const key='ug:experimental:osrs-theme:v1',root=document.documentElement;
let enabled=true,ready=false,storageAvailable=true;
const playerFiles={'dikste':'dikste','big dog aura':'big-dog-aura','lijpste':'lijpste','poep aura':'poep-aura','lompste':'lompste'},originalImages=new Map();
// Body bounds locate the original models without changing their pixels.
const portraitBounds={
 'dikste':{size:[260,407],body:[108,64,223,392],clip:'inset(0 0 0 16%)'},
 'big dog aura':{size:[223,409],body:[74,64,190,401]},
 'lijpste':{size:[359,739],body:[90,21,331,729]},
 'poep aura':{size:[218,386],body:[58,39,171,368]},
 'lompste':{size:[233,380],body:[52,37,166,365]}
},portraitFrames=new Map();
function framePortrait(image,player){
 const crop=portraitBounds[player];if(!crop||!image.parentNode)return;
 let frame=portraitFrames.get(image);
 if(!frame){frame=document.createElement('span');frame.className='osrs-portrait-frame';image.before(frame);frame.append(image);portraitFrames.set(image,frame)}
 if(frame.dataset.osrsPortrait===player)return;
 const [w,h]=crop.size,[left,top,right,bottom]=crop.body;
 frame.dataset.osrsPortrait=player;
 frame.style.setProperty('--osrs-portrait-scale',String(.9*h/(bottom-top)));
 frame.style.setProperty('--osrs-portrait-x',String(-50*(left+right)/w)+'%');
 frame.style.setProperty('--osrs-portrait-y',String(-50*(top+bottom)/h)+'%');
 frame.style.setProperty('--osrs-portrait-clip',crop.clip||'none');
}
let imageObserver=null;
function swapImage(image,target,player='',banner=false){
 const current=image.getAttribute('src');if(!current||current===target)return;
 originalImages.set(image,Object.fromEntries(['src','srcset','alt','width','height'].map(name=>[name,image.getAttribute(name)])));
 image.setAttribute('src',target);image.removeAttribute('srcset');if(player)image.dataset.osrsPlayer=player;
 if(banner){image.alt='Original in-game appearances of Dikste, Big Dog Aura, Lijpste, Poep Aura and Lompste in an Old School courtyard';image.width=2048;image.height=690}
}
function refreshImages(){
 if(!enabled||typeof document==='undefined'||!document.body)return;
 document.querySelectorAll('.player-portrait,.mast-player-avatar,.side-card>img,.goal-head>img,.era-player-head>img,.osrs-portrait-frame>img').forEach(image=>{
  const key=(image.alt||image.closest('[data-goal-player]')?.dataset.goalPlayer||image.closest('.era-player-head')?.querySelector('h3')?.textContent||'').trim().toLowerCase();
  if(playerFiles[key]){swapImage(image,'img/osrs-theme/players/'+playerFiles[key]+'.png',key);framePortrait(image,key)}
 });
 document.querySelectorAll('.group-banner').forEach(image=>{swapImage(image,'img/osrs-theme/united-gimps-plain-banner.webp','',true);mountPets(image)});
 document.querySelectorAll('.mast-crest').forEach(image=>swapImage(image,'img/osrs-theme/group-ironman-helm.png'));
 for(const image of originalImages.keys())if(!image.isConnected){originalImages.delete(image);const frame=portraitFrames.get(image);if(frame?.isConnected&&!frame.children.length)frame.remove();portraitFrames.delete(image)}
}
// Companion sprites sit above the untouched banner; original character pixels are never redrawn.
function mountPets(banner){
 const frame=banner.closest('.banner-frame');if(!frame||frame.querySelector('[data-osrs-pets]'))return;
 const layer=document.createElement('div');layer.className='osrs-banner-pets';layer.dataset.osrsPets='';layer.setAttribute('role','img');layer.setAttribute('aria-label','Dikste with a cat, Big Dog Aura with an Airedale terrier, Lijpste with a boar, Poep Aura with a gemstone crab, and Lompste with an EOC ghost');
 const pets=[
  [100,400,260,255,190,130],
  [485,315,340,343,540,135],
  [895,350,370,313,795,150],
  [1365,445,360,215,1405,135],
  [1815,250,260,410,1790,145]
 ];
 for(const [x,y,w,h,left,width] of pets){const sprite=document.createElement('span'),image=document.createElement('img'),height=width*h/w;sprite.className='osrs-banner-pet';sprite.style.cssText=`left:${left/2048*100}%;top:${(650-height)/690*100}%;width:${width/2048*100}%;aspect-ratio:${w}/${h}`;image.src='img/osrs-theme/banner-pets.png';image.alt='';image.width=2160;image.height=728;image.style.cssText=`width:${2160/w*100}%;left:${-x/w*100}%;top:${-y/h*100}%`;sprite.append(image);layer.append(sprite)}
 frame.append(layer);
}
function watchImages(){
 refreshImages();
 if(!imageObserver&&document.body){imageObserver=new MutationObserver(refreshImages);imageObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','alt']})}
}
function restoreImages(){
 imageObserver?.disconnect();imageObserver=null;
 for(const [image,frame] of portraitFrames)if(image.parentNode===frame)frame.replaceWith(image);
 portraitFrames.clear();
 for(const [image,original] of originalImages){for(const [name,value] of Object.entries(original))if(value===null)image.removeAttribute(name);else image.setAttribute(name,value);delete image.dataset.osrsPlayer}
 originalImages.clear();
}
try{enabled=localStorage.getItem(key)!=='off'}catch{storageAvailable=false}
const iconMap={'../':'play.gif','index.html':'play.gif','clog-beta.html':'manual.gif','gim.html':'menu-icons/advanced-log.svg','hypothetical.html':'menu-icons/hypothetical-log.svg','rng.html':'menu-icons/rng-index.svg','hiscores.html':'hiscore.gif','cumulative-xp.html':'menu-icons/cumulative-xp.svg','progress.html':'status-icon.gif','time-machine.html':'worldmap.gif','chronicle.html':'manual.gif','history.html':'menu-icons/timeline.svg','goals.html':'menu-icons/goals.svg','kc-comparison.html':'menu-icons/kc-comparison.svg','nemesis.html':'create.gif','nemesis-beta.html':'create.gif','faq.html':'support.png','news.html':'comment.gif','experimental.html':'beta.gif'};
function decoratedLink(link){
 const copy=link.cloneNode(true),icon=document.createElement('img');
 copy.className='osrs-menu-link'+(link.classList.contains('active')?' active':'');
 copy.querySelector('.nav-rune')?.remove();icon.src='img/osrs-theme/'+(iconMap[(link.getAttribute('href')||'').split('#')[0]]||'settings.png');icon.alt='';const custom=icon.getAttribute('src').includes('/menu-icons/');if(custom)icon.className='osrs-feature-icon';icon.width=custom?24:22;icon.height=custom?24:20;copy.prepend(icon);return copy;
}
function mount(){
 if(!ready||!enabled)return;
 watchImages();
 if(!document.querySelector('[data-osrs-banner]')){
  const mast=document.querySelector('.mast');
  if(mast){
   const banner=document.createElement('a'),left=document.createElement('span'),title=document.createElement('h1'),image=document.createElement('img'),right=document.createElement('span');
   banner.href='../';banner.className='osrs-banner';banner.dataset.osrsBanner='';banner.setAttribute('aria-label','United Gimps overview');
   for(const [side,name] of [[left,'left'],[right,'right']]){side.className='osrs-banner-characters osrs-banner-characters-'+name;side.setAttribute('aria-hidden','true')}
   title.className='osrs-banner-logo';image.src='img/osrs-theme/united-gimps-logo.jpg';image.alt='United Gimps';image.width=1536;image.height=768;
   title.append(image);banner.append(left,title,right);mast.before(banner);
  }
 }
 if(!document.querySelector('[data-osrs-nav]')){
  const source=document.querySelector('.nav-inner'),host=document.querySelector('.main-nav');
  if(source&&host){
   const nav=document.createElement('div');nav.className='wrap osrs-navigation';nav.dataset.osrsNav='';
   const overview=source.querySelector(':scope > .nav-link[href="../"], :scope > .nav-link[href="index.html"]');if(overview){const home=decoratedLink(overview);home.classList.add('osrs-overview');nav.append(home)}
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
 document.querySelectorAll('[data-osrs-theme-switch]').forEach(control=>{
  if(control.tagName==='BUTTON'){control.setAttribute('aria-checked',String(enabled));control.querySelectorAll('[data-theme-choice]').forEach(choice=>choice.dataset.selected=String((choice.dataset.themeChoice==='osrs')===enabled));control.title=enabled?'Old School selected. Switch to Modern.':'Modern selected. Switch to Old School.'}
  else control.checked=enabled;
 });
 document.querySelectorAll('[data-osrs-theme-status]').forEach(node=>node.textContent=(enabled?'Old School is active. Use the toggle at the top to switch to Modern.':'Modern is active. Use the toggle at the top to switch to Old School.')+(storageAvailable?' Your choice is remembered on this browser.':' This browser cannot save preferences; the choice lasts for this page.'));
}
function apply(){
 if(enabled){
  root.dataset.theme='osrs';
  if(!document.querySelector('#osrsThemeStyles')){const link=document.createElement('link');link.id='osrsThemeStyles';link.rel='stylesheet';link.href='assets/osrs-theme.css?v=10';document.head.append(link)}
  mount();
 }else{restoreImages();delete root.dataset.theme;document.querySelector('#osrsThemeStyles')?.remove();document.querySelectorAll('[data-osrs-banner],[data-osrs-nav],[data-osrs-pets]').forEach(node=>node.remove())}
 syncControls();window.dispatchEvent(new CustomEvent('ug:theme-changed',{detail:{enabled}}));
}
function setEnabled(value){enabled=value===true;try{localStorage.setItem(key,enabled?'on':'off');storageAvailable=true}catch{storageAvailable=false}apply()}
window.UGExperimentalTheme={get enabled(){return enabled},setEnabled};
// This script is deliberately in the head, after ordinary CSS: restore a saved
// preference before first paint, fetching the theme stylesheet only when on.
apply();
function init(){ready=true;mount();syncControls();document.querySelectorAll('[data-osrs-theme-switch]').forEach(control=>{if(control.tagName==='BUTTON')control.addEventListener('click',event=>{const choice=event.target.closest('[data-theme-choice]');setEnabled(choice?choice.dataset.themeChoice==='osrs':!enabled)});else control.addEventListener('change',()=>setEnabled(control.checked))})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.addEventListener('storage',event=>{if(event.key===key||event.key===null){try{enabled=localStorage.getItem(key)!=='off'}catch{enabled=true;storageAvailable=false}apply()}});
})();
