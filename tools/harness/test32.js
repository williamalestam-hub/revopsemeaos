// Conversion review fixes (4 Nov 2026), on the real calcs and drawings: (1) a manager compared within one motion is
// shown on the deals compared, so the view, the weekly line, the Monday summary and the 1:1 agenda agree; (2) the
// closing team follows the main line's rule (only an EMEA sales role at close moves a deal), so after the merge
// Conversion agrees with Bookings; (3) a RevOps colleague's agenda neither waits for, loads nor counts the conversion
// checks; (4) no "None flagged" when no step could be compared; and the lower-severity ones: Created by after a role
// change, a leader whose motion has under 20 deals, SMB listed once, the marks, the store, the trust rows' window.
// Synthetic rows and the saved live answers; prints labels and counts only, never names.
const { Node } = require('./fakedom.js');
const NOW = Date.parse('2026-11-04T10:00:00Z');
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const fs = require('fs'), vm = require('vm'), { execFileSync } = require('child_process');
const REPO = '/home/user/revopsemeaos/';
const D = REPO + 'dashboard/';
const LIVE = '/tmp/claude-0/-home-user-revopsemeaos/c3936b63-31db-5219-aa72-dbd9a885d4cb/scratchpad/wip-conv/live/conv-wide/';
const calcs = {}, draws = {}, loaders = {}, onData = [];
let params = { region: 'All', mgr: '', person: '', checkArea: 'All', ooWho: '', cvSeg: 'all', cvRt: 'nb', cvClean: false, grWindow: 30 };
const DATA = {}, STATE = {}, READS = new Set();
global.dash = { loader: (id, o) => { loaders[id] = o; }, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; onData.forEach((f) => f()); }, onData: (fn) => { onData.push(fn); }, colors: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'], setLink: () => {},
  data: (id) => { READS.add(id); return STATE[id] ? { status: STATE[id], data: [] } : id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }; } };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: (f) => (v) => (f === '.1f' ? (+v).toFixed(1) : f === '.0%' ? Math.round(v * 100) + '%' : f === ',' ? Math.round(v).toLocaleString('en') : String(v)), max: (a, f) => (a.length ? Math.max(...a.map(f)) : undefined) };
