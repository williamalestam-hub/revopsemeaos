// EMEA RevOps OS — drawings. A drawing reads only its own data, and only while it is shown.

const mgrPick = () => dash.params().mgr || '';
const inTeam = (r) => (mgrPick() ? r.manager === mgrPick() : OS.region() === 'All' || r.region === OS.region());
const setWhere = (el, key, val) => { el.dataset.where = key + '=' + encodeURIComponent(val); };
const scopeKey = () => (mgrPick() ? 'M|' + mgrPick() : OS.region());
const regionRow = (el, id) => {
  const key = scopeKey();
  const rows = dash.data(id).data || [];
  const row = rows.find((r) => r.region === key);
  if (row) { setWhere(el, 'region', key); return row; }
  setWhere(el, 'region', 'All');
  return mgrPick() ? {} : rows.find((r) => r.region === 'All') || {};
};
const firstRow = (id) => (dash.data(id).data || [])[0] || {};
const statusCls = (v) => (/^In routing$/.test(v) ? 'ok'
  : /Overdue|Missing|^No Salesforce/.test(v) ? 'bad'
  : /week 2|next week|Week 1|none assigned|New joiner|Not started/i.test(v) ? 'warn' : '');
const ago = (n) => (n == null ? '' : n === 0 ? 'today' : n + 'd ago');
const monthLabel = (m, i) => d3.utcFormat(i === 0 || m.endsWith('-01') ? "%b '%y" : '%b')(new Date(m + '-01T00:00:00Z'));

// ===================== NAV BADGES =====================
dash.draw('nav-badge', (el) => {
  const id = el.dataset.source;
  if (OS.state(id) !== 'ok') { el.classList.remove('is-on'); el.textContent = '—'; return; }
  const row = el.hasAttribute('data-by-region') ? regionRow(el, id) : firstRow(id);
  const n = +row[el.dataset.f] || 0;
  el.dataset.field = el.dataset.f;
  el.textContent = OS.num(n);
  el.classList.toggle('is-on', n > 0);
});

// ===================== PIPELINE =====================
const pipeRow = (el) => {
  const region = OS.region();
  const key = mgrPick() ? 'M|' + mgrPick() : region === 'All' ? 'All|All' : region + '|All';
  const row = (dash.data('pipe_team').data || []).find((r) => r.key === key);
  setWhere(el, 'key', row ? key : 'All|All');
  return row || {};
};
dash.draw('kpi-pipe', (el) => OS.value(el, ['pipe_team'], () => OS.usd(pipeRow(el)[el.dataset.field] || 0)));
dash.draw('kpi-pipe-sub', (el) => OS.value(el, ['pipe_team'], () => OS.num(pipeRow(el)[el.dataset.field] || 0)));

