// EMEA RevOps OS — drawings. A drawing reads only its own data, and only while it is shown.

const mgrPick = () => dash.params().mgr || '';
const inTeam = (r) => (mgrPick() ? r.manager === mgrPick() : OS.region() === 'All' || r.region === OS.region());
const setWhere = (el, key, val) => { el.dataset.where = key + '=' + encodeURIComponent(val); };
const scopeKey = () => (mgrPick() ? 'M|' + mgrPick() : OS.region());
// a value mark keeps its field in data-f0; with no matching row the mark is dropped (the value shows as 0)
const keepField = (el) => { if (!el.dataset.f0 && el.dataset.field) el.dataset.f0 = el.dataset.field; return el.dataset.f0; };
const markRow = (el, key, val, row) => {
  const f = keepField(el);
  if (row) { el.dataset.field = f; setWhere(el, key, val); } else { delete el.dataset.field; delete el.dataset.where; }
  return row || {};
};
const regionRow = (el, id) => {
  const key = scopeKey();
  return markRow(el, 'region', key, (dash.data(id).data || []).find((r) => r.region === key));
};
const firstRow = (id) => (dash.data(id).data || [])[0] || {};
const statusCls = (v) => (/^In routing$/.test(v) ? 'ok'
  : /Overdue|Missing|^No Salesforce|outside EMEA/.test(v) ? 'bad'
  : /week 2|next week|Week 1|none assigned|New joiner|Not started/i.test(v) ? 'warn' : '');
const ago = (n) => (n == null ? '' : n === 0 ? 'today' : n + 'd ago');
// every request about selling activity ends with this (see ACTIVITY)
const ACT_GUARD = ' Counts only, by week and by customer or prospect: no names of people or companies outside Legora, no subjects or email text in chat. Read only: change nothing and send nothing without my OK.';
// every request about conversion starts with this (see CONVERSION): a long request loses its end, never its start
const CONV_GUARD = ' Counts and sums only: no opportunity, account, contact or competitor names, no record Ids and no deal-by-deal lists in chat; our own people may be named. Read only: change nothing in Salesforce and send nothing without my OK.';
const monthLabel = (m, i) => d3.utcFormat(i === 0 || m.endsWith('-01') ? "%b '%y" : '%b')(new Date(m + '-01T00:00:00Z'));

// Action-item counts: the headline calc, unless some items were ticked off in this app; then the count of what is
// still open in the action items themselves (the mark then names that list instead of the calc's field).
const GR_COUNT = {
  forYou: (r) => r.forYou, mine: (r) => r.bucket === 'mine', unassigned: (r) => r.bucket === 'unassigned', others: (r) => r.bucket === 'others',
  overdue: (r) => r.forYou && r.dueStatus === 'Overdue', dueSoon: (r) => r.forYou && r.dueStatus === 'Due soon', total: () => true,
};
const grCount = (el) => {
  if (!el.dataset.s0) el.dataset.s0 = el.dataset.source;
  if (!el.dataset.f0) el.dataset.f0 = el.dataset.field || el.dataset.f;
  const f = el.dataset.f0;
  const rows = OS.state('gr_actions') === 'ok' ? dash.data('gr_actions').data || [] : [];
  const open = rows.filter((r) => !r.done && !OS.done.has(r));
  if (open.length !== rows.filter((r) => !r.done).length) {
    el.dataset.source = 'gr_actions';
    delete el.dataset.field; delete el.dataset.row;
    return f === 'meetings' ? new Set(open.map((r) => r.meetingId)).size : open.filter(GR_COUNT[f] || (() => false)).length;
  }
  el.dataset.source = el.dataset.s0;
  el.dataset.field = f; el.dataset.row = '0';
  return +firstRow('gr_kpi')[f] || 0;
};
// who someone is in Salesforce, by name (full name, then first + last), for an email link
const emailOf = (name) => {
  if (!name) return null;
  const rows = OS.oo.rowsOf('users_all');
  const t = (x) => String(x || '').toLowerCase().split(/\s+/).filter(Boolean);
  const want = t(name);
  const hit = rows.find((u) => t(u.name).join(' ') === want.join(' ')) || (want.length > 1 ? rows.find((u) => { const v = t(u.name); return v[0] === want[0] && v[v.length - 1] === want[want.length - 1]; }) : null);
  return hit && hit.email ? String(hit.email).toLowerCase() : null;
};
const firstName = (name) => String(name || '').split(/\s+/)[0] || '';
// a check button that ticks an action item off (kept per viewer); a plain dot where ticking isn't available
const doneBtn = (r) => {
  const k = OS.done.keyOf(r);
  if (!OS.done.can() || !k) return OS.el('span', 'itm-dot ' + (r.bucket || ''));
  const on = OS.done.has(r);
  const b = OS.el('button', 'itm-dot itm-check ' + (r.bucket || ''));
  b.type = 'button';
  b.dataset.doneKey = k;
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Mark as not done' : 'Mark as done');
  b.title = on ? 'Mark as not done' : 'Mark as done';
  b.appendChild(OS.icon(OS.ICON.check));
  return b;
};

// ===================== NAV BADGES =====================
dash.draw('nav-badge', (el) => {
  if (!el.dataset.s0) el.dataset.s0 = el.dataset.source;
  const id = el.dataset.s0;
  if (!el.dataset.f0) el.dataset.f0 = el.dataset.f;
  if (OS.state(id) !== 'ok') { el.classList.remove('is-on'); el.textContent = '—'; return; }
  let n;
  if (id === 'gr_kpi') n = grCount(el);
  else {
    let row;
    if (el.hasAttribute('data-by-region')) row = regionRow(el, id);
    else { row = firstRow(id); el.dataset.field = el.dataset.f0; }
    n = +row[el.dataset.f0] || 0;
  }
  el.textContent = OS.num(n);
  el.classList.toggle('is-on', n > 0);
});

// ===================== PIPELINE =====================
const pipeKey = () => (mgrPick() ? 'M|' + mgrPick() : OS.region() === 'All' ? 'All|All' : OS.region() + '|All');
const pipeRow = (el) => markRow(el, 'key', pipeKey(), (dash.data('pipe_team').data || []).find((r) => r.key === pipeKey()));
dash.draw('kpi-pipe', (el) => OS.value(el, ['pipe_team'], () => OS.usd(pipeRow(el)[keepField(el)] || 0)));
dash.draw('kpi-pipe-sub', (el) => OS.value(el, ['pipe_team'], () => OS.num(pipeRow(el)[keepField(el)] || 0)));

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
dash.draw('kpi-gr', (el) => OS.value(el, ['gr_kpi'], () => OS.num(grCount(el))));
// counts every check source that has loaded, in the scope picked, exactly as the lists show them
dash.draw('kpi-checks', (el) => OS.value(el, checkIds(OS.CHECKS), () => {
  const f = keepField(el);
  el.dataset.source = OS.CHECKS.filter((id) => OS.state(id) === 'ok').join(' ') || 'checks';
  delete el.dataset.field; delete el.dataset.where;
  const rows = OS.checkRows();
  return OS.num(f === 'high' ? rows.filter((c) => c.severity === 'high').length : rows.length);
}));
dash.draw('kpi-checks-hb', (el) => OS.value(el, ['checks_hb_kpi'], () => OS.num(regionRow(el, 'checks_hb_kpi')[keepField(el)] || 0)));

const ownerChip = (r) => OS.el('span', 'chip' + (r.bucket === 'mine' ? ' info' : r.bucket === 'unassigned' ? ' warn' : ''), r.owner || 'Unassigned');
const actionItem = (r, byOwner) => {
  const li = OS.el('li', 'itm' + (OS.done.has(r) ? ' is-done' : ''));
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
  if (r.dueStatus) meta.append(OS.el('span', 'chip ' + (r.dueStatus === 'Overdue' ? 'bad' : 'warn'), r.dueStatus + ' · ' + OS.shortDay(r.due)));
  else if (r.due) meta.append(OS.el('span', 'chip', 'Due ' + OS.shortDay(r.due)));
  if (r.ageDays != null && r.ageDays >= 14) meta.append(OS.el('span', 'chip warn', Math.floor(r.ageDays / 7) + 'w old'));
  else meta.append(OS.el('span', null, ago(r.ageDays)));
  const ask = OS.links.ask(OS.ask.data('Next step: ' + r.item,
    'Help me get this next step done: "' + r.item + '"' + (r.owner ? ', owner ' + r.owner : '') + (r.due ? ', due ' + r.due : '') + '. It came from the meeting "' + r.meeting + '" on ' + r.date + (r.url ? ' (Granola note ' + r.url + ')' : '') + '. Work out what doing it takes (a message, an email, a Salesforce update or a task) and draft it for me.',
    { kind: 'next_step', meeting: r.meeting, date: r.date, owner: r.owner, note: r.url }));
  if (ask) meta.append(ask);
  if (r.bucket === 'others' && r.owner) {
    const em = emailOf(r.owner);
    const mail = em ? OS.links.mail(em, 'Follow-up: ' + r.item, 'Hi ' + firstName(r.owner) + ',\n\nFollowing up on this from "' + r.meeting + '" (' + OS.shortDay(r.date) + '):\n\n- ' + r.item + (r.due ? ' (due ' + OS.shortDay(r.due) + ')' : '') + '\n\nHow is it going?\n') : null;
    if (mail) meta.append(mail);
  }
  const cp = OS.el('button', 'ibtn');
  cp.type = 'button';
  cp.setAttribute('aria-label', 'Copy item');
  cp.dataset.copyText = `${r.item}${r.owner ? ' (' + r.owner + ')' : ''}: ${r.meeting}, ${OS.shortDay(r.date)}`;
  cp.appendChild(OS.icon(OS.ICON.copy));
  meta.append(cp);
  li.append(doneBtn(r), main, meta);
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
  const late = !!dash.params().grDue;
  const showDone = !!dash.params().grShowDone;
  return (dash.data('gr_actions').data || []).filter((r) => !r.done && (showDone || !OS.done.has(r)) && (!one || r.oneOnOne) && (!late || r.dueStatus) && (own === 'all' || (own === 'foryou' ? r.forYou : r.bucket === own)));
}, groupedActions, { fields: ['item', 'detail', 'owner', 'meeting'] });
OS.defList('home-actions', ['gr_actions'], () => (dash.data('gr_actions').data || []).filter((r) => r.forYou && !OS.done.has(r)).slice(0, 6), (rows) => {
  const out = [];
  let last = null;
  for (const r of rows) {
    if (r.meetingId !== last) { out.push(meetingHead(r)); last = r.meetingId; }
    out.push(actionItem(r, false));
  }
  return out;
});

// the definition behind a Books check, so Claude can rebuild exactly the accounts the dashboard counted
const booksHow = (c) => {
  const geo = "Sales_Region__c IN ('Northern Europe','FME','DACH','Iberia','Southern Europe','MEA','LATAM') AND (Account_Status__c IN ('Customer','Pipeline','Engaging') OR ARR_USD__c > 0)";
  const owner = { 'Inactive owner': 'Owner.IsActive = false', 'Unassigned': 'the owner is active and has no role', 'RevOps holding': "the owner is active and Owner.UserRole.Name = 'REVOPS'", 'Owner outside EMEA': "the owner is active and their role name doesn't contain EMEA and isn't REVOPS or a strategic or partnerships role" }[c.reason];
  if (owner) return 'These are accounts with ' + geo + ', where ' + owner + '.';
  if (c.id === 'books:split') return 'A book is the accounts sharing a Territory ID; it is split when its main owner holds under 80% of them.';
  return '';
};
const checkItem = (c) => {
  const li = OS.el('li', 'itm');
  li.dataset.key = c.id;
  const main = OS.el('div', 'itm-main');
  const title = OS.el('span', 'itm-title');
  title.append(c.person ? OS.personBtn(c.person) : document.createTextNode(c.title));
  main.append(title, OS.el('span', 'itm-detail', c.what + (c.meta ? ' · ' + c.meta : '')));
  const meta = OS.el('div', 'itm-meta');
  meta.append(OS.el('span', 'chip', c.area));
  const go = c.screen ? OS.el('button', 'ibtn') : null;
  if (go) {
  go.type = 'button';
  go.setAttribute('aria-label', 'Go to ' + c.area);
  go.dataset.nav = c.screen;
  if (c.screen === 'books') go.dataset.navView = c.reason ? 'orphans' : 'books';
  if (c.screen === 'routing') go.dataset.navView = c.person ? 'people' : 'pools';
  if (c.screen === 'pipeline') go.dataset.navView = 'reps';
  if (c.screen === 'hiring') go.dataset.navView = 'joiners';
  if (c.view) go.dataset.navView = c.view;
  go.appendChild(OS.icon(OS.ICON.go));
  }
  const how = c.how ? c.how + (c.area === 'Leads' ? LD_GUARD : c.area === 'Activity' ? (c.userId ? ' Their Salesforce user: OwnerId = ' + c.userId + '.' : '') + ACT_GUARD : '')
    : c.area === 'Activity' ? (c.userId ? ' Their Salesforce user: OwnerId = ' + c.userId + '.' : '') + ' Count their captured sent emails and external calendar events per week over the last 8 weeks and tell me what looks off.' + ACT_GUARD
    : c.area === 'Routing' ? ' Work out which LeanData round-robin pools they belong in (their role, their peers\' pools), or what to change in the pool, and propose the exact change.'
    : c.area === 'Pipeline' ? ' Pull their past-due opportunities and propose a new close date, stage or closing each one.'
    : c.area === 'Books' ? ' ' + booksHow(c) + ' List the accounts behind it and propose who should own them; if your count differs from the check\'s, stop and tell me.'
    : c.area === 'Hiring' ? ' Compare their HiBob record with their Salesforce user (role, manager, active) and propose the fix.'
    : c.area === 'Leavers' ? ' List what they still own and propose who should take each item (people in their team first, keeping books balanced), with the exact Salesforce and LeanData changes. For leads, report counts and groups only: no lead names, emails or companies in chat.'
    : c.area === 'Leads' ? (c.userId ? ' Their leads: OwnerId = ' + c.userId + '.' : '') + ' The dashboard counts leads an EMEA seller owns, plus leads in a queue or with other owners only when ' + LD_SCOPE + '. List the leads behind it from Salesforce with my access the same way (count first; if your count differs from the check\'s, stop and tell me), find the cause in LeanData or Salesforce, and propose the fix: route, reassign, nudge the owner, or work, nurture or disqualify.' + LD_GUARD + ' Wait for my OK before changing or sending anything.' : '';
  const ask = OS.links.ask(OS.ask.data('Fix: ' + c.title + ' (' + c.what + ')', (c.area === 'Conversion' ? CONV_GUARD.trim() + ' ' : '') + 'Help me fix this data check from the EMEA RevOps OS. ' + c.area + ': ' + c.title + ': ' + c.what + (c.meta ? ' (' + c.meta + ')' : '') + '.' + how,
    { kind: 'data_check', area: c.area, severity: c.severity, person: c.person, manager: c.manager, userId: c.userId }));
  if (ask) meta.append(ask);
  if (go) meta.append(go);
  li.append(OS.el('span', 'itm-dot ' + c.severity), main, meta);
  return li;
};
// every check source that has loaded, merged (OS.checkRows); one source failing leaves the rest
const allChecks = () => OS.checkRows();
// the sources that can produce each area's checks
const AREA_SRC = { Routing: ['checks_rr'], Hiring: ['checks', 'checks_hb'], Pipeline: ['checks', 'checks_cfg', 'checks_closed'], Books: ['checks'], Leavers: ['checks', 'checks_lv'], Leads: ['checks_ld', 'checks_ld_rt', 'checks_ld_cap'], Activity: ['checks_act'], Conversion: ['checks_conv', 'checks_conv_lost', 'checks_conv_days'] };
const areaSrc = (area) => AREA_SRC[area] || OS.CHECKS;
// a list waits only while none of its sources has loaded, then shows what did
const checkIds = (srcs) => (srcs.some((id) => OS.state(id) === 'ok') ? [] : [srcs[0]]);
// nothing to show: still loading, couldn't load (or needs connecting), or no problems
const checkMsg = (area) => () => {
  if (allChecks().some((c) => area() === 'All' || c.area === area())) return null;
  const st = areaSrc(area()).map((id) => OS.state(id));
  return st.includes('loading') ? 'loading' : st.includes('connect') ? 'connect' : st.includes('error') ? 'error' : 'empty';
};
const checkArea = () => dash.params().checkArea || 'All';
OS.defList('check-list', () => checkIds(areaSrc(checkArea())), () => {
  const area = checkArea();
  return allChecks().filter((c) => area === 'All' || c.area === area);
}, (rows) => rows.map(checkItem), { msg: checkMsg(checkArea) });
// Home's top 7: at most 2 lead, 2 activity and 2 conversion checks, so they don't crowd out the rest
const HOME_CAP = { Leads: 2, Activity: 2, Conversion: 2 };
OS.defList('home-checks', () => checkIds(OS.CHECKS), () => { const n = {}; return allChecks().filter((c) => !HOME_CAP[c.area] || (n[c.area] = (n[c.area] || 0) + 1) <= HOME_CAP[c.area]).slice(0, 7); }, (rows) => rows.map(checkItem), { msg: checkMsg(() => 'All') });

// ===================== HIRING =====================
// with LeanData the hiring numbers include pool status; without it they fall back to people_core (pools show —)
const failedId = (id) => ['error', 'connect'].includes(OS.state(id));
const hireKpi = () => (failedId('hire_kpi') ? 'hire_kpi_basic' : 'hire_kpi');
const peopleSrc = () => (failedId('people') ? 'people_core' : 'people');
dash.draw('kpi-hire', (el) => {
  const id = hireKpi();
  el.dataset.source = id;
  OS.value(el, [id], () => { const v = regionRow(el, id)[keepField(el)]; return v === null ? '—' : OS.num(v || 0); });
});

