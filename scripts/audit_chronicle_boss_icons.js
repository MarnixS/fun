'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {openPage,waitFor}=require('./audit_v25_jsdom');
const source=require('../docs/data/wom-cache.json'),temple=require('../docs/data/temple-clog.json');
const keys=Object.keys(source.profiles.dikste.latestSnapshot.data.bosses);
const fixture=structuredClone(source),first=structuredClone(fixture.profiles.dikste.latestSnapshot),last=structuredClone(first);
first.id=-2001;last.id=-2002;first.createdAt='2099-02-01T00:00:00Z';last.createdAt='2099-02-03T00:00:00Z';
for(const key of [...keys,'future_unknown_boss']){first.data.bosses[key]={kills:1};last.data.bosses[key]={kills:50}}
fixture.snapshots.dikste=[first,last];fixture.profiles.dikste.latestSnapshot=last;
async function run(){
 const {dom,errors}=await openPage('chronicle.html',{selection:['dikste'],womDocument:fixture,sharedDocs:{wom:fixture,temple}});
 const w=dom.window,d=w.document;
 const known=keys.filter(key=>w.UGBossIcons.keys.includes(key)),unknown=keys.filter(key=>!w.UGBossIcons.keys.includes(key));
 try{
  d.querySelector('[data-chrono-size="all"]').click();
  const event=key=>[...d.querySelectorAll(`[data-v21-boss="${key}"]`)].map(button=>button.closest('.chronicle-event')).find(article=>article.querySelector('h4').textContent.includes('50 ')&&article.querySelector('.chronicle-date').textContent.includes('2099'));
  await waitFor(()=>known.every(key=>event(key)?.querySelector('.chronicle-boss-icon')),'NPC icons on every mapped KC crossing',30000);
  for(const key of unknown){assert(event(key),key+' retains its milestone');assert(!event(key).querySelector('.chronicle-boss-icon'),key+' uses the unknown-boss text fallback')}
  for(const key of known){
   const article=event(key),frames=article.querySelectorAll('.chronicle-boss-icon');
   assert.equal(frames.length,1,key+' has one NPC frame');assert.equal(frames[0].dataset.bossKey,key);
   for(const image of frames[0].querySelectorAll('img')){
    assert(image.alt,key+' has an NPC name');assert(image.getAttribute('src').startsWith('img/bosses/'));
    assert(fs.existsSync('docs/'+image.getAttribute('src')),key+' image is saved locally');
   }
   assert(article.querySelector('.chronicle-date').textContent.includes('WOM accuracy ±24h'),'KC timing is retained');
  }
  const npc=key=>[...event(key).querySelectorAll('.chronicle-boss-icon img')].map(image=>image.alt);
  for(const key of ['chambers_of_xeric','chambers_of_xeric_challenge_mode'])assert.deepEqual(npc(key),['Great Olm']);
  for(const key of ['theatre_of_blood','theatre_of_blood_hard_mode'])assert.deepEqual(npc(key),['Verzik Vitur']);
  for(const key of ['tombs_of_amascut','tombs_of_amascut_expert'])assert.deepEqual(npc(key),["Tumeken's Warden"]);
  assert.deepEqual(npc('lunar_chests'),['Eclipse Moon','Blue Moon','Blood Moon']);
  assert.deepEqual(npc('the_royal_titans'),['Eldric the Ice King','Branda the Fire Queen']);
  assert.notEqual(event('the_gauntlet').querySelector('img').getAttribute('src'),event('the_corrupted_gauntlet').querySelector('img').getAttribute('src'));
  assert(event('future_unknown_boss'));assert(!event('future_unknown_boss').querySelector('.chronicle-boss-icon'),'Unknown future bosses retain text without another NPC');
  for(const theme of ['modern','osrs']){await w.UGExperimentalTheme.setEnabled(theme==='osrs');assert.equal(w.UGExperimentalTheme.enabled,theme==='osrs');assert(known.every(key=>event(key).querySelectorAll('.chronicle-boss-icon').length===1))}
  w.UGV21.saveMemberSelection(new Set(['lijpste']));await waitFor(()=>!event('zulrah')||event('zulrah').hidden,'player filter');
  w.UGV21.saveMemberSelection(new Set(['dikste']));await waitFor(()=>event('zulrah')&&!event('zulrah').hidden,'restored player filter');
  d.querySelector('[data-chrono-filter="drops"]').click();await waitFor(()=>!d.querySelector('[data-v21-boss]'),'item filter');assert(!d.querySelector('.chronicle-boss-icon'));
  d.querySelector('[data-chrono-filter="all"]').click();await waitFor(()=>event('zulrah')?.querySelector('.chronicle-boss-icon'),'redraw restores NPC icon');
  const article=event('zulrah'),image=article.querySelector('.chronicle-boss-icon img');image.dispatchEvent(new w.Event('error'));
  assert(image.hidden&&article.querySelector('.chronicle-boss-icon').hidden);assert(article.querySelector('h4').textContent.includes('50 Zulrah KC'));
  assert.equal(errors.length,0,errors.join('; '));
  console.log(`${keys.length} WOM boss NPCs, raid modes, grouped encounters, history, timing, theme/filter redraws, duplicate prevention, unknown metrics and failed-image fallback passed.`);
 }finally{dom.window.close()}
}
run().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1)});