const stageKeys = () => [
  { k: 'late', name: 'Late (4–6)', color: dash.colors[0] },
  { k: 'mid', name: 'Mid (2–3)', color: dash.colors[1] },
  { k: 'early', name: 'Early (0–1)', color: dash.colors[2] },
];
const pipeBars = (pq) => {
  const region = OS.region();
  if (mgrPick()) {
    return (dash.data('pipe_reps').data || []).filter((r) => r.manager === mgrPick())
      .map((r) => ({ label: r.owner, pipe: r[pq + 'Pipe'], total: r[pq + 'Pipe'] }))
      .filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  }
  return (dash.data('pipe_team').data || [])
    .filter((r) => (region === 'All' ? r.level === 'region' : r.level === 'team' && r.region === region))
    .map((r) => ({ label: region === 'All' ? r.region : r.manager, early: r[pq + 'Early'], mid: r[pq + 'Mid'], late: r[pq + 'Late'], total: r[pq + 'Pipe'] }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
};
const pipeKeys = () => (mgrPick() ? [{ k: 'pipe', name: 'Open pipeline', color: dash.colors[0] }] : stageKeys());
OS.defChart('pipe-chart', () => (mgrPick() ? ['pipe_reps'] : ['pipe_team']), () => pipeBars(dash.params().pq === 'next' ? 'next' : 'this'), (box, rows) => OS.hbars(box, rows, pipeKeys(), OS.usd));
OS.defChart('home-pipe-chart', () => (mgrPick() ? ['pipe_reps'] : ['pipe_team']), () => pipeBars('this').slice(0, 10), (box, rows) => OS.hbars(box, rows, pipeKeys(), OS.usd));

OS.defTable('pipe-mgr-table', ['pipe_team'], () => (dash.data('pipe_team').data || [])
  .filter((r) => r.level === 'team' && inTeam(r))
  .sort((a, b) => b.thisPipe - a.thisPipe), [
  { f: 'manager', person: (r) => r.manager },
  { f: 'region' },
  { f: 'thisPipe', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.thisPipe) },
  { f: 'thisCommit', fmt: OS.usd, num: true }, { f: 'thisBest', fmt: OS.usd, num: true },
  { f: 'won', fmt: OS.usd, num: true }, { f: 'nextPipe', fmt: OS.usd, num: true },
  { f: 'renewThis', fmt: OS.usd, num: true },
], { key: 'key' });

OS.defTable('pipe-rep-table', ['pipe_reps'], () => (dash.data('pipe_reps').data || []).filter(inTeam), [
  { f: 'owner', person: (r) => r.owner }, { f: 'region' }, { f: 'manager' },
  { f: 'thisPipe', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.thisPipe) },
  { f: 'thisOpps', fmt: OS.num, num: true }, { f: 'nextPipe', fmt: OS.usd, num: true },
  { f: 'pastDue', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-bad' : '') },
  { f: 'stale', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
], { key: 'owner' });

// ===================== CREATED =====================
dash.draw('kpi-cr-count', (el) => OS.value(el, ['cr_kpi'], () => OS.num(firstRow('cr_kpi')[el.dataset.field] || 0)));
dash.draw('kpi-cr-usd', (el) => OS.value(el, ['cr_kpi'], () => OS.usd(firstRow('cr_kpi')[el.dataset.field] || 0)));
dash.draw('kpi-cr-pct', (el) => OS.value(el, ['cr_kpi'], () => OS.pct(firstRow('cr_kpi')[el.dataset.field])));

const typeKeys = (arr) => [
  { k: arr ? 'nbArr' : 'nb', name: 'New Business', color: dash.colors[0] },
  { k: arr ? 'upArr' : 'up', name: 'Upsell', color: dash.colors[1] },
  { k: arr ? 'rnArr' : 'rn', name: 'Renewal (manual)', color: dash.colors[3] },
];
const weekRows = () => (dash.data('cr_weeks').data || []).map((w) => ({ ...w, key: w.week, label: d3.utcFormat('%b %-d')(new Date(w.week + 'T00:00:00Z')), tip: 'Week of ' + d3.utcFormat('%-d %b %Y')(new Date(w.week + 'T00:00:00Z')) }));
const isArr = () => dash.params().crm === 'arr';
OS.defChart('cr-week-chart', ['cr_weeks'], weekRows, (box, rows) => OS.vbars(box, rows, typeKeys(isArr()), isArr() ? OS.usd : OS.num));
OS.defChart('home-week-chart', ['cr_weeks'], weekRows, (box, rows) => OS.vbars(box, rows, typeKeys(false), OS.num, { height: 180 }));
OS.defChart('cr-month-chart', ['cr_months'], () => (dash.data('cr_months').data || []).map((m, i) => ({ ...m, key: m.month, label: monthLabel(m.month, i), tip: d3.utcFormat('%B %Y')(new Date(m.month + '-01T00:00:00Z')) })),
  (box, rows) => OS.vbars(box, rows, typeKeys(isArr()), isArr() ? OS.usd : OS.num));

OS.defTable('cr-mix-table', ['cr_mix'], () => (dash.data('cr_mix').data || []).map((r) => ({ ...r, _cls: r.source === 'Total' ? 'os-total' : '' })), [
  { f: 'source' }, { f: 'thisOpps', fmt: OS.num, num: true }, { f: 'thisArr', fmt: OS.usd, num: true },
  { f: 'lastOpps', fmt: OS.num, num: true }, { f: 'lastArr', fmt: OS.usd, num: true },
], { key: 'source' });

OS.defTable('cr-bdr-table', ['cr_bdrs'], () => dash.data('cr_bdrs').data || [], [
  { f: 'bdr', person: (r) => r.bdr }, { f: 'manager' },
  { f: 'thisOpps', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.thisOpps) },
  { f: 'thisArr', fmt: OS.usd, num: true }, { f: 'lastOpps', fmt: OS.num, num: true },
], { key: 'bdr' });

OS.defTable('cr-rep-table', ['cr_leader'], () => (dash.data('cr_leader').data || []).filter(inTeam), [
  { f: 'owner', person: (r) => r.owner }, { f: 'region' }, { f: 'manager' },
  { f: 'nb', fmt: OS.num, num: true }, { f: 'up', fmt: OS.num, num: true },
  { f: 'arr', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.arr) },
  { f: 'bdrSourced', fmt: OS.num, num: true },
], { key: 'owner' });

