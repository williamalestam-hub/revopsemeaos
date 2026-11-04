// Drift fixes (4 Nov 2026): forecast commit / best case from the rep forecast category (the rep commit and best-case
// ARR fields stopped being maintained), and LATAM leads not counted as "routed to another region". Synthetic rows only.
let NOW = Date.parse('2026-11-04T10:00:00Z');
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const calcs = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, draw: () => {}, params: () => ({}), setParams: () => {}, onData: () => {}, colors: ['#111'], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: () => (v) => String(v), max: (a, f) => Math.max(...a.map(f)) };
const { Node } = require('./fakedom.js');
require('/home/user/revopsemeaos/dashboard/os-core.js'); require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js');
let fails = 0; const ok = (c, l, x) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : JSON.stringify(x)); };
const row = (forecast, arr, extra) => ({ role: 'AE-EMEA-DACH', manager: 'M1', recordType: 'New Business', stage: '3 - Validation', forecast, fy: 2026, fq: 4, opps: 1, arrUsd: arr, ...(extra || {}) });
const pipe = [row('Commit', 100), row('Best Case', 50), row('Pipeline', 30), row(null, 20), row('Commit', 7, { fy: 2027, fq: 1 }), row('Commit', 1000, { recordType: 'Renewal' }),
  // a row carrying the retired amount fields must not count them
  row('Pipeline', 10, { commitUsd: 999, bestCaseUsd: 999 })];
const pt = calcs.pipe_team.fn(pipe, [], []);
const all = pt.find((r) => r.key === 'All|All');
ok(all.thisCommit === 100, 'commit = ARR of Commit deals this quarter', all.thisCommit);
ok(all.thisBest === 150, 'best case = Commit + Best Case', all.thisBest);
ok(all.thisPipe === 210, 'pipeline counts every category, blank included', all.thisPipe);
ok(all.nextPipe === 7, 'next quarter separate');
const fc = calcs.forecast.fn(pt).find((r) => r.key === 'All|All');
ok(fc.commit === 100 && fc.bestCase === 150 && fc.upside === 50 && fc.wonBest === 150, 'forecast roll-up follows', fc);
ok(!calcs.pipe_team.description.includes('best-case ARR, never less'), 'description no longer describes the retired fields');
// LATAM leads: Rest of World or North America with sub-region LATAM are EMEA's, other regions still count as elsewhere
const ld = calcs.ld_backlog;
if (ld) {
  const ins = ld.inputs;
  const ready = [
    { ownerId: '005A', owner: 'Rep A', ownerType: 'User', ownerRole: 'BDR-EMEA', ownerActive: true, routingRegion: 'Rest of World', routingSub: 'LATAM', src: 'Outbound', detail: null, readyDay: '2026-10-20', leads: 3, firstCreated: '2026-10-01T00:00:00.000+0000' },
    { ownerId: '005A', owner: 'Rep A', ownerType: 'User', ownerRole: 'BDR-EMEA', ownerActive: true, routingRegion: 'North America', routingSub: 'LATAM', src: 'Outbound', detail: null, readyDay: '2026-10-20', leads: 2, firstCreated: '2026-10-01T00:00:00.000+0000' },
    { ownerId: '005A', owner: 'Rep A', ownerType: 'User', ownerRole: 'BDR-EMEA', ownerActive: true, routingRegion: 'UK&I', routingSub: 'UK&I', src: 'Outbound', detail: null, readyDay: '2026-10-20', leads: 4, firstCreated: '2026-10-01T00:00:00.000+0000' },
    { ownerId: '005A', owner: 'Rep A', ownerType: 'User', ownerRole: 'BDR-EMEA', ownerActive: true, routingRegion: 'EMEA', routingSub: 'DACH', src: 'Outbound', detail: null, readyDay: '2026-10-20', leads: 5, firstCreated: '2026-10-01T00:00:00.000+0000' },
  ];
  const DATA = { ld_ready: ready, roster: [{ name: 'Rep A', role: 'BDR-EMEA', manager: 'M1', isActive: true, userId: '005A' }] };
  try {
    const out = ld.fn(...ins.map((i) => DATA[i] || []));
    const rep = out.find((r) => r.owner === 'Rep A' || r.name === 'Rep A') || out[0] || {};
    ok(rep.elsewhere === 4, 'only the UK&I leads count as routed to another region (LATAM is EMEA)', { elsewhere: rep.elsewhere, regions: rep.regions, inputs: ins });
  } catch (e) { ok(false, 'ld_backlog ran', String(e).slice(0, 200)); }
} else ok(false, 'ld_backlog calc exists');
// Salesforce values the pipeline logic depends on (checks_cfg)
const cfg = calcs.checks_cfg.fn([row('Commit', 100), row('Best Case', 50), row(null, 300000, { manager: 'M2', role: 'AE-EMEA-FR' }), row(null, 5, { fy: 2027, fq: 1 }),
  row('Upside', 40), row('Pipeline', 60, { stage: 'Validation' }), row('Pipeline', 9, { recordType: 'Expansion' }), row('Commit', 999, { recordType: 'Renewal', forecast: 'Renewal call' })]);
const ids = cfg.map((c) => c.id).sort();
ok(JSON.stringify(ids) === JSON.stringify(['cfg:fc:Upside', 'cfg:nofc:M2|France', 'cfg:rt:Expansion', 'cfg:stage:Validation'].sort()), 'checks: unknown category, stage without number, unknown record type, unforecast deals this quarter only; renewals ignored', ids);
const nofc = cfg.find((c) => c.id.startsWith('cfg:nofc:'));
ok(nofc.severity === 'medium' && nofc.manager === 'M2' && nofc.region === 'France' && /\$300K ARR/.test(nofc.what) && nofc.view === 'forecast', 'unforecast deals: per manager, medium at $250K+', nofc);
ok(cfg.every((c) => c.how && c.area === 'Pipeline' && c.what && !/undefined|NaN|null/.test(c.what + c.meta + c.how)), 'every check has a request and clean text');
ok(calcs.checks_cfg.fn([row('Commit', 1), row('Best Case', 1), row('Pipeline', 1), row(null, 1, { recordType: 'Renewal' })]).length === 0, 'clean pipeline: no checks');
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
