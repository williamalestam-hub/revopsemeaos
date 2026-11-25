// The cockpit scene (dashboard/os-cockpit-scene.js) against its contract, with a recording stand-in for the canvas:
// every made-up crew at five widths runs without throwing or drawing at NaN, names and slip counts are drawn, anchors
// hit their own agent, the same seed draws the same thing, the frame loop is capped and stops when the tab is hidden,
// reduced motion places agents at once, and destroy() lets go of listeners and frames. The last part holds what the
// review of the published scene asked for: nobody walks through anybody, tags at rest do not overlap, and so on.
// The very last part: a frame that throws ends the picture (wiped, let go, said once) instead of leaving it standing.
// After that, what the review of the third round asked for: bubbles at their owner and in turns, a name for an agent
// under a new id, a tap that is over once it led somewhere, and (with a probe added to a copy of the scene) no queue
// place on a plant, nobody painted over furniture it is behind, and a room that changes size under those on their way.
//   node tools/harness/test41.js [path/to/scene.js]
const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '../../dashboard/os-cockpit-scene.js'));
const FX = require('../cockpit-preview/fixtures.js');
let fails = 0, passes = 0;
const ok = (c, l, x) => { if (c) passes++; else fails++; if (!c || process.env.VERBOSE) console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x).slice(0, 300))); };

// ---- stand-ins ----
const mkCtx = () => {
  const rec = { calls: 0, bad: 0, texts: [], textAt: [], alphas: [] };
  const grad = { addColorStop() {} };
  const fixed = {
    measureText: (s) => ({ width: String(s).length * 4, actualBoundingBoxAscent: 5, actualBoundingBoxDescent: 1 }),
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => grad,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), getLineDash: () => [], isPointInPath: () => false, isPointInStroke: () => false,
  };
  const ctx = new Proxy(rec, {
    get(t, k) {
      if (k in t) return t[k];
      if (k in fixed) return fixed[k];
      if (typeof k !== 'string') return undefined;
      return (...args) => {
        t.calls++;
        for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) t.bad++;
        if (k === 'fillText' || k === 'strokeText') { t.texts.push(String(args[0])); t.textAt.push([String(args[0]), args[1], args[2]]); }
      };
    },
    set(t, k, v) { if (k === 'globalAlpha') t.alphas.push(v); t[k] = v; return true; },
  });
  return ctx;
};
const mkCanvas = () => {
  const L = [];
  const c = {
    width: 300, height: 150, style: {}, dataset: {}, isConnected: true, offsetParent: {}, listeners: L, ctx: mkCtx(),
    getContext() { return this.ctx; },
    addEventListener(type, fn) { L.push([type, fn]); }, removeEventListener(type, fn) { const i = L.findIndex((x) => x[0] === type && x[1] === fn); if (i >= 0) L.splice(i, 1); },
    getBoundingClientRect() { return { left: 0, top: 0, right: parseFloat(this.style.width) || this.width, bottom: parseFloat(this.style.height) || this.height, width: parseFloat(this.style.width) || this.width, height: parseFloat(this.style.height) || this.height, x: 0, y: 0 }; },
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null }, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setPointerCapture() {}, releasePointerCapture() {}, focus() {},
  };
  Object.defineProperty(c, 'clientWidth', { get() { return parseFloat(c.style.width) || c.width; } });
  Object.defineProperty(c, 'clientHeight', { get() { return parseFloat(c.style.height) || c.height; } });
  return c;
};
const raf = { q: new Map(), id: 0 };
const docL = [];
global.window = global;
global.devicePixelRatio = 2;
global.requestAnimationFrame = (fn) => { raf.q.set(++raf.id, fn); return raf.id; };
global.cancelAnimationFrame = (id) => { raf.q.delete(id); };
global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
global.document = {
  hidden: false, visibilityState: 'visible', documentElement: { style: {} }, body: {},
  createElement: (tag) => (tag === 'canvas' ? mkCanvas() : { style: {}, dataset: {}, append() {}, appendChild() {}, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, removeEventListener() {} }),
  addEventListener(type, fn) { docL.push([type, fn]); }, removeEventListener(type, fn) { const i = docL.findIndex((x) => x[0] === type && x[1] === fn); if (i >= 0) docL.splice(i, 1); },
};
global.addEventListener = () => {}; global.removeEventListener = () => {};
const pump = (n, stepMs, t0) => { let t = t0 || 0; for (let i = 0; i < n; i++) { t += stepMs; const fns = [...raf.q.values()]; raf.q.clear(); fns.forEach((fn) => fn(t)); } return t; };

try { require(FILE); } catch (e) { ok(false, 'the scene file loads', String(e && e.message)); console.log(`\n${passes} passed, ${fails} failed`); process.exit(1); }
const API = global.OSCockpit;
ok(API && typeof API.create === 'function', 'window.OSCockpit.create exists');
if (!API || typeof API.create !== 'function') { console.log(`\n${passes} passed, ${fails} failed`); process.exit(1); }

const STEP = 1000 / 15;
// runs a fixture for `ms` of scene time; returns the scene, its canvas and what was drawn in the last frame
const run = (name, width, ms, opts) => {
  const fx = FX[name], canvas = mkCanvas(); let simT = 0; const heard = { hover: [], pick: [] };
  const scene = API.create(canvas, Object.assign({ now: () => fx.clock + simT, seed: 7, reducedMotion: false, onHover: (id) => heard.hover.push(id), onPick: (id) => heard.pick.push(id) }, opts || {}));
  scene.setCrew(fx.crew);
  const height = scene.resize(width);
  const script = (fx.script || []).slice().sort((a, b) => a.at - b.at); let si = 0, crew = fx.crew, lastTexts = [];
  for (let t = 0; t <= ms + 1e-6; t += STEP) {
    while (si < script.length && script[si].at <= t) { crew = script[si].crew; scene.setCrew(crew); si++; }
    simT = t; canvas.ctx.texts.length = 0; scene.frame(t); lastTexts = canvas.ctx.texts.slice();
  }
  return { scene, canvas, height, crew, texts: lastTexts, heard, fx };
};

const METHODS = ['setCrew', 'resize', 'frame', 'start', 'stop', 'destroy', 'hit', 'anchor', 'setFocus'];
{
  const c = mkCanvas(); const s = API.create(c, { now: () => FX.morning.clock, seed: 1, reducedMotion: false, onHover() {}, onPick() {} });
  ok(METHODS.every((m) => typeof s[m] === 'function'), 'a scene has ' + METHODS.join(', '), METHODS.filter((m) => typeof s[m] !== 'function'));
  s.destroy();
}

// ---- every fixture at every width ----
const WIDTHS = [360, 400, 888, 1280, 1600];
const realRandom = Math.random, realNow = Date.now, realPerf = global.performance && global.performance.now;
for (const name of Object.keys(FX)) {
  for (const w of WIDTHS) {
    let r, err = null, sneaky = 0;
    Math.random = () => { sneaky++; return 0.5; }; Date.now = () => { sneaky++; return realNow.call(Date); };
    if (global.performance) global.performance.now = () => { sneaky++; return 0; };
    try { r = run(name, w, 16000); } catch (e) { err = e; }
    Math.random = realRandom; Date.now = realNow; if (global.performance) global.performance.now = realPerf;
    const tag = `${name} @${w}`;
    ok(!err, `${tag}: 16 s of frames without a throw`, err && String(err.stack || err).split('\n').slice(0, 3));
    if (err) continue;
    ok(sneaky === 0, `${tag}: uses the seed and opts.now(), not Math.random, Date.now or performance.now`, sneaky);
    ok(Number.isFinite(r.height) && r.height >= 120 && r.height <= (name === 'eight' ? 440 : 380), `${tag}: height between 120 and ${name === 'eight' ? 440 : 380} css px`, r.height);
    ok(r.canvas.ctx.bad === 0, `${tag}: no NaN or Infinity reaches the canvas`, r.canvas.ctx.bad);
    ok(r.canvas.ctx.calls > 50, `${tag}: something is drawn`, r.canvas.ctx.calls);
    ok(Math.abs(r.canvas.width - Math.round(w * 2)) <= 2, `${tag}: the backing store follows the device pixel ratio`, [r.canvas.width, w * 2]);
    const present = r.crew.filter((a) => a.state !== 'unknown');
    const texts = r.texts.join(' | ');
    ok(present.every((a) => texts.includes(a.name)), `${tag}: every agent in the room has its name drawn`, present.filter((a) => !texts.includes(a.name)).map((a) => a.name));
    const slips = present.filter((a) => a.state === 'needs' && a.waiting > 0);
    ok(slips.every((a) => texts.includes(a.waiting > 99 ? '99+' : String(a.waiting))), `${tag}: a waiting agent shows its count (99+ above 99)`, slips.filter((a) => !texts.includes(a.waiting > 99 ? '99+' : String(a.waiting))).map((a) => [a.name, a.waiting]));
    const ids = new Set(r.crew.map((a) => a.id));
    const misses = present.map((a) => { const p = r.scene.anchor(a.id); return { id: a.id, p, hit: p ? r.scene.hit(p.x, p.y) : 'no anchor' }; }).filter((x) => x.hit !== x.id);
    ok(!misses.length, `${tag}: each agent's anchor hits that agent`, misses);
    const inside = present.every((a) => { const p = r.scene.anchor(a.id); return p && p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= r.height; });
    ok(inside, `${tag}: anchors are inside the canvas`);
    const stray = [[1, 1], [w - 2, 2]].map(([x, y]) => r.scene.hit(x, y)).filter((id) => id != null && !ids.has(id));
    ok(!stray.length, `${tag}: hit() returns only ids of this crew`, stray);
    r.scene.destroy();
  }
}

