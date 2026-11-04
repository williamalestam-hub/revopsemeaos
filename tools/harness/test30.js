// Closed deals count for the team that closed them (4 Nov 2026): the owner's role at close (Closed_Owner_Role__c, the
// current role when it is blank); a deal since moved to someone in another role also counts for its owner and manager
// at close. Lost reasons on the list used since 3 Nov 2026, older values grouped under their new name. Pipeline owned
// outside EMEA sales (partnership roles, strategic AEs). Synthetic rows only.
const { Node } = require('./fakedom.js');
let NOW = Date.parse('2026-11-04T10:00:00Z');
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const calcs = {}, draws = {};
let params = { region: 'All', mgr: '', person: '' };
const DATA = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; }, onData: () => {}, colors: ['#111', '#222', '#333'], setLink: () => {},
  data: (id) => (id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: (f) => (v) => (f === '.0%' ? Math.round(v * 100) + '%' : f === ',' ? Math.round(v).toLocaleString('en') : String(v)), max: (a, f) => Math.max(...a.map(f)) };
global.claude = { use: async () => null };
document.querySelectorAll = () => [];
document.addEventListener = () => {};
const D = '/home/user/revopsemeaos/dashboard/';
require(D + 'os-core.js'); require(D + 'os-calcs.js'); require(D + 'os-calcs-leads.js'); require(D + 'os-calcs-act.js'); require(D + 'os-draw.js');
let fails = 0; const ok = (c, l, x) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const run = (id) => calcs[id].fn(...calcs[id].inputs.map((i) => DATA[i] || []));
const trs = (el) => { const out = []; const walk = (n) => { for (const c of n.children) { if (c.tagName === 'TR') out.push(c); else walk(c); } }; walk(el); return out; };
const tbl = (name) => { const el = new Node('tbody'); el.dataset.draw = name; draws[name](el); return trs(el); };
const cells = (tr) => tr.children.map((td) => td.textContent);

// ----- won this quarter by the team that closed it -----
const won = (role, manager, closedRole, closedManager, arr, rt) => ({ role, manager, closedRole, closedManager, recordType: rt || 'New Business', wonOpps: 1, wonArrUsd: arr });
const pt = calcs.pipe_team.fn([], [
  won('MGR-SALES-EMEA', 'Leonard', 'AE-EMEA-FR', 'FrMgr', 100),      // promoted since: France, its manager at close
  won('AE-EMEA-DACH', 'DMgr', 'AE-EMEA-DACH', 'OldMgr', 50),         // same role, new manager (a re-org): today's manager
  won('AE-EMEA-CEE', 'CMgr', null, null, 30),                        // not stamped (before April 2026): today's team
  won('Consulting Partnerships', 'X', 'AE-EMEA-BENELUX', null, 20),  // now owned outside EMEA: Benelux, no manager
  won('AE-EMEA-FR', 'FrMgr', 'AE-EMEA-FR', 'FrMgr', 999, 'Renewal'), // renewals stay out
], []);
const k = (key) => (pt.find((r) => r.key === key) || {}).won;
ok(k('All|All') === 200, 'won: all EMEA adds every closing team', k('All|All'));
ok(k('France|All') === 100 && k('France|FrMgr') === 100 && k('M|FrMgr') === 100 && !k('Leadership|All') && !k('M|Leonard'), 'won: a deal closed as a France AE stays with France and its manager then', [k('France|All'), k('Leadership|All'), k('M|Leonard')]);
ok(k('DACH|DMgr') === 50 && k('M|DMgr') === 50 && !k('M|OldMgr'), 'won: same role, new manager: counts for today\'s manager', [k('M|DMgr'), k('M|OldMgr')]);
ok(k('CEE|CMgr') === 30, 'won: no stamp: today\'s team and manager');
ok(k('Benelux|All') === 20 && k('Benelux|(no manager)') === 20, 'won: closed by Benelux, now owned by a partnership role: Benelux, no manager stamped', [k('Benelux|All'), k('Benelux|(no manager)')]);

