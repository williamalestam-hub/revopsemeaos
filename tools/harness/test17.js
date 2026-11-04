const { Node } = require('./fakedom.js');
const calcs = {}, draws = {}, loaders = {};
let params = { region: 'All', mgr: '', person: '', checkArea: 'All' };
const DATA = {};
global.dash = { loader: (id, o) => { loaders[id] = o; }, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; }, onData: () => {}, colors: ['#111','#222','#333','#444','#555','#666','#777','#888'], setLink: () => {}, data: (id) => (id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }) };
global.d3 = new Proxy({}, { get: (t, k) => (k === 'max' ? (a, f) => Math.max(...a.map(f)) : k === 'utcFormat' || k === 'format' ? () => (v) => String(v) : () => () => {}) });
global.claude = { use: async (n) => (n === 'room' ? { canSendToClaudeSession: async () => 'available', sendToClaudeSession: () => Promise.resolve({}) } : null) };
require('/home/user/revopsemeaos/dashboard/os-core.js'); require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js'); require('/home/user/revopsemeaos/dashboard/os-draw.js');
let fails = 0; const eq = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', l, ok ? '' : 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); };
const roster = [
  { userId: '005Pn00000F5v0HIAR', name: 'Em Gone', role: 'EM-EMEA', manager: 'Em Lead', isActive: false },
  { userId: '005Pn00000M0DdNIAV', name: 'Bee Gone', role: 'BDR-EMEA', manager: 'Bdr Lead', isActive: false },
  { userId: '005Pn00000QvqFuIAJ', name: 'Lead Only', role: 'BDR-EMEA', manager: 'Bdr Lead', isActive: false },
  { userId: '005Pn00000ZZZZZIAA', name: 'Pool Only', role: 'AE-EMEA-FR', manager: 'Fr Lead', isActive: false },
  { userId: '005Pn00000CLEANIAA', name: 'Clean Exit', role: 'AE-EMEA-FR', manager: 'Fr Lead', isActive: false },
  { userId: '005Pn00000ACTIVIAA', name: 'Still Here', role: 'AE-EMEA-FR', manager: 'Fr Lead', isActive: true },
];
const lv_opps = [
  { ownerId: '005Pn00000F5v0HIAR', owner: 'Em Gone', role: 'EM-EMEA', manager: 'Em Lead', rt: 'Renewal', opps: 5, arrUsd: 0, contractArrUsd: 344831.78, nextClose: '2027-01-11' },
  { ownerId: '005Pn00000M0DdNIAV', owner: 'Bee Gone', role: 'BDR-EMEA', manager: 'Bdr Lead', rt: 'New Business', opps: 1, arrUsd: 57559.5, contractArrUsd: 57559.5, nextClose: '2026-12-31' },
];
const lv_leads = [
  { ownerId: '005Pn00000M0DdNIAV', status: 'Ready', leads: 32 }, { ownerId: '005Pn00000M0DdNIAV', status: 'Pursuing', leads: 5 }, { ownerId: '005Pn00000M0DdNIAV', status: 'Engaging', leads: 1 },
  { ownerId: '005Pn00000QvqFu', status: 'Ready', leads: 2 }, { ownerId: '005Pn00000QvqFuIAJ', status: 'New', leads: 1 }, // 15- and 18-char ids
];
const books_owner = [
  { owner: 'Em Gone', ownerActive: false, active: 1, customers: 1, arr: 26783.91, emCustomers: 0 },
  { owner: 'Bee Gone', ownerActive: false, active: 8, customers: 0, arr: 0, emCustomers: 0 },
  { owner: 'Still Here', ownerActive: true, active: 40, customers: 10, arr: 5e5, emCustomers: 0 },
];
const rr_members = [
  { poolName: 'RR: France', userId: '005Pn00000ZZZZZIAA', userActive: false }, { poolName: 'RR Gov: France', userId: '005Pn00000ZZZZZ', userActive: false },
  { poolName: 'RR: France', userId: '005Pn00000ACTIVIAA', userActive: true },
];
const core = calcs.leavers_core.fn(roster, lv_opps, books_owner);
const lvLeads = calcs.leavers_leads.fn(core, lv_leads);
const lvPools = calcs.leavers_pools.fn(rr_members);
Object.assign(DATA, { leavers_core: core, leavers_leads: lvLeads, leavers_pools: lvPools });
const lv = OS.leavers().rows;
// LeanData down: leads that loaded stay, pools show as unknown, lead-only leavers still listed
delete DATA.leavers_pools;
const noPools = OS.leavers();
eq('LeanData down: leads kept, pools unknown', [noPools.leadsKnown, noPools.poolsKnown, noPools.rows.map((r) => [r.name, r.leads, r.pools])], [true, false, [['Em Gone', 0, null], ['Bee Gone', 38, null], ['Lead Only', 3, null]]]);
eq('LeanData down: headline leads 41, pools —', (({ people, leads, pools }) => [people, leads, pools])(OS.leaversIn('All')), [3, 41, null]);
DATA.leavers_pools = lvPools; delete DATA.leavers_leads;
const noLeads = OS.leavers();
eq('Leads down: pools kept, leads unknown', noLeads.rows.map((r) => [r.name, r.leads, r.pools]), [['Em Gone', null, 0], ['Bee Gone', null, 0], ['Pool Only', null, 2]]);
DATA.leavers_leads = lvLeads;
const by = Object.fromEntries(lv.map((r) => [r.name, r]));
eq('listed (clean exit and active left out)', lv.map((r) => r.name), ['Em Gone', 'Bee Gone', 'Lead Only', 'Pool Only']);
eq('em gone', [by['Em Gone'].renewals, Math.round(by['Em Gone'].renewalArr), by['Em Gone'].nextClose, by['Em Gone'].customers, by['Em Gone'].status], [5, 344832, '2027-01-11', 1, 'Hand over revenue']);
eq('bee gone', [by['Bee Gone'].deals, by['Bee Gone'].leads, by['Bee Gone'].ready, by['Bee Gone'].accounts, by['Bee Gone'].status], [1, 38, 32, 8, 'Hand over revenue']);
eq('lead only (15/18 ids merge)', [by['Lead Only'].leads, by['Lead Only'].ready, by['Lead Only'].fresh, by['Lead Only'].status], [3, 2, 1, 'Reassign leads']);
eq('pool only', [by['Pool Only'].pools, by['Pool Only'].poolNames, by['Pool Only'].status], [2, 'RR Gov: France, RR: France', 'Remove from routing']);
const kA = OS.leaversIn('All'), kB = OS.leaversIn('BDR'), kM = OS.leaversIn('M|Bdr Lead');
eq('kpi all', [kA.people, kA.deals, kA.renewals, kA.leads, kA.ready, kA.accounts, kA.pools], [4, 1, 5, 41, 34, 9, 2]);
eq('kpi BDR = M|Bdr Lead', [kB.people, kB.leads], [kM.people, kM.leads]);
// checks: deal checks in main calc, lead checks in checks_lv
const ch = calcs.checks.fn([], [], [], roster, lv_opps).filter((c) => c.area === 'Leavers');
eq('deal checks', ch.map((c) => [c.title, c.severity, c.what, c.meta, c.region, c.view]), [
  ['Bee Gone', 'high', 'Left, still owns 1 open deal ($58K ARR)', 'next closes 31 Dec 2026', 'BDR', 'leavers'],
  ['Em Gone', 'high', 'Left, still owns 5 open renewals ($345K contract ARR)', 'next closes 11 Jan 2027', 'Engagement', 'leavers']]);
