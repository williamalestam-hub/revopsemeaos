// EMEA RevOps OS — the cockpit at the top of Today: the wiring.
// The picture (a small office where each scheduled agent is a robot) is drawn on one canvas by os-cockpit-scene.js
// (window.OSCockpit). Where each robot belongs is worked out by os-cockpit-model.js (window.OSCrew) from a few facts.
// This file gathers those facts from the documents the page already reads (OS.hub, OS.sense, OS.lanes) and from two
// of its own (hub/weekly, hub/pulse), and keeps the picture, the chips under it and the tooltip in step with them.
// Who writes what: the names, the role sentences and the legend are in index.html. This file writes only inside its
// two drawings (the stage: a canvas and a tooltip; each chip's line). Outside them it listens and sets hidden, class,
// style, tabindex and aria-*. Words from a document reach the page through textContent or the canvas, never as HTML.
// The picture is for the eye only: everything it says is in the chips and the tooltip, so the canvas is aria-hidden.
(() => {
  const KEY = '__osCockpit';
  // The dashboard runs these scripts again, in the same window, when a file changes. Whatever the last run set up
  // outside a drawing (its timers, its two subscriptions, its listeners, a scene still drawing) is let go of first.
  try { if (window[KEY] && typeof window[KEY].stop === 'function') window[KEY].stop(); } catch (e) { /* nothing to stop */ }

  const Crew = window.OSCrew, Scene = window.OSCockpit;
  if (typeof dash === 'undefined' || !dash || typeof dash.draw !== 'function' || !window.OS || !Crew || typeof Crew.derive !== 'function' || !Scene || typeof Scene.create !== 'function') return;

  const TICK = 30000; // due, late and "next run" move with the clock, so the drawings run again twice a minute
  const SETTLE = 150, LONGEST = 1500; // ms: how long after the last change of a burst the drawings run again, and the longest a burst may hold them
  const HOLD = 2500; // ms: the longest the first crew waits for every document, and William's reactions to it, to answer
  const STATES = ['working', 'due', 'late', 'error', 'needs', 'idle', 'unknown'];
  const NOTHING = { crew: [], lines: {}, lead: {}, brief: {}, tips: {} }; // what is shown while the first crew is held
  // this run's handles, on window so that the next run can stop them
  const S = { dead: false, timer: null, soon: null, hold: null, began: 0, born: Date.now(), open: false, out: null, tips: 0,
    live: new Set(), subs: [], listeners: [], off: null, review: { src: 'loading', at: null, status: '' }, pulse: null };
  window[KEY] = S;

  const rerun = () => { clearTimeout(S.soon); S.soon = null; if (!S.dead) ['cockpit', 'ck-line'].forEach((n) => { try { dash.draw(n); } catch (e) { /* not registered yet */ } }); };
  const listen = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); S.listeners.push([target, type, fn, opt]); };
  const said = (v) => (typeof v === 'string' && v ? v : '');

  // ---------- The first second ----------
  // A count read before William's own reactions to it have answered would be too high, and a robot would set off for
  // his desk and turn back. So the first crew is held (an empty room, the chips at their dash) until every document
  // has answered and each module says its reactions have (ready() on OS.hub, OS.sense and OS.lanes), or for HOLD.
  const answered = () => {
    const os = window.OS || {};
    const ready = (m) => { try { return !m || typeof m.ready !== 'function' || !!m.ready(); } catch (e) { return true; } };
    let loading = S.review.src === 'loading';
    try { loading = loading || [os.hub.state(), os.sense.state('instinct'), os.sense.state('muse'), os.lanes.state('decisions'), os.lanes.state('leo')].includes('loading'); } catch (e) { /* a module is missing: nothing of it to wait for */ }
    return !loading && ready(os.hub) && ready(os.sense) && ready(os.lanes);
  };
  const open = () => {
    if (!S.open && (answered() || Date.now() - S.born >= HOLD)) { S.open = true; clearTimeout(S.hold); S.hold = null; }
    return S.open;
  };
  // Later, documents change in bursts: a document arrives, then William's reactions to it. Until a burst is over the
  // drawings keep to the last settled facts (see derive), then run again once, so a robot sets off once, for the
  // right place.
  const changed = () => {
    if (S.dead) return;
    if (!S.open) { if (open()) rerun(); return; } // the answer the first crew was waiting for: show it at once
    if (S.soon === null) S.began = Date.now();
    clearTimeout(S.soon);
    if (Date.now() - S.began >= LONGEST) rerun(); else S.soon = setTimeout(rerun, SETTLE);
  };

  // ---------- The facts ----------
  // Read from the page's own modules when a drawing runs; nothing of a document is kept here beyond the two small
  // things this file subscribes to itself (the Monday review's time and whether it was posted, the agents' heartbeat).
  const str = (v) => (typeof v === 'string' && v ? v : null);
  // a time as the model reads it: ISO text that names its zone, or it is no time
  const ms = (iso) => (typeof iso === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)$/.test(iso) ? Date.parse(iso.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) : NaN);
  // Decide prepares two documents in every run. One that can't be read, or is still loading, decides for both;
  // otherwise the task has run if either document is there. With both there the time is the earlier of the two, so
  // one the task did not rewrite shows as a run without a result instead of hiding behind the other.
  const both = (a, b) => ['error', 'nodb', 'loading', 'ok'].find((s) => a === s || b === s) || 'missing';
  const earlier = (dec, leo) => {
    const a = str(dec && dec.at), b = str(leo && leo.at);
    if (!dec || !leo) return dec ? a : leo ? b : null;
    return Number.isFinite(ms(a)) && Number.isFinite(ms(b)) ? (ms(b) < ms(a) ? b : a) : null;
  };
  const unread = () => ({ src: 'error', at: null, status: '', waiting: 0 });
  const facts = () => {
    const os = window.OS || {}, f = {};
    try {
      const hub = os.hub, d = hub.doc(), run = d && d.lastRun && typeof d.lastRun === 'object' ? d.lastRun : null, c = hub.counts();
      const n = c && typeof c.waiting === 'number' && Number.isFinite(c.waiting) ? Math.max(0, Math.floor(c.waiting)) : null;
      // the number the "Needs you" tile shows: the worker's count, less what William has handled on this tab since
      const handled = hub.top().filter((it) => hub.acted(it.id) && (it.status === 'new' || it.status === 'waiting')).length;
      // a summary without a count is no data, not "all clear"
      f.desk = { src: hub.state() === 'ok' && n === null ? 'error' : hub.state(), at: (run && str(run.at)) || str(d && d.at), status: (run && str(run.status)) || '', waiting: Math.max(0, (n || 0) - handled) };
    } catch (e) { f.desk = unread(); }
    try {
      const lanes = os.lanes;
      const todo = lanes.items('decisions').filter((x) => !lanes.answered(x.id)).length, forLeo = lanes.items('leo').filter((x) => !lanes.leoActed(x.id)).length;
      f.decide = { src: both(lanes.state('decisions'), lanes.state('leo')), at: earlier(lanes.doc('decisions'), lanes.doc('leo')), status: '', waiting: todo + forLeo,
        parts: [{ n: todo, word: todo === 1 ? 'decision' : 'decisions' }, { n: forLeo, word: 'for Leo' }] };
    } catch (e) { f.decide = unread(); }
    for (const k of ['instinct', 'muse']) {
      try {
        const sense = os.sense, d = sense.doc(k);
        f[k] = { src: sense.state(k), at: str(d && d.at), status: '', waiting: sense.items(k).filter((x) => !sense.acted(x.id)).length };
      } catch (e) { f[k] = unread(); }
    }
    f.review = { src: S.review.src, at: S.review.at, status: S.review.status, waiting: 0 };
    f.pulse = S.pulse;
    return f;
  };

  // ---------- What the HTML says ----------
  // A person may rename, move or delete any of these, so each is looked for when it is needed.
  const chips = () => [...document.querySelectorAll('[data-ck]')];
  const chipOf = (id) => chips().find((c) => c.dataset.ck === id) || null;
  // a chip's name is its own words: its text without the dot and without the line a drawing writes, whether or not
  // they are still in a <b>
  const words = (n) => (n.nodeType === 3 ? n.nodeValue || '' : n.nodeType !== 1 || n.hasAttribute('data-draw') || n.classList.contains('ck-dot') || n.getAttribute('aria-hidden') === 'true' ? '' : [...n.childNodes].map(words).join(''));
  const nameIn = (chip) => (chip ? [...chip.childNodes].map(words).join('').replace(/\s+/g, ' ').trim() : '');
  const names = () => { const n = {}; chips().forEach((c) => { const t = nameIn(c); if (t && !(c.dataset.ck in n)) n[c.dataset.ck] = t; }); return n; };
  const roleOf = (id) => { const r = [...document.querySelectorAll('[data-ck-role]')].find((x) => x.dataset.ckRole === id); return r ? String(r.textContent || '').trim() : ''; };
  const linked = (id) => { const c = chipOf(id); return !!c && !!(c.dataset.nav || c.dataset.ckGo); };
  // a chip that stands for two tabs (data-ck-alt): nothing left for its own tab and something for the other one
  const wantsAlt = (id) => { try { const p = facts()[id].parts; return Array.isArray(p) && p.length > 1 && !p[0].n && p.slice(1).some((x) => x.n > 0); } catch (e) { return false; } };

  // what the model makes of the facts now; while the first crew is held, nothing; in the middle of a burst of changes,
  // what it made of them before the burst
  const derive = () => {
    if (!open()) return NOTHING;
    if (S.soon !== null && S.out) return S.out;
    const out = Crew.derive(facts(), Date.now(), names());
    S.out = out && typeof out === 'object' ? out : {};
    return S.out;
  };
  const crewOf = (out) => (Array.isArray(out.crew) ? out.crew.filter((a) => a && typeof a === 'object') : []);
  const reduced = () => { try { return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // ---------- The tooltip (inside the stage, so inside the drawing) ----------
  // while it shows, the agent's chip is described by it (aria-describedby), so its words are read with the chip
  const describe = (m, id) => chips().forEach((c) => {
    if (id && c.dataset.ck === id) c.setAttribute('aria-describedby', m.tip.getAttribute('id'));
    else if (c.getAttribute('aria-describedby') === m.tip.getAttribute('id')) c.removeAttribute('aria-describedby');
  });
  const hideTip = (m) => { m.tipFor = null; m.tip.hidden = true; describe(m, null); };
  const hideTips = () => S.live.forEach(hideTip);
  const node = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
  // name, what the agent is for, and the model's short lines (what it is doing; its last result and next run)
  const showTip = (m, id) => {
    const tips = (m.out.tips && typeof m.out.tips === 'object' && m.out.tips[id]) || {}, a = crewOf(m.out).find((x) => x.id === id);
    const rows = [['b', 'ck-tip-name', said(nameIn(chipOf(id)) || (a && a.name))], ['span', 'ck-tip-role', roleOf(id)], ['span', 'ck-tip-state', said(tips.state)]]
      .filter((r) => r[2]).map((r) => node(...r));
    const when = [tips.last, tips.next].filter(said).map((t) => node('span', '', t));
    if (when.length) { const row = node('span', 'ck-tip-when'); row.append(...when); rows.push(row); }
    if (!rows.length) { hideTip(m); return; }
    m.tip.replaceChildren(...rows);
    m.tipFor = id;
    m.tip.hidden = false;
    describe(m, id);
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
  // The picture threw (in one of its own frames, or when handed a crew or a size). A canvas that stands still looks
  // current, so the stage folds away and the chips carry on alone, until the stage is mounted anew or a later run of
  // this script takes over. The error is thrown on once, outside the drawing, so that the page's own check reports it.
  const fold = (m, e) => {
    if (m.failed === S) return;
    m.failed = S;
    if (m.tip && !m.dead) hideTip(m);
    kill(m);
    if (m.el) m.el.classList.add('ck-off');
    setTimeout(() => { throw e; }, 0);
  };
  const build = (el, m) => {
    const canvas = document.createElement('canvas'), tip = document.createElement('div');
    let ink = null;
    try { ink = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null; } catch (e) { ink = null; }
    // nothing to draw on here: the stage stays empty and folds away, and the chips carry it alone
    el.classList.toggle('ck-off', !ink);
    if (!ink) { el.replaceChildren(); return Object.assign(m, { el, off: true, dead: false, failed: null, scene: null, tip: null }); }
    canvas.className = 'ck-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    tip.className = 'ck-tip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('id', 'ck-tip' + (S.tips++ ? '-' + S.tips : ''));
    tip.hidden = true;
    el.replaceChildren(canvas, tip);
    Object.assign(m, { el, canvas, tip, off: false, width: null, dpr: null, out: NOTHING, tipFor: null, dead: false, failed: null, started: false });
    m.scene = Scene.create(canvas, {
      now: () => Date.now(), seed: Math.floor(Date.now() / 1000) % 100000, reducedMotion: reduced(),
      onHover: (id) => { if (m.dead) return; if (id) showTip(m, id); else hideTip(m); canvas.style.cursor = id && linked(id) ? 'pointer' : ''; },
      // a click on a robot is a click on its chip: the page's own handler opens the chip's tab
      onPick: (id) => { const c = chipOf(id); if (!m.dead) hideTip(m); if (c && typeof c.click === 'function') c.click(); },
      onError: (e) => fold(m, e),
    });
    S.live.add(m);
    return m;
  };
  const kill = (m) => {
    if (!m || m.dead) return;
    m.dead = true;
    S.live.delete(m);
    if (m.tip) describe(m, null);
    try { if (m.scene) m.scene.destroy(); } catch (e) { /* already gone */ }
  };
  S.stop = () => {
    S.dead = true;
    clearInterval(S.timer);
    clearTimeout(S.soon);
    clearTimeout(S.hold);
    S.timer = S.soon = S.hold = null;
    S.subs.splice(0).forEach((u) => { try { if (typeof u === 'function') u(); } catch (e) { /* gone with its database */ } });
    S.listeners.splice(0).forEach(([target, type, fn, opt]) => { try { target.removeEventListener(type, fn, opt); } catch (e) { /* the element left */ } });
    try { if (S.off) S.off(); } catch (e) { /* the bus left */ }
    S.off = null;
    [...S.live].forEach(kill);
  };

  dash.draw('cockpit', {
    mount: (el) => build(el, {}),
    update: (el, m) => {
      if (m.failed === S) return; // the picture threw in this run: folded away until the stage is mounted anew
      if (m.dead) build(el, m);   // stopped by a later run of this script: start again in place
      if (m.off) return;
      const out = derive();
      m.out = out;
      try {
        m.scene.setCrew(crewOf(out));
        // under a hidden tab this is not called; when the tab comes back the width may have changed meanwhile
        const w = el.clientWidth, dpr = window.devicePixelRatio || 1;
        if (w !== m.width || dpr !== m.dpr) { m.width = w; m.dpr = dpr; m.scene.resize(w); }
        // started in the same call that mounted it, once it has a crew and a size: the order the scene is previewed in
        if (!m.started) { m.started = true; m.scene.start(); }
      } catch (e) { fold(m, e); return; }
      if (m.tipFor) showTip(m, m.tipFor);
    },
    unmount: (el, m) => kill(m),
  });

  // Each chip's line and the chip's one state class. The line is two spans: when (the model's lead, the time) and what
  // (its brief: the count, or what is wrong). A narrow page shows only the second (os-cockpit.css).
  dash.draw('ck-line', (el) => {
    const out = derive(), id = el.dataset.ckId, a = crewOf(out).find((x) => x.id === id);
    const of = (map) => said(map && typeof map === 'object' ? map[id] : '');
    const lead = of(out.brief) ? of(out.lead) : '', what = of(out.brief) || of(out.lines);
    if (what) el.replaceChildren(...(lead ? [node('span', 'ck-when', lead + ' · ')] : []), node('span', 'ck-what', what));
    else el.textContent = '—';
    const chip = el.closest('[data-ck]'), state = !a ? '' : STATES.includes(a.state) ? a.state : 'unknown';
    if (chip) STATES.forEach((s) => chip.classList.toggle('is-' + s, s === state));
  });

  // ---------- Listening ----------
  // the clock: one timer for the page's life, whether or not the picture is mounted, so the chips keep time without
  // it and a stage that was taken out and put back is drawn again within one tick
  // (the Hub pane's run line reads the same schedule, so it is drawn again with the clock too)
  S.timer = setInterval(() => { rerun(); try { dash.draw('hub-run'); } catch (e) { /* not on this page */ } }, TICK);
  S.hold = setTimeout(() => { S.hold = null; if (!S.open) { S.open = true; rerun(); } }, HOLD); // the first crew has waited long enough
  // the page's own documents: OS.hub, OS.sense and OS.lanes say when one of them, or William's reactions, changed
  try { if (window.OS.docs && typeof window.OS.docs.on === 'function') S.off = window.OS.docs.on(changed); } catch (e) { S.off = null; }

  // the Monday review's document and the agents' heartbeat: one subscription each for the page's life
  (async () => {
    const none = () => { if (S.dead) return; S.review = { src: 'nodb', at: null, status: '' }; changed(); };
    try {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') { S.review = { src: 'nodb', at: null, status: '' }; return; }
      const db = await c.use('db');
      if (S.dead) return; // a later run of this script has taken over
      if (!db) { none(); return; }
      S.subs.push(db.doc('hub/weekly').onSnapshot((snap) => {
        const d = snap && snap.exists ? snap.data() : null;
        // the task writes slack: null when the post failed: the review exists, but nothing reached William
        S.review = d && typeof d === 'object' ? { src: 'ok', at: str(d.at), status: d.slack && d.slack.ts ? '' : 'failed' } : { src: 'missing', at: null, status: '' };
        changed();
      }, () => { S.review = { src: 'error', at: null, status: '' }; changed(); }));
      // hub/pulse is optional: agents that write it show as working while a run is under way
      S.subs.push(db.doc('hub/pulse').onSnapshot((snap) => {
        const d = snap && snap.exists ? snap.data() : null;
        S.pulse = d && d.agents && typeof d.agents === 'object' ? d.agents : null;
        changed();
      }, () => { S.pulse = null; changed(); }));
    } catch (e) { if (S.review.src === 'loading') none(); }
  })();

  // The chips. Pointing at one, or tabbing to it, lights up its robot and shows its tooltip. A press is the page's own
  // (data-nav opens the tab); just after it, a chip with data-ck-go scrolls to that element and moves focus there, and
  // one with data-ck-alt goes on to that other tab when its own has nothing left. A chip that leads nowhere shows its
  // tooltip.
  const focusOn = (id) => S.live.forEach((m) => { try { m.scene.setFocus(id); } catch (e) { /* the scene left */ } });
  const byKeys = (chip) => { try { return chip.matches(':focus-visible'); } catch (e) { return false; } };
  const held = () => { const a = document.activeElement; return a && a.dataset && a.dataset.ck && byKeys(a) ? a.dataset.ck : null; };
  const tipFor = (id) => S.live.forEach((m) => { if (id) showTip(m, id); else hideTip(m); });
  chips().forEach((chip) => {
    const id = chip.dataset.ck;
    listen(chip, 'mouseenter', () => { focusOn(id); tipFor(id); });
    listen(chip, 'mouseleave', () => { focusOn(held()); tipFor(held()); }); // back to a chip the keyboard is on, if any
    listen(chip, 'focus', () => { focusOn(id); if (byKeys(chip)) tipFor(id); });
    listen(chip, 'blur', () => { focusOn(null); tipFor(null); });
    listen(chip, 'click', () => {
      const go = chip.dataset.ckGo, alt = chip.dataset.ckAlt;
      if (!chip.dataset.nav && !go) { tipFor(id); return; }
      tipFor(null); // the tab may change under it
      if (alt && wantsAlt(id)) setTimeout(() => { const tab = document.getElementById('nav-' + alt); if (tab && typeof tab.click === 'function') tab.click(); }, 0);
      if (go) setTimeout(() => {
        const t = document.getElementById(go);
        if (!t || t.closest('[hidden]')) return;
        t.style.scrollMarginTop = 'calc(var(--app-tabs-h, 3rem) + 8px)'; // clear of the sticky tab strip
        t.setAttribute('tabindex', '-1');
        t.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
        try { t.focus({ preventScroll: true }); } catch (e) { /* cannot take focus here */ }
      }, 0);
    });
  });
  // the "?" button shows or hides the legend it controls, and says so only when there is one
  document.querySelectorAll('[data-ck-help]').forEach((b) => listen(b, 'click', () => {
    const legend = document.getElementById(b.getAttribute('aria-controls') || '');
    if (!legend) return;
    const show = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(show));
    legend.hidden = !show;
  }));
  // Escape puts the tooltip away (it is inside the stage and scrolls with it, so a scroll leaves it be)
  listen(document, 'keydown', (e) => { if (e && e.key === 'Escape') hideTips(); });
})();
