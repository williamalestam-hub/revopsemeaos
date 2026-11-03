// EMEA RevOps OS — loaders, shared helpers and the app shell (navigation, views, person panel, copy).
// Fixed text lives in index.html. Outside drawings this file only listens and sets
// hidden / aria-* / class / style / value / checked, and defines helpers the drawings use.

// ---------- Loaders ----------
// Salesforce answers {totalSize, done, records:[{attributes, ...}]} become rows.
const sfRows = ({ answer }) => {
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
  return { columns: rows.length ? Object.keys(rows[0]) : [], rows, cut: a.done === false };
};
['pipe_stage', 'pipe_rep', 'pipe_pastdue', 'pipe_stale', 'won_q', 'renew_stake',
  'cr_daily', 'cr_monthly', 'cr_source', 'cr_owner_q', 'cr_bdr',
  'rr_members', 'rr_assign', 'roster',
  'bk_owner', 'bk_pipe', 'bk_em', 'bk_terr', 'bk_orphans', 'bk_books',
].forEach((id) => dash.loader(id, { description: 'Salesforce records as rows (the attributes key dropped)', fn: sfRows }));

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
      title: g(e, 'work/title') ?? null,
      department: g(e, 'work/department') ?? null,
      team: g(e, 'work/custom/field_1775721273768') ?? null,
      site: g(e, 'work/site') ?? null,
      manager: g(e, 'work/reportsTo') ?? null,
      secondManager: g(e, 'work/secondLevelManager') ?? null,
      startDate: g(e, 'work/startDate') ?? null,
    }));
    return { columns: ['id', 'name', 'title', 'department', 'team', 'site', 'manager', 'secondManager', 'startDate'], rows };
  },
});

dash.loader('gr_me', {
  description: 'The email of the Granola account you are signed in with',
  fn: ({ answer }) => {
    let a = answer;
    if (Array.isArray(a) && a.length && a[0] && a[0].type === 'text') a = a.map((c) => c.text).join('');
    if (typeof a === 'string') {
      try { a = JSON.parse(a); } catch (e) { throw new Error(a.slice(0, 400)); }
    }
    if (!a || typeof a.email !== 'string') throw new Error((a && (a.message || a.error)) || 'Granola answer had no email');
    return { columns: ['email'], rows: [{ email: a.email }] };
  },
});

