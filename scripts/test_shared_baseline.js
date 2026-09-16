'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const {IDBFactory}=require('fake-indexeddb');
const {createStore}=require('../lib/shared-data-store');
const {createHandler}=require('../api/shared-data');
const {refreshWomPlayer}=require('../lib/refresh-wom');
const {mergeWom,mergeTemple}=require('../docs/assets/wom-store');
const wom=JSON.parse(fs.readFileSync('docs/data/wom-cache.json'));
const temple=JSON.parse(fs.readFileSync('docs/data/temple-clog.json'));
const clone=structuredClone;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
function repository(){
 const files=new Map(),blobs=new Map(),commits=new Map(),calls=[];let head='0'.repeat(40),serial=0,failWrites=false;
 function put(source,doc){const content=JSON.stringify(doc),sha=createHash('sha1').update(content).digest('hex');files.set(source,{sha,doc:clone(doc)});blobs.set(sha,content);head=(++serial).toString(16).padStart(40,'0');commits.set(head,new Map([...files].map(([k,v])=>[k,clone(v.doc)])));}
 put('wom',wom);put('temple',temple);
 async function request(url,options={}){
  const parsed=new URL(url),method=options.method||'GET';calls.push({path:parsed.pathname,method});
  if(parsed.pathname.endsWith('/git/ref/heads/main'))return json({object:{sha:head}});
  if(parsed.pathname.includes('/git/blobs/'))return new Response(blobs.get(parsed.pathname.split('/').at(-1)));
  const source=parsed.pathname.endsWith('/wom-cache.json')?'wom':parsed.pathname.endsWith('/temple-clog.json')?'temple':null;
  assert(source,'only the two fixed snapshot files may be accessed');const file=files.get(source);
  if(method==='GET')return json({sha:file.sha,encoding:'none',content:''});
  assert.equal(method,'PUT');const body=JSON.parse(options.body);
  if(failWrites)return json({error:'unavailable'},503);
  if(body.sha!==file.sha)return json({error:'conflict'},409);
  assert.equal(body.branch,'main');put(source,JSON.parse(Buffer.from(body.content,'base64').toString()));
  return json({commit:{sha:head}});
 }
 return {request,files,commits,calls,fail:()=>{failWrites=true}};
}
function laterWom(key,amount=100,date='2026-09-16T12:00:00Z'){
 const doc=clone(wom),snapshot=doc.profiles[key].latestSnapshot;doc.fetchedAt=Date.parse(date);snapshot.createdAt=date;snapshot.id=-1;snapshot.data.skills.overall.experience+=amount;doc.snapshots[key].push(clone(snapshot));return doc;
}
async function call(handler,{method='GET',body,source='wom',origin='https://marnixs.github.io',type='application/json'}={}){
 const headers=new Map();let value;
 const res={statusCode:200,setHeader:(k,v)=>headers.set(k.toLowerCase(),v),end:text=>{value=text?JSON.parse(text):null}};
 await handler({method,url:'/api/shared-data?source='+source,body,headers:{origin,'content-type':type}},res);
 return {status:res.statusCode,value,headers};
}
async function backendTests(){
 const repo=repository(),store=createStore({token:'test-only',request:repo.request});let womCalls=0,templeCalls=0;
 const handler=createHandler({store,refreshWom:async()=>{womCalls++;return laterWom('dikste')},refreshTemple:async previous=>{templeCalls++;return {...previous,fetchedAt:Date.now()}}});
 for(let i=0;i<3;i++)for(const source of ['wom','temple'])assert.equal((await call(handler,{source})).status,200);
 assert.equal(womCalls+templeCalls,0,'page loads only read saved manifests');
 const first=await call(handler,{method:'POST',body:{source:'wom',player:'dikste'}});
 assert.equal(first.status,200);assert.equal(first.value.saved,true);assert.equal(womCalls,1);assert.equal(templeCalls,0);
 assert(JSON.stringify(first.value).length<2000,'full 5 MB WOM history never goes through the function response');
 const otherVisitor=await createStore({token:'test-only',request:repo.request}).manifest('wom');
 assert.equal(otherVisitor.revision,first.value.revision,'another process reads the committed baseline');
 assert.equal(repo.commits.get(otherVisitor.revision).get('wom').profiles.dikste.latestSnapshot.data.skills.overall.experience,wom.profiles.dikste.latestSnapshot.data.skills.overall.experience+100);
 assert(repo.calls.some(c=>c.path.includes('/git/blobs/')),'large WOM file uses GitHub raw blob read');
 const before=clone(repo.files.get('wom').doc);
 assert.equal((await call(handler,{method:'POST',body:{source:'temple'},source:'temple'})).status,200);
 assert.deepEqual(repo.files.get('wom').doc,before,'Temple updates cannot change WOM');
 const written=repo.calls.filter(c=>c.method==='PUT').length;
 for(const request of [{method:'POST',body:{source:'wom',player:'outsider'}},{method:'POST',body:{source:'temple',document:{players:{}}}},{method:'POST',body:{source:'temple'},origin:'https://example.com'},{method:'POST',body:{source:'temple'},type:'text/plain'},{method:'POST',body:'invalid'},{method:'DELETE'}])assert((await call(handler,request)).status>=400);
 assert.equal(repo.calls.filter(c=>c.method==='PUT').length,written,'invalid requests cannot save');
 assert.equal((await call(createHandler({store,enabled:false}),{method:'POST',body:{source:'wom',player:'dikste'}})).status,503);
 const broken=createHandler({store,refreshWom:async()=>{throw Error('WOM unavailable')}});
 assert.equal((await call(broken,{method:'POST',body:{source:'wom',player:'dikste'}})).status,502);
 assert.equal(repo.calls.filter(c=>c.method==='PUT').length,written,'failed upstream leaves baseline untouched');
 repo.fail();const failed=await call(handler,{method:'POST',body:{source:'wom',player:'dikste'}});
 assert.equal(failed.status,502);assert(!failed.value.saved,'a failed write is never reported as saved');assert.deepEqual(repo.files.get('wom').doc,before);
 const concurrent=repository(),one=createStore({token:'test',request:concurrent.request}),other=createStore({token:'test',request:concurrent.request});
 await Promise.all([one.save('wom',laterWom('dikste',101)),other.save('wom',laterWom('lijpste',202))]);
 const combined=concurrent.files.get('wom').doc;
 assert.equal(combined.profiles.dikste.latestSnapshot.data.skills.overall.experience,wom.profiles.dikste.latestSnapshot.data.skills.overall.experience+101);
 assert.equal(combined.profiles.lijpste.latestSnapshot.data.skills.overall.experience,wom.profiles.lijpste.latestSnapshot.data.skills.overall.experience+202);
 assert(concurrent.calls.filter(c=>c.method==='PUT').length>=3,'SHA conflicts are retried against the current file');
 const stale=clone(wom);stale.fetchedAt=Date.now()+864000000;await one.save('wom',stale);
 assert.equal(concurrent.files.get('wom').doc.profiles.dikste.latestSnapshot.createdAt,'2026-09-16T12:00:00Z','late old data cannot roll back source snapshots');
 console.log('Shared backend: visitors, restart, 5 MB history, source isolation, conflicts, stale responses, validation and failures passed');
}
async function upstreamTests(){
 const profile=laterWom('dikste').profiles.dikste,requested=[];
 const request=async(url,options={})=>{
  requested.push(url);
  if(url.includes('/snapshots?'))return [profile.latestSnapshot,{...profile.latestSnapshot,createdAt:'2026-09-15T20:00:00Z'}];
  if(url.endsWith('/achievements')||url.includes('/gained?period=month'))throw Error('partial failure');
  if(url.includes('/gained'))return {startsAt:'2026-09-01T00:00:00Z',endsAt:'2026-09-16T12:00:00Z',data:{skills:{overall:{experience:{gained:123}}}}};
  if(options.method==='POST')throw Error('WOM update unavailable');return profile;
 };
 const result=await refreshWomPlayer(wom,'dikste',{request,pause:async()=>{},now:()=>Date.parse('2026-09-16T12:01:00Z')});
 assert.equal(result.profiles.dikste.latestSnapshot.createdAt,profile.latestSnapshot.createdAt);assert.deepEqual(result.profiles.lompste,wom.profiles.lompste);
 assert.deepEqual(result.achievements.dikste,wom.achievements.dikste);assert.deepEqual(result.gains.month.dikste,wom.gains.month.dikste);
 assert.equal(result.gains.week.dikste.data.skills.overall.experience.gained,123);
 assert(result.snapshots.dikste.some(s=>s.createdAt==='2026-09-15T20:00:00Z'));assert(result.snapshots.dikste.length>wom.snapshots.dikste.length);
 assert.equal(result.snapshots.dikste.filter(s=>s.createdAt===profile.latestSnapshot.createdAt).length,1,'sentinel IDs never collapse history');
 assert.deepEqual(result.refreshDiagnostics.trackedOnly,['dikste']);assert.equal(result.refreshDiagnostics.detailFailures.length,2);
 assert(requested.every(url=>url.includes('/Dikste')),'requests target only the fixed group member');
 assert.deepEqual(mergeWom(laterWom('dikste'),{profiles:{lompste:wom.profiles.lompste},fetchedAt:Date.now()+1}).profiles.dikste,profile);
 const partial=clone(temple);delete partial.players.lompste;partial.fetchedAt=Date.now();assert.deepEqual(mergeTemple(temple,partial).players.lompste,temple.players.lompste);
 console.log('WOM upstream: POST fallback, full history and partial detail retention passed');
}
function client(idb){
 const storage=new Map(),window={indexedDB:idb,addEventListener(){},dispatchEvent(){}};
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(k.endsWith('-cache'))throw Error('quota');storage.set(k,v)},removeItem:k=>storage.delete(k)};
 const context=vm.createContext({window,indexedDB:idb,localStorage,setTimeout,clearTimeout,Date,console,AbortSignal,fetch:()=>{throw Error('no automatic requests')},CustomEvent:class {}});
 vm.runInContext(fs.readFileSync('docs/assets/wom-store.js','utf8'),context);return window;
}
async function storageTests(){
 const idb=new IDBFactory(),a=client(idb),fresh=laterWom('dikste');assert(await a.UGWomStore.save(fresh));
 const reopened=client(idb);assert.equal((await reopened.UGWomStore.latest(null)).profiles.dikste.latestSnapshot.createdAt,fresh.profiles.dikste.latestSnapshot.createdAt);
 await Promise.all([a.UGWomStore.save(laterWom('lijpste',202)),reopened.UGWomStore.save({...wom,fetchedAt:Date.now()+864000000})]);
 const saved=await client(idb).UGWomStore.latest(null);
 assert.equal(saved.profiles.dikste.latestSnapshot.createdAt,fresh.profiles.dikste.latestSnapshot.createdAt);
 assert.equal(saved.profiles.lijpste.latestSnapshot.data.skills.overall.experience,wom.profiles.lijpste.latestSnapshot.data.skills.overall.experience+202);
 await a.UGTempleStore.save(temple);const partial=clone(temple);delete partial.players.lompste;partial.fetchedAt=Date.now();await reopened.UGTempleStore.save(partial);
 assert.equal((await client(idb).UGTempleStore.latest(null)).membersWithClog,5);
 console.log('IndexedDB: full history, quota, reload, concurrent tabs and missing Temple member passed');
}
(async()=>{await backendTests();await upstreamTests();await storageTests()})().catch(e=>{console.error(e);process.exitCode=1});
