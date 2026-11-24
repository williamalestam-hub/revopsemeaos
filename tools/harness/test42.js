// The cockpit on the page (Contract 4 of the cockpit spec): the stored page, the store, and the wiring.
//  1. The stored page keeps the type's one-writer rule: every data-draw element in dashboard/index.html is stored empty
//     (or a single —) and none sits inside another; the cockpit block is where and what the spec says.
//  2. The store: dashboard/build_store.py, run into a temporary folder, keeps every document under 262,144 bytes, holds
//     the four cockpit files, and stores index.html with only its indentation removed.
//  3. The wiring (dashboard/os-cockpit.js) against stand-ins for dash, OS, OSCrew and OSCockpit, on the real markup:
//     mount makes a canvas and a tooltip, update hands the scene the derived crew and resizes it, unmount destroys it;
//     the facts come from the page's modules as the spec says; chips get their line and class; a robot click clicks its
//     chip; the tooltip stays inside the stage and is text only; a hidden tab is left alone; a burst of changes is one
//     redraw, on settled facts; a second run of the script leaves one timer, one subscription to each document and one
//     listener of each kind; nothing uses innerHTML. Then the same wiring with the real model in place of its stand-in.
//  4. A child run (--real) with the real page scripts and the real model (when dashboard/os-cockpit-model.js is there):
//     documents like the ones the agents write, on a fake database, give the crew, the chips and the words of the spec's
//     own example, and a robot click really changes tab.
// Synthetic data only. Nothing here opens the dashboard or a browser.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
process.env.TZ = 'Europe/Stockholm'; // William's clock, so the times in words are stable wherever the suite runs
const REAL = process.argv.includes('--real');
const D = path.join(__dirname, '..', '..', 'dashboard') + path.sep;
const LIMIT = 262144;
const NOW = Date.parse('2026-11-24T12:50:00Z'); // a Tuesday, 13:50 in Stockholm
let later = 0; // minutes the test has let pass since NOW
{ const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW + later * 6e4])); } static now() { return NOW + later * 6e4; } static UTC(...a) { return RealDate.UTC(...a); } static parse(s) { return RealDate.parse(s); } }; }
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
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.attrs = new Map(); this.childNodes = []; this.parentNode = null; this._on = []; this.line = 0;
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
  get hidden() { return this.attrs.has('hidden'); } set hidden(v) { if (v) this.attrs.set('hidden', ''); else this.attrs.delete('hidden'); }
  get textContent() { return this.childNodes.map((n) => (n instanceof El ? n.textContent : n)).join(''); }
  set textContent(v) { this.replaceChildren(); if (String(v) !== '') this.childNodes.push(String(v)); }
  get innerHTML() { throw new Error('innerHTML was read'); } set innerHTML(v) { throw new Error('innerHTML was written'); }
  append(...nodes) { for (const n of nodes) { if (n instanceof El) { n.remove(); n.parentNode = this; this.childNodes.push(n); } else this.childNodes.push(String(n)); } }
  appendChild(n) { this.append(n); return n; }
  remove() { if (this.parentNode) { const i = this.parentNode.childNodes.indexOf(this); if (i >= 0) this.parentNode.childNodes.splice(i, 1); this.parentNode = null; } }
  replaceChildren(...nodes) { for (const c of this.children) c.parentNode = null; this.childNodes = []; this.append(...nodes.filter((n) => n != null)); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); } getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  removeAttribute(k) { this.attrs.delete(k); } hasAttribute(k) { return this.attrs.has(k); }
  matches(sel) { return parseSel(sel).some((t) => t(this)); }
  closest(sel) { for (let n = this; n instanceof El; n = n.parentNode) if (n.matches(sel)) return n; return null; }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  querySelectorAll(sel) { const tests = parseSel(sel), out = []; const walk = (n) => { for (const c of n.children) { if (tests.some((t) => t(c))) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
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
  focus() { document.activeElement = this; this.fire('focus'); }
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
  const text = (t) => { if (t) stack[stack.length - 1].childNodes.push(decode(t)); };
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
const IDS = ['desk', 'decide', 'instinct', 'muse', 'review'];

// ---------- the page's surroundings, shared by both runs ----------
const timers = new Map(), timeouts = new Map(); let timerId = 0;
const winOn = [];
global.window = global;
global.setInterval = (fn, every) => { timers.set(++timerId, { fn, every }); return timerId; };
global.clearInterval = (id) => { timers.delete(id); };
// timeouts wait until the test lets time pass: flush() runs what is due, in order
global.setTimeout = (fn, ms) => { timeouts.set(++timerId, { fn, ms: ms || 0 }); return timerId; };
global.clearTimeout = (id) => { timeouts.delete(id); };
const flush = () => { for (let n = 0; timeouts.size && n < 100; n++) { const [id, t] = [...timeouts].sort((a, b) => a[1].ms - b[1].ms)[0]; timeouts.delete(id); t.fn(); } };
global.addEventListener = (type, fn, opt) => { winOn.push({ type, fn, cap: opt === true || !!(opt && opt.capture) }); };
global.removeEventListener = (type, fn, opt) => { const cap = opt === true || !!(opt && opt.capture), i = winOn.findIndex((l) => l.type === type && l.fn === fn && l.cap === cap); if (i >= 0) winOn.splice(i, 1); };
let reducedMotion = false;
global.matchMedia = (q) => ({ matches: /prefers-reduced-motion/.test(q) ? reducedMotion : false });
global.devicePixelRatio = 2; global.innerHeight = 800; global.requestAnimationFrame = (f) => f();
global.location = { hash: '' };
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: () => Promise.resolve() } }, configurable: true, writable: true });
global.document = {
  _on: [], activeElement: null, hidden: false,
  createElement: (t) => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: (t) => String(t), createDocumentFragment: () => new El('#fragment'),
  querySelectorAll: (sel) => root.querySelectorAll(sel), querySelector: (sel) => root.querySelector(sel),
  getElementById: (id) => (id ? root.querySelectorAll('[id="' + id + '"]')[0] || null : null),
  addEventListener(type, fn) { if (!this._on.some((l) => l.type === type && l.fn === fn)) this._on.push({ type, fn }); },
  removeEventListener(type, fn) { const i = this._on.findIndex((l) => l.type === type && l.fn === fn); if (i >= 0) this._on.splice(i, 1); },
};
const docHeard = (type) => document._on.filter((l) => l.type === type).length, winHeard = (type) => winOn.filter((l) => l.type === type).length;
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
// the dashboard type's part in a drawing: no drawing under the hidden attribute; mount once, update at each call,
// unmount when the element leaves or a call throws; what a drawing throws is kept (the type reports it), not passed on. `again` is what it does with a mounted drawing when its name is
// registered a second time (a second run of the scripts): unmount it, keep what mount returned, or just forget it.
const TYPE = { reg: {}, mounted: new Map(), thrown: [], again: 'unmount', links: [] };
TYPE.one = (el) => {
  const name = el.dataset.draw, spec = TYPE.reg[name];
  if (!spec || el.closest('[hidden]')) return false;
  if (typeof spec === 'function') { try { spec(el); } catch (e) { TYPE.thrown.push(e); } return true; }
  let rec = TYPE.mounted.get(el);
  try {
    if (!rec) { el.replaceChildren(); rec = { name, made: spec.mount(el) }; TYPE.mounted.set(el, rec); }
    spec.update(el, rec.made);
  } catch (e) { TYPE.thrown.push(e); TYPE.mounted.delete(el); if (rec) { try { spec.unmount(el, rec.made); } catch (e2) { TYPE.thrown.push(e2); } } }
  return true;
};
TYPE.draw = (name, spec) => {
  if (spec !== undefined) {
    const had = TYPE.reg[name];
    if (had) for (const [el, rec] of [...TYPE.mounted]) if (rec.name === name && TYPE.again !== 'keep') { TYPE.mounted.delete(el); if (TYPE.again === 'unmount') had.unmount(el, rec.made); }
    TYPE.reg[name] = spec; return;
  }
  if (!TYPE.reg[name]) throw new Error('no drawing is registered as ' + name);
  drawings(name).forEach(TYPE.one);
};
TYPE.all = () => $$('[data-draw]').forEach(TYPE.one); // after the scripts, and when a hidden tab comes back
TYPE.leave = (el) => { const rec = TYPE.mounted.get(el); if (rec) { TYPE.mounted.delete(el); TYPE.reg[rec.name].unmount(el, rec.made); } };
const load = (f) => { delete require.cache[require.resolve(D + f)]; require(D + f); };

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

  // the cockpit block: the first thing on Today, the picture's slot, then the chips, the legend and the role sentences
  const today = $$('section').find((s) => s.id === 'today'), ck = today && today.children[0];
  ok(!!ck && ck.id === 'cockpit' && ck.classList.contains('pane') && ck.classList.contains('cockpit') && today.children[1].id === 'sense', 'the cockpit is the first child of the Today section, before the sense pane', today && today.children.slice(0, 2).map((c) => c.id));
  ok(drawings('cockpit').length === 1 && stage().parentNode === ck && stage().childNodes.length === 0 && !stage().closest('[hidden]'), 'one stage, stored quite empty, not under hidden');
  const chipEls = $$('[data-ck]');
  ok(same(chipEls.map((c) => c.dataset.ck), IDS) && chipEls.every((c) => c.tagName === 'BUTTON' && c.getAttribute('type') === 'button' && ck.contains(c)), 'five chips, one per agent, in desk order, each a button', chipEls.map((c) => c.dataset.ck));
  ok(chipEls.every((c) => c.children.filter((x) => x.tagName === 'B').length === 1 && c.children.find((x) => x.tagName === 'B').textContent.trim().length > 0 && c.children.find((x) => x.tagName === 'B').textContent.trim().length <= 12), 'each chip holds its agent\'s name in one <b>, at most 12 characters', chipEls.map((c) => c.textContent));
  ok(chipEls.every((c) => { const l = c.querySelectorAll('[data-draw]'); return l.length === 1 && l[0].dataset.draw === 'ck-line' && l[0].dataset.ckId === c.dataset.ck && l[0].textContent === '—'; }), 'each chip holds one ck-line drawing for its own agent, stored as —');
  const SCREENS = $$('[data-nav-item]').map((b) => b.dataset.nav);
  ok(chipEls.every((c) => !c.dataset.nav || SCREENS.includes(c.dataset.nav)) && chipEls.every((c) => !c.dataset.ckGo || (today.querySelectorAll('[id="' + c.dataset.ckGo + '"]').length === 1 && c.dataset.nav === 'today')), 'a chip\'s data-nav is a tab, and its data-ck-go an element of Today', chipEls.map((c) => [c.dataset.nav, c.dataset.ckGo]));
  const roles = $$('[data-ck-role]');
  ok(same(roles.map((r) => r.dataset.ckRole), IDS) && roles.every((r) => r.textContent.trim().length > 10 && r.closest('[hidden]') && ck.contains(r) && !r.closest('[data-draw]')), 'one role sentence per agent, in the HTML, kept hidden', roles.map((r) => r.dataset.ckRole));
  const help = $$('[data-ck-help]'), legend = help.length === 1 ? $$('[id="' + help[0].getAttribute('aria-controls') + '"]') : [];
  ok(help.length === 1 && help[0].getAttribute('aria-expanded') === 'false' && !!help[0].getAttribute('aria-label') && legend.length === 1 && legend[0].hidden && legend[0].textContent.trim().length > 20 && ck.contains(legend[0]), 'the ? button controls one legend sentence, stored hidden');
  ok($$('.ck-strip').length === 1 && !!$$('.ck-strip')[0].getAttribute('aria-label'), 'the chips are one labelled list');

  // the styles: the cockpit's own selectors, the page's own tokens, nothing that needs a fixed width
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(?:media|container)[^{]*\{/g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean).flatMap((s) => s.split(',').map((x) => x.trim()));
  ok(selectors.length > 10 && selectors.every((s) => /^\.(cockpit|ck-)/.test(s)), 'os-cockpit.css: every selector starts with .cockpit or .ck-', selectors.filter((s) => !/^\.(cockpit|ck-)/.test(s)));
  ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(css) && /var\(--color-fg\)/.test(css) && /var\(--color-fg-muted\)/.test(css) && /var\(--color-panel\)/.test(css) && /var\(--line\)/.test(css) && /var\(--r\)/.test(css), 'os-cockpit.css: colours and corners come from the page\'s tokens, none is written out');
  ok(/\.ck-canvas\s*\{[^}]*display:\s*block/.test(css) && /\.ck-strip\s*\{[^}]*flex-wrap:\s*wrap/.test(css) && /:focus-visible\s*\{[^}]*outline:/.test(css) && !/[^-]width:\s*\d+px/.test(css.replace(/min-width|max-width/g, '')), 'os-cockpit.css: the canvas is a block, the chips wrap, focus shows, and nothing has a fixed pixel width');
  ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.html\(|createContextualFragment|DOMParser|eval\(|new Function/.test(wiring), 'os-cockpit.js writes no HTML: no innerHTML, outerHTML, insertAdjacentHTML, document.write');
  ok(!/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|import\(|\bawait\b(?![^\n]*\buse\('db'\))/.test(wiring.replace(/\/\/[^\n]*/g, '')), 'os-cockpit.js keeps nothing in the browser and calls no other host; its one await is claude.use(\'db\')');

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
    const flat = (n) => (n instanceof El ? '<' + n.tagName + [...n.attrs].map(([k, v]) => ' ' + k + '=' + v).join('') + '>' + n.childNodes.map(flat).join('') : n.replace(/\s+/g, ' '));
    ok(flat(again.root) === flat(root), 'read back, the stored page has the same elements, attributes and words as the source');
    const builder = fs.readFileSync(D + 'build_store.py', 'utf8');
    ok(/LIMIT = 262144\b/.test(builder) && /if size > LIMIT: over\.append/.test(builder) && /sys\.exit\(f'\{len\(over\)\}/.test(builder), 'build_store.py fails when a document is over 262,144 bytes');
  }
  fs.rmSync(out, { recursive: true, force: true });
};

// =====================================================================================================================
// ---- 3. the wiring against stand-ins ----
const standIns = async () => {
  // the page's modules, as the wiring reads them
  const H = { state: 'loading', doc: null, acted: {} };
  const SN = { state: { instinct: 'loading', muse: 'loading' }, docs: { instinct: null, muse: null }, acted: {} };
  const LN = { state: { decisions: 'loading', leo: 'loading' }, docs: { decisions: null, leo: null }, answered: {}, leoActed: {} };
  // OS.docs: fire() is one change; changed() is a change and then the end of its burst (time passes)
  const bus = (() => { const fns = new Set(), fire = () => [...fns].forEach((fn) => fn()); return { on: (fn) => { fns.add(fn); return () => { fns.delete(fn); }; }, fire, changed: () => { fire(); flush(); }, size: () => fns.size }; })();
  const items = (d) => (d && Array.isArray(d.items) ? d.items : []);
  const osStandIn = {
    hub: { state: () => H.state, doc: () => H.doc, counts: () => (H.doc && H.doc.counts && typeof H.doc.counts === 'object' ? H.doc.counts : null), top: () => (H.doc && Array.isArray(H.doc.top) ? H.doc.top : []), acted: (id) => H.acted[id] || null },
    sense: { state: (k) => SN.state[k], doc: (k) => SN.docs[k], items: (k) => items(SN.docs[k]), acted: (id) => SN.acted[id] || null },
    lanes: { state: (k) => LN.state[k], doc: (k) => LN.docs[k], items: (k) => items(LN.docs[k]), answered: (id) => LN.answered[id] || null, leoActed: (id) => LN.leoActed[id] || null },
    docs: bus,
  };
  // the model: says what it was handed, and answers something that follows the facts
  const model = { calls: [], outs: [], fail: false };
  const modelStandIn = { derive(facts, now, names) {
    model.calls.push({ facts: JSON.parse(JSON.stringify(facts)), now, names: { ...names } });
    if (model.fail) throw new Error('the model threw');
    const out = { crew: [], lines: {}, tips: {}, aria: '', total: 0 };
    for (const id of IDS) {
      const f = facts[id] || {}, p = (facts.pulse || {})[id];
      const state = f.src !== 'ok' ? 'unknown' : p && p.state === 'running' ? 'working' : f.status === 'failed' ? 'error' : f.waiting > 0 ? 'needs' : 'idle';
      out.crew.push({ id, name: names[id] || id, look: 'plain', hue: 'teal', state, waiting: f.waiting || 0, step: (p && p.step) || '', bubble: '', fresh: 0 });
      out.lines[id] = f.src === 'loading' ? '' : state + ' ' + (f.waiting || 0);
      out.tips[id] = { state: 'Now: ' + state, last: f.at ? 'Last result ' + f.at : '', next: 'Next run soon' };
      if (state === 'needs') out.total += f.waiting;
    }
    out.aria = out.crew.map((a) => a.name + ': ' + a.state + '.').join(' ');
    model.last = out; model.outs.push(out);
    return out;
  } };
  const facts = () => model.calls[model.calls.length - 1].facts;
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
      if (threw || Object.keys(TYPE.reg).length || timers.size || timeouts.size || DB.subs.length || winOn.length || docHeard('keydown') || $$('[data-ck]').some((c) => c._on.length) || bus.size()) quiet.push(k + (threw ? ': ' + threw.message : ''));
      global[k] = parts[k];
    }
    ok(quiet.length === 0, 'without dash, OS, OSCrew or OSCockpit the script leaves quietly: no throw, drawing, timer, subscription or listener', quiet);
  }

  // ---- the first run ----
  load('os-cockpit.js');
  ok(typeof TYPE.reg.cockpit === 'object' && ['mount', 'update', 'unmount'].every((k) => typeof TYPE.reg.cockpit[k] === 'function') && typeof TYPE.reg['ck-line'] === 'function', 'registers the cockpit drawing as { mount, update, unmount } and ck-line as a function', Object.keys(TYPE.reg));
  ok(timers.size === 0 && scenes.length === 0, 'the script itself starts no timer and no scene: both belong to the drawing');
  await tick(); await tick();
  ok(DB.uses === 1 && same(DB.subs.map((s) => s.p).sort(), ['hub/pulse', 'hub/weekly']) && DB.subs.every((s) => s.live && typeof s.error === 'function'), 'one claude.use(\'db\'), one subscription to hub/weekly and one to hub/pulse, each with an error callback', [DB.uses, DB.subs.map((s) => s.p)]);
  ok(bus.size() === 1, 'listens once on OS.docs', bus.size());
  const heardOnce = () => $$('[data-ck]').every((c) => ['mouseenter', 'mouseleave', 'focus', 'blur', 'click'].every((t) => c.heard(t) === 1)) && $$('[data-ck-help]').every((b) => b.heard('click') === 1) && docHeard('keydown') === 1 && winHeard('scroll') === 1;
  ok(heardOnce(), 'one listener of each kind on each chip and on the ? button, one keydown on the document, one scroll on the window');

  // ---- mount and the first update ----
  H.state = 'ok'; H.doc = { at: '2026-11-24T12:16:30Z', lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, counts: { waiting: 113, critical: 1 }, top: [{ id: 'a', status: 'waiting' }, { id: 'b', status: 'new' }, { id: 'c', status: 'prepared' }] };
  TYPE.all();
  const s1 = scene(), st = stage();
  ok(TYPE.thrown.length === 0 && scenes.length === 1, 'the drawing runs without a throw and makes one scene', TYPE.thrown.map(String));
  const canvas = st.children.find((c) => c.tagName === 'CANVAS'), tip = st.children.find((c) => c.tagName !== 'CANVAS');
  ok(st.children.length === 2 && !!canvas && canvas.getAttribute('role') === 'img' && s1.canvas === canvas, 'mount puts one canvas (role="img") in the stage and gives it to the scene', st.children.map((c) => c.tagName));
  ok(!!tip && tip.hidden === true && tip.parentNode === st, 'mount puts the tooltip inside the stage too, hidden');
  ok(typeof s1.opts.now === 'function' && s1.opts.now() === NOW && Number.isFinite(s1.opts.seed) && s1.opts.reducedMotion === false && typeof s1.opts.onHover === 'function' && typeof s1.opts.onPick === 'function', 'the scene gets now(), a numeric seed, reducedMotion and the two callbacks', Object.keys(s1.opts));
  ok(same(s1.log, ['setCrew', 'resize 600', 'start']), 'the first call hands the scene its crew, then its width, and starts it (once it has both, as in the preview)', s1.log);
  ok(timers.size === 1 && [...timers.values()][0].every === 30000, 'mount starts one 30-second timer', [...timers.values()].map((t) => t.every));
  ok(s1.crew.length === 5 && s1.crew.every((a, i) => a === model.outs[0].crew[i]) && model.outs.length === 6, 'update hands the scene the very crew the model derived (one derive for the stage, one for each chip line)', model.outs.length);
  ok(canvas.getAttribute('aria-label') === model.last.aria && /Desk: needs\./.test(model.last.aria), 'update sets the canvas\'s aria-label to the model\'s sentence', canvas.getAttribute('aria-label'));
  ok(model.calls.every((c) => c.now === NOW) && same(model.calls[0].names, { desk: 'Desk', decide: 'Decide', instinct: 'Instinct', muse: 'Muse', review: 'Review' }), 'derive gets the clock and the names read from the chips', model.calls[0].names);

  // ---- the chips: line and class ----
  const lineOf = (id) => drawings('ck-line').find((e) => e.dataset.ckId === id).textContent;
  ok(lineOf('desk') === 'needs 113' && same(stateOf(chip('desk')), ['is-needs']), 'a chip gets the model\'s line and one state class', [lineOf('desk'), stateOf(chip('desk'))]);
  ok(IDS.slice(1, 4).every((id) => lineOf(id) === '—' && same(stateOf(chip(id)), ['is-unknown'])), 'an agent whose document is still loading keeps the — and reads unknown', IDS.map((id) => [lineOf(id), stateOf(chip(id))]));
  ok(drawings('ck-line').every((e) => e.children.length === 0) && $$('[data-ck]').every((c) => c.children.filter((x) => x.tagName === 'B').length === 1 && c.children.length === 3), 'the ck-line drawing writes text in its own element and nothing else in the chip');

  // ---- the facts, from the page's modules ----
  ok(same(facts().desk, { src: 'ok', at: '2026-11-24T12:15:58Z', status: 'ok', waiting: 113 }), 'desk: the Hub\'s state, its last run\'s time and status, and the count waiting', facts().desk);
  ok(same(facts().review, { src: 'loading', at: null, status: '', waiting: 0 }) && facts().pulse === null && facts().decide.src === 'loading' && facts().instinct.src === 'loading', 'before their first snapshot the other agents read as loading, and there is no pulse', facts());
  H.acted = { a: { action: 'done' }, c: { action: 'done' } }; bus.changed();
  ok(facts().desk.waiting === 112 && lineOf('desk') === 'needs 112', 'desk: an item William has just handled on this tab leaves the count at once, as it does on the "Needs you" tile (a prepared one does not count twice)', facts().desk);
  H.acted = {}; H.doc = { at: '2026-11-24T12:16:30Z', counts: { waiting: 'many' }, lastRun: 'yesterday', top: 'none' }; bus.changed();
  ok(TYPE.thrown.length === 0 && same(facts().desk, { src: 'ok', at: '2026-11-24T12:16:30Z', status: '', waiting: 0 }), 'desk: without a last run the document\'s own time stands in; a count that is not a number is 0; nothing throws', [facts().desk, TYPE.thrown.map(String)]);
  H.state = 'missing'; H.doc = null; bus.changed();
  ok(same(facts().desk, { src: 'missing', at: null, status: '', waiting: 0 }) && lineOf('desk') === 'unknown 0' && same(stateOf(chip('desk')), ['is-unknown']), 'desk: no document: missing, and the chip\'s class changes with it (one class, never two)', [facts().desk, stateOf(chip('desk'))]);
  H.state = 'ok'; H.doc = { lastRun: { at: '2026-11-24T12:15:58Z', status: 'failed' }, counts: { waiting: 4 } }; bus.changed();
  ok(facts().desk.status === 'failed' && same(stateOf(chip('desk')), ['is-error']), 'desk: a failed run reaches the model as failed', facts().desk);
  H.doc = { lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, counts: { waiting: 113 }, top: [] }; bus.changed();

  LN.state = { decisions: 'ok', leo: 'ok' };
  LN.docs = { decisions: { at: '2026-11-24T06:44:12Z', items: Array.from({ length: 10 }, (_, i) => ({ id: 'd' + i })) }, leo: { at: '2026-11-24T06:45:40Z', items: Array.from({ length: 7 }, (_, i) => ({ id: 'l' + i })) } };
  bus.changed();
  ok(same(facts().decide, { src: 'ok', at: '2026-11-24T06:45:40Z', status: '', waiting: 17, parts: [{ n: 10, word: 'decisions' }, { n: 7, word: 'for Leo' }] }), 'decide: both documents, the later of their two times, decisions and Leo items together, with the parts', facts().decide);
  LN.answered = { d0: { answer: 'yes' }, d1: { answer: 'no' } }; LN.leoActed = { l0: { action: 'done' } }; bus.changed();
  ok(facts().decide.waiting === 14 && same(facts().decide.parts, [{ n: 8, word: 'decisions' }, { n: 6, word: 'for Leo' }]), 'decide: what William has answered or handled no longer waits', facts().decide);
  LN.answered = Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['d' + i, { answer: 'yes' }])); bus.changed();
  ok(same(facts().decide.parts[0], { n: 1, word: 'decision' }), 'decide: one decision is "1 decision"', facts().decide.parts);
  LN.answered = {}; LN.leoActed = {};
  const srcOf = (a, b) => { LN.state = { decisions: a, leo: b }; bus.changed(); return facts().decide.src; };
  ok(srcOf('ok', 'loading') === 'loading' && srcOf('loading', 'missing') === 'loading' && srcOf('error', 'ok') === 'error' && srcOf('ok', 'nodb') === 'nodb' && srcOf('error', 'nodb') === 'error' && srcOf('missing', 'missing') === 'missing' && srcOf('ok', 'ok') === 'ok',
    'decide: the worse of its two documents decides (can\'t be read, then still loading)');
  ok(srcOf('ok', 'missing') === 'ok' && srcOf('missing', 'ok') === 'ok', 'decide: with one document there and the other never written, the task has run (ok, counting what is there)');
  LN.docs.leo = { at: 'soon', items: [] }; LN.state = { decisions: 'ok', leo: 'ok' }; bus.changed();
  ok(facts().decide.at === '2026-11-24T06:44:12Z' && facts().decide.waiting === 10, 'decide: a time that is not a time is passed over', facts().decide);

  SN.state = { instinct: 'ok', muse: 'error' };
  SN.docs = { instinct: { at: '2026-11-24T07:30:00Z', items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }] }, muse: null };
  SN.acted = { i2: { action: 'ack' } }; bus.changed();
  ok(same(facts().instinct, { src: 'ok', at: '2026-11-24T07:30:00Z', status: '', waiting: 2 }) && same(facts().muse, { src: 'error', at: null, status: '', waiting: 0 }), 'instinct and muse: their state, their time, and the items William has not reacted to', [facts().instinct, facts().muse]);

  // ---- review and pulse: the wiring's own two subscriptions ----
  const before = model.calls.length;
  push('hub/weekly', { at: '2026-11-23T06:46:19Z', week: '2026-11-23', parent: 'words the page never shows' });
  ok(model.calls.length > before && same(facts().review, { src: 'ok', at: '2026-11-23T06:46:19Z', status: '', waiting: 0 }) && lineOf('review') === 'idle 0', 'review: a snapshot of hub/weekly redraws; only its time is taken', facts().review);
  push('hub/weekly', undefined);
  ok(same(facts().review, { src: 'missing', at: null, status: '', waiting: 0 }), 'review: no document yet is missing', facts().review);
  fail('hub/weekly');
  ok(facts().review.src === 'error', 'review: a subscription error is error', facts().review);
  push('hub/weekly', { at: '2026-11-23T06:46:19Z' });
  push('hub/pulse', { agents: { desk: { state: 'running', startedAt: '2026-11-24T12:45:00Z', finishedAt: null, step: 'Reading Slack' } }, at: '2026-11-24T12:45:00Z' });
  ok(same(facts().pulse, { desk: { state: 'running', startedAt: '2026-11-24T12:45:00Z', finishedAt: null, step: 'Reading Slack' } }) && same(stateOf(chip('desk')), ['is-working']) && scene().crew[0].state === 'working', 'pulse: the agents field of hub/pulse reaches the model, and the scene', facts().pulse);
  push('hub/pulse', { agents: 'nobody' });
  ok(facts().pulse === null, 'pulse: a document without an agents object is no pulse', facts().pulse);
  push('hub/pulse', { agents: { desk: { state: 'running' } } }); fail('hub/pulse');
  ok(facts().pulse === null, 'pulse: an error is no pulse', facts().pulse);
  push('hub/pulse', undefined);
  ok(facts().pulse === null && same(stateOf(chip('desk')), ['is-needs']), 'pulse: the document may not exist', facts().pulse);

  // ---- redraws: the bus, the timer, and width ----
  {
    const n = model.calls.length, c = s1.crews.length;
    bus.fire(); bus.fire(); live('hub/pulse').forEach((s) => s.next(snapOf('hub/pulse', undefined))); bus.fire();
    ok(model.calls.length === n && timeouts.size === 1 && [...timeouts.values()][0].ms === 150, 'a burst of changes (documents, then reactions to them) waits: nothing is redrawn yet, one short timeout is pending', [model.calls.length - n, [...timeouts.values()].map((t) => t.ms)]);
    // mid-burst the dashboard may call the drawings itself (a dataset loaded): they keep to the last settled facts
    SN.acted = { i1: { action: 'ack' }, i2: { action: 'ack' }, i3: { action: 'ack' } };
    TYPE.all();
    ok(model.calls.length === n && s1.crews.length === c + 1 && s1.crew[2].state === 'needs' && drawings('ck-line').find((e) => e.dataset.ckId === 'instinct').textContent === 'needs 2', 'a drawing called in the middle of a burst keeps to the facts as they were before it: no robot sets off on half the news', [model.calls.length - n, s1.crew[2]]);
    flush();
    ok(model.calls.length === n + 6 && s1.crews.length === c + 2 && s1.crew[2].state === 'idle' && timeouts.size === 0, '... then both drawings run again once, on all of it: the stage, and the five chip lines', [model.calls.length - n, s1.crews.length - c, s1.crew[2]]);
    SN.acted = { i2: { action: 'ack' } }; bus.changed();
    const n2 = model.calls.length, c2 = s1.crews.length;
    bus.fire(); later = 1; bus.fire(); later = 0;
    ok(model.calls.length === n2 + 6 && s1.crews.length === c2 + 1 && timeouts.size === 0, 'changes that never pause do not hold the picture for ever: after a second and a half it is drawn anyway', [model.calls.length - n2, timeouts.size]);
    const n3 = model.calls.length, c3 = s1.crews.length;
    [...timers.values()][0].fn();
    ok(model.calls.length === n3 + 6 && s1.crews.length === c3 + 1, 'the 30-second timer reruns both drawings too, at once', [model.calls.length - n3, s1.crews.length - c3]);
    ok(s1.log.filter((l) => /^resize/.test(l)).length === 1, 'the same width is not resized again', s1.log.filter((l) => /^resize/.test(l)));
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
    bus.changed(); [...timers.values()][0].fn();
    ok(s1.crews.length === c && s1.log.filter((l) => /^resize/.test(l)).length === r && TYPE.thrown.length === 0, 'while Today is hidden nothing is handed to the scene and nothing throws');
    today.hidden = false; st._w = 888; TYPE.all();
    ok(s1.crews.length === c + 1 && s1.log[s1.log.length - 1] === 'resize 888' && scenes.length === 1, 'when Today comes back, update runs: the crew again and the new width, on the same scene', s1.log.slice(-2));
    st._w = 600; TYPE.one(st);
  }

  // ---- the tooltip ----
  {
    const texts = () => tip.children.flatMap((c) => (c.children.length ? c.children : [c]).map((x) => x.tagName + ' ' + x.textContent));
    s1.anchors.desk = { x: 300, y: 100 };
    s1.opts.onHover('desk');
    ok(tip.hidden === false && same(texts(), ['B Desk', 'SPAN Prepares replies and next steps from Slack, mail and meetings.', 'SPAN Now: needs', 'SPAN Last result 2026-11-24T12:15:58Z', 'SPAN Next run soon']), 'pointing at a robot shows its name, the role sentence from the HTML and the model\'s three lines', texts());
    ok(tip.style.left === '220px' && tip.style.top === '16px', 'the tooltip sits above the robot\'s head, centred on it', [tip.style.left, tip.style.top]);
    ok(canvas.style.cursor === 'pointer', 'a robot whose chip leads somewhere shows the pointer cursor', canvas.style.cursor);
    s1.opts.onHover(null);
    ok(tip.hidden === true && canvas.style.cursor === '', 'leaving the robot hides the tooltip');
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
    winOn.filter((l) => l.type === 'scroll').forEach((l) => l.fn({}));
    ok(tip.hidden === true, 'a scroll hides the tooltip');
    bus.changed();
    ok(tip.hidden === true, '... and the next redraw leaves it hidden');
    s1.opts.onHover('desk'); document._on.filter((l) => l.type === 'keydown').forEach((l) => l.fn({ key: 'a' }));
    const stays = tip.hidden === false; document._on.filter((l) => l.type === 'keydown').forEach((l) => l.fn({ key: 'Escape' }));
    ok(stays && tip.hidden === true, 'Escape hides the tooltip; another key does not');
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
    ok(facts().names === undefined && model.calls[model.calls.length - 1].names.muse === '<img src=x> Muse' && tip.children[0].textContent === '<img src=x> Muse' && tip.querySelectorAll('img').length + tip.querySelectorAll('b').length === 1 && st.querySelectorAll('img').length === 0,
      'a renamed chip renames the robot and its tooltip; what looks like markup stays text', [model.calls[model.calls.length - 1].names.muse, texts()]);
    b.textContent = was; push('hub/pulse', undefined); s1.opts.onHover(null);
    s1.opts.onHover('nobody');
    ok(tip.hidden === true || tip.children.every((c) => c.textContent.length > 0), 'an id the page does not know shows nothing empty');
    s1.opts.onHover(null);
  }

  // ---- a robot click is a click on its chip ----
  {
    shell.length = 0; clicks.length = 0; scrolled.length = 0;
    s1.opts.onHover('decide'); s1.opts.onPick('decide');
    ok(clicks.length === 1 && clicks[0] === chip('decide') && same(shell, ['decide']) && tip.hidden === true, 'a click on the Decide robot clicks the Decide chip, which the page\'s own handler takes to its tab; the tooltip goes', [clicks.length, shell]);
    flush();
    ok(scrolled.length === 0, 'a chip without data-ck-go scrolls nothing');
    s1.opts.onPick('desk');
    ok(same(shell, ['decide', 'today']) && scrolled.length === 0, 'the Desk chip asks for Today first; the scroll waits for the page\'s handler', [shell, scrolled.length]);
    flush();
    ok(scrolled.length === 1 && scrolled[0].el.id === 'hub-today' && scrolled[0].o.block === 'start' && /app-tabs-h/.test(scrolled[0].el.style.scrollMarginTop || ''), '... then its data-ck-go element scrolls into view, clear of the sticky tab strip', scrolled.map((x) => [x.el.id, x.o]));
    reducedMotion = true; s1.opts.onPick('instinct'); flush(); reducedMotion = false;
    ok(scrolled.length === 2 && scrolled[1].el.id === 'sense' && scrolled[1].o.behavior === 'auto' && scrolled[0].o.behavior === 'smooth', 'the scroll glides, unless the viewer asked for reduced motion', scrolled.map((x) => x.o.behavior));
    s1.opts.onPick('review'); s1.opts.onPick('nobody'); s1.opts.onPick(null); flush();
    ok(same(clicks.map((c) => c.dataset.ck), ['decide', 'desk', 'instinct', 'review']) && same(shell.slice(3), [null]) && scrolled.length === 2 && TYPE.thrown.length === 0, 'the Review chip leads nowhere; an unknown id clicks nothing', [clicks.map((c) => c.dataset.ck), shell]);
    const hid = document.getElementById('hub-today').closest('section'); hid.hidden = true; s1.opts.onPick('desk'); flush(); hid.hidden = false;
    ok(scrolled.length === 2, 'nothing scrolls to an element under a hidden tab');
  }

  // ---- chips light up their robot; the ? button opens the legend ----
  {
    s1.focus.length = 0;
    chip('muse').fire('mouseenter'); chip('muse').fire('mouseleave');
    ok(same(s1.focus, ['muse', null]), 'pointing at a chip calls setFocus(id), leaving it setFocus(null)', s1.focus);
    s1.focus.length = 0; chip('desk').focus();
    ok(same(s1.focus, ['desk']) && tip.hidden === true, 'focus on a chip calls setFocus(id); a click\'s focus shows no tooltip', s1.focus);
    chip('muse').fire('mouseenter'); chip('muse').fire('mouseleave');
    ok(same(s1.focus, ['desk', 'muse', 'desk']), 'the pointer leaving another chip gives the highlight back to the focused one', s1.focus);
    chip('desk').blur();
    ok(s1.focus[s1.focus.length - 1] === null, 'blur calls setFocus(null)', s1.focus);
    chip('review')._focusVisible = true; chip('review').focus();
    ok(tip.hidden === false && tip.children[0].textContent === 'Review' && /Posts the Monday performance review/.test(tip.textContent), 'reached with the keyboard, a chip shows its robot\'s tooltip, so its words are not for the pointer alone', tip.textContent);
    chip('review').blur(); chip('review')._focusVisible = false;
    ok(tip.hidden === true, '... and blur hides it');
    const help = $$('[data-ck-help]')[0], legend = document.getElementById(help.getAttribute('aria-controls'));
    help.click();
    const open = legend.hidden === false && help.getAttribute('aria-expanded') === 'true';
    help.click();
    ok(open && legend.hidden === true && help.getAttribute('aria-expanded') === 'false', 'the ? button shows the legend and says so in aria-expanded; a second click hides it');
  }

  // ---- unmount, and a throw ----
  {
    TYPE.leave(st);
    ok(s1.destroyed === 1 && timers.size === 0, 'unmount destroys the scene and clears the timer', [s1.destroyed, timers.size]);
    bus.changed();
    ok(scenes.length === 2 && scene() !== s1 && timers.size === 1 && same(scene().log, ['setCrew', 'resize 600', 'start']) && st.children.filter((c) => c.tagName === 'CANVAS').length === 1, 'the next call mounts afresh: one canvas, one scene (started once), one timer', [scenes.length, timers.size, scene().log]);
    bus.changed(); [...timers.values()][0].fn();
    ok(scene().log.filter((l) => l === 'start').length === 1, 'later updates do not start the scene again', scene().log);
    model.fail = true; bus.changed(); model.fail = false;
    ok(TYPE.thrown.length === 6 && TYPE.thrown.every((e) => /the model threw/.test(e.message)) && scene().destroyed === 1 && timers.size === 0, 'a throw in the model is not swallowed: the dashboard hears it and unmounts, which destroys the scene and clears the timer', [TYPE.thrown.length, scene().destroyed, timers.size]);
    TYPE.thrown.length = 0; bus.changed();
    ok(scenes.length === 3 && timers.size === 1 && scene().destroyed === 0 && TYPE.thrown.length === 0, '... and the next call starts again');
  }

  // ---- a second run of the script, as the dashboard does when a file changes ----
  for (const again of ['unmount', 'keep', 'forget']) {
    TYPE.again = again;
    const old = scene(), n = scenes.length, help = $$('[data-ck-help]')[0], legend = document.getElementById(help.getAttribute('aria-controls'));
    bus.fire(); // a change is pending when the script runs again
    load('os-cockpit.js');
    ok(old.destroyed >= 1 && timers.size === 0 && timeouts.size === 0 && live('hub/weekly').length + live('hub/pulse').length === 0 && bus.size() === 1, 'second run (' + again + '): the earlier run\'s scene, timer, pending redraw, subscriptions and bus listener are gone before the new ones exist', [old.destroyed, timers.size, timeouts.size, live('hub/weekly').length, bus.size()]);
    await tick(); await tick();
    TYPE.all(); bus.changed(); push('hub/weekly', { at: '2026-11-23T06:46:19Z' });
    ok(timers.size === 1 && scenes.length === n + 1 && scene().destroyed === 0 && scenes.filter((s) => !s.destroyed).length === 1, 'second run (' + again + '): one timer and one scene alive', [timers.size, scenes.length - n, scenes.filter((s) => !s.destroyed).length]);
    ok(live('hub/weekly').length === 1 && live('hub/pulse').length === 1, 'second run (' + again + '): one subscription to each document', [live('hub/weekly').length, live('hub/pulse').length]);
    ok(heardOnce() && bus.size() === 1, 'second run (' + again + '): still one listener of each kind', [docHeard('keydown'), winHeard('scroll'), chip('desk').heard('click')]);
    ok(stage().children.filter((c) => c.tagName === 'CANVAS').length === 1 && stage().children.length === 2 && same(stateOf(chip('desk')), ['is-needs']) && facts().review.src === 'ok', 'second run (' + again + '): one canvas in the stage, and the chips still follow the facts', stage().children.map((c) => c.tagName));
    help.click();
    ok(legend.hidden === false, 'second run (' + again + '): one click on ? still opens the legend (two listeners would close it again)');
    help.click();
    clicks.length = 0; scene().opts.onPick('decide');
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
    ok(timers.size === 1 && scenes.filter((s) => !s.destroyed).length === 1, '... and one timer and one scene');
  }

  // ---- no database ----
  for (const [what, c] of [['claude.use(\'db\') gives null', { use: async () => null }], ['there is no window.claude', undefined], ['claude.use throws', { use: async () => { throw new Error('no bridge'); } }]]) {
    global.claude = c; load('os-cockpit.js'); await tick(); await tick(); flush(); TYPE.all();
    ok(TYPE.thrown.length === 0 && facts().review.src === 'nodb' && facts().pulse === null && timers.size === 1, 'when ' + what + ': review reads nodb, no pulse, and the picture still draws', [facts().review, TYPE.thrown.map(String)]);
  }
  global.claude = claudeWithDb;
  // a page without the cockpit (a person may delete it): the script still runs
  {
    const ck = document.getElementById('cockpit'), parent = ck.parentNode, i = parent.childNodes.indexOf(ck);
    ck.remove();
    let threw = null; try { load('os-cockpit.js'); await tick(); TYPE.all(); bus.changed(); } catch (e) { threw = e; }
    ok(!threw && TYPE.thrown.length === 0 && timers.size === 0, 'with the cockpit block deleted from the page the script runs and does nothing', threw && threw.message);
    parent.childNodes.splice(i, 0, ck); ck.parentNode = parent;
  }
  ok(same([...unsupported], []), 'the wiring asks the document only for plain selectors', [...unsupported]);

  // ---- the real model in place of its stand-in, the page's modules still stand-ins: facts like the spec's example ----
  if (fs.existsSync(D + 'os-cockpit-model.js')) {
    delete require.cache[require.resolve(D + 'os-cockpit-model.js')];
    global.OSCrew = require(D + 'os-cockpit-model.js');
    H.state = 'ok'; H.acted = {}; H.doc = { at: '2026-11-24T12:15:58Z', lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, counts: { waiting: 113, critical: 1, prepared: 103, doneToday: 14 }, top: [] };
    LN.state = { decisions: 'ok', leo: 'ok' }; LN.answered = {}; LN.leoActed = {};
    LN.docs = { decisions: { at: '2026-11-24T06:44:12Z', items: Array.from({ length: 10 }, (_, i) => ({ id: 'd' + i })) }, leo: { at: '2026-11-24T06:44:12Z', items: Array.from({ length: 7 }, (_, i) => ({ id: 'l' + i })) } };
    SN.state = { instinct: 'ok', muse: 'ok' }; SN.acted = {};
    SN.docs = { instinct: { at: '2026-11-24T07:30:00Z', items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }, { id: 'i4' }, { id: 'i5' }] }, muse: { at: '2026-11-24T07:30:00Z', items: [{ id: 'm1' }, { id: 'm2' }] } };
    load('os-cockpit.js'); await tick(); await tick();
    push('hub/weekly', { at: '2026-11-23T06:46:19Z', week: '2026-11-23' }); push('hub/pulse', undefined);
    TYPE.all();
    const got = scene().crew, lines = IDS.map((id) => drawings('ck-line').find((e) => e.dataset.ckId === id).textContent);
    ok(TYPE.thrown.length === 0 && same(got.map((a) => [a.id, a.name, a.look, a.hue, a.state, a.waiting]), [['desk', 'Desk', 'headset', 'teal', 'needs', 113], ['decide', 'Decide', 'gavel', 'amber', 'needs', 17], ['instinct', 'Instinct', 'antenna', 'rose', 'needs', 5], ['muse', 'Muse', 'bulb', 'violet', 'needs', 2], ['review', 'Review', 'clipboard', 'blue', 'idle', 0]]),
      'real model, stand-in page: the crew that reaches the scene is the spec\'s example (Desk 113, Decide 17, Instinct 5, Muse 2 wait; Review idle)', [got.map((a) => [a.id, a.state, a.waiting]), TYPE.thrown.map(String)]);
    ok(same(lines, ['13:15 · 113 for you', '07:44 · 17 for you', '08:30 · 5 for you', '08:30 · 2 for you', 'Mon 07:46 · posted']) && got.every((a) => a.bubble === (a.state === 'needs' ? a.waiting + ' for you' : '') && a.step === '' && a.fresh === Date.parse(a.id === 'review' ? '2026-11-23T06:46:19Z' : a.id === 'desk' ? '2026-11-24T12:15:58Z' : a.id === 'decide' ? '2026-11-24T06:44:12Z' : '2026-11-24T07:30:00Z')),
      'real model, stand-in page: the chips read 13:15 · 113 for you … Mon 07:46 · posted; bubbles and fresh times follow', [lines, got.map((a) => [a.bubble, a.fresh])]);
    ok(/^Desk: 113 waiting on you\. /.test(stage().children[0].getAttribute('aria-label')) && /Review: nothing waiting\.$/.test(stage().children[0].getAttribute('aria-label')), 'real model, stand-in page: the aria-label is the model\'s sentence', stage().children[0].getAttribute('aria-label'));
    global.OSCrew = modelStandIn;
  } else console.log('skip the real model on the stand-in page: dashboard/os-cockpit-model.js is not there yet');
  bus.fire();
  if (window.__osCockpit) window.__osCockpit.stop();
  ok(timers.size === 0 && timeouts.size === 0 && live('hub/weekly').length + live('hub/pulse').length === 0 && winOn.length === 0 && docHeard('keydown') === 0 && $$('[data-ck]').every((c) => c._on.length === 0) && bus.size() === 0, 'what a run leaves on window can stop everything it set up');
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
  ok(typeof window.OSCrew.derive === 'function' && same(window.OSCrew.ROSTER.map((a) => a.id), IDS) && same($$('[data-ck]').map((c) => c.dataset.ck), window.OSCrew.ROSTER.map((a) => a.id)), 'the real model loads, and the chips are its roster, in its order');
  ok(same($$('[data-ck]').map((c) => c.children.find((x) => x.tagName === 'B').textContent), window.OSCrew.ROSTER.map((a) => a.name)), 'the names in the chips are the roster\'s names');
  // documents like the ones the agents write: the numbers and times of the spec's example, made-up words
  const U = 'data/users/u_william/';
  const TODAY = { at: '2026-11-24T12:15:58Z', hubUrl: 'https://claude.ai/artifact/DBfeBDJhUg78LXARWBwSfU', counts: { waiting: 113, critical: 1, prepared: 103, doneToday: 14 }, lastRun: { at: '2026-11-24T12:15:58Z', status: 'ok' }, brief: { headline: 'A headline.' },
    top: Array.from({ length: 12 }, (_, i) => ({ id: 'item-' + i, title: 'Item ' + i, kind: 'ask', severity: 'high', status: 'waiting', dueAt: null })) };
  const lane = (n, pre) => Array.from({ length: n }, (_, i) => ({ id: pre + i, question: 'Question ' + i + '?', headline: 'Headline ' + i, title: 'Title ' + i, recommend: 'yes', yes: {}, no: {} }));
  TYPE.all(); // the type draws after the scripts: nothing has arrived yet
  ok(scenes.length === 1 && scene().crew.length === 5 && scene().crew.every((a) => a.state === 'unknown') && drawings('ck-line').every((e) => e.textContent === '—') && TYPE.thrown.length === 0, 'before the first snapshots: five agents, none in the room, every chip a —', [scene().crew.map((a) => a.state), TYPE.thrown.map(String)]);
  push('hub/today', TODAY); push(U + 'hub-actions', null);
  push('hub/decisions', { at: '2026-11-24T06:44:12Z', by: 'the decisions task', items: lane(10, 'dec-') });
  push('hub/leo', { at: '2026-11-24T06:44:12Z', to: { name: 'A Colleague', slackId: 'U0AAAAAAA1' }, items: lane(7, 'leo-') });
  push(U + 'decisions', null); push(U + 'leo-acts', { acts: { 'leo-old': { action: 'done', at: '2026-11-14T11:12:17Z' } } });
  push('hub/instinct', { at: '2026-11-24T07:30:00Z', items: lane(3, 'ins-') }); push('hub/muse', { at: '2026-11-24T07:30:00Z', items: lane(2, 'muse-') });
  push(U + 'sense-acts', { acts: { 'ins-older': { action: 'ack', at: '2026-11-20T00:33:49Z' } } });
  push('hub/weekly', { at: '2026-11-23T06:46:19Z', week: '2026-11-23', parent: 'Words.', sections: [], slack: { channel: 'D0AAAAAAAA', ts: '1.2' } });
  push('hub/pulse', undefined);
  const crew = () => scene().crew.map((a) => [a.id, a.state, a.waiting]);
  const lineOf = (id) => drawings('ck-line').find((e) => e.dataset.ckId === id).textContent;
  ok(same(crew(), [['desk', 'needs', 113], ['decide', 'needs', 17], ['instinct', 'needs', 3], ['muse', 'needs', 2], ['review', 'idle', 0]]), 'the crew that reaches the scene: Desk 113, Decide 17, Instinct 3 and Muse 2 wait on you; Review is idle', crew());
  ok(same(scene().crew.map((a) => [a.name, a.look, a.hue]), window.OSCrew.ROSTER.map((a) => [a.name, a.look, a.hue])) && scene().crew.every((a) => typeof a.bubble === 'string' && typeof a.step === 'string' && Number.isFinite(a.fresh)), 'each member is a full crew entry: name, look, hue, bubble, step, fresh');
  ok(same(IDS.map(lineOf), ['13:15 · 113 for you', '07:44 · 17 for you', '08:30 · 3 for you', '08:30 · 2 for you', 'Mon 07:46 · posted']), 'the chips read as in the spec\'s example', IDS.map(lineOf));
  ok(same(IDS.map((id) => stateOf(chip(id))), [['is-needs'], ['is-needs'], ['is-needs'], ['is-needs'], ['is-idle']]), 'each chip carries its one state class', IDS.map((id) => stateOf(chip(id))));
  const canvas = stage().children.find((c) => c.tagName === 'CANVAS'), tip = stage().children.find((c) => c.tagName !== 'CANVAS');
  ok(/^Desk: 113 waiting on you\. Decide: 17 waiting on you\. /.test(canvas.getAttribute('aria-label')) && /Review: nothing waiting\.$/.test(canvas.getAttribute('aria-label')), 'the picture\'s aria-label says who waits on you', canvas.getAttribute('aria-label'));
  scene().anchors.decide = { x: 300, y: 100 }; scene().opts.onHover('decide');
  const tipWords = () => tip.children.flatMap((c) => (c.children.length ? c.children : [c]).map((x) => x.textContent));
  ok(same(tipWords(), ['Decide', 'Prepares your yes/no decisions and the points for Leo.', '17 waiting on you: 10 decisions, 7 for Leo', 'Last result 07:44', 'Next run 07:43 tomorrow']), 'the tooltip: name, role, what waits and of which kind, the last result and the next run', tipWords());
  scene().opts.onHover(null);
  // the "Needs you" tile and the Desk slip are one number, also just after William handles an item here
  const tile = () => { const b = drawings('hub-count').find((e) => e.dataset.field === 'waiting'); return b.textContent; };
  ok(tile() === '113', 'the Hub\'s "Needs you" tile shows the same 113', tile());
  OS.hub.act('item-3', 'done', 'Item 3'); await tick(); flush();
  ok(tile() === '112' && same(crew()[0], ['desk', 'needs', 112]) && lineOf('desk') === '13:15 · 112 for you', 'Done on a Hub item: the tile and the Desk robot both say 112 at once', [tile(), crew()[0], lineOf('desk')]);
  OS.hub.act('item-3', null); await tick(); flush();
  // William's own answers reach the picture through OS.docs
  OS.lanes.answer('dec-0', 'yes'); await tick(); flush();
  ok(same(crew()[1], ['decide', 'needs', 16]) && lineOf('decide') === '07:44 · 16 for you', 'a decision answered on the Decide tab: Decide now holds 16', [crew()[1], lineOf('decide')]);
  OS.sense.act('ins-0', 'ack'); OS.sense.act('ins-1', 'notuseful'); OS.sense.act('ins-2', 'ack'); await tick(); flush();
  ok(same(crew()[2], ['instinct', 'idle', 0]) && lineOf('instinct') === '08:30 · all clear', 'every Instinct signal handled: Instinct goes idle, "all clear"', [crew()[2], lineOf('instinct')]);
  // a heartbeat: Desk shows as working while its run is under way, with its step
  push('hub/pulse', { agents: { desk: { state: 'running', startedAt: '2026-11-24T12:46:00Z', finishedAt: null, step: 'Reading Slack' } } });
  ok(same(crew()[0], ['desk', 'working', 113]) && scene().crew[0].step === 'Reading Slack' && lineOf('desk') === 'working · Reading Slack' && same(stateOf(chip('desk')), ['is-working']), 'hub/pulse says Desk is running: working, with its step, in the scene and on the chip', [crew()[0], lineOf('desk')]);
  push('hub/pulse', { agents: { desk: { state: 'ok', startedAt: '2026-11-24T12:46:00Z', finishedAt: '2026-11-24T12:49:00Z', step: '' } } });
  ok(same(crew()[0], ['desk', 'needs', 113]), 'the run ends: Desk is back with its 113', crew()[0]);
  // the clock alone: a run that has not reported is due, then missed, and the 30-second timer is what notices
  push('hub/today', { ...TODAY, at: '2026-11-24T06:15:00Z', lastRun: { at: '2026-11-24T06:15:00Z', status: 'ok' } });
  ok(same(crew()[0].slice(0, 2), ['desk', 'due']) && lineOf('desk') === 'due 13:13' && same(stateOf(chip('desk')), ['is-due']) && scene().crew[0].bubble === 'Run due 13:13', '13:50 and the 13:13 run has not reported: Desk is due', [crew()[0], lineOf('desk')]);
  later = 10; const before = scene().crews.length;
  ok(lineOf('desk') === 'due 13:13' && scene().crews.length === before, 'ten minutes on, nothing has changed until the timer fires');
  [...timers.values()].forEach((t) => t.fn());
  ok(same(crew()[0].slice(0, 2), ['desk', 'late']) && lineOf('desk') === 'missed 13:13' && same(stateOf(chip('desk')), ['is-late']), '... the timer fires: 47 minutes after 13:13 Desk has missed its run', [crew()[0], lineOf('desk')]);
  later = 0;
  push('hub/today', { ...TODAY, lastRun: { at: '2026-11-24T12:15:58Z', status: 'failed' } });
  ok(same(crew()[0].slice(0, 2), ['desk', 'error']) && lineOf('desk') === 'failed 13:15' && same(stateOf(chip('desk')), ['is-error']), 'a failed run: Desk shows the fault, "failed 13:15"', [crew()[0], lineOf('desk')]);
  push('hub/today', TODAY);
  // a document that can't be read, and one never written
  fail('hub/muse'); push('hub/weekly', undefined);
  ok(same(crew()[3].slice(0, 2), ['muse', 'unknown']) && lineOf('muse') === 'no data' && same(stateOf(chip('muse')), ['is-unknown']) && same(crew()[4], ['review', 'unknown', 0]) && lineOf('review') === 'not run yet', 'Muse can\'t be read: not in the room, "no data"; no hub/weekly: "not run yet"', [crew()[3], lineOf('muse'), crew()[4], lineOf('review')]);
  push('hub/muse', { at: '2026-11-24T07:30:00Z', items: lane(2, 'muse-') }); push('hub/weekly', { at: '2026-11-23T06:46:19Z' });

  // a robot click really changes tab: the page's own click handler takes the chip's data-nav
  const today = stage().closest('section'), decide = $$('section').find((s) => s.id === 'decide');
  ok(!today.hidden && decide.hidden, 'the page opens on Today');
  const c0 = scene().crews.length;
  scene().opts.onPick('decide');
  ok(today.hidden && !decide.hidden && $$('[data-nav-item]').find((b) => b.dataset.nav === 'decide').getAttribute('aria-current') === 'page' && TYPE.links[TYPE.links.length - 1] === 'decide', 'a click on the Decide robot opens the Decide tab', [today.hidden, decide.hidden, TYPE.links.slice(-1)]);
  [...timers.values()].forEach((t) => t.fn()); OS.docs.changed(); flush();
  ok(scene().crews.length === c0 && TYPE.thrown.length === 0, 'while Today is hidden the timer and the documents hand the scene nothing');
  stage()._w = 400; $$('[data-nav-item]').find((b) => b.dataset.nav === 'today').click(); TYPE.all();
  ok(!today.hidden && scene().crews.length === c0 + 1 && scene().log[scene().log.length - 1] === 'resize 400', 'back on Today the stage is drawn again, at its new width', scene().log.slice(-2));
  scrolled.length = 0; scene().opts.onPick('desk'); flush();
  ok(!today.hidden && scrolled.some((x) => x.el.id === 'hub-today'), 'a click on the Desk robot stays on Today and scrolls to the Hub pane', scrolled.map((x) => x.el.id || x.el.className));

  // the dashboard runs every script again when a file changes
  const n = scenes.length;
  boot(); await tick(); await tick(); await tick(); await tick();
  push('hub/today', TODAY); push('hub/weekly', { at: '2026-11-23T06:46:19Z' }); TYPE.all();
  ok(timers.size === 1 && scenes.filter((s) => !s.destroyed).length === 1 && scenes.length === n + 1 && live('hub/weekly').length === 1 && live('hub/pulse').length === 1, 'every script run again: one timer, one scene, one subscription to hub/weekly and one to hub/pulse', [timers.size, scenes.filter((s) => !s.destroyed).length, live('hub/weekly').length, live('hub/pulse').length]);
  ok($$('[data-ck]').every((c) => c.heard('click') === 1 && c.heard('focus') === 1) && docHeard('keydown') === 2 && winHeard('scroll') === 1, '... and still one cockpit listener of each kind (the document\'s two keydowns are the page\'s and the cockpit\'s)', [docHeard('keydown'), winHeard('scroll')]);
  ok(same(crew()[0], ['desk', 'needs', 113]) && TYPE.thrown.length === 0, '... and the picture follows the documents as before', [crew()[0], TYPE.thrown.map(String)]);
  ok(same([...unsupported].filter((s) => !/\s/.test(s)), []), 'no selector the stand-in document could not read was needed by this run', [...unsupported]);
};

(async () => {
  if (REAL) { await realRun(); console.log(`\n${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0); }
  staticChecks();
  await standIns();
  // the child run prints its own lines; its count joins this one
  if (fs.existsSync(D + 'os-cockpit-model.js')) {
    let out = '';
    try { out = execFileSync(process.execPath, [__filename, '--real'], { encoding: 'utf8', timeout: 120000 }); } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
    process.stdout.write(out.replace(/\n\d+ passed, \d+ failed\n?$/, '\n'));
    const m = out.match(/\n(\d+) passed, (\d+) failed\n?$/);
    if (m) { passes += +m[1]; fails += +m[2]; } else ok(false, 'the run with the real page scripts and the real model finishes', out.slice(-600));
  } else console.log('skip the run with the real model: dashboard/os-cockpit-model.js is not there yet');
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL crashed', e && e.stack); process.exit(1); });
