// Apply this instance's edits to the latest saved state, not its stale startup copy.
var MesaiPersistence = function (storage, key, initial, appearance, normalize) {
  var copy = function (x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); };
  var object = function (x) { return x && typeof x === 'object' && !Array.isArray(x); };
  normalize = normalize || function (state) { return state; };
  var seed = normalize(copy(initial)), base = copy(seed);
  var prefix = key + '.edit.', serial = 0;
  var writer = storage.keys && (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
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
  function entries() {
    return storage.keys ? storage.keys().filter(function (k) { return k.indexOf(prefix) === 0; }).sort() : [];
  }
  function apply(state, edits) {
    var next = copy(state);
    edits.forEach(function (edit) {
      var path = edit[0], parent = next;
      for (var i = 0; i < path.length - 1; i++) {
        if (!object(parent[path[i]])) parent[path[i]] = {};
        parent = parent[path[i]];
      }
      var last = path[path.length - 1];
      if (edit.length === 1) delete parent[last]; else parent[last] = edit[1];
    });
    return next;
  }
  function latest(keys) {
    var raw = storage.getItem(key);
    var state = raw === null ? copy(seed) : JSON.parse(raw);
    if (!MesaiPersistence.valid(state)) throw Error('Invalid Mesai storage');
    var applied = Array.isArray(state._appliedEdits) ? state._appliedEdits : [];
    delete state._appliedEdits;
    state = normalize(state);
    keys.forEach(function (k) {
      if (applied.indexOf(k) >= 0) return;
      try {
        var edits = JSON.parse(storage.getItem(k));
        if (MesaiPersistence.validEdits(edits)) {
          var next = apply(state, edits);
          if (MesaiPersistence.valid(next)) state = next;
        }
      } catch (e) { /* A damaged journal entry must not hide the other changes. */ }
    });
    return { state: state, raw: raw };
  }
  function checkpoint(next, keys, raw) {
    var data = keys.length ? Object.assign({}, next, { _appliedEdits: keys }) : next;
    var json = JSON.stringify(data);
    if (json !== raw) {
      var prior = !keys.length && raw ? JSON.parse(raw) : null;
      if (prior) delete prior._appliedEdits;
      if (!prior || json !== JSON.stringify(prior)) storage.setItem(key, json);
    }
    // Record what was consumed before deleting entries. An interrupted cleanup cannot replay a stale edit.
    keys.forEach(function (k) {
      try { storage.removeItem(k); } catch (e) { /* The checkpoint already contains this edit. */ }
    });
    base = copy(next);
    return restore(next);
  }
  return {
    restore: restore,
    stage: function (current) {
      if (!writer) return;
      var edits = [];
      pending(base, snapshot(current), [], edits);
      // Attendance snapshots are disposable. Record only user-controlled state before yielding to the browser.
      edits = edits.filter(function (edit) {
        var path = edit[0];
        return path[0] === 'ui' || path[0] === 'cfg' ||
          (path[0] === 'ppl' && ['types','plan','ooo','ovr','pick'].indexOf(path[2]) >= 0);
      });
      if (!edits.length) return;
      var time = typeof performance !== 'undefined' ? Math.floor((performance.timeOrigin + performance.now()) * 1000) : Date.now() * 1000;
      var id = prefix + String(time).padStart(16, '0') + '.' + writer + '.' + String(++serial).padStart(8, '0');
      storage.setItem(id, JSON.stringify(edits));
      base = apply(base, edits);
    },
    recover: function (current, edits) {
      if (!MesaiPersistence.validEdits(edits)) return current;
      var next = apply(current, edits);
      return MesaiPersistence.valid(next) ? restore(next) : current;
    },
    replace: function (current) {
      if (!MesaiPersistence.valid(current)) throw Error('Invalid backup');
      return checkpoint(snapshot(current), entries());
    },
    save: function (current) {
      var keys = entries(), saved = latest(keys);
      return checkpoint(merge(base, snapshot(current), saved.state), keys, saved.raw);
    },
    refresh: function (current) {
      var saved = latest(entries()).state, next = merge(base, snapshot(current), saved);
      base = copy(saved);
      return restore(next);
    }
  };
  function pending(before, local, path, edits) {
    if (JSON.stringify(before) === JSON.stringify(local)) return;
    if (object(local) && (object(before) || before === undefined)) {
      before = before || {};
      Array.from(new Set(Object.keys(before).concat(Object.keys(local)))).forEach(function (k) {
        if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') pending(before[k], local[k], path.concat(k), edits);
      });
    } else {
      edits.push(local === undefined ? [path] : [path, local]);
    }
  }
};
MesaiPersistence.validEdits = function (edits) {
  return Array.isArray(edits) && edits.every(function (edit) {
    return Array.isArray(edit) && (edit.length === 1 || edit.length === 2) && Array.isArray(edit[0]) && edit[0].length &&
      edit[0].every(function (k) { return typeof k === 'string' && k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; });
  });
};
// Read-write transactions on the same store serialize across tabs when Web Locks are unavailable.
MesaiPersistence.indexedLock = function (indexedDB, name) {
  var connection;
  return function (write) {
    if (!connection) connection = new Promise(function (resolve, reject) {
      var open = indexedDB.open(name, 1);
      open.onupgradeneeded = function () { open.result.createObjectStore('write'); };
      open.onsuccess = function () { resolve(open.result); };
      open.onerror = open.onblocked = function () { reject(open.error || Error('Mesai storage lock unavailable')); };
    }).catch(function (error) { connection = null; throw error; });
    return connection.then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('write', 'readwrite'), result;
        tx.objectStore('write').get(0).onsuccess = function () { result = write(); };
        tx.oncomplete = function () { resolve(result); };
        tx.onabort = tx.onerror = function () { reject(tx.error || Error('Mesai storage lock interrupted')); };
      });
    });
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
