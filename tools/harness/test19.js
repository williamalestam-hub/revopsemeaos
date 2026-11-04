// Leads calcs on the saved, tested query answers (3 Nov 2026). Prints aggregates only: no lead-level data.
const fs = require('fs');
const path = require('path');
const S = path.join(__dirname, '..');
const rows = (f) => JSON.parse(fs.readFileSync(path.join(S, 'leads-final', 'data', f), 'utf8')).records.map(({ attributes, ...r }) => r);
const D = {
  ld_ready: rows('ld_ready.json'), ld_handoffs: rows('ld_handoffs.json'), ld_inflow: rows('ld_inflow.json'), ld_open: rows('ld_open.json'),
  roster: JSON.parse(fs.readFileSync(path.join(S, 'leads-design', 'roster_test.json'), 'utf8')),
};
const NOW = process.env.NOW ? Date.parse(process.env.NOW) : null;
if (NOW) { const RealDate = Date; const off = NOW - RealDate.now(); global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [RealDate.now() + off])); } static now() { return RealDate.now() + off; } }; }
const calcs = new Map();
global.dash = { calc: (id, def) => calcs.set(id, def), loader: () => {} };
global.d3 = {};
require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js');
const order = ['ld_handoff_rows', 'ld_backlog', 'ld_backlog_open', 'ld_reps', 'ld_problems', 'ld_sources', 'ld_kpi', 'ld_badge', 'ld_kpi_rt', 'ld_kpi_in', 'ld_trust', 'ld_trust_cap', 'checks_ld', 'checks_ld_rt', 'checks_ld_cap'];
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('FAIL', msg); } };
for (const id of order) {
  const def = calcs.get(id);
  ok(def, 'calc ' + id + ' defined');
  const t = Date.now();
  D[id] = def.fn(...def.inputs.map((i) => { if (!D[i]) throw new Error(id + ' missing ' + i); return D[i]; }));
  console.log(id.padEnd(16), String(D[id].length).padStart(4), 'rows', (Date.now() - t) + 'ms');
}
const K = (k) => D.ld_kpi.find((r) => r.region === k);
const A = { ...K('All'), ...D.ld_kpi_rt.find((r) => r.region === 'All'), ...D.ld_kpi_in[0], badge: D.ld_badge.find((r) => r.region === 'All').demoWaiting };
console.log('All:', JSON.stringify({ handoffs: A.handoffs, last7: A.last7, h: [A.hWithin, A.hEligible, A.hRate && +A.hRate.toFixed(3), A.hMedianHours && +A.hMedianHours.toFixed(1), A.hMedianAtLeast], l: [A.lWithin, A.lEligible, A.lWaiting], leftOut: A.leftOut, ready: A.readyNow, demoOverdue: A.demoOverdue, b21: A.b21, noDate: A.noDate, stampGap: A.stampGap, elsewhere: A.elsewhere, leaverReady: A.leaverReady, queueReady: A.queueReady, outsideReady: A.outsideReady, reviewReady: A.reviewReady, routing: [A.routingIssues, A.errors, A.routingHigh], wrong: [A.wrongOwner, A.inactiveLeads, A.outsideLeads, A.outsideOwners, A.reviewLeads], route: [A.routedFast, A.routedAtReady, A.routeMedianMin && +A.routeMedianMin.toFixed(1), A.stillInQueue], created: [A.created, A.inQueue, A.toPerson, A.autoConverted, A.routingErrors30], demo: [A.demoCreated, A.demoAuto, A.demoHandoffs, A.demoSmb, A.demoScored], badge: A.badge }));
// sums: teams = All, managers = All for the seller measures
const teams = ['France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
for (const f of ['handoffs', 'hEligible', 'hWithin', 'lEligible', 'lWithin', 'readyNow', 'demoOverdue', 'b21', 'leftOut', 'elsewhere', 'stampGap', 'noDate']) {
  const t = teams.reduce((s, k) => s + (K(k)[f] || 0), 0);
  ok(t === A[f], 'team sum ' + f + ' ' + t + ' vs All ' + A[f]);
}
const mgrs = D.ld_kpi.filter((r) => r.region.startsWith('M|'));
for (const f of ['handoffs', 'readyNow']) {
  const nm = D.ld_handoff_rows.filter((r) => (r.ownerKind === 'EMEA seller' || r.ownerKind === 'Left (inactive)') && r.manager === '(no manager)').length;
  const nb = D.ld_backlog.filter((r) => (r.kind === 'EMEA seller' || r.kind === 'Left (inactive)') && r.manager === '(no manager)').reduce((s, r) => s + r.ready, 0);
  const t = mgrs.reduce((s, r) => s + (r[f] || 0), 0) + (f === 'handoffs' ? nm : nb);
  ok(t === A[f], 'manager sum ' + f + ' ' + t + ' vs All ' + A[f]);
}
// reps = All
const R = D.ld_reps;
ok(R.reduce((s, r) => s + r.handoffs, 0) === A.handoffs, 'rep handoffs = All');
ok(R.reduce((s, r) => s + r.readyNow, 0) === A.readyNow, 'rep readyNow = All');
ok(R.reduce((s, r) => s + r.demoOverdue, 0) === A.demoOverdue, 'rep demoOverdue = All');
ok(R.every((r) => r.name === r.owner && r.key), 'rep rows carry name and key');
const st = {}; R.forEach((r) => { st[r.status] = (st[r.status] || 0) + 1; });
console.log('rep status', JSON.stringify(st));
// backlog
const bk = {}; D.ld_backlog.forEach((r) => { bk[r.kind] = (bk[r.kind] || 0) + 1; });
const td = {}; D.ld_backlog.forEach((r) => { td[r.todo || '(none)'] = (td[r.todo || '(none)'] || 0) + 1; });
console.log('backlog kinds', JSON.stringify(bk), 'todo', JSON.stringify(td));
ok(D.ld_backlog.reduce((s, r) => s + r.ready, 0) === D.ld_ready.reduce((s, r) => s + (+r.leads || 0), 0), 'backlog ready = ld_ready total');
ok(D.ld_backlog.every((r) => r.b1 + r.b5 + r.b20 + r.b21 + r.noDate + r.stampGap === r.ready), 'age bands add up to ready');
ok(D.ld_backlog.every((r) => r.noDateAll === r.noDate + r.stampGap && (r.noDate > 0) === (r.oldest === 'before 19 May 2026')), 'derived backlog fields and the before-19-May oldest');
ok(D.ld_backlog_open.reduce((s, r) => s + r.open, 0) === D.ld_open.reduce((s, r) => s + (+r.leads || 0), 0), 'open per owner adds up to ld_open');
ok(D.ld_backlog.every((r) => r.kind !== 'Outside EMEA sales' || r.active || r.todo === 'Reassign'), 'inactive owners outside EMEA sales get Reassign');
ok(D.ld_backlog.every((r) => !r.review || r.active), 'review only for active strategic or partnership owners');
// problems
const pk = {}; D.ld_problems.forEach((r) => { pk[r.kind] = (pk[r.kind] || 0) + r.leads; });
console.log('problems', D.ld_problems.length, JSON.stringify(pk));
ok(D.ld_problems.every((r) => ['high', 'medium', 'low'].includes(r.severity) && r.action), 'problem severity and action');
// sources
const so = D.ld_sources;
ok(so.reduce((s, r) => s + r.created, 0) === D.ld_inflow.reduce((s, r) => s + (+r.leads || 0), 0), 'sources created = inflow');
ok(so.reduce((s, r) => s + r.handoffs, 0) === D.ld_handoff_rows.length, 'sources handoffs = handoff rows');
ok(so.reduce((s, r) => s + r.readyNow, 0) === D.ld_ready.reduce((s, r) => s + (+r.leads || 0), 0), 'sources readyNow = ld_ready');
ok(so.every((r) => r.region === 'All'), 'sources are all EMEA');
// hand-off rows
const cl = {}; D.ld_handoff_rows.forEach((r) => { cl[r.cls] = (cl[r.cls] || 0) + 1; });
console.log('classes', JSON.stringify(cl));
ok(D.ld_handoff_rows.length === D.ld_handoffs.length, 'one hand-off row per lead');
ok(D.ld_handoff_rows.every((r) => !('Id' in r) && !('id' in r)), 'no Ids on hand-off rows');
// trust
for (const t of D.ld_trust) console.log('trust', t.id, t.severity, typeof t.value === 'number' ? +t.value.toFixed(3) : t.value);
// checks
const LC = D.checks_ld.concat(D.checks_ld_rt, D.checks_ld_cap);
const cs = {}; LC.forEach((c) => { cs[c.severity] = (cs[c.severity] || 0) + 1; });
console.log('lead checks', LC.length, JSON.stringify(cs), LC.map((c) => c.id.replace(/:.*/, ':')).sort().join(','));
ok(new Set(LC.map((c) => c.id)).size === LC.length, 'check ids unique');
ok(LC.every((c) => c.area === 'Leads' && c.screen === 'leads' && ['speed', 'ready', 'routing'].includes(c.view) && c.what && c.title), 'check shape');
ok(D.checks_ld.filter((c) => c.person).every((c) => /^005/.test(c.userId || '')), 'seller checks carry the owner Id');
const qc = LC.find((c) => c.id.startsWith('ldq:'));
ok(qc && /before 19 May 2026/.test(qc.meta), 'queue check: oldest Ready since before 19 May 2026', qc && qc.meta);
// compare to the prototype answers (computed at 22:44 UTC)
const proto = JSON.parse(fs.readFileSync(path.join(S, 'leads-final', 'out.json'), 'utf8'));
const pa = proto.ld_kpi.find((r) => r.region === 'All');
const same = ['handoffs', 'readyNow', 'b21', 'noDate', 'stampGap', 'elsewhere', 'routingIssues', 'wrongOwner', 'created', 'demoCreated', 'demoAuto', 'demoHandoffs', 'demoSmb', 'routedAtReady', 'routedFast'];
for (const f of same) ok(pa[f] === A[f], 'proto ' + f + ' ' + pa[f] + ' vs ' + A[f]);
console.log('All demoWaiting', A.demoWaiting, '= sellers', A.demoOverdue, '+ others', A.otherDemoOverdue, '| badge', A.badge);
ok(A.badge === A.demoOverdue + A.otherDemoOverdue && A.badge === A.demoWaiting, 'badge = all demo requests waiting under All');
for (const k of ['SMB', 'BDR']) { const b = D.ld_badge.find((r) => r.region === k), kk = K(k); ok(b.demoWaiting === kk.demoOverdue, 'badge under ' + k + ' = the tile'); }
console.log('proto demoOverdue', pa.demoOverdue, 'now', A.demoOverdue, '(stamp-gap demo rule may lower it)');
console.log(fail ? fail + ' FAILED' : 'ALL OK');
process.exitCode = fail ? 1 : 0;
