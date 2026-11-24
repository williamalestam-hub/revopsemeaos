// The dashboard runs its scripts again, in the same window, when a file changes while the page is open. Listeners on
// document must not stack: with two click handlers, one click ticked an action item and the second unticked it at once.
// Loads os-core.js twice and checks that each page-wide listener is there once, and that one click toggles a tick once.
// Also the small bus the cockpit listens on (OS.docs): on, off and changed, and a fresh one after a second run.
const { Node } = require('./fakedom.js');
const D = '/home/user/revopsemeaos/dashboard/';
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
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
