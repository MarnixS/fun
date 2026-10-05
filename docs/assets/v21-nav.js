(()=>{
'use strict';
const logs=[['clog-beta.html','Collection Log Classic','G'],['gim.html','Collection Log Advanced','G'],['hypothetical.html','Hypothetical Log','?'],['rng.html','RNG Index','R']];
const levels=[['hiscores.html','Current Stats','H'],['progress.html','Stat Progress','XP'],['cumulative-xp.html','Cumulative XP','XP'],['time-machine.html','Time Machine','⧖']];
const records=[['chronicle.html','Chronicle','✦'],['history.html','Timeline','T'],['goals.html','Goals','◎','beta'],['kc-comparison.html','KC comparison','KC','beta']];
const other=[['faq.html','FAQ','?'],['news.html','News','N'],['experimental.html','Experimental','⚗','beta']];
const experimentalPages=['experimental.html','group-chemistry.html','nemesis.html','nemesis-beta.html'];
function loadV22(){if(document.querySelector('script[data-v22-ui]'))return;const s=document.createElement('script');s.src='assets/v22-ui.js?v=35';s.dataset.v22Ui='1';document.head.append(s)}
function init(){
 const nav=document.querySelector('.nav-inner');if(!nav){loadV22();return}
 nav.closest('.main-nav')?.setAttribute('aria-label','Primary');
 const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 const hash=location.hash.toLowerCase();
 if(hash==='#nemesis-beta'){location.replace('nemesis-beta.html');return}
 const isActive=href=>{const [target,targetHash='']=href.toLowerCase().split('#');if(target==='experimental.html'&&experimentalPages.includes(page))return true;if(page!==target)return false;if(targetHash)return hash===('#'+targetHash);return true};
 const link=([href,label,rune,badge])=>`<a class="nav-link ${isActive(href)?'active':''}" href="${href==='index.html'?'../':href}" ${isActive(href)?'aria-current="page"':''}><span class="nav-rune" aria-hidden="true">${rune}</span><span>${label}</span>${badge==='beta'?'<span class="nav-badge">BETA</span>':''}</a>`;
 const group=(id,label,rune,items)=>`<div class="nav-dropdown"><button type="button" class="nav-trigger ${items.some(([href])=>isActive(href))||id==='other'&&experimentalPages.includes(page)?'active':''}" aria-expanded="false" aria-controls="nav-${id}"><span class="nav-rune" aria-hidden="true">${rune}</span><span>${label}</span><span aria-hidden="true">▾</span></button><div class="nav-dropdown-panel" id="nav-${id}" hidden>${items.map(link).join('')}</div></div>`;
 const brand=nav.querySelector('.nav-brand')?.outerHTML||'<a class="nav-brand" href="../" aria-label="United Gimps overview"><img src="img/gim-crest.svg" alt=""></a>';
 nav.innerHTML=brand+link(['index.html','Overview','O'])+group('logs','Collection Log','G',logs)+group('levels','Stats','XP',levels)+group('record','Records','✦',records)+`<span class="nav-spacer" aria-hidden="true"></span>`+group('other','Other','?',other);
 const mobile=window.matchMedia?.('(max-width:700px)')||{matches:false,addEventListener(){}};
 nav.id='primaryNavigation';
 const groups=[...nav.querySelectorAll('.nav-dropdown')];
 function setOpen(group,open){group.querySelector('button').setAttribute('aria-expanded',String(open));group.querySelector('.nav-dropdown-panel').hidden=!open}
 function closeAll(){groups.forEach(g=>setOpen(g,false))}
 mobile.addEventListener('change',closeAll);
 nav.addEventListener('click',e=>{if(e.target.closest('a'))closeAll()});
 for(const g of groups){
  const button=g.querySelector('button');
  const open=()=>{groups.filter(other=>other!==g).forEach(other=>setOpen(other,false));setOpen(g,true)};
  g.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!mobile.matches)open()});
  g.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!mobile.matches&&!g.contains(document.activeElement))setOpen(g,false)});
  button.addEventListener('click',()=>{if(button.getAttribute('aria-expanded')==='true')setOpen(g,false);else open()});
  g.addEventListener('focusout',e=>{if(!mobile.matches&&!g.contains(e.relatedTarget))setOpen(g,false)});
  g.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(g,false);button.focus();e.preventDefault()}else if(e.target===button&&e.key==='ArrowDown'){open();g.querySelector('a').focus();e.preventDefault()}});
 }
 document.addEventListener('click',e=>{if(!nav.contains(e.target))closeAll()});
 const tabs=[...document.querySelectorAll('[data-gim-tab]')];
 if(tabs.length){const label=document.createElement('label');label.className='mobile-view-picker';label.textContent='Advanced Log view';const select=document.createElement('select');select.id='clogView';select.setAttribute('aria-label',label.textContent);tabs.forEach(b=>select.add(new Option(b.textContent,b.dataset.gimTab,false,b.classList.contains('active'))));select.onchange=()=>tabs.find(b=>b.dataset.gimTab===select.value)?.click();label.append(select);document.querySelector('#clogMemberPicker').before(label);document.addEventListener('ug:gim-view-changed',e=>select.value=e.detail.view)}
 loadV22();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
