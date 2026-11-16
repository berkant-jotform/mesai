// Apply this instance's edits to the latest saved state, not its stale startup copy.
var MesaiPersistence = function (storage, key, initial, appearance) {
  var copy = function (x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); };
  var object = function (x) { return x && typeof x === 'object' && !Array.isArray(x); };
  var base = copy(initial);
  var allowed = appearance && appearance.allowed || [];
  var single = appearance && appearance.theme !== 'all';
  // Both Bozkır bookmarks carry both variants, so they share one remembered choice.
  var scope = single ? (/^bozkira?$/.test(appearance.theme) ? 'bozkir' : appearance.theme) : null;
  function valid(theme) { return allowed.indexOf(theme) >= 0; }
  function restore(state) {
    if (!allowed.length) return state;
    var next = copy(state), ui = next.ui = next.ui || {};
    var remembered = single && (ui.bookmarkThemes || {})[scope];
    // Migrate an existing valid Bozkır choice once; otherwise use this bookmark's default.
    ui.theme = valid(remembered) ? remembered : valid(ui.theme) ? ui.theme : single ? appearance.theme : allowed[0];
    return next;
  }
  function snapshot(current) {
    if (!single) return current;
    var next = copy(current), ui = next.ui = next.ui || {};
    ui.bookmarkThemes = ui.bookmarkThemes || {};
    ui.bookmarkThemes[scope] = valid(ui.theme) ? ui.theme : appearance.theme;
    // ui.theme remains the full package's preference. Never write this bookmark's
    // runtime theme over it, including when another full-package tab just changed it.
    if (base.ui && Object.prototype.hasOwnProperty.call(base.ui, 'theme')) ui.theme = base.ui.theme;
    else delete ui.theme;
    return next;
  }
  function merge(before, local, latest) {
    if (JSON.stringify(before) === JSON.stringify(local)) return copy(latest);
    if (!object(local) || (!object(before) && before !== undefined)) return copy(local);
    before = before || {};
    var result = object(latest) ? copy(latest) : {};
    Array.from(new Set(Object.keys(before).concat(Object.keys(local)))).forEach(function (k) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      var value = merge(before[k], local[k], result[k]);
      if (value === undefined) delete result[k]; else result[k] = value;
    });
    return result;
  }
  function latest() {
    var raw = storage.getItem(key);
    if (raw === null) return copy(base);
    var state = JSON.parse(raw);
    if (!MesaiPersistence.valid(state)) throw Error('Invalid Mesai storage');
    return state;
  }
  return {
    restore: restore,
    replace: function(current){if(!MesaiPersistence.valid(current))throw Error('Invalid backup');var next=snapshot(current);storage.setItem(key,JSON.stringify(next));base=copy(next);return restore(next);},
    save: function (current) {
      var next = merge(base, snapshot(current), latest());
      storage.setItem(key, JSON.stringify(next));
      base = copy(next); // Only advance after a successful write; a failed edit can be retried.
      return restore(next);
    },
    refresh: function (current) {
      var saved = latest(), next = merge(base, snapshot(current), saved);
      base = copy(saved);
      return restore(next);
    }
  };
};
// Validate before touching the live state. A wrong file must never partially restore.
MesaiPersistence.valid = function (s) {
  var obj=function(x){return !!x&&typeof x==='object'&&!Array.isArray(x);};
  if(!obj(s))return false;
  if(['cfg','ui','ppl'].some(function(k){return s[k]!==undefined&&!obj(s[k]);}))return false;
  var c=s.cfg||{},u=s.ui||{};
  if(c.days!==undefined&&(!Array.isArray(c.days)||!c.days.length||c.days.some(function(d){return !Number.isInteger(d)||d<0||d>6;})))return false;
  if([['W',1,100],['D',0.5,16],['cap',0,24]].some(function(a){return c[a[0]]!==undefined&&(!Number.isFinite(c[a[0]])||c[a[0]]<a[1]||c[a[0]]>a[2]);}))return false;
  if(u.bookmarkThemes!==undefined&&!obj(u.bookmarkThemes))return false;
  return Object.keys(s.ppl||{}).every(function(id){
    var p=s.ppl[id];if(!obj(p))return false;
    return ['months','days','events','types','plan','ovr','ooo','pick'].every(function(k){
      var map=p[k];if(map===undefined)return true;if(!obj(map))return false;
      return Object.keys(map).every(function(date){
        var v=map[date];
        if(k==='events')return Array.isArray(v)&&v.every(function(e){return obj(e)&&Number.isFinite(e.t)&&(e.k==='G'||e.k==='C');});
        if(['days','plan','ovr','ooo'].indexOf(k)<0)return true;
        if(k==='days')return obj(v)&&['first','last','min'].every(function(f){return Number.isFinite(v[f])&&Math.abs(v[f])<=8640000000000000;})&&v.min>=0&&v.min<=1440&&v.last>=v.first;
        return obj(v)&&Object.keys(v).every(function(f){return ['s','e','m','first','last','min'].indexOf(f)<0||v[f]===null||(Number.isFinite(v[f])&&v[f]>=0&&v[f]<=(f==='s'?1439:10000000));});
      });
    });
  });
};
if (typeof module !== 'undefined') module.exports = MesaiPersistence;
