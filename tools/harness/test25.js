// Activity (wave 7): real calcs and drawings over the saved, tested answers of 3 Nov 2026. Prints counts and labels only.
const { Node } = require('./fakedom.js');
{ const RealDate = Date; const off = Date.parse(process.env.NOW || '2026-11-03T16:00:00Z') - RealDate.now(); global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [RealDate.now() + off])); } static now() { return RealDate.now() + off; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const fs = require('fs'), path = require('path');
const S = path.join(__dirname, '..');
const calcs = {}, draws = {};
let params = { region: 'All', mgr: '', person: '', checkArea: 'All', actRole: '', actLook: false, actLeft: false, ooWho: '' };
const DATA = {}, STATE = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; }, onData: () => {}, colors: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'], setLink: () => {},
  data: (id) => (STATE[id] ? { status: STATE[id], data: [] } : id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: (f) => (v) => (f === '.1f' ? (+v).toFixed(1) : f === '.0%' ? Math.round(v * 100) + '%' : f === ',' ? Math.round(v).toLocaleString('en') : String(v)), max: (a, f) => Math.max(...a.map(f)) };
const sent = [];
global.claude = { use: async (n) => (n === 'room' ? { canSendToClaudeSession: async () => 'available', sendToClaudeSession: (d) => { sent.push(d); return Promise.resolve({}); } } : null) };
const handlers = []; document.addEventListener = (ev, fn) => { if (ev === 'click') handlers.push(fn); };
let copied = null; Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: (t) => { copied = t; return Promise.resolve(); } } }, configurable: true, writable: true });
require('/home/user/revopsemeaos/dashboard/os-core.js'); require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js'); require('/home/user/revopsemeaos/dashboard/os-draw.js');
let fails = 0; const ok = (c, l, x) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const rec = (f) => { const j = JSON.parse(fs.readFileSync(path.join(S, f), 'utf8')); return (j.records || j).map(({ attributes, ...r }) => r); };
// the roster with made-up user Ids (the saved roster has none)
const roster = rec('act/roster.json').map((u, i) => ({ ...u, userId: '005TEST' + String(i).padStart(11, '0') }));
Object.assign(DATA, { act_mail: rec('act-final/act_mail.json'), act_mail_prev: rec('act-final/act_mail_prev.json'), act_meet: rec('act-final/act_meet.json'), act_meet_prev: rec('act-final/act_meet_prev.json'), roster, cr_bdr: rec('activity-design/cr_bdr.json'),
  sf_me: [{ userId: '005TESTME', name: 'Rev Ops', timeZone: 'America/Los_Angeles' }] }); // the tester's zone, as when the answers were saved
