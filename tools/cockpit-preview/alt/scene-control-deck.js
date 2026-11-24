// The cockpit scene: a pixel-art control deck drawn on one canvas, where each scheduled agent is a little robot.
// Where a robot is tells its state: at its console (working, due, late, failed), in the queue at your desk holding a
// slip with a number (waiting on you), by the coffee (nothing needs you), or gone (empty chair, dark screen).
// It is a picture only: it gets a crew (see OSCrew.derive) and never reads the database, `dash`, `OS` or the model.
// No images, no fonts, no network: everything is drawn with canvas calls. All art is original to this file.
//   const scene = OSCockpit.create(canvas, { now, seed, reducedMotion, onHover, onPick });
//   scene.setCrew(crew); scene.resize(cssWidth); scene.start();  ...  scene.destroy();
// How a frame is made: the room that does not move (walls, window, floor, lanes, light pools) is drawn once into an
// opaque cache and copied; then what moves on the wall, then furniture and robots back to front, then the words
// (name tags, slips, bubbles) in screen space. Art is in logical pixels, each a whole number of device pixels.
// Time comes only from frame(t) and opts.now(), chance only from opts.seed.
(function (root) {
  'use strict';

  // ---------- small helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // a small seeded generator (mulberry32): the scene's only source of randomness
  const rng = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // a stateless hash in 0..1 for (a, b): used for things that must not depend on the order of calls
  const hash = (a, b) => { let h = (Math.imul((a | 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((b | 0) + 0x7F4A7C15, 0xC2B2AE35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297A2D39) >>> 0; h ^= h >>> 15; return (h >>> 0) / 4294967296; };

  // ---------- colour ----------
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex2 = (v) => { const s = Math.round(clamp(v, 0, 255)).toString(16); return s.length < 2 ? '0' + s : s; };
  const toHex = (c) => '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]); };
  const rgba = (hex, a) => { const c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (Math.round(clamp(a, 0, 1) * 1000) / 1000) + ')'; };

  // The room's own palette (it does not follow the page's theme). Surfaces are written as they look by day and are
  // run through the hour's light (see `lit`); things that give light (screens, lamps, strips, eyes) are not.
  const PAL = {
    wall: '#232d4b', wallHi: '#2e3a5f', wallLo: '#1b2440', wallSeam: '#19213a', trim: '#4a5c8f', trimLo: '#131a2f',
    floor: '#3a4569', floorB: '#363f63', floorSeam: '#2f395c', floorHi: '#46527d',
    metal: '#44517a', metalHi: '#5d6c9a', metalLo: '#2f3a5c', dark: '#1a2138', ink: '#0d1326',
    desk: '#3b4871', deskTop: '#566694', deskHi: '#7383b3', deskLo: '#28324f', deskEdge: '#161d33',
    shell: '#eeeae0', shellMid: '#cfcbc6', shellLo: '#a3a2b0', joint: '#5d6893', jointHi: '#8d98c0',
    paper: '#fff6e2', paperLo: '#e2d5ba', paperInk: '#1b2238',
    rug: '#84494a', rugHi: '#b87562', rugLo: '#5c3238', wood: '#8a5a3c', woodHi: '#a8744d', woodLo: '#5f3d2a',
    leaf: '#3fae6b', leafHi: '#67d08a', leafLo: '#2a7d4f', pot: '#c96f4a', potLo: '#96492f',
    skin: '#f0dcc0', skinLo: '#cdb596', coat: '#27365c', coatHi: '#3b4f82', jacket: '#4c63a6', jacketHi: '#6b85c8', jacketLo: '#364a82', gold: '#ffcc5c', goldLo: '#c9902f',
    lampGreen: '#5df08c', lampAmber: '#ffb637', lampRed: '#ff5468', lampOff: '#5a6690',
    strip: '#63e6d2', stripWarm: '#ffc66b', screen: '#0a1124', screenLine: '#132042',
    tagBg: '#0c1228', tagEdge: '#3b4a78', tagInk: '#eef2ff', youBg: '#ffd166', youInk: '#2a1c05',
    bubble: '#fbf7ea', bubbleInk: '#18203a', white: '#ffffff', black: '#060914',
  };
  // one bright accent per agent: main, dark (shade), light (glow)
  const HUES = {
    teal: ['#2fd3bd', '#17917f', '#a8fff0'], amber: ['#ffb02e', '#c27412', '#ffe6a3'], rose: ['#ff5c8d', '#c22f5e', '#ffc2d6'],
    violet: ['#a583ff', '#6c4dd0', '#e0d3ff'], blue: ['#4aa3ff', '#2468c8', '#c4e2ff'], green: ['#7ddc4a', '#479a24', '#d8ffbe'],
  };
  const LOOKS = { headset: 1, gavel: 1, antenna: 1, bulb: 1, clipboard: 1, plain: 1 };
  const STATES = { working: 1, due: 1, late: 1, error: 1, needs: 1, idle: 1, unknown: 1 };
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // ---------- the pen: rectangles in logical pixels, each exactly PK device pixels ----------
  let G = null, PK = 2, lastFill = '';
  const pen = (ctx, k) => { G = ctx; PK = k; lastFill = ''; };
  const R = (x, y, w, h, c) => { if (c !== lastFill) { G.fillStyle = c; lastFill = c; } G.fillRect(x * PK, y * PK, w * PK, h * PK); };
  // a pixel-art disc and ring (midpoint spans), used for the clock, the radar and lamps
  const disc = (cx, cy, r, c) => { for (let dy = -r; dy <= r; dy++) { const dx = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35); R(cx - dx, cy + dy, dx * 2 + 1, 1, c); } };
  const ring = (cx, cy, r, c) => { let x = r, y = 0, e = 1 - r; while (x >= y) { R(cx + x, cy + y, 1, 1, c); R(cx - x, cy + y, 1, 1, c); R(cx + x, cy - y, 1, 1, c); R(cx - x, cy - y, 1, 1, c); R(cx + y, cy + x, 1, 1, c); R(cx - y, cy + x, 1, 1, c); R(cx + y, cy - x, 1, 1, c); R(cx - y, cy - x, 1, 1, c); y++; if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; } } };
  // a 1 px line between two logical points (Bresenham): clock hands, the chart on the wall
  const line = (x0, y0, x1, y1, c) => { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, n = 0; for (;;) { R(x0, y0, 1, 1, c); if ((x0 === x1 && y0 === y1) || ++n > 400) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } };

  // ---------- the hour: the sky in the window band and the light in the room ----------
  // A fixed winter day at Stockholm's latitude, read from the viewer's own clock: dark until about eight, a low sun
  // for a few hours, dark again by mid afternoon.
  const SKY = [ // hour, colour at the top of the band, colour at the horizon
    [0, '#060a1c', '#101a3a'], [6.4, '#070b20', '#141d42'], [7.4, '#131b47', '#4f3a72'], [8.3, '#2f4a8c', '#f2906a'],
    [9.3, '#4f86cc', '#f8d9b6'], [11.5, '#6aa4de', '#dcecf6'], [13.4, '#5f93d2', '#f4dfb8'], [14.6, '#44589b', '#f6935a'],
    [15.6, '#222a60', '#8c4a78'], [16.6, '#0b1130', '#1b2250'], [24, '#060a1c', '#101a3a'],
  ];
  const skyAt = (ms) => {
    const d = new Date(num(ms, 0));
    let h = d.getHours() + d.getMinutes() / 60;
    if (!isFinite(h)) h = 12;
    let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
    const a = SKY[i], b = SKY[i + 1], t = clamp((h - a[0]) / Math.max(0.01, b[0] - a[0]), 0, 1);
    const light = smooth(7.0, 9.4, h) * (1 - smooth(13.6, 16.4, h));
    const bump = (c, w) => Math.max(0, 1 - Math.abs(h - c) / w);
    const night = h < 12 ? 1 - smooth(6.6, 8.2, h) : smooth(15.3, 16.7, h);
    const sunT = (h - 8.1) / (15.1 - 8.1), moonT = (((h + 24 - 16.5) % 24) / 15.5);
    const month = d.getMonth();
    return { h, key: Math.floor((d.getHours() * 60 + d.getMinutes()) / 4), top: mix(a[1], b[1], t), low: mix(a[2], b[2], t), light, night,
      warm: Math.max(bump(8.3, 1.3), bump(14.7, 1.4)), sun: sunT > 0 && sunT < 1 ? sunT : -1, moon: night > 0.4 && moonT < 1 ? moonT : -1,
      snow: month >= 10 || month <= 2, hours: d.getHours(), mins: d.getMinutes() };
  };
  // the room's surfaces under the hour's light: darker and bluer at night, a little warm at sunrise and sunset
  const lightMul = (sky, soft) => {
    const L = sky.light, w = sky.warm * 0.5, k = soft ? 0.55 : 1;
    return [lerp(1 - 0.36 * k, 1, L) * (1 + 0.05 * w), lerp(1 - 0.30 * k, 1, L), lerp(1 - 0.12 * k, 1, L) * (1 - 0.05 * w)];
  };

  // the slim window: sky, stars, a low sun or the moon, and a dark line of roofs
  const drawSky = (x, y, w, h, sky, seed) => {
    for (let j = 0; j < h; j++) R(x, y + j, w, 1, mix(sky.top, sky.low, Math.pow(j / Math.max(1, h - 1), 1.4)));
    if (sky.night > 0.25) { // stars
      const n = Math.floor(w / 7);
      for (let i = 0; i < n; i++) {
        const sx = x + Math.floor(hash(seed + i, 11) * w), sy = y + Math.floor(hash(seed + i, 12) * Math.max(1, h - 3));
        R(sx, sy, 1, 1, mix(sky.top, hash(i, 13) > 0.7 ? '#ffffff' : '#b9c8ff', sky.night * (0.45 + 0.5 * hash(i, 14))));
      }
    }
    if (sky.sun >= 0) { // a low winter sun
      const sx = x + Math.round(lerp(0.1, 0.9, sky.sun) * w), sy = y + h - 4 - Math.round(Math.sin(sky.sun * Math.PI) * (h - 6));
      R(sx - 3, sy, 7, 1, mix(sky.low, '#fff3c4', 0.35)); R(sx - 2, sy - 1, 5, 3, mix(sky.low, '#fff3c4', 0.6));
      R(sx - 1, sy - 1, 3, 3, '#fff1b8'); R(sx - 1, sy - 2, 3, 1, mix(sky.low, '#fff3c4', 0.6)); R(sx - 1, sy + 2, 3, 1, mix(sky.low, '#fff3c4', 0.5));
    }
    if (sky.moon >= 0) { // the moon, a small crescent
      const mx = x + Math.round(lerp(0.12, 0.88, sky.moon) * w), my = y + 1 + Math.round((1 - Math.sin(sky.moon * Math.PI)) * 2);
      R(mx, my, 3, 4, '#f4f1d8'); R(mx - 1, my + 1, 1, 2, '#f4f1d8'); R(mx + 1, my, 2, 2, mix(sky.top, sky.low, 0.2)); R(mx + 2, my + 2, 1, 1, mix(sky.top, sky.low, 0.3));
    }
    // roofs and a spire or two, darker than the sky, with a few lit windows after dark
    const roof = mix(mix(sky.top, sky.low, 0.6), '#0a1022', 0.55 + 0.3 * sky.night);
    let bx = x;
    for (let i = 0; bx < x + w; i++) {
      const bw = 3 + Math.floor(hash(seed + i, 21) * 6), bh = 1 + Math.floor(hash(seed + i, 22) * 3), ww = Math.min(bw, x + w - bx);
      R(bx, y + h - bh, ww, bh, roof);
      if (hash(seed + i, 23) > 0.86 && ww >= 3) { R(bx + 1, y + h - bh - 2, 1, 2, roof); R(bx + 1, y + h - bh - 3, 1, 1, roof); }
      if (sky.night > 0.5 && bh >= 2 && hash(seed + i, 24) > 0.45 && ww >= 3) R(bx + 1 + Math.floor(hash(seed + i, 25) * (ww - 2)), y + h - bh + (hash(seed + i, 26) > 0.5 ? 1 : 0), 1, 1, '#ffd98a');
      bx += bw;
    }
  };

  // ---------- layout: where everything stands in a room W logical pixels wide with n agents ----------
  // Two plans. 'side' (wide): the coffee corner back left, consoles along the back wall, your desk front right with
  // the queue running left from it. 'stack' (narrow): consoles on top, the coffee corner front left with its rug
  // above it, your desk front right and the queue between the two. Walks are straight legs: out through a gap
  // between two consoles, along the main lane, down to a place.
  const SP = 27;            // the room one robot takes in a line (a name tag of eight letters fits under it)
  const layout = (W, n, u, deep, tagW) => {
    const count = Math.max(0, n | 0), k = Math.max(1, count);
    W = Math.max(150, W | 0);
    let gW = clamp(Math.round(W * 0.26), k > 3 ? 98 : 72, 150);   // the coffee corner's width: room for three abreast when the crew is larger
    const sideCols = Math.floor((W - 12 - gW) / 36);
    const side = sideCols >= Math.min(k, 8);
    if (!side) gW = 0;
    const x0 = side ? gW + 6 : 4, x1 = W - 4;
    const maxCols = Math.max(2, Math.floor((x1 - x0) / 33.4));
    const rows = Math.max(1, Math.ceil(k / maxCols)), cols = Math.ceil(k / rows);
    const pitch = clamp(Math.floor((x1 - x0) / cols), 30, 80);
    const cw = pitch >= 44 ? 30 : pitch >= 38 ? 28 : 26;
    const tight = rows > 1 && count !== 8;            // more rows than the height allows: a lower wall, closer rows
    const wallH = tight ? 31 : rows > 1 && !side ? 40 : 44, rowGap = tight ? 35 : 38;
    const start = x0 + Math.round(((x1 - x0) - pitch * cols) / 2 + pitch / 2);
    const consoles = [];
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = Math.min(cols, count - r * cols), shift = Math.floor((cols - inRow) / 2) * pitch;   // a short row keeps to the columns, so the gaps line up
      consoles.push({ cx: start + c * pitch + shift, yb: wallH + (tight ? 24 : 26) + r * rowGap, w: cw, row: r, gl: 0, gr: 0, item: (i * 3 + 1) % 4 });
    }
    // the gaps a robot can leave through: left of its console and right of it (the room's edge is not a gap)
    const half = Math.round(pitch / 2);
    consoles.forEach((c) => { c.gl = c.cx - half; c.gr = c.cx + half; if (c.gl < 8) c.gl = c.gr; if (c.gr > W - 8) c.gr = c.gl; });
    const ybLast = wallH + (tight ? 24 : 26) + (rows - 1) * rowGap;
    const yL = ybLast + (tight ? 29 : 31);              // the main lane: a walker's head stays clear of the name tags under the consoles
    const yQ = side ? yL + 36 : yL + (tight ? 52 : 61); // where the queue stands
    const dw = W >= 300 ? 56 : 50;
    const desk = { x: W - 5 - dw, yb: yQ + 2, w: dw };
    const you = { x: desk.x + dw - 17 };                // William sits at the right half; the tray is at the queue's end
    const tray = { x: desk.x + 4, y: desk.yb - 14 };
    const queue = { x0: desk.x - 19, y: yQ, min: side ? gW + 10 : 47, sp: clamp((tagW | 0) + 1, SP, 40) };   // sp: the widest a place in the line gets
    // a second row of name tags needs room under the queue when the line can get tight (narrow plan: many agents, long names, little room)
    const cap = Math.floor((count === 8 ? 440 : 380) / (u || 2));
    const snug = !side && (deep || (queue.x0 - queue.min) / Math.max(1, count - 1) < SP);
    const H = Math.min(Math.max(cap, yQ + 14), yQ + 14 + (snug ? 9 : 0));
    // the galley: a counter with the coffee machine, a rug, and standing spots (nearest the coffee first)
    const slots = [];
    let counter, rug, plant = null, sign = null;
    if (side) {
      counter = { x: 12, yb: wallH + 22, w: clamp(gW - 44, 34, 52) };
      plant = { x: counter.x + counter.w + 9, y: wallH + 23 };
      sign = { x: counter.x + Math.round(counter.w / 2) + 6, y: Math.round(wallH / 2) - 1 };
      rug = { x: 9, y: counter.yb + 14, w: gW - 18, h: yL + 8 - (counter.yb + 14) };
      // a row in front of the counter, then a row below the lane
      const per = clamp(Math.floor((gW - 34) / 29) + 1, 2, 3);
      for (let i = 0; i < Math.max(8, count); i++) {
        const r = Math.floor(i / per), c = i % per, odd = r % 2 === 1;
        const x = clamp((odd ? 38 : 24) + c * 29 + (r > 1 ? 14 : 0), 14, gW - 4);
        slots.push({ x, y: odd ? yL + 27 - (c % 2) * 3 : counter.yb + 24 + (c % 2) * 4 + (r > 1 ? 5 : 0), low: false });
      }
    } else {
      // the front left corner: the counter stands in line with your desk, the robots gather on the rug above it and beside it
      counter = { x: 5, yb: yQ + 2, w: 34 };
      if (W >= 190 && rows === 1) plant = { x: W - 11, y: yL + 22 };
      rug = { x: 4, y: yL + 6, w: Math.min(80, W - 70), h: 16 };
      // three on the rug, two beside the counter (reached between the ones on the rug), then along the lane
      const lowA = yQ - 11, lowB = yQ - 8;
      const spots = [[14, yL + 13, 0], [41, yL + 16, 0], [68, yL + 13, 0], [54, lowA, 1], [81, lowB, 1], [95, yL + 16, 0], [122, yL + 13, 0], [149, yL + 16, 0]];
      for (let i = 0; i < Math.max(8, count); i++) {
        const s = spots[i % spots.length], lap = Math.floor(i / spots.length);
        slots.push({ x: clamp(s[0] + lap * 13, 14, W - 26), y: s[1] + lap * 2, low: s[2] === 1 });
      }
    }
    // decor on the wall: the window band, the big display, the clock, the pennant
    const win = { x: 5, y: tight ? 3 : 4, w: W - 10, h: tight ? 7 : 9 };
    const wy = win.y + win.h + 4, wh = wallH - wy - 7;
    const cx0 = side ? gW + 8 : 6;
    const dW = clamp(Math.round((W - cx0) * (side ? 0.42 : 0.52)), 70, 210);
    const disp = { x: cx0 + Math.max(22, Math.round((W - 6 - cx0 - dW) * (side ? 0.34 : 0.3))), y: wy, w: dW, h: wh };
    const clock = { x: disp.x + disp.w + 13, y: wy + Math.round(wh / 2), r: Math.min(8, Math.floor(wh / 2) - 1) };
    const pennant = { x: disp.x - 19, y: wy };
    const emblem = side ? { x: Math.round(lerp(gW * 0.5, queue.x0 - 5 * SP, 0.45)), y: yL + 20, r: clamp(Math.round(W / 34), 11, 18) } : { x: W - 36, y: yL + 14, r: 11 };
    const lamp = side ? { x: 15, y: yL + 45 } : null;   // a floor lamp in the coffee corner
    // a wide room has wall to spare: a rack of blinking machines left of the consoles, a tall plant in the far corner
    const first = consoles.length ? consoles[0].cx - Math.round(cw / 2) : 0, last = consoles.length ? consoles[consoles.length - 1].cx + Math.round(cw / 2) : W;
    const rack = side && rows === 1 && first - (gW + 6) >= 44 ? { x: gW + 9, yb: wallH + 21 } : null;
    const plant2 = side && rows === 1 && W - last >= 46 ? { x: W - 15, y: wallH + 25 } : null;
    const mark = emblem.x - emblem.r - 6 > (side ? 34 : 0) && emblem.x + emblem.r + 6 < W && (side || emblem.y + 9 < desk.yb - 38) ? emblem : null;   // the emblem only where the floor is free
    return { W, H, side, rows, cols, pitch, cw, wallH, consoles, yL, yQ, desk, you, tray, queue, slots, counter, rug, plant, plant2, rack, sign, lamp, win, disp, clock, pennant, emblem: mark, gW, tight, count };
  };
  // the furthest spot of a queue of q robots: spacing shrinks when the line gets long
  const queueDx = (L, q) => { const room = L.queue.x0 - L.queue.min; return q <= 1 ? SP : clamp(Math.floor(room / (q - 1)), 12, L.queue.sp); };
  const queueX = (L, i, q) => L.queue.x0 - i * queueDx(L, q);

  // ---------- the room that does not move (drawn once into a cache) ----------
  // `c` turns a daytime surface colour into the colour under this hour's light.
  const ellipse = (cx, cy, rx, ry, col, step) => { const n = Math.max(24, rx * 4); for (let i = 0; i < n; i++) { if (step && i % step) continue; const a = i / n * Math.PI * 2; R(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1, col); } };
  const strip = (x0, y0, x1, y1, col, base) => { // a thin light strip let into the floor
    const xa = Math.min(x0, x1), ya = Math.min(y0, y1), w = Math.abs(x1 - x0) + 1, h = Math.abs(y1 - y0) + 1;
    if (w >= h) { R(xa, ya - 1, w, 3, mix(base, col, 0.13)); R(xa, ya, w, 1, mix(base, col, 0.52)); }
    else { R(xa - 1, ya, 3, h, mix(base, col, 0.13)); R(xa, ya, 1, h, mix(base, col, 0.52)); }
  };
  const dispParts = (d) => { const cw = Math.floor((d.w - 8) * 0.42), r = Math.max(3, Math.min(8, Math.floor(d.h / 2) - 2)); return { cx0: d.x + 3, cw, rx: d.x + 3 + cw + 4 + r, ry: d.y + Math.floor(d.h / 2), r, bx: d.x + 3 + cw + 8 + r * 2 + 2 }; };
  const drawRoom = (L, sky, c, seed, hues) => {
    const W = L.W, H = L.H, wh = L.wallH, P = PAL;
    // wall: deep navy panels, a darker head rail, a skirting with a thin light line
    R(0, 0, W, wh, c(P.wall));
    R(0, 0, W, L.win.y - 1, c(P.wallLo));
    for (let x = 14; x < W; x += 26) R(x, L.win.y + L.win.h + 2, 1, wh - L.win.y - L.win.h - 6, c(P.wallSeam));
    R(0, L.win.y + L.win.h + 1, W, 1, c(P.wallHi));
    R(0, wh - 4, W, 4, c(P.wallLo)); R(0, wh - 5, W, 1, mix(c(P.wall), P.strip, 0.5)); R(0, wh - 1, W, 1, c(P.trimLo));
    // the slim window band with the sky of the hour
    const wn = L.win;
    R(wn.x - 1, wn.y - 1, wn.w + 2, wn.h + 2, c(P.trimLo));
    drawSky(wn.x, wn.y, wn.w, wn.h, sky, seed);
    const panes = Math.max(2, Math.round(wn.w / 40));
    for (let i = 1; i < panes; i++) R(wn.x + Math.round(i * wn.w / panes), wn.y, 1, wn.h, c(P.trimLo));
    R(wn.x - 1, wn.y + wn.h, wn.w + 2, 1, c(P.trim));
    if (sky.light > 0.05) R(wn.x, wn.y + wn.h + 2, wn.w, 2, mix(c(P.wall), sky.low, 0.10 * sky.light)); // daylight on the wall
    // the big display: a dark glass with a bezel; what moves on it is drawn each frame
    const d = L.disp;
    R(d.x - 2, d.y - 2, d.w + 4, d.h + 4, c(P.trimLo)); R(d.x - 1, d.y - 1, d.w + 2, d.h + 2, c(P.metal)); R(d.x - 1, d.y - 1, d.w + 2, 1, c(P.metalHi));
    R(d.x, d.y, d.w, d.h, P.screen);
    for (let x = d.x + 5; x < d.x + d.w - 1; x += 6) R(x, d.y + 1, 1, d.h - 2, P.screenLine);
    for (let y = d.y + 4; y < d.y + d.h - 1; y += 5) R(d.x + 1, y, d.w - 2, 1, P.screenLine);
    R(d.x + Math.round(d.w / 2) - 3, d.y + d.h + 2, 6, 1, c(P.metalLo));
    { const dq = dispParts(d); ring(dq.rx, dq.ry, dq.r, mix(P.screen, P.lampGreen, 0.4)); if (dq.r > 5) ring(dq.rx, dq.ry, dq.r - 4, mix(P.screen, P.lampGreen, 0.22)); }
    // the clock face (its hands are drawn each frame)
    const k = L.clock;
    if (k.r >= 3 && k.x + k.r + 3 < W) { disc(k.x, k.y, k.r + 1, c(P.trimLo)); disc(k.x, k.y, k.r, P.screen); ring(k.x, k.y, k.r, c(P.metalHi));
      R(k.x, k.y - k.r + 1, 1, 1, P.strip); R(k.x, k.y + k.r - 1, 1, 1, P.strip); R(k.x - k.r + 1, k.y, 1, 1, P.strip); R(k.x + k.r - 1, k.y, 1, 1, P.strip); }
    // a pennant on the wall, for warmth
    const pn = L.pennant;
    if (!L.tight) { R(pn.x - 1, pn.y, 13, 1, c(P.metalHi)); for (let j = 0; j < 9; j++) { const w = 11 - j - (j > 5 ? j - 5 : 0); if (w > 0) R(pn.x + Math.floor((11 - w) / 2), pn.y + 1 + j, w, 1, c(j < 2 ? '#f2c14e' : '#e2574c')); } R(pn.x + 4, pn.y + 4, 3, 1, c('#fff1c9')); R(pn.x + 5, pn.y + 3, 1, 3, c('#fff1c9')); }
    // small lamps in a row on the far wall, right of the clock
    const lx = k.x + k.r + 9;
    if (!L.tight) for (let i = 0; i < 4 && lx + i * 6 + 14 < W; i++) { R(lx + i * 6 - 1, k.y + 3, 4, 4, c(P.trimLo)); R(lx + i * 6, k.y + 4, 2, 2, mix(P.screen, [P.lampGreen, P.strip, P.lampAmber, P.strip][i], 0.55)); }
    if (!L.tight && lx + 26 < W) { R(lx - 1, k.y - 5, Math.min(24, W - lx - 12), 5, c(P.trimLo)); R(lx, k.y - 4, Math.min(22, W - lx - 13), 3, c(P.wallHi)); }
    // on a wide wall: a shelf with books and a small plant, and a picture of the fells
    if (L.sign && pn.x - L.sign.x >= 76) {
      const sx = Math.round((L.sign.x + 12 + pn.x - 4) / 2) - 17, sy = pn.y + 1;
      R(sx, sy + 12, 34, 2, c(P.wood)); R(sx, sy + 12, 34, 1, c(P.woodHi)); R(sx + 3, sy + 14, 1, 3, c(P.woodLo)); R(sx + 30, sy + 14, 1, 3, c(P.woodLo));
      R(sx + 3, sy + 5, 2, 7, c(HUES.rose[0])); R(sx + 5, sy + 4, 2, 8, c(P.shell)); R(sx + 7, sy + 6, 3, 6, c(HUES.teal[1])); R(sx + 10, sy + 5, 2, 7, c(P.gold)); R(sx + 13, sy + 7, 2, 5, c(HUES.violet[0]));
      R(sx + 22, sy + 8, 6, 4, c(P.pot)); R(sx + 22, sy + 11, 6, 1, c(P.potLo)); R(sx + 24, sy + 3, 2, 5, c(P.leaf)); R(sx + 22, sy + 5, 2, 2, c(P.leafHi)); R(sx + 26, sy + 4, 2, 3, c(P.leafLo)); R(sx + 25, sy + 1, 1, 2, c(P.leafHi));
    }
    if (!L.tight && lx + 60 < W) {
      const px = lx + 32, py = k.y - 7;
      R(px - 1, py - 1, 24, 16, c(P.woodLo)); R(px, py, 22, 14, c(P.wood)); R(px + 1, py + 1, 20, 12, '#27406b'); R(px + 1, py + 1, 20, 4, '#31528a');
      R(px + 15, py + 3, 3, 3, '#ffd98a'); R(px + 3, py + 9, 9, 4, '#5e7fb8'); R(px + 5, py + 7, 5, 2, '#5e7fb8'); R(px + 6, py + 6, 3, 1, P.white); R(px + 7, py + 5, 1, 1, P.white);
      R(px + 10, py + 10, 10, 3, '#46639c'); R(px + 13, py + 8, 4, 2, '#46639c'); R(px + 14, py + 7, 2, 1, P.white); R(px + 1, py + 12, 20, 1, '#2f8a63');
    }
    // floor: slate plates with seams; the row under the wall is in shadow
    R(0, wh, W, H - wh, c(P.floor));
    for (let y = wh + 3, j = 0; y < H; y += 10, j++) for (let x = -11, i = 0; x < W; x += 20, i++) if (hash(i + seed, j) > 0.68) R(x + 1, y, 19, 9, c(P.floorB));
    for (let y = wh + 2; y < H; y += 10) { R(0, y, W, 1, c(P.floorSeam)); R(0, y + 1, W, 1, c(mix(P.floor, P.floorHi, 0.5))); }
    for (let x = 9; x < W; x += 20) R(x, wh + 2, 1, H - wh - 2, c(P.floorSeam));
    R(0, wh, W, 2, c(P.floorSeam));
    // the deck's emblem in the floor
    if (L.emblem) {
      const e = L.emblem, ec = c(mix(P.floorHi, '#8fa0d8', 0.35));
      ellipse(e.x, e.y, e.r + 4, Math.round(e.r / 2) + 1, ec, 0); ellipse(e.x, e.y, e.r, Math.round(e.r / 2) - 1, c(P.floorSeam), 0);
      R(e.x - 3, e.y, 7, 1, ec); R(e.x - 1, e.y - 1, 3, 3, ec); R(e.x, e.y - 2, 1, 5, ec);
    }
    // the lit lanes: from the gaps between the consoles to the main lane, on to the coffee, and to your desk
    const fl = c(P.floor), q = L.queue, gaps = [];
    L.consoles.forEach((cn) => { [cn.gl, cn.gr].forEach((x) => { if (gaps.indexOf(x) < 0) gaps.push(x); }); });
    gaps.sort((a, b) => a - b);
    const top = L.consoles.length ? L.consoles[0].yb - 9 : L.yL;
    gaps.forEach((x) => strip(x, top, x, L.yL, P.strip, fl));
    const gx0 = gaps.length ? gaps[0] : Math.round(W / 2), gx1 = gaps.length ? gaps[gaps.length - 1] : Math.round(W / 2);
    const qe = q.x0 + 9;
    strip(Math.min(gx0, qe), L.yL, Math.max(gx1, qe), L.yL, P.strip, fl);
    strip(16, L.yL, Math.min(gx0, qe), L.yL, P.stripWarm, fl);
    strip(qe, L.yL, qe, L.yQ + 2, P.strip, fl);
    strip(Math.min(qe, q.min - 6), L.yQ + 2, L.desk.x - 3, L.yQ + 2, P.strip, fl);
    gaps.concat([qe]).forEach((x) => R(x - 1, L.yL - 1, 3, 3, mix(fl, P.strip, 0.8)));
    // the coffee corner's rug (the lane runs under it)
    const g = L.rug;
    R(g.x + 1, g.y, g.w - 2, g.h, c(P.rugLo)); R(g.x, g.y + 1, g.w, g.h - 2, c(P.rugLo)); R(g.x + 1, g.y + 1, g.w - 2, g.h - 2, c(P.rug));
    R(g.x + 3, g.y + 2, g.w - 6, 1, c(P.rugHi)); R(g.x + 3, g.y + g.h - 3, g.w - 6, 1, c(P.rugHi));
    for (let x = g.x + 7; x < g.x + g.w - 8; x += 9) { const my = g.y + Math.floor(g.h / 2); R(x, my, 3, 1, c(P.rugHi)); R(x + 1, my - 1, 1, 3, c(P.rugHi)); }
    // chairs behind the consoles (a robot covers its chair when it sits) and soft shadows under the furniture
    L.consoles.forEach((cn, i) => {
      const hu = hues[i] || HUES.teal, x = cn.cx - 6, y = cn.yb - 27;
      R(x + 1, y, 10, 13, c(P.dark)); R(x, y + 1, 12, 12, c(P.dark)); R(x + 1, y + 1, 10, 11, c(P.metalLo)); R(x + 2, y + 2, 8, 2, c(mix(P.metalLo, hu[0], 0.55))); R(x + 2, y + 5, 8, 6, c(P.metal));
      R(cn.cx - Math.round(cn.w / 2) + 1, cn.yb, cn.w - 2, 2, c(P.floorSeam));
    });
    R(L.desk.x + 1, L.desk.yb, L.desk.w - 2, 2, c(P.floorSeam)); R(L.counter.x + 1, L.counter.yb, L.counter.w - 2, 2, c(P.floorSeam));
    // a rack of machines against the wall (its lights are drawn each frame)
    if (L.rack) { const rx = L.rack.x, ry = L.rack.yb; R(rx - 1, ry - 31, 22, 32, c(P.trimLo)); R(rx, ry - 30, 20, 30, c(P.metalLo)); R(rx, ry - 30, 20, 1, c(P.metalHi)); R(rx, ry - 30, 1, 30, c(P.metal));
      for (let j = 0; j < 4; j++) { R(rx + 2, ry - 27 + j * 7, 16, 5, c(P.dark)); R(rx + 12, ry - 25 + j * 7, 5, 1, c(P.metal)); }
      R(rx + 1, ry, 18, 2, c(P.floorSeam)); }
    // a floor lamp with a warm shade (wide plan only)
    if (L.lamp) { const fx = L.lamp.x, fy = L.lamp.y; R(fx - 3, fy - 1, 7, 2, c(P.dark)); R(fx - 2, fy - 2, 5, 1, c(P.metal)); R(fx, fy - 24, 1, 22, c(P.metalHi)); R(fx - 4, fy - 30, 9, 6, '#ffd98a'); R(fx - 3, fy - 31, 7, 1, '#ffe9b8'); R(fx - 4, fy - 25, 9, 1, '#e0a04a'); R(fx - 5, fy - 27, 1, 3, '#e0a04a'); R(fx + 5, fy - 27, 1, 3, '#e0a04a'); }
    // a neon mug on the wall over the coffee (wide plan only)
    if (L.sign) { const s = L.sign, n = P.stripWarm; R(s.x - 4, s.y, 7, 1, n); R(s.x - 4, s.y, 1, 6, n); R(s.x + 2, s.y, 1, 6, n); R(s.x - 4, s.y + 6, 7, 1, n); R(s.x + 3, s.y + 2, 2, 1, n); R(s.x + 4, s.y + 2, 1, 3, n); R(s.x + 3, s.y + 4, 2, 1, n);
      R(s.x - 2, s.y - 4, 1, 2, mix(c(P.wall), n, 0.6)); R(s.x, s.y - 5, 1, 3, mix(c(P.wall), n, 0.6)); }
    // a thin frame so the room has an edge on a dark page too
    R(0, 0, W, 1, c(P.trim)); R(0, H - 1, W, 1, c(P.trimLo)); R(0, 0, 1, H, c(P.trim)); R(W - 1, 0, 1, H, c(P.trim));
  };

  // ---------- furniture that robots can stand behind (drawn every frame, sorted by depth) ----------
  // an agent's console: a top with a keyboard, a front with a screen let into it and its owner's colour along the edge
  const drawConsole = (cn, hu, c, on) => {
    const w = cn.w, x = cn.cx - Math.round(w / 2), yb = cn.yb, P = PAL;
    R(x, yb - 14, w, 5, c(P.deskTop)); R(x, yb - 14, w, 1, c(P.deskHi)); R(x, yb - 14, 1, 5, c(P.deskHi)); R(x + w - 1, yb - 14, 1, 5, c(P.desk));
    R(cn.cx - 5, yb - 12, 10, 2, c(P.deskLo));
    R(x, yb - 9, w, 9, c(P.desk)); R(x, yb - 9, 1, 9, c(P.deskTop)); R(x + w - 1, yb - 9, 1, 9, c(P.deskLo)); R(x, yb - 1, w, 1, c(P.deskEdge));
    R(x, yb - 9, w, 1, on ? hu[0] : c(mix(P.desk, hu[1], 0.3)));
    R(x + 2, yb - 8, w - 4, 7, c(P.deskEdge)); R(x + 3, yb - 7, w - 6, 5, P.screen);
    R(x + w - 4, yb - 17, 1, 3, c(P.metalHi)); R(x + w - 6, yb - 21, 5, 5, c(P.dark));
    // something small of its own on each desk: a mug, a plant, a pile of paper, a pot of pens
    const k = cn.item | 0, ix = x + 2, iy = yb - 14;
    if (k === 0) { R(ix, iy - 3, 3, 3, c(hu[0])); R(ix + 3, iy - 2, 1, 1, c(hu[1])); R(ix, iy - 3, 3, 1, c('#5a3520')); }
    else if (k === 1) { R(ix, iy - 2, 3, 2, c(P.pot)); R(ix + 1, iy - 5, 1, 3, c(P.leaf)); R(ix, iy - 4, 1, 1, c(P.leafHi)); R(ix + 2, iy - 5, 1, 2, c(P.leafHi)); }
    else if (k === 2) { R(ix, iy - 2, 4, 2, c(P.paper)); R(ix, iy - 1, 4, 1, c(P.paperLo)); R(ix + 1, iy - 3, 3, 1, c(P.paper)); }
    else { R(ix, iy - 3, 3, 3, c(P.metalHi)); R(ix, iy - 5, 1, 2, c(HUES.rose[0])); R(ix + 2, iy - 6, 1, 3, c(P.gold)); }
  };
  // your desk: wider, a gold edge, a tray at the queue's end (the plate with "You" is drawn over its front)
  const drawDesk = (L, c) => {
    const d = L.desk, x = d.x, yb = d.yb, w = d.w, P = PAL;
    R(x, yb - 16, w, 6, c(mix(P.deskTop, P.gold, 0.10))); R(x, yb - 16, w, 1, c(P.deskHi)); R(x, yb - 16, 1, 6, c(P.deskHi)); R(x + w - 1, yb - 16, 1, 6, c(P.desk));
    R(x, yb - 10, w, 10, c(P.coat)); R(x, yb - 10, 2, 10, c(P.coatHi)); R(x + w - 2, yb - 10, 2, 10, c(P.deskEdge)); R(x, yb - 1, w, 1, c(P.deskEdge));
    R(x, yb - 10, w, 1, P.gold); R(x + 3, yb - 2, w - 6, 1, mix(c(P.coat), P.stripWarm, 0.7));
    R(x + 4, yb - 8, 1, 5, c(P.coatHi)); R(x + 6, yb - 8, 1, 5, c(P.coatHi)); R(x + w - 5, yb - 8, 1, 5, c(P.coatHi)); R(x + w - 7, yb - 8, 1, 5, c(P.coatHi));
    const t = L.tray;
    R(t.x - 1, t.y, 14, 2, c(P.metalLo)); R(t.x - 1, t.y - 1, 1, 2, c(P.metalHi)); R(t.x + 12, t.y - 1, 1, 2, c(P.metalHi)); R(t.x, t.y + 1, 12, 1, c(P.dark));
  };
  // the coffee counter: warm wood, the machine, a few mugs
  const drawCounter = (L, c) => {
    const k = L.counter, x = k.x, yb = k.yb, w = k.w, P = PAL;
    R(x, yb - 18, w, 6, c(P.woodHi)); R(x, yb - 18, w, 1, c(mix(P.woodHi, '#ffffff', 0.25))); R(x, yb - 13, w, 1, c(P.woodLo));
    R(x, yb - 12, w, 12, c(P.wood)); R(x, yb - 12, 1, 12, c(P.woodHi)); R(x + w - 1, yb - 12, 1, 12, c(P.woodLo)); R(x, yb - 1, w, 1, c(P.woodLo));
    for (let dx = Math.round(w / 2); dx < w - 2; dx += Math.round(w / 2)) R(x + dx, yb - 10, 1, 8, c(P.woodLo));
    R(x + 4, yb - 7, 2, 1, c(P.gold)); R(x + w - 6, yb - 7, 2, 1, c(P.gold));
    // the machine
    const mx = x + 3, my = yb - 32;
    R(mx, my, 13, 15, c(P.dark)); R(mx + 1, my + 1, 11, 4, c(P.metal)); R(mx + 1, my + 1, 11, 1, c(P.metalHi)); R(mx + 2, my + 6, 9, 8, c(P.ink));
    R(mx + 5, my + 6, 3, 2, c(P.metalHi)); R(mx + 4, my + 10, 5, 4, c(P.shell)); R(mx + 9, my + 11, 1, 2, c(P.shell)); R(mx + 4, my + 10, 5, 1, c('#6b4630'));
    R(mx + 10, my + 2, 2, 2, P.lampAmber);
    // mugs, and (narrow plan) a small plant on the counter
    if (w >= 34) { R(x + 19, yb - 22, 4, 4, c(P.shell)); R(x + 23, yb - 21, 1, 2, c(P.shell)); R(x + 25, yb - 22, 4, 4, c(HUES.rose[0])); R(x + 29, yb - 21, 1, 2, c(HUES.rose[0])); R(x + 19, yb - 22, 4, 1, c(P.shellLo)); R(x + 25, yb - 22, 4, 1, c(HUES.rose[1])); }
    if (w >= 44) { R(x + 34, yb - 23, 6, 5, c(P.shellMid)); R(x + 35, yb - 25, 4, 2, c(HUES.teal[1])); }
    if (!L.side) { const px = x + w - 8; R(px, yb - 21, 5, 3, c(P.pot)); R(px, yb - 19, 5, 1, c(P.potLo)); R(px + 2, yb - 25, 1, 4, c(P.leafLo)); R(px, yb - 26, 2, 3, c(P.leaf)); R(px + 3, yb - 27, 2, 4, c(P.leafHi)); R(px - 1, yb - 24, 1, 2, c(P.leaf)); R(px + 5, yb - 25, 1, 2, c(P.leaf)); }
  };
  // a floor plant; its leaves move a little (phase 0 or 1)
  const drawPlant = (p, c, ph) => {
    const x = p.x, y = p.y, P = PAL, s = ph ? 1 : 0;
    R(x - 4, y - 7, 9, 7, c(P.pot)); R(x - 5, y - 8, 11, 2, c(mix(P.pot, '#ffffff', 0.18))); R(x - 4, y - 2, 9, 2, c(P.potLo)); R(x + 3, y - 6, 1, 4, c(P.potLo));
    R(x, y - 16, 1, 8, c(P.leafLo));
    R(x - 4 - s, y - 15, 4, 2, c(P.leaf)); R(x - 6 - s, y - 13, 3, 2, c(P.leaf)); R(x - 5 - s, y - 14, 2, 1, c(P.leafHi));
    R(x + 1 + s, y - 17, 4, 2, c(P.leafHi)); R(x + 3 + s, y - 15, 4, 2, c(P.leaf)); R(x + 5 + s, y - 13, 2, 2, c(P.leafLo));
    R(x - 2, y - 20 + s, 3, 4, c(P.leaf)); R(x - 1, y - 22 + s, 2, 2, c(P.leafHi)); R(x - 3, y - 11, 2, 2, c(P.leafLo)); R(x + 1, y - 11, 3, 2, c(P.leaf));
  };

  // ---------- the robots ----------
  // Compact and a little angular: a light shell head with a dark visor and two glowing eyes, a body in the agent's
  // own colour, dark limbs. Each `look` changes the outline: headset (ear cups and a mic), gavel (a small hammer for
  // an arm), antenna (a mast with a ball), bulb (a glass dome for a head), clipboard (carries a board), plain.
  // (cx, fy) is the middle of the feet on the floor. `p` is the pose:
  //   dir -1/0/1 (which way it looks), walk -1 or phase 0..3, vert (walking up or down), back (seen from behind),
  //   arm 'down' | 'up' (holds a slip up) | 'mug' | 'desk' (hands are on a console), eyes 'open' | 'blink' | 'shut' |
  //   'x' | 'down' | 'up', hy (head dropped by so many pixels), dim (lights low), tip (antenna / lamp phase), tap.
  const drawRobot = (cx, fy, a, p, c) => {
    const P = PAL, hu = a.hu, look = a.look, dir = p.dir | 0, ph = p.walk, moving = ph >= 0;
    const q = (x, y, w, h, col) => { if (h > 0 && w > 0) R(cx + x, fy + y, w, h, col); };
    const bob = moving && (ph & 1) ? 1 : 0, B = -bob + (p.dy | 0), H = B + (p.hy | 0), hx = p.hx | 0;
    const shell = c(P.shell), shMid = c(P.shellMid), shLo = c(P.shellLo), joint = c(P.joint), jHi = c(P.jointHi), main = c(hu[0]), dark = c(hu[1]);
    const glow = p.dim ? mix(hu[0], '#6c7391', 0.45) : hu[2];
    // legs and feet
    let lx = 0, rx = 0, ll = 0, rl = 0;
    if (moving) {
      if (p.vert) { if (ph === 0) ll = 2; else if (ph === 2) rl = 2; }
      else if (ph === 0) { lx = -1; rx = 1; if (dir > 0) ll = 1; else rl = 1; }
      else if (ph === 2) { lx = -1; rx = 1; if (dir > 0) rl = 1; else ll = 1; }
      else { lx = 1; rx = -1; }
    }
    q(-4 + lx, -5 + B, 2, 3 - ll - B, joint); q(2 + rx, -5 + B, 2, 3 - rl - B, joint);
    q(-5 + lx + dir, -2 - ll, 4, 2, shMid); q(1 + rx + dir, -2 - rl, 4, 2, shMid);
    q(-5 + lx + dir, -2 - ll, 4, 1, shell); q(1 + rx + dir, -2 - rl, 4, 1, shell);
    // body
    q(-5, -11 + B, 10, 6, main); q(4, -11 + B, 1, 6, dark); q(-5, -6 + B, 10, 1, dark); q(-5, -11 + B, 9, 1, c(mix(hu[0], hu[2], 0.45)));
    if (p.back) q(-3, -10 + B, 6, 3, shMid); else { q(-3, -9 + B, 4, 2, shell); q(-1, -9 + B, 1, 1, p.dim ? dark : hu[2]); }
    q(-2, -12 + B, 4, 1, joint);
    // the arm on our right does the work: down, raised with a slip, bent with a mug, or forward onto a desk
    const swing = moving ? (ph === 0 ? 1 : ph === 2 ? -1 : 0) : 0;
    if (p.arm === 'up') {
      const ax = look === 'headset' ? 8 : 7, top = -24 + B - (p.lift | 0);
      q(5, -11 + B, 2, 2, dark); q(7, -11 + B, ax - 5, 1, joint); q(ax, top + 2, 2, -11 + B - top - 2, joint); q(ax, top, 2, 2, shell);
    } else if (p.arm === 'mug') {
      q(5, -11 + B, 2, 1, dark);
      if (p.sip) { // the mug at the visor
        q(5, -10 + B, 2, 1, joint); q(6, -13 + B, 2, 3, joint);
        q(1, -17 + B, 5, 5, main); q(1, -13 + B, 5, 1, dark); q(6, -16 + B, 1, 3, dark); q(1, -15 + B, 5, 1, c(hu[2])); q(0, -15 + B, 1, 2, shell);
      } else {     // held out at the side: a white mug with a band in the robot's colour
        q(5, -10 + B, 2, 2, joint); q(7, -9 + B, 1, 1, joint); q(7, -11 + B, 1, 2, shell);
        q(8, -13 + B, 5, 5, main); q(8, -9 + B, 5, 1, dark); q(13, -12 + B, 1, 3, dark); q(9, -13 + B, 3, 1, c('#5a3520')); q(8, -11 + B, 5, 1, c(hu[2]));
      }
    } else if (p.arm === 'desk') { q(5, -11 + B, 2, 1, dark); q(5, -10 + B, 2, 3, joint); }
    else { q(5, -11 + B, 2, 1, dark); q(5, -10 + B, 2, 3 - (swing < 0 ? 1 : 0), joint); q(5, -7 + B - (swing < 0 ? 1 : 0), 2, 2, shell); }
    // head
    if (look === 'bulb') {
      const glass = p.dim ? mix(hu[2], '#7d84a3', 0.62) : mix(hu[2], hu[0], 0.22), shade = mix(glass, hu[0], 0.6);
      q(-2 + hx, -24 + H, 4, 1, glass); q(-4 + hx, -23 + H, 8, 1, glass); q(-5 + hx, -22 + H, 10, 1, glass); q(-6 + hx, -21 + H, 12, 6, glass);
      q(-5 + hx, -15 + H, 10, 1, glass); q(-4 + hx, -14 + H, 8, 1, shade); q(5 + hx, -21 + H, 1, 6, shade); q(4 + hx, -22 + H, 1, 1, shade); q(4 + hx, -15 + H, 1, 1, shade);
      q(-3 + hx, -13 + H, 6, 1, jHi); q(-4 + hx, -22 + H, 1, 2, P.white); q(-3 + hx, -23 + H, 2, 1, P.white);
      if (!p.back) {
        const ex = dir * 2, ey = -19 + H + (p.eyes === 'down' ? 1 : p.eyes === 'up' ? -1 : 0), ink = P.ink;
        if (p.eyes === 'blink' || p.eyes === 'shut') { q(-3 + ex + hx, ey + 1, 2, 1, ink); q(1 + ex + hx, ey + 1, 2, 1, ink); }
        else if (p.eyes === 'x') { q(-3 + ex + hx, ey, 2, 2, P.lampRed); q(1 + ex + hx, ey, 2, 2, P.lampRed); }
        else { q(-3 + ex + hx, ey, 2, 2, ink); q(1 + ex + hx, ey, 2, 2, ink); }
        if (!p.dim) { q(-1 + hx, -22 + H, 1, 1, hu[1]); q(0 + hx, -21 + H, 1, 1, hu[1]); q(1 + hx, -22 + H, 1, 1, hu[1]); }
      }
    } else {
      q(-5 + hx, -21 + H, 10, 1, shell); q(-6 + hx, -20 + H, 12, 7, shell); q(5 + hx, -20 + H, 1, 7, shMid); q(-6 + hx, -14 + H, 12, 1, shMid); q(-5 + hx, -13 + H, 10, 1, shLo);
      if (p.back) { q(-3 + hx, -18 + H, 6, 1, shLo); q(-3 + hx, -16 + H, 6, 1, shLo); q(-1 + hx, -20 + H, 2, 1, main); }
      else {
        const vx = -5 + (dir < 0 ? -1 : dir > 0 ? 1 : 0) + hx, ex = dir * 2, ey = -17 + H + (p.eyes === 'down' ? 1 : p.eyes === 'up' ? -1 : 0);
        q(vx, -18 + H, 10, 4, P.ink); q(vx, -18 + H, 3, 1, '#273257'); q(-1 + hx, -20 + H, 2, 1, main);
        if (p.eyes === 'blink') { q(-3 + ex + hx, ey + 1, 2, 1, hu[0]); q(1 + ex + hx, ey + 1, 2, 1, hu[0]); }
        else if (p.eyes === 'shut') { q(-4 + ex + hx, ey + 1, 3, 1, hu[1]); q(1 + ex + hx, ey + 1, 3, 1, hu[1]); }
        else if (p.eyes === 'x') { const r = P.lampRed, y0 = -18 + H; q(-4 + ex + hx, y0, 1, 1, r); q(-2 + ex + hx, y0, 1, 1, r); q(-3 + ex + hx, y0 + 1, 1, 1, r); q(-4 + ex + hx, y0 + 2, 1, 1, r); q(-2 + ex + hx, y0 + 2, 1, 1, r);
          q(1 + ex + hx, y0, 1, 1, r); q(3 + ex + hx, y0, 1, 1, r); q(2 + ex + hx, y0 + 1, 1, 1, r); q(1 + ex + hx, y0 + 2, 1, 1, r); q(3 + ex + hx, y0 + 2, 1, 1, r); }
        else { q(-3 + ex + hx, ey, 2, 2, glow); q(1 + ex + hx, ey, 2, 2, glow); }
      }
    }
    // what makes each look its own outline
    if (look === 'headset') {
      q(-5 + hx, -22 + H, 10, 1, joint); q(-8 + hx, -19 + H, 2, 5, main); q(6 + hx, -19 + H, 2, 5, main); q(-8 + hx, -15 + H, 2, 1, dark); q(7 + hx, -19 + H, 1, 5, dark);
      if (!p.back) { const s = dir > 0 ? 1 : -1; q(s > 0 ? 7 + hx : -8 + hx, -14 + H, 1, 2, joint); q(s > 0 ? 4 + hx : -7 + hx, -13 + H, 3, 1, joint); q(s > 0 ? 3 + hx : -4 + hx, -13 + H, 1, 1, hu[2]); }
    } else if (look === 'antenna') {
      q(-3 + hx, -25 + H, 1, 4, jHi); q(-4 + hx, -27 + H, 3, 2, p.tip ? hu[2] : hu[0]); q(1 + hx, -22 + H, 3, 1, jHi);
    } else if (look === 'plain') {
      q(-7 + hx, -18 + H, 1, 3, jHi); q(6 + hx, -18 + H, 1, 3, jHi); q(-3 + hx, -22 + H, 6, 1, shMid);
    } else if (look === 'gavel' || look === 'clipboard') { q(-2 + hx, -22 + H, 4, 1, look === 'gavel' ? dark : shMid); }
    // the arm on our left carries what the look carries: a gavel, a clipboard, or nothing
    if (look === 'gavel') {
      const g = p.tap | 0;
      q(-7, -11 + B, 2, 1, dark); q(-7, -10 + B, 2, 2, joint); q(-9, -9 + B, 3, 2, shell);
      q(-9, -16 + B + g, 1, 7 - g, c(P.woodHi)); q(-12, -20 + B + g, 6, 4, c(P.wood)); q(-12, -20 + B + g, 1, 4, c(P.gold)); q(-7, -20 + B + g, 1, 4, c(P.gold)); q(-11, -20 + B + g, 4, 1, c(P.woodHi));
    } else if (look === 'clipboard') {
      q(-7, -11 + B, 2, 1, dark);
      q(-11, -12 + B, 7, 9, c(P.wood)); q(-10, -11 + B, 5, 7, c(P.paper)); q(-9, -13 + B, 3, 2, jHi); q(-9, -9 + B, 3, 1, c(P.paperLo)); q(-9, -7 + B, 3, 1, c(P.paperLo)); q(-9, -5 + B, 2, 1, main);
    } else if (p.arm === 'desk') { q(-7, -11 + B, 2, 1, dark); q(-7, -10 + B, 2, 3, joint); }
    else { q(-7, -11 + B, 2, 1, dark); q(-7, -10 + B, 2, 3 - (swing > 0 ? 1 : 0), joint); q(-7, -7 + B - (swing > 0 ? 1 : 0), 2, 2, shell); }
  };

  // ---------- you: a plain figure at the big desk (no guess at looks: a pale round head, a dark coat) ----------
  const drawYou = (x, yb, c, eyes, look, lean) => {
    const P = PAL, coat = c(P.jacket), hi = c(P.jacketHi), skin = c(P.skin), lo = c(P.skinLo), hy = lean | 0;
    // the chair's high back
    R(x - 8, yb - 42, 16, 22, c(P.dark)); R(x - 9, yb - 40, 18, 20, c(P.dark)); R(x - 7, yb - 41, 14, 20, c(P.metalLo)); R(x - 7, yb - 41, 14, 1, c(P.gold)); R(x - 6, yb - 39, 12, 6, c(P.metal)); R(x - 8, yb - 40, 1, 19, c(P.metal));
    // shoulders and coat
    R(x - 6, yb - 29, 12, 1, coat); R(x - 7, yb - 28, 14, 8, coat); R(x + 6, yb - 28, 1, 8, c(P.jacketLo)); R(x - 7, yb - 28, 1, 8, hi);
    R(x - 1, yb - 29, 2, 4, c(P.shell)); R(x - 3, yb - 29, 2, 3, hi); R(x + 1, yb - 29, 2, 3, hi); R(x + 3, yb - 26, 2, 2, P.gold);
    // neck and head
    R(x - 1, yb - 31 + hy, 3, 2, lo);
    R(x - 3, yb - 39 + hy, 6, 1, skin); R(x - 4, yb - 38 + hy, 8, 6, skin); R(x - 3, yb - 32 + hy, 6, 1, lo); R(x + 3, yb - 38 + hy, 1, 6, lo);
    const ex = look | 0;
    if (eyes === 'blink') { R(x - 3 + ex, yb - 35 + hy, 2, 1, c(P.dark)); R(x + ex, yb - 35 + hy, 2, 1, c(P.dark)); }
    else { R(x - 2 + ex, yb - 36 + hy, 1, 2, P.ink); R(x + 1 + ex, yb - 36 + hy, 1, 2, P.ink); }
  };
  // his hands on the desk (drawn after the desk): a pen in one, a mug by the other
  const drawYouHands = (x, yb, c, scribble, sip) => {
    const P = PAL;
    R(x - 8, yb - 20, 3, 2, c(P.jacket)); R(x - 7 + (scribble | 0), yb - 18, 2, 2, c(P.skin)); R(x - 5 + (scribble | 0), yb - 19, 1, 3, c(P.gold));
    R(x + 5, yb - 20, 3, 2, c(P.jacket)); R(x + 5, yb - 18 - (sip ? 5 : 0), 2, 2, c(P.skin));
    const my = yb - 20 - (sip ? 6 : 0);
    R(x + 8, my, 4, 4, c(P.shell)); R(x + 12, my + 1, 1, 2, c(P.shellMid)); R(x + 8, my + 3, 4, 1, c(P.shellMid)); R(x + 9, my, 2, 1, c('#6b4630'));
  };

  // ---------- one scene ----------
  const zoneOf = (st) => (st === 'needs' ? 'queue' : st === 'idle' ? 'galley' : st === 'unknown' ? 'out' : 'desk');
  const create = (canvas, opts) => {
    opts = opts || {};
    const nowFn = typeof opts.now === 'function' ? opts.now : () => Date.now();
    const still = !!opts.reducedMotion;
    const onHover = typeof opts.onHover === 'function' ? opts.onHover : () => {};
    const onPick = typeof opts.onPick === 'function' ? opts.onPick : () => {};
    const seed = (Math.floor(num(opts.seed, 1)) | 0) || 1;
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    let dpr = 1, K = 2, u = 2, cssW = 0, cssH = 0, W = 200, H = 150, L = null, sized = false, dead = false;
    let agents = [], byId = Object.create(null), queue = [];
    const papers = [], ghosts = [];
    let simT = 0, lastT = null, focusId = null, hoverId = null, dirty = true, trayBump = -1e9, total = 0, sheets = 0;
    let cache = null, cctx = null, cacheKey = '', sky = skyAt(nowFn()), lm = [1, 1, 1], sm = [1, 1, 1];
    const litMemo = new Map(), softMemo = new Map(), textW = new Map(), gapAt = new Map();
    const lit = (hex) => { let v = litMemo.get(hex); if (v === undefined) { const c = rgb(hex); v = toHex([c[0] * lm[0], c[1] * lm[1], c[2] * lm[2]]); litMemo.set(hex, v); } return v; };
    const soft = (hex) => { let v = softMemo.get(hex); if (v === undefined) { const c = rgb(hex); v = toHex([c[0] * sm[0], c[1] * sm[1], c[2] * sm[2]]); softMemo.set(hex, v); } return v; };

    // ----- where things are -----
    const seatPos = (a) => { const cn = L.consoles[a.idx]; return cn ? { x: cn.cx, y: cn.yb - 7 } : { x: 20, y: L.yL }; };
    const slotPos = (a) => L.slots[clamp(a.slot, 0, L.slots.length - 1)];
    const freeSlot = (me) => { for (let i = 0; i < L.slots.length; i++) if (!agents.some((b) => b !== me && b.present && b.goal === 'galley' && b.slot === i)) return i; return 0; };
    const dropFromQueue = (a) => { const i = queue.indexOf(a.id); if (i >= 0) queue.splice(i, 1); };
    const queueSpot = (a) => { const i = queue.indexOf(a.id); return i < 0 ? L.queue.x0 : queueX(L, i, queue.length); };
    const faceAt = (a) => { a.vert = false; a.back = false; a.dir = a.node === 'queue' ? 1 : a.node === 'galley' ? (a.slot % 3 === 1 ? 1 : a.slot % 3 === 2 ? -1 : 0) : 0; };
    // the line at your desk: those in it keep their places; newcomers join behind them, the one whose console is
    // nearest your desk first, so the line stands in the order of the consoles and nobody walks through anybody
    const joinQueue = () => {
      const fresh = agents.filter((a) => a.present && a.goal === 'queue' && queue.indexOf(a.id) < 0);
      const cx = (a) => (L && L.consoles[a.idx] ? L.consoles[a.idx].cx : a.idx);
      fresh.sort((a, b) => (cx(b) - cx(a)) || (b.idx - a.idx));
      fresh.forEach((a) => queue.push(a.id));
    };

    // put an agent at its goal at once (reduced motion, or after the room changed shape)
    const settle = (a) => {
      a.legs = []; a.wait = 0;
      if (a.goal === 'queue') { if (queue.indexOf(a.id) < 0) queue.push(a.id); a.node = 'queue'; a.x = queueSpot(a); a.y = L.yQ; }
      else if (a.goal === 'galley') { if (a.slot < 0) a.slot = freeSlot(a); const s = slotPos(a); a.node = 'galley'; a.x = s.x; a.y = s.y; }
      else { const s = seatPos(a); a.node = 'seat'; a.x = s.x; a.y = s.y; }
      faceAt(a);
    };
    // the legs of a walk from where the agent is to its goal: out through a gap between the consoles, along the
    // main lane, then down to its place (or back up through a gap to its chair)
    const plan = (a) => {
      const legs = [], cn = L.consoles[a.idx] || { cx: a.x, yb: a.y + 7, gl: a.x, gr: a.x };
      let from = a.node, fx = a.x;
      if (a.legs.length) {
        const cur = a.legs[0];
        if (a.y === L.yL && (cur.seek || cur.n === 'lane')) from = 'lane';   // on the main lane: it can turn here
        else if (cur.slot || cur.seek) from = 'queue';                         // on its way into the line: back up to the lane
        else { legs.push(cur); from = cur.n; fx = cur.x; }                     // finish the leg under way first
      }
      const sy = cn.yb - 7;
      // between the line and a standing spot beside the counter there is open floor: straight across
      if (!legs.length && a.goal === 'galley' && from === 'queue' && slotPos(a).low && a.y > L.yL + 30) { const sl = slotPos(a); a.legs = [{ x: sl.x, y: a.y, n: 'queue' }, { x: sl.x, y: sl.y, n: 'galley' }]; return; }
      if (!legs.length && a.goal === 'queue' && from === 'galley' && a.y > L.yL + 30) { a.legs = [{ x: a.x, y: L.yQ, n: 'queue' }, { slot: 1, n: 'queue' }]; return; }
      if (a.goal === 'desk' && (from === 'seat' || from === 'behind')) { if (from === 'behind' || a.x !== cn.cx) legs.push({ x: cn.cx, y: sy, n: 'seat' }); a.legs = legs; return; }
      if (from === 'seat' || from === 'behind') {
        const tx = a.goal === 'galley' ? slotPos(a).x : queueSpot(a);
        const gx = from === 'behind' ? fx : (tx < cn.cx ? cn.gl : cn.gr);
        if (from === 'seat') { // one robot at a time through a gap: the next waits until the one before is clear
          const t0 = simT + Math.max(0, a.wait), free = gapAt.get(gx) || 0;
          if (t0 < free) a.wait = free - simT;
          gapAt.set(gx, simT + Math.max(0, a.wait) + 480);
          legs.push({ x: gx, y: sy, n: 'behind' });
        }
        legs.push({ x: gx, y: L.yL, n: 'lane' }); fx = gx;
      } else if (from !== 'lane') legs.push({ x: fx, y: L.yL, n: 'lane' });
      if (a.goal === 'desk') { const gx = Math.abs(fx - cn.gl) <= Math.abs(fx - cn.gr) ? cn.gl : cn.gr; legs.push({ x: gx, y: L.yL, n: 'lane' }, { x: gx, y: sy, n: 'behind' }, { x: cn.cx, y: sy, n: 'seat' }); }
      else if (a.goal === 'galley') { const s = slotPos(a); legs.push({ x: s.x, y: L.yL, n: 'lane' }, { x: s.x, y: s.y, n: 'galley' }); }
      else if (a.goal === 'queue') legs.push({ seek: 1, n: 'lane' }, { slot: 1, n: 'queue' });
      a.legs = legs;
    };
    // a new state: where the agent belongs now (the walk is planned once the whole crew is known)
    const aim = (a, delay) => {
      const z = zoneOf(a.state);
      if (z === 'out') { // it leaves the room: a short beam of light where it stood
        if (a.present && L && !still) ghosts.push({ x: Math.round(a.x), y: Math.round(a.y + a.oy), t0: simT, hu: a.hu });
        a.present = false; a.goal = 'out'; a.legs = []; a.slot = -1; a.say = null; a.todo = false; dropFromQueue(a); return;
      }
      if (!a.present) { a.present = true; a.node = 'seat'; a.goal = 'desk'; a.legs = []; a.slot = -1; a.pop = simT; if (L) { const s = seatPos(a); a.x = s.x; a.y = s.y; } faceAt(a); }
      if (a.goal === z) return;
      if (a.goal === 'queue') dropFromQueue(a);
      a.slot = -1; a.goal = z; a.todo = true;
      if (!still) a.wait = Math.max(a.wait, delay || 0);
    };
    const go = (a) => {
      a.todo = false;
      if (!L || !a.present) return;
      if (a.goal === 'galley' && a.slot < 0) a.slot = freeSlot(a);
      if (still) settle(a); else plan(a);
    };
    const newAgent = (id, i) => ({ id, idx: i, name: '', look: 'plain', hueName: 'teal', hu: HUES.teal, state: 'unknown', waiting: 0, step: '', fresh: 0, known: false, todo: false,
      present: false, goal: 'out', node: 'seat', legs: [], slot: -1, wait: 0, x: 0, y: 0, dir: 0, vert: false, back: false, moving: false, walked: 0, tag: null, slip: null,
      r: rng(seed * 7919 + (i + 1) * 104729), blinkAt: 600 + i * 370, glanceAt: 2400 + i * 610, swayAt: 3000 + i * 450, sipAt: 3500 + i * 700, sway: 0, say: null, pop: -1e9, slipAt: -1e9, oy: 0, far: 0, was: null, note: '' });

    // The scale and the plan for this width and this crew. One logical pixel is a whole number K of device pixels
    // (crisp), about 2 css px and a little more on a very wide page; K steps down when the room would get too tall
    // or too narrow for a row of consoles. Sets the canvas' size.
    const fit = () => {
      const dw = Math.max(1, Math.round(cssW * dpr)), n = agents.length, limit = n === 8 ? 440 : 380;
      let k = Math.max(1, Math.round((cssW >= 1100 ? 2.5 : 2) * dpr));
      while (k > 1 && k / dpr > 2.51) k--;
      while (k / dpr < 1.5 && (k + 1) / dpr <= 2.51) k++;
      for (;;) {
        K = k; u = K / dpr; W = Math.max(150, Math.ceil(dw / K));
        textFont();
        let tagW = 0; agents.forEach((a) => { tagW = Math.max(tagW, tagWidth(a.name)); });
        L = layout(W, n, u, n > 5 || tagW > SP - 1, tagW); H = L.H;
        if ((H * u <= limit + 0.01 && dw / k >= 178) || k <= 1 || (k - 1) / dpr < 1.25) break;
        k--;
      }
      if (canvas.width !== dw) canvas.width = dw;
      if (canvas.height !== H * K) canvas.height = H * K;
      cssH = H * K / dpr;
      if (canvas.style) { canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px'; }
      cacheKey = ''; gapAt.clear();
    };
    const relayout = () => {
      fit();
      const keep = queue.slice(); queue = [];
      keep.forEach((id) => { const a = byId[id]; if (a && a.present && a.goal === 'queue') queue.push(id); });
      agents.forEach((a, i) => { a.idx = i; });
      joinQueue();
      agents.forEach((a) => {
        a.todo = false;
        if (!a.present) return;
        if (a.goal === 'galley' && a.slot < 0) a.slot = freeSlot(a);
        if (a.node === 'seat' && !still) { const s = seatPos(a); a.x = s.x; a.y = s.y; a.legs = []; if (a.goal !== 'desk') plan(a); faceAt(a); }
        else settle(a);
      });
      agents.forEach((a) => { if (a.present && a.node === 'queue' && !a.legs.length) a.x = queueSpot(a); });
    };

    const setCrew = (list) => {
      const arr = Array.isArray(list) ? list.filter((m) => m && m.id != null) : [];
      const seen = Object.create(null), next = [];
      let shape = false;
      arr.forEach((m) => {
        const id = String(m.id); if (seen[id]) return; seen[id] = 1;
        let a = byId[id];
        if (!a) { a = newAgent(id, next.length); byId[id] = a; shape = true; }
        if (a.idx !== next.length) shape = true;
        const hueName = HUES[m.hue] ? m.hue : 'teal', look = LOOKS[m.look] ? m.look : 'plain', st = STATES[m.state] ? m.state : 'unknown';
        const name = String(m.name == null ? '' : m.name).slice(0, 16);
        if (a.hueName !== hueName || a.name !== name) cacheKey = '';
        if (a.name !== name && tagWidth(name) > SP - 1) shape = true;
        a.name = name; a.look = look; a.hueName = hueName; a.hu = HUES[hueName];
        const waiting = Math.max(0, Math.floor(num(+m.waiting, 0)));
        if (a.known && waiting !== a.waiting) a.slipAt = simT;   // the number on its slip changed: the slip hops
        a.waiting = waiting; a.step = String(m.step == null ? '' : m.step).slice(0, 32);
        const fresh = num(+m.fresh, 0);
        if (a.known && fresh > a.fresh && !still && L && st !== 'unknown') flyPaper(a);
        a.fresh = fresh;
        a.was = a.known ? a.state : null; a.state = st; a.note = String(m.bubble == null ? '' : m.bubble).slice(0, 32);
        next.push(a);
      });
      agents.forEach((a) => { if (!seen[a.id]) { dropFromQueue(a); delete byId[a.id]; shape = true; } });
      agents = next;
      const n = agents.length, queueBound = agents.some((a) => a.state === 'needs');
      agents.forEach((a, i) => {
        const first = !a.known, changed = a.was !== a.state;
        a.idx = i; a.known = true;
        if (!first && !changed) return;
        // on the first crew the robots get up one after another: those bound for your desk first (the nearest to it
        // leads), then the ones off to the coffee, who would otherwise walk against the stream
        aim(a, first ? 160 + (a.state === 'needs' ? n - 1 - i : i) * 160 + (a.state === 'idle' ? (queueBound ? 1500 : 300) : 0) : 140 + (i % 3) * 110);
        // say the model's short words once: on a change; on the first crew only when the agent is at its desk
        const at = simT + (first ? 600 + i * 320 : 200);
        const fromNowhere = first || a.was === 'unknown';   // it has just come into the room: the slip or the coffee says enough
        if (a.note && !still && a.present && (!fromNowhere || a.goal === 'desk') && a.state !== 'working') a.say = { text: a.note, from: at, until: at + 4200 };
        else if (changed) a.say = null;
      });
      joinQueue();
      if (shape && sized) relayout();
      // when several set off at once, the one in front (in the direction they go) leaves first, so nobody has to
      // walk through anybody
      const movers = agents.filter((a) => a.todo && a.present && L && !still);
      if (movers.length > 1 && !movers.some((a) => a.node === 'seat')) {
        movers.forEach((a) => { if (a.goal === 'galley' && a.slot < 0) a.slot = freeSlot(a); const tx = a.goal === 'galley' ? slotPos(a).x : a.goal === 'queue' ? queueSpot(a) : seatPos(a).x; a.far = tx < a.x ? a.x : -a.x; });
        movers.slice().sort((a, b) => (a.far - b.far) || (a.idx - b.idx)).forEach((a, k) => { a.wait = 120 + k * 260; });
      }
      agents.forEach((a) => { if (a.todo) go(a); });
      if (still && L) agents.forEach((a) => { if (a.present && a.node === 'queue') a.x = queueSpot(a); });
      total = 0; agents.forEach((a) => { if (a.present && a.state === 'needs') total += a.waiting; });
      dirty = true;
      if (shape && sized && lastT != null) render();   // the room may have changed height, which wipes the canvas: draw it again at once
      if (still && started) ask();
    };

    // a paper slip flies from an agent's console to your tray
    const flyPaper = (a) => {
      const cn = L.consoles[a.idx]; if (!cn) return;
      papers.push({ x0: cn.cx, y0: cn.yb - 16, t0: simT + 200, dur: 950, hu: a.hu });
    };

    // ----- time -----
    // is another robot walking the same way just ahead on the main lane?
    const blocked = (a, sg) => {
      for (let i = 0; i < agents.length; i++) { const b = agents[i]; if (b === a || !b.present || b.y !== L.yL || !b.legs.length || b.wait > 0 || b.vert || b.dir !== sg) continue; const gap = (b.x - a.x) * sg; if (gap > 0 && gap < 24) return true; }
      return false;
    };
    const walk = (a, d) => {
      let guard = 0;
      while (d > 0.0001 && a.legs.length && guard++ < 8) {
        const leg = a.legs[0]; let tx, ty, vfirst = false;
        if (leg.seek) { if (queue.indexOf(a.id) < 0) { a.legs.shift(); continue; } tx = queueSpot(a); ty = L.yL; }
        else if (leg.slot) { if (queue.indexOf(a.id) < 0) { a.legs.shift(); continue; } tx = queueSpot(a); ty = L.yQ; vfirst = true; }
        else { tx = leg.x; ty = leg.y; }
        const dx = tx - a.x, dy = ty - a.y;
        if (Math.abs(dy) > 0.001 && (vfirst || Math.abs(dx) <= 0.001)) { const m = Math.min(d, Math.abs(dy)); a.y += (dy > 0 ? m : -m); d -= m; a.vert = true; a.back = dy < 0; a.dir = 0; a.walked += m; a.moving = true; }
        else if (Math.abs(dx) > 0.001) {
          const sg = dx > 0 ? 1 : -1;
          if (a.y === L.yL && blocked(a, sg)) { a.dir = sg; a.vert = false; a.back = false; break; }   // on the lane: keep a step behind the one in front
          const m = Math.min(d, Math.abs(dx)); a.x += sg * m; d -= m; a.vert = false; a.back = false; a.dir = sg; a.walked += m; a.moving = true;
        }
        if (Math.abs(tx - a.x) <= 0.001 && Math.abs(ty - a.y) <= 0.001) { a.x = tx; a.y = ty; a.node = leg.n; a.legs.shift(); }
      }
      if (!a.legs.length) faceAt(a);
    };
    const step = (dt) => {
      simT += dt;
      if (still || !L) return;
      const v = 54 * clamp(W / 380, 1, 1.5) * dt / 1000;
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i]; if (!a.present) continue;
        a.moving = false;
        if (a.wait > 0) a.wait -= dt;
        else if (a.legs.length) walk(a, v);
        else if (a.node === 'queue' && Math.abs(a.x - queueSpot(a)) > 0.5) { a.legs.push({ slot: 1, n: 'queue' }); walk(a, v * 0.7); }
        a.oy = a.moving && !a.vert && a.y === L.yL ? (a.dir < 0 ? -3 : 2) : 0;   // keep to one side of the main lane: two robots can pass
        // the small things a robot does while it stands: blink, glance, shift its weight, sip
        if (simT >= a.blinkAt + 140) a.blinkAt = simT + 1300 + a.r() * 3800;
        if (simT >= a.glanceAt + 900) a.glanceAt = simT + 2600 + a.r() * 5200;
        if (simT >= a.swayAt + 1100) { a.swayAt = simT + 2200 + a.r() * 4200; a.sway = a.r() < 0.5 ? -1 : 1; }
        if (simT >= a.sipAt + 800) a.sipAt = simT + 3800 + a.r() * 5200;
        if (a.say && simT > a.say.until) a.say = null;
      }
      for (let i = papers.length - 1; i >= 0; i--) if (simT >= papers[i].t0 + papers[i].dur) { papers.splice(i, 1); trayBump = simT; }
    };

    // ----- what moves: the wall display, the clock, snow, lane pulses, consoles' screens and lamps, the robots -----
    const glows = [];                                    // [x, y, colour, radius] in logical px, drawn additively after the room
    const glowCache = new Map();
    const glowSprite = (col, r) => {
      const key = col + r; let g = glowCache.get(key);
      if (!g) {
        g = document.createElement('canvas'); g.width = g.height = r * 2 + 1;
        const x = g.getContext('2d');
        for (let i = r; i >= 1; i--) { x.fillStyle = rgba(col, 0.05 + 0.22 * Math.pow(1 - i / r, 1.6)); const d = i; for (let dy = -d; dy <= d; dy++) { const dx = Math.floor(Math.sqrt(d * d - dy * dy) + 0.4); x.fillRect(r - dx, r + dy, dx * 2 + 1, 1); } }
        glowCache.set(key, g);
      }
      return g;
    };
    const drawWallLive = () => {
      const d = L.disp, P = PAL, t = simT, q = dispParts(d), base = d.y + d.h - 2;
      // a line that scrolls
      const shift = Math.floor(t / 700);
      let prev = -1;
      for (let i = 0; i * 2 < q.cw; i++) {
        const v = hash(seed + 5, i + shift) * 0.6 + hash(seed + 9, Math.floor((i + shift) / 4)) * 0.4, y = base - 1 - Math.floor(v * (d.h - 6));
        R(q.cx0 + i * 2, y, 2, 1, P.strip); if (prev >= 0 && Math.abs(prev - y) > 1) R(q.cx0 + i * 2, Math.min(prev, y) + 1, 1, Math.abs(prev - y) - 1, mix(P.screen, P.strip, 0.6));
        prev = y;
      }
      R(q.cx0, base, q.cw, 1, mix(P.screen, P.strip, 0.35));
      // a round scope with a sweeping arm
      const ang = t / 1700, sx = q.rx + Math.cos(ang) * (q.r - 1), sy = q.ry + Math.sin(ang) * (q.r - 1);
      line(q.rx, q.ry, sx, sy, P.lampGreen);
      for (let i = 0; i < 2; i++) { const a = hash(seed + 31, i) * 6.283, rr = 2 + hash(seed + 33, i) * (q.r - 3), da = ((ang - a) % 6.283 + 6.283) % 6.283; if (da < 2.4) R(Math.round(q.rx + Math.cos(a) * rr), Math.round(q.ry + Math.sin(a) * rr), 1, 1, mix(P.lampGreen, P.screen, da / 2.4)); }
      // bars in the crew's colours
      const names = ['teal', 'amber', 'rose', 'violet', 'blue', 'green'];
      for (let i = 0; i < 6 && q.bx + i * 5 + 3 < d.x + d.w - 2; i++) { const hh = 2 + Math.floor((0.5 + 0.5 * Math.sin(t / 1500 + i * 1.9 + seed)) * (d.h - 7)); R(q.bx + i * 5, base - hh, 3, hh, HUES[names[i]][0]); R(q.bx + i * 5, base - hh, 3, 1, HUES[names[i]][2]); }
      for (let i = 0; i < 3; i++) if (q.bx + 32 + i * 4 < d.x + d.w - 2) R(q.bx + 32 + i * 4, d.y + 2, 2, 2, (Math.floor(t / 600) + i) % 3 === 0 ? P.lampAmber : P.screenLine);
      // the clock's hands
      const k = L.clock;
      if (k.r >= 3 && k.x + k.r + 3 < W) {
        const ma = sky.mins / 60 * 6.2832 - 1.5708, ha = ((sky.hours % 12) + sky.mins / 60) / 12 * 6.2832 - 1.5708;
        line(k.x, k.y, k.x + Math.cos(ma) * (k.r - 2), k.y + Math.sin(ma) * (k.r - 2), '#dfe7ff');
        line(k.x, k.y, k.x + Math.cos(ha) * (k.r - 4), k.y + Math.sin(ha) * (k.r - 4), P.stripWarm);
        R(k.x, k.y, 1, 1, P.white);
      }
      // snow outside, in the cold months
      if (sky.snow && !still) {
        const wn = L.win, n = Math.floor(wn.w / 13), col = mix(sky.low, '#ffffff', 0.55 + 0.3 * sky.light);
        for (let i = 0; i < n; i++) {
          const fx = (hash(seed + i, 41) * wn.w + t * 0.0035 * (hash(seed + i, 43) - 0.3)) % wn.w, fy = (hash(seed + i, 42) * wn.h + t * (0.0028 + 0.002 * hash(seed + i, 44))) % wn.h;
          R(wn.x + Math.floor((fx + wn.w) % wn.w), wn.y + Math.floor(fy), 1, 1, col);
        }
      }
      // the rack's lights
      if (L.rack) for (let j = 0; j < 4; j++) for (let q2 = 0; q2 < 3; q2++) { const on = still ? (j + q2) % 2 : hash(seed + j * 3 + q2, Math.floor(t / (300 + 90 * ((j + q2) % 4)))) > 0.45; R(L.rack.x + 3 + q2 * 3, L.rack.yb - 25 + j * 7, 2, 1, on ? [P.lampGreen, P.strip, P.lampAmber][(j + q2) % 3] : P.screenLine); }
      // pulses of light run along the queue's lane towards your desk
      const x0 = Math.min(L.queue.x0 + 9, L.queue.min - 6), x1 = L.desk.x - 6, off = still ? 4 : Math.floor(t / 100) % 16, hot = queue.length > 0;
      for (let x = x0 + off; x < x1; x += 16) { R(x, L.yQ + 2, 3, 1, hot ? '#e4fffa' : mix(lit(PAL.floor), PAL.strip, 0.85)); if (x - 2 >= x0) R(x - 2, L.yQ + 2, 2, 1, mix(lit(PAL.floor), PAL.strip, hot ? 0.95 : 0.7)); }
    };

    // the lamp on a console: green while it works, amber steady when a run is due, amber blinking when late, red on a fault
    const lampOf = (a) => {
      if (!a.present || a.goal !== 'desk') return '';
      const st = a.state, t = simT;
      if (st === 'working') return PAL.lampGreen;
      if (st === 'due') return PAL.lampAmber;
      if (st === 'late') return still || Math.floor(t / 450) % 2 === 0 ? PAL.lampAmber : '';
      if (st === 'error') return still || Math.floor(t / 220) % 2 === 0 ? PAL.lampRed : '#a8303f';
      return '';
    };
    // soft halos, added to the room before the things in it are drawn (so they sit behind a lamp, a bulb, a visor)
    const drawGlows = () => {
      glows.length = 0;
      L.consoles.forEach((cn, i) => { const a = agents[i], c = a ? lampOf(a) : ''; if (c) glows.push([cn.cx - Math.round(cn.w / 2) + cn.w - 4, cn.yb - 19, c, 8]); });
      glows.push([L.counter.x + 14, L.counter.yb - 29, PAL.lampAmber, 6]);
      agents.forEach((a, i) => {
        if (!a.present) return;
        const x = Math.round(a.x), y = Math.round(a.y + a.oy), asleep = (a.state === 'late' && a.node === 'seat') || (a.node === 'galley' && !a.moving && dozing());
        if (a.look === 'bulb' && !asleep) glows.push([x, y - 19 - (a.moving && (Math.floor(a.walked / 5) & 1) ? 1 : 0), a.hu[0], still || Math.floor(simT / 900 + i) % 3 ? 12 : 13]);
        if (a.look === 'antenna' && !still && Math.floor(simT / 520 + i) % 2) glows.push([x - 3, y - 26 + headDrop(a), a.hu[0], 4]);
      });
      ctx.globalCompositeOperation = 'lighter';
      for (let n = 0; n < glows.length; n++) { const g = glows[n], r = g[3]; ctx.drawImage(glowSprite(g[2], r), (g[0] - r) * K, (g[1] - r) * K, (r * 2 + 1) * K, (r * 2 + 1) * K); }
      ctx.globalCompositeOperation = 'source-over'; glows.length = 0;
    };
    // the screen, the lamp and the hands on one console
    const drawConsoleLive = (cn, a, i) => {
      const P = PAL, t = simT, w = cn.w, x = cn.cx - Math.round(w / 2), yb = cn.yb, hu = a.hu;
      const here = a.present && a.goal === 'desk', seated = here && a.node === 'seat' && !a.legs.length, st = a.state;
      drawConsole(cn, hu, lit, a.present);
      const sx = x + 3, sy = yb - 7, sw = w - 6;
      const lc = lampOf(a), lamp = lc || lit(P.lampOff);
      if (!a.present) { /* dark */ }
      else if (!here) { R(sx + 1, sy + 2, sw - 2, 1, mix(P.screen, hu[0], 0.32)); if (!still) R(sx + 1 + Math.floor(t / 170 + i * 5) % (sw - 3), sy + 2, 2, 1, mix(P.screen, hu[0], 0.85)); }
      else if (st === 'working') {
        const k = Math.floor(t / 260);
        for (let r = 0; r < 3; r++) { const len = 3 + Math.floor(hash(i * 7 + r, k - r) * (sw - 7)); R(sx + 1, sy + r * 2, len, 1, r === k % 3 ? P.lampGreen : mix(P.screen, P.lampGreen, 0.5)); if (r === k % 3 && Math.floor(t / 130) % 2) R(sx + 2 + len, sy + r * 2, 1, 1, P.white); }
      } else if (st === 'due' || st === 'late') {
        const on = st === 'due' || Math.floor(t / 450) % 2 === 0, am = on ? P.lampAmber : mix(P.screen, P.lampAmber, 0.3);
        R(sx + 1, sy, 5, 1, am); R(sx + 2, sy + 1, 3, 1, am); R(sx + 3, sy + 2, 1, 1, am); R(sx + 2, sy + 3, 3, 1, am); R(sx + 1, sy + 4, 5, 1, am);
        if (st === 'due') { const k = Math.floor(t / 380) % 3; for (let j = 0; j < 3; j++) R(sx + 9 + j * 4, sy + 2, 2, 2, j === k ? P.lampAmber : mix(P.screen, P.lampAmber, 0.3)); if (Math.floor(t / 380) % 2) R(sx + 3, sy + 3, 1, 1, P.white); }
        else R(sx + 8, sy + 1, sw - 10, 3, mix(P.screen, P.lampAmber, on ? 0.55 : 0.15));
      } else if (st === 'error') {
        const f = still || Math.floor(t / 220) % 2 === 0;
        R(sx, sy, sw, 5, f ? '#4f0f1f' : '#2c0a15'); R(cn.cx - 1, sy, 2, 3, '#ffe3e7'); R(cn.cx - 1, sy + 4, 2, 1, '#ffe3e7');
      }
      R(x + w - 5, yb - 20, 3, 3, lamp); if (lc) R(x + w - 5, yb - 20, 1, 1, P.white); else R(x + w - 5, yb - 20, 1, 1, lit('#7f8bb8'));
      if (!seated) return;
      const sh = soft(P.shell), jo = soft(P.joint);
      if (st === 'late') { R(cn.cx - 9, yb - 13, 3, 2, sh); R(cn.cx + 6, yb - 13, 3, 2, sh); }
      else {
        const f = still ? 0 : st === 'working' ? Math.floor(t / 120 + i) % 2 : st === 'due' && Math.floor(t / 160) % 9 < 2 ? Math.floor(t / 160) % 2 : 0, g = st === 'working' && !still ? Math.floor(t / 170 + i) % 2 : 0;
        R(cn.cx - 6, yb - 14, 2, 1, jo); R(cn.cx + 4, yb - 14, 2, 1, jo);
        R(cn.cx - 5, yb - 13 + f, 2, 2, sh); R(cn.cx + 3, yb - 13 + g, 2, 2, sh);
        if (st === 'working') R(cn.cx - 4 + ((Math.floor(t / 120) * 3) % 8), yb - 12, 1, 1, P.lampGreen);
      }
      if (st === 'error' && !still) { // sparks and a wisp of smoke
        for (let j = 0; j < 4; j++) { const ph = (t / 460 + hash(i, j)) % 1, k = Math.floor(t / 460 + hash(i, j)); if (ph < 0.7) R(Math.round(x + 2 + hash(k, j + 3) * (w - 4) + (hash(k, j) - 0.5) * 10 * ph), Math.round(yb - 15 - ph * 12 + ph * ph * 6), 1, 1, ph < 0.3 ? P.white : P.lampAmber); }
        const sp = (t / 1600) % 1; R(x + 2 + Math.round(Math.sin(sp * 6) * 1.5), Math.round(yb - 16 - sp * 12), 2, 2, lit(sp < 0.5 ? '#8f96b3' : '#5f6788'));
      }
    };

    // one robot, posed from its state and from what it is doing just now
    const POSE = { dir: 0, walk: -1, vert: false, back: false, arm: 'down', eyes: 'open', hy: 0, hx: 0, dy: 0, dim: false, tip: 0, tap: 0, lift: 0, sip: 0 };
    const headDrop = (a) => (a.present && a.state === 'late' && a.node === 'seat' && !a.legs.length ? 6 : 0);
    const dozing = () => sky.hours >= 19 || sky.hours < 7;
    const drawAgent = (a, i) => {
      const t = simT, p = POSE, x = Math.round(a.x), y = Math.round(a.y + a.oy), st = a.state;
      const seated = a.node === 'seat' && !a.legs.length, atSeat = a.node === 'seat' && (seated || a.wait > 0);
      const blink = !still && t >= a.blinkAt && t < a.blinkAt + 140, glance = !still && t >= a.glanceAt && t < a.glanceAt + 900;
      p.dir = a.dir; p.walk = a.moving ? Math.floor(a.walked / 5) % 4 : -1; p.vert = a.vert; p.back = a.back && a.moving; p.arm = 'down'; p.eyes = blink ? 'blink' : 'open';
      p.hy = 0; p.hx = 0; p.dy = 0; p.dim = false; p.tip = !still && Math.floor(t / 520 + i) % 2; p.tap = 0; p.lift = 0; p.sip = 0;
      if (st === 'needs') { p.arm = 'up'; if (!a.moving) { p.dir = a.node === 'queue' ? 1 : a.dir; if (glance) { p.eyes = 'up'; p.lift = 1; } } }
      if (atSeat && a.goal === 'desk') {
        p.arm = 'desk';
        if (st === 'working') { p.eyes = blink ? 'blink' : 'down'; if (!still && Math.floor(t / 420 + i * 1.3) % 4 === 0) p.hy = 1; if (a.look === 'gavel' && !still && Math.floor(t / 300) % 6 === 0) p.tap = 2; }
        else if (st === 'due') { if (glance) p.eyes = 'up'; }
        else if (st === 'late') { p.hy = 6 + (!still && Math.floor(t / 1500 + i) % 2 ? 1 : 0); p.eyes = 'shut'; p.dim = true; }
        else if (st === 'error') { p.eyes = !still && Math.floor(t / 330) % 5 === 4 ? 'blink' : 'x'; const k = Math.floor(t / 140) % 10; p.hx = still ? 0 : k === 0 ? -1 : k === 1 ? 1 : 0; }
      } else if (!a.moving && a.node === 'galley') {
        p.arm = 'mug';
        if (dozing()) { p.eyes = 'shut'; p.hy = 1 + (!still && Math.floor(t / 1500 + i) % 2 ? 1 : 0); p.dim = true; }
        else { if (!still && t >= a.sipAt && t < a.sipAt + 800) p.sip = 1; if (glance) p.dir = a.dir === 0 ? (i % 2 ? 1 : -1) : 0; if (!still && t >= a.swayAt && t < a.swayAt + 240) p.dy = 1; }
      } else if (!a.moving && a.node === 'queue' && !still && t >= a.swayAt && t < a.swayAt + 1100) { if (t < a.swayAt + 240) p.dy = 1; else if (a.sway > 0) p.hx = 1; }
      if (!atSeat) { const sc = lit(PAL.floorSeam); R(x - 5, y, 10, 1, sc); R(x - 3, y + 1, 6, 1, sc); }
      drawRobot(x, y, a, p, soft);
      // z z z over a robot that sleeps; steam over a mug
      if (p.eyes === 'shut' && !still) for (let j = 0; j < 2; j++) { const ph = (t / 2200 + j * 0.5 + i * 0.13) % 1, zx = x + 7 + Math.round(ph * 5) + j, zy = y - 24 + p.hy - Math.round(ph * 9), col = ph < 0.6 ? '#dbe4ff' : '#8c97c4'; R(zx, zy, 3, 1, col); R(zx + 1, zy + 1, 1, 1, col); R(zx, zy + 2, 3, 1, col); }
      else if (p.arm === 'mug' && !p.sip && !still) { const ph = (t / 900 + i * 0.3) % 1; R(x + 10 + (ph > 0.5 ? 1 : 0), y - 15 - Math.round(ph * 4), 1, 1, ph < 0.7 ? '#cfd6f2' : '#7f89b0'); }
      if (t - a.pop < 500 && !still) { const k = (t - a.pop) / 500, rr = Math.round(4 + k * 9); ellipse(x, y - 1, rr, Math.max(2, Math.round(rr / 2)), mix(a.hu[2], lit(PAL.floor), k), 0); }
    };

    // everything that has a depth, back to front
    const order = [];
    const drawSorted = () => {
      order.length = 0;
      L.consoles.forEach((cn, i) => { if (agents[i]) order.push([cn.yb, 0, i]); });
      order.push([L.desk.yb - 8, 2, 0], [L.desk.yb, 1, 0], [L.counter.yb, 3, 0]);
      if (L.plant) order.push([L.plant.y, 4, 0]);
      if (L.plant2) order.push([L.plant2.y, 4, 1]);
      agents.forEach((a, i) => { if (a.present) order.push([a.y + a.oy, 5, i]); });
      order.sort((p, q) => (p[0] - q[0]) || (p[1] - q[1]) || (p[2] - q[2]));
      const t = simT, P = PAL;
      for (let n = 0; n < order.length; n++) {
        const o = order[n], kind = o[1], i = o[2];
        if (kind === 0) drawConsoleLive(L.consoles[i], agents[i], i);
        else if (kind === 5) drawAgent(agents[i], i);
        else if (kind === 2) { // you
          const bl = !still && Math.floor(t / 150) % 31 === 7, busy = total > 0;
          drawYou(L.you.x, L.desk.yb + 4, soft, bl ? 'blink' : 'open', busy ? -1 : 0, 0);
        } else if (kind === 1) { // your desk, the tray's stack, your hands
          drawDesk(L, lit);
          // the stack in the tray grows with the total waiting (capped); a slip in the air has not landed yet
          const tr = L.tray, want = total <= 0 ? 0 : clamp(1 + Math.round(Math.log2(total + 1) * 1.6), 2, 13), bump = t - trayBump < 260 && !still ? 1 : 0;
          if (!(papers.length && want > sheets)) sheets = want;
          for (let s = 0; s < sheets; s++) R(tr.x + (hash(seed + s, 61) > 0.5 ? 1 : 0), tr.y - 1 - s - (s === sheets - 1 ? bump : 0), 11, 1, soft(s % 2 ? P.paperLo : P.paper));
          const sip = !still && total <= 0 && Math.floor(t / 400) % 16 === 3;
          drawYouHands(L.you.x, L.desk.yb + 4, soft, !still && total > 0 ? Math.floor(t / 240) % 2 : 0, sip);
          if (!sip && !still) { const ph = (t / 1000) % 1; R(L.you.x + 9 + (ph > 0.5 ? 1 : 0), L.desk.yb - 18 - Math.round(ph * 4), 1, 1, ph < 0.7 ? '#cfd6f2' : '#7f89b0'); }
        } else if (kind === 3) { // the coffee counter and the steam over the machine
          drawCounter(L, lit);
          const k = L.counter;
          if (!still) for (let j = 0; j < 2; j++) { const ph = (t / 1300 + j * 0.5) % 1; R(k.x + 9 + j + (ph > 0.5 ? 1 : 0), k.yb - 34 - Math.round(ph * 6), 1, 1, ph < 0.6 ? '#cfd6f2' : '#7f89b0'); }
        } else if (kind === 4) drawPlant(i ? L.plant2 : L.plant, lit, !still && Math.floor(t / 1400 + i) % 2);
      }
      // where a robot has just left the room: a beam that thins out
      for (let n = ghosts.length - 1; n >= 0; n--) {
        const g = ghosts[n], k = (t - g.t0) / 450; if (k >= 1 || k < 0) { ghosts.splice(n, 1); continue; }
        const hh = Math.round(24 * (1 - k * 0.6)), ww = k < 0.4 ? 6 : k < 0.7 ? 4 : 2;
        R(g.x - (ww >> 1), g.y - hh, ww, hh, mix(g.hu[2], '#ffffff', 0.5)); ellipse(g.x, g.y - 1, Math.round(9 * (1 - k)) + 2, 2, g.hu[2], 0);
      }
      // slips on their way to the tray: a paper that tumbles along an arc, with a short tail of light
      for (let n = 0; n < papers.length; n++) {
        const pp = papers[n], k = clamp((t - pp.t0) / pp.dur, 0, 1); if (t < pp.t0) continue;
        const tx = L.tray.x + 6, ty = L.tray.y - 5, at = (kk) => { const e = kk * kk * (3 - 2 * kk); return [Math.round(lerp(pp.x0, tx, e)), Math.round(lerp(pp.y0, ty, e) - Math.sin(kk * Math.PI) * 34)]; };
        for (let j = 3; j >= 1; j--) { const q = at(Math.max(0, k - j * 0.045)); R(q[0], q[1], 2, 2, mix(pp.hu[2], lit(PAL.floor), 0.25 + j * 0.2)); }
        const p0 = at(k), f = Math.floor(k * 10) % 3, pw = f === 0 ? 8 : f === 1 ? 6 : 7, phh = f === 0 ? 5 : f === 1 ? 7 : 4, px = p0[0] - (pw >> 1), py = p0[1] - (phh >> 1);
        R(px - 1, py - 1, pw + 2, phh + 2, P.ink); R(px, py, pw, phh, P.paper); R(px, py + phh - 1, pw, 1, P.paperLo); R(px, py, pw, 1, pp.hu[0]); R(px + 1, py + 2, pw - 3, 1, P.paperLo);
      }
      if (t - trayBump < 420 && !still) { const k = (t - trayBump) / 420, rr = Math.round(3 + k * 8); ellipse(L.tray.x + 6, L.tray.y - 2, rr, Math.max(2, Math.round(rr / 2)), mix('#fff6e2', lit(PAL.deskTop), k), 0); }
    };

    // ----- words, drawn on top in screen space at 11 css px with a plate behind: slips, name tags, bubbles, "You" -----
    let fontPx = 22, th = 8;
    const textFont = () => { fontPx = Math.max(8, Math.round(11 * dpr)); th = Math.max(6, Math.ceil(16 * dpr / K)); textW.clear(); };
    const measure = (s, heavy) => {
      const key = (heavy ? 'b' : 'a') + s; let w = textW.get(key);
      if (w === undefined) { w = s.length * fontPx * 0.58; if (ctx) { ctx.font = (heavy ? '700 ' : '600 ') + fontPx + 'px ' + FONT; const m = ctx.measureText(s); if (m && isFinite(m.width)) w = m.width; } textW.set(key, w); }
      return w;
    };
    const tagWidth = (s) => Math.ceil((measure(s, false) + 9 * dpr) / K);
    const plate = (x, y, w, h, bg, edge) => { R(x + 1, y, w - 2, h, edge); R(x, y + 1, w, h - 2, edge); R(x + 1, y + 1, w - 2, h - 2, bg); };
    const word = (s, x, y, w, h, ink, heavy) => {
      ctx.font = (heavy ? '700 ' : '600 ') + fontPx + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = ink; lastFill = ''; ctx.fillText(s, Math.round((x + w / 2) * K), Math.round((y + h / 2) * K + fontPx * 0.36));
    };
    const rects = [];
    const clash = (x, y, w, h) => { for (let i = 0; i < rects.length; i++) { const o = rects[i]; if (x < o[0] + o[2] && o[0] < x + w && y < o[1] + o[3] && o[1] < y + h) return true; } return false; };
    const tagOrder = [];
    const drawWords = () => {
      const P = PAL, t = simT;
      rects.length = 0;
      // the slips: a paper in the raised hand, the count on it
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i]; a.slip = null; if (!a.present || a.state !== 'needs') continue;
        const s = a.waiting > 99 ? '99+' : String(a.waiting), w = Math.max(11, Math.ceil((measure(s, true) + 7 * dpr) / K)), h = th + 1;
        const up = (a.moving && (Math.floor(a.walked / 5) & 1) ? 1 : 0) + (!a.moving && !still && t >= a.glanceAt && t < a.glanceAt + 900 ? 1 : 0) + (!still && t - a.slipAt < 280 ? 2 : 0);
        const x = clamp(Math.round(a.x) + (a.look === 'headset' ? 9 : 8) - (w >> 1), 1, W - 1 - w), y = Math.max(1, Math.round(a.y + a.oy) - 24 - h - up);
        R(x, y, w, h, P.paper); R(x, y + h - 1, w, 1, P.paperLo); R(x + w - 1, y + 1, 1, h - 1, P.paperLo); R(x + w - 2, y, 2, 2, P.paperLo); R(x, y, w - 2, 1, a.hu[0]);
        word(s, x, y + 1, w, h - 1, P.paperInk, true);
        a.slip = [x, y, w, h]; rects.push(a.slip);
      }
      // "You", on the front of the big desk
      { const w = Math.ceil((measure('You', true) + 10 * dpr) / K), x = L.desk.x + Math.round((L.desk.w - w) / 2), y = L.desk.yb - th - 1;
        plate(x, y, w, th, P.youBg, P.goldLo); word('You', x, y, w, th, P.youInk, true); rects.push([x, y, w, th]); }
      // name tags: under the console for an agent at its desk, under the feet otherwise; a tag that would cover
      // another drops a row
      tagOrder.length = 0;
      for (let i = 0; i < agents.length; i++) if (agents[i].present) tagOrder.push(agents[i]);
      tagOrder.sort((a, b) => ((a.node === 'seat' ? 0 : 1) - (b.node === 'seat' ? 0 : 1)) || (a.x - b.x) || (a.idx - b.idx));
      for (let i = 0; i < tagOrder.length; i++) {
        const a = tagOrder[i], cn = L.consoles[a.idx]; a.tag = null; if (!a.name) continue;
        const w = tagWidth(a.name), x = clamp(Math.round(a.x - w / 2), 1, W - 1 - w);
        let y = Math.round(a.y + a.oy) + 3; if (cn && a.y < cn.yb && Math.abs(a.x - cn.cx) < L.pitch) y = Math.max(y, cn.yb + 2);
        let yy = Math.min(y, H - 1 - th), ok = false;
        for (let k = 0; k < 3 && !ok; k++) { if (yy + th <= H - 1 && !clash(x, yy, w, th)) ok = true; else yy += th + 1; }
        if (!ok) yy = Math.min(y, H - 1 - th);
        const hot = a.id === focusId || a.id === hoverId;
        plate(x, yy, w, th, P.tagBg, hot ? a.hu[2] : P.tagEdge); R(x + 2, yy + th - 2, w - 4, 1, a.hu[0]);
        word(a.name, x, yy - 0.5, w, th, hot ? P.white : P.tagInk, false);
        a.tag = [x, yy, w, th]; rects.push(a.tag);
      }
      // an agent that is not in the room leaves its name, dimmed, under its dark console
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i], cn = L.consoles[i]; if (a.present || !cn || !a.name) continue;
        const w = tagWidth(a.name), x = clamp(Math.round(cn.cx - w / 2), 1, W - 1 - w), y = cn.yb + 2;
        if (clash(x, y, w, th)) continue;
        plate(x, y, w, th, lit(P.floorB), lit(P.floorSeam)); word(a.name, x, y - 0.5, w, th, lit('#7783ad'), false);
        rects.push([x, y, w, th]);
      }
      // bubbles: the model's short words for about four seconds on a change, and the step while an agent works
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i]; if (!a.present) continue;
        let s = '', kind = 0;
        if (a.say && t >= a.say.from) { s = a.say.text; kind = 1; }
        else if (a.state === 'working' && a.step && a.node === 'seat' && !a.legs.length) { s = a.step; kind = 2; }
        if (!s) continue;
        const w = Math.ceil((measure(s, false) + 10 * dpr) / K) + (kind === 2 ? 4 : 0), h = th;
        const x = clamp(Math.round(a.x - w / 2), 1, W - 1 - w);
        let y = Math.round(a.y + a.oy) - 29 + headDrop(a) - h - 2; if (a.slip) y = a.slip[1] - h - 3;
        y = Math.max(1, y);
        for (let k = 0; k < 3 && clash(x, y, w, h) && y > 1; k++) y = Math.max(1, y - h - 1);
        if (kind === 1 && !still) y += Math.max(0, 2 - Math.floor((t - a.say.from) / 70));   // it pops up
        const bg = kind === 2 ? '#0e2030' : P.bubble, edge = kind === 2 ? '#2f7d5c' : '#bdb49c', tx = clamp(Math.round(a.x) - 1, x + 2, x + w - 5);
        plate(x, y, w, h, bg, edge); R(tx, y + h - 1, 3, 1, bg); R(tx, y + h, 3, 1, edge); R(tx + 1, y + h, 1, 1, bg); R(tx + 1, y + h + 1, 1, 1, edge);
        if (kind === 2) { R(x + 3, y + (h >> 1) - 1, 2, 2, !still && Math.floor(t / 400) % 2 ? P.lampGreen : mix(P.lampGreen, bg, 0.5)); word(s, x + 4, y - 0.5, w - 4, h, '#d5ffe6', false); }
        else word(s, x, y - 0.5, w, h, P.bubbleInk, false);
        rects.push([x, y, w, h]);
      }
      // a frame of four corners around the agent that has the focus (keyboard, its chip) or the pointer: it takes in
      // the robot, its slip and its name
      for (let n = 0; n < 2; n++) {
        const id = n ? hoverId : focusId, a = id != null ? byId[id] : null; if (!a || !a.present || (n && id === focusId)) continue;
        const ax = Math.round(a.x), ay = Math.round(a.y + a.oy), cn = L.consoles[a.idx];
        let x0 = ax - 10, x1 = ax + 10, y0 = ay - 29 + headDrop(a), y1 = ay + 2;
        if (a.node === 'seat' && cn) { x0 = Math.min(x0, cn.cx - (cn.w >> 1) - 1); x1 = Math.max(x1, cn.cx + (cn.w >> 1) + 1); y1 = Math.max(y1, cn.yb + 1); }
        [a.slip, a.tag].forEach((r) => { if (r) { x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[0] + r[2] - 1); y0 = Math.min(y0, r[1]); y1 = Math.max(y1, r[1] + r[3] - 1); } });
        x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
        const col = n ? a.hu[2] : P.white, g = !still && Math.floor(t / 350) % 2 ? 1 : 0;
        R(x0 - g, y0 - g, 5, 1, col); R(x0 - g, y0 - g, 1, 5, col); R(x1 - 4 + g, y0 - g, 5, 1, col); R(x1 + g, y0 - g, 1, 5, col);
        R(x0 - g, y1 + g, 5, 1, col); R(x0 - g, y1 - 4 + g, 1, 5, col); R(x1 - 4 + g, y1 + g, 5, 1, col); R(x1 + g, y1 - 4 + g, 1, 5, col);
      }
    };

    // ----- drawing one frame -----
    const rebuild = () => {
      // the cache is opaque: copying it over the whole canvas tells the browser that nothing drawn before matters
      if (!cache) { cache = document.createElement('canvas'); cctx = cache.getContext('2d', { alpha: false }); }
      if (cache.width !== canvas.width || cache.height !== canvas.height) { cache.width = canvas.width; cache.height = canvas.height; }
      lm = lightMul(sky, false); sm = lightMul(sky, true); litMemo.clear(); softMemo.clear();
      pen(cctx, K);
      drawRoom(L, sky, lit, seed, agents.map((a) => a.hu));
      // light that falls on the room: around the big display, on the floor in front of a console that is on, under
      // your desk, by the coffee. Baked here, so it costs nothing per frame.
      const bake = (x, y, col, rx, ry, al) => { cctx.globalAlpha = al; cctx.drawImage(glowSprite(col, 12), Math.round(x - rx) * K, Math.round(y - ry) * K, Math.round(rx * 2) * K, Math.round(ry * 2) * K); };
      cctx.globalCompositeOperation = 'lighter'; cctx.imageSmoothingEnabled = false;
      const d = L.disp, night = 0.75 + 0.25 * sky.night;
      bake(d.x + d.w / 2, d.y + d.h / 2, PAL.strip, d.w * 0.64, d.h * 1.25, 0.5 * night);
      L.consoles.forEach((cn, i) => { const a = agents[i]; if (a && a.present) bake(cn.cx, cn.yb + 3, a.hu[0], cn.w * 0.8, 8, 0.55 * night); });
      bake(L.desk.x + L.desk.w / 2, L.desk.yb + 2, PAL.stripWarm, L.desk.w * 0.75, 9, 0.6 * night);
      bake(L.counter.x + 10, L.counter.yb - 22, PAL.lampAmber, 18, 15, 0.5 * night);
      if (L.sign) bake(L.sign.x, L.sign.y + 3, PAL.stripWarm, 13, 11, 0.6 * night);
      if (L.lamp) { bake(L.lamp.x, L.lamp.y - 26, PAL.stripWarm, 20, 16, 0.55 * night); bake(L.lamp.x + 4, L.lamp.y, PAL.stripWarm, 26, 9, 0.4 * night); }
      cctx.globalAlpha = 1; cctx.globalCompositeOperation = 'source-over';
    };
    const render = () => {
      if (!ctx || dead) return;
      if (!sized) resize(num(canvas.clientWidth, 0) || 300);
      sky = skyAt(nowFn());
      let key = sky.key + '|' + canvas.width + 'x' + canvas.height + '|' + K + '|';
      for (let i = 0; i < agents.length; i++) key += agents[i].present ? '1' : '0';
      if (key !== cacheKey) { rebuild(); cacheKey = key; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cache, 0, 0);
      pen(ctx, K);
      drawWallLive(); drawGlows(); pen(ctx, K); drawSorted(); drawWords();
      dirty = false;
    };

    // ----- the public face -----
    const resize = (w) => {
      cssW = Math.max(0, num(+w, 0));
      dpr = clamp(num(root.devicePixelRatio, 1), 0.5, 4);
      sized = true;
      relayout();
      dirty = true;
      if (lastT != null) render();          // setting the size wipes the canvas: draw it again at once
      if (still && started) ask();
      return cssH;
    };
    const frame = (tMs) => {
      if (dead) return;
      const t = num(+tMs, lastT == null ? 0 : lastT), dt = lastT == null ? 0 : clamp(t - lastT, 0, 100);
      lastT = t;
      step(dt);
      render();
    };
    const headOf = (a) => ({ x: a.x, y: a.y + a.oy - 17 + headDrop(a) });
    const hit = (cx, cy) => {
      if (!L) return null;
      const lx = num(+cx, -1e9) / u, ly = num(+cy, -1e9) / u, hw = Math.max(10, 15 / u);
      let best = null, bd = 1e9;
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i]; if (!a.present) continue;
        const h = headOf(a), tg = a.tag, sl = a.slip;
        let inside = lx >= a.x - hw && lx <= a.x + hw && ly >= a.y + a.oy - 32 && ly <= a.y + a.oy + 3;
        if (!inside && tg) inside = lx >= tg[0] && lx <= tg[0] + tg[2] && ly >= tg[1] && ly <= tg[1] + tg[3];
        if (!inside && sl) inside = lx >= sl[0] && lx <= sl[0] + sl[2] && ly >= sl[1] && ly <= sl[1] + sl[3];
        if (!inside) continue;
        const d = Math.abs(lx - h.x) + Math.abs(ly - h.y);
        if (d < bd) { bd = d; best = a.id; }
      }
      return best;
    };
    const anchor = (id) => {
      const a = id != null ? byId[String(id)] : null;
      if (!a || !a.present || !L) return null;
      const h = headOf(a);
      return { x: clamp(h.x * u, 0, Math.max(0, cssW)), y: clamp(h.y * u, 0, Math.max(0, cssH)) };
    };
    const setFocus = (id) => { const next = id != null && byId[String(id)] ? String(id) : null; if (next !== focusId) { focusId = next; dirty = true; if (still && started) ask(); } };

    // the scene's own loop: about 15 frames a second, nothing while the tab or the canvas is hidden
    let started = false, rafId = 0, lastDraw = -1e9, inView = true, io = null;
    const shown = () => !(typeof document !== 'undefined' && document.hidden) && canvas.offsetParent !== null && inView;
    const tick = (ts) => {
      rafId = 0;
      if (!started || dead) return;
      if (still) { if (dirty && shown()) frame(ts); return; }       // reduced motion: one picture, redrawn when something changes
      if (typeof document !== 'undefined' && document.hidden) return; // the visibility listener asks again
      ask();
      if (!shown()) return;
      if (ts - lastDraw >= 62) { lastDraw = ts; frame(ts); }
    };
    const ask = () => { if (started && !rafId && !dead && typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(tick); };
    const start = () => { if (dead) return; started = true; dirty = true; ask(); };
    const stop = () => { started = false; if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId); rafId = 0; };
    const onVis = () => { if (started && !document.hidden) { dirty = true; ask(); } };

    // pointer: hover and pick, from the scene's own listeners on its canvas
    const at = (e) => { const r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 }; return [num(e && e.clientX, -1e6) - num(r.left, 0), num(e && e.clientY, -1e6) - num(r.top, 0)]; };
    const point = (id) => { if (id !== hoverId) { hoverId = id; if (canvas.style) canvas.style.cursor = id ? 'pointer' : ''; dirty = true; if (still && started) ask(); onHover(id); } };
    const onMove = (e) => { const p = at(e); point(hit(p[0], p[1])); };
    const onLeave = () => { const had = hoverId; hoverId = null; if (canvas.style) canvas.style.cursor = ''; if (had !== null) { dirty = true; if (still && started) ask(); } onHover(null); };
    const onClick = (e) => { const p = at(e), id = hit(p[0], p[1]); if (id != null) onPick(id); };
    const listen = [['pointermove', onMove], ['pointerdown', onMove], ['pointerleave', onLeave], ['pointercancel', onLeave], ['click', onClick]];
    if (canvas.addEventListener) listen.forEach((l) => canvas.addEventListener(l[0], l[1]));
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', onVis);
    if (typeof IntersectionObserver === 'function') { try { io = new IntersectionObserver((es) => { const e = es[es.length - 1]; inView = !e || e.isIntersecting !== false; if (inView) ask(); }); io.observe(canvas); } catch { io = null; } }
    const destroy = () => {
      if (dead) return;
      stop(); dead = true;
      if (canvas.removeEventListener) listen.forEach((l) => canvas.removeEventListener(l[0], l[1]));
      if (typeof document !== 'undefined' && document.removeEventListener) document.removeEventListener('visibilitychange', onVis);
      if (io) { try { io.disconnect(); } catch { /* gone already */ } io = null; }
      cache = null; cctx = null; glowCache.clear();
    };
    return { setCrew, resize, frame, start, stop, destroy, hit, anchor, setFocus };
  };

  const api = { create };
  root.OSCockpit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
