'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('docs/assets/experimental-theme.js','utf8'),nav=fs.readFileSync('docs/assets/v21-nav.js','utf8'),key='ug:experimental:osrs-theme:v1';
function open(saved=null,denied=false){
 const dom=new JSDOM(fs.readFileSync('docs/experimental.html','utf8'),{url:'https://example.com/experimental.html',runScripts:'outside-only'}),w=dom.window;
 if(saved!==null)w.localStorage.setItem(key,saved?'on':'off');
 if(denied)Object.defineProperty(w,'localStorage',{get(){throw new Error('Blocked storage')}});
 const requests=[];w.fetch=async url=>{requests.push(url);return {ok:true,text:async()=>"{key:'dikste',portrait:'data:image/png;base64,AA=='}"}};
 Object.defineProperty(w.document,'readyState',{value:'interactive'});w.matchMedia=()=>({matches:true,addEventListener(){}});w.eval(nav);w.eval(source);
 return {dom,w,d:w.document,requests};
}
async function finishModern(page){page.d.querySelector('#modernThemeStyles').dispatchEvent(new page.w.Event('load'));await new Promise(resolve=>page.w.setTimeout(resolve,0))}
(async()=>{
 const fresh=open(),{w,d}=fresh;
 assert(w.UGExperimentalTheme.enabled);assert.equal(d.documentElement.dataset.theme,'osrs');
 assert(d.querySelector('#osrsThemeStyles'));assert(!d.querySelector('#modernThemeStyles'));assert.equal(fresh.requests.length,0,'Old School never requests the Modern portrait source');
 assert.equal(d.querySelector('.group-banner').getAttribute('src'),'img/osrs-theme/united-gimps-cohesive-banner.jpg');
 assert.equal(d.querySelector('[data-theme-choice][data-selected="true"]').textContent,'Old School');
 assert.equal(d.querySelectorAll('.osrs-menu-box').length,4);assert.equal(d.querySelectorAll('[data-osrs-banner]').length,0);assert.equal(d.querySelectorAll('.group-banner[data-osrs-header="cohesive"]').length,1);assert.equal(d.querySelectorAll('[data-osrs-pets]').length,0);assert.equal(d.querySelectorAll('[data-osrs-nav]').length,1);
 assert.equal(d.querySelectorAll('.osrs-menu-link').length,d.querySelectorAll('.nav-inner .nav-link').length);
 assert(d.querySelector('[data-osrs-nav] a[href="cumulative-xp.html"]'));assert(!d.querySelector('[data-osrs-nav] a[href="nemesis.html"]'));assert(d.querySelector('.experimental-card a[href="nemesis.html"]'));
 const featurePages=['gim.html','hypothetical.html','rng.html','goals.html','history.html','cumulative-xp.html','kc-comparison.html'],featureSources=[];
 for(const page of featurePages){const image=d.querySelector('[data-osrs-nav] a[href="'+page+'"] img');assert(image.classList.contains('osrs-feature-icon'));assert.equal(image.width,24);assert.equal(image.height,24);assert(fs.existsSync('docs/'+image.getAttribute('src')));featureSources.push(image.src)}
 assert.equal(new Set(featureSources).size,7,'distinct feature icons stay intact');
 w.localStorage.setItem('ug:members','keep');const originalNav=d.querySelector('.nav-inner'),originalMain=d.querySelector('main'),oldStyles=d.querySelector('#osrsThemeStyles');
 const toggle=d.querySelector('[data-osrs-theme-switch]');toggle.click();
 assert(d.querySelector('#modernThemeStyles'));assert.equal(d.querySelector('#modernThemeStyles').getAttribute('blocking'),'render');
 assert.equal(fresh.requests.length,1);assert.equal(fresh.requests[0],'assets/portrait-source.txt');
 assert(w.UGExperimentalTheme.enabled,'a slow Modern stylesheet cannot expose an incomplete Modern page');assert.equal(toggle.getAttribute('aria-busy'),'true');
 await finishModern(fresh);
 assert(!w.UGExperimentalTheme.enabled);assert(!d.documentElement.hasAttribute('data-theme'));assert.equal(w.localStorage.getItem(key),'off');assert.equal(toggle.getAttribute('aria-checked'),'false');
 assert.equal(d.querySelector('#osrsThemeStyles'),oldStyles,'Old School CSS stays cached for an immediate return');assert(!d.querySelector('[data-osrs-nav]'));assert(!d.querySelector('[data-osrs-banner]'));
 assert.equal(d.querySelector('.group-banner').getAttribute('src'),'img/united-gimps-banner.webp');assert.equal(d.querySelector('.group-banner').width,1200);assert.equal(d.querySelector('.group-banner').height,265);
 assert.equal(w.UGExperimentalTheme.playerImage('dikste','fallback.png'),'data:image/png;base64,AA==','the deferred original Modern portrait remains available');
 toggle.click();assert(w.UGExperimentalTheme.enabled);assert.equal(w.localStorage.getItem(key),'on');assert.equal(d.querySelector('#osrsThemeStyles'),oldStyles);
 await w.UGExperimentalTheme.setEnabled(true);assert.equal(d.querySelectorAll('[data-osrs-nav]').length,1);assert.equal(d.querySelectorAll('[data-osrs-banner]').length,0);assert.equal(d.querySelectorAll('.group-banner[data-osrs-header="cohesive"]').length,1);assert.equal(d.querySelectorAll('[data-osrs-pets]').length,0);assert.equal(d.querySelector('.nav-inner'),originalNav);assert.equal(d.querySelector('main'),originalMain);assert.equal(w.localStorage.getItem('ug:members'),'keep');assert.equal(fresh.requests.length,1,'toggling reuses downloaded Modern portraits');
 w.localStorage.setItem(key,'off');w.dispatchEvent(new w.StorageEvent('storage',{key,newValue:'off'}));await finishModern(fresh);assert(!w.UGExperimentalTheme.enabled);
 w.localStorage.clear();w.dispatchEvent(new w.StorageEvent('storage',{key:null}));assert(w.UGExperimentalTheme.enabled);fresh.dom.window.close();
 const saved=open(false);assert(saved.w.UGExperimentalTheme.enabled,'the initial HTML is Old School even while a saved Modern choice loads');assert(saved.d.querySelector('#modernThemeStyles'));await finishModern(saved);assert(!saved.w.UGExperimentalTheme.enabled);assert.equal(saved.d.querySelector('.group-banner').getAttribute('src'),'img/united-gimps-banner.webp');saved.dom.window.close();
 const blocked=open(false,true);assert(blocked.w.UGExperimentalTheme.enabled);assert(!blocked.d.querySelector('#modernThemeStyles'));assert.equal(blocked.requests.length,0);assert(blocked.d.querySelector('[data-osrs-theme-status]').textContent.includes('cannot save'));blocked.dom.window.close();
 const cancelled=open();const pending=cancelled.w.UGExperimentalTheme.setEnabled(false);await cancelled.w.UGExperimentalTheme.setEnabled(true);await finishModern(cancelled);await pending;assert(cancelled.w.UGExperimentalTheme.enabled,'a late Modern load cannot override a newer Old School choice');cancelled.dom.window.close();
 const failed=open();const attempt=failed.w.UGExperimentalTheme.setEnabled(false);failed.d.querySelector('#modernThemeStyles').dispatchEvent(new failed.w.Event('error'));await attempt;assert(failed.w.UGExperimentalTheme.enabled);assert(!failed.d.querySelector('#modernThemeStyles'));assert(failed.d.querySelector('[data-osrs-nav]'));assert(failed.d.querySelector('[data-osrs-theme-status]').textContent.includes('could not load'));const retry=failed.w.UGExperimentalTheme.setEnabled(false);await finishModern(failed);await retry;assert(!failed.w.UGExperimentalTheme.enabled);failed.dom.window.close();
 for(const file of ['../index.html',...fs.readdirSync('docs').filter(f=>f.endsWith('.html'))]){
  const text=fs.readFileSync('docs/'+file,'utf8');if(!text.includes('assets/v21-nav.js'))continue;
  const page=new JSDOM(text).window.document;assert.equal(page.documentElement.dataset.theme,'osrs',file+': Old School before scripts');
  const style=page.querySelector('head #osrsThemeStyles');assert(style&&style.rel==='stylesheet'&&!style.media&&!style.disabled,file+': parser-discovered render-blocking theme CSS');
  assert(text.indexOf('id="osrsThemeStyles"')<text.indexOf('src="assets/experimental-theme.js'),file+': CSS precedes theme bootstrap');assert(!page.querySelector('[href*="modern-theme.css"]'),file+': Modern palette stays deferred');
  assert.equal(page.querySelectorAll('#osrsThemeSwitch').length,1);assert.equal(page.querySelector('.group-banner').getAttribute('src'),'img/osrs-theme/united-gimps-cohesive-banner.jpg');assert.equal(page.querySelector('.group-banner').dataset.modernSrc,'img/united-gimps-banner.webp');page.defaultView.close();
 }
 const css=fs.readFileSync('docs/assets/osrs-theme.css','utf8'),assets=JSON.parse(fs.readFileSync('docs/img/osrs-theme/sources.json'));
 for(const asset of assets.assets)assert(fs.existsSync('docs/img/osrs-theme/'+asset.file),asset.file);
 for(const match of css.matchAll(/url\('([^']+)'\)/g))assert(fs.existsSync('docs/assets/'+match[1]),match[1]);
 console.log('Themes: Old School before first paint, deferred Modern palette/portraits, slow and failed loads, cancellation, saved/cross-tab choices, shared data, exact navigation and resource paths passed.');
})().catch(error=>{console.error(error);process.exit(1)});
