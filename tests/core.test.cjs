const assert=require('node:assert/strict');
const core=require('../src/core.js');
const meta=require('../data/audit.json');
const games=core.unpack(require('../data/catalog.json'));
const idx=core.indexTags(games);
const cases=require('./reference.json');
assert.equal(meta.currency,'USD');assert.equal(meta.market,'US');
assert.equal(new Set(games.map(g=>g.id)).size,meta.games);
assert.equal(games.filter(g=>g.price===null).length,meta.unverified_zero);
assert.ok(games.every(g=>g.price===null||(Number.isSafeInteger(g.price)&&g.price>0)));
assert.equal(core.money(1499),'$14.99');assert.equal(core.money(null),'Unverified');
assert.deepEqual([499,500,501,1500,1501,6001,null].map(core.priceBand),[0,0,1,2,3,6,7]);
assert.equal(core.inBudget(null,1500),false);assert.equal(core.inBudget(null,null),true);
assert.deepEqual(core.relaxRows([7],3),[3,7]);assert.deepEqual(core.relaxRows([4,5],3),[1,4,5]);
assert.equal(games.filter(g=>g.reviews===0&&g.rate===null).length,meta.zero_reviews);
const seed='248820',tags=['Rogue-like','Indie','Platformer'];
for(const c of cases){
 const rows=c.relaxed?[3,7]:[7];
 const out=core.derive(games,{seed,tags,rows,budget:c.cap,os:c.os},idx);
 assert.equal(out.candidates.length,c.count,JSON.stringify(c));
 assert.equal(out.context.length,out.priceGroups.flat().length);
}
assert.equal(core.search(games,'248820').matches[0].id,seed);
assert.equal(core.search(games,'Hollow Knight').matches[0].id,'367520');
assert.equal(core.search(games,'fng-no-such-game').total,0);
const out=core.difference(new Set(['a','b']),new Set(['a','c']));
assert.deepEqual(out,{added:['b'],removed:['c']});
console.log(`Verified ${cases.length} independent SQL counts and USD boundary/unknown-price checks`);