OS.defTable('hire-table', () => [peopleSrc()], () => (dash.data(peopleSrc()).data || [])
  .filter((p) => p.daysIn != null && p.daysIn <= 90 && (mgrPick() ? p.sfManager === mgrPick() : OS.region() === 'All' || p.region === OS.region()))
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

// people who left: what they still hold, and a hand-over request for your Claude. With leads and pool seats when the
// leads and LeanData load; otherwise from deals, renewals and accounts alone (leads and pools then show —).
dash.draw('kpi-lv', (el) => OS.value(el, OS.leaversIds(), () => {
  const f = keepField(el);
  const k = OS.leaversIn(scopeKey()) || {};
  // the number is built from whichever leaver layers loaded; leads and pool seats are — when they couldn't be read
  el.dataset.source = (k.sources || ['leavers_core']).join(' ');
  delete el.dataset.field; delete el.dataset.where;
  const v = k[f];
  return v === null ? '—' : fmtBy(el, v || 0);
}));
const lvHeld = (r) => [
  r.deals ? OS.num(r.deals) + ' open deal' + (r.deals === 1 ? '' : 's') + ' (' + OS.usd(r.dealArr) + ' ARR)' : '',
  r.renewals ? OS.num(r.renewals) + ' open renewal' + (r.renewals === 1 ? '' : 's') + ' (' + OS.usd(r.renewalArr) + ' contract ARR)' : '',
  r.nextClose ? 'the next one closes ' + OS.day(r.nextClose) : '',
  r.leads ? OS.num(r.leads) + ' open lead' + (r.leads === 1 ? '' : 's') + (r.ready ? ' (' + OS.num(r.ready) + ' Ready)' : '') : '',
  r.accounts ? OS.num(r.accounts) + ' active account' + (r.accounts === 1 ? '' : 's') + (r.customers ? ' (' + OS.num(r.customers) + ' customers, ' + OS.usd(r.customerArr) + ' ARR)' : '') : '',
  r.emCustomers ? 'Engagement Manager on ' + OS.num(r.emCustomers) + ' customer' + (r.emCustomers === 1 ? '' : 's') : '',
  r.pools ? 'a seat in ' + OS.num(r.pools) + ' LeanData pool' + (r.pools === 1 ? '' : 's') + ' (' + r.poolNames + ')' : '',
].filter(Boolean).join('; ');
const lvAsk = (r) => OS.links.ask(OS.ask.data('Hand-over: ' + r.name, 'Plan the hand-over for ' + r.name + ', who has left (their Salesforce user is inactive' + (r.role ? '; role ' + r.role : '') + (r.manager && r.manager !== '(no manager)' ? '; manager ' + r.manager : '') + '). They still own: ' + lvHeld(r) + '.' + (r.leads === null || r.pools === null ? ' The dashboard couldn\'t read their ' + [r.leads === null ? 'leads' : '', r.pools === null ? 'LeanData pool seats' : ''].filter(Boolean).join(' or ') + ', so check those too.' : '') + ' Propose who should take each item (people in their team first, keeping books balanced), list the Salesforce and LeanData changes, and wait for my OK before changing anything.' + (r.leads ? ' For their leads, report counts and groups only: no lead names, emails or companies in chat.' : ''), { kind: 'leaver', userId: r.userId, name: r.name }));
const lvActs = (r) => {
  const box = OS.el('span', 'row-acts');
  const sf = OS.links.sf('User', r.userId);
  if (sf) box.append(sf);
  const ask = lvAsk(r);
  if (ask) box.append(ask);
  return box.children.length ? box : null;
};
OS.defTable('lv-table', () => OS.leaversIds(), () => ((OS.leavers() || {}).rows || []).filter(inTeam), [
  { f: 'name', person: (r) => r.name, after: (r) => lvActs(r) }, { f: 'region' }, { f: 'manager' },
  { f: 'deals', fmt: OS.num, num: true }, { f: 'dealArr', fmt: OS.usd, num: true },
  { f: 'renewals', fmt: OS.num, num: true }, { f: 'renewalArr', fmt: OS.usd, num: true, cls: (v) => (v > 0 ? 'os-bad' : '') },
  { f: 'nextClose', fmt: (v) => (v ? OS.day(v) : '—') },
  { f: 'leads', fmt: OS.num, num: true }, { f: 'ready', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
  { f: 'accounts', fmt: OS.num, num: true }, { f: 'customerArr', fmt: OS.usd, num: true },
  { f: 'emCustomers', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
  { f: 'pools', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
  { f: 'status', chip: (v) => (v === 'Hand over revenue' ? 'bad' : 'warn') },
], { key: 'userId', also: ['poolNames'], msg: () => {
  const lv = OS.leavers();
  if (lv && lv.rows.some(inTeam)) return null;
  return lv && (!lv.leadsKnown || !lv.poolsKnown) ? 'partial' : 'empty';
} });

// ===================== ROUTING =====================
dash.draw('kpi-rr', (el) => OS.value(el, ['rr_kpi'], () => OS.num(regionRow(el, 'rr_kpi')[keepField(el)] || 0)));

OS.defTable('rr-people-table', ['rr_people'], () => {
  const only = !!dash.params().onlyMissing;
  const order = { 'Missing': 0, 'New joiner: overdue': 1, 'New: add next week': 2, 'Not started': 3, 'In routing, none assigned': 4, 'In routing': 5 };
  return (dash.data('rr_people').data || [])
    .filter((p) => inTeam(p) && (!only || !/^In routing/.test(p.status)))
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.name).localeCompare(String(b.name)));
}, [
  { f: 'name', person: (r) => r.name }, { f: 'region' }, { f: 'manager' }, { f: 'createdDate', fmt: OS.day },
  { f: 'pools', fmt: OS.num, num: true }, { f: 'poolNames', wrap: true }, { f: 'suggested', wrap: true },
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
dash.draw('kpi-bk', (el) => OS.value(el, ['books_kpi'], () => OS.num(regionRow(el, 'books_kpi')[keepField(el)] || 0)));
dash.draw('kpi-bk-usd', (el) => OS.value(el, ['books_kpi'], () => OS.usd(regionRow(el, 'books_kpi')[keepField(el)] || 0)));
dash.draw('kpi-orph', (el) => OS.value(el, ['orphan_kpi'], () => OS.num(firstRow('orphan_kpi')[el.dataset.field] || 0)));
dash.draw('kpi-orph-usd', (el) => OS.value(el, ['orphan_kpi'], () => OS.usd(firstRow('orphan_kpi')[el.dataset.field] || 0)));

OS.defTable('bk-owner-table', ['books_owner'], () => (dash.data('books_owner').data || []).filter(inTeam), [
  { f: 'owner', person: (r) => r.owner }, { f: 'region' }, { f: 'manager' },
  { f: 'accounts', fmt: OS.num, num: true }, { f: 'active', fmt: OS.num, num: true },
  { f: 'customers', fmt: OS.num, num: true },
  { f: 'arr', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.arr) },
  { f: 'emCustomers', fmt: OS.num, num: true }, { f: 'openPipe', fmt: OS.usd, num: true },
  { f: 'openRenewals', fmt: OS.num, num: true },
  { f: 'vsMedian', fmt: (v) => (v == null ? '—' : d3.format('.1f')(v) + '×'), num: true },
  { f: 'balance', chip: (v) => (v === 'Heavy' ? 'bad' : v === 'Light' ? 'warn' : v ? 'ok' : '') },
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
dash.draw('pd-pct', personValue(OS.pct));
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
  const rr = rowFor('rr_people');
  const routing = rr ? rr.status : null;
  // HiBob's view of the joiner, with their pool status when LeanData has loaded (people), else without (person_hb)
  const p = dash.params().person;
  const hp = p && OS.state('people') === 'ok' ? (dash.data('people').data || []).find((x) => (x.sfName || x.name) === p) || null : null;
  const hiring = hp && hp.status !== 'In a routed role' ? hp.status : h ? h.hiring : null;
  const chips = [];
  if (r && r.isActive === false) chips.push(['Inactive in Salesforce', 'bad']);
  if (routing) chips.push([routing, statusCls(routing)]);
  if (hiring && hiring !== routing && hiring !== 'In routing') chips.push([hiring, statusCls(hiring)]);
  if (h && h.mgrDiffers) chips.push([h.sfManager ? 'Manager differs from HiBob' : 'No manager in Salesforce', 'warn']);
  if (r && r.pastDue > 0) chips.push([OS.num(r.pastDue) + ' past due', 'bad']);
  // selling activity: one chip per flag (Quiet bad, the rest amber; capture problems as Check capture), or New
  const a = rowFor('act_reps');
  if (a) {
    const ACT_TXT = { Quiet: ['Quiet ' + (a.idle != null ? a.idle + ' business days' : ''), 'bad'], Slowing: ['Slowing', 'warn'], 'Nothing booked': ['Nothing booked', 'warn'], 'Below range': ['Below usual range', 'warn'], 'No capture': ['Check capture', 'warn'], 'Capture gap': ['Check capture', 'warn'] };
    for (const f of a.flags || []) if (ACT_TXT[f]) chips.push([ACT_TXT[f][0].trim(), ACT_TXT[f][1]]);
    if (a.status === 'New' && !chips.some(([t]) => /new/i.test(t))) chips.push(['First 28 days', '']);
  }
  el.replaceChildren(...chips.map(([t, c]) => OS.el('span', 'chip ' + c, t)));
});
dash.draw('pd-pools', (el) => {
  const r = rowFor('rr_people');
  const names = r && r.poolNames ? r.poolNames.split(', ').filter(Boolean) : [];
  el.replaceChildren(...names.map((n) => { const li = OS.el('li'); li.append(OS.el('span', 'chip', n)); return li; }));
});

// ===================== MANAGER PICKER =====================
const TEAM_OF = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
dash.draw('mgr-list', (ul) => {
  const s0 = OS.state('roster');
  const region = OS.region();
  const counts = new Map();
  for (const u of s0 === 'ok' ? dash.data('roster').data || [] : []) {
    if (!u.isActive || !u.manager) continue;
    if (region !== 'All' && (TEAM_OF[u.role] || 'Other') !== region) continue;
    counts.set(u.manager, (counts.get(u.manager) || 0) + 1);
  }
  const q = String(OS.queries['mgr-list'] || '').trim().toLowerCase();
  const cur = mgrPick();
  const names = [...counts.keys()].filter((n) => !q || n.toLowerCase().includes(q)).sort((a, b) => a.localeCompare(b));
  const item = (name, label, n) => {
    const li = OS.el('li');
    const b = OS.el('button', 'mgr-item');
    b.type = 'button';
    b.dataset.mgr = name;
    b.setAttribute('aria-pressed', String(name === cur));
    if (name) { b.dataset.initials = OS.initials(name); b.style.setProperty('--av', OS.hue(name)); }
    b.append(OS.el('span', 'mgr-name', label));
    if (n != null) b.append(OS.el('span', 'mgr-n', String(n)));
    li.append(b);
    return li;
  };
  if (s0 !== 'ok') { ul.replaceChildren(); ul.classList.toggle('dash-skeleton', s0 === 'loading'); return; }
  ul.classList.remove('dash-skeleton');
  // a search no manager matches says so, like the other search boxes (with a team picked, only its managers are listed)
  const none = region === 'All' ? 'No manager matches. Try part of a name.' : 'No manager in ' + region + ' matches. Try part of a name, or All EMEA.';
  ul.replaceChildren(...(q ? (names.length ? [] : [OS.el('li', 'os-empty', none)]) : [item('', 'Everyone in the team', null)]), ...names.map((n) => item(n, n, counts.get(n))));
});
dash.draw('scope-label', (el) => {
  const m = mgrPick();
  if (m) { el.textContent = m + "'s team"; return; }
  const chip = [...document.querySelectorAll('.schip[data-region]')].find((c) => c.dataset.region === OS.region());
  el.textContent = chip ? chip.textContent : OS.region();
});

// ===================== TEAM IN THE PERSON PANEL =====================
OS.defTable('pd-team-table', ['person'], () => {
  const p = dash.params().person;
  const rr = OS.state('rr_people') === 'ok' ? new Map((dash.data('rr_people').data || []).map((x) => [x.name, x.status])) : null;
  const act = OS.state('act_reps') === 'ok' ? new Map((dash.data('act_reps').data || []).map((x) => [x.name, x.meetings])) : null;
  return p ? (dash.data('person').data || []).filter((r) => r.manager === p && r.isActive !== false && r.inRoster).map((r) => ({ ...r, routing: rr ? rr.get(r.name) || null : null, actMeetings: act ? act.get(r.name) ?? null : null })) : [];
}, [
  { f: 'name', person: (r) => r.name },
  { f: 'thisPipe', fmt: OS.usd, num: true },
  { f: 'crOpps', fmt: OS.num, num: true },
  { f: 'actMeetings', fmt: (v) => (v == null ? '—' : OS.num(v)), num: true },
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
}), { msg: () => {
  if (!(OS.queries['palette-list'] || '').trim()) return 'empty';
  if (paletteRows().length) return null;
  if (OS.state('rr_pools') === 'loading' || OS.state('books') === 'loading') return 'loading';
  return [...document.querySelectorAll('.pal-go')].some((b) => !b.closest('[hidden]')) ? null : 'nomatch';
} });

// ===================== THIS WEEK (HOME) =====================
OS.defList('home-started', () => [peopleSrc()], () => (dash.data(peopleSrc()).data || []).filter((p) => p.daysIn != null && p.daysIn >= 0 && p.daysIn <= 6)
  .sort((a, b) => a.daysIn - b.daysIn), (rows) => rows.map((p) => {
  const li = OS.el('li', 'itm');
  li.dataset.key = p.id;
  const main = OS.el('div', 'itm-main');
  const t = OS.el('span', 'itm-title');
  t.append(OS.personBtn(p.sfName || p.name, p.name));
  main.append(t, OS.el('span', 'itm-detail', [p.title, p.team, p.site].filter(Boolean).join(' · ')));
  const meta = OS.el('div', 'itm-meta');
  meta.append(OS.el('span', 'chip ' + statusCls(p.status), p.status), OS.el('span', null, OS.shortDay(p.startDate)));
  li.append(OS.el('span', 'itm-dot mine'), main, meta);
  return li;
}));
OS.defList('home-pooladds', ['pool_adds'], () => dash.data('pool_adds').data || [], (rows) => rows.map((r) => {
  const li = OS.el('li', 'itm');
  li.dataset.key = r.name;
  const main = OS.el('div', 'itm-main');
  const t = OS.el('span', 'itm-title');
  t.append(OS.personBtn(r.name));
  main.append(t, OS.el('span', 'itm-detail', r.poolNames));
  const meta = OS.el('div', 'itm-meta');
  meta.append(OS.el('span', 'chip', r.pools + (r.pools === 1 ? ' pool' : ' pools')), OS.el('span', null, OS.shortDay(r.addedOn)));
  li.append(OS.el('span', 'itm-dot others'), main, meta);
  return li;
}));

// ===================== DEALS =====================
const flagCls = (f) => (f === 'Past due' || f === 'Commit at early stage' ? 'bad' : f === 'No next step' ? '' : 'warn');
const dealActs = (r) => {
  const box = OS.el('span', 'row-acts');
  const sf = OS.links.sf('Opportunity', r.oppId);
  if (sf) box.append(sf);
  const ask = OS.links.ask(OS.ask.data('Deal: ' + r.opp, 'Review this opportunity and propose hygiene fixes (close date, stage, amount, next step): ' + r.opp + ' (' + r.oppId + '), owner ' + (r.owner || 'unknown') + ', stage ' + r.stage + ', closes ' + r.closeDate + (r.forecast ? ', forecast ' + r.forecast : '') + (r.flags ? '. Flags: ' + r.flags : '') + '.', { kind: 'deal', oppId: r.oppId, owner: r.owner }));
  if (ask) box.append(ask);
  return box.children.length ? box : null;
};
OS.defTable('deal-table', ['deal_list'], () => {
  const pq = dash.params().pq === 'next' ? 'next' : 'this';
  const flag = dash.params().dealFlag || '';
  return (dash.data('deal_list').data || []).filter((x) => x.quarter === pq && inTeam(x) && (!flag || x.flags.split(', ').includes(flag)));
}, [
  { f: 'opp', wrap: true, after: (r) => dealActs(r) }, { f: 'owner', person: (r) => r.owner }, { f: 'stage' },
  { f: 'daysInStage', fmt: (v) => (v == null ? '—' : OS.num(v)), num: true, cls: (v, r) => (/Stuck in stage/.test(r.flags || '') ? 'os-warn' : '') },
  { f: 'closeDate', fmt: OS.shortDay }, { f: 'forecast' },
  { f: 'arrUsd', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.arrUsd) },
  { f: 'flags', chips: flagCls }, { f: 'risk', fmt: OS.num, num: true },
], { key: 'oppId', limit: 100, also: ['account'] });

// while the query re-runs for another person, the old person's deals stay hidden
const pdDeals = () => (dash.data('deals').refreshing ? [] : dash.data('person_deals').data || []);
OS.defList('pd-deals', ['person_deals'], pdDeals, (rows) => rows.map((x) => {
  const li = OS.el('li', 'itm');
  li.dataset.key = x.oppId;
  const main = OS.el('div', 'itm-main');
  main.append(OS.el('span', 'itm-title', x.opp));
  main.append(OS.el('span', 'itm-detail', [x.rt, x.stage, 'closes ' + OS.shortDay(x.closeDate), x.forecast].filter(Boolean).join(' · ')));
  if (x.nextStep) main.append(OS.el('span', 'itm-detail', x.nextStep));
  const flags = OS.el('span', 'itm-flags');
  x.flags.split(', ').filter(Boolean).forEach((f) => flags.append(OS.el('span', 'chip ' + flagCls(f), f)));
  if (x.flags) main.append(flags);
  const meta = OS.el('div', 'itm-meta');
  meta.append(OS.el('span', 'itm-arr', OS.usd(x.arrUsd)));
  const acts = dealActs({ ...x, owner: x.owner || dash.params().person }); // the deals query is filtered to the panel's person
  if (acts) meta.append(acts);
  const cp = OS.el('button', 'ibtn');
  cp.type = 'button';
  cp.setAttribute('aria-label', 'Copy opportunity ID');
  cp.dataset.copyText = x.oppId;
  cp.appendChild(OS.icon(OS.ICON.copy));
  meta.append(cp);
  li.append(OS.el('span', 'itm-dot ' + (x.flags ? 'medium' : 'low')), main, meta);
  return li;
}), { msg: () => (dash.data('deals').refreshing ? 'loading' : pdDeals().length ? null : 'empty') });

// ===================== FORECAST =====================
const forecastRows = () => {
  const region = OS.region();
  const rows = dash.data('forecast').data || [];
  if (mgrPick()) return rows.filter((r) => r.level === 'team' && r.manager === mgrPick());
  return region === 'All' ? rows.filter((r) => r.level === 'region' && (r.won || r.pipeline)) : rows.filter((r) => r.level === 'team' && r.region === region);
};
OS.defTable('fc-table', ['forecast'], () => forecastRows().slice().sort((a, b) => b.wonBest - a.wonBest), [
  { f: 'region' }, { f: 'manager' },
  { f: 'won', fmt: OS.usd, num: true }, { f: 'commit', fmt: OS.usd, num: true }, { f: 'bestCase', fmt: OS.usd, num: true },
  { f: 'wonCommit', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.wonBest) },
  { f: 'wonBest', fmt: OS.usd, num: true }, { f: 'pipeline', fmt: OS.usd, num: true },
  { f: 'commitShare', fmt: OS.pct, num: true },
], { key: 'key' });
OS.defChart('fc-chart', ['forecast'], () => forecastRows().map((r) => ({ label: mgrPick() || OS.region() === 'All' ? r.region : r.manager, won: r.won, commit: r.commit, best: r.upside, total: r.wonBest }))
  .filter((r) => r.total > 0).sort((a, b) => b.total - a.total), (box, rows) => OS.hbars(box, rows, [
  { k: 'won', name: 'Closed won', color: dash.colors[0] },
  { k: 'commit', name: 'Commit', color: dash.colors[1] },
  { k: 'best', name: 'Best case above commit', color: dash.colors[2] },
], OS.usd));
dash.draw('kpi-fc', (el) => OS.value(el, ['forecast'], () => OS.usd(markRow(el, 'key', pipeKey(), (dash.data('forecast').data || []).find((r) => r.key === pipeKey()))[keepField(el)] || 0)));

// ===================== RENEWALS =====================
const renewFlagCls = (f) => (f === 'Past due' || f === 'High risk rating' || f === 'Downsell' ? 'bad' : 'warn');
OS.defTable('renew-table', ['renewal_list'], () => {
  const pq = dash.params().pq === 'next' ? 'next' : 'this';
  const flag = dash.params().renewFlag || '';
  return (dash.data('renewal_list').data || []).filter((x) => x.quarter === pq && inTeam(x) && (!flag || x.flags.split(', ').includes(flag)));
}, [
  { f: 'opp', wrap: true, after: (r) => OS.links.sf('Opportunity', r.oppId) }, { f: 'owner', person: (r) => r.owner }, { f: 'stage' },
  { f: 'closeDate', fmt: OS.shortDay }, { f: 'daysToClose', fmt: OS.num, num: true, cls: (v) => (v < 0 ? 'os-bad' : v <= 30 ? 'os-warn' : '') },
  { f: 'rating', chip: (v) => (v === 'High' ? 'bad' : v === 'Medium' ? 'warn' : v === 'Low' ? 'ok' : '') },
  { f: 'renewingArrUsd', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.renewingArrUsd) },
  { f: 'netChangeArrUsd', fmt: OS.usd, num: true, cls: (v) => (v < 0 ? 'os-bad' : '') },
  { f: 'flags', chips: renewFlagCls },
], { key: 'oppId', limit: 100 });

