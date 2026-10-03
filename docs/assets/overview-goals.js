(()=>{
'use strict';
const U=window.UGV21,G=window.UGGoalProgress;if(!U||!G||document.body.dataset.page!=='home')return;
const {$,$$,fmt,escapeHtml:esc}=U;let doc=null,wom=null,temple=null,failed=false;
function render(){
 for(const card of $$('.player-card[data-player-key]')){
  const key=card.dataset.playerKey,p=U.player(key);if(!p)continue;
  $('.overview-goal',card)?.remove();const a=document.createElement('a');a.className='overview-goal';a.href='goals.html#goal-'+key.replace(/ /g,'-');a.setAttribute('aria-label',p.name+' goals · Beta');
  const goal=doc?.goals?.[key],active=Boolean(goal?.text),progress=active?G.progress(goal,key,wom,temple):null;
  a.innerHTML=`<span class="overview-goal-head">Player goal <span class="feature-beta">Beta</span><span aria-hidden="true">↗</span></span><strong>${active?esc(goal.text):doc?'No goal set yet':failed?'Goal unavailable':'Loading saved goal…'}</strong>${progress?(progress.unknown?'<small>Progress unknown</small>':`<progress max="100" value="${progress.percent}" aria-label="${esc(p.name)} goal progress"></progress><small>${fmt(progress.value)} / ${fmt(progress.target)} · ${progress.complete?'Complete':Math.floor(progress.percent)+'%'}</small>`):''}`;
  const log=$('.v22-clog-quick',card);if(log)log.before(a);else card.append(a);
 }
}
window.addEventListener('ug:page-rendered',render);
window.addEventListener('ug:data-updated',async e=>{if(![U.WKEY,U.TKEY].includes(e.detail?.key))return;[wom,temple]=await Promise.all([U.loadWom(),U.loadClog()]);render()});
async function init(){render();try{const r=await fetch('data/goals.json',{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Goal HTTP '+r.status);doc=await r.json()}catch(e){failed=true;console.warn('Saved player goals unavailable',e)}[wom,temple]=await Promise.all([U.loadWom(),U.loadClog()]);render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
