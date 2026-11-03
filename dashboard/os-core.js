// EMEA RevOps OS — shared helpers, loaders, tabs and filters.
// Text a reader sees outside drawings lives in index.html; this file only listens and sets
// hidden / aria-* / style / value, and defines helpers the drawings use.

// ---------- Loaders: Salesforce answers {totalSize, done, records:[{attributes, ...}]} become rows ----------
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

// ---------- Helpers for drawings ----------
window.OS = (() => {
  const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  const usd = (v) => (v == null || Number.isNaN(+v) ? '—' : (v < 0 ? '−$' : '$') + compact.format(Math.abs(+v)));
  const num = (v) => (v == null || Number.isNaN(+v) ? '—' : d3.format(',')(Math.round(+v)));
  const pct = (v) => (v == null || Number.isNaN(+v) ? '—' : d3.format('.0%')(+v));
  const day = (v) => (v ? d3.utcFormat('%-d %b %Y')(new Date(String(v).slice(0, 10) + 'T00:00:00Z')) : '—');
  const region = () => (dash.params().region || 'All');
  const sorts = {};
  const queries = {};

  // status of several sources: 'ok' | 'error' | 'loading'
  const state = (...ids) => {
    let s = 'ok';
    for (const id of ids) {
      const st = dash.data(id).status;
      if (st === 'error' || st === 'connect' || st === 'declined' || st === 'missing') return 'error';
      if (st !== 'ok') s = 'loading';
    }
    return s;
  };

  // a value element: show skeleton while loading, a dash on error
  const value = (el, ids, text) => {
    const s = state(...ids);
    el.classList.toggle('dash-skeleton', s === 'loading');
    el.textContent = s === 'ok' ? text() : '—';
  };

  const failLine = (el) => {
    const d = document.createElement('div');
    d.className = 'os-fail';
    d.textContent = 'Failed to load';
    el.replaceChildren(d);
  };

  // tbody renderer. cols: [{f, fmt?, num?, bar?: max, chip?: (v,row)=>cls, wrap?}]
  const table = (tbody, ids, rows, cols, opts = {}) => {
    const s = state(...ids);
    const span = cols.length;
    const msgRow = (txt, cls) => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = span;
      if (cls) td.className = cls;
      td.textContent = txt;
      tr.appendChild(td);
      tbody.replaceChildren(tr);
    };
    if (s === 'loading') { msgRow(''); tbody.firstChild.firstChild.classList.add('dash-skeleton'); return; }
    if (s === 'error') { msgRow('Failed to load', 'os-fail'); return; }
    let list = rows();
    const name = tbody.dataset.draw;
    const q = (queries[name] || '').trim().toLowerCase();
    if (q) list = list.filter((r) => cols.some((c) => String(r[c.f] ?? '').toLowerCase().includes(q)));
    const st = sorts[name];
    if (st) {
      list = list.slice().sort((a, b) => {
        const x = a[st.f], y = b[st.f];
        const r = (typeof x === 'number' || typeof y === 'number') ? (+x || 0) - (+y || 0) : String(x ?? '').localeCompare(String(y ?? ''));
        return st.dir === 'ascending' ? r : -r;
      });
    }
    if (!list.length) { msgRow(opts.empty || 'Nothing to show for this filter.', 'os-note'); return; }
    const max = opts.limit || 400;
    const frag = document.createDocumentFragment();
    for (const r of list.slice(0, max)) {
      const tr = document.createElement('tr');
      tr.dataset.key = r[opts.key];
      if (r._cls) tr.className = r._cls;
      for (const c of cols) {
        const td = document.createElement('td');
        const v = r[c.f];
        if (c.num) td.className = 'num';
        if (c.wrap) td.className = 'wrap';
        const txt = c.fmt ? c.fmt(v, r) : (v == null || v === '' ? '—' : String(v));
        if (c.chip) {
          const sp = document.createElement('span');
          sp.className = 'os-chip ' + c.chip(v, r);
          sp.textContent = txt;
          td.appendChild(sp);
        } else if (c.bar) {
          const wrap = document.createElement('div');
          wrap.className = 'os-bar-cell';
          const i = document.createElement('i');
          const m = c.bar(list);
          i.style.width = (m > 0 ? Math.max(0, Math.min(1, (+v || 0) / m)) * 48 : 0) + 'px';
          i.style.setProperty('--os-accent', dash.colors[0]);
          const sp = document.createElement('span');
          sp.textContent = txt;
          wrap.append(i, sp);
          td.appendChild(wrap);
        } else {
          td.textContent = txt;
          if (c.cls) { const k = c.cls(v, r); if (k) td.classList.add(k); }
        }
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    }
    if (list.length > max) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = span;
      td.className = 'os-note';
      td.textContent = `Showing ${max} of ${list.length}. Search to narrow it down.`;
      tr.appendChild(td);
      frag.appendChild(tr);
    }
    tbody.replaceChildren(frag);
  };

  // tooltip in a chart box
  const tip = (box) => {
    let t = box.querySelector('.os-tip');
    if (!t) { t = document.createElement('div'); t.className = 'os-tip'; t.hidden = true; box.appendChild(t); }
    return {
      show(ev, head, lines) {
        t.replaceChildren();
        const h = document.createElement('div'); h.className = 'os-tip-h'; h.textContent = head; t.appendChild(h);
        for (const [color, label, val] of lines) {
          const row = document.createElement('div'); row.className = 'os-tip-row';
          if (color) { const sw = document.createElement('i'); sw.className = 'os-sw'; sw.style.background = color; row.appendChild(sw); }
          const s = document.createElement('span'); s.textContent = `${label}: ${val}`; row.appendChild(s);
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

  const textWidth = (svg, strings, cls) => {
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
  const vbars = (box, rows, keys, fmt) => {
    const W = Math.max(280, box.clientWidth || 600), H = 240;
    d3.select(box).selectAll('svg').remove();
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const totals = rows.map((r) => keys.reduce((s, k) => s + Math.max(0, +r[k.k] || 0), 0));
    const yMax = d3.max(totals) || 1;
    const y = d3.scaleLinear([0, yMax], [H - 24, 8]).nice();
    const ticks = y.ticks(4);
    const lw = textWidth(svg, ticks.map(fmt)) + 8;
    const x = d3.scaleBand(rows.map((r) => r.label), [lw, W - 4]).padding(0.25);
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('x1', lw).attr('x2', W - 4).attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', 'var(--cds-chart-grid)').attr('stroke-width', 1);
    svg.append('g').selectAll('text').data(ticks).join('text')
      .attr('x', lw - 6).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('fill', 'var(--color-fg-muted)').attr('font-size', 'var(--cds-font-size-caption)').text(fmt);
    const every = Math.max(1, Math.ceil(rows.length / Math.floor((W - lw) / 46)));
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
    const W = Math.max(280, box.clientWidth || 600);
    const rowH = 26, top = 4, bottom = 22;
    const H = top + bottom + rows.length * rowH;
    d3.select(box).selectAll('svg').remove();
    box.style.minHeight = H + 'px';
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const lw = Math.min(W * 0.4, textWidth(svg, rows.map((r) => r.label)) + 10);
    const totals = rows.map((r) => keys.reduce((s, k) => s + Math.max(0, +r[k.k] || 0), 0));
    const endW = textWidth(svg, totals.map(fmt)) + 8;
    const xMax = d3.max(totals) || 1;
    const x = d3.scaleLinear([0, xMax], [lw, W - endW]).nice();
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
  const chart = (box, ids, draw) => {
    const s = state(...ids);
    box.classList.toggle('dash-skeleton', s === 'loading');
    if (s === 'error') { failLine(box); return; }
    if (s === 'loading') { box.replaceChildren(); return; }
    box.querySelectorAll('.os-fail').forEach((n) => n.remove());
    draw();
  };

  return { usd, num, pct, day, region, sorts, queries, state, value, table, chart, vbars, hbars };
})();

// ---------- Tabs ----------
(() => {
  const TABS = ['pipeline', 'created', 'hiring', 'routing', 'books'];
  let current = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'pipeline';
  const show = () => {
    document.querySelectorAll('[data-page]').forEach((s) => { s.hidden = s.dataset.page !== current; });
    document.querySelectorAll('.os-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === current)));
  };
  document.querySelectorAll('.os-tab').forEach((b) => b.addEventListener('click', () => {
    current = b.dataset.tab;
    show();
    dash.setLink(current);
  }));
  show();
  dash.onData(show);
})();

// ---------- Filters and toggles (none of these re-run a query) ----------
(() => {
  document.querySelectorAll('.os-region').forEach((sel) => sel.addEventListener('change', () => dash.setParams({ region: sel.value || 'All' })));
  document.querySelectorAll('[data-pq]').forEach((b) => b.addEventListener('click', () => dash.setParams({ pq: b.dataset.pq })));
  document.querySelectorAll('[data-crm]').forEach((b) => b.addEventListener('click', () => dash.setParams({ crm: b.dataset.crm })));
  document.querySelectorAll('.os-only-missing').forEach((c) => c.addEventListener('change', () => dash.setParams({ onlyMissing: c.checked })));
  document.querySelectorAll('.os-orphan-reason').forEach((s) => s.addEventListener('change', () => dash.setParams({ orphanReason: s.value })));
  document.querySelectorAll('input[data-search]').forEach((inp) => inp.addEventListener('input', () => {
    OS.queries[inp.dataset.search] = inp.value;
    dash.draw(inp.dataset.search);
  }));
  document.querySelectorAll('table[data-sortable]').forEach((tbl) => {
    const name = tbl.dataset.sortable;
    const init = tbl.querySelector('th[aria-sort]');
    if (init) OS.sorts[name] = { f: init.dataset.sort, dir: init.getAttribute('aria-sort') };
    tbl.querySelectorAll('th[data-sort]').forEach((th) => th.addEventListener('click', () => {
      const cur = OS.sorts[name];
      const dir = cur && cur.f === th.dataset.sort && cur.dir === 'descending' ? 'ascending' : 'descending';
      OS.sorts[name] = { f: th.dataset.sort, dir };
      tbl.querySelectorAll('th[data-sort]').forEach((h) => h.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', dir);
      dash.draw(name);
    }));
  });
  dash.onData(() => {
    const p = dash.params();
    document.querySelectorAll('.os-region').forEach((sel) => { sel.value = p.region || 'All'; });
    document.querySelectorAll('[data-pq]').forEach((b) => b.setAttribute('aria-pressed', String((p.pq || 'this') === b.dataset.pq)));
    document.querySelectorAll('[data-crm]').forEach((b) => b.setAttribute('aria-pressed', String((p.crm || 'opps') === b.dataset.crm)));
    document.querySelectorAll('.os-only-missing').forEach((c) => { c.checked = !!p.onlyMissing; });
    document.querySelectorAll('.os-orphan-reason').forEach((s) => { s.value = p.orphanReason || ''; });
    document.querySelectorAll('.os-sw[data-color]').forEach((sw) => { sw.style.background = dash.colors[+sw.dataset.color]; });
  });
})();
