'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="chart"></div>',{runScripts:'outside-only'}),w=dom.window,d=w.document;
w.UGV21={$:s=>d.querySelector(s),fmt:n=>String(n),fmt1:n=>String(n),compact:n=>String(n)};
w.eval(fs.readFileSync('docs/assets/v21-chartlib.js','utf8'));
const host=d.querySelector('#chart'),C=w.UGV21Charts;
const line=values=>({name:'Player',color:'#fff',data:values.map((value,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}T00:00:00Z`,value}))});
for(const values of [[100,150,250],[100,100,100],[0,0,1],[100,90,150]]){
 C.drawLine(host,[line(values)],{gainMode:true});const svg=host.querySelector('svg');
 assert.equal(+svg.dataset.yMin,0,'gains begin at zero');assert(+svg.dataset.yMax>0);
 assert.equal(+svg.querySelector('circle').getAttribute('cy'),264,'first snapshot is on bottom grid line');
 const ticks=[...svg.querySelectorAll('text[text-anchor="end"]')].filter(t=>t.getAttribute('x')==='55');
 assert.equal(ticks.at(-1).textContent,'0');assert(ticks.every(t=>+t.textContent>=0));
 for(const point of svg.querySelectorAll('circle'))assert(+point.getAttribute('cy')>=16&&+point.getAttribute('cy')<=264);
 assert(!svg.innerHTML.includes('NaN'));
}
C.drawLine(host,[line([100,150,250])]);assert(+host.querySelector('svg').dataset.yMin>0,'absolute totals retain their existing scale');
C.drawBars(host,[{name:'Player',color:'#fff',value:0}]);assert.equal(host.querySelector('rect').getAttribute('y'),'242','zero bar aligned with bottom grid line');
dom.window.close();console.log('Chart gains: zero floor, first points aligned to bottom grid line, all-zero and corrected snapshots remain finite; absolute scale preserved.');
