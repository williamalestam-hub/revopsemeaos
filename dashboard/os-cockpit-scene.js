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
    const Lw = wide ? clamp(Math.round(W * 0.3), 128, 250) : 0, lx0 = W - Lw;
    const wd = { x: wide ? 14 : 8, w: wide ? 54 : 50, by: wallH + (wide ? 18 : 15) };
    wd.seat = wd.x + 30; wd.base = wd.by + 21; wd.tray = { x: wd.x + wd.w - 15, y: wd.by + 5 };
    const q = { x0: wd.x + wd.w + 13, y: wd.by + 22, pitch: Math.max(wide ? clamp(Math.round(30 + (W - 480) / 40), 30, 38) : 26, Math.ceil(52 / (sc || 2))), max: wide ? lx0 - 16 : W - 16 };
    // bullpen
    const roomy = W >= 200;                                            // from 400 css px a narrow room has a lane down the left side too
    const ax = wide ? 10 : roomy ? 24 : 6, aw = Math.max(40, (wide ? lx0 - 12 : W - 24) - ax);
    const maxCols = Math.max(1, Math.floor(aw / (wide ? 34 : 29.5)));   // five desks side by side in the narrowest room too (178 px)
    const rows = clamp(Math.ceil(n / maxCols), 1, 2), cols = Math.max(1, Math.ceil(n / rows));
    // The desks spread out with the room, up to a point. What a long row has left beside them is a games corner next to
    // the lounge: a table-tennis table, then two beanbags.
    const pitch = Math.min(wide ? 92 : 60, aw / cols), dw = pitch >= 33 ? 30 : clamp(Math.floor(pitch) - 2, 22, 28);
    const spare = aw - pitch * cols, isle = [];
    if (wide && rows === 1 && n) { if (spare >= 68) isle.push({ kind: 'pong', w: 56 }); if (spare >= 122) isle.push({ kind: 'bags', w: 40 }); }
    const slack = spare - isle.reduce((t, e) => t + e.w, 0), gapB = Math.min(44, slack / (isle.length + 2));
    const gx = ax + (slack - gapB * isle.length) / 2;                  // the row and its corner stand in the middle together
    const tight = !wide && rows > 1 && n < 8;
    const dy0 = q.y + (tight ? 24 : 36), rowP = tight ? 34 : 36;
    q.rug = q.y + 8;
    if (tight) q.y -= 5;                                               // the lane between the queue and the desks is one robot wide: the queue keeps to the wall side of it
    const desks = [];
    for (let i = 0; i < n; i++) {
      const r = Math.min(rows - 1, Math.floor(i / cols)), c = i - r * cols;
      const cx = Math.round(gx + pitch * (c + 0.5)), x0 = cx - Math.floor(dw / 2), dy = dy0 + r * rowP;
      desks.push({ i, cx, x0, w: dw, dy, sx: x0 + dw - 10, sy: dy - 2, base: dy + 16, scr: { x: x0 + 2, y: dy - 10 }, lx: x0 + dw - 5 });
    }
    const lastDy = dy0 + (rows - 1) * rowP;
    const L = { W, wide, tight, wallH, n, wd, q, desks, lx0, Lw, dy0, lastDy, plants: [], rugs: [], obst: [], extras: [], sides: [] };
    { let ex = gx + pitch * cols + gapB; isle.forEach((e) => { L.extras.push({ kind: e.kind, x: Math.round(ex), y: e.kind === 'pong' ? dy0 - 13 : dy0 + 2 }); ex += e.w + gapB; }); }
    // with room between the desks, each has a low cabinet beside it
    if (wide && pitch - dw >= 34) desks.forEach((d) => L.sides.push({ x: d.x0 + d.w + 5, dy: d.dy, v: d.i % 3 }));
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
      table = { x: sofa.x + 17, y: sofa.y + 41 };                      // far enough from the sofa to walk past whoever sits on it
      L.lamp = { x: sofa.x + 61, y: wallH - 19 };
      if (Lw >= 150) L.plants.push({ x: lx0 + 6, y: wallH - 15 });
      L.plants.push({ x: W - 20, y: H - 29 });
      const gi = Math.floor((lx0 - 18 - xs) / slot);
      if (gi >= 3) L.cooler = { x: Math.round(xs + slot * gi) - 5, y: wallH - 20 };
      if (gi >= 4) L.cabinet = { x: Math.round(xs + slot * 3) - 11, y: wallH - 17 };          // a long wall gets a printer on a cabinet
      if (gi >= 6) L.plants.push({ x: Math.round(xs + slot * 5) - 7, y: wallH - 15 });
      if (gx - ax >= 26) L.plants.push({ x: ax + 2, y: H - 29 });
      // where the idle stand: every place can be reached and left while all the others are taken
      spots = [
        { x: cart.x - 9, y: cart.y + 19, coffee: true }, { x: sofa.x + 16, y: sofa.y + 27, sofa: true }, { x: sofa.x + 43, y: sofa.y + 27, sofa: true },
        { x: table.x - 4, y: table.y + 20 }, { x: table.x + 28, y: table.y + 20 }, { x: cart.x + 16, y: cart.y + 22 },
        { x: table.x - 20, y: table.y + 34 }, { x: table.x + 44, y: table.y + 34 },
      ];
      L.rugs.push({ kind: 'you', x: 8, y: wd.by - 13, w: Math.min(lx0 - 8, q.x0 + 4 * q.pitch + 14) - 8, h: q.rug - (wd.by - 13) });
      // Between your corner and the lounge, as far as there is room: a meeting table, a planning board, a foosball table
      // (which stands in the lounge itself once that is big enough), a plant at each end of a long stretch.
      { const t0 = Math.min(lx0 - 8, q.x0 + 4 * q.pitch + 14) + 10, t1 = lx0 - 10, span = t1 - t0, top = [];
        if (span >= 100) top.push({ kind: 'meet', w: 80, y: wallH + 10 });
        if (span >= 172 && Lw < 220) top.push({ kind: 'foos', w: 44, y: wallH + 20 });
        if (span >= (Lw < 220 ? 232 : 160)) top.unshift({ kind: 'board', w: 30, y: wallH + 12 });
        const free = span - top.reduce((t, e) => t + e.w, 0), gapT = Math.min(52, free / (top.length + 1)), edge = (free - gapT * (top.length - 1)) / 2;
        let ex = t0 + edge;
        top.forEach((e) => { const x = Math.round(ex); L.extras.push({ kind: e.kind, x, y: e.y }); if (e.kind === 'meet') L.rugs.push({ kind: 'meet', x, y: e.y, w: 80, h: 40 }); ex += e.w + gapT; });
        if (top.length) q.max = Math.min(q.max, Math.round(t0 + edge) - 16);
        if (top.length && edge >= 64) {
          const px = Math.round(t0 + edge / 2) - 7;                        // (not where a long queue reaches: its places are up to 40 apart)
          if (px - 9 >= Math.min(q.max, q.x0 + (Math.max(n, 1) - 1) * 40)) L.plants.push({ x: px, y: wallH + 26 });
          L.plants.push({ x: Math.round(t1 - edge / 2) - 7, y: wallH + 26 });
        }
        if (Lw >= 220) L.extras.push({ kind: 'foos', x: sofa.x + 84, y: sofa.y + 46 }); }
      L.rugs.push({ kind: 'lounge', x: sofa.x - 2, y: sofa.y + 21, w: Math.min(W - 8 - (sofa.x - 2), 62 + Math.max(0, Lw - 128)), h: Math.min(56, H - 8 - (sofa.y + 21)) });
      L.lights = [[L.lamp.x + 4, L.lamp.y + 24, 56, 34, 0.95], [cart.x + 12, cart.y + 4, 30, 22, 0.6]];
    } else {
      const y0 = lastDy + 21;
      H = y0 + (tight ? 42 : 48);
      sofa = { x: roomy ? 24 : 8, y: y0 + 3 };
      table = { x: sofa.x + 64, y: y0 + 13 };
      cart = { x: W - 56, y: y0 + 10 };
      L.plants.push({ x: W - 19, y: wallH - 13 });
      // where the idle stand: on the sofa, in the gap by the coffee machine, or close up against the furniture, so that
      // the strip along the bottom wall stays free for whoever walks past (the lanes come down at both ends of it)
      const yt = y0 + 28, gap = cart.x - (table.x + 24);
      const foos = gap >= 104 ? Math.round(table.x + 24 + (gap - 44) / 2) : 0;     // a long band has a foosball table between the sofa and the coffee
      if (foos) L.extras.push({ kind: 'foos', x: foos, y: y0 + 2 });
      spots = [
        { x: gap >= 60 ? cart.x - 13 : Math.round(table.x + 24 + gap / 2), y: gap >= 28 ? y0 + 24 : yt, coffee: true },
        { x: sofa.x + 16, y: sofa.y + 27, sofa: true }, { x: sofa.x + 43, y: sofa.y + 27, sofa: true },
        { x: table.x + 12, y: yt }, { x: cart.x + 15, y: yt }, { x: sofa.x + 58, y: yt }, { x: sofa.x + 30, y: yt }, { x: sofa.x + 2, y: yt },
      ];
      L.rugs.push({ kind: 'you', x: 4, y: wd.by - 12, w: W - 9, h: q.rug - (wd.by - 12) });
      L.rugs.push({ kind: 'lounge', x: sofa.x - 3, y: y0 + 17, w: (foos ? foos + 50 : table.x + 30) - (sofa.x - 3), h: 22 });
      L.lights = [[table.x - 10, y0 + 20, 66, 27, 0.8], [cart.x + 12, cart.y + 8, 34, 24, 0.7]];
    }
    if (desks.length) {
      const a = desks[0], b = desks[Math.min(cols, n) - 1];
      L.rugs.push({ kind: 'pen', x: a.x0 - 6, y: dy0 - 13, w: b.x0 + b.w + 6 - (a.x0 - 6) + (L.sides.length ? 14 : 0), h: lastDy + 19 - (dy0 - 13) });
    }
    spots.forEach((p) => { p.x = clamp(p.x, 11, W - 12); p.y = clamp(p.y, wallH + 8, H - 6); });
    Object.assign(L, { H, sofa, table, cart, spots });
    // What a robot has to walk around. A robot is painted over the room, so it must not stand behind anything that is
    // taller than its feet are high: each piece is walked around as a whole, with room above it for the name at a
    // walker's feet (tall(): from that far above its top; from the wall where less than a walkway would be left behind
    // it). The floor right in front of your desk is kept clear as well, so nobody walks across the plate with your name.
    const tall = (x, top, w, base) => { const y = top - 7 - 2 - (wallH + 4) < 6 ? wallH : top - 7; return { x, y, w, h: base - y }; };
    L.obst.push({ x: wd.x, y: wd.by - 15, w: wd.w, h: 36 + clamp(dy0 - 21 - (wd.by + 21), 0, 16) });
    desks.forEach((d) => L.obst.push({ x: d.x0, y: d.dy - 11, w: d.w, h: 27 }));
    L.obst.push({ x: sofa.x, y: sofa.y, w: 58, h: 24 }, { x: table.x, y: table.y, w: 24, h: 12 }, { x: cart.x, y: cart.y - 14, w: 28, h: 32 });
    L.obst.push({ x: shelf.x, y: wallH, w: shelf.w, h: shelf.bottom - wallH });
    L.plants.forEach((p) => L.obst.push(tall(p.x + 2, p.y, 10, p.y + 22)));
    L.sides.forEach((u) => L.obst.push({ x: u.x, y: u.dy + 3, w: 12, h: 13 }));
    L.extras.forEach((e) => L.obst.push(e.kind === 'meet' ? tall(e.x + 14, e.y + 5, 52, e.y + 36) : e.kind === 'board' ? tall(e.x, e.y, 30, e.y + 33) : e.kind === 'foos' ? tall(e.x, e.y, 44, e.y + 27) : e.kind === 'pong' ? tall(e.x, e.y + 1, 56, e.y + 30) : { x: e.x, y: e.y + 2, w: 40, h: 12 }));
    if (L.lamp) L.obst.push({ x: L.lamp.x, y: L.lamp.y + 27, w: 8, h: 4 });
    if (L.cooler) L.obst.push({ x: L.cooler.x, y: wallH, w: 10, h: 8 });
    if (L.cabinet) L.obst.push({ x: L.cabinet.x, y: wallH, w: 22, h: 9 });
    // things that stand in front of a window: the sky is painted last and has to go around them
    const inFront = [{ x: cart.x + 2, y: cart.y - 15, w: 25, h: 16 }];
    L.plants.forEach((p) => inFront.push({ x: p.x, y: p.y, w: 14, h: 14 }));
    if (L.lamp) inFront.push({ x: L.lamp.x - 1, y: L.lamp.y, w: 10, h: 10 });
    if (L.cooler) inFront.push({ x: L.cooler.x, y: L.cooler.y, w: 10, h: 27 });
    if (L.cabinet) inFront.push({ x: L.cabinet.x, y: L.cabinet.y - 3, w: 22, h: 12 });
    L.windows.forEach((w) => { w.holes = inFront.filter((t) => t.x < w.x + w.w - 2 && t.x + t.w > w.x + 2 && t.y < w.y + w.h - 2 && t.y + t.h > w.y + 2); });
    return L;
  }

  // ───────── the scene ─────────
  function create(canvas, opts) {
    opts = opts || {};
    const nowFn = typeof opts.now === 'function' ? opts.now : () => Date.now();
    const reduced = !!opts.reducedMotion;
    const seed = num(opts.seed, 1) | 0;
    const onHover = typeof opts.onHover === 'function' ? opts.onHover : () => {};
    const onError = typeof opts.onError === 'function' ? opts.onError : null;
    const onPick = typeof opts.onPick === 'function' ? opts.onPick : () => {};
    const g = canvas.getContext('2d');

    let dpr = 1, k = 2, s = 2, cssW = 0, cssH = 0, cw = 0, ch = 0, sized = false;
    let L = makeLayout(240, 0, 2), nav = null;
    let bg = null, bgx = null, lc = null, lcx = null, bgKey = '', full = true;
    let crew = [], byId = new Map(), queue = [], spotOf = new Map(), hadCrew = false;
    let simT = 0, lastT = null, framed = false, drew = false, goSeq = 0, catchUp = -1e9;
    let lt = lightAt(num(nowFn(), 0)), tints = new Map(), tintKey = '';
    let flights = [], trayPop = -1e9, trayShown = 0, focusId = null, hoverId = null;
    let running = false, raf = 0, lastDraw = -1e9, needsDraw = true, destroyed = false, onscreen = true, io = null;
    let fontTag = '', fontNum = '', tw = new Map();
    const ratio = () => clamp(num(root.devicePixelRatio, 1), 0.5, 4);

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
        const c = r.kind === 'you' ? ['#2f6b5a', '#3c8069', '#e3bb62', '#245243'] : r.kind === 'pen' ? ['#3b5080', '#4a639b', '#d9cba6', '#2f4069'] : r.kind === 'meet' ? ['#a8742c', '#c08d42', '#f1dfa8', '#845a1e'] : ['#8c3f55', '#a5536d', '#e8cc92', '#6f3044'];
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
      if (L.cabinet) items.push({ y: L.cabinet.y + 26, f: () => paintCabinet(L.cabinet) });
      L.sides.forEach((u) => items.push({ y: u.dy + 16, f: () => paintSide(u) }));
      L.extras.forEach((e) => items.push({ y: e.y + (e.kind === 'meet' ? 36 : e.kind === 'board' ? 33 : e.kind === 'pong' ? 31 : e.kind === 'bags' ? 14 : 27), f: () => paintExtra(e) }));
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
      // the plate with your name is part of the desk: whoever walks in front of it covers it, as it covers the desk
      { const u = dpr, w = Math.round(textW('You', false) + 10 * u), h = Math.round(14 * u), cut = Math.max(1, Math.round(k)), X = Math.round((wd.x + wd.w / 2) * k - w / 2), Y = Math.round((wd.by + 13) * k);
        plate(G, X, Y, w, h, cut, '#f3c552');
        G.font = fontTag; G.textAlign = 'left'; G.textBaseline = 'alphabetic'; G.fillStyle = INK; G.fillText('You', X + Math.round(5 * u), Y + Math.round(10.5 * u)); inkOf = null; }
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

    function paintCabinet(c) {
      const x = c.x, y = c.y;
      R(x + 1, y + 25, 22, 2, SHADOW);
      R(x + 6, y - 3, 10, 4, INK); R(x + 7, y - 2, 8, 3, PAPER); R(x + 8, y - 1, 5, 1, '#b7b0a0');
      box(x + 3, y, 16, 9, '#e9edf3'); R(x + 4, y + 1, 14, 1, '#ffffff'); R(x + 5, y + 4, 12, 2, '#2a2238'); R(x + 6, y + 5, 10, 1, PAPER); R(x + 16, y + 2, 1, 1, '#63e56f'); R(x + 4, y + 7, 14, 1, '#c3cad8');
      R(x, y + 8, 22, 18, INK); R(x + 1, y + 9, 20, 16, '#b9a27d'); R(x + 1, y + 9, 20, 1, '#d6c19c');
      R(x + 2, y + 11, 18, 6, '#a58e6a'); R(x + 2, y + 18, 18, 6, '#a58e6a'); R(x + 9, y + 13, 4, 1, INK); R(x + 9, y + 20, 4, 1, INK);
    }
    // a low cabinet beside a desk, with a plant, a few books or a box on it
    function paintSide(u) {
      const x = u.x, y = u.dy;
      R(x + 1, y + 16, 12, 2, SHADOW);
      R(x, y + 3, 12, 13, INK); R(x + 1, y + 4, 10, 11, '#c9bda8'); R(x + 1, y + 4, 10, 1, '#e3d8c4'); R(x + 1, y + 9, 10, 1, '#978b78'); R(x + 1, y + 14, 10, 1, '#b0a48e'); R(x + 5, y + 6, 2, 1, INK); R(x + 5, y + 11, 2, 1, INK);
      if (u.v === 0) { R(x + 3, y, 6, 4, INK); R(x + 4, y + 1, 4, 2, '#c96a45'); box(x + 1, y - 5, 6, 6, '#3f9a5a'); box(x + 5, y - 7, 6, 7, '#58b56a'); R(x + 6, y - 6, 2, 1, '#8ad894'); R(x + 2, y - 4, 2, 1, '#6fc47d'); }
      else if (u.v === 1) { R(x + 2, y + 1, 9, 3, INK); R(x + 3, y + 2, 7, 1, '#d9534f'); R(x + 1, y - 2, 8, 3, INK); R(x + 2, y - 1, 6, 1, '#5bc0de'); R(x + 3, y - 4, 7, 2, INK); R(x + 4, y - 4, 5, 1, '#f0ad4e'); }
      else { R(x + 2, y - 3, 9, 7, INK); R(x + 3, y - 2, 7, 5, '#c9a26a'); R(x + 3, y - 2, 7, 1, '#e0bd86'); R(x + 6, y - 2, 1, 5, '#a8824e'); }
    }
    // what a wide room has room for: a meeting table, a planning board, a foosball table, a table-tennis table, beanbags
    function paintExtra(e) {
      const x = e.x, y = e.y;
      if (e.kind === 'meet') {                                           // on its own rug, which is painted with the rugs
        const tx = x + 18, ty = y + 14;
        const seat = (cx, top, front) => { R(cx - 4, top, 8, 10, INK); R(cx - 5, top + 1, 10, 9, INK); R(cx - 4, top + 1, 8, 9, '#5f6f86'); R(cx - 3, top + 2, 6, 7, '#8fa0b8'); R(cx - 3, top + 2, 6, 1, '#b5c3d6'); if (front) { R(cx - 4, top + 10, 2, 2, INK); R(cx + 2, top + 10, 2, 2, INK); } };
        seat(tx + 11, ty - 9, false); seat(tx + 33, ty - 9, false);
        R(tx + 1, ty + 18, 44, 2, SHADOW);
        R(tx + 2, ty + 14, 3, 4, INK); R(tx + 39, ty + 14, 3, 4, INK);
        R(tx, ty, 44, 15, INK); R(tx + 1, ty + 1, 42, 10, '#d9b27c'); R(tx + 1, ty + 1, 42, 1, '#ecc995'); R(tx + 1, ty + 11, 42, 3, '#9a6d3c'); R(tx + 1, ty + 11, 42, 1, '#b5864e');
        R(tx + 17, ty + 2, 9, 6, INK); R(tx + 18, ty + 3, 7, 4, '#4f6f8a'); R(tx + 18, ty + 3, 7, 1, '#6c8fad'); R(tx + 16, ty + 8, 11, 2, '#c9ccd9');
        R(tx + 4, ty + 3, 7, 6, PAPER_D); R(tx + 4, ty + 3, 6, 5, PAPER); R(tx + 5, ty + 4, 4, 1, '#b7b0a0'); R(tx + 5, ty + 6, 3, 1, '#b7b0a0');
        R(tx + 32, ty + 4, 6, 5, PAPER); R(tx + 33, ty + 5, 4, 1, '#b7b0a0'); R(tx + 33, ty + 7, 3, 1, '#b7b0a0');
        R(tx + 12, ty + 3, 4, 4, INK); R(tx + 13, ty + 4, 2, 2, '#f4efe2'); R(tx + 28, ty + 6, 4, 4, INK); R(tx + 29, ty + 7, 2, 2, '#f0608f');
        seat(tx + 11, ty + 9, true); seat(tx + 33, ty + 9, true);
      } else if (e.kind === 'board') {                                   // columns of coloured notes: who does what, in no words
        R(x + 2, y + 32, 28, 2, SHADOW);
        R(x + 3, y + 18, 2, 14, INK); R(x + 25, y + 18, 2, 14, INK); R(x + 1, y + 31, 6, 2, INK); R(x + 23, y + 31, 6, 2, INK);
        R(x, y, 30, 20, INK); R(x + 1, y + 1, 28, 18, '#f7f4ea'); R(x + 1, y + 1, 28, 1, '#ffffff'); R(x + 1, y + 18, 28, 1, '#d9d3c2');
        R(x + 10, y + 2, 1, 16, '#d9d3c2'); R(x + 19, y + 2, 1, 16, '#d9d3c2'); R(x + 2, y + 5, 26, 1, '#d9d3c2');
        R(x + 3, y + 3, 5, 1, '#8d90a6'); R(x + 12, y + 3, 5, 1, '#8d90a6'); R(x + 21, y + 3, 5, 1, '#8d90a6');
        [[3, 7, '#f7ae2e'], [6, 11, '#f0608f'], [3, 14, '#2ec4b6'], [12, 7, '#9273f2'], [15, 11, '#63c655'], [12, 14, '#f7ae2e'], [21, 7, '#f0608f'], [24, 12, '#3f8ff5']].forEach((p) => R(x + p[0], y + p[1], 3, 3, p[2]));
        R(x + 4, y + 20, 22, 2, INK); R(x + 5, y + 20, 20, 1, '#8d90a6'); R(x + 8, y + 19, 4, 1, '#e2504a'); R(x + 14, y + 19, 4, 1, '#3f8ff5');
      } else if (e.kind === 'foos') {
        R(x + 2, y + 27, 42, 2, SHADOW);
        R(x + 3, y + 22, 3, 6, INK); R(x + 38, y + 22, 3, 6, INK);
        R(x, y + 5, 44, 13, INK); R(x + 1, y + 6, 42, 11, '#8a5636'); R(x + 1, y + 6, 42, 1, '#a66c45'); R(x + 3, y + 8, 38, 8, '#2f8a50'); R(x + 3, y + 8, 38, 1, '#3fae62'); R(x + 21, y + 8, 2, 8, '#bfe6c8');
        R(x, y + 17, 44, 6, INK); R(x + 1, y + 18, 42, 4, '#a66c45'); R(x + 1, y + 18, 42, 1, '#c98a5c'); R(x + 20, y + 19, 4, 2, INK);
        for (let i = 0; i < 4; i++) { const rx = x + 7 + i * 10, col = i % 2 ? '#3f8ff5' : '#e2504a'; R(rx, y + 3, 1, 15, '#c9ccd9'); R(rx - 1, y, 3, 4, INK); R(rx, y + 1, 1, 2, col); R(rx - 1, y + 9 + (i % 2) * 3, 3, 3, INK); R(rx - 1, y + 9 + (i % 2) * 3, 3, 2, col); }
        R(x + 25, y + 12, 1, 1, '#ffffff');
      } else if (e.kind === 'pong') {
        R(x + 2, y + 30, 54, 2, SHADOW);
        R(x + 4, y + 24, 3, 7, INK); R(x + 49, y + 24, 3, 7, INK); R(x + 26, y + 24, 3, 6, INK);
        R(x, y + 4, 56, 18, INK); R(x + 1, y + 5, 54, 16, '#2f6fb5'); R(x + 1, y + 5, 54, 1, '#4d8fd6');
        R(x + 2, y + 6, 52, 1, '#e8f1fb'); R(x + 2, y + 19, 52, 1, '#e8f1fb'); R(x + 2, y + 6, 1, 14, '#e8f1fb'); R(x + 53, y + 6, 1, 14, '#e8f1fb'); R(x + 3, y + 12, 50, 1, '#7fb0e6');
        R(x, y + 21, 56, 4, INK); R(x + 1, y + 22, 54, 2, '#1f4f86');
        R(x + 26, y + 1, 4, 2, INK); R(x + 27, y + 2, 2, 20, INK); R(x + 27, y + 3, 2, 18, '#f4efe2'); R(x + 26, y + 21, 4, 2, INK);
        disc(x + 13, y + 11, 3, INK); disc(x + 13, y + 11, 2, '#e2504a'); R(x + 16, y + 12, 4, 2, INK); R(x + 16, y + 12, 3, 1, '#c98a5c');
        R(x + 40, y + 9, 2, 2, '#ffffff'); R(x + 40, y + 11, 2, 1, 'rgba(38,24,44,0.3)');
      } else {                                                           // two beanbags and a little table between them
        const bag = (bx, by, c0, c1, c2) => {
          R(bx + 1, by + 11, 13, 2, SHADOW);
          R(bx + 3, by, 8, 1, INK); R(bx + 1, by + 1, 12, 2, INK); R(bx, by + 3, 14, 7, INK); R(bx + 1, by + 10, 12, 2, INK);
          R(bx + 3, by + 1, 8, 2, c1); R(bx + 1, by + 3, 12, 7, c0); R(bx + 2, by + 2, 10, 1, c1); R(bx + 1, by + 8, 12, 2, c2); R(bx + 2, by + 10, 10, 1, c2); R(bx + 4, by + 5, 6, 1, c2); R(bx + 5, by + 4, 4, 1, c1);
        };
        bag(x, y + 1, '#3a9a92', '#6cc7be', '#27706a'); bag(x + 26, y + 1, '#e08a3c', '#f5b56e', '#b0621f');
        R(x + 17, y + 12, 7, 2, SHADOW); R(x + 19, y + 7, 2, 6, INK); R(x + 17, y + 12, 6, 1, INK);
        R(x + 15, y + 4, 10, 4, INK); R(x + 16, y + 5, 8, 2, '#d5a06a'); R(x + 16, y + 5, 8, 1, '#ecc995');
        R(x + 18, y + 1, 4, 4, INK); R(x + 19, y + 2, 2, 2, '#f4efe2');
      }
    }

    function rebuildRoom() {
      if (!bg) { bg = document.createElement('canvas'); bgx = bg.getContext('2d'); }
      if (bg.width !== cw || bg.height !== ch) { bg.width = cw; bg.height = ch; }
      if (bgx) bgx.imageSmoothingEnabled = false;
      inkOf = null; G = bgx || g; paintRoom(); G = g; inkOf = null; full = true;
    }

    // ───────── ways around the furniture, and around each other ─────────
    function buildNav() {
      const cs = 2, nc = Math.ceil(L.W / cs) + 1, nr = Math.ceil(L.H / cs) + 1, blk = new Uint8Array(nc * nr);
      const x0 = 9, x1 = L.W - 9, y0 = L.wallH + 4, y1 = L.H - (L.tight ? 1 : 5);   // (the tight room has no height to spare: past those who stand in its lounge the way is along the very edge)
      const fill = (x, y, w, h, v) => { for (let r = Math.max(0, Math.floor(y / cs)); r < nr && r * cs + 1 <= y + h; r++) for (let c = Math.max(0, Math.floor(x / cs)); c < nc && c * cs + 1 <= x + w; c++) if (c * cs + 1 >= x && r * cs + 1 >= y) blk[r * nc + c] = v; };
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) { const x = c * cs + 1, y = r * cs + 1; if (x < x0 || x > x1 || y < y0 || y > y1) blk[r * nc + c] = 1; }
      L.obst.forEach((o) => fill(o.x - 6, o.y - 2, o.w + 12, o.h + 4, 1));
      L.desks.forEach((d) => fill(d.sx - 3, d.dy - 15, 6, 14, 0));          // the way into the chair
      nav = { cs, nc, nr, blk, prev: new Int32Array(nc * nr), qu: new Int32Array(nc * nr) };
    }
    // What a robot that stands still covers, for the others to walk around: its whole figure, not just its feet. In a
    // narrow room the idle stand close up against the furniture and are passed along the bottom wall, a little nearer.
    const reach = (f) => (!L.wide && f.y >= L.lastDy + 40 ? (L.tight ? 12 : 13) : L.tight && f.y <= L.q.y + 2 ? 14.5 : 16);   // f: where it stands (its feet)
    const inChair = (o) => o.sitKind === 'desk' && o.seated;                 // in its chair behind its own desk (until its first step): nobody walks there
    const afoot = (o) => !!o.path && o.moved && o.waitFor === null;          // really on its way: not at rest, not still on its place, not waiting for its place
    // where one who is not walking stands (its feet): one who has just reached the sofa counts as sitting on it already
    const stand = (o) => { const f = feet(o); if (o.sitKind === 'sofa' && o.seated) f.y = Math.round((o.y - 6) * k) / k; return f; };
    const wayLen = (x, y, pts) => { let d = 0; for (let i = 0; i < pts.length; i++) { d += Math.hypot(pts[i].x - x, pts[i].y - y); x = pts[i].x; y = pts[i].y; } return d; };
    // A way from a to b around the furniture and around everybody who stands in the open: { way, push }. It keeps
    // clear of the places the others are on their way to as well, where that is possible, so nobody has to turn back
    // when they get there. Where there is no way around those who stand, or only a very long one, it is the plain
    // way and the walker squeezes past (push).
    function findPath(ax, ay, bx, by, self, shun) {
      if (!nav) buildNav();
      const { cs, nc, nr, blk } = nav, held = [];
      // (the strip right in front of where the way starts and ends stays open, so it leaves and arrives from the front
      // and not sideways through whatever stands next to it)
      const front = (x, y, px, py) => Math.abs(x - px) <= 3 && y >= py - 1 && y <= py + 20;
      const keepOff = (fx, fy, rx, ry) => { for (let r = Math.max(0, Math.floor((fy - ry) / cs)); r < nr && r * cs + 1 <= fy + ry; r++) for (let c = Math.max(0, Math.floor((fx - rx) / cs)); c < nc && c * cs + 1 <= fx + rx; c++) { const i = r * nc + c, x = c * cs + 1, y = r * cs + 1; if (!blk[i] && Math.abs(x - fx) <= rx && Math.abs(y - fy) <= ry && !front(x, y, ax, ay) && !front(x, y, bx, by)) { blk[i] = 1; held.push(i); } } };
      crew.forEach((o) => {
        if (o === self || !present(o) || afoot(o) || inChair(o)) return;    // those on their way give way to each other in step()
        const f = stand(o); keepOff(f.x, f.y, 11.5, reach(f));
      });
      if (shun && shun.sweep) { keepOff(shun.x, shun.y, 13, 17); for (let j = 0; j < shun.sweep.length; j += 2) keepOff(shun.sweep[j], shun.sweep[j + 1], 13, 17); }   // and the stretch ahead of one who is coming
      const around = route(ax, ay, bx, by), n0 = held.length;
      if (!n0) return { way: around || [{ x: bx, y: by }], push: false };
      crew.forEach((o) => {                                               // where the others will stand
        if (o === self || !present(o) || !o.goal || o.goal.kind === 'desk' || !(o.pending || o.path)) return;
        const f = { x: o.goal.x, y: o.goal.sofa ? o.goal.y - 6 : o.goal.y }; keepOff(f.x, f.y, 11.5, reach(f));
      });
      const clear = held.length > n0 ? route(ax, ay, bx, by) : null;
      held.forEach((i) => { blk[i] = 0; });
      const direct = route(ax, ay, bx, by), most = direct ? wayLen(ax, ay, direct) * 2.2 + 60 : 1e9;
      if (clear && wayLen(ax, ay, clear) <= most) return { way: clear, push: false };
      if (around && wayLen(ax, ay, around) <= most) return { way: around, push: false };
      return { way: direct || [{ x: bx, y: by }], push: true };
    }
    // the open cell nearest to cell c0 (itself when it is open; -1 when there is none near)
    function freeCell(c0) {
      const { nc, nr, blk } = nav;
      if (!blk[c0]) return c0;
      const r0 = Math.floor(c0 / nc), q0 = c0 - r0 * nc; let best = -1, bd = 1e9;
      for (let rad = 1; rad < 24 && best < 0; rad++) for (let r = r0 - rad; r <= r0 + rad; r++) for (let c = q0 - rad; c <= q0 + rad; c++) { if (r < 0 || c < 0 || r >= nr || c >= nc || blk[r * nc + c]) continue; const dd = (r - r0) * (r - r0) + (c - q0) * (c - q0); if (dd < bd) { bd = dd; best = r * nc + c; } }
      return best;
    }
    // the point itself when it is on open floor, else the nearest point that is
    function openAt(x, y) {
      if (!nav) buildNav();
      const { cs, nc, nr } = nav, c0 = clamp(Math.floor(y / cs), 0, nr - 1) * nc + clamp(Math.floor(x / cs), 0, nc - 1), c = freeCell(c0);
      if (c === c0 || c < 0) return { x, y };
      const r = Math.floor(c / nc); return { x: (c - r * nc) * cs + 1, y: r * cs + 1 };
    }
    function route(ax, ay, bx, by) {
      const { cs, nc, nr, blk, prev, qu } = nav;
      const cell = (x, y) => clamp(Math.floor(y / cs), 0, nr - 1) * nc + clamp(Math.floor(x / cs), 0, nc - 1);
      const sc = freeCell(cell(ax, ay)), gc = freeCell(cell(bx, by));
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
    // the queue: evenly spaced, wide enough for the two longest names of the whole crew to stand side by side when there
    // is room for that, so that those who stand in it do not shuffle when another joins
    let qPitch = 26;
    const spaceQueue = () => {
      let w1 = 0, w2 = 0;
      crew.forEach((a) => { const w = a.name ? textW(a.name, false) : 0; if (w > w1) { w2 = w1; w1 = w; } else if (w > w2) w2 = w; });
      const need = Math.max(L.q.pitch, Math.ceil(((w1 + w2) / 2 + 14 * dpr) / k));
      qPitch = Math.max(8, Math.min(need, 40, queue.length > 1 ? (L.q.max - L.q.x0) / (queue.length - 1) : 40));
    };
    const slotX = (j) => L.q.x0 + j * qPitch;
    const goalOf = (a) => {
      if (a.state === 'needs') { const j = Math.max(0, queue.indexOf(a.id)); return { kind: 'queue', x: slotX(j), y: L.q.y }; }
      if (a.state === 'idle') { const sp = L.spots[(spotOf.get(a.id) || 0) % L.spots.length]; return { kind: 'lounge', x: sp.x, y: sp.y, sofa: !!sp.sofa, coffee: !!sp.coffee }; }
      const d = L.desks[a.desk]; return d ? { kind: 'desk', x: d.sx, y: d.sy } : { kind: 'desk', x: 20, y: L.wallH + 20 };
    };
    const seatOf = (goal) => (goal.kind === 'desk' ? 'desk' : goal.sofa ? 'sofa' : '');
    // How deep in the lounge a place lies: the way to it from the middle of the desks, around the furniture alone.
    const deepOf = (g) => {
      if (!L.deep) L.deep = new Map();
      const key = g.x + ',' + g.y; let d = L.deep.get(key);
      if (d === undefined) {
        if (!nav) buildNav();
        const xs = L.desks.map((v) => v.cx), ox = xs.length ? (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2 : L.W / 2, oy = L.dy0 - 14, w = route(ox, oy, g.x, g.y);
        d = w ? wayLen(ox, oy, w) : 0; L.deep.set(key, d);
      }
      return d;
    };
    // put down at a place, at rest
    const rest = (a, goal) => { a.goal = goal; a.x = goal.x; a.y = goal.y; a.path = null; a.pending = false; a.go = 0; a.held = 0; a.sat = 0; a.stuck = 0; a.push = false; a.barge = null; a.waitFor = null; a.waitOn = null; a.hold = null; a.sweep = null; a.sitKind = seatOf(goal); a.seated = !!a.sitKind; a.sit = a.sitKind ? 1 : 0; a.face = 0; a.dx = 0; };
    const toDesk = (a) => { const d = L.desks[a.desk]; rest(a, { kind: 'desk', x: d ? d.sx : 20, y: d ? d.sy : L.wallH + 20 }); };
    const turn = (a) => { const p = findPath(a.x, a.y, a.goal.x, a.goal.y, a); a.path = p.way; a.push = p.push; a.replan = simT; };   // a way to its goal from where it is now
    // who stands where: the queue in the order they came, a place in the lounge for each idle one
    const lineUp = () => {
      queue = queue.filter((id) => { const a = byId.get(id); return a && a.state === 'needs'; });
      crew.forEach((a) => { if (a.state === 'needs' && queue.indexOf(a.id) < 0) queue.push(a.id); });
      spaceQueue();
      Array.from(spotOf.keys()).forEach((id) => { const a = byId.get(id); if (!a || a.state !== 'idle') spotOf.delete(id); });
      crew.forEach((a) => { if (a.state === 'idle' && !spotOf.has(a.id)) { const used = new Set(spotOf.values()); let j = 0; while (used.has(j)) j++; spotOf.set(a.id, j); } });
    };

    // mode: 'first' = start at the desks and walk, 'snap' = stand in place at once, '' = walk from where they are
    function retarget(mode) {
      lineUp();
      const movers = [];
      crew.forEach((a) => {
        if (mode === 'first' || !a.placed) { toDesk(a); a.placed = true; if (mode === 'first') a.alpha = !present(a) || (framed && !reduced) ? 0 : 1; }   // into a room already on screen they fade in
        const goal = goalOf(a);
        if (reduced || mode === 'snap' || a.state === 'unknown') { rest(a, goal); return; }
        const cur = a.goal;
        if (cur && cur.kind === goal.kind && Math.abs(cur.x - goal.x) < 0.5 && Math.abs(cur.y - goal.y) < 0.5) return;   // the same place as before: nothing starts again
        a.leaves = !!cur && cur.kind === 'queue' && goal.kind !== 'queue';
        a.goal = goal;
        if (a.path) { turn(a); return; }                                  // on its way already: it turns where it is
        if (Math.abs(a.x - goal.x) < 0.5 && Math.abs(a.y - goal.y) < 0.5) { a.pending = false; a.sitKind = seatOf(goal); a.seated = !!a.sitKind; return; }   // called back before it left
        a.pending = true; a.hold = null; movers.push(a);
      });
      // they set off one after the other so nobody walks on another's heels: first those who leave the queue, then
      // the queue closes up and fills from the front, then those who go back to their desks (shortest way first),
      // then those who go to the lounge (the deepest place first)
      movers.forEach((a) => { a.far = wayLen(a.x, a.y, findPath(a.x, a.y, a.goal.x, a.goal.y, a).way); });
      const rank = (a) => (a.leaves ? -2e6 : 0) + (a.goal.kind === 'queue' ? a.goal.x - 1e6 : a.goal.kind === 'lounge' ? 5e5 - deepOf(a.goal) : a.far);
      movers.sort((a, b) => (rank(a) - rank(b)) || (a.desk - b.desk));
      movers.forEach((a, i) => { a.delay = (mode === 'first' ? 400 : 150) + i * 26000 / pace(); a.waited = 0; });
      // The lounge fills from its far end: nobody takes a place there before those who have to pass that place are past
      // it. (early() sees to it again when they set off, as some are held up on the way.)
      const due = (a) => a.delay + a.far / pace() * 1000; let last = -1e9;
      movers.filter((a) => a.goal.kind === 'lounge').sort((a, b) => (deepOf(b.goal) - deepOf(a.goal)) || (a.desk - b.desk)).forEach((a) => { if (due(a) < last + 350) a.delay += last + 350 - due(a); last = due(a); });
    }

    function setCrew(list) {
      const arr = Array.isArray(list) ? list : [], seen = new Set(), next = [], first = !hadCrew;
      const quiet = lastT != null && lastT < catchUp;                       // just back from a long while out of sight: what changed meanwhile is not played back
      for (let i = 0; i < arr.length && next.length < 8; i++) {            // eight desks at most: the rest of a longer list is not shown
        const raw = arr[i]; if (!raw || typeof raw !== 'object') continue;
        const id = String(raw.id == null ? 'agent' + i : raw.id); if (seen.has(id)) continue; seen.add(id);
        let a = byId.get(id); const isNew = !a;
        if (isNew) a = { id, x: 0, y: 0, placed: false, alpha: 0, sit: 1, sitKind: 'desk', seated: true, path: null, pending: false, delay: 0, go: 0, held: 0, sat: 0, stuck: 0, waited: 0, far: 0, hold: null, why: 0, moved: false, waitFor: null, waitOn: null, sweep: null, push: false, barge: null, replan: 0, dist: 0, face: 0, dx: 0, state: '', fresh: 0, bubbleText: '', bubbleUntil: -1, popAt: -1e9, tagAt: 0, bubAt: 0, bubWas: 0, sayText: '', spoke: 0, quiet: 0, told: 0, bubLate: 0, seed: Math.floor(hash(seed, next.length * 31 + 7) * 1e6) };
        const state = own(STATES, raw.state) ? raw.state : 'unknown', was = a.state;
        const name = String(raw.name == null ? '' : raw.name);
        a.name = name.length > 14 ? name.slice(0, 13) + '…' : name;
        a.look = own(LOOKS, raw.look) ? raw.look : 'plain';
        a.hue = own(HUES, raw.hue) ? raw.hue : 'teal';
        const waiting = Math.max(0, num(raw.waiting, 0));
        if (!isNew && !quiet && waiting !== a.waiting) a.popAt = simT;
        a.waiting = waiting;
        a.step = String(raw.step == null ? '' : raw.step).slice(0, 28);
        const bubble = String(raw.bubble == null ? '' : raw.bubble).slice(0, 32);
        const fresh = num(raw.fresh, 0);
        // a slip flies for a new result from an agent already in the room, not when its document first loads
        if (!isNew && !first && !quiet && was && was !== 'unknown' && fresh > a.fresh && !reduced) launchSlip(a, next.length);
        a.fresh = fresh;
        if (state !== was) {
          const appearing = isNew || was === 'unknown' || was === '';
          if (appearing) { a.placed = false; a.alpha = reduced || quiet ? 1 : 0; }   // the fade-in runs in step(), which reduced motion never calls
          const loud = state === 'due' || state === 'late' || state === 'error';   // on arrival only trouble speaks; later every change does
          if (bubble && !reduced && !quiet && state !== 'unknown' && (!appearing || loud)) { a.bubbleText = bubble; a.bubbleUntil = simT + 4200 + (appearing ? 600 : 0); a.bubLate = 0; } else a.bubbleUntil = -1;
        }
        a.state = state; a.desk = next.length;
        next.push(a);
      }
      const sig = (c) => c.map((a) => a.id + ':' + a.hue).join(',');
      const changedRoom = sig(next) !== sig(crew);
      crew = next; byId = new Map(next.map((a) => [a.id, a]));
      if (next.length) hadCrew = true;
      if (changedRoom) { relayout(); retarget(first || !framed ? 'first' : 'snap'); }
      else retarget(!framed ? 'first' : quiet ? 'snap' : '');
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
      canvas.style.width = cw / dpr + 'px'; canvas.style.height = cssH + 'px';   // the box is the backing store over the ratio, so one canvas pixel is one device pixel at any zoom
      g.imageSmoothingEnabled = false;
      fontTag = '600 ' + 11 * dpr + 'px ' + FONT_STACK; fontNum = '700 ' + 11 * dpr + 'px ' + FONT_STACK; tw = new Map();
      bgKey = ''; full = true; dirty = []; dirtyPrev = []; inkOf = null;
    }
    function resize(w) {
      w = clamp(num(w, 0), 0, 4096);
      const d = ratio();
      if (sized && w === cssW && d === dpr && canvas.width === cw && canvas.height === ch) { wake(); return cssH; }   // nothing changed: nobody is moved
      const L0 = L, pitch0 = qPitch, s0 = s, had = sized;
      dpr = d; cssW = w; cw = Math.round(w * dpr); sized = true;
      fit(); applySize();
      if (!had || !framed) retarget('first');
      else if (L.W !== L0.W || L.H !== L0.H || s !== s0) reflow(L0, pitch0);   // the same room in other pixels (another screen, a zoom that keeps the size of a pixel) moves nobody
      if (drew) draw();
      wake();
      return cssH;
    }
    // The room changed under them. Those at rest stand in their new places at once. One that has yet to take its first
    // step stands on the place it is about to leave, where that place is in the new room. One on its way keeps
    // walking from where the same spot of the old room now is, or from the nearest open floor when something stands
    // there now.
    function reflow(L0, pitch0) {
      // the place of the old room that a stands on, in the new room: a place in the lounge, a place in the queue
      const placeOf = (a) => {
        for (let i = 0; i < L0.spots.length; i++) { const sp = L0.spots[i]; if (Math.abs(a.x - sp.x) < 1 && Math.abs(a.y - sp.y) < 1) return L.spots[i % L.spots.length]; }
        const j = Math.round((a.x - L0.q.x0) / pitch0);
        if (j >= 0 && Math.abs(a.y - L0.q.y) < 1 && Math.abs(a.x - (L0.q.x0 + j * pitch0)) < 1) return { x: Math.min(slotX(j), Math.max(L.q.x0, L.q.max)), y: L.q.y };
        return null;
      };
      spaceQueue();
      crew.forEach((a) => {
        const goal = goalOf(a), d = L.desks[a.desk];
        if (reduced || !present(a) || (!a.path && !a.pending)) { rest(a, goal); return; }
        const at = inChair(a) || (a.path && a.moved) ? null : placeOf(a);
        if (inChair(a) && d) { a.x = d.sx; a.y = d.sy; }                   // still in its chair, about to leave
        else if (at) { a.x = at.x; a.y = at.y; }                           // still on its place (and on the sofa, if that is where it sat)
        else {
          let x = clamp(a.x * L.W / L0.W, 9, L.W - 9), y = clamp(a.y * L.H / L0.H, L.wallH + 4, L.H - 5);
          if (L.obst.some((o) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h)) { const p = openAt(x, y); x = p.x; y = p.y; }   // in a piece of furniture now: out to the nearest open floor
          a.x = x; a.y = y; if (!a.path) a.seated = false;
        }
        a.goal = goal;
        if (a.path) turn(a);
      });
    }

    // ───────── simulation ─────────
    const pace = () => 40 + clamp((L.W - 300) / 500, 0, 1) * 22;          // logical px a second; a wider room is crossed a little faster
    // Is somebody where this step would take a? 1 = another one is walking there, or is about to: wait until it has
    // gone by; 2 = one stands there: look for a way around; 3 = the one who had a's own place has not left it yet: wait
    // for that. Of two that walk into each other, or are about to, the one that set off first goes on. One that is
    // simply ahead is waited for, whoever set off first. Getting away from somebody already close is always allowed.
    function ahead(a, nx, ny) {
      const sx = nx - a.x, sy = ny - a.y;
      let res = 0;
      for (let i = 0; i < crew.length; i++) {
        const o = crew[i];
        if (o === a || !present(o) || inChair(o)) continue;
        if (o.waitFor === a.id || o.waitOn === a.id) continue;             // that one is waiting for a
        const moving = afoot(o), f = moving ? o : stand(o);
        const mine = !moving && Math.abs(a.goal.x - f.x) < 10.5 && Math.abs(a.goal.y - f.y) < reach(f) - 1;   // that one stands where a is going
        if (mine && !o.pending && !o.path) continue;                       // it lives there: a's own place is simply that close to its neighbour's
        if (!moving && !mine && a.push) continue;                          // with no way around, a squeezes past those who stand
        const bx = moving || mine ? 12 : 10.5, by = moving || mine ? 16 : reach(f) - 1;
        if (Math.abs(nx - f.x) < bx && Math.abs(ny - f.y) < by && sx * (f.x - a.x) + sy * (f.y - a.y) > 0) {   // on that one after this step, and not getting away from it
          if (mine) { a.waitFor = o.id; return 3; }
          if (!moving) { res = 2; continue; }
          const p = o.path[0], ux = p ? p.x - o.x : 0, uy = p ? p.y - o.y : 0, ul = Math.hypot(ux, uy);
          if (ul > 0.01 && ux * (a.x - o.x) + uy * (a.y - o.y) > 0) {      // that one is coming a's way
            if (Math.abs(a.x - f.x) < 7 && Math.abs(a.y - f.y) < 10) continue;   // and they are well on each other already: going on ends that soonest
            if (o.go > a.go && Math.abs(o.x + ux / ul * 2 - nx) < bx && Math.abs(o.y + uy / ul * 2 - ny) < by) continue;   // it set off later: it is the one to wait
          }
          a.waitOn = o.id; return 1;
        }
        if (moving && o.go < a.go && o.sweep && a.sweep) {                 // will they be in the same place a moment from now? the later one stops here
          const w = o.sweep, v = a.sweep; let meet = false, inWay = false;
          for (let j = 0; j < w.length && !meet; j += 2) meet = Math.abs(v[j] - w[j]) < 12 && Math.abs(v[j + 1] - w[j + 1]) < 16;
          for (let j = 0; j < w.length && !inWay; j += 2) inWay = Math.abs(a.x - w[j]) < 12 && Math.abs(a.y - w[j + 1]) < 16;   // unless here is in that one's way: then it had better move on
          if (meet && !inWay) { a.waitOn = o.id; return 1; }
        }
      }
      return res;
    }
    // Does a wait in a ring: for one who waits for one who ... waits for a? Only such a wait never ends by itself (one
    // who waits behind another who is merely held up goes on when that one does).
    const knot = (a) => { let o = byId.get(a.waitOn); for (let n = 0; o && n < 8; n++) { if (o === a) return true; if (!o.path || !(o.held > 0)) return false; o = byId.get(o.waitOn || o.waitFor); } return false; };
    // where one who is on its way will be over the next two seconds or so: eight points 10 px apart along its way
    function foresee(a) {
      a.sweep = null; if (!present(a) || !a.path) return;
      const w = a.sweep = []; let x = a.x, y = a.y, i = 0, need = 10;
      while (w.length < 16) { if (i >= a.path.length) { w.push(x, y); continue; } const p = a.path[i], d = Math.hypot(p.x - x, p.y - y); if (d < need) { need -= d; x = p.x; y = p.y; i++; } else { x += (p.x - x) / d * need; y += (p.y - y) / d * need; w.push(x, y); need = 10; } }
    }
    // the point so far along a way (its end, when the way is shorter)
    const along = (x, y, path, dist) => { for (let i = 0; i < path.length; i++) { const p = path[i], d = Math.hypot(p.x - x, p.y - y); if (d >= dist && d > 0) return [x + (p.x - x) / d * dist, y + (p.y - y) / d * dist]; dist -= d; x = p.x; y = p.y; } return [x, y]; };
    // does o wait for a, itself or through others who wait?
    const waitsOn = (o, a) => { for (let n = 0; o && n < 8; n++) { const id = o.waitOn || o.waitFor; if (id === a.id) return true; o = id ? byId.get(id) : null; } return false; };
    // on its way, or about to be and before a in turn (it has its way and has not taken its first step)
    const bound = (o, a) => !!o.path && (afoot(o) || (!o.moved && o.go > 0 && (!a.go || o.go < a.go)));
    // Would a, setting off now along its way, meet somebody coming the other way? Then: that one. (everybody walked on at the same pace)
    function meets(a) {
      const v = pace() * 0.1, on = along;
      for (let i = 0; i < crew.length; i++) {
        const o = crew[i]; if (o === a || !present(o) || !bound(o, a) || !o.path.length || (o.moved && o.held > 0)) continue;
        if (Math.abs(o.goal.x - a.x) < 12 && Math.abs(o.goal.y - a.y) < 16) continue;   // that one comes for a's place: a had better be gone
        let pa = [a.x, a.y], po = [o.x, o.y];
        for (let st = 1; st <= 60; st++) {                                 // six seconds ahead
          const na = on(a.x, a.y, a.path, v * st), no = on(o.x, o.y, o.path, v * st);
          const ax = na[0] - pa[0], ay = na[1] - pa[1], ox = no[0] - po[0], oy = no[1] - po[1];
          if (Math.abs(na[0] - no[0]) < 12 && Math.abs(na[1] - no[1]) < 16 && ax * ox + ay * oy < -0.3 * Math.hypot(ax, ay) * Math.hypot(ox, oy)) return o;
          pa = na; po = no;
        }
      }
      return null;
    }
    // Is the place a is going to still taken by somebody who has yet to leave it? Then: that one.
    function taken(a) {
      const g = a.goal;
      for (let i = 0; i < crew.length; i++) { const o = crew[i]; if (o !== a && present(o) && (o.pending || (!!o.path && !o.moved)) && !inChair(o) && Math.abs(o.x - g.x) < 10.5 && Math.abs(o.y - g.y) < 16) return o; }
      return null;
    }
    // Would a, setting off now for the lounge, be at its place before somebody whose place lies deeper in? Then: that one.
    function early(a) {
      if (a.goal.kind !== 'lounge') return null;
      const v = pace() / 1000, mine = wayLen(a.x, a.y, a.path) / v, da = deepOf(a.goal);
      for (let i = 0; i < crew.length; i++) {
        const o = crew[i];
        if (o === a || !present(o) || !o.goal || o.goal.kind !== 'lounge' || !(o.pending || o.path)) continue;
        const d = deepOf(o.goal);
        if (d < da || (d === da && o.desk > a.desk)) continue;
        if (mine < (o.pending ? Math.max(0, o.delay) : 0) + (o.path ? wayLen(o.x, o.y, o.path) : o.far || 0) / v + 350) return o;
      }
      return null;
    }
    // Do they stay put in a ring: a for b, b for the next, ... the last for a? Then one of them has to go: one who
    // only waits for its turn in the lounge (why: 3), or else the one at the lowest desk.
    function inRing(a, b, why) {
      let low = a.desk, turn3 = why === 3, o = b;
      for (let n = 0; o && n < 8; n++) {
        if (o === a) return why === 3 || (!turn3 && a.desk === low);
        if (!o.pending || !o.hold) return false;
        low = Math.min(low, o.desk); if (o.why === 3) turn3 = true;
        o = byId.get(o.hold);
      }
      return false;
    }
    // Before its first step a robot looks down the first stretch of its way (out of its chair, off the sofa, out of the
    // queue): if somebody is walking there, or about to, it lets them go by first.
    function wayOutBusy(a) {
      const way = a.path;
      for (let i = 0; i < crew.length; i++) {                              // would it run into somebody over the next few seconds? then it does not start: better seated than stopped a few steps on
        const o = crew[i];
        if (o === a || !present(o) || !bound(o, a) || waitsOn(o, a)) continue;
        if (Math.abs(o.goal.x - a.x) < 12 && Math.abs(o.goal.y - a.y) < 16) continue;   // that one comes for a's place: a had better be gone
        for (let st = 1; st <= 16; st++) { const p = along(a.x, a.y, way, st * 10), q2 = along(o.x, o.y, o.path, st * 10); if (Math.abs(p[0] - q2[0]) < 16 && Math.abs(p[1] - q2[1]) < 20) return true; }   // (with a margin: a near miss now is a stop three steps on)
      }
      for (let st = 1; st <= 3; st++) {
        let x = a.x, y = a.y, dist = st * 6;
        for (let i = 0; i < way.length && dist > 0; i++) { const p = way[i], d = Math.hypot(p.x - x, p.y - y); if (d > dist) { x += (p.x - x) / d * dist; y += (p.y - y) / d * dist; dist = 0; } else { dist -= d; x = p.x; y = p.y; } }
        for (let i = 0; i < crew.length; i++) {
          const o = crew[i];
          if (o === a || !present(o) || !afoot(o) || o.held > 0) continue;
          if (Math.abs(o.x - x) < 12 && Math.abs(o.y - y) < 16) return true;
          const p = o.path[0];
          if (p && Math.abs(o.x - x) < 30 && Math.abs(o.y - y) < 16 && (p.x - o.x) * (x - o.x) + (p.y - o.y) * (y - o.y) > 0) return true;   // on its way here
        }
      }
      return false;
    }
    function step(dt) {
      crew.forEach((a) => { if (!present(a)) a.alpha = 0; });
      const stride = pace() * dt / 1000; let came = false;
      crew.forEach(foresee);
      const order = crew.filter(present).sort((p, q2) => ((p.go || 1e9) - (q2.go || 1e9)) || (p.desk - q2.desk));   // those who set off first move first
      order.forEach((a) => {
        a.alpha = Math.min(1, a.alpha + dt / 260);
        const awaited = (a.pending || (a.path && !a.moved)) && crew.some((o) => o.waitFor === a.id);   // somebody stands waiting for the place a is about to leave
        if (a.pending) {
          a.delay -= dt;
          if (a.delay <= 0 || awaited) {
            turn(a);
            let b = null, why = 0;                                         // its place is not free yet (1), somebody is coming the other way (2), or somebody has to get past its place first (3): it waits where it is, not for ever
            if (!awaited) { if (a.waited < 12000 && (b = taken(a))) why = 1; else if (a.waited < 8000 && (b = meets(a))) why = 2; else if (a.waited < 8000 && (b = early(a))) why = 3; }
            if (b && inRing(a, b, why)) b = null;
            a.hold = b ? b.id : null; a.why = why;
            if (b) { a.path = null; a.delay = 300; a.waited += 300; }
            else { a.pending = false; a.go = ++goSeq; a.held = 0; a.sat = 0; a.stuck = 0; a.moved = false; a.waitFor = null; a.waitOn = null; foresee(a); }
          }
        }
        if (a.path && !a.moved && (a.held > 0 || a.sat > 0) && simT - a.replan >= 400) { turn(a); foresee(a); }   // not off yet: the way may change while it waits
        if (a.path && a.moved && a.push === true && simT - a.replan >= 500) {   // squeezing past somebody: has a proper way opened meanwhile?
          const p = findPath(a.x, a.y, a.goal.x, a.goal.y, a); a.replan = simT;
          if (!p.push) { a.path = p.way; a.push = false; foresee(a); }
        }
        if (a.path && !a.moved && a.sat < 8000 && wayOutBusy(a)) a.sat += dt;
        else if (a.path) {
          let left = stride, nx = a.x, ny = a.y, n = 0;                    // where this step would take it
          while (left > 0 && n < a.path.length) { const p = a.path[n], dx = p.x - nx, dy = p.y - ny, d = Math.hypot(dx, dy); if (d <= left) { nx = p.x; ny = p.y; n++; left -= d; } else { nx += dx / d * left; ny += dy / d * left; left = 0; } }
          a.waitFor = null; a.waitOn = null;
          let way = ahead(a, nx, ny);
          if (way === 1 && (a.barge === a.waitOn || (a.held > 2600 && knot(a)) || a.held > 9000)) { a.barge = a.waitOn; way = 0; } else a.barge = null;   // nobody waits for ever
          if (way) {
            a.held += dt;
            if (way === 2) { a.stuck += dt; if (a.stuck > 1400) a.push = 2; else if (simT - a.replan >= 400) turn(a); }   // (2: it goes through, and does not look for another way again)
            else if (way === 1 && a.moved && simT - a.replan >= 500) {       // somebody is coming: is there a way past, a little to one side?
              const o = byId.get(a.waitOn), p = o && o.path && o.path[0];
              a.replan = simT;
              if (p && (p.x - o.x) * (a.x - o.x) + (p.y - o.y) * (a.y - o.y) > 0) { const alt = findPath(a.x, a.y, a.goal.x, a.goal.y, a, o); if (!alt.push && wayLen(a.x, a.y, alt.way) <= wayLen(a.x, a.y, a.path) + 50) { a.path = alt.way; foresee(a); } }
            }
          } else {
            const dx = nx - a.x, dy = ny - a.y, d = Math.hypot(dx, dy);
            if (d > 0.01) { a.seated = false; a.moved = true; if (Math.abs(dx) > Math.abs(dy) * 0.7) { a.face = 0; a.dx = dx > 0 ? 1 : -1; } else { a.dx = 0; a.face = dy < 0 ? 1 : 0; } }
            a.x = nx; a.y = ny; a.dist += d; a.path.splice(0, n); a.held = 0; a.stuck = 0;
            if (!a.path.length) { a.path = null; a.go = 0; a.push = false; a.barge = null; a.waitFor = null; a.waitOn = null; a.face = 0; a.dx = 0; a.sitKind = seatOf(a.goal); a.seated = !!a.sitKind; came = true; }
          }
        }
        const want = a.sitKind && a.seated ? 1 : 0;                       // it sits only on its seat, and keeps it until its first step
        a.sit = clamp(a.sit + clamp(want - a.sit, -dt / 170, dt / 170), 0, 1);
        if (a.sit <= 0 && !a.seated) a.sitKind = '';
      });
      if (came) crew.forEach((a) => { if (present(a) && a.path && !a.push) turn(a); });   // somebody has just come to stand somewhere: the others' ways go around it
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
      if (a.path && a.moved && !a.held) {                             // walking: the cycle follows the ground covered
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
        const doze = a.state === 'idle' && lt.late && !a.pending && !a.path;
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
          const settled = !a.pending && !a.path && a.goal.kind === 'lounge';
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
      let total = 0; crew.forEach((a) => { if (a.state !== 'unknown') total += a.waiting; });   // what waits on you is still waiting while its agent is at its desk
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
    const plate = (c, X, Y, w, h, cut, fill) => { c.fillStyle = fill; c.fillRect(X + cut, Y, w - 2 * cut, h); c.fillRect(X, Y + cut, w, h - 2 * cut); };
    let words = [];                                                      // what the words of this frame cover: x, y, w, h in device pixels
    const wordAt = (X, Y, w, h) => { words.push(X, Y, w, h); markD(X - 1, Y - 1, w + 2, h + 2); };
    // how much of the box X, Y, w, h lies on the box at r[i..i+3], grown by px and py
    const lap = (X, Y, w, h, r, i, px, py) => { const ox = Math.min(X + w, r[i] + r[i + 2]) - Math.max(X, r[i]) + px, oy = Math.min(Y + h, r[i + 1] + r[i + 3]) - Math.max(Y, r[i + 1]) + py; return ox > 0 && oy > 0 ? ox * oy : 0; };
    const TOPS = { bulb: 26, antenna: 28, gavel: 22 };                  // how far above its feet each look reaches

    // Name tags are labels on the floor and on the desk fronts: they are painted before the robots, so whoever stands or
    // walks in front of one covers it, never the other way round. A robot on its way has its tag at its feet. Those at
    // rest are given places where they cover neither each other nor anybody standing there, and keep them until
    // somebody at rest moves.
    let tagSig = 0, tagPos = new Map(), tagRects = [];
    function drawTags(list) {
      const u = dpr, cut = Math.max(1, Math.round(k)), H = Math.round(14 * u), rowH = H + 2 * u, lo = 2 * u, yMax = ch - H - lo;
      const poseOfA = new Map(); list.forEach((v) => poseOfA.set(v.a, v));
      const walk = [], still = [], bodies = [];
      crew.forEach((a) => {
        const v = poseOfA.get(a), d = L.desks[a.desk];
        const going = !!a.path && a.moved;                               // (one that has its way but still looks out before its first step is at rest)
        if (v && !going) { const top = TOPS[a.look] || 21; bodies.push(Math.round((v.x - 7) * k), Math.round((v.y - top) * k), Math.round(14 * k), Math.round((v.clip !== null ? top - (v.y - v.clip) : top) * k)); }
        else if (!v && d) bodies.push(Math.round((d.sx - 5) * k), Math.round((d.dy - 24) * k), Math.round(10 * k), Math.round(24 * k));
        if (!a.name) return;
        const w = Math.round(textW(a.name, false) + 10 * u);
        if (!v) { if (d) still.push({ a, w, ghost: true, desk: true, cx: d.cx * k, top: (d.dy + 9) * k }); }
        else if (a.sitKind === 'desk' && a.sit > 0.5 && d) still.push({ a, w, desk: true, cx: d.cx * k, top: (d.dy + 9) * k });
        else (going ? walk : still).push({ a, w, cx: v.x * k, top: (Math.max(v.y, a.y) + 2) * k, up: (v.y - (TOPS[a.look] || 21)) * k });
      });
      tagRects = [];
      g.font = fontTag;
      const paint = (tg, X, Y) => {
        const a = tg.a, hot = a.id === focusId || (!tg.ghost && a.id === hoverId);
        plate(g, X, Y, tg.w, H, cut, hot ? '#fffdf2' : tg.ghost ? 'rgba(35,28,50,0.42)' : 'rgba(35,28,50,0.92)');
        g.fillStyle = hot ? INK : tg.ghost ? 'rgba(255,255,255,0.62)' : '#ffffff'; g.fillText(a.name, X + Math.round(5 * u), Y + Math.round(10.5 * u));
        wordAt(X, Y, tg.w, H);
        if (!tg.ghost) tagRects.push({ id: a.id, x0: X / u, y0: Y / u, x1: (X + tg.w) / u, y1: (Y + H) / u });
      };
      // on their way: at the feet, wherever that is
      walk.forEach((tg) => paint(tg, Math.round(clamp(tg.cx - tg.w / 2, lo, cw - tg.w - lo)), Math.round(clamp(tg.top, lo, yMax))));
      // at rest: has anything moved since the places were given out?
      let sig = (cw * 4099 + ch + still.length) | 0;
      const mixIn = (n) => { sig = (Math.imul(sig, 16777619) ^ (n | 0)) | 0; };
      still.forEach((tg) => { mixIn(tg.cx); mixIn(tg.top); mixIn(tg.w); mixIn(tg.a.desk); });
      for (let i = 0; i < bodies.length; i++) mixIn(bodies[i]);
      if (sig !== tagSig || tagPos.size !== still.length || still.some((tg) => !tagPos.has(tg.a.id))) {
        tagSig = sig; tagPos = new Map();
        const put = [];
        still.forEach((tg) => {
          const w = tg.w, unit = w * H, cand = [];                         // each: x, y, the price of being that far from its robot
          const rows = [];
          for (let r = 0, last = -1; r < (tg.desk ? 3 : 4); r++) { const Y = clamp(tg.top + r * rowH, lo, yMax); if (Y === last) break; last = Y; rows.push([Y, 0.05 * r]); }
          if (!tg.desk) for (let j = 0; j < 2; j++) { const Y = tg.up - H - 2 * u - j * rowH; if (Y >= lo) rows.push([Y, 0.5 + 0.1 * j]); }
          rows.forEach((rw) => { for (let sh = 0; sh < 5; sh++) { const dx = (sh === 0 ? 0 : sh === 1 ? -1 : sh === 2 ? 1 : sh === 3 ? -2 : 2) * w / 4; cand.push([clamp(tg.cx - w / 2 + dx, lo, cw - w - lo), rw[0], unit * (rw[1] + 0.2 * Math.abs(dx) / (w / 4))]); } });
          let best = 0, bc = Infinity;
          cand.forEach((c, i) => {
            let cost = c[2] - (i === tg.a.tagAt ? 0.04 * unit : 0);          // it stays where it was unless another place is clearly better
            for (let j = 0; j < put.length && cost < bc; j += 4) cost += 4 * lap(c[0], c[1], w, H, put, j, 2 * u, u);
            for (let j = 0; j < bodies.length && cost < bc; j += 4) cost += 3 * lap(c[0], c[1], w, H, bodies, j, 0, 0);
            if (cost < bc) { bc = cost; best = i; }
          });
          tg.a.tagAt = best;
          const X = Math.round(cand[best][0]), Y = Math.round(cand[best][1]);
          put.push(X, Y, w, H); tagPos.set(tg.a.id, [X, Y]);
        });
      }
      still.forEach((tg) => { const p = tagPos.get(tg.a.id); if (p) paint(tg, p[0], p[1]); });
      inkOf = null;
    }

    // the number on a slip: painted with its robot, so one who stands in front covers it
    function slipWord(v) {
      const u = dpr, w = textW(v.num, true), X = Math.round(v.slip.x * k + (v.slip.w * k - w) / 2 - 0.5 * u), Y = Math.round(v.slip.y * k);
      g.font = fontNum; g.fillStyle = INK; g.fillText(v.num, X, Y + Math.round(11 * u)); inkOf = null;
      wordAt(Math.round(v.slip.x * k), Y, Math.round(v.slip.w * k), Math.round(7 * k));
    }

    // Bubbles: the step while working, a few words on a change. Over everything, and always right at their owner with
    // a tail to it, because a bubble anywhere else reads as somebody else's. Where one would lie on another, on a
    // name, a slip, a head or the question mark over an empty chair, they take turns, a few seconds each: whoever is
    // speaking keeps the floor for that long, then the one that has waited longest goes first and takes the best place
    // there is, and the others speak only if a free place is left. Nobody's bubble covers the sign over another one
    // that has failed. (Under reduced motion nothing takes turns: the lowest desk speaks, and whoever is pointed at
    // or has the focus.)
    let bubT = 0;
    function drawBubbles(list) {
      const u = dpr, cut = Math.max(1, Math.round(k)), keep = [], signs = [], says = [], put = [];
      const h = Math.round(16 * u), tail = Math.round(3 * k), up = h + 3 * u, since = clamp(simT - bubT, 0, 250);
      bubT = simT;
      // What the last picture showed counts for the time since then: who spoke has spoken that much longer, who had
      // to wait has waited that much longer. A change that waits for its first turn is not lost meanwhile, within
      // reason; one that has had its say and lost the floor is over. Nothing is counted while time stands still, so
      // the same moment drawn twice is the same picture.
      if (since > 0) crew.forEach((a) => {
        if (a.bubWas === 1) { a.spoke += since; a.told += since; a.quiet = 0; }
        else if (a.bubWas === 2 || a.bubWas === 3) {
          a.spoke = 0; a.quiet += since;
          if (a.bubWas === 3) { if (a.told >= 2800) a.bubbleUntil = -1; else if (a.bubLate < 5600) { a.bubLate += since; a.bubbleUntil += since; } }
        }
      });
      crew.forEach((a) => { a.bubWas = 0; });
      // not to be covered: everybody's head, the question marks, the plate with your name; and never, by anybody
      // else's bubble, the sign over one that has failed (signs: x, y, w, h, whose)
      list.forEach((v) => keep.push(Math.round((v.x + v.hx - 6) * k), Math.round((v.y - 19 + v.hy) * k), Math.round(12 * k), Math.round(9 * k)));
      list.forEach((v) => { if (v.fx === 'err') signs.push(Math.round((v.x - 4) * k), Math.round((v.y - 35) * k), Math.round(9 * k), Math.round(11 * k), v.a.desk); });
      crew.forEach((a) => { const d = L.desks[a.desk]; if (!present(a) && d) keep.push(Math.round((d.sx - 4) * k), Math.round((d.dy - 24) * k), Math.round(8 * k), Math.round(11 * k)); });
      { const wd = L.wd, w = Math.round(textW('You', false) + 10 * u); keep.push(Math.round((wd.x + wd.w / 2) * k - w / 2), Math.round((wd.by + 13) * k), w, Math.round(14 * u)); }
      list.forEach((v) => {
        const a = v.a; let text = '', change = false;
        if (a.state === 'working' && a.step && a.sitKind === 'desk' && a.sit >= 1) text = a.step;
        else if (a.bubbleUntil > simT && a.bubbleText) { text = a.bubbleText; change = true; }
        if (text !== a.sayText) { a.sayText = text; a.spoke = 0; a.quiet = 0; a.told = 0; a.bubAt = 0; }
        if (text) says.push({ v, text, change });
      });
      // in turn: the one pointed at or with the focus; those who have the floor; those who wait, the longest wait first;
      // those who have had their say
      const turnOf = (a) => (a.id === focusId || a.id === hoverId ? 0 : a.spoke > 0 && a.spoke < 2800 ? 1 : a.spoke > 0 ? 3 : 2);
      says.sort((p, q2) => (turnOf(p.v.a) - turnOf(q2.v.a)) || (q2.v.a.quiet - p.v.a.quiet) || (p.v.a.desk - q2.v.a.desk));
      g.font = fontTag;
      says.forEach((say) => {
        const v = say.v, a = v.a, lead = !put.length;                      // lead: the first to be placed this time
        const headTop = (v.y - 20 + v.hy) * k, hx = v.x * k, b1 = headTop - h - tail;
        const b0 = (v.y - (a.look === 'antenna' ? 28 : a.look === 'bulb' || a.look === 'gavel' ? 22 : 20) + v.hy) * k - h - tail;
        // Where these words can stand: right above the head (beside an antenna, so the bubble stays close and the
        // antenna in sight), or a little to one side of that; of those the place that covers least of the other words
        // and of what is not to be covered. null: nowhere this time.
        const place = (text) => {
          const w = Math.round(textW(text, false) + 12 * u), side = w * 0.4;
          const cand = a.look === 'antenna' ? [[hx - 2 * k - w, b1], [hx + 3 * k, b1], [hx - w / 2, b0]] : a.look === 'gavel' ? [[hx - w / 2, b0], [hx + 5 * k - w, b1]] : [[hx - w / 2, b0]];
          cand.push([hx - w / 2 - side, b0], [hx - w / 2 + side, b0]);
          const at = cand.map((c) => [Math.round(clamp(c[0], 2 * u, cw - w - 2 * u)), Math.round(clamp(c[1], 2 * u, ch - h - 2 * u))]);
          const tailX = (X) => Math.round(clamp(hx, X + 3 * cut, X + w - 4 * cut));
          const near = (X, Y) => Y + h <= headTop && headTop - (Y + h) < up && Math.abs(tailX(X) - hx) <= 7 * k;   // over its owner's head, less than a row above it: where the tail reaches
          const cover = (X, Y) => {
            let c2 = 0;
            for (let j = 0; j < words.length; j += 4) c2 += lap(X, Y, w, h, words, j, 2 * u, u) + 8 * lap(X, Y, w, h, words, j, 0, 0);   // too close is poor, on top is worse
            for (let j = 0; j < keep.length; j += 4) c2 += lap(X, Y, w, h, keep, j, u, u) + 8 * lap(X, Y, w, h, keep, j, 0, 0);
            return c2;
          };
          const onTop = (X, Y) => { let c2 = 0; for (let j = 0; j < put.length; j += 4) c2 += lap(X, Y, w, h, put, j, u, u); for (let j = 0; j < keep.length; j += 4) c2 += lap(X, Y, w, h, keep, j, 0, 0); for (let j = 0; j < words.length; j += 4) c2 += lap(X, Y, w, h, words, j, 0, 0); return c2; };
          const onSign = (X, Y) => { for (let j = 0; j < signs.length; j += 5) if (signs[j + 4] !== a.desk && lap(X, Y, w, h, signs, j, 0, 0) > 0) return true; return false; };
          // the lead speaks whatever stands there, short of another one's sign; the others only from a place at their
          // owner that is free
          const free = (i) => !onSign(at[i][0], at[i][1]) && (lead || (near(at[i][0], at[i][1]) && onTop(at[i][0], at[i][1]) === 0));
          const price = (i) => cover(at[i][0], at[i][1]) + i + (near(at[i][0], at[i][1]) ? 0 : 1e9);
          let best = -1, bestC = Infinity;
          for (let i = 0; i < cand.length; i++) { if (!free(i)) continue; const c2 = price(i); if (c2 < bestC) { best = i; bestC = c2; } }
          if (best < 0) return null;
          if (best !== a.bubAt && a.bubAt < cand.length && free(a.bubAt) && (says.length > 1 || bestC > 0) && price(a.bubAt) <= bestC + 0.03 * w * h) best = a.bubAt;   // it does not hop about for a little
          return { text, w, i: best, X: at[best][0], Y: at[best][1], tx: tailX(at[best][0]), tail: near(at[best][0], at[best][1]) };
        };
        let p = place(say.text);
        // The lead has nowhere to stand only when a sign is in the way: then it says as much as fits beside the sign.
        if (!p && lead) for (let n = say.text.length - 1; n >= 6 && !p; n--) p = place(say.text.slice(0, n).trimEnd() + '…');
        if (!p) { a.bubWas = say.change ? 3 : 2; return; }                 // no room this time: it waits for its turn
        a.bubAt = p.i; a.bubWas = 1;
        const w = p.w, X = p.X, Y = p.Y, tx = p.tx;
        plate(g, X, Y, w, h, cut, INK); plate(g, X + cut, Y + cut, w - 2 * cut, h - 2 * cut, cut, '#fffdf2');
        if (p.tail) { g.fillStyle = INK; g.fillRect(tx - cut, Y + h - cut, 3 * cut, 2 * cut); g.fillRect(tx, Y + h + cut, cut, cut); g.fillStyle = '#fffdf2'; g.fillRect(tx, Y + h - cut, cut, 2 * cut); markD(tx - cut - 1, Y + h - cut, 3 * cut + 2, 3 * cut + 1); }
        g.fillStyle = INK; g.fillText(p.text, X + Math.round(6 * u), Y + Math.round(11.5 * u));
        wordAt(X, Y, w, h); put.push(X, Y, w, h);
      });
      inkOf = null;
    }

    // ───────── one frame ─────────
    // the corners of a highlight around what is pointed at or has the focus
    function ring(l, r, top, bottom) {
      const c2 = '#ffe27a';
      R(l, top, 4, 1, c2); R(l, top, 1, 4, c2); R(r - 3, top, 4, 1, c2); R(r, top, 1, 4, c2); R(l, bottom, 4, 1, c2); R(l, bottom - 3, 1, 4, c2); R(r - 3, bottom, 4, 1, c2); R(r, bottom - 3, 1, 4, c2);
    }
    function drawRobot(v, t) {
      const a = v.a, hot = a.id === focusId || a.id === hoverId;
      { let x0 = -11, x1 = 12, y0 = -24, y1 = 4;                          // what this one can cover in this frame, to put back in the next
        if (a.look === 'antenna' || a.look === 'bulb') y0 = -29; else if (a.look === 'gavel') { x1 = v.bang ? 22 : 17; y0 = -23; } else if (a.look === 'clipboard') x1 = 14;
        if (v.mug) x0 = -12;
        if (v.hands) { x0 = -12; x1 = Math.max(x1, 12); }
        if (v.deskY !== null) y1 = 12;
        if (hot) { x0 = Math.min(x0, -13); x1 = Math.max(x1, 13); y0 = Math.min(y0, -27); y1 = Math.max(y1, 6); }
        if (v.fx === 'zzz') { x1 = Math.max(x1, 21); y0 = -38; } else if (v.fx === 'err') { x0 = -15; x1 = Math.max(x1, 16); y0 = -38; }
        mark(v.x + x0, v.y + y0, x1 - x0, y1 - y0); }
      if (a.alpha < 1) g.globalAlpha = clamp(a.alpha, 0, 1);
      if (!(a.sitKind === 'desk' && a.sit > 0)) { R(v.x - 5, v.y - 1, 10, 2, SHADOW); R(v.x - 4, v.y + 1, 8, 1, SHADOW); }
      if (hot) { const pz = reduced ? 0 : (Math.floor(t / 320) & 1); ring(v.x - 10 - pz, v.x + 9 + pz, v.y - 24 - pz, (a.sitKind === 'desk' && a.sit > 0 ? L.desks[a.desk].dy - 3 : v.y) + pz); }
      if ((a.look === 'bulb' && v.lit) && !reduced) glow(Math.round(v.x + v.hx), Math.round(v.y - 17 + v.hy - v.bob), 9, [255, 236, 130], lt.day < 0.5 ? 0.16 : 0.09);
      drawBot(v);
      if (v.hands) drawHands(v, L.desks[a.desk], v.hands, t);
      if (!reduced) {
        if (v.fx === 'zzz') zees(v.x, v.y + v.hy, t, a.seed);
        if (v.fx === 'err') { sparks(v.x, v.y, t, a.seed); }
        if (v.mug && !v.sip) steam(v.x - 7, v.y - 9, t, a.seed);
      } else if (v.fx === 'zzz') zees(v.x, v.y + v.hy, 700, 1);
      if (v.fx === 'err') alarm(v.x, v.y, t);
      if (v.slip && v.num) slipWord(v);
      g.globalAlpha = 1;
    }
    // an agent that is not in the room: its chair stands empty with a question mark over it (in front of the name plates)
    function drawAbsent(d, a, t) {
      const yy = d.dy, up = reduced ? 0 : (Math.floor(t / 700 + d.i) & 1), qx = d.sx - 3, qy = yy - 22 - up;
      mark(d.sx - 5, yy - 24, 10, 25);
      R(d.sx - 4, yy - 9, 8, 9, '#55506a'); R(d.sx - 3, yy - 8, 6, 7, '#7a7590'); R(d.sx - 3, yy - 8, 6, 1, '#918ca6');
      R(qx, qy, 6, 9, INK); R(qx - 1, qy + 1, 8, 7, INK);
      R(qx + 1, qy + 1, 3, 1, '#d9d3ea'); R(qx, qy + 2, 1, 1, '#d9d3ea'); R(qx + 4, qy + 2, 1, 2, '#d9d3ea'); R(qx + 3, qy + 4, 1, 1, '#d9d3ea'); R(qx + 2, qy + 5, 1, 1, '#d9d3ea'); R(qx + 2, qy + 7, 1, 1, '#d9d3ea');
      if (a.id === focusId) { const pz = reduced ? 0 : (Math.floor(t / 320) & 1); mark(d.sx - 12, yy - 29, 24, 31); ring(d.sx - 9 - pz, d.sx + 8 + pz, yy - 26 - pz, yy - 1 + pz); }   // the focus is on somebody who is away: its chair says where
    }

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
      dirty = []; words = [];
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
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
      // the names, under everybody
      const poses = [];
      crew.forEach((a) => { if (present(a)) poses.push(poseOf(a, t)); });
      drawTags(poses);
      // everybody, back to front: you, the robots (one on the sofa sits further back than where it stepped up), the
      // chairs of those who are away
      const items = [{ y: L.wd.by + 0.001, o: -1, you: true }];
      poses.forEach((v) => items.push({ y: v.a.sitKind === 'desk' ? v.a.y : v.y, o: v.a.desk, v }));
      crew.forEach((a) => { const d = L.desks[a.desk]; if (!present(a) && d) items.push({ y: d.sy, o: a.desk, d, a }); });
      items.sort((p, q2) => (p.y - q2.y) || (p.o - q2.o));
      items.forEach((it) => { if (it.you) drawYou(t); else if (it.d) drawAbsent(it.d, it.a, t); else drawRobot(it.v, t); });
      drawBubbles(poses);
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

    // back after a long while out of sight: everybody is where they belong, and nothing that happened meanwhile plays now
    function settle() {
      crew.forEach((a) => { if (present(a)) { rest(a, goalOf(a)); a.alpha = 1; } a.bubbleUntil = -1; a.popAt = -1e9; });
      flights = []; trayPop = -1e9;
    }
    function frame(tMs) {
      if (destroyed) return;
      tMs = num(tMs, lastT == null ? 0 : lastT);
      const gap = lastT == null ? 0 : tMs - lastT, dt = gap > 0 ? Math.min(gap, 250) : 0;
      lastT = tMs;
      if (!sized) return;                                                // no size yet: the first real frame starts the walk from the desks
      if (ratio() !== dpr) resize(cssW);                                 // the window moved to another screen, or the page was zoomed
      if (cw < 2 || ch < 2) return;
      if (gap > 60000 && framed) { catchUp = tMs + 1500; settle(); }     // a crew set in the next moments belongs to the catching up as well
      if (!reduced && dt > 0) { simT += dt; step(dt); }                  // the same moment drawn twice is the same picture
      repoint();                                                         // who is under the pointer now that everybody has moved
      framed = true; needsDraw = false;
      draw();
    }

    // ───────── the loop ─────────
    const visible = () => !(typeof document !== 'undefined' && document.hidden) && canvas.offsetParent !== null && onscreen;
    function tick(ts) {
      raf = 0; if (!running || destroyed) return;
      if (typeof document !== 'undefined' && document.hidden) return;        // the visibilitychange listener starts it again
      if (!visible()) return;                                                // out of sight (another tab of the page, scrolled away): nothing is asked for until wake()
      raf = requestAnimationFrame(tick);
      try {
        if (reduced) { if (needsDraw || ratio() !== dpr) frame(num(ts, 0)); return; }   // nothing moves: a frame only for a change (a crew, a size, the focus, a zoom of the page)
        if (ts - lastDraw >= 62) { lastDraw = ts; frame(ts); }
      } catch (e) { fail(e); }
    }
    // A frame of the loop that throws ends the picture for good. A canvas that stands still looks current, so it is
    // wiped, the scene lets go of everything, and whoever made it is told (onError) and folds it away; with nobody to
    // tell, the error goes on to the page.
    function fail(e) {
      destroy();
      try { canvas.width = canvas.width; } catch (x) { /* no canvas left to wipe */ }
      if (!onError) throw e;
      onError(e);
    }
    // a new crew, a new size, a focus change or coming back into view: draw again, and start the loop if it stopped out of sight
    function wake() { needsDraw = true; if (running && !raf && !destroyed) raf = requestAnimationFrame(tick); }
    function start() { if (destroyed) return; running = true; needsDraw = true; if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    const onVis = () => { if (running && !destroyed && !(typeof document !== 'undefined' && document.hidden) && !raf) { needsDraw = true; raf = requestAnimationFrame(tick); } };

    // ───────── pointing ─────────
    function boxOf(a) {
      const f = feet(a), half = Math.max(14, 8 * s), d = L.desks[a.desk];
      if (a.sitKind === 'desk' && a.sit > 0.5 && d) return { x0: Math.min(f.x * s - half, d.x0 * s), x1: Math.max(f.x * s + half, (d.x0 + d.w) * s), y0: (f.y - 26) * s, y1: (d.dy + 17) * s, low: d.dy * s };
      return { x0: f.x * s - half, x1: f.x * s + half, y0: (f.y - 27) * s, y1: (Math.max(f.y, a.y) + 10) * s, low: f.y * s };
    }
    function anchor(id) {
      const a = byId.get(id); if (!a || !present(a) || !sized) return null;
      const f = feet(a);   // a thousandth of a pixel apart per agent, so two that cross on the same spot still have their own point
      return { x: clamp(f.x * s + a.desk * 0.001, 1, Math.max(1, cw / dpr - 1)), y: clamp((f.y - (a.look === 'bulb' ? 16 : 15)) * s, 1, Math.max(1, cssH - 1)) };
    }
    // Who is under the point: the robot whose figure it is on; else the robot whose name tag it is on, wherever that tag
    // had to go; else the nearest robot whose (generous) box holds it.
    function hit(x, y) {
      x = num(x, -1e6); y = num(y, -1e6); let best = null, bd = 1e12, on = null, od = 1e12;
      crew.forEach((a) => {
        if (!present(a)) return; const b = boxOf(a);
        if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return;
        const p = anchor(a.id); if (!p) return; const dd = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (dd < bd) { bd = dd; best = a.id; }
        if (dd < od && Math.abs(x - p.x) <= 7 * s && y <= b.low) { od = dd; on = a.id; }
      });
      if (on !== null) return on;
      for (let i = tagRects.length - 1; i >= 0; i--) { const r = tagRects[i], a = byId.get(r.id); if (a && present(a) && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.id; }
      return best;
    }
    let ptr = null;                                                          // where the pointer was last seen, in css px of the canvas
    const spot = (e) => { const r = canvas.getBoundingClientRect(), fx = r && r.width ? cw / dpr / r.width : 1, fy = r && r.height ? cssH / r.height : 1; return { x: (num(e.clientX, 0) - (r ? r.left : 0)) * fx, y: (num(e.clientY, 0) - (r ? r.top : 0)) * fy }; };
    const setHover = (id) => { if (id === hoverId) return; hoverId = id; canvas.style.cursor = id ? 'pointer' : ''; wake(); onHover(id); };
    const onMove = (e) => { const p = spot(e), id = hit(p.x, p.y), touch = e.pointerType === 'touch'; ptr = touch && !id ? null : { x: p.x, y: p.y, touch }; setHover(id); };
    // a finger that lifts fires pointerleave at once: what it touched stays pointed at until it walks off or another place is touched
    const onLeave = (e) => { if (e && e.type === 'pointerleave' && e.pointerType === 'touch') return; ptr = null; setHover(null); };
    // (a tap that took the reader somewhere is over: onPick says so by returning true, and nothing stays pointed at)
    const onClick = (e) => { const p = spot(e), id = hit(p.x, p.y); if (!id) return; const went = onPick(id); if (went === true && ptr && ptr.touch) { ptr = null; setHover(null); } };
    // The robots move under a pointer that does not: once everybody has stepped, look again who is under it. A touch does
    // not pick up whoever walks by afterwards.
    function repoint() {
      if (!ptr) return;
      const id = hit(ptr.x, ptr.y);
      if (!ptr.touch) setHover(id); else if (id !== hoverId) { ptr = null; setHover(null); }
    }
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