const run = (id) => { DATA[id] = calcs[id].fn(...calcs[id].inputs.map((i) => DATA[i])); return DATA[id]; };
run('cr_bdrs');
const act = roster.filter((u) => u.isActive !== false), mgrs = new Set(act.map((u) => u.manager)), names = new Set(act.map((u) => u.name));
DATA.team_tree = act.map((u, i) => ({ name: u.name, email: 'p' + i + '@x.test', manager: u.manager, isLeader: mgrs.has(u.name), region: 'x' })).concat([...mgrs].filter((x) => x && !names.has(x)).map((x, i) => ({ name: x, email: 'm' + i + '@x.test', manager: null, isLeader: true })));
DATA.books_owner = [];
for (const id of ['act_reps', 'act_ranges', 'act_kpi', 'act_trust', 'team_act', 'act_bdr', 'checks_act', 'oo_points_act']) run(id);
DATA.checks = []; DATA.checks_rr = []; DATA.checks_hb = []; DATA.checks_lv = []; DATA.checks_ld = []; DATA.checks_ld_rt = []; DATA.checks_ld_cap = [];
DATA.oo_points = []; DATA.oo_points_rr = [];
const trs = (el) => { const out = []; const walk = (n) => { for (const c of n.children) { if (c.tagName === 'TR' || c.tagName === 'LI') out.push(c); else walk(c); } }; walk(el); return out; };
const tbl = (name) => { const el = new Node('tbody'); el.dataset.draw = name; draws[name](el); return trs(el); };
const cells = (tr) => tr.children.map((td) => td.textContent);
const asks = (el) => { const out = []; const walk = (n) => { if (n.dataset && n.dataset.ask) out.push(JSON.parse(n.dataset.ask)); n.children.forEach(walk); }; walk(el); return out; };
const tileEl = (draw, field, extra) => { const el = new Node('b'); el.dataset.draw = draw; el.dataset.source = 'act_kpi'; el.dataset.field = field; Object.assign(el.dataset, extra || {}); if (extra && extra.warn) el.attrs['data-warn'] = ''; draws[draw](el); return el; };
const tile = (field, extra) => tileEl('kpi-act', field, extra).textContent;
const size = (o) => new TextEncoder().encode(JSON.stringify(o)).length;
const GUARD = /Counts only, by week and by customer or prospect: no names of people or companies outside Legora/;
setTimeout(() => {
  // ----- calcs -----
  const R = DATA.act_reps, all = DATA.act_kpi.find((r) => r.region === 'All');
  ok(R.length === 143, 'act_reps 143 rows', R.length);
  ok(all.meetings === 4517 && all.meetCust === 1544 && all.booked === 1257 && all.emails === 31724, 'All: 4,517 meetings, 1,544 customer, 1,257 booked, 31,724 emails', [all.meetings, all.meetCust, all.booked, all.emails]);
  ok(all.needLook === 22 && all.checkCapture === 7 && all.quiet === 1 && all.slowing === 9 && all.nothingBooked === 10 && all.belowRange === 5, 'flags: 22 need a look, 7 check capture', [all.needLook, all.checkCapture]);
  ok(R.every((r) => r.userId), 'every activity row carries the roster user Id');
  ok(DATA.checks_act.length === 7 && DATA.checks_act.every((c) => c.area === 'Activity' && c.userId && c.view === 'activity'), '7 activity checks with user Ids', DATA.checks_act.length);
  ok(DATA.oo_points_act.every((p) => p.order >= 2e6 && p.act === true), 'agenda points order after core and routing, marked act');
  ok(R.every((r) => r.trendNote == null || !/Invalid|NaN|Infinity/.test(r.trendNote)), 'trend notes are clean');
  // ----- tiles -----
  ok(tile('meetings') === '4,517', 'tile meetings 4,517', tile('meetings'));
  ok(tile('meetPerSellerWk', { fmt: 'wk' }) === '9.6', 'per seller a week 9.6', tile('meetPerSellerWk', { fmt: 'wk' }));
  const lfl = tileEl('kpi-act-lfl', 'meetChg').textContent;
  ok(lfl === '−2% like-for-like (87 people)', 'like-for-like meetings: current sellers only (87)', lfl);
  ok(/like-for-like \(89 people\)/.test(tileEl('kpi-act-lfl', 'emailsChg').textContent), 'like-for-like emails (89 people: no leaver or capture gap among them)', tileEl('kpi-act-lfl', 'emailsChg').textContent);
  ok(R.every((r) => (!r.cmpMeet || (r.active && !r.calOff && !r.flags.includes('No capture'))) && (!r.cmpMail || (r.active && !r.mailOff && !r.flags.includes('No capture')))), 'no one who left or whose capture looks off is compared');
  ok(R.filter((r) => !r.active && r.status === 'Left').every((r) => r.coreChg == null && r.meetChg == null && r.emailsChg == null), 'people who left carry no change');
  const look = tileEl('kpi-act', 'needLook', { warn: '1' });
  ok(look.textContent === '22' && look.classList.contains('os-warn'), 'need a look 22, amber', [look.textContent, look.className]);
  params.region = 'BDR';
  ok(tile('meetings') === '450', 'BDR scope: 450 meetings', tile('meetings'));
  params.region = 'All';
  const bt = tileEl('kpi-act', 'meetPros', { team: 'BDR' });
  ok(bt.dataset.where === 'region=BDR', 'data-team tile marks the BDR row', bt.dataset.where);
  params.mgr = 'Nobody At All';
  ok(tile('meetings') === '—', 'a manager with no activity row shows —', tile('meetings'));
  params.mgr = '';
  // ----- people table -----
  let t = tbl('act-table');
  ok(t.length === 139, 'people: 139 rows (people who left hidden)', t.length);
  params.actLeft = true; ok(tbl('act-table').length === 143, 'show people who left: 143', tbl('act-table').length); params.actLeft = false;
  params.actLook = true; t = tbl('act-table'); ok(t.length === 22, 'needs a look: 22', t.length); params.actLook = false;
  params.actRole = 'BDR'; t = tbl('act-table'); ok(t.length > 0 && t.every((tr) => cells(tr)[2] === 'BDR'), 'role chip BDR', t.length); params.actRole = '';
  params.region = 'SMB'; t = tbl('act-table'); ok(t.length > 0 && t.every((tr) => cells(tr)[1] === 'SMB'), 'scope SMB', t.length); params.region = 'All';
  t = tbl('act-table');
  const quiet = t.find((tr) => cells(tr)[13] === 'Quiet');
  ok(quiet && quiet.children[13].children[0].className === 'chip bad', 'Quiet row has a red chip', quiet && quiet.children[13].children.map((c) => c.className));
  const active = t.find((tr) => R.find((r) => r.name === tr.dataset.key).status === 'Active');
  ok(active && active.children[13].children.length === 0, 'Active rows have no chip', active && active.children[13].children.length);
  ok(t.filter((tr) => cells(tr)[13] === 'Check capture').length === 7, '7 Check capture rows');
  const el = new Node('tbody'); draws['act-table'](el);
  const A = asks(el);
  ok(A.length > 130 && A.every((a) => a.kind === 'activity' && size(a) <= 3900 && !/@/.test(a.ask)), 'asks: kind activity, under 4 KB, no emails', A.length);
  ok(A.filter((a) => /^Prep 1:1 on activity/.test(a.label)).every((a) => GUARD.test(a.ask) && /OwnerId = 005TEST/.test(a.ask)), 'prep asks carry the guard and the OwnerId');
  ok(A.filter((a) => /^Draft a check-in/.test(a.label)).length === 1 && A.filter((a) => /^Draft a check-in/.test(a.label)).every((a) => /wait for my OK before sending/.test(a.ask)), 'one check-in draft, waits for OK');
  ok(A.filter((a) => /^Check capture/.test(a.label)).length === 7 && A.filter((a) => /^Check capture/.test(a.label)).every((a) => GUARD.test(a.ask)), '7 capture asks with the guard');
  ok(A.filter((a) => /^Plan the next 2 weeks/.test(a.label)).length === 9, '9 nothing-booked plans (status picks one flag)', A.filter((a) => /^Plan the next 2 weeks/.test(a.label)).length);
  // the copy text has the header row and every row
  const copyText = OS.tableText('act-table');
  ok(copyText.split('\n').length === 140, 'copy table: header + 139 rows', copyText.split('\n').length);
  // ----- Monday summary -----
  const mb = new Node('span'); draws['act-monday'](mb);
  const ma = asks(mb)[0];
  ok(ma && /Monday summary/.test(ma.label) && /quiet: /.test(ma.ask) && size(ma) <= 3900 && mb.children[0].className.includes('btn'), 'Monday summary button', ma && ma.label);
  // ----- ranges, trust -----
  const rg = tbl('act-range-table');
  ok(rg.length === 4 && cells(rg[0])[2].startsWith('3.1–14.4 (9.3)'), 'ranges: AE role meetings 3.1–14.4 (9.3)', rg.length && cells(rg[0]));
  const tl = new Node('ul'); draws['act-trust-list'](tl);
  ok(trs(tl).length === 6 && asks(tl).length === 6 && asks(tl).every((a) => GUARD.test(a.ask)), 'trust list: 6 checks, each with a guarded ask', trs(tl).length);
  // ----- BDRs -----
  const bd = tbl('act-bdr-table');
  ok(bd.length === DATA.act_bdr.length && bd.length === 17, 'BDR table 17 rows', bd.length);
  const kb = (k) => { const e = new Node('b'); e.dataset.draw = 'kpi-act-bdr'; e.dataset.source = 'act_bdr'; e.dataset.k = k; draws['kpi-act-bdr'](e); return e.textContent; };
  ok(/^\d[\d,]*$/.test(kb('people')) && /^\d+\.\d$/.test(kb('per100')), 'BDR tiles: people emailed and meetings per 100', [kb('people'), kb('per100')]);
  const kc = (k) => { const e = new Node('b'); e.dataset.draw = 'kpi-cr-bdr'; e.dataset.source = 'cr_bdrs'; e.dataset.k = k; draws['kpi-cr-bdr'](e); return e.textContent; };
  ok(kc('thisOpps') === '511' && kc('lastOpps') === '752', 'sourced 511 this quarter, 752 last', [kc('thisOpps'), kc('lastOpps')]);
  const pb = new Node('span'); draws['act-bdr-plan'](pb);
  ok(asks(pb).length === 1 && /weeks to quarter end/.test(asks(pb)[0].ask), 'Plan BDR capacity button');
  // ----- checks -----
  const ck = OS.checkRows().filter((c) => c.area === 'Activity');
  ok(ck.length === 7, 'data checks include 7 activity rows', ck.length);
  const cl = new Node('ul'); draws['check-list'](cl);
  const cA = asks(cl).filter((a) => a.area === 'Activity');
  ok(cA.length === 7 && cA.every((a) => GUARD.test(a.ask) && /OwnerId = 005TEST/.test(a.ask)), 'activity check asks carry the guard and OwnerId', cA.length);
  const hc = new Node('ul'); draws['home-checks'](hc);
  ok(trs(hc).length === 2, 'Home shows at most 2 activity checks', trs(hc).length);
  // ----- agendas -----
  const seller = R.find((r) => r.status === 'Quiet');
  const tt = DATA.team_tree.find((x) => x.name === seller.name);
  const pts = OS.oo.points(tt.email);
  ok(pts.some((p) => p.section === 'numbers' && /^Activity, last 4 weeks/.test(p.text)) && pts.some((p) => p.section === 'talk' && p.sev === 'high'), 'quiet seller agenda: activity numbers and an urgent point');
  params.ooWho = tt.email;
  const talkEl = new Node('ul'); draws['oo-talk'](talkEl);
  const tA = asks(talkEl);
  ok(tA.length >= 1 && tA.every((a) => GUARD.test(a.ask)), 'activity talking points ask for counts with the guard', tA.length);
  ok(/Activity, last 4 weeks/.test(OS.oo.text()), 'copied agenda includes the activity numbers');
  params.ooWho = '';
  // ----- team scorecard -----
  const lead = DATA.team_tree.filter((x) => x.isLeader).sort((a, b) => DATA.team_tree.filter((y) => y.manager === b.name).length - DATA.team_tree.filter((y) => y.manager === a.name).length)[0];
  params.ooRoot = lead.name; DATA.team_rr = []; DATA.sf_me = [];
  const st = tbl('oo-team-table');
  ok(st.length > 0 && st.every((tr) => tr.children.length === 17), 'scorecard rows have 17 cells', st.length && st[0].children.length);
  const ta = new Node('b'); ta.dataset.draw = 'kpi-team-act'; ta.dataset.source = 'team_act'; ta.dataset.field = 'actMeetings'; draws['kpi-team-act'](ta);
  ok(/^\d[\d,]*$/.test(ta.textContent) && ta.dataset.where === 'name=' + encodeURIComponent(lead.name), 'scorecard tile: leader\'s team meetings', [ta.textContent, ta.dataset.where]);
  STATE.team_act = 'error';
  const st2 = tbl('oo-team-table');
  ok(st2.every((tr) => cells(tr).slice(10, 15).every((x) => x === '—')), 'activity columns show — when team_act fails');
  delete STATE.team_act;
  // ----- person panel -----
  params.person = seller.name;
  DATA.person = [{ name: seller.name, isActive: true, inRoster: true, emCustomers: 0 }]; DATA.person_hb = []; DATA.rr_people = []; DATA.people = [];
  const chips = new Node('div'); draws['pd-chips'](chips);
  ok(chips.children.some((c) => /^Quiet \d+ business days$/.test(c.textContent) && /bad/.test(c.className)), 'person chips: Quiet with business days', chips.children.map((c) => c.textContent));
  const pm = new Node('dd'); pm.dataset.draw = 'pd-act-meet'; pm.dataset.source = 'act_reps'; pm.dataset.f = 'meetings'; draws['pd-act-meet'](pm);
  ok(/^\d+ \(\d+ customer · \d+ prospect\)$/.test(pm.textContent) && pm.dataset.where === 'name=' + encodeURIComponent(seller.name), 'person meetings line', pm.textContent);
  const pc = new Node('dd'); pc.dataset.draw = 'pd-act-chg'; pc.dataset.source = 'act_reps'; pc.dataset.f = 'coreChg'; draws['pd-act-chg'](pc);
  ok(pc.textContent && !/undefined|NaN/.test(pc.textContent), 'person change line', pc.textContent);
  const pa = new Node('span'); DATA.users_all = []; DATA.leavers_core = []; draws['pd-act'](pa);
  ok(asks(pa).some((a) => /selling activity in the last 4 weeks \(counts only/.test(a.ask)), 'About sparkle mentions activity, counts only');
  params.person = '';
  // ----- weekly summary line -----
  const press = () => { copied = null; const btn = new Node('button'); btn.dataset.copySummary = ''; btn.matches = (sel) => sel === '[data-copy-summary]'; btn.closest = () => btn; const ev = { target: { closest: () => btn }, preventDefault() {} }; for (const h of handlers) h(ev); return copied; };
  const sum = press() || '';
  ok(/• Activity, last 4 weeks: 4,517 external meetings \(1,544 with customers\), 1,257 booked for the next 2 weeks, 31,724 emails sent; meetings −2% like-for-like \(87 people compared\); 1 quiet, 9 slowing, 10 with nothing booked, 7 with nothing captured/.test(sum), 'weekly summary Activity line', sum.split('\n').find((l) => /Activity/.test(l)));
  STATE.act_kpi = 'error';
  ok(/• Activity: not available \(couldn't load\)/.test(press() || ''), 'summary says when activity failed');
  delete STATE.act_kpi;
  // ----- access guard: meetings but no captured emails -----
  const save = { act_mail: DATA.act_mail, act_mail_prev: DATA.act_mail_prev };
  DATA.act_mail = []; DATA.act_mail_prev = [];
  for (const id of ['act_reps', 'act_ranges', 'act_kpi', 'act_trust', 'checks_act']) run(id);
  ok(DATA.act_reps[0].mailHidden === true, 'no captured emails: mailHidden');
  ok(tile('emails') === '—' && tileEl('kpi-act-lfl', 'emailsChg').textContent === 'not visible with your access', 'emails tile — and not visible', [tile('emails'), tileEl('kpi-act-lfl', 'emailsChg').textContent]);
  const acc = new Node('span'); draws['act-access'](acc);
  ok(/almost no captured emails/.test(acc.textContent) && /no one is flagged Quiet/.test(acc.textContent), 'access note text', acc.textContent);
  ok(DATA.act_reps.every((r) => !r.flags.includes('Quiet')), 'emails hidden: no one is Quiet', DATA.act_reps.filter((r) => r.flags.includes('Quiet')).length);
  ok(DATA.checks_act.some((c) => c.id === 'act:vis'), 'hidden-by-access check');
  ok(DATA.checks_act.filter((c) => c.id.startsWith('act:none:')).every((c) => /emails not visible with your access/.test(c.what)), 'capture checks say emails are hidden', DATA.checks_act.filter((c) => c.id.startsWith('act:none:')).map((c) => c.what));
  Object.assign(DATA, save);
  for (const id of ['act_reps', 'act_ranges', 'act_kpi', 'act_trust', 'checks_act']) run(id);
  // ----- loading and failure -----
  STATE.act_reps = 'loading';
  ok(tbl('act-table').length === 0, 'people table empty while loading');
  STATE.act_reps = 'error'; const acc2 = new Node('span'); draws['act-access'](acc2); ok(acc2.textContent === '', 'access note empty on error'); delete STATE.act_reps;
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
}, 30);
