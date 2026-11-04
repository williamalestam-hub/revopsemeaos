// Conversion (wave 8, 4 Nov 2026): the real calcs and drawings over the six saved live answers (run read-only on
// 4 Nov 2026) and over synthetic rows: the closing-team rule, stage reached and the envelope, same-cohort peers in one
// motion, won within 2 quarters, clean-up months, lost reasons on the new list, sources, time in stage, the agenda lines,
// data checks, the weekly line, failure isolation, a cut answer, request size and guard, and a privacy scan.
// Prints labels and counts only, never names.
const { Node } = require('./fakedom.js');
let NOW = Date.parse('2026-11-04T10:00:00Z');
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const fs = require('fs');
const D = '/home/user/revopsemeaos/dashboard/';
const LIVE = '/tmp/claude-0/-home-user-revopsemeaos/c3936b63-31db-5219-aa72-dbd9a885d4cb/scratchpad/wip-conv/live/conv-wide/';
const SCR = '/tmp/claude-0/-home-user-revopsemeaos/c3936b63-31db-5219-aa72-dbd9a885d4cb/scratchpad/';
const calcs = {}, draws = {}, loaders = {}, onData = [];
let params = { region: 'All', mgr: '', person: '', checkArea: 'All', ooWho: '', cvSeg: 'all', cvRt: 'nb', cvClean: false, grWindow: 30 };
const DATA = {}, STATE = {};
global.dash = { loader: (id, o) => { loaders[id] = o; }, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; onData.forEach((f) => f()); }, onData: (fn) => { onData.push(fn); }, colors: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'], setLink: () => {},
  data: (id) => (STATE[id] ? { status: STATE[id], data: [] } : id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }) };
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
const fn = (id, ...a) => calcs[id].fn(...a);
const walk = (n, f) => { f(n); for (const c of n.children || []) walk(c, f); };
const nodes = (el, pick) => { const out = []; walk(el, (n) => { if (pick(n)) out.push(n); }); return out; };
const draw = (name, tag = 'div', ds = {}) => { const el = new Node(tag); el.dataset.draw = name; Object.assign(el.dataset, ds); draws[name](el); return el; };
const rowsOf = (name) => nodes(draw(name, 'tbody'), (n) => n.tagName === 'TR');
const items = (name) => nodes(draw(name, 'ul'), (n) => n.tagName === 'LI');
const cells = (tr) => tr.children.map((td) => td.textContent);
const asks = (el) => nodes(el, (n) => n.dataset && n.dataset.ask).map((n) => JSON.parse(n.dataset.ask));
const tile = (ds, attrs) => { const el = new Node('b'); Object.assign(el.dataset, ds); Object.assign(el.attrs, attrs || {}); draws[ds.draw](el); return el; };
const fire = () => onData.forEach((f) => f());
const press = (attr) => { copied = null; const btn = new Node('button'); btn.dataset[attr] = ''; btn.matches = (sel) => sel === '[data-' + attr.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ']'; btn.closest = () => btn; const ev = { target: { closest: () => btn }, preventDefault() {} }; for (const h of handlers) h(ev); return copied || ''; };
const reset = () => { for (const k of Object.keys(DATA)) delete DATA[k]; for (const k of Object.keys(STATE)) delete STATE[k]; params = { ...params, region: 'All', mgr: '', cvSeg: 'all', cvRt: 'nb', cvClean: false, ooWho: '' }; };
const GUARD = 'Counts and sums only: no opportunity, account, contact or competitor names, no record Ids and no deal-by-deal lists in chat; our own people may be named. Read only: change nothing in Salesforce and send nothing without my OK.';
const ID_RE = /\b(006|001|003|00Q)[A-Za-z0-9]{12,15}\b/;

// ----- synthetic rows in the shape of the six queries -----
const S0 = (n, stage) => { const s = {}; for (let k = 0; k < 7; k++) s['s' + k] = k <= stage ? n : 0; return s; };
// spec: [status, furthest stage (lost, open), n, extra]; a closed deal is closed by its role today unless extra says otherwise
const mk = (role, manager, fy, fq, spec, extra) => {
  const open = [], closed = [];
  for (const [st, stage, n, x] of spec) {
    const base = { rt: 'New Business', fy, fq, role, manager, n, arr: n * 1000, ...(st === 'won' ? S0(n, 6) : S0(n, stage)), cwStamp: 0, clStamp: 0 };
    if (st === 'open') open.push({ ...base, ...(x || {}) });
    else closed.push({ ...base, closedRole: role, closedManager: manager, won: st === 'won', cfy: fy, cfq: fq, ...(extra || {}), ...(x || {}) });
  }
  return { open, closed };
};
const merge = (...xs) => ({ open: xs.flatMap((x) => x.open), closed: xs.flatMap((x) => x.closed) });
const setCv = (x) => { DATA.cv_open = x.open; DATA.cv_closed = x.closed; };
const months = (spec) => Object.entries(spec).flatMap(([q, ns]) => { const [y, qq] = q.split('-').map(Number); return ns.map((n, i) => ({ yr: y, mo: (qq - 1) * 3 + i + 1, n })); });