// ---- same seed, same picture ----
{
  const a = run('cleared', 888, 9000), b = run('cleared', 888, 9000);
  ok(a.canvas.ctx.calls === b.canvas.ctx.calls && a.texts.join() === b.texts.join(), 'the same seed and times draw the same calls', [a.canvas.ctx.calls, b.canvas.ctx.calls]);
  a.scene.destroy(); b.scene.destroy();
}

// ---- walking: a cleared morning moves agents away from your desk ----
{
  const r = run('morning', 888, 12000); const before = Object.fromEntries(r.crew.map((a) => [a.id, r.scene.anchor(a.id)]));
  r.scene.setCrew(FX.clear.crew);
  let moved = 0; for (let t = 12000; t <= 26000; t += STEP) r.scene.frame(t);
  for (const a of FX.clear.crew) { const p = r.scene.anchor(a.id), q = before[a.id]; if (p && q && Math.hypot(p.x - q.x, p.y - q.y) > 12) moved++; }
  ok(moved >= 3, 'agents that stop waiting on you walk somewhere else', moved);
  r.scene.destroy();
}

// ---- reduced motion: placed at once ----
{
  const fx = FX.morning, canvas = mkCanvas();
  const s = API.create(canvas, { now: () => fx.clock, seed: 7, reducedMotion: true, onHover() {}, onPick() {} });
  s.setCrew(fx.crew); s.resize(888); s.frame(0);
  const p0 = fx.crew.map((a) => s.anchor(a.id));
  for (let t = 0; t <= 10000; t += STEP) s.frame(t);
  const p1 = fx.crew.map((a) => s.anchor(a.id));
  ok(p0.every((p, i) => p && p1[i] && Math.hypot(p.x - p1[i].x, p.y - p1[i].y) <= 1.5), 'reduced motion: agents stand in place from the first frame', [p0, p1]);
  s.destroy();
}

// ---- pointer ----
{
  const r = run('morning', 888, 12000); const a = r.crew[0], p = r.scene.anchor(a.id);
  const ev = (x, y) => ({ clientX: x, clientY: y, offsetX: x, offsetY: y, pageX: x, pageY: y, target: r.canvas, currentTarget: r.canvas, pointerType: 'mouse', button: 0, preventDefault() {}, stopPropagation() {} });
  const fire = (types, e) => r.canvas.listeners.filter((x) => types.includes(x[0])).forEach((x) => x[1](e));
  fire(['pointermove', 'mousemove'], ev(p.x, p.y));
  ok(r.heard.hover.includes(a.id), 'pointing at an agent calls onHover with its id', r.heard.hover);
  fire(['click'], ev(p.x, p.y));
  if (!r.heard.pick.length) { fire(['pointerdown', 'mousedown'], ev(p.x, p.y)); fire(['pointerup', 'mouseup'], ev(p.x, p.y)); }
  ok(r.heard.pick.includes(a.id), 'a click on an agent calls onPick with its id', r.heard.pick);
  fire(['pointerleave', 'mouseleave', 'pointerout', 'mouseout'], ev(-5, -5));
  ok(r.heard.hover[r.heard.hover.length - 1] == null, 'leaving the canvas calls onHover(null)', r.heard.hover.slice(-3));
  let threw = null; try { r.scene.setFocus(a.id); r.scene.frame(12100); r.scene.setFocus(null); r.scene.setFocus('nobody'); r.scene.frame(12200); } catch (e) { threw = e; }
  ok(!threw, 'setFocus with an id, null or an unknown id is safe', threw && String(threw));
  r.scene.destroy();
  ok(r.canvas.listeners.length === 0, 'destroy() removes the canvas listeners', r.canvas.listeners.map((x) => x[0]));
}

// ---- odd crews ----
{
  let threw = null;
  try {
    const canvas = mkCanvas(); const s = API.create(canvas, { now: () => FX.clear.clock, seed: 3, reducedMotion: false, onHover() {}, onPick() {} });
    s.resize(400); s.frame(0);
    s.setCrew([]); s.frame(100);
    s.setCrew([{ id: 'x', name: 'Twelve chars', look: 'not-a-look', hue: 'not-a-hue', state: 'needs', waiting: 100000, step: '', bubble: 'A rather long bubble text here', fresh: 0 }]); for (let t = 200; t < 9000; t += STEP) s.frame(t);
    s.setCrew([{ id: 'x', name: 'Twelve chars', state: 'not-a-state' }]); s.frame(9100);
    s.setCrew(null); s.frame(9200); s.resize(0); s.frame(9300); s.resize(888); s.frame(9400);
    ok(canvas.ctx.bad === 0, 'odd crews: no NaN reaches the canvas', canvas.ctx.bad);
    s.destroy(); s.destroy();
  } catch (e) { threw = e; }
  ok(!threw, 'an empty crew, unknown look, hue and state, a huge count, null and width 0 are all safe', threw && String(threw.stack || threw).split('\n').slice(0, 3));
}

// ---- the frame loop: capped, quiet when hidden, gone after destroy ----
{
  const fx = FX.morning, canvas = mkCanvas();
  const s = API.create(canvas, { now: () => fx.clock, seed: 7, reducedMotion: false, onHover() {}, onPick() {} });
  s.setCrew(fx.crew); s.resize(888); raf.q.clear();
  s.start();
  let draws = 0, t = 0;
  for (let i = 0; i < 120; i++) { const before = canvas.ctx.calls; t = pump(1, 1000 / 60, t); if (canvas.ctx.calls > before) draws++; }
  ok(draws >= 8 && draws <= 44, 'start(): draws at 4 to 22 frames a second on a 60 Hz screen', draws);
  ok(raf.q.size >= 1, 'start(): keeps asking for the next frame');
  document.hidden = true; document.visibilityState = 'hidden'; docL.filter((x) => x[0] === 'visibilitychange').forEach((x) => x[1]({}));
  t = pump(4, 1000 / 60, t); const quiet0 = canvas.ctx.calls; t = pump(60, 1000 / 60, t);
  ok(canvas.ctx.calls === quiet0, 'nothing is drawn while the tab is hidden', canvas.ctx.calls - quiet0);
  document.hidden = false; document.visibilityState = 'visible'; docL.filter((x) => x[0] === 'visibilitychange').forEach((x) => x[1]({}));
  const back0 = canvas.ctx.calls; t = pump(60, 1000 / 60, t);
  ok(canvas.ctx.calls > back0, 'drawing resumes when the tab shows again');
  s.stop(); const stop0 = canvas.ctx.calls; t = pump(30, 1000 / 60, t);
  ok(canvas.ctx.calls === stop0, 'stop() stops the drawing');
  s.start(); t = pump(30, 1000 / 60, t); s.destroy(); const d0 = canvas.ctx.calls; t = pump(30, 1000 / 60, t);
  ok(canvas.ctx.calls === d0 && raf.q.size === 0, 'destroy() ends the loop and leaves no frame request', [canvas.ctx.calls - d0, raf.q.size]);
  ok(docL.length === 0, 'destroy() removes the document listeners', docL.map((x) => x[0]));
}
// reduced motion on the real page: the first crew is all unknown (documents still loading), the real one follows.
// The picture must then be the one a scene draws when it gets the real crew first: same calls, same opacities.
{
  const fx = FX.morning, unknown = fx.crew.map((a) => Object.assign({}, a, { state: 'unknown', waiting: 0, fresh: 0 }));
  // both scenes are drawn at the same three times; only the first crew differs
  const shot = (first) => {
    const canvas = mkCanvas(); const s = API.create(canvas, { now: () => fx.clock, seed: 7, reducedMotion: true, onHover() {}, onPick() {} });
    s.setCrew(first); s.resize(888); s.frame(0);
    s.setCrew(fx.crew); s.frame(1000);
    canvas.ctx.calls = 0; canvas.ctx.alphas.length = 0; s.frame(5000);
    const out = { calls: canvas.ctx.calls, alphas: canvas.ctx.alphas.join(','), anchors: fx.crew.map((a) => s.anchor(a.id)) }; s.destroy(); return out;
  };
  const late = shot(unknown), direct = shot(fx.crew);
  ok(late.calls === direct.calls && late.alphas === direct.alphas, 'reduced motion: agents that were unknown at first are drawn like any other (same calls, same opacity)', [late.calls, direct.calls, late.alphas.slice(0, 80), direct.alphas.slice(0, 80)]);
  ok(late.anchors.every((p, i) => p && direct.anchors[i] && Math.hypot(p.x - direct.anchors[i].x, p.y - direct.anchors[i].y) <= 1.5), 'reduced motion: and they stand in the same places', [late.anchors, direct.anchors]);
}
// reduced motion: start() does not loop
{
  const fx = FX.morning, canvas = mkCanvas(); raf.q.clear();
  const s = API.create(canvas, { now: () => fx.clock, seed: 7, reducedMotion: true, onHover() {}, onPick() {} });
  s.setCrew(fx.crew); s.resize(888); s.start();
  let t = pump(10, 1000 / 60, 0); const c0 = canvas.ctx.calls; t = pump(120, 1000 / 60, t);
  ok(canvas.ctx.calls === c0, 'reduced motion: start() draws once and does not animate', canvas.ctx.calls - c0);
  const c1 = canvas.ctx.calls; s.setCrew(FX.clear.crew); t = pump(10, 1000 / 60, t);
  ok(canvas.ctx.calls > c1, 'reduced motion: a new crew is drawn');
  s.destroy();
}

