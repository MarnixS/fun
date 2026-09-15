'use strict';
const {mergeWom,mergeTemple}=require('../docs/assets/wom-store');
const REPO='https://api.github.com/repos/MarnixS/fun';
const FILES={wom:'docs/data/wom-cache.json',temple:'docs/data/temple-clog.json'};

function createStore({token,request=fetch}={}) {
  async function github(path,options={}) {
    const response=await request(REPO+path,{
      ...options,cache:'no-store',signal:AbortSignal.timeout(20000),
      headers:{Accept:'application/vnd.github+json','User-Agent':'United-Gimps-Shared-Data',
        ...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers},
    });
    return response;
  }
  function file(source) {
    if(!Object.hasOwn(FILES,source))throw new Error('Unknown data source');
    return FILES[source];
  }
  async function manifest(source) {
    file(source);
    const response=await github('/git/ref/heads/main');
    if(!response.ok)throw new Error('Could not read the shared baseline');
    const result=await response.json(),revision=result.object?.sha;
    if(!/^[a-f0-9]{40}$/.test(revision))throw new Error('Invalid shared revision');
    return {source,revision};
  }
  async function read(source) {
    const response=await github('/contents/'+file(source)+'?ref=main',{headers:{Accept:'application/vnd.github.object+json'}});
    if(!response.ok)throw new Error('Could not read the saved '+source+' baseline');
    const metadata=await response.json();
    let doc;
    if(metadata.encoding==='base64'&&metadata.content)doc=JSON.parse(Buffer.from(metadata.content,'base64').toString('utf8'));
    else {
      if(!/^[a-f0-9]{40}$/.test(metadata.sha))throw new Error('Invalid saved file');
      // GitHub omits inline content for files over 1 MB. Read the exact blob,
      // never a changing branch URL between the metadata read and the write.
      const raw=await github('/git/blobs/'+metadata.sha,{headers:{Accept:'application/vnd.github.raw+json'}});
      if(!raw.ok)throw new Error('Could not read saved history');
      doc=await raw.json();
    }
    if(!(source==='wom'?doc?.profiles:doc?.players))throw new Error('Invalid saved baseline');
    return {sha:metadata.sha,doc};
  }
  async function save(source,candidate) {
    if(!token)throw new Error('Shared data publishing is not configured');
    for(let attempt=0;attempt<4;attempt++) {
      const current=await read(source);
      const doc=(source==='wom'?mergeWom:mergeTemple)(current.doc,candidate);
      const response=await github('/contents/'+file(source),{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({branch:'main',sha:current.sha,message:`Save manual ${source.toUpperCase()} baseline [skip ci]`,content:Buffer.from(JSON.stringify(doc)+'\n').toString('base64')}),
      });
      if(response.status===409||response.status===422)continue;
      if(!response.ok)throw new Error('Could not confirm the shared save');
      const result=await response.json();
      if(!/^[a-f0-9]{40}$/.test(result.commit?.sha))throw new Error('Could not confirm the shared revision');
      return {source,revision:result.commit.sha,saved:true,diagnostics:candidate.refreshDiagnostics||{}};
    }
    throw new Error('Other updates are being saved. Your previous shared baseline is safe; try again.');
  }
  return {manifest,read,save};
}
module.exports={createStore,FILES};
