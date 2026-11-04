const C = require('../src/core.js');
const assert = require('assert');
let n = 0; const ok = (name, fn) => { try { fn(); n++; } catch (e) { console.error('✗', name); throw e; } };
const U = s => C.parseStamp(s).t, MIN = 60000, H = 3600000;
const ev = (s, k) => ({ t: U(s), k });
const clk = t => C.clock(t);
const day = (d, a, b, min) => ({ first: U(d + ' ' + a), last: U(d + ' ' + b), min });
const data = (o = {}) => ({ days: o.days || {}, events: o.events || {}, months: o.months || { '2026-10': 1, '2026-11': 1, '2026-12': 1 } });

ok('parsers', () => {
  assert.equal(C.parseStamp('03.11.2026 08:23:07').t, Date.UTC(2026, 10, 3, 8, 23, 7));
  assert.equal(C.parseStamp('31.02.2026'), null);
  assert.equal(C.parseDur('09:41'), 581);
  assert.equal(C.parseKind('Ç'), 'C'); assert.equal(C.parseKind('G'), 'G');
  assert.equal(C.parsePeriod('KASIM 2026'), '2026-11'); assert.equal(C.parsePeriod('Seçiniz'), null);
  assert.deepEqual(C.classify(['03.11.2026 08:23:07', 'G', 'PDKS']), { type: 'ev', t: U('03.11.2026 08:23:07'), k: 'G' });
  assert.equal(C.classify(['02.11.2026', '02.11.2026 08:05:29', '02.11.2026 17:46:10', '09:41']).min, 581);
});
ok('config defaults follow the handoff', () => {
  const c = C.config({});
  assert.equal(c.W, 2700); assert.equal(c.D, 540); assert.equal(c.cap, 0); assert.equal(c.coreS, 600); assert.equal(c.coreE, 960);
});

// ---- the handoff worked example: Tue 3 Nov 2026 13:35 Istanbul ----
const NOW = U('03.11.2026 13:35:00');
const ex = () => data({ days: { '2026-11-02': day('02.11.2026', '08:05:29', '17:46:10', 581) }, events: { '2026-11-03': [ev('03.11.2026 08:23:07', 'G')] } });
const exStore = () => ({ types: { '2026-11-05': 'izin' }, ooo: { '2026-11-03': { m: 60, s: 840 } } });

