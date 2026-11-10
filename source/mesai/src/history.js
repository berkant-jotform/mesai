// Session-only undo history. Patches never include portal records or attendance caches.
var MesaiHistory = function (initial, limit) {
  var copy = function(x){return JSON.parse(JSON.stringify(x));}, base=copy(initial), past=[], future=[];
  function diff(a,b,path,out){
    if(JSON.stringify(a)===JSON.stringify(b))return;
    if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
      Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).forEach(function(k){diff(a[k],b[k],path.concat(k),out);});
    }else out.push({path:path,before:a===undefined?undefined:copy(a),after:b===undefined?undefined:copy(b)});
  }
  function apply(current,changes,side){
    var next=copy(current);
    changes.forEach(function(c){var target=next; c.path.slice(0,-1).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(target,k))Object.defineProperty(target,k,{value:{},writable:true,enumerable:true,configurable:true});target=target[k];});var key=c.path[c.path.length-1];if(c[side]===undefined)delete target[key];else Object.defineProperty(target,key,{value:copy(c[side]),writable:true,enumerable:true,configurable:true});});
    base=copy(next);return next;
  }
  return {
    capture:function(next){var changes=[];diff(base,next,[],changes);base=copy(next);if(!changes.length)return false;past.push(changes);if(past.length>(limit||50))past.shift();future=[];return true;},
    rebase:function(next){base=copy(next);},
    undo:function(current){if(!past.length)return null;var entry=past.pop();future.push(entry);return apply(current,entry,'before');},
    redo:function(current){if(!future.length)return null;var entry=future.pop();past.push(entry);return apply(current,entry,'after');},
    canUndo:function(){return !!past.length;},canRedo:function(){return !!future.length;}
  };
};
if (typeof module !== 'undefined') module.exports = MesaiHistory;
