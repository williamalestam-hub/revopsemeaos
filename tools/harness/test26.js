// Activity, wave 7 review fixes: partial access (emails hidden, meetings hidden, most sellers hidden), the access note
// shown by onData, the Salesforce time-zone anchor, BDR stubs, the EM book line and the agenda's empty message.
// Real calcs and drawings over the saved answers of 3 Nov 2026. Prints counts and labels only.
const { Node } = require('./fakedom.js');
let NOW = Date.parse('2026-11-03T16:00:00Z');
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const fs = require('fs'), path = require('path');
const S = path.join(__dirname, '..');
const calcs = {}, draws = {}, onData = [];
let params = { region: 'All', mgr: '', person: '', checkArea: 'All', actRole: '', actLook: false, actLeft: false, ooWho: '' };
const DATA = {}, STATE = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; }, onData: (fn) => { onData.push(fn); }, colors: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'], setLink: () => {},
  data: (id) => (STATE[id] ? { status: STATE[id], data: [] } : id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: (f) => (v) => (f === '.1f' ? (+v).toFixed(1) : f === '.0%' ? Math.round(v * 100) + '%' : f === ',' ? Math.round(v).toLocaleString('en') : String(v)), max: (a, f) => Math.max(...a.map(f)) };
global.claude = { use: async (n) => (n === 'room' ? { canSendToClaudeSession: async () => 'available', sendToClaudeSession: () => Promise.resolve({}) } : null) };
// the page opens on 1:1s › Activity; querySelectorAll answers from REG
global.location.hash = '#oneonone-activity';
const REG = {};
document.querySelector = (sel) => (sel === '[data-view-panel="oneonone:activity"]' ? new Node('div') : null);
document.querySelectorAll = (sel) => REG[sel] || [];
const handlers = []; document.addEventListener = (ev, fn) => { if (ev === 'click') handlers.push(fn); };
let copied = null; Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: (t) => { copied = t; return Promise.resolve(); } } }, configurable: true, writable: true });
require('/home/user/revopsemeaos/dashboard/os-core.js'); require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js'); require('/home/user/revopsemeaos/dashboard/os-draw.js');
let fails = 0; const ok = (c, l, x) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const rec = (f) => { const j = JSON.parse(fs.readFileSync(path.join(S, f), 'utf8')); return (j.records || j).map(({ attributes, ...r }) => r); };
const roster = rec('act/roster.json').map((u, i) => ({ ...u, userId: '005TEST' + String(i).padStart(11, '0') }));
const SAVED = { act_mail: rec('act-final/act_mail.json'), act_mail_prev: rec('act-final/act_mail_prev.json'), act_meet: rec('act-final/act_meet.json'), act_meet_prev: rec('act-final/act_meet_prev.json') };
const LA = [{ userId: '005TESTME', name: 'Rev Ops', timeZone: 'America/Los_Angeles' }];
// a Salesforce zone with no lag on this machine's clock, so the note checks here are about access only (test27 covers the lag)
Object.assign(DATA, SAVED, { roster, cr_bdr: rec('activity-design/cr_bdr.json'), sf_me: [{ ...LA[0], timeZone: 'Europe/Paris' }], books_owner: [] });
const act = roster.filter((u) => u.isActive !== false), mgrs = new Set(act.map((u) => u.manager)), names = new Set(act.map((u) => u.name));
DATA.team_tree = act.map((u, i) => ({ name: u.name, email: 'p' + i + '@x.test', manager: u.manager, isLeader: mgrs.has(u.name), region: 'x' })).concat([...mgrs].filter((x) => x && !names.has(x)).map((x, i) => ({ name: x, email: 'm' + i + '@x.test', manager: null, isLeader: true })));
for (const id of ['checks', 'checks_rr', 'checks_hb', 'checks_lv', 'checks_ld', 'checks_ld_rt', 'checks_ld_cap', 'oo_points', 'oo_points_rr']) DATA[id] = [];
const run = (id) => { DATA[id] = calcs[id].fn(...calcs[id].inputs.map((i) => DATA[i])); return DATA[id]; };
const ACT = ['act_reps', 'act_ranges', 'act_kpi', 'act_trust', 'team_act', 'act_bdr', 'checks_act', 'oo_points_act'];
const runAll = () => { for (const id of ACT) run(id); };
run('cr_bdrs'); runAll();
const trs = (el) => { const out = []; const walk = (n) => { for (const c of n.children) { if (c.tagName === 'TR' || c.tagName === 'LI') out.push(c); else walk(c); } }; walk(el); return out; };
const tbl = (name) => { const el = new Node('tbody'); el.dataset.draw = name; draws[name](el); return trs(el); };
const cells = (tr) => tr.children.map((td) => td.textContent);
const asks = (el) => { const out = []; const walk = (n) => { if (n.dataset && n.dataset.ask) out.push(JSON.parse(n.dataset.ask)); n.children.forEach(walk); }; walk(el); return out; };
const tileEl = (draw, field, extra) => { const el = new Node('b'); el.dataset.draw = draw; el.dataset.source = 'act_kpi'; el.dataset.field = field; Object.assign(el.dataset, extra || {}); draws[draw](el); return el; };
const tile = (field) => tileEl('kpi-act', field).textContent;
const press = () => { copied = null; const btn = new Node('button'); btn.dataset.copySummary = ''; btn.matches = (sel) => sel === '[data-copy-summary]'; btn.closest = () => btn; const ev = { target: { closest: () => btn }, preventDefault() {} }; for (const h of handlers) h(ev); return copied || ''; };
const actLine = () => press().split('\n').find((l) => /Activity/.test(l)) || '';
const monday = () => { const mb = new Node('span'); draws['act-monday'](mb); return (asks(mb)[0] || {}).ask || ''; };
const note = new Node('p'); note.hidden = true; note.dataset.actAccess = 'oneonone:activity'; note.dataset.ctx = 'activity'; REG['[data-act-access]'] = [note];
const fire = () => onData.forEach((fn) => fn());
const quietN = () => DATA.act_reps.filter((r) => r.flags.includes('Quiet')).length;
const pts = (name) => { const t = DATA.team_tree.find((x) => x.name === name); return t ? OS.oo.points(t.email) : []; };
setTimeout(() => {
  // ----- full access: nothing hidden, the note stays hidden -----
  fire();
  ok(note.hidden === true, 'full access: the access note stays hidden');
  const base = DATA.act_reps.map((r) => [r.name, r.idle, r.cmpMeet, r.cmpMail, r.status].join('|')).join('\n');
  const baseKpi = DATA.act_kpi.find((r) => r.region === 'All');
  ok(baseKpi.notVisible === 0 && baseKpi.quiet === 1 && baseKpi.needLook === 22, 'full access: 0 hidden, 1 quiet, 22 need a look', [baseKpi.notVisible, baseKpi.quiet, baseKpi.needLook]);
  // ----- emails hidden -----
  DATA.act_mail = []; DATA.act_mail_prev = []; runAll(); fire();
  ok(DATA.act_reps[0].mailHidden && note.hidden === false, 'emails hidden: onData shows the access note', [DATA.act_reps[0].mailHidden, note.hidden]);
  ok(quietN() === 0, 'emails hidden: no one is Quiet', quietN());
  ok(DATA.act_reps.filter((r) => r.status !== 'Left').every((r) => r.emails == null && r.lastMail == null && r.emailsPrev == null), 'emails hidden: email fields blank');
  ok(DATA.act_reps.every((r) => r.lastTouch == null || r.lastTouch === r.lastMeet), 'emails hidden: last activity is the last meeting');
  ok(/emails not visible with your access/.test(actLine()) && !/quiet/.test(actLine()) && /nothing booked/.test(actLine()), 'emails hidden: summary names it and drops the Quiet count', actLine());
  ok(/no one can be flagged Quiet/.test(monday()), 'emails hidden: Monday summary says so');
  // ----- meetings hidden -----
  Object.assign(DATA, { act_mail: SAVED.act_mail, act_mail_prev: SAVED.act_mail_prev, act_meet: [], act_meet_prev: [] }); runAll(); fire();
  const g = DATA.act_reps[0];
  ok(g.meetHidden && !g.mailHidden && note.hidden === false, 'meetings hidden: detected, note shown', [g.meetHidden, note.hidden]);
  ok(quietN() === 0, 'meetings hidden: no one is Quiet', quietN());
  ok(DATA.act_ranges.every((x) => x.coreWk25 == null && x.meetWk25 == null) && DATA.act_ranges.some((x) => x.emailsWk25 != null), 'meetings hidden: no meeting range, email ranges kept', DATA.act_ranges.map((x) => [x.kind, x.coreWk25]));
  ok(tbl('act-range-table').every((tr) => cells(tr)[2].startsWith('—')), 'meetings hidden: range table shows —');
  ok(tile('meetings') === '—' && tileEl('kpi-act-lfl', 'meetChg').textContent === 'not visible with your access', 'meetings hidden: tiles', [tile('meetings'), tileEl('kpi-act-lfl', 'meetChg').textContent]);
  ok(/Activity, last 4 weeks: meetings not visible with your access, 31,724 emails sent; \d+ slowing, \d+ with no sent email captured$/.test(actLine()), 'meetings hidden: summary, no quiet or nothing-booked counts', actLine());
  ok(DATA.team_act.every((t) => t.actMeetings == null && t.actFlags == null), 'meetings hidden: scorecard meetings blank');
  const seller = DATA.act_reps.find((r) => r.active && r.kind === 'AE' && r.emails > 0);
  const sp = pts(seller.name).filter((p) => p.section === 'numbers').map((p) => p.text);
  ok(sp.some((t) => /^Activity, last 4 weeks: meetings not visible with your access and \d/.test(t)) && !sp.some((t) => /Usual for|0 external meetings/.test(t)), 'meetings hidden: agenda numbers say so, no usual range', sp);
  params.person = seller.name;
  const dd = (draw, f) => { const e = new Node('dd'); e.dataset.draw = draw; e.dataset.source = 'act_reps'; e.dataset.f = f; draws[draw](e); return e.textContent; };
  ok(dd('pd-act-meet', 'meetings') === 'not visible with your access' && dd('pd-act-usual', 'coreWk') === '—' && dd('pd-act-chg', 'coreChg') === 'not visible with your access', 'meetings hidden: person panel', [dd('pd-act-meet', 'meetings'), dd('pd-act-usual', 'coreWk'), dd('pd-act-chg', 'coreChg')]);
  params.person = '';
  // ----- most sellers hidden (the viewer sees France and BDR activity only) -----
  const keep = new Set(roster.filter((u) => /^(AE-EMEA-FR|BDR-EMEA)$/.test(u.role || '')).map((u) => u.name));
  for (const k of Object.keys(SAVED)) DATA[k] = SAVED[k].filter((r) => keep.has(r.owner));
  runAll(); fire();
  const L = DATA.act_reps, all = DATA.act_kpi.find((r) => r.region === 'All'), fr = DATA.act_kpi.find((r) => r.region === 'France');
  ok(L[0].limited && note.hidden === false, 'limited: detected, note shown', [L[0].limited, L[0].visibleSellers, L[0].sellers]);
  const nv = L.filter((r) => r.status === 'Not visible');
  ok(nv.length > 50 && nv.every((r) => r.meetings == null && r.emails == null && r.booked == null && r.coreWk == null && r.lastTouch == null), 'limited: Not visible rows are blank, not zero', nv.length);
  const nvRow = tbl('act-table').find((tr) => nv.some((r) => r.name === tr.dataset.key));
  ok(nvRow && [3, 4, 5, 7, 8, 9, 11].every((i) => cells(nvRow)[i] === '—'), 'limited: their table cells show —', nvRow && cells(nvRow));
  // France is fully visible: its only Not visible sellers are the ones with nothing captured at all (No capture or New with full access)
  const frBlank = DATA.act_reps.filter((r) => r.region === 'France' && r.status === 'Not visible').map((r) => r.name);
  ok(all.notVisible === nv.filter((r) => r.kind !== 'Leader').length && fr.notVisible === frBlank.length && fr.notVisible < fr.sellers, 'limited: sellers with no visible activity counted per scope', [all.notVisible, fr.notVisible, fr.sellers]);
  ok(/shows no activity for \d+ of the \d+ sellers, so these may be partial\)$/.test(actLine()), 'limited: summary says it may be partial', actLine());
  ok(/My Salesforce access shows no activity for \d+ of the \d+ sellers here/.test(monday()), 'limited: Monday summary says it may be partial');
  params.region = 'BDR';
  const bdrNv = DATA.act_kpi.find((r) => r.region === 'BDR').notVisible;
  ok(bdrNv > 0 ? /shows no activity for/.test(actLine()) : !/shows no activity for/.test(actLine()), 'limited: the caveat follows the scope', [bdrNv, actLine()]);
  params.region = 'DACH';
  ok(/^• Activity, last 4 weeks: not visible with your Salesforce access \(it shows no activity for any of the \d+ sellers\)$/.test(actLine()) && monday() === '', 'limited: DACH (all hidden) says so instead of zeros, and offers no Monday summary', actLine());
  params.region = 'All';
  const hidTeams = DATA.team_act.filter((t) => t.actHidden > 0);
  ok(hidTeams.length > 0 && hidTeams.every((t) => t.actMeetings == null && t.actFlags == null), 'limited: teams with hidden sellers show no total', hidTeams.length);
  const leadName = DATA.team_tree.filter((x) => x.isLeader).map((x) => x.name).find((n) => pts(n).some((p) => /Your access shows no activity for \d+ of the \d+ sellers in this team, so these totals may be partial/.test(p.text)));
  ok(!!leadName, 'limited: a leader agenda says how many of their sellers are hidden');
  const pdl = new Node('dl'); REG['[data-pd-act-dl]'] = [pdl];
  params.person = nv[0].name; DATA.person = []; DATA.person_hb = []; fire(); params.person = '';
  ok(pdl.hidden === true, 'limited: the person panel hides the numbers of a Not visible seller');
  delete REG['[data-pd-act-dl]'];
  // ----- back to full access -----
  Object.assign(DATA, SAVED); runAll(); fire();
  ok(note.hidden === true, 'full access again: note hidden');
  // ----- time zone: a browser in Los Angeles at 08:00 Paris has read the same days as at 17:00 the day before -----
  const tz0 = process.env.TZ;
  NOW = Date.parse('2026-11-04T07:00:00Z'); process.env.TZ = 'America/Los_Angeles'; run('act_reps');
  const la = DATA.act_reps.map((r) => [r.name, r.idle, r.cmpMeet, r.cmpMail, r.status].join('|')).join('\n');
  ok(la === base, 'LA browser, 08:00 Paris next day: same idle days and comparisons as the evening before');
  process.env.TZ = 'Europe/Paris'; run('act_reps');
  ok(DATA.act_reps.filter((r) => r.idle != null).some((r, i) => r.idle > 0) && DATA.act_reps.map((r) => [r.name, r.idle, r.cmpMeet, r.cmpMail, r.status].join('|')).join('\n') !== base, 'Paris browser at the same moment: a new day counts, so idle days move on');
  ok(!calcs.act_reps.inputs.includes('sf_me'), 'act_reps no longer needs getUserInfo');
  if (tz0 === undefined) delete process.env.TZ; else process.env.TZ = tz0;
  NOW = Date.parse('2026-11-03T16:00:00Z'); runAll();
  // ----- BDR stubs: sourcing BDRs now in another role keep their role, with no activity numbers -----
  const stubs = DATA.act_bdr.filter((r) => !r.active);
  ok(JSON.stringify(stubs.map((r) => r.status).sort()) === JSON.stringify(['Not in activity', 'Now SMB', 'Now SMB']) && stubs.every((r) => r.meetPros == null && r.people == null), 'BDR stubs: Now SMB ×2, Not in activity; no numbers', stubs.map((r) => r.status));
  ok(DATA.act_bdr.filter((r) => r.emailsChg != null).every((r) => r.emailsPrev != null), 'BDR rows carry the earlier emails for the tooltip');
  const bt = tbl('act-bdr-table').find((tr) => /^Now SMB$/.test(cells(tr)[13]));
  ok(!!bt && cells(bt)[2] === '—' && cells(bt)[5] === '—', 'BDR table: Now SMB row shows — for activity', bt && cells(bt));
  // ----- Engagement Manager book line -----
  const em = DATA.act_reps.find((r) => r.kind === 'EM' && r.custMet > 0);
  params.person = em.name;
  const emLine = (book) => { DATA.person = [{ name: em.name, emCustomers: book }]; const e = new Node('dd'); e.dataset.draw = 'pd-act-em'; draws['pd-act-em'](e); return e.textContent; };
  ok(!/ of /.test(emLine(0)) && /^\d+$/.test(emLine(0)), 'EM with no book: just the accounts met', emLine(0));
  ok(/^\d+; 5 in their Engagement Manager book$/.test(emLine(5)), 'EM with a book: a second figure, not "N of M"', emLine(5));
  params.person = ''; delete DATA.person;
  // ----- agenda: when activity couldn't be read, the empty message doesn't claim there's no activity -----
  const who = DATA.team_tree[0].email;
  DATA.oo_points = [{ key: 'k1', email: who, name: DATA.team_tree[0].name, section: 'numbers', sev: '', order: 0, text: 'Pipeline numbers' }];
  params.ooWho = who; STATE.oo_points_act = 'error';
  const pE = new Node('p'), pC = new Node('p'); pE.dataset.msgFor = 'oo-talk'; pE.dataset.msg = 'empty'; pC.dataset.msgFor = 'oo-talk'; pC.dataset.msg = 'emptycore';
  REG['[data-msg-for]'] = [pE, pC];
  const slot = new Node('span'); slot.dataset.for = 'oo-talk'; draws.msg(slot);
  ok(pE.hidden && !pC.hidden, 'activity failed: the agenda shows the message without "activity"', [pE.hidden, pC.hidden]);
  delete STATE.oo_points_act; const saveAct = DATA.oo_points_act; DATA.oo_points_act = []; draws.msg(slot);
  ok(!pE.hidden && pC.hidden, 'activity loaded (nothing to say): the usual empty message', [pE.hidden, pC.hidden]);
  DATA.oo_points_act = saveAct; params.ooWho = '';
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
}, 30);
