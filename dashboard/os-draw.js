// EMEA RevOps OS — drawings. Each drawing reads only the data of its own tab, and only once it is shown.

const inTeam = (r) => OS.region() === 'All' || r.region === OS.region();
const setWhere = (el, key, val) => { el.dataset.where = key + '=' + encodeURIComponent(val); };

// ===================== PIPELINE =====================
const pipeRow = (el) => {
  const region = OS.region();
  const key = region === 'All' ? 'All|All' : region + '|All';
  setWhere(el, 'key', key);
  return (dash.data('pipe_team').data || []).find((r) => r.key === key) || {};
};
dash.draw('kpi-pipe', (el) => OS.value(el, ['pipe_team'], () => OS.usd(pipeRow(el)[el.dataset.field] || 0)));
dash.draw('kpi-pipe-sub', (el) => OS.value(el, ['pipe_team'], () => OS.num(pipeRow(el)[el.dataset.field] || 0)));

dash.draw('pipe-chart', (box) => OS.chart(box, ['pipe_team'], () => {
  const region = OS.region();
  const pq = dash.params().pq === 'next' ? 'next' : 'this';
  const rows = (dash.data('pipe_team').data || [])
    .filter((r) => (region === 'All' ? r.level === 'region' : r.level === 'team' && r.region === region))
    .map((r) => ({ label: region === 'All' ? r.region : r.manager, early: r[pq + 'Early'], mid: r[pq + 'Mid'], late: r[pq + 'Late'], total: r[pq + 'Pipe'] }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  OS.hbars(box, rows, [
    { k: 'late', name: 'Late (4–6)', color: dash.colors[0] },
    { k: 'mid', name: 'Mid (2–3)', color: dash.colors[1] },
    { k: 'early', name: 'Early (0–1)', color: dash.colors[2] },
  ], OS.usd);
}));

dash.draw('pipe-mgr-table', (tbody) => OS.table(tbody, ['pipe_team'], () => (dash.data('pipe_team').data || [])
  .filter((r) => r.level === 'team' && inTeam(r))
  .sort((a, b) => b.thisPipe - a.thisPipe), [
  { f: 'manager' }, { f: 'region' },
  { f: 'thisPipe', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.thisPipe) },
  { f: 'thisCommit', fmt: OS.usd, num: true }, { f: 'thisBest', fmt: OS.usd, num: true },
  { f: 'won', fmt: OS.usd, num: true }, { f: 'nextPipe', fmt: OS.usd, num: true },
  { f: 'renewThis', fmt: OS.usd, num: true },
], { key: 'key' }));

dash.draw('pipe-rep-table', (tbody) => OS.table(tbody, ['pipe_reps'], () => (dash.data('pipe_reps').data || []).filter(inTeam), [
  { f: 'owner' }, { f: 'region' }, { f: 'manager' },
  { f: 'thisPipe', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.thisPipe) },
  { f: 'thisOpps', fmt: OS.num, num: true }, { f: 'nextPipe', fmt: OS.usd, num: true },
  { f: 'pastDue', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-bad' : '') },
  { f: 'stale', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
], { key: 'owner' }));

// ===================== CREATED =====================
const crRow = () => (dash.data('cr_kpi').data || [])[0] || {};
dash.draw('kpi-cr-count', (el) => OS.value(el, ['cr_kpi'], () => OS.num(crRow()[el.dataset.field] || 0)));
dash.draw('kpi-cr-usd', (el) => OS.value(el, ['cr_kpi'], () => OS.usd(crRow()[el.dataset.field] || 0)));
dash.draw('kpi-cr-pct', (el) => OS.value(el, ['cr_kpi'], () => OS.pct(crRow()[el.dataset.field])));

const typeKeys = (arr) => [
  { k: arr ? 'nbArr' : 'nb', name: 'New Business', color: dash.colors[0] },
  { k: arr ? 'upArr' : 'up', name: 'Upsell', color: dash.colors[1] },
  { k: arr ? 'rnArr' : 'rn', name: 'Renewal (manual)', color: dash.colors[3] },
];
dash.draw('cr-week-chart', (box) => OS.chart(box, ['cr_weeks'], () => {
  const arr = dash.params().crm === 'arr';
  const rows = (dash.data('cr_weeks').data || []).map((w) => ({ ...w, label: d3.utcFormat('%b %-d')(new Date(w.week + 'T00:00:00Z')), tip: 'Week of ' + d3.utcFormat('%-d %b %Y')(new Date(w.week + 'T00:00:00Z')) }));
  OS.vbars(box, rows, typeKeys(arr), arr ? OS.usd : OS.num);
}));
dash.draw('cr-month-chart', (box) => OS.chart(box, ['cr_months'], () => {
  const arr = dash.params().crm === 'arr';
  const rows = (dash.data('cr_months').data || []).map((m) => ({ ...m, label: d3.utcFormat('%b')(new Date(m.month + '-01T00:00:00Z')), tip: d3.utcFormat('%B %Y')(new Date(m.month + '-01T00:00:00Z')) }));
  OS.vbars(box, rows, typeKeys(arr), arr ? OS.usd : OS.num);
}));

dash.draw('cr-mix-table', (tbody) => OS.table(tbody, ['cr_mix'], () => (dash.data('cr_mix').data || []).map((r) => ({ ...r, _cls: r.source === 'Total' ? 'os-total' : '' })), [
  { f: 'source' }, { f: 'thisOpps', fmt: OS.num, num: true }, { f: 'thisArr', fmt: OS.usd, num: true },
  { f: 'lastOpps', fmt: OS.num, num: true }, { f: 'lastArr', fmt: OS.usd, num: true },
], { key: 'source' }));

dash.draw('cr-bdr-table', (tbody) => OS.table(tbody, ['cr_bdrs'], () => dash.data('cr_bdrs').data || [], [
  { f: 'bdr' }, { f: 'manager' }, { f: 'thisOpps', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.thisOpps) },
  { f: 'thisArr', fmt: OS.usd, num: true }, { f: 'lastOpps', fmt: OS.num, num: true },
], { key: 'bdr' }));

dash.draw('cr-rep-table', (tbody) => OS.table(tbody, ['cr_leader'], () => (dash.data('cr_leader').data || []).filter(inTeam), [
  { f: 'owner' }, { f: 'region' }, { f: 'manager' },
  { f: 'nb', fmt: OS.num, num: true }, { f: 'up', fmt: OS.num, num: true },
  { f: 'arr', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.arr) },
  { f: 'bdrSourced', fmt: OS.num, num: true },
], { key: 'owner' }));

