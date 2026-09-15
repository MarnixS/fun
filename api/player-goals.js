'use strict';
const { createHash, timingSafeEqual } = require('node:crypto');
const ORIGIN = 'https://marnixs.github.io';
const URL = 'https://api.github.com/repos/MarnixS/fun/contents/docs/data/goals.json';
const PLAYERS = ['dikste', 'big dog aura', 'lijpste', 'poep aura', 'lompste'];
function validate(body) {
  if (!body || !PLAYERS.includes(body.player)) throw new Error('Choose a group member.');
  if (body.clear === true) return null;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 140) throw new Error('Use 1–140 characters for your goal.');
  const kind = body.kind || 'none';
  if (!['none', 'manual', 'level', 'xp', 'boss', 'collection', 'item'].includes(kind)) throw new Error('Unknown progress type.');
  if (kind === 'none') return {text,kind,metric:'',targetValue:null,current:null};
  const targetValue = Number(body.targetValue), current = Number(body.current || 0);
  if (!Number.isFinite(targetValue) || targetValue <= 0 || targetValue > 1e12 || !Number.isFinite(current) || current < 0 || current > 1e12) throw new Error('Enter a positive target and a valid current amount.');
  const metric = String(body.metric || '');
  if (['level', 'xp', 'boss'].includes(kind) && !/^[a-z][a-z0-9_]{0,79}$/.test(metric)) throw new Error('Choose a metric.');
  if (kind === 'level' && targetValue > (metric === 'overall' ? 3000 : 99)) throw new Error('Enter a valid level target.');
  if (kind === 'item' && !/^[1-9][0-9]{0,7}$/.test(metric)) throw new Error('Choose a Collection Log item.');
  return { text, kind, metric: ['manual','collection'].includes(kind) ? '' : metric, targetValue: kind === 'item' ? 1 : targetValue, current: kind === 'manual' ? current : null };
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  if (req.headers.origin === ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  const reply = (status, data) => res.status(status).json(data);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return reply(405, {error:'Method not allowed.'});
  let codes;
  try { codes = JSON.parse(process.env.GOAL_EDIT_CODE_HASHES || '{}'); } catch { codes = {}; }
  const token = process.env.GOALS_GITHUB_TOKEN;
  const enabled = Boolean(token && PLAYERS.every(p => /^[a-f0-9]{64}$/.test(codes[p] || '')));
  if (!enabled) return reply(503, {error:'Shared goal publishing is not configured yet.', enabled:false});
  let body, goal;
  if (req.method === 'POST') {
    if (req.headers.origin !== ORIGIN) return reply(403,{error:'Use the goal editor on the group website.'});
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return reply(415,{error:'Send JSON.'});
    if (Number(req.headers['content-length']) > 4096) return reply(413,{error:'Goal is too long.'});
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (JSON.stringify(body).length > 4096) return reply(413,{error:'Goal is too long.'});
      goal = validate(body);
    } catch (e) { return reply(400,{error:e.message}); }
    const actual = createHash('sha256').update(String(body.code || '')).digest();
    if (!timingSafeEqual(actual, Buffer.from(codes[body.player], 'hex'))) return reply(403,{error:'The edit code is incorrect for this player.'});
  }
  const headers = {Accept:'application/vnd.github+json', Authorization:`Bearer ${token}`, 'User-Agent':'United-Gimps-Goals'};
  try {
    for (let attempt=0; attempt<2; attempt++) {
      const result = await fetch(URL+'?ref=main', {headers, cache:'no-store', signal:AbortSignal.timeout(10000)});
      if (!result.ok) throw new Error('read');
      const file = await result.json();
      const doc = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      if (!doc.goals || typeof doc.goals !== 'object') throw new Error('document');
      if (req.method === 'GET') return reply(200,{...doc,enabled:true});
      const previous = doc.goals[body.player];
      if ((previous?.updatedAt || null) !== (body.version || null)) return reply(409,{error:'This goal changed. Reload shared goals before editing again.'});
      if (previous?.updatedAt && Date.now()-Date.parse(previous.updatedAt)<30000) return reply(429,{error:'Wait 30 seconds between updates to this player’s goal.'});
      const updatedAt = new Date().toISOString();
      doc.goals[body.player] = goal ? {...goal,updatedAt} : {text:'',updatedAt};
      doc.updatedAt = updatedAt;
      const saved = await fetch(URL, {method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message:`Update ${body.player} goal [skip ci]`,branch:'main',sha:file.sha,content:Buffer.from(JSON.stringify(doc,null,2)+'\n').toString('base64')}),signal:AbortSignal.timeout(10000)});
      if (saved.status===409 || saved.status===422) continue;
      if (!saved.ok) throw new Error('write');
      return reply(200,{...doc,enabled:true});
    }
    return reply(409,{error:'Another update was saved at the same time. Reload shared goals and try again.'});
  } catch { return reply(502,{error:'Could not confirm the shared save. Reload shared goals to check before retrying. Your draft is still in the editor.'}); }
};
module.exports.validate = validate;
