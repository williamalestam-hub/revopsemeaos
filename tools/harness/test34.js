// Final live check fixes (4 Nov 2026), on the real calcs, drawings and page text: the weekly summary says "Account books:
// not available" when its source fails, and the RevOps work in 1:1 agendas keeps that line; a change that rounds to zero
// shows as 0%, never −0% or +0% (summary, Monday summary, activity table, 1:1 points, the sources tooltip), and a net
// Commit of zero as $0 (and no −$0 anywhere: OS.usd); halves round away from zero, as OS.pct does; the Leads line says
// when routing couldn't load; every activity request to Claude ends with ACT_GUARD (the Monday summary and the Quiet check-in
// too) and the person panel's About request keeps activity text out of chat; the scope menu's manager search says
// when nothing matches, naming the team when one is picked. Synthetic rows only; prints labels and counts.
// CONV_REPO=<checkout> runs it against another checkout (for example an export of 945ee84, where it fails).
const { Node } = require('./fakedom.js');
const NOW = Date.parse('2026-11-04T10:00:00Z');
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const fs = require('fs');
const REPO = (process.env.CONV_REPO || '/home/user/revopsemeaos').replace(/\/?$/, '/');
const D = REPO + 'dashboard/';
const calcs = {}, draws = {}, loaders = {}, onData = [];
let params = { region: 'All', mgr: '', person: '', checkArea: 'All', ooWho: '', cvSeg: 'all', cvRt: 'nb', cvClean: false, grWindow: 30 };
const DATA = {}, STATE = {};
global.dash = { loader: (id, o) => { loaders[id] = o; }, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; onData.forEach((f) => f()); }, onData: (fn) => { onData.push(fn); }, colors: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'], setLink: () => {},
  data: (id) => (STATE[id] ? { status: STATE[id], data: [] } : id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: (f) => (v) => (f === '.1f' ? (+v).toFixed(1) : f === '.0%' ? Math.round(v * 100) + '%' : f === ',' ? Math.round(v).toLocaleString('en') : String(v)), max: (a, f) => (a.length ? Math.max(...a.map(f)) : undefined), select: () => ({ selectAll: () => ({ remove() {} }) }) };
