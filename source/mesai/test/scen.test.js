const C = require('../src/core.js'), Sc = require('../src/scenario.js');
const assert = require('assert');
let n = 0, fails = 0; const ok = (name, fn) => { try { fn(); n++; } catch (e) { fails++; console.error('✗', name, '\n  ', e.message); } };
const U = s => C.parseStamp(s).t, MIN = 60000, H = 3600000, clk = t => C.clock(t), hm = ms => C.hm(ms, false, true);
const ev = (s, k) => ({ t: U(s), k });
const day = (d, a, b, min) => ({ first: U(d + ' ' + a), last: U(d + ' ' + b), min });
// Fixture: Wed 4 Nov 2026 11:00; Mon 9:41, Tue 9:07, arrived today 09:05.
const NOW = U('04.11.2026 11:00:00');
const data = () => ({ months: { '2026-11': 1 }, days: { '2026-11-02': day('02.11.2026', '08:05', '17:46', 581), '2026-11-03': day('03.11.2026', '08:23', '17:30', 547) },
  events: { '2026-11-04': [ev('04.11.2026 09:05:00', 'G')] } });
const P = t => Sc.parse(t);
const S = (t, store, ok) => { const sc = Sc.parse(t); if (ok) sc.oooOK = true; return Sc.solve(C, data(), NOW, {}, store || {}, sc); };
const fr = (t) => JSON.stringify(P(t).frames.map(f => { const o = { d: f.days }; ['s', 'e', 'len', 'type', 'delta'].forEach(k => { if (f[k] != null) o[k] = f[k]; }); if (f.ooo) o.ooo = f.ooo.m; return o; }));