// ----- bookings, per person and the team they closed under -----
const cl = (o) => ({ owner: 'Kamil', role: 'MGR-SALES-EMEA', manager: 'Leonard', closedOwner: 'Kamil', closedRole: 'MGR-SALES-EMEA', closedManager: 'Leonard', rt: 'New Business', won: true, lostReason: null, fy: 2026, fq: 4, opps: 1, arrUsd: 10, ...o });
DATA.closed_rep = [
  cl({ closedRole: 'AE-EMEA-FR', closedManager: 'FrMgr', fy: 2026, fq: 3, arrUsd: 40, opps: 2 }),  // closed as a France AE last quarter
  cl({ closedRole: 'AE-EMEA-FR', closedManager: 'FrMgr', won: false, lostReason: 'Qualified Out', fy: 2026, fq: 3 }),
  cl({ arrUsd: 25 }),                                                                              // closed as a manager this quarter
  cl({ owner: 'Director', role: 'DIR-BDR-EMEA', manager: 'Leonard', closedOwner: 'Leaver', closedRole: 'AE-EMEA-BENELUX', closedManager: 'BenMgr', arrUsd: 70 }),
  cl({ owner: 'Marinus G', role: 'AE-EMEA-BENELUX', manager: 'BenMgr', closedOwner: 'Rien G', closedRole: 'AE-EMEA-BENELUX', closedManager: 'BenMgr', arrUsd: 5 }), // renamed since
  cl({ owner: 'Old Timer', role: 'AE-EMEA-NORDICS', manager: 'NoMgr', closedOwner: null, closedRole: null, closedManager: null, won: false, lostReason: 'Value not perceived' }),
  cl({ owner: 'Old Timer', role: 'AE-EMEA-NORDICS', manager: 'NoMgr', closedOwner: null, closedRole: null, closedManager: null, won: false, lostReason: 'Merged with Global Pilot' }),
  cl({ owner: 'Fr Rep', role: 'AE-EMEA-FR', manager: 'FrMgr', closedOwner: 'Fr Rep', closedRole: 'AE-EMEA-FR', closedManager: 'FrMgr', won: false, lostReason: 'Not a fit' }),
  cl({ owner: 'Fr Rep', role: 'AE-EMEA-FR', manager: 'FrMgr', closedOwner: 'Fr Rep', closedRole: 'AE-EMEA-FR', closedManager: 'FrMgr', won: false, lostReason: '' }),
  cl({ owner: 'Fr Rep', role: 'AE-EMEA-FR', manager: 'FrMgr', closedOwner: 'Fr Rep', closedRole: 'AE-EMEA-FR', closedManager: 'FrMgr', won: false, lostReason: 'Something new' }),
];
const bk = DATA.bookings = run('bookings');
const b = (key) => bk.find((r) => r.key === key);
ok(b('Kamil|France|FrMgr') && b('Kamil|France|FrMgr').wonLastArr === 40 && b('Kamil|France|FrMgr').lostLast === 1 && b('Kamil|Leadership|Leonard').wonThisArr === 25,
  'bookings: a promoted person has a row per team they closed under', bk.filter((r) => r.owner === 'Kamil').map((r) => r.key));