// ===================== HIRING =====================
const regionRow = (el, id) => {
  const region = OS.region();
  setWhere(el, 'region', region);
  return (dash.data(id).data || []).find((r) => r.region === region) || {};
};
dash.draw('kpi-hire', (el) => OS.value(el, ['hire_kpi'], () => OS.num(regionRow(el, 'hire_kpi')[el.dataset.field] || 0)));

const statusCls = (v) => (/^In routing$/.test(v) ? 'ok'
  : /Overdue|Missing|^No Salesforce/.test(v) ? 'bad'
  : /week 2|next week|Week 1|none assigned/i.test(v) ? 'warn' : 'mute');

dash.draw('hire-table', (tbody) => OS.table(tbody, ['people'], () => (dash.data('people').data || [])
  .filter((p) => p.daysIn != null && p.daysIn <= 90 && inTeam(p))
  .sort((a, b) => a.daysIn - b.daysIn), [
  { f: 'name' }, { f: 'title' }, { f: 'team' }, { f: 'site' }, { f: 'manager' },
  { f: 'startDate', fmt: OS.day }, { f: 'daysIn', fmt: OS.num, num: true },
  { f: 'sfRole' }, { f: 'pools', fmt: OS.num, num: true },
  { f: 'status', chip: statusCls },
], { key: 'id', empty: 'Nobody joined in the last 90 days for this team.' }));

dash.draw('hire-month-chart', (box) => OS.chart(box, ['hire_months'], () => {
  const rows = (dash.data('hire_months').data || []).map((m) => ({ ...m, label: d3.utcFormat('%b')(new Date(m.month + '-01T00:00:00Z')), tip: d3.utcFormat('%B %Y')(new Date(m.month + '-01T00:00:00Z')) }));
  OS.vbars(box, rows, [
    { k: 'gtm', name: 'GTM EMEA', color: dash.colors[0] },
    { k: 'eng', name: 'Engagement EMEA', color: dash.colors[1] },
    { k: 'growth', name: 'Growth EMEA', color: dash.colors[2] },
  ], OS.num);
}));

dash.draw('hire-team-table', (tbody) => OS.table(tbody, ['hire_teams'], () => dash.data('hire_teams').data || [], [
  { f: 'team' }, { f: 'people', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.people) }, { f: 'joined90', fmt: OS.num, num: true },
], { key: 'team' }));

// ===================== ROUTING =====================
dash.draw('kpi-rr', (el) => OS.value(el, ['rr_kpi'], () => OS.num(regionRow(el, 'rr_kpi')[el.dataset.field] || 0)));

dash.draw('rr-people-table', (tbody) => OS.table(tbody, ['rr_people'], () => {
  const only = !!dash.params().onlyMissing;
  const order = { 'Missing': 0, 'New joiner: overdue': 1, 'New: add next week': 2, 'In routing, none assigned': 3, 'In routing': 4 };
  return (dash.data('rr_people').data || [])
    .filter((p) => inTeam(p) && (!only || !/^In routing/.test(p.status)))
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.name).localeCompare(String(b.name)));
}, [
  { f: 'name' }, { f: 'region' }, { f: 'manager' }, { f: 'createdDate', fmt: OS.day },
  { f: 'pools', fmt: OS.num, num: true }, { f: 'poolNames', wrap: true },
  { f: 'assignments', fmt: OS.num, num: true }, { f: 'status', chip: statusCls },
], { key: 'userId', empty: 'Everyone in this team is in routing.' }));

