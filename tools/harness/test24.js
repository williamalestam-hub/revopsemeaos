// drawMsg names the connector that is actually missing; 'declined' gets its own wording.
const { Node } = require('./fakedom.js');
const ST = {};
global.dash = { loader() {}, calc() {}, draw() {}, params: () => ({ region: 'All', mgr: '', grOwner: 'all' }), setParams() {}, onData() {}, colors: ['#1'], setLink() {},
  data: (id) => ({ status: ST[id] || 'ok', data: [] }) };
global.d3 = new Proxy({}, { get: (t, k) => (k === 'max' ? (a, f) => Math.max(...a.map(f)) : () => () => '') });
const paras = [];
const mkP = (forName, msg, text) => { const p = new Node('p'); p.dataset.msgFor = forName; p.dataset.msg = msg; p.textContent = text; p.hidden = true; paras.push(p); return p; };
global.document.querySelectorAll = (sel) => (sel === '[data-msg-for]' ? paras : []);
require('/home/user/revopsemeaos/dashboard/os-core.js');
require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js');
require('/home/user/revopsemeaos/dashboard/os-draw.js');
let fails = 0; const eq = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', l, ok ? '' : 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); };
const pConnect = mkP('home-next', 'connect', 'Connect Google Calendar in your claude.ai connectors to see your next 1:1s here.');
const slot = () => { const s = new Node('span'); s.dataset.for = 'home-next'; OS.drawMsg(s); return s; };
// Calendar not connected: the element's own sentence
Object.assign(ST, { cal_events: 'connect', oo_upcoming: 'error' });
let s = slot(); eq('Calendar missing: own sentence shows', [pConnect.hidden, s.textContent], [false, '']);
// only Salesforce missing (users_all feeds oo_upcoming): name Salesforce, hide the Calendar sentence
Object.assign(ST, { cal_events: 'ok', users_all: 'connect' });
s = slot(); eq('Salesforce missing: generic sentence names Salesforce', [pConnect.hidden, s.textContent], [true, 'Connect Salesforce in your claude.ai connectors to see this.']);
// Calendar turned off for this dashboard
Object.assign(ST, { users_all: 'ok', cal_events: 'declined' });
s = slot(); eq('Calendar declined: turned off wording', [pConnect.hidden, s.textContent], [true, "Google Calendar is turned off for this dashboard, so this can't load."]);
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