ok(b('Leaver|Benelux|BenMgr') && b('Leaver|Benelux|BenMgr').wonThisArr === 70 && !bk.some((r) => r.owner === 'Director'), 'bookings: a deal moved to a director counts for who closed it', bk.map((r) => r.key));
ok(b('Marinus G|Benelux|BenMgr') && !bk.some((r) => r.owner === 'Rien G'), 'bookings: a renamed owner in the same role stays under today\'s name', bk.map((r) => r.key));
ok(new Set(bk.map((r) => r.key)).size === bk.length, 'bookings: keys are unique');
const kpi = calcs.bookings_kpi.fn(bk);
const kk = (region) => kpi.find((r) => r.region === region);
ok(kk('France').wonLastArr === 40 && kk('Leadership').wonThisArr === 25 && kk('Benelux').wonThisArr === 75 && kk('BDR').wonThisArr === 0, 'bookings headline: France keeps the last-quarter wins, BDR gets none of the moved deal', [kk('France').wonLastArr, kk('Leadership').wonThisArr, kk('Benelux').wonThisArr, kk('BDR').wonThisArr]);
ok(kk('M|FrMgr').wonLastArr === 40 && kk('M|BenMgr').wonThisArr === 75, 'bookings headline: managers at close for moved deals');
const pb = calcs.person_bk.fn(bk);
const kam = pb.filter((r) => r.name === 'Kamil');
ok(kam.length === 1 && kam[0].wonThisArr === 25 && kam[0].wonLastArr === 40 && kam[0].wonThis === 1 && kam[0].winRateThis === 1, 'person view: one row per person, teams added up', kam);
// the team scorecard adds up a person's rows (it used to keep only the last one)
const tt = calcs.team_tree.fn([{ name: 'Leonard', email: 'l@x.test', role: 'VP-SALES-EMEA', manager: null }, { name: 'Kamil', email: 'k@x.test', role: 'MGR-SALES-EMEA', manager: 'Leonard' }],
  [], [{ name: 'Kamil', inRoster: true, isActive: true }, { name: 'Leonard', inRoster: true, isActive: true }],
  [{ ...b('Kamil|Leadership|Leonard') }, { owner: 'Kamil', region: 'France', manager: 'FrMgr', wonThisArr: 5, wonThis: 1, lostThis: 2 }], [], []);
const tk = tt.find((r) => r.name === 'Kamil');
ok(tk && tk.wonThisArr === 30 && tk.wonThis === 2 && tk.lostThis === 2, 'team scorecard: a person\'s bookings rows add up', tk && [tk.wonThisArr, tk.wonThis, tk.lostThis]);
// the Bookings table: one row per person and team, keyed so each row is unique
const rows = tbl('book-table');
ok(rows.length === bk.length && rows.some((tr) => tr.dataset.key === 'Kamil|France|FrMgr') && rows.some((tr) => tr.dataset.key === 'Kamil|Leadership|Leonard'), 'Bookings table: rows keyed by person, team and manager', rows.map((tr) => tr.dataset.key));

// ----- lost reasons on the new list -----
const lr = run('lost_reasons');
const l = (key) => lr.find((r) => r.key === key);
ok(l('France|Not a fit') && l('France|Not a fit').lastOpps === 1 && l('France|Not a fit').thisOpps === 1 && l('France|Not a fit').was === 'Qualified Out', 'lost reasons: Qualified Out last quarter and Not a fit this quarter are one group, was Qualified Out', l('France|Not a fit'));
ok(l('All|Value not perceived') && l('All|Value not perceived').was === null, 'lost reasons: Value not perceived keeps its name (no new equivalent)', l('All|Value not perceived'));
ok(l('All|Merged with Global Pilot') && l('All|Merged with Global Pilot').admin === true, 'lost reasons: admin merges keep their name and stay marked');
ok(l('France|No reason given') && l('France|Something new') && l('France|Something new').was === null, 'lost reasons: blank and unknown values', lr.filter((r) => r.scope === 'France').map((r) => r.reason));
ok(l('France|Not a fit') && !lr.some((r) => r.scope === 'Leadership'), 'lost reasons: a loss closed as a France AE counts for France, not for today\'s role');

