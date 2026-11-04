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
require('/home/user/revopsemeaos/dashboard/os-core.js');
require('/home/user/revopsemeaos/dashboard/os-calcs.js');
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
DATA.oo_points = calcs.oo_points.fn(DATA.team_tree, [], [], [], [], [], [], []);
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
DATA.book_moves = calcs.book_moves.fn(DATA.books_owner, DATA.roster, []); // bk_stale (a later input): none
const run = (name, el) => { el = el || new Node('ul'); el.dataset.draw = name; try { draws[name](el); return el; } catch (e) { console.log('THROW', name, e.stack.split('\n').slice(0, 3).join(' | ')); return el; } };
for (const n of ['oo-list', 'oo-pick', 'oo-who', 'oo-when', 'oo-last', 'oo-follow', 'oo-numbers', 'oo-talk', 'oo-root', 'oo-team-table', 'bk-plan-table', 'act-list', 'home-actions']) {
  const el = run(n, new Node(n.includes('table') ? 'tbody' : n.includes('pick') || n.includes('root') ? 'select' : 'ul'));
  console.log(n.padEnd(14), 'children', el.children.length, '|', el.textContent.slice(0, 140).replace(/\s+/g, ' '));
}
const k = new Node('b'); k.dataset.source = 'team_tree'; k.dataset.field = 'thisPipe'; k.dataset.fmt = 'usd'; run('kpi-team', k); console.log('kpi-team', k.textContent, k.dataset.where);
const g = new Node('b'); g.dataset.source = 'gr_kpi'; g.dataset.field = 'forYou'; g.dataset.row = '0'; run('kpi-gr', g); console.log('kpi-gr', g.textContent, g.dataset.source, g.dataset.field);
const b = new Node('span'); b.dataset.source = 'gr_kpi'; b.dataset.f = 'forYou'; b.attrs['data-row'] = '0'; run('nav-badge', b); console.log('nav-badge', b.textContent, b.className);
console.log('agenda text:\n' + OS.oo.text());
console.log('msg oo-follow', JSON.stringify(require('util').inspect(null)));