// ---- what the review of the published scene asked for ----
// how much of one robot's body (14 x 20 logical px, 2 css px each at these widths) lies on another's, from their anchors
const lapOf = (p, q) => { const w = 14 - Math.abs(p.x - q.x) / 2, h = 20 - Math.abs(p.y - q.y) / 2; return w > 0 && h > 0 ? w * h / 280 : 0; };
// (an anchor is 15 logical px above the feet, 16 for the one with the bulb: this is the same height for all)
const stood = (s, a) => { const p = s.anchor(a.id); return p && a.look === 'bulb' ? { x: p.x, y: p.y + 2 } : p; };
// plays [atMs, crew] steps on a new scene (those before 0 are set before the size, as the page does); each(t, scene, canvas) after every frame
const play = (width, steps, ms, each, opts) => {
  const canvas = mkCanvas(); let simT = 0; const heard = { hover: [], pick: [] };
  if (opts && opts.wideText) canvas.ctx.measureText = (str) => ({ width: String(str).length * 12 });    // letters as wide as real ones (6 css px)
  const scene = API.create(canvas, Object.assign({ now: () => FX.morning.clock + simT, seed: 7, reducedMotion: false, onHover: (id) => heard.hover.push(id), onPick: (id) => heard.pick.push(id) }, opts || {}));
  const todo = steps.slice().sort((a, b) => a[0] - b[0]); let i = 0;
  while (i < todo.length && todo[i][0] < 0) scene.setCrew(todo[i++][1]);
  const height = scene.resize(width);
  for (let t = 0; t <= ms + 1e-6; t += STEP) { while (i < todo.length && todo[i][0] <= t + 1e-6) scene.setCrew(todo[i++][1]); simT = t; canvas.ctx.texts.length = 0; canvas.ctx.textAt.length = 0; scene.frame(t); if (each) each(t, scene, canvas); }
  return { scene, canvas, heard, height };
};
const IDS = FX.morning.crew.map((a) => a.id);
const far = (p, q) => (p && q ? Math.hypot(p.x - q.x, p.y - q.y) : 1e9);
const point = (canvas, x, y, kind, type) => canvas.listeners.filter((l) => l[0] === type).forEach((l) => l[1]({ type, clientX: x, clientY: y, pointerType: kind, target: canvas, preventDefault() {}, stopPropagation() {} }));
// Where each robot belongs once the walking is over: a scene that does not animate stands everybody in place at once
// (checked above), so handed the same crews in the same order it says where that is (the queue in the order they came,
// a place in the lounge each, its own chair for the rest; null for one that is not in the room).
const placed = (width, steps, list) => {
  const s = API.create(mkCanvas(), { now: () => FX.morning.clock, seed: 7, reducedMotion: true, onHover() {}, onPick() {} });
  const todo = steps.slice().sort((a, b) => a[0] - b[0]); let i = 0;
  while (i < todo.length && todo[i][0] < 0) s.setCrew(todo[i++][1]);
  s.resize(width);
  while (i < todo.length) s.setCrew(todo[i++][1]);
  s.frame(0);
  const at = list.map((a) => stood(s, a)); s.destroy(); return at;
};

// 1. nobody walks through anybody: the page loading, everything handled at once, a morning arriving, a new result
{
  const cases = {
    'the page loading (an empty crew, then the morning)': [[-1, []], [1000, FX.morning.crew]],
    'everything handled at once': [[-1, FX.morning.crew], [14000, FX.clear.crew]],
    'a morning arriving': [[-1, FX.clear.crew], [14000, FX.morning.crew]],
    'a new result': [[-1, FX.handover.crew], [14000, FX.handover.script[0].crew]],
    // and a change that arrives while they are still on their way, as on the page (150 ms after any document changes)
    'the page loading, and Desk handled two seconds later': [[-1, []], [1000, FX.morning.crew], [3000, FX.morning.crew.map((a) => (a.id === 'desk' ? Object.assign({}, a, { state: 'idle', waiting: 0, bubble: '' }) : a))]],
  };
  for (const [what, steps] of Object.entries(cases)) for (const w of [366, 400, 888]) {
    const run = {}; let worst = 0, who = '', last = null, prev = null;
    const r = play(w, steps, 32000, (t, s) => {
      const at = FX.morning.crew.map((a) => stood(s, a));
      for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) { const key = IDS[i] + '+' + IDS[j]; run[key] = at[i] && at[j] && lapOf(at[i], at[j]) > 0.25 ? (run[key] || 0) + 1 : 0; if (run[key] > worst) { worst = run[key]; who = key + ' at ' + Math.round(t) + ' ms'; } }
      prev = last; last = at;
    });
    ok(worst <= 3, `${what} @${w}: no two robots are more than a quarter on top of each other for more than three frames`, [worst, who]);
    const want = placed(w, steps, FX.morning.crew);
    ok(last.every((p, i) => far(p, prev[i]) < 0.01 && far(p, want[i]) <= 1.5), `${what} @${w}: and everybody has arrived: nobody moves any more, and each stands in the place its state calls for`, last.map((p, i) => [Math.round(far(p, prev[i])), Math.round(far(p, want[i]))]));
    r.scene.destroy();
  }
}

// 1b. the same with six to eight agents: the tight room of a narrow page (two rows of desks under the 380 px limit), a
// lounge that has to fill from its far end, and the whole crew changing places at once
{
  const ST = { n: 'needs', i: 'idle', w: 'working', d: 'due', l: 'late', e: 'error', u: 'unknown' };
  const mix = (letters) => letters.split('').map((c, i) => Object.assign({}, FX.eight.crew[i], { state: ST[c], waiting: c === 'n' ? i + 1 : 0, step: c === 'w' ? 'Reading Slack' : '', bubble: '' }));
  const lapse = (w, steps, ms, from) => {
    const n = steps[steps.length - 1][1].length, ids = FX.eight.crew.slice(0, n).map((a) => a.id);
    const run = {}; let worst = 0, who = '', last = null, prev = null;
    const r = play(w, steps, ms, (t, s) => {
      const at = FX.eight.crew.slice(0, n).map((a) => stood(s, a));
      if (t >= from) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const key = ids[i] + '+' + ids[j]; run[key] = at[i] && at[j] && lapOf(at[i], at[j]) > 0.25 ? (run[key] || 0) + 1 : 0; if (run[key] > worst) { worst = run[key]; who = key + ' at ' + Math.round(t) + ' ms'; } }
      prev = last; last = at;
    });
    r.scene.destroy();
    const want = placed(w, steps, FX.eight.crew.slice(0, n));     // how far each still is from the place its state calls for
    return { worst, who, still: last.map((p, i) => (p || prev[i] ? Math.round(far(p, prev[i])) : 0)), away: last.map((p, i) => (p || want[i] ? Math.round(far(p, want[i]) * 10) / 10 : 0)) };
  };
  for (const [letters, widths] of [['nniwiin', [366, 400]], ['iiiwwni', [366, 400]], ['nnniii', [366]], ['ineinnw', [366]], ['idnndnnn', [366, 400]], ['iiiiiiii', [366, 400, 888]]]) for (const w of widths) {
    const r = lapse(w, [[-1, []], [1000, mix(letters)]], 30000, 0);
    ok(r.worst <= 3, `the page loading with ${letters.length} agents (${letters}) @${w}: no two robots are more than a quarter on top of each other for more than three frames`, [r.worst, r.who]);
    ok(r.still.every((d) => d < 0.01) && r.away.every((d) => d <= 1.5), `${letters} @${w}: and everybody has arrived: nobody moves any more, and each stands in the place its state calls for`, [r.still, r.away]);
  }
  // three leave the lounge of the tight room past one who stays: there is no height for an aisle, so they go along the very edge
  {
    const r = lapse(366, [[-1, []], [1000, mix('wiiiiw')], [16000, mix('llneiu')]], 40000, 16000);
    ok(r.worst <= 3, 'three leaving the lounge of the tight room @366 past one who stays: nobody walks through anybody', [r.worst, r.who]);
    ok(r.still.every((d) => d < 0.01) && r.away.every((d) => d <= 1.5), 'leaving the lounge of the tight room @366: and everybody has arrived, each in the place its state calls for', [r.still, r.away]);
  }
  // everybody somewhere else at once (three of them want each other's places): they go one after the other
  const swap = FX.eight.crew.map((a, i) => Object.assign({}, a, { state: ['idle', 'needs', 'needs', 'idle', 'idle', 'needs', 'working', 'idle'][i], waiting: i + 1, step: i === 6 ? 'Reading Slack' : '' }));
  for (const w of [400, 888]) {
    const r = lapse(w, [[-1, FX.eight.crew], [16000, swap]], 46000, 16000);
    ok(r.worst <= 3, `the whole crew of eight changing places at once @${w}: nobody walks through anybody`, [r.worst, r.who]);
    ok(r.still.every((d) => d < 0.01) && r.away.every((d) => d <= 1.5), `the whole crew changing places @${w}: and everybody has arrived half a minute later, each in the place its state calls for`, [r.still, r.away]);
  }
}

// 2. name tags at rest: eight agents with twelve-letter names at 400 px, none on another
{
  const names = ['Twelve chars', 'Reconciliati', 'Wide WWWWWWW', 'Muse of data', 'Review board', 'Scout patrol', 'Ledger books', 'Relay runner'];
  for (const st of ['idle', 'needs', 'due']) {
    const crew = FX.eight.crew.map((a, i) => Object.assign({}, a, { name: names[i], state: st, waiting: st === 'needs' ? i + 1 : 0, step: '', bubble: '' }));
    const r = play(400, [[-1, crew]], 40000);
    // a tag as the scene draws it here: the text 10 px in from the left of a plate 28 px high, the baseline 21 px down
    const tags = r.canvas.ctx.textAt.filter((x) => names.includes(x[0])).map((x) => ({ name: x[0], x: x[1] - 10, y: x[2] - 21, w: x[0].length * 4 + 20, h: 28 }));
    const hits = []; for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) { const a = tags[i], b = tags[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) hits.push(a.name + ' x ' + b.name); }
    ok(tags.length === 8 && !hits.length, `eight ${st} agents with twelve-letter names @400: every name tag is drawn and none lies on another`, [tags.length, hits]);
    ok(tags.every((tg) => tg.x >= 0 && tg.y >= 0 && tg.x + tg.w <= r.canvas.width && tg.y + tg.h <= r.canvas.height), `eight ${st} agents @400: no tag is cut by the edge`, tags.filter((tg) => tg.x < 0 || tg.y < 0 || tg.x + tg.w > r.canvas.width || tg.y + tg.h > r.canvas.height));
    r.scene.destroy();
  }
}

