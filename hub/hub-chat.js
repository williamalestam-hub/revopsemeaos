// RevOps Hub — the chat panel. Claude runs in this page (sample) with page functions as tools: the Hub's own items and
// brief, and read-only calls to the viewer's connectors (Salesforce, Calendar, Granola, Slack, Gmail). Nothing is sent from
// here: a message, email, doc or page the chat writes becomes an item in Needs you, and the confirm sheet sends it.
// History is kept per viewer at data/users/<id>/chat (private to them). sample is only ever called from Send.
(function () {
  'use strict';
  const C = window.HubCore;
  const $ = (id) => document.getElementById(id);
  const B = () => window.HubBridge || null; // the read-only view of hub-ui.js's state, set at its boot
  const MAX_TURNS = 30;   // kept in history
  const SEND_TURNS = 16;  // sent with each question
  const CH = { open: false, turns: [], ctl: null, sample: null, hidden: false, loaded: false, saving: Promise.resolve(), status: '', pendingDrafts: [] };

  function h(tag, attrs) {
    const el = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v; else if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c != null && c !== false) el.append(c); }
    return el;
  }
  const SUGGEST = ['What needs me first today?', 'Prep me for my next meeting', 'EMEA new-business pipeline created this month, by team', 'What did I promise in meetings this week?'];

  // ---------- history ----------
  async function loadHistory() {
    const b = B(); if (CH.loaded || !b || !b.db() || !b.uid()) return;
    CH.loaded = true;
    try {
      const snap = await b.db().doc('data/users/' + b.uid() + '/chat').get();
      const d = snap.exists ? snap.data() : null;
      if (d && Array.isArray(d.turns) && !CH.turns.length) { CH.turns = d.turns.filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string').slice(-MAX_TURNS); render(); }
    } catch (e) { /* history is a convenience */ }
  }
  function saveHistory() {
    const b = B(); if (!b || !b.db() || !b.uid()) return;
    const turns = CH.turns.slice(-MAX_TURNS).map((t) => ({ role: t.role, content: String(t.content).slice(0, 20000), at: t.at || C.isoAt(), drafts: t.drafts || [] }));
    const write = () => b.db().doc('data/users/' + b.uid() + '/chat').set({ turns, updatedAt: C.isoAt() });
    CH.saving = CH.saving.then(write, write).catch(() => { /* one write at a time; a failure only loses history */ });
  }

  // ---------- tools ----------
  function hubTools(onProgress) {
    const b = B();
    const tools = [
      { name: 'hub_items', description: "List items in William's Hub (asks, tasks, meeting preps, insights). Optional filters: status (new, prepared, waiting, done, dismissed, snoozed, stale), kind (task, ask, meeting, insight, decision, escalation, build), text.",
        inputSchema: { type: 'object', properties: { status: { type: 'string' }, kind: { type: 'string' }, text: { type: 'string' } } },
        execute: (a) => C.chatFindItems(b ? b.items() : [], a) },
      { name: 'hub_item', description: 'Read one Hub item in full, including its prepared draft or meeting brief.',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        execute: (a) => { const it = (b ? b.items() : []).find((x) => x.id === (a && a.id)); if (!it) throw new Error('No item with that id'); return C.chatClip({ item: C.chatItemLine(it), why: it.why, draft: it.prepared ? { type: it.prepared.type, to: (it.prepared.to || []).map((t) => t.name), body: it.prepared.body } : null }); } },
      { name: 'todays_brief', description: "Today's brief written by the Hub's worker: headline, Markdown body, suggested moves and the meeting list.",
        inputSchema: { type: 'object', properties: {} },
        execute: () => { const br = b ? b.brief() : null; return br ? C.chatClip({ headline: br.headline, markdown: br.markdown, moves: br.moves, meetings: (br.meetings || []).map((m) => ({ title: m.title, at: m.at, internal: m.internal, itemId: m.itemId })) }) : 'No brief has been written today yet.'; } },
      { name: 'draft_for_review', description: 'Put a ready-to-send draft into Needs you for William to review and send himself (nothing is sent). type: slack (to needs a slackId, or give channelId), email (to needs an email; add subject), doc, notion, note, plan. Write the complete text, no placeholders.',
        inputSchema: { type: 'object', properties: { type: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, subject: { type: 'string' }, channelId: { type: 'string' },
          to: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, slackId: { type: 'string' }, email: { type: 'string' } } } } }, required: ['type', 'title', 'body'] },
        execute: async (a) => {
          if (!b) throw new Error('The Hub is not ready');
          const item = C.chatDraftItem(a, Date.now());
          onProgress('Adding a draft to Needs you');
          await b.addItem(item);
          CH.pendingDrafts.push({ id: item.id, title: item.title, type: item.prepared.type });
          return { added: item.id, note: 'It is in Needs you; William reviews and sends it there.' };
        } },
    ];
    const mcp = b && b.mcp(); const sets = (b && b.tools()) || {};
    for (const r of C.CHAT_READS) {
      if (!mcp || !sets[r.server] || !sets[r.server].has(r.tool)) continue;
      tools.push({ name: r.name, description: r.description, inputSchema: r.schema, execute: async (a) => {
        const input = r.input(a || {}); // throws a readable {code, message} on bad input
        onProgress(r.progress);
        try { const res = await mcp.callTool(r.server, r.tool, input); return C.chatClip(res && (res.payload != null ? res.payload : res.content)); }
        catch (e) { return { error: (e && e.code) || 'error', message: String((e && e.message) || '').slice(0, 300) }; }
      } });
    }
    return tools;
  }
  function unavailable() {
    const b = B(); const sets = (b && b.tools()) || {}; const out = [];
    for (const r of C.CHAT_READS) if (!(b && b.mcp() && sets[r.server] && sets[r.server].has(r.tool)) && out.indexOf(r.server) < 0) out.push(r.server);
    return out;
  }

  // ---------- send ----------
  async function send(text) {
    const q = String(text || '').trim();
    if (!q || CH.ctl || CH.hidden) return;
    if (!CH.sample) { CH.status = 'Chat needs Claude in this view. Open the Hub on claude.ai.'; render(); return; }
    const b = B();
    CH.turns.push({ role: 'user', content: q, at: C.isoAt() });
    const reply = { role: 'assistant', content: '', at: C.isoAt(), drafts: [], live: true, progress: 'Thinking…' };
    CH.turns.push(reply); CH.pendingDrafts = [];
    $('chat-input').value = '';
    const ctl = new AbortController(); CH.ctl = ctl; CH.status = ''; render();
    const intro = C.chatInstructions({ prefs: b ? b.prefs() : null, items: b ? b.items() : [], brief: b ? b.brief() : null, nowMs: Date.now(), unavailable: unavailable() });
    const history = CH.turns.slice(0, -1).filter((t) => t.content).slice(-SEND_TURNS).map((t) => ({ role: t.role, content: String(t.content).slice(0, 8000) }));
    while (history.length && history[0].role !== 'user') history.shift();
    const input = [{ role: 'user', content: intro }].concat(history);
    let raf = 0;
    const paint = () => { raf = 0; const el = document.querySelector('.msg.live .md'); if (el) el.innerHTML = C.renderMarkdown(reply.content || '', {}); const pr = document.querySelector('.msg.live .progress'); if (pr) { pr.textContent = reply.progress || ''; pr.hidden = !reply.progress; } scrollDown(); };
    const onProgress = (t) => { reply.progress = t + '…'; if (!raf) raf = requestAnimationFrame(paint); };
    try {
      const res = await CH.sample(input, { signal: ctl.signal, cache: false, modelTier: 'default', tools: hubTools(onProgress),
        onText: (u) => { reply.content = u.text; reply.progress = ''; if (!raf) raf = requestAnimationFrame(paint); } });
      reply.content = res.text || reply.content;
      if (res.truncated) CH.status = 'The answer was cut short. Ask for less at a time.';
    } catch (e) {
      const code = e && e.code;
      if (e && e.text) reply.content = e.text;
      if (code === 'cancelled') CH.status = 'Stopped.';
      else { const f = C.sampleFailureCopy(e || {}); if (f.hide) CH.hidden = true; CH.status = f.copy; }
    } finally {
      reply.live = false; reply.progress = ''; reply.drafts = (CH.pendingDrafts || []).slice(); CH.ctl = null;
      if (!reply.content && !reply.drafts.length) CH.turns.pop(); // nothing came back: keep the question, drop the empty bubble
      render(); saveHistory();
    }
  }

  // ---------- render ----------
  function scrollDown() { const log = $('chat-log'); if (log) log.scrollTop = log.scrollHeight; }
  function render() {
    const panel = $('chat'); if (!panel) return;
    panel.hidden = !CH.open; $('btn-chat').setAttribute('aria-expanded', CH.open ? 'true' : 'false');
    if (!CH.open) return;
    const log = $('chat-log'); log.replaceChildren();
    if (!CH.turns.length) {
      log.append(h('div', { class: 'chat-empty' },
        h('p', { text: 'Ask anything about your day, pipeline, meetings or inbox. The chat reads Salesforce, your calendar, Granola, Slack and Gmail as you, and anything it writes for others lands in Needs you for your review.' }),
        h('div', { class: 'chips' }, ...SUGGEST.map((s) => h('button', { class: 'chip-btn', type: 'button', text: s, onclick: () => send(s) })))));
    }
    for (const t of CH.turns) {
      const m = h('div', { class: 'msg ' + t.role + (t.live ? ' live' : '') });
      if (t.role === 'user') m.append(h('div', { class: 'bubble', text: t.content }));
      else {
        const md = h('div', { class: 'bubble md' }); md.innerHTML = C.renderMarkdown(t.content || '', {});
        m.append(h('div', { class: 'progress', text: t.progress || '', hidden: !t.progress }), md);
        for (const d of t.drafts || []) {
          m.append(h('button', { class: 'draft-chip', type: 'button', onclick: () => { const b = B(); if (b) { if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches) toggle(false); b.focus(d.id); } } },
            h('span', { class: 'muted small', text: 'Draft in Needs you · ' + d.type }), h('span', { text: d.title }), h('span', { class: 'go', text: 'Review' })));
        }
      }
      log.append(m);
    }
    const busy = !!CH.ctl;
    $('chat-send').hidden = busy; $('chat-stop').hidden = !busy;
    $('chat-send').disabled = CH.hidden; $('chat-input').disabled = CH.hidden;
    const st = $('chat-status'); st.textContent = CH.hidden ? 'Chat is switched off for this view.' : (CH.status || (CH.sample ? '' : 'Waiting for Claude in this view…')); st.hidden = !st.textContent;
    scrollDown();
  }
  function toggle(on) {
    CH.open = on == null ? !CH.open : !!on;
    render();
    if (CH.open) { loadHistory(); const i = $('chat-input'); if (i && !i.disabled) i.focus(); }
  }

  function boot() {
    $('btn-chat').addEventListener('click', () => toggle());
    $('chat-close').addEventListener('click', () => toggle(false));
    $('chat-new').addEventListener('click', () => { if (CH.ctl) return; CH.turns = []; CH.status = ''; render(); saveHistory(); });
    $('chat-stop').addEventListener('click', () => { if (CH.ctl) CH.ctl.abort(); });
    $('chat-form').addEventListener('submit', (e) => { e.preventDefault(); send($('chat-input').value); });
    $('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(e.target.value); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && CH.open && !document.querySelector('#overlay:not([hidden])')) toggle(false); });
    const c = window.claude;
    if (c && typeof c.use === 'function') {
      Promise.resolve(c.use('sample')).catch(() => null).then((s) => { CH.sample = s; if (!s) CH.hidden = true; render(); });
      Promise.resolve(c.use('user')).catch(() => null).then(() => { if (CH.open) loadHistory(); });
    } else { CH.hidden = true; }
    if (/(^|[#&])chat\b/.test(location.hash || '')) toggle(true); // the OS's Chat button links here with #chat
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}());
