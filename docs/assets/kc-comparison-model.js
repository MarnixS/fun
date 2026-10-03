(function(root){
'use strict';
// Broad encounter tiers are an editorial relevance guide, not an official ranking.
// Shared positive KC comes first; difficulty tier then combined KC orders each group.
const TIERS=[
 ['tempoross','wintertodt','zalcano'],
 ['obor','bryophyta','giant_mole','king_black_dragon','chaos_fanatic','crazy_archaeologist','deranged_archaeologist','hespori','scurrius'],
 ['barrows_chests','dagannoth_rex','dagannoth_prime','dagannoth_supreme','kraken','sarachnis','chaos_elemental','scorpia','artio','calvarion','spindel','lunar_chests','amoxliatl','the_royal_titans','the_hueycoatl','mimic','skotizo','tztok_jad'],
 ['abyssal_sire','cerberus','alchemical_hydra','araxxor','grotesque_guardians','kalphite_queen','vorkath','zulrah','phantom_muspah','general_graardor','commander_zilyana','kreearra','kril_tsutsaroth','corporeal_beast','callisto','venenatis','vetion','thermonuclear_smoke_devil','the_gauntlet','duke_sucellus','nightmare'],
 ['chambers_of_xeric','tombs_of_amascut','nex','yama','the_corrupted_gauntlet','vardorvis','the_leviathan','the_whisperer'],
 ['tombs_of_amascut_expert','theatre_of_blood','phosanis_nightmare'],
 ['theatre_of_blood_hard_mode','chambers_of_xeric_challenge_mode','tzkal_zuk','sol_heredit','doom_of_mokhaiotl']
];
const tiers=new Map(TIERS.flatMap((keys,tier)=>keys.map(key=>[key,tier])));
function relevance(key){return tiers.get(key)??2}
function relevantOrder(a,b){return Number(b.participants>1)-Number(a.participants>1)||relevance(b.key)-relevance(a.key)||b.total-a.total||b.participants-a.participants||a.key.localeCompare(b.key)}
function shares(boss){let angle=0;const positive=boss.rows.filter(p=>p.kc>0);return positive.map((p,i)=>{const start=angle;angle=i===positive.length-1?360:angle+360*p.kc/boss.total;return{...p,start,end:angle}})}
function data(wom,key){return wom?.profiles?.[key]?.latestSnapshot?.data||wom?.profiles?.[key]?.latest_snapshot?.data}
function count(wom,player,boss){const raw=data(wom,player)?.bosses?.[boss]?.kills;if(raw==null||raw===''||!Number.isFinite(+raw)||+raw<0)return null;return Math.floor(+raw)}
function compare(wom,players,key){
 const rows=players.map(p=>({...p,kc:count(wom,p.key,key)})).sort((a,b)=>a.kc==null?b.kc==null?a.name.localeCompare(b.name):1:b.kc==null?-1:b.kc-a.kc||a.name.localeCompare(b.name));
 const known=rows.filter(p=>p.kc!=null),total=known.reduce((n,p)=>n+p.kc,0),max=known[0]?.kc??0,leaders=max>0?known.filter(p=>p.kc===max):[];
 return{key,total,max,participants:known.filter(p=>p.kc>0).length,leaders,gap:max>0&&known.length>1?max-known[1].kc:null,known:known.length,rows:rows.map(p=>({...p,rank:p.kc==null||!max?null:1+known.filter(x=>x.kc>p.kc).length,share:p.kc==null?null:total?100*p.kc/total:0,behind:p.kc==null?null:max-p.kc}))};
}
function build(wom,players,catalogPlayers=players){const keys=new Set(catalogPlayers.flatMap(p=>Object.keys(data(wom,p.key)?.bosses||{})));return[...keys].map(k=>compare(wom,players,k))}
const api={compare,build,relevance,relevantOrder,shares};if(typeof module==='object'&&module.exports)module.exports=api;else root.UGKCComparison=api;
})(typeof window==='undefined'?globalThis:window);
