// Instinct and Muse panel on Today (built on the Decide/For Leo harness): signals and ideas render with evidence,
// Salesforce links by opportunity id only, a send through Claude beside the page, and Got it / Not useful / Keep kept in
// William's own sense-acts document. Earlier header follows.
// Decide and For Leo tabs (built on the Today-tab harness): yes/no decisions with the recommendation, the evidence and
// what each answer does; an answer that carries messages hands Claude beside the page the exact texts and recipients,
// and is kept only in William's own decisions document. For Leo: send one recommendation, or tick several and send the
// pack as one direct message to Leo; Done / Not now / Undo. Original header follows.
// Today tab actions (taking action from the OS): an item opens in place with its why, summary and the prepared draft
// (editable); "Send on Slack via Claude" hands Claude beside the page the exact edited text and the recipient with ids,
// and asks it to wait for William's OK; Open in Hub links to the item; Done / Snooze / Dismiss write only William's own
// data/users/<id>/hub-actions document, take the item out of the counts at once, and Undo puts it back. Nothing else is
// written. Synthetic data only, on a fake database and a fake Claude-beside-the-page.
const { Node } = require('./fakedom.js');
process.env.TZ = 'Europe/Stockholm';
const NOW = Date.parse('2026-11-05T09:00:00Z');
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
// clicks: keep each element's listeners so a test can fire them
Node.prototype.addEventListener = function (type, fn) { (this._on = this._on || {})[type] = (this._on[type] || []).concat(fn); };
const fire = (el, type, ev) => (el._on && el._on[type] || []).forEach((f) => f(Object.assign({ stopPropagation() {}, preventDefault() {} }, ev || {})));
const D = '/home/user/revopsemeaos/dashboard/';
const calcs = {}, draws = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => ({ region: 'All', mgr: '', person: '' }), setParams: () => {}, onData: () => {}, colors: Array(8).fill('#111'), setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: () => (v) => String(v), max: () => 0, select: () => ({ selectAll: () => ({ remove() {} }) }) };
const UID = 'u_william';
const DB = { subs: {}, docs: {}, writes: [] };
const snapOf = (p, data) => ({ id: p.split('/').pop(), exists: data != null, data: () => data, metadata: { fromCache: false } });
const docRef = (p) => ({ id: p.split('/').pop(), path: p, get: async () => snapOf(p, DB.docs[p]),
  onSnapshot(next) { (DB.subs[p] = DB.subs[p] || []).push(next); return () => {}; },
  set: async (data) => { if (!['data/users/' + UID + '/sense-acts'].includes(p)) throw new Error('unexpected write to ' + p); DB.writes.push({ p, data: JSON.parse(JSON.stringify(data)) }); DB.docs[p] = data; },
  update: async () => { throw new Error('unexpected update to ' + p); } });
