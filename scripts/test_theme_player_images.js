'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('<div class="mast"><div class="banner-frame"><img class="group-banner" src="original-banner.webp" width="1200" height="265" alt="Original banner"></div></div><main></main>',{url:'https://example.com/index.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 const keys=['Dikste','Big Dog Aura','Lijpste','Poep Aura','Lompste'];
 for(const [i,name] of keys.entries()){const image=d.createElement('img');image.className='player-portrait';image.src=`original-${i}.png`;image.alt=name;image.setAttribute('srcset',`original-${i}-2x.png 2x`);d.querySelector('main').append(image)}
 d.querySelector('main').insertAdjacentHTML('beforeend','<article data-goal-player="dikste"><div class="goal-head"><img src="original-goal.png" alt=""></div></article><img class="skill-icon" src="skill.png" alt="Dikste">');
 Object.defineProperty(d,'readyState',{value:'interactive'});w.eval(fs.readFileSync('docs/assets/experimental-theme.js','utf8'));
 const original=d.querySelector('main').innerHTML,banner=d.querySelector('.group-banner').outerHTML;
 assert.equal(d.querySelector('main').innerHTML,original,'off leaves image attributes intact');
 w.UGExperimentalTheme.setEnabled(true);
 assert.equal(d.querySelectorAll('[data-osrs-player]').length,6);assert.equal(d.querySelector('.skill-icon').getAttribute('src'),'skill.png');
 for(const image of d.querySelectorAll('[data-osrs-player]')){assert(image.src.includes('/img/osrs-theme/players/'));assert.equal(image.getAttribute('srcset'),null)}
 assert(d.querySelector('.group-banner').src.endsWith('united-gimps-plain-banner.webp'));
 w.UGExperimentalTheme.setEnabled(false);assert.equal(d.querySelector('main').innerHTML,original);assert.equal(d.querySelector('.group-banner').outerHTML,banner);
 w.UGExperimentalTheme.setEnabled(true);
 const fresh=d.createElement('img');fresh.className='mast-player-avatar';fresh.src='refreshed-player.png';fresh.alt='Lijpste';d.body.append(fresh);
 await new Promise(resolve=>w.setTimeout(resolve,0));assert(fresh.src.endsWith('/players/lijpste.png'),'late rendering uses original player appearance');
 fresh.src='new-snapshot-player.png';fresh.alt='Dikste';await new Promise(resolve=>w.setTimeout(resolve,0));assert(fresh.src.endsWith('/players/dikste.png'),'updated player uses correct original screenshot');
 w.UGExperimentalTheme.setEnabled(false);assert.equal(fresh.getAttribute('src'),'new-snapshot-player.png');assert.equal(fresh.alt,'Dikste');
 for(const image of JSON.parse(fs.readFileSync('docs/img/osrs-theme/players/sources.json')).images){const data=fs.readFileSync('docs/img/osrs-theme/players/'+image.file);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),image.sha256,'original upload is byte-identical')}
 dom.window.close();console.log('Theme portraits: all five original uploads, lazy opt-in, dynamic renders, goal/avatar matching, untouched skill icons, exact image/banner restoration and original upload hashes passed.');
})().catch(e=>{console.error(e);process.exit(1)});