// ===================== ACTION ITEMS =====================
dash.draw('kpi-gr', (el) => OS.value(el, ['gr_kpi'], () => OS.num(firstRow('gr_kpi')[el.dataset.field] || 0)));
dash.draw('kpi-checks', (el) => OS.value(el, ['checks_kpi'], () => OS.num(regionRow(el, 'checks_kpi')[el.dataset.field] || 0)));
dash.draw('kpi-checks-hb', (el) => OS.value(el, ['checks_hb_kpi'], () => OS.num(regionRow(el, 'checks_hb_kpi')[el.dataset.field] || 0)));

const ownerChip = (r) => OS.el('span', 'chip' + (r.bucket === 'mine' ? ' info' : r.bucket === 'unassigned' ? ' warn' : ''), r.owner || 'Unassigned');
const actionItem = (r, byOwner) => {
  const li = OS.el('li', 'itm');
  li.dataset.key = r.id;
  const main = OS.el('div', 'itm-main');
  main.append(OS.el('span', 'itm-title', r.item));
  if (r.detail) main.append(OS.el('span', 'itm-detail', r.detail));
  if (byOwner) {
    const from = OS.el('span', 'itm-from', r.meeting + ' · ' + OS.shortDay(r.date));
    if (r.url && /^https:\/\//.test(r.url)) {
      const a = OS.el('a');
      a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', 'Open the note in Granola');
      a.appendChild(OS.icon(OS.ICON.open));
      from.append(a);
    }
    main.append(from);
  }
  const meta = OS.el('div', 'itm-meta');
  if (!byOwner) meta.append(ownerChip(r));
  if (r.ageDays != null && r.ageDays >= 14) meta.append(OS.el('span', 'chip warn', Math.floor(r.ageDays / 7) + 'w old'));
  else meta.append(OS.el('span', null, ago(r.ageDays)));
  const cp = OS.el('button', 'ibtn');
  cp.type = 'button';
  cp.setAttribute('aria-label', 'Copy item');
  cp.dataset.copyText = `${r.item}${r.owner ? ' (' + r.owner + ')' : ''}: ${r.meeting}, ${OS.shortDay(r.date)}`;
  cp.appendChild(OS.icon(OS.ICON.copy));
  meta.append(cp);
  li.append(OS.el('span', 'itm-dot ' + r.bucket), main, meta);
  return li;
};
const meetingHead = (r) => {
  const li = OS.el('li', 'grp');
  li.append(OS.el('b', null, r.meeting), OS.el('span', null, OS.day(r.date)));
  if (r.shared) li.append(OS.el('span', 'chip', 'Shared note'));
  if (r.url && /^https:\/\//.test(r.url)) {
    const a = OS.el('a');
    a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'Open the note in Granola');
    a.appendChild(OS.icon(OS.ICON.open));
    li.append(a);
  }
  return li;
};
const groupedActions = (rows) => {
  const out = [];
  if ((dash.params().grGroup || 'meeting') === 'owner') {
    const order = (r) => (r.bucket === 'mine' ? 0 : r.bucket === 'others' ? 1 : 2);
    const sorted = rows.slice().sort((a, b) => order(a) - order(b) || String(a.owner || '').localeCompare(String(b.owner || '')) || String(b.meetingAt || '').localeCompare(String(a.meetingAt || '')));
    let last = null;
    for (const r of sorted) {
      const who = r.bucket === 'mine' ? 'You' : r.owner || 'Unassigned';
      if (who !== last) {
        const li = OS.el('li', 'grp');
        li.append(OS.el('b', null, who), OS.el('span', null, String(sorted.filter((x) => (x.bucket === 'mine' ? 'You' : x.owner || 'Unassigned') === who).length)));
        out.push(li);
        last = who;
      }
      out.push(actionItem(r, true));
    }
    return out;
  }
  let last = null;
  for (const r of rows) {
    if (r.meetingId !== last) { out.push(meetingHead(r)); last = r.meetingId; }
    out.push(actionItem(r, false));
  }
  return out;
};
OS.defList('act-list', ['gr_actions'], () => {
  const own = dash.params().grOwner || 'all';
  const one = !!dash.params().gr11;
  return (dash.data('gr_actions').data || []).filter((r) => !r.done && (!one || r.oneOnOne) && (own === 'all' || (own === 'foryou' ? r.forYou : r.bucket === own)));
}, groupedActions, { fields: ['item', 'detail', 'owner', 'meeting'] });
OS.defList('home-actions', ['gr_actions'], () => (dash.data('gr_actions').data || []).filter((r) => r.forYou).slice(0, 6), (rows) => {
  const out = [];
  let last = null;
  for (const r of rows) {
    if (r.meetingId !== last) { out.push(meetingHead(r)); last = r.meetingId; }
    out.push(actionItem(r, false));
  }
  return out;
});

