const assert=require('node:assert/strict'), History=require('../src/history');
const copy=x=>JSON.parse(JSON.stringify(x));
let checks=0;const same=(a,b)=>{assert.deepEqual(a,b);checks++;};
const initial={cfg:{W:45},ui:{theme:'saydam',pos:[16,16]},edits:{plan:{},ooo:{},types:{}}};
let state=copy(initial),h=History(state,50);
same(h.undo(state),null);same(h.capture(state),false);
state.edits.plan.mon={e:1080};h.capture(state);
state.ui.theme='bozkir';h.capture(state);
state.cfg.W=46;h.capture(state);
state=h.undo(state);same(state.cfg.W,45);same(state.ui.theme,'bozkir');
state=h.undo(state);same(state.ui.theme,'saydam');same(state.edits.plan.mon,{e:1080});
state=h.undo(state);same(state,initial);same(h.canUndo(),false);
state=h.redo(state);same(state.edits.plan.mon,{e:1080});
state=h.redo(state);same(state.ui.theme,'bozkir');
// A fresh edit starts a new branch, including deleting an override.
delete state.edits.plan.mon;h.capture(state);same(h.canRedo(),false);
state=h.undo(state);same(state.edits.plan.mon,{e:1080});
// External refreshes must not become actions, or be overwritten by old snapshots.
state.edits.plan.tue={e:1020};h.rebase(state);
state=h.undo(state);same(state.edits.plan.tue,{e:1020});same(state.ui.theme,'saydam');
// One compound operation (reset or applied answer) remains one undo action.
state=copy(initial);h=History(state);state.edits.plan={mon:{e:1080},fri:{e:960}};state.edits.ooo={fri:{m:60}};h.capture(state);
state=h.undo(state);same(state,initial);state=h.redo(state);same(Object.keys(state.edits.plan),['mon','fri']);
// Position is restored atomically and history has a bounded size.
state.ui.pos=[120,80];h.capture(state);state=h.undo(state);same(state.ui.pos,[16,16]);
state=copy(initial);h=History(state,3);for(let i=0;i<5;i++){state.cfg.W++;h.capture(state);}
for(let i=0;i<3;i++)state=h.undo(state);same(state.cfg.W,47);same(h.undo(state),null);
console.log(checks+' history checks passed');
