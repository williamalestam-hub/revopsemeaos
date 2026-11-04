const calcs = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, params: () => ({}), setParams: () => {}, onData: () => {}, draw: () => {}, colors: [], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.window = global; global.location = { hash: '' }; global.document = { querySelectorAll: () => [], addEventListener: () => {} };
global.d3 = { format: () => (v) => String(v), utcFormat: () => (d) => String(d) }; global.requestAnimationFrame = (f) => f();
require('/home/user/revopsemeaos/dashboard/os-calcs.js');
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const hb = [
  { id: '1', name: 'Ann Lee', email: 'ann.lee@legora.com', title: 'GTM Manager', department: 'GTM EMEA', team: 'GTM EMEA', site: 'S', manager: 'Bo Boss', startDate: day(200) },
  { id: '2', name: 'Bob Nickname', email: 'robert.n@legora.com', title: 'Senior GTM Manager', department: 'GTM EMEA', team: 'GTM EMEA', site: 'S', manager: 'Bo Boss', startDate: day(3) },
  { id: '3', name: 'Cy Strat', email: 'cy@legora.com', title: 'GTM Manager', department: 'GTM EMEA', team: 'GTM STRAT', site: 'S', manager: 'Bo Boss', startDate: day(100) },
  { id: '4', name: 'Di Consult', email: 'di@legora.com', title: 'Consultant', department: 'GTM EMEA', team: 'Public Sector', site: 'S', manager: 'Bo Boss', startDate: day(100) },
  { id: '5', name: 'Ed Norole', email: 'ed@legora.com', title: 'Engagement Manager', department: 'Engagement EMEA', team: 'Engagement EMEA', site: 'S', manager: 'Bo Boss', startDate: day(40) },
  { id: '6', name: 'Fi Nouser', email: 'fi@legora.com', title: 'GTM Manager', department: 'GTM EMEA', team: 'GTM EMEA', site: 'S', manager: 'Bo Boss', startDate: day(20) },
  { id: '7', name: 'Gus Byname', email: null, title: 'Business Development Representative', department: 'GTM EMEA', team: 'GTM EMEA', site: 'S', manager: 'Other Mgr', startDate: day(10) },
  { id: '8', name: 'Hal Future', email: 'hal@legora.com', title: 'GTM Manager', department: 'GTM EMEA', team: 'GTM EMEA', site: 'S', manager: 'Bo Boss', startDate: day(-5) },
];
const users = [
  { userId: '005A', name: 'Ann Lee', email: 'ann.lee@legora.com', role: 'AE-EMEA-FR', manager: 'Bo Boss' },
  { userId: '005B', name: 'Robert Nickname', email: 'robert.n@legora.com', role: 'AE-EMEA-DACH', manager: 'Bo Boss' },
  { userId: '005C', name: 'Cy Strat', email: 'cy@legora.com', role: 'AE-STRAT', manager: 'Bo Boss' },
  { userId: '005D', name: 'Di Consult', email: 'di@legora.com', role: null, manager: 'Bo Boss' },
  { userId: '005E', name: 'Ed Norole', email: 'ed@legora.com', role: null, manager: 'Bo Boss' },
  { userId: '005X', name: 'Shared Box', email: 'shared@legora.com', role: 'OTHER', manager: null },
  { userId: '005Y', name: 'Shared Emea', email: 'shared@legora.com', role: 'BDR-EMEA', manager: null },
  { userId: '005H', name: 'Hal Future', email: 'hal@legora.com', role: 'AE-EMEA-FR', manager: 'Bo Boss' },
];
const roster = [
  { userId: '005A', name: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Bo Boss', isActive: true, title: 'AE' },
  { userId: '005B', name: 'Robert Nickname', role: 'AE-EMEA-DACH', manager: 'Bo Boss', isActive: true },
  { userId: '005G', name: 'Gus Byname', role: 'BDR-EMEA', manager: 'Bo Boss', isActive: true },
  { userId: '005H', name: 'Hal Future', role: 'AE-EMEA-FR', manager: 'Bo Boss', isActive: true },
];
const rr = [{ userId: '005A', poolName: 'RR: France' }];
// people was split into people_core (HiBob x Salesforce) and people (adds routing pools) in a later build
const peopleOf = (h, ro, r, u) => calcs.people.fn(calcs.people_core.fn(h, ro, u), r);
const people = peopleOf(hb, roster, rr, users);
for (const p of people) console.log(p.name.padEnd(13), '|', String(p.matchedBy).padEnd(5), '|', String(p.sfName).padEnd(16), '|', String(p.sfRole).padEnd(13), '|', p.region.padEnd(11), '|', p.status.padEnd(26), '| mgrDiff', p.mgrDiffers, '| seller', p.sellerTitle);
console.log('--- checks_hb');
for (const c of calcs.checks_hb.fn(people)) console.log(c.id.padEnd(8), c.severity.padEnd(6), c.what, '|', c.meta, '| person', c.person);
console.log('--- kpi', JSON.stringify(calcs.checks_hb_kpi.fn(calcs.checks_hb.fn(people)).slice(0, 1)));
console.log('--- hire_kpi All', JSON.stringify(calcs.hire_kpi.fn(people)[0]));
// shared email: EMEA wins
const p2 = peopleOf([{ id: '9', name: 'X', email: 'shared@legora.com', title: 'BDR', manager: null, startDate: day(30) }], [], [], users);
console.log('shared ->', p2[0].sfName, p2[0].sfRole);
