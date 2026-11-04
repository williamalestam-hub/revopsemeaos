// Conversion review fixes, second round (4 Nov 2026), on the real calcs, drawings, page text and README: an Engagement-
// or Leadership-led team's agenda keeps all its deals; the Monday summary names the team behind a manager's losses and
// sources, gives the SMB team its lowest step, and waits for what it carries (so do SMB vs Field, the sources request,
// the step table and the Last-quarter tooltip); a manager with too few deals in their motion shows all their deals in the
// cohort table too; the trust rows' wording; a RevOps agenda's "Data checks outside Conversion"; README facts; the
// old-deals point opens Data checks › Conversion; close tiles drop a stale mark; the leak chart's message slot; the
// palette at 400px; the segment switch tags the all-EMEA figures; the note for scopes without peers; the chip group.
// Synthetic rows and the saved live answers (live/conv-wide); prints labels and counts only, never names.
// CONV_REPO=<checkout> runs it against another checkout (for example an export of a06793d, where it fails).
const { Node } = require('./fakedom.js');
const NOW = Date.parse('2026-11-04T10:00:00Z');
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const fs = require('fs');
const REPO = (process.env.CONV_REPO || '/home/user/revopsemeaos').replace(/\/?$/, '/');
const D = REPO + 'dashboard/';
const LIVE = '/tmp/claude-0/-home-user-revopsemeaos/c3936b63-31db-5219-aa72-dbd9a885d4cb/scratchpad/wip-conv/live/conv-wide/';
const calcs = {}, draws = {}, loaders = {}, onData = [];
let params = { region: 'All', mgr: '', person: '', checkArea: 'All', ooWho: '', cvSeg: 'all', cvRt: 'nb', cvClean: false, grWindow: 30 };
const DATA = {}, STATE = {}, READS = new Set();
global.dash = { loader: (id, o) => { loaders[id] = o; }, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; onData.forEach((f) => f()); }, onData: (fn) => { onData.push(fn); }, colors: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'], setLink: () => {},
  data: (id) => { READS.add(id); return STATE[id] ? { status: STATE[id], data: [] } : id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }; } };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: (f) => (v) => (f === '.1f' ? (+v).toFixed(1) : f === '.0%' ? Math.round(v * 100) + '%' : f === ',' ? Math.round(v).toLocaleString('en') : String(v)), max: (a, f) => (a.length ? Math.max(...a.map(f)) : undefined), select: () => ({ selectAll: () => ({ remove() {} }) }) };
