'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');

const js=fs.readFileSync('docs/assets/v25-nemesis.js','utf8');
new Function(js);

for(const page of ['docs/nemesis.html','docs/nemesis-beta.html']){
  const html=fs.readFileSync(page,'utf8');
  const ids=['nemesisProgress','nemesisMode','nemesisPeriods','nemesisView','nemesisMetric','nemesisSkill','nemesisBoss','nemesisActivity','nemesisProgressStatus','nemesisCompareChart'];
  for(const id of ids)assert(html.includes(`id="${id}"`),`${page}: missing ${id}`);
  assert(html.includes('v25-nemesis.js?v=5'),`${page}: wrong Nemesis JS version`);
  assert(html.includes('nemesis.css?v=3'),`${page}: wrong Nemesis CSS version`);
  assert(html.indexOf('v21-chartlib.js')<html.indexOf('v25-nemesis.js'),`${page}: chart library must load before Nemesis`);
  for(const range of ['all','365','180','90','30','7'])assert(html.includes(`data-nem-period="${range}"`),`${page}: missing period ${range}`);
  for(const view of ['timeline','bars','share'])assert(html.includes(`data-nem-view="${view}"`),`${page}: missing view ${view}`);
}
for(const needle of [
  'loadExternalHistory',
  '/snapshots?',
  'WOM history exceeded the 1,000-snapshot safety limit',
  'C.drawBars',
  'C.drawLine',
  'C.drawPie',
  'data-nem-skill',
  'data-nem-boss',
  'data-nem-clog-pie',
  "compareMode='gain'",
  "compareView='timeline'",
  "comparePeriod=365",
  "window.addEventListener('ug:data-updated'"
])assert(js.includes(needle),`Nemesis implementation missing: ${needle}`);

console.log('Nemesis comparison audit passed: multi-account WOM history, periods, bars, timelines, share pies and Collection Log composition.');
