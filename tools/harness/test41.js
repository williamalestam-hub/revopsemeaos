// The cockpit scene (dashboard/os-cockpit-scene.js) against its contract, with a recording stand-in for the canvas:
// every made-up crew at five widths runs without throwing or drawing at NaN, names and slip counts are drawn, anchors
// hit their own agent, the same seed draws the same thing, the frame loop is capped and stops when the tab is hidden,
// reduced motion places agents at once, and destroy() lets go of listeners and frames.
//   node tools/harness/test41.js [path/to/scene.js]
const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '../../dashboard/os-cockpit-scene.js'));
const FX = require('../cockpit-preview/fixtures.js');
let fails = 0, passes = 0;
const ok = (c, l, x) => { if (c) passes++; else fails++; if (!c || process.env.VERBOSE) console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x).slice(0, 300))); };

// ---- stand-ins ----
const mkCtx = () => {
  const rec = { calls: 0, bad: 0, texts: [], alphas: [] };
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
        if (k === 'fillText' || k === 'strokeText') t.texts.push(String(args[0]));
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
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
