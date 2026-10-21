'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const server=http.createServer((req,res)=>{try{const filename=path.join(process.cwd(),'docs',new URL(req.url,'http://localhost').pathname);res.setHeader('Connection','close');res.setHeader('Content-Type',filename.endsWith('.js')?'application/javascript':filename.endsWith('.json')?'application/json':filename.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(filename))}catch{res.statusCode=404;res.end()}});
server.listen(0,'127.0.0.1',async()=>{let dom;try{
 process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;const {openPage,waitFor}=require('./audit_v25_jsdom'),requests=[];
 const page=await openPage('time-machine.html',{selection:['big dog aura'],fetchLog:requests});dom=page.dom;const w=dom.window,d=w.document;
 await waitFor(()=>d.querySelector('#historicalSourceNote summary')?.textContent.includes('6 dates'),'shared historical source notice');
 assert.equal(d.querySelectorAll('#historicalSourceNote li').length,6);assert(d.querySelector('#historicalSourceNote').textContent.includes('minimum required'));assert(d.querySelector('#historicalSourceNote').textContent.includes('12 levels'));
 const doc=await w.UGV21.loadWom(),photos=doc.snapshots['big dog aura'].filter(row=>row.provenance?.kind==='historical-screenshot');
 for(const row of photos){
  d.querySelector('#timeDate').value=row.createdAt.slice(0,10);d.querySelector('#timeGo').click();
  await waitFor(()=>!d.querySelector('#timeGo').disabled&&d.querySelector('#timeCore .snap-date')?.textContent.includes('Historical skill entry'),'screenshot checkpoint');
  const card=d.querySelector('#timeCore .time-card');assert(card.textContent.includes('Big Dog Aura'));assert(card.querySelector('.snap-date').textContent.includes('time unknown'));
  assert.equal(card.querySelector('.time-metric b').textContent,row.data.skills.overall.level.toLocaleString('en-GB'));
  assert.deepEqual([...card.querySelectorAll('.time-metric b')].slice(2).map(node=>node.textContent),['—','—'],'unknown EHP/EHB are not zeroes');
  assert.equal(d.querySelectorAll('#timeSkills tbody tr').length,23);assert(!d.querySelector('#timeSkills [data-v21-skill="sailing"]'));
  assert.equal(d.querySelectorAll('#timeBosses tbody tr').length,0,'no boss kills were imported from the screenshots');
 }
 assert.equal(page.errors.length,0,page.errors.join('; '));assert(!requests.some(row=>row.method==='POST'||row.url.includes('api.wiseoldman.net')),'historical browsing uses the saved shared baseline');
 console.log('Historical UI passed: all six dates in Time Machine, common source disclosure, exact total levels, inherited-skill uncertainty, day precision, unknown EHP/KC and no upstream updates.');
 dom.window.close();server.close();process.exit(0);
}catch(error){console.error(error);dom?.window.close();server.close();process.exit(1)}});
