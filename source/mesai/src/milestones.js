// Actual-progress crossings only. Opening a page or changing a target establishes a baseline.
var MesaiMilestones = (function () {
  function events(prev, next) {
    if (!prev || !next || prev.scope !== next.scope || prev.signature !== next.signature) return [];
    var elapsed = next.now - prev.now;
    if (elapsed <= 0 || elapsed > 600000) return [];
    var out = [];
    ['day', 'week'].forEach(function (kind) {
      var a = prev[kind], b = next[kind], target = next[kind + 'Target'];
      // Corrections, leave credits and manual edits must not masquerade as elapsed work.
      if (!isFinite(a) || !isFinite(b) || b < a || b - a > elapsed + 5000 || !(target > 0)) return;
      var id = next.person + ':' + (kind === 'day' ? next.date : next.weekKey) + ':' + kind + ':' + target;
      if (a < target && b >= target) out.push({id: id + ':done', sound: kind});
      else if (a < target - next.lead && b >= target - next.lead && b < target) out.push({id: id + ':near', sound: 'near'});
    });
    return out.sort(function(a,b){return ['week','day','near'].indexOf(a.sound)-['week','day','near'].indexOf(b.sound);});
  }
  // Serialize the receipt with Web Locks. Without it, fail quiet rather than promise duplicate-free audio.
  function claim(storage, locks, list, now, channel) {
    if (!storage || !locks || !locks.request || !list.length) return Promise.resolve(null);
    var key=channel==='visual'?'mesai.effects.v1':'mesai.alerts.v1';
    return locks.request(channel==='visual'?'mesai-milestone-visual':'mesai-milestone-audio', function () {
      try {
        var ledger = JSON.parse(storage.getItem(key) || '{}');
        if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return null;
        var chosen = list.filter(function(e){return !Object.prototype.hasOwnProperty.call(ledger,e.id);})[0];
        Object.keys(ledger).forEach(function(k){if(now-ledger[k]>1209600000)delete ledger[k];});
        list.forEach(function(e){ledger[e.id]=now;});
        storage.setItem(key,JSON.stringify(ledger));
        return chosen || null;
      } catch(e) { return null; }
    }).catch(function(){return null;});
  }
  return {events: events, claim: claim};
})();
if (typeof module !== 'undefined') module.exports = MesaiMilestones;