// ----- this week: won and lost for who closed them -----
const mv = calcs.pipe_moves.fn([
  { owner: 'Director', role: 'DIR-BDR-EMEA', manager: 'Leonard', closedOwner: 'Leaver', closedRole: 'AE-EMEA-BENELUX', closedManager: 'BenMgr', won: true, n: 1, arr: 30 },
  { owner: 'Fr Rep', role: 'AE-EMEA-FR', manager: 'FrMgr', closedOwner: 'Fr Rep', closedRole: 'AE-EMEA-FR', closedManager: 'OldFr', won: false, n: 2, arr: 8 },
], [], [], [], []);
const lv = mv.find((r) => r.owner === 'Leaver'), fr = mv.find((r) => r.owner === 'Fr Rep');
ok(lv && lv.region === 'Benelux' && lv.manager === 'BenMgr' && lv.won === 1 && !mv.some((r) => r.owner === 'Director'), 'this week: a moved deal counts for who closed it', mv.map((r) => [r.owner, r.region, r.manager]));
ok(fr && fr.manager === 'FrMgr' && fr.lost === 2, 'this week: same role: today\'s manager', fr);

// this week: a moved close sits on its own row; the rest of that person's week stays on their current team, whatever the row order
const mvRows = [{ owner: 'Flip', role: 'EM-EMEA', manager: 'EmMgr', closedOwner: 'Flip', closedRole: 'AE-EMEA-NORDICS', closedManager: 'NoMgr', won: true, n: 1, arr: 50000 },
  { owner: 'Flip', role: 'EM-EMEA', manager: 'EmMgr', closedOwner: 'Flip', closedRole: 'EM-EMEA', closedManager: 'EmMgr', won: true, n: 3, arr: 54000 }];
const created = [{ owner: 'Flip', role: 'EM-EMEA', manager: 'EmMgr', toFY: 2026, toFQ: 4, opps: 2, arr: 7000 }];
for (const rows of [mvRows, mvRows.slice().reverse()]) {
  const mm = calcs.pipe_moves.fn(rows, created, [], [], []);
  const nordics = mm.find((r) => r.region === 'Nordics'), eng = mm.find((r) => r.region === 'Engagement');
  ok(mm.length === 2 && nordics.won === 1 && nordics.manager === 'NoMgr' && nordics.created === 0 && eng.won === 3 && eng.created === 2 && eng.manager === 'EmMgr' && new Set(mm.map((r) => r.key)).size === 2,
    'this week: a moved close on its own row, the rest of the week on today\'s team (either row order)', mm.map((r) => [r.key, r.won, r.created]));
}
// ----- coverage: history by the closing team, open pipeline by today's owner -----
const cov = calcs.pipe_cover.fn([
  { role: 'MGR-SALES-EMEA', manager: 'Leonard', closedRole: 'AE-EMEA-FR', closedManager: 'FrMgr', closed: true, won: true, fy: 2026, fq: 2, arr: 400, n: 4 },
  { role: 'MGR-SALES-EMEA', manager: 'Leonard', closedRole: 'AE-EMEA-FR', closedManager: 'FrMgr', closed: false, won: false, fy: 2026, fq: 4, arr: 90, n: 1 }, // reopened: today's owner
  { role: 'AE-EMEA-FR', manager: 'FrMgr', closedRole: null, closedManager: null, closed: false, won: false, fy: 2026, fq: 4, arr: 60, n: 2 },
], [{ role: 'MGR-SALES-EMEA', manager: 'Leonard', closedRole: 'AE-EMEA-FR', closedManager: 'FrMgr', rt: 'New Business', wonOpps: 4, avgCycleDays: 50 }]);
const c = (key) => cov.find((r) => r.key === key) || {};
ok(c('France|All').avgBookings === 100 && c('Leadership|All').avgBookings === 0, 'coverage: history follows the closing team', [c('France|All').avgBookings, c('Leadership|All').avgBookings]);
ok(c('Leadership|All').openThis === 90 && c('France|All').openThis === 60, 'coverage: open pipeline (a reopened deal too) follows today\'s owner', [c('Leadership|All').openThis, c('France|All').openThis]);
ok(c('France|All').avgCycleDays === 50 && c('Leadership|All').avgCycleDays == null, 'coverage: days to win follow the closing team');

