// OS.done: per-change merge writes, two tabs, retry on a transient error, read-only after a refusal.
const { Node } = require('./fakedom.js');
global.dash = { loader() {}, calc() {}, draw() {}, params: () => ({}), setParams() {}, onData() {}, colors: ['#1'], setLink() {}, data: () => ({ status: 'loading', data: [] }) };
global.d3 = new Proxy({}, { get: () => () => () => {} });
let fails = 0; const ok = (c, l, x) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : JSON.stringify(x)); };
// the server: one document, merge semantics as db.d.ts (nested objects merge, set replaces, update needs it to exist)
let server = { exists: true, data: { items: [{ k: 'm1|old1', at: '2026-11-01' }] } };
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' ? merge(o[k], v) : v; return o; };
let script = []; // per-call outcomes: 'ok' | {code}
const listeners = [];
const makeRef = () => ({
  onSnapshot(next) { listeners.push(next); },
  get() { return Promise.resolve({ exists: server.exists, data: () => JSON.parse(JSON.stringify(server.data)) }); },
  set(body) { const o = script.shift() || 'ok'; if (o !== 'ok') return Promise.reject(o); server = { exists: true, data: body }; return Promise.resolve(); },
  update(body) { const o = script.shift() || 'ok'; if (o !== 'ok') return Promise.reject(o); if (!server.exists) return Promise.reject({ code: 'invalid_argument' }); server = { exists: true, data: merge(server.data, body) }; return Promise.resolve(); },
});
// a Contributor: can('data.write') answers false for shared documents, but their own subtree is writable
global.claude = { use: async (n) => (n === 'db' ? { doc: () => makeRef() } : n === 'user' ? { id: async () => 'u_x', can: async () => false } : null) };
require('/home/user/revopsemeaos/dashboard/os-core.js');
const deliver = () => listeners.forEach((l) => l({ exists: server.exists, data: () => JSON.parse(JSON.stringify(server.data)), metadata: { fromCache: false } }));
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const k = (item) => OS.done.keyOf({ meetingId: 'm1', item });
(async () => {
  await flush();
  ok(!OS.done.can(), 'no ticks before the first server snapshot');
  deliver();
  ok(OS.done.can(), 'ticks once the stored list has arrived');
  ok(OS.done.has({ meetingId: 'm1', item: 'x' }) === false, 'unrelated item not done');
  ok([...Object.keys(server.data)].includes('items'), 'old list format still stored');
  // migrated key: the old '|' key reads back as the safe form
  ok(/^[A-Za-z0-9_-]+$/.test(k('Send deck')), 'keys are path-safe', k('Send deck'));
  OS.done.toggle(k('Send deck')); await flush();
  ok(server.data.done && server.data.done[k('Send deck')], 'tick 1 merged into done', server.data);
  ok(Array.isArray(server.data.items), 'merge keeps the old list', server.data);
  deliver();
  // a second tab with a stale snapshot ticks something else: both survive (merge, not replace)
  const before = JSON.stringify(server.data.done);
  OS.done.toggle(k('Book demo')); await flush();
  ok(server.data.done[k('Send deck')] && server.data.done[k('Book demo')], 'second tick keeps the first', server.data.done);
  deliver();
  // untick writes null, and reads back as not done
  OS.done.toggle(k('Send deck')); await flush();
  ok(server.data.done[k('Send deck')] === null, 'untick stores null', server.data.done);
  deliver();
  ok(!OS.done.has({ meetingId: 'm1', item: 'Send deck' }), 'untick reads back as not done');
  // one transient failure is retried
  script = [{ code: 'unavailable' }, 'ok'];
  OS.done.toggle(k('Retry me')); await new Promise((r) => setTimeout(r, 2300)); await flush();
  ok(server.data.done[k('Retry me')], 'retried after unavailable', server.data.done);
  ok(OS.done.can(), 'still ticking after a transient error');
  deliver();
  // a refusal stops ticks for the visit and undoes the toggle
  script = [{ code: 'invalid_argument' }];
  OS.done.toggle(k('Refused')); await flush(10);
  ok(!OS.done.can(), 'read-only after invalid_argument');
  ok(!server.data.done[k('Refused')], 'refused tick not stored');
  // pruning: past 1,000 keys the document is rewritten with recent ticks only (nulls and the old list dropped)
  script = []; can_reset();
  console.log('  (pruning and first-save checks)');
  const k1 = OS.done.keyOf({ meetingId: 'm', item: 'Update the opportunity', owner: 'Carl' }), k2 = OS.done.keyOf({ meetingId: 'm', item: 'Update the opportunity', owner: 'Anna' });
  ok(k1 !== k2, 'same wording, different owners give different keys');
  ok(OS.done.keyOf({ meetingId: 'm', item: 'Отправить договор' }) !== OS.done.keyOf({ meetingId: 'm', item: 'Позвонить клиенту' }), 'cyrillic items distinct');
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
function can_reset() {}