// ===================== REP RISK =====================
dash.draw('kpi-risk', (el) => OS.value(el, ['risk_kpi'], () => {
  const v = regionRow(el, 'risk_kpi')[keepField(el)];
  return el.dataset.fmt === 'usd' ? OS.usd(v || 0) : el.dataset.fmt === 'pct' ? OS.pct(v) : OS.num(v || 0);
}));
OS.defTable('risk-table', ['rep_risk'], () => (dash.data('rep_risk').data || []).filter(inTeam), [
  { f: 'owner', person: (r) => r.owner }, { f: 'region' },
  { f: 'thisPipe', fmt: OS.usd, num: true },
  { f: 'pushedOut', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-bad' : '') },
  { f: 'pushedOutArr', fmt: OS.usd, num: true },
  { f: 'repeatEdits', fmt: OS.num, num: true, cls: (v) => (v > 2 ? 'os-warn' : '') },
  { f: 'early', fmt: OS.num, num: true }, { f: 'earlyShare', fmt: OS.pct, num: true, cls: (v) => (v != null && v >= 0.3 ? 'os-warn' : '') },
  { f: 'noContact', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
  { f: 'nextOverdue', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
  { f: 'stuck', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
  { f: 'pastDue', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-bad' : '') },
  { f: 'stale', fmt: OS.num, num: true },
  { f: 'score', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.score) },
], { key: 'owner' });

// ===================== PACE / BOOKINGS / RAMP =====================
const signed = (v) => (v == null ? '—' : Math.abs(v) < 0.005 ? '0%' : (v > 0 ? '+' : '−') + d3.format('.0%')(Math.abs(v)));
dash.draw('kpi-pace', (el) => {
  OS.value(el, ['cr_pace'], () => signed(firstRow('cr_pace')[el.dataset.field]));
  const v = OS.state('cr_pace') === 'ok' ? firstRow('cr_pace')[el.dataset.field] : null;
  el.classList.toggle('os-ok', v != null && v >= 0.005);
  el.classList.toggle('os-bad', v != null && v <= -0.005);
});
dash.draw('kpi-pace-num', (el) => OS.value(el, ['cr_pace'], () => OS.num(firstRow('cr_pace')[el.dataset.field] || 0)));
dash.draw('kpi-book', (el) => OS.value(el, ['bookings_kpi'], () => {
  const v = regionRow(el, 'bookings_kpi')[keepField(el)];
  return el.dataset.fmt === 'usd' ? OS.usd(v || 0) : el.dataset.fmt === 'pct' ? OS.pct(v) : OS.num(v || 0);
}));
OS.defTable('book-table', ['bookings'], () => (dash.data('bookings').data || []).filter(inTeam), [
  { f: 'owner', person: (r) => r.owner }, { f: 'region' }, { f: 'manager' },
  { f: 'wonThisArr', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.wonThisArr) },
  { f: 'wonThis', fmt: OS.num, num: true }, { f: 'lostThis', fmt: OS.num, num: true },
  { f: 'winRateThis', fmt: OS.pct, num: true }, { f: 'avgDealThis', fmt: OS.usd, num: true },
  { f: 'wonLastArr', fmt: OS.usd, num: true }, { f: 'winRateLast', fmt: OS.pct, num: true },
], { key: 'key' });
// open deals on EMEA accounts owned outside EMEA sales roles (partnerships, strategic AEs): in no team's totals
OS.defTable('partner-table', ['partner_pipe'], () => dash.data('partner_pipe').data || [], [
  { f: 'role' },
  { f: 'thisArr', fmt: OS.usd, num: true }, { f: 'thisOpps', fmt: OS.num, num: true },
  { f: 'nextArr', fmt: OS.usd, num: true }, { f: 'allArr', fmt: OS.usd, num: true, bar: (l) => d3.max(l.filter((r) => r.role !== 'All'), (r) => r.allArr) },
  { f: 'allOpps', fmt: OS.num, num: true }, { f: 'renewals', fmt: OS.num, num: true }, { f: 'regions', fmt: (v) => v || '—' },
], { key: 'key' });
OS.defChart('lost-chart', ['lost_reasons'], () => {
  const scope = mgrPick() ? 'M|' + mgrPick() : OS.region();
  return (dash.data('lost_reasons').data || []).filter((r) => r.scope === scope && r.thisOpps)
    .map((r) => ({ label: r.reason + (r.admin ? ' (admin)' : ''), thisQ: r.thisOpps, lastQ: r.lastOpps, total: r.thisOpps }))
    .sort((a, b) => b.thisQ - a.thisQ || b.lastQ - a.lastQ);
}, (box, rows) => OS.hbars(box, rows, [{ k: 'thisQ', name: 'This quarter', color: dash.colors[0] }], OS.num));
const rampCls = (v) => (v === 'Ramping' || v === 'Sourcing' ? 'ok' : v === 'Not ramping' || v === 'No Salesforce user' ? 'bad' : v === 'Too early' ? 'warn' : '');
OS.defTable('ramp-table', ['ramp'], () => (dash.data('ramp').data || [])
  .filter((p) => (mgrPick() ? p.manager === mgrPick() : OS.region() === 'All' || p.region === OS.region()))
  .sort((a, b) => a.daysIn - b.daysIn), [
  { f: 'name', person: (r) => r.sfName || r.name }, { f: 'sfRole' }, { f: 'startDate', fmt: OS.day },
  { f: 'daysIn', fmt: OS.num, num: true }, { f: 'opps', fmt: OS.num, num: true },
  { f: 'perMonth', fmt: (v) => (v == null ? '—' : d3.format('.1f')(v)), num: true },
  { f: 'daysToFirst', fmt: OS.num, num: true }, { f: 'pipeThisQ', fmt: OS.usd, num: true },
  { f: 'sourced', fmt: OS.num, num: true }, { f: 'status', chip: rampCls },
], { key: 'id' });

// ===================== 1:1s =====================
const ooRows = (id) => OS.oo.rowsOf(id);
OS.defList('oo-list', ['oo_upcoming'], () => dash.data('oo_upcoming').data || [], (rows) => {
  const out = [];
  const cur = OS.oo.who();
  let last = null;
  for (const r of rows) {
    const [dayTxt, timeTxt] = OS.oo.when(r).split(', ');
    if (dayTxt !== last) { last = dayTxt; const g = OS.el('li', 'grp'); g.append(OS.el('b', null, dayTxt || '—')); out.push(g); }
    const li = OS.el('li', 'oo-itm');
    li.dataset.key = r.key;
    const b = OS.el('button', 'oo-btn');
    b.type = 'button';
    b.dataset.ooWho = r.email;
    if (r.email === cur) b.setAttribute('aria-current', 'true');
    const txt = OS.el('span', 'oo-txt');
    txt.append(OS.el('span', 'oo-name', r.name), OS.el('span', 'oo-title', r.title));
    const chips = OS.el('span', 'oo-chips');
    if (r.recurring) chips.append(OS.el('span', 'chip', 'Recurring'));
    if (!r.sfName) chips.append(OS.el('span', 'chip', 'Not in Salesforce'));
    if (chips.children.length) txt.append(chips);
    b.append(OS.el('span', 'oo-time', timeTxt || ''), txt);
    li.append(b);
    out.push(li);
  }
  return out;
});
dash.draw('oo-pick', (sel) => {
  const s = OS.state('team_tree');
  const rows = s === 'ok' ? (dash.data('team_tree').data || []).filter((r) => r.email) : [];
  const leaders = rows.filter((r) => r.isLeader).sort((a, b) => b.emeaPeople - a.emeaPeople || a.name.localeCompare(b.name));
  const others = rows.filter((r) => !r.isLeader && r.inEmea).sort((a, b) => a.name.localeCompare(b.name));
  const group = (label, list) => { const g = document.createElement('optgroup'); g.label = label; g.append(...list.map((r) => new Option(r.name, r.email))); return g; };
  sel.replaceChildren(new Option(s === 'ok' ? 'Choose a person…' : s === 'loading' ? 'Loading people…' : 'People unavailable', ''), group('Leaders', leaders), group('People', others));
  const cur = OS.oo.who();
  sel.value = rows.some((r) => r.email === cur) ? cur : '';
  sel.disabled = s !== 'ok';
});
dash.draw('oo-who', (el) => { const w = OS.oo.who(); el.textContent = w ? OS.oo.nameOf(w) || '—' : '—'; });
dash.draw('oo-when', (el) => { const w = OS.oo.who(); const n = w ? OS.oo.nextFor(w) : null; el.textContent = n ? OS.oo.when(n) + ' · ' + n.title : ''; });
dash.draw('oo-last', (el) => {
  const w = OS.oo.who();
  const r = w ? ooRows('oo_followups').find((x) => x.email === w && x.kind === 'last') : null;
  el.replaceChildren();
  if (!r) return;
  el.append(document.createTextNode(r.meeting + ', ' + OS.day(r.date) + ' '));
  if (r.url && /^https:\/\//.test(r.url)) {
    const a = OS.el('a');
    a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'Open the note in Granola');
    a.appendChild(OS.icon(OS.ICON.open));
    el.append(a);
  }
});
const ooFollow = () => { const w = OS.oo.who(); return w ? (dash.data('oo_followups').data || []).filter((r) => r.email === w && r.kind === 'item' && !OS.done.has(r)) : []; };
OS.defList('oo-follow', ['oo_followups'], ooFollow, (rows) => rows.map((r) => {
  const li = OS.el('li', 'itm');
  li.dataset.key = r.key;
  const main = OS.el('div', 'itm-main');
  main.append(OS.el('span', 'itm-title', r.item));
  const from = OS.el('span', 'itm-from', r.meeting + ' · ' + OS.shortDay(r.date));
  if (r.url && /^https:\/\//.test(r.url)) {
    const a = OS.el('a');
    a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'Open the note in Granola');
    a.appendChild(OS.icon(OS.ICON.open));
    from.append(a);
  }
  main.append(from);
  const meta = OS.el('div', 'itm-meta');
  meta.append(ownerChip(r));
  if (r.priv) meta.append(OS.el('span', 'chip', 'Private note'));
  if (r.dueStatus) meta.append(OS.el('span', 'chip ' + (r.dueStatus === 'Overdue' ? 'bad' : 'warn'), r.dueStatus + ' · ' + OS.shortDay(r.due)));
  const ask = OS.links.ask(OS.ask.data('Follow-up: ' + r.item, 'Before my 1:1 with ' + OS.oo.nameOf(r.email) + ', help me close out this follow-up: "' + r.item + '"' + (r.owner ? ' (owner ' + r.owner + ')' : '') + ' from "' + r.meeting + '" on ' + r.date + (r.url ? ' (Granola note ' + r.url + ')' : '') + '. Draft what is needed.', { kind: 'follow_up', person: OS.oo.nameOf(r.email) }));
  if (ask) meta.append(ask);
  li.append(doneBtn(r), main, meta);
  return li;
}), { msg: () => (!OS.oo.who() ? 'nowho' : ooFollow().length ? null : 'empty') });
const ooPoints = (sec) => () => { const w = OS.oo.who(); return w ? OS.oo.points(w).filter((r) => r.section === sec) : []; };
OS.defList('oo-numbers', ['oo_points'], ooPoints('numbers'), (rows) => rows.map((r) => OS.el('li', null, r.text)),
  { msg: () => (!OS.oo.who() ? 'nowho' : ooPoints('numbers')().length ? null : 'empty') });
OS.defList('oo-talk', ['oo_points'], ooPoints('talk'), (rows) => rows.map((r) => {
  const li = OS.el('li', 'ag-pt');
  li.dataset.key = r.key;
  li.append(OS.el('span', 'itm-dot ' + (r.sev || 'low')), OS.el('span', 'ag-txt', r.text));
  const acts = OS.el('span', 'ag-acts');
  const ask = OS.links.ask(OS.ask.data('1:1 point: ' + r.text, (r.conv ? CONV_GUARD.trim() + ' ' : '') + 'I have a 1:1 with ' + r.name + '. Help me prepare this point from the EMEA RevOps OS: ' + r.text
    + (r.conv ? ' With my Salesforce access, count the deals behind it by stage, lost reason and quarter (counts only) and suggest what to ask or agree.'
      : r.act ? ' With my Salesforce access, count the activity behind it by week and suggest what to ask or agree.' + ACT_GUARD : ' Pull the records behind it and suggest what to ask or agree.'), { kind: 'talking_point', person: r.name }));
  if (ask) acts.append(ask);
  const sf = r.oppId ? OS.links.sf('Opportunity', r.oppId) : null;
  if (sf) acts.append(sf);
  li.append(acts);
  if (r.screen) {
    const go = OS.el('button', 'ibtn');
    go.type = 'button';
    go.dataset.nav = r.screen;
    if (r.view) go.dataset.navView = r.view;
    // a point that names a data-check area (a leader's old deals: Conversion) opens that area for all of EMEA, whatever
    // area or scope was picked before: the point counts the leader's whole team
    if (r.area) { go.dataset.navArea = r.area; go.dataset.navScope = 'All'; }
    go.setAttribute('aria-label', 'Open in the app');
    go.appendChild(OS.icon(OS.ICON.go));
    li.append(go);
  }
  return li;
}), { msg: () => {
  const w = OS.oo.who();
  if (!w) return 'nowho';
  if (ooPoints('talk')().length) return null;
  if (!ooPoints('numbers')().length) return 'nodata';
  // activity or (for a leader) conversion points still loading, failed or hidden: say they may be missing
  const convMissing = ooRows('team_tree').some((t) => t.email === w && t.isLeader) && OS.state('oo_points_conv') !== 'ok';
  return OS.state('oo_points_act') === 'ok' && !ooPoints('numbers')().some((r) => r.actHidden) && !convMissing ? 'empty' : 'emptycore';
} });

// who they are to you, so it is clear why the agenda has the sections it has
dash.draw('oo-rel', (el) => { const w = OS.oo.who(); const k = w ? OS.oo.kind(w) : null; el.textContent = k && k.label ? k.label : ''; });
// what the last meeting with them covered: the headings of its Granola summary
const ooTopics = () => { const w = OS.oo.who(); const r = w ? OS.oo.lastOf(w) : null; return r && r.topics ? r.topics.split('\n').map((t, i) => ({ key: r.meetingId + '|' + i, text: t })) : []; };
OS.defList('oo-topics', ['oo_followups'], ooTopics, (rows) => rows.map((r) => { const li = OS.el('li', null, r.text); li.dataset.key = r.key; return li; }),
  { msg: () => null });
// RevOps people: the EMEA update and RevOps work, from the weekly summary for all EMEA
const ooOpsRow = (r, talk) => {
  const li = OS.el('li', talk ? 'ag-pt' : null);
  li.dataset.key = r.key;
  if (!talk) { li.textContent = r.text; return li; }
  li.append(OS.el('span', 'itm-dot ' + (r.sev || 'low')), OS.el('span', 'ag-txt', r.text));
  const go = OS.el('button', 'ibtn');
  go.type = 'button';
  go.dataset.nav = r.screen;
  go.dataset.navView = r.view;
  // the line counts all of EMEA, so the view opens for all of EMEA. The checks line counts every data-check area but
  // Conversion (the agenda leaves those checks out and says so); the view opens on all areas, Conversion included
  go.dataset.navScope = 'All';
  if (r.key === 'checks') go.dataset.navArea = 'All';
  go.setAttribute('aria-label', 'Open in the app');
  go.appendChild(OS.icon(OS.ICON.go));
  li.append(OS.el('span', 'ag-acts'), go);
  return li;
};
// each list waits while any of its sources loads; one that failed shows as its own 'not available' line
const ooOpsIds = (part) => () => OS.summary[part].filter((id) => OS.state(id) === 'loading');
OS.defList('oo-emea', ooOpsIds('NUM'), () => OS.oo.ops('numbers'), (rows) => rows.map((r) => ooOpsRow(r, false)),
  { msg: () => (OS.oo.ops('numbers').length ? null : 'empty') });
OS.defList('oo-ops', ooOpsIds('OPS'), () => OS.oo.ops('talk'), (rows) => rows.map((r) => ooOpsRow(r, true)),
  { msg: () => (OS.oo.ops('talk').length ? null : 'empty') });

// ===================== TEAM SCORECARD =====================
const ooRoot = () => {
  const rows = ooRows('team_tree');
  const p = dash.params().ooRoot || '';
  if (p && rows.some((r) => r.name === p)) return p;
  const me = ooRows('sf_me')[0];
  const mine = me && rows.find((r) => r.name === me.name && r.isLeader);
  if (mine) return mine.name;
  const top = rows.find((r) => r.isTop);
  return top ? top.name : '';
};
dash.draw('oo-root', (sel) => {
  const s = OS.state('team_tree');
  const rows = s === 'ok' ? (dash.data('team_tree').data || []).filter((r) => r.isLeader) : [];
  const me = ooRows('sf_me')[0];
  const list = rows.slice().sort((a, b) => (me && b.name === me.name) - (me && a.name === me.name) || b.emeaPeople - a.emeaPeople || a.name.localeCompare(b.name));
  sel.replaceChildren(...(s === 'ok' ? list.map((r) => new Option(r.name + (r.active === false ? ' (inactive)' : '') + ' (' + r.emeaPeople + ')', r.name)) : [new Option(s === 'loading' ? 'Loading leaders…' : 'Leaders unavailable', '')]));
  sel.value = ooRoot();
  sel.disabled = s !== 'ok';
});
const teamRow = (el) => {
  const root = ooRoot();
  return markRow(el, 'name', root, root ? ooRows('team_tree').find((r) => r.name === root) : null);
};
dash.draw('kpi-team', (el) => OS.value(el, ['team_tree'], () => {
  const r = teamRow(el);
  const v = r[keepField(el)];
  const fmt = el.dataset.fmt;
  return v == null ? '—' : fmt === 'usd' ? OS.usd(v) : fmt === 'pct' ? OS.pct(v) : OS.num(v);
}));
// routing gaps come from LeanData (team_rr), so they are their own mark
dash.draw('kpi-team-rr', (el) => OS.value(el, ['team_rr'], () => {
  const root = ooRoot();
  const r = markRow(el, 'name', root, root ? ooRows('team_rr').find((x) => x.name === root) : null);
  const v = r[keepField(el)];
  return v == null ? '—' : OS.num(v);
}));
// selling activity comes from team_act, so it is its own mark too
dash.draw('kpi-team-act', (el) => OS.value(el, ['team_act'], () => {
  const root = ooRoot();
  const r = markRow(el, 'name', root, root ? ooRows('team_act').find((x) => x.name === root) : null);
  const v = r[keepField(el)];
  return v == null ? '—' : OS.num(v);
}));
const agendaBtn = (r) => {
  if (!r.email) return null;
  const b = OS.el('button', 'ibtn ibtn-sm');
  b.type = 'button';
  b.dataset.ooWho = r.email;
  b.setAttribute('aria-label', '1:1 agenda for ' + r.name);
  b.title = '1:1 agenda';
  b.appendChild(OS.icon(OS.ICON.agenda));
  return b;
};
OS.defTable('oo-team-table', ['team_tree'], () => {
  const root = ooRoot();
  // routing gaps join from team_rr when LeanData loads, and selling activity from team_act; until then (or without them) they show —
  const rr = OS.state('team_rr') === 'ok' ? new Map((dash.data('team_rr').data || []).map((x) => [x.name, x.routingGaps])) : null;
  const act = OS.state('team_act') === 'ok' ? new Map((dash.data('team_act').data || []).map((x) => [x.name, x])) : null;
  const NO_ACT = { actMeetings: null, actMeetCust: null, actMeetPros: null, actMeetPerSellerWk: null, actMeetChg: null, actCompared: null, actBooked: null, actBookedPros: null, actFlags: null, actQuiet: null, actSlowing: null, actNothingBooked: null, actNoCapture: null, actHidden: null, actMailHidden: null, actMeetHidden: null };
  return root ? (dash.data('team_tree').data || []).filter((r) => r.manager === root).map((r) => ({ ...r, routingGaps: rr ? rr.get(r.name) || 0 : null, ...NO_ACT, ...(act ? act.get(r.name) || {} : {}), name: r.name }))
    .sort((a, b) => b.emeaPeople - a.emeaPeople || b.thisPipe - a.thisPipe) : [];
}, [
  { f: 'name', person: (r) => r.name, after: agendaBtn },
  { f: 'region' },
  { f: 'teamSize', fmt: OS.num, num: true },
  { f: 'thisPipe', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.thisPipe) },
  { f: 'nextPipe', fmt: OS.usd, num: true },
  { f: 'crOpps', fmt: OS.num, num: true },
  { f: 'wonThisArr', fmt: OS.usd, num: true },
  { f: 'winRate', fmt: (v) => (v == null ? '—' : OS.pct(v)), num: true },
  { f: 'pastDue', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-bad' : '') },
  { f: 'riskReps', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
  { f: 'actMeetings', fmt: (v) => (v == null ? '—' : OS.num(v)), num: true, tip: (r) => (r.actHidden ? 'Your Salesforce access shows no activity for ' + OS.num(r.actHidden) + (r.actHidden === 1 ? ' person' : ' people') + ' in this team, so no total is shown' : r.actMeetings == null ? '' : OS.num(r.actMeetCust) + ' with customers · ' + OS.num(r.actMeetPros) + ' with prospects') },
  { f: 'actMeetPerSellerWk', fmt: (v) => (v == null ? '—' : d3.format('.1f')(v)), num: true },
  { f: 'actMeetChg', fmt: (v) => OS.signedPct(v), num: true, cls: (v) => (v != null && v <= -0.25 ? 'os-bad' : ''), tip: (r) => (r.actCompared != null ? 'like-for-like, ' + OS.num(r.actCompared) + ' people compared' : '') },
  { f: 'actBooked', fmt: (v) => (v == null ? '—' : OS.num(v)), num: true, tip: (r) => (r.actBookedPros != null ? OS.num(r.actBookedPros) + ' with prospects' : '') },
  { f: 'actFlags', fmt: (v) => (v == null ? '—' : OS.num(v)), num: true, cls: (v) => (v > 0 ? 'os-warn' : ''), tip: (r) => (r.actFlags == null ? '' : [r.actQuiet == null ? '' : OS.num(r.actQuiet) + ' quiet', OS.num(r.actSlowing) + ' slowing', r.actNothingBooked == null ? '' : OS.num(r.actNothingBooked) + ' nothing booked',
    OS.num(r.actNoCapture) + (r.actMailHidden ? ' no meeting captured' : r.actMeetHidden ? ' no sent email captured' : ' nothing captured')].filter(Boolean).join(' · ')) },
  { f: 'routingGaps', fmt: (v) => (v == null ? '—' : OS.num(v)), num: true, cls: (v) => (v > 0 ? 'os-bad' : '') },
  { f: 'checks', fmt: OS.num, num: true },
], { key: 'name' });

// ===================== BOOK MOVES =====================
OS.defTable('bk-plan-table', ['book_moves'], () => (dash.data('book_moves').data || [])
  .filter((r) => (mgrPick() ? r.manager === mgrPick() || r.toManager === mgrPick() : OS.region() === 'All' || r.region === OS.region())), [
  { f: 'region' },
  { f: 'from', person: (r) => r.from },
  { f: 'to', person: (r) => r.to },
  { f: 'accounts', fmt: OS.num, num: true },
  { f: 'untouched', fmt: OS.num, num: true },
  { f: 'fromAfter', fmt: OS.num, num: true },
  { f: 'toAfter', fmt: (v) => (v == null ? '—' : OS.num(v)), num: true },
  { f: 'teamMedian', fmt: (v) => (v == null ? '—' : OS.num(Math.round(v))), num: true },
  { f: 'note', cls: (v) => (v ? 'os-warn' : '') },
], { key: 'key' });

// ===================== HOME HERO =====================
dash.draw('hero-date', (el) => { el.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); });
dash.draw('hero-name', (el) => {
  const me = OS.state('sf_me') === 'ok' ? (dash.data('sf_me').data || [])[0] : null;
  el.textContent = me && me.name ? ', ' + firstName(me.name) : '';
});
dash.draw('kpi-oo', (el) => OS.value(el, ['oo_kpi'], () => OS.num(firstRow('oo_kpi')[el.dataset.field] || 0)));
OS.defList('home-next', ['oo_upcoming'], () => (dash.data('oo_upcoming').data || []).slice(0, 4), (rows) => {
  const r = rows[0];
  if (!r) return [];
  const av = OS.el('span', 'nx-av', OS.initials(r.name));
  av.style.setProperty('--av', OS.hue(r.name));
  const who = OS.el('div', 'nx-who');
  who.append(OS.el('b', null, r.name), OS.el('span', null, OS.oo.when(r) + ' · ' + r.title));
  const go = OS.el('button', 'btn btn-primary');
  go.type = 'button';
  go.dataset.ooWho = r.email;
  go.appendChild(OS.icon(OS.ICON.agenda));
  go.append(document.createTextNode('Agenda'));
  const head = OS.el('div', 'nx-row');
  head.append(av, who, go);
  const rest = rows.slice(1).map((x) => {
    const b = OS.el('button', 'nx-more');
    b.type = 'button';
    b.dataset.ooWho = x.email;
    b.append(OS.el('span', 'oo-time', OS.oo.when(x)), OS.el('span', null, x.name));
    return b;
  });
  return [head, ...rest];
});


// ===================== PERSON PANEL ACTIONS =====================
dash.draw('pd-act', (box) => {
  const n = dash.params().person;
  const p = n && OS.state('person') === 'ok' ? (dash.data('person').data || []).find((r) => r.name === n) : null;
  const out = [];
  const em = n ? emailOf(n) : null;
  const mail = em ? OS.links.mail(em, '', 'Hi ' + firstName(n) + ',\n\n') : null;
  if (mail) out.push(mail);
  const sf = p && p.userId ? OS.links.sf('User', p.userId) : null;
  if (sf) out.push(sf);
  const lvAll = n ? OS.leavers() : null;
  const left = lvAll ? lvAll.rows.find((r) => r.name === n) || null : null;
  const ask = left ? lvAsk(left) : n ? OS.links.ask(OS.ask.data('About ' + n, 'Give me a quick read on ' + n + (p ? ' (' + (p.role || 'no role') + ', ' + (p.region || '') + ', manager ' + (p.manager || 'none') + ')' : '') + ' from the EMEA RevOps OS: their pipeline and deals at risk, created opps, routing, book, open follow-ups with me and their selling activity in the last 4 weeks (counts only, no names of people or companies outside Legora, no subjects or email text in chat), and what I should do about any of it. Read only: change nothing and send nothing without my OK.', { kind: 'person', person: n, userId: p ? p.userId : null })) : null;
  if (ask) out.push(ask);
  box.replaceChildren(...out);
});
dash.draw('oo-mail', (box) => {
  const w = OS.oo.who();
  // no email link until the agenda's sources have loaded (as Copy and Send): a half-built agenda would go out as if complete
  const loading = !!w && OS.oo.loading(w);
  const text = w && !w.startsWith('n:') && !loading ? OS.oo.text() : '';
  const name = w ? OS.oo.nameOf(w) : '';
  const a = text ? OS.links.mail(w, '1:1 agenda', text) : null;
  box.replaceChildren(...(a ? [a] : []));
  if (a) a.setAttribute('aria-label', 'Email the agenda to ' + name);
});

// ===================== MOVEMENT =====================
const scopeRowOf = (el, id) => markRow(el, 'region', scopeKey(), (dash.data(id).data || []).find((r) => r.region === scopeKey()));
const fmtBy = (el, v) => (v == null ? '—' : el.dataset.fmt === 'usd' ? OS.usd(v) : el.dataset.fmt === 'pct' ? OS.pct(v) : el.dataset.fmt === 'x' ? d3.format('.1f')(v) + '×' : el.dataset.fmt === 'days' ? OS.num(Math.round(v)) + 'd' : OS.num(v));
dash.draw('kpi-mv', (el) => OS.value(el, ['moves_kpi'], () => fmtBy(el, scopeRowOf(el, 'moves_kpi')[keepField(el)] || 0)));
OS.defTable('mv-table', ['pipe_moves'], () => (dash.data('pipe_moves').data || []).filter(inTeam)
  .filter((r) => r.created || r.won || r.lost || r.pushed || r.pulled || r.up || r.down || r.intoCommit || r.outCommit)
  .sort((a, b) => (b.pushedArr + b.lostArr + b.outCommitArr) - (a.pushedArr + a.lostArr + a.outCommitArr)), [
  { f: 'owner', person: (r) => r.owner }, { f: 'region' },
  { f: 'created', fmt: OS.num, num: true }, { f: 'createdArr', fmt: OS.usd, num: true },
  { f: 'won', fmt: OS.num, num: true }, { f: 'wonArr', fmt: OS.usd, num: true, cls: (v) => (v > 0 ? 'os-ok' : '') },
  { f: 'lost', fmt: OS.num, num: true }, { f: 'lostArr', fmt: OS.usd, num: true, cls: (v) => (v > 0 ? 'os-bad' : '') },
  { f: 'pushed', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-bad' : '') }, { f: 'pushedArr', fmt: OS.usd, num: true },
  { f: 'pulled', fmt: OS.num, num: true },
  { f: 'up', fmt: OS.num, num: true }, { f: 'down', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
  { f: 'intoCommit', fmt: OS.num, num: true }, { f: 'outCommit', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
], { key: 'key' });

// ===================== COVERAGE =====================
const covKey = () => (mgrPick() ? 'M|' + mgrPick() : OS.region() === 'All' ? 'All|All' : OS.region() + '|All');
dash.draw('kpi-cov', (el) => OS.value(el, ['pipe_cover'], () => {
  const r = markRow(el, 'key', covKey(), (dash.data('pipe_cover').data || []).find((x) => x.key === covKey()));
  return keepField(el) === 'coverageThis' && r.aheadOfUsual ? 'Past usual' : fmtBy(el, r[keepField(el)]);
}));
const covStatus = (r) => (r.avgBookings <= 0 ? 'No history' : r.aheadOfUsual ? 'Ahead of a usual quarter' : r.coverageThis >= 3 ? 'Covered' : r.coverageThis >= 1.5 ? 'Watch' : 'Thin');
OS.defTable('cov-table', ['pipe_cover'], () => {
  const rows = dash.data('pipe_cover').data || [];
  const pick = mgrPick() ? rows.filter((r) => r.level === 'team' && r.manager === mgrPick())
    : OS.region() === 'All' ? rows.filter((r) => r.level === 'region' && (r.avgBookings || r.openThis || r.openNext))
    : rows.filter((r) => r.level === 'team' && r.region === OS.region());
  return pick.map((r) => ({ ...r, status: covStatus(r) })).sort((a, b) => b.avgBookings - a.avgBookings);
}, [
  { f: 'region' }, { f: 'manager' },
  { f: 'avgBookings', fmt: OS.usd, num: true }, { f: 'wonSoFar', fmt: OS.usd, num: true },
  { f: 'openThis', fmt: OS.usd, num: true, bar: (l) => d3.max(l, (r) => r.openThis) },
  { f: 'coverageThis', fmt: (v) => (v == null ? '—' : d3.format('.1f')(v) + '×'), num: true },
  { f: 'openNext', fmt: OS.usd, num: true }, { f: 'coverageNext', fmt: (v) => (v == null ? '—' : d3.format('.1f')(v) + '×'), num: true },
  { f: 'winRate', fmt: (v) => (v == null ? '—' : OS.pct(v)), num: true },
  { f: 'projectedThis', fmt: (v) => (v == null ? '—' : OS.usd(v)), num: true },
  { f: 'avgCycleDays', fmt: (v) => (v == null ? '—' : OS.num(Math.round(v))), num: true },
  { f: 'status', chip: (v) => (v === 'Thin' ? 'bad' : v === 'Watch' ? 'warn' : v === 'Covered' || /Ahead/.test(v) ? 'ok' : '') },
], { key: 'key' });

// ===================== ENGAGEMENT =====================
dash.draw('kpi-eng', (el) => OS.value(el, ['engagement_kpi'], () => fmtBy(el, scopeRowOf(el, 'engagement_kpi')[keepField(el)] || 0)));
OS.defTable('eng-table', ['engagement'], () => (dash.data('engagement').data || []).filter(inTeam)
  .filter((r) => r.untouched || r.noEm || r.emNotEm)
  .sort((a, b) => b.untouched - a.untouched || b.noEm - a.noEm), [
  { f: 'owner', person: (r) => r.owner }, { f: 'region' },
  { f: 'active', fmt: OS.num, num: true },
  { f: 'untouched', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.untouched) },
  { f: 'share', fmt: (v) => (v == null ? '—' : OS.pct(v)), num: true, cls: (v) => (v != null && v >= 0.2 ? 'os-warn' : '') },
  { f: 'never', fmt: OS.num, num: true },
  { f: 'untouchedCustomers', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-bad' : '') },
  { f: 'noEm', fmt: OS.num, num: true, cls: (v) => (v > 0 ? 'os-warn' : '') },
  { f: 'emNotEm', fmt: OS.num, num: true },
  { f: 'flag', cls: (v) => (v ? 'os-warn' : '') },
], { key: 'owner' });


// ===================== LEADS =====================
// Rows carry region (the team) and manager, so inTeam() scopes them; the queue and owners outside EMEA sales have
// region 'Queue' or 'Other' and no manager, so they show under All EMEA only. Requests to Claude carry owners, counts
// and filters, never lead details; Claude reads the leads with the viewer's own access.
const LD_TEAMS = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
const ldPlural = (v, one, many) => OS.num(v) + ' ' + (v === 1 ? one : many);
const ldHours = (v, atLeast) => (v == null ? '—' : (atLeast ? '≥ ' : '') + d3.format('.1f')(v) + ' h');
const ldOf = (a, b) => (b ? OS.num(a) + ' of ' + OS.num(b) : '—');
const ldRate = (v) => (v == null ? '—' : OS.pct(v));
const ldBad = (v) => (v > 0 ? 'os-bad' : '');
const ldWarn = (v) => (v > 0 ? 'os-warn' : '');
const ldTeamName = (k) => (k === 'All' ? 'All EMEA' : String(k).startsWith('M|') ? String(k).slice(2) + "'s team" : k);
const ldLeftTip = (r) => [r.notScored ? OS.num(r.notScored) + ' SMB (not scored)' : '', r.reReadied ? OS.num(r.reReadied) + ' re-readied' : '', r.automated ? OS.num(r.automated) + ' automated' : '', r.noStamp ? OS.num(r.noStamp) + ' no stamp' : ''].filter(Boolean).join(' · ');
const ldMgr = (r) => (r.manager && r.manager !== '(no manager)' ? ', manager ' + r.manager : '');
const ldAsk = (label, text, extra) => OS.links.ask(OS.ask.data(label, text, { kind: 'leads', ...extra }));
// Leads an EMEA seller owns count whatever their region; for a queue or an owner outside EMEA sales the dashboard
// counts only EMEA leads, so the request carries that filter, the count to match, and the counts-only rule.
const LD_SCOPE = "(Region__c = 'EMEA' OR Routing_Region__c = 'EMEA')";
const LD_GUARD = ' Report counts and groups only: no lead names, emails or companies in chat.';
const ldNotSeller = (r) => r.kind === 'Queue' || r.kind === 'Outside EMEA sales' || r.ownerType === 'Queue' || r.region === 'Queue' || r.region === 'Other';
const ldOwnerFilter = (r) => {
  const ok = String(r.ownerKey || r.key || '');
  const queueId = ok.startsWith('queue:') ? ok.slice(6).split('|')[0] : null;
  const owner = r.ownerId ? 'OwnerId = ' + r.ownerId : queueId ? 'OwnerId = ' + queueId + ' (' + r.owner + ')' : 'owner ' + r.owner;
  return owner + (ldNotSeller(r) ? ' and ' + LD_SCOPE : '');
};
const ldMatch = (n) => ' The dashboard counts ' + OS.num(n) + '; if your count differs, stop and tell me before going on.';
const ldActs = (r, ask) => {
  const box = OS.el('span', 'row-acts');
  const sf = r.ownerId ? OS.links.sf('User', r.ownerId) : null;
  if (sf) box.append(sf);
  if (ask) box.append(ask);
  return box.children.length ? box : null;
};

// headline tiles: the scope's row, or the All EMEA row for tiles marked data-all, of the calc the mark names
// (ld_kpi speed and backlog, ld_kpi_rt routing, ld_kpi_in inflow, ld_badge demo requests waiting)
const ldRow = (el, id) => {
  const key = el.hasAttribute('data-all') ? 'All' : scopeKey();
  return markRow(el, 'region', key, (dash.data(id).data || []).find((r) => r.region === key));
};
const ldDay = (v) => (v && /^\d{4}-\d\d-\d\d/.test(String(v)) ? OS.day(v) : v || '—');
dash.draw('kpi-ld', (el) => {
  if (!el.dataset.s0) el.dataset.s0 = el.dataset.source;
  const id = el.dataset.s0;
  OS.value(el, [id], () => {
  const r = ldRow(el, id), f = keepField(el), v = r[f], fmt = el.dataset.fmt;
  if (fmt === 'pct') return ldRate(v);
  if (fmt === 'hours') return ldHours(v, r[f.replace('MedianHours', 'MedianAtLeast')]);
  if (fmt === 'min') return v == null ? '—' : d3.format('.1f')(v) + ' min';
  if (fmt === 'day') return ldDay(v);
  return v === null && el.hasAttribute('data-all') ? '—' : OS.num(v || 0);
  });
});

// ----- Speed -----
const ldTeamAsk = (r) => ldAsk('Explain speed: ' + ldTeamName(r.region), 'Explain lead speed for ' + ldTeamName(r.region) + ' over the last 30 days, from the EMEA RevOps OS. ' + ldOf(r.hWithin, r.hEligible) + ' demo requests were worked within 1 business day'
  + (r.hMedianHours != null ? ' (median ' + ldHours(r.hMedianHours, r.hMedianAtLeast) + ' business hours)' : '') + ', and ' + ldOf(r.lWithin, r.lEligible) + ' other hand-offs within 5 business days. '
  + OS.num(r.leftOut) + ' hand-offs were left out (' + (ldLeftTip(r) || 'none') + '). With my Salesforce access, pull the late and still-waiting hand-offs of EMEA sellers in ' + ldTeamName(r.region)
  + ', group them by owner, source and weekday (source and age only, no prospect details), and suggest what to change. Read only: change nothing and send nothing.', { team: r.region });
OS.defTable('ld-team-table', ['ld_kpi'], () => {
  const rows = dash.data('ld_kpi').data || [];
  const cur = scopeKey();
  const list = LD_TEAMS.map((k) => rows.find((r) => r.region === k)).filter(Boolean);
  if (cur.startsWith('M|')) { const m = rows.find((r) => r.region === cur); if (m) list.unshift(m); }
  return list.map((r) => ({ ...r, team: ldTeamName(r.region), hOf: ldOf(r.hWithin, r.hEligible), lOf: ldOf(r.lWithin, r.lEligible), _cls: r.region === cur ? 'os-total' : '' }));
}, [
  { f: 'team', after: (r) => ldTeamAsk(r) },
  { f: 'handoffs', fmt: OS.num, num: true, tip: (r) => OS.num(r.last7) + ' in the last 7 days' },
  { f: 'hOf', num: true }, { f: 'hRate', fmt: ldRate, num: true },
  { f: 'hMedianHours', fmt: (v, r) => ldHours(v, r.hMedianAtLeast), num: true },
  { f: 'hWaiting', fmt: OS.num, num: true, cls: ldBad },
  { f: 'lOf', num: true }, { f: 'lRate', fmt: ldRate, num: true },
  { f: 'leftOut', fmt: OS.num, num: true, tip: ldLeftTip },
  { f: 'readyNow', fmt: OS.num, num: true },
  { f: 'demoOverdue', fmt: OS.num, num: true, cls: ldBad },
], { key: 'region' });

// SMB leads are moved out of Ready by automation, so an SMB rep gets a backlog review, not a speed review
const ldRepAsk = (r) => (!r.scored
  ? ldAsk('Ready review: ' + r.owner, 'Review the Ready leads of ' + r.owner + ' (' + (r.role || 'no role') + ', ' + r.region + ldMgr(r) + ') from the EMEA RevOps OS. Speed isn\'t timed for SMB-owned leads, because automation moves them out of Ready. They hold '
    + ldPlural(r.readyNow, 'Ready lead', 'Ready leads') + ' now, ' + ldPlural(r.demoOverdue, 'demo request', 'demo requests') + ' waiting 2+ business days. With my Salesforce access, list their Ready leads (OwnerId = ' + r.ownerId
    + ", Status = 'Ready', IsConverted = false) grouped by source and age, demo requests first, and say which need a person now." + LD_GUARD + ' Read only: change nothing and send nothing.', { person: r.owner, userId: r.ownerId })
  : ldAsk('Speed review: ' + r.owner, 'Review lead speed for ' + r.owner + ' (' + (r.role || 'no role') + ', ' + r.region + ldMgr(r) + ') from the EMEA RevOps OS. In the last 30 days they were handed '
    + ldPlural(r.handoffs, 'lead', 'leads') + ': ' + (r.hEligible ? OS.num(r.hWithin) + ' of ' + OS.num(r.hEligible) + ' demo requests were worked within 1 business day' + (r.hMedianHours != null ? ' (median ' + ldHours(r.hMedianHours, r.hMedianAtLeast) + ' business hours)' : '') : 'no demo requests came due, so none were timed')
    + '; ' + (r.lEligible ? OS.num(r.lWithin) + ' of ' + OS.num(r.lEligible) + ' other hand-offs were worked within 5 business days' : 'no other hand-offs came due') + '. ' + ldPlural(r.demoOverdue, 'demo request is', 'demo requests are') + ' in Ready for 2+ business days now. With my Salesforce access, list their leads (OwnerId = '
    + r.ownerId + ') with Ready Since in the last 30 days that left Ready late or are still Ready past due. Group them by source and weekday, oldest first, and show source and age only. Say what is slowing them down and suggest one or two fixes (routing, capacity, a reminder).' + LD_GUARD + ' Read only: change nothing and send nothing.', { person: r.owner, userId: r.ownerId }));
const ldStatusCls = (v) => (v === 'Left' || v === 'Demo waiting' ? 'bad' : v === 'Slow' || v === 'Demo past due' ? 'warn' : v === 'On time' ? 'ok' : '');
OS.defTable('ld-rep-table', ['ld_reps'], () => (dash.data('ld_reps').data || []).filter((r) => inTeam(r) && (r.handoffs > 0 || r.readyNow > 0))
  .map((r) => ({ ...r, hOf: ldOf(r.hWithin, r.hEligible), lOf: ldOf(r.lWithin, r.lEligible) })), [
  { f: 'owner', person: (r) => r.owner, after: (r) => ldActs(r, ldRepAsk(r)) }, { f: 'region' }, { f: 'manager' },
  { f: 'handoffs', fmt: OS.num, num: true, tip: (r) => OS.num(r.last7) + ' in the last 7 days' },
  { f: 'hOf', num: true }, { f: 'hRate', fmt: ldRate, num: true },
  { f: 'hMedianHours', fmt: (v, r) => ldHours(v, r.hMedianAtLeast), num: true },
  { f: 'demoOverdue', fmt: OS.num, num: true, cls: ldBad, tip: (r) => (r.hWaiting ? ldPlural(r.hWaiting, 'demo hand-off', 'demo hand-offs') + ' from the last 30 days past the 1-business-day due time' : '') },
  { f: 'lOf', num: true }, { f: 'lRate', fmt: ldRate, num: true },
  { f: 'leftOut', fmt: OS.num, num: true, tip: ldLeftTip },
  { f: 'readyNow', fmt: OS.num, num: true, tip: (r) => [r.stale ? OS.num(r.stale) + ' over 20 business days or Ready since before 19 May 2026' : '', r.elsewhere ? OS.num(r.elsewhere) + ' routed to another region' : ''].filter(Boolean).join(' · ') },
  { f: 'status', chip: ldStatusCls },
], { key: 'key', also: ['role'] });

const LD_SEV = { warn: 'medium', bad: 'high', info: 'low' };
OS.defList('ld-trust-list', ['ld_trust'], () => (dash.data('ld_trust').data || []).concat(OS.state('ld_trust_cap') === 'ok' ? dash.data('ld_trust_cap').data || [] : []), (rows) => rows.map((t) => {
  const li = OS.el('li', 'itm');
  li.dataset.key = t.id;
  const main = OS.el('div', 'itm-main');
  const val = t.value == null ? '—' : t.fmt === 'pct' ? OS.pct(t.value) : OS.num(t.value);
  main.append(OS.el('span', 'itm-title', t.measure + ': ' + val), OS.el('span', 'itm-detail', t.detail));
  li.append(OS.el('span', 'itm-dot ' + (LD_SEV[t.severity] || 'low')), main);
  return li;
}));

// ----- Ready now -----
const ldWho = (r) => (r.kind === 'Outside EMEA sales' ? (!r.active ? 'Inactive, outside EMEA sales' : r.review ? 'Strategic or partnerships' : r.kind) : r.kind);
const ldWhoCls = (v) => (v === 'Left (inactive)' || v === 'Inactive, outside EMEA sales' ? 'bad' : v === 'Outside EMEA sales' ? 'warn' : v === 'Queue' ? 'info' : '');
const ldTodoCls = (v) => (v === 'Nudge owner' || v === 'Reassign' || v === 'Route to a person' || v === 'Fix routing' ? 'bad' : v ? 'warn' : '');
const ldOpenTip = (r) => [r.working ? OS.num(r.working) + ' being worked' : '', r.fresh ? OS.num(r.fresh) + ' New' : '', r.nurturing ? OS.num(r.nurturing) + ' Nurturing' : ''].filter(Boolean).join(' · ');
const ldBacklogAsk = (r) => {
  const who = r.owner + ' (' + (r.role || 'no role') + ldMgr(r) + ')';
  const counts = OS.num(r.ready) + ' Ready leads: ' + ldPlural(r.demoOverdue, 'demo request', 'demo requests') + ' waiting 2+ business days, ' + OS.num(r.b21) + ' waiting over 20 business days, ' + OS.num(r.noDateAll) + ' with no Ready date, and ' + OS.num(r.elsewhere) + ' routed to another region' + (r.regions ? ' (' + r.regions + ')' : '');
  const list = '(' + ldOwnerFilter(r) + ", Status = 'Ready', IsConverted = false)";
  const openList = '(' + ldOwnerFilter(r) + ", IsConverted = false, Status NOT IN ('Disqualified','Converted'))";
  const ok = ' Show the record count and the exact owner or field changes, and wait for my OK before changing anything.';
  if (r.todo === 'Nudge owner') return ldAsk('Nudge ' + r.owner, 'Nudge ' + who + ' about Ready leads from the EMEA RevOps OS. They hold ' + counts + '. With my Salesforce access, list their Ready leads ' + list + ', demo requests first, then oldest first, with source and age only. Draft a short Slack message to ' + r.owner + (r.manager && r.manager !== '(no manager)' ? ', copying ' + r.manager + ' when a demo request has waited over 3 business days' : '') + ', with counts, sources and ages only (no lead names, emails or companies: they can open their Ready leads in Salesforce). Show me the message and the recipients, and wait for my OK before sending.', { person: r.owner, userId: r.ownerId, todo: r.todo });
  if (r.todo === 'Clean up Ready') return ldAsk('Clean up Ready: ' + r.owner, 'Plan a clean-up of the Ready leads of ' + who + ' from the EMEA RevOps OS. They hold ' + counts + '. With my Salesforce access, group their Ready leads ' + list + ' by source, routing region and age (no prospect details in chat). Propose one of these per group: work now, move to Nurturing, Disqualify with a Disposed Reason, or reassign to the team of the routing region. Show the record count and the exact field changes per group as a dry run, and change nothing until I say OK.', { person: r.owner, userId: r.ownerId, todo: r.todo });
  if (r.todo === 'Check region') return ldAsk('Check region: ' + r.owner, who + ' holds ' + OS.num(r.elsewhere) + ' Ready leads that LeanData routed outside EMEA (' + (r.regions || 'other regions') + '), out of ' + OS.num(r.ready) + ' Ready. With my Salesforce access, check how they reached an EMEA seller (owner history, LeanData log) and whether they belong to EMEA. Propose who should own the rest (the team of their routing region).' + LD_GUARD + ok, { person: r.owner, userId: r.ownerId, todo: r.todo });
  if (r.todo === 'Reassign') return ldAsk('Reassign leads: ' + r.owner, r.owner + (r.kind === 'Outside EMEA sales' ? ' is inactive in Salesforce (' + (r.role || 'no role') + ', outside EMEA sales)' : ' has left (inactive in Salesforce; ' + (r.role || 'no role') + ldMgr(r) + ')') + ' but still holds ' + OS.num(r.ready) + ' Ready EMEA leads' + (r.open != null ? ' and ' + OS.num(r.open) + ' open in all' : '') + '. With my Salesforce access, propose new owners for their open leads ' + openList + (r.kind === 'Outside EMEA sales' ? ' from the EMEA LeanData pool matching each lead\'s segment and routing sub-region' : ' from the LeanData pool of their kind and team') + ', lightest load first, per group of leads. Also tell me whether they still hold a pool seat.' + (r.open != null ? ldMatch(r.open) : ldMatch(r.ready).replace('counts ', 'counts at least ')) + LD_GUARD + ok, { person: r.owner, userId: r.ownerId, todo: r.todo });
  if (r.todo === 'Reassign or confirm') return ldAsk('Check owner: ' + r.owner, r.owner + ' (' + (r.role || 'no role') + ', outside EMEA sales) holds ' + OS.num(r.ready) + ' Ready EMEA leads ' + list + (r.open != null ? ' (' + OS.num(r.open) + ' open)' : '') + '. With my Salesforce access, check for each one whether it matches an account they own (LeanData account match) or was routed by mistake. Keep the account-matched ones, and propose EMEA owners from the right LeanData pool for the rest.' + ldMatch(r.ready) + LD_GUARD + ok, { userId: r.ownerId, todo: r.todo });
  if (r.todo === 'Review') return ldAsk('Review leads: ' + r.owner, r.owner + ' (' + (r.role || 'no role') + ') holds ' + OS.num(r.ready) + ' Ready EMEA leads ' + list + (r.open != null ? ' (' + OS.num(r.open) + ' open)' : '') + '. Strategic and partnership owners can be right. With my Salesforce access, check whether each lead matches one of their accounts or a partner deal, and say how many should go to EMEA sales.' + ldMatch(r.ready) + LD_GUARD + ' Read only: change nothing.', { userId: r.ownerId, todo: r.todo });
  if (r.todo === 'Route to a person') return ldAsk('Route: ' + r.owner, OS.num(r.ready) + ' leads are Ready in ' + r.owner + ' with no person' + (r.oldest ? ' (oldest Ready since ' + ldDay(r.oldest) + ')' : '') + '. With my Salesforce access, list them ' + list + ' and find why LeanData did not route them (segment, country, routing sub-region, flow path). Propose an owner per group of leads from the pool matching its segment and sub-region, keeping the round robin even.' + ldMatch(r.ready) + LD_GUARD + ok, { todo: r.todo });
  return null;
};
// the owner's other open leads join from ld_backlog_open when that query loads (— until then)
const ldOpenOf = () => (OS.state('ld_backlog_open') === 'ok' ? new Map((dash.data('ld_backlog_open').data || []).map((x) => [x.key, x])) : null);
OS.defTable('ld-backlog-table', ['ld_backlog'], () => {
  const f = dash.params().ldReady || '';
  const op = ldOpenOf();
  return (dash.data('ld_backlog').data || []).filter(inTeam)
    .filter((r) => (f === 'demo' ? r.demoOverdue > 0 : f === 'stale' ? r.stale > 0 : f === 'region' ? r.elsewhere > 0 : f === 'notseller' ? r.kind === 'Queue' || r.kind === 'Outside EMEA sales' : true))
    .map((r) => { const o = op ? op.get(r.key) || { open: r.ready, working: 0, fresh: 0, nurturing: 0 } : null;
      return { ...r, who: ldWho(r), open: o ? Math.max(o.open, r.ready) : null, working: o ? o.working : null, fresh: o ? o.fresh : null, nurturing: o ? o.nurturing : null, otherOpen: o ? Math.max(0, o.open - r.ready) : null }; });
}, [
  { f: 'owner', person: (r) => (r.kind === 'EMEA seller' || r.kind === 'Left (inactive)' ? r.owner : null), after: (r) => ldActs(r, ldBacklogAsk(r)) },
  { f: 'who', chip: ldWhoCls }, { f: 'region' }, { f: 'manager' },
  { f: 'ready', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.ready) },
  { f: 'demo', fmt: OS.num, num: true },
  { f: 'demoOverdue', fmt: OS.num, num: true, cls: ldBad },
  { f: 'b1', fmt: OS.num, num: true }, { f: 'b5', fmt: OS.num, num: true }, { f: 'b20', fmt: OS.num, num: true },
  { f: 'b21', fmt: OS.num, num: true, cls: ldWarn },
  { f: 'noDateAll', fmt: OS.num, num: true, tip: (r) => (r.noDateAll ? OS.num(r.noDate) + ' Ready since before 19 May 2026 · ' + OS.num(r.stampGap) + ' created later with no stamp' : '') },
  { f: 'elsewhere', fmt: OS.num, num: true, cls: ldWarn, tip: (r) => r.regions || '' },
  { f: 'oldest', fmt: ldDay },
  { f: 'otherOpen', fmt: (v) => (v == null ? '—' : OS.num(v)), num: true, tip: ldOpenTip },
  { f: 'todo', chip: ldTodoCls },
], { key: 'key', also: ['role', 'regions'] });

// ----- Routing -----
const ldSevLabel = { high: 'High', medium: 'Medium', low: 'Low' };
const ldProbAsk = (r) => {
  const where = r.ownerType === 'Queue' ? r.owner : r.owner + ' (' + (r.role || 'no role') + ')';
  const ok = ' Show the record count and the exact changes, and wait for my OK before changing anything.';
  const base = { userId: r.ownerId, problem: r.kind };
  const own = ldOwnerFilter(r);
  const open = "IsConverted = false, Status NOT IN ('Disqualified','Converted'), " + own;
  if (r.action === 'Fix routing') return ldAsk('Fix routing: ' + r.owner, OS.num(r.leads) + ' open leads are ' + (r.kind === 'Routing error' ? 'in LeanData routing error' : 'not processed by LeanData') + (r.ldAction ? ' (' + r.ldAction + ')' : '') + ' with ' + where + ' (' + r.statuses + (r.lastProcessed ? '; LeanData last processed ' + OS.day(r.lastProcessed) : '') + '). With my Salesforce access, find them (' + open + '; ' + (r.kind === 'Routing error' ? "LeanData__Routing_Status__c = 'error' or LeanData__Routing_Action__c starting with 'error'" : "LeanData__Routing_Status__c = 'not processed'") + ') and read the cause in LeanData. Group them by cause and propose the fix per group: re-run routing, fill the missing field, or a named owner from the right pool.' + ldMatch(r.leads) + LD_GUARD + ok, base);
  if (r.kind === 'Ready in a queue') return ldAsk('Route: ' + r.owner, OS.num(r.leads) + ' leads are Ready in ' + r.owner + ' with no person' + (r.oldestReadyDay ? ' (oldest Ready since ' + ldDay(r.oldestReadyDay) + ')' : '') + '. With my Salesforce access, list them (' + own + ", Status = 'Ready', IsConverted = false) and find why LeanData did not route them (segment, country, routing sub-region, flow path). Propose an owner per group of leads from the pool matching its segment and sub-region, keeping the round robin even." + ldMatch(r.leads) + LD_GUARD + ok, base);
  if (r.kind === 'MQL not handed off') return ldAsk('MQLs in ' + r.owner, OS.num(r.leads) + ' leads in ' + r.owner + ' are MQLs but still New (' + own + ", Status = 'New', Lifecycle_Stage__c = 'MQL'). With my Salesforce access, check why they were not marked Ready and routed, then propose per group either Ready with an owner from the right pool, or nurture." + ldMatch(r.leads) + LD_GUARD + ok, base);
  if (r.kind === 'Worked lead back in the queue') return ldAsk('Worked leads in ' + r.owner, OS.num(r.leads) + ' leads in Pursuing or Engaging sit in ' + r.owner + ' with no person (' + r.statuses + '; ' + own + "). With my Salesforce access, find who last worked them (owner history), and propose who should own them now or whether to nurture them." + ldMatch(r.leads) + LD_GUARD + ok, base);
  if (r.action === 'Reassign') return ldAsk('Reassign leads: ' + r.owner, r.owner + ' is inactive in Salesforce (' + (r.role || 'no role') + ldMgr(r) + ') but still holds ' + OS.num(r.leads) + ' open EMEA leads (' + r.statuses + '; ' + open + '). With my Salesforce access, propose new owners from the right LeanData pool, lightest load first, per group of leads.' + ldMatch(r.leads) + LD_GUARD + ok, base);
  if (r.action === 'Reassign or confirm') return ldAsk('Check owner: ' + r.owner, r.owner + ' (' + (r.role || 'no role') + ', outside EMEA sales) holds ' + OS.num(r.leads) + ' open EMEA leads (' + r.statuses + '; ' + open + '). With my Salesforce access, check for each one whether it matches an account they own (LeanData account match) or was routed by mistake. Keep the account-matched ones, and propose EMEA owners from the right LeanData pool for the rest.' + ldMatch(r.leads) + LD_GUARD + ok, base);
  if (r.action === 'Review') return ldAsk('Review leads: ' + r.owner, r.owner + ' (' + (r.role || 'no role') + ') holds ' + OS.num(r.leads) + ' open EMEA leads (' + r.statuses + '; ' + open + '). Strategic and partnership owners can be right. With my Salesforce access, check whether each lead matches one of their accounts or a partner deal, and say how many should go to EMEA sales.' + ldMatch(r.leads) + LD_GUARD + ' Read only: change nothing.', base);
  return null;
};
const ldKindCls = (v) => (/error|Ready in a queue|inactive/i.test(v) ? 'bad' : /Strategic/.test(v) ? '' : 'warn');
OS.defTable('ld-prob-table', ['ld_problems'], () => {
  const f = dash.params().ldProb || '';
  return (dash.data('ld_problems').data || []).filter(inTeam)
    .filter((r) => (f === 'routing' ? r.routing : f === 'wrong' ? r.kind === 'Owner inactive' || r.kind === 'Owner outside EMEA sales' : f === 'review' ? r.kind === 'Strategic or partnerships owner' : true))
    .map((r) => ({ ...r, sev: ldSevLabel[r.severity] || r.severity,
      note: [r.kind === 'Ready in a queue' && r.oldestReadyDay ? 'oldest Ready since ' + ldDay(r.oldestReadyDay) : '', r.kind === 'Ready in a queue' && r.demoRequests ? ldPlural(r.demoRequests, 'demo request', 'demo requests') : '', r.neverProcessed ? OS.num(r.neverProcessed) + ' never processed by LeanData' : '', r.leaver ? 'also under Hiring › Leavers' : ''].filter(Boolean).join(' · ') }));
}, [
  { f: 'sev', chip: (v, r) => (r.severity === 'high' ? 'bad' : r.severity === 'medium' ? 'warn' : '') },
  { f: 'kind', chip: ldKindCls },
  { f: 'owner', person: (r) => (r.ownerType === 'User' && r.region !== 'Other' ? r.owner : null), after: (r) => ldActs(r, ldProbAsk(r)) },
  { f: 'role' }, { f: 'region' },
  { f: 'leads', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.leads) },
  { f: 'ready', fmt: OS.num, num: true, cls: ldWarn },
  { f: 'statuses', wrap: true }, { f: 'ldAction' },
  { f: 'lastProcessed', fmt: (v) => (v ? OS.day(v) : '—') },
  { f: 'note', wrap: true },
  { f: 'action', chip: ldTodoCls },
], { key: 'key' });

const ldSrcAsk = (r) => ldAsk('Source review: ' + r.src + ' › ' + r.detail, 'Review the ' + r.src + ' › ' + r.detail + ' leads in the EMEA RevOps OS (all EMEA): ' + OS.num(r.created) + ' created in 30 days (' + OS.num(r.inQueue) + ' in a queue, ' + OS.num(r.toPerson) + ' routed to a person, '
  + OS.num(r.autoConverted) + ' auto-converted to a contact, ' + OS.num(r.errors) + ' routing errors); ' + OS.num(r.handoffs) + ' handed off in 30 days, ' + ldOf(r.within, r.eligible) + ' worked within ' + r.due + '; ' + OS.num(r.readyNow) + ' in Ready now, '
  + OS.num(r.over20) + ' of them for over 20 business days or Ready since before 19 May 2026. With my Salesforce access, check whether routing and follow-up for this source work (counts only, no prospect details in chat), and suggest what to change (routing rule, SLA, nurture path). Read only: change nothing.', { leadSource: r.src, leadDetail: r.detail });
OS.defTable('ld-src-table', ['ld_sources'], () => (dash.data('ld_sources').data || []).map((r) => ({ ...r, inTime: ldOf(r.within, r.eligible) })), [
  { f: 'src' }, { f: 'detail', after: (r) => ldSrcAsk(r) },
  { f: 'created', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.created) },
  { f: 'inQueue', fmt: OS.num, num: true },
  { f: 'toPerson', fmt: OS.num, num: true, tip: (r) => (r.toPersonShare != null ? OS.pct(r.toPersonShare) + ' of those created' : '') },
  { f: 'autoConverted', fmt: OS.num, num: true, tip: (r) => (r.autoShare != null ? OS.pct(r.autoShare) + ' of those created' : '') },
  { f: 'errors', fmt: OS.num, num: true, cls: ldBad },
  { f: 'handoffs', fmt: OS.num, num: true },
  { f: 'inTime', num: true, tip: (r) => 'due within ' + r.due },
  { f: 'rate', fmt: ldRate, num: true },
  { f: 'readyNow', fmt: OS.num, num: true },
  { f: 'over20', fmt: OS.num, num: true, cls: ldWarn },
], { key: 'key' });

// ===================== ACTIVITY =====================
// Emails sent and external meetings of EMEA sellers: people (act_reps, scoped with inTeam), the headline per scope
// (act_kpi), the usual range by role (act_ranges) and checks on the data (act_trust), both all EMEA, and BDRs (act_bdr).
// Requests to Claude carry counts and the names of our own people only, and end with ACT_GUARD (defined at the top).
const ACT_ROLE = { AE: 'AEs', SMB: 'SMB', BDR: 'BDRs', EM: 'Engagement Managers', Leader: 'leaders' };
const ACT_CORE = { customer: 'customer meetings', prospect: 'prospect meetings', external: 'external meetings' };
const actSigned = (v) => OS.signedPct(v);
const actWk = (v) => (v == null ? '—' : d3.format('.1f')(v));
// times are epoch ms; the calendar is Paris, as in the calcs
const actTs = (t) => (t == null ? '—' : new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).replace(',', ''));
const actBd = (n) => (n == null ? '' : n === 1 ? '1 business day' : OS.num(n) + ' business days');
const actLabel = (s) => (s === 'No capture' || s === 'Capture gap' ? 'Check capture' : s === 'Active' ? '' : s || '');
const actChip = (v) => (v === 'Quiet' ? 'bad' : v === 'Slowing' || v === 'Nothing booked' || v === 'Below range' || v === 'Check capture' ? 'warn' : '');
const actLookFlags = ['Quiet', 'Slowing', 'Nothing booked', 'Below range'];
const actNeedsLook = (r) => (r.flags || []).some((f) => actLookFlags.includes(f));
const actAsk = (label, text, extra) => OS.links.ask(OS.ask.data(label, text, { kind: 'activity', ...extra }));
const actWho = (r) => r.name + ' (' + (ACT_ROLE[r.kind] ? r.kind : 'no sales role') + ', ' + r.region + ldMgr(r) + ')';
const actOwner = (r) => (r.userId ? ' Their Salesforce user: OwnerId = ' + r.userId + '.' : '');
const actGlobal = () => (OS.state('act_reps') === 'ok' ? (dash.data('act_reps').data || [])[0] || null : null);

