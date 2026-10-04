'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('docs/assets/v21-nav.js','utf8');
const pages=fs.readdirSync('docs').filter(p=>p.endsWith('.html')&&fs.readFileSync('docs/'+p,'utf8').includes('assets/v21-nav.js'));
for(const file of pages){
 const dom=new JSDOM(fs.readFileSync('docs/'+file,'utf8'),{url:'https://example.com/'+file,runScripts:'outside-only'}),w=dom.window,d=w.document;let resize;
 const media={matches:true,addEventListener(type,fn){assert.equal(type,'change');resize=fn}};w.matchMedia=()=>media;Object.defineProperty(d,'readyState',{value:'interactive'});w.eval(source);
 const nav=d.querySelector('.nav-inner'),logs=d.querySelector('[aria-controls="nav-logs"]'),levels=d.querySelector('[aria-controls="nav-levels"]');
 assert(!d.querySelector('.mobile-menu-toggle'),file);assert.equal(nav.querySelectorAll('.nav-trigger').length,4);assert.equal(nav.querySelector('[aria-controls="nav-other"] span:nth-child(2)').textContent,'Other');assert(d.querySelector('#nav-other a[href="faq.html"]'));assert(d.querySelector('#nav-other a[href="news.html"]'));assert(d.querySelector('#nav-other a[href="experimental.html"] .nav-badge'));assert(!d.querySelector('#nav-record a[href="group-chemistry.html"]'));assert(d.querySelector('#nav-levels a[href="cumulative-xp.html"]'));assert(!d.querySelector('#nav-record a[href="nemesis-beta.html"]'));assert(!d.querySelector('#nav-record a[href="nemesis.html"]'));assert(!nav.querySelector(':scope > a[href="faq.html"]'));logs.click();assert.equal(d.querySelector('#nav-logs').hidden,false);
 // Changing focus must not collapse a flowing menu before the second tap finishes.
 logs.parentElement.dispatchEvent(new w.FocusEvent('focusout',{bubbles:true,relatedTarget:levels}));assert.equal(d.querySelector('#nav-logs').hidden,false);levels.click();assert(d.querySelector('#nav-logs').hidden);assert.equal(d.querySelector('#nav-levels').hidden,false);assert.equal(d.querySelectorAll('.nav-dropdown-panel:not([hidden])').length,1);
 levels.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(d.querySelector('#nav-levels').hidden);assert.equal(d.activeElement,levels);
 logs.click();d.querySelector('main').click();assert(d.querySelector('#nav-logs').hidden);assert(nav.contains(logs));
 logs.click();media.matches=false;resize();assert(d.querySelector('#nav-logs').hidden);levels.blur();
 const hover=new w.Event('pointerenter');hover.pointerType='mouse';levels.parentElement.dispatchEvent(hover);assert.equal(d.querySelector('#nav-levels').hidden,false);
 const leave=new w.Event('pointerleave');leave.pointerType='mouse';levels.parentElement.dispatchEvent(leave);assert(d.querySelector('#nav-levels').hidden);
 if(file==='gim.html'){assert(d.querySelector('#clogView'));d.dispatchEvent(new w.CustomEvent('ug:gim-view-changed',{detail:{view:'categories'}}));assert.equal(d.querySelector('#clogView').value,'categories')}
 if(file==='cumulative-xp.html'){assert(levels.classList.contains('active'));assert(!d.querySelector('.experimental-breadcrumb'));assert(d.querySelector('#nav-levels a[href="cumulative-xp.html"]').classList.contains('active'))}if(['nemesis.html','nemesis-beta.html'].includes(file)){assert(d.querySelector('[aria-controls="nav-other"]').classList.contains('active'));assert(d.querySelector('.experimental-breadcrumb a[href="experimental.html"]'));assert(!d.querySelector('#historyLocalNav'))}if(file==='experimental.html'){assert(d.querySelector('.experimental-card a[href="nemesis.html"]'));assert(!d.querySelector('.experimental-card a[href="cumulative-xp.html"]'))}if(['cumulative-xp.html','hiscores.html','progress.html','time-machine.html'].includes(file))assert(!d.querySelector('#historyLocalNav'),file);if(['chronicle.html','history.html','goals.html','kc-comparison.html'].includes(file))assert(!d.querySelector('#historyLocalNav'),file);
 dom.window.close();
}
console.log('Navigation on '+pages.length+' pages passed: always-available mobile categories and single open group, touch focus timing, Escape/outside dismissal, resize, desktop hover and view selectors.');
