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
const D = require('path').join(__dirname, '../../dashboard/');
const calcs = {}, draws = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => ({ region: 'All', mgr: '', person: '' }), setParams: () => {}, onData: () => {}, colors: Array(8).fill('#111'), setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: () => (v) => String(v), max: () => 0, select: () => ({ selectAll: () => ({ remove() {} }) }) };
const UID = 'u_william';
const DB = { subs: {}, errs: {}, docs: {}, writes: [] };
const snapOf = (p, data) => ({ id: p.split('/').pop(), exists: data != null, data: () => data, metadata: { fromCache: false } });
const docRef = (p) => ({ id: p.split('/').pop(), path: p, get: async () => snapOf(p, DB.docs[p]),
  onSnapshot(next, error) { (DB.subs[p] = DB.subs[p] || []).push(next); DB.errs[p] = error; return () => {}; },
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
  // the cockpit's lane, before William's reactions have answered
  require(D + 'os-cockpit-model.js'); // the rooms: which agents a lane draws
  sub('hub/renewals')[0](snapOf('hub/renewals', { at: '2026-11-05T05:50:40Z', status: 'ok', trial: false, items: [{ id: 'rn-late', title: 'Two renewals are running late' }] }));
  const early = draw('ck-lane', 'ul', { ckRoom: 'arr' });
  ok(OS.sense.state('renewals') === 'ok' && OS.sense.items('renewals').length === 1 && OS.sense.ready() === false && early.children.length === 0, 'the cockpit\'s lane makes no card before his reactions have answered: one he had handled would show and then go');
  ok(typeof OS.sense.cards === 'function' && OS.sense.cards('renewals').length === 0, 'that rule is the reader\'s own (OS.sense.cards, which the lane draws from and the cockpit marks a chip by): no card of a department agent before his reactions have answered');
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
  // ---- a department agent's cards (the cockpit's lane): the same card, with whose it is, and the trial rule ----
  draws['ck-lane'](early);
  ok(OS.sense.ready() === true && early.children.length === 1 && early.children[0].dataset.ckOf === 'renewals' && /Two renewals are running late/.test(early.textContent), 'once they have answered, the card is there');
  ok(OS.sense.cards('renewals').map((x) => x.id).join() === 'rn-late' && OS.sense.items('instinct').length === 2 && ['instinct', 'muse', 'pacing', 'nobody', undefined].every((k) => OS.sense.cards(k).length === 0),
    '... and the reader says so: that agent has the one card; Instinct, Muse and an agent the page reads no document of have none (cards are a department document\'s)');
  sub('hub/renewals')[0](snapOf('hub/renewals', null));
  const SWEEP = { at: '2026-11-05T05:50:40Z', status: 'ok', trial: true, run: 'ask', scope: 'All EMEA · New Business and Upsell', items: [
    { id: 'sw-ask', level: 'watch', title: 'Seven checks, counted per team', why: 'The largest check is a third of all open deals.', evidence: [{ label: 'Stage 0 after a meeting', value: '41 · $1.2M' }], action: { label: 'Post the ask', sends: [{ type: 'slack', body: 'Team, this week\'s ask.' }] }, source: 'Salesforce, counted Thursday 06:50 Stockholm' },
    { id: 'sw-teams', level: 'watch', title: 'Flags by team' }, { id: 'sw-3', title: 'Three' }, { id: 'sw-4', title: 'Four' }, { id: 'sw-5', title: 'Five' }] };
  ok(['sweeper', 'accounts', 'forecast', 'renewals', 'prep'].every((k) => sub('hub/' + k).length === 1) && sub('hub/pacing').length + sub('hub/rundown').length === 0 && OS.sense.state('sweeper') === 'loading' && OS.sense.state('pacing') === undefined,
    'subscribes once to each department agent\'s document (hub/sweeper, accounts, forecast, renewals, prep); Pacing and Rundown have none');
  sub('hub/sweeper')[0](snapOf('hub/sweeper', SWEEP)); sub('hub/accounts')[0](snapOf('hub/accounts', null)); sub('hub/prep')[0](snapOf('hub/prep', { at: '2026-11-05T05:50:40Z', status: 'error' }));
  ok(OS.sense.state('sweeper') === 'ok' && OS.sense.state('accounts') === 'missing' && OS.sense.items('sweeper').length === 4 && OS.sense.items('instinct').length === 2 && OS.sense.state('prep') === 'ok' && OS.sense.items('prep').length === 0,
    'a department agent\'s document is read like Instinct\'s; only its first four items count; one without items (a failed run) is still a result');
  const reads = (d) => { sub('hub/forecast')[0](snapOf('hub/forecast', d)); return OS.sense.state('forecast'); };
  ok([{}, { hubUrl: 'https://claude.ai/x', trial: true }, { items: 'none', at: '', status: '' }, { at: 7, status: null }, [], 'text', 7].map(reads).join() === Array(7).fill('missing').join() && [{ at: '2026-11-05T05:50:40Z' }, { status: 'error' }, { items: [] }].map(reads).join() === 'ok,ok,ok' && reads(null) === 'missing',
    'a document that says neither when nor how a run ended and lists no items is a placeholder: its agent has not run yet; any one of the three makes it a result');
  reads({ at: '2026-11-05T11:10:30Z', status: 'ok', trial: false, items: [{ id: '', title: 'An item without an id' }, { id: 'fc-1', title: 'The roll-up and the call differ' }, { id: '', title: 'Another one without' }] });
  const noId = draw('ck-lane', 'ul', { ckRoom: 'arr' }).children;
  ok(OS.sense.items('forecast').map((x) => x.id).join() === 'fc-1' && OS.sense.cards('forecast').length === 1 && noId.length === 1 && /The roll-up and the call differ/.test(noId[0].textContent) && !/without/.test(noId[0].textContent) && reads(null) === 'missing',
    'a department agent\'s item whose id is empty is left out: it is not counted and gets no card (his reactions are kept by id, so Got it and Not useful could never take it away)', OS.sense.items('forecast').map((x) => x.id));
  let lc = draw('ck-lane', 'ul', { ckRoom: 'hygiene' }).children;
  ok(lc.length === 4 && lc.every((c) => c.dataset.ckOf === 'sweeper') && lc[0].children[0].children.map((x) => x.textContent).join('|') === 'Sweeper|Trial|06:50 · All EMEA · New Business and Upsell' && /Watch/.test(lc[0].textContent) && /Seven checks, counted per team/.test(lc[0].textContent) && /From Salesforce, counted Thursday 06:50 Stockholm/.test(lc[0].textContent),
    'the lane: one card per item, four at most; a card opens with its agent, Trial, and the document\'s time and scope, and ends with where it is from');
  const off = label(lc[0], 'Post the ask via Claude');
  ok(!!off && off.disabled === true && /Trial week: nothing can be sent\./.test(lc[0].textContent) && !btns(lc[1]).some((b) => /via Claude/.test(b.textContent)) && !/Trial week/.test(lc[1].textContent) && !!label(lc[0], 'Got it') && !!label(lc[0], 'Not useful'),
    'on trial the send button is shown and is off, with its note; a card with nothing to send has neither; Got it and Not useful are there');
  fire(off, 'click'); await tick(); await tick();
  ok(SENT.length === 2 && !OS.sense.acted('sw-ask'), 'a press on the button that is off hands Claude nothing and marks nothing');
  const asked = [], register = dash.draw; dash.draw = (n, fn) => { if (!fn) asked.push(n); return register(n, fn); }; // which drawings the page asks for again
  fire(label(lc[1], 'Not useful'), 'click'); await tick(); await tick();
  lc = draw('ck-lane', 'ul', { ckRoom: 'hygiene' }).children;
  ok(lc.length === 3 && OS.sense.acted('sw-teams').action === 'notuseful' && DB.writes.every((w) => w.p === 'data/users/' + UID + '/sense-acts'), 'Not useful works on trial: the card goes, and the reaction is kept with the others in his sense-acts');
  const atOnce = asked.join();
  sub('hub/sweeper')[0](snapOf('hub/sweeper', { ...SWEEP, trial: false }));
  const afterDept = asked.join();
  // his own two, as before the doors: a document of Instinct or Muse asks for their pane when it is written, when it
  // can no longer be read, and when it is back
  sub('hub/instinct')[0](snapOf('hub/instinct', INST)); const afterWritten = asked.join();
  DB.errs['hub/muse']({ code: 'unavailable' }); const afterUnread = asked.join(), unread = OS.sense.state('muse');
  sub('hub/muse')[0](snapOf('hub/muse', MUSE)); dash.draw = register;
  ok(atOnce === 'sense,ck-lane' && afterDept === atOnce, 'a reaction asks for the pane and the lane at once, so the card goes without waiting for the cockpit; a department\'s document asks for neither (the cockpit draws the lane with its chips)', asked);
  ok(afterWritten === 'sense,ck-lane,sense,ck-lane' && afterUnread === 'sense,ck-lane,sense,ck-lane,sense,ck-lane' && unread === 'error' && asked.join() === 'sense,ck-lane,sense,ck-lane,sense,ck-lane,sense,ck-lane' && OS.sense.state('muse') === 'ok',
    'a document of Instinct or Muse asks for their pane at once, as before the doors: when it is written, when it can no longer be read, and when it is back', asked);
  lc = draw('ck-lane', 'ul', { ckRoom: 'hygiene' }).children;
  const on = label(lc[0], 'Post the ask via Claude');
  ok(!!on && !on.disabled && lc[0].children[0].children.map((x) => x.textContent).join('|') === 'Sweeper|06:50 · All EMEA · New Business and Upsell' && !/Trial/.test(lc[0].textContent), 'off trial the button is on and the Trial mark is gone');
  fire(on, 'click'); await tick(); await tick();
  ok(SENT.length === 3 && /Team, this week's ask\./.test(SENT[2].ask) && /the right recipient \(find them and show me who first\)/.test(SENT[2].ask) && /send only after my OK/.test(SENT[2].ask) && OS.sense.acted('sw-ask').action === 'sent',
    'then a press hands Claude the prepared message with an OK step (the document names no recipient: Claude asks who), and the item is marked sent');
  lc = draw('ck-lane', 'ul', { ckRoom: 'hygiene' }).children;
  ok(lc.length === 3 && /Sent to Claude/.test(lc[0].textContent), 'a sent item stays in the lane, marked as sent');
  ok(OS.sense.items('sweeper').map((x) => x.id).join() === 'sw-ask,sw-teams,sw-3,sw-4' && OS.sense.cards('sweeper').map((x) => x.id).join() === 'sw-ask,sw-3,sw-4', 'the reader\'s cards are the lane\'s: of the four items that count, the one he sent on and the two he has not handled; the one he found not useful is no card', OS.sense.cards('sweeper').map((x) => x.id));
  // on trial nothing can be sent: a line for Leo neither
  const FORE = { at: '2026-11-05T11:10:30Z', status: 'ok', trial: true, scope: 'All EMEA', items: [
    { id: 'fc-leo', level: 'alert', title: 'The roll-up and the call differ', message: 'Leo, the roll-up and your call differ.' },
    { id: 'fc-mail', level: 'watch', title: 'Three roll-ups are missing', message: 'Leo, three roll-ups are missing.', action: { label: 'Remind them', sends: [{ type: 'email', to: [{ name: 'Karl Stein', email: 'karl@example.com' }], subject: 'Your roll-up for Friday', body: 'Karl, could you send your roll-up today?' }] } }] };
  sub('hub/forecast')[0](snapOf('hub/forecast', FORE));
  lc = draw('ck-lane', 'ul', { ckRoom: 'arr' }).children;
  ok(lc.length === 2 && !!OS.lanes.leoTo() && OS.ask.can() && lc.every((c) => !btns(c).some((b) => /Leo/.test(b.textContent)) && /Trial week: nothing can be sent\./.test(c.textContent)) && btns(lc[0]).map((b) => b.textContent).join('|') === 'Got it|Not useful' && btns(lc[1]).map((b) => b.textContent + (b.disabled ? ' (off)' : '')).join('|') === 'Remind them via Claude (off)|Got it|Not useful',
    'on trial a line for Leo cannot be sent either: there is no button for it, though Leo is known and Claude is beside the page, and the note stands on a card that has only that line');
  btns(lc[1]).filter((b) => /via Claude$/.test(b.textContent)).forEach((b) => fire(b, 'click')); await tick(); await tick();
  ok(SENT.length === 3 && !OS.sense.acted('fc-leo') && !OS.sense.acted('fc-mail'), 'and no press there hands Claude anything or marks anything');
  // off trial: the line for Leo once For Leo's document names him, and an email with its subject
  sub('hub/leo')[0](snapOf('hub/leo', { at: 'x', items: [] })); sub('hub/forecast')[0](snapOf('hub/forecast', { ...FORE, trial: false }));
  const arr = draw('ck-lane', 'ul', { ckRoom: 'arr' }), first = arr.children[0];
  ok(arr.children.length === 2 && !btns(arr).some((b) => /Leo/.test(b.textContent)) && !/Trial/.test(arr.textContent) && !label(arr.children[1], 'Remind them via Claude').disabled, 'off trial, while no document names Leo, there is still no button for him; the send button is on');
  sub('hub/leo')[0](snapOf('hub/leo', LEO)); draws['ck-lane'](arr);
  const anew = arr.children[0];
  ok(anew !== first && btns(anew).map((b) => b.textContent).join('|') === 'Send to Leo via Claude|Got it|Not useful', 'when For Leo\'s document names him the cards are made anew, with the button');
  draws['ck-lane'](arr);
  ok(arr.children[0] === anew && arr.children.length === 2, 'a redraw with nothing changed keeps the very same cards (the keyboard keeps its place)');
  fire(label(arr.children[1], 'Remind them via Claude'), 'click'); await tick(); await tick();
  ok(SENT.length === 4 && /Email to Karl Stein <karl@example\.com>, subject "Your roll-up for Friday"\nKarl, could you send your roll-up today\?/.test(SENT[3].ask) && OS.sense.acted('fc-mail').action === 'sent', 'an email is handed to Claude with its recipient and its subject');
  fire(label(arr.children[0], 'Send to Leo via Claude'), 'click'); await tick(); await tick();
  ok(SENT.length === 5 && /direct message to Leonard Schreij \(U0LEO12345\)/.test(SENT[4].ask) && /Leo, the roll-up and your call differ\./.test(SENT[4].ask) && OS.sense.acted('fc-leo').action === 'sent', 'off trial the line for Leo goes to him through Claude');
  // a document that can't be read now shows no cards
  DB.errs['hub/forecast']({ code: 'unavailable' });
  ok(OS.sense.state('forecast') === 'error' && OS.sense.items('forecast').length === 2 && draw('ck-lane', 'ul', { ckRoom: 'arr' }).children.length === 0, 'when a document can no longer be read its cards go: the chip says "no data", and the lane shows what the chip counts');
  ok(OS.sense.cards('forecast').length === 0, '... and the reader has no card of it either, so its chip is not marked as leading to one');
  sub('hub/forecast')[0](snapOf('hub/forecast', null));
  ok(['arr', 'exec', 'mine', 'cellar'].every((r) => draw('ck-lane', 'ul', { ckRoom: r }).children.length === 0) && draw('ck-lane', 'ul').children.length === 0, 'a room with nothing prepared, his own room, a room the model does not have, or no room at all: an empty lane');
  el = draw('sense', 'div');
  ok(el.children.length === 2 && !/Sweeper|Seven checks/.test(el.textContent), 'the Instinct and Muse pane shows nothing of a department\'s document');
  // ---- one and the same lane, drawn again in place as the cockpit does: its cards follow all they are made of ----
  // (each step changes one thing only, so that each thing is seen to count)
  const LONG = 'All EMEA · ' + 'New Business and Upsell, '.repeat(4); // a scope of more than 80 characters
  const RENEW = { at: '2026-11-05T05:50:40Z', status: 'ok', trial: false, scope: LONG, items: [
    { id: 'rn-ask', level: 'watch', title: 'Two renewals are running late', action: { label: 'Ask the owners', sends: [{ type: 'slack', body: 'Team, two renewals are running late.' }] } },
    { id: 'rn-early', level: 'good', title: 'One renewal closed early' }] };
  const lane = draw('ck-lane', 'ul', { ckRoom: 'arr' }), top = (card) => card.children[0].children.map((x) => x.textContent).join('|');
  const renew = (d) => { sub('hub/renewals')[0](snapOf('hub/renewals', d)); draws['ck-lane'](lane); return lane.children[0]; };
  const WORDS = { ...RENEW, items: [{ ...RENEW.items[0], title: 'Three renewals are running late' }, RENEW.items[1]] }, TRIAL = { ...WORDS, trial: true }, LATER = { ...TRIAL, at: '2026-11-05T05:51:40Z' };
  const c1 = renew(RENEW), c2 = renew(WORDS), c3 = renew(TRIAL), c4 = renew(LATER), send = 'Ask the owners via Claude';
  ok(lane.children.length === 2 && LONG.length > 80 && top(c1) === 'Renewals|06:50 · ' + LONG.slice(0, 80) && c2 !== c1 && /Three renewals are running late/.test(c2.textContent) && c3 !== c2 && top(c3) === 'Renewals|Trial|06:50 · ' + LONG.slice(0, 80) && label(c3, send).disabled === true
    && c4 !== c3 && top(c4) === 'Renewals|Trial|06:51 · ' + LONG.slice(0, 80) && renew(LATER) === c4,
    'a lane drawn again in place makes its cards anew when an item\'s words change, when its agent goes on trial and when its document is written anew (a scope is cut at 80 characters); with nothing new they stay', [top(c1), top(c3), top(c4)]);
  const notTrue = ['true', 1, 'yes', {}, undefined, false].map((trial) => { const c = renew({ ...LATER, trial }), b = label(c, send); return !/Trial/.test(top(c)) && !/Trial week/.test(c.textContent) && !!b && !b.disabled; });
  ok(notTrue.every(Boolean) && /^Renewals\|Trial\|/.test(top(renew(LATER))), 'on a card too only trial: true is a trial: with any other value the card has no Trial mark and its send button is on', notTrue);
  // Claude beside the page comes and goes; an item he sends on; his reactions that can no longer be written
  const card = renew({ ...LATER, trial: false }), beside = room.canSendToClaudeSession;
  room.canSendToClaudeSession = async () => 'off'; await OS.ask.refresh(); await tick(); draws['ck-lane'](lane);
  const away = lane.children[0], couldNot = OS.ask.can();
  room.canSendToClaudeSession = beside; await OS.ask.refresh(); await tick(); draws['ck-lane'](lane);
  const back = lane.children[0];
  ok(couldNot === false && away !== card && !btns(away).some((b) => /via Claude/.test(b.textContent)) && /Open the Claude chat beside this page to send from here\./.test(away.textContent)
    && OS.ask.can() === true && back !== away && !!label(back, send) && !label(back, send).disabled && !/Open the Claude chat/.test(back.textContent),
    'when Claude is no longer beside the page the cards are made anew without the send button and say how to send; when it is back, so is the button');
  const sentBefore = SENT.length;
  fire(label(back, send), 'click'); await tick(); await tick(); draws['ck-lane'](lane);
  const sent = lane.children[0];
  ok(SENT.length === sentBefore + 1 && OS.sense.acted('rn-ask').action === 'sent' && sent !== back && lane.children.length === 2 && /Sent to Claude/.test(sent.textContent) && !btns(sent).some((b) => /via Claude/.test(b.textContent)),
    'when he sends an item on, its card in that same lane is made anew and says so: the send button is gone, so nothing is sent twice', btns(sent).map((b) => b.textContent));
  // ---- Instinct and Muse are as they were ----
  const many = (pre) => ({ at: '2026-11-05T07:07:00Z', items: Array.from({ length: 13 }, (_, i) => ({ id: pre + i, title: 'Item ' + i })) });
  sub('hub/instinct')[0](snapOf('hub/instinct', many('ins-many-'))); sub('hub/muse')[0](snapOf('hub/muse', many('muse-many-')));
  ok(OS.sense.items('instinct').length === 12 && OS.sense.items('muse').length === 12 && OS.sense.items('sweeper').length === 4, 'Instinct and Muse still keep their first twelve items: four is a department agent\'s number only', [OS.sense.items('instinct').length, OS.sense.items('muse').length]);
  const instinctReads = (d) => { sub('hub/instinct')[0](snapOf('hub/instinct', d)); return OS.sense.state('instinct') + ' ' + OS.sense.items('instinct').length; };
  ok([{ at: '2026-11-05T07:07:00Z' }, { at: '2026-11-05T07:07:00Z', status: 'error' }, { at: '2026-11-05T07:07:00Z', status: 'ok', items: 'none' }, {}].map(instinctReads).join() === Array(4).fill('missing 0').join() && instinctReads({ items: [] }) === 'ok 0',
    'an Instinct document is a result only when it lists its items, as before the doors: a time or a status alone, which makes a department\'s document one, does not');
  sub('hub/instinct')[0](snapOf('hub/instinct', { at: '2026-11-05T07:07:00Z', items: [{ id: 'ins-src', level: 'watch', title: 'A signal that names its source', why: 'It moved.', source: 'Salesforce, counted this morning' }] }));
  el = draw('sense', 'div'); ic = el.children[0].children.find((n) => n.tagName === 'UL').children;
  ok(ic.length === 1 && ic[0].children[0].className === 'lane-head' && ic[0].dataset.ckOf === undefined && /A signal that names its source/.test(ic[0].textContent) && !/From Salesforce/.test(ic[0].textContent) && !/Trial/.test(ic[0].textContent) && btns(ic[0]).map((b) => b.textContent).join('|') === 'Got it|Not useful',
    'an Instinct card is as it was: it opens with its level and title, does not say whose it is, and has no line saying where it is from, though its item names a source', ic[0] && ic[0].textContent);
  DB.errs['data/users/' + UID + '/sense-acts']({ code: 'permission-denied' }); draws['ck-lane'](lane);
  ok(OS.sense.canWrite() === false && lane.children.length === 2 && lane.children[0] !== sent && !btns(lane).some((b) => /^(Got it|Not useful)$/.test(b.textContent)) && /Sent to Claude/.test(lane.children[0].textContent),
    'when his reactions can no longer be written, the cards are made anew without Got it and Not useful', btns(lane).map((b) => b.textContent));
  lane.replaceChildren(); draws['ck-lane'](lane);
  ok(lane.children.length === 2 && /Sent to Claude/.test(lane.children[0].textContent), 'a lane that was emptied (the dashboard empties a drawing that threw) is filled again at the next draw, though nothing its cards are made of has changed', lane.children.length);
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.stack); process.exit(1); });