// ----- headline tiles: the act_kpi row for the scope picked, or for the team the mark names (data-team) -----
const actRow = (el) => {
  const key = el.dataset.team || scopeKey();
  return markRow(el, 'region', key, (dash.data('act_kpi').data || []).find((r) => r.region === key));
};
dash.draw('kpi-act', (el) => OS.value(el, ['act_kpi'], () => {
  const r = actRow(el), f = keepField(el), v = r[f], fmt = el.dataset.fmt;
  if (el.hasAttribute('data-warn')) el.classList.toggle('os-warn', +v > 0);
  if (fmt === 'signed') return actSigned(v);
  if (fmt === 'wk') return actWk(v);
  return v == null ? '—' : OS.num(v);
}));
// the like-for-like change, with how many people it compares, or why there is none
dash.draw('kpi-act-lfl', (el) => OS.value(el, ['act_kpi'], () => {
  const r = actRow(el), f = keepField(el), v = r[f];
  if ((f === 'emailsChg' ? r.mailHidden : r.meetHidden) || r.blind) return 'not visible with your access';
  if (v == null) return 'no like-for-like change yet';
  return actSigned(v) + ' like-for-like (' + OS.num(f === 'emailsChg' ? r.lflMailReps : r.lflMeetReps) + ' people)';
}));
// what the viewer's Salesforce access hides and how their Salesforce time zone shifts the days (OS.actNote, os-core.js);
// apply() shows the note around it only when there is something to say
dash.draw('act-access', (el) => { el.textContent = OS.actNote(el.dataset.ctx || 'activity'); });

