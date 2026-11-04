// Mesai holidays: Jotform Türkiye company calendar + a local .ics importer (Google Calendar export).
// Nothing is fetched; the list ships inside mesai.js and updates with it.
var MesaiHolidays = (function () {
  // src: 'jotform' = 2026 Jotform Global Holiday Calendar (TR column), 'resmi' = official TR calendar
  // (Jotform's own 2027 calendar was not available when this list was made). At Jotform arife is a full day off.
  var R = [
    ['2026-01-01', 'Yılbaşı', 'New Year’s Day', 'jotform'],
    ['2026-01-02', 'İdari izin', 'Administrative leave', 'jotform'],
    ['2026-03-19', 'Ramazan Bayramı', 'Ramadan Feast', 'jotform'],
    ['2026-03-20', 'Ramazan Bayramı', 'Ramadan Feast', 'jotform'],
    ['2026-03-21', 'Ramazan Bayramı', 'Ramadan Feast', 'jotform'],
    ['2026-03-22', 'Ramazan Bayramı', 'Ramadan Feast', 'jotform'],
    ['2026-04-23', 'Ulusal Egemenlik ve Çocuk Bayramı', 'National Sovereignty and Children’s Day', 'jotform'],
    ['2026-05-01', 'Emek ve Dayanışma Günü', 'Labour and Solidarity Day', 'jotform'],
    ['2026-05-19', 'Gençlik ve Spor Bayramı', 'Youth and Sports Day', 'jotform'],
    ['2026-05-25', 'Kurban Bayramı', 'Sacrifice Feast', 'jotform'],
    ['2026-05-26', 'Kurban Bayramı', 'Sacrifice Feast', 'jotform'],
    ['2026-05-27', 'Kurban Bayramı', 'Sacrifice Feast', 'jotform'],
    ['2026-05-28', 'Kurban Bayramı', 'Sacrifice Feast', 'jotform'],
    ['2026-05-29', 'Kurban Bayramı', 'Sacrifice Feast', 'jotform'],
    ['2026-05-30', 'Kurban Bayramı', 'Sacrifice Feast', 'jotform'],
    ['2026-07-15', 'Demokrasi ve Milli Birlik Günü', 'Democracy and National Unity Day', 'jotform'],
    ['2026-08-30', 'Zafer Bayramı', 'Victory Day', 'jotform'],
    ['2026-10-28', 'İdari izin', 'Administrative leave', 'jotform'],
    ['2026-10-29', 'Cumhuriyet Bayramı', 'Republic Day', 'jotform'],
    ['2027-01-01', 'Yılbaşı', 'New Year’s Day', 'resmi'],
    ['2027-03-08', 'Ramazan Bayramı arifesi', 'Ramadan Feast eve', 'resmi'],
    ['2027-03-09', 'Ramazan Bayramı', 'Ramadan Feast', 'resmi'],
    ['2027-03-10', 'Ramazan Bayramı', 'Ramadan Feast', 'resmi'],
    ['2027-03-11', 'Ramazan Bayramı', 'Ramadan Feast', 'resmi'],
    ['2027-04-23', 'Ulusal Egemenlik ve Çocuk Bayramı', 'National Sovereignty and Children’s Day', 'resmi'],
    ['2027-05-01', 'Emek ve Dayanışma Günü', 'Labour and Solidarity Day', 'resmi'],
    ['2027-05-15', 'Kurban Bayramı arifesi', 'Sacrifice Feast eve', 'resmi'],
    ['2027-05-16', 'Kurban Bayramı', 'Sacrifice Feast', 'resmi'],
    ['2027-05-17', 'Kurban Bayramı', 'Sacrifice Feast', 'resmi'],
    ['2027-05-18', 'Kurban Bayramı', 'Sacrifice Feast', 'resmi'],
    ['2027-05-19', 'Kurban Bayramı · 19 Mayıs', 'Sacrifice Feast · Youth Day', 'resmi'],
    ['2027-07-15', 'Demokrasi ve Milli Birlik Günü', 'Democracy and National Unity Day', 'resmi'],
    ['2027-08-30', 'Zafer Bayramı', 'Victory Day', 'resmi'],
    ['2027-10-28', 'Cumhuriyet Bayramı arifesi', 'Republic Day eve', 'resmi'],
    ['2027-10-29', 'Cumhuriyet Bayramı', 'Republic Day', 'resmi']
  ];
  var LIST = {};
  R.forEach(function (x) { LIST[x[0]] = { n: x[1], en: x[2], src: x[3], half: !!x[4] }; });

  // ---------- .ics (RFC 5545) — parsed locally in the browser ----------
  var fold = function (s) {
    return String(s || '').replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S').replace(/[Ğğ]/g, 'G').replace(/[Üü]/g, 'U')
      .replace(/[Öö]/g, 'O').replace(/[Çç]/g, 'C').toUpperCase();
  };
  var HOL = /BAYRAM|RESMI TATIL|\bTATIL|HOLIDAY|YILBASI|NEW YEAR/;
  var LEAVE = /\bIZIN|IZINLI|YILLIK|\bLEAVE\b|VACATION|\bPTO\b|DAY OFF|TIME OFF|\bOFF\b|RAPORLU/;
  var OOO = /\bOOO\b|OUT OF OFFICE|OFIS DISI|OFISTE DEGIL/;
  var DAY = 86400000, MIN = 60000;
  function stamp(v, params) {
    var m = String(v).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    if (m[7]) t += 3 * 3600000;   // UTC → Europe/Istanbul (UTC+3 all year since 2016)
    return { t: t, allDay: m[4] == null || /VALUE=DATE(?!-)/.test(params || '') };
  }
  // Returns [{date, kind:'izin'|'tatil'|'ooo', m?, s?, title}] for days in [from, to].
  function parseICS(text, from, to, workMin) {
    var lines = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/), ev = null, evs = [];
    lines.forEach(function (ln) {
      if (ln === 'BEGIN:VEVENT') { ev = {}; return; }
      if (ln === 'END:VEVENT') { if (ev) evs.push(ev); ev = null; return; }
      if (!ev) return;
      var i = ln.indexOf(':'); if (i < 0) return;
      var head = ln.slice(0, i), val = ln.slice(i + 1), name = head.split(';')[0].toUpperCase(), params = head.slice(name.length);
      if (name === 'DTSTART') ev.s = stamp(val, params);
      else if (name === 'DTEND') ev.e = stamp(val, params);
      else if (name === 'SUMMARY') ev.title = val.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' ');
      else if (name === 'X-GOOGLE-EVENT-TYPE' || name === 'X-MICROSOFT-CDO-BUSYSTATUS') ev.xt = val;
      else if (name === 'STATUS') ev.status = val;
    });
    var out = {};
    evs.forEach(function (e) {
      if (!e.s || e.status === 'CANCELLED') return;
      var f = fold(e.title) + ' ' + fold(e.xt), kind = OOO.test(f) || /OUTOFOFFICE|OOF/.test(f) ? 'ooo' : HOL.test(f) ? 'tatil' : LEAVE.test(f) ? 'izin' : null;
      if (!kind) return;
      var s = e.s.t, en = e.e ? e.e.t : (e.s.allDay ? s + DAY : s + 3600000);
      if (en <= s) return;
      for (var d = Math.floor(s / DAY) * DAY; d < en; d += DAY) {
        if (d < from || d > to) continue;
        var dow = (new Date(d).getUTCDay() + 6) % 7; if (dow > 4) continue;
        var key = new Date(d).toISOString().slice(0, 10), a = Math.max(s, d), b = Math.min(en, d + DAY), m = Math.round((b - a) / MIN);
        var whole = e.s.allDay || m >= (workMin || 540) || (a === d && b === d + DAY);
        var item = whole ? { date: key, kind: kind === 'ooo' ? 'izin' : kind, title: e.title || '' } : { date: key, kind: 'ooo', m: m, s: Math.round((a - d) / MIN), title: e.title || '' };
        var prev = out[key];
        if (!prev) out[key] = item;
        else if (prev.kind === 'ooo' && item.kind === 'ooo') { var lo = Math.min(prev.s, item.s), hi = Math.max(prev.s + prev.m, item.s + item.m); prev.s = lo; prev.m = Math.min(prev.m + item.m, hi - lo); }
        else if (prev.kind === 'ooo') out[key] = item;
      }
    });
    return Object.keys(out).sort().map(function (k) { return out[k]; });
  }
  return { LIST: LIST, parseICS: parseICS };
})();
if (typeof module !== 'undefined') module.exports = MesaiHolidays;