// ----- pipeline owned outside EMEA sales -----
DATA.pipe_partner = [
  { role: 'Consulting Partnerships', region: 'DACH', rt: 'New Business', fy: 2026, fq: 4, opps: 3, arrUsd: 300000 },
  { role: 'Consulting Partnerships', region: 'FME', rt: 'New Business', fy: 2027, fq: 1, opps: 2, arrUsd: 200000 },
  { role: 'Consulting Partnerships', region: 'DACH', rt: 'New Business', fy: 2027, fq: 3, opps: 1, arrUsd: 50000 },
  { role: 'Consulting Partnerships', region: 'DACH', rt: 'Renewal', fy: 2026, fq: 4, opps: 4, arrUsd: 0 },
  { role: 'Tech Partnerships', region: 'MEA', rt: 'New Business', fy: 2026, fq: 4, opps: 5, arrUsd: 25000 },
  { role: 'AE-STRAT', region: 'Northern Europe', rt: 'Upsell', fy: 2026, fq: 2, opps: 1, arrUsd: 1500000 }, // past due
];
const pp = DATA.partner_pipe = run('partner_pipe');
const p = (role) => pp.find((r) => r.role === role);
ok(p('Consulting Partnerships').thisArr === 300000 && p('Consulting Partnerships').nextArr === 200000 && p('Consulting Partnerships').allArr === 550000 && p('Consulting Partnerships').allOpps === 6 && p('Consulting Partnerships').renewals === 4,
  'outside EMEA sales: this, next and all open; renewals apart', p('Consulting Partnerships'));
ok(p('Consulting Partnerships').regions === 'DACH $350K, FME $200K', 'outside EMEA sales: where most of it is', p('Consulting Partnerships').regions);
ok(p('AE-STRAT').allArr === 1500000 && p('AE-STRAT').thisArr === 0, 'outside EMEA sales: a past-due deal counts in all open only');
ok(pp[pp.length - 1].role === 'All' && p('All').allArr === 2075000 && p('All').thisOpps === 8, 'outside EMEA sales: an All row last', p('All'));
ok(pp[0].role === 'AE-STRAT', 'outside EMEA sales: largest first');
const prow = tbl('partner-table');
ok(prow.length === 4 && cells(prow[3])[0] === 'All' && prow[0].dataset.key === 'AE-STRAT', 'outside EMEA sales: table drawn', prow.map((tr) => cells(tr)));
ok(calcs.partner_pipe.fn([]).length === 0, 'outside EMEA sales: none, no rows');

