// Leads screen drawings on the real calcs over the saved, tested answers. Prints counts and owner-level text only.
const { Node } = require('./fakedom.js');
// the saved answers are from 3 Nov 2026 22:44 UTC: pin the clock there (business-day ages depend on it)
{ const RealDate = Date; const off = Date.parse(process.env.NOW || '2026-11-03T22:44:00Z') - RealDate.now(); global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [RealDate.now() + off])); } static now() { return RealDate.now() + off; } }; }
const fs = require('fs'), path = require('path');
const S = path.join(__dirname, '..');
const calcs = {}, draws = {};
let params = { region: 'All', mgr: '', person: '', checkArea: 'All', ldReady: '', ldProb: '' };
const DATA = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; }, onData: () => {}, colors: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'], setLink: () => {}, data: (id) => (id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: (f) => (v) => (f === '.1f' ? (+v).toFixed(1) : f === '.0%' ? Math.round(v * 100) + '%' : f === ',' ? Math.round(v).toLocaleString('en') : String(v)), max: (a, f) => Math.max(...a.map(f)) };
const sent = [];
global.claude = { use: async (n) => (n === 'room' ? { canSendToClaudeSession: async () => 'available', sendToClaudeSession: (d) => { sent.push(d); return Promise.resolve({}); } } : null) };
const handlers = []; document.addEventListener = (ev, fn) => { if (ev === 'click') handlers.push(fn); };
let copied = null; Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: (t) => { copied = t; return Promise.resolve(); } } }, configurable: true, writable: true });
require('/home/user/revopsemeaos/dashboard/os-core.js'); require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js'); require('/home/user/revopsemeaos/dashboard/os-draw.js');
let fails = 0; const ok = (c, l, x) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const rows = (f) => JSON.parse(fs.readFileSync(path.join(S, 'leads-final', 'data', f), 'utf8')).records.map(({ attributes, ...r }) => r);
Object.assign(DATA, { ld_ready: rows('ld_ready.json'), ld_handoffs: rows('ld_handoffs.json'), ld_inflow: rows('ld_inflow.json'), ld_open: rows('ld_open.json'), roster: JSON.parse(fs.readFileSync(path.join(S, 'leads-design', 'roster_test.json'), 'utf8')) });
for (const id of ['ld_handoff_rows', 'ld_backlog', 'ld_backlog_open', 'ld_reps', 'ld_problems', 'ld_sources', 'ld_kpi', 'ld_badge', 'ld_kpi_rt', 'ld_kpi_in', 'ld_trust', 'ld_trust_cap', 'checks_ld', 'checks_ld_rt', 'checks_ld_cap']) DATA[id] = calcs[id].fn(...calcs[id].inputs.map((i) => DATA[i]));
DATA.checks = []; DATA.checks_hb = []; DATA.checks_lv = [];
const trs = (el) => { const out = []; const walk = (n) => { for (const c of n.children) { if (c.tagName === 'TR' || c.tagName === 'LI') out.push(c); else walk(c); } }; walk(el); return out; };
const tbl = (name) => { const el = new Node('tbody'); el.dataset.draw = name; draws[name](el); return trs(el); };
const cells = (tr) => tr.children.map((td) => td.textContent);
const asks = (el) => { const out = []; const walk = (n) => { if (n.dataset && n.dataset.ask) out.push(JSON.parse(n.dataset.ask)); n.children.forEach(walk); }; walk(el); return out; };
const tile = (field, fmt, all, src) => { const el = new Node('b'); el.dataset.draw = 'kpi-ld'; el.dataset.source = src || 'ld_kpi'; el.dataset.field = field; if (fmt) el.dataset.fmt = fmt; if (all) el.attrs['data-all'] = ''; draws['kpi-ld'](el); return [el.textContent, el.dataset.where || null]; };
setTimeout(() => {
  // ----- tiles -----
  ok(tile('hRate', 'pct')[0] === '39%', 'All demo rate 39%', tile('hRate', 'pct'));
  ok(tile('hMedianHours', 'hours')[0] === '11.7 h', 'All median 11.7 h', tile('hMedianHours', 'hours'));
  ok(tile('readyNow')[0] === '1,034', 'All Ready now', tile('readyNow'));
  ok(tile('routeMedianMin', 'min', true)[0] === '1.7 min', 'routing median 1.7 min', tile('routeMedianMin', 'min', true));
  params.region = 'SMB';
  ok(tile('hRate', 'pct')[0] === '—', 'SMB demo rate is blank (not scored)', tile('hRate', 'pct'));
  ok(tile('demoOverdue')[0] === '16', 'SMB demo waiting 16', tile('demoOverdue'));
  const qa = tile('queueReady', null, true);
  ok(qa[0] === '19' && qa[1] === 'region=All', 'All-only tile keeps the All row under a team', qa);
  ok(tile('queueReady')[0] === '0', 'scoped queue tile without data-all shows 0', tile('queueReady'));
  // ----- team table -----
  params.region = 'All';
  let t = tbl('ld-team-table');
  ok(t.length === 13, 'team table: All + 12 teams', t.length);
  ok(t[0].className === 'os-total' && /All EMEA/.test(cells(t[0])[0]), 'All row first and bold', [t[0].className, cells(t[0])[0]]);
  ok(cells(t[0])[2] === '15 of 38', 'All demo within 1 day "15 of 38"', cells(t[0])[2]);
  const mgrRow = DATA.ld_kpi.find((r) => r.region.startsWith('M|') && r.handoffs > 0);
  params.mgr = mgrRow.region.slice(2);
  t = tbl('ld-team-table');
  ok(t.length === 14 && t[0].className === 'os-total' && /'s team/.test(cells(t[0])[0]), 'manager scope pins the M| row on top', [t.length, cells(t[0])[0]]);
  params.mgr = '';
  // ----- rep table -----
  const repAll = tbl('ld-rep-table').length;
  params.region = 'BDR'; const repBdr = tbl('ld-rep-table');
  ok(repAll > repBdr.length && repBdr.length > 0, 'rep table scopes to the team', [repAll, repBdr.length]);
  ok(repBdr.every((tr) => cells(tr)[1] === 'BDR'), 'BDR rows only');
  params.region = 'All';
  // ----- backlog table -----
  const bAll = tbl('ld-backlog-table');
  ok(bAll.length === 50, 'backlog: 50 owners under All', bAll.length);
  ok(bAll.some((tr) => cells(tr)[1] === 'Queue') && bAll.some((tr) => /Outside EMEA sales|Strategic/.test(cells(tr)[1])), 'queue and outside owners under All');
  params.region = 'BDR'; const bBdr = tbl('ld-backlog-table');
  ok(bBdr.length > 0 && bBdr.every((tr) => cells(tr)[2] === 'BDR'), 'backlog under BDR: BDR rows only, no queue', bBdr.length);
  params.region = 'All';
  for (const [f, want] of [['demo', (r) => r.demoOverdue > 0], ['stale', (r) => r.stale > 0], ['region', (r) => r.elsewhere > 0], ['notseller', (r) => r.kind === 'Queue' || r.kind === 'Outside EMEA sales']]) {
    params.ldReady = f; const n = tbl('ld-backlog-table').length; ok(n === DATA.ld_backlog.filter(want).length, 'backlog chip ' + f, n);
  }
  params.ldReady = '';
  // asks on backlog rows: one per row with a to-do, all JSON, counts only
  const bEl = new Node('tbody'); draws['ld-backlog-table'](bEl);
  const bAsks = asks(bEl);
  ok(bAsks.length === DATA.ld_backlog.filter((r) => r.todo).length, 'one ask per backlog row with a to-do', [bAsks.length, DATA.ld_backlog.filter((r) => r.todo).length]);
  ok(bAsks.every((a) => a.ask.length < 2600 && a.kind === 'leads' && !/@/.test(a.ask)), 'backlog asks short, kind leads, no emails');
  ok(bAsks.filter((a) => /Nudge/.test(a.label)).every((a) => /wait for my OK before sending/.test(a.ask)), 'nudge waits for OK before sending');
  ok(bAsks.filter((a) => /Clean up/.test(a.label)).every((a) => /dry run/.test(a.ask)), 'clean-up is a dry run first');
  // ----- problems table -----
  const pAll = tbl('ld-prob-table');
  ok(pAll.length === 58, 'problems: 58 rows under All', pAll.length);
  params.region = 'BDR'; const pB = tbl('ld-prob-table');
  ok(pB.every((tr) => cells(tr)[4] === 'BDR'), 'problems under BDR: BDR rows only', pB.length);
  params.region = 'All';
  for (const [f, want] of [['routing', (r) => r.routing], ['wrong', (r) => r.kind === 'Owner inactive' || r.kind === 'Owner outside EMEA sales'], ['review', (r) => r.kind === 'Strategic or partnerships owner']]) {
    params.ldProb = f; const n = tbl('ld-prob-table').length; ok(n === DATA.ld_problems.filter(want).length, 'problem chip ' + f, n);
  }
  params.ldProb = '';
  const pEl = new Node('tbody'); draws['ld-prob-table'](pEl);
  const pAsks = asks(pEl);
  ok(pAsks.length === DATA.ld_problems.length, 'one ask per problem row', [pAsks.length, DATA.ld_problems.length]);
  ok(pAsks.every((a) => a.ask.length < 2600 && !/@/.test(a.ask)), 'problem asks short, no emails');
  // ----- sources -----
  params.region = 'France';
  ok(tbl('ld-src-table').length === 23, 'sources stay all EMEA under a team', tbl('ld-src-table').length);
  params.region = 'All';
  // ----- trust list -----
  const tl = new Node('ul'); draws['ld-trust-list'](tl);
  ok(trs(tl).length === 7, 'trust list: 6 measures plus the row cap', trs(tl).length);
  // ----- checks -----
  const items = (name) => { const el = new Node('ul'); el.dataset.draw = name; draws[name](el); return trs(el); };
  const home = items('home-checks');
  ok(home.filter((li) => /Leads/.test(li.textContent)).length <= 2, 'Home shows at most 2 lead checks', home.length);
  params.checkArea = 'Leads';
  const list = items('check-list');
  ok(list.length === DATA.checks_ld.length + DATA.checks_ld_rt.length + DATA.checks_ld_cap.length, 'Data checks › Leads lists every lead check under All', list.length);
  const go = []; const walk = (n) => { if (n.dataset && n.dataset.nav) go.push([n.dataset.nav, n.dataset.navView]); n.children.forEach(walk); }; list.forEach(walk);
  ok(go.length === list.length && go.every(([s, v]) => s === 'leads' && ['speed', 'ready', 'routing'].includes(v)), 'lead checks go to a Leads view', go.slice(0, 3));
  params.checkArea = 'All';
  params.region = 'SMB';
  const smbChecks = DATA.checks_ld.concat(DATA.checks_ld_rt).filter((c) => c.region === 'SMB').length;
  params.checkArea = 'Leads'; ok(items('check-list').length === smbChecks, 'SMB scope: only SMB seller checks', [items('check-list').length, smbChecks]);
  params.checkArea = 'All'; params.region = 'All';
  // ----- copy table text -----
  const txt = OS.tableText('ld-team-table');
  ok(txt.split('\n').length === 14 && txt.split('\n')[0].split('\t').length === 11, 'team table copies 13 rows x 11 columns', txt.split('\n').length);
  // ----- weekly summary -----
  const press = () => { copied = null; const btn = new Node('button'); btn.dataset.copySummary = ''; btn.matches = (sel) => sel === '[data-copy-summary]'; btn.closest = () => btn; const ev = { target: { closest: () => btn }, preventDefault() {} }; for (const h of handlers) h(ev); return copied; };
  const sum = press() || '';
  const line = sum.split('\n').find((l) => /Leads:/.test(l));
  console.log('  summary:', line);
  ok(line && /39% of demo requests worked within 1 business day \(15 of 38/.test(line) && /34 demo requests waiting/.test(line) && /1,034 in Ready, 555 of them over 20 business days or since before 19 May/.test(line), 'weekly summary Leads line');
  params.region = 'SMB';
  const l2 = (press() || '').split('\n').find((l) => /Leads:/.test(l));
  console.log('  summary SMB:', l2);
  ok(l2 && /speed not timed for SMB-owned leads/.test(l2), 'SMB summary says speed is not timed');
  params.region = 'All';
  // ----- sample payload sizes -----
  const all = [...bAsks, ...pAsks];
  const sEl = new Node('tbody'); draws['ld-src-table'](sEl); const rEl = new Node('tbody'); draws['ld-rep-table'](rEl); const tEl = new Node('tbody'); draws['ld-team-table'](tEl);
  all.push(...asks(sEl), ...asks(rEl), ...asks(tEl));
  console.log('  asks', all.length, 'max payload', Math.max(...all.map((a) => JSON.stringify(a).length)), 'bytes');
  ok(all.every((a) => !/@legora|Id = 00Q|00Q[A-Za-z0-9]{12}/.test(a.ask)), 'no lead Ids or emails in any ask');
  // queue and outside-EMEA owners: the EMEA filter and the count to match; every lead ask: the counts-only rule
  const scoped = [...bAsks, ...pAsks].filter((a) => /Marketing Queue|outside EMEA sales|Strategic|Review leads|Check owner|Route:|MQLs in|Worked leads/.test(a.label + ' ' + a.ask));
  const notSellerAsks = [...bAsks, ...pAsks].filter((a) => /in Marketing Queue|outside EMEA sales\)|Strategic and partnership owners/.test(a.ask));
  ok(notSellerAsks.length > 0 && notSellerAsks.every((a) => a.ask.includes("(Region__c = 'EMEA' OR Routing_Region__c = 'EMEA')") && /The dashboard counts [0-9,]+; if your count differs/.test(a.ask)), 'queue and outside-EMEA asks carry the EMEA filter and the count', notSellerAsks.filter((a) => !a.ask.includes('Region__c')).map((a) => a.label));
  const sellerAsks = bAsks.filter((a) => /^(Nudge|Clean up Ready|Check region)/.test(a.label));
  ok(sellerAsks.every((a) => !a.ask.includes('Region__c')), 'EMEA seller asks use the owner only (their leads count whatever the region)');
  ok([...bAsks, ...pAsks].every((a) => /no lead names, emails or companies in chat|no prospect details in chat|source and age only/.test(a.ask)), 'every lead ask keeps prospect details out of chat', [...bAsks, ...pAsks].filter((a) => !/no lead names|no prospect details|source and age only/.test(a.ask)).map((a) => a.label));
  const q = pAsks.find((a) => /^Route: Marketing Queue/.test(a.label));
  if (q) console.log('  sample queue ask:', q.ask.slice(0, 420));
  // routing and inflow tiles read their own calcs; the badge source
  ok(tile('routingIssues', null, false, 'ld_kpi_rt')[0] === '64', 'stuck in routing from ld_kpi_rt', tile('routingIssues', null, false, 'ld_kpi_rt'));
  ok(tile('created', null, true, 'ld_kpi_in')[0] === '3,847', 'created from ld_kpi_in', tile('created', null, true, 'ld_kpi_in'));
  ok(tile('demoWaiting', null, false, 'ld_badge')[0] === '34', 'All demo requests waiting 34 (25 sellers + 9 others)', tile('demoWaiting', null, false, 'ld_badge'));
  // backlog: oldest prints 'before 19 May 2026' where no-date leads exist; other open joins when loaded
  const bl2 = new Node('tbody'); draws['ld-backlog-table'](bl2);
  const qrow = trs(bl2).find((tr) => cells(tr)[1] === 'Queue');
  ok(qrow && cells(qrow)[13] === 'before 19 May 2026', 'queue row: oldest Ready since before 19 May 2026', qrow && cells(qrow)[13]);
  ok(qrow && cells(qrow)[14] !== '—', 'other open leads shown when ld_backlog_open loads');
  // one failing query no longer blanks Speed and Ready now: drop ld_open and ld_inflow
  const keep = {}; for (const id of ['ld_open', 'ld_inflow', 'ld_problems', 'ld_sources', 'ld_kpi_rt', 'ld_kpi_in', 'ld_backlog_open', 'ld_trust_cap', 'checks_ld_rt', 'checks_ld_cap']) { keep[id] = DATA[id]; delete DATA[id]; }
  ok(tile('hRate', 'pct')[0] === '39%', 'with ld_open and ld_inflow down, Speed still shows', tile('hRate', 'pct'));
  ok(tile('readyNow')[0] === '1,034', 'with ld_open and ld_inflow down, Ready now still shows', tile('readyNow'));
  const bl3 = new Node('tbody'); draws['ld-backlog-table'](bl3);
  ok(trs(bl3).length === 50 && cells(trs(bl3)[0])[14] === '—', 'backlog still lists 50 owners, other open shows —', [trs(bl3).length, cells(trs(bl3)[0])[14]]);
  Object.assign(DATA, keep);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exitCode = fails ? 1 : 0;
}, 20);
