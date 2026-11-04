// EMEA RevOps OS — loaders, shared helpers and the app shell (navigation, views, person panel, copy).
// Fixed text lives in index.html. Outside drawings this file only listens and sets
// hidden / aria-* / class / style / value / checked / disabled, and defines helpers the drawings use.

// ---------- Calc inputs ----------
// Kept so state() can tell a calc that failed because a connector isn't connected (show "Connect …") from a real error.
const CALC_IN = {};
try {
  const calc0 = dash.calc.bind(dash);
  dash.calc = (id, o) => { CALC_IN[id] = (o && Array.isArray(o.inputs)) ? o.inputs.slice() : []; return calc0(id, o); };
} catch (e) { /* a read-only dash: states fall back to the calc's own status */ }

// ---------- Loaders ----------
// Salesforce answers {totalSize, done, records:[{attributes, ...}]} become rows. An answer that fills the query's
// LIMIT is marked cut: Salesforce reports done for a capped result, so rows past the LIMIT would go missing silently.
const limitOf = (args) => +((String((args && args.q) || '').match(/\bLIMIT\s+(\d+)\s*$/i) || [])[1] || 0);
const sfRows = ({ answer, args }, capped = true) => {
  let a = answer;
  if (Array.isArray(a) && a.length && a[0] && a[0].type === 'text') a = a.map((c) => c.text).join('');
  if (typeof a === 'string') {
    try { a = JSON.parse(a); } catch (e) { throw new Error(a.slice(0, 400)); }
  }
  if (!a || !Array.isArray(a.records)) {
    const first = Array.isArray(a) ? a[0] : a;
    const msg = (first && (first.message || first.error || first.errorCode)) || 'Salesforce answer had no records list';
    throw new Error(String(msg));
  }
  const rows = a.records.map((r) => {
    const o = {};
    for (const k of Object.keys(r)) if (k !== 'attributes') o[k] = r[k];
    return o;
  });
  const lim = capped ? limitOf(args) : 0;
  return { columns: rows.length ? Object.keys(rows[0]) : [], rows, cut: a.done === false || (lim > 0 && rows.length >= lim) };
};
['pipe_stage', 'pipe_rep', 'pipe_pastdue', 'pipe_stale', 'won_q', 'renew_stake',
  'cr_daily', 'cr_monthly', 'cr_source', 'cr_owner_q', 'cr_bdr',
  'rr_members', 'rr_assign', 'roster',
  'bk_owner', 'bk_pipe', 'bk_em', 'bk_terr', 'bk_orphans', 'bk_books', 'deals', 'pipe_slips', 'pipe_edits', 'pipe_early', 'pipe_nocontact', 'closed_rep', 'cr_owner_m', 'pipe_nextstep',
  'users_all', 'mv_outcomes', 'mv_created', 'mv_close', 'age_stuck', 'cycle_team', 'coverage_base', 'bk_stale', 'bk_em_cover', 'lv_opps', 'lv_leads',
  'ld_ready', 'ld_handoffs', 'ld_inflow', 'ld_open', 'act_mail', 'act_mail_prev', 'act_meet', 'act_meet_prev',
].forEach((id) => dash.loader(id, { description: 'Salesforce records as rows (the attributes key dropped); marked cut when the answer fills the query\'s LIMIT', fn: (x) => sfRows(x) }));
// the largest deals and renewals: the LIMIT is the point of the query, not a cut
['top_deals', 'top_renewals'].forEach((id) => dash.loader(id, { description: 'Salesforce records as rows (the attributes key dropped); the 300 largest by design', fn: (x) => sfRows(x, false) }));

dash.loader('hb_people', {
  description: 'HiBob employees as rows, with the slash-named fields given plain column names',
  fn: ({ answer }) => {
    let a = answer;
    if (Array.isArray(a) && a.length && a[0] && a[0].type === 'text') a = a.map((c) => c.text).join('');
    if (typeof a === 'string') {
      try { a = JSON.parse(a); } catch (e) { throw new Error(a.slice(0, 400)); }
    }
    if (!a || !Array.isArray(a.employees)) throw new Error((a && (a.message || a.error)) || 'HiBob answer had no employees list');
    const g = (e, k) => (e[k] !== undefined ? e[k] : e['/' + k]);
    const rows = a.employees.map((e) => ({
      id: String(g(e, 'id') ?? g(e, 'root/id') ?? ''),
      name: g(e, 'displayName') ?? g(e, 'root/displayName') ?? '',
      email: String(g(e, 'email') ?? g(e, 'root/email') ?? '').trim().toLowerCase() || null,
      title: g(e, 'work/title') ?? null,
      department: g(e, 'work/department') ?? null,
      team: g(e, 'work/custom/field_1775721273768') ?? null,
      site: g(e, 'work/site') ?? null,
      manager: g(e, 'work/reportsTo') ?? null,
      secondManager: g(e, 'work/secondLevelManager') ?? null,
      startDate: g(e, 'work/startDate') ?? null,
    }));
    return { columns: ['id', 'name', 'email', 'title', 'department', 'team', 'site', 'manager', 'secondManager', 'startDate'], rows };
  },
});

// Field history comes back as API-named rows with the opportunity nested; this unwraps them.
dash.loader('mv_fields', {
  description: 'Field history as rows: the opportunity, its owner id and current ARR (unwrapped from the nested opportunity), the field, old and new value, and when',
  fn: ({ answer, args }) => {
    let a = answer;
    if (Array.isArray(a) && a.length && a[0] && a[0].type === 'text') a = a.map((c) => c.text).join('');
    if (typeof a === 'string') {
      try { a = JSON.parse(a); } catch (e) { throw new Error(a.slice(0, 400)); }
    }
    if (!a || !Array.isArray(a.records)) {
      const first = Array.isArray(a) ? a[0] : a;
      throw new Error(String((first && (first.message || first.error || first.errorCode)) || 'Salesforce answer had no records list'));
    }
    const rows = a.records.map((r) => ({
      oppId: r.OpportunityId || null,
      ownerId: r.Opportunity ? r.Opportunity.OwnerId || null : null,
      arrUsd: r.Opportunity && r.Opportunity.Finance_ARR_USD__c != null ? +r.Opportunity.Finance_ARR_USD__c : null,
      field: r.Field || null,
      oldValue: r.OldValue == null ? null : String(r.OldValue),
      newValue: r.NewValue == null ? null : String(r.NewValue),
      at: r.CreatedDate || null,
    }));
    const lim = limitOf(args);
    return { columns: ['oppId', 'ownerId', 'arrUsd', 'field', 'oldValue', 'newValue', 'at'], rows, cut: a.done === false || (lim > 0 && rows.length >= lim) };
  },
});

// Google Calendar: list_events answers a page of events with nextPageToken; up to four pages are read.
dash.loader('cal_events', {
  description: 'Calendar events as rows (following next pages, up to four): start, end, title, whether you organise it, whether it repeats, the calendar owner, and every invitee unwrapped as email, self, room, response, optional and display name',
  fn: async ({ answer, call, args }) => {
    const parse = (a) => {
      if (Array.isArray(a) && a.length && a[0] && a[0].type === 'text') a = a.map((c) => c.text).join('');
      if (typeof a === 'string') {
        try { a = JSON.parse(a); } catch (e) { throw new Error(a.slice(0, 400)); }
      }
      if (!a || !Array.isArray(a.events)) throw new Error(String((a && (a.message || (a.error && (a.error.message || a.error)))) || 'Google Calendar answer had no events list'));
      return a;
    };
    const columns = ['id', 'start', 'end', 'allDay', 'title', 'status', 'organizerSelf', 'recurring', 'link', 'calendar', 'attendees'];
    const rows = [];
    let page = parse(answer);
    let cut = false;
    for (let n = 0; ; n++) {
      for (const e of page.events) {
        const att = Array.isArray(e.attendees) ? e.attendees : [];
        rows.push({
          id: String(e.id || ''),
          start: (e.start && (e.start.dateTime || e.start.date)) || null,
          end: (e.end && (e.end.dateTime || e.end.date)) || null,
          allDay: !!(e.start && e.start.date && !e.start.dateTime),
          title: e.summary || '',
          status: e.status || null,
          organizerSelf: !!(e.organizer && e.organizer.self),
          recurring: !!e.recurringEventId,
          link: e.htmlLink || null,
          calendar: String(page.summary || '').toLowerCase() || null,
          // each invitee as email|self|room|response|optional|name, separated by ';'
          attendees: att.filter((x) => x && x.email).map((x) => [String(x.email).toLowerCase(), x.self ? 'self' : '', x.resource ? 'room' : '', x.responseStatus || '', x.optionalAttendee ? 'optional' : '', String(x.displayName || '').replace(/[|;]/g, ' ')].join('|')).join(';'),
        });
      }
      if (!page.nextPageToken) break;
      if (n >= 3) { cut = true; break; }
      try { page = parse(await call('list_events', { ...args, pageToken: page.nextPageToken })); } catch (e) { cut = true; break; }
    }
    return { columns, rows, cut };
  },
});

// Salesforce getUserInfo answers {identity, manager: {identity}, userTimeAndLocale}; it becomes one row.
dash.loader('sf_me', {
  description: 'Your Salesforce identity as one row: user id, name, email, role, title, manager and time zone',
  fn: ({ answer }) => {
    let a = answer;
    if (Array.isArray(a) && a.length && a[0] && a[0].type === 'text') a = a.map((c) => c.text).join('');
    if (typeof a === 'string') {
      try { a = JSON.parse(a); } catch (e) { throw new Error(a.slice(0, 400)); }
    }
    const id = a && a.identity;
    if (!id || !id.userId) throw new Error(String((a && (a.message || a.error)) || 'Salesforce answer had no identity'));
    const mg = (a.manager && a.manager.identity) || {};
    return {
      columns: ['userId', 'name', 'email', 'role', 'title', 'manager', 'managerEmail', 'timeZone'],
      rows: [{
        userId: id.userId,
        name: id.displayName || [id.firstName, id.lastName].filter(Boolean).join(' '),
        email: String(id.email || '').toLowerCase() || null,
        role: id.roleName || null,
        title: id.title || null,
        manager: mg.displayName || null,
        managerEmail: String(mg.email || '').toLowerCase() || null,
        timeZone: (a.userTimeAndLocale && a.userTimeAndLocale.timeZoneIana) || null,
      }],
    };
  },
});

