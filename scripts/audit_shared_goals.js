'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {openPage,waitFor}=require('./audit_v25_jsdom');
async function run(){
 const {dom,errors}=await openPage('chronicle.html'),w=dom.window,d=w.document;
 await waitFor(()=>d.querySelector('#playerGoals [data-set-goal]'),'existing goal editor');
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 let shared={enabled:true,goals:{}},posts=[],fail=false;const original=w.fetch;
 w.fetch=async(url,options)=>{
  if(!String(url).endsWith('/api/player-goals'))return original(url,options);
  if(options?.method==='POST'){
   if(fail)return new Response(JSON.stringify({error:'Test save failure'}),{status:502});
   const body=JSON.parse(options.body);posts.push(body);shared.goals[body.player]={...body,updatedAt:'2026-09-15T12:00:00Z'};delete shared.goals[body.player].code;
  }
  return new Response(JSON.stringify(shared),{status:200});
 };
 for(const file of ['goal-progress.js','shared-goals.js'])w.eval(fs.readFileSync('docs/assets/'+file,'utf8'));
 await waitFor(()=>d.querySelector('#reloadSharedGoals:not([disabled])'),'initial goal load');d.querySelector('#reloadSharedGoals').click();
 await waitFor(()=>d.querySelector('[data-edit-shared="lijpste"]:not([disabled])'),'shared editor enabled');
 d.querySelector('[data-edit-shared="dikste"]').click();
 const simple=d.querySelector('#sharedGoalDialog form');
 assert(!d.querySelector('#sharedProgressOptions').open,'progress options collapsed by default');
 for(const name of ['metric','item','current','targetValue'])assert(simple.elements.namedItem(name).disabled,'irrelevant field disabled: '+name);
 assert.equal(w.getComputedStyle(d.querySelector('#sharedTargetLabel')).display,'none','hidden fields stay visually hidden');
 simple.elements.text.value='Complete Desert Treasure II';simple.elements.code.value='test-code';
 simple.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await waitFor(()=>!d.querySelector('#sharedGoalDialog'),'text-only quest save');
 assert.equal(posts[0].kind,'none');assert(d.querySelector('#sharedGoals').textContent.includes('Complete Desert Treasure II'));posts.length=0;
 d.querySelector('[data-edit-shared="lijpste"]').click();
 let form=d.querySelector('#sharedGoalDialog form');form.elements.text.value='<b>Learn raids</b>';form.elements.kind.value='manual';form.elements.kind.dispatchEvent(new w.Event('change'));form.elements.current.value='30';form.elements.targetValue.value='100';form.elements.code.value='test-code';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await waitFor(()=>!d.querySelector('#sharedGoalDialog'),'shared save');
 assert(d.querySelector('#sharedGoals').textContent.includes('30 / 100'));
 assert(d.querySelector('#sharedGoals').textContent.includes('<b>Learn raids</b>'));assert(!d.querySelector('#sharedGoalCards b'),'goal text escaped');
 assert.equal(posts[0].kind,'manual');assert(!w.localStorage.getItem('goal-code'));
 d.querySelector('[data-edit-shared="lijpste"]').click();form=d.querySelector('#sharedGoalDialog form');form.elements.code.value='test-code';form.elements.kind.value='level';form.elements.kind.dispatchEvent(new w.Event('change'));form.elements.metric.value='slayer';form.elements.targetValue.value='99';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await waitFor(()=>!d.querySelector('#sharedGoalDialog'),'automatic goal save');assert.equal(posts.at(-1).metric,'slayer');assert(d.querySelector('#sharedGoals').textContent.includes('WOM'));
 d.querySelector('[data-edit-shared="lijpste"]').click();form=d.querySelector('#sharedGoalDialog form');form.elements.kind.value='item';form.elements.kind.dispatchEvent(new w.Event('change'));assert(d.querySelectorAll('#sharedItemChoices option').length>100,'searchable item catalog');form.elements.namedItem('item').value='Dragon spear';form.elements.code.value='test-code';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!d.querySelector('#sharedGoalDialog')||d.querySelector('#sharedGoalError')?.textContent,'item goal');if(d.querySelector('#sharedGoalDialog'))throw new Error(d.querySelector('#sharedGoalError').textContent+' '+Array.from(form.elements).filter(x=>x.validity&&!x.validity.valid).map(x=>x.name+':'+x.validationMessage).join(';'));assert.equal(posts.at(-1).metric,'1249');
 fail=true;d.querySelector('[data-edit-shared="lijpste"]').click();form=d.querySelector('#sharedGoalDialog form');form.elements.text.value='Keep my draft';form.elements.code.value='test-code';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>d.querySelector('#sharedGoalError').textContent.includes('Test save failure'),'save error');assert.equal(form.elements.text.value,'Keep my draft');assert(d.querySelector('#sharedGoalDialog').open);
 assert.equal(errors.length,0,errors.join(';'));console.log('Shared goal UI: public save, manual progress, WOM tracking, searchable Temple items, escaped text and failed-save draft retention passed');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});

