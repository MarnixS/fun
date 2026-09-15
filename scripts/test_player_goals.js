'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const handler=require('../api/player-goals');
const G=require('../docs/assets/goal-progress');
async function call(body,method='POST'){
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}};
 await handler({method,headers:{origin:'https://marnixs.github.io','content-type':'application/json'},body},res);return res;
}
async function run(){
 const oldFetch=global.fetch,oldToken=process.env.GOALS_GITHUB_TOKEN,oldCodes=process.env.GOAL_EDIT_CODE_HASHES;
 try{
  delete process.env.GOALS_GITHUB_TOKEN;assert.equal((await call(null,'GET')).statusCode,503);
  process.env.GOALS_GITHUB_TOKEN='test-only';process.env.GOAL_EDIT_CODE_HASHES=JSON.stringify(Object.fromEntries(['dikste','big dog aura','lijpste','poep aura','lompste'].map(k=>[k,createHash('sha256').update('test-code').digest('hex')])));
  let calls=0,written;let doc={goals:{lijpste:null,dikste:{text:'Other goal',updatedAt:'2020-01-01T00:00:00Z'}}};
  global.fetch=async(url,options)=>{calls++;if(options.method==='PUT'){written=JSON.parse(Buffer.from(JSON.parse(options.body).content,'base64').toString());return{ok:true,status:200};}return{ok:true,json:async()=>({sha:'version1',content:Buffer.from(JSON.stringify(doc)).toString('base64')})};};
  const body={player:'lijpste',text:'99 Slayer',kind:'level',metric:'slayer',targetValue:99,code:'wrong',version:null};
  assert.equal((await call(body)).statusCode,403);assert.equal(calls,0,'wrong code never reaches GitHub');
  body.code='test-code';const saved=await call(body);assert.equal(saved.statusCode,200);assert.equal(written.goals.lijpste.text,'99 Slayer');assert.equal(written.goals.dikste.text,'Other goal');assert(!JSON.stringify(written).includes('test-code'));assert(!JSON.stringify(written).includes('test-only'));
  doc=written;assert.equal((await call(body)).statusCode,409,'stale edit cannot overwrite a newer goal');body.version=doc.goals.lijpste.updatedAt;assert.equal((await call(body)).statusCode,429,'rapid writes bounded');
  assert.throws(()=>handler.validate({...body,targetValue:Infinity}));assert.throws(()=>handler.validate({...body,targetValue:100}));assert.throws(()=>handler.validate({...body,kind:'unknown'}));
  const wom={profiles:{lijpste:{latestSnapshot:{data:{skills:{slayer:{level:95,experience:100}},bosses:{zulrah:{kills:-1}}}}}}};
  assert.equal(G.progress(body,'lijpste',wom,{}).value,95);
  assert.equal(G.progress({...body,kind:'boss',metric:'zulrah'},'lijpste',wom,{}).unknown,true);
  assert.equal(G.progress({...body,kind:'collection'},'lijpste',wom,{}).unknown,true);
  const temple={players:{lijpste:{data:{items:[{id:10,count:1},{id:10,count:2},{id:11,count:0}]}}}};
  assert.equal(G.progress({...body,kind:'collection',targetValue:2},'lijpste',wom,temple).value,1);
  assert.equal(G.progress({...body,kind:'item',metric:'10',targetValue:1},'lijpste',wom,temple).complete,true);
  assert.equal(G.progress({...body,kind:'manual',current:30,targetValue:100},'lijpste',wom,temple).percent,30);
  console.log('Shared goal validation, authorization, concurrency, secret exclusion and progress tests passed');
 }finally{global.fetch=oldFetch;if(oldToken===undefined)delete process.env.GOALS_GITHUB_TOKEN;else process.env.GOALS_GITHUB_TOKEN=oldToken;if(oldCodes===undefined)delete process.env.GOAL_EDIT_CODE_HASHES;else process.env.GOAL_EDIT_CODE_HASHES=oldCodes;}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
