const { Node } = require('./fakedom.js');
const calcs = {}, draws = {}, loaders = {};
let params = { region: 'All', mgr: '', person: '', ooWho: '', ooRoot: '', grOwner: 'all', grShowDone: false };
const DATA = {};
global.dash = {
  loader: (id, o) => { loaders[id] = o; }, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; },
  params: () => params, setParams: (p) => { params = { ...params, ...p }; }, onData: () => {}, colors: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'], setLink: () => {},
  data: (id) => (id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }),
};
global.d3 = new Proxy({}, { get: (t, k) => (k === 'max' ? (a, f) => Math.max(...a.map(f)) : k === 'utcFormat' || k === 'format' ? () => (v) => String(v) : () => () => {}) });
const sent = [];
global.claude = { use: async (n) => (n === 'room' ? { canSendToClaudeSession: async () => 'available', sendToClaudeSession: (d, o) => { sent.push([d, o]); return Promise.resolve({ to: 'pane' }); } } : null) };
global.SENT = sent;
require('/home/user/revopsemeaos/dashboard/os-core.js');
require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js');
require('/home/user/revopsemeaos/dashboard/os-draw.js');
const iso = (n) => new Date(Date.now() + n * 864e5).toISOString();
DATA.users_all = [
  { userId: '1', name: 'Cee Oh', email: 'ceo@legora.com', role: 'CEO', manager: null },
  { userId: '2', name: 'Vee Pee', email: 'vp@legora.com', role: 'VP-SALES-EMEA', manager: 'Cee Oh' },
  { userId: '4', name: 'Ann Lee', email: 'ann@legora.com', role: 'AE-EMEA-FR', manager: 'Vee Pee' },
  { userId: '7', name: 'Rev Ops', email: 'me@legora.com', role: 'REVOPS', manager: 'Cee Oh' },
];
const person = [
  { name: 'Vee Pee', role: 'VP-SALES-EMEA', manager: 'Cee Oh', inRoster: true, isActive: true, region: 'Leadership', thisPipe: 0, thisOpps: 0, nextPipe: 0, pastDue: 0, stale: 0, crOpps: 0, crArr: 0, wonThisArr: 0, wonThis: 0, lostThis: 0 },
  { name: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Vee Pee', inRoster: true, isActive: true, region: 'France', thisPipe: 100000, thisOpps: 3, nextPipe: 50000, pastDue: 2, stale: 1, crOpps: 2, crArr: 40000, wonThisArr: 30000, wonThis: 1, lostThis: 1 },
];
DATA.team_tree = calcs.team_tree.fn(DATA.users_all, [], person, [], [], [], []);
DATA.oo_points = calcs.oo_points.fn(DATA.team_tree, [], [], [], [], [], [], [], []);
DATA.cal_events = [{ id: 'e1', start: iso(1), end: iso(1.02), allDay: false, title: 'Ann / Me', status: 'confirmed', organizerSelf: true, calendar: 'me@legora.com', attendees: 'me@legora.com|self||accepted||;ann@legora.com||||accepted|Ann;c_1@resource.calendar.google.com||room|accepted||Room', recurring: true, link: 'l' }];
DATA.oo_upcoming = calcs.oo_upcoming.fn(DATA.cal_events, DATA.users_all);
DATA.gr_actions = [{ id: 'm1:s1', meetingId: 'm1', item: 'Send deck', owner: 'Ann Lee', bucket: 'others', participants: 2, emails: 'me@legora.com, ann@legora.com', me: 'me@legora.com', meeting: 'Ann / Me', date: '2026-10-28', url: 'https://notes.granola.ai/d/m1', done: false, forYou: false, ageDays: 6 },
  { id: 'm1:s2', meetingId: 'm1', item: 'My task', owner: 'Rev Ops', bucket: 'mine', participants: 2, emails: 'me@legora.com, ann@legora.com', me: 'me@legora.com', meeting: 'Ann / Me', date: '2026-10-28', url: 'https://notes.granola.ai/d/m1', done: false, forYou: true, ageDays: 6, dueStatus: 'Overdue', due: '2026-11-01' }];
DATA.gr_notes = [{ meetingId: 'm1', meeting: 'Ann / Me', meetingAt: '2026-10-28T10:00:00+01:00', url: 'https://notes.granola.ai/d/m1', participants: 2, emails: 'me@legora.com, ann@legora.com', me: 'me@legora.com' }];
DATA.oo_followups = calcs.oo_followups.fn(DATA.gr_actions, DATA.gr_notes, DATA.users_all);
DATA.gr_kpi = calcs.gr_kpi.fn(DATA.gr_actions);
DATA.sf_me = [{ userId: '7', name: 'Rev Ops', email: 'me@legora.com' }];
DATA.books_owner = calcs.books_owner.fn([{ owner: 'A', role: 'AE-EMEA-FR', manager: 'M', active: true, status: 'Customer', accounts: 40 }, { owner: 'B', role: 'AE-EMEA-FR', manager: 'M', active: true, status: 'Customer', accounts: 2 }, { owner: 'C', role: 'AE-EMEA-FR', manager: 'M', active: true, status: 'Customer', accounts: 10 }], [], []);
DATA.roster = [];
DATA.book_moves = calcs.book_moves.fn(DATA.books_owner, DATA.roster, []);

DATA.oo_kpi = calcs.oo_kpi.fn(DATA.oo_upcoming);
DATA.person = person.map((p) => ({ ...p, userId: '005000000000001AAA' }));
DATA.checks = [{ id: 'c1', area: 'Routing', severity: 'high', title: 'Ann Lee', person: 'Ann Lee', region: 'France', manager: 'Vee Pee', what: 'Missing from routing', meta: 'peers are in RR: France', screen: 'routing' }];
DATA.checks_hb = [];
DATA.deal_list = [{ oppId: '006000000000001AAA', opp: 'Acme - NB', owner: 'Ann Lee', manager: 'Vee Pee', region: 'France', stage: '1 - Qualify', closeDate: '2026-11-20', quarter: 'this', forecast: 'Commit', arrUsd: 90000, flags: 'Commit at early stage', risk: 5 }];
DATA.renewal_list = [{ oppId: '006000000000002AAA', opp: 'Beta - Renewal', owner: 'Ann Lee', manager: 'Vee Pee', region: 'France', stage: '2', closeDate: '2026-12-01', daysToClose: 28, quarter: 'this', rating: 'High', renewingArrUsd: 1, netChangeArrUsd: -1, flags: '' }];
DATA.person_deals = DATA.deal_list;
DATA.roster = [{ userId: '1', name: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Vee Pee', isActive: true }];
global.OSQ = OS;
(async () => {
  await new Promise((r) => setTimeout(r, 30));
  console.log('ask can:', OS.ask.can());
  const find = (el, pred, out = []) => { if (pred(el)) out.push(el); for (const c of el.children || []) find(c, pred, out); return out; };
  for (const n of ['act-list', 'check-list', 'deal-table', 'oo-follow', 'oo-talk', 'pd-deals', 'pd-act']) {
    if (n === 'pd-act') params.person = 'Ann Lee';
    const el = new Node(n.includes('table') ? 'tbody' : 'ul'); el.dataset.draw = n;
    try { draws[n](el); } catch (e) { console.log('THROW', n, e.message); continue; }
    const asks = find(el, (x) => x.dataset && x.dataset.ask);
    const links = find(el, (x) => x.tagName === 'A');
    const sizes = asks.map((a) => a.dataset.ask.length);
    let ok = true; for (const a of asks) { try { const d = JSON.parse(a.dataset.ask); if (!d.label || !d.ask) ok = false; } catch (e) { ok = false; } }
    console.log(n.padEnd(11), 'ask buttons', asks.length, 'max payload', Math.max(0, ...sizes), 'json ok', ok, '| links', links.map((l) => String(l.href).slice(0, 60)).join(' , '));
  }
  const one = find((() => { const el = new Node('ul'); draws['check-list'](el); return el; })(), (x) => x.dataset && x.dataset.ask)[0];
  console.log('sample payload:', one && one.dataset.ask.slice(0, 400));
})();

