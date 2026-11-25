// The dashboard runs its scripts again, in the same window, when a file changes while the page is open. Listeners on
// document must not stack: with two click handlers, one click ticked an action item and the second unticked it at once.
// Loads os-core.js twice and checks that each page-wide listener is there once, and that one click toggles a tick once.
// Also the small bus the cockpit listens on (OS.docs): on, off and changed, and a fresh one after a second run.
// And the database: a second run closes the first run's subscriptions before it opens its own (ten documents, not
// twenty, then thirty), and OS.hub, OS.sense and OS.lanes say when William's own documents have answered (ready()).
const { Node } = require('./fakedom.js');
const D = require('path').join(__dirname, '../../dashboard/');
global.dash = { loader: () => {}, calc: () => {}, draw: () => {}, params: () => ({ region: 'All', mgr: '', person: '' }), setParams: () => {}, onData: () => {}, colors: Array(8).fill('#111'), setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: () => (v) => String(v), max: () => 0, select: () => ({ selectAll: () => ({ remove() {} }) }) };
const L = [];
document.addEventListener = (type, fn) => { L.push([type, fn]); };
document.removeEventListener = (type, fn) => { const i = L.findIndex((x) => x[0] === type && x[1] === fn); if (i >= 0) L.splice(i, 1); };
document.querySelector = () => null;
global.claude = { use: async () => null };
let fails = 0, passes = 0; const ok = (c, l, x) => { if (!c) fails++; else passes++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
require(D + 'os-core.js');
const first = L.map((x) => x[0]).sort().join(',');
delete require.cache[require.resolve(D + 'os-core.js')];
require(D + 'os-core.js');
const second = L.map((x) => x[0]).sort().join(',');
ok(first === second && L.length > 0, 'loading the scripts again leaves the same page-wide listeners, not twice as many', [first, second]);
ok(L.filter((x) => x[0] === 'click').length === 2 && L.filter((x) => x[0] === 'keydown').length === 1, 'two click listeners (shell, Leo pack) and one keydown', L.map((x) => x[0]));
// one click on a tick button toggles once
let toggles = 0; OS.done.toggle = () => { toggles++; };
const btn = new Node('button'); btn.dataset.doneKey = 'm1_abc';
btn.closest = (sel) => (/data-done-key/.test(sel) ? btn : null); btn.matches = (sel) => /\[data-done-key\]/.test(sel) && !/,/.test(sel);
const ev = { target: btn, preventDefault() {}, stopPropagation() {} };
for (const [type, fn] of L) if (type === 'click') { try { fn(ev); } catch (e) { /* other handlers may need more of the page */ } }
ok(toggles === 1, 'one click on a tick toggles it once', toggles);
// OS.docs, the bus the cockpit listens on: a second run of the scripts makes a new one (no listener carried over), a
// listener hears each change once until its off() is called, and one that throws does not stop the others
{
  let heard = 0, other = 0;
  const off = OS.docs.on(() => { heard++; });
  OS.docs.on(() => { throw new Error('a listener of its own'); });
  OS.docs.on(() => { other++; });
  OS.docs.changed(); OS.docs.changed();
  ok(heard === 2 && other === 2, 'OS.docs: every listener hears each change once, also after one of them threw', [heard, other]);
  off(); off(); OS.docs.changed();
  ok(heard === 2 && other === 3, 'OS.docs: off() stops that listener only, and is safe to call twice', [heard, other]);
  const before = OS.docs;
  delete require.cache[require.resolve(D + 'os-core.js')];
  require(D + 'os-core.js');
  OS.docs.changed();
  ok(OS.docs !== before && other === 3, 'OS.docs: a second run of the scripts starts with no listeners', other);
  ok(L.filter((x) => x[0] === 'click').length === 2 && L.filter((x) => x[0] === 'keydown').length === 1, 'a third run still leaves two click listeners and one keydown', L.map((x) => x[0]));
}
// The database, the same way. os-core.js subscribes to ten documents: the viewer's ticks; hub/today and his Hub
// actions; hub/instinct, hub/muse and his reactions; hub/decisions, hub/leo, his answers and his Leo actions.
(async () => {
  const subs = [];
  const docRef = (p) => ({ path: p, onSnapshot(next, error) { const s = { p, next, error, live: true }; subs.push(s); return () => { s.live = false; }; }, set: async () => {}, get: async () => ({ exists: false, data: () => null }) });
  let gate = null;
  const withDb = { use: async (n) => { if (gate) await gate; return n === 'db' ? { doc: docRef } : n === 'user' ? { id: async () => 'u1' } : null; } };
  const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
  const live = () => subs.filter((s) => s.live).map((s) => s.p).sort();
  const run = () => { delete require.cache[require.resolve(D + 'os-core.js')]; require(D + 'os-core.js'); };
  const ready = () => [OS.hub.ready(), OS.sense.ready(), OS.lanes.ready()];
  await settle();
  ok(subs.length === 0 && ready().every((r) => r === true) && OS.hub.state() === 'nodb', 'without a database nothing is subscribed, and ready() is true at once: there is nothing to wait for', [subs.length, ready()]);
  global.claude = withDb;
  run(); await settle();
  const one = live();
  ok(one.length === 10 && new Set(one).size === 10 && subs.length === 10, 'one run subscribes to ten documents, each once', one);
  ok(ready().every((r) => r === false), 'ready(): false while William\'s own documents have not answered', ready());
  const answer = (p, data) => subs.filter((x) => x.live && x.p === p).forEach((x) => x.next({ exists: data != null, data: () => data }));
  answer('hub/today', { counts: { waiting: 1 } }); answer('hub/instinct', { items: [] }); answer('hub/decisions', { items: [] }); answer('hub/leo', { items: [] });
  ok(ready().every((r) => r === false), 'ready(): the agents\' documents answering is not it', ready());
  answer('data/users/u1/hub-actions', null);
  subs.filter((x) => x.live && x.p === 'data/users/u1/sense-acts').forEach((x) => x.error({ code: 'permission-denied' }));
  answer('data/users/u1/decisions', { answers: {} });
  ok(JSON.stringify(ready()) === '[true,true,false]', 'ready(): true once his own document has answered, an error being an answer too; Decide and For Leo wait for both of theirs', ready());
  answer('data/users/u1/leo-acts', null);
  ok(ready().every((r) => r === true), 'ready(): all three', ready());
  run(); await settle();
  ok(JSON.stringify(live()) === JSON.stringify(one) && subs.length === 20, 'a second run leaves the same ten live subscriptions: the first run\'s were closed', [live().length, subs.length]);
  ok(ready().every((r) => r === false), 'ready(): a new run starts over', ready());
  run(); await settle();
  ok(JSON.stringify(live()) === JSON.stringify(one) && subs.length === 30, 'and a third run still leaves ten', [live().length, subs.length]);
  // two runs before the database has answered the first: the run that was replaced opens none
  let open; gate = new Promise((r) => { open = r; });
  run(); run(); open(); gate = null; await settle();
  ok(JSON.stringify(live()) === JSON.stringify(one) && subs.length === 40, 'two runs before the database answers: the one that was replaced subscribes to nothing', [live().length, subs.length]);
  // a viewer the dashboard knows no id for: nothing private to wait for
  global.claude = { use: async (n) => (n === 'db' ? { doc: docRef } : null) };
  run(); await settle();
  ok(live().length === 5 && live().every((p) => /^hub\//.test(p)) && ready().every((r) => r === true), 'without a user id only the five shared documents are read, and ready() is true', [live(), ready()]);
  ok(L.filter((x) => x[0] === 'click').length === 2 && L.filter((x) => x[0] === 'keydown').length === 1, 'after all those runs: still two click listeners and one keydown', L.map((x) => x[0]));
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.stack); process.exit(1); });
