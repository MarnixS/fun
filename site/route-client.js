/* Public feature URLs; legacy/offline docs remain usable without redirects. */
(()=>{
'use strict';
const files=__PUBLIC_ROUTES__;
const enabled=!!document.querySelector('base[data-ug-public]')||['ugimps.com','www.ugimps.com'].includes(location.hostname);
const scrollKey='ug:page-scroll',sections=new Set(['cumulativeSummary','gainCards']);
const assetBase=document.baseURI;
function resolve(value){try{return new URL(value,/^[?#]/.test(value)?location.href:assetBase)}catch{return null}}
function file(value){
 const url=resolve(value);if(!url)return '';
 const path=url.pathname.replace(/\/$/,'');
 if(['','/index','/index.html','/docs','/docs/index','/docs/index.html'].includes(path))return 'index.html';
 const parts=path.split('/');if(parts.length!==2&&!(parts.length===3&&parts[1]==='docs'))return '';
 const leaf=parts.at(-1),name=leaf.endsWith('.html')?leaf:leaf+'.html';
 return Object.hasOwn(files,name)?(files[name]==='/'?'index.html':files[name].slice(1)+'.html'):'';
}
function destination(value){
 const url=resolve(value);if(!url||url.origin!==location.origin)return null;
 const name=file(value);if(!name)return null;
 const section=sections.has(url.hash.slice(1))?url.hash.slice(1):'';
 return {path:files[name]+url.search+(section?'':url.hash),section};
}
function href(value){return enabled?destination(value)?.path||value:value}
window.UGRoutes={enabled,file,href};
// Privacy-friendly visitor analytics. Activate by setting the Cloudflare Web Analytics
// site token obtained from Cloudflare > Web Analytics > ugimps.com > Manage site.
// Do not count local previews, the old github.io mirror, or developer maintenance.
// No token means disabled: never pretend that statistics are being collected.
const analyticsToken='';
const isPublicDomain=['ugimps.com','www.ugimps.com'].includes(location.hostname);
if(isPublicDomain && analyticsToken && !['developer.html'].includes(file(location.pathname))){
  const beacon=document.createElement('script');
  beacon.defer=true;
  beacon.src='https://static.cloudflareinsights.com/beacon.min.js';
  beacon.setAttribute('data-cf-beacon',JSON.stringify({token:analyticsToken}));
  document.head.appendChild(beacon);
}
window.UGAnalytics={configured:!!analyticsToken,active:isPublicDomain&&!!analyticsToken,provider:'Cloudflare Web Analytics'};
function showAnalyticsPanel(){
 if(document.body?.dataset.page!=='developer'||document.getElementById('ug-analytics-panel'))return;
 const section=document.createElement('section');
 section.className='section';
 section.id='ug-analytics-panel';
 section.innerHTML='<div class="section-head"><div><div class="eyebrow">SITE MAINTENANCE</div><h2>Visitor analytics</h2></div></div>'
   +'<div class="card card-pad"><h3 id="ug-analytics-state"></h3><p id="ug-analytics-details"></p>'
   +'<p>Track actual ugimps.com visits and page views across the site using privacy-friendly Cloudflare Web Analytics. The dashboard is private to the site owner. No historical data can be recreated before activation.</p>'
   +'<p><a class="btn" target="_blank" rel="noopener noreferrer" href="https://dash.cloudflare.com/?to=/:account/web-analytics">Open visitor dashboard ↗</a> '
   +'<a class="btn" target="_blank" rel="noopener noreferrer" href="https://github.com/MarnixS/fun/blob/main/docs/TRAFFIC-ANALYTICS.md">Setup instructions ↗</a></p></div>';
 const main=document.querySelector('main');
 if(main)main.appendChild(section);else document.body.appendChild(section);
 section.querySelector('#ug-analytics-state').textContent=analyticsToken?'Configured in repository':'Setup required: Cloudflare site token';
 section.querySelector('#ug-analytics-details').textContent=analyticsToken?'Tracking runs on ugimps.com pages. Check the Cloudflare dashboard for processed figures.':'The site is ready, but no visitor tracking is running yet. Add the Cloudflare Web Analytics token to docs/assets/site-routes.js.';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showAnalyticsPanel,{once:true});else showAnalyticsPanel();


if(!enabled)return;
function remember(target){try{sessionStorage.setItem(scrollKey,JSON.stringify({...target,at:Date.now()}))}catch{}}
function normalize(link){
 if(link.localName!=='a')return;
 const raw=link.getAttribute('href');if(!raw||raw==='#'||link.hasAttribute('download'))return;
 const target=destination(raw);if(!target)return;
 if(target.section)link.dataset.ugSection=target.section;
 if(raw!==target.path)link.setAttribute('href',target.path);
}
function scan(node){if(node.nodeType!==1)return;if(node.matches('a[href]'))normalize(node);node.querySelectorAll('a[href]').forEach(normalize)}
const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='attributes')normalize(r.target);else r.addedNodes.forEach(scan)}});
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
document.querySelectorAll('a[href]').forEach(normalize);
const current=destination(location.href);
if(current){
 if(current.section)remember(current);
 if(location.pathname==='/docs'||location.pathname.startsWith('/docs/')){location.replace(current.path);return}
 if(location.pathname+location.search+location.hash!==current.path)history.replaceState(history.state,'',current.path);
}
document.addEventListener('click',event=>{
 if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const link=event.target.closest?.('a[href]');if(!link||link.target&&link.target!=='_self')return;
 normalize(link);const section=link.dataset.ugSection;if(!section)return;
 const target={path:link.getAttribute('href'),section};
 if(target.path===location.pathname+location.search){event.preventDefault();document.getElementById(section)?.scrollIntoView?.({block:'start'})}
 else remember(target);
},true);
async function restoreScroll(){
 let target;try{target=JSON.parse(sessionStorage.getItem(scrollKey)||'null');sessionStorage.removeItem(scrollKey)}catch{}
 if(!target||Date.now()-target.at>120000||target.path!==location.pathname+location.search||!sections.has(target.section))return;
 if(document.fonts?.ready)await document.fonts.ready;
 requestAnimationFrame(()=>document.getElementById(target.section)?.scrollIntoView?.({block:'start'}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restoreScroll,{once:true});else restoreScroll();
})();