// ---------- parsing ----------
ok('the real sentence', () => {
  const p = P('her gün 10 saat yapsam cuma 8 de geldiğimde kaçta çıkarım');
  assert.equal(p.query.kind, 'leave'); assert.equal(fr('her gün 10 saat yapsam cuma 8 de geldiğimde kaçta çıkarım'), '[{"d":["EACH"],"len":600},{"d":[4],"s":480}]');
});
ok('no diacritics + suffix glued', () => assert.equal(fr('her gun 10 saat yapsam cuma 8de geldigimde kacta cikarim'), '[{"d":["EACH"],"len":600},{"d":[4],"s":480}]'));
ok('number words', () => assert.equal(fr('her gün on saat çalışsam cuma sekizde gelsem kaçta çıkarım'), '[{"d":["EACH"],"len":600},{"d":[4],"s":480}]'));
ok('dokuz buçuk saat', () => assert.equal(fr('bugün dokuz buçuk saat çalışsam kaçta çıkarım'), '[{"d":["T"],"len":570}]'));
ok('9 buçuk yapsam = duration', () => assert.equal(fr('her gün 9 buçuk yapsam cuma kaçta çıkarım'), '[{"d":["EACH"],"len":570},{"d":[4]}]'));
ok('9,5 / 9.5 saat', () => { assert.equal(fr('her gün 9,5 saat'), '[{"d":["EACH"],"len":570}]'); assert.equal(fr('perşembe 9.5 saat'), '[{"d":[3],"len":570}]'); });
ok('1 saat 15 dk fazla', () => assert.equal(fr('bugün 1 saat 15 dk fazla çalışırsam yarın kaçta çıkarım'), '[{"d":["T"],"len":75,"delta":"fazla"},{"d":["T+1"]}]'));
ok('reqLen', () => { const p = P('cuma 14te çıkmak için her gün kaç saat kalmalıyım'); assert.equal(p.query.kind, 'reqLen'); assert.equal(fr('cuma 14te çıkmak için her gün kaç saat kalmalıyım'), '[{"d":[4],"e":840},{"d":["EACH"]}]'); });
ok('reqLen bare 2 → 14:00', () => { assert.equal(P('cuma 2 de cikmak icin gunde kac saat calismaliyim').query.kind, 'reqLen'); assert.equal(P('cuma 2 de cikmak icin gunde kac saat calismaliyim').frames[0].e, 840); });
ok('arrive', () => { const p = P('perşembe 15\'te çıkmak istiyorum kaçta gelmeliyim'); assert.equal(p.query.kind, 'arrive'); assert.equal(p.frames[0].e, 900); });
ok('totals', () => {
  assert.equal(P('bu hafta kaç saat yaptım').query.kind, 'done');
  assert.equal(P('su ana kadar kac saat calistim').query.kind, 'done');
  assert.equal(P('kaç saat fazlam var').query.kind, 'balance');
  assert.equal(P('eksik saatim var mi').query.kind, 'balance');
  assert.equal(P('ne kadar kaldı').query.kind, 'remaining');
  assert.equal(P('bu hafta kaç saat daha çalışmam lazım').query.kind, 'remaining');
  assert.equal(P('kalan günlerde ortalama kaç saat yapmalıyım').query.kind, 'avg');
  assert.equal(P('bu hafta günlük ortalamam ne').query.kind, 'avg');
  assert.equal(P('bu hafta ortalama günde kaç saat yaptım').query.kind, 'avgDone');
});
ok('core checks', () => {
  const p = P('16dan önce çıkabilir miyim'); assert.equal(p.query.kind, 'check'); assert.equal(p.frames[0].e, 960); assert.ok(p.frames[0].before);
  assert.equal(P('16 da çıkabilir miyim').frames[0].e, 960);
  assert.equal(P('bugün 17 de çıksam yeter mi').query.kind, 'check');
  assert.equal(P('yarın 10.30 da gelirsem olur mu').frames[0].s, 630);
});
ok('leave tomorrow izin', () => { assert.equal(fr('yarın izinliyim cuma kaçta çıkarım'), '[{"d":["T+1"],"type":"izin"},{"d":[4]}]'); assert.equal(P('yarın izinliyim cuma kaçta çıkarım').query.kind, 'leave'); });
ok('until clock', () => assert.equal(fr('bugün 18.30 a kadar kalsam cuma kaçta çıkarım'), '[{"d":["T"],"e":1110},{"d":[4]}]'));
ok('bare leave 7 → 19:00', () => assert.equal(P('bugün 7 de çıkarsam cuma kaçta çıkarım').frames[0].e, 1140));
ok('multi day plan', () => assert.equal(fr('salı 10 saat çarşamba 9 saat perşembe 10 saat yaparsam cuma kaçta çıkarım'), '[{"d":[1],"len":600},{"d":[2],"len":540},{"d":[3],"len":600},{"d":[4]}]'));
ok('ranges 9-18', () => assert.equal(fr('pzt 9-18 sal 8-19 çarşamba 10 saat perşembe 9.5 saat cuma kaçta çıkarım'), '[{"d":[0],"s":540,"e":1080},{"d":[1],"s":480,"e":1140},{"d":[2],"len":600},{"d":[3],"len":570},{"d":[4]}]'));
ok('8 den 17 ye kadar', () => assert.equal(fr('her gün 8 den 17 ye kadar çalışsam'), '[{"d":["EACH"],"s":480,"e":1020}]'));
ok('day range', () => assert.equal(fr('pazartesiden perşembeye 10 saat'), '[{"d":[0,1,2,3],"len":600}]'));
ok('ooo', () => { assert.equal(fr('yarın 1 saat ooo alırsam kaçta çıkarım'), '[{"d":["T+1"],"ooo":60}]'); assert.equal(P('yarın 1 saat ooo alırsam kaçta çıkarım').query.kind, 'leave'); });
ok('ooo window', () => { const f = P('cuma 10-12 arası ooo alırsam kaçta çıkarım').frames[0]; assert.deepEqual([f.ooo.s, f.ooo.m], [600, 120]); });
ok('slang', () => { assert.equal(fr('cuma 8de gelicem kacta cikicam'), '[{"d":[4],"s":480}]'); assert.equal(P('cuma 8de gelicem kacta cikicam').query.kind, 'leave'); });
ok('english', () => {
  const p = P('if I work 10 hours every day and come in at 8 on Friday when can I leave');
  assert.equal(p.query.kind, 'leave'); assert.equal(fr('if I work 10 hours every day and come in at 8 on Friday when can I leave'), '[{"d":["EACH"],"len":600},{"s":480,"d":[4]}]'.replace('{"s":480,"d":[4]}', '{"d":[4],"s":480}'));
  assert.equal(P('how many hours have I worked this week').query.kind, 'done');
  assert.equal(P('can I leave before 4 pm').frames[0].e, 960);
});
ok('daha', () => { const f = P('bugün 3 saat daha kalsam yeter mi').frames[0]; assert.equal(f.len, 180); assert.equal(f.delta, 'daha'); });
ok('fuzz does not throw', () => {
  const lines = require('./questions.json');
  lines.forEach(l => { const t = l.slice(1, -1); Sc.parse(t); if (/=>/.test(t)) return; try { Sc.solve(C, data(), NOW, {}, {}, Sc.parse(t)); } catch (e) { throw new Error(t + ': ' + e.message); } });
});