// ----- people -----
const actPrepAsk = (r) => {
  const cmp = [r.coreChg != null ? ACT_CORE[r.coreLabel] + ' ' + actSigned(r.coreChg) + ' like-for-like' : r.meetHidden ? '' : 'no like-for-like change: ' + (r.trendNote || 'not compared'), r.emailsChg != null ? 'emails ' + actSigned(r.emailsChg) : ''].filter(Boolean).join(', ');
  const em = r.emails == null ? 'emails not visible with my access' : OS.num(r.emails) + ' emails sent to ' + OS.num(r.people) + ' people at ' + OS.num(r.accounts) + ' accounts';
  const mt = r.meetings == null ? 'meetings not visible with my access' : OS.num(r.meetings) + ' external meetings (' + OS.num(r.meetCust) + ' with customers, ' + OS.num(r.meetPros) + ' with prospects), ' + OS.num(r.booked) + ' booked for the next 2 weeks';
  return actAsk('Prep 1:1 on activity: ' + r.name, 'Before my 1:1 with ' + actWho(r) + ', help me read their selling activity from the EMEA RevOps OS. Last 4 weeks (28 days to yesterday): '
    + mt + ', ' + em + '. The 4 weeks before: '
    + (r.meetings == null ? 'meetings not visible' : OS.num(r.meetPrev) + ' meetings') + ', ' + (r.emails == null ? 'emails not visible' : OS.num(r.emailsPrev) + ' emails') + (cmp ? ' (' + cmp + ')' : '') + '.'
    + (r.emails == null ? '' : ' Last email ' + actTs(r.lastMail) + '.') + (r.meetings == null ? '' : ' Last meeting ' + actTs(r.lastMeet) + '.')
    + ' Flags: ' + ((r.flags || []).join(', ') || 'none') + '.' + actOwner(r) + ' With my Salesforce access, break the last 8 weeks down by week: sent emails captured from their mailbox, external meetings (one per start time) with customers and prospects, and any Outreach calls and LinkedIn steps. Say what changed and suggest 2 or 3 questions for the 1:1.' + ACT_GUARD,
  { person: r.name, userId: r.userId });
};
const actCaptureWhat = (r) => (r.status === 'No capture' ? (r.mailHidden ? 'no external meeting captured in the last 4 weeks (emails not visible with my access)' : r.meetHidden ? 'no sent email captured in the last 4 weeks (meetings not visible with my access)' : 'no sent email and no external meeting captured in the last 4 weeks')
  : r.mailOff ? (r.emails === 0 ? OS.num(r.meetings) + ' meetings but no sent email captured in 4 weeks' : 'no sent email captured since ' + actTs(r.lastMail) + ' while meetings continue')
  : r.calOff ? (r.meetings === 0 ? OS.num(r.emails) + ' emails sent but no external meeting captured in 4 weeks' : 'no external meeting captured since ' + actTs(r.lastMeet) + ' while emails continue') : 'a capture gap');
const actStatusAsk = (r) => {
  if (r.status === 'Quiet') return actAsk('Draft a check-in: ' + r.name, r.name + ' has no sent email or external meeting captured since ' + actTs(r.lastTouch) + ' (' + actBd(r.idle) + '). They may be away or working outside Salesforce. Draft a short, friendly Slack message from me asking how things are going and whether anything is blocking them, without mentioning customers. Show me the message and the recipient and wait for my OK before sending.' + ACT_GUARD, { person: r.name, userId: r.userId });
  if (r.status === 'Nothing booked') return actAsk('Plan the next 2 weeks: ' + r.name, 'Read only: for ' + actWho(r) + ', count ' + (r.kind === 'EM' ? 'customer' : 'prospect') + ' meetings held per week over the last 8 weeks and booked per week for the next 4 (counts only), and suggest how they could fill the next 2 weeks. Don\'t contact anyone or change anything.' + actOwner(r) + ACT_GUARD, { person: r.name, userId: r.userId });
  if (r.status === 'No capture' || r.status === 'Capture gap') return actAsk('Check capture: ' + r.name, 'The EMEA RevOps OS shows ' + actCaptureWhat(r) + ' for ' + actWho(r) + (r.joined ? ', in Salesforce or at Legora since ' + OS.day(r.joined) : '') + '. With my Salesforce access, count their captured sent emails and external calendar events per week over the last 12 weeks (counts only), say whether mailbox or calendar capture looks off and when it stopped, and draft a short note to RevOps with the facts. Show me the draft and wait for my OK before sending; change no settings or records.' + actOwner(r) + ACT_GUARD, { person: r.name, userId: r.userId });
  return null;
};
const actActs = (r) => {
  const box = OS.el('span', 'row-acts');
  const sf = r.userId ? OS.links.sf('User', r.userId) : null;
  if (sf) box.append(sf);
  const ask = r.status === 'Left' || r.status === 'Not visible' ? null : actPrepAsk(r);
  if (ask) box.append(ask);
  return box.children.length ? box : null;
};
// with one channel hidden by the viewer's access, the last touch is the other channel's
const actIdleTip = (r) => (r.idle == null ? '' : actBd(r.idle) + (r.mailHidden ? ' since their last meeting (emails not visible with your access)' : r.meetHidden ? ' since their last email (meetings not visible with your access)' : ' with nothing captured since'));
const actTouchTip = (r) => [actIdleTip(r), r.mailHidden ? '' : 'last email ' + actTs(r.lastMail), r.meetHidden ? '' : 'last meeting ' + actTs(r.lastMeet), r.meetHidden || r.status === 'Not visible' ? '' : r.nextMeet ? 'next meeting booked ' + actTs(r.nextMeet) : 'no meeting booked'].filter(Boolean).join(' · ');
const actRows = () => {
  const p = dash.params();
  return (dash.data('act_reps').data || []).filter((r) => inTeam(r) && (!p.actRole || r.kind === p.actRole) && (!p.actLook || actNeedsLook(r)) && (p.actLeft || r.status !== 'Left'))
    .map((r) => ({ ...r, statusTxt: actLabel(r.status) }));
};
OS.defTable('act-table', ['act_reps'], actRows, [
  { f: 'name', person: (r) => r.name, after: actActs },
  { f: 'region' },
  { f: 'kind' },
  { f: 'meetings', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.meetings || 0), tip: (r) => (r.meetings == null ? (r.meetHidden || r.status === 'Not visible' ? 'not visible with your access' : '') : OS.num(r.events) + ' calendar records, ' + OS.num(r.dupes) + ' repeats removed') },
  { f: 'meetCust', fmt: OS.num, num: true },
  { f: 'meetPros', fmt: OS.num, num: true },
  { f: 'coreChg', fmt: actSigned, num: true, cls: (v, r) => (r.trigger === 'meetings' ? 'os-bad' : ''), tip: (r) => (r.coreChg != null ? OS.num(r.coreNow) + ' vs ' + OS.num(r.corePrev) + ' ' + ACT_CORE[r.coreLabel] : r.meetHidden ? 'not visible with your access' : r.trendNote || '') },
  { f: 'booked', fmt: OS.num, num: true, cls: (v, r) => ((r.flags || []).includes('Nothing booked') ? 'os-warn' : ''), tip: (r) => (r.booked == null ? '' : OS.num(r.bookedCust) + ' with customers · ' + OS.num(r.bookedPros) + ' with prospects' + (r.nextMeet ? ' · next ' + actTs(r.nextMeet) : '')) },
  { f: 'emails', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.emails || 0), tip: (r) => (r.emails == null && (r.mailHidden || r.status === 'Not visible') ? 'not visible with your access' : '') },
  { f: 'people', fmt: OS.num, num: true, tip: (r) => (r.accounts != null ? OS.num(r.accounts) + ' accounts emailed' : '') },
  { f: 'emailsChg', fmt: actSigned, num: true, cls: (v, r) => (r.trigger === 'emails' ? 'os-bad' : ''), tip: (r) => (r.emailsChg != null ? OS.num(r.emails) + ' vs ' + OS.num(r.emailsPrev) : r.mailHidden ? 'not visible with your access' : r.trendNote || '') },
  { f: 'coreWk', fmt: actWk, num: true, cls: (v, r) => ((r.flags || []).includes('Below range') ? 'os-warn' : ''), tip: (r) => (r.coreWk == null ? '' : ACT_CORE[r.coreLabel] + ' a week' + (r.rangeLo != null && r.kind !== 'Leader' ? '; usual for ' + ACT_ROLE[r.kind] + ': ' + actWk(r.rangeLo) + '–' + actWk(r.rangeHi) : '')) },
  { f: 'lastTouch', fmt: actTs, cls: (v, r) => (r.status === 'Quiet' ? (r.idle >= 10 ? 'os-bad' : 'os-warn') : ''), tip: actTouchTip },
  { f: 'statusTxt', fmt: (v) => v || '', chip: actChip, after: actStatusAsk },
], { key: 'name', also: ['manager'] });

