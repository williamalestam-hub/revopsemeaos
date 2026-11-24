// EMEA RevOps OS cockpit: the scene (contract 2), art direction "top-down bullpen".
// A three-quarter top-down pixel office on one canvas: the bullpen with the agents' desks, your corner with the big
// desk and the queue, a lounge with the coffee. Everything is drawn here with canvas rectangles: no images, no fonts,
// no network. The scene never reads the database, dash, OS or the model: it is handed a crew and draws it.
//   const scene = OSCockpit.create(canvas, { now, seed, reducedMotion, onHover, onPick })
//   scene.setCrew(crew) / resize(cssWidth) / frame(tMs) / start() / stop() / destroy() / hit(x, y) / anchor(id) / setFocus(id)
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const mulberry = (seed) => { let a = (seed | 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = (a, b) => { let h = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x632BE5AB, 0x85EBCA6B)) | 0; h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const css = (c) => 'rgb(' + Math.round(clamp(c[0], 0, 255)) + ',' + Math.round(clamp(c[1], 0, 255)) + ',' + Math.round(clamp(c[2], 0, 255)) + ')';
  const cssA = (c, a) => 'rgba(' + Math.round(clamp(c[0], 0, 255)) + ',' + Math.round(clamp(c[1], 0, 255)) + ',' + Math.round(clamp(c[2], 0, 255)) + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);   // crew values are untrusted: 'constructor' is not a hue

  // ───────── palette (daylight; the hour tints it) ─────────
  const INK = '#2a2238';
  const HUES = {
    teal: ['#2ec4b6', '#a2f5ea', '#168a85'], amber: ['#f7ae2e', '#ffe08a', '#c27712'], rose: ['#f0608f', '#ffb0c9', '#b33866'],
    violet: ['#9273f2', '#cdbdff', '#5b42b3'], blue: ['#3f8ff5', '#a3ceff', '#225db3'], green: ['#63c655', '#b4f29a', '#378a39'],
  };
  const LOOKS = { headset: 1, gavel: 1, antenna: 1, bulb: 1, clipboard: 1, plain: 1 };
  const STATES = { working: 1, due: 1, late: 1, error: 1, needs: 1, idle: 1, unknown: 1 };
  const METAL = '#c9ccd9', METAL_D = '#8d90a6', VISOR = '#231d33', EYE = '#b6f6ff', EYE_DIM = '#6fb4c6';
  const PAPER = '#fffdf2', PAPER_D = '#e6dcc4', WOOD = '#c98a4a', WOOD_D = '#8a5230';
  const GREEN = [96, 232, 112], AMBER = [255, 190, 56], RED = [255, 86, 86];
  const SHADOW = 'rgba(38,24,44,0.22)';
  const BOOKS = ['#d9534f', '#f0ad4e', '#5bc0de', '#6cc070', '#9b6bd3', '#efe6cf', '#3d6d99', '#e58a5a', '#2f8f7f'];
  const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // ───────── the hour: sky, the room's light, lamps ─────────
  // Day length follows the date (Stockholm: about six hours in December, eighteen in June); hours are the viewer's own.
  function lightAt(ms) {
    const d = new Date(num(ms, 0));
    let h = d.getHours() + d.getMinutes() / 60, mo = d.getMonth(), dom = d.getDate();
    if (!isFinite(h)) { h = 12; mo = 10; dom = 24; }
    const doy = mo * 30.44 + dom;
    const len = 12.35 + 6.3 * Math.cos((doy - 172) * TAU / 365.25);
    const noon = 11.6 + (doy > 88 && doy < 299 ? 1 : 0);
    const rise = noon - len / 2, set = noon + len / 2;
    const up = smooth((h - (rise - 0.9)) / 1.6), dn = 1 - smooth((h - (set - 0.7)) / 1.6);
    const bell = (c) => Math.exp(-Math.pow((h - c) / 0.75, 2));
    const q = (v) => Math.round(v * 20) / 20;
    const day = q(Math.min(up, dn)), glow = q(Math.max(bell(rise + 0.15), bell(set - 0.15)));
    const top = mix(mix([13, 17, 44], [104, 176, 232], day), [92, 92, 168], glow * 0.55);
    const bot = mix(mix([30, 38, 88], [214, 236, 248], day), [255, 168, 104], glow * 0.9);
    const mid = mix(mix(top, bot, 0.55), [244, 138, 148], glow * 0.55);
    let amb = mix([0.52, 0.56, 0.82], [1, 1, 1], Math.pow(day, 0.8));
    amb = [amb[0], amb[1] * lerp(1, 0.93, glow * 0.7), amb[2] * lerp(1, 0.84, glow * 0.7)];
    const lamp = q(clamp((0.8 - day) / 0.5, 0, 1));
    const hq = Math.round(h * 2) / 2;
    return {
      h, day, glow, lamp, amb, top, mid, bot, winter: !(doy > 105 && doy < 290),
      skew: clamp((12 - hq) * 3, -12, 12), late: h >= 19 || h < 7,
      key: day + '|' + glow + '|' + (day > 0 ? hq : 0),
    };
  }

  // ───────── layout: where everything stands, in logical pixels ─────────
  // sc: css px per logical pixel (2 as a rule); words are sized in css px, so spacing that has to fit a name tag follows it
  function makeLayout(Wf, n, sc) {
    const W = Math.max(150, Math.floor(num(Wf, 150)));
    const wide = W >= 360;
    const wallH = wide ? 36 : 32;
    const Lw = wide ? clamp(Math.round(W * 0.3), 128, 200) : 0, lx0 = W - Lw;
    const wd = { x: wide ? 14 : 8, w: wide ? 54 : 50, by: wallH + (wide ? 18 : 15) };
    wd.seat = wd.x + 30; wd.base = wd.by + 21; wd.tray = { x: wd.x + wd.w - 15, y: wd.by + 5 };
    const q = { x0: wd.x + wd.w + 13, y: wd.by + 22, pitch: Math.max(wide ? 30 : 26, Math.ceil(52 / (sc || 2))), max: wide ? lx0 - 16 : W - 16 };
    // bullpen
    const roomy = W >= 200;                                            // from 400 css px a narrow room has a lane down the left side too
    const ax = wide ? 10 : roomy ? 24 : 6, aw = Math.max(40, (wide ? lx0 - 12 : W - 24) - ax);
    const maxCols = Math.max(1, Math.floor(aw / (wide ? 34 : 30)));
    const rows = clamp(Math.ceil(n / maxCols), 1, 2), cols = Math.max(1, Math.ceil(n / rows));
    const pitch = Math.min(wide ? 76 : 46, aw / cols), dw = pitch >= 33 ? 30 : clamp(Math.floor(pitch) - 2, 22, 28);
    const gx = ax + (aw - pitch * cols) / 2;
    const tight = !wide && rows > 1 && n < 8;
    const dy0 = q.y + (tight ? 24 : 36), rowP = tight ? 34 : 36;
    const desks = [];
    for (let i = 0; i < n; i++) {
      const r = Math.min(rows - 1, Math.floor(i / cols)), c = i - r * cols;
      const cx = Math.round(gx + pitch * (c + 0.5)), x0 = cx - Math.floor(dw / 2), dy = dy0 + r * rowP;
      desks.push({ i, cx, x0, w: dw, dy, sx: x0 + dw - 10, sy: dy - 2, base: dy + 16, scr: { x: x0 + 2, y: dy - 10 }, lx: x0 + dw - 5 });
    }
    const lastDy = dy0 + (rows - 1) * rowP;
    const L = { W, wide, wallH, n, wd, q, desks, lx0, Lw, dy0, lastDy, plants: [], rugs: [], obst: [] };
    // wall: bookshelf, windows, clock, a framed print
    const shelf = L.shelf = wide ? { x: 9, w: 30, top: 6, bottom: wallH + 7 } : { x: 5, w: 26, top: 5, bottom: wallH + 6 };
    const xs = shelf.x + shelf.w + (wide ? 9 : 5), span = W - (wide ? 8 : 6) - xs;
    const nw = wide ? Math.max(2, Math.round(span / 80)) : (span >= 150 ? 3 : 2), slot = span / nw;
    const ww = Math.round(Math.min(wide ? 46 : 40, slot - (wide ? 30 : 21)));
    L.windows = [];
    for (let i = 0; i < nw; i++) L.windows.push({ x: Math.round(xs + slot * i + (slot - ww) / 2), y: wide ? 8 : 7, w: ww, h: wide ? 22 : 19 });
    L.clock = { x: Math.round(xs + slot), y: wide ? 18 : 16 };
    L.chart = nw < 3 ? null : wide ? { x: Math.round(xs + slot * 2) - 13, y: 9, big: true } : { x: Math.round(xs + slot * 2) - 8, y: 9 };
    // lounge
    let H, sofa, table, cart, spots;
    if (wide) {
      H = lastDy + 16 + 14 + 3;
      sofa = { x: lx0 + (Lw >= 150 ? 26 : 6), y: wallH - 5 };
      cart = { x: W - 36 - (Lw >= 170 ? 8 : 0), y: wallH + 7 };
      table = { x: sofa.x + 17, y: sofa.y + 38 };
      L.lamp = { x: sofa.x + 61, y: wallH - 19 };
      if (Lw >= 150) L.plants.push({ x: lx0 + 6, y: wallH - 15 });
      L.plants.push({ x: W - 20, y: H - 29 });
      const gi = Math.floor((lx0 - 18 - xs) / slot);
      if (gi >= 3) L.cooler = { x: Math.round(xs + slot * gi) - 5, y: wallH - 20 };
      if (gi >= 4) L.cabinet = { x: Math.round(xs + slot * 3) - 11, y: wallH - 17 };          // a long wall gets a printer on a cabinet
      if (gi >= 6) L.plants.push({ x: Math.round(xs + slot * 5) - 7, y: wallH - 15 });
      if (gx - ax >= 26) L.plants.push({ x: ax + 2, y: H - 29 });
      spots = [
        { x: cart.x - 9, y: cart.y + 19, coffee: true }, { x: sofa.x + 16, y: sofa.y + 27, sofa: true }, { x: table.x + 34, y: table.y + 17 },
        { x: sofa.x + 43, y: sofa.y + 27, sofa: true }, { x: table.x - 10, y: table.y + 17 }, { x: table.x + 12, y: table.y + 28 },
        { x: cart.x + 14, y: cart.y + 38 }, { x: table.x + 56, y: table.y + 32 },
      ];
      L.rugs.push({ kind: 'you', x: 8, y: wd.by - 13, w: Math.min(lx0 - 8, q.x0 + 4 * q.pitch + 14) - 8, h: q.y + 8 - (wd.by - 13) });
      L.rugs.push({ kind: 'lounge', x: sofa.x - 2, y: sofa.y + 21, w: Math.min(W - 8 - (sofa.x - 2), 62 + Math.max(0, Lw - 128)), h: Math.min(50, H - 8 - (sofa.y + 21)) });
      L.lights = [[L.lamp.x + 4, L.lamp.y + 24, 56, 34, 0.95], [cart.x + 12, cart.y + 4, 30, 22, 0.6]];
    } else {
      const y0 = lastDy + 21;
      H = y0 + (tight ? 42 : 48);
      sofa = { x: roomy ? 24 : 8, y: y0 + 3 };
      table = { x: sofa.x + 64, y: y0 + 13 };
      cart = { x: W - 56, y: y0 + 10 };
      L.plants.push({ x: W - 19, y: wallH - 13 });
      const fy = y0 + 31, st = cart.x - (roomy ? 17 : 20);
      spots = [
        { x: cart.x + 36, y: fy, coffee: true }, { x: sofa.x + 16, y: sofa.y + 27, sofa: true }, { x: st, y: fy },
        { x: sofa.x + 43, y: sofa.y + 27, sofa: true }, roomy ? { x: sofa.x - 11, y: fy } : { x: table.x + 12, y: fy + 3 }, { x: roomy ? table.x + 12 : st - 12, y: fy + (roomy ? 3 : 6) },
        { x: cart.x + 14, y: fy + 5 }, { x: sofa.x + 29, y: fy + 6 },
      ];
      L.rugs.push({ kind: 'you', x: 4, y: wd.by - 12, w: W - 9, h: q.y + 8 - (wd.by - 12) });
      L.rugs.push({ kind: 'lounge', x: sofa.x - 3, y: y0 + 17, w: table.x + 30 - (sofa.x - 3), h: 22 });
      L.lights = [[table.x - 10, y0 + 20, 66, 27, 0.8], [cart.x + 12, cart.y + 8, 34, 24, 0.7]];
    }
    if (desks.length) {
      const a = desks[0], b = desks[Math.min(cols, n) - 1];
      L.rugs.push({ kind: 'pen', x: a.x0 - 6, y: dy0 - 13, w: b.x0 + b.w + 6 - (a.x0 - 6), h: lastDy + 19 - (dy0 - 13) });
    }
    spots.forEach((p) => { p.x = clamp(p.x, 11, W - 12); p.y = clamp(p.y, wallH + 8, H - 6); });
    Object.assign(L, { H, sofa, table, cart, spots });
    // what a robot has to walk around (floor footprints, with the tall parts behind them)
    L.obst.push({ x: wd.x, y: wd.by - 15, w: wd.w, h: 36 });
    desks.forEach((d) => L.obst.push({ x: d.x0, y: d.dy - 11, w: d.w, h: 27 }));
    L.obst.push({ x: sofa.x, y: sofa.y, w: 58, h: 24 }, { x: table.x, y: table.y, w: 24, h: 12 }, { x: cart.x, y: cart.y - 14, w: 28, h: 32 });
    L.obst.push({ x: shelf.x, y: wallH, w: shelf.w, h: shelf.bottom - wallH });
    L.plants.forEach((p) => L.obst.push({ x: p.x + 2, y: p.y + 8, w: 10, h: 14 }));
    if (L.lamp) L.obst.push({ x: L.lamp.x, y: L.lamp.y + 27, w: 8, h: 4 });
    if (L.cooler) L.obst.push({ x: L.cooler.x, y: wallH, w: 10, h: 8 });
    if (L.cabinet) L.obst.push({ x: L.cabinet.x, y: wallH, w: 22, h: 9 });
    // things that stand in front of a window: the sky is painted last and has to go around them
    const tall = [{ x: cart.x + 2, y: cart.y - 15, w: 25, h: 16 }];
    L.plants.forEach((p) => tall.push({ x: p.x, y: p.y, w: 14, h: 14 }));
    if (L.lamp) tall.push({ x: L.lamp.x - 1, y: L.lamp.y, w: 10, h: 10 });
    if (L.cooler) tall.push({ x: L.cooler.x, y: L.cooler.y, w: 10, h: 27 });
    if (L.cabinet) tall.push({ x: L.cabinet.x, y: L.cabinet.y - 3, w: 22, h: 12 });
    L.windows.forEach((w) => { w.holes = tall.filter((t) => t.x < w.x + w.w - 2 && t.x + t.w > w.x + 2 && t.y < w.y + w.h - 2 && t.y + t.h > w.y + 2); });
    return L;
  }

  // ───────── the scene ─────────
  function create(canvas, opts) {
    opts = opts || {};
    const nowFn = typeof opts.now === 'function' ? opts.now : () => Date.now();
    const reduced = !!opts.reducedMotion;
    const seed = num(opts.seed, 1) | 0;
    const onHover = typeof opts.onHover === 'function' ? opts.onHover : () => {};
    const onPick = typeof opts.onPick === 'function' ? opts.onPick : () => {};
    const g = canvas.getContext('2d');

    let dpr = 1, k = 2, s = 2, cssW = 0, cssH = 0, cw = 0, ch = 0, sized = false;
    let L = makeLayout(240, 0, 2), nav = null;
    let bg = null, bgx = null, lc = null, lcx = null, bgKey = '', full = true;
    let crew = [], byId = new Map(), queue = [], spotOf = new Map(), hadCrew = false;
    let simT = 0, lastT = null, framed = false, drew = false;
    let lt = lightAt(num(nowFn(), 0)), tints = new Map(), tintKey = '';
    let flights = [], trayPop = -1e9, trayShown = 0, focusId = null, hoverId = null;
    let running = false, raf = 0, lastDraw = -1e9, needsDraw = true, destroyed = false, onscreen = true, io = null;
    let fontTag = '', fontNum = '', tw = new Map();

    // ── pen: every rectangle lands on whole device pixels ──
    let G = g, CL = null, inkOf = null, ink = '';                       // inkOf/ink: the context and colour of the last rectangle
    const R = (x, y, w, h, c) => {
      if (CL) { const x1 = Math.min(x + w, CL[2]), y1 = Math.min(y + h, CL[3]); if (x < CL[0]) x = CL[0]; if (y < CL[1]) y = CL[1]; w = x1 - x; h = y1 - y; }
      const X = Math.round(x * k), Y = Math.round(y * k), X1 = Math.round((x + w) * k), Y1 = Math.round((y + h) * k);
      if (!(X1 > X && Y1 > Y)) return;
      if (c !== ink || G !== inkOf) { G.fillStyle = c; ink = c; inkOf = G; }
      G.fillRect(X, Y, X1 - X, Y1 - Y);
    };
    const box = (x, y, w, h, fill, line) => { R(x + 1, y, w - 2, h, line || INK); R(x, y + 1, w, h - 2, line || INK); R(x + 1, y + 1, w - 2, h - 2, fill); };
    const disc = (cx, cy, r, c) => { for (let dy = -r; dy <= r; dy++) { const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5); R(cx - hw, cy + dy, hw * 2 + 1, 1, c); } };
    const oval = (cx, cy, rx, ry, c) => { for (let dy = -ry; dy < ry; dy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - Math.pow((dy + 0.5) / ry, 2)))); R(cx - hw, cy + dy, hw * 2, 1, c); } };
    const line = (x0, y0, x1, y1, c) => { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (let i = 0; i < 64; i++) { R(x0, y0, 1, 1, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } };
    // what was drawn over the cached room this frame, to put back next frame (device pixels)
    let dirty = [], dirtyPrev = [];
    const markD = (X, Y, w, h) => { const x0 = Math.max(0, Math.floor(X)), y0 = Math.max(0, Math.floor(Y)), x1 = Math.min(cw, Math.ceil(X + w)), y1 = Math.min(ch, Math.ceil(Y + h)); if (x1 > x0 && y1 > y0) dirty.push(x0, y0, x1 - x0, y1 - y0); };
    const mark = (x, y, w, h) => markD(x * k - 1, y * k - 1, w * k + 2, h * k + 2);
    // sprite colours follow the room's light, a little less than the room does
    const T = (hex) => { let c = tints.get(hex); if (!c) { const a = lt.amb, v = rgb(hex); c = css([v[0] * lerp(a[0], 1, 0.5), v[1] * lerp(a[1], 1, 0.5), v[2] * lerp(a[2], 1, 0.5)]); tints.set(hex, c); } return c; };

    // ───────── the room, painted once into a cache ─────────
    function paintRoom() {
      const W = L.W, H = L.H, wallH = L.wallH, wd = L.wd, rnd = mulberry(977);
      // floor boards
      R(0, wallH, W + 2, H - wallH, '#cf9a5f');
      for (let y = wallH, row = 0; y < H; y += 7, row++) {
        let x = -((row * 23) % 37);
        while (x < W + 2) {
          const len = 30 + Math.floor(rnd() * 26), tone = rnd();
          R(x + 1, y, len - 1, 6, tone < 0.3 ? '#d5a167' : tone < 0.72 ? '#cf9a5f' : '#dbab72');
          if (rnd() < 0.55) R(x + 4 + Math.floor(rnd() * Math.max(1, len - 12)), y + 2 + Math.floor(rnd() * 3), 3 + Math.floor(rnd() * 5), 1, '#c58f57');
          R(x, y, 1, 6, '#b5814c'); x += len;
        }
        R(0, y + 6, W + 2, 1, '#b98651');
      }
      // rugs mark the zones
      L.rugs.forEach((r) => {
        if (r.w < 12 || r.h < 8) return;
        const c = r.kind === 'you' ? ['#2f6b5a', '#3c8069', '#e3bb62', '#245243'] : r.kind === 'pen' ? ['#3b5080', '#4a639b', '#d9cba6', '#2f4069'] : ['#8c3f55', '#a5536d', '#e8cc92', '#6f3044'];
        R(r.x + 1, r.y + r.h, r.w - 1, 1, SHADOW);
        R(r.x + 1, r.y, r.w - 2, r.h, c[2]); R(r.x, r.y + 1, r.w, r.h - 2, c[2]);
        R(r.x + 2, r.y + 2, r.w - 4, r.h - 4, c[0]);
        R(r.x + 4, r.y + 4, r.w - 8, 1, c[1]); R(r.x + 4, r.y + r.h - 5, r.w - 8, 1, c[1]); R(r.x + 4, r.y + 4, 1, r.h - 8, c[1]); R(r.x + r.w - 5, r.y + 4, 1, r.h - 8, c[1]);
        for (let yy = r.y + 8, j = 0; yy < r.y + r.h - 8; yy += 5, j++) for (let xx = r.x + 9 + (j % 2) * 5; xx < r.x + r.w - 9; xx += 10) { R(xx, yy, 2, 1, c[3]); R(xx, yy + 1, 2, 1, c[1]); }
        for (let yy = r.y + 2; yy < r.y + r.h - 2; yy += 2) { R(r.x - 1, yy, 1, 1, c[2]); R(r.x + r.w, yy, 1, 1, c[2]); }
      });
      // daylight through the windows
      if (lt.day > 0.15) {
        const a = 0.1 + 0.1 * lt.day, col = mix([255, 250, 224], [255, 196, 138], lt.glow), len = Math.round(16 + 12 * lt.glow);
        L.windows.forEach((w) => { for (let i = 0; i < len; i++) { const sh = Math.round(lt.skew * (i + 3) / len); R(w.x + 3 + sh, wallH + 3 + i, w.w - 6, 1, cssA(col, a * (1 - i / (len * 1.6)))); } });
      }
      // where the queue stands
      for (let i = 0; i < 4; i++) { const x = L.q.x0 + i * L.q.pitch; if (x > L.q.max + 2) break; R(x - 4, L.q.y - 2, 8, 3, '#3c8069'); R(x - 3, L.q.y - 3, 6, 5, '#3c8069'); R(x - 2, L.q.y - 1, 4, 1, '#4b957c'); }
      // the wall
      R(0, 0, W + 2, wallH, '#4d8088'); R(0, 4, W + 2, 3, '#5a9097');
      for (let x = 18; x < W; x += 24) R(x, 7, 1, wallH - 16, '#467780');
      R(0, wallH - 9, W + 2, 7, '#43737c'); R(0, wallH - 9, W + 2, 1, '#6aa0a4');
      R(0, wallH - 3, W + 2, 3, '#6b4631'); R(0, wallH - 3, W + 2, 1, '#8c6042');
      R(0, wallH, W + 2, 2, 'rgba(38,24,44,0.20)');
      R(0, 0, W + 2, 3, '#2c4852'); R(0, 3, W + 2, 1, '#22363f');
      R(0, 0, 3, H, '#2c4852'); R(W - 3, 0, 5, H, '#2c4852'); R(0, H - 3, W + 2, 4, '#2c4852');
      R(3, wallH, 1, H - wallH - 3, 'rgba(38,24,44,0.25)'); R(3, H - 4, W - 6, 1, '#3d6470'); R(W - 4, wallH, 1, H - wallH - 3, '#3d6470');
      // window frames and sills (the glass is painted after the light)
      L.windows.forEach((w) => {
        R(w.x - 1, w.y - 1, w.w + 2, w.h + 2, INK); R(w.x, w.y, w.w, w.h, '#f3e8cf'); R(w.x, w.y + w.h - 1, w.w, 1, '#cfbe9c');
        R(w.x - 3, w.y + w.h, w.w + 6, 3, INK); R(w.x - 2, w.y + w.h, w.w + 4, 2, '#e9dab6');
        if (w.holes.length) paintGlass(w);                                 // what shows behind a lamp or a plant standing at this window
      });
      // clock face
      disc(L.clock.x, L.clock.y, 7, INK); disc(L.clock.x, L.clock.y, 6, '#fbf3df'); disc(L.clock.x, L.clock.y, 5, '#fffaf0');
      [[0, -5], [5, 0], [0, 5], [-5, 0]].forEach((p) => R(L.clock.x + p[0], L.clock.y + p[1], 1, 1, '#a59a8a'));
      // a framed print on the wall: hills under a low sun. A picture on purpose: nothing in this room is a number
      if (L.chart && L.chart.big) {
        const c = L.chart; box(c.x, c.y, 26, 17, '#f6efe0'); R(c.x + 2, c.y + 2, 22, 13, '#bcd9e6');
        disc(c.x + 19, c.y + 6, 2, '#f7ae2e');
        R(c.x + 2, c.y + 10, 22, 5, '#5f9a7c'); R(c.x + 4, c.y + 9, 7, 1, '#5f9a7c'); R(c.x + 5, c.y + 8, 5, 1, '#5f9a7c'); R(c.x + 13, c.y + 9, 9, 1, '#5f9a7c'); R(c.x + 15, c.y + 8, 5, 1, '#5f9a7c');
        R(c.x + 2, c.y + 13, 22, 2, '#3f7a63');
      } else if (L.chart) {
        const c = L.chart; box(c.x, c.y, 16, 13, '#f6efe0'); R(c.x + 2, c.y + 2, 12, 9, '#bcd9e6');
        disc(c.x + 11, c.y + 5, 1, '#f7ae2e');
        R(c.x + 2, c.y + 8, 12, 3, '#5f9a7c'); R(c.x + 4, c.y + 7, 5, 1, '#5f9a7c'); R(c.x + 2, c.y + 10, 12, 1, '#3f7a63');
      }
      // bookshelf
      { const b = L.shelf, bh = b.bottom - b.top; R(b.x + 1, b.bottom, b.w, 2, SHADOW);
        R(b.x, b.top, b.w, bh, INK); R(b.x + 1, b.top + 1, b.w - 2, bh - 2, '#8a5636'); R(b.x + 1, b.top + 1, b.w - 2, 1, '#a66c45');
        const rh = Math.floor((bh - 4) / 3), rr = mulberry(41);
        for (let r = 0; r < 3; r++) {
          const y = b.top + 3 + r * rh; R(b.x + 2, y, b.w - 4, rh - 2, '#442920');
          let x = b.x + 2; const end = b.x + b.w - 2, floorY = y + rh - 2;
          while (x < end) {
            if (rr() < 0.1) { x += 2; continue; }
            if (rr() < 0.08 && x + 5 <= end) { R(x + 1, floorY - 4, 3, 4, '#c96a45'); R(x, floorY - 6, 5, 3, '#58b56a'); x += 6; continue; }
            const bw = Math.min(end - x, 1 + Math.floor(rr() * 2.2)), hh = Math.min(rh - 3, 4 + Math.floor(rr() * 4)), col = BOOKS[Math.floor(rr() * BOOKS.length)];
            R(x, floorY - hh, bw, hh, col); if (bw > 1) R(x, floorY - hh + 1, bw, 1, 'rgba(255,255,255,0.35)'); x += bw;
          }
        }
        R(b.x + 1, b.bottom - 3, b.w - 2, 2, '#6f432b');
      }
      // furniture, back to front
      const items = [];
      L.desks.forEach((d) => items.push({ y: d.base, f: () => paintDesk(d) }));
      items.push({ y: wd.base, f: paintBigDesk }, { y: L.sofa.y + 24, f: paintSofa }, { y: L.table.y + 12, f: paintTable }, { y: L.cart.y + 18, f: paintCart });
      L.plants.forEach((p) => items.push({ y: p.y + 22, f: () => paintPlant(p) }));
      if (L.lamp) items.push({ y: L.lamp.y + 31, f: paintLamp });
      if (L.cooler) items.push({ y: L.cooler.y + 27, f: paintCooler });
      if (L.cabinet) items.push({ y: L.cabinet.y + 26, f: paintCabinet });
      items.sort((a, b) => a.y - b.y).forEach((it) => it.f());
      // the hour: the room's light (the day through the windows, or lamps in the dark) is multiplied over the room,
      // then the sky goes into the windows
      const a = lt.amb;
      if (a[0] < 0.995 || a[1] < 0.995 || a[2] < 0.995) {
        if (!lc) { lc = document.createElement('canvas'); lcx = lc.getContext('2d'); }
        if (lc.width !== cw || lc.height !== ch) { lc.width = cw; lc.height = ch; }
        const room = G;
        if (lcx) {
          G = lcx; inkOf = null; G.globalCompositeOperation = 'source-over'; G.fillStyle = css([a[0] * 255, a[1] * 255, a[2] * 255]); G.fillRect(0, 0, cw, ch);
          if (lt.lamp > 0.05) {
            G.globalCompositeOperation = 'lighter';
            const pool = (cx, cy, rx, ry, st, tone) => { const add = css([(tone[0] - a[0]) * 37 * st * lt.lamp, (tone[1] - a[1]) * 37 * st * lt.lamp, (tone[2] - a[2]) * 37 * st * lt.lamp]); for (let i = 0; i < 7; i++) { const f = 1 - i * 0.125; oval(Math.round(cx), Math.round(cy), Math.round(rx * f), Math.round(ry * f), add); } };
            const warm = [1, 0.93, 0.8], soft = [0.98, 0.95, 0.9];
            pool(wd.x + 9, wd.by + 3, 50, 32, 1, warm);
            for (let i = 0; i < 2; i++) pool(L.q.x0 + (i * 2 + 0.5) * L.q.pitch, L.q.y - 9, 38, 26, 0.6, warm);
            L.desks.forEach((d) => pool(d.cx, d.dy + 1, 25, 19, 0.55, soft));
            L.lights.forEach((p) => pool(p[0], p[1], p[2], p[3], p[4], warm));
            G.globalCompositeOperation = 'source-over';
          }
          G = room; G.globalCompositeOperation = 'multiply'; G.drawImage(lc, 0, 0); G.globalCompositeOperation = 'source-over';
        }
      }
      L.windows.forEach((w) => {
        if (!w.holes.length) { paintGlass(w); return; }
        G.save();
        w.holes.forEach((h) => { G.beginPath(); G.rect(0, 0, cw, ch); G.rect(Math.round(h.x * k), Math.round(h.y * k), Math.round(h.w * k), Math.round(h.h * k)); G.clip('evenodd'); });
        paintGlass(w);
        G.restore(); inkOf = null;
      });
    }

    function paintGlass(w) {
      const x = w.x + 2, y = w.y + 2, gw = w.w - 4, gh = w.h - 4;
      CL = [x, y, x + gw, y + gh];
      const bands = 6;
      for (let i = 0; i < bands; i++) { const f = i / (bands - 1), c = f < 0.5 ? mix(lt.top, lt.mid, f * 2) : mix(lt.mid, lt.bot, (f - 0.5) * 2); R(x, y + Math.floor(gh * i / bands), gw, Math.ceil(gh / bands) + 1, css(c)); }
      // stars and a moon at night, a low sun at dawn and dusk
      if (lt.day < 0.35) for (let i = 0; i < 9; i++) { const sx = x + Math.floor(hash(w.x * 7 + i, 11) * gw), sy = y + Math.floor(hash(w.x * 5 + i, 23) * (gh - 6)); R(sx, sy, 1, 1, cssA([255, 250, 220], (0.35 + 0.6 * hash(i, w.x)) * (1 - lt.day / 0.35))); }
      const wi = L.windows.indexOf(w), last = L.windows.length - 1, moonX = x + Math.floor(gw * 0.75) - 3, sunX = x + Math.floor(gw * (lt.h < 12 ? 0.3 : 0.72));
      if (lt.day < 0.2 && wi === Math.round(last * 0.6)) [[2, 3], [1, 3], [0, 3], [0, 3], [1, 3], [2, 3]].forEach((m, i) => R(moonX + m[0], y + 1 + i, m[1], 1, '#fff3c4'));
      if (lt.glow > 0.3 && wi === Math.round(last * (lt.h < 12 ? 0.3 : 0.7))) { const sy = y + gh - 5 + Math.round((1 - lt.day) * 3); disc(sunX, sy, 5, cssA([255, 214, 150], 0.35 * lt.glow)); disc(sunX, sy, 3, cssA([255, 240, 190], 0.95 * lt.glow)); }
      // rooftops across the street, snow on them in winter
      const roof = mix(mix(lt.bot, [26, 28, 58], 0.62), [14, 16, 36], 0.5 * (1 - lt.day)), snow = mix(mix([235, 240, 250], lt.bot, 0.25), [70, 80, 130], 0.6 * (1 - lt.day));
      let bx = Math.floor(x / 7) * 7 - 7;
      while (bx < x + gw) {
        const bi = Math.floor(bx / 7), bw = 5 + Math.floor(hash(bi, 3) * 6), bh = 3 + Math.floor(hash(bi, 5) * 5), top = y + gh - bh;
        R(bx, top, bw, bh, css(roof));
        if (hash(bi, 9) < 0.22) { R(bx + 2, top - 5, 1, 5, css(roof)); R(bx + 1, top - 2, 3, 2, css(roof)); }
        if (lt.winter) R(bx, top, bw, 1, css(snow));
        if (lt.day < 0.5) for (let j = 0; j < 2; j++) if (hash(bi, 13 + j) < 0.6) R(bx + 1 + Math.floor(hash(bi, 17 + j) * (bw - 2)), top + 2 + j, 1, 1, cssA([255, 214, 120], 0.9 * (1 - lt.day)));
        bx += bw + (hash(bi, 7) < 0.3 ? 1 : 0);
      }
      CL = null;
      const fr = css(rgb('#f3e8cf').map((v, i) => v * lt.amb[i]));
      R(x + Math.floor(gw / 2), y, 1, gh, fr); R(x, y + Math.floor(gh * 0.45), gw, 1, fr);
      if (lt.winter) R(x, y + gh - 1, gw, 1, css(mix([240, 244, 252], [120, 130, 180], 0.55 * (1 - lt.day))));
    }

    function paintDesk(d) {
      const a = crew[d.i], hue = HUES[a ? a.hue : 'teal'], x0 = d.x0, w = d.w, y = d.dy;
      R(x0 + 1, y + 16, w, 2, SHADOW);
      // chair, in the agent's colour
      R(d.sx - 4, y - 10, 8, 10, INK); R(d.sx - 5, y - 9, 10, 9, INK);
      R(d.sx - 4, y - 9, 8, 9, hue[2]); R(d.sx - 3, y - 8, 6, 7, hue[0]); R(d.sx - 3, y - 8, 6, 1, hue[1]);
      R(d.sx - 7, y - 4, 2, 4, INK); R(d.sx + 5, y - 4, 2, 4, INK);
      // desk
      R(x0, y, w, 10, INK); R(x0 + 1, y + 1, w - 2, 8, '#efe6d6'); R(x0 + 1, y + 1, w - 2, 1, '#fbf5ea'); R(x0 + 1, y + 8, w - 2, 1, '#d6cab4');
      R(x0, y + 9, w, 7, INK); R(x0 + 1, y + 10, w - 2, 5, '#b8ab96'); R(x0 + 1, y + 10, 2, 5, '#978b78'); R(x0 + w - 3, y + 10, 2, 5, '#978b78'); R(x0 + 3, y + 10, w - 6, 1, '#c9bda8');
      // monitor (the screen is drawn live), keyboard, lamp (lit live), a mug
      const mx = x0 + 1;
      R(mx + 4, y - 1, 3, 3, INK); R(mx + 5, y - 1, 1, 2, '#9a9db0'); R(mx + 2, y + 2, 7, 1, INK);
      R(mx + 1, y - 11, 9, 11, INK); R(mx, y - 10, 11, 9, INK); R(mx + 1, y - 10, 9, 9, '#c9ccd9'); R(mx + 1, y - 2, 9, 1, '#9a9db0'); R(mx + 1, y - 10, 9, 7, '#1d1929'); R(mx + 5, y - 3, 1, 1, '#6a6c80');
      R(d.sx - 6, y + 2, 12, 4, '#7b7e94'); R(d.sx - 5, y + 3, 10, 2, '#dcdfe9'); R(d.sx - 4, y + 4, 8, 1, '#b9bccb');
      R(d.lx, y + 4, 5, 2, INK); R(d.lx + 2, y + 2, 1, 2, '#9a9db0'); R(d.lx + 1, y - 2, 3, 5, INK); R(d.lx, y - 1, 5, 3, INK); R(d.lx + 1, y - 1, 3, 3, '#5d586c');
      const v = d.i % 3;
      if (v === 0) { R(x0 + 2, y + 4, 4, 4, INK); R(x0 + 3, y + 5, 2, 2, hue[0]); R(x0 + 6, y + 5, 1, 2, INK); }
      else if (v === 1) { R(x0 + 2, y + 4, 6, 4, '#c4b9a3'); R(x0 + 2, y + 4, 5, 3, PAPER); R(x0 + 3, y + 5, 3, 1, '#b7b0a0'); }
      else { R(x0 + 2, y + 5, 4, 3, INK); R(x0 + 3, y + 6, 2, 1, '#c96a45'); R(x0 + 2, y + 2, 2, 3, '#3f9a5a'); R(x0 + 4, y + 3, 2, 2, '#58b56a'); }
    }

    function paintBigDesk() {
      const d = L.wd, x = d.x, y = d.by, w = d.w;
      R(x + 1, y + 21, w, 2, SHADOW);
      // chair
      R(d.seat - 7, y - 17, 14, 17, INK); R(d.seat - 8, y - 16, 16, 15, INK); R(d.seat - 7, y - 16, 14, 15, '#6f86a8'); R(d.seat - 7, y - 16, 14, 2, '#8ba1c2'); R(d.seat - 5, y - 12, 10, 1, '#5a7092');   // steel blue, so the chair back does not read as hair
      // top, with a leather pad
      R(x, y, w, 13, INK); R(x + 1, y + 1, w - 2, 11, '#a86b43'); R(x + 1, y + 1, w - 2, 1, '#c58a5c'); R(x + 1, y + 11, w - 2, 1, '#8a5433');
      R(d.seat - 10, y + 3, 20, 8, '#245243'); R(d.seat - 9, y + 4, 18, 6, '#2f6b5a');
      R(d.seat - 5, y + 4, 8, 5, PAPER_D); R(d.seat - 5, y + 4, 7, 4, PAPER); R(d.seat - 4, y + 5, 4, 1, '#b7b0a0'); R(d.seat - 4, y + 7, 3, 1, '#b7b0a0');
      // front, with drawers
      R(x, y + 12, w, 9, INK); R(x + 1, y + 13, w - 2, 7, '#7c4b31'); R(x + 1, y + 13, w - 2, 1, '#93603f');
      R(x + 3, y + 15, 9, 4, '#633a26'); R(x + 7, y + 16, 2, 1, '#e3bb62'); R(x + w - 12, y + 15, 9, 4, '#633a26'); R(x + w - 9, y + 16, 2, 1, '#e3bb62');
      // desk lamp, mug
      const on = lt.lamp > 0.05;
      R(x + 3, y + 5, 8, 3, INK); R(x + 4, y + 5, 6, 2, '#6a6478'); R(x + 6, y - 2, 2, 7, INK); R(x + 6, y - 2, 1, 7, '#9a9db0');
      R(x + 4, y - 9, 6, 8, INK); R(x + 3, y - 7, 8, 6, INK); R(x + 2, y - 5, 10, 4, INK);
      R(x + 5, y - 8, 4, 2, on ? '#fff6c2' : '#f0e2b0'); R(x + 4, y - 6, 6, 2, on ? '#ffe894' : '#e6d49c'); R(x + 3, y - 4, 8, 2, on ? '#ffd86a' : '#d9c488'); R(x + 5, y - 8, 1, 3, '#fffbe6');
      R(x + 15, y + 4, 5, 5, INK); R(x + 16, y + 5, 3, 3, '#f4efe2'); R(x + 20, y + 5, 1, 2, INK); R(x + 16, y + 5, 3, 1, '#6b4631');
      // the tray (its stack is drawn live)
      R(d.tray.x, d.tray.y, 14, 5, INK); R(d.tray.x + 1, d.tray.y + 1, 12, 3, '#4f6f8a'); R(d.tray.x + 1, d.tray.y + 1, 12, 1, '#6c8fad');
    }

    function paintSofa() {
      const x = L.sofa.x, y = L.sofa.y, w = 58;
      R(x + 1, y + 23, w - 1, 2, SHADOW);
      R(x + 3, y, w - 6, 11, INK); R(x + 2, y + 1, w - 4, 10, INK); R(x + 3, y + 1, w - 6, 9, '#e3cfa6'); R(x + 3, y + 1, w - 6, 2, '#f3e5c6'); R(x + 3, y + 8, w - 6, 2, '#c9b286');
      R(x + 6, y + 9, w - 12, 9, INK); R(x + 7, y + 10, w - 14, 7, '#f0dfba'); R(x + 7, y + 10, w - 14, 1, '#faf0d6'); R(x + 29, y + 10, 1, 7, '#c9b286');
      R(x + 6, y + 17, w - 12, 6, INK); R(x + 7, y + 18, w - 14, 4, '#cdb78c'); R(x + 7, y + 21, w - 14, 1, '#b39c72');
      [x, x + w - 8].forEach((ax) => { R(ax + 1, y + 5, 6, 18, INK); R(ax, y + 6, 8, 16, INK); R(ax + 1, y + 6, 6, 16, '#e3cfa6'); R(ax + 1, y + 6, 6, 2, '#f3e5c6'); R(ax + 1, y + 19, 6, 3, '#c9b286'); });
      R(x + 2, y + 22, 3, 2, INK); R(x + w - 5, y + 22, 3, 2, INK);
      box(x + 8, y + 4, 7, 7, '#e2725b'); R(x + 9, y + 5, 3, 1, '#f39a84'); box(x + w - 15, y + 4, 7, 7, '#3a9a92'); R(x + w - 14, y + 5, 3, 1, '#6cc7be');
    }
    function paintTable() {
      const x = L.table.x, y = L.table.y;
      R(x + 1, y + 11, 24, 2, SHADOW);
      box(x, y, 24, 9, '#bd8552'); R(x + 1, y + 1, 22, 1, '#d5a06a'); R(x + 1, y + 6, 22, 2, '#99673c');
      R(x + 2, y + 8, 3, 4, INK); R(x + 19, y + 8, 3, 4, INK);
      R(x + 4, y + 2, 6, 4, '#3a9a92'); R(x + 4, y + 2, 6, 1, '#f4efe2'); R(x + 14, y + 2, 4, 4, INK); R(x + 15, y + 3, 2, 2, '#f4efe2');
    }
    function paintCart() {
      const x = L.cart.x, y = L.cart.y;
      R(x + 1, y + 17, 28, 2, SHADOW);
      // the machine, a pot of coffee on its plate, mugs
      R(x + 3, y - 15, 15, 16, INK); R(x + 2, y - 14, 17, 14, INK); R(x + 3, y - 14, 15, 14, '#e8553f'); R(x + 3, y - 14, 15, 2, '#ff8a70'); R(x + 16, y - 12, 2, 12, '#b83a2c');
      R(x + 5, y - 11, 11, 9, '#2a2238'); R(x + 3, y - 2, 15, 2, '#c9ccd9'); R(x + 9, y - 11, 3, 1, '#c9ccd9');
      R(x + 7, y - 9, 7, 7, '#d9eef5'); R(x + 7, y - 6, 7, 4, '#6b3a22'); R(x + 7, y - 6, 7, 1, '#8a5230'); R(x + 8, y - 9, 1, 2, '#ffffff'); R(x + 14, y - 8, 1, 4, '#c9ccd9');
      R(x + 20, y - 6, 6, 7, INK); R(x + 21, y - 5, 4, 5, '#f4efe2'); R(x + 21, y - 3, 4, 1, '#c9c2b0'); R(x + 21, y - 8, 4, 3, INK); R(x + 22, y - 7, 2, 2, '#f4efe2');
      // the cart
      R(x, y, 28, 5, INK); R(x + 1, y + 1, 26, 3, '#dcc49a'); R(x + 1, y + 1, 26, 1, '#eeddb8');
      R(x + 1, y + 4, 26, 12, INK); R(x + 2, y + 5, 24, 10, '#6d7289'); R(x + 2, y + 5, 24, 1, '#878ca3'); R(x + 4, y + 7, 20, 6, '#3b3850');
      R(x + 6, y + 9, 3, 4, '#f0608f'); R(x + 10, y + 8, 3, 5, '#f7ae2e'); R(x + 14, y + 9, 3, 4, '#2ec4b6'); R(x + 19, y + 10, 4, 3, '#f4efe2');
      R(x + 2, y + 15, 4, 3, INK); R(x + 22, y + 15, 4, 3, INK); R(x + 3, y + 16, 2, 1, '#8d90a6'); R(x + 23, y + 16, 2, 1, '#8d90a6');
    }
    function paintPlant(p) {
      const x = p.x, y = p.y;
      R(x + 3, y + 21, 10, 2, SHADOW);
      R(x + 6, y + 6, 2, 8, '#2d7a4a');
      box(x, y + 4, 7, 8, '#3f9a5a'); R(x + 1, y + 5, 3, 1, '#6fc47d'); box(x + 5, y, 7, 9, '#58b56a'); R(x + 6, y + 1, 3, 1, '#8ad894'); box(x + 8, y + 6, 6, 7, '#2f8a50'); R(x + 9, y + 7, 2, 1, '#58b56a');
      R(x + 2, y + 13, 10, 3, INK); R(x + 3, y + 14, 8, 1, '#e08a62'); R(x + 3, y + 15, 8, 7, INK); R(x + 4, y + 15, 6, 6, '#c96a45'); R(x + 8, y + 15, 2, 6, '#a4502f');
    }
    function paintLamp() {
      const x = L.lamp.x, y = L.lamp.y, on = lt.lamp > 0.05;
      R(x, y + 30, 9, 2, SHADOW);
      R(x + 3, y + 8, 2, 21, '#4a4458'); R(x + 3, y + 8, 1, 21, '#6a6478'); R(x, y + 28, 8, 3, INK); R(x + 1, y + 28, 6, 2, '#6a6478');
      R(x + 1, y, 6, 9, INK); R(x, y + 2, 8, 7, INK); R(x - 1, y + 5, 10, 4, INK);
      R(x + 2, y + 1, 4, 2, on ? '#fff3b0' : '#e9d9a8'); R(x + 1, y + 3, 6, 2, on ? '#ffe89a' : '#e0cd96'); R(x, y + 5, 8, 3, on ? '#ffdc7a' : '#d6c088'); R(x + 1, y + 3, 2, 1, '#fffbe0');
    }
    function paintCooler() {
      const x = L.cooler.x, y = L.cooler.y;
      R(x + 1, y + 26, 10, 2, SHADOW);
      box(x + 1, y, 8, 12, '#7fc4ee'); R(x + 2, y + 1, 2, 6, '#c4e6fa'); R(x + 2, y + 8, 6, 1, '#5aa6d6');
      box(x, y + 11, 10, 16, '#eef1f6'); R(x + 1, y + 12, 8, 1, '#ffffff'); R(x + 7, y + 13, 2, 13, '#cfd5e0'); R(x + 3, y + 15, 2, 2, '#3f8ff5'); R(x + 6, y + 15, 2, 2, '#f0608f'); R(x + 2, y + 19, 6, 3, '#b9c0cf');
    }

    function paintCabinet() {
      const x = L.cabinet.x, y = L.cabinet.y;
      R(x + 1, y + 25, 22, 2, SHADOW);
      R(x + 6, y - 3, 10, 4, INK); R(x + 7, y - 2, 8, 3, PAPER); R(x + 8, y - 1, 5, 1, '#b7b0a0');
      box(x + 3, y, 16, 9, '#e9edf3'); R(x + 4, y + 1, 14, 1, '#ffffff'); R(x + 5, y + 4, 12, 2, '#2a2238'); R(x + 6, y + 5, 10, 1, PAPER); R(x + 16, y + 2, 1, 1, '#63e56f'); R(x + 4, y + 7, 14, 1, '#c3cad8');
      R(x, y + 8, 22, 18, INK); R(x + 1, y + 9, 20, 16, '#b9a27d'); R(x + 1, y + 9, 20, 1, '#d6c19c');
      R(x + 2, y + 11, 18, 6, '#a58e6a'); R(x + 2, y + 18, 18, 6, '#a58e6a'); R(x + 9, y + 13, 4, 1, INK); R(x + 9, y + 20, 4, 1, INK);
    }

    function rebuildRoom() {
      if (!bg) { bg = document.createElement('canvas'); bgx = bg.getContext('2d'); }
      if (bg.width !== cw || bg.height !== ch) { bg.width = cw; bg.height = ch; }
      if (bgx) bgx.imageSmoothingEnabled = false;
      inkOf = null; G = bgx || g; paintRoom(); G = g; inkOf = null; full = true;
    }

    // ───────── ways around the furniture ─────────
    function buildNav() {
      const cs = 2, nc = Math.ceil(L.W / cs) + 1, nr = Math.ceil(L.H / cs) + 1, blk = new Uint8Array(nc * nr);
      const x0 = 9, x1 = L.W - 9, y0 = L.wallH + 4, y1 = L.H - 5;
      const fill = (x, y, w, h, v) => { for (let r = Math.max(0, Math.floor(y / cs)); r < nr && r * cs + 1 <= y + h; r++) for (let c = Math.max(0, Math.floor(x / cs)); c < nc && c * cs + 1 <= x + w; c++) if (c * cs + 1 >= x && r * cs + 1 >= y) blk[r * nc + c] = v; };
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) { const x = c * cs + 1, y = r * cs + 1; if (x < x0 || x > x1 || y < y0 || y > y1) blk[r * nc + c] = 1; }
      L.obst.forEach((o) => fill(o.x - 6, o.y - 2, o.w + 12, o.h + 4, 1));
      L.desks.forEach((d) => fill(d.sx - 3, d.dy - 15, 6, 14, 0));          // the way into the chair
      nav = { cs, nc, nr, blk, prev: new Int32Array(nc * nr), qu: new Int32Array(nc * nr) };
    }
    // A way from a to b around the furniture, and around the others who stand in the open when that is not a long detour.
    function findPath(ax, ay, bx, by, self) {
      if (!nav) buildNav();
      const { cs, nc, nr, blk } = nav, held = [];
      crew.forEach((o) => {
        if (o === self || !present(o) || o.path || !o.goal || o.sitKind) return;
        if (Math.hypot(o.x - ax, o.y - ay) < 10 || Math.hypot(o.x - bx, o.y - by) < 10) return;
        for (let r = Math.floor((o.y - 3) / cs); r <= Math.floor((o.y + 3) / cs); r++) for (let c = Math.floor((o.x - 6) / cs); c <= Math.floor((o.x + 6) / cs); c++) { const i = r * nc + c; if (r >= 0 && c >= 0 && r < nr && c < nc && !blk[i]) { blk[i] = 1; held.push(i); } }
      });
      const len = (pts) => { let d = 0, x = ax, y = ay; pts.forEach((q2) => { d += Math.hypot(q2.x - x, q2.y - y); x = q2.x; y = q2.y; }); return d; };
      const polite = held.length ? route(ax, ay, bx, by) : null;
      held.forEach((i) => { blk[i] = 0; });
      const direct = route(ax, ay, bx, by);
      if (polite && (!direct || len(polite) <= len(direct) * 1.5 + 24)) return polite;
      return direct || [{ x: bx, y: by }];
    }
    function route(ax, ay, bx, by) {
      const { cs, nc, nr, blk, prev, qu } = nav;
      const cell = (x, y) => clamp(Math.floor(y / cs), 0, nr - 1) * nc + clamp(Math.floor(x / cs), 0, nc - 1);
      const free = (c0) => { if (!blk[c0]) return c0; const r0 = Math.floor(c0 / nc), q0 = c0 - r0 * nc; let best = -1, bd = 1e9; for (let rad = 1; rad < 24 && best < 0; rad++) for (let r = r0 - rad; r <= r0 + rad; r++) for (let c = q0 - rad; c <= q0 + rad; c++) { if (r < 0 || c < 0 || r >= nr || c >= nc || blk[r * nc + c]) continue; const dd = (r - r0) * (r - r0) + (c - q0) * (c - q0); if (dd < bd) { bd = dd; best = r * nc + c; } } return best; };
      const sc = free(cell(ax, ay)), gc = free(cell(bx, by));
      if (sc < 0 || gc < 0) return null;
      prev.fill(-1); let head = 0, tail = 0; qu[tail++] = gc; prev[gc] = gc;
      while (head < tail && prev[sc] < 0) {
        const c = qu[head++], r = Math.floor(c / nc), q0 = c - r * nc;
        if (q0 > 0 && !blk[c - 1] && prev[c - 1] < 0) { prev[c - 1] = c; qu[tail++] = c - 1; }
        if (q0 < nc - 1 && !blk[c + 1] && prev[c + 1] < 0) { prev[c + 1] = c; qu[tail++] = c + 1; }
        if (r > 0 && !blk[c - nc] && prev[c - nc] < 0) { prev[c - nc] = c; qu[tail++] = c - nc; }
        if (r < nr - 1 && !blk[c + nc] && prev[c + nc] < 0) { prev[c + nc] = c; qu[tail++] = c + nc; }
      }
      if (prev[sc] < 0) return null;
      const pts = [{ x: ax, y: ay }];
      for (let c = sc, i = 0; i < nc * nr; i++) { const r = Math.floor(c / nc); pts.push({ x: (c - r * nc) * cs + 1, y: r * cs + 1 }); if (c === gc) break; c = prev[c]; }
      pts.push({ x: bx, y: by });
      const los = (p, q2) => { const d = Math.hypot(q2.x - p.x, q2.y - p.y), st = Math.max(1, Math.ceil(d / 1.5)); for (let i = 0; i <= st; i++) if (blk[cell(lerp(p.x, q2.x, i / st), lerp(p.y, q2.y, i / st))]) return false; return true; };
      const out = []; let i = 0;
      while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !los(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
      return out;
    }

    // ───────── the crew ─────────
    // the queue: evenly spaced, wide enough for neighbours' name tags to stand side by side when there is room for that
    let qPitch = 26;
    const spaceQueue = () => {
      let need = L.q.pitch;
      for (let i = 0; i + 1 < queue.length; i++) { const a = byId.get(queue[i]), b = byId.get(queue[i + 1]); if (a && b) need = Math.max(need, Math.ceil(((textW(a.name, false) + textW(b.name, false)) / 2 + 14 * dpr) / k)); }
      qPitch = Math.max(8, Math.min(need, 40, queue.length > 1 ? (L.q.max - L.q.x0) / (queue.length - 1) : 40));
    };
    const slotX = (j) => L.q.x0 + j * qPitch;
    const goalOf = (a) => {
      if (a.state === 'needs') { const j = Math.max(0, queue.indexOf(a.id)); return { kind: 'queue', x: slotX(j), y: L.q.y }; }
      if (a.state === 'idle') { const sp = L.spots[(spotOf.get(a.id) || 0) % L.spots.length]; return { kind: 'lounge', x: sp.x, y: sp.y, sofa: !!sp.sofa, coffee: !!sp.coffee }; }
      const d = L.desks[a.desk]; return d ? { kind: 'desk', x: d.sx, y: d.sy } : { kind: 'desk', x: 20, y: L.wallH + 20 };
    };
    const seatOf = (goal) => (goal.kind === 'desk' ? 'desk' : goal.sofa ? 'sofa' : '');
    const toDesk = (a) => { const d = L.desks[a.desk]; a.x = d ? d.sx : 20; a.y = d ? d.sy : L.wallH + 20; a.path = null; a.pending = false; a.goal = { kind: 'desk', x: a.x, y: a.y }; a.sitKind = 'desk'; a.sit = 1; a.face = 0; a.dx = 0; };
    const snapTo = (a, goal) => { a.goal = goal; a.x = goal.x; a.y = goal.y; a.path = null; a.pending = false; a.sitKind = seatOf(goal); a.sit = a.sitKind ? 1 : 0; a.face = 0; a.dx = 0; };

    // mode: 'first' = start at the desks and walk, 'snap' = stand in place at once, '' = walk from where they are
    function retarget(mode) {
      queue = queue.filter((id) => { const a = byId.get(id); return a && a.state === 'needs'; });
      crew.forEach((a) => { if (a.state === 'needs' && queue.indexOf(a.id) < 0) queue.push(a.id); });
      spaceQueue();
      Array.from(spotOf.keys()).forEach((id) => { const a = byId.get(id); if (!a || a.state !== 'idle') spotOf.delete(id); });
      crew.forEach((a) => { if (a.state === 'idle' && !spotOf.has(a.id)) { const used = new Set(spotOf.values()); let j = 0; while (used.has(j)) j++; spotOf.set(a.id, j); } });
      const movers = [];
      crew.forEach((a) => {
        if (mode === 'first' || !a.placed) { toDesk(a); a.placed = true; if (mode === 'first') a.alpha = 1; }
        const goal = goalOf(a);
        if (reduced || mode === 'snap' || a.state === 'unknown') { snapTo(a, goal); return; }
        const cur = a.goal;
        if (cur && cur.kind === goal.kind && Math.abs(cur.x - goal.x) < 0.5 && Math.abs(cur.y - goal.y) < 0.5) return;
        a.leaves = !!cur && cur.kind === 'queue' && goal.kind !== 'queue';
        a.goal = goal; a.path = null; a.pending = true;
        movers.push(a);
      });
      // they set off one after the other so nobody walks on another's heels: first those who leave the queue, then
      // the queue closes up and fills from the front, then everybody else, shortest way first
      const rank = (a) => (a.leaves ? -2e6 : 0) + (a.goal.kind === 'queue' ? a.goal.x - 1e6 : Math.hypot(a.goal.x - a.x, a.goal.y - a.y));
      movers.sort((a, b) => (rank(a) - rank(b)) || (a.desk - b.desk));
      movers.forEach((a, i) => { a.delay = (mode === 'first' ? 400 : 150) + i * 26000 / pace(); });
    }

    function setCrew(list) {
      const arr = Array.isArray(list) ? list : [], seen = new Set(), next = [], first = !hadCrew;
      for (let i = 0; i < arr.length && next.length < 12; i++) {
        const raw = arr[i]; if (!raw || typeof raw !== 'object') continue;
        const id = String(raw.id == null ? 'agent' + i : raw.id); if (seen.has(id)) continue; seen.add(id);
        let a = byId.get(id); const isNew = !a;
        if (isNew) a = { id, x: 0, y: 0, placed: false, alpha: 0, sit: 1, sitKind: 'desk', path: null, pending: false, delay: 0, dist: 0, face: 0, dx: 0, state: '', fresh: 0, bubbleText: '', bubbleUntil: -1, popAt: -1e9, seed: Math.floor(hash(seed, next.length * 31 + 7) * 1e6) };
        const state = own(STATES, raw.state) ? raw.state : 'unknown', was = a.state;
        const name = String(raw.name == null ? '' : raw.name);
        a.name = name.length > 14 ? name.slice(0, 13) + '…' : name;
        a.look = own(LOOKS, raw.look) ? raw.look : 'plain';
        a.hue = own(HUES, raw.hue) ? raw.hue : 'teal';
        const waiting = Math.max(0, num(raw.waiting, 0));
        if (!isNew && waiting !== a.waiting) a.popAt = simT;
        a.waiting = waiting;
        a.step = String(raw.step == null ? '' : raw.step).slice(0, 28);
        const bubble = String(raw.bubble == null ? '' : raw.bubble).slice(0, 32);
        const fresh = num(raw.fresh, 0);
        // a slip flies for a new result from an agent already in the room, not when its document first loads
        if (!isNew && !first && was && was !== 'unknown' && fresh > a.fresh && !reduced) launchSlip(a, next.length);
        a.fresh = fresh;
        if (state !== was) {
          const appearing = isNew || was === 'unknown' || was === '';
          if (appearing) { a.placed = false; a.alpha = 0; }
          const loud = state === 'due' || state === 'late' || state === 'error';   // on arrival only trouble speaks; later every change does
          if (bubble && !reduced && state !== 'unknown' && (!appearing || loud)) { a.bubbleText = bubble; a.bubbleUntil = simT + 4200 + (appearing ? 600 : 0); } else a.bubbleUntil = -1;
        }
        a.state = state; a.desk = next.length;
        next.push(a);
      }
      const sig = (c) => c.map((a) => a.id + ':' + a.hue).join(',');
      const changedRoom = sig(next) !== sig(crew);
      crew = next; byId = new Map(next.map((a) => [a.id, a]));
      if (next.length) hadCrew = true;
      if (changedRoom) { relayout(); retarget(first || !framed ? 'first' : 'snap'); }
      else retarget(framed ? '' : 'first');
      wake();
    }

    function launchSlip(a, deskIndex) {
      const d = L.desks[deskIndex]; if (!d) return;
      flights.push({ x0: d.x0 + 6, y0: d.dy - 8, t0: simT + 200, dur: 1300 });
    }

    // ───────── size ─────────
    // One logical pixel is 2 css px (2.5 on a wide page), on whole device pixels whenever the screen's ratio allows it,
    // so the art stays crisp; the room's logical width follows the page, which is what makes a wide page a wider room.
    function fit() {
      const scaleFor = (target) => { if (cssW / target < 178) target = Math.max(0.5, cssW / 178); const kk = Math.floor(target * dpr + 1e-6); return kk < 1 || kk / dpr < Math.min(1.5, target) - 1e-6 ? target * dpr : kk; };
      k = scaleFor(cssW >= 1000 ? 2.5 : 2);
      let l = makeLayout(cw / k, crew.length, k / dpr);
      if (k / dpr > 2 && l.H * k / dpr > (crew.length >= 8 ? 440 : 380)) { k = scaleFor(2); l = makeLayout(cw / k, crew.length, k / dpr); }
      s = k / dpr; L = l; nav = null;
    }
    function relayout() {
      if (!sized) { L = makeLayout(240, crew.length, 2); nav = null; return; }
      const k0 = k, h0 = L.H;
      fit(); bgKey = ''; full = true;
      if (k !== k0 || L.H !== h0) applySize();
    }
    function applySize() {
      ch = Math.max(1, Math.round(L.H * k)); cssH = ch / dpr;
      canvas.width = cw; canvas.height = ch;
      canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
      g.imageSmoothingEnabled = false;
      fontTag = '600 ' + 11 * dpr + 'px ' + FONT_STACK; fontNum = '700 ' + 11 * dpr + 'px ' + FONT_STACK; tw = new Map();
      bgKey = ''; full = true; dirty = []; dirtyPrev = []; inkOf = null;
    }
    function resize(w) {
      w = clamp(num(w, 0), 0, 4096);
      const d = clamp(num(root.devicePixelRatio, 1), 0.5, 4);
      if (sized && w === cssW && d === dpr && canvas.width === cw && canvas.height === ch) { wake(); return cssH; }   // nothing changed: nobody is moved
      dpr = d; cssW = w; cw = Math.round(w * dpr); sized = true;
      fit(); applySize();
      retarget(framed ? 'snap' : 'first');
      if (drew) draw();
      wake();
      return cssH;
    }

    // ───────── simulation ─────────
    const pace = () => 40 + clamp((L.W - 300) / 500, 0, 1) * 22;          // logical px a second; a wider room is crossed a little faster
    function step(dt) {
      crew.forEach((a) => {
        if (a.state === 'unknown') { a.alpha = 0; return; }
        a.alpha = Math.min(1, a.alpha + dt / 260);
        if (a.pending) { a.delay -= dt; if (a.delay <= 0) { a.pending = false; a.path = findPath(a.x, a.y, a.goal.x, a.goal.y, a); } }
        if (a.path) {
          let left = pace() * dt / 1000;
          while (left > 0 && a.path.length) {
            const p = a.path[0], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
            if (d <= left) { a.x = p.x; a.y = p.y; a.path.shift(); left -= d; a.dist += d; }
            else { a.x += dx / d * left; a.y += dy / d * left; a.dist += left; if (Math.abs(dx) > Math.abs(dy) * 0.7) { a.face = 0; a.dx = dx > 0 ? 1 : -1; } else { a.dx = 0; a.face = dy < 0 ? 1 : 0; } left = 0; }
          }
          if (!a.path.length) { a.path = null; a.face = 0; a.dx = 0; a.sitKind = seatOf(a.goal); }
        }
        const want = !a.path && a.sitKind ? 1 : 0;                        // it keeps its seat until it sets off
        a.sit = clamp(a.sit + clamp(want - a.sit, -dt / 170, dt / 170), 0, 1);
        if (a.path && a.sit <= 0) a.sitKind = '';
      });
      flights = flights.filter((f) => { if (simT >= f.t0 + f.dur) { trayPop = simT; return false; } return true; });
    }

    // where a robot is drawn (its feet), after sitting down or hopping on the sofa
    const feet = (a) => { const off = a.sitKind === 'desk' ? 7 * a.sit : a.sitKind === 'sofa' ? -6 * a.sit : 0; return { x: Math.round(a.x * k) / k, y: Math.round((a.y + off) * k) / k }; };
    const present = (a) => a.state !== 'unknown';

    // ───────── drawing the live things ─────────
    function glow(cx, cy, r, col, al) { disc(cx, cy, r, cssA(col, al * 0.55)); if (r > 3) disc(cx, cy, r - 2, cssA(col, al * 0.6)); }

    function drawDeskLive(d, a, t) {
      const st = a ? a.state : 'unknown', home = a && (st === 'working' || st === 'due' || st === 'late' || st === 'error');
      const x = d.scr.x, y = d.scr.y, hue = HUES[a ? a.hue : 'teal'];
      if (st === 'working' || st === 'error') mark(x - 4, y - 5, 17, 16); else mark(x, y, 9, 7);
      if (home) mark(d.lx - 4, d.dy - 6, 13, 13);
      if (st === 'working') {
        R(x, y, 9, 6, '#d6f6ff');
        const sc = Math.floor(t / 260);
        for (let r = 0; r < 3; r++) { const hh = hash(sc + r, d.i * 13 + 5), len = 3 + Math.floor(hh * 5); R(x + 1, y + 1 + r * 2, len, 1, r === 2 && (Math.floor(t / 130) & 1) ? '#2a8fb0' : '#3f6f96'); }
        R(x + 1 + 3 + Math.floor(hash(sc + 2, d.i * 13 + 5) * 5), y + 5, 1, 1, (Math.floor(t / 260) & 1) ? '#2a2238' : '#d6f6ff');
        if (lt.day < 0.6) glow(x + 4, y + 2, 7, [150, 230, 255], 0.1);
      } else if (st === 'due' || st === 'late') {
        const late = st === 'late'; R(x, y, 9, 6, late ? '#c99a52' : '#ffd98a');
        const ink = late ? '#5a3d1e' : '#6a4a1c', ph = late ? 1 : Math.floor(t / 650) % 2;
        R(x + 1, y, 5, 1, ink); R(x + 1, y + 5, 5, 1, ink); R(x + 2, y + 1, 3, 1, ink); R(x + 3, y + 2, 1, 2, ink); R(x + 2, y + 4, 3, 1, ink);
        R(x + 3, y + (ph ? 4 : 1), 1, 1, '#fff6d8');
        if (!late) { const n = Math.floor(t / 420) % 4; for (let i = 0; i < n; i++) R(x + 7, y + 4 - i * 2, 1, 1, ink); }
        else if ((Math.floor(t / 500) & 1) === 0) { R(x + 7, y + 1, 1, 2, '#a3271f'); R(x + 7, y + 4, 1, 1, '#a3271f'); }
      } else if (st === 'error') {
        const ph = Math.floor(t / 380) & 1; R(x, y, 9, 6, ph ? '#ff6464' : '#d63c4c');
        R(x + 4, y + 1, 1, 3, '#ffffff'); R(x + 4, y + 5, 1, 1, '#ffffff');
        const gl = Math.floor(hash(Math.floor(t / 140), d.i + 3) * 6); R(x, y + gl, 9, 1, 'rgba(255,255,255,0.45)');
        if (lt.day < 0.6) glow(x + 4, y + 2, 7, RED, 0.1);
      } else if (st !== 'unknown' && a) {
        R(x, y, 9, 6, css(mix(rgb(hue[2]), [35, 29, 51], 0.62)));         // asleep, in the agent's colour: it is away, not gone
        const p = Math.floor(t / 700 + d.i * 3) % 12, bx = p < 6 ? p : 12 - p, byy = Math.floor(t / 900 + d.i) % 6; R(x + 1 + bx, y + (byy < 4 ? byy : 6 - byy), 2, 2, hue[1]);
      }
      if (st === 'unknown') {
        const yy = d.dy, up = reduced ? 0 : (Math.floor(t / 700 + d.i) & 1), qx = d.sx - 3, qy = yy - 22 - up;
        mark(d.sx - 5, yy - 24, 10, 25);
        R(d.sx - 4, yy - 9, 8, 9, '#55506a'); R(d.sx - 3, yy - 8, 6, 7, '#7a7590'); R(d.sx - 3, yy - 8, 6, 1, '#918ca6');
        R(qx, qy, 6, 9, INK); R(qx - 1, qy + 1, 8, 7, INK);
        R(qx + 1, qy + 1, 3, 1, '#d9d3ea'); R(qx, qy + 2, 1, 1, '#d9d3ea'); R(qx + 4, qy + 2, 1, 2, '#d9d3ea'); R(qx + 3, qy + 4, 1, 1, '#d9d3ea'); R(qx + 2, qy + 5, 1, 1, '#d9d3ea'); R(qx + 2, qy + 7, 1, 1, '#d9d3ea');
      }
      // the lamp on the desk
      let col = null, on = true;
      if (st === 'working') col = GREEN;
      else if (st === 'due') col = AMBER;
      else if (st === 'late') { col = AMBER; on = (Math.floor(t / 520) & 1) === 0; }
      else if (st === 'error') { col = RED; on = (Math.floor(t / 260) % 3) !== 2; }
      if (col && home) {
        if (on) { glow(d.lx + 2, d.dy, 5, col, 0.22); R(d.lx + 1, d.dy - 1, 3, 3, css(col)); R(d.lx + 1, d.dy - 1, 1, 1, '#ffffff'); }
        else R(d.lx + 1, d.dy - 1, 3, 3, css(mix(col, [60, 50, 70], 0.7)));
      }
    }

    // one robot. v: where and how (see poseOf)
    function drawBot(v) {
      const x = v.x, y = v.y, c = v.c, clip = v.clip, look = v.look, back = v.face === 1;
      const P = (dx, dy, w, h, col) => { let yy = y + dy; if (clip !== null) { if (yy >= clip) return; if (yy + h > clip) h = clip - yy; } R(x + dx, yy, w, h, col); };
      const b = -v.bob, bx = v.bx, hx = bx + v.hx, hy = b + v.hy, tm = T(METAL), td = T(METAL_D);
      // legs and feet
      if (v.legs) {
        const A = v.legA, B = v.legB;
        P(-4 + A[0], -4, 2, 2, INK); P(-5 + A[0], -2 - A[1], 4, 2, INK); P(-4 + A[0], -2 - A[1], 2, 1, c[2]);
        P(2 + B[0], -4, 2, 2, INK); P(1 + B[0], -2 - B[1], 4, 2, INK); P(2 + B[0], -2 - B[1], 2, 1, c[2]);
      }
      // body
      P(-4 + bx, -9 + b, 8, 6, INK); P(-5 + bx, -8 + b, 10, 4, INK);
      P(-4 + bx, -8 + b, 8, 4, c[0]); P(3 + bx, -8 + b, 1, 4, c[2]); P(-4 + bx, -5 + b, 8, 1, c[2]); P(-4 + bx, -8 + b, 1, 2, c[1]);
      if (back) P(-2 + bx, -7 + b, 4, 2, c[2]); else P(-1 + bx, -7 + b, 2, 2, v.chest || c[1]);
      P(-3 + bx, -10 + b, 6, 1, INK); P(-2 + bx, -10 + b, 4, 1, td);
      // arms: 0 hangs and swings, anything else is bent (the hand is drawn with what it holds)
      if (v.armL === 0) { P(-7 + bx, -8 + b + v.swL, 2, 5, INK); P(-6 + bx, -8 + b + v.swL, 1, 3, c[0]); P(-6 + bx, -5 + b + v.swL, 1, 1, tm); }
      else { P(-7 + bx, -8 + b, 2, 3, INK); P(-6 + bx, -8 + b, 1, 2, c[0]); }
      if (v.armR === 0) { P(5 + bx, -8 + b + v.swR, 2, 5, INK); P(5 + bx, -8 + b + v.swR, 1, 3, c[0]); P(5 + bx, -5 + b + v.swR, 1, 1, tm); }
      else { P(5 + bx, -8 + b, 2, 3, INK); P(5 + bx, -8 + b, 1, 2, c[0]); }
      // head
      if (look === 'bulb') {
        const t0 = -22 + hy, on = v.lit, gl = on ? '#ffec7a' : '#f6dc8c', g2 = on ? '#ffc93c' : '#dcb964';
        P(-3 + hx, t0, 6, 1, INK); P(-5 + hx, t0 + 1, 10, 1, INK); P(-6 + hx, t0 + 2, 12, 6, INK); P(-5 + hx, t0 + 8, 10, 1, INK); P(-4 + hx, t0 + 9, 8, 1, INK);
        P(-3 + hx, t0 + 1, 6, 1, gl); P(-5 + hx, t0 + 2, 10, 6, gl); P(-4 + hx, t0 + 8, 8, 1, g2); P(4 + hx, t0 + 3, 1, 5, g2); P(-3 + hx, t0 + 7, 6, 1, g2);
        P(-4 + hx, t0 + 2, 3, 1, '#ffffff'); P(-5 + hx, t0 + 3, 1, 2, '#ffffff');
        P(-4 + hx, t0 + 10, 8, 2, INK); P(-3 + hx, t0 + 10, 6, 1, tm); P(-3 + hx, t0 + 11, 6, 1, td); P(-1 + hx, t0 + 10, 1, 2, td); P(2 + hx, t0 + 10, 1, 1, td);
        if (on && !back) { const ry = '#fff3a8'; P(hx, t0 - 3, 1, 2, ry); P(-9 + hx, t0 + 4, 2, 1, ry); P(8 + hx, t0 + 4, 2, 1, ry); P(-7 + hx, t0 - 1, 1, 1, ry); P(-8 + hx, t0 - 2, 1, 1, ry); P(6 + hx, t0 - 1, 1, 1, ry); P(7 + hx, t0 - 2, 1, 1, ry); }
        if (!back) {
          const ex = hx + v.vx + v.ex, ey = t0 + 4 + v.ey;
          if (v.eye === 1) { P(-3 + ex, ey + 1, 2, 1, INK); P(1 + ex, ey + 1, 2, 1, INK); }
          else if (v.eye === 2) { const f = v.flick; P(-3 + ex + f, ey, 1, 1, '#c22d3a'); P(-2 + ex - f, ey + 1, 1, 1, '#c22d3a'); P(1 + ex + f, ey, 1, 1, '#c22d3a'); P(2 + ex - f, ey + 1, 1, 1, '#c22d3a'); }
          else { P(-3 + ex, ey, 2, 2, INK); P(1 + ex, ey, 2, 2, INK); }
          P(-2 + hx, t0 + 7, 1, 1, '#e8862a'); P(-1 + hx, t0 + 8, 2, 1, '#e8862a'); P(1 + hx, t0 + 7, 1, 1, '#e8862a');
        }
      } else {
        const hY = -19 + hy;
        P(-5 + hx, hY, 10, 9, INK); P(-6 + hx, hY + 1, 12, 7, INK);
        P(-5 + hx, hY + 1, 10, 7, c[0]); P(-5 + hx, hY + 1, 7, 1, c[1]); P(-5 + hx, hY + 2, 1, 2, c[1]); P(-5 + hx, hY + 7, 10, 1, c[2]); P(4 + hx, hY + 2, 1, 5, c[2]);
        if (back) { P(-3 + hx, hY + 3, 6, 3, c[2]); P(-2 + hx, hY + 4, 4, 1, INK); }
        else {
          const vx = hx + v.vx;
          P(-4 + vx, hY + 2, 8, 4, VISOR); P(-4 + vx, hY + 2, 8, 1, '#3a3350');
          const ex = vx + v.ex, ey = hY + 3 + v.ey, far = v.vx;
          if (v.eye === 1) { P(-3 + ex, ey + 1, 2, 1, EYE_DIM); P(1 + ex, ey + 1, 2, 1, EYE_DIM); }
          else if (v.eye === 2) { const f = v.flick; P(-3 + ex + f, ey, 1, 1, '#ff6a6a'); P(-2 + ex - f, ey + 1, 1, 1, '#ff6a6a'); P(1 + ex + f, ey, 1, 1, '#ff6a6a'); P(2 + ex - f, ey + 1, 1, 1, '#ff6a6a'); }
          else { P(-3 + ex + (far > 0 ? 1 : 0), ey, far > 0 ? 1 : 2, 2, EYE); P(1 + ex, ey, far < 0 ? 1 : 2, 2, EYE); }
          P(-1 + hx, hY + 6, 2, 1, c[2]);
        }
        if (look === 'headset') {
          P(-3 + hx, hY - 2, 6, 1, INK); P(-5 + hx, hY - 1, 10, 1, INK); P(-4 + hx, hY - 1, 8, 1, '#a9acbf');
          P(-8 + hx, hY + 2, 3, 5, INK); P(-7 + hx, hY + 3, 1, 3, '#f4efe2'); P(5 + hx, hY + 2, 3, 5, INK); P(6 + hx, hY + 3, 1, 3, '#f4efe2');
          if (!back) { P(-7 + hx, hY + 7, 1, 1, INK); P(-6 + hx, hY + 6, 1, 2, INK); P(-5 + hx, hY + 6, 2, 1, '#ffffff'); }
        } else if (look === 'antenna') {
          P(hx, hY - 4, 1, 4, INK); P(-1 + hx, hY - 8, 3, 4, INK); P(-2 + hx, hY - 7, 5, 2, INK); P(-1 + hx, hY - 7, 3, 2, v.lit ? '#fff06a' : '#f29a3a'); P(-1 + hx, hY - 7, 1, 1, '#ffffff');
          P(-7 + hx, hY + 3, 1, 3, INK); P(6 + hx, hY + 3, 1, 3, INK);
        } else if (look === 'plain') { P(-2 + hx, hY - 1, 4, 1, INK); P(-1 + hx, hY - 1, 2, 1, td); }
        else if (look === 'clipboard') { P(-3 + hx, hY - 1, 6, 1, INK); P(-2 + hx, hY - 1, 4, 1, '#f4efe2'); }
      }
      // what the right hand holds
      if (look === 'gavel') {
        if (!v.bang) {
          P(7 + bx, -10 + b, 3, 3, INK); P(7 + bx, -9 + b, 2, 1, c[0]); P(9 + bx, -12 + b, 4, 4, INK); P(10 + bx, -11 + b, 2, 2, tm);
          P(10 + bx, -17 + b, 2, 6, INK); P(10 + bx, -17 + b, 1, 5, T(WOOD));
          P(8 + bx, -21 + b, 6, 5, INK); P(7 + bx, -20 + b, 8, 3, INK); P(8 + bx, -20 + b, 6, 3, T(WOOD_D)); P(8 + bx, -20 + b, 6, 1, T(WOOD)); P(8 + bx, -20 + b, 1, 3, T('#e8c06a')); P(13 + bx, -20 + b, 1, 3, T('#e8c06a'));
        } else {
          P(7 + bx, -9 + b, 3, 3, INK); P(7 + bx, -8 + b, 2, 1, c[0]); P(9 + bx, -10 + b, 4, 4, INK); P(10 + bx, -9 + b, 2, 2, tm);
          P(12 + bx, -9 + b, 4, 2, INK); P(12 + bx, -9 + b, 3, 1, T(WOOD));
          P(15 + bx, -12 + b, 5, 8, INK); P(16 + bx, -11 + b, 3, 6, T(WOOD_D)); P(16 + bx, -11 + b, 1, 6, T(WOOD)); P(16 + bx, -11 + b, 3, 1, T('#e8c06a')); P(16 + bx, -6 + b, 3, 1, T('#e8c06a'));
        }
      } else if (look === 'clipboard') {
        P(5 + bx, -12 + b, 7, 10, INK); P(6 + bx, -11 + b, 5, 8, T('#b9824f')); P(7 + bx, -10 + b, 3, 6, PAPER); P(7 + bx, -9 + b, 2, 1, '#9aa0b0'); P(7 + bx, -7 + b, 3, 1, '#9aa0b0'); P(7 + bx, -5 + b, 2, 1, '#9aa0b0');
        P(7 + bx, -13 + b, 3, 2, INK); P(7 + bx, -12 + b, 3, 1, tm); P(5 + bx, -6 + b, 2, 2, INK); P(5 + bx, -6 + b, 1, 1, tm);
      }
      // the slip: in its hands, or still on the desk while it sits there
      if (v.slipW) {
        const sw = v.slipW;
        if (v.deskY !== null) { const sx = x + Math.round(-sw / 2), sy = v.deskY + 1; R(sx, sy, sw, 7, INK); R(sx + 1, sy + 1, sw - 2, 5, PAPER); R(sx + sw - 2, sy + 1, 1, 5, PAPER_D); v.slip = { x: sx, y: sy, w: sw, h: 7 }; }
        else {
          const sx = Math.round(-sw / 2) + bx, sy = -9 + b + v.slipDy;
          P(sx, sy, sw, 7, INK); P(sx + 1, sy + 1, sw - 2, 5, PAPER); P(sx + sw - 2, sy + 1, 1, 5, PAPER_D);
          P(sx - 1, sy + 3, 2, 3, INK); P(sx - 1, sy + 4, 1, 1, tm);
          if (v.armR === 2) { P(sx + sw - 1, sy + 3, 2, 3, INK); P(sx + sw, sy + 4, 1, 1, tm); }
          v.slip = { x: x + sx, y: y + sy, w: sw, h: 7 };
        }
      } else if (v.mug) {
        const my = v.sip ? -14 : -8;
        P(-9 + bx, my + b, 5, 5, INK); P(-8 + bx, my + 1 + b, 3, 3, '#f4efe2'); P(-8 + bx, my + 1 + b, 3, 1, '#7a4a2e'); P(-10 + bx, my + 1 + b, 1, 3, INK);
        if (v.sip) P(-7 + bx, -9 + b, 2, 2, INK);
      }
    }

    // hands on the desk for a robot in its chair
    function drawHands(v, d, mode, t) {
      const y = d.dy, x = v.x, tm = T(METAL);
      if (mode === 'type') {
        const p = Math.floor(t / 130), l = hash(p, v.seed) < 0.5 ? 1 : 0, r = hash(p, v.seed + 9) < 0.5 ? 1 : 0;
        R(x - 5, y + 1 + l, 3, 3, INK); R(x - 4, y + 1 + l, 1, 2, tm);
        if (v.armR === 0) { R(x + 2, y + 1 + r, 3, 3, INK); R(x + 3, y + 1 + r, 1, 2, tm); }
      } else if (mode === 'rest') {
        const tap = (Math.floor(t / 180) % 14) < 4 && (Math.floor(t / 180) & 1) ? 1 : 0;
        R(x - 5, y + 1, 3, 3, INK); R(x - 4, y + 1, 1, 2, tm);
        if (v.armR === 0) { R(x + 2, y + 1 - tap, 3, 3, INK); R(x + 3, y + 1 - tap, 1, 2, tm); }
      } else if (mode === 'flat') {
        R(x - 10, y + 1, 7, 3, INK); R(x - 9, y + 2, 5, 1, tm);
        if (v.armR === 0) { R(x + 3, y + 1, 7, 3, INK); R(x + 4, y + 2, 5, 1, tm); }
      }
    }

    function zees(x, y, t, sd) {
      for (let i = 0; i < 2; i++) {
        const p = ((t / 2600) + i * 0.5 + hash(sd, 3)) % 1, al = p < 0.15 ? p / 0.15 : 1 - Math.max(0, p - 0.6) / 0.4, n = i ? 5 : 4;
        const ink = cssA([42, 34, 56], al), wh = cssA([255, 255, 255], al), X = Math.round(x + 5 + p * 7 + (i ? 1 : 0)), Y = Math.round(y - 22 - p * 11);
        R(X - 1, Y - 1, n + 2, n + 2, ink);
        R(X, Y, n, 1, wh); R(X, Y + n - 1, n, 1, wh); for (let j = 1; j < n - 1; j++) R(X + n - 1 - j, Y + j, 1, 1, wh);
      }
    }
    function sparks(x, y, t, sd) {
      for (let i = 0; i < 4; i++) {
        const p = ((t / 620) + hash(sd, i)) % 1, dir = i % 2 ? 1 : -1, sx = x + dir * (3 + p * (6 + 3 * hash(i, sd))), sy = y - 20 - p * 9 + p * p * 10;
        R(Math.round(sx), Math.round(sy), p < 0.5 ? 2 : 1, p < 0.5 ? 2 : 1, i % 2 ? '#fff6a8' : '#ffd23c');
      }
      for (let i = 0; i < 2; i++) { const p = ((t / 1900) + i * 0.5) % 1; R(Math.round(x - 2 + i * 3 + Math.sin(p * 6 + i) * 1.5), Math.round(y - 22 - p * 10), 3 - (p > 0.6 ? 1 : 0), 2, cssA([90, 84, 104], 0.75 * (1 - p))); }
    }
    function alarm(x, y, t) {
      const up = (Math.floor(t / 300) & 1), yy = y - 33 - up;
      R(x - 3, yy, 7, 9, INK); R(x - 4, yy + 1, 9, 7, INK); R(x - 3, yy + 1, 7, 7, '#ff5656'); R(x - 3, yy + 1, 7, 1, '#ff9c9c');
      R(x - 1, yy + 2, 2, 3, '#ffffff'); R(x - 1, yy + 6, 2, 1, '#ffffff'); R(x - 1, yy + 9, 2, 1, INK);
    }
    function steam(x, y, t, sd) {
      for (let i = 0; i < 3; i++) { const p = ((t / 2200) + i / 3 + hash(sd, 1)) % 1; R(Math.round(x + Math.sin(p * 7 + i * 2) * 1.6), Math.round(y - p * 9), 1, 2, cssA([255, 255, 255], 0.75 * (1 - p))); }
    }

    // how a robot stands right now
    function poseOf(a, t) {
      const f = feet(a), d = L.desks[a.desk], hue = HUES[a.hue];
      const v = { a, x: f.x, y: f.y, c: [T(hue[0]), T(hue[1]), T(hue[2])], look: a.look, seed: a.seed, face: a.face, clip: null, bob: 0, bx: 0, hx: 0, hy: 0, vx: 0, ex: 0, ey: 0, eye: 0, flick: 0,
        legs: true, legA: [0, 0], legB: [0, 0], armL: 0, armR: a.look === 'gavel' || a.look === 'clipboard' ? 1 : 0, swL: 0, swR: 0, slipW: 0, slipDy: 0, deskY: null, num: '', mug: false, sip: false, bang: false, lit: false, chest: null, slip: null, hands: '', fx: '' };
      const r1 = hash(a.seed, 1), r2 = hash(a.seed, 2), r3 = hash(a.seed, 3);
      const blink = ((t + r1 * 4000) % (3300 + r2 * 1900)) < 140;
      const seated = a.sitKind === 'desk' && a.sit > 0 && !!d, onDesk = seated ? d.dy : null;
      if (seated) v.clip = d.dy;
      v.lit = a.look === 'antenna' ? ((t + r3 * 1500) % 1500) < 260 : a.look === 'bulb' ? ((t + r3 * 5000) % 5200) > 900 : false;
      if (a.path) {                                                   // walking: the cycle follows the ground covered
        const ph = Math.floor(a.dist / (pace() * 0.085)) % 4, side = a.dx;      // four steps of the cycle to about a third of a second
        if (side) { v.vx = side; v.hx = 0; if (ph === 0) { v.legA = [side * 1, 0]; v.legB = [-side * 1, 0]; } else if (ph === 2) { v.legA = [-side * 1, 0]; v.legB = [side * 1, 0]; } else { v.bob = 1; if (ph === 1) v.legA = [0, 1]; else v.legB = [0, 1]; } v.swL = ph === 0 ? -1 : ph === 2 ? 1 : 0; v.swR = -v.swL; }
        else { if (ph === 0) v.legA = [0, 1]; else if (ph === 2) v.legB = [0, 1]; else v.bob = 1; v.swL = ph === 0 ? -1 : ph === 2 ? 1 : 0; v.swR = -v.swL; }
        if (a.state === 'needs') wearSlip(v, a, onDesk);
      } else if (seated && a.sit >= 1 && a.goal.kind === 'desk') {     // in its chair
        v.legs = false;
        if (a.state === 'working') { v.hands = 'type'; v.ex = -1; v.bob = (Math.floor(t / 400 + r1 * 3) % 5) === 0 ? 1 : 0; if (((t + r2 * 3000) % 5200) < 700) { v.ex = 0; v.ey = 1; } v.eye = blink ? 1 : 0; if (a.look === 'gavel') v.bang = ((t + r1 * 2000) % 2600) < 160; }
        else if (a.state === 'due') { v.hands = 'rest'; v.ex = -1; const u = (t + r2 * 4000) % 6400; if (u < 900) { v.ex = 1; v.ey = -1; v.hy = -1; } v.eye = blink ? 1 : 0; }
        else if (a.state === 'late') { v.hands = 'flat'; v.hy = 4; v.hx = -1; v.eye = 1; v.fx = 'zzz'; v.bob = ((t + r1 * 2000) % 3200) < 1500 ? 0 : -1; }
        else if (a.state === 'error') { v.hands = 'rest'; v.eye = 2; v.flick = Math.floor(t / 160) & 1; v.hx = (Math.floor(t / 90) % 9) === 0 ? 1 : 0; v.hy = 1; v.fx = 'err'; }
        else { v.hands = 'rest'; v.eye = blink ? 1 : 0; }
      } else {                                                         // standing, or on the sofa
        if (seated) v.legs = false;
        const doze = a.state === 'idle' && lt.late && !a.pending;
        const br = ((t + r1 * 1700) % (1500 + r2 * 500)) < 620 ? 1 : 0;
        v.bob = br;
        if (a.state === 'needs') {
          wearSlip(v, a, onDesk);
          v.vx = -1;                                                   // looks towards your desk
          const u = (t + r2 * 9000) % (8200 + r3 * 3000);
          if (u < 950) { v.vx = 0; v.ey = 1; v.slipDy = -1; }          // a glance at the slip
          else if (u > 4200 && u < 5300) { v.vx = 0; }                 // a look at you through the screen
          const w = (t + r3 * 7000) % (7600 + r1 * 2600);
          if (w < 1400) v.bx = a.seed & 1 ? 1 : -1;                    // shifts its weight
          else if (w > 3600 && w < 4300 && (Math.floor(t / 120) & 1)) v.legB = [0, 1];   // taps a foot
          v.eye = blink ? 1 : 0;
          if (a.look === 'gavel') v.bang = ((t + r1 * 5000) % 6900) < 170;
        } else if (doze) { v.eye = 1; v.hy = 1; v.bob = ((t + r1 * 2000) % 3400) < 1700 ? 0 : -1; v.fx = 'zzz'; v.lit = false; }
        else if (a.state === 'idle') {
          const settled = !a.pending && a.goal.kind === 'lounge';
          v.mug = settled; const u = (t + r2 * 7000) % (6800 + r3 * 2400); v.sip = settled && u < 900;
          const e = (t + r1 * 5000) % 5600; v.ex = e < 1500 ? -1 : e < 3000 ? 1 : 0; v.eye = blink || v.sip ? 1 : 0;
          if (v.mug) v.armL = 2;
        } else v.eye = blink ? 1 : 0;
      }
      if (simT - a.popAt < 260 && v.slipW && !reduced) v.slipDy = -1;        // the count changed: the slip jumps
      if (a.state === 'late') v.lit = false;
      if (reduced) { v.bob = 0; v.bx = 0; v.bang = false; v.sip = false; v.slipDy = 0; if (v.fx !== 'zzz' && v.eye === 1) v.eye = 0; if (a.state === 'needs') { v.vx = -1; v.ey = 0; } }
      return v;
    }
    function wearSlip(v, a, deskY) {
      const str = a.waiting > 99 ? '99+' : String(a.waiting);
      v.num = str; v.slipW = Math.max(7, Math.ceil((textW(str, true) / dpr + 3) / s) + 2);
      if (deskY !== null) v.deskY = deskY; else { v.armL = 2; if (v.armR === 0) v.armR = 2; }
    }

    function drawYou(t) {
      const d = L.wd, x = d.seat, y = d.by;
      mark(x - 11, y - 19, 24, 30);
      const shirt = T('#f4efe2'), sh2 = T('#d3cab5'), skin = T('#f1c9a0'), hair = T('#4a3b46');
      const u = t % 9000, look = queue.length && u > 6200 && u < 7600, sip = !queue.length && (t % 11000) > 9600, wr = queue.length ? (Math.floor(t / 210) % 3) - 1 : 0;
      const blink = !reduced && (t % 4100) < 130, by = ((t + 500) % 3000) < 1300 ? 0 : -1;
      // shoulders, neck, head
      R(x - 6, y - 5, 12, 5, INK); R(x - 7, y - 4, 14, 4, INK); R(x - 6, y - 4, 12, 4, shirt); R(x + 4, y - 4, 2, 4, sh2); R(x - 1, y - 4, 2, 2, skin);
      R(x - 3, y - 7, 6, 3, INK); R(x - 2, y - 7, 4, 3, skin);
      R(x - 4, y - 15 + by, 8, 9, INK); R(x - 5, y - 14 + by, 10, 7, INK); R(x - 4, y - 14 + by, 8, 7, skin); R(x - 2, y - 7 + by, 4, 1, skin);
      R(x - 4, y - 14 + by, 8, 2, hair); R(x - 5, y - 13 + by, 1, 1, hair); R(x + 4, y - 13 + by, 1, 1, hair);   // a plain short crop: no guess at anyone's looks
      const ex = look ? 1 : 0, ey = look || sip ? 0 : 1;
      if (!blink) { R(x - 2 + ex, y - 10 + by + ey, 1, 1, INK); R(x + 1 + ex, y - 10 + by + ey, 1, 1, INK); }
      // arms on the desk; a pen in the right hand, the mug now and then in the left
      if (sip) { R(x - 9, y - 6, 3, 5, INK); R(x - 8, y - 5, 1, 3, shirt); R(x - 8, y - 11 + by, 5, 5, INK); R(x - 7, y - 10 + by, 3, 3, T('#f4efe2')); R(x - 7, y - 10 + by, 3, 1, T('#6b4631')); }
      else { R(x - 9, y - 1, 4, 5, INK); R(x - 8, y - 1, 2, 3, shirt); R(x - 8, y + 2, 2, 1, skin); }
      R(x + 4 + wr, y - 1, 4, 5, INK); R(x + 5 + wr, y - 1, 2, 3, shirt); R(x + 5 + wr, y + 2, 2, 1, skin); R(x + 3 + wr, y + 3, 1, 3, INK);
      // the tray: a stack that grows with what is waiting (when a sheet is in the air, it grows as the sheet lands)
      let total = 0; crew.forEach((a) => { if (a.state === 'needs') total += a.waiting; });
      const target = total > 0 ? Math.min(10, 1 + Math.floor(Math.log2(total + 1) * 1.15)) : 0;
      if (reduced || !flights.length || target < trayShown) trayShown = target;
      const since = simT - trayPop, hs = trayShown + (trayShown && since < 240 ? 1 : 0), tx = d.tray.x, ty = d.tray.y;
      if (since < 420) mark(tx - 5, ty - hs - 8, 24, hs + 12); else mark(tx, ty - hs, 14, hs + 4);
      for (let i = 0; i < hs; i++) { R(tx + 1, ty + 2 - i, 12, 1, INK); R(tx + 2, ty + 2 - i, 10, 1, i % 2 ? T('#d9cfb8') : T(PAPER)); }
      if (hs) { R(tx + 2, ty + 2 - hs, 10, 1, INK); R(tx + 2, ty + 3 - hs, 10, 1, '#ffffff'); }
      if (since < 420 && !reduced) { const r = 2 + Math.floor(since / 105), cy = ty - hs - 1, c2 = '#fff3a8'; R(tx + 6 - r - 3, cy, 2, 1, c2); R(tx + 7 + r + 1, cy, 2, 1, c2); R(tx + 6, cy - r - 1, 1, 2, c2); R(tx + 6 - r, cy - r, 1, 1, c2); R(tx + 7 + r, cy - r, 1, 1, c2); }
      // steam from the mug
      if (!reduced && !sip) { mark(d.x + 14, y - 8, 8, 13); steam(d.x + 17, y + 3, t, 77); }
    }

    // ───────── words: name tags, slip numbers, bubbles (screen space, device pixels) ─────────
    function textW(str, bold) {
      const key = (bold ? 'b' : 'n') + str; let w = tw.get(key);
      if (w === undefined) { g.font = bold ? fontNum : fontTag; w = num(g.measureText(str).width, str.length * 6 * dpr); tw.set(key, w); }
      return w;
    }
    const plate = (X, Y, w, h, cut, fill) => { g.fillStyle = fill; g.fillRect(X + cut, Y, w - 2 * cut, h); g.fillRect(X, Y + cut, w, h - 2 * cut); };
    function drawWords(list, t) {
      const u = dpr, cut = Math.max(1, Math.round(k)), H = Math.round(14 * u), placed = [];
      let nSlips = 0;
      const clash = (X, Y, w, h, from) => { for (let i = from || 0; i < placed.length; i += 4) if (X < placed[i] + placed[i + 2] + u * 2 && X + w + u * 2 > placed[i] && Y < placed[i + 1] + placed[i + 3] + u && Y + h + u > placed[i + 1]) return true; return false; };
      const put = (X, Y, w, h) => { placed.push(X, Y, w, h); markD(X - 1, Y - 1, w + 2, h + 2); };
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      // slip numbers sit on their paper
      list.forEach((v) => {
        if (!v.slip || !v.num) return;
        const w = textW(v.num, true), X = Math.round(v.slip.x * k + (v.slip.w * k - w) / 2 - 0.5 * u), Y = Math.round(v.slip.y * k);
        g.font = fontNum; g.fillStyle = INK; g.fillText(v.num, X, Y + Math.round(11 * u));
        put(Math.round(v.slip.x * k), Y, Math.round(v.slip.w * k), Math.round(7 * k));
      });
      // name tags: a plate on the desk front for whoever sits there (those stay put, like yours), under the feet for the rest
      nSlips = placed.length;
      const tags = [];
      { const d = L.wd; tags.push({ text: 'You', cx: (d.x + d.w / 2) * k, top: (d.by + 13) * k, you: true, fixed: true }); }
      list.forEach((v) => { const a = v.a, d = L.desks[a.desk]; if (a.name && a.sitKind === 'desk' && a.sit > 0.5 && d) tags.push({ text: a.name, cx: d.cx * k, top: (d.dy + 9) * k, id: a.id, fixed: true }); });
      crew.forEach((a) => { const d = L.desks[a.desk]; if (!present(a) && a.name && d) tags.push({ text: a.name, cx: d.cx * k, top: (d.dy + 9) * k, ghost: true, fixed: true }); });
      list.forEach((v) => { const a = v.a; if (a.name && !(a.sitKind === 'desk' && a.sit > 0.5 && L.desks[a.desk])) tags.push({ text: a.name, cx: v.x * k, top: (Math.max(v.y, a.y) + 2) * k, id: a.id }); });
      tags.forEach((tg) => {
        g.font = fontTag;
        const w = Math.round(textW(tg.text, false) + 10 * u);
        let X = Math.round(clamp(tg.cx - w / 2, 2 * u, cw - w - 2 * u)), Y = Math.round(clamp(tg.top, 2 * u, ch - H - 2 * u));
        if (tg.you) { /* your plate is part of the desk */ } else if (tg.fixed ? clash(X, Y, w, H, nSlips) : clash(X, Y, w, H)) { const tries = [H + 2 * u, 2 * (H + 2 * u), -(H + 2 * u)]; for (let i = 0; i < tries.length; i++) { const y2 = Math.round(clamp(tg.top + tries[i], 2 * u, ch - H - 2 * u)); if (!clash(X, y2, w, H)) { Y = y2; break; } } }
        const hot = tg.id != null && (tg.id === focusId || tg.id === hoverId);
        plate(X, Y, w, H, cut, tg.you ? '#f3c552' : hot ? '#fffdf2' : tg.ghost ? 'rgba(35,28,50,0.42)' : 'rgba(35,28,50,0.92)');
        g.fillStyle = tg.you || hot ? INK : tg.ghost ? 'rgba(255,255,255,0.62)' : '#ffffff'; g.fillText(tg.text, X + Math.round(5 * u), Y + Math.round(10.5 * u));
        put(X, Y, w, H);
      });
      // bubbles: the step while working, a few words on a change
      list.forEach((v) => {
        const a = v.a; let text = '';
        if (a.state === 'working' && a.step && a.sitKind === 'desk' && a.sit >= 1) text = a.step;
        else if (a.bubbleUntil > simT && a.bubbleText) text = a.bubbleText;
        if (!text) return;
        g.font = fontTag;
        const w = Math.round(textW(text, false) + 12 * u), h = Math.round(16 * u), tail = Math.round(3 * k);
        // above the head and what sticks up from it; where that is taken, beside it or higher: the spot that covers least
        const tops = { bulb: 26, antenna: 28, gavel: 22 };
        const headTop = (v.y - 20 + v.hy) * k, hx = v.x * k, b0 = (v.y - (tops[a.look] || 20) + v.hy) * k - h - tail, b1 = headTop - h - tail, up = h + 3 * u, side = w * 0.4;
        const leanX = a.look === 'antenna' ? hx - 2 * k - w : a.look === 'gavel' ? hx + 5 * k - w : hx - w / 2;
        const cand = [[hx - w / 2, b0], [leanX, b1], [hx - w / 2 - side, b0], [hx - w / 2 + side, b0], [hx - w / 2, b0 - up], [hx - w / 2 - side, b0 - up], [hx - w / 2 + side, b0 - up], [hx - w / 2, b0 - 2 * up]];
        const cover = (X2, Y2) => { let c2 = 0; for (let i = 0; i < placed.length; i += 4) { const ox = Math.min(X2 + w, placed[i] + placed[i + 2]) - Math.max(X2, placed[i]) + 2 * u, oy = Math.min(Y2 + h, placed[i + 1] + placed[i + 3]) - Math.max(Y2, placed[i + 1]) + u; if (ox > 0 && oy > 0) c2 += ox * oy; } return c2; };
        let X = 0, Y = 0, bestC = Infinity;
        for (let i = 0; i < cand.length && bestC > 0; i++) { const x2 = Math.round(clamp(cand[i][0], 2 * u, cw - w - 2 * u)), y2 = Math.round(clamp(cand[i][1], 2 * u, ch - h - 2 * u)), c2 = cover(x2, y2) + i; if (c2 - i <= 0) { X = x2; Y = y2; bestC = 0; } else if (c2 < bestC) { X = x2; Y = y2; bestC = c2; } }
        plate(X, Y, w, h, cut, INK); plate(X + cut, Y + cut, w - 2 * cut, h - 2 * cut, cut, '#fffdf2');
        if (Y + h <= headTop) { const tx = Math.round(clamp(hx, X + 3 * cut, X + w - 4 * cut)); g.fillStyle = INK; g.fillRect(tx - cut, Y + h - cut, 3 * cut, 2 * cut); g.fillRect(tx, Y + h + cut, cut, cut); g.fillStyle = '#fffdf2'; g.fillRect(tx, Y + h - cut, cut, 2 * cut); markD(tx - cut - 1, Y + h - cut, 3 * cut + 2, 3 * cut + 1); }
        g.fillStyle = INK; g.fillText(text, X + Math.round(6 * u), Y + Math.round(11.5 * u));
        put(X, Y, w, h);
      });
      inkOf = null;
    }

    // ───────── one frame ─────────
    function draw() {
      if (cw < 2 || ch < 2) return;
      const nowMs = num(nowFn(), 0), t = reduced ? 0 : simT;
      const l2 = lightAt(nowMs);
      if (l2.key !== tintKey) { tintKey = l2.key; tints = new Map(); }
      lt = l2;
      const key = lt.key + '|' + cw + 'x' + ch + '|' + crew.map((a) => a.hue).join('');
      if (key !== bgKey) { rebuildRoom(); bgKey = key; }
      G = g; CL = null; inkOf = null; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      if (full || !bg) { if (bg) g.drawImage(bg, 0, 0); full = false; }
      else for (let i = 0; i < dirtyPrev.length; i += 4) g.drawImage(bg, dirtyPrev[i], dirtyPrev[i + 1], dirtyPrev[i + 2], dirtyPrev[i + 3], dirtyPrev[i], dirtyPrev[i + 1], dirtyPrev[i + 2], dirtyPrev[i + 3]);
      dirty = [];
      // the clock on the wall
      { const c = L.clock, dd = new Date(nowMs), hh = num(dd.getHours(), 0), mm = num(dd.getMinutes(), 0), ss = num(dd.getSeconds(), 0);
        mark(c.x - 7, c.y - 7, 15, 15);
        const am = mm / 60 * TAU, ah = ((hh % 12) + mm / 60) / 12 * TAU, as = ss / 60 * TAU;
        line(c.x, c.y, c.x + Math.sin(am) * 4.6, c.y - Math.cos(am) * 4.6, T(INK)); line(c.x, c.y, c.x + Math.sin(ah) * 2.8, c.y - Math.cos(ah) * 2.8, T(INK));
        if (!reduced) R(Math.round(c.x + Math.sin(as) * 5), Math.round(c.y - Math.cos(as) * 5), 1, 1, '#e2504a');
        R(c.x, c.y, 1, 1, '#e2504a'); }
      // snow outside, in winter
      if (lt.winter && !reduced) L.windows.forEach((w, wi) => {
        const x = w.x + 2, y = w.y + 2, gw = w.w - 4, gh = w.h - 4; CL = [x, y, x + gw, y + gh - 1];
        const col = cssA([255, 255, 255], 0.55 + 0.35 * lt.day);
        for (let i = 0; i < 6; i++) { const sp = 3.5 + 3 * hash(i, wi + 40), yy = y + ((t / 1000) * sp + hash(i, wi) * gh) % gh, xx = hash(i, wi + 9) * gw + Math.sin(t / 900 + i * 2.1) * 1.5, fx = x + ((xx % gw) + gw) % gw; if (w.holes.some((h) => fx >= h.x - 1 && fx < h.x + h.w && yy >= h.y - 1 && yy < h.y + h.h)) continue; mark(fx, yy, 1, 1); R(fx, yy, 1, 1, col); }
        CL = null;
      });
      // desks: screens and lamps
      L.desks.forEach((d) => drawDeskLive(d, crew[d.i], t));
      // the coffee machine
      { const c = L.cart; mark(c.x + 4, c.y - 14, 13, 5); R(c.x + 4, c.y - 13, 1, 1, (Math.floor(t / 900) & 1) ? '#fff6c2' : '#ffd23c');
        if (!reduced) for (let i = 0; i < 2; i++) { const p = ((t / 1700) + i * 0.5) % 1; R(c.x + 9 + i * 2 + ((Math.floor(t / 400) + i) & 1), c.y - 10 - Math.floor(p * 3), 1, 1, cssA([255, 255, 255], 0.7 * (1 - p))); } }
      // everybody, back to front
      const poses = [];
      crew.forEach((a) => { if (present(a)) poses.push(poseOf(a, t)); });
      const order = poses.slice().sort((p, q2) => (p.a.y - q2.a.y) || (p.a.desk - q2.a.desk));
      let youDone = false;
      const you = () => { if (!youDone) { youDone = true; drawYou(t); } };
      order.forEach((v) => {
        const a = v.a;
        if (a.y > L.wd.by) you();
        const hot = a.id === focusId || a.id === hoverId;
        { let x0 = -11, x1 = 12, y0 = -24, y1 = 4;                        // what this one can cover in this frame, to put back in the next
          if (a.look === 'antenna' || a.look === 'bulb') y0 = -29; else if (a.look === 'gavel') { x1 = v.bang ? 22 : 17; y0 = -23; } else if (a.look === 'clipboard') x1 = 14;
          if (v.mug) x0 = -12;
          if (v.hands) { x0 = -12; x1 = Math.max(x1, 12); }
          if (v.deskY !== null) y1 = 12;
          if (hot) { x0 = Math.min(x0, -13); x1 = Math.max(x1, 13); y0 = Math.min(y0, -27); y1 = Math.max(y1, 6); }
          if (v.fx === 'zzz') { x1 = Math.max(x1, 21); y0 = -38; } else if (v.fx === 'err') { x0 = -15; x1 = Math.max(x1, 16); y0 = -38; }
          mark(v.x + x0, v.y + y0, x1 - x0, y1 - y0); }
        if (a.alpha < 1) g.globalAlpha = clamp(a.alpha, 0, 1);
        if (!(a.sitKind === 'desk' && a.sit > 0)) { R(v.x - 5, v.y - 1, 10, 2, SHADOW); R(v.x - 4, v.y + 1, 8, 1, SHADOW); }
        if (hot) { const pz = reduced ? 0 : (Math.floor(t / 320) & 1), c2 = '#ffe27a', yb = a.sitKind === 'desk' && a.sit > 0 ? L.desks[a.desk].dy - 3 : v.y, top = v.y - 24 - pz, l = v.x - 10 - pz, r = v.x + 9 + pz;
          R(l, top, 4, 1, c2); R(l, top, 1, 4, c2); R(r - 3, top, 4, 1, c2); R(r, top, 1, 4, c2); R(l, yb + pz, 4, 1, c2); R(l, yb - 3 + pz, 1, 4, c2); R(r - 3, yb + pz, 4, 1, c2); R(r, yb - 3 + pz, 1, 4, c2); }
        if ((a.look === 'bulb' && v.lit) && !reduced) glow(Math.round(v.x + v.hx), Math.round(v.y - 17 + v.hy - v.bob), 9, [255, 236, 130], lt.day < 0.5 ? 0.16 : 0.09);
        drawBot(v);
        if (v.hands) drawHands(v, L.desks[a.desk], v.hands, t);
        if (!reduced) {
          if (v.fx === 'zzz') zees(v.x, v.y + v.hy, t, a.seed);
          if (v.fx === 'err') { sparks(v.x, v.y, t, a.seed); }
          if (v.mug && !v.sip) steam(v.x - 7, v.y - 9, t, a.seed);
        } else if (v.fx === 'zzz') zees(v.x, v.y + v.hy, 700, 1);
        if (v.fx === 'err') alarm(v.x, v.y, t);
        g.globalAlpha = 1;
      });
      you();
      drawWords(poses, t);
      // a new result: a sheet flies from the agent's desk to your tray, over everything
      flights.forEach((fl) => {
        const p = (simT - fl.t0) / fl.dur; if (p < 0 || p > 1) return;
        const tx = L.wd.tray.x + 7, ty = L.wd.tray.y - 4;
        const at = (q2) => { const e = smooth(q2); return [lerp(fl.x0, tx, e), lerp(fl.y0, ty, e) - Math.sin(q2 * Math.PI) * (26 + Math.abs(tx - fl.x0) * 0.14)]; };
        for (let i = 3; i >= 1; i--) { const q2 = p - i * 0.05; if (q2 <= 0) continue; const pt = at(q2); mark(pt[0] - 2, pt[1] - 2, 5, 5); R(Math.round(pt[0]) - 1, Math.round(pt[1]) - 1, 2, 2, cssA([255, 253, 242], 0.7 - i * 0.17)); }
        const pt = at(p), X = Math.round(pt[0] * k) / k, Y = Math.round(pt[1] * k) / k;
        mark(X - 6, Y - 6, 13, 13);
        if (Math.floor(simT / 130) & 1) { R(X - 4, Y - 3, 9, 7, INK); R(X - 3, Y - 2, 7, 5, PAPER); R(X - 2, Y - 1, 4, 1, '#9aa0b0'); R(X - 2, Y + 1, 5, 1, '#9aa0b0'); }
        else { R(X - 3, Y - 4, 7, 9, INK); R(X - 2, Y - 3, 5, 7, PAPER); R(X - 1, Y - 2, 3, 1, '#9aa0b0'); R(X - 1, Y, 3, 1, '#9aa0b0'); R(X - 1, Y + 2, 2, 1, '#9aa0b0'); }
      });
      dirtyPrev = dirty; drew = true;
    }

    function frame(tMs) {
      if (destroyed) return;
      tMs = num(tMs, lastT == null ? 0 : lastT);
      let dt = lastT == null ? 0 : tMs - lastT; if (!(dt > 0)) dt = 0; if (dt > 250) dt = 250;
      lastT = tMs;
      if (!sized) return;                                                // no size yet: the first real frame starts the walk from the desks
      if (clamp(num(root.devicePixelRatio, 1), 0.5, 4) !== dpr) resize(cssW);   // the window moved to another screen, or the page was zoomed
      if (cw < 2 || ch < 2) return;
      if (!reduced) { simT += dt; step(dt); }
      framed = true; needsDraw = false;
      draw();
    }

    // ───────── the loop ─────────
    const visible = () => !(typeof document !== 'undefined' && document.hidden) && canvas.offsetParent !== null && onscreen;
    function tick(ts) {
      raf = 0; if (!running || destroyed) return;
      if (typeof document !== 'undefined' && document.hidden) return;        // the visibilitychange listener starts it again
      if (reduced) { if (needsDraw) { if (visible()) frame(num(ts, 0)); else raf = requestAnimationFrame(tick); } return; }
      raf = requestAnimationFrame(tick);
      if (ts - lastDraw >= 62 && visible()) { lastDraw = ts; frame(ts); }
    }
    function wake() { if (reduced) { needsDraw = true; if (running && !raf && !destroyed) raf = requestAnimationFrame(tick); } }
    function start() { if (destroyed) return; running = true; needsDraw = true; if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    const onVis = () => { if (running && !destroyed && !(typeof document !== 'undefined' && document.hidden) && !raf) { needsDraw = true; raf = requestAnimationFrame(tick); } };

    // ───────── pointing ─────────
    function boxOf(a) {
      const f = feet(a), half = Math.max(14, 8 * s), d = L.desks[a.desk];
      if (a.sitKind === 'desk' && a.sit > 0.5 && d) return { x0: Math.min(f.x * s - half, d.x0 * s), x1: Math.max(f.x * s + half, (d.x0 + d.w) * s), y0: (f.y - 26) * s, y1: (d.dy + 17) * s };
      return { x0: f.x * s - half, x1: f.x * s + half, y0: (f.y - 27) * s, y1: (Math.max(f.y, a.y) + 10) * s };
    }
    function anchor(id) {
      const a = byId.get(id); if (!a || !present(a) || !sized) return null;
      const f = feet(a);   // a thousandth of a pixel apart per agent, so two that cross on the same spot still have their own point
      return { x: clamp(f.x * s + a.desk * 0.001, 1, Math.max(1, cssW - 1)), y: clamp((f.y - (a.look === 'bulb' ? 16 : 15)) * s, 1, Math.max(1, cssH - 1)) };
    }
    function hit(x, y) {
      x = num(x, -1e6); y = num(y, -1e6); let best = null, bd = 1e12;
      crew.forEach((a) => {
        if (!present(a)) return; const b = boxOf(a);
        if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return;
        const p = anchor(a.id); if (!p) return; const dd = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (dd < bd) { bd = dd; best = a.id; }
      });
      return best;
    }
    const where = (e) => { const r = canvas.getBoundingClientRect(), fx = r && r.width ? cssW / r.width : 1, fy = r && r.height ? cssH / r.height : 1; return hit((num(e.clientX, 0) - (r ? r.left : 0)) * fx, (num(e.clientY, 0) - (r ? r.top : 0)) * fy); };
    const setHover = (id) => { if (id === hoverId) return; hoverId = id; canvas.style.cursor = id ? 'pointer' : ''; wake(); onHover(id); };
    const onMove = (e) => setHover(where(e));
    const onLeave = () => setHover(null);
    const onClick = (e) => { const id = where(e); if (id) onPick(id); };
    canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onMove);
    canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('pointercancel', onLeave);
    canvas.addEventListener('click', onClick);
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', onVis);
    if (typeof IntersectionObserver !== 'undefined') { try { io = new IntersectionObserver((en) => { const was = onscreen; onscreen = en.length ? en[en.length - 1].isIntersecting : true; if (onscreen && !was) wake(); }); io.observe(canvas); } catch (e) { io = null; } }

    function destroy() {
      if (destroyed) return; stop(); destroyed = true;
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onMove);
      canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('click', onClick);
      if (typeof document !== 'undefined' && document.removeEventListener) document.removeEventListener('visibilitychange', onVis);
      if (io) { try { io.disconnect(); } catch (e) { /* gone already */ } io = null; }
      bg = null; bgx = null; lc = null; lcx = null;
    }

    return {
      setCrew: (c) => { if (!destroyed) setCrew(c); },
      resize: (w) => (destroyed ? cssH : resize(w)),
      frame, start, stop, destroy, hit, anchor,
      setFocus: (id) => { const v = id == null ? null : String(id); if (v !== focusId) { focusId = v; wake(); } },
    };
  }

  root.OSCockpit = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.OSCockpit;
})(typeof window !== 'undefined' ? window : globalThis);
