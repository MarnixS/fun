const assert=require('node:assert/strict');
const {openPage,waitFor}=require('./audit_v25_jsdom');
async function run(){
 const {dom,errors}=await openPage('chronicle.html');const w=dom.window,d=w.document;
 await waitFor(()=>d.querySelector('#chronicle'),'Chronicle');
 assert.equal(d.querySelector('#chronicleMemberPicker legend').textContent,'Players in Chronicle');assert.equal(d.querySelector('#chronicleMemberPicker .v21-member-help').textContent,'');assert(!d.querySelector('#chronicleMemberStatus'));
 assert(!d.querySelector('#historyLocalNav'));assert(!d.querySelector('#chronicleRefresh'));
 assert.equal(d.querySelectorAll('[data-refresh-wom]').length,1);assert.equal(d.querySelectorAll('[data-refresh-temple]').length,1);
 const first=d.querySelector('.chronicle-event').textContent;
 let select=d.querySelector('#chroniclePagerTop [data-chrono-select]');const last=select.options.length;
 select.value=String(last);select.dispatchEvent(new w.Event('change'));
 assert(d.querySelector('#chronicleMeta').textContent.includes(`page ${last} of ${last}`));
 assert.equal(d.querySelector('#chroniclePagerBottom [data-chrono-select]').value,String(last));
 assert(d.querySelector('#chroniclePagerTop [aria-label="Next Chronicle page"]').disabled);
 d.querySelector('#chroniclePagerBottom [aria-label="Previous Chronicle page"]').click();
 assert.equal(d.querySelector('#chroniclePagerTop [data-chrono-select]').value,String(last-1));
 select=d.querySelector('#chroniclePagerTop [data-chrono-select]');select.value='1';select.dispatchEvent(new w.Event('change'));
 assert.equal(d.querySelector('.chronicle-event').textContent,first);
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
 const goals=await openPage('goals.html');const suggestions=goals.dom.window.document.querySelector('.goal-card[data-goal-player="lijpste"]');assert.equal(suggestions.querySelectorAll('.goal-line').length,10);assert.equal(suggestions.querySelectorAll(':scope > .goal-line').length,4);assert(!suggestions.querySelector('details').open);
 assert.equal(errors.length+goals.errors.length,0,[...errors,...goals.errors].join('; '));
 console.log('Chronicle level order, suggested goals and removal of private goals passed');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
