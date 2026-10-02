'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('docs/assets/v21-nav.js','utf8');
const pages=fs.readdirSync('docs').filter(p=>p.endsWith('.html')&&fs.readFileSync('docs/'+p,'utf8').includes('assets/v21-nav.js'));
for(const file of pages){
 const dom=new JSDOM(fs.readFileSync('docs/'+file,'utf8'),{url:'https://example.com/'+file,runScripts:'outside-only'}),w=dom.window,d=w.document;let resize;
 const media={matches:true,addEventListener(type,fn){assert.equal(type,'change');resize=fn}};w.matchMedia=()=>media;Object.defineProperty(d,'readyState',{value:'interactive'});w.eval(source);
 const menu=d.querySelector('.mobile-menu-toggle'),nav=d.querySelector('.nav-inner'),logs=d.querySelector('[aria-controls="nav-logs"]'),levels=d.querySelector('[aria-controls="nav-levels"]');
 assert(menu,file);assert.equal(menu.getAttribute('aria-expanded'),'false');menu.click();assert(nav.classList.contains('mobile-open'));logs.click();assert.equal(d.querySelector('#nav-logs').hidden,false);
 // Changing focus must not collapse a flowing menu before the second tap finishes.
 logs.parentElement.dispatchEvent(new w.FocusEvent('focusout',{bubbles:true,relatedTarget:levels}));assert.equal(d.querySelector('#nav-logs').hidden,false);levels.click();assert(d.querySelector('#nav-logs').hidden);assert.equal(d.querySelector('#nav-levels').hidden,false);assert.equal(d.querySelectorAll('.nav-dropdown-panel:not([hidden])').length,1);
 levels.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(menu.getAttribute('aria-expanded'),'false');assert(!nav.classList.contains('mobile-open'));assert.equal(d.activeElement,menu);
 menu.click();logs.click();d.querySelector('main').click();assert.equal(menu.getAttribute('aria-expanded'),'false');assert(d.querySelector('#nav-logs').hidden);
 menu.click();logs.click();media.matches=false;resize();assert(!nav.classList.contains('mobile-open'));assert(d.querySelector('#nav-logs').hidden);
 const hover=new w.Event('pointerenter');hover.pointerType='mouse';levels.parentElement.dispatchEvent(hover);assert.equal(d.querySelector('#nav-levels').hidden,false);
 const leave=new w.Event('pointerleave');leave.pointerType='mouse';levels.parentElement.dispatchEvent(leave);assert(d.querySelector('#nav-levels').hidden);
 if(file==='gim.html'){assert(d.querySelector('#clogView'));d.dispatchEvent(new w.CustomEvent('ug:gim-view-changed',{detail:{view:'categories'}}));assert.equal(d.querySelector('#clogView').value,'categories')}
 if(['cumulative-xp.html','hiscores.html','progress.html','time-machine.html','chronicle.html','history.html','goals.html'].includes(file))assert(d.querySelector('#historyLocalNav .mobile-view-picker select'),file);
 dom.window.close();
}
console.log('Navigation on '+pages.length+' pages passed: single mobile menu/group, touch focus timing, Escape/outside dismissal, resize, desktop hover and view selectors.');