// 3. the plate with your name belongs to the desk: painted with the room, not over the robots every frame
{
  const made = [], real = document.createElement;
  document.createElement = (tag) => { const el = real(tag); if (tag === 'canvas') made.push(el); return el; };
  let live = 0;
  const r = play(888, [[-1, FX.morning.crew]], 6000, (t, s, c) => { if (c.ctx.texts.includes('You')) live++; });
  document.createElement = real;
  ok(made.some((c) => c.ctx.texts.includes('You')) && live === 0, 'the plate with your name is painted with the room, where a robot in front covers it, not over everything each frame', [made.map((c) => c.ctx.texts.filter((x) => x === 'You').length), live]);
  r.scene.destroy();
}

// 4. a change of width or of pixel ratio while robots walk does not put them in their places at once
for (const [what, change] of [['a width change of a scrollbar', (s) => s.resize(873)], ['a change of the pixel ratio alone', () => { global.devicePixelRatio = 3; }]]) {
  const r = play(888, [[-1, FX.morning.crew]], 2000);
  const before = IDS.map((id) => r.scene.anchor(id));
  change(r.scene); r.scene.frame(2000 + STEP);
  const after = IDS.map((id) => r.scene.anchor(id));
  global.devicePixelRatio = 2;
  ok(before.every((p, i) => far(p, after[i]) < 28), `${what} moves no robot that is on its way by more than a step or two`, before.map((p, i) => Math.round(far(p, after[i]))));
  for (let t = 2000 + 2 * STEP; t <= 16000; t += STEP) r.scene.frame(t);
  const done = play(what[0] === 'a' && change.length ? 873 : 888, [[-1, FX.morning.crew]], 16000);
  ok(IDS.every((id) => far(r.scene.anchor(id), done.scene.anchor(id)) <= 1.5), `${what}: they still arrive where they belong`, IDS.map((id) => Math.round(far(r.scene.anchor(id), done.scene.anchor(id)))));
  r.scene.destroy(); done.scene.destroy();
}

// 6 and 7. pointing follows the robots; a finger that lifts does not end it
{
  const r = play(888, [[-1, FX.morning.crew]], 12000), p = r.scene.anchor('desk');
  point(r.canvas, p.x, p.y, 'mouse', 'pointermove');
  r.scene.setCrew(FX.clear.crew); for (let t = 12000; t <= 22000; t += STEP) r.scene.frame(t);
  ok(r.heard.hover[0] === 'desk' && r.heard.hover[r.heard.hover.length - 1] === null, 'a robot that walks away from under a pointer at rest is no longer pointed at', r.heard.hover);
  r.scene.destroy();
  const done = play(888, [[-1, FX.handover.crew], [2500, FX.handover.script[0].crew]], 14000), slot = done.scene.anchor('desk'); done.scene.destroy();
  const r2 = play(888, [[-1, FX.handover.crew]], 2000);
  point(r2.canvas, slot.x, slot.y, 'mouse', 'pointermove');
  const n0 = r2.heard.hover.length;
  r2.scene.setCrew(FX.handover.script[0].crew); for (let t = 2000 + STEP; t <= 14000; t += STEP) r2.scene.frame(t);
  ok(n0 === 0 && r2.heard.hover[r2.heard.hover.length - 1] === 'desk', 'a robot that arrives under a pointer at rest is pointed at', r2.heard.hover);
  r2.scene.destroy();
  const r3 = play(888, [[-1, FX.morning.crew]], 12000), p3 = r3.scene.anchor('decide');
  point(r3.canvas, p3.x, p3.y, 'touch', 'pointerdown'); point(r3.canvas, p3.x, p3.y, 'touch', 'pointerleave');
  ok(r3.heard.hover.length === 1 && r3.heard.hover[0] === 'decide', 'a finger that lifts (the pointerleave of a touch) leaves the robot it touched pointed at', r3.heard.hover);
  point(r3.canvas, -5, -5, 'mouse', 'pointerleave');
  ok(r3.heard.hover[r3.heard.hover.length - 1] === null, 'a mouse that leaves the canvas ends it', r3.heard.hover);
  r3.scene.destroy();
}

// 8. at a fractional pixel ratio the css box is the backing store over the ratio (one canvas pixel, one device pixel)
{
  global.devicePixelRatio = 1.75;
  const c = mkCanvas(), s = API.create(c, { now: () => FX.morning.clock, seed: 7, reducedMotion: false, onHover() {}, onPick() {} });
  s.setCrew(FX.morning.crew); const h = s.resize(366); s.frame(0);
  ok(c.width === Math.round(366 * 1.75) && Math.abs(parseFloat(c.style.width) * 1.75 - c.width) < 1e-6 && Math.abs(parseFloat(c.style.height) * 1.75 - c.height) < 1e-6 && Math.abs(h * 1.75 - c.height) < 1e-6, 'pixel ratio 1.75: the css size is the backing store over the ratio', [c.width, c.height, c.style.width, c.style.height, h]);
  s.destroy(); global.devicePixelRatio = 2;
}

// 9. a very wide page: the desks stand further apart than the old cap, the height stays within its limit
{
  const due = FX.morning.crew.map((a) => Object.assign({}, a, { state: 'due', waiting: 0 }));
  const r = play(1800, [[-1, due]], 0), a = r.scene.anchor('desk'), b = r.scene.anchor('decide');
  const px = r.height / 145;                                              // css px a logical px: a wide room with one row of desks is 145 high
  ok((b.x - a.x) / px > 85 && r.height <= 380, 'at 1800 px the desks are more than 85 logical px apart (the cap was 76) and the room is no higher than 380 css px', [(b.x - a.x) / px, r.height]);
  r.scene.destroy();
}

// 11. the small ones
{
  // called back to its desk just as it gets up: it ends in its chair
  const mk = (st) => FX.running.crew.map((a, i) => (i === 0 ? Object.assign({}, a, { state: st, waiting: st === 'needs' ? 2 : 0, step: st === 'working' ? 'Reading Slack' : '', bubble: '' }) : a));
  const seat = play(888, [[-1, mk('due')]], 0), home = seat.scene.anchor('desk'); seat.scene.destroy();
  const r = play(888, [[-1, mk('working')], [12000, mk('needs')], [12250, mk('due')]], 16000);
  ok(far(r.scene.anchor('desk'), home) <= 1.5, 'a robot called back as it gets up sits in its chair again', [home, r.scene.anchor('desk')]);
  r.scene.destroy();
  // those who stand in the queue do not shuffle when another joins
  const long = ['Desk', 'Twelve chars', 'Reconciliati', 'Muse', 'Review'];
  const some = (n) => FX.clear.crew.map((a, i) => Object.assign({}, a, { name: long[i] }, i < n ? { state: 'needs', waiting: 3 } : {}));   // a short name and a long one wait; then a second long one joins
  const q = play(888, [[-1, some(2)]], 14000, null, { wideText: true }), before = ['desk', 'decide'].map((id) => q.scene.anchor(id));
  q.scene.setCrew(some(3)); for (let t = 14000 + STEP; t <= 28000; t += STEP) q.scene.frame(t);
  ok(['desk', 'decide'].every((id, i) => far(q.scene.anchor(id), before[i]) <= 0.5) && far(q.scene.anchor('instinct'), before[1]) > 20, 'those who stand in the queue stay where they are when another joins, whatever the length of its name', [before, ['desk', 'decide', 'instinct'].map((id) => q.scene.anchor(id))]);
  q.scene.destroy();
  // the focus on an agent that is not in the room
  const c = mkCanvas(), s = API.create(c, { now: () => FX.trouble.clock, seed: 7, reducedMotion: true, onHover() {}, onPick() {} });
  s.setCrew(FX.trouble.crew); s.resize(888); s.frame(0);
  c.ctx.calls = 0; s.frame(100); const plain = c.ctx.calls;
  s.setFocus('instinct'); c.ctx.calls = 0; s.frame(200); const lit = c.ctx.calls;
  ok(lit > plain && s.anchor('instinct') === null, 'the focus on an agent that is not in the room shows on its empty chair (it still has no anchor)', [plain, lit]);
  s.destroy();
  // reduced motion: a zoom of the page is seen without a new crew
  const z = mkCanvas(); raf.q.clear();
  const zs = API.create(z, { now: () => FX.morning.clock, seed: 7, reducedMotion: true, onHover() {}, onPick() {} });
  zs.setCrew(FX.morning.crew); zs.resize(888); zs.start(); let zt = pump(10, 1000 / 60, 0);
  const w0 = z.width; global.devicePixelRatio = 3; zt = pump(10, 1000 / 60, zt); const w1 = z.width; global.devicePixelRatio = 2;
  ok(w0 === 1776 && w1 === 2664, 'reduced motion: a zoom of the page is seen at once, without waiting for a new crew', [w0, w1]);
  zs.destroy(); ok(raf.q.size === 0, 'reduced motion: destroy() leaves no frame request', raf.q.size);
  // more than eight agents: the first eight, each in a place of its own
  const ten = Array.from({ length: 10 }, (_, i) => Object.assign({}, FX.eight.crew[i % 8], { id: 'x' + i, name: 'Agent ' + i, state: 'idle', waiting: 0 }));
  const m = play(400, [[-1, ten]], 30000), at = ten.map((a) => m.scene.anchor(a.id));
  let close = 0; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (far(at[i], at[j]) < 20) close++;
  ok(at.slice(0, 8).every(Boolean) && at.slice(8).every((p) => p === null) && close === 0, 'of more than eight agents the first eight are shown, none standing on another', [at.map((p) => (p ? 1 : 0)).join(''), close]);
  m.scene.destroy();
  // out of sight for more than a minute: what changed meanwhile is not played back
  const h = play(888, [[-1, FX.handover.crew]], 12000);
  h.scene.setCrew(FX.handover.script[0].crew);
  h.canvas.ctx.texts.length = 0; h.scene.frame(12000 + 61000);
  const p0 = h.scene.anchor('desk'), words = h.canvas.ctx.texts.slice();
  for (let t = 73000 + STEP; t <= 81000; t += STEP) h.scene.frame(t);
  ok(far(p0, h.scene.anchor('desk')) <= 1.5 && !words.includes('5 for you') && words.includes('5'), 'after more than a minute out of sight everybody is in place at once: no walk and no bubble for what changed meanwhile', [p0, h.scene.anchor('desk'), words]);
  h.scene.destroy();
}