// Monday summary for the scope: up to 6 of our own people per list, to stay under the request limit
dash.draw('act-monday', (box) => {
  const k = OS.state('act_kpi') === 'ok' ? (dash.data('act_kpi').data || []).find((r) => r.region === scopeKey()) : null;
  const reps = OS.state('act_reps') === 'ok' ? (dash.data('act_reps').data || []).filter((r) => inTeam(r) && r.active && r.kind !== 'Leader') : null;
  // nothing to summarise when the viewer's access shows no activity for anyone in the scope
  if (!k || !reps || k.blind) { box.replaceChildren(); return; }
  const names = (f) => { const rs = reps.filter((r) => (r.flags || []).includes(f)); return rs.length ? rs.slice(0, 6).map((r) => r.name).join(', ') + (rs.length > 6 ? ' and ' + (rs.length - 6) + ' more' : '') : 'none'; };
  // say what the viewer's access hides, so the summary doesn't present a part as the whole
  const seen = (k.notVisible ? ' My Salesforce access shows no activity for ' + OS.num(k.notVisible) + ' of the ' + OS.num(k.sellers) + ' sellers here: say these numbers may be partial.' : '')
    + (k.mailHidden ? ' My access shows almost no captured emails, so no one can be flagged Quiet.' : k.meetHidden ? ' My access shows almost no meetings, so only email-based flags apply and no one can be flagged Quiet.' : '');
  const b = actAsk('Monday summary: activity, ' + ldTeamName(scopeKey()), 'Write a 5-bullet Monday-meeting summary of selling activity for ' + ldTeamName(scopeKey()) + ' from the EMEA RevOps OS: '
    + (k.meetings == null ? 'meetings not visible with my access' : OS.num(k.meetings) + ' external meetings (' + OS.num(k.meetCust) + ' with customers)') + ' and '
    + (k.emails == null ? 'emails not visible with my access' : OS.num(k.emails) + ' emails') + ' in the last 4 weeks, '
    + (k.meetChg != null ? 'meetings ' + actSigned(k.meetChg) + ' like-for-like (' + OS.num(k.lflMeetReps) + ' people compared)'
      : k.meetHidden ? 'meetings like-for-like not visible with my access' + (k.emailsChg != null ? ', emails ' + actSigned(k.emailsChg) + ' like-for-like (' + OS.num(k.lflMailReps) + ' people compared)' : '') : 'no like-for-like change yet')
    + (k.booked == null ? '' : ', ' + OS.num(k.booked) + ' booked for the next 2 weeks') + (k.mailHidden || k.meetHidden ? '' : '; quiet: ' + names('Quiet'))
    + '; slowing: ' + names('Slowing') + (k.meetHidden ? '' : '; nothing booked: ' + names('Nothing booked'))
    + '; ' + (k.mailHidden ? 'no meeting captured' : k.meetHidden ? 'no sent email captured' : 'nothing captured') + ' (check capture first): ' + names('No capture') + '.' + seen + ' Name our own people only. Draft it for Slack and wait for my OK before posting.' + ACT_GUARD, { team: scopeKey() });
  if (b) { b.classList.remove('ibtn'); b.classList.add('btn'); b.append('Monday summary'); }
  box.replaceChildren(...(b ? [b] : []));
});

// ----- usual range by role (all EMEA) -----
const actRange = (r, f, fmt) => (r[f + '25'] == null ? '—' : fmt(r[f + '25']) + '–' + fmt(r[f + '75']) + ' (' + fmt(r[f + 'Med']) + ')');
OS.defTable('act-range-table', ['act_ranges'], () => (dash.data('act_ranges').data || []).map((r) => ({ ...r,
  coreRange: actRange(r, 'coreWk', actWk), meetRange: actRange(r, 'meetWk', actWk), custRange: actRange(r, 'custMeetWk', actWk), prosRange: actRange(r, 'prosMeetWk', actWk),
  emailsRange: actRange(r, 'emailsWk', OS.num), peopleRange: actRange(r, 'people', OS.num) })), [
  { f: 'label' },
  { f: 'n', fmt: OS.num, num: true },
  { f: 'coreRange', num: true, after: (r) => OS.el('span', 'act-sub', r.coreLabel) },
  { f: 'meetRange', num: true }, { f: 'custRange', num: true }, { f: 'prosRange', num: true },
  { f: 'emailsRange', num: true }, { f: 'peopleRange', num: true },
], { key: 'kind' });

// ----- how far to trust these numbers (all EMEA) -----
OS.defList('act-trust-list', ['act_trust'], () => dash.data('act_trust').data || [], (rows) => rows.map((t) => {
  const li = OS.el('li', 'itm');
  li.dataset.key = t.id;
  const main = OS.el('div', 'itm-main');
  const val = t.value == null ? '—' : OS.num(t.value);
  main.append(OS.el('span', 'itm-title', t.measure + ': ' + val), OS.el('span', 'itm-detail', t.detail));
  const meta = OS.el('div', 'itm-meta');
  const ask = actAsk('Explain: ' + t.measure, 'Explain how "' + t.measure + '" (' + val + ') is worked out on the EMEA RevOps OS Activity view. The dashboard says: ' + t.detail + ' If it looks off, check it with my Salesforce access.' + ACT_GUARD, { check: t.id });
  if (ask) meta.append(ask);
  li.append(OS.el('span', 'itm-dot ' + (LD_SEV[t.severity] || 'low')), main, meta);
  return li;
}));

// ----- BDRs (Created opps › BDRs, all EMEA) -----
// totals over active BDRs: blank, not zero, when the viewer's access hides meetings or every BDR; notVisible counts the
// BDRs it shows no activity for, so the capacity request can say the totals are partial
const actBdrSum = () => {
  const rs = (dash.data('act_bdr').data || []).filter((b) => b.active);
  const big = rs.filter((b) => b.meetPer100 != null);
  const pe = big.reduce((s, b) => s + b.people, 0);
  return { n: rs.filter((b) => b.role === 'BDR-EMEA').length, people: rs.some((b) => b.people != null) ? rs.reduce((s, b) => s + (b.people || 0), 0) : null,
    meetPros: rs.some((b) => b.meetPros != null) ? rs.reduce((s, b) => s + (b.meetPros || 0), 0) : null, per100: pe ? big.reduce((s, b) => s + b.meetPros, 0) / pe * 100 : null,
    notVisible: rs.filter((b) => b.status === 'Not visible').length };
};
dash.draw('kpi-act-bdr', (el) => OS.value(el, ['act_bdr'], () => {
  const v = actBdrSum()[el.dataset.k];
  return v == null ? '—' : el.dataset.k === 'per100' ? actWk(v) : OS.num(v);
}));
const crBdrSum = () => (dash.data('cr_bdrs').data || []).reduce((a, b) => ({ thisOpps: a.thisOpps + (+b.thisOpps || 0), thisArr: a.thisArr + (+b.thisArr || 0), lastOpps: a.lastOpps + (+b.lastOpps || 0) }), { thisOpps: 0, thisArr: 0, lastOpps: 0 });
dash.draw('kpi-cr-bdr', (el) => OS.value(el, ['cr_bdrs'], () => { const v = crBdrSum()[el.dataset.k]; return el.dataset.k === 'thisArr' ? OS.usd(v) : OS.num(v); }));
const actBdrAsk = (r) => actAsk('Funnel review: ' + r.name, 'From the EMEA RevOps OS: in the last 4 weeks ' + r.name + ' emailed ' + (r.people == null ? 'an unknown number of (not visible with my access)' : OS.num(r.people)) + ' people (' + (r.emails == null ? 'emails not visible' : OS.num(r.emails) + ' emails, ' + (r.emailsChg != null ? actSigned(r.emailsChg) + ' like-for-like' : 'no like-for-like change')) + '), '
  + (r.meetPros == null ? 'prospect meetings not visible with my access' : 'held ' + OS.num(r.meetPros) + ' prospect meetings (' + (r.prosChg != null ? actSigned(r.prosChg) + ' like-for-like' : 'no like-for-like change') + ') and has ' + OS.num(r.bookedPros) + ' booked for the next 2 weeks') + '; they sourced ' + OS.num(r.thisOpps) + ' opportunities this quarter (' + OS.num(r.lastOpps) + ' last quarter).' + actOwner(r)
  + ' With my Salesforce access, add their Outreach sequence emails, LinkedIn steps and calls per week for the last 8 weeks (counts by week and step type only, no sequence, contact or company names) and where people drop out between email, meeting and opportunity. Suggest one or two changes to try.' + ACT_GUARD, { person: r.name, userId: r.userId });
OS.defTable('act-bdr-table', ['act_bdr'], () => (dash.data('act_bdr').data || []).map((r) => ({ ...r, statusTxt: actLabel(r.status) })), [
  { f: 'name', person: (r) => r.name, after: (r) => { const box = OS.el('span', 'row-acts'); const sf = r.userId ? OS.links.sf('User', r.userId) : null; if (sf) box.append(sf); const a = r.active && r.status !== 'Not visible' ? actBdrAsk(r) : null; if (a) box.append(a); return box.children.length ? box : null; } },
  { f: 'manager' },
  { f: 'people', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.people || 0) },
  { f: 'emails', fmt: OS.num, num: true },
  { f: 'emailsChg', fmt: actSigned, num: true, tip: (r) => (r.emailsChg != null ? OS.num(r.emails) + ' vs ' + OS.num(r.emailsPrev) : '') },
  { f: 'meetPros', fmt: OS.num, num: true },
  { f: 'prosChg', fmt: actSigned, num: true, tip: (r) => (r.prosChg != null ? OS.num(r.meetPros) + ' vs ' + OS.num(r.meetProsPrev) : '') },
  { f: 'bookedPros', fmt: OS.num, num: true },
  { f: 'meetPer100', fmt: actWk, num: true, tip: (r) => (r.mailHidden || r.meetHidden || r.status === 'Not visible' ? 'not visible with your access' : 'prospect meetings per 100 people emailed, same 4 weeks; — under 50 people') },
  { f: 'lastTouch', fmt: actTs, tip: actIdleTip },
  { f: 'thisOpps', fmt: OS.num, num: true, bar: (l) => d3.max(l, (r) => r.thisOpps) },
  { f: 'thisArr', fmt: OS.usd, num: true },
  { f: 'lastOpps', fmt: OS.num, num: true },
  { f: 'statusTxt', fmt: (v) => v || '', chip: actChip },
], { key: 'name', also: ['manager'] });
// capacity at the current pace, from the BDR numbers above
dash.draw('act-bdr-plan', (box) => {
  if (OS.state('act_bdr') !== 'ok' || OS.state('cr_bdrs') !== 'ok') { box.replaceChildren(); return; }
  const s = actBdrSum(), c = crBdrSum();
  const now = new Date(), qEnd = Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3 + 3, 1);
  const weeks = Math.max(0, Math.ceil((qEnd - now.getTime()) / (7 * 864e5)));
  const b = actAsk('Plan BDR capacity', 'From the EMEA RevOps OS, EMEA BDRs: ' + OS.num(s.n) + ' active, ' + (s.people == null ? 'people emailed not visible with my access' : OS.num(s.people) + ' people emailed') + ' and ' + (s.meetPros == null ? 'prospect meetings not visible with my access' : OS.num(s.meetPros) + ' prospect meetings') + ' in the last 4 weeks, ' + OS.num(c.thisOpps) + ' opportunities sourced this quarter (' + OS.num(c.lastOpps) + ' last quarter), '
    + OS.num(weeks) + ' weeks to quarter end.'
    + (!s.notVisible ? '' : s.n && s.notVisible >= s.n ? ' My Salesforce access shows no activity for any of the ' + OS.num(s.n) + ' BDRs: base the projection on sourced opportunities only.'
      : ' My Salesforce access shows no activity for ' + OS.num(s.notVisible) + ' of the ' + OS.num(s.n) + ' BDRs: say the activity numbers are partial.') + ' With my Salesforce access, project opportunities sourced by quarter end at the current weekly pace and say how many prospect meetings a week the team would need to match last quarter.' + ACT_GUARD, { team: 'BDR' });
  if (b) { b.classList.remove('ibtn'); b.classList.add('btn'); b.append('Plan BDR capacity'); }
  box.replaceChildren(...(b ? [b] : []));
});

// ----- person panel -----
const actRep = () => rowFor('act_reps');
const actPersonValue = (fn) => (el) => {
  const r = actRep();
  if (r && el.dataset.f) { el.dataset.field = el.dataset.f; setWhere(el, 'name', r.name); } else { delete el.dataset.field; delete el.dataset.where; }
  OS.value(el, ['act_reps'], () => (r ? fn(r, el) : '—'));
};
dash.draw('pd-act-ts', actPersonValue((r, el) => actTs(r[el.dataset.f])));
dash.draw('pd-act-chg', actPersonValue((r, el) => (r[el.dataset.f] != null ? actSigned(r[el.dataset.f]) + (el.dataset.f === 'coreChg' ? ' (' + OS.num(r.coreNow) + ' vs ' + OS.num(r.corePrev) + ' ' + ACT_CORE[r.coreLabel] + ')' : ' (' + OS.num(r.emails) + ' vs ' + OS.num(r.emailsPrev) + ')')
  : (el.dataset.f === 'emailsChg' ? r.mailHidden : r.meetHidden) ? 'not visible with your access' : r.trendNote || '—')));
dash.draw('pd-act-meet', actPersonValue((r) => (r.meetings == null ? (r.meetHidden ? 'not visible with your access' : '—') : OS.num(r.meetings) + ' (' + OS.num(r.meetCust) + ' customer · ' + OS.num(r.meetPros) + ' prospect)')));
dash.draw('pd-act-usual', actPersonValue((r) => (r.rangeLo != null && r.kind !== 'Leader' && ACT_ROLE[r.kind] ? ACT_ROLE[r.kind] + ': ' + actWk(r.rangeLo) + '–' + actWk(r.rangeHi) + ' ' + ACT_CORE[r.coreLabel] + ' a week; theirs ' + actWk(r.coreWk) : '—')));
dash.draw('pd-act-em', (el) => {
  const r = actRep(), p = rowFor('person');
  // custMet counts every customer account met, not only their own book, so the book is a second figure, not a total
  OS.value(el, ['act_reps'], () => (r && r.custMet != null ? OS.num(r.custMet) + (p && p.emCustomers > 0 ? '; ' + OS.num(p.emCustomers) + ' in their Engagement Manager book' : '') : '—'));
});

// ===================== CONVERSION =====================
// Created opps › Conversion. Cohort figures (leaks, cohorts, time in stage) follow convKey(): All EMEA, a segment (the
// Field · SMB switch at All EMEA), a team, or a manager's direct reports. Close figures (win rate, losses, sources) are per
// team, so with a manager picked they show conv_mgr's team for them (closeKey(): null while it isn't known, never All EMEA).
// Requests carry counts, sums and our own teams' and people's names only, start with CONV_GUARD (defined at the top) and
// append nothing after their own instructions, because a long request loses its end.
const CONV_NAME = ['Qualification', 'Solution agreement', 'Scope agreement', 'Validation', 'Commercial agreement', 'Vendor assessment', 'Opt-out'];
const CONV_BANDS = [['b0', '0 → 1', 0], ['b1', '1 → 2', 1], ['b2', '2 → 3', 2], ['b3', '3 → 4', 3], ['b46', '4–6 → won', 4]];
const convKey = () => { const p = dash.params(); return mgrPick() ? 'M|' + mgrPick() : OS.region() !== 'All' ? OS.region() : p.cvSeg === 'field' ? 'S|Field' : p.cvSeg === 'smb' ? 'S|SMB' : 'All'; };
const convRows = (id) => (OS.state(id) === 'ok' ? dash.data(id).data || [] : []);
const convMgrRow = () => (mgrPick() ? convRows('conv_mgr').find((r) => r.manager === mgrPick()) || null : null);
const closeKey = () => (mgrPick() ? (convMgrRow() || {}).team || null : convKey());
const convRow = (id, key) => (key == null ? null : convRows(id).find((r) => r.key === key) || null);
const convName = (k) => (k === 'All' ? 'All EMEA' : String(k).startsWith('S|') ? String(k).slice(2) : String(k).startsWith('M|') ? String(k).slice(2) + "'s direct reports" : k);
const convPct = (v) => (v == null ? '—' : OS.pct(v));
const convAsk = (label, text, extra) => OS.links.ask(OS.ask.data(label, CONV_GUARD.trim() + ' ' + text, { kind: 'conversion', scope: convKey(), ...(extra || {}) }));
const convBtn = (b, text) => { if (b) { b.classList.remove('ibtn'); b.classList.add('btn'); b.append(text); } return b; };
// the close-based panes wait for conv_mgr while a manager is picked, then say when it has no team for them
const convCloseIds = (id) => () => (mgrPick() && OS.state('conv_mgr') !== 'ok' ? [id, 'conv_mgr'] : [id]);
const convCloseMsg = (rows) => () => (mgrPick() && !convMgrRow() ? 'nomgr' : rows().length ? null : 'empty');
const convClean = () => { const c = convRow('conv_closeout', 'All'); return dash.params().cvClean && c && c.closeoutQs && c.closeoutQs.length ? c : null; };

