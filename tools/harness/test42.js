// The cockpit on the page (Contract 4 of the cockpit spec): the stored page, the store, and the wiring.
//  1. The stored page keeps the type's one-writer rule: every data-draw element in dashboard/index.html is stored empty
//     (or a single —) and none sits inside another; the cockpit block is where and what the spec says; its styles
//     keep the rules the page relies on, and the README says of a department agent's document what the page does.
//     It also keeps the type's rule for hidden (no drawing runs under the hidden attribute, so a drawing cannot show
//     itself or what it stands under): what is stored hidden is shown by code that is not a drawing, or by an empty
//     drawing that stands elsewhere. The three tab numbers and the Hub's headline each have one beside them.
//  2. The store: dashboard/build_store.py, run into a temporary folder, keeps every document under 262,144 bytes, holds
//     the four cockpit files, and stores index.html with only its indentation removed.
//  3. The wiring (dashboard/os-cockpit.js) against stand-ins for dash, OS, OSCrew and OSCockpit, on the real markup:
//     the first crew is held until every document and William's reactions have answered (2.5 seconds at most); mount
//     makes a canvas and a tooltip, update hands the scene the derived crew and resizes it, unmount destroys it; the
//     facts come from the page's modules; chips get their line (when and what) and class; a robot click clicks its
//     chip; the tooltip stays inside the stage and is text only; a hidden tab is left alone; a burst of changes is one
//     redraw, on settled facts; the 30-second timer is the script's own, with or without the picture; a second run of
//     the script leaves one timer, one subscription to each document and one listener of each kind; nothing uses
//     innerHTML. Then the same wiring with the real model in place of its stand-in.
//  4. A child run (--real) with the real page scripts and the real model: documents like the ones the agents write, on
//     a fake database, give the crew, the chips and the words of the spec's own example, the Hub pane's run line
//     agrees with the Desk chip, and a robot click really changes tab. The three tab numbers and the Hub's headline
//     show, follow what William does, go at nothing and come back, by the type's rule for hidden.
// Synthetic data only. Nothing here opens the dashboard or a browser.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
process.env.TZ = 'Europe/Stockholm'; // William's clock, so the times in words are stable wherever the suite runs
const REAL = process.argv.includes('--real');
const D = path.join(__dirname, '..', '..', 'dashboard') + path.sep;
const LIMIT = 262144;
const NOW = Date.parse('2026-11-24T12:50:00Z'); // a Tuesday, 13:50 in Stockholm
let T = 0; // ms the test has let pass since NOW
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW + T])); } static now() { return NOW + T; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
let fails = 0, passes = 0;
const ok = (c, l, x) => { if (!c) fails++; else passes++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const realTimeout = setTimeout;
const tick = () => new Promise((r) => realTimeout(r, 0));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- A small DOM: enough of one to hold the real index.html and run the page's scripts on it ----------
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const kebab = (k) => String(k).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }[k]));
// selectors: a comma list of compound selectors (tag, #id, .class, [attr], [attr="value"], :focus-visible). Anything
// else (a combinator, another pseudo-class) is noted in `unsupported` and matches nothing.
const unsupported = new Set(), selCache = new Map();
const parseSel = (sel) => {
  if (selCache.has(sel)) return selCache.get(sel);
  const list = String(sel).split(',').map((raw) => {
    const part = raw.trim();
    if (!part || !/^(?:[a-zA-Z][\w-]*)?(?:#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]|:focus-visible)*$/.test(part)) { unsupported.add(part); return null; }
    const tag = (part.match(/^[a-zA-Z][\w-]*/) || [''])[0].toUpperCase();
    const tests = [...part.slice(tag.length).matchAll(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|(:focus-visible)/g)].map((m) => (
      m[1] ? (e) => e.id === m[1] : m[2] ? (e) => e.classList.contains(m[2]) : m[3] ? (e) => e.attrs.has(m[3]) && (m[4] === undefined || e.attrs.get(m[3]) === m[4]) : (e) => e._focusVisible === true));
    return (e) => (!tag || e.tagName === tag) && tests.every((t) => t(e));
  }).filter(Boolean);
  selCache.set(sel, list);
  return list;
};
const scrolled = [], clicks = [];
let noInk = false; // a browser that gives a canvas no 2D context
// every change of the hidden attribute on an element, and the drawing that was running when it was made (null: none
// was; a handler, a timer, a snapshot, or this test)
const HID = []; let DRAWING = null;
// every write of words or elements that a drawing made outside its own element, on an element that stands on the page.
// The type calls it a stray write: a fault, after which it no longer lets the page be edited by hand. (An element a
// drawing is still building is not on the page; hidden, class, style and aria-* may be set anywhere.)
const STRAY = [];
const noteWrite = (el) => { if (DRAWING && el instanceof El && el !== DRAWING && !DRAWING.contains(el) && root.contains(el)) STRAY.push({ by: DRAWING, on: el }); };
class Tx { constructor(v) { this.nodeType = 3; this.nodeValue = String(v); this.parentNode = null; } get textContent() { return this.nodeValue; } }
class El {
  constructor(tag) {
    this.nodeType = 1; this.tagName = String(tag).toUpperCase(); this.attrs = new Map(); this.childNodes = []; this.parentNode = null; this._on = []; this.line = 0;
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.dataset = new Proxy({}, {
      get: (t, k) => (typeof k === 'string' && this.attrs.has('data-' + kebab(k)) ? this.attrs.get('data-' + kebab(k)) : undefined),
      set: (t, k, v) => { this.attrs.set('data-' + kebab(k), String(v)); return true; },
      has: (t, k) => typeof k === 'string' && this.attrs.has('data-' + kebab(k)),
    });
    const names = () => new Set(String(this.attrs.get('class') || '').split(/\s+/).filter(Boolean)), put = (s) => this.attrs.set('class', [...s].join(' '));
    this.classList = { contains: (c) => names().has(c), add: (...c) => { const s = names(); c.forEach((x) => s.add(x)); put(s); }, remove: (...c) => { const s = names(); c.forEach((x) => s.delete(x)); put(s); },
      toggle: (c, on) => { const s = names(), want = on === undefined ? !s.has(c) : !!on; if (want) s.add(c); else s.delete(c); put(s); return want; } };
  }
  get children() { return this.childNodes.filter((n) => n instanceof El); }
  get id() { return this.attrs.get('id') || ''; }
  get className() { return this.attrs.get('class') || ''; } set className(v) { this.attrs.set('class', String(v)); }
  get hidden() { return this.attrs.has('hidden'); }
  set hidden(v) { const was = this.attrs.has('hidden'); if (v) this.attrs.set('hidden', ''); else this.attrs.delete('hidden'); if (was !== !!v) HID.push({ el: this, to: !!v, by: DRAWING }); }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(v) { this.replaceChildren(); if (String(v) !== '') this.append(String(v)); }
  get innerHTML() { throw new Error('innerHTML was read'); } set innerHTML(v) { throw new Error('innerHTML was written'); }
  append(...nodes) { noteWrite(this); for (const x of nodes) { const n = x instanceof El || x instanceof Tx ? x : new Tx(x); if (n.parentNode) n.parentNode.childNodes.splice(n.parentNode.childNodes.indexOf(n), 1); n.parentNode = this; this.childNodes.push(n); } }
  appendChild(n) { this.append(n); return n; }
  // (as in a browser, an element that is taken out of its parent loses the keyboard: so does one that is taken out and put back)
  _left() { this.parentNode = null; if (document.activeElement instanceof El && this.contains(document.activeElement)) document.activeElement = null; }
  remove() { if (this.parentNode) { noteWrite(this.parentNode); const i = this.parentNode.childNodes.indexOf(this); if (i >= 0) this.parentNode.childNodes.splice(i, 1); this._left(); } }
  // one child taken out, one put in before another (a node that has a parent is moved), as the lane's drawing does
  removeChild(n) { if (!n || n.parentNode !== this) throw new Error('removeChild: not a child'); n.remove(); return n; }
  insertBefore(n, ref) { if (ref != null && ref.parentNode !== this) throw new Error('insertBefore: the reference is not a child'); noteWrite(this); n.remove(); n.parentNode = this; this.childNodes.splice(ref == null ? this.childNodes.length : this.childNodes.indexOf(ref), 0, n); return n; }
  replaceChildren(...nodes) { noteWrite(this); for (const c of this.childNodes) { if (c instanceof El) c._left(); else c.parentNode = null; } this.childNodes = []; this.append(...nodes.filter((n) => n != null)); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); } getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  removeAttribute(k) { this.attrs.delete(k); } hasAttribute(k) { return this.attrs.has(k); }
  matches(sel) { return parseSel(sel).some((t) => t(this)); }
  closest(sel) { for (let n = this; n instanceof El; n = n.parentNode) if (n.matches(sel)) return n; return null; }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  querySelectorAll(sel) { const tests = parseSel(sel), out = []; const walk = (n) => { for (const c of n.children) { if (tests.some((t) => t(c))) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getContext(kind) { return this.tagName === 'CANVAS' && kind === '2d' && !noInk ? (this._ink = this._ink || {}) : null; }
  addEventListener(type, fn, opt) { const cap = opt === true || !!(opt && opt.capture); if (!this._on.some((l) => l.type === type && l.fn === fn && l.cap === cap)) this._on.push({ type, fn, cap }); }
  removeEventListener(type, fn, opt) { const cap = opt === true || !!(opt && opt.capture), i = this._on.findIndex((l) => l.type === type && l.fn === fn && l.cap === cap); if (i >= 0) this._on.splice(i, 1); }
  heard(type) { return this._on.filter((l) => l.type === type).length; }
  // an event at this element; with `bubbles` it goes on to the ancestors and then the document, as a click does
  fire(type, ev, bubbles) {
    const e = Object.assign({ type, target: this, key: '', preventDefault() {}, stopPropagation() {} }, ev || {});
    for (let n = this; n; n = bubbles ? n.parentNode : null) for (const l of [...n._on]) if (l.type === type) l.fn(e);
    if (bubbles) for (const l of [...document._on]) if (l.type === type) l.fn(e);
  }
  click() { clicks.push(this); this.fire('click', {}, true); }
  focus(o) { const was = document.activeElement; if (was && was !== this && was instanceof El) { document.activeElement = null; was.fire('blur'); } document.activeElement = this; this._focusOpts = o; this.fire('focus'); }
  blur() { if (document.activeElement === this) document.activeElement = null; this.fire('blur'); }
  scrollIntoView(o) { scrolled.push({ el: this, o }); }
  getBoundingClientRect() { return { top: 0, left: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight, x: 0, y: 0 }; }
  get clientWidth() { return this._w === undefined ? 600 : this._w; } get clientHeight() { return this._h === undefined ? 200 : this._h; }
  get offsetWidth() { return this._ow === undefined ? 160 : this._ow; } get offsetHeight() { return this._oh === undefined ? 70 : this._oh; }
}
const parse = (html) => {
  const root = new El('#document'), stack = [root], stray = [];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
  let last = 0, line = 1, at = 0, m;
  const text = (t) => { if (t) stack[stack.length - 1].append(decode(t)); };
  while ((m = re.exec(html))) {
    text(html.slice(last, m.index)); last = re.lastIndex;
    line += (html.slice(at, m.index).match(/\n/g) || []).length; at = m.index;
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) { let i = stack.length - 1; while (i > 0 && stack[i].tagName !== m[1].toUpperCase()) i--; if (i > 0) stack.length = i; else stray.push(m[1] + ' at line ' + line); continue; }
    const el = new El(m[2]); el.line = line;
    for (const a of m[3].matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) el.attrs.set(a[1], decode(a[2] ?? a[3] ?? a[4] ?? ''));
    stack[stack.length - 1].append(el);
    if (!VOID.has(m[2].toLowerCase()) && m[4] !== '/') stack.push(el);
  }
  text(html.slice(last));
  return { root, stray, unclosed: stack.slice(1).map((e) => e.tagName + ' at line ' + e.line) };
};

const html = fs.readFileSync(D + 'index.html', 'utf8');
const wiring = fs.readFileSync(D + 'os-cockpit.js', 'utf8');
const css = fs.readFileSync(D + 'os-cockpit.css', 'utf8');
const page = parse(html), root = page.root;
const $$ = (sel) => root.querySelectorAll(sel);
const drawings = (name) => $$('[data-draw]').filter((e) => e.dataset.draw === name);
const stage = () => drawings('cockpit')[0], chip = (id) => $$('[data-ck]').find((c) => c.dataset.ck === id);
const stateOf = (c) => String(c.className).split(/\s+/).filter((k) => /^is-/.test(k));
const lineEl = (id) => drawings('ck-line').find((e) => e.dataset.ckId === id);
const lineOf = (id) => lineEl(id).textContent; // the chip's whole line, as a wide page shows it
const whatOf = (id) => lineEl(id).children.filter((c) => c.classList.contains('ck-what')).map((c) => c.textContent).join('|'); // what a narrow page keeps
const whenOf = (id) => lineEl(id).children.filter((c) => c.classList.contains('ck-when')).map((c) => c.textContent).join('|');
const IDS = ['desk', 'decide', 'instinct', 'muse', 'review'];
// the departments' rooms and their agents, as the model's ROOMS and the page's markup must have them
const DEPT = { hygiene: ['sweeper', 'accounts'], arr: ['pacing', 'forecast', 'renewals'], exec: ['rundown', 'prep'] };
const DEPT_IDS = Object.values(DEPT).flat(), ROOM_IDS = ['mine'].concat(Object.keys(DEPT));
const door = (id) => $$('[data-ck-door]').find((d) => d.dataset.ckDoor === id);
const doorSlot = (id) => drawings('ck-door').find((e) => e.dataset.ckRoom === id);
// a door as drawn: the state class of each of its dots, its number, and the name a screen reader says for it
const pipsOf = (id) => doorSlot(id).querySelectorAll('.ck-pip').map((i) => String(i.className).split(/\s+/).filter((k) => /^is-/.test(k)).join());
const countOf = (id) => doorSlot(id).querySelectorAll('.ck-door-n').map((n) => n.textContent).join('|');
const saidBy = (n) => (n.nodeType === 3 ? n.nodeValue : n.getAttribute('aria-hidden') === 'true' ? '' : n.childNodes.map(saidBy).join(''));
const strip = (id) => $$('.ck-strip').find((u) => u.dataset.ckRoom === id), laneOf = (id) => drawings('ck-lane').find((u) => u.dataset.ckRoom === id);
// The three tab numbers and the Hub's headline. Of each name the page has two elements: an empty drawing (a .msg-slot)
// and, right after it, the number or the headline, stored hidden. shownOf: what one shows now, or null. (A tab's number
// is on show when nothing from it upwards is hidden and it has the class its style asks for: os.css, .app-badge:not(.is-on).)
const FOUR = ['hub-badge', 'dec-badge', 'leo-badge', 'hub-brief'];
const slotOf = (name) => drawings(name).find((e) => e.classList.contains('msg-slot')), numberOf = (name) => drawings(name).find((e) => !e.classList.contains('msg-slot'));
const shownOf = (name) => { const el = numberOf(name); return !el || el.closest('[hidden]') || (el.classList.contains('app-badge') && !el.classList.contains('is-on')) ? null : el.textContent; };
const today0 = () => $$('section').find((s) => s.id === 'today');
const openRoom = () => [$$('[data-ck-door]').filter((d) => d.getAttribute('aria-pressed') === 'true').map((d) => d.dataset.ckDoor).join(), $$('.ck-strip').filter((u) => !u.hidden).map((u) => u.dataset.ckRoom).join(), $$('.ck-lane').filter((u) => !u.hidden).map((u) => u.dataset.ckRoom).join()];

// ---------- the page's surroundings, shared by both runs ----------
const timers = new Map(), timeouts = new Map(); let timerId = 0;
const winOn = [];
global.window = global;
global.setInterval = (fn, every) => { timers.set(++timerId, { fn, every, next: T + every }); return timerId; };
global.clearInterval = (id) => { timers.delete(id); };
global.setTimeout = (fn, ms) => { timeouts.set(++timerId, { fn, ms: ms || 0, at: T + (ms || 0) }); return timerId; };
global.clearTimeout = (id) => { timeouts.delete(id); };
// flush(): what is due at once, or within the time a burst takes to settle, runs now; the clock stays where it is
const flush = () => { for (let n = 0; n < 200; n++) { const next = [...timeouts].filter(([, t]) => t.ms <= 200).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) return; timeouts.delete(next[0]); next[1].fn(); } };
// advance(ms): time passes; timeouts and intervals run in the order they fall due
const advance = (ms) => {
  const end = T + ms;
  for (let n = 0; n < 5000; n++) {
    const next = [...timeouts].map(([id, t]) => ({ id, at: t.at, t })).concat([...timers].map(([id, t]) => ({ id, at: t.next, t, every: true }))).filter((x) => x.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!next) break;
    T = Math.max(T, next.at);
    if (next.every) { next.t.next += next.t.every; next.t.fn(); } else { timeouts.delete(next.id); next.t.fn(); }
  }
  T = end;
};
const tickNow = () => [...timers.values()].forEach((t) => t.fn()); // the 30-second timer fires; the clock stays where it is
global.addEventListener = (type, fn, opt) => { winOn.push({ type, fn, cap: opt === true || !!(opt && opt.capture) }); };
global.removeEventListener = (type, fn, opt) => { const cap = opt === true || !!(opt && opt.capture), i = winOn.findIndex((l) => l.type === type && l.fn === fn && l.cap === cap); if (i >= 0) winOn.splice(i, 1); };
let reducedMotion = false;
global.matchMedia = (q) => ({ matches: /prefers-reduced-motion/.test(q) ? reducedMotion : false });
global.devicePixelRatio = 2; global.innerHeight = 800; global.requestAnimationFrame = (f) => f();
global.location = { hash: '' };
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: () => Promise.resolve() } }, configurable: true, writable: true });
global.document = {
  _on: [], activeElement: null, hidden: false,
  createElement: (t) => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: (t) => new Tx(t), createDocumentFragment: () => new El('#fragment'),
  querySelectorAll: (sel) => root.querySelectorAll(sel), querySelector: (sel) => root.querySelector(sel),
  getElementById: (id) => (id ? root.querySelectorAll('[id="' + id + '"]')[0] || null : null),
  addEventListener(type, fn) { if (!this._on.some((l) => l.type === type && l.fn === fn)) this._on.push({ type, fn }); },
  removeEventListener(type, fn) { const i = this._on.findIndex((l) => l.type === type && l.fn === fn); if (i >= 0) this._on.splice(i, 1); },
};
const docHeard = (type) => document._on.filter((l) => l.type === type).length, winHeard = (type) => winOn.filter((l) => l.type === type).length;
const press = (key) => document._on.filter((l) => l.type === 'keydown').forEach((l) => l.fn({ key }));
// the database: every subscription ever made, and whether it is still live
const DB = { subs: [], uses: 0, writes: [], gate: null };
const snapOf = (p, data) => ({ id: p.split('/').pop(), exists: data !== undefined && data !== null, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });
const docRef = (p) => ({ id: p.split('/').pop(), path: p, get: async () => snapOf(p, undefined),
  onSnapshot(next, error) { const s = { p, next, error, live: true }; DB.subs.push(s); return () => { s.live = false; }; },
  set: async (data) => { if (!/^data\/users\/u_william\//.test(p)) throw new Error('unexpected write to ' + p); DB.writes.push({ p, data }); } });
const live = (p) => DB.subs.filter((s) => s.p === p && s.live);
// a snapshot, or an error, on every live subscription to a document; then the burst is over
const push = (p, data) => { live(p).forEach((s) => s.next(snapOf(p, data))); flush(); };
const fail = (p) => { live(p).forEach((s) => s.error({ code: 'unavailable' })); flush(); };
const fakeDb = { doc: docRef, collection: (c) => ({ doc: (id) => docRef(c + '/' + id) }) };
const claudeWithDb = { use: async (n) => { if (n === 'db') { DB.uses++; if (DB.gate) await DB.gate; return fakeDb; } return n === 'user' ? { id: async () => 'u_william' } : null; } };
global.claude = claudeWithDb;
// the scene: records what the wiring asks of it
const scenes = [];
const sceneStandIn = { create(canvas, opts) {
  const s = { canvas, opts, log: [], crews: [], focus: [], anchors: {}, destroyed: 0,
    setCrew(c) { s.log.push('setCrew'); s.crews.push(c); }, resize(w) { s.log.push('resize ' + w); canvas.style.width = w + 'px'; canvas.style.height = '200px'; return 200; },
    frame() {}, start() { s.log.push('start'); }, stop() { s.log.push('stop'); }, destroy() { s.destroyed++; s.log.push('destroy'); },
    hit() { return null; }, anchor(id) { return s.anchors[id] || null; }, setFocus(id) { s.focus.push(id); } };
  Object.defineProperty(s, 'crew', { get: () => s.crews[s.crews.length - 1] });
  scenes.push(s); return s;
} };
const scene = () => scenes[scenes.length - 1];
const alive = () => scenes.filter((s) => !s.destroyed);
// the dashboard type's part in a drawing: no drawing under the hidden attribute; mount once, update at each call,
// unmount when the element leaves or a call throws; what a drawing throws is kept (the type reports it), not passed on.
// `again` is what it does with a mounted drawing when its name is registered a second time (a second run of the
// scripts): unmount it, keep what mount returned, or just forget it.
const TYPE = { reg: {}, mounted: new Map(), thrown: [], again: 'unmount', links: [] };
TYPE.one = (el) => {
  const name = el.dataset.draw, spec = TYPE.reg[name];
  if (!spec || el.closest('[hidden]')) return false;
  const outer = DRAWING; DRAWING = el; // (who is drawing, for the record of hidden)
  try {
    if (typeof spec === 'function') { try { spec(el); } catch (e) { TYPE.thrown.push(e); } return true; }
    let rec = TYPE.mounted.get(el);
    try {
      if (!rec) { el.replaceChildren(); rec = { name, made: spec.mount(el) }; TYPE.mounted.set(el, rec); }
      spec.update(el, rec.made);
    } catch (e) { TYPE.thrown.push(e); TYPE.mounted.delete(el); if (rec) { try { spec.unmount(el, rec.made); } catch (e2) { TYPE.thrown.push(e2); } } }
    return true;
  } finally { DRAWING = outer; }
};
// A pass, as the type makes it: the drawings handed to it, in the page's order; then, for as long as there are any, the
// drawings on or under an element whose hidden came off during the pass and that the pass has not drawn. So a drawing
// can show another one, whichever of the two comes first on the page. None can show itself: it is not run while hidden.
TYPE.pass = (list) => {
  const done = new Set();
  for (let x = list, from = HID.length; x.length;) {
    for (const el of x) if (TYPE.one(el)) done.add(el);
    const off = HID.slice(from).filter((h) => !h.to && !h.el.hidden && root.contains(h.el)).map((h) => h.el); from = HID.length;
    x = [...new Set(off.flatMap((t) => (t.attrs.has('data-draw') ? [t] : []).concat(t.querySelectorAll('[data-draw]'))))].filter((el) => !done.has(el) && !!TYPE.reg[el.dataset.draw]);
  }
};
TYPE.draw = (name, spec) => {
  if (spec !== undefined) {
    const had = TYPE.reg[name];
    if (had) for (const [el, rec] of [...TYPE.mounted]) if (rec.name === name && TYPE.again !== 'keep') { TYPE.mounted.delete(el); if (TYPE.again === 'unmount') had.unmount(el, rec.made); }
    TYPE.reg[name] = spec; return;
  }
  if (!TYPE.reg[name]) throw new Error('no drawing is registered as ' + name);
  TYPE.pass(drawings(name));
};
TYPE.all = () => TYPE.pass($$('[data-draw]')); // after the scripts, and when a hidden tab comes back
TYPE.leave = (el) => { const rec = TYPE.mounted.get(el); if (rec) { TYPE.mounted.delete(el); TYPE.reg[rec.name].unmount(el, rec.made); } };
const load = (f) => { delete require.cache[require.resolve(D + f)]; require(D + f); };
// the real model, when the file has the words this page is written against (lead and brief beside lines, overdue)
const realModel = () => {
  if (!fs.existsSync(D + 'os-cockpit-model.js')) return null;
  delete require.cache[require.resolve(D + 'os-cockpit-model.js')];
  const m = require(D + 'os-cockpit-model.js');
  let out = null; try { out = m.derive({}, NOW, {}); } catch (e) { out = null; }
  return typeof m.overdue === 'function' && typeof m.when === 'function' && out && out.lead && out.brief ? m : null;
};

// =====================================================================================================================
const staticChecks = () => {
  // ---- 1. the stored page ----
  ok(page.stray.length === 0 && page.unclosed.length === 0, 'index.html: every tag closes', [page.stray, page.unclosed]);
  ok(/^<meta name="dash-one-writer">\n<link rel="stylesheet" href="os\.css">\n<link rel="stylesheet" href="os-cockpit\.css">\n/.test(html), 'index.html opens with the one-writer line, then os.css, then os-cockpit.css');
  const all = $$('[data-draw]');
  const full = all.filter((e) => e.children.length || !/^(—)?$/.test(e.textContent.trim()));
  ok(all.length > 400 && full.length === 0, 'every data-draw element is stored empty or a single — (' + all.length + ' drawings)', full.map((e) => e.dataset.draw + ' at line ' + e.line));
  const dashed = all.filter((e) => /^(TABLE|THEAD|TBODY|TFOOT|TR|UL|OL|DL|SELECT)$/.test(e.tagName) && e.textContent.trim() !== '');
  ok(dashed.length === 0, 'a drawing that is a list, a select or part of a table is stored quite empty (a browser would move a dash out)', dashed.map((e) => e.dataset.draw + ' at line ' + e.line));
  const nested = all.filter((e) => e.parentNode.closest('[data-draw]'));
  ok(nested.length === 0, 'no data-draw element sits inside another', nested.map((e) => e.dataset.draw + ' at line ' + e.line));
  ok(!/\son[a-z]+\s*=/i.test(html.replace(/"[^"]*"/g, '""')) && $$('iframe').length + $$('object').length + $$('base').length + $$('style').length === 0 && $$('script').every((s) => s.attrs.has('src') && !s.attrs.has('type')),
    'no on…= attribute, iframe, style block, inline or module script (the type drops them)');
  const scripts = $$('script').map((s) => s.getAttribute('src'));
  ok(same(scripts.slice(scripts.indexOf('os-draw.js')), ['os-draw.js', 'os-cockpit-model.js', 'os-cockpit-scene.js', 'os-cockpit.js']), 'the three cockpit scripts follow os-draw.js: model, scene, wiring', scripts);

  // What the page stores hidden, and who can show it. The type runs no drawing under the hidden attribute, so a
  // drawing cannot show itself or anything it stands under. That is for code that is not a drawing (a handler,
  // dash.onData, a snapshot from the database), or for an empty drawing that stands elsewhere.
  const hidDraws = all.filter((e) => e.hidden);
  ok(same(hidDraws.map((e) => e.dataset.draw), ['hub-badge', 'dec-badge', 'leo-badge', 'ck-lane', 'ck-lane', 'ck-lane', 'hub-brief']),
    'the drawings that are stored hidden themselves are the three tab numbers and the Hub\'s headline (each shown by the empty drawing beside it) and the three lanes (shown by a door\'s click), and no other', hidDraws.map((e) => e.dataset.draw + ' at line ' + e.line));
  const pairs = FOUR.map((n) => drawings(n));
  ok(pairs.every((t) => t.length === 2 && t[0].tagName === 'SPAN' && t[0].className === 'msg-slot' && t[0].childNodes.length === 0 && !t[0].closest('[hidden]') && t[1].hidden && t[1].childNodes.length === 0 && t[1].parentNode === t[0].parentNode && t[1].parentNode.childNodes[t[1].parentNode.childNodes.indexOf(t[1]) - 1] === t[0])
    && same(pairs.map((t) => [t[1].parentNode.id, t[1].tagName, t[1].className]), [['nav-today', 'SPAN', 'app-badge info'], ['nav-decide', 'SPAN', 'app-badge info'], ['nav-leo', 'SPAN', 'app-badge info'], ['hub-today', 'P', 'hub-brief']]),
    'each of those four names has two elements: an empty drawing (a span.msg-slot, not under hidden) and, right after it, the number or the headline, stored hidden and empty; the numbers in their tabs\' buttons, the headline in the Hub pane', pairs.map((t) => t.map((e) => e.tagName + '.' + e.className + (e.hidden ? ' hidden' : '') + ' at line ' + e.line)));
  ok(pairs.slice(0, 3).every((t) => !!t[0].closest('nav') && !t[0].closest('[data-page]')) && pairs[3][0].closest('[data-page]') === today0(),
    'the empty drawings of the three numbers stand in the tab row, outside every tab\'s section, so they run whichever tab is open; the headline\'s stands under Today, with the headline');
  // (the attributes by which code that is not a drawing finds what it shows: the shell in os-core.js, from a click, a
  // key or dash.onData; and a room's chips, which a door's click shows in os-cockpit.js)
  const BY_CODE = ['data-page', 'data-view-panel', 'data-detail', 'data-palette', 'data-scope-pop', 'data-pd-team', 'data-pd-leads', 'data-pd-deals', 'data-pd-act', 'data-pd-act-em', 'data-oo-sec', 'data-oo-note', 'data-cv-note-k', 'data-act-access'];
  const over = (e) => { const out = []; for (let n = e.parentNode; n instanceof El; n = n.parentNode) if (n.hidden) out.push(n); return out; };
  const odd = all.flatMap((e) => over(e).filter((n) => !BY_CODE.some((a) => n.attrs.has(a)) && !n.classList.contains('ck-strip')).map((n) => e.dataset.draw + ' at line ' + e.line + ' under ' + n.tagName + ' at line ' + n.line));
  ok(all.filter((e) => over(e).length > 0).length > 300 && odd.length === 0, 'no drawing stands under anything stored hidden but a tab, a view, a panel, a popup or a note that the page\'s own code shows, or a room\'s chips, which a door\'s click shows', odd.slice(0, 8));
  const coreJs = fs.readFileSync(D + 'os-core.js', 'utf8'), drawJs = fs.readFileSync(D + 'os-draw.js', 'utf8');
  const shell = coreJs.slice(coreJs.indexOf('// ---------- App shell ----------'));
  const unset = BY_CODE.filter((a) => !new RegExp("querySelectorAll\\('[^']*\\[" + a + "\\][^']*'\\)\\.forEach\\(\\((\\w+)\\) => \\{[^}]*\\b\\1\\.hidden = ").test(shell));
  ok(shell.length > 20000 && unset.length === 0 && /querySelectorAll\('\.ck-strip'\)\.forEach\(\(u\) => \{ u\.hidden = /.test(wiring) && /querySelectorAll\('\.ck-lane'\)\.forEach\(\(u\) => \{ u\.hidden = /.test(wiring) && !BY_CODE.some((a) => drawJs.includes('[' + a + ']')),
    'each of those is shown and hidden by the page\'s shell (os-core.js, outside every drawing), a room\'s chips and its lane by the cockpit\'s wiring; no drawing in os-draw.js looks for any of them', unset);
  const sets = [...drawJs.matchAll(/([\w.]+)\.hidden\s*=(?!=)/g)].map((m) => m[1]);
  ok(same(sets, ['x', 'el', 'a', 'p']) && /if \(showsTwin\(el, name, !!n\)\) return;\n(?:[^\n]*\n){2}  el\.hidden = !n;/.test(drawJs) && /if \(!showsTwin\(el, 'hub-brief', !!h\)\) el\.textContent = h;/.test(drawJs) && !/(remove|toggle|set)Attribute\('hidden'/.test(drawJs),
    'os-draw.js sets hidden in four places and no more: an empty drawing on the number or headline of its name, on the Hub\'s links and on a list\'s sentences (all elsewhere on the page), and a tab\'s number on itself, after the empty drawing of its name has had its turn', sets);

  // the cockpit block: the first thing on Today: the doors, the picture's slot, then each room's chips, the legend,
  // the lanes and the role sentences
  const today = today0(), ck = today && today.children[0];
  ok(!!ck && ck.id === 'cockpit' && ck.classList.contains('pane') && ck.classList.contains('cockpit') && today.children[1].id === 'sense', 'the cockpit is the first child of the Today section, before the sense pane', today && today.children.slice(0, 2).map((c) => c.id));
  ok(ck.getAttribute('role') === 'group' && ck.getAttribute('aria-label') === 'Cockpit', 'the pane is a group named Cockpit: the picture inside it is for the eye, the chips say the same', [ck.getAttribute('role'), ck.getAttribute('aria-label')]);
  ok(drawings('cockpit').length === 1 && stage().parentNode === ck && stage().childNodes.length === 0 && !stage().closest('[hidden]'), 'one stage, stored quite empty, not under hidden');
  const chipEls = $$('[data-ck]'), strips = $$('.ck-strip'), inStrip = (id) => (strip(id) ? strip(id).querySelectorAll('[data-ck]') : []);
  ok(same(inStrip('mine').map((c) => c.dataset.ck), IDS) && chipEls.every((c) => c.tagName === 'BUTTON' && c.getAttribute('type') === 'button' && ck.contains(c)), 'his own room: five chips, one per agent, in desk order, each a button', chipEls.map((c) => c.dataset.ck));
  ok(same(Object.keys(DEPT).map((r) => inStrip(r).map((c) => c.dataset.ck)), Object.values(DEPT)) && same(chipEls.map((c) => c.dataset.ck), IDS.concat(DEPT_IDS)), 'each department\'s room: its chips, one per agent, in desk order (two, three and two); twelve chips in all, his five first, no agent twice', chipEls.map((c) => c.dataset.ck));
  ok(chipEls.every((c) => c.children.filter((x) => x.tagName === 'B').length === 1 && c.children.find((x) => x.tagName === 'B').textContent.trim().length > 0 && c.children.find((x) => x.tagName === 'B').textContent.trim().length <= 12), 'each chip holds its agent\'s name in one <b>, at most 12 characters', chipEls.map((c) => c.textContent));
  ok(chipEls.every((c) => { const l = c.querySelectorAll('[data-draw]'); return l.length === 1 && l[0].dataset.draw === 'ck-line' && l[0].dataset.ckId === c.dataset.ck && l[0].textContent === '—'; }), 'each chip holds one ck-line drawing for its own agent, stored as —');
  const SCREENS = $$('[data-nav-item]').map((b) => b.dataset.nav);
  ok(chipEls.every((c) => !c.dataset.nav || SCREENS.includes(c.dataset.nav)) && chipEls.every((c) => !c.dataset.ckGo || (today.querySelectorAll('[id="' + c.dataset.ckGo + '"]').length === 1 && c.dataset.nav === 'today')), 'a chip\'s data-nav is a tab, and its data-ck-go an element of Today', chipEls.map((c) => [c.dataset.nav, c.dataset.ckGo]));
  ok(same(chipEls.filter((c) => c.dataset.ckAlt).map((c) => [c.dataset.ck, c.dataset.nav, c.dataset.ckAlt]), [['decide', 'decide', 'leo']]) && $$('[id="nav-leo"]').length === 1 && $$('[id="nav-leo"]')[0].dataset.nav === 'leo', 'the Decide chip names its other tab (data-ck-alt="leo"), and that tab\'s button is #nav-leo');
  ok(DEPT_IDS.every((id) => !chip(id).dataset.nav && !chip(id).dataset.ckGo && !chip(id).dataset.ckAlt), 'a department\'s chip names no tab and no element: a press goes to its agent\'s cards in the lane, or shows its tooltip');
  const roles = $$('[data-ck-role]');
  ok(same(roles.slice(0, 5).map((r) => r.dataset.ckRole), IDS) && roles.every((r) => r.textContent.trim().length > 10 && r.closest('[hidden]') && ck.contains(r) && !r.closest('[data-draw]')), 'one role sentence per agent of his own room, in the HTML, kept hidden', roles.map((r) => r.dataset.ckRole));
  ok(same(roles.slice(5).map((r) => r.dataset.ckRole), DEPT_IDS) && roles.slice(5).every((r) => r.textContent.length <= 70 && r.textContent === r.textContent.trim() && !/[—→]/.test(r.textContent)) && ['pacing', 'rundown'].every((id) => /by itself\.$/.test(roles.find((r) => r.dataset.ckRole === id).textContent)),
    'and one per department agent after them, each at most 70 characters; Pacing\'s and Rundown\'s say that they post by themselves', roles.slice(5).map((r) => [r.dataset.ckRole, r.textContent.length]));
  ok(same(['sweeper', 'forecast', 'renewals'].map((id) => roles.filter((r) => r.dataset.ckRole === id).map((r) => r.textContent).join('|')), ['Counts open deals that break your hygiene rules, by team.', 'Compares the directors\' roll-up, Leo\'s call and Salesforce.', 'Lists late renewals.']),
    'the role sentences of Sweeper, Forecast and Renewals are the short ones, to the letter', roles.slice(5).map((r) => r.textContent));
  const help = $$('[data-ck-help]'), legend = help.length === 1 ? $$('[id="' + help[0].getAttribute('aria-controls') + '"]') : [];
  ok(help.length === 1 && help[0].getAttribute('aria-expanded') === 'false' && !!help[0].getAttribute('aria-label') && legend.length === 1 && legend[0].hidden && ck.contains(legend[0]), 'the ? button controls one legend, stored hidden');
  ok(legend[0].textContent === 'At its desk: a run is under way or due; amber means no result yet, red means it failed. At your desk: waiting on you. By the coffee: nothing needs you. An empty chair: no data. Doors: one dot per agent, hollow for no data.', 'the legend names every place and both lamp colours, and says what a door\'s dots and a hollow dot are', legend[0].textContent);
  ok(strips.filter((u) => !u.hidden).length === 1 && strips[0] === strip('mine') && !strips[0].hidden && !!strips[0].getAttribute('aria-label'), 'the chips on show are one labelled list: his own room\'s');
  ok(same(strips.map((u) => [u.dataset.ckRoom, u.getAttribute('aria-label'), u.hidden, u.tagName, u.parentNode === strips[0].parentNode]), [['mine', 'Agents', false, 'UL', true], ['hygiene', 'Data Hygiene agents', true, 'UL', true], ['arr', 'ARR agents', true, 'UL', true], ['exec', 'Executive agents', true, 'UL', true]]),
    'one labelled list per room, side by side in the bar; a department\'s is named after it and stored hidden', strips.map((u) => [u.dataset.ckRoom, u.getAttribute('aria-label'), u.hidden]));
  // the doors: a labelled group of buttons above the picture, one per room, the first one open
  const doorEls = $$('[data-ck-door]'), row = doorEls.length ? doorEls[0].parentNode : null;
  ok(!!row && ck.children[0] === row && ck.children[1] === stage() && row.getAttribute('role') === 'group' && row.getAttribute('aria-label') === 'Rooms' && row.children.length === 4, 'the doors are a group named Rooms, the first thing in the pane, right above the picture', row && [...row.attrs]);
  ok(same(doorEls.map((d) => [d.dataset.ckDoor, d.tagName, d.getAttribute('type'), d.getAttribute('aria-pressed'), d.childNodes[0].nodeValue]), [['mine', 'BUTTON', 'button', 'true', 'Your agents'], ['hygiene', 'BUTTON', 'button', 'false', 'Data Hygiene'], ['arr', 'BUTTON', 'button', 'false', 'ARR'], ['exec', 'BUTTON', 'button', 'false', 'Executive']]),
    'four doors, each a button that opens with its room\'s name; "Your agents" is stored as the open one', doorEls.map((d) => [d.dataset.ckDoor, d.getAttribute('aria-pressed'), d.textContent]));
  ok(doorEls.every((d) => { const l = d.querySelectorAll('[data-draw]'); return d.children.length === 1 && l.length === 1 && l[0].dataset.draw === 'ck-door' && l[0].dataset.ckRoom === d.dataset.ckDoor && l[0].childNodes.length === 0 && d.getAttribute('aria-label') === null; }), 'each door holds one ck-door drawing for its own room, stored quite empty, and has no label of its own: its words are its name');
  // the lanes: one list per department under the chips, for the cards of what its agents prepared
  const lanes = drawings('ck-lane');
  ok(same(lanes.map((u) => [u.dataset.ckRoom, u.tagName, u.hidden, u.childNodes.length, u.parentNode === ck, u.classList.contains('ck-lane') && u.classList.contains('lane-list')]), Object.keys(DEPT).map((r) => [r, 'UL', true, 0, true, true])) && ck.children.indexOf(lanes[0]) > ck.children.indexOf(strips[0].parentNode)
    && same(lanes.map((u) => u.getAttribute('aria-label')), ['Data Hygiene: prepared for you', 'ARR: prepared for you', 'Executive: prepared for you']),
    'three lanes, one per department, each a list stored hidden and quite empty, in the pane under the chips, and named for a screen reader after its room', lanes.map((u) => [u.dataset.ckRoom, u.hidden, u.getAttribute('aria-label')]));

  // the styles: the cockpit's own selectors, the page's own tokens, nothing that needs a fixed width
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(?:media|container)[^{]*\{/g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean).flatMap((s) => s.split(',').map((x) => x.trim()));
  ok(selectors.length > 10 && selectors.every((s) => /^\.(cockpit|ck-)/.test(s)), 'os-cockpit.css: every selector starts with .cockpit or .ck-', selectors.filter((s) => !/^\.(cockpit|ck-)/.test(s)));
  ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(css) && /var\(--color-fg\)/.test(css) && /var\(--color-fg-muted\)/.test(css) && /var\(--color-panel\)/.test(css) && /var\(--line\)/.test(css) && /var\(--r\)/.test(css), 'os-cockpit.css: colours and corners come from the page\'s tokens, none is written out');
  ok(/\.ck-canvas\s*\{[^}]*display:\s*block/.test(css) && /\.ck-strip\s*\{[^}]*flex-wrap:\s*wrap/.test(css) && /:focus-visible\s*\{[^}]*outline:/.test(css) && !/[^-]width:\s*\d+px/.test(css.replace(/min-width|max-width/g, '')), 'os-cockpit.css: the canvas is a block, the chips wrap, focus shows, and nothing has a fixed pixel width');
  const narrow = (css.match(/@container main \(max-width: 30rem\) \{([\s\S]*?)\n\}/) || [])[1] || '';
  ok(/\.ck-when\s*\{\s*display:\s*none;?\s*\}/.test(narrow) && !/border-color:\s*transparent|background:\s*none/.test(narrow) && !/\.ck-when\s*\{[^}]*display:\s*none/.test(css.replace(narrow, '')), 'os-cockpit.css: a narrow page hides only the chip\'s time (.ck-when); the chips stay pills');
  ok(/\.ck-stage\.ck-off\s*\{\s*display:\s*none/.test(css), 'os-cockpit.css: a stage with nothing to draw on folds away');
  // (the hollow dot has two rules, one for a closed door and one for the open, filled one: each is looked for from the
  // start of its own line, so that one cannot stand in for the other)
  ok(/\.ck-doors\s*\{[^}]*flex-wrap:\s*wrap/.test(css) && /\.ck-door\[aria-pressed="true"\]\s*\{[^}]*background:\s*var\(--color-fg\)/.test(css) && /\.ck-door:focus-visible/.test(css)
    && /(^|\n)\.ck-pip\.is-unknown\s*\{[^}]*background:\s*transparent;[^}]*box-shadow:\s*inset/.test(css) && /(^|\n)\.ck-door\[aria-pressed="true"\] \.ck-pip\.is-unknown\s*\{[^}]*background:\s*transparent;[^}]*box-shadow:\s*inset/.test(css),
    'os-cockpit.css: the doors wrap, the open one is filled, focus shows on a door, and the dot of an agent with no data is hollow (no fill, a ring), on a closed door and on the open one');
  ok(/\.ck-strip\[hidden\]/.test(css) && /\.ck-lane\[hidden\]/.test(css) && /\.ck-lane:empty\s*\{\s*display:\s*none/.test(css) && /\.ck-sr\s*\{[^}]*clip-path:\s*inset\(50%\)/.test(css), 'os-cockpit.css: a hidden strip or lane takes no room, nor does an empty lane; what is only said (.ck-sr) is clipped away');
  const faint = +(css.match(/\.ck-pip\s*\{[^}]*var\(--color-fg-muted\) (\d+)%, transparent\)/) || [])[1], idle = +(css.match(/\.ck-pip\.is-idle\s*\{[^}]*var\(--color-fg-muted\) (\d+)%, transparent\)/) || [])[1];
  ok(faint > 0 && faint < idle && /\.ck-door\[aria-pressed="true"\] \.ck-pip\.is-idle\s*\{/.test(css), 'os-cockpit.css: a door\'s dot with no state yet (while the first crew is held) is fainter than an idle one, so that it does not read as "nothing waiting"', [faint, idle]);
  const plainAt = css.search(/(^|\n)\.ck-chip:not\(\[data-nav\]\):not\(\[data-ck-go\]\)\s*\{[^}]*cursor:\s*default/), leadsAt = css.search(/(^|\n)\.ck-chip\.ck-leads:not\(\[data-nav\]\)\s*\{[^}]*cursor:\s*pointer/);
  ok(plainAt >= 0 && leadsAt > plainAt, 'os-cockpit.css: a chip that names no tab and no element has the plain cursor; one marked as leading to its cards (ck-leads) has the pointer again, by a rule that comes after (the two weigh the same)', [plainAt, leadsAt]);
  ok(/(^|\n)\.ck-lane\s*\{[^}]*min-width:\s*0/.test(css.replace(narrow, '')) && /(^|\n)\.ck-lane \.lane-card\s*\{[^}]*overflow-wrap:\s*anywhere/.test(css.replace(narrow, '')),
    'os-cockpit.css: the lane may be narrower than what it holds, and a word too long for a card is broken: a long link in a card does not make the pane, and the picture with it, wider than the page');
  ok(/\.ck-lane \.btn:disabled, \.ck-lane \.btn:disabled:hover\s*\{[^}]*box-shadow:\s*none;[^}]*transform:\s*none;[^}]*opacity:\s*1/.test(css), 'os-cockpit.css: a send button that is off (its agent is on trial) is flat: no glow, no lift on hover, not see-through');
  ok(/\.ck-lane \.lane-ev li\s*\{[^}]*flex-direction:\s*row;[^}]*flex-wrap:\s*wrap/.test(css) && /\.ck-lane \.lane-ev-v\s*\{[^}]*order:\s*-1/.test(css), 'os-cockpit.css: in the lane the evidence is a row of pills with the number first; in a narrow pill the words go under the number');
  ok(/(^|\n)\.ck-lane \.lane-ev-text \.lane-ev-v\s*\{[^}]*order:\s*0;[^}]*font-weight:\s*inherit/.test(css) && /(^|\n)\.ck-lane \.lane-ev-text \.lane-ev-l\s*\{[^}]*font-weight:\s*var\(--cds-font-weight-medium\)/.test(css),
    'os-cockpit.css: a pill whose value is words (the card marks it lane-ev-text) opens with its label: the value keeps its place after the label and its weight goes to the label, so the answer is not read before what it is about');
  // the draft on a department's card ("Read the draft"): a quiet summary that shows the keyboard's focus; the message wraps
  const pageCss = fs.readFileSync(D + 'os.css', 'utf8');
  ok(/(^|\n)\.ck-lane \.lane-draft summary\s*\{[^}]*width:\s*fit-content;[^}]*color:\s*var\(--color-fg-muted\);[^}]*font-size:\s*var\(--cds-font-size-caption\);[^}]*cursor:\s*pointer/.test(css) && /\.lane-meta\s*\{[^}]*font-size:\s*var\(--cds-font-size-caption\);[^}]*color:\s*var\(--color-fg-muted\)/.test(pageCss)
    && /(^|\n)\.ck-lane \.lane-draft summary:focus-visible\s*\{[^}]*outline:\s*2px solid/.test(css) && !/\.lane-draft[^{}]*\{[^}]*(display:\s*none|list-style:\s*none|pointer-events|outline:\s*(none|0))/.test(css),
    'os-cockpit.css: the draft\'s summary is a quiet line, the size and colour of a card\'s grey lines (os.css: .lane-meta), with the pointer, and no wider than its words (width: fit-content: a press beside them opens nothing); it shows the keyboard\'s focus, and nothing hides it or its marker');
  ok(/\.lane-body\s*\{[^}]*white-space:\s*pre-wrap;[^}]*overflow-wrap:\s*anywhere/.test(pageCss) && !/\.lane-(draft|msgs|body)[^{}]*\{[^}]*(white-space|overflow|(min-|max-)?width:\s*\d)/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')),
    'the draft\'s message keeps its line breaks and wraps, also in the middle of a long word (os.css: .lane-body), and nothing in os-cockpit.css changes how it wraps or gives it a width: a long line does not make the card, or the page, wider');
  ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.html\(|createContextualFragment|DOMParser|eval\(|new Function/.test(wiring), 'os-cockpit.js writes no HTML: no innerHTML, outerHTML, insertAdjacentHTML, document.write');
  ok(!/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|import\(|\bawait\b(?![^\n]*\buse\('db'\))/.test(wiring.replace(/\/\/[^\n]*/g, '')), 'os-cockpit.js keeps nothing in the browser and calls no other host; its one await is claude.use(\'db\')');
  ok(!/setAttribute\('(role|aria-label)'/.test(wiring.replace(/setAttribute\('role', 'tooltip'\)/, '')) && /setAttribute\('aria-hidden', 'true'\)/.test(wiring), 'os-cockpit.js gives the canvas no role and no label: it is hidden from assistive technology');

  // what the README says of the cockpit, where a writer of an agent's document or a reader of a chip would be misled
  const readme = fs.readFileSync(path.join(D, '..', 'README.md'), 'utf8').replace(/\s+/g, ' ');
  ok(/its chip says "trial" beside its last result \(not while a run is due, late, under way or failed\), its tooltip says "Trial: nothing can be sent" in all of those states/.test(readme) && !/its chip says "trial", its tooltip/.test(readme) && !/On trial: nothing it prepared can be sent/.test(readme),
    'README: an agent on trial says "trial" on its chip beside its last result only, as "partial" is said (the model\'s rule, pinned in test40); its tooltip says "Trial: nothing can be sent" in those states too');
  ok(/from 1 January 2027 their tooltips say only "Not linked to the cockpit yet": the sentence on what the agent does \(which says that it posts\) is left out, since the model marks the agent as stopped/.test(readme) && !/their tooltips no longer say "Runs today and posts by itself", only/.test(readme),
    'README: from 1 January 2027 the tooltips of Pacing and Rundown say only that they are not linked; the sentence on what the agent does is left out');
  ok(/their chips read "not linked yet", and their tooltips say what the agent does \(its role sentence in `index\.html`\) and then "Not linked to the cockpit yet"\. Neither says that its agent runs today: Pacing runs on weekdays only\./.test(readme) && !/Runs today|run today/.test(readme),
    'README: before that the tooltips of Pacing and Rundown are the role sentence and "Not linked to the cockpit yet"; nothing in the README says any more that an agent runs today');
  ok(/Every other result has to list its `items` \(an empty list when it has none, which reads as nothing waiting\); one where `items` is left out or is not a list reads "no data"/.test(readme) && /An item whose `id` is empty is left out: it is not counted and gets no card/.test(readme),
    'README: a result has to list its items (else "no data"), and an item needs an id that is not empty (else it is left out)');
  ok(/reads "no data", and so does one of whose items none has an id\. The chair is then empty and the tooltip says "Can't read the database here", as Desk's does for a summary without a count; nothing else is said of the agent meanwhile, not that a run is due, late or under way\./.test(readme)
    && /An empty chair: no data \(its document can't be read, was never written, or does not say what waits\)/.test(readme),
    'README: a result of whose items none has an id reads "no data" too; it says what the tooltip then says, that nothing else is said of the agent meanwhile, and names this third reason for an empty chair');
  ok(/A department's room goes on waiting for your reactions past the 2\.5 seconds, however long they take: its cards are not shown before them, so its chips, its door and its robots wait with them/.test(readme),
    'README: a department\'s room waits for his reactions also past the 2.5 seconds: no count stands over an empty lane');
  ok(/On trial and off, a card whose action has messages has \*\*Read the draft\*\* under its buttons: closed until you press it, it shows each message as text \(what it is, to whom when the document names someone, its subject, and its body to the letter\)\. Opening it sends nothing and writes nothing, and nothing in it can be pressed\./.test(readme),
    'README: what a card\'s action would send can be read on the card, on trial and off; opening the draft does nothing else');
  ok(/An agent's cards do not repeat what they share: only its first card in the lane says for what the document was written \(its `scope`\), and a card ends with where its item is from \("From …", its `source`\) only when the card before it, of the same agent, does not name the same source\. First and before are counted among the cards in the lane now: when you handle the first card, the next one says the scope and the source\./.test(readme)
    && /A card is made anew only when what it is made of changed \(whether it carries those two lines is part of that\); every other card is left untouched, so an open draft stays open and the keyboard keeps its place\./.test(readme) && !/says Trial, when and for what the document was written/.test(readme),
    'README: the scope is on an agent\'s first card only and where an item is from is said once; first and before are counted among the cards now in the lane; a card that is made of the same is left untouched');
  ok(/The Today, Decide and For Leo tabs each show a number while something waits on you: Needs you less what you have handled on this tab; the decisions you have not answered; the points for Leo you have not acted on\. At nothing the number goes\. The brief's headline stands under the four counts while the brief has one\./.test(readme)
    && /the dashboard type runs no drawing under the `hidden` attribute: a drawing can hide itself, but it is never run again to show itself\. So beside each stands an empty drawing of the same name \(a `\.msg-slot`, in the tab's button or in the Hub pane\) that only sets `hidden` on it; when `hidden` comes off, the type draws it, and it writes its own number or headline\./.test(readme)
    && /The numbers' empty drawings stand in the tab row, so a number follows whichever tab is open; the headline's stands under Today, so the headline is drawn while Today is open and when it comes back\./.test(readme),
    'README: what the three tab numbers and the headline show, that each is a drawing stored hidden with an empty drawing of its name beside it to show it, and where those stand');
  ok(/A word too long for its line \(a long link, say\) is broken: in these cards, in Decide's and For Leo's, in the lines under their lists and in the Hub's headline, as in the cockpit's lane\. A topic chip that is too long runs over several lines\. So nothing a document says makes the page scroll sideways on a phone/.test(readme),
    'README: a word too long for its line is broken in every list of cards and in the headline, so the page does not scroll sideways');
  ok(/The pane's columns are 20rem wide at least where there is room and never wider than the pane, so on a narrow phone its cards fit whatever the font size/.test(readme),
    'README: the columns of the Instinct and Muse pane are never wider than the pane, so its cards fit a narrow phone');
  ok(/A number waits until your own reactions have been read, as the cockpit's counts do: before that it would count what you have handled already, and drop a moment later/.test(readme),
    'README: a tab\'s number waits for his own reactions, as the cockpit\'s counts do');
  ok(/and the card says the same, "Trial: nothing can be sent\."; Got it and Not useful still work, and take the card away at once\./.test(readme) && !/Trial week/.test(readme),
    'README: on trial the card says what the tooltip says, "Trial: nothing can be sent."; nothing in the README says "Trial week" any more');
  ok(/What a card is made of is no more than it uses: a card on trial stays when Claude beside the page comes or goes \(it can send nothing either way\), and a card you sent on is made anew when the words of its time change, so that after midnight "Sent to Claude · 13:50" names the day\./.test(readme),
    'README: a card on trial stays when Claude beside the page comes or goes, and a card he sent on is made anew when the words of its time change');
  ok(/`tools\/harness\/test35\.js` checks the tab order, the empty state, a fake `hub\/today` rendering that the hero still draws, the Chat links, and that the Today tab's number and the headline show, go at nothing and come back\./.test(readme),
    'README: what test35.js checks, the Today tab\'s number and the headline among it');

  // ---- 2. the store ----
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'os-store-'));
  let log = '', built = true;
  try { log = execFileSync('python3', [D + 'build_store.py', out], { encoding: 'utf8', timeout: 120000 }); } catch (e) { built = false; log = String(e.stdout || '') + String(e.stderr || e.message || ''); }
  ok(built, 'build_store.py builds the store (into a temporary folder) and exits clean', log.slice(-400));
  if (built) {
    const docs = ['dash', 'datasets', 'files'].flatMap((col) => fs.readdirSync(path.join(out, col)).map((f) => ({ col, f, size: fs.statSync(path.join(out, col, f)).size })));
    const over = docs.filter((d) => d.size >= LIMIT);
    ok(docs.length > 60 && over.length === 0, 'every stored document is under 262,144 bytes (' + docs.length + ' documents)', over);
    const printed = docs.every((d) => new RegExp('/' + d.col + '/' + d.f.replace(/[.]/g, '\\.') + ' ' + d.size + '(\\n|$)').test(log));
    ok(printed, 'build_store.py prints each document\'s size');
    const stored = (f) => JSON.parse(fs.readFileSync(path.join(out, 'files', f + '.json'), 'utf8'));
    const names = fs.readdirSync(path.join(out, 'files')).map((f) => f.replace(/\.json$/, '')).sort();
    ok(same(names, ['index.html', 'os-calcs-act.js', 'os-calcs-conv.js', 'os-calcs-leads.js', 'os-calcs.js', 'os-cockpit-model.js', 'os-cockpit-scene.js', 'os-cockpit.css', 'os-cockpit.js', 'os-core.js', 'os-draw.js', 'os.css']), 'the store holds the twelve files of the page, the four cockpit files among them', names);
    ok(names.filter((f) => f !== 'index.html').every((f) => stored(f).text === fs.readFileSync(D + f, 'utf8')) && names.every((f) => stored(f).edit && stored(f).edit.via === 'claude'), 'every file but index.html is stored as it is in the repo');
    const idx = docs.find((d) => d.col === 'files' && d.f === 'index.html.json');
    ok(idx.size < LIMIT - 8192, 'the stored index.html is clearly under the limit: ' + idx.size + ' bytes, ' + (LIMIT - idx.size) + ' to spare', idx.size);
    const src = html.split('\n'), kept = stored('index.html').text.split('\n');
    ok(kept.length === src.length && kept.every((l, i) => l === src[i].replace(/^[ \t]+/, '')) && src.some((l) => /^\s+</.test(l)) && !kept.some((l) => /^[ \t]/.test(l)), 'the stored index.html is the source with each line\'s leading whitespace removed, and nothing else; the source keeps its indentation');
    const again = parse(stored('index.html').text);
    const flat = (n) => (n instanceof El ? '<' + n.tagName + [...n.attrs].map(([k, v]) => ' ' + k + '=' + v).join('') + '>' + n.childNodes.map(flat).join('') : n.nodeValue.replace(/\s+/g, ' '));
    ok(flat(again.root) === flat(root), 'read back, the stored page has the same elements, attributes and words as the source');
    const storedDraws = again.root.querySelectorAll('[data-draw]');
    ok(storedDraws.length === all.length && storedDraws.every((e) => !e.children.length && /^(—)?$/.test(e.textContent.trim())), 'the stored copy has no drawing stored with content either');
    const builder = fs.readFileSync(D + 'build_store.py', 'utf8');
    ok(/LIMIT = 262144\b/.test(builder) && /if size > LIMIT: over\.append/.test(builder) && /sys\.exit\(f'\{len\(over\)\}/.test(builder), 'build_store.py fails when a document is over 262,144 bytes');
  }
  fs.rmSync(out, { recursive: true, force: true });
};

// =====================================================================================================================
// ---- 3. the wiring against stand-ins ----
const standIns = async () => {
  // the page's modules, as the wiring reads them: nothing has answered yet
  const H = { state: 'loading', doc: null, acted: {}, ready: false };
  const SN = { state: { instinct: 'loading', muse: 'loading' }, docs: { instinct: null, muse: null }, acted: {}, ready: false, cards: {} }; // cards: what the reader says the lane shows of an agent
  const LN = { state: { decisions: 'loading', leo: 'loading' }, docs: { decisions: null, leo: null }, answered: {}, leoActed: {}, ready: false };
  // OS.docs: fire() is one change; changed() is a change and then the end of its burst
  const bus = (() => { const fns = new Set(), fire = () => [...fns].forEach((fn) => fn()); return { on: (fn) => { fns.add(fn); return () => { fns.delete(fn); }; }, fire, changed: () => { fire(); flush(); }, size: () => fns.size }; })();
  const items = (d) => (d && Array.isArray(d.items) ? d.items : []);
  const osStandIn = {
    hub: { state: () => H.state, doc: () => H.doc, counts: () => (H.doc && H.doc.counts && typeof H.doc.counts === 'object' ? H.doc.counts : null), top: () => (H.doc && Array.isArray(H.doc.top) ? H.doc.top : []), acted: (id) => H.acted[id] || null, ready: () => H.ready },
    sense: { state: (k) => SN.state[k], doc: (k) => SN.docs[k], items: (k) => items(SN.docs[k]), cards: (k) => SN.cards[k] || [], acted: (id) => SN.acted[id] || null, ready: () => SN.ready },
    lanes: { state: (k) => LN.state[k], doc: (k) => LN.docs[k], items: (k) => items(LN.docs[k]), answered: (id) => LN.answered[id] || null, leoActed: (id) => LN.leoActed[id] || null, ready: () => LN.ready },
    docs: bus,
  };
  // The model: says what it was handed, and answers something that follows the facts, in the shape the real one has:
  // lines[id] is lead[id] (a time, when the line is about the last result), ' · ', and brief[id].
  // It has the rooms: his own (asked for without a roster, as ever) and the departments' (asked for with the room's agents).
  const model = { calls: [], outs: [], fail: false };
  const STAND_ROOMS = [{ id: 'mine', name: 'Your agents', agents: IDS.map((id) => ({ id })) }].concat(Object.entries(DEPT).map(([id, ids]) => ({ id, name: id, agents: ids.map((x) => ({ id: x })) })));
  const modelStandIn = { ROOMS: STAND_ROOMS, overdue: () => null, when: () => '', derive(facts, now, names, roster) {
    const room = arguments.length < 4 ? STAND_ROOMS[0] : STAND_ROOMS.find((r) => r.agents === roster) || { id: 'not a room of the model', agents: [] };
    model.calls.push({ facts: JSON.parse(JSON.stringify(facts)), now, names: { ...names }, room: room.id, args: arguments.length });
    if (model.fail) throw new Error('the model threw');
    const out = { crew: [], lines: {}, lead: {}, brief: {}, tips: {}, aria: '', total: 0 };
    for (const id of room.agents.map((a) => a.id)) {
      const f = facts[id] || {}, p = (facts.pulse || {})[id];
      const state = f.src !== 'ok' ? 'unknown' : p && p.state === 'running' ? 'working' : f.status === 'failed' ? 'error' : f.waiting > 0 ? 'needs' : 'idle';
      out.crew.push({ id, name: names[id] || id, look: 'plain', hue: 'teal', state, waiting: f.waiting || 0, step: (p && p.step) || '', bubble: '', fresh: 0 });
      out.lead[id] = (state === 'needs' || state === 'idle') && f.at ? String(f.at).slice(11, 16) : '';
      out.brief[id] = f.src === 'loading' ? '' : state + ' ' + (f.waiting || 0);
      out.lines[id] = (out.lead[id] ? out.lead[id] + ' · ' : '') + out.brief[id];
      out.tips[id] = { state: 'Now: ' + state, last: f.at ? 'Last result ' + f.at : '', next: 'Next run soon' };
      if (state !== 'unknown') out.total += f.waiting || 0;
    }
    out.aria = out.crew.map((a) => a.name + ': ' + a.state + '.').join(' ');
    if (room.id === 'mine') model.last = out; // (model.last: what it last made of his own five)
    model.outs.push(out);
    return out;
  } };
  const facts = () => model.calls[model.calls.length - 1].facts;
  const mineCall = () => model.calls.filter((c) => c.room === 'mine').pop(); // the last time his own room was asked for
  const shell = []; // the page's own click handler, as far as the cockpit needs it: it sees which tab a click asks for
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-nav]'); shell.push(t ? t.dataset.nav : null); });

  // ---- leaves quietly when a part is missing ----
  global.dash = { draw: TYPE.draw }; global.OS = osStandIn; global.OSCrew = modelStandIn; global.OSCockpit = sceneStandIn;
  {
    const parts = { dash: global.dash, OS: osStandIn, OSCrew: modelStandIn, OSCockpit: sceneStandIn }, quiet = [];
    for (const k of Object.keys(parts)) {
      global[k] = undefined;
      let threw = null; try { load('os-cockpit.js'); } catch (e) { threw = e; }
      await tick();
      if (threw || Object.keys(TYPE.reg).length || timers.size || timeouts.size || DB.subs.length || winOn.length || docHeard('keydown') || $$('[data-ck]').some((c) => c._on.length) || $$('[data-ck-door]').some((d) => d._on.length) || bus.size()) quiet.push(k + (threw ? ': ' + threw.message : ''));
      global[k] = parts[k];
    }
    ok(quiet.length === 0, 'without dash, OS, OSCrew or OSCockpit the script leaves quietly: no throw, drawing, timer, subscription or listener', quiet);
  }

  // ---- the first run ----
  load('os-cockpit.js');
  ok(typeof TYPE.reg.cockpit === 'object' && ['mount', 'update', 'unmount'].every((k) => typeof TYPE.reg.cockpit[k] === 'function') && typeof TYPE.reg['ck-line'] === 'function', 'registers the cockpit drawing as { mount, update, unmount } and ck-line as a function', Object.keys(TYPE.reg));
  ok(typeof TYPE.reg['ck-door'] === 'function' && same(Object.keys(TYPE.reg).sort(), ['ck-door', 'ck-line', 'cockpit']), '... and ck-door as a function, and no other: the lane\'s cards are drawn by the page (os-draw.js)', Object.keys(TYPE.reg));
  ok(same(openRoom(), ['mine', 'mine', '']), 'the page stands in his own room: that door pressed, that strip on show, every lane hidden', openRoom());
  ok(timers.size === 1 && [...timers.values()][0].every === 30000 && scenes.length === 0, 'the script itself starts the one 30-second timer (the chips keep time without the picture), and no scene', [...timers.values()].map((t) => t.every));
  ok(timeouts.size === 1 && [...timeouts.values()][0].ms === 2500, '... and one timeout: the longest the first crew is held', [...timeouts.values()].map((t) => t.ms));
  await tick(); await tick();
  ok(DB.uses === 1 && same(DB.subs.map((s) => s.p).sort(), ['hub/pulse', 'hub/weekly']) && DB.subs.every((s) => s.live && typeof s.error === 'function'), 'one claude.use(\'db\'), one subscription to hub/weekly and one to hub/pulse, each with an error callback', [DB.uses, DB.subs.map((s) => s.p)]);
  ok(bus.size() === 1, 'listens once on OS.docs', bus.size());
  const heardOnce = () => $$('[data-ck]').length === 12 && $$('[data-ck]').every((c) => ['mouseenter', 'mouseleave', 'focus', 'blur', 'click'].every((t) => c.heard(t) === 1)) && $$('[data-ck-help]').every((b) => b.heard('click') === 1) && $$('[data-ck-door]').length === 4 && $$('[data-ck-door]').every((d) => d.heard('click') === 1 && d._on.length === 1) && docHeard('keydown') === 1 && winOn.length === 0;
  ok(heardOnce(), 'one listener of each kind on each chip (a department\'s too) and on the ? button, one click on each door, one keydown on the document, none on the window (a scroll leaves the tooltip be)');

  // ---- the first second: the crew is held until every document, and William's reactions, have answered ----
  const held = () => scene().crew.length === 0 && IDS.every((id) => lineOf(id) === '—' && lineEl(id).children.length === 0 && stateOf(chip(id)).length === 0);
  TYPE.all();
  const s1 = scene(), st = stage();
  ok(TYPE.thrown.length === 0 && scenes.length === 1 && same(s1.log, ['setCrew', 'resize 600', 'start']), 'the drawing runs without a throw: one scene, handed a crew, then its width, then started (the order it is previewed in)', [TYPE.thrown.map(String), s1.log]);
  ok(held() && model.calls.length === 0, 'nothing has answered yet: an empty room, every chip at its dash with no state, and the model is not asked', [s1.crew, IDS.map(lineOf)]);
  const bare = () => same(ROOM_IDS.map(pipsOf), [['', '', '', '', ''], ['', ''], ['', '', ''], ['', '']]) && ROOM_IDS.every((r) => countOf(r) === '') && same(ROOM_IDS.map((r) => saidBy(door(r))), ['Your agents, 5 agents', 'Data Hygiene, 2 agents', 'ARR, 3 agents', 'Executive, 2 agents']);
  ok(bare(), 'while the crew is held a door has one dot per agent of its room with no state (drawn faint) and no number, and says only how many agents it has: nothing is claimed yet', [ROOM_IDS.map(pipsOf), ROOM_IDS.map(countOf), ROOM_IDS.map((r) => saidBy(door(r)))]);
  H.state = 'ok'; H.doc = { at: '2026-11-24T12:16:30Z', lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, counts: { waiting: 113, critical: 1 }, top: [{ id: 'a', status: 'waiting' }, { id: 'b', status: 'new' }, { id: 'c', status: 'prepared' }] };
  bus.changed();
  ok(held() && model.calls.length === 0, 'one document has answered: still held (no robot sets off alone)');
  SN.state = { instinct: 'ok', muse: 'error' }; SN.docs = { instinct: { at: '2026-11-24T07:30:00Z', items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }] }, muse: null }; SN.acted = { i2: { action: 'ack' } };
  LN.state = { decisions: 'ok', leo: 'ok' };
  LN.docs = { decisions: { at: '2026-11-24T06:44:12Z', items: Array.from({ length: 10 }, (_, i) => ({ id: 'd' + i })) }, leo: { at: '2026-11-24T06:45:40Z', items: Array.from({ length: 7 }, (_, i) => ({ id: 'l' + i })) } };
  bus.changed();
  ok(held(), 'the page\'s documents have answered, hub/weekly has not: still held');
  push('hub/weekly', { at: '2026-11-23T06:46:19Z', week: '2026-11-23', parent: 'words the page never shows', slack: { channel: 'D0AAAAAAAA', ts: '1.2' } });
  ok(held() && model.calls.length === 0, 'every document has answered, William\'s reactions to them have not: still held (a count would be too high)');
  H.ready = SN.ready = true; bus.changed();
  ok(held() && bare(), 'two of the three modules say their reactions have answered: still held, the doors too');
  LN.ready = true; bus.fire();
  ok(s1.crew.length === 5 && model.calls.length === 10 && timeouts.size === 0 && lineOf('desk') === '12:15 · needs 113', 'the last answer releases the crew at once: the scene gets all five, the chips their lines, the doors their dots, and the hold\'s timeout is let go', [s1.crew.length, model.calls.length, timeouts.size, lineOf('desk')]);
  ok(same(s1.log, ['setCrew', 'resize 600', 'start', 'setCrew']) && s1.crews[0].length === 0, 'while it was held the scene was left alone: one empty crew, then the real one', s1.log);

  // ---- what mount made ----
  const canvas = st.children.find((c) => c.tagName === 'CANVAS'), tip = st.children.find((c) => c.tagName !== 'CANVAS');
  ok(st.children.length === 2 && !!canvas && s1.canvas === canvas && canvas.getAttribute('aria-hidden') === 'true' && canvas.getAttribute('role') === null && canvas.getAttribute('aria-label') === null, 'mount puts one canvas in the stage and gives it to the scene; it is aria-hidden, with no role and no label (the chips say it all)', [...canvas.attrs]);
  ok(!!tip && tip.hidden === true && tip.parentNode === st && tip.getAttribute('role') === 'tooltip' && tip.id === 'ck-tip', 'mount puts the tooltip inside the stage too: hidden, role="tooltip", with an id', tip && [...tip.attrs]);
  ok(typeof s1.opts.now === 'function' && s1.opts.now() === NOW && Number.isFinite(s1.opts.seed) && s1.opts.reducedMotion === false && typeof s1.opts.onHover === 'function' && typeof s1.opts.onPick === 'function', 'the scene gets now(), a numeric seed, reducedMotion and the two callbacks', Object.keys(s1.opts));
  ok(s1.crew.length === 5 && s1.crew.every((a, i) => a === model.outs[0].crew[i]) && model.outs.length === 10, 'update hands the scene the very crew the model derived (one derive for the stage, one for each chip line on show, one for each door)', model.outs.length);
  ok(same(model.calls.map((c) => [c.room, c.args]), [['mine', 3], ['mine', 3], ['mine', 3], ['mine', 3], ['mine', 3], ['mine', 3], ['mine', 3], ['hygiene', 4], ['arr', 4], ['exec', 4]]) && same(model.calls.slice(7).map((c) => Object.keys(c.names)), Object.values(DEPT)),
    'his own room is asked for as it always was (three arguments, the model\'s own five); a department\'s with its agents as the fourth, and the names from its own chips', model.calls.map((c) => [c.room, c.args, Object.keys(c.names).length]));
  // the doors: a dot per agent in its state's colour, the number that waits in the room, and the name that is said
  ok(same(ROOM_IDS.map(pipsOf), [['is-needs', 'is-needs', 'is-needs', 'is-unknown', 'is-idle'], ['is-unknown', 'is-unknown'], ['is-unknown', 'is-unknown', 'is-unknown'], ['is-unknown', 'is-unknown']]) && same(ROOM_IDS.map(countOf), ['132', '', '', '']), 'each door is drawn, open or not: one dot per agent with its state, and the model\'s total for the room (no number when nothing waits)', [ROOM_IDS.map(pipsOf), ROOM_IDS.map(countOf)]);
  ok(same(ROOM_IDS.map((r) => saidBy(door(r))), ['Your agents, 5 agents, 132 waiting on you', 'Data Hygiene, 2 agents, no data', 'ARR, 3 agents, no data', 'Executive, 2 agents, no data']) && ROOM_IDS.every((r) => doorSlot(r).querySelectorAll('.ck-pips')[0].getAttribute('aria-hidden') === 'true' && doorSlot(r).querySelectorAll('.ck-door-n').every((n) => n.getAttribute('aria-hidden') === 'true')),
    'a door\'s name, as it is said: the room, how many agents, and what waits; the dots and the number are for the eye only', ROOM_IDS.map((r) => saidBy(door(r))));
  ok(doorSlot('mine').children.every((c) => c.tagName === 'SPAN') && doorSlot('mine').querySelectorAll('.ck-pip').every((i) => i.tagName === 'I' && i.childNodes.length === 0) && door('mine').children.length === 1 && door('mine').childNodes[0].nodeValue === 'Your agents', 'the ck-door drawing writes in its own element and nothing else in the door');
  // What a door says is what its dots show. A run that failed, or one that left no result, is said: "nothing waiting"
  // is said only when neither is so and an agent has data, "no data" when none has.
  { const real = modelStandIn.derive;
    const hygieneAs = (states, total) => {
      modelStandIn.derive = (...a) => { const o = real(...a); if (o.crew.length === 2 && o.crew[0].id === 'sweeper') { o.crew.forEach((c, i) => { c.state = states[i]; }); o.total = total; } return o; };
      bus.changed();
      return saidBy(door('hygiene')) + ' [' + pipsOf('hygiene').join(' ') + (countOf('hygiene') ? ' #' + countOf('hygiene') : '') + ']';
    };
    ok(same([hygieneAs(['error', 'unknown'], 0), hygieneAs(['late', 'needs'], 2), hygieneAs(['due', 'error'], 0), hygieneAs(['error', 'late'], 4), hygieneAs(['needs', 'idle'], 3), hygieneAs(['idle', 'unknown'], 0), hygieneAs(['working', 'idle'], 0), hygieneAs(['unknown', 'unknown'], 0), hygieneAs(['asleep', 'unknown'], 0)],
      ['Data Hygiene, 2 agents, 1 failed [is-error is-unknown]', 'Data Hygiene, 2 agents, 2 waiting on you, 1 with no result yet [is-late is-needs #2]', 'Data Hygiene, 2 agents, 1 failed, 1 with no result yet [is-due is-error]', 'Data Hygiene, 2 agents, 4 waiting on you, 1 failed, 1 with no result yet [is-error is-late #4]',
        'Data Hygiene, 2 agents, 3 waiting on you [is-needs is-idle #3]', 'Data Hygiene, 2 agents, nothing waiting [is-idle is-unknown]', 'Data Hygiene, 2 agents, nothing waiting [is-working is-idle]', 'Data Hygiene, 2 agents, no data [is-unknown is-unknown]', 'Data Hygiene, 2 agents, no data [is-unknown is-unknown]']),
      'a door says what its dots show: what waits, then how many runs failed (red) and how many left no result yet (amber); "nothing waiting" only when none of that is so and an agent has data; "no data" when none has; a state it does not know is no data');
    modelStandIn.derive = real; bus.changed(); }
  ok(model.calls.every((c) => c.now === NOW) && same(model.calls[0].names, { desk: 'Desk', decide: 'Decide', instinct: 'Instinct', muse: 'Muse', review: 'Review' }), 'derive gets the clock and the names read from the chips', model.calls[0].names);

  // ---- the chips: when, what, and one class ----
  ok(whenOf('desk') === '12:15 · ' && whatOf('desk') === 'needs 113' && lineEl('desk').children.length === 2 && same(stateOf(chip('desk')), ['is-needs']), 'a chip\'s line is two spans: when (the model\'s lead and a dot) and what (its brief); the chip gets one state class', [lineEl('desk').children.map((c) => [c.className, c.textContent]), stateOf(chip('desk'))]);
  ok(whenOf('muse') === '' && whatOf('muse') === 'unknown 0' && lineEl('muse').children.length === 1 && same(stateOf(chip('muse')), ['is-unknown']), 'a line without a lead is the one span', [lineEl('muse').children.map((c) => [c.className, c.textContent])]);
  ok(IDS.every((id) => lineOf(id) === model.last.lines[id]), 'read together the two spans are the model\'s line', IDS.map(lineOf));
  ok(drawings('ck-line').every((e) => e.children.every((c) => c.tagName === 'SPAN' && c.children.length === 0)) && $$('[data-ck]').every((c) => c.children.filter((x) => x.tagName === 'B').length === 1 && c.children.length === 3), 'the ck-line drawing writes text in its own element and nothing else in the chip');
  SN.state.muse = 'loading'; bus.changed();
  ok(lineOf('muse') === '—' && lineEl('muse').children.length === 0 && same(stateOf(chip('muse')), ['is-unknown']), 'after the release, an agent with no line (its document loading again) shows the dash and reads unknown', [lineOf('muse'), stateOf(chip('muse'))]);
  SN.state.muse = 'error'; bus.changed();
  { const real = modelStandIn.derive; modelStandIn.derive = (...a) => { const o = real(...a); delete o.lead; delete o.brief; return o; }; bus.changed();
    ok(lineOf('desk') === '12:15 · needs 113' && lineEl('desk').children.length === 1 && whatOf('desk') === '12:15 · needs 113', 'a model without lead and brief still fills the chip: the whole line is the one span', lineEl('desk').children.map((c) => [c.className, c.textContent]));
    modelStandIn.derive = real; bus.changed(); }

  // ---- the facts, from the page's modules ----
  ok(same(facts().desk, { src: 'ok', at: '2026-11-24T12:15:58Z', status: 'ok', waiting: 113 }), 'desk: the Hub\'s state, its last run\'s time and status, and the count waiting', facts().desk);
  H.acted = { a: { action: 'done' }, c: { action: 'done' } }; bus.changed();
  ok(facts().desk.waiting === 112 && whatOf('desk') === 'needs 112', 'desk: an item William has just handled on this tab leaves the count at once, as it does on the "Needs you" tile (a prepared one does not count twice)', facts().desk);
  H.acted = {}; H.doc = { at: '2026-11-24T12:16:30Z', counts: { waiting: 4 }, lastRun: 'yesterday', top: 'none' }; bus.changed();
  ok(TYPE.thrown.length === 0 && same(facts().desk, { src: 'ok', at: '2026-11-24T12:16:30Z', status: '', waiting: 4 }), 'desk: without a last run the document\'s own time stands in; nothing throws', [facts().desk, TYPE.thrown.map(String)]);
  const deskWith = (counts) => { H.doc = { lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, counts }; bus.changed(); return [facts().desk.src, facts().desk.waiting, whatOf('desk')]; };
  ok(same(deskWith({ waiting: 'many' }), ['error', 0, 'unknown 0']) && same(deskWith({ critical: 1 }), ['error', 0, 'unknown 0']) && same(deskWith(null), ['error', 0, 'unknown 0']) && same(deskWith({ waiting: NaN }), ['error', 0, 'unknown 0']),
    'desk: a summary with no numeric count waiting is no data (error), not zero and "all clear"', [deskWith({ waiting: 'many' }), deskWith(null)]);
  ok(same(deskWith({ waiting: 0 }), ['ok', 0, 'idle 0']) && same(deskWith({ waiting: -3 }), ['ok', 0, 'idle 0']) && same(deskWith({ waiting: 2.9 }), ['ok', 2, 'needs 2']), 'desk: zero is a count (all clear); a count is a whole number, never below zero', [deskWith({ waiting: 0 }), deskWith({ waiting: 2.9 })]);
  H.state = 'missing'; H.doc = null; bus.changed();
  ok(same(facts().desk, { src: 'missing', at: null, status: '', waiting: 0 }) && same(stateOf(chip('desk')), ['is-unknown']), 'desk: no document: missing, and the chip\'s class changes with it (one class, never two)', [facts().desk, stateOf(chip('desk'))]);
  H.state = 'ok'; H.doc = { lastRun: { at: '2026-11-24T12:15:58Z', status: 'failed' }, counts: { waiting: 4 } }; bus.changed();
  ok(facts().desk.status === 'failed' && same(stateOf(chip('desk')), ['is-error']), 'desk: a failed run reaches the model as failed', facts().desk);
  H.doc = { lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, counts: { waiting: 113 }, top: [] }; bus.changed();

  ok(same(facts().decide, { src: 'ok', at: '2026-11-24T06:44:12Z', status: '', waiting: 17, parts: [{ n: 10, word: 'decisions' }, { n: 7, word: 'for Leo' }] }), 'decide: both documents; the EARLIER of their two times (one the task did not rewrite must not hide); decisions and Leo items together, with the parts', facts().decide);
  LN.docs.leo.at = '2026-11-23T06:44:50Z'; bus.changed();
  ok(facts().decide.at === '2026-11-23T06:44:50Z', 'decide: For Leo left from yesterday while Decide was rewritten today: the time is yesterday\'s', facts().decide.at);
  LN.docs.leo.at = 'soon'; bus.changed();
  const noTime = facts().decide.at; LN.docs.leo.at = '2026-11-24T06:45:40'; bus.changed();
  ok(noTime === null && facts().decide.at === null, 'decide: with both documents there, one whose time is no time (or names no zone) leaves no time at all', [noTime, facts().decide.at]);
  LN.docs.leo.at = '2026-11-24T07:45:40+01:00'; bus.changed();
  ok(facts().decide.at === '2026-11-24T06:44:12Z', 'decide: times are compared as instants, whatever zone they are written in', facts().decide.at);
  const leoDoc = LN.docs.leo; LN.docs.leo = null; LN.state.leo = 'missing'; bus.changed();
  ok(facts().decide.at === '2026-11-24T06:44:12Z' && facts().decide.src === 'ok' && facts().decide.waiting === 10, 'decide: with one document there and the other never written, the task has run: its time, counting what is there', facts().decide);
  LN.docs.leo = leoDoc; LN.docs.leo.at = '2026-11-24T06:45:40Z'; LN.state.leo = 'ok';
  LN.answered = { d0: { answer: 'yes' }, d1: { answer: 'no' } }; LN.leoActed = { l0: { action: 'done' } }; bus.changed();
  ok(facts().decide.waiting === 14 && same(facts().decide.parts, [{ n: 8, word: 'decisions' }, { n: 6, word: 'for Leo' }]), 'decide: what William has answered or handled no longer waits', facts().decide);
  LN.answered = Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['d' + i, { answer: 'yes' }])); bus.changed();
  ok(same(facts().decide.parts[0], { n: 1, word: 'decision' }), 'decide: one decision is "1 decision"', facts().decide.parts);
  LN.answered = {}; LN.leoActed = {};
  const srcOf = (a, b) => { LN.state = { decisions: a, leo: b }; bus.changed(); return facts().decide.src; };
  ok(srcOf('ok', 'loading') === 'loading' && srcOf('loading', 'missing') === 'loading' && srcOf('error', 'ok') === 'error' && srcOf('ok', 'nodb') === 'nodb' && srcOf('error', 'nodb') === 'error' && srcOf('missing', 'missing') === 'missing' && srcOf('ok', 'ok') === 'ok',
    'decide: the worse of its two documents decides (can\'t be read, then still loading)');
  ok(same(facts().instinct, { src: 'ok', at: '2026-11-24T07:30:00Z', status: '', waiting: 2 }) && same(facts().muse, { src: 'error', at: null, status: '', waiting: 0 }), 'instinct and muse: their state, their time, and the items William has not reacted to', [facts().instinct, facts().muse]);

  // ---- the departments' agents: one document each, under the agent's own id, read by OS.sense ----
  ok(DEPT_IDS.every((id) => same(facts()[id], { src: 'missing', at: null, status: '', waiting: 0 })), 'a department agent whose document the page does not read is missing: no time, nothing waiting', DEPT_IDS.map((id) => facts()[id]));
  {
    const acted = SN.acted, DOC = { at: '2026-11-23T05:50:40Z', status: 'ok', trial: true, run: 'ask', scope: 'All EMEA', items: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] };
    const sweeperWith = (state, doc) => { SN.state.sweeper = state; SN.docs.sweeper = doc; bus.changed(); return facts().sweeper; };
    SN.acted = { ...acted, s2: { action: 'notuseful' } };
    ok(same(sweeperWith('ok', DOC), { src: 'ok', at: '2026-11-23T05:50:40Z', status: 'ok', waiting: 2, trial: true }), 'sweeper: its document\'s state, time and status, the items William has not reacted to, and that it is on trial', facts().sweeper);
    ok(same(['error', 'failed', 'partial', 'ok', undefined, 7].map((status) => sweeperWith('ok', { ...DOC, status }).status), ['failed', 'failed', 'partial', 'ok', '', '']), 'sweeper: a run that ended in an error is a failed one to the model; partial and ok are passed on; no status is none');
    ok(same([true, false, 'true', 1, undefined].map((trial) => sweeperWith('ok', { ...DOC, trial }).trial), [true, false, false, false, false]), 'sweeper: only trial: true is a trial');
    ok(same(sweeperWith('ok', { at: '2026-11-23T05:50:40Z', status: 'error' }), { src: 'ok', at: '2026-11-23T05:50:40Z', status: 'failed', waiting: 0, trial: false }), 'sweeper: a document without items (a run that failed) is still a result');
    ok(same([{ 0: { id: 's1' }, 1: { id: 's3' } }, 'two things', null, undefined, 7].map((list) => sweeperWith('ok', { ...DOC, items: list })), Array(5).fill({ src: 'error', at: '2026-11-23T05:50:40Z', status: 'ok', waiting: 0, trial: true }))
      && same(sweeperWith('ok', { at: '2026-11-23T05:50:40Z' }), { src: 'error', at: '2026-11-23T05:50:40Z', status: '', waiting: 0, trial: false }) && sweeperWith('ok', { ...DOC, status: 'partial', items: 'none' }).src === 'error' && sweeperWith('ok', null).src === 'error',
      'sweeper: a result that lists no items (the field is left out, or is not a list) is no data (error), not zero and "all clear", as a summary without a count is for Desk', sweeperWith('ok', { ...DOC, items: 'two things' }));
    ok(same(sweeperWith('ok', { ...DOC, items: [] }), { src: 'ok', at: '2026-11-23T05:50:40Z', status: 'ok', waiting: 0, trial: true }) && same(['error', 'failed'].map((status) => { const f = sweeperWith('ok', { ...DOC, status, items: 'none' }); return [f.src, f.status]; }), [['ok', 'failed'], ['ok', 'failed']]),
      'sweeper: an empty list is a result with nothing waiting; and only a run that failed may list nothing: it still reads as failed', sweeperWith('ok', { ...DOC, items: [] }));
    // a list of which the reader keeps nothing (the real reader leaves out an item whose id is empty: here it is told to keep none)
    { const keeps = osStandIn.sense.items; osStandIn.sense.items = (k) => (k === 'sweeper' ? [] : keeps(k));
      const none = sweeperWith('ok', DOC), empty = sweeperWith('ok', { ...DOC, items: [] }), failedRun = sweeperWith('ok', { ...DOC, status: 'error' });
      osStandIn.sense.items = keeps;
      ok(same(none, { src: 'error', at: '2026-11-23T05:50:40Z', status: 'ok', waiting: 0, trial: true }) && same(empty, { src: 'ok', at: '2026-11-23T05:50:40Z', status: 'ok', waiting: 0, trial: true }) && same([failedRun.src, failedRun.status], ['ok', 'failed']) && same(sweeperWith('ok', DOC), { src: 'ok', at: '2026-11-23T05:50:40Z', status: 'ok', waiting: 2, trial: true }),
        'sweeper: a list of which the reader keeps no item (not one has an id) is no data (error) too, not zero and "all clear"; an empty list stays a result, a run that failed stays failed, and a list the reader keeps items of counts them', none); }
    ok(same(['loading', 'nodb', 'error', 'missing'].map((s) => sweeperWith(s, null)), ['loading', 'nodb', 'error', 'missing'].map((src) => ({ src, at: null, status: '', waiting: 0, trial: false }))), 'sweeper: loading, no database, an error and a document never written are passed on as they are');
    const state = osStandIn.sense.state; osStandIn.sense.state = (k) => { if (k === 'sweeper') throw new Error('no reader'); return state(k); }; bus.changed();
    ok(same(facts().sweeper, { src: 'error', at: null, status: '', waiting: 0 }) && same(facts().instinct, { src: 'ok', at: '2026-11-24T07:30:00Z', status: '', waiting: 2 }) && TYPE.thrown.length === 0, 'sweeper: a reader that throws is no data for that agent only', facts().sweeper);
    osStandIn.sense.state = state; delete SN.state.sweeper; delete SN.docs.sweeper; SN.acted = acted; bus.changed();
  }

  // ---- review and pulse: the wiring's own two subscriptions ----
  ok(same(facts().review, { src: 'ok', at: '2026-11-23T06:46:19Z', status: '', waiting: 0 }) && whatOf('review') === 'idle 0', 'review: from hub/weekly, its time; posted to Slack, so no status', facts().review);
  push('hub/weekly', { at: '2026-11-23T06:46:19Z', week: '2026-11-23', slack: null, error: 'channel_not_found' });
  ok(same(facts().review, { src: 'ok', at: '2026-11-23T06:46:19Z', status: 'failed', waiting: 0 }) && same(stateOf(chip('review')), ['is-error']), 'review: written with slack: null (the post failed): failed, not "posted"', facts().review);
  push('hub/weekly', { at: '2026-11-23T06:46:19Z', slack: { channel: 'D0AAAAAAAA' } });
  ok(facts().review.status === 'failed', 'review: a slack entry without a message time is not a post either', facts().review);
  push('hub/weekly', undefined);
  ok(same(facts().review, { src: 'missing', at: null, status: '', waiting: 0 }), 'review: no document yet is missing', facts().review);
  fail('hub/weekly');
  ok(facts().review.src === 'error', 'review: a subscription error is error', facts().review);
  push('hub/weekly', { at: '2026-11-23T06:46:19Z', slack: { ts: '1.2' } });
  ok(facts().pulse === null, 'pulse: none before hub/pulse answers', facts().pulse);
  push('hub/pulse', { agents: { desk: { state: 'running', startedAt: '2026-11-24T12:45:00Z', finishedAt: null, step: 'Reading Slack' } }, at: '2026-11-24T12:45:00Z' });
  ok(same(facts().pulse, { desk: { state: 'running', startedAt: '2026-11-24T12:45:00Z', finishedAt: null, step: 'Reading Slack' } }) && same(stateOf(chip('desk')), ['is-working']) && scene().crew[0].state === 'working', 'pulse: the agents field of hub/pulse reaches the model, and the scene', facts().pulse);
  push('hub/pulse', { agents: 'nobody' });
  ok(facts().pulse === null, 'pulse: a document without an agents object is no pulse', facts().pulse);
  push('hub/pulse', { agents: { desk: { state: 'running' } } }); fail('hub/pulse');
  ok(facts().pulse === null, 'pulse: an error is no pulse', facts().pulse);
  push('hub/pulse', undefined);
  ok(facts().pulse === null && same(stateOf(chip('desk')), ['is-needs']), 'pulse: the document may not exist', facts().pulse);

  // ---- the doors: another room on the same canvas ----
  {
    const tipEl = st.children.find((x) => x.tagName !== 'CANVAS'), described = () => $$('[data-ck]').filter((x) => x.getAttribute('aria-describedby') !== null).map((x) => x.dataset.ck);
    // a closed room's door follows its documents: Sweeper has run (on trial), with one thing for William
    SN.state.sweeper = 'ok'; SN.docs.sweeper = { at: '2026-11-23T05:50:40Z', status: 'ok', trial: true, items: [{ id: 's1' }] }; bus.changed();
    ok(same(pipsOf('hygiene'), ['is-needs', 'is-unknown']) && countOf('hygiene') === '1' && saidBy(door('hygiene')) === 'Data Hygiene, 2 agents, 1 waiting on you' && same(openRoom(), ['mine', 'mine', '']) && lineOf('sweeper') === '—',
      'a closed room\'s door follows its agents: Sweeper\'s dot and the room\'s count are right before the door is ever opened (its chips, under hidden, are not drawn)', [pipsOf('hygiene'), countOf('hygiene'), saidBy(door('hygiene'))]);
    // a chip's line is its own agent's wherever the chip is on show (a person may move one, or unhide a strip): it is
    // derived for the agent's room, not for the room that is open
    strip('hygiene').hidden = false; DEPT.hygiene.forEach((id) => TYPE.one(lineEl(id)));
    ok(lineOf('sweeper') === '05:50 · needs 1' && same(stateOf(chip('sweeper')), ['is-needs']) && lineOf('accounts') === 'unknown 0' && same(openRoom().slice(0, 1), ['mine']) && same(s1.crew.map((a) => a.id), IDS),
      'a chip line is derived for its own agent\'s room, not for the room that is open: a department\'s chip on show beside his five reads its own line', DEPT.hygiene.map(lineOf));
    strip('hygiene').hidden = true;
    s1.anchors.desk = { x: 300, y: 100 }; s1.opts.onHover('desk'); chip('desk').fire('mouseenter');
    const n = model.calls.length, c = s1.crews.length, deskLine = lineOf('desk'); s1.focus.length = 0;
    door('hygiene').click();
    ok(same(openRoom(), ['hygiene', 'hygiene', 'hygiene']) && same(ROOM_IDS.map((r) => door(r).getAttribute('aria-pressed')), ['false', 'true', 'false', 'false']), 'a click on a door opens its room: that door is the pressed one, that room\'s strip and lane are the ones not hidden', openRoom());
    ok(scenes.length === 1 && s1.crews.length === c + 1 && same(s1.crew.map((a) => a.id), DEPT.hygiene) && s1.log[s1.log.length - 1] === 'setCrew' && s1.log.filter((l) => /^(resize|start)/.test(l)).length === 2 && st.children.length === 2,
      '... the same scene on the same canvas is handed that room\'s crew: no new scene, no new size, not started again', [scenes.length, s1.crew.map((a) => a.id), s1.log.slice(-3)]);
    ok(tipEl.hidden === true && described().length === 0 && s1.focus[s1.focus.length - 1] === null, '... the tooltip that was showing goes, and no robot stays lit', [tipEl.hidden, described(), s1.focus]);
    ok(model.calls.length === n + 7 && same(model.calls.slice(n).map((x) => x.room), ['hygiene', 'hygiene', 'hygiene', 'mine', 'hygiene', 'arr', 'exec']), '... and the drawings run again at once: the stage and the two chip lines of that room, and the four doors', model.calls.slice(n).map((x) => x.room));
    ok(lineOf('sweeper') === '05:50 · needs 1' && same(stateOf(chip('sweeper')), ['is-needs']) && lineOf('accounts') === 'unknown 0' && same(stateOf(chip('accounts')), ['is-unknown']) && lineOf('desk') === deskLine, 'the chips of the open room get their lines and states; his own, now hidden, keep what they had', DEPT.hygiene.map(lineOf));
    // pointing at a department's robot: its tooltip, with the role sentence from the HTML
    s1.anchors.sweeper = { x: 300, y: 100 }; s1.opts.onHover('sweeper');
    ok(tipEl.hidden === false && same(tipEl.children.flatMap((x) => (x.children.length ? x.children : [x]).map((y) => y.textContent)), ['Sweeper', 'Counts open deals that break your hygiene rules, by team.', 'Now: needs', 'Last result 2026-11-23T05:50:40Z', 'Next run soon']) && same(described(), ['sweeper']) && s1.canvas.style.cursor === '',
      'a department\'s robot has its tooltip too: name, role sentence, the model\'s lines; with no card in the lane its chip leads nowhere (plain cursor)', tipEl.textContent);
    s1.opts.onHover(null);
    // an agent whose task has stopped (the model marks its tooltip entry): the sentence on what it does is left out,
    // since it reads as if the agent still ran
    { const real = modelStandIn.derive, words = () => tipEl.children.flatMap((x) => (x.children.length ? x.children : [x]).map((y) => y.textContent));
      modelStandIn.derive = (...a) => { const o = real(...a); if (o.tips.sweeper) o.tips.sweeper.stopped = true; if (o.tips.accounts) o.tips.accounts.stopped = 'true'; return o; }; bus.changed();
      s1.opts.onHover('sweeper'); const stopped = words(); s1.opts.onHover('accounts'); const notTrue = words();
      modelStandIn.derive = real; bus.changed(); s1.opts.onHover('sweeper'); const running = words(); s1.opts.onHover(null);
      ok(same(stopped, ['Sweeper', 'Now: needs', 'Last result 2026-11-23T05:50:40Z', 'Next run soon']) && same(notTrue, ['Accounts', 'Finds accounts and records without the right owner.', 'Now: unknown', 'Next run soon']) && running[1] === 'Counts open deals that break your hygiene rules, by team.',
        'an agent the model marks as stopped: its tooltip leaves out the role sentence and keeps the rest; only the value true marks it, and when the mark is gone the sentence is back', [stopped, notTrue]); }
    // a press on a chip, or its robot: to the agent's first card in the lane when it has one, else its tooltip
    shell.length = 0; clicks.length = 0; scrolled.length = 0;
    const nowhere = s1.opts.onPick('sweeper'); flush();
    ok(nowhere === false && same(clicks.map((x) => x.dataset.ck), ['sweeper']) && same(shell, [null]) && scrolled.length === 0 && tipEl.hidden === false && tipEl.children[0].textContent === 'Sweeper' && !chip('sweeper').classList.contains('ck-leads'),
      'an agent with no card in the lane: a press on its chip, or its robot, opens nothing and shows its tooltip, as Review\'s does', [nowhere, shell, scrolled.length]);
    s1.opts.onHover(null);
    // (this page has no lane drawing: the test puts the cards in the lane, and has the reader say whose they are)
    const card = new El('li'), other = new El('li'); card.dataset.ckOf = 'sweeper'; other.dataset.ckOf = 'sweeper'; laneOf('hygiene').append(card, other); SN.cards = { sweeper: [{ id: 's1' }, { id: 's0' }] }; bus.changed();
    ok(chip('sweeper').classList.contains('ck-leads') && !chip('accounts').classList.contains('ck-leads') && same(stateOf(chip('sweeper')), ['is-needs']), 'an agent with a card in the lane: its chip is marked as leading somewhere (beside its one state class)', chip('sweeper').className);
    s1.opts.onHover('sweeper'); const pointer = s1.canvas.style.cursor; shell.length = 0; clicks.length = 0;
    const led = s1.opts.onPick('sweeper'), before = scrolled.length; flush();
    ok(pointer === 'pointer' && led === true && before === 0 && scrolled.length === 1 && scrolled[0].el === card && scrolled[0].o.block === 'start' && card.getAttribute('tabindex') === '-1' && document.activeElement === card && tipEl.hidden === true && same(shell, [null]),
      '... and a press on it, or on its robot, scrolls to its first card in the lane and moves focus there; no tab is asked for', [pointer, led, scrolled.map((x) => x.o), shell]);
    laneOf('hygiene').hidden = true; scrolled.length = 0; const hiddenLane = s1.opts.onPick('sweeper'); flush(); laneOf('hygiene').hidden = false;
    ok(hiddenLane === false && scrolled.length === 0, 'a card under a hidden lane is no card', [hiddenLane, scrolled.length]);
    // the cards of two agents in the lane: each chip goes to its own agent's first card
    const mate = new El('li'); mate.dataset.ckOf = 'accounts'; laneOf('hygiene').append(mate); SN.cards.accounts = [{ id: 'a1' }]; bus.changed();
    scrolled.length = 0; const own = s1.opts.onPick('accounts'); flush();
    ok(own === true && chip('accounts').classList.contains('ck-leads') && scrolled.length === 1 && scrolled[0].el === mate && document.activeElement === mate && laneOf('hygiene').children[0] === card,
      'with the cards of two agents in the lane, a press goes to the first card of its own agent, not to the first card in the lane', [own, scrolled.map((x) => x.el.dataset.ckOf)]);
    mate.remove();
    s1.opts.onHover(null); card.remove(); other.remove(); SN.cards = {}; document.activeElement = null; bus.changed();
    ok(!chip('sweeper').classList.contains('ck-leads'), 'when the card has gone the mark goes with it');
    // The mark is the reader's word (OS.sense.cards, the lane's own rule), not the lane as it stands: when Today comes
    // back from another tab the type draws the chips' lines before the lane, which then still holds the cards it had
    // when the tab was left.
    { const leads = (id) => chip(id).classList.contains('ck-leads');
      SN.cards = { sweeper: [{ id: 's1' }] }; bus.changed();
      const ahead = [leads('sweeper'), leads('accounts'), laneOf('hygiene').children.length]; // the reader has a card of Sweeper's; the lane is not drawn yet
      const left = new El('li'); left.dataset.ckOf = 'sweeper'; laneOf('hygiene').append(left); SN.cards = {}; bus.changed();
      const behind = [leads('sweeper'), laneOf('hygiene').children.length]; // the reader has none any more; the lane still holds the one it had
      left.remove();
      ok(same(ahead, [true, false, 0]) && same(behind, [false, 1]), 'the mark follows the reader, not the lane as it stands: a chip drawn before its lane is marked for the cards the lane is about to hold, and is not marked for one the lane has not let go of yet', [ahead, behind]);
      // only a department's agent, and only while its room is the open one (its lane is then on show)
      SN.cards = { sweeper: [{ id: 's1' }], pacing: [{ id: 'p1' }], desk: [{ id: 'a' }], instinct: [{ id: 'i1' }] };
      strip('mine').hidden = false; strip('arr').hidden = false; bus.changed();
      const elsewhere = ['sweeper', 'pacing', 'desk', 'instinct'].map(leads);
      strip('mine').hidden = true; strip('arr').hidden = true;
      // a reader that has no word on cards (an older file, while a new version of the page is loading), one that
      // throws, and one whose word is not a list
      const kept = osStandIn.sense.cards; delete osStandIn.sense.cards; bus.changed(); const without = leads('sweeper');
      osStandIn.sense.cards = () => { throw new Error('no reader'); }; bus.changed(); const threw = leads('sweeper');
      osStandIn.sense.cards = () => 'many'; bus.changed(); const text = leads('sweeper');
      osStandIn.sense.cards = kept; bus.changed(); const again = leads('sweeper');
      SN.cards = {}; bus.changed();
      ok(same(elsewhere, [true, false, false, false]) && same([without, threw, text, again, leads('sweeper')], [false, false, false, true, false]) && TYPE.thrown.length === 0,
        'only a chip of the open department is marked: not one of another room that is on show, and never one of his five; a reader with no word on cards, one that throws, or one whose word is not a list marks nothing, and nothing is thrown', [elsewhere, without, threw, text, again]);
      // the mark needs the open room's lane on the page, not under hidden: a person may delete the lane or move it,
      // and then the reader's card can be led to nowhere
      SN.cards = { sweeper: [{ id: 's1' }] }; bus.changed(); const withLane = leads('sweeper');
      const gone = laneOf('hygiene'), parent = gone.parentNode, at = parent.childNodes.indexOf(gone);
      gone.remove(); bus.changed(); const noLane = leads('sweeper');
      scrolled.length = 0; chip('sweeper').click(); flush(); const pressed = [scrolled.length, tipEl.hidden]; s1.opts.onHover(null);
      laneOf('arr').hidden = false; bus.changed(); const otherLane = leads('sweeper'); laneOf('arr').hidden = true; // another room's lane on show does not stand in for it
      parent.childNodes.splice(at, 0, gone); gone.parentNode = parent; bus.changed(); const back = leads('sweeper');
      gone.hidden = true; bus.changed(); const underHidden = leads('sweeper'); gone.hidden = false;
      SN.cards = {}; bus.changed();
      ok(same([withLane, noLane, otherLane, back, underHidden, leads('sweeper')], [true, false, false, true, false, false]) && same(pressed, [0, false]) && laneOf('hygiene') === gone && same(openRoom(), ['hygiene', 'hygiene', 'hygiene']) && TYPE.thrown.length === 0,
        'the mark needs the open room\'s lane on the page: with the lane deleted (a person may delete any element) or under hidden the chip is not marked, though the reader has a card, and a press on it shows its tooltip; another room\'s lane does not stand in for it; with the lane back, so is the mark', [withLane, noLane, otherLane, back, underHidden, pressed]); }
    // the timer, and the open door itself, in a department's room
    const n2 = model.calls.length, c2 = s1.crews.length;
    tickNow();
    ok(model.calls.length === n2 + 7 && s1.crews.length === c2 + 1 && same(s1.crew.map((a) => a.id), DEPT.hygiene), 'the 30-second timer redraws the open room: the scene keeps that room\'s crew', [model.calls.length - n2, s1.crew.map((a) => a.id)]);
    door('hygiene').click();
    ok(model.calls.length === n2 + 7 && s1.crews.length === c2 + 1, 'a click on the door that is open already does nothing');
    door('arr').click();
    ok(same(openRoom(), ['arr', 'arr', 'arr']) && same(s1.crew.map((a) => a.id), DEPT.arr) && same(DEPT.arr.map(lineOf), ['unknown 0', 'unknown 0', 'unknown 0']) && model.calls.length === n2 + 7 + 8, 'on to the next room: its three agents in the scene, its three chips drawn (the stage, three lines, four doors)', [openRoom(), model.calls.length - n2 - 7]);
    // a door the model has no room for (a person may add one): nothing happens
    const stray = door('exec'); stray.dataset.ckDoor = 'cellar'; stray.click(); stray.dataset.ckDoor = 'exec';
    ok(same(openRoom(), ['arr', 'arr', 'arr']) && TYPE.thrown.length === 0, 'a door for a room the model does not have opens nothing');
    // Today hidden while a door is pressed, and back
    { const today = st.closest('section'), c3 = s1.crews.length; today.hidden = true; door('exec').click(); const hiddenCrews = s1.crews.length; today.hidden = false; TYPE.all();
      ok(hiddenCrews === c3 && same(openRoom(), ['exec', 'exec', 'exec']) && same(s1.crew.map((a) => a.id), DEPT.exec) && TYPE.thrown.length === 0, 'a door pressed while Today is hidden still opens its room; the scene gets the crew when the tab is back', [hiddenCrews - c3, s1.crew.map((a) => a.id)]); }
    // back to his own room: everything as it was
    const n3 = model.calls.length;
    door('mine').click();
    ok(same(openRoom(), ['mine', 'mine', '']) && same(s1.crew.map((a) => a.id), IDS) && model.calls.length === n3 + 10 && lineOf('desk') === deskLine && scenes.length === 1, 'back through the first door: his five in the scene, their chips on show, no lane, on the same scene', [openRoom(), s1.crew.map((a) => a.id), model.calls.length - n3]);
    // in his own room no chip is marked as leading to cards, whatever the reader says: no lane is on show there
    SN.cards = { desk: [{ id: 'a' }], instinct: [{ id: 'i1' }], sweeper: [{ id: 's1' }] }; strip('hygiene').hidden = false; bus.changed();
    const inMine = ['desk', 'instinct', 'sweeper'].map((id) => chip(id).classList.contains('ck-leads'));
    strip('hygiene').hidden = true; SN.cards = {}; bus.changed();
    ok(same(inMine, [false, false, false]) && same(openRoom(), ['mine', 'mine', '']), 'with his own room open no chip is marked as leading to cards: not one of his five, and not a department\'s chip that is on show beside them', inMine);
    delete SN.state.sweeper; delete SN.docs.sweeper; bus.changed();
  }

  // ---- redraws: a burst of changes, the timer, and width ----
  {
    const n = model.calls.length, c = s1.crews.length;
    const doorsAre = () => ROOM_IDS.map((r) => saidBy(door(r)) + ' [' + pipsOf(r).join(' ') + (countOf(r) ? ' #' + countOf(r) : '') + ']'), settled = doorsAre(); // every door, as drawn before the burst
    bus.fire(); bus.fire(); live('hub/pulse').forEach((s) => s.next(snapOf('hub/pulse', undefined))); bus.fire();
    ok(model.calls.length === n && timeouts.size === 1 && [...timeouts.values()][0].ms === 150, 'a burst of changes (documents, then reactions to them) waits: nothing is redrawn yet, one short timeout is pending', [model.calls.length - n, [...timeouts.values()].map((t) => t.ms)]);
    // mid-burst the dashboard may call the drawings itself (a dataset loaded): they keep to the last settled facts
    SN.acted = { i1: { action: 'ack' }, i2: { action: 'ack' }, i3: { action: 'ack' } };
    TYPE.all();
    ok(model.calls.length === n && s1.crews.length === c + 1 && s1.crew[2].state === 'needs' && whatOf('instinct') === 'needs 2', 'a drawing called in the middle of a burst keeps to the facts as they were before it: no robot sets off on half the news', [model.calls.length - n, s1.crew[2]]);
    ok(same(doorsAre(), settled) && settled[0] === 'Your agents, 5 agents, 132 waiting on you [is-needs is-needs is-needs is-unknown is-idle #132]' && settled[1] === 'Data Hygiene, 2 agents, no data [is-unknown is-unknown]',
      '... and every door, drawn in the middle of a burst, keeps to what its own room last settled on: a department\'s door does not take his room\'s crew or count', doorsAre());
    flush();
    ok(model.calls.length === n + 10 && s1.crews.length === c + 2 && s1.crew[2].state === 'idle' && timeouts.size === 0, '... then the drawings run again once, on all of it: the stage, the five chip lines and the four doors', [model.calls.length - n, s1.crews.length - c, s1.crew[2]]);
    SN.acted = { i2: { action: 'ack' } }; bus.changed();
    const n2 = model.calls.length, c2 = s1.crews.length;
    bus.fire(); T += 1500; bus.fire();
    ok(model.calls.length === n2 + 10 && s1.crews.length === c2 + 1 && timeouts.size === 0, 'changes that never pause do not hold the picture for ever: after a second and a half it is drawn anyway', [model.calls.length - n2, timeouts.size]);
    const n3 = model.calls.length, c3 = s1.crews.length;
    advance(28500);
    ok(model.calls.length === n3 + 10 && s1.crews.length === c3 + 1 && [...timers.values()][0].every === 30000, 'thirty seconds after the script ran, the timer reruns the drawings: the stage, the chip lines and the doors', [model.calls.length - n3, s1.crews.length - c3, T]);
    ok(s1.log.filter((l) => /^resize/.test(l)).length === 1 && s1.log.filter((l) => l === 'start').length === 1, 'the same width is not resized again, and the scene is not started again', s1.log.filter((l) => /^(resize|start)/.test(l)));
    st._w = 400; TYPE.one(st);
    ok(same(s1.log.filter((l) => /^resize/.test(l)), ['resize 600', 'resize 400']), 'a new width of the stage resizes the scene', s1.log.filter((l) => /^resize/.test(l)));
    global.devicePixelRatio = 1; TYPE.one(st);
    ok(same(s1.log.filter((l) => /^resize/.test(l)), ['resize 600', 'resize 400', 'resize 400']), 'so does a new pixel ratio at the same width (the window moved to another screen)', s1.log.filter((l) => /^resize/.test(l)));
    global.devicePixelRatio = 2; st._w = 600; TYPE.one(st);
  }
  // a hidden tab: the type calls no drawing under hidden; when the tab comes back the width may have changed
  {
    const today = st.closest('section'), c = s1.crews.length, r = s1.log.filter((l) => /^resize/.test(l)).length;
    today.hidden = true; st._w = 0;
    bus.changed(); tickNow();
    ok(s1.crews.length === c && s1.log.filter((l) => /^resize/.test(l)).length === r && TYPE.thrown.length === 0, 'while Today is hidden nothing is handed to the scene and nothing throws');
    today.hidden = false; st._w = 888; TYPE.all();
    ok(s1.crews.length === c + 1 && s1.log[s1.log.length - 1] === 'resize 888' && scenes.length === 1, 'when Today comes back, update runs: the crew again and the new width, on the same scene', s1.log.slice(-2));
    st._w = 600; TYPE.one(st);
  }

  // ---- the tooltip ----
  {
    const texts = () => tip.children.flatMap((c) => (c.children.length ? c.children : [c]).map((x) => x.tagName + ' ' + x.textContent));
    const described = () => $$('[data-ck]').filter((c) => c.getAttribute('aria-describedby') !== null).map((c) => c.dataset.ck + ' by ' + c.getAttribute('aria-describedby'));
    s1.anchors.desk = { x: 300, y: 100 };
    s1.opts.onHover('desk');
    ok(tip.hidden === false && same(texts(), ['B Desk', 'SPAN Prepares replies and next steps from Slack, mail and meetings.', 'SPAN Now: needs', 'SPAN Last result 2026-11-24T12:15:58Z', 'SPAN Next run soon']), 'pointing at a robot shows its name, the role sentence from the HTML and the model\'s three lines', texts());
    ok(tip.style.left === '220px' && tip.style.top === '16px', 'the tooltip sits above the robot\'s head, centred on it', [tip.style.left, tip.style.top]);
    ok(same(described(), ['desk by ck-tip']), 'while it shows, that agent\'s chip (and no other) is described by the tooltip', described());
    ok(canvas.style.cursor === 'pointer', 'a robot whose chip leads somewhere shows the pointer cursor', canvas.style.cursor);
    s1.opts.onHover('review');
    ok(same(described(), ['review by ck-tip']) && canvas.style.cursor === '', 'on to another robot: the description moves with it; one whose chip leads nowhere keeps the plain cursor', [described(), canvas.style.cursor]);
    s1.opts.onHover(null);
    ok(tip.hidden === true && canvas.style.cursor === '' && described().length === 0, 'leaving the robot hides the tooltip and takes the description off the chip', described());
    const inside = (a) => { s1.anchors.desk = a; s1.opts.onHover('desk'); const x = parseFloat(tip.style.left), y = parseFloat(tip.style.top); return x >= 0 && y >= 0 && x + tip.offsetWidth <= st.clientWidth && y + tip.offsetHeight <= st.clientHeight ? [x, y] : null; };
    const spots = [{ x: 10, y: 100 }, { x: 595, y: 100 }, { x: 300, y: 30 }, { x: 300, y: 195 }, { x: -50, y: -50 }, { x: 9999, y: 9999 }, null, { x: NaN, y: 5 }].map(inside);
    ok(spots.every(Boolean) && same(spots[0], [4, 16]) && same(spots[1], [436, 16]) && same(spots[2], [220, 70]) && same(spots[6], [220, 126]), 'the tooltip is kept inside the stage: at the edges, under the robot when there is no room above, and for an agent that is not in the room', spots);
    tip._oh = 150;
    const tall = [{ x: 300, y: 100 }, { x: 300, y: 120 }, { x: 500, y: 80 }, { x: 300, y: 5 }].map(inside);
    tip._ow = 590; const wide = inside({ x: 300, y: 120 }); tip._oh = 400; const huge = (s1.opts.onHover('desk'), [tip.style.left, tip.style.top]);
    tip._oh = undefined; tip._ow = undefined;
    ok(tall.every(Boolean) && same(tall[0], [322, 46]) && same(tall[1], [322, 4]) && same(tall[2], [318, 46]) && same(tall[3], [220, 45]) && same(wide, [5, 4]) && same(huge, ['5px', '4px']),
      'with room neither above nor below, the tooltip goes to the far edge, beside the robot when that fits; one larger than the stage starts at its corner', [tall, wide, huge]);
    s1.anchors.desk = { x: 300, y: 100 }; s1.opts.onHover('desk');
    bus.changed();
    ok(tip.hidden === false && winOn.length === 0, 'nothing listens for a scroll: the tooltip is inside the stage and moves with it');
    press('a'); const stays = tip.hidden === false; press('Escape');
    ok(stays && tip.hidden === true && described().length === 0, 'Escape hides the tooltip; another key does not');
    bus.changed();
    ok(tip.hidden === true, '... and the next redraw leaves it hidden');
    s1.opts.onHover('desk'); H.doc = { lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, counts: { waiting: 0 } }; bus.changed();
    ok(tip.hidden === false && /Now: idle/.test(tip.textContent), 'a redraw while the tooltip shows brings its words up to date', tip.textContent);
    s1.opts.onHover(null);
    H.doc = { lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, counts: { waiting: 113 }, top: [] };
    // words from a document, and a renamed chip: text, never markup
    const b = chip('muse').children.find((x) => x.tagName === 'B'), was = b.textContent;
    b.textContent = '  <img src=x> Muse  ';
    push('hub/pulse', { agents: { muse: { state: 'running', startedAt: '2026-11-24T12:45:00Z', step: '<b>bold</b>' } } });
    SN.state.muse = 'ok'; SN.docs.muse = { at: '2026-11-24T07:30:00Z', items: [] }; bus.changed();
    s1.opts.onHover('muse');
    ok(mineCall().names.muse === '<img src=x> Muse' && tip.children[0].textContent === '<img src=x> Muse' && tip.querySelectorAll('img').length + tip.querySelectorAll('b').length === 1 && st.querySelectorAll('img').length === 0,
      'a renamed chip renames the robot and its tooltip; what looks like markup stays text', [mineCall().names.muse, texts()]);
    // the name is the chip's own words, wherever they sit: without the dot, without the drawn line
    const dot = chip('muse').children[0], line = lineEl('muse');
    const nameWith = (...kids) => { chip('muse').replaceChildren(dot, ...kids, line); bus.changed(); return mineCall().names.muse; };
    const strong = new El('strong'), em = new El('em'); em.textContent = 'Muse'; strong.append(em, ' Two');
    const plain = nameWith('  Muse  the\n second '), rebuilt = nameWith(strong), none = nameWith(), dotted = (dot.textContent = '•', nameWith('Muse'));
    ok(plain === 'Muse the second' && rebuilt === 'Muse Two' && none === undefined && dotted === 'Muse', 'the name survives the bold being taken off or rebuilt: it is the chip\'s text without its dot and its line; no words, no name (the model keeps its own)', [plain, rebuilt, none, dotted]);
    dot.textContent = ''; chip('muse').replaceChildren(dot, b, line); b.textContent = was; push('hub/pulse', undefined); s1.opts.onHover(null);
    s1.opts.onHover('nobody');
    ok(tip.hidden === true && TYPE.thrown.length === 0, 'an id the page does not know shows nothing');
    s1.opts.onHover(null);
  }

  // ---- a robot click is a click on its chip ----
  {
    shell.length = 0; clicks.length = 0; scrolled.length = 0;
    s1.opts.onHover('decide'); s1.opts.onPick('decide'); flush();
    ok(clicks.length === 1 && clicks[0] === chip('decide') && same(shell, ['decide']) && tip.hidden === true && scrolled.length === 0, 'a click on the Decide robot clicks the Decide chip, which the page\'s own handler takes to its tab; the tooltip goes; nothing scrolls', [clicks.length, shell]);
    // Decide stands for two tabs: nothing left to decide, something for Leo
    LN.answered = Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['d' + i, { answer: 'yes' }])); bus.changed();
    shell.length = 0; clicks.length = 0;
    s1.opts.onPick('decide');
    const first = shell.slice(); flush();
    ok(same(first, ['decide']) && same(shell, ['decide', 'leo']) && clicks.length === 2 && clicks[1].id === 'nav-leo', 'with no decision open and items for Leo, the press goes on to For Leo, just after the page\'s own handler opened Decide', [first, shell, clicks.map((c) => c.id || c.dataset.ck)]);
    LN.leoActed = Object.fromEntries(Array.from({ length: 7 }, (_, i) => ['l' + i, { action: 'done' }])); bus.changed();
    shell.length = 0; s1.opts.onPick('decide'); flush();
    ok(same(shell, ['decide']), 'with nothing for Leo either, it stays on Decide', shell);
    LN.answered = {}; LN.leoActed = {}; bus.changed();
    shell.length = 0; clicks.length = 0;
    s1.opts.onPick('desk');
    ok(same(shell, ['today']) && scrolled.length === 0, 'the Desk chip asks for Today first; the scroll waits for the page\'s handler', [shell, scrolled.length]);
    flush();
    const hubPane = document.getElementById('hub-today');
    ok(scrolled.length === 1 && scrolled[0].el === hubPane && scrolled[0].o.block === 'start' && /app-tabs-h/.test(hubPane.style.scrollMarginTop || ''), '... then its data-ck-go element scrolls into view, clear of the sticky tab strip', scrolled.map((x) => [x.el.id, x.o]));
    ok(hubPane.getAttribute('tabindex') === '-1' && document.activeElement === hubPane && hubPane._focusOpts && hubPane._focusOpts.preventScroll === true, '... and takes focus (tabindex="-1" first), so the keyboard goes on from there', [hubPane.getAttribute('tabindex'), document.activeElement && document.activeElement.id]);
    reducedMotion = true; s1.opts.onPick('instinct'); flush(); reducedMotion = false;
    ok(scrolled.length === 2 && scrolled[1].el.id === 'sense' && scrolled[1].o.behavior === 'auto' && scrolled[0].o.behavior === 'smooth', 'the scroll glides, unless the viewer asked for reduced motion', scrolled.map((x) => x.o.behavior));
    shell.length = 0; clicks.length = 0;
    s1.anchors.review = { x: 300, y: 100 }; s1.opts.onPick('review'); flush();
    ok(same(clicks.map((c) => c.dataset.ck), ['review']) && same(shell, [null]) && scrolled.length === 2 && tip.hidden === false && tip.children[0].textContent === 'Review', 'the Review chip opens nothing: a press on it, or on its robot, shows its tooltip', [shell, tip.hidden]);
    s1.opts.onHover(null);
    s1.opts.onPick('nobody'); s1.opts.onPick(null); flush();
    ok(clicks.length === 1 && TYPE.thrown.length === 0, 'an unknown id clicks nothing');
    const hid = hubPane.closest('section'); hid.hidden = true; s1.opts.onPick('desk'); flush(); hid.hidden = false;
    ok(scrolled.length === 2, 'nothing scrolls to an element under a hidden tab');
    // the answer to a pick: did it lead somewhere? (the scene ends a tap's highlight when it did)
    const led = ['decide', 'desk', 'review', 'nobody'].map((id) => { const a = s1.opts.onPick(id); flush(); return a; });
    s1.opts.onHover(null);
    ok(same(led, [true, true, false, false]), 'a pick answers whether it led somewhere: yes for a chip that opens a tab, no for one that only shows its tooltip, and no for nobody', led);
  }

  // ---- chips light up their robot and show its tooltip; the ? button opens the legend ----
  {
    document.activeElement = null; s1.focus.length = 0; s1.anchors.muse = { x: 300, y: 100 };
    chip('muse').fire('mouseenter');
    const over = [s1.focus.slice(), tip.hidden, tip.children[0].textContent, chip('muse').getAttribute('aria-describedby')];
    chip('muse').fire('mouseleave');
    ok(same(over, [['muse'], false, 'Muse', 'ck-tip']) && same(s1.focus, ['muse', null]) && tip.hidden === true && chip('muse').getAttribute('aria-describedby') === null, 'a pointer over a chip lights up its robot and shows its tooltip; leaving puts both away', [over, s1.focus, tip.hidden]);
    s1.focus.length = 0; chip('desk').focus();
    ok(same(s1.focus, ['desk']) && tip.hidden === true, 'focus on a chip calls setFocus(id); a click\'s focus alone shows no tooltip', s1.focus);
    chip('desk').blur();
    ok(s1.focus[s1.focus.length - 1] === null, 'blur calls setFocus(null)', s1.focus);
    chip('review')._focusVisible = true; chip('review').focus();
    ok(tip.hidden === false && tip.children[0].textContent === 'Review' && /Posts the Monday performance review/.test(tip.textContent) && chip('review').getAttribute('aria-describedby') === 'ck-tip', 'reached with the keyboard, a chip shows its robot\'s tooltip and is described by it', tip.textContent);
    s1.focus.length = 0; chip('muse').fire('mouseenter'); const mid = tip.children[0].textContent; chip('muse').fire('mouseleave');
    ok(mid === 'Muse' && same(s1.focus, ['muse', 'review']) && tip.hidden === false && tip.children[0].textContent === 'Review', 'the pointer passing over another chip borrows the tooltip and gives it back, with the highlight, to the chip the keyboard is on', [mid, s1.focus, tip.textContent]);
    chip('review').blur(); chip('review')._focusVisible = false;
    ok(tip.hidden === true && chip('review').getAttribute('aria-describedby') === null, '... and blur hides it');
    const help = $$('[data-ck-help]')[0], legend = document.getElementById(help.getAttribute('aria-controls'));
    help.click();
    const open = legend.hidden === false && help.getAttribute('aria-expanded') === 'true';
    help.click();
    ok(open && legend.hidden === true && help.getAttribute('aria-expanded') === 'false', 'the ? button shows the legend and says so in aria-expanded; a second click hides it');
    legend.attrs.delete('id'); help.click();
    ok(help.getAttribute('aria-expanded') === 'false' && legend.hidden === true && TYPE.thrown.length === 0, 'with its legend gone the ? button does not claim to have opened anything', help.getAttribute('aria-expanded'));
    legend.attrs.set('id', 'ck-legend');
  }

  // ---- the timer is the script's, not the picture's ----
  {
    s1.anchors.desk = { x: 300, y: 100 }; s1.opts.onHover('desk');   // a robot is pointed at when the stage leaves
    TYPE.leave(st);
    ok(s1.destroyed === 1 && timers.size === 1, 'unmount destroys the scene; the 30-second timer stays', [s1.destroyed, timers.size]);
    ok($$('[data-ck]').every((c) => c.getAttribute('aria-describedby') === null), '... and no chip is left described by the tooltip of a stage that has left', $$('[data-ck]').map((c) => c.getAttribute('aria-describedby')));
    bus.changed();
    ok(scenes.length === 2 && scene() !== s1 && timers.size === 1 && same(scene().log, ['setCrew', 'resize 600', 'start']) && st.children.filter((c) => c.tagName === 'CANVAS').length === 1 && scene().crew.length === 5, 'the next call mounts afresh: one canvas, one scene (started once, with the crew: nothing is held a second time), still one timer', [scenes.length, timers.size, scene().log]);
    ok(st.children.find((c) => c.tagName !== 'CANVAS').id === 'ck-tip-2', 'each tooltip has an id of its own', st.children.map((c) => c.id));
    model.fail = true; bus.changed(); model.fail = false;
    ok(TYPE.thrown.length === 10 && TYPE.thrown.every((e) => /the model threw/.test(e.message)) && scene().destroyed === 1 && timers.size === 1, 'a throw in the model is not swallowed (the stage, five chip lines, four doors): the dashboard hears it and unmounts, which destroys the scene; the timer goes on', [TYPE.thrown.length, scene().destroyed, timers.size]);
    TYPE.thrown.length = 0; H.doc.counts.waiting = 7;
    tickNow();
    ok(scenes.length === 3 && scene().destroyed === 0 && TYPE.thrown.length === 0 && whatOf('desk') === 'needs 7' && scene().crew[0].waiting === 7, '... and its next tick brings the picture back, with the chips', [scenes.length, whatOf('desk')]);
    // the stage taken out of the page (a person may delete it) and put back
    const parent = st.parentNode, at = parent.childNodes.indexOf(st), n = scenes.length;
    TYPE.leave(st); st.remove();
    H.doc.counts.waiting = 8; tickNow();
    ok(scenes.length === n && alive().length === 0 && whatOf('desk') === 'needs 8' && TYPE.thrown.length === 0, 'without the stage the chips keep time on their own', [scenes.length, whatOf('desk')]);
    chip('desk').fire('mouseenter'); chip('desk').fire('mouseleave'); chip('desk').focus(); chip('desk').blur(); press('Escape');
    ok(TYPE.thrown.length === 0, '... and pointing at a chip, focusing it or pressing Escape does not throw');
    parent.childNodes.splice(at, 0, st); st.parentNode = parent; st.replaceChildren();
    tickNow();
    ok(scenes.length === n + 1 && alive().length === 1 && scene().crew.length === 5 && st.children.length === 2, 'put back, the stage is drawn again within one tick', [scenes.length, alive().length]);
    H.doc.counts.waiting = 113; bus.changed();
  }

  // ---- no 2D context: the stage stays empty and nothing throws ----
  {
    const n = scenes.length;
    TYPE.leave(st); noInk = true; bus.changed();
    ok(scenes.length === n && st.childNodes.length === 0 && st.classList.contains('ck-off') && TYPE.thrown.length === 0, 'a canvas with no 2D context: no scene is made, the stage stays empty and is marked to fold away', [scenes.length - n, st.childNodes.length, st.className]);
    tickNow(); bus.changed(); st._w = 320; TYPE.one(st); st._w = 600;
    chip('desk').fire('mouseenter'); chip('desk').fire('mouseleave'); chip('review').click(); press('Escape'); flush();
    ok(scenes.length === n && st.childNodes.length === 0 && TYPE.thrown.length === 0 && whatOf('desk') === 'needs 113', 'update is a no-op there, the chips still follow the facts, and nothing throws', [scenes.length - n, TYPE.thrown.map(String)]);
    door('hygiene').click();
    ok(same(openRoom(), ['hygiene', 'hygiene', 'hygiene']) && lineOf('accounts') === 'unknown 0' && same(pipsOf('hygiene'), ['is-unknown', 'is-unknown']) && scenes.length === n && st.childNodes.length === 0 && TYPE.thrown.length === 0, '... and a door still opens its room there: its chips and the doors are drawn, no scene is made', [openRoom(), lineOf('accounts')]);
    door('mine').click();
    TYPE.leave(st); noInk = false; bus.changed();
    ok(scenes.length === n + 1 && st.children.length === 2 && !st.classList.contains('ck-off'), 'mounted again where a context is to be had, the picture is back', [scenes.length - n, st.className]);
  }

  // ---- a second run of the script, as the dashboard does when a file changes ----
  for (const again of ['unmount', 'keep', 'forget']) {
    TYPE.again = again;
    door('hygiene').click(); // a department's room is open when the script runs again
    const old = scene(), n = scenes.length, was = [...timers.keys()], help = $$('[data-ck-help]')[0], legend = document.getElementById(help.getAttribute('aria-controls'));
    bus.fire(); // a change is pending when the script runs again
    load('os-cockpit.js');
    ok(old.destroyed >= 1 && timers.size === 1 && !was.some((id) => timers.has(id)) && same([...timeouts.values()].map((t) => t.ms), [2500]) && live('hub/weekly').length + live('hub/pulse').length === 0 && bus.size() === 1,
      'second run (' + again + '): the earlier run\'s scene, timer, pending redraw, subscriptions and bus listener are gone; the new run has its own timer and hold', [old.destroyed, timers.size, [...timeouts.values()].map((t) => t.ms), live('hub/weekly').length, bus.size()]);
    ok(same(openRoom(), ['mine', 'mine', '']), 'second run (' + again + '): the page is back in his own room, whatever room the earlier run had open', openRoom());
    await tick(); await tick();
    TYPE.all();
    ok(scene().crew.length === 0 && lineOf('desk') === '—', 'second run (' + again + '): until hub/weekly answers again, the crew is held', [scene().crew.length, lineOf('desk')]);
    push('hub/weekly', { at: '2026-11-23T06:46:19Z', slack: { ts: '1.2' } });
    ok(timers.size === 1 && scenes.length === n + 1 && scene().destroyed === 0 && alive().length === 1 && scene().crew.length === 5, 'second run (' + again + '): one timer and one scene alive, with its crew', [timers.size, scenes.length - n, alive().length]);
    ok(live('hub/weekly').length === 1 && live('hub/pulse').length === 1, 'second run (' + again + '): one subscription to each document', [live('hub/weekly').length, live('hub/pulse').length]);
    ok(heardOnce() && bus.size() === 1, 'second run (' + again + '): still one listener of each kind', [docHeard('keydown'), winOn.length, chip('desk').heard('click')]);
    ok(stage().children.filter((c) => c.tagName === 'CANVAS').length === 1 && stage().children.length === 2 && same(stateOf(chip('desk')), ['is-needs']) && facts().review.src === 'ok', 'second run (' + again + '): one canvas in the stage, and the chips still follow the facts', stage().children.map((c) => c.tagName));
    help.click();
    ok(legend.hidden === false, 'second run (' + again + '): one click on ? still opens the legend (two listeners would close it again)');
    help.click();
    clicks.length = 0; scene().opts.onPick('decide'); flush();
    ok(clicks.length === 1, 'second run (' + again + '): a robot click is one chip click', clicks.length);
  }
  TYPE.again = 'unmount';
  // two runs before the database answers: the first must not subscribe after the second took over
  {
    let open; DB.gate = new Promise((r) => { open = r; });
    const subs = DB.subs.length;
    load('os-cockpit.js'); load('os-cockpit.js');
    open(); DB.gate = null; await tick(); await tick(); await tick(); flush();
    ok(DB.subs.length === subs + 2 && live('hub/weekly').length === 1 && live('hub/pulse').length === 1, 'two runs while the database is still answering leave one subscription to each document', [DB.subs.length - subs, live('hub/weekly').length, live('hub/pulse').length]);
    TYPE.all();
    ok(timers.size === 1 && alive().length === 1, '... and one timer and one scene');
  }
  // the first crew is held 2.5 seconds at most
  {
    SN.ready = false; // William's reactions to Instinct and Muse never answer
    load('os-cockpit.js'); await tick(); await tick();
    push('hub/weekly', { at: '2026-11-23T06:46:19Z', slack: { ts: '1.2' } }); TYPE.all(); bus.changed();
    const calls = model.calls.length;
    advance(2499);
    ok(scene().crew.length === 0 && lineOf('desk') === '—' && model.calls.length === calls, 'reactions that never answer: 2.499 seconds on, the crew is still held', [scene().crew.length, lineOf('desk')]);
    advance(1);
    ok(scene().crew.length === 5 && whatOf('desk') === 'needs 113' && timeouts.size === 0, '... and at 2.5 seconds it is shown with what is known', [scene().crew.length, lineOf('desk')]);
    // That is his own room. A department's room waits on, however long his reactions take: its lane shows no card
    // before them, so its door, its chips and its robots are not shown either (a count would stand over an empty lane)
    SN.state.sweeper = 'ok'; SN.docs.sweeper = { at: '2026-11-23T05:50:40Z', status: 'ok', trial: true, items: [{ id: 's1' }, { id: 's2' }] }; bus.changed();
    const doorNow = () => [pipsOf('hygiene').join(), countOf('hygiene'), saidBy(door('hygiene'))];
    const late = doorNow(), mineNow = [pipsOf('mine').every((p) => p !== ''), countOf('mine') !== ''];
    door('hygiene').click(); const inside = [scene().crew.length].concat(DEPT.hygiene.map(lineOf), DEPT.hygiene.map((id) => stateOf(chip(id)).length));
    SN.acted = { ...SN.acted, s2: { action: 'ack' } }; SN.ready = true; bus.changed(); // they answer: he had handled one of the two
    const then = doorNow().concat([scene().crew.map((a) => a.id).join(), lineOf('sweeper')]);
    door('mine').click();
    ok(same(late, [',', '', 'Data Hygiene, 2 agents']) && same(mineNow, [true, true]) && same(inside, [0, '—', '—', 0, 0]) && same(then, ['is-needs,is-unknown', '1', 'Data Hygiene, 2 agents, 1 waiting on you', 'sweeper,accounts', '05:50 · needs 1']),
      'past the 2.5 seconds a department\'s room still waits for his reactions (its lane shows no card before them): its door stays bare, its chips at their dash and its room empty, while his own room is shown; when they answer the door counts 1, never 2', [late, mineNow, inside, then]);
    delete SN.state.sweeper; delete SN.docs.sweeper; delete SN.acted.s2;
    SN.ready = true;
    const ready = osStandIn.sense.ready; delete osStandIn.sense.ready; LN.ready = false; H.state = 'loading';
    load('os-cockpit.js'); await tick(); await tick(); push('hub/weekly', { at: '2026-11-23T06:46:19Z', slack: { ts: '1.2' } }); TYPE.all();
    const stillHeld = scene().crew.length === 0; H.state = 'ok'; bus.changed(); const waits = scene().crew.length === 0; LN.ready = true; bus.fire();
    ok(stillHeld && waits && scene().crew.length === 5, 'a module that has no ready() is not waited for; a loading document and one that is not ready are', [stillHeld, waits, scene().crew.length]);
    ok(same(pipsOf('hygiene'), ['is-unknown', 'is-unknown']) && saidBy(door('hygiene')) === 'Data Hygiene, 2 agents, no data', '... and a reader that has no ready() does not keep a department\'s room waiting either: its door is drawn with the crew', [pipsOf('hygiene'), saidBy(door('hygiene'))]);
    osStandIn.sense.ready = ready;
    // a department agent's document holds the first crew too, whichever room is open: a door shows its room's count
    SN.state.sweeper = 'loading';
    load('os-cockpit.js'); await tick(); await tick(); push('hub/weekly', { at: '2026-11-23T06:46:19Z', slack: { ts: '1.2' } }); TYPE.all(); bus.changed();
    const deptHeld = scene().crew.length === 0 && lineOf('desk') === '—' && ROOM_IDS.every((r) => countOf(r) === '' && pipsOf(r).every((p) => p === ''));
    SN.state.sweeper = 'ok'; SN.docs.sweeper = { at: '2026-11-23T05:50:40Z', status: 'ok', trial: true, items: [{ id: 's1' }, { id: 's2' }] }; SN.acted = { ...SN.acted, s2: { action: 'ack' } }; bus.fire();
    ok(deptHeld && scene().crew.length === 5 && countOf('hygiene') === '1' && same(pipsOf('hygiene'), ['is-needs', 'is-unknown']), 'a department agent\'s document that has not answered holds the first crew as well; when it answers, its door opens on the right count at once (1, not 2)', [deptHeld, scene().crew.length, countOf('hygiene')]);
    delete SN.state.sweeper; delete SN.docs.sweeper; delete SN.acted.s2;
  }
  // ---- a model without rooms (an older file, while a new version of the page is loading): his five, as before ----
  {
    delete modelStandIn.ROOMS; load('os-cockpit.js'); await tick(); await tick();
    push('hub/weekly', { at: '2026-11-23T06:46:19Z', slack: { ts: '1.2' } }); TYPE.all();
    const before = model.calls.length; door('hygiene').click();
    ok(TYPE.thrown.length === 0 && scene().crew.length === 5 && whatOf('desk') === 'needs 113' && ROOM_IDS.every((r) => doorSlot(r).childNodes.length === 0) && same(openRoom(), ['mine', 'mine', '']) && model.calls.length === before && mineCall().args === 3,
      'a model without rooms: the five in the scene and on their chips as before; the doors stay bare and open nothing; nothing throws', [scene().crew.length, openRoom(), TYPE.thrown.map(String)]);
    modelStandIn.ROOMS = STAND_ROOMS;
  }
  // ---- rooms that are not whole are no rooms; and a room of one agent ----
  {
    modelStandIn.ROOMS = [STAND_ROOMS[0], { id: 'hygiene', name: 'hygiene' }]; load('os-cockpit.js'); await tick(); await tick();
    push('hub/weekly', { at: '2026-11-23T06:46:19Z', slack: { ts: '1.2' } }); TYPE.all();
    const before = model.calls.length; door('hygiene').click();
    ok(TYPE.thrown.length === 0 && scene().crew.length === 5 && whatOf('desk') === 'needs 113' && ROOM_IDS.every((r) => doorSlot(r).childNodes.length === 0) && same(openRoom(), ['mine', 'mine', '']) && model.calls.length === before && mineCall().args === 3,
      'a model with a room that is not whole (it lists no agents) is taken as a model without rooms: the five as before, the doors bare, nothing throws', [scene().crew.length, openRoom(), TYPE.thrown.map(String)]);
    const one = { id: 'exec', name: 'exec', agents: [{ id: 'rundown' }] };
    STAND_ROOMS.push(one); modelStandIn.ROOMS = STAND_ROOMS.slice(0, 3).concat([one]); load('os-cockpit.js'); await tick(); await tick();
    push('hub/weekly', { at: '2026-11-23T06:46:19Z', slack: { ts: '1.2' } }); TYPE.all();
    ok(TYPE.thrown.length === 0 && saidBy(door('exec')) === 'Executive, 1 agent, no data' && same(pipsOf('exec'), ['is-unknown']) && saidBy(door('arr')) === 'ARR, 3 agents, no data' && scene().crew.length === 5,
      'a room of one agent: its door has one dot and says "1 agent"', [saidBy(door('exec')), pipsOf('exec')]);
    STAND_ROOMS.pop(); modelStandIn.ROOMS = STAND_ROOMS;
    // a strip that names no room (the page as it was stored before the doors, or a person took the attribute off) is his own
    const first = strip('mine'); first.removeAttribute('data-ck-room'); load('os-cockpit.js'); await tick(); await tick();
    push('hub/weekly', { at: '2026-11-23T06:46:19Z', slack: { ts: '1.2' } }); TYPE.all();
    const atStart = !first.hidden; door('hygiene').click(); const inDept = first.hidden && !strip('hygiene').hidden; door('mine').click();
    ok(atStart && inDept && !first.hidden && strip('hygiene').hidden && whatOf('desk') === 'needs 113' && TYPE.thrown.length === 0, 'a strip that names no room is his own: on show in his room, hidden while a department is open, on show again on the way back', [atStart, inDept, first.hidden]);
    first.setAttribute('data-ck-room', 'mine');
  }

  // ---- no database ----
  for (const [what, c] of [['claude.use(\'db\') gives null', { use: async () => null }], ['there is no window.claude', undefined], ['claude.use throws', { use: async () => { throw new Error('no bridge'); } }]]) {
    global.claude = c; load('os-cockpit.js'); await tick(); await tick(); flush(); TYPE.all();
    ok(TYPE.thrown.length === 0 && facts().review.src === 'nodb' && facts().pulse === null && timers.size === 1 && scene().crew.length === 5, 'when ' + what + ': review reads nodb, no pulse, nothing is held, and the picture still draws', [facts().review, TYPE.thrown.map(String)]);
  }
  global.claude = claudeWithDb;
  // a page without the cockpit (a person may delete it): the script still runs
  {
    const ck = document.getElementById('cockpit'), parent = ck.parentNode, i = parent.childNodes.indexOf(ck);
    ck.remove();
    let threw = null; try { load('os-cockpit.js'); await tick(); TYPE.all(); bus.changed(); tickNow(); advance(2500); } catch (e) { threw = e; }
    ok(!threw && TYPE.thrown.length === 0 && alive().length === 0, 'with the cockpit block deleted from the page the script runs and does nothing', threw && threw.message);
    parent.childNodes.splice(i, 0, ck); ck.parentNode = parent;
  }
  ok(same([...unsupported], []), 'the wiring asks the document only for plain selectors', [...unsupported]);

  // ---- the real model in place of its stand-in, the page's modules still stand-ins: facts like the spec's example ----
  const real = realModel();
  if (real) {
    global.OSCrew = real;
    H.state = 'ok'; H.acted = {}; H.doc = { at: '2026-11-24T12:15:58Z', lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, counts: { waiting: 113, critical: 1, prepared: 103, doneToday: 14 }, top: [] };
    LN.state = { decisions: 'ok', leo: 'ok' }; LN.answered = {}; LN.leoActed = {};
    LN.docs = { decisions: { at: '2026-11-24T06:44:12Z', items: Array.from({ length: 10 }, (_, i) => ({ id: 'd' + i })) }, leo: { at: '2026-11-24T06:44:12Z', items: Array.from({ length: 7 }, (_, i) => ({ id: 'l' + i })) } };
    SN.state = { instinct: 'ok', muse: 'ok' }; SN.acted = {};
    SN.docs = { instinct: { at: '2026-11-24T07:30:00Z', items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }, { id: 'i4' }, { id: 'i5' }] }, muse: { at: '2026-11-24T07:30:00Z', items: [{ id: 'm1' }, { id: 'm2' }] } };
    T = 0; load('os-cockpit.js'); await tick(); await tick();
    push('hub/weekly', { at: '2026-11-23T06:46:19Z', week: '2026-11-23', slack: { channel: 'D0AAAAAAAA', ts: '1.2' } }); push('hub/pulse', undefined);
    TYPE.all();
    const got = scene().crew, lines = IDS.map(lineOf);
    ok(TYPE.thrown.length === 0 && same(got.map((a) => [a.id, a.name, a.look, a.hue, a.state, a.waiting]), [['desk', 'Desk', 'headset', 'teal', 'needs', 113], ['decide', 'Decide', 'gavel', 'amber', 'needs', 17], ['instinct', 'Instinct', 'antenna', 'rose', 'needs', 5], ['muse', 'Muse', 'bulb', 'violet', 'needs', 2], ['review', 'Review', 'clipboard', 'blue', 'idle', 0]]),
      'real model, stand-in page: the crew that reaches the scene is the spec\'s example (Desk 113, Decide 17, Instinct 5, Muse 2 wait; Review idle)', [got.map((a) => [a.id, a.state, a.waiting]), TYPE.thrown.map(String)]);
    ok(same(lines, ['13:15 · 113 for you', '07:44 · 10 decisions, 7 for Leo', '08:30 · 5 for you', '08:30 · 2 for you', 'Mon 07:46 · posted']), 'real model, stand-in page: the chips read 13:15 · 113 for you, 07:44 · 10 decisions, 7 for Leo … Mon 07:46 · posted', lines);
    ok(same(IDS.map(whenOf), ['13:15 · ', '07:44 · ', '08:30 · ', '08:30 · ', 'Mon 07:46 · ']) && same(IDS.map(whatOf), ['113 for you', '10 decisions, 7 for Leo', '5 for you', '2 for you', 'posted']), 'real model, stand-in page: a narrow page keeps what, without when', [IDS.map(whenOf), IDS.map(whatOf)]);
    ok(got.every((a) => a.step === '' && a.fresh === Date.parse(a.id === 'review' ? '2026-11-23T06:46:19Z' : a.id === 'desk' ? '2026-11-24T12:15:58Z' : a.id === 'decide' ? '2026-11-24T06:44:12Z' : '2026-11-24T07:30:00Z')), 'real model, stand-in page: each fresh time is the document\'s', got.map((a) => a.fresh));
    push('hub/weekly', { at: '2026-11-23T06:46:19Z', week: '2026-11-23', slack: null });
    ok(lineOf('review') === 'failed Mon 07:46' && same(stateOf(chip('review')), ['is-error']), 'real model, stand-in page: a review that was not posted reads "failed Mon 07:46"', lineOf('review'));
    // the departments with the real model: the first week, when only Sweeper has run (on trial)
    SN.state.sweeper = 'ok'; SN.docs.sweeper = { at: '2026-11-23T05:50:40Z', status: 'ok', trial: true, run: 'ask', scope: 'All EMEA', items: [{ id: 's1' }] };
    for (const id of ['accounts', 'forecast', 'renewals', 'prep']) SN.state[id] = 'missing';
    bus.changed();
    ok(same(ROOM_IDS.map(pipsOf), [['is-needs', 'is-needs', 'is-needs', 'is-needs', 'is-error'], ['is-needs', 'is-unknown'], ['is-unknown', 'is-unknown', 'is-unknown'], ['is-unknown', 'is-unknown']]) && same(ROOM_IDS.map(countOf), ['137', '1', '', '']) && same(ROOM_IDS.map((r) => saidBy(door(r))), ['Your agents, 5 agents, 137 waiting on you, 1 failed', 'Data Hygiene, 2 agents, 1 waiting on you', 'ARR, 3 agents, no data', 'Executive, 2 agents, no data']),
      'real model, stand-in page: the doors in the first week: his room\'s five dots and 137, and the review that failed is said; Data Hygiene with Sweeper\'s one thing and a hollow dot; ARR and Executive all hollow', [ROOM_IDS.map(pipsOf), ROOM_IDS.map(countOf), ROOM_IDS.map((r) => saidBy(door(r)))]);
    door('hygiene').click();
    ok(same(scene().crew.map((a) => [a.id, a.name, a.look, a.hue, a.state, a.waiting]), [['sweeper', 'Sweeper', 'plain', 'green', 'needs', 1], ['accounts', 'Accounts', 'headset', 'violet', 'unknown', 0]]) && same(DEPT.hygiene.map(lineOf), ['Mon 06:50 · trial · 1 for you', 'not run yet']) && same(DEPT.hygiene.map((id) => stateOf(chip(id))), [['is-needs'], ['is-unknown']]),
      'real model, stand-in page: Data Hygiene: Sweeper reads "Mon 06:50 · trial · 1 for you", Accounts is an empty chair that reads "not run yet"', [scene().crew.map((a) => [a.id, a.state]), DEPT.hygiene.map(lineOf)]);
    const tipNow = () => stage().children.find((x) => x.tagName !== 'CANVAS').children.flatMap((x) => (x.children.length ? x.children : [x]).map((y) => y.textContent));
    scene().opts.onHover('sweeper');
    ok(same(tipNow(), ['Sweeper', 'Counts open deals that break your hygiene rules, by team.', '1 waiting on you. Trial: nothing can be sent', 'Last result yesterday 06:50', 'Next run Fri 06:50']), 'real model, stand-in page: Sweeper\'s tooltip says what the trial means', tipNow());
    scene().opts.onHover('accounts');
    ok(same(tipNow(), ['Accounts', 'Finds accounts and records without the right owner.', 'Has not run yet']), 'real model, stand-in page: Accounts has not run yet: no last result, and no next run is promised', tipNow());
    door('arr').click(); scene().opts.onHover('pacing');
    ok(same(DEPT.arr.map(lineOf), ['not linked yet', 'not run yet', 'not run yet']) && same(tipNow(), ['Pacing', 'Posts the Q4 pacing each weekday morning, by itself.', 'Not linked to the cockpit yet']) && scene().crew.length === 3 && scene().crew.every((a) => a.state === 'unknown'),
      'real model, stand-in page: ARR: Pacing, which posts by itself, is "not linked yet" (it is not said to have not run, nor to run today): its tooltip is its role sentence and "Not linked to the cockpit yet"; Forecast and Renewals have not run; three empty chairs', [DEPT.arr.map(lineOf), tipNow()]);
    scene().opts.onHover(null);
    // an agent whose document does not exist is never due or late: a week on, nothing has changed but the clock
    T = 7 * 864e5; tickNow();
    ok(same(DEPT.arr.map(lineOf), ['not linked yet', 'not run yet', 'not run yet']) && same(pipsOf('arr'), ['is-unknown', 'is-unknown', 'is-unknown']) && same(pipsOf('exec'), ['is-unknown', 'is-unknown']) && same(pipsOf('hygiene'), ['is-late', 'is-unknown'])
      && same(['hygiene', 'arr', 'exec'].map((r) => saidBy(door(r))), ['Data Hygiene, 2 agents, 1 waiting on you, 1 with no result yet', 'ARR, 3 agents, no data', 'Executive, 2 agents, no data']),
      'real model, stand-in page: a week on, no schedule has spoken for an agent with no document; Sweeper, whose document exists, has no result for its runs since (amber on its door, and the door says so)', [DEPT.arr.map(lineOf), pipsOf('hygiene'), saidBy(door('hygiene'))]);
    // Pacing's task stops with the year: from 1 January nothing says that it still runs (the open room is ARR)
    T = Date.parse('2026-12-31T22:59:00Z') - NOW; tickNow(); scene().opts.onHover('pacing'); const eve = tipNow();
    T = Date.parse('2026-12-31T23:00:00Z') - NOW; tickNow(); scene().opts.onHover('pacing');
    ok(same([eve, tipNow()], [['Pacing', 'Posts the Q4 pacing each weekday morning, by itself.', 'Not linked to the cockpit yet'], ['Pacing', 'Not linked to the cockpit yet']]) && lineOf('pacing') === 'not linked yet',
      'real model, stand-in page: at 23:59 on 31 December Pacing\'s tooltip still has the sentence on what it does, which says that it posts; from midnight it says only that it is not linked (its chip reads "not linked yet" throughout)', [eve, tipNow()]);
    scene().opts.onHover('forecast'); const beside = tipNow();
    door('exec').click(); scene().opts.onHover('rundown'); const rundown = tipNow(); scene().opts.onHover('prep');
    ok(same([rundown, tipNow(), beside], [['Rundown', 'Not linked to the cockpit yet'], ['Prep', 'Prepares the material for Friday\'s leadership meeting.', 'Has not run yet'], ['Forecast', 'Compares the directors\' roll-up, Leo\'s call and Salesforce.', 'Has not run yet']]),
      'real model, stand-in page: the same for Rundown from that midnight on; the agents beside them, whose tasks have no end, keep their sentence', [rundown, tipNow(), beside]);
    scene().opts.onHover(null);
    T = 0; door('mine').click();
    delete SN.state.sweeper; delete SN.docs.sweeper; for (const id of ['accounts', 'forecast', 'renewals', 'prep']) delete SN.state[id];
    global.OSCrew = modelStandIn;
  } else console.log('skip the real model on the stand-in page: dashboard/os-cockpit-model.js is not there, or does not have lead, brief and overdue yet');

  // ---- a picture that throws folds away, says so once, and the chips carry on ----
  {
    const WEEK = { at: '2026-11-23T06:46:19Z', week: '2026-11-23', slack: { channel: 'D0AAAAAAAA', ts: '1.2' } };
    // what the wiring throws on outside the drawing: the stand-in's zero-millisecond timeouts, run here and caught
    const thrownOn = () => { const out = []; [...timeouts].filter(([, t]) => t.ms === 0).forEach(([id, t]) => { timeouts.delete(id); try { t.fn(); } catch (e) { out.push(e); } }); return out; };
    const lines = () => IDS.map(lineOf);
    T = 0; load('os-cockpit.js'); await tick(); await tick();
    push('hub/weekly', WEEK); push('hub/pulse', undefined);
    TYPE.all();
    const st = stage(), s = scene(), n = scenes.length, before = lines(), boom = new Error('a frame threw');
    ok(typeof s.opts.onError === 'function' && !st.classList.contains('ck-off') && !s.destroyed && before.every((l) => l && l !== '—'), 'the scene is told how to report a throw (onError), and the picture is up');
    // a robot is pointed at when it happens: its chip is described by the tooltip
    const tipOf = () => st.children.find((c) => c.tagName !== 'CANVAS'), described = () => $$('[data-ck]').filter((c) => c.getAttribute('aria-describedby') !== null).map((c) => c.dataset.ck);
    s.anchors.desk = { x: 300, y: 100 }; s.opts.onHover('desk');
    const tip = tipOf(), shown = tip.hidden === false && same(described(), ['desk']);
    s.opts.onError(boom);
    const first = thrownOn();
    ok(st.classList.contains('ck-off') && s.destroyed === 1 && first.length === 1 && first[0] === boom && alive().length === 0, 'a frame that throws: the stage folds away, the scene is let go, and the error is thrown on once outside the drawing', [st.className, s.destroyed, first.map(String)]);
    ok(shown && tip.hidden === true && described().length === 0, '... and the tooltip that was showing goes with it: no chip is left described by a tooltip that is folded away', [shown, tip.hidden, described()]);
    s.opts.onError(new Error('and again'));
    ok(thrownOn().length === 0, '... a second report from the same picture is not thrown on again');
    bus.changed(); tickNow(); TYPE.all();
    ok(scenes.length === n && TYPE.thrown.length === 0 && st.classList.contains('ck-off') && thrownOn().length === 0, '... after that the drawing is left alone: no new scene, nothing thrown, still folded away', [scenes.length - n, TYPE.thrown.map(String), st.className]);
    ok(same(lines(), before) && IDS.every((id) => stateOf(chip(id)).length === 1), '... and the chips keep their lines and states', lines());
    // the chips carry on alone: a document changes; then nothing changes but the clock, and the 30-second timer fires
    H.doc.counts.waiting = 7; bus.changed();
    ok(whatOf('desk') === 'needs 7' && same(stateOf(chip('desk')), ['is-needs']) && st.classList.contains('ck-off'), '... a document that changes after the fold still reaches its chip', [lineOf('desk'), stateOf(chip('desk'))]);
    H.doc.counts.waiting = 0; const drawn = model.calls.length; advance(30000);
    ok(timers.size === 1 && model.calls.length === drawn + 9 && model.calls[model.calls.length - 1].now === NOW + T && whatOf('desk') === 'idle 0' && same(stateOf(chip('desk')), ['is-idle']), '... and the 30-second timer still runs: half a minute on, the chips and the doors are drawn again with the clock moved on (the stage is left alone)', [timers.size, model.calls.length - drawn, lineOf('desk'), stateOf(chip('desk'))]);
    H.doc.counts.waiting = 113; bus.changed();
    // the doors carry on without the picture too: a room opens on its chips and the doors alone, and no scene is made
    { const calls = model.calls.length; door('hygiene').click();
      ok(same(openRoom(), ['hygiene', 'hygiene', 'hygiene']) && model.calls.length === calls + 6 && lineOf('accounts') === 'unknown 0' && same(pipsOf('mine'), ['is-needs', 'is-needs', 'is-needs', 'is-needs', 'is-idle']) && alive().length === 0 && scenes.length === n && st.classList.contains('ck-off') && TYPE.thrown.length === 0 && thrownOn().length === 0,
        '... and so do the doors: with the stage folded away a door still opens its room, on the chips and the doors alone', [openRoom(), model.calls.length - calls, lineOf('accounts')]);
      door('mine').click(); }
    // the stage mounted anew (its element left the page and came back; a tab that is only hidden keeps its mount, and
    // with it the fold, for this run of the script): the picture gets another go
    TYPE.leave(st); TYPE.all();
    const s2 = scene();
    ok(scenes.length === n + 1 && !st.classList.contains('ck-off') && st.children.length === 2 && same(s2.log, ['setCrew', 'resize 600', 'start']) && s2.crew.length === 5, 'mounted anew, the picture is back with the crew', [scenes.length - n, st.className, s2.log]);
    // a throw when the picture is handed a crew (again with a robot pointed at)
    s2.anchors.desk = { x: 300, y: 100 }; s2.opts.onHover('desk');
    const tip2 = tipOf(), shown2 = tip2.hidden === false && same(described(), ['desk']);
    const boom2 = new Error('setCrew threw'); s2.setCrew = () => { throw boom2; };
    let out = null; try { bus.changed(); } catch (e) { out = e; }
    const second = out ? [out] : thrownOn();
    ok(TYPE.thrown.length === 0 && st.classList.contains('ck-off') && s2.destroyed === 1 && second.length === 1 && second[0] === boom2, 'a throw when it is handed a crew: the drawing itself does not throw, the stage folds away, the error is thrown on once', [TYPE.thrown.map(String), st.className, s2.destroyed, second.map(String)]);
    ok(shown2 && tip2.hidden === true && described().length === 0, '... and its tooltip goes with it as well', [shown2, tip2.hidden, described()]);
    tickNow(); bus.changed();
    ok(scenes.length === n + 1 && TYPE.thrown.length === 0 && thrownOn().length === 0 && same(lines(), before), '... and it is not tried again every tick', [scenes.length - n - 1, lines()]);
    // the same guard holds the other two calls of update: a throw when it is handed its size, or started
    for (const call of ['resize', 'start']) {
      const make = sceneStandIn.create, boom3 = new Error(call + ' threw'), m = scenes.length;
      sceneStandIn.create = (c, o) => { const x = make(c, o); x[call] = () => { throw boom3; }; return x; };
      TYPE.leave(st); TYPE.all();                                // mounted anew: update hands the new scene a crew and a size, and starts it
      sceneStandIn.create = make;
      const third = thrownOn();
      ok(scenes.length === m + 1 && TYPE.thrown.length === 0 && st.classList.contains('ck-off') && scene().destroyed === 1 && third.length === 1 && third[0] === boom3, 'a throw from ' + call + ' in update: the drawing itself does not throw, the stage folds away, the error is thrown on once', [scenes.length - m, TYPE.thrown.map(String), st.className, scene().destroyed, third.map(String)]);
      tickNow(); bus.changed();
      ok(scenes.length === m + 1 && TYPE.thrown.length === 0 && thrownOn().length === 0 && same(lines(), before), '... and ' + call + ' is not tried again every tick either', [scenes.length - m - 1, TYPE.thrown.map(String)]);
    }
    // a later run of the script (a new version of the file) takes over and tries again
    load('os-cockpit.js'); await tick(); await tick();
    push('hub/weekly', WEEK); push('hub/pulse', undefined);
    TYPE.all();
    ok(!st.classList.contains('ck-off') && alive().length === 1 && scene().crew.length === 5 && TYPE.thrown.length === 0 && thrownOn().length === 0, 'a later run of the script puts the picture back', [st.className, alive().length, TYPE.thrown.map(String)]);
    // with the type keeping what mount made across the runs
    TYPE.again = 'keep';
    scene().opts.onError(new Error('threw under the kept mount')); thrownOn();
    load('os-cockpit.js'); await tick(); await tick();
    push('hub/weekly', WEEK); push('hub/pulse', undefined);
    TYPE.all();
    ok(!st.classList.contains('ck-off') && alive().length === 1 && scene().crew.length === 5 && TYPE.thrown.length === 0, '... also when the type keeps what the earlier run mounted', [st.className, alive().length, TYPE.thrown.map(String)]);
    TYPE.again = 'unmount';
    // the stage mounted anew while a department's room is open: the new scene is handed that room's crew
    { door('exec').click(); const m = scenes.length; TYPE.leave(st); TYPE.all();
      ok(scenes.length === m + 1 && alive().length === 1 && same(scene().crew.map((a) => a.id), DEPT.exec) && same(scene().log, ['setCrew', 'resize 600', 'start']) && same(openRoom(), ['exec', 'exec', 'exec']), 'the stage mounted anew while a department\'s room is open: the new scene is handed that room\'s crew, and the room stays open', [scene().crew.map((a) => a.id), scene().log]);
      door('mine').click(); }
  }

  bus.fire();
  if (window.__osCockpit) window.__osCockpit.stop();
  ok(timers.size === 0 && timeouts.size === 0 && live('hub/weekly').length + live('hub/pulse').length === 0 && winOn.length === 0 && docHeard('keydown') === 0 && $$('[data-ck]').every((c) => c._on.length === 0) && $$('[data-ck-door]').every((d) => d._on.length === 0) && bus.size() === 0 && alive().length === 0, 'what a run leaves on window can stop everything it set up', [timers.size, timeouts.size]);
};