// Granola: list_meetings gives the meetings in the window (following next pages); then get_meetings,
// ten at a time, gives each note's summary and private notes. Every bullet becomes a row with its heading.
dash.loader('gr_notes', {
  description: 'Your Granola meetings in the window, then each note read ten at a time; every bullet of the summary and private notes becomes a row with the heading it sits under',
  fn: async ({ answer, call, args }) => {
    const txt = (a) => (typeof a === 'string' ? a
      : Array.isArray(a) ? a.map((c) => (c && typeof c.text === 'string' ? c.text : '')).join('')
      : a && typeof a.text === 'string' ? a.text : JSON.stringify(a ?? ''));
    const dec = (s) => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
    const attr = (s, k) => { const m = String(s).match(new RegExp('(?:^|\\s)' + k + '="([^"]*)"')); return m ? dec(m[1]) : null; };
    const columns = ['id', 'meetingId', 'meeting', 'meetingAt', 'url', 'capturedByMe', 'source', 'section', 'pos', 'text', 'detail'];
    let page = txt(answer);
    if (!/<meetings_data[\s>]/.test(page)) {
      if (/no meetings|count="0"/i.test(page)) return { columns, rows: [] };
      throw new Error(page.slice(0, 400) || 'Granola returned no meetings list');
    }
    const meetings = new Map();
    for (let n = 0; n < 10; n++) {
      for (const m of page.matchAll(/<meeting\s([^>]*)>/g)) {
        const id = attr(m[1], 'id');
        if (id) meetings.set(id, { id, meeting: attr(m[1], 'title'), meetingAt: attr(m[1], 'meeting_at'), url: attr(m[1], 'url'), capturedByMe: attr(m[1], 'captured_by_me') === 'true' });
      }
      const pg = page.match(/<pagination\s([^>]*)>/);
      const cursor = pg && attr(pg[1], 'has_more') === 'true' ? attr(pg[1], 'next_cursor') : null;
      if (!cursor) break;
      page = txt(await call('list_meetings', { ...args, cursor }));
    }
    const rows = [];
    const parse = (md, source, meta) => {
      let section = source === 'private' ? 'Private notes' : '';
      let cur = null;
      let pos = 0;
      const push = () => { if (cur) rows.push(cur); cur = null; };
      for (const raw of String(md).split(/\r?\n/)) {
        const line = raw.replace(/\s+$/, '');
        const h = line.match(/^\s{0,3}#{1,6}\s+(.+)$/);
        if (h) { push(); section = h[1].replace(/[*_`]/g, '').trim(); continue; }
        const b = line.match(/^( *)(?:[-*+•]|\d+[.)])\s+(.*)$/);
        if (b && b[1].length < 2) {
          push();
          cur = { id: meta.id + ':' + source[0] + pos, meetingId: meta.id, meeting: meta.meeting, meetingAt: meta.meetingAt, url: meta.url, capturedByMe: meta.capturedByMe, source, section, pos, text: b[2].trim(), detail: '' };
          pos += 1;
          continue;
        }
        if (cur && line.trim()) cur.detail = (cur.detail ? cur.detail + ' ' : '') + line.trim().replace(/^(?:[-*+•]|\d+[.)])\s+/, '');
        else if (!line.trim() && cur && cur.detail) push();
      }
      push();
    };
    const ids = [...meetings.keys()];
    for (let i = 0; i < ids.length; i += 10) {
      const out = txt(await call('get_meetings', { meeting_ids: ids.slice(i, i + 10), attachments: 'none', max_participants: 0 }));
      if (!/<meetings_data[\s>]/.test(out) && /error|rate/i.test(out)) throw new Error(out.slice(0, 400));
      for (const block of out.split(/<meeting\s/).slice(1)) {
        const head = block.slice(0, block.indexOf('>'));
        const id = attr(' ' + head, 'id');
        if (!id) continue;
        const meta = meetings.get(id) || { id, meeting: attr(' ' + head, 'title'), meetingAt: attr(' ' + head, 'meeting_at'), url: attr(' ' + head, 'url'), capturedByMe: null };
        const sum = (block.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1];
        const priv = (block.match(/<private_notes(?:\s[^>]*)?>([\s\S]*?)<\/private_notes>/) || [])[1];
        if (sum) parse(dec(sum), 'summary', meta);
        if (priv) parse(dec(priv), 'private', meta);
      }
    }
    return { columns, rows };
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

  // status of several sources: 'ok' | 'loading' | 'connect' | 'error'
  const state = (...ids) => {
    let s = 'ok';
    for (const id of ids) {
      const st = dash.data(id).status;
      if (st === 'connect' || st === 'declined') return 'connect';
      if (st === 'error' || st === 'missing') return 'error';
      if (st !== 'ok') s = 'loading';
    }
    return s;
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
  const personBtn = (name) => {
    const b = el('button', 'lnk', name);
    b.type = 'button';
    b.dataset.person = name;
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
  };

  // message line inside a list or table body
  const message = (host, kind, text, span) => {
    const isTable = host.tagName === 'TBODY';
    const row = el(isTable ? 'tr' : 'li');
    const cell = isTable ? el('td') : row;
    if (isTable) { cell.colSpan = span || 1; row.appendChild(cell); }
    if (kind === 'loading') { cell.className = 'dash-skeleton'; cell.style.height = '3rem'; }
    else if (kind === 'error') { cell.className = 'os-fail'; cell.textContent = 'Failed to load'; }
    else { cell.className = 'os-empty'; cell.textContent = text; }
    host.replaceChildren(row);
  };
  const stateMessage = (host, s, span, connectText) => {
    if (s === 'loading') { message(host, 'loading', '', span); return true; }
    if (s === 'error') { message(host, 'error', '', span); return true; }
    if (s === 'connect') { message(host, 'empty', connectText || 'Connect this source to see it.', span); return true; }
    return false;
  };

  const searchFilter = (name, list, fields) => {
    const q = (queries[name] || '').trim().toLowerCase();
    return q ? list.filter((r) => fields.some((f) => String(r[f] ?? '').toLowerCase().includes(q))) : list;
  };

  // tbody renderer. cols: [{f, fmt?, num?, bar?: (list)=>max, chip?: (v,row)=>cls, cls?, wrap?, person?: (row)=>name}]
  const table = (tbody, ids, rows, cols, opts = {}) => {
    const s = state(...ids);
    if (stateMessage(tbody, s, cols.length, opts.connect)) return;
    const name = tbody.dataset.draw;
    let list = searchFilter(name, rows(), cols.map((c) => c.f));
    const st = sorts[name];
    if (st) {
      list = list.slice().sort((a, b) => {
        const x = a[st.f], y = b[st.f];
        const r = (typeof x === 'number' || typeof y === 'number') ? (+x || 0) - (+y || 0) : String(x ?? '').localeCompare(String(y ?? ''));
        return st.dir === 'ascending' ? r : -r;
      });
    }
    if (!list.length) { message(tbody, 'empty', opts.empty || 'Nothing to show for this filter.', cols.length); return; }
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
        if (c.person && v && !/^\(/.test(String(v))) {
          td.appendChild(personBtn(c.person(r)));
          td.firstChild.textContent = txt;
        } else if (c.chip) {
          td.appendChild(el('span', 'chip ' + c.chip(v, r), txt));
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
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    }
    if (list.length > max) {
      const tr = el('tr');
      const td = el('td', 'os-empty', `Showing ${max} of ${list.length}. Search to narrow it down.`);
      td.colSpan = cols.length;
      tr.appendChild(td);
      frag.appendChild(tr);
    }
    tbody.replaceChildren(frag);
  };

  // list renderer: render(rows) returns an array of <li>
  const list = (ul, ids, rows, render, opts = {}) => {
    const s = state(...ids);
    if (stateMessage(ul, s, 1, opts.connect)) return;
    const items = rows();
    if (!items.length) { message(ul, 'empty', opts.empty || 'Nothing here right now.'); return; }
    ul.replaceChildren(...render(items));
  };

  // tooltip in a chart box
  const tip = (box) => {
    let t = box.querySelector('.os-tip');
    if (!t) { t = el('div', 'os-tip'); t.hidden = true; box.appendChild(t); }
    return {
      show(ev, head, lines) {
        t.replaceChildren(el('div', 'os-tip-h', head));
        for (const [color, label, val] of lines) {
          const row = el('div', 'os-tip-row');
          if (color) { const sw = el('i', 'os-sw'); sw.style.background = color; row.appendChild(sw); }
          row.appendChild(el('span', null, `${label}: ${val}`));
          t.appendChild(row);
        }
        t.hidden = false;
        const b = box.getBoundingClientRect();
        let x = ev.clientX - b.left + 12, y = ev.clientY - b.top + 12;
        const w = t.offsetWidth, hgt = t.offsetHeight;
        if (x + w > b.width) x = Math.max(0, ev.clientX - b.left - w - 12);
        if (y + hgt > b.height) y = Math.max(0, ev.clientY - b.top - hgt - 12);
        t.style.left = x + 'px'; t.style.top = y + 'px';
      },
      hide() { t.hidden = true; },
    };
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

  // vertical stacked bars: rows [{label, tip, ...keys}], keys [{k, name, color}]
  const vbars = (box, rows, keys, fmt, opts = {}) => {
    const W = Math.max(260, box.clientWidth || 600), H = opts.height || 240;
    d3.select(box).selectAll('svg').remove();
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const totals = rows.map((r) => keys.reduce((s, k) => s + Math.max(0, +r[k.k] || 0), 0));
    const y = d3.scaleLinear([0, d3.max(totals) || 1], [H - 24, 8]).nice();
    const ticks = y.ticks(4);
    const lw = textWidth(svg, ticks.map(fmt)) + 8;
    const x = d3.scaleBand(rows.map((r) => r.label), [lw, W - 4]).padding(0.25);
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('x1', lw).attr('x2', W - 4).attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', 'var(--cds-chart-grid)').attr('stroke-width', 1);
    svg.append('g').selectAll('text').data(ticks).join('text')
      .attr('x', lw - 6).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', 'var(--color-fg-muted)').attr('font-size', 'var(--cds-font-size-caption)').text(fmt);
    const labelW = textWidth(svg, rows.map((r) => r.label)) + 10;
    const every = Math.max(1, Math.ceil(labelW / Math.max(1, x.step())));
    svg.append('g').selectAll('text').data(rows).join('text')
      .attr('x', (d) => x(d.label) + x.bandwidth() / 2).attr('y', H - 6).attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-fg-muted)').attr('font-size', 'var(--cds-font-size-caption)')
      .text((d, i) => ((rows.length - 1 - i) % every === 0 ? d.label : ''));
    const tt = tip(box);
    const bw = Math.min(32, x.bandwidth());
    const g = svg.append('g');
    rows.forEach((r) => {
      let acc = 0;
      const gx = x(r.label) + (x.bandwidth() - bw) / 2;
      keys.forEach((k) => {
        const v = Math.max(0, +r[k.k] || 0);
        if (!v) return;
        g.append('rect').attr('x', gx).attr('width', bw).attr('y', y(acc + v)).attr('height', Math.max(0, y(acc) - y(acc + v)))
          .attr('fill', k.color).attr('rx', 2);
        acc += v;
      });
      g.append('rect').attr('x', x(r.label)).attr('width', x.bandwidth()).attr('y', 0).attr('height', H - 24).attr('fill', 'transparent')
        .on('mousemove', (ev) => tt.show(ev, r.tip || r.label, keys.map((k) => [k.color, k.name, fmt(+r[k.k] || 0)])))
        .on('mouseleave', () => tt.hide());
    });
    svg.append('line').attr('x1', lw).attr('x2', W - 4).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--cds-chart-axis)');
  };

  // horizontal stacked bars: rows [{label, ...keys}]
  const hbars = (box, rows, keys, fmt) => {
    const W = Math.max(260, box.clientWidth || 600);
    const rowH = 26, top = 4, bottom = 22;
    const H = top + bottom + Math.max(1, rows.length) * rowH;
    d3.select(box).selectAll('svg').remove();
    box.style.minHeight = H + 'px';
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const lw = Math.min(W * 0.38, textWidth(svg, rows.map((r) => r.label)) + 10);
    const totals = rows.map((r) => keys.reduce((s, k) => s + Math.max(0, +r[k.k] || 0), 0));
    const endW = textWidth(svg, totals.map(fmt)) + 8;
    const x = d3.scaleLinear([0, d3.max(totals) || 1], [lw, W - endW]).nice();
    const y = d3.scaleBand(rows.map((r) => r.label), [top, H - bottom]).padding(0.25);
    const ticks = x.ticks(Math.max(2, Math.floor((W - lw) / 110)));
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', top).attr('y2', H - bottom)
      .attr('stroke', 'var(--cds-chart-grid)');
    svg.append('g').selectAll('text').data(ticks).join('text')
      .attr('x', (d) => x(d)).attr('y', H - 6).attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-fg-muted)').attr('font-size', 'var(--cds-font-size-caption)').text(fmt);
    const tt = tip(box);
    const bh = Math.min(18, y.bandwidth());
    rows.forEach((r, i) => {
      const gy = y(r.label) + (y.bandwidth() - bh) / 2;
      svg.append('text').attr('x', lw - 8).attr('y', gy + bh / 2).attr('dy', '0.32em').attr('text-anchor', 'end')
        .attr('fill', 'var(--color-fg)').attr('font-size', 'var(--cds-font-size-caption)').text(r.label);
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
      svg.append('rect').attr('x', 0).attr('width', W).attr('y', y(r.label)).attr('height', y.bandwidth()).attr('fill', 'transparent')
        .on('mousemove', (ev) => tt.show(ev, r.label, keys.map((k) => [k.color, k.name, fmt(+r[k.k] || 0)]).concat([[null, 'Total', fmt(totals[i])]])))
        .on('mouseleave', () => tt.hide());
    });
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', top).attr('y2', H - bottom).attr('stroke', 'var(--cds-chart-axis)');
  };

  // chart box state handling
  const chart = (box, ids, draw, emptyText) => {
    const s = state(...ids);
    box.classList.toggle('dash-skeleton', s === 'loading');
    if (s === 'loading') { box.replaceChildren(); return; }
    if (s === 'error' || s === 'connect') { box.replaceChildren(el('div', 'os-fail', s === 'connect' ? 'Connect this source to see it' : 'Failed to load')); return; }
    box.querySelectorAll('.os-fail, .os-empty').forEach((n) => n.remove());
    if (draw() === false) {
      d3.select(box).selectAll('svg').remove();
      box.style.minHeight = '';
      box.appendChild(el('div', 'os-empty', emptyText || 'Nothing to chart for this filter.'));
    }
  };

  return { usd, num, pct, day, shortDay, region, sorts, queries, state, value, el, personBtn, icon, ICON, message, table, list, chart, vbars, hbars, searchFilter };
})();

// ---------- App shell ----------
(() => {
  const SCREENS = ['home', 'actions', 'pipeline', 'created', 'hiring', 'routing', 'books'];
  const view = { actions: 'meetings', pipeline: 'teams', created: 'trend', hiring: 'joiners', routing: 'people', books: 'reps' };
  let screen = SCREENS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';

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
    document.querySelectorAll('.app').forEach((a) => a.classList.toggle('has-detail', !!person));
    document.querySelectorAll('[data-detail]').forEach((d) => { d.hidden = !person; });
  };

  const go = (s, v) => {
    if (!SCREENS.includes(s)) return;
    screen = s;
    if (v && view[s]) view[s] = v;
    apply();
    dash.setLink(s);
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
    if (p.gr_since !== want.gr_since || p.gr_until !== want.gr_until || +p.grWindow !== n) dash.setParams(want);
  })();

  // copy to clipboard with a short status
  let toastTimer = null;
  const toast = (ok) => {
    document.querySelectorAll('[data-toast]').forEach((t) => { t.hidden = t.dataset.toast !== (ok ? 'ok' : 'fail'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => document.querySelectorAll('[data-toast]').forEach((t) => { t.hidden = true; }), 2200);
  };
  const copy = (text, btn) => {
    const done = (ok) => {
      toast(ok);
      if (btn && ok) { btn.classList.add('is-copied'); setTimeout(() => btn.classList.remove('is-copied'), 1500); }
    };
    try {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    } catch (e) { done(false); }
  };
  const checklist = () => {
    const own = dash.params().grOwner || 'all';
    const rows = OS.searchFilter('act-list', (dash.data('gr_actions').data || [])
      .filter((r) => !r.done && (own === 'all' || r.bucket === own)), ['item', 'detail', 'owner', 'meeting']);
    return rows.map((r) => `- [ ] ${r.item}${r.owner ? ' (' + r.owner + ')' : ''}: ${r.meeting}, ${OS.shortDay(r.date)}`).join('\n');
  };

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-nav], [data-view-tab], [data-person], [data-close-person], [data-copy-text], [data-copy-list], [data-copy-person-id], [data-pq], [data-crm], [data-gr-window], [data-gr-owner], [data-check-area], th[data-sort]');
    if (!t) return;
    if (t.matches('[data-nav]')) { go(t.dataset.nav, t.dataset.navView); return; }
    if (t.matches('[data-view-tab]')) { const [s, v] = t.dataset.viewTab.split(':'); view[s] = v; apply(); return; }
    if (t.matches('[data-person]')) { dash.setParams({ person: t.dataset.person }); return; }
    if (t.matches('[data-close-person]')) { dash.setParams({ person: '' }); return; }
    if (t.matches('[data-copy-text]')) { copy(t.dataset.copyText, t); return; }
    if (t.matches('[data-copy-list]')) { copy(checklist() || '', t); return; }
    if (t.matches('[data-copy-person-id]')) {
      const p = dash.params().person;
      const row = (dash.data('person').data || []).find((r) => r.name === p);
      if (row && row.userId) copy(row.userId, t); else toast(false);
      return;
    }
    if (t.matches('[data-pq]')) { dash.setParams({ pq: t.dataset.pq }); return; }
    if (t.matches('[data-crm]')) { dash.setParams({ crm: t.dataset.crm }); return; }
    if (t.matches('[data-gr-window]')) { dash.setParams(windowParams(+t.dataset.grWindow)); return; }
    if (t.matches('[data-gr-owner]')) { dash.setParams({ grOwner: t.dataset.grOwner }); return; }
    if (t.matches('[data-check-area]')) { dash.setParams({ checkArea: t.dataset.checkArea }); return; }
    if (t.matches('th[data-sort]')) {
      const tbl = t.closest('table[data-sortable]');
      if (!tbl) return;
      const name = tbl.dataset.sortable;
      const cur = OS.sorts[name];
      const dir = cur && cur.f === t.dataset.sort && cur.dir === 'descending' ? 'ascending' : 'descending';
      OS.sorts[name] = { f: t.dataset.sort, dir };
      tbl.querySelectorAll('th[data-sort]').forEach((h) => h.removeAttribute('aria-sort'));
      t.setAttribute('aria-sort', dir);
      dash.draw(name);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dash.params().person) dash.setParams({ person: '' });
  });
  document.querySelectorAll('.os-region').forEach((sel) => sel.addEventListener('change', () => dash.setParams({ region: sel.value || 'All' })));
  document.querySelectorAll('.os-only-missing').forEach((c) => c.addEventListener('change', () => dash.setParams({ onlyMissing: c.checked })));
  document.querySelectorAll('.os-orphan-reason').forEach((s) => s.addEventListener('change', () => dash.setParams({ orphanReason: s.value })));
  document.querySelectorAll('input[data-search]').forEach((inp) => inp.addEventListener('input', () => {
    OS.queries[inp.dataset.search] = inp.value;
    dash.draw(inp.dataset.search);
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
    pressed('[data-gr-owner]', 'grOwner', p.grOwner || 'all');
    pressed('[data-check-area]', 'checkArea', p.checkArea || 'All');
    document.querySelectorAll('.os-region').forEach((sel) => { sel.value = p.region || 'All'; });
    document.querySelectorAll('.os-only-missing').forEach((c) => { c.checked = !!p.onlyMissing; });
    document.querySelectorAll('.os-orphan-reason').forEach((s) => { s.value = p.orphanReason || ''; });
    document.querySelectorAll('.os-sw[data-color]').forEach((sw) => { sw.style.background = dash.colors[+sw.dataset.color]; });
    document.querySelectorAll('.app').forEach((a) => a.style.setProperty('--app-accent', dash.colors[0]));
  });
})();
