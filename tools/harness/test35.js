// Today tab (RevOps Hub v1, docs/hub-spec.md §6 and §7): Today is the first tab and the default screen; the page subscribes
// once to hub/today and draws the four counts, the top items (severity dot, kind, title, due), the brief headline, the
// worker's last run (red when failed or older than 8 hours) and Open the Hub (hidden without a URL); the empty state when the
// document is missing; a document that can't be read; no database at all (a child run); and the hero that moved under the
// Hub block still draws. Synthetic data only, on a fake database; prints labels and counts.
const { Node } = require('./fakedom.js');
const fs = require('fs');
const { execFileSync } = require('child_process');
process.env.TZ = 'Europe/Stockholm'; // William's clock, so day names and "today" are stable wherever the suite runs
const NOW = Date.parse('2026-11-05T09:00:00Z'); // a Thursday, 10:00 in Stockholm
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const NODB = process.argv.includes('--nodb'); // the child run: claude.use('db') resolves null
const D = '/home/user/revopsemeaos/dashboard/';
const calcs = {}, draws = {}, loaders = {}, onData = [];
let params = { region: 'All', mgr: '', person: '', checkArea: 'All', ooWho: '', cvSeg: 'all', cvRt: 'nb', cvClean: false, grWindow: 30 };
const DATA = {}, STATE = {};
global.dash = { loader: (id, o) => { loaders[id] = o; }, calc: (id, o) => { calcs[id] = o; }, draw: (n, fn) => { if (fn) draws[n] = fn; }, params: () => params, setParams: (p) => { params = { ...params, ...p }; onData.forEach((f) => f()); }, onData: (fn) => { onData.push(fn); }, colors: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'], setLink: () => {},
  data: (id) => (STATE[id] ? { status: STATE[id], data: [] } : id in DATA ? { status: 'ok', data: DATA[id] } : { status: 'loading', data: [] }) };
global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: (f) => (v) => (f === '.1f' ? (+v).toFixed(1) : f === '.0%' ? Math.round(v * 100) + '%' : f === ',' ? Math.round(v).toLocaleString('en') : String(v)), max: (a, f) => (a.length ? Math.max(...a.map(f)) : undefined), select: () => ({ selectAll: () => ({ remove() {} }) }) };
// the fake database: documents by path, and every listener registered on one (the page must register exactly one)
const DB = { subs: [], docs: {} };
const snapOf = (p, data) => ({ id: p.split('/').pop(), exists: data !== undefined && data !== null, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });
const docRef = (p) => {
  if (p.split('/').length % 2) throw new TypeError('a document path has an even number of segments: ' + p);
  return { id: p.split('/').pop(), path: p, get: async () => snapOf(p, DB.docs[p]), onSnapshot(next, error) { DB.subs.push({ p, next, error }); return () => {}; },
    set: async () => { throw new Error('the Today tab must not write'); }, update: async () => { throw new Error('the Today tab must not write'); } };
};
const fakeDb = { doc: docRef, collection: (c) => ({ path: c, doc: (id) => docRef(c + '/' + id) }) };
global.claude = { use: async (n) => (n === 'db' ? (NODB ? null : fakeDb) : null) };
global.location.hash = '';
document.querySelector = (sel) => (/data-view-panel/.test(sel) ? new Node('div') : null);
document.querySelectorAll = () => [];
document.addEventListener = () => {};
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: () => Promise.resolve() } }, configurable: true, writable: true });
for (const f of ['os-core.js', 'os-calcs.js', 'os-calcs-leads.js', 'os-calcs-act.js', 'os-calcs-conv.js', 'os-draw.js']) require(D + f);
let fails = 0, passes = 0; const ok = (c, l, x) => { if (!c) fails++; else passes++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const walk = (n, f) => { f(n); for (const c of n.children || []) walk(c, f); };
const nodes = (el, pick) => { const out = []; walk(el, (n) => { if (pick(n)) out.push(n); }); return out; };
const draw = (name, tag = 'div', ds = {}) => { const el = new Node(tag); el.dataset.draw = name; Object.assign(el.dataset, ds); draws[name](el); return el; };
const count = (field) => draw('hub-count', 'b', { field });
const note = (kind) => draw('hub-note', 'p', { note: kind });
const notes = () => ({ empty: !note('empty').hidden, nodb: !note('nodb').hidden, error: !note('error').hidden });
const counts = () => ['waiting', 'critical', 'prepared', 'doneToday'].map((f) => count(f).textContent);
const iso = (t) => new Date(t).toISOString();
const HUB_URL = 'https://claude.ai/artifact/hubTestOnly123';
const html = fs.readFileSync(D + 'index.html', 'utf8');
const core = fs.readFileSync(D + 'os-core.js', 'utf8');

(async () => {
await new Promise((r) => setTimeout(r, 0)); // claude.use resolves after the first tick
if (NODB) { console.log('NODB ' + OS.hub.state() + ' ' + JSON.stringify(notes()) + ' ' + JSON.stringify(counts()) + ' ' + draw('hub-open', 'a').hidden); process.exit(0); }

// ---- 1. the tab order: Today first, before Home, in the strip, the sections, the palette and the shell ----
{
  const navs = [...html.matchAll(/data-nav="([^"]+)" data-nav-item/g)].map((m) => m[1]);
  ok(navs.length === 10 && navs[0] === 'today' && navs[1] === 'home', 'tab strip: 10 tabs, Today first, then Home', navs);
  const cur = [...html.matchAll(/data-nav="([^"]+)" data-nav-item[^>]*aria-current="page"/g)].map((m) => m[1]);
  ok(cur.length === 1 && cur[0] === 'today', 'tab strip: Today is the current tab in the markup', cur);
  const pages = [...html.matchAll(/<section class="scr" id="([^"]+)" data-page="\1"( hidden)?>/g)].map((m) => [m[1], !!m[2]]);
  ok(pages.length === 10 && pages[0][0] === 'today' && !pages[0][1] && pages[1][0] === 'home' && pages[1][1] && pages.slice(1).every((p) => p[1]), 'sections: Today first and shown, every other section hidden', pages);
  const screens = ((core.match(/const SCREENS = \[([^\]]+)\]/) || [])[1] || '').split(',').map((x) => x.trim().replace(/'/g, ''));
  ok(screens.length === 10 && screens.join() === navs.join(), 'SCREENS in os-core.js lists the ten screens in tab order', screens);
  ok(/let screen = SCREENS\.includes\(hashScreen\) \? hashScreen : 'today';/.test(core), 'a link with no screen opens Today');
  ok(/\/\^\[0-9\]\$\/\.test\(e\.key\)\) \{ go\(SCREENS\[e\.key === '0' \? 9 : \+e\.key - 1\]\)/.test(core), 'keys 1–9 open the first nine screens and 0 the tenth');
  ok(/1–9 and 0 jump to screens/.test(html), 'the palette hint says 1–9 and 0');
  const gos = [...html.matchAll(/class="pal-item pal-go" type="button" data-nav="([^"]+)"/g)].map((m) => m[1]);
  ok(gos[0] === 'today' && gos[1] === 'home', 'palette: Go to Today is the first entry', gos.slice(0, 3));
  ok(/if \(screen === 'today'\) \{\n\s+const busy = SUMMARY\.some/.test(core), 'Copy weekly summary waits for its sources on Today (the button moved there)');
}

// ---- 2. the Today section: the Hub block above the hero, with the fixed sentences and the four tiles in order ----
const today = html.slice(html.indexOf('data-page="today"'), html.indexOf('data-page="home"'));
const home = html.slice(html.indexOf('data-page="home"'), html.indexOf('data-page="actions"'));
{
  ok(/id="hub-today"/.test(today) && /class="hero"/.test(today) && today.indexOf('id="hub-today"') < today.indexOf('class="hero"'), 'Today: the Hub block sits above the hero');
  ok(/data-draw="hero-date"/.test(today) && /data-draw="hero-name"/.test(today) && /id="home-next"/.test(today) && /data-copy-summary/.test(today) && /data-draw="kpi-checks"[^>]*data-field="high"/.test(today), 'Today: the hero keeps its date, greeting, Up next 1:1s, Copy weekly summary and the severity pills');
  ok(!/class="hero"/.test(home) && !/data-draw="hero-date"/.test(home) && /class="home-cards"/.test(home) && /class="home-grid"/.test(home), 'Home: no hero any more, the cards and the grid stay');
  const tiles = [...today.matchAll(/<span class="stat-label">([^<]+)<\/span><span class="stat-value"><b data-draw="hub-count" data-field="([^"]+)">—<\/b>/g)].map((m) => [m[1], m[2]]);
  ok(JSON.stringify(tiles) === JSON.stringify([['Needs you', 'waiting'], ['Critical', 'critical'], ['Prepared', 'prepared'], ['Done today', 'doneToday']]), 'four count tiles: Needs you, Critical, Prepared, Done today', tiles);
  ok(/<p class="os-empty" data-draw="hub-note" data-note="empty" hidden>The Hub has not run yet\.<\/p>/.test(today), 'the empty sentence is fixed in the HTML: "The Hub has not run yet."');
  ok(/<a class="btn btn-primary" data-draw="hub-open" target="_blank" rel="noopener" hidden>Open the Hub</.test(today), 'one Open the Hub link, a new tab, hidden until the URL is known');
  ok(/<ul class="ilist" data-draw="hub-top"><\/ul>/.test(today) && /data-draw="hub-brief" hidden/.test(today) && /data-draw="hub-run"/.test(today), 'the top items list, the brief headline and the last run have their slots');
  ok(/data-draw="hub-badge" hidden/.test(html.slice(0, html.indexOf('data-page="today"'))), 'the Today tab carries a badge slot');
  ok(!/data-draw="hub-[a-z]+"[^>]*data-source=/.test(today), 'no Hub element names a dataset: the Hub block reads the database only');
  const hubJs = fs.readFileSync(D + 'os-draw.js', 'utf8').slice(fs.readFileSync(D + 'os-draw.js', 'utf8').indexOf("TODAY: THE HUB'S SUMMARY"), fs.readFileSync(D + 'os-draw.js', 'utf8').indexOf('HOME HERO'));
  const hubCore = core.slice(core.indexOf("The Hub's summary (Today tab)"), core.indexOf('App shell'));
  ok(hubJs.length > 500 && hubCore.length > 500 && !/innerHTML|mcp|sample|fetch\(|callTool/.test(hubJs + hubCore), 'the Today code uses no innerHTML, connector, sample or network call');
}

// ---- 3. one subscription to hub/today; nothing drawn as known before the first snapshot ----
ok(DB.subs.length === 1 && DB.subs[0].p === 'hub/today', 'subscribes once, to the document hub/today', DB.subs.map((s) => s.p));
ok(OS.hub.state() === 'loading', 'before the first snapshot the state is loading', OS.hub.state());
ok(JSON.stringify(counts()) === JSON.stringify(['—', '—', '—', '—']), 'loading: the four tiles show —', counts());
ok(JSON.stringify(notes()) === JSON.stringify({ empty: false, nodb: false, error: false }), 'loading: no sentence shows yet', notes());
ok(draw('hub-open', 'a').hidden === true && draw('hub-run', 'p').textContent === '' && draw('hub-badge', 'span').hidden === true, 'loading: no Open button, no run line, no badge');
const push = (data) => DB.subs[0].next(snapOf('hub/today', data));

// ---- 4. the empty state: the document is missing ----
{
  push(undefined);
  ok(OS.hub.state() === 'missing', 'a missing document: state missing', OS.hub.state());
  ok(JSON.stringify(notes()) === JSON.stringify({ empty: true, nodb: false, error: false }), 'missing: "The Hub has not run yet." shows, the other sentences stay hidden', notes());
  ok(JSON.stringify(counts()) === JSON.stringify(['—', '—', '—', '—']), 'missing: tiles show —', counts());
  ok(nodes(draw('hub-top', 'ul'), (n) => n.tagName === 'LI').length === 0, 'missing: no items');
  ok(draw('hub-open', 'a').hidden === true && draw('hub-open', 'a').getAttribute('href') === null, 'missing: Open the Hub hidden (no URL known)');
  ok(draw('hub-chat', 'a').hidden === true, 'missing: Chat hidden (no URL known)');
  const run = draw('hub-run', 'p');
  ok(run.textContent === 'Worker: has not run yet' && !run.classList.contains('os-bad'), 'missing: the run line says the worker has not run yet', run.textContent);
  ok(draw('hub-brief', 'p').hidden === true && draw('hub-badge', 'span').hidden === true, 'missing: no headline, no badge');
  // a document seeded with the Hub's URL only (before the first run): still the empty state, now with the Open button
  push({ hubUrl: HUB_URL });
  ok(OS.hub.state() === 'missing' && notes().empty === true, 'a document with only hubUrl: still "The Hub has not run yet."', [OS.hub.state(), notes()]);
  const a = draw('hub-open', 'a');
  ok(a.hidden === false && a.getAttribute('href') === HUB_URL, 'a document with only hubUrl: Open the Hub shows with that href', [a.hidden, a.getAttribute('href')]);
  const ch = draw('hub-chat', 'a');
  ok(ch.hidden === false && ch.getAttribute('href') === HUB_URL + '#chat', 'a document with only hubUrl: Chat links to the Hub with #chat', [ch.hidden, ch.getAttribute('href')]);
}

// ---- 5. a full document: counts, items, headline, Open button, failed run in red ----
const DOC = {
  at: iso(NOW - 30 * 60e3), hubUrl: HUB_URL,
  counts: { waiting: 3, critical: 1, prepared: 2, doneToday: 4 },
  top: [
    { id: 'sl-C1-1.1', title: 'Reply about the routing change for the new pool', kind: 'ask', severity: 'critical', status: 'waiting', dueAt: iso(NOW - 864e5) },
    { id: 'cal-E1-2026-11-05', title: 'Prep: pipeline review with the EMEA leads', kind: 'meeting', severity: 'high', status: 'prepared', dueAt: iso(NOW + 2 * 36e5) },
    { id: 'gr-M1-send-the-tam-figures', title: 'Send the TAM figures', kind: 'task', severity: 'normal', status: 'new', dueAt: null },
    { id: 'ins-asks-2026-11-05', title: '3 asks have waited more than 2 days', kind: 'insight', severity: 'low', status: 'new', dueAt: iso(NOW + 3 * 864e5) },
  ],
  lastRun: { at: iso(NOW - 60 * 60e3), status: 'failed' },
  brief: { headline: 'Two asks need an answer before the pipeline review.' },
};
{
  push(DOC);
  ok(OS.hub.state() === 'ok', 'a full document: state ok', OS.hub.state());
  ok(JSON.stringify(counts()) === JSON.stringify(['3', '1', '2', '4']), 'tiles: 3 need you, 1 critical, 2 prepared, 4 done today', counts());
  ok(count('critical').classList.contains('os-bad') && !count('waiting').classList.contains('os-bad'), 'the Critical tile reads red when above zero, Needs you does not');
  const ul = draw('hub-top', 'ul');
  const lis = nodes(ul, (n) => n.tagName === 'LI');
  ok(lis.length === 4, 'top items: one row per item', lis.length);
  const dots = lis.map((li) => nodes(li, (n) => n.classList.contains('itm-dot')).map((d) => d.className)[0]);
  ok(JSON.stringify(dots) === JSON.stringify(['itm-dot sev-critical', 'itm-dot sev-high', 'itm-dot sev-normal', 'itm-dot sev-low']), 'each row starts with a severity dot carrying its severity class', dots);
  const titles = lis.map((li) => nodes(li, (n) => n.classList.contains('itm-title'))[0].textContent);
  ok(JSON.stringify(titles) === JSON.stringify(DOC.top.map((t) => t.title)), 'titles as the worker wrote them', titles);
  const kinds = lis.map((li) => nodes(li, (n) => n.classList.contains('chip'))[0].textContent);
  ok(JSON.stringify(kinds) === JSON.stringify(['Ask', 'Meeting', 'Task', 'Insight']), 'a kind chip per row', kinds);
  const dues = lis.map((li) => nodes(li, (n) => n.classList.contains('itm-meta'))[0].children.slice(1).map((c) => [c.textContent, c.classList.contains('os-bad')]));
  ok(JSON.stringify(dues) === JSON.stringify([[['overdue, Wed 4 Nov', true]], [['due today', false]], [], [['due Sun 8 Nov', false]]]), 'due dates: overdue in red, due today, none, due on a later day', dues);
  const status = lis.map((li) => (nodes(li, (n) => n.classList.contains('itm-detail'))[0] || {}).textContent || '');
  ok(JSON.stringify(status) === JSON.stringify(['Waiting for you', 'Prepared, waiting for you', 'New', 'New']), 'the status reads in words under the title', status);
  ok(!/innerHTML/.test(String(draws['hub-top'])) && lis.every((li) => li.children.length === 3), 'rows are built from elements with textContent only');
  const a = draw('hub-open', 'a');
  ok(a.hidden === false && a.getAttribute('href') === HUB_URL, 'Open the Hub: shown, href is the hubUrl from the document', [a.hidden, a.getAttribute('href')]);
  const run = draw('hub-run', 'p');
  ok(run.classList.contains('os-bad') && /^Worker: last run 09:00 · failed$/.test(run.textContent), 'last run failed an hour ago: red, with its time and status', [run.className, run.textContent]);
  const brief = draw('hub-brief', 'p');
  ok(brief.hidden === false && brief.textContent === DOC.brief.headline, 'the brief headline shows', [brief.hidden, brief.textContent]);
  const badge = draw('hub-badge', 'span');
  ok(badge.hidden === false && badge.textContent === '3', 'the Today tab badge shows how many need you', [badge.hidden, badge.textContent]);
  ok(JSON.stringify(notes()) === JSON.stringify({ empty: false, nodb: false, error: false }), 'ok: no sentence shows', notes());
}

// ---- 6. worker health colouring: ok and fresh, ok but old, partial, no time ----
{
  const runWith = (lastRun) => { push({ ...DOC, lastRun }); const el = draw('hub-run', 'p'); return [el.classList.contains('os-bad'), el.classList.contains('os-warn'), el.textContent]; };
  let r = runWith({ at: iso(NOW - 60 * 60e3), status: 'ok' });
  ok(r[0] === false && r[1] === false && r[2] === 'Worker: last run 09:00 · ok', 'ok an hour ago: plain', r);
  r = runWith({ at: iso(NOW - 9 * 36e5), status: 'ok' });
  ok(r[0] === true && r[2] === 'Worker: last run 01:00 · ok · over 8 hours ago', 'ok but 9 hours ago: red, says over 8 hours ago', r);
  r = runWith({ at: iso(NOW - 8 * 36e5 + 60e3), status: 'ok' });
  ok(r[0] === false, 'ok 7 h 59 min ago: not yet red', r);
  r = runWith({ at: iso(NOW - 26 * 36e5), status: 'ok' });
  ok(r[0] === true && /^Worker: last run yesterday 08:00 · ok · over 8 hours ago$/.test(r[2]), 'yesterday: the time says so', r);
  r = runWith({ at: iso(NOW - 4 * 864e5), status: 'ok' });
  ok(r[0] === true && /^Worker: last run Sun 1 Nov, 10:00 · ok · over 8 hours ago$/.test(r[2]), 'days ago: day and time', r);
  r = runWith({ at: iso(NOW - 60 * 60e3), status: 'partial' });
  ok(r[0] === false && r[1] === true && /· partial$/.test(r[2]), 'partial an hour ago: amber, not red', r);
  r = runWith({ at: iso(NOW - 9 * 36e5), status: 'partial' });
  ok(r[0] === true && r[1] === false, 'partial 9 hours ago: red wins', r);
  r = runWith({ status: 'ok' });
  ok(r[0] === true && r[2] === 'Worker: last run at an unknown time · ok', 'no time on the run: red, says the time is unknown', r);
  r = runWith({ at: iso(NOW - 60 * 60e3) });
  ok(r[0] === false && r[1] === true && /· unknown$/.test(r[2]), 'no status on the run: says unknown, amber (not healthy)', r);
  r = runWith({ at: iso(NOW - 10 * 60e3), status: 'running' });
  ok(r[0] === false && r[1] === true && r[2] === 'Worker: last run 09:50 · running', 'a run still marked running: amber, never plain', r);
  r = runWith({ at: iso(NOW - 60 * 60e3), status: 'weird' });
  ok(r[0] === false && r[1] === true, 'an unknown status word: amber', r);
  r = runWith(null);
  ok(r[0] === false && r[2] === 'Worker: has not run yet', 'counts but no run yet: has not run yet', r);
  ok(OS.hub.state() === 'ok', '... and the counts still draw (state ok)', OS.hub.state());
}

// ---- 7. defensive: odd documents never crash and never follow an odd link ----
{
  push({ ...DOC, top: Array.from({ length: 14 }, (_, i) => ({ id: 'x' + i, title: 'Item ' + i, kind: 'task', severity: 'normal', status: 'new', dueAt: null })) });
  ok(nodes(draw('hub-top', 'ul'), (n) => n.tagName === 'LI').length === 12, '14 top items: the list stops at 12');
  push({ ...DOC, top: 'nope', counts: { waiting: 'many', critical: null }, brief: { headline: '   ' }, hubUrl: 'javascript:alert(1)' });
  ok(nodes(draw('hub-top', 'ul'), (n) => n.tagName === 'LI').length === 0, 'top not a list: no rows, no crash');
  ok(JSON.stringify(counts()) === JSON.stringify(['—', '—', '—', '—']), 'counts that are not numbers show —', counts());
  ok(draw('hub-brief', 'p').hidden === true, 'a blank headline hides the line');
  ok(draw('hub-open', 'a').hidden === true && draw('hub-open', 'a').getAttribute('href') === null, 'a hubUrl that is not a claude.ai https link is not followed');
  ok(draw('hub-chat', 'a').hidden === true && draw('hub-chat', 'a').getAttribute('href') === null, 'Chat follows no hubUrl that is not a claude.ai https link');
  push({ ...DOC, hubUrl: 'https://example.com/claude.ai/' });
  ok(draw('hub-open', 'a').hidden === true, 'a non-claude.ai host is not followed either');
  push({ ...DOC, top: [{ id: 'y', title: 'x'.repeat(200), kind: 'mystery', severity: 'urgent', status: 'odd' }, null, 'junk'] });
  const li = nodes(draw('hub-top', 'ul'), (n) => n.tagName === 'LI');
  ok(li.length === 1, 'junk entries are skipped', li.length);
  ok(nodes(li[0], (n) => n.classList.contains('itm-title'))[0].textContent.length === 90 && nodes(li[0], (n) => n.classList.contains('itm-dot'))[0].className === 'itm-dot sev-normal' && nodes(li[0], (n) => n.classList.contains('chip'))[0].textContent === 'Item' && !nodes(li[0], (n) => n.classList.contains('itm-detail')).length, 'a long title is cut at 90, an unknown severity reads normal, an unknown kind reads Item, an unknown status shows nothing');
  push({ ...DOC, top: [{ id: 'z', title: 'Prototype words', kind: 'constructor', severity: 'normal', status: 'constructor' }] });
  const proto = nodes(draw('hub-top', 'ul'), (n) => n.tagName === 'LI');
  ok(proto.length === 1 && nodes(proto[0], (n) => n.classList.contains('chip'))[0].textContent === 'Item' && !nodes(proto[0], (n) => n.classList.contains('itm-detail')).length, 'a status or kind named like an Object.prototype member shows no junk (own keys only)');
  push(DOC);
  ok(OS.hub.state() === 'ok' && JSON.stringify(counts()) === JSON.stringify(['3', '1', '2', '4']), 'the next good snapshot restores everything', counts());
}

// ---- 8. the document can't be read: the listener's error callback ----
{
  DB.subs[0].error({ code: 'unavailable', message: 'bridge gone' });
  ok(OS.hub.state() === 'error', 'an error on the subscription: state error', OS.hub.state());
  ok(JSON.stringify(notes()) === JSON.stringify({ empty: false, nodb: false, error: true }), 'error: only the "couldn\'t be read" sentence shows', notes());
  ok(JSON.stringify(counts()) === JSON.stringify(['—', '—', '—', '—']) && draw('hub-open', 'a').hidden === true && draw('hub-badge', 'span').hidden === true, 'error: tiles —, no Open button, no badge');
  ok(DB.subs.length === 1, 'no second subscription was opened along the way', DB.subs.length);
}

// ---- 9. no database at all: a child run where claude.use("db") resolves null ----
{
  let out = '';
  try { out = execFileSync(process.execPath, [__filename, '--nodb'], { encoding: 'utf8', timeout: 60000 }); } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const line = (out.match(/^NODB .*$/m) || [])[0] || '';
  ok(line === 'NODB nodb {"empty":false,"nodb":true,"error":false} ["—","—","—","—"] true', 'without a database: state nodb, only the "no database" sentence, tiles —, no Open button', line || out.slice(-300));
}

// ---- 10. the hero still draws under the Hub block ----
{
  const hd = draw('hero-date', 'span');
  ok(/^Thursday 5 November$/.test(hd.textContent), 'hero-date draws the day', hd.textContent);
  DATA.sf_me = [{ userId: '005TESTME', name: 'Jo Doe' }];
  ok(draw('hero-name', 'span').textContent === ', Jo', 'hero-name greets by first name');
  DATA.oo_kpi = [{ today: 2 }];
  ok(draw('kpi-oo', 'b', { field: 'today' }).textContent === '2', 'the 1:1s pill draws its count');
  DATA.oo_upcoming = [{ name: 'Sam Smith', email: 'sam.smith@example.com', title: 'Jo / Sam', start: iso(NOW + 3 * 36e5) }, { name: 'Alex Lee', email: 'alex.lee@example.com', title: 'Jo / Alex', start: iso(NOW + 26 * 36e5) }];
  const nx = draw('home-next', 'div');
  const names = nodes(nx, (n) => n.tagName === 'B').map((n) => n.textContent);
  ok(names[0] === 'Sam Smith' && nodes(nx, (n) => n.dataset && n.dataset.ooWho).length === 2, 'Up next · 1:1s draws the next 1:1 and the one after', names);
  ok(/Today, 13:00 · Jo \/ Sam/.test(nx.textContent), 'the next 1:1 shows its time and title (10:00 + 3 h, Stockholm)', nx.textContent.slice(0, 60));
  ok(typeof OS.summary.lines === 'function' && Array.isArray(OS.summary.lines().lines), 'the weekly summary lines (Copy weekly summary) still build');
  ok(typeof OS.done.has === 'function' && typeof OS.ask.can === 'function', 'the tick-off and ask features are still there');
}


// Chat: the header and the Today pane open the Hub's chat (#chat), only for a claude.ai Hub URL
{
  const html = fs.readFileSync(D + 'index.html', 'utf8');
  ok((html.match(/data-draw="hub-chat"/g) || []).length === 2, 'Chat: one link in the header and one on the Today pane');
  ok(/<a class="app-chat" data-draw="hub-chat" target="_blank" rel="noopener"[^>]*hidden>/.test(html), 'Chat: the header link opens a new tab and is hidden until the Hub URL is known');
  ok(/'hub-chat'/.test(fs.readFileSync(D + 'os-core.js', 'utf8')), 'Chat: redrawn when hub/today changes');
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST CRASHED', e && e.stack); process.exit(1); });