global.claude = { use: async (n) => (n === 'room' ? { canSendToClaudeSession: async () => 'available', sendToClaudeSession: () => Promise.resolve({}) } : null) };
global.location.hash = '#created-conversion';
const REG = {};
document.querySelector = (sel) => (/data-view-panel/.test(sel) ? new Node('div') : null);
document.querySelectorAll = (sel) => REG[sel] || [];
const handlers = []; document.addEventListener = (ev, fn) => { if (ev === 'click') handlers.push(fn); };
let copied = null; Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: (t) => { copied = t; return Promise.resolve(); } } }, configurable: true, writable: true });
for (const f of ['os-core.js', 'os-calcs.js', 'os-calcs-leads.js', 'os-calcs-act.js', 'os-calcs-conv.js', 'os-draw.js']) require(D + f);
let fails = 0, passes = 0; const ok = (c, l, x) => { if (!c) fails++; else passes++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const near = (a, b, e = 0.001) => a != null && Math.abs(a - b) < e;
const CONV = ['conv_mgr', 'conv_cohorts', 'conv_steps', 'conv_close', 'conv_reasons', 'conv_closeout', 'conv_sources', 'conv_time', 'oo_points_conv', 'conv_trust_cohort', 'conv_trust_close', 'conv_trust_timing', 'checks_conv', 'checks_conv_lost', 'checks_conv_days'];
const run = (id) => { DATA[id] = calcs[id].fn(...calcs[id].inputs.map((i) => DATA[i] || [])); return DATA[id]; };
const runAll = () => { for (const id of CONV) run(id); };
const walk = (n, f) => { f(n); for (const c of n.children || []) walk(c, f); };
const nodes = (el, pick) => { const out = []; walk(el, (n) => { if (pick(n)) out.push(n); }); return out; };
const draw = (name, tag = 'div', ds = {}) => { const el = new Node(tag); el.dataset.draw = name; Object.assign(el.dataset, ds); draws[name](el); return el; };
const rowsOf = (name) => nodes(draw(name, 'tbody'), (n) => n.tagName === 'TR');
const items = (name) => nodes(draw(name, 'ul'), (n) => n.tagName === 'LI');
const cells = (tr) => tr.children.map((td) => td.textContent);
const asks = (el) => nodes(el, (n) => n.dataset && n.dataset.ask).map((n) => JSON.parse(n.dataset.ask));
const tile = (ds) => { const el = new Node('b'); Object.assign(el.dataset, ds); draws[ds.draw](el); return el; };
const fire = () => onData.forEach((f) => f());
const press = (attr) => { copied = null; const btn = new Node('button'); btn.dataset[attr] = ''; btn.matches = (sel) => sel === '[data-' + attr.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ']'; btn.closest = () => btn; const ev = { target: { closest: () => btn }, preventDefault() {} }; for (const h of handlers) h(ev); return copied || ''; };
const reset = () => { for (const k of Object.keys(DATA)) delete DATA[k]; for (const k of Object.keys(STATE)) delete STATE[k]; params = { ...params, region: 'All', mgr: '', cvSeg: 'all', cvRt: 'nb', cvClean: false, ooWho: '' }; };
const live = (id) => { const j = JSON.parse(fs.readFileSync(LIVE + id + '.json', 'utf8')); return (j.records || j).map(({ attributes, ...r }) => r); };
const TEAM_ROLES = ['AE-EMEA-FR', 'AE-EMEA-DACH', 'AE-EMEA-SOUTH', 'AE-EMEA-CEE', 'AE-EMEA-BENELUX', 'AE-EMEA-MEA', 'AE-EMEA-IBERIA-LATAM', 'AE-EMEA-NORDICS', 'SMB-EMEA', 'EM-EMEA', 'EM-EMEA-LATAM', 'BDR-EMEA', 'DIR-SALES-EMEA', 'MGR-SALES-EMEA', 'VP-SALES-EMEA', 'DIR-EM-EMEA', 'DIR-BDR-EMEA'];
const S0 = (n, stage) => { const s = {}; for (let k = 0; k < 7; k++) s['s' + k] = k <= stage ? n : 0; return s; };
// a closed cohort row: created fy/fq, closed the quarter after, by its role today unless x says otherwise
const C = (role, manager, won, n, stage, x) => ({ rt: 'New Business', fy: 2026, fq: 2, role, manager, closedRole: role, closedManager: manager, won, cfy: 2026, cfq: 3, n, arr: n * 1000, ...S0(n, won ? 6 : stage), cwStamp: 0, clStamp: 0, ...(x || {}) });
const O = (role, manager, fy, fq, n, stage) => ({ rt: 'New Business', fy, fq, role, manager, n, arr: n * 1000, ...S0(n, stage), cwStamp: 0, clStamp: 0 });
const summarySources = () => {
  Object.assign(DATA, { pipe_team: [], pipe_cover: [], moves_kpi: [], cr_kpi: [], risk_kpi: [], rr_kpi: [], leavers_core: [], leavers_leads: [], leavers_pools: [], ld_kpi: [], ld_kpi_rt: [], act_kpi: [], orphan_kpi: [], engagement_kpi: [], gr_actions: [], gr_kpi: [], checks: [] });
  for (const id of OS.CHECKS) if (!DATA[id]) DATA[id] = [];
};

(async () => {
  await new Promise((r) => setTimeout(r, 0));

  // ===================== 1) a manager compared within one motion is shown on the deals compared =====================
  // Mgr A: 170 DACH deals (34 won within 2 quarters, 136 lost at stage 1) and 30 deals of a sales manager reporting to
  // them (Leadership: never compared), all won; peers: 400 France deals under Mgr B, 120 won. Before the fix the view
  // showed 64 of 200 (32%) coloured red against 30%, and a stage 1 → 2 "leak" at 32% vs 30%.
  reset();
  DATA.cv_open = [];
  DATA.cv_closed = [C('AE-EMEA-DACH', 'Mgr A', true, 34), C('AE-EMEA-DACH', 'Mgr A', false, 136, 1), C('MGR-SALES-EMEA', 'Mgr A', true, 30), C('AE-EMEA-FR', 'Mgr B', true, 120), C('AE-EMEA-FR', 'Mgr B', false, 280, 1)];
  DATA.cv_window = []; DATA.cv_lost_month = []; DATA.cv_source = []; DATA.cv_days = []; DATA.cr_monthly = [];
  DATA.roster = [['A1', 'AE-EMEA-DACH', 'Mgr A'], ['A2', 'AE-EMEA-DACH', 'Mgr A'], ['A3', 'MGR-SALES-EMEA', 'Mgr A'], ['B1', 'AE-EMEA-FR', 'Mgr B']].map(([name, role, manager]) => ({ name, role, manager, isActive: true }));
  DATA.team_tree = [{ name: 'Mgr A', email: 'a@x.test', manager: null, isLeader: true, isTop: false }, { name: 'Mgr B', email: 'b@x.test', manager: null, isLeader: true, isTop: false }];
  runAll();
  const Q2 = 2026 * 4 + 1;
  const sa = DATA.conv_cohorts.find((r) => r.key === 'M|Mgr A|New Business'), ca = DATA.conv_cohorts.find((r) => r.key === 'M|Mgr A|New Business|' + Q2);
  ok(near(sa.y2q, 34 / 170) && sa.y2qWon === 34 && sa.y2qN === 170 && sa.y2qAllN === 200 && sa.cmpWhat === 'AE-team deals' && near(sa.peerY2q, 0.3) && sa.y2qVerdict === 'below',
    'D1 cohorts: the manager\'s share is of the deals compared (34 of 170, 20%) against 30%, below; all 200 counted beside it', [sa.y2qWon, sa.y2qN, sa.y2qAllN, sa.y2qVerdict]);
  ok(ca.n === 170 && ca.allN === 200 && ca.cmpWhat === 'AE-team deals' && ca.won === 34 && near(ca.y2q, 0.2), 'D1 cohorts: the cohort row is the deals compared, with all 200 beside', [ca.n, ca.allN, ca.won]);
  const sb = DATA.conv_cohorts.find((r) => r.key === 'M|Mgr B|New Business');
  ok(sb.cmpWhat === null && sb.y2qN === 400 && sb.y2qAllN === 400, 'D1 cohorts: a manager whose deals are all in one motion is not labelled');
  const ta = DATA.conv_steps.find((r) => r.key === 'M|Mgr A');
  ok(ta.created === 170 && ta.allCreated === 200 && ta.cmpWhat === 'AE-team deals' && near(ta.b1Rate, 0.2) && ta.b1Decided === 170 && near(ta.b1Exp, 0.3) && ta.b1Flag === 'leak' && near(ta.leakRate, 0.2) && ta.leakBehind === 17 && near(ta.y2q, 0.2) && ta.y2qFlag === 'below',
    'D1 steps: rate, decided, flag and deals behind all from the 170 deals compared (20% vs 30%, 17 behind)', [ta.created, ta.b1Rate, ta.b1Decided, ta.leakBehind]);
  ok(['b0', 'b1', 'b2', 'b3', 'b46'].every((b) => ta[b + 'Reached'] === ta[b + 'Moved'] + ta[b + 'Lost'] + ta[b + 'Still']) && ta.reached0 === 170, 'D1 steps: the funnel of the row is the same deals');
  // the agenda rule on the same people agrees, figure for figure
  const ooA = DATA.oo_points_conv.filter((r) => r.email === 'a@x.test');
  const nA = ooA.find((r) => r.section === 'numbers'), lA = ooA.find((r) => /^Deals leak at stage 1 → 2/.test(r.text));
  ok(nA && /20% of the team's AE-team deals \(170 of 200 created\) won within 2 quarters \(34 of 170; the rest of the AE teams 30%\)/.test(nA.text), 'D1 agenda: the numbers line on the same 170 deals', nA && nA.text);
  ok(lA && /: 20% of the team's AE-team deals that left the stage moved on, against 30% .* about 17 deals behind/.test(lA.text), 'D1 agenda: the same leak, rate and deals behind as the view', lA && lA.text);
  // the view at the manager's scope
  params.mgr = 'Mgr A';
  const yt = tile({ draw: 'kpi-conv', calc: 'cohorts', field: 'y2q', fmt: 'pct', source: 'conv_cohorts' });
  const ys = draw('kpi-conv-y2q', 'span').textContent;
  ok(yt.textContent === '20%' && yt.classList.contains('os-bad') && /AE-team deals only \(170 of the 200 created in Q2 2026\)/.test(yt.title), 'D1 tile: 20% in red, and its title says what was compared', [yt.textContent, yt.title.slice(-140)]);
  ok(ys === 'AE-team deals: 34 of 170 created in Q2 2026 (200 in all) · the rest of the AE teams 30%', 'D1 tile sub-line names the deals compared', ys);
  const lk = draw('kpi-conv-leak', 'b', { k: 'step' }).textContent, lks = draw('kpi-conv-leak', 'span', { k: 'sub' }).textContent;
  ok(lk === 'Stage 1 → 2' && lks === 'AE-team deals: 20% move on vs 30% for the rest of the AE teams, same created quarters · about 17 deals behind', 'D1 leak tile on the deals compared', [lk, lks]);
  const stepM = rowsOf('conv-step-table');
  ok(cells(stepM[0])[0].startsWith('Mgr A') && /AE-team deals only/.test(cells(stepM[0])[0]) && cells(stepM[0])[1] === '170 of 200' && cells(stepM[0])[5] === '20%' && stepM[0].children[5].className.includes('os-bad'),
    'D1 step table: the manager row is the 170 compared, labelled, its 1 → 2 rate 20% in red', cells(stepM[0]));
  ok(OS.tableText('conv-step-table').split('\n')[1].split('\t').slice(0, 2).join('|') === 'Mgr A|170 of 200', 'D1 step table: Copy table keeps "170 of 200"');
  const coh = rowsOf('conv-cohort-table').find((tr) => tr.dataset.key === 'M|Mgr A|New Business|' + Q2);
  ok(coh && /AE-team deals only/.test(cells(coh)[0]) && cells(coh)[2] === '170 of 200' && /AE-team deals: 170 of the 200 created/.test(coh.children[2].title), 'D1 cohort table: the row says AE-team deals only, 170 of the 200', coh && cells(coh));
  const mon = asks(draw('conv-monday', 'span'))[0].ask;
  ok(/Won within 2 quarters: 20% of their AE-team deals created in Q2 2026 \(170 of the 200 created\)/.test(mon) && /Mgr A's team \(AE-team deals\) stage 1 → 2, 20% vs 30%, about 17 behind/.test(mon), 'D1 Monday summary: the share and the leak of the deals compared, named', mon.slice(0, 900));
  const dig = asks(draw('conv-step-table', 'tbody')).find((d) => /^Dig into Mgr A/.test(d.label));
  ok(dig && /Mgr A's direct reports, their AE-team deals \(170 of the 200 created; their deals in other motions are never compared\)/.test(dig.ask), 'D1 Dig into: says which deals were compared');
  summarySources();
  const wk = press('copySummary').split('\n').find((l) => /• Conversion/.test(l)) || '';
  ok(/20% of the team's AE-team deals created in Q2 2026 \(170 of the 200 created\) won within 2 quarters \(the rest of the AE teams 30%\)/.test(wk) && /leaks most at stage 1 → 2 \(AE-team deals: 20% vs 30%, about 17 deals behind\)/.test(wk), 'D1 weekly line: the same figures, named', wk);
  params.mgr = '';
  // the live answers: every compared manager's leak in the view is the one their agenda rule finds on the same deals
  reset();
  DATA.cv_open = live('cv_open'); DATA.cv_closed = live('cv_closed');
  run('conv_steps'); run('conv_cohorts');
  const mgrs = DATA.conv_steps.filter((r) => r.level === 'manager' && r.peerLabel);
  let agree = 0;
  for (const r of mgrs) {
    const pts = calcs.oo_points_conv.fn([{ name: r.key.slice(2), email: 'm@x.test', manager: null, isLeader: true, isTop: false }], DATA.cv_open, DATA.cv_closed);
    const t = pts.find((p) => /^Deals leak at/.test(p.text));
    if ((t ? t.text.match(/^Deals leak at (stage[^(]*?) \(/)[1].trim() : null) === (r.leakLabel ? r.leakLabel.replace(/^S/, 's') : null)) agree += 1;
  }
  // 11 on the noon answers: between the morning and noon runs about 320 closed deals moved to a new AE manager in
  // Salesforce (an owner-manager change, not the wider closed-deal scope; cv_open is the morning's), so this fixture has
  // 11 managers with peers where the morning's had 10. What matters is that every one of them agrees.
  ok(mgrs.length === 11 && agree === mgrs.length, 'D1 live: for all 11 managers with peers, the view\'s leak is their agenda\'s leak', [agree, mgrs.length]);
  const m67 = DATA.conv_steps.find((r) => r.level === 'manager' && r.allCreated === 67);
  ok(m67 && m67.created === 51 && m67.b0Still === 13 && m67.b0Settled === false && m67.b0Flag === '' && !m67.leakBand, 'D1 live: the manager with 51 AE-team deals of 67 is not flagged at stage 0 → 1 (13 of 51 still there)', m67 && [m67.created, m67.b0Still, m67.b0Flag]);
  // the wider closed-deal scope adds 2 of this manager's Q2 2026 deals (both won, one in an AE team): 101 deals became 103
  const m101 = DATA.conv_cohorts.find((r) => r.kind === 'scope' && r.level === 'manager' && r.rt === 'New Business' && r.y2qAllN === 103);
  ok(m101 && m101.y2qWon === 51 && m101.y2qN === 83 && m101.cmpWhat === 'AE-team deals', 'D1 live: the manager whose tile read 54 of 103 (52 of 101 before the wider closed-deal scope) now reads 51 of 83 AE-team deals, as their agenda', m101 && [m101.y2qWon, m101.y2qN]);
  ok(DATA.conv_steps.filter((r) => r.level === 'manager' && r.cmpWhat).length === 5 && DATA.conv_steps.some((r) => r.cmpWhat === 'SMB deals'), 'D1 live: 5 managers hold deals of other motions (one of them SMB)');

  // ===================== 2) the closing team: only an EMEA sales role at close moves a deal =====================
  // 10 losses stamped EM-AMER at close, owned today by an EMEA engagement manager; 5 wins stamped REVOPS at close owned
  // by France; 20 won and 20 lost closed by France. The main line's Bookings counts Engagement 0 won / 10 lost and France
  // 25 won / 20 lost; Conversion must too, with no 'Other' team, and the trust rows must say so.
  reset();
  const W = (role, closedRole, won, n, reason, stage) => ({ fy: 2026, fq: 3, role, closedRole, won, lastStage: won ? '6 - Opt-out' : stage || '2 - Scope agreement', reason: won ? null : reason || 'Timing', n, arr: n * 1000 });
  DATA.cv_window = [W('EM-EMEA', 'EM-AMER', false, 10), W('AE-EMEA-FR', 'REVOPS', true, 5), W('AE-EMEA-FR', 'AE-EMEA-FR', true, 20), W('AE-EMEA-FR', 'AE-EMEA-FR', false, 20)];
  DATA.cv_open = [];
  DATA.cv_closed = [C('EM-EMEA', 'Em Mgr', false, 10, 2, { closedRole: 'EM-AMER', closedManager: 'Amer Mgr' }), C('AE-EMEA-FR', 'Fr Mgr', true, 5, 6, { closedRole: 'REVOPS', closedManager: 'Ops Mgr' }), C('AE-EMEA-FR', 'Fr Mgr', true, 20), C('AE-EMEA-FR', 'Fr Mgr', false, 20, 1)];
  DATA.cv_source = DATA.cv_window.map((r) => ({ src: 'Inbound', bdrRole: null, bdrNow: null, creatorRole: r.role, role: r.role, closedRole: r.closedRole, closed: true, won: r.won, n: r.n, arr: r.arr, cycleDays: 0, cycleN: 0 }));
  const day = (o) => ({ role: 'AE-EMEA-FR', manager: 'Fr Mgr', closedRole: 'AE-EMEA-FR', closedManager: 'Fr Mgr', d0: 1, d1: 2, d2: 3, d3: 4, d4: 5, d5: 1, d6: 1, daysToWin: 40, cwAt: '2026-10-01', closeAt: '2026-10-01', ...o });
  DATA.cv_days = [day({ closedRole: 'REVOPS', closedManager: 'Ops Mgr' }), day({}), day({ role: 'SMB-EMEA', manager: 'Smb Mgr', closedRole: 'EM-AMER', closedManager: 'Amer Mgr', closeAt: '2026-08-01' })];
  DATA.cv_lost_month = []; DATA.roster = []; DATA.team_tree = []; DATA.cr_monthly = [];
  runAll();
  const cl = (k) => DATA.conv_close.find((r) => r.key === k) || {};
  ok(cl('Engagement').won4 === 0 && cl('Engagement').lost4 === 10 && cl('France').won4 === 25 && cl('France').lost4 === 20 && cl('All').closed4 === 55, 'D2 win rate: Engagement 0 won, 10 lost; France 25 won, 20 lost (as the main line\'s Bookings)', [cl('Engagement').lost4, cl('France').won4]);
  const scopesOf = (id) => [...new Set(DATA[id].map((r) => r.scope || r.key))];
  ok(['conv_close', 'conv_reasons', 'conv_closeout', 'conv_sources', 'conv_cohorts', 'conv_steps', 'conv_time'].every((id) => !scopesOf(id).some((s) => /^Other\b|\|Other\b|^Other\|/.test(String(s)))), 'D2: no calc makes an "Other" team');
  ok(cl('All').attrOutside === 15 && cl('All').attrMoved === 0 && cl('All').attrClosing === 40, 'D2: role at close outside EMEA counted apart (15), moved 0, closing team 40', [cl('All').attrOutside, cl('All').attrMoved]);
  const coh2 = (k) => (DATA.conv_cohorts.find((r) => r.key === k + '|New Business|' + Q2) || {}).n || 0;
  ok(coh2('Engagement') === 10 && coh2('M|Em Mgr') === 10 && !coh2('M|Amer Mgr') && coh2('France') === 45 && coh2('M|Fr Mgr') === 45 && !coh2('M|Ops Mgr'), 'D2 cohorts: today\'s team and manager, not the manager stamped with the other role');
  const t2 = DATA.conv_time.find((r) => r.key === 'France|win'), tSmb = DATA.conv_time.find((r) => r.key === 'SMB|win');
  ok(t2 && t2.n === 2 && DATA.conv_time.some((r) => r.key === 'M|Fr Mgr|win' && r.n === 2) && !DATA.conv_time.some((r) => r.key === 'M|Ops Mgr|win') && !tSmb,
    'D2 time in stage: the RevOps-stamped win counts for France and today\'s manager; an SMB deal stamped EM-AMER closed 95 days ago is SMB\'s and left out (30 days)', [t2 && t2.n]);
  const tc = DATA.conv_trust_cohort.find((t) => t.id === 'owner'), tcl = DATA.conv_trust_close.find((t) => t.id === 'owner');
  ok(/15 carry a role at close outside EMEA sales \(another region's, RevOps or the like\), which moves no deal/.test(tc.detail) && /so do 15 whose role at close is outside EMEA sales/.test(tcl.detail), 'D2 trust rows count the deals whose role at close is outside EMEA sales', [tc.detail.slice(0, 260), tcl.detail]);
  // against the main line's Bookings itself (4e570c2), on the same deals
  let main = null;
  try { main = execFileSync('git', ['-C', REPO, 'show', '4e570c2:dashboard/os-calcs.js'], { encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { main = null; }
  if (main) {
    const mc = {}; vm.runInNewContext(main, { dash: { calc: (id, o) => { mc[id] = o; }, loader: () => {} }, Date, Math, JSON, Map, Set, Object, Array, String, Number });
    const rep = DATA.cv_window.map((r) => ({ owner: 'o', role: r.role, manager: 'm', closedOwner: 'o', closedRole: r.closedRole, closedManager: 'm', rt: 'New Business', won: r.won, lostReason: r.reason, fy: 2026, fq: 4, opps: r.n, arrUsd: r.arr }));
    const bk = mc.bookings.fn(rep), by = {};
    for (const b of bk) { by[b.region] = by[b.region] || { won: 0, lost: 0 }; by[b.region].won += b.wonThis; by[b.region].lost += b.lostThis; }
    const conv = {}; for (const t of ['Engagement', 'France']) conv[t] = { won: cl(t).won4, lost: cl(t).lost4 };
    ok(JSON.stringify(by) === JSON.stringify({ Engagement: { won: 0, lost: 10 }, France: { won: 25, lost: 20 } }) && JSON.stringify(conv) === JSON.stringify(by), 'D2: the main line\'s Bookings (4e570c2) and Conversion split the same deals the same way', [by, conv]);
    const lr = mc.lost_reasons.fn(rep);
    ok(!lr.some((r) => r.scope === 'Other') && !DATA.conv_reasons.some((r) => r.scope === 'Other'), 'D2: neither the main line\'s lost reasons nor Conversion\'s has an "Other" scope');
  } else ok(false, 'D2: the main line commit 4e570c2 can be read for the comparison');
  // inside this branch's own scope (role at close in EMEA or blank) nothing changes: Conversion = this branch's Bookings
  const inScope = [W('AE-EMEA-DACH', null, true, 7), W('AE-EMEA-DACH', 'AE-EMEA-DACH', false, 9), W('MGR-SALES-EMEA', 'AE-EMEA-CEE', true, 11), W('SMB-EMEA', 'SMB-EMEA', false, 4)];
  const bk2 = calcs.bookings.fn(inScope.map((r) => ({ owner: 'o', role: r.role, manager: 'm', closedOwner: 'o', closedRole: r.closedRole, closedManager: 'm', rt: 'New Business', won: r.won, lostReason: r.reason, fy: 2026, fq: 4, opps: r.n, arrUsd: r.arr })));
  const c2 = calcs.conv_close.fn(inScope), sameTeams = ['DACH', 'CEE', 'SMB'].every((t) => { const b = bk2.filter((x) => x.region === t), c = c2.find((x) => x.key === t) || { won4: 0, lost4: 0 }; return b.reduce((a, x) => a + x.wonThis, 0) === c.won4 && b.reduce((a, x) => a + x.lostThis, 0) === c.lost4; });
  ok(sameTeams && !c2.some((r) => r.key === 'Leadership'), 'D2: deals inside this branch\'s scope split by team exactly as this branch\'s Bookings');
  // CV_NOT_SMB reads the same rule (SOQL: != keeps blanks, IN never matches blank)
  const ds = JSON.parse(fs.readFileSync(D + 'datasets.json', 'utf8'));
  const ROLES = TEAM_ROLES.map((r) => "'" + r + "'").join(',');
  ok(ds.cv_days.source.args.q.includes("(Closed_Owner_Role__c != 'SMB-EMEA' AND (Closed_Owner_Role__c IN (" + ROLES + ") OR Owner.UserRole.Name != 'SMB-EMEA'))"), 'D2: cv_days reads 90 days for deals whose closing team isn\'t SMB by the same rule');
  const notSmb = (closedRole, role) => (closedRole !== 'SMB-EMEA') && (TEAM_ROLES.includes(closedRole) || role !== 'SMB-EMEA');
  const T2 = { 'SMB-EMEA': 'SMB' }; for (const r of TEAM_ROLES) if (!T2[r]) T2[r] = 'x';
  const closingTeamIsSmb = (closedRole, role) => (T2[closedRole] ? closedRole : role) === 'SMB-EMEA';
  const combos = [null, 'SMB-EMEA', 'AE-EMEA-FR', 'EM-AMER', 'REVOPS'].flatMap((c) => ['SMB-EMEA', 'AE-EMEA-FR', 'Consulting Partnerships', null].map((r) => [c, r]));
  ok(combos.every(([c, r]) => notSmb(c, r) === !closingTeamIsSmb(c, r)), 'D2: the query\'s SMB test and the calcs\' closing team agree for every role at close and role today');

  // ===================== 3) a RevOps colleague's agenda leaves the conversion checks alone =====================
  reset();
  Object.assign(DATA, {
    pipe_team: [{ key: 'All|All', thisPipe: 5e6, thisCommit: 2e6, thisBest: 3e6, won: 1e6 }], pipe_cover: [], moves_kpi: [], cr_kpi: [{ thisWeekOpps: 12, lastWeekOpps: 9, thisQOpps: 140 }],
    risk_kpi: [{ region: 'All', stuck: 7, stuckArr: 9e5 }], rr_kpi: [{ region: 'All', missing: 3, weekOne: 1 }],
    checks: [{ id: 'c1', area: 'Pipeline', severity: 'high', title: 'A', what: 'x', region: 'France', manager: 'M1' }, { id: 'c2', area: 'Books', severity: 'low', title: 'B', what: 'y', region: 'DACH', manager: 'M2' }],
    leavers_core: [], leavers_leads: [], leavers_pools: [], ld_kpi: [], ld_kpi_rt: [], act_kpi: [], orphan_kpi: [{ accounts: 4, arr: 1e5, splitBooks: 2 }], engagement_kpi: [], gr_actions: [], gr_kpi: [{ forYou: 0 }],
    sf_me: [{ userId: '005ME', name: 'Will Ops', email: 'me@x.test', role: 'REVOPS', manager: 'Boss Person', managerEmail: 'boss@x.test' }],
    users_all: [{ name: 'Peer Ops', email: 'peer@x.test', role: 'REVOPS', manager: 'Big Boss' }],
    oo_upcoming: [], oo_followups: [], oo_points: [], oo_points_rr: [], oo_points_act: [], oo_points_conv: [], team_tree: [],
  });
  for (const id of ['checks_rr', 'checks_hb', 'checks_lv', 'checks_ld', 'checks_ld_rt', 'checks_ld_cap', 'checks_act', 'checks_cfg']) DATA[id] = [];
  const CK = ['checks_conv', 'checks_conv_lost', 'checks_conv_days'];
  const cb = new Node('button'); cb.dataset.copyAgenda = ''; REG['[data-copy-agenda], [data-ask-agenda]'] = [cb];
  global.location.hash = '#oneonone-upcoming';
  params.ooWho = 'peer@x.test';
  READS.clear(); fire(); draw('oo-ops', 'ul'); draw('oo-mail', 'span'); OS.oo.text();
  ok(CK.every((id) => !READS.has(id)), 'D3: the RevOps agenda (its drawings and its text) reads no conversion check, so loads none', CK.filter((id) => READS.has(id)));
  const line = () => (OS.oo.text().split('\n').find((l) => /Data checks/.test(l)) || '');
  const loading = line();
  DATA.checks_conv = [{ id: 'conv:old:x', area: 'Conversion', severity: 'medium', title: 'X', what: 'w', region: 'DACH', manager: null }]; DATA.checks_conv_lost = [{ id: 'conv:noreason:CEE', area: 'Conversion', severity: 'low', title: 'CEE', what: 'w', region: 'CEE', manager: null }]; DATA.checks_conv_days = [];
  const loaded = line();
  delete DATA.checks_conv_lost; STATE.checks_conv_lost = 'error';
  const failed = line();
  ok(loading === '- Data checks outside Conversion: 2 open, 1 urgent' && loaded === loading && failed === loading, 'D3: the agenda\'s Data checks line is the same while conversion checks load, once loaded and when one failed', [loading, loaded, failed]);
  delete STATE.checks_conv_lost; DATA.checks_conv_lost = [{ id: 'conv:noreason:CEE', area: 'Conversion', severity: 'low', title: 'CEE', what: 'w', region: 'CEE', manager: null }];
  global.location.hash = '#created-conversion'; params.ooWho = '';
  const home = press('copySummary').split('\n').find((l) => /Data checks/.test(l)) || '';
  ok(home === '• Data checks: 4 open, 1 urgent', 'D3: Home\'s weekly summary still counts the conversion checks', home);
  ok(JSON.stringify(OS.checkRows({ region: 'All' }).map((c) => c.id)) !== JSON.stringify(OS.checkRows({ region: 'All' }, OS.CHECKS.filter((id) => !/^checks_conv/.test(id))).map((c) => c.id)) && OS.checkRows({ region: 'All' }, ['checks']).length === 2, 'D3: checkRows reads the sources it is given');

  // ===================== 4) no "None flagged" when no step could be compared =====================
  reset();
  const team = (role, mgr, w, l1, l2, open1, qs) => (qs || [[2025, 4], [2026, 1], [2026, 2]]).flatMap(([fy, fq]) => [
    C(role, mgr, true, w, 6, { fy, fq, cfy: fy, cfq: fq }), C(role, mgr, false, l1, 1, { fy, fq, cfy: fy, cfq: fq }), C(role, mgr, false, l2, 2, { fy, fq, cfy: fy, cfq: fq })].concat(open1 ? [O(role, mgr, fy, fq, open1, 1)] : []));
  // MEA: 6 deals a quarter, 18 in all: no step reaches 20 that left it; Nordics: lots, but most still at stage 1+
  DATA.cv_closed = [...team('AE-EMEA-DACH', 'Dm', 50, 20, 10), ...team('AE-EMEA-CEE', 'Cm', 45, 25, 10), ...team('AE-EMEA-MEA', 'Mm', 3, 2, 1), ...team('AE-EMEA-NORDICS', 'Nm', 40, 20, 5)];
  DATA.cv_open = [...team('AE-EMEA-NORDICS', 'Nm', 0, 0, 0, 0).filter(() => false), ...[[2025, 4], [2026, 1], [2026, 2]].map(([fy, fq]) => O('AE-EMEA-NORDICS', 'Nm', fy, fq, 0, 2))];
  // Nordics: stages 2 → 3 onwards have many still open, so only steps 0 → 1 and 1 → 2 are compared
  DATA.cv_open = [[2025, 4], [2026, 1], [2026, 2]].map(([fy, fq]) => O('AE-EMEA-NORDICS', 'Nm', fy, fq, 40, 2));
  DATA.cv_window = []; DATA.cv_source = []; DATA.cv_days = []; DATA.cv_lost_month = []; DATA.roster = []; DATA.team_tree = []; DATA.cr_monthly = [];
  runAll();
  const sm = DATA.conv_steps.find((r) => r.key === 'MEA'), sn = DATA.conv_steps.find((r) => r.key === 'Nordics'), sd = DATA.conv_steps.find((r) => r.key === 'DACH');
  ok(sm.created === 18 && sm.peerLabel === 'other AE teams' && sm.cmpSteps === 0 && !sm.leakBand, 'D4: MEA (18 created) has peers but no step to compare', [sm.created, sm.cmpSteps]);
  ok(sn.cmpSteps > 0 && sn.cmpSteps < 5 && !sn.leakBand && sd.cmpSteps === 5 && !sd.leakBand, 'D4: Nordics compares some steps, DACH every step; neither leaks', [sn.cmpSteps, sd.cmpSteps]);
  ok(DATA.conv_steps.filter((r) => !r.peerLabel).every((r) => r.cmpSteps === null), 'D4: rows without peers carry no count of compared steps');
  const leakTile = (k) => { params.region = k; const a = draw('kpi-conv-leak', 'b', { k: 'step' }), b = draw('kpi-conv-leak', 'span', { k: 'sub' }); return [a.textContent, b.textContent, a.className]; };
  const [m1, m2, m3] = leakTile('MEA');
  ok(m1 === '—' && m2 === 'too few deals have left each stage to compare with other AE teams' && !/os-warn/.test(m3), 'D4 tile: MEA reads —, too few deals to compare, not "None flagged"', [m1, m2]);
  const [n1, n2] = leakTile('Nordics');
  ok(n1 === 'None flagged' && new RegExp('^' + sn.cmpSteps + ' of 5 steps compared, none below the normal swing of other AE teams; the others have too few deals$').test(n2), 'D4 tile: Nordics says how many steps were compared', [n1, n2]);
  const [d1, d2] = leakTile('DACH');
  ok(d1 === 'None flagged' && d2 === 'every step within the normal swing of other AE teams', 'D4 tile: DACH, every step compared: within the normal swing', [d1, d2]);
  // a step better than the peers beyond the normal swing, and no leak: not "every step within the normal swing"
  const keep = DATA.cv_closed.slice();
  DATA.cv_closed.push(...team('AE-EMEA-FR', 'Fm', 80, 4, 10)); run('conv_steps');
  const sf = DATA.conv_steps.find((r) => r.key === 'France'), [f1, f2] = leakTile('France');
  ok(sf.strongBand && !sf.leakBand && f1 === 'None flagged' && f2 === 'no step below the normal swing of other AE teams', 'D4 tile: a team stronger than its peers at a step reads "no step below the normal swing"', [sf.strongBand, f2]);
  DATA.cv_closed = keep; run('conv_steps');
  params.region = 'MEA';
  const monMEA = asks(draw('conv-monday', 'span'))[0].ask, digMEA = asks(draw('conv-step-table', 'tbody')).find((d) => d.label === 'Dig into MEA').ask;
  ok(/Where deals leak \(created Q4 2025–Q2 2026, each against its peers on the same quarters\): no step has enough deals, here and among the peers, to compare\./.test(monMEA) && !/no step leaks beyond the normal swing/.test(monMEA), 'D4 Monday summary at MEA: nothing to compare, said so', monMEA.slice(0, 700));
  ok(/No step has enough deals, here and among other AE teams, to compare/.test(digMEA) && !/No step leaks beyond the normal swing/.test(digMEA), 'D4 Dig into MEA: nothing to compare, said so');
  params.region = 'Nordics';
  ok(/No step leaks beyond the normal swing \(\d of 5 steps had the deals to compare\)/.test(asks(draw('conv-step-table', 'tbody')).find((d) => d.label === 'Dig into Nordics').ask), 'D4 Dig into Nordics: no leak among the steps compared, and how many');
  params.region = 'BDR';
  DATA.cv_closed.push(...team('BDR-EMEA', 'Bm', 3, 30, 5)); run('conv_steps');
  ok(/: not compared here \(no fair peers\); the lowest step is /.test(asks(draw('conv-monday', 'span'))[0].ask), 'D4 Monday summary for a scope without peers: not compared, the lowest step');
  params.region = 'All';
  // live: MEA and the one SMB manager (no other SMB manager to compare with)
  reset();
  DATA.cv_open = live('cv_open'); DATA.cv_closed = live('cv_closed'); run('conv_steps');
  const lm = DATA.conv_steps.find((r) => r.key === 'MEA');
  const smbM = DATA.conv_steps.find((r) => r.level === 'manager' && r.mainClass === 'SMB' && r.peerLabel);
  params.region = 'MEA';
  const lt = [draw('kpi-conv-leak', 'b', { k: 'step' }).textContent, draw('kpi-conv-leak', 'span', { k: 'sub' }).textContent];
  params.region = 'All'; params.mgr = smbM.key.slice(2);
  const st2 = [draw('kpi-conv-leak', 'b', { k: 'step' }).textContent, draw('kpi-conv-leak', 'span', { k: 'sub' }).textContent];
  params.mgr = '';
  ok(lm.cmpSteps === 0 && lt[0] === '—' && /too few deals have left each stage/.test(lt[1]) && st2[0] === '—' && st2[1] === 'too few deals among the rest of SMB to compare with', 'D4 live: MEA and the SMB manager read —, each with its reason', [lt, st2]);

  // ===================== U2) Created by after the creator and closer moved out of EMEA sales =====================
  reset();
  const SR = (o) => ({ src: 'Inbound', bdrRole: null, bdrNow: null, creatorRole: 'AE-EMEA-NORDICS', role: 'AE-EMEA-NORDICS', closedRole: 'AE-EMEA-NORDICS', closed: true, won: true, n: 10, arr: 1e4, cycleDays: 0, cycleN: 0, ...o });
  DATA.cv_source = [SR({ role: 'Consulting Partnerships', creatorRole: 'Consulting Partnerships', n: 40 }), SR({ role: 'Consulting Partnerships', creatorRole: 'BDR-EMEA', n: 5 }), SR({ creatorRole: null, n: 3 }), SR({ won: false, n: 30 }),
    SR({ closed: false, won: false, closedRole: null, role: 'Consulting Partnerships', creatorRole: 'Consulting Partnerships', n: 7 })];
  const src = run('conv_sources');
  const cb2 = (k, v) => src.find((r) => r.key === k + '|Created by|' + v) || { closed: 0 };
  ok(cb2('Nordics', 'Field AE or sales leader').closed === 70 && cb2('Nordics', 'BDR').closed === 5 && cb2('Nordics', 'Other or system').closed === 3, 'U2: a closer who has since moved out of EMEA sales counts under the role at close; other creators unchanged', [cb2('Nordics', 'Field AE or sales leader').closed, cb2('Nordics', 'Other or system').closed]);
  const tr = src.find((r) => r.key === 'trust|creator');
  ok(/3 closed deals were created by users with no role/.test(tr.detail) && /40 were closed in an EMEA sales role and are now owned outside EMEA sales by someone in their creator's role today/.test(tr.detail), 'U2: How far to trust counts them', tr.detail);
  DATA.cv_source = live('cv_source'); run('conv_sources');
  const nOther = DATA.conv_sources.find((r) => r.key === 'Nordics|Created by|Other or system');
  ok(nOther && nOther.mark !== 'high' && nOther.closed < 60, 'U2 live: Nordics "Other or system" is no longer marked high by one person\'s role change', nOther && [nOther.closed, nOther.mark]);
  ok(/122 were closed in an EMEA sales role/.test(DATA.conv_sources.find((r) => r.key === 'trust|creator').detail), 'U2 live: 122 such deals counted in How far to trust');

  // ===================== U3) a leader whose motion has under 20 deals in each comparable quarter =====================
  reset();
  const L3 = [C('AE-EMEA-FR', 'L', true, 9, 6, { cfq: 2 }), C('AE-EMEA-FR', 'L', false, 9, 1, { cfq: 2 }), C('SMB-EMEA', 'L', true, 4, 6, { cfq: 2 })];
  for (const [fy, fq] of [[2025, 4], [2026, 1], [2026, 2], [2026, 3]]) L3.push(C('AE-EMEA-BENELUX', 'P', true, 100, 6, { fy, fq, cfy: fy, cfq: fq }), C('AE-EMEA-BENELUX', 'P', false, 100, 1, { fy, fq, cfy: fy, cfq: fq }));
  DATA.cv_closed = L3; DATA.cv_open = [O('AE-EMEA-FR', 'L', 2026, 3, 80, 1), O('AE-EMEA-FR', 'L', 2026, 4, 80, 0), O('AE-EMEA-FR', 'L', 2025, 3, 30, 1)];
  DATA.team_tree = [{ name: 'L', email: 'l@x.test', manager: null, isLeader: true, isTop: false }];
  run('oo_points_conv'); run('conv_cohorts');
  const l3 = DATA.oo_points_conv.filter((r) => r.email === 'l@x.test');
  ok(l3.length === 2 && l3[0].section === 'numbers' && /^Team conversion, New Business created in Q2 2026: 59% won within 2 quarters \(13 of 22\)\. Not compared: too few of the team's AE-team deals \(18 created in Q2 2026\)\.$/.test(l3[0].text),
    'U3 agenda: the whole team\'s share, not compared, and why', l3.map((r) => r.text));
  ok(l3[1] && l3[1].section === 'talk' && l3[1].sev === 'medium' && /^30 open New Business deals created in Q1 2026 or before are still at stage 0–1/.test(l3[1].text), 'U3 agenda: the old-deals point still comes');
  const s3 = DATA.conv_cohorts.find((r) => r.key === 'M|L|New Business');
  ok(s3.trendNote === 'few' && s3.y2qN === 22 && s3.y2qWon === 13 && s3.fewN === 18 && s3.fewWhat === 'AE-team deals' && s3.y2qVerdict === null && s3.peerY2q === null, 'U3 view: the manager\'s tile falls back to all their deals, not compared, as the agenda', [s3.trendNote, s3.y2qN, s3.fewN]);
  params.mgr = 'L';
  const t3 = tile({ draw: 'kpi-conv', calc: 'cohorts', field: 'y2q', fmt: 'pct', source: 'conv_cohorts' });
  ok(t3.textContent === '59%' && !t3.classList.contains('os-bad') && !t3.classList.contains('os-ok') && /Not coloured: too few of their AE-team deals to compare \(18 of the 22 created in Q2 2026\)/.test(t3.title) && /not compared: 18 AE-team deals$/.test(draw('kpi-conv-y2q', 'span').textContent), 'U3 view: 59% uncoloured, saying why');
  params.mgr = '';

  // ===================== U4) at All EMEA the step table lists SMB once =====================
  reset();
  DATA.cv_open = []; DATA.cv_closed = [...team('AE-EMEA-DACH', 'Dm', 50, 20, 10), ...team('SMB-EMEA', 'Sm', 80, 10, 10)]; run('conv_steps');
  // the step table waits while the win rates or a team's managers load (second review): both settled, empty
  DATA.cv_window = []; DATA.roster = []; run('conv_close'); run('conv_mgr');
  const u4 = rowsOf('conv-step-table').map((r) => cells(r)[0]);
  ok(JSON.stringify(u4) === JSON.stringify(['All EMEA', 'SMB', 'Field', 'DACH']), 'U4: All EMEA, SMB, Field, then the Field teams: SMB once', u4);
  const copiedT = OS.tableText('conv-step-table');
  ok((copiedT.match(/^SMB\t/gm) || []).length === 1, 'U4: Copy table has SMB once');

  // ===================== U5) marks: the check lists and what reads conv_mgr or conv_closeout =====================
  const html = fs.readFileSync(D + 'index.html', 'utf8');
  const srcOf = (name, tag) => { const m = html.match(new RegExp('<' + (tag || '[a-z]+') + '[^>]*data-draw="' + name + '"[^>]*data-source="([^"]+)"')); return m ? m[1].split(/\s+/) : []; };
  ok(['home-checks', 'check-list'].every((n) => OS.CHECKS.every((id) => srcOf(n).includes(id))), 'U5: Home\'s top checks and the Data checks list mark every check source they read', OS.CHECKS.filter((id) => !srcOf('check-list').includes(id)));
  const tblSrc = (body) => { const m = html.match(new RegExp('<table[^>]*data-source="([^"]+)"[^>]*>(?:(?!<table)[\\s\\S])*?<tbody data-draw="' + body + '"')); return m ? m[1].split(/\s+/) : []; };
  ok(['kpi-conv-peer', 'conv-monday', 'conv-src-ask'].every((n) => srcOf(n).includes('conv_mgr')) && ['conv-reason-table', 'conv-src-table', 'conv-step-table'].every((b) => tblSrc(b).includes('conv_mgr')), 'U5: what reads the picked manager\'s team marks conv_mgr');
  reset();
  DATA.cv_open = []; DATA.cv_closed = []; DATA.cv_window = []; DATA.cv_days = []; DATA.cv_source = []; DATA.cv_lost_month = []; DATA.roster = []; DATA.cr_monthly = [];
  runAll();
  READS.clear();
  for (const [calc, field] of [['cohorts', 'y2q'], ['cohorts', 'staleOpen'], ['time', 'median'], ['close', 'won4'], ['close', 'earlyShare']]) tile({ draw: 'kpi-conv', calc, field, fmt: 'pct', source: 'conv_' + calc });
  ok(!READS.has('conv_closeout'), 'U5: tiles that show nothing of the clean-up quarter don\'t read conv_closeout');
  READS.clear(); tile({ draw: 'kpi-conv', calc: 'close', field: 'winRate', fmt: 'pct', source: 'conv_close' });
  ok(READS.has('conv_closeout'), 'U5: the win-rate tile still reads it for its title');
  params.mgr = 'Someone'; STATE.conv_mgr = 'loading';
  const wl = tile({ draw: 'kpi-conv', calc: 'close', field: 'winRate', fmt: 'pct', source: 'conv_close' });
  ok(wl.textContent === '—' && wl.classList.contains('dash-skeleton'), 'U5: with a manager picked, the close tiles show loading while conv_mgr loads');
  delete STATE.conv_mgr; params.mgr = '';

  // ===================== U6) the local store holds the committed files =====================
  const store = D + 'store/files/';
  if (fs.existsSync(store)) {
    const stale = fs.readdirSync(store).filter((f) => JSON.parse(fs.readFileSync(store + f, 'utf8')).text !== fs.readFileSync(D + f.replace(/\.json$/, ''), 'utf8'));
    ok(!stale.length, 'U6: every store/files/*.json text equals its source file (rebuild with build_store.py before publishing)', stale);
  } else console.log('skip U6: no local store/ (build_store.py writes it before publishing)');

  // ===================== U7) the trust rows say which quarters they count =====================
  reset();
  DATA.cv_window = live('cv_window'); run('conv_trust_close'); run('conv_reasons');
  const tt = (id) => DATA.conv_trust_close.find((t) => t.id === id).detail;
  ok(['reasons', 'stage3', 'atwin'].every((id) => /^In the last 4 quarters and this one, /.test(tt(id))) && /Why deals are lost shows the 4 completed quarters\./.test(tt('reasons')), 'U7: reasons, stage-3 and lost-after-win rows say they count this quarter too', ['reasons', 'stage3', 'atwin'].map((id) => tt(id).slice(0, 60)));
  const all = DATA.conv_reasons.find((r) => r.key === 'All|*');
  // the wider closed-deal scope adds 2 losses on the old list (Lost to Competitor, Q2 2026): 1,459 became 1,461, 1,135 became 1,137
  // this quarter's losses so far move every day (one closed lost after the morning run made 351 into 352): recounted from
  // the answer itself, New Business closed lost this quarter, admin merges left out
  const thisQ = DATA.cv_window.filter((r) => r.won !== true && !/^(merged with global pilot|record cleanup)$/i.test(r.reason || '') && +r.fy * 4 + (+r.fq - 1) === 2026 * 4 + 3).reduce((a, r) => a + (+r.n || 0), 0);
  ok(/1,461 New Business losses use the list retired/.test(tt('reasons')) && all.lost4 === 1137 && all.thisQLost === thisQ && thisQ > 0, 'U7 live: 1,461 losses on the old list over 5 quarters beside a table of 1,137 over 4 (' + thisQ + ' this quarter, as recounted from the answer)', [(tt('reasons').match(/([\d,]+) New Business losses use the list retired/) || [])[1], all.lost4, all.thisQLost, thisQ]);

  console.log(passes + ' passed, ' + fails + ' failed');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
