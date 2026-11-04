const calcs = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, params: () => ({}), setParams: () => {}, onData: () => {}, draw: () => {}, colors: [], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.window = global; global.location = { hash: '' }; global.document = { querySelectorAll: () => [], addEventListener: () => {} };
require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js');
const users_all = [
  { userId: '1', name: 'Cee Oh', email: 'ceo@legora.com', role: 'CEO', manager: null },
  { userId: '2', name: 'Vee Pee', email: 'vp@legora.com', role: 'VP-SALES-EMEA', manager: 'Cee Oh' },
  { userId: '4', name: 'Ann Lee', email: 'ann@legora.com', role: 'AE-EMEA-FR', manager: 'Vee Pee' },
  { userId: '5', name: 'Bob Ray', email: 'bob@legora.com', role: 'AE-EMEA-FR', manager: 'Vee Pee' },
];
const P = (name, role, manager, o) => ({ name, role, manager, inRoster: true, isActive: true, thisPipe: 0, thisOpps: 0, nextPipe: 0, pastDue: 0, stale: 0, crOpps: 0, crArr: 0, ...o });
const person = [P('Vee Pee', 'VP-SALES-EMEA', 'Cee Oh', {}), P('Ann Lee', 'AE-EMEA-FR', 'Vee Pee', { thisPipe: 100 }), P('Bob Ray', 'AE-EMEA-FR', 'Vee Pee', { thisPipe: 50 })];
const bookings = [{ owner: 'Ann Lee', wonThisArr: 30, wonThis: 1, lostThis: 1 }, { owner: 'Bob Ray', wonThisArr: 80, wonThis: 2, lostThis: 0 }, { owner: 'Gone Person', wonThisArr: 999, wonThis: 9, lostThis: 0 }];
const checks = [{ person: 'Bob Ray', area: 'Routing' }, { person: 'Ann Lee', area: 'Pipeline' }];
for (const t of calcs.team_tree.fn(users_all, [], person, bookings, [], checks)) console.log(t.name.padEnd(8), 'people', t.people, 'won', t.wonThisArr, t.wonThis + '/' + t.lostThis, 'wr', t.winRate, 'checks', t.checks, 'top', t.isTop);
// forecast: no double counting
const pt = calcs.pipe_team.fn([{ role: 'AE-EMEA-FR', manager: 'M', recordType: 'New Business', stage: '5 - Vendor assessment', forecast: 'Commit', fy: new Date().getUTCFullYear(), fq: Math.floor(new Date().getUTCMonth() / 3) + 1, opps: 1, arrUsd: 100, commitUsd: 100, bestCaseUsd: 100 }, { role: 'AE-EMEA-FR', manager: 'M', recordType: 'New Business', stage: '3 - Pilot Validation', forecast: 'Best Case', fy: new Date().getUTCFullYear(), fq: Math.floor(new Date().getUTCMonth() / 3) + 1, opps: 1, arrUsd: 50, commitUsd: 0, bestCaseUsd: 50 }], [{ role: 'AE-EMEA-FR', manager: 'M', recordType: 'New Business', wonArrUsd: 10 }], []);
const fc = calcs.forecast.fn(pt).find((r) => r.key === 'All|All');
console.log('forecast All:', JSON.stringify(fc));
