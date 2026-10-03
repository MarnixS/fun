(()=>{
'use strict';
const U=window.UGV21,M=window.UGKCComparison;if(!U||!M||document.body.dataset.page!=='kc-comparison')return;
const {$,$$,fmt,nice,escapeHtml:esc}=U;let wom=null,selected=U.loadMemberSelection(),limit=12;
function picker(){U.renderMemberPicker('#kcMemberPicker',selected,next=>{selected=next;U.saveMemberSelection(next);limit=12;render()},{title:'Members in comparison',subtitle:'Choose the players to compare. Every boss, rank and lead below uses only this selection.',fallback:U.ALL_KEYS})}
function pie(boss){
 if(!boss.total)return '<div class="kc-pie-empty" aria-label="No recorded KC to chart">No KC</div>';
 const pieces=M.shares(boss),point=angle=>{const r=(angle-90)*Math.PI/180;return[(50+47*Math.cos(r)).toFixed(4),(50+47*Math.sin(r)).toFixed(4)].join(' ')};
 const label=pieces.map(p=>p.name+': '+fmt(p.kc)+' kills, '+p.share.toFixed(1)+'%').join('; ');
 return `<svg class="kc-pie" viewBox="0 0 100 100" role="img" aria-label="${esc('KC distribution: '+label)}"><title>${esc(label)}</title>${pieces.map(p=>pieces.length===1?`<circle cx="50" cy="50" r="47" fill="${esc(p.color)}"><title>${esc(p.name)}: 100%</title></circle>`:`<path d="M 50 50 L ${point(p.start)} A 47 47 0 ${p.end-p.start>180?1:0} 1 ${point(p.end)} Z" fill="${esc(p.color)}" stroke="#171008" stroke-width=".6"><title>${esc(p.name)}: ${p.share.toFixed(1)}%</title></path>`).join('')}</svg>`;
}
function render(){
 if(!wom)return;const query=($('#kcSearch').value||'').trim().toLowerCase(),sort=$('#kcSort').value,all=$('#kcScope').value==='all',players=U.PLAYERS.filter(p=>selected.has(p.key)),aliases={cox:'chambers_of_xeric',toa:'tombs_of_amascut',tob:'theatre_of_blood'};
 let bosses=M.build(wom,players,U.PLAYERS).filter(x=>(all||x.total>0)&&(!query||nice(x.key).toLowerCase().includes(query)||x.key.includes(aliases[query]||'\u0000')));
 const gap=x=>x.gap==null?Infinity:x.gap;
 bosses.sort((a,b)=>sort==='relevant'?M.relevantOrder(a,b):sort==='name'?nice(a.key).localeCompare(nice(b.key)):sort==='close'?gap(a)-gap(b)||b.total-a.total||a.key.localeCompare(b.key):sort==='lead'?(b.gap??-1)-(a.gap??-1)||b.total-a.total||a.key.localeCompare(b.key):b.total-a.total||a.key.localeCompare(b.key));
 const shown=bosses.slice(0,limit),knownPlayers=players.filter(p=>wom.profiles?.[p.key]?.latestSnapshot?.data?.bosses||wom.profiles?.[p.key]?.latest_snapshot?.data?.bosses).length;
 $('#kcSummary').textContent=`${shown.length} of ${bosses.length} bosses · ${players.length} selected members${knownPlayers<players.length?' · '+(players.length-knownPlayers)+' without saved boss data':''}`;
 $('#kcCards').innerHTML=shown.map((boss,index)=>{
  const lead=boss.leaders.length>1?'Joint lead · '+boss.leaders.map(p=>p.name).join(' & '):boss.leaders.length?boss.leaders[0].name+(boss.gap!=null?' leads by '+fmt(boss.gap)+' KC':' leads'):'No recorded kills',partial=boss.known<players.length;
  return `<article class="kc-card" data-boss-key="${esc(boss.key)}" id="kc-boss-${index}"><div class="kc-card-head"><h3 tabindex="-1">${esc(nice(boss.key).replace(/^./,c=>c.toUpperCase()))}</h3><div class="kc-card-total"><div><strong>${fmt(boss.total)} KC</strong><small>${partial?'Known':'Selected'} total</small></div><figure class="kc-pie-wrap">${pie(boss)}<figcaption>KC share</figcaption></figure></div></div><p class="kc-lead">${esc(lead)}${boss.known===1?' · only one known count':''}<span class="kc-participants">${boss.participants} ${boss.participants===1?'player':'players'} with KC</span></p><div class="kc-rows">${boss.rows.map(p=>`<div class="kc-player ${p.rank===1?'kc-player-leading':''}" data-kc-player="${esc(p.key)}" style="--pc:${p.color}"><div class="kc-player-head"><span><i aria-hidden="true"></i>${esc(p.name)}${p.rank===1?'<em>Leading</em>':''}</span><b>${p.kc==null?'Unknown':fmt(p.kc)+' KC'}</b></div>${p.kc==null?'<small class="kc-unknown">No saved count for this boss</small>':`<div class="kc-track" role="img" aria-label="${esc(p.name)}: ${fmt(p.kc)} kills${p.rank?' · rank '+p.rank:''}"><i style="width:${boss.max?100*p.kc/boss.max:0}%"></i></div><div class="kc-player-detail"><small>${p.share.toFixed(1)}% of selected KC</small><small>${p.behind>0?fmt(p.behind)+' behind leader':p.kc>0?(boss.leaders.length>1?'Joint leader':'Leader'):'No recorded kills'}</small></div>`}</div>`).join('')}</div>${partial?'<p class="kc-card-note">Unknown counts are excluded from totals and ranks.</p>':''}</article>`;
 }).join('')||`<div class="notice">${query?'No bosses match this search.':knownPlayers?'No recorded kills in this selection. Choose all boss metrics to inspect zero and unknown counts.':'No saved boss data for these members. Unknown counts are not treated as zero.'}</div>`;
 $('#kcMore').hidden=shown.length>=bosses.length;$('#kcMore').textContent=`Show ${Math.min(12,bosses.length-shown.length)} more bosses`;
}
async function init(){try{wom=await U.loadWom();picker();for(const id of ['kcSearch','kcSort','kcScope'])$('#'+id).addEventListener(id==='kcSearch'?'input':'change',()=>{limit=12;render()});$('#kcMore').onclick=()=>{const next=limit;limit+=12;render();requestAnimationFrame(()=>$('#kc-boss-'+next+' h3')?.focus())};render()}catch(e){$('#kcCards').innerHTML='<div class="notice">Saved boss data could not be loaded. Reload to retry.</div>';console.warn('KC comparison unavailable',e)}}
window.addEventListener('ug:members-changed',e=>{const next=U.cleanSelection(e.detail?.keys,U.ALL_KEYS);if(U.sameSelection(next,selected))return;selected=next;limit=12;picker();render()});
window.addEventListener('ug:data-updated',async e=>{if(e.detail?.key!==U.WKEY)return;wom=await U.loadWom();render()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