// 12. the first real crew after an empty one starts in its chairs and walks; the same crew set again changes nothing
{
  const seats = play(888, [[-1, FX.morning.crew.map((a) => Object.assign({}, a, { state: 'due', waiting: 0 }))]], 0), home = IDS.map((id) => seats.scene.anchor(id)); seats.scene.destroy();
  let first = null;
  const a = play(888, [[-1, []], [1000, FX.morning.crew]], 16000, (t, s) => { if (!first && s.anchor('desk')) first = IDS.map((id) => s.anchor(id)); });
  const end = IDS.map((id) => a.scene.anchor(id)); a.scene.destroy();
  ok(first && first.every((p, i) => far(p, home[i]) <= 1.5), 'the first real crew after an empty one starts in its chairs', [home, first]);
  ok(end.every((p, i) => far(p, home[i]) > 12), 'and walks to its places from there', end.map((p, i) => Math.round(far(p, home[i]))));
  const track = (steps) => { const seen = []; const r = play(888, steps, 30000, (t, s) => seen.push(IDS.map((id) => { const p = s.anchor(id); return p ? Math.round(p.x * 100) + ',' + Math.round(p.y * 100) : '-'; }).join(' '))); const calls = r.canvas.ctx.calls; r.scene.destroy(); return seen.join('|') + '#' + calls; };
  const once = track([[-1, []], [1000, FX.morning.crew], [14000, FX.clear.crew]]);
  const often = track([[-1, []], [1000, FX.morning.crew], [1067, FX.morning.crew], [2500, FX.morning.crew], [9000, FX.morning.crew], [14000, FX.clear.crew], [14200, FX.clear.crew], [16000, FX.clear.crew], [29000, FX.clear.crew]]);
  ok(once === often, 'setting the same crew again (as the page does every 30 s and on every document change) restarts nothing, at rest or on the way', [once.length, often.length, once.slice(-12), often.slice(-12)]);
}
// ---- a frame of the loop that throws ends the picture: wiped, let go, and said once ----
{
  const mk = (host) => {
    const canvas = mkCanvas(), heard = []; let w = canvas.width, wipes = 0;
    Object.defineProperty(canvas, 'width', { get: () => w, set: (v) => { if (v === w) wipes++; w = v; } });   // set to what it is already: the way a canvas is wiped
    const s = API.create(canvas, Object.assign({ now: () => FX.morning.clock, seed: 7, reducedMotion: false, onHover() {}, onPick() {} }, host ? { onError: (e) => heard.push(e) } : {}));
    s.setCrew(FX.morning.crew); s.resize(888); s.start();
    return { canvas, s, heard, wipes: () => wipes };
  };
  const breakIt = (canvas, e) => { for (const k of ['fillRect', 'drawImage', 'fillText']) canvas.ctx[k] = () => { throw e; }; };
  // with somebody to tell
  const a = mk(true); let t = pump(30, 1000 / 60, 0);
  const boom = new Error('the canvas threw'), wiped0 = a.wipes(), listening0 = a.canvas.listeners.length;
  breakIt(a.canvas, boom);
  let out = null; try { t = pump(30, 1000 / 60, t); } catch (e) { out = e; }
  ok(out === null && a.heard.length === 1 && a.heard[0] === boom, 'a frame that throws: whoever made the scene is told once (onError), and nothing is thrown at the page', [out && String(out), a.heard.map(String)]);
  ok(raf.q.size === 0 && listening0 > 0 && a.canvas.listeners.length === 0 && a.wipes() === wiped0 + 1, '... the loop has stopped, the listeners are gone and the canvas is wiped (a picture that stands still would look current)', [raf.q.size, a.canvas.listeners.length, a.wipes() - wiped0]);
  let later = null; try { a.s.setCrew(FX.clear.crew); a.s.resize(700); a.s.frame(t + 100); a.s.start(); a.s.setFocus('desk'); t = pump(30, 1000 / 60, t); a.s.destroy(); } catch (e) { later = e; }
  ok(later === null && raf.q.size === 0 && a.heard.length === 1, '... and afterwards it does nothing, quietly: a crew, a size, a frame, start and the focus neither throw nor ask for a frame', [later && String(later), raf.q.size, a.heard.length]);
  // with nobody to tell
  const b = mk(false); t = pump(30, 1000 / 60, 0);
  const boom2 = new Error('the canvas threw again'); breakIt(b.canvas, boom2);
  let out2 = null; try { t = pump(30, 1000 / 60, t); } catch (e) { out2 = e; }
  let out3 = null; try { t = pump(30, 1000 / 60, t); } catch (e) { out3 = e; }
  ok(out2 === boom2 && out3 === null && raf.q.size === 0 && b.canvas.listeners.length === 0, 'with nobody to tell, the error goes on to the page once, and the loop has stopped all the same', [out2 && String(out2), out3 && String(out3), raf.q.size]);
  // under reduced motion the one frame for a change is guarded the same way
  const c = mk(true); c.s.destroy();
  const canvas = mkCanvas(), heard = [];
  const r = API.create(canvas, { now: () => FX.morning.clock, seed: 7, reducedMotion: true, onHover() {}, onPick() {}, onError: (e) => heard.push(e) });
  r.setCrew(FX.morning.crew); r.resize(888); r.start(); t = pump(10, 1000 / 60, 0);
  const boom3 = new Error('threw under reduced motion'); breakIt(canvas, boom3); r.setCrew(FX.clear.crew);
  let out4 = null; try { t = pump(10, 1000 / 60, t); } catch (e) { out4 = e; }
  ok(out4 === null && heard.length === 1 && heard[0] === boom3 && raf.q.size === 0, 'under reduced motion a throwing frame is reported and ends the picture the same way', [out4 && String(out4), heard.map(String), raf.q.size]);
}
// ---- what the review of the third round asked for ----
// 13. bubbles: always at their owner, never on each other, in turns where they cannot all be shown
{
  const W5 = [['desk', 'idle'], ['decide', 'working'], ['instinct', 'working'], ['muse', 'working'], ['review', 'idle']];
  const STEPS = { decide: 'Sorting seventeen new items', instinct: 'Checking pipeline health', muse: 'Drafting a longer answer' };
  const three = FX.clear.crew.map((a, i) => Object.assign({}, a, { state: W5[i][1], step: STEPS[a.id] || '', bubble: '' }));
  const owner = Object.fromEntries(Object.entries(STEPS).map(([id, text]) => [text, id]));
  // the box of a bubble from where its text was drawn (device px; letters 12 wide, see wideText)
  const boxOf = (e) => ({ text: e[0], x: e[1] - 12, y: e[2] - 23, w: e[0].length * 12 + 24, h: 32 });
  const laps = (p, q) => Math.min(p.x + p.w, q.x + q.w) > Math.max(p.x, q.x) && Math.min(p.y + p.h, q.y + q.h) > Math.max(p.y, q.y);
  for (const w of [366, 400, 888]) {
    const shown = {}, gap = {}, worstGap = {}, runs = {}; let frames = 0, away = [], onTop = [], twice = [], most = 0, flips = 0, prev = '';
    const r = play(w, [[-1, three]], 34000, (t, s, c) => {
      if (t < 12000) return;                                             // everybody is in its chair by then
      frames++;
      const first = c.ctx.textAt.map((e) => e.join('@'));
      const bubs = c.ctx.textAt.filter((e) => owner[e[0]]).map(boxOf);
      most = Math.max(most, bubs.length);
      bubs.forEach((b, i) => {
        const p = s.anchor(owner[b.text]), hx = p.x * 2, up = p.y * 2 - (b.y + b.h);
        const dx = hx < b.x ? b.x - hx : hx > b.x + b.w ? hx - (b.x + b.w) : 0;
        if (dx > 30 || up < 16 || up > (owner[b.text] === 'instinct' ? 72 : 64)) away.push([Math.round(t), b.text, Math.round(dx), Math.round(up)]);   // (right above an antenna is 8 px higher)
        for (let j = 0; j < i; j++) if (laps(b, bubs[j])) onTop.push([Math.round(t), b.text, bubs[j].text]);
      });
      Object.keys(owner).forEach((text) => { const on = bubs.some((b) => b.text === text); if (on) { shown[text] = (shown[text] || 0) + 1; gap[text] = 0; } else { gap[text] = (gap[text] || 0) + STEP; worstGap[text] = Math.max(worstGap[text] || 0, gap[text]); } });
      const now = bubs.map((b) => b.text).sort().join('|'); if (prev && now !== prev) flips++; prev = now;
      Object.keys(owner).forEach((text) => { const on = bubs.some((b) => b.text === text), r2 = runs[text] || (runs[text] = []); if (!r2.length || r2[r2.length - 1][0] !== on) r2.push([on, 0]); r2[r2.length - 1][1]++; });
      c.ctx.textAt.length = 0; s.frame(t);                               // the same moment once more
      if (c.ctx.textAt.map((e) => e.join('@')).join('#') !== first.join('#')) twice.push(Math.round(t));
    }, { wideText: true });
    ok(away.length === 0, `three neighbours at work @${w}: every bubble stands at its owner, over its head and less than a row above it`, away.slice(0, 4));
    ok(onTop.length === 0, `three neighbours at work @${w}: no bubble lies on another`, onTop.slice(0, 4));
    ok(Object.keys(owner).every((text) => (shown[text] || 0) >= frames * 0.2 && (worstGap[text] || 0) <= 7000), `three neighbours at work @${w}: each of them has its say (a fifth of the time or more, never silent for more than seven seconds)`, [frames, shown, worstGap]);
    // (a run: so many frames in a row on show, or not; the first and the last are cut short by the watching itself)
    const short = Object.entries(runs).map(([text, r2]) => [text, r2.slice(1, -1).filter((x) => x[1] < 38).map((x) => (x[0] ? '+' : '-') + x[1])]).filter((x) => x[1].length);
    ok(flips <= 9 && short.length === 0, `three neighbours at work @${w}: the bubbles do not flicker: whoever has the floor keeps it for 2.8 s, and nothing comes or goes for less than 2.5 s`, [flips, short]);
    ok(twice.length === 0, `three neighbours at work @${w}: the same moment drawn twice is the same picture, also when a turn ends`, twice.slice(0, 6));
    if (w === 366) ok(most < 3, 'three long bubbles do not fit side by side on a phone, so not all three are shown at once', most);
    // the one with the focus speaks at once, and keeps the floor while it has the focus
    const silent = Object.keys(owner).find((text) => !r.canvas.ctx.textAt.some((e) => e[0] === text));
    if (silent) {
      r.scene.setFocus(owner[silent]); let held = 0, n = 0;
      for (let t = 34000 + STEP; t <= 39000; t += STEP) { r.canvas.ctx.textAt.length = 0; r.scene.frame(t); n++; if (r.canvas.ctx.textAt.some((e) => e[0] === silent)) held++; }
      ok(held === n, `three neighbours at work @${w}: the one that has the focus speaks at once and for as long as it has it`, [silent, held, n]);
    } else ok(w !== 366, `three neighbours at work @${w}: somebody waits its turn on a phone`, r.canvas.ctx.textAt.map((e) => e[0]));
    r.scene.destroy();
  }
  // One has the floor at a time. A robot whose bubble can only stand where it covers a name (its places at its
  // owner are all taken) speaks when the floor is its own, for 2.8 s, and is not passed over.
  {
    const runsOf = (w, crew, texts, from, to, opts) => {
      const runs = {};
      const r = play(w, [[-1, []], [1000, crew]], to, (t, s, c) => { if (t < from) return; texts.forEach((text) => { const on = c.ctx.textAt.some((e) => e[0] === text), r2 = runs[text] || (runs[text] = []); if (!r2.length || r2[r2.length - 1][0] !== on) r2.push([on, 0]); r2[r2.length - 1][1]++; }); }, Object.assign({ wideText: true }, opts || {}));
      r.scene.destroy(); return runs;
    };
    const inner = (r2) => r2.slice(1, -1), say = (runs) => Object.fromEntries(Object.entries(runs).map(([k2, r2]) => [k2, r2.map((x) => (x[0] ? '+' : '-') + x[1]).join(' ')]));
    // Desk, Decide and Review at work with long steps, Instinct waiting, Muse without data
    const three = FX.clear.crew.map((a) => (a.id === 'desk' ? Object.assign({}, a, { state: 'working', step: 'Checking pipeline health' }) : a.id === 'decide' ? Object.assign({}, a, { state: 'working', step: 'Writing the Monday lines' }) : a.id === 'instinct' ? Object.assign({}, a, { state: 'needs', waiting: 3 }) : a.id === 'muse' ? Object.assign({}, a, { state: 'unknown' }) : Object.assign({}, a, { state: 'working', step: 'Drafting a longer answer' })));
    const steps3 = ['Checking pipeline health', 'Writing the Monday lines', 'Drafting a longer answer'];
    for (const w of [366, 400]) {
      const runs = runsOf(w, three, steps3, 30000, 70000);
      const bad = steps3.filter((text) => !runs[text] || inner(runs[text]).some((x) => x[1] < 38) || inner(runs[text]).filter((x) => x[0]).length < 2 || inner(runs[text]).some((x) => !x[0] && x[1] > 135));
      ok(bad.length === 0, `three at work beside a waiting one and an empty chair @${w}: each has the floor in turn, 2.5 s or more at a time and never silent for more than nine`, say(runs));
    }
    // Desk and Muse at work with long steps, two waiting between them: both fit, and nothing changes while nobody waits
    const two = FX.clear.crew.map((a) => (a.id === 'desk' ? Object.assign({}, a, { state: 'working', step: 'Checking pipeline health' }) : a.id === 'muse' ? Object.assign({}, a, { state: 'working', step: 'Sorting seventeen items' }) : a.id === 'review' ? a : Object.assign({}, a, { state: 'needs', waiting: 3 })));
    for (const w of [366, 888]) {
      const runs = runsOf(w, two, ['Checking pipeline health', 'Sorting seventeen items'], 30000, 60000);
      ok(Object.values(runs).length === 2 && Object.values(runs).every((r2) => r2.length === 1 && r2[0][0]), `two at work with room for both @${w}: both steps are on show all the time (nothing goes out for a frame while nobody waits)`, say(runs));
    }
    // eight on a phone, six of them at work: nobody is passed over
    const eight = FX.eight.crew.map((a, i) => Object.assign({}, a, 'wwnnwwww'[i] === 'w' ? { state: 'working', waiting: 0, step: ['Reading the thread', 'Sorting the inbox', '', '', 'Writing lines', 'Thinking it over', 'Asking Salesforce', 'Checking numbers'][i] } : { state: 'needs', waiting: i + 1, step: '' }));
    const steps8 = eight.filter((a) => a.step).map((a) => a.step);
    for (const w of [366, 400]) {
      const runs = runsOf(w, eight, steps8, 45000, 110000);
      const bad = steps8.filter((text) => !runs[text] || !runs[text].some((x) => x[0] && x[1] >= 38) || inner(runs[text]).some((x) => x[1] < 8));
      ok(bad.length === 0, `eight on a phone, six of them at work @${w}: every one of them gets the floor (2.5 s or more), and no step is on or off for less than half a second`, [bad, say(runs)]);
    }
  }
  // a change that has to wait for its turn is still shown
  const said = { desk: 'Desk has 113 for you', decide: 'Decide has 17 for you', instinct: 'Instinct has 3 for you', muse: 'Muse has 2 for you' };
  const four = FX.clear.crew.map((a) => (said[a.id] ? Object.assign({}, a, { state: 'needs', waiting: 3, bubble: said[a.id] }) : a));
  for (const w of [366, 888]) {
    const seen = {}; let onTop = 0;
    const r = play(w, [[-1, FX.clear.crew], [14000, four]], 27000, (t, s, c) => {
      const bubs = c.ctx.textAt.filter((e) => Object.values(said).includes(e[0])).map(boxOf);
      bubs.forEach((b, i) => { seen[b.text] = (seen[b.text] || 0) + 1; for (let j = 0; j < i; j++) if (laps(b, bubs[j])) onTop++; });
    }, { wideText: true });
    ok(Object.values(said).every((text) => (seen[text] || 0) >= 15) && onTop === 0, `four change at once @${w}: each one's words are shown for a second or more within thirteen, none on top of another`, [seen, onTop]);
    ok(!r.canvas.ctx.textAt.some((e) => Object.values(said).includes(e[0])), `four change at once @${w}: and the words are gone again afterwards`, r.canvas.ctx.textAt.map((e) => e[0]));
    r.scene.destroy();
  }
  // the sign over one that has failed is never covered by somebody else's bubble; and a change that has had its say
  // and lost the floor does not come back
  {
    const fail = FX.clear.crew.map((a) => (a.id === 'desk' ? Object.assign({}, a, { state: 'working', step: 'Checking pipeline health now' }) : a.id === 'decide' ? Object.assign({}, a, { state: 'error', bubble: 'The run has failed' }) : a.id === 'instinct' ? Object.assign({}, a, { state: 'late', bubble: 'No result since 13:13' }) : a));
    for (const w of [366, 400, 888]) {
      let covered = 0, signs = 0, said = 0, cut = 0; const runsOf = {}, on = {};
      const r = play(w, [[-1, FX.clear.crew], [14000, fail]], 40000, (t, s, c) => {
        if (t < 14000) return;
        const p = s.anchor('decide'), sign = { x: p.x * 2 - 16, y: p.y * 2 - 80, w: 36, h: 44 };   // the sign over Decide (device px), from its anchor
        signs++;
        // the others' bubbles, whole or shortened (as much as fits beside the sign, with an ellipsis)
        const others = ['Checking pipeline health now', 'No result since 13:13'], isOf = (text, full) => text === full || (text.endsWith('…') && text.length > 6 && full.startsWith(text.slice(0, -1).trimEnd()));
        c.ctx.textAt.forEach((e) => { if (!others.some((full) => isOf(e[0], full))) return; if (isOf(e[0], others[0])) said++; if (e[0].endsWith('…')) cut++; if (laps(boxOf(e), sign)) covered++; });
        for (const text of ['The run has failed', 'No result since 13:13']) { const now = c.ctx.textAt.some((e) => e[0] === text); if (now && !on[text]) runsOf[text] = (runsOf[text] || []).concat([0]); if (now) runsOf[text][runsOf[text].length - 1]++; on[text] = now; }
      }, { wideText: true });
      const back = Object.entries(runsOf).filter(([, runs]) => { let told = 0; for (let i = 0; i < runs.length - 1; i++) { told += runs[i]; if (told >= 42) return true; } return false; });
      ok(covered === 0 && signs > 300, `one fails beside one at work @${w}: nobody else's bubble covers the sign over the one that failed`, [covered, signs]);
      ok(said >= 150 && (w === 888 ? cut === 0 : cut >= 150), `one fails beside one at work @${w}: the one at work still says its step, ${w === 888 ? 'whole where there is room' : 'as much of it as fits beside the sign on a phone'}`, [said, cut]);
      ok(Object.keys(runsOf).length === 2 && back.length === 0, `one fails beside one at work @${w}: both changes are said, and one that has had its say (2.8 s) and lost the floor does not come back`, runsOf);
      r.scene.destroy();
    }
  }
  // reduced motion: nothing takes turns; the lowest desk speaks, and whoever has the focus
  {
    const c = mkCanvas(); c.ctx.measureText = (str) => ({ width: String(str).length * 12 });
    const s = API.create(c, { now: () => FX.morning.clock, seed: 7, reducedMotion: true, onHover() {}, onPick() {} });
    s.setCrew(three); s.resize(366); s.frame(0);
    const texts = () => c.ctx.textAt.filter((e) => owner[e[0]]).map((e) => e[0]);
    c.ctx.textAt.length = 0; s.frame(1000); const still = texts();
    const hidden = Object.keys(owner).find((text) => !still.includes(text));
    ok(still.includes(STEPS.decide) && !!hidden, 'reduced motion: the lowest desk speaks, and somebody waits', still);
    if (hidden) { s.setFocus(owner[hidden]); c.ctx.textAt.length = 0; s.frame(2000); ok(texts().includes(hidden), 'reduced motion: the one that has the focus speaks', texts()); }
    s.destroy();
  }
  // reduced motion: the one with the floor stands where its neighbour has room too, and where the focus has been
  // does not show afterwards
  {
    const pair = FX.clear.crew.map((a) => (a.id === 'desk' ? Object.assign({}, a, { state: 'working', step: 'Reading the lot' }) : a.id === 'decide' ? Object.assign({}, a, { state: 'working', step: 'Sorting 9 items' }) : Object.assign({}, a, { state: 'needs', waiting: 2 })));
    const c = mkCanvas(); c.ctx.measureText = (str) => ({ width: String(str).length * 12 });
    const s = API.create(c, { now: () => FX.morning.clock, seed: 7, reducedMotion: true, onHover() {}, onPick() {} });
    s.setCrew(pair); s.resize(888); s.frame(0);
    const snap = () => { c.ctx.textAt.length = 0; s.frame(1000); return c.ctx.textAt.filter((e) => e[0] === 'Reading the lot' || e[0] === 'Sorting 9 items').map((e) => e.join('@')).sort().join(' | '); };
    const before = snap();
    for (const id of ['decide', 'desk', 'instinct', 'decide']) { s.setFocus(id); snap(); } s.setFocus(null);
    const after = snap();
    ok(before.includes('Reading the lot') && before.includes('Sorting 9 items') && after === before, 'reduced motion: two neighbours at work are both shown where both fit (the one with the floor stands aside for the other), and the picture is the same after the focus has been on each of them', [before, after]);
    s.destroy();
  }
}

