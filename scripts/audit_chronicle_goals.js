const assert=require('node:assert/strict');
const {openPage,waitFor}=require('./audit_v25_jsdom');
async function run(){
 const {dom,errors}=await openPage('chronicle.html');const w=dom.window,d=w.document;
 await waitFor(()=>d.querySelector('[data-set-goal]'),'goal controls');
 const groups=new Map();
 for(const el of d.querySelectorAll('.chronicle-event[data-level]')){
  const date=el.querySelector('.chronicle-date').textContent.split(' · ')[0];
  const key=[el.dataset.playerKey,el.dataset.metric,date].join('|');
  const levels=groups.get(key)||[];levels.push(+el.dataset.level);groups.set(key,levels);
 }
 assert([...groups.values()].some(a=>a.length>3),'real history includes multi-level batches');
 for(const levels of groups.values())assert.deepEqual(levels,[...levels].sort((a,b)=>b-a),'level batches are highest first');
 assert(!d.querySelector('#chronicle').textContent.includes('1970'));
 // jsdom does not implement modal dialog methods; real browser flow is checked separately.
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 const suggestions=d.querySelector('.goal-card[data-goal-player="lijpste"]');assert.equal(suggestions.querySelectorAll('.goal-line').length,10);assert.equal(suggestions.querySelectorAll(':scope > .goal-line').length,4);assert(!suggestions.querySelector('details').open);
 let opened=false;w.open=()=>{opened=true};
 d.querySelector('[data-set-goal="dikste"]').click();
 const dialog=d.querySelector('#v22GoalDialog');
 d.querySelector('#v22GoalText').value='<b>95 Slayer</b>';
 d.querySelector('#v22GoalSubmit').click();
 await waitFor(()=>d.querySelector('.v22-goal-text')?.textContent==='<b>95 Slayer</b>','local goal saved');
 assert(!d.querySelector('.v22-goal-text b'),'goal text is escaped');
 assert.equal(JSON.parse(w.localStorage.getItem('ug-v29-local-goals')).goals.dikste.text,'<b>95 Slayer</b>');
 assert.equal(opened,false,'goal saving never opens GitHub');
 d.querySelector('[data-set-goal="dikste"]').click();
 const original=w.Storage.prototype.setItem;
 w.Storage.prototype.setItem=function(){throw new Error('quota')};
 d.querySelector('#v22GoalText').value='99 Slayer';d.querySelector('#v22GoalSubmit').click();
 await waitFor(()=>d.querySelector('#v22GoalError').textContent.includes('could not save'),'storage failure shown');
 assert(dialog.open);assert.equal(JSON.parse(w.localStorage.getItem('ug-v29-local-goals')).goals.dikste.text,'<b>95 Slayer</b>');
 w.Storage.prototype.setItem=original;
 d.querySelector('#v22GoalClear').click();
 await waitFor(()=>!d.querySelector('.v22-goal-text'),'goal removed');
 assert.equal(errors.length,0,errors.join('; '));
 console.log('Chronicle level order, undated achievements, goal save/remove, escaping and storage-failure audit passed');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
