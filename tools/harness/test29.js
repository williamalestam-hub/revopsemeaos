// 1:1 agendas for every kind of 1:1 (4 Nov 2026): what the last meeting covered, who they are to you, the EMEA update
// and RevOps work for your manager, your reports and RevOps colleagues, a plain note for everyone else, and an
// integration user that shares a colleague's email not taken for them. Synthetic rows only.
// CORE=<path to an older os-core.js> prints that version's weekly summary instead (for the regression compare).
const { Node } = require('./fakedom.js');
let NOW = Date.parse('2026-11-04T09:00:00Z');
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const calcs = {}, draws = {}, onData = [];
let params = { region: 'All', mgr: '', person: '', checkArea: 'All', ooWho: '', grWindow: 30 };
const DATA = {}, STATE = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; onData.forEach((f) => f()); }, onData: (fn) => { onData.push(fn); }, colors: ['#111', '#222'], setLink: () => {},
  data: (id) => (STATE[id] ? { status: STATE[id], data: [] } : id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: (f) => (v) => (f === '.0%' ? Math.round(v * 100) + '%' : f === ',' ? Math.round(v).toLocaleString('en') : String(v)), max: (a, f) => Math.max(...a.map(f)) };
global.claude = { use: async () => null };
global.location.hash = '#oneonone-upcoming';
const REG = {};
document.querySelector = (sel) => (sel === '[data-view-panel="oneonone:upcoming"]' ? new Node('div') : null);
document.querySelectorAll = (sel) => REG[sel] || [];
const handlers = []; document.addEventListener = (ev, fn) => { if (ev === 'click') handlers.push(fn); };
let copied = null; Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: (t) => { copied = t; return Promise.resolve(); } } }, configurable: true, writable: true });
require(process.env.CORE || '/home/user/revopsemeaos/dashboard/os-core.js');
require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js');
if (!process.env.CORE) require('/home/user/revopsemeaos/dashboard/os-draw.js');
let fails = 0; const ok = (c, l, x) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const press = (attr) => { copied = null; const btn = new Node('button'); btn.dataset[attr] = ''; btn.matches = (sel) => sel === '[data-' + attr.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ']'; btn.closest = () => btn; const ev = { target: { closest: () => btn }, preventDefault() {} }; for (const h of handlers) h(ev); return copied || ''; };
const items = (el) => { const out = []; const walk = (n) => { for (const c of n.children) { if (c.tagName === 'LI') out.push(c); else walk(c); } }; walk(el); return out; };
const list = (name) => { const el = new Node('ul'); el.dataset.draw = name; draws[name](el); return items(el); };
const fire = () => onData.forEach((fn) => fn());

// ----- the weekly summary sources (some lines only) -----
Object.assign(DATA, {
  pipe_team: [{ key: 'All|All', thisPipe: 5e6, thisCommit: 2e6, thisBest: 3e6, won: 1e6 }, { key: 'France|All', thisPipe: 1e6, thisCommit: 4e5, thisBest: 6e5, won: 2e5 }],
  pipe_cover: [], moves_kpi: [], cr_kpi: [{ thisWeekOpps: 12, lastWeekOpps: 9, thisQOpps: 140 }],
  risk_kpi: [{ region: 'All', stuck: 7, stuckArr: 9e5 }, { region: 'France', stuck: 2, stuckArr: 1e5 }],
  rr_kpi: [{ region: 'All', missing: 3, weekOne: 1 }, { region: 'France', missing: 1, weekOne: 0 }],
  checks: [{ id: 'c1', area: 'Pipeline', severity: 'high', title: 'A', what: 'x', region: 'France', manager: 'M1' }, { id: 'c2', area: 'Books', severity: 'low', title: 'B', what: 'y', region: 'DACH', manager: 'M2' }],
  leavers_core: [], leavers_leads: [], leavers_pools: [], ld_kpi: [], ld_kpi_rt: [], act_kpi: [], orphan_kpi: [{ accounts: 4, arr: 1e5, splitBooks: 2 }], engagement_kpi: [],
  gr_actions: [], gr_kpi: [{ forYou: 0 }],
});
for (const id of ['checks_rr', 'checks_hb', 'checks_lv', 'checks_ld', 'checks_ld_rt', 'checks_ld_cap', 'checks_act', 'checks_cfg', 'checks_closed']) DATA[id] = [];