const checkItem = (c) => {
  const li = OS.el('li', 'itm');
  li.dataset.key = c.id;
  const main = OS.el('div', 'itm-main');
  const title = OS.el('span', 'itm-title');
  title.append(c.person ? OS.personBtn(c.person) : document.createTextNode(c.title));
  main.append(title, OS.el('span', 'itm-detail', c.what + (c.meta ? ' · ' + c.meta : '')));
  const meta = OS.el('div', 'itm-meta');
  meta.append(OS.el('span', 'chip', c.area));
  const go = OS.el('button', 'ibtn');
  go.type = 'button';
  go.setAttribute('aria-label', 'Go to ' + c.area);
  go.dataset.nav = c.screen;
  if (c.screen === 'books') go.dataset.navView = c.reason ? 'orphans' : 'books';
  if (c.screen === 'routing') go.dataset.navView = c.person ? 'people' : 'pools';
  if (c.screen === 'pipeline') go.dataset.navView = 'reps';
  if (c.screen === 'hiring') go.dataset.navView = 'joiners';
  go.appendChild(OS.icon(OS.ICON.go));
  meta.append(go);
  li.append(OS.el('span', 'itm-dot ' + c.severity), main, meta);
  return li;
};
// Salesforce and LeanData checks always; HiBob checks join them once HiBob has loaded
const allChecks = () => {
  const rank = { high: 0, medium: 1, low: 2 };
  const hb = OS.state('checks_hb') === 'ok' ? dash.data('checks_hb').data || [] : [];
  return (dash.data('checks').data || []).concat(hb)
    .filter((c) => (mgrPick() ? c.manager === mgrPick() : OS.region() === 'All' || c.region === OS.region()))
    .sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.area).localeCompare(String(b.area)) || String(a.title).localeCompare(String(b.title)));
};
OS.defList('check-list', () => ((dash.params().checkArea || 'All') === 'Hiring' ? ['checks_hb'] : ['checks']), () => {
  const area = dash.params().checkArea || 'All';
  return allChecks().filter((c) => area === 'All' || c.area === area);
}, (rows) => rows.map(checkItem));
OS.defList('home-checks', ['checks'], () => allChecks().slice(0, 7), (rows) => rows.map(checkItem));

// ===================== HIRING =====================
dash.draw('kpi-hire', (el) => OS.value(el, ['hire_kpi'], () => OS.num(regionRow(el, 'hire_kpi')[el.dataset.field] || 0)));

OS.defTable('hire-table', ['people'], () => (dash.data('people').data || [])
  .filter((p) => p.daysIn != null && p.daysIn <= 90 && inTeam(p))
  .sort((a, b) => a.daysIn - b.daysIn), [
  { f: 'name', person: (r) => r.sfName || r.name }, { f: 'title' }, { f: 'team' }, { f: 'site' }, { f: 'manager' },
  { f: 'startDate', fmt: OS.day }, { f: 'daysIn', fmt: OS.num, num: true },
  { f: 'sfRole' }, { f: 'pools', fmt: OS.num, num: true },
  { f: 'status', chip: statusCls },
], { key: 'id' });

