// Mesai "Sor" v2 — what-if scenarios in plain Turkish/English. Offline grammar, no AI, no network.
// parse(text) → { frames:[{days, s, e, len, delta, ooo, type, before}], query:{kind, frame}, each }
// solve(...) → the answer as numbers; the UI turns it into words.
var MesaiScen = (function () {
  var fold = function (s) {
    return String(s || '').replace(/[’'`´]/g, ' ').replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S').replace(/[Ğğ]/g, 'G')
      .replace(/[Üü]/g, 'U').replace(/[Öö]/g, 'O').replace(/[Çç]/g, 'C').toUpperCase().replace(/\s+/g, ' ').trim();
  };
  var UNITS = { BIR: 1, IKI: 2, UC: 3, DORT: 4, BES: 5, ALTI: 6, YEDI: 7, SEKIZ: 8, DOKUZ: 9 };
  var TENS = { ON: 10, YIRMI: 20, OTUZ: 30, KIRK: 40, ELLI: 50 };
  var SFX = '(?:DE|DA|TE|TA|DEN|DAN|TEN|TAN|YE|YA|E|A|U|I|AR|ER|SAR|SER|ER|I)';
  var NUMW = new RegExp('^(SIFIR|BIR|IKI|UC|DORT|BES|ALTI|YEDI|SEKIZ|DOKUZ|ON|YIRMI|OTUZ|KIRK|ELLI)(' + SFX + '|Y[AE]|S[AE]R)?$');

  // ---------- normalisation: words → digits, split suffixes ----------
  function norm(text) {
    var f = fold(text).replace(/\b(\d{1,2})\s*H\s*(\d{1,2})\s*(?:M(?:IN(?:UTE)?S?)?)?\b/g, '$1 SAAT $2 DK').replace(/(\d)\s*([.:])\s*(\d\d)\b/g, '$1$2$3')
      .replace(/([?!;])/g, ' $1 ').replace(/,(?!\d)/g, ' , ').replace(/(\S)-(\S)/g, '$1 - $2');
    var w = f.split(' '), out = [];
    for (var i = 0; i < w.length; i++) {
      var m = w[i].match(NUMW);
      if (m) {
        var stem = m[1], sfx = m[2] || '', val = stem in UNITS ? UNITS[stem] : stem === 'SIFIR' ? 0 : TENS[stem];
        var nx = (w[i + 1] || '').match(NUMW);
        if (stem === 'ON' && /^(A|E|U|I)$/.test(sfx)) { out.push(w[i]); continue; }
        if (stem in TENS && !sfx && nx && nx[1] in UNITS) { val += UNITS[nx[1]]; sfx = nx[2] || ''; i++; }
        else if (stem === 'ON' && !sfx && !/^(SAAT|SA|BUCUK|BUCUKTA|DAKIKA|DK|GIBI|CEYREK)/.test(w[i + 1] || '')) { out.push(w[i]); continue; }
        else if (stem === 'BIR' && !sfx && !/^(SAAT|SA|BUCUK|BUCUKTA|DAKIKA|DK|BUCUK)/.test(w[i + 1] || '')) continue; // filler "bir"
        out.push(String(val)); if (sfx) out.push(sfx.replace(/^Y(?=[AE]$)/, '').replace(/^S(?=[AE]R$)/, ''));
        continue;
      }
      out.push(w[i]);
    }
    return out.join(' ')
      .replace(/(\d)(SAATLIK|SAAT(?:IMI?|I)?|SA|DAKIKA|DK|HOURS?|HRS?|H|MINS?|MINUTES?|AM|PM)\b/g, '$1 $2')
      .replace(/(\d)(DEN|DAN|TEN|TAN|DE|DA|TE|TA|YE|YA|E|A|U|I|IN|AR|ER|SAR|SER)\b/g, '$1 $2')
      .replace(/\b(\d+) H (\d+)\b/g, '$1 SAAT $2 DK').replace(/\s+/g, ' ').trim();
  }

  // ---------- lexer ----------
  var DAYW = [[/^(CUMARTESI\w*|SATURDAYS?|SAT)$/, 5], [/^(PAZARTESI\w*|PZT\w*|MONDAYS?|MON)$/, 0], [/^(PAZAR\w*|SUNDAYS?|SUN)$/, 6],
    [/^(CUMA\w*|CUM|FRIDAYS?|FRI)$/, 4], [/^(SALI\w*|SAL|TUESDAYS?|TUE)$/, 1], [/^(CARSAMBA\w*|CAR|CRS|WEDNESDAYS?|WED)$/, 2],
    [/^(PERSEMBE\w*|PERS\w*|PRS|THURSDAYS?|THU|PER)$/, 3]];
  var V_ARR = /^(GEL|GIR|BASLA|ARRIVE|COME|CAME|START|GET)/, V_LV = /^(CIK|GIT|GIDE|GIDI|BITIR|LEAVE|LEAVING|EXIT|HEAD|FINISH|GO|OUT)/;
  var V_STAY = /^(KALS|KALIRS|KALMA|KALAC|KALIC|KALIR|KALAYIM|KALMAL|CALIS|YAP|WORK|STAY|DO|PUT|DOLDUR)/;
  var PAST = /(TIM|TIM|DIM|DUM|TUM|MISIM|MUSUM|DIK|TIK|WORKED|DID)$/;
  var MODAL = /(MALI|MELI|MALIY|MELIY|LAZIM|GEREK|NEED|SHOULD|MUST|HAVE)/;
  var HYP = /(SAM|SEM|RSAM|RSEM|SAYDIM|SEYDIM|ARSAM|ERSEM|RSA|RSE|IF)/;
  function lex(f) {
    var w = f.split(' '), it = [], i, x;
    var at = function (k) { return w[k] || ''; };
    for (i = 0; i < w.length; i++) {
      x = w[i];
      if (x === ',' || x === '?' || x === '!' || x === ';' || x === 'VE' || x === 'AND' || x === 'SONRA' && /^(DA|DE)$/.test(at(i - 1))) { it.push({ t: 'SEP', x: x }); continue; }
      if (x === '-' || x === 'ILE' || x === 'TO' || x === 'TIL' || x === 'UNTIL') { it.push({ t: 'DASH', x: x }); continue; }
      // relative days and "each"
      if (/^BUGUN/.test(x) || x === 'TODAY' || (x === 'BU' && /^GUN/.test(at(i + 1)))) { if (x === 'BU') i++; it.push({ t: 'DAY', d: 'T' }); continue; }
      if (/^YARIN/.test(x) && /^SONRA/.test(at(i + 1)) || (x === 'DAY' && at(i + 1) === 'AFTER')) { i += x === 'DAY' ? 2 : 1; it.push({ t: 'DAY', d: 'T+2' }); continue; }
      if (/^YARIN/.test(x) || x === 'TOMORROW') { it.push({ t: 'DAY', d: 'T+1' }); continue; }
      if ((/^(OBUR|OBURSU|ERTESI)$/.test(x)) && /^GUN/.test(at(i + 1))) { i++; it.push({ t: 'DAY', d: 'T+2' }); continue; }
      if (/^DUN$|^DUNKU|^YESTERDAY/.test(x)) { it.push({ t: 'DAY', d: 'T-1' }); continue; }
      if ((x === 'HER' && /^GUN/.test(at(i + 1))) || /^HERGUN/.test(x) || /^GUNDE$|^GUNLUK/.test(x) || /^HEPSIN/.test(x) ||
        ((x === 'KALAN' || x === 'DIGER' || x === 'OTHER') && /^(GUN|DAY)/.test(at(i + 1))) || (x === 'GERI' && at(i + 1) === 'KALAN') ||
        ((x === 'EVERY' || x === 'EACH' || x === 'PER') && /^DAY/.test(at(i + 1))) || x === 'DAILY' || (x === 'REST' && at(i + 1) === 'OF') ||
        (x === 'BUNDAN' && /^SONRA/.test(at(i + 1))) || (x === 'HAFTA' && /^ICI/.test(at(i + 1)))) {
        if (x === 'HER' || x === 'KALAN' || x === 'DIGER' || x === 'OTHER' || x === 'EVERY' || x === 'EACH' || x === 'PER' || x === 'BUNDAN' || x === 'HAFTA') i++;
        if (x === 'GERI') { i++; if (/^GUN/.test(at(i + 1))) i++; }
        if (x === 'REST') { i += 2; if (/^WEEK/.test(at(i + 1))) i++; }
        it.push({ t: 'DAY', d: 'EACH' }); continue;
      }
      var dd = null; DAYW.forEach(function (p) { if (dd == null && p[0].test(x)) dd = p[1]; });
      if (dd != null && at(i + 1) === 'KADAR' && !/^(\d|GEL|CIK|KAL|CALIS|YAP)/.test(at(i + 2))) { i++; it.push({ t: 'MARK', m: 'week' }); continue; }
      if (dd != null && !(x === 'PER' && /^DAY/.test(at(i + 1)))) { it.push({ t: 'DAY', d: dd, from: /(DEN|DAN|TEN|TAN)$/.test(x) || /^(DEN|DAN)$/.test(at(i + 1)) }); continue; }
      // durations
      if (x === 'YARIM' && /^(SAAT|SA|HOUR)/.test(at(i + 1))) { i++; it.push(durMore({ t: 'DUR', m: 30 }, w, i)); continue; }
      if (x === 'CEYREK' && /^(SAAT|SA)/.test(at(i + 1))) { i++; it.push(durMore({ t: 'DUR', m: 15 }, w, i)); continue; }
      if (x === 'HALF' && /^(AN|A)$/.test(at(i + 1)) && /^HOUR/.test(at(i + 2))) { i += 2; it.push(durMore({ t: 'DUR', m: 30 }, w, i)); continue; }
      if (x === 'OGLEN' || x === 'OGLE' || x === 'NOON' || x === 'OGLENE') { it.push({ t: 'TIME', m: 720, fixed: true }); continue; }
      var num = x.match(/^(\d{1,4})(?:([.:,])(\d{1,2}))?$/);
      if (num) { var r = number(w, i, num); i = r.i; it.push(r.item); continue; }
      // markers
      if (x === 'OOO' || x === 'O.O.O' || (x === 'OUT' && at(i + 1) === 'OF' && /^OFFICE/.test(at(i + 2))) || (x === 'SAATLIK' && /^IZIN/.test(at(i + 1))) || (x === 'OFIS' && /^DISI/.test(at(i + 1)))) {
        if (x === 'OUT') i += 2; else if (x === 'SAATLIK' || x === 'OFIS') i++;
        if (/^(ALMADAN|KULLANMADAN|OLMADAN)$/.test(at(i + 1)) || at(i - 1) === 'WITHOUT') { i++; continue; }
        it.push({ t: 'OOO' }); continue;
      }
      if (x === 'OFF' && it.length && it[it.length - 1].t === 'DUR') { it.push({ t: 'OOO' }); continue; }
      if (/^(IZIN|IZNI|YILLIK|PTO|VACATION|OFF$)/.test(x) || (x === 'DAY' && at(i + 1) === 'OFF')) { if (x === 'DAY') i++; it.push({ t: 'TYPE', type: 'izin' }); continue; }
      if (/^(TATIL|HOLIDAY|BAYRAM)/.test(x)) { it.push({ t: 'TYPE', type: 'tatil' }); continue; }
      if (/^(OFIS|OFFICE)/.test(x) && !/^DISI/.test(at(i + 1))) { it.push({ t: 'TYPE', type: 'ofis' }); continue; }
      if (/^ORTALAMA|^AVERAGE|^AVG/.test(x)) { it.push({ t: 'MARK', m: 'avg' }); continue; }
      if (/^(FAZLAM|FAZLAMI|FAZLAS|FAZLALIG|EKSIG|EKSIK|ACIG|ACIK|BORC|BAKIYE|BIRIKM|ALACAG|OVERTIME|AHEAD|BEHIND|SURPLUS|BALANCE|DEFICIT)/.test(x)) { it.push({ t: 'MARK', m: 'balance' }); continue; }
      if (x === 'FAZLA' && /^MESAI/.test(at(i + 1))) { i++; it.push({ t: 'MARK', m: 'balance' }); continue; }
      if (x === 'EN' && /^(ERKEN|EARLY)/.test(at(i + 1)) || x === 'EARLIEST' || /^ERKEN$/.test(x) || x === 'EARLY') { if (x === 'EN') i++; it.push({ t: 'MARK', m: 'earliest' }); continue; }
      if (/^(KALDI|KALAN|KALIYOR|REMAIN|LEFT)/.test(x)) { it.push({ t: 'MARK', m: 'remaining' }); continue; }
      if (/^(TOPLAM|TOTAL|SO$|SOFAR|SIMDIYE|BURADAYIM|ICERDEYIM|OLDU$|BERI$|MESAIM|MESAIMIZ)/.test(x) || (x === 'SU' && /^ANA/.test(at(i + 1)))) { it.push({ t: 'MARK', m: 'done' }); continue; }
      if (/^(SIMDI|NOW|HEMEN)$/.test(x) || (x === 'SU' && /^AN$/.test(at(i + 1))) || (x === 'RIGHT' && at(i + 1) === 'NOW')) { if (x === 'SU' || x === 'RIGHT') i++; it.push({ t: 'MARK', m: 'now' }); continue; }
      if (/^(SIFIRLA|TEMIZLE|RESET|CLEAR)/.test(x)) { it.push({ t: 'MARK', m: 'reset' }); continue; }
      if (/^(GECEN|ONCEKI|LAST|PREVIOUS)$/.test(x) && /^(HAFTA|WEEK)/.test(at(i + 1))) { i++; it.push({ t: 'MARK', m: 'history' }); continue; }
      if (/^HAFTA/.test(x) || x === 'WEEK' || x === 'WEEKLY') { it.push({ t: 'MARK', m: 'week' }); continue; }
      if (/^(OLUR|OLURUM|OLURSUN|OLURUZ|EDER|EDERIM|OLACAK|YAPAR|YAPARIM)$/.test(x)) { it.push({ t: 'MARK', m: 'olur' }); continue; }
      if (/^(WILL|WOULD)$/.test(x) && /^(I|THAT|IT)$/.test(at(i + 1)) && /^(HAVE|BE)$/.test(at(i + 2))) { it.push({ t: 'MARK', m: 'olur' }); i += 2; continue; }   // "how many hours will I have"
      // questions
      if (/^(KACTA|KACA|KACTAN|KACDA)$/.test(x) || (x === 'NE' && /^ZAMAN/.test(at(i + 1))) || x === 'WHEN' || (x === 'WHAT' && at(i + 1) === 'TIME') || (x === 'SAAT' && /^KAC/.test(at(i + 1)))) {
        if (x === 'NE' || x === 'WHAT' || x === 'SAAT') i++;
        it.push({ t: 'Q', q: 'when' }); continue;
      }
      if ((x === 'KAC' && /^(SAAT|SA|DAKIKA|DK)/.test(at(i + 1))) || (x === 'NE' && /^KADAR/.test(at(i + 1))) || (x === 'HOW' && /^(MANY|MUCH|LONG)/.test(at(i + 1)))) {
        i++; if (x === 'HOW' && /^HOURS?/.test(at(i + 1))) i++;
        it.push({ t: 'Q', q: 'much' }); continue;
      }
      if ((x === 'NE' && /^(OLUR|OLACAK)/.test(at(i + 1))) || (x === 'WHAT' && /^HAPPENS/.test(at(i + 1)))) { i++; it.push({ t: 'Q', q: 'yn' }); continue; }
      if (/^(MI|MU|MIYIM|MUYUM|MIYIZ|MISIN|MIDIR)$/.test(x) || (x === 'CAN' && /^I$/.test(at(i + 1))) || (/^(IS|AM|WILL|DOES)$/.test(x) && i === 0)) { it.push({ t: 'Q', q: 'yn' }); continue; }
      if (/^(ONCE|BEFORE|ERKEN)$/.test(x)) { it.push({ t: 'BOUND', b: 'before' }); continue; }
      if (/^(KADAR)$/.test(x)) { it.push({ t: 'BOUND', b: 'until' }); continue; }
      if (/^(SABAH|MORNING)$/.test(x)) { it.push({ t: 'MOD', pm: false }); continue; }
      if (/^(AKSAM|EVENING|GECE)$/.test(x) || (x === 'OGLEDEN' && /^SONRA/.test(at(i + 1)))) { if (x === 'OGLEDEN') i++; it.push({ t: 'MOD', pm: true }); continue; }
      var tn = /^(LAZIM|GEREK)/.test(at(i + 1)) ? 'modal' : tense(x);
      if (V_ARR.test(x)) { it.push({ t: 'VERB', v: 'arr', tense: tn }); continue; }
      if (V_LV.test(x)) { it.push({ t: 'VERB', v: 'lv', tense: tn }); continue; }
      if (V_STAY.test(x)) { it.push({ t: 'VERB', v: 'stay', tense: tn }); continue; }
      if (x === 'FAZLA' || x === 'MORE' || x === 'EXTRA') { it.push({ t: 'MORE', k: 'fazla' }); continue; }
      if (x === 'DAHA') { it.push({ t: 'MORE', k: 'daha' }); continue; }
    }
    return it;
  }
  function tense(x) { return PAST.test(x) ? 'past' : MODAL.test(x) ? 'modal' : HYP.test(x) ? 'hyp' : 'q'; }
  function durMore(item, w, i) { if (/^(FAZLA|MORE|EXTRA)$/.test(w[i + 1] || '')) item.more = 'fazla'; else if ((w[i + 1] || '') === 'DAHA') item.more = 'daha'; return item; }
  // A number token: duration (with unit) or a clock time.
  function number(w, i, m) {
    var at = function (k) { return w[k] || ''; }, h = +m[1], mi = null, j = i;
    var hasFrac = m[2] != null;
    if (m[1].length >= 3 && !hasFrac) { h = Math.floor(+m[1] / 100); mi = +m[1] % 100; }
    var buc = /^BUCUK/.test(at(j + 1));
    if (buc) j++;
    var unit = at(j + 1);
    if (/^(SAAT(?:IMI?|I)?$|SAATLIK|SA$|HOURS?$|HRS?$|H$)/.test(unit)) {
      var clockDuration = hasFrac && (m[2] === ':' || (m[2] === '.' && m[3].length === 2 && !/^(HOURS?|HRS?|H)$/.test(unit)));
      if (clockDuration && +m[3] > 59) return { i: j + 1, item: { t: 'X' } };
      var hrs = hasFrac ? (clockDuration ? h + (+m[3]) / 60 : parseFloat(m[1] + '.' + m[3])) : h; if (buc) hrs += 0.5;   // 9:30 / 9.30 saat = 9 h 30 min; 9,5 saat = 9.5 h
      var tot = Math.round(hrs * 60); j++;
      if (/^\d{1,2}$/.test(at(j + 1)) && /^(DAKIKA|DK|MIN)/.test(at(j + 2))) { tot += +at(j + 1); j += 2; }
      if (/^(AR|ER|SAR|SER)$/.test(at(j + 1))) j++;
      return { i: j, item: durMore({ t: 'DUR', m: tot }, w, j) };
    }
    if (/^(DAKIKA|DK|MINS?$|MINUTES?)/.test(unit) && !hasFrac) return { i: j + 1, item: durMore({ t: 'DUR', m: h }, w, j + 1) };
    if (/^(AR|ER|SAR|SER)$/.test(unit) && /^(SAAT|SA)/.test(at(j + 2))) return number(w.slice(0, j + 1).concat(w.slice(j + 2)), i, m);
    // clock time
    if (hasFrac && (m[2] === ',' || (m[2] === '.' && m[3].length === 1)) && !buc) { /* "9,5" without unit: a duration by context */ return { i: j, item: { t: 'NUM', m: Math.round(parseFloat(m[1] + '.' + m[3]) * 60) } }; }
    if (hasFrac) mi = +m[3] * (m[3].length === 1 ? 10 : 1);
    if (buc) mi = 30;
    if (h > 23 || (mi != null && mi > 59)) return { i: j, item: { t: 'X' } };
    var sfx = /^(DE|DA|TE|TA|DEN|DAN|TEN|TAN|YE|YA|E|A|U|I|IN)$/.test(at(j + 1)) ? at(++j) : '';
    if (/^(AM|PM)$/.test(at(j + 1))) { if (h < 1 || h > 12) return { i: j + 1, item: { t: 'X' } }; var pm = at(++j) === 'PM'; return { i: j, item: { t: 'TIME', h: h, mi: mi || 0, pm: pm, ampm: true, sfx: sfx } }; }
    var item = { t: 'TIME', h: h, mi: mi || 0, sfx: sfx, bare: mi == null && !buc, colon: m[2] === ':' };
    if (/^(DEN|DAN|TEN|TAN)$/.test(sfx)) item.from = true;
    if (!sfx && !hasFrac && !buc && h <= 16) item.maybeDur = true;
    return { i: j, item: item };
  }

  // ---------- grammar ----------
  function parse(text) {
    var f = norm(text); if (!f) return null;
    var it = lex(f), frames = [], cur = { days: [] }, q = null, marks = {}, verbs = [];
    var slots = function (fr) { return fr.s != null || fr.e != null || fr.len != null || fr.type || fr.ooo || fr.unk; };
    var push = function () { if (cur.days.length || slots(cur)) frames.push(cur); cur = { days: [] }; };
    it.forEach(function (x) { if (x.t === 'MARK') marks[x.m] = true; if (x.t === 'VERB') verbs.push(x); });
    for (var i = 0; i < it.length; i++) {
      var x = it[i];
      if (x.t === 'DAY') {
        var prev = it[i - 1], pd = cur.days[cur.days.length - 1];
        if (pd != null && typeof pd === 'number' && typeof x.d === 'number' && ((prev && prev.t === 'DASH') || cur.rangeFrom)) {
          for (var d = pd + 1; d <= x.d; d++) cur.days.push(d); cur.rangeFrom = false; continue;
        }
        if (x.d === 'EACH' && cur.days.length > 1 && !slots(cur)) continue;
        if (cur.days.length && slots(cur)) push();
        cur.days.push(x.d); if (x.from) cur.rangeFrom = true;
        continue;
      }
      if ((x.t === 'DUR' || x.t === 'NUM') && x.m > 16 * 60) continue;
      if (x.t === 'DUR' || x.t === 'NUM') {
        var nearO = (it[i - 1] && it[i - 1].t === 'OOO') || (it[i + 1] && it[i + 1].t === 'OOO') || (it[i + 2] && it[i + 2].t === 'OOO' && it[i + 1].t !== 'DAY');
        if (nearO) { cur.ooo = { m: x.m, s: null }; x.used = true; continue; }
        if (cur.len != null && cur.days.length) push();
        cur.len = x.m; if (x.more) cur.delta = x.more;
        continue;
      }
      if (x.t === 'TIME') {
        var y = it[i + 1], z = it[i + 2];
        // ranges: 9-18, 8 den 17 ye kadar, 10-12 arası ooo
        if (y && y.t === 'DASH' && z && z.t === 'TIME' || (x.from && y && y.t === 'TIME')) {
          var z2 = y.t === 'TIME' ? y : z; i += y.t === 'TIME' ? 1 : 2;
          var a = clock(x, 'arr'), b = clock(z2, 'lv');
          var oo = it[i + 1] && it[i + 1].t === 'OOO' || (it[i + 2] && it[i + 2].t === 'OOO');
          if (oo) cur.ooo = { s: a, m: Math.max(0, b - a) }; else { cur.s = a; cur.e = b; }
          continue;
        }
        var role = roleOf(it, i);
        if (role === 'oooS') { cur.oooS = clock(x, 'arr'); continue; }
        if (role === 'stay' && !x.sfx) { if (cur.len != null && cur.days.length) push(); cur.len = x.h * 60 + (x.mi || 0); continue; }
        if (role === 'arr') cur.s = clock(x, 'arr');
        else if (role === 'lv') { cur.e = clock(x, 'lv'); if (roleBound(it, i) === 'before') cur.before = true; }
        else cur.unk = x;
        continue;
      }
      if (x.t === 'OOO') { cur.ooo = cur.ooo || { m: null, s: null }; continue; }
      if (x.t === 'TYPE') { if (cur.days.length && slots(cur) && !cur.type) { /* "yarın izin" after slots of another day */ } cur.type = x.type; continue; }
      if (x.t === 'Q') { if (!q || (x.q === 'when' && q.q === 'when')) q = { q: x.q, frame: cur, at: i }; continue; }
      if (x.t === 'SEP' && slots(cur) && cur.days.length) push();
    }
    push();
    frames.forEach(function (fr) {
      if (fr.ooo && fr.oooS != null) fr.ooo.s = fr.oooS;
      if (fr.ooo && fr.ooo.m == null) { if (fr.len != null) fr.ooo.m = fr.len; else { fr.ooo.m = 60; fr.ooo.dflt = true; } }
      if (fr.ooo && fr.len === fr.ooo.m) delete fr.len;
      delete fr.oooS; delete fr.rangeFrom;
    });
    var kind = queryKind(it, q, marks, verbs, frames);
    // A bare clock with no verb takes the role the question is not asking for.
    frames.forEach(function (fr) {
      if (!fr.unk) return;
      var u = fr.unk; delete fr.unk;
      if (u.maybeDur && (kind === 'leave' || kind === 'earliest') && fr.days.indexOf('EACH') >= 0 && fr.len == null) { fr.len = u.h * 60; return; }
      if (kind === 'arrive') { if (fr.e == null) fr.e = clock(u, 'lv'); }
      else if (kind === 'leave' || kind === 'earliest') { if (fr.s == null) fr.s = clock(u, 'arr'); }
      else if (u.h >= 13 || (u.h <= 5 && u.h > 0)) { if (fr.e == null) fr.e = clock(u, 'lv'); }
      else if (fr.s == null) fr.s = clock(u, 'arr');
    });
    // "18:20'de çıkarsam kaç saat olur" / "how many hours will I have": one exit on one day, asking that day's length
    var modalLength = verbs.some(function (v) { return v.tense === 'modal'; });
    if ((kind === 'target' || kind === 'reqLen' || (q && q.q === 'much')) && !modalLength && !marks.week && frames.length === 1 && frames[0].e != null && frames[0].days.length <= 1 && !frames[0].ooo && (marks.olur || (q && q.q === 'much'))) kind = 'dayLen';
    // Simple daily finish/completion questions are read-only. They must not move the whole weekly remainder into today.
    var gf = frames.length === 1 ? frames[0] : null, each = frames.some(function (fr) { return fr.days.indexOf('EACH') >= 0; });
    var dailyWords = /\b(?:MESAI(?:M|MIZ)?|SHIFT|DAILY)\b/.test(f), completeWords = /\b(?:DOL\w*|DOLDUR\w*|TAMAM\w*|COMPLETE\w*|FINISH\w*|REACH\w*)\b/.test(f);
    var todayOnly = gf && gf.days.length === 1 && gf.days[0] === 'T';
    if (q && q.q === 'when' && !marks.week && !marks.earliest && !each && frames.length <= 1 && (!gf || (!gf.ooo && !gf.type && gf.s == null && gf.e == null)) &&
      ((todayOnly && (!gf || gf.len == null || completeWords)) || (dailyWords && (!gf || gf.len == null || completeWords)) || (completeWords && gf && gf.len != null))) kind = 'dayGoal';
    if (it.some(function (x) { return x.t === 'X'; })) kind = 'invalidTime';
    var qi = q ? frames.indexOf(q.frame) : -1;
    if (qi < 0 && q && q.frame && !q.frame.days.length) qi = -1;
    return { frames: frames, query: { kind: kind, frame: qi }, each: frames.some(function (fr) { return fr.days.indexOf('EACH') >= 0; }), marks: marks, norm: f };
  }
  function roleBound(it, i) { for (var k = i + 1; k <= i + 2 && k < it.length; k++) if (it[k].t === 'BOUND') return it[k].b; return null; }
  function roleOf(it, i) {
    var bound = null;
    for (var k = i + 1; k < it.length && k <= i + 6; k++) {
      var x = it[k];
      if (x.t === 'BOUND') { if (!bound) bound = x.b; continue; }
      if ((x.t === 'TIME' || x.t === 'DAY') && k > i + 1 && it[k - 1].t === 'VERB') break;
      if (x.t === 'OOO') return 'oooS';
      if (x.t === 'VERB') {
        if (x.v === 'stay') return bound === 'until' || bound === 'before' ? 'lv' : 'stay';
        if (x.v === 'arr' && bound === 'before') return 'arr';
        return x.v;
      }
      if (x.t === 'DUR' || x.t === 'SEP' || x.t === 'Q') break;
    }
    for (var b = i - 1; b >= 0 && b >= i - 3; b--) {
      var p = it[b];
      if (p.t === 'VERB') return p.v === 'stay' ? 'lv' : p.v;
      if (p.t === 'DAY' || p.t === 'TIME' || p.t === 'DUR' || p.t === 'SEP') break;
    }
    if (bound === 'until') return 'lv';
    return null;
  }
  // Bare hours: arriving 1–5 means afternoon; leaving 1–11 means afternoon/evening.
  function clock(x, role) {
    if (x.fixed) return x.m;
    var h = x.h, mi = x.mi || 0;
    if (x.ampm) { if (x.pm && h < 12) h += 12; if (!x.pm && h === 12) h = 0; return h * 60 + mi; }
    if (h === 24) h = 0;
    if (role === 'arr' && h >= 1 && h <= 5) h += 12;
    if (role === 'lv' && h >= 1 && h <= 11) h += 12;
    return h * 60 + mi;
  }
  function queryKind(it, q, marks, verbs, frames) {
    if (marks.reset && !q) return 'reset';
    if (marks.history) return 'history';
    var vAfter = function (from, n) { for (var k = from + 1; k < it.length && k <= from + (n || 4); k++) if (it[k].t === 'VERB') return it[k]; return null; };
    var vNear = q ? (vAfter(q.at, 4) || (function () { for (var k = q.at - 1; k >= 0 && k >= q.at - 3; k--) if (it[k].t === 'VERB') return it[k]; return null; })()) : null;
    var past = verbs.some(function (v) { return v.tense === 'past'; }) || marks.done;
    var hasTime = frames.some(function (fr) { return fr.s != null || fr.e != null || fr.unk; });
    if (marks.avg) return past && !verbs.some(function (v) { return v.tense === 'modal'; }) ? 'avgDone' : 'avg';
    if (marks.balance && !(marks.earliest && hasTime)) return marks.earliest ? 'earliest' : 'balance';
    if (marks.now && verbs.some(function (v) { return v.v === 'lv'; })) return 'leaveNow';
    var oooAsk = frames.some(function (fr) { return fr.ooo && fr.ooo.dflt && (fr.e != null || fr.s != null); });
    if (q && q.q === 'much' && oooAsk) return 'oooNeed';
    if (!q) {
      if (marks.earliest) return 'earliest';
      if (marks.remaining) return 'remaining';
      if (!frames.length) return null;
      var last = frames[frames.length - 1];
      if (frames.length === 1 && last.ooo && last.ooo.s != null) return 'leave';
      if (frames.length > 1 || frames.some(function (fr) { return fr.days.indexOf('EACH') >= 0; })) {
        if (last.e != null && last.s == null && last.len == null) return 'arrive';
        return 'leave';
      }
      if (last.e != null && last.s == null && last.len == null && verbs.some(function (v) { return v.v === 'lv' && v.tense === 'modal'; })) return 'arrive';
      return null;
    }
    if (q.q === 'when') {
      if (marks.earliest) return 'earliest';
      if (vNear && vNear.v === 'arr') return 'arrive';
      return 'leave';
    }
    if (q.q === 'much') {
      var modal = verbs.some(function (v) { return v.tense === 'modal'; }) || /LAZIM|GEREK/.test('');
      var hypo = verbs.some(function (v) { return v.tense === 'modal' || v.tense === 'hyp'; });
      if (past && it.some(function (x) { return x.t === 'MORE' && x.k === 'fazla'; })) return 'balance';
      if (((marks.done && !hypo) || (vNear && vNear.tense === 'past')) && !marks.remaining) return 'done';
      if (frames.some(function (fr) { return fr.ooo; }) && marks.olur) return 'target';
      if (marks.done && frames.some(function (fr) { return fr.len != null || fr.s != null || fr.e != null; })) return 'target';
      if (marks.remaining && !frames.some(function (fr) { return fr.e != null; })) return 'remaining';
      if (vNear && (vNear.v === 'stay' || vNear.v === 'lv') && (vNear.tense === 'modal' || modal) || marks.remaining) {
        var anyDay = q.frame && q.frame.days.length && !q.frame.type;
        if (anyDay || frames.some(function (fr) { return fr.e != null; })) return 'reqLen';
        return 'remaining';
      }
      if (vNear && vNear.v === 'stay' && q.frame && q.frame.days.length) return 'reqLen';
      if (frames.some(function (fr) { return fr.ooo; })) return 'target';
      if (marks.week || marks.olur) return frames.length ? 'target' : 'remaining';
      if (vNear && vNear.v === 'stay') return 'remaining';
      return frames.length ? 'reqLen' : 'remaining';
    }
    if (q.q === 'yn') {
      if (marks.earliest && !hasTime) return 'earliest';
      return 'check';
    }
    return null;
  }

  // ---------- solver ----------

  // ---------- follow-ups ----------
  // "ya 9'da gelirsem", "peki cuma izin alırsam", "what if I stay 10 hours": reuse the previous question and
  // replace only what the follow-up changes. A day-less change replaces the same slot where the previous question
  // had it (her gün 10 saat → ya 9 saat), otherwise it applies to the day the previous answer was about.
  var FOLLOW = /^(PEKI YA|PEKI|YA|AMA|O ZAMAN|BIR DE|PEKALA|WHAT IF|AND IF|HOW ABOUT|WHAT ABOUT|AND|OR|THEN)\b/;
  var SLOTS = ['s', 'e', 'len', 'delta', 'more', 'ooo', 'type', 'before'];
  function isFollowUp(next) { return !!next && (FOLLOW.test(next.norm || '') || !next.query.kind); }
  function followUp(prev, next, targetDay) {
    if (!prev || !prev.query || !prev.query.kind || !next || !isFollowUp(next)) return next;
    if (next.query.kind && !FOLLOW.test(next.norm || '')) return next;
    var frames = prev.frames.map(function (f) { var c = {}; Object.keys(f).forEach(function (k) { c[k] = Array.isArray(f[k]) ? f[k].slice() : f[k]; }); return c; });
    var map = {}, same = function (a, b) { return a.length === b.length && a.every(function (d, i) { return d === b[i]; }); };
    next.frames.forEach(function (nf, ni) {
      var slots = SLOTS.filter(function (k) { return nf[k] != null; }), host = null;
      if (!nf.days.length) {
        for (var i = frames.length - 1; i >= 0 && !host; i--) if (slots.some(function (k) { return frames[i][k] != null; })) host = frames[i];
        if (!host && targetDay != null) { host = frames.filter(function (f) { return same(f.days, [targetDay]); })[0]; if (!host) { host = { days: [targetDay] }; frames.push(host); } }
        if (!host) { host = { days: [] }; frames.push(host); }
      } else {
        host = frames.filter(function (f) { return same(f.days, nf.days); })[0];
        if (!host) { host = { days: nf.days.slice() }; frames.push(host); }
      }
      // a new arrival or leaving time replaces the previous time pair's conflicting half
      if (nf.s != null && host.len != null && host.e != null) delete host.e;
      if (nf.type && nf.type !== 'ofis') SLOTS.forEach(function (k) { if (k !== 'type') delete host[k]; });
      if (nf.type === 'ofis') delete host.type;
      slots.forEach(function (k) { if (!(k === 'type' && nf.type === 'ofis')) host[k] = nf[k]; });
      map[ni] = frames.indexOf(host);
    });
    var query = next.query.kind ? { kind: next.query.kind, frame: next.query.frame >= 0 ? map[next.query.frame] : -1 } : { kind: prev.query.kind, frame: prev.query.frame };
    return { frames: frames, query: query, each: frames.some(function (f) { return f.days.indexOf('EACH') >= 0; }), marks: prev.marks, norm: next.norm, follow: true };
  }

  function solve(C, data, now, cfgIn, store, sc) {
    var cfg = C.config(cfgIn), MIN = C.MIN, Dm = cfg.D;
    var v0 = C.week(data, now, cfgIn, store, 0), rows = v0.rows, tdow = C.dow(now);
    var lastWork = cfg.days.filter(function (d) { return d <= 4; }).slice(-1)[0]; if (lastWork == null) lastWork = 4;
    var chips = [], kind = sc.query.kind, frames = sc.frames;
    var res = function (d) { return d === 'T' ? tdow : d === 'T+1' ? tdow + 1 : d === 'T+2' ? tdow + 2 : d === 'T-1' ? tdow - 1 : d; };
    var named = {}; frames.forEach(function (f) { f.days.forEach(function (d) { if (d !== 'EACH') named[res(d)] = 1; }); });
    var qf = sc.query.frame >= 0 ? frames[sc.query.frame] : null;
    var minOf = function (t, r) { return Math.round((t - r.date) / MIN); };
    // target day
    var target = null;
    if (qf && qf.days.length && qf.days.indexOf('EACH') < 0) target = res(qf.days[qf.days.length - 1]);
    // "if I take Thursday off, when do I leave Friday": the question is about the day without leave.
    if (target != null && /^(leave|earliest)$/.test(kind) && qf && qf.type && qf.type !== 'ofis') {
      var alt = frames.filter(function (f) { return f !== qf && !f.type && f.days.length && f.days[0] !== 'EACH'; }).slice(-1)[0];
      if (alt) target = res(alt.days[alt.days.length - 1]);
    }
    if (target == null && (kind === 'arrive' || kind === 'check' || kind === 'oooNeed')) frames.forEach(function (f) { if ((f.e != null || f.s != null || f.len != null) && f.days.length && f.days[0] !== 'EACH' && target == null) target = res(f.days[0]); });
    if (target == null && kind === 'dayGoal') target = tdow;
    if (target == null && /^(leave|earliest|arrive|check)$/.test(kind)) {
      if (sc.each || (qf && qf.days.indexOf('EACH') >= 0)) target = lastWork;
      else if (frames.length && frames[frames.length - 1].days.length && frames[frames.length - 1].days[0] !== 'EACH' && kind !== 'check') target = res(frames[frames.length - 1].days[0]);
      else target = tdow;
      if (kind === 'leave' && target === tdow && rows[tdow] && (!rows[tdow].office || (!rows[tdow].inside && rows[tdow].last != null && !named[tdow]))) target = lastWork;
    }
    if (target != null && (target < 0 || target > 6)) return { kind: 'outOfWeek', chips: chips };
    var trow = target != null ? rows[target] : null;
    if (trow && !trow.workday) return { kind: 'weekend', day: target, chips: chips };
    if (trow && trow.past && /^(leave|earliest|arrive|dayGoal)$/.test(kind)) return { kind: 'pastDay', day: target, chips: chips };
    if (kind === 'invalidTime') return { kind: 'invalidTime', chips: [] };
    if (kind === 'dayGoal') {
      if (trow.credit) return { kind: 'credit', day: target, type: trow.type, chips: [], pv: v0, store: null };
      var goal = C.dayGoal(v0, target, qf && qf.len != null ? qf.len : (frames[0] && frames[0].len != null ? frames[0].len : null));
      if (goal.planned && goal.start != null) chips.push({ k: 'default', d: target, s: minOf(goal.start, trow) });
      return Object.assign({ kind: 'dayGoal', day: target, pv: v0, store: null, chips: chips }, goal);
    }
    // days covered by "her gün"
    var eachDays = rows.filter(function (r) { return !r.past && r.office && !named[r.dow] && r.dow !== target; }).map(function (r) { return r.dow; });
    var s2 = C.clone(store); ['types', 'plan', 'ooo'].forEach(function (k) { s2[k] = s2[k] || {}; });
    var autoOOO = {}, needOOO = [];
    function applyFrame(f) {
      var ds = []; f.days.forEach(function (d) { if (d === 'EACH') ds = ds.concat(eachDays); else ds.push(res(d)); });
      if (!f.days.length) ds = target != null ? [target] : (kind === 'check' || f.e != null || f.s != null || f.len != null ? [tdow] : []);
      ds.forEach(function (d) {
        var r = rows[d]; if (!r) { chips.push({ k: 'warn', w: 'outOfWeek' }); return; }
        if (r.past) { chips.push({ k: 'warn', w: 'past', d: d }); return; }
        if (!r.workday) { chips.push({ k: 'warn', w: 'weekend', d: d }); return; }
        var key = r.key;
        if (f.type && f.type !== 'ofis') { s2.types[key] = f.type; delete s2.plan[key]; delete s2.ooo[key]; chips.push({ k: 'given', d: d, type: f.type }); return; }
        if (f.type === 'ofis' || (r.credit && (f.s != null || f.e != null || f.len != null))) { if (r.hol) s2.types[key] = 'ofis'; else delete s2.types[key]; }
        var p = {}, arrived = r.first != null;
        if (f.s != null) { if (arrived) chips.push({ k: 'warn', w: 'arrived', d: d, t: minOf(r.first, r) }); else p.s = f.s; }
        if (f.e != null) p.e = f.e;
        if (f.len != null) {
          var L = f.delta === 'fazla' ? Dm + f.len : f.len;
          if (f.delta === 'daha' && r.today) p.e = Math.ceil(minOf(now, r)) + f.len;
          else if (p.e != null && p.s == null && !arrived) p.s = p.e - L;
          else if (p.e == null) p.m = L;
          chips.push({ k: 'given', d: d, m: f.delta === 'daha' && r.today ? null : L, e: f.delta === 'daha' && r.today ? p.e : null });
        }
        if (f.s != null && !arrived) chips.push({ k: 'given', d: d, s: f.s });
        if (f.e != null) chips.push({ k: 'given', d: d, e: f.e, before: f.before });
        if (p.s != null || p.e != null || p.m != null) s2.plan[key] = p;
        if (f.ooo && !f.ooo.dflt) { s2.ooo[key] = { m: f.ooo.m, s: f.ooo.s }; chips.push({ k: 'given', d: d, ooo: f.ooo.m }); }
        else coreAuto(r, p);
      });
    }
    // Leaving before / arriving after the core window needs OOO for the gap; that raises the weekly target.
    function coreAuto(r, p) {
      if (cfg.coreE <= cfg.coreS) return;
      var ce = r.half ? Math.min(cfg.coreE, 780) : cfg.coreE, st = p.s != null ? p.s : (r.first != null ? minOf(r.first, r) : null), m = 0, s = null;
      if (p.e != null && p.e < ce) { m += ce - Math.max(p.e, cfg.coreS); s = Math.max(p.e, cfg.coreS); }
      if (st != null && st > cfg.coreS + 1 && r.first == null) { m += Math.min(st, ce) - cfg.coreS; s = s == null ? cfg.coreS : null; }
      if (m <= 0) return;
      // OOO already on that day: an interval that covers the gap needs nothing; otherwise the new one replaces it (net change only)
      var ex = s2.ooo[r.key], from = s != null ? s : cfg.coreS;
      if (ex && ex.s != null && ex.s <= from && ex.s + ex.m >= from + m) return;
      var prev = ex ? ex.m : 0;
      // Never take OOO on the user's behalf: ask first (sc.oooOK), except when the question is about OOO itself.
      if (!sc.oooOK && kind !== 'oooNeed') { needOOO.push({ d: r.dow, m: m, prev: prev, s: s, e: p.e, st: st }); return; }
      s2.ooo[r.key] = { m: m, s: s }; autoOOO[r.dow] = m; chips.push({ k: 'auto', d: r.dow, ooo: m, ok: !!sc.oooOK });
    }
    frames.forEach(applyFrame);
    if (needOOO.length) {
      var sum = needOOO.reduce(function (a, n) { return a + Math.max(0, n.m - n.prev); }, 0);   // net: accepting replaces that day's OOO
      return { kind: 'confirmOOO', day: needOOO[0].d, need: needOOO, chips: chips, W0: v0.W, W1: v0.W + sum * MIN, m: sum, ask: kind,
        coreS: cfg.coreS, coreE: cfg.coreE };
    }
    var applyStore = C.clone(s2);
    var defaults = function (skip) {
      rows.forEach(function (r) {
        if (r.past || !r.office || skip[r.dow]) return;
        var pl = s2.plan[r.key]; if (pl && (pl.e != null || pl.m != null)) return;
        if (s2.types[r.key] && s2.types[r.key] !== 'ofis') return;
        s2.plan[r.key] = Object.assign({}, pl || {}, { m: Dm - r.half }); chips.push({ k: 'default', d: r.dow, m: Dm - r.half });
      });
    };
    var week = function (st, absorb) { return C.week(data, now, cfgIn, st, 0, absorb ? { absorb: absorb } : {}); };
    var out = { kind: kind, day: target, chips: chips, auto: autoOOO, W0: v0.W, before: frames.some(function (f) { return f.before; }) };

    if (kind === 'leave' || kind === 'earliest') {
      if (trow.credit && !named[target]) { out.kind = 'credit'; out.type = trow.type; return out; }
      if (trow.today && !trow.inside && trow.last != null && !(s2.plan[trow.key])) { out.kind = 'left'; out.t = trow.last; return out; }
      if (s2.types[trow.key] && s2.types[trow.key] !== 'ofis') { out.kind = 'credit'; out.type = s2.types[trow.key]; out.pv = week(s2); return out; }
      // "bugün 9.30 saat çalışırsam kaçta çıkarım": a length named for this very day is kept; otherwise the day absorbs the week
      var ownLen = frames.some(function (f) { return f.len != null && f.days.indexOf('EACH') < 0 && f.days.some(function (d) { return res(d) === target; }); });
      var pl = s2.plan[trow.key]; if (pl && !ownLen) { delete pl.e; delete pl.m; }
      if (pl && pl.s == null && trow.first == null) chips.push({ k: 'default', d: target, s: cfg.start });
      else if (!pl && trow.first == null) chips.push({ k: 'default', d: target, s: cfg.start });
      var pv = ownLen ? week(s2) : week(s2, trow.key), tr = pv.rows[target];
      Object.assign(out, { pv: pv, start: tr.start, end: tr.end, plan: tr.plan, held: !!tr.held, need: tr.need, W: pv.W, late: tr.late || tr.plan > 16 * 60 * MIN, ooo: pv.W - cfg.W * MIN });
      out.store = applyStore;
      return out;
    }
    if (kind === 'arrive') {
      if (trow.first != null) { out.kind = 'arrived'; out.t = trow.first; kind = 'check'; }
      else {
        var fe = null; frames.forEach(function (f) { f.days.forEach(function (d) { if (res(d) === target && f.e != null) fe = f.e; }); if (!f.days.length && f.e != null) fe = f.e; });
        if (fe == null) { out.kind = 'needLeave'; return out; }
        var keep = s2.plan[trow.key]; s2.plan[trow.key] = {};
        var pv2 = week(s2, trow.key), need = Math.max(0, Math.ceil(pv2.rows[target].need / MIN - 1e-9));
        var arr = fe - need, latest = cfg.coreE > cfg.coreS && !s2.ooo[trow.key] ? cfg.coreS : null;
        if (s2.ooo[trow.key] && s2.ooo[trow.key].s != null && s2.ooo[trow.key].s <= cfg.coreS) latest = null;
        out.s = arr; out.e = fe; out.need = need; out.W = pv2.W; out.ooo = pv2.W - cfg.W * MIN;
        if (latest != null && arr > latest) { out.capped = true; out.latest = latest; out.extra = (arr - latest); out.s = latest; }
        out.early = out.s < 360;
        s2.plan[trow.key] = Object.assign({}, keep || {}, { s: out.s, e: fe });
        out.pv = week(s2); applyStore.plan[trow.key] = { s: out.s, e: fe };
        out.store = applyStore;
        return out;
      }
    }
    if (kind === 'check' || kind === 'oooNeed') {
      var skip = {}; defaults(skip);
      var pv3 = week(s2);
      var d3 = target != null ? target : tdow, r3 = pv3.rows[d3];
      Object.assign(out, { kind: out.kind === 'arrived' ? 'arrivedCheck' : kind, day: d3, pv: pv3, margin: pv3.total - pv3.W, ok: pv3.total >= pv3.W - MIN,
        end: r3 && r3.end, start: r3 && r3.start, W: pv3.W, ooo: pv3.W - cfg.W * MIN, oooDay: autoOOO[d3] || 0, held: r3 && r3.held, store: applyStore });
      return out;
    }
    if (kind === 'reqLen' || kind === 'avg') {
      var F = [];
      if (kind === 'reqLen' && qf && qf.days.length && qf.days.indexOf('EACH') < 0) qf.days.forEach(function (d) { F.push(res(d)); });
      else if (kind === 'reqLen' && qf && qf.days.indexOf('EACH') >= 0) F = eachDays.slice();
      else {
        var fixedDays = {}; frames.forEach(function (f) { if (f.e != null || f.s != null || f.len != null || f.type) f.days.forEach(function (d) { if (d !== 'EACH') fixedDays[res(d)] = 1; }); });
        F = rows.filter(function (r) { return !r.past && r.office && !fixedDays[r.dow] && (r.dow !== target || kind === 'avg'); }).map(function (r) { return r.dow; });
      }
      F = F.filter(function (d) { var r = rows[d]; return r && !r.past && r.office && !(s2.types[r.key] && s2.types[r.key] !== 'ofis'); });
      if (!F.length) { out.kind = 'noDays'; return out; }
      if (target != null && kind === 'reqLen') { var tp = s2.plan[rows[target].key]; if (tp && tp.e != null && tp.s == null && rows[target].first == null) { tp.s = cfg.start; chips.push({ k: 'default', d: target, s: cfg.start }); } }
      var skipF = {}; F.forEach(function (d) { skipF[d] = 1; }); defaults(skipF);
      var test = function (m) { F.forEach(function (d) { var r = rows[d]; s2.plan[r.key] = { m: m }; }); return week(s2); };
      var lo = 0, hi = 20 * 60, pvX = test(hi);
      if (pvX.total < pvX.W - MIN) { out.kind = 'impossible'; out.m = hi; return out; }
      if (test(0).total >= test(0).W - MIN) { out.kind = kind === 'avg' ? 'avgDone0' : 'reqZero'; out.days = F; out.pv = test(0); out.held = true; return out; }
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; var w2 = test(mid); if (w2.total >= w2.W - 1) hi = mid; else lo = mid; }   // the recommended plan must reach the target, not a minute short
      var pv4 = test(hi);
      Object.assign(out, { m: hi, days: F, pv: pv4, W: pv4.W, ooo: pv4.W - cfg.W * MIN, ends: F.map(function (d) { var r = pv4.rows[d]; return { d: d, end: r.end, held: r.held }; }) });
      F.forEach(function (d) { applyStore.plan[rows[d].key] = { m: hi }; });
      out.store = applyStore; out.impossible = hi > 16 * 60;
      return out;
    }
    if (kind === 'done') {
      var ds = [], hasDays = frames.some(function (f) { return f.days.length; });
      frames.forEach(function (f) { f.days.forEach(function (d) { if (d !== 'EACH') ds.push(res(d)); }); });
      var scope = rows.filter(function (r) { return hasDays ? ds.indexOf(r.dow) >= 0 : (r.past || r.today); });
      out.m = scope.reduce(function (s, r) { return s + r.count; }, 0); out.days = scope.map(function (r) { return { d: r.dow, m: r.count, live: r.today && r.inside, type: r.credit ? r.type : null }; });
      out.W = v0.W; out.scope = hasDays ? 'days' : 'week'; out.liveToday = rows[tdow] && rows[tdow].inside;
      return out;
    }
    if (kind === 'avgDone') {
      var past = rows.filter(function (r) { return (r.past || (r.today && !r.inside && r.last != null)) && r.workday; });
      out.m = past.length ? past.reduce(function (s, r) { return s + r.count; }, 0) / past.length : 0; out.n = past.length; return out;
    }
    if (kind === 'balance') {
      var td = v0.today;
      out.bal = v0.balance; out.todayM = td && td.office ? td.actual : null; out.todayIn = td && td.inside; out.D = Dm * MIN; out.bank = v0.bank;
      return out;
    }
    if (kind === 'dayLen') {
      if (out.day == null) out.day = tdow;   // no day named: today
      var pv6 = week(s2), r6 = pv6.rows[out.day];
      if (!r6) return out;
      Object.assign(out, { pv: pv6, len: r6.val, end: r6.end, W: pv6.W, store: applyStore });
      return out;
    }
    if (kind === 'remaining' || kind === 'target') {
      var pv5 = week(s2), credits = 0;
      pv5.rows.forEach(function (r) { if (!r.past && !r.today && r.credit) credits += r.credit; });
      Object.assign(out, { pv: pv5, W: pv5.W, done: pv5.done, m: Math.max(0, pv5.W - pv5.done - credits), credits: credits, ooo: pv5.W - cfg.W * MIN, store: frames.length ? applyStore : null });
      return out;
    }
    return out;
  }
  return { parse: parse, solve: solve, norm: norm, lex: lex, followUp: followUp, isFollowUp: isFollowUp };
})();
if (typeof module !== 'undefined') module.exports = MesaiScen;