global.claude = { use: async (n) => (n === 'room' ? { canSendToClaudeSession: async () => 'available', sendToClaudeSession: () => Promise.resolve({}) } : null) };
global.location.hash = '#home';
document.querySelector = (sel) => (/data-view-panel/.test(sel) ? new Node('div') : null);
document.querySelectorAll = () => [];
document.addEventListener = () => {};
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: () => Promise.resolve() } }, configurable: true, writable: true });
for (const f of ['os-core.js', 'os-calcs.js', 'os-calcs-leads.js', 'os-calcs-act.js', 'os-calcs-conv.js', 'os-draw.js']) require(D + f);
let fails = 0, passes = 0; const ok = (c, l, x) => { if (!c) fails++; else passes++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const walk = (n, f) => { f(n); for (const c of n.children || []) walk(c, f); };
const nodes = (el, pick) => { const out = []; walk(el, (n) => { if (pick(n)) out.push(n); }); return out; };
const draw = (name, tag = 'div') => { const el = new Node(tag); el.dataset.draw = name; draws[name](el); return el; };
const asks = (el) => nodes(el, (n) => n.dataset && n.dataset.ask).map((n) => JSON.parse(n.dataset.ask));
const reset = () => { for (const k of Object.keys(DATA)) delete DATA[k]; for (const k of Object.keys(STATE)) delete STATE[k]; params = { ...params, region: 'All', mgr: '' }; };
const SRC = fs.readFileSync(D + 'os-core.js', 'utf8') + fs.readFileSync(D + 'os-draw.js', 'utf8') + fs.readFileSync(D + 'os-calcs-act.js', 'utf8') + fs.readFileSync(D + 'os-calcs-conv.js', 'utf8') + fs.readFileSync(D + 'os-calcs.js', 'utf8') + fs.readFileSync(D + 'os-calcs-leads.js', 'utf8');
const ACT_GUARD = (fs.readFileSync(D + 'os-draw.js', 'utf8').match(/const ACT_GUARD = '([^']+)';/) || [])[1];
ok(!!ACT_GUARD && /^ Counts only/.test(ACT_GUARD), 'ACT_GUARD read from os-draw.js');
// asks draw once the page knows Claude can be asked (claude.use resolves after the first tick)
(async () => {
await new Promise((r) => setTimeout(r, 0));
ok(OS.ask.can(), 'asks are on (Claude reachable)');

// ---- 1. signed percentages: a change that rounds to zero has no sign ----
{
  const sp = OS.signedPct;
  ok(typeof sp === 'function', 'OS.signedPct exists');
  const cases = [[-0.004, '0%'], [0.004, '0%'], [-0.0049, '0%'], [0.0049, '0%'], [0, '0%'], [-0, '0%'], [0.005, '+1%'], [-0.005, '−1%'], [-0.006, '−1%'], [0.015, '+2%'], [-0.015, '−2%'], [0.025, '+3%'], [-0.025, '−3%'], [0.25, '+25%'], [-0.3, '−30%'], [1.5, '+150%'], [null, '—'], [undefined, '—'], [NaN, '—']];
  const bad = cases.filter(([v, want]) => (sp ? sp(v) : null) !== want).map(([v, want]) => [String(v), want, sp ? sp(v) : null]);
  ok(!bad.length, 'OS.signedPct: zero-rounding changes show 0%, halves round away from zero on both sides, missing shows —', bad);
  // the same magnitude as OS.pct (d3 .0% rounds halves away from zero) for every value from −3% to +3% in 0.05-point steps
  const sym = sp ? [] : ['no signedPct']; if (sp) for (let i = -600; i <= 600; i++) { const v = i / 20000; const a = sp(v).replace(/^[−+]/, ''); const b = sp(-v).replace(/^[−+]/, ''); if (a !== b) sym.push(v); }
  ok(sym.length === 0, 'OS.signedPct is symmetric: v and −v show the same magnitude', sym.slice(0, 5));
  // the 1:1 points calc keeps its own copy (calcs don't read OS): the same rule
  const m = fs.readFileSync(D + 'os-calcs-act.js', 'utf8').match(/const sgn = (\(v\) => \{[^\n]*\});/);
  const sgn = m ? eval(m[1]) : null;
  const bad2 = sgn ? cases.filter(([v]) => typeof v === 'number' && !Number.isNaN(v)).filter(([v, want]) => sgn(v) !== want).map(([v, want]) => [String(v), want, sgn(v)]) : ['no sgn'];
  ok(!bad2.length, 'os-calcs-act.js sgn (1:1 activity points): the same rule', bad2);
  const usdCases = [[0, '$0'], [-0, '$0'], [-0.04, '$0'], [-1e-12, '$0'], [0.04, '$0'], [-2500, '−$2.5K'], [2500, '$2.5K'], [-0.2, '−$0.2'], [null, '—'], [NaN, '—']];
  const badU = usdCases.filter(([v, want]) => OS.usd(v) !== want).map(([v, want]) => [String(v), want, OS.usd(v)]);
  ok(!badU.length, 'OS.usd: a negative that formats as 0 shows $0, not −$0; real negatives keep −', badU);
  // no formatter left that puts a sign on a rounded zero
  const left = SRC.match(/\? '−' : '\+'\) \+ Math\.abs\(Math\.round\(/g) || [];
  ok(left.length === 0, 'no "(v < 0 ? − : +) + |round|" formatter left in the page code', left.length);
}

// ---- 2. weekly summary: the books line, a zero net Commit, a zero like-for-like change ----
{
  const ORPH = [{ accounts: 3, arr: 5000, splitBooks: 2 }];
  const books = (sc) => OS.summary.lines(sc).lines.filter((l) => l.key === 'books');
  reset(); DATA.orphan_kpi = ORPH;
  let b = books();
  ok(b.length === 1 && /^Account books: 3 orphan active accounts \(\$5K ARR\), 2 split books$/.test(b[0].text) && b[0].sev === 'medium', 'All EMEA, loaded: the books line with its counts', b.map((l) => l.text));
  for (const st of ['error', 'connect', 'declined']) {
    reset(); STATE.orphan_kpi = st;
    b = books();
    ok(b.length === 1 && b[0].text === "Account books: not available (couldn't load)" && b[0].sev === 'low', `All EMEA, orphan_kpi ${st}: "Account books: not available", low`, b.map((l) => [l.text, l.sev]));
  }
  reset(); STATE.orphan_kpi = 'missing';
  ok(books().length === 1 && / not available/.test(books()[0].text), "orphan_kpi 'missing' (an input never answered) also reads not available", books().map((l) => l.text));
  reset();
  ok(books().length === 0, 'still loading: no books line (the summary waits)', books().length);
  reset(); STATE.orphan_kpi = 'error'; params.mgr = 'Some Manager';
  ok(books().length === 0, 'a manager picked: no books line, even when its source failed', books().length);
  reset(); STATE.orphan_kpi = 'error'; params.region = 'France';
  ok(books().length === 0, 'a region picked: no books line, even when its source failed', books().length);
  reset(); STATE.orphan_kpi = 'error';
  const ops = books({ region: 'All', mine: false });
  ok(ops.length === 1 && / not available/.test(ops[0].text), "the 1:1 agendas' RevOps work (all EMEA, mine false) keeps the books line", ops.map((l) => l.text));
  reset(); DATA.orphan_kpi = ORPH;
  ok(books({ region: 'All', mine: false }).length === 1 && / orphan active accounts/.test(books({ region: 'All', mine: false })[0].text), '... and its numbers when loaded');

  const MV = (net) => [{ region: 'All', won: 2, wonArr: 3000, lost: 1, lostArr: 1000, pushed: 0, pushedArr: 0, pulled: 0, netCommitArr: net }];
  const moves = () => (OS.summary.lines().lines.find((l) => l.key === 'moves') || {}).text || '';
  for (const [net, want] of [[0, 'Commit $0 net'], [2500, 'Commit +$2.5K net'], [-2500, 'Commit −$2.5K net'], [-0.04, 'Commit $0 net']]) {
    reset(); DATA.moves_kpi = MV(net);
    ok(moves().endsWith(want), `last 7 days line, net Commit ${net}: "${want}"`, moves());
  }

  const ACT = (chg) => [{ region: 'All', meetings: 40, meetCust: 12, booked: 9, emails: 300, meetChg: chg, lflMeetReps: 7, quiet: 0, slowing: 1, nothingBooked: 0, noCapture: 0, sellers: 9, notVisible: 0 }];
  const actLine = () => (OS.summary.lines().lines.find((l) => l.key === 'activity') || {}).text || '';
  for (const [chg, want] of [[-0.003, 'meetings 0% like-for-like (7 people compared)'], [0.004, 'meetings 0% like-for-like (7 people compared)'], [-0.12, 'meetings −12% like-for-like (7 people compared)'], [0.2, 'meetings +20% like-for-like (7 people compared)']]) {
    reset(); DATA.act_kpi = ACT(chg);
    ok(actLine().includes(want) && !/[−+]0%/.test(actLine()), `activity line, like-for-like ${chg}: "${want}"`, actLine());
  }
  // the net-Commit tiles format with OS.usd too: a residue of cancelled cents reads $0
  reset(); DATA.moves_kpi = MV(-9.09e-13);
  { const el = new Node('b'); el.dataset.draw = 'kpi-mv'; el.dataset.field = 'netCommitArr'; el.dataset.fmt = 'usd'; draws['kpi-mv'](el);
    ok(el.textContent === '$0', 'kpi-mv net-Commit tile, a −9e-13 residue: $0', el.textContent); }

  // Leads: routing (ld_kpi_rt, LeanData fields) failing while ld_kpi loads
  const LD = (extra = {}) => [{ region: 'All', handoffs: 12, readyNow: 5, demoWaiting: 0, stale: 0, hRate: 0.5, hWithin: 6, hEligible: 12, lEligible: 12, notScored: 0, ...extra }];
  const leads = (sc) => OS.summary.lines(sc).lines.find((l) => l.key === 'leads') || null;
  reset(); DATA.ld_kpi = LD(); STATE.ld_kpi_rt = 'error';
  let L = leads();
  ok(L && L.text.endsWith(' (routing not available)') && L.sev === 'low', 'Leads, routing failed, nothing else flagged: says routing not available, sev low', L && [L.text.slice(-40), L.sev]);
  const opsKeys = OS.oo.ops('talk').map((l) => l.key);
  ok(opsKeys.includes('leads'), "... and the 1:1 agendas' RevOps work keeps the Leads line", opsKeys);
  reset(); DATA.ld_kpi = LD({ demoWaiting: 3 }); STATE.ld_kpi_rt = 'error';
  L = leads();
  ok(L && / \(routing not available\)$/.test(L.text) && L.sev === 'medium', 'Leads, routing failed, demo requests waiting: still medium, routing noted', L && [L.text.slice(-40), L.sev]);
  reset(); DATA.ld_kpi = LD(); DATA.ld_kpi_rt = [{ region: 'All', routingIssues: 4 }];
  L = leads();
  ok(L && L.text.endsWith('; 4 leads stuck in routing') && L.sev === 'medium' && !/not available/.test(L.text), 'Leads, routing loaded with 4 stuck: counted, medium, no note', L && [L.text.slice(-40), L.sev]);
  reset(); DATA.ld_kpi = LD(); DATA.ld_kpi_rt = [{ region: 'All', routingIssues: 0 }];
  L = leads();
  ok(L && !/routing/.test(L.text.replace('worked within', '')) && L.sev === null, 'Leads, routing loaded, none stuck, nothing flagged: no routing part, no sev', L && [L.text.slice(-40), L.sev]);
  reset(); DATA.ld_kpi = LD();
  L = leads();
  ok(L && !/not available/.test(L.text), 'Leads, routing still loading: no note (the summary waits)', L && L.text.slice(-40));
}

// ---- 3. activity requests end with ACT_GUARD: the Monday summary and the Quiet check-in ----
{
  const KPI = [{ region: 'All', blind: false, meetings: 40, meetCust: 12, booked: 9, emails: 300, meetChg: -0.004, lflMeetReps: 7, emailsChg: 0.1, lflMailReps: 8, sellers: 3, notVisible: 0, mailHidden: false, meetHidden: false }];
  const rep = (name, status, extra = {}) => ({ name, userId: '005000000000' + String(name.length).padStart(3, '0') + 'AAA', manager: 'Some Manager', region: 'France', kind: 'AE', role: 'AE-EMEA-FR', active: true, status, flags: status === 'Active' ? [] : [status],
    meetings: 3, meetCust: 1, meetPros: 2, meetPrev: 3, emails: 20, emailsPrev: 20, booked: 2, bookedCust: 1, bookedPros: 1, coreChg: -0.004, coreLabel: 'prospect', coreNow: 2, corePrev: 2, emailsChg: 0.003, lastTouch: NOW - 9 * 864e5, lastMail: NOW - 9 * 864e5, lastMeet: NOW - 12 * 864e5, idle: 7, ...extra });
  reset(); DATA.act_kpi = KPI; DATA.act_reps = [rep('Rep Quiet', 'Quiet', { meetings: 0, emails: 0, coreChg: null, emailsChg: null }), rep('Rep Slow', 'Slowing'), rep('Rep Fine', 'Active')];
  const mon = asks(draw('act-monday', 'div'));
  ok(mon.length === 1, 'Monday summary: one request drawn', mon.length);
  const m = mon[0] || {};
  ok((m.ask || '').endsWith(ACT_GUARD), 'Monday summary: ends with ACT_GUARD');
  ok(/Name our own people only\. Draft it for Slack and wait for my OK before posting\./.test(m.ask || ''), 'Monday summary: still names our own people only and waits for OK before posting');
  ok(/meetings 0% like-for-like \(7 people compared\)/.test(m.ask || '') && !/[−+]0%/.test(m.ask || ''), 'Monday summary: a change that rounds to zero reads 0%');
  ok(!/\b00[136QTU][A-Za-z0-9]{12}/.test(m.ask || ''), 'Monday summary: no record Id');
  const tbl = draw('act-table', 'tbody');
  const all = asks(tbl);
  const act = all.filter((a) => a.kind === 'activity');
  const chk = act.filter((a) => /^Draft a check-in/.test(a.label));
  ok(chk.length === 1, 'activity table: one check-in request (the Quiet rep)', chk.length);
  ok(chk.length === 1 && chk.every((a) => a.ask.endsWith(ACT_GUARD) && /wait for my OK before sending/.test(a.ask) && /without mentioning customers/.test(a.ask)), 'check-in: ends with ACT_GUARD, still waits for OK and leaves customers out');
  const miss = act.filter((a) => !a.ask.endsWith(ACT_GUARD));
  ok(act.length >= 3 && miss.length === 0, 'activity table: every activity request ends with ACT_GUARD', [act.length, miss.map((a) => String(a.label).split(':')[0])]);
  const zeroCells = nodes(tbl, (n) => n.tagName === 'TD').filter((td) => /(^|[^\d.,])[−+-]0%/.test(td.textContent));
  ok(zeroCells.length === 0, 'activity table: no cell shows −0% or +0%', zeroCells.length);
  const zeroCell = nodes(tbl, (n) => n.tagName === 'TD').filter((td) => td.textContent === '0%');
  ok(zeroCell.length >= 2, 'activity table: the tiny changes show as 0%', zeroCell.length);
  ok(act.length >= 3 && act.every((a) => !/[−+]0%/.test(a.ask)), 'activity requests: none carries −0% or +0%', act.length);
  // long names (48 characters, 6 in each of the 4 lists) must not push ACT_GUARD off the end (OS.ask.data cuts at 3,900 bytes)
  { const long = (i) => ('Synthetic Person ' + String(i).padStart(2, '0') + ' ').padEnd(48, 'x');
    const st = ['Quiet', 'Slowing', 'Nothing booked', 'No capture'];
    reset(); DATA.act_kpi = KPI; DATA.act_reps = Array.from({ length: 28 }, (_, i) => rep(long(i), st[i % 4], { region: 'France' }));
    const big = (asks(draw('act-monday', 'div'))[0] || {}).ask || '';
    ok(big.length > 1500 && (big.match(/ and 1 more/g) || []).length === 4 && big.endsWith(ACT_GUARD), 'Monday summary with 24 long names (6 per list, 4 lists): not cut, still ends with ACT_GUARD', [big.length, (big.match(/ and 1 more/g) || []).length]); }
}

// ---- 4. the scope menu's manager search says when nothing matches ----
{
  reset(); DATA.roster = [{ isActive: true, manager: 'Alpha Manager', role: 'AE-EMEA-FR' }, { isActive: true, manager: 'Alpha Manager', role: 'AE-EMEA-FR' }, { isActive: true, manager: 'Beta Manager', role: 'SMB-EMEA' }, { isActive: false, manager: 'Gamma Manager', role: 'SMB-EMEA' }];
  const list = (q) => { OS.queries['mgr-list'] = q; const ul = draw('mgr-list', 'ul'); return { lis: nodes(ul, (n) => n.tagName === 'LI'), btns: nodes(ul, (n) => n.tagName === 'BUTTON') }; };
  let r = list('');
  ok(r.btns.length === 3 && r.btns[0].dataset.mgr === '' && r.lis.every((li) => !li.classList.contains('os-empty')), 'no search: "Everyone in the team" and the 2 active managers, no sentence', [r.btns.length]);
  r = list('alpha');
  ok(r.btns.length === 1 && r.btns[0].dataset.mgr === 'Alpha Manager' && r.lis.length === 1, 'a search that matches: just that manager, no sentence', [r.btns.length, r.lis.length]);
  r = list('zzqqxxjj');
  ok(r.btns.length === 0 && r.lis.length === 1 && r.lis[0].classList.contains('os-empty') && r.lis[0].textContent === 'No manager matches. Try part of a name.', 'a search no manager matches: one muted sentence, no buttons', [r.btns.length, r.lis.length, r.lis[0] && r.lis[0].textContent]);
  r = list('gamma');
  ok(r.btns.length === 0 && r.lis.length === 1 && r.lis[0].classList.contains('os-empty'), 'an inactive manager\'s team (no active reports) is not listed: the sentence shows', [r.btns.length, r.lis.length]);
  reset(); OS.queries['mgr-list'] = 'zzqqxxjj';
  const ul = draw('mgr-list', 'ul');
  ok(nodes(ul, (n) => n.tagName === 'LI').length === 0, 'roster still loading: no sentence (nothing to search yet)');
  STATE.roster = 'error'; const ul2 = draw('mgr-list', 'ul');
  ok(nodes(ul2, (n) => n.tagName === 'LI').length === 0, 'roster failed: no "no match" sentence either');
  reset(); DATA.roster = [{ isActive: true, manager: 'Alpha Manager', role: 'AE-EMEA-FR' }, { isActive: true, manager: 'Beta Manager', role: 'SMB-EMEA' }];
  params.region = 'France';
  r = list('beta');
  ok(r.btns.length === 0 && r.lis.length === 1 && r.lis[0].textContent === 'No manager in France matches. Try part of a name, or All EMEA.', 'France picked, searching an SMB manager: the sentence names the team and points to All EMEA', r.lis[0] && r.lis[0].textContent);
  r = list('alpha');
  ok(r.btns.length === 1 && r.btns[0].dataset.mgr === 'Alpha Manager', 'France picked, searching its own manager: listed', r.btns.length);
  OS.queries['mgr-list'] = ''; params.region = 'All';
  const css = fs.readFileSync(D + 'os.css', 'utf8');
  ok(/\.os-empty \{[^}]*color: var\(--color-fg-muted\)/.test(css), 'os.css styles .os-empty as a muted sentence');
}

// ---- 5. the person panel's About request: activity counts only, no email text, read only ----
{
  reset(); params.person = 'Some Person'; DATA.person = [{ name: 'Some Person', role: 'AE-EMEA-FR', region: 'France', manager: 'Some Manager', userId: '005000000000001AAA' }];
  const a = asks(draw('pd-act', 'div')).filter((x) => /^About /.test(x.label));
  ok(a.length === 1, 'person panel: one About request drawn', a.length);
  const t = (a[0] || {}).ask || '';
  ok(/selling activity in the last 4 weeks \(counts only, no names of people or companies outside Legora, no subjects or email text in chat\)/.test(t), 'About: activity is counts only, no outside names, no subjects or email text in chat');
  ok(t.endsWith('Read only: change nothing and send nothing without my OK.'), 'About: ends read only, nothing sent without OK');
  ok(/their pipeline and deals at risk/.test(t), 'About: still asks about their deals (which name accounts), so it does not take the counts-only ACT_GUARD');
  params.person = '';
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST CRASHED', e && e.stack); process.exit(1); });
