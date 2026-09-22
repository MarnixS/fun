(()=>{
'use strict';
const logs=[['clog-beta.html','Collection Log Classic','G'],['gim.html','Collection Log Advanced','G'],['hypothetical.html','Hypothetical Log','?'],['rng.html','RNG Index','R']];
const levels=[['hiscores.html','Current Stats','H'],['progress.html','Stat Progress','XP'],['time-machine.html','Time Machine','⧖']];
const records=[['chronicle.html','Chronicle','✦'],['history.html','Timeline','T'],['goals.html','Goals','◎'],['nemesis.html','Nemesis Comparison','VS','beta']];
function loadV22(){if(document.querySelector('script[data-v22-ui]'))return;const s=document.createElement('script');s.src='assets/v22-ui.js?v=34';s.dataset.v22Ui='1';document.head.append(s)}
function init(){
 const nav=document.querySelector('.nav-inner');if(!nav){loadV22();return}
 nav.closest('.main-nav')?.setAttribute('aria-label','Primary');
 const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 const hash=location.hash.toLowerCase();
 const isActive=href=>{const [target,targetHash='']=href.toLowerCase().split('#');if(page!==target)return false;if(targetHash)return hash===('#'+targetHash);return true};
 const link=([href,label,rune,badge])=>`<a class="nav-link ${isActive(href)?'active':''}" href="${href}" ${isActive(href)?'aria-current="page"':''}><span class="nav-rune" aria-hidden="true">${rune}</span><span>${label}</span>${badge==='beta'?'<span class="nav-badge">BETA</span>':''}</a>`;
 const group=(id,label,rune,items)=>`<div class="nav-dropdown"><button type="button" class="nav-trigger ${items.some(([href])=>isActive(href))?'active':''}" aria-expanded="false" aria-controls="nav-${id}"><span class="nav-rune" aria-hidden="true">${rune}</span><span>${label}</span><span aria-hidden="true">▾</span></button><div class="nav-dropdown-panel" id="nav-${id}" hidden>${items.map(link).join('')}</div></div>`;
 const brand=nav.querySelector('.nav-brand')?.outerHTML||'<a class="nav-brand" href="index.html" aria-label="United Gimps overview"><img src="img/gim-crest.svg" alt=""></a>';
 nav.innerHTML=brand+link(['index.html','Overview','O'])+group('logs','Collection Log','G',logs)+group('levels','Levels','XP',levels)+group('record','Record','✦',records)+`<span class="nav-spacer" aria-hidden="true"></span>`+link(['faq.html','FAQ','?']);
 const groups=[...nav.querySelectorAll('.nav-dropdown')];
 function setOpen(group,open){group.querySelector('button').setAttribute('aria-expanded',String(open));group.querySelector('.nav-dropdown-panel').hidden=!open}
 function closeAll(){groups.forEach(g=>setOpen(g,false))}
 for(const g of groups){
  const button=g.querySelector('button');
  const open=()=>{groups.filter(other=>other!==g).forEach(other=>setOpen(other,false));setOpen(g,true)};
  g.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')open()});
  g.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!g.contains(document.activeElement))setOpen(g,false)});
  button.addEventListener('click',()=>{if(button.getAttribute('aria-expanded')==='true')setOpen(g,false);else open()});
  g.addEventListener('focusout',e=>{if(!g.contains(e.relatedTarget))setOpen(g,false)});
  g.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(g,false);button.focus();e.preventDefault()}else if(e.target===button&&e.key==='ArrowDown'){open();g.querySelector('a').focus();e.preventDefault()}});
 }
 document.addEventListener('click',e=>{if(!nav.contains(e.target))closeAll()});
 const recordPages=records.filter(([, , ,badge])=>badge!=='beta');
 const local=levels.some(([href])=>href.split('#')[0]===page)?levels:recordPages.some(([href])=>href.split('#')[0]===page)?recordPages:null;
 if(local){const main=document.querySelector('main.wrap');if(main&&!document.querySelector('#historyLocalNav')){const d=document.createElement('nav');d.id='historyLocalNav';d.className='v21-local-nav';const title=local===levels?'Levels':'Record';d.setAttribute('aria-label',title+' sections');d.innerHTML=`<strong aria-hidden="true">${title}</strong>`+local.map(([h,l])=>`<a href="${h}" class="${isActive(h)?'active':''}" ${isActive(h)?'aria-current="page"':''}>${l}</a>`).join('');const anchor=local===levels?(main.querySelector('#statsMemberPicker')||main.querySelector('.api-courtesy')):main.querySelector('.api-courtesy');anchor?.insertAdjacentElement('afterend',d)}}
 loadV22();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