// ----- only an EMEA sales role at close moves a deal; any other role at close (RevOps, LE, another region) keeps today's team -----
const pt2 = calcs.pipe_team.fn([], [
  won('AE-EMEA-DACH', 'DMgr', 'REVOPS', 'Ops Boss', 11),     // closed while RevOps owned it: today's DACH team
  won('AE-EMEA-DACH', 'DMgr', 'LE-EMEA', 'LE Boss', 7),      // closed by a legal engineer: today's DACH team
  won('AE-EMEA-FR', 'FrMgr', 'EM-AMER', 'Amer Boss', 500),   // another region's role at close (a wrong stamp, in live data): today's France
], []);
const k2 = (key) => (pt2.find((r) => r.key === key) || {}).won;
ok(k2('All|All') === 518 && k2('DACH|DMgr') === 18 && k2('France|FrMgr') === 500 && !k2('M|Ops Boss') && !k2('M|Amer Boss'), 'won: a role at close outside EMEA sales keeps today\'s team and manager', [k2('All|All'), k2('DACH|DMgr'), k2('France|FrMgr')]);
DATA.closed_rep = [
  cl({ owner: 'Fr Rep', role: 'AE-EMEA-FR', manager: 'FrMgr', closedOwner: 'Amer Person', closedRole: 'EM-AMER', closedManager: 'Amer Boss', arrUsd: 300 }),
  cl({ owner: 'Fr Rep', role: 'AE-EMEA-FR', manager: 'FrMgr', closedOwner: 'Ops Person', closedRole: 'REVOPS', closedManager: 'Ops Boss', arrUsd: 9 }),
];
const bk2 = run('bookings');
ok(bk2.length === 1 && bk2[0].key === 'Fr Rep|France|FrMgr' && bk2[0].wonThisArr === 309, 'bookings: RevOps and AMER stamps both count for today\'s owner', bk2.map((r) => [r.key, r.wonThisArr]));
ok(run('lost_reasons').length === 0, 'lost reasons: no losses, no rows');
const mv2 = calcs.pipe_moves.fn([{ owner: 'Fr Rep', role: 'AE-EMEA-FR', manager: 'FrMgr', closedOwner: 'Amer Person', closedRole: 'EM-AMER', closedManager: 'Amer Boss', won: true, n: 1, arr: 300 }], [], [], [], []);
ok(mv2.length === 1 && mv2[0].owner === 'Fr Rep' && mv2[0].region === 'France' && mv2[0].won === 1, 'this week: an AMER stamp counts for today\'s owner', mv2);
const cov2 = calcs.pipe_cover.fn([{ role: 'AE-EMEA-FR', manager: 'FrMgr', closedRole: 'EM-AMER', closedManager: 'Amer Boss', closed: true, won: true, fy: 2026, fq: 2, arr: 800, n: 2 },
  { role: 'AE-EMEA-FR', manager: 'FrMgr', closedRole: 'REVOPS', closedManager: null, closed: true, won: true, fy: 2026, fq: 2, arr: 40, n: 1 }], []);
ok((cov2.find((r) => r.key === 'All|All') || {}).avgBookings === 210 && (cov2.find((r) => r.key === 'France|FrMgr') || {}).avgBookings === 210, 'coverage: RevOps and AMER stamps both stay with France', cov2.map((r) => [r.key, r.avgBookings]));

// ----- data check: someone whose closes carry two roles in both quarters -----
const ck = calcs.checks_closed.fn([
  cl({ owner: 'Flip Flop', role: 'EM-EMEA', manager: 'EmMgr', closedOwner: 'Flip Flop', closedRole: 'EM-EMEA', fy: 2026, fq: 3, opps: 5, arrUsd: 200000 }),
  cl({ owner: 'Flip Flop', role: 'EM-EMEA', manager: 'EmMgr', closedOwner: 'Flip Flop', closedRole: 'AE-EMEA-NORDICS', fy: 2026, fq: 3, opps: 3, arrUsd: 30000 }),
  cl({ owner: 'Flip Flop', role: 'EM-EMEA', manager: 'EmMgr', closedOwner: 'Flip Flop', closedRole: 'EM-EMEA', fy: 2026, fq: 4, opps: 2, arrUsd: 10000 }),
  cl({ owner: 'Flip Flop', role: 'EM-EMEA', manager: 'EmMgr', closedOwner: 'Flip Flop', closedRole: 'AE-EMEA-NORDICS', fy: 2026, fq: 4, opps: 1, arrUsd: 20000 }),
  // one role change during last quarter: not flagged
  cl({ owner: 'Promoted', role: 'MGR-SALES-EMEA', manager: 'Leonard', closedOwner: 'Promoted', closedRole: 'AE-EMEA-FR', fy: 2026, fq: 3, opps: 6 }),
  cl({ owner: 'Promoted', role: 'MGR-SALES-EMEA', manager: 'Leonard', closedOwner: 'Promoted', closedRole: 'MGR-SALES-EMEA', fy: 2026, fq: 3, opps: 13 }),
  cl({ owner: 'Promoted', role: 'MGR-SALES-EMEA', manager: 'Leonard', closedOwner: 'Promoted', closedRole: 'MGR-SALES-EMEA', fy: 2026, fq: 4, opps: 7 }),
  // a non-selling role at close is not a second role
  cl({ owner: 'Steady', role: 'SMB-EMEA', manager: 'SmbMgr', closedOwner: 'Steady', closedRole: 'SMB-EMEA', fy: 2026, fq: 3 }), cl({ owner: 'Steady', role: 'SMB-EMEA', manager: 'SmbMgr', closedOwner: 'Steady', closedRole: 'REVOPS', fy: 2026, fq: 3 }),
  cl({ owner: 'Steady', role: 'SMB-EMEA', manager: 'SmbMgr', closedOwner: 'Steady', closedRole: 'SMB-EMEA', fy: 2026, fq: 4 }), cl({ owner: 'Steady', role: 'SMB-EMEA', manager: 'SmbMgr', closedOwner: 'Steady', closedRole: 'LE-EMEA', fy: 2026, fq: 4 }),
]);
ok(ck.length === 1 && ck[0].id === 'clr:Flip Flop' && ck[0].severity === 'medium' && /Q3 2026: Engagement 5, Nordics 3; Q4 2026: Engagement 2, Nordics 1/.test(ck[0].what) && /\$260K won and 0 deals lost .* split between Engagement and Nordics/.test(ck[0].meta) && ck[0].area === 'Pipeline' && ck[0].region === 'Engagement' && ck[0].manager === 'EmMgr',
  'role-at-close check: two teams in both quarters only; won ARR; their own team', ck);
