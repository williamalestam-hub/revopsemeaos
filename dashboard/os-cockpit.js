// EMEA RevOps OS — the cockpit at the top of Today: the wiring.
// The picture (a small office where each scheduled agent is a robot) is drawn on one canvas by os-cockpit-scene.js
// (window.OSCockpit). Where each robot belongs is worked out by os-cockpit-model.js (window.OSCrew) from a few facts.
// This file gathers those facts from the documents the page already reads (OS.hub, OS.sense, OS.lanes) and from two
// of its own (hub/weekly, hub/pulse), and keeps the picture, the chips under it and the tooltip in step with them.
// Who writes what: the names, the role sentences and the legend are in index.html. This file writes only inside its
// two drawings (the stage: a canvas and a tooltip; each chip's line). Outside them it listens and sets hidden, class,
// style and aria-*. Words from a document reach the page through textContent or the canvas, never as HTML.
(() => {
  const KEY = '__osCockpit';
  // The dashboard runs these scripts again, in the same window, when a file changes. Whatever the last run set up
  // outside a drawing (its timer, a redraw still pending, its two subscriptions, its listeners, a scene still drawing)
  // is let go of first.
  try { if (window[KEY] && typeof window[KEY].stop === 'function') window[KEY].stop(); } catch (e) { /* nothing to stop */ }

  const Crew = window.OSCrew, Scene = window.OSCockpit;
  if (typeof dash === 'undefined' || !dash || typeof dash.draw !== 'function' || !window.OS || !Crew || typeof Crew.derive !== 'function' || !Scene || typeof Scene.create !== 'function') return;

  const TICK = 30000; // due, late and "next run" move with the clock, so the drawings run again twice a minute
  const SETTLE = 150, LONGEST = 1500; // ms: how long after the last change of a burst the drawings run again, and the longest a burst may hold them
  const STATES = ['working', 'due', 'late', 'error', 'needs', 'idle', 'unknown'];
  // this run's handles, on window so that the next run can stop them
  const S = { dead: false, timer: null, soon: null, began: 0, out: null, live: new Set(), subs: [], listeners: [], off: null, review: { src: 'loading', at: null }, pulse: null };
  window[KEY] = S;

  const rerun = () => { clearTimeout(S.soon); S.soon = null; if (!S.dead) ['cockpit', 'ck-line'].forEach((n) => { try { dash.draw(n); } catch (e) { /* not registered yet */ } }); };
  // Documents change in bursts: a document arrives, then William's reactions to it. Until a burst is over the drawings
  // keep to the last settled facts (see derive), then run again once, so a robot sets off once, for the right place.
  const changed = () => {
    if (S.dead) return;
    if (S.soon === null) S.began = Date.now();
    clearTimeout(S.soon);
    if (Date.now() - S.began >= LONGEST) rerun(); else S.soon = setTimeout(rerun, SETTLE);
  };
  const listen = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); S.listeners.push([target, type, fn, opt]); };

  // ---------- The facts ----------
  // Read from the page's own modules when a drawing runs; nothing of a document is kept here beyond the two small
  // things this file subscribes to itself (the Monday review's time, the agents' heartbeat).
  const str = (v) => (typeof v === 'string' && v ? v : null);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const ms = (iso) => (typeof iso === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(iso) ? Date.parse(iso) : NaN);
  const later = (a, b) => { const x = ms(a), y = ms(b); return Number.isFinite(y) && !(x >= y) ? b : Number.isFinite(x) ? a : null; };
  // Decide prepares two documents. One that can't be read, or is still loading, decides for both; otherwise the task
  // has run if either document is there.
  const both = (a, b) => ['error', 'nodb', 'loading', 'ok'].find((s) => a === s || b === s) || 'missing';
  const unread = () => ({ src: 'error', at: null, status: '', waiting: 0 });
  const facts = () => {
    const os = window.OS || {}, f = {};
    try {
      const hub = os.hub, d = hub.doc(), run = d && d.lastRun && typeof d.lastRun === 'object' ? d.lastRun : null, c = hub.counts();
      // the number the "Needs you" tile shows: the worker's count, less what William has handled on this tab since
      const handled = hub.top().filter((it) => hub.acted(it.id) && (it.status === 'new' || it.status === 'waiting')).length;
      f.desk = { src: hub.state(), at: (run && str(run.at)) || str(d && d.at), status: (run && str(run.status)) || '', waiting: Math.max(0, num(c && c.waiting) - handled) };
    } catch (e) { f.desk = unread(); }
    try {
      const lanes = os.lanes, dec = lanes.doc('decisions'), leo = lanes.doc('leo');
      const open = lanes.items('decisions').filter((x) => !lanes.answered(x.id)).length, forLeo = lanes.items('leo').filter((x) => !lanes.leoActed(x.id)).length;
      f.decide = { src: both(lanes.state('decisions'), lanes.state('leo')), at: later(str(dec && dec.at), str(leo && leo.at)), status: '', waiting: open + forLeo,
        parts: [{ n: open, word: open === 1 ? 'decision' : 'decisions' }, { n: forLeo, word: 'for Leo' }] };
    } catch (e) { f.decide = unread(); }
    for (const k of ['instinct', 'muse']) {
      try {
        const sense = os.sense, d = sense.doc(k);
        f[k] = { src: sense.state(k), at: str(d && d.at), status: '', waiting: sense.items(k).filter((x) => !sense.acted(x.id)).length };
      } catch (e) { f[k] = unread(); }
    }
    f.review = { src: S.review.src, at: S.review.at, status: '', waiting: 0 };
    f.pulse = S.pulse;
    return f;
  };

  // ---------- What the HTML says ----------
  // A person may rename, move or delete any of these, so each is looked for when it is needed.
  const chips = () => [...document.querySelectorAll('[data-ck]')];
  const chipOf = (id) => chips().find((c) => c.dataset.ck === id) || null;
  const nameIn = (chip) => { const b = chip ? [...chip.children].find((x) => x.tagName === 'B') : null; return b ? String(b.textContent || '').trim() : ''; };
  const names = () => { const n = {}; chips().forEach((c) => { const t = nameIn(c); if (t && !(c.dataset.ck in n)) n[c.dataset.ck] = t; }); return n; };
  const roleOf = (id) => { const r = [...document.querySelectorAll('[data-ck-role]')].find((x) => x.dataset.ckRole === id); return r ? String(r.textContent || '').trim() : ''; };
  const linked = (id) => { const c = chipOf(id); return !!c && !!(c.dataset.nav || c.dataset.ckGo); };

  // what the model makes of the facts now; in the middle of a burst of changes, what it made of them before the burst
  const derive = () => {
    if (S.soon !== null && S.out) return S.out;
    const out = Crew.derive(facts(), Date.now(), names());
    S.out = out && typeof out === 'object' ? out : {};
    return S.out;
  };
  const crewOf = (out) => (Array.isArray(out.crew) ? out.crew.filter((a) => a && typeof a === 'object') : []);
  const reduced = () => { try { return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // ---------- The tooltip (inside the stage, so inside the drawing) ----------
  const hideTip = (m) => { m.tipFor = null; m.tip.hidden = true; };
  const hideTips = () => S.live.forEach(hideTip);
  const node = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
  // name, what the agent is for, and the model's short lines (what it is doing; its last result and next run)
  const showTip = (m, id) => {
    const tips = (m.out.tips && typeof m.out.tips === 'object' && m.out.tips[id]) || {}, a = crewOf(m.out).find((x) => x.id === id);
    const said = (v) => (typeof v === 'string' && v ? v : '');
    const rows = [['b', 'ck-tip-name', said(nameIn(chipOf(id)) || (a && a.name))], ['span', 'ck-tip-role', roleOf(id)], ['span', 'ck-tip-state', said(tips.state)]]
      .filter((r) => r[2]).map((r) => node(...r));
    const when = [tips.last, tips.next].filter(said).map((t) => node('span', '', t));
    if (when.length) { const row = node('span', 'ck-tip-when'); row.append(...when); rows.push(row); }
    if (!rows.length) { hideTip(m); return; }
    m.tip.replaceChildren(...rows);
    m.tipFor = id;
    m.tip.hidden = false;
    // Placed from the robot's head and kept inside the stage: above the head; under the robot when there is no room
    // above; at the far edge, beside it if that fits, when there is room neither way; along the floor for an agent
    // that is not in the room.
    const W = m.el.clientWidth, H = m.el.clientHeight, w = m.tip.offsetWidth, h = m.tip.offsetHeight, UP = 14, DOWN = 40, SIDE = 22, EDGE = 4;
    let p = null;
    try { p = m.scene.anchor(id); } catch (e) { p = null; }
    const at = p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
    let x = at ? at.x - w / 2 : (W - w) / 2, y = H - h - EDGE;
    if (at && at.y - UP - h >= EDGE) y = at.y - UP - h;
    else if (at && at.y + DOWN + h <= H - EDGE) y = at.y + DOWN;
    else if (at) {
      y = at.y > H / 2 ? EDGE : H - h - EDGE;
      if (at.x + SIDE + w <= W - EDGE) x = at.x + SIDE; else if (at.x - SIDE - w >= EDGE) x = at.x - SIDE - w;
    }
    m.tip.style.left = Math.round(Math.max(EDGE, Math.min(x, W - w - EDGE))) + 'px';
    m.tip.style.top = Math.round(Math.max(EDGE, Math.min(y, H - h - EDGE))) + 'px';
  };

  // ---------- The stage: canvas, scene, tooltip ----------
  const build = (el, m) => {
    const canvas = document.createElement('canvas'), tip = document.createElement('div');
    canvas.className = 'ck-canvas';
    canvas.setAttribute('role', 'img');
    tip.className = 'ck-tip';
    tip.hidden = true;
    el.replaceChildren(canvas, tip);
    Object.assign(m, { el, canvas, tip, width: null, dpr: null, out: {}, tipFor: null, dead: false });
    m.scene = Scene.create(canvas, {
      now: () => Date.now(), seed: Math.floor(Date.now() / 1000) % 100000, reducedMotion: reduced(),
      onHover: (id) => { if (m.dead) return; if (id) showTip(m, id); else hideTip(m); canvas.style.cursor = id && linked(id) ? 'pointer' : ''; },
      // a click on a robot is a click on its chip: the page's own handler opens the chip's tab
      onPick: (id) => { const c = chipOf(id); hideTip(m); if (c && typeof c.click === 'function') c.click(); },
    });
    m.scene.start();
    S.live.add(m);
    clearInterval(S.timer);
    S.timer = S.dead ? null : setInterval(rerun, TICK); // one timer, however often the stage is mounted
    return m;
  };
  const kill = (m) => {
    if (!m || m.dead) return;
    m.dead = true;
    S.live.delete(m);
    try { m.scene.destroy(); } catch (e) { /* already gone */ }
    if (!S.live.size) { clearInterval(S.timer); S.timer = null; }
  };
  S.stop = () => {
    S.dead = true;
    clearInterval(S.timer);
    clearTimeout(S.soon);
    S.timer = S.soon = null;
    S.subs.splice(0).forEach((u) => { try { if (typeof u === 'function') u(); } catch (e) { /* gone with its database */ } });
    S.listeners.splice(0).forEach(([target, type, fn, opt]) => { try { target.removeEventListener(type, fn, opt); } catch (e) { /* the element left */ } });
    try { if (S.off) S.off(); } catch (e) { /* the bus left */ }
    S.off = null;
    [...S.live].forEach(kill);
  };

  dash.draw('cockpit', {
    mount: (el) => build(el, {}),
    update: (el, m) => {
      if (m.dead) build(el, m); // stopped by a later run of this script, or by a throw: start again in place
      const out = derive();
      m.out = out;
      m.scene.setCrew(crewOf(out));
      // under a hidden tab this is not called; when the tab comes back the width may have changed meanwhile
      const w = el.clientWidth, dpr = window.devicePixelRatio || 1;
      if (w !== m.width || dpr !== m.dpr) { m.width = w; m.dpr = dpr; m.scene.resize(w); }
      m.canvas.setAttribute('aria-label', typeof out.aria === 'string' ? out.aria : '');
      if (m.tipFor) showTip(m, m.tipFor);
    },
    unmount: (el, m) => kill(m),
  });

  // each chip's line (last run and count, or what is wrong) and the chip's one state class
  dash.draw('ck-line', (el) => {
    const out = derive(), id = el.dataset.ckId, a = crewOf(out).find((x) => x.id === id);
    const line = out.lines && typeof out.lines === 'object' && typeof out.lines[id] === 'string' ? out.lines[id] : '';
    el.textContent = line || '—';
    const chip = el.closest('[data-ck]'), state = a && STATES.includes(a.state) ? a.state : 'unknown';
    if (chip) STATES.forEach((s) => chip.classList.toggle('is-' + s, s === state));
  });

  // ---------- Listening ----------
  // the page's own documents: OS.hub, OS.sense and OS.lanes say when one of them, or William's reactions, changed
  try { if (window.OS.docs && typeof window.OS.docs.on === 'function') S.off = window.OS.docs.on(changed); } catch (e) { S.off = null; }

  // the Monday review's document and the agents' heartbeat: one subscription each for the page's life
  (async () => {
    try {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') { S.review = { src: 'nodb', at: null }; return; }
      const db = await c.use('db');
      if (S.dead) return; // a later run of this script has taken over
      if (!db) { S.review = { src: 'nodb', at: null }; changed(); return; }
      S.subs.push(db.doc('hub/weekly').onSnapshot((snap) => {
        const d = snap && snap.exists ? snap.data() : null;
        S.review = d && typeof d === 'object' ? { src: 'ok', at: str(d.at) } : { src: 'missing', at: null };
        changed();
      }, () => { S.review = { src: 'error', at: null }; changed(); }));
      // hub/pulse is optional: agents that write it show as working while a run is under way
      S.subs.push(db.doc('hub/pulse').onSnapshot((snap) => {
        const d = snap && snap.exists ? snap.data() : null;
        S.pulse = d && d.agents && typeof d.agents === 'object' ? d.agents : null;
        changed();
      }, () => { S.pulse = null; changed(); }));
    } catch (e) { if (!S.dead && S.review.src === 'loading') { S.review = { src: 'nodb', at: null }; changed(); } }
  })();

  // the chips: pointing at one, or tabbing to it, lights up its robot; a chip with data-ck-go also scrolls to that
  // element, just after the page's own click handler has opened the chip's tab and scrolled to the top
  const focusOn = (id) => S.live.forEach((m) => { try { m.scene.setFocus(id); } catch (e) { /* the scene left */ } });
  const held = () => { const a = document.activeElement; return (a && a.dataset && a.dataset.ck) || null; };
  const byKeys = (chip) => { try { return chip.matches(':focus-visible'); } catch (e) { return false; } };
  chips().forEach((chip) => {
    const id = chip.dataset.ck;
    listen(chip, 'mouseenter', () => focusOn(id));
    listen(chip, 'mouseleave', () => focusOn(held()));
    // reached with the keyboard, a chip shows its robot's tooltip too: the same words a pointer gets over the robot
    listen(chip, 'focus', () => { focusOn(id); if (byKeys(chip)) S.live.forEach((m) => showTip(m, id)); });
    listen(chip, 'blur', () => { focusOn(null); hideTips(); });
    listen(chip, 'click', () => {
      const go = chip.dataset.ckGo;
      hideTips(); // the tab may change under it
      if (go) setTimeout(() => {
        const t = document.getElementById(go);
        if (!t || t.closest('[hidden]')) return;
        t.style.scrollMarginTop = 'calc(var(--app-tabs-h, 3rem) + 8px)'; // clear of the sticky tab strip
        t.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      }, 0);
    });
  });
  // the "?" button shows or hides the one-line legend
  document.querySelectorAll('[data-ck-help]').forEach((b) => listen(b, 'click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true', legend = document.getElementById(b.getAttribute('aria-controls') || '');
    b.setAttribute('aria-expanded', String(open));
    if (legend) legend.hidden = !open;
  }));
  // the tooltip leaves on Escape and when anything scrolls
  listen(document, 'keydown', (e) => { if (e && e.key === 'Escape') hideTips(); });
  listen(window, 'scroll', hideTips, true);
})();