// 14. an agent that takes another's place under a new id has its name drawn; a tap that led somewhere is over
{
  const one = (id) => [{ id, name: 'Solo', look: 'plain', hue: 'teal', state: 'idle', waiting: 0, step: '', bubble: '', fresh: 0 }];
  const r = play(888, [[-1, one('a')]], 12000);
  r.scene.setCrew(one('b')); let drawn = 0;
  for (let t = 12000 + STEP; t <= 16000; t += STEP) { r.canvas.ctx.texts.length = 0; r.scene.frame(t); }
  drawn = r.canvas.ctx.texts.filter((x) => x === 'Solo').length;
  ok(drawn === 1, 'an agent that takes another one\'s place under a new id has its name drawn', drawn);
  r.scene.destroy();
  const tap = (went) => {
    const q = play(400, [[-1, FX.morning.crew]], 14000, null, { onPick: () => went }), p = q.scene.anchor('desk'), h = [];
    const s2 = q.scene; q.heard.hover.length = 0;
    return { q, p, h, s2 };
  };
  for (const [went, what] of [[true, 'that led somewhere'], [undefined, 'that led nowhere']]) {
    const canvas = mkCanvas(), hover = [], picks = []; let simT = 0;
    const s = API.create(canvas, { now: () => FX.morning.clock + simT, seed: 7, reducedMotion: false, onHover: (id) => hover.push(id), onPick: (id) => { picks.push(id); return went; } });
    s.setCrew(FX.morning.crew); s.resize(400);
    for (let t = 0; t <= 14000; t += STEP) { simT = t; s.frame(t); }
    const p = s.anchor('desk');
    point(canvas, p.x, p.y, 'touch', 'pointerdown'); point(canvas, p.x, p.y, 'touch', 'pointerleave'); point(canvas, p.x, p.y, 'touch', 'click');
    for (let t = 14000 + STEP; t <= 16000; t += STEP) { simT = t; s.frame(t); }
    if (went === true) ok(picks.join() === 'desk' && hover.join() === 'desk,', `a tap ${what}: the robot is picked, and nothing stays pointed at`, [picks, hover]);
    else ok(picks.join() === 'desk' && hover.join() === 'desk', `a tap ${what}: the robot stays pointed at (its tooltip stays)`, [picks, hover]);
    // a mouse that clicks stays where it is: the robot under it stays pointed at
    hover.length = 0; picks.length = 0;
    point(canvas, 2, 2, 'touch', 'pointerdown');
    point(canvas, p.x, p.y, 'mouse', 'pointermove'); point(canvas, p.x, p.y, 'mouse', 'click');
    for (let t = 16000 + STEP; t <= 17000; t += STEP) { simT = t; s.frame(t); }
    ok(picks.join() === 'desk' && hover[hover.length - 1] === 'desk', `a click with the mouse ${what}: the robot under the pointer stays pointed at`, [picks, hover]);
    s.destroy();
  }
}

