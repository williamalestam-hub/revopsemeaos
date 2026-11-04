const calcs = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, params: () => ({}), setParams: () => {}, onData: () => {}, draw: () => {}, colors: [], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.window = global; global.location = { hash: '' }; global.document = { querySelectorAll: () => [], addEventListener: () => {} };
require('../pending/oo_calcs.js');
const users_all = [
  { userId: '1', name: 'Cee Oh', email: 'ceo@legora.com', role: 'CEO', manager: null },
  { userId: '2', name: 'Vee Pee', email: 'vp@legora.com', role: 'VP-SALES-EMEA', manager: 'Cee Oh' },
  { userId: '3', name: 'Dee Fr', email: 'dfr@legora.com', role: 'DIR-SALES-EMEA', manager: 'Vee Pee' },
  { userId: '4', name: 'Ann Lee', email: 'ann@legora.com', role: 'AE-EMEA-FR', manager: 'Dee Fr' },
  { userId: '5', name: 'Bob Ray', email: 'bob@legora.com', role: 'AE-EMEA-FR', manager: 'Dee Fr' },
  { userId: '6', name: 'Cy Dach', email: 'cy@legora.com', role: 'AE-EMEA-DACH', manager: 'Vee Pee' },
  { userId: '7', name: 'Rev Ops', email: 'me@legora.com', role: 'REVOPS', manager: 'Cee Oh' },
  { userId: '8', name: 'Us Rep', email: 'us@legora.com', role: 'AE-US', manager: 'Cee Oh' },
];
const P = (name, role, manager, o) => ({ name, role, manager, inRoster: true, isActive: true, region: role.startsWith('AE-EMEA-FR') ? 'France' : role.includes('DACH') ? 'DACH' : 'Leadership', thisPipe: 0, thisOpps: 0, nextPipe: 0, pastDue: 0, stale: 0, crOpps: 0, crArr: 0, wonThisArr: 0, wonThis: 0, lostThis: 0, ...o });
const person = [
  P('Vee Pee', 'VP-SALES-EMEA', 'Cee Oh', {}), P('Dee Fr', 'DIR-SALES-EMEA', 'Vee Pee', {}),
  P('Ann Lee', 'AE-EMEA-FR', 'Dee Fr', { thisPipe: 100000, thisOpps: 3, nextPipe: 50000, pastDue: 2, stale: 1, crOpps: 2, crArr: 40000, wonThisArr: 30000, wonThis: 1, lostThis: 1 }),
  P('Bob Ray', 'AE-EMEA-FR', 'Dee Fr', { thisPipe: 200000, thisOpps: 4, pastDue: 1, crOpps: 1, wonThis: 2, wonThisArr: 80000, lostThis: 2 }),
  P('Cy Dach', 'AE-EMEA-DACH', 'Vee Pee', { thisPipe: 50000, thisOpps: 1 }),
];
const rr_people = [{ name: 'Bob Ray', status: 'Missing', suggested: 'RR: France' }, { name: 'Cy Dach', status: 'New: add next week' }];
const rep_risk = [{ owner: 'Ann Lee', score: 7, pastDue: 2, pushedOut: 1, pushedOutArr: 20000, early: 1, earlyArr: 10000, nextOverdue: 1, nextNone: 0, noContact: 0 }, { owner: 'Bob Ray', score: 3, pastDue: 1, pushedOut: 0, early: 0, nextOverdue: 0, nextNone: 2, noContact: 1 }];
const checks = [{ person: 'Bob Ray', title: 'Bob Ray', what: 'Missing from routing', severity: 'high' }];
const tt = calcs.team_tree.fn(users_all, person, rr_people, rep_risk, checks);
for (const t of tt) console.log(t.name.padEnd(8), 'lead', t.isLeader, 'directs', t.directs, 'size', t.teamSize, 'emea', t.emeaPeople, 'top', t.isTop, 'pipe', t.thisPipe, 'won', t.wonThis, '/', t.lostThis, 'wr', t.winRate, 'gaps', t.routingGaps, 'risk', t.riskReps, 'checks', t.checks);
const deal_list = [{ owner: 'Ann Lee', opp: 'Acme - NB', arrUsd: 90000, stage: '1 - Qualify', closeDate: '2026-11-20', risk: 5, flags: 'Commit at early stage', oppId: 'o1' }];
const renewal_list = [{ owner: 'Bob Ray', opp: 'Beta - Renewal', renewingArrUsd: 120000, closeDate: '2026-12-01', rating: 'HIGH', netChangeArrUsd: -10000, oppId: 'r1' }];
const books_owner = [{ owner: 'Ann Lee', balance: 'Heavy', active: 40, vsMedian: 2.3 }];
const pts = calcs.oo_points.fn(tt, rep_risk, deal_list, renewal_list, rr_people, books_owner, checks);
for (const p of pts.filter((x) => x.email === 'dfr@legora.com' || x.email === 'ann@legora.com')) console.log(p.email.padEnd(16), p.section.padEnd(8), (p.sev || '-').padEnd(6), p.text);
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().replace(/\.\d+Z$/, '+00:00');
const cal = [
  { id: 'e1', start: day(1), end: day(1.02), allDay: false, title: 'Ann / Me', status: 'confirmed', myResponse: 'accepted', people: 2, selfEmail: 'me@legora.com', emails: 'ann@legora.com', names: '', recurring: true, link: 'l' },
  { id: 'e2', start: day(0.5), end: day(0.52), allDay: false, title: 'Vendor', status: 'confirmed', myResponse: 'accepted', people: 2, selfEmail: 'me@legora.com', emails: 'x@vendor.io', names: '' },
  { id: 'e3', start: day(-1), end: day(-0.98), allDay: false, title: 'Past', status: 'confirmed', myResponse: 'accepted', people: 2, selfEmail: 'me@legora.com', emails: 'bob@legora.com', names: '' },
  { id: 'e4', start: day(2), end: day(2.02), allDay: false, title: 'Group', status: 'confirmed', myResponse: 'accepted', people: 3, selfEmail: 'me@legora.com', emails: 'a@legora.com, b@legora.com', names: '' },
  { id: 'e5', start: day(0.2), end: day(0.22), allDay: false, title: 'New hire 1:1', status: 'confirmed', myResponse: 'needsAction', people: 2, selfEmail: 'me@legora.com', emails: 'new.person@legora.com', names: '' },
  { id: 'e6', start: day(3), end: day(3.02), allDay: false, title: 'Declined', status: 'confirmed', myResponse: 'declined', people: 2, selfEmail: 'me@legora.com', emails: 'ann@legora.com', names: '' },
];
console.log(calcs.oo_upcoming.fn(cal, users_all).map((u) => u.key + ' ' + u.name + ' ' + u.email + ' sf:' + u.sfName));
const gr_notes = [
  { meetingId: 'm1', meeting: 'Ann / Me', meetingAt: '2026-10-28T10:00:00+01:00', url: 'u1', participants: 2, emails: 'me@legora.com, ann@legora.com', me: 'me@legora.com' },
  { meetingId: 'm2', meeting: 'Ann / Me', meetingAt: '2026-10-21T10:00:00+01:00', url: 'u2', participants: 2, emails: 'me@legora.com, ann@legora.com', me: 'me@legora.com' },
];
const gr_actions = [
  { id: 'm1:s1', item: 'Send deck', owner: 'Ann Lee', bucket: 'others', participants: 2, emails: 'me@legora.com, ann@legora.com', me: 'me@legora.com', meeting: 'Ann / Me', meetingId: 'm1', date: '2026-10-28', url: 'u1', done: false },
  { id: 'm9:s1', item: 'Fix routing for Bob', owner: 'Bob Ray', bucket: 'others', participants: 8, emails: 'me@legora.com, a@legora.com', me: 'me@legora.com', meeting: 'Big call', meetingId: 'm9', date: '2026-10-27', url: 'u9', done: false },
  { id: 'm9:s2', item: 'Old', owner: 'Bob Ray', bucket: 'others', participants: 8, emails: '', me: 'me@legora.com', meeting: 'Big call', meetingId: 'm9', date: '2026-10-27', url: 'u9', done: true },
];
for (const f of calcs.oo_followups.fn(gr_actions, gr_notes, users_all)) console.log(f.email.padEnd(16), f.kind, f.item, f.date);