// Granola: list_meetings gives the meetings in the window (following next pages); get_meetings, ten at a time,
// gives each note. Every non-empty, non-heading line of a summary or private notes becomes a row, with the headings
// above it, its indent and whether a blank line came before. The rules for what counts as an action item are in gr_actions.
dash.loader('gr_notes', {
  description: 'Your Granola meetings in the window, then each note read ten at a time; every non-empty line of the summary and private notes becomes a row with the headings above it, its indent and whether a blank line came before. Each row also carries the meeting\'s attendee emails (up to four) and your Granola email and name.',
  fn: async ({ answer, call, args }) => {
    const txt = (a) => (typeof a === 'string' ? a
      : Array.isArray(a) ? a.map((c) => (c && typeof c.text === 'string' ? c.text : '')).join('')
      : a && typeof a.text === 'string' ? a.text : JSON.stringify(a ?? ''));
    const dec = (s) => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
    const attr = (s, k) => { const m = String(s).match(new RegExp('(?:^|\\s)' + k + '="([^"]*)"')); return m ? dec(m[1]) : null; };
    const columns = ['id', 'meetingId', 'meeting', 'meetingAt', 'url', 'capturedByMe', 'participants', 'emails', 'me', 'myName', 'source', 'section', 'parentSection', 'pos', 'kind', 'depth', 'gap', 'text'];
    let page = txt(answer);
    if (!/<meetings_data[\s>]/.test(page)) {
      if (/no meetings|count="0"/i.test(page)) return { columns, rows: [] };
      throw new Error(page.slice(0, 400) || 'Granola returned no meetings list');
    }
    const head0 = page.match(/<meetings_data\s([^>]*)>/);
    const me = String((head0 && attr(head0[1], 'connected_user_email')) || '').toLowerCase() || null;
    let myName = null;
    let cut = false;
    const meetings = new Map();
    for (let n = 0; ; n++) {
      if (!/<meetings_data[\s>]/.test(page)) { cut = true; break; }
      for (const block of page.split(/<meeting\s/).slice(1)) {
        const head = ' ' + block.slice(0, block.indexOf('>'));
        const id = attr(head, 'id');
        if (!id) continue;
        const kp = block.match(/<known_participants(\s[^>]*)?>([\s\S]*?)<\/known_participants>/);
        const total = kp && kp[1] ? attr(kp[1], 'total') : null;
        const emails = kp ? [...kp[2].matchAll(/\(([^()\s]+@[^()\s]+)\)/g)].map((m) => dec(m[1]).toLowerCase()) : [];
        const listed = kp ? kp[2].split(/,(?![^()]*\))/).map((t) => t.trim()).filter(Boolean).length : 0;
        meetings.set(id, { id, meeting: attr(head, 'title'), meetingAt: attr(head, 'meeting_at'), url: attr(head, 'url'), capturedByMe: attr(head, 'captured_by_me') === 'true', participants: total != null ? +total : listed || emails.length || null, emails: emails.join(', ') });
        if (!myName && me) {
          const end = block.indexOf('</meeting>');
          for (const m of block.slice(0, end < 0 ? block.length : end).matchAll(/([^\n<>()]+?)\s*\(note creator\)[^\n]*?\(([^()\s]+@[^()\s]+)\)/g)) {
            if (dec(m[2]).toLowerCase() === me) { myName = dec(m[1]).replace(/^[\s,]+/, '').trim(); break; }
          }
        }
      }
      const pg = page.match(/<pagination\s([^>]*)>/);
      const cursor = pg && attr(pg[1], 'has_more') === 'true' ? attr(pg[1], 'next_cursor') : null;
      if (!cursor) break;
      if (n >= 9) { cut = true; break; }
      try { page = txt(await call('list_meetings', { ...args, cursor })); } catch (e) { cut = true; break; }
    }
    const rows = [];
    const parse = (md, source, meta) => {
      const stack = [];
      let section = source === 'private' ? 'Private notes' : '';
      let parentSection = '';
      let pos = 0;
      let gap = false;
      for (const raw of String(md).split(/\r?\n/)) {
        const line = raw.replace(/\s+$/, '');
        if (!line.trim()) { gap = true; continue; }
        const indent = line.match(/^ */)[0].length;
        let h = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
        if (!h && indent === 0) h = line.match(/^()\*\*([^*]{2,80})\*\*:?$/) || line.match(/^()(\p{Lu}[^.!?:]{1,40}):$/u);
        if (h) {
          const top = stack[stack.length - 1];
          const lv = h[1] ? h[1].length : top && top.lv >= 7 ? (top.has ? top.lv : top.lv + 1) : 7;
          const text = h[2].replace(/[*_`#]/g, '').replace(/:\s*$/, '').trim();
          while (stack.length && stack[stack.length - 1].lv >= lv) stack.pop();
          parentSection = stack.map((s) => s.text).join(' > ');
          stack.push({ lv, text, has: false });
          section = text;
          gap = false;
          continue;
        }
        const b = line.match(/^( *)(?:[-*+•]|\d+[.)])\s+(.*)$/);
        if (stack.length) stack[stack.length - 1].has = true;
        rows.push({ id: meta.id + ':' + source[0] + pos, meetingId: meta.id, meeting: meta.meeting, meetingAt: meta.meetingAt, url: meta.url, capturedByMe: meta.capturedByMe, participants: meta.participants ?? null, emails: meta.emails || '', me, myName, source, section, parentSection, pos, kind: b ? 'bullet' : 'text', depth: Math.min(3, Math.floor(indent / 2)), gap, text: (b ? b[2] : line).trim() });
        pos += 1;
        gap = false;
      }
    };
    const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
    const ids = [...meetings.keys()];
    let ok = 0;
    let lastError = '';
    for (let i = 0; i < ids.length; i += 10) {
      const q = { meeting_ids: ids.slice(i, i + 10), attachments: 'none', max_participants: 0 };
      let out = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        try { out = txt(await call('get_meetings', q)); } catch (e) { out = String((e && e.message) || e); }
        if (/<meetings_data[\s>]/.test(out)) break;
        const s = +((out.match(/retry_after_seconds\D{0,4}(\d+)/) || [])[1] || 0);
        if (attempt === 0 && s > 0 && s <= 20 && !/retryable\D{0,4}false/.test(out)) { await wait(s); continue; }
        break;
      }
      if (!/<meetings_data[\s>]/.test(out)) { cut = true; lastError = out; continue; }
      ok += 1;
      for (const block of out.split(/<meeting\s/).slice(1)) {
        const head = ' ' + block.slice(0, block.indexOf('>'));
        const id = attr(head, 'id');
        if (!id) continue;
        const meta = meetings.get(id) || { id, meeting: attr(head, 'title'), meetingAt: attr(head, 'meeting_at'), url: attr(head, 'url'), capturedByMe: null, participants: null, emails: '' };
        const sum = (block.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1];
        const priv = (block.match(/<private_notes(?:\s[^>]*)?>([\s\S]*?)<\/private_notes>/) || [])[1];
        if (sum) parse(dec(sum), 'summary', meta);
        if (priv) parse(dec(priv), 'private', meta);
      }
    }
    if (ids.length && !ok) throw new Error('Granola could not read your notes: ' + String(lastError).slice(0, 300));
    return { columns, rows, cut };
  },
});

// ---------- Helpers for drawings ----------
window.OS = (() => {
  const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  const usd = (v) => (v == null || Number.isNaN(+v) ? '—' : (v < 0 ? '−$' : '$') + compact.format(Math.abs(+v)));
  const num = (v) => (v == null || Number.isNaN(+v) ? '—' : d3.format(',')(Math.round(+v)));
  const pct = (v) => (v == null || Number.isNaN(+v) ? '—' : d3.format('.0%')(+v));
  const day = (v) => (v ? d3.utcFormat('%-d %b %Y')(new Date(String(v).slice(0, 10) + 'T00:00:00Z')) : '—');
  const shortDay = (v) => (v ? d3.utcFormat('%-d %b')(new Date(String(v).slice(0, 10) + 'T00:00:00Z')) : '—');
  const region = () => (dash.params().region || 'All');
  const sorts = {};
  const queries = {};
  const tables = {};
  const reg = {};

  // status of several sources: 'ok' | 'loading' | 'connect' | 'error'. A calc fails whenever an input fails, so a
  // failed calc is traced down to its datasets: one that needs connecting makes it 'connect', not 'error'.
  const needsConnect = (id, seen = new Set()) => {
    if (seen.has(id)) return false;
    seen.add(id);
    const ins = CALC_IN[id];
    if (!ins) { const st = dash.data(id).status; return st === 'connect' || st === 'declined'; }
    return ins.some((x) => needsConnect(x, seen));
  };
  // which connectors a set of sources is waiting for, traced through calcs: { names: [...], declined: bool }
  const CONNECTOR = (id) => (id === 'cal_events' ? 'Google Calendar' : id === 'hb_people' ? 'HiBob' : /^gr_/.test(id) ? 'Granola' : 'Salesforce');
  const connectInfo = (ids) => {
    const names = new Set(); let declined = true;
    const walk = (id, seen) => {
      if (seen.has(id)) return; seen.add(id);
      const ins = CALC_IN[id];
      if (ins) { ins.forEach((x) => walk(x, seen)); return; }
      const st = dash.data(id).status;
      if (st === 'connect' || st === 'declined') { names.add(CONNECTOR(id)); if (st === 'connect') declined = false; }
    };
    const seen = new Set();
    ids.forEach((id) => walk(id, seen));
    return { names: [...names], declined: names.size > 0 && declined };
  };
  const state = (...ids) => {
    let s = 'ok', failed = false;
    for (const id of ids) {
      const st = dash.data(id).status;
      if (st === 'connect' || st === 'declined') return 'connect';
      if (st === 'error' || st === 'missing') { if (CALC_IN[id] && needsConnect(id)) return 'connect'; failed = true; continue; }
      if (st !== 'ok') s = 'loading';
    }
    return failed ? 'error' : s;
  };

  // a single value element
  const value = (el, ids, text) => {
    const s = state(...ids);
    el.classList.toggle('dash-skeleton', s === 'loading');
    el.textContent = s === 'ok' ? text() : '—';
  };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const hue = (name) => { let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return dash.colors[h % dash.colors.length]; };
  const personBtn = (name, label) => {
    const b = el('button', 'lnk', label == null ? name : label);
    b.type = 'button';
    b.dataset.person = name;
    b.dataset.initials = initials(name);
    b.style.setProperty('--av', hue(name));
    return b;
  };
  const icon = (paths) => {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ic');
    s.setAttribute('aria-hidden', 'true');
    for (const d of paths) { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); s.appendChild(p); }
    return s;
  };
  const ICON = {
    copy: ['M9 9h11v11H9z', 'M5 15V6a2 2 0 0 1 2-2h9'],
    open: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
    go: ['m9 6 6 6-6 6'],
    check: ['m5.5 12.5 4 4 9-9.5'],
    agenda: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'],
    spark: ['M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z', 'M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'],
    mail: ['M4 6h16v12H4z', 'm4 7 8 6 8-6'],
    ext: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  };

  const searchFilter = (name, list, fields) => {
    const q = (queries[name] || '').trim().toLowerCase();
    return q ? list.filter((r) => fields.some((f) => String(r[f] ?? '').toLowerCase().includes(q))) : list;
  };

  // ----- tables: the tbody holds only data rows; messages go in the table's tfoot drawing -----
  // cols: [{f, fmt?, num?, bar?: (list)=>max, chip?: (v,row)=>cls (no chip when fmt gives ''), cls?, wrap?, person?: (row)=>name (none: plain text), tip?: (row)=>title, after?: (row)=>node}]
  const tableRows = (name) => {
    const t = tables[name];
    const s = state(...t.ids());
    if (s !== 'ok') return { s, list: [] };
    let list = searchFilter(name, t.rows(), t.cols.map((c) => c.f).concat(t.opts.also || []));
    const st = sorts[name];
    if (st) {
      list = list.slice().sort((a, b) => {
        const x = a[st.f], y = b[st.f];
        const bx = x == null || x === '', by = y == null || y === '';
        if (bx || by) return bx === by ? 0 : bx ? 1 : -1; // blanks last whichever way
        const r = (typeof x === 'number' || typeof y === 'number') ? (+x || 0) - (+y || 0) : String(x ?? '').localeCompare(String(y ?? ''));
        return st.dir === 'ascending' ? r : -r;
      });
    }
    return { s, list };
  };
  // ids: the sources (or a function returning them, for a table that falls back to another source)
  const defTable = (name, ids, rows, cols, opts = {}) => {
    const getIds = typeof ids === 'function' ? ids : () => ids;
    tables[name] = { ids: getIds, rows, cols, opts };
    reg[name] = { kind: 'table', ids: getIds, rows, fields: cols.map((c) => c.f).concat(opts.also || []), limit: opts.limit || 400, msg: opts.msg || null };
    dash.draw(name, (tbody) => {
      const { s, list } = tableRows(name);
      if (s !== 'ok' || !list.length) { tbody.replaceChildren(); return; }
      const max = opts.limit || 400;
      const maxes = cols.map((c) => (c.bar ? c.bar(list) : 0));
      const frag = document.createDocumentFragment();
      for (const r of list.slice(0, max)) {
        const tr = el('tr', r._cls || null);
        tr.dataset.key = r[opts.key];
        cols.forEach((c, i) => {
          const td = el('td', c.num ? 'num' : c.wrap ? 'wrap' : null);
          const v = r[c.f];
          const txt = c.fmt ? c.fmt(v, r) : (v == null || v === '' ? '—' : String(v));
          const pn = c.person && v && !/^\(/.test(String(v)) ? c.person(r) : null;
          if (pn) {
            td.appendChild(personBtn(pn, txt));
          } else if (c.chips) {
            String(v || '').split(', ').filter(Boolean).forEach((x, i) => { if (i) td.appendChild(el('span', 'chip-sep', ', ')); td.appendChild(el('span', 'chip ' + c.chips(x), x)); });
            if (!v) td.textContent = '—';
          } else if (c.chip) {
            if (txt !== '') td.appendChild(el('span', 'chip ' + c.chip(v, r), txt)); // a blank status (fmt gives '') shows no chip
          } else if (c.bar) {
            const wrap = el('div', 'os-bar-cell');
            const bar = el('i');
            bar.style.width = (maxes[i] > 0 ? Math.max(0, Math.min(1, (+v || 0) / maxes[i])) * 48 : 0) + 'px';
            bar.style.setProperty('--os-accent', dash.colors[0]);
            wrap.append(bar, el('span', null, txt));
            td.appendChild(wrap);
          } else {
            td.textContent = txt;
            if (c.cls) { const k = c.cls(v, r); if (k) td.classList.add(k); }
          }
          if (c.after) { const x = c.after(r); if (x) td.appendChild(x); }
          if (c.tip) { const tt = c.tip(r); if (tt) td.title = tt; }
          tr.appendChild(td);
        });
        frag.appendChild(tr);
      }
      tbody.replaceChildren(frag);
    });
  };
  // which fixed sentence (in the HTML, [data-msg-for]) a table, list or chart needs now
  const msgOf = (name) => {
    const r = reg[name];
    if (!r) return null;
    const s = state(...r.ids());
    if (s !== 'ok') return s;
    if (r.msg) return r.msg();
    const all = r.rows();
    if (!all.length) return 'empty';
    const vis = r.fields ? searchFilter(name, all, r.fields) : all;
    if (!vis.length) return 'nomatch';
    if (r.limit && vis.length > r.limit) return 'limit';
    return null;
  };
  const drawMsg = (slot) => {
    const name = slot.dataset.for;
    let k = msgOf(name);
    if (reg[name] && reg[name].kind === 'chart' && (k === 'loading' || k === 'error')) k = null;
    slot.className = 'msg-slot' + (k === 'loading' ? ' dash-skeleton' : k === 'error' ? ' os-fail' : '');
    slot.textContent = k === 'error' ? 'Failed to load' : '';
    // 'connect': the element's own sentence when it names a connector that is missing; otherwise say which one is
    let own = true;
    if (k === 'connect' && reg[name]) {
      const info = connectInfo(reg[name].ids());
      const paras = [...document.querySelectorAll('[data-msg-for]')].filter((p) => p.dataset.msgFor === name && p.dataset.msg === 'connect');
      own = !info.declined && info.names.length > 0 && paras.some((p) => info.names.some((n) => p.textContent.includes(n)));
      if (!own && info.names.length) slot.textContent = info.declined ? info.names.join(' and ') + (info.names.length > 1 ? ' are' : ' is') + ' turned off for this dashboard, so this can\'t load.' : 'Connect ' + info.names.join(' and ') + ' in your claude.ai connectors to see this.';
    }
    document.querySelectorAll('[data-msg-for]').forEach((p) => { if (p.dataset.msgFor === name) p.hidden = p.dataset.msg !== k || (k === 'connect' && !own); });
  };
  const redraw = (name) => { dash.draw(name); dash.draw('msg'); };
  const tableText = (name) => {
    const t = tables[name];
    if (!t) return '';
    const { s, list } = tableRows(name);
    if (s !== 'ok' || !list.length) return '';
    let heads = t.cols.map((c) => c.f);
    document.querySelectorAll('tbody[data-draw]').forEach((tb) => {
      if (tb.dataset.draw !== name) return;
      const tbl = tb.closest('table');
      const ths = tbl ? [...tbl.querySelectorAll('thead th')] : [];
      if (ths.length === t.cols.length) heads = ths.map((th) => th.textContent.trim());
    });
    const cell = (v) => (v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' '));
    const shown = (c, r) => (c.fmt ? c.fmt(r[c.f], r) : r[c.f] == null || r[c.f] === '' ? '' : r[c.f]);
    return [heads.join('\t')].concat(list.map((r) => t.cols.map((c) => cell(shown(c, r))).join('\t'))).join('\n');
  };

  // lists: the drawing holds only items; sentences come from the message slot beside it
  const defList = (name, ids, rows, render, opts = {}) => {
    reg[name] = { kind: 'list', ids: typeof ids === 'function' ? ids : () => ids, rows, fields: opts.fields || null, limit: 0, msg: opts.msg || null };
    dash.draw(name, (ul) => {
      if (msgOf(name) !== null && msgOf(name) !== 'limit') { ul.replaceChildren(); return; }
      const items = opts.fields ? searchFilter(name, rows(), opts.fields) : rows();
      ul.replaceChildren(...render(items));
    });
  };

  // tooltips are built while drawing; hover only shows, hides and places them
  const makeTip = (box, head, lines) => {
    const t = el('div', 'os-tip');
    t.hidden = true;
    t.appendChild(el('div', 'os-tip-h', head));
    for (const [color, label, val] of lines) {
      const row = el('div', 'os-tip-row');
      if (color) { const sw = el('i', 'os-sw'); sw.style.background = color; row.appendChild(sw); }
      row.appendChild(el('span', null, `${label}: ${val}`));
      t.appendChild(row);
    }
    box.appendChild(t);
    return t;
  };
  const showTip = (box, t, ev) => {
    t.hidden = false;
    const b = box.getBoundingClientRect();
    let x = ev.clientX - b.left + 12, y = ev.clientY - b.top + 12;
    const w = t.offsetWidth, hgt = t.offsetHeight;
    if (x + w > b.width) x = Math.max(0, ev.clientX - b.left - w - 12);
    if (y + hgt > b.height) y = Math.max(0, ev.clientY - b.top - hgt - 12);
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  };

  const textWidth = (svg, strings) => {
    const g = svg.append('g').attr('opacity', 0);
    let w = 0;
    for (const s of strings) {
      const t = g.append('text').attr('font-size', 'var(--cds-font-size-caption)').text(s);
      w = Math.max(w, t.node().getComputedTextLength());
    }
    g.remove();
    return w;
  };

  // vertical stacked bars: rows [{key, label, tip, ...keys}], keys [{k, name, color}]
  const vbars = (box, rows, keys, fmt, opts = {}) => {
    const W = Math.max(260, box.clientWidth || 600), H = opts.height || 240;
    d3.select(box).selectAll('svg, .os-tip').remove();
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const key = (r) => r.key ?? r.label;
    const totals = rows.map((r) => keys.reduce((s, k) => s + Math.max(0, +r[k.k] || 0), 0));
    const y = d3.scaleLinear([0, d3.max(totals) || 1], [H - 24, 8]).nice();
    const ticks = y.ticks(4);
    const lw = textWidth(svg, ticks.map(fmt)) + 8;
    const x = d3.scaleBand(rows.map(key), [lw, W - 4]).padding(0.25);
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('x1', lw).attr('x2', W - 4).attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', 'var(--cds-chart-grid)').attr('stroke-width', 1);
    svg.append('g').selectAll('text').data(ticks).join('text')
      .attr('x', lw - 6).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', 'var(--color-fg-muted)').attr('font-size', 'var(--cds-font-size-caption)').text(fmt);
    const labelW = textWidth(svg, rows.map((r) => r.label)) + 10;
    const every = Math.max(1, Math.ceil(labelW / Math.max(1, x.step())));
    svg.append('g').selectAll('text').data(rows).join('text')
      .attr('x', (d) => x(key(d)) + x.bandwidth() / 2).attr('y', H - 6).attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-fg-muted)').attr('font-size', 'var(--cds-font-size-caption)')
      .text((d, i) => ((rows.length - 1 - i) % every === 0 ? d.label : ''));
    const bw = Math.min(32, x.bandwidth());
    const g = svg.append('g');
    rows.forEach((r) => {
      let acc = 0;
      const gx = x(key(r)) + (x.bandwidth() - bw) / 2;
      keys.forEach((k) => {
        const v = Math.max(0, +r[k.k] || 0);
        if (!v) return;
        g.append('rect').attr('x', gx).attr('width', bw).attr('y', y(acc + v)).attr('height', Math.max(0, y(acc) - y(acc + v)))
          .attr('fill', k.color).attr('rx', 2);
        acc += v;
      });
      const tipEl = makeTip(box, r.tip || r.label, keys.map((k) => [k.color, k.name, fmt(+r[k.k] || 0)]));
      g.append('rect').attr('x', x(key(r))).attr('width', x.bandwidth()).attr('y', 0).attr('height', H - 24).attr('fill', 'transparent')
        .on('mousemove', (ev) => showTip(box, tipEl, ev))
        .on('mouseleave', () => { tipEl.hidden = true; });
    });
    svg.append('line').attr('x1', lw).attr('x2', W - 4).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--cds-chart-axis)');
  };

  // horizontal stacked bars: rows [{label, ...keys}]
  const hbars = (box, rows, keys, fmt) => {
    const W = Math.max(260, box.clientWidth || 600);
    const rowH = 26, top = 4, bottom = 22;
    const H = top + bottom + Math.max(1, rows.length) * rowH;
    d3.select(box).selectAll('svg, .os-tip').remove();
    box.style.minHeight = H + 'px';
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const lw = Math.min(W * 0.38, textWidth(svg, rows.map((r) => r.label)) + 10);
    const totals = rows.map((r) => keys.reduce((s, k) => s + Math.max(0, +r[k.k] || 0), 0));
    const endW = textWidth(svg, totals.map(fmt)) + 8;
    const x = d3.scaleLinear([0, d3.max(totals) || 1], [lw, W - endW]).nice();
    const y = d3.scaleBand(rows.map((r, i) => i), [top, H - bottom]).padding(0.25);
    const ticks = x.ticks(Math.max(2, Math.floor((W - lw) / 110)));
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', top).attr('y2', H - bottom)
      .attr('stroke', 'var(--cds-chart-grid)');
    svg.append('g').selectAll('text').data(ticks).join('text')
      .attr('x', (d) => x(d)).attr('y', H - 6).attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-fg-muted)').attr('font-size', 'var(--cds-font-size-caption)').text(fmt);
    const bh = Math.min(18, y.bandwidth());
    rows.forEach((r, i) => {
      const gy = y(i) + (y.bandwidth() - bh) / 2;
      const label = svg.append('text').attr('x', lw - 8).attr('y', gy + bh / 2).attr('dy', '0.32em').attr('text-anchor', 'end')
        .attr('fill', 'var(--color-fg)').attr('font-size', 'var(--cds-font-size-caption)').text(r.label);
      const node = label.node();
      let s = String(r.label);
      while (node.getComputedTextLength() > lw - 10 && s.length > 1) { s = s.slice(0, -1); node.textContent = s + '…'; }
      let acc = 0;
      keys.forEach((k) => {
        const v = Math.max(0, +r[k.k] || 0);
        if (!v) return;
        svg.append('rect').attr('x', x(acc)).attr('width', Math.max(0, x(acc + v) - x(acc))).attr('y', gy).attr('height', bh)
          .attr('fill', k.color).attr('rx', 2);
        acc += v;
      });
      svg.append('text').attr('x', x(acc) + 6).attr('y', gy + bh / 2).attr('dy', '0.32em')
        .attr('fill', 'var(--color-fg-muted)').attr('font-size', 'var(--cds-font-size-caption)').text(fmt(totals[i]));
      const tipEl = makeTip(box, r.label, keys.map((k) => [k.color, k.name, fmt(+r[k.k] || 0)]).concat([[null, 'Total', fmt(totals[i])]]));
      svg.append('rect').attr('x', 0).attr('width', W).attr('y', y(i)).attr('height', y.bandwidth()).attr('fill', 'transparent')
        .on('mousemove', (ev) => showTip(box, tipEl, ev))
        .on('mouseleave', () => { tipEl.hidden = true; });
    });
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', top).attr('y2', H - bottom).attr('stroke', 'var(--cds-chart-axis)');
  };

  // charts: draw(box, rows); an empty or unconnected chart leaves its box empty and the slot beside it speaks
  const defChart = (name, ids, rows, draw) => {
    const getIds = typeof ids === 'function' ? ids : () => ids;
    reg[name] = { kind: 'chart', ids: getIds, rows, fields: null, limit: 0 };
    dash.draw(name, (box) => {
      const s = state(...getIds());
      box.classList.toggle('dash-skeleton', s === 'loading');
      if (s === 'error') { box.style.minHeight = ''; box.replaceChildren(el('div', 'os-fail', 'Failed to load')); return; }
      box.querySelectorAll('.os-fail').forEach((n) => n.remove());
      const list = s === 'ok' ? rows() : [];
      if (!list.length) { d3.select(box).selectAll('svg, .os-tip').remove(); box.style.minHeight = s === 'ok' ? '0' : ''; return; }
      box.style.minHeight = '';
      draw(box, list);
    });
  };

  return { usd, num, pct, day, shortDay, region, sorts, queries, state, value, el, personBtn, initials, hue, icon, ICON, defTable, defList, defChart, drawMsg, redraw, tableText, vbars, hbars, searchFilter };
})();

// ---------- Acting on things ----------
// "Ask Claude" hands a request to the viewer's own Claude beside this page (room.sendToClaudeSession, from their
// click; the platform asks them to confirm). The page itself never writes to Salesforce, LeanData, mail or calendars.
OS.ask = (() => {
  let room = null, mode = 'off';
  const DRAWS = ['act-list', 'home-actions', 'check-list', 'home-checks', 'oo-follow', 'oo-talk', 'deal-table', 'pd-deals', 'renew-table', 'home-next', 'pd-act', 'lv-table', 'ld-team-table', 'ld-rep-table', 'ld-backlog-table', 'ld-prob-table', 'ld-src-table', 'act-table', 'act-monday', 'act-trust-list', 'act-bdr-table', 'act-bdr-plan'];
  const refresh = async () => {
    if (!room || typeof room.canSendToClaudeSession !== 'function') return;
    let m = 'off';
    try { m = await room.canSendToClaudeSession(); } catch (e) { m = 'off'; }
    if (m !== mode) {
      mode = m;
      DRAWS.forEach((n) => dash.draw(n));
      document.querySelectorAll('[data-ask-agenda]').forEach((b) => { b.hidden = !(mode === 'available' || mode === 'available_if_summoned'); });
    }
  };
  (async () => {
    try {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') return;
      room = await c.use('room');
      await refresh();
    } catch (e) { room = null; }
  })();
  const LIMIT = 3900;
  const RULES = 'Sent from a button on the EMEA RevOps OS dashboard, as the viewer asking for help with this item. Before changing anything in Salesforce, LeanData, Slack, email or calendars, show exactly what you would change or send and wait for their OK; for Salesforce writes use the salesforce-ai-crud skill.';
  const clip = (t, n) => {
    let x = '';
    for (const ch of String(t == null ? '' : t)) {
      const c = ch.codePointAt(0);
      const bad = (c < 32 && c !== 9 && c !== 10 && c !== 13) || (c >= 127 && c < 160) || c === 173 || (c >= 0x200b && c <= 0x200f)
        || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x206f) || c === 0xfeff || (c >= 0xe000 && c <= 0xf8ff);
      if (!bad) x += ch;
    }
    return x.length > n ? x.slice(0, n - 1) + '\u2026' : x;
  };
  return {
    can: () => !!room && (mode === 'available' || mode === 'available_if_summoned'),
    refresh,
    // the whole request must stay under the platform's 4 KB: a long ask is cut at a line end, and says so
    data: (label, ask, extra, more) => {
      const d = { label: clip(label, 120), source: 'EMEA RevOps OS', ask: clip(ask, 20000), rules: RULES };
      for (const [k, v] of Object.entries(extra || {})) if (v != null && v !== '' && !['label', 'source', 'ask', 'rules'].includes(k)) d[k] = typeof v === 'string' ? clip(v, 300) : v;
      const size = (o) => new TextEncoder().encode(JSON.stringify(o)).length;
      if (size(d) > LIMIT) {
        const full = d.ask, tail = '\n… (' + (more || 'cut to fit; the rest is in the dashboard') + ')';
        let lo = 0, hi = full.length;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; d.ask = full.slice(0, mid) + tail; if (size(d) <= LIMIT) lo = mid; else hi = mid - 1; }
        let cut = full.slice(0, lo);
        const nl = cut.lastIndexOf('\n');
        if (nl > lo * 0.5) cut = cut.slice(0, nl);
        d.ask = cut + tail;
      }
      return d;
    },
    // call straight from the click handler, nothing awaited before it
    send: (data) => (room && typeof room.sendToClaudeSession === 'function' ? room.sendToClaudeSession(data, { deliver: 'send' }) : Promise.reject(new Error('unavailable'))),
  };
})();
OS.links = (() => {
  const SF = 'https://legora.lightning.force.com/lightning/r/';
  const a = (href, label, icon, cls) => {
    const x = OS.el('a', 'ibtn' + (cls ? ' ' + cls : ''));
    x.href = href;
    if (!/^mailto:/.test(href)) { x.target = '_blank'; x.rel = 'noopener'; }
    x.setAttribute('aria-label', label);
    x.title = label;
    x.appendChild(OS.icon(icon));
    return x;
  };
  return {
    sf: (object, id) => (id && /^[A-Za-z0-9]{15,18}$/.test(String(id)) ? a(SF + object + '/' + id + '/view', 'Open in Salesforce', OS.ICON.ext) : null),
    mail: (email, subject, body) => {
      if (!(email && /^[^\s@]+@[^\s@]+$/.test(email))) return null;
      let b = String(body || '');
      if (b.length > 1800) { const cut = b.slice(0, 1760); const nl = cut.lastIndexOf('\n'); b = (nl > 900 ? cut.slice(0, nl) : cut) + '\n…'; }
      return a('mailto:' + encodeURIComponent(email).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(subject || '') + '&body=' + encodeURIComponent(b), 'Email ' + email, OS.ICON.mail);
    },
    ask: (data) => {
      if (!OS.ask.can()) return null;
      const b = OS.el('button', 'ibtn ask');
      b.type = 'button';
      b.dataset.ask = JSON.stringify(data);
      b.setAttribute('aria-label', 'Ask Claude: ' + data.label);
      b.title = 'Ask Claude to help with this';
      b.appendChild(OS.icon(OS.ICON.spark));
      return b;
    },
  };
})();

// ---------- Data checks ----------
// Every check source that has loaded, in the scope picked: Salesforce (checks), LeanData routing (checks_rr), HiBob
// (checks_hb), leavers' leads (checks_lv), leads (checks_ld, checks_ld_rt, checks_ld_cap), activity capture (checks_act) and
// Salesforce values the pipeline logic depends on (checks_cfg).
// Each is its own calc, so one failing leaves the rest.
OS.CHECKS = ['checks', 'checks_rr', 'checks_hb', 'checks_lv', 'checks_ld', 'checks_ld_rt', 'checks_ld_cap', 'checks_act', 'checks_cfg'];
OS.checkRows = (sc) => {
  // sc: { mgr, region } to read another scope than the scope pill's (the 1:1 agendas read all EMEA)
  const p = sc || dash.params();
  const rank = { high: 0, medium: 1, low: 2 };
  return OS.CHECKS.filter((id) => OS.state(id) === 'ok').flatMap((id) => dash.data(id).data || [])
    .filter((c) => (p.mgr ? c.manager === p.mgr : !p.region || p.region === 'All' || c.region === p.region))
    .sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.area).localeCompare(String(b.area)) || String(a.title).localeCompare(String(b.title)));
};

// ---------- People who left ----------
// Deals, renewals and accounts always (leavers_core); open leads (leavers_leads) and LeanData pool seats
// (leavers_pools) join when they load, each on its own, and are unknown (null) when they can't be read.
OS.leavers = () => {
  const ok = (id) => OS.state(id) === 'ok';
  if (!ok('leavers_core')) return null;
  const leadsKnown = ok('leavers_leads'), poolsKnown = ok('leavers_pools');
  const base = (leadsKnown ? dash.data('leavers_leads').data : dash.data('leavers_core').data) || [];
  const pools = poolsKnown ? new Map((dash.data('leavers_pools').data || []).map((p) => [p.key, p])) : null;
  const rows = base.map((o) => {
    const p = pools ? pools.get(o.key) : null;
    return { ...o, leads: leadsKnown ? o.leads || 0 : null, ready: leadsKnown ? o.ready || 0 : null, fresh: leadsKnown ? o.fresh || 0 : null, pools: pools ? (p ? p.pools : 0) : null, poolNames: p ? p.poolNames : '' };
  })
    .filter((o) => o.deals || o.renewals || o.leads || o.accounts || o.customers || o.emCustomers || o.pools)
    .map((o) => ({ ...o, status: o.renewals || o.deals || o.customers || o.emCustomers ? 'Hand over revenue' : o.leads ? 'Reassign leads' : o.accounts ? 'Reassign accounts' : 'Remove from routing' }))
    .sort((a, b) => (b.renewalArr + b.dealArr + b.customerArr) - (a.renewalArr + a.dealArr + a.customerArr) || (b.leads || 0) - (a.leads || 0) || String(a.name).localeCompare(String(b.name)));
  return { rows, leadsKnown, poolsKnown, sources: ['leavers_core'].concat(leadsKnown ? ['leavers_leads'] : [], poolsKnown ? ['leavers_pools'] : []) };
};
// the leavers headline for a scope key ('All', a team, or 'M|manager')
OS.leaversIn = (scope) => {
  const lv = OS.leavers();
  if (!lv) return null;
  const rows = lv.rows.filter((r) => (String(scope).startsWith('M|') ? r.manager === scope.slice(2) : scope === 'All' || r.region === scope));
  const sum = (f) => rows.reduce((s, r) => s + (+r[f] || 0), 0);
  return { people: rows.length, deals: sum('deals'), dealArr: sum('dealArr'), renewals: sum('renewals'), renewalArr: sum('renewalArr'),
    leads: lv.leadsKnown ? sum('leads') : null, ready: lv.leadsKnown ? sum('ready') : null, accounts: sum('accounts'), customers: sum('customers'),
    customerArr: sum('customerArr'), emCustomers: sum('emCustomers'), pools: lv.poolsKnown ? sum('pools') : null, leadsKnown: lv.leadsKnown, poolsKnown: lv.poolsKnown, sources: lv.sources };
};
// what the leavers drawings wait for: the core, plus a layer only while it is still loading
OS.leaversIds = () => ['leavers_core'].concat(['leavers_leads', 'leavers_pools'].filter((id) => OS.state(id) === 'loading'));

// ----- activity: the note above the activity tables -----
// minutes east of UTC for a time zone at time t (t on a whole minute)
const tzOffset = (zone, t) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t) / 6e4);
};
// Activity counts days up to yesterday in Paris or the browser's zone, whichever is earlier, while the queries stop at
// midnight in the viewer's Salesforce time zone. A Salesforce zone behind both means that each morning, until its
// midnight, a day the queries haven't read counts: { sf, until } (until = that midnight on the browser's clock), or null.
// sf_me is optional here: without it there is no note, and nothing else changes.
OS.tzLag = () => {
  const me = OS.state('sf_me') === 'ok' ? (dash.data('sf_me').data || [])[0] : null;
  if (!me || !me.timeZone) return null;
  try {
    const t = Math.floor(Date.now() / 6e4) * 6e4, here = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    const sf = tzOffset(me.timeZone, t), loc = tzOffset(here, t);
    if (Math.min(tzOffset('Europe/Paris', t), loc) - sf <= 0) return null;
    const m = (((loc - sf) % 1440) + 1440) % 1440;
    return { sf: me.timeZone, until: String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') };
  } catch (e) { return null; }
};
// The sentence above the activity tables, or '' when there is nothing to say: what the viewer's Salesforce access hides
// and, where days since the last activity show (ctx 'activity' and 'bdrs', not 'team'), the time-zone lag. apply()
// shows the note when this isn't empty and its drawing writes it, so the two always agree.
OS.actNote = (ctx) => {
  const g = OS.state('act_reps') === 'ok' ? (dash.data('act_reps').data || [])[0] || null : null;
  if (!g) return '';
  const team = ctx === 'team', out = [];
  const ch = g.mailHidden ? 'shows meetings but almost no captured emails, so ' + (team ? 'no one is flagged Quiet.' : 'emails show — and no one is flagged Quiet.')
    : g.meetHidden ? 'shows emails but almost no meetings, so meetings show — and ' + (team ? 'so do the activity flags.' : 'only email-based flags remain.') : '';
  if (g.limited) out.push('Your Salesforce access shows activity for ' + OS.num(g.visibleSellers) + ' of ' + OS.num(g.sellers) + ' sellers; '
    + (team ? 'a team with anyone it shows nothing for has blank activity columns.' : 'the rest show Not visible, with blank numbers, and the totals above count only what it shows.') + (ch ? ' For those it shows, it ' + ch : ''));
  else if (ch) out.push('Your access ' + ch);
  const z = team ? null : OS.tzLag();
  if (z) out.push('Your Salesforce time zone is ' + z.sf.replace(/_/g, ' ') + ', behind yours: the activity queries stop at midnight there, so until ' + z.until + ' your time, days since the last activity can read one high. Set your Salesforce time zone to where you work.');
  return out.join(' ');
};

// ---------- Completed next steps ----------
// Each viewer's ticks live in their own private part of this dashboard's database (data/users/<their id>/os-done),
// keyed by the meeting and the item's wording. Without a database or an id here, nothing can be ticked.
OS.done = (() => {
  // what the database last said, plus toggles not yet confirmed by a write; ticking waits for the stored list.
  // The document holds { done: { key: 'YYYY-MM-DD' | null } }; each write sends only the keys it changes (a merge),
  // so two tabs or devices ticking at once don't overwrite each other.
  const stored = new Map();
  const pending = new Map();
  let ref = null, can = false, ready = false, exists = false, docKeys = 0, writing = Promise.resolve(), cur = new Map();
  const today = () => new Date().toISOString().slice(0, 10);
  // a stable key that keeps no note text: the meeting, plus a hash of the owner and the item's wording
  const norm = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const hash = (t) => { let h = 2166136261 >>> 0; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
  const safe = (k) => String(k).replace(/[^A-Za-z0-9_-]/g, '_');
  const keyOf = (r) => (r && r.meetingId && r.item ? safe(r.meetingId + '|' + hash(norm(r.owner || '') + '|' + norm(r.item))) : '');
  const merged = () => { const m = new Map(stored); for (const [k, on] of pending) { if (on) m.set(k, m.get(k) || today()); else m.delete(k); } return m; };
  const DRAWS = ['act-list', 'home-actions', 'oo-follow', 'kpi-gr', 'nav-badge'];
  const redraw = () => {
    cur = merged();
    DRAWS.forEach((n) => dash.draw(n));
    dash.draw('msg');
    document.querySelectorAll('[data-gr-done]').forEach((b) => { b.hidden = !(can && ready); });
  };
  let failTimer = null;
  // kind: 'tickfail' (try again) or 'tickro' (this viewer can't save ticks)
  const failed = (kind) => {
    document.querySelectorAll('[data-toast="tickfail"], [data-toast="tickro"]').forEach((t) => { t.hidden = t.dataset.toast !== kind; });
    clearTimeout(failTimer);
    failTimer = setTimeout(() => document.querySelectorAll('[data-toast="tickfail"], [data-toast="tickro"]').forEach((t) => { t.hidden = true; }), 4200);
  };
  (async () => {
    try {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') return;
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      const uid = db && user ? await user.id() : null;
      if (!uid) return;
      // ticks live in the viewer's own subtree, which has its own write rule (contributors may write there), so
      // can('data.write') (shared documents) is not the signal: write, and a refusal turns ticks off for the visit
      ref = db.doc('data/users/' + uid + '/os-done');
      can = true;
      ref.onSnapshot((snap) => {
        stored.clear();
        const d = snap && snap.exists ? snap.data() : null;
        exists = !!(snap && snap.exists);
        docKeys = (d && Array.isArray(d.items) ? d.items.length : 0) + (d && d.done && typeof d.done === 'object' ? Object.keys(d.done).length : 0);
        // earlier versions kept a list of { k, at }
        for (const x of (d && Array.isArray(d.items) ? d.items : [])) if (x && typeof x.k === 'string') stored.set(safe(x.k), typeof x.at === 'string' ? x.at : '');
        const map = d && d.done && typeof d.done === 'object' ? d.done : {};
        for (const [k, at] of Object.entries(map)) { if (at == null || at === false) stored.delete(k); else stored.set(k, typeof at === 'string' ? at : ''); }
        if (!snap || !snap.metadata || snap.metadata.fromCache !== true) ready = true;
        redraw();
      }, () => { can = false; redraw(); });
    } catch (e) { can = false; ref = null; }
  })();
  const FATAL = ['invalid_argument', 'not_granted', 'capability_disabled', 'capability_removed', 'transform_error', 'revoked', 'quota_exceeded'];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // one write at a time; each sends the keys toggled since the last one. Merges only add keys (an untick is
  // stored as null), so past 1,000 keys the document is rewritten with the last 200 days' ticks instead.
  const MAX_KEYS = 1000;
  const write = () => {
    writing = writing.then(async () => {
      const sent = new Map(pending);
      if (!sent.size) return;
      const change = {};
      for (const [k, on] of sent) change[k] = on ? stored.get(k) || today() : null;
      const cut = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10);
      const compact = () => ({ done: Object.fromEntries([...merged()].filter(([, at]) => !at || at >= cut).map(([k, at]) => [k, at || today()])) });
      const send = async () => {
        // before this viewer's first saved tick, another tab may have created the document: merge into it, don't replace it
        if (!exists) { const snap = await ref.get(); exists = !!(snap && snap.exists); }
        if (exists && docKeys + sent.size <= MAX_KEYS) { await ref.update({ done: change }); docKeys += sent.size; }
        else { const body = compact(); await ref.set(body); exists = true; docKeys = Object.keys(body.done).length; }
      };
      let err = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { await send(); err = null; break; } catch (e) {
          err = e;
          const code = e && e.code;
          // a full document is refused like a write the viewer can't make: compact once before giving up
          if (code === 'invalid_argument' && exists && attempt === 0 && docKeys > 200) { docKeys = MAX_KEYS + 1; continue; }
          if (FATAL.includes(code)) break;
          await wait(code === 'resource_exhausted' ? 4000 + Math.random() * 2000 : 800 + Math.random() * 1200);
        }
      }
      if (!err) {
        exists = true;
        for (const [k, on] of sent) {
          if (on) stored.set(k, stored.get(k) || today()); else stored.delete(k);
          if (pending.get(k) === on) pending.delete(k);
        }
      } else {
        // not saved: undo these toggles; stop offering ticks only when writing can't work for this viewer
        for (const [k, on] of sent) if (pending.get(k) === on) pending.delete(k);
        const fatal = FATAL.includes(err && err.code);
        if (fatal) can = false;
        failed(fatal ? 'tickro' : 'tickfail');
      }
      redraw();
    });
  };
  return {
    keyOf,
    has: (r) => cur.has(keyOf(r)),
    can: () => can && ready && !!ref,
    toggle: (k) => {
      if (!ref || !can || !ready || !k) return;
      pending.set(k, !cur.has(k));
      redraw();
      write();
    },
  };
})();

// ---------- 1:1s ----------
// The person whose agenda shows: the one picked (an email, or "n:" + a Salesforce name), else the next 1:1.
// Only drawings and handlers on the 1:1s screen call these, so its datasets load only there.
OS.oo = (() => {
  const rowsOf = (id) => (OS.state(id) === 'ok' ? dash.data(id).data || [] : []);
  const who = () => {
    const p = String(dash.params().ooWho || '');
    if (p.startsWith('n:')) {
      const n = p.slice(2);
      const t = rowsOf('team_tree').find((r) => r.name === n);
      if (t && t.email) return t.email;
      const u = rowsOf('users_all').find((r) => r.name === n);
      return u && u.email ? String(u.email).toLowerCase() : p;
    }
    if (p) return p.toLowerCase();
    const up = rowsOf('oo_upcoming');
    return up.length ? up[0].email : '';
  };
  const nextFor = (email) => rowsOf('oo_upcoming').find((r) => r.email === email) || null;
  const nameOf = (email) => {
    if (!email) return '';
    if (email.startsWith('n:')) return email.slice(2);
    const t = rowsOf('team_tree').find((r) => r.email === email);
    if (t) return t.name;
    const n = nextFor(email);
    if (n && n.name) return n.name;
    const u = rowsOf('users_all').find((r) => String(r.email || '').toLowerCase() === email);
    if (u) return u.name;
    return email.split('@')[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  };
  const when = (r) => {
    if (!r || !r.start) return '';
    const d = new Date(r.start);
    if (Number.isNaN(+d)) return '';
    const day0 = new Date(); day0.setHours(0, 0, 0, 0);
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - day0) / 864e5);
    const dayTxt = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return dayTxt + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };
  // an agenda's numbers and talking points: the core ones, plus routing (oo_points_rr) and selling activity
  // (oo_points_act) once each has loaded; activity orders after the rest within a severity
  const RANK = { high: 0, medium: 1, low: 2, '': 3 };
  const points = (email) => rowsOf('oo_points').concat(rowsOf('oo_points_rr'), rowsOf('oo_points_act')).filter((r) => r.email === email)
    .sort((a, b) => (a.section === b.section ? 0 : a.section === 'numbers' ? -1 : 1) || (RANK[a.sev] ?? 3) - (RANK[b.sev] ?? 3) || a.order - b.order);
  // Who they are to you: your manager, someone who reports to you, RevOps, EMEA sales (they have Salesforce numbers), or
  // none of these. ops: their agenda gets the EMEA update and RevOps work. sales: true or false once oo_points has
  // loaded, null while it loads or when it couldn't load (then the sales sections show their own message).
  const kind = (email) => {
    if (!email || email.startsWith('n:')) return null;
    const me = rowsOf('sf_me')[0] || null;
    const u = rowsOf('users_all').find((r) => String(r.email || '').toLowerCase() === email) || null;
    const manager = !!(me && me.managerEmail && me.managerEmail === email);
    const report = !!(me && me.name && u && u.manager === me.name);
    const revops = !!(u && /REVOPS/i.test(u.role || ''));
    const sales = OS.state('oo_points') === 'ok' ? points(email).length > 0 : null;
    const label = [manager ? 'Your manager' : report ? 'Reports to you' : '', revops ? 'RevOps' : '', sales ? 'EMEA sales' : '',
      !manager && !report && !revops && sales === false ? 'Not in EMEA sales or RevOps' : ''].filter(Boolean).join(' · ');
    return { manager, report, revops, sales, ops: manager || report || revops, label };
  };
  // the EMEA update and RevOps work of an agenda: the weekly summary for all EMEA, without your own action items
  const OPS = {
    pipe: ['numbers', 'pipeline', 'teams'], cover: ['numbers', 'pipeline', 'coverage'], moves: ['numbers', 'pipeline', 'moves'],
    created: ['numbers', 'created', 'trend'], stuck: ['talk', 'pipeline', 'deals'], routing: ['talk', 'routing', 'people'],
    checks: ['talk', 'actions', 'checks'], leavers: ['talk', 'hiring', 'leavers'], leads: ['talk', 'leads', 'speed'],
    activity: ['talk', 'oneonone', 'activity'], books: ['talk', 'books', 'orphans'], engage: ['talk', 'books', 'engage'],
  };
  const ops = (sec) => (OS.summary ? OS.summary.lines({ region: 'All', mine: false }).lines : []).filter((l) => OPS[l.key] && OPS[l.key][0] === sec)
    .map((l) => ({ key: l.key, text: l.text, screen: OPS[l.key][1], view: OPS[l.key][2], na: / not available \(couldn't load\)$/.test(l.text) }));
  const lastOf = (email) => rowsOf('oo_followups').find((r) => r.email === email && r.kind === 'last') || null;
  const text = () => {
    const email = who();
    if (!email || email.startsWith('n:')) return '';
    const next = nextFor(email);
    const lines = ['1:1 with ' + nameOf(email) + (next ? ', ' + when(next) : '')];
    // follow-ups from the viewer's private Granola notes stay on their screen: the agenda is copied, emailed or sent to the colleague
    const fu = rowsOf('oo_followups').filter((r) => r.email === email && r.kind === 'item' && !r.priv && !OS.done.has(r));
    if (fu.length) {
      lines.push('', 'Follow-ups');
      for (const r of fu) lines.push(`- [ ] ${r.item}${r.owner ? ' (' + r.owner + ')' : ''}${r.due ? ', due ' + OS.shortDay(r.due) : ''}: ${r.meeting}, ${OS.shortDay(r.date)}`);
    }
    const last = lastOf(email);
    if (last && last.topics) {
      lines.push('', 'From last time (' + last.item + ', ' + OS.shortDay(last.date) + ')');
      for (const t of last.topics.split('\n')) lines.push('- ' + t);
    }
    const pts = points(email);
    const num = pts.filter((r) => r.section === 'numbers');
    const talk = pts.filter((r) => r.section === 'talk');
    if (num.length) { lines.push('', 'Numbers'); for (const r of num) lines.push('- ' + r.text); }
    if (talk.length) { lines.push('', 'Talking points'); for (const r of talk) lines.push('- ' + r.text); }
    const k = kind(email);
    if (k && k.ops) {
      const en = ops('numbers'), et = ops('talk');
      if (en.length) { lines.push('', 'EMEA update'); for (const r of en) lines.push('- ' + r.text); }
      if (et.length) { lines.push('', 'RevOps work'); for (const r of et) lines.push('- ' + r.text); }
    }
    lines.push('', 'Anything else');
    return lines.join('\n');
  };
  return { rowsOf, who, nextFor, nameOf, when, text, points, kind, ops, lastOf };
})();

// ---------- App shell ----------
(() => {
  const SCREENS = ['home', 'actions', 'oneonone', 'pipeline', 'created', 'hiring', 'routing', 'books', 'leads'];
  const view = { actions: 'meetings', oneonone: 'upcoming', pipeline: 'teams', created: 'trend', hiring: 'joiners', routing: 'people', books: 'reps', leads: 'speed' };
  // a link ends in #screen or #screen-view
  const [hashScreen, hashView] = location.hash.slice(1).split('-');
  let screen = SCREENS.includes(hashScreen) ? hashScreen : 'home';
  if (hashView && view[screen] && document.querySelector('[data-view-panel="' + screen + ':' + hashView + '"]')) view[screen] = hashView;
  const link = () => dash.setLink(view[screen] ? screen + '-' + view[screen] : screen);
  let lastPerson = null;

  const apply = () => {
    const person = dash.params().person || '';
    document.querySelectorAll('[data-page]').forEach((s) => { s.hidden = s.dataset.page !== screen; });
    document.querySelectorAll('[data-nav-item]').forEach((b) => {
      if (b.dataset.nav === screen) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-view-panel]').forEach((p) => {
      const [s, v] = p.dataset.viewPanel.split(':');
      p.hidden = view[s] !== v;
    });
    document.querySelectorAll('[data-view-tab]').forEach((t) => {
      const [s, v] = t.dataset.viewTab.split(':');
      t.setAttribute('aria-selected', String(view[s] === v));
    });
    document.querySelectorAll('[data-seg-views]').forEach((g) => { g.hidden = !g.dataset.segViews.split(' ').includes(screen + ':' + view[screen]); });
    document.querySelectorAll('[data-detail]').forEach((d) => { d.hidden = !person; });
    document.querySelectorAll('.app').forEach((a) => a.classList.toggle('has-detail', !!person && !!a.querySelector('[data-detail]')));
    // the note above the activity tables of the view on screen, only when there is something to say: here rather than in
    // onData, so a screen or view switch with the data already loaded gets it right too
    document.querySelectorAll('[data-act-access]').forEach((n) => { if (n.dataset.actAccess === screen + ':' + view[screen]) n.hidden = !OS.actNote(n.dataset.ctx || 'activity'); });
  };

  const toTop = () => document.querySelectorAll('.app-main').forEach((m) => { const t = m.getBoundingClientRect().top; if (t < 0 || t > innerHeight / 2) m.scrollIntoView({ block: 'start' }); });
  const go = (s, v) => {
    if (!SCREENS.includes(s)) return;
    screen = s;
    if (v && view[s]) view[s] = v;
    apply();
    link();
    toTop();
  };

  // Granola window: dates relative to today, in local time
  const isoLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const windowParams = (n) => {
    const now = new Date();
    return { grWindow: n, gr_since: isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n)), gr_until: isoLocal(now) };
  };
  (() => {
    const p = dash.params();
    const n = [7, 30, 90].includes(+p.grWindow) ? +p.grWindow : 30;
    const want = windowParams(n);
    const now = new Date();
    want.cal_from = isoLocal(now) + 'T00:00:00';
    want.cal_to = isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14)) + 'T00:00:00';
    if (Object.keys(want).some((k) => String(p[k]) !== String(want[k]))) dash.setParams(want);
  })();

  // copy to clipboard with a short status
  let toastTimer = null;
  const toast = (ok, from) => {
    const scope = (from && from.closest('.app-detail')) ? '.app-detail' : '.app-main';
    const kind = typeof ok === 'string' ? ok : ok ? 'ok' : 'fail';
    document.querySelectorAll('[data-toast]').forEach((t) => { t.hidden = !(t.closest(scope) && t.dataset.toast === kind); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => document.querySelectorAll('[data-toast]').forEach((t) => { t.hidden = true; }), 2200);
  };
  const copy = (text, btn) => {
    const done = (ok) => {
      toast(ok, btn);
      if (btn && ok) { btn.classList.add('is-copied'); setTimeout(() => btn.classList.remove('is-copied'), 1500); }
    };
    try {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    } catch (e) { done(false); }
  };
  const actionRows = () => {
    if (OS.state('gr_actions') !== 'ok') return [];
    const own = dash.params().grOwner || 'all';
    const one = !!dash.params().gr11;
    const late = !!dash.params().grDue;
    return OS.searchFilter('act-list', (dash.data('gr_actions').data || [])
      .filter((r) => !r.done && !OS.done.has(r) && (!one || r.oneOnOne) && (!late || r.dueStatus) && (own === 'all' || (own === 'foryou' ? r.forYou : r.bucket === own))), ['item', 'detail', 'owner', 'meeting']);
  };
  const checklist = () => actionRows().map((r) => `- [ ] ${r.item}${r.owner ? ' (' + r.owner + ')' : ''}${r.due ? ', due ' + OS.shortDay(r.due) : ''}: ${r.meeting}, ${OS.shortDay(r.date)}`).join('\n');
  const personRowNow = () => {
    const p = dash.params().person;
    if (!p || OS.state('person') !== 'ok') return null;
    return (dash.data('person').data || []).find((r) => r.name === p) || null;
  };

  const focusPanel = () => requestAnimationFrame(() => document.querySelectorAll('[data-detail]').forEach((d) => {
    if (d.hidden) return;
    if (matchMedia('(max-width: 1180px)').matches) d.scrollIntoView({ block: 'start' });
    d.querySelectorAll('[data-close-person]').forEach((b) => b.focus({ preventScroll: true }));
  }));
  const closePanel = () => {
    dash.setParams({ person: '' });
    const last = lastPerson;
    requestAnimationFrame(() => {
      if (!last) return;
      const hit = [...document.querySelectorAll('[data-person]')].find((b) => b.dataset.person === last.name && (!last.draw || (b.closest('[data-draw]') || {}).dataset?.draw === last.draw));
      if (hit) hit.focus();
    });
  };
  const openPalette = () => {
    document.querySelectorAll('[data-palette]').forEach((p) => { p.hidden = false; });
    document.querySelectorAll('input[data-search="palette-list"]').forEach((inp) => { inp.value = ''; OS.queries['palette-list'] = ''; inp.focus(); });
    filterGos('');
    OS.redraw('palette-list');
  };
  const closePalette = () => document.querySelectorAll('[data-palette]').forEach((p) => { p.hidden = true; });
  // plain-text summaries for Slack: built from the data already loaded on screen
  const rowOf = (id, pick) => (OS.state(id) === 'ok' ? (dash.data(id).data || []).find(pick) || null : null);
  // the sources the weekly summary reads; Home loads them while it is open, and the copy button waits for them
  const SUMMARY = ['pipe_team', 'pipe_cover', 'moves_kpi', 'cr_kpi', 'risk_kpi', 'rr_kpi', ...OS.CHECKS, 'leavers_core', 'leavers_leads', 'leavers_pools', 'ld_kpi', 'ld_kpi_rt', 'act_kpi', 'orphan_kpi', 'engagement_kpi', 'gr_actions'];
  const failedSrc = (id) => ['error', 'connect'].includes(OS.state(id));
  // The weekly summary as lines, each with what it is about. Home's Copy summary reads it for the scope pill; the 1:1
  // agendas of RevOps people (your manager, your reports, RevOps colleagues) read it for all EMEA.
  const summaryLines = (sc) => {
    const p = dash.params();
    const mgr = sc ? sc.mgr || '' : p.mgr || '';
    const reg = sc ? sc.region || 'All' : p.region || 'All';
    const scope = mgr ? 'M|' + mgr : reg;
    const label = mgr ? mgr + "'s team" : (reg !== 'All' ? reg : 'EMEA');
    const pipeKey = mgr ? 'M|' + mgr : reg === 'All' ? 'All|All' : reg + '|All';
    const pipe = rowOf('pipe_team', (r) => r.key === pipeKey);
    const cr = rowOf('cr_kpi', () => true);
    const rr = rowOf('rr_kpi', (r) => r.region === scope);
    const orph = rowOf('orphan_kpi', () => true);
    const cov = rowOf('pipe_cover', (r) => r.key === pipeKey);
    const mv = rowOf('moves_kpi', (r) => r.region === scope);
    const rk = rowOf('risk_kpi', (r) => r.region === scope);
    // leavers: deals, renewals and accounts, plus leads and pool seats when those could be read
    const lv = OS.leaversIn(scope);
    const eng = rowOf('engagement_kpi', (r) => r.region === scope);
    const ld = rowOf('ld_kpi', (r) => r.region === scope);
    const ldRt = rowOf('ld_kpi_rt', (r) => r.region === scope);
    const act = rowOf('act_kpi', (r) => r.region === scope);
    const x = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1) + '×');
    const signed = (v) => (v < 0 ? '−' : '+') + OS.usd(Math.abs(v));
    const n = (v, one, many) => OS.num(v) + ' ' + (v === 1 ? one : many);
    const na = (what, id) => (failedSrc(id) ? `• ${what}: not available (couldn't load)` : null);
    const lines = [];
    const add = (key, line) => { if (line) lines.push({ key, text: line.replace(/^• /, '') }); };
    if (pipe) add('pipe', `• Pipeline this quarter: ${OS.usd(pipe.thisPipe)} open (commit ${OS.usd(pipe.thisCommit)}, best case ${OS.usd(pipe.thisBest)}), ${OS.usd(pipe.won)} closed won`);
    else add('pipe', na('Pipeline', 'pipe_team'));
    if (cov && cov.avgBookings > 0) add('cover', cov.aheadOfUsual
      ? `• Coverage: past a usual quarter already (${OS.usd(cov.wonSoFar)} won, ${OS.usd(cov.avgBookings)} usual); next quarter ${x(cov.coverageNext)}`
      : `• Coverage: ${OS.usd(cov.openThis)} open against ${OS.usd(cov.toGo)} still to win for a usual quarter (${x(cov.coverageThis)}); next quarter ${x(cov.coverageNext)}${cov.projectedThis != null ? `; expected ${OS.usd(cov.projectedThis)} at a ${OS.pct(cov.winRate)} win rate` : ''}`);
    else if (!cov) add('cover', na('Coverage', 'pipe_cover'));
    if (mv) add('moves', `• Last 7 days: ${OS.num(mv.won)} won (${OS.usd(mv.wonArr)}), ${OS.num(mv.lost)} lost (${OS.usd(mv.lostArr)}); ${n(mv.pushed, 'deal', 'deals')} (${OS.usd(mv.pushedArr)}) pushed out of this quarter, ${OS.num(mv.pulled)} pulled in; Commit ${signed(mv.netCommitArr)} net`);
    else add('moves', na('Last 7 days', 'moves_kpi'));
    if (cr) add('created', `• Created: ${OS.num(cr.thisWeekOpps)} opps this week (${OS.num(cr.lastWeekOpps)} last week), ${OS.num(cr.thisQOpps)} this quarter (all EMEA)`);
    else add('created', na('Created', 'cr_kpi'));
    if (rk) { if (rk.stuck) add('stuck', `• Stuck in stage: ${n(rk.stuck, 'deal', 'deals')} (${OS.usd(rk.stuckArr)}) closing this or next quarter, past twice the usual time in their stage`); }
    else add('stuck', na('Stuck in stage', 'risk_kpi'));
    if (rr) add('routing', `• Routing: ${n(rr.missing, 'rep', 'reps')} missing from a pool, ${n(rr.weekOne, 'joiner', 'joiners')} to add next week`);
    else add('routing', na('Routing', 'rr_kpi'));
    if (OS.CHECKS.some((id) => OS.state(id) === 'ok')) {
      const cs = OS.checkRows({ mgr, region: reg });
      const partial = OS.CHECKS.some((id) => failedSrc(id));
      add('checks', `• Data checks: ${OS.num(cs.length)} open, ${OS.num(cs.filter((c) => c.severity === 'high').length)} urgent${partial ? ' (some checks couldn\'t load)' : ''}`);
    } else add('checks', na('Data checks', 'checks'));
    if (lv) {
      const held = [lv.renewals ? n(lv.renewals, 'renewal', 'renewals') + ' (' + OS.usd(lv.renewalArr) + ' contract ARR)' : '', lv.deals ? n(lv.deals, 'open deal', 'open deals') : '',
        lv.leads ? n(lv.leads, 'open lead', 'open leads') : '', lv.accounts ? n(lv.accounts, 'active account', 'active accounts') : '',
        lv.emCustomers ? 'Engagement Manager on ' + n(lv.emCustomers, 'customer', 'customers') : '', lv.pools ? n(lv.pools, 'LeanData pool seat', 'LeanData pool seats') : ''].filter(Boolean);
      const unknown = [lv.leads === null ? 'leads' : '', lv.pools === null ? 'pool seats' : ''].filter(Boolean).join(' and ');
      if (lv.people && held.length) add('leavers', `• Leavers: ${n(lv.people, 'person who left still holds', 'people who left still hold')} ${held.join(', ')}${unknown ? ` (${unknown} not available)` : ''}`);
      else if (unknown) add('leavers', `• Leavers: ${unknown} of people who left not available (couldn't load)`);
    } else add('leavers', na('Leavers', 'leavers_core'));
    const ldSpeed = !ld ? '' : ld.hRate != null ? `${OS.pct(ld.hRate)} of demo requests worked within 1 business day (${OS.num(ld.hWithin)} of ${OS.num(ld.hEligible)}, last 30 days)`
      : ld.hEligible ? `${OS.num(ld.hWithin)} of ${OS.num(ld.hEligible)} demo requests worked within 1 business day (too few to rate)` : !ld.lEligible && ld.notScored > 0 ? 'speed not timed for SMB-owned leads (automation moves them out of Ready)' : 'no timed demo requests in the last 30 days';
    if (ld) { if (ld.handoffs || ld.readyNow) add('leads', `• Leads: ${ldSpeed}; ${n(ld.demoWaiting, 'demo request', 'demo requests')} waiting 2+ business days; ${OS.num(ld.readyNow)} in Ready, ${OS.num(ld.stale)} of them over 20 business days or since before 19 May${ldRt && ldRt.routingIssues ? `; ${n(ldRt.routingIssues, 'lead', 'leads')} stuck in routing` : ''}`); }
    else add('leads', na('Leads', 'ld_kpi'));
    if (act) {
      if (act.blind || act.meetings || act.emails || act.sellers) {
        const sg = (v) => (v < 0 ? '−' : '+') + Math.abs(Math.round(v * 100)) + '%';
        // a channel the viewer's access hides is named, not dropped or counted as zero, and so are the flags it switches off
        const meet = act.meetings == null ? 'meetings not visible with your access' : `${n(act.meetings, 'external meeting', 'external meetings')} (${OS.num(act.meetCust)} with customers), ${OS.num(act.booked)} booked for the next 2 weeks`;
        const flags = [act.mailHidden || act.meetHidden ? '' : `${OS.num(act.quiet)} quiet`, `${OS.num(act.slowing)} slowing`, act.meetHidden ? '' : `${OS.num(act.nothingBooked)} with nothing booked`, `${OS.num(act.noCapture)} with ${act.mailHidden ? 'no meeting captured' : act.meetHidden ? 'no sent email captured' : 'nothing captured'}`].filter(Boolean).join(', ');
        if (act.blind) add('activity', `• Activity, last 4 weeks: not visible with your Salesforce access${act.sellers ? ` (it shows no activity for any of the ${n(act.sellers, 'seller', 'sellers')})` : ''}`);
        else add('activity', `• Activity, last 4 weeks: ${meet}, ${act.emails != null ? `${n(act.emails, 'email', 'emails')} sent` : 'emails not visible with your access'}`
          + `${act.meetChg != null ? `; meetings ${sg(act.meetChg)} like-for-like (${n(act.lflMeetReps, 'person', 'people')} compared)` : ''}`
          + `; ${flags}`
          + `${act.notVisible ? ` (your Salesforce access shows no activity for ${OS.num(act.notVisible)} of the ${n(act.sellers, 'seller', 'sellers')}, so these may be partial)` : ''}`);
      }
    } else add('activity', na('Activity', 'act_kpi'));
    if (orph && !mgr && reg === 'All') add('books', `• Account books: ${OS.num(orph.accounts)} orphan active accounts (${OS.usd(orph.arr)} ARR), ${OS.num(orph.splitBooks)} split books`);
    if (eng) { if (eng.untouched) add('engage', `• Engagement: ${n(eng.untouched, 'active account', 'active accounts')} untouched in 90 days${eng.share != null ? ' (' + OS.pct(eng.share) + ' of the active book)' : ''}, ${n(eng.noEm, 'customer', 'customers')} without an Engagement Manager`); }
    else add('engage', na('Engagement', 'engagement_kpi'));
    if (sc && sc.mine === false) return { label, lines };
    const gr = rowOf('gr_kpi', () => true);
    const mine = OS.state('gr_actions') === 'ok' ? (dash.data('gr_actions').data || []).filter((r) => r.forYou && !r.done && !OS.done.has(r)) : null;
    if (mine) add('mine', `• My action items: ${OS.num(mine.length)} for me from ${OS.num(new Set(mine.map((r) => r.meetingId)).size)} meetings`);
    else if (gr) add('mine', `• My action items: ${OS.num(gr.forYou)} for me`);
    else add('mine', na('My action items', 'gr_actions'));
    return { label, lines };
  };
  const weeklySummary = () => {
    const s = summaryLines();
    return s.lines.length ? [`RevOps update, ${s.label}, ${OS.day(new Date().toISOString().slice(0, 10))}`].concat(s.lines.map((l) => '• ' + l.text)).join('\n') : '';
  };
  // what each part of a 1:1 agenda's RevOps sections reads (the summary without your own action items)
  OS.summary = { lines: summaryLines, SOURCES: SUMMARY, NUM: ['pipe_team', 'pipe_cover', 'moves_kpi', 'cr_kpi'],
    OPS: ['risk_kpi', 'rr_kpi', ...OS.CHECKS, 'leavers_core', 'leavers_leads', 'leavers_pools', 'ld_kpi', 'ld_kpi_rt', 'act_kpi', 'orphan_kpi', 'engagement_kpi'] };
  const checksChecklist = () => {
    const area = dash.params().checkArea || 'All';
    return OS.checkRows().filter((c) => area === 'All' || c.area === area)
      .map((c) => `- [ ] ${c.title}: ${c.what}${c.meta ? ' (' + c.meta + ')' : ''}`).join('\n');
  };
  const scopeOpen = (open) => {
    document.querySelectorAll('[data-scope-pop]').forEach((p) => { p.hidden = !open; });
    document.querySelectorAll('[data-scope-toggle]').forEach((b) => b.setAttribute('aria-expanded', String(!!open)));
    if (open) requestAnimationFrame(() => document.querySelectorAll('[data-scope-pop] .schip[aria-pressed="true"]').forEach((c) => c.focus({ preventScroll: true })));
  };
  const syncCopyList = () => document.querySelectorAll('[data-copy-list]').forEach((b) => { b.disabled = !actionRows().length; });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.scope')) scopeOpen(false);
    const t = e.target.closest('[data-ask], [data-ask-agenda], [data-scope-toggle], [data-region], [data-mgr], [data-scope-reset], [data-done-key], [data-oo-who], [data-prep-oo], [data-copy-agenda], [data-gr-done], [data-nav], [data-open-palette], [data-clear-mgr], [data-gr-group], [data-gr-11], [data-gr-due], [data-view-tab], [data-person], [data-close-person], [data-copy-text], [data-copy-list], [data-copy-summary], [data-copy-checks], [data-copy-table], [data-copy-person-id], [data-pq], [data-crm], [data-gr-window], [data-gr-owner], [data-check-area], [data-deal-flag], [data-renew-flag], [data-ld-ready], [data-ld-prob], [data-act-role], [data-act-look], [data-act-left], th[data-sort]');
    if (!t) return;
    if (t.matches('[data-ask]')) {
      let data = null;
      try { data = JSON.parse(t.dataset.ask); } catch (err) { data = null; }
      if (!data) return;
      OS.ask.send(data).then(() => toast('asked', t), () => toast('askfail', t));
      return;
    }
    if (t.matches('[data-ask-agenda]')) {
      const text = OS.oo.text();
      if (!text) { toast(false, t); return; }
      const who = OS.oo.who();
      OS.ask.send(OS.ask.data('1:1 agenda for ' + OS.oo.nameOf(who), 'Here is my agenda for the 1:1 with ' + OS.oo.nameOf(who) + '. Offer to add it to the calendar invite or to send it to them on Slack, and ask me which before doing either.\n\n' + text, { person: OS.oo.nameOf(who), email: who }, 'cut to fit; Copy agenda in the dashboard has the full list'))
        .then(() => toast('asked', t), () => toast('askfail', t));
      return;
    }
    if (t.matches('[data-scope-toggle]')) { scopeOpen(t.getAttribute('aria-expanded') !== 'true'); return; }
    if (t.matches('[data-region]')) { dash.setParams({ region: t.dataset.region || 'All', mgr: '' }); return; }
    if (t.matches('[data-mgr]')) { dash.setParams({ mgr: t.dataset.mgr || '' }); scopeOpen(false); return; }
    if (t.matches('[data-scope-reset]')) { dash.setParams({ region: 'All', mgr: '' }); scopeOpen(false); return; }
    if (t.matches('[data-done-key]')) {
      const list = t.closest('ul');
      const i = list ? [...list.querySelectorAll('[data-done-key]')].indexOf(t) : -1;
      OS.done.toggle(t.dataset.doneKey);
      if (screen === 'actions') syncCopyList();
      if (list && i >= 0) requestAnimationFrame(() => { const b = list.querySelectorAll('[data-done-key]'); const nx = b[Math.min(i, b.length - 1)]; if (nx) nx.focus(); });
      return;
    }
    if (t.matches('[data-oo-who]')) { dash.setParams({ ooWho: t.dataset.ooWho }); if (screen !== 'oneonone' || view.oneonone !== 'upcoming') go('oneonone', 'upcoming'); return; }
    if (t.matches('[data-prep-oo]')) { const n = dash.params().person; if (n) { dash.setParams({ ooWho: 'n:' + n, person: '' }); go('oneonone', 'upcoming'); } return; }
    if (t.matches('[data-copy-agenda]')) { const text = OS.oo.text(); if (text) copy(text, t); else toast(false, t); return; }
    if (t.matches('[data-gr-done]')) { dash.setParams({ grShowDone: !dash.params().grShowDone }); return; }
    if (t.matches('[data-nav]')) {
      if (t.dataset.grOwner) dash.setParams({ grOwner: t.dataset.grOwner });
      if (t.dataset.navArea) dash.setParams({ checkArea: t.dataset.navArea });
      if (t.dataset.fill) {
        document.querySelectorAll('input[data-search]').forEach((inp) => {
          if (inp.dataset.search === t.dataset.fill) { inp.value = t.dataset.fillValue || ''; OS.queries[t.dataset.fill] = inp.value; }
        });
      }
      closePalette();
      if (t.dataset.fill && t.closest('[data-palette]')) dash.setParams({ region: 'All', mgr: '' });
      go(t.dataset.nav, t.dataset.navView);
      if (t.dataset.fill) OS.redraw(t.dataset.fill);
      return;
    }
    if (t.matches('[data-open-palette]')) { openPalette(); return; }
    if (t.matches('[data-clear-mgr]')) { dash.setParams({ mgr: '' }); return; }
    if (t.matches('[data-gr-group]')) { dash.setParams({ grGroup: t.dataset.grGroup }); return; }
    if (t.matches('[data-gr-11]')) { dash.setParams({ gr11: !dash.params().gr11 }); return; }
    if (t.matches('[data-gr-due]')) { dash.setParams({ grDue: !dash.params().grDue }); return; }
    if (t.matches('[data-view-tab]')) { const [s, v] = t.dataset.viewTab.split(':'); view[s] = v; apply(); link(); return; }
    if (t.matches('[data-person]')) { lastPerson = { name: t.dataset.person, draw: (t.closest('[data-draw]') || {}).dataset?.draw || null }; closePalette(); dash.setParams({ person: t.dataset.person }); focusPanel(); return; }
    if (t.matches('[data-close-person]')) { closePanel(); return; }
    if (t.matches('[data-copy-text]')) { copy(t.dataset.copyText, t); return; }
    if (t.matches('[data-copy-list]')) { const text = checklist(); if (text) copy(text, t); return; }
    if (t.matches('[data-copy-summary]')) { const text = weeklySummary(); if (text) copy(text, t); else toast(false, t); return; }
    if (t.matches('[data-copy-checks]')) { const text = checksChecklist(); if (text) copy(text, t); else toast(false, t); return; }
    if (t.matches('[data-copy-table]')) { const text = OS.tableText(t.dataset.copyTable); if (text) copy(text, t); else toast(false, t); return; }
    if (t.matches('[data-copy-person-id]')) { const row = personRowNow(); if (row && row.userId) copy(row.userId, t); return; }
    if (t.matches('[data-pq]')) { dash.setParams({ pq: t.dataset.pq }); return; }
    if (t.matches('[data-crm]')) { dash.setParams({ crm: t.dataset.crm }); return; }
    if (t.matches('[data-gr-window]')) { dash.setParams(windowParams(+t.dataset.grWindow)); return; }
    if (t.matches('[data-gr-owner]')) { dash.setParams({ grOwner: t.dataset.grOwner }); return; }
    if (t.matches('[data-check-area]')) { dash.setParams({ checkArea: t.dataset.checkArea }); return; }
    if (t.matches('[data-deal-flag]')) { dash.setParams({ dealFlag: t.dataset.dealFlag }); return; }
    if (t.matches('[data-renew-flag]')) { dash.setParams({ renewFlag: t.dataset.renewFlag }); return; }
    if (t.matches('[data-ld-ready]')) { dash.setParams({ ldReady: t.dataset.ldReady }); return; }
    if (t.matches('[data-ld-prob]')) { dash.setParams({ ldProb: t.dataset.ldProb }); return; }
    if (t.matches('[data-act-role]')) { dash.setParams({ actRole: t.dataset.actRole }); return; }
    // the Need a look tile turns the filter on; the chip toggles it
    if (t.matches('[data-act-look]')) { dash.setParams({ actLook: t.dataset.actLook === 'on' ? true : !dash.params().actLook }); return; }
    if (t.matches('[data-act-left]')) { dash.setParams({ actLeft: !dash.params().actLeft }); return; }
    if (t.matches('th[data-sort]')) {
      const tbl = t.closest('table[data-sortable]');
      if (!tbl) return;
      const name = tbl.dataset.sortable;
      const cur = OS.sorts[name];
      const dir = cur && cur.f === t.dataset.sort && cur.dir === 'descending' ? 'ascending' : 'descending';
      OS.sorts[name] = { f: t.dataset.sort, dir };
      tbl.querySelectorAll('th[data-sort]').forEach((h) => h.removeAttribute('aria-sort'));
      t.setAttribute('aria-sort', dir);
      OS.redraw(name);
    }
  });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); return; }
    if (!typing && e.key === '/' ) { e.preventDefault(); openPalette(); return; }
    const pal = [...document.querySelectorAll('[data-palette]')].find((p) => !p.hidden);
    if (pal) {
      if (e.key === 'Escape') { closePalette(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...pal.querySelectorAll('.pal-item')].filter((b) => !b.closest('[hidden]'));
        if (!items.length) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i < 0 ? 0 : Math.min(items.length - 1, i + 1)) : (i <= 0 ? -1 : i - 1);
        if (next < 0) pal.querySelectorAll('input[data-search]').forEach((inp) => inp.focus());
        else items[next].focus();
        return;
      }
      if (e.key === 'Enter' && e.target.matches('input[data-search="palette-list"]')) {
        const first = [...pal.querySelectorAll('.pal-item')].find((b) => !b.closest('[hidden]'));
        if (first) { e.preventDefault(); first.click(); }
        return;
      }
    }
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && /^[1-9]$/.test(e.key)) { go(SCREENS[+e.key - 1]); return; }
    if (e.key === 'Escape' && [...document.querySelectorAll('[data-scope-pop]')].some((p) => !p.hidden)) { scopeOpen(false); document.querySelectorAll('[data-scope-toggle]').forEach((b) => b.focus()); return; }
    if (e.key === 'Escape' && dash.params().person) closePanel();
  });
  document.querySelectorAll('.os-region').forEach((sel) => sel.addEventListener('change', () => dash.setParams({ region: sel.value || 'All', mgr: '' })));
  document.querySelectorAll('.os-mgr').forEach((sel) => sel.addEventListener('change', () => dash.setParams({ mgr: sel.value || '' })));
  document.querySelectorAll('.os-only-missing').forEach((c) => c.addEventListener('change', () => dash.setParams({ onlyMissing: c.checked })));
  document.querySelectorAll('.os-orphan-reason').forEach((s) => s.addEventListener('change', () => dash.setParams({ orphanReason: s.value })));
  document.querySelectorAll('.os-oo-pick').forEach((s) => s.addEventListener('change', () => { if (s.value) dash.setParams({ ooWho: s.value }); }));
  document.querySelectorAll('.os-oo-root').forEach((s) => s.addEventListener('change', () => dash.setParams({ ooRoot: s.value || '' })));
  const filterGos = (q) => {
    const words = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    document.querySelectorAll('.pal-go').forEach((b) => {
      const label = b.textContent.toLowerCase();
      const li = b.closest('li') || b;
      li.hidden = words.length ? !words.every((w) => label.includes(w)) : false;
    });
  };
  document.querySelectorAll('input[data-search]').forEach((inp) => inp.addEventListener('input', () => {
    if (inp.dataset.search === 'palette-list') filterGos(inp.value);
    OS.queries[inp.dataset.search] = inp.value;
    OS.redraw(inp.dataset.search);
    if (inp.dataset.search === 'act-list') syncCopyList();
  }));
  document.querySelectorAll('table[data-sortable]').forEach((tbl) => {
    const init = tbl.querySelector('th[aria-sort]');
    if (init) OS.sorts[tbl.dataset.sortable] = { f: init.dataset.sort, dir: init.getAttribute('aria-sort') };
  });

  apply();
  dash.onData(() => {
    apply();
    const p = dash.params();
    const pressed = (sel, attr, val) => document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === String(val))));
    pressed('[data-pq]', 'pq', p.pq || 'this');
    pressed('[data-crm]', 'crm', p.crm || 'opps');
    pressed('[data-gr-window]', 'grWindow', p.grWindow || 30);
    pressed('.fchip[data-gr-owner]', 'grOwner', p.grOwner || 'all');
    pressed('[data-check-area]', 'checkArea', p.checkArea || 'All');
    pressed('[data-deal-flag]', 'dealFlag', p.dealFlag || '');
    pressed('[data-renew-flag]', 'renewFlag', p.renewFlag || '');
    pressed('[data-ld-ready]', 'ldReady', p.ldReady || '');
    pressed('[data-ld-prob]', 'ldProb', p.ldProb || '');
    pressed('[data-act-role]', 'actRole', p.actRole || '');
    document.querySelectorAll('.fchip[data-act-look]').forEach((b) => b.setAttribute('aria-pressed', String(!!p.actLook)));
    document.querySelectorAll('[data-act-left]').forEach((b) => b.setAttribute('aria-pressed', String(!!p.actLeft)));
    pressed('[data-gr-group]', 'grGroup', p.grGroup || 'meeting');
    document.querySelectorAll('[data-gr-11]').forEach((b) => b.setAttribute('aria-pressed', String(!!p.gr11)));
    document.querySelectorAll('[data-gr-due]').forEach((b) => b.setAttribute('aria-pressed', String(!!p.grDue)));
    document.querySelectorAll('[data-gr-done]').forEach((b) => { b.setAttribute('aria-pressed', String(!!p.grShowDone)); b.hidden = !OS.done.can(); });
    // 1:1s: which fixed sentences show, only while that screen is open (reading its data loads it)
    if (screen === 'oneonone' && view.oneonone === 'upcoming') {
      const who = OS.oo.who();
      const ready = OS.state('oo_upcoming') !== 'loading';
      const booked = who && !who.startsWith('n:') ? OS.oo.nextFor(who) : null;
      const hasLast = !!who && OS.oo.rowsOf('oo_followups').some((r) => r.email === who && r.kind === 'last');
      const hasTopics = !!who && OS.oo.rowsOf('oo_followups').some((r) => r.email === who && r.kind === 'last' && r.topics);
      const hasPriv = !!who && OS.oo.rowsOf('oo_followups').some((r) => r.email === who && r.kind === 'item' && r.priv && !OS.done.has(r));
      document.querySelectorAll('[data-oo-note]').forEach((n) => {
        const k = n.dataset.ooNote;
        n.hidden = !((k === 'pick' && ready && !who) || (k === 'nobooking' && who && ready && !booked && OS.state('oo_upcoming') === 'ok') || (k === 'last' && hasLast) || (k === 'topics' && hasTopics) || (k === 'private' && hasPriv));
      });
      // which sections the agenda has: the Salesforce numbers and talking points of EMEA sales, the EMEA update and
      // RevOps work for your manager, your reports and RevOps colleagues, or a note that it has your notes only
      const rel = who ? OS.oo.kind(who) : null;
      document.querySelectorAll('[data-oo-sec]').forEach((n) => {
        const sec = n.dataset.ooSec;
        n.hidden = sec === 'sales' ? !!(rel && rel.sales === false) : sec === 'ops' ? !(rel && rel.ops) : sec === 'none' ? !(rel && !rel.ops && rel.sales === false) : n.hidden;
      });
      // the agenda is built from what has loaded, so copying and sending wait for its sources
      const agendaLoading = ['oo_points', 'oo_points_rr', 'oo_followups'].concat(rel && rel.ops ? OS.summary.NUM.concat(OS.summary.OPS) : [])
        .some((id) => OS.state(id) === 'loading');
      document.querySelectorAll('[data-copy-agenda], [data-ask-agenda]').forEach((b) => { b.disabled = !who || who.startsWith('n:') || agendaLoading; });
    }
    document.querySelectorAll('[data-scope-note]').forEach((n) => { n.hidden = !p.mgr; });
    document.querySelectorAll('[data-scope-tag]').forEach((n) => { n.hidden = !(p.mgr || (p.region && p.region !== 'All')); });
    document.querySelectorAll('[data-legend]').forEach((n) => { n.hidden = n.dataset.legend !== (p.mgr ? 'mgr' : 'team'); });
    document.querySelectorAll('.os-region').forEach((sel) => { sel.value = p.region || 'All'; });
    document.querySelectorAll('.os-only-missing').forEach((c) => { c.checked = !!p.onlyMissing; });
    document.querySelectorAll('.os-orphan-reason').forEach((s) => { s.value = p.orphanReason || ''; });
    document.querySelectorAll('.os-sw[data-color]').forEach((sw) => { sw.style.background = dash.colors[+sw.dataset.color]; });
    document.querySelectorAll('.app').forEach((a) => {
      a.style.setProperty('--app-accent', dash.colors[0]);
      dash.colors.forEach((c, i) => a.style.setProperty('--c' + i, c));
    });
    document.querySelectorAll('.schip[data-region]').forEach((b) => b.setAttribute('aria-pressed', String(!p.mgr && b.dataset.region === (p.region || 'All'))));
    document.querySelectorAll('[data-scope-toggle]').forEach((b) => b.classList.toggle('is-scoped', !!p.mgr || (p.region || 'All') !== 'All'));
    const hr = new Date().getHours();
    const part = hr < 12 ? 'morning' : hr < 18 ? 'afternoon' : 'evening';
    document.querySelectorAll('[data-hello]').forEach((h) => { h.hidden = h.dataset.hello !== part; });
    OS.ask.refresh();
    document.querySelectorAll('[data-ask-agenda]').forEach((b) => { b.hidden = !OS.ask.can(); });
    // data checks: say so when some sources failed while others loaded (only on the screens that list them)
    if (screen === 'home' || screen === 'actions') {
      const st = OS.CHECKS.map((id) => OS.state(id));
      const partial = st.includes('ok') && st.some((x) => x === 'error' || x === 'connect');
      document.querySelectorAll('[data-checks-partial]').forEach((n) => { n.hidden = !partial; });
    }
    // Home loads what the weekly summary reads, and the copy button waits until it has loaded
    if (screen === 'home') {
      const busy = SUMMARY.some((id) => OS.state(id) === 'loading');
      document.querySelectorAll('[data-copy-summary]').forEach((b) => { b.disabled = busy; });
    }
    if (screen === 'actions') syncCopyList();
    // person panel notes and copy button, only while the panel is open
    if (p.person) {
      const sf = OS.state('person');
      const hb = OS.state('person_hb');
      const inSf = sf === 'ok' && (dash.data('person').data || []).some((r) => r.name === p.person);
      const hbRow = hb === 'ok' ? (dash.data('person_hb').data || []).find((r) => r.name === p.person) || null : null;
      const inHb = !!hbRow;
      document.querySelectorAll('[data-pd-note]').forEach((n) => {
        const k = n.dataset.pdNote;
        n.hidden = !((k === 'missing' && sf === 'ok' && hb === 'ok' && !inSf && !inHb)
          || (k === 'nosf' && sf === 'ok' && !inSf && inHb && !hbRow.sfMatched)
          || (k === 'outside' && sf === 'ok' && !inSf && inHb && hbRow.sfMatched)
          || (k === 'nohb' && hb === 'ok' && inSf && !inHb)
          || (k === 'hbconnect' && (hb === 'connect' || hb === 'error')));
      });
      const row = personRowNow();
      document.querySelectorAll('[data-copy-person-id]').forEach((b) => { b.disabled = !(row && row.userId); });
      const hasTeam = sf === 'ok' && (dash.data('person').data || []).some((r) => r.manager === p.person && r.isActive !== false && r.inRoster);
      document.querySelectorAll('[data-pd-team]').forEach((n) => { n.hidden = !hasTeam; });
      const ldRep = OS.state('ld_reps') === 'ok' ? (dash.data('ld_reps').data || []).find((r) => r.name === p.person) : null;
      document.querySelectorAll('[data-pd-leads]').forEach((n) => { n.hidden = !(ldRep && (ldRep.handoffs || ldRep.readyNow)); });
      // selling activity: EMEA sellers only; a note when the viewer's access shows none of theirs
      const actRep = OS.state('act_reps') === 'ok' ? (dash.data('act_reps').data || []).find((r) => r.name === p.person) || null : null;
      document.querySelectorAll('[data-pd-act]').forEach((n) => { n.hidden = !actRep; });
      document.querySelectorAll('[data-pd-act-note]').forEach((n) => { n.hidden = !(actRep && actRep.status === 'Not visible'); });
      document.querySelectorAll('[data-pd-act-dl]').forEach((n) => { n.hidden = !!(actRep && actRep.status === 'Not visible'); });
      document.querySelectorAll('[data-pd-act-em]').forEach((n) => { n.hidden = !(actRep && actRep.kind === 'EM'); });
      // open deals: point the deals query at this person, and show the section once it has
      if (row && row.userId && p.dealOwnerId !== row.userId) dash.setParams({ dealOwnerId: row.userId });
      document.querySelectorAll('[data-pd-deals]').forEach((n) => { n.hidden = !(row && row.userId && p.dealOwnerId === row.userId); });
    }
  });
  dash.draw('msg', (slot) => OS.drawMsg(slot));
})();
