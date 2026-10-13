'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {openPage,waitFor}=require('./audit_v25_jsdom'),{validate}=require('../api/player-goals');
const wom=require('../docs/data/wom-cache.json');
async function run(){
 const pages=[],posts=[],document={goals:{}};let fail=false;
 const goalResponse=(options,json)=>{
  if(options?.method==='POST'){
   const body=JSON.parse(options.body);assert.equal(body.code,'test-code');
   if(fail)return json({error:'Test publishing failure'},502);
   const goal=validate(body);posts.push(body);document.goals[body.player]={...goal,updatedAt:new Date(1900000000000+posts.length*60000).toISOString()};
  }
  return json({...document,enabled:true});
 };
 const page=await openPage('goals.html',{goalResponse});pages.push(page.dom);const w=page.dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 await waitFor(()=>d.querySelector('#chooseSharedGoal:not([disabled])'),'any-goal chooser');
 const chooser=d.querySelector('#goalChoiceForm'),field=name=>chooser.elements.namedItem(name),change=input=>input.dispatchEvent(new w.Event('change',{bubbles:true})),input=control=>control.dispatchEvent(new w.Event('input',{bubbles:true}));
 const set=(player,kind,metric,target,text,current)=>{
  field('player').value=player;change(field('player'));field('kind').value=kind;change(field('kind'));
  if(['level','xp','boss'].includes(kind)){field('metric').value=metric;change(field('metric'))}
  if(kind==='item'){field('item').value=metric;input(field('item'))}
  if(target!=null){field('targetValue').value=String(target);input(field('targetValue'))}
  if(current!=null){field('current').value=String(current);input(field('current'))}
  if(text){field('text').value=text;input(field('text'))}
 };
 async function publish(){
  chooser.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  const form=d.querySelector('#sharedGoalDialog form');assert(form,'valid target opens the protected shared editor');form.elements.namedItem('code').value='test-code';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await waitFor(()=>!d.querySelector('#sharedGoalDialog'),'shared publication');return posts.at(-1);
 }
 set('dikste','level','farming',99);assert.equal(field('targetValue').max,'99');assert.equal(field('text').value,'Reach 99 Farming');
 const skillKeys=new Set(Object.keys(wom.profiles.dikste.latestSnapshot.data.skills));assert.deepEqual(new Set([...field('metric').options].map(x=>x.value)),skillKeys,'every tracked skill and total is selectable');
 let post=await publish();assert.equal(post.kind,'level');assert.equal(post.metric,'farming');assert.equal(post.targetValue,99);
 let link=d.querySelector('#goal-dikste .goal-stats-link');let linkedStats=new URL(link.href);assert.equal(linkedStats.searchParams.get('kind'),'level');assert.equal(linkedStats.searchParams.get('player'),'dikste');assert.equal(linkedStats.searchParams.get('metric'),'farming');
 set('poep aura','boss','zulrah',250);const bossKeys=new Set(Object.keys(wom.profiles.dikste.latestSnapshot.data.bosses));assert.deepEqual(new Set([...field('metric').options].map(x=>x.value)),bossKeys,'all bosses, including zero and unranked, are selectable');
 post=await publish();assert.equal(post.kind,'boss');assert.equal(post.targetValue,250);const bossLink=new URL(d.querySelector('#goal-poep-aura .goal-stats-link').href);assert.equal(bossLink.searchParams.get('boss'),'zulrah');assert.equal(bossLink.searchParams.get('player'),'poep aura');
 set('big dog aura','xp','agility',3500000);post=await publish();assert.equal(post.kind,'xp');assert.equal(post.targetValue,3500000);assert.equal(new URL(d.querySelector('#goal-big-dog-aura .goal-stats-link').href).searchParams.get('kind'),'skill');
 set('lijpste','collection','',500);post=await publish();assert.equal(post.kind,'collection');assert.equal(post.targetValue,500);
 set('lompste','item','Dragon spear');post=await publish();assert.equal(post.kind,'item');assert.equal(post.metric,'1249');assert.equal(post.targetValue,1);
 set('dikste','manual','',10,'Complete ten quests',3);post=await publish();assert.equal(post.kind,'manual');assert.equal(post.current,3);assert(d.querySelector('#goal-dikste').textContent.includes('3 / 10'));
 set('lompste','none','',null,'Complete Desert Treasure II');for(const name of ['metric','item','current','targetValue'])assert(field(name).disabled);post=await publish();assert.equal(post.kind,'none');assert(!d.querySelector('#goal-lompste progress'));assert(!d.querySelector('#goal-lompste .goal-stats-link'));
 // Suggested milestones become exact draft targets, without publishing on a click.
 const suggestion=d.querySelector('[data-goal-player="lijpste"] [data-pick-goal]');assert(suggestion&&!suggestion.disabled);const previousPosts=posts.length;suggestion.click();let dialog=d.querySelector('#sharedGoalDialog form');assert.equal(dialog.elements.metric.value,suggestion.dataset.goalMetric);assert.equal(Number(dialog.elements.targetValue.value),Number(suggestion.dataset.goalTarget));assert.equal(posts.length,previousPosts);d.querySelector('#cancelSharedGoal').click();
 // Native validation rejects fractional levels and invalid targets before review.
 set('dikste','level','farming',99.5);chooser.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert(!d.querySelector('#sharedGoalDialog'));assert.equal(posts.length,previousPosts);
 fail=true;set('poep aura','boss','vorkath',1234,'Keep this target');chooser.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));dialog=d.querySelector('#sharedGoalDialog form');dialog.elements.code.value='test-code';dialog.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>d.querySelector('#sharedGoalError').textContent.includes('Test publishing failure'),'failed save');assert.equal(dialog.elements.metric.value,'vorkath');assert.equal(dialog.elements.targetValue.value,'1234');assert.equal(dialog.elements.text.value,'Keep this target');assert.equal(posts.length,previousPosts);d.querySelector('#cancelSharedGoal').click();
 // Backlinks open the actual level and KC views for the linked player, without altering the saved filter.
 const stats=await openPage(linkedStats.pathname.split('/').pop()+linkedStats.search,{selection:['dikste','lijpste']});pages.push(stats.dom);const sd=stats.dom.window.document;await waitFor(()=>sd.querySelector('#v21MetricModal')?.getAttribute('aria-hidden')==='false','linked level modal');assert.equal(sd.querySelector('#v21ModalTitle').textContent,'Farming level');assert.equal(stats.dom.window.UGV21Charts.metricValue(wom.profiles.dikste.latestSnapshot.data,'level','farming'),wom.profiles.dikste.latestSnapshot.data.skills.farming.level);assert.equal(sd.querySelectorAll('#statsMemberPicker input:checked').length,1);assert.equal(sd.documentElement.dataset.bannerMembers,'1');assert.equal(stats.dom.window.UGV21.loadMemberSelection().size,2);assert(new URL(sd.querySelector('#v21GoalLink').href).searchParams.get('kind')==='level');
 const kc=await openPage(bossLink.pathname.split('/').pop()+bossLink.search,{selection:['dikste','lijpste']});pages.push(kc.dom);const kd=kc.dom.window.document;await waitFor(()=>kd.querySelectorAll('.kc-card').length===1,'linked boss');assert.equal(kd.querySelector('.kc-card').dataset.bossKey,'zulrah');assert.equal(kd.querySelectorAll('.kc-player').length,1);assert.equal(kd.querySelector('.kc-player').dataset.kcPlayer,'poep aura');assert.equal(kd.documentElement.dataset.bannerMembers,'1');const target=new URL(kd.querySelector('.kc-set-goal').href);assert.equal(target.searchParams.get('player'),'poep aura');assert.equal(target.searchParams.get('kind'),'boss');assert.equal(target.searchParams.get('metric'),'zulrah');
 const preset=await openPage(target.pathname.split('/').pop()+target.search+target.hash,{goalResponse});pages.push(preset.dom);const pf=preset.dom.window.document.querySelector('#goalChoiceForm');await waitFor(()=>pf?.elements.namedItem('metric').value==='zulrah','return-to-goal preset');assert.equal(pf.elements.kind.value,'boss');assert.equal(pf.elements.player.value,'poep aura');assert.equal(pf.elements.text.value.startsWith('Reach '),true);
 for(const result of [page,stats,kc,preset])assert.equal(result.errors.length,0,result.errors.join('; '));
 pages.forEach(p=>p.window.close());console.log('Any-goal chooser, all skills/bosses, seven goal types, arbitrary targets, suggestions, protected publishing, validation/draft retention, level/KC backlinks and filter-aware banner passed.');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