const fakeDb = { doc: docRef, collection: (c) => ({ doc: (id) => docRef(c + '/' + id) }) };
const SENT = [];
const room = { canSendToClaudeSession: async () => 'available', sendToClaudeSession: async (d) => { SENT.push(d); } };
global.claude = { use: async (n) => (n === 'db' ? fakeDb : n === 'user' ? { id: async () => UID } : n === 'room' ? room : null) };
document.querySelector = (sel) => (/data-view-panel/.test(sel) ? new Node('div') : null);
for (const f of ['os-core.js', 'os-calcs.js', 'os-calcs-leads.js', 'os-calcs-act.js', 'os-calcs-conv.js', 'os-draw.js']) require(D + f);
let fails = 0, passes = 0; const ok = (c, l, x) => { if (!c) fails++; else passes++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const walk = (n, f) => { f(n); for (const c of n.children || []) walk(c, f); };
const find = (el, pick) => { const out = []; walk(el, (n) => { if (pick(n)) out.push(n); }); return out; };
const draw = (name, tag = 'div', ds = {}) => { const el = new Node(tag); el.dataset.draw = name; Object.assign(el.dataset, ds); draws[name](el); return el; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const HUB = 'https://claude.ai/artifact/DBfeBDJhUg78LXARWBwSfU';


const INST = { at: '2026-11-14T07:07:00Z', items: [
  { id: 'ins-q4-pushes', level: 'alert', title: '23 deals over $50k pushed out of Q4 this week', change: { label: 'Net Q4 pipe moved', from: '$0', to: '−$1.1M' }, why: 'Pushes outran pull-ins.',
    evidence: [{ label: 'Pushed out', value: '23 · $1.9M' }], links: [{ label: '$179k · Nordics', oppId: '006Pn00000lk5fxIAA' }, { label: 'bad', oppId: 'javascript:x' }],
    action: { label: 'Ask the directors', sends: [{ type: 'slack', to: [{ name: 'Karl Stein', slackId: 'U0KARL1234' }], body: 'Karl, can we look at the pushes?' }] } },
  { id: 'ins-pipegen-ahead', level: 'good', title: 'November pipegen is ahead of October', why: 'Count +64%.' },
] };
const MUSE = { at: '2026-11-14T07:07:00Z', items: [
  { id: 'muse-deferred', title: 'Turn Deferred losses into Q1 pipeline', idea: 'Reopen them dated.', whyNow: '36 this week.', firstStep: 'Pull the list.', challenge: 'Is deferral a loss?', message: 'Leo, deferred idea.' },
  { id: 'muse-ae-prospecting', kind: 'challenge', title: 'Should AEs stop prospecting in December?', idea: 'Close instead.' },
] };
const LEO = { at: 'x', to: { name: 'Leonard Schreij', slackId: 'U0LEO12345' }, items: [] };
(async () => {
  await tick(); await tick(); await tick();
  const sub = (p) => DB.subs[p] || [];
  ok(sub('hub/instinct').length === 1 && sub('hub/muse').length === 1 && sub('data/users/' + UID + '/sense-acts').length === 1, 'subscribes once each to hub/instinct, hub/muse and William\'s sense-acts');
  sub('hub/instinct')[0](snapOf('hub/instinct', INST)); sub('hub/muse')[0](snapOf('hub/muse', MUSE)); sub('hub/leo')[0](snapOf('hub/leo', LEO));
  sub('data/users/' + UID + '/sense-acts')[0](snapOf('x', null));
  await OS.ask.refresh(); await tick();
  const btns = (el) => find(el, (n) => n.tagName === 'BUTTON');
  const label = (el, t) => btns(el).find((b) => b.textContent === t);
  let el = draw('sense', 'div');
  const cols = el.children;
  ok(cols.length === 2 && /Instinct/.test(cols[0].textContent) && /Muse/.test(cols[1].textContent), 'two columns: Instinct and Muse');
  let ic = cols[0].children.find((n) => n.tagName === 'UL').children;
  ok(ic.length === 2 && /Needs a look/.test(ic[0].textContent) && /Net Q4 pipe moved: \$0 → −\$1\.1M/.test(ic[0].textContent) && /Good news/.test(ic[1].textContent), 'signals show level, the change and the why');
  const links = find(ic[0], (n) => n.tagName === 'A');
  ok(links.length === 1 && links[0].href === 'https://legora.lightning.force.com/lightning/r/Opportunity/006Pn00000lk5fxIAA/view' && links[0].textContent === '$179k · Nordics', 'Salesforce links by opportunity id only; a bad id is dropped');
  fire(label(ic[0], 'Ask the directors via Claude'), 'click'); await tick(); await tick();
  ok(SENT.length === 1 && /Karl Stein \(U0KARL1234\)/.test(SENT[0].ask) && /Karl, can we look at the pushes\?/.test(SENT[0].ask) && /send only after my OK/.test(SENT[0].ask), 'the prepared action goes to Claude with recipient, text and an OK step');
  el = draw('sense', 'div'); ic = el.children[0].children.find((n) => n.tagName === 'UL').children;
  ok(/Sent to Claude/.test(ic[0].textContent), 'a sent signal says so');
  fire(label(ic[1], 'Got it'), 'click'); await tick(); await tick();
  el = draw('sense', 'div'); ic = el.children[0].children.find((n) => n.tagName === 'UL').children;
  ok(ic.length === 1 && /1 handled today/.test(el.children[0].textContent), 'Got it hides the signal and counts it handled');
  ok(DB.writes.length >= 2 && DB.writes.every((w) => w.p === 'data/users/' + UID + '/sense-acts') && DB.writes[DB.writes.length - 1].data.acts['ins-pipegen-ahead'].action === 'ack', 'reactions are written only to William\'s sense-acts');
  let mc = el.children[1].children.find((n) => n.tagName === 'UL').children;
  ok(mc.length === 2 && /First step: Pull the list\./.test(mc[0].textContent) && /Is deferral a loss\?/.test(mc[0].textContent) && /Challenge/.test(mc[1].textContent), 'ideas show the first step, the challenge and a challenge chip');
  fire(label(mc[0], 'Send to Leo via Claude'), 'click'); await tick(); await tick();
  ok(SENT.length === 2 && /direct message to Leonard Schreij \(U0LEO12345\)/.test(SENT[1].ask) && /Leo, deferred idea\./.test(SENT[1].ask), 'an idea goes to Leo through Claude');
  el = draw('sense', 'div'); mc = el.children[1].children.find((n) => n.tagName === 'UL').children;
  fire(label(mc[1], 'Keep'), 'click'); await tick(); await tick();
  el = draw('sense', 'div'); mc = el.children[1].children.find((n) => n.tagName === 'UL').children;
  ok(mc.length === 2 && label(mc[1], 'Kept ✓') && /kept/.test(mc[1].className), 'Keep pins an idea and it stays');
  fire(label(mc[1], 'Not useful'), 'click'); await tick(); await tick();
  el = draw('sense', 'div'); mc = el.children[1].children.find((n) => n.tagName === 'UL').children;
  ok(mc.length === 1 && OS.sense.acted('muse-ae-prospecting').action === 'notuseful', 'Not useful hides it and records why for the task');
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.stack); process.exit(1); });
