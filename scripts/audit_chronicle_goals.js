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
 const temple=structuredClone(require('../docs/data/temple-clog.json')),now=Math.floor(Date.now()/1000),itemIds=[700301,700302,700303,700304,700305];
 temple.fetchedAt=Date.now()+60000;
 for(const [key,log] of Object.entries(temple.players)){
  log.data.last_checked=now+60;
  log.data.items.chronicle_test=itemIds.map(id=>({id,name:'Chronicle test '+id,count:key==='lijpste'?id===700303?401:id>=700303?2:1:key==='big dog aura'&&id===700302?1:0,date:key==='lijpste'?id>=700303?now-500:now-400:key==='big dog aura'&&id===700302?now-600:null}));
 }
 temple.recent=itemIds.map(id=>({id,name:'Chronicle test '+id,player:'Lijpste',date_unix:now-400,previous_count:id>=700303?1:0,current_count:id===700303?101:id>=700303?2:1,count_delta:id===700303?100:1,repeat_drop:id>=700303,detected_from_count:true}));
 // More than 250 newer cheap repeats must not bury older qualifying events.
 temple.recent.push(...Array.from({length:300},(_,index)=>({id:700303,name:'Chronicle test 700303',player:'Lijpste',date_unix:now-index,previous_count:400-index,current_count:401-index,count_delta:1,repeat_drop:true,detected_from_count:true})));
 const itemPage=await openPage('chronicle.html',{selection:['lijpste'],templeDocument:temple,savedTemple:temple,sharedDocs:{wom:require('../docs/data/wom-cache.json'),temple},priceData:{700303:{high:400000,low:400000},700304:{high:500000,low:500000},700305:{high:500001,low:500001}}});
 const id=itemPage.dom.window.document;id.querySelector('[data-chrono-filter="drops"]').click();
 await waitFor(()=>id.querySelector('#chronicle .item-link[data-item-id="700305"]'),'priced duplicate');
 const article=item=>id.querySelector('#chronicle .item-link[data-item-id="'+item+'"]')?.closest('.chronicle-event');
 assert.equal(id.querySelectorAll('.chronicle-event[data-event-type="drop"]').length,3,'retroactive filtering removes 300 newer cheap repeats and retains the older personal unlocks and expensive duplicate');
 assert.equal(article(700301).dataset.groupUnlock,'true');assert.match(article(700301).querySelector('.chronicle-group-unlock').textContent,/New group Collection Log unlock/);
 assert.match(article(700302).textContent,/New Collection Log unlock for this player/);assert(!article(700302).querySelector('.chronicle-group-unlock'),'hidden earlier owner prevents a group-first label');
 assert(!article(700303),'a 40-million-gp stack of cheap duplicates stays out');assert(!article(700304),'exactly 500k stays out');
 assert(article(700305).classList.contains('broadcast'));assert.match(article(700305).querySelector('.chronicle-item-price').textContent,/500,001 gp each/);assert(!article(700305).dataset.groupUnlock,'expensive repeats do not become group unlocks');
 assert.equal(itemPage.errors.length,0,itemPage.errors.join('; '));
 for(const page of [dom,goals.dom,kcPage.dom,itemPage.dom])page.window.close();
 console.log('Chronicle item filtering and group labels, level order, suggested goals and removal of private goals passed');
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
