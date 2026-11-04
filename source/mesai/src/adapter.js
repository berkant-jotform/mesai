// Mesai portal adapter — finds the front PDKS card, repairs empty selections and reads its tables.
function MesaiAdapter(C, doc) {
  var win = doc.defaultView, tracks = new WeakMap(), serial = 0;
  var vis = function (e) {
    if (!e || !e.isConnected || !e.getClientRects().length) return false;
    var s = win.getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none';
  };
  var real = function (o) {
    return o && !o.disabled && ['', 'null', '0', '-1', 'undefined'].indexOf(String(o.value).trim()) < 0 &&
      !/^(se[cç]iniz|select|--|l[uü]tfen)/i.test(o.textContent.trim());
  };
  var findSel = function (scope, idRe, id) {
    return scope.querySelector('select[id="' + id + '"]') ||
      Array.prototype.filter.call(scope.querySelectorAll('select'), function (s) { return idRe.test((s.id || '') + ' ' + (s.name || '')); })[0] || null;
  };
  var zOf = function (e) {
    var z = 0;
    for (; e && e !== doc.body; e = e.parentElement) { var v = parseInt(win.getComputedStyle(e).zIndex, 10); if (v > z) z = v; }
    return z;
  };

  // A card = smallest window-like container holding a period select and at least one table.
  function cards() {
    var seen = [], out = [];
    var anchors = Array.prototype.slice.call(doc.querySelectorAll('select[id="Donem_Id"], select[id*="onem" i], select[name*="onem" i], [id="grid_kesin_giris_cikis"]'));
    anchors.forEach(function (a) {
      var scope = a.closest('[id^="form_"]') || a.closest('.ui-dialog, [id^="window_"], [role="dialog"], form');
      if (!scope || seen.indexOf(scope) >= 0 || !vis(scope) || !scope.querySelector('table')) return;
      if (a.closest('#mesai-host')) return;
      seen.push(scope);
      var frame = scope.closest('.ui-dialog, [id^="window_"], [role="dialog"]') || scope;
      out.push({ scope: scope, frame: frame, z: zOf(frame), active: !!(frame.classList.contains('active_card') || scope.closest('.active_card')), order: out.length });
    });
    // Nested matches: keep the innermost scope only.
    return out.filter(function (c) { return !out.some(function (o) { return o !== c && c.scope.contains(o.scope); }); });
  }
  function front(list) {
    var pool = list.filter(function (c) { return c.active; });
    if (!pool.length) pool = list;
    return pool.slice().sort(function (a, b) { return b.z - a.z || b.order - a.order; })[0] || null;
  }
  function choose(sel, opt) {
    var $ = win.jQuery;
    if ($ && $.fn) { try { $(sel).val(opt.value).trigger('change'); return; } catch (e) { /* fall through */ } }
    sel.value = opt.value;
    sel.dispatchEvent(new win.Event('input', { bubbles: true }));
    sel.dispatchEvent(new win.Event('change', { bubbles: true }));
  }
  var cellsOf = function (tr) {
    return Array.prototype.filter.call(tr.children, function (td) { return td.tagName === 'TD' && win.getComputedStyle(td).display !== 'none'; })
      .map(function (td) { return td.textContent.replace(/\s+/g, ' ').trim(); });
  };
  var busy = function (scope) {
    return Array.prototype.some.call(scope.querySelectorAll('.form_loading_panel, .gBlock, .blockUI, .loading, .spinner, [aria-busy="true"]'), vis);
  };
  function paged(scope) {
    return Array.prototype.some.call(scope.querySelectorAll('.pDiv, .pagination, .pager'), function (e) {
      if (!vis(e)) return false;
      var m = e.textContent.match(/(?:of|\/|toplam)\s*(\d+)/i), inp = e.querySelector('input');
      return m && +m[1] > 1 && (!inp || true);
    });
  }

  // Reads the front card. opts.want: month key to switch to; opts.person: preferred person value.
  function read(now, opts) {
    opts = opts || {};
    var list = cards(), card = front(list);
    if (!card) return { code: 'nocard', count: 0 };
    var scope = card.scope, base = { count: list.length, scope: scope };
    if (!tracks.has(scope)) tracks.set(scope, { id: ++serial, fp: '', since: 0, tried: {}, waitChange: false, sawChange: false });
    var tr = tracks.get(scope); base.id = tr.id;
    var pSel = findSel(scope, /donem|period/i, 'Donem_Id'), uSel = findSel(scope, /personel|person|employee/i, 'Personel_Id');
    if (!pSel) return Object.assign(base, { code: 'loading' });
    var opt = pSel.selectedOptions[0], period = real(opt) ? C.parsePeriod(opt.textContent) : null;
    var want = opts.want || (!period ? C.mkey(now) : null);
    if (want && want !== period) {
      var o = Array.prototype.filter.call(pSel.options, function (x) { return real(x) && C.parsePeriod(x.textContent) === want; })[0];
      if (o && !pSel.disabled && tr.tried['p' + want] !== true) { tr.tried['p' + want] = true; arm(tr); choose(pSel, o); return Object.assign(base, { code: 'loading' }); }
      if (!period) return Object.assign(base, { code: 'period', focus: pSel });
    }
    if (period) delete tr.tried['p' + period];
    if (pSel.disabled || (uSel && uSel.disabled) || busy(scope)) return Object.assign(base, { code: 'loading', period: period });
    var person = 'me', name = '';
    if (uSel) {
      var uo = uSel.selectedOptions[0];
      if (!real(uo)) {
        var opts2 = Array.prototype.filter.call(uSel.options, real);
        var pick = opts2.filter(function (x) { return x.value === opts.person; })[0] || (opts2.length === 1 ? opts2[0] : null);
        if (pick && tr.tried['u' + period] !== pick.value) { tr.tried['u' + period] = pick.value; arm(tr); choose(uSel, pick); return Object.assign(base, { code: 'loading', period: period }); }
        return Object.assign(base, { code: opts2.length ? 'person' : 'loading', focus: uSel, period: period });
      }
      person = uo.value; name = uo.textContent.trim();
      // A filled selection re-arms auto-pick for the next time the portal clears it.
      Object.keys(tr.tried).forEach(function (k) { if (k[0] === 'u') delete tr.tried[k]; });
    }
    var days = {}, events = {}, nEv = 0, nDay = 0, bad = 0, stray = 0;
    Array.prototype.forEach.call(scope.querySelectorAll('tbody > tr'), function (row) {
      if (row.closest('#mesai-host')) return;
      var cells = cellsOf(row); if (!cells.length || !cells.join('')) return;
      var r = C.classify(cells); if (!r) return;
      var t = r.type === 'ev' ? r.t : r.day;
      if (C.mkey(t) !== period || t > now + 60000) { stray++; return; }
      if (r.type === 'ev') { var k = C.dkey(r.t); (events[k] = events[k] || []); if (!events[k].some(function (e) { return e.t === r.t && e.k === r.k; })) { events[k].push({ t: r.t, k: r.k }); nEv++; } }
      else { var dk = C.dkey(r.day); if (days[dk] && days[dk].min !== r.min) bad++; days[dk] = { first: r.first, last: r.last, min: r.min }; nDay++; }
    });
    // Rows from another month mean the grid still shows the previous selection.
    if (stray && !nEv && !nDay) return Object.assign(base, { code: 'loading', period: period });
    var snap = { person: person, name: name, period: period, days: days, events: events, bad: bad, paged: paged(scope) };
    var fp = JSON.stringify(snap);
    if (fp !== tr.fp) { tr.fp = fp; tr.since = Date.now(); return Object.assign(base, { code: 'loading', period: period }); }
    if (Date.now() - tr.since < 450) return Object.assign(base, { code: 'loading', period: period });
    if (tr.waitChange && !tr.sawChange && !nEv && !nDay && Date.now() - tr.armed < 8000) return Object.assign(base, { code: 'loading', period: period });
    tr.waitChange = false;
    return Object.assign(base, { code: 'ready', snap: snap, fp: fp, period: period });
  }
  function arm(tr) { tr.waitChange = true; tr.sawChange = false; tr.armed = Date.now(); tr.fp = ''; }
  function touched(records) {
    records.forEach(function (r) {
      var n = r.target.nodeType === 1 ? r.target : r.target.parentElement, s = n && n.closest('[id^="form_"], .ui-dialog, [id^="window_"], [role="dialog"], form');
      var tr = s && tracks.get(s); if (tr && tr.waitChange && !(n.closest && n.closest('select'))) tr.sawChange = true;
    });
  }
  return { read: read, cards: cards, touched: touched };
}
if (typeof module !== 'undefined') module.exports = MesaiAdapter;
