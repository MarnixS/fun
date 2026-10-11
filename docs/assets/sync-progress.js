(()=>{
'use strict';
const runs=new Map();
const names={wom:'WOM',temple:'Temple'};
const finished=new Set(['done','warning','failed']);
const symbols={pending:'·',running:'›',done:'✓',warning:'!',failed:'×',skipped:'–'};

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
 element.innerHTML=`<div class="sync-progress-head"><p class="sync-progress-heading"></p><button class="sync-progress-close" type="button" hidden>Dismiss</button></div><div class="sync-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="sync-progress-fill" aria-hidden="true"></span><span class="sync-progress-label" aria-hidden="true"></span></div><p class="sync-progress-current" role="status" aria-live="polite" aria-atomic="true"></p><p class="sync-progress-completed"></p><details class="sync-progress-details"><summary></summary><ol></ol></details>`;
 const query=selector=>element.querySelector(selector),steps=definitions.map(step=>({...step,weight:step.weight||1,status:'pending',note:''}));
 const nodes=new Map();
 for(const step of steps){
  const row=document.createElement('li');row.dataset.syncStep=step.id;
  const icon=document.createElement('span');icon.className='sync-progress-icon';icon.setAttribute('aria-hidden','true');
  const copy=document.createElement('span');copy.className='sync-progress-step-copy';row.append(icon,copy);
  query('ol').append(row);nodes.set(step.id,{row,icon,copy});
 }
 const total=steps.reduce((sum,step)=>sum+step.weight,0);
 let terminal=null,current='',note='',percent=0;
 function render(){
  const settled=steps.filter(step=>finished.has(step.status)),done=steps.filter(step=>step.status==='done');
  percent=Math.floor(100*settled.reduce((sum,step)=>sum+step.weight,0)/total);
  if(!terminal)percent=Math.min(99,percent);
  element.dataset.syncState=terminal||'running';
  query('.sync-progress-heading').textContent=terminal?(terminal==='done'?`${name} sync complete`:terminal==='warning'?`${name} sync finished with warnings`:`${name} sync failed`):`${name} is syncing - please wait...`;
  const label=terminal?(terminal==='done'?'Sync complete':terminal==='warning'?'Finished with warnings':'Sync stopped'):(current||'Preparing sync');
  const bar=query('.sync-progress-bar');bar.setAttribute('aria-label',`${name} sync`);bar.setAttribute('aria-valuenow',String(percent));
  bar.title='Approximate progress through completed steps; request times can vary.';
  bar.setAttribute('aria-valuetext',`${percent}% · ${label} · ${settled.length}/${steps.length} steps processed${terminal==='failed'?' · failed':''}`);
  query('.sync-progress-fill').style.width=percent+'%';
  query('.sync-progress-label').textContent=`${label} - ${percent}%`;
  query('.sync-progress-current').textContent=note||'Progress follows completed steps; request times can vary.';
  query('.sync-progress-completed').textContent=done.length?'Completed: '+done.map(step=>step.label).join(' · '):'Completed: none yet';
  const issues=steps.filter(step=>step.status==='warning'||step.status==='failed');
  query('summary').textContent=`${settled.length}/${steps.length} steps processed${issues.length?' · '+issues.length+' with warnings or failures':''} · View steps`;
  for(const step of steps){
   const node=nodes.get(step.id);node.row.dataset.stepState=step.status;node.icon.textContent=symbols[step.status];
   const status={pending:'Waiting',running:'In progress',done:'Completed',warning:'Warning',failed:'Failed',skipped:'Not reached'}[step.status];
   node.copy.textContent=`${step.label} · ${status}${step.note?' · '+step.note:''}`;
  }
  const close=query('.sync-progress-close');close.hidden=!terminal;
 }
 const run={element,
  step(id,status='running',message=''){
   if(terminal)return;
   const step=steps.find(step=>step.id===id);if(!step)throw new Error('Unknown sync step');
   step.status=status;step.note=message;current=step.label;note=message;render();
  },
  finish(status,message){
   terminal=status;note=message;
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