OS.defChart('hire-month-chart', ['hire_months'], () => (dash.data('hire_months').data || []).filter((m) => m.total > 0).length
  ? (dash.data('hire_months').data || []).map((m, i) => ({ ...m, key: m.month, label: monthLabel(m.month, i), tip: d3.utcFormat('%B %Y')(new Date(m.month + '-01T00:00:00Z')) }))
  : [], (box, rows) => OS.vbars(box, rows, [
  { k: 'gtm', name: 'GTM EMEA', color: dash.colors[0] },
  { k: 'eng', name: 'Engagement EMEA', color: dash.colors[1] },
  { k: 'growth', name: 'Growth EMEA', color: dash.colors[2] },
], OS.num));

OS.defTable('hire-team-table', ['hire_teams'], () => dash.data('hire_teams').data || [], [
  { f: 'team' }, { f: 'people', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.people) }, { f: 'joined90', fmt: OS.num, num: true },
], { key: 'team' });

// ===================== ROUTING =====================
dash.draw('kpi-rr', (el) => OS.value(el, ['rr_kpi'], () => OS.num(regionRow(el, 'rr_kpi')[el.dataset.field] || 0)));

OS.defTable('rr-people-table', ['rr_people'], () => {
  const only = !!dash.params().onlyMissing;
  const order = { 'Missing': 0, 'New joiner: overdue': 1, 'New: add next week': 2, 'Not started': 3, 'In routing, none assigned': 4, 'In routing': 5 };
  return (dash.data('rr_people').data || [])
    .filter((p) => inTeam(p) && (!only || !/^In routing/.test(p.status)))
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.name).localeCompare(String(b.name)));
}, [
  { f: 'name', person: (r) => r.name }, { f: 'region' }, { f: 'manager' }, { f: 'createdDate', fmt: OS.day },
  { f: 'pools', fmt: OS.num, num: true }, { f: 'poolNames', wrap: true },
  { f: 'assignments', fmt: OS.num, num: true }, { f: 'status', chip: statusCls },
], { key: 'userId' });

OS.defTable('rr-pool-table', ['rr_pools'], () => {
  const region = OS.region();
  return (dash.data('rr_pools').data || [])
    .filter((p) => (mgrPick() ? p.managers.split('|').includes(mgrPick()) : region === 'All' || p.regions.split('|').includes(region)))
    .sort((a, b) => String(a.pool).localeCompare(String(b.pool)));
}, [
  { f: 'pool' }, { f: 'family' }, { f: 'members', fmt: OS.num, num: true }, { f: 'memberNames', wrap: true },
  { f: 'assignments', fmt: OS.num, num: true }, { f: 'balance' }, { f: 'lastAssigned', fmt: OS.day },
  { f: 'flag', chip: (v) => (v === 'OK' ? 'ok' : v === 'Inactive member' ? 'bad' : 'warn') },
], { key: 'pool' });

// ===================== BOOKS =====================
dash.draw('kpi-bk', (el) => OS.value(el, ['books_kpi'], () => OS.num(regionRow(el, 'books_kpi')[el.dataset.field] || 0)));
dash.draw('kpi-bk-usd', (el) => OS.value(el, ['books_kpi'], () => OS.usd(regionRow(el, 'books_kpi')[el.dataset.field] || 0)));
dash.draw('kpi-orph', (el) => OS.value(el, ['orphan_kpi'], () => OS.num(firstRow('orphan_kpi')[el.dataset.field] || 0)));
dash.draw('kpi-orph-usd', (el) => OS.value(el, ['orphan_kpi'], () => OS.usd(firstRow('orphan_kpi')[el.dataset.field] || 0)));

OS.defTable('bk-owner-table', ['books_owner'], () => (dash.data('books_owner').data || []).filter(inTeam), [
  { f: 'owner', person: (r) => r.owner }, { f: 'region' }, { f: 'manager' },
  { f: 'accounts', fmt: OS.num, num: true }, { f: 'active', fmt: OS.num, num: true },
  { f: 'customers', fmt: OS.num, num: true },
  { f: 'arr', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.arr) },
  { f: 'emCustomers', fmt: OS.num, num: true }, { f: 'openPipe', fmt: OS.usd, num: true },
  { f: 'openRenewals', fmt: OS.num, num: true },
], { key: 'owner' });