global.claude = { use: async (n) => (n === 'room' ? { canSendToClaudeSession: async () => 'available', sendToClaudeSession: () => Promise.resolve({}) } : null) };
global.location.hash = '#created-conversion';
const REG = {};
document.querySelector = (sel) => (/data-view-panel/.test(sel) ? new Node('div') : null);
document.querySelectorAll = (sel) => REG[sel] || [];
const handlers = []; document.addEventListener = (ev, fn) => { if (ev === 'click') handlers.push(fn); };
let copied = null; Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: (t) => { copied = t; return Promise.resolve(); } } }, configurable: true, writable: true });
for (const f of ['os-core.js', 'os-calcs.js', 'os-calcs-leads.js', 'os-calcs-act.js', 'os-calcs-conv.js', 'os-draw.js']) require(D + f);
const HTML = fs.readFileSync(D + 'index.html', 'utf8'), CSS = fs.readFileSync(D + 'os.css', 'utf8'), README = fs.readFileSync(REPO + 'README.md', 'utf8');
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
const ask1 = (name) => (asks(draw(name, 'span'))[0] || {}).ask || '';
const tile = (ds) => { const el = new Node('b'); Object.assign(el.dataset, ds); draws[ds.draw](el); return el; };
const fire = () => onData.forEach((f) => f());
const click = (el) => { el.matches = (sel) => sel === '[data-nav]'; el.closest = () => el; const ev = { target: { closest: () => el }, preventDefault() {} }; for (const h of handlers) h(ev); };
const nav = (screen, view) => { const b = new Node('button'); b.dataset.nav = screen; if (view) b.dataset.navView = view; click(b); };
const press = (attr) => { copied = null; const btn = new Node('button'); btn.dataset[attr] = ''; btn.matches = (sel) => sel === '[data-' + attr.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ']'; btn.closest = () => btn; const ev = { target: { closest: () => btn }, preventDefault() {} }; for (const h of handlers) h(ev); return copied || ''; };
const reset = () => { for (const k of Object.keys(DATA)) delete DATA[k]; for (const k of Object.keys(STATE)) delete STATE[k]; params = { ...params, region: 'All', mgr: '', cvSeg: 'all', cvRt: 'nb', cvClean: false, ooWho: '', checkArea: 'All' }; };
const live = (id) => { const j = JSON.parse(fs.readFileSync(LIVE + id + '.json', 'utf8')); return (j.records || j).map(({ attributes, ...r }) => r); };
const liveAll = () => { for (const id of ['cv_open', 'cv_closed', 'cv_window', 'cv_lost_month', 'cv_source', 'cv_days']) DATA[id] = live(id); };
const S0 = (n, stage) => { const s = {}; for (let k = 0; k < 7; k++) s['s' + k] = k <= stage ? n : 0; return s; };
// a closed New Business row created fy/fq and closed the same quarter (won within 2 quarters), by its role today
const C = (role, manager, fy, fq, won, n, stage) => ({ rt: 'New Business', fy, fq, role, manager, closedRole: role, closedManager: manager, won, cfy: fy, cfq: fq, n, arr: n * 1000, ...S0(n, won ? 6 : stage == null ? 1 : stage), cwStamp: 0, clStamp: 0 });
const O = (role, manager, fy, fq, n, stage) => ({ rt: 'New Business', fy, fq, role, manager, n, arr: n * 1000, ...S0(n, stage == null ? 1 : stage), cwStamp: 0, clStamp: 0 });
const Q1 = 2026 * 4, Q2 = 2026 * 4 + 1;
// a paragraph of index.html by its attributes, as a fakedom node (only what the page code reads)
const para = (attrs, text) => { const p = new Node('p'); for (const [k, v] of Object.entries(attrs)) p.dataset[k] = v; p.hidden = true; p.textContent = text || ''; return p; };
const htmlText = (re) => { const m = HTML.match(re); return m ? m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&') : null; };
const summarySources = () => {
  Object.assign(DATA, { pipe_team: [], pipe_cover: [], moves_kpi: [], cr_kpi: [], risk_kpi: [], rr_kpi: [], leavers_core: [], leavers_leads: [], leavers_pools: [], ld_kpi: [], ld_kpi_rt: [], act_kpi: [], orphan_kpi: [], engagement_kpi: [], gr_actions: [], gr_kpi: [], checks: [] });
  for (const id of OS.CHECKS) if (!DATA[id]) DATA[id] = [];
};

(async () => {
  await new Promise((r) => setTimeout(r, 0));

  // ===================== N1) an Engagement- or Leadership-led team keeps all its deals on its agenda =====================
  // One leader: 30 deals a quarter in the main motion and 6 DACH-owned (83%), Q1 and Q2 2026; AE peers elsewhere. Only AE
  // and SMB motions are ever compared, so the agenda must give the whole team's share, as the Conversion view does, and
  // never call it "the team's SMB deals".
  for (const [role, what] of [['EM-EMEA', 'Engagement'], ['MGR-SALES-EMEA', 'Leadership']]) {
    reset();
    DATA.cv_closed = [C(role, 'Lead X', 2026, 1, true, 18), C(role, 'Lead X', 2026, 1, false, 12), C('AE-EMEA-DACH', 'Lead X', 2026, 1, true, 3), C('AE-EMEA-DACH', 'Lead X', 2026, 1, false, 3),
      C(role, 'Lead X', 2026, 2, true, 9), C(role, 'Lead X', 2026, 2, false, 11), C('AE-EMEA-DACH', 'Lead X', 2026, 2, true, 2), C('AE-EMEA-DACH', 'Lead X', 2026, 2, false, 4),
      C('AE-EMEA-NORDICS', 'Peer P', 2026, 1, true, 30), C('AE-EMEA-NORDICS', 'Peer P', 2026, 1, false, 30), C('AE-EMEA-NORDICS', 'Peer P', 2026, 2, true, 30), C('AE-EMEA-NORDICS', 'Peer P', 2026, 2, false, 30)];
    DATA.cv_open = [O(role, 'Lead X', 2026, 2, 10)];
    DATA.team_tree = [{ name: 'Lead X', email: 'lead@x.test', manager: null, isLeader: true, isTop: false }, { name: 'Peer P', email: 'p@x.test', manager: null, isLeader: true, isTop: false }];
    run('oo_points_conv'); run('conv_cohorts');
    const pts = DATA.oo_points_conv.filter((r) => r.email === 'lead@x.test'), num = pts.find((r) => r.section === 'numbers'), talk = pts.filter((r) => r.section === 'talk').map((r) => r.text);
    const sc = DATA.conv_cohorts.find((r) => r.key === 'M|Lead X|New Business');
    ok(num && num.text === "Team conversion, New Business created in Q2 2026: 31% of the team's deals won within 2 quarters (11 of 36; Q1 2026 58%). Deals count for who closed them." && !pts.some((r) => /SMB deals|AE-team deals/.test(r.text)),
      'N1 ' + what + '-led team: the agenda gives all 36 deals (11 won within 2 quarters), never "the team\'s SMB deals"', num && num.text);
    ok(sc && sc.y2qWon === 11 && sc.y2qN === 36 && near(sc.prevY2q, 21 / 36) && sc.trend === 'below' && !sc.peerLabel, 'N1 ' + what + '-led team: the same 11 of 36 and quarter before as the Conversion view', sc && [sc.y2qWon, sc.y2qN, sc.trend]);
    ok(talk.includes("Won within 2 quarters fell from 58% (Q1 2026) to 31% (Q2 2026) for the team's deals."), 'N1 ' + what + '-led team: the drop point is on all its deals, as the view\'s trend', talk);
  }
  // an AE-led team is still narrowed to its AE-team deals
  reset();
  DATA.cv_closed = [C('AE-EMEA-FR', 'Lead A', 2026, 2, true, 15), C('AE-EMEA-FR', 'Lead A', 2026, 2, false, 15), C('EM-EMEA', 'Lead A', 2026, 2, true, 6),
    C('AE-EMEA-NORDICS', 'Peer P', 2026, 2, true, 30), C('AE-EMEA-NORDICS', 'Peer P', 2026, 2, false, 30)];
  DATA.cv_open = []; DATA.team_tree = [{ name: 'Lead A', email: 'a@x.test', manager: null, isLeader: true, isTop: false }];
  run('oo_points_conv');
  const nA = DATA.oo_points_conv.find((r) => r.email === 'a@x.test' && r.section === 'numbers');
  ok(nA && /: 50% of the team's AE-team deals \(30 of 36 created\) won within 2 quarters \(15 of 30; the rest of the AE teams 50%\)/.test(nA.text), 'N1 control: an AE-led team is still shown on its AE-team deals', nA && nA.text);

  // ===================== N2) the Monday summary names the team behind a manager's losses and sources =====================
  // Live answers; a manager whose 3 reports are in DACH. Losses and sources are per team, so both sentences say whose they are.
  reset(); liveAll();
  DATA.roster = ['r1', 'r2', 'r3'].map((name) => ({ name, role: 'AE-EMEA-DACH', manager: 'Mgr Picked', isActive: true }));
  DATA.team_tree = []; DATA.cr_monthly = []; DATA.cr_mix = [];
  runAll();
  params.mgr = 'Mgr Picked';
  const m2 = ask1('conv-monday');
  const top3 = DATA.conv_reasons.filter((r) => r.kind === 'reason' && r.scope === 'DACH').slice(0, 3).map((r) => r.group + ' ' + r.n.toLocaleString('en')).join(', ');
  ok(m2.includes('Top lost reasons (DACH, the team most of them are in): ' + top3) && !/Top lost reasons: /.test(m2), 'N2: "Top lost reasons (DACH, the team most of them are in)", DACH\'s top 3', m2.match(/Top lost reasons[^:]*:/));
  ok(/By lead source \(DACH, the team most of them are in\): |BDR-sourced win rate \(DACH, the team most of them are in\) /.test(m2) && /Win rate by count over the last 4 completed quarters \(DACH, the team most of them are in\)/.test(m2), 'N2: the lead-source sentence names DACH as the win rate does', m2.match(/(By lead source|BDR-sourced win rate)[^:]*:/));
  params.mgr = '';
  const mAll = ask1('conv-monday');
  ok(/Top lost reasons: /.test(mAll) && !/the team most of them are in/.test(mAll), 'N2: at All EMEA no team note');

  // ===================== N3) the Monday summary at the SMB team: no fair peers, the lowest step =====================
  // The one SMB-led manager holds every SMB deal: their peer pool is empty, so nothing at the SMB team could be compared.
  const smbM = DATA.conv_steps.find((r) => r.level === 'manager' && r.mainClass === 'SMB' && r.peerLabel);
  DATA.roster = ['s1', 's2'].map((name) => ({ name, role: 'SMB-EMEA', manager: smbM.key.slice(2), isActive: true })); run('conv_mgr');
  const smbRow = DATA.conv_steps.find((r) => r.key === 'SMB');
  const leakOf = (t) => (t.match(/Where deals leak \([^)]*\): ([^.]*)\./) || [])[1] || '';
  params.region = 'SMB'; const lkTeam = leakOf(ask1('conv-monday'));
  params.region = 'All'; params.cvSeg = 'smb'; const lkSeg = leakOf(ask1('conv-monday'));
  params.cvSeg = 'all'; params.region = 'SMB';
  const tileSmb = draw('kpi-conv-leak', 'b', { k: 'step' }).textContent;
  params.region = 'All';
  ok(CONV_STEPS_OK(smbM) && lkTeam === 'not compared here (no fair peers); the lowest step is ' + smbRow.lowLabel.replace(/^S/, 's') + ' at ' + Math.round(smbRow.lowRate * 100) + '%' && lkTeam === lkSeg,
    'N3: team SMB reads as the SMB segment: no fair peers, the lowest step', [lkTeam, lkSeg]);
  ok(tileSmb === 'Lowest: ' + smbRow.lowLabel, 'N3: and as the leak tile at team SMB', tileSmb);
  function CONV_STEPS_OK(r) { return r && r.cmpSteps === 0 && ['b0', 'b1', 'b2', 'b3', 'b46'].every((b) => r[b + 'Exp'] == null); }

  // ===================== N4) too few deals in their motion: the cohort table shows all their deals, as the tile =====================
  reset();
  DATA.cv_closed = [];
  for (const fq of [1, 2]) DATA.cv_closed.push(C('AE-EMEA-CEE', 'Mgr Q', 2026, fq, true, fq === 1 ? 9 : 6), C('AE-EMEA-CEE', 'Mgr Q', 2026, fq, false, fq === 1 ? 8 : 11), C('EM-EMEA', 'Mgr Q', 2026, fq, true, 3),
    C('AE-EMEA-FR', 'Peer F', 2026, fq, true, 40), C('AE-EMEA-FR', 'Peer F', 2026, fq, false, 40));
  DATA.cv_open = []; DATA.roster = []; DATA.team_tree = [{ name: 'Mgr Q', email: 'q@x.test', manager: null, isLeader: true, isTop: false }];
  DATA.cv_window = []; DATA.cv_source = []; DATA.cv_days = []; DATA.cv_lost_month = []; DATA.cr_monthly = [];
  runAll();
  const s4 = DATA.conv_cohorts.find((r) => r.key === 'M|Mgr Q|New Business');
  const c4 = (q) => DATA.conv_cohorts.find((r) => r.key === 'M|Mgr Q|New Business|' + q);
  ok(s4.trendNote === 'few' && s4.y2qN === 20 && s4.y2qWon === 9 && s4.fewN === 17 && s4.prevY2q === null && s4.y2qVerdict === null, 'N4: the scope row falls back to all 20 deals, not compared (17 AE-team deals)', [s4.trendNote, s4.y2qN, s4.fewN]);
  ok(c4(Q2).n === 20 && c4(Q2).status === 'Comparable' && c4(Q2).cmpWhat === null && near(c4(Q2).y2q, 0.45) && c4(Q2).y2qVerdict === null && c4(Q2).trend === null && c4(Q1).n === 20 && near(c4(Q1).y2q, 0.6),
    'N4: the cohort rows are all their deals too (Q2 2026: 9 of 20, 45%; Q1 2026: 60%), with no verdict', [c4(Q2).n, c4(Q2).status, c4(Q2).y2q]);
  params.mgr = 'Mgr Q';
  const t4 = tile({ draw: 'kpi-conv', calc: 'cohorts', field: 'y2q', fmt: 'pct', source: 'conv_cohorts' }).textContent;
  const row4 = rowsOf('conv-cohort-table').find((tr) => tr.dataset.key === 'M|Mgr Q|New Business|' + Q2);
  ok(t4 === '45%' && row4 && cells(row4)[1] === 'Comparable' && cells(row4)[2] === '20' && cells(row4)[8] === '45%' && !/only/.test(cells(row4)[0]), 'N4: the cohort table reads "Comparable · 20 · 45%", as the tile', row4 && cells(row4));
  const ag4 = DATA.oo_points_conv.find((r) => r.email === 'q@x.test' && r.section === 'numbers');
  ok(ag4 && /45% won within 2 quarters \(9 of 20\)\. Not compared: too few of the team's AE-team deals \(17 created in Q2 2026\)/.test(ag4.text), 'N4: the agenda agrees', ag4 && ag4.text);
  params.mgr = '';

  // ===================== N5) trust rows: the win-rate row count and the lost-reason lists (live) =====================
  reset(); DATA.cv_window = live('cv_window'); run('conv_trust_close');
  const tt = (id) => DATA.conv_trust_close.find((t) => t.id === id);
  ok(tt('windowCap').detail === 'Last 4 quarters and this one: ' + DATA.cv_window.length.toLocaleString('en') + ' rows.', 'N5: the row-count check says it covers this quarter too', tt('windowCap').detail);
  // independent recount from the answer: losses on the retired list, and the Value not perceived ones among them
  const cur = 2026 * 4 + 3, OLD = ['Qualified Out', 'Timing', 'Technical/Functional Gap', 'Lost to Competitor', 'No Champion', 'Budget', 'Value not perceived'];
  let old = 0, vnp = 0;
  for (const r of DATA.cv_window) { const q = +r.fy * 4 + (+r.fq - 1); if (q < cur - 4 || q > cur || r.won === true || /^(merged with global pilot|record cleanup)$/i.test(r.reason || '')) continue; if (OLD.includes(r.reason)) old += +r.n; if (r.reason === 'Value not perceived') vnp += +r.n; }
  const fmt = (v) => v.toLocaleString('en');
  ok(tt('reasons').value === old && tt('reasons').detail.includes(fmt(old) + ' New Business losses use the list retired on 3 Nov 2026: ' + fmt(old - vnp) + ' are counted under their new name, and Value not perceived (' + fmt(vnp) + ') has no clear new equivalent and keeps its name')
    && !tt('reasons').detail.includes(fmt(old) + ' New Business losses use the list retired on 3 Nov 2026 and are counted under their new name'), 'N5: of the ' + fmt(old) + ' old-list losses, only ' + fmt(old - vnp) + ' are said to count under a new name', tt('reasons').detail.slice(0, 220));

  // ===================== M1) a RevOps agenda: "Data checks outside Conversion", and its empty sentence =====================
  reset();
  summarySources();
  Object.assign(DATA, { risk_kpi: [{ region: 'All', stuck: 0, stuckArr: 0 }], rr_kpi: [{ region: 'All', missing: 0, weekOne: 0 }], orphan_kpi: [{ accounts: 0, arr: 0, splitBooks: 0 }], gr_kpi: [{ forYou: 0 }],
    checks: [{ id: 'c1', area: 'Pipeline', severity: 'high', title: 'A', what: 'x', region: 'France', manager: 'M1' }],
    checks_closed: [{ id: 'cc1', area: 'Pipeline', severity: 'low', title: 'B', what: 'y', region: 'DACH', manager: 'M2' }],
    checks_conv: [{ id: 'conv:old:x', area: 'Conversion', severity: 'medium', title: 'X', what: 'w', region: 'DACH', manager: null }, { id: 'conv:old:y', area: 'Conversion', severity: 'low', title: 'Y', what: 'w', region: 'CEE', manager: null }],
    checks_conv_lost: [], checks_conv_days: [],
    sf_me: [{ userId: '005ME', name: 'Will Ops', email: 'me@x.test', role: 'REVOPS', manager: 'Boss Person', managerEmail: 'boss@x.test' }],
    users_all: [{ name: 'Peer Ops', email: 'peer@x.test', role: 'REVOPS', manager: 'Big Boss' }],
    oo_upcoming: [], oo_followups: [], oo_points: [], oo_points_rr: [], oo_points_act: [], oo_points_conv: [], team_tree: [] });
  params.ooWho = 'peer@x.test';
  const line = OS.oo.text().split('\n').find((l) => /Data checks/.test(l)) || '';
  ok(line === '- Data checks outside Conversion: 2 open, 1 urgent', 'M1: the RevOps work line says what it counts (the Data checks view it opens lists 4)', line);
  ok(OS.checkRows({ region: 'All' }).length === 4, 'M1: the view the arrow opens (all EMEA, all areas) lists the 2 conversion checks too');
  // only conversion checks open: the line is left out, and the sentence that shows instead doesn't claim no data checks
  DATA.checks = []; DATA.checks_closed = [];
  const emptyP = para({ msgFor: 'oo-ops', msg: 'empty' }, htmlText(/data-msg-for="oo-ops" data-msg="empty" hidden>([^<]*)</));
  REG['[data-msg-for]'] = [emptyP]; const slot = new Node('span'); slot.dataset.draw = 'msg'; slot.dataset.for = 'oo-ops'; OS.drawMsg(slot); REG['[data-msg-for]'] = [];
  ok(OS.oo.ops('talk').length === 0 && !emptyP.hidden && /data checks outside Conversion/.test(emptyP.textContent) && !/routing gaps, data checks, /.test(emptyP.textContent), 'M1: only conversion checks open: "Nothing open: … data checks outside Conversion …"', emptyP.textContent);
  ok(/All of EMEA, as in the weekly summary on Home \(without its Conversion line\)\./.test(HTML), 'M1: the EMEA update says it leaves the Conversion line out');
  summarySources(); DATA.checks = [{ id: 'c1', area: 'Pipeline', severity: 'high', title: 'A', what: 'x', region: 'France', manager: 'M1' }];
  params.ooWho = '';
  const home = press('copySummary').split('\n').find((l) => /Data checks/.test(l)) || '';
  ok(home === '• Data checks: 3 open, 1 urgent', 'M1: Home\'s weekly summary keeps "Data checks" with the conversion checks', home);

  // ===================== M2) README: what Copy, Send and Email wait for =====================
  ok(!/Copy, Send and Email all wait\s+until everything the agenda shows has loaded/.test(README) && /Copy, Send and Email wait\s+until the agenda's core sources have loaded/.test(README), 'M2: README says Copy, Send and Email wait for the core sources only');
  // and that is what the code does: a leader's conversion lines still loading don't hold the copy back, and it says so
  reset();
  Object.assign(DATA, { oo_points: [{ key: 'p', email: 'l@x.test', name: 'Lead L', section: 'numbers', sev: '', order: 0, text: 'Pipeline this quarter $1M.' }], oo_points_rr: [], oo_followups: [], oo_upcoming: [],
    sf_me: [{ name: 'Sales Dir', email: 'me@x.test', role: 'DIR-SALES-EMEA', manager: null, managerEmail: null }], users_all: [{ name: 'Lead L', email: 'l@x.test', role: 'AE-EMEA-DACH', manager: 'Sales Dir' }],
    team_tree: [{ name: 'Lead L', email: 'l@x.test', manager: 'Sales Dir', isLeader: true, isTop: false }] });
  params.ooWho = 'l@x.test';
  ok(OS.oo.loading('l@x.test') === false && /- Conversion: still loading/.test(OS.oo.text()), 'M2: the copy is ready while conversion loads, and says "Conversion: still loading"');
  params.ooWho = '';

  // ===================== M3) README: the row counts of the queries that ship (the widened run) =====================
  const counts = ['cv_open', 'cv_closed', 'cv_window', 'cv_lost_month', 'cv_source', 'cv_days'].map((id) => live(id).length);
  const said = (README.match(/\((\d[\d,]*), (\d[\d,]*), (\d[\d,]*), (\d[\d,]*), (\d[\d,]*) and\s+(\d[\d,]*) rows, none cut/) || []).slice(1).map((x) => +x.replace(/,/g, ''));
  ok(JSON.stringify(said) === JSON.stringify(counts), 'M3: README gives the widened answers\' row counts (' + counts.join(', ') + ')', said);

  // ===================== M4) who gets the EMEA update and RevOps work: README and the 1:1s intro =====================
  const stale = /With your manager, your reports and RevOps colleagues, the EMEA update and the RevOps work open/;
  ok(!stale.test(README) && !stale.test(HTML) && /With RevOps colleagues, and with your manager and your reports when you are in RevOps, the EMEA update and the RevOps work open/.test(README)
    && /With RevOps colleagues \(and your manager and reports when you are in RevOps\), the EMEA update and the RevOps work open\./.test(HTML), 'M4: README and the 1:1s intro: RevOps colleagues, and your manager and reports when you are in RevOps');
  reset();
  Object.assign(DATA, { users_all: [{ name: 'Vp Person', email: 'vp@x.test', role: 'VP-SALES-EMEA', manager: null }, { name: 'Rep One', email: 'rep@x.test', role: 'AE-EMEA-DACH', manager: 'Sales Mgr' }, { name: 'Ops Peer', email: 'ops@x.test', role: 'REVOPS', manager: 'X' }],
    oo_points: [], oo_points_rr: [], oo_points_act: [], oo_points_conv: [], sf_me: [{ name: 'Sales Mgr', email: 'me@x.test', role: 'AE-EMEA-DACH', manager: 'Vp Person', managerEmail: 'vp@x.test' }] });
  const k1 = ['vp@x.test', 'rep@x.test', 'ops@x.test'].map((e) => OS.oo.kind(e).ops);
  DATA.sf_me = [{ name: 'Sales Mgr', email: 'me@x.test', role: 'REVOPS', manager: 'Vp Person', managerEmail: 'vp@x.test' }];
  const k2 = ['vp@x.test', 'rep@x.test', 'ops@x.test'].map((e) => OS.oo.kind(e).ops);
  ok(JSON.stringify(k1) === '[false,false,true]' && JSON.stringify(k2) === '[true,true,true]', 'M4: as the code does it (a sales viewer: RevOps colleagues only; a RevOps viewer: manager and reports too)', [k1, k2]);

  // ===================== U1) the Monday summary and the other requests wait for what they carry =====================
  reset(); liveAll(); DATA.roster = []; DATA.team_tree = []; DATA.cr_monthly = []; DATA.cr_mix = [{ source: 'Inbound', thisOpps: 5, lastOpps: 9 }];
  runAll();
  const monWith = (st) => { for (const [id, s] of Object.entries(st)) STATE[id] = s; const t = ask1('conv-monday'); for (const id of Object.keys(st)) delete STATE[id]; return t; };
  ok(monWith({}).length > 0 && !/not available/.test(monWith({})), 'U1: all loaded: the Monday summary, nothing missing');
  ok(monWith({ conv_close: 'loading', conv_reasons: 'loading', conv_closeout: 'loading', conv_sources: 'loading' }) === '', 'U1: win rates, losses and sources still loading: no Monday summary yet (never "not available" for them)');
  ok(monWith({ conv_steps: 'loading' }) === '' && monWith({ conv_cohorts: 'loading' }) === '', 'U1: leaks or cohorts still loading: no Monday summary yet');
  const failed = monWith({ conv_close: 'error' });
  ok(/Win rate: not available\./.test(failed) && !/Top lost reasons: not available/.test(failed), 'U1: a part that failed still says "not available"', (failed.match(/(Win rate|Top lost reasons)[^.]*\./g) || []));
  DATA.roster = ['r1', 'r2'].map((name) => ({ name, role: 'AE-EMEA-DACH', manager: 'Mgr Picked', isActive: true })); run('conv_mgr');
  params.mgr = 'Mgr Picked';
  ok(monWith({ conv_mgr: 'loading' }) === '' && monWith({}).length > 0, 'U1: with a manager picked, it waits for their team');
  params.mgr = '';
  params.region = 'DACH';
  ok(monWith({ conv_mgr: 'loading' }) === '', 'U1: at a team, it waits for the team\'s managers (their leaks are in it)');
  params.region = 'All';
  const smbWith = (st) => { for (const [id, s] of Object.entries(st)) STATE[id] = s; const t = ask1('conv-smb'); for (const id of Object.keys(st)) delete STATE[id]; return t; };
  ok(smbWith({}).length > 0 && smbWith({ conv_close: 'loading' }) === '' && smbWith({ conv_time: 'loading' }) === '', 'U1: SMB vs Field waits for the win rates and the times');
  ok(/Win rate: not available\./.test(smbWith({ conv_close: 'error' })) && /Time in stage: not available\./.test(smbWith({ conv_time: 'error' })), 'U1: SMB vs Field says which part couldn\'t load');
  const srcWith = (st) => { for (const [id, s] of Object.entries(st)) STATE[id] = s; const t = ask1('conv-src-ask'); for (const id of Object.keys(st)) delete STATE[id]; return t; };
  ok(/Created this quarter so far and last quarter/.test(srcWith({})) && srcWith({ cr_mix: 'loading' }) === '', 'U1: at All EMEA, "Which source to fund?" waits for what was created by source');
  const stepRows = (st) => { for (const [id, s] of Object.entries(st)) STATE[id] = s; const r = rowsOf('conv-step-table'); for (const id of Object.keys(st)) delete STATE[id]; return r; };
  const all14 = stepRows({});
  ok(all14.length > 0 && stepRows({ conv_close: 'loading' }).length === 0 && stepRows({ conv_close: 'error' }).length === all14.length, 'U1: the step table waits while win rates load, and stands alone when they failed', [all14.length]);
  STATE.conv_close = 'loading'; const sl = new Node('span'); sl.dataset.for = 'conv-step-table'; OS.drawMsg(sl); delete STATE.conv_close;
  ok(sl.className.includes('dash-skeleton'), 'U1: and shows loading meanwhile');
  const tipWith = (st) => { for (const [id, s] of Object.entries(st)) STATE[id] = s; const r = rowsOf('conv-reason-table').map((tr) => tr.children[8].title); for (const id of Object.keys(st)) delete STATE[id]; return r; };
  const cl1 = tipWith({ conv_closeout: 'loading' }), cl2 = tipWith({ conv_closeout: 'error' });
  ok(cl1.length > 1 && !cl1.some((t) => /couldn't load/.test(t)) && cl2.some((t) => /couldn't load/.test(t)), 'U1: the Last quarter tooltip says "couldn\'t load" only when it failed, not while it loads', [cl1.filter((t) => /couldn't load/.test(t)).length, cl2.filter((t) => /couldn't load/.test(t)).length]);

  // ===================== U2) the old-deals agenda point opens Data checks › Conversion for all of EMEA =====================
  reset();
  DATA.cv_closed = [C('AE-EMEA-FR', 'L', 2026, 2, true, 15), C('AE-EMEA-FR', 'L', 2026, 2, false, 15)]; DATA.cv_open = [O('AE-EMEA-FR', 'L', 2025, 3, 30, 1)];
  DATA.team_tree = [{ name: 'L', email: 'l@x.test', manager: null, isLeader: true, isTop: false }];
  run('oo_points_conv');
  Object.assign(DATA, { oo_points: [], oo_points_rr: [], oo_points_act: [], oo_upcoming: [], oo_followups: [], users_all: [], sf_me: [] });
  params.ooWho = 'l@x.test';
  const li = items('oo-talk').find((n) => /still at stage 0–1/.test(n.textContent));
  const go = li && li.children.find((c) => c.tagName === 'BUTTON');
  ok(go && go.dataset.nav === 'actions' && go.dataset.navView === 'checks' && go.dataset.navArea === 'Conversion' && go.dataset.navScope === 'All', 'U2: the arrow names the Conversion area and all of EMEA', go && go.dataset);
  params.checkArea = 'Leads'; params.region = 'France';
  if (go) click(go);
  ok(params.checkArea === 'Conversion' && params.region === 'All' && params.mgr === '', 'U2: after the click, Data checks shows the Conversion area for all of EMEA', [params.checkArea, params.region]);
  params.ooWho = ''; params.checkArea = 'All';
  nav('created', 'conversion');

  // ===================== U3) close tiles keep no stale mark, tooltip or colour; their extra reads are marked =====================
  reset(); liveAll(); DATA.roster = ['r1', 'r2'].map((name) => ({ name, role: 'AE-EMEA-DACH', manager: 'Mgr Picked', isActive: true })); DATA.team_tree = []; DATA.cr_monthly = [];
  runAll();
  const wt = new Node('b'); Object.assign(wt.dataset, { draw: 'kpi-conv', calc: 'close', field: 'winRate', fmt: 'pct', source: 'conv_close', where: 'key=All' });
  params.region = 'France'; draws['kpi-conv'](wt);
  const fr = [wt.textContent, wt.dataset.where, !!wt.title];
  params.region = 'All'; params.mgr = 'Mgr Picked'; STATE.conv_mgr = 'error'; draws['kpi-conv'](wt);
  ok(fr[1] === 'key=France' && fr[2] && wt.textContent === '—' && !wt.dataset.where && !wt.dataset.field && wt.title === '' && !wt.classList.contains('os-bad'), 'U3: with conv_mgr failed, the win-rate tile drops France\'s mark and tooltip', [fr, wt.dataset.where, wt.title.slice(0, 40)]);
  STATE.conv_mgr = 'loading'; draws['kpi-conv'](wt);
  ok(wt.textContent === '—' && !wt.dataset.where && wt.classList.contains('dash-skeleton'), 'U3: while conv_mgr loads, the same, as loading');
  delete STATE.conv_mgr; draws['kpi-conv'](wt);
  ok(wt.dataset.where === 'key=DACH' && wt.dataset.field === 'winRate' && /^\d+%$/.test(wt.textContent), 'U3: once it has loaded, DACH\'s figure and mark', [wt.textContent, wt.dataset.where]);
  params.mgr = '';
  const statOf = (id) => { const i = HTML.indexOf('id="' + id + '"'), s = HTML.lastIndexOf('<div', i), e = HTML.indexOf('</div>', i); return i < 0 ? '' : HTML.slice(s, e); };
  const closeTiles = (HTML.match(/<b data-draw="kpi-conv" data-calc="close"[^>]*>/g) || []);
  const markOf = (box) => ((box.match(/^<div class="stat"[^>]*data-source="([^"]+)"/) || [])[1] || '').split(/\s+/);
  const inBox = closeTiles.map((t) => ['stat-cv-win', 'stat-cv-late'].find((id) => statOf(id).includes(t)) || null);
  ok(closeTiles.length === 8 && inBox.every(Boolean) && ['stat-cv-win', 'stat-cv-late'].every((id) => ['conv_mgr', 'conv_closeout'].every((s) => markOf(statOf(id)).includes(s))),
    'U3: the 8 close tiles sit in the two close stats, each marked with conv_mgr and conv_closeout (what their figures and tooltips also read)', [closeTiles.length, inBox, markOf(statOf('stat-cv-win'))]);

  // ===================== U4) the leak chart has its own message slot =====================
  ok(/<div class="os-chart" data-draw="conv-funnel-chart" data-source="conv_steps"><\/div><div class="msgs"><span class="msg-slot" data-draw="msg" data-for="conv-funnel-chart"><\/span>/.test(HTML)
    && /data-msg-for="conv-funnel-chart" data-msg="empty" hidden>Nothing to chart for this scope\.</.test(HTML), 'U4: index.html gives the leak chart a message slot and an empty sentence');
  const fslot = () => { const p = para({ msgFor: 'conv-funnel-chart', msg: 'empty' }, htmlText(/data-msg-for="conv-funnel-chart" data-msg="empty" hidden>([^<]*)</) || ''); REG['[data-msg-for]'] = [p]; const s = new Node('span'); s.dataset.for = 'conv-funnel-chart'; OS.drawMsg(s); REG['[data-msg-for]'] = []; return [s.textContent, !p.hidden]; };
  STATE.conv_steps = 'error'; STATE.cv_open = 'connect';
  const fc = fslot(); delete STATE.conv_steps; delete STATE.cv_open;
  params.mgr = 'Nobody Here'; const fe = fslot(); params.mgr = '';
  ok(fc[0] === 'Connect Salesforce in your claude.ai connectors to see this.' && fe[1], 'U4: the slot says what to connect, and the empty sentence shows for a scope with no row', [fc, fe]);

  // ===================== U5) Ctrl K at about 400px: a Go to row keeps its destination =====================
  const cq = [...CSS.matchAll(/@container main \(max-width: ([\d.]+)rem\) \{([^}]*\})\s*\}/g)].find((m) => /\.pal-go \.pal-sub\s*\{\s*display:\s*none/.test(m[2]));
  ok(cq && +cq[1] * 16 >= 400 && +cq[1] * 16 <= 600, 'U5: os.css hides a Go to row\'s sub-label while the main column is ' + (cq ? cq[1] + 'rem' : '?') + ' or narrower', cq && cq[0]);
  ok(/<span class="pal-label">Created opps › Conversion<\/span><span class="pal-sub">[^<]+<\/span>/.test(HTML) && /class="pal-item pal-go"[^>]*data-nav-view="conversion"/.test(HTML), 'U5: the Conversion row is a Go to row with its sub-label (still searched)');

  // ===================== U6) the segment switch tags the all-EMEA figures above it =====================
  reset(); liveAll(); DATA.roster = []; DATA.team_tree = []; DATA.cr_monthly = []; runAll();
  const tags = [new Node('span'), new Node('span')]; tags.forEach((t) => { t.dataset.scopeTag = ''; t.hidden = true; }); REG['[data-scope-tag]'] = tags;
  params.cvSeg = 'smb'; fire();
  const onSeg = tags.every((t) => !t.hidden);
  params.cvSeg = 'field'; fire(); const onField = tags.every((t) => !t.hidden);
  nav('created', 'trend'); const onTrend = tags.every((t) => t.hidden);
  nav('created', 'conversion'); const back = tags.every((t) => !t.hidden);
  params.cvSeg = 'all'; fire(); const onAll = tags.every((t) => t.hidden);
  REG['[data-scope-tag]'] = [];
  ok(onSeg && onField && onTrend && back && onAll, 'U6: Field or SMB picked on Conversion: the "all EMEA" tags show; on another view or at All EMEA they don\'t', { onSeg, onField, onTrend, back, onAll });

  // ===================== U7) the scope note: no peer comparison promised where there are no fair peers =====================
  const allNote = htmlText(/<span data-cv-note-k="all">([^<]*)<\/span>/) || '';
  ok(!/to compare it with its peers/.test(allNote) && /Field or SMB above to see a segment against its own earlier quarters/.test(allNote), 'U7: the All EMEA sentence no longer promises peers for Field or SMB', allNote);
  const selfNote = htmlText(/<span data-cv-note-k="self" hidden>([^<]*)<\/span>/);
  ok(selfNote && /No fair peers here: compared with its own earlier quarters/.test(selfNote), 'U7: a sentence for a team or segment without fair peers', selfNote);
  const NOTES = ['all', 'team', 'self', 'bdr', 'mgr'].map((k) => { const n = new Node('span'); n.dataset.cvNoteK = k; return n; });
  REG['[data-cv-note-k]'] = NOTES;
  const vis = () => NOTES.filter((n) => !n.hidden).map((n) => n.dataset.cvNoteK).join();
  const seen = {};
  for (const [reg, seg] of [['All', 'all'], ['All', 'field'], ['All', 'smb'], ['SMB', 'all'], ['Engagement', 'all'], ['Leadership', 'all'], ['DACH', 'all'], ['BDR', 'all']]) { params.region = reg; params.cvSeg = seg; fire(); seen[reg + '/' + seg] = vis(); }
  params.region = 'All'; params.cvSeg = 'all'; fire(); REG['[data-cv-note-k]'] = [];
  ok(JSON.stringify(seen) === JSON.stringify({ 'All/all': 'all', 'All/field': 'self', 'All/smb': 'self', 'SMB/all': 'self', 'Engagement/all': 'self', 'Leadership/all': 'self', 'DACH/all': 'team', 'BDR/all': 'bdr' }),
    'U7: segments, SMB, Engagement and Leadership get the no-peers sentence; an AE team the comparison', seen);

  // ===================== U8) the cohort pane's New Business / Upsell chips are a labelled group =====================
  ok(/<span class="tools" role="group" aria-label="Opportunity type"><button class="fchip" type="button" data-cv-rt="nb" aria-pressed="true">New Business<\/button><button class="fchip" type="button" data-cv-rt="up" aria-pressed="false">Upsell<\/button><\/span>/.test(HTML), 'U8: the opportunity-type chips sit in a group labelled "Opportunity type"');

  console.log(passes + ' passed, ' + fails + ' failed');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