// ----- headline tiles -----
dash.draw('kpi-conv', (el) => {
  const calc = el.dataset.calc, id = 'conv_' + calc;
  const key = calc === 'close' ? closeKey() : calc === 'cohorts' ? convKey() + '|New Business' : calc === 'time' ? convKey() + '|win' : convKey();
  // the close tiles wait for conv_mgr while a manager is picked (their team comes from it), as the close tables do
  const ids = calc === 'close' ? convCloseIds(id)() : [id];
  // while that loads, or when it couldn't: no row, tooltip or colour of the scope shown before
  if (OS.state(...ids) !== 'ok') { markRow(el, 'key', key, null); el.title = ''; el.classList.remove('os-bad', 'os-warn', 'os-ok'); }
  OS.value(el, ids, () => {
    const r = markRow(el, 'key', key, convRow(id, key)), f = keepField(el), v = r[f];
    if (el.hasAttribute('data-warn')) el.classList.toggle('os-warn', +v > 0);
    // only the win-rate and lost-at-4–6 tiles read the clean-up quarters (for their titles)
    const co = calc === 'close' && (f === 'winRate' || f === 'lateShare') && OS.state('conv_closeout') === 'ok' ? convRow('conv_closeout', key) : null, cut = co && co.closeoutLabel ? co.closeoutLabel : null;
    if (calc === 'close' && f === 'winRate') {
      el.classList.toggle('os-bad', r.winVerdict === 'below');
      el.title = [(r.quarters || []).length ? 'Per quarter: ' + r.quarters.map((q) => q.label + ' ' + convPct(q.rate)).join(' · ') : '', cut && co.winRateClean != null ? 'without the ' + cut + ' clean-up: ' + OS.pct(co.winRateClean) : '',
        r.qualWinRate != null ? 'after qualification (stage-0 losses left out): ' + OS.pct(r.qualWinRate) : ''].filter(Boolean).join('; ');
    }
    if (calc === 'close' && f === 'lateShare') {
      el.classList.toggle('os-warn', r.lateVerdict === 'above');
      el.title = 'Last 4 completed quarters, last stage before Closed Lost' + (cut && co.lateShareClean != null ? '; without the ' + cut + ' clean-up: ' + OS.pct(co.lateShareClean) : '');
    }
    if (calc === 'cohorts' && f === 'y2q') {
      const mix = convKey() === 'All' || r.trendNote === 'mix' || r.trendNote === 'few', bad = !mix && (r.y2qVerdict === 'below' || r.trend === 'below'), good = !mix && !bad && (r.y2qVerdict === 'above' || r.trend === 'above');
      el.classList.toggle('os-bad', bad);
      el.classList.toggle('os-ok', good);
      el.title = v == null ? '' : '95% range ' + convPct(r.y2qLo) + '–' + convPct(r.y2qHi) + ' · ' + (r.y2qArr == null ? '—' : OS.usd(r.y2qArr)) + ' won ARR within 2 quarters per deal created · ' + convPct(r.y2qOpen) + ' still open at 2 quarters · won by the end of the quarter after the one they were created in: 3 to 6 months of age, the same for every quarter'
        + (convKey() === 'All' ? ' · Not coloured: SMB was ' + convPct(r.smbShare) + ' of New Business created in ' + r.y2qCohort + ' against ' + convPct(r.prevSmbShare) + ' in ' + (r.prevCohort || 'the quarter before') + ', so the total moves with the mix. Field deals take longer: compare each segment with its own earlier quarters (SMB ' + convPct(r.smbY2q) + ' against ' + convPct(r.smbPrevY2q) + ', Field ' + convPct(r.fieldY2q) + ' against ' + convPct(r.fieldPrevY2q) + '), or pick Field or SMB above.'
          : r.trendNote === 'mix' ? ' · Not coloured: their deals mix motions (' + convPct(r.mainShare) + ' in the largest).'
          : r.trendNote === 'few' ? ' · Not coloured: too few of their ' + r.fewWhat + ' to compare (' + OS.num(r.fewN) + ' of the ' + OS.num(r.y2qN) + ' created in ' + r.y2qCohort + ').'
          : r.cmpWhat ? ' · Their ' + r.cmpWhat + ' only (' + OS.num(r.y2qN) + ' of the ' + OS.num(r.y2qAllN) + ' created in ' + r.y2qCohort + '): their deals in other motions are never compared.' : '');
    }
    return v == null ? '—' : fmtBy(el, v);
  });
});
// the win rate's comparison: the other AE teams for an AE team, SMB and Field at All EMEA, nothing otherwise
dash.draw('kpi-conv-peer', (el) => {
  const r = convRow('conv_close', closeKey());
  el.textContent = !r ? '' : r.key === 'All' ? ' · SMB ' + convPct(r.smbWinRate) + ' · Field ' + convPct(r.fieldWinRate) : r.peerLabel && r.peerWinRate != null ? ' · ' + r.peerLabel + ' ' + OS.pct(r.peerWinRate) : '';
});
dash.draw('kpi-conv-y2q', (el) => {
  const r = convRow('conv_cohorts', convKey() + '|New Business');
  if (!r) { el.textContent = ''; return; }
  // a manager compared within one motion: the deals compared, named as their 1:1 agenda names them
  const what = r.cmpWhat ? r.cmpWhat + ': ' : '';
  if (r.y2q == null) { el.textContent = 'no quarter with 20 ' + (r.cmpWhat || 'created') + (r.cmpWhat ? ' created' : '') + ' has finished its following quarter yet'; return; }
  el.textContent = what + OS.num(r.y2qWon) + ' of ' + OS.num(r.y2qN) + ' created in ' + r.y2qCohort + (r.cmpWhat ? ' (' + OS.num(r.y2qAllN) + ' in all)' : '') + (r.prevY2q != null ? ' · ' + r.prevCohort + ': ' + OS.pct(r.prevY2q) : '')
    + (r.scope === 'All' ? ' · SMB ' + convPct(r.smbY2q) + ' (' + convPct(r.smbY2qOpen) + ' open at 2Q) · Field ' + convPct(r.fieldY2q) + ' (' + convPct(r.fieldY2qOpen) + ' open at 2Q)'
      : r.trendNote === 'few' ? ' · not compared: ' + OS.num(r.fewN) + ' ' + r.fewWhat
      : r.peerLabel && r.peerY2q != null ? ' · ' + r.peerLabel + ' ' + OS.pct(r.peerY2q) : '');
});
// a scope with peers whose steps all lack the deals to compare (its own, or the peers') says so, never "None flagged"
const convNone = (r) => !!(r && r.peerLabel && !r.leakBand && !r.cmpSteps);
const convNoneWhy = (r) => (CONV_BANDS.every(([id]) => r[id + 'Exp'] == null) ? 'too few deals among ' + r.peerLabel + ' to compare with' : 'too few deals have left each stage to compare with ' + r.peerLabel);
dash.draw('kpi-conv-leak', (el) => {
  const r = convRow('conv_steps', convKey()), peers = !!(r && r.peerLabel);
  el.classList.remove('os-warn');
  el.title = r ? (peers ? r.leakNames : r.lowNames) || '' : '';
  if (el.dataset.k === 'step') {
    OS.value(el, ['conv_steps'], () => (!r || convNone(r) ? '—' : peers ? r.leakLabel || 'None flagged' : r.lowLabel ? 'Lowest: ' + r.lowLabel : '—'));
    el.classList.toggle('os-warn', peers && !!r.leakLabel);
    return;
  }
  if (!r) { el.textContent = ''; return; }
  const what = r.cmpWhat ? r.cmpWhat + ': ' : '';
  el.textContent = peers && r.leakBand ? what + OS.pct(r.leakRate) + ' move on vs ' + OS.pct(r.leakExp) + ' for ' + r.peerLabel + ', same created quarters · about ' + ldPlural(r.leakBehind, 'deal', 'deals') + ' behind'
    : convNone(r) ? convNoneWhy(r)
    : peers ? what + (r.cmpSteps < CONV_BANDS.length ? OS.num(r.cmpSteps) + ' of ' + CONV_BANDS.length + ' steps compared, none below the normal swing of ' + r.peerLabel + '; the others have too few deals'
      : r.strongBand ? 'no step below the normal swing of ' + r.peerLabel : 'every step within the normal swing of ' + r.peerLabel)
    : r.lowBand ? OS.pct(r.lowRate) + ' move on (' + r.lowNames + ') · deals created ' + r.poolFrom + '–' + r.poolTo : '';
});
// the scope note's drawn parts
dash.draw('conv-peer', (el) => { const r = convRow('conv_cohorts', convKey() + '|New Business'); el.textContent = r ? r.peerLabel || 'nobody: no fair peers here' : '—'; });
dash.draw('conv-mgr-name', (el) => { el.textContent = mgrPick() || '—'; });
dash.draw('conv-mgr-team', (el) => { const m = convMgrRow(); el.textContent = m ? m.team + ' (' + OS.num(m.inTeam) + ' of ' + OS.num(m.reports) + ')' : '—'; });
dash.draw('conv-pool', (el) => { const r = convRow('conv_steps', convKey()) || convRow('conv_steps', 'All'); el.textContent = r ? r.poolFrom + '–' + r.poolTo : '—'; });
dash.draw('conv-clean-why', (el) => {
  const c = convRow('conv_closeout', 'All');
  el.textContent = c && c.closeoutQs && c.closeoutQs.length ? c.closeoutLabel + ': ' + OS.num(c.quarterLost) + ' losses, ' + OS.num(c.monthLost) + ' of them in ' + c.closeoutMonths + ' (' + d3.format('.1f')(c.monthRatio || 0) + '× ' + c.closeoutOthers + ')' : '';
});

// ----- where deals leak -----
OS.defChart('conv-funnel-chart', ['conv_steps'], () => {
  const r = convRow('conv_steps', convKey());
  return r ? CONV_NAME.map((nm, k) => ({ label: 'Stage ' + k + ' · ' + nm, won: r['sWon' + k], open: r['sOpen' + k], lost: r['sLost' + k] })) : [];
}, (box, rows) => OS.hbars(box, rows, [{ k: 'won', name: 'Won since', color: dash.colors[0] }, { k: 'open', name: 'Still open', color: dash.colors[1] }, { k: 'lost', name: 'Lost since', color: dash.colors[3] }], OS.num));
const convStepRows = () => {
  const k = convKey(), st = convRows('conv_steps'), by = new Map(st.map((r) => [r.key, r]));
  if (!by.get(k)) return [];
  const cl = new Map(convRows('conv_close').map((r) => [r.key, r])), mg = OS.state('conv_mgr') === 'ok' ? convRows('conv_mgr') : [];
  const mgrsOf = (team) => mg.filter((m) => m.team === team).map((m) => by.get('M|' + m.manager)).filter(Boolean).sort((a, b) => b.created - a.created);
  const mt = k.startsWith('M|') ? mg.find((m) => m.manager === k.slice(2)) : null;
  // at All EMEA the SMB segment row stands for the SMB team too (the same deals), so SMB is listed once
  const list = k === 'All' ? [by.get('All'), by.get('S|SMB'), by.get('S|Field'), ...st.filter((r) => r.level === 'team' && r.key !== 'SMB')]
    : k === 'S|Field' ? [by.get(k), ...st.filter((r) => r.level === 'team' && r.segment === 'Field')]
    : k === 'S|SMB' || k === 'SMB' ? [by.get(k), ...mgrsOf('SMB')]
    : k.startsWith('M|') ? [by.get(k), mt ? by.get(mt.team) : null, by.get('All')]
    : [by.get(k), ...mgrsOf(k), by.get('S|Field')];
  return list.filter((r, i, a) => r && a.indexOf(r) === i).map((r, i) => { const c = cl.get(r.key); return { ...r, winRate: c ? c.winRate : null, won4: c ? c.won4 : null, lost4: c ? c.lost4 : null, _cls: i === 0 ? 'os-total' : null }; });
};
const convBandCls = (id) => (v, r) => (r[id + 'Flag'] === 'leak' ? 'os-bad' : r[id + 'Flag'] === 'strong' ? 'os-ok' : !r[id + 'Settled'] ? 'cv-early' : '');
const convBandTip = (id, k) => (r) => {
  if (!r[id + 'Reached']) return '';
  const from = k === 4 ? 'stages 4–6' : 'stage ' + k;
  return OS.num(r[id + 'Moved']) + ' of ' + OS.num(r[id + 'Decided']) + ' that left ' + from + ' moved on; ' + OS.num(r[id + 'Still']) + ' still in it · between ' + convPct(r[id + 'Lower']) + ' (all lost) and ' + convPct(r[id + 'Upper']) + ' (all moving on)'
    + (r.peerLabel && r[id + 'Exp'] != null ? ' · ' + r.peerLabel + ' ' + OS.pct(r[id + 'Exp']) + ' on the same quarters' : '') + (r[id + 'Flag'] === 'leak' ? ' · about ' + ldPlural(Math.round(r[id + 'Behind']), 'deal', 'deals') + ' behind' : '');
};
const convDig = (r) => {
  const peers = !!r.peerLabel, who = r.level === 'manager' ? r.label + "'s direct reports" + (r.cmpWhat ? ', their ' + r.cmpWhat + ' (' + OS.num(r.created) + ' of the ' + OS.num(r.allCreated) + ' created; their deals in other motions are never compared)' : '') : r.label;
  const b = r.leakBand ? CONV_BANDS.find((x) => x[0] === r.leakBand) : r.lowBand ? CONV_BANDS.find((x) => x[0] === r.lowBand) : null;
  const at = b ? (b[2] === 4 ? 'stages 4–6 (reached stage 4, never won)' : 'stage ' + b[2] + ' (reached it, never the next)') : 'each stage';
  // what the comparison found: a leak, nothing beyond the normal swing (of the steps with enough deals), or nothing to compare
  const found = r.leakBand ? 'Biggest leak: ' + r.leakLabel + ' (' + r.leakNames + '), about ' + ldPlural(r.leakBehind, 'deal', 'deals') + ' behind.'
    : convNone(r) ? 'No step has enough deals, here and among ' + r.peerLabel + ', to compare' + (r.lowLabel ? '; the lowest is ' + r.lowLabel : '') + '.'
    : peers ? 'No step leaks beyond the normal swing' + (r.cmpSteps < CONV_BANDS.length ? ' (' + OS.num(r.cmpSteps) + ' of ' + CONV_BANDS.length + ' steps had the deals to compare)' : '') + (r.lowLabel ? '; the lowest is ' + r.lowLabel : '') + '.'
    : r.lowLabel ? 'The lowest step is ' + r.lowLabel + '.' : '';
  return convAsk('Dig into ' + r.label + (r.level === 'manager' ? "'s direct reports" : ''), 'From the EMEA RevOps OS, New Business created ' + r.poolFrom + '–' + r.poolTo + ', ' + who + (r.segment ? ' (' + r.segment + ')' : '') + ': ' + OS.num(r.created) + ' created; ' + OS.num(r.won) + ' won, ' + OS.num(r.lost) + ' lost, ' + OS.num(r.open) + ' still open; won within 2 quarters ' + convPct(r.y2q)
    + (peers && r.y2qExp != null ? ' (' + r.peerLabel + ' ' + OS.pct(r.y2qExp) + ' on the same quarters)' : '') + '. Step rates of deals that left each stage' + (peers ? ', against ' + r.peerLabel + ' on the same quarters' : '') + ': '
    + CONV_BANDS.map(([id, lbl]) => lbl + ' ' + convPct(r[id + 'Rate']) + (peers && r[id + 'Exp'] != null ? ' vs ' + OS.pct(r[id + 'Exp']) : '')).join(', ') + '. '
    + found
    + ' With my Salesforce access, for these New Business deals created in those quarters that stopped at ' + at + ' (match stages by number: "3 - Pilot Validation" and "3 - Validation" are both stage 3), count them by lost reason, by quarter lost and by owner (our own people may be named), and the ones still open there by days in stage. Suggest two or three things to coach.',
  { team: r.key });
};
// a manager rated on their deals in one motion says so under their name
const convStepLabel = (r) => {
  const a = convDig(r);
  if (!r.cmpWhat) return a;
  const box = OS.el('span');
  box.append(OS.el('span', 'act-sub', r.cmpWhat + ' only'));
  if (a) box.append(a);
  return box;
};
// waits while the win rates or a team's managers load, never for one that failed: the leaks stand alone
OS.defTable('conv-step-table', () => ['conv_steps'].concat(['conv_close', 'conv_mgr'].filter((id) => OS.state(id) === 'loading')), convStepRows, [
  { f: 'label', person: (r) => (r.level === 'manager' ? r.label : null), after: convStepLabel },
  { f: 'created', fmt: (v, r) => OS.num(v) + (r.cmpWhat ? ' of ' + OS.num(r.allCreated) : ''), num: true, tip: (r) => (r.cmpWhat ? r.cmpWhat + ' only, ' + OS.num(r.created) + ' of the ' + OS.num(r.allCreated) + ' created (their deals in other motions are never compared) · ' : '') + OS.num(r.won) + ' won · ' + OS.num(r.lost) + ' lost · ' + OS.num(r.open) + ' still open · ' + OS.usd(r.arr) + ' ARR' },
  { f: 'y2q', fmt: convPct, num: true, cls: (v, r) => (r.y2qFlag === 'below' ? 'os-bad' : r.y2qFlag === 'above' ? 'os-ok' : ''), tip: (r) => (r.peerLabel && r.y2qExp != null ? r.peerLabel + ' on the same quarters: ' + OS.pct(r.y2qExp) : '') },
  { f: 'winRate', fmt: convPct, num: true, tip: (r) => (r.won4 != null ? OS.num(r.won4) + ' won · ' + OS.num(r.lost4) + ' lost, closed in the last 4 quarters, by who closed them' : '') },
  { f: 'b0Rate', fmt: convPct, num: true, cls: convBandCls('b0'), tip: convBandTip('b0', 0) },
  { f: 'b1Rate', fmt: convPct, num: true, cls: convBandCls('b1'), tip: convBandTip('b1', 1) },
  { f: 'b2Rate', fmt: convPct, num: true, cls: convBandCls('b2'), tip: convBandTip('b2', 2) },
  { f: 'b3Rate', fmt: convPct, num: true, cls: convBandCls('b3'), tip: convBandTip('b3', 3) },
  { f: 'b46Rate', fmt: convPct, num: true, cls: convBandCls('b46'), tip: convBandTip('b46', 4) },
  { f: 'leakLabel', fmt: (v, r) => (v ? v + ', about ' + OS.num(r.leakBehind) + ' behind' : '—'), cls: (v) => (v ? 'os-warn' : '') },
], { key: 'key' });
// Monday summary for the scope: the leaks name our own teams and managers only, up to 6
dash.draw('conv-monday', (box) => {
  const k = convKey(), ck = closeKey();
  // offered once every part it carries has settled: a part still loading is never sent as "not available" or left out
  // (conv_mgr: a manager's team, and a team's managers among its leaks)
  const ids = ['conv_steps', 'conv_cohorts', 'conv_close', 'conv_reasons', 'conv_closeout', 'conv_sources'].concat(k !== 'All' && !k.startsWith('S|') ? ['conv_mgr'] : []);
  if (ids.some((id) => OS.state(id) === 'loading')) { box.replaceChildren(); return; }
  const st = convRows('conv_steps'), co = convRow('conv_cohorts', k + '|New Business');
  if (!st.length && !co) { box.replaceChildren(); return; }
  const na = (what) => what + ': not available';
  const cl = convRow('conv_close', ck), cx = convRow('conv_closeout', ck), src = convRow('conv_sources', ck == null ? null : ck + '|All|All closed');
  const wr = cl ? 'Win rate by count over the last 4 completed quarters' + (mgrPick() ? ' (' + ck + ', the team most of them are in)' : '') + ': ' + convPct(cl.winRate) + ' (' + OS.num(cl.won4) + ' won, ' + OS.num(cl.lost4) + ' lost, by who closed them'
    + (cx && cx.closeoutLabel && cx.winRateClean != null ? '; ' + OS.pct(cx.winRateClean) + ' without the ' + cx.closeoutLabel + ' clean-up' : '') + '); ' + convPct(cl.lateShare) + ' of losses left at stage 4–6 and ' + convPct(cl.earlyShare) + ' at 0–1.' : na('Win rate') + '.';
  const y = !co ? na('Won within 2 quarters') + '.' : co.y2q == null ? 'Won within 2 quarters: no quarter with 20 ' + (co.cmpWhat ? co.cmpWhat + ' ' : '') + 'created has finished its following quarter yet.'
    : k === 'All' ? 'Won within 2 quarters, deals created in ' + co.y2qCohort + ': SMB ' + convPct(co.smbY2q) + ' (' + co.prevCohort + ' ' + convPct(co.smbPrevY2q) + ') and Field ' + convPct(co.fieldY2q) + ' (' + co.prevCohort + ' ' + convPct(co.fieldPrevY2q) + '), with ' + convPct(co.smbY2qOpen) + ' and ' + convPct(co.fieldY2qOpen) + ' still open at 2 quarters (Field deals take longer: compare each segment with its own earlier quarters; the all-EMEA ' + OS.pct(co.y2q) + ' moves with SMB\'s share of deals created, ' + convPct(co.smbShare) + ' against ' + convPct(co.prevSmbShare) + ').'
    : 'Won within 2 quarters: ' + OS.pct(co.y2q) + ' of ' + (co.cmpWhat ? 'their ' + co.cmpWhat + ' created in ' + co.y2qCohort + ' (' + OS.num(co.y2qN) + ' of the ' + OS.num(co.y2qAllN) + ' created)' : 'deals created in ' + co.y2qCohort)
      + (co.trendNote === 'few' ? ' (not compared: too few ' + co.fewWhat + ', ' + OS.num(co.fewN) + ')' : co.prevY2q != null ? ' (' + co.prevCohort + ' ' + OS.pct(co.prevY2q) + (co.peerLabel && co.peerY2q != null ? '; ' + co.peerLabel + ' ' + OS.pct(co.peerY2q) : '') + ')' : co.peerLabel && co.peerY2q != null ? ' (' + co.peerLabel + ' ' + OS.pct(co.peerY2q) + ')' : '') + '.';
  const inScope = (r) => (k === 'All' ? r.level === 'team' || r.level === 'manager' : k === 'S|Field' ? r.level === 'team' && r.segment === 'Field' : r.key === k || (r.level === 'manager' && convRows('conv_mgr').some((m) => 'M|' + m.manager === r.key && m.team === k)));
  const leaks = st.filter((r) => r.leakBand && inScope(r)).sort((a, b) => b.leakBehind - a.leakBehind);
  const pool = (convRow('conv_steps', k) || convRow('conv_steps', 'All') || {});
  // no leak: say whether anything was compared at all (a scope without peers, or with too few deals at every step). A
  // scope without peers whose rows compared no step either (the SMB team, whose one manager holds every SMB deal) has
  // no fair peers: its lowest step, as its segment and its tile give it
  const cmpd = st.filter((r) => inScope(r) && r.peerLabel), self = convRow('conv_steps', k);
  const noLeak = !cmpd.length || (self && !self.peerLabel && cmpd.every((r) => !r.cmpSteps)) ? 'not compared here (no fair peers)' + (self && self.lowLabel ? '; the lowest step is ' + self.lowLabel.replace(/^S/, 's') + ' at ' + OS.pct(self.lowRate) : '')
    : cmpd.every((r) => !r.cmpSteps) ? 'no step has enough deals, here and among the peers, to compare'
    : 'no step leaks beyond the normal swing' + (cmpd.some((r) => r.cmpSteps < CONV_BANDS.length) ? ' (some steps had too few deals to compare)' : '');
  const lk = !st.length ? na('Where deals leak') + '.' : 'Where deals leak (created ' + pool.poolFrom + '–' + pool.poolTo + ', each against its peers on the same quarters): ' + (leaks.length ? leaks.slice(0, 6).map((r) => (r.level === 'manager' ? r.label + "'s team" + (r.cmpWhat ? ' (' + r.cmpWhat + ')' : '') : r.label) + ' ' + r.leakLabel.replace(/^S/, 's') + ', ' + OS.pct(r.leakRate) + ' vs ' + OS.pct(r.leakExp) + ', about ' + OS.num(r.leakBehind) + ' behind').join('; ') + (leaks.length > 6 ? ' and ' + (leaks.length - 6) + ' more' : '') : noLeak) + '.';
  const rs = convRows('conv_reasons').filter((r) => r.kind === 'reason' && r.scope === ck).slice(0, 3);
  const rising = cx && !cx.lastQCleanup ? convRows('conv_closeout').filter((r) => r.kind === 'reason' && r.scope === ck && r.rising).map((r) => r.group).slice(0, 3) : [];
  // with a manager picked, losses and sources are their team's (per team, as the win rate): each says so
  const tn = mgrPick() ? ' (' + ck + ', the team most of them are in)' : '';
  const why = ck == null || OS.state('conv_reasons') !== 'ok' ? na('Top lost reasons') + '.' : rs.length ? 'Top lost reasons' + tn + ': ' + rs.map((r) => r.group + ' ' + OS.num(r.n)).join(', ') + (rising.length ? '; rising last quarter: ' + rising.join(', ') : '') + '.' : '';
  const s = !src ? na('By lead source') + '.' : src.bestSrc ? 'By lead source' + tn + ': ' + src.bestSrc + ' ' + OS.pct(src.bestWr) + ' to ' + src.worstSrc + ' ' + OS.pct(src.worstWr) + ' (' + OS.usd(src.bestYield) + ' and ' + OS.usd(src.worstYield) + ' won ARR per closed deal); BDR-sourced ' + convPct(src.bdrWr) + '.' : 'BDR-sourced win rate' + tn + ' ' + convPct(src.bdrWr) + '.';
  const old = co && co.staleOpen ? ' ' + ldPlural(co.staleOpen, 'open deal', 'open deals') + ' created 3+ quarters ago are still at stage 0–1.' : '';
  const b = convAsk('Monday summary: conversion, ' + convName(k), 'Write a 5-bullet Monday-meeting summary of New Business conversion for ' + convName(k) + ' from the EMEA RevOps OS. ' + wr + ' ' + y + ' ' + lk + ' ' + why + ' ' + s + old
    + ' Say what changed and what to ask the teams. Name our own teams and people only. Draft it for Slack and wait for my OK before posting.');
  box.replaceChildren(...(convBtn(b, 'Monday summary') ? [b] : []));
});

