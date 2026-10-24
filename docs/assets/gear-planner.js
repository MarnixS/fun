(()=>{
'use strict';
const U=window.UGV21,M=window.UGClogBetaModel;
if(!U||!M||document.body.dataset.page!=='gear-planner')return;
const $=s=>document.querySelector(s),esc=U.escapeHtml;
const STYLES={
 ranged:{weapon:['Twisted bow','Bow of faerdhinen (c)','Bow of faerdhinen','Zaryte crossbow','Armadyl crossbow','Dragon hunter crossbow','Dragon crossbow','Toxic blowpipe','Rune crossbow'],head:['Masori mask (f)','Masori mask','Armadyl helmet','Crystal helm','Karil\'s coif','Blessed coif'],body:['Masori body (f)','Masori body','Armadyl chestplate','Crystal body','Karil\'s leathertop','Black d\'hide body'],legs:['Masori chaps (f)','Masori chaps','Armadyl chainskirt','Crystal legs','Karil\'s leatherskirt','Black d\'hide chaps'],cape:['Dizana\'s quiver','Ava\'s assembler','Ava\'s accumulator'],neck:['Necklace of anguish','Amulet of fury'],hands:['Zaryte vambraces','Barrows gloves'],feet:['Pegasian boots','Ranger boots','Blessed d\'hide boots'],ring:['Venator ring','Archers ring (i)','Archers ring']},
 melee:{weapon:['Scythe of vitur','Soulreaper axe','Osmumten\'s fang','Ghrazi rapier','Blade of saeldor (c)','Blade of saeldor','Abyssal tentacle','Abyssal whip','Zombie axe','Dragon scimitar'],head:['Torva full helm','Neitiznot faceguard','Serpentine helm','Helm of neitiznot'],body:['Torva platebody','Bandos chestplate','Blood moon chestplate','Fighter torso','Obsidian platebody'],legs:['Torva platelegs','Bandos tassets','Blood moon tassets','Obsidian platelegs'],cape:['Infernal cape','Fire cape'],neck:['Amulet of rancour','Amulet of torture','Amulet of fury'],hands:['Ferocious gloves','Barrows gloves'],feet:['Primordial boots','Dragon boots'],ring:['Ultor ring','Berserker ring (i)','Berserker ring']},
 magic:{weapon:['Tumeken\'s shadow','Sanguinesti staff','Trident of the swamp','Trident of the seas','Warped sceptre','Ancient staff'],head:['Ancestral hat','Virtus mask','Ahrim\'s hood','Blue moon helm','Mystic hat'],body:['Ancestral robe top','Virtus robe top','Ahrim\'s robetop','Blue moon chestplate','Mystic robe top'],legs:['Ancestral robe bottom','Virtus robe legs','Ahrim\'s robeskirt','Blue moon tassets','Mystic robe bottom'],cape:['Imbued god cape','God cape'],neck:['Occult necklace','Amulet of fury'],hands:['Tormented bracelet','Barrows gloves'],feet:['Eternal boots','Infinity boots'],ring:['Magus ring','Seers ring (i)','Seers ring']}
};
const overrides=[
[/zilyana|commander zilyana|kreearra|kree.arra|zulrah|leviathan|hydra|vorkath|muspah|nex|jad|zuk|colosseum|fight caves|inferno|tombs of amascut/i,'ranged'],
[/zulrah|whisperer|kril|k.ril|dagannoth rex|barrows|phantom muspah/i,'magic'],
[/theatre of blood|verzik|v Theatre|duke sucellus|vardorvis|bandos|general graardor|corporeal|corp beast|cerberus|thermonuclear|sarachnis|nightmare|araxxor|calvar|vet.ion|scurrius|kalphite queen|chambers of xeric/i,'melee']
];
let model,selected=U.loadMemberSelection(),styleTouched=false;
let bosses=[];
function key(s){return String(s).toLowerCase().replace(/[^a-z0-9]/g,'')}
function catalog(){const out=new Map();for(const [id,name] of model.names){const k=key(name);if(!out.has(k))out.set(k,[]);out.get(k).push(id)}return out}
function amount(name,idx,ps,shared=true){const ids=idx.get(key(name))||[];return ids.reduce((sum,id)=>sum+ps.reduce((s,p)=>s+(model.counts.get(p.key)?.get(id)||0),0),0)}
function styleFor(b){for(const [re,st] of overrides)if(re.test(b))return st;return 'melee'}
function players(){return U.PLAYERS.filter(p=>selected.has(p.key))}
function itemImg(id){return id?'<img loading="lazy" alt="" src="https://static.runelite.net/cache/item/icon/'+id+'.png">':'<span class="gp-bad">◻</span>'}
function initBosses(){bosses=[...new Set(model.categories.filter(c=>c.tab==='bosses'||c.tab==='raids').map(c=>U.nice(c.key)))].sort((a,b)=>a.localeCompare(b));if(!bosses.length)bosses=['General Graardor','Kree\'arra','Tombs of Amascut','Chambers of Xeric'];$('#gp-boss').innerHTML=bosses.map(b=>'<option>'+esc(b)+'</option>').join('');const b=bosses.find(b=>/kree|tombs/i.test(b))||bosses[0];$('#gp-boss').value=b;$('#gp-style').value=styleFor(b)}
function run(){if(!model)return;const ps=players();if(!ps.length){$('#gp-status').textContent='Select at least one member.';return}const shared=$('#gp-shared').checked,fortify=$('#gp-crafted').checked,idx=catalog(),sty=$('#gp-style').value;
 const stock=new Map(),lookup=new Map();for(const [name,ids] of idx){stock.set(name,ids.reduce((n,id)=>n+ps.reduce((s,p)=>s+(model.counts.get(p.key)?.get(id)||0),0),0));lookup.set(name,ids[0])}
 const members=shared?ps:ps; // When not pooling, constrain each loadout to its originating member.
 let plates=0;const arma=[['Armadyl helmet',1],['Armadyl chestplate',4],['Armadyl chainskirt',3]];
 const alreadyBuilt=['Masori mask (f)','Masori body (f)','Masori chaps (f)'];
 const usedArma=new Map();
 // Plates are generated only by actually consuming an Armadyl item; no double allocation.
 const rows=[],issues=[];
 for(const p of members){const slots=[];
 for(const [slot,options] of Object.entries(STYLES[sty])){let chosen=null,source='',id=null;
 for(const name of options){const k=key(name);const own=shared?(stock.get(k)||0):(model.counts.get(p.key)?.get(lookup.get(k))||0);
 if(own>0){chosen=name;id=lookup.get(k);source='logged';if(shared)stock.set(k,own-1);else{const perKey=p.key+'|'+k;const used=usedArma.get(perKey)||0;if(own<=used){chosen=null;continue}usedArma.set(perKey,used+1)}break}
 // A craftable fortified Masori piece consumes normal Masori + shared Armadyl plates.
 const cost={'Masori mask (f)':1,'Masori body (f)':4,'Masori chaps (f)':3}[name];
 if(shared&&fortify&&cost){const base=name.replace(' (f)',''),bk=key(base);if((stock.get(bk)||0)>0){let potential=plates+arma.reduce((n,[a,yieldPlates])=>n+(stock.get(key(a))||0)*yieldPlates,0);if(potential>=cost){while(plates<cost){const feed=arma.filter(([a])=>(stock.get(key(a))||0)>0).sort((a,b)=>a[1]-b[1])[0];if(!feed)break;stock.set(key(feed[0]),stock.get(key(feed[0]))-1);plates+=feed[1]}chosen=name;id=lookup.get(bk);source='craft '+cost+' plate'+(cost===1?'':'s');stock.set(bk,stock.get(bk)-1);plates-=cost;break}}}
 }
 slots.push({slot,name:chosen,id,source});if(!chosen)issues.push(slot);
 }
 rows.push({p,slots})}
 let totalArma=arma.reduce((sum,[name,cost])=>sum+(amount(name,idx,ps)*cost),0);
 let msg='Gear ranked by a general '+sty+' priority list, not boss-specific DPS. ';
 if(!shared)msg+='Separate ownership assumed; players cannot borrow logged items from each other. ';
 if(!model.known.size)msg+='No trustworthy log data available. ';
 if(fortify&&sty==='ranged'&&shared)msg+='Hypothetical Armadyl plate pool: '+totalArma+' available from logged armour; '+plates+' unused converted plates. Existing fortified Masori is allocated first. ';
 $('#gp-status').textContent=ps.length+' player'+(ps.length>1?'s':'')+' · '+$('#gp-boss').value+' · '+sty+'. '+msg;
 $('#gp-supply').innerHTML='<div class="gp-supply"><h3>Finite supply & assumptions</h3><p>Masori fortification requires 1 plate for the mask, 4 for the body, 3 for the chaps. Armadyl helmet / chestplate / chainskirt yield 1 / 4 / 3 plates. Logged quantities may have been sold, dismantled, consumed, or transferred; existing crafted gear may not appear in the log. This planner <strong>does not confirm current ownership</strong>.</p><p>Logged Armadyl: '+arma.map(([n])=>esc(n)+': '+amount(n,idx,ps)).join(' · ')+'</p><p class="gp-note">When a resource is exhausted, remaining accounts automatically receive the next logged alternative. Ranking follows player order below; swapping the order can change who receives scarce upgrades.</p></div>';
 $('#gp-loadouts').innerHTML='<div class="gp-grid">'+rows.map(({p,slots})=>'<article class="gp-card"><h3>'+esc(p.name)+'</h3><div class="gp-gear">'+slots.map(s=>'<div class="gp-slot">'+itemImg(s.id)+'<div><small>'+esc(U.nice(s.slot))+'</small><div>'+esc(s.name||'No logged option')+'</div></div><small>'+esc(s.source)+'</small></div>').join('')+'</div></article>').join('')+'</div>';
}
$('#gp-boss').addEventListener('change',e=>{if(!styleTouched)$('#gp-style').value=styleFor(e.target.value);run()});
$('#gp-style').addEventListener('change',()=>{styleTouched=true;run()});
for(const id of ['#gp-shared','#gp-crafted'])$(id).addEventListener('change',run);
$('#gp-run').addEventListener('click',run);
U.onDataUpdate(async e=>{if(e.detail?.key===U.TKEY){model=M.build(await U.loadClog(),U.PLAYERS);run()}});
U.loadClog().then(doc=>{model=M.build(doc,U.PLAYERS);initBosses();U.renderMemberPicker($('#gp-members'),selected,keys=>{selected=new Set(keys);run()},{title:'Players to equip (1–5)',subtitle:'All selected players need simultaneous loadouts.',fallback:U.ALL_KEYS,availability:model.known,compact:true});run()}).catch(e=>{$('#gp-status').textContent='Saved Collection Log unavailable: '+e.message});
})();