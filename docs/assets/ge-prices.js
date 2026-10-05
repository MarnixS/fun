(()=>{
'use strict';
const TTL=12*60*60*1000,CACHE_KEY='ug-ge-price-snapshot-v1',SNAPSHOT_URL='https://raw.githubusercontent.com/MarnixS/fun/main/docs/data/ge-prices.json';
let data=null,checkedAt=0,sourceLatestAt=0,request=null,failed=false,attemptedAt=0;
function status(){return{checkedAt,sourceLatestAt,refreshIntervalHours:12,stale:failed||!!checkedAt&&Date.now()-checkedAt>=TTL,available:!!data}}
function accept(snapshot){
 const next=snapshot?.data,time=Number(snapshot?.fetchedAt);
 if(!next||typeof next!=='object'||Array.isArray(next)||!Number.isFinite(time)||time<=0||time>Date.now())throw new Error('Invalid saved GE price snapshot');
 if(time<checkedAt)return;
 let latest=0;
 for(const item of Object.values(next))for(const side of ['high','low']){
  const quoteTime=Number(item?.[side+'Time']);
  if(Number(item?.[side])>0&&Number.isFinite(quoteTime)&&quoteTime>0&&quoteTime<=time/1000)latest=Math.max(latest,quoteTime);
 }
 data=next;checkedAt=time;sourceLatestAt=latest*1000;
}
try{const saved=window.localStorage?.getItem(CACHE_KEY);if(saved)accept(JSON.parse(saved))}catch{}
async function load(){
 if(data&&Date.now()-checkedAt<TTL&&!failed)return data;
 if(request)return request;
 if(failed&&Date.now()-attemptedAt<60000)return data;
 attemptedAt=Date.now();
 request=(async()=>{
  try{
   const sources=data?[SNAPSHOT_URL]:[SNAPSHOT_URL,'data/ge-prices.json'];let error;
   for(const url of sources){
    try{
     const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
     if(!r.ok)throw new Error(`Saved GE snapshot HTTP ${r.status}`);
     accept(await r.json());error=null;break;
    }catch(e){error=e}
   }
   if(error)throw error;
   failed=false;
   try{window.localStorage?.setItem(CACHE_KEY,JSON.stringify({fetchedAt:checkedAt,data}))}catch{}
  }catch(e){failed=true;console.warn('Saved GE prices unavailable; retaining the last price snapshot',e)}
  window.dispatchEvent?.(new CustomEvent('ug:prices-updated',{detail:status()}));
  return data;
 })();
 try{return await request}finally{request=null}
}
function price(id){id=+id;const ge=x=>{const p=data?.[x];if(!p)return 0;const h=+p.high,l=+p.low;return h>0&&l>0?(h+l)/2:h>0?h:l>0?l:0};if(id===33634)return Math.max(0,ge(33639)-ge(19547));if(id===13274||id===13275||id===13276)return ge(13263)/3;if(id===29799)return Math.max(0,ge(29801)-ge(19553));if(id===29790||id===29792||id===29794)return ge(29796)/3;if(id===28319||id===28321||id===28323||id===28325)return ge(28338)/4;if(id===28279)return Math.max(0,ge(28316)-ge(28301)-500*ge(565)-3*ge(28276));if(id===28281)return Math.max(0,ge(28313)-ge(28304)-500*ge(565)-3*ge(28276));if(id===28283)return Math.max(0,ge(28310)-ge(28298)-500*ge(565)-3*ge(28276));if(id===28285)return Math.max(0,ge(28307)-ge(28295)-500*ge(565)-3*ge(28276));return ge(id)}
window.UGPrices={load,price,status,peek:()=>data};
})();
