'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const server=http.createServer((req,res)=>{try{const filename=path.join(process.cwd(),'docs',new URL(req.url,'http://localhost').pathname);res.setHeader('Connection','close');res.setHeader('Content-Type',filename.endsWith('.js')?'application/javascript':filename.endsWith('.json')?'application/json':filename.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(filename))}catch{res.statusCode=404;res.end()}});
server.listen(0,'127.0.0.1',async()=>{let dom;try{
 process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;const {openPage,waitFor}=require('./audit_v25_jsdom'),requests=[];
 const page=await openPage('time-machine.html',{selection:['big dog aura'],fetchLog:requests});dom=page.dom;const w=dom.window,d=w.document;
 await waitFor(()=>d.querySelector('#historicalSourceNote summary')?.textContent.includes('7 dates'),'shared historical source notice');
 assert.equal(d.querySelectorAll('#historicalSourceNote li').length,7);assert(d.querySelector('#historicalSourceNote').textContent.includes('minimum required'));assert(d.querySelector('#historicalSourceNote').textContent.includes('12 levels'));
 const doc=await w.UGV21.loadWom(),photos=doc.snapshots['big dog aura'].filter(row=>row.provenance?.kind==='historical-screenshot');
 for(const row of photos){
  d.querySelector('#timeDate').value=row.createdAt.slice(0,10);d.querySelector('#timeGo').click();
  await waitFor(()=>!d.querySelector('#timeGo').disabled&&d.querySelector('#timeCore .snap-date')?.textContent.includes('Historical skill entry'),'screenshot checkpoint');
  const card=d.querySelector('#timeCore .time-card');assert(card.textContent.includes('Big Dog Aura'));assert(card.querySelector('.snap-date').textContent.includes('time unknown'));
  assert.equal(card.querySelector('.time-metric b').textContent,row.data.skills.overall.level.toLocaleString('en-GB'));
  assert.deepEqual([...card.querySelectorAll('.time-metric b')].slice(2).map(node=>node.textContent),['—','—'],'unknown EHP/EHB are not zeroes');
  assert.equal(d.querySelectorAll('#timeSkills tbody tr').length,23);assert(!d.querySelector('#timeSkills [data-v21-skill="sailing"]'));
  assert.equal(d.querySelectorAll('#timeBosses tbody tr').length,0,'no boss kills were imported from the screenshots');
  for(const skill of row.provenance.assumedSkills)assert(d.querySelector(`#timeSkills [data-v21-skill="${skill}"]`).closest('tr').textContent.includes('Assumed · last known 05 May 2023'),'inherited values expose their actual source date');
 }
 assert.equal(page.errors.length,0,page.errors.join('; '));assert(!requests.some(row=>row.method==='POST'||row.url.includes('api.wiseoldman.net')),'historical browsing uses the saved shared baseline');
 dom.window.close();
 // Hidden skill panels must neither erase later level-ups nor move their
 // earliest possible date to an assumed, rather than observed, level.
 const fixture=structuredClone(doc),key='big dog aura',firstReal=fixture.snapshots[key].find(row=>!row.provenance&&Date.parse(row.createdAt)>Date.parse('2024-07-16'));
 fixture.snapshots[key]=[...photos.slice(3),firstReal];fixture.profiles[key].latestSnapshot=firstReal;fixture.achievements[key]=[];
 const chronicle=await openPage('chronicle.html',{selection:[key],deployedDocs:{wom:fixture}});dom=chronicle.dom;
 const c=dom.window.document;c.querySelector('[data-chrono-size="all"]').click();
 await waitFor(()=>c.querySelector('[data-event-type="level"][data-metric="prayer"][data-level="75"]'),'level-ups across obscured screenshots');
 for(const [skill,level] of [['prayer',75],['fletching',67],['woodcutting',67]]){
  const event=c.querySelector(`[data-event-type="level"][data-metric="${skill}"][data-level="${level}"]`);
  assert(event,'known level crossing retained for '+skill);assert.match(event.querySelector('.chronicle-date').textContent,/05 May 2023 →/,'last observed level anchors the full possible interval');
  assert(event.textContent.includes('exact time unknown'));assert(event.textContent.includes('historical observations'));assert(!event.textContent.includes('via WOM'));
 }
 assert.equal(chronicle.errors.length,0,chronicle.errors.join('; '));
 dom.window.close();
 // Stat Progress must consume screenshot checkpoints through its normal model
 // and UI, rather than relying on the Time Machine's separate rendering.
 const pair=photos.filter(row=>['2023-04-25','2023-05-04'].includes(row.createdAt.slice(0,10))),history={profiles:{[key]:{...doc.profiles[key],latestSnapshot:pair.at(-1)}},snapshots:{[key]:pair},gains:{},achievements:{}};
 const progress=await openPage('progress.html?type=skill-xp&metric=crafting&period=30',{selection:[key],deployedDocs:{wom:history}});dom=progress.dom;
 const pd=dom.window.document,expected=require('../docs/assets/stat-progress-model').build(history,[key]).compare('xp','crafting',30,[key],'recent').rows[0];
 assert.equal(expected.start,Date.parse('2023-04-25'));assert.equal(expected.end,Date.parse('2023-05-04'));assert(expected.gain>0);
 assert.equal(pd.querySelector('[data-progress-player="big dog aura"] .records-gain b').textContent,'+'+expected.gain.toLocaleString('en-GB'));assert.match(pd.querySelector('#progressCoverage').textContent,/25 Apr 2023 → 4 May 2023/);assert.equal(progress.errors.length,0,progress.errors.join('; '));
 console.log('Historical UI passed: all seven Time Machine dates, source disclosure, known totals, inherited uncertainty, no invented EHP/KC or upstream updates, and Chronicle level-ups across obscured screenshots with honest date intervals; screenshot-only Stat Progress gains.');
 dom.window.close();server.close();process.exit(0);
}catch(error){console.error(error);dom?.window.close();server.close();process.exit(1)}});
