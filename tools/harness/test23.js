// Ticks: two tabs before the first save, pruning past 1,000 keys, and a full document.
const { Node } = require('./fakedom.js');
let fails = 0; const ok = (c, l, x) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : JSON.stringify(x)); };
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' ? merge(o[k], v) : v; return o; };
const flush = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
// one shared server; each tab is a fresh load of os-core with its own snapshot listeners
const server = { exists: false, data: null, limitKeys: Infinity };
const loadTab = () => {
  delete require.cache[require.resolve('/home/user/revopsemeaos/dashboard/os-core.js')];
  const listeners = [];
  global.dash = { loader() {}, calc() {}, draw() {}, params: () => ({}), setParams() {}, onData() {}, colors: ['#1'], setLink() {}, data: () => ({ status: 'loading', data: [] }) };
  global.d3 = new Proxy({}, { get: () => () => () => {} });
  const ref = {
    onSnapshot(next) { listeners.push(next); },
    get() { return Promise.resolve({ exists: server.exists, data: () => JSON.parse(JSON.stringify(server.data)) }); },
    set(body) { if (Object.keys(body.done || {}).length > server.limitKeys) return Promise.reject({ code: 'invalid_argument' }); server.exists = true; server.data = body; return Promise.resolve(); },
    update(body) { if (!server.exists) return Promise.reject({ code: 'invalid_argument' }); const next = merge(server.data, body); if (Object.keys(next.done || {}).length > server.limitKeys) return Promise.reject({ code: 'invalid_argument' }); server.data = next; return Promise.resolve(); },
  };
  global.claude = { use: async (n) => (n === 'db' ? { doc: () => ref } : n === 'user' ? { id: async () => 'u_x', can: async () => false } : null) };
  require('/home/user/revopsemeaos/dashboard/os-core.js');
  const tab = { OS: global.OS, deliver: () => listeners.forEach((l) => l({ exists: server.exists, data: () => JSON.parse(JSON.stringify(server.data)), metadata: { fromCache: false } })) };
  return tab;
};
(async () => {
  const A = loadTab(); await flush(); A.deliver();
  const B = loadTab(); await flush(); B.deliver();
  const ka = A.OS.done.keyOf({ meetingId: 'm1', item: 'Send deck' }), kb = B.OS.done.keyOf({ meetingId: 'm1', item: 'Book demo' });
  ok(A.OS.done.can() && B.OS.done.can(), 'both tabs offer ticks (no document yet)');
  A.OS.done.toggle(ka); await flush();
  B.OS.done.toggle(kb); await flush(); // B has not seen A's document yet
  ok(server.data && server.data.done[ka] && server.data.done[kb], 'second tab merges into the first tab\'s new document', server.data);
  // pruning: fill past 1,000 keys with old ticks and unticks, then one more tick rewrites the document compactly
  const old = {}; for (let i = 0; i < 1100; i++) old['m' + i + '_x'] = i % 2 ? null : '2025-01-01';
  server.data = { done: { ...server.data.done, ...old }, items: [{ k: 'legacy|1', at: '2025-01-01' }] };
  const C = loadTab(); await flush(); C.deliver();
  C.OS.done.toggle(C.OS.done.keyOf({ meetingId: 'm2', item: 'Fresh tick' })); await flush();
  const keys = Object.keys(server.data.done);
  ok(keys.length < 50 && !server.data.items && keys.every((k) => server.data.done[k]), 'past 1,000 keys the document is rewritten with recent ticks only', keys.length);
  ok(server.data.done[ka] && server.data.done[kb], 'recent ticks survive the rewrite');
  // a full document: the first merge is refused, compaction is tried once, ticks stay on
  server.limitKeys = 60;
  const big = {}; for (let i = 0; i < 300; i++) big['n' + i + '_y'] = '2026-11-01';
  server.data = { done: big };
  const D = loadTab(); await flush(); D.deliver();
  D.OS.done.toggle(D.OS.done.keyOf({ meetingId: 'm3', item: 'One more' })); await new Promise((r) => setTimeout(r, 2500)); await flush();
  ok(!D.OS.done.can(), 'a document that still cannot fit after compacting turns ticks off (no endless retries)');
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