// ----- cohorts -----
const convRt = () => (dash.params().cvRt === 'up' ? 'Upsell' : 'New Business');
const convCohortRows = () => convRows('conv_cohorts').filter((r) => r.kind === 'cohort' && r.scope === convKey() && r.rt === convRt());
const convCohortAsk = (r) => convAsk('Explain the ' + r.label + ' cohort', 'From the EMEA RevOps OS Conversion view (' + convName(r.scope) + (r.cmpWhat ? ', their ' + r.cmpWhat + ' only' : '') + ', ' + r.rt + '): ' + OS.num(r.n) + ' created in ' + r.label + ' (' + r.months + (r.cmpWhat ? '; ' + OS.num(r.allN) + ' in all' : '') + ')'
  + (r.rt === 'New Business' ? '; reached stage 1 ' + convPct(r.reach1) + ', stage 4 ' + convPct(r.reach4) : '') + '; ' + OS.num(r.won) + ' won (' + convPct(r.wonShare) + '), ' + OS.num(r.lost) + ' lost, ' + OS.num(r.open) + ' still open (' + convPct(r.openShare) + '); won within 2 quarters '
  + (r.y2q != null ? OS.pct(r.y2q) + ', ' + convPct(r.y2qOpen) + ' still open at 2 quarters' : r.comparable ? 'not shown (too few)' : 'not comparable until ' + r.compAfter) + '. With my Salesforce access, show how this quarter\'s wins and losses built up month by month since creation (counts only), which stage the open deals sit in and for how long, and how many wins were created and won within a day.'
  + (r.prevCohort ? ' Compare with ' + r.prevCohort + ' at the same age.' : ''), { cohort: r.label });
const convY2qCls = (v, r) => { const mix = r.scope === 'All' || r.trendNote === 'mix'; if (mix) return ''; return r.y2qVerdict === 'below' || r.trend === 'below' ? 'os-bad' : r.y2qVerdict === 'above' || r.trend === 'above' ? 'os-ok' : ''; };
OS.defTable('conv-cohort-table', ['conv_cohorts'], convCohortRows, [
  { f: 'label', after: (r) => { const box = OS.el('span'); box.append(OS.el('span', 'act-sub', (r.isCurrent ? 'day ' + r.dayOfQ + ' of ' + r.daysInQ : r.months) + (r.cmpWhat ? ' · ' + r.cmpWhat + ' only' : ''))); const a = convCohortAsk(r); if (a) box.append(a); return box; } },
  { f: 'status', chip: (v) => (v === 'So far' ? 'warn' : v === 'Comparable' ? '' : 'cv-early'), tip: (r) => (r.status === 'So far' ? 'comparable after ' + r.compAfter : '') },
  { f: 'n', fmt: (v, r) => OS.num(v) + (r.cmpWhat ? ' of ' + OS.num(r.allN) : ''), num: true, tip: (r) => (r.cmpWhat ? r.cmpWhat + ': ' + OS.num(r.n) + ' of the ' + OS.num(r.allN) + ' created (their deals in other motions are never compared) · ' : '') + OS.usd(r.arr) + ' ARR' },
  { f: 'reach1', fmt: convPct, num: true, tip: (r) => (r.reach1 == null ? 'Upsell: outcomes only' : 'stage 2 ' + convPct(r.reach2) + ' · 3 ' + convPct(r.reach3) + ' · 4 ' + convPct(r.reach4) + ' · 5 ' + convPct(r.reach5) + ' · 6 ' + convPct(r.reach6)) },
  { f: 'reach4', fmt: convPct, num: true },
  { f: 'won', fmt: OS.num, num: true, tip: (r) => OS.usd(r.wonArr) + ' ARR' },
  { f: 'lost', fmt: OS.num, num: true },
  { f: 'openShare', fmt: convPct, num: true, cls: (v, r) => (r.ageQ >= 2 && v > 0.25 ? 'os-warn' : '') },
  { f: 'y2q', fmt: convPct, num: true, cls: convY2qCls, tip: (r) => (r.y2q == null ? (r.comparable ? 'too few' : 'comparable after ' + r.compAfter)
    : OS.num(r.y2qWon) + ' of ' + OS.num(r.n) + ' · ' + convPct(r.y2qOpen) + ' still open at 2 quarters · 95% range ' + convPct(r.y2qLo) + '–' + convPct(r.y2qHi) + (r.peerLabel && r.peerY2q != null ? ' · ' + r.peerLabel + ' ' + OS.pct(r.peerY2q) : '') + (r.prevY2q != null ? ' · ' + r.prevCohort + ' ' + OS.pct(r.prevY2q) : '')) },
  { f: 'y2qArr', fmt: (v) => (v == null ? '—' : OS.usd(v)), num: true },
  { f: 'wonShare', fmt: convPct, num: true },
  { f: 'closedRate', fmt: convPct, num: true, cls: (v, r) => (r.comparable ? '' : 'cv-early'), tip: () => 'won of those closed so far: wins come faster than losses, so this reads high while deals are still open' },
], { key: 'key' });
// SMB against Field, each against its own earlier quarters (All EMEA, SMB and the two segments, New Business)
dash.draw('conv-smb', (box) => {
  const k = convKey();
  if (!['All', 'S|SMB', 'S|Field', 'SMB'].includes(k) || convRt() !== 'New Business' || OS.state('conv_cohorts') !== 'ok') { box.replaceChildren(); return; }
  // offered once the win rates and times have settled too, so no part of it is missing only because it is still loading
  if (['conv_close', 'conv_time'].some((id) => OS.state(id) === 'loading')) { box.replaceChildren(); return; }
  const co = convRows('conv_cohorts'), seg = (s) => co.filter((r) => r.kind === 'cohort' && r.scope === s && r.rt === 'New Business');
  const sm = seg('S|SMB'), fi = seg('S|Field'), qs = sm.filter((r) => r.comparable && r.y2q != null).map((r) => r.cohort).sort((a, b) => a - b);
  const per = qs.map((q) => { const s = sm.find((r) => r.cohort === q), f = fi.find((r) => r.cohort === q); return s.label + ': SMB ' + OS.pct(s.y2q) + ' of ' + OS.num(s.n) + ' (' + convPct(s.y2qOpen) + ' still open), Field ' + (f && f.y2q != null ? OS.pct(f.y2q) + ' of ' + OS.num(f.n) + ' (' + convPct(f.y2qOpen) + ' still open)' : '—'); });
  const lq = qs[qs.length - 1], ls = sm.find((r) => r.cohort === lq), lf = fi.find((r) => r.cohort === lq);
  const c = (s) => convRow('conv_close', s), t = (s) => convRow('conv_time', s + '|win');
  const cs = c('S|SMB'), cf = c('S|Field'), ts = t('S|SMB'), tf = t('S|Field');
  const b = convAsk('Review SMB vs Field', 'From the EMEA RevOps OS, New Business, SMB against Field. Field deals take longer: compare each segment with its own earlier quarters, and read the share still open at 2 quarters before comparing the two. Won within 2 quarters by created quarter: ' + (per.join('; ') || 'none comparable yet') + '.'
    + (ls ? ' Won ARR within 2 quarters per deal created ' + (ls.y2qArr == null ? '—' : OS.usd(ls.y2qArr)) + ' against ' + (lf && lf.y2qArr != null ? OS.usd(lf.y2qArr) : '—') + ' for ' + ls.label + '.' : '')
    + (cs && cf ? ' Closed in the last 4 quarters: win rate SMB ' + convPct(cs.winRate) + ' against Field ' + convPct(cf.winRate) + '; losses at stage 0–1 ' + convPct(cs.earlyShare) + ' against ' + convPct(cf.earlyShare) + '.' : OS.state('conv_close') !== 'ok' ? ' Win rate: not available.' : '')
    + (ts && tf ? ' Wins of the last 90 days (SMB: 30 days): median ' + (ts.median == null ? '—' : OS.num(ts.median)) + ' against ' + (tf.median == null ? '—' : OS.num(tf.median)) + ' days from creation for wins that took a day or more, ' + convPct(ts.oneGoShare) + ' against ' + convPct(tf.oneGoShare) + ' created and won within a day.' : OS.state('conv_time') !== 'ok' ? ' Time in stage: not available.' : '')
    + ' SMB created ' + sm.slice().sort((a, b2) => a.cohort - b2.cohort).map((r) => OS.num(r.n) + ' in ' + r.label).join(', ') + '. With my Salesforce access, check by created month whether SMB conversion holds as volume grows and what to watch next quarter.');
  box.replaceChildren(...(convBtn(b, 'Review SMB vs Field') ? [b] : []));
});

// ----- why deals are lost, and where -----
const convReasonRows = () => {
  const k = closeKey();
  if (k == null) return [];
  const c = convClean();
  if (c) {
    const rs = convRows('conv_closeout').filter((r) => r.kind === 'clean' && r.scope === k);
    const tot = rs.find((r) => r.group === 'All losses' && /\|\*$/.test(r.key));
    return (tot ? [{ ...tot, _cls: 'os-total' }] : []).concat(rs.filter((r) => r !== tot && r.n > 0));
  }
  const cx = OS.state('conv_closeout') === 'ok' ? new Map(convRows('conv_closeout').filter((r) => r.kind === 'reason').map((r) => [r.key, r])) : null;
  const rs = convRows('conv_reasons').filter((r) => r.scope === k);
  const tot = rs.find((r) => r.kind === 'scope');
  return (tot ? [{ ...tot, _cls: 'os-total' }] : []).concat(rs.filter((r) => r.kind === 'reason').map((r) => {
    const x = cx ? cx.get(r.key) : null;
    // _cx: false only when the losses by month couldn't load (null while they load), for the Last quarter tooltip
    return { ...r, lastQShare: x ? x.lastQShare : null, rising: x ? x.rising : null, lastQCleanup: x ? x.lastQCleanup : null, _cx: OS.state('conv_closeout') === 'loading' ? null : !!cx };
  }));
};
const convLossAsk = (r) => {
  if (r._cls || r.group === 'No reason given') return null;
  const where = OS.num(r.early) + ' at stage 0–1, ' + OS.num(r.mid) + ' at 2–3, ' + OS.num(r.late) + ' at 4–6; ' + OS.usd(r.arr) + ' ARR';
  const scope = convName(closeKey()), when = convClean() ? 'in the last 4 completed quarters, leaving out the ' + convClean().closeoutLabel + ' clean-up' : 'in the last 4 completed quarters';
  if (r.group === 'Chose an alternative') return convAsk('Count these losses: ' + r.group, 'From the EMEA RevOps OS: ' + OS.num(r.n) + ' New Business deals in ' + scope + ' were lost to an alternative ' + when + ' (' + where + ')' + (r.oldsTxt ? ', recorded as Lost to Competitor before the list changed on 3 Nov 2026' : '') + '. With my Salesforce access, count them by last stage, quarter, team and ARR band, and say where in the funnel we lose to alternatives. Don\'t name the competitors.', { reason: r.group });
  return convAsk('Count these losses: ' + r.group, 'From the EMEA RevOps OS: ' + OS.num(r.n) + ' New Business deals in ' + scope + ' were lost for "' + r.group + '" ' + when + ' (' + where + ')' + (r.oldsTxt ? ', recorded as ' + r.oldsTxt.replace(/ [\d,]+/g, '') + ' before the list changed on 3 Nov 2026' : '') + '. With my Salesforce access, count them by last stage before Closed Lost, quarter lost, team, ARR band and, where it is filled, Lost Detail, and suggest one change to qualification or deal reviews.', { reason: r.group });
};
OS.defTable('conv-reason-table', () => { const ids = convCloseIds('conv_reasons')(); return convClean() ? ids.concat('conv_closeout') : ids; }, convReasonRows, [
  { f: 'group', after: (r) => { const box = OS.el('span'); if (r.oldsTxt) box.append(OS.el('span', 'act-sub', 'was ' + r.oldsTxt)); const a = convLossAsk(r); if (a) box.append(a); return box.children.length ? box : null; } },
  { f: 'n', fmt: OS.num, num: true, bar: (l) => d3.max(l.filter((r) => !r._cls), (r) => r.n) || 1 },
  { f: 'share', fmt: convPct, num: true },
  { f: 'peerShare', fmt: convPct, num: true },
  { f: 'early', fmt: OS.num, num: true }, { f: 'mid', fmt: OS.num, num: true },
  { f: 'late', fmt: OS.num, num: true, cls: (v, r) => (!r._cls && v >= 5 && v > r.n / 2 ? 'os-warn' : '') },
  { f: 'arr', fmt: OS.usd, num: true },
  { f: 'lastQShare', fmt: convPct, num: true, cls: (v, r) => (r.rising ? 'os-warn' : ''), tip: (r) => (r._cls ? '' : r._cx === false ? 'needs the losses by month, which couldn\'t load' : r.lastQCleanup ? 'last quarter was a clean-up quarter: not compared'
    : r.byQ ? 'per quarter, oldest first: ' + r.byQ.map(OS.num).join(' · ') + (r.thisQ != null ? '; this quarter so far ' + OS.num(r.thisQ) : '') : '') },
], { key: 'key', msg: convCloseMsg(convReasonRows) });

// ----- how sources convert -----
const convSrcRows = () => {
  const k = closeKey();
  if (k == null) return [];
  const rs = convRows('conv_sources').filter((r) => r.scope === k && (r.kind === 'total' || r.kind === 'source'));
  return rs.map((r) => (r.kind === 'total' ? { ...r, _cls: 'os-total' } : r));
};
OS.defTable('conv-src-table', convCloseIds('conv_sources'), convSrcRows, [
  { f: 'groupHead' }, { f: 'value' },
  { f: 'closed', fmt: OS.num, num: true, tip: (r) => OS.num(r.won) + ' won · ' + OS.num(r.lost) + ' lost' },
  { f: 'winRate', fmt: convPct, num: true, cls: (v, r) => (r.mark === 'low' ? 'os-bad' : r.mark === 'high' ? 'os-ok' : ''), tip: (r) => (r.gap != null ? OS.signedPct(r.gap).replace('%', '') + ' points against the rest of the team' : '') },
  { f: 'smbWinRate', fmt: convPct, num: true }, { f: 'fieldWinRate', fmt: convPct, num: true }, { f: 'arrWinRate', fmt: convPct, num: true },
  { f: 'avgWon', fmt: (v) => (v == null ? '—' : OS.usd(v)), num: true },
  { f: 'wonArrPerClosed', fmt: (v) => (v == null ? '—' : OS.usd(v)), num: true, bar: (l) => d3.max(l.filter((r) => !r._cls), (r) => r.wonArrPerClosed || 0) || 1 },
  { f: 'daysToWin', fmt: (v) => (v == null ? '—' : OS.num(v)), num: true },
  { f: 'open', fmt: OS.num, num: true, cls: (v, r) => (r.young ? 'os-warn' : ''), tip: (r) => (r.openShare != null ? OS.pct(r.openShare) + ' of this source\'s deals are still open: wins come faster than losses, so its win rate may fall' : '') },
], { key: 'key', msg: convCloseMsg(convSrcRows) });
// which source to fund: up to 12 sources with 20+ closed (the most closed first), in group order, the same deals once
dash.draw('conv-src-ask', (box) => {
  const k = closeKey(), rs = convRows('conv_sources');
  const tot = k == null ? null : rs.find((r) => r.key === k + '|All|All closed');
  // at All EMEA it also carries what was created by source: offered once that has settled
  if (!tot || (k === 'All' && OS.state('cr_mix') === 'loading')) { box.replaceChildren(); return; }
  const pick = rs.filter((r) => r.scope === k && r.kind === 'source' && r.closed >= 20 && !(r.group === 'As in Sources' && r.value === 'Inbound')).sort((a, b) => b.closed - a.closed).slice(0, 12).sort((a, b) => a.order - b.order);
  const groups = [...new Set(pick.map((r) => r.group))].map((g) => g + ': ' + pick.filter((r) => r.group === g).map((r) => r.value + ': ' + OS.num(r.closed) + ' closed, ' + convPct(r.winRate) + ' won (' + convPct(r.arrWinRate) + ' by ARR; SMB ' + convPct(r.smbWinRate) + ', Field ' + convPct(r.fieldWinRate) + '), '
    + (r.avgWon == null ? '—' : OS.usd(r.avgWon)) + ' average won deal, ' + (r.wonArrPerClosed == null ? '—' : OS.usd(r.wonArrPerClosed)) + ' won ARR per closed deal, ' + (r.daysToWin == null ? '—' : OS.num(r.daysToWin)) + ' avg days to win, ' + OS.num(r.open) + ' open now').join('; '));
  const mix = k === 'All' && OS.state('cr_mix') === 'ok' ? (dash.data('cr_mix').data || []) : null, m = (s) => (mix || []).find((r) => r.source === s) || {};
  const created = mix ? ' Created this quarter so far and last quarter: BDR-sourced ' + OS.num(m('BDR-sourced').thisOpps || 0) + ' and ' + OS.num(m('BDR-sourced').lastOpps || 0) + ', Inbound ' + OS.num(m('Inbound').thisOpps || 0) + ' and ' + OS.num(m('Inbound').lastOpps || 0) + ', Rep-sourced ' + OS.num(m('Rep-sourced').thisOpps || 0) + ' and ' + OS.num(m('Rep-sourced').lastOpps || 0) + '.' : '';
  const bdr = rs.find((r) => r.key === 'trust|bdr');
  const b = convAsk('Which source to fund?', 'From the EMEA RevOps OS, New Business closed in the last 4 completed quarters (' + convName(k) + ', by who closed it), by source. ' + groups.join('. ') + '.' + created
    + ' Say which sources earn the most per closed deal, where more volume would pay and where conversion should be fixed first, and what these numbers can\'t tell (sample sizes, blank lead sources, cost per opportunity, the ' + (bdr && bdr.value != null ? OS.pct(bdr.value) : 'share') + ' of closed deals with an originating BDR recorded). With my Salesforce access, check the two biggest differences by quarter closed, and break BDR-sourced deals down by originating BDR (our own people may be named).');
  box.replaceChildren(...(convBtn(b, 'Which source to fund?') ? [b] : []));
});

// ----- time in stage, recent wins -----
const convDays = (v) => (v == null ? '—' : OS.num(v));
OS.defTable('conv-time-table', ['conv_time'], () => {
  const k = convKey(), rs = convRows('conv_time').filter((r) => r.scope === k && (r.kind === 'stage' || r.kind === 'win'));
  return rs.map((r) => (r.kind === 'win' ? { ...r, _cls: 'os-total' } : r));
}, [
  { f: 'label' }, { f: 'n', fmt: OS.num, num: true },
  { f: 'sameShare', fmt: convPct, num: true, tip: (r) => OS.num(r.sameDay) + ' of ' + OS.num(r.n) + (r.kind === 'win' ? ' were created and won within a day: logged at signature' : ' left it the day they entered it: stage walking, a skipped stage or a deal logged in one go') },
  { f: 'median', fmt: convDays, num: true }, { f: 'p75', fmt: convDays, num: true, cls: (v, r) => (r.stuckAfter != null && v != null && v >= r.stuckAfter ? 'os-warn' : '') },
  { f: 'smbMedian', fmt: convDays, num: true }, { f: 'fieldMedian', fmt: convDays, num: true }, { f: 'stuckAfter', fmt: convDays, num: true },
], { key: 'key' });

// ----- how far to trust these numbers (all EMEA) -----
const CONV_TRUST = [['conv_trust_cohort', 'cohort checks'], ['conv_trust_close', 'win-rate checks'], ['conv_closeout', 'losses by month'], ['conv_sources', 'sources'], ['conv_time', 'time in stage'], ['conv_trust_timing', 'created per month']];
const convTrustVal = (t) => (t.value == null ? '' : t.fmt === 'pct' ? OS.pct(t.value) : t.fmt === 'x' ? d3.format('.1f')(t.value) + '×' : t.fmt === 'months' ? d3.format('.1f')(t.value) + ' months' : OS.num(t.value));
OS.defList('conv-trust-list', () => checkIds(CONV_TRUST.map((x) => x[0])), () => {
  const rows = CONV_TRUST.filter(([id]) => OS.state(id) === 'ok').flatMap(([id]) => (dash.data(id).data || []).filter((r) => r.kind === undefined || r.kind === 'trust'));
  const bad = CONV_TRUST.filter(([id]) => ['error', 'connect'].includes(OS.state(id))).map((x) => x[1]);
  return bad.length ? rows.concat([{ id: 'unloaded', measure: 'Couldn\'t load', value: null, detail: bad.join(', ') + '. The rest of these checks still apply.', severity: 'warn' }]) : rows;
}, (rows) => rows.map((t) => {
  const li = OS.el('li', 'itm');
  li.dataset.key = t.id;
  const main = OS.el('div', 'itm-main'), val = convTrustVal(t);
  main.append(OS.el('span', 'itm-title', t.measure + (val ? ': ' + val : '')), OS.el('span', 'itm-detail', t.detail));
  const meta = OS.el('div', 'itm-meta');
  const ask = t.id === 'unloaded' ? null : convAsk('Explain: ' + t.measure, 'Explain how "' + t.measure + '" (' + (val || '—') + ') is worked out on the EMEA RevOps OS Conversion view. The dashboard says: ' + t.detail + ' If it looks off, check it with my Salesforce access.', { check: t.id });
  if (ask) meta.append(ask);
  li.append(OS.el('span', 'itm-dot ' + (LD_SEV[t.severity] || 'low')), main, meta);
  return li;
}));
