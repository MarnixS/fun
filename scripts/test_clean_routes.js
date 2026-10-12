'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const router=fs.readFileSync('docs/assets/site-routes.js','utf8'),nav=fs.readFileSync('docs/assets/v21-nav.js','utf8');
const pages=fs.readdirSync('site/pages').filter(n=>n.endsWith('.html'));
(async()=>{
 for(const name of pages){
  const slug=name==='index.html'?'':name.replace(/\.html$/,'');
  const dom=new JSDOM(fs.readFileSync(name,'utf8'),{url:'https://ugimps.com/'+slug,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;w.eval(router);w.eval(nav);
  await new Promise(resolve=>w.setTimeout(resolve,30));
  assert.equal(w.location.pathname,slug?'/'+slug:'/');assert.equal(w.UGRoutes.enabled,true);
  assert.equal(d.querySelector('link[rel=canonical]').href,'https://ugimps.com/'+slug);
  assert.equal(d.querySelector('link[rel=icon][type="image/png"]').getAttribute('href'),'/favicon.png');
  assert(d.querySelectorAll('.nav-link').length>10,'real navigation renders at the clean URL');
  const xp=d.querySelector('.mast-stat-xp');if(xp){assert.equal(xp.getAttribute('href'),'/cumulative-xp');assert.equal(xp.dataset.ugSection,'cumulativeSummary')}
  for(const a of d.querySelectorAll('a[href]')){
   const u=new URL(a.href);if(u.origin!==w.location.origin||!w.UGRoutes.file(u.href))continue;
   assert(!u.pathname.includes('/docs/')&&!u.pathname.endsWith('.html'),name+': '+a.getAttribute('href'));
  }
  if(['cumulative-xp','chronicle','progress','gim','index','collection-log','xp-records'].includes(slug||'index')){
   const active=[...d.querySelectorAll('.nav-link[aria-current=page]')];assert.equal(active.length,1);assert.equal(new URL(active[0].href).pathname,slug?'/'+slug:'/');
  }
  const R=w.UGRoutes;
  assert.equal(R.href('/docs/cumulative-xp.html#cumulativeSummary'),'/cumulative-xp');
  assert.equal(R.href('progress.html?period=7#gainCards'),'/progress?period=7');
  assert.equal(R.href('gim.html#value'),'/gim#value');assert.equal(R.href('#value'),(slug?'/'+slug:'/')+'#value');
  assert.equal(R.href('nemesis-beta.html?team=dikste#comparison'),'/nemesis?team=dikste#comparison');
  assert.equal(R.href('/docs/clog-beta.html?category=barrows#items'),'/collection-log?category=barrows#items');
  assert.equal(R.file('clog-beta.html'),'collection-log.html');
  assert.equal(d.querySelector('#nav-logs a[href="/collection-log"] .nav-badge'),null);
  assert(!d.querySelector('#nav-logs').textContent.toLowerCase().includes('beta'));
  assert(d.querySelector('#nav-record a[href="/xp-records"]'));
  if(slug==='collection-log')assert(!d.querySelector('.beta-tag'));
  assert.equal(R.href('https://example.com/docs/gim.html'),'https://example.com/docs/gim.html');
  const link=d.createElement('a');link.href='chronicle.html?player=lijpste';d.body.append(link);
  await new Promise(resolve=>w.setTimeout(resolve,0));assert.equal(link.getAttribute('href'),'/chronicle?player=lijpste');
  console.log('Clean public page:',w.location.pathname);w.close();
 }
 for(const [filename,size] of [['favicon.png',96],['apple-touch-icon.png',180]]){const png=fs.readFileSync(filename);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size)}
 const ico=fs.readFileSync('favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
 const sitemap=fs.readFileSync('sitemap.xml','utf8');assert(!sitemap.includes('/docs/')&&!sitemap.includes('.html')&&!sitemap.includes('/developer'));
 assert(fs.readFileSync('robots.txt','utf8').includes('Allow: /'));assert(sitemap.includes('/collection-log')&&sitemap.includes('/xp-records')&&!sitemap.includes('/clog-beta'));
 console.log('Clean URLs, dynamic navigation, active menus, summary targets, preserved tab/filter state, aliases, favicon sizes and sitemap passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