// 15. with a probe (a copy of the scene that also hands out its layout and its crew, read only): what cannot be seen
// from outside
{
  const fs = require('fs');
  const src = fs.readFileSync(FILE, 'utf8'), line = '      frame, start, stop, destroy, hit, anchor,\n';
  ok(src.split(line).length === 2, 'the probe finds the line of the scene it hooks into');
  if (src.split(line).length === 2) {
    const keep = global.OSCockpit;
    new Function(src.replace(line, () => line + '      _dbg: () => ({ L, crew, qPitch, feet: (id) => { const a = byId.get(id); return a ? feet(a) : null; } }),\n'))();
    const P = global.OSCockpit; global.OSCockpit = keep;
    const mkRnd = (seed) => { let v = (seed * 2654435761) >>> 0; return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; }; };
    const mk = (opts) => { const canvas = mkCanvas(); const st = { t: 0 }; const s = P.create(canvas, Object.assign({ now: () => FX.morning.clock + st.t, seed: 7, reducedMotion: false, onHover() {}, onPick() {} }, opts || {})); return { canvas, s, st, run: (to) => { for (; st.t <= to; st.t += STEP) s.frame(st.t); } }; };
    const crewOf = (states) => states.map((state, i) => Object.assign({}, FX.eight.crew[i], { state, waiting: state === 'needs' ? i + 1 : 0, step: state === 'working' ? 'Reading Slack' : '', bubble: '' }));
    // what stands on the floor and is taller than a robot's feet are high: x, top, w, base (as drawn)
    const piecesOf = (L) => L.plants.map((p) => ({ kind: 'plant', x: p.x, top: p.y, w: 14, base: p.y + 22 })).concat(L.extras.map((e) => (e.kind === 'meet' ? { kind: 'meet', x: e.x + 18, top: e.y + 5, w: 44, base: e.y + 36 } : e.kind === 'board' ? { kind: 'board', x: e.x, top: e.y, w: 30, base: e.y + 33 }
      : e.kind === 'foos' ? { kind: 'foos', x: e.x, top: e.y, w: 44, base: e.y + 28 } : e.kind === 'pong' ? { kind: 'pong', x: e.x, top: e.y + 1, w: 56, base: e.y + 31 } : { kind: 'bags', x: e.x, top: e.y + 1, w: 40, base: e.y + 14 })));
    // a robot's figure lies on a piece it is behind (its feet are above the piece's base and below its top)
    const behind = (f, p) => f.y < p.base - 1 && f.y > p.top + 1 && Math.min(f.x + 7, p.x + p.w) - Math.max(f.x - 7, p.x) > 1;
    // the low furniture, as it stands on the floor (a desk has a way into its chair from behind: sx is the chair)
    const lowOf = (L) => L.desks.map((d) => ({ x: d.x0, y: d.dy - 11, w: d.w, h: 27, sx: d.sx, dy: d.dy })).concat([{ x: L.table.x, y: L.table.y, w: 24, h: 12 }, { x: L.cart.x, y: L.cart.y - 14, w: 28, h: 32 }, { x: L.sofa.x, y: L.sofa.y, w: 58, h: 24 }]);
    const inside = (f, o) => f.x > o.x && f.x < o.x + o.w && f.y > o.y && f.y < o.y + o.h && !(o.sx !== undefined && Math.abs(f.x - o.sx) <= 3.5 && f.y <= o.dy);

    // no place in a long queue is on a plant
    { const hit = [];
      for (const [ratio, widths] of [[1, [1690, 1740, 1776, 1800, 1856, 1900, 2074, 2160]], [2, [2130, 2200, 2350, 2560]]]) { global.devicePixelRatio = ratio;
        for (const w of widths) for (const n of [6, 7, 8]) { const m = mk({ reducedMotion: true }); m.s.setCrew(crewOf(Array(n).fill('needs'))); m.s.resize(w); m.s.frame(0); const d = m.s._dbg();
          d.crew.forEach((a) => { const f = d.feet(a.id); d.L.plants.forEach((p) => { if (Math.min(f.x + 7, p.x + 14) - Math.max(f.x - 7, p.x) > 0 && f.y > p.y && f.y < p.y + 22) hit.push([ratio, w, n, a.id]); }); }); m.s.destroy(); } }
      global.devicePixelRatio = 2;
      ok(hit.length === 0, 'with six to eight waiting on a very wide page, no place in the queue is on a plant', hit.slice(0, 4)); }

    // nobody is painted over furniture it is behind, on the way or at rest; and everybody still gets where it belongs
    { const ST = ['working', 'due', 'needs', 'needs', 'needs', 'idle', 'idle', 'idle', 'late'];
      for (const [ratio, w] of [[1, 1920], [2, 2560], [1, 640]]) { global.devicePixelRatio = ratio; let over = 0, moving = 0; const kinds = {};
        for (let run = 0; run < 4; run++) { const rnd = mkRnd(9000 + run * 17 + w), n = 4 + Math.floor(rnd() * 5), pick = () => Array.from({ length: n }, () => ST[Math.floor(rnd() * ST.length)]);
          const m = mk(); m.s.setCrew([]); m.s.resize(w);
          for (const at of [1000, 36000, 71000]) { m.run(at); m.s.setCrew(crewOf(pick())); const end = at + 35000;
            for (; m.st.t <= end; m.st.t += STEP) { m.s.frame(m.st.t); const d = m.s._dbg(), ps = piecesOf(d.L); d.crew.forEach((a) => { if (a.state === 'unknown' || !(a.alpha > 0.5)) return; const f = d.feet(a.id); ps.forEach((p) => { if (behind(f, p)) { over++; kinds[p.kind] = (kinds[p.kind] || 0) + 1; } }); }); }
            moving += m.s._dbg().crew.filter((a) => a.state !== 'unknown' && (a.path || a.pending)).length; }
          m.s.destroy(); }
        ok(over === 0, `a wide room @${w} at ratio ${ratio}: nobody is painted over a table, a board or a plant it stands or walks behind`, [over, kinds]);
        ok(moving === 0, `a wide room @${w} at ratio ${ratio}: and everybody is in place 35 s after each change`, moving); }
      global.devicePixelRatio = 2; }

    // the room changes size while they change places: nobody is dropped into the furniture
    { let inFurn = 0, stoodUp = 0; const notes = [];
      for (const [w0, w1, wait] of [[700, 400, 300], [400, 888, 300], [888, 400, 1200], [888, 1280, 2500], [700, 366, 5000]]) {
        const m = mk(); m.s.setCrew([]); m.s.resize(w0); m.run(1000); m.s.setCrew(crewOf(['idle', 'idle', 'idle', 'idle', 'idle'])); m.run(22000);
        m.s.setCrew(crewOf(['working', 'needs', 'working', 'needs', 'due'])); m.run(22000 + wait);
        const sat = m.s._dbg().crew.filter((a) => a.sitKind === 'sofa' && a.seated && a.pending).map((a) => a.id);
        m.s.resize(w1);
        m.s._dbg().crew.forEach((a) => { if (sat.includes(a.id) && !(a.sitKind === 'sofa' && a.seated)) stoodUp++; });
        const end = m.st.t + 14000;
        for (; m.st.t <= end; m.st.t += STEP) { m.s.frame(m.st.t); const d = m.s._dbg(), low = lowOf(d.L); d.crew.forEach((a) => { if (a.sitKind) return; const f = d.feet(a.id); if (low.some((o) => inside(f, o))) { inFurn++; if (notes.length < 3) notes.push([w0, w1, a.id, Math.round(f.x), Math.round(f.y)]); } }); }
        m.s.destroy(); }
      ok(inFurn === 0, 'the page changes width while robots change places: nobody stands or walks inside a desk, the table or the coffee cart afterwards', [inFurn, notes]);
      ok(stoodUp === 0, '... and one still waiting on the sofa for its turn stays seated on the sofa of the new room', stoodUp); }

    // the queue's row when the room changes as some leave it: each who still waits keeps a place in the row
    { global.devicePixelRatio = 3;
      // five on a phone, all waiting; one leaves and the phone is turned in the same update
      const m = mk(); m.s.setCrew([]); m.s.resize(366); m.run(1000); m.s.setCrew(crewOf(['needs', 'needs', 'needs', 'needs', 'needs'])); m.run(30000);
      m.s.setCrew(crewOf(['working', 'needs', 'needs', 'needs', 'needs'])); m.s.resize(844);
      const d = m.s._dbg(), wait = d.crew.filter((a) => a.state === 'needs'), xs = wait.map((a) => a.x).sort((p, q2) => p - q2);
      const inRow = wait.every((a) => Math.abs(a.y - d.L.q.y) < 1 && a.x >= d.L.q.x0 - 1 && a.x <= d.L.q.max + 1), apart = xs.every((x, i) => i === 0 || x - xs[i - 1] >= 14);
      const t0 = m.st.t; let done = null; for (; m.st.t <= t0 + 12000 && done === null; m.st.t += STEP) { m.s.frame(m.st.t); if (!m.s._dbg().crew.some((a) => a.path || a.pending)) done = m.st.t - t0; }
      ok(inRow && apart && done !== null && done <= 5000, 'five wait on a phone, one leaves as the phone is turned: the four who still wait stand in the queue\'s row of the new room, apart, and all are in place within five seconds', [inRow, apart, xs.map(Math.round), done]);
      m.s.destroy();
      // seven wait on a wide page, three leave as it becomes a phone
      const w7 = mk(); w7.s.setCrew([]); w7.s.resize(1600); w7.run(1000); w7.s.setCrew(crewOf(Array(7).fill('needs'))); w7.run(45000);
      w7.s.setCrew(crewOf(['idle', 'idle', 'needs', 'needs', 'needs', 'idle', 'needs'])); w7.s.resize(375);
      const near = () => { const d2 = w7.s._dbg(), v = d2.crew.map((a) => d2.feet(a.id)); let n2 = 0; for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (Math.hypot(v[i].x - v[j].x, v[i].y - v[j].y) < 6) n2++; return n2; };
      const at0 = near(); let heaped = 0; const t1 = w7.st.t; for (; w7.st.t <= t1 + 14000; w7.st.t += STEP) { w7.s.frame(w7.st.t); if (near()) heaped++; }
      ok(at0 === 0 && heaped <= 8, 'seven wait on a wide page, three leave as it becomes a phone: nobody is put on top of anybody, and nobody hides another for more than half a second afterwards', [at0, heaped]);
      w7.s.destroy(); global.devicePixelRatio = 2; }

    // the band along the bottom of a narrow room: the way along the desks is open (a table stood in it)
    { const trips = [];
      for (const [w, n, who] of [[620, 6, 3], [560, 3, 1], [708, 7, 3]]) { const m = mk(); m.s.setCrew([]); m.s.resize(w); m.run(1000); const st = Array(n).fill('working'); m.s.setCrew(crewOf(st)); m.run(30000);
        st[who] = 'idle'; m.s.setCrew(crewOf(st)); const t0 = m.st.t; let done = null; for (; m.st.t <= t0 + 12000 && done === null; m.st.t += STEP) { m.s.frame(m.st.t); const a = m.s._dbg().crew[who]; if (!a.path && !a.pending) done = m.st.t - t0; }
        trips.push([w, n, done, m.s._dbg().L.extras.map((e) => e.kind).join()]); m.s.destroy(); }
      ok(trips.every((x) => x[2] !== null && x[2] <= 4200 && !/foos/.test(x[3])), 'a narrow room of 544 to 719 px: a robot is at the coffee within four seconds of leaving its desk (nothing closes the way along the desks)', trips); }

    // a zoom that keeps the room's logical size but not the size of a pixel: placed for the new room at once
    { const m = mk(); m.s.setCrew([]); m.s.resize(400); m.run(1000); m.s.setCrew(FX.morning.crew); m.run(21000);
      const xs = () => { const d = m.s._dbg(); return d.crew.filter((a) => a.state === 'needs').map((a) => Math.round(d.feet(a.id).x * 10) / 10); };
      const before = xs(), w0 = m.s._dbg().L.W;
      global.devicePixelRatio = 2.2; m.s.resize(364); const d1 = m.s._dbg(), at = xs(), want = at.map((x, j) => Math.round((d1.L.q.x0 + j * d1.qPitch) * 10) / 10);
      m.run(m.st.t + 3000); m.s.setCrew(FX.morning.crew); m.run(m.st.t + 9000); const after = xs();
      global.devicePixelRatio = 2;
      ok(d1.L.W === w0 && at.join() === want.join() && at.join() !== before.join() && after.join() === at.join(), 'a zoom that keeps the room as wide but changes the size of a pixel: the queue is spaced for the new room at once, and nobody shuffles later', [w0, d1.L.W, before, at, want, after]);
      m.s.destroy(); }
  }
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
