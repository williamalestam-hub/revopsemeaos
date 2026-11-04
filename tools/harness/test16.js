// Wave 5 calcs: pipe_moves, moves_kpi, pipe_cover, engagement, engagement_kpi, rep_risk stuck; mv_fields loader; new drawings.
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
require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js');
require('/home/user/revopsemeaos/dashboard/os-draw.js');
let fails = 0;
const eq = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); };
const near = (label, got, want) => { const ok = got != null && Math.abs(got - want) < 1e-9; if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : 'got ' + got + ' want ' + want); };

const now = new Date(); const FY = now.getUTCFullYear(), FQ = Math.floor(now.getUTCMonth() / 3) + 1;
const nextQ = FQ === 4 ? [FY + 1, 1] : [FY, FQ + 1];
const prevQ = (k) => { let y = FY, q = FQ; for (let i = 0; i < k; i++) { q--; if (q === 0) { q = 4; y--; } } return [y, q]; };

// ---------- pipe_moves ----------
const roster = [
  { userId: '005Pn00000AAAAAIAA', name: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Vee Pee' },
  { userId: '005Pn00000BBBBBIAA', name: 'Bob Ray', role: 'AE-EMEA-DACH', manager: 'Dee Ach' },
];
const mv_outcomes = [
  { owner: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Vee Pee', won: true, n: 2, arr: 100 },
  { owner: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Vee Pee', won: false, n: 1, arr: 40 },
  { owner: 'Bob Ray', role: 'AE-EMEA-DACH', manager: 'Dee Ach', won: false, n: 1, arr: 0 },
];
const mv_created = [
  { owner: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Vee Pee', toFY: FY, toFQ: FQ, opps: 3, arr: 300 },
  { owner: 'Bob Ray', role: 'AE-EMEA-DACH', manager: 'Dee Ach', toFY: nextQ[0], toFQ: nextQ[1], opps: 1, arr: 10 },
];
const Q = [FY, FQ], N = nextQ, L = FQ >= 3 ? [FY + 1, FQ - 2] : [FY, FQ + 2];
const R = (oppId, owner, from, to, firstAt, lastAt, arr) => ({ oppId, owner, role: owner === 'Ann Lee' ? 'AE-EMEA-FR' : 'AE-EMEA-DACH', manager: owner === 'Ann Lee' ? 'Vee Pee' : 'Dee Ach', fromFY: from[0], fromFQ: from[1], toFY: to[0], toFQ: to[1], firstAt, lastAt, arr });
const mv_close = [
  R('A', 'Ann Lee', Q, N, '2026-11-01T09:00:00.000+0000', '2026-11-01T09:00:00.000+0000', 120), // pushed
  R('B', 'Ann Lee', Q, N, '2026-11-01T09:00:00.000+0000', '2026-11-01T09:00:00.000+0000', 500), // out ...
  R('B', 'Ann Lee', N, Q, '2026-11-02T09:00:00.000+0000', '2026-11-02T09:00:00.000+0000', 500), // ... and back: no count
  R('C', 'Ann Lee', Q, N, '2026-10-28T09:00:00.000+0000', '2026-10-28T09:00:00.000+0000', 80), // out
  R('C', 'Ann Lee', N, Q, '2026-10-29T09:00:00.000+0000', '2026-10-29T09:00:00.000+0000', 80), // back
  R('C', 'Ann Lee', Q, L, '2026-10-30T09:00:00.000+0000', '2026-10-30T09:00:00.000+0000', 80), // out again: pushed once
  R('D', 'Bob Ray', N, Q, '2026-10-28T09:00:00.000+0000', '2026-10-28T09:00:00.000+0000', 50), // pulled
  R('E', 'Bob Ray', N, Q, '2026-10-28T09:00:00.000+0000', '2026-10-28T09:00:00.000+0000', 70), // pulled in ...
  R('E', 'Bob Ray', Q, N, '2026-10-29T09:00:00.000+0000', '2026-10-31T09:00:00.000+0000', 70), // ... and out again (twice): no count
];
const F = (oppId, ownerId, arrUsd, field, oldValue, newValue, at) => ({ oppId, ownerId, arrUsd, field, oldValue, newValue, at });
const mv_fields = [
  F('o1', '005Pn00000AAAAAIAA', 70, 'StageName', '2 - Scope agreement', '3 - Pilot Validation', '1'),
  F('o1', '005Pn00000AAAAAIAA', 70, 'StageName', '3 - Pilot Validation', '4 - Commercial agreement', '2'),
  F('o1', '005Pn00000AAAAAIAA', 70, 'Rep_Forecast_Category__c', 'Best Case', 'Commit', '3'),
  F('o2', '005Pn00000AAAAA', 30, 'StageName', '3 - Pilot Validation', '2 - Scope agreement', '1'), // 15-char id, round trip
  F('o2', '005Pn00000AAAAA', 30, 'StageName', '2 - Scope agreement', '3 - Pilot Validation', '2'),
  F('o3', '005Pn00000BBBBBIAA', 25, 'StageName', '4 - Commercial agreement', '1 - Solution agreement', '1'),
  F('o4', '005Pn00000BBBBBIAA', 60, 'Rep_Forecast_Category__c', 'Commit', 'Pipeline', '1'),
  F('o4', '005Pn00000BBBBBIAA', 60, 'Rep_Forecast_Category__c', 'Pipeline', 'Commit', '2'), // round trip: no count
  F('o5', '005Pn00000ZZZZZIAA', 99, 'StageName', '1 - Solution agreement', '2 - Scope agreement', '1'), // not in roster
  F('o6', '005Pn00000BBBBBIAA', 15, 'Rep_Forecast_Category__c', null, 'Commit', '1'),
];
const pm = calcs.pipe_moves.fn(mv_outcomes, mv_created, mv_close, mv_fields, roster);
const ann = pm.find((r) => r.owner === 'Ann Lee'), bob = pm.find((r) => r.owner === 'Bob Ray');
eq('ann created', [ann.created, ann.createdArr, ann.createdThisQ], [3, 300, 3]);
eq('ann won/lost', [ann.won, ann.wonArr, ann.lost, ann.lostArr], [2, 100, 1, 40]);
eq('ann pushed (netted per deal: A and C, not B)', [ann.pushed, ann.pushedArr, ann.pulled], [2, 200, 0]);
eq('ann stage up/down (round trip ignored)', [ann.up, ann.upArr, ann.down], [1, 70, 0]);
eq('ann into commit', [ann.intoCommit, ann.intoCommitArr, ann.outCommit], [1, 70, 0]);
eq('bob created next q', [bob.created, bob.createdThisQ], [1, 0]);
eq('bob pulled (D; E went in and back out)', [bob.pulled, bob.pulledArr, bob.pushed], [1, 50, 0]);
eq('bob down', [bob.down, bob.downArr, bob.up], [1, 25, 0]);
eq('bob commit (round trip ignored, null->Commit counts)', [bob.intoCommit, bob.intoCommitArr, bob.outCommit], [1, 15, 0]);
eq('unknown owner dropped', pm.length, 2);
eq('regions', [ann.region, bob.region], ['France', 'DACH']);
const mk = calcs.moves_kpi.fn(pm);
const all = mk.find((r) => r.region === 'All'), fr = mk.find((r) => r.region === 'France'), mVee = mk.find((r) => r.region === 'M|Vee Pee');
eq('kpi all', [all.created, all.won, all.lost, all.pushed, all.pulled, all.up, all.down, all.moves, all.intoCommit, all.netCommitArr], [4, 2, 2, 2, 1, 1, 1, 2, 2, 85]);
eq('kpi france = M|Vee Pee', [fr.pushedArr, mVee.pushedArr], [200, 200]);

// ---------- pipe_cover ----------
const [y1, q1] = prevQ(1), [y2, q2] = prevQ(2), [y3, q3] = prevQ(3), [y4, q4] = prevQ(4), [y5, q5] = prevQ(5);
const C = (role, manager, closed, won, fy, fq, arr, n) => ({ role, manager, closed, won, fy, fq, arr, n });
const coverage_base = [
  C('AE-EMEA-FR', 'Vee Pee', true, true, y4, q4, 100, 3), C('AE-EMEA-FR', 'Vee Pee', true, true, y3, q3, 200, 3),
  C('AE-EMEA-FR', 'Vee Pee', true, true, y1, q1, 100, 3), C('AE-EMEA-FR', 'Vee Pee', true, false, y2, q2, 600, 5),
  C('AE-EMEA-FR', 'Vee Pee', true, true, y5, q5, 9999, 9), // 5 quarters ago: ignored
  C('AE-EMEA-FR', 'Vee Pee', true, true, FY, FQ, 40, 1), C('AE-EMEA-FR', 'Vee Pee', true, false, FY, FQ, 30, 1),
  C('AE-EMEA-FR', 'Vee Pee', false, false, FY, FQ, 180, 6), C('AE-EMEA-FR', 'Vee Pee', false, false, nextQ[0], nextQ[1], 250, 4),
  C('AE-EMEA-DACH', 'Dee Ach', true, true, y1, q1, 50, 1), C('AE-EMEA-DACH', 'Dee Ach', true, false, y1, q1, 50, 1),
  C('AE-EMEA-DACH', 'Dee Ach', false, false, FY, FQ, 10, 1), C('AE-EMEA-DACH', 'Dee Ach', true, true, FY, FQ, 20, 1),
  C('AE-EMEA-FR', 'Vee Pee', false, false, null, null, 1, 1), // no date: skipped
  C('AE-EMEA-FR', 'Vee Pee', false, false, y1, q1, 900, 1), // past due from last quarter: not this quarter's pipeline
];
const cycle_team = [{ role: 'AE-EMEA-FR', manager: 'Vee Pee', rt: 'New Business', wonOpps: 2, avgCycleDays: 100 }, { role: 'AE-EMEA-FR', manager: 'Vee Pee', rt: 'Upsell', wonOpps: 2, avgCycleDays: 50 }];
const cov = calcs.pipe_cover.fn(coverage_base, cycle_team);
const frT = cov.find((r) => r.key === 'France|Vee Pee'), frR = cov.find((r) => r.key === 'France|All'), allC = cov.find((r) => r.key === 'All|All'), dT = cov.find((r) => r.key === 'DACH|Dee Ach'), mV = cov.find((r) => r.key === 'M|Vee Pee');
eq('fr levels', [frT.level, frR.level, allC.level, mV.level], ['team', 'region', 'all', 'manager']);
eq('fr avg/hist', [frT.avgBookings, frT.histQuarters, frT.wonSoFar, frT.toGo], [100, 3, 40, 60]);
near('fr coverage this', frT.coverageThis, 3); near('fr coverage next', frT.coverageNext, 2.5);
near('fr win rate own', frT.winRate, 0.4); eq('fr no fallback', frT.winRateFallback, false);
near('fr expected', frT.expectedThis, 72); near('fr projected', frT.projectedThis, 112);
near('fr cycle', frT.avgCycleDays, 75);
eq('dach falls back (2 closed)', dT.winRateFallback, true);
near('dach uses all rate', dT.winRate, allC.winRate);
near('all win rate', allC.winRate, 450 / 1100);
eq('dach ahead: avg 12.5, won 20', [dT.avgBookings, dT.aheadOfUsual, dT.toGo, dT.coverageThis], [12.5, true, 0, null]);
eq('fr manager row = team row', [mV.avgBookings, mV.openThis], [frT.avgBookings, frT.openThis]);

// ---------- engagement ----------
const books_owner = [
  { owner: 'Ann Lee', region: 'France', manager: 'Vee Pee', role: 'AE-EMEA-FR', active: 10 },
  { owner: 'Bob Ray', region: 'DACH', manager: 'Dee Ach', role: 'AE-EMEA-DACH', active: 50 },
  { owner: 'Cat Ng', region: 'France', manager: 'Vee Pee', role: 'AE-EMEA-FR', active: 0 },
];
const bk_stale = [
  { owner: 'Ann Lee', status: 'Customer', accounts: 1, everTouched: 1, arrUsd: 500 },
  { owner: 'Ann Lee', status: 'Pipeline', accounts: 1, everTouched: 0 },
  { owner: 'Bob Ray', status: 'Engaging', accounts: 2, everTouched: 2 },
];
const bk_em_cover = [
  { owner: 'Ann Lee', emRole: null, emActive: null, customers: 2, withEm: 0, arrUsd: 300 },
  { owner: 'Ann Lee', emRole: 'EM-EMEA', emActive: true, customers: 3, withEm: 3, arrUsd: 900 },
  { owner: 'Bob Ray', emRole: 'AE-EMEA-DACH', emActive: true, customers: 4, withEm: 4, arrUsd: 100 },
  { owner: 'Bob Ray', emRole: 'EM-EMEA', emActive: false, customers: 1, withEm: 1, arrUsd: 50 },
];
const en = calcs.engagement.fn(books_owner, bk_stale, bk_em_cover);
const ea = en.find((r) => r.owner === 'Ann Lee'), eb = en.find((r) => r.owner === 'Bob Ray');
eq('ann engagement', [ea.untouched, ea.never, ea.untouchedCustomers, ea.untouchedArr, ea.customers, ea.noEm, ea.noEmArr, ea.emNotEm], [2, 1, 1, 500, 5, 2, 300, 0]);
near('ann share', ea.share, 0.2); eq('ann flag (20% of 10)', ea.flag, 'Untouched book');
eq('bob engagement', [eb.untouched, eb.never, eb.noEm, eb.emNotEm, eb.flag], [2, 0, 1, 4, 'Customers without an EM']);
eq('cat dropped (no active, no customers)', en.some((r) => r.owner === 'Cat Ng'), false);
const ek = calcs.engagement_kpi.fn(en);
const eAll = ek.find((r) => r.region === 'All');
eq('eng kpi all', [eAll.active, eAll.untouched, eAll.never, eAll.noEm, eAll.flagged], [60, 4, 1, 3, 1]);

// ---------- rep_risk stuck ----------
const rr = calcs.rep_risk.fn([{ owner: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Vee Pee', thisPipe: 1000, pastDue: 1, stale: 2 }], [], [], [], [], [],
  [{ owner: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Vee Pee', stage: '3 - Pilot Validation', stuckOpps: 2, stuckArrUsd: 80 }, { owner: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Vee Pee', stage: '4 - Commercial agreement', stuckOpps: 1, stuckArrUsd: 20 }]);
eq('ann stuck', [rr[0].stuck, rr[0].stuckArr, rr[0].score], [3, 100, 3 + 3 + 1]);
const rk = calcs.risk_kpi.fn(rr).find((r) => r.region === 'All');
eq('risk kpi stuck', [rk.stuck, rk.stuckArr], [3, 100]);

// ---------- mv_fields loader ----------
const ans = JSON.stringify({ totalSize: 1, done: true, records: [{ attributes: {}, OpportunityId: '006X', Opportunity: { attributes: {}, OwnerId: '005Pn00000AAAAAIAA', Finance_ARR_USD__c: 12.5 }, Field: 'StageName', OldValue: '1 - Solution agreement', NewValue: '2 - Scope agreement', CreatedDate: '2026-11-01T10:00:00.000+0000' }] });
const lo = loaders.mv_fields.fn({ answer: [{ type: 'text', text: ans }] });
eq('loader row', lo.rows[0], { oppId: '006X', ownerId: '005Pn00000AAAAAIAA', arrUsd: 12.5, field: 'StageName', oldValue: '1 - Solution agreement', newValue: '2 - Scope agreement', at: '2026-11-01T10:00:00.000+0000' });
eq('loader cut', lo.cut, false);
let threw = false; try { loaders.mv_fields.fn({ answer: [{ type: 'text', text: '[{"message":"INVALID_FIELD: No such column","errorCode":"INVALID_FIELD"}]' }] }); } catch (e) { threw = /INVALID_FIELD/.test(e.message); }
eq('loader surfaces SF error', threw, true);

// ---------- drawings ----------
Object.assign(DATA, { pipe_moves: pm, moves_kpi: mk, pipe_cover: cov, engagement: en, engagement_kpi: ek, rep_risk: rr, risk_kpi: calcs.risk_kpi.fn(rr), roster, person: [], deal_list: [], books_owner, book_moves: [] });
const fake = (name, ds) => { const tag = /table/.test(name) ? 'tbody' : 'b'; const el = new Node(tag); el.dataset.draw = name; Object.assign(el.dataset, ds || {}); return el; };
const show = (n, ds) => { const el = fake(n, ds); try { draws[n](el); } catch (e) { fails++; return 'THROW ' + e.message; } return el.textContent.replace(/\s+/g, ' ').trim().slice(0, 200); };
const scopes = [['All', ''], ['France', ''], ['All', 'Vee Pee'], ['CEE', '']];
for (const [region, mgr] of scopes) {
  params.region = region; params.mgr = mgr;
  console.log(`-- scope ${region}${mgr ? ' / ' + mgr : ''}`);
  console.log('  kpi-mv pushedArr  |', show('kpi-mv', { source: 'moves_kpi', field: 'pushedArr', fmt: 'usd' }));
  console.log('  kpi-cov coverage  |', show('kpi-cov', { source: 'pipe_cover', field: 'coverageThis', fmt: 'x' }));
  console.log('  kpi-cov cycle     |', show('kpi-cov', { source: 'pipe_cover', field: 'avgCycleDays', fmt: 'days' }));
  console.log('  kpi-eng untouched |', show('kpi-eng', { source: 'engagement_kpi', field: 'untouched' }));
  console.log('  mv-table          |', show('mv-table'));
  console.log('  cov-table         |', show('cov-table'));
  console.log('  eng-table         |', show('eng-table'));
}
console.log(fails ? `${fails} FAILURES` : 'ALL PASS');
