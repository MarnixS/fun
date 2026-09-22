const assert=require('node:assert/strict');
const {openPage,waitFor}=require('./audit_v25_jsdom');
async function run(){
 const {dom,errors}=await openPage('chronicle.html');const w=dom.window,d=w.document;
 await waitFor(()=>d.querySelector('#sharedGoals'),'shared goals');
 d.querySelector('[data-chrono-size="all"]').click();
 await waitFor(()=>d.querySelector('[data-chrono-size="all"]')?.classList.contains('active')&&d.querySelectorAll('.chronicle-event[data-level]').length>1000,'expanded Chronicle history',30000);
 assert(!d.querySelector('#playerGoals'));assert(!d.querySelector('[data-set-goal]'));assert(!d.body.textContent.includes('Private goals on this device'));
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
 assert.equal(errors.length,0,errors.join('; '));
 console.log('Chronicle level order, suggested goals and removal of private goals passed');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