(async () => {
  await new Promise((r) => setTimeout(r, 0)); // the Ask Claude room connects

  // ===================== 1) the saved live answers (4 Nov 2026) =====================
  const ds = JSON.parse(fs.readFileSync(D + 'datasets.json', 'utf8'));
  const raw = {};
  for (const id of ['cv_open', 'cv_closed', 'cv_window', 'cv_lost_month', 'cv_source', 'cv_days']) {
    raw[id] = fs.readFileSync(LIVE + id + '.json', 'utf8');
    const out = loaders[id].fn({ answer: [{ type: 'text', text: raw[id] }], args: ds[id].source.args });
    ok(out.rows.length > 0 && out.rows.length < 1600 && out.cut === false && !out.rows.some((r) => 'attributes' in r), id + ': loaded from the live answer, under the 1,600-row warning, not cut', { rows: out.rows.length, cut: out.cut });
    DATA[id] = out.rows;
  }
  // live/conv-wide: cv_open as recorded in the morning; the five closed-deal queries re-run later on 4 Nov 2026 with the
  // main line's wider closed-deal scope (cv_closed +44 rows, cv_window +10, cv_source +11 from the wider scope)
  ok(DATA.cv_open.length === 211 && DATA.cv_closed.length === 691 && DATA.cv_window.length === 768 && DATA.cv_lost_month.length === 14 && DATA.cv_source.length === 717 && DATA.cv_days.length === 296,
    'live row counts as recorded on 4 Nov 2026, the closed-deal queries with the wider scope (211, 691, 768, 14, 717, 296)', ['cv_open', 'cv_closed', 'cv_window', 'cv_lost_month', 'cv_source', 'cv_days'].map((id) => DATA[id].length));
  ok(!Object.values(raw).some((t) => ID_RE.test(t)), 'no record Id in any of the six live answers (cv_days groups by Id without selecting it)');
  ok(Object.values(ds).filter((x) => /^cv_/.test(Object.keys(ds).find((k) => ds[k] === x))).every((x) => !/Lost_Notes__c|Competitor__c|Lost_Detail__c|\bName\b(?!\s)/.test(x.source.args.q.replace(/Owner\.Manager\.Name|UserRole\.Name|RecordType\.Name/g, ''))),
    'no conversion query reads Lost Notes, competitors, Lost Detail or any record name');
  { const j = JSON.parse(fs.readFileSync(SCR + 'act/roster.json', 'utf8')); DATA.roster = (j.records || j).map(({ attributes, ...r }) => r); }
  DATA.cr_monthly = [];
  runAll();
  const sc = (id, key) => DATA[id].find((r) => r.key === key);
  const A = sc('conv_cohorts', 'All|New Business');
  ok(A.y2qCohort === 'Q2 2026' && near(A.y2q, 434 / 1193) && A.y2qN === 1193 && A.y2qWon === 434, 'live: the latest comparable cohort is Q2 2026, won within 2 quarters 434 of 1,193', [A.y2qCohort, A.y2qWon, A.y2qN]);
  ok(A.trend === null && A.trendNote === 'mix' && A.peerLabel === '', 'live: All EMEA has no trend verdict and no peers');
  ok(A.smbY2q != null && A.fieldY2q != null && A.smbShare > A.prevSmbShare, 'live: SMB and Field side by side; SMB\'s share of created grew on the quarter before', [A.smbShare, A.prevSmbShare]);
  const coh = DATA.conv_cohorts.filter((r) => r.kind === 'cohort' && r.rt === 'New Business');
  const byQ = (scope) => new Map(coh.filter((r) => r.scope === scope).map((r) => [r.cohort, r.n]));
  const all = byQ('All'), smb = byQ('S|SMB'), field = byQ('S|Field');
  ok([...all].every(([q, n]) => n === (smb.get(q) || 0) + (field.get(q) || 0)), 'live: each cohort, All = SMB + Field (SMB counted once)');
  const teams = coh.filter((r) => r.level === 'team');
  ok([...all].every(([q, n]) => n === teams.filter((r) => r.cohort === q).reduce((a, r) => a + r.n, 0)), 'live: each cohort, the teams add up to All');
  ok(coh.filter((r) => r.scope === 'All').map((r) => r.status).join() === 'This quarter,So far,Comparable,Comparable,Comparable', 'live: Q4 2026 this quarter, Q3 2026 so far, three comparable quarters', coh.filter((r) => r.scope === 'All').map((r) => r.status));
  ok(coh.every((r) => !r.comparable || r.y2q == null || (r.y2q >= 0 && r.y2q <= 1 && r.y2qOpen >= 0)), 'live: won within 2 quarters and still open at 2 quarters stay between 0 and 1');
  const st = DATA.conv_steps, stAll = sc('conv_steps', 'All');
  ok(stAll.created === sc('conv_steps', 'S|SMB').created + sc('conv_steps', 'S|Field').created && stAll.created === st.filter((r) => r.level === 'team').reduce((a, r) => a + r.created, 0), 'live steps: All = SMB + Field = the teams');
  ok(st.every((r) => [0, 1, 2, 3, 4, 5].every((k) => r['reached' + k] >= r['reached' + (k + 1)])), 'live steps: the funnel never widens');
  ok(st.every((r) => ['b0', 'b1', 'b2', 'b3', 'b46'].every((b) => r[b + 'Reached'] === r[b + 'Moved'] + r[b + 'Lost'] + r[b + 'Still'])), 'live steps: reached = moved on + lost + still in it, every step');
  ok(st.filter((r) => ['BDR', 'Engagement', 'Leadership', 'SMB', 'All', 'S|SMB', 'S|Field'].includes(r.key)).every((r) => r.peerLabel === '' && r.b1Exp == null && !r.leakBand), 'live steps: All, the segments, SMB, BDR, Engagement and Leadership have no peers and no leak');
  ok(st.filter((r) => r.level === 'team' && r.peerLabel).every((r) => r.peerLabel === 'other AE teams'), 'live steps: AE teams are compared with the other AE teams');
  ok(st.filter((r) => r.level === 'manager').every((r) => (r.mixed || !['AE', 'SMB'].includes(r.mainClass) ? r.peerLabel === '' : r.peerLabel !== '')), 'live steps: a manager is compared only within one motion (80%+)');
  const cl = sc('conv_close', 'All');
  ok(cl.won4 + cl.lost4 === cl.closed4 && cl.closed4 === DATA.conv_close.filter((r) => r.level === 'team').reduce((a, r) => a + r.closed4, 0), 'live close: the teams add up to All');
  ok(cl.lost0 + cl.lost1 + cl.lost2 + cl.lost3 + cl.lost46 + cl.lostAfterWin + cl.lostUnknown === cl.lost4 && cl.admin > 0, 'live close: every loss has a band; admin merges counted apart', cl.admin);
  ok(near(cl.winRate, 1308 / 2445) && cl.attrOutside === 15 && cl.attrLeft > 0, 'live close: win rate 1,308 of 2,445 by who closed; deals closed by EMEA now outside EMEA included; the 15 closed in a role outside EMEA sales count for the owner today', [cl.won4, cl.closed4, cl.attrLeft, cl.attrOutside]);
  const reasons = DATA.conv_reasons.filter((r) => r.kind === 'reason' && r.scope === 'All');
  const NEW = ['Chose an alternative', 'Product fit', 'Price and budget', 'Buyer engagement', 'Deferred', 'Not a fit', 'Customer experience and support', 'Other'];
  ok(reasons.every((r) => NEW.includes(r.group) || ['No reason given', 'Value not perceived'].includes(r.group) || /^Unlisted: /.test(r.group)), 'live reasons: only the new list, Value not perceived apart, no reason given or unlisted', reasons.map((r) => r.group));
  ok(reasons.reduce((a, r) => a + r.n, 0) === sc('conv_reasons', 'All|*').lost4 && sc('conv_reasons', 'All|*').lost4 === cl.lost4, 'live reasons: the groups add up to the losses of the win rate');
  ok(sc('conv_reasons', 'All|Not a fit').oldsTxt === 'Qualified Out ' + sc('conv_reasons', 'All|Not a fit').n.toLocaleString('en') && reasons[reasons.length - 1].group === 'No reason given', 'live reasons: Not a fit gathers Qualified Out; no reason given comes last');
  // Bookings' lost_reasons groups the same values under the same names
  const lr = fn('lost_reasons', DATA.cv_window.filter((r) => !r.won).map((r) => ({ owner: 'x', role: r.role, manager: 'm', closedOwner: 'x', closedRole: r.closedRole, closedManager: 'm', rt: 'New Business', won: false, lostReason: r.reason, fy: r.fy, fq: r.fq, opps: r.n, arrUsd: r.arr })));
  const lrNames = new Set(lr.filter((r) => r.scope === 'All' && !r.admin).map((r) => r.reason)), cvNames = new Set(DATA.conv_reasons.filter((r) => r.kind === 'reason' && r.scope === 'All').map((r) => r.group));
  ok([...cvNames].every((g) => lrNames.has(g)), 'live: Conversion\'s reason groups are Bookings\' names (the same map)', [...cvNames].filter((g) => !lrNames.has(g)));
  const co = sc('conv_closeout', 'All');
  ok(co.closeoutLabel === 'Q3 2026' && co.closeoutMonths === 'September 2026' && co.monthLost === 348 && co.monthBase === 106 && co.lastQCleanup === true, 'live closeout: September 2026 (348 against 106) makes Q3 2026 the clean-up quarter', [co.closeoutLabel, co.monthLost, co.monthBase]);
  ok(DATA.conv_closeout.filter((r) => r.kind === 'reason').every((r) => r.rising === null && r.lastQShare === null), 'live closeout: last quarter was the clean-up quarter, so no reason is rising or compared');
  ok(co.winRateClean > cl.winRate && co.lateShareClean > cl.lateShare, 'live closeout: without the clean-up the win rate and the late share are higher', [co.winRateClean, cl.winRate]);
  const src = DATA.conv_sources.filter((r) => r.scope === 'All');
  const tot = src.find((r) => r.kind === 'total');
  ok(['As in Sources', 'Lead source', 'Origin', 'Created by'].every((g) => src.filter((r) => r.group === g).reduce((a, r) => a + r.closed, 0) === tot.closed), 'live sources: every grouping adds up to all closed', tot.closed);
  ok(tot.closed === cl.closed4 && tot.closed === 2445, 'live sources: the same 2,445 closed deals as the win rate', [tot.closed, cl.closed4]);
  ok(src.filter((r) => r.kind === 'source').every((r) => r.mark === ''), 'live sources: no source is marked at All EMEA (it mixes SMB and Field)');
  const tw = sc('conv_time', 'All|win');
  ok(tw.n === 296 && tw.median > 1 && tw.n1 === tw.n - tw.oneGo, 'live time: Created to won counts the wins that took a day or more', [tw.n, tw.oneGo, tw.n1]);
  ok(['0', '1', '2', '3', '46'].every((k) => sc('conv_time', 'All|' + k).median != null), 'live time: every stage has a median of moves that took a day or more');
  const trustIds = ['conv_trust_cohort', 'conv_trust_close', 'conv_trust_timing'].flatMap((id) => DATA[id].map((t) => t.id)).concat(DATA.conv_closeout.filter((r) => r.kind === 'trust').map((t) => t.id), DATA.conv_sources.filter((r) => r.kind === 'trust').map((t) => t.id), DATA.conv_time.filter((r) => r.kind === 'trust').map((t) => t.id));
  ok(['window', 'young', 'owner', 'stamps', 'reopen', 'cap', 'merges', 'reasons', 'stage3', 'atwin', 'left', 'windowCap', 'closeout', 'leadsource', 'bdr', 'creator', 'srcCap', 'walk', 'signature', 'order', 'stuck', 'daysCap', 'timing'].every((id) => trustIds.includes(id)), 'live trust: every check is there', trustIds);
  const ck = [...DATA.checks_conv, ...DATA.checks_conv_lost, ...DATA.checks_conv_days];
  ok(ck.length > 0 && ck.every((c) => c.area === 'Conversion' && c.screen === 'created' && c.view === 'conversion' && c.how && !/lost notes|Lost_Notes/i.test(c.how) && ['low', 'medium', 'high'].includes(c.severity)), 'live checks: Conversion checks open the view, counts-only requests', ck.length);
  ok(DATA.checks_conv_lost.some((c) => c.id.startsWith('conv:noreason:')) && !DATA.checks_conv_lost.some((c) => c.id.startsWith('conv:retired:')), 'live checks: losses with no reason flagged; retired reasons can\'t fire before January 2027');
  // agendas from a team tree built on the saved roster
  const act = DATA.roster.filter((u) => u.isActive !== false), mgrs = new Set(act.map((u) => u.manager)), names = new Set(act.map((u) => u.name));
  DATA.team_tree = act.map((u, i) => ({ name: u.name, email: 'p' + i + '@x.test', manager: u.manager, role: u.role, isLeader: mgrs.has(u.name), isTop: false }))
    .concat([...mgrs].filter((x) => x && !names.has(x)).map((x, i) => ({ name: x, email: 'm' + i + '@x.test', manager: null, isLeader: true, isTop: i === 0 })));
  const oo = run('oo_points_conv');
  const leaders = new Set(DATA.team_tree.filter((t) => t.isLeader).map((t) => t.email));
  ok(oo.length > 0 && oo.every((r) => leaders.has(r.email) && r.conv === true && r.order >= 3e6 && r.sev !== 'high'), 'live agendas: conversion lines for leaders only, ordered after the rest, never high', oo.length);
  const perL = new Map(); for (const r of oo) { const o = perL.get(r.email) || { n: 0, t: 0 }; o[r.section === 'numbers' ? 'n' : 't'] += 1; perL.set(r.email, o); }
  ok([...perL.values()].every((o) => o.n === 1 && o.t <= 2), 'live agendas: one numbers line and up to 2 talking points per leader');
  ok(!oo.some((r) => ID_RE.test(r.text)), 'live agendas: no record Ids');
  const vals = (id) => DATA[id].flatMap((r) => Object.values(r));
  ok(!CONV.some((id) => vals(id).some((v) => typeof v === 'string' && ID_RE.test(v))), 'live: no record Id in any conversion calc output');

  // ===================== 2) the closing-team rule =====================
  reset();
  // a deal moved since it closed counts for the team and manager that closed it; same role: today's manager;
  // not stamped (before April 2026): today's team and manager; owned outside EMEA today: the closing team
  const rows = [
    ...mk('MGR-SALES-EMEA', 'Leonard', 2026, 2, [['won', 6, 30]], { closedRole: 'AE-EMEA-FR', closedManager: 'FrMgr', cfy: 2026, cfq: 2 }).closed,
    ...mk('AE-EMEA-DACH', 'DMgr', 2026, 2, [['won', 6, 20]], { closedManager: 'OldMgr' }).closed,
    ...mk('AE-EMEA-CEE', 'CMgr', 2026, 2, [['lost', 1, 10]], { closedRole: null, closedManager: null }).closed,
    ...mk('Consulting Partnerships', 'Partner Head', 2026, 2, [['won', 6, 12]], { closedRole: 'AE-EMEA-BENELUX', closedManager: null }).closed,
    ...mk('AE-STRAT', 'Strat Head', 2026, 2, [['won', 6, 8]], { closedRole: 'AE-EMEA-BENELUX', closedManager: 'BenMgr' }).closed,
  ];
  DATA.cv_open = []; DATA.cv_closed = rows;
  const c2 = run('conv_cohorts'), s2 = run('conv_steps');
  const ck2 = (k) => (c2.find((r) => r.key === k + '|New Business|' + (2026 * 4 + 1)) || {}).n || 0;
  ok(ck2('France') === 30 && ck2('M|FrMgr') === 30 && !ck2('Leadership') && !ck2('M|Leonard'), 'rule: promoted since closing: France and its manager at close, not Leadership or today\'s manager', [ck2('France'), ck2('Leadership'), ck2('M|Leonard')]);
  ok(ck2('M|DMgr') === 20 && !ck2('M|OldMgr'), 'rule: same role, new manager (a re-org): today\'s manager');
  ok(ck2('CEE') === 10 && ck2('M|CMgr') === 10, 'rule: no closing role stamped: today\'s team and manager');
  ok(ck2('Benelux') === 20 && ck2('M|BenMgr') === 8 && !ck2('M|Partner Head') && !ck2('M|Strat Head') && !c2.some((r) => r.scope === 'Other'), 'rule: owned outside EMEA today: the closing team; its manager at close, or none when not stamped', [ck2('Benelux'), ck2('M|BenMgr')]);
  ok((s2.find((r) => r.key === 'M|BenMgr') || {}).won === 8 && !s2.some((r) => r.key === 'M|Partner Head'), 'rule: the steps count the same way');
  DATA.cv_window = [{ fy: 2026, fq: 2, role: 'MGR-SALES-EMEA', closedRole: 'AE-EMEA-FR', won: true, lastStage: '6 - Opt-out', reason: null, n: 30, arr: 3e4 },
    { fy: 2026, fq: 2, role: 'Consulting Partnerships', closedRole: 'AE-EMEA-BENELUX', won: false, lastStage: '2 - Scope agreement', reason: 'Timing', n: 12, arr: 1e4 },
    { fy: 2026, fq: 2, role: 'AE-EMEA-CEE', closedRole: null, won: false, lastStage: '1 - Solution agreement', reason: 'Budget', n: 10, arr: 1e4 }];
  const cl2 = run('conv_close');
  const cb = (k) => cl2.find((r) => r.key === k) || {};
  ok(cb('France').won4 === 30 && !cl2.some((r) => r.key === 'Leadership') && cb('Benelux').lost4 === 12 && cb('CEE').lost4 === 10, 'rule: win rate and losses by the closing team');
  ok(cb('All').attrMoved === 42 && cb('All').attrLeft === 12 && cb('All').attrBlank === 10, 'rule: moved, moved outside EMEA and not stamped are counted', [cb('All').attrMoved, cb('All').attrLeft, cb('All').attrBlank]);
  const tc = run('conv_trust_cohort').find((t) => t.id === 'owner');
  ok(/^50 of 80 closed/.test(tc.detail) && /\(20 of them outside EMEA sales\)/.test(tc.detail) && /\(12 with no closing manager stamped/.test(tc.detail) && /10 closed before about April 2026/.test(tc.detail) && /today's manager/.test(tc.detail), 'rule: the trust row says who counts where (50 moved, 20 outside EMEA, 12 with no manager at close, 10 not stamped)', tc.detail.slice(0, 160));

  // ===================== 3) the prototype checks (run.js, run2.js) on synthetic rows =====================
  // T1: discovery's losses by last stage and quarter: admin merges out, win rate, where losses leave, without the clean-up
  reset();
  const LOST = { '2025-4': [70, 38, 17, 12, 12, 2, 6, 0], '2026-1': [38, 36, 32, 10, 20, 3, 6, 0], '2026-2': [54, 55, 34, 45, 21, 7, 29, 2], '2026-3': [146, 141, 120, 104, 18, 24, 6, 0] };
  const NAMES = ['0 - Qualification', '1 - Solution agreement', '2 - Scope agreement', '3 - Pilot Validation', '4 - Commercial agreement', '5 - Vendor assessment', '6 - Opt-out', 'Closed Won'];
  DATA.cv_window = [];
  for (const [k, arr] of Object.entries(LOST)) { const [fy, fq] = k.split('-').map(Number); arr.forEach((n, i) => { if (n) DATA.cv_window.push({ fy, fq, role: 'AE-EMEA-DACH', closedRole: 'AE-EMEA-DACH', won: false, lastStage: NAMES[i], reason: 'Timing', n, arr: n * 100 }); }); }
  DATA.cv_window.push({ fy: 2026, fq: 3, role: 'AE-EMEA-DACH', closedRole: 'AE-EMEA-DACH', won: false, lastStage: '1 - Solution agreement', reason: 'Merged with Global Pilot', n: 41, arr: 1 });
  [[2025, 4, 290], [2026, 1, 300], [2026, 2, 300], [2026, 3, 304]].forEach(([fy, fq, n]) => DATA.cv_window.push({ fy, fq, role: 'AE-EMEA-DACH', closedRole: 'AE-EMEA-DACH', won: true, lastStage: '6 - Opt-out', reason: null, n, arr: n * 100 }));
  DATA.cv_lost_month = months({ '2025-4': [52, 52, 53], '2026-1': [48, 48, 49], '2026-2': [82, 82, 83], '2026-3': [109, 103, 347] });
  const t1 = run('conv_close').find((r) => r.key === 'All'), t1c = run('conv_closeout').find((r) => r.key === 'All');
  ok(t1.lost4 === 1108 && t1.admin === 41 && near(t1.winRate, 1194 / 2302), 'T1: admin merges left out: 1,108 losses, win rate 51.9%');
  ok(near(t1.lateShare, 154 / 1106) && near(t1.earlyShare, 578 / 1106) && t1.lostAfterWin === 2, 'T1: 13.9% of losses at stage 4–6, 52.3% at 0–1, 2 lost after a win');
  ok(t1c.closeoutLabel === 'Q3 2026' && near(t1c.lateShareClean, 106 / 547), 'T1: without the Q3 2026 clean-up, 19.4% at stage 4–6', t1c.lateShareClean);
  // T2: two Field teams converting identically per cohort, with different cohort mixes: the same-cohort peers remove the mix
  reset();
  const cs = (rate, n) => [['won', 6, Math.round(n * rate)], ['lost', 1, n - Math.round(n * rate)]];
  const t2 = merge(mk('AE-EMEA-DACH', 'Mgr A', 2025, 4, cs(0.9, 200)), mk('AE-EMEA-DACH', 'Mgr A', 2026, 1, cs(0.8, 50)), mk('AE-EMEA-DACH', 'Mgr A', 2026, 2, cs(0.7, 50)),
    mk('AE-EMEA-NORDICS', 'Mgr B', 2025, 4, cs(0.9, 50)), mk('AE-EMEA-NORDICS', 'Mgr B', 2026, 1, cs(0.8, 50)), mk('AE-EMEA-NORDICS', 'Mgr B', 2026, 2, cs(0.7, 200)), mk('SMB-EMEA', 'Mgr S', 2026, 2, cs(0.95, 300)));
  setCv(t2);
  const s2b = run('conv_steps'), dach = s2b.find((r) => r.key === 'DACH'), nord = s2b.find((r) => r.key === 'Nordics');
  ok(dach.b1Rate > nord.b1Rate + 0.08 && Math.abs(dach.b1Exp - dach.b1Rate) < 0.005 && dach.b1Flag === '' && nord.b1Flag === '', 'T2: pooled rates differ by mix only; on the same quarters neither is flagged', [dach.b1Rate, nord.b1Rate, dach.b1Exp]);
  ok(dach.b1Exp < 0.9 && s2b.find((r) => r.key === 'SMB').b1Exp === null, 'T2: SMB is never a Field peer and has no peers itself');
  // T3: a real leak, on the team and its manager
  const t3 = merge(t2, mk('AE-EMEA-CEE', 'Mgr C', 2025, 4, cs(0.6, 60)), mk('AE-EMEA-CEE', 'Mgr C', 2026, 1, cs(0.55, 60)), mk('AE-EMEA-CEE', 'Mgr C', 2026, 2, cs(0.45, 60)));
  setCv(t3);
  const s3 = run('conv_steps'), cee = s3.find((r) => r.key === 'CEE'), mc = s3.find((r) => r.key === 'M|Mgr C');
  ok(cee.b1Flag === 'leak' && cee.leakBand === 'b1' && cee.leakBehind >= 30 && cee.leakLabel === 'Stage 1 → 2' && mc.b1Flag === 'leak', 'T3: CEE leaks at 1 → 2, deals behind counted, the manager row too', [cee.leakBehind]);
  // T4: no double counting
  const sa = s3.find((r) => r.key === 'All'), sf = s3.find((r) => r.key === 'S|Field'), ss = s3.find((r) => r.key === 'S|SMB');
  ok(sa.created === sf.created + ss.created && ss.created === 300 && s3.filter((r) => r.level === 'team').reduce((a, r) => a + r.created, 0) === sa.created, 'T4: All = Field + SMB, SMB once, teams add up');
  // T5: moved after closing, no closing manager: the closing team, no manager, not the owner's team today
  setCv(merge(t3, mk('DIR-BDR-EMEA', 'VP X', 2026, 1, [['won', 6, 40]], { closedRole: 'AE-EMEA-BENELUX', closedManager: null })));
  const s5 = run('conv_steps');
  ok((s5.find((r) => r.key === 'Benelux') || {}).won === 40 && !s5.some((r) => r.key === 'M|VP X' || r.key === 'BDR'), 'T5: moved wins count for Benelux, no manager, not BDR');
  // T6: the envelope raises a missing stage and the settled guard
  const t6 = merge(t3, mk('AE-EMEA-SOUTH', 'Mgr D', 2026, 2, [['lost', 3, 25, { s2: 0 }], ['open', 2, 120], ['won', 6, 40], ['lost', 2, 10]]));
  setCv(t6);
  const s6 = run('conv_steps'), so = s6.find((r) => r.key === 'Southern Europe');
  ok(so.b2Reached === 195 && so.orderFixed === 25 && so.b2Settled === false && so.b2Flag === '' && so.b2Reached === so.b2Moved + so.b2Lost + so.b2Still, 'T6: stage 2 raised for deals stamped at 3 (25 raises), a stage with most deals still in it is never flagged', [so.b2Reached, so.orderFixed]);
  // T7: won within 2 quarters counts wins in the quarter created and the next one, once the next one has ended
  setCv(merge(mk('AE-EMEA-DACH', 'Mgr A', 2026, 2, [['won', 6, 30], ['won', 6, 10, { cfy: 2026, cfq: 3 }], ['won', 6, 5, { cfy: 2026, cfq: 4 }], ['lost', 1, 25], ['open', 1, 30]]), mk('AE-EMEA-DACH', 'Mgr A', 2026, 3, [['won', 6, 30], ['open', 0, 70]])));
  const c7 = run('conv_cohorts'), q2 = c7.find((r) => r.key === 'DACH|New Business|' + (2026 * 4 + 1)), q3 = c7.find((r) => r.key === 'DACH|New Business|' + (2026 * 4 + 2));
  ok(q2.comparable && near(q2.y2q, 0.4) && near(q2.y2qOpen, (100 - 40 - 25) / 100) && !q3.comparable && q3.y2q === null && q3.status === 'So far' && q3.compAfter === '31 Dec 2026', 'T7: Q2 2026 40% (the Q4 win left out); Q3 2026 so far until 31 Dec 2026', [q2.y2q, q3.status, q3.compAfter]);
  // T10–T12: clean-up months; growth never looks like a clean-up
  reset();
  DATA.cv_window = [];
  DATA.cv_lost_month = months({ '2025-4': [52, 52, 53], '2026-1': [48, 48, 49], '2026-2': [82, 82, 83], '2026-3': [109, 103, 347], '2026-4': [300, 20, 0] });
  let x = run('conv_closeout').find((r) => r.key === 'All');
  ok(x.closeoutQs.join() === 'Q3 2026' && x.closeoutMonths === 'September 2026' && near(x.monthRatio, 347 / 106, 0.01), 'T10: September 2026 flagged at 3.3×; a month of this quarter is never tested');
  NOW = Date.parse('2027-01-02T12:00:00Z');
  DATA.cv_lost_month = months({ '2026-1': [48, 48, 49], '2026-2': [82, 82, 83], '2026-3': [109, 103, 347], '2026-4': [210, 220, 220] });
  x = run('conv_closeout').find((r) => r.key === 'All');
  ok(x.closeoutQs.join() === 'Q3 2026' && x.lastQCleanup === false, 'T11: on 2 Jan 2027, Q4 2026 at 650 losses is not a clean-up quarter; Q3 2026 still is', x.closeoutQs);
  NOW = Date.parse('2027-04-01T12:00:00Z');
  DATA.cv_lost_month = months({ '2026-2': [82, 82, 83], '2026-3': [109, 103, 347], '2026-4': [100, 100, 100], '2027-1': [100, 100, 100] });
  ok(run('conv_closeout').find((r) => r.key === 'All').closeoutQs.join() === 'Q3 2026', 'T12: on 1 Apr 2027 Q3 2026 is still the clean-up quarter');
  // T13: last quarter the clean-up quarter: no reason rising; T14: a clean-up among the three before is left out of the base
  NOW = Date.parse('2026-11-04T10:00:00Z');
  const W = (fy, fq, reason, n, won) => ({ fy, fq, role: 'AE-EMEA-DACH', closedRole: 'AE-EMEA-DACH', won: !!won, lastStage: '2 - Scope agreement', reason, n, arr: n });
  DATA.cv_lost_month = months({ '2025-4': [52, 52, 53], '2026-1': [48, 48, 49], '2026-2': [82, 82, 83], '2026-3': [109, 103, 347] });
  DATA.cv_window = [W(2025, 4, 'Timing', 20), W(2025, 4, 'Qualified Out', 137), W(2026, 1, 'Timing', 20), W(2026, 1, 'Qualified Out', 125), W(2026, 2, 'Timing', 30), W(2026, 2, 'Qualified Out', 217), W(2026, 3, 'Timing', 300), W(2026, 3, 'Qualified Out', 259), W(2026, 3, null, 300, true)];
  let cx = run('conv_closeout');
  ok(cx.filter((r) => r.kind === 'reason' && r.scope === 'All').every((r) => r.rising === null && r.lastQShare === null && r.lastQCleanup) && cx.find((r) => r.key === 'All').lostClean === 549, 'T13: last quarter is the clean-up quarter: nothing rising or compared; 549 clean losses');
  NOW = Date.parse('2027-01-02T12:00:00Z');
  DATA.cv_lost_month = months({ '2026-1': [48, 48, 49], '2026-2': [82, 82, 83], '2026-3': [109, 103, 347], '2026-4': [210, 220, 220] });
  DATA.cv_window = [W(2026, 1, 'Timing', 10), W(2026, 1, 'Qualified Out', 90), W(2026, 2, 'Timing', 10), W(2026, 2, 'Qualified Out', 90), W(2026, 3, 'Timing', 300), W(2026, 3, 'Qualified Out', 259), W(2026, 4, 'Timing', 20), W(2026, 4, 'Qualified Out', 80)];
  cx = run('conv_closeout');
  const deferred = cx.find((r) => r.key === 'All|Deferred');
  ok(near(deferred.prevShare, 0.1) && near(deferred.lastQShare, 0.2) && deferred.rising === true, 'T14: the clean-up quarter is left out of the base, so a real rise shows (Timing, now Deferred)', [deferred.prevShare, deferred.lastQShare]);
  NOW = Date.parse('2026-11-04T10:00:00Z');
  // T15: a BDR team at 5% never moves an AE team's expectations; it has no peers itself
  reset();
  const sp = (w, l1, l2) => [['won', 6, w], ['lost', 1, l1], ['lost', 2, l2]];
  const base = merge(...[[2025, 4], [2026, 1], [2026, 2]].flatMap(([fy, fq]) => [mk('AE-EMEA-DACH', 'Mgr A', fy, fq, sp(50, 20, 10)), mk('AE-EMEA-NORDICS', 'Mgr B', fy, fq, sp(45, 25, 10)), mk('AE-EMEA-CEE', 'Mgr C', fy, fq, sp(40, 25, 15)), mk('SMB-EMEA', 'Mgr S', fy, fq, sp(80, 10, 10))]));
  const withBdr = merge(base, ...[[2025, 4], [2026, 1], [2026, 2]].map(([fy, fq]) => mk('BDR-EMEA', 'Mgr BDR', fy, fq, sp(3, 40, 17))));
  setCv(base); const a15 = run('conv_steps').find((r) => r.key === 'DACH');
  setCv(withBdr); const s15 = run('conv_steps'), b15 = s15.find((r) => r.key === 'DACH');
  ok(['b0Exp', 'b1Exp', 'b2Exp', 'b3Exp', 'b46Exp', 'y2qExp'].every((f) => a15[f] != null && near(a15[f], b15[f], 1e-12)), 'T15: a BDR team at 5% leaves every expectation of an AE team unchanged');
  ok(s15.find((r) => r.key === 'BDR').peerLabel === '' && s15.find((r) => r.key === 'M|Mgr BDR').b1Exp === null && s15.find((r) => r.key === 'M|Mgr BDR').mainClass === 'BDR', 'T15: the BDR team and its manager have no peers');
  const c15 = run('conv_cohorts').find((r) => r.key === 'DACH|New Business');
  ok(c15.peerLabel === 'other AE teams' && run('conv_cohorts').find((r) => r.key === 'BDR|New Business').y2qVerdict === null, 'T15: cohorts: AE peers only, BDR never compared');
  // T16: closed by Benelux, owned outside EMEA today: Benelux and its manager at close; not the owner or the BDR team
  setCv(merge(base, mk('AE-STRAT', 'Strategic Head', 2026, 1, [['won', 6, 30]], { closedRole: 'AE-EMEA-BENELUX', closedManager: 'Mgr Benelux' }), mk('DIR-BDR-EMEA', 'VP X', 2026, 1, [['lost', 2, 12]], { closedRole: 'AE-EMEA-BENELUX', closedManager: null })));
  const s16 = run('conv_steps');
  ok(s16.some((r) => r.key === 'Benelux' && r.won === 30 && r.lost === 12) && s16.some((r) => r.key === 'M|Mgr Benelux') && !s16.some((r) => ['M|Strategic Head', 'M|VP X', 'BDR'].includes(r.key)), 'T16: closed by Benelux, owned outside EMEA: Benelux and its manager at close');
  // T17: a manager at 69% AE deals mixes motions: no comparison; their team still is compared
  setCv(merge(base, ...[[2025, 4], [2026, 1], [2026, 2]].flatMap(([fy, fq]) => [mk('AE-EMEA-FR', 'Mgr Mix', fy, fq, sp(30, 10, 5)), mk('SMB-EMEA', 'Mgr Mix', fy, fq, sp(15, 3, 2))])));
  const s17 = run('conv_steps'), mix = s17.find((r) => r.key === 'M|Mgr Mix');
  ok(mix.mixed === true && near(mix.mainShare, 45 / 65) && mix.b1Exp === null && mix.peerLabel === '' && s17.find((r) => r.key === 'France').b1Exp != null, 'T17: a manager at 69% AE gets no comparison; France still compared', [mix.mainShare]);
  ok(run('conv_cohorts').find((r) => r.key === 'M|Mgr Mix|New Business').trendNote === 'mix', 'T17: and no trend verdict');
  // T18: constant segment rates while SMB's share of created goes from 13% to 42%: no All EMEA verdict, SMB and Field similar
  const seg = (role, mgr, fy, fq, n, y2q) => mk(role, mgr, fy, fq, [['won', 6, Math.round(n * y2q)], ['lost', 1, n - Math.round(n * y2q)]]);
  setCv(merge(seg('SMB-EMEA', 'S1', 2026, 1, 52, 0.5), seg('AE-EMEA-DACH', 'F1', 2026, 1, 337, 0.3), seg('SMB-EMEA', 'S1', 2026, 2, 480, 0.5), seg('AE-EMEA-DACH', 'F1', 2026, 2, 663, 0.3)));
  const c18 = run('conv_cohorts'), q18 = (k) => c18.find((r) => r.key === k + '|New Business|' + (2026 * 4 + 1));
  ok(q18('All').trend === null && q18('All').trendNote === 'mix' && q18('S|SMB').trend === 'similar' && q18('S|Field').trend === 'similar', 'T18: no All EMEA verdict from the mix; SMB and Field similar', [q18('All').trend, q18('S|SMB').trend, q18('S|Field').trend]);
  const a18 = c18.find((r) => r.key === 'All|New Business');
  ok(near(a18.smbShare, 480 / 1143) && near(a18.prevSmbShare, 52 / 389), 'T18: SMB\'s share of created 42% against 13%, for the tile\'s title');
  // T19: stages 4–6 timed together; a deal whose stage 0–3 dates go backwards is left out of those stages only
  const day = (o) => ({ role: 'AE-EMEA-DACH', manager: 'Mgr A', closedRole: 'AE-EMEA-DACH', closedManager: 'Mgr A', d0: 1, d1: 2, d2: 3, d3: 4, d4: 20, d5: 10, d6: 5, daysToWin: 40, cwAt: '2026-10-01', closeAt: '2026-10-01', ...o });
  // 6 → 5 → 6 → won keeps the latest pass of each stage: stage 4 alone reads 20, the band 20 + 10 + 5 = 35 (won entry minus stage-4 entry)
  const t19 = fn('conv_time', [...Array.from({ length: 11 }, () => day({})), day({ d2: -3, d4: 0, d5: 0, d6: 0 })]);
  const b19 = t19.find((r) => r.key === 'All|46'), s19 = t19.find((r) => r.key === 'All|2');
  ok(b19.n === 12 && b19.sameDay === 1 && b19.n1 === 11 && b19.median === 35 && s19.n === 11 && t19.find((r) => r.id === 'order').value === 1, 'T19: stages 4–6 timed together (35 days); a deal whose stage 0–3 dates go backwards leaves those stages only', [b19.n, b19.sameDay, b19.median, s19.n]);
  // T20: with 38% same-day wins, the tile shows the median of the wins that took a day or more
  reset();
  DATA.cv_days = [...Array.from({ length: 38 }, () => day({ daysToWin: 0 })), ...Array.from({ length: 62 }, (_, i) => day({ daysToWin: 2 + i * 3 }))];
  run('conv_time');
  const tDays = tile({ draw: 'kpi-conv', calc: 'time', field: 'median', fmt: 'days', source: 'conv_time' });
  const tShare = tile({ draw: 'kpi-conv', calc: 'time', field: 'oneGoShare', fmt: 'pct', source: 'conv_time' });
  ok(tDays.textContent === '94d' && tShare.textContent === '38%' && tDays.dataset.where === 'key=All%7Cwin', 'T20: Days to win reads the median of the 62 wins that took a day or more (93.5), 38% within a day', [tDays.textContent, tShare.textContent]);

  // ===================== 4) the view: drawings at All EMEA, a segment, a team and a manager =====================
  reset();
  const fix = merge(...[[2025, 4], [2026, 1], [2026, 2], [2026, 3], [2026, 4]].flatMap(([fy, fq]) => [
    mk('AE-EMEA-DACH', 'Dana Manager', fy, fq, sp(50, 20, 10).concat([['open', 1, 8]])), mk('AE-EMEA-NORDICS', 'Nils Manager', fy, fq, sp(45, 25, 10)), mk('AE-EMEA-CEE', 'Cora Manager', fy, fq, sp(20, 40, 15)),
    mk('SMB-EMEA', 'Sam Manager', fy, fq, sp(80, 10, 10)), mk('BDR-EMEA', 'Bea Manager', fy, fq, sp(3, 30, 5))]));
  // planted names in fields no query reads: they must never reach a cell, a copied table or a request
  const PLANT = { account: 'Initech Holdings', opp: 'Globex Expansion Deal', competitor: 'Hooli Legal AI', oppId: '006Pn00000ABCDEFGH' };
  fix.open.push({ ...mk('AE-EMEA-DACH', 'Dana Manager', 2025, 2, [['open', 1, 9]]).open[0], ...PLANT });
  setCv(fix);
  DATA.cv_window = [[2025, 4], [2026, 1], [2026, 2], [2026, 3], [2026, 4]].flatMap(([fy, fq]) => [
    { fy, fq, role: 'AE-EMEA-DACH', closedRole: 'AE-EMEA-DACH', won: true, lastStage: '6 - Opt-out', reason: null, n: 60, arr: 6e6 },
    { fy, fq, role: 'AE-EMEA-DACH', closedRole: 'AE-EMEA-DACH', won: false, lastStage: '1 - Solution agreement', reason: 'Qualified Out', n: 30, arr: 1e6, ...PLANT },
    { fy, fq, role: 'AE-EMEA-DACH', closedRole: 'AE-EMEA-DACH', won: false, lastStage: '3 - Pilot Validation', reason: 'Lost to Competitor', n: 15, arr: 1e6 },
    { fy, fq, role: 'AE-EMEA-NORDICS', closedRole: 'AE-EMEA-NORDICS', won: true, lastStage: '6 - Opt-out', reason: null, n: 50, arr: 5e6 },
    { fy, fq, role: 'AE-EMEA-NORDICS', closedRole: 'AE-EMEA-NORDICS', won: false, lastStage: '5 - Vendor assessment', reason: 'Deferred', n: 25, arr: 1e6 },
    { fy, fq, role: 'SMB-EMEA', closedRole: 'SMB-EMEA', won: true, lastStage: '6 - Opt-out', reason: null, n: 90, arr: 1e6 },
    { fy, fq, role: 'SMB-EMEA', closedRole: 'SMB-EMEA', won: false, lastStage: '0 - Qualification', reason: null, n: 30, arr: 1e5 },
    { fy, fq, role: 'BDR-EMEA', closedRole: 'BDR-EMEA', won: false, lastStage: '0 - Qualification', reason: 'Merged with Global Pilot', n: 5, arr: 1 }]);
  DATA.cv_lost_month = months({ '2025-4': [40, 40, 40], '2026-1': [40, 40, 40], '2026-2': [40, 40, 40], '2026-3': [30, 30, 340] });
  const SRC = [['Inbound', null, null, 'SMB-EMEA'], ['Inbound Webform', null, null, 'AE-EMEA-DACH'], ['Referral', null, null, 'AE-EMEA-DACH'], ['Event', null, null, 'AE-EMEA-NORDICS'], ['Outbound', 'BDR-EMEA', 'BDR-EMEA', 'BDR-EMEA'],
    ['Apollo', null, 'BDR-EMEA', 'BDR-EMEA'], ['Other', null, null, 'EM-EMEA'], [null, null, null, null], ['Outbound', 'BDR-AMER', null, 'AE-EMEA-CEE'], ['Inbound', null, null, 'DIR-SALES-EMEA']];
  DATA.cv_source = SRC.flatMap(([s, bdr, now, creator], i) => [true, false].flatMap((won) => ['AE-EMEA-DACH', 'SMB-EMEA'].map((role) => ({ src: s, bdrRole: bdr, bdrNow: now, creatorRole: creator, role, closedRole: role, closed: true, won, n: 30 + i, arr: (30 + i) * 1e4, cycleDays: won ? (30 + i) * 40 : 0, cycleN: won ? 30 + i : 0 }))))
    .concat([{ src: 'Inbound', bdrRole: null, bdrNow: null, creatorRole: 'SMB-EMEA', role: 'SMB-EMEA', closedRole: null, closed: false, won: false, n: 40, arr: 4e5, cycleDays: 0, cycleN: 0, ...PLANT }]);
  DATA.cv_days = [...Array.from({ length: 30 }, (_, i) => day({ role: 'SMB-EMEA', closedRole: 'SMB-EMEA', manager: 'Sam Manager', closedManager: 'Sam Manager', daysToWin: i % 3 ? 10 + i : 0 })), ...Array.from({ length: 30 }, (_, i) => day({ manager: 'Dana Manager', closedManager: 'Dana Manager', daysToWin: 20 + i }))];
  DATA.roster = [['Dana Rep', 'AE-EMEA-DACH', 'Dana Manager'], ['Dino Rep', 'AE-EMEA-DACH', 'Dana Manager'], ['Nils Rep', 'AE-EMEA-NORDICS', 'Nils Manager'], ['Cora Rep', 'AE-EMEA-CEE', 'Cora Manager'], ['Sam Rep', 'SMB-EMEA', 'Sam Manager'], ['Bea Rep', 'BDR-EMEA', 'Bea Manager']].map(([name, role, manager]) => ({ name, role, manager, isActive: true }));
  DATA.cr_monthly = []; DATA.cr_mix = [{ source: 'BDR-sourced', thisOpps: 12, lastOpps: 30 }, { source: 'Inbound', thisOpps: 40, lastOpps: 90 }, { source: 'Rep-sourced', thisOpps: 8, lastOpps: 20 }];
  DATA.team_tree = [{ name: 'Top Leader', email: 'top@x.test', manager: null, isLeader: true, isTop: true }, { name: 'Dana Manager', email: 'dana@x.test', manager: 'Top Leader', isLeader: true }, { name: 'Sam Manager', email: 'sam@x.test', manager: 'Top Leader', isLeader: true },
    { name: 'Bea Manager', email: 'bea@x.test', manager: 'Top Leader', isLeader: true }, { name: 'Nils Manager', email: 'nils@x.test', manager: 'Top Leader', isLeader: true }, { name: 'Cora Manager', email: 'cora@x.test', manager: 'Top Leader', isLeader: true }];
  runAll();
  const shown = [];
  const keep = (el) => { shown.push(el); return el; };
  // All EMEA
  const t = (field, calc, fmt) => keep(tile({ draw: 'kpi-conv', calc, field, fmt, source: 'conv_' + calc }));
  const win = t('winRate', 'close', 'pct'), y2q = t('y2q', 'cohorts', 'pct');
  ok(/^\d+%$/.test(win.textContent) && win.dataset.where === 'key=All' && /Per quarter: Q4 2025/.test(win.title) && /without the Q3 2026 clean-up/.test(win.title), 'All EMEA: the win-rate tile, per quarter and without the clean-up in its title', [win.textContent, win.title]);
  ok(/^\d+%$/.test(y2q.textContent) && !y2q.classList.contains('os-bad') && !y2q.classList.contains('os-ok') && /Not coloured: SMB was/.test(y2q.title), 'All EMEA: won within 2 quarters is never coloured, and says why');
  const sub = keep(draw('kpi-conv-y2q', 'span')).textContent;
  ok(/created in Q2 2026/.test(sub) && /SMB \d+% \(\d+% open at 2Q\) · Field \d+%/.test(sub), 'All EMEA: SMB and Field with their share still open at 2 quarters', sub);
  const peerAll = keep(draw('kpi-conv-peer', 'span')).textContent;
  ok(/^ · SMB \d+% · Field \d+%$/.test(peerAll), 'All EMEA: the win rate\'s SMB and Field beside it', peerAll);
  ok(keep(draw('kpi-conv-leak', 'b', { k: 'step' })).textContent.startsWith('Lowest: '), 'All EMEA has no peers: the leak tile shows the lowest step');
  const old = t('staleOpen', 'cohorts'); old.attrs['data-warn'] = ''; draws['kpi-conv'](old);
  ok(old.textContent === '25' && old.classList.contains('os-warn'), 'All EMEA: old deals at stage 0–1 (created Q1 2026 or before, older ones included: 8 + 8 + 9)', old.textContent);
  const stepAll = rowsOf('conv-step-table');
  ok(cells(stepAll[0])[0] === 'All EMEA' && stepAll[0].className === 'os-total' && cells(stepAll[1])[0] === 'SMB' && cells(stepAll[2])[0] === 'Field' && stepAll.length === 7 && stepAll.filter((r) => cells(r)[0] === 'SMB').length === 1, 'All EMEA: the step table, All EMEA then SMB, Field and the teams (SMB once)', stepAll.map((r) => cells(r)[0]));
  ok(/^\d+%$/.test(cells(stepAll[0])[3]), 'step table: win rate 4Q from conv_close');
  ok(rowsOf('conv-cohort-table').length === 5 && cells(rowsOf('conv-cohort-table')[0])[1] === 'This quarter', 'All EMEA: five cohorts, newest first');
  ok(items('conv-trust-list').length >= 20, 'All EMEA: the trust list');
  // the segment switch
  params.cvSeg = 'smb';
  ok(keep(draw('kpi-conv-y2q', 'span')).textContent.indexOf('Field') < 0 && cells(rowsOf('conv-step-table')[0])[0] === 'SMB', 'SMB segment: SMB only, no peers (never against Field)');
  params.cvSeg = 'field';
  ok(cells(rowsOf('conv-step-table')[0])[0] === 'Field' && rowsOf('conv-step-table').every((r) => cells(r)[0] !== 'SMB'), 'Field segment: Field and its teams');
  params.cvSeg = 'all';
  // a team
  params.region = 'DACH';
  const stepD = rowsOf('conv-step-table');
  ok(cells(stepD[0])[0] === 'DACH' && cells(stepD[1])[0] === 'Dana Manager' && cells(stepD[stepD.length - 1])[0] === 'Field', 'DACH: the team, its managers, then Field for reference', stepD.map((r) => cells(r)[0]));
  ok(/other AE teams/.test(keep(draw('kpi-conv-y2q', 'span')).textContent) && keep(draw('conv-peer', 'b')).textContent === 'other AE teams', 'DACH: compared with the other AE teams');
  const peerD = keep(draw('kpi-conv-peer', 'span')).textContent;
  ok(/^ · other AE teams \d+%$/.test(peerD), 'DACH: the win rate against the other AE teams', peerD);
  ok(keep(tile({ draw: 'kpi-conv', calc: 'close', field: 'winRate', fmt: 'pct', source: 'conv_close' })).dataset.where === 'key=DACH', 'DACH: the win-rate mark names its row');
  params.region = 'BDR';
  ok(keep(draw('conv-peer', 'b')).textContent === 'nobody: no fair peers here', 'BDR: nobody to compare with');
  params.region = 'All';
  // a manager: cohort figures for their direct reports, close figures for conv_mgr's team
  params.mgr = 'Dana Manager';
  ok(tile({ draw: 'kpi-conv', calc: 'close', field: 'winRate', fmt: 'pct', source: 'conv_close' }).dataset.where === 'key=DACH' && tile({ draw: 'kpi-conv', calc: 'cohorts', field: 'y2q', fmt: 'pct', source: 'conv_cohorts' }).dataset.where === 'key=M%7CDana%20Manager%7CNew%20Business', 'manager: cohorts for their reports, win rate for their team');
  const stepM = rowsOf('conv-step-table');
  ok(cells(stepM[0])[0] === 'Dana Manager' && cells(stepM[1])[0] === 'DACH' && cells(stepM[2])[0] === 'All EMEA', 'manager: their row, their team, All EMEA', stepM.map((r) => cells(r)[0]));
  ok(keep(draw('conv-mgr-team', 'b')).textContent === 'DACH (2 of 2)', 'manager: the scope note names their team');
  STATE.conv_mgr = 'loading';
  const wl = keep(tile({ draw: 'kpi-conv', calc: 'close', field: 'winRate', fmt: 'pct', source: 'conv_close' }));
  ok(wl.textContent === '—' && !wl.dataset.where, 'manager while conv_mgr loads: the close tiles draw —, never All EMEA', wl.textContent);
  ok(rowsOf('conv-reason-table').length === 0 && rowsOf('conv-src-table').length === 0, 'manager while conv_mgr loads: losses and sources wait');
  const slot = (name) => { const ps = ['empty', 'nomgr', 'error', 'loading'].map((k) => { const p = new Node('p'); p.dataset.msgFor = name; p.dataset.msg = k; p.hidden = true; return p; }); REG['[data-msg-for]'] = ps; const s = new Node('span'); s.dataset.for = name; OS.drawMsg(s); return { cls: s.className, shown: ps.filter((p) => !p.hidden).map((p) => p.dataset.msg) }; };
  ok(slot('conv-reason-table').cls.includes('dash-skeleton'), 'manager while conv_mgr loads: the losses pane shows loading');
  delete STATE.conv_mgr;
  params.mgr = 'Nobody Known';
  ok(tile({ draw: 'kpi-conv', calc: 'close', field: 'winRate', fmt: 'pct', source: 'conv_close' }).textContent === '—' && slot('conv-reason-table').shown.join() === 'nomgr' && slot('conv-src-table').shown.join() === 'nomgr', 'manager with no team: — on the close tiles, "No EMEA sales team found" on losses and sources');
  REG['[data-msg-for]'] = [];
  params.mgr = '';

  // the scope note and the switch follow the scope (apply() and onData)
  const note = (k) => { const n = new Node('span'); n.dataset.cvNoteK = k; return n; };
  const NOTES = ['all', 'team', 'bdr', 'mgr'].map(note), seg2 = new Node('div'); seg2.dataset.segViews = 'created:conversion'; seg2.dataset.cvSegs = '';
  const chip = new Node('button'); chip.dataset.cvClean = ''; chip.hidden = true;
  REG['[data-cv-note-k]'] = NOTES; REG['[data-seg-views]'] = [seg2]; REG['[data-cv-segs]'] = [seg2]; REG['[data-cv-clean]'] = [chip];
  const vis = () => NOTES.filter((n) => !n.hidden).map((n) => n.dataset.cvNoteK).join();
  fire();
  ok(vis() === 'all' && !seg2.hidden && !chip.hidden, 'note: all EMEA; the switch shows; the clean-up chip shows (Q3 2026)', [vis(), seg2.hidden, chip.hidden]);
  params.region = 'DACH'; fire();
  ok(vis() === 'team' && seg2.hidden, 'note: a team; the switch hides');
  params.region = 'BDR'; fire();
  ok(vis() === 'bdr', 'note: the BDR team explains BDR-owned deals');
  params.region = 'All'; params.mgr = 'Bea Manager'; fire();
  ok(vis() === 'bdr,mgr', 'note: a BDR manager gets the BDR sentence beside the manager one', vis());
  params.mgr = ''; fire();

  // the clean-up toggle: the losses table from conv_closeout's figures
  const lossAll = rowsOf('conv-reason-table');
  params.cvClean = true;
  const lossClean = rowsOf('conv-reason-table');
  ok(lossAll[0].dataset.key === 'All|*' && lossClean[0].dataset.key === 'clean|All|*' && +cells(lossClean[0])[1] < +cells(lossAll[0])[1], 'clean-up toggle: the losses table without the clean-up quarter', [cells(lossAll[0])[1], cells(lossClean[0])[1]]);
  ok(keep(draw('conv-clean-why', 'span')).textContent.startsWith('Q3 2026: '), 'clean-up toggle: says which quarter and why');
  params.cvClean = false;
  const nf = lossAll.find((r) => r.dataset.key === 'All|Not a fit');
  ok(nf && /was Qualified Out/.test(nf.textContent), 'losses: Not a fit was Qualified Out');
  ok(lossAll.find((r) => r.dataset.key === 'All|Not a fit').children[8].title === 'last quarter was a clean-up quarter: not compared', 'losses: last quarter not compared after a clean-up quarter');

  // ===================== 5) requests: guard first, at most 3,600 bytes, no lost notes =====================
  const sizes = [];
  const collect = (label) => {
    const out = [];
    for (const n of ['conv-step-table', 'conv-cohort-table', 'conv-reason-table']) out.push(...asks(draw(n, 'tbody')));
    for (const n of ['conv-monday', 'conv-smb', 'conv-src-ask']) out.push(...asks(draw(n, 'span')));
    out.push(...asks(draw('conv-trust-list', 'ul')));
    return out.map((d) => ({ d, label }));
  };
  // 5-digit counts and 16 source values
  const scale = (rs, f) => rs.map((r) => ({ ...r, n: r.n * f }));
  DATA.cv_open = scale(fix.open, 211); DATA.cv_closed = scale(fix.closed, 211); DATA.cv_window = scale(DATA.cv_window, 377); DATA.cv_source = scale(DATA.cv_source, 377);
  runAll();
  const srcVals = DATA.conv_sources.filter((r) => r.scope === 'All' && r.kind === 'source');
  ok(srcVals.length === 16 && srcVals.every((r) => r.closed >= 10000), '16 source values with 5-digit counts', srcVals.length);
  let reqs = collect('All EMEA');
  params.region = 'DACH'; reqs = reqs.concat(collect('DACH'));
  params.region = 'All'; params.mgr = 'Dana Manager'; reqs = reqs.concat(collect('manager'));
  params.mgr = '';
  // the data checks' Fix and the 1:1 point
  DATA.checks = []; for (const id of OS.CHECKS) if (!DATA[id]) DATA[id] = [];
  params.checkArea = 'Conversion';
  const fixes = asks(draw('check-list', 'ul'));
  params.checkArea = 'All';
  DATA.oo_points = [{ key: 'p', email: 'dana@x.test', name: 'Dana Manager', section: 'numbers', sev: '', order: 0, text: 'Pipeline this quarter $1M.' }]; DATA.oo_points_rr = []; DATA.oo_points_act = []; DATA.oo_upcoming = []; DATA.oo_followups = []; DATA.users_all = [];
  params.ooWho = 'dana@x.test';
  const talk = asks(draw('oo-talk', 'ul')).filter((d) => /conversion|won within 2 quarters|leak|stage 0–1/i.test(d.ask));
  params.ooWho = '';
  reqs = reqs.concat(fixes.map((d) => ({ d, label: 'check' })), talk.map((d) => ({ d, label: '1:1 point' })));
  const kinds = new Set(reqs.map((x) => x.d.label.split(':')[0].replace(/ .*/, '')));
  ok(reqs.length >= 30 && ['Dig', 'Explain', 'Count', 'Monday', 'Review', 'Which', 'Fix', '1'].every((k) => [...kinds].some((x) => x.startsWith(k))), 'requests: every kind built (Dig into, Explain, Count these losses, Monday, SMB review, source, Fix, 1:1 point)', [...kinds]);
  for (const { d, label } of reqs) sizes.push([label, d.label, new TextEncoder().encode(JSON.stringify(d)).length]);
  const worst = sizes.slice().sort((a, b) => b[2] - a[2])[0];
  const byKind = {}; for (const [, l, n] of sizes) { const k = l.replace(/:.*/, '').replace(/ (the|Dana|DACH|All|Q\d).*$/, ''); byKind[k] = Math.max(byKind[k] || 0, n); }
  console.log('     largest request by kind (bytes):', JSON.stringify(byKind));
  ok(sizes.every(([, , n]) => n <= 3600), 'requests: each at most 3,600 bytes as JSON (largest ' + worst[2] + ', ' + worst[1].replace(/:.*/, '') + ')', worst);
  ok(reqs.every(({ d }) => d.ask.startsWith(GUARD) && !/… \(cut/.test(d.ask)), 'requests: the counts-only guard comes first, nothing cut', reqs.filter(({ d }) => !d.ask.startsWith(GUARD)).map(({ d }) => d.label));
  ok(reqs.every(({ d }) => !/lost notes?|Lost_Notes__c/i.test(d.ask)), 'requests: none mentions Lost Notes');
  const alt = reqs.filter(({ d }) => d.label === 'Count these losses: Chose an alternative');
  ok(alt.length > 0 && alt.every(({ d }) => /Don't name the competitors/.test(d.ask) && !/Lost Detail/.test(d.ask)), 'requests: losses to an alternative never ask for competitor names or Lost Detail', alt.length);

  // ===================== 6) the privacy scan: cells, copied tables, requests =====================
  const text = [];
  for (const el of shown) text.push(el.textContent, el.title || '');
  for (const n of ['conv-step-table', 'conv-cohort-table', 'conv-reason-table', 'conv-src-table', 'conv-time-table']) { text.push(...rowsOf(n).map((r) => r.textContent)); text.push(OS.tableText(n)); }
  text.push(...items('conv-trust-list').map((li) => li.textContent));
  text.push(...reqs.map(({ d }) => JSON.stringify(d)));
  text.push(...DATA.oo_points_conv.map((r) => r.text), ...[...DATA.checks_conv, ...DATA.checks_conv_lost, ...DATA.checks_conv_days].map((c) => c.what + c.meta + c.how));
  const hay = text.join('\n');
  ok(!ID_RE.test(hay), 'privacy: no record Id in any cell, copied table or request');
  ok(!Object.values(PLANT).slice(0, 3).some((nm) => hay.includes(nm)), 'privacy: no planted deal, account or competitor name anywhere');

  // ===================== 7) agendas: leaders only, the loading and missing line =====================
  reset();
  setCv(fix); DATA.team_tree = [{ name: 'Top Leader', email: 'top@x.test', manager: null, isLeader: true, isTop: true }, { name: 'Dana Manager', email: 'dana@x.test', manager: 'Top Leader', isLeader: true }, { name: 'Dana Rep', email: 'rep@x.test', manager: 'Dana Manager', isLeader: false },
    { name: 'Bea Manager', email: 'bea@x.test', manager: 'Top Leader', isLeader: true }];
  run('oo_points_conv');
  const byE = (e) => DATA.oo_points_conv.filter((r) => r.email === e);
  ok(byE('dana@x.test').length >= 1 && byE('top@x.test').length >= 1 && byE('rep@x.test').length === 0 && byE('bea@x.test').length === 0, 'agendas: leaders get conversion lines; a rep and a leader of BDR-owned deals get none');
  ok(/^Conversion, all EMEA New Business created in Q2 2026: \d+% won within 2 quarters; SMB \d+% \(Q1 2026 \d+%\) and Field \d+%/.test(byE('top@x.test')[0].text), 'agendas: the top EMEA leader sees SMB and Field side by side', byE('top@x.test')[0].text);
  ok(/^Team conversion, New Business created in Q2 2026: \d+% of the team's deals won within 2 quarters \(\d+ of \d+; Q1 2026 \d+%; the rest of the AE teams \d+%\)/.test(byE('dana@x.test')[0].text), 'agendas: a leader\'s numbers line against the quarter before and the rest of the AE teams', byE('dana@x.test')[0].text);
  Object.assign(DATA, { oo_points: [{ key: 'p', email: 'dana@x.test', name: 'Dana Manager', section: 'numbers', sev: '', order: 0, text: 'Pipeline this quarter $1M.' }], oo_points_rr: [], oo_points_act: [], oo_upcoming: [], oo_followups: [], users_all: [], sf_me: [] });
  params.ooWho = 'dana@x.test';
  ok(/\nNumbers\n- Pipeline this quarter \$1M\.\n- Team conversion, /.test(OS.oo.text()), 'agenda: conversion after the core numbers', OS.oo.text());
  STATE.oo_points_conv = 'error';
  const txt = OS.oo.text();
  ok(/\nNumbers\n- Pipeline this quarter \$1M\.\n- Conversion: not available \(couldn't load\)/.test(txt) && /Anything else$/.test(txt), 'agenda: conversion failed, the agenda still builds and says so', txt);
  const emp = new Node('span'); emp.dataset.for = 'oo-talk'; REG['[data-msg-for]'] = [['empty', 'emptycore', 'nodata'].map((k) => { const p = new Node('p'); p.dataset.msgFor = 'oo-talk'; p.dataset.msg = k; p.hidden = true; return p; })].flat(); OS.drawMsg(emp);
  ok(REG['[data-msg-for]'].filter((p) => !p.hidden).map((p) => p.dataset.msg).join() === 'emptycore', 'agenda: nothing else flagged for a leader whose conversion lines failed: the emptycore note');
  STATE.oo_points_conv = 'loading';
  ok(/- Conversion: still loading/.test(OS.oo.text()), 'agenda: while conversion loads, the copy says so');
  params.ooWho = 'rep@x.test'; DATA.oo_points.push({ key: 'q', email: 'rep@x.test', name: 'Dana Rep', section: 'numbers', sev: '', order: 0, text: 'Pipeline $1.' });
  ok(!/Conversion/.test(OS.oo.text()), 'agenda: a rep\'s agenda has no conversion line');
  delete STATE.oo_points_conv; params.ooWho = ''; REG['[data-msg-for]'] = [];

  // ===================== 8) the weekly line, partial checks, failure isolation, a cut answer =====================
  reset();
  setCv(fix); DATA.cv_window = [{ fy: 2026, fq: 2, role: 'AE-EMEA-DACH', closedRole: 'AE-EMEA-DACH', won: true, lastStage: '6 - Opt-out', reason: null, n: 60, arr: 1 }, { fy: 2026, fq: 2, role: 'AE-EMEA-DACH', closedRole: 'AE-EMEA-DACH', won: false, lastStage: '1 - Solution agreement', reason: 'Budget', n: 40, arr: 1 }];
  DATA.cv_lost_month = []; DATA.cv_source = []; DATA.cv_days = []; DATA.cr_monthly = []; DATA.roster = [];
  runAll();
  Object.assign(DATA, { pipe_team: [], pipe_cover: [{ key: 'All|All', avgBookings: 100, wonSoFar: 10, toGo: 90, openThis: 200, coverageThis: 2.2, coverageNext: 1, projectedThis: 150, winRate: 0.55, aheadOfUsual: false }], moves_kpi: [], cr_kpi: [], risk_kpi: [], rr_kpi: [], leavers_core: [], leavers_leads: [], leavers_pools: [], ld_kpi: [], ld_kpi_rt: [], act_kpi: [], orphan_kpi: [], engagement_kpi: [], gr_actions: [], gr_kpi: [] });
  for (const id of OS.CHECKS) if (!DATA[id]) DATA[id] = [];
  let sum = press('copySummary');
  ok(/at a 55% win rate by ARR/.test(sum), 'weekly: the Coverage line says by ARR', sum);
  ok(/• Conversion: New Business win rate by count 60% over the last 4 quarters \(60 won, 40 lost, by who closed them\); of deals created in Q2 2026, SMB won \d+% within 2 quarters/.test(sum), 'weekly: the Conversion line after Coverage', sum.split('\n').find((l) => /Conversion/.test(l)));
  ok(sum.indexOf('• Coverage') < sum.indexOf('• Conversion'), 'weekly: Conversion follows Coverage');
  STATE.conv_close = 'error';
  sum = press('copySummary');
  ok(/• Conversion: of deals created in Q2 2026[^\n]*\(win rate not available\)/.test(sum), 'weekly: a failed part is left out and named', sum.split('\n').find((l) => /Conversion/.test(l)));
  delete STATE.conv_close; STATE.conv_cohorts = 'error';
  sum = press('copySummary');
  ok(/• Conversion: not available \(couldn't load\)/.test(sum), 'weekly: conversion failed: not available', sum.split('\n').find((l) => /Conversion/.test(l)));
  delete STATE.conv_cohorts;
  params.mgr = 'Dana Manager';
  sum = press('copySummary');
  ok(/• Conversion: \d+% of the team's deals created in Q2 2026/.test(sum) && !/win rate by count/.test(sum), 'weekly: with a manager picked, no per-team win rate', sum.split('\n').find((l) => /Conversion/.test(l)));
  params.mgr = '';
  // partial checks: one conversion source failed, the rest still listed, and the summary says so
  DATA.checks = [{ id: 'c1', area: 'Pipeline', severity: 'high', title: 'A', what: 'x', region: 'DACH', manager: 'M' }];
  STATE.checks_conv_lost = 'error';
  const cl8 = items('check-list');
  ok(cl8.length === 1 + DATA.checks_conv.length + DATA.checks_conv_days.length && /some checks couldn't load/.test(press('copySummary')), 'checks: one conversion source failed: the rest still listed, the summary says some couldn\'t load');
  delete STATE.checks_conv_lost;
  // failure isolation: each calc on its own
  for (const id of ['conv_close', 'conv_reasons', 'conv_closeout', 'conv_sources', 'conv_time', 'conv_mgr']) {
    STATE[id] = 'error';
    const stepOk = rowsOf('conv-step-table').length > 0 && rowsOf('conv-cohort-table').length > 0;
    const yt = tile({ draw: 'kpi-conv', calc: 'cohorts', field: 'y2q', fmt: 'pct', source: 'conv_cohorts' }).textContent;
    ok(stepOk && /%$/.test(yt) && items('conv-trust-list').length > 0, 'isolation: ' + id + ' failed: leaks, cohorts, the y2q tile and the trust list still draw');
    delete STATE[id];
  }
  STATE.conv_steps = 'error'; STATE.conv_cohorts = 'error';
  ok(rowsOf('conv-reason-table').length > 0 && rowsOf('conv-src-table').length >= 0 && /%$/.test(tile({ draw: 'kpi-conv', calc: 'close', field: 'winRate', fmt: 'pct', source: 'conv_close' }).textContent), 'isolation: cohorts failed: win rate and losses still draw');
  const tl = items('conv-trust-list').map((li) => li.textContent);
  delete STATE.conv_steps; delete STATE.conv_cohorts;
  STATE.conv_trust_close = 'error';
  ok(items('conv-trust-list').some((li) => /^Couldn't load/.test(li.textContent) && /win-rate checks/.test(li.textContent)) && tl.length > 0, 'isolation: a trust source failed: named, the rest listed');
  delete STATE.conv_trust_close;
  // a cut answer at 2,000 rows
  const cut = loaders.cv_closed.fn({ answer: { totalSize: 2000, done: true, records: Array.from({ length: 2000 }, () => ({ attributes: { type: 'AggregateResult' }, rt: 'New Business', fy: 2026, fq: 2, n: 1 })) }, args: ds.cv_closed.source.args });
  ok(cut.cut === true, 'cut: an answer filling the LIMIT is marked cut');
  DATA.cv_closed = cut.rows.map((r) => ({ ...r, role: 'AE-EMEA-DACH', manager: 'X', closedRole: 'AE-EMEA-DACH', closedManager: 'X', won: false, cfy: 2026, cfq: 3, s0: 1, s1: 1, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, cwStamp: 0, clStamp: 0, arr: 0 }));
  const capT = run('conv_trust_cohort').find((x2) => x2.id === 'cap'), capC = run('checks_conv').find((c) => c.id === 'conv:cap');
  ok(capT.severity === 'bad' && /Closed by quarter 2,000 rows \(cut: totals too low\)/.test(capT.detail) && capC && capC.severity === 'low', 'cut: the trust row turns red and a data check fires', capT.detail);
  DATA.cv_window = Array.from({ length: 2000 }, () => ({ fy: 2026, fq: 2, role: 'AE-EMEA-DACH', closedRole: 'AE-EMEA-DACH', won: true, lastStage: '6', reason: null, n: 1, arr: 1 }));
  ok(run('conv_trust_close').find((x2) => x2.id === 'windowCap').severity === 'bad' && run('checks_conv_lost').some((c) => c.id === 'conv:windowcap'), 'cut: the win-rate data cut at 2,000 rows is flagged');

  // ===================== 9) Bookings: one old and one new value of the same group make one bar =====================
  reset();
  DATA.closed_rep = [{ owner: 'A', role: 'AE-EMEA-FR', manager: 'M', closedOwner: 'A', closedRole: 'AE-EMEA-FR', closedManager: 'M', rt: 'New Business', won: false, lostReason: 'Timing', fy: 2026, fq: 4, opps: 2, arrUsd: 1 },
    { owner: 'B', role: 'AE-EMEA-FR', manager: 'M', closedOwner: 'B', closedRole: 'AE-EMEA-FR', closedManager: 'M', rt: 'New Business', won: false, lostReason: 'Deferred', fy: 2026, fq: 4, opps: 3, arrUsd: 1 }];
  run('lost_reasons');
  const bars = []; const box = new Node('div'); const oh = OS.hbars; OS.hbars = (b, rs) => bars.push(...rs); draws['lost-chart'](box); OS.hbars = oh;
  ok(bars.length === 1 && bars[0].thisQ === 5 && bars[0].label === 'Deferred', 'Bookings: Timing and Deferred are one bar (the pane note gives the mapping)', bars);

  console.log(passes + ' passed, ' + fails + ' failed');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e); process.exit(1); });
