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
  set: async (data) => { if (p !== 'data/users/' + UID + '/hub-actions') throw new Error('unexpected write to ' + p); DB.writes.push({ p, data: JSON.parse(JSON.stringify(data)) }); DB.docs[p] = data; },
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
const DOC = { at: '2026-11-05T08:00:00Z', hubUrl: HUB, counts: { waiting: 2, critical: 0, prepared: 1, doneToday: 0 }, lastRun: { at: '2026-11-05T08:00:00Z', status: 'ok' }, brief: { headline: 'h' },
  top: [
    { id: 'sl-D1-1', title: 'Vicky asks about round robins', kind: 'ask', severity: 'normal', status: 'waiting', dueAt: null, why: 'Unanswered since 02:35', summary: 'Should the new rep be in both pools?',
      draft: { type: 'slack', title: 'Reply', to: [{ name: 'Vicky Han', slackId: 'U0VICKY123' }], body: 'Yes, add him to both.' } },
    { id: 'gr-m-1-share-doc', title: 'Share the routing doc', kind: 'task', severity: 'high', status: 'waiting', dueAt: null, draft: { type: 'doc', title: 'Routing doc', to: [], body: '# Routing\n- a' } },
    { id: 'gr-m-1-unclear', title: 'Unclear owner', kind: 'task', severity: 'low', status: 'new', dueAt: null },
  ] };
(async () => {
  await tick(); await tick(); await tick();
  ok(Array.isArray(DB.subs['hub/today']) && DB.subs['hub/today'].length === 1, 'subscribes once to hub/today');
  ok(Array.isArray(DB.subs['data/users/' + UID + '/hub-actions']) && DB.subs['data/users/' + UID + '/hub-actions'].length === 1, "subscribes once to William's own hub-actions document");
  DB.subs['hub/today'][0](snapOf('hub/today', DOC));
  DB.subs['data/users/' + UID + '/hub-actions'][0](snapOf('x', null));
  await OS.ask.refresh(); await tick();
  ok(OS.ask.can() === true, 'Claude beside the page is available in this run');
  let ul = draw('hub-top', 'ul');
  let rows = find(ul, (n) => n.tagName === 'LI');
  ok(rows.length === 3 && find(ul, (n) => n.tagName === 'TEXTAREA').length === 0, 'three rows, closed');
  fire(find(rows[0], (n) => n.className === 'hub-head')[0], 'click');
  ul = draw('hub-top', 'ul'); rows = find(ul, (n) => n.tagName === 'LI');
  const ta = find(rows[0], (n) => n.tagName === 'TEXTAREA')[0];
  ok(ta && ta.value === 'Yes, add him to both.', 'opened: the draft is in an editable box', ta && ta.value);
  ok(/Unanswered since 02:35/.test(rows[0].textContent) && /Slack message to Vicky Han/.test(rows[0].textContent), 'opened: why and recipient are shown');
  const btns = (row) => find(row, (n) => n.tagName === 'BUTTON' || n.tagName === 'A');
  const label = (row, t) => btns(row).find((b) => b.textContent === t);
  ok(label(rows[0], 'Send on Slack via Claude') && label(rows[0], 'Done') && label(rows[0], 'Snooze 1 day') && label(rows[0], 'Dismiss'), 'opened: Send on Slack via Claude, Done, Snooze 1 day, Dismiss');
  const open = label(rows[0], 'Open in Hub');
  ok(open && open.href === HUB + '#item=sl-D1-1' && open.target === '_blank', 'Open in Hub links to the item in the Hub', open && open.href);
  ta.value = 'Yes, add him to both pools today.'; fire(ta, 'input');
  fire(label(rows[0], 'Send on Slack via Claude'), 'click'); await tick();
  ok(SENT.length === 1, 'one request handed to Claude beside the page');
  const ask = SENT[0] && SENT[0].ask || '';
  ok(/exactly as written/.test(ask) && /Vicky Han \(U0VICKY123\)/.test(ask) && /send only after my OK/.test(ask), 'the request names the recipient with the Slack id and waits for OK');
  ok(/Yes, add him to both pools today\./.test(ask) && !/Yes, add him to both\.$/.test(ask), 'the request carries the edited text, not the original');
  ok(SENT[0].itemId === 'sl-D1-1' && SENT[0].source === 'EMEA RevOps OS', 'the request names the item and the source');
  ok(DB.writes.length === 0, 'sending writes nothing');
  // Done
  ul = draw('hub-top', 'ul'); rows = find(ul, (n) => n.tagName === 'LI');
  fire(label(rows[0], 'Done'), 'click'); await tick(); await tick();
  ok(DB.writes.length === 1 && DB.writes[0].data.actions['sl-D1-1'].action === 'done', 'Done writes William\'s hub-actions document', DB.writes);
  ok(DB.writes[0].p === 'data/users/' + UID + '/hub-actions', '... and nowhere else');
  const count = (field) => draw('hub-count', 'b', { field }).textContent;
  ok(count('waiting') === '1' && count('doneToday') === '1', 'Done counts at once: Needs you 2 → 1, Done today 0 → 1', [count('waiting'), count('doneToday')]);
  ul = draw('hub-top', 'ul'); rows = find(ul, (n) => n.tagName === 'LI');
  ok(/hub-acted/.test(rows[0].className) && /Done here · reaches the Hub at its next run/.test(rows[0].textContent), 'the row says Done here and when it reaches the Hub');
  ok(label(rows[0], 'Undo') && !label(rows[0], 'Send on Slack via Claude'), 'a done row offers Undo and no send');
  fire(label(rows[0], 'Undo'), 'click'); await tick(); await tick();
  ok(DB.writes.length === 2 && !('sl-D1-1' in DB.writes[1].data.actions) && count('waiting') === '2', 'Undo removes the entry and the count comes back');
  // Snooze sets until a day later; Dismiss on a doc item
  fire(find(rows[1], (n) => n.className === 'hub-head')[0], 'click');
  ul = draw('hub-top', 'ul'); rows = find(ul, (n) => n.tagName === 'LI');
  ok(label(rows[1], 'Create Google Doc via Claude'), 'a doc draft offers Create Google Doc via Claude');
  fire(label(rows[1], 'Snooze 1 day'), 'click'); await tick(); await tick();
  const sn = DB.writes[DB.writes.length - 1].data.actions['gr-m-1-share-doc'];
  ok(sn && sn.action === 'snoozed' && Date.parse(sn.until) - NOW === 864e5, 'Snooze 1 day: until is 24 h later', sn);
  ok(count('doneToday') === '0' && count('waiting') === '1', 'a snooze leaves Needs you but is not Done');
  // without Claude beside the page there is no send button, and the note says how
  room.canSendToClaudeSession = async () => 'off'; await OS.ask.refresh(); await tick();
  ul = draw('hub-top', 'ul'); rows = find(ul, (n) => n.tagName === 'LI');
  ok(!label(rows[0], 'Send on Slack via Claude') && /Open the Claude chat beside this page/.test(rows[0].textContent), 'without Claude beside the page: no send button, a note instead');
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.stack); process.exit(1); });