// =====================================================================================================================
// ---- 4. the real page scripts and the real model, a stand-in scene, a fake database ----
const realRun = async () => {
  const params = { region: 'All', mgr: '', person: '', checkArea: 'All', ooWho: '', cvSeg: 'all', cvRt: 'nb', cvClean: false, grWindow: 30 };
  const onData = [];
  global.dash = { loader() {}, calc() {}, draw: TYPE.draw, params: () => params, setParams: (p) => { Object.assign(params, p); onData.forEach((f) => f()); }, onData: (fn) => { onData.push(fn); }, colors: ['#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888'], setLink: (l) => { TYPE.links.push(l); },
    data: () => ({ status: 'loading', data: [] }) };
  global.d3 = { utcFormat: () => (d) => d.toISOString().slice(0, 10), format: (f) => (v) => (f === '.1f' ? (+v).toFixed(1) : f === '.0%' ? Math.round(v * 100) + '%' : f === ',' ? Math.round(v).toLocaleString('en') : String(v)), max: (a, f) => (a.length ? Math.max(...a.map(f)) : undefined), select: () => ({ selectAll: () => ({ remove() {} }) }) };
  const FILES = ['os-core.js', 'os-calcs.js', 'os-calcs-leads.js', 'os-calcs-act.js', 'os-calcs-conv.js', 'os-draw.js', 'os-cockpit-model.js'];
  const boot = () => { for (const f of FILES) load(f); global.OSCockpit = sceneStandIn; load('os-cockpit.js'); };
  boot();
  await tick(); await tick(); await tick(); await tick();
  const RM = window.OSCrew.ROOMS, nameOf = (c) => c.children.find((x) => x.tagName === 'B').textContent, chipsIn = (u) => u.querySelectorAll('[data-ck]');
  ok(typeof window.OSCrew.derive === 'function' && same(window.OSCrew.ROSTER.map((a) => a.id), IDS) && same(chipsIn(strip('mine')).map((c) => c.dataset.ck), window.OSCrew.ROSTER.map((a) => a.id)), 'the real model loads, and the chips of his own room are its roster, in its order');
  ok(same(chipsIn(strip('mine')).map(nameOf), window.OSCrew.ROSTER.map((a) => a.name)), 'the names in those chips are the roster\'s names');
  ok(same($$('.ck-strip').map((u) => [u.dataset.ckRoom, chipsIn(u).map((c) => c.dataset.ck), chipsIn(u).map(nameOf)]), RM.map((r) => [r.id, r.agents.map((a) => a.id), r.agents.map((a) => a.name)])) && same($$('[data-ck]').map((c) => c.dataset.ck), RM.flatMap((r) => r.agents.map((a) => a.id))),
    'every room of the model has its strip on the page, with its agents\' chips in its order and under its names; no chip stands for anyone else');
  ok(same($$('[data-ck-door]').map((d) => [d.dataset.ckDoor, d.childNodes[0].nodeValue]), RM.map((r) => [r.id, r.name])) && same(drawings('ck-lane').map((u) => u.dataset.ckRoom), RM.slice(1).map((r) => r.id)) && same($$('[data-ck-role]').map((r) => r.dataset.ckRole), RM.flatMap((r) => r.agents.map((a) => a.id))) && same($$('.ck-strip').slice(1).map((u) => u.getAttribute('aria-label')), RM.slice(1).map((r) => r.name + ' agents')) && same(drawings('ck-lane').map((u) => u.getAttribute('aria-label')), RM.slice(1).map((r) => r.name + ': prepared for you')),
    'the doors are the model\'s rooms under its names; each department has its lane, and its two lists are labelled with its name; every agent has its role sentence');
  // documents like the ones the agents write: the numbers and times of the spec's example, made-up words
  const U = 'data/users/u_william/';
  const TODAY = { at: '2026-11-24T12:15:58Z', hubUrl: 'https://claude.ai/artifact/DBfeBDJhUg78LXARWBwSfU', counts: { waiting: 113, critical: 1, prepared: 103, doneToday: 14 }, lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, brief: { headline: 'A headline.' },
    top: Array.from({ length: 12 }, (_, i) => ({ id: 'item-' + i, title: 'Item ' + i, kind: 'ask', severity: 'high', status: 'waiting', dueAt: null })) };
  const WEEKLY = { at: '2026-11-23T06:46:19Z', week: '2026-11-23', parent: 'Words.', sections: [], slack: { channel: 'D0AAAAAAAA', ts: '1.2' } };
  const lane = (n, pre) => Array.from({ length: n }, (_, i) => ({ id: pre + i, question: 'Question ' + i + '?', headline: 'Headline ' + i, title: 'Title ' + i, recommend: 'yes', yes: {}, no: {} }));
  const crew = () => scene().crew.map((a) => [a.id, a.state, a.waiting]);
  const runLine = () => { const el = drawings('hub-run')[0]; return [el.textContent, el.classList.contains('os-bad') ? 'red' : el.classList.contains('os-warn') ? 'amber' : 'plain']; };
  TYPE.all(); // the type draws after the scripts: nothing has arrived yet
  const heldNow = () => scene().crew.length === 0 && drawings('ck-line').every((e) => e.textContent === '—') && $$('[data-ck]').every((c) => stateOf(c).length === 0);
  ok(scenes.length === 1 && heldNow() && TYPE.thrown.length === 0, 'before the first snapshots: an empty room, every chip a —, nothing thrown', [scene().crew, TYPE.thrown.map(String)]);
  ok(same(FOUR.map(shownOf), [null, null, null, null]) && FOUR.every((n) => !!numberOf(n) && numberOf(n).hidden && numberOf(n).textContent === '' && !!slotOf(n) && !slotOf(n).hidden), 'before the first snapshots no tab shows a number and the Hub pane no headline: the four are hidden, as stored', FOUR.map(shownOf));
  push('hub/today', TODAY);
  push('hub/decisions', { at: '2026-11-24T06:44:12Z', by: 'the decisions task', items: lane(10, 'dec-') });
  push('hub/leo', { at: '2026-11-24T06:44:12Z', to: { name: 'A Colleague', slackId: 'U0AAAAAAA1' }, items: lane(7, 'leo-') });
  push('hub/instinct', { at: '2026-11-24T07:30:00Z', items: lane(3, 'ins-') }); push('hub/muse', { at: '2026-11-24T07:30:00Z', items: lane(2, 'muse-') });
  push('hub/weekly', WEEKLY); push('hub/pulse', undefined);
  // the departments' documents: Sweeper has run (on trial, two items, one of which William handled), the others never
  const SWEEP = { at: '2026-11-23T05:50:40Z', status: 'ok', trial: true, run: 'ask', week: '2026-W48', scope: 'All EMEA · New Business and Upsell', total: 58, errors: [], items: [
    { id: 'sw-1', level: 'watch', title: 'Seven checks, counted per team', why: 'The largest check is a third of all open deals.', evidence: [{ label: 'Stage 0 after a meeting', value: '41 · $1.2M' }, { label: 'Pilot end passed', value: '17 · $0.6M' }], action: { label: 'Post the ask', sends: [{ type: 'slack', body: 'Team, this week\'s ask.' }] }, source: 'Salesforce, counted Monday 06:50 Stockholm' },
    { id: 'sw-2', level: 'watch', title: 'Flags by team', why: 'One team has a quarter of the flags.', evidence: [{ label: 'All other teams', value: '9' }] }] };
  const DEPT_DOCS = ['sweeper', 'accounts', 'forecast', 'renewals', 'prep'];
  push('hub/sweeper', SWEEP); for (const id of DEPT_DOCS.slice(1)) push('hub/' + id, undefined);
  ok(heldNow() && [OS.hub.ready(), OS.sense.ready(), OS.lanes.ready()].every((r) => r === false), 'every document has arrived, William\'s own reactions have not: OS.hub, OS.sense and OS.lanes say not ready, and the crew is still held', [OS.hub.ready(), OS.sense.ready(), OS.lanes.ready()]);
  ok(ROOM_IDS.every((r) => countOf(r) === '' && pipsOf(r).every((p) => p === '')), '... and no door shows a state or a number yet', ROOM_IDS.map(countOf));
  // (seen in Chromium: the tabs read Today 4, Decide 2, For Leo 3 until his reactions arrived, then 1, none and 1)
  ok(same(FOUR.map(shownOf), [null, null, null, 'A headline.']) && FOUR.slice(0, 3).every((n) => numberOf(n).hidden && numberOf(n).textContent === ''),
    '... nor does a tab show a number: the three wait for his reactions, as the cockpit does (each would count what he has handled already, and drop a moment later); the headline, which no reaction of his changes, is there', FOUR.map(shownOf));
  // a door pressed while the crew is held: its room is shown, empty, and its lane has no card yet (the item he
  // handled would show and go)
  door('hygiene').click();
  ok(same(openRoom(), ['hygiene', 'hygiene', 'hygiene']) && scene().crew.length === 0 && same(DEPT.hygiene.map(lineOf), ['—', '—']) && laneOf('hygiene').children.length === 0 && OS.sense.items('sweeper').length === 2, 'a door pressed while the crew is held shows its room empty: no robot, the chips at their dash, and no card before his reactions have answered', [openRoom(), laneOf('hygiene').children.length]);
  door('mine').click();
  push(U + 'hub-actions', null); push(U + 'sense-acts', { acts: { 'ins-older': { action: 'ack', at: '2026-11-20T00:33:49Z' }, 'sw-2': { action: 'ack', at: '2026-11-23T08:00:00Z' } } }); push(U + 'decisions', null);
  ok(heldNow() && OS.hub.ready() && OS.sense.ready() && !OS.lanes.ready(), 'his Hub actions, his sense reactions and his answers have: still one to go (his Leo actions)', [OS.hub.ready(), OS.sense.ready(), OS.lanes.ready()]);
  ok(same(FOUR.map(shownOf), ['113', null, null, 'A headline.']), 'the Today tab shows its number once his Hub actions have answered (113); the tabs of Decide and For Leo still wait for his Leo actions', FOUR.map(shownOf));
  push(U + 'leo-acts', { acts: { 'leo-old': { action: 'done', at: '2026-11-14T11:12:17Z' }, 'leo-6': { action: 'done', at: '2026-11-24T07:00:00Z' } } });
  ok(OS.lanes.ready() && same(crew(), [['desk', 'needs', 113], ['decide', 'needs', 16], ['instinct', 'needs', 3], ['muse', 'needs', 2], ['review', 'idle', 0]]), 'the last of his reactions answers: the crew is released, with the counts already less what he had handled (For Leo 6, not 7)', crew());
  ok(scene().crews.slice(0, -1).every((c) => c.length === 0), 'no robot was shown before that');
  ok(same(FOUR.map(shownOf), ['113', '10', '6', 'A headline.']), '... and the tabs of Decide and For Leo show their numbers: the first number For Leo shows is 6, already less the point he had acted on (never 7)', FOUR.map(shownOf));
  ok(same(ROOM_IDS.map(countOf), ['134', '1', '', '']) && same(pipsOf('hygiene'), ['is-needs', 'is-unknown']) && saidBy(door('hygiene')) === 'Data Hygiene, 2 agents, 1 waiting on you' && same(openRoom(), ['mine', 'mine', '']),
    'the doors open on the right counts at once: Data Hygiene 1 (the item he handled is not counted: never 2), his own room 134', [ROOM_IDS.map(countOf), pipsOf('hygiene')]);
  fail(U + 'leo-acts'); push(U + 'leo-acts', null);
  ok(same(crew()[1], ['decide', 'needs', 17]), 'the documents of the spec\'s example: Decide holds 17', crew()[1]);
  ok(same(FOUR.map(shownOf), ['113', '10', '7', 'A headline.']) && FOUR.slice(0, 3).every((n) => !!numberOf(n) && numberOf(n).classList.contains('is-on')) && FOUR.every((n) => !!slotOf(n) && slotOf(n).childNodes.length === 0 && !slotOf(n).hidden),
    'the tabs show their numbers (Today 113, Decide 10, For Leo 7) and the Hub pane the brief\'s headline: each was shown by the empty drawing beside it and then drawn, by the type\'s rule; the empty drawings stay empty', FOUR.map(shownOf));
  ok(same(scene().crew.map((a) => [a.name, a.look, a.hue]), window.OSCrew.ROSTER.map((a) => [a.name, a.look, a.hue])) && scene().crew.every((a) => typeof a.bubble === 'string' && typeof a.step === 'string' && Number.isFinite(a.fresh)), 'each member is a full crew entry: name, look, hue, bubble, step, fresh');
  ok(same(IDS.map(lineOf), ['13:15 · 113 for you', '07:44 · 10 decisions, 7 for Leo', '08:30 · 3 for you', '08:30 · 2 for you', 'Mon 07:46 · posted']), 'the chips read as in the spec\'s example, Decide naming its two parts', IDS.map(lineOf));
  ok(same(IDS.map(whatOf), ['113 for you', '10 decisions, 7 for Leo', '3 for you', '2 for you', 'posted']) && IDS.every((id) => whenOf(id) + whatOf(id) === lineOf(id)), 'each line is the model\'s lead, a dot, and its brief; a narrow page keeps the brief', IDS.map(whatOf));
  ok(same(IDS.map((id) => stateOf(chip(id))), [['is-needs'], ['is-needs'], ['is-needs'], ['is-needs'], ['is-idle']]), 'each chip carries its one state class', IDS.map((id) => stateOf(chip(id))));
  const canvas = stage().children.find((c) => c.tagName === 'CANVAS'), tip = stage().children.find((c) => c.tagName !== 'CANVAS');
  ok(canvas.getAttribute('aria-hidden') === 'true' && canvas.getAttribute('aria-label') === null, 'the picture is hidden from assistive technology: the chips say the same');
  scene().anchors.decide = { x: 300, y: 100 }; scene().opts.onHover('decide');
  const tipWords = () => tip.children.flatMap((c) => (c.children.length ? c.children : [c]).map((x) => x.textContent));
  ok(same(tipWords(), ['Decide', 'Prepares your yes/no decisions and the points for Leo.', '17 waiting on you: 10 decisions, 7 for Leo', 'Last result 07:44', 'Next run 07:43 tomorrow']) && chip('decide').getAttribute('aria-describedby') === tip.id, 'the tooltip: name, role, what waits and of which kind, the last result and the next run; the chip is described by it', tipWords());
  scene().opts.onHover(null);
  // ---- a department's room: Data Hygiene in its first week ----
  {
    const cardsIn = (r) => laneOf(r).children, btn = (card, label) => card.querySelectorAll('button').find((b) => b.textContent === label);
    const c0 = scene().crews.length;
    door('hygiene').click();
    ok(same(openRoom(), ['hygiene', 'hygiene', 'hygiene']) && same(scene().crew.map((a) => [a.id, a.name, a.look, a.hue, a.state, a.waiting]), [['sweeper', 'Sweeper', 'plain', 'green', 'needs', 1], ['accounts', 'Accounts', 'headset', 'violet', 'unknown', 0]]) && scenes.length === 1,
      'a click on the Data Hygiene door: the same scene gets Sweeper (one thing for you) and Accounts (an empty chair)', scene().crew.map((a) => [a.id, a.state, a.waiting]));
    ok(same(DEPT.hygiene.map(lineOf), ['Mon 06:50 · trial · 1 for you', 'not run yet']) && same(DEPT.hygiene.map((id) => stateOf(chip(id)).concat(chip(id).classList.contains('ck-leads') ? ['leads'] : [])), [['is-needs', 'leads'], ['is-unknown']]), 'its chips read "Mon 06:50 · trial · 1 for you" and "not run yet"; Sweeper\'s leads to its card', DEPT.hygiene.map(lineOf));
    const cards = cardsIn('hygiene'), card = cards[0];
    ok(cards.length === 1 && card.dataset.ckOf === 'sweeper' && same(card.children[0].children.map((x) => x.textContent), ['Sweeper', 'Trial', 'yesterday 06:50 · All EMEA · New Business and Upsell']) && /Seven checks, counted per team/.test(card.textContent) && /41 · \$1\.2M/.test(card.textContent) && /From Salesforce, counted Monday 06:50 Stockholm/.test(card.textContent),
      'the lane under the chips: one card (the item he handled is not shown). It names its agent, says Trial, when and for what the document was written, then the title, the evidence and where it is from', cards.map((x) => x.textContent));
    const send = btn(card, 'Post the ask via Claude');
    ok(!!send && send.disabled === true && same(card.querySelectorAll('.hub-note').map((n) => n.textContent), ['Trial: nothing can be sent.']) && !!btn(card, 'Got it') && !!btn(card, 'Not useful') && !btn(card, 'Got it').disabled, 'on trial the send button is there and is off, with the note "Trial: nothing can be sent."; Got it and Not useful are on', card.querySelectorAll('button').map((b) => [b.textContent, !!b.disabled]));
    const writes = DB.writes.length; send.click(); await tick(); flush();
    ok(DB.writes.length === writes && same(crew()[0], ['sweeper', 'needs', 1]), 'a press on the button that is off sends nothing and marks nothing');
    // the message he cannot send during the trial can be read: "Read the draft", closed, between the buttons and the source line
    const draft = card.querySelectorAll('details');
    ok(draft.length === 1 && draft[0].classList.contains('lane-draft') && !draft[0].hasAttribute('open') && same(draft[0].children.map((x) => [x.tagName, x.className]), [['SUMMARY', ''], ['DIV', 'lane-msgs']]) && draft[0].children[0].textContent === 'Read the draft'
      && same(draft[0].children[1].children.map((x) => [x.tagName, x.textContent]), [['P', 'Slack message'], ['PRE', 'Team, this week\'s ask.']]) && draft[0].querySelectorAll('button').length + draft[0].querySelectorAll('a').length === 0
      && same(card.children.slice(-3).map((x) => x.className), ['hub-acts', 'lane-draft', 'lane-meta']) && card.children[card.children.length - 1].textContent === 'From Salesforce, counted Monday 06:50 Stockholm',
      'on trial the prepared message can be read on the card: "Read the draft", closed, after the buttons and before the source line, with what the message is and its text to the letter, and nothing in it to press', card.children.map((x) => x.className));
    if (draft[0]) draft[0].setAttribute('open', ''); // he opens it (the browser sets the attribute; no script of the page does)
    tickNow(); OS.docs.changed(); flush();
    ok(cardsIn('hygiene')[0] === card, 'a redraw with nothing new in the cards keeps the very same card (the keyboard\'s place in it is not lost)');
    ok(draft.length === 1 && cardsIn('hygiene')[0].querySelectorAll('details')[0] === draft[0] && draft[0].hasAttribute('open') && draft[0].parentNode === cardsIn('hygiene')[0] && DB.writes.length === writes, 'the draft he opened is still open in the lane after the half-minute tick and a change of documents; opening it wrote nothing');
    scrolled.length = 0; const led = scene().opts.onPick('sweeper'); flush();
    ok(led === true && scrolled.length === 1 && scrolled[0].el === card && document.activeElement === card, 'a click on the Sweeper robot, or its chip, scrolls to its card and moves focus there', [led, scrolled.length]);
    const no = scene().opts.onPick('accounts'); flush();
    ok(no === false && same(tipWords(), ['Accounts', 'Finds accounts and records without the right owner.', 'Has not run yet']), 'a click on Accounts\' empty chair or chip opens nothing: its tooltip, which says it has not run yet and promises no run', tipWords());
    scene().opts.onHover(null);
    btn(card, 'Got it').click();
    ok(cardsIn('hygiene').length === 0 && lineOf('sweeper') === 'Mon 06:50 · trial · 1 for you', 'Got it takes the card away at once (as in the Instinct pane); the chip and the door follow when the burst of changes is over', [cardsIn('hygiene').length, lineOf('sweeper')]);
    await tick(); flush();
    const w = DB.writes[DB.writes.length - 1];
    ok(w.p === U + 'sense-acts' && w.data.acts['sw-1'].action === 'ack' && w.data.acts['sw-2'].action === 'ack' && DB.writes.every((x) => /^data\/users\/u_william\//.test(x.p)), 'Got it is kept with his reactions to Instinct and Muse, in his own sense-acts, and nowhere else', w.p);
    ok(same(crew(), [['sweeper', 'idle', 0], ['accounts', 'unknown', 0]]) && lineOf('sweeper') === 'Mon 06:50 · trial' && cardsIn('hygiene').length === 0 && countOf('hygiene') === '' && !chip('sweeper').classList.contains('ck-leads') && saidBy(door('hygiene')) === 'Data Hygiene, 2 agents, nothing waiting',
      '... and at once nothing waits in the room: Sweeper idle ("trial" in place of "all clear"), the lane empty, no number on the door', [crew(), lineOf('sweeper'), countOf('hygiene')]);
    OS.sense.act('sw-1', null); await tick(); flush();
    // the trial over, and a new run: the first four items count and show
    // (the third item names the source the first one names; the others name none)
    push('hub/sweeper', { ...SWEEP, at: '2026-11-24T05:50:30Z', trial: false, items: SWEEP.items.concat([{ id: 'sw-3', source: SWEEP.items[0].source }, { id: 'sw-4' }, { id: 'sw-5' }, { id: 'sw-6' }]) });
    const after = cardsIn('hygiene');
    const topOf = (x) => x.children[0].children.map((y) => y.textContent), fromOf = (x) => x.children.filter((y) => y.tagName === 'P' && y.className === 'lane-meta').map((y) => y.textContent);
    ok(after.length === 3 && same(after.map(topOf), [['Sweeper', '06:50 · All EMEA · New Business and Upsell'], ['Sweeper', '06:50'], ['Sweeper', '06:50']]) && !btn(after[0], 'Post the ask via Claude') && /Open the Claude chat beside this page to send from here\./.test(after[0].textContent) && lineOf('sweeper') === '06:50 · 3 for you' && same(crew()[0], ['sweeper', 'needs', 3]),
      'off trial, a new run with six items: the first four count and show (one of them handled: three cards, "3 for you"), no Trial mark, the scope on the first card only, and the usual note where Claude is not beside the page', [after.length, lineOf('sweeper'), after.map(topOf)]);
    // the lane on the real page, drawn through the page's own dash.draw: a card that stays is the very same element
    // (with three cards, as the check above holds; with another number these checks are not run, and that one is red)
    if (after.length === 3) { const SAID = 'From Salesforce, counted Monday 06:50 Stockholm', off = after[0].querySelectorAll('details');
      ok(same(after.map(fromOf), [[SAID], [], []]) && off.length === 1 && !off[0].hasAttribute('open') && off[0].querySelectorAll('pre')[0].textContent === 'Team, this week\'s ask.' && after.slice(1).every((x) => x.querySelectorAll('details').length === 0),
        'off trial the first card says where it is from and lets him read the draft (closed); the second, whose item names the same source, does not say it again; the cards with nothing to send have no draft', after.map(fromOf));
      if (off[0]) off[0].setAttribute('open', ''); // he opens the draft on the first card, and tabs to a button on the second
      after[1].querySelectorAll('button')[0].focus();
      const held = document.activeElement;
      btn(after[2], 'Not useful').click();
      const two = cardsIn('hygiene');
      ok(two.length === 2 && two[0] === after[0] && two[1] === after[1] && off.length === 1 && off[0].hasAttribute('open') && off[0].parentNode === after[0] && !!held && document.activeElement === held && held.parentNode.parentNode === after[1],
        'Not useful on the last card: the other two are the very same elements, left in the lane: the open draft is still open and the keyboard is still on its button', [two.length, document.activeElement === held]);
      btn(after[0], 'Got it').click();
      const one = cardsIn('hygiene');
      ok(one.length === 1 && one[0] !== after[1] && same(topOf(one[0]), ['Sweeper', '06:50 · All EMEA · New Business and Upsell']) && same(fromOf(one[0]), [SAID]) && one[0].querySelectorAll('details').length === 0,
        'Got it on the first card: the card that is now first is made anew, with the scope and the source line', [one.map(topOf), one.map(fromOf)]);
      await tick(); flush(); OS.sense.act('sw-1', null); OS.sense.act('sw-4', null); await tick(); flush();
      ok(same(cardsIn('hygiene').map(topOf), [['Sweeper', '06:50 · All EMEA · New Business and Upsell'], ['Sweeper', '06:50'], ['Sweeper', '06:50']]) && same(cardsIn('hygiene').map(fromOf), [[SAID], [], []]) && lineOf('sweeper') === '06:50 · 3 for you',
        'with both reactions taken back the three cards are back: the scope and the source on the first only', [cardsIn('hygiene').map(topOf), cardsIn('hygiene').map(fromOf)]); }
    push('hub/sweeper', { at: '2026-11-24T05:50:30Z', status: 'error', trial: false, run: 'ask', errors: ['all seven checks failed'] });
    ok(same(crew()[0], ['sweeper', 'error', 0]) && lineOf('sweeper') === 'failed 06:50' && cardsIn('hygiene').length === 0 && same(pipsOf('hygiene'), ['is-error', 'is-unknown']) && saidBy(door('hygiene')) === 'Data Hygiene, 2 agents, 1 failed', 'a run that ended in an error and left no items: "failed 06:50", red on the door, and the door says "1 failed"; not "not run yet", and not "nothing waiting"', [crew()[0], lineOf('sweeper'), saidBy(door('hygiene'))]);
    // a placeholder is not a result; a document that can no longer be read shows nothing of what it held
    push('hub/accounts', { hubUrl: 'https://claude.ai/x', trial: true }); push('hub/sweeper', SWEEP);
    ok(lineOf('accounts') === 'not run yet' && same(crew()[1], ['accounts', 'unknown', 0]) && cardsIn('hygiene').length === 1, 'a document that says neither when nor how a run ended and lists no items is a placeholder: Accounts still reads "not run yet"', [lineOf('accounts'), crew()[1]]);
    // a result must list its items: one that does not is no data, not a run with nothing to show
    const roomNow = () => [OS.sense.state('sweeper'), lineOf('sweeper'), crew()[0].join(' '), cardsIn('hygiene').length, countOf('hygiene'), pipsOf('hygiene').join(' '), saidBy(door('hygiene')), chip('sweeper').classList.contains('ck-leads')];
    const unlisted = [{ 0: SWEEP.items[0], 1: SWEEP.items[1] }, 'two things', null].map((list) => { push('hub/sweeper', { ...SWEEP, items: list }); return roomNow(); });
    ok(same(unlisted, Array(3).fill(['ok', 'no data', 'sweeper unknown 0', 0, '', 'is-unknown is-unknown', 'Data Hygiene, 2 agents, no data', false])),
      'a result whose items are not a list (two items keyed 0 and 1 where a list was meant, a text, nothing): "no data", an empty chair, a hollow dot and no card; not "trial" with "nothing waiting"', unlisted[0]);
    scene().anchors.sweeper = { x: 300, y: 100 }; scene().opts.onHover('sweeper');
    ok(same(tipWords(), ['Sweeper', 'Counts open deals that break your hygiene rules, by team.', 'Can\'t read the database here']), '... and its tooltip does not say "Nothing waiting on you", gives no last result and promises no run', tipWords());
    scene().opts.onHover(null);
    push('hub/sweeper', { ...SWEEP, items: [] });
    ok(same(roomNow(), ['ok', 'Mon 06:50 · trial', 'sweeper idle 0', 0, '', 'is-idle is-unknown', 'Data Hygiene, 2 agents, nothing waiting', false]), 'an empty list is a run with nothing to show: "trial" in place of "all clear", and the door says "nothing waiting"', roomNow());
    // an item needs an id that is not empty: his reactions are kept by id, so one without could never be handled
    push('hub/sweeper', { ...SWEEP, items: [{ ...SWEEP.items[0], id: '', title: 'An item without an id' }, SWEEP.items[0]] });
    ok(same(roomNow(), ['ok', 'Mon 06:50 · trial · 1 for you', 'sweeper needs 1', 1, '1', 'is-needs is-unknown', 'Data Hygiene, 2 agents, 1 waiting on you', true]) && cardsIn('hygiene')[0].dataset.ckOf === 'sweeper' && /Seven checks, counted per team/.test(cardsIn('hygiene')[0].textContent),
      'an item whose id is empty is left out: the door counts 1, not 2, and the lane has the one card that Got it can take away', roomNow());
    btn(cardsIn('hygiene')[0], 'Got it').click(); await tick(); flush();
    ok(same(roomNow(), ['ok', 'Mon 06:50 · trial', 'sweeper idle 0', 0, '', 'is-idle is-unknown', 'Data Hygiene, 2 agents, nothing waiting', false]), '... and once that one is handled the door\'s count is gone: nothing is left that he cannot act on', roomNow());
    // a list of which not one item has an id: nothing of it can be counted or shown, so it is no data, not a clean run
    const noIds = [true, false].map((trial) => { push('hub/sweeper', { ...SWEEP, trial, items: SWEEP.items.map((x) => ({ ...x, id: '' })) }); return roomNow(); });
    ok(same(noIds, Array(2).fill(['ok', 'no data', 'sweeper unknown 0', 0, '', 'is-unknown is-unknown', 'Data Hygiene, 2 agents, no data', false])),
      'a result of whose items none has an id, on trial or off: "no data", an empty chair, a hollow dot and no card; not "trial" or "all clear" with "nothing waiting"', noIds);
    OS.sense.act('sw-1', null); await tick(); flush(); push('hub/sweeper', SWEEP);
    fail('hub/sweeper');
    ok(lineOf('sweeper') === 'no data' && cardsIn('hygiene').length === 0 && countOf('hygiene') === '' && same(pipsOf('hygiene'), ['is-unknown', 'is-unknown']) && saidBy(door('hygiene')) === 'Data Hygiene, 2 agents, no data' && !chip('sweeper').classList.contains('ck-leads'), 'when Sweeper\'s document can no longer be read: "no data", no cards (the lane shows what the chip counts), nothing on the door', [lineOf('sweeper'), cardsIn('hygiene').length, saidBy(door('hygiene'))]);
    push('hub/accounts', undefined); push('hub/sweeper', SWEEP);
    // ARR and Executive: nobody reports yet
    door('arr').click();
    ok(same(scene().crew.map((a) => [a.id, a.state]), [['pacing', 'unknown'], ['forecast', 'unknown'], ['renewals', 'unknown']]) && same(DEPT.arr.map(lineOf), ['not linked yet', 'not run yet', 'not run yet']) && cardsIn('arr').length === 0 && same(openRoom(), ['arr', 'arr', 'arr']),
      'the ARR door: three empty chairs; Pacing, which runs and posts by itself, reads "not linked yet", the others "not run yet"; no cards', DEPT.arr.map(lineOf));
    door('exec').click();
    ok(same(DEPT.exec.map(lineOf), ['not linked yet', 'not run yet']) && saidBy(door('exec')) === 'Executive, 2 agents, no data', 'the Executive door: Rundown "not linked yet", Prep "not run yet"', DEPT.exec.map(lineOf));
    door('mine').click();
    ok(same(openRoom(), ['mine', 'mine', '']) && same(crew().map((a) => a[0]), IDS) && scene().crews.length > c0 && scenes.length === 1 && TYPE.thrown.length === 0, 'back through the first door: his five again, on the same scene; nothing thrown on the way', [openRoom(), TYPE.thrown.map(String)]);
  }
  // the "Needs you" tile, the Hub pane's run line and the Desk slip tell one story
  const tile = () => drawings('hub-count').find((e) => e.dataset.field === 'waiting').textContent;
  ok(tile() === '113' && same(runLine(), ['Worker: last run 13:15 · ok', 'plain']), 'the Hub\'s "Needs you" tile shows the same 113, and its run line is plain', [tile(), runLine()]);
  OS.hub.act('item-3', 'done', 'Item 3'); await tick(); flush();
  ok(tile() === '112' && same(crew()[0], ['desk', 'needs', 112]) && lineOf('desk') === '13:15 · 112 for you', 'Done on a Hub item: the tile and the Desk robot both say 112 at once', [tile(), crew()[0], lineOf('desk')]);
  const tabDone = shownOf('hub-badge');
  OS.hub.act('item-3', null); await tick(); flush();
  ok(tabDone === '112' && shownOf('hub-badge') === '113', '... and so does the Today tab\'s number: 112, and 113 again when the item is put back', [tabDone, shownOf('hub-badge')]);
  // William's own answers reach the picture through OS.docs
  OS.lanes.answer('dec-0', 'yes'); await tick(); flush();
  ok(same(crew()[1], ['decide', 'needs', 16]) && lineOf('decide') === '07:44 · 9 decisions, 7 for Leo', 'a decision answered on the Decide tab: Decide now holds 16', [crew()[1], lineOf('decide')]);
  ok(same(FOUR.map(shownOf), ['113', '9', '7', 'A headline.']), '... and the Decide tab\'s number follows the answer: 9', FOUR.map(shownOf));
  OS.lanes.leoAct('leo-0', 'done'); await tick(); flush();
  const leoDone = [shownOf('leo-badge'), crew()[1].join(' ')];
  OS.lanes.leoAct('leo-0', null); await tick(); flush();
  ok(same(leoDone, ['6', 'decide needs 15']) && shownOf('leo-badge') === '7' && same(crew()[1], ['decide', 'needs', 16]), 'a point for Leo acted on: the For Leo tab\'s number goes to 6, with the Decide robot\'s count; taken back, it is 7 again', [leoDone, shownOf('leo-badge')]);
  OS.sense.act('ins-0', 'ack'); OS.sense.act('ins-1', 'notuseful'); OS.sense.act('ins-2', 'ack'); await tick(); flush();
  ok(same(crew()[2], ['instinct', 'idle', 0]) && lineOf('instinct') === '08:30 · all clear', 'every Instinct signal handled: Instinct goes idle, "all clear"', [crew()[2], lineOf('instinct')]);
  // a heartbeat: Desk shows as working while its run is under way, with its step
  push('hub/pulse', { agents: { desk: { state: 'running', startedAt: '2026-11-24T12:46:00Z', finishedAt: null, step: 'Reading Slack' } } });
  ok(same(crew()[0], ['desk', 'working', 113]) && scene().crew[0].step === 'Reading Slack' && lineOf('desk') === 'working · Reading Slack' && same(stateOf(chip('desk')), ['is-working']), 'hub/pulse says Desk is running: working, with its step, in the scene and on the chip', [crew()[0], lineOf('desk')]);
  push('hub/pulse', { agents: { desk: { state: 'ok', startedAt: '2026-11-24T12:46:00Z', finishedAt: '2026-11-24T12:49:00Z', step: '' } } });
  ok(same(crew()[0], ['desk', 'needs', 113]), 'the run ends: Desk is back with its 113', crew()[0]);
  // the clock alone: a run that has not reported is due, then has no result, and the 30-second timer is what notices
  push('hub/today', { ...TODAY, at: '2026-11-24T06:15:00Z', lastRun: { at: '2026-11-24T06:15:00Z', status: 'ok' } });
  ok(same(crew()[0], ['desk', 'due', 113]) && lineOf('desk') === 'due 13:13 · 113 for you' && same(stateOf(chip('desk')), ['is-due']) && scene().crew[0].bubble === 'Run due 13:13', '13:50 and the 13:13 run has not reported: Desk is due, and what waits is still named', [crew()[0], lineOf('desk')]);
  ok(same(runLine(), ['Worker: last run 07:15 · ok', 'plain']), 'the Hub pane\'s run line: within the run\'s grace nothing is said yet', runLine());
  const before = scene().crews.length;
  advance(10 * 60e3);
  ok(scene().crews.length > before && same(crew()[0], ['desk', 'late', 113]) && lineOf('desk') === 'no result 13:13 · 113 for you' && same(stateOf(chip('desk')), ['is-late']), 'ten minutes on, no document changed: the timer alone has moved Desk to "no result 13:13"', [crew()[0], lineOf('desk')]);
  ok(same(runLine(), ['Worker: last run 07:15 · ok · no result from the 13:13 run', 'amber']), '... and the Hub pane\'s run line says the same, in amber (not "over 8 hours ago")', runLine());
  T = 0;
  push('hub/today', { ...TODAY, lastRun: { at: '2026-11-24T12:15:58Z', status: 'failed' } });
  ok(same(crew()[0], ['desk', 'error', 113]) && lineOf('desk') === 'failed 13:15 · 113 for you' && same(stateOf(chip('desk')), ['is-error']) && same(runLine(), ['Worker: last run 13:15 · failed', 'red']), 'a failed run: Desk shows the fault, "failed 13:15", and the run line is red', [crew()[0], lineOf('desk'), runLine()]);
  push('hub/today', { ...TODAY, lastRun: { at: '2026-11-24T12:15:58Z', status: 'partial' } });
  ok(lineOf('desk') === '13:15 · partial · 113 for you' && same(runLine(), ['Worker: last run 13:15 · partial', 'amber']), 'a partial run: "13:15 · partial · 113 for you", and the run line amber', [lineOf('desk'), runLine()]);
  push('hub/today', { ...TODAY, counts: { critical: 1, prepared: 103, doneToday: 14 } });
  ok(same(crew()[0].slice(0, 2), ['desk', 'unknown']) && lineOf('desk') === 'no data' && same(stateOf(chip('desk')), ['is-unknown']), 'a summary without a count waiting: "no data", not "all clear"', [crew()[0], lineOf('desk')]);
  push('hub/today', TODAY);
  // a document that can't be read, one never written, and a review that was not posted
  fail('hub/muse'); push('hub/weekly', undefined);
  ok(same(crew()[3].slice(0, 2), ['muse', 'unknown']) && lineOf('muse') === 'no data' && same(stateOf(chip('muse')), ['is-unknown']) && same(crew()[4], ['review', 'unknown', 0]) && lineOf('review') === 'not run yet', 'Muse can\'t be read: not in the room, "no data"; no hub/weekly: "not run yet"', [crew()[3], lineOf('muse'), crew()[4], lineOf('review')]);
  push('hub/weekly', { ...WEEKLY, slack: null, error: 'channel_not_found' });
  ok(same(crew()[4].slice(0, 2), ['review', 'error']) && lineOf('review') === 'failed Mon 07:46', 'the review written with slack: null: "failed Mon 07:46", not "posted"', [crew()[4], lineOf('review')]);
  push('hub/muse', { at: '2026-11-24T07:30:00Z', items: lane(2, 'muse-') }); push('hub/weekly', WEEKLY);
  // Decide's two documents: one left from yesterday must not hide behind the other
  push('hub/leo', { at: '2026-11-23T06:44:30Z', to: { name: 'A Colleague', slackId: 'U0AAAAAAA1' }, items: lane(7, 'leo-') });
  ok(same(crew()[1].slice(0, 2), ['decide', 'late']) && /^no result 07:43 · /.test(lineOf('decide')), 'hub/leo not rewritten today: Decide has no result from the 07:43 run, though hub/decisions is fresh', [crew()[1], lineOf('decide')]);
  push('hub/leo', { at: '2026-11-24T06:44:12Z', to: { name: 'A Colleague', slackId: 'U0AAAAAAA1' }, items: lane(7, 'leo-') });

  // a robot click really changes tab: the page's own click handler takes the chip's data-nav
  const today = stage().closest('section'), decide = $$('section').find((s) => s.id === 'decide'), leo = $$('section').find((s) => s.id === 'leo');
  const shown = () => [today, decide, leo].filter((s) => !s.hidden).map((s) => s.id).join();
  ok(shown() === 'today', 'the page opens on Today');
  const c0 = scene().crews.length;
  scene().opts.onPick('decide'); flush();
  ok(shown() === 'decide' && $$('[data-nav-item]').find((b) => b.dataset.nav === 'decide').getAttribute('aria-current') === 'page' && TYPE.links[TYPE.links.length - 1] === 'decide', 'a click on the Decide robot opens the Decide tab (a decision is open)', [shown(), TYPE.links.slice(-1)]);
  tickNow(); OS.docs.changed(); flush();
  ok(scene().crews.length === c0 && TYPE.thrown.length === 0, 'while Today is hidden the timer and the documents hand the scene nothing');
  stage()._w = 400; $$('[data-nav-item]').find((b) => b.dataset.nav === 'today').click(); TYPE.all();
  ok(shown() === 'today' && scene().crews.length === c0 + 1 && scene().log[scene().log.length - 1] === 'resize 400', 'back on Today the stage is drawn again, at its new width', scene().log.slice(-2));
  for (let i = 1; i < 10; i++) OS.lanes.answer('dec-' + i, i % 2 ? 'yes' : 'no');
  await tick(); flush();
  ok(same(crew()[1], ['decide', 'needs', 7]) && lineOf('decide') === '07:44 · 7 for Leo', 'every decision answered, seven items for Leo: the chip reads "07:44 · 7 for Leo"', [crew()[1], lineOf('decide')]);
  ok(same(FOUR.map(shownOf), ['113', null, '7', 'A headline.']) && numberOf('dec-badge').hidden === true, '... and the Decide tab shows no number: hidden at nothing, while Today and For Leo keep theirs', FOUR.map(shownOf));
  scene().opts.onPick('decide'); flush();
  ok(shown() === 'leo' && TYPE.links[TYPE.links.length - 1] === 'leo', '... and a click on the Decide robot now opens For Leo, not an empty Decide tab', [shown(), TYPE.links.slice(-2)]);
  $$('[data-nav-item]').find((b) => b.dataset.nav === 'today').click(); TYPE.all();
  scrolled.length = 0; scene().opts.onPick('desk'); flush();
  const hubPane = document.getElementById('hub-today');
  ok(shown() === 'today' && scrolled.some((x) => x.el === hubPane) && document.activeElement === hubPane && hubPane.getAttribute('tabindex') === '-1', 'a click on the Desk robot stays on Today, scrolls to the Hub pane and moves focus there', scrolled.map((x) => x.el.id || x.el.className));

  // Back on Today from another tab while a department's room is open. The type then draws what stands under Today in
  // the page's own order: the chips' lines before the lane. A chip's mark (ck-leads: a press goes to its cards) is
  // right at once all the same, because it is asked of the reader and not of the lane as it stands.
  {
    const tab = (id) => { $$('[data-nav-item]').find((b) => b.dataset.nav === id).click(); flush(); };
    const order = () => { const seen = []; $$('[data-draw]').forEach((e) => { if (/^ck-(line|lane)$/.test(e.dataset.draw) && !e.closest('[hidden]')) seen.push(e.dataset.draw); }); return seen.join(); };
    const now = () => [lineOf('sweeper'), chip('sweeper').classList.contains('ck-leads'), laneOf('hygiene').children.length];
    door('hygiene').click();
    ok(order() === 'ck-line,ck-line,ck-lane' && same(now(), ['Mon 06:50 · trial · 1 for you', true, 1]), 'Data Hygiene open: Sweeper has one card and its chip is marked; in the page\'s order the two chip lines come before the lane', [order(), now()]);
    tab('decide'); push('hub/sweeper', { ...SWEEP, at: '2026-11-24T05:50:30Z', items: [] }); // away: a new run, with nothing to show
    const hiddenStill = now();
    tab('today'); TYPE.all();
    ok(same(hiddenStill, ['Mon 06:50 · trial · 1 for you', true, 1]) && same(now(), ['06:50 · trial', false, 0]), 'a run with no items arrives while another tab is open (nothing is drawn under a hidden tab); back on Today the chip reads "06:50 · trial", its card is gone, and the chip is no longer marked as leading to one', [hiddenStill, now()]);
    tab('decide'); push('hub/sweeper', { ...SWEEP, at: '2026-11-24T08:05:30Z', items: [{ ...SWEEP.items[0], id: 'sw-new-1' }, { ...SWEEP.items[1], id: 'sw-new-2' }] }); // away again: two new items
    tab('today'); TYPE.all();
    ok(same(now(), ['09:05 · trial · 2 for you', true, 2]) && shown() === 'today', 'the other way round: two new items arrive while another tab is open; back on Today the chip has its two cards and is marked at once, not half a minute later', now());
    scrolled.length = 0; const led = scene().opts.onPick('sweeper'); flush();
    ok(led === true && scrolled.length === 1 && scrolled[0].el === laneOf('hygiene').children[0] && scrolled[0].el.dataset.ckOf === 'sweeper', '... and a press on it goes to the first of them', [led, scrolled.length]);
    push('hub/sweeper', SWEEP); door('mine').click();
  }

  // The tab numbers and the Hub's headline across a change of tab. The numbers' empty drawings stand in the tab row,
  // which is never hidden: a number follows whichever tab is open. The headline and its empty drawing stand under
  // Today: neither is drawn while another tab is open, and the headline is right when Today comes back.
  {
    const tab = (id) => { $$('[data-nav-item]').find((b) => b.dataset.nav === id).click(); flush(); };
    const now = () => FOUR.map(shownOf), head = numberOf('hub-brief') || new El('p');
    OS.lanes.answer('dec-1', null); await tick(); flush();
    ok(same(now(), ['113', '1', '7', 'A headline.']), 'one answer taken back: the Decide tab\'s number, which was hidden, shows again: 1', now());
    tab('decide'); push('hub/today', { ...TODAY, counts: { ...TODAY.counts, waiting: 5 }, brief: { headline: 'Another headline.' } });
    const away = [shownOf('hub-badge'), head.textContent, head.hidden];
    tab('today'); TYPE.all();
    ok(same(away, ['5', 'A headline.', false]) && same(now(), ['5', '1', '7', 'Another headline.']), 'a new summary arrives while Decide is open: the Today tab\'s number follows at once (5), the headline under the hidden Today is not drawn; back on Today it is the new headline', [away, now()]);
    tab('leo'); push('hub/today', { ...TODAY, counts: { ...TODAY.counts, waiting: 0 }, brief: {} });
    const none = shownOf('hub-badge');
    tab('today'); TYPE.all();
    ok(none === null && same(now(), [null, '1', '7', null]) && head.hidden === true, 'a summary with nothing waiting and no headline arrives while For Leo is open: the Today tab\'s number goes at once; back on Today the headline is hidden', [none, now()]);
    tab('decide'); push('hub/today', TODAY);
    const back = shownOf('hub-badge');
    tab('today'); TYPE.all();
    ok(back === '113' && same(now(), ['113', '1', '7', 'A headline.']) && head.hidden === false, 'the first summary again, arrived while Decide was open: the number is back at once and, on Today again, so is the headline (what was hidden comes back)', [back, now()]);
    // the order of the two on the page does not matter: the type draws what a drawing has just shown
    const slot = slotOf('hub-badge'), num = numberOf('hub-badge'), both = !!slot && !!num && slot !== num;
    if (both) slot.parentNode.insertBefore(num, slot);
    push('hub/today', { ...TODAY, counts: { ...TODAY.counts, waiting: 0 } }); const gone = [shownOf('hub-badge'), !!num && num.hidden];
    push('hub/today', TODAY);
    ok(both && same(gone, [null, true]) && shownOf('hub-badge') === '113' && TYPE.thrown.length === 0, 'with the number moved before its empty drawing it still goes at nothing and comes back', [both, gone, shownOf('hub-badge')]);
    if (both) slot.parentNode.insertBefore(slot, num);
    OS.lanes.answer('dec-1', 'yes'); await tick(); flush();
  }

  // the dashboard runs every script again when a file changes
  const n = scenes.length, DOCS = ['hub/today', 'hub/decisions', 'hub/leo', 'hub/instinct', 'hub/muse', 'hub/weekly', 'hub/pulse', U + 'hub-actions', U + 'sense-acts', U + 'decisions', U + 'leo-acts', U + 'os-done'].concat(DEPT_DOCS.map((id) => 'hub/' + id));
  ok(DOCS.length === 17 && DOCS.every((p) => live(p).length === 1), 'one live subscription to each of the seventeen documents: the twelve, and one for each department agent that writes a document', DOCS.map((p) => live(p).length));
  ok(same(DEPT_DOCS, RM.slice(1).flatMap((r) => r.agents).filter((a) => !a.missing).map((a) => a.id)) && live('hub/pacing').length + live('hub/rundown').length === 0, 'those five are the model\'s department agents but Pacing and Rundown, which post by themselves: nothing is read for those two', DEPT_DOCS);
  boot(); await tick(); await tick(); await tick(); await tick();
  ok(DOCS.every((p) => live(p).length === 1), 'every script run again: still one live subscription to each (the earlier run\'s were closed)', DOCS.map((p) => live(p).length));
  push('hub/today', TODAY); push('hub/decisions', { at: '2026-11-24T06:44:12Z', items: lane(10, 'dec-') }); push('hub/leo', { at: '2026-11-24T06:44:12Z', items: lane(7, 'leo-') });
  push('hub/instinct', { at: '2026-11-24T07:30:00Z', items: lane(3, 'ins-') }); push('hub/muse', { at: '2026-11-24T07:30:00Z', items: lane(2, 'muse-') }); push('hub/weekly', WEEKLY);
  for (const p of ['hub-actions', 'sense-acts', 'decisions', 'leo-acts']) push(U + p, null);
  TYPE.all();
  // this time the departments' documents are the last to answer: the first crew waits for them too
  const heldStill = () => scene().crew.length === 0 && IDS.every((id) => lineOf(id) === '—' && stateOf(chip(id)).length === 0) && ROOM_IDS.every((r) => countOf(r) === '' && pipsOf(r).every((x) => x === ''));
  ok(heldStill() && OS.hub.ready() && OS.sense.ready() && OS.lanes.ready(), 'the documents of his five and all his reactions have answered, the departments\' documents have not: the crew is still held, and the doors are bare', [scene().crew.length, ROOM_IDS.map(countOf)]);
  for (const id of DEPT_DOCS.slice(0, 4)) push('hub/' + id, undefined);
  ok(heldStill(), 'four of the five department documents have answered: still held');
  push('hub/prep', undefined);
  ok(timers.size === 1 && alive().length === 1 && scenes.length === n + 1, '... one timer and one scene', [timers.size, alive().length]);
  ok($$('[data-ck]').every((c) => c.heard('click') === 1 && c.heard('focus') === 1) && $$('[data-ck-door]').every((d) => d.heard('click') === 1) && docHeard('keydown') === 2 && winOn.length === 0, '... and still one cockpit listener of each kind, on the doors too (the document\'s two keydowns are the page\'s and the cockpit\'s)', [docHeard('keydown'), winOn.length]);
  ok(same(crew(), [['desk', 'needs', 113], ['decide', 'needs', 17], ['instinct', 'needs', 3], ['muse', 'needs', 2], ['review', 'idle', 0]]) && TYPE.thrown.length === 0, '... and the picture follows the documents as before', [crew(), TYPE.thrown.map(String)]);
  ok(same(FOUR.map(shownOf), ['113', '10', '7', 'A headline.']), '... and so do the tab numbers and the headline; the Decide one, hidden before the scripts ran again, shows 10', FOUR.map(shownOf));
  // His reactions to Instinct, Muse and the departments' items answer later than the 2.5 seconds the first crew is
  // held (every script is run once more). His own room is then shown with what is known. A department's room waits
  // on: its lane shows no card before his reactions, so its chips and its door do not count meanwhile (they would
  // count an item he has handled, over an empty lane).
  boot(); await tick(); await tick(); await tick(); await tick();
  push('hub/today', TODAY); push('hub/decisions', { at: '2026-11-24T06:44:12Z', items: lane(10, 'dec-') }); push('hub/leo', { at: '2026-11-24T06:44:12Z', items: lane(7, 'leo-') });
  push('hub/instinct', { at: '2026-11-24T07:30:00Z', items: lane(3, 'ins-') }); push('hub/muse', { at: '2026-11-24T07:30:00Z', items: lane(2, 'muse-') }); push('hub/weekly', WEEKLY);
  push('hub/sweeper', SWEEP); for (const id of DEPT_DOCS.slice(1)) push('hub/' + id, undefined);
  for (const p of ['hub-actions', 'decisions', 'leo-acts']) push(U + p, null);
  TYPE.all(); door('hygiene').click();
  advance(2500);
  const lateRoom = () => [DEPT.hygiene.map(lineOf).join('|'), laneOf('hygiene').children.length, countOf('hygiene'), pipsOf('hygiene').join(), saidBy(door('hygiene')), scene().crew.length, chip('sweeper').classList.contains('ck-leads')];
  const waitsOn = lateRoom(), mineShown = [countOf('mine'), pipsOf('mine').join()];
  push(U + 'sense-acts', { acts: { 'sw-2': { action: 'ack', at: '2026-11-23T08:00:00Z' } } });
  ok(OS.sense.items('sweeper').length === 2 && same(waitsOn, ['—|—', 0, '', ',', 'Data Hygiene, 2 agents', 0, false]) && same(mineShown, ['135', 'is-needs,is-needs,is-needs,is-needs,is-idle'])
    && same(lateRoom(), ['Mon 06:50 · trial · 1 for you|not run yet', 1, '1', 'is-needs,is-unknown', 'Data Hygiene, 2 agents, 1 waiting on you', 2, true]) && TYPE.thrown.length === 0,
    'his reactions answer later than the 2.5 seconds: his own door then counts what is known, while Data Hygiene, open, stays empty (chips at their dash, a bare door, no card); when they answer, Sweeper has its one card and counts 1, never 2', [waitsOn, mineShown, lateRoom()]);
  // What the drawings did to hidden in all of the above (every change was noted with the drawing that made it). A
  // drawing may hide its own element, but it is never run again to show it: each that did has an empty drawing of its
  // name to do that. None set hidden on an element it stands under.
  const byDraw = HID.filter((h) => h.by), own = byDraw.filter((h) => h.el === h.by), above = byDraw.filter((h) => h.el !== h.by && h.el.contains(h.by));
  ok(byDraw.length > 20 && own.length > 0 && above.length === 0 && own.every((h) => h.to && FOUR.includes(h.by.dataset.draw) && !!slotOf(h.by.dataset.draw)),
    'in this whole run no drawing set hidden on an element it stands under, and the only drawings that hid their own element are tab numbers, each of which has the empty drawing of its name to show it again', [byDraw.length, own.map((h) => h.by.dataset.draw), above.map((h) => h.by.dataset.draw)]);
  ok(byDraw.length > 20 && STRAY.length === 0, 'in this whole run no drawing wrote words or elements outside its own element (the type counts that as a fault and then no longer lets the page be edited by hand): a tab\'s number and the headline are written by their own drawings, not by the empty ones that show them',
    STRAY.slice(0, 6).map((w) => w.by.dataset.draw + ' wrote on ' + w.on.tagName + '.' + w.on.className));
  ok(same([...unsupported].filter((s) => !/\s/.test(s)), []), 'no selector the stand-in document could not read was needed by this run', [...unsupported]);
};

(async () => {
  if (REAL) { await realRun(); console.log(`\n${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0); }
  staticChecks();
  await standIns();
  // the child run prints its own lines; its count joins this one
  if (realModel()) {
    let out = '';
    try { out = execFileSync(process.execPath, [__filename, '--real'], { encoding: 'utf8', timeout: 120000 }); } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
    process.stdout.write(out.replace(/\n\d+ passed, \d+ failed\n?$/, '\n'));
    const m = out.match(/\n(\d+) passed, (\d+) failed\n?$/);
    if (m) { passes += +m[1]; fails += +m[2]; } else ok(false, 'the run with the real page scripts and the real model finishes', out.slice(-600));
  } else console.log('skip the run with the real page scripts and the real model: dashboard/os-cockpit-model.js is not there, or does not have lead, brief and overdue yet');
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.stack); process.exit(1); });