OS.defTable('bk-cov-table', ['coverage'], () => (dash.data('coverage').data || []).map((r) => ({ ...r, _cls: r.salesRegion === 'All EMEA regions' ? 'os-total' : '' })), [
  { f: 'salesRegion' }, { f: 'emea', fmt: OS.num, num: true }, { f: 'strategic', fmt: OS.num, num: true },
  { f: 'partners', fmt: OS.num, num: true }, { f: 'otherRegion', fmt: OS.num, num: true },
  { f: 'revops', fmt: OS.num, num: true }, { f: 'unassigned', fmt: OS.num, num: true },
  { f: 'coveredShare', fmt: OS.pct, num: true, cls: (v) => (v != null && v < 0.5 ? 'os-warn' : '') },
  { f: 'customerArr', fmt: OS.usd, num: true },
], { key: 'salesRegion' });

OS.defTable('bk-orphan-table', ['orphans'], () => {
  const reason = dash.params().orphanReason || '';
  return (dash.data('orphans').data || []).filter((r) => !reason || r.reason === reason)
    .sort((a, b) => (+b.arrUsd || 0) - (+a.arrUsd || 0));
}, [
  { f: 'account' }, { f: 'salesRegion' }, { f: 'country' }, { f: 'status' }, { f: 'owner' }, { f: 'ownerRole' },
  { f: 'reason', chip: (v) => (/review/.test(v) ? '' : v === 'Inactive owner' || v === 'Owner outside EMEA' ? 'bad' : 'warn') },
  { f: 'arrUsd', fmt: OS.usd, num: true },
], { key: 'accountId', limit: 300 });

OS.defTable('bk-book-table', ['books'], () => (dash.data('books').data || [])
  .filter(inTeam)
  .sort((a, b) => (a.flag === 'OK') - (b.flag === 'OK') || String(a.book).localeCompare(String(b.book))), [
  { f: 'book' }, { f: 'mainOwner', person: (r) => r.mainOwner }, { f: 'mainShare', fmt: OS.pct, num: true },
  { f: 'owners', fmt: OS.num, num: true }, { f: 'accounts', fmt: OS.num, num: true },
  { f: 'flag', chip: (v) => (v === 'OK' ? 'ok' : v === 'Split' ? 'warn' : 'bad') },
], { key: 'book' });

OS.defTable('bk-pool-table', ['book_pool'], () => (dash.data('book_pool').data || [])
  .filter((r) => r.flag !== 'OK' && inTeam(r))
  .sort((a, b) => String(a.flag).localeCompare(String(b.flag)) || String(a.name).localeCompare(String(b.name))), [
  { f: 'name', person: (r) => r.name }, { f: 'region' }, { f: 'bookList', wrap: true }, { f: 'pools', fmt: OS.num, num: true },
  { f: 'flag', chip: (v) => (v === 'Book, no pool' ? 'bad' : 'warn') },
], { key: 'userId' });

// ===================== PERSON PANEL =====================
// Salesforce values come from `person`, HiBob values from `person_hb`; each is marked against its own source.
const rowFor = (id) => {
  const p = dash.params().person;
  return p && OS.state(id) === 'ok' ? (dash.data(id).data || []).find((r) => r.name === p) || null : null;
};
const personValue = (fmt) => (el) => {
  const id = el.dataset.source;
  const r = rowFor(id);
  if (r) { el.dataset.field = el.dataset.f; setWhere(el, 'name', r.name); }
  else { delete el.dataset.field; delete el.dataset.where; }
  OS.value(el, [id], () => {
    const v = r ? r[el.dataset.f] : null;
    return v == null || v === '' ? '—' : fmt(v);
  });
};
dash.draw('pd-text', personValue((v) => String(v)));
dash.draw('pd-num', personValue(OS.num));
dash.draw('pd-usd', personValue(OS.usd));
dash.draw('pd-day', personValue(OS.day));
dash.draw('pd-title', (el) => { el.textContent = String(dash.params().person || '—'); });
dash.draw('pd-initials', (el) => {
  const name = String(dash.params().person || '');
  el.textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '—';
});
dash.draw('pd-chips', (el) => {
  const r = rowFor('person');
  const h = rowFor('person_hb');
  const chips = [];
  if (r && r.isActive === false) chips.push(['Inactive in Salesforce', 'bad']);
  if (r && r.routing) chips.push([r.routing, statusCls(r.routing)]);
  if (h && h.hiring && (!r || h.hiring !== r.routing) && h.hiring !== 'In routing') chips.push([h.hiring, statusCls(h.hiring)]);
  if (r && r.pastDue > 0) chips.push([OS.num(r.pastDue) + ' past due', 'bad']);
  el.replaceChildren(...chips.map(([t, c]) => OS.el('span', 'chip ' + c, t)));
});
dash.draw('pd-pools', (el) => {
  const r = rowFor('person');
  const names = r && r.poolNames ? r.poolNames.split(', ').filter(Boolean) : [];
  el.replaceChildren(...names.map((n) => { const li = OS.el('li'); li.append(OS.el('span', 'chip', n)); return li; }));
});

