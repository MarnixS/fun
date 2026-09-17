(()=>{
'use strict';
const U=window.UGV21,M=window.UGClogBetaModel;if(!U||!M||document.body.dataset.page!=='clog-beta')return;
const {$,escapeHtml:esc,fmt,nice}=U;
let model,selected=U.loadMemberSelection(),tab='bosses',category='',query='',chosen=null,wom;
const players=()=>U.PLAYERS.filter(p=>selected.has(p.key));
const share=id=>M.shares(model,id,players());
const label=key=>({kree_arra:"Kree'arra",kril_tsutsaroth:"K'ril Tsutsaroth",vetion_and_calvarion:"Vet'ion and Calvar'ion"}[key]||nice(key).replace(/^./,c=>c.toUpperCase()));
function pie(data){let end=0;return data.entries.filter(p=>p.count>0).map(p=>{const start=end;end+=100*p.share;return `${p.color} ${start}% ${end}%`}).join(',')}
function picker(){U.renderMemberPicker($('#betaMembers'),selected,keys=>{selected=new Set(keys);U.saveMemberSelection(selected);render()},{title:'Members in this log',subtitle:'Colour shows each member’s share of the saved item count.',fallback:U.ALL_KEYS,availability:model.known})}
function kills(key){
 const aliases={callisto_and_artio:['callisto','artio'],venenatis_and_spindel:['venenatis','spindel'],vetion_and_calvarion:['vetion','calvarion'],dagannoth_kings:['dagannoth_prime','dagannoth_rex','dagannoth_supreme'],the_gauntlet:['the_gauntlet','the_corrupted_gauntlet'],the_nightmare:['nightmare','phosanis_nightmare'],chambers_of_xeric:['chambers_of_xeric','chambers_of_xeric_challenge_mode'],theatre_of_blood:['theatre_of_blood','theatre_of_blood_hard_mode'],tombs_of_amascut:['tombs_of_amascut','tombs_of_amascut_expert']};
 const keys=aliases[key]||[key];let total=0,known=0;
 for(const p of players())for(const k of keys){const n=U.snapData(wom,p.key)?.bosses?.[k]?.kills;if(Number.isFinite(n)&&n>=0){total+=n;known++}}
 return known?`${fmt(total)} recorded KC`:'';
}
function detail(){
 const host=$('#betaItemDetail');if(chosen===null){host.innerHTML='<p>Select an item to see each member’s exact contribution.</p>';return}
 const data=share(chosen),name=model.names.get(chosen)||`Item ${chosen}`;
 host.innerHTML=`<div class="beta-detail-heading"><img src="https://static.runelite.net/cache/item/icon/${chosen}.png" alt=""><div><h3>${esc(name)}</h3><span>${data.known?fmt(data.total)+' logged across selected members':'No synced data for selected members'}</span></div>${U.itemLink(chosen,'OSRS Wiki ↗')}</div><div class="beta-counts">${data.entries.map(p=>`<div style="--member:${p.color}"><span>${esc(p.name)}</span><strong>${p.count===null?'Unknown':fmt(p.count)}</strong><small>${p.count===null?'not synced':data.total?(100*p.share).toFixed(1)+'%':'no logged drops'}</small></div>`).join('')}</div><p class="beta-footnote">Saved Collection Log counts, not current bank ownership. Items shared by multiple categories use the same global counter; the log does not identify which boss supplied them.</p>`;
}
function render(){
 if(!model)return;
 const ps=players(),available=model.categories.filter(c=>c.tab===tab),current=available.find(c=>c.key===category)||available[0];category=current?.key||'';
 $('#betaTabs').innerHTML=M.TABS.map(t=>`<button type="button" data-beta-tab="${t}" aria-pressed="${t===tab}">${nice(t)}</button>`).join('');
 const ids=[...new Set(model.categories.flatMap(c=>c.ids))],got=ids.filter(id=>share(id).total>0).length;
 const hasKnown=ps.some(p=>model.known.has(p.key));
 $('#betaTotal').textContent=`${hasKnown?fmt(got):'?'} / ${fmt(ids.length)}`;
 $('#betaCategories').innerHTML=available.map(c=>{const count=c.ids.filter(id=>share(id).total>0).length;return `<button type="button" data-beta-category="${esc(c.key)}" aria-pressed="${c.key===category}" class="${count===c.ids.length?'complete':''}" title="${esc(label(c.key))}: ${count}/${c.ids.length}">${esc(label(c.key))}</button>`}).join('');
 $('#betaCategoryTitle').textContent=query?'Search results':current?label(category):'No saved categories';
 $('#betaKills').textContent=!query&&current?kills(category):'';
 const missing=ps.filter(p=>!model.known.has(p.key));$('#betaCoverage').textContent=missing.length?`No synced log for ${missing.map(p=>p.name).join(', ')}. Counts show the available members only.`:'';
 const rows=(query?ids:current?.ids||[]).filter(id=>!query||(model.names.get(id)||`Item ${id}`).toLowerCase().includes(query));
 $('#betaObtained').textContent=`${hasKnown?rows.filter(id=>share(id).total>0).length:'?'}/${rows.length}`;
 $('#betaSearchStatus').textContent=query?`${rows.length} matches across all tabs`:'';
 $('#betaGrid').innerHTML=rows.length?rows.map(id=>{const data=share(id),name=model.names.get(id)||`Item ${id}`,text=data.known?`${fmt(data.total)} logged`:'unknown';return `<button type="button" class="beta-item ${data.total?'obtained':'missing'}" data-beta-item="${id}" aria-pressed="${chosen===id}" aria-label="${esc(name)}, ${text}. Show contributions" title="${esc(name)} · ${text}"><img src="https://static.runelite.net/cache/item/icon/${id}.png" alt="" loading="lazy">${data.total>1?`<span class="beta-quantity">${data.total>=100000?U.compact(data.total):fmt(data.total)}</span>`:''}${data.total?`<span class="beta-item-pie" aria-hidden="true" style="background:conic-gradient(${pie(data)})"></span>`:''}</button>`}).join(''):'<p class="beta-empty">'+(query?'No matching items.':'No category data in this saved snapshot.')+'</p>';
 $('#betaLegend').innerHTML=ps.map(p=>`<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join('');detail();
}
$('#betaTabs').addEventListener('click',e=>{const button=e.target.closest('[data-beta-tab]');if(!button)return;tab=button.dataset.betaTab;category='';chosen=null;query='';$('#betaSearch').value='';render();$('#betaTabs').querySelector(`[data-beta-tab="${tab}"]`).focus()});
$('#betaCategories').addEventListener('click',e=>{const button=e.target.closest('[data-beta-category]');if(!button)return;category=button.dataset.betaCategory;chosen=null;query='';$('#betaSearch').value='';const top=$('#betaCategories').scrollTop;render();$('#betaCategories').scrollTop=top;$('#betaCategories').querySelector(`[data-beta-category="${category}"]`).focus({preventScroll:true})});
$('#betaGrid').addEventListener('click',e=>{const button=e.target.closest('[data-beta-item]');if(!button)return;chosen=Number(button.dataset.betaItem);$('#betaGrid').querySelectorAll('[aria-pressed]').forEach(b=>b.setAttribute('aria-pressed',b===button?'true':'false'));detail()});
$('#betaSearch').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();chosen=null;render()});
$('#betaOverlay').addEventListener('change',e=>$('#betaGame').classList.toggle('beta-hide-pies',!e.target.checked));
window.addEventListener('ug:members-changed',e=>{const keys=U.cleanSelection(e.detail?.keys,U.ALL_KEYS);if(U.sameSelection(selected,keys))return;selected=keys;if(model){picker();render()}});
window.addEventListener('ug:data-updated',async e=>{if(e.detail?.key===U.TKEY){model=M.build(await U.loadClog(),U.PLAYERS);picker();render()}else if(e.detail?.key===U.WKEY){wom=await U.loadWom();render()}});
Promise.all([U.loadClog(),U.loadWom()]).then(([doc,w])=>{model=M.build(doc,U.PLAYERS);wom=w;picker();render()}).catch(()=>{$('#betaCoverage').textContent='The saved Collection Log could not be loaded. Reload to retry.'});
})();
