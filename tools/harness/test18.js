const { Node } = require('./fakedom.js');
const calcs = {}, draws = {};
let params = { region: 'All', mgr: '' };
const DATA = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; }, onData: () => {}, colors: [], setLink: () => {}, data: (id) => (id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: () => (v) => String(v), max: (a, f) => Math.max(...a.map(f)) };
const handlers = []; document.addEventListener = (ev, fn) => { if (ev === 'click') handlers.push(fn); };
let copied = null; Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: (t) => { copied = t; return Promise.resolve(); } } }, configurable: true, writable: true });
require('/home/user/revopsemeaos/dashboard/os-core.js'); require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js'); require('/home/user/revopsemeaos/dashboard/os-draw.js');
const press = () => { copied = null; const btn = new Node('button'); btn.dataset.copySummary = ''; btn.matches = (sel) => sel === '[data-copy-summary]'; btn.closest = () => btn;
  const ev = { target: { closest: () => btn }, preventDefault() {} }; for (const h of handlers) { try { h(ev); } catch (e) { console.log('handler threw', e.message); } } return copied; };
Object.assign(DATA, {
  pipe_team: [{ key: 'All|All', thisPipe: 4.2e6, thisCommit: 1.1e6, thisBest: 1.9e6, won: 0.8e6 }, { key: 'M|Vee Pee', thisPipe: 1e6, thisCommit: 3e5, thisBest: 4e5, won: 1e5 }],
  pipe_cover: [{ key: 'All|All', avgBookings: 2e6, wonSoFar: 0.8e6, toGo: 1.2e6, openThis: 4.2e6, coverageThis: 3.5, coverageNext: 2.14, projectedThis: 2.3e6, winRate: 0.357, aheadOfUsual: false }, { key: 'M|Vee Pee', avgBookings: 5e4, wonSoFar: 1e5, toGo: 0, openThis: 1e6, coverageThis: null, coverageNext: 1.2, projectedThis: 4e5, winRate: 0.3, aheadOfUsual: true }],
  moves_kpi: [{ region: 'All', created: 364, createdArr: 1.6e7, won: 34, wonArr: 2.81e6, lost: 40, lostArr: 3.95e6, pushed: 27, pushedArr: 3.1e6, pulled: 11, netCommitArr: -4.2e5 }, { region: 'M|Vee Pee', created: 1, createdArr: 1e4, won: 0, wonArr: 0, lost: 0, lostArr: 0, pushed: 1, pushedArr: 5e4, pulled: 0, netCommitArr: 2e4 }],
  risk_kpi: [{ region: 'All', stuck: 705, stuckArr: 4.88e7 }, { region: 'M|Vee Pee', stuck: 0, stuckArr: 0 }],
  leavers_kpi: [{ region: 'All', people: 3, renewals: 6, renewalArr: 352116, deals: 1, leads: 47, accounts: 9 }, { region: 'M|Vee Pee', people: 0 }],
  engagement_kpi: [{ region: 'All', untouched: 234, share: 0.08, noEm: 114 }, { region: 'M|Vee Pee', untouched: 1, share: 0.1, noEm: 1 }],
  checks_kpi: [{ region: 'All', total: 40, high: 12 }], rr_kpi: [{ region: 'All', missing: 2, weekOne: 1 }], cr_kpi: [{ thisWeekOpps: 91, lastWeekOpps: 80, thisQOpps: 900 }],
});
console.log(press()); console.log('---'); params.mgr = 'Vee Pee'; console.log(press());
