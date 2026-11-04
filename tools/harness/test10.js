// load test9's fixtures, then run every registered drawing on a fake element and report throws
const { Node } = require('./fakedom.js');
const src = require('fs').readFileSync(__dirname + '/test9.js', 'utf8').split("const run = ")[0];
// test9's top-level consts and lets must outlive the eval, so they are declared with var here
eval(src.replace("const { Node } = require('./fakedom.js');", '').replace(/^(const|let) /gm, 'var '));
DATA.oo_kpi = calcs.oo_kpi.fn(DATA.oo_upcoming);
DATA.person = person.map((p) => ({ ...p, userId: '005000000000001AAA' }));
DATA.checks = [{ id: 'c1', area: 'Routing', severity: 'high', title: 'Ann Lee', person: 'Ann Lee', region: 'France', manager: 'Vee Pee', what: 'Missing from routing', meta: 'peers are in RR: France', screen: 'routing' }];
DATA.checks_hb = [];
DATA.deal_list = [{ oppId: '006000000000001AAA', opp: 'Acme - NB', owner: 'Ann Lee', manager: 'Vee Pee', region: 'France', stage: '1 - Qualify', closeDate: '2026-11-20', quarter: 'this', forecast: 'Commit', arrUsd: 90000, flags: 'Commit at early stage', risk: 5 }];
DATA.renewal_list = [{ oppId: '006000000000002AAA', opp: 'Beta - Renewal', owner: 'Ann Lee', manager: 'Vee Pee', region: 'France', stage: '2', closeDate: '2026-12-01', daysToClose: 28, quarter: 'this', rating: 'High', renewingArrUsd: 1, netChangeArrUsd: -1, flags: '' }];
DATA.person_deals = DATA.deal_list;
DATA.roster = [{ userId: '1', name: 'Ann Lee', role: 'AE-EMEA-FR', manager: 'Vee Pee', isActive: true }];
global.OSQ = OS;
const fake = (name) => { const tag = /table|pd-team/.test(name) ? 'tbody' : /pick|root/.test(name) ? 'select' : 'ul'; const el = new Node(tag); el.dataset.draw = name; return el; };
let thrown = 0, ran = 0;
for (const [name, fn] of Object.entries(draws)) {
  if (name === 'msg') continue;
  const el = fake(name);
  el.dataset.source = 'gr_kpi'; el.dataset.field = 'forYou'; el.dataset.f = 'forYou'; el.dataset.row = '0'; el.dataset.fmt = 'usd';
  try { fn(el); ran++; } catch (e) { thrown++; console.log('THROW', name, String(e && e.message).slice(0, 140)); }
}
console.log('ran', ran, 'threw', thrown);
// specific checks
const show = (n) => { const el = fake(n); try { draws[n](el); } catch (e) { return 'THROW ' + e.message; } return el.textContent.replace(/\s+/g, ' ').slice(0, 160); };
for (const n of ['scope-label', 'mgr-list', 'hero-date', 'hero-name', 'home-next', 'pd-act', 'oo-mail', 'deal-table', 'check-list', 'act-list']) console.log(n.padEnd(12), '|', show(n));
params.person = 'Ann Lee'; console.log('pd-act w/ person |', show('pd-act'));
params.mgr = 'Vee Pee'; console.log('scope-label mgr |', show('scope-label'));
