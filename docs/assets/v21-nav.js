(()=>{
'use strict';
try{
 const k='ug-v20-temple-cache',x=JSON.parse(localStorage.getItem(k)||'null');
 if(x?.source==='TempleOSRS browser refresh'){
  localStorage.removeItem(k);
  if(!sessionStorage.getItem('ug-v24-temple-cache-cleaned')){
   sessionStorage.setItem('ug-v24-temple-cache-cleaned','1');
   location.reload();
   return;
  }
 }
}catch{}
const order=[
 ['index.html','Overview','O'],
 ['gim.html','Collection Log','G','GIM'],
 ['hiscores.html','Hiscores','H'],
 ['progress.html','XP & Progress','XP'],
 ['history.html','History','T'],
 ['time-machine.html','Time Machine','⧖'],
 ['chronicle.html','Chronicle','✦']
];
function loadV22(){if(document.querySelector('script[data-v22-ui]'))return;const s=document.createElement('script');s.src='assets/v22-ui.js';s.dataset.v22Ui='1';document.head.append(s)}
function init(){const nav=document.querySelector('.nav-inner');if(!nav){loadV22();return}const outer=nav.closest('.main-nav');outer?.setAttribute('aria-label','Primary');const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();const brand=nav.querySelector('.nav-brand')?.outerHTML||'<a class="nav-brand" href="index.html" aria-label="United Gimps overview"><img src="img/gim-crest.svg" alt=""></a>';nav.innerHTML=brand+order.map(([href,label,rune,badge],i)=>`<a class="nav-link ${page===href?'active':''} ${i===4?'nav-group-start':''}" href="${href}" ${page===href?'aria-current="page"':''}><span class="nav-rune" aria-hidden="true">${rune}</span><span>${label}</span>${badge?`<span class="nav-badge" aria-hidden="true">${badge}</span>`:''}</a>`).join('');if(['history.html','time-machine.html','chronicle.html'].includes(page)){const main=document.querySelector('main.wrap');if(main&&!document.querySelector('#historyLocalNav')){const d=document.createElement('nav');d.id='historyLocalNav';d.className='v21-local-nav';d.setAttribute('aria-label','History sections');d.innerHTML='<strong aria-hidden="true">History</strong>'+[['history.html','Overview'],['time-machine.html','Time Machine'],['chronicle.html','Chronicle']].map(([h,l])=>`<a href="${h}" class="${page===h?'active':''}" ${page===h?'aria-current="page"':''}>${l}</a>`).join('');const after=main.querySelector('.api-courtesy');after?.insertAdjacentElement('afterend',d)}}loadV22()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();