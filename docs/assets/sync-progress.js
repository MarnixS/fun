(()=>{
'use strict';
const runs=new Map();
const names={wom:'WOM',temple:'Temple'};
const finished=new Set(['done','warning','failed']);
const stages={logs:'Syncing logs',snapshot:'Loading data',apply:'Updating site'};

function start(source,definitions){
 const name=names[source];
 if(!name)throw new Error('Unknown sync source');
 let host=document.querySelector('#syncProgress');
 if(!host){
  host=document.createElement('section');host.id='syncProgress';host.className='sync-progress';
  host.setAttribute('aria-label','Data sync progress');
  const strip=document.querySelector('main .data-strip');
  if(strip)strip.after(host);else document.querySelector('main')?.prepend(host);
 }
 runs.get(source)?.element.remove();
 const element=document.createElement('article');element.className='sync-progress-run';element.dataset.syncSource=source;
 element.innerHTML=`<div class="sync-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-live="polite" aria-atomic="true"><span class="sync-progress-fill" aria-hidden="true"></span><span class="sync-progress-emblem" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M2 8h3v3h3V8h3V5h3V2h3v6h-3v3h-3v3H8v3H5v-3H2z"/></svg></span><span class="sync-progress-label" aria-hidden="true"></span></div><button class="sync-progress-close" type="button" hidden>×</button>`;
 const query=selector=>element.querySelector(selector),steps=definitions.map(step=>({...step,weight:step.weight||1,status:'pending',note:''}));
 const total=steps.reduce((sum,step)=>sum+step.weight,0);
 let terminal=null,current='',note='',result='',percent=0;
 function render(){
  const settled=steps.filter(step=>finished.has(step.status)||(terminal==='done'||terminal==='warning')&&step.status==='skipped');
  percent=Math.floor(100*settled.reduce((sum,step)=>sum+step.weight,0)/total);
  if(terminal==='done'||terminal==='warning')percent=100;
  else if(!terminal)percent=Math.min(99,percent);
  element.dataset.syncState=terminal||'running';
  const label=terminal?({done:'Done',warning:'Warning',failed:'Failed'}[terminal]+(result?' '+result:'')):(current||'Starting');
  const bar=query('.sync-progress-bar');bar.setAttribute('aria-label',`${name} sync`);bar.setAttribute('aria-valuenow',String(percent));
  bar.setAttribute('aria-busy',String(!terminal));
  bar.title=note||'Approximate progress through completed steps; request times can vary.';
  bar.setAttribute('aria-valuetext',`${percent}% · ${label} · ${settled.length}/${steps.length} steps processed${note?' · '+note:''}`);
  query('.sync-progress-fill').style.width=percent+'%';
  query('.sync-progress-label').textContent=`${name}: ${label} · ${percent}%`;
  const close=query('.sync-progress-close');close.hidden=!terminal;
 }
 const run={element,
  step(id,status='running',message=''){
   if(terminal)return;
   const step=steps.find(step=>step.id===id);if(!step)throw new Error('Unknown sync step');
   step.status=status;step.note=message;current=stages[id]||step.label;note=message;render();
  },
  finish(status,message,summary=''){
   if(terminal)return;
   if(!finished.has(status))throw new Error('Unknown sync result');
   terminal=status;note=message;result=summary;
   for(const step of steps){
    if(status==='failed'&&step.status==='running'){step.status='failed';step.note=message}
    else if(step.status==='pending'||step.status==='running')step.status='skipped';
   }
   render();
  }
 };
 query('.sync-progress-close').setAttribute('aria-label',`Dismiss ${name} sync result`);
 query('.sync-progress-close').onclick=()=>{
  element.remove();runs.delete(source);if(!host.children.length)host.remove();
  document.querySelector(`[data-refresh-${source}]`)?.focus();
 };
 host.append(element);runs.set(source,run);render();return run;
}
window.UGSyncProgress={start};
})();
