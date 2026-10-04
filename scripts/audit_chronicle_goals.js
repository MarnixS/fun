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
 assert.equal(d.querySelector('#chroniclePagerTop [data-chrono-select]').value,String(last));assert(!d.querySelector('#chronicleMeta'));assert(!d.querySelector('[data-period-status]'));
 assert.equal(d.querySelector('#chroniclePagerBottom [data-chrono-select]').value,String(last));
 assert(d.querySelector('#chroniclePagerTop [aria-label="Next Chronicle page"]').disabled);
 d.querySelector('#chroniclePagerBottom [aria-label="Previous Chronicle page"]').click();
 assert.equal(d.querySelector('#chroniclePagerTop [data-chrono-select]').value,String(last-1));
 select=d.querySelector('#chroniclePagerTop [data-chrono-select]');select.value='1';select.dispatchEvent(new w.Event('change'));
 assert.equal(d.querySelector('.chronicle-event').textContent,first);
 d.querySelector('[data-chrono-size="all"]').click();
 await waitFor(()=>d.querySelector('[data-chrono-size="all"]')?.classList.contains('active')&&d.querySelectorAll('.chronicle-event[data-level]').length>1000,'expanded Chronicle history',30000);
 const kc=[...d.querySelectorAll('.chronicle-event')].filter(e=>/ KC$/.test(e.querySelector('h4').textContent));assert(kc.length>0);assert(kc.every(e=>/WOM accuracy ±\d+h/.test(e.querySelector('.chronicle-date').textContent)),'KC crossings show snapshot timing accuracy');
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
 const fixture=structuredClone(require('../docs/data/wom-cache.json')),base=structuredClone(fixture.profiles.dikste.latestSnapshot),a=structuredClone(base),b=structuredClone(base);
 a.id=-101;b.id=-102;a.createdAt='2026-02-01T00:00:00Z';b.createdAt='2026-02-03T00:00:00Z';a.data.bosses.zulrah.kills=20;b.data.bosses.zulrah.kills=60;
 fixture.snapshots.dikste=[a,b];fixture.profiles.dikste.latestSnapshot=b;
 const kcPage=await openPage('chronicle.html',{womDocument:fixture,sharedDocs:{wom:fixture,temple:require('../docs/data/temple-clog.json')}});const kd=kcPage.dom.window.document;kd.querySelector('[data-chrono-size="all"]').click();
 const crossing=[...kd.querySelectorAll('.chronicle-event')].find(e=>e.querySelector('h4').textContent.includes('Dikste · 50 Zulrah KC'));assert(crossing);assert(crossing.querySelector('.chronicle-date').textContent.includes('WOM accuracy ±24h'),'48-hour snapshot gap gives +/-24-hour KC timing accuracy: '+crossing.querySelector('.chronicle-date').textContent);assert.equal(kcPage.errors.length,0);
 console.log('Chronicle level order, suggested goals and removal of private goals passed');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
