'use strict';
const {createStore}=require('../lib/shared-data-store');
const {refreshWomPlayer,PLAYERS}=require('../lib/refresh-wom');
const temple=require('./temple-collection-log');
const {mergeTemple}=require('../docs/assets/wom-store');
const ORIGIN='https://marnixs.github.io';

function createHandler({store,refreshWom=refreshWomPlayer,refreshTemple=temple.buildDocument,enabled=true}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Origin',ORIGIN);
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Accept');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    const send=(status,doc)=>{res.statusCode=status;res.end(JSON.stringify(doc))};
    if(req.headers?.origin&&req.headers.origin!==ORIGIN)return send(403,{error:'Origin not allowed'});
    if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
    if(!['GET','POST'].includes(req.method))return send(405,{error:'Method not allowed'});
    let source,player;
    if(req.method==='GET')source=new URL(req.url,'https://localhost').searchParams.get('source')||req.query?.source;
    else {
      if(req.headers?.origin!==ORIGIN)return send(403,{error:'Use the update buttons on the group website'});
      if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'Send JSON'});
      try {
        const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
        if(!body||JSON.stringify(body).length>256||Object.keys(body).some(k=>!['source','player'].includes(k)))throw new Error();
        ({source,player}=body);
      }catch{return send(400,{error:'Choose a data source and group member'})}
    }
    if(!['wom','temple'].includes(source))return send(400,{error:'Unknown data source'});
    if(req.method==='POST'&&source==='wom'&&!Object.hasOwn(PLAYERS,player))return send(400,{error:'Unknown group member'});
    if(req.method==='POST'&&!enabled)return send(503,{error:'Shared data publishing is not configured. The previous baseline is unchanged.'});
    try {
      // Reading a page or opening a new tab never contacts WOM or Temple.
      if(req.method==='GET')return send(200,await store.manifest(source));
      const {doc:previous}=await store.read(source);
      const fresh=source==='wom'?await refreshWom(previous,player):mergeTemple(previous,await refreshTemple(previous));
      return send(200,await store.save(source,fresh));
    }catch(error){return send(502,{error:error.message||'Could not confirm the shared update. Reload to check the saved baseline.'})}
  };
}
module.exports=async(req,res)=>{
  const token=process.env.DATA_GITHUB_TOKEN||process.env.GOALS_GITHUB_TOKEN;
  return createHandler({store:createStore({token}),enabled:!!token})(req,res);
};
module.exports.createHandler=createHandler;