// ===================== MANAGER PICKER =====================
dash.draw('mgr-picker', (sel) => {
  const s = OS.state('roster');
  const region = OS.region();
  const teamOf = (role) => ({ 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' })[role] || 'Other';
  const counts = new Map();
  for (const u of s === 'ok' ? dash.data('roster').data || [] : []) {
    if (!u.isActive || !u.manager) continue;
    if (region !== 'All' && teamOf(u.role) !== region) continue;
    counts.set(u.manager, (counts.get(u.manager) || 0) + 1);
  }
  const names = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  const cur = mgrPick();
  if (cur && !counts.has(cur)) names.unshift(cur);
  sel.replaceChildren(new Option(s === 'ok' ? 'All managers' : 'Loading managers…', ''), ...names.map((n) => new Option(counts.has(n) ? n + ' (' + counts.get(n) + ')' : n, n)));
  sel.value = cur;
  sel.disabled = s !== 'ok';
});

// ===================== TEAM IN THE PERSON PANEL =====================
OS.defTable('pd-team-table', ['person'], () => {
  const p = dash.params().person;
  return p ? (dash.data('person').data || []).filter((r) => r.manager === p && r.isActive !== false && r.inRoster) : [];
}, [
  { f: 'name', person: (r) => r.name },
  { f: 'thisPipe', fmt: OS.usd, num: true },
  { f: 'crOpps', fmt: OS.num, num: true },
  { f: 'routing', chip: (v) => statusCls(v || '') },
], { key: 'name' });

// ===================== COMMAND PALETTE =====================
const paletteRows = () => {
  const q = (OS.queries['palette-list'] || '').trim().toLowerCase();
  if (!q) return [];
  const out = [];
  const seen = new Set();
  for (const u of dash.data('roster').data || []) {
    if (!u.isActive || seen.has(u.name) || !String(u.name).toLowerCase().includes(q)) continue;
    seen.add(u.name);
    out.push({ kind: 'person', label: u.name, sub: u.role, value: u.name });
  }
  if (OS.state('rr_pools') === 'ok') for (const p of dash.data('rr_pools').data || []) if (String(p.pool).toLowerCase().includes(q)) out.push({ kind: 'pool', label: p.pool, sub: p.members + ' members', value: p.pool });
  if (OS.state('books') === 'ok') for (const b of dash.data('books').data || []) if (String(b.book).toLowerCase().includes(q)) out.push({ kind: 'book', label: b.book, sub: b.mainOwner, value: b.book });
  return out.slice(0, 12);
};
OS.defList('palette-list', ['roster'], paletteRows, (rows) => rows.map((r) => {
  const li = OS.el('li');
  const b = OS.el('button', 'pal-item');
  b.type = 'button';
  if (r.kind === 'person') b.dataset.person = r.value;
  else if (r.kind === 'pool') { b.dataset.nav = 'routing'; b.dataset.navView = 'pools'; b.dataset.fill = 'rr-pool-table'; b.dataset.fillValue = r.value; }
  else { b.dataset.nav = 'books'; b.dataset.navView = 'books'; b.dataset.fill = 'bk-book-table'; b.dataset.fillValue = r.value; }
  b.append(OS.el('span', 'pal-kind ' + r.kind, r.kind === 'person' ? 'Person' : r.kind === 'pool' ? 'Pool' : 'Book'), OS.el('span', 'pal-label', r.label), OS.el('span', 'pal-sub', r.sub || ''));
  li.append(b);
  return li;
}), { msg: () => (!(OS.queries['palette-list'] || '').trim() ? 'empty' : paletteRows().length ? null : 'nomatch') });
