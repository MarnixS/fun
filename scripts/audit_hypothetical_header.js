'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const server=http.createServer((req,res)=>{const file=path.join(process.cwd(),'docs',new URL(req.url,'http://localhost').pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
server.listen(0,'127.0.0.1',async()=>{const doms=[];try{
 process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;const {openPage,waitFor}=require('./audit_v25_jsdom'),key='ug-hypothetical-log-v1';
 const priceData={13263:{high:30000000,low:30000000},20997:{high:1000000000,low:1000000000}},seed={kc:{CHAMBERS_OF_XERIC_COMPLETIONS:37},drops:{CHAMBERS_OF_XERIC_COMPLETIONS:{20997:7}},history:[],raidSettings:{},lastRoll:null};
 const summary=d=>[...d.querySelectorAll('.mast-status>.mast-stat')].map(card=>card.textContent.replace(/\s+/g,' ').trim());
 const home=await openPage('index.html',{priceData,selection:['dikste']});doms.push(home.dom);await waitFor(()=>home.dom.window.document.querySelector('.mast-value-pie'),'real overview');const expected=summary(home.dom.window.document);
 const log=[];const hypo=await openPage('hypothetical.html',{priceData,selection:['dikste'],localState:{[key]:seed},fetchLog:log});doms.push(hypo.dom);const w=hypo.dom.window,d=w.document;
 await waitFor(()=>d.querySelector('.mast-value-pie')&&d.querySelector('#hypoSource option'),'real header and local simulation');
 assert.equal(d.querySelectorAll('.mast-status>.mast-stat').length,6);assert.deepEqual(summary(d),expected);assert.equal(JSON.parse(w.localStorage.getItem(key)).drops.CHAMBERS_OF_XERIC_COMPLETIONS['20997'],7);
 d.querySelector('#hypoSource').value='CHAMBERS_OF_XERIC_COMPLETIONS';d.querySelector('#hypoSource').dispatchEvent(new w.Event('change'));w.crypto.getRandomValues=buffer=>buffer.fill(0);d.querySelector('#hypoAmount').value=5;d.querySelector('#hypoRoll').click();
 const saved=w.localStorage.getItem(key);assert.equal(JSON.parse(saved).kc.CHAMBERS_OF_XERIC_COMPLETIONS,42);assert.deepEqual(summary(d),expected);
 const reopened=await openPage('hypothetical.html',{priceData,localState:{[key]:saved}});doms.push(reopened.dom);await waitFor(()=>reopened.dom.window.document.querySelector('.mast-value-pie')&&reopened.dom.window.document.querySelector('#hypoSource option'),'reopened simulation');assert.deepEqual(summary(reopened.dom.window.document),expected);assert.equal(JSON.parse(reopened.dom.window.localStorage.getItem(key)).kc.CHAMBERS_OF_XERIC_COMPLETIONS,42);assert(reopened.dom.window.document.querySelector('#hypoKpis').textContent.includes('42'));
 await w.UGExperimentalTheme.setEnabled(true);assert.deepEqual(summary(d),expected);assert.equal(w.localStorage.getItem(key),saved);await w.UGExperimentalTheme.setEnabled(false);assert.deepEqual(summary(d),expected);assert.equal(w.localStorage.getItem(key),saved);
 assert(!log.some(r=>r.method==='POST'||r.url.startsWith('https://api.wiseoldman.net/')||r.url.startsWith('https://templeosrs.com/')),'header must read saved snapshots only');
 assert.equal(hypo.errors.length,0,hypo.errors.join('; '));assert.equal(reopened.errors.length,0,reopened.errors.join('; '));
 console.log('Hypothetical Log: six real header cards match Overview, fake drops never affect them, local rolls survive reopening, shared member filter/theme stay independent, no WOM/Temple refresh.');doms.forEach(dom=>dom.window.close());server.close();process.exit(0);
}catch(e){console.error(e);doms.forEach(dom=>dom.window.close());server.close();process.exit(1)}});