setTimeout(() => {
  // ----- regression: Home's Copy summary reads the scope pill as before -----
  params.region = 'France';
  const fr = press('copySummary');
  params.region = 'All';
  const all = press('copySummary');
  if (process.env.CORE) { console.log(JSON.stringify({ fr, all })); process.exit(0); }
  const old = process.env.OLD ? JSON.parse(require('fs').readFileSync(process.env.OLD, 'utf8')) : null;
  if (old) ok(old.fr === fr && old.all === all, 'Copy summary text is unchanged from the last published version (France and all EMEA)', { old, fr, all });
  ok(/^RevOps update, France,/.test(fr) && /Data checks: 1 open, 1 urgent/.test(fr) && /Stuck in stage: 2 deals/.test(fr), 'Copy summary follows the scope pill (France)', fr);
  ok(/Data checks: 2 open, 1 urgent/.test(all) && /Account books: 4 orphan/.test(all) && /My action items/.test(all), 'Copy summary for all EMEA keeps the action items line', all);

  // ----- calcs: an integration user sharing a colleague's email is not them -----
  const ev = (email, name) => ({ id: 'e' + email, start: '2026-11-05T09:00:00+01:00', end: '2026-11-05T09:30:00+01:00', allDay: false, title: '1:1', status: 'confirmed', organizerSelf: true, recurring: true, link: null, calendar: 'me@x.test',
    attendees: ['me@x.test|self||accepted||', [email, '', '', 'accepted', '', name || ''].join('|')].join(';') });
  const users = [{ name: 'CrossBeam Integration', email: 'cory.g@x.test', role: null, manager: null }, { name: 'Jo Initials', email: 'jq@x.test', role: 'REVOPS', manager: 'Boss Person' },
    { name: 'Robot Account', email: 'robot@x.test', role: null, manager: null }];
  const up = calcs.oo_upcoming.fn([ev('cory.g@x.test', 'Cory Gottlieb'), ev('jq@x.test'), ev('robot@x.test')], users);
  const by = (e) => up.find((r) => r.email === e);
  ok(by('cory.g@x.test').sfName === null && by('cory.g@x.test').name === 'Cory Gottlieb', 'integration user with the same email: not matched, calendar name kept', by('cory.g@x.test'));
  ok(by('jq@x.test').sfName === 'Jo Initials', 'a person whose email is initials still matches (they have a role)', by('jq@x.test'));
  ok(by('robot@x.test').sfName === 'Robot Account', 'a no-role user whose name matches the email still matches', by('robot@x.test'));

  // ----- calcs: what the last meeting covered -----
  const note = (meetingId, section, source, pos, extra) => ({ id: meetingId + pos, meetingId, meeting: 'Weekly 1:1', meetingAt: '2026-10-28T09:00:00Z', url: 'https://notes.granola.ai/d/' + meetingId, participants: 2, emails: 'me@x.test, boss@x.test', me: 'me@x.test', source, section, parentSection: '', pos, kind: 'bullet', depth: 0, gap: false, text: 't', ...(extra || {}) });
  const gr = [note('m1', 'Q4 hiring plan', 'summary', 0), note('m1', 'Q4 hiring plan', 'summary', 1), note('m1', 'Next steps', 'summary', 2), note('m1', 'Routing clean-up', 'summary', 3),
    note('m1', 'Private notes', 'private', 4), note('m1', 'Comp thoughts', 'private', 5),
    // an older meeting with the same person: not the last one
    note('m0', 'Old topic', 'summary', 0, { meetingAt: '2026-10-01T09:00:00Z' }),
    // many headings in another 1:1
    ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((h, i) => note('m2', h, 'summary', i, { emails: 'me@x.test, rep@x.test' }))];
  const fu = calcs.oo_followups.fn([], gr, [{ name: 'Boss Person', email: 'boss@x.test' }]);
  const lastBoss = fu.find((r) => r.email === 'boss@x.test' && r.kind === 'last');
  ok(lastBoss && lastBoss.topics === 'Q4 hiring plan\nRouting clean-up' && lastBoss.meetingId === 'm1', 'last time: summary headings in order, generic and private ones left out', lastBoss);
  const lastRep = fu.find((r) => r.email === 'rep@x.test' && r.kind === 'last');
  ok(lastRep.topics.split('\n').length === 6 && lastRep.topicsMore === 2, 'last time: at most six topics, the rest counted', lastRep);

  // ----- who they are to you, and the sections each agenda gets -----
  Object.assign(DATA, {
    sf_me: [{ userId: '005ME', name: 'Will Ops', email: 'me@x.test', role: 'REVOPS', manager: 'Boss Person', managerEmail: 'boss@x.test' }],
    users_all: [{ name: 'Boss Person', email: 'boss@x.test', role: 'REVOPS', manager: 'Big Boss' }, { name: 'Report One', email: 'rep@x.test', role: 'REVOPS', manager: 'Will Ops' },
      { name: 'Peer Ops', email: 'peer@x.test', role: 'REVOPS', manager: 'Big Boss' }, { name: 'Sales Lead', email: 'lead@x.test', role: 'DIR-SALES-EMEA', manager: 'VP' },
      { name: 'Japac Dir', email: 'japac@x.test', role: 'DIR-SALES-JAPAC', manager: 'X' }],
    oo_upcoming: [], oo_followups: fu, oo_points: [{ key: 'p1', email: 'lead@x.test', name: 'Sales Lead', section: 'numbers', sev: '', order: 0, text: 'Pipeline this quarter $1M across 3 opps.' },
      { key: 'p2', email: 'lead@x.test', name: 'Sales Lead', section: 'talk', sev: 'high', order: 1, text: '2 opps are past the close date.' }],
    oo_points_rr: [], oo_points_act: [], team_tree: [],
  });
  const sec = (k) => { const n = new Node('section'); n.dataset.ooSec = k; if (k !== 'sales') n.hidden = true; return n; };
  const S = { sales: [sec('sales'), sec('sales')], ops: [sec('ops'), sec('ops')], none: [sec('none')] };
  REG['[data-oo-sec]'] = [...S.sales, ...S.ops, ...S.none];
  const nt = (k) => { const n = new Node('p'); n.hidden = true; n.dataset.ooNote = k; return n; };
  const NOTES = { last: nt('last'), topics: nt('topics'), pick: nt('pick'), nobooking: nt('nobooking'), private: nt('private') };
  REG['[data-oo-note]'] = Object.values(NOTES);
  const shown = () => ({ sales: S.sales.every((n) => !n.hidden), ops: S.ops.every((n) => !n.hidden), none: !S.none[0].hidden });
  const pick = (email) => { params.ooWho = email; fire(); };
  const rel = () => { const e = new Node('span'); draws['oo-rel'](e); return e.textContent; };

  pick('boss@x.test');
  ok(JSON.stringify(shown()) === JSON.stringify({ sales: false, ops: true, none: false }), 'your manager: EMEA update and RevOps work, no sales sections', shown());
  ok(rel() === 'Your manager · RevOps', 'your manager: labelled', rel());
  ok(!NOTES.topics.hidden && !NOTES.last.hidden, 'your manager: last time and its topics show');
  const tp = list('oo-topics').map((li) => li.textContent);
  ok(JSON.stringify(tp) === JSON.stringify(['Q4 hiring plan', 'Routing clean-up']), 'topics list drawn', tp);
  params.region = 'France';
  const emea = list('oo-emea').map((li) => li.textContent), opsList = list('oo-ops');
  ok(emea.length === 2 && /^Pipeline this quarter: \$5M open/.test(emea[0]) && /^Created: 12 opps this week/.test(emea[1]), 'EMEA update: all of EMEA even with the scope pill on France', emea);
  const opsTxt = opsList.map((li) => li.textContent);
  ok(opsTxt.some((t) => /^Data checks outside Conversion: 2 open, 1 urgent/.test(t)) && opsTxt.some((t) => /^Stuck in stage: 7 deals/.test(t)) && opsTxt.some((t) => /^Account books: 4 orphan/.test(t)) && !opsTxt.some((t) => /My action items/.test(t)),
    'RevOps work: all EMEA checks, stuck deals and orphan accounts; no action items line', opsTxt);
  const goBtn = (li) => li.children.find((c) => c.tagName === 'BUTTON');
  const checksLi = opsList.find((li) => /^Data checks/.test(li.textContent));
  ok(goBtn(checksLi) && goBtn(checksLi).dataset.nav === 'actions' && goBtn(checksLi).dataset.navView === 'checks', 'RevOps work: each line opens its view', goBtn(checksLi) && goBtn(checksLi).dataset);
  const txt = OS.oo.text();
  ok(/\nFrom last time \(Weekly 1:1, 2026-10-28\)\n- Q4 hiring plan\n- Routing clean-up\n/.test(txt) && /\nEMEA update\n- Pipeline this quarter/.test(txt) && /\nRevOps work\n- Stuck in stage/.test(txt) && !/Comp thoughts|Private notes/.test(txt) && !/\nNumbers\n/.test(txt),
    'your manager: copied agenda has last time, EMEA update and RevOps work, nothing private', txt);
  params.region = 'All';

  pick('rep@x.test');
  ok(JSON.stringify(shown()) === JSON.stringify({ sales: false, ops: true, none: false }) && rel() === 'Reports to you · RevOps', 'your report: RevOps sections, labelled', [shown(), rel()]);
  pick('peer@x.test');
  ok(JSON.stringify(shown()) === JSON.stringify({ sales: false, ops: true, none: false }) && rel() === 'RevOps', 'RevOps colleague: RevOps sections', [shown(), rel()]);
  ok(NOTES.last.hidden && NOTES.topics.hidden, 'no meeting with them in Granola: no last time, no topics');
  pick('lead@x.test');
  ok(JSON.stringify(shown()) === JSON.stringify({ sales: true, ops: false, none: false }) && rel() === 'EMEA sales', 'EMEA sales leader: numbers and talking points only', [shown(), rel()]);
  const lt = OS.oo.text();
  ok(/\nNumbers\n- Pipeline this quarter \$1M/.test(lt) && /\nTalking points\n- 2 opps/.test(lt) && !/EMEA update|RevOps work/.test(lt), 'EMEA sales: copied agenda as before', lt);
  pick('japac@x.test');
  ok(JSON.stringify(shown()) === JSON.stringify({ sales: false, ops: false, none: true }) && rel() === 'Not in EMEA sales or RevOps', 'outside EMEA sales and RevOps: a plain note, nothing else', [shown(), rel()]);
  ok(!/EMEA update|Numbers|Talking points/.test(OS.oo.text()), 'outside: the copied agenda has notes only');

  // while the Salesforce points load, or when they couldn't load, the sales sections stay with their own messages
  STATE.oo_points = 'loading'; pick('japac@x.test');
  ok(JSON.stringify(shown()) === JSON.stringify({ sales: true, ops: false, none: false }), 'points loading: sales sections stay (skeleton), no note yet', shown());
  STATE.oo_points = 'error'; pick('boss@x.test');
  ok(JSON.stringify(shown()) === JSON.stringify({ sales: true, ops: true, none: false }), 'points failed: sales sections show their error; manager still gets RevOps sections', shown());
  delete STATE.oo_points;
  // without getUserInfo, RevOps colleagues are still found by role
  STATE.sf_me = 'error'; pick('boss@x.test');
  ok(shown().ops && rel() === 'RevOps', 'no getUserInfo: manager still found as RevOps by role', rel());
  delete STATE.sf_me;
  // a summary source that couldn't load is named, the rest still show
  STATE.risk_kpi = 'error'; pick('peer@x.test');
  const opsNa = list('oo-ops').map((li) => li.textContent);
  ok(opsNa.some((t) => t === "Stuck in stage: not available (couldn't load)") && opsNa.some((t) => /^Data checks/.test(t)), 'a failed source: its own line says so', opsNa);
  delete STATE.risk_kpi;
  // copying waits while a RevOps source loads
  const cb = new Node('button'); cb.dataset.copyAgenda = ''; REG['[data-copy-agenda], [data-ask-agenda]'] = [cb];
  STATE.act_kpi = 'loading'; pick('peer@x.test');
  ok(cb.disabled === true, 'RevOps agenda: Copy waits for the summary sources');
  delete STATE.act_kpi; fire();
  ok(cb.disabled === false, 'RevOps agenda: Copy enabled once they load');
  pick('lead@x.test'); STATE.act_kpi = 'loading'; fire();
  ok(cb.disabled === false, 'sales agenda: does not wait for the RevOps sources');
  delete STATE.act_kpi;


  // ===== review fixes (4 Nov 2026) =====
  // the user behind an email: row order doesn't matter; system users never match; ø/æ names and initials do
  const dup = [{ name: 'Pat Ops', email: 'pat.ops@x.test', role: 'REVOPS', manager: 'Boss', userId: '005B' }, { name: 'Zapier Integration', email: 'pat.ops@x.test', role: null, manager: null, userId: '005A' }];
  for (const order of [dup, dup.slice().reverse()]) {
    const u1 = calcs.oo_upcoming.fn([ev('pat.ops@x.test')], order)[0];
    ok(u1.sfName === 'Pat Ops', 'duplicate email: the person wins whatever the row order', [order.map((x) => x.name), u1.sfName]);
  }
  const fo = calcs.oo_upcoming.fn([ev('soren.ostergaard@x.test'), ev('mk@x.test')], [{ name: 'Søren Østergaard', email: 'soren.ostergaard@x.test', role: null, manager: null }, { name: 'Max Kowalski', email: 'mk@x.test', role: null, manager: null }]);
  ok(fo.every((r) => r.sfName), 'no role, no manager: Søren Østergaard and an initials email still match', fo.map((r) => r.sfName));
  // kind() uses the same rule: an integration user listed first doesn't hide a RevOps colleague
  DATA.users_all = DATA.users_all.concat([{ name: 'Zapier Integration', email: 'peer@x.test', role: null, manager: null }]).reverse();
  pick('peer@x.test');
  ok(rel() === 'RevOps' && shown().ops, 'duplicate email in users_all: still RevOps', [rel(), shown()]);
  DATA.users_all = DATA.users_all.filter((u) => u.name !== 'Zapier Integration').reverse();
  // no usable Salesforce user: said so, not "not in RevOps"
  pick('ghost@x.test');
  ok(rel() === 'Not in Salesforce', 'no active user with the email: labelled Not in Salesforce', rel());
  // getUserInfo loading: who is your manager is unknown, so no "notes only" note and Copy waits
  STATE.sf_me = 'loading'; pick('japac@x.test');
  ok(!shown().none && !/Not in EMEA/.test(rel()) && cb.disabled === true, 'getUserInfo loading: no "neither" claim, Copy waits', [shown(), rel(), cb.disabled]);
  // getUserInfo failed: you are found by your calendar's email, so your manager is still your manager
  STATE.sf_me = 'error';
  DATA.users_all = DATA.users_all.concat([{ name: 'Will Ops', email: 'me@x.test', role: 'REVOPS', manager: 'Boss Person' }]);
  DATA.cal_events = [{ id: 'c1', calendar: 'me@x.test', attendees: '' }];
  pick('boss@x.test');
  ok(rel() === 'Your manager · RevOps' && shown().ops, 'getUserInfo failed: the calendar email finds you, and your manager', rel());
  delete STATE.sf_me;
  // a sales viewer's report gets the sales sections only, not the all-EMEA RevOps work
  DATA.sf_me = [{ userId: '005M', name: 'Sales Mgr', email: 'me@x.test', role: 'MGR-SALES-EMEA', manager: 'VP', managerEmail: 'vp@x.test' }];
  DATA.users_all = DATA.users_all.concat([{ name: 'Seller One', email: 'seller@x.test', role: 'SMB-EMEA', manager: 'Sales Mgr' }]);
  DATA.oo_points = DATA.oo_points.concat([{ key: 'p9', email: 'seller@x.test', name: 'Seller One', section: 'numbers', sev: '', order: 0, text: 'Pipeline this quarter $10K across 1 opp.' }]);
  pick('seller@x.test');
  ok(rel() === 'Reports to you · EMEA sales' && !shown().ops && shown().sales && !/EMEA update|RevOps work/.test(OS.oo.text()), 'sales viewer: a report gets their numbers, no EMEA-wide RevOps sections', [rel(), shown()]);
  DATA.sf_me = [{ userId: '005ME', name: 'Will Ops', email: 'me@x.test', role: 'REVOPS', manager: 'Boss Person', managerEmail: 'boss@x.test' }];
  // the email link waits like Copy and Send
  const mail = () => { const box = new Node('span'); draws['oo-mail'](box); return box.children.length; };
  STATE.act_kpi = 'loading'; pick('peer@x.test');
  ok(mail() === 0, 'RevOps agenda: no email link while a summary source loads');
  delete STATE.act_kpi; fire();
  ok(mail() === 1, 'RevOps agenda: email link once everything loaded');
  // topics: action headings and the owner groups under them are follow-ups, not topics
  const gr2 = [note('m5', 'Pipeline review', 'summary', 0, { emails: 'me@x.test, peer@x.test' }), { ...note('m5', 'Will Ops', 'summary', 1, { emails: 'me@x.test, peer@x.test' }), parentSection: 'Next steps' },
    note('m5', 'Action points', 'summary', 2, { emails: 'me@x.test, peer@x.test' }), note('m5', 'Agreed next steps', 'summary', 3, { emails: 'me@x.test, peer@x.test' }), note('m5', 'Questions discussed', 'summary', 4, { emails: 'me@x.test, peer@x.test' })];
  const tp2 = calcs.oo_followups.fn([], gr2, []).find((r) => r.kind === 'last');
  ok(tp2.topics === 'Pipeline review\nQuestions discussed', 'topics: no action headings or owner groups under them', tp2.topics);
  // RevOps work: nothing to raise, nothing listed; the empty message can show; dots follow the counts
  Object.assign(DATA, { rr_kpi: [{ region: 'All', missing: 0, weekOne: 0 }], checks: [], risk_kpi: [{ region: 'All', stuck: 0, stuckArr: 0 }], orphan_kpi: [{ accounts: 0, arr: 0, splitBooks: 0 }] });
  pick('peer@x.test');
  ok(OS.oo.ops('talk').length === 0, 'RevOps work: zero routing gaps, checks and orphans are left out', OS.oo.ops('talk'));
  const em = new Node('ul'); em.dataset.draw = 'oo-ops'; draws['oo-ops'](em);
  const slot = new Node('span'); slot.dataset.draw = 'msg'; slot.dataset.for = 'oo-ops';
  const emptyP = new Node('p'); emptyP.hidden = true; emptyP.dataset.msgFor = 'oo-ops'; emptyP.dataset.msg = 'empty';
  REG['[data-msg-for]'] = [emptyP]; draws.msg(slot); delete REG['[data-msg-for]'];
  ok(emptyP.hidden === false, 'RevOps work: "Nothing open" shows when there is nothing to raise');
  Object.assign(DATA, { rr_kpi: [{ region: 'All', missing: 0, weekOne: 2 }], checks: [{ id: 'c3', area: 'Books', severity: 'low', title: 'B', what: 'y', region: 'DACH', manager: 'M2' }] });
  const dots = list('oo-ops').map((li) => [li.textContent.split(':')[0], li.children[0].className]);
  // the RevOps work's checks line names what it counts: every area but Conversion (4 Nov 2026, second review)
  ok(JSON.stringify(dots) === JSON.stringify([['Routing', 'itm-dot low'], ['Data checks outside Conversion', 'itm-dot medium']]), 'RevOps work: joiners only is low, checks with none urgent medium', dots);
  // the links open their view for all of EMEA
  params.region = 'France';
  const goEl = list('oo-ops')[1].children.find((c) => c.tagName === 'BUTTON');
  const evNav = { target: { closest: () => goEl }, preventDefault() {} };
  goEl.matches = (sel) => sel === '[data-nav]'; goEl.closest = () => goEl;
  for (const h of handlers) h(evNav);
  ok(params.region === 'All' && params.checkArea === 'All', 'RevOps work link: opens Data checks for all of EMEA and every area', [params.region, params.checkArea]);
  // switching views back to Agendas refreshes the sections without new data
  // (the link above went to Action items; coming back through the 1:1s tab, as a viewer would)
  const vt = new Node('button'); vt.dataset.nav = 'oneonone'; vt.dataset.navView = 'upcoming'; vt.matches = (sel) => sel === '[data-nav]'; vt.closest = () => vt;
  STATE.oo_points = 'loading'; params.ooWho = 'japac@x.test';
  for (const h of handlers) h({ target: { closest: () => vt }, preventDefault() {} });
  ok(shown().sales && !shown().none, 'back on Agendas: sections follow the data at once (points loading)', shown());
  delete STATE.oo_points;
  for (const h of handlers) h({ target: { closest: () => vt }, preventDefault() {} });
  ok(!shown().sales && shown().none, 'back on Agendas: and again once loaded, with no new data event', shown());
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
}, 0);
