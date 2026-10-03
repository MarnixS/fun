'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('docs/assets/app.js','utf8');
const clog=fs.readFileSync('docs/assets/v21-clog.js','utf8');
const luck=fs.readFileSync('docs/assets/v21-luck.js','utf8');
const shared=fs.readFileSync('docs/assets/ge-prices.js','utf8');
function declaration(source,name){const start=source.indexOf(`function ${name}(`);assert(start>=0);return source.slice(start,source.indexOf('\n',start));}
const data={33639:{high:150000000,low:130000000},19547:{high:20000000,low:18000000},13263:{high:30000000,low:24000000},29796:{high:60000000,low:54000000},29801:{high:100000000,low:90000000},19553:{high:20000000,low:18000000},26219:{high:28981998,low:28981998}};
for(const [source,name,key] of [[app,'mastItemPrice'],[clog,'price'],[luck,'price']]){
 const sharedContext=vm.createContext({data});vm.runInContext(declaration(shared,'price'),sharedContext);
 const context=vm.createContext({window:{UGPrices:{price:sharedContext.price}}});vm.runInContext(declaration(source,name),context);const price=context[name];
 assert.equal(price(33634),121000000);
 for(const id of [13274,13275,13276])assert.equal(price(id),9000000);
 assert.equal(price(13274)+price(13275)+price(13276),27000000);
 assert.equal(price(29790),19000000,'existing noxious component valuation');
 assert.equal(price(29799),76000000,'existing rancour valuation');
 assert.equal(price(26219),28981998,'ordinary GE prices remain unchanged');
 data[33639]={high:100,low:100};assert.equal(price(33634),0,'component prices cannot be negative');data[33639]={high:150000000,low:130000000};
}
const context=vm.createContext({PLAYERS:[{name:'Test',key:'test',core:true}],state:{achievements:{test:[{name:'500 Test boss kills',metric:'test_boss',measure:'kills',createdAt:'2026-01-01'},{name:'500 Test boss KC',metric:'test_boss',createdAt:'2026-01-01'},{name:'99 Attack',metric:'attack',measure:'experience',createdAt:'2026-01-01'},{name:'2000 total level',metric:'overall',measure:'levels',createdAt:'2026-01-01'},{name:'100m total XP',metric:'overall',measure:'experience',createdAt:'2026-01-01'}]}},snapData:()=>({bosses:{test_boss:{kills:501}}}),nice:s=>s,achievementScore:()=>3});
vm.runInContext(declaration(app,'officialAchievements'),context);const events=context.officialAchievements();
assert.equal(events.length,3);assert(events.every(e=>e.metric!=='test_boss'));assert.equal(events.find(e=>e.metric==='attack').type,'level');assert(events.some(e=>e.name==='2000 total level'));assert(events.some(e=>e.name==='100m total XP'));
console.log('Shared price rules and WOM KC filtering passed; levels and XP retained.');