// ---------- solving ----------
ok('real sentence: Friday held at 16:00, week done 14:12', () => {
  const r = S('her gün 10 saat yapsam cuma 8 de geldiğimde kaçta çıkarım');
  assert.equal(r.kind, 'leave'); assert.equal(r.day, 4); assert.equal(clk(r.end), '16:00'); assert.equal(r.held, true);
  assert.equal(clk(r.pv.hit.t), '14:12');
});
ok('9 h each → Friday 16:12', () => { const r = S('her gün 9 saat yapsam cuma 8de gelsem kaçta çıkarım'); assert.equal(clk(r.end), '16:12'); assert.equal(r.held, false); });
ok('reqLen: 14:00 Friday needs 2 h OOO → 11:36 per day', () => {
  const q = S('cuma 14te çıkmak için her gün kaç saat kalmalıyım');
  assert.equal(q.kind, 'confirmOOO'); assert.equal(q.m, 120); assert.equal(q.W1, 47 * H); assert.equal(q.ask, 'reqLen');
  const r = S('cuma 14te çıkmak için her gün kaç saat kalmalıyım', {}, true);
  assert.equal(r.kind, 'reqLen'); assert.ok(r.chips.some(c => c.k === 'auto' && c.ooo === 120 && c.ok)); assert.equal(r.m, 696); assert.equal(r.W, 47 * H); assert.deepEqual(r.days, [2, 3]);
});
ok('arrive Thursday 15:00 → asks for OOO first', () => { const r = S('perşembe 15\'te çıkmak istiyorum kaçta gelmeliyim'); assert.equal(r.kind, 'confirmOOO'); assert.equal(r.m, 60); });
ok('arrive Thursday 15:00 → 05:48 (46 h)', () => { const r = S('perşembe 15\'te çıkmak istiyorum kaçta gelmeliyim', {}, true); assert.equal(r.kind, 'arrive'); assert.equal(r.s, 348); assert.equal(r.W, 46 * H); assert.ok(r.early); });
ok('arrive Friday 17:00 with banked hours → capped at core start', () => {
  const r = S('her gün 10 saat yapsam cuma 17de çıkmak için kaçta gelmeliyim');
  assert.equal(r.kind, 'arrive'); assert.equal(r.s, 600); assert.ok(r.capped);
});
ok('done = 20:43', () => { const r = S('bu hafta kaç saat yaptım'); assert.equal(C.hm(r.m), '20:43'); });
ok('balance = +0:48', () => { const r = S('kaç saat fazlam var'); assert.equal(C.hm(r.bal), '0:48'); });
ok('avg = 8:44', () => { const r = S('kalan günlerde ortalama kaç saat yapmalıyım'); assert.equal(r.m, 524); });
ok('OOO question answers without asking', () => { const r = S('cuma 14 te cikarsam ooo kaç saat olur'); assert.equal(r.kind, 'oooNeed'); assert.equal(r.oooDay, 120); });
ok('late arrival asks too', () => { const r = S('yarın 11de gelirsem kaçta çıkarım'); assert.equal(r.kind, 'confirmOOO'); assert.equal(r.m, 60); });
ok('check today 17:00 → 17 min short', () => { const r = S('bugün 17 de çıksam yeter mi'); assert.equal(r.kind, 'check'); assert.equal(r.ok, false); assert.equal(r.margin, -17 * MIN); });
ok('check before core', () => { const r = S('16dan önce çıkabilir miyim'); assert.equal(r.before, true); });
ok('izin Thursday → Friday 17:12', () => { const r = S('yarın izinliyim cuma kaçta çıkarım'); assert.equal(clk(r.end), '17:12'); });
ok('remaining', () => { const r = S('ne kadar kaldı'); assert.equal(hm(r.m), '24:17'); });
ok('remaining with Friday izin', () => { const r = S('cuma izin alsam bu hafta kaç saat daha çalışmam lazım'); assert.equal(hm(r.m), '15:17'); });
ok('past days skipped with a warning', () => { const r = S('pzt 9-18 sal 8-19 çarşamba 10 saat perşembe 9.5 saat cuma kaçta çıkarım'); assert.ok(r.chips.some(c => c.w === 'past')); assert.equal(clk(r.end), '16:00'); });
ok('holiday credit and half day', () => {
  const st = { hol: { '2026-11-05': { n: 'X', half: false }, '2026-11-06': { n: 'Y', half: true } } };
  const w = C.week(data(), NOW, {}, st, 0);
  assert.equal(w.rows[3].type, 'tatil'); assert.equal(w.rows[3].credit, 9 * H);
  assert.equal(w.rows[4].half, 4.5 * H); assert.equal(w.rows[4].office, true);
  // Mon+Tue 18:48 + Wed 9 + Thu 9 credit + Fri half 4:30 → Fri needs 3:42 more work
  assert.equal(C.hm(w.rows[4].need - w.rows[4].half, false, true), '3:42'); assert.equal(C.hm(w.rows[4].plan), '4:00'); assert.ok(w.rows[4].held);
  const w2 = C.week(data(), NOW, {}, Object.assign({ types: { '2026-11-05': 'ofis' } }, st), 0);
  assert.equal(w2.rows[3].type, 'ofis');
});
console.log(n + ' scenario tests passed' + (fails ? ', ' + fails + ' FAILED' : ''));
if (fails) process.exit(1);