const ck2 = calcs.checks_closed.fn([
  // two roles of one team (Engagement) in both quarters: nothing is split
  cl({ owner: 'Em Lead', role: 'DIR-EM-EMEA', manager: 'X', closedOwner: 'Em Lead', closedRole: 'EM-EMEA', fy: 2026, fq: 3 }), cl({ owner: 'Em Lead', role: 'DIR-EM-EMEA', manager: 'X', closedOwner: 'Em Lead', closedRole: 'DIR-EM-EMEA', fy: 2026, fq: 3 }),
  cl({ owner: 'Em Lead', role: 'DIR-EM-EMEA', manager: 'X', closedOwner: 'Em Lead', closedRole: 'EM-EMEA', fy: 2026, fq: 4 }), cl({ owner: 'Em Lead', role: 'DIR-EM-EMEA', manager: 'X', closedOwner: 'Em Lead', closedRole: 'DIR-EM-EMEA', fy: 2026, fq: 4 }),
  // their own deals stamped with another region's role: flagged, counted for their current team
  cl({ owner: 'Em Two', role: 'EM-EMEA', manager: 'EmMgr', closedOwner: 'Em Two', closedRole: 'EM-AMER', closedManager: 'EmMgr', fy: 2026, fq: 3, opps: 4, arrUsd: 12000 }),
  cl({ owner: 'Em Two', role: 'EM-EMEA', manager: 'EmMgr', closedOwner: 'Em Two', closedRole: 'EM-EMEA', fy: 2026, fq: 4, opps: 2, arrUsd: 5000 }),
  // a deal now held by a director, closed by someone else under another region's role: not that director's own
  cl({ owner: 'Director', role: 'DIR-BDR-EMEA', manager: 'Leonard', closedOwner: 'Amer Person', closedRole: 'EM-AMER', fy: 2026, fq: 3 }),
]);
ok(ck2.length === 1 && ck2[0].id === 'clr-x:Em Two' && /4 deals they closed carry another region's role at close \(EM-AMER 4 in Q3 2026\)/.test(ck2[0].what) && /\$12K won; they count for their current team \(Engagement\)/.test(ck2[0].meta) && ck2[0].manager === 'EmMgr',
  'role-at-close check: same-team roles are fine; own deals with another region\'s role are flagged', ck2);
ok(ck.every((c) => c.how && !/undefined|NaN|null/.test(c.what + c.meta + c.how)), 'role-at-close check: clean text and a request');
ok(OS.CHECKS.includes('checks_closed'), 'role-at-close check is listed with the data checks');

