(()=>{
'use strict';
const TTL=300000;
let data=null,checkedAt=0,sourceLatestAt=0,request=null,failed=false,attemptedAt=0;
function status(){return{checkedAt,sourceLatestAt,stale:failed||!!checkedAt&&Date.now()-checkedAt>=TTL,available:!!data}}
async function load(){
 if(data&&Date.now()-checkedAt<TTL&&!failed)return data;
 if(request)return request;
 if(failed&&Date.now()-attemptedAt<60000)return data;
 attemptedAt=Date.now();
 request=(async()=>{
  try{
   const r=await fetch('https://prices.runescape.wiki/api/v1/osrs/latest',{cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
   if(!r.ok)throw new Error(`GE HTTP ${r.status}`);
   const next=(await r.json()).data;
   if(!next||typeof next!=='object'||Array.isArray(next))throw new Error('Invalid GE price response');
   let latest=0;
   for(const item of Object.values(next))for(const side of ['high','low']){
    const time=Number(item?.[side+'Time']);
    if(Number(item?.[side])>0&&Number.isFinite(time)&&time>0&&time<=Date.now()/1000)latest=Math.max(latest,time);
   }
   data=next;checkedAt=Date.now();sourceLatestAt=latest*1000;failed=false;
  }catch(e){failed=true;console.warn('GE prices unavailable; retaining last successful check',e)}
  window.dispatchEvent?.(new CustomEvent('ug:prices-updated',{detail:status()}));
  return data;
 })();
 try{return await request}finally{request=null}
}
function price(id){id=+id;const ge=x=>{const p=data?.[x];if(!p)return 0;const h=+p.high,l=+p.low;return h>0&&l>0?(h+l)/2:h>0?h:l>0?l:0};if(id===33634)return Math.max(0,ge(33639)-ge(19547));if(id===13274||id===13275||id===13276)return ge(13263)/3;if(id===29799)return Math.max(0,ge(29801)-ge(19553));if(id===29790||id===29792||id===29794)return ge(29796)/3;if(id===28319||id===28321||id===28323||id===28325)return ge(28338)/4;if(id===28279)return Math.max(0,ge(28316)-ge(28301)-500*ge(565)-3*ge(28276));if(id===28281)return Math.max(0,ge(28313)-ge(28304)-500*ge(565)-3*ge(28276));if(id===28283)return Math.max(0,ge(28310)-ge(28298)-500*ge(565)-3*ge(28276));if(id===28285)return Math.max(0,ge(28307)-ge(28295)-500*ge(565)-3*ge(28276));return ge(id)}
window.UGPrices={load,price,status,peek:()=>data};
})();
