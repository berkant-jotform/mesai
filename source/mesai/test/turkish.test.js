const assert=require('node:assert/strict'),C=require('../src/core'),SC=require('../src/scenario');
let passed=0;const test=(name,fn)=>{try{fn();passed++;}catch(e){console.error(name);throw e;}};
const H=3600000,MIN=60000,U=(d,h,m=0)=>Date.UTC(2026,10,d,h,m),now=U(4,11);
const data={months:{'2026-11':1},days:{'2026-11-02':{first:U(2,8),last:U(2,18),min:600},'2026-11-03':{first:U(3,8),last:U(3,18),min:600}},events:{'2026-11-04':[{t:U(4,9,5),k:'G'}]}};
const solve=(q,store={})=>SC.solve(C,data,now,{},store,SC.parse(q));
for(const time of ['9:30','9.30','9 30','dokuz buçuk','9buçuk']){
 test(time+' arrival',()=>{const p=SC.parse(`yarın ${time} da gelirsem kaçta çıkarım`);assert.equal(p.frames[0].s,570);assert.equal(p.frames[0].len,undefined);});
 test(time+' duration',()=>{const p=SC.parse(`her gün ${time} saat yaparsam cuma kaçta çıkarım`);assert.equal(p.frames[0].len,570);assert.equal(p.frames[0].s,undefined);});
}
for(const q of ['hergun 9 30 calissam cuma kacta cikarim','her gün dokuz buçuk çalışsam cuma kaçta çıkarım','hergun 9:30 saat yapsam cuma kacta cikarim'])test(q,()=>assert.equal(SC.parse(q).frames[0].len,570));
for(const q of ['9 30','9:30','yarın 9 30'])test('clarify '+q,()=>{const r=solve(q);assert.equal(r.kind,'clarifyTime');assert.equal(r.store,null);});
for(const q of ['bugün 18:20 de çıkarsam kaç saat olur','bugun 18 20de ciksam kac saat olur','bugün 18.20’de çıksam kaç saat çalışmış olurum'])test(q,()=>{const r=solve(q);assert.equal(r.kind,'dayLen');assert.equal(r.end,U(4,18,20));assert.equal(r.len,9.25*H);});
for(const q of ['bugün kaçta mesai bitiyor?','bugun kacta mesai bitiyo','bugün 9 saat kaçta dolar?'])test(q,()=>{const r=solve(q);assert.equal(r.kind,'dayGoal');assert.equal(r.store,null);});
test('early what-if gives exact duration, note, no forced OOO',()=>{const r=solve('bugün 14te çıksam kaç saat olur');assert.equal(r.kind,'dayLen');assert.equal(r.end,U(4,14));assert.equal(r.len,295*MIN);assert.ok(r.coreHint);assert.deepEqual(r.store.ooo,{});assert.ok(r.chips.some(c=>c.k==='core'));});
test('applying the proposed early plan still displays 14:00',()=>{const r=solve('bugün 14te çıksam kaç saat olur');const w=C.week(data,now,{},r.store,0);assert.equal(w.rows[2].end,U(4,14));assert.equal(w.W,45*H);assert.ok(w.rows[2].flags.includes('coreEarly'));});
test('explicit OOO request still calculates the needed exception',()=>{const r=solve('cuma 14te çıksam OOO kaç saat olur');assert.equal(r.kind,'oooNeed');assert.equal(r.oooDay,120);assert.equal(r.W,47*H);});
test('existing OOO is never increased by a what-if',()=>{const store={ooo:{'2026-11-04':{m:30,s:900}}},r=solve('bugün 14te çıksam kaç saat olur',store);assert.equal(r.W,45.5*H);assert.deepEqual(r.store.ooo,store.ooo);});
test('past hypothetical exit is read-only and not clamped to now',()=>{const r=SC.solve(C,data,U(4,15),{},{},SC.parse('bugün 12de çıksaydım kaç saat olur'));assert.equal(r.kind,'dayLen');assert.equal(r.end,U(4,12));assert.equal(r.len,175*MIN);assert.equal(r.store,null);assert.ok(r.historicalHypothesis);});
test('overnight exit keeps next-day date',()=>{const r=solve('bugün 02:30 da çıksam kaç saat olur');assert.equal(r.end,U(5,2,30));assert.equal(r.len,17*H+25*MIN);});
test('applied overnight plan agrees with the answer',()=>{const r=solve('bugün 02:30 da çıksam kaç saat olur');assert.equal(C.week(data,now,{},r.store,0).rows[2].end,r.end);});
test('casual desire is a plan preview, not a forced OOO dialog',()=>{const r=solve('cuma 14te cikmak istiyom');assert.equal(r.kind,'reqLen');assert.ok(r.coreHint);assert.equal(r.W,45*H);assert.deepEqual(r.store.ooo,{});});
for(const q of ['yarın 9 75 de gelirsem kaçta çıkarım','bugün 25:00 de çıksam kaç saat olur','her gün 9:75 saat yapsam cuma kaçta çıkarım'])test('invalid '+q,()=>assert.equal(solve(q).kind,'invalidTime'));
test('Friday remains exact while allocated days cover the unchanged target',()=>{const r=solve('cuma 14te çıkmak için her gün kaç saat kalmalıyım');assert.equal(r.pv.rows[4].end,U(6,14));assert.ok(r.pv.total>=r.W);assert.equal(r.W,45*H);});
test('explicit clock stays exact while contextual bare hours and modifiers still work', () => {
  const exit = text => SC.parse(text).frames[0].e;
  for (const clock of ['10:00', '10.00', '10 00']) assert.equal(exit('bugün ' + clock + ' da çıksam kaç saat olur'), 600);
  assert.equal(exit('cuma 2de çıkmak istiyorum'), 840);
  assert.equal(exit('cuma sabah 10da çıksam kaç saat olur'), 600);
  assert.equal(exit('cuma akşam 5:30da çıksam kaç saat olur'), 1050);
  assert.equal(exit('bugün gece 02:30da çıksam kaç saat olur'), 150);
});
test('Sor keeps a previously planned arrival when only the exit is named', () => {
  const fri = '2026-11-06', store = { plan: { [fri]: { s: 480 } } };
  const r = solve('cuma 17:00 de çıksam kaç saat olur', store);
  assert.equal(r.end, U(6,17));
  assert.equal(r.len, 9 * H);
  assert.equal(r.store.plan[fri].s, 480);
  const w = C.week(data, now, {}, r.store);
  assert.equal(w.rows[4].plan, r.len);
});
test('Sor changes OOO without replacing a saved arrival and exit', () => {
  const fri = '2026-11-06', plan = { [fri]: { s: 480, e: 1020 } };
  const r = solve('cuma 1 saat OOO alırsam 45 saati doldurur muyum?', { plan });
  assert.deepEqual(r.store.plan, plan);
  assert.equal(r.store.ooo[fri].m, 60);
});
test('a past exit on a day with no entry does not turn into a next-day shift', () => {
  const r = SC.solve(C, { ...data, events: {} }, now, {}, {}, SC.parse('bugün 10:00 da çıksam kaç saat olur'));
  assert.equal(r.end, U(4,10));
  assert.equal(r.len, 0);
  assert.equal(r.store, null);
});
test('Sor reports a one-minute deficit as a deficit', () => {
  const r = solve('45 saati doldurur muyum?', { plan: {
    '2026-11-04': { m: 540 }, '2026-11-05': { m: 540 }, '2026-11-06': { m: 419, softCore: true }
  } });
  assert.equal(r.margin, -MIN);
  assert.equal(r.ok, false);
});
test('Sor equal-hour balancing preserves planned arrivals in preview and after apply', () => {
  const thu = '2026-11-05', store = { plan: { [thu]: { s: 495, e: 1040 } } };
  const r = solve('cuma 14te çıkmak için her gün kaç saat kalmalıyım', store);
  assert.equal(r.pv.rows[3].start, U(5,8,15));
  const w = C.week(data, now, {}, r.store);
  assert.equal(w.rows[3].start, U(5,8,15));
  assert.equal(w.rows[3].end, r.pv.rows[3].end);
  assert.ok(w.total >= w.W);
});
console.log(passed+' Turkish Sor checks passed');
