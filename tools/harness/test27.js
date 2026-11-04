// Activity, review-8 fixes: no getUserInfo dependency, the time-zone note, the access note after navigation (Activity,
// Team, BDRs), limited access with a hidden channel, BDR totals and requests, all-hidden scopes and agendas, capture gaps
// under a hidden channel, scorecard flags that can't fire, leaders in like-for-like, Monday wording, no-capture wording,
// the visible channel's trend note and the Prep 1:1 brackets. Real calcs and drawings over the saved answers of 3 Nov 2026.
// Prints counts and labels only.
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
// the page opens on Home: the notes must follow navigation, not only data changes
global.location.hash = '#home';
const REG = {};
document.querySelector = (sel) => (/data-view-panel/.test(sel) ? new Node('div') : null);
document.querySelectorAll = (sel) => REG[sel] || [];
const handlers = []; document.addEventListener = (ev, fn) => { if (ev === 'click') handlers.push(fn); };
let copied = null; Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: (t) => { copied = t; return Promise.resolve(); } } }, configurable: true, writable: true });
require('/home/user/revopsemeaos/dashboard/os-core.js'); require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js'); require('/home/user/revopsemeaos/dashboard/os-draw.js');
let fails = 0; const ok = (c, l, x) => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const rec = (f) => { const j = JSON.parse(fs.readFileSync(path.join(S, f), 'utf8')); return (j.records || j).map(({ attributes, ...r }) => r); };
const roster = rec('act/roster.json').map((u, i) => ({ ...u, userId: '005TEST' + String(i).padStart(11, '0') }));
const SAVED = { act_mail: rec('act-final/act_mail.json'), act_mail_prev: rec('act-final/act_mail_prev.json'), act_meet: rec('act-final/act_meet.json'), act_meet_prev: rec('act-final/act_meet_prev.json') };
const ME = (tz) => [{ userId: '005TESTME', name: 'Rev Ops', timeZone: tz }];
Object.assign(DATA, SAVED, { roster, cr_bdr: rec('activity-design/cr_bdr.json'), sf_me: ME('Europe/Paris'), books_owner: [] });
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
const click = (match, set) => { const btn = new Node('button'); Object.assign(btn.dataset, set); btn.matches = (sel) => sel === match; btn.closest = () => btn; const ev = { target: { closest: () => btn }, preventDefault() {} }; for (const h of handlers) h(ev); };
const press = () => { copied = null; click('[data-copy-summary]', { copySummary: '' }); return copied || ''; };
const actLine = () => press().split('\n').find((l) => /Activity/.test(l)) || '';
const monday = () => { const mb = new Node('span'); draws['act-monday'](mb); return (asks(mb)[0] || {}).ask || ''; };
const plan = () => { const b = new Node('span'); draws['act-bdr-plan'](b); return (asks(b)[0] || {}).ask || ''; };
const bdrTile = (k) => { const e = new Node('b'); e.dataset.draw = 'kpi-act-bdr'; e.dataset.source = 'act_bdr'; e.dataset.k = k; draws['kpi-act-bdr'](e); return e.textContent; };
const mk = (key, ctx) => { const n = new Node('p'); n.hidden = true; n.dataset.actAccess = key; n.dataset.ctx = ctx; return n; };
const notes = { activity: mk('oneonone:activity', 'activity'), team: mk('oneonone:team', 'team'), bdrs: mk('created:bdrs', 'bdrs') };
REG['[data-act-access]'] = Object.values(notes);
const noteText = (ctx) => { const e = new Node('span'); e.dataset.ctx = ctx; draws['act-access'](e); return e.textContent; };
const fire = () => onData.forEach((fn) => fn());
const nav = (screen, v) => click('[data-nav]', v ? { nav: screen, navView: v } : { nav: screen });
const tab = (key) => click('[data-view-tab]', { viewTab: key });
const quietN = () => DATA.act_reps.filter((r) => r.flags.includes('Quiet')).length;
const pts = (name) => { const t = DATA.team_tree.find((x) => x.name === name); return t ? OS.oo.points(t.email) : []; };
const reset = () => { Object.assign(DATA, SAVED); runAll(); };
const tz0 = process.env.TZ;
setTimeout(() => {
  // ----- getUserInfo: no activity calc depends on it, and its failure only costs the time-zone sentence -----
  const dependsOn = (id, src, seen = new Set()) => { if (seen.has(id)) return false; seen.add(id); const c = calcs[id]; return !!c && c.inputs.some((i) => i === src || dependsOn(i, src, seen)); };
  ok(ACT.every((id) => !dependsOn(id, 'sf_me')), 'no activity calc depends on getUserInfo', ACT.filter((id) => dependsOn(id, 'sf_me')));
  // ----- the time-zone note -----
  process.env.TZ = 'Europe/Paris'; DATA.sf_me = ME('America/Los_Angeles');
  const tzTxt = noteText('activity');
  ok(/^Your Salesforce time zone is America\/Los Angeles, behind yours: .*until 09:00 your time, days since the last activity can read one high\. Set your Salesforce time zone to where you work\.$/.test(tzTxt), 'LA Salesforce zone, Paris browser: the note says until 09:00', tzTxt);
  ok(noteText('bdrs') === tzTxt && noteText('team') === '', 'the time-zone sentence shows on Activity and BDRs, not the scorecard');
  STATE.sf_me = 'error'; ok(noteText('activity') === '', 'getUserInfo failed: no note, nothing else changes'); delete STATE.sf_me;
  process.env.TZ = 'America/Los_Angeles'; ok(noteText('activity') === '', 'LA browser with an LA Salesforce zone: no lag, no note');
  process.env.TZ = 'Europe/London'; DATA.sf_me = ME('America/New_York'); ok(/until 05:00 your time/.test(noteText('activity')), 'New York zone, London browser: until 05:00', noteText('activity'));
  process.env.TZ = 'Europe/Paris'; DATA.sf_me = ME('Asia/Dubai'); ok(noteText('activity') === '', 'a Salesforce zone ahead: no note');
  DATA.sf_me = ME('Not/AZone'); ok(noteText('activity') === '', 'a bad Salesforce zone: no note, no failure');
  if (tz0 === undefined) delete process.env.TZ; else process.env.TZ = tz0;
  DATA.sf_me = ME('Europe/Paris');
  // ----- the access note follows navigation: data loaded on Home, then a switch to each view -----
  DATA.act_mail = []; DATA.act_mail_prev = []; runAll(); fire();
  ok(Object.values(notes).every((n) => n.hidden), 'emails hidden, still on Home: no note touched yet');
  nav('oneonone', 'activity');
  ok(!notes.activity.hidden && /^Your access shows meetings but almost no captured emails, so emails show — and no one is flagged Quiet\.$/.test(noteText('activity')), 'going to 1:1s › Activity shows the note', [notes.activity.hidden, noteText('activity')]);
  tab('oneonone:team');
  ok(!notes.team.hidden && noteText('team') === 'Your access shows meetings but almost no captured emails, so no one is flagged Quiet.', 'the Team view tab shows its own note', [notes.team.hidden, noteText('team')]);
  nav('created', 'bdrs');
  ok(!notes.bdrs.hidden, 'Created opps › BDRs shows the note');
  nav('home'); STATE.act_reps = 'error'; nav('oneonone', 'activity');
  ok(notes.activity.hidden, 'activity failed while away: the note hides again on return');
  delete STATE.act_reps; reset(); nav('oneonone', 'activity');
  ok(notes.activity.hidden, 'full access: the note stays hidden');
  // ----- limited access with emails hidden for the sellers it shows -----
  const keep = new Set(roster.filter((u) => /^(AE-EMEA-FR|AE-EMEA-DACH|BDR-EMEA)$/.test(u.role || '')).map((u) => u.name));
  Object.assign(DATA, { act_mail: [], act_mail_prev: [], act_meet: SAVED.act_meet.filter((r) => keep.has(r.owner)), act_meet_prev: SAVED.act_meet_prev.filter((r) => keep.has(r.owner)) }); runAll(); fire();
  const g1 = DATA.act_reps[0];
  ok(g1.limited && g1.mailHidden, 'limited and emails hidden: both detected', [g1.limited, g1.mailHidden]);
  ok(quietN() === 0 && !DATA.act_reps.some((r) => r.flags.includes('Capture gap')), 'no Quiet and no Capture gap from one channel', [quietN()]);
  ok(DATA.act_reps.filter((r) => r.status !== 'Left').every((r) => r.emails == null), 'emails blank, not 0');
  ok(!DATA.checks_act.some((c) => /^act:(mail|cal):/.test(c.id)), 'no mailbox or calendar capture checks');
  ok(/; the others show Not visible\. For those it shows, it shows meetings but almost no captured emails/.test(DATA.act_trust.find((t) => t.id === 'access').detail), 'How far to trust names both');
  ok(!notes.activity.hidden && /the totals above count only what it shows\. For those it shows, it shows meetings but almost no captured emails/.test(noteText('activity')), 'the note names both', noteText('activity'));
  // ----- meetings hidden: BDR pane, Monday summary, Prep 1:1, no-capture wording, scorecard -----
  Object.assign(DATA, { act_mail: SAVED.act_mail, act_mail_prev: SAVED.act_mail_prev, act_meet: [], act_meet_prev: [] }); runAll(); fire();
  ok(DATA.act_reps[0].meetHidden, 'meetings hidden: detected');
  ok(bdrTile('per100') === '—' && bdrTile('meetPros') === '—', 'BDR tiles: — for prospect meetings and per 100', [bdrTile('per100'), bdrTile('meetPros')]);
  ok(/5,806 people emailed and prospect meetings not visible with my access in the last 4 weeks/.test(plan()) && !/ 0 prospect meetings/.test(plan()), 'Plan BDR capacity: meetings not visible, not 0', plan());
  const fr = tbl('act-bdr-table').flatMap((tr) => asks(tr)).filter((a) => /^Funnel review/.test(a.label));
  ok(fr.length > 0 && fr.every((a) => /\), prospect meetings not visible with my access; they sourced/.test(a.ask) && !/—/.test(a.ask)), 'Funnel review: meetings not visible, no — in the text', fr.length);
  const bdrPer = tbl('act-bdr-table').filter((tr) => DATA.act_bdr.some((r) => r.name === tr.dataset.key && r.active));
  ok(bdrPer.length > 0 && bdrPer.every((tr) => tr.children[8].title === 'not visible with your access'), 'per-100 tooltip says not visible');
  const m1 = monday();
  ok(/meetings like-for-like not visible with my access, emails (?:[−+][1-9]\d*|0)% like-for-like \(\d+ people compared\)/.test(m1) && !/[−+]0%/.test(m1) && !/quiet:/.test(m1) && !/nothing booked:/.test(m1) && /; no sent email captured \(check capture first\): /.test(m1), 'Monday summary: email change, no impossible lists, no-capture by channel', m1.slice(0, 400));
  ok(/no one can be flagged Quiet/.test(m1), 'Monday summary says Quiet is off');
  const prep = tbl('act-table').flatMap((tr) => asks(tr)).filter((a) => /^Prep 1:1/.test(a.label));
  ok(prep.length > 0 && prep.every((a) => !/not compared, emails/.test(a.ask) && !/no like-for-like change/.test(a.ask)), 'Prep 1:1: no meetings comparison part when meetings are hidden', prep.length);
  ok(DATA.team_act.every((t) => t.actHidden || (t.actQuiet == null && t.actNothingBooked == null)), 'scorecard: Quiet and Nothing booked blank');
  ok(DATA.act_kpi.find((r) => r.region === 'All').quiet == null && tile('quiet') === '—' && tile('nothingBooked') === '—', 'headline: quiet and nothing booked —');
  // ----- emails hidden: scorecard tile, tooltip, summary wording -----
  Object.assign(DATA, { act_mail: [], act_mail_prev: [], act_meet: SAVED.act_meet, act_meet_prev: SAVED.act_meet_prev }); runAll(); fire();
  const lead = DATA.team_tree.filter((x) => x.isLeader).sort((a, b) => DATA.team_tree.filter((y) => y.manager === b.name).length - DATA.team_tree.filter((y) => y.manager === a.name).length)[0];
  params.ooRoot = lead.name;
  const tq = new Node('b'); tq.dataset.draw = 'kpi-team-act'; tq.dataset.source = 'team_act'; tq.dataset.field = 'actQuiet'; draws['kpi-team-act'](tq);
  ok(tq.textContent === '—', 'emails hidden: the scorecard quiet tile reads —', tq.textContent);
  const tips = tbl('oo-team-table').map((tr) => tr.children[14].title).filter(Boolean);
  ok(tips.length > 0 && tips.every((t) => !/quiet/.test(t) && /no meeting captured$/.test(t)), 'flags tooltip: no quiet, no-capture by channel', tips[0]);
  params.ooRoot = '';
  ok(/, \d+ with no meeting captured$/.test(actLine()), 'weekly summary: "with no meeting captured"', actLine());
  // ----- capture gaps need both channels: meetings hidden except one tenured AE with no emails -----
  reset();
  const ae = DATA.act_reps.filter((r) => r.kind === 'AE' && r.active && r.tenure >= 56 && r.meetings >= 8).sort((a, b) => b.meetings - a.meetings)[0];
  Object.assign(DATA, { act_meet: SAVED.act_meet.filter((r) => r.owner === ae.name), act_meet_prev: SAVED.act_meet_prev.filter((r) => r.owner === ae.name), act_mail: SAVED.act_mail.filter((r) => r.owner !== ae.name), act_mail_prev: SAVED.act_mail_prev });
  runAll();
  ok(DATA.act_reps[0].meetHidden && DATA.act_reps.every((r) => !r.mailOff && !r.calOff), 'meetings hidden: no capture gaps read off a hidden channel');
  ok(!DATA.checks_act.some((c) => /null|undefined/.test(c.what)), 'no "null" in data checks', DATA.checks_act.map((c) => c.what).filter((w) => /null/.test(w)));
  // ----- limited (France AEs and BDRs): all-hidden scopes, leader agendas, hidden sellers' agendas -----
  const keep2 = new Set(roster.filter((u) => /^(AE-EMEA-FR|BDR-EMEA)$/.test(u.role || '')).map((u) => u.name));
  for (const k of Object.keys(SAVED)) DATA[k] = SAVED[k].filter((r) => keep2.has(r.owner));
  runAll(); fire();
  params.region = 'DACH';
  const dach = ['meetings', 'booked', 'emails', 'people', 'needLook', 'checkCapture', 'captured', 'quiet'].map((f) => tile(f));
  ok(dach.every((x) => x === '—') && tileEl('kpi-act-lfl', 'meetChg').textContent === 'not visible with your access', 'DACH (all hidden): tiles —, like-for-like not visible', dach);
  params.region = 'All';
  const zeroLines = DATA.oo_points_act.filter((p) => /no activity for (\d+) of the \1 sellers? in this team/.test(p.text));
  const hidLines = DATA.oo_points_act.filter((p) => /^Team activity, last 4 weeks: not visible with your Salesforce access \(it shows no activity for any of the \d+ sellers? in this team\)\.$/.test(p.text));
  ok(zeroLines.length === 0 && hidLines.length > 0 && hidLines.every((p) => p.actHidden), 'leader agendas: all-hidden teams say not visible, no zero totals', [zeroLines.length, hidLines.length]);
  const nvSeller = DATA.act_reps.find((r) => r.status === 'Not visible' && r.kind === 'AE');
  const nvPts = pts(nvSeller.name);
  ok(nvPts.some((p) => p.section === 'numbers' && p.actHidden && /^Activity: your Salesforce access shows no sent email or meeting of theirs in the last 8 weeks\.$/.test(p.text)), 'Not visible seller: the agenda says so');
  const pE = new Node('p'), pC = new Node('p'); pE.dataset.msgFor = 'oo-talk'; pE.dataset.msg = 'empty'; pC.dataset.msgFor = 'oo-talk'; pC.dataset.msg = 'emptycore';
  REG['[data-msg-for]'] = [pE, pC];
  const slot = new Node('span'); slot.dataset.for = 'oo-talk';
  params.ooWho = DATA.team_tree.find((x) => x.name === nvSeller.name).email; draws.msg(slot);
  ok(pE.hidden && !pC.hidden, 'Not visible seller: the talk message leaves activity out', [pE.hidden, pC.hidden]);
  const hidLead = DATA.team_tree.find((x) => x.email === hidLines[0].email);
  params.ooWho = hidLead.email; draws.msg(slot);
  ok(OS.oo.points(hidLead.email).some((p) => p.section === 'talk') || (pE.hidden && !pC.hidden), 'all-hidden team leader: the talk message leaves activity out');
  params.ooWho = ''; delete REG['[data-msg-for]'];
  // BDRs, none visible: no Funnel review on their rows, a caveat in the capacity request
  const keep3 = new Set(roster.filter((u) => /^AE-EMEA-FR$/.test(u.role || '')).map((u) => u.name));
  for (const k of Object.keys(SAVED)) DATA[k] = SAVED[k].filter((r) => keep3.has(r.owner));
  runAll(); fire();
  const nvB = DATA.act_bdr.filter((r) => r.active && r.status === 'Not visible').map((r) => r.name);
  const bRows = tbl('act-bdr-table');
  ok(nvB.length > 0 && bRows.filter((tr) => nvB.includes(tr.dataset.key)).every((tr) => !asks(tr).some((a) => /^Funnel review/.test(a.label))), 'no Funnel review on Not visible BDR rows', nvB.length);
  ok(/My Salesforce access shows no activity for any of the \d+ BDRs: base the projection on sourced opportunities only\./.test(plan()) && !/partial/.test(plan()) && /people emailed not visible with my access and prospect meetings not visible with my access/.test(plan()), 'Plan BDR capacity, no BDR visible: work from sourcing, nothing as 0, not "partial"', plan().slice(0, 300));
  ok(tileEl('kpi-act', 'meetPros', { team: 'BDR' }).textContent === '—', 'BDR prospect meetings tile —, not 0');
  // ----- review 9: BDR capacity with some BDRs visible says partial; Leadership blank; Below range; per-100 tip; small teams -----
  const bdrNames = roster.filter((u) => u.role === 'BDR-EMEA').map((u) => u.name);
  const keep4 = new Set([...keep3, ...bdrNames.slice(0, 3)]);
  for (const k of Object.keys(SAVED)) DATA[k] = SAVED[k].filter((r) => keep4.has(r.owner));
  runAll(); fire();
  ok(/My Salesforce access shows no activity for \d+ of the \d+ BDRs: say the activity numbers are partial\./.test(plan()), 'Plan BDR capacity, some BDRs visible: partial caveat', plan().slice(0, 300));
  // Leadership has no sellers: with limited access and no leader's activity visible it is blank, not 0
  const keep5 = new Set(roster.filter((u) => /^(AE-EMEA-FR|BDR-EMEA)$/.test(u.role || '')).map((u) => u.name));
  for (const k of Object.keys(SAVED)) DATA[k] = SAVED[k].filter((r) => keep5.has(r.owner));
  runAll(); fire();
  params.region = 'Leadership';
  const lk = DATA.act_kpi.find((r) => r.region === 'Leadership');
  ok(lk.blind && lk.sellers === 0 && ['meetings', 'emails', 'booked'].every((f) => tile(f) === '—') && tileEl('kpi-act-lfl', 'meetChg').textContent === 'not visible with your access', 'Leadership, limited, nothing visible: blank, not 0', [lk.blind, tile('meetings')]);
  ok(monday() === '' && /^• Activity, last 4 weeks: not visible with your Salesforce access$/.test(actLine()), 'Leadership: no Monday summary, the weekly summary says not visible', actLine());
  params.region = 'All';
  // Below range can't fire with meetings hidden
  Object.assign(DATA, { act_mail: SAVED.act_mail, act_mail_prev: SAVED.act_mail_prev, act_meet: [], act_meet_prev: [] }); runAll(); fire();
  ok(DATA.act_kpi.find((r) => r.region === 'All').belowRange == null && tile('belowRange') === '—', 'meetings hidden: Below range —, not 0');
  // per-100 tooltip with emails hidden
  Object.assign(DATA, { act_mail: [], act_mail_prev: [], act_meet: SAVED.act_meet, act_meet_prev: SAVED.act_meet_prev }); runAll(); fire();
  const per100Tips = tbl('act-bdr-table').filter((tr) => DATA.act_bdr.some((r) => r.name === tr.dataset.key && r.active)).map((tr) => tr.children[8].title);
  ok(per100Tips.length > 0 && per100Tips.every((t) => t === 'not visible with your access'), 'emails hidden: per-100 tooltip says not visible, not "under 50 people"', per100Tips[0]);
  // a first-line manager's team (3-9 sellers) with emails hidden: caught, so no Capture gap, no false Quiet, emails blank
  reset();
  const kidsOf = (m) => DATA.team_tree.filter((x) => x.manager === m).map((x) => x.name);
  const sellerSet = (m) => { const out = new Set(); const q = [m]; while (q.length) { for (const k of kidsOf(q.shift())) { out.add(k); q.push(k); } } return [...out].filter((n) => DATA.act_reps.some((r) => r.name === n && r.active && r.kind !== 'Leader' && (r.emails || r.meetings))); };
  const smallLead = DATA.team_tree.filter((x) => x.isLeader).map((x) => ({ name: x.name, s: sellerSet(x.name) })).filter((x) => x.s.length >= 5 && x.s.length <= 9).sort((a, b) => b.s.length - a.s.length)[0];
  const keep6 = new Set(smallLead.s);
  Object.assign(DATA, { act_mail: [], act_mail_prev: [], act_meet: SAVED.act_meet.filter((r) => keep6.has(r.owner)), act_meet_prev: SAVED.act_meet_prev.filter((r) => keep6.has(r.owner)) }); runAll(); fire();
  const g6 = DATA.act_reps[0], vis6 = DATA.act_reps.filter((r) => keep6.has(r.name));
  ok(g6.limited && g6.mailHidden && vis6.every((r) => r.emails == null && !r.flags.includes('Capture gap') && !r.flags.includes('Quiet')), 'small team, emails hidden: detected; no Capture gap or Quiet; emails blank', [smallLead.s.length, g6.limited, g6.mailHidden]);
  ok(!DATA.checks_act.some((c) => /^act:(mail|cal):/.test(c.id)), 'small team: no capture-gap data checks');
  ok(/fewer than half the sellers/.test(calcs.oo_points_act.description), 'agenda description says when hidden activity gets a line');
  // ----- leaders in like-for-like: a comparable leader with nothing captured now is left out -----
  reset();
  const ld = DATA.act_reps.filter((r) => r.kind === 'Leader' && r.active && r.cmpMeet).sort((a, b) => b.meetPrev - a.meetPrev)[0];
  Object.assign(DATA, { act_mail: SAVED.act_mail.filter((r) => r.owner !== ld.name), act_meet: SAVED.act_meet.filter((r) => r.owner !== ld.name) }); runAll();
  const ld2 = DATA.act_reps.find((r) => r.name === ld.name);
  ok(!ld2.cmpMeet && !ld2.cmpMail && ld2.trendNote === 'nothing captured in the last 4 weeks' && ld2.meetChg == null, 'leader with nothing captured: not compared, and says why', [ld2.cmpMeet, ld2.trendNote]);
  // ----- trend note: emails visible only for Engagement Managers, so the meeting line gives the meeting reason -----
  const ems = new Set(roster.filter((u) => /^EM-EMEA/.test(u.role || '')).map((u) => u.name));
  Object.assign(DATA, { act_mail: SAVED.act_mail.filter((r) => ems.has(r.owner)), act_mail_prev: SAVED.act_mail_prev.filter((r) => ems.has(r.owner)), act_meet: SAVED.act_meet, act_meet_prev: SAVED.act_meet_prev }); runAll();
  const lostEm = DATA.act_reps.filter((r) => r.active && !r.cmpMeet && !r.cmpMail && r.meetings > 0 && r.tenure >= 56);
  ok(DATA.act_reps[0].mailHidden && lostEm.length > 0 && lostEm.every((r) => r.trendNote !== 'not visible with your access'), 'emails hidden: a missing meeting comparison gives the meeting reason', lostEm.map((r) => r.trendNote));
  // ----- descriptions qualify what blanks -----
  ok(/fewer than half the sellers/.test(calcs.act_reps.description) && /fewer than half the sellers/.test(calcs.act_kpi.description) && /fewer than half the sellers/.test(calcs.team_act.description), 'descriptions say when hidden activity is blank');
  // ----- full access unchanged by all this -----
  reset(); fire();
  const k = DATA.act_kpi.find((r) => r.region === 'All');
  ok(k.quiet === 1 && k.needLook === 22 && k.notVisible === 0 && k.lflMeetReps === 87 && k.lflMailReps === 89 && k.belowRange === 5 && !k.blind, 'full access: 1 quiet, 22 need a look, 5 below range, 87/89 compared', [k.quiet, k.needLook, k.belowRange, k.notVisible, k.lflMeetReps, k.lflMailReps]);
  ok(!DATA.act_kpi.some((r) => r.blind) && !DATA.act_reps[0].mailHidden && !DATA.act_reps[0].meetHidden, 'full access: no scope blank, no channel hidden');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
}, 30);
