(function(root){
'use strict';
// Cached data paints immediately; source checks continue while a page is visible.
function create({sources,storage,now=Date.now,visible=()=>true,onStatus=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
 const running=new Map(),memory=new Map();let timer=null,stopped=true;
 const key=name=>'ug-v28-live-'+name;
 function read(name){let saved={};try{saved=JSON.parse(storage.getItem(key(name))||'{}')}catch{}const local=memory.get(name);return local&&(local.writtenAt||0)>=(saved.writtenAt||0)?local:saved}
 function write(name,value){value={...value,writtenAt:now()};memory.set(name,value);try{storage.setItem(key(name),JSON.stringify(value))}catch{}}
 async function check(name){
  if(running.has(name))return running.get(name);
  const source=sources[name],saved=read(name),time=now();
  if(saved.leaseUntil>time)return;
  if(saved.retryAt>time)return;
  if(saved.checkedAt>time-source.interval){onStatus(name,'cached',{checkedAt:saved.checkedAt});return;}
  const task=(async()=>{
   write(name,{...saved,leaseUntil:time+180000});onStatus(name,'checking');
   try{
    const result=await source.refresh();if(!result)throw new Error('No fresh response');
    write(name,{checkedAt:now(),leaseUntil:0});onStatus(name,'current',result);
   }catch(error){
    write(name,{checkedAt:saved.checkedAt||0,leaseUntil:0,retryAt:now()+60000});
    onStatus(name,'failed',error);
   }
  })();running.set(name,task);try{return await task}finally{running.delete(name)}
 }
 async function tick(){if(!visible())return;await Promise.all(Object.keys(sources).map(check))}
 function schedule(){if(stopped)return;timer=setTimer(async()=>{await tick();schedule()},15000)}
 function start(){if(!stopped)return;stopped=false;tick();schedule()}
 function stop(){stopped=true;if(timer!==null)clearTimer(timer);timer=null}
 function noteSuccess(name){if(sources[name])write(name,{checkedAt:now(),leaseUntil:0})}
 return {start,stop,tick,noteSuccess};
}
if(typeof module==='object'&&module.exports)module.exports={create};else root.UGLiveSync={create};
})(typeof window==='object'?window:globalThis);
