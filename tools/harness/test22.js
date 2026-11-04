// OS.state traces a failed calc to a dataset that needs connecting; real errors stay errors.
const { Node } = require('./fakedom.js');
const ST = {};
global.dash = { loader() {}, calc() {}, draw() {}, params: () => ({ region: 'All', mgr: '' }), setParams() {}, onData() {}, colors: ['#1'], setLink() {},
  data: (id) => ({ status: ST[id] || 'ok', data: [] }) };
global.d3 = new Proxy({}, { get: () => () => () => {} });
require('/home/user/revopsemeaos/dashboard/os-core.js');
require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js');
let fails = 0; const eq = (l, g, w) => { const ok = g === w; if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', l, ok ? '' : 'got ' + g + ' want ' + w); };
Object.assign(ST, { gr_notes: 'connect', gr_actions: 'error', gr_kpi: 'error' });
eq('Granola not connected: gr_actions says connect', OS.state('gr_actions'), 'connect');
eq('…and a calc two steps up too', OS.state('gr_kpi'), 'connect');
Object.assign(ST, { gr_notes: 'error' });
eq('a real Granola error stays an error', OS.state('gr_actions'), 'error');
Object.assign(ST, { gr_notes: 'ok', gr_actions: 'ok', gr_kpi: 'ok', cal_events: 'declined', oo_upcoming: 'error' });
eq('a turned-off connector says connect', OS.state('oo_upcoming'), 'connect');
Object.assign(ST, { oo_upcoming: 'loading' });
eq('loading stays loading', OS.state('oo_upcoming', 'gr_actions'), 'loading');
Object.assign(ST, { oo_upcoming: 'error', gr_actions: 'error', gr_notes: 'connect' });
eq('connect wins over an earlier error in the list', OS.state('oo_upcoming', 'gr_actions'), 'connect');
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