const cl = calcs.checks_lv.fn(lv_leads, roster);
eq('lead checks', cl.map((c) => [c.title, c.severity, c.what, c.meta]), [['Bee Gone', 'high', 'Left, still owns 38 open leads', '32 Ready'], ['Lead Only', 'medium', 'Left, still owns 3 open leads', '2 Ready, 1 New']]);
// drawings
Object.assign(DATA, { checks: calcs.checks.fn([], [], [], roster, lv_opps), checks_lv: cl, checks_hb: [] });
const fake = (name, ds) => { const el = new Node(/table/.test(name) ? 'tbody' : /list|checks/.test(name) ? 'ul' : 'b'); el.dataset.draw = name; Object.assign(el.dataset, ds || {}); return el; };
const run = (n, ds) => { const el = fake(n, ds); draws[n](el); return el; };
const rows = (el) => { let c = 0; const w = (n) => { if (n.tagName && /^(tr|li)$/i.test(n.tagName)) c++; (n.children || []).forEach(w); }; w(el); return c; };
const t = run('lv-table'); eq('lv-table rows', rows(t), 4);
const txt = (el) => el.textContent.replace(/\s+/g, ' ').trim();
console.log('  row 1:', txt(t.children[0]).slice(0, 180));
params.checkArea = 'Leavers'; const l = run('check-list'); eq('Leavers chip shows deal + lead checks', rows(l), 4);
const go = []; const walk = (n) => { if (n.dataset && n.dataset.nav) go.push(n.dataset.nav + ':' + n.dataset.navView); (n.children || []).forEach(walk); }; walk(l);
eq('go buttons target hiring:leavers', [...new Set(go)], ['hiring:leavers']);
params.checkArea = 'All'; params.region = 'Engagement'; eq('scope Engagement', rows(run('lv-table')), 1);
params.region = 'All'; params.mgr = 'Bdr Lead'; eq('scope M|Bdr Lead', rows(run('lv-table')), 2);
eq('kpi-lv under manager', txt(run('kpi-lv', { source: 'leavers_core', field: 'leads' })), '41');
delete DATA.leavers_leads; eq('kpi-lv leads unknown shows —', txt(run('kpi-lv', { source: 'leavers_core', field: 'leads' })), '—'); DATA.leavers_leads = lvLeads;
params.mgr = '';
(async () => {
  await new Promise((r) => setTimeout(r, 30));
  const find = (el, pred, out = []) => { if (pred(el)) out.push(el); for (const c of el.children || []) find(c, pred, out); return out; };
  for (const n of ['lv-table', 'check-list']) {
    params.checkArea = 'Leavers';
    const asks = find(run(n), (x) => x.dataset && x.dataset.ask).map((x) => x.dataset.ask);
    const ok = asks.every((a) => { try { const d = JSON.parse(a); return d.label && d.ask; } catch (e) { return false; } });
    eq(n + ' ask buttons', asks.length, 4); eq(n + ' payloads valid', ok, true);
    console.log('  max payload', Math.max(...asks.map((a) => a.length)), 'bytes');
    console.log('  sample:', JSON.parse(asks[1]).ask.slice(0, 520));
  }
  const links = find(run('lv-table'), (x) => x.tagName === 'A').map((a) => String(a.href));
  console.log('  sf links:', links.slice(0, 2).join(' , '));
  console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
})();
setTimeout(() => {
  const find = (el, pred, out = []) => { if (pred(el)) out.push(el); for (const c of el.children || []) find(c, pred, out); return out; };
  DATA.person = [{ name: 'Bee Gone', userId: '005Pn00000M0DdNIAV', role: 'BDR-EMEA', manager: 'Bdr Lead', isActive: false }, { name: 'Still Here', userId: '005Pn00000ACTIVIAA', role: 'AE-EMEA-FR', manager: 'Fr Lead', isActive: true }];
  DATA.users_all = [{ userId: '005Pn00000ACTIVIAA', name: 'Still Here', email: 'still@legora.com' }];
  for (const who of ['Bee Gone', 'Still Here']) {
    params.person = who;
    const box = new Node('span'); draws['pd-act'](box);
    const a = find(box, (x) => x.dataset && x.dataset.ask).map((x) => JSON.parse(x.dataset.ask).label);
    console.log('pd-act', who.padEnd(10), '| ask:', a.join(), '| mail:', find(box, (x) => /^mailto:/.test(String(x.href || ''))).length);
  }
}, 60);
