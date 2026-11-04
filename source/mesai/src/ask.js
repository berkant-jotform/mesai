// Mesai "Sor" — tiny offline parser for Turkish/English planning questions. No network, no AI.
var MesaiAsk = (function () {
  var fold = function (s) {
    return String(s || '').replace(/[’'`´]/g, ' ').replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S').replace(/[Ğğ]/g, 'G')
      .replace(/[Üü]/g, 'U').replace(/[Öö]/g, 'O').replace(/[Çç]/g, 'C').toUpperCase().replace(/\s+/g, ' ').trim();
  };
  var DAYS = [
    [/\b(CUMARTESI\w*|SATURDAY|SAT)\b/, 5], [/\b(PAZARTESI\w*|PZT|MONDAY|MON)\b/, 0], [/\b(PAZAR\w*|SUNDAY|SUN)\b/, 6],
    [/\b(CUMA\w*|CUM|FRIDAY|FRI)\b/, 4], [/\b(SALI\w*|SAL|TUESDAY|TUE)\b/, 1], [/\b(CARSAMBA\w*|CAR|WEDNESDAY|WED)\b/, 2],
    [/\b(PERSEMBE\w*|PER|THURSDAY|THU)\b/, 3]
  ];
  function dayOf(f, todayDow) {
    if (/\b(BUGUN\w*|TODAY)\b/.test(f)) return todayDow;
    if (/\b(YARIN\w*|TOMORROW)\b/.test(f)) return Math.min(6, todayDow + 1);
    for (var i = 0; i < DAYS.length; i++) if (DAYS[i][0].test(f)) return DAYS[i][1];
    return null;
  }
  function durations(f) {
    var m = 0, any = false, r;
    if (/\bYARIM SAAT\b|\bHALF (AN )?HOUR\b/.test(f)) { m += 30; any = true; }
    var reH = /(\d+(?:[.,]\d+)?)\s*(SAAT|SA|HOURS?|H)\b/g;
    while ((r = reH.exec(f))) { m += Math.round(parseFloat(r[1].replace(',', '.')) * 60); any = true; }
    var reM = /(\d+)\s*(DAKIKA|DK|MINUTES?|MINS?)\b/g;
    while ((r = reM.exec(f))) { m += +r[1]; any = true; }
    return any ? m : null;
  }
  function times(f) {
    var out = [], r, re = /\b([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b(?!\s*(?:SAAT|SA|HOURS?|H|DAKIKA|DK|MIN))/g;
    var clean = f.replace(/(\d+(?:[.,]\d+)?)\s*(SAAT|SA|HOURS?|H|DAKIKA|DK|MINUTES?|MINS?)\b/g, ' ');
    while ((r = re.exec(clean))) {
      var h = +r[1], mi = r[2] ? +r[2] : 0;
      if (!r[2] && h < 6) h += 12;        // "5'te çıkarım" means 17:00
      out.push(h * 60 + mi);
    }
    return out;
  }
  var LEAVE = /\b(CIK\w*|GIDE\w*|LEAVE|LEAVING|OUT|EXIT)\b/;
  var COME = /\b(GEL\w*|GIR\w*|ARRIVE|COME|IN)\b/;
  var WHEN = /\b(KACTA|NE ZAMAN|SAAT KACTA|WHEN|WHAT TIME)\b/;
  function parse(text, todayDow) {
    var f = fold(text).replace(/(\d)(DA|DE|TA|TE|E|A)\b/g, '$1 $2'); if (!f) return null;
    var day = dayOf(f, todayDow), ts = times(f), dur = durations(f);
    if (/\b(SIFIRLA|TEMIZLE|RESET|CLEAR)\b/.test(f)) return { kind: 'reset' };
    if (/\b(GECEN|ONCEKI|LAST|PREVIOUS) (HAFTA|WEEK)\b/.test(f)) return { kind: 'history' };
    if (/\b(KALAN|NE KADAR|REMAINING|HOW MUCH)\b/.test(f) && !LEAVE.test(f)) return { kind: 'remaining' };
    if (/\bOOO\b|SAATLIK IZIN|HOURS? OFF/.test(f)) return { kind: 'ooo', day: day != null ? day : todayDow, m: dur != null ? dur : 60, s: ts.length ? ts[0] : null };
    if (/\b(SIMDI|NOW|HEMEN)\b/.test(f) && LEAVE.test(f)) return { kind: 'leaveNow', day: todayDow };
    if (/\b(IZIN\w*|TATIL\w*|DAY OFF|HOLIDAY|VACATION)\b/.test(f)) return { kind: 'type', day: day != null ? day : todayDow, type: /TATIL|HOLIDAY/.test(f) ? 'tatil' : 'izin' };
    if (/\b(OFIS|OFFICE)\b/.test(f) && day != null && !ts.length) return { kind: 'type', day: day, type: 'ofis' };
    if (ts.length >= 2) return { kind: 'plan', day: day != null ? day : todayDow, s: ts[0], e: ts[1] };
    if (ts.length === 1 && COME.test(f) && !LEAVE.test(f)) return { kind: 'arrive', day: day != null ? day : todayDow, s: ts[0] };
    if (ts.length === 1) return { kind: 'leaveAt', day: day != null ? day : todayDow, e: ts[0] };
    if (dur != null && day != null) return { kind: 'length', day: day, m: dur };
    if (WHEN.test(f) || day != null) return { kind: 'when', day: day != null ? day : 4 };
    return null;
  }
  return { parse: parse, fold: fold, times: times, durations: durations };
})();
if (typeof module !== 'undefined') module.exports = MesaiAsk;
