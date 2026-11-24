// The cockpit scene: a small Nordic studio office drawn on one canvas, where each scheduled agent is a robot.
// Contract: window.OSCockpit = { create(canvas, { now, seed, reducedMotion, onHover, onPick }) } -> scene with
// setCrew, resize, frame, start, stop, destroy, hit, anchor, setFocus. It never reads the database or the page:
// it draws the crew it is handed. Everything is drawn with canvas calls (no images, no fonts, no network).
// One logical pixel is a whole number of device pixels, so the art stays crisp; text is drawn in screen space.
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- small helpers
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var fin = function (v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; };
  var ease = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  // stateless noise in 0..1 from two integers (the scene's only source of chance, together with opts.seed)
  var hash = function (a, b) {
    var h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  var hexc = function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  var mixc = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  var rgb = function (c, a) {
    var s = Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]);
    return a == null ? 'rgb(' + s + ')' : 'rgba(' + s + ',' + a + ')';
  };
  var mixh = function (h1, h2, t) { return rgb(mixc(hexc(h1), hexc(h2), t)); };

  // pixel pen: every shape is whole logical pixels
  var R = function (g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); };
  var cut = function (g, x, y, w, h, r) { // a rectangle with its corners cut by r (0, 1 or 2): reads as rounded
    if (r <= 0 || w < 3 || h < 3) { g.fillRect(x, y, w, h); return; }
    if (r === 1 || w < 5 || h < 5) { g.fillRect(x + 1, y, w - 2, h); g.fillRect(x, y + 1, w, h - 2); return; }
    g.fillRect(x + 2, y, w - 4, h); g.fillRect(x + 1, y + 1, w - 2, h - 2); g.fillRect(x, y + 2, w, h - 4);
  };
  var box = function (g, x, y, w, h, r, fill, line) { // rounded box with a one pixel outline
    if (line) { g.fillStyle = line; cut(g, x, y, w, h, r); g.fillStyle = fill; cut(g, x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1)); }
    else { g.fillStyle = fill; cut(g, x, y, w, h, r); }
  };
  var ell = function (g, cx, cy, rx, ry) { // filled pixel ellipse
    if (rx < 1 || ry < 1) return;
    for (var dy = -ry; dy <= ry; dy++) {
      var w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.5))));
      if (w > 0) g.fillRect(cx - w, cy + dy, w * 2, 1);
    }
  };

  // ---------------------------------------------------------------- palette (the picture's own, theme independent)
  var C = {
    line: '#40372F', lineSoft: '#6B5F54',
    wall: '#F3EFE6', wallShade: '#E7E1D5', sage: '#C2CFB8', sageDark: '#A9B99F', sageLight: '#D5DECB',
    base: '#FAF6EE', baseShade: '#CFC5B4',
    floor: '#EAD9BC', floorA: '#E6D3B4', floorB: '#EEDFC6', floorLine: '#DCC9A8',
    wood: '#D9B88A', woodDark: '#B8925F', woodLight: '#EBD2AA', oak: '#C99F6B', oakDark: '#A77C4B',
    white: '#FBF8F1', whiteShade: '#E6DFD1', paper: '#FFFDF7', paperShade: '#E4DCCB',
    metal: '#8F877C', metalDark: '#5E564D', char: '#3B3A3F', charLight: '#55545B',
    shell: '#FBF8F1', shellShade: '#E3DBCB', eye: '#2B2622', blush: '#F3B7A6',
    leaf: '#5E9C6B', leafDark: '#3F7A52', leafLight: '#8CC08A', pot: '#D98B62', potDark: '#B56B45',
    mustard: '#E2B04A', terracotta: '#D2805C', dusty: '#8FA9BF', rose: '#E3A6A0',
    green: '#46C46A', amber: '#F5B62E', red: '#E8483C', lampOff: '#A69F93',
    you: '#3F4B5C', youDark: '#2E3846', youHead: '#F2E9DB'
  };
  var HUES = {
    teal:   { m: '#2CA7A0', d: '#1B7873', l: '#A4E0D8' },
    amber:  { m: '#F0A22B', d: '#B8750F', l: '#FBD893' },
    rose:   { m: '#E7607F', d: '#B03A5B', l: '#F8B6C6' },
    violet: { m: '#8B6CE0', d: '#6046B0', l: '#CBBBF5' },
    blue:   { m: '#3E8CE0', d: '#2463AD', l: '#ABD0F6' },
    green:  { m: '#5BB158', d: '#3B863D', l: '#BCE2B0' }
  };
  var LOOKS = { headset: 1, gavel: 1, antenna: 1, bulb: 1, clipboard: 1, plain: 1 };
  var STATES = { working: 1, due: 1, late: 1, error: 1, needs: 1, idle: 1, unknown: 1 };
  var FONT = '600 11px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // ---------------------------------------------------------------- the light over the day (Stockholm in winter)
  // hour, sky top, sky at the horizon, water, silhouette (0 = coloured facades, 1 = dark shapes), lit windows,
  // stars, veil (how dark the room is), lamp (how much the pendant lamps glow)
  var KEYS = [
    [0,    '#0D1730', '#1E2C4E', '#121E3A', 1,    0.62, 1,    1,    1],
    [6.6,  '#0D1730', '#1E2C4E', '#121E3A', 1,    0.72, 1,    1,    1],
    [7.6,  '#22386A', '#586A9C', '#2C3F6B', 0.92, 0.78, 0.35, 0.86, 1],
    [8.5,  '#86A9CF', '#F8C9AE', '#B6C0D6', 0.5,  0.42, 0,    0.14, 0.75],
    [9.7,  '#BCD5E8', '#EEF2F0', '#BBD0DD', 0,    0,    0,    0,    0],
    [13.4, '#BCD5E8', '#EEF2F0', '#BBD0DD', 0,    0,    0,    0,    0],
    [14.5, '#A5C1DE', '#FADBA9', '#C5CAD2', 0.25, 0.12, 0,    0.12, 0.45],
    [15.3, '#6880BC', '#F4A387', '#9697BF', 0.62, 0.5,  0,    0.45, 0.85],
    [16.5, '#293D78', '#6474B2', '#30457C', 0.92, 0.78, 0.25, 0.82, 1],
    [18,   '#0D1730', '#1E2C4E', '#121E3A', 1,    0.75, 1,    1,    1],
    [24,   '#0D1730', '#1E2C4E', '#121E3A', 1,    0.62, 1,    1,    1]
  ];
  var lightAt = function (ms) {
    var d = new Date(fin(ms, 0)), h = d.getHours() + d.getMinutes() / 60;
    if (!isFinite(h)) h = 12;
    var i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
    var a = KEYS[i], b = KEYS[i + 1], t = clamp((h - a[0]) / Math.max(0.001, b[0] - a[0]), 0, 1);
    var u = (h - 8.3) / (15.3 - 8.3); // the sun's short arc
    return {
      hour: h, key: Math.floor(h * 20), // the room is repainted when this changes (every three minutes)
      top: mixc(hexc(a[1]), hexc(b[1]), t), low: mixc(hexc(a[2]), hexc(b[2]), t), water: mixc(hexc(a[3]), hexc(b[3]), t),
      sil: lerp(a[4], b[4], t), lit: lerp(a[5], b[5], t), stars: lerp(a[6], b[6], t), veil: lerp(a[7], b[7], t), lamp: lerp(a[8], b[8], t),
      sunU: u, sun: u > -0.02 && u < 1.02, snow: clamp(lerp(a[7], b[7], t) * 1.6 - 0.9, 0, 1),
      doze: h >= 19 || h < 7
    };
  };

  // ---------------------------------------------------------------- layout, in logical pixels
  // Narrow: desks along the back wall, the front of the floor shared by the coffee corner (left), the queue and
  // the big desk (right). Wide: coffee corner | desks under the long window | the big desk, the queue in front.
  var WIDE = 350;
  var layout = function (W, n) {
    n = clamp(n | 0, 0, 8);
    var wide = W >= WIDE, L = { W: W, n: n, wide: wide, floorY: 58, dadoY: 42 };
    var cols, rows, sp, dw, cx, cz = 0, bw, bossX, regL, regR;
    if (wide) {
      cz = Math.round(clamp(W * 0.3, 104, 150));
      bw = W >= 420 ? 64 : 58; bossX = Math.round(W - 10 - bw / 2 - (W >= 500 ? 16 : 0));
      regL = cz + (W >= 420 ? 12 : 8); regR = bossX - bw / 2 - 2;
      if (n > 4 && (regR - regL) / n < 33) { cols = Math.ceil(n / 2); rows = 2; } else { cols = Math.max(1, n); rows = 1; }
      sp = clamp((regR - regL) / cols, 33, 64); cx = (regL + regR) / 2;
    } else {
      if (n > 5) { cols = Math.ceil(n / 2); rows = 2; } else { cols = Math.max(1, n); rows = 1; }
      sp = clamp((W - 6) / cols, 30, 50); cx = W / 2;
      bw = W < 196 ? 50 : 54; bossX = Math.round(W - 3 - bw / 2);
      regL = 4; regR = W - 4;
    }
    dw = clamp(Math.floor((sp - 7) / 2) * 2, 26, 34);
    L.cols = cols; L.rows = rows; L.sp = sp; L.dw = dw; L.cz = cz;
    var base1 = 86, base2 = 124, last = rows === 2 ? base2 : base1;
    L.base2 = base2; L.front = last + (wide ? 42 : 46); L.street = L.front - 12; L.H = L.front + 20;
    L.desks = [];
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / cols), c = i % cols;
      L.desks.push({ x: Math.round(cx + (c - (cols - 1) / 2) * sp), y: r ? base2 : base1, w: dw, row: r, so: dw >= 32 ? 5 : 4 });
    }
    L.boss = { x: bossX, y: L.front, w: bw, left: Math.round(bossX - bw / 2), seatX: bossX + 7, seatY: L.front - 5 };
    L.tray = { x: L.boss.left + 9, y: L.front - 17 };
    // the queue: first place right at the tray, the rest behind it to the left
    var nook = wide && W >= 430, dq = wide ? 24 : (W < 190 ? 21 : 24), qLimit = wide ? cz + (nook ? 62 : 6) : 44;
    L.q = { x: L.boss.left - 16, y: L.front + 2, d: dq };
    L.q.per = Math.max(1, Math.floor((L.q.x - qLimit) / dq) + 1);
    L.sMin = 12; L.sMax = L.boss.left - 10;
    // the coffee corner
    var tx, ty, S, kx = 1;
    if (wide) {
      tx = Math.round(cz * 0.47); ty = L.front - 6; kx = clamp((cz - tx - 9) / 46, 0.8, 1);
      L.counter = { x: 12, y: 78, w: 46 }; L.cart = null;
      S = tx - 46 >= 16 ? [[24, -1, -1], [-24, 1, 1], [0, -27, 0], [46, -23, -1], [-46, -22, 1], [70, -3, -1], [92, -13, -1], [70, -29, -1]]
        : [[24, -1, -1], [-24, 1, 1], [0, -27, 0], [46, -23, -1], [70, -3, -1], [92, -13, -1], [70, -29, -1], [-46, -22, 1]];
      L.poufs = [{ x: tx - 11, y: ty + 13, c: 0 }, { x: tx + 15, y: ty + 12, c: 1 }];
    } else {
      tx = W < 190 ? 32 : 36; ty = L.front + 8;
      L.counter = null; L.cart = { x: 12, y: L.street - 2, w: 18 }; L.poufs = [];
      S = [[-22, -4, 1], [24, -17, -1], [56, -21, 1], [80, -18, -1], [1, -27, 0], [40, -36, 0], [68, -38, 0], [92, -36, -1]];
    }
    L.table = { x: tx, y: ty }; L.kx = kx;
    L.spots = S.map(function (s) { return { x: clamp(Math.round(tx + s[0] * (Math.abs(s[0]) > 30 && s[0] < 60 ? kx : 1)), 15, W - 15), y: ty + s[1], f: s[2] }; });
    // the wall
    if (wide) {
      L.win = { x: cz + 6, y: 7, w: Math.round(regR - cz - 6), h: 35 };
      L.clock = { x: Math.round(regR + 15), y: 21 };
    } else {
      L.win = { x: 8, y: 7, w: W - 42, h: 35 };
      L.clock = { x: W - 17, y: 22 };
    }
    // pendant lamps: x, cord length, shade colour, and the pool of light each one throws on the floor
    L.lamps = [];
    var m, k, shade = [C.mustard, C.white, C.sageDark, C.terracotta], midY = Math.round((base1 + L.front) / 2) + 2;
    if (wide) {
      m = Math.max(2, Math.round((regR - regL) / 100));
      for (k = 0; k < m; k++) L.lamps.push({ x: Math.round(regL + (regR - regL) * (k + 0.5) / m), len: 12 + (k % 2) * 4, c: shade[k % 3], py: midY, rx: Math.round(Math.max(60, (regR - regL) / m * 0.62)), ry: 30 });
      L.lamps.push({ x: tx, len: 18, c: shade[3], py: ty - 8, rx: Math.round(cz * 0.5), ry: 27 });
      L.lamps.push({ x: Math.min(W - 12, bossX + 10), len: 17, c: shade[0], py: L.front - 6, rx: 54, ry: 24 });
    } else {
      L.lamps.push({ x: Math.round(W * 0.27), len: 11, c: shade[0], py: midY + 2, rx: Math.round(W * 0.3), ry: 31 });
      L.lamps.push({ x: Math.round(W * 0.66), len: 15, c: shade[1], py: midY + 2, rx: Math.round(W * 0.34), ry: 31 });
    }
    // a reading nook between the lounge and the queue, when there is room: an armchair and a floor lamp
    L.nook = nook ? { chair: { x: cz + 36, y: L.front + 3 }, lamp: { x: cz + 54, y: L.front - 7 } } : null;
    if (nook) L.lamps.push({ x: cz + 54, len: L.front - 46, floor: true, py: L.front - 4, rx: 40, ry: 17 });
    // a very wide room gets a low bookshelf by the wall and a large flat rug on the open floor
    var rowL = cx - cols * sp / 2, rugL = cz + 82, rugR = L.q.x - (Math.min(L.q.per, 5) - 1) * dq - 28;
    L.shelf = wide && rowL - cz > 74 ? { x: Math.round((cz + 14 + rowL) / 2 + 6), y: 78 } : null;
    var rugW = Math.min(230, rugR - rugL);
    L.bigRug = wide && rugW > 90 ? { x: Math.round((rugL + rugR - rugW) / 2), y: L.front - 16, w: rugW, h: 24 } : null;
    // plants on the floor
    L.plants = [];
    if (wide) {
      L.plants.push({ x: cz + 1, y: 78, kind: 0 });
      if (W >= 500) L.plants.push({ x: W - 13, y: 100, kind: 1 });
      if (regR - (cx + cols * sp / 2) > 30) L.plants.push({ x: Math.round(regR - 10), y: 76, kind: 1 });
    }
    return L;
  };
  var seatOf = function (L, i) { var d = L.desks[i]; return d ? { x: d.x + d.so, y: d.y - 4 } : { x: L.W / 2, y: L.street }; };
  var queueSpot = function (L, k) {
    var row = Math.floor(k / L.q.per), c = k % L.q.per;
    return { x: L.q.x - c * L.q.d - (row ? Math.round(L.q.d / 2) : 0), y: L.q.y + row * 9 };
  };
  // the way from a place to the street (the lane just behind the queue); the last point is on the street
  var legOut = function (L, kind, idx, towardX) {
    var sx = function (x) { return clamp(Math.round(x), L.sMin, L.sMax); }, p, out = [];
    if (kind === 'desk') {
      var d = L.desks[idx]; if (!d) return [{ x: sx(L.W / 2), y: L.street }];
      var seatX = d.x + d.so, gl = d.x - L.sp / 2, gr = d.x + L.sp / 2, okL = gl >= 9, okR = gr <= L.W - 9;
      var gx = Math.round((towardX >= seatX ? (okR ? gr : gl) : (okL ? gl : gr)));
      out.push({ x: gx, y: d.y - 4 }); out.push({ x: gx, y: d.y + 10 });
      if (L.rows === 2 && d.row === 0) out.push({ x: gx, y: L.base2 + 10 });
      out.push({ x: sx(gx), y: L.street });
    } else if (kind === 'queue') {
      p = queueSpot(L, idx); out.push({ x: sx(p.x), y: L.street });
    } else {
      p = L.spots[idx] || L.spots[0];
      if (Math.abs(p.x - L.table.x) < 14 && p.y > L.table.y) { out.push({ x: L.table.x + 17, y: p.y - 2 }); out.push({ x: sx(L.table.x + 17), y: L.street }); }
      else out.push({ x: sx(p.x), y: L.street });
    }
    return out;
  };

  // ---------------------------------------------------------------- the static room (painted at logical size, cached)
  var glassOf = function (win) { return { x: win.x + 2, y: win.y + 2, w: win.w - 4, h: win.h - 3 }; };
  var mullions = function (win) {
    var gl = glassOf(win), n = Math.max(1, Math.round(gl.w / 40)), out = [];
    for (var i = 1; i < n; i++) out.push(Math.round(gl.x + gl.w * i / n) - 1);
    return out;
  };
  var paintFrame = function (g, win) { // frame, mullions and sill: drawn again over the snow each frame
    var gl = glassOf(win), ms = mullions(win), i;
    R(g, C.base, win.x, win.y, win.w, 2); R(g, C.base, win.x, win.y, 2, win.h); R(g, C.base, win.x + win.w - 2, win.y, 2, win.h);
    R(g, C.baseShade, gl.x, gl.y, gl.w, 1);
    for (i = 0; i < ms.length; i++) { R(g, C.base, ms[i], gl.y, 2, gl.h); R(g, C.baseShade, ms[i] + 2, gl.y + 1, 1, gl.h - 1); }
    R(g, C.base, win.x - 2, win.y + win.h - 1, win.w + 4, 2); R(g, C.baseShade, win.x - 2, win.y + win.h + 1, win.w + 4, 1);
  };
  var FACADE = ['#D9A45B', '#C8785A', '#EBD9B4', '#E3C77F', '#D7978A', '#C3C9B4', '#CDB99C', '#E0B98C'];
  var paintOutside = function (g, win, lt, seed) {
    var gl = glassOf(win), hy = gl.y + Math.round(gl.h * 0.64), i, x, y, t;
    var night = [10, 16, 40], white = [255, 255, 255];
    g.save(); g.beginPath(); g.rect(gl.x, gl.y, gl.w, gl.h); g.clip();
    // sky in bands
    var rowsN = hy - gl.y;
    for (y = 0; y < rowsN; y++) { t = Math.round(Math.pow(y / Math.max(1, rowsN - 1), 1.4) * 7) / 7; R(g, rgb(mixc(lt.top, lt.low, t)), gl.x, gl.y + y, gl.w, 1); }
    if (lt.stars > 0.05) {
      for (i = 0; i < gl.w / 4; i++) {
        x = gl.x + Math.floor(hash(i, seed + 11) * gl.w); y = gl.y + Math.floor(hash(i, seed + 12) * (rowsN - 7));
        R(g, rgb(white, (lt.stars * (0.35 + 0.6 * hash(i, 13))).toFixed(2)), x, y, 1, 1);
      }
      if (lt.stars > 0.3) { // a thin moon
        var mx = gl.x + gl.w - 20, my = gl.y + 6;
        g.fillStyle = rgb([250, 240, 205], lt.stars.toFixed(2)); ell(g, mx, my, 3, 3);
        g.fillStyle = rgb(mixc(lt.top, lt.low, 0.15)); ell(g, mx + 2, my - 1, 3, 3);
      }
    }
    if (lt.sun && lt.sil < 0.97) {
      var alt = Math.sin(Math.PI * clamp(lt.sunU, 0, 1)), sx = Math.round(gl.x + gl.w * (0.14 + 0.72 * clamp(lt.sunU, 0, 1)));
      var sy = Math.round(hy - 4 - alt * rowsN * 0.42), sc = mixc([255, 176, 118], [255, 247, 222], alt);
      g.fillStyle = rgb(sc, 0.22); ell(g, sx, sy, 8, 8); g.fillStyle = rgb(sc, 0.3); ell(g, sx, sy, 5, 5);
      g.fillStyle = rgb(mixc(sc, white, 0.5)); ell(g, sx, sy, 3, 3);
    }
    if (lt.stars < 0.6) { // long thin winter clouds
      var cc = rgb(mixc(lt.low, white, 0.5), (0.75 * (1 - lt.stars)).toFixed(2));
      for (i = 0; i < gl.w / 46 + 1; i++) {
        x = gl.x + Math.floor(hash(i, seed + 41) * gl.w); y = gl.y + 3 + Math.floor(hash(i, seed + 42) * (rowsN - 12)); var cw = 12 + Math.floor(hash(i, 43) * 14);
        R(g, cc, x, y, cw, 1); R(g, cc, x + 3, y - 1, cw - 8, 1); R(g, cc, x + 2, y + 1, cw - 5, 1);
      }
    }
    // far shore
    var sil = mixc(lt.top, night, 0.6), far = rgb(mixc(mixc([150, 168, 178], lt.low, 0.45), sil, lt.sil * 0.8));
    for (x = gl.x; x < gl.x + gl.w; x++) { var fh = 3 + Math.round(1.5 * Math.sin(x * 0.07 + seed) + 1.2 * Math.sin(x * 0.19)); R(g, far, x, hy - fh, 1, fh); }
    // the waterfront: houses, towers, a spire, a dome
    var litC = '#FFD27A', snow = rgb(mixc(mixc(white, lt.low, 0.15), sil, lt.sil * 0.72));
    var bx = -2, bi = 0;
    while (bx < win.x + win.w + 12) {
      var bw = 6 + Math.floor(hash(bi, seed + 21) * 6), bh = 5 + Math.floor(hash(bi, seed + 22) * 5), kind = bi % 9;
      var fc = mixc(mixc(hexc(FACADE[Math.floor(hash(bi, seed + 23) * FACADE.length)]), lt.low, 0.2), sil, lt.sil);
      var roof = rgb(mixc(mixc(hexc(hash(bi, 24) < 0.5 ? '#6A5650' : '#8A5546'), lt.low, 0.2), sil, lt.sil));
      var copper = rgb(mixc(mixc([116, 165, 148], lt.low, 0.2), sil, lt.sil));
      if (bx + bw >= gl.x - 2 && bx <= gl.x + gl.w + 2) {
        if (kind === 4) { // town hall tower: brick, a lantern, a golden tip
          bw = 6; bh = 17; fc = mixc(mixc([168, 100, 74], lt.low, 0.2), sil, lt.sil);
          R(g, rgb(fc), bx, hy - bh, bw, bh); R(g, copper, bx + 1, hy - bh - 3, 4, 3); R(g, copper, bx + 2, hy - bh - 5, 2, 2);
          R(g, rgb(mixc([231, 195, 90], sil, lt.sil * 0.6)), bx + 2, hy - bh - 7, 1, 2); R(g, snow, bx, hy - bh, bw, 1);
        } else if (kind === 7) { // church with an iron spire
          bw = 5; bh = 11;
          R(g, rgb(fc), bx, hy - bh, bw, bh); R(g, roof, bx + 1, hy - bh - 3, 3, 3); R(g, roof, bx + 2, hy - bh - 9, 1, 6); R(g, snow, bx, hy - bh, bw, 1);
        } else if (kind === 1 && bi % 18 === 1) { // a dome
          bw = 11; bh = 8;
          R(g, rgb(fc), bx, hy - bh, bw, bh); g.fillStyle = copper; cut(g, bx + 2, hy - bh - 4, 7, 4, 2); R(g, copper, bx + 5, hy - bh - 6, 1, 2); R(g, snow, bx + 3, hy - bh - 4, 5, 1);
        } else {
          R(g, rgb(fc), bx, hy - bh, bw, bh); R(g, roof, bx, hy - bh - 2, bw, 2); R(g, roof, bx + 1, hy - bh - 3, bw - 2, 1); R(g, snow, bx + 1, hy - bh - 3, bw - 2, 1);
        }
        var dayWin = rgb(mixc(fc, [70, 60, 62], 0.4));
        for (y = hy - bh + 2; y < hy - 1; y += 2) for (x = bx + 1; x < bx + bw - 1; x += 2) {
          var isLit = hash(x * 31 + y, seed + bi) < lt.lit * 0.62;
          R(g, isLit ? litC : dayWin, x, y, 1, 1);
          if (isLit && hash(x, y + 5) < 0.5) R(g, rgb([255, 210, 122], 0.4), x, hy + 2 + Math.floor(hash(x, 7) * 4), 1, 2);
        }
      }
      bx += bw + (hash(bi, 25) < 0.25 ? 1 : 0); bi++;
    }
    // quay and water
    R(g, rgb(mixc(mixc([214, 205, 190], lt.low, 0.3), sil, lt.sil * 0.9)), gl.x, hy, gl.w, 1);
    R(g, rgb(lt.water), gl.x, hy + 1, gl.w, gl.y + gl.h - hy - 1);
    var rip = rgb(mixc(lt.water, lt.low, 0.4));
    for (i = 0; i < gl.w / 7; i++) R(g, rip, gl.x + Math.floor(hash(i, seed + 51) * gl.w), hy + 2 + Math.floor(hash(i, 52) * (gl.y + gl.h - hy - 3)), 3 + Math.floor(hash(i, 53) * 6), 1);
    if (lt.sun && lt.sil < 0.97) { // the sun on the water
      var su = clamp(lt.sunU, 0, 1), rx = Math.round(gl.x + gl.w * (0.14 + 0.72 * su)), rc = rgb(mixc([255, 190, 130], [255, 250, 230], Math.sin(Math.PI * su)), 0.55);
      for (y = hy + 2; y < gl.y + gl.h; y += 2) R(g, rc, rx - 2 + ((y >> 1) % 2), y, 4, 1);
    }
    g.restore();
  };
  var paintFloor = function (g, L, seed) {
    var y = L.floorY, h = 6, row = 0, x;
    R(g, C.floor, 0, y, L.W, L.H - y);
    while (y < L.H) {
      R(g, C.floorLine, 0, y, L.W, 1);
      x = -Math.floor(hash(row, seed + 61) * 90);
      while (x < L.W) {
        var pl = 70 + Math.floor(hash(row * 17 + x, seed + 62) * 80), tone = hash(row * 13 + x, 63);
        if (tone < 0.3) R(g, C.floorA, x + 1, y + 1, pl - 1, h - 1); else if (tone > 0.7) R(g, C.floorB, x + 1, y + 1, pl - 1, h - 1);
        R(g, C.floorLine, x + pl, y + 1, 1, h - 1); x += pl;
      }
      y += h; h += 1; row++;
    }
    R(g, 'rgba(120,90,50,0.10)', 0, L.floorY, L.W, 2);
  };
  var paintRug = function (g, x, y, w, h, c1, c2, c3) { // a flat woven runner with a border and fringes
    R(g, c2, x, y, w, h); R(g, c1, x + 1, y + 1, w - 2, h - 2); R(g, c3, x + 3, y + 2, w - 6, 1); R(g, c3, x + 3, y + h - 3, w - 6, 1);
    for (var i = 0; i < h; i += 2) { R(g, c3, x - 1, y + i, 1, 1); R(g, c3, x + w, y + i, 1, 1); }
  };
  var paintPrint = function (g, x, y, kind) { // a small framed print
    box(g, x, y, 15, 19, 0, C.paper, C.oak);
    if (kind === 0) { g.fillStyle = C.terracotta; ell(g, x + 7, y + 7, 3, 3); R(g, C.sageDark, x + 2, y + 12, 11, 5); R(g, C.dusty, x + 2, y + 14, 11, 3); }
    else { R(g, C.mustard, x + 3, y + 3, 5, 8); R(g, C.dusty, x + 7, y + 7, 5, 8); R(g, C.rose, x + 4, y + 12, 4, 3); }
  };
  var paintRoom = function (g, L, lt, seed) {
    var W = L.W, i, x;
    R(g, C.wall, 0, 0, W, L.dadoY); R(g, C.wallShade, 0, 0, W, 2);
    R(g, C.sage, 0, L.dadoY, W, L.floorY - L.dadoY); R(g, C.sageLight, 0, L.dadoY, W, 1); R(g, C.sageDark, 0, L.dadoY + 1, W, 1);
    for (x = 14; x < W; x += 26) R(g, C.sageDark, x, L.dadoY + 4, 1, L.floorY - L.dadoY - 9);
    R(g, C.base, 0, L.floorY - 3, W, 3); R(g, C.baseShade, 0, L.floorY - 1, W, 1);
    paintFloor(g, L, seed);
    paintOutside(g, L.win, lt, seed); paintFrame(g, L.win);
    // small pots on the sill
    var sillY = L.win.y + L.win.h - 1, pots = [L.win.x + L.win.w - 13, L.win.x + 9, L.win.x + Math.round(L.win.w * 0.55)];
    for (i = 0; i < (L.win.w > 150 ? 3 : 2); i++) {
      x = pots[i]; R(g, i === 1 ? C.white : C.pot, x, sillY - 3, 4, 3); R(g, i === 1 ? C.whiteShade : C.potDark, x, sillY - 1, 4, 1);
      R(g, C.leafDark, x + 1, sillY - 6, 2, 3); R(g, C.leaf, x - 1, sillY - 5, 2, 2); R(g, C.leafLight, x + 3, sillY - 7, 2, 3);
    }
    // sunlight on the floor through each pane
    var sunny = clamp(1 - lt.veil * 2, 0, 1) * (lt.sun ? 1 : 0);
    if (sunny > 0.02) {
      var gl = glassOf(L.win), ms = [gl.x - 2].concat(mullions(L.win)).concat([gl.x + gl.w]), k = lerp(0.9, -0.9, clamp(lt.sunU, 0, 1));
      var tint = mixc([255, 214, 170], [255, 247, 224], Math.sin(Math.PI * clamp(lt.sunU, 0, 1)));
      for (i = 0; i < ms.length - 1; i++) for (var y = L.floorY + 3; y < L.floorY + 31; y++) {
        var sh = Math.round((y - L.floorY) * k), a = 0.36 * sunny * (1 - (y - L.floorY - 3) / 34);
        R(g, rgb(tint, a.toFixed(3)), ms[i] + 4 + sh, y, ms[i + 1] - ms[i] - 6, 1);
      }
    }
    // the clock (its hands are drawn every frame)
    g.fillStyle = C.line; ell(g, L.clock.x, L.clock.y, 7, 7); g.fillStyle = C.paper; ell(g, L.clock.x, L.clock.y, 6, 6);
    R(g, C.lineSoft, L.clock.x, L.clock.y - 5, 1, 1); R(g, C.lineSoft, L.clock.x, L.clock.y + 5, 1, 1); R(g, C.lineSoft, L.clock.x - 5, L.clock.y, 1, 1); R(g, C.lineSoft, L.clock.x + 5, L.clock.y, 1, 1);
    if (!L.wide) { // under the clock: a small shelf with a trailing plant
      var sx0 = L.clock.x - 7, sy0 = L.dadoY - 3;
      R(g, C.wood, sx0, sy0, 14, 1); R(g, C.woodDark, sx0, sy0 + 1, 14, 1);
      R(g, C.pot, sx0 + 5, sy0 - 4, 5, 4); R(g, C.potDark, sx0 + 5, sy0 - 1, 5, 1);
      R(g, C.leaf, sx0 + 4, sy0 - 7, 3, 3); R(g, C.leafDark, sx0 + 7, sy0 - 8, 2, 4); R(g, C.leafLight, sx0 + 9, sy0 - 6, 3, 2);
      R(g, C.leaf, sx0 + 2, sy0 - 3, 2, 2); R(g, C.leaf, sx0 + 1, sy0 - 1, 1, 6); R(g, C.leafLight, sx0 + 1, sy0 + 5, 2, 2); R(g, C.leaf, sx0 + 11, sy0 - 3, 2, 3); R(g, C.leafDark, sx0 + 12, sy0, 1, 7);
    }
    if (L.wide) { // the wall over the coffee corner: a shelf with cups, two prints
      R(g, C.wood, 12, 29, 34, 2); R(g, C.woodDark, 12, 31, 34, 1); R(g, C.woodDark, 16, 32, 1, 2); R(g, C.woodDark, 41, 32, 1, 2);
      var cups = [C.white, C.terracotta, C.dusty, C.mustard];
      for (i = 0; i < 4; i++) { R(g, cups[i], 15 + i * 5, 25, 3, 4); R(g, C.lineSoft, 15 + i * 5, 28, 3, 1); }
      R(g, C.pot, 37, 25, 5, 4); R(g, C.leaf, 36, 21, 3, 4); R(g, C.leafDark, 39, 19, 2, 6); R(g, C.leafLight, 41, 22, 3, 3); R(g, C.leaf, 43, 25, 1, 5); R(g, C.leaf, 35, 25, 1, 3);
      if (L.table.x + 28 < L.win.x - 3) paintPrint(g, L.table.x + 12, 10, 0);
      if (L.table.x + 47 < L.win.x - 3) paintPrint(g, L.table.x + 31, 14, 1);
      if (W - L.clock.x > 62) paintPrint(g, L.clock.x + 34, 12, 1);
      if (W - L.clock.x > 96) paintPrint(g, L.clock.x + 56, 9, 0);
    }
    if (L.bigRug) { // a large woven rug on the open floor of a very wide room
      var br = L.bigRug;
      paintRug(g, br.x, br.y, br.w, br.h, '#EADFCB', '#C9A98A', '#F6F0E2');
      for (x = br.x + 8; x < br.x + br.w - 12; x += 22) { R(g, '#D9A98C', x, br.y + 5, 8, br.h - 10); R(g, '#C7D2BE', x + 11, br.y + 8, 5, br.h - 16); }
    }
    // rugs: a runner where the queue stands, an oval one under the coffee table
    var qn = Math.min(L.q.per, 5), rx0 = L.q.x - (qn - 1) * L.q.d - 11;
    if (!L.wide) rx0 = Math.max(rx0, L.table.x + 14);
    paintRug(g, rx0, L.q.y - 6, L.q.x + 10 - rx0, 10, '#AFC3D2', '#7F9BB3', '#F1EBDD');
    if (L.wide) { var ox = L.table.x, oy = L.table.y - 3, orx = Math.min(60, L.table.x - 5); g.fillStyle = '#AEBFA2'; ell(g, ox, oy, orx, 13); g.fillStyle = '#CBD8C0'; ell(g, ox, oy, orx - 2, 12); g.fillStyle = '#AEBFA2'; ell(g, ox, oy, orx - 11, 9); g.fillStyle = '#CBD8C0'; ell(g, ox, oy, orx - 12, 8); }
    // pendant lamps
    for (i = 0; i < L.lamps.length; i++) {
      var p = L.lamps[i], ly = p.len;
      if (p.floor) continue;
      R(g, C.metalDark, p.x, 0, 1, ly);
      R(g, p.c, p.x - 2, ly, 5, 1); R(g, p.c, p.x - 3, ly + 1, 7, 1); R(g, p.c, p.x - 4, ly + 2, 9, 2);
      R(g, 'rgba(60,45,30,0.28)', p.x - 4, ly + 3, 9, 1); R(g, 'rgba(255,255,255,0.35)', p.x - 2, ly + 1, 2, 1);
      R(g, lt.lamp > 0.2 ? '#FFF3C4' : '#EFE8D8', p.x - 1, ly + 4, 3, 1);
      if (lt.lamp > 0.2) {
        R(g, rgb([255, 232, 160], (0.4 * lt.lamp).toFixed(2)), p.x - 3, ly + 4, 7, 2); R(g, rgb([255, 232, 160], (0.22 * lt.lamp).toFixed(2)), p.x - 5, ly + 5, 11, 2);
        var overGlass = p.x > L.win.x - 8 && p.x < L.win.x + L.win.w + 8;
        for (var by = ly + 6; by < ly + 44; by++) { if (overGlass && by < L.win.y + L.win.h + 2) continue; var bt = (by - ly - 6) / 38; R(g, rgb([255, 228, 160], (0.085 * lt.lamp * (1 - bt)).toFixed(3)), p.x - 4 - Math.round(bt * 20), by, 9 + Math.round(bt * 20) * 2, 1); }
      }
    }
  };
  // the night: a dark veil over the room with pools of lamp light cut out of it (painted at logical size, cached)
  var paintVeil = function (g, L, lt) {
    var a = lt.veil * 0.27, i, y, j;
    g.clearRect(0, 0, L.W, L.H);
    if (a < 0.012) return false;
    R(g, 'rgba(18,34,108,' + a.toFixed(3) + ')', 0, 0, L.W, L.H);
    g.globalCompositeOperation = 'destination-out';
    var gl = glassOf(L.win); R(g, '#000', gl.x, gl.y, gl.w, gl.h);
    for (i = 0; i < L.lamps.length; i++) {
      var p = L.lamps[i], s = lt.lamp;
      g.fillStyle = 'rgba(0,0,0,' + (0.19 * s).toFixed(3) + ')';
      for (j = 0; j < 6; j++) ell(g, p.x, p.py, Math.round(p.rx * (1 - j * 0.15)), Math.round(p.ry * (1 - j * 0.15)));
      ell(g, p.x, p.len + 6, 24, 17); ell(g, p.x, p.len + 6, 18, 13); ell(g, p.x, p.len + 5, 13, 10); ell(g, p.x, p.len + 5, 9, 7); ell(g, p.x, p.len + 5, 5, 4);
      g.fillStyle = 'rgba(0,0,0,' + (0.07 * s).toFixed(3) + ')';
      var y1 = p.py - Math.round(p.ry * 0.6);
      for (y = p.len + 6; y < y1 && !p.floor; y++) { var half = Math.round(lerp(4, p.rx * 0.5, (y - p.len - 6) / Math.max(1, y1 - p.len - 6))); g.fillRect(p.x - half, y, half * 2, 1); }
    }
    g.globalCompositeOperation = 'source-over';
    for (i = 0; i < L.lamps.length; i++) {
      var q = L.lamps[i];
      g.fillStyle = 'rgba(255,186,100,' + (0.085 * lt.lamp * lt.veil).toFixed(3) + ')';
      ell(g, q.x, q.py, Math.round(q.rx * 0.82), Math.round(q.ry * 0.82)); ell(g, q.x, q.py, Math.round(q.rx * 0.5), Math.round(q.ry * 0.5));
      ell(g, q.x, q.len + 6, 20, 14); ell(g, q.x, q.len + 5, 11, 8);
    }
    g.clearRect(gl.x, gl.y, gl.w, gl.h); // the window keeps its own light
    return true;
  };

  // ---------------------------------------------------------------- furniture sprites (each on its own small canvas)
  // a sprite's anchor (ox, oy) is the middle of its base on the floor
  var sprite = function (w, h, ox, oy, fn) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'); if (g) fn(g, ox, oy);
    return { c: c, ox: ox, oy: oy, w: w, h: h };
  };
  // an agent's desk, seen from the front: birch top, white front, a monitor on the left, a signal lamp on the right
  var deskGeo = function (dw) { var hw = Math.floor(dw / 2); return { hw: hw, sx: -hw + 2, sy: -23, sw: 11, sh: 8, lx: hw - 6, ly: -19 }; };
  var mkDesk = function (dw) {
    var q = deskGeo(dw), hw = q.hw;
    return sprite(dw + 2, 27, hw + 1, 25, function (g, ax, ay) {
      R(g, 'rgba(90,60,30,0.16)', ax - hw + 1, ay, dw - 2, 1);
      R(g, C.woodLight, ax - hw, ay - 13, dw, 3); R(g, '#F4E2C0', ax - hw, ay - 13, dw, 1); R(g, C.wood, ax - hw, ay - 10, dw, 1); R(g, C.woodDark, ax - hw, ay - 9, dw, 1);
      R(g, C.white, ax - hw + 1, ay - 8, dw - 2, 8); R(g, C.wood, ax - hw, ay - 8, 2, 8); R(g, C.wood, ax + hw - 2, ay - 8, 2, 8); R(g, C.whiteShade, ax - hw + 2, ay - 8, 1, 8); R(g, C.whiteShade, ax + hw - 3, ay - 8, 1, 8); R(g, C.baseShade, ax - hw + 2, ay - 1, dw - 4, 1);
      // keyboard strip in front of the seat
      R(g, '#D9D2C4', ax + (dw >= 32 ? 5 : 4) - 5, ay - 12, 10, 1);
      // monitor: white bezel, the screen itself is painted every frame
      R(g, C.whiteShade, ax + q.sx + 4, ay - 14, 5, 1); R(g, '#CFC7B8', ax + q.sx + 6, ay - 15, 1, 1);
      box(g, ax + q.sx - 1, ay + q.sy - 1, q.sw + 2, q.sh + 2, 1, '#23262B', '#F7F3EA');
      R(g, C.whiteShade, ax + q.sx, ay + q.sy + q.sh, q.sw, 1);
      // lamp: base and dark glass (the colour is painted every frame)
      R(g, C.metalDark, ax + q.lx, ay - 14, 5, 1); g.fillStyle = C.lampOff; cut(g, ax + q.lx, ay + q.ly, 5, 5, 1);
    });
  };
  // the big desk: oak, a paper tray on the left, a laptop, a mug and a small lamp
  var mkBoss = function (bw) {
    var hw = Math.floor(bw / 2);
    return sprite(bw + 2, 33, hw + 1, 31, function (g, ax, ay) {
      R(g, 'rgba(90,60,30,0.18)', ax - hw + 1, ay, bw - 2, 1);
      R(g, '#DDB884', ax - hw, ay - 15, bw, 4); R(g, '#E9CCA0', ax - hw, ay - 15, bw, 1); R(g, C.oak, ax - hw, ay - 11, bw, 1); R(g, C.oakDark, ax - hw, ay - 10, bw, 1);
      R(g, '#D2A873', ax - hw + 1, ay - 9, bw - 2, 9); R(g, C.oak, ax - hw + 1, ay - 9, 2, 9); R(g, C.oak, ax + hw - 3, ay - 9, 2, 9); R(g, C.oakDark, ax - hw + 1, ay - 1, bw - 2, 1);
      for (var i = 0; i < 3; i++) R(g, '#C89C66', ax - hw + 6 + i * Math.floor(bw / 3), ay - 6 + (i % 2) * 2, Math.floor(bw / 5), 1);
      // tray (the stack of slips is painted every frame)
      var tx = ax - hw + 3;
      R(g, C.metalDark, tx, ay - 16, 13, 1); R(g, C.metalDark, tx, ay - 18, 1, 2); R(g, C.metalDark, tx + 12, ay - 18, 1, 2);
      // laptop, lid toward us
      var lx = ax - (bw >= 60 ? 10 : 8);
      box(g, lx, ay - 24, 12, 9, 1, '#CDD2D6', '#9AA1A8'); R(g, '#F4F6F7', lx + 5, ay - 21, 2, 2); R(g, '#AEB5BB', lx - 1, ay - 15, 14, 1);
      // mug and a small desk lamp on the right
      var rx = ax + hw - 9;
      if (bw >= 60) { R(g, C.white, rx - 6, ay - 18, 3, 3); R(g, C.whiteShade, rx - 3, ay - 17, 1, 1); R(g, C.whiteShade, rx - 6, ay - 16, 3, 1); }
      R(g, C.char, rx, ay - 16, 6, 1); R(g, C.char, rx + 3, ay - 25, 1, 9); R(g, C.mustard, rx + 1, ay - 28, 5, 1); R(g, C.mustard, rx, ay - 27, 7, 2); R(g, '#C4933A', rx, ay - 25, 7, 1);
    });
  };
  var paintMachine = function (g, x, y) { // coffee machine, 13 wide, its foot at (x, y)
    box(g, x, y - 18, 13, 18, 1, C.char, '#2A292D'); R(g, C.charLight, x + 1, y - 17, 11, 2);
    R(g, '#1C1B1E', x + 3, y - 10, 7, 7); R(g, C.metal, x + 5, y - 11, 3, 2); R(g, C.metal, x + 2, y - 3, 9, 1);
    R(g, C.white, x + 5, y - 6, 3, 3); R(g, C.whiteShade, x + 5, y - 4, 3, 1);
    R(g, C.amber, x + 2, y - 13, 1, 1); R(g, C.red, x + 4, y - 13, 1, 1); R(g, '#7FD2C7', x + 9, y - 14, 2, 2);
  };
  var mkCounter = function (w) { // the sideboard against the wall, with the machine, cups, a jar and a plant
    var hw = Math.floor(w / 2);
    return sprite(w + 2, 40, hw + 1, 38, function (g, ax, ay) {
      R(g, 'rgba(90,60,30,0.16)', ax - hw + 1, ay, w - 2, 1);
      R(g, C.woodDark, ax - hw + 3, ay - 3, 2, 3); R(g, C.woodDark, ax + hw - 5, ay - 3, 2, 3);
      R(g, C.white, ax - hw, ay - 16, w, 13); R(g, C.whiteShade, ax - hw, ay - 4, w, 1); R(g, C.whiteShade, ax - hw, ay - 16, 1, 13); R(g, C.whiteShade, ax + hw - 1, ay - 16, 1, 13);
      for (var i = 1; i < 3; i++) { var dx = ax - hw + Math.round(w * i / 3); R(g, C.whiteShade, dx, ay - 15, 1, 11); R(g, C.wood, dx - 3, ay - 10, 2, 1); R(g, C.wood, dx + 2, ay - 10, 2, 1); }
      R(g, C.woodLight, ax - hw - 1, ay - 19, w + 2, 2); R(g, C.wood, ax - hw - 1, ay - 17, w + 2, 1);
      paintMachine(g, ax - hw + 4, ay - 19);
      for (i = 0; i < 3; i++) { R(g, C.white, ax + 1, ay - 22 - i * 2, 4, 2); R(g, C.whiteShade, ax + 1, ay - 21 - i * 2, 4, 1); }
      box(g, ax + 7, ay - 26, 5, 7, 1, '#9A6B45', C.lineSoft); R(g, C.wood, ax + 7, ay - 27, 5, 1); R(g, '#C9A27A', ax + 8, ay - 25, 3, 1);
      R(g, C.pot, ax + hw - 8, ay - 23, 6, 4); R(g, C.potDark, ax + hw - 8, ay - 20, 6, 1);
      R(g, C.leafDark, ax + hw - 6, ay - 29, 2, 6); R(g, C.leaf, ax + hw - 9, ay - 27, 3, 3); R(g, C.leafLight, ax + hw - 4, ay - 30, 3, 4); R(g, C.leaf, ax + hw - 3, ay - 26, 3, 2);
    });
  };
  var mkCart = function (w) { // a small trolley with the machine, for the narrow room
    var hw = Math.floor(w / 2);
    return sprite(w + 2, 36, hw + 1, 34, function (g, ax, ay) {
      R(g, 'rgba(90,60,30,0.16)', ax - hw + 1, ay, w - 2, 1);
      R(g, C.metalDark, ax - hw + 1, ay - 2, 2, 2); R(g, C.metalDark, ax + hw - 3, ay - 2, 2, 2);
      R(g, C.wood, ax - hw, ay - 14, 1, 12); R(g, C.wood, ax + hw - 1, ay - 14, 1, 12);
      R(g, C.woodLight, ax - hw, ay - 6, w, 2); R(g, C.wood, ax - hw, ay - 4, w, 1);
      R(g, C.white, ax - hw + 3, ay - 10, 3, 4); R(g, C.dusty, ax - hw + 7, ay - 10, 3, 4); R(g, C.white, ax - hw + 11, ay - 9, 3, 3);
      R(g, C.woodLight, ax - hw - 1, ay - 16, w + 2, 2); R(g, C.wood, ax - hw - 1, ay - 14, w + 2, 1);
      paintMachine(g, ax - 7, ay - 16);
    });
  };
  var mkTable = function () { // small round café table with a cup and a bun: fika
    return sprite(26, 22, 13, 20, function (g, ax, ay) {
      R(g, 'rgba(90,60,30,0.16)', ax - 5, ay, 10, 1);
      R(g, C.woodDark, ax - 4, ay - 1, 8, 1); R(g, C.wood, ax - 2, ay - 2, 4, 1); R(g, C.wood, ax - 1, ay - 9, 2, 7);
      g.fillStyle = C.whiteShade; ell(g, ax, ay - 10, 11, 2); g.fillStyle = C.white; ell(g, ax, ay - 11, 11, 2);
      R(g, C.white, ax - 6, ay - 16, 4, 3); R(g, C.line, ax - 6, ay - 13, 4, 1); R(g, '#7A5236', ax - 5, ay - 16, 2, 1);
      R(g, C.paperShade, ax + 1, ay - 12, 7, 1); R(g, '#C98B4E', ax + 2, ay - 14, 5, 2); R(g, '#E3B77C', ax + 3, ay - 14, 2, 1);
    });
  };
  var mkPouf = function (kind) { // a soft seat on the lounge rug
    var c = kind ? ['#E3A6A0', '#C98680', '#F0C4BE'] : ['#E2B04A', '#C4933A', '#EFCB7C'];
    return sprite(16, 10, 8, 9, function (g, ax, ay) {
      R(g, 'rgba(90,60,30,0.16)', ax - 6, ay, 12, 1);
      box(g, ax - 7, ay - 8, 14, 8, 2, c[0], c[1]); R(g, c[2], ax - 4, ay - 7, 8, 1); R(g, c[1], ax - 5, ay - 3, 10, 1);
    });
  };
  var mkArmchair = function () { // a low wooden armchair with sage cushions
    return sprite(28, 24, 14, 22, function (g, ax, ay) {
      R(g, 'rgba(90,60,30,0.16)', ax - 10, ay, 20, 1);
      R(g, C.woodDark, ax - 10, ay - 4, 2, 4); R(g, C.woodDark, ax + 8, ay - 4, 2, 4);
      box(g, ax - 9, ay - 21, 18, 13, 2, '#A9BBA0', '#869A7D'); R(g, '#BFCDB6', ax - 6, ay - 19, 12, 1);
      box(g, ax - 10, ay - 10, 20, 7, 1, '#B9C9B0', '#869A7D'); R(g, '#CBD8C2', ax - 8, ay - 9, 16, 1);
      R(g, C.wood, ax - 12, ay - 14, 3, 10); R(g, C.woodLight, ax - 12, ay - 15, 4, 1); R(g, C.wood, ax + 9, ay - 14, 3, 10); R(g, C.woodLight, ax + 8, ay - 15, 4, 1);
      box(g, ax - 4, ay - 17, 8, 7, 1, C.mustard, '#C4933A'); R(g, '#EFCB7C', ax - 2, ay - 15, 4, 1);
    });
  };
  var mkFloorLamp = function (lit) { // a slim floor lamp with a drum shade
    return sprite(16, 42, 8, 40, function (g, ax, ay) {
      R(g, 'rgba(90,60,30,0.16)', ax - 3, ay, 7, 1);
      R(g, C.char, ax - 3, ay - 1, 7, 1); R(g, C.char, ax, ay - 31, 1, 30);
      if (lit) { g.fillStyle = 'rgba(255,232,160,0.3)'; cut(g, ax - 7, ay - 40, 15, 13, 2); }
      box(g, ax - 5, ay - 38, 11, 8, 1, lit ? '#FFF6D8' : '#F4EEDF', lit ? '#E2C98A' : C.baseShade); R(g, lit ? '#FFFFFF' : '#FAF6EE', ax - 3, ay - 36, 7, 1);
    });
  };
  var mkShelf = function (seed) { // a low bookshelf with two rows of books, a plant and a small frame on top
    var cols = ['#8FA9BF', C.terracotta, C.mustard, C.sageDark, C.white, C.rose, '#6F8796', '#C9A27A'];
    return sprite(46, 36, 23, 34, function (g, ax, ay) {
      var x, r, i = 0, bw, bh;
      R(g, 'rgba(90,60,30,0.16)', ax - 20, ay, 40, 1);
      R(g, C.woodDark, ax - 19, ay - 2, 2, 2); R(g, C.woodDark, ax + 17, ay - 2, 2, 2);
      box(g, ax - 21, ay - 25, 42, 23, 0, '#E3CDA4', C.wood); R(g, C.wood, ax - 20, ay - 14, 40, 1); R(g, C.woodLight, ax - 22, ay - 26, 44, 2);
      for (r = 0; r < 2; r++) for (x = ax - 19; x < ax + 16;) {
        bw = 2 + Math.floor(hash(i, seed + 5) * 2); bh = 6 + Math.floor(hash(i, seed + 6) * 3);
        if (hash(i, seed + 7) < 0.14) { x += 3; i++; continue; }
        R(g, cols[Math.floor(hash(i, seed + 8) * cols.length)], x, ay - 15 + r * 11 - bh, bw, bh); x += bw + (hash(i, seed + 9) < 0.3 ? 1 : 0); i++;
      }
      R(g, C.pot, ax + 9, ay - 30, 6, 4); R(g, C.leafDark, ax + 11, ay - 35, 2, 5); R(g, C.leaf, ax + 8, ay - 33, 3, 3); R(g, C.leafLight, ax + 13, ay - 34, 3, 3);
      box(g, ax - 16, ay - 33, 8, 7, 0, C.paper, C.oak); R(g, C.dusty, ax - 14, ay - 31, 4, 3);
    });
  };
  var mkPlant = function (kind, f) { // f = 0 or 1: two frames, so the leaves can sway
    var G = [C.leaf, C.leafDark, C.leafLight];
    return sprite(28, 40, 14, 38, function (g, ax, ay) {
      var i, lv;
      R(g, 'rgba(90,60,30,0.16)', ax - 5, ay, 11, 1);
      if (kind === 0) {
        R(g, C.woodDark, ax - 4, ay - 2, 1, 2); R(g, C.woodDark, ax + 3, ay - 2, 1, 2);
        box(g, ax - 5, ay - 11, 10, 9, 1, C.white, C.baseShade); R(g, C.whiteShade, ax - 4, ay - 4, 8, 1);
        R(g, '#8A6A4A', ax, ay - 25, 1, 14);
        lv = [[-7, -17, 6, 4, 0, 0], [1, -20, 7, 4, 1, 0], [-6, -24, 6, 4, 2, 1], [1, -28, 6, 4, 0, 1], [-4, -33, 7, 5, 2, 1], [2, -15, 5, 3, 1, 0], [-1, -36, 4, 3, 0, 1]];
      } else {
        box(g, ax - 6, ay - 9, 13, 9, 2, '#DCC096', C.woodDark); R(g, C.woodDark, ax - 4, ay - 6, 9, 1); R(g, C.woodDark, ax - 4, ay - 3, 9, 1);
        R(g, C.leafDark, ax, ay - 16, 1, 7); R(g, C.leafDark, ax - 3, ay - 13, 1, 4); R(g, C.leafDark, ax + 3, ay - 14, 1, 5);
        lv = [[-12, -17, 8, 5, 1, 0], [3, -19, 9, 6, 0, 0], [-5, -27, 9, 7, 2, 1], [-13, -11, 6, 4, 0, 0], [7, -12, 6, 4, 1, 0], [-2, -19, 6, 5, 0, 1], [4, -30, 6, 5, 1, 1], [-10, -24, 6, 5, 0, 1]];
      }
      for (i = 0; i < lv.length; i++) { g.fillStyle = G[lv[i][4]]; cut(g, ax + lv[i][0] + (lv[i][5] ? f : 0), ay + lv[i][1], lv[i][2], lv[i][3], 1); }
      for (i = 0; i < lv.length; i++) R(g, 'rgba(255,255,255,0.22)', ax + lv[i][0] + (lv[i][5] ? f : 0) + 1, ay + lv[i][1] + 1, Math.max(1, lv[i][2] - 4), 1);
    });
  };

  // ---------------------------------------------------------------- the robots and the person
  // p: { x, y, raise, bob, sit, flip, face, back, eyes, step, armM, armO, hdx, hdy, hue, look, glow, mouth }
  //  (x, y) is the point on the floor between the feet. flip mirrors the hands (what is carried changes side).
  //  eyes: 0 open, 1 closed, 2 looking down, 3 crossed out, 4 smiling.  armM (main hand): 0 down, 1 on the desk,
  //  2 holding the slip, 3 cup at the chest, 4 cup at the mouth.  armO (other hand): 0 down, 1 on the desk, 2 raised.
  var drawBot = function (g, p) {
    var x = p.x, y = p.y - p.raise, b = p.bob, h = p.hue, fx = p.back ? 0 : p.face;
    var hx = x + p.hdx + fx, hy = y + b + p.hdy, ex = hx + fx, ey = hy - 22, look = p.look;
    var M = function (dx, w) { return p.flip ? x - dx - w : x + dx; };
    if (!p.sit) { R(g, 'rgba(70,45,20,0.22)', p.x - 6, p.y, 12, 1); R(g, 'rgba(70,45,20,0.12)', p.x - 4, p.y + 1, 8, 1); }
    // the bulb sits behind the head's top edge
    if (look === 'bulb') {
      if (p.glow) { g.fillStyle = 'rgba(255,224,110,0.35)'; cut(g, hx - 7, hy - 36, 14, 10, 2); }
      g.fillStyle = C.line; cut(g, hx - 4, hy - 34, 9, 9, 2); g.fillStyle = p.glow ? '#FFE27A' : '#FFF6D2'; cut(g, hx - 3, hy - 33, 7, 7, 2);
      R(g, h.d, hx - 1, hy - 30, 1, 3); R(g, h.d, hx + 1, hy - 30, 1, 3); R(g, h.d, hx, hy - 31, 1, 1); R(g, '#FFFFFF', hx - 2, hy - 32, 1, 2);
    }
    // legs and feet (hidden when it sits): walking sideways the feet scissor, walking toward us they lift in turn
    if (!p.sit) {
      var sx = p.back ? 0 : p.face, st = p.step, lx = 0, rx = 0, ly = 0, ry = 0;
      if (st >= 0 && sx) { if (st === 0) { lx = 2 * sx; rx = -sx; } else if (st === 1) { lx = sx; ry = 1; } else if (st === 2) { rx = 2 * sx; lx = -sx; } else { rx = sx; ly = 1; } }
      else if (st === 1) ly = 1; else if (st === 3) ry = 1;
      R(g, C.metal, x - 4 + (lx > 0 ? 1 : lx < 0 ? -1 : 0), y - 5 + b, 2, 3 - b - ly); R(g, C.metal, x + 2 + (rx > 0 ? 1 : rx < 0 ? -1 : 0), y - 5 + b, 2, 3 - b - ry);
      R(g, C.metalDark, x - 5 + lx, y - 2 - ly, 4, 2); R(g, C.metalDark, x + 1 + rx, y - 2 - ry, 4, 2);
    }
    // body: the accent colour, a light belly panel
    box(g, x - 6, y - 14 + b, 12, 10, 2, h.m, C.line);
    if (!p.back) { R(g, h.l, x - 3 + fx, y - 11 + b, 6, 4); R(g, C.white, x - 2 + fx, y - 10 + b, 2, 1); R(g, h.d, x + 1 + fx, y - 9 + b, 2, 1); }
    else R(g, h.d, x - 3, y - 11 + b, 6, 1);
    // the other hand (left unless flipped) and what it carries
    if (p.armO === 2 || look === 'gavel') {
      R(g, C.line, M(-9, 1), y - 13 + b, 1, 3); R(g, h.d, M(-8, 2), y - 13 + b, 2, 3); R(g, h.d, M(-9, 2), y - 15 + b, 2, 3); R(g, C.line, M(-10, 1), y - 15 + b, 1, 3);
      if (look === 'gavel') {
        var gy = y + b - (p.tap ? 0 : 2);
        R(g, C.oakDark, M(-9, 1), gy - 24, 1, 10); box(g, M(-12, 7), gy - 29, 7, 5, 1, C.wood, C.line); R(g, C.woodLight, M(-11, 1), gy - 28, 1, 3); R(g, C.woodLight, M(-7, 1), gy - 28, 1, 3);
      }
      R(g, C.shell, M(-10, 2), y - 16 + b, 2, 2);
    } else if (p.armO === 1) { R(g, C.line, M(-9, 1), y - 12 + b, 1, 3); R(g, h.d, M(-8, 2), y - 12 + b, 2, 3); }
    else { var lo = 5 - (p.swing > 0 ? 1 : 0); R(g, C.line, M(-9, 1), y - 12 + b, 1, lo + 2); R(g, h.d, M(-8, 2), y - 12 + b, 2, lo); R(g, C.shell, M(-8, 2), y - 12 + b + lo, 2, 2); }
    if (look === 'clipboard') {
      box(g, M(-13, 7), y - 16 + b, 7, 10, 0, C.oak, C.line); R(g, C.paper, M(-12, 5), y - 14 + b, 5, 7); R(g, C.metal, M(-11, 3), y - 17 + b, 3, 2);
      R(g, C.lineSoft, M(-11, 3), y - 13 + b, 3, 1); R(g, C.lineSoft, M(-11, 2), y - 11 + b, 2, 1); R(g, h.m, M(-11, 3), y - 9 + b, 3, 1); R(g, C.shell, M(-8, 2), y - 9 + b, 2, 2);
    }
    // the main hand
    if (p.armM === 0) { var lm = 5 - (p.swing < 0 ? 1 : 0); R(g, C.line, M(8, 1), y - 12 + b, 1, lm + 2); R(g, h.d, M(6, 2), y - 12 + b, 2, lm); R(g, C.shell, M(6, 2), y - 12 + b + lm, 2, 2); }
    else if (p.armM === 4) { R(g, C.line, M(8, 1), y - 14 + b, 1, 4); R(g, h.d, M(6, 2), y - 14 + b, 2, 4); }
    else { R(g, C.line, M(8, 1), y - 12 + b, 1, 4); R(g, h.d, M(6, 2), y - 12 + b, 2, p.armM === 1 ? 3 : 4); if (p.armM === 3) R(g, h.d, M(4, 2), y - 9 + b, 2, 1); }
    // neck and head
    R(g, C.metal, x - 2 + p.hdx, y - 15 + b, 4, 1 + Math.max(0, p.hdy));
    if (look !== 'headset') { R(g, C.metal, hx - 8, hy - 22, 1, 3); R(g, C.metal, hx + 7, hy - 22, 1, 3); }
    box(g, hx - 7, hy - 26, 14, 11, 2, C.shell, C.line); R(g, C.shellShade, hx - 5, hy - 17, 10, 1);
    if (p.back) { R(g, C.shellShade, hx - 3, hy - 23, 6, 4); R(g, C.metal, hx - 2, hy - 21, 4, 1); }
    else {
      if (p.eyes === 1) { R(g, C.eye, ex - 5, ey + 2, 3, 1); R(g, C.eye, ex + 2, ey + 2, 3, 1); }
      else if (p.eyes === 3) { for (var k = 0; k < 2; k++) { var qx = ex - 5 + k * 7; R(g, C.eye, qx, ey, 1, 1); R(g, C.eye, qx + 2, ey, 1, 1); R(g, C.eye, qx + 1, ey + 1, 1, 1); R(g, C.eye, qx, ey + 2, 1, 1); R(g, C.eye, qx + 2, ey + 2, 1, 1); } }
      else if (p.eyes === 4) { for (var j = 0; j < 2; j++) { var zx = ex - 5 + j * 7; R(g, C.eye, zx, ey + 1, 1, 1); R(g, C.eye, zx + 1, ey, 1, 1); R(g, C.eye, zx + 2, ey + 1, 1, 1); } }
      else { var dn = p.eyes === 2 ? 1 : 0; R(g, C.eye, ex - 5 + dn, ey + dn, 3, 3); R(g, C.eye, ex + 2 + dn, ey + dn, 3, 3); R(g, '#6E6862', ex - 5 + dn, ey + dn, 1, 1); R(g, '#6E6862', ex + 2 + dn, ey + dn, 1, 1); }
      R(g, C.blush, ex - 6, hy - 19, 2, 1); R(g, C.blush, ex + 4, hy - 19, 2, 1);
      if (p.mouth === 2) R(g, C.eye, ex - 1, hy - 19, 2, 2); else if (p.mouth === 1) { R(g, C.lineSoft, ex - 2, hy - 19, 1, 1); R(g, C.lineSoft, ex - 1, hy - 18, 2, 1); R(g, C.lineSoft, ex + 1, hy - 19, 1, 1); } else R(g, C.lineSoft, ex - 1, hy - 18, 2, 1);
    }
    // what makes each one itself
    if (look === 'headset') {
      R(g, C.line, hx - 6, hy - 28, 12, 1); R(g, h.d, hx - 6, hy - 27, 12, 1); R(g, C.line, hx - 8, hy - 27, 2, 3); R(g, C.line, hx + 6, hy - 27, 2, 3);
      R(g, C.line, hx - 10, hy - 24, 3, 7); R(g, h.m, hx - 9, hy - 23, 2, 5); R(g, C.line, hx + 7, hy - 24, 3, 7); R(g, h.m, hx + 7, hy - 23, 2, 5);
      if (!p.back) { // the microphone, on the side of the other hand
        if (p.flip) { R(g, C.line, hx + 8, hy - 17, 1, 1); R(g, C.line, hx + 5, hy - 17, 3, 1); R(g, h.m, hx + 3, hy - 18, 2, 2); }
        else { R(g, C.line, hx - 9, hy - 17, 1, 1); R(g, C.line, hx - 8, hy - 17, 3, 1); R(g, h.m, hx - 5, hy - 18, 2, 2); }
      }
    } else if (look === 'antenna') {
      R(g, C.metalDark, hx, hy - 31, 1, 5); g.fillStyle = C.line; cut(g, hx - 2, hy - 35, 5, 5, 1); R(g, p.glow ? h.l : h.m, hx - 1, hy - 34, 3, 3); R(g, '#FFFFFF', hx - 1, hy - 34, 1, 1);
      if (p.glow) { R(g, rgb(hexc(h.m), 0.3), hx - 3, hy - 36, 7, 1); R(g, rgb(hexc(h.m), 0.3), hx - 3, hy - 30, 7, 1); R(g, rgb(hexc(h.m), 0.3), hx - 3, hy - 35, 1, 5); R(g, rgb(hexc(h.m), 0.3), hx + 3, hy - 35, 1, 5); }
    } else if (look === 'bulb') { R(g, C.metal, hx - 3, hy - 26, 7, 1); }
    else if (look === 'plain') { R(g, C.metalDark, hx - 2, hy - 27, 4, 1); }
    else if (look === 'clipboard' && !p.back) { R(g, h.m, hx - 6, hy - 26, 12, 2); R(g, h.d, hx - 8 + (p.flip ? 0 : 10), hy - 25, 6, 1); } // a small cap
    // cup in the main hand
    if (p.armM === 3) { R(g, C.line, M(2, 5), y - 13 + b, 5, 5); R(g, C.white, M(3, 3), y - 12 + b, 3, 3); R(g, '#7A5236', M(3, 3), y - 12 + b, 3, 1); R(g, C.shell, M(6, 2), y - 9 + b, 2, 2); }
    else if (p.armM === 4) { R(g, C.line, M(2, 5), hy - 20, 5, 4); R(g, C.white, M(3, 3), hy - 19, 3, 2); R(g, C.line, M(6, 3), hy - 18, 3, 3); R(g, C.shell, M(6, 2), hy - 17, 2, 2); }
  };
  // the person at the big desk: a plain figure, no guess at looks
  var drawYou = function (g, x, y, turn, blink, nod) {
    box(g, x - 9, y - 25, 18, 15, 2, '#66707C', '#4A535E');
    box(g, x - 7, y - 23 + nod, 14, 13, 2, C.you, C.youDark); R(g, '#E9E4DA', x - 2, y - 23 + nod, 4, 1);
    R(g, C.youDark, x - 9, y - 20 + nod, 2, 9); R(g, C.you, x - 8, y - 20 + nod, 1, 9); R(g, C.youDark, x + 7, y - 20 + nod, 2, 9); R(g, C.you, x + 7, y - 20 + nod, 1, 9);
    R(g, '#D9CDBB', x - 1, y - 24 + nod, 3, 1);
    var hx = x + turn, hy = y + nod;
    box(g, hx - 5, hy - 35, 10, 11, 2, C.youHead, C.line); R(g, '#E2D6C4', hx - 3, hy - 26, 6, 1);
    R(g, C.youDark, hx - 3, hy - 35, 6, 1); R(g, C.youDark, hx - 4, hy - 34, 8, 2); if (turn >= 0) R(g, C.youDark, hx - 4, hy - 32, 1, 2); R(g, C.youDark, hx + 3, hy - 32, 1, turn < 0 ? 3 : 2);
    if (blink) { R(g, C.eye, hx - 3 + turn, hy - 30, 2, 1); R(g, C.eye, hx + 1 + turn, hy - 30, 2, 1); }
    else { R(g, C.eye, hx - 3 + turn, hy - 31, 1, 2); R(g, C.eye, hx + 2 + turn, hy - 31, 1, 2); }
    R(g, C.lineSoft, hx - 1 + turn, hy - 27, 2, 1);
  };
  // small moving things
  var drawZ = function (g, x, y, T, ph) { // sleep: small z rising, growing as they go
    for (var k = 0; k < 3; k++) {
      var life = (T / 2400 + k / 3 + ph) % 1, zx = Math.round(x + life * 8 + Math.sin(life * 6 + k) * 1.2), zy = Math.round(y - life * 15), c = rgb([78, 96, 150], (1 - life * 0.7).toFixed(2));
      var n = life > 0.45 ? 5 : 4, j;
      R(g, c, zx, zy, n, 1); R(g, c, zx, zy + n - 1, n, 1);
      for (j = 1; j < n - 1; j++) R(g, c, zx + n - 1 - j, zy + j, 1, 1);
    }
  };
  var drawSteam = function (g, x, y, T, ph) {
    for (var k = 0; k < 3; k++) {
      var life = (T / 1700 + k / 3 + ph) % 1;
      R(g, 'rgba(255,255,255,' + (0.75 * (1 - life)).toFixed(2) + ')', Math.round(x + Math.sin(life * 5 + k * 2) * 1.5), Math.round(y - life * 8), 1, 2);
    }
  };
  var drawSparks = function (g, x, y, T, sd) {
    for (var k = 0; k < 5; k++) {
      var tt = T / 520 + k * 0.37, life = tt % 1, n = Math.floor(tt), dir = hash(n, sd + k) * 2 - 1;
      var px = Math.round(x + dir * 11 * life), py = Math.round(y - 9 * life + 12 * life * life - 2);
      R(g, life < 0.5 ? '#FFE066' : '#FF9F1C', px, py, life < 0.3 ? 2 : 1, 1);
      if (life < 0.2) R(g, '#FFFFFF', px, py - 1, 1, 1);
    }
  };
  var drawBang = function (g, x, y) { // a red "!" badge
    box(g, x - 3, y - 9, 7, 9, 2, C.red, '#9E2A22'); R(g, '#FFFFFF', x, y - 7, 1, 3); R(g, '#FFFFFF', x, y - 3, 1, 1);
  };

  // ---------------------------------------------------------------- the scene
  var SPEED = 0.046; // logical pixels per millisecond: a calm walk
  var create = function (canvas, opts) {
    opts = opts || {};
    var nowFn = typeof opts.now === 'function' ? opts.now : function () { return Date.now(); };
    var seed = (Math.floor(fin(opts.seed, 1)) | 0) || 1, reduced = !!opts.reducedMotion;
    var onHover = typeof opts.onHover === 'function' ? opts.onHover : function () {};
    var onPick = typeof opts.onPick === 'function' ? opts.onPick : function () {};
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    var doc = typeof document !== 'undefined' ? document : null;
    var cssW = 0, cssH = 156, dpr = 1, px = 2, W = 200, L = layout(200, 0);
    var agents = [], byId = {}, queue = [], spotOf = {}, hadCrew = false;
    var T = 0, lastT = null, flights = [], trayPop = -1e9, total = 0;
    var roomC = null, veilC = null, backC = null, hasVeil = false, lightKey = null, lt = lightAt(nowFn()), stale = true, spr = null;
    var focusId = null, hoverId = null, running = false, rafId = 0, lastDraw = -1e9, dead = false, oneShot = false;
    var tags = [], order = [];
    // The canvas keeps the last picture. Each frame only the parts that changed are copied onto it again (the parts
    // touched this frame and the last one, words included), and the whole picture every two seconds, after any
    // change of crew, size, light or focus, and when it comes back into view. opts.fullRedraw (for testing) copies
    // everything every frame: both ways must give exactly the same pixels.
    var marks = [], before = [], whole = true, frameNo = 0, winT = -1, lastSec = -1, plantF = [], youSig = -1, colT = [], colB = [], always = !!opts.fullRedraw;
    var mark = function (x, y, w, h) { marks.push(Math.floor(x), Math.floor(y), Math.ceil(w) + 1, Math.ceil(h) + 1); }; // may move: copied this frame and the next
    var spot = [], markSpot = function (x, y, w, h) { spot.push(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h)); }; // changes in place: copied once

    // ---- places
    var placePos = function (kind, slot) {
      if (kind === 'queue') return queueSpot(L, Math.max(0, slot));
      if (kind === 'coffee') { var s = L.spots[clamp(slot, 0, L.spots.length - 1)]; return { x: s.x, y: s.y }; }
      return seatOf(L, slot);
    };
    var wantOf = function (a) {
      if (a.state === 'needs') return { kind: 'queue', slot: Math.max(0, queue.indexOf(a.id)) };
      if (a.state === 'idle') return { kind: 'coffee', slot: spotOf[a.id] || 0 };
      return { kind: 'desk', slot: a.di };
    };
    var snap = function (a) {
      var w = wantOf(a), p = placePos(w.kind, w.slot);
      a.x = p.x; a.y = p.y; a.kind = w.kind; a.slot = w.slot; a.at = { kind: w.kind, slot: w.slot };
      a.moving = false; a.pts = null; a.wait = 0; a.sit = w.kind === 'desk' ? 1 : 0; a.dirx = 0; a.diry = 1;
      a.vis = a.state === 'unknown' ? 0 : 1;
    };
    var routeTo = function (a, kind, slot, delay) {
      var target = placePos(kind, slot), out, inn;
      if (!a.moving && a.at.kind === 'queue' && kind === 'queue') { a.pts = [target]; a.sA = -1; a.sB = -1; } // moving up in the queue
      else {
        if (a.moving && a.pts) {
          if (a.pi <= a.sA) out = a.pts.slice(a.pi, a.sA + 1);
          else if (a.pi <= a.sB || a.sB < 0) out = [];
          else out = a.pts.slice(a.sB, a.pi).reverse();
        } else out = legOut(L, a.at.kind, a.at.slot, target.x);
        inn = legOut(L, kind, slot, a.x).reverse();
        if (L.wide && !a.moving && a.at.kind === 'desk' && kind === 'coffee' && out.length > 1) {
          // from a desk to the coffee it keeps to the lane along the desks, clear of those on their way to the queue
          out.pop(); inn[0] = { x: inn[0].x, y: out[out.length - 1].y };
        }
        a.pts = out.concat(inn); a.pts.push(target); a.sA = out.length - 1; a.sB = out.length;
      }
      var len = 0, qx = a.x, qy = a.y;
      for (var i = 0; i < a.pts.length; i++) { len += Math.hypot(a.pts[i].x - qx, a.pts[i].y - qy); qx = a.pts[i].x; qy = a.pts[i].y; }
      a.speed = Math.max(SPEED, len / 3900); // a long way is walked a little faster
      a.pi = 0; a.kind = kind; a.slot = slot; a.wait = a.moving ? 0 : (delay || 0); a.moving = true;
    };
    var spotClash = function (i) { // a coffee place too close to where the queue stands
      if (!queue.length) return false;
      var last = queueSpot(L, Math.min(queue.length, L.q.per) - 1), s = L.spots[i];
      return s.x > last.x - 22 && s.y > L.street - 14;
    };
    var assign = function () { // queue order (first come, first served) and coffee places
      var i, a, used = {};
      queue = queue.filter(function (id) { return byId[id] && byId[id].state === 'needs'; });
      var fresh = [];
      for (i = 0; i < agents.length; i++) if (agents[i].state === 'needs' && queue.indexOf(agents[i].id) < 0) fresh.push(agents[i]);
      fresh.sort(function (m, n) { return (Math.abs(L.q.x - m.x) + Math.abs(L.q.y - m.y)) - (Math.abs(L.q.x - n.x) + Math.abs(L.q.y - n.y)) || m.di - n.di; }); // who is nearest gets there first
      for (i = 0; i < fresh.length; i++) queue.push(fresh[i].id);
      for (i = 0; i < agents.length; i++) { a = agents[i]; if (a.state !== 'idle' || (spotOf[a.id] != null && spotClash(spotOf[a.id]))) delete spotOf[a.id]; }
      for (var id in spotOf) { if (!byId[id]) delete spotOf[id]; else used[spotOf[id]] = 1; }
      for (i = 0; i < agents.length; i++) {
        a = agents[i]; if (a.state !== 'idle' || spotOf[a.id] != null) continue;
        var pick = -1, k;
        for (k = 0; k < L.spots.length; k++) if (!used[k] && !spotClash(k)) { pick = k; break; }
        if (pick < 0) for (k = 0; k < L.spots.length; k++) if (!used[k]) { pick = k; break; }
        if (pick < 0) pick = i % L.spots.length;
        spotOf[a.id] = pick; used[pick] = 1;
      }
      total = 0;
      for (i = 0; i < agents.length; i++) if (agents[i].state === 'needs') total += agents[i].waiting;
    };

    // ---- size, caches
    var rebuild = function () {
      if (!doc) return;
      if (!roomC) { roomC = doc.createElement('canvas'); veilC = doc.createElement('canvas'); backC = doc.createElement('canvas'); }
      roomC.width = veilC.width = backC.width = L.W; roomC.height = veilC.height = backC.height = L.H;
      spr = { desk: mkDesk(L.dw), boss: mkBoss(L.boss.w), counter: L.counter ? mkCounter(L.counter.w) : null, cart: L.cart ? mkCart(L.cart.w) : null, table: mkTable(), pouf: [mkPouf(0), mkPouf(1)], chair: L.nook ? mkArmchair() : null, shelf: L.shelf ? mkShelf(seed) : null, flamp: L.nook ? [mkFloorLamp(false), mkFloorLamp(true)] : null,
        plant: [[mkPlant(0, 0), mkPlant(0, 1)], [mkPlant(1, 0), mkPlant(1, 1)]] };
      stale = true; order.length = 0; whole = true;
    };
    var applySize = function () {
      // one logical pixel is a whole number of device pixels, about two css pixels; on a wide page a little more,
      // as long as the wide room still fits and the picture does not get too tall
      var p0 = Math.max(1, Math.round(2 * dpr)), eff = Math.max(cssW, 320), c, Wc, Lc;
      while (p0 > 1 && p0 / dpr > 2.6) p0--;
      while (p0 / dpr < 1.5) p0++;
      px = p0;
      for (c = p0 + 2; c > p0; c--) {
        if (c / dpr > 2.56) continue;
        Wc = Math.ceil(eff * dpr / c); if (Wc < WIDE) continue;
        Lc = layout(Wc, agents.length); if (Lc.H * c / dpr > (Lc.rows === 2 ? 440 : 380) || eff * dpr * Lc.H * c > 2e6) continue; // not too tall, not too many pixels to fill
        px = c; break;
      }
      W = Math.ceil(eff * dpr / px);
      L = layout(W, agents.length);
      while (px > 1 && L.H * px / dpr > (L.rows === 2 ? 440 : 380)) { px--; W = Math.ceil(eff * dpr / px); L = layout(W, agents.length); } // odd pixel ratios: never too tall
      cssH = L.H * px / dpr;
      if (canvas) {
        var dw = Math.round(cssW * dpr), dh = Math.round(L.H * px);
        if (canvas.width !== dw) canvas.width = dw;
        if (canvas.height !== dh) canvas.height = dh;
        if (canvas.style) { canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px'; }
      }
      rebuild();
    };
    var resize = function (w) {
      if (dead) return cssH;
      w = Math.max(0, fin(w, 0));
      cssW = w;
      dpr = clamp(fin(root.devicePixelRatio, 1) || 1, 0.5, 4);
      applySize();
      var i, a;
      for (i = 0; i < agents.length; i++) { // those still at their desks get their place in the queue anew, for the new room
        a = agents[i];
        if (!reduced && a.state === 'needs' && a.moving && a.pi === 0 && a.at.kind === 'desk') { var sp0 = seatOf(L, a.di), qi = queue.indexOf(a.id); a.x = sp0.x; a.y = sp0.y; if (qi >= 0) queue.splice(qi, 1); }
      }
      spotOf = {}; // a new room: the coffee places are handed out again
      if (reduced) queue.sort(function (m, n) { // with no walk to tell who came first: nearest desk first, as when they walk
        var p = seatOf(L, byId[m] ? byId[m].di : 0), q = seatOf(L, byId[n] ? byId[n].di : 0);
        return (Math.abs(L.q.x - p.x) + Math.abs(L.q.y - p.y)) - (Math.abs(L.q.x - q.x) + Math.abs(L.q.y - q.y));
      });
      assign();
      for (i = 0; i < agents.length; i++) {
        a = agents[i];
        if (!reduced && a.state !== 'unknown' && a.moving && a.pi === 0 && (a.wait > 0 || a.sit > 0)) { // it has not left yet: keep its walk
          var w8 = a.wait, p0 = placePos(a.at.kind, a.at.slot), want = wantOf(a);
          a.x = p0.x; a.y = p0.y; a.moving = false; routeTo(a, want.kind, want.slot, 0); a.wait = a.isNew ? 300 + (want.kind === 'queue' ? want.slot * 330 : (queue.length ? 700 : 0) + want.slot * 200) : w8;
        } else snap(a);
      }
      flights.length = 0;
      wake();
      return cssH;
    };

    // ---- crew
    var clean = function (s, id, i) {
      var st = STATES[s.state] ? s.state : 'unknown', n = Math.floor(fin(s.waiting, 0));
      return { id: id, name: String(s.name == null ? id : s.name).slice(0, 16), look: LOOKS[s.look] ? s.look : 'plain', hueName: HUES[s.hue] ? s.hue : 'teal',
        state: st, waiting: n > 0 ? n : 0, step: String(s.step == null ? '' : s.step).slice(0, 28), bubble: String(s.bubble == null ? '' : s.bubble).slice(0, 32), fresh: fin(s.fresh, 0), di: i };
    };
    var setCrew = function (list) {
      if (dead) return;
      var arr = Array.isArray(list) ? list : [], next = [], seen = {}, i, a, c;
      for (i = 0; i < arr.length && next.length < 8; i++) {
        var s = arr[i]; if (!s || typeof s !== 'object') continue;
        var id = String(s.id == null ? 'agent' + i : s.id); if (seen[id]) continue;
        seen[id] = 1; next.push(clean(s, id, next.length));
      }
      var first = !hadCrew, resized = next.length !== agents.length, old = byId;
      byId = {}; agents = [];
      for (i = 0; i < next.length; i++) {
        c = next[i]; a = old[c.id];
        var fresh0 = a ? a.fresh : 0, state0 = a ? a.state : null, isNew = !a;
        if (!a) a = { id: c.id, x: 0, y: 0, sit: 1, vis: 0, moving: false, pts: null, pi: 0, sA: -1, sB: -1, wait: 0, dist: 0, dirx: 0, diry: 1, speed: SPEED, bub: null, tagY: 0, arrT: -1e9, at: { kind: 'desk', slot: c.di }, kind: 'desk', slot: c.di };
        a.name = c.name; a.look = c.look; a.hue = HUES[c.hueName]; a.state = c.state; a.waiting = c.waiting; a.step = c.step; a.bubble = c.bubble; a.fresh = c.fresh; a.di = c.di;
        a.ph = hash(seed, c.di * 7 + 3); a.isNew = isNew; a.state0 = state0; a.fresh0 = fresh0;
        a.chairC = mixh(a.hue.m, '#F6F1E7', 0.45); a.chairD = mixh(a.hue.d, '#F6F1E7', 0.12);
        byId[c.id] = a; agents.push(a);
      }
      if (resized) { applySize(); spotOf = {}; }
      for (i = 0; i < agents.length; i++) if (agents[i].isNew || agents[i].state0 === 'unknown') { var st0 = seatOf(L, agents[i].di); agents[i].x = st0.x; agents[i].y = st0.y; }
      assign();
      for (i = 0; i < agents.length; i++) {
        a = agents[i];
        var w = wantOf(a), changed = a.state0 !== a.state;
        if (reduced || (resized && !first && !a.isNew)) { snap(a); if (reduced) a.bub = changed && a.bubble && a.state !== 'working' ? { text: a.bubble, from: -1, until: 1e18 } : null; continue; }
        if (a.isNew || a.state0 === 'unknown') { // it starts at its own desk
          var seat = seatOf(L, a.di);
          a.x = seat.x; a.y = seat.y; a.sit = 1; a.moving = false; a.pts = null; a.at = { kind: 'desk', slot: a.di }; a.kind = 'desk'; a.slot = a.di;
          if (a.isNew) a.vis = a.state === 'unknown' ? 0 : (first ? 1 : 0);
        }
        if (a.state === 'unknown') { a.moving = false; a.pts = null; a.bub = null; continue; }
        var arriving = a.isNew || a.state0 === 'unknown'; // just came into the room: they set off one after another
        if (w.kind !== a.kind || w.slot !== a.slot) routeTo(a, w.kind, w.slot, w.kind === 'queue' && a.at.kind === 'queue' && !arriving ? 250 + w.slot * 160 : (arriving ? 300 : 120) + (w.kind === 'queue' ? w.slot * 330 : (arriving && w.kind === 'coffee' ? (queue.length ? 700 : 0) + w.slot * 200 : 0)));
        if (changed && a.bubble && a.state !== 'working') { var t0 = T + (arriving ? 500 + a.di * 320 : 0); a.bub = { text: a.bubble, from: t0, until: t0 + 4200 }; }
        else if (changed) a.bub = null;
        if (!a.isNew && a.state0 !== 'unknown' && a.fresh > a.fresh0 && L.desks[a.di]) { // a new result: a slip flies to the tray
          var d = L.desks[a.di];
          flights.push({ x0: d.x - 2, y0: d.y - 16, x1: L.tray.x, y1: L.tray.y - 4, t0: T + 150, dur: 1500, h: 26 + Math.abs(d.x - L.tray.x) * 0.07 });
        }
      }
      hadCrew = hadCrew || agents.length > 0;
      order.length = 0; whole = true;
      wake();
    };

    // ---- time
    var step = function (dt) {
      var i, a, p, dx, dy, d, left;
      for (i = 0; i < agents.length; i++) {
        a = agents[i];
        var show = a.state === 'unknown' ? 0 : 1;
        if (a.vis !== show) a.vis = clamp(a.vis + (show ? dt : -dt) / 350, 0, 1);
        if (!a.moving) { if (a.kind === 'desk' && a.sit < 1) a.sit = Math.min(1, a.sit + dt / 240); continue; }
        if (a.wait > 0) { a.wait -= dt; continue; }
        if (a.sit > 0) { a.sit = Math.max(0, a.sit - dt / 220); continue; }
        left = a.speed * dt;
        while (left > 0 && a.pi < a.pts.length) {
          p = a.pts[a.pi]; dx = p.x - a.x; dy = p.y - a.y; d = Math.hypot(dx, dy);
          if (d > 0.001) { a.dirx = dx / d; a.diry = dy / d; }
          if (d <= left) { a.x = p.x; a.y = p.y; a.pi++; left -= d; a.dist += d; }
          else { a.x += dx / d * left; a.y += dy / d * left; a.dist += left; left = 0; }
        }
        if (a.pi >= a.pts.length) { a.moving = false; a.pts = null; a.at = { kind: a.kind, slot: a.slot }; a.arrT = T; }
      }
      for (i = flights.length - 1; i >= 0; i--) if (T >= flights[i].t0 + flights[i].dur) { flights.splice(i, 1); trayPop = T; }
    };

    // ---- poses: what each robot is doing right now
    var P = { x: 0, y: 0, raise: 0, bob: 0, sit: false, flip: false, face: 0, back: false, eyes: 0, step: -1, armM: 0, armO: 0, hdx: 0, hdy: 0, hue: HUES.teal, look: 'plain', glow: 0, mouth: 0, tap: 0, swing: 0 };
    var pose = function (a) {
      var p = P, still = reduced, tt = still ? 0 : T + a.ph * 9000, st = a.state;
      p.x = Math.round(a.x); p.y = Math.round(a.y); p.hue = a.hue; p.look = a.look;
      p.raise = Math.round(a.sit * 3); p.sit = a.sit > 0.4; p.bob = 0; p.flip = false; p.face = 0; p.back = false; p.eyes = 0; p.step = -1;
      p.armM = 0; p.armO = 0; p.hdx = 0; p.hdy = 0; p.glow = 0; p.mouth = 0; p.tap = 0; p.swing = 0;
      var blink = !still && (tt % (2600 + a.ph * 1900)) < 140;
      if (a.look === 'antenna') p.glow = !still && (tt % (st === 'working' ? 520 : 1500)) < 230 ? 1 : 0;
      if (a.look === 'bulb') p.glow = (st === 'working' || st === 'needs') ? 1 : (!still && (tt % 5200) < 800 ? 1 : 0);
      if (a.look === 'gavel') p.tap = !still && (tt % 3600) < 200 ? 1 : 0;
      if (a.moving && a.wait <= 0 && a.sit <= 0) { // walking
        var cyc = Math.floor(a.dist / 4.2) % 4; p.step = cyc; p.bob = cyc % 2 ? -1 : 0; p.swing = cyc === 0 ? 1 : cyc === 2 ? -1 : 0;
        if (a.diry < -0.8) p.back = true; else p.face = a.dirx > 0.25 ? 1 : a.dirx < -0.25 ? -1 : 0;
        if (st === 'needs') p.armM = 2; else p.flip = p.face < 0;
        if (blink) p.eyes = 1;
      } else if (a.at.kind === 'desk' || a.sit > 0) { // at its desk
        if (a.moving) { if (st === 'needs') p.armM = 2; }
        else if (st === 'working') { p.armM = 1; p.armO = 1; p.face = -1; p.hdy = !still && (tt % 1100) < 160 ? 1 : 0; }
        else if (st === 'due') { p.armM = 1; p.face = !still && Math.floor(tt / 2300) % 3 === 2 ? 0 : -1; }
        else if (st === 'late') { p.armM = 1; p.armO = 1; p.eyes = 1; p.hdx = -2; p.hdy = 3 + (!still && (tt % 2800) < 1400 ? 1 : 0); }
        else if (st === 'error') { p.eyes = 3; p.mouth = 2; if (!still && (tt % 260) < 130) p.x += 1; }
        if (blink && p.eyes === 0) p.eyes = 1;
      } else if (a.at.kind === 'queue') { // waiting on you, slip in hand
        p.face = 1; p.armM = 2;
        if (!still) {
          var ws = Math.floor(tt / 1900) % 2;
          p.x += ws; if ((tt % 1900) < 170) p.step = ws ? 3 : 1;      // shifting its weight
          if ((tt % 5600) < 850) { p.eyes = 2; p.hdy = 1; }           // a glance at the slip
          else if ((tt % 7300) > 6600) p.face = 0;                    // a look around
          if (a.slot === 0 && (tt % 4100) < 160) p.bob = -1;
        }
        if (blink && p.eyes === 0) p.eyes = 1;
      } else { // by the coffee
        var sp = L.spots[clamp(a.slot, 0, L.spots.length - 1)]; p.face = sp.f; p.flip = sp.f < 0;
        if (lt.doze) { p.eyes = 1; p.hdy = 2; p.hdx = sp.f; }
        else {
          p.armM = 3; p.mouth = 1;
          if (!still) {
            var c6 = tt % 6400;
            if (c6 < 900) p.armM = 4; else if (c6 < 1500) p.eyes = 4;
            if ((tt % 2600) < 1300) p.bob = -1;
            if (Math.floor(tt / 4700) % 4 === 3) p.face = -sp.f;
          }
          if (blink && p.eyes === 0) p.eyes = 1;
        }
      }
      return p;
    };
    var atDesk = function (a) { return a && a.state !== 'unknown' && a.at.kind === 'desk' && !a.moving && a.sit > 0.5 && (a.state === 'working' || a.state === 'due' || a.state === 'late' || a.state === 'error'); };

    // ---- the live parts of a desk: screen, lamp, hands
    var deskLive = function (g, i) {
      var d = L.desks[i], q = deskGeo(d.w), a = agents[i], sx = d.x + q.sx, sy = d.y + q.sy, lx = d.x + q.lx, ly = d.y + q.ly;
      if (!a || a.state === 'unknown') { R(g, '#31353B', sx + 7, sy + 1, 3, 1); return; }
      var st = atDesk(a) ? a.state : 'away', h = a.hue, tt = reduced ? 0 : T + a.ph * 9000, k, lamp = null, on = true;
      if (st === 'away') { R(g, '#3A4652', sx, sy, q.sw, q.sh); k = reduced ? 3 : Math.floor(tt / 700) % 14; R(g, h.l, sx + 1 + (k < 8 ? k : 14 - k), sy + 2 + (k % 4 < 2 ? k % 4 : 4 - k % 4), 2, 2); if (a.deskK !== k) { a.deskK = k; markSpot(sx - 1, sy - 1, q.sw + 2, q.sh + 2); } return; }
      a.deskK = -1; mark(d.x - q.hw - 4, d.y - 27, d.w + 8, 29);
      if (st === 'working') {
        R(g, '#EAF8F4', sx, sy, q.sw, q.sh); R(g, h.m, sx, sy, q.sw, 1);
        var sc = Math.floor(tt / 280);
        for (k = 0; k < 3; k++) { var len = 3 + Math.floor(hash(k + sc, i + 5) * 6); R(g, k === 2 ? h.m : h.d, sx + 1, sy + 2 + k * 2, len, 1); if (k === 2 && sc % 2) R(g, C.eye, sx + 2 + len, sy + 6, 1, 1); }
        lamp = C.green;
      } else if (st === 'due' || st === 'late') {
        var dim = st === 'late', fr = dim ? '#B08A3E' : '#9A6410', sand = dim ? '#D2AE5C' : '#F0A22B', ph = dim ? 0.95 : (tt % 3600) / 3600;
        R(g, dim ? '#4B4438' : '#FFF3D0', sx, sy, q.sw, q.sh);
        if (!dim && ph > 0.92) { R(g, fr, sx + 2, sy + 2, 1, 4); R(g, fr, sx + 8, sy + 2, 1, 4); R(g, sand, sx + 3, sy + 3, 5, 2); } // it turns over
        else {
          R(g, fr, sx + 3, sy + 1, 5, 1); R(g, fr, sx + 3, sy + 6, 5, 1); R(g, fr, sx + 5, sy + 3, 1, 2);
          if (ph < 0.6) R(g, sand, sx + 4, sy + 2, 3, 1); if (ph > 0.25) R(g, sand, sx + 4, sy + 5, 3, 1);
          if (!dim && Math.floor(tt / 200) % 2) R(g, sand, sx + 5, sy + 4, 1, 1);
        }
        lamp = C.amber; on = !dim || reduced || Math.floor(T / 520) % 2 === 0;
      } else { // error
        var fl = reduced || Math.floor(T / 420) % 2 === 0;
        R(g, fl ? C.red : '#B4332A', sx, sy, q.sw, q.sh); R(g, '#FFFFFF', sx + 5, sy + 1, 1, 4); R(g, '#FFFFFF', sx + 5, sy + 6, 1, 1);
        if (!reduced) R(g, '#FFB3AD', sx, sy + Math.floor(T / 140) % q.sh, q.sw, 1);
        lamp = C.red;
      }
      if (lamp) {
        if (on) { g.fillStyle = rgb(hexc(lamp), st === 'error' && !reduced && Math.floor(T / 300) % 2 ? 0.42 : 0.28); cut(g, lx - 2, ly - 2, 9, 9, 2); }
        g.fillStyle = on ? lamp : '#8C7740'; cut(g, lx, ly, 5, 5, 1); if (on) R(g, 'rgba(255,255,255,0.75)', lx + 1, ly + 1, 1, 1);
      }
      // hands on the desk
      var hx = d.x + d.so, hy = d.y - 14, up = 0, up2 = 0;
      if (st === 'working' && !reduced) { up = Math.floor(tt / 140) % 2; up2 = 1 - up; }
      else if (st === 'due' && !reduced) up2 = (tt % 700) < 120 ? 1 : 0;
      if (st === 'working' || st === 'late') { R(g, C.line, hx - 5, hy - up, 3, 2); R(g, C.shell, hx - 4, hy - up, 2, 1); }
      if (st !== 'error') { R(g, C.line, hx + 2, hy - up2, 3, 2); R(g, C.shell, hx + 2, hy - up2, 2, 1); }
    };
    var trayN = -1;
    var bossLive = function (g) { // William's hands and the stack in his tray
      var b = L.boss, i, n = total > 0 ? Math.min(11, Math.ceil(1.6 * Math.log(1 + total) / Math.LN2)) : 0, pop = !reduced && T - trayPop < 280 ? 1 : 0;
      R(g, C.youHead, b.seatX - 9, b.y - 17, 2, 2); R(g, C.youHead, b.seatX + 7, b.y - 17, 2, 2);
      if (pop || trayN !== n * 2 + pop) { trayN = n * 2 + pop; mark(L.tray.x - 10, L.tray.y - 21, 21, 24); }
      for (i = 0; i < n; i++) R(g, i % 2 ? C.paperShade : C.paper, L.tray.x - 5 + (hash(i, seed + 91) < 0.3 ? 1 : 0), L.tray.y - i - (pop && i > n - 3 ? 1 : 0), 11, 1);
      if (n) { R(g, C.paper, L.tray.x - 5, L.tray.y - n - pop, 11, 1); R(g, C.lineSoft, L.tray.x - 6, L.tray.y - n - pop, 1, n + 1 + pop); R(g, C.lineSoft, L.tray.x + 6, L.tray.y - n - pop, 1, n + 1 + pop); R(g, C.lineSoft, L.tray.x - 5, L.tray.y - n - 1 - pop, 11, 1); }
      if (pop) { R(g, '#FFE9A8', L.tray.x - 8, L.tray.y - n - 4, 1, 2); R(g, '#FFE9A8', L.tray.x + 8, L.tray.y - n - 3, 1, 2); R(g, '#FFE9A8', L.tray.x, L.tray.y - n - 6, 1, 2); }
    };
    var windowLive = function (g) { // snow, a ferry, glints on the water; then the frame again on top
      var gl = glassOf(L.win), hy = gl.y + Math.round(gl.h * 0.64), i, x, y, t = reduced ? 0 : Math.floor(T / 250) * 250; // the view moves four times a second
      if (t !== winT) { winT = t; markSpot(L.win.x - 2, L.win.y, L.win.w + 4, L.win.h + 3); }
      var bx = Math.round(gl.x - 14 + ((t * 0.0042 + hash(seed, 77) * (gl.w + 28)) % (gl.w + 28))), by = hy + 3;
      var RC = function (c, x0, y0, w, h) { var a = Math.max(x0, gl.x), b = Math.min(x0 + w, gl.x + gl.w); if (b > a) R(g, c, a, y0, b - a, h); };
      var hull = rgb(mixc([246, 243, 236], [34, 44, 76], lt.sil * 0.85));
      RC('rgba(255,255,255,0.35)', bx - 5, by + 2, 4, 1); RC(hull, bx, by, 10, 2); RC(hull, bx + 2, by - 2, 6, 2); RC(C.terracotta, bx + 5, by - 4, 2, 2);
      RC(lt.lit > 0.3 ? '#FFD27A' : '#7F97A6', bx + 3, by - 1, 1, 1); RC(lt.lit > 0.3 ? '#FFD27A' : '#7F97A6', bx + 5, by - 1, 1, 1);
      if (lt.stars < 0.3 && lt.sil < 0.7) { // two gulls over the water by day
        for (i = 0; i < 2; i++) {
          var gx = Math.round(gl.x - 8 + ((t * (0.006 + i * 0.002) + hash(seed, 61 + i) * (gl.w + 16)) % (gl.w + 16))), gy = gl.y + 6 + i * 5 + Math.round(Math.sin(t / 900 + i * 2) * 1.5), fl = Math.floor(t / 260 + i) % 2;
          RC('#5E6672', gx, gy - fl, 2, 1); RC('#5E6672', gx + 2, gy, 1, 1); RC('#5E6672', gx + 3, gy - fl, 2, 1);
        }
      }
      for (i = 0; i < 6; i++) if (hash(i, Math.floor(t / 800) + seed) > 0.5) R(g, 'rgba(255,255,255,0.4)', gl.x + Math.floor(hash(i, seed + 81) * (gl.w - 3)), hy + 3 + (i * 3) % Math.max(1, gl.y + gl.h - hy - 4), 2, 1);
      if (lt.snow > 0.02) {
        var n = Math.min(110, Math.round(gl.w * gl.h / 62 * lt.snow)), sill = gl.y + gl.h - 7;
        for (i = 0; i < n; i++) {
          x = gl.x + Math.floor((hash(i, seed + 71) * gl.w + Math.sin(t / 1300 + i * 1.7) * 1.6 + gl.w) % gl.w);
          y = gl.y + Math.floor((hash(i, seed + 73) * gl.h + t * (3.5 + hash(i, 72) * 4) / 1000) % gl.h);
          if (y < sill) R(g, i % 3 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)', x, y, 1, 1);
        }
      }
      paintFrame(g, L.win);
      // the clock's hands
      var cx = L.clock.x, cy = L.clock.y, s, am = (lt.hour % 1) * Math.PI * 2, ah = ((lt.hour % 12) / 12) * Math.PI * 2;
      for (s = 1; s <= 5; s++) R(g, C.lineSoft, Math.round(cx + Math.sin(am) * s), Math.round(cy - Math.cos(am) * s), 1, 1);
      for (s = 1; s <= 3; s++) R(g, C.line, Math.round(cx + Math.sin(ah) * s), Math.round(cy - Math.cos(ah) * s), 1, 1);
      var sec = (Math.floor(fin(nowFn(), 0) / 1000) % 60 + 60) % 60, as = sec / 60 * Math.PI * 2;
      if (sec !== lastSec) { lastSec = sec; markSpot(cx - 8, cy - 8, 17, 17); }
      R(g, C.red, Math.round(cx + Math.sin(as) * 5), Math.round(cy - Math.cos(as) * 5), 1, 1); R(g, C.line, cx, cy, 1, 1);
    };
    var blit = function (g, s, x, y) { if (s) g.drawImage(s.c, x - s.ox, y - s.oy); };
    // The marks of this frame and the last, joined into a few strips (16 pixel columns, each as tall as its marks).
    // Null when so much changed that copying the whole picture is cheaper.
    var runsOut = [];
    var changed = function () {
      var nc = (L.W >> 4) + 1, c, n, pass, list, x0, y0, x1, y1, c0, area = 0;
      for (c = 0; c < nc; c++) { colT[c] = 1e9; colB[c] = -1; }
      for (pass = 0; pass < 2; pass++) {
        list = pass ? marks : before;
        for (n = 0; n < list.length; n += 4) {
          x0 = Math.max(0, list[n]); y0 = Math.max(0, list[n + 1]); x1 = Math.min(L.W, list[n] + list[n + 2]); y1 = Math.min(L.H, list[n + 1] + list[n + 3]);
          if (!(x1 > x0 && y1 > y0)) continue;
          for (c = x0 >> 4; c <= (x1 - 1) >> 4; c++) { if (y0 < colT[c]) colT[c] = y0; if (y1 > colB[c]) colB[c] = y1; }
        }
      }
      runsOut.length = 0;
      for (c = 0; c < nc; c++) {
        if (colB[c] < 0) continue;
        c0 = c; y0 = colT[c]; y1 = colB[c];
        while (c + 1 < nc && colB[c + 1] >= 0 && Math.abs(colT[c + 1] - y0) < 24 && Math.abs(colB[c + 1] - y1) < 24) { c++; if (colT[c] < y0) y0 = colT[c]; if (colB[c] > y1) y1 = colB[c]; }
        x1 = Math.min(L.W, (c + 1) << 4);
        runsOut.push(c0 << 4, y0, x1 - (c0 << 4), y1 - y0); area += (x1 - (c0 << 4)) * (y1 - y0);
      }
      for (n = 0; n < spot.length; n += 4) { // what changed in place is copied as it is
        x0 = Math.max(0, spot[n]); y0 = Math.max(0, spot[n + 1]); x1 = Math.min(L.W, spot[n] + spot[n + 2]); y1 = Math.min(L.H, spot[n + 1] + spot[n + 3]);
        if (x1 > x0 && y1 > y0) { runsOut.push(x0, y0, x1 - x0, y1 - y0); area += (x1 - x0) * (y1 - y0); }
      }
      return area > L.W * L.H * 0.55 || runsOut.length > 96 ? null : runsOut;
    };

    // ---- one frame
    var draw = function () {
      if (!ctx || dead) return;
      var g, i, a, o, p;
      lt = lightAt(nowFn());
      if (!roomC) rebuild();
      if (roomC && (stale || lt.key !== lightKey)) {
        var rg = roomC.getContext('2d'), vg = veilC.getContext('2d');
        if (rg) paintRoom(rg, L, lt, seed);
        hasVeil = vg ? paintVeil(vg, L, lt) : false;
        lightKey = lt.key; stale = false; whole = true;
      }
      // the pixel art is composed at logical size on a small back buffer, then enlarged once onto the canvas
      g = backC ? backC.getContext('2d') : null;
      if (!g) return;
      g.globalAlpha = 1;
      if (roomC) g.drawImage(roomC, 0, 0); else R(g, C.wall, 0, 0, L.W, L.H);
      windowLive(g);
      // everything standing on the floor, far to near
      if (!order.length) {
        for (i = 0; i < L.desks.length; i++) { order.push({ k: 'chair', i: i, z: L.desks[i].y - 7, n: order.length }); order.push({ k: 'desk', i: i, z: L.desks[i].y, n: order.length }); }
        order.push({ k: 'you', z: L.boss.y - 6, n: order.length }); order.push({ k: 'boss', z: L.boss.y, n: order.length });
        if (L.counter) order.push({ k: 'counter', z: L.counter.y, n: order.length });
        if (L.cart) order.push({ k: 'cart', z: L.cart.y, n: order.length });
        order.push({ k: 'table', z: L.table.y, n: order.length });
        for (i = 0; i < L.poufs.length; i++) order.push({ k: 'pouf', i: i, z: L.poufs[i].y, n: order.length });
        for (i = 0; i < L.plants.length; i++) order.push({ k: 'plant', i: i, z: L.plants[i].y, n: order.length });
        if (L.nook) { order.push({ k: 'chair2', z: L.nook.chair.y, n: order.length }); order.push({ k: 'flamp', z: L.nook.lamp.y, n: order.length }); }
        if (L.shelf) order.push({ k: 'shelf', z: L.shelf.y, n: order.length });
        for (i = 0; i < agents.length; i++) order.push({ k: 'bot', a: agents[i], z: 0, n: order.length });
      }
      for (i = 0; i < order.length; i++) if (order[i].k === 'bot') order[i].z = order[i].a.y + 0.01;
      order.sort(function (u, v) { return u.z - v.z || u.n - v.n; });
      var tq = reduced ? 0 : T;
      for (i = 0; i < order.length; i++) {
        o = order[i];
        if (o.k === 'bot') {
          a = o.a; if (a.vis <= 0.02) continue;
          p = pose(a);
          // copy it to the canvas again only when it looks different, or has something in the air around it
          var sg = 17, fs = [p.x, p.y, p.raise, p.bob, p.sit ? 1 : 0, p.flip ? 1 : 0, p.face, p.back ? 1 : 0, p.eyes, p.step, p.armM, p.armO, p.hdx, p.hdy, p.glow, p.mouth, p.tap, p.swing, Math.round(a.vis * 64)], fi;
          for (fi = 0; fi < fs.length; fi++) sg = (Math.imul(sg, 31) + fs[fi] + 7) | 0;
          var airy = !a.moving && a.sit > 0.5 ? (a.state === 'late' || a.state === 'error') : (!a.moving && a.at.kind === 'coffee');
          if (sg !== a.sig || airy) { if (a.sig != null) mark(a.bx - 17, a.by - 51, 40, 57); a.sig = sg; a.bx = p.x; a.by = p.y; mark(p.x - 17, p.y - 51, 40, 57); }
          if (a.vis < 1) g.globalAlpha = a.vis;
          if ((a.id === focusId || a.id === hoverId) && !p.sit) { g.fillStyle = a.hue.m; ell(g, p.x, p.y, 11, 3); g.fillStyle = a.hue.l; ell(g, p.x, p.y, 10, 2); }
          drawBot(g, p);
          g.globalAlpha = 1;
        } else if (o.k === 'chair') {
          var d = L.desks[o.i], ag = agents[o.i], cxs = d.x + d.so;
          R(g, C.metalDark, cxs - 1, d.y - 11, 2, 5);
          box(g, cxs - 7, d.y - 23, 14, 12, 2, ag ? ag.chairC : '#D8D2C6', ag ? ag.chairD : '#B5AEA1');
        } else if (o.k === 'desk') { blit(g, spr && spr.desk, L.desks[o.i].x, L.desks[o.i].y); deskLive(g, o.i); }
        else if (o.k === 'you') {
          var yt = queue.length && !(Math.floor(tq / 5300) % 3 === 2) ? -1 : 0, yb = !reduced && (tq % 3900) < 150, yn = !reduced && (tq % 7700) < 400 ? 1 : 0, ys = yt * 4 + (yb ? 2 : 0) + yn;
          if (ys !== youSig) { youSig = ys; mark(L.boss.seatX - 12, L.boss.seatY - 38, 26, 41); }
          drawYou(g, L.boss.seatX, L.boss.seatY, yt, yb, yn);
        }
        else if (o.k === 'boss') { blit(g, spr && spr.boss, L.boss.x, L.boss.y); bossLive(g); }
        else if (o.k === 'counter') blit(g, spr && spr.counter, L.counter.x + Math.floor(L.counter.w / 2), L.counter.y);
        else if (o.k === 'cart') blit(g, spr && spr.cart, L.cart.x, L.cart.y);
        else if (o.k === 'table') blit(g, spr && spr.table, L.table.x, L.table.y);
        else if (o.k === 'chair2') blit(g, spr && spr.chair, L.nook.chair.x, L.nook.chair.y);
        else if (o.k === 'shelf') blit(g, spr && spr.shelf, L.shelf.x, L.shelf.y);
        else if (o.k === 'flamp') blit(g, spr && spr.flamp && spr.flamp[lt.lamp > 0.2 ? 1 : 0], L.nook.lamp.x, L.nook.lamp.y);
        else if (o.k === 'pouf') blit(g, spr && spr.pouf[L.poufs[o.i].c], L.poufs[o.i].x, L.poufs[o.i].y);
        else if (o.k === 'plant') { var pl = L.plants[o.i], pf = reduced ? 0 : Math.floor(tq / 1500 + o.i * 0.4) % 2; if (plantF[o.i] !== pf) { plantF[o.i] = pf; markSpot(pl.x - 14, pl.y - 38, 28, 40); } blit(g, spr && spr.plant[pl.kind][pf], pl.x, pl.y); }
      }
      // things in the air: steam, sleep, sparks, flying slips
      if (!reduced) {
        drawSteam(g, L.table.x - 4, L.table.y - 18, T, 0.3); markSpot(L.table.x - 7, L.table.y - 28, 8, 13);
        if (L.counter) { drawSteam(g, L.counter.x + 10, L.counter.y - 38, T, 0); markSpot(L.counter.x + 7, L.counter.y - 48, 8, 13); } else if (L.cart) { drawSteam(g, L.cart.x - 1, L.cart.y - 35, T, 0); markSpot(L.cart.x - 4, L.cart.y - 45, 8, 13); }
      }
      for (i = 0; i < agents.length; i++) {
        a = agents[i]; if (a.vis < 0.5 || a.moving) continue;
        var ax = Math.round(a.x), ay = Math.round(a.y) - Math.round(a.sit * 3);
        if (a.at.kind === 'desk' && a.state === 'late' && a.sit > 0.5) { if (!reduced) drawZ(g, ax + 4, ay - 27, T, a.ph); else drawZ(g, ax + 4, ay - 27, 700, 0); }
        else if (a.at.kind === 'desk' && a.state === 'error' && a.sit > 0.5) { if (!reduced) drawSparks(g, ax, ay - 27, T, i); drawBang(g, ax + 10, ay - 28 - (!reduced && Math.floor(T / 300) % 2 ? 1 : 0)); }
        else if (a.at.kind === 'coffee' && a.state === 'idle') { if (lt.doze) drawZ(g, ax + 4, ay - 29, reduced ? 700 : T, reduced ? 0 : a.ph); else if (!reduced && (T + a.ph * 9000) % 6400 > 1500) drawSteam(g, ax + (L.spots[clamp(a.slot, 0, L.spots.length - 1)].f < 0 ? -5 : 4), ay - 15, T, a.ph); }
      }
      for (i = 0; i < flights.length; i++) { // a slip on its way to the tray: an arc, a little flutter, a dotted trail
        var f = flights[i], u = (T - f.t0) / f.dur; if (u < 0 || u > 1) continue;
        var fpos = function (v) { v = clamp(v, 0, 1); return { x: Math.round(lerp(f.x0, f.x1, ease(v))), y: Math.round(lerp(f.y0, f.y1, v) - Math.sin(Math.PI * v) * f.h) }; };
        for (var tr = 1; tr <= 4; tr++) { var tp = fpos(u - tr * 0.045); if (u - tr * 0.045 > 0) { R(g, 'rgba(255,255,255,' + (0.8 - tr * 0.16).toFixed(2) + ')', tp.x, tp.y, tr < 3 ? 2 : 1, tr < 3 ? 2 : 1); mark(tp.x - 1, tp.y - 1, 4, 4); } }
        var fp = fpos(u), fr = Math.floor(T / 130) % 4, pw = fr % 2 ? 7 : 8, phh = fr % 2 ? 9 : 7, fo = fr === 2 ? 1 : 0;
        mark(fp.x - 6, fp.y - 6, 14, 16);
        R(g, 'rgba(60,40,20,0.18)', fp.x - 3, fp.y - 3 + phh, pw, 1);
        R(g, C.line, fp.x - 4, fp.y - 4 + fo, pw + 1, phh + 1); R(g, C.paper, fp.x - 3, fp.y - 3 + fo, pw - 1, phh - 1);
        R(g, C.lineSoft, fp.x - 2, fp.y - 1 + fo, pw - 3, 1); R(g, C.lineSoft, fp.x - 2, fp.y + 1 + fo, pw - 4, 1); if (phh > 7) R(g, C.lineSoft, fp.x - 2, fp.y + 3 + fo, pw - 3, 1);
      }
      // the night over the room, then what must stay readable
      if (hasVeil) g.drawImage(veilC, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
      var runs = whole || always || reduced || frameNo % 30 === 0 ? null : changed();
      if (!runs) { ctx.drawImage(backC, 0, 0, L.W * px, L.H * px); whole = false; }
      else for (i = 0; i < runs.length; i += 4) ctx.drawImage(backC, runs[i], runs[i + 1], runs[i + 2], runs[i + 3], runs[i] * px, runs[i + 1] * px, runs[i + 2] * px, runs[i + 3] * px);
      frameNo++;
      drawUI(ctx);
      var swap = before; before = marks; marks = swap; marks.length = 0; spot.length = 0;
    };

    // ---- words and numbers, in screen space (css pixels), always on a plate
    var FONT_B = FONT.replace('600', '700'), widths = {}, nWidths = 0;
    var tw = function (g, font, s) {
      var k = font.charAt(0) + s;
      if (widths[k] == null) { if (nWidths++ > 400) { widths = {}; nWidths = 0; } g.font = font; var m = g.measureText(s); widths[k] = fin(m && m.width, s.length * 6); }
      return widths[k];
    };
    var sn = function (v) { return Math.round(v * dpr) / dpr; };
    var plate = function (g, x, y, w, h, fill, line) { // a rectangle with one-pixel cut corners, snapped to device pixels
      var u = Math.max(1, Math.round(dpr)) / dpr;
      x = sn(x); y = sn(y); w = sn(w); h = sn(h);
      if (line) { g.fillStyle = line; g.fillRect(x + u, y, w - 2 * u, h); g.fillRect(x, y + u, w, h - 2 * u); x += u; y += u; w -= 2 * u; h -= 2 * u; }
      g.fillStyle = fill; g.fillRect(x + u, y, w - 2 * u, h); g.fillRect(x, y + u, w, h - 2 * u);
    };
    var hits = function (r, list) { for (var i = 0; i < list.length; i++) { var o = list[i]; if (r.x < o.x + o.w + 1 && r.x + r.w + 1 > o.x && r.ty < o.ty + o.h + 1 && r.ty + r.h + 1 > o.ty) return true; } return false; };
    var headTop = function (a, p) { return p.y - p.raise + p.bob + p.hdy - 26 - (a.look === 'antenna' ? 9 : a.look === 'bulb' ? 8 : a.look === 'headset' ? 2 : 1); };
    var drawUI = function (g) {
      var s = px / dpr, u = Math.max(1, Math.round(dpr)) / dpr, i, a, p, w, h, x, y;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.textBaseline = 'middle';
      // slips: the count each waiting robot holds
      for (i = 0; i < agents.length; i++) {
        a = agents[i]; if (a.state !== 'needs') continue;
        p = pose(a);
        var label = a.waiting > 99 ? '99+' : String(a.waiting), py = p.y - p.raise + p.bob - (p.eyes === 2 ? 1 : 0);
        w = Math.max(17, Math.ceil(tw(g, FONT_B, label)) + 9); h = 15;
        x = Math.min((p.x + 2) * s, cssW - w - 1); y = (py - 11) * s - h / 2;
        mark(x / s - 1, y / s - 1, w / s + 4, h / s + 4);
        if (a.vis < 1) g.globalAlpha = Math.max(0.02, a.vis);
        g.fillStyle = 'rgba(50,35,20,0.28)'; g.fillRect(sn(x) + u, sn(y) + 2 * u, sn(w), sn(h));
        plate(g, x, y, w, h, C.paper, C.line);
        g.fillStyle = a.hue.m; g.fillRect(sn(x) + u, sn(y) + 2 * u, 2 * u, sn(h) - 4 * u);
        g.font = FONT_B; g.textAlign = 'center'; g.fillStyle = C.eye; g.fillText(label, sn(x + w / 2 + 1), sn(y + h / 2) + 0.5);
        g.fillStyle = C.line; g.fillRect(p.x * s, (py - 10) * s, 4 * s, 4 * s); g.fillStyle = C.shell; g.fillRect((p.x + 1) * s, (py - 9) * s, 2 * s, 2 * s);
        g.globalAlpha = 1;
      }
      // name tags: on the desk front when it sits, under its feet otherwise; they step down a row instead of overlapping
      var placed = [], you = { x: L.boss.x * s - (Math.ceil(tw(g, FONT, 'You')) + 12) / 2, ty: (L.front - 4.5) * s - 7.5, w: Math.ceil(tw(g, FONT, 'You')) + 12, h: 15 };
      placed.push(you); mark(you.x / s - 1, you.ty / s - 1, you.w / s + 3, you.h / s + 3);
      plate(g, you.x, you.ty, you.w, you.h, C.you, C.youDark);
      g.font = FONT; g.textAlign = 'center'; g.fillStyle = '#FFFFFF'; g.fillText('You', sn(you.x + you.w / 2), sn(you.ty + you.h / 2) + 0.5);
      tags.length = 0;
      for (i = 0; i < agents.length; i++) {
        a = agents[i]; if (a.state === 'unknown') continue;
        var d = L.desks[a.di], k = d ? a.sit : 0;
        w = Math.ceil(tw(g, FONT, a.name)) + 15; h = 15;
        x = clamp(lerp(a.x, d ? d.x : a.x, k) * s - w / 2, 1, Math.max(1, cssW - w - 1));
        y = lerp((a.y + 3) * s, d ? (d.y - 4.5) * s - h / 2 : 0, k);
        tags.push({ a: a, id: a.id, x: x, y: y, ty: y, w: w, h: h });
      }
      tags.sort(function (m, n) { return (m.y - n.y) || (n.x - m.x) || (m.a.di - n.a.di); });
      for (i = 0; i < tags.length; i++) {
        var t = tags[i], row = 0;
        for (row = 0; row < 4; row++) { t.ty = t.y + row * (t.h + 1); if (!hits(t, placed)) break; }
        placed.push(t);
        a = t.a; a.tagY = reduced ? row * (t.h + 1) : a.tagY + (row * (t.h + 1) - a.tagY) * 0.4;
        if (Math.abs(a.tagY - row * (t.h + 1)) < 0.5) a.tagY = row * (t.h + 1);
        t.y = Math.min(t.y + a.tagY, Math.max(0, cssH - t.h - 1));
        var hot = a.id === focusId || a.id === hoverId;
        mark(t.x / s - 2, t.y / s - 2, t.w / s + 5, t.h / s + 5);
        g.globalAlpha = Math.max(0.02, a.vis);
        if (hot) plate(g, t.x - u, t.y - u, t.w + 2 * u, t.h + 2 * u, a.hue.m, null);
        plate(g, t.x, t.y, t.w, t.h, hot ? '#FFFFFF' : C.paper, hot ? a.hue.d : 'rgba(64,55,47,0.6)');
        g.fillStyle = a.hue.m; g.fillRect(sn(t.x) + 4, sn(t.y) + 5, 3, 5); g.fillRect(sn(t.x) + 3, sn(t.y) + 6, 5, 3);
        g.font = FONT; g.textAlign = 'left'; g.fillStyle = C.eye; g.fillText(a.name, sn(t.x) + 10.5, sn(t.y + t.h / 2) + 0.5);
        g.globalAlpha = 1;
      }
      // bubbles: a few words on a change, and what a working robot is doing
      var bubs = [];
      for (i = 0; i < agents.length; i++) {
        a = agents[i]; if (a.state === 'unknown' || a.vis < 0.5) continue;
        var text = '', dots = false;
        if (a.bub && (reduced || (T >= a.bub.from && T < a.bub.until))) text = a.bub.text;
        else if (atDesk(a) && a.state === 'working' && a.step) { text = a.step; dots = true; }
        if (!text) { if (!(a.id === focusId || a.id === hoverId)) continue; }
        p = pose(a);
        var hx = p.x * s, top = headTop(a, p) * s;
        if (!text) { // a small pointer over the one in focus
          var bobY = reduced ? 0 : (Math.floor(T / 320) % 2) * s;
          mark(p.x - 5, headTop(a, p) - 8, 10, 9);
          g.fillStyle = C.line; g.fillRect(hx - 4 * s, top - 6 * s - bobY, 8 * s, 2 * s); g.fillRect(hx - 3 * s, top - 4 * s - bobY, 6 * s, s); g.fillRect(hx - 2 * s, top - 3 * s - bobY, 4 * s, s); g.fillRect(hx - s, top - 2 * s - bobY, 2 * s, s);
          g.fillStyle = a.hue.m; g.fillRect(hx - 3 * s, top - 5 * s - bobY, 6 * s, s); g.fillRect(hx - 2 * s, top - 4 * s - bobY, 4 * s, s); g.fillRect(hx - s, top - 3 * s - bobY, 2 * s, s);
          continue;
        }
        var wt = Math.ceil(tw(g, FONT, text));
        w = wt + 13 + (dots ? 13 : 0); h = 17;
        var b = { x: clamp(hx - w / 2, 2, Math.max(2, cssW - w - 2)), ty: Math.max(2, top - 6 - h), w: w, h: h };
        for (var tries = 0; tries < 3 && hits(b, bubs); tries++) b.ty = Math.max(2, b.ty - h - 3);
        bubs.push(b); mark(b.x / s - 1, b.ty / s - 1, w / s + 3, (h + 5) / s + 3);
        var tx = sn(clamp(hx, b.x + 7, b.x + w - 7)), by = sn(b.ty + h);
        plate(g, b.x, b.ty, w, h, '#FFFFFF', C.line);
        g.fillStyle = C.line; g.fillRect(tx - 3, by - u, 7, 2 * u); g.fillRect(tx - 2, by + u, 5, u); g.fillRect(tx - 1, by + 2 * u, 3, u);
        g.fillStyle = '#FFFFFF'; g.fillRect(tx - 2, by - u, 5, 2 * u); g.fillRect(tx - 1, by + u, 3, u);
        g.font = FONT; g.textAlign = 'left'; g.fillStyle = C.eye; g.fillText(text, sn(b.x) + 6, sn(b.ty + h / 2) + 0.5);
        if (dots) for (var q = 0; q < 3; q++) { g.fillStyle = a.hue.m; g.fillRect(sn(b.x) + 10 + wt + q * 4, sn(b.ty + h / 2) + 1 - (!reduced && Math.floor(T / 280) % 4 === q ? 3 : 0), 2, 2); }
      }
    };

    // ---- pointing at things
    var boxOf = function (a) {
      var s = px / dpr, x = Math.round(a.x), y = Math.round(a.y) - Math.round(a.sit * 3);
      // a hair's breadth apart per agent, so two that stand on the same spot for a moment still answer to their own anchor
      return { x: x * s + (a.di - 3.5) * 0.02, y: (y - 20) * s, hw: Math.max(15, 10 * s), top: (y - 37) * s, bot: (y + 3) * s };
    };
    var anchor = function (id) {
      var a = byId[id]; if (!a || a.state === 'unknown') return null;
      var b = boxOf(a); return { x: clamp(b.x, 0, Math.max(0, cssW)), y: clamp(b.y, 0, Math.max(0, cssH)) };
    };
    var hit = function (cx, cy) {
      cx = fin(cx, -1e7); cy = fin(cy, -1e7);
      var best = null, bd = 1e18, i, a, b, d;
      for (i = 0; i < agents.length; i++) {
        a = agents[i]; if (a.state === 'unknown') continue;
        b = boxOf(a);
        if (Math.abs(cx - b.x) <= b.hw && cy >= b.top && cy <= b.bot) { d = (cx - b.x) * (cx - b.x) + (cy - b.y) * (cy - b.y); if (d < bd) { bd = d; best = a.id; } }
      }
      if (best == null) for (i = 0; i < tags.length; i++) { var t = tags[i]; if (byId[t.id] && cx >= t.x - 2 && cx <= t.x + t.w + 2 && cy >= t.y - 2 && cy <= t.y + t.h + 2) { best = t.id; break; } }
      return best;
    };

    // ---- the loop
    var raf = function (fn) { return typeof root.requestAnimationFrame === 'function' ? root.requestAnimationFrame(fn) : 0; };
    var frame = function (t) {
      if (dead) return;
      t = fin(t, lastT == null ? 0 : lastT);
      var dt = lastT == null ? 0 : clamp(t - lastT, 0, 200);
      lastT = t;
      if (!reduced) { T += dt; step(dt); }
      draw();
    };
    var tick = function (t) {
      rafId = 0;
      if (!running || dead) return;
      var hidden = (doc && doc.hidden) || (canvas && canvas.offsetParent === null);
      if (reduced) { // one still picture, drawn again only when something changed
        if (!oneShot) return;
        if (hidden) { rafId = raf(tick); return; }
        oneShot = false; frame(t); return;
      }
      rafId = raf(tick);
      if (hidden || t - lastDraw < 62) return; // about 15 frames a second
      lastDraw = t; frame(t);
    };
    var wake = function () { if (reduced) { oneShot = true; if (running && !rafId && !dead) rafId = raf(tick); } };
    var start = function () { if (dead || running) return; running = true; oneShot = true; whole = true; lastDraw = -1e9; rafId = raf(tick); };
    var stop = function () { running = false; if (rafId && typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(rafId); rafId = 0; };

    // ---- listeners (all removed by destroy)
    var pos = function (e) {
      var r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
      if (r && r.width > 0 && r.height > 0) return { x: (fin(e.clientX, -1e7) - r.left) * (cssW / r.width), y: (fin(e.clientY, -1e7) - r.top) * (cssH / r.height) };
      return { x: fin(e.offsetX, -1e7), y: fin(e.offsetY, -1e7) };
    };
    var setHover = function (id) {
      if (id === hoverId) return;
      hoverId = id; whole = true; if (canvas.style) canvas.style.cursor = id == null ? '' : 'pointer';
      onHover(id); wake();
    };
    var onMove = function (e) { var q = pos(e); setHover(hit(q.x, q.y)); };
    var onLeave = function () { setHover(null); };
    var onClick = function (e) { var q = pos(e), id = hit(q.x, q.y); if (id != null) onPick(id); };
    var onVis = function () { lastDraw = -1e9; whole = true; wake(); }; // back in view: paint the whole picture again
    var io = null;
    if (canvas && canvas.addEventListener) {
      canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onMove);
      canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('pointercancel', onLeave); canvas.addEventListener('click', onClick);
    }
    if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVis);
    if (typeof IntersectionObserver !== 'undefined' && canvas) {
      try { io = new IntersectionObserver(function (es) { for (var i = 0; i < es.length; i++) if (es[i].isIntersecting) onVis(); }); io.observe(canvas); } catch (e) { io = null; }
    }
    var destroy = function () {
      if (dead) return;
      stop(); dead = true;
      if (canvas && canvas.removeEventListener) {
        canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onMove);
        canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('pointercancel', onLeave); canvas.removeEventListener('click', onClick);
      }
      if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', onVis);
      if (io) { try { io.disconnect(); } catch (e) { /* nothing to do */ } io = null; }
    };
    var setFocus = function (id) { var next = id != null && byId[id] ? id : null; if (next !== focusId) { focusId = next; whole = true; wake(); } };

    return { setCrew: setCrew, resize: resize, frame: frame, start: start, stop: stop, destroy: destroy, hit: hit, anchor: anchor, setFocus: setFocus };
  };

  root.OSCockpit = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.OSCockpit;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
