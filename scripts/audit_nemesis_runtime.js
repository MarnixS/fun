'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {openPage,waitFor,click}=require('./audit_v25_jsdom');

(async()=>{
  const wom=JSON.parse(fs.readFileSync('docs/data/wom-cache.json','utf8'));
  const temple=JSON.parse(fs.readFileSync('docs/data/temple-clog.json','utf8'));
  const directTempleResponse=(url,options,jsonResponse)=>{
    const parsed=new URL(url);
    const key=(parsed.searchParams.get('player')||'').toLowerCase();
    if(!temple.players[key])return jsonResponse({error:'No Temple sync'},404);
    if(parsed.pathname.endsWith('/player_stats.php')){
      return jsonResponse({data:{Player:key}});
    }
    if(parsed.pathname.endsWith('/player_collection_log.php')){
      return jsonResponse(temple.players[key]);
    }
    return jsonResponse({error:'not configured'},404);
  };

  const {dom,errors}=await openPage('nemesis.html',{
    womDocument:wom,
    templeDocument:temple,
    womResponse:wom,
    savedTemple:temple,
    directTempleResponse,
  });
  const {window}=dom,{document}=window;
  await waitFor(()=>document.querySelector('#nemesisMemberPicker fieldset'),'Nemesis member picker');

  const input=document.querySelector('#nemesisName');
  input.value='Dikste';
  document.querySelector('#nemesisLookupForm').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));

  await waitFor(()=>document.querySelectorAll('.nem-external-member').length===1,'external Nemesis account');
  await waitFor(()=>!document.querySelector('#nemesisResults').hidden,'Nemesis results');
  assert.match(document.querySelector('#nemesisResultTitle').textContent,/External group \(1\) vs United Gimps/);

  click(window,document.querySelector('[data-nem-mode="current"]'));
  click(window,document.querySelector('[data-nem-view="bars"]'));
  await waitFor(()=>document.querySelector('#nemesisCompareChart svg'),'Nemesis current bar chart');
  assert.equal(document.querySelector('#nemesisMetric').value,'total_xp');

  click(window,document.querySelector('[data-nem-view="share"]'));
  await waitFor(()=>document.querySelector('[data-nem-share-external] svg')&&document.querySelector('[data-nem-share-united] svg'),'Nemesis share pies');

  await waitFor(()=>document.querySelector('[data-nem-clog-pie] svg'),'Nemesis Collection Log composition pie');

  const skill=document.querySelector('#nemesisSkills [data-nem-skill]');
  assert(skill,'Nemesis skills expose graph links');
  click(window,skill);
  assert.equal(document.querySelector('#nemesisMetric').value,'skill');

  click(window,document.querySelector('[data-nem-view="timeline"]'));
  click(window,document.querySelector('[data-nem-mode="gain"]'));
  click(window,document.querySelector('[data-nem-period="30"]'));
  await waitFor(()=>document.querySelector('[data-nem-period="30"]').classList.contains('active'),'Nemesis 1M range');
  assert.match(document.querySelector('#nemesisProgressStatus').textContent,/1 month/);

  click(window,document.querySelector('[data-nem-period="all"]'));
  await waitFor(()=>document.querySelector('#nemesisProgressStatus').textContent.includes('All history'),'Nemesis all-history range');

  const timeDate=document.querySelector('#nemesisTimeDate');
  timeDate.value='2026-01-01';
  click(window,document.querySelector('#nemesisTimeGo'));
  await waitFor(()=>document.querySelector('#nemesisTimeTable tr')&&!document.querySelector('#nemesisTimeGo').disabled,'Nemesis historical comparison');
  assert.match(document.querySelector('#nemesisTimeStatus').textContent,/2026/);
  click(window,document.querySelector('[data-nem-time-preset="6m"]'));
  await waitFor(()=>!document.querySelector('#nemesisTimeGo').disabled,'Nemesis time preset');
  assert.equal(timeDate.value.length,10);
  async function add(name,count){input.value=name;document.querySelector('#nemesisLookupForm').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>document.querySelectorAll('.nem-external-member').length===count&&!document.querySelector('#nemesisGo').disabled,'external account '+name)}
  await add('Big Dog Aura',2);
  assert.match(document.querySelector('#nemesisResultTitle').textContent,/External group \(2\)/);
  await add('No sync fixture',3);
  assert.match(document.querySelector('.nem-external-member:last-child').textContent,/unavailable|missing|not found|no sync/i);
  await add('Dikste',3);assert.match(document.querySelector('#nemesisLookupNote').textContent,/already/);
  click(window,document.querySelector('.nem-external-member:last-child [data-remove-external]'));
  assert.equal(document.querySelectorAll('.nem-external-member').length,2);
  click(window,document.querySelector('#nemesisClear'));assert(document.querySelector('#nemesisResults').hidden);
  assert.equal(errors.length,0,errors.join('; '));
  console.log('Nemesis runtime audit passed: add account, current bars, share pies, Collection Log pie, metric links, dates/presets, multiple accounts, missing sources, duplicate detection and removal.');
})().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1)});