// ----- outside EMEA sales: other regions and no role too -----
const pp2 = calcs.partner_pipe.fn([{ role: null, region: 'DACH', rt: 'New Business', fy: 2026, fq: 4, opps: 2, arrUsd: 1000 }, { role: 'AE-AMER-CORP', region: 'FME', rt: 'New Business', fy: 2027, fq: 1, opps: 1, arrUsd: 650000 }]);
ok(pp2.some((r) => r.role === '(no role)' && r.thisArr === 1000) && pp2.some((r) => r.role === 'AE-AMER-CORP' && r.nextArr === 650000), 'outside EMEA sales: users with no role and other regions\' sellers', pp2);

// ----- the saved live answers (4 Nov 2026), old scope: counts and totals only -----
const L = '/tmp/claude-0/-home-user-revopsemeaos/c3936b63-31db-5219-aa72-dbd9a885d4cb/scratchpad/review-closed/live/';
const rec = (f) => { const j = JSON.parse(require('fs').readFileSync(L + f, 'utf8')); return (j.records || j).map(({ attributes, ...r }) => r); };
try {
  DATA.closed_rep = rec('closed_rep.json');
  const lb = run('bookings'), lk = calcs.bookings_kpi.fn(lb).find((r) => r.region === 'All');
  ok(lk.wonThis === 307 && Math.round(lk.wonThisArr) === 6676069 && lk.wonLast === 791, 'live (new scope): won this quarter 307 / $6.68M; last quarter 777 plus the 14 EM-AMER-stamped wins now kept', [lk.wonThis, Math.round(lk.wonThisArr), lk.wonLast]);
  ok(new Set(lb.map((r) => r.key)).size === lb.length, 'live: bookings keys unique', lb.length);
  const ll = run('lost_reasons').filter((r) => r.scope === 'All');
  const g = (x) => ll.find((r) => r.reason === x) || {};
  ok(g('Not a fit').was === 'Qualified Out' && g('Chose an alternative').was === 'Lost to Competitor' && g('Value not perceived').reason && !ll.some((r) => ['Qualified Out', 'Timing', 'Budget'].includes(r.reason)), 'live: old reasons grouped under the new names', ll.map((r) => r.reason + ':' + (r.thisOpps + r.lastOpps)));
  const lc = calcs.checks_closed.fn(DATA.closed_rep);
  const lcA = lc.filter((c) => c.id.startsWith('clr:')), lcB = lc.filter((c) => c.id.startsWith('clr-x:'));
  ok(lcA.length === 3 && lcA.every((c) => /Engagement/.test(c.what) && /Nordics/.test(c.what)), 'live: the 3 people with Engagement and Nordics stamps in both quarters', lcA.map((c) => c.what.replace(/^[^(]*/, '')));
  ok(lcB.length >= 1 && lcB.every((c) => /EM-AMER/.test(c.what)), 'live: EMEA people whose own deals carry EM-AMER at close', lcB.map((c) => c.what.replace(/^[^(]*/, '')));
  const lp = calcs.partner_pipe.fn(rec('pipe_partner.json'));
  const la = lp.find((r) => r.role === 'All');
  ok(la && lp.length > 5 && lp.some((r) => r.role === '(no role)') && lp.some((r) => r.role === 'AD-STRAT'), 'live (new filter): every role outside EMEA sales, no role included', lp.map((r) => [r.role, r.allOpps, Math.round(r.allArr)]));
  const lcov = calcs.pipe_cover.fn(rec('coverage_base.json'), rec('cycle_team.json')).find((r) => r.key === 'All|All');
  ok(lcov && lcov.avgBookings > 0 && lcov.winRate > 0 && lcov.winRate < 1, 'live: coverage computes', lcov && [Math.round(lcov.avgBookings), Math.round(lcov.winRate * 100) + '%']);
} catch (e) { ok(false, 'live answers readable', String(e).slice(0, 200)); }
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