dash.draw('rr-pool-table', (tbody) => OS.table(tbody, ['rr_pools'], () => {
  const region = OS.region();
  return (dash.data('rr_pools').data || [])
    .filter((p) => region === 'All' || p.regions.split('|').includes(region))
    .sort((a, b) => String(a.pool).localeCompare(String(b.pool)));
}, [
  { f: 'pool' }, { f: 'family' }, { f: 'members', fmt: OS.num, num: true }, { f: 'memberNames', wrap: true },
  { f: 'assignments', fmt: OS.num, num: true }, { f: 'lastAssigned', fmt: OS.day },
  { f: 'flag', chip: (v) => (v === 'OK' ? 'ok' : v === 'Inactive member' ? 'bad' : 'warn') },
], { key: 'pool' }));

// ===================== BOOKS =====================
dash.draw('kpi-bk', (el) => OS.value(el, ['books_kpi'], () => OS.num(regionRow(el, 'books_kpi')[el.dataset.field] || 0)));
dash.draw('kpi-bk-usd', (el) => OS.value(el, ['books_kpi'], () => OS.usd(regionRow(el, 'books_kpi')[el.dataset.field] || 0)));
const orphRow = () => (dash.data('orphan_kpi').data || [])[0] || {};
dash.draw('kpi-orph', (el) => OS.value(el, ['orphan_kpi'], () => OS.num(orphRow()[el.dataset.field] || 0)));
dash.draw('kpi-orph-usd', (el) => OS.value(el, ['orphan_kpi'], () => OS.usd(orphRow()[el.dataset.field] || 0)));

dash.draw('bk-owner-table', (tbody) => OS.table(tbody, ['books_owner'], () => (dash.data('books_owner').data || []).filter(inTeam), [
  { f: 'owner' }, { f: 'region' }, { f: 'manager' },
  { f: 'accounts', fmt: OS.num, num: true }, { f: 'active', fmt: OS.num, num: true },
  { f: 'customers', fmt: OS.num, num: true },
  { f: 'arr', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.arr) },
  { f: 'emCustomers', fmt: OS.num, num: true }, { f: 'openPipe', fmt: OS.usd, num: true },
  { f: 'openRenewals', fmt: OS.num, num: true },
], { key: 'owner' }));

dash.draw('bk-cov-table', (tbody) => OS.table(tbody, ['coverage'], () => (dash.data('coverage').data || []).map((r) => ({ ...r, _cls: r.salesRegion === 'All EMEA regions' ? 'os-total' : '' })), [
  { f: 'salesRegion' }, { f: 'emea', fmt: OS.num, num: true }, { f: 'strategic', fmt: OS.num, num: true },
  { f: 'partners', fmt: OS.num, num: true }, { f: 'otherRegion', fmt: OS.num, num: true },
  { f: 'revops', fmt: OS.num, num: true }, { f: 'unassigned', fmt: OS.num, num: true },
  { f: 'coveredShare', fmt: OS.pct, num: true, cls: (v) => (v != null && v < 0.5 ? 'os-warn' : '') },
  { f: 'customerArr', fmt: OS.usd, num: true },
], { key: 'salesRegion' }));

dash.draw('bk-orphan-table', (tbody) => OS.table(tbody, ['orphans'], () => {
  const reason = dash.params().orphanReason || '';
  return (dash.data('orphans').data || []).filter((r) => !reason || r.reason === reason)
    .sort((a, b) => (+b.arrUsd || 0) - (+a.arrUsd || 0));
}, [
  { f: 'account' }, { f: 'salesRegion' }, { f: 'country' }, { f: 'status' }, { f: 'owner' }, { f: 'ownerRole' },
  { f: 'reason', chip: (v) => (/review/.test(v) ? 'mute' : v === 'Inactive owner' || v === 'Owner outside EMEA' ? 'bad' : 'warn') },
  { f: 'arrUsd', fmt: OS.usd, num: true },
], { key: 'accountId', limit: 300 }));

dash.draw('bk-book-table', (tbody) => OS.table(tbody, ['books'], () => (dash.data('books').data || [])
  .filter(inTeam)
  .sort((a, b) => (a.flag === 'OK') - (b.flag === 'OK') || String(a.book).localeCompare(String(b.book))), [
  { f: 'book' }, { f: 'mainOwner' }, { f: 'mainShare', fmt: OS.pct, num: true },
  { f: 'owners', fmt: OS.num, num: true }, { f: 'accounts', fmt: OS.num, num: true },
  { f: 'flag', chip: (v) => (v === 'OK' ? 'ok' : v === 'Split' ? 'warn' : 'bad') },
], { key: 'book' }));

dash.draw('bk-pool-table', (tbody) => OS.table(tbody, ['book_pool'], () => (dash.data('book_pool').data || [])
  .filter((r) => r.flag !== 'OK' && inTeam(r))
  .sort((a, b) => String(a.flag).localeCompare(String(b.flag)) || String(a.name).localeCompare(String(b.name))), [
  { f: 'name' }, { f: 'region' }, { f: 'bookList', wrap: true }, { f: 'pools', fmt: OS.num, num: true },
  { f: 'flag', chip: (v) => (v === 'Book, no pool' ? 'bad' : 'warn') },
], { key: 'userId', empty: 'Every AE and SMB rep in this team has both a book and a pool.' }));
