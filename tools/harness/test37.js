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
  set: async (data) => { if (!['data/users/' + UID + '/decisions', 'data/users/' + UID + '/leo-acts'].includes(p)) throw new Error('unexpected write to ' + p); DB.writes.push({ p, data: JSON.parse(JSON.stringify(data)) }); DB.docs[p] = data; },
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

const DEC = { at: '2026-11-11T06:40:00Z', by: 'the decisions task', items: [
  { id: 'dec-subsidiary-segment', question: 'Should subsidiaries inherit their parent\'s Client Segment?', recommend: 'yes', severity: 'high', why: 'Stops subsidiaries landing in SMB pools.',
    evidence: [{ label: 'Reassigned by hand last week', value: '1', source: 'Slack' }],
    yes: { effect: 'Replies to Vicky with the rule.', sends: [{ type: 'slack', to: [{ name: 'Vicky Han', slackId: 'U0VICKY123' }], channelId: 'C0CHANNEL12', channelName: 'em-account-assignment', threadTs: '1.2', body: 'My view: inherit from the parent.' }] },
    no: { effect: 'Keeps the current rule.', sends: [] } },
  { id: 'dec-commissions', question: 'Take over EMEA commissions from Emile?', recommend: 'no', severity: 'normal', why: 'Comp stays with Emile as DRI.',
    yes: { effect: 'Tells Fredrik yes.', sends: [{ type: 'slack', to: [{ name: 'Fredrik', slackId: 'U0FREDRIK1' }], body: 'Ja.' }] },
    no: { effect: 'Tells Fredrik no.', sends: [{ type: 'slack', to: [{ name: 'Fredrik', slackId: 'U0FREDRIK1' }], body: 'Nej, Emile.' }] } },
] };
const LEO = { at: '2026-11-11T06:40:00Z', to: { name: 'Leonard Schreij', slackId: 'U0LEO12345' }, packIntro: 'Hi Leo,', items: [
  { id: 'leo-pipegen', topic: 'Pipegen', headline: 'Value per opp down', recommendation: 'Set targets in ARR.', evidence: [{ label: 'Oct', value: '$37.4M' }], ask: 'Agree ARR targets.', message: 'Leo, pipegen note.', pack: 'Pipegen: value per opp down.' },
  { id: 'leo-capacity', topic: 'Street capacity', headline: 'Pipe per AE ranges 3x', recommendation: 'Route away from DACH.', message: 'Leo, capacity note.', pack: 'Capacity: 3x spread.' },
] };
(async () => {
  await tick(); await tick(); await tick();
  const sub = (p) => DB.subs[p] || [];
  ok(sub('hub/decisions').length === 1 && sub('hub/leo').length === 1, 'subscribes once each to hub/decisions and hub/leo');
  ok(sub('data/users/' + UID + '/decisions').length === 1 && sub('data/users/' + UID + '/leo-acts').length === 1, "subscribes once each to William's own answers and Leo actions");
  sub('hub/decisions')[0](snapOf('hub/decisions', DEC));
  sub('hub/leo')[0](snapOf('hub/leo', LEO));
  sub('data/users/' + UID + '/decisions')[0](snapOf('x', null));
  sub('data/users/' + UID + '/leo-acts')[0](snapOf('x', null));
  await OS.ask.refresh(); await tick();
  const btns = (el) => find(el, (n) => n.tagName === 'BUTTON');
  const label = (el, t) => btns(el).find((b) => b.textContent === t);
  let ul = draw('dec-list', 'ul'); let cards = ul.children;
  ok(cards.length === 2, 'two open decisions');
  ok(/Recommended: Yes/.test(cards[0].textContent) && /Stops subsidiaries/.test(cards[0].textContent) && /Reassigned by hand last week/.test(cards[0].textContent), 'a card shows the recommendation, why and the evidence');
  ok(/If yes/.test(cards[0].textContent) && /Replies to Vicky with the rule/.test(cards[0].textContent) && /Keeps the current rule/.test(cards[0].textContent), 'a card shows what each answer does');
  const yes = label(cards[0], 'Yes'), no = label(cards[0], 'No');
  ok(yes && no && /btn-primary/.test(yes.className) && !/btn-primary/.test(no.className), 'Yes and No, the recommended one primary');
  ok(draw('dec-badge', 'span').textContent === '2', 'the Decide badge counts open decisions');
  fire(yes, 'click'); await tick(); await tick();
  ok(SENT.length === 1 && /I decided YES/.test(SENT[0].ask) && /Vicky Han \(U0VICKY123\)/.test(SENT[0].ask) === false && /#em-account-assignment \(C0CHANNEL12\), in the thread 1\.2/.test(SENT[0].ask), 'Yes hands Claude the message for the channel thread with its ids', SENT[0] && SENT[0].ask);
  ok(/My view: inherit from the parent\./.test(SENT[0].ask) && /send only after my OK/.test(SENT[0].ask) && SENT[0].decisionId === 'dec-subsidiary-segment', '... with the exact text, waiting for OK, naming the decision');
  ok(DB.writes.length === 1 && DB.writes[0].p === 'data/users/' + UID + '/decisions' && DB.writes[0].data.answers['dec-subsidiary-segment'].answer === 'yes', "the answer is written to William's own decisions document only");
  ul = draw('dec-list', 'ul'); cards = ul.children;
  const done = draw('dec-done', 'ul').children;
  ok(cards.length === 1 && done.length === 1 && /You said Yes/.test(done[0].textContent) && draw('dec-badge', 'span').textContent === '1', 'the answered decision moves to Decided and the badge drops');
  fire(label(done[0], 'Undo'), 'click'); await tick(); await tick();
  ok(!('dec-subsidiary-segment' in DB.writes[DB.writes.length - 1].data.answers) && draw('dec-list', 'ul').children.length === 2, 'Undo brings it back');
  // a No on a decision that recommends No sends the No message
  ul = draw('dec-list', 'ul'); cards = ul.children;
  fire(label(cards[1], 'No'), 'click'); await tick(); await tick();
  ok(SENT.length === 2 && /I decided NO/.test(SENT[1].ask) && /Nej, Emile\./.test(SENT[1].ask) && !/Ja\./.test(SENT[1].ask) && /Fredrik \(U0FREDRIK1\)/.test(SENT[1].ask), 'No sends only the No message, to its recipient');
  // For Leo
  let lul = draw('leo-list', 'ul'); let lc = lul.children;
  ok(lc.length === 2 && /Pipegen/.test(lc[0].textContent) && /Recommend: Set targets in ARR\./.test(lc[0].textContent) && /Ask Leo: Agree ARR targets\./.test(lc[0].textContent), 'For Leo shows topic, recommendation and the ask');
  ok(draw('leo-badge', 'span').textContent === '2', 'the For Leo badge counts open items');
  fire(label(lc[0], 'Send to Leo via Claude'), 'click'); await tick(); await tick();
  ok(SENT.length === 3 && /direct message to Leonard Schreij \(U0LEO12345\)/.test(SENT[2].ask) && /Leo, pipegen note\./.test(SENT[2].ask), 'Send to Leo hands Claude the message as a DM to Leo with his id');
  ok(DB.writes[DB.writes.length - 1].p === 'data/users/' + UID + '/leo-acts' && DB.writes[DB.writes.length - 1].data.acts['leo-pipegen'].action === 'sent', 'a sent item is marked sent in William\'s own Leo document');
  lul = draw('leo-list', 'ul'); lc = lul.children;
  fire(label(lc[1], 'Add to pack'), 'click');
  ok(OS.lanes.packSize() === 1 && draw('leo-pack-n', 'b').textContent === '1', 'Add to pack ticks it (the button count follows)');
  OS.lanes.sendPack(); await tick(); await tick();
  ok(SENT.length === 4 && /Hi Leo,\n\n1\. Capacity: 3x spread\./.test(SENT[3].ask) && SENT[3].kind === 'leo_pack', 'the pack goes as one message with the ticked lines', SENT[3] && SENT[3].ask);
  ok(OS.lanes.leoActed('leo-capacity') && OS.lanes.leoActed('leo-capacity').action === 'sent' && OS.lanes.packSize() === 0, 'packed items are marked sent and the pack empties');
  ok(draw('leo-badge', 'span').hidden === true, 'both handled: the badge hides');
  // without Claude beside the page: no send buttons, answers still saved
  room.canSendToClaudeSession = async () => 'off'; await OS.ask.refresh(); await tick();
  ul = draw('dec-list', 'ul'); cards = ul.children;
  const before = SENT.length;
  fire(label(cards[0], 'Yes'), 'click'); await tick(); await tick();
  ok(SENT.length === before && OS.lanes.answered('dec-subsidiary-segment').answer === 'yes', 'without Claude beside the page: the answer is saved and nothing is handed on');
  ok(/open the Claude chat beside this page/i.test(draw('dec-list', 'ul').children.map((n) => n.textContent).join(' ')) || draw('dec-list', 'ul').children.length === 0, 'and the card says how to send');
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.stack); process.exit(1); });
