// Mesai core — pure calculations. All times are portal wall-clock (Europe/Istanbul) stored as UTC ms,
// so a laptop in another timezone can never shift attendance dates.
var MesaiCore = (function () {
  var MIN = 60000, DAY = 86400000;
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var dayStart = function (t) { return Math.floor(t / DAY) * DAY; };
  var dkey = function (t) { return new Date(t).toISOString().slice(0, 10); };
  var mkey = function (t) { return dkey(t).slice(0, 7); };
  var dow = function (t) { return (new Date(t).getUTCDay() + 6) % 7; }; // 0 = Monday
  var weekStart = function (t) { return dayStart(t) - dow(t) * DAY; };

  function istanbulNow(date) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(date || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  }

  var fold = function (s) {
    return String(s).trim().replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S').replace(/[Ğğ]/g, 'G')
      .replace(/[Üü]/g, 'U').replace(/[Öö]/g, 'O').replace(/[Çç]/g, 'C').toUpperCase().replace(/\s+/g, ' ');
  };
  var MONTHS = ['OCAK', 'SUBAT', 'MART', 'NISAN', 'MAYIS', 'HAZIRAN', 'TEMMUZ', 'AGUSTOS', 'EYLUL', 'EKIM', 'KASIM', 'ARALIK'];

  function parseStamp(s) {
    s = String(s || '').trim();
    var m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/), y, mo, d;
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else {
      m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
      if (!m) return null; y = +m[1]; mo = +m[2]; d = +m[3];
    }
    var h = +(m[4] || 0), mi = +(m[5] || 0), se = +(m[6] || 0);
    if (h > 23 || mi > 59 || se > 59) return null;
    var t = Date.UTC(y, mo - 1, d, h, mi, se), x = new Date(t);
    if (x.getUTCFullYear() !== y || x.getUTCMonth() !== mo - 1 || x.getUTCDate() !== d) return null;
    return { t: t, time: m[4] != null };
  }
  function parseDur(s) {
    var m = String(s || '').trim().match(/^(\d{1,3}):([0-5]\d)(?::[0-5]\d)?$/);
    return m ? +m[1] * 60 + +m[2] : null;
  }
  function parseKind(s) {
    var f = fold(s);
    if (f === 'G' || f === 'GIRIS' || f === 'IN') return 'G';
    if (f === 'C' || f === 'CIKIS' || f === 'OUT') return 'C';
    return null;
  }
  function parsePeriod(s) {
    var f = fold(s), y = f.match(/\b(20\d\d)\b/);
    if (!y) return null;
    for (var i = 0; i < 12; i++) if (new RegExp('\\b' + MONTHS[i] + '\\b').test(f)) return y[1] + '-' + pad(i + 1);
    var n = f.match(/^(\d{1,2})[./-](20\d\d)$|^(20\d\d)[./-](\d{1,2})$/);
    if (n) { var mo = +(n[1] || n[4]); if (mo >= 1 && mo <= 12) return (n[2] || n[3]) + '-' + pad(mo); }
    return null;
  }
  function parseClock(s) {
    var m = String(s || '').match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    return m ? +m[1] * 60 + +m[2] : null;
  }

  // A table row is identified by what its visible cells look like, never by column position.
  function classify(cells) {
    var kind = null, timed = [], dateOnly = null, dur = null;
    cells.forEach(function (c) {
      var k = parseKind(c); if (k && !kind) { kind = k; return; }
      var st = parseStamp(c);
      if (st) { if (st.time) timed.push(st.t); else if (dateOnly == null) dateOnly = st.t; return; }
      var d = parseDur(c); if (d != null && dur == null) dur = d;
    });
    if (kind && timed.length) return { type: 'ev', t: timed[0], k: kind };
    if (timed.length >= 2) {
      var first = Math.min(timed[0], timed[1]), last = Math.max(timed[0], timed[1]);
      var min = dur != null ? dur : (last - first) / MIN;
      if (min > 1440) return null;
      return { type: 'day', day: dayStart(dateOnly != null ? dateOnly : first), first: first, last: last, min: min };
    }
    return null;
  }

  // Pair entry/exit events of one day into inside-segments.
  function segments(evs, liveEnd) {
    var segs = [], open = null, broken = false;
    evs.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (e) {
      if (e.k === 'G') { if (open == null) open = e.t; }
      else if (open != null) { segs.push([open, e.t]); open = null; }
      else broken = true;
    });
    var inside = open != null;
    if (inside && liveEnd != null && liveEnd > open) segs.push([open, liveEnd]);
    else if (inside) broken = true;
    return { segs: segs, inside: inside, broken: broken, openAt: open };
  }

  // ---------- settings ----------
  function config(c) {
    c = c || {};
    var num = function (v, f, lo, hi) { v = +v; return isFinite(v) && v >= lo && v <= hi ? v : f; };
    var clockOr = function (v, f) { var m = parseClock(v); return m != null ? m : f; };
    return {
      W: num(c.W, 45, 1, 100) * 60, D: num(c.D, 9, 0.5, 16) * 60, cap: num(c.cap, 0, 0, 24) * 60,
      start: clockOr(c.start, 540), coreS: clockOr(c.coreS, 600), coreE: clockOr(c.coreE, 960),
      days: Array.isArray(c.days) && c.days.length ? c.days.filter(function (d) { return d >= 0 && d <= 6; }) : [0, 1, 2, 3, 4]
    };
  }
  var TYPES = ['ofis', 'izin', 'tatil'];

  // store: { types: {date: 'ofis'|'izin'|'tatil'}, plan: {date: {s?, e?}} (minutes of day),
  //          ovr: {date: {s, m}} (past corrections; today: s = typed entry time), ooo: {date: {m, s?}} }
  // opts: { absorb: date key forced to absorb the remainder }
  function week(data, now, cfgIn, store, offset, opts) {
    var cfg = config(cfgIn), today = dayStart(now), ws = weekStart(now) + (offset || 0) * 7 * DAY;
    store = store || {}; opts = opts || {};
    var T = store.types || {}, PL = store.plan || {}, OV = store.ovr || {}, OO = store.ooo || {}, HO = store.hol || {}, PK = store.pick || {};
    var Dm = cfg.D * MIN, capm = function (ms) { return cfg.cap ? Math.min(ms, cfg.cap * MIN) : ms; };
    var core = cfg.coreE > cfg.coreS, thisWeek = !offset;
    var rows = [], issues = [];
    for (var i = 0; i < 7; i++) {
      var date = ws + i * DAY, k = dkey(date), evs = (data.events && data.events[k]) || [], off = data.days && data.days[k];
      var hol = HO[k] || null, workday = cfg.days.indexOf(i) >= 0;
      // An official/company holiday counts as 'tatil' unless the user explicitly marked the day otherwise.
      var type = TYPES.indexOf(T[k]) >= 0 ? T[k] : (hol && !hol.half ? 'tatil' : 'ofis');
      var oo = OO[k] && +OO[k].m > 0 ? { m: +OO[k].m, s: OO[k].s != null && OO[k].s !== '' ? +OO[k].s : null } : null;
      var r = { key: k, date: date, dow: i, today: date === today, past: date < today, future: date > today,
        workday: workday, type: type, credit: workday && type !== 'ofis' ? Dm : 0, ooo: oo, hol: hol,
        half: workday && type === 'ofis' && hol && hol.half ? Dm / 2 : 0,
        segs: [], actual: 0, src: 'none', first: null, last: null, inside: false, flags: [],
        loaded: !!(data.months && data.months[mkey(date)]) };
      r.office = workday && type === 'ofis';
      if (r.past || r.today) {
        var sg = segments(evs, r.today ? now : null);
        if (r.today && evs.length) {
          r.segs = sg.segs; r.inside = sg.inside;
          if (sg.segs.length) { r.first = sg.segs[0][0]; r.last = sg.segs[sg.segs.length - 1][1]; r.actual = capm(r.last - r.first); }
          if (evs.slice().sort(function (a, b) { return a.t - b.t; })[0].k === 'C') r.flags.push('noentry');
          r.src = 'live';
        } else if (off) {
          r.first = off.first; r.last = off.last; r.actual = capm(off.min * MIN); r.src = 'portal';
          r.segs = sg.segs.length && !sg.broken ? sg.segs : [[off.first, off.last]];
          // The portal's daily row sometimes stops at an earlier exit than the entry/exit list shows
          // (e.g. 08:23–11:56 while the list continues 13:22–17:38). Flag it and, unless the user picks
          // the portal figure, count first entry → last exit from the list, the way the portal counts normal days.
          if (sg.segs.length && !sg.broken) {
            var rf = sg.segs[0][0], rl = sg.segs[sg.segs.length - 1][1], rawMin = (rl - rf) / MIN;
            if (Math.abs(rawMin - off.min) > 5) {
              r.mismatch = { portal: off.min * MIN, raw: rl - rf, pFirst: off.first, pLast: off.last, rFirst: rf, rLast: rl, use: PK[k] === 'portal' ? 'portal' : 'raw' };
              // Where the portal stopped: the exit it used and the re-entry after it that it ignored.
              for (var gi = 0; gi < sg.segs.length - 1; gi++) {
                if (Math.abs(sg.segs[gi][1] - off.last) <= MIN) { r.mismatch.gapOut = sg.segs[gi][1]; r.mismatch.gapIn = sg.segs[gi + 1][0]; break; }
              }
              r.flags.push('mismatch');
              if (PK[k] !== 'portal') { r.first = rf; r.last = rl; r.actual = capm(rl - rf); r.src = 'raw'; }
            }
          }
        } else if (evs.length) {
          r.segs = sg.segs; r.src = 'raw';
          if (sg.segs.length) { r.first = sg.segs[0][0]; r.last = sg.segs[sg.segs.length - 1][1]; }
          if (sg.broken || !sg.segs.length) { r.flags.push('open'); if (r.first == null && sg.openAt != null) r.first = sg.openAt; }
          else r.actual = capm(r.last - r.first);
        } else if (!r.loaded) r.flags.push('month');
        else if (r.past && r.office) r.flags.push('absent');
        var ov = OV[k];
        // Today: an entry time the user typed wins over ARGE, or stands in until ARGE records the entry
        // (the card was read but the portal has not shown it yet). The list after that time is kept.
        if (r.today && ov && ov.s != null && date + ov.s * MIN <= now) {
          var ms = date + ov.s * MIN, sg2 = segments([{ k: 'G', t: ms }].concat(evs.filter(function (e) { return e.t > ms; })), now);
          if (r.first != null && r.first !== ms && r.flags.indexOf('noentry') < 0) r.argeFirst = r.first;
          r.segs = sg2.segs; r.inside = sg2.inside;
          if (sg2.segs.length) { r.first = sg2.segs[0][0]; r.last = sg2.segs[sg2.segs.length - 1][1]; r.actual = capm(r.last - r.first); }
          r.src = 'live'; r.manual = true;
          r.flags = r.flags.filter(function (f) { return f !== 'noentry' && f !== 'open' && f !== 'month'; });
        }
        if (r.past && ov && (ov.m != null || ov.s != null)) {
          if (ov.s != null && r.first != null && r.first !== date + ov.s * MIN) r.argeFirst = r.first;
          if (ov.s != null) r.first = date + ov.s * MIN; else if (r.first == null) r.first = date + cfg.start * MIN;
          r.actual = Math.max(0, Math.min(DAY, ov.m != null ? ov.m * MIN : (r.last != null ? r.last - r.first : 0)));
          r.last = r.first + r.actual; r.segs = [[r.first, r.last]]; r.src = 'manual';
          r.flags = r.flags.filter(function (f) { return f !== 'open' && f !== 'absent' && f !== 'month'; });
        }
      }
      if (r.credit) {
        r.flags = r.flags.filter(function (f) { return f !== 'absent' && f !== 'month'; });
        if (r.actual > 0) r.flags.push('overlap');   // policy not established: keep both, never add twice
      }
      r.count = r.credit ? Math.max(r.actual, r.credit) : r.actual + r.half;
      rows.push(r);
    }

    // Work past midnight (entry one day, exit early next morning) is NOT paired automatically: both days are
    // flagged so the user fixes them by hand and, if needed, tells ARGE.
    for (var oi = 0; oi < rows.length - 1; oi++) {
      var ob = rows[oi + 1], evb = ((data.events && data.events[ob.key]) || []).slice().sort(function (x, y) { return x.t - y.t; })[0];
      if (rows[oi].flags.indexOf('open') >= 0 && evb && evb.k === 'C' && evb.t - ob.date < 8 * 60 * MIN) {
        rows[oi].flags.push('overnight'); ob.flags.push('overnight');
        // the next day starts at its own first entry: the night's exit must not stretch it (02:00–17:00 would count 15 h)
        if (ob.src !== 'manual') {
          var evsB = ((data.events && data.events[ob.key]) || []).slice().sort(function (x, y) { return x.t - y.t; }).slice(1);
          var rest = segments(evsB, ob.today ? now : null);
          ob.segs = rest.segs; ob.inside = ob.today && rest.inside; ob.first = rest.segs.length ? rest.segs[0][0] : null; ob.last = rest.segs.length ? rest.segs[rest.segs.length - 1][1] : null;
          ob.actual = rest.segs.length && !rest.broken ? capm(ob.last - ob.first) : 0; ob.src = 'raw';
          ob.flags = ob.flags.filter(function (f) { return f !== 'open' && f !== 'noentry' && f !== 'mismatch'; }); delete ob.mismatch;
          ob.count = ob.credit ? Math.max(ob.actual, ob.credit) : ob.actual + ob.half;
        }
      }
    }
    // ----- projection (current week only) -----
    var absorber = null;
    if (thisWeek) {
      if (opts.absorb) absorber = rows.filter(function (r) { return r.key === opts.absorb && !r.past; })[0] || null;
      if (!absorber) for (var j = 6; j >= 0; j--) {
        var rr = rows[j]; if (rr.past || !rr.office) continue;
        var pp = PL[rr.key]; if (pp && (pp.e != null || pp.m != null)) continue;
        absorber = rr; break;
      }
    }
    var startOf = function (r) {
      if (r.first != null) return r.first;
      var p = PL[r.key], o = OV[r.key], typed = r.today && o && o.s != null, sm = typed ? +o.s : p && p.s != null ? +p.s : cfg.start;
      var s = r.date + sm * MIN;
      return r.today && !typed ? Math.max(now, s) : s;   // a typed later arrival today is a plan, not "now"
    };
    // Core window: a planned office day may not start after core start or end before core end,
    // unless an OOO interval covers the gap. Duration-only OOO leaves compliance unknown.
    var coreCheck = function (r) {
      if (!core || !r.office) return;
      var cs = r.date + cfg.coreS * MIN, ce = r.date + (r.half ? Math.min(cfg.coreE, 780) : cfg.coreE) * MIN, o = r.ooo;
      var covers = function (a, b) { return o && o.s != null && r.date + o.s * MIN <= a && r.date + (o.s + o.m) * MIN >= b; };
      var unknown = o && o.s == null;
      if (r.start != null && r.start > cs + MIN && !covers(cs, r.start)) { if (unknown) r.flags.push('coreUnknown'); else r.flags.push(r.first != null ? 'coreLate' : 'coreStart'); }
      if (r.plan != null && !r.past && r.start != null) {
        var end = r.start + r.plan;
        if (end < ce - MIN && !(r.today && !r.inside && r.last != null && !r.planned)) {
          if (covers(end, ce)) return;
          if (unknown) { r.flags.push('coreUnknown'); return; }
          r.plan = ce - r.start; r.held = true;
        }
      }
      if (r.past && r.last != null && r.last < ce - MIN && !covers(r.last, ce) && r.actual > 0) r.flags.push(unknown ? 'coreUnknown' : 'coreEarly');
    };
    var fixed = 0;
    rows.forEach(function (r) {
      if (r.past || !thisWeek) { r.plan = r.actual; r.val = r.count; fixed += r.val; if (r.past) { r.start = r.first; coreCheck(r); r.start = null; } return; }
      r.start = startOf(r);
      var p = PL[r.key], dflt = r.office ? Dm - r.half : 0;
      if (r.credit) { r.plan = r.actual; }
      else if (r === absorber) { r.plan = null; return; }
      else if (p && p.e != null) { r.plan = Math.max(r.actual, r.date + p.e * MIN - r.start); r.planned = true; }
      else if (p && p.m != null) { r.plan = Math.max(r.actual, p.m * MIN); r.planned = true; }
      else if (r.today) { r.plan = Math.max(r.actual, dflt); if (!r.inside && r.last != null && r.actual >= dflt) r.plan = r.actual; }
      else r.plan = dflt;
      coreCheck(r);
      r.val = r.credit ? Math.max(r.plan, r.credit) : r.plan + r.half;
      fixed += r.val;
    });
    var W = cfg.W * MIN + rows.reduce(function (s, r) { return s + (r.ooo ? r.ooo.m * MIN : 0); }, 0);
    if (absorber) {
      var need = W - fixed;
      absorber.auto = true; absorber.need = need;
      absorber.plan = Math.max(absorber.actual, need - absorber.half, 0);
      coreCheck(absorber);
      absorber.val = absorber.plan + absorber.half;
    }
    var done = 0, total = 0;
    rows.forEach(function (r) {
      if (r.past || r.today || !thisWeek) done += r.count;
      total += r.val;
      if (thisWeek && !r.past && r.start != null && r.plan != null) {
        r.end = r.start + r.plan;
        if (r.today && !r.inside && r.last != null && !r.planned && r.plan <= r.actual) r.end = r.last;
        if (r.end - r.date > DAY) r.late = true;
      }
    });
    // The pure arithmetic moment the week reaches its target (separate from any permitted departure).
    var hit = null, cum = 0;
    for (var q = 0; q < 7 && thisWeek; q++) {
      var h = rows[q];
      if (h.val > 0 && cum + h.val >= W - 1) {
        var rest = W - cum;
        var at = h.credit ? null : (h.first != null ? h.first : (h.start != null ? h.start : h.date + cfg.start * MIN)) + Math.max(0, rest - h.half);
        hit = { day: h, t: at, done: h.past || (h.today && h.count >= rest) };
        break;
      }
      cum += h.val;
    }
    var shortfall = thisWeek ? Math.max(0, W - total) : 0;
    var bank = 0;
    rows.forEach(function (r) { if (r.past && r.office && r.actual > 0) bank += r.actual - (Dm - r.half); });
    var balance = 0;
    rows.forEach(function (r) { if (r.past) balance += r.count - (r.workday ? Dm : 0); });
    rows.forEach(function (r) { r.flags.forEach(function (f) { issues.push({ key: r.key, flag: f, month: mkey(r.date) }); }); });
    var td = rows.filter(function (r) { return r.today; })[0] || null;
    var milestone = td && td.first != null && td.office ? td.first + Dm - td.half : null;
    // Today's headline: when the week's target is reached today (usually Friday), that moment matters,
    // not the 9-hour mark. Otherwise the daily 9 hours.
    var goal = null;
    if (thisWeek && td && td.office) {
      if (hit && hit.day === td && hit.t != null) goal = { t: hit.t, week: true };
      else if (milestone != null) goal = { t: milestone, week: false };
    }
    return { rows: rows, cfg: cfg, W: W, done: done, total: total, remaining: Math.max(0, W - done), hit: hit,
      shortfall: shortfall, bank: bank, balance: balance, issues: issues, today: td, milestone: milestone, goal: goal,
      absorber: absorber, ws: ws, thisWeek: thisWeek, now: now, ooo: W - cfg.W * MIN };
  }

  // What must another day become so that `day` can end at `endMin`? Returns the projected week.
  function reverse(data, now, cfg, store, day, endMin, absorbKey) {
    var s2 = clone(store); s2.plan = s2.plan || {};
    s2.plan[day] = Object.assign({}, s2.plan[day] || {}, { e: endMin });
    if (absorbKey && s2.plan[absorbKey]) { s2.plan[absorbKey] = Object.assign({}, s2.plan[absorbKey]); delete s2.plan[absorbKey].e; }
    return week(data, now, cfg, s2, 0, { absorb: absorbKey });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }

  // ---------- formatting (round only for display) ----------
  // Durations already earned are floored; times and remaining amounts are rounded up (conservative).
  function hm(ms, signed, up) {
    var neg = ms < 0, m = Math.abs(ms) / MIN; m = up ? Math.ceil(m - 1e-9) : Math.floor(m + 1e-9);
    return (neg ? '−' : signed ? '+' : '') + Math.floor(m / 60) + ':' + pad(m % 60);
  }
  function clock(t, base) {
    if (t == null || !isFinite(t)) return '—';
    var c = Math.ceil(t / MIN - 1e-9) * MIN, d = new Date(c), s = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
    if (base != null && dayStart(c) > dayStart(base)) s += '⁺¹';
    return s;
  }


  // A daily milestone is not the week's absorber or permission to leave early.
  // Pure read-only projection; missing current entry must never be invented as "now".
  function dayGoal(w, index, minutes) {
    var r = w.rows[index]; if (!r) return null;
    var D = minutes != null ? minutes * MIN : w.cfg.D * MIN - (r.half || 0);
    var start = r.first != null ? r.first : (r.future ? r.start : null);
    var coreEnd = null, unknown = !!(r.ooo && r.ooo.s == null);
    if (r.office && w.cfg.coreE > w.cfg.coreS && !unknown) {
      var end = r.half ? Math.min(w.cfg.coreE, 780) : w.cfg.coreE, o = r.ooo;
      if (o && o.s != null && o.s < end && o.s + o.m >= end) end = Math.max(w.cfg.coreS, o.s);
      if (end > w.cfg.coreS) coreEnd = r.date + end * MIN;
    }
    return { start: start, milestone: start != null ? start + D : null, end: start != null ? start + D : null,
      D: D, planned: !!r.future, needsEntry: r.today && r.first == null,
      coreEnd: coreEnd, coreUnknown: unknown, coreLate: r.flags.indexOf('coreLate') >= 0 || r.flags.indexOf('coreStart') >= 0,
      weeklyEnd: w.hit && w.hit.t != null ? w.hit.t : null, W: w.W };
  }

  // ---------- habits ----------
  // The user's usual arrival and leaving, from past office days in the last `weeks` weeks (leave, holidays and
  // odd records left out). Minutes of the day, rounded to 5. Mesai only suggests these; it never applies them by itself.
  function habits(data, now, cfgIn, store, weeks) {
    var cfg = config(cfgIn), today = dayStart(now), from = today - (weeks || 8) * 7 * DAY;
    store = store || {}; var T = store.types || {}, HO = store.hol || {};
    var ins = [], outs = [], lens = [], by = [[], [], [], [], [], [], []];
    for (var d = from; d < today; d += DAY) {
      var k = dkey(d), dw = dow(d);
      if (cfg.days.indexOf(dw) < 0 || (T[k] && T[k] !== 'ofis') || (HO[k] && T[k] !== 'ofis')) continue;
      var first = null, last = null, evs = data.events && data.events[k], off = data.days && data.days[k];
      if (evs && evs.length) { var sg = segments(evs, null); if (sg.segs.length) { first = sg.segs[0][0]; last = sg.segs[sg.segs.length - 1][1]; } }
      if (first == null && off) { first = off.first; last = off.last; }
      if (first == null) continue;
      var a = (first - d) / MIN, b = last != null ? (last - d) / MIN : null;
      if (a < 300 || a > 780) continue;                    // before 05:00 or after 13:00: not a usual arrival
      ins.push(a); by[dw].push(a);
      if (b != null && b > a + 180) { outs.push(b); lens.push(b - a); }
    }
    var med = function (x) { if (!x.length) return null; var y = x.slice().sort(function (p, q) { return p - q; }), m = y.length >> 1; return Math.round((y.length % 2 ? y[m] : (y[m - 1] + y[m]) / 2) / 5) * 5; };
    return { n: ins.length, start: med(ins), end: med(outs), len: med(lens),
      byDow: by.map(function (x) { return x.length >= 3 ? { n: x.length, start: med(x) } : null; }) };
  }

  return { MIN: MIN, DAY: DAY, pad: pad, dayStart: dayStart, dkey: dkey, mkey: mkey, dow: dow, weekStart: weekStart,
    istanbulNow: istanbulNow, parseStamp: parseStamp, parseDur: parseDur, parseKind: parseKind, parsePeriod: parsePeriod,
    parseClock: parseClock, classify: classify, segments: segments, config: config, week: week, reverse: reverse, habits: habits,
    clone: clone, hm: hm, clock: clock, dayGoal: dayGoal, fold: fold, TYPES: TYPES };
})();
if (typeof module !== 'undefined') module.exports = MesaiCore;
