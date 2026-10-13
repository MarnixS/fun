'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('docs/assets/banner-roster.js','utf8'),key='ug-v25-member-selection',order=['poep aura','dikste','big dog aura','lijpste','lompste'];
function open(saved,denied=false){
 const dom=new JSDOM(fs.readFileSync('docs/index.html','utf8'),{url:'https://example.com/index.html',runScripts:'outside-only'}),w=dom.window;
 if(saved!==undefined)w.localStorage.setItem(key,typeof saved==='string'?saved:JSON.stringify(saved));
 if(denied)Object.defineProperty(w,'localStorage',{get(){throw Error('Blocked storage')}});
 w.eval(source);return {dom,w,d:w.document};
}
function check(page,selected){
 assert.equal(page.d.documentElement.dataset.bannerMembers,String(selected.length));
 for(const name of order){const expected=selected.includes(name)?'1':'.22';assert.equal(page.d.documentElement.style.getPropertyValue('--banner-'+name.replace(/ /g,'-')+'-opacity'),expected);}
}
for(const value of [undefined,'invalid JSON',[],['unknown'],{keys:7},true]){const p=open(value);check(p,order);p.dom.window.close()}
const blocked=open(undefined,true);check(blocked,order);blocked.dom.window.close();
const p=open(['dikste','big dog aura']);check(p,['dikste','big dog aura']);
assert.deepEqual([...p.d.querySelectorAll('[data-banner-player]')].map(el=>el.dataset.bannerPlayer),order);
for(const pair of p.d.querySelectorAll('[data-banner-player]')){assert.equal(pair.querySelectorAll('.osrs-banner-model').length,1);assert.equal(pair.querySelectorAll('.osrs-banner-pet').length,1);assert.equal(pair.getAttribute('aria-hidden'),'true');}
p.w.localStorage.setItem(key,JSON.stringify(['lompste']));p.w.dispatchEvent(new p.w.CustomEvent('ug:members-changed',{detail:{keys:['lompste']}}));check(p,['lompste']);
assert.equal(p.d.querySelector('[data-banner-player="lompste"]').dataset.bannerSelected,'true');assert.equal(p.d.querySelector('[data-banner-player="dikste"]').dataset.bannerSelected,'false');
const fresh=open(JSON.parse(p.w.localStorage.getItem(key)));check(fresh,['lompste']);fresh.dom.window.close();
p.w.dispatchEvent(new p.w.CustomEvent('ug:display-members',{detail:{keys:['lijpste']}}));check(p,['lijpste']);assert.deepEqual(JSON.parse(p.w.localStorage.getItem(key)),['lompste'],'a linked metric does not rewrite the saved filter');
p.w.dispatchEvent(new p.w.StorageEvent('storage',{key,newValue:JSON.stringify(['poep aura','lijpste'])}));check(p,['poep aura','lijpste']);
p.w.dispatchEvent(new p.w.StorageEvent('storage',{key:null}));check(p,order);p.dom.window.close();
for(const file of fs.readdirSync('docs').filter(f=>f.endsWith('.html'))){
 const text=fs.readFileSync('docs/'+file,'utf8'),dom=new JSDOM(text),d=dom.window.document;
 assert.deepEqual([...d.querySelectorAll('[data-banner-player]')].map(el=>el.dataset.bannerPlayer),order,file);
 assert(text.indexOf('assets/banner-roster.js')<text.indexOf('<body'),file+': saved selection applied before body paint');
 assert.equal(d.querySelectorAll('.group-banner').length,1);assert.equal(d.querySelector('.group-banner').dataset.modernSrc,'img/united-gimps-banner.webp');dom.window.close();
}
const layout=JSON.parse(fs.readFileSync('site/banner-layout.json')),hash=crypto.createHash('sha256').update(fs.readFileSync(layout.asset)).digest('hex');assert.equal(hash,layout.asset_sha256,'the approved bitmap remains byte-for-byte unchanged');
assert.deepEqual(layout.order,order);assert.equal(layout.objects.length,10);assert(layout.objects.every(x=>x.polygon.length>3));
console.log('Banner order, character/pet pairs, default/saved/live/cross-tab selection, transient linked filters, storage fallback, early paint and unchanged artwork passed.');
