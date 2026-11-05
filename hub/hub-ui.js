// RevOps Hub — page behaviour: capabilities, subscriptions, rendering, the confirm sheet, Generate, Settings, New item.
// Everything the viewer reads is built with createElement and textContent; the only innerHTML is the output of the
// escaping Markdown renderer in hub-core.js. Capabilities arrive late and may be null: render first, light up after.
(function () {
  'use strict';
  const C = window.HubCore;
  const $ = (id) => document.getElementById(id);

  // ---------- element helper: h(tag, attrs, ...children); strings become text nodes ----------
  function h(tag, attrs) {
    const n = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (k === 'disabled' || k === 'hidden' || k === 'checked' || k === 'value') n[k] = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) {
      const kid = arguments[i];
      if (kid == null || kid === false) continue;
      if (Array.isArray(kid)) kid.forEach((x) => { if (x != null && x !== false) n.append(x); });
      else n.append(kid);
    }
    return n;
  }
  // The one place HTML is set: the renderer escapes first and only makes http(s) anchors.
  function setMd(el, md, slack) { el.innerHTML = C.renderMarkdown(md, { slack: !!slack }); }

  // ---------- state ----------
  const S = {
    now: Date.now(),
    db: null, user: null, sample: null, mcp: null, downloads: null, capsDone: false,
    items: [], localItems: [], runs: [], brief: null, briefKey: '', unsubBrief: null, dbErr: '',
    prefs: C.mergePrefs(null), prefsExists: false, uid: null,
    ui: { doneOpen: false }, open: {}, drafts: {}, dirty: {}, preview: {},
    listInfo: null, tools: null, mcpErr: '', connErr: {},
    triggers: null, triggersState: 'idle', triggersErr: null, triggersRetried: false,
    busy: {}, gen: {}, sampleHidden: false, writeQueue: {}, people: null, sheet: null, renderPending: false,
  };
  const allItems = () => S.items.concat(S.localItems);
  const itemById = (id) => allItems().find((x) => x.id === id) || null;
  const currentBody = (item) => (S.drafts[item.id] != null ? S.drafts[item.id] : ((item.prepared && item.prepared.body) || ''));
  const infoFor = (name) => ((S.listInfo && S.listInfo.servers) || []).find((s) => s && s.server === name) || null;
  // Each degraded connector's own words, so a disabled button says "Reconnect Gmail…" rather than a generic "not connected".
  function connectorReasons() {
    const out = {}; if (!S.mcp) return out;
    for (const name of C.CONNECTORS) {
      const st = S.mcpErr ? { copy: C.connectorCopy(name, S.mcpErr) } : C.connectorStatus(name, infoFor(name), S.connErr[name]);
      if (st.copy) out[name] = st.copy;
    }
    return out;
  }
  const TYPE_LABEL = { slack: 'Slack message', email: 'Email (plain text)', doc: 'Document (Markdown)', sheet: 'Sheet (CSV)', notion: 'Notion page (Markdown)', plan: 'Plan (Markdown)', brief: 'Brief (Markdown)', note: 'Note (Markdown)' };

  // ---------- boot and capabilities ----------
  function boot() {
    renderAll();
    wireTop();
    setInterval(() => { S.now = Date.now(); renderAll(true); }, 60000); // the clock moves: snoozes expire, due flags turn; never a write, never Claude
    resolveCaps();
  }
  function resolveCaps() {
    const can = window.claude && typeof window.claude.use === 'function';
    const use = (name) => { if (!can) return Promise.resolve(null); try { return Promise.resolve(window.claude.use(name)).catch(() => null); } catch (e) { return Promise.resolve(null); } };
    use('db').then(onDb);
    use('user').then(onUser);
    use('sample').then((s) => { S.sample = s; renderAll(true); });
    use('downloads').then((d) => { S.downloads = d; renderAll(true); });
    use('mcp').then(onMcp);
  }
  function onDb(db) {
    S.db = db; if (!db) { renderAll(); return; }
    const onErr = (what) => (e) => { S.dbErr = (e && e.code) || 'unavailable'; toast(what + ' stopped updating (' + S.dbErr + '). Reload the page.', true); renderNeeds(); };
    try {
      db.collection('items').orderBy('updatedAt', 'desc').limit(500).onSnapshot((snap) => {
        S.items = snap.docs.filter((d) => d.exists).map((d) => Object.assign({}, d.data(), { id: d.id }));
        renderAll(true);
      }, onErr('Items'));
      db.collection('runs').orderBy('startedAt', 'desc').limit(10).onSnapshot((snap) => {
        S.runs = snap.docs.filter((d) => d.exists).map((d) => Object.assign({}, d.data(), { id: d.id }));
        renderTop(); renderAuto();
      }, onErr('Runs'));
      db.doc('settings/prefs').onSnapshot((snap) => {
        S.prefsExists = snap.exists; S.prefs = C.mergePrefs(snap.exists ? snap.data() : null);
        renderAll(true);
      }, onErr('Settings'));
      subscribeBrief();
    } catch (e) { S.dbErr = 'invalid_argument'; renderNeeds(); }
    if (S.uid) loadUi();
  }
  function subscribeBrief() {
    if (!S.db) return;
    const key = C.dateKey(Date.now()); if (key === S.briefKey) return;
    if (S.unsubBrief) { try { S.unsubBrief(); } catch (e) { /* already gone */ } }
    S.briefKey = key;
    S.unsubBrief = S.db.doc('briefs/' + key).onSnapshot((snap) => { S.brief = snap.exists ? snap.data() : null; renderBrief(); }, () => { S.brief = null; renderBrief(); });
  }
  async function onUser(user) {
    S.user = user; if (!user) return;
    try { S.uid = await user.id(); } catch (e) { S.uid = null; }
    if (S.uid && S.db) loadUi();
  }
  async function loadUi() {
    try {
      const snap = await S.db.doc('data/users/' + S.uid + '/ui').get();
      if (snap.exists) { const d = snap.data(); S.ui.doneOpen = !!d.doneOpen; renderDone(); }
    } catch (e) { /* per-viewer prefs are a convenience */ }
  }
  let uiTimer = null;
  function saveUi() {
    if (!S.db || !S.uid) return;
    clearTimeout(uiTimer); // a burst of toggles becomes one write; the per-document queue keeps it one at a time
    uiTimer = setTimeout(() => {
      const key = 'ui:' + S.uid;
      const write = () => S.db.doc('data/users/' + S.uid + '/ui').set({ doneOpen: !!S.ui.doneOpen, updatedAt: C.isoAt() });
      S.writeQueue[key] = (S.writeQueue[key] || Promise.resolve()).then(write, write).catch(() => { /* per-viewer prefs are a convenience */ });
    }, 500);
  }
  async function onMcp(mcp) {
    S.mcp = mcp; if (!mcp) { S.tools = null; renderAll(); return; }
    try {
      S.listInfo = await mcp.listTools();
      S.tools = C.toolSets(S.listInfo); S.mcpErr = '';
    } catch (e) { S.mcpErr = (e && e.code) || 'upstream_error'; S.tools = {}; }
    renderAll(true);
    const ccr = S.tools && S.tools['Claude Code Remote'];
    if (ccr && ccr.has('list_triggers')) loadTriggers(false);
  }
  // Scheduled tasks via Claude Code Remote: a read, so one unattended retry is allowed when the error says so.
  async function loadTriggers(refresh) {
    const ccr = S.tools && S.tools['Claude Code Remote']; if (!S.mcp || !ccr || !ccr.has('list_triggers')) return;
    if (S.triggersState === 'loading') return;
    S.triggersState = 'loading'; renderTriggers();
    try {
      const res = await S.mcp.callTool('Claude Code Remote', 'list_triggers', { limit: 50 }, refresh ? { cache: { refresh: true } } : undefined);
      S.triggers = C.triggerRows(res && res.payload, S.prefs); S.triggersState = 'ok'; S.triggersErr = null; S.connErr['Claude Code Remote'] = '';
    } catch (e) {
      S.triggersState = 'error'; S.triggersErr = e || {}; S.connErr['Claude Code Remote'] = (e && e.code) || 'upstream_error';
      if (e && e.retryable && !S.triggersRetried) { S.triggersRetried = true; setTimeout(() => loadTriggers(false), (e.retryAfterMs || 1500) + Math.random() * 1500); }
    }
    renderAuto(); renderConns(); renderTop();
  }

  // ---------- rendering ----------
  // A passive render (a snapshot, the minute tick, a return to the tab) must not pull the caret out of a draft he is
  // typing: while a card's textarea, instruction box or id field has focus, the parts outside the cards redraw and the
  // cards wait for the blur (wireTop flushes the pending render then). A render after his own click is never passive.
  function editing() { const a = document.activeElement; return !!(a && /^(body|gen|pick)-/.test(a.id || '')); }
  function renderAll(passive) {
    renderTop(); renderAuto(); renderDone(); renderConns();
    if (passive && editing()) { S.renderPending = true; return; }
    S.renderPending = false;
    renderNeeds(); renderBrief(); renderInsights();
  }
  function renderTop() {
    $('top-date').textContent = C.longDate(S.now);
    const hh = C.workerHealth(S.runs, S.now);
    const chip = $('health'); chip.dataset.state = hh.state; $('health-label').textContent = hh.label;
    chip.title = hh.run ? 'Last run ' + C.relativeTime(hh.at, S.now) + (hh.run.note ? ' · ' + hh.run.note : '') : 'The intake worker has not written a run yet';
    $('prepared-at').textContent = hh.at ? 'Prepared at ' + C.clock(hh.at) + (C.dateKey(hh.at) === C.dateKey(S.now) ? '' : ' · ' + C.relativeTime(hh.at, S.now)) : 'Not prepared yet';
    const run = $('btn-run'); const ccr = S.tools && S.tools['Claude Code Remote'];
    const canFire = !!(ccr && ccr.has('fire_trigger')); const hasTrig = !!S.prefs.triggerId;
    run.disabled = !(canFire && hasTrig) || !!S.busy.run;
    run.title = !S.mcp ? 'Connectors are not available in this view' : !canFire ? 'Claude Code Remote is not connected' : !hasTrig ? 'Set the intake task id in Settings first' : 'Start one intake run now';
    $('link-os').href = C.isClaudeUrl(S.prefs.osUrl) ? S.prefs.osUrl : C.DEFAULT_PREFS.osUrl; // a shared document feeds this href: claude.ai links only
    $('btn-settings').title = S.prefs.escalateToConfirmed ? 'Settings' : 'Settings · the escalation contact is still an assumption';
  }
  function renderNeeds() {
    const groups = C.groupNeedsYou(allItems(), S.now);
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const box = $('needs-list'); box.replaceChildren();
    for (const g of groups) {
      if (!g.items.length) continue;
      box.append(h('div', { class: 'grp' },
        h('div', { class: 'grp-h' }, h('span', { class: 'dot', dataset: { sev: g.severity } }), g.label, h('span', { class: 'count', text: String(g.items.length) })),
        h('div', { class: 'list' }, g.items.map(card))));
    }
    $('needs-count').textContent = total ? String(total) : '';
    $('needs-empty').hidden = total > 0;
    $('needs-hint').textContent = S.dbErr ? 'Live updates stopped (' + S.dbErr + '): reload the page.' : (!S.db && S.capsDone ? 'Not connected to the Hub database in this view.' : '');
  }
  function renderInsights() {
    const list = C.insightItems(allItems()); const box = $('insights-list'); box.replaceChildren();
    list.forEach((it) => box.append(card(it)));
    $('insights-count').textContent = list.length ? String(list.length) : '';
    $('insights-empty').hidden = list.length > 0;
  }
  function card(item) {
    const id = item.id; const open = !!S.open[id]; const p = item.prepared;
    const el = h('article', { class: 'card' + (open ? ' open' : '') + (S.busy[id] ? ' busy' : ''), dataset: { id } });
    el.append(h('div', { class: 'card-top' },
      h('span', { class: 'chip kind', text: C.KIND_LABEL[item.kind] || item.kind || 'Item' }),
      h('h3', { class: 'card-title' }, h('button', { type: 'button', 'aria-expanded': String(open), onclick: () => toggleOpen(id) }, item.title || 'Untitled')),
      h('span', { class: 'dot', dataset: { sev: item.severity }, title: C.SEVERITY_LABEL[item.severity] || '' })));
    if (item.why) el.append(h('p', { class: 'card-why', text: item.why }));
    el.append(sourceRow(item));
    if (!open && p && p.body) el.append(h('p', { class: 'preview kind-' + (p.type || 'note'), text: C.firstLines(p.body, 2).join('\n') }));
    if (open) el.append(cardBody(item));
    el.append(actionRow(item));
    return el;
  }
  function sourceRow(item) {
    const s = item.source || {}; const row = h('div', { class: 'card-src' });
    row.append(h('span', { text: C.sourceLine(item, S.now) || 'No source' }));
    if (s.url && /^https?:\/\//i.test(s.url)) row.append(h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: 'Open source' }));
    if (item.dueAt) { const late = C.parseTime(item.dueAt) < S.now; row.append(h('span', { class: 'due' + (late ? ' late' : ''), text: (late ? 'was due ' : 'due ') + C.relativeTime(item.dueAt, S.now) })); }
    if (item.status === 'snoozed') row.append(h('span', { class: 'chip', text: 'snoozed' }));
    if (item.status === 'approved') row.append(h('span', { class: 'chip state-warn', text: 'in flight' }));
    if (item.status === 'new') row.append(h('span', { class: 'chip', text: 'new' }));
    return row;
  }
  function cardBody(item) {
    const id = item.id; const p = item.prepared; const body = h('div', { class: 'card-body' });
    if (item.summary) body.append(h('p', { class: 'summary', text: item.summary }));
    if (p) {
      const type = p.type || 'note';
      const ta = h('textarea', { id: 'body-' + id, class: type === 'sheet' ? 'csv' : 'plain', 'aria-label': 'Draft body', value: currentBody(item),
        oninput: (e) => { S.drafts[id] = e.target.value; S.dirty[id] = true; } });
      const by = p.generatedBy ? ' · drafted by the ' + p.generatedBy + (p.generatedAt ? ' ' + C.relativeTime(p.generatedAt, S.now) : '') : '';
      body.append(h('label', { for: 'body-' + id, text: (TYPE_LABEL[type] || type) + by }), ta);
      const rec = h('div', { class: 'recips' }, h('span', { class: 'muted small', text: 'To' }));
      const to = Array.isArray(p.to) ? p.to : [];
      if (!to.length && !p.channelId) rec.append(h('span', { class: 'muted small', text: type === 'email' || type === 'slack' ? 'no recipient yet' : 'nobody (a document)' }));
      for (const t of to) rec.append(h('span', { class: 'chip' }, (t && t.name) || '(unnamed)', t && (t.slackId || t.email) ? h('span', { class: 'id', text: t.slackId || t.email }) : null));
      if (p.channelId) rec.append(h('span', { class: 'chip' }, p.channelName ? '#' + p.channelName : 'channel', h('span', { class: 'id', text: p.channelId })));
      if (p.threadTs) rec.append(h('span', { class: 'muted small' }, 'thread ', h('span', { class: 'id', text: p.threadTs })));
      if (p.subject) rec.append(h('span', { class: 'small muted', text: 'Subject: ' + p.subject }));
      body.append(rec);
      if (S.people && S.people.itemId === id) body.append(peoplePicker(item));
      if (S.preview[id]) { const prev = h('div', { class: 'md md-prev' }); setMd(prev, currentBody(item), type === 'slack'); body.append(prev); }
    } else {
      body.append(h('p', { class: 'muted small', text: 'No draft yet. Generate one below, or just tick it off.' }));
    }
    const gen = genBox(item); if (gen) body.append(gen);
    const log = (item.log || []).slice(-6).reverse();
    if (log.length) body.append(h('ul', { class: 'log', 'aria-label': 'Recent log' }, log.map((e) => {
      const span = h('span'); linkifyInto(span, [e.event, e.by, e.detail].filter(Boolean).join(' · '));
      return h('li', null, h('span', { class: 't', text: C.clock(e.at) }), span);
    })));
    return body;
  }
  function genBox(item) {
    if (!S.sample || S.sampleHidden) return null;
    const id = item.id; const g = S.gen[id] || {}; const running = !!g.ctl;
    const hasBody = !!currentBody(item).trim();
    const input = h('input', { type: 'text', id: 'gen-' + id, placeholder: hasBody ? 'Refine: shorter, add the numbers, make it Swedish…' : 'What should the draft say?', 'aria-label': 'Instruction for Claude',
      value: g.instruction || '', disabled: running,
      oninput: (e) => { S.gen[id] = Object.assign({}, S.gen[id], { instruction: e.target.value }); },
      onkeydown: (e) => { if (e.key === 'Enter' && !running) { e.preventDefault(); runGenerate(item); } } });
    const canPreview = item.prepared && (C.DOC_TYPES.indexOf(item.prepared.type) >= 0 || item.prepared.type === 'slack');
    const row = h('div', { class: 'gen-row' }, input,
      h('button', { type: 'button', class: 'btn primary sm', disabled: running, onclick: () => runGenerate(item) }, hasBody ? 'Refine' : 'Generate'),
      running ? h('button', { type: 'button', class: 'btn sm', onclick: () => g.ctl.abort() }, 'Stop') : null,
      canPreview ? h('button', { type: 'button', class: 'btn quiet sm', 'aria-pressed': String(!!S.preview[id]), onclick: () => { S.preview[id] = !S.preview[id]; renderAll(); } }, 'Preview') : null);
    return h('div', { class: 'gen' }, row, h('div', { class: 'gen-status' + (g.error ? ' error' : ''), text: g.status || '' }));
  }
  function actionRow(item) {
    const id = item.id; const open = !!S.open[id]; const row = h('div', { class: 'btn-row' });
    row.append(h('button', { type: 'button', class: 'btn sm', onclick: () => toggleOpen(id) }, open ? 'Close' : 'Open'));
    const acts = C.availableActions(item, { tools: S.tools, downloads: !!S.downloads, reasons: connectorReasons() });
    const inFlight = item.status === 'approved';
    const terminal = !inFlight && !C.canTransition(item.status, 'done');
    for (const a of acts) {
      if (a.kind === 'local') continue;
      if (!S.mcp && a.id !== 'download_md') continue; // nothing to call in this view
      if (a.id === 'download_md' && !S.downloads) continue;
      row.append(h('button', { type: 'button', class: 'btn sm' + (a.id === 'slack_send' ? ' primary' : ''), disabled: !a.enabled || !!S.busy[id] || inFlight || terminal, title: a.reason || '', onclick: () => onAction(item, a.id) }, a.label));
    }
    if (!terminal) {
      row.append(h('span', { class: 'spacer' }));
      for (const a of acts.filter((x) => x.kind === 'local')) {
        row.append(h('button', { type: 'button', class: 'btn quiet sm' + (a.id === 'dismiss' ? ' danger-text' : ''), disabled: !!S.busy[id] || inFlight, onclick: () => onAction(item, a.id) }, a.label));
      }
    }
    return row;
  }
  function toggleOpen(id) { S.open[id] = !S.open[id]; renderAll(); }
  function focusCard(id) {
    const el = document.querySelector('[data-id="' + String(id).replace(/["\\]/g, '\\$&') + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function linkifyInto(el, text) {
    const re = /https?:\/\/[^\s<>"')]+/g; let last = 0; let m;
    while ((m = re.exec(text))) {
      if (m.index > last) el.append(text.slice(last, m.index));
      el.append(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer', text: 'link' }));
      last = m.index + m[0].length;
    }
    if (last < text.length) el.append(text.slice(last));
  }
  function renderBrief() {
    const b = S.brief; $('brief').hidden = !b; $('brief-empty').hidden = !!b;
    if (!b) return;
    $('brief-slot').textContent = (b.slot === 'midday' ? 'Midday brief' : 'Morning brief') + (b.createdAt ? ' · written ' + C.clock(b.createdAt) : '');
    $('brief-headline').textContent = b.headline || '';
    setMd($('brief-md'), b.markdown || '', false);
    const moves = Array.isArray(b.moves) ? b.moves.slice(0, 3) : []; const mv = $('brief-moves'); mv.replaceChildren(); mv.hidden = !moves.length;
    for (const m of moves) {
      const target = m.itemId ? itemById(m.itemId) : null;
      mv.append(h('li', null, target ? h('button', { type: 'button', onclick: () => { S.open[target.id] = true; renderAll(); focusCard(target.id); } }, m.title || 'Move') : h('span', { text: m.title || 'Move' }), m.why ? h('span', { class: 'why', text: ' · ' + m.why }) : null));
    }
    const ms = Array.isArray(b.meetings) ? b.meetings : []; const box = $('brief-meetings'); box.replaceChildren(); box.hidden = !ms.length;
    for (const m of ms) {
      const prep = m.itemId ? itemById(m.itemId) : null; const isOpen = !!(prep && S.open[prep.id]);
      box.append(h('div', { class: 'meet' }, h('span', { class: 'mt', text: C.clock(m.at) || '—' }),
        h('span', { class: 'mtitle' }, m.title || 'Meeting', h('span', { class: 'chip', text: m.internal === false ? 'external' : 'internal' })),
        h('button', { type: 'button', class: 'btn sm', disabled: !prep, title: prep ? '' : 'No prep item for this meeting', 'aria-expanded': String(isOpen),
          onclick: () => { if (prep) { S.open[prep.id] = !S.open[prep.id]; renderAll(); } } }, isOpen ? 'Close prep' : 'Open prep'),
        isOpen ? h('div', { class: 'meet-prep' }, card(prep)) : null));
    }
  }
  function renderAuto() {
    const runs = C.sortRuns(S.runs).slice(0, 10); const box = $('runs-list'); box.replaceChildren();
    $('runs-empty').hidden = runs.length > 0; $('runs-count').textContent = runs.length ? 'last ' + runs.length : '';
    for (const r of runs) {
      const srcs = r.sources && typeof r.sources === 'object' ? Object.keys(r.sources).map((k) => k + ' ' + r.sources[k]).join(' · ') : '';
      const errs = Array.isArray(r.errors) ? r.errors.map(String) : [];
      box.append(h('div', { class: 'run' }, h('span', { class: 'dot', dataset: { run: r.status || 'unknown' } }),
        h('div', null,
          h('div', { class: 'r-main' }, h('span', { class: 'r-when', text: runWhen(r) }),
            h('span', { class: 'chip' + (r.status === 'failed' ? ' state-bad' : r.status === 'ok' ? ' state-ok' : ' state-warn'), text: r.status || 'unknown' }),
            r.trigger ? h('span', { class: 'muted small', text: r.trigger }) : null),
          h('div', { class: 'r-counts', text: C.runCounts(r) }),
          srcs ? h('div', { class: 'r-src', text: srcs }) : null,
          errs.length ? h('div', { class: 'r-err', text: errs.slice(0, 3).join(' · ') + (errs.length > 3 ? ' · +' + (errs.length - 3) + ' more' : '') }) : null,
          r.note ? h('div', { class: 'r-src', text: String(r.note) }) : null)));
    }
    renderTriggers();
  }
  function runWhen(r) {
    const t = C.parseTime(r.startedAt); if (!isFinite(t)) return r.id || 'run';
    const key = C.dateKey(t); const day = key === C.dateKey(S.now) ? 'Today' : key === C.dateKey(S.now - 86400000) ? 'Yesterday' : key;
    return day + ' ' + C.clock(t) + (r.finishedAt ? '–' + C.clock(r.finishedAt) : '');
  }
  function renderTriggers() {
    const box = $('triggers-list'); box.replaceChildren(); const note = $('triggers-note'); const btn = $('btn-refresh-triggers');
    const ccr = S.tools && S.tools['Claude Code Remote']; const canList = !!(ccr && ccr.has('list_triggers'));
    btn.hidden = !canList; btn.disabled = S.triggersState === 'loading';
    note.hidden = false;
    if (!S.mcp) { note.textContent = 'Connectors are not available in this view, so only the worker’s own runs are shown.'; return; }
    if (!canList) { note.textContent = C.connectorStatus('Claude Code Remote', infoFor('Claude Code Remote'), S.connErr['Claude Code Remote']).copy || 'Connect Claude Code Remote to see your scheduled tasks.'; return; }
    if (!S.triggers) {
      note.textContent = S.triggersState === 'error' ? C.connectorCopy('Claude Code Remote', S.triggersErr && S.triggersErr.code, S.triggersErr && S.triggersErr.message) : 'Loading your scheduled tasks…';
      return;
    }
    const rows = S.triggers;
    for (const t of rows) {
      box.append(h('div', { class: 'trig' + (t.isIntake ? ' intake' : '') },
        h('span', { class: 't-name' }, t.name, t.isIntake ? h('span', { class: 'chip kind', text: 'intake' }) : null, h('span', { class: 'chip' + (t.enabled ? '' : ' state-warn'), text: t.enabled ? 'on' : 'off' })),
        h('span', { class: 'id', text: t.id }),
        h('span', { class: 't-meta' },
          h('span', { text: t.nextRunAt ? 'next ' + C.relativeTime(t.nextRunAt, S.now) + ' (' + C.clock(t.nextRunAt) + ')' : 'no next run' }),
          h('span', { class: t.failed ? 'fail' : '', text: t.lastStatus ? 'last run ' + t.lastStatus + (t.lastAt ? ' · ' + C.relativeTime(t.lastAt, S.now) : '') : 'never ran' }),
          t.cron ? h('span', { class: 'mono', text: t.cron }) : null)));
    }
    if (S.triggersState === 'error') note.textContent = 'Could not refresh: ' + C.connectorCopy('Claude Code Remote', S.triggersErr && S.triggersErr.code, S.triggersErr && S.triggersErr.message);
    else if (!rows.length) note.textContent = 'No scheduled tasks on this account yet.';
    else note.hidden = true;
  }
  // Every connector gets its own tile and its own words; never one banner for all of them.
  function renderConns() {
    const box = $('conns'); box.replaceChildren();
    for (const name of C.CONNECTORS) {
      let st;
      if (!S.mcp) st = { state: 'off', label: S.capsDone ? 'Unavailable' : 'Checking…', copy: S.capsDone ? 'Connectors are not available in this view.' : '' };
      else if (S.mcpErr) st = { state: 'trouble', label: 'Unknown', copy: C.connectorCopy(name, S.mcpErr) };
      else st = C.connectorStatus(name, infoFor(name), S.connErr[name]);
      box.append(h('div', { class: 'conn', dataset: { state: st.state } },
        h('span', { class: 'c-name' }, h('span', { class: 'dot' }), name, h('span', { class: 'muted small', text: st.label })),
        st.copy ? h('span', { class: 'c-copy', text: st.copy }) : null));
    }
  }
  function renderDone() {
    const list = C.doneTodayItems(allItems(), S.now); const box = $('done-list'); box.replaceChildren();
    $('done-count').textContent = list.length ? String(list.length) : ''; $('done-empty').hidden = list.length > 0;
    $('btn-done-toggle').setAttribute('aria-expanded', String(!!S.ui.doneOpen)); $('done-body').hidden = !S.ui.doneOpen;
    for (const it of list) {
      const last = (it.log || []).slice(-1)[0];
      const det = h('span', { class: 'd-detail' });
      linkifyInto(det, [C.clock(it.updatedAt), last ? (last.detail || last.event) : ''].filter(Boolean).join(' · '));
      box.append(h('div', { class: 'done-row' }, h('span', { class: 'chip' + (it.status === 'done' ? ' state-ok' : ''), text: it.status === 'done' ? 'Done' : 'Dismissed' }),
        h('div', null, h('div', { class: 'd-title', text: it.title }), det)));
    }
  }

  // ---------- writes: one at a time per document ----------
  function commit(item) {
    const id = item.id;
    const i = S.items.findIndex((x) => x.id === id);
    if (!S.db) { // no database in this view: keep it for this visit only
      const j = S.localItems.findIndex((x) => x.id === id); if (j >= 0) S.localItems[j] = item; else S.localItems.unshift(item);
      renderAll(); return Promise.resolve();
    }
    const exists = i >= 0;
    if (exists) S.items[i] = item; else S.items.unshift(item); // optimistic; the snapshot confirms it
    renderAll();
    const ref = S.db.collection('items').doc(id);
    const write = () => (exists ? ref.update({ status: item.status, snoozeUntil: item.snoozeUntil == null ? null : item.snoozeUntil, updatedAt: item.updatedAt, log: item.log || [], prepared: item.prepared == null ? null : item.prepared }) : ref.set(item));
    const q = (S.writeQueue[id] || Promise.resolve()).then(write, write);
    S.writeQueue[id] = q.catch(() => {});
    return q.catch((e) => { toast('Could not save “' + (item.title || id) + '”: ' + ((e && e.code) || 'error'), true); throw e; });
  }
  function setBusy(id, on) { if (on) S.busy[id] = true; else delete S.busy[id]; renderAll(); }

  // ---------- card actions ----------
  async function onAction(item, actionId) {
    const now = Date.now(); const fresh = itemById(item.id) || item;
    try {
      if (actionId === 'done') return await commit(C.transition(fresh, 'done', { nowMs: now, event: 'done', detail: 'ticked off' }));
      if (actionId === 'dismiss') return await commit(C.transition(fresh, 'dismissed', { nowMs: now, event: 'dismissed' }));
      if (actionId === 'snooze1' || actionId === 'snooze3') { const d = actionId === 'snooze1' ? 1 : 3; return await commit(C.transition(fresh, 'snoozed', { nowMs: now, snoozeUntil: C.snoozeUntil(now, d), detail: d + ' d' })); }
      if (actionId === 'escalate') return await escalate(fresh);
      if (actionId === 'slack_find') return await findPerson(fresh);
      openConfirm(fresh, C.buildAction(actionId, fresh, { body: currentBody(fresh), prefs: S.prefs }));
    } catch (e) { toast(actionError(e), true); }
  }
  function actionError(e) {
    const code = e && e.code;
    if (code === 'unresolved_recipient') return 'Pick the person first: Find person gives the message a Slack id, or add an email in the draft.';
    if (code === 'empty_body') return 'The draft is empty. Write or generate it first.';
    if (code === 'no_name') return 'There is no name to search for. Add the recipient to the draft first.';
    if (code === 'no_trigger') return 'Set the intake task id in Settings first.';
    if (code === 'refused') return 'This item is already ' + e.from + '. It will refresh in a moment.';
    return 'Could not do that: ' + ((e && (e.code || e.message)) || 'unknown error');
  }
  function openConfirm(item, action) {
    const isDl = action.kind === 'download';
    const body = h('div', { class: 'sheet-b' },
      h('dl', { class: 'kv' },
        h('dt', { text: 'Action' }), h('dd', { text: action.label }),
        h('dt', { text: 'Tool' }), h('dd', { class: 'mono', text: isDl ? 'downloads.save' : action.server + ' · ' + action.tool }),
        h('dt', { text: 'Destination' }), h('dd', { text: action.destination }),
        item ? h('dt', { text: 'Item' }) : null, item ? h('dd', { text: item.title }) : null),
      h('div', null, h('p', { class: 'note', text: action.kind === 'run' ? 'The message the task receives after its own prompt:' : 'Exactly this text, as it will be sent:' }),
        h('pre', { class: 'text' + (action.input && action.input.contentMimeType === 'text/csv' ? ' csv' : ''), text: action.text })),
      h('p', { class: 'note', text: noteFor(action) }));
    showSheet({ title: 'Confirm: ' + action.label, hint: 'One click is the approval', body, buttons: [
      h('button', { type: 'button', class: 'btn', onclick: closeSheet }, 'Cancel'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => (item ? performAction(item, action) : performRun(action)) }, action.label),
    ] });
  }
  function noteFor(a) {
    if (a.kind === 'send') return 'The Hub marks the item approved while it sends and done when it has, with the link. If ' + a.server + ' does not answer cleanly it says so and does not retry.';
    if (a.kind === 'draft') return 'A draft only: nothing goes out until you send it yourself in ' + a.server + '.';
    if (a.kind === 'create') return 'Created as you, the signed-in viewer. The item is marked done with a link once it exists.';
    if (a.kind === 'download') return 'Your browser asks where to save it. The item stays as it is, with a log line.';
    if (a.kind === 'run') return 'Starts one intake run on your scheduled task. The worker prepares items and sends nothing.';
    return '';
  }
  async function performAction(item, action) {
    closeSheet();
    const id = item.id; const now = Date.now();
    setBusy(id, true);
    let cur = itemById(id) || item;
    if (action.kind === 'download') {
      try {
        await S.downloads.save(action.input);
        await commit(C.addLog(cur, 'downloaded', 'page', action.input.filename, C.isoAt(now)));
        toast('Saved ' + action.input.filename);
      } catch (e) { if (!e || e.code !== 'declined') toast('Could not save the file' + (e && e.code ? ' (' + e.code + ')' : '') + '.', true); }
      setBusy(id, false); return;
    }
    try {
      if (S.dirty[id]) cur = C.withPrepared(cur, { body: action.text, generatedBy: 'page', generatedAt: C.isoAt(now) }, now);
      cur = C.beforeAction(cur, action, now);
      await commit(cur);
      delete S.dirty[id]; delete S.drafts[id];
    } catch (e) { toast(actionError(e), true); setBusy(id, false); return; }
    try {
      const res = await S.mcp.callTool(action.server, action.tool, action.input); // no signal: a one-shot write is never aborted
      const link = C.extractLink(res && res.payload != null ? res.payload : res);
      S.connErr[action.server] = '';
      await commit(C.afterSuccess(cur, action, link, Date.now()));
      toast(action.label + ': done.', false, link);
    } catch (e) {
      S.connErr[action.server] = (e && e.code) || 'upstream_error';
      try { await commit(C.afterFailure(cur, action, e || {}, Date.now())); } catch (e2) { /* the toast carries the outcome */ }
      toast(C.failureCopy(action, e || {}), true);
    }
    setBusy(id, false);
  }
  async function performRun(action) {
    closeSheet(); S.busy.run = true; renderTop();
    try {
      await S.mcp.callTool(action.server, action.tool, action.input);
      S.connErr[action.server] = '';
      toast('Intake run started. Items appear here as the worker writes them.');
      setTimeout(() => loadTriggers(true), 2500);
    } catch (e) { S.connErr[action.server] = (e && e.code) || 'upstream_error'; toast(C.failureCopy(action, e || {}), true); renderConns(); }
    S.busy.run = false; renderTop();
  }
  async function escalate(item) {
    const esc = C.buildEscalation(item, S.prefs, Date.now());
    const existing = itemById(esc.id);
    if (existing) { S.open[esc.id] = true; renderAll(); focusCard(esc.id); toast('Already escalated: the note is in Needs you.'); return; }
    if (S.db) { // an older escalation can sit outside the 500 items shown; it must never be replaced and reopened
      try { const snap = await S.db.collection('items').doc(esc.id).get(); if (snap.exists) { toast('Already escalated earlier (' + esc.id + '); it is older than the items shown here.'); return; } }
      catch (e) { toast('Could not check for an earlier escalation: ' + ((e && e.code) || 'error'), true); return; }
    }
    await commit(esc);
    await commit(C.addLog(item, 'escalated', 'page', 'to ' + (S.prefs.escalateTo.name || 'the escalation contact') + ' (' + esc.id + ')', C.isoAt()));
    S.open[esc.id] = true; renderAll(); focusCard(esc.id);
    const who = S.prefs.escalateTo.name || 'the recipient';
    toast(S.prefs.escalateTo.slackId ? 'Escalation note drafted for ' + who + '. Review it, then Send on Slack.' : 'Escalation note drafted. Use Find person to pick ' + who + ' before sending' + (S.prefs.escalateToConfirmed ? '.' : ' (the contact is still an assumption: confirm it in Settings).'));
  }
  async function findPerson(item) {
    const action = C.buildAction('slack_find', item);
    setBusy(item.id, true);
    try {
      const res = await S.mcp.callTool(action.server, action.tool, action.input);
      S.connErr.Slack = '';
      const found = C.parseSlackList(res && res.payload, 'user');
      S.people = { itemId: item.id, list: found.list, raw: found.raw, query: action.input.natural_language_query };
      S.open[item.id] = true;
    } catch (e) { S.connErr.Slack = (e && e.code) || 'upstream_error'; toast(C.failureCopy(action, e || {}), true); }
    setBusy(item.id, false);
  }
  // The picker: parsed matches as buttons; when nothing parsed, the connector's raw answer (text only) and a field to
  // paste an id, so an unexpected answer shape never leaves the recipient unresolvable.
  function peoplePicker(item) {
    const P = S.people; const box = h('div', { class: 'people' });
    if (P.list.length) box.append(h('span', { class: 'muted small', text: 'Pick the right person for “' + P.query + '”:' }));
    else box.append(h('span', { class: 'muted small', text: 'No person could be read from Slack’s answer for “' + P.query + '”.' + (P.raw ? ' The answer, in case the id is in it:' : '') }), P.raw ? h('pre', { class: 'raw', text: P.raw }) : null);
    for (const u of P.list) box.append(h('button', { type: 'button', class: 'btn sm', onclick: () => pickPerson(item, u) }, u.name + (u.detail ? ' · ' + u.detail : ''), h('span', { class: 'id', text: u.id })));
    const idIn = h('input', { type: 'text', id: 'pick-' + item.id, placeholder: 'or paste a Slack user id (U…)', 'aria-label': 'Slack user id' });
    const useId = () => {
      const v = idIn.value.trim();
      if (!C.isSlackUserId(v)) { toast('That is not a Slack user id (U… or W…, with digits).', true); return; }
      pickPerson(item, { id: v, name: P.query || v, email: '' });
    };
    idIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); useId(); } });
    box.append(h('div', { class: 'find-row' }, idIn, h('button', { type: 'button', class: 'btn sm', onclick: useId }, 'Use this id')));
    box.append(h('button', { type: 'button', class: 'btn quiet sm', onclick: () => { S.people = null; renderAll(); } }, 'Close'));
    return box;
  }
  async function pickPerson(item, u) {
    const fresh = itemById(item.id) || item; const p = fresh.prepared || {}; const to = (Array.isArray(p.to) ? p.to : []).slice();
    const first = Object.assign({}, to[0] || {}, { name: u.name, slackId: u.id }); if (u.email && !first.email) first.email = u.email;
    to[0] = first; S.people = null;
    await commit(C.addLog(C.withPrepared(fresh, { to }, Date.now()), 'recipient resolved', 'page', u.name + ' (' + u.id + ')', C.isoAt()));
    toast('Recipient set: ' + u.name);
  }

  // ---------- Generate / Refine: only on a click, streamed, stoppable ----------
  async function runGenerate(item) {
    if (!S.sample || S.sampleHidden) return;
    const id = item.id; const fresh = itemById(id) || item;
    const g = S.gen[id] || {}; if (g.ctl) return;
    const instruction = (g.instruction || '').trim();
    const prompt = C.generatePrompt({ item: fresh, body: currentBody(fresh), instruction, prefs: S.prefs });
    const ctl = new AbortController(); // a new controller per call
    S.gen[id] = { ctl, instruction, status: 'Thinking…', error: false };
    renderAll();
    const show = (text) => { S.drafts[id] = text; S.dirty[id] = true; const t = $('body-' + id); if (t) t.value = text; };
    try {
      const res = await S.sample(prompt, { signal: ctl.signal, cache: false, onText: (u) => show(u.text) });
      let cur = C.withPrepared(itemById(id) || fresh, { body: res.text, generatedBy: 'page', generatedAt: C.isoAt() }, Date.now());
      cur = C.addLog(cur, 'generated', 'page', instruction || 'first draft', C.isoAt());
      S.gen[id] = { instruction: '', status: res.truncated ? 'Cut short. Ask for less at a time.' : 'Draft updated.', error: false };
      delete S.dirty[id]; delete S.drafts[id];
      await commit(cur);
    } catch (e) {
      const code = e && e.code;
      if (e && e.text) show(e.text);
      if (code === 'cancelled') S.gen[id] = { instruction, status: e && e.text ? 'Stopped. The partial text is in the box.' : '', error: false };
      else { const f = C.sampleFailureCopy(e || {}); if (f.hide) S.sampleHidden = true; S.gen[id] = { instruction, status: f.copy, error: true }; }
      renderAll();
    }
  }

  // ---------- sheets ----------
  function showSheet(o) {
    const ov = $('overlay'); ov.replaceChildren(); ov.hidden = false;
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
      h('div', { class: 'sheet-h' }, h('h2', { id: 'sheet-title', text: o.title }), o.hint ? h('span', { class: 'hint', text: o.hint }) : null),
      o.body, h('div', { class: 'sheet-f' }, o.buttons));
    ov.append(h('div', { class: 'scrim', onclick: (e) => { if (e.target === e.currentTarget) closeSheet(); } }, sheet));
    S.sheet = o;
    const first = sheet.querySelector('input, textarea, select, button'); if (first) first.focus();
  }
  function closeSheet() { const ov = $('overlay'); ov.replaceChildren(); ov.hidden = true; S.sheet = null; }
  const field = (label, input, help) => h('label', { class: 'field' }, h('span', null, label), input, help ? h('span', { class: 'help', text: help }) : null);
  // Find channel (Slack slack_search_channels, a read on a click): a name in, the matching ids out; a pick appends the id
  // to the channels field. Nothing is written until Save.
  function channelFinder(f) {
    const can = !!(S.mcp && S.tools && S.tools.Slack && S.tools.Slack.has('slack_search_channels'));
    const q = h('input', { type: 'text', id: 'pref-chanq', placeholder: can ? 'Channel name, e.g. revops' : 'Connect Slack to search channels from here', disabled: !can, 'aria-label': 'Channel name to search' });
    const out = h('div', { class: 'people' });
    let btn;
    const run = async () => {
      let action; try { action = C.buildAction('channel_find', null, { query: q.value }); } catch (e) { toast('Type a channel name first.', true); return; }
      btn.disabled = true; out.replaceChildren(h('span', { class: 'muted small', text: 'Searching…' }));
      try {
        const res = await S.mcp.callTool(action.server, action.tool, action.input);
        S.connErr.Slack = '';
        const found = C.parseSlackList(res && res.payload, 'channel');
        out.replaceChildren();
        if (!found.list.length) out.append(h('span', { class: 'muted small', text: 'No channel could be read from Slack’s answer.' + (found.raw ? ' The answer, in case the id is in it:' : '') }), found.raw ? h('pre', { class: 'raw', text: found.raw }) : null);
        for (const ch of found.list) {
          out.append(h('button', { type: 'button', class: 'btn sm', onclick: () => {
            const ids = f.wChannels.value.split(/[\s,]+/).filter(Boolean); if (ids.indexOf(ch.id) < 0) ids.push(ch.id);
            f.wChannels.value = ids.join(', '); toast('Added #' + ch.name + ' (' + ch.id + '). Save to keep it.');
          } }, '#' + ch.name + (ch.detail ? ' · ' + ch.detail : ''), h('span', { class: 'id', text: ch.id })));
        }
      } catch (e) { S.connErr.Slack = (e && e.code) || 'upstream_error'; out.replaceChildren(h('span', { class: 'muted small', text: C.failureCopy(action, e || {}) })); renderConns(); }
      btn.disabled = false;
    };
    btn = h('button', { type: 'button', class: 'btn sm', disabled: !can, onclick: run }, 'Find channel');
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (can) run(); } });
    return h('div', { class: 'field' }, h('span', null, 'Find a channel id'), h('div', { class: 'find-row' }, q, btn), out,
      h('span', { class: 'help', text: can ? 'Searches Slack by name (a read, nothing is posted); pick a result to add its id above.' : '' }));
  }
  function openSettings() {
    const p = S.prefs; const f = {};
    const txt = (key, val, attrs) => (f[key] = h('input', Object.assign({ type: 'text', id: 'pref-' + key, value: val || '' }, attrs || {})));
    const chk = (key, val, label) => h('label', null, (f[key] = h('input', { type: 'checkbox', id: 'pref-' + key, checked: !!val })), ' ' + label);
    const area = (key, val, attrs) => (f[key] = h('textarea', Object.assign({ id: 'pref-' + key, value: val || '' }, attrs || {})));
    const body = h('div', { class: 'sheet-b' },
      S.prefsExists ? null : h('p', { class: 'note warn', text: 'Settings have not been saved yet; these are the defaults.' }),
      h('div', { class: 'row-2' },
        field(['Escalate to', p.escalateToConfirmed ? null : h('span', { class: 'chip assumed', text: 'assumed, confirm' })], txt('escName', p.escalateTo.name), 'Who gets escalation notes.'),
        field('Their Slack id', txt('escId', p.escalateTo.slackId, { placeholder: 'U… (Find person on an escalation fills it in)' }))),
      h('div', { class: 'checks' }, chk('escConfirmed', p.escalateToConfirmed, 'I have confirmed this is the right person')),
      h('div', { class: 'row-2' },
        field('Quiet hours start', (f.qStart = h('input', { type: 'time', id: 'pref-qStart', value: p.quietHours.start || '18:00' }))),
        field('Quiet hours end', (f.qEnd = h('input', { type: 'time', id: 'pref-qEnd', value: p.quietHours.end || '07:00' })), 'Stockholm time.')),
      field('Sources the worker scans', h('div', { class: 'checks' }, chk('sGranola', p.sources.granola, 'Granola'), chk('sGmail', p.sources.gmail, 'Gmail'), chk('sSlack', p.sources.slack, 'Slack'), chk('sCalendar', p.sources.calendar, 'Calendar'))),
      field('Slack watch', h('div', { class: 'checks' }, chk('wMentions', p.slackWatch.mentions, 'Mentions'), chk('wDms', p.slackWatch.dms, 'DMs'))),
      field('Extra Slack channels to scan', txt('wChannels', (p.slackWatch.channels || []).join(', '), { placeholder: 'C…, C…' }), 'Channel ids, comma-separated.'),
      channelFinder(f),
      field('Key people', area('keyPeople', C.formatKeyPeople(p.keyPeople), { placeholder: 'Name | Slack id | email' }), 'One per line; their asks are high severity.'),
      field('Internal domains', txt('domains', (p.internalDomains || []).join(', '))),
      field('Voice', area('voice', p.voice), 'How Claude drafts for you.'),
      h('div', { class: 'row-2' },
        field('Intake task id', txt('triggerId', p.triggerId, { placeholder: 'trig_…' }), 'Run now fires this scheduled task.'),
        field('Hub URL', txt('hubUrl', p.hubUrl, { placeholder: 'https://claude.ai/artifact/…' }), 'Written into the OS summary by the worker.')),
      field('EMEA RevOps OS URL', txt('osUrl', p.osUrl)));
    let saving = false;
    const saveBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => save() }, 'Save');
    const save = async () => {
      if (saving) return; // one write at a time to settings/prefs: a double click must not issue two
      // the two URLs become links (here and in the OS), so only https://claude.ai/ links are accepted
      const osUrl = f.osUrl.value.trim(), hubUrl = f.hubUrl.value.trim();
      if (osUrl && !C.isClaudeUrl(osUrl)) { toast('The OS URL must be an https://claude.ai/ link.', true); f.osUrl.focus(); return; }
      if (hubUrl && !C.isClaudeUrl(hubUrl)) { toast('The Hub URL must be an https://claude.ai/ link.', true); f.hubUrl.focus(); return; }
      const next = C.mergePrefs(Object.assign({}, p, {
        escalateTo: { name: f.escName.value.trim(), slackId: f.escId.value.trim() }, escalateToConfirmed: f.escConfirmed.checked,
        quietHours: { start: f.qStart.value || '18:00', end: f.qEnd.value || '07:00', tz: C.TZ },
        sources: { granola: f.sGranola.checked, gmail: f.sGmail.checked, slack: f.sSlack.checked, calendar: f.sCalendar.checked },
        slackWatch: { mentions: f.wMentions.checked, dms: f.wDms.checked, channels: f.wChannels.value.split(/[\s,]+/).filter(Boolean) },
        keyPeople: C.parseKeyPeople(f.keyPeople.value), internalDomains: f.domains.value.split(/[\s,]+/).filter(Boolean),
        voice: f.voice.value.trim() || C.DEFAULT_PREFS.voice, triggerId: f.triggerId.value.trim(), hubUrl, osUrl: osUrl || C.DEFAULT_PREFS.osUrl,
      }));
      if (!S.db) { toast('Settings cannot be saved: the database is not available in this view.', true); return; }
      saving = true; saveBtn.disabled = true;
      try { await S.db.doc('settings/prefs').set(Object.assign(next, { updatedAt: C.isoAt() })); S.prefs = next; S.prefsExists = true; closeSheet(); toast('Settings saved.'); renderAll(); }
      catch (e) { toast('Could not save settings: ' + ((e && e.code) || 'error'), true); }
      saving = false; saveBtn.disabled = false;
    };
    showSheet({ title: 'Settings', hint: 'settings/prefs · read by the worker', body, buttons: [
      h('button', { type: 'button', class: 'btn', onclick: closeSheet }, 'Cancel'),
      saveBtn,
    ] });
  }
  function openNewItem() {
    const title = h('input', { type: 'text', id: 'new-title', placeholder: 'What is it?', maxlength: '90' });
    const kind = h('select', { id: 'new-kind' }, C.KINDS.filter((k) => k !== 'insight' && k !== 'escalation').map((k) => h('option', { value: k, text: C.KIND_LABEL[k] })));
    const note = h('textarea', { id: 'new-note', placeholder: 'Optional. A note, a draft or a link; it becomes the item’s draft, so you can refine or file it.' });
    const create = async () => {
      if (!title.value.trim()) { title.focus(); return; }
      const it = C.newManualItem({ title: title.value, kind: kind.value, note: note.value }, Date.now());
      closeSheet();
      await commit(it);
      S.open[it.id] = true; renderAll(); focusCard(it.id);
      toast(S.db ? 'Added to Needs you.' : 'Added for this visit only: the database is not available in this view.');
    };
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
    showSheet({ title: 'New item', hint: 'Something you want the Hub to hold', body: h('div', { class: 'sheet-b' }, field('Title', title), field('Kind', kind), field('Note', note)), buttons: [
      h('button', { type: 'button', class: 'btn', onclick: closeSheet }, 'Cancel'),
      h('button', { type: 'button', class: 'btn primary', onclick: create }, 'Add'),
    ] });
  }
  function toast(text, bad, link) {
    const box = $('toasts');
    const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, h('span', { text: text }), link ? h('a', { href: link, target: '_blank', rel: 'noopener noreferrer', text: 'Open' }) : null);
    box.append(t); setTimeout(() => t.remove(), bad ? 9000 : 6000);
  }
  function wireTop() {
    $('btn-run').addEventListener('click', () => { try { openConfirm(null, C.buildAction('run_now', null, { prefs: S.prefs })); } catch (e) { toast(actionError(e), true); } });
    $('btn-new').addEventListener('click', openNewItem);
    $('btn-settings').addEventListener('click', openSettings);
    $('btn-refresh-triggers').addEventListener('click', () => loadTriggers(true));
    $('btn-done-toggle').addEventListener('click', () => { S.ui.doneOpen = !S.ui.doneOpen; renderDone(); saveUi(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sheet) closeSheet(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { S.now = Date.now(); subscribeBrief(); renderAll(true); } });
    // a passive render that waited for a draft being typed runs shortly after the blur (late enough for a click on the same card to land first)
    document.addEventListener('focusout', (e) => { if (S.renderPending && e.target && /^(body|gen|pick)-/.test(e.target.id || '')) setTimeout(() => { if (S.renderPending && !editing()) renderAll(); }, 300); });
    // after the capability window has passed, say plainly what is missing instead of "checking"
    setTimeout(() => { S.capsDone = true; renderNeeds(); renderConns(); }, 12000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}());