ok('worked example: totals, milestone, 46h, Friday', () => {
  const w = C.week(ex(), NOW, {}, exStore(), 0);
  assert.equal(w.W, 46 * H);
  assert.equal(w.done, (9 * 60 + 41) * MIN + (5 * H + 11 * MIN + 53000));
  assert.equal(C.hm(w.done), '14:52');
  assert.equal(C.hm(w.remaining, false, true), '31:08');
  assert.equal(Math.round(w.done / w.W * 10000) / 100, 32.35);
  assert.equal(clk(w.milestone), '17:24');
  const fri = w.rows[4];
  assert.equal(fri.auto, true); assert.equal(clk(fri.end), '18:19');
  assert.equal(clk(w.hit.t), '18:19'); assert.equal(w.hit.day.key, '2026-11-06');
  assert.equal(w.bank, 41 * MIN);
});
ok('without the extra hour of OOO the same week ends Cum 17:19', () => {
  const w = C.week(ex(), NOW, {}, { types: { '2026-11-05': 'izin' } }, 0);
  assert.equal(w.W, 45 * H); assert.equal(clk(w.rows[4].end), '17:19');
});
ok('OOO 0.5 / 1 / 2 h → 45.5 / 46 / 47 exactly once', () => {
  [[30, 45.5], [60, 46], [120, 47]].forEach(([m, h]) => {
    assert.equal(C.week(ex(), NOW, {}, { ooo: { '2026-11-03': { m, s: 840 } } }, 0).W, h * H);
  });
});
ok('leave credit is 9 h; future credit is projection, not earned', () => {
  const w = C.week(ex(), NOW, {}, exStore(), 0), thu = w.rows[3];
  assert.equal(thu.credit, 9 * H); assert.equal(thu.val, 9 * H); assert.equal(thu.plan, 0);
  assert.ok(w.done < 15 * H);
});
ok('past leave counts once even with portal office time (overlap flagged)', () => {
  const d = ex(); d.days['2026-11-02'] = day('02.11.2026', '09:00', '12:00', 180);
  const w = C.week(d, NOW, {}, { types: { '2026-11-02': 'izin' } }, 0);
  assert.equal(w.rows[0].count, 9 * H); assert.ok(w.rows[0].flags.includes('overlap'));
});
ok('missing day is distinct from leave', () => {
  const d = data({ events: { '2026-11-03': [ev('03.11.2026 08:23:07', 'G')] } });
  const a = C.week(d, NOW, {}, {}, 0);
  assert.ok(a.rows[0].flags.includes('absent')); assert.equal(a.rows[0].count, 0);
  const b = C.week(d, NOW, {}, { types: { '2026-11-02': 'tatil' } }, 0);
  assert.deepEqual(b.rows[0].flags, []); assert.equal(b.rows[0].count, 9 * H);
});
ok('manual 0:00 is a real zero; blank uses the source', () => {
  const w = C.week(ex(), NOW, {}, { ovr: { '2026-11-02': { m: 0 } } }, 0);
  assert.equal(w.rows[0].count, 0); assert.equal(w.rows[0].src, 'manual');
  assert.equal(C.week(ex(), NOW, {}, { ovr: {} }, 0).rows[0].count, 581 * MIN);
});
ok('overtime earlier in the week brings Friday earlier', () => {
  const d = ex(); d.days['2026-11-02'] = day('02.11.2026', '08:00', '19:00', 660);
  assert.equal(clk(C.week(d, NOW, {}, exStore(), 0).rows[4].end), '17:00');
});
ok('weekly threshold before 16:00 still holds Friday until 16:00', () => {
  const D = k => day(k, '08:00', '19:00', 660);
  const d = data({ days: { '2026-11-02': D('02.11.2026'), '2026-11-03': D('03.11.2026'), '2026-11-04': D('04.11.2026'), '2026-11-05': D('05.11.2026') } });
  const w = C.week(d, U('06.11.2026 07:00'), {}, {}, 0);
  assert.equal(clk(w.hit.t), '10:00');
  assert.equal(clk(w.rows[4].end), '16:00'); assert.equal(w.rows[4].held, true);
});
ok('OOO 14:00–16:00 permits leaving at 14:00; 15:00–16:00 does not', () => {
  const D = k => day(k, '08:00', '19:00', 660);
  const d = data({ days: { '2026-11-02': D('02.11.2026'), '2026-11-03': D('03.11.2026'), '2026-11-04': D('04.11.2026'), '2026-11-05': D('05.11.2026') } });
  const now = U('06.11.2026 07:00');
  const full = C.week(d, now, {}, { plan: { '2026-11-06': { e: 840 } }, ooo: { '2026-11-06': { m: 120, s: 840 } } }, 0);
  assert.equal(clk(full.rows[4].end), '14:00'); assert.ok(!full.rows[4].held);
  const part = C.week(d, now, {}, { plan: { '2026-11-06': { e: 840 } }, ooo: { '2026-11-06': { m: 60, s: 900 } } }, 0);
  assert.equal(clk(part.rows[4].end), '16:00'); assert.equal(part.rows[4].held, true);
});
ok('duration-only OOO leaves compliance unknown', () => {
  const w = C.week(ex(), NOW, {}, { plan: { '2026-11-04': { e: 840 } }, ooo: { '2026-11-04': { m: 120 } } }, 0);
  assert.ok(w.rows[2].flags.includes('coreUnknown')); assert.ok(!w.rows[2].held);
});
ok('arrival after 10:00 flagged; a planned late start flagged', () => {
  const d = data({ days: { '2026-11-02': day('02.11.2026', '10:25', '19:30', 545) }, events: { '2026-11-03': [ev('03.11.2026 08:23:07', 'G')] } });
  const w = C.week(d, NOW, {}, { plan: { '2026-11-04': { s: 660 } } }, 0);
  assert.ok(w.rows[0].flags.includes('coreLate'));
  assert.ok(w.rows[2].flags.includes('coreStart'));
});
ok('leave day is exempt from core hours', () => {
  const w = C.week(ex(), NOW, {}, { types: { '2026-11-06': 'izin' } }, 0);
  assert.ok(!w.rows[4].held); assert.equal(w.rows[4].plan, 0);
});
ok('09:00–16:00 team window', () => {
  const d = data({ days: { '2026-11-02': day('02.11.2026', '09:30', '18:30', 540) }, events: { '2026-11-03': [ev('03.11.2026 08:23:07', 'G')] } });
  assert.ok(C.week(d, NOW, { coreS: '09:00', coreE: '16:00' }, {}, 0).rows[0].flags.includes('coreLate'));
  assert.ok(!C.week(d, NOW, {}, {}, 0).rows[0].flags.includes('coreLate'));
});
ok('shortfall shown when the plan cannot reach the target', () => {
  const w = C.week(ex(), NOW, {}, { types: { '2026-11-05': 'izin', '2026-11-06': 'izin' }, ooo: { '2026-11-03': { m: 60, s: 840 } }, plan: { '2026-11-03': { e: 1044 }, '2026-11-04': { e: 1080 } } }, 0);
  assert.equal(w.absorber, null);
  assert.equal(C.hm(w.shortfall, false, true), '0:19');
});
ok('Friday izin: Wednesday absorbs and must end 18:19', () => {
  const s = exStore(); s.types['2026-11-06'] = 'izin';
  const w = C.week(ex(), NOW, {}, s, 0);
  assert.equal(w.absorber.key, '2026-11-04'); assert.equal(clk(w.rows[2].end), '18:19'); assert.equal(w.shortfall, 0);
});
ok('reverse: leave Friday 17:00 → Wednesday until 19:19', () => {
  const w = C.reverse(ex(), NOW, {}, exStore(), '2026-11-06', 17 * 60, '2026-11-04');
  assert.equal(clk(w.rows[4].end), '17:00'); assert.equal(clk(w.rows[2].end), '19:19');
});
ok('planned start moves the day, length kept', () => {
  const w = C.week(ex(), NOW, {}, { plan: { '2026-11-04': { s: 600 } } }, 0);
  assert.equal(clk(w.rows[2].start), '10:00'); assert.equal(clk(w.rows[2].end), '19:00');
});
ok('cap off by default, works when set', () => {
  const d = ex(); d.days['2026-11-02'] = day('02.11.2026', '07:00', '19:30', 750);
  assert.equal(C.week(d, NOW, {}, {}, 0).rows[0].count, 750 * MIN);
  assert.equal(C.week(d, NOW, { cap: 11 }, {}, 0).rows[0].count, 660 * MIN);
});
ok('previous week: totals only', () => {
  const d = data({ days: { '2026-10-26': day('26.10.2026', '09:00', '18:00', 540), '2026-10-27': day('27.10.2026', '09:00', '18:10', 550) } });
  const w = C.week(d, NOW, {}, { types: { '2026-10-29': 'tatil' } }, -1);
  assert.equal(w.thisWeek, false); assert.equal(w.done, (540 + 550 + 540) * MIN); assert.equal(w.hit, null);
});
ok('after leaving today: day done unless a return is planned', () => {
  const d = ex(); d.events['2026-11-03'] = [ev('03.11.2026 08:00', 'G'), ev('03.11.2026 17:30', 'C')];
  const w = C.week(d, U('03.11.2026 18:00'), {}, {}, 0);
  assert.equal(w.today.inside, false); assert.equal(clk(w.today.end), '17:30');
});
ok('lunch exit/re-entry counts', () => {
  const d = ex(); d.events['2026-11-03'] = [ev('03.11.2026 08:00', 'G'), ev('03.11.2026 12:00', 'C'), ev('03.11.2026 13:00', 'G')];
  const w = C.week(d, U('03.11.2026 15:00'), {}, {}, 0);
  assert.equal(w.today.actual, 7 * H); assert.equal(w.today.segs.length, 2);
});
ok('week crossing months: unloaded month flagged', () => {
  const d = data({ months: { '2026-12': 1 }, events: { '2026-12-01': [ev('01.12.2026 09:00', 'G')] } });
  assert.ok(C.week(d, U('01.12.2026 10:00'), {}, {}, 0).rows[0].flags.includes('month'));
});
ok('Istanbul wall clock', () => {
  assert.equal(C.istanbulNow(new Date(Date.UTC(2026, 10, 3, 10, 35))), Date.UTC(2026, 10, 3, 13, 35));
});
ok('fuzz: 4000 random weeks never produce NaN', () => {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 4000; i++) {
    const now = Date.UTC(2026, 10, 2 + Math.floor(rnd() * 7), Math.floor(rnd() * 24), Math.floor(rnd() * 60));
    const d = data({}), ws = C.weekStart(now), st = { types: {}, plan: {}, ooo: {}, ovr: {} };
    for (let k = 0; k < 7; k++) {
      const dd = ws + k * C.DAY, key = C.dkey(dd);
      if (dd <= now) d.events[key] = Array.from({ length: Math.floor(rnd() * 5) }, () => ({ t: Math.min(now, dd + Math.floor(rnd() * 1440) * MIN), k: rnd() < .5 ? 'G' : 'C' }));
      if (rnd() < .2) st.types[key] = C.TYPES[Math.floor(rnd() * 3)];
      if (rnd() < .2) st.plan[key] = { s: rnd() < .5 ? 420 + Math.floor(rnd() * 300) : undefined, e: rnd() < .7 ? 700 + Math.floor(rnd() * 600) : undefined };
      if (rnd() < .15) st.ooo[key] = { m: 30 * (1 + Math.floor(rnd() * 4)), s: rnd() < .5 ? 600 + Math.floor(rnd() * 300) : undefined };
    }
    const w = C.week(d, now, { coreE: rnd() < .3 ? '10:00' : '16:00' }, st, rnd() < .2 ? -1 : 0);
    for (const r of w.rows) for (const f of ['actual', 'count', 'val']) assert.ok(Number.isFinite(r[f]) && r[f] >= 0, f + ' ' + r[f]);
    assert.ok(Number.isFinite(w.done) && Number.isFinite(w.total) && Number.isFinite(w.shortfall));
  }
});
ok('portal row stops at the first exit: count the list, flag it, allow the portal figure', () => {
  const d = data({ days: { '2026-11-02': day('02.11.2026', '08:05:29', '17:46:10', 581), '2026-11-03': day('03.11.2026', '08:23:07', '11:56:54', 213) },
    events: { '2026-11-03': [ev('03.11.2026 08:23:07', 'G'), ev('03.11.2026 11:56:54', 'C'), ev('03.11.2026 13:22:37', 'G'), ev('03.11.2026 17:38:02', 'C')],
      '2026-11-04': [ev('04.11.2026 07:09:16', 'G')] } });
  const now = U('04.11.2026 10:00:00');
  const w = C.week(d, now, {}, {}, 0), tue = w.rows[1];
  assert.ok(tue.flags.includes('mismatch')); assert.equal(tue.src, 'raw'); assert.equal(C.hm(tue.actual), '9:14');
  assert.equal(C.hm(tue.mismatch.portal), '3:33'); assert.equal(tue.mismatch.use, 'raw');
  const w2 = C.week(d, now, {}, { pick: { '2026-11-03': 'portal' } }, 0);
  assert.equal(C.hm(w2.rows[1].actual), '3:33'); assert.equal(w2.rows[1].mismatch.use, 'portal');
  assert.ok(!w.rows[0].mismatch, 'normal day with lunch break is not flagged');
});
console.log(n + ' core tests passed');
