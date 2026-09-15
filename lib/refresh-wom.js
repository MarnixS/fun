'use strict';
const PLAYERS={dikste:'Dikste','big dog aura':'Big Dog Aura',lijpste:'Lijpste','poep aura':'Poep Aura',lompste:'Lompste'};
const {mergeWom}=require('../docs/assets/wom-store');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function requestJson(url,options={}) {
  const response=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'United-Gimps-Shared-Data'}});
  if(!response.ok)throw new Error(`WOM HTTP ${response.status}`);
  return response.json();
}

// One player per bounded request. Every successful request commits independently,
// so closing the browser cannot erase the players already updated by this click.
async function refreshWomPlayer(previous,key,{request=requestJson,pause=wait,now=Date.now}={}) {
  if(!Object.hasOwn(PLAYERS,key))throw new Error('Unknown group member');
  const url='https://api.wiseoldman.net/v2/players/'+encodeURIComponent(PLAYERS[key]);
  const get=async(path='',options)=>{await pause(3200);return request(url+path,options)};
  let profile,updated=true;
  try {profile=await get('',{method:'POST',body:'{}'})}
  catch {updated=false;profile=await get('')}
  const latest=profile?.latestSnapshot||profile?.latest_snapshot;
  if(!latest?.createdAt||!latest?.data)throw new Error('WOM returned no usable latest snapshot');
  const before=previous.profiles?.[key]?.latestSnapshot||previous.profiles?.[key]?.latest_snapshot;
  const rows=[latest],historyFailures=[],detailFailures=[];
  if(before?.createdAt&&Date.parse(latest.createdAt)>Date.parse(before.createdAt)) {
    try {
      const seen=new Set();
      for(let offset=0;offset<1000;offset+=50) {
        const query=new URLSearchParams({startDate:before.createdAt,endDate:latest.createdAt,limit:'50',offset:String(offset)});
        const batch=await get('/snapshots?'+query);
        if(!Array.isArray(batch))throw new Error('Invalid history');
        let added=0;
        for(const row of batch)if(row?.createdAt&&row?.data&&!seen.has(row.createdAt)){seen.add(row.createdAt);rows.push(row);added++}
        if(batch.length<50||!added)break;
        if(offset===950)throw new Error('History page limit');
      }
    } catch {historyFailures.push(key)}
  }
  const achievements={},gains={};
  try {const result=await get('/achievements');if(!Array.isArray(result))throw new Error('Invalid achievements');achievements[key]=result}
  catch {detailFailures.push('achievements: '+PLAYERS[key])}
  for(const period of ['week','month','year']) {
    try {const result=await get('/gained?period='+period);if(!result?.data)throw new Error('Invalid gains');gains[period]={[key]:result}}
    catch {detailFailures.push(period+' gains: '+PLAYERS[key])}
  }
  const fetchedAt=now();
  return mergeWom(previous,{
    source:'Wise Old Man manual shared update',fetchedAt,profiles:{[key]:profile},snapshots:{[key]:rows},achievements,gains,
    refreshDiagnostics:{successfulPlayers:[key],failedPlayers:[],historyFailures,detailFailures,
      trackedOnly:updated?[]:[key],newerSnapshots:!before||Date.parse(latest.createdAt)>Date.parse(before.createdAt)?1:0,refreshedAt:fetchedAt},
  });
}
module.exports={refreshWomPlayer,PLAYERS};
