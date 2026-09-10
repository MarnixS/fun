(()=>{
'use strict';
const order=[
 ['index.html','Overview','O'],
 ['gim.html','Collection Log','G','GIM'],
 ['hiscores.html','Hiscores','H'],
 ['progress.html','XP & Progress','XP'],
 ['history.html','History','T'],
 ['time-machine.html','Time Machine','⧖'],
 ['chronicle.html','Chronicle','✦']
];
function init(){const nav=document.querySelector('.nav-inner');if(!nav)return;const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();const brand=nav.querySelector('.nav-brand')?.outerHTML||'<a class="nav-brand" href="index.html" aria-label="United Gimps overview"><img src="img/gim-crest.svg" alt=""></a>';nav.innerHTML=brand+order.map(([href,label,rune,badge],i)=>`<a class="nav-link ${page===href?'active':''} ${i===4?'nav-group-start':''}" href="${href}" ${page===href?'aria-current="page"':''}><span class="nav-rune">${rune}</span><span>${label}</span>${badge?`<span class="nav-badge">${badge}</span>`:''}</a>`).join('');if(['history.html','time-machine.html','chronicle.html'].includes(page)){const main=document.querySelector('main.wrap');if(main&&!document.querySelector('#historyLocalNav')){const d=document.createElement('div');d.id='historyLocalNav';d.className='v21-local-nav';d.innerHTML='<strong>History</strong>'+[['history.html','Overview'],['time-machine.html','Time Machine'],['chronicle.html','Chronicle']].map(([h,l])=>`<a href="${h}" class="${page===h?'active':''}" ${page===h?'aria-current="page"':''}>${l}</a>`).join('');const after=main.querySelector('.api-courtesy');after?.insertAdjacentElement('afterend',d)}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();