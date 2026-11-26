// Today tab (RevOps Hub v1, docs/hub-spec.md §6 and §7): Today is the first tab and the default screen; the page subscribes
// once to hub/today and draws the four counts, the top items (severity dot, kind, title, due), the brief headline, the
// worker's last run (red when it failed, amber when it is not ok or when the schedule says a run left no result; no age
// rule) and Open the Hub (hidden without a URL); the empty state when the
// document is missing; a document that can't be read; no database at all (a child run); and the hero that moved under the
// Hub block still draws. Synthetic data only, on a fake database; prints labels and counts.
// The fixed sentences and the two kinds of Hub link (Open the Hub, Chat) are stored in the HTML, not drawn: one empty
// drawing beside each group (hub-note, hub-links) only sets hidden on them, so the test hands the drawings the stored
// elements through document.querySelectorAll and reads their hidden.
// The Today tab's number and the brief's headline are drawings stored hidden. The dashboard type runs no drawing under
// the hidden attribute (its one-writer.md, "Hidden"), so neither can show itself: an empty drawing of the same name
// beside each takes hidden off it, and the type then draws it. The test keeps that rule (typeDraws): the stored
// elements are drawn as the type would draw them, and a drawing that is hidden is not run.
const { Node } = require('./fakedom.js');
const fs = require('fs');
const { execFileSync } = require('child_process');
process.env.TZ = 'Europe/Stockholm'; // William's clock, so day names and "today" are stable wherever the suite runs
const NOW = Date.parse('2026-11-05T09:00:00Z'); // a Thursday, 10:00 in Stockholm
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
const NODB = process.argv.includes('--nodb'); // the child run: claude.use('db') resolves null
const D = require('path').join(__dirname, '../../dashboard/');
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
// what the drawings look for in the page: filled from the stored index.html below, before anything is drawn
const PAGE = { '[data-note-for]': [], '[data-hub-link]': [] };
document.querySelectorAll = (sel) => PAGE[sel] || [];
document.addEventListener = () => {};
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: () => Promise.resolve() } }, configurable: true, writable: true });
for (const f of ['os-core.js', 'os-calcs.js', 'os-calcs-leads.js', 'os-calcs-act.js', 'os-calcs-conv.js', 'os-draw.js']) require(D + f);
let fails = 0, passes = 0; const ok = (c, l, x) => { if (!c) fails++; else passes++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const walk = (n, f) => { f(n); for (const c of n.children || []) walk(c, f); };
const nodes = (el, pick) => { const out = []; walk(el, (n) => { if (pick(n)) out.push(n); }); return out; };
const draw = (name, tag = 'div', ds = {}) => { if (/^hub-(badge|brief)$/.test(name)) throw new Error(name + ' is stored hidden: draw it as the type does (typeDraws)'); const el = new Node(tag); el.dataset.draw = name; Object.assign(el.dataset, ds); draws[name](el); return el; };
const count = (field) => draw('hub-count', 'b', { field });
// the Hub's three sentences after its one drawing ran: which of them show
const notes = () => { draw('hub-note', 'span'); const shown = (k) => PAGE['[data-note-for]'].some((p) => p.dataset.noteFor === 'hub' && p.dataset.note === k && !p.hidden); return { empty: shown('empty'), nodb: shown('nodb'), error: shown('error') }; };
// the Hub links after their one drawing ran: Open the Hub and Chat, both in the Hub pane
const links = () => { draw('hub-links', 'span'); const all = PAGE['[data-hub-link]']; return { open: all.filter((a) => !/#chat$/.test(a.getAttribute('href'))), chat: all.filter((a) => /#chat$/.test(a.getAttribute('href'))) }; };
const openLink = () => links().open[0];
const chatShown = () => links().chat.map((a) => !a.hidden);
const counts = () => ['waiting', 'critical', 'prepared', 'doneToday'].map((f) => count(f).textContent);
const iso = (t) => new Date(t).toISOString();
const html = fs.readFileSync(D + 'index.html', 'utf8');
const core = fs.readFileSync(D + 'os-core.js', 'utf8');
for (const m of html.matchAll(/<p class="os-empty" data-note-for="([a-z]+)" data-note="([a-z]+)" hidden>/g)) { const p = new Node('p'); p.dataset.noteFor = m[1]; p.dataset.note = m[2]; p.hidden = true; PAGE['[data-note-for]'].push(p); }
for (const m of html.matchAll(/<a class="[^"]*" data-hub-link href="([^"]+)"[^>]*hidden>/g)) { const a = new Node('a'); a.setAttribute('href', m[1]); a.hidden = true; PAGE['[data-hub-link]'].push(a); }
// The two drawings that are stored hidden (hub-badge, hub-brief), each with the empty drawing of its name beside it, as
// the page stores them. typeDraws(name) is the type's pass over the elements of one name: an element under hidden is
// not drawn; one whose hidden came off during the pass is drawn in the same pass. It returns the number or headline
// (not the empty drawing). draw() refuses these names: on an element of its own making it would run a drawing the
// type never runs.
const STORED = {}, RAN = {};
for (const m of html.matchAll(/<(span|p) class="([^"]*)" data-draw="(hub-badge|hub-brief)"( hidden)?><\/\1>/g)) {
  const el = new Node(m[1]); el.className = m[2]; el.dataset.draw = m[3]; el.hidden = !!m[4];
  (STORED[m[3]] = STORED[m[3]] || []).push(el); (PAGE['[data-draw="' + m[3] + '"]'] = PAGE['[data-draw="' + m[3] + '"]'] || []).push(el);
}
const isSlot = (el) => el.classList.contains('msg-slot');
const typeDraws = (name, els = STORED[name] || []) => {
  const drawn = new Set();
  for (let more = true; more;) { more = false; for (const el of els) if (!el.hidden && !drawn.has(el)) { draws[name](el); drawn.add(el); RAN[name] = (RAN[name] || 0) + (isSlot(el) ? 0 : 1); more = true; } }
  return els.filter((el) => !isSlot(el));
};
// (GONE stands in for a number or a headline the page no longer has: a hidden, empty element, so that the checks that
// expect one on show go red and the run does not crash)
const GONE = Object.assign(new Node('i'), { hidden: true });
const badge = () => typeDraws('hub-badge')[0] || GONE, brief = () => typeDraws('hub-brief')[0] || GONE;
// a badge is on show when it is not hidden and carries the class its style asks for (os.css: .app-badge:not(.is-on))
const badgeShows = (b) => !b.hidden && b.classList.contains('is-on');
// the Hub's address is fixed in the page's links; a document that names any other address shows none of them
const HUB_URL = (PAGE['[data-hub-link]'].map((a) => a.getAttribute('href')).find((h) => !/#/.test(h)) || '');
const OTHER_HUB = 'https://claude.ai/artifact/hubTestOnly123';

(async () => {
await new Promise((r) => setTimeout(r, 0)); // claude.use resolves after the first tick
if (NODB) { console.log('NODB ' + OS.hub.state() + ' ' + JSON.stringify(notes()) + ' ' + JSON.stringify(counts()) + ' ' + openLink().hidden); process.exit(0); }

// ---- 1. the tab order: Today first, before Home, in the strip, the sections, the palette and the shell ----
{
  const navs = [...html.matchAll(/data-nav="([^"]+)" data-nav-item/g)].map((m) => m[1]);
  ok(navs.length === 12 && navs[0] === 'today' && navs[1] === 'decide' && navs[2] === 'leo' && navs[3] === 'home', 'tab strip: 12 tabs, Today first, then Decide, For Leo, Home', navs);
  const cur = [...html.matchAll(/data-nav="([^"]+)" data-nav-item[^>]*aria-current="page"/g)].map((m) => m[1]);
  ok(cur.length === 1 && cur[0] === 'today', 'tab strip: Today is the current tab in the markup', cur);
  const pages = [...html.matchAll(/<section class="scr" id="([^"]+)" data-page="\1"(?: lang="[a-z-]+")?( hidden)?>/g)].map((m) => [m[1], !!m[2]]);
  ok(pages.length === 12 && pages[0][0] === 'today' && !pages[0][1] && pages[3][0] === 'home' && pages.slice(1).every((p) => p[1]), 'sections: Today first and shown, every other section hidden', pages);
  const screens = ((core.match(/const SCREENS = \[([^\]]+)\]/) || [])[1] || '').split(',').map((x) => x.trim().replace(/'/g, ''));
  ok(screens.length === 12 && screens.join() === navs.join(), 'SCREENS in os-core.js lists the twelve screens in tab order', screens);
  ok(/let screen = SCREENS\.includes\(hashScreen\) \? hashScreen : 'today';/.test(core), 'a link with no screen opens Today');
  ok(/\/\^\[0-9\]\$\/\.test\(e\.key\)\) \{ go\(SCREENS\[e\.key === '0' \? 9 : \+e\.key - 1\]\)/.test(core), 'keys 1–9 open the first nine screens and 0 the tenth');
  ok(/1–9 and 0 jump to screens/.test(html), 'the palette hint says 1–9 and 0');
  const gos = [...html.matchAll(/class="pal-item pal-go" type="button" data-nav="([^"]+)"/g)].map((m) => m[1]);
  ok(gos[0] === 'today' && gos[1] === 'decide' && gos[2] === 'leo' && gos[3] === 'home', 'palette: Go to Today first, then Decide and For Leo', gos.slice(0, 4));
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
  ok(/<p class="os-empty" data-note-for="hub" data-note="empty" hidden>The Hub has not run yet\.<\/p>/.test(today), 'the empty sentence is fixed in the HTML: "The Hub has not run yet."');
  ok(/<div class="msgs"><span class="msg-slot" data-draw="hub-note"><\/span>\s*<p class="os-empty" data-note-for="hub"/.test(today) && (today.match(/data-draw="hub-note"/g) || []).length === 1 && PAGE['[data-note-for]'].filter((p) => p.dataset.noteFor === 'hub').length === 3, 'the three Hub sentences are plain HTML; one empty drawing beside them picks which shows');
  ok(/<a class="btn btn-primary" data-hub-link href="https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+" target="_blank" rel="noopener" hidden>Open the Hub</.test(today) && (today.match(/>Open the Hub</g) || []).length === 1, 'one Open the Hub link with the Hub\'s address fixed in the HTML, a new tab, hidden until hub/today names that Hub');
  ok(!/data-draw="hub-(open|chat)"/.test(html) && (html.match(/data-draw="hub-links"/g) || []).length === 1 && /<span class="msg-slot" data-draw="hub-links"><\/span>/.test(html.slice(0, html.indexOf('<nav class="app-tabs"'))), 'the links are not drawings: one empty drawing in the header (never under a hidden tab) shows or hides them');
  ok(/^https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+$/.test(HUB_URL) && PAGE['[data-hub-link]'].length === 2 && PAGE['[data-hub-link]'].every((a) => a.getAttribute('href').split('#')[0] === HUB_URL), 'the two Hub links carry one claude.ai address', PAGE['[data-hub-link]'].map((a) => a.getAttribute('href')));
  ok(/<ul class="ilist" data-draw="hub-top"><\/ul>/.test(today) && /<\/div>\n\s*<span class="msg-slot" data-draw="hub-brief"><\/span><p class="hub-brief" data-draw="hub-brief" hidden><\/p>\n\s*<ul class="ilist" data-draw="hub-top"><\/ul>/.test(today) && (html.match(/data-draw="hub-brief"/g) || []).length === 2 && /data-draw="hub-run"/.test(today),
    'the top items list, the brief headline and the last run have their slots; the headline is stored hidden and empty, right after the empty drawing of its name, between the tiles and the list');
  ok(/<button class="app-tab" type="button" data-nav="today" data-nav-item id="nav-today" aria-current="page">\s*<svg [^\n]*<\/svg>\s*<span>Today<\/span>\s*<span class="msg-slot" data-draw="hub-badge"><\/span><span class="app-badge info" data-draw="hub-badge" hidden><\/span>\s*<\/button>/.test(html.slice(0, html.indexOf('data-page="today"'))) && (html.match(/data-draw="hub-badge"/g) || []).length === 2,
    'the Today tab carries a badge slot: stored hidden and empty, right after the empty drawing of its name, in the tab\'s button');
  ok(['hub-badge', 'hub-brief'].every((n) => (STORED[n] || []).length === 2 && isSlot(STORED[n][0]) && !STORED[n][0].hidden && !isSlot(STORED[n][1]) && STORED[n][1].hidden === true),
    'of each of the two names the page stores two elements: the empty drawing, not hidden, and then the number or the headline, hidden');
  const pageCss = fs.readFileSync(D + 'os.css', 'utf8');
  ok(/\.app-badge:not\(\.is-on\)\s*\{\s*display:\s*none;?\s*\}/.test(pageCss) && /\.msg-slot\s*\{\s*display:\s*none;?\s*\}/.test(pageCss) && /\.app \[hidden\]\s*\{\s*display:\s*none !important;?\s*\}/.test(pageCss),
    'os.css: a tab\'s number shows only with the class is-on, an empty drawing takes no room, and what is hidden is not displayed');
  ok(!/data-draw="hub-[a-z]+"[^>]*data-source=/.test(today), 'no Hub element names a dataset: the Hub block reads the database only');
  const hubJs = fs.readFileSync(D + 'os-draw.js', 'utf8').slice(fs.readFileSync(D + 'os-draw.js', 'utf8').indexOf("TODAY: THE HUB'S SUMMARY"), fs.readFileSync(D + 'os-draw.js', 'utf8').indexOf('HOME HERO'));
  const hubCore = core.slice(core.indexOf("The Hub's summary (Today tab)"), core.indexOf('App shell'));
  ok(hubJs.length > 500 && hubCore.length > 500 && !/innerHTML|mcp|sample|fetch\(|callTool/.test(hubJs + hubCore), 'the Today code uses no innerHTML, connector, sample or network call');
}

// ---- 3. one subscription to hub/today; nothing drawn as known before the first snapshot ----
ok(DB.subs.filter((x) => x.p === 'hub/today').length === 1 && DB.subs[0].p === 'hub/today', 'subscribes once, to the document hub/today', DB.subs.map((s) => s.p));
ok(OS.hub.state() === 'loading', 'before the first snapshot the state is loading', OS.hub.state());
ok(JSON.stringify(counts()) === JSON.stringify(['—', '—', '—', '—']), 'loading: the four tiles show —', counts());
ok(JSON.stringify(notes()) === JSON.stringify({ empty: false, nodb: false, error: false }), 'loading: no sentence shows yet', notes());
ok(openLink().hidden === true && draw('hub-run', 'p').textContent === '' && badge().hidden === true, 'loading: no Open button, no run line, no badge');
ok(brief().hidden === true && !RAN['hub-badge'] && !RAN['hub-brief'] && badge().textContent === '' && !badgeShows(badge()), 'loading: the number and the headline stay hidden as stored, and their own drawings are not run (the type runs none under hidden)', RAN);
const push = (data) => DB.subs[0].next(snapOf('hub/today', data));

// ---- 4. the empty state: the document is missing ----
{
  push(undefined);
  ok(OS.hub.state() === 'missing', 'a missing document: state missing', OS.hub.state());
  ok(JSON.stringify(notes()) === JSON.stringify({ empty: true, nodb: false, error: false }), 'missing: "The Hub has not run yet." shows, the other sentences stay hidden', notes());
  ok(JSON.stringify(counts()) === JSON.stringify(['—', '—', '—', '—']), 'missing: tiles show —', counts());
  ok(nodes(draw('hub-top', 'ul'), (n) => n.tagName === 'LI').length === 0, 'missing: no items');
  ok(openLink().hidden === true && openLink().getAttribute('href') === HUB_URL, 'missing: Open the Hub hidden (no URL known); its fixed href is left alone');
  ok(JSON.stringify(chatShown()) === '[false]', 'missing: Chat hidden (no URL known)', chatShown());
  const run = draw('hub-run', 'p');
  ok(run.textContent === 'Worker: has not run yet' && !run.classList.contains('os-bad'), 'missing: the run line says the worker has not run yet', run.textContent);
  ok(brief().hidden === true && badge().hidden === true, 'missing: no headline, no badge');
  // a document seeded with the Hub's URL only (before the first run): still the empty state, now with the Open button
  push({ hubUrl: HUB_URL });
  ok(OS.hub.state() === 'missing' && notes().empty === true, 'a document with only hubUrl: still "The Hub has not run yet."', [OS.hub.state(), notes()]);
  const a = openLink();
  ok(a.hidden === false && a.getAttribute('href') === HUB_URL, 'a document with only hubUrl: Open the Hub shows with that href', [a.hidden, a.getAttribute('href')]);
  const ch = links().chat;
  ok(ch.length === 1 && ch.every((c) => c.hidden === false && c.getAttribute('href') === HUB_URL + '#chat'), 'a document with only hubUrl: Chat shows and leads to the Hub with #chat', ch.map((c) => [c.hidden, c.getAttribute('href')]));
  push({ hubUrl: OTHER_HUB });
  ok(openLink().hidden === true && JSON.stringify(chatShown()) === '[false]' && openLink().getAttribute('href') === HUB_URL, 'a document naming another Hub address: the links stay hidden and keep their own href', [openLink().hidden, chatShown()]);
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
  const a = openLink();
  ok(a.hidden === false && a.getAttribute('href') === HUB_URL, 'Open the Hub: shown, its href is the hubUrl the document names', [a.hidden, a.getAttribute('href')]);
  const run = draw('hub-run', 'p');
  ok(run.classList.contains('os-bad') && /^Worker: last run 09:00 · failed$/.test(run.textContent), 'last run failed an hour ago: red, with its time and status', [run.className, run.textContent]);
  const head = brief();
  ok(head.hidden === false && head.textContent === DOC.brief.headline, 'the brief headline shows', [head.hidden, head.textContent]);
  const tab = badge();
  ok(tab.hidden === false && tab.textContent === '3', 'the Today tab badge shows how many need you', [tab.hidden, tab.textContent]);
  ok(badgeShows(tab) && RAN['hub-badge'] === 1 && RAN['hub-brief'] === 1 && ['hub-badge', 'hub-brief'].every((n) => (STORED[n] || []).filter(isSlot).length === 1 && (STORED[n] || []).filter(isSlot).every((el) => el.textContent === '')),
    'each was shown by the empty drawing beside it and then drawn once, by the type\'s rule: the number carries the class that shows a badge, and the empty drawings stay empty', [tab.className, RAN]);
  // the fault this guards against: without the empty drawing beside it (as the page was stored before), a drawing that is
  // stored hidden is never run, so nothing ever shows
  // (then hidden is taken off it by code that is not a drawing, as a handler may, and the type draws it: the page's own
  // drawing writes it. So it is the hidden attribute alone that kept it dark, and this check runs the page's lines.)
  const alone = (name, tag, cls) => { const el = new Node(tag), ran = { ...RAN }; el.className = cls; el.dataset.draw = name; el.hidden = true; typeDraws(name, [el]); const under = [el.hidden, el.textContent];
    el.hidden = false; typeDraws(name, [el]); Object.assign(RAN, ran); return [under, [el.hidden, el.textContent, name === 'hub-brief' || badgeShows(el)]]; };
  ok(JSON.stringify([alone('hub-badge', 'span', 'app-badge info'), alone('hub-brief', 'p', 'hub-brief')]) === JSON.stringify([[[true, ''], [false, '3', true]], [[true, ''], [false, DOC.brief.headline, true]]]),
    'a number or a headline that stands alone, stored hidden with no empty drawing beside it, never shows: its drawing is not run under hidden; with hidden taken off by other code the very same element is drawn and shows (3, and the headline)', [alone('hub-badge', 'span', 'app-badge info'), alone('hub-brief', 'p', 'hub-brief')]);
  // the number follows the document, down to nothing and back
  const tabNow = () => { const b = badge(); return [badgeShows(b), b.hidden ? '' : b.textContent]; };
  const seen = [5, 0, 12, -3, 'many', 1234].map((waiting) => { push({ ...DOC, counts: { ...DOC.counts, waiting } }); return tabNow(); });
  ok(JSON.stringify(seen) === JSON.stringify([[true, '5'], [false, ''], [true, '12'], [false, ''], [false, ''], [true, '1,234']]),
    'the tab\'s number follows the count: 5; hidden at zero; back at 12 (a number that was hidden shows again); nothing for a count below zero or one that is no number', seen);
  // the headline follows the document, to nothing and back
  const headNow = () => { const h = brief(); return h.hidden ? null : h.textContent; };
  const said = [{ headline: 'A second headline.' }, { headline: '' }, { headline: '  Back again.  ' }, null, { headline: 7 }, { headline: 'Last one.' }].map((b) => { push({ ...DOC, brief: b }); return headNow(); });
  ok(JSON.stringify(said) === JSON.stringify(['A second headline.', null, 'Back again.', null, null, 'Last one.']),
    'the headline follows the brief: a new one; hidden when there is none; back when there is one again (trimmed); hidden for a brief that is missing or whose headline is no text', said);
  push(DOC);
  ok(JSON.stringify([tabNow(), headNow()]) === JSON.stringify([[true, '3'], DOC.brief.headline]), 'with the first document back the tab reads 3 and the headline is the first one again', [tabNow(), headNow()]);
  ok(JSON.stringify(notes()) === JSON.stringify({ empty: false, nodb: false, error: false }), 'ok: no sentence shows', notes());
}

// ---- 6. the worker's last run: red when it failed, amber when it is not ok; age alone says nothing ----
{
  const runWith = (lastRun) => { push({ ...DOC, lastRun }); const el = draw('hub-run', 'p'); return [el.classList.contains('os-bad'), el.classList.contains('os-warn'), el.textContent]; };
  // without the cockpit's model (another script, loaded after this one) the line is the run's time and status
  let r = runWith({ at: iso(NOW - 60 * 60e3), status: 'ok' });
  ok(r[0] === false && r[1] === false && r[2] === 'Worker: last run 09:00 · ok', 'ok an hour ago: plain', r);
  r = runWith({ at: iso(NOW - 9 * 36e5), status: 'ok' });
  ok(r[0] === false && r[1] === false && r[2] === 'Worker: last run 01:00 · ok', 'ok but 9 hours ago: plain too (an evening, a night or a weekend is no fault; there is no "over 8 hours ago")', r);
  r = runWith({ at: iso(NOW - 26 * 36e5), status: 'ok' });
  ok(r[0] === false && r[1] === false && r[2] === 'Worker: last run yesterday 08:00 · ok', 'yesterday: the time says so', r);
  r = runWith({ at: iso(NOW - 4 * 864e5), status: 'ok' });
  ok(r[0] === false && r[1] === false && r[2] === 'Worker: last run Sun 1 Nov, 10:00 · ok', 'days ago: day and time', r);
  r = runWith({ at: iso(NOW - 60 * 60e3), status: 'failed' });
  ok(r[0] === true && r[1] === false && r[2] === 'Worker: last run 09:00 · failed', 'failed: red', r);
  r = runWith({ at: iso(NOW - 60 * 60e3), status: 'partial' });
  ok(r[0] === false && r[1] === true && /· partial$/.test(r[2]), 'partial an hour ago: amber, not red', r);
  r = runWith({ at: iso(NOW - 9 * 36e5), status: 'partial' });
  ok(r[0] === false && r[1] === true, 'partial 9 hours ago: still amber', r);
  r = runWith({ status: 'ok' });
  ok(r[0] === false && r[2] === 'Worker: last run at an unknown time · ok', 'no time on the run: says the time is unknown', r);
  r = runWith({ at: iso(NOW - 60 * 60e3) });
  ok(r[0] === false && r[1] === true && /· unknown$/.test(r[2]), 'no status on the run: says unknown, amber (not healthy)', r);
  r = runWith({ at: iso(NOW - 10 * 60e3), status: 'running' });
  ok(r[0] === false && r[1] === true && r[2] === 'Worker: last run 09:50 · running', 'a run still marked running: amber, never plain', r);
  r = runWith({ at: iso(NOW - 60 * 60e3), status: 'weird' });
  ok(r[0] === false && r[1] === true, 'an unknown status word: amber', r);
  r = runWith(null);
  ok(r[0] === false && r[2] === 'Worker: has not run yet', 'counts but no run yet: has not run yet', r);
  ok(OS.hub.state() === 'ok', '... and the counts still draw (state ok)', OS.hub.state());
  ok(typeof OS.hub.stale === 'undefined' && !/STALE_MS|8 \* 36e5|over 8 hours/.test(core + fs.readFileSync(D + 'os-draw.js', 'utf8')), 'the 8-hour age rule is gone from the page\'s code');

  // with the cockpit's model there (window.OSCrew.overdue): whether a run is missing is the schedule's to say
  const asked = []; let missed = null;
  global.OSCrew = { overdue: (id, at, now) => { asked.push([id, at, now]); if (missed === 'throw') throw new Error('no schedule'); return missed; }, when: (ms, now, brief) => (brief === true && now === NOW ? new Date(ms).toISOString().slice(11, 16) : 'wrong arguments') };
  const AT = iso(NOW - 26 * 36e5);
  r = runWith({ at: AT, status: 'ok' });
  ok(r[0] === false && r[1] === false && r[2] === 'Worker: last run yesterday 08:00 · ok' && JSON.stringify(asked) === JSON.stringify([['desk', AT, NOW]]), 'the schedule is asked about Desk, with the run\'s time and the clock; nothing overdue: plain', [r, asked]);
  missed = Date.parse('2026-11-05T06:13:00Z');
  r = runWith({ at: AT, status: 'ok' });
  ok(r[0] === false && r[1] === true && r[2] === 'Worker: last run yesterday 08:00 · ok · no result from the 06:13 run', 'a scheduled run left no result: the line names it (in the model\'s short words), in amber', r);
  r = runWith({ at: AT, status: 'failed' });
  ok(r[0] === true && r[1] === false && r[2] === 'Worker: last run yesterday 08:00 · failed · no result from the 06:13 run', 'failed stays red, whatever else', r);
  r = runWith({ at: AT, status: 'partial' });
  ok(r[0] === false && r[1] === true && / · partial · no result from the 06:13 run$/.test(r[2]), 'not ok and overdue: amber', r);
  asked.length = 0; r = runWith(null);
  ok(asked.length === 0 && r[2] === 'Worker: has not run yet' && r[1] === false, 'no run at all: the schedule is not asked', [asked, r]);
  const wrong = ['throw', 'soon', NaN, Infinity, {}, true].filter((odd) => { missed = odd; r = runWith({ at: AT, status: 'ok' }); return r[0] || r[1] || r[2] !== 'Worker: last run yesterday 08:00 · ok'; });
  ok(wrong.length === 0, 'a schedule that throws, or answers something that is no time, leaves the plain line', wrong.map(String));
  delete global.OSCrew;
  // ... and with the real model, when its file has overdue: Thursday 10:00 in Stockholm, Desk runs at 07:13 and 13:13
  const modelFile = D + 'os-cockpit-model.js';
  const real = fs.existsSync(modelFile) ? require(modelFile) : null;
  if (real && typeof real.overdue === 'function' && typeof real.when === 'function') {
    global.OSCrew = real;
    r = runWith({ at: iso(NOW - 60 * 60e3), status: 'ok' });
    const fresh = r.slice();
    r = runWith({ at: iso(NOW - 9 * 36e5), status: 'ok' });
    ok(fresh[0] === false && fresh[1] === false && fresh[2] === 'Worker: last run 09:00 · ok' && r[0] === false && r[1] === true && r[2] === 'Worker: last run 01:00 · ok · no result from the 07:13 run', 'the real schedule: a result at 09:00 answers the 07:13 run; one from 01:00 does not, and the line says so in amber', [fresh, r]);
    delete global.OSCrew;
  } else console.log('skip the run line with the real model: dashboard/os-cockpit-model.js is not there or has no overdue yet');
}

// ---- 7. defensive: odd documents never crash and never follow an odd link ----
{
  push({ ...DOC, top: Array.from({ length: 14 }, (_, i) => ({ id: 'x' + i, title: 'Item ' + i, kind: 'task', severity: 'normal', status: 'new', dueAt: null })) });
  ok(nodes(draw('hub-top', 'ul'), (n) => n.tagName === 'LI').length === 12, '14 top items: the list stops at 12');
  push({ ...DOC, top: 'nope', counts: { waiting: 'many', critical: null }, brief: { headline: '   ' }, hubUrl: 'javascript:alert(1)' });
  ok(nodes(draw('hub-top', 'ul'), (n) => n.tagName === 'LI').length === 0, 'top not a list: no rows, no crash');
  ok(JSON.stringify(counts()) === JSON.stringify(['—', '—', '—', '—']), 'counts that are not numbers show —', counts());
  ok(brief().hidden === true, 'a blank headline hides the line');
  ok(openLink().hidden === true && openLink().getAttribute('href') === HUB_URL, 'a hubUrl that is not the Hub\'s address hides Open the Hub and never reaches its href');
  ok(JSON.stringify(chatShown()) === '[false]' && links().chat.every((c) => c.getAttribute('href') === HUB_URL + '#chat'), 'Chat follows no hubUrl from the document either');
  push({ ...DOC, hubUrl: 'https://example.com/claude.ai/' });
  ok(openLink().hidden === true, 'a non-claude.ai host is not followed either');
  // the same address written another way is the same address: ?…, #… and a trailing slash are not compared
  const alike = [HUB_URL + '#chat', HUB_URL + '/', HUB_URL + '?from=os', HUB_URL + '/?from=os#item=x', HUB_URL + '#'].filter((u) => { push({ ...DOC, hubUrl: u }); return openLink().hidden || !chatShown().every(Boolean); });
  ok(alike.length === 0, 'the Hub\'s address with a fragment, a query or a trailing slash still shows the links', alike);
  const near = [HUB_URL + 'x', HUB_URL + '/more', HUB_URL + '//', ' ' + HUB_URL, HUB_URL.toUpperCase(), HUB_URL.replace('https:', 'http:'), '', '#chat', '/', 42, null, { href: HUB_URL }].filter((odd) => { push({ ...DOC, hubUrl: odd }); return !openLink().hidden || chatShown().some(Boolean); });
  ok(near.length === 0, 'near misses of the address (a longer path, other case, another scheme, nothing, a non-string) keep the links hidden', near);
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
  ok(JSON.stringify(counts()) === JSON.stringify(['—', '—', '—', '—']) && openLink().hidden === true && badge().hidden === true, 'error: tiles —, no Open button, no badge');
  ok(!badgeShows(badge()) && brief().hidden === true, 'error: the tab\'s number and the headline, which showed a moment ago, are hidden again');
  ok(DB.subs.filter((x) => x.p === 'hub/today').length === 1, 'no second subscription to hub/today was opened along the way', DB.subs.map((x) => x.p));
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


// Chat: the Hub pane's link opens the Hub's chat (#chat), only while hub/today names the Hub's own address
{
  const html = fs.readFileSync(D + 'index.html', 'utf8');
  const head = html.slice(0, html.indexOf('<nav class="app-tabs"'));
  ok((html.match(/data-hub-link href="[^"#]+#chat"/g) || []).length === 1 && /<a class="btn" data-hub-link href="[^"#]+#chat" target="_blank" rel="noopener" hidden>/.test(html.slice(html.indexOf('id="hub-today"'), html.indexOf('class="hub-tiles"'))), 'Chat: one link, in the Hub pane, a new tab, hidden until hub/today names the Hub');
  ok(!/data-hub-link|class="app-chat"|>Chat</.test(head) && /<span class="msg-slot" data-draw="hub-links"><\/span>/.test(head), 'Chat: no link in the page header (it never showed there, and would push the scope picker onto a second row); the empty hub-links drawing stays there, clear of any hidden tab');
  ok(/const DRAWS = \[[^\]]*'hub-links'[^\]]*'hub-note'\]/.test(fs.readFileSync(D + 'os-core.js', 'utf8')) && !/'hub-(open|chat)'/.test(fs.readFileSync(D + 'os-core.js', 'utf8')), 'Chat and Open the Hub: shown or hidden again when hub/today changes');
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST CRASHED', e && e.stack); process.exit(1); });
