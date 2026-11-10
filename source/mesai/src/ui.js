// Mesai widget: one instance per tab; a second bookmark click reopens/refreshes it.
(function () {
  var BUILD = typeof MesaiBuild !== 'undefined' ? MesaiBuild : { version: '3.4.1', theme: 'all' };
  if (window.__mesai) { if (window.__mesai.version === BUILD.version && (window.__mesai.variant || 'all') === BUILD.theme) { window.__mesai.poke(); return; } window.__mesai.close(); }
  var C = MesaiCore, A = MesaiAdapter(C, document), Q = MesaiAsk, SC = MesaiScen, HOL = MesaiHolidays, TH = MesaiThemes, TX = MesaiText;
  var MIN = C.MIN, DAY = C.DAY, H = 60 * MIN, VERSION = BUILD.version;
  var KEY = 'mesai.v3';

  // ---------------- persistence (local to this browser and portal) ----------------
  var S = (function () {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) { o = null; }
    if (!o) { try { var old = JSON.parse(localStorage.getItem('mesai.v1')); if (old) o = { ppl: old.ppl || {}, ui: { lang: (old.ui || {}).lang } }; } catch (e) { /* none */ } }
    return o || {};
  })();
  S.cfg = Object.assign({ W: 45, D: 9, start: '09:00', coreS: '10:00', coreE: '16:00', cap: 0, days: [0, 1, 2, 3, 4], hol: true }, S.cfg || {});
  S.ui = Object.assign({ lang: 'tr', theme: 'saydam', look: 'auto', col: false, bell: false, planOpen: true, cmp: false, w: null, h: null }, S.ui || {});
  // Minimize always means the Cep (pocket) view now; old collapsed-pill states migrate to it in every theme.
  if(S.ui.col){S.ui.col=false;S.ui.cmp=false;S.ui.w=220;S.ui.h=null;}
  // 3.3: three sizes only (Cep 220 · Kompakt 340 · Geniş). Free widths in between broke every theme's layout.
  if (S.ui.w && S.ui.w >= 300) { if (S.ui.w < 760) S.ui.cmp = true; S.ui.w = null; } S.ui.h = null; S.ui.pre = null;
  if (!S.ui.lang) S.ui.lang = 'tr';
  if (S.ui.theme === 'sutunsor') { S.ui.theme = 'sutunlar'; S.ui.ask = true; }   // "Sütunlar + Sor" became Sütunlar with the question panel on
  if (S.ui.theme === 'sor') { S.ui.theme = 'cizelge'; S.ui.ask = true; }          // 3.3: "Soru odaklı" removed; the Sor button covers it
  if (S.ui.theme === 'bilet') S.ui.theme = 'cizelge';
  if (BUILD.theme !== 'all') S.ui.theme = BUILD.theme;
  if (TH.ORDER.indexOf(S.ui.theme) < 0) S.ui.theme = TH.ORDER[0];   // draft or unknown theme                              // 3.3: "Bilet" removed
  S.ppl = S.ppl || {};
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
  var nowFn = function () { return window.__MESAI_NOW ? window.__MESAI_NOW() : C.istanbulNow(); };
  var L = function () { return TX[S.ui.lang === 'en' ? 'en' : 'tr']; };

  var st = { code: 'loading', count: 0, person: S.lastPerson || null, name: '', off: 0, sel: null, view: 'week', job: null, tried: {},
    sig: '', readAt: 0, period: null, paged: false, ask: null, askText: '', rev: null, set: false, undo: null, toast: null, placed: false };
  var P = function () {
    var id = st.person; if (!id) return null;
    var p = S.ppl[id] = S.ppl[id] || {};
    ['months', 'days', 'events', 'types', 'plan', 'ovr', 'ooo', 'pick'].forEach(function (k) { p[k] = p[k] || {}; });
    return p;
  };
  var storeOf = function (p) { return { types: p.types, plan: p.plan, ovr: p.ovr, ooo: p.ooo, pick: p.pick || {}, hol: S.cfg.hol === false ? {} : HOL.LIST }; };
  var holName = function (h) { return h ? (S.ui.lang === 'en' ? h.en : h.n) : ''; };
  var SG = function () { var t = L(); return t.sugg.concat(t.sugg2 || []); };
  var dataOf = function (p) { return { days: p.days, events: p.events, months: p.months }; };

  function merge(snap, now) {
    st.person = snap.person; S.lastPerson = snap.person; st.name = snap.name; st.period = snap.period; st.paged = snap.paged;
    var p = P(), mk = snap.period;
    [p.days, p.events].forEach(function (o) { Object.keys(o).forEach(function (k) { if (k.slice(0, 7) === mk) delete o[k]; }); });
    Object.keys(snap.days).forEach(function (k) { p.days[k] = snap.days[k]; });
    Object.keys(snap.events).forEach(function (k) { p.events[k] = snap.events[k]; });
    p.months[mk] = now;
    var cut = C.dkey(now - 400 * DAY);
    ['days', 'events', 'types', 'plan', 'ovr', 'ooo', 'pick'].forEach(function (k) { Object.keys(p[k] || {}).forEach(function (d) { if (d < cut) delete p[k][d]; }); });
    var today = C.dkey(now); Object.keys(p.plan).forEach(function (d) { if (d < today) delete p.plan[d]; });
    save();
  }

  // ---------------- formatting ----------------
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  // Turkish case suffix after a clock time follows how the time is read aloud: 08:30’da (otuz), 08:25’te (yirmi beş),
  // 16:00’dan (on altı), 16:00’ya kadar. {t|de} {t|den} {t|deki} {t|e} in the Turkish strings.
  var trSfx = function (val, kind) {
    var m = String(val).match(/(\d{1,2}):(\d{2})(?!.*\d{1,2}:\d{2})/), n = m ? (+m[2] || +m[1]) : null;
    var loc = { 0: 'da', 1: 'de', 2: 'de', 3: 'te', 4: 'te', 5: 'te', 6: 'da', 7: 'de', 8: 'de', 9: 'da', 10: 'da', 20: 'de', 30: 'da', 40: 'ta', 50: 'de' };
    var dat = { 0: 'a', 1: 'e', 2: 'ye', 3: 'e', 4: 'e', 5: 'e', 6: 'ya', 7: 'ye', 8: 'e', 9: 'a', 10: 'a', 20: 'ye', 30: 'a', 40: 'a', 50: 'ye' };
    var key = n == null ? null : (n % 10 ? n % 10 : n % 100);
    if (kind === 'e') return '’' + (key == null ? 'e' : dat[key]);
    var b = key == null ? 'de' : loc[key];
    return '’' + (kind === 'den' ? b + 'n' : kind === 'deki' ? b + 'ki' : b);
  };
  var fill = function (s, o) { return String(s).replace(/\{(\w+)(?:\|(\w+))?\}/g, function (_, k, sx) { return o[k] != null ? o[k] + (sx ? trSfx(o[k], sx) : '') : ''; }); };
  var hrs = function (ms) { var h = Math.round(ms / H * 10) / 10; return String(h).replace('.', S.ui.lang === 'en' ? '.' : ','); };
  var dur = function (ms, up) { var m = Math.max(0, ms) / MIN; m = up ? Math.ceil(m - 1e-9) : Math.floor(m + 1e-9); var t = L(); return Math.floor(m / 60) + ' ' + t.h + ' ' + C.pad(m % 60) + ' ' + t.m; };
  var hm = function (ms, up) { return C.hm(ms, false, up); };
  var clk = function (t, base) { return C.clock(t, base); };
  var rec = function (t) { if (t == null) return '—'; var d = new Date(Math.floor(t / MIN) * MIN); return C.pad(d.getUTCHours()) + ':' + C.pad(d.getUTCMinutes()); };
  var dl = function (ms) { var d = new Date(ms); return d.getUTCDate() + ' ' + L().mon[d.getUTCMonth()]; };
  var minOf = function (t, date) { return Math.round((t - date) / MIN); };
  var parseTime = function (s) { s = String(s || '').trim().replace(/[.,]/, ':'); if (/^\d{3,4}$/.test(s)) s = s.slice(0, -2) + ':' + s.slice(-2); if (/^\d{1,2}$/.test(s)) s += ':00'; return C.parseClock(s); };
  var parseLen = function (s) { s = String(s || '').trim().replace(',', '.'); var a = s.match(/^(\d{1,2}):([0-5]\d)$/); if (a) return +a[1] * 60 + +a[2]; var b = s.match(/^\d{1,2}(\.\d+)?$/); return b ? Math.round(parseFloat(s) * 60) : null; };
  var mm = function (m) { return C.pad(Math.floor(m / 60) % 24) + ':' + C.pad(m % 60); };

  // ---------------- icons ----------------
  var I = {
    l: '<path d="M10 3.5 5.5 8l4.5 4.5"/>', r: '<path d="M6 3.5 10.5 8 6 12.5"/>', x: '<path d="M4 4l8 8M12 4l-8 8"/>', min: '<path d="M3.5 8h9"/>',
    moon: '<path d="M13.5 9.8A5.5 5.5 0 0 1 6.2 2.5a5.5 5.5 0 1 0 7.3 7.3Z"/>', sun: '<circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>',
    set: '<path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7"/><circle cx="11" cy="4.5" r="1.6"/><circle cx="5" cy="11.5" r="1.6"/>',
    bell: '<path d="M4 11V7a4 4 0 0 1 8 0v4l1.2 1.5H2.8L4 11Z"/><path d="M6.6 14a1.5 1.5 0 0 0 2.8 0"/>',
    clock: '<circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.4"/>', search: '<circle cx="7" cy="7" r="4.6"/><path d="m10.5 10.5 3 3"/>',
    undo: '<path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.8"/><path d="M2.6 2.6v3h3"/>', rev: '<path d="M3 5h9l-2.5-2.5M13 11H4l2.5 2.5"/>',
    chev: '<path d="M3.5 6 8 10.5 12.5 6"/>', check: '<path d="m3.5 8.5 3 3 6-7"/>', dl: '<path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/>', ul: '<path d="M8 10.5v-8M4.5 6 8 2.5 11.5 6M3 13.5h10"/>',
    hist: '<path d="M2.5 8a5.5 5.5 0 1 0 1.7-4"/><path d="M2.3 2.6v2.9h2.9M8 5v3.2l2 1.3"/>',
    cmp: '<path d="M9.5 2.5v4h4M6.5 13.5v-4h-4M9.5 6.5l4-4M6.5 9.5l-4 4"/>', exp: '<path d="M10 2.5h3.5V6M6 13.5H2.5V10M13.5 2.5 9 7M2.5 13.5 7 9"/>',
    cal: '<rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/>'
  };
  var ic = function (n, s) { return '<svg viewBox="0 0 16 16" width="' + (s || 15) + '" height="' + (s || 15) + '" aria-hidden="true">' + I[n] + '</svg>'; };

  // ---------------- styles ----------------
  var CSS = ':host{all:initial}*{box-sizing:border-box;margin:0;padding:0}' +
    '.w{position:fixed;z-index:2147483600;font:13px/1.4 var(--font);color:var(--ink);background:var(--card);border:1px solid var(--frame);border-radius:var(--r);box-shadow:var(--shadow);font-variant-numeric:tabular-nums;overflow:hidden;-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}' +
    'button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;transition:background .15s,box-shadow .15s,transform .08s,filter .15s,color .15s}button:active{transform:translateY(1px)}' +
    'button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--acc);outline-offset:2px}' +
    'svg{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;display:block}' +
    'input,select{font:inherit;color:var(--ink);user-select:text;-webkit-user-select:text}' +
    '.ib{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:var(--mut)}.ib:hover{background:rgba(127,127,127,.13);color:var(--ink)}.ib.on{color:var(--acc)}' +
    '.hd{display:flex;align-items:center;gap:7px;height:54px;padding:0 10px 0 16px;border-bottom:1px solid var(--line);background:var(--head);color:var(--headInk);cursor:grab}.hd:active{cursor:grabbing}' +
    '.hd .ib{color:inherit;opacity:.72}.hd .ib:hover{opacity:1}.hd .ib.on{opacity:1;color:var(--acc)}' +
    '.brand{display:flex;align-items:center;gap:8px;font-weight:750;font-size:15px;letter-spacing:-.01em;white-space:nowrap}.who{font-size:13px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}' +
    '.dot{width:9px;height:9px;border-radius:50%;background:var(--faint);flex:none}.dot.on{background:var(--acc);animation:pu 2.2s infinite}' +
    '@keyframes pu{0%{box-shadow:0 0 0 0 var(--accSoft2)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}' +
    '.sp{flex:1}.vr{width:1px;height:20px;background:var(--line);margin:0 4px;flex:none}.hd .vr{background:rgba(127,127,127,.35)}' +
    '.seg{display:flex;padding:2px;border-radius:9px;background:var(--sunk)}.seg button{padding:4px 9px;border-radius:7px;font-size:12px;font-weight:650;color:var(--mut)}.seg button.on{background:var(--card);color:var(--ink);box-shadow:var(--lift)}' +
    '.hd .seg{background:rgba(127,127,127,.16)}.hd .seg button{color:inherit;opacity:.7}.hd .seg button.on{opacity:1;color:var(--ink)}' +
    '.sws{display:flex;gap:6px;padding:6px 9px;border-radius:99px;background:rgba(127,127,127,.14)}.sw{width:13px;height:13px;border-radius:50%;padding:0;border:1px solid rgba(127,127,127,.4)}.sw.on{box-shadow:0 0 0 2px var(--card),0 0 0 3.5px currentColor}' +
    '.wk{font-size:13px;font-weight:650;min-width:92px;text-align:center;white-space:nowrap}' +
    '.askb{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:9px;background:var(--accSoft);color:var(--accInk);font-weight:750;font-size:13px}.askb:hover{filter:brightness(.96)}.askb.on{background:var(--acc);color:var(--card)}.narrow .askb span{display:none}' +
    '.k{font-size:12px;color:var(--mut);font-weight:500}.big{font-family:var(--num);font-weight:800;letter-spacing:-.045em;line-height:1.02}' +
    '.pill{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:99px;background:var(--accSoft);color:var(--accInk);font-size:12px;font-weight:650;white-space:nowrap}.pill svg{width:12px;height:12px}' +
    '.pill.gold{background:var(--goldSoft);color:var(--goldInk)}.pill.ok{background:var(--okSoft);color:var(--ok)}.pill.bad{background:var(--badSoft);color:var(--bad)}.pill.gray{background:var(--sunk);color:var(--mut)}' +
    'button.pill:hover{filter:brightness(.96)}' +
    '.bar{position:relative;height:8px;border-radius:4px;background:var(--sunk);overflow:hidden}.bar i{position:absolute;top:0;bottom:0;left:0;border-radius:4px}' +
    '.strip{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:10px 12px 10px 16px;border-top:1px solid var(--line);background:var(--side);font-size:12.5px;color:var(--mut)}.strip b{color:var(--ink)}' +
    '.btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border:1px solid var(--frame);border-radius:9px;background:var(--input);font-weight:650;color:var(--ink);white-space:nowrap}.btn:hover{border-color:var(--mut)}' +
    '.btn.pri{background:var(--acc);border-color:var(--acc);color:var(--card)}.btn.pri:hover{filter:brightness(1.08)}' +
    '.wchip{padding:3px 9px;border-radius:99px;background:var(--sunk);font-weight:700;font-size:12px;color:var(--ink)}.wchip:hover{filter:brightness(.95)}' +
    '.ed{padding:12px 14px 12px 16px;border-top:1px solid var(--line);animation:fd .18s ease}@keyframes fd{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}' +
    '.edh{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.edh b{font-size:14px}.tag{font-size:11px;font-weight:650;padding:2px 8px;border-radius:99px;background:var(--sunk);color:var(--mut);white-space:nowrap}' +
    '.edf{display:flex;align-items:flex-end;flex-wrap:wrap;gap:8px;margin-top:11px}.fl{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:500;color:var(--mut)}' +
    '.ahint{font-weight:500;font-size:10.5px;color:var(--faint);margin-left:4px;white-space:nowrap}.fi{width:82px;height:38px;text-align:center;font-family:var(--num);font-size:17px;font-weight:700;border:1px solid var(--frame);border-radius:9px;background:var(--input)}.fi:disabled{background:var(--sunk);color:var(--mut)}.fi.er{border-color:var(--bad);box-shadow:0 0 0 3px var(--badSoft)}' +
    '.fi.hot{border:1.5px solid var(--acc);box-shadow:0 0 0 3px var(--accSoft)}.fi.sm{width:66px;height:30px;font-size:13px}' +
    '.op{color:var(--faint);padding-bottom:10px}.stp{height:38px;padding:0 9px;border:1px solid var(--frame);border-radius:9px;font-size:12px;font-weight:700;color:var(--mut);background:var(--input)}.stp:hover{color:var(--ink);border-color:var(--mut)}' +
    '.oo{display:flex;align-items:center;height:38px;border:1px solid var(--frame);border-radius:9px;overflow:hidden;background:var(--input)}.oo button{width:30px;height:38px;font-size:16px;color:var(--mut)}.oo button:hover{background:var(--sunk);color:var(--ink)}.oo b{width:46px;text-align:center;font-family:var(--num);font-size:14px}' +
    '.note{font-size:11.5px;color:var(--mut);margin-top:8px;min-height:16px}.note.warn{color:var(--goldInk)}.note.bad{color:var(--bad)}' +
    '.tl{padding:10px 14px 4px 10px;min-width:0}.lg{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:0 6px 6px;font-size:11.5px;color:var(--mut)}.lg i{display:inline-block;width:10px;height:8px;border-radius:2px;margin-right:5px;vertical-align:0}' +
    '.ax,.tr{display:grid;grid-template-columns:72px minmax(0,1fr) 74px;gap:8px;align-items:center}.ax{height:18px;font-size:10.5px;color:var(--faint)}.axr{position:relative;height:100%}.axr span{position:absolute;transform:translateX(-50%)}' +
    '.tr{height:44px;width:100%;border-radius:10px;text-align:left}.tr:hover{background:rgba(127,127,127,.06)}.tr.td{background:var(--sunk)}.tr.sel{background:var(--card);box-shadow:inset 0 0 0 1.5px var(--acc),0 2px 8px rgba(0,0,0,.06)}' +
    '.dn{padding-left:9px;display:flex;flex-direction:column;line-height:1.15;min-width:0}.dn b{font-size:13.5px}.dn b span{font-weight:500;color:var(--faint)}.dn small{font-size:10.5px;font-weight:650;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.trk{position:relative;display:block;height:100%}.trk i{position:absolute}.cb{top:5px;bottom:5px;background:var(--core);border-radius:5px}.gl{top:6px;bottom:6px;width:1px;background:var(--grid)}' +
    '.sg{top:15px;height:14px;border-radius:5px;background:var(--acc)}.sp2{top:15px;height:14px;border-radius:5px;background:var(--accSoft2);opacity:.45}' +
    '.gh{top:15px;height:14px;border-radius:5px;border:1.5px dashed var(--mut);opacity:.8}.gh.au{border-color:var(--gold);background:var(--goldSoft);opacity:1}.gh.pl{border-style:solid}' +
    '.cr{top:15px;height:14px;border-radius:5px;background:repeating-linear-gradient(135deg,var(--ok) 0 4px,var(--okSoft) 4px 8px);opacity:.75}' +
    '.oz{top:15px;height:14px;border-radius:4px;background:repeating-linear-gradient(135deg,var(--gold) 0 3px,transparent 3px 6px)}' +
    '.nl{top:5px;bottom:5px;width:2px;margin-left:-1px;background:var(--ink);border-radius:1px}.lv{top:16px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:var(--acc);border:2px solid var(--card);animation:pu 2.2s infinite}' +
    '.el{position:absolute;top:14px;padding-left:7px;font-size:11px;font-weight:700;color:var(--mut);white-space:nowrap}.el.au{color:var(--goldInk)}.el.lft{transform:translateX(-100%);padding:0 7px 0 0}' +
    '.vv{text-align:right;padding-right:10px;font-size:14px;font-weight:750;font-family:var(--num);white-space:nowrap}.vv small{font-size:10.5px;font-weight:650;opacity:.75}' +
    '.L-cizelge .body{display:grid;grid-template-columns:258px minmax(0,1fr)}.side{padding:18px 18px 16px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:13px;background:var(--side)}' +
    '.side .sec{border-top:1px solid var(--line);padding-top:12px}' +
    '.cols{padding:14px 18px 12px 20px;min-width:0}.cg{position:relative;margin-top:12px}.cgr{position:absolute;inset:0 34px 0 0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;align-items:end}' +
    '.cl{position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end;border-radius:14px;cursor:pointer;outline-offset:3px}' +
    '.cs{position:relative;display:block;border-radius:12px;overflow:hidden;transition:height .35s ease,box-shadow .2s}.cl:hover .cs{filter:brightness(1.04)}.cl.sel .cs{box-shadow:0 0 0 3px var(--accSoft2)}' +
    '.cs.xgh{border:2px dashed var(--faint)}.cs.xau{border:2px dashed var(--gold);background:var(--goldSoft)}.cs.xcr{background:repeating-linear-gradient(135deg,var(--ok) 0 5px,var(--okSoft) 5px 10px);opacity:.8}.cs.xpl{border:2px solid var(--acc)}.cs.xlvd{background:repeating-linear-gradient(135deg,var(--accSoft) 0 5px,transparent 5px 10px);border:1.5px dashed var(--accSoft2)}' +
    '.cs i{position:absolute;left:0;right:0}.cf{bottom:0;background:var(--bar)}.cgd{background:linear-gradient(180deg,#ffcf6b,#eaa524)}' +
    '.tline{position:absolute;left:0;border-top:1.5px dashed var(--faint)}.tlab{position:absolute;right:0;font-size:11px;font-weight:800;color:var(--mut)}' +
    '.clab{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;margin:10px 34px 0 0;text-align:center}.clab b{display:block;font-size:13px}.io{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:6px}' +
    '.io span{padding:4px 0;border-radius:7px;background:var(--input);border:1px solid var(--frame);font-size:11.5px;font-weight:700;font-family:var(--num)}.io span.fx{background:var(--sunk);border-color:transparent;color:var(--mut)}.io span.au{background:var(--goldSoft);border-color:var(--gold);color:var(--goldInk)}.io span.cr{background:var(--okSoft);border-color:transparent;color:var(--ok)}.io span.ch{background:var(--accSoft);border-color:var(--acc);color:var(--accInk)}' +
    '.L-sutunlar .body{display:grid;grid-template-columns:minmax(0,1fr) 288px}.rp{border-left:1px solid var(--line);padding:16px 18px;display:flex;flex-direction:column;gap:11px;background:var(--side)}' +
    '.card2{border-radius:14px;padding:10px 12px}.coin{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:12px;color:#4a3100;background:linear-gradient(110deg,#f2b43c 30%,#ffe3a1 50%,#f2b43c 70%);background-size:200% 100%;animation:sh 3.5s linear infinite;flex:none}@keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
    '.askr{padding:12px 16px}.askf{display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;border-radius:12px;border:1.5px solid var(--acc);box-shadow:0 0 0 4px var(--accSoft);background:var(--input)}.askf svg{color:var(--acc)}' +
    '.askf input{flex:1;border:0;background:transparent;font-size:15px;font-weight:600;outline:none;min-width:0}.kbd{font-size:11px;color:var(--mut);border:1px solid var(--frame);border-radius:6px;padding:1px 6px;white-space:nowrap}' +
    '.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.chips button{padding:5px 11px;border-radius:99px;font-size:12.5px;font-weight:650;background:var(--sunk)}.chips button:hover{filter:brightness(.95)}.chips button.on{background:var(--acc);color:var(--card)}' +
    '.ans{padding:20px 24px;display:flex;flex-direction:column;animation:fd .22s ease;min-width:0}.ans .kk{font-size:11.5px;font-weight:750;color:var(--mut);text-transform:uppercase;letter-spacing:.07em}.ans .bb{font-size:46px;font-weight:800;letter-spacing:-.045em;line-height:1.03;margin-top:6px;font-family:var(--num)}' +
    '.ans .dd{font-size:14px;color:var(--body);margin-top:10px;line-height:1.5;max-width:460px}.tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.acts{display:flex;gap:8px;margin-top:16px}' +
    '.sugs{padding:10px;background:var(--side);border-left:1px solid var(--line)}.sugs .tt{font-size:11px;color:var(--faint);font-weight:700;padding:8px 10px;text-transform:uppercase;letter-spacing:.08em}' +
    '.sug{display:flex;width:100%;align-items:center;gap:10px;padding:9px 10px;border-radius:11px;text-align:left}.sug:hover{background:var(--accSoft)}.sug.on{background:var(--accSoft)}.sug i{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:800;background:var(--sunk);flex:none}.sug.on i{background:var(--acc);color:var(--card)}' +
    '.wstrip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:1px solid var(--line);background:var(--side)}.wstrip button{padding:11px 14px;border-right:1px solid var(--line);text-align:left}.wstrip button:hover{background:var(--sunk)}.wstrip button.sel{box-shadow:inset 0 -2px 0 var(--acc)}' +
    '.askp{display:grid;grid-template-columns:minmax(0,1fr) 300px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.askp .sugs{max-height:300px;overflow:auto}.narrow .askp{grid-template-columns:1fr}.narrow .askp .sugs{border-left:0;border-top:1px solid var(--line);max-height:200px}' +
    '.hist{padding:14px 18px 16px}.hrow{display:grid;grid-template-columns:150px 1fr 120px 70px;align-items:center;gap:14px;width:100%;padding:9px 10px;border-radius:10px;text-align:left}.hrow:hover{background:var(--sunk)}' +
    '.set{padding:14px 18px 16px;border-bottom:1px solid var(--line);background:var(--side);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 14px;animation:fd .18s ease}.set .fl input{height:34px;width:100%;padding:0 8px;border:1px solid var(--frame);border-radius:8px;background:var(--input);font-family:var(--num);font-size:14px}' +
    '.set .full{grid-column:1/-1;display:flex;align-items:center;flex-wrap:wrap;gap:8px}.tcards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;grid-column:1/-1}.tcard{border-radius:10px;padding:7px;border:1.5px solid var(--line);text-align:left;font-size:12px;font-weight:650}.tcard.on{border-color:var(--acc)}.tcard span{display:block;height:26px;border-radius:7px;margin-bottom:5px}' +
    '.days7{display:flex;gap:4px}.days7 button{padding:5px 8px;border-radius:7px;border:1px solid var(--frame);font-size:12px;color:var(--mut)}.days7 button.on{background:var(--ink);color:var(--card);border-color:var(--ink)}' +
    '.empty{padding:28px 20px;text-align:center;color:var(--mut)}.empty b{display:block;color:var(--ink);font-size:15px;margin-bottom:6px}.spin{display:inline-block;width:12px;height:12px;border:2px solid var(--line);border-top-color:var(--acc);border-radius:50%;animation:sp .8s linear infinite;vertical-align:-2px}@keyframes sp{to{transform:rotate(1turn)}}' +
    '.notes{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px;border-bottom:1px solid var(--line);background:var(--side)}' +
    '.toast{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:9px 10px 9px 15px;border-radius:12px;background:var(--ink);color:var(--card);font-size:13px;font-weight:650;box-shadow:0 12px 30px rgba(0,0,0,.25);animation:fd .2s ease;z-index:3;white-space:nowrap}.toast button{padding:5px 10px;border-radius:8px;background:rgba(127,127,127,.3);font-weight:750}' +
    '.revp{position:absolute;right:12px;bottom:56px;width:380px;padding:14px;border-radius:14px;background:var(--card);border:1px solid var(--frame);box-shadow:var(--shadow);z-index:4;animation:fd .18s ease}.revp .rr{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:8px;font-size:13px}.revp select{height:30px;border:1px solid var(--frame);border-radius:8px;background:var(--input);padding:0 6px}' +
    '.pl0{display:none;align-items:center;gap:9px;padding:8px 14px;font-weight:750;cursor:pointer;white-space:nowrap}.pl0 small{font-weight:500;color:var(--mut)}.w.col{width:auto!important;border-radius:99px}.w.col .pl0{display:flex}.w.col .main{display:none}' +
    '.flash{animation:fl .7s}@keyframes fl{30%{box-shadow:0 0 0 4px var(--accSoft2),var(--shadow)}}' +
    '.narrow .body{grid-template-columns:1fr!important}.narrow .side,.narrow .rp,.narrow .sugs{border:0;border-top:1px solid var(--line)}.narrow .set{grid-template-columns:repeat(2,minmax(0,1fr))}.narrow .sws,.narrow .who{display:none}' +
    '.rz{position:absolute;z-index:6;touch-action:none}.rz-r{top:14px;bottom:14px;right:0;width:7px;cursor:ew-resize}.rz-l{top:14px;bottom:14px;left:0;width:7px;cursor:ew-resize}.rz-b{left:14px;right:14px;bottom:0;height:7px;cursor:ns-resize}.rz-bl{left:0;bottom:0;width:14px;height:14px;cursor:nesw-resize}' +
    '.rz-br{right:1px;bottom:1px;width:16px;height:16px;cursor:nwse-resize;opacity:0;transition:opacity .15s;background:linear-gradient(135deg,transparent 0 52%,var(--mut) 52% 58%,transparent 58% 68%,var(--mut) 68% 74%,transparent 74% 84%,var(--mut) 84% 90%,transparent 90%)}.w:hover .rz-br,.w.rsz .rz-br{opacity:.6}.w.col .rz{display:none}' +
    '.rzl{position:absolute;right:22px;bottom:22px;z-index:7;padding:4px 9px;border-radius:8px;background:var(--ink);color:var(--card);font-size:11.5px;font-weight:700;pointer-events:none;display:none;font-family:var(--num)}.rzl.on{display:block}' +
    '.main{max-height:calc(100vh - 16px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}.main>.hd{position:sticky;top:0;z-index:3}.w.fixh .main{height:100%;max-height:none}.w.anim{transition:width .16s ease-out,height .16s ease-out}@media (prefers-reduced-motion:reduce){.w.anim{transition:none}}' +
    '.pk{display:flex;align-items:center;gap:11px;height:54px;padding:0 6px 0 14px;cursor:grab;position:relative}.pkv{display:flex;flex-direction:column;line-height:1.08;min-width:0}.pkv small{font-size:10px;font-weight:750;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}' +
    '.pkv b{font-family:var(--num);font-size:20px;font-weight:800;letter-spacing:-.03em;white-space:nowrap}.pkv.f b{font-size:15px;color:var(--goldInk)}.pkbar{position:absolute;left:0;bottom:0;height:3px;background:var(--acc);border-radius:0 2px 2px 0}' +
    '.T-pocket .pk.themed-pocket{display:block;height:auto;padding:9px 8px 11px 12px;position:relative}.pocket-heading{display:flex;align-items:center;gap:4px;margin-bottom:10px}.pocket-brand{font-weight:800;font-size:15px;text-decoration:none;color:var(--ink);white-space:nowrap;margin-left:4px}.pocket-brand small{font-size:10px;font-weight:500;color:var(--mut);margin-left:3px}.pocket-heading .ib{width:28px;height:28px}' +
    '.pocket-values{display:grid;grid-template-columns:1fr 1fr;gap:9px}.pocket-meter{height:5px;margin-top:10px;border-radius:3px;position:relative;background:var(--sunk);overflow:hidden}.pocket-meter .pkbar{position:absolute;top:0;left:0;height:100%;border-radius:3px}' +
    '.hd.hc{height:46px;padding:0 6px 0 14px}.cpt{padding:12px 14px 14px}.cpt .bb{font-family:var(--num);font-weight:800;letter-spacing:-.04em;font-size:40px;line-height:1.02;margin-top:2px}' +
    '.cst{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) minmax(0,.7fr);gap:6px;margin-top:12px}.cst div{padding:7px 9px;border-radius:10px;background:var(--sunk);min-width:0}.cst b{display:block;font-family:var(--num);font-size:15px;font-weight:800;line-height:1.2;overflow-wrap:anywhere}.cwk button.sel{box-shadow:inset 0 -2px 0 var(--acc);border-radius:4px}.cst small{display:block;font-size:10.5px;color:var(--mut);font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.cwk{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:10px;height:66px}.cwk button{display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:3px;font-size:10px;font-weight:750;color:var(--mut);padding:0}.cwk i{display:block;border-radius:4px;background:var(--acc);min-height:3px}.cwk i.pl{background:var(--accSoft2)}.cwk i.cr{background:var(--ok);opacity:.7}.cwk button.td{color:var(--ink)}' +
    '.cask{display:flex;align-items:center;gap:8px;height:38px;margin-top:12px;padding:0 10px;border-radius:10px;border:1.5px solid var(--frame);background:var(--input)}.cask:focus-within{border-color:var(--acc);box-shadow:0 0 0 3px var(--accSoft)}.cask input{flex:1;min-width:0;border:0;background:transparent;font-size:13.5px;font-weight:600;outline:none}.cask svg{color:var(--mut);flex:none}' +
    '.cans .k2{font-size:11px;font-weight:750;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}.cans .bb{font-size:30px}.cans .dd{font-size:12.5px;color:var(--body);margin-top:6px;line-height:1.45}.cans .tags{margin-top:8px;gap:5px}.cans .pill{font-size:11px;padding:3px 8px;white-space:normal}.cans .acts{margin-top:10px}' +
    '.got{font-size:10.5px;font-weight:750;color:var(--faint);text-transform:uppercase;letter-spacing:.07em;align-self:center;margin-right:2px}.ans .pill{white-space:normal}' +
    '.imp{width:420px;max-width:calc(100% - 24px)}.imp .il{max-height:230px;overflow:auto;margin-top:8px;display:flex;flex-direction:column;gap:2px}.imp label{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:5px 6px;border-radius:7px;cursor:pointer;min-width:0}.imp label:hover{background:var(--sunk)}.imp label span:last-child{color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}' +
    '.btn.sm{height:26px;padding:0 9px;font-size:11.5px}.btn.ghost{background:none;border-color:transparent;color:var(--mut)}.note.habit{color:var(--ink)}.note.habit svg{color:var(--accInk)}.habit-set{align-items:center;gap:8px;flex-wrap:wrap}' +
    '.w:not(.H) .askp>.panel-head{grid-column:1/-1;margin:0;padding:10px 14px 0}' +
    '.w:not(.H) .panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;font-size:13.5px}.w:not(.H) .panel-close{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:var(--mut)}.w:not(.H) .panel-close:hover{background:var(--sunk);color:var(--ink)}' +
    '.w:not(.H) .theme-panel{position:absolute;z-index:25;top:58px;right:14px;width:min(600px,calc(100% - 28px));max-height:calc(100% - 72px);overflow:auto;padding:12px 14px 14px;background:var(--card);color:var(--ink);border:1px solid var(--frame);border-radius:14px;box-shadow:0 14px 40px #0003}' +
    '.w:not(.H) .theme-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.w:not(.H) .theme-choice{display:block;padding:8px;border:1px solid var(--line);border-radius:11px;background:var(--side);text-align:left;cursor:pointer}.w:not(.H) .theme-choice.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}' +
    '.w:not(.H) .theme-preview{display:block;aspect-ratio:16/10;border-radius:7px;overflow:hidden;background:var(--sunk)}.w:not(.H) .theme-preview-art{width:100%;height:100%;display:block}.w:not(.H) .theme-choice-title{display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;font-size:12.5px}.w:not(.H) .theme-selected{font-size:11px;color:var(--accInk);font-weight:650}' +
    '.w.T-compact:not(.H) .theme-panel{top:50px;right:8px;width:calc(100% - 16px);padding:10px}.w.T-compact:not(.H) .theme-choices{gap:6px}' +
    '.ib.mode:not(.celestial){border-radius:50%;border:1px solid var(--frame)}' +
    '.theme-entry{height:30px;padding:0 11px;border:1px solid var(--frame);border-radius:9px;font-weight:650;font-size:12.5px;color:var(--ink);background:var(--card);flex:none;cursor:pointer}.theme-entry.on,.theme-entry:hover{background:var(--accSoft)}' +
    '.appearance-rows{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}.appearance-rows .seg{margin-right:8px}' +
    '.strip>span{white-space:nowrap}.T-compact .hd .who{display:none}' +
    '.cst2{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin-top:14px;align-items:end}.cst2 small{display:block;font-size:11px;color:var(--mut);font-weight:650}.cst2 b{display:block;font-family:var(--num);font-size:21px;font-weight:800;white-space:nowrap}.cst2 b.fc{color:var(--goldInk)}' +
    '.cst2 .cbar{grid-column:1;height:5px;border-radius:3px;background:var(--sunk);overflow:hidden;align-self:center}.cst2 .cbar i{display:block;height:100%;background:var(--acc)}.cst2 .cpct{font-size:11px;color:var(--mut);font-weight:700}' +
    '.ccols{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:14px}.ccol{display:flex;flex-direction:column;align-items:center;gap:3px;padding:0;background:none;border:0;cursor:pointer;color:var(--mut)}' +
    '.ccol .cbox{position:relative;display:block;width:100%;height:58px;border-radius:6px;background:var(--sunk);overflow:hidden}.ccol .cbox:after{content:"";position:absolute;left:0;right:0;bottom:var(--ref);border-top:1px dashed var(--faint);opacity:.6}' +
    '.ccol i{position:absolute;left:0;right:0;bottom:0;display:block}.ccol i.dn{background:var(--acc)}.ccol i.pl{background:var(--accSoft);box-shadow:inset 0 0 0 1px var(--accSoft2)}.ccol i.cr{background:repeating-linear-gradient(135deg,var(--ok) 0 2px,transparent 2px 6px);box-shadow:inset 0 0 0 1px var(--ok)}' +
    '.ccol .cdn{font-size:10.5px;font-weight:700}.ccol b{font:700 11.5px var(--num);color:var(--ink)}.ccol b.p{color:var(--faint);font-weight:600}.ccol.td .cdn{color:var(--accInk)}.ccol.td .cbox{box-shadow:0 0 0 2px var(--acc)}' +
    '.H .ccol .cbox{border-radius:2px;background:none;border:1px solid var(--frame)}.H .ccol i.dn{background:var(--acc)}.H .ccol i.pl{background:none;border-top:1px dashed var(--acc);box-shadow:none}.H.L-knight .ccol b,.H.L-knight .cst2 b{font-family:\'Mesai Blackletter\',serif;font-weight:400}.H.L-knight .cst2 b{font-size:24px}' +
    '.cwk .cwv{display:block;margin-top:1px;font:700 11px/1.1 var(--num,var(--font));font-variant-numeric:tabular-nums;color:var(--ink)}.cwk .cwv.pl{color:var(--faint);font-weight:600}' +
    '.T-compact .toast,.T-pocket .toast{bottom:auto;top:52px;white-space:normal;max-width:90%}';

  CSS += MesaiHeritageCSS;

  // ---------------- DOM ----------------
  var host = document.createElement('div'); host.id = 'mesai-host';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' + CSS + '</style><div class="w" role="dialog" aria-label="Mesai"><div class="pl0" data-a="expand"></div><div class="main"></div>' +
    '<i class="rz rz-r" data-rz="r"></i><i class="rz rz-l" data-rz="l"></i><i class="rz rz-bl" data-rz="bl"></i><i class="rz rz-br" data-rz="br" role="separator" aria-orientation="vertical" tabindex="0"></i><span class="rzl"></span></div>';
  document.documentElement.appendChild(host);
  var W = root.querySelector('.w'), MAIN = root.querySelector('.main'), PILL = root.querySelector('.pl0');

  // ---------------- read loop ----------------
  function tick(force) {
    var now = nowFn(), r;
    var due = force || st.dirty || st.code !== 'ready' || st.job || Date.now() - (st.lastRead || 0) > 5000;
    if (due) {
      st.dirty = false; st.lastRead = Date.now();
      try { r = A.read(now, { want: st.job ? st.job.want : null, person: S.lastPerson }); } catch (e) { r = { code: 'loading', count: 0 }; }
      st.code = r.code; st.count = r.count || 0; st.focusEl = r.focus || null;
      if (r.code === 'ready') {
        if (r.fp !== st.fp || now - st.readAt > 60000) { merge(r.snap, now); st.fp = r.fp; }
        st.readAt = now; st.scope = r.scope;
        var j = st.job;
        if (j && j.phase === 'load' && r.period === j.want) { j.phase = 'back'; j.want = j.restore; }
        else if (j && j.phase === 'back' && r.period === j.restore) st.job = null;
        else if (!j) autoLoad(r.period, now);
      }
      if (st.job && Date.now() - st.job.at > 25000) { st.tried[st.job.target] = 'fail'; st.job = null; }
    }
    render(now, force);
    bell(now);
  }
  function needMonths(now) {
    var p = P(); if (!p) return [];
    var ws = C.weekStart(now) + st.off * 7 * DAY, out = [];
    for (var i = 0; i < 7; i++) { var d = ws + i * DAY; if (d > C.dayStart(now)) break; var mk = C.mkey(d); if (!p.months[mk] && out.indexOf(mk) < 0) out.push(mk); }
    return out;
  }
  function autoLoad(period, now) {
    var miss = needMonths(now).filter(function (mk) { return mk !== period && !st.tried[mk]; })[0];
    if (miss) startJob(miss, period);
  }
  function startJob(mk, restore) { st.tried[mk] = 'auto'; st.job = { want: mk, target: mk, restore: restore || C.mkey(nowFn()), phase: 'load', at: Date.now() }; }
  var notified = {};
  function bell(now) {
    var v = st.v; if (!S.ui.bell || !v || !v.goal || !v.today || !v.today.inside) return; var gt = v.goal.t;
    if (now >= gt && now - gt < 10 * MIN && !notified[gt]) {
      notified[gt] = 1;
      try { if (window.Notification && Notification.permission === 'granted') new Notification('Mesai', { body: fill(L().notify, { D: hrs(v.goal.week ? v.W : v.cfg.D * MIN) }) + ' · ' + clk(gt), tag: 'mesai' }); } catch (e) { /* ignore */ }
      flash();
    }
  }
  function flash() { W.classList.remove('flash'); void W.offsetWidth; W.classList.add('flash'); }

  // ---------------- view model ----------------
  function compute(now) {
    var p = P(); if (!p) return null;
    var v = C.week(dataOf(p), now, S.cfg, storeOf(p), st.off);
    v.p = p;
    if (st.sel == null || st.sel > 6) st.sel = v.thisWeek ? Math.min(4, C.dow(now)) : 0;
    if (st.ask && st.ask.sc && v.thisWeek) {
      var res = SC.solve(C, dataOf(p), now, S.cfg, storeOf(p), st.ask.sc), tr = res.pv && res.day != null && res.pv.rows[res.day];
      st.ask.res = res; st.ask.store = res.store || null; if (res.kind && !/^(outOfWeek|weekend)$/.test(res.kind)) st.lastSc = { sc: st.ask.sc, day: res.day }; st.ask.opts = (res.kind === 'leave' || res.kind === 'earliest') && tr ? { absorb: tr.key } : {};
    }
    if (st.ask && st.ask.store && v.thisWeek) st.ask.pv = C.week(dataOf(p), now, S.cfg, st.ask.store, 0, st.ask.opts || {});
    return v;
  }
  var dayKey = function (v, i) { return v.rows[i] && v.rows[i].key; };
  function rowStatus(r, v) {
    var t = L().st;
    if (r.credit) return { s: (r.hol && r.type === 'tatil' ? holName(r.hol) : L().types[r.type].toLowerCase()) + ' · ' + fill(t.credit, { D: hrs(v.cfg.D * MIN) }), c: 'var(--ok)' };
    if (r.half && !r.today) return { s: holName(r.hol) + ' · ½', c: 'var(--ok)' };
    if (r.flags.indexOf('open') >= 0) return { s: t.open, c: 'var(--bad)' };
    if (r.flags.indexOf('month') >= 0) return { s: t.month, c: 'var(--goldInk)' };
    if (r.flags.indexOf('absent') >= 0) return { s: t.absent, c: 'var(--bad)' };
    if (r.today && r.src === 'live' && v.thisWeek) return { s: '● ' + t.live + (r.manual ? ' · ' + t.typed : ''), c: 'var(--accInk)' };
    if (r.past || !v.thisWeek || r.src === 'portal') return { s: r.src === 'manual' ? t.manual : r.src === 'portal' ? t.portal : r.src === 'raw' ? t.raw : t.none, c: 'var(--faint)' };
    if (r.auto) return { s: t.auto, c: 'var(--goldInk)' };
    return { s: t.plan, c: 'var(--faint)' };
  }

  // ---------------- ask ----------------
  function runAsk(text) {
    var now = nowFn();
    if (st.off) { st.off = 0; }
    var v = compute(now); st.v = v;
    st.askText = text;
    var sc = null; try { sc = SC.parse(text); } catch (x) { sc = null; }
    // Follow-up ("ya 9'da gelirsem", "peki cuma izin alırsam"): build on the last answered question.
    if (sc && st.lastSc && SC.isFollowUp(sc)) { try { sc = SC.followUp(st.lastSc.sc, sc, st.lastSc.day); } catch (x) { /* keep the plain question */ } }
    var sk = sc && sc.query.kind, slots = sc && sc.frames.some(function (f) { return f.s != null || f.e != null || f.len != null || f.ooo || (f.type && sc.frames.length > 1); });
    if (sk && !/^(reset|history|leaveNow)$/.test(sk) && (sc.frames.length > 1 || sc.each || slots || !/^(leave|remaining)$/.test(sk))) {
      st.ask = { q: text, sc: sc }; compute(now);
      if (st.ask.res && st.ask.res.day != null && st.ask.res.day >= 0 && st.ask.res.day <= 6) st.sel = st.ask.res.day;
      return;
    }
    // Simple questions answered by the classic parser still give later follow-ups their context.
    if (sk && !/^(reset|history|leaveNow)$/.test(sk)) { try { var r0 = SC.solve(C, dataOf(P()), now, S.cfg, storeOf(P()), sc); if (r0.kind && r0.day != null && !/^(outOfWeek|weekend)$/.test(r0.kind)) st.lastSc = { sc: sc, day: r0.day }; } catch (x) { /* no context */ } }
    var intent = Q.parse(text, C.dow(now));
    var p = P(), s2 = C.clone(storeOf(p)), opts = {}, t = L();
    ['types', 'plan', 'ooo', 'ovr'].forEach(function (k) { s2[k] = s2[k] || {}; });
    st.ask = { q: text, intent: intent, store: null, opts: null };
    if (!intent) { st.ask.err = t.askNo; return; }
    if (intent.day != null && intent.day > 6) intent.day = 6;
    var key = intent.day != null ? dayKey(v, intent.day) : null, row = intent.day != null ? v.rows[intent.day] : null;
    if (intent.kind === 'history') { st.view = 'history'; st.ask = null; return; }
    if (row && row.past && ['plan', 'arrive', 'length', 'leaveAt'].indexOf(intent.kind) >= 0) { st.ask.err = t.askNo; return; }
    if (intent.kind === 'reset') { v.rows.forEach(function (r) { delete s2.plan[r.key]; delete s2.types[r.key]; delete s2.ooo[r.key]; }); }
    else if (intent.kind === 'plan') { s2.plan[key] = row.first != null ? { e: intent.e } : { s: intent.s, e: intent.e }; delete s2.types[key]; }
    else if (intent.kind === 'arrive') { s2.plan[key] = Object.assign({}, s2.plan[key], { s: intent.s }); delete s2.plan[key].e; delete s2.types[key]; }
    else if (intent.kind === 'length') { var sm = row.first != null ? minOf(row.first, row.date) : (s2.plan[key] && s2.plan[key].s != null ? s2.plan[key].s : C.config(S.cfg).start); s2.plan[key] = row.first != null ? { e: sm + intent.m } : { s: sm, e: sm + intent.m }; }
    else if (intent.kind === 'type') { if (intent.type === 'ofis') { if (row.hol) s2.types[key] = 'ofis'; else delete s2.types[key]; } else s2.types[key] = intent.type; delete s2.plan[key]; }
    else if (intent.kind === 'ooo') { s2.ooo[key] = { m: intent.m, s: intent.s }; }
    else if (intent.kind === 'leaveAt' || intent.kind === 'leaveNow') {
      var e = intent.kind === 'leaveNow' ? Math.ceil(minOf(now, C.dayStart(now))) : intent.e;
      s2.plan[key] = Object.assign({}, s2.plan[key], { e: e }); delete s2.types[key];
      var cand = v.rows.filter(function (r) { return !r.past && r.office && r.key !== key && !(s2.plan[r.key] && s2.plan[r.key].e != null); });
      var after = cand.filter(function (r) { return r.dow > intent.day; }), before = cand.filter(function (r) { return r.dow < intent.day; });
      var pick = (intent.kind === 'leaveNow' ? after[after.length - 1] : (before[before.length - 1] || after[after.length - 1])) || null;
      if (pick) opts.absorb = pick.key;
      st.ask.absorbKey = pick && pick.key;
    }
    var mutating = ['reset', 'plan', 'arrive', 'length', 'type', 'ooo', 'leaveAt', 'leaveNow'].indexOf(intent.kind) >= 0;
    if (mutating) { st.ask.store = s2; st.ask.opts = opts; }
    if (row) st.sel = Math.min(6, intent.day);
  }
  var hitDow = function (h) { return h.t != null ? dayOf(h.t) : h.day.dow; };
  function dayOf(t) { return C.dow(Math.ceil(t / MIN - 1e-9) * MIN); }   // an end can fall after midnight   // work can run past midnight
  function weekLbl(w) {
    var t = L();
    if (w.shortfall) return fill(t.shortfall, { x: dur(w.shortfall, true) });
    if (w.hit && w.hit.t != null) return t.days[hitDow(w.hit)] + ' ' + clk(w.hit.t);
    if (w.hit) return t.days[w.hit.day.dow] + ' ✓';
    return '—';
  }
  var cfgD = function () { return C.config(S.cfg).D * MIN; };
  function scAnswer(v, a) {
    var t = L(), T = t.sc, r = a.res, out = { tags: [], got: true }, seen = {};
    if (a.sc && a.sc.follow) out.tags.push({ l: '↳ ' + T.follow, k: 'gray' });
    var dS = function (d) { return t.days[d] || ''; }, dN = function (d) { return t.daysL[d] || ''; }, hhmm = function (m) { return m < 0 ? '—' : mm(m); };
    r.chips.forEach(function (c) {
      var l;
      if (c.k === 'warn') l = (c.d != null ? dS(c.d) + ' · ' : '') + (c.w === 'past' ? T.past : c.w === 'weekend' ? T.weekend : c.w === 'arrived' ? fill(T.arrived, { t: mm(c.t) }) : T.outM);
      else {
        var parts = [];
        if (c.type) parts.push(t.types[c.type]);
        if (c.m != null) parts.push(dur(c.m * MIN));
        if (c.s != null) parts.push(fill(T.arr, { t: mm(c.s) }));
        if (c.e != null) parts.push(fill(c.before ? T.lvBefore : T.lv, { t: mm(c.e) }));
        if (c.ooo != null) parts.push(fill(c.k === 'auto' ? (c.ok ? T.oooOk : T.oooAuto) : T.ooo, { x: dur(c.ooo * MIN) }));
        l = dS(c.d) + ' · ' + parts.join(' · ') + (c.k === 'default' ? ' · ' + T.dflt : '');
      }
      if (seen[l]) return; seen[l] = 1;
      out.tags.push({ l: l, k: c.k === 'given' ? '' : c.k === 'default' ? 'gray' : c.k === 'auto' ? 'gold' : 'bad' });
    });
    var eOf = function (d) { var e = null; r.chips.forEach(function (c) { if (c.d === d && c.e != null) e = c.e; }); return e; };
    var tgt = r.W ? fill(T.target, { W: hrs(r.W) }) : '';
    var k = r.kind, row = r.pv && r.day != null ? r.pv.rows[r.day] : null;
    if (k === 'invalidTime') {
      out.kicker = t.sy.bad; out.big = '—'; out.detail = ''; return out;
    }
    if (k === 'dayGoal') {
      out.kicker = fill(T.dayGoalK, { d: dN(r.day), D: hrs(r.D) });
      out.big = r.needsEntry ? '—' : clk(r.milestone, row ? row.date : null);
      out.detail = r.needsEntry ? T.dayGoalMissing : fill(r.planned ? T.dayGoalPlan : T.arr, { s: rec(r.start), t: rec(r.start) });
      if (r.weeklyEnd != null) out.detail += ' · ' + fill(T.dayGoalWeek, { t: dS(dayOf(r.weeklyEnd)) + ' ' + clk(r.weeklyEnd) });
      else if (!r.needsEntry) out.detail += ' · ' + weekLbl(v);
      if (r.coreEnd != null) out.tags.push({ l: fill(T.dayGoalCore, { t: clk(r.coreEnd) }), k: 'gold' });
      if (r.coreUnknown) out.tags.push({ l: T.dayGoalUnknown, k: 'bad' });
      if (r.coreLate) out.tags.push({ l: t.flags.coreLate, k: 'bad' });
      return out;
    }
    if (k === 'confirmOOO') {
      var items = r.need.map(function (n) { var late = n.e == null; return fill(T.confItem, { d: dS(n.d), a: mm(late ? r.coreS : n.e), b: mm(late ? n.st : r.coreE) }); }).join(', ');
      out.kicker = fill(T.confK, { cs: mm(r.coreS), ce: mm(r.coreE) }); out.big = fill(T.confB, { x: dur(r.m * MIN) });
      out.detail = fill(T.confD, { items: items, W0: hrs(r.W0), W1: hrs(r.W1) }); out.confirm = true;
      return out;
    }
    if (k === 'leave' || k === 'earliest') {
      var given = r.chips.some(function (c) { return c.d === r.day && c.s != null && c.k !== 'default'; });
      out.kicker = k === 'earliest' ? t.earliest + ' · ' + dN(r.day) : fill(given ? T.leaveKs : T.leaveK, { d: dN(r.day), s: clk(r.start) });
      out.big = clk(r.end, row ? row.date : null);
      var hit = r.pv && r.pv.hit;
      out.detail = (r.held ? fill(T.held, { t: clk(r.end) }) + (hit && hit.t != null ? ' · ' + fill(T.weekAt, { t: dS(hitDow(hit)) + ' ' + clk(hit.t) }) : '') : fill(T.span, { s: clk(r.start), e: clk(r.end), x: dur(r.plan, true) })) + ' · ' + tgt;
      if (row && row.today && !given && st.v && st.v.milestone) out.tags.push({ l: fill(t.dayAlso, { D: hrs(cfgD()), t: clk(st.v.milestone) }), k: 'ok' });
      if (r.late) out.tags.unshift({ l: T.late, k: 'bad' });
      if (r.pv && r.pv.shortfall) out.tags.unshift({ l: fill(t.shortfall, { x: dur(r.pv.shortfall, true) }), k: 'bad' });
    } else if (k === 'left') { out.kicker = fill(T.leaveK, { d: dN(r.day) }); out.big = rec(r.t); out.detail = fill(T.left, { t: rec(r.t) }); }
    else if (k === 'credit') { out.kicker = dN(r.day); out.big = t.types[r.type]; out.detail = fill(T.credit, { d: dN(r.day), type: t.types[r.type].toLowerCase() }); }
    else if (k === 'arrive') {
      out.kicker = fill(T.arriveK, { d: dN(r.day), e: mm(r.e) });
      out.big = r.capped ? fill(T.arriveCap, { s: hhmm(r.s) }) : fill(T.arriveB, { s: hhmm(r.s) });
      out.detail = (r.capped ? fill(T.arriveCapD, { s: mm(r.latest), x: dur(r.extra * MIN) }) : fill(T.span, { s: hhmm(r.s), e: mm(r.e), x: dur(r.need * MIN) })) + ' · ' + tgt;
      if (r.early) out.tags.unshift({ l: T.early, k: 'bad' });
    } else if (k === 'check' || k === 'arrivedCheck') {
      if (r.before) { out.kicker = fill(T.coreNo, { t: mm(v.cfg.coreE) }); out.big = T.no; out.detail = T.coreNoD; }
      else {
        out.kicker = dN(r.day) + (row && row.end ? ' · ' + clk(row.start) + ' → ' + clk(row.end) : '');
        out.big = r.ok ? T.yes : T.no;
        out.detail = (r.ok ? fill(T.okD, { x: dur(r.margin) }) : fill(T.noD, { x: dur(-r.margin, true) })) + ' · ' + T.othersD + ' · ' + tgt;
      }
      if (k === 'arrivedCheck') out.tags.unshift({ l: fill(T.arrivedM, { t: rec(r.t) }), k: 'gray' });
    } else if (k === 'oooNeed') {
      out.kicker = fill(T.oooK, { d: dN(r.day), e: eOf(r.day) != null ? mm(eOf(r.day)) : '' });
      out.big = r.oooDay ? fill(T.oooB, { x: dur(r.oooDay * MIN) }) : T.oooZero; out.detail = fill(T.oooD, { W: hrs(r.W) });
    } else if (k === 'reqLen' || k === 'avg') {
      out.kicker = k === 'avg' ? fill(T.avgK, { n: r.days.length }) : fill(T.reqK, { days: r.days.map(dS).join(', ') });
      out.big = dur(r.m * MIN) + (k === 'avg' ? T.perDay : '');
      out.detail = r.ends.map(function (x) { return dS(x.d) + ' ' + clk(x.end); }).join(' · ') + ' · ' + tgt;
      if (r.impossible) { out.tags.unshift({ l: T.reqImp, k: 'bad' }); }
      else if (r.m > 600) out.tags.unshift({ l: fill(T.longDay, { x: dur(r.m * MIN) }), k: 'bad' });
    } else if (k === 'reqZero' || k === 'avgDone0') { out.kicker = t.ask; out.big = T.reqZero; out.detail = T.reqZeroD; }
    else if (k === 'impossible') { out.kicker = t.ask; out.big = '—'; out.detail = T.reqImp; }
    else if (k === 'avgDone') { out.kicker = T.avgDoneK; out.big = dur(r.m) + T.perDay; out.detail = r.n + ' ' + (S.ui.lang === 'en' ? 'days' : 'gün'); }
    else if (k === 'done') {
      out.kicker = r.scope === 'days' ? fill(T.doneKd, { days: r.days.map(function (x) { return dS(x.d); }).join(', ') }) : T.doneK;
      out.big = dur(r.m);
      out.detail = r.days.map(function (x) { return dS(x.d) + ' ' + hm(x.m); }).join(' · ') + (r.liveToday ? ' · ' + T.liveNote : '');
    } else if (k === 'balance') {
      out.kicker = T.balK; out.big = r.bal >= 0 ? fill(T.balPlus, { x: hm(r.bal) }) : fill(T.balMinus, { x: hm(-r.bal, true) });
      out.detail = r.todayM != null ? fill(T.balToday, { x: hm(r.todayM) }) + ' / ' + hrs(r.D) + ' ' + t.h : '';
    } else if (k === 'remaining') {
      out.kicker = T.remK; out.big = dur(r.m, true);
      out.detail = fill(T.remD, { done: hm(r.done), W: hrs(r.W) }) + (r.credits ? ' · ' + fill(T.remCred, { x: dur(r.credits) }) : '');
    } else if (k === 'dayLen') {
      out.kicker = fill(T.dayLenK, { d: dN(r.day), t: clk(r.end) }); out.big = hm(r.len); var hit6 = r.pv.hit; out.detail = hit6 && hit6.t != null ? fill(T.weekAt, { t: dS(hitDow(hit6)) + ' ' + clk(hit6.t) }) : r.pv.shortfall ? fill(t.shortfall, { x: dur(r.pv.shortfall, true) }) : '';
      if (r.len < cfgD()) out.tags.push({ l: fill(T.dayShort, { x: dur(cfgD() - r.len, true), D: hrs(cfgD()) }), k: 'bad' });
    } else if (k === 'target') { out.kicker = T.tgtK; out.big = hrs(r.W) + ' ' + t.h; out.detail = fill(T.tgtD, { x: dur(r.ooo), y: dur(r.m, true) }); }
    else { out.kicker = t.ask; out.big = '?'; out.detail = { weekend: T.weekendM, outOfWeek: T.outM, pastDay: T.pastM, noDays: T.noDays, needLeave: T.needLeave }[k] || t.askNo; }
    out.canApply = !!a.store && /^(leave|earliest|arrive|reqLen|avg|check|remaining|target|dayLen)$/.test(k) && r.chips.some(function (c) { return c.k === 'given' || c.k === 'auto'; }) || (!!a.store && /^(reqLen|avg|arrive)$/.test(k));
    if (out.canApply) out.tags.unshift({ l: T.preview, k: 'gray' });
    return out;
  }
  function answer(v) {
    var a = st.ask, t = L(), A2 = t.ans, D = hrs(v.cfg.D * MIN);
    if (a && a.sc && a.res) return scAnswer(v, a);
    var pv = a && a.pv && a.store ? a.pv : v, out = { tags: [] };
    if (!a || !a.intent) {
      out.kicker = fill(A2.when, { W: hrs(v.W) }); out.big = v.thisWeek ? weekLbl(v) : hm(v.done);
      var ab = v.absorber;
      if (ab && ab.held) out.tags.push({ l: t.earliest + ' ' + clk(ab.end), k: 'gold' });
      if (v.bank > 0) out.tags.push({ l: '+' + hm(v.bank) + ' ' + t.bank.toLowerCase(), k: 'ok' });
      if (v.ooo) out.tags.push({ l: 'OOO ' + hm(v.ooo), k: 'gray' });
      out.detail = v.thisWeek && v.bank > 0 ? t.bankNote : '';
      if (a && a.err) { out.kicker = t.ask; out.big = '?'; out.detail = a.err; out.tags = []; }
      return out;
    }
    var it = a.intent, row = it.day != null ? pv.rows[it.day] : null, dN = row ? t.daysL[row.dow] : '';
    var leaveOf = function (w) { var ab = w.absorber; return ab && ab.end ? t.days[dayOf(ab.end)] + ' ' + clk(ab.end) : weekLbl(w); };
    if (it.kind === 'when') {
      var ab2 = v.absorber;
      if (row && ab2 && row.key !== ab2.key && row.end && !row.credit) { out.kicker = fill(A2.whenDay, { d: dN }); out.big = clk(row.end); out.detail = row.planned ? '' : hm(row.plan, true); }
      else { out.kicker = fill(A2.when, { W: hrs(v.W) }); out.big = weekLbl(v); if (ab2 && ab2.held) out.tags.push({ l: t.earliest + ' ' + clk(ab2.end), k: 'gold' }); }
      if (v.bank > 0) out.tags.push({ l: '+' + hm(v.bank) + ' ' + t.bank.toLowerCase(), k: 'ok' });
    } else if (it.kind === 'remaining') { out.kicker = A2.remaining; out.big = dur(v.remaining, true); out.detail = hm(v.done) + ' / ' + hrs(v.W) + ' ' + t.h; }
    else if (it.kind === 'reset') { out.kicker = A2.reset; out.big = leaveOf(pv); }
    else if (it.kind === 'plan' || it.kind === 'arrive' || it.kind === 'length') { out.kicker = dN; out.big = clk(row.start) + ' → ' + clk(row.end, row.date); out.detail = hm(row.plan, true) + (row.flags.indexOf('coreStart') >= 0 ? ' · ' + t.flags.coreStart : row.held ? ' · ' + fill(t.held, { t: mm(v.cfg.coreE) }) : ''); }
    else if (it.kind === 'type') { out.kicker = fill(A2.izin, { d: dN, type: t.types[it.type], D: D }); out.big = leaveOf(pv); }
    else if (it.kind === 'ooo') { out.kicker = fill(A2.ooo, { W: hrs(pv.W) }); out.big = leaveOf(pv); if (it.s == null) out.tags.push({ l: t.flags.coreUnknown, k: 'gray' }); }
    else if (it.kind === 'leaveAt' || it.kind === 'leaveNow') {
      var ab3 = a.absorbKey && pv.rows.filter(function (r) { return r.key === a.absorbKey; })[0];
      if (it.kind === 'leaveNow') { out.kicker = row.held ? fill(A2.now, { t: clk(row.end) }) : t.leaveNow; out.big = row.held ? t.earliest + ' ' + clk(row.end) : fill(A2.nowOk, { x: dur(row.plan) }); }
      else { out.kicker = fill(A2.leaveFor, { d: dN, t: mm(it.e) }); out.big = row.held ? t.earliest + ' ' + clk(row.end) : (ab3 && ab3.end ? t.days[ab3.dow] + ' ' + clk(ab3.end, ab3.date) : weekLbl(pv)); }
      if (ab3 && ab3.end) out.detail = fill(t.revStay, { d: t.daysL[ab3.dow], t: clk(ab3.end, ab3.date) });
    }
    if (pv.shortfall && a.store) out.tags.push({ l: fill(t.shortfall, { x: dur(pv.shortfall, true) }), k: 'bad' });
    var l0 = leaveOf(v), l1 = leaveOf(pv);
    if (a.store && l0 !== l1) out.tags.unshift({ l: l0 + ' → ' + l1, k: 'gold' });
    out.canApply = !!a.store;
    return out;
  }

  // ---------------- render pieces ----------------
  function header(v) {
    var t = L(), th = S.ui.theme, dark = isDark(), live = v && v.today && v.today.inside && st.code === 'ready' && !st.off;
    var sw = TH.ORDER.map(function (k) { return '<button class="sw' + (k === th ? ' on' : '') + '" data-a="theme" data-v="' + k + '" title="' + esc(t.themes[k]) + '" aria-label="' + esc(t.themes[k]) + '" style="background:' + TH.T[k].swatch + ';color:' + TH.T[k].swatch + '"></button>'; }).join('');
    var title = 'Mesai';
    var wk = v ? fill(t.weekOf, { a: dl(v.ws), b: dl(v.ws + 4 * DAY) }) : '';
    var lay = TH.T[th] ? TH.T[th].layout : 'cizelge';
    var illustrated=lay==='knight'||lay==='clock';
    return '<div class="hd" data-drag>' +
      '<span class="brand" aria-label="Mesai"><span class="dot' + (live ? ' on' : '') + '"></span>' + (lay==='knight'?'<span class="brand-rest">esai</span>':esc(title)) + (TH.T[th] && TH.T[th].rune ? '<span class="rune" dir="rtl" aria-hidden="true" style="unicode-bidi:isolate" title="Mesai · stilize imza">' + TH.T[th].rune + '</span>' : '') + '</span>' +
      (st.name ? '<span class="who">' + esc(st.name.replace(/^\s*\d+\s*[-–:]\s*/, '')) + '</span>' : '') +
      (v ? '<span class="vr"></span><button class="ib" data-a="prev" aria-label="‹">' + ic('l', 14) + '</button><span class="wk">' + esc(wk) + '</span><button class="ib" data-a="next" aria-label="›"' + (st.off >= 0 ? ' disabled style="opacity:.25"' : '') + '>' + ic('r', 14) + '</button>' : '') +
      '<span class="sp"></span>' +
      (v ? '<button class="askb' + (S.ui.ask ? ' on' : '') + '" data-a="askOpen" title="' + t.ask + ' (Alt+M)">' + ic('search', 14) + '<span>' + t.ask + '</span></button>' : '') +
      (v ? '<button class="ib' + (st.view === 'history' ? ' on' : '') + '" data-a="hist" title="' + t.history + '" aria-label="' + t.history + '">' + ic('hist', 15) + '</button>' : '') +
      // 3.3: theme, language and light/dark live in one Görünüm menu.
      '<button class="theme-entry' + (st.themes ? ' on' : '') + '" data-a="themes" aria-expanded="' + !!st.themes + '">' + t.look + '</button>' +
      (TH.T[th] && TH.T[th].lightOnly ? '' : '<button class="ib mode' + (illustrated ? ' celestial' : '') + '" data-a="dark" aria-label="' + (dark ? t.light : t.dark) + '" title="' + (dark ? t.light : t.dark) + '">' + (illustrated ? art('toggle','toggle-art') : ic(dark ? 'sun' : 'moon', 16)) + '</button>') +
      '<button class="ib' + (st.set ? ' on' : '') + '" data-a="set" aria-label="' + t.settings + '" title="' + t.settings + '">' + ic('set', 16) + '</button>' +
      '<button class="ib" data-a="cmp" aria-label="' + t.compact + '" title="' + t.compact + ' (Alt+K)">' + ic('cmp', 15) + '</button>' +
      '<button class="ib" data-a="min" aria-label="' + t.min + '" title="' + t.min + '">' + ic('min', 16) + '</button>' +
      '<button class="ib" data-a="close" aria-label="' + L().closeMesai + '" title="' + L().closeMesai + '">' + ic('x', 15) + '</button></div>';
  }
  // ---------------- small sizes ----------------
  function liveOf(v) { return v && v.today && v.today.inside && st.code === 'ready' && !st.off; }
  function pocketView(v) {
    var t = L(), lbl = '', big = '…', f = '';
    if (v && v.goal) { lbl = goalLbl(v, 'pkD'); big = clk(v.goal.t); }
    else if (v) { lbl = t.week; big = hm(v.done); }
    else lbl = L()[st.code] || t.loading;
    if (v && v.thisWeek) f = forecastText(v).big;
    var pct = v && v.W ? Math.min(100, Math.floor(v.done / v.W * 100)) : 0;
    return '<div class="pk themed-pocket" data-drag><div class="pocket-heading"><span class="dot' + (liveOf(v) ? ' on' : '') + '"></span><a class="pocket-brand" href="'+UPDATE_URL+'?from='+VERSION+'&amp;theme='+BUILD.theme+'" target="_blank" rel="noopener">Mesai <small>v'+VERSION+'</small></a><span class="sp"></span><button class="ib" data-a="cmpx" aria-label="'+t.expand+'" title="'+t.expand+'">'+ic('exp',15)+'</button><button class="ib" data-a="close" aria-label="'+L().closeMesai+'" title="'+L().closeMesai+'">'+ic('x',15)+'</button></div><div class="pocket-values"><span class="pkv"><small>'+esc(lbl)+'</small><b>'+esc(big)+'</b></span><span class="pkv f"><small>'+esc((v && v.goal && v.goal.week ? t.leaveToday : t.pkW))+'</small><b>'+esc(f||'—')+'</b></span></div><div class="pocket-meter" role="progressbar" aria-label="'+t.week+'" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100"><i class="pkbar" style="width:'+pct+'%"></i></div></div>';
  }
  function compactView(v) {
    var t = L(), D = hrs((v ? v.cfg.D : 540) * MIN);
    var head = '<div class="hd hc" data-drag><span class="brand" aria-label="Mesai"><span class="dot' + (liveOf(v) ? ' on' : '') + '"></span>Mesai</span>' + (st.name ? '<span class="who" style="max-width:110px">' + esc(st.name.replace(/^\s*\d+\s*[-–:]\s*/, '')) + '</span>' : '') + '<span class="sp"></span>' +
      '<button class="theme-entry" data-a="themes" aria-expanded="' + !!st.themes + '">' + t.look + '</button>' +
      '<button class="ib" data-a="cmpx" title="' + t.expand + ' (Alt+K)" aria-label="' + t.expand + '">' + ic('exp', 15) + '</button>' +
      '<button class="ib" data-a="min" aria-label="' + t.min + '" title="' + t.min + '">' + ic('min', 16) + '</button>' +
      '<button class="ib" data-a="close" aria-label="' + L().closeMesai + '" title="' + L().closeMesai + '">' + ic('x', 15) + '</button></div>';
    if (!v) return head + '<div class="empty">' + (st.code === 'loading' ? '<span class="spin"></span> ' : '') + '<b>' + esc(L()[st.code] || t.loading) + '</b></div>';
    var body = '', td = v.today;
    if (st.ask) {
      var a = answer(v), tags = a.tags.slice(0, 6).map(function (g) { return '<span class="pill ' + g.k + '">' + esc(g.l) + '</span>'; }).join('');
      body = '<div class="cans"><div class="k2">' + esc(a.kicker || '') + '</div><div class="bb">' + esc(a.big || '') + '</div>' + (a.detail ? '<div class="dd">' + esc(a.detail) + '</div>' : '') +
        (tags ? '<div class="tags">' + tags + '</div>' : '') + '<div class="acts">' + (a.confirm ? '<button class="btn pri" data-a="oooYes">' + t.sc.confYes + '</button>' : a.canApply ? '<button class="btn pri" data-a="askApply">' + t.apply + '</button>' : '') + '<button class="btn" data-a="askClear">' + (a.canApply || a.confirm ? t.cancel : t.close) + '</button></div></div>';
    } else if (v.goal) {
      var rem = v.goal.t - v.now;
      body = '<div class="k">' + goalLbl(v) + '</div><div class="bb">' + clk(v.goal.t) + '</div><div style="margin-top:6px">' + (rem > 0 ? '<span class="pill">' + ic('clock') + dur(rem, true) + ' ' + t.left + '</span>' : '<span class="pill ok">' + ic('check') + t.done + ' +' + hm(-rem) + '</span>') + '</div>' + goalAlso(v);
    } else if (v.thisWeek && td && td.credit) body = '<div class="k">' + t.today + '</div><div class="bb" style="color:var(--ok);font-size:32px">' + esc(td.hol && td.type === 'tatil' ? holName(td.hol) : t.types[td.type]) + '</div>';
    else body = '<div class="k">' + (v.thisWeek ? t.today : t.week) + '</div><div class="bb" style="font-size:32px">' + (v.thisWeek ? '—' : hm(v.done)) + '</div>';
    var pct = v.W ? Math.min(100, Math.floor(v.done / v.W * 100)) : 100;
    var stats = '<div class="cst"><div><small>' + t.remaining + '</small><b>' + hm(v.remaining, true) + '</b></div>' +
      '<div><small>' + fcLbl(v) + '</small><b style="color:' + (v.shortfall ? 'var(--bad)' : 'var(--goldInk)') + '">' + esc(v.thisWeek ? forecastText(v).big : '—') + '</b></div>' +
      '<div><small>' + t.week + '</small><b>%' + pct + '</b></div></div>';
    var mx = Math.max(v.cfg.D * MIN, Math.max.apply(null, v.rows.slice(0, 5).map(function (r) { return Math.max(r.val || 0, r.count || 0); })));
    var bars = '<div class="cwk">' + v.rows.slice(0, 5).map(function (r, i) {
      var hv = Math.max(r.count || 0, r.val || 0), cls = r.credit ? 'cr' : (r.past || (r.today && !r.inside)) ? '' : 'pl';
      return '<button class="' + (r.today ? 'td' : '') + (st.sel === i ? ' sel' : '') + '" aria-pressed="' + (st.sel === i) + '" data-a="sel" data-v="' + i + '" title="' + esc(t.daysL[i] + ' · ' + hm(hv)) + '"><i class="' + cls + '" style="height:' + Math.round(hv / mx * 34) + 'px"></i>' + t.days[i] + '<b class="cwv' + (cls === 'pl' ? ' pl' : '') + '">' + (hv ? hm(r.past || r.today || r.credit ? Math.max(r.count || 0, r.credit || 0) : hv) : '—') + '</b></button>';
    }).join('') + '</div>';
    if (window.__MESAI_MOCK === 'cmp2') { stats = cmpStats(v, pct); bars = cmpCols(v); }   // mockup: not shipped until approved
    var ask = '<label class="cask">' + ic('search', 15) + '<input data-e="ask" value="' + esc(st.askText || '') + '" placeholder="' + esc(t.sugg[0]) + '" aria-label="' + t.ask + '"></label>';
    var ornament=S.ui.theme==='clock'?'<div class="compact-clock-wrap">'+art('clock','compact-art compact-clock')+'<span>'+pct+'%</span></div>':'';
    return head + '<div class="cpt'+(ornament&&!st.ask?' illustrated-compact':'')+'">' + (st.ask?'':ornament) + body + stats + bars + ask + '</div>';
  }
  // ---- compact mockup (cmp2): columns whose height is the hours; two clear figures + progress ----
  function cmpStats(v, pct) {
    var t = L();
    return '<div class="cst2"><div><small>' + t.remaining + '</small><b>' + hm(v.remaining, true) + '</b></div>' +
      '<div><small>' + fcLbl(v) + '</small><b class="fc">' + esc(v.thisWeek ? forecastText(v).big : '—') + '</b></div>' +
      '<span class="cbar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></span><span class="cpct">%' + pct + '</span></div>';
  }
  function cmpCols(v) {
    var t = L(), D = v.cfg.D * MIN, top = Math.max(D * 10 / 9, Math.max.apply(null, v.rows.slice(0, 5).map(function (r) { return Math.max(r.val || 0, r.count || 0); })));
    var ref = Math.round(D / top * 100);
    return '<div class="ccols" style="--ref:' + ref + '%">' + v.rows.slice(0, 5).map(function (r, i) {
      var done = r.credit ? 0 : (r.past || r.today ? r.count || 0 : 0), plan = r.credit ? 0 : Math.max(0, (r.val || 0) - done), cr = r.credit ? Math.max(r.credit, r.count || 0) : 0;
      var h = function (ms) { return Math.round(ms / top * 100); }, shown = cr || (done + plan);
      return '<button class="ccol' + (r.today ? ' td' : '') + (st.sel === i ? ' sel' : '') + '" data-a="sel" data-v="' + i + '" title="' + esc(t.daysL[i] + ' · ' + hm(shown)) + '">' +
        '<span class="cbox">' + (cr ? '<i class="cr" style="height:' + h(cr) + '%"></i>' : '<i class="pl" style="height:' + h(done + plan) + '%"></i><i class="dn" style="height:' + h(done) + '%"></i>') + '</span>' +
        '<span class="cdn">' + t.days[i] + '</span><b class="' + (done || cr ? '' : 'p') + '">' + (cr ? hm(cr) : (r.past || r.today) ? hm(done) : plan ? hm(plan) : '—') + '</b></button>';
    }).join('') + '</div>';
  }
  function impPanel() {
    var t = L(), im = st.imp; if (!im) return '';
    var rows = im.items.map(function (it, i) {
      var d = Date.UTC(+it.date.slice(0, 4), +it.date.slice(5, 7) - 1, +it.date.slice(8, 10));
      var lab = it.kind === 'ooo' ? 'OOO ' + mm(it.s) + '–' + mm(it.s + it.m) : t.types[it.kind];
      return '<label><input type="checkbox" data-a="impT" data-v="' + i + '"' + (im.on[i] ? ' checked' : '') + '><b style="font-family:var(--num);white-space:nowrap">' + t.days[C.dow(d)] + ' ' + dl(d) + '</b><span class="pill ' + (it.kind === 'ooo' ? 'gold' : 'ok') + '">' + esc(lab) + '</span><span>' + esc(it.title) + '</span></label>';
    }).join('');
    return '<div class="revp imp"><b>' + esc(t.icsTitle) + '</b>' + (rows ? '<div class="il">' + rows + '</div>' : '<div class="k" style="margin-top:8px">' + esc(t.icsNone) + '</div>') +
      '<div class="acts" style="margin-top:12px">' + (rows ? '<button class="btn pri" data-a="impApply">' + t.apply + '</button>' : '') + '<button class="btn" data-a="impClear">' + t.cancel + '</button></div></div>';
  }
  function notices(v) {
    var t = L(), out = [];
    if (v && st.code === 'nocard') out.push('<span class="pill gray">' + esc(t.nocard) + '</span>');
    if (st.code === 'person' || st.code === 'period') out.push('<button class="pill gold" data-a="focus">' + esc(t[st.code]) + '</button>');
    if (v && st.code === 'loading' && !st.job) out.push('<span class="pill gray"><span class="spin"></span>' + t.loading + '</span>');
    if (st.paged) out.push('<span class="pill bad">' + t.paged + '</span>');
    if (v) {
      v.rows.forEach(function (r) {
        if (!r.mismatch) return;
        out.push('<button class="pill ' + (r.mismatch.use === 'raw' ? 'gold' : 'gray') + '" data-a="sel" data-v="' + r.dow + '" title="' + esc(t.flags.mismatch) + '">⚠ ' + esc(fill(t.mismPill, { d: t.days[r.dow] + ' ' + new Date(r.date).getUTCDate(), p: hm(r.mismatch.portal), r: hm(r.mismatch.raw) })) + '</button>');
      });
      v.rows.forEach(function (r, i) {
        if (!r.past) return;
        var night = r.flags.indexOf('overnight') >= 0, open = r.flags.indexOf('open') >= 0;
        if (night && v.rows[i - 1] && v.rows[i - 1].flags.indexOf('overnight') >= 0) return;   // one pill per pair
        if (night || open) out.push('<button class="pill bad" data-a="sel" data-v="' + r.dow + '" title="' + esc(t.flags[night ? 'overnight' : 'open']) + '">⚠ ' + esc(fill(night ? t.pNight : t.pOpen, { d: t.days[r.dow] + ' ' + new Date(r.date).getUTCDate() })) + '</button>');
      });
      var months = {};
      v.issues.forEach(function (i) { if (i.flag === 'month') months[i.month] = 1; });
      Object.keys(months).forEach(function (mk) {
        var busy = st.job && st.job.target === mk;
        out.push('<button class="pill gold" data-a="loadm" data-m="' + mk + '">' + (busy ? '<span class="spin"></span> ' : '') + t.monL[+mk.slice(5) - 1] + ' ' + (busy ? t.loading.toLowerCase() : t.missing + ' · ' + t.load) + '</button>');
      });
    }
    return out.length ? '<div class="notes">' + out.join('') + '</div>' : '';
  }
  function strip(v) {
    var t = L(), cfg = v.cfg, out = [];
    out.push('<span>' + t.target + ' <b>' + hrs(cfg.W * MIN) + (v.ooo ? ' + OOO ' + hm(v.ooo) + ' = ' + hrs(v.W) : '') + ' ' + t.h + '</b></span>');
    out.push('<span class="vr"></span><button class="wchip" data-a="set" title="' + t.settings + '">' + t.core + ' ' + mm(cfg.coreS) + '–' + mm(cfg.coreE) + '</button>');
    // 3.3: no saved-week chips in the footer; the history button lists saved weeks.
    out.push('<span class="sp"></span>');
    if (st.undo) out.push('<button class="btn" data-a="undo">' + ic('undo', 14) + t.undo + '</button>');
    if (v.thisWeek) out.push('<button class="btn' + (st.rev ? ' pri' : '') + '" data-a="rev">' + ic('rev', 14) + t.reverse + '</button>');
    if (v.thisWeek) out.push('<button class="btn" data-a="wreset" title="' + t.resetWeek + '">' + ic('undo', 14) + t.resetWeek + '</button>');
    return '<div class="strip">' + out.join('') + '</div>';
  }
  var savedCache = { k: '', v: [] };
  function savedWeeks(n) {
    var p = P(); if (!p) return [];
    var now = nowFn(), ck = JSON.stringify([n, C.dkey(now), Object.keys(p.months), p.types, p.ovr, p.ooo, S.cfg, st.fp]);
    if (savedCache.k === ck) return savedCache.v;
    var out = [];
    for (var k = 1; k <= 26 && out.length < n; k++) {
      var w = C.week(dataOf(p), now, S.cfg, storeOf(p), -k);
      var has = w.rows.some(function (r) { return r.loaded; }) && w.done > 0;
      if (!has) continue;
      out.push({ off: -k, lbl: dl(w.ws), done: w.done, W: w.W, ok: w.done >= w.W, color: w.done >= w.W ? 'var(--ok)' : 'var(--bad)', w: w });
    }
    savedCache = { k: ck, v: out };
    return out;
  }
  function summary(v) {
    var t = L(), td = v.today, now = v.now, D = hrs(v.cfg.D * MIN), out = '';
    if (v.goal) {
      var rem = v.goal.t - now;
      out += '<div class="milestone-section"><div class="k">' + goalLbl(v) + '</div><div class="big" style="font-size:50px">' + clk(v.goal.t) + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-top:8px">' + (rem > 0 ? '<span class="pill">' + ic('clock') + dur(rem, true) + ' ' + t.left + '</span>' : '<span class="pill ok">' + ic('check') + t.done + ' +' + hm(-rem) + '</span>') +
        '<button class="ib' + (S.ui.bell ? ' on' : '') + '" data-a="bell" title="' + t.bell + '" aria-label="' + t.bell + '">' + ic('bell', 14) + '</button></div>' + earliestLine(v) + goalAlso(v) + '</div>';
    } else if (v.thisWeek && td && td.credit) {
      out += '<div><div class="k">' + t.today + '</div><div class="big" style="font-size:34px;color:var(--ok)">' + t.types[td.type] + '</div><div class="k" style="margin-top:6px">' + fill(t.credit9, { D: D }) + '</div></div>';
    } else if (v.thisWeek) {
      out += '<div><div class="k">' + t.today + '</div><div class="big" style="font-size:40px">—</div><div class="k" style="margin-top:6px">' + t.noEntry + '</div></div>';
    } else {
      out += '<div><div class="k">' + t.week + '</div><div class="big" style="font-size:44px">' + hm(v.done) + '</div><div class="k">/ ' + hrs(v.W) + ' ' + t.h + '</div></div>';
    }
    if (v.thisWeek) {
      var f = forecastText(v);
      out += '<div class="sec"><div class="k">' + fcLbl(v) + '</div><div class="big" style="font-size:28px;color:' + (v.shortfall ? 'var(--bad)' : 'var(--goldInk)') + '">' + esc(f.big) + '</div><div class="k" style="margin-top:2px">' + esc(f.sub) + '</div></div>';
    }
    var pct = v.W ? Math.min(100, Math.floor(v.done / v.W * 100)) : 100, ppct = v.W ? Math.max(0, Math.min(100 - pct, Math.round((v.total - v.done) / v.W * 100))) : 0;
    out += '<div class="sec"><div style="display:flex;justify-content:space-between"><span class="k">' + t.remaining + '</span><b style="font-size:12px">%' + pct + '</b></div>' +
      '<div class="big" style="font-size:24px;margin-top:1px">' + dur(v.remaining, true) + '</div>' +
      '<div class="bar" style="margin:9px 0 6px"><i style="width:' + pct + '%;background:var(--acc)"></i><i style="left:' + pct + '%;width:' + (v.thisWeek ? ppct : 0) + '%;background:repeating-linear-gradient(90deg,var(--accSoft2) 0 4px,transparent 4px 7px)"></i></div>' +
      '<div class="k">' + dur(v.done) + ' / ' + hrs(v.W) + ' ' + t.h + '</div></div>';
    return '<div class="side">' + out + '</div>';
  }
  // Headline label for today's goal: "9 saat tamamlanır", or "45 saat tamamlanır" on the day the week completes.
  function goalLbl(v, key) { return fill(L()[key || 'milestone'], { D: hrs(v.goal.week ? v.W : v.cfg.D * MIN) }); }
  // When the headline is the week, the daily 9 hours stay visible as a small line.
  function goalAlso(v) { return v.goal && v.goal.week && v.milestone ? '<div class="k goal-also" style="margin-top:5px">' + esc(fill(L().dayAlso, { D: hrs(v.cfg.D * MIN), t: clk(v.milestone) })) + '</div>' : ''; }
  function earliestLine(v) {
    var t = L(), td = v.today; if (!td || !td.office || !td.inside || (v.goal && v.goal.week)) return '';
    var ce = td.date + v.cfg.coreE * MIN;
    if (v.cfg.coreE > v.cfg.coreS && v.now < ce) return '<div class="k earliest" style="margin-top:7px">' + t.earliest + ' <b style="color:var(--ink)">' + clk(ce) + '</b> · ' + t.core.toLowerCase() + '</div>';
    var s2 = C.clone(storeOf(v.p)); s2.plan = s2.plan || {}; s2.plan[td.key] = { e: Math.ceil(minOf(v.now, td.date)) };
    var w2 = C.week(dataOf(v.p), v.now, S.cfg, s2, 0);
    return '<div class="k earliest" style="margin-top:7px">' + t.leaveNow + ' → <b style="color:var(--goldInk)">' + esc(forecastText(w2).big) + '</b></div>';
  }
  // On the day the week completes, the headline already shows that moment; the forecast slot shows when you may leave.
  function fcLbl(v) { return v.goal && v.goal.week && (v.today.end == null || dayOf(Math.max(v.today.end, v.goal.t)) === v.today.dow) ? L().leaveToday : fill(L().forecast, { W: hrs(v.W) }); }
  function forecastText(v) {
    var t = L(), ab = v.absorber;
    if (v.goal && v.goal.week && v.today.end != null) { var la = Math.max(v.today.end, v.goal.t); return { big: (dayOf(la) !== v.today.dow ? t.days[dayOf(la)] + ' ' : '') + clk(la), sub: v.today.held ? t.leaveHeld : '' }; }
    if (v.shortfall) return { big: fill(t.shortfall, { x: dur(v.shortfall, true) }), sub: '' };
    if (v.hit && v.hit.t != null) {
      var sub = ab && ab.held ? t.earliest + ' ' + clk(ab.end) + ' · ' + t.core.toLowerCase() : (v.bank > 0 ? '+' + hm(v.bank) + ' ' + t.bank.toLowerCase() + ' · ' + t.bankNote : '');
      if (v.ooo) sub = fill(t.sc.tgtF, { W: hrs(v.W), B: hrs(v.cfg.W * MIN), x: hm(v.ooo) }) + (sub ? ' · ' + sub : '');
      return { big: t.days[hitDow(v.hit)] + ' ' + clk(v.hit.t), sub: sub };
    }
    if (v.hit) return { big: t.days[v.hit.day.dow] + ' ✓', sub: '' };
    return { big: '—', sub: '' };
  }
  function trange(v) {
    var lo = 24, hi = 0;
    v.rows.forEach(function (r) {
      var a = []; r.segs.forEach(function (s) { a.push(s[0], s[1]); });
      if (r.start != null && r.end != null) a.push(r.start, r.end);
      a.forEach(function (x) { var h = (x - r.date) / H; lo = Math.min(lo, h); hi = Math.max(hi, h); });
    });
    if (lo > hi) { lo = 8; hi = 19; }
    lo = Math.max(0, Math.floor(Math.min(lo, 8))); hi = Math.min(26, Math.ceil(Math.max(hi + 0.6, 19)));
    if ((hi - lo) % 2) hi++;
    return [lo, hi];
  }
  var flagDot = function (r) { var f = r.flags.filter(function (x) { return /^core|overlap/.test(x); }); return f.length ? ' <span title="' + esc(f.map(function (x) { return L().flags[x]; }).join(' · ')) + '" style="color:var(--bad)">●</span>' : ''; };
  function changedDay(v, pv, i) { var a = v.rows[i], b = pv.rows[i]; return a.val !== b.val || a.type !== b.type || (a.end || 0) !== (b.end || 0); }
  function timeline(v, pv) {
    var t = L(), w = pv || v, rg = trange(w), span = rg[1] - rg[0];
    var X = function (r, ms) { return Math.max(0, Math.min(100, ((ms - r.date) / H - rg[0]) / span * 100)); };
    var ticks = '', gl = '';
    for (var h = rg[0]; h <= rg[1]; h += 2) { var x = (h - rg[0]) / span * 100; ticks += '<span style="left:' + x + '%">' + C.pad(h % 24) + '</span>'; gl += '<i class="gl" style="left:' + x + '%"></i>'; }
    var cs = (v.cfg.coreS / 60 - rg[0]) / span * 100, ce = (v.cfg.coreE / 60 - rg[0]) / span * 100;
    var core = v.cfg.coreE > v.cfg.coreS ? '<i class="cb" style="left:' + cs + '%;width:' + (ce - cs) + '%"></i>' : '';
    var rows = w.rows.filter(function (r) { return r.workday || r.actual || r.credit || (r.today && r.plan); }).map(function (r) {
      var i = r.dow, bars = '', lbl = '', val, vc = 'var(--ink)', status = rowStatus(r, w);
      if (r.segs.length) {
        if (r.first != null && r.last != null) bars += '<i class="sp2" style="left:' + X(r, r.first) + '%;width:' + (X(r, r.last) - X(r, r.first)) + '%"></i>';
        r.segs.forEach(function (s) { bars += '<i class="sg" title="' + rec(s[0]) + '–' + rec(s[1]) + '" style="left:' + X(r, s[0]) + '%;width:' + Math.max(0.6, X(r, s[1]) - X(r, s[0])) + '%;' + (r.src === 'manual' ? 'background:repeating-linear-gradient(135deg,var(--acc) 0 3px,var(--accSoft2) 3px 6px)' : '') + '"></i>'; });
      }
      if (r.credit) { var c0 = r.date + v.cfg.start * MIN; bars += '<i class="cr" title="' + hm(r.credit) + '" style="left:' + X(r, c0) + '%;width:' + (X(r, c0 + r.credit) - X(r, c0)) + '%"></i>'; }
      if (w.thisWeek && !r.past && r.end != null && r.plan > r.actual + MIN && !r.credit) {
        var gs = r.today && r.last != null ? (r.inside ? w.now : r.last) : r.start;
        bars += '<i class="gh' + (r.auto ? ' au' : r.planned ? ' pl' : '') + '" style="left:' + X(r, gs) + '%;width:' + Math.max(0.8, X(r, r.end) - X(r, gs)) + '%"></i>';
        var xe = X(r, r.end); lbl = '<span class="el' + (r.auto ? ' au' : '') + (xe > 86 ? ' lft' : '') + '" style="left:' + xe + '%">' + clk(r.end, r.date) + '</span>';
      }
      if (r.ooo && r.ooo.s != null) bars += '<i class="oz" title="OOO" style="left:' + X(r, r.date + r.ooo.s * MIN) + '%;width:' + (X(r, r.date + (r.ooo.s + r.ooo.m) * MIN) - X(r, r.date + r.ooo.s * MIN)) + '%"></i>';
      if (r.today && w.thisWeek) { bars += '<i class="nl" style="left:' + X(r, w.now) + '%"></i>'; if (r.inside) bars += '<i class="lv" role="img" aria-label="' + L().now + ' · ' + clk(w.now) + '" title="' + L().now + ' · ' + clk(w.now) + '" style="left:' + X(r, w.now) + '%"></i>';  }
      if (r.past || !w.thisWeek) { val = r.count ? hm(r.count) : (r.flags.length ? '!' : '0:00'); if (r.flags.length && !r.count) vc = 'var(--bad)'; }
      else if (r.today && !r.credit) { val = hm(r.actual); vc = 'var(--accInk)'; }
      else if (r.credit) { val = hm(r.credit); vc = 'var(--ok)'; }
      else { val = hm(r.plan || 0, true); vc = r.auto ? 'var(--goldInk)' : 'var(--mut)'; }
      var changed = pv && changedDay(v, pv, i);
      return '<button class="tr' + (r.today && w.thisWeek ? ' td' : '') + (st.sel === i ? ' sel' : '') + '" data-a="sel" data-v="' + i + '"' + (changed ? ' style="box-shadow:inset 0 0 0 1.5px var(--gold)"' : '') + '>' +
        '<span class="dn"><b>' + t.days[i] + ' <span>' + new Date(r.date).getUTCDate() + '</span></b><small style="color:' + status.c + '">' + esc(status.s) + flagDot(r) + '</small></span>' +
        '<span class="trk">' + core + gl + bars + lbl + '</span><span class="vv" style="color:' + vc + '">' + val + (/^\d+:\d\d$/.test(val) ? '<small> ' + t.h + '</small>' : '') + '</span></button>';
    }).join('');
    var lg = t.legend;
    return '<div class="tl"><div class="lg"><b style="font-size:12.5px;color:var(--ink)">' + t.week + (pv ? ' · <span style="color:var(--goldInk)">' + t.ask.toLowerCase() + '</span>' : '') + '</b><span class="sp"></span>' +
      '<span><i style="background:var(--acc)"></i>' + lg.office + '</span><span><i style="border:1.5px dashed var(--mut)"></i>' + lg.plan + '</span><span><i style="background:repeating-linear-gradient(135deg,var(--ok) 0 3px,var(--okSoft) 3px 6px)"></i>' + lg.credit + '</span>' +
      '<span><i style="background:repeating-linear-gradient(135deg,var(--gold) 0 3px,transparent 3px 6px)"></i>' + lg.ooo + '</span><span><i style="background:var(--core);outline:1px solid var(--line)"></i>' + lg.core + '</span></div>' +
      '<div class="ax"><span></span><div class="axr">' + ticks + '</div><span></span></div>' + rows + '</div>';
  }
  function columns(v, pv, height) {
    var t = L(), w = pv || v, Hh = height || 214;
    var maxH = Math.max(12, Math.ceil(Math.max.apply(null, w.rows.map(function (r) { return Math.max(r.val || 0, r.count || 0, r.credit || 0) / H; }))) + 1);
    var scale = Hh / (maxH * H), D = v.cfg.D * MIN, ty = Math.round(D * scale);
    var cols = '', labs = '';
    w.rows.slice(0, 5).forEach(function (r, i) {
      var shown = r.past || !w.thisWeek ? r.count : (r.credit ? r.credit : Math.max(r.val || 0, r.actual));
      var h = Math.max(6, Math.round(shown * scale)), cls = 'cs', fillH = 0, gold = 0, top = '';
      if (r.credit) cls += ' xcr';
      else if (r.past || !w.thisWeek) { fillH = Math.round(r.actual * scale); if (r.actual > D) { gold = Math.round((r.actual - D) * scale); fillH = ty; top = '+' + hm(r.actual - D); } }
      else if (r.today) { cls += ' xlvd'; fillH = Math.round(r.actual * scale); }
      else cls += r.auto ? ' xau' : ' xgh';
      var changed = pv && changedDay(v, pv, i);
      if (changed) cls += ' xpl';
      if (r.ooo) top = 'OOO ' + hm(r.ooo.m * MIN);
      var vtxt = r.credit ? t.types[r.type].toLowerCase() + ' ' + hm(r.credit) : (r.past || !w.thisWeek ? hm(r.count) : r.today ? hm(r.actual) + ' / ' + hm(r.plan || 0, true) : hm(r.plan || 0, true));
      cols += '<div class="cl' + (st.sel === i ? ' sel' : '') + '" data-a="sel" data-v="' + i + '" role="button" tabindex="0" aria-label="' + t.daysL[i] + '">' +
        (top ? '<span class="pill gold" style="position:absolute;left:50%;transform:translateX(-50%);bottom:' + (h + 6) + 'px;font-size:11px;padding:2px 7px">' + top + '</span>' : '') +
        '<span class="' + cls + '" style="height:' + h + 'px">' + (fillH ? '<i class="cf" style="height:' + fillH + 'px"></i>' : '') + (gold ? '<i class="cgd" style="bottom:' + ty + 'px;height:' + gold + 'px"></i>' : '') + '</span></div>';
      var st0 = rowStatus(r, w), inS = r.credit ? '—' : r.first != null ? rec(r.first) : r.start != null ? clk(r.start) : '—';
      var outS = r.credit ? '—' : r.past || !w.thisWeek ? (r.last != null ? rec(r.last) : '—') : (r.end != null ? clk(r.end, r.date) : '—');
      var fx = r.past || !w.thisWeek || (r.today && r.first != null);
      labs += '<div><b style="color:' + (r.today && w.thisWeek ? 'var(--acc)' : r.credit ? 'var(--ok)' : r.auto ? 'var(--goldInk)' : 'var(--ink)') + '">' + t.days[i] + ' ' + new Date(r.date).getUTCDate() + '</b>' +
        '<div style="font-size:12.5px;font-weight:800;color:' + st0.c + '">' + esc(vtxt) + flagDot(r) + '</div>' +
        '<div class="io"><span class="' + (r.credit ? 'cr' : fx ? 'fx' : '') + '" title="' + t.in + '">' + inS + '</span><span class="' + (r.credit ? 'cr' : changed ? 'ch' : r.auto ? 'au' : (r.past || !w.thisWeek) ? 'fx' : '') + '" title="' + t.out + '">' + outS + '</span></div></div>';
    });
    return '<div class="cg" style="height:' + Hh + 'px"><i class="tline" style="bottom:' + ty + 'px;right:30px"></i><span class="tlab" style="bottom:' + (ty + 4) + 'px">' + hrs(D) + ' ' + t.h + '</span><div class="cgr">' + cols + '</div></div><div class="clab">' + labs + '</div>';
  }
  // Habits (suggest only): the usual arrival for a day that has no entry and no arrival planned by the user.
  function habitsNow(v) { var p = v && v.p; if (!p) return null; var hk = JSON.stringify(p.months) + C.dkey(v.now) + JSON.stringify(S.cfg) + JSON.stringify(p.types); if (!st.hab || st.hab.at !== hk) st.hab = { at: hk, h: C.habits(dataOf(p), v.now, S.cfg, storeOf(p)) }; return st.hab.h; }
  function habitFor(v, r) {
    if (S.ui.habits === false || !v.thisWeek || !r || r.past || !r.office || r.credit || r.first != null) return null;
    var p = v.p, pl = p.plan[r.key], o = p.ovr[r.key]; if ((pl && pl.s != null) || (o && o.s != null)) return null;
    var h = habitsNow(v); if (!h) return null;
    var hb = h.byDow[r.dow] || (h.n >= 5 ? { start: h.start, n: h.n } : null); if (!hb || hb.start == null) return null;
    if (r.today && minOf(v.now, r.date) > hb.start) return null;           // too late today to arrive at the usual time
    var cur = r.start != null ? minOf(r.start, r.date) : v.cfg.start;
    return Math.abs(hb.start - cur) >= 10 ? hb : null;
  }
  function habitRow(v, r, i) {
    var hb = habitFor(v, r), t = L(); if (!hb) return '';
    var more = v.rows.filter(function (x) { return x !== r && habitFor(v, x); }).length;
    return '<div class="note habit" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">' + ic('clock', 13) + '<span>' + esc(fill(t.habitDay, { d: t.daysL[i], t: mm(hb.start) })) + '</span>' +
      '<button class="btn sm" data-a="habit" data-v="' + hb.start + '">' + t.habitUse + '</button>' + (more ? '<button class="btn sm" data-a="habitAll">' + t.habitAll + '</button>' : '') +
      '<button class="btn sm ghost" data-a="habitOff">' + t.habitHide + '</button></div>';
  }
  // Under Giriş: ARGE's own entry when the user typed a different one, or that ARGE has none yet.
  function argeHint(r, t) {
    var h = r.argeFirst != null ? fill(t.argeWas, { t: rec(r.argeFirst) }) : (r.manual ? t.notInArge : '');
    return h ? ' <span class="ahint">' + esc(h) + '</span>' : '';
  }
  // The day's notes (credit, core hours, warnings) and the ARGE/raw mismatch row; shared by the editor and Saydam.
  function edNotes(v, r, i) {
    var t = L();
    var notes = [], ncls = '';
    if (r.credit) notes.push(fill(t.credit9, { D: hrs(v.cfg.D * MIN) }));
    if (r.held) { notes.push(fill(t.held, { t: mm(v.cfg.coreE) })); ncls = 'warn'; }
    if (r.auto && !r.held) notes.push(fill(t.autoNote, { W: hrs(v.W) }));
    r.flags.forEach(function (f) { if (t.flags[f] && !(f === 'open' && r.flags.indexOf('overnight') >= 0)) { notes.push(t.flags[f]); ncls = /core|open|absent|noentry|overnight/.test(f) ? 'bad' : ncls; } });
    if (v.thisWeek && r.today && r.office && !r.credit && (r.manual || (r.first == null && v.now > r.date + v.cfg.start * MIN))) notes.push(t.lag);
    var mm2 = r.mismatch, mrow = '';
    if (mm2) {
      notes = notes.filter(function (n) { return n !== t.flags.mismatch; });
      mrow = '<div class="note bad" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">⚠ ' + esc(fill(t.mism, { d: t.daysL[i], p: hm(mm2.portal), r: hm(mm2.raw), pf: rec(mm2.pFirst), pl: rec(mm2.pLast), rf: rec(mm2.rFirst), rl: rec(mm2.rLast) })) +
        '<span class="k">' + t.mismUse + '</span><span class="seg"><button data-a="pick" data-v="raw" class="' + (mm2.use === 'raw' ? 'on' : '') + '">' + esc(fill(t.mismRaw, { r: hm(mm2.raw) })) + '</button><button data-a="pick" data-v="portal" class="' + (mm2.use === 'portal' ? 'on' : '') + '">' + esc(fill(t.mismPortal, { p: hm(mm2.portal) })) + '</button></span></div>' +
        '<div class="note">' + esc(fill(mm2.gapIn ? t.mismGap : t.mismNote, { x: hm(Math.abs(mm2.raw - mm2.portal)), d: t.daysL[i] + ' ' + dl(r.date), out: rec(mm2.gapOut), in: rec(mm2.gapIn) })) + '</div>';
    }
    return { notes: notes, ncls: ncls, mrow: mrow };
  }
  function editor(v) {
    if (st.view !== 'week') return '';
    var t = L(), i = st.sel, r = v.rows[i]; if (!r) return '';
    var past = r.past || !v.thisWeek, typeSeg = '';
    var tg = rowStatus(r, v);
    C.TYPES.forEach(function (k) { typeSeg += '<button data-a="type" data-v="' + k + '" class="' + (r.type === k ? 'on' : '') + '">' + t.types[k] + '</button>'; });
    var sMin = r.first != null ? Math.floor((r.first - r.date) / MIN) : (r.start != null ? minOf(r.start, r.date) : v.cfg.start);
    var len = past ? r.count : (r.credit ? r.credit : r.plan);
    var inV = r.credit ? '—' : (r.first != null ? rec(r.first) : r.start != null ? mm(sMin) : '—'), outV = r.credit ? '—' : (past ? rec(r.last) : (r.end != null ? clk(r.end) : '—'));
    var nt = edNotes(v, r, i), notes = nt.notes, ncls = nt.ncls, mrow = nt.mrow, fcast = v.thisWeek ? forecastText(v).big : '';
    return '<div class="ed" data-k="' + r.key + '"><div class="edh"><b>' + t.daysL[i] + ' ' + dl(r.date) + '</b><span class="tag" style="color:' + tg.c + '">' + esc(tg.s) + '</span>' +
      '<span class="seg">' + typeSeg + '</span><span class="sp"></span>' + (v.thisWeek ? '<span class="k">' + fcLbl(v) + ' → <b style="color:var(--goldInk)">' + esc(fcast) + '</b></span>' : '') + '</div>' +
      '<div class="edf"><label class="fl">' + t.in + argeHint(r, t) + '<input class="fi" data-e="s" value="' + inV + '"' + (r.credit ? ' disabled' : '') + ' inputmode="numeric" maxlength="5"></label><span class="op">→</span>' +
      '<label class="fl">' + t.out + '<input class="fi hot" data-e="e" value="' + outV + '"' + (r.credit ? ' disabled' : '') + ' inputmode="numeric" maxlength="5"></label><span class="op">=</span>' +
      '<label class="fl">' + t.len + '<input class="fi" data-e="m" value="' + (len != null ? hm(len, !past) : '') + '"' + (r.credit ? ' disabled' : '') + ' inputmode="decimal" maxlength="5"></label>' +
      '<span style="display:flex;gap:4px;margin-left:6px">' + [-15, -5, 5, 15].map(function (d) { return '<button class="stp" data-a="nud" data-v="' + d + '"' + (r.credit ? ' disabled style="opacity:.4"' : '') + '>' + (d > 0 ? '+' : '−') + Math.abs(d) + '</button>'; }).join('') + '</span>' +
      '<span class="sp"></span><label class="fl">OOO<span class="oo"><button data-a="ooo" data-v="-30" aria-label="OOO −">−</button><b>' + (r.ooo ? hm(r.ooo.m * MIN) : '0:00') + '</b><button data-a="ooo" data-v="30" aria-label="OOO +">+</button></span></label>' +
      (r.ooo ? '<label class="fl">' + t.oooStart + '<input class="fi sm" data-e="os" value="' + (r.ooo.s != null ? mm(r.ooo.s) : '') + '" placeholder="14:00" maxlength="5"></label>' : '') +
      '<button class="ib" data-a="dreset" title="' + t.resetDay + '" aria-label="' + t.resetDay + '" style="align-self:flex-end;margin-bottom:3px">' + ic('undo', 15) + '</button></div>' +
      '<div class="note ' + ncls + '">' + esc(notes.join(' · ')) + '</div>' + mrow + habitRow(v, r, i) + '</div>';
  }
  function askRow(v, chipsOn) {
    var t = L(), a = st.ask;
    var chips = t.sugg.map(function (s, i) { return '<button data-a="sug" data-v="' + i + '" class="' + (a && a.q === s ? 'on' : '') + '">' + esc(s) + '</button>'; }).join('');
    return '<div class="askr"><div class="askf">' + ic('search', 16) + '<input data-e="ask" value="' + esc(st.askText || '') + '" placeholder="' + esc(t.askPh) + '" aria-label="' + t.ask + '"><span class="kbd">⏎</span></div>' + (chipsOn === false ? '' : '<div class="chips">' + chips + '</div>') + '</div>';
  }
  function answerPanel(v, cls) {
    var t = L(), a = answer(v);
    var tags = (a.got && a.tags.length ? '<span class="got">' + esc(t.sc.got) + '</span>' : '') + a.tags.map(function (g) { return '<span class="pill ' + g.k + '">' + esc(g.l) + '</span>'; }).join('');
    return '<div class="ans ' + (cls || '') + '"><div class="kk">' + esc(a.kicker || '') + '</div><div class="bb">' + esc(a.big || '') + '</div>' +
      (a.detail ? '<div class="dd">' + esc(a.detail) + '</div>' : '') + (tags ? '<div class="tags">' + tags + '</div>' : '') +
      (a.confirm ? '<div class="acts"><button class="btn pri" data-a="oooYes">' + t.sc.confYes + '</button><button class="btn" data-a="askClear">' + t.cancel + '</button></div>' :
        a.canApply ? '<div class="acts"><button class="btn pri" data-a="askApply">' + t.apply + '</button><button class="btn" data-a="askClear">' + t.cancel + '</button></div>' : '') + followChips(v) + '</div>';
  }
  // After an answer: a few follow-ups that build on it ("ya 9'da gelirsem", "peki Perşembe izin alırsam", "ya 1 saat OOO alırsam").
  function followChips(v) {
    var a = st.ask, r = a && a.res, t = L(); if (!a || a.err || !st.lastSc || !v || !v.thisWeek) return '';
    var d = r && r.day != null ? r.day : st.lastSc.day; if (d == null || !v.rows[d]) return '';
    var list = [], before = v.rows.filter(function (x) { return x.dow < d && !x.past && x.office && !x.credit && !x.today; }).slice(-1)[0];
    var h = habitsNow(v), hb = h && (h.byDow[d] || (h.n >= 5 ? { start: h.start } : null)), alt = hb && hb.start != null ? hb.start : v.cfg.start === 540 ? 510 : 540;
    if (!(v.rows[d] && v.rows[d].first != null)) list.push(fill(t.fu.arrive, { t: mm(alt) }));
    if (before) list.push(fill(t.fu.leave, { d: t.daysL[before.dow] }));
    list.push(t.fu.ooo);
    return '<div class="chips fup"><span class="got">' + esc(t.fu.label) + '</span>' + list.map(function (q) { return '<button data-a="fup" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>';
  }
  function history() {
    var t = L(), list = savedWeeks(12);
    var rows = list.map(function (h) {
      var pct = Math.min(100, Math.round(h.done / h.W * 100)), diff = h.done - h.W;
      return '<button class="hrow" data-a="goweek" data-v="' + h.off + '"><b>' + esc(fill(t.weekOf, { a: dl(h.w.ws), b: dl(h.w.ws + 4 * DAY) })) + '</b><span class="bar"><i style="width:' + pct + '%;background:' + (h.ok ? 'var(--ok)' : 'var(--acc)') + '"></i></span>' +
        '<span style="font-family:var(--num);font-weight:750">' + hm(h.done) + ' / ' + hrs(h.W) + '</span><span style="color:' + h.color + ';font-weight:750">' + (diff >= 0 ? '+' : '−') + hm(Math.abs(diff)) + '</span></button>';
    }).join('');
    return '<div class="hist"><div class="lg"><b style="font-size:13px;color:var(--ink)">' + t.history + '</b><span class="sp"></span><button class="btn" data-a="thisweek">' + t.thisWeek + '</button></div>' + (rows || '<div class="empty">' + t.noData + '</div>') + '</div>';
  }
  function panelHead(title,kind){return '<div class="panel-head"><b>'+esc(title)+'</b><button class="panel-close" data-a="dismiss" data-panel="'+kind+'" aria-label="'+esc(title+' · '+L().close)+'" title="'+L().close+'">'+ic('x',18)+'</button></div>';}
  // Türk motifleri: an eight-point-star tile band (Seljuk) above, a kilim diamond border below.
  function turkicBands(tier){
    var star='<path d="M15 2.3 18.7 6.1 24 6 24 11.3 27.7 15 24 18.7 24 24 18.7 24 15 27.7 11.3 24 6 24 6 18.7 2.3 15 6 11.3 6 6 11.3 6Z" fill="var(--tile)"/><path d="M15 8 17 10.2 20 10 19.8 13 22 15 19.8 17 20 20 17 19.8 15 22 13 19.8 10 20 10.2 17 8 15 10.2 13 10 10 13 10.2Z" fill="var(--card)"/><rect x="13" y="13" width="4" height="4" transform="rotate(45 15 15)" fill="var(--madder)"/>';
    var kilim='<path d="M0 7 9 0 18 7 9 14Z" fill="var(--madder)"/><path d="M5 7 9 3.8 13 7 9 10.2Z" fill="var(--gold)"/><path d="M9 6 10 7 9 8 8 7Z" fill="var(--card)"/>';
    var band=function(cls,id,w,h,body,k){return '<svg class="tk-band '+cls+'" aria-hidden="true"><defs><pattern id="'+id+'" width="'+w+'" height="'+h+'" patternUnits="userSpaceOnUse" patternTransform="scale('+(k||1)+')">'+body+'</pattern></defs><rect width="100%" height="100%" fill="var(--cobalt)"/><rect width="100%" height="100%" fill="url(#'+id+')"/></svg>';};
    return [band('tk-top','tkStar',30,30,star,tier==='wide'?.8:.6),tier==='wide'?band('tk-bottom','tkKilim',18,14,kilim,.86):''];
  }
  function themePanel(){
    var en=S.ui.lang==='en';
    var t=L(), looks=[['auto',t.autoLook],['light',t.light],['dark',t.dark]].map(function(x){return '<button data-a="look" data-v="'+x[0]+'" class="'+((S.ui.look||'auto')===x[0]?'on':'')+'">'+x[1]+'</button>';}).join('');
    var rows='<div class="appearance-rows"><span class="k">'+t.language+'</span><span class="seg"><button data-a="lang" data-v="tr" class="'+(S.ui.lang!=='en'?'on':'')+'">Türkçe</button><button data-a="lang" data-v="en" class="'+(S.ui.lang==='en'?'on':'')+'">English</button></span><span class="k">'+t.colorMode+'</span>'+((TH.T[S.ui.theme]||{}).lightOnly?'<span class="k">'+t.sy.lightOnly+'</span>':'<span class="seg">'+looks+'</span>')+'</div>';
    if (BUILD.theme !== 'all') return '<section class="theme-panel" aria-label="'+esc(t.look)+'">'+panelHead(t.look,'themes')+'<p><b>'+esc(t.themes[BUILD.theme])+'</b> · '+(en?'Single-theme bookmark':'Tek temalı yer işareti')+'</p>'+rows+'<p><a href="https://berkant-jotform.github.io/mesai/?from='+VERSION+'&theme='+BUILD.theme+'#kurulum" target="_blank" rel="noopener noreferrer">'+(en?'Choose another theme or get all themes':'Başka tema seç veya tüm temaları ekle')+'</a></p></section>';
    return '<section class="theme-panel" aria-label="'+esc(t.look)+'">'+panelHead(t.look,'themes')+'<div class="theme-choices">'+TH.ORDER.map(function(k){var selected=S.ui.theme===k;return '<button class="theme-choice'+(selected?' on':'')+'" data-a="theme" data-v="'+k+'" aria-pressed="'+selected+'"><span class="theme-preview">'+art('preview_'+k+'_'+(isDark()&&!TH.T[k].lightOnly?'dark':'light'),'theme-preview-art')+'</span><span class="theme-choice-title"><b>'+esc(L().themes[k])+'</b><span class="theme-selected">'+(selected?(L().selected):'')+'</span></span></button>';}).join('')+'</div>'+rows+'</section>';
  }
  function dismissPanel(kind){
    var trigger=kind==='themes'?'themes':kind==='settings'?'set':kind==='history'?'hist':kind==='question'?'askOpen':'rev';
    if(kind==='themes'){st.themes=false;if(st.themeReturn){st.set=true;st.themeReturn=false;trigger='set';}}
    if(kind==='settings')st.set=false;
    if(kind==='history')st.view='week';
    if(kind==='question'){S.ui.ask=false;st.ask=null;st.askText='';save();}
    if(kind==='reverse')st.rev=null;
    render(nowFn(),true);var btn=root.querySelector('.hd [data-a="'+trigger+'"],.strip [data-a="'+trigger+'"],.sy [data-a="'+trigger+'"]');if(btn)btn.focus();
  }
  function closeActivePanel(){var kind=st.themes?'themes':st.set?'settings':st.rev?'reverse':S.ui.ask?'question':st.view==='history'?'history':null;if(kind){dismissPanel(kind);return true;}return false;}
  function settings() {
    var t = L(), c = S.cfg;

    var looks = [['auto', t.autoLook], ['light', t.light], ['dark', t.dark]].map(function (x) { return '<button data-a="look" data-v="' + x[0] + '" class="' + (S.ui.look === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('');
    var cores = [['10:00', '16:00'], ['10:00', '15:00'], ['09:00', '16:00']].map(function (x) { var on = c.coreS === x[0] && c.coreE === x[1]; return '<button class="wchip" data-a="core" data-s="' + x[0] + '" data-e="' + x[1] + '" style="' + (on ? 'background:var(--acc);color:var(--card)' : '') + '">' + (+x[0].slice(0, 2)) + '–' + (+x[1].slice(0, 2)) + '</button>'; }).join('');
    return '<div class="set">' + panelHead(t.settings,'settings') +
      '<label class="fl">' + t.weekly + ' (' + t.h + ')<input data-c="W" type="number" min="1" max="100" step="0.5" value="' + c.W + '"></label>' +
      '<label class="fl">' + t.daily + ' (' + t.h + ')<input data-c="D" type="number" min="0.5" max="16" step="0.25" value="' + c.D + '"></label>' +
      '<label class="fl">' + t.defStart + '<input data-c="start" value="' + esc(c.start) + '" maxlength="5"></label>' + habitSettings() +
      '<label class="fl" title="' + t.capOff + '">' + t.cap + ' (' + t.capOff + ')<input data-c="cap" type="number" min="0" max="24" step="0.5" value="' + c.cap + '"></label>' +
      '<label class="fl">' + t.core + '<input data-c="coreS" value="' + esc(c.coreS) + '" maxlength="5"></label><label class="fl">&nbsp;<input data-c="coreE" aria-label="' + esc(t.core + (S.ui.lang === 'en' ? ' end' : ' bitiş')) + '" value="' + esc(c.coreE) + '" maxlength="5"></label>' +
      '<div class="fl" style="grid-column:span 2">&nbsp;<span style="display:flex;gap:6px">' + cores + '</span></div>' +
      '<div class="full"><span class="k">' + t.workdays + '</span><span class="days7">' + t.days.map(function (d, i) { return '<button data-a="wday" data-v="' + i + '" class="' + (c.days.indexOf(i) >= 0 ? 'on' : '') + '">' + d + '</button>'; }).join('') + '</span>' +
      '</div>' +
      holSettings() +
      '<div class="full"><button class="btn" data-a="backup">' + ic('dl', 14) + t.backup + '</button><button class="btn" data-a="restore">' + ic('ul', 14) + t.restore + '</button><span class="sp"></span><span class="k">' + t.version + ' ' + VERSION + (window.__MESAI_BASE ? ' · ↻' : '') + '</span></div></div>';
  }
  function habitSettings() {
    var t = L(), h = st.v && habitsNow(st.v); if (!h || h.n < 5) return '';
    var differs = h.start != null && C.parseClock(S.cfg.start) !== h.start;
    return '<div class="full habit-set"><span class="k">' + esc(fill(t.habitSum, { n: h.n, s: mm(h.start), e: h.end != null ? mm(h.end) : '—' })) + '</span>' +
      (differs ? '<button class="btn sm" data-a="habitDef">' + esc(fill(t.habitDef, { t: mm(h.start) })) + '</button>' : '') +
      '<span class="sp"></span><span class="k">' + t.habitTips + '</span><span class="seg"><button data-a="habitTips" data-v="1" class="' + (S.ui.habits !== false ? 'on' : '') + '">' + t.on + '</button><button data-a="habitTips" data-v="0" class="' + (S.ui.habits === false ? 'on' : '') + '">' + t.off + '</button></span></div>';
  }
  function holSettings() {
    var t = L(), on = S.cfg.hol !== false, today = C.dkey(nowFn());
    var next = Object.keys(HOL.LIST).filter(function (k) { var d = Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)); return k >= today && C.dow(d) < 5; }).slice(0, 3).map(function (k) {
      var d = Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)), h = HOL.LIST[k];
      return '<span class="wchip" style="font-weight:650" title="' + esc(holName(h)) + '">' + dl(d) + ' · ' + esc(holName(h)) + (h.half ? ' · ½' : '') + '</span>';
    }).join('');
    return '<div class="full"><span class="k">' + t.hol + '</span><span class="seg"><button data-a="holT" data-v="1" class="' + (on ? 'on' : '') + '">' + t.holOn + '</button><button data-a="holT" data-v="0" class="' + (on ? '' : 'on') + '">' + t.holOff + '</button></span>' +
      (on && next ? '<span class="k">' + t.holNext + '</span>' + next : '') + '<span class="sp"></span><button class="btn" data-a="ics">' + ic('cal', 14) + esc(t.ics) + '</button></div>' +
      '<div class="full k" style="font-size:11px;line-height:1.45">' + esc(t.holSrc) + ' · ' + esc(t.icsHint) + '</div>';
  }
  function revPanel(v) {
    if (!st.rev || !v.thisWeek) return '';
    var t = L(), rv = st.rev, opts = function (sel, skip) { return v.rows.filter(function (r) { return !r.past && r.office; }).map(function (r) { return '<option value="' + r.dow + '"' + (r.dow === sel ? ' selected' : '') + (r.dow === skip ? ' disabled' : '') + '>' + t.daysL[r.dow] + '</option>'; }).join(''); };
    var res = '', res2 = '';
    var dk = dayKey(v, rv.day), fk = dayKey(v, rv.from), e = parseTime(rv.t);
    st.rev.w = null;
    if (dk && fk && e != null && rv.day !== rv.from) {
      var w = C.reverse(dataOf(v.p), v.now, S.cfg, storeOf(v.p), dk, e, fk), r2 = w.rows[rv.from], r1 = w.rows[rv.day];
      st.rev.w = w;
      res = '<div class="rr" style="margin-top:10px">' + (r2 && r2.end ? '<span class="pill gold" style="font-size:13px">' + esc(fill(t.revStay, { d: t.daysL[rv.from], t: clk(r2.end, r2.date) })) + '</span>' : '') + (r1.held ? '<span class="pill bad">' + esc(fill(t.held, { t: mm(v.cfg.coreE) })) + '</span>' : '') + (w.shortfall ? '<span class="pill bad">' + fill(t.shortfall, { x: dur(w.shortfall, true) }) + '</span>' : '') + '</div>';
    }
    var a2 = parseTime(rv.t2), d2 = v.rows[rv.day2];
    if (a2 != null && d2) { var s = a2 - v.cfg.D, ok2 = s <= v.cfg.coreS; res2 = '<span class="pill ' + (ok2 ? 'ok' : 'bad') + '">' + esc(fill(t.revCome, { t: mm(Math.max(0, s)) })) + (ok2 ? '' : ' · ' + t.flags.coreStart) + '</span>'; }
    return '<div class="revp"><div style="display:flex;align-items:center;justify-content:space-between"><b>' + t.reverse + '</b><button class="ib" data-a="rev" aria-label="' + t.close + '">' + ic('x', 13) + '</button></div>' +
      '<div class="rr"><select data-e="rd" aria-label="' + t.revAria[0] + '">' + opts(rv.day) + '</select><input class="fi sm" data-e="rt" aria-label="' + t.revAria[1] + '" value="' + esc(rv.t) + '" maxlength="5"><span>' + t.revLeave + ',</span><select data-e="rf" aria-label="' + t.revAria[2] + '">' + opts(rv.from, rv.day) + '</select><span>' + t.revFrom + '</span></div>' + res +
      (st.rev.w ? '<div class="acts" style="margin-top:10px"><button class="btn pri" data-a="revApply">' + t.apply + '</button></div>' : '') +
      '<div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px"><b style="font-size:12.5px">' + t.revArrive + '</b><div class="rr"><select data-e="rd2" aria-label="' + t.revAria[3] + '">' + opts(rv.day2) + '</select><input class="fi sm" data-e="rt2" aria-label="' + t.revAria[4] + '" value="' + esc(rv.t2) + '" maxlength="5"><span>' + t.revLeave + '</span>' + res2 + '</div></div></div>';
  }
  function colHead(v, pv) {
    var t = L(), w = pv || v;
    return '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px"><b style="font-size:14px">' + t.week + '</b><span class="k"><b style="color:var(--ink)">' + hm(v.done) + '</b> / ' + hrs(w.W) + ' · ' + t.remaining.toLowerCase() + ' <b style="color:var(--ink)">' + dur(w.remaining, true) + '</b>' + (pv ? ' · <span style="color:var(--goldInk)">' + t.ask.toLowerCase() + '</span>' : '') + '</span></div>';
  }
  function rightPanel(v) {
    var t = L(), td = v.today, D = hrs(v.cfg.D * MIN), f = forecastText(v), out = '';
    if (v.goal) out += '<div><div class="k" style="font-weight:700">' + t.today + ' · ' + goalLbl(v) + '</div><div style="display:flex;align-items:baseline;gap:8px"><span class="big" style="font-size:44px">' + clk(v.goal.t) + '</span><span class="k">' + (v.goal.t > v.now ? dur(v.goal.t - v.now, true) + ' ' + t.left : t.done) + '</span></div>' + earliestLine(v) + goalAlso(v) + '</div>';
    else out += '<div><div class="k" style="font-weight:700">' + (v.thisWeek ? t.today : t.week) + '</div><div class="big" style="font-size:34px">' + (v.thisWeek ? (td && td.credit ? t.types[td.type] : '—') : hm(v.done)) + '</div></div>';
    if (v.thisWeek) out += '<div class="card2" style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--accSoft)"><span class="k" style="font-weight:700">' + fcLbl(v) + '</span><b style="font-size:20px;color:var(--accInk);white-space:nowrap">' + esc(f.big) + '</b></div>';
    if (v.bank > 0) out += '<div class="card2" style="display:flex;align-items:center;gap:10px;background:var(--goldSoft);border:1px solid var(--goldLine)"><span class="coin">+' + Math.round(v.bank / MIN) + '</span><div class="k" style="line-height:1.35"><b style="color:var(--ink);font-size:13px">' + t.bank + ' ' + hm(v.bank) + '</b><br>' + t.bankNote + '</div></div>';
    if (v.thisWeek) out += '<button class="btn" data-a="rev" style="justify-content:center">' + ic('rev', 14) + t.reverse + '</button>';
    return '<div class="rp">' + out + '</div>';
  }
  function suggestions() {
    var t = L(), a = st.ask;
    return '<div class="sugs"><div class="tt">' + t.example + '</div>' + SG().map(function (s, i) { return '<button class="sug' + (a && a.q === s ? ' on' : '') + '" data-a="sug" data-v="' + i + '"><i>' + ic('search', 13) + '</i><span style="flex:1;font-size:13.5px">' + esc(s) + '</span></button>'; }).join('') + '</div>';
  }
  function weekStrip(v, pv) {
    var t = L(), w = pv || v;
    return '<div class="wstrip">' + w.rows.slice(0, 5).map(function (r, i) {
      var s = rowStatus(r, w), txt = r.credit ? fill(t.st.credit, { D: hrs(r.credit) }) : r.past || !w.thisWeek ? hm(r.count) : (r.first != null ? rec(r.first) : r.start != null ? clk(r.start) : '—') + ' → ' + (r.end != null ? clk(r.end, r.date) : '—');
      return '<button class="' + (st.sel === i ? 'sel' : '') + '" data-a="sel" data-v="' + i + '"><div style="display:flex;justify-content:space-between;gap:6px;font-size:12px"><b>' + t.days[i] + ' ' + new Date(r.date).getUTCDate() + '</b><span style="color:' + s.c + ';font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(s.s) + '</span></div><div style="font-size:15px;font-weight:750;margin-top:3px;font-family:var(--num);color:' + (r.auto ? 'var(--goldInk)' : r.credit ? 'var(--ok)' : 'var(--ink)') + '">' + esc(txt) + '</div></button>';
    }).join('') + '</div>';
  }
  function pill(v) {
    if (!S.ui.col) return;
    var a = v && v.goal ? clk(v.goal.t) : v ? hm(v.done) : '…';
    PILL.innerHTML = '<span class="dot' + (v && v.today && v.today.inside ? ' on' : '') + '"></span>' + a + (v ? '<small>%' + Math.floor(Math.min(1, v.done / v.W) * 100) + ' · ' + esc(v.thisWeek ? forecastText(v).big : '') + '</small>' : '');
  }

  // Decode bundled bytes directly: no image/font URL requests on the host page.
  var artCache = {}, artPending = {};
  function embeddedBytes(data) {
    var b64 = data.slice(data.indexOf(',') + 1).replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '=';   // embedded as base64url
    var raw = atob(b64), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }
  function art(name, cls) { return '<canvas class="' + cls + '" data-art="' + name + '" aria-hidden="true"></canvas>'; }
  function bitmap(name) {
    if (artCache[name]) return Promise.resolve(artCache[name]);
    if (!MesaiArt[name]) return Promise.resolve(null);
    var bytes;   // AVIF files carry 'ftypavif' at byte 4
    if (!artPending[name]) artPending[name] = createImageBitmap(new Blob([bytes = embeddedBytes(MesaiArt[name])], {type: bytes[8] === 97 && bytes[9] === 118 ? 'image/avif' : 'image/webp'})).then(function(b) { if(closed){b.close();return null;} artCache[name]=b;return b; });
    return artPending[name];
  }
  function paintArt() {
    if (!window.createImageBitmap) return;
    var pool = st.artPool || {}; st.artPool = null;
    var reuse = function (canvas) { var list = pool[canvas.dataset.art + '|' + canvas.className]; var old = list && list.shift(); if (!old) return false; canvas.replaceWith(old); return true; };
    MAIN.querySelectorAll('canvas[data-art]').forEach(function(canvas) {
      if (reuse(canvas)) return;
      bitmap(canvas.dataset.art).then(function(b) {
        if (!b || !canvas.isConnected) return;
        canvas.width=b.width;canvas.height=b.height;
        canvas.getContext('2d').drawImage(b,0,0);canvas.dataset.painted='true';
      }).catch(function() { /* Opaque surfaces and ordinary control borders remain usable. */ });
    });
    if (S.ui.theme !== 'knight' && S.ui.theme !== 'clock') return;
    MAIN.querySelectorAll('.sg,.sp2,.clock-forecast .bar>i,.pkbar,.cwk i:not(.pl):not(.cr)').forEach(function(el) {
      if(el.classList.contains('sg') && el.parentElement.querySelector('.sp2'))return;
      el.insertAdjacentHTML('afterbegin',art('bar','progress-paint'));
      reuse(el.firstElementChild);
    });
    MAIN.querySelectorAll('.ed .fi,.ed .oo').forEach(function(el) {
      var shell=el;
      if(el.classList.contains('fi')){shell=document.createElement('span');shell.className='control-shell';el.parentNode.insertBefore(shell,el);shell.appendChild(el);}
      shell.insertAdjacentHTML('beforeend',art(isDark()?'controlDark':'controlLight','control-paint'));
    });
    MAIN.querySelectorAll('canvas.progress-paint:not([data-painted]),canvas.control-paint').forEach(function(canvas) {
      bitmap(canvas.dataset.art).then(function(b) {
        if(!b || !canvas.isConnected)return;
        if(canvas.classList.contains('progress-paint')){canvas.width=b.width;canvas.height=b.height;canvas.getContext('2d').drawImage(b,0,0);canvas.dataset.painted='true';return;}
        var rc=canvas.parentElement.getBoundingClientRect();if(rc.width<15||rc.height<7)return;var dpr=Math.min(window.devicePixelRatio||1,2), w=rc.width,h=rc.height;
        canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);var ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
        var sx=[0,28,b.width-28,b.width],sy=[0,10,b.height-10,b.height],dx=[0,7,w-7,w],dy=[0,3,h-3,h];
        for(var y=0;y<3;y++)for(var x=0;x<3;x++)ctx.drawImage(b,sx[x],sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],dx[x],dy[y],dx[x+1]-dx[x],dy[y+1]-dy[y]);
        canvas.dataset.painted='true';canvas.parentElement.classList.add('control-painted');
      }).catch(function(){});
    });
  }
  function heritage(v, pv, lay) {
    if (lay === 'knight') return '<div class="herald-body"><div class="manuscript-main">' + summary(v) + timeline(v,pv) + '</div>' + '</div>' + editor(v);
    var t=L(), td=v.today, daily=!!v.goal, f=forecastText(v), pct=v.W?Math.min(100,Math.floor(v.done/v.W*100)):100;
    var nums='';
    function position(hour, radius) { var a=(hour-14)/24*Math.PI*2;return 'left:'+(49.4+Math.sin(a)*radius)+'%;top:'+(53.6-Math.cos(a)*radius)+'%'; }
    for(var n=1;n<=24;n++) nums+='<span class="dial-number'+(n>=20||n<=6?' night':'')+'" style="'+position(n,34.7)+'">'+n+'</span>';
    var pins='';
    if(v.thisWeek){var nh=(v.now-Math.floor(v.now / DAY) * DAY)/H; pins+='<span class="dial-pin" style="'+position(nh,27.7)+'" title="'+esc(t.today+' '+rec(v.now))+'">'+esc(rec(v.now))+'</span>';}
    if(daily){var mh=(v.goal.t-td.date)/H;pins+='<span class="dial-pin goal" style="'+position(mh,43.3)+'">'+hrs(v.goal.week?v.W:v.cfg.D*MIN)+' '+t.h+'</span>';}
    var label=daily?goalLbl(v):v.thisWeek?t.today:t.week;
    var value=daily?clk(v.goal.t):td&&td.credit?t.types[td.type]:v.thisWeek?'—':hm(v.done);
    var rem=daily?(v.goal.t>v.now?dur(v.goal.t-v.now,true)+' '+t.left:t.done):'';
    return '<div class="clock-body"><div class="dial">'+art('face','dial-face')+art('clock','dial-art')+nums+pins+'<div class="dial-copy"><span class="dial-now">'+(v.thisWeek?(L().now+' ')+rec(v.now):esc(fill(t.weekOf,{a:dl(v.ws),b:dl(v.ws+4*DAY)})))+'</span><div class="k">'+esc(label)+'</div><div class="big">'+esc(value)+'</div><div class="dial-remaining">'+esc(rem)+'</div><span class="dial-today">'+esc(t.today+' '+(td?hm(td.actual||td.credit||0):'—')+' / '+hrs(v.cfg.D*MIN)+' '+t.h)+'</span></div><div class="dial-caption">'+(td&&td.first?esc(t.in+' '+rec(td.first)):'')+'</div></div><div class="clock-forecast"><div class="forecast-block"><div class="k">'+esc(fcLbl(v))+'</div><div class="big" style="color:var(--goldInk)">'+esc(f.big)+'</div><div class="sub">'+esc(f.sub)+'</div>'+earliestLine(v)+'</div><div><div class="k">'+t.remaining+'</div><div class="big weekly-amount">'+dur(v.remaining,true)+'</div><div class="bar" role="progressbar" aria-label="'+esc(t.week)+'" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+pct+'%;background:var(--acc)"></i></div><div class="sub">'+dur(v.done)+' / '+hrs(v.W)+' '+t.h+' · '+pct+'%</div></div>'+art('town','clock-town')+'</div></div>'+weekStrip(v,pv)+editor(v);
  }
  var UPDATE_URL='https://berkant-jotform.github.io/mesai/';
  var latestVersion=null, updateController=null, updateTimer=null, closed=false;
  function versionNewer(a,b){var x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);for(var i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
  function releaseLink(){var en=S.ui.lang==='en', newer=latestVersion&&versionNewer(latestVersion,VERSION);return '<div class="release-row"><a href="'+UPDATE_URL+'?from='+VERSION+'&amp;theme='+BUILD.theme+'" target="_blank" rel="noopener noreferrer" title="'+(L().updHint)+'">Mesai v'+VERSION+'</a>'+(newer?'<a class="update-available" href="'+UPDATE_URL+'?from='+VERSION+'&amp;theme='+BUILD.theme+'" target="_blank" rel="noopener noreferrer">'+(L().updAvail)+' · v'+esc(latestVersion)+'</a>':'')+'</div>';}
  function checkVersion(){
    var cached=null;try{cached=JSON.parse(localStorage.getItem('mesai.release')||'null');}catch(e){}
    if(cached&&/^\d+\.\d+\.\d+$/.test(cached.version)){latestVersion=cached.version;if(Date.now()-cached.at<6*60*60*1000){render(nowFn(),true);return;}}
    if(!window.fetch||!window.AbortController)return;updateController=new AbortController();updateTimer=setTimeout(function(){if(updateController)updateController.abort();},4500);
    fetch(UPDATE_URL+'version.json',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:updateController.signal}).then(function(r){if(!r.ok)throw Error('version');return r.json();}).then(function(v){if(closed||!/^\d+\.\d+\.\d+$/.test(v.version))return;latestVersion=v.version;try{localStorage.setItem('mesai.release',JSON.stringify({version:v.version,at:Date.now()}));}catch(e){}render(nowFn(),true);}).catch(function(){/* The permanent version link works when the portal blocks a remote check. */}).finally(function(){clearTimeout(updateTimer);updateController=null;});
  }

  // ---------------- main render ----------------
  // ---------------- Saydam (Apple Liquid Glass, light only): sidebar of days + one selected day, or the week as an hourglass ----------------
  var SYI = { hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>', look: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/><path d="M12 21c-1.5 0-2-1-2-2s1-2 2-2h2a3 3 0 0 0 3-3"/>',
    set: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>', rev: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>', reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', l: '<path d="M15 18l-6-6 6-6"/>', r: '<path d="M9 6l6 6-6 6"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>' };
  function syIc(n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + SYI[n] + '</svg>'; }
  // What a day shows: [ms, kind] — kind is off (leave/holiday), done, live (today) or plan.
  function syVal(r, w) { return r.credit ? [r.credit, 'off'] : (r.past || !w.thisWeek) ? [r.count, 'done'] : r.today ? [r.actual, 'live'] : [r.plan || 0, 'plan']; }
  var syShown = function (r) { return r.workday || r.actual || r.credit || (r.today && r.plan); };
  function sySide(v, w) {
    var t = L(), y = t.sy, D = v.cfg.D * MIN;
    var days = w.rows.filter(syShown).map(function (r) {
      var i = r.dow, x = syVal(r, w), s = rowStatus(r, w), pct = Math.min(100, Math.round(x[0] / D * 100)), bad = /bad/.test(s.c);
      var gp = x[1] === 'live' ? Math.min(100, Math.round((r.plan || 0) / D * 100)) : 0;
      var vt = x[0] ? hm(x[0], x[1] === 'plan') : (r.past && r.flags.length ? '!' : '—');
      return '<button class="sy-day ' + x[1] + (st.sel === i ? ' on' : '') + (r.today && w.thisWeek ? ' td' : '') + (w !== v && changedDay(v, w, i) ? ' ch' : '') + '" data-a="sel" data-v="' + i + '" aria-pressed="' + (st.sel === i) + '">' +
        '<b>' + (tierOf() === 'compact' ? t.days[i] : t.daysL[i]) + ' <em>' + new Date(r.date).getUTCDate() + '</em></b><small' + (bad ? ' class="warnc"' : '') + '>' + esc(s.s) + '</small><span>' + vt + '</span>' +
        '<i>' + (gp ? '<u class="g" style="width:' + gp + '%"></u>' : '') + '<u style="width:' + pct + '%"></u></i></button>';
    }).join('');
    var pct = v.W ? Math.min(100, Math.floor(v.done / v.W * 100)) : 100, ppct = v.thisWeek && v.W ? Math.max(0, Math.min(100 - pct, Math.round((v.total - v.done) / v.W * 100))) : 0, f = v.thisWeek ? forecastText(v) : null;
    var foot = '<div class="sy-foot"><div class="ft">' + (v.thisWeek ? t.thisWeek : t.week) + '</div><div class="fn">' + hm(v.done) + ' <small>/ ' + hrs(v.W) + ' ' + t.h + '</small></div>' +
      '<div class="sy-meter" role="progressbar" aria-label="' + esc(t.week) + '" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><u style="width:' + pct + '%"></u><u class="g" style="left:' + pct + '%;width:' + ppct + '%"></u></div>' +
      '<div class="fe">' + t.remaining + ' <b>' + dur(v.remaining, true) + '</b>' + (f ? '<br>' + fcLbl(v) + ' <b' + (v.shortfall ? ' class="warnc"' : '') + '>' + esc(f.big) + '</b>' + (f.sub ? '<br><span class="fsub">' + esc(f.sub) + '</span>' : '') : '') + '</div>' +
      '<div class="fe">' + t.target + ' ' + hrs(v.cfg.W * MIN) + (v.ooo ? ' + OOO ' + hm(v.ooo) + ' = ' + hrs(v.W) : '') + ' ' + t.h + ' · <button class="lnk" data-a="set">' + t.core + ' ' + mm(v.cfg.coreS) + '–' + mm(v.cfg.coreE) + '</button></div>' + (v.thisWeek ? '<div class="fe"><button class="lnk" data-a="wreset">' + syIc('reset') + t.resetWeek + '</button></div>' : '') + releaseLink() + '</div>';
    var wk = fill(t.weekOf, { a: dl(v.ws), b: dl(v.ws + 4 * DAY) }), lt = y.lights, cmp = tierOf() === 'compact';
    return '<aside class="sy-sb"><div class="sy-top" data-drag><div class="lights"><button class="lc" data-a="close" aria-label="' + esc(t.closeMesai) + '" title="' + esc(lt.close) + '"></button><button class="lm" data-a="min" aria-label="' + esc(lt.min) + '" title="' + esc(lt.min) + '"></button><button class="lx" data-a="' + (cmp ? 'cmpx' : 'cmp') + '" aria-label="' + esc(cmp ? t.expand : lt.cmp) + '" title="' + esc(cmp ? t.expand : lt.cmp) + ' (Alt+K)"></button></div>' +
      '<div class="wnav"><h2><span class="dot' + (liveOf(v) ? ' on' : '') + '"></span>Mesai</h2><div class="cap"><button data-a="prev" aria-label="' + y.prev + '" title="' + y.prev + '">' + syIc('l') + '</button><button data-a="next" aria-label="' + y.next + '" title="' + y.next + '"' + (st.off >= 0 ? ' disabled' : '') + '>' + syIc('r') + '</button></div></div>' +
      '<div class="wsub">' + esc(wk) + (st.name ? ' · ' + esc(st.name.replace(/^\s*\d+\s*[-–:]\s*/, '')) : '') + '</div></div>' +
      '<nav class="sy-days" aria-label="' + esc(t.week) + '">' + days + '</nav>' + foot + '</aside>';
  }
  // Headline for the selected day: kicker, big value, chips.
  function syHead(v, r) {
    var t = L(), y = t.sy, D = v.cfg.D * MIN, k, big, chips = [], extra = '', f = v.thisWeek ? forecastText(v) : null;
    var fc = function () { if (f) chips.push([fcLbl(v) + ' ' + f.big, v.shortfall ? 'o' : 'g']); };
    if (r.credit) { k = fill(t.credit9, { D: hrs(D) }); big = r.hol && r.type === 'tatil' ? holName(r.hol) : t.types[r.type]; fc(); }
    else if (r.today && v.thisWeek && v.goal) {
      var rem = v.goal.t - v.now; k = goalLbl(v); big = clk(v.goal.t);
      chips.push(rem > 0 ? [dur(rem, true) + ' ' + t.left, ''] : [t.done + ' +' + hm(-rem), 'g']); fc();
      extra = earliestLine(v) + goalAlso(v);
    } else if (r.past || !v.thisWeek) {
      k = y.worked; big = hm(r.count || 0);   // the status is already under the title
      if (r.first != null) chips.push(r.last != null ? [rec(r.first) + ' – ' + rec(r.last), ''] : [t.in + ' ' + rec(r.first) + ' · ' + t.out + ' ?', 'o']);
    } else if (r.office) {
      k = r.today ? t.today + ' · ' + y.planned.toLowerCase() : y.planned; big = r.end != null ? clk(r.end, r.date) : '—';
      if (r.start != null && r.end != null) chips.push([clk(r.start) + ' – ' + clk(r.end, r.date) + ' · ' + hm(r.plan || 0, true), '']);
      if (r.today && r.first == null) chips.push([t.noEntry, 'o']);
      fc();
    } else { k = y.offDay; big = '—'; }
    return '<div class="sy-k">' + esc(k) + '</div><div class="sy-big">' + esc(big) + '</div><div class="sy-chips">' + chips.map(function (c) { return '<span class="chip ' + c[1] + '">' + esc(c[0]) + '</span>'; }).join('') + '</div>' + extra;
  }
  function syHero(v, r) {
    var t = L(), D = v.cfg.D * MIN, x = syVal(r, v), c1 = 414.69, c2 = 295.31;
    var d1 = Math.min(1, x[0] / D) * c1, d2 = Math.min(1, v.W ? v.done / v.W : 1) * c2;
    return '<div class="sy-hero"><div class="ring" role="img" aria-label="' + esc(hm(x[0]) + ' / ' + hrs(D) + ' ' + t.h + ' · ' + t.week + ' ' + hm(v.done) + ' / ' + hrs(v.W)) + '"><svg viewBox="0 0 156 156" aria-hidden="true"><defs>' +
      '<linearGradient id="syR1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ac8fa"/><stop offset="1" stop-color="#0060df"/></linearGradient>' +
      '<linearGradient id="syR2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#b5ec6c"/><stop offset="1" stop-color="#28b04a"/></linearGradient></defs>' +
      '<circle cx="78" cy="78" r="66" fill="none" stroke="rgba(120,120,128,.14)" stroke-width="14"/><circle cx="78" cy="78" r="72.5" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1"/>' +
      (d1 > 0 ? '<circle class="' + (x[1] === 'plan' ? 'pl' : '') + '" cx="78" cy="78" r="66" fill="none" stroke="' + (x[1] === 'off' ? '#ff9f0a' : 'url(#syR1)') + '" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + d1.toFixed(1) + ' ' + c1 + '"/>' +
        '<circle cx="78" cy="78" r="66" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + d1.toFixed(1) + ' ' + c1 + '" transform="translate(0 -3)"/>' : '') +
      '<circle cx="78" cy="78" r="47" fill="none" stroke="rgba(120,120,128,.14)" stroke-width="10"/>' +
      (d2 > 0 ? '<circle cx="78" cy="78" r="47" fill="none" stroke="url(#syR2)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + d2.toFixed(1) + ' ' + c2 + '"/>' : '') +
      '</svg><div class="rc"><b>' + (x[0] ? hm(x[0], x[1] === 'plan') : '0:00') + '</b><small>/ ' + hrs(D) + ' ' + t.h + '</small></div></div><div class="hx">' + syHead(v, r) + '</div></div>';
  }
  function syLine(v, r) {
    var t = L(), y = t.sy, p = v.p, rg = trange(v), span = rg[1] - rg[0], k = r.key;
    var X = function (ms) { return Math.max(0, Math.min(100, ((ms - r.date) / H - rg[0]) / span * 100)); };
    var edit = v.thisWeek && !r.past && !r.credit && r.office, ax = '', bars = '', h;
    for (h = rg[0]; h <= rg[1]; h += 2) ax += '<span style="left:' + (h - rg[0]) / span * 100 + '%">' + C.pad(h % 24) + '</span>';
    if (v.cfg.coreE > v.cfg.coreS) { var cs = (v.cfg.coreS / 60 - rg[0]) / span * 100, ce = (v.cfg.coreE / 60 - rg[0]) / span * 100; bars += '<i class="sy-core" style="left:' + cs + '%;width:' + (ce - cs) + '%"></i>'; }
    if (r.credit) { var c0 = r.date + v.cfg.start * MIN; bars += '<i class="bgb off" style="left:' + X(c0) + '%;width:' + (X(c0 + r.credit) - X(c0)) + '%"></i>'; }
    if (v.thisWeek && !r.past && r.end != null && r.plan > r.actual + MIN && !r.credit) { var gs = r.today && r.last != null ? (r.inside ? v.now : r.last) : r.start; bars += '<i class="bgb plan' + (r.auto ? ' au' : '') + '" style="left:' + X(gs) + '%;width:' + Math.max(0.8, X(r.end) - X(gs)) + '%"></i>'; }
    if (r.ooo && r.ooo.s != null) bars += '<i class="bgb ooo" title="OOO" style="left:' + X(r.date + r.ooo.s * MIN) + '%;width:' + (X(r.date + (r.ooo.s + r.ooo.m) * MIN) - X(r.date + r.ooo.s * MIN)) + '%"></i>';
    r.segs.forEach(function (s) { bars += '<i class="fg' + (r.src === 'manual' ? ' man' : '') + '" title="' + rec(s[0]) + '–' + rec(s[1]) + '" style="left:' + X(s[0]) + '%;width:' + Math.max(0.6, X(s[1]) - X(s[0])) + '%"></i>'; });
    if (r.today && v.thisWeek) bars += '<i class="sy-now" title="' + t.now + ' · ' + clk(v.now) + '" style="left:' + X(v.now) + '%"></i>';
    if (edit && r.end != null) bars += '<i class="knob" style="left:' + X(r.end) + '%"></i>';
    var edited = p.plan[k] || p.ovr[k] || p.types[k] || p.ooo[k], lg = t.legend;
    var trk = '<div class="sy-trk' + (edit ? '' : ' ro') + '"' + (edit ? ' data-a="syt" data-lo="' + rg[0] + '" data-span="' + span + '" role="slider" tabindex="0" aria-label="' + esc(t.out) + '" aria-valuemin="' + rg[0] * 60 + '" aria-valuemax="' + rg[1] * 60 + '" aria-valuenow="' + (r.end != null ? Math.round((r.end - r.date) / MIN) : 0) + '" aria-valuetext="' + (r.end != null ? clk(r.end, r.date) : '—') + '" title="' + esc(y.tlHint) + '"' : '') + '>' + bars + '</div>';
    return '<div class="sy-tl"><div class="tlh"><span>' + y.dayLine + '</span>' + (edit ? '<small>' + y.tlHint + '</small>' : '') + '<span class="sy-sp"></span>' +
      (r.ooo ? '<label class="oos">OOO ' + t.oooStart.toLowerCase() + '<input class="tin" data-e="os" value="' + (r.ooo.s != null ? mm(r.ooo.s) : '') + '" placeholder="14:00" maxlength="5" inputmode="numeric"></label>' : '') +
      (edited ? '<button class="lnk" data-a="dreset">' + syIc('reset') + t.resetDay + '</button>' : '') + '</div>' +
      '<div class="sy-ax">' + ax + '</div>' + trk +
      '<div class="leg"><span><i class="l-fg"></i>' + lg.office + '</span><span><i class="l-pl"></i>' + lg.plan + '</span><span><i class="l-off"></i>' + lg.credit + '</span><span><i class="l-oo"></i>' + lg.ooo + '</span><span><i class="l-core"></i>' + lg.core + ' ' + mm(v.cfg.coreS) + '–' + mm(v.cfg.coreE) + '</span></div></div>';
  }
  // The week as an hourglass: the bottom fills with what is worked, the top holds what is left; planned days are bands, the rest is "Plansız".
  function syKum(v, w, r) {
    var t = L(), y = t.sy, Wt = w.W || 1, HH = 266, sc = function (ms) { return HH * Math.min(Math.max(ms, 0), Wt) / Wt; };
    var done = w.done, left = w.remaining, botY = 596 - sc(done), topY = 320 - sc(left), bot = '', top = '', Lb = [], Rb = [], cum = 0, fut = 0, gap = 0;
    w.rows.forEach(function (d) {
      var c = (d.past || d.today || !w.thisWeek) ? d.count : 0; if (!(c > 0)) return;
      var y0 = 596 - sc(cum); cum += c; var y1 = 596 - sc(cum), live = d.today && d.inside && w.thisWeek;
      bot += '<rect class="band' + (st.sel === d.dow ? ' sel' : d.credit ? ' off' : d.dow % 2 ? '' : ' alt') + '" data-a="sel" data-v="' + d.dow + '" x="0" y="' + y1.toFixed(1) + '" width="360" height="' + Math.max(0, y0 - y1).toFixed(1) + '"/>';
      Lb.push({ m: (y0 + y1) / 2, d: d.dow, cls: st.sel === d.dow ? 'tsel' : live ? 'tnow' : '', t: t.days[d.dow] + ' ' + hm(c) + (d.credit ? ' · ' + t.types[d.type].toLowerCase() : live ? ' · ' + t.now.toLowerCase() : '') });
    });
    if (w.thisWeek) w.rows.forEach(function (d) {
      if (d.past) return;
      var add = d.today ? Math.max(0, (d.val || 0) - d.count) : (d.val || 0);
      if (add <= 0 || fut >= left - 1e-9) return;
      var a0 = fut; fut = Math.min(left, fut + add);
      var y0 = 320 - sc(a0), y1 = 320 - sc(fut), fin = fut >= left - 1e-9 && !w.shortfall;
      top += '<rect class="band' + (st.sel === d.dow ? ' sel' : d.dow % 2 ? '' : ' alt') + '" data-a="sel" data-v="' + d.dow + '" x="0" y="' + y1.toFixed(1) + '" width="360" height="' + Math.max(0, y0 - y1).toFixed(1) + '"/>';
      Rb.push({ m: (y0 + y1) / 2, d: d.dow, cls: st.sel === d.dow ? 'tsel' : '', t: t.days[d.dow] + ' +' + hm(fut - a0, true) + (d.credit ? ' · ' + t.types[d.type].toLowerCase() : d.end != null ? ' → ' + clk(d.end, d.date) : '') + (fin ? ' · ' + y.lastDrop.toLowerCase() : '') });
    });
    gap = w.thisWeek ? Math.max(0, left - fut) : 0;
    var gapY = 320 - sc(left), gapH = sc(left) - sc(fut);
    if (gap > MIN) Rb.push({ m: gapY + gapH / 2, a: 'rev', cls: 'twarn', t: y.unplanned + ' ' + hm(gap, true) });
    if (left > 0) Rb.push({ m: topY - 14, cls: 'tnow', t: y.left + ' ' + hm(left, true) });
    Rb.push({ m: botY, cls: 'tnow', t: 'Σ ' + hm(done) });
    // labels never overlap: keep at least 19 units between neighbours, leads bend to their band
    var place = function (arr) { arr.sort(function (a, b) { return a.m - b.m; }); var prev = -1e9; arr.forEach(function (l) { l.y = Math.max(l.m + 6, prev + 24); prev = l.y; }); return arr; };
    var lab = function (l, x, anchor, lead) { return '<path d="' + lead + '" fill="none" stroke="rgba(60,60,67,.35)" stroke-width="1"/><text class="' + l.cls + '" x="' + x + '" y="' + l.y.toFixed(1) + '" text-anchor="' + anchor + '"' + (l.d != null ? ' data-a="sel" data-v="' + l.d + '"' : l.a ? ' data-a="' + l.a + '"' : '') + '>' + esc(l.t) + '</text>'; };
    var labels = place(Lb).map(function (l) { return lab(l, -26, 'end', 'M-18 ' + (l.y - 6).toFixed(1) + ' L-6 ' + l.m.toFixed(1) + ' H100'); }).join('') +
      place(Rb).map(function (l) { return lab(l, 382, 'start', 'M' + (l.m < 320 ? 262 : 270) + ' ' + l.m.toFixed(1) + ' H362 L374 ' + (l.y - 6).toFixed(1)); }).join('');
    var V = 'M74 46 H286 C286 150 218 258 188 318 C218 382 286 490 286 594 H74 C74 490 142 382 172 318 C142 258 74 150 74 46 Z';
    var flowing = w.thisWeek && w.today && w.today.inside && left > 0;
    var f = w.thisWeek ? forecastText(w) : null;
    var small = tierOf() === 'compact', svg = '<svg viewBox="' + (small ? '-40 0 440 660' : '-240 0 960 660') + '" role="img" aria-label="' + esc(fill(y.kumAria, { d: hm(done), W: hrs(Wt) })) + '"><defs>' +
      '<clipPath id="syV"><path d="' + V + '"/></clipPath>' +
      '<linearGradient id="syLq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ad3ff"/><stop offset=".55" stop-color="#2a8cf0"/><stop offset="1" stop-color="#0a5fd0"/></linearGradient>' +
      '<linearGradient id="syLp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fdcff" stop-opacity=".75"/><stop offset="1" stop-color="#4aa8f5" stop-opacity=".75"/></linearGradient>' +
      '<pattern id="syHt" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="rgba(255,149,0,.18)"/><rect width="3" height="8" fill="rgba(255,149,0,.5)"/></pattern>' +
      '<linearGradient id="syGl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".22" stop-color="#fff" stop-opacity=".08"/><stop offset=".78" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".45"/></linearGradient>' +
      '<linearGradient id="sySh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#002a70" stop-opacity=".38"/><stop offset=".18" stop-color="#002a70" stop-opacity=".06"/><stop offset=".32" stop-color="#fff" stop-opacity=".28"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#002a70" stop-opacity=".08"/><stop offset="1" stop-color="#002a70" stop-opacity=".4"/></linearGradient>' +
      '<linearGradient id="syRd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#dfe6f2" stop-opacity=".8"/><stop offset="1" stop-color="#b9c4d6" stop-opacity=".8"/></linearGradient>' +
      '<linearGradient id="syCp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#dfe5ef"/></linearGradient>' +
      '<radialGradient id="syHa" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="syCa" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2a8cf0" stop-opacity=".4"/><stop offset="1" stop-color="#2a8cf0" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="180" cy="320" rx="230" ry="300" fill="url(#syHa)"/><ellipse cx="180" cy="636" rx="176" ry="15" fill="url(#syCa)"/><ellipse cx="180" cy="626" rx="120" ry="5" fill="rgba(15,25,50,.18)"/>' +
      '<path d="' + V + '" fill="rgba(255,255,255,.22)"/><g clip-path="url(#syV)">' +
      (gap > MIN ? '<rect x="0" y="' + gapY.toFixed(1) + '" width="360" height="' + Math.max(0, gapH).toFixed(1) + '" fill="url(#syHt)"/>' : '') +
      (left > 0 ? '<rect x="0" y="' + (320 - sc(fut)).toFixed(1) + '" width="360" height="' + (sc(fut) + 2).toFixed(1) + '" fill="url(#syLp)"/>' + top + '<ellipse cx="180" cy="' + (320 - sc(fut)).toFixed(1) + '" rx="140" ry="4" fill="#d6f0ff" opacity=".9"/>' : '') +
      (done > 0 ? '<rect x="0" y="' + botY.toFixed(1) + '" width="360" height="' + (600 - botY).toFixed(1) + '" fill="url(#syLq)"/>' + bot + '<ellipse cx="180" cy="' + botY.toFixed(1) + '" rx="140" ry="6" fill="#bfe7ff" opacity=".95"/>' : '') +
      '<rect x="0" y="0" width="360" height="600" fill="url(#sySh)" pointer-events="none"/>' +
      (done > 0 ? '<circle class="bub" cx="146" cy="580" r="3" fill="#fff" opacity=".6"/><circle class="bub b2" cx="214" cy="566" r="2" fill="#fff" opacity=".6"/><circle class="bub b3" cx="190" cy="586" r="2.5" fill="#fff" opacity=".55"/>' : '') + '</g>' +
      (flowing ? '<path d="M180 318 V' + (botY - 2).toFixed(1) + '" stroke="#2a8cf0" stroke-width="2.5" stroke-linecap="round" opacity=".8"/><circle class="drop" cx="180" cy="326" r="3.5" fill="#5ac8fa" style="--fall:' + Math.max(0, botY - 332).toFixed(0) + 'px"/><circle class="drop d2" cx="180" cy="326" r="3" fill="#5ac8fa" style="--fall:' + Math.max(0, botY - 332).toFixed(0) + 'px"/>' : '') +
      '<g pointer-events="none"><path d="' + V + '" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="10"/><path d="' + V + '" fill="none" stroke="rgba(30,50,90,.22)" stroke-width="6.5"/><path d="' + V + '" fill="url(#syGl)" stroke="#fff" stroke-width="2.4"/>' +
      '<rect x="34" y="40" width="9" height="560" rx="4.5" fill="url(#syRd)" stroke="rgba(30,50,90,.18)" stroke-width=".8"/><rect x="317" y="40" width="9" height="560" rx="4.5" fill="url(#syRd)" stroke="rgba(30,50,90,.18)" stroke-width=".8"/>' +
      '<path d="M94 72 C96 150 130 236 162 296" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"/><path d="M268 80 C264 140 240 200 214 250" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".5"/><path d="M94 570 C96 500 124 420 160 352" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>' +
      '<rect x="22" y="18" width="316" height="30" rx="15" fill="url(#syCp)" stroke="rgba(30,50,90,.2)" stroke-width=".8"/><rect x="36" y="22" width="288" height="7" rx="3.5" fill="#fff" opacity=".95"/><rect x="22" y="592" width="316" height="30" rx="15" fill="url(#syCp)" stroke="rgba(30,50,90,.2)" stroke-width=".8"/><rect x="36" y="596" width="288" height="7" rx="3.5" fill="#fff" opacity=".95"/></g>' +
      (small ? '' : labels) + '</svg>';
    return '<div class="sy-kum"><div class="kt"><div class="sy-kday">' + t.daysL[r.dow] + ' ' + dl(r.date) + '</div>' + syHead(v, r) + '<div class="sy-knote">' + esc(fill(y.kumNote, { l: dur(left, true), d: hm(done) })) + (f ? ' ' + y.lastDrop + ': <b>' + esc(f.big) + '</b>.' : '') + '</div>' +
      '<div class="sy-legend"><span><i class="l-fg"></i>' + t.legend.office + '</span><span><i class="l-pl"></i>' + t.legend.plan + '</span><span><i class="l-gap"></i>' + y.unplanned.toLowerCase() + '</span></div></div>' + svg + '</div>';
  }
  function syBar(v, r) {
    var t = L(), past = r.past || !v.thisWeek, dis = r.credit ? ' disabled' : '', seg = '';
    C.TYPES.forEach(function (k) { seg += '<button data-a="type" data-v="' + k + '" class="' + (r.type === k ? 'on' : '') + '" aria-pressed="' + (r.type === k) + '">' + t.types[k] + '</button>'; });
    var sMin = r.first != null ? Math.floor((r.first - r.date) / MIN) : (r.start != null ? minOf(r.start, r.date) : v.cfg.start);
    var inV = r.credit ? '—' : (r.first != null ? rec(r.first) : r.start != null ? mm(sMin) : '—'), outV = r.credit ? '—' : (past ? rec(r.last) : (r.end != null ? clk(r.end) : '—'));
    var stp = function (lbl, a, dv, inner, off) { return '<div class="sy-stp"><button data-a="' + a + '" data-v="-' + dv + '" aria-label="' + lbl + ' −' + dv + '"' + off + '>−</button><span class="sv"><small>' + lbl + '</small>' + inner + '</span><button data-a="' + a + '" data-v="' + dv + '" aria-label="' + lbl + ' +' + dv + '"' + off + '>+</button></div>'; };
    var inp = function (k, val, lbl) { return '<input class="tin" data-e="' + k + '" value="' + val + '"' + dis + ' inputmode="numeric" maxlength="5" aria-label="' + lbl + '">'; };
    return '<div class="sy-bar sy-gl"><div class="seg" role="group" aria-label="' + t.type + '">' + seg + '</div>' +
      stp(t.in, 'nuds', 15, inp('s', inV, t.in) + argeHint(r, t), dis) + stp(t.out, 'nud', 15, inp('e', outV, t.out), dis) + stp('OOO', 'ooo', 30, '<b>' + (r.ooo ? hm(r.ooo.m * MIN) : '0:00') + '</b>', '') +
      '<span class="sy-sp"></span>' + (st.undo ? '<button class="ibtn" data-a="undo" aria-label="' + t.undo + '" title="' + t.undo + '">' + syIc('undo') + '</button>' : '') +
      (v.thisWeek ? '<button class="txt' + (st.rev ? ' on' : '') + '" data-a="rev" aria-label="' + esc(t.reverse) + '" title="' + esc(t.reverse) + '" aria-expanded="' + !!st.rev + '">' + syIc('rev') + t.reverse + '</button>' : '') + '</div>';
  }
  function syView(v, pv) {
    var t = L(), y = t.sy, w = pv || v, i = st.sel, r = v.rows[i] || v.rows[0], kum = S.ui.syv === 'kum', s = rowStatus(r, v);
    var tb = '<div class="sy-tb" data-drag><div class="vseg sy-gl" role="group" aria-label="' + y.view + '">' + [['day', y.day], ['kum', y.kum]].map(function (b) { var on = (b[0] === 'kum') === kum; return '<button data-a="syv" data-v="' + b[0] + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '">' + b[1] + '</button>'; }).join('') + '</div><span class="sy-sp"></span>' +
      '<div class="grp sy-gl"><button class="' + (st.view === 'history' ? 'on' : '') + '" data-a="hist" aria-label="' + t.history + '" title="' + t.history + '">' + syIc('hist') + '</button><button class="' + (st.themes ? 'on' : '') + '" data-a="themes" aria-expanded="' + !!st.themes + '" aria-label="' + t.look + '" title="' + t.look + '">' + syIc('look') + '</button><button class="' + (st.set ? 'on' : '') + '" data-a="set" aria-label="' + t.settings + '" title="' + t.settings + '">' + syIc('set') + '</button></div>' +
      '<div class="grp sy-gl"><button data-a="lang" data-v="tr" class="' + (S.ui.lang !== 'en' ? 'on' : '') + '" aria-pressed="' + (S.ui.lang !== 'en') + '">TR</button><button data-a="lang" data-v="en" class="' + (S.ui.lang === 'en' ? 'on' : '') + '" aria-pressed="' + (S.ui.lang === 'en') + '">EN</button></div></div>';
    var title = kum ? '<h1 class="lt">' + (v.thisWeek ? t.thisWeek : t.week) + '<small>' + esc(fill(t.weekOf, { a: dl(v.ws), b: dl(v.ws + 4 * DAY) })) + (pv ? ' · <span class="askt">' + t.ask.toLowerCase() + '</span>' : '') + '</small></h1>'
      : '<h1 class="lt">' + t.daysL[r.dow] + ' ' + dl(r.date) + '<small style="color:' + s.c + '">' + esc(s.s) + '</small></h1>';
    var nt = edNotes(v, r, i), cn = fill(t.credit9, { D: hrs(v.cfg.D * MIN) });
    nt.notes = nt.notes.filter(function (x) { return x !== cn; });   // the headline already says it
    var notes = (nt.notes.length ? '<div class="note ' + nt.ncls + '">' + esc(nt.notes.join(' · ')) + '</div>' : '') + nt.mrow + habitRow(v, r, i);
    var pops = (st.themes ? themePanel() : '') + (st.set ? settings() : '') + (st.view === 'history' ? history() : '') + revPanel(v) + impPanel() +
      (S.ui.ask ? '<section class="sy-askpop" aria-label="' + esc(t.ask) + '">' + panelHead(t.ask, 'question') + askRow(v, false) + '<div class="askp">' + answerPanel(v) + suggestions() + '</div></section>' : '');
    return '<div class="sy' + (kum ? ' kum' : '') + '">' + sySide(v, w) + '<section class="sy-dt">' + tb + (tierOf() === 'compact' ? '<div class="sy-mini"><span>' + t.remaining + ' <b>' + dur(v.remaining, true) + '</b></span><span>' + hm(v.done) + ' / ' + hrs(v.W) + ' ' + t.h + '</span><button class="ibtn" data-a="wreset" aria-label="' + esc(t.resetWeek) + '" title="' + esc(t.resetWeek) + '">' + syIc('reset') + '</button>' + releaseLink() + '</div>' : '') + title + notices(v) + (kum ? syKum(v, w, r) : syHero(v, r) + syLine(v, r)) +
      '<div class="sy-low">' + (notes ? '<div class="sy-notes" role="status">' + notes + '</div>' : '') + '<div class="sy-row">' + syBar(v, r) +
      '<button class="sy-ask sy-gl' + (S.ui.ask ? ' on' : '') + '" data-a="askOpen" aria-expanded="' + !!S.ui.ask + '" aria-label="' + t.ask + '" title="' + t.ask + ' (Alt+M)">' + syIc('search') + '</button></div></div>' + pops + '</section></div>';
  }
  function isDark() { if (TH.T[S.ui.theme] && TH.T[S.ui.theme].lightOnly) return false; return S.ui.look === 'dark' || (S.ui.look === 'auto' && !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)); }
  function render(now, force) {
    var p = P(), v = p ? compute(now) : null; st.v = v;
    var tier = tierOf(); st.narrow = widthFor() < 760;
    var sig = JSON.stringify([st.code, st.fp, Math.floor(now / 60000), st.off, st.sel, st.view, st.set, st.themes, S.ui.ask, st.ask && st.ask.q, st.rev && [st.rev.day, st.rev.t, st.rev.from, st.rev.day2, st.rev.t2], st.undo ? 1 : 0, st.toast, S.cfg, S.ui, p && [p.types, p.plan, p.ovr, p.ooo, p.pick], st.job, st.count, st.paged, isDark(), st.narrow, tier, st.imp ? st.imp.on : 0]);
    if (sig === st.sig && !force) return;
    var act = root.activeElement, fkey = act && act.dataset && (act.dataset.e || act.dataset.c), fsel = act && act.selectionStart;
    if (fkey && !force && act.tagName === 'INPUT') return;   // never yank an input mid-edit
    st.sig = sig;
    var th = TH.T[S.ui.theme] ? S.ui.theme : 'cizelge', lay = TH.T[th].layout;
    W.setAttribute('style', TH.vars(th, isDark()) + ';' + (W.dataset.pos || '')); W.setAttribute('lang', S.ui.lang === 'en' ? 'en' : 'tr');
    var small = tier === 'pocket' || tier === 'compact';
    W.dataset.dark=String(isDark());
    var grip=root.querySelector('.rz-br');grip.title=L().resizeKeys;grip.setAttribute('aria-label',grip.title);
    W.style.setProperty('--ms',String(widthFor()/1350));
    W.className = 'w' + (lay==='knight'||lay==='clock'?' H':'') + ' L-' + lay + ' TH-' + S.ui.theme + ' T-' + tier + (widthFor()<1000?' mid':'') + (S.ui.col ? ' col' : '') + (st.narrow && !small ? ' narrow' : '') + (heightFor() ? ' fixh' : '') + (st.rs ? ' rsz' : '') + (st.anim ? ' anim' : '');
    if(lay==='knight'&&tier!=='pocket')W.classList.add('illuminated');
    st.lastTier = tier;
    var syFull = lay === 'saydam' && tier !== 'pocket' && v;   // Saydam builds its own window (sidebar, toolbar, popovers)
    var html = small || syFull ? '' : header(v) + (st.themes ? themePanel() : '') + (st.set ? settings() : '') + notices(v);
    if (tier === 'pocket') html += pocketView(v);
    else if (tier === 'compact' && !syFull) html += compactView(v);
    else if (syFull) html += syView(v, st.ask && st.ask.pv && st.ask.store ? st.ask.pv : null);
    else if (!v) html += '<div class="empty">' + (st.code === 'loading' ? '<span class="spin"></span> ' : '') + '<b>' + esc(L()[st.code] || L().loading) + '</b>' + (st.code === 'nocard' ? '<span>ARGE Portal · PDKS</span>' : '') + '</div>';
    else if (st.view === 'history') html += history() + strip(v);
    else {
      var pv = st.ask && st.ask.pv && st.ask.store ? st.ask.pv : null;
      if (S.ui.ask) html += askRow(v, false) + '<div class="askp">' + answerPanel(v) + suggestions() + '</div>';
      if (lay === 'knight' || lay === 'clock') html += heritage(v,pv,lay);
      else if (lay === 'cizelge') html += '<div class="body">' + summary(v) + '<div style="min-width:0">' + timeline(v, pv) + '</div></div>' + editor(v);
      else if (lay === 'sutunlar') html += '<div class="body"><div class="cols">' + colHead(v, pv) + columns(v, pv, 214) + '</div>' + rightPanel(v) + '</div>' + editor(v);
      else html += '<div class="body">' + summary(v) + '<div style="min-width:0">' + timeline(v, pv) + '</div></div>' + editor(v);
      html += strip(v) + revPanel(v) + impPanel();
    }
    if (st.toast) html += '<div class="toast">' + esc(st.toast) + (st.undo ? '<button data-a="undo">' + L().undo + '</button>' : '') + '</div>';
    if(tier==='compact'&&!syFull&&st.themes)html+=themePanel();
    // The pocket's brand already links to the install page; repeat the release row there only to announce an update.
    if (!syFull && (tier !== 'pocket' || (latestVersion && versionNewer(latestVersion, VERSION)))) html += releaseLink();
    var pool = {};
    MAIN.querySelectorAll('canvas[data-art][data-painted]:not(.control-paint)').forEach(function (c) { var k = c.dataset.art + '|' + c.className; (pool[k] = pool[k] || []).push(c); });
    // Medieval faces draw O like 0: set the word OOO (text only, never inside attributes) in the gothic face.
    var plateArt = TH.T[th].art;   // Bozkır: painted steppe plates instead of Knight's
    if ((lay === 'knight' && !plateArt) || lay === 'clock') html = html.replace(/>([^<]*)</g, function (m, txt) { return '>' + txt.replace(/\bOOO\b/g, '<span class="tri-o">OOO</span>') + '<'; });
    MAIN.innerHTML = lay==='knight'&&tier!=='pocket'?'<div class="surface-stack">'+html+'</div>':html;
    st.artPool = pool;
    if(lay==='knight'&&!plateArt&&(tier==='wide'||tier==='std')){
      MAIN.querySelectorAll('.side>div>.k:first-child,.side>.sec>div:first-child>.k,.tr .dn').forEach(function(el){el.insertAdjacentHTML('afterbegin',art('fleuron','manuscript-fleuron'));});
      MAIN.querySelectorAll('.tl .lv').forEach(function(el){el.innerHTML=art('timeMarker','time-marker');});
    }
    if(lay==='clock'&&tier==='wide'&&v&&st.view!=='history'){
      var dialBody=MAIN.querySelector('.clock-body'), head=MAIN.querySelector('.hd');
      if(dialBody&&head){var shell=document.createElement('div');shell.className='clock-composition';shell.innerHTML=art(isDark()?'panelDark':'panelLight','clock-panel-art');MAIN.prepend(shell);shell.appendChild(head);shell.appendChild(dialBody);}
      ['.wstrip','.ed'].forEach(function(sel){var el=MAIN.querySelector(sel);if(el){el.classList.add('clock-framed-rail');el.insertAdjacentHTML('afterbegin',art(isDark()?'railDark':'railLight','clock-rail-art'));}});
    }
    if(plateArt&&tier!=='pocket'){MAIN.insertAdjacentHTML('afterbegin',art(plateArt+(tier==='compact'?'Compact':'Wide'),'bz-plate'));}
    if(S.ui.theme==='turkic'&&tier!=='pocket'){var tkb=turkicBands(tier);MAIN.insertAdjacentHTML('afterbegin',tkb[0]);if(tkb[1])MAIN.insertAdjacentHTML('beforeend',tkb[1]);}
    if(lay==='knight'&&tier!=='pocket'){
      var page=MAIN.querySelector('.surface-stack');
      page.querySelectorAll('.knight-margin,.manuscript-initial,.manuscript-rule,.manuscript-bas-de-page,.compact-art').forEach(function(el){el.remove();});
      page.insertAdjacentHTML('afterbegin',plateArt?art(plateArt+(tier==='wide'?'Wide':'Compact'),'manuscript-plate bz-plate'):art(tier==='wide'?(isDark()?'plateDark':'plateLight'):(isDark()?'compactDark':'compactLight'),'manuscript-plate'));
      if(tier==='std'){var namePart=page.querySelector('.brand-rest');if(namePart)namePart.textContent='Mesai';}
      var query=page.querySelector('.askr'), response=page.querySelector('.askp');
      if(query&&response){var dialog=document.createElement('section');dialog.className='manuscript-question';dialog.setAttribute('aria-label',L().ask);page.appendChild(dialog);dialog.insertAdjacentHTML('afterbegin',panelHead(L().ask,'question'));dialog.appendChild(query);dialog.appendChild(response);}
      var settingsPanel=page.querySelector('.set');if(settingsPanel)settingsPanel.classList.add('manuscript-settings');
      var historyPanel=page.querySelector('.hist');if(historyPanel){historyPanel.classList.add('manuscript-history');historyPanel.insertAdjacentHTML('afterbegin',panelHead(L().history,'history'));}
    }
    if(lay==='clock'&&tier==='wide'){
      var composition=MAIN.querySelector('.clock-composition');
      if(composition){var cp=MAIN.querySelector('.set');if(cp){cp.classList.add('clock-settings');composition.appendChild(cp);}var cq=MAIN.querySelector('.askr'),ca=MAIN.querySelector('.askp');if(cq&&ca){var cs=document.createElement('section');cs.className='clock-question';composition.appendChild(cs);cs.appendChild(cq);cs.appendChild(ca);}}
    }
    if(lay!=='knight'){var askBox=MAIN.querySelector('.askp');if(S.ui.ask&&askBox&&!syFull)askBox.insertAdjacentHTML('afterbegin',panelHead(L().ask,'question'));var histBox=MAIN.querySelector('.hist');if(histBox)histBox.insertAdjacentHTML('afterbegin',panelHead(L().history,'history'));}
    if (fkey) { var el = root.querySelector('[data-e="' + fkey + '"],[data-c="' + fkey + '"]'); if (el && !el.disabled) { el.focus(); try { if (fsel != null && el.setSelectionRange) el.setSelectionRange(fsel, fsel); } catch (e) { /* select */ } } }
    pill(v);
    if (!st.placed) place0();
    else if(!st.rs&&!st.move){var bounds=W.getBoundingClientRect();setPos(bounds.left,bounds.top);}
    keepInView();
    paintArt();
  }

  // ---------------- placement ----------------
  var CMPW = { saydam: 500, bozkir: 510, bozkira: 480 };   // Bozkır: the parchment beside the figure must hold the compact view (tier < 520)   // Saydam keeps Gün/Kum saati in compact
  var FULLW = { cizelge: 880, sutunlar: 880, knight: 1100, clock: 1050, saydam: 1120, bozkir: 1240, bozkira: 1240 };
  function sizeOf() { return S.ui.cmp ? 'compact' : (S.ui.w && S.ui.w < 300) ? 'pocket' : 'full'; }
  function setSize(sz) { S.ui.cmp = sz === 'compact'; S.ui.w = sz === 'pocket' ? 220 : null; S.ui.h = null; S.ui.col = false; S.ui.pre = null; }
  function fullW() { var vw = document.documentElement.clientWidth || window.innerWidth; return Math.round(Math.min(FULLW[S.ui.theme] || 880, vw - 24)); }
  function widthFor() {
    var vw = document.documentElement.clientWidth || window.innerWidth, sz = sizeOf(), full = fullW();
    if (sz === 'pocket') return 220;
    // A window too narrow for the full layout gets the compact one, never a squeezed in-between.
    var cw = window.__MESAI_CMPW || CMPW[S.ui.theme] || 340;   // Knight's compact plate holds the knight painting, so it needs more width
    if (sz === 'compact' || full < 760) return Math.round(Math.max(200, Math.min(cw, vw - 12)));
    return full;
  }
  function tierOf(w) { w = w || widthFor(); return w < 300 ? 'pocket' : w < 520 ? 'compact' : w < 760 ? 'std' : 'wide'; }
  function heightFor() { return null; }   // height follows the content (scrolls inside when taller than the window)
  // One click: full ⇄ compact. Keeps the right edge where it was, remembers the previous size.
  function toggleCmp(on) {
    var rc = W.getBoundingClientRect(), tr = tierOf(), small = S.ui.cmp || tr === 'pocket' || tr === 'compact';
    if (on == null) on = !small;
    setSize(on ? 'compact' : 'full'); save();
    var nw = widthFor(); st.anim = true; setPos(rc.right - nw, rc.top); if (S.ui.pos) S.ui.pos = [Math.max(6, rc.right - nw), rc.top];
    render(nowFn(), true); setTimeout(function () { st.anim = false; W.classList.remove('anim'); keepInView(); }, 200);
  }
  function place0() {
    var wv = widthFor(); st.narrow = wv < 760;
    if (S.ui.pos) { setPos(S.ui.pos[0], S.ui.pos[1]); st.placed = true; return; }
    var vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
    var x = vw - wv - 16, y = Math.max(12, vh - (W.offsetHeight || 500) - 16);
    var sc = st.scope && st.scope.closest && (st.scope.closest('.ui-dialog,[id^="window_"]') || st.scope);
    if (sc && sc.getBoundingClientRect) { var rc = sc.getBoundingClientRect(); if (rc.width && rc.right + 16 + wv <= vw) { x = rc.right + 16; y = Math.max(12, rc.top); } }
    setPos(x, y);
    if (st.scope) st.placed = true;
  }
  function setPos(x, y) {
    var wv = widthFor(), vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
    var hv = heightFor();
    x = Math.max(6, Math.min(vw - (S.ui.col ? 240 : wv) - 6, x)); y = Math.max(6, Math.min(vh - 60, y));
    if (hv && y + hv > vh - 6) y = Math.max(6, vh - hv - 6);
    W.dataset.pos = 'left:' + x + 'px;top:' + y + 'px;width:' + (S.ui.col ? 'auto' : wv + 'px') + (hv ? ';height:' + hv + 'px' : '');
    W.style.left = x + 'px'; W.style.top = y + 'px'; W.style.width = S.ui.col ? 'auto' : wv + 'px'; W.style.height = hv ? hv + 'px' : '';
  }
  function keepInView() {
    if (S.ui.col || st.move || st.rs) return;
    var rc = W.getBoundingClientRect(), vh = window.innerHeight;
    if (rc.bottom > vh - 6 && rc.top > 6) setPos(rc.left, Math.max(6, vh - rc.height - 6));
  }

  // ---------------- mutations ----------------
  function mut(fn) {
    var p = P(); if (!p) return;
    st.undo = C.clone(storeOf(p));
    fn(p); save();
    if (st.ask && st.ask.store) st.ask = null;
    render(nowFn(), true);
  }
  function toast(msg) { st.toast = msg; clearTimeout(st.tt); st.tt = setTimeout(function () { st.toast = null; render(nowFn(), true); }, 5000); }
  function editDay(field, raw) {
    var v = st.v, r = v && v.rows[st.sel]; if (!r) return false;
    var past = r.past || !v.thisWeek, k = r.key;
    var cur = { s: r.first != null ? minOf(r.first, r.date) : (r.start != null ? minOf(r.start, r.date) : v.cfg.start) };
    cur.e = past ? (r.last != null ? minOf(r.last, r.date) : cur.s) : (r.end != null ? Math.ceil((r.end - r.date) / MIN - 1e-9) : cur.s + v.cfg.D);
    var val = field === 'm' ? parseLen(raw) : parseTime(raw);
    if (val == null) return false;
    mut(function (p) {
      if (past) {
        var o = Object.assign({}, p.ovr[k] || {}), s = o.s != null ? o.s : cur.s;
        if (field === 's') { o.s = val; o.m = o.m != null ? o.m : Math.max(0, cur.e - cur.s); }
        else if (field === 'e') { o.s = s; o.m = Math.max(0, (val < s ? val + 1440 : val) - s); }
        else { o.s = s; o.m = val; }
        p.ovr[k] = o;
      } else {
        var pl = Object.assign({}, p.plan[k] || {});
        if (field === 's' && r.today) {   // "I came in at": counts from that time even before ARGE shows it
          p.ovr[k] = Object.assign({}, p.ovr[k] || {}, { s: val }); delete pl.s;
          if (pl.e != null) pl.e = val + (cur.e - cur.s);
        }
        else if (field === 's') { var lenM = cur.e - cur.s; pl.s = val; if (pl.e != null) pl.e = val + lenM; }
        else if (field === 'e') { pl.e = val < cur.s ? val + 1440 : val; if (r.first == null && pl.s == null) pl.s = cur.s; }
        else { pl.e = cur.s + val; if (r.first == null && pl.s == null) pl.s = cur.s; }
        p.plan[k] = pl;
        if (r.hol) p.types[k] = 'ofis'; else if (p.types[k]) delete p.types[k];
      }
    });
    return true;
  }

  // ---------------- events ----------------
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b || e.target.closest('select')) return;
    var a = b.dataset.a, v = b.dataset.v, t = L(), now = nowFn();
    if (a === 'expand') { if (!st.moved) { S.ui.col = false; save(); st.placed = false; render(now, true); } return; }
    if (a === 'close') return api.close();
    if (a === 'cmp') { toggleCmp(true); return; }
    if (a === 'cmpx') { if (!st.moved) toggleCmp(false); return; }
    if (a === 'holT') { S.cfg.hol = v === '1'; save(); render(now, true); return; }
    if (a === 'ics') {
      var fi2 = document.createElement('input'); fi2.type = 'file'; fi2.accept = '.ics,text/calendar';
      fi2.onchange = function () { var fl = fi2.files[0]; if (!fl) return; fl.text().then(function (txt) { var n2 = nowFn(), items = HOL.parseICS(txt, C.weekStart(n2) - 7 * DAY, n2 + 200 * DAY, C.config(S.cfg).D); st.imp = { items: items, on: items.map(function () { return true; }) }; render(nowFn(), true); }); };
      fi2.click(); return;
    }
    if (a === 'impT') { if (st.imp) st.imp.on[+v] = !st.imp.on[+v]; return; }
    if (a === 'impClear') { st.imp = null; render(now, true); return; }
    if (a === 'impApply') { var im = st.imp, cnt = 0; if (im) { mut(function (p) { im.items.forEach(function (it, i) { if (!im.on[i]) return; cnt++; if (it.kind === 'ooo') p.ooo[it.date] = { m: it.m, s: it.s }; else { p.types[it.date] = it.kind; delete p.plan[it.date]; } }); }); st.imp = null; toast(fill(t.icsApplied, { n: cnt })); render(now, true); } return; }
    if (a === 'min') { st.themes=false;st.set=false;st.rev=null;st.view='week';var mr=W.getBoundingClientRect();setSize('pocket');save();setPos(mr.right-220,mr.top);if(S.ui.pos)S.ui.pos=[Math.max(6,mr.right-220),mr.top];render(now,true);return; }
    if (a === 'theme') { if (TH.ORDER.indexOf(v) < 0) return; st.themes=false;st.set=false;S.ui.ask=false;st.view='week';st.rev=null;S.ui.theme = v; save(); render(now, true); return; }
    if (a === 'lang') { S.ui.lang = v; save(); render(now, true); return; }
    if (a === 'dark') { S.ui.look = isDark() ? 'light' : 'dark'; save(); render(now, true); return; }
    if (a === 'look') { S.ui.look = v; save(); render(now, true); return; }
    if (a === 'dismiss') {dismissPanel(b.dataset.panel);return;}
    if (a === 'themes') {var open=!st.themes;st.themeReturn=st.set;st.set=false;st.view='week';S.ui.ask=false;st.rev=null;st.themes=open;render(now,true);if(open){var choice=root.querySelector('.theme-panel .theme-choice.on');if(choice)choice.focus();}return;}
    if (a === 'set') {st.themes=false;S.ui.ask=false;st.view='week';st.rev=null;st.set = !st.set; render(now, true);if(st.set){var closer=root.querySelector('.set .panel-close');if(closer)closer.focus();}return; }
    if (a === 'prev') { st.off--; st.view = 'week'; st.sel = 0; st.ask = null; tick(true); return; }
    if (a === 'next') { if (st.off < 0) st.off++; st.view = 'week'; st.sel = null; tick(true); return; }
    if (a === 'thisweek') { st.off = 0; st.view = 'week'; st.sel = null; tick(true); return; }
    if (a === 'goweek') { st.off = +v; st.view = 'week'; st.sel = 0; st.ask = null; tick(true); return; }
    if (a === 'hist') {st.themes=false;st.set=false;S.ui.ask=false;st.rev=null;st.view = st.view === 'history' ? 'week' : 'history'; render(now, true); return; }
    if (a === 'sel') { st.sel = +v; render(now, true); return; }
    if (a === 'syv') { S.ui.syv = v === 'kum' ? 'kum' : 'day'; save(); render(now, true); return; }
    if (a === 'plan') { S.ui.planOpen = !S.ui.planOpen; save(); render(now, true); return; }
    if (a === 'bell') { S.ui.bell = !S.ui.bell; save(); if (S.ui.bell && window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (x) { /* */ } } render(now, true); return; }
    if (a === 'askOpen') {st.themes=false;st.set=false;st.view='week';st.rev=null;S.ui.ask = !S.ui.ask; save(); if (!S.ui.ask) { st.ask = null; st.askText = ''; } render(now, true); var inp = root.querySelector('[data-e="ask"]'); if (inp) inp.focus(); return; }
    if (a === 'sug') { runAsk(SG()[+v]); render(now, true); return; }
    if (a === 'askApply') { var s2 = st.ask && st.ask.store; if (s2) { var p1 = P(); st.undo = C.clone(storeOf(p1)); p1.types = s2.types; p1.plan = s2.plan; p1.ooo = s2.ooo; p1.ovr = s2.ovr; save(); st.ask = null; st.askText = ''; toast(t.applied); render(now, true); } return; }
    if (a === 'oooYes') { if (st.ask && st.ask.sc) { st.ask.sc.oooOK = true; compute(now); } render(now, true); return; }
    if (a === 'askClear') { st.ask = null; st.askText = ''; render(now, true); return; }
    if (a === 'undo') { var p0 = P(), u = st.undo; if (p0 && u) { p0.types = u.types; p0.plan = u.plan; p0.ooo = u.ooo; p0.ovr = u.ovr; p0.pick = u.pick || {}; st.undo = null; st.toast = null; save(); render(now, true); } return; }
    if (a === 'loadm') { delete st.tried[b.dataset.m]; startJob(b.dataset.m, st.period); tick(true); return; }
    if (a === 'focus') { var f = st.focusEl; if (f) { try { f.scrollIntoView({ block: 'center' }); f.focus(); if (f.showPicker) f.showPicker(); } catch (x) { /* */ } } return; }
    if (a === 'rev') {st.themes=false;st.set=false;S.ui.ask=false;
      if (st.rev) { st.rev = null; render(now, true); return; }
      var vv = st.v, flex = vv.rows.filter(function (r) { return !r.past && r.office; });
      var last = flex.length ? flex[flex.length - 1].dow : 4, other = flex.filter(function (r) { return r.dow !== last; });
      st.rev = { day: last, t: '17:00', from: other.length ? other[other.length - 1].dow : last, day2: flex.length ? flex[Math.min(1, flex.length - 1)].dow : 4, t2: '17:00' };
      render(now, true); return;
    }
    if (a === 'revApply') { var w = st.rev && st.rev.w, rv = st.rev; if (w) { var dk = dayKey(st.v, rv.day), e2 = parseTime(rv.t), fk = dayKey(st.v, rv.from), fr = w.rows[rv.from]; mut(function (p) { p.plan[dk] = Object.assign({}, p.plan[dk], { e: e2 }); if (fr.end) p.plan[fk] = Object.assign({}, p.plan[fk], { e: Math.ceil((fr.end - fr.date) / MIN - 1e-9) }); delete p.types[dk]; delete p.types[fk]; }); st.rev = null; toast(t.applied); render(now, true); } return; }
    if (a === 'fup') { var fq = b.dataset.q; var inp = root.querySelector('[data-e="ask"]'); if (inp) inp.value = fq; runAsk(fq); render(now, true); return; }
    if (a === 'habit') { var hr = st.v.rows[st.sel], hm0 = +v; mut(function (p) { p.plan[hr.key] = Object.assign({}, p.plan[hr.key], { s: hm0 }); }); return; }
    if (a === 'habitAll') { var vh = st.v, picks = vh.rows.map(function (x) { return [x, habitFor(vh, x)]; }).filter(function (x) { return x[1]; }); mut(function (p) { picks.forEach(function (x) { p.plan[x[0].key] = Object.assign({}, p.plan[x[0].key], { s: x[1].start }); }); }); return; }
    if (a === 'habitOff') { S.ui.habits = false; save(); render(now, true); toast(t.habitOffT); return; }
    if (a === 'habitTips') { S.ui.habits = v === '1'; save(); render(now, true); return; }
    if (a === 'habitDef') { var hh = habitsNow(st.v); if (hh && hh.start != null) { S.cfg.start = mm(hh.start); save(); render(now, true); } return; }
    if (a === 'wreset') { var vw = st.v; mut(function (p) { vw.rows.forEach(function (r) { delete p.plan[r.key]; delete p.types[r.key]; delete p.ooo[r.key]; delete p.ovr[r.key]; }); }); toast(t.resetWeek); return; }
    if (a === 'core') { S.cfg.coreS = b.dataset.s; S.cfg.coreE = b.dataset.e; save(); render(now, true); return; }
    if (a === 'wday') { var d = +v, ds = S.cfg.days.slice(), ix = ds.indexOf(d); if (ix >= 0) { if (ds.length > 1) ds.splice(ix, 1); } else ds.push(d); S.cfg.days = ds.sort(); save(); render(now, true); return; }
    if (a === 'backup') { var blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), url = URL.createObjectURL(blob), ln = document.createElement('a'); ln.href = url; ln.download = 'mesai-yedek-' + C.dkey(now) + '.json'; document.body.appendChild(ln); ln.click(); ln.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000); return; }
    if (a === 'restore') { var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'application/json,.json'; fi.onchange = function () { var fl = fi.files[0]; if (!fl) return; fl.text().then(function (txt) { try { var o = JSON.parse(txt); if (o && o.ppl) { S.cfg = Object.assign(S.cfg, o.cfg || {}); S.ui = Object.assign(S.ui, o.ui || {}); S.ppl = o.ppl; save(); toast(L().applied); render(nowFn(), true); } } catch (x) { /* bad file */ } }); }; fi.click(); return; }
    var r = st.v && st.v.rows[st.sel]; if (!r) return;
    if (a === 'type') { mut(function (p) { if (v === 'ofis') { if (r.hol) p.types[r.key] = 'ofis'; else delete p.types[r.key]; } else p.types[r.key] = v; delete p.plan[r.key]; }); return; }
    if (a === 'nuds') { var cs0 = r.first != null ? minOf(r.first, r.date) : r.start != null ? minOf(r.start, r.date) : st.v.cfg.start; editDay('s', mm(Math.max(0, cs0 + (+v)))); return; }
    if (a === 'syt') { var tb = b.getBoundingClientRect(); if (!tb.width) return; var hx = +b.dataset.lo + Math.max(0, Math.min(1, (e.clientX - tb.left) / tb.width)) * (+b.dataset.span); editDay('e', mm(Math.round(hx * 12) * 5)); return; }
    if (a === 'nud') { var cur = r.past || !st.v.thisWeek ? r.last : r.end; if (cur == null) return; editDay('e', clk(cur + (+v) * MIN)); return; }
    if (a === 'ooo') { mut(function (p) { var o = p.ooo[r.key] || { m: 0 }, m = Math.max(0, Math.min(600, (+o.m || 0) + (+v))); if (m) p.ooo[r.key] = { m: m, s: o.s != null ? o.s : null }; else delete p.ooo[r.key]; }); return; }
    if (a === 'pick') { mut(function (p) { p.pick = p.pick || {}; if (v === 'portal') p.pick[r.key] = 'portal'; else delete p.pick[r.key]; }); return; }
    if (a === 'dreset') { mut(function (p) { delete p.plan[r.key]; delete p.ovr[r.key]; delete p.types[r.key]; delete p.ooo[r.key]; }); return; }
  });
  function fieldError(el) {   // say why the value was refused; the plan is kept
    el.classList.add('er'); el.setAttribute('aria-invalid', 'true');
    var box = root.querySelector('#mesai-field-error');
    if (!box) { box = document.createElement('div'); box.id = 'mesai-field-error'; box.className = 'field-error'; box.setAttribute('role', 'alert'); var place = root.querySelector('.sy-low') || MAIN; place.insertBefore(box, place.firstChild); }
    box.textContent = L().sy.bad; el.setAttribute('aria-describedby', box.id);
  }
  root.addEventListener('change', function (e) {
    var el = e.target, k = el.dataset && el.dataset.e, c = el.dataset && el.dataset.c;
    if (c) {
      if (c === 'start' || c === 'coreS' || c === 'coreE') { var m0 = parseTime(el.value); if (m0 == null) { fieldError(el); return; } S.cfg[c] = mm(m0); }
      else { var n0 = parseFloat(String(el.value).replace(',', '.')); if (!isFinite(n0)) { fieldError(el); return; } S.cfg[c] = n0; }
      save(); el.blur(); render(nowFn(), true); return;
    }
    if (k === 's' || k === 'e' || k === 'm') { if (!editDay(k, el.value)) fieldError(el); return; }
    if (k === 'os') { var r = st.v && st.v.rows[st.sel], m1 = el.value.trim() ? parseTime(el.value) : null; if (!r || (el.value.trim() && m1 == null)) { fieldError(el); return; } mut(function (p) { var o = p.ooo[r.key] || { m: 60 }; p.ooo[r.key] = { m: o.m, s: m1 }; }); return; }
    if (k === 'tsel') { var d = +el.dataset.d, row = st.v.rows[d]; st.sel = d; mut(function (p) { if (el.value === 'ofis') { if (row.hol) p.types[row.key] = 'ofis'; else delete p.types[row.key]; } else p.types[row.key] = el.value; delete p.plan[row.key]; }); return; }
    if (k === 'rd' || k === 'rf' || k === 'rd2') { st.rev[{ rd: 'day', rf: 'from', rd2: 'day2' }[k]] = +el.value; if (k === 'rd' && st.rev.from === st.rev.day) { var c2 = st.v.rows.filter(function (r) { return !r.past && r.office && r.dow !== st.rev.day; }); if (c2.length) st.rev.from = c2[c2.length - 1].dow; } render(nowFn(), true); return; }
    if ((k === 'rt' || k === 'rt2') && parseTime(el.value) == null) { fieldError(el); return; }
    if (k === 'rt' || k === 'rt2') { st.rev[k === 'rt' ? 't' : 't2'] = el.value; el.blur(); render(nowFn(), true); return; }
  });
  root.addEventListener('keydown', function (e) {
    var el = e.target, k = el.dataset && el.dataset.e;
    e.stopPropagation();
    if(el.dataset.rz && /^Arrow/.test(e.key)){e.preventDefault();var order=['pocket','compact','full'],ix=order.indexOf(sizeOf())+(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1);setSize(order[Math.max(0,Math.min(2,ix))]);save();render(nowFn(),true);keepInView();var hb=root.querySelector('.rz-br');if(hb)hb.focus();return;}
    if (e.key === 'Escape' && closeActivePanel()) {e.preventDefault();return;}
    if (el.dataset && el.dataset.a === 'syt' && /^Arrow(Left|Right)$/.test(e.key)) { e.preventDefault(); var rr = st.v && st.v.rows[st.sel]; if (rr && rr.end != null) { editDay('e', clk(rr.end + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 15 : 5) * MIN)); var tk = root.querySelector('[data-a="syt"]'); if (tk) tk.focus(); } return; }
    if (e.key === 'Escape') { if (st.rev) st.rev = null; else if (st.ask) { st.ask = null; st.askText = ''; } else if (st.set) st.set = false; else if (S.ui.ask) { S.ui.ask = false; save(); } render(nowFn(), true); return; }
    if (k === 'ask' && e.key === 'Enter') { runAsk(el.value); el.blur(); render(nowFn(), true); return; }
    if ((k === 's' || k === 'e' || k === 'm' || k === 'os' || k === 'rt' || k === 'rt2' || el.dataset.c) && e.key === 'Enter') { el.blur(); return; }
    if ((k === 's' || k === 'e' || k === 'm') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault(); var d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 15 : 5);
      if (k === 'm') { var lm = parseLen(el.value); if (lm != null) { var n = Math.max(0, lm + d); editDay('m', Math.floor(n / 60) + ':' + C.pad(n % 60)); } }
      else { var tm = parseTime(el.value); if (tm != null) editDay(k, mm(Math.max(0, tm + d))); }
      var again = root.querySelector('[data-e="' + k + '"]'); if (again) { again.focus(); try { again.select(); } catch (x) { /* */ } }
      return;
    }
    if (el.classList && el.classList.contains('cl') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); st.sel = +el.dataset.v; render(nowFn(), true); }
  });
  root.addEventListener('focusout', function (e) {
    var el = e.target; if (!el.dataset) return;
    setTimeout(function () { if (!root.activeElement) render(nowFn(), false); }, 0);
  });
  root.addEventListener('input', function (e) {
    if (e.target.hasAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); e.target.removeAttribute('aria-describedby'); var er = root.querySelector('#mesai-field-error'); if (er) er.remove(); }
    if (e.target.dataset && e.target.dataset.e === 'ask') st.askText = e.target.value;
  });
  function onKey(e) { if(e.key==='Escape'&&closeActivePanel()){e.preventDefault();return;} if (e.altKey && e.code === 'KeyK') { e.preventDefault(); toggleCmp(); return; } if (e.altKey && e.code === 'KeyM') { e.preventDefault(); S.ui.col = false; S.ui.ask = true; save(); render(nowFn(), true); var i = root.querySelector('[data-e="ask"]'); if (i) i.focus(); } }
  window.addEventListener('keydown', onKey);

  root.addEventListener('pointerdown', function (e) {
    var hz = e.target.closest('[data-rz]');
    if (hz) {
      e.preventDefault(); e.stopPropagation();
      var r0 = W.getBoundingClientRect(); st.rs = { d: hz.dataset.rz, x0: e.clientX, y0: e.clientY, l: r0.left, t: r0.top, w: r0.width, h: r0.height };
      try { hz.setPointerCapture(e.pointerId); } catch (x) { /* old browser */ }
      W.classList.add('rsz'); return;
    }
    var hd = e.target.closest('[data-drag], .pl0'); if (!hd) return;
    if (e.target.closest('button,input,select,a') && !e.target.closest('.pl0')) return;
    var rc = W.getBoundingClientRect(); st.move = { dx: e.clientX - rc.left, dy: e.clientY - rc.top, x0: e.clientX, y0: e.clientY }; st.moved = false;
  });
  function resizeMove(e) {
    var r = st.rs, dx = e.clientX - r.x0, dy = e.clientY - r.y0, vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
    var w = r.w, h = r.h;
    if (/r/.test(r.d)) w = r.w + dx; if (/l/.test(r.d)) w = r.w - dx; if (/b/.test(r.d)) h = r.h + dy;
    var full = fullW(), sz = w < 280 ? 'pocket' : (w < (340 + full) / 2 || full < 760) ? 'compact' : 'full';
    if (sz !== sizeOf()) setSize(sz);
    w = widthFor();
    var l = /l/.test(r.d) ? r.l + (r.w - w) : r.l, tr = tierOf();
    setPos(l, r.t);
    if (tr !== st.lastTier) render(nowFn(), true);
    var lab = root.querySelector('.rzl'); lab.textContent = L().tiers[tr]; lab.classList.add('on');
  }
  function onMove(e) { if (st.rs) { resizeMove(e); return; } if (!st.move) return; if (Math.abs(e.clientX - st.move.x0) + Math.abs(e.clientY - st.move.y0) > 3) st.moved = true; if (st.moved) setPos(e.clientX - st.move.dx, e.clientY - st.move.dy); }
  function onUp() {
    if (st.rs) { st.rs = null; W.classList.remove('rsz'); root.querySelector('.rzl').classList.remove('on'); var rr = W.getBoundingClientRect(); S.ui.pos = [rr.left, rr.top]; save(); render(nowFn(), true); return; }
    if (st.move) { if (st.moved) { var rc = W.getBoundingClientRect(); S.ui.pos = [rc.left, rc.top]; save(); } st.move = null; setTimeout(function () { st.moved = false; }, 0); } }
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  root.addEventListener('dblclick', function (e) {
    if (e.target.closest('[data-rz]')) { setSize('full'); save(); var rc = W.getBoundingClientRect(); setPos(rc.left, rc.top); render(nowFn(), true); keepInView(); return; }
    if (e.target.closest('[data-drag]') && !e.target.closest('button')) toggleCmp();
  });
  function onResize() { st.narrow = widthFor() < 760; if (st.rs) return; var rc = W.getBoundingClientRect(); setPos(rc.left, rc.top); render(nowFn(), true); }
  window.addEventListener('resize', onResize);

  var obsT = null, obs = new MutationObserver(function (recs) {
    if (recs.every(function (r) { return r.target === host || host.contains(r.target); })) return;
    A.touched(recs); st.dirty = true; clearTimeout(obsT); obsT = setTimeout(function () { tick(); }, 250);
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'disabled'], characterData: true });
  var timer = setInterval(tick, 1000);
  var mq = window.matchMedia && matchMedia('(prefers-color-scheme: dark)'), onMq = function () { if (S.ui.look === 'auto') render(nowFn(), true); };
  if (mq && mq.addEventListener) mq.addEventListener('change', onMq);

  var api = window.__mesai = {
    version: VERSION,
    variant: BUILD.theme,
    poke: function () { S.ui.col = false; save(); st.fp = ''; st.placed = !!S.ui.pos; tick(true); flash(); },
    close: function () { closed=true;Object.keys(artCache).forEach(function(k){artCache[k].close();});clearTimeout(updateTimer);if(updateController)updateController.abort(); clearInterval(timer); obs.disconnect(); window.removeEventListener('keydown', onKey); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('resize', onResize); if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq); host.remove(); delete window.__mesai; },
    state: function () { return { st: st, S: S }; }
  };
  tick(true);
  if(window.FontFace && document.fonts) Object.keys(MesaiFonts).forEach(function(name){var existing=Array.from(document.fonts).filter(function(f){return f.family.replace(/["']/g,'')===name;});if(existing.some(function(f){return f.mesaiVersion===VERSION;}))return;existing.forEach(function(f){document.fonts.delete(f);});var font=new FontFace(name,embeddedBytes(MesaiFonts[name]),name==='Mesai Gothic'?{weight:'100 900'}:{});font.mesaiVersion=VERSION;font.load().then(function(f){document.fonts.add(f);if(!closed)render(nowFn(),true);}).catch(function(){});});
  checkVersion();
})();
