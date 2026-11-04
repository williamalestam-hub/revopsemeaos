// EMEA RevOps OS — calculations. Each fn uses only its inputs and constants written inside it,
// so readers can check the arithmetic in Sources. "Today" is the reader's clock.

// ===================== PIPELINE =====================
dash.calc('pipe_team', {
  title: 'Pipeline by team and manager',
  description: 'Open New Business and Upsell pipeline, rep commit, rep best case and stage bands per team and manager for this and next quarter, with closed won this quarter (by the date actually closed) and renewals at stake past stage 0. Best case is the rep\'s best-case ARR, never less than their commit on the same deals, so it already includes commit. Team comes from the owner role; "M|<manager>" rows total each manager\'s direct reports across teams.',
  inputs: ['pipe_stage', 'won_q', 'renew_stake'],
  fn: (pipe_stage, won_q, renew_stake) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const thisQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const nextQ = thisQ % 10 === 4 ? (Math.floor(thisQ / 10) + 1) * 10 + 1 : thisQ + 1;
    const out = new Map();
    const get = (region, manager) => {
      const key = region + '|' + manager;
      if (!out.has(key)) out.set(key, { key, region, manager, level: region === 'All' ? 'all' : region === 'M' ? 'manager' : manager === 'All' ? 'region' : 'team', thisPipe: 0, thisOpps: 0, thisCommit: 0, thisBest: 0, thisEarly: 0, thisMid: 0, thisLate: 0, nextPipe: 0, nextOpps: 0, nextEarly: 0, nextMid: 0, nextLate: 0, won: 0, renewThis: 0, renewThisCount: 0 });
      return out.get(key);
    };
    get('All', 'All');
    for (const t of new Set(Object.values(TEAM))) get(t, 'All');
    const each = (r, f) => {
      const region = TEAM[r.role] || 'Other';
      const manager = r.manager || '(no manager)';
      [get('All', 'All'), get(region, 'All'), get(region, manager), get('M', manager)].forEach(f);
    };
    for (const r of pipe_stage) {
      if (r.recordType === 'Renewal') continue;
      const q = r.fy * 10 + r.fq;
      const stage = parseInt(r.stage, 10);
      const band = stage <= 1 ? 'Early' : stage <= 3 ? 'Mid' : 'Late';
      each(r, (o) => {
        if (q === thisQ) {
          o.thisPipe += +r.arrUsd || 0; o.thisOpps += +r.opps || 0;
          o.thisCommit += +r.commitUsd || 0; o.thisBest += Math.max(+r.bestCaseUsd || 0, +r.commitUsd || 0);
          o['this' + band] += +r.arrUsd || 0;
        } else if (q === nextQ) {
          o.nextPipe += +r.arrUsd || 0; o.nextOpps += +r.opps || 0;
          o['next' + band] += +r.arrUsd || 0;
        }
      });
    }
    for (const r of won_q) {
      if (r.recordType === 'Renewal') continue;
      each(r, (o) => { o.won += +r.wonArrUsd || 0; });
    }
    for (const r of renew_stake) {
      if (r.fy * 10 + r.fq !== thisQ || String(r.stage).startsWith('0')) continue;
      each(r, (o) => { o.renewThis += +r.renewingArrUsd || 0; o.renewThisCount += +r.renewals || 0; });
    }
    return [...out.values()];
  },
});

dash.calc('pipe_reps', {
  title: 'Pipeline by rep',
  description: 'Per rep: New Business and Upsell pipeline this and next quarter, past-due opps (any close date already gone) and stale opps.',
  inputs: ['pipe_rep', 'pipe_pastdue', 'pipe_stale'],
  fn: (pipe_rep, pipe_pastdue, pipe_stale) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const thisQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const reps = new Map();
    const get = (owner) => {
      if (!reps.has(owner)) reps.set(owner, { owner, region: 'Other', role: null, manager: null, thisPipe: 0, thisOpps: 0, nextPipe: 0, nextOpps: 0, pastDue: 0, stale: 0 });
      return reps.get(owner);
    };
    for (const r of pipe_rep) {
      const o = get(r.owner);
      o.role = r.role; o.region = TEAM[r.role] || 'Other'; o.manager = r.manager || '(no manager)';
      if (r.fy * 10 + r.fq === thisQ) { o.thisPipe += +r.arrUsd || 0; o.thisOpps += +r.opps || 0; }
      else { o.nextPipe += +r.arrUsd || 0; o.nextOpps += +r.opps || 0; }
    }
    for (const r of pipe_pastdue) {
      const o = get(r.owner);
      o.pastDue = +r.pastDueOpps || 0;
      if (!o.role && r.role) { o.role = r.role; o.region = TEAM[r.role] || 'Other'; o.manager = r.manager || '(no manager)'; }
    }
    for (const r of pipe_stale) if (reps.has(r.owner)) get(r.owner).stale = +r.staleOpps || 0;
    return [...reps.values()];
  },
});

// ===================== CREATED =====================
dash.calc('cr_weeks', {
  title: 'Created opps per week',
  description: 'Daily created opps summed into the last 13 Monday-start weeks up to this one, with empty weeks as zero.',
  inputs: ['cr_daily'],
  fn: (cr_daily) => {
    const DAY = 864e5;
    const monday = (s) => { const d = new Date(s + 'T00:00:00Z'); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY); };
    const end = monday(new Date().toISOString().slice(0, 10));
    const start = new Date(end.getTime() - 12 * 7 * DAY);
    const weeks = new Map();
    for (let t = start.getTime(); t <= end.getTime(); t += 7 * DAY) {
      const k = new Date(t).toISOString().slice(0, 10);
      weeks.set(k, { week: k, nb: 0, up: 0, rn: 0, nbArr: 0, upArr: 0, rnArr: 0, opps: 0, arr: 0 });
    }
    for (const r of cr_daily) {
      const k = monday(String(r.day).slice(0, 10)).toISOString().slice(0, 10);
      const w = weeks.get(k);
      if (!w) continue;
      const t = r.rt === 'New Business' ? 'nb' : r.rt === 'Upsell' ? 'up' : 'rn';
      w[t] += +r.opps || 0; w[t + 'Arr'] += +r.arrUsd || 0;
      w.opps += +r.opps || 0; w.arr += +r.arrUsd || 0;
    }
    return [...weeks.values()];
  },
});

dash.calc('cr_months', {
  title: 'Created opps per month',
  description: 'Created opps and ARR per calendar month by type, the last 12 months including this one.',
  inputs: ['cr_monthly'],
  fn: (cr_monthly) => {
    const months = new Map();
    for (const r of cr_monthly) {
      const k = r.yr + '-' + String(r.mo).padStart(2, '0');
      if (!months.has(k)) months.set(k, { month: k, nb: 0, up: 0, rn: 0, nbArr: 0, upArr: 0, rnArr: 0, opps: 0, arr: 0 });
      const m = months.get(k);
      const t = r.rt === 'New Business' ? 'nb' : r.rt === 'Upsell' ? 'up' : 'rn';
      m[t] += +r.opps || 0; m[t + 'Arr'] += +r.arrUsd || 0;
      m.opps += +r.opps || 0; m.arr += +r.arrUsd || 0;
    }
    return [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  },
});

dash.calc('cr_mix', {
  title: 'Created opps by source',
  description: 'Source buckets: BDR-sourced (originating BDR set, or created by a BDR), Expansion (upsells), Inbound (lead source Inbound), Rep-sourced (the rest). This quarter against last.',
  inputs: ['cr_source'],
  fn: (cr_source) => {
    const bucket = (r) => (r.bdrRole || /^(BDR-|DIR-BDR-)/.test(r.creatorRole || '')) ? 'BDR-sourced'
      : r.rt === 'Upsell' ? 'Expansion (upsell)'
      : r.leadSource === 'Inbound' ? 'Inbound' : 'Rep-sourced';
    const n = new Date();
    const thisQ = n.getUTCFullYear() * 10 + Math.floor(n.getUTCMonth() / 3) + 1;
    const lastQ = thisQ % 10 === 1 ? (Math.floor(thisQ / 10) - 1) * 10 + 4 : thisQ - 1;
    const ORDER = ['BDR-sourced', 'Inbound', 'Rep-sourced', 'Expansion (upsell)', 'Total'];
    const rows = new Map(ORDER.map((s) => [s, { source: s, thisOpps: 0, thisArr: 0, lastOpps: 0, lastArr: 0 }]));
    for (const r of cr_source) {
      const q = r.yr * 10 + r.qtr;
      const p = q === thisQ ? 'this' : q === lastQ ? 'last' : null;
      if (!p) continue;
      for (const k of [bucket(r), 'Total']) {
        rows.get(k)[p + 'Opps'] += +r.opps || 0;
        rows.get(k)[p + 'Arr'] += +r.arrUsd || 0;
      }
    }
    return [...rows.values()];
  },
});

dash.calc('cr_kpi', {
  title: 'Created opps headline',
  description: 'Created this week and last week (Monday-start), this quarter and last quarter, and the BDR-sourced share of this quarter by count.',
  inputs: ['cr_weeks', 'cr_mix'],
  fn: (cr_weeks, cr_mix) => {
    const d = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5);
    const thisMon = mon.toISOString().slice(0, 10);
    const lastMon = new Date(mon.getTime() - 7 * 864e5).toISOString().slice(0, 10);
    const w = cr_weeks.find((x) => x.week === thisMon) || {};
    const lw = cr_weeks.find((x) => x.week === lastMon) || {};
    const tot = cr_mix.find((r) => r.source === 'Total') || {};
    const bdr = cr_mix.find((r) => r.source === 'BDR-sourced') || {};
    return [{
      thisWeekOpps: w.opps || 0, thisWeekArr: w.arr || 0, lastWeekOpps: lw.opps || 0, lastWeekArr: lw.arr || 0,
      thisQOpps: tot.thisOpps || 0, thisQArr: tot.thisArr || 0, lastQOpps: tot.lastOpps || 0, lastQArr: tot.lastArr || 0,
      bdrShareThisQ: tot.thisOpps ? (bdr.thisOpps || 0) / tot.thisOpps : null,
    }];
  },
});

dash.calc('cr_leader', {
  title: 'Created opps by rep',
  description: 'New Business and Upsell opps created this quarter per owner, with ARR and the BDR-sourced count.',
  inputs: ['cr_owner_q'],
  fn: (cr_owner_q) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const reps = new Map();
    for (const r of cr_owner_q) {
      if (!reps.has(r.owner)) reps.set(r.owner, { owner: r.owner, region: TEAM[r.role] || 'Other', manager: r.manager || '(no manager)', nb: 0, up: 0, opps: 0, arr: 0, bdrSourced: 0 });
      const o = reps.get(r.owner);
      if (r.rt === 'New Business') o.nb += +r.opps || 0;
      else if (r.rt === 'Upsell') o.up += +r.opps || 0;
      o.opps += +r.opps || 0; o.arr += +r.arrUsd || 0; o.bdrSourced += +r.bdrSourced || 0;
    }
    return [...reps.values()];
  },
});

dash.calc('cr_bdrs', {
  title: 'BDR leaderboard',
  description: 'Opps sourced per EMEA BDR this quarter and last.',
  inputs: ['cr_bdr'],
  fn: (cr_bdr) => {
    const n = new Date();
    const thisQ = n.getUTCFullYear() * 10 + Math.floor(n.getUTCMonth() / 3) + 1;
    const lastQ = thisQ % 10 === 1 ? (Math.floor(thisQ / 10) - 1) * 10 + 4 : thisQ - 1;
    const m = new Map();
    for (const r of cr_bdr) {
      if (!m.has(r.bdr)) m.set(r.bdr, { bdr: r.bdr, manager: r.bdrManager || '(no manager)', thisOpps: 0, thisArr: 0, lastOpps: 0, lastArr: 0 });
      const o = m.get(r.bdr);
      const q = r.yr * 10 + r.qtr;
      if (q === thisQ) { o.thisOpps += +r.opps || 0; o.thisArr += +r.arrUsd || 0; }
      else if (q === lastQ) { o.lastOpps += +r.opps || 0; o.lastArr += +r.arrUsd || 0; }
    }
    return [...m.values()].sort((a, b) => b.thisOpps - a.thisOpps || b.lastOpps - a.lastOpps);
  },
});

// ===================== ROUTING =====================
dash.calc('rr_people', {
  title: 'Who is in routing',
  description: 'Active EMEA reps in a routed role (AE, SMB, BDR, EM) with their pools of that kind, 90-day assignments and a status. Missing: in no pool of their kind 7+ days after their Legora start date in Salesforce, or 14+ days after their Salesforce user was created when no start date is set (users are often created before day 1). Suggested pools for someone in none: pools of their kind that at least half of their active same-role peers are in.',
  inputs: ['roster', 'rr_members', 'rr_assign'],
  fn: (roster, rr_members, rr_assign) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const kindOfRole = (role) => /^AE-EMEA-/.test(role) ? 'AE' : role === 'SMB-EMEA' ? 'SMB' : role === 'BDR-EMEA' ? 'BDR' : /^EM-EMEA/.test(role) ? 'EM' : null;
    const kindOfPool = (p) => /^RR BDR/i.test(p) ? 'BDR' : /^RR SMB/i.test(p) ? 'SMB' : /^EM/i.test(p) ? 'EM' : /^RR Gov/i.test(p) ? 'AE' : /^RR:/i.test(p) ? 'AE' : 'Other';
    const id15 = (s) => String(s || '').slice(0, 15);
    const pools = new Map();
    for (const m of rr_members) {
      const k = id15(m.userId);
      if (!pools.has(k)) pools.set(k, []);
      pools.get(k).push(m.poolName);
    }
    const assigned = new Map();
    for (const a of rr_assign) {
      const k = id15(a.userId);
      assigned.set(k, (assigned.get(k) || 0) + (+a.assignments || 0));
    }
    const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    const peersByRole = new Map();
    for (const u of roster) {
      if (!u.isActive || !kindOfRole(u.role)) continue;
      if (!peersByRole.has(u.role)) peersByRole.set(u.role, []);
      peersByRole.get(u.role).push(u);
    }
    const suggest = (u, kind) => {
      const peers = (peersByRole.get(u.role) || []).filter((p) => p.userId !== u.userId && (pools.get(id15(p.userId)) || []).length);
      if (!peers.length) return '';
      const count = new Map();
      for (const p of peers) for (const pool of new Set(pools.get(id15(p.userId)) || [])) if (kindOfPool(pool) === kind) count.set(pool, (count.get(pool) || 0) + 1);
      return [...count.entries()].filter(([, n]) => n / peers.length >= 0.5).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([p]) => p).join(', ');
    };
    const out = [];
    for (const u of roster) {
      if (!u.isActive) continue;
      const kind = kindOfRole(u.role);
      if (!kind) continue;
      const mine = [...new Set(pools.get(id15(u.userId)) || [])].sort();
      const ofKind = mine.filter((p) => kindOfPool(p) === kind);
      const since = String(u.startDate || u.createdDate || '').slice(0, 10);
      const days = since ? Math.floor((today - Date.parse(since + 'T00:00:00Z')) / 864e5) : null;
      const n = assigned.get(id15(u.userId)) || 0;
      const status = ofKind.length ? (n ? 'In routing' : 'In routing, none assigned')
        : days != null && days < 0 ? 'Not started'
        : days != null && days < (u.startDate ? 7 : 14) ? 'New: add next week'
        : days != null && days < 45 ? 'New joiner: overdue'
        : 'Missing';
      out.push({ userId: u.userId, name: u.name, region: TEAM[u.role] || 'Other', role: u.role, kind, manager: u.manager || '(no manager)', createdDate: String(u.createdDate || '').slice(0, 10) || null, startDate: u.startDate || null, suggested: ofKind.length ? '' : suggest(u, kind), daysIn: days, pools: ofKind.length, poolNames: ofKind.join(', '), otherPools: mine.length - ofKind.length, assignments: n, status });
    }
    return out;
  },
});

dash.calc('rr_pools', {
  title: 'Pools and members',
  description: 'Each EMEA LeanData pool (name across object types) with its members, their teams and managers, inactive members, 90-day assignments to its current members and how evenly they were spread (members in the pool 30+ days who got none while the pool had 10 or more).',
  inputs: ['rr_members', 'rr_assign', 'roster'],
  fn: (rr_members, rr_assign, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const kindOfPool = (p) => /^RR BDR/i.test(p) ? 'BDR' : /^RR SMB/i.test(p) ? 'SMB' : /^EM/i.test(p) ? 'EM' : /^RR Gov/i.test(p) ? 'Gov (AE)' : /^RR:/i.test(p) ? 'AE' : 'Other';
    const mgr = new Map(roster.map((u) => [String(u.userId).slice(0, 15), u.manager || null]));
    const pools = new Map();
    for (const m of rr_members) {
      if (!pools.has(m.poolName)) pools.set(m.poolName, { pool: m.poolName, family: kindOfPool(m.poolName), users: new Map(), assignments: 0, lastAssigned: null, per: new Map() });
      const id = String(m.userId).slice(0, 15);
      pools.get(m.poolName).users.set(id, { id, name: m.userName, active: m.userActive !== false, region: TEAM[m.userRole] || 'Other', manager: mgr.get(id) || null, added: String(m.addedOn || '').slice(0, 10) || null });
    }
    for (const a of rr_assign) {
      const p = pools.get(a.poolName);
      if (!p) continue;
      const id = String(a.userId || '').slice(0, 15);
      if (id && p.users.has(id)) {
        p.assignments += +a.assignments || 0;
        p.per.set(id, (p.per.get(id) || 0) + (+a.assignments || 0));
      }
      const d = String(a.lastAssigned || '').slice(0, 10);
      if (d && (!p.lastAssigned || d > p.lastAssigned)) p.lastAssigned = d;
    }
    return [...pools.values()].map((p) => {
      const us = [...p.users.values()];
      const inactive = us.filter((u) => !u.active).length;
      const counts = us.filter((u) => u.active).map((u) => p.per.get(u.id) || 0);
      const minA = counts.length ? Math.min(...counts) : 0;
      const maxA = counts.length ? Math.max(...counts) : 0;
      const cut30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const starved = us.filter((u) => u.active && p.assignments >= 10 && !(p.per.get(u.id) || 0) && (!u.added || u.added <= cut30)).map((u) => u.name);
      const flag = inactive ? 'Inactive member' : !p.assignments ? 'No assignments in 90 days' : starved.length ? 'Member getting none' : us.length === 1 ? 'Single member' : 'OK';
      return { pool: p.pool, family: p.family, members: us.length, inactiveMembers: inactive, memberNames: us.map((u) => u.name + (u.active ? '' : ' (inactive)')).sort().join(', '), regions: [...new Set(us.map((u) => u.region))].join('|'), managers: [...new Set(us.map((u) => u.manager).filter(Boolean))].join('|'), assignments: p.assignments, lastAssigned: p.lastAssigned, balance: counts.length > 1 ? minA + '–' + maxA : null, starved: starved.join(', '), flag };
    });
  },
});

dash.calc('rr_kpi', {
  title: 'Routing headline',
  description: 'Per team, per manager ("M|<manager>") and for all EMEA: reps missing from routing, joiners to add next week, inactive users still in pools, pools and pools with no assignment in 90 days.',
  inputs: ['rr_people', 'rr_pools', 'rr_members', 'roster'],
  fn: (rr_people, rr_pools, rr_members, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const regions = ['All', ...new Set(Object.values(TEAM))];
    const managers = [...new Set(rr_people.map((p) => p.manager).filter((m) => m && m !== '(no manager)'))];
    return regions.map((r) => ({ scope: r, isMgr: false })).concat(managers.map((m) => ({ scope: 'M|' + m, isMgr: true, m }))).map(({ scope, isMgr, m }) => {
      const region = scope;
      const inR = (r) => region === 'All' || r === region;
      const people = rr_people.filter((p) => (isMgr ? p.manager === m : inR(p.region)));
      const pools = rr_pools.filter((p) => (isMgr ? p.managers.split('|').includes(m) : region === 'All' || p.regions.split('|').includes(region)));
      const mgrOf = (id) => (roster.find((u) => String(u.userId).slice(0, 15) === String(id).slice(0, 15)) || {}).manager || null;
      const inactive = new Set(rr_members.filter((x) => x.userActive === false && (isMgr ? mgrOf(x.userId) === m : inR(TEAM[x.userRole] || 'Other'))).map((x) => x.userId));
      return {
        region,
        missing: people.filter((p) => p.status === 'Missing' || p.status === 'New joiner: overdue').length,
        weekOne: people.filter((p) => p.status === 'New: add next week').length,
        inactiveMembers: inactive.size,
        pools: pools.length,
        idlePools: pools.filter((p) => !p.assignments).length,
      };
    });
  },
});

// ===================== HIRING =====================
dash.calc('people_core', {
  title: 'People (HiBob), matched to Salesforce',
  description: 'HiBob people matched to a Salesforce user by work email (an active user, any role), or failing that by normalised name against the EMEA roster, with days since start and a status. Routed roles (AE, SMB, BDR, EM) get "In a routed role" here; people adds their LeanData pools and the pool status. Someone whose HiBob title is a selling one (GTM Manager, Associate or Team Lead, BDR, Engagement Manager) but whose Salesforce user has no role or a role outside EMEA sales gets that as their status; other roles show as not routed. Also flags when HiBob and Salesforce name a different manager. Needs no LeanData, so the person panel and HiBob checks work without it.',
  inputs: ['hb_people', 'roster', 'users_all'],
  fn: (hb_people, roster, users_all) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const kindOfRole = (role) => /^AE-EMEA-/.test(role || '') ? 'AE' : role === 'SMB-EMEA' ? 'SMB' : role === 'BDR-EMEA' ? 'BDR' : /^EM-EMEA/.test(role || '') ? 'EM' : null;
    const SELLER = /(^|\s)(GTM (Manager|Associate|Team Lead)|Business Development Representative|Engagement Manager|Account (Executive|Manager))\b/i;
    const toks = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
    const sameName = (a, b) => {
      const x = toks(a), y = toks(b);
      if (!x.length || !y.length) return false;
      return x.join(' ') === y.join(' ') || (x[0] === y[0] && x[x.length - 1] === y[y.length - 1]);
    };
    // email: active users of any role; when two users share an address, an EMEA-role user wins, then the lowest id
    const byEmail = new Map();
    const ordered = users_all.slice().sort((a, b) => (TEAM[a.role] ? 1 : 0) - (TEAM[b.role] ? 1 : 0) || String(b.userId).localeCompare(String(a.userId)));
    for (const u of ordered) {
      const e = String(u.email || '').trim().toLowerCase();
      if (e) byEmail.set(e, u);
    }
    // name: the EMEA roster (active users win over inactive ones with the same name)
    const rosterById = new Map(roster.map((u) => [String(u.userId).slice(0, 15), u]));
    const full = new Map(), firstLast = new Map();
    for (const u of roster.slice().sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? 1 : -1))) {
      const t = toks(u.name);
      if (!t.length) continue;
      full.set(t.join(' '), u);
      firstLast.set(t[0] + ' ' + t[t.length - 1], u);
    }
    const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    return hb_people.map((p) => {
      const t = toks(p.name);
      const viaEmail = p.email ? byEmail.get(String(p.email).toLowerCase()) || null : null;
      const viaName = viaEmail ? null : full.get(t.join(' ')) || (t.length ? firstLast.get(t[0] + ' ' + t[t.length - 1]) : null) || null;
      const hit = viaEmail || viaName;
      const sf = hit ? { ...hit, ...(rosterById.get(String(hit.userId).slice(0, 15)) || {}) } : null;
      const start = p.startDate ? String(p.startDate).slice(0, 10) : null;
      const daysIn = start ? Math.floor((today - Date.parse(start + 'T00:00:00Z')) / 864e5) : null;
      const emea = !!(sf && TEAM[sf.role]);
      const seller = SELLER.test(String(p.title || ''));
      const kind = emea ? kindOfRole(sf.role) : null;
      const status = daysIn != null && daysIn < 0 ? 'Not started'
        : !sf ? (daysIn != null && daysIn < 7 ? 'Week 1, no Salesforce user yet' : 'No Salesforce user')
        : !emea && seller ? (sf.role ? 'Role outside EMEA sales' : 'No Salesforce role')
        : !kind ? 'Not routed'
        : 'In a routed role';
      const sfManager = sf ? sf.manager || null : null;
      const mgrDiffers = !!(sf && p.manager && (sfManager ? !sameName(p.manager, sfManager) : true));
      return {
        id: p.id, name: p.name, title: p.title, department: p.department, team: p.team || p.department, site: p.site, manager: p.manager,
        startDate: start, daysIn, sfName: sf ? sf.name : null, sfUserId: sf ? sf.userId : null, sfRole: sf ? sf.role || null : null, sfManager,
        matchedBy: viaEmail ? 'email' : viaName ? 'name' : null, sellerTitle: seller, mgrDiffers,
        region: sf ? (TEAM[sf.role] || 'Other') : 'Not matched', kind, pools: null, status,
      };
    });
  },
});

dash.calc('people', {
  title: 'People (HiBob) and their routing pools',
  description: 'people_core plus, for people in a routed role, the EMEA LeanData pools of their kind (AE, SMB, BDR, EM) and the routing status: in routing, add in week 2 (started under 7 days ago), or overdue for a pool. The Hiring screen falls back to people_core when LeanData can\'t be read.',
  inputs: ['people_core', 'rr_members'],
  fn: (people_core, rr_members) => {
    const kindOfPool = (p) => /^RR BDR/i.test(p) ? 'BDR' : /^RR SMB/i.test(p) ? 'SMB' : /^EM/i.test(p) ? 'EM' : /^RR(:| Gov)/i.test(p) ? 'AE' : 'Other';
    const pools = new Map();
    for (const m of rr_members) {
      const k = String(m.userId).slice(0, 15);
      if (!pools.has(k)) pools.set(k, new Set());
      pools.get(k).add(m.poolName);
    }
    return people_core.map((p) => {
      if (p.status !== 'In a routed role') return { ...p, pools: 0 };
      const mine = [...(pools.get(String(p.sfUserId).slice(0, 15)) || [])].filter((x) => kindOfPool(x) === p.kind);
      return { ...p, pools: mine.length, status: mine.length ? 'In routing' : p.daysIn != null && p.daysIn < 7 ? 'Add in week 2' : 'Overdue: add to pool' };
    });
  },
});

dash.calc('hire_kpi', {
  title: 'Hiring headline',
  description: 'Per team (matched Salesforce role) and for all EMEA: people on headcount, joined in 30 and 90 days, and among those who joined in 90 days the ones overdue for a pool or with no Salesforce user.',
  inputs: ['people'],
  fn: (people) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(people.map((p) => p.sfManager).filter(Boolean))];
    return regions.concat(managers.map((m) => 'M|' + m)).map((region) => {
      const ps = people.filter((p) => (region.startsWith('M|') ? p.sfManager === region.slice(2) : region === 'All' || p.region === region));
      const recent = ps.filter((p) => p.daysIn != null && p.daysIn >= 0 && p.daysIn < 90);
      return {
        region,
        headcount: ps.length,
        joined30: ps.filter((p) => p.daysIn != null && p.daysIn >= 0 && p.daysIn < 30).length,
        joined90: recent.length,
        overdue: recent.filter((p) => p.status === 'Overdue: add to pool').length,
        noSf: recent.filter((p) => p.status === 'No Salesforce user').length,
      };
    });
  },
});

dash.calc('hire_kpi_basic', {
  title: 'Hiring headline, without pools',
  description: 'The hiring headline from people_core, for a viewer who can\'t read LeanData: people on headcount, joined in 30 and 90 days, and joiners with no Salesforce user. Overdue for a pool is unknown here.',
  inputs: ['people_core'],
  fn: (people) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(people.map((p) => p.sfManager).filter(Boolean))];
    return regions.concat(managers.map((m) => 'M|' + m)).map((region) => {
      const ps = people.filter((p) => (region.startsWith('M|') ? p.sfManager === region.slice(2) : region === 'All' || p.region === region));
      const recent = ps.filter((p) => p.daysIn != null && p.daysIn >= 0 && p.daysIn < 90);
      return {
        region,
        headcount: ps.length,
        joined30: ps.filter((p) => p.daysIn != null && p.daysIn >= 0 && p.daysIn < 30).length,
        joined90: recent.length,
        overdue: null,
        noSf: recent.filter((p) => p.status === 'No Salesforce user').length,
      };
    });
  },
});

dash.calc('hire_months', {
  title: 'Joiners by month',
  description: 'People on headcount by start month and HiBob department, last 12 months including this one.',
  inputs: ['hb_people'],
  fn: (hb_people) => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push({ month: d.toISOString().slice(0, 7), gtm: 0, eng: 0, growth: 0, total: 0 });
    }
    const byKey = new Map(months.map((m) => [m.month, m]));
    for (const p of hb_people) {
      const m = byKey.get(String(p.startDate || '').slice(0, 7));
      if (!m) continue;
      const k = p.department === 'Engagement EMEA' ? 'eng' : p.department === 'Growth EMEA' ? 'growth' : 'gtm';
      m[k] += 1; m.total += 1;
    }
    return months;
  },
});

dash.calc('hire_teams', {
  title: 'Headcount by team',
  description: 'People on headcount per HiBob team, and how many joined in the last 90 days.',
  inputs: ['people_core'],
  fn: (people) => {
    const m = new Map();
    for (const p of people) {
      const t = p.team || '(no team)';
      if (!m.has(t)) m.set(t, { team: t, people: 0, joined90: 0 });
      const o = m.get(t);
      o.people += 1;
      if (p.daysIn != null && p.daysIn >= 0 && p.daysIn < 90) o.joined90 += 1;
    }
    return [...m.values()].sort((a, b) => b.people - a.people);
  },
});

// ===================== BOOKS =====================
dash.calc('books_owner', {
  title: 'Book size per rep',
  description: 'Per EMEA rep: accounts owned, active accounts (customer, pipeline, engaging), customers and their ARR, customers where they are Engagement Manager, open New Business and Upsell pipeline and open renewals. For AE and SMB reps, active accounts against their team median: Heavy at 2x or more, Light at half or less.',
  inputs: ['bk_owner', 'bk_pipe', 'bk_em'],
  fn: (bk_owner, bk_pipe, bk_em) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const m = new Map();
    const get = (owner, role, manager, active) => {
      if (!m.has(owner)) m.set(owner, { owner, region: TEAM[role] || 'Other', role, manager: manager || '(no manager)', active: active !== false, accounts: 0, active_: 0, customers: 0, arr: 0, emCustomers: 0, emArr: 0, openPipe: 0, openOpps: 0, openRenewals: 0 });
      return m.get(owner);
    };
    for (const r of bk_owner) {
      const o = get(r.owner, r.role, r.manager, r.active);
      o.accounts += +r.accounts || 0;
      if (['Customer', 'Pipeline', 'Engaging'].includes(r.status)) o.active_ += +r.accounts || 0;
      if (r.status === 'Customer') { o.customers += +r.accounts || 0; o.arr += +r.arrUsd || 0; }
    }
    for (const r of bk_em) {
      const o = get(r.em, r.emRole, r.emManager, r.emActive);
      o.emCustomers += +r.accounts || 0; o.emArr += +r.arrUsd || 0;
    }
    for (const r of bk_pipe) {
      if (!m.has(r.owner)) continue;
      const o = m.get(r.owner);
      if (r.motion === 'Renewal') o.openRenewals += +r.openOpps || 0;
      else { o.openPipe += +r.openArrUsd || 0; o.openOpps += +r.openOpps || 0; }
    }
    const rows = [...m.values()].map(({ active_, ...o }) => ({ ...o, active: active_, ownerActive: o.active }));
    const median = (xs) => { const v = xs.slice().sort((a, b) => a - b); const n = v.length; return n ? (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) : 0; };
    const sellers = (r) => /^(AE-EMEA-|SMB-EMEA)/.test(r.role || '') && r.ownerActive;
    const med = new Map();
    for (const reg of new Set(rows.filter(sellers).map((r) => r.region))) med.set(reg, median(rows.filter((r) => sellers(r) && r.region === reg).map((r) => r.active)));
    return rows.map((r) => {
      const m0 = sellers(r) ? med.get(r.region) : null;
      const ratio = m0 ? r.active / m0 : null;
      return { ...r, teamMedian: m0, vsMedian: ratio, balance: ratio == null ? '' : ratio >= 2 ? 'Heavy' : ratio <= 0.5 ? 'Light' : 'In range' };
    });
  },
});

dash.calc('books_kpi', {
  title: 'Account books headline',
  description: 'Per team and for all EMEA: accounts owned by EMEA reps, customers and customer ARR.',
  inputs: ['books_owner'],
  fn: (books_owner) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(books_owner.map((r) => r.manager).filter((m) => m && m !== '(no manager)'))];
    return regions.concat(managers.map((m) => 'M|' + m)).map((region) => {
      const rs = books_owner.filter((r) => (region.startsWith('M|') ? r.manager === region.slice(2) : region === 'All' || r.region === region));
      return { region, accounts: rs.reduce((s, r) => s + r.accounts, 0), customers: rs.reduce((s, r) => s + r.customers, 0), arr: rs.reduce((s, r) => s + r.arr, 0) };
    });
  },
});

dash.calc('coverage', {
  title: 'Territory coverage',
  description: 'Active accounts (customer, pipeline, engaging) per EMEA sales region by owner group, the share owned by the EMEA team, and customer ARR.',
  inputs: ['bk_terr'],
  fn: (bk_terr) => {
    const group = (role) => !role ? 'unassigned' : role === 'REVOPS' ? 'revops' : /STRAT/.test(role) ? 'strategic' : /Partnerships/i.test(role) ? 'partners' : /EMEA/.test(role) && !/^(LE|MGR-LE|DIR-LE)-/.test(role) ? 'emea' : 'otherRegion';
    const m = new Map();
    const get = (k) => {
      if (!m.has(k)) m.set(k, { salesRegion: k, emea: 0, strategic: 0, partners: 0, otherRegion: 0, revops: 0, unassigned: 0, total: 0, coveredShare: null, customerArr: 0 });
      return m.get(k);
    };
    for (const r of bk_terr) {
      for (const o of [get(r.salesRegion), get('All EMEA regions')]) {
        if (r.status === 'Customer') o.customerArr += +r.arrUsd || 0;
        if (!['Customer', 'Pipeline', 'Engaging'].includes(r.status)) continue;
        o[group(r.ownerRole)] += +r.accounts || 0;
        o.total += +r.accounts || 0;
      }
    }
    const rows = [...m.values()].map((o) => ({ ...o, coveredShare: o.total ? o.emea / o.total : null }));
    return rows.sort((a, b) => (a.salesRegion === 'All EMEA regions') - (b.salesRegion === 'All EMEA regions') || b.total - a.total);
  },
});

dash.calc('orphans', {
  title: 'Orphan accounts',
  description: 'Orphan accounts with a reason: inactive owner, unassigned (no role), RevOps holding, strategic or partnerships owner (review), or an owner outside EMEA.',
  inputs: ['bk_orphans'],
  fn: (bk_orphans) => bk_orphans.map((r) => ({
    ...r,
    reason: r.ownerActive === false ? 'Inactive owner'
      : !r.ownerRole ? 'Unassigned'
      : r.ownerRole === 'REVOPS' ? 'RevOps holding'
      : /STRAT/.test(r.ownerRole) ? 'Strategic (review)'
      : /Partnerships/i.test(r.ownerRole) ? 'Partnerships (review)'
      : 'Owner outside EMEA',
  })),
});

dash.calc('books', {
  title: 'Account books',
  description: 'Per account book (Territory ID): number of owners, main owner and their share of accounts, total accounts and ARR, and a check.',
  inputs: ['bk_books', 'roster'],
  fn: (bk_books, roster) => {
    const mgrOf = new Map(roster.filter((u) => u.isActive).map((u) => [u.name, u.manager || null]));
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const m = new Map();
    for (const r of bk_books) {
      if (!m.has(r.book)) m.set(r.book, { book: r.book, owners: [], accounts: 0, arr: 0 });
      const b = m.get(r.book);
      b.owners.push(r); b.accounts += +r.accounts || 0; b.arr += +r.arrUsd || 0;
    }
    return [...m.values()].map((b) => {
      const main = b.owners.slice().sort((x, y) => (+y.accounts || 0) - (+x.accounts || 0))[0];
      const share = b.accounts ? (+main.accounts || 0) / b.accounts : null;
      const flag = !main.ownerRole ? 'Unassigned main owner'
        : !TEAM[main.ownerRole] ? 'Main owner outside EMEA'
        : b.owners.some((o) => o.ownerActive === false) ? 'Inactive owner'
        : share < 0.8 ? 'Split' : 'OK';
      return { book: b.book, mainOwner: main.owner, mainRole: main.ownerRole, region: TEAM[main.ownerRole] || 'Other', manager: mgrOf.get(main.owner) || null, mainShare: share, owners: b.owners.length, accounts: b.accounts, arr: b.arr, flag };
    });
  },
});

dash.calc('orphan_kpi', {
  title: 'Orphans and split books',
  description: 'Orphan active accounts and their ARR (strategic and partnerships owners not counted), and books whose main owner holds under 80%.',
  inputs: ['orphans', 'books'],
  fn: (orphans, books) => {
    const real = orphans.filter((o) => !/review/.test(o.reason));
    return [{ accounts: real.length, arr: real.reduce((s, o) => s + (+o.arrUsd || 0), 0), splitBooks: books.filter((b) => b.flag === 'Split').length }];
  },
});

dash.calc('book_pool', {
  title: 'Routing against books',
  description: 'Active AE and SMB reps: the account books they own most of, how many routing pools they are in, and a check (a book but no pool, or pools but no book).',
  inputs: ['books', 'rr_members', 'roster'],
  fn: (books, rr_members, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB' };
    const pools = new Map();
    for (const m of rr_members) {
      const k = String(m.userId).slice(0, 15);
      if (!pools.has(k)) pools.set(k, new Set());
      pools.get(k).add(m.poolName);
    }
    const booksBy = new Map();
    for (const b of books) {
      if (!booksBy.has(b.mainOwner)) booksBy.set(b.mainOwner, []);
      booksBy.get(b.mainOwner).push(b.book);
    }
    return roster.filter((u) => u.isActive && TEAM[u.role]).map((u) => {
      const bl = (booksBy.get(u.name) || []).sort();
      const pn = (pools.get(String(u.userId).slice(0, 15)) || new Set()).size;
      const flag = bl.length && !pn ? 'Book, no pool' : !bl.length && pn ? 'Pool, no book' : !bl.length && !pn ? 'No book, no pool' : 'OK';
      return { userId: u.userId, name: u.name, region: TEAM[u.role], manager: u.manager || null, books: bl.length, bookList: bl.join(', '), pools: pn, flag };
    });
  },
});

// ===================== PERSON =====================
dash.calc('person', {
  title: 'Person view',
  description: 'One row per Salesforce person (by name) joining their roster entry, pipeline, created opps and account book. Bookings and routing (rr_people) are their own calcs, so the panel still opens when closed deals or LeanData cannot be read.',
  inputs: ['roster', 'pipe_reps', 'cr_leader', 'books_owner'],
  fn: (roster, pipe_reps, cr_leader, books_owner) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const m = new Map();
    const get = (name) => {
      if (!m.has(name)) m.set(name, { name, userId: null, role: null, region: null, manager: null, isActive: null, title: null, createdDate: null, startDate: null, thisPipe: 0, thisOpps: 0, nextPipe: 0, pastDue: 0, stale: 0, crNb: 0, crUp: 0, crOpps: 0, crArr: 0, crBdr: 0, accounts: 0, activeAccts: 0, customers: 0, custArr: 0, emCustomers: 0, openPipe: 0, openRenewals: 0, inRoster: false });
      return m.get(name);
    };
    for (const u of roster.slice().sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? 1 : -1))) {
      Object.assign(get(u.name), { userId: u.userId, role: u.role, region: TEAM[u.role] || 'Other', manager: u.manager || null, isActive: u.isActive, title: u.title || null, createdDate: u.createdDate || null, startDate: u.startDate || null, inRoster: true });
    }
    for (const r of pipe_reps) {
      const o = get(r.owner);
      Object.assign(o, { thisPipe: r.thisPipe, thisOpps: r.thisOpps, nextPipe: r.nextPipe, pastDue: r.pastDue, stale: r.stale });
      if (!o.role) { o.role = r.role; o.region = r.region; o.manager = r.manager; }
    }
    for (const r of cr_leader) Object.assign(get(r.owner), { crNb: r.nb, crUp: r.up, crOpps: r.opps, crArr: r.arr, crBdr: r.bdrSourced });
    for (const r of books_owner) {
      const o = get(r.owner);
      Object.assign(o, { accounts: r.accounts, activeAccts: r.active, customers: r.customers, custArr: r.arr, emCustomers: r.emCustomers, openPipe: r.openPipe, openRenewals: r.openRenewals });
      if (!o.role) { o.role = r.role; o.region = r.region; o.manager = r.manager; }
    }
    return [...m.values()].map((o) => ({ ...o, region: o.region || 'Other' }));
  },
});

dash.calc('person_bk', {
  title: 'Person view, bookings',
  description: 'Per rep, by name: won this quarter and last (ARR and count), lost this quarter, win rate and average won deal, from Bookings.',
  inputs: ['bookings'],
  fn: (bookings) => bookings.map((r) => ({ name: r.owner, wonThisArr: r.wonThisArr, wonThis: r.wonThis, lostThis: r.lostThis, wonLastArr: r.wonLastArr, winRateThis: r.winRateThis, avgDealThis: r.avgDealThis })),
});

dash.calc('person_hb', {
  title: 'Person view, HiBob',
  description: 'HiBob details per person, keyed by their matched Salesforce name (or HiBob name when there is no match): title, team, site, manager, start date, hiring status, how they were matched (email or name), their Salesforce role and manager, and whether the two managers differ.',
  inputs: ['people_core'],
  fn: (people) => {
    const m = new Map();
    for (const p of people) {
      m.set(p.sfName || p.name, { name: p.sfName || p.name, hbName: p.name, title: p.title, team: p.team, site: p.site, manager: p.manager, startDate: p.startDate, daysIn: p.daysIn, hiring: p.status === 'In a routed role' ? null : p.status, sfMatched: !!p.sfName, matchedBy: p.matchedBy, sfRole: p.sfRole, sfManager: p.sfManager, mgrDiffers: p.mgrDiffers });
    }
    return [...m.values()];
  },
});

// ===================== ACTION ITEMS =====================
dash.calc('gr_actions', {
  title: 'Action items from meetings',
  description: 'Items under a "Next steps", "Action items", "Follow-ups" or "To-dos" heading of your Granola summaries (a bullet and the indented lines under it), plus to-do lines in your private notes. A due date is read from the wording relative to the meeting date ("today", "tomorrow", "this week", "next week", "by Friday" (the next Friday after the meeting), "in two weeks", "end of month", "by 30 Oct", "by 30/10"): overdue once it has passed, due soon within 3 days. The owner is the name in brackets after the item, before a colon, or the name a group of items sits under; it is yours when it matches your Granola name or email. "For you" is yours, or unassigned in a note you took. Placeholders such as "None" are left out.',
  inputs: ['gr_notes'],
  fn: (gr_notes) => {
    const ACTION = /\b(next steps?|action items?|action points?|actions?|follow[- ]?ups?|to[- ]?dos?|tasks?)\b/i;
    const NOT_ACTION = /\b(questions?|taken|completed|done|force|discussed)\b/i;
    const isAction = (s) => !!s && ACTION.test(s) && !NOT_ACTION.test(s);
    const TODO = /^(\[[ xX]?\]|todo\b|to do\b|action( item)?\s*:|ai\s*:|follow[- ]?up\s*:|f\/u\b)/i;
    const PLACEHOLDER = /^(none|n\/?a|tbd|nothing( further)?|no (specific |clear |other |further )?(next steps|action items|actions|follow[- ]?ups?)\b.*)\.?$/i;
    const NM = "\\p{Lu}[\\p{L}'’.-]*(?:\\s(?:(?:van|von|der|den|de|da|di|du|del|la|le|ter|ten|af)\\s)*\\p{Lu}[\\p{L}'’.-]*){0,3}";
    const NAMES = new RegExp('^' + NM + '(?:\\s*(?:,|&|\\band\\b|/|\\+)\\s*' + NM + ')*$', 'u');
    const NOT_OWNER = /^(tbd|tbc|n\/?a|all|both|everyone|team|we|owner|owners|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|pricing|legal|note|notes|decision|decisions|timeline|budget|update|updates|status|context|question|questions|risk|risks|deadline|goal|goals|agenda|topic|follow[- ]?up|next steps?|action items?)$/i;
    const WORDS = /^(setup|plan|plans|planning|review|reviews|sync|update|updates|pipeline|routing|salesforce|hubspot|leandata|outreach|marketing|sales|product|engineering|ops|operations|team|teams|project|projects|pricing|strategy|process|tools|data|next|steps|actions|action|items|owners|follow|ups|timeline|summary|decisions|open|general|other|misc|emea|amer|apac|smb|q1|q2|q3|q4|forecast|accounts|account|book|books|launch|training|hiring|budget|finance|legal|support|customer|customers|partner|partners|meeting|call|calls|notes|deck|report|reports|dashboard|board|week|month|quarter|today|tomorrow)$/i;
    const isName = (s) => {
      const v = String(s || '').trim();
      if (!NAMES.test(v) || NOT_OWNER.test(v) || /^\p{Lu}{2,}$/u.test(v)) return false;
      return !v.split(/[\s,&/+]+/).some((w) => WORDS.test(w.replace(/[.'’]/g, '')));
    };
    const clean = (s) => String(s || '').replace(/\\([\\`*_{}\[\]()#+\-.!~>|])/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1').replace(/\*\*|__/g, '').replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
      .replace(/\s+/g, ' ').trim();
    const split = (t) => {
      let item = t, owner = null, m;
      const b = t.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (b) {
        let title = b[1].trim(), rest = b[2].trim();
        const t0 = title.replace(/:$/, '');
        if (isName(t0) && (title.endsWith(':') || rest.startsWith(':')) && rest.replace(/^:\s*/, '')) { owner = t0; title = rest.replace(/^:\s*/, ''); rest = ''; }
        if (!owner && (m = rest.match(/^[([]([^)\]]+)[)\]]\s*(.*)$/)) && isName(m[1])) { owner = m[1]; rest = m[2]; }
        if (!owner && (m = rest.match(/^(.*?)\s*[([]([^)\]]+)[)\]][.;]?$/)) && isName(m[2])) { owner = m[2]; rest = m[1]; }
        if (!owner && (m = rest.match(/^[-–—]\s*(.+?)\.?$/)) && isName(m[1])) { owner = m[1]; rest = ''; }
        const sep = /^[:\-–—]/.test(rest);
        rest = rest.replace(/^[:\-–—]\s*/, '');
        item = title + (rest ? (sep ? ': ' : ' ') + rest : '');
      } else if ((m = t.match(/^(.+?)\s+[([]([^)\]]+)[)\]][.;]?\s*$/)) && isName(m[2])) { owner = m[2]; item = m[1]; }
      else if ((m = t.match(/^([^:]{2,40}?)\s*:\s+(.+)$/)) && isName(m[1])) { owner = m[1]; item = m[2]; }
      else if ((m = t.match(/^(\p{Lu}[\p{L}'’.-]+(?:\s\p{Lu}[\p{L}'’.-]+)?)\s+(?:to|will)\s+(\p{Ll}.+)$/u)) && isName(m[1])) { owner = m[1]; item = m[2].charAt(0).toUpperCase() + m[2].slice(1); }
      return { item, owner };
    };
    const norm = (s) => String(s || '').replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/ß/g, 'ss').replace(/[łŁ]/g, 'l').replace(/[đĐ]/g, 'd')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const r0 = gr_notes[0] || {};
    const local = String(r0.me || '').split('@')[0].split(/[._]+/).map(norm).filter(Boolean);
    const first = local[0] || '';
    const last = local.length > 1 ? local[local.length - 1] : '';
    const myName = norm(r0.myName || '');
    const myFirst = myName.split(' ')[0] || '';
    const isMe = (owner) => String(owner || '').split(/\s*(?:,|&|\band\b|\/|\+)\s*/i).map(norm).some((o) => !!o && (
      (!!first && (o === first || o === first + ' ' + last || (o.startsWith(first + ' ') && (!last || o.endsWith(' ' + last)))
        || (!!last && (o === last || o === first + ' ' + last[0] || o === first[0] + ' ' + last))))
      || (!!myName && (o === myName || o === myFirst))));
    const d0 = new Date();
    const today = Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate());
    // due date from the wording, relative to the meeting date ("by Friday", "this week", "next week", "by 30 Oct", "in two weeks", "EOM")
    const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const NUM = { one: 1, two: 2, three: 3, four: 4, a: 1 };
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    const dueFrom = (text, meetingDate) => {
      const base = Date.parse(String(meetingDate || '') + 'T00:00:00Z');
      if (Number.isNaN(base)) return null;
      const s = ' ' + String(text || '').toLowerCase() + ' ';
      const dow = new Date(base).getUTCDay();
      const friday = (weeks) => base + (((5 - dow + 7) % 7) + 7 * weeks) * 864e5;
      let m;
      if (/\b(today|eod|end of (the )?day)\b/.test(s)) return iso(base);
      if (/\btomorrow\b/.test(s)) return iso(base + 864e5);
      if (/\b(this week|eow|end of (the )?week)\b/.test(s)) return iso(friday(0));
      if (/\bnext week\b/.test(s)) return iso(friday(1));
      if ((m = s.match(/\bin (\d+|one|two|three|four|a) weeks?\b/))) return iso(base + 7 * (NUM[m[1]] || +m[1]) * 864e5);
      if ((m = s.match(/\bin (\d+|one|two|three|four|a) days?\b/))) return iso(base + (NUM[m[1]] || +m[1]) * 864e5);
      if (/\b(eom|end of (the )?month)\b/.test(s)) { const d = new Date(base); return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); }
      if ((m = s.match(/\b(?:by|on|before|until|due) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/))) { const t = DAYS.indexOf(m[1]); return iso(base + (((t - dow + 7) % 7) || 7) * 864e5); }
      const mkDate = (day, mon) => {
        const d = new Date(base);
        let t = Date.UTC(d.getUTCFullYear(), mon, day);
        if (t < base - 31 * 864e5) t = Date.UTC(d.getUTCFullYear() + 1, mon, day);
        return iso(t);
      };
      // whole month names or their usual short forms only, so 'Mark 3 accounts' or '2 decks' are not dates
      if ((m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)? (jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/))) return mkDate(+m[1], MONTHS.indexOf(m[2].slice(0, 3)));
      if ((m = s.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?) (\d{1,2})(?:st|nd|rd|th)?\b/))) return mkDate(+m[2], MONTHS.indexOf(m[1].slice(0, 3)));
      if ((m = s.match(/\b(?:by|on|before|due) (\d{1,2})\/(\d{1,2})\b/)) && +m[2] >= 1 && +m[2] <= 12) return mkDate(+m[1], +m[2] - 1);
      return null;
    };
    const out = [];
    const emit = (r, text, ownerDefault) => {
      let t = String(text || '').trim();
      let done = false;
      const box = t.match(/^\[([ xX]?)\]\s*(.*)$/);
      if (box) { done = /x/i.test(box[1]); t = box[2]; }
      t = t.replace(/^(todo|to do|action item|action|ai|follow[- ]?up|f\/u)\s*[:\-–]\s*/i, '');
      const sp = split(t);
      const item = clean(sp.item);
      const owner = sp.owner ? clean(sp.owner) : ownerDefault ? clean(ownerDefault) : null;
      if (!item || PLACEHOLDER.test(item) || /:$/.test(item)) return null;
      const self = /^(me|myself|i)$/i.test(owner || '') && r.capturedByMe !== false;
      const bucket = !owner ? 'unassigned' : (self || isMe(owner)) ? 'mine' : 'others';
      const date = String(r.meetingAt || '').slice(0, 10) || null;
      const o = {
        id: r.id, meetingId: r.meetingId, meeting: clean(r.meeting) || 'Untitled meeting', date, meetingAt: r.meetingAt, url: r.url,
        shared: r.capturedByMe === false, participants: r.participants ?? null, emails: r.emails || '', me: r.me || null, oneOnOne: r.participants === 2, source: r.source, section: r.section, pos: r.pos, item, detail: '', owner, bucket, done,
        forYou: !done && (bucket === 'mine' || (bucket === 'unassigned' && r.capturedByMe !== false)),
        ageDays: date ? Math.max(0, Math.round((today - Date.parse(date + 'T00:00:00Z')) / 864e5)) : null,
      };
      out.push(o);
      return o;
    };
    const withDue = (o) => {
      const due = dueFrom(o.item + ' ' + o.detail, o.date);
      const t = due ? Date.parse(due + 'T00:00:00Z') : NaN;
      const left = Number.isNaN(t) ? null : Math.round((t - today) / 864e5);
      return { ...o, due, daysLeft: left, dueStatus: left == null || o.done ? null : left < 0 ? 'Overdue' : left <= 3 ? 'Due soon' : null };
    };
    let key = null, cur = null, label = null;
    const groupOf = (r) => (r ? r.meetingId + '|' + r.source + '|' + r.section + '|' + r.parentSection : null);
    for (let i = 0; i < gr_notes.length; i++) {
      const r = gr_notes[i];
      const k = groupOf(r);
      const next = gr_notes[i + 1];
      const hasChildren = !!next && groupOf(next) === k && next.kind === 'bullet' && next.depth >= 1;
      if (k !== key) { key = k; cur = null; label = null; }
      const actionSec = isAction(r.section) || isAction(r.parentSection);
      const secOwner = !isAction(r.section) && isAction(r.parentSection) && isName(r.section) ? r.section : null;
      const text = String(r.text || '').trim();
      const isTodo = r.source === 'private' && TODO.test(text);
      if (r.kind === 'bullet' && r.depth === 0) {
        cur = null; label = null;
        const bare = clean(text).replace(/:$/, '');
        if (actionSec && hasChildren && isName(bare) && /^(\*\*[^*]+\*\*:?|[^:*]+:?)$/.test(text)) { label = bare; continue; }
        if (actionSec || isTodo) cur = emit(r, text, secOwner);
        continue;
      }
      if (r.kind === 'bullet') {
        if (label && actionSec) { emit(r, text, label); continue; }
        if (cur) {
          if (split(text).owner) emit(r, text, null);
          else cur.detail = cur.detail ? cur.detail + '; ' + clean(text) : clean(text);
          continue;
        }
        if (actionSec || isTodo) emit(r, text, secOwner);
        continue;
      }
      if (isTodo && r.depth === 0) { label = null; cur = emit(r, text, null); continue; }
      if (cur && (r.depth >= 1 || (!r.gap && r.source === 'summary'))) { cur.detail = cur.detail ? cur.detail + ' ' + clean(text) : clean(text); continue; }
      cur = null;
      if (actionSec && r.depth === 0 && r.source === 'summary') cur = emit(r, text, secOwner || label);
    }
    return out.map(withDue).sort((a, b) => String(b.meetingAt || '').localeCompare(String(a.meetingAt || '')) || String(a.meetingId).localeCompare(String(b.meetingId)) || (a.source === b.source ? 0 : a.source === 'summary' ? -1 : 1) || a.pos - b.pos);
  },
});

dash.calc('gr_kpi', {
  title: 'Action items headline',
  description: 'Open action items from your meetings: for you (yours, or unassigned in notes you took), assigned to you, unassigned, with others, the meetings they came from, and how many of yours are overdue or due soon.',
  inputs: ['gr_actions'],
  fn: (gr_actions) => {
    const open = gr_actions.filter((r) => !r.done);
    return [{
      forYou: open.filter((r) => r.forYou).length,
      mine: open.filter((r) => r.bucket === 'mine').length,
      unassigned: open.filter((r) => r.bucket === 'unassigned').length,
      others: open.filter((r) => r.bucket === 'others').length,
      meetings: new Set(open.map((r) => r.meetingId)).size,
      total: open.length,
      overdue: open.filter((r) => r.forYou && r.dueStatus === 'Overdue').length,
      dueSoon: open.filter((r) => r.forYou && r.dueStatus === 'Due soon').length,
    }];
  },
});

// ===================== DATA CHECKS =====================
dash.calc('checks_rr', {
  title: 'Data checks, routing',
  description: 'LeanData routing problems to act on: reps missing from the pool for their role or due to be added next week, inactive users still in a pool, and pools whose member got no assignment in 90 days. Kept apart from the other checks, so a viewer who can\'t read LeanData still sees the rest.',
  inputs: ['rr_people', 'rr_pools'],
  fn: (rr_people, rr_pools) => {
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    const out = [];
    for (const p of rr_people) {
      const since = p.daysIn != null && p.daysIn >= 0 && p.daysIn < 60 ? 'Started ' + plural(p.daysIn, 'day', 'days') + ' ago' : '';
      const hint = p.suggested ? 'peers are in ' + p.suggested : '';
      const meta = [since, hint].filter(Boolean).join(' · ');
      if (p.status === 'Missing' || p.status === 'New joiner: overdue') out.push({ id: 'rr:' + p.userId, area: 'Routing', severity: 'high', title: p.name, person: p.name, region: p.region, manager: p.manager, what: 'Not in any ' + p.kind + ' pool', meta, screen: 'routing' });
      else if (p.status === 'New: add next week') out.push({ id: 'rr:' + p.userId, area: 'Routing', severity: 'low', title: p.name, person: p.name, region: p.region, manager: p.manager, what: 'Add to a ' + p.kind + ' pool next week', meta, screen: 'routing' });
    }
    for (const pool of rr_pools) {
      if (pool.inactiveMembers) out.push({ id: 'pool:' + pool.pool, area: 'Routing', severity: 'high', title: pool.pool, person: null, region: 'All', manager: null, what: plural(pool.inactiveMembers, 'inactive user', 'inactive users') + ' still in the pool', meta: '', screen: 'routing' });
      if (pool.starved) out.push({ id: 'starved:' + pool.pool, area: 'Routing', severity: 'low', title: pool.pool, person: null, region: 'All', manager: null, what: 'No assignments in 90 days for ' + pool.starved, meta: plural(pool.assignments, 'assignment', 'assignments') + ' went to the others', screen: 'routing' });
    }
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.title).localeCompare(String(b.title)));
  },
});

dash.calc('checks', {
  title: 'Data checks',
  description: 'Problems to act on in Salesforce: reps with past-due opps, orphan accounts by reason, split books, reps whose Salesforce manager is no longer active, and people who left who still own open deals or renewals. Routing, HiBob, leavers\' leads and lead checks are their own calcs (checks_rr, checks_hb, checks_lv, checks_ld), merged on screen.',
  inputs: ['pipe_reps', 'orphans', 'books', 'roster', 'lv_opps'],
  fn: (pipe_reps, orphans, books, roster, lv_opps) => {
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    const money = (v) => { const a = Math.abs(+v || 0); const s = a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? Math.round(a / 1e3) + 'K' : String(Math.round(a)); return (v < 0 ? '−$' : '$') + s; };
    const out = [];
    for (const r of pipe_reps) {
      if (r.pastDue > 0) out.push({ id: 'pd:' + r.owner, area: 'Pipeline', severity: r.pastDue >= 3 ? 'high' : 'medium', title: r.owner, person: r.owner, region: r.region, manager: r.manager, what: plural(r.pastDue, 'open opp', 'open opps') + ' past the close date', meta: '', screen: 'pipeline' });
    }
    const byReason = new Map();
    for (const o of orphans) {
      if (/review/.test(o.reason)) continue;
      const b = byReason.get(o.reason) || { n: 0, arr: 0 };
      b.n += 1; b.arr += +o.arrUsd || 0;
      byReason.set(o.reason, b);
    }
    for (const [reason, b] of byReason) out.push({ id: 'orph:' + reason, area: 'Books', severity: reason === 'Inactive owner' || b.arr > 0 ? 'high' : 'medium', title: reason, person: null, region: 'All', manager: null, what: plural(b.n, 'active account', 'active accounts') + ' with ' + money(b.arr) + ' ARR', meta: '', screen: 'books', reason });
    const split = books.filter((b) => b.flag === 'Split').length;
    if (split) out.push({ id: 'books:split', area: 'Books', severity: 'low', title: 'Split books', person: null, region: 'All', manager: null, what: plural(split, 'book', 'books') + ' where the main owner holds under 80%', meta: '', screen: 'books' });
    // reps whose Salesforce manager has left: reports, approvals and team views roll up to nobody
    const TEAM2 = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const gone = new Set(roster.filter((u) => u.isActive === false).map((u) => u.name));
    const activeNames = new Set(roster.filter((u) => u.isActive !== false).map((u) => u.name));
    for (const u of roster) {
      if (u.isActive === false || !u.manager || !gone.has(u.manager) || activeNames.has(u.manager)) continue;
      out.push({ id: 'mgr:' + u.userId, area: 'Hiring', severity: 'medium', title: u.name, person: u.name, region: TEAM2[u.role] || 'Other', manager: u.manager, what: 'Reports to an inactive manager in Salesforce', meta: u.manager + ' is no longer active', screen: null });
    }
    // people who left but still own open deals or renewals: nobody is working them
    const day = (x) => { const d = new Date(String(x) + 'T00:00:00Z'); return Number.isNaN(+d) ? String(x) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
    const lv = new Map();
    for (const r of lv_opps) {
      const k = String(r.ownerId || r.owner);
      if (!lv.has(k)) lv.set(k, { ownerId: r.ownerId, owner: r.owner, role: r.role, manager: r.manager, deals: 0, dealArr: 0, renewals: 0, renewalArr: 0, next: null });
      const o = lv.get(k);
      if (r.rt === 'Renewal') { o.renewals += +r.opps || 0; o.renewalArr += +r.contractArrUsd || 0; }
      else { o.deals += +r.opps || 0; o.dealArr += +r.arrUsd || 0; }
      if (r.nextClose && (!o.next || r.nextClose < o.next)) o.next = r.nextClose;
    }
    for (const o of lv.values()) {
      const held = [o.deals ? plural(o.deals, 'open deal', 'open deals') + ' (' + money(o.dealArr) + ' ARR)' : '', o.renewals ? plural(o.renewals, 'open renewal', 'open renewals') + ' (' + money(o.renewalArr) + ' contract ARR)' : ''].filter(Boolean).join(' and ');
      out.push({ id: 'lv:' + o.ownerId, area: 'Leavers', severity: 'high', title: o.owner, person: o.owner, region: TEAM2[o.role] || 'Other', manager: o.manager || '(no manager)', what: 'Left, still owns ' + held, meta: o.next ? 'next closes ' + day(o.next) : '', screen: 'hiring', view: 'leavers' });
    }
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.area).localeCompare(String(b.area)) || String(a.title).localeCompare(String(b.title)));
  },
});

dash.calc('checks_lv', {
  title: 'Data checks, leads of people who left',
  description: 'People with an EMEA role who are no longer active in Salesforce but still own open leads (neither converted nor disqualified), so nobody is working them. Urgent at 10 or more Ready or New leads.',
  inputs: ['lv_leads', 'roster'],
  fn: (lv_leads, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const id15 = (x) => String(x || '').slice(0, 15);
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    const users = new Map(roster.map((u) => [id15(u.userId), u]));
    const m = new Map();
    for (const r of lv_leads) {
      const k = id15(r.ownerId);
      if (!m.has(k)) m.set(k, { ownerId: r.ownerId, n: 0, ready: 0, fresh: 0 });
      const o = m.get(k), n = +r.leads || 0;
      o.n += n;
      if (r.status === 'Ready') o.ready += n;
      else if (r.status === 'New') o.fresh += n;
    }
    return [...m.entries()].map(([k, o]) => {
      const u = users.get(k) || {};
      return { id: 'lvl:' + k, area: 'Leavers', severity: o.ready + o.fresh >= 10 ? 'high' : 'medium', title: u.name || 'Inactive user', person: u.name || null, region: TEAM[u.role] || 'Other', manager: u.manager || '(no manager)', what: 'Left, still owns ' + plural(o.n, 'open lead', 'open leads'), meta: [o.ready ? o.ready + ' Ready' : '', o.fresh ? o.fresh + ' New' : ''].filter(Boolean).join(', '), screen: 'hiring', view: 'leavers' };
    });
  },
});

dash.calc('leavers_core', {
  title: 'People who left: deals, renewals and accounts',
  description: 'Every Salesforce user with an EMEA role who is no longer active, with what they still hold that needs only Opportunity and Account access: open New Business and Upsell deals and their ARR, open renewals and their contract ARR, the next close date, active accounts (customer, pipeline, engaging), customers and their ARR, and customers where they are Engagement Manager. Leads (leavers_leads) and LeanData pool seats (leavers_pools) are their own layers, merged on screen.',
  inputs: ['roster', 'lv_opps', 'books_owner'],
  fn: (roster, lv_opps, books_owner) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const id15 = (x) => String(x || '').slice(0, 15);
    const m = new Map();
    for (const u of roster) {
      if (u.isActive !== false) continue;
      m.set(id15(u.userId), { key: id15(u.userId), userId: u.userId, name: u.name, role: u.role || null, region: TEAM[u.role] || 'Other', manager: u.manager || '(no manager)', deals: 0, dealArr: 0, renewals: 0, renewalArr: 0, nextClose: null, accounts: 0, customers: 0, customerArr: 0, emCustomers: 0 });
    }
    const byName = new Map([...m.values()].map((o) => [o.name, o]));
    for (const r of lv_opps) {
      const o = m.get(id15(r.ownerId));
      if (!o) continue;
      if (r.rt === 'Renewal') { o.renewals += +r.opps || 0; o.renewalArr += +r.contractArrUsd || 0; }
      else { o.deals += +r.opps || 0; o.dealArr += +r.arrUsd || 0; }
      if (r.nextClose && (!o.nextClose || r.nextClose < o.nextClose)) o.nextClose = r.nextClose;
    }
    for (const b of books_owner) {
      const o = byName.get(b.owner);
      if (!o || b.ownerActive !== false) continue;
      o.accounts += +b.active || 0; o.customers += +b.customers || 0; o.customerArr += +b.arr || 0; o.emCustomers += +b.emCustomers || 0;
    }
    return [...m.values()];
  },
});

dash.calc('leavers_leads', {
  title: 'People who left, with their open leads',
  description: 'leavers_core plus each person\'s open leads (neither converted nor disqualified), Ready and New among them. Its own calc, so the leavers list keeps its deals, renewals and accounts when leads can\'t be read.',
  inputs: ['leavers_core', 'lv_leads'],
  fn: (leavers_core, lv_leads) => {
    const id15 = (x) => String(x || '').slice(0, 15);
    const m = new Map(leavers_core.map((o) => [o.key, { ...o, leads: 0, ready: 0, fresh: 0 }]));
    for (const r of lv_leads) {
      const o = m.get(id15(r.ownerId));
      if (!o) continue;
      const n = +r.leads || 0;
      o.leads += n;
      if (r.status === 'Ready') o.ready += n;
      else if (r.status === 'New') o.fresh += n;
    }
    return [...m.values()];
  },
});

dash.calc('leavers_pools', {
  title: 'People who left, still in LeanData pools',
  description: 'Inactive users still in an EMEA LeanData round-robin pool, with how many pools and which. Its own calc, so the leavers list keeps the rest when LeanData can\'t be read.',
  inputs: ['rr_members'],
  fn: (rr_members) => {
    const id15 = (x) => String(x || '').slice(0, 15);
    const pools = new Map();
    for (const r of rr_members) {
      if (r.userActive !== false) continue;
      const k = id15(r.userId);
      if (!pools.has(k)) pools.set(k, new Set());
      pools.get(k).add(r.poolName);
    }
    return [...pools.entries()].map(([key, set]) => ({ key, pools: set.size, poolNames: [...set].sort().join(', ') }));
  },
});

dash.calc('checks_hb', {
  title: 'Data checks, HiBob',
  description: 'HiBob against Salesforce: people who joined in the last 90 days (past their first week) with no Salesforce user; people with a selling title whose Salesforce user has no role or a role outside EMEA sales, so their pipeline, book and routing are not counted here; and people whose manager in HiBob differs from their manager in Salesforce.',
  inputs: ['people_core'],
  fn: (people) => {
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    const out = [];
    for (const h of people) {
      const base = { area: 'Hiring', title: h.name, person: h.sfName || h.name, region: h.region, manager: h.sfManager || null, screen: 'hiring' };
      if (h.status === 'No Salesforce user' && h.daysIn != null && h.daysIn >= 0 && h.daysIn <= 90) {
        out.push({ ...base, id: 'hb:' + h.id, severity: 'medium', what: 'No Salesforce user found', meta: 'Started ' + plural(h.daysIn, 'day', 'days') + ' ago' });
      }
      if (h.status === 'No Salesforce role' || h.status === 'Role outside EMEA sales') {
        out.push({ ...base, screen: h.daysIn != null && h.daysIn < 90 ? 'hiring' : null, id: 'hb:' + h.id + ':role', severity: 'medium', what: h.status === 'No Salesforce role' ? 'Salesforce user has no role' : 'Salesforce role ' + h.sfRole + ' is outside EMEA sales', meta: (h.title || 'Selling title') + ' in HiBob, so their pipeline, book and routing are not counted here' });
      }
      if (h.mgrDiffers && h.status !== 'Not started') {
        out.push({ ...base, screen: h.daysIn != null && h.daysIn < 90 ? 'hiring' : null, id: 'hb:' + h.id + ':mgr', severity: 'low', what: h.sfManager ? 'Manager differs between HiBob and Salesforce' : 'No manager in Salesforce', meta: 'HiBob: ' + (h.manager || 'none') + ' · Salesforce: ' + (h.sfManager || 'none') });
      }
    }
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.title).localeCompare(String(b.title)));
  },
});

dash.calc('checks_hb_kpi', {
  title: 'HiBob checks headline',
  description: 'Number of HiBob data checks (recent joiners with no Salesforce user, selling titles without an EMEA sales role, manager differences), per team and for all EMEA.',
  inputs: ['checks_hb'],
  fn: (checks_hb) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(checks_hb.map((c) => c.manager).filter(Boolean))];
    return regions.concat(managers.map((m) => 'M|' + m)).map((region) => ({ region, total: checks_hb.filter((c) => (region.startsWith('M|') ? c.manager === region.slice(2) : region === 'All' || c.region === region)).length }));
  },
});

// ===================== THIS WEEK =====================
dash.calc('pool_adds', {
  title: 'Added to routing pools this week',
  description: 'People added to an EMEA LeanData pool in the last 7 days (by when their pool membership was created), with the pools.',
  inputs: ['rr_members'],
  fn: (rr_members) => {
    const cut = Date.now() - 7 * 864e5;
    const m = new Map();
    for (const r of rr_members) {
      const at = Date.parse(String(r.addedOn || '').replace(/\+0000$/, 'Z'));
      if (Number.isNaN(at) || at < cut) continue;
      if (!m.has(r.userName)) m.set(r.userName, { name: r.userName, pools: new Set(), last: at });
      const o = m.get(r.userName);
      o.pools.add(r.poolName);
      o.last = Math.max(o.last, at);
    }
    return [...m.values()].map((o) => ({ name: o.name, pools: o.pools.size, poolNames: [...o.pools].sort().join(', '), addedOn: new Date(o.last).toISOString().slice(0, 10) }))
      .sort((a, b) => b.addedOn.localeCompare(a.addedOn) || a.name.localeCompare(b.name));
  },
});

// ===================== DEALS =====================
dash.calc('deal_list', {
  title: 'Largest deals with risk flags',
  description: 'The largest open deals closing this or next quarter with risk flags: past due (close date gone), stale (no logged activity in 30 days), no next step (neither a next-step note nor a date), next step overdue (its date has passed), stuck in stage (longer than about twice the usual time: stage 0 35 days, 1 55, 2 60, 3 40, 4 30, 5 45, 6 40), early stage (0–1) closing this quarter, and Commit while still at stage 0–2. The risk score adds 3 for past due or early Commit, 2 for early stage or stale, 1 for a missing or overdue next step. Risk score: 3 each for past due or Commit at an early stage, 2 each for stale, early stage closing this quarter or stuck in stage, 1 for no next step or an overdue one.',
  inputs: ['top_deals'],
  fn: (top_deals) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const ago30 = new Date(now.getTime() - 30 * 864e5).toISOString().slice(0, 10);
    const qStart = (d) => { const y = d.getUTCFullYear(), q = Math.floor(d.getUTCMonth() / 3); return new Date(Date.UTC(y, q * 3, 1)); };
    const nextQStart = new Date(Date.UTC(qStart(now).getUTCFullYear(), qStart(now).getUTCMonth() + 3, 1)).toISOString().slice(0, 10);
    return top_deals.map((d) => {
      const stage = parseInt(d.stage, 10);
      const thisQ = String(d.closeDate) < nextQStart;
      const flags = [];
      if (String(d.closeDate) < today) flags.push('Past due');
      if (d.forecast === 'Commit' && stage <= 2) flags.push('Commit at early stage');
      if (thisQ && stage <= 1) flags.push('Early stage');
      if (!d.lastActivity || String(d.lastActivity) < ago30) flags.push('Stale 30d+');
      const nsDate = d.nextStepDate ? String(d.nextStepDate).slice(0, 10) : null;
      if (!d.nextStep && !nsDate) flags.push('No next step');
      else if (nsDate && nsDate < today) flags.push('Next step overdue');
      const LIMIT = [35, 55, 60, 40, 30, 45, 40];
      if (d.daysInStage != null && stage >= 0 && stage <= 6 && +d.daysInStage > LIMIT[stage]) flags.push('Stuck in stage');
      const score = flags.reduce((s, f) => s + (f === 'Past due' || f === 'Commit at early stage' ? 3 : f === 'No next step' || f === 'Next step overdue' ? 1 : 2), 0);
      return { oppId: d.oppId, opp: d.opp, account: d.account, owner: d.owner, role: d.role, region: TEAM[d.role] || 'Other', manager: d.manager || '(no manager)', stage: d.stage, rt: d.rt, closeDate: d.closeDate, quarter: thisQ ? 'this' : 'next', forecast: d.forecast || null, nextStep: d.nextStep || null, lastActivity: d.lastActivity || null, arrUsd: +d.arrUsd || 0, daysInStage: d.daysInStage != null ? +d.daysInStage : null, ageDays: d.ageDays != null ? +d.ageDays : null, flags: flags.join(', '), risk: score };
    });
  },
});

dash.calc('person_deals', {
  title: 'Open deals of one person',
  description: 'Open opportunities of the person in the panel with the same risk flags as the largest deals (renewals use the renewing contract ARR).',
  inputs: ['deals'],
  fn: (deals) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const ago30 = new Date(now.getTime() - 30 * 864e5).toISOString().slice(0, 10);
    const q0 = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
    const nextQStart = new Date(Date.UTC(q0.getUTCFullYear(), q0.getUTCMonth() + 3, 1)).toISOString().slice(0, 10);
    const laterQStart = new Date(Date.UTC(q0.getUTCFullYear(), q0.getUTCMonth() + 6, 1)).toISOString().slice(0, 10);
    return deals.map((d) => {
      const stage = parseInt(d.stage, 10);
      const thisQ = String(d.closeDate) < nextQStart;
      const flags = [];
      if (String(d.closeDate) < today) flags.push('Past due');
      if (d.rt !== 'Renewal' && d.forecast === 'Commit' && stage <= 2) flags.push('Commit at early stage');
      if (d.rt !== 'Renewal' && thisQ && stage <= 1) flags.push('Early stage');
      if (!d.lastActivity || String(d.lastActivity) < ago30) flags.push('Stale 30d+');
      const nsDate = d.nextStepDate ? String(d.nextStepDate).slice(0, 10) : null;
      if (d.rt !== 'Renewal' && !d.nextStep && !nsDate) flags.push('No next step');
      else if (d.rt !== 'Renewal' && nsDate && nsDate < today) flags.push('Next step overdue');
      const LIMIT = [35, 55, 60, 40, 30, 45, 40];
      if (d.rt !== 'Renewal' && String(d.closeDate) < laterQStart && d.daysInStage != null && stage >= 0 && stage <= 6 && +d.daysInStage > LIMIT[stage]) flags.push('Stuck in stage');
      return { oppId: d.oppId, opp: d.opp, account: d.account, stage: d.stage, rt: d.rt, closeDate: d.closeDate, quarter: thisQ ? 'this' : 'later', forecast: d.forecast || null, nextStep: d.nextStep || null, lastActivity: d.lastActivity || null, arrUsd: d.rt === 'Renewal' ? +d.contractArrUsd || 0 : +d.arrUsd || 0, flags: flags.join(', ') };
    });
  },
});

// ===================== FORECAST =====================
dash.calc('forecast', {
  title: 'Forecast roll-up, this quarter',
  description: 'Per team, per team and manager, per manager and for all EMEA, this quarter: closed won, rep commit and best case on open deals, open pipeline, and the two calls: won + commit, and won + best case (best case already includes commit, so it is not added on top). The upside is best case above commit. New Business and Upsell, incremental ARR.',
  inputs: ['pipe_team'],
  fn: (pipe_team) => pipe_team.map((r) => ({
    key: r.key, region: r.region, manager: r.manager, level: r.level,
    won: r.won, commit: r.thisCommit, bestCase: r.thisBest, upside: Math.max(0, r.thisBest - r.thisCommit), pipeline: r.thisPipe,
    wonCommit: r.won + r.thisCommit, wonBest: r.won + Math.max(r.thisBest, r.thisCommit),
    commitShare: r.thisPipe > 0 ? r.thisCommit / r.thisPipe : null,
  })),
});

dash.calc('renewal_list', {
  title: 'Largest renewals with risk flags',
  description: 'The largest open renewals closing this or next quarter, with the risk rating reps write in Next step ("Renewal Risk Rating: LOW/MEDIUM/HIGH"), and flags: past due, stale (no activity in 30 days), downsell (net change below zero) and still at stage 0.',
  inputs: ['top_renewals'],
  fn: (top_renewals) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const ago30 = new Date(now.getTime() - 30 * 864e5).toISOString().slice(0, 10);
    const q0 = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
    const nextQStart = new Date(Date.UTC(q0.getUTCFullYear(), q0.getUTCMonth() + 3, 1)).toISOString().slice(0, 10);
    return top_renewals.map((d) => {
      const m = String(d.nextStep || '').match(/risk\s*rating\s*[:\-]?\s*(low|medium|med|high)/i);
      const rating = m ? (/^h/i.test(m[1]) ? 'High' : /^m/i.test(m[1]) ? 'Medium' : 'Low') : null;
      const flags = [];
      if (String(d.closeDate) < today) flags.push('Past due');
      if (rating === 'High') flags.push('High risk rating');
      if ((+d.netChangeArrUsd || 0) < 0) flags.push('Downsell');
      if (!d.lastActivity || String(d.lastActivity) < ago30) flags.push('Stale 30d+');
      if (String(d.stage).startsWith('0')) flags.push('Stage 0');
      const days = Math.round((Date.parse(String(d.closeDate) + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5);
      return { oppId: d.oppId, opp: d.opp, owner: d.owner, role: d.role, region: TEAM[d.role] || 'Other', manager: d.manager || '(no manager)', stage: d.stage, closeDate: d.closeDate, daysToClose: days, quarter: String(d.closeDate) < nextQStart ? 'this' : 'next', forecast: d.forecast || null, rating, nextStep: d.nextStep || null, lastActivity: d.lastActivity || null, renewingArrUsd: +d.renewingArrUsd || 0, existingArrUsd: +d.existingArrUsd || 0, netChangeArrUsd: +d.netChangeArrUsd || 0, flags: flags.join(', ') };
    });
  },
});

// ===================== REP RISK =====================
dash.calc('rep_risk', {
  title: 'Deal risk per rep',
  description: 'Per rep, for open New Business and Upsell: pipeline this quarter, deals pushed out of this quarter or pulled in (latest close-date change in the last 30 days), close-date edits in 30 days, early-stage deals (stage 0–1) closing this quarter, deals closing this quarter with no contact role, past-due and stale deals, and deals closing this or next quarter with an overdue next-step date or no next step at all (neither a note nor a date). Stuck deals have sat in their stage longer than about twice the usual time. Risk score = 3 per past-due deal + 2 per deal pushed out + 1 per early-stage, no-contact or stuck deal + 0.5 per stale deal.',
  inputs: ['pipe_reps', 'pipe_slips', 'pipe_edits', 'pipe_early', 'pipe_nocontact', 'pipe_nextstep', 'age_stuck'],
  fn: (pipe_reps, pipe_slips, pipe_edits, pipe_early, pipe_nocontact, pipe_nextstep, age_stuck) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const thisQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const m = new Map();
    const get = (owner, role, manager) => {
      if (!m.has(owner)) m.set(owner, { owner, role: role || null, region: TEAM[role] || 'Other', manager: manager || '(no manager)', thisPipe: 0, pushedOut: 0, pushedOutArr: 0, pulledIn: 0, edits: 0, repeatEdits: 0, early: 0, earlyArr: 0, noContact: 0, noContactArr: 0, pastDue: 0, stale: 0, nextOverdue: 0, nextNone: 0, stuck: 0, stuckArr: 0 });
      const o = m.get(owner);
      if (!o.role && role) { o.role = role; o.region = TEAM[role] || 'Other'; }
      if (o.manager === '(no manager)' && manager) o.manager = manager;
      return o;
    };
    for (const r of pipe_reps) Object.assign(get(r.owner, r.role, r.manager), { thisPipe: r.thisPipe, pastDue: r.pastDue, stale: r.stale });
    for (const r of pipe_slips) {
      const o = get(r.owner, r.role, r.manager);
      const from = r.fromFy * 10 + r.fromFq, to = r.toFy * 10 + r.toFq;
      if (from === thisQ && to > thisQ) { o.pushedOut += +r.opps || 0; o.pushedOutArr += +r.arrUsd || 0; }
      else if (to < from) o.pulledIn += +r.opps || 0;
    }
    for (const r of pipe_early) { const o = get(r.owner, r.role, r.manager); o.early += +r.opps || 0; o.earlyArr += +r.arrUsd || 0; }
    for (const r of pipe_nocontact) { const o = get(r.owner, r.role, r.manager); o.noContact += +r.noContactOpps || 0; o.noContactArr += +r.noContactArrUsd || 0; }
    for (const r of pipe_nextstep) { const o = get(r.owner, r.role, r.manager); o.nextOverdue += +r.overdueOpps || 0; o.nextNone += Math.max(0, (+r.flaggedOpps || 0) - (+r.overdueOpps || 0)); }
    for (const r of age_stuck) { const o = get(r.owner, r.role, r.manager); o.stuck += +r.stuckOpps || 0; o.stuckArr += +r.stuckArrUsd || 0; }
    for (const r of pipe_edits) if (m.has(r.owner)) { const o = m.get(r.owner); o.edits = +r.closeDateEdits || 0; o.repeatEdits = Math.max(0, (+r.closeDateEdits || 0) - (+r.oppsEdited || 0)); }
    return [...m.values()].map((o) => {
      const score = Math.round(o.pastDue * 3 + o.pushedOut * 2 + o.early + o.noContact + o.stuck + o.stale * 0.5);
      return { ...o, earlyShare: o.thisPipe > 0 ? o.earlyArr / o.thisPipe : null, score };
    }).filter((o) => o.score > 0 || o.thisPipe > 0);
  },
});

dash.calc('risk_kpi', {
  title: 'Deal risk headline',
  description: 'Per team, per manager and for all EMEA: deals and ARR pushed out of this quarter in the last 30 days, early-stage ARR closing this quarter, deals with no contact role, and past-due deals.',
  inputs: ['rep_risk'],
  fn: (rep_risk) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(rep_risk.map((r) => r.manager).filter((x) => x && x !== '(no manager)'))];
    const sum = (rs, f) => rs.reduce((s, r) => s + (+r[f] || 0), 0);
    return regions.concat(managers.map((x) => 'M|' + x)).map((region) => {
      const rs = rep_risk.filter((r) => (region.startsWith('M|') ? r.manager === region.slice(2) : region === 'All' || r.region === region));
      const pipe = sum(rs, 'thisPipe');
      return { region, pushedOut: sum(rs, 'pushedOut'), pushedOutArr: sum(rs, 'pushedOutArr'), early: sum(rs, 'early'), earlyArr: sum(rs, 'earlyArr'), earlyShare: pipe > 0 ? sum(rs, 'earlyArr') / pipe : null, noContact: sum(rs, 'noContact'), noContactArr: sum(rs, 'noContactArr'), pastDue: sum(rs, 'pastDue'), stuck: sum(rs, 'stuck'), stuckArr: sum(rs, 'stuckArr') };
    });
  },
});

// ===================== PACE =====================
dash.calc('cr_pace', {
  title: 'Created pace vs last quarter',
  description: 'Opportunities created so far this quarter against the same number of days into last quarter (and last quarter in full), by count and ARR.',
  inputs: ['cr_daily'],
  fn: (cr_daily) => {
    const now = new Date();
    const y = now.getUTCFullYear(), q = Math.floor(now.getUTCMonth() / 3);
    const thisStart = Date.UTC(y, q * 3, 1), lastStart = Date.UTC(q === 0 ? y - 1 : y, q === 0 ? 9 : (q - 1) * 3, 1);
    const dayN = Math.floor((Date.UTC(y, now.getUTCMonth(), now.getUTCDate()) - thisStart) / 864e5);
    const o = { thisOpps: 0, thisArr: 0, lastSameOpps: 0, lastSameArr: 0, lastFullOpps: 0, lastFullArr: 0, dayOfQuarter: dayN + 1 };
    for (const r of cr_daily) {
      const t = Date.parse(String(r.day).slice(0, 10) + 'T00:00:00Z');
      if (Number.isNaN(t)) continue;
      if (t >= thisStart) { o.thisOpps += +r.opps || 0; o.thisArr += +r.arrUsd || 0; }
      else if (t >= lastStart) {
        o.lastFullOpps += +r.opps || 0; o.lastFullArr += +r.arrUsd || 0;
        if (Math.floor((t - lastStart) / 864e5) <= dayN) { o.lastSameOpps += +r.opps || 0; o.lastSameArr += +r.arrUsd || 0; }
      }
    }
    return [{ ...o, deltaOpps: o.lastSameOpps ? o.thisOpps / o.lastSameOpps - 1 : null, deltaArr: o.lastSameArr ? o.thisArr / o.lastSameArr - 1 : null }];
  },
});

// ===================== BOOKINGS =====================
dash.calc('bookings', {
  title: 'Bookings and win rate per rep',
  description: 'Per rep, New Business and Upsell closed this quarter and last (by the date actually closed): won count and ARR, lost count, win rate by count, and average won deal. Losses marked "Merged with Global Pilot" or "Record cleanup" are admin merges and are left out of win rates.',
  inputs: ['closed_rep'],
  fn: (closed_rep) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const ADMIN = /^(merged with global pilot|record cleanup)$/i;
    const now = new Date();
    const thisQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const m = new Map();
    for (const r of closed_rep) {
      if (!m.has(r.owner)) m.set(r.owner, { owner: r.owner, role: r.role, region: TEAM[r.role] || 'Other', manager: r.manager || '(no manager)', wonThis: 0, wonThisArr: 0, wonNbArr: 0, wonUpArr: 0, lostThis: 0, wonLast: 0, wonLastArr: 0, lostLast: 0 });
      const o = m.get(r.owner);
      const p = r.fy * 10 + r.fq === thisQ ? 'This' : 'Last';
      if (r.won) {
        o['won' + p] += +r.opps || 0; o['won' + p + 'Arr'] += +r.arrUsd || 0;
        if (p === 'This') { if (r.rt === 'Upsell') o.wonUpArr += +r.arrUsd || 0; else o.wonNbArr += +r.arrUsd || 0; }
      } else if (!ADMIN.test(String(r.lostReason || ''))) o['lost' + p] += +r.opps || 0;
    }
    return [...m.values()].map((o) => ({
      ...o,
      winRateThis: o.wonThis + o.lostThis ? o.wonThis / (o.wonThis + o.lostThis) : null,
      winRateLast: o.wonLast + o.lostLast ? o.wonLast / (o.wonLast + o.lostLast) : null,
      avgDealThis: o.wonThis ? o.wonThisArr / o.wonThis : null,
    }));
  },
});

dash.calc('bookings_kpi', {
  title: 'Bookings headline',
  description: 'Per team, per manager and for all EMEA: won ARR and deals this quarter and last, win rate by count (admin merges left out), and average won deal this quarter.',
  inputs: ['bookings'],
  fn: (bookings) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(bookings.map((r) => r.manager).filter((x) => x && x !== '(no manager)'))];
    const sum = (rs, f) => rs.reduce((s, r) => s + (+r[f] || 0), 0);
    return regions.concat(managers.map((x) => 'M|' + x)).map((region) => {
      const rs = bookings.filter((r) => (region.startsWith('M|') ? r.manager === region.slice(2) : region === 'All' || r.region === region));
      const wT = sum(rs, 'wonThis'), lT = sum(rs, 'lostThis'), wL = sum(rs, 'wonLast'), lL = sum(rs, 'lostLast');
      const arrT = sum(rs, 'wonThisArr'), arrL = sum(rs, 'wonLastArr');
      return { region, wonThis: wT, wonThisArr: arrT, wonLast: wL, wonLastArr: arrL, lostThis: lT, winRateThis: wT + lT ? wT / (wT + lT) : null, winRateLast: wL + lL ? wL / (wL + lL) : null, avgDealThis: wT ? arrT / wT : null };
    });
  },
});

dash.calc('lost_reasons', {
  title: 'Lost reasons',
  description: 'Lost New Business and Upsell deals by lost reason, this quarter and last, per team, per manager and for all EMEA. Admin merges ("Merged with Global Pilot", "Record cleanup") are shown but marked.',
  inputs: ['closed_rep'],
  fn: (closed_rep) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const ADMIN = /^(merged with global pilot|record cleanup)$/i;
    const now = new Date();
    const thisQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const out = new Map();
    for (const r of closed_rep) {
      if (r.won) continue;
      const reason = r.lostReason || 'No reason given';
      const region = TEAM[r.role] || 'Other';
      for (const scope of ['All', region].concat(r.manager ? ['M|' + r.manager] : [])) {
        const key = scope + '|' + reason;
        if (!out.has(key)) out.set(key, { key, scope, reason, admin: ADMIN.test(reason), thisOpps: 0, lastOpps: 0, thisArr: 0 });
        const o = out.get(key);
        if (r.fy * 10 + r.fq === thisQ) { o.thisOpps += +r.opps || 0; o.thisArr += +r.arrUsd || 0; } else o.lastOpps += +r.opps || 0;
      }
    }
    return [...out.values()];
  },
});

// ===================== RAMP =====================
dash.calc('ramp', {
  title: 'New joiner ramp',
  description: 'People who started in the last 180 days (HiBob start date, matched to Salesforce): opportunities they created from their start month (owner scope, Flow renewals excluded), the date of their first one, open pipeline this quarter, and for BDRs the opps they sourced this quarter and last. Not ramping: 45+ days in a selling role with no opportunity yet.',
  inputs: ['people_core', 'cr_owner_m', 'pipe_reps', 'cr_bdrs'],
  fn: (people, cr_owner_m, pipe_reps, cr_bdrs) => {
    const sell = (role) => /^(AE-EMEA-|SMB-EMEA|EM-EMEA)/.test(role || '');
    const pipe = new Map(pipe_reps.map((r) => [r.owner, r.thisPipe]));
    const bdr = new Map(cr_bdrs.map((r) => [r.bdr, (+r.thisOpps || 0) + (+r.lastOpps || 0)]));
    return people.filter((p) => p.daysIn != null && p.daysIn >= 0 && p.daysIn <= 180).map((p) => {
      const name = p.sfName || null;
      const startM = String(p.startDate || '').slice(0, 7);
      let opps = 0, arr = 0, first = null;
      for (const r of name ? cr_owner_m : []) {
        if (r.owner !== name) continue;
        const ym = r.yr + '-' + String(r.mo).padStart(2, '0');
        if (ym < startM) continue;
        opps += +r.opps || 0; arr += +r.arrUsd || 0;
        const f = String(r.firstCreated || '').slice(0, 10);
        if (f && f >= String(p.startDate).slice(0, 10) && (!first || f < first)) first = f;
      }
      const daysToFirst = first ? Math.round((Date.parse(first + 'T00:00:00Z') - Date.parse(String(p.startDate).slice(0, 10) + 'T00:00:00Z')) / 864e5) : null;
      const isBdr = /^BDR-/.test(p.sfRole || '');
      const sourced = isBdr ? bdr.get(name) || 0 : null;
      const status = !name ? 'No Salesforce user' : isBdr ? (sourced ? 'Sourcing' : p.daysIn >= 45 ? 'Not ramping' : 'Too early') : !sell(p.sfRole) ? 'Not a selling role' : opps ? 'Ramping' : p.daysIn >= 45 ? 'Not ramping' : 'Too early';
      return { id: p.id, name: p.name, sfName: name, sfRole: p.sfRole, region: p.region, manager: p.sfManager || p.manager, startDate: p.startDate, daysIn: p.daysIn, opps, arr, perMonth: p.daysIn >= 14 ? opps / Math.max(1, p.daysIn / 30) : null, firstOpp: first, daysToFirst, pipeThisQ: name ? pipe.get(name) || 0 : 0, sourced, status };
    });
  },
});

// ===================== 1:1s AND TEAMS =====================
dash.calc('team_tree', {
  title: 'Teams and leaders',
  description: 'Every active Salesforce user with an EMEA sales role or EMEA people below them, with their direct reports and whole team (everyone below them in the Salesforce manager chain) and the team\'s EMEA numbers added up, their own included: pipeline this and next quarter, past-due and stale opps, opps created this quarter, won this quarter and win rate, reps with a risk score of 5 or more, and other data checks about people in the team (routing and past-due checks are their own columns). Won and win rate come from Bookings (by the date actually closed). People missing from routing are added per team by team_rr, so the scorecard still works when LeanData can\'t be read. People who left stay in the chain, so their reps still roll up, and the deals they still own count for their team; they are not counted as people, but keep a row (with no email) while they still hold pipeline, deals or checks, so the team adds up. The top EMEA leader is the deepest leader whose team still holds at least 90% of EMEA people.',
  inputs: ['users_all', 'roster', 'person', 'bookings', 'rep_risk', 'checks'],
  fn: (users_all, roster, person, bookings, rep_risk, checks) => {
    const users = new Map();
    for (const u of users_all) if (u.name && !users.has(u.name)) users.set(u.name, { ...u, active: true });
    // people who left stay in the chain (their reps still report to them in Salesforce) but are not counted as people
    for (const u of roster) if (u.name && !users.has(u.name)) users.set(u.name, { userId: u.userId, name: u.name, email: null, role: u.role, manager: u.manager || null, active: u.isActive !== false });
    const kids = new Map();
    for (const u of users.values()) {
      if (!u.manager || u.manager === u.name) continue;
      if (!kids.has(u.manager)) kids.set(u.manager, []);
      kids.get(u.manager).push(u.name);
    }
    const own = new Map();
    const blank = () => ({ emea: 0, thisPipe: 0, thisOpps: 0, nextPipe: 0, pastDue: 0, stale: 0, crOpps: 0, crArr: 0, wonThisArr: 0, wonThis: 0, lostThis: 0, riskReps: 0, checks: 0 });
    const get = (n) => { if (!own.has(n)) own.set(n, blank()); return own.get(n); };
    for (const p of person) {
      if (!p.inRoster) continue;
      Object.assign(get(p.name), { emea: p.isActive === false ? 0 : 1, thisPipe: +p.thisPipe || 0, thisOpps: +p.thisOpps || 0, nextPipe: +p.nextPipe || 0, pastDue: +p.pastDue || 0, stale: +p.stale || 0, crOpps: +p.crOpps || 0, crArr: +p.crArr || 0 });
    }
    for (const b of bookings) if (own.has(b.owner)) Object.assign(own.get(b.owner), { wonThisArr: +b.wonThisArr || 0, wonThis: +b.wonThis || 0, lostThis: +b.lostThis || 0 });
    for (const r of rep_risk) if (r.score >= 5) get(r.owner).riskReps += 1;
    for (const c of checks) if (c.person && c.area !== 'Routing' && c.area !== 'Pipeline') get(c.person).checks += 1;
    const KEYS = Object.keys(blank());
    const team = new Map();
    const roll = (n, seen) => {
      if (team.has(n)) return team.get(n);
      const t = { ...(own.get(n) || blank()), size: 0 };
      seen.add(n);
      for (const k of kids.get(n) || []) {
        if (seen.has(k)) continue;
        const c = roll(k, seen);
        for (const key of KEYS) t[key] += c[key];
        t.size += c.size + ((users.get(k) || {}).active === false ? 0 : 1);
      }
      team.set(n, t);
      return t;
    };
    for (const n of users.keys()) roll(n, new Set());
    for (const p of person) if (p.inRoster && !users.has(p.name)) roll(p.name, new Set());
    const totalEmea = [...own.values()].reduce((s, o) => s + o.emea, 0);
    // top EMEA leader: walk down from the person covering the most EMEA people while one direct report still covers 90%
    let top = null;
    for (const [n, t] of team) if (!top || t.emea > team.get(top).emea || (t.emea === team.get(top).emea && t.size < team.get(top).size)) top = n;
    for (let guard = 0; top && guard < 20; guard++) {
      const next = (kids.get(top) || []).find((k) => (team.get(k) || {}).emea >= 0.9 * totalEmea && (kids.get(k) || []).length);
      if (!next) break;
      top = next;
    }
    const out = [];
    for (const [n, t] of team) {
      const u = users.get(n) || {};
      // someone who left and still holds pipeline, deals or checks keeps a row, so the team's rows add up to its total
      const holds = u.active === false && !!(t.thisPipe || t.nextPipe || t.pastDue || t.stale || t.checks || t.riskReps || t.wonThis || t.lostThis);
      if (!t.emea && !holds) continue;
      const p = person.find((x) => x.name === n) || {};
      const directs = (kids.get(n) || []).filter((k) => (team.get(k) || {}).emea > 0).length;
      const directsAll = (kids.get(n) || []).filter((k) => (users.get(k) || {}).active !== false).length;
      if (u.active === false && !directs && !holds) continue;
      out.push({
        name: n, userId: u.userId || p.userId || null, email: String(u.email || '').toLowerCase() || null, role: u.role || p.role || null,
        region: p.region || (u.role ? 'Other' : null), manager: u.manager || p.manager || null, inEmea: !!(own.get(n) || {}).emea,
        isLeader: directs > 0, directs, directsAll, active: u.active !== false, teamSize: t.size, people: t.size + (u.active === false ? 0 : 1), emeaPeople: t.emea, isTop: n === top,
        thisPipe: t.thisPipe, thisOpps: t.thisOpps, nextPipe: t.nextPipe, pastDue: t.pastDue, stale: t.stale, crOpps: t.crOpps, crArr: t.crArr,
        wonThisArr: t.wonThisArr, wonThis: t.wonThis, lostThis: t.lostThis, winRate: t.wonThis + t.lostThis ? t.wonThis / (t.wonThis + t.lostThis) : null,
        riskReps: t.riskReps, checks: t.checks,
      });
    }
    return out.sort((a, b) => b.emeaPeople - a.emeaPeople || a.name.localeCompare(b.name));
  },
});

dash.calc('team_rr', {
  title: 'Routing gaps per team',
  description: 'For each person in team_tree, how many people in their team (everyone below them, themselves included) are missing from the LeanData pool for their role, or overdue as new joiners. Its own calc, so the team scorecard still works when LeanData can\'t be read.',
  inputs: ['team_tree', 'rr_people'],
  fn: (team_tree, rr_people) => {
    const kids = new Map();
    for (const t of team_tree) if (t.manager) { if (!kids.has(t.manager)) kids.set(t.manager, []); kids.get(t.manager).push(t.name); }
    const gap = new Set(rr_people.filter((r) => r.status === 'Missing' || r.status === 'New joiner: overdue').map((r) => r.name));
    return team_tree.map((t) => {
      const s = new Set([t.name]); const q = [t.name];
      while (q.length) for (const k of kids.get(q.shift()) || []) if (!s.has(k)) { s.add(k); q.push(k); }
      let n = 0; for (const x of s) if (gap.has(x)) n += 1;
      return { name: t.name, routingGaps: n };
    });
  },
});

dash.calc('oo_upcoming', {
  title: 'Your upcoming 1:1s',
  description: 'Events in your calendar from now to 14 days ahead that are a 1:1: one colleague with your email domain besides you (meeting rooms aside), with you invited or organising, not all-day or cancelled, and declined by neither of you. The colleague is matched to an active Salesforce user by email.',
  inputs: ['cal_events', 'users_all'],
  fn: (cal_events, users_all) => {
    const byEmail = new Map(users_all.map((u) => [String(u.email || '').toLowerCase(), u]));
    const dom = (x) => String(x || '').split('@')[1] || '';
    const now = Date.now();
    const out = [];
    for (const e of cal_events) {
      if (e.allDay || e.status === 'cancelled') continue;
      const att = String(e.attendees || '').split(';').filter(Boolean).map((x) => { const [email, self, room, resp, opt, name] = x.split('|'); return { email, self: self === 'self', room: room === 'room', resp, name }; }).filter((a) => !a.room);
      const me = att.find((a) => a.self) || null;
      const mine = (me && me.email) || e.calendar || '';
      const others = att.filter((a) => !a.self && a.email !== mine);
      if (others.length !== 1 || (!me && !e.organizerSelf)) continue;
      const o = others[0];
      if ((me && me.resp === 'declined') || o.resp === 'declined' || !mine || dom(o.email) !== dom(mine)) continue;
      const end = Date.parse(e.end || e.start || '');
      if (!Number.isNaN(end) && end < now) continue;
      const u = byEmail.get(o.email) || null;
      const guess = o.email.split('@')[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      out.push({ key: e.id, start: e.start, end: e.end, at: Date.parse(e.start || '') || null, title: e.title, email: o.email, name: u ? u.name : (String(o.name || '').trim() || guess), sfName: u ? u.name : null, role: u ? u.role || null : null, recurring: !!e.recurring, link: e.link });
    }
    return out.sort((a, b) => (a.at || 0) - (b.at || 0));
  },
});

dash.calc('oo_followups', {
  title: 'Follow-ups per colleague',
  description: 'Open action items from your Granola notes for each colleague: items from meetings of up to three people they attended, and items they own from any meeting (by full name, or by first name when they were one of the meeting\'s listed attendees), marked when they come from your private notes. Also the latest meeting of two or three people with them, as "last time".',
  inputs: ['gr_actions', 'gr_notes', 'users_all'],
  fn: (gr_actions, gr_notes, users_all) => {
    const toks = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
    const byName = new Map();
    for (const u of users_all) {
      const t = toks(u.name);
      const e = String(u.email || '').toLowerCase();
      if (t.length < 2 || !e) continue;
      if (!byName.has(t.join(' '))) byName.set(t.join(' '), e);
      if (!byName.has(t[0] + ' ' + t[t.length - 1])) byName.set(t[0] + ' ' + t[t.length - 1], e);
    }
    const out = [];
    const last = new Map();
    for (const r of gr_notes) {
      if (!(r.participants >= 2 && r.participants <= 3)) continue;
      for (const e of String(r.emails || '').split(', ').filter(Boolean)) {
        if (e === r.me) continue;
        const prev = last.get(e);
        if (!prev || String(r.meetingAt) > String(prev.meetingAt)) last.set(e, { meetingId: r.meetingId, meeting: r.meeting, meetingAt: r.meetingAt, url: r.url });
      }
    }
    for (const [email, m] of last) out.push({ key: email + '|last', email, kind: 'last', id: null, item: m.meeting || 'Untitled meeting', owner: null, bucket: null, due: null, dueStatus: null, meeting: m.meeting, meetingId: m.meetingId, date: String(m.meetingAt || '').slice(0, 10) || null, url: m.url });
    for (const a of gr_actions) {
      if (a.done) continue;
      const who = new Set();
      if (a.participants != null && a.participants <= 3) for (const e of String(a.emails || '').split(', ').filter(Boolean)) if (e !== a.me) who.add(e);
      if (a.owner) {
        const t = toks(a.owner);
        let e = t.length >= 2 ? byName.get(t.join(' ')) || byName.get(t[0] + ' ' + t[t.length - 1]) : null;
        if (!e && t.length === 1) {
          // a first name only: the one attendee of that meeting with that first name
          const hits = String(a.emails || '').split(', ').filter(Boolean).filter((x) => { const u = users_all.find((v) => String(v.email || '').toLowerCase() === x); return u && toks(u.name)[0] === t[0]; });
          if (hits.length === 1) e = hits[0];
        }
        if (e && e !== a.me) who.add(e);
      }
      for (const email of who) out.push({ key: email + '|' + a.id, email, kind: 'item', id: a.id, item: a.item, owner: a.owner, bucket: a.bucket, due: a.due, dueStatus: a.dueStatus, meeting: a.meeting, meetingId: a.meetingId, date: a.date, url: a.url, priv: a.source === 'private' });
    }
    return out;
  },
});

dash.calc('oo_points', {
  title: '1:1 numbers and talking points',
  description: 'For each EMEA person and leader, the numbers and talking points a 1:1 agenda opens with: for a leader the whole team (everyone below them), otherwise their own. Numbers: pipeline this and next quarter, created this quarter, won this quarter and win rate. Talking points, most urgent first: past-due opps, deals pushed out of the quarter, early-stage deals closing this quarter, overdue or missing next steps, deals stuck in their stage, no contact role, stale opps, the riskiest large deals, renewals rated High, downselling or past due, people missing from routing, book balance, untouched accounts, customers without an Engagement Manager, and data checks. A BDR\'s numbers are what they sourced.',
  inputs: ['team_tree', 'rep_risk', 'deal_list', 'renewal_list', 'books_owner', 'checks', 'cr_bdrs', 'engagement'],
  fn: (team_tree, rep_risk, deal_list, renewal_list, books_owner, checks, cr_bdrs, engagement) => {
    const usd = (v) => {
      const n = +v || 0, a = Math.abs(n);
      if (a < 0.5) return '$0';
      const s = a >= 999500 ? (a / 1e6).toFixed(a >= 9.95e6 ? 0 : 1) + 'M' : a >= 999.5 ? Math.round(a / 1e3) + 'K' : String(Math.round(a));
      return (n < 0 ? '-$' : '$') + s;
    };
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    const pct = (v) => Math.round(v * 100) + '%';
    const day = (d) => { const t = Date.parse(String(d || '').slice(0, 10) + 'T00:00:00Z'); return Number.isNaN(t) ? '' : new Date(t).toUTCString().slice(5, 11).replace(/^0/, ''); };
    const names = (rows, f) => rows.filter((r) => r[f] > 0).sort((a, b) => b[f] - a[f]).slice(0, 3).map((r) => r.owner + ' ' + r[f]).join(', ');
    const kids = new Map();
    for (const t of team_tree) if (t.manager) { if (!kids.has(t.manager)) kids.set(t.manager, []); kids.get(t.manager).push(t.name); }
    const subtree = (n) => { const s = new Set([n]); const q = [n]; while (q.length) { for (const k of kids.get(q.shift()) || []) if (!s.has(k)) { s.add(k); q.push(k); } } return s; };
    const out = [];
    for (const t of team_tree) {
      if (!t.email) continue;
      const lead = t.isLeader;
      const inT = lead ? subtree(t.name) : new Set([t.name]);
      const push = (section, sev, text, extra) => out.push({ key: t.email + '|' + section + '|' + out.length, email: t.email, name: t.name, section, sev, order: out.length, text, ...(extra || {}) });
      // numbers
      if (lead) push('numbers', '', 'Team of ' + plural(t.people, 'person', 'people') + ' in Salesforce (' + plural(t.directsAll, 'direct report', 'direct reports') + '), ' + t.emeaPeople + ' of them in EMEA sales.');
      // BDRs source deals that others own, so their numbers are what they sourced
      const bdrs = cr_bdrs.filter((b) => inT.has(b.bdr));
      const isBdr = /BDR/.test(t.role || '') && !t.thisOpps && bdrs.length;
      if (bdrs.length && (isBdr || /BDR/.test(t.role || ''))) {
        const so = bdrs.reduce((a, b) => ({ o: a.o + (+b.thisOpps || 0), r: a.r + (+b.thisArr || 0), lo: a.lo + (+b.lastOpps || 0) }), { o: 0, r: 0, lo: 0 });
        push('numbers', '', 'Sourced this quarter: ' + plural(so.o, 'opp', 'opps') + ', ' + usd(so.r) + ' (last quarter ' + so.lo + ').');
      }
      if (!isBdr) {
        push('numbers', '', 'Pipeline this quarter ' + usd(t.thisPipe) + ' across ' + plural(t.thisOpps, 'opp', 'opps') + '; next quarter ' + usd(t.nextPipe) + '.');
        push('numbers', '', 'Created this quarter: ' + plural(t.crOpps, 'opp', 'opps') + ', ' + usd(t.crArr) + '.');
        push('numbers', '', 'Won this quarter ' + usd(t.wonThisArr) + ' from ' + plural(t.wonThis, 'deal', 'deals') + (t.winRate != null ? '; win rate ' + pct(t.winRate) + ' (' + t.wonThis + ' won, ' + t.lostThis + ' lost).' : '.'));
      }
      // talking points from rep risk
      const rr = rep_risk.filter((r) => inT.has(r.owner));
      const sum = (f) => rr.reduce((s, r) => s + (+r[f] || 0), 0);
      const who = (f) => (lead && rr.some((r) => r[f] > 0) ? ' (' + names(rr, f) + ')' : '');
      if (t.pastDue) push('talk', 'high', plural(t.pastDue, 'opp is', 'opps are') + ' past the close date: update or close' + who('pastDue') + '.', { screen: 'pipeline', view: 'risk' });
      if (sum('pushedOut')) push('talk', 'high', plural(sum('pushedOut'), 'deal', 'deals') + ' (' + usd(sum('pushedOutArr')) + ') pushed out of this quarter in the last 30 days' + who('pushedOut') + '.', { screen: 'pipeline', view: 'risk' });
      if (sum('early')) push('talk', 'medium', plural(sum('early'), 'early-stage deal', 'early-stage deals') + ' (stage 0–1, ' + usd(sum('earlyArr')) + ') still closing this quarter' + who('early') + '.', { screen: 'pipeline', view: 'risk' });
      const ns = sum('nextOverdue') + sum('nextNone');
      if (ns) push('talk', 'medium', plural(ns, 'deal has', 'deals have') + ' an overdue or missing next step.', { screen: 'pipeline', view: 'risk' });
      if (sum('stuck')) push('talk', 'medium', plural(sum('stuck'), 'deal is', 'deals are') + ' stuck in their stage for longer than usual (' + usd(sum('stuckArr')) + ')' + who('stuck') + '.', { screen: 'pipeline', view: 'deals' });
      if (sum('noContact')) push('talk', 'low', plural(sum('noContact'), 'deal', 'deals') + ' closing this quarter with no contact role.', { screen: 'pipeline', view: 'risk' });
      if (t.stale) push('talk', 'low', plural(t.stale, 'opp', 'opps') + ' with no activity in 30 days.', { screen: 'pipeline', view: 'reps' });
      // the riskiest large deals
      for (const d of deal_list.filter((x) => inT.has(x.owner) && x.risk >= 3).sort((a, b) => b.arrUsd - a.arrUsd).slice(0, 3)) {
        push('talk', 'medium', 'Deal: ' + d.opp + ' (' + usd(d.arrUsd) + ', ' + d.stage + ', closes ' + day(d.closeDate) + (lead ? ', ' + d.owner : '') + '): ' + d.flags + '.', { screen: 'pipeline', view: 'deals', oppId: d.oppId });
      }
      for (const r of renewal_list.filter((x) => inT.has(x.owner) && (x.rating === 'High' || x.netChangeArrUsd < 0 || /Past due/.test(x.flags || ''))).sort((a, b) => b.renewingArrUsd - a.renewingArrUsd).slice(0, 3)) {
        const bits = [];
        if (r.rating === 'High') bits.push('rated high risk');
        if (r.netChangeArrUsd < 0) bits.push('downselling by ' + usd(Math.abs(r.netChangeArrUsd)));
        if (/Past due/.test(r.flags || '')) bits.push('past its close date');
        push('talk', r.rating === 'High' || /Past due/.test(r.flags || '') ? 'high' : 'medium', 'Renewal: ' + r.opp + ' (' + usd(r.renewingArrUsd) + ', closes ' + day(r.closeDate) + (lead ? ', ' + r.owner : '') + ') ' + bits.join(' and ') + '.', { screen: 'pipeline', view: 'renewals', oppId: r.oppId });
      }
      // routing points come from oo_points_rr, so agendas still build when LeanData can't be read
      // books
      const bk = books_owner.filter((b) => inT.has(b.owner) && (b.balance === 'Heavy' || b.balance === 'Light'));
      if (bk.length && lead) push('talk', 'low', 'Books out of balance: ' + bk.slice(0, 4).map((b) => b.owner + ' ' + b.balance.toLowerCase() + ' (' + b.active + ' active, ' + (b.vsMedian != null ? b.vsMedian.toFixed(1) + '× median' : '') + ')').join(', ') + '.', { screen: 'books', view: 'reps' });
      else if (bk.length) push('talk', 'low', 'Book is ' + bk[0].balance.toLowerCase() + ': ' + bk[0].active + ' active accounts, ' + (bk[0].vsMedian != null ? bk[0].vsMedian.toFixed(1) + '× the team median' : 'against the team median') + '.', { screen: 'books', view: 'reps' });
      // book engagement
      const eg = engagement.filter((e) => inT.has(e.owner));
      const untouched = eg.reduce((a, e) => a + (+e.untouched || 0), 0), noEm = eg.reduce((a, e) => a + (+e.noEm || 0), 0);
      if (untouched) push('talk', untouched >= 10 ? 'medium' : 'low', plural(untouched, 'active account', 'active accounts') + ' nobody has touched in 90 days' + (lead && eg.filter((e) => e.untouched).length ? ' (' + eg.filter((e) => e.untouched).sort((a, b) => b.untouched - a.untouched).slice(0, 3).map((e) => e.owner + ' ' + e.untouched).join(', ') + ')' : '') + '.', { screen: 'books', view: 'engage' });
      if (noEm) push('talk', 'low', plural(noEm, 'customer has', 'customers have') + ' no active Engagement Manager.', { screen: 'books', view: 'engage' });
      // data checks
      const ck = checks.filter((c) => c.person && c.area !== 'Routing' && c.area !== 'Pipeline' && inT.has(c.person));
      if (ck.length) push('talk', ck.some((c) => c.severity === 'high') ? 'medium' : 'low', plural(ck.length, 'data check', 'data checks') + ': ' + ck.slice(0, 3).map((c) => c.title + ' (' + c.what.toLowerCase() + ')').join('; ') + (ck.length > 3 ? '; and ' + (ck.length - 3) + ' more' : '') + '.', { screen: 'actions', view: 'checks' });
    }
    const rank = { high: 0, medium: 1, low: 2, '': 3 };
    return out.sort((a, b) => (a.email < b.email ? -1 : a.email > b.email ? 1 : 0) || (a.section === b.section ? 0 : a.section === 'numbers' ? -1 : 1) || rank[a.sev] - rank[b.sev] || a.order - b.order);
  },
});


// ===================== TERRITORY PLANNING =====================
dash.calc('oo_points_rr', {
  title: '1:1 talking points, routing',
  description: 'The routing talking points of each 1:1 agenda (for a leader, their whole team): people missing from the LeanData pool for their role, and new joiners to add next week. Its own calc, so agendas still build when LeanData can\'t be read; the agenda merges them in by severity.',
  inputs: ['team_tree', 'rr_people'],
  fn: (team_tree, rr_people) => {
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    const kids = new Map();
    for (const t of team_tree) if (t.manager) { if (!kids.has(t.manager)) kids.set(t.manager, []); kids.get(t.manager).push(t.name); }
    const subtree = (n) => { const s = new Set([n]); const q = [n]; while (q.length) { for (const k of kids.get(q.shift()) || []) if (!s.has(k)) { s.add(k); q.push(k); } } return s; };
    const out = [];
    for (const t of team_tree) {
      if (!t.email) continue;
      const lead = t.isLeader;
      const inT = lead ? subtree(t.name) : new Set([t.name]);
      const push = (sev, text, extra) => out.push({ key: t.email + '|talk|rr|' + out.length, email: t.email, name: t.name, section: 'talk', sev, order: 1e6 + out.length, text, ...(extra || {}) });
      const gaps = rr_people.filter((r) => inT.has(r.name) && (r.status === 'Missing' || r.status === 'New joiner: overdue'));
      if (gaps.length) push('high', lead ? plural(gaps.length, 'person is', 'people are') + ' missing from routing: ' + gaps.slice(0, 4).map((g) => g.name).join(', ') + (gaps.length > 4 ? ' and ' + (gaps.length - 4) + ' more' : '') + '.' : 'Not in a routing pool for their role' + (gaps[0].suggested ? ': peers are in ' + gaps[0].suggested : '') + '.', { screen: 'routing', view: 'people' });
      const soon = rr_people.filter((r) => inT.has(r.name) && r.status === 'New: add next week');
      if (soon.length) push('low', lead ? plural(soon.length, 'new joiner', 'new joiners') + ' to add to routing next week: ' + soon.slice(0, 4).map((g) => g.name).join(', ') + '.' : 'Due to be added to routing next week (week 2).', { screen: 'routing', view: 'people' });
    }
    return out;
  },
});

dash.calc('book_moves', {
  title: 'Suggested book moves',
  description: 'A starting point for territory planning: within each AE team and SMB, active accounts (customer, pipeline, engaging) to move from Heavy books (2x the team median or more) to Light ones (half the median or less), largest gaps first, each move taking both reps toward the median. Active reps who own no accounts yet count as Light. A receiver who joined in the last 90 days (Salesforce user created or Legora start date) is marked as a new joiner; what a Heavy book has left over when no Light book remains is listed without a receiver. Each move starts with the giver\'s accounts that nobody has touched in 90 days.',
  inputs: ['books_owner', 'roster', 'bk_stale'],
  fn: (books_owner, roster, bk_stale) => {
    const pool = new Map();
    for (const r of bk_stale) pool.set(r.owner, (pool.get(r.owner) || 0) + (+r.accounts || 0));
    const firstUntouched = (giver, n) => { const left = pool.get(giver) || 0; const u = Math.min(n, left); pool.set(giver, left - u); return u; };
    const since = (d) => { const t = Date.parse(String(d || '').slice(0, 10) + 'T00:00:00Z'); return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 864e5); };
    const joined = new Map();
    for (const u of roster) {
      const days = [since(u.startDate), since(u.createdDate)].filter((x) => x != null);
      if (days.length) joined.set(u.name, Math.min(...days));
    }
    const sellers = books_owner.filter((r) => r.teamMedian != null && r.ownerActive);
    // active AE and SMB reps who own nothing yet (often new joiners) are Light books too
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB' };
    const medOf = new Map(sellers.map((r) => [r.region, r.teamMedian]));
    for (const u of roster) {
      if (!u.isActive || !TEAM[u.role] || books_owner.some((b) => b.owner === u.name) || !medOf.has(TEAM[u.role])) continue;
      sellers.push({ owner: u.name, region: TEAM[u.role], manager: u.manager || '(no manager)', active: 0, teamMedian: medOf.get(TEAM[u.role]), balance: 'Light', ownerActive: true });
    }
    const out = [];
    for (const team of [...new Set(sellers.map((r) => r.region))].sort()) {
      const rs = sellers.filter((r) => r.region === team);
      const med = rs[0].teamMedian;
      const give = rs.filter((r) => r.balance === 'Heavy').map((r) => ({ r, left: Math.floor(r.active - med) })).filter((x) => x.left > 0).sort((a, b) => b.left - a.left);
      const take = rs.filter((r) => r.balance === 'Light').map((r) => ({ r, left: Math.ceil(med - r.active) })).filter((x) => x.left > 0).sort((a, b) => b.left - a.left);
      const now = new Map(rs.map((r) => [r.owner, r.active]));
      let i = 0, j = 0;
      while (i < give.length && j < take.length) {
        const n = Math.min(give[i].left, take[j].left);
        const from = give[i].r, to = take[j].r;
        const fromBefore = now.get(from.owner), toBefore = now.get(to.owner);
        now.set(from.owner, fromBefore - n); now.set(to.owner, toBefore + n);
        const d = joined.get(to.owner);
        const u = firstUntouched(from.owner, n);
        out.push({ key: team + '|' + from.owner + '|' + to.owner, region: team, manager: from.manager, toManager: to.manager, from: from.owner, to: to.owner, accounts: n, untouched: u, fromBefore, fromAfter: fromBefore - n, toBefore, toAfter: toBefore + n, teamMedian: med, note: [d != null && d <= 90 ? 'To a new joiner' : '', u ? 'Start with the ' + u + ' untouched in 90 days' : ''].filter(Boolean).join('; ') });
        give[i].left -= n; take[j].left -= n;
        if (!give[i].left) i++;
        if (!take[j].left) j++;
      }
      for (; i < give.length; i++) {
        if (give[i].left <= 0) continue;
        const from = give[i].r, b = now.get(from.owner);
        const u = firstUntouched(from.owner, give[i].left);
        out.push({ key: team + '|' + from.owner + '|', region: team, manager: from.manager, toManager: null, from: from.owner, to: null, accounts: give[i].left, untouched: u, fromBefore: b, fromAfter: b - give[i].left, toBefore: null, toAfter: null, teamMedian: med, note: 'No Light book in the team to take them' + (u ? '; ' + u + ' of them untouched in 90 days' : '') });
      }
    }
    return out;
  },
});

dash.calc('oo_kpi', {
  title: '1:1s headline',
  description: 'How many 1:1s with a colleague you have today (your local date) and in the next 7 and 14 days.',
  inputs: ['oo_upcoming'],
  fn: (oo_upcoming) => {
    const now = new Date();
    const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = day(now);
    const at = (r) => { const d = new Date(r.start); return Number.isNaN(+d) ? null : day(d); };
    return [{
      today: oo_upcoming.filter((r) => at(r) === today).length,
      week: oo_upcoming.filter((r) => at(r) != null && at(r) - today < 7 * 864e5).length,
      total: oo_upcoming.length,
    }];
  },
});

// ===================== WEEKLY MOVEMENT =====================
dash.calc('pipe_moves', {
  title: 'Pipeline movement, last 7 days',
  description: 'Per EMEA rep, New Business and Upsell in the last 7 days: opportunities created, won and lost (by the date actually closed; admin merges and record clean-ups left out of lost), close dates pushed out of this quarter or pulled into it, stage moved up or down, and moved into or out of Commit. Each deal counts once per measure, at its current ARR, for its current owner, comparing where it was at the start of the week with where it is now, so a push that was pulled back, or a stage moved and moved back, does not count. Deals created this week count as created (and as won or lost if they closed); their close-date, stage and Commit changes are left out.',
  inputs: ['mv_outcomes', 'mv_created', 'mv_close', 'mv_fields', 'roster'],
  fn: (mv_outcomes, mv_created, mv_close, mv_fields, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const curQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const byId = new Map(roster.map((u) => [String(u.userId).slice(0, 15), u]));
    const m = new Map();
    const get = (owner, role, manager) => {
      if (!m.has(owner)) m.set(owner, { owner, role: role || null, region: TEAM[role] || 'Other', manager: manager || '(no manager)', created: 0, createdArr: 0, createdThisQ: 0, won: 0, wonArr: 0, lost: 0, lostArr: 0, pushed: 0, pushedArr: 0, pulled: 0, pulledArr: 0, up: 0, upArr: 0, down: 0, downArr: 0, intoCommit: 0, intoCommitArr: 0, outCommit: 0, outCommitArr: 0 });
      return m.get(owner);
    };
    for (const r of mv_outcomes) { const o = get(r.owner, r.role, r.manager); if (r.won) { o.won += +r.n || 0; o.wonArr += +r.arr || 0; } else { o.lost += +r.n || 0; o.lostArr += +r.arr || 0; } }
    for (const r of mv_created) {
      const o = get(r.owner, r.role, r.manager);
      o.created += +r.opps || 0; o.createdArr += +r.arr || 0;
      if (r.toFY * 10 + r.toFQ === curQ) o.createdThisQ += +r.opps || 0;
    }
    // one row per deal and from/to quarter: in this quarter before its first move of the week, and after its last?
    const deals = new Map();
    for (const r of mv_close) {
      if (!deals.has(r.oppId)) { deals.set(r.oppId, { start: r, end: r }); continue; }
      const d = deals.get(r.oppId);
      if (String(r.firstAt) < String(d.start.firstAt)) d.start = r;
      if (String(r.lastAt) > String(d.end.lastAt)) d.end = r;
    }
    for (const { start, end } of deals.values()) {
      const wasIn = start.fromFY * 10 + start.fromFQ === curQ, isIn = end.toFY * 10 + end.toFQ === curQ;
      if (wasIn === isIn) continue;
      const o = get(end.owner, end.role, end.manager);
      if (wasIn) { o.pushed += 1; o.pushedArr += +end.arr || 0; } else { o.pulled += 1; o.pulledArr += +end.arr || 0; }
    }
    const per = new Map();
    for (const r of mv_fields) {
      const k = r.oppId + '|' + r.field;
      if (!per.has(k)) per.set(k, { oppId: r.oppId, ownerId: r.ownerId, arr: +r.arrUsd || 0, field: r.field, first: r.oldValue, last: r.newValue });
      else per.get(k).last = r.newValue;
    }
    const ord = (v) => { const d = parseInt(String(v || ''), 10); return Number.isNaN(d) ? null : d; };
    for (const x of per.values()) {
      const u = byId.get(String(x.ownerId || '').slice(0, 15));
      if (!u) continue;
      const o = get(u.name, u.role, u.manager);
      if (x.field === 'StageName') {
        const a = ord(x.first), b = ord(x.last);
        if (a == null || b == null || a === b) continue;
        if (b > a) { o.up += 1; o.upArr += x.arr; } else { o.down += 1; o.downArr += x.arr; }
      } else {
        const was = x.first === 'Commit', is = x.last === 'Commit';
        if (!was && is) { o.intoCommit += 1; o.intoCommitArr += x.arr; }
        else if (was && !is) { o.outCommit += 1; o.outCommitArr += x.arr; }
      }
    }
    return [...m.values()];
  },
});

dash.calc('moves_kpi', {
  title: 'Pipeline movement headline',
  description: 'The last 7 days of pipeline movement added up per team, per manager ("M|<manager>", their direct reports) and for all EMEA, with net Commit ARR (into minus out of Commit) and stage moves (up plus down).',
  inputs: ['pipe_moves'],
  fn: (pipe_moves) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(pipe_moves.map((r) => r.manager).filter((x) => x && x !== '(no manager)'))];
    const F = ['created', 'createdArr', 'createdThisQ', 'won', 'wonArr', 'lost', 'lostArr', 'pushed', 'pushedArr', 'pulled', 'pulledArr', 'up', 'upArr', 'down', 'downArr', 'intoCommit', 'intoCommitArr', 'outCommit', 'outCommitArr'];
    return regions.concat(managers.map((x) => 'M|' + x)).map((region) => {
      const rs = pipe_moves.filter((r) => (region.startsWith('M|') ? r.manager === region.slice(2) : region === 'All' || r.region === region));
      const o = { region };
      for (const f of F) o[f] = rs.reduce((s, r) => s + (+r[f] || 0), 0);
      o.netCommitArr = o.intoCommitArr - o.outCommitArr;
      o.moves = o.up + o.down;
      return o;
    });
  },
});

// ===================== COVERAGE =====================
dash.calc('pipe_cover', {
  title: 'Coverage against usual bookings',
  description: 'Per team, team and manager, manager ("M|<manager>", direct reports) and all EMEA, New Business and Upsell: average quarterly bookings over the last 4 completed quarters (missing quarters count as 0), won so far this quarter, open pipeline closing this and next quarter (past-due deals from earlier quarters left out, as on Pipeline), coverage (open this quarter over what is still to win to reach the usual quarter, open next quarter over a usual quarter), the win rate by ARR over those 4 quarters (admin merges left out; falls back to all EMEA under 10 closed deals), expected close at that win rate, and the average days from creation to win.',
  inputs: ['coverage_base', 'cycle_team'],
  fn: (coverage_base, cycle_team) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const idx = (fy, fq) => fy * 4 + (fq - 1);
    const cur = idx(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) + 1);
    const m = new Map();
    const blank = (key, region, manager, level) => ({ key, region, manager, level, wonHist: 0, lostHist: 0, closedN: 0, histQs: new Set(), wonSoFar: 0, openThis: 0, openNext: 0, cyc: 0, cycN: 0 });
    const get = (region, manager) => { const key = region + '|' + manager; if (!m.has(key)) m.set(key, blank(key, region, manager, region === 'All' ? 'all' : region === 'M' ? 'manager' : manager === 'All' ? 'region' : 'team')); return m.get(key); };
    const each = (role, manager, f) => { const region = TEAM[role] || 'Other'; const mg = manager || '(no manager)'; [get('All', 'All'), get(region, 'All'), get(region, mg), get('M', mg)].forEach(f); };
    get('All', 'All');
    for (const r of coverage_base) {
      if (r.fy == null) continue;
      const q = idx(+r.fy, +r.fq);
      const arr = +r.arr || 0, n = +r.n || 0;
      each(r.role, r.manager, (o) => {
        if (r.closed) {
          if (q >= cur - 4 && q < cur) { if (r.won) { o.wonHist += arr; if (arr > 0) o.histQs.add(q); } else o.lostHist += arr; o.closedN += n; }
          else if (q === cur && r.won) o.wonSoFar += arr;
        } else if (q === cur) o.openThis += arr;
        else if (q === cur + 1) o.openNext += arr;
      });
    }
    for (const r of cycle_team) each(r.role, r.manager, (o) => { o.cyc += (+r.avgCycleDays || 0) * (+r.wonOpps || 0); o.cycN += +r.wonOpps || 0; });
    const all = m.get('All|All');
    const rate = (o) => (o.wonHist + o.lostHist > 0 ? o.wonHist / (o.wonHist + o.lostHist) : null);
    return [...m.values()].map((o) => {
      const avg = o.wonHist / 4;
      const fallback = o.closedN < 10 || rate(o) == null;
      const wr = fallback ? rate(all) : rate(o);
      const left = avg - o.wonSoFar;
      return {
        key: o.key, region: o.region, manager: o.manager, level: o.level,
        avgBookings: avg, histQuarters: o.histQs.size, wonSoFar: o.wonSoFar, openThis: o.openThis, openNext: o.openNext,
        toGo: left > 0 ? left : 0, coverageThis: left > 0 ? o.openThis / left : null, aheadOfUsual: avg > 0 && left <= 0,
        coverageNext: avg > 0 ? o.openNext / avg : null, winRate: wr, winRateFallback: fallback,
        expectedThis: wr != null ? o.openThis * wr : null, expectedNext: wr != null ? o.openNext * wr : null,
        projectedThis: wr != null ? o.wonSoFar + o.openThis * wr : null, avgCycleDays: o.cycN ? o.cyc / o.cycN : null,
      };
    });
  },
});

// ===================== BOOK ENGAGEMENT =====================
dash.calc('engagement', {
  title: 'Book engagement',
  description: 'Per EMEA owner: active accounts (customer, pipeline, engaging) that nobody has logged an activity on in 90 days, of them never touched, untouched customers, the share of their active book, customers without an Engagement Manager or with an inactive one, and customers whose Engagement Manager is not in an EM role. An untouched book is 3 or more untouched accounts, or 20% or more of an active book of 10 or more.',
  inputs: ['books_owner', 'bk_stale', 'bk_em_cover'],
  fn: (books_owner, bk_stale, bk_em_cover) => {
    const m = new Map();
    const get = (owner) => {
      if (!m.has(owner)) {
        const b = books_owner.find((x) => x.owner === owner) || {};
        m.set(owner, { owner, region: b.region || 'Other', manager: b.manager || '(no manager)', role: b.role || null, active: +b.active || 0, untouched: 0, never: 0, untouchedCustomers: 0, untouchedArr: 0, customers: 0, noEm: 0, noEmArr: 0, emNotEm: 0 });
      }
      return m.get(owner);
    };
    for (const b of books_owner) if (b.active) get(b.owner);
    for (const r of bk_stale) {
      const o = get(r.owner);
      o.untouched += +r.accounts || 0;
      o.never += (+r.accounts || 0) - (+r.everTouched || 0);
      if (r.status === 'Customer') { o.untouchedCustomers += +r.accounts || 0; o.untouchedArr += +r.arrUsd || 0; }
    }
    for (const r of bk_em_cover) {
      const o = get(r.owner);
      o.customers += +r.customers || 0;
      if (r.emActive !== true) { o.noEm += (+r.customers || 0); o.noEmArr += +r.arrUsd || 0; }
      else if (!/^(EM-|DIR-EM-)/.test(r.emRole || '')) o.emNotEm += +r.customers || 0;
    }
    return [...m.values()].map((o) => {
      const share = o.active ? o.untouched / o.active : null;
      return { ...o, share, flag: o.untouched >= 3 || (share != null && share >= 0.2 && o.active >= 10) ? 'Untouched book' : o.noEm ? 'Customers without an EM' : '' };
    }).filter((o) => o.active || o.customers);
  },
});

dash.calc('engagement_kpi', {
  title: 'Book engagement headline',
  description: 'Untouched active accounts, their share of the active book, never-touched accounts and customers without an Engagement Manager, per team, per manager and for all EMEA.',
  inputs: ['engagement'],
  fn: (engagement) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(engagement.map((r) => r.manager).filter((x) => x && x !== '(no manager)'))];
    const sum = (rs, f) => rs.reduce((s, r) => s + (+r[f] || 0), 0);
    return regions.concat(managers.map((x) => 'M|' + x)).map((region) => {
      const rs = engagement.filter((r) => (region.startsWith('M|') ? r.manager === region.slice(2) : region === 'All' || r.region === region));
      const active = sum(rs, 'active'), untouched = sum(rs, 'untouched');
      return { region, active, untouched, share: active ? untouched / active : null, never: sum(rs, 'never'), untouchedCustomers: sum(rs, 'untouchedCustomers'), customers: sum(rs, 'customers'), noEm: sum(rs, 'noEm'), noEmArr: sum(rs, 'noEmArr'), flagged: rs.filter((r) => r.flag === 'Untouched book').length };
    });
  },
});

// ===================== LEADS =====================
// Leads count for their current owner, as everywhere in the app: team = the owner's role, manager = the roster's.
// The Marketing Queue and owners outside EMEA sales belong to no team (region 'Queue' or 'Other') and show under All EMEA only.
// Business time: Mon-Fri 09:00-18:00 Europe/Paris, no public holidays. No lead names, emails, companies or Ids are read.
dash.calc('ld_handoff_rows', {
  title: 'Lead hand-offs, last 30 days',
  description: 'One row per lead whose Ready Since stamp is in the last 30 days (no Id, no prospect detail): owner kind, team and manager; whether it is a demo request (Inbound: Demo Request or Contact Us Email Demo Request); how it left Ready and how fast in business minutes (Mon-Fri 09:00-18:00 Paris time, no holidays); and whether LeanData routed it to a person at Ready and how fast. Demo requests are due within 1 business day (540 business minutes), other hand-offs within 5 (2,700). Left out of speed: leads with no EMEA seller as owner, re-readied leads (first response more than 1 minute before this Ready stamp), exits within 2 minutes (automation), leads that left Ready with no first-response stamp, and SMB-owned leads (automation moves them out of Ready, so the stamp is not a rep response).',
  inputs: ['ld_handoffs', 'roster'],
  fn: (ld_handoffs, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const DEMO = ['Demo Request', 'Contact Us Email Demo Request'];
    const DUE_DEMO = 540, DUE_OTHER = 2700; // business minutes: 1 and 5 business days of 9 hours
    const RESTAMP_MS = 60e3, AUTO_MS = 120e3, ROUTE_SLACK_MS = 5e3, QUICK_MS = 30 * 60e3;
    const id15 = (x) => String(x || '').slice(0, 15);
    // Salesforce datetimes end in +0000; some browsers only read +00:00
    const ts = (x) => { if (!x) return null; const t = Date.parse(String(x).replace(/([+-]\d\d)(\d\d)$/, '$1:$2')); return Number.isNaN(t) ? null : t; };
    const users = new Map(roster.map((u) => [id15(u.userId), u]));
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const parts = (t) => Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    const offs = new Map();
    const offsetOn = (y, m, d) => { // Paris UTC offset (ms) at 12:00 UTC that day; clocks change at night, so it holds for 09:00-18:00
      const k = y * 1e4 + m * 100 + d;
      if (!offs.has(k)) { const t = Date.UTC(y, m, d, 12); const p = parts(t); offs.set(k, Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t); }
      return offs.get(k);
    };
    const bmin = (a, b) => { // business minutes between two instants (ms)
      if (!(b > a)) return 0;
      const p = parts(a);
      let y = +p.year, m = +p.month - 1, d = +p.day, total = 0;
      for (let i = 0; i < 400; i++) {
        const off = offsetOn(y, m, d), s = Date.UTC(y, m, d, 9) - off, e = Date.UTC(y, m, d, 18) - off;
        if (s >= b) break;
        const wd = new Date(Date.UTC(y, m, d)).getUTCDay();
        if (wd >= 1 && wd <= 5) { const lo = Math.max(a, s), hi = Math.min(b, e); if (hi > lo) total += (hi - lo) / 6e4; }
        const nx = new Date(Date.UTC(y, m, d + 1)); y = nx.getUTCFullYear(); m = nx.getUTCMonth(); d = nx.getUTCDate();
      }
      return total;
    };
    const now = Date.now();
    return ld_handoffs.filter((r) => ts(r.readyAt) != null).map((r) => {
      const u = users.get(id15(r.ownerId)) || {};
      const queue = r.ownerType === 'Queue';
      const ownerKind = queue ? 'Queue' : !TEAM[r.ownerRole] ? 'Outside EMEA sales' : r.ownerActive === false ? 'Left (inactive)' : 'EMEA seller';
      const demo = r.src === 'Inbound' && DEMO.includes(r.detail);
      const ra = ts(r.readyAt), fa = ts(r.respAt), ro = ts(r.routedAt);
      const waiting = r.status === 'Ready' && r.converted !== true && fa == null;
      const due = demo ? DUE_DEMO : DUE_OTHER;
      const cls = queue || !TEAM[r.ownerRole] ? 'No EMEA seller'
        : fa != null && fa < ra - RESTAMP_MS ? 'Re-readied'
        : fa != null && fa - ra < AUTO_MS ? 'Automated'
        : fa == null && !waiting ? 'No stamp'
        : r.ownerRole === 'SMB-EMEA' ? 'SMB, not scored' : 'Scored';
      let bizMin = null, state = null;
      if (cls === 'Scored') {
        bizMin = Math.round(bmin(ra, waiting ? now : fa));
        state = waiting ? (bizMin > due ? 'Waiting past due' : 'Pending') : bizMin <= due ? 'Within' : 'Late';
      }
      const route = ro != null && ro >= ra - ROUTE_SLACK_MS ? 'Routed at Ready' : queue ? 'Still in the queue' : 'Already with a person';
      return {
        ownerId: r.ownerId, owner: r.owner || u.name || '(unknown)', role: r.ownerRole || null, ownerKind,
        region: queue ? 'Queue' : TEAM[r.ownerRole] || 'Other', manager: queue || !TEAM[r.ownerRole] ? null : u.manager || '(no manager)',
        src: r.src || '(blank)', detail: r.detail || '(blank)', demo, status: r.status, converted: r.converted === true,
        readyDay: new Date(ra).toISOString().slice(0, 10), ageDays: Math.floor((now - ra) / 864e5),
        cls, due, bizMin, state, eligible: state === 'Within' || state === 'Late' || state === 'Waiting past due',
        respBeforeReady: fa != null && fa < ra - RESTAMP_MS, exitMin: fa != null && fa >= ra - RESTAMP_MS ? (fa - ra) / 6e4 : null,
        quickExit: fa != null && fa >= ra && fa - ra < QUICK_MS,
        route, routeMin: route === 'Routed at Ready' ? Math.max(0, (ro - ra) / 6e4) : null,
      };
    });
  },
});

dash.calc('ld_backlog', {
  title: 'Ready leads now, per owner',
  description: 'Leads in Ready now per owner (a person or a queue): owner kind (EMEA seller, left, outside EMEA sales, queue), demo requests and how many have waited 2 or more business days, age bands in business days since the Ready Since date (UTC dates, a lower bound), leads with no Ready Since date (Ready since before 19 May 2026, or a stamping gap when created later), leads LeanData routed to another region, the oldest Ready day (or "before 19 May 2026"), and what to do. Needs only the Ready leads, so it survives when the other lead queries fail; the owner\'s other open leads come from ld_backlog_open.',
  inputs: ['ld_ready', 'roster'],
  fn: (ld_ready, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const DEMO = ['Demo Request', 'Contact Us Email Demo Request'];
    const FIELD_ADDED = '2026-05-19', STALE_BD = 20, CLEANUP_N = 20, DEMO_DUE_BD = 2;
    const REVIEW = /STRAT|Partnership/i;
    const id15 = (x) => String(x || '').slice(0, 15);
    const users = new Map(roster.map((u) => [id15(u.userId), u]));
    const today = new Date(); const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    // Mon-Fri UTC dates after `day`, up to and including today
    const bdays = (day) => { const s = Date.parse(String(day).slice(0, 10) + 'T00:00:00Z'); if (Number.isNaN(s)) return 0; let n = 0; for (let t = s + 864e5; t <= t0; t += 864e5) { const w = new Date(t).getUTCDay(); if (w >= 1 && w <= 5) n++; } return n; };
    const m = new Map();
    const get = (r) => {
      const queue = r.ownerType === 'Queue';
      const k = queue ? 'queue:' + id15(r.ownerId) : id15(r.ownerId);
      if (!m.has(k)) {
        const u = users.get(k) || {};
        const kind = queue ? 'Queue' : !TEAM[r.ownerRole] ? 'Outside EMEA sales' : r.ownerActive === false ? 'Left (inactive)' : 'EMEA seller';
        const active = r.ownerActive !== false;
        m.set(k, { key: k, ownerId: queue ? null : r.ownerId, queueId: queue ? id15(r.ownerId) : null, owner: r.owner || u.name || '(unknown)', role: r.ownerRole || null, kind, active,
          // strategic and partnership owners can be right, but only while they are active
          review: kind === 'Outside EMEA sales' && active && REVIEW.test(r.ownerRole || ''),
          region: queue ? 'Queue' : TEAM[r.ownerRole] || 'Other', manager: kind === 'EMEA seller' || kind === 'Left (inactive)' ? u.manager || '(no manager)' : null,
          ready: 0, demo: 0, demoOverdue: 0, b1: 0, b5: 0, b20: 0, b21: 0, noDate: 0, stampGap: 0, elsewhere: 0, regions: {}, oldestDay: null, oldestDemoDay: null, before: false, demoBefore: false });
      }
      return m.get(k);
    };
    for (const r of ld_ready) {
      const n = +r.leads || 0;
      if (!n) continue;
      const o = get(r);
      const demo = r.src === 'Inbound' && DEMO.includes(r.detail);
      o.ready += n; if (demo) o.demo += n;
      if (r.routingRegion && r.routingRegion !== 'EMEA') { o.elsewhere += n; o.regions[r.routingRegion] = (o.regions[r.routingRegion] || 0) + n; }
      if (!r.readyDay) {
        const created = String(r.firstCreated || '').slice(0, 10);
        if (created >= FIELD_ADDED) o.stampGap += n; else { o.noDate += n; o.before = true; if (demo) o.demoBefore = true; }
        // no Ready date: Ready since before the field existed (certainly waiting), or a stamping gap, counted once created 2+ business days ago
        if (demo && (created < FIELD_ADDED || bdays(created) >= DEMO_DUE_BD)) o.demoOverdue += n;
        continue;
      }
      const b = bdays(r.readyDay);
      if (b <= 1) o.b1 += n; else if (b <= 5) o.b5 += n; else if (b <= STALE_BD) o.b20 += n; else o.b21 += n;
      if (demo && b >= DEMO_DUE_BD) { o.demoOverdue += n; if (!o.oldestDemoDay || r.readyDay < o.oldestDemoDay) o.oldestDemoDay = r.readyDay; }
      if (!o.oldestDay || r.readyDay < o.oldestDay) o.oldestDay = r.readyDay;
    }
    return [...m.values()].map((o) => {
      const stale = o.b21 + o.noDate;
      return { ...o, stale, noDateAll: o.noDate + o.stampGap,
        // leads Ready since before 19 May 2026 are older than any dated one
        oldest: o.before ? 'before 19 May 2026' : o.oldestDay, oldestSort: o.before ? '0000-00-00' : o.oldestDay, oldestDemo: o.demoBefore ? 'before 19 May 2026' : o.oldestDemoDay,
        regions: Object.entries(o.regions).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '),
        todo: o.kind === 'Queue' ? 'Route to a person' : o.kind === 'Left (inactive)' || !o.active ? 'Reassign' : o.kind === 'Outside EMEA sales' ? (o.review ? 'Review' : 'Reassign or confirm')
          : o.demoOverdue > 0 ? 'Nudge owner' : stale >= CLEANUP_N ? 'Clean up Ready' : o.elsewhere >= CLEANUP_N ? 'Check region' : '' };
    }).sort((a, b) => b.demoOverdue - a.demoOverdue || b.stale - a.stale || b.ready - a.ready);
  },
});

dash.calc('ld_backlog_open', {
  title: 'Open leads per owner',
  description: 'For each owner of Ready leads, how many open leads they hold in all and by status (being worked, New, Nurturing), from the open-lead query. Its own calc, so the Ready backlog still shows when that query fails.',
  inputs: ['ld_open'],
  fn: (ld_open) => {
    const id15 = (x) => String(x || '').slice(0, 15);
    const m = new Map();
    for (const r of ld_open) {
      const k = r.ownerType === 'Queue' ? 'queue:' + id15(r.ownerId) : id15(r.ownerId);
      if (!m.has(k)) m.set(k, { key: k, open: 0, working: 0, fresh: 0, nurturing: 0 });
      const o = m.get(k), n = +r.leads || 0;
      o.open += n;
      if (r.status === 'Pursuing' || r.status === 'Engaging') o.working += n;
      else if (r.status === 'New') o.fresh += n;
      else if (r.status === 'Nurturing') o.nurturing += n;
    }
    return [...m.values()];
  },
});

dash.calc('ld_reps', {
  title: 'Lead speed per rep',
  description: 'Per EMEA seller (people who left included), hand-offs in the last 30 days: demo requests worked within 1 business day and other hand-offs within 5 (scored hand-offs only, see ld_handoff_rows), their median business hours, demo requests still in Ready past due, hand-offs left out of speed and why, and the Ready leads they hold now. Rates and medians on fewer than 5 leads are left blank.',
  inputs: ['ld_handoff_rows', 'ld_backlog'],
  fn: (ld_handoff_rows, ld_backlog) => {
    const MIN_N = 5;
    const id15 = (x) => String(x || '').slice(0, 15);
    const median = (xs) => { // xs: [business minutes, still waiting]; hours (lower middle), and whether a waiting lead could still move it
      if (!xs.length) return { v: null, atLeast: false };
      const s = xs.slice().sort((a, b) => a[0] - b[0]);
      const i = Math.ceil(s.length / 2) - 1;
      return { v: s[i][0] / 60, atLeast: s.some((t, j) => t[1] && j <= i) };
    };
    const blank = (r) => ({ ownerId: r.ownerId, owner: r.owner, role: r.role, region: r.region, manager: r.manager, active: r.ownerKind ? r.ownerKind === 'EMEA seller' : r.kind === 'EMEA seller', scored: r.role !== 'SMB-EMEA',
      handoffs: 0, last7: 0, hReady: 0, hEligible: 0, hWithin: 0, hWaiting: 0, hPending: 0, hT: [], lReady: 0, lEligible: 0, lWithin: 0, lWaiting: 0, lPending: 0, lT: [],
      reReadied: 0, automated: 0, noStamp: 0, notScored: 0 });
    const m = new Map();
    for (const r of ld_handoff_rows) {
      if (r.ownerKind !== 'EMEA seller' && r.ownerKind !== 'Left (inactive)') continue;
      const k = id15(r.ownerId);
      if (!m.has(k)) m.set(k, blank(r));
      const o = m.get(k), p = r.demo ? 'h' : 'l';
      o.handoffs += 1; if (r.ageDays < 7) o.last7 += 1;
      o[p + 'Ready'] += 1;
      if (r.cls === 'Re-readied') o.reReadied += 1; else if (r.cls === 'Automated') o.automated += 1; else if (r.cls === 'No stamp') o.noStamp += 1; else if (r.cls === 'SMB, not scored') o.notScored += 1;
      if (r.cls !== 'Scored') continue;
      if (r.state === 'Pending') { o[p + 'Pending'] += 1; continue; }
      o[p + 'Eligible'] += 1;
      if (r.state === 'Within') o[p + 'Within'] += 1;
      if (r.state === 'Waiting past due') o[p + 'Waiting'] += 1;
      o[p + 'T'].push([r.bizMin, r.state === 'Waiting past due']);
    }
    const bl = new Map(ld_backlog.filter((b) => b.kind === 'EMEA seller' || b.kind === 'Left (inactive)').map((b) => [id15(b.ownerId), b]));
    for (const [k, b] of bl) if (!m.has(k)) m.set(k, blank(b)); // sellers holding Ready leads with no hand-off in the window
    return [...m.entries()].map(([k, o]) => {
      const hm = median(o.hT), lm = median(o.lT), b = bl.get(k) || {};
      const elig = o.hEligible + o.lEligible, within = o.hWithin + o.lWithin;
      // Demo waiting matches the 2+ business-day count; a demo request just past its 1-business-day due time is Demo past due
      const status = !o.active ? 'Left' : (b.demoOverdue || 0) > 0 ? 'Demo waiting' : o.hWaiting > 0 ? 'Demo past due' : !o.scored ? 'Not scored' : elig < MIN_N ? 'Small sample' : within / elig < 0.5 ? 'Slow' : 'On time';
      const { hT, lT, ...rest } = o;
      return { ...rest, key: k, name: o.owner,
        hRate: o.hEligible >= MIN_N ? o.hWithin / o.hEligible : null, hMedianHours: o.hEligible >= MIN_N ? hm.v : null, hMedianAtLeast: o.hEligible >= MIN_N && hm.atLeast,
        lRate: o.lEligible >= MIN_N ? o.lWithin / o.lEligible : null, lMedianHours: o.lEligible >= MIN_N ? lm.v : null, lMedianAtLeast: o.lEligible >= MIN_N && lm.atLeast,
        leftOut: o.reReadied + o.automated + o.noStamp + o.notScored,
        readyNow: b.ready || 0, demoOverdue: b.demoOverdue || 0, stale: b.stale || 0, b21: b.b21 || 0, elsewhere: b.elsewhere || 0, status };
    }).sort((a, b) => (b.hWaiting + b.demoOverdue) - (a.hWaiting + a.demoOverdue) || (a.hRate ?? 2) - (b.hRate ?? 2) || (a.lRate ?? 2) - (b.lRate ?? 2) || b.handoffs - a.handoffs);
  },
});

dash.calc('ld_problems', {
  title: 'Lead routing problems',
  description: 'Open leads in scope stuck in routing or held by someone who cannot work them, one row per problem, owner (or queue) and LeanData action: LeanData routing errors (status or action error, partner call-out errors included), not processed by LeanData, Ready leads in a queue, MQLs still New in a queue, worked leads (Pursuing or Engaging) back in a queue, open leads of inactive users, open leads of active users outside EMEA sales roles, and leads of strategic or partnership owners (review, not counted).',
  inputs: ['ld_open', 'ld_ready', 'roster'],
  fn: (ld_open, ld_ready, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const DEMO = ['Demo Request', 'Contact Us Email Demo Request'];
    const REVIEW = /STRAT|Partnership/i;
    const ROUTING = ['Routing error', 'Not processed by LeanData', 'Ready in a queue', 'MQL not handed off', 'Worked lead back in the queue'];
    const ACTION = { 'Routing error': 'Fix routing', 'Not processed by LeanData': 'Fix routing', 'Ready in a queue': 'Route to a person', 'MQL not handed off': 'Route to a person', 'Worked lead back in the queue': 'Route to a person', 'Owner inactive': 'Reassign', 'Owner outside EMEA sales': 'Reassign or confirm', 'Strategic or partnerships owner': 'Review' };
    const id15 = (x) => String(x || '').slice(0, 15);
    const users = new Map(roster.map((u) => [id15(u.userId), u]));
    const week = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const m = new Map();
    const add = (kind, r, ld) => {
      const queue = r.ownerType === 'Queue', ok = queue ? 'queue:' + id15(r.ownerId) : id15(r.ownerId), key = kind + '|' + ok + '|' + (ld || '');
      if (!m.has(key)) {
        const u = users.get(ok) || {}, emea = !queue && !!TEAM[r.ownerRole];
        m.set(key, { key, kind, ownerKey: ok, ownerId: queue ? null : r.ownerId, owner: r.owner || u.name || '(unknown)', ownerType: queue ? 'Queue' : 'User', role: r.ownerRole || null,
          region: queue ? 'Queue' : TEAM[r.ownerRole] || 'Other', manager: emea ? u.manager || '(no manager)' : null, leaver: emea && r.ownerActive === false,
          ldAction: ld || null, leads: 0, ready: 0, st: new Map(), lastProcessed: null, neverProcessed: 0 });
      }
      const o = m.get(key), n = +r.leads || 0;
      o.leads += n; if (r.status === 'Ready') o.ready += n;
      o.st.set(r.status || '(none)', (o.st.get(r.status || '(none)') || 0) + n);
      if (r.lastProcessed && (!o.lastProcessed || String(r.lastProcessed) > String(o.lastProcessed))) o.lastProcessed = r.lastProcessed;
      if (!r.ldStatus && !r.ldAction) o.neverProcessed += n;
    };
    for (const r of ld_open) {
      const queue = r.ownerType === 'Queue';
      if (r.ldStatus === 'error' || /^error/i.test(r.ldAction || '')) add('Routing error', r, r.ldAction || r.ldStatus);
      else if (r.ldStatus === 'not processed') add('Not processed by LeanData', r, r.ldStatus);
      else if (queue && r.status === 'Ready') add('Ready in a queue', r, null);
      else if (queue && r.status === 'New' && r.lifecycle === 'MQL') add('MQL not handed off', r, null);
      else if (queue && (r.status === 'Pursuing' || r.status === 'Engaging')) add('Worked lead back in the queue', r, null);
      if (queue) continue;
      if (r.ownerActive === false) add('Owner inactive', r, null);
      else if (!TEAM[r.ownerRole]) add(REVIEW.test(r.ownerRole || '') ? 'Strategic or partnerships owner' : 'Owner outside EMEA sales', r, null);
    }
    // per queue: the oldest Ready day (leads with no Ready date created before 19 May 2026 are older still) and its demo requests
    const qInfo = new Map();
    for (const r of ld_ready) if (r.ownerType === 'Queue') {
      const k = 'queue:' + id15(r.ownerId), q = qInfo.get(k) || { oldest: null, before: false, demo: 0 };
      if (r.readyDay && (!q.oldest || r.readyDay < q.oldest)) q.oldest = r.readyDay;
      if (!r.readyDay && String(r.firstCreated || '').slice(0, 10) < '2026-05-19') q.before = true;
      if (r.src === 'Inbound' && DEMO.includes(r.detail)) q.demo += +r.leads || 0;
      qInfo.set(k, q);
    }
    const sev = (o) => o.kind === 'Routing error' ? ((o.lastProcessed && String(o.lastProcessed).slice(0, 10) >= week) || o.ready > 0 ? 'high' : 'medium')
      : o.kind === 'Ready in a queue' ? 'high'
      : o.kind === 'Owner inactive' ? (o.ready > 0 ? 'high' : 'medium')
      : o.kind === 'Owner outside EMEA sales' ? (o.ready > 0 ? 'medium' : 'low')
      : o.kind === 'Worked lead back in the queue' || o.kind === 'Strategic or partnerships owner' ? 'low' : 'medium';
    const rank = { high: 0, medium: 1, low: 2 };
    return [...m.values()].map((o) => {
      const { st, ...rest } = o;
      const q = o.kind === 'Ready in a queue' ? qInfo.get(o.ownerKey) || null : null;
      return { ...rest, severity: sev(o), statuses: [...st.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => n + ' ' + s).join(', '),
        lastProcessed: o.lastProcessed ? String(o.lastProcessed).slice(0, 10) : null,
        oldestReadyDay: q ? (q.before ? 'before 19 May 2026' : q.oldest) : null, demoRequests: q ? q.demo : null,
        routing: ROUTING.includes(o.kind), action: ACTION[o.kind] };
    }).sort((a, b) => rank[a.severity] - rank[b.severity] || b.leads - a.leads || String(a.owner).localeCompare(String(b.owner)));
  },
});

dash.calc('ld_sources', {
  title: 'Leads by source',
  description: 'All EMEA, per lead source and detail: leads created in the last 30 days and where they are now (in a queue, routed to a person by LeanData, auto-converted by LeanData to a contact, merged, routing error); hand-offs (Ready Since in the last 30 days) and how many were worked in time (scored hand-offs only, due in 1 business day for demo requests and 5 for the rest); leads in Ready now and how many have waited over 20 business days (or are Ready since before 19 May 2026, with no Ready date).',
  inputs: ['ld_inflow', 'ld_handoff_rows', 'ld_ready'],
  fn: (ld_inflow, ld_handoff_rows, ld_ready) => {
    const DEMO = ['Demo Request', 'Contact Us Email Demo Request'];
    const today = new Date(); const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const bdays = (day) => { const s = Date.parse(String(day).slice(0, 10) + 'T00:00:00Z'); if (Number.isNaN(s)) return 0; let n = 0; for (let t = s + 864e5; t <= t0; t += 864e5) { const w = new Date(t).getUTCDay(); if (w >= 1 && w <= 5) n++; } return n; };
    const m = new Map();
    const get = (src, detail) => {
      const s = src || '(blank)', d = detail || '(blank)', k = s + '|' + d;
      if (!m.has(k)) m.set(k, { key: k, src: s, detail: d, demo: s === 'Inbound' && DEMO.includes(d), created: 0, inQueue: 0, toPerson: 0, autoConverted: 0, merged: 0, errors: 0, readyStamped: 0, handoffs: 0, eligible: 0, within: 0, waitingPastDue: 0, readyNow: 0, over20: 0 });
      return m.get(k);
    };
    for (const r of ld_inflow) {
      const o = get(r.src, r.detail), n = +r.leads || 0;
      o.created += n; o.toPerson += +r.routedToPerson || 0; o.readyStamped += +r.readyStamped || 0;
      if (r.ownerType === 'Queue') o.inQueue += n;
      if (r.routing === 'converted' || r.routing === 'converted - new account') o.autoConverted += n;
      else if (r.routing === 'merged') o.merged += n;
      else if (/^error/i.test(r.routing || '')) o.errors += n;
    }
    for (const r of ld_handoff_rows) {
      const o = get(r.src === '(blank)' ? null : r.src, r.detail === '(blank)' ? null : r.detail);
      o.handoffs += 1;
      if (r.eligible) { o.eligible += 1; if (r.state === 'Within') o.within += 1; if (r.state === 'Waiting past due') o.waitingPastDue += 1; }
    }
    for (const r of ld_ready) {
      const o = get(r.src, r.detail), n = +r.leads || 0;
      o.readyNow += n;
      // over 20 business days, or Ready since before 19 May 2026 (no Ready date, created before the field existed)
      if (r.readyDay ? bdays(r.readyDay) > 20 : String(r.firstCreated || '').slice(0, 10) < '2026-05-19') o.over20 += n;
    }
    return [...m.values()].map((o) => ({ ...o, region: 'All', toPersonShare: o.created ? o.toPerson / o.created : null, autoShare: o.created ? o.autoConverted / o.created : null, rate: o.eligible >= 5 ? o.within / o.eligible : null, due: o.demo ? '1 business day' : '5 business days' }))
      .filter((o) => o.created || o.handoffs || o.readyNow)
      .sort((a, b) => b.created - a.created || b.readyNow - a.readyNow);
  },
});

dash.calc('ld_kpi', {
  title: 'Leads headline',
  description: 'Per team, per manager ("M|<manager>", direct reports) and for all EMEA: hand-off speed of EMEA sellers in the last 30 days (demo requests worked within 1 business day and their median business hours, other hand-offs within 5 business days, scored only) and what was left out; Ready leads now with demo requests waiting 2+ business days and leads waiting over 20 business days; and, for all EMEA only, Ready leads and waiting demo requests held by a queue or by owners outside EMEA sales, and LeanData routing speed at Ready. Needs the hand-off and Ready queries only; routing problems are in ld_kpi_rt and the 30-day inflow in ld_kpi_in.',
  inputs: ['ld_handoff_rows', 'ld_backlog'],
  fn: (ld_handoff_rows, ld_backlog) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const MIN_N = 5;
    const seller = (k) => k === 'EMEA seller' || k === 'Left (inactive)';
    const H = ld_handoff_rows.filter((r) => seller(r.ownerKind)), B = ld_backlog.filter((r) => seller(r.kind));
    const managers = [...new Set([...H, ...B].map((r) => r.manager).filter((x) => x && x !== '(no manager)'))];
    const inScope = (r, key) => (key.startsWith('M|') ? r.manager === key.slice(2) : key === 'All' || r.region === key);
    const sum = (rs, f) => rs.reduce((s, r) => s + (+r[f] || 0), 0);
    const cnt = (rs, f) => rs.filter(f).length;
    const med = (xs) => { const s = xs.slice().sort((a, b) => a[0] - b[0]); if (!s.length) return { v: null, atLeast: false }; const i = Math.ceil(s.length / 2) - 1; return { v: s[i][0] / 60, atLeast: s.some((t, j) => t[1] && j <= i) }; };
    return regions.concat(managers.map((x) => 'M|' + x)).map((key) => {
      const h = H.filter((r) => inScope(r, key)), sc = h.filter((r) => r.cls === 'Scored');
      const hd = sc.filter((r) => r.demo && r.eligible), ot = sc.filter((r) => !r.demo && r.eligible);
      const hm = med(hd.map((r) => [r.bizMin, r.state === 'Waiting past due']));
      const b = B.filter((r) => inScope(r, key));
      const row = {
        region: key,
        handoffs: h.length, last7: cnt(h, (r) => r.ageDays < 7),
        hEligible: hd.length, hWithin: cnt(hd, (r) => r.state === 'Within'), hWaiting: cnt(hd, (r) => r.state === 'Waiting past due'), hPending: cnt(sc, (r) => r.demo && r.state === 'Pending'),
        hRate: hd.length >= MIN_N ? cnt(hd, (r) => r.state === 'Within') / hd.length : null, hMedianHours: hd.length >= MIN_N ? hm.v : null, hMedianAtLeast: hd.length >= MIN_N && hm.atLeast,
        lEligible: ot.length, lWithin: cnt(ot, (r) => r.state === 'Within'), lWaiting: cnt(ot, (r) => r.state === 'Waiting past due'), lPending: cnt(sc, (r) => !r.demo && r.state === 'Pending'),
        lRate: ot.length >= MIN_N ? cnt(ot, (r) => r.state === 'Within') / ot.length : null,
        reReadied: cnt(h, (r) => r.cls === 'Re-readied'), automated: cnt(h, (r) => r.cls === 'Automated'), noStamp: cnt(h, (r) => r.cls === 'No stamp'), notScored: cnt(h, (r) => r.cls === 'SMB, not scored'),
        demoHandoffs: cnt(h, (r) => r.demo), demoSmb: cnt(h, (r) => r.demo && r.role === 'SMB-EMEA'), demoScored: cnt(sc, (r) => r.demo),
        readyNow: sum(b, 'ready'), demoOverdue: sum(b, 'demoOverdue'), b21: sum(b, 'b21'), noDate: sum(b, 'noDate'), stampGap: sum(b, 'stampGap'), stale: sum(b, 'stale'), elsewhere: sum(b, 'elsewhere'),
        leaverReady: sum(b.filter((r) => r.kind === 'Left (inactive)'), 'ready'), oldestDay: b.map((r) => r.oldestDay).filter(Boolean).sort()[0] || null,
      };
      row.leftOut = row.reReadied + row.automated + row.noStamp + row.notScored;
      row.demoWaiting = row.demoOverdue;
      if (key === 'All') {
        const routed = ld_handoff_rows.filter((r) => r.route === 'Routed at Ready'), mins = routed.map((r) => r.routeMin).sort((a, b) => a - b);
        const other = ld_backlog.filter((r) => r.kind === 'Outside EMEA sales'), queues = ld_backlog.filter((r) => r.kind === 'Queue');
        Object.assign(row, {
          queueReady: sum(queues, 'ready'), outsideReady: sum(other, 'ready'), reviewReady: sum(other.filter((r) => r.review), 'ready'),
          // demo requests waiting with a queue or an owner outside EMEA sales: all EMEA only, never added to a team
          otherDemoOverdue: sum(queues, 'demoOverdue') + sum(other, 'demoOverdue'),
          routedAtReady: routed.length, routedFast: cnt(routed, (r) => r.routeMin <= 5), routedFastShare: routed.length ? cnt(routed, (r) => r.routeMin <= 5) / routed.length : null,
          routeMedianMin: mins.length ? mins[Math.ceil(mins.length / 2) - 1] : null, stillInQueue: cnt(ld_handoff_rows, (r) => r.route === 'Still in the queue'),
        });
        row.notSellerReady = row.queueReady + row.outsideReady;
        row.demoWaiting = row.demoOverdue + row.otherDemoOverdue;
      }
      return row;
    });
  },
});

dash.calc('ld_badge', {
  title: 'Demo requests waiting',
  description: 'Demo requests in Ready for 2+ business days, per team, per manager and for all EMEA (where those held by a queue or by owners outside EMEA sales are added). Needs only the Ready query, so the Leads badge and the Home pill don\'t load the rest.',
  inputs: ['ld_backlog'],
  fn: (ld_backlog) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const B = ld_backlog.filter((r) => r.kind === 'EMEA seller' || r.kind === 'Left (inactive)');
    const managers = [...new Set(B.map((r) => r.manager).filter((x) => x && x !== '(no manager)'))];
    const sum = (rs) => rs.reduce((s, r) => s + (+r.demoOverdue || 0), 0);
    return regions.concat(managers.map((x) => 'M|' + x)).map((key) => {
      const own = sum(B.filter((r) => (key.startsWith('M|') ? r.manager === key.slice(2) : key === 'All' || r.region === key)));
      const other = key === 'All' ? sum(ld_backlog.filter((r) => r.kind === 'Queue' || r.kind === 'Outside EMEA sales')) : 0;
      return { region: key, demoWaiting: own + other, demoOverdue: own, otherDemoOverdue: key === 'All' ? other : null };
    });
  },
});

dash.calc('ld_kpi_rt', {
  title: 'Leads headline, routing',
  description: 'Per team, per manager and for all EMEA: open leads stuck in routing (LeanData errors, not processed, Ready or MQL leads in a queue, worked leads back in a queue), how many are urgent, and open EMEA leads held by inactive users or by users outside EMEA sales (strategic and partnership owners counted apart). Queue rows and owners outside EMEA sales count under all EMEA only.',
  inputs: ['ld_problems'],
  fn: (ld_problems) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const P = ld_problems.filter((r) => r.ownerType === 'User' && r.region !== 'Other');
    const managers = [...new Set(P.map((r) => r.manager).filter((x) => x && x !== '(no manager)'))];
    const sum = (rs, f) => rs.reduce((s, r) => s + (+r[f] || 0), 0);
    return regions.concat(managers.map((x) => 'M|' + x)).map((key) => {
      const pr = P.filter((r) => (key.startsWith('M|') ? r.manager === key.slice(2) : key === 'All' || r.region === key))
        .concat(key === 'All' ? ld_problems.filter((r) => r.ownerType === 'Queue' || r.region === 'Other') : []);
      const row = {
        region: key,
        routingIssues: sum(pr.filter((r) => r.routing), 'leads'), routingHigh: sum(pr.filter((r) => r.routing && r.severity === 'high'), 'leads'), errors: sum(pr.filter((r) => r.kind === 'Routing error'), 'leads'),
        inactiveLeads: sum(pr.filter((r) => r.kind === 'Owner inactive'), 'leads'), outsideLeads: sum(pr.filter((r) => r.kind === 'Owner outside EMEA sales'), 'leads'),
        outsideOwners: pr.filter((r) => r.kind === 'Owner outside EMEA sales').length, reviewLeads: sum(pr.filter((r) => r.kind === 'Strategic or partnerships owner'), 'leads'),
      };
      row.wrongOwner = row.inactiveLeads + row.outsideLeads;
      return row;
    });
  },
});

dash.calc('ld_kpi_in', {
  title: 'Leads created, last 30 days',
  description: 'All EMEA: leads in scope created in the last 30 days and where they are now (in a queue, routed to a person, auto-converted to a contact, routing errors), and the demo requests among them.',
  inputs: ['ld_sources'],
  fn: (ld_sources) => {
    const sum = (rs, f) => rs.reduce((s, r) => s + (+r[f] || 0), 0);
    const demo = ld_sources.filter((r) => r.demo);
    return [{ region: 'All', created: sum(ld_sources, 'created'), inQueue: sum(ld_sources, 'inQueue'), toPerson: sum(ld_sources, 'toPerson'), autoConverted: sum(ld_sources, 'autoConverted'),
      routingErrors30: sum(ld_sources, 'errors'), demoCreated: sum(demo, 'created'), demoAuto: sum(demo, 'autoConverted') }];
  },
});

dash.calc('ld_trust', {
  title: 'How far to trust the lead numbers',
  description: 'Checks on the data behind the Leads screen, for all EMEA: hand-offs left out of speed and why; the share of scored exits from Ready within 30 minutes (a jump means automation, not a rep, may be moving leads out of Ready, as it does for SMB); suspected bulk Ready re-stamps; batch Ready days; Ready leads with no Ready Since date; and Ready leads held by EMEA sellers that LeanData routed to another region. The 2,000-row check is ld_trust_cap.',
  inputs: ['ld_handoff_rows', 'ld_backlog'],
  fn: (ld_handoff_rows, ld_backlog) => {
    const out = [];
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
    const S = ld_handoff_rows.filter((r) => r.ownerKind === 'EMEA seller' || r.ownerKind === 'Left (inactive)');
    const c = (k) => S.filter((r) => r.cls === k).length;
    const bad = c('Re-readied') + c('Automated') + c('No stamp');
    out.push({ id: 'leftout', measure: 'Hand-offs left out of speed', value: bad + c('SMB, not scored'), fmt: 'n', detail: c('SMB, not scored') + ' SMB (not scored) · ' + c('Re-readied') + ' answered before this Ready stamp · ' + c('Automated') + ' left Ready within 2 minutes · ' + c('No stamp') + ' left Ready with no stamp · of ' + S.length + ' EMEA-seller hand-offs', severity: S.length && bad / S.length > 0.25 ? 'warn' : 'info' });
    const ex = S.filter((r) => r.cls === 'Scored' && (r.state === 'Within' || r.state === 'Late'));
    const smb = S.filter((r) => r.cls === 'SMB, not scored' && r.exitMin != null);
    const q = ex.filter((r) => r.quickExit).length;
    out.push({ id: 'quick', measure: 'Scored exits within 30 minutes', value: ex.length ? q / ex.length : null, fmt: 'pct', detail: q + ' of ' + ex.length + ' timed exits from Ready (EMEA sellers except SMB); SMB (not scored) ' + pct(smb.filter((r) => r.quickExit).length, smb.length) + '. A jump means automation may be moving leads out of Ready.', severity: ex.length >= 20 && q / ex.length >= 0.5 ? 'warn' : 'info' });
    const days = new Map();
    for (const r of ld_handoff_rows) { const d = days.get(r.readyDay) || { n: 0, re: 0 }; d.n += 1; if (r.respBeforeReady) d.re += 1; days.set(r.readyDay, d); }
    const counts = [...days.values()].map((d) => d.n).sort((a, b) => a - b), medDay = counts.length ? counts[Math.ceil(counts.length / 2) - 1] : 0;
    const big = [...days.entries()].filter(([, d]) => d.n >= 50 && d.n >= 5 * medDay).sort();
    const bulk = big.filter(([, d]) => d.re * 2 >= d.n), batch = big.filter(([, d]) => d.re * 2 < d.n);
    out.push({ id: 'restamp', measure: 'Suspected bulk Ready re-stamps', value: bulk.length, fmt: 'n', detail: bulk.length ? bulk.map(([day, d]) => day + ': ' + d.re + ' of ' + d.n + ' stamps on leads answered before').join(' · ') : 'None in the last 30 days (rule: a UTC day with 50+ Ready stamps, 5× the median day of ' + medDay + ', at least half on leads answered before)', severity: bulk.length ? 'warn' : 'info' });
    out.push({ id: 'batch', measure: 'Batch Ready days (list uploads)', value: batch.length, fmt: 'n', detail: batch.length ? batch.map(([day, d]) => day + ': ' + d.n + ' hand-offs').join(' · ') + ' (median day ' + medDay + '). Batches are mostly event lists, due in 5 business days.' : 'None in the last 30 days', severity: 'info' });
    const B = ld_backlog.filter((r) => r.kind === 'EMEA seller' || r.kind === 'Left (inactive)');
    const gap = B.reduce((s, r) => s + r.stampGap, 0), nod = B.reduce((s, r) => s + r.noDate, 0);
    out.push({ id: 'stamp', measure: 'Ready leads with no Ready Since date', value: gap + nod, fmt: 'n', gap, detail: nod + ' Ready since before 19 May 2026, when the field was added · ' + gap + ' created later with no stamp (age unknown)', severity: gap ? 'warn' : 'info' });
    const ready = B.reduce((s, r) => s + r.ready, 0), els = B.reduce((s, r) => s + r.elsewhere, 0);
    out.push({ id: 'region', measure: 'Ready leads routed to another region', value: els, fmt: 'n', detail: els + ' of ' + ready + ' Ready leads held by EMEA sellers have a LeanData routing region outside EMEA. They count for their owner, as everywhere in the app.', severity: 'info' });
    return out;
  },
});

dash.calc('ld_trust_cap', {
  title: 'Lead data near the 2,000-row limit',
  description: 'Row counts of the four lead queries against the 2,000-row limit of an aggregate answer: amber from 1,600 rows, red at 2,000 (the answer is cut, so totals are too low).',
  inputs: ['ld_ready', 'ld_handoffs', 'ld_inflow', 'ld_open'],
  fn: (ld_ready, ld_handoffs, ld_inflow, ld_open) => {
    const caps = [['Ready now', ld_ready.length], ['Hand-offs', ld_handoffs.length], ['Created', ld_inflow.length], ['Open', ld_open.length]];
    return [{ id: 'cap', measure: 'Lead data near the 2,000-row limit', value: caps.filter(([, n]) => n >= 1600).length, fmt: 'n', detail: caps.map(([k, n]) => k + ' ' + n.toLocaleString('en') + ' rows' + (n >= 2000 ? ' (cut: totals too low)' : '')).join(' · '), severity: caps.some(([, n]) => n >= 2000) ? 'bad' : caps.some(([, n]) => n >= 1600) ? 'warn' : 'info' }];
  },
});

dash.calc('checks_ld', {
  title: 'Data checks, leads',
  description: 'Lead problems to act on from the Ready leads: EMEA sellers with demo requests in Ready for 2+ business days, demo requests waiting that long with a queue or owners outside EMEA sales (all EMEA), sellers with 25 or more Ready leads waiting over 20 business days or Ready since before 19 May 2026, Ready leads held by EMEA sellers that LeanData routed to another region, Ready leads with no Ready Since stamp created after 19 May 2026, and suspected bulk Ready re-stamps. Routing problems are checks_ld_rt and the row cap checks_ld_cap. People who left with an EMEA role are not repeated: checks_lv already lists their leads.',
  inputs: ['ld_backlog', 'ld_trust'],
  fn: (ld_backlog, ld_trust) => {
    const plural = (n, one, many) => n.toLocaleString('en') + ' ' + (n === 1 ? one : many);
    const day = (x) => { if (!/^\d{4}-\d\d-\d\d/.test(String(x))) return String(x); const d = new Date(String(x).slice(0, 10) + 'T00:00:00Z'); return Number.isNaN(+d) ? String(x) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
    const out = [];
    for (const o of ld_backlog) {
      if (o.kind !== 'EMEA seller') continue;
      const base = { area: 'Leads', title: o.owner, person: o.owner, userId: o.ownerId, region: o.region, manager: o.manager, screen: 'leads', view: 'ready' };
      if (o.demoOverdue > 0) out.push({ ...base, id: 'ldd:' + o.key, severity: o.demoOverdue >= 3 ? 'high' : 'medium', what: plural(o.demoOverdue, 'demo request', 'demo requests') + ' in Ready for 2+ business days', meta: o.oldestDemo ? 'oldest Ready since ' + day(o.oldestDemo) : 'no Ready Since date' });
      if (o.stale >= 25) out.push({ ...base, id: 'lds:' + o.key, severity: o.stale >= 100 ? 'medium' : 'low', what: plural(o.stale, 'Ready lead', 'Ready leads') + ' waiting over 20 business days or Ready since before 19 May 2026', meta: [o.elsewhere ? o.elsewhere.toLocaleString('en') + ' routed to another region' : '', 'work, nurture, disqualify or reassign'].filter(Boolean).join(' · ') });
    }
    const all = { area: 'Leads', person: null, region: 'All', manager: null, screen: 'leads' };
    // demo requests waiting with a queue or an owner outside EMEA sales: nobody in EMEA sales will see them
    const other = ld_backlog.filter((o) => (o.kind === 'Queue' || o.kind === 'Outside EMEA sales') && o.demoOverdue > 0);
    if (other.length) {
      const n = other.reduce((s, o) => s + o.demoOverdue, 0);
      out.push({ ...all, id: 'ldx', severity: 'high', title: 'Demo requests outside EMEA sales', what: plural(n, 'demo request', 'demo requests') + ' in Ready for 2+ business days with a queue or owners outside EMEA sales', meta: other.sort((a, b) => b.demoOverdue - a.demoOverdue).slice(0, 3).map((o) => o.owner + ' ' + o.demoOverdue).join(', ') + (other.length > 3 ? ' and ' + (other.length - 3) + ' more' : '') + ' · route or reassign them', view: 'ready' });
    }
    for (const t of ld_trust) {
      if (t.id === 'region' && t.value > 0) out.push({ ...all, id: 'ldt:region', severity: 'low', title: 'Ready leads routed to another region', what: plural(t.value, 'Ready lead', 'Ready leads') + ' held by EMEA sellers are routed outside EMEA by LeanData', meta: 'confirm they belong to EMEA or reassign', view: 'ready' });
      if (t.id === 'stamp' && t.gap > 0) out.push({ ...all, id: 'ldt:stamp', severity: 'low', title: 'Ready with no Ready Since stamp', what: plural(t.gap, 'Ready lead', 'Ready leads') + ' created after 19 May 2026 with no Ready Since stamp', meta: 'their age and speed cannot be measured', view: 'ready' });
      if (t.id === 'restamp' && t.value > 0) out.push({ ...all, id: 'ldt:restamp', severity: 'low', title: 'Bulk Ready re-stamp suspected', what: t.detail, meta: 'left out of speed; backlog ages look younger', view: 'speed', how: ' Read only: find which automation or import re-stamped Ready Since that day, and tell me; change nothing.' });
    }
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.title).localeCompare(String(b.title)));
  },
});

dash.calc('checks_ld_rt', {
  title: 'Data checks, lead routing',
  description: 'Lead routing problems to act on, for all EMEA: Ready leads in a queue, LeanData routing errors, open EMEA leads of inactive users outside EMEA roles, and open EMEA leads of active users outside EMEA sales (strategic and partnership owners left out).',
  inputs: ['ld_problems'],
  fn: (ld_problems) => {
    const plural = (n, one, many) => n.toLocaleString('en') + ' ' + (n === 1 ? one : many);
    const day = (x) => { if (!/^\d{4}-\d\d-\d\d/.test(String(x))) return String(x); const d = new Date(String(x).slice(0, 10) + 'T00:00:00Z'); return Number.isNaN(+d) ? String(x) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
    const out = [];
    const all = { area: 'Leads', person: null, region: 'All', manager: null, screen: 'leads', view: 'routing' };
    for (const q of ld_problems.filter((p) => p.kind === 'Ready in a queue')) {
      out.push({ ...all, id: 'ldq:' + q.ownerKey, severity: 'high', title: 'Ready leads in ' + q.owner, what: plural(q.leads, 'lead', 'leads') + ' marked Ready but routed to nobody', meta: [q.demoRequests ? plural(q.demoRequests, 'demo request', 'demo requests') : '', q.oldestReadyDay ? 'oldest Ready since ' + day(q.oldestReadyDay) : '', q.neverProcessed ? q.neverProcessed.toLocaleString('en') + ' never processed by LeanData' : ''].filter(Boolean).join(' · ') });
    }
    const errs = ld_problems.filter((p) => p.kind === 'Routing error');
    if (errs.length) { const hi = errs.filter((p) => p.severity === 'high'); out.push({ ...all, id: 'lde', severity: hi.length ? 'high' : 'medium', title: 'LeanData routing errors', what: plural(errs.reduce((s, p) => s + p.leads, 0), 'open lead', 'open leads') + ' in LeanData routing error', meta: (hi.length ? hi.reduce((s, p) => s + p.leads, 0).toLocaleString('en') + ' hit this week or Ready · ' : '') + [...new Set(errs.map((p) => p.ldAction))].join(', ') }); }
    const inact = ld_problems.filter((p) => p.kind === 'Owner inactive' && !p.leaver);
    if (inact.length) out.push({ ...all, id: 'ldi', severity: inact.some((p) => p.ready) ? 'high' : 'medium', title: 'Inactive users outside EMEA roles', what: plural(inact.reduce((s, p) => s + p.leads, 0), 'open EMEA lead', 'open EMEA leads') + ' held by ' + plural(inact.length, 'inactive user', 'inactive users'), meta: (inact.reduce((s, p) => s + p.ready, 0) || 'none') + ' Ready · people who left with an EMEA role are under Leavers' });
    const outs = ld_problems.filter((p) => p.kind === 'Owner outside EMEA sales');
    if (outs.length) { const r = outs.reduce((s, p) => s + p.ready, 0); out.push({ ...all, id: 'ldo', severity: r ? 'medium' : 'low', title: 'EMEA leads held outside EMEA sales', what: plural(outs.reduce((s, p) => s + p.leads, 0), 'open EMEA lead', 'open EMEA leads') + ' held by ' + plural(outs.length, 'user', 'users') + ' outside EMEA sales roles', meta: (r ? r.toLocaleString('en') + ' Ready · ' : '') + 'reassign or confirm; strategic and partnership owners left out' }); }
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.title).localeCompare(String(b.title)));
  },
});

dash.calc('checks_ld_cap', {
  title: 'Data checks, lead data cut',
  description: 'A check when a lead query returns exactly 2,000 rows: its answer is cut, so the Leads totals are too low until the window is shortened.',
  inputs: ['ld_trust_cap'],
  fn: (ld_trust_cap) => ld_trust_cap.filter((t) => t.severity === 'bad').map((t) => ({ id: 'ldt:cap', area: 'Leads', severity: 'low', title: 'Lead data cut at 2,000 rows', person: null, region: 'All', manager: null, what: t.detail, meta: 'Leads totals are too low until the window is shortened', screen: 'leads', view: 'speed',
    how: ' Read only: tell me which lead query hit the 2,000-row cap and how short a window would fit; change nothing.' })),
});

// ===================== ACTIVITY =====================
// Emails sent and external meetings of EMEA sellers (act_mail, act_mail_prev, act_meet, act_meet_prev), joined to the roster
// by name. Counts only: no subject, email text, name of a person or company outside Legora, or record Id is read anywhere.

dash.calc('act_reps', {
  title: 'Selling activity per person',
  description: 'One row per EMEA seller: emails sent (captured from their mailbox) and external meetings in the last 4 weeks (28 days to yesterday) and the 4 weeks before, meetings booked for the next 2 weeks, split customer / prospect by the account status today; the change on the 4 weeks before for current sellers whose capture covered both windows; business days since the last email or meeting (Paris calendar, up to the last day the queries read in your Salesforce time zone); and flags. Leaders are shown but never flagged; people in their first 28 days are New. Activity your access can\'t see shows as blank, not zero.',
  inputs: ['act_mail', 'act_mail_prev', 'act_meet', 'act_meet_prev', 'roster', 'sf_me'],
  fn: (act_mail, act_mail_prev, act_meet, act_meet_prev, roster, sf_me) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const kindOf = (role) => (/^AE-EMEA-/.test(role || '') ? 'AE' : role === 'SMB-EMEA' ? 'SMB' : role === 'BDR-EMEA' ? 'BDR' : role === 'EM-EMEA' || role === 'EM-EMEA-LATAM' ? 'EM' : 'Leader');
    const NEW_DAYS = 28, CMP_DAYS = 56, QUIET_BD = 5, QUIET_LONG_BD = 10, GAP_BD = 10, RECENT_BD = 3;
    const SLOW = 0.7, MIN_CORE = 8, MIN_MAIL = 40, BOOK_MIN = 4, OFF_MEET = 4, OFF_MAIL = 40, MIN_PEERS = 5;
    const ts = (x) => { if (!x) return null; const t = Date.parse(String(x).replace(/([+-]\d\d)(\d\d)$/, '$1:$2')); return Number.isNaN(t) ? null : t; };
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
    const dayIn = (f, t) => { const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value])); return Date.UTC(+p.year, +p.month - 1, +p.day) / 864e5; };
    const dayN = (t) => dayIn(fmt, t);
    const dayLbl = (n) => new Date(n * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    // the queries' "yesterday" is in the viewer's Salesforce time zone: never count a Paris day they haven't read yet
    // (a zone behind Paris, such as Los Angeles, is still on the day before until its own midnight)
    let sfFmt;
    try { sfFmt = new Intl.DateTimeFormat('en-GB', { timeZone: (sf_me && sf_me[0] && sf_me[0].timeZone) || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }); }
    catch (e) { sfFmt = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
    const today = Math.min(dayN(Date.now()), dayIn(sfFmt, Date.now()));
    const dateN = (s) => { const t = Date.parse(String(s || '').slice(0, 10) + 'T00:00:00Z'); return Number.isNaN(t) ? null : t / 864e5; };
    // Mon-Fri days after the day of t, up to and including yesterday (Paris calendar, no holidays)
    const idleBd = (t) => { if (t == null) return null; let n = 0; for (let d = dayN(t) + 1; d < today; d++) { const w = new Date(d * 864e5).getUTCDay(); if (w !== 0 && w !== 6) n += 1; } return n; };
    const pct = (xs, p) => { const v = xs.slice().sort((a, b) => a - b); if (!v.length) return null; const i = (v.length - 1) * p, lo = Math.floor(i); return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (i - lo); };
    const drop = (n, p, min) => p >= min && n <= SLOW * p && n <= p - 2 * Math.sqrt(p);
    // roster by name: the active entry wins a shared name
    const ros = new Map();
    for (const u of roster) if (u.name && (!ros.has(u.name) || (ros.get(u.name).isActive === false && u.isActive !== false))) ros.set(u.name, u);
    const m = new Map();
    const get = (name, role) => {
      if (!m.has(name)) m.set(name, { name, role: role || null, emails: 0, emailsCust: 0, emailsPros: 0, people: 0, accounts: 0, custEmailed: 0, lastMail: null,
        emailsPrev: 0, emailsCustPrev: 0, emailsProsPrev: 0, peoplePrev: 0, firstMailPrev: null, lastMailPrev: null,
        events: 0, meetings: 0, meetCust: 0, meetPros: 0, accountsMet: 0, custMet: 0, peopleMet: 0, lastMeet: null,
        booked: 0, bookedCust: 0, bookedPros: 0, nextMeet: null,
        eventsPrev: 0, meetPrev: 0, meetCustPrev: 0, meetProsPrev: 0, firstMeetPrev: null, lastMeetPrev: null });
      const o = m.get(name);
      if (!o.role && role) o.role = role;
      return o;
    };
    const mx = (a, b) => (a == null ? b : b == null ? a : Math.max(a, b));
    const mn = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));
    for (const r of act_mail) {
      if (!r.owner) continue;
      const o = get(r.owner, r.role), n = +r.emails || 0, cust = r.acct === 'Customer';
      o.emails += n; if (cust) { o.emailsCust += n; o.custEmailed += +r.accounts || 0; } else o.emailsPros += n;
      o.people += +r.people || 0; o.accounts += +r.accounts || 0; o.lastMail = mx(o.lastMail, ts(r.lastAt));
    }
    for (const r of act_mail_prev) {
      if (!r.owner) continue;
      const o = get(r.owner, r.role), n = +r.emails || 0;
      o.emailsPrev += n; if (r.acct === 'Customer') o.emailsCustPrev += n; else o.emailsProsPrev += n;
      o.peoplePrev += +r.people || 0; o.firstMailPrev = mn(o.firstMailPrev, ts(r.firstAt)); o.lastMailPrev = mx(o.lastMailPrev, ts(r.lastAt));
    }
    const now = Date.now();
    for (const r of act_meet) {
      if (!r.owner) continue;
      const o = get(r.owner, r.role), n = +r.meetings || 0, cust = r.acct === 'Customer';
      const past = r.past === true || (r.past !== false && (ts(r.lastAt) || 0) < now);
      if (past) {
        o.events += +r.events || 0; o.meetings += n; if (cust) { o.meetCust += n; o.custMet += +r.accounts || 0; } else o.meetPros += n;
        o.accountsMet += +r.accounts || 0; o.peopleMet += +r.people || 0; o.lastMeet = mx(o.lastMeet, ts(r.lastAt));
      } else {
        o.booked += n; if (cust) o.bookedCust += n; else o.bookedPros += n; o.nextMeet = mn(o.nextMeet, ts(r.firstAt));
      }
    }
    for (const r of act_meet_prev) {
      if (!r.owner) continue;
      const o = get(r.owner, r.role), n = +r.meetings || 0;
      o.eventsPrev += +r.events || 0; o.meetPrev += n; if (r.acct === 'Customer') o.meetCustPrev += n; else o.meetProsPrev += n;
      o.firstMeetPrev = mn(o.firstMeetPrev, ts(r.firstAt)); o.lastMeetPrev = mx(o.lastMeetPrev, ts(r.lastAt));
    }
    // every active roster seller gets a row, even with nothing captured
    for (const u of ros.values()) if (u.isActive !== false && kindOf(u.role) !== 'Leader' && TEAM[u.role]) get(u.name, u.role);
    const rows = [...m.values()].map((o) => {
      const u = ros.get(o.name) || {};
      const role = o.role || u.role || null, kind = kindOf(role);
      const sd = dateN(u.startDate), cd = dateN(u.createdDate);
      const since = [sd, cd].filter((x) => x != null);
      const tenure = since.length ? today - Math.max(...since) : null; // the later of Legora start and Salesforce user creation
      const coreLabel = kind === 'EM' ? 'customer' : kind === 'BDR' ? 'prospect' : 'external';
      const core = (c, p, all) => (kind === 'EM' ? c : kind === 'BDR' ? p : all);
      const coreNow = core(o.meetCust, o.meetPros, o.meetings), corePrev = core(o.meetCustPrev, o.meetProsPrev, o.meetPrev);
      const early = today - 49; // the first week of the earlier window (it starts 56 days ago)
      const cmpMail = tenure != null && tenure >= CMP_DAYS && o.emailsPrev > 0 && o.firstMailPrev != null && dayN(o.firstMailPrev) <= early;
      const cmpMeet = tenure != null && tenure >= CMP_DAYS && o.meetPrev > 0 && o.firstMeetPrev != null && dayN(o.firstMeetPrev) <= early;
      const chg = (a, b, ok) => (ok && b > 0 ? (a - b) / b : null);
      const lastTouch = mx(o.lastMail, o.lastMeet), lastEver = mx(lastTouch, mx(o.lastMailPrev, o.lastMeetPrev));
      const firsts = [o.firstMailPrev, o.firstMeetPrev].filter((x) => x != null).map(dayN);
      const trendNote = cmpMail || cmpMeet ? ''
        : tenure != null && tenure < CMP_DAYS ? (tenure <= 0 ? 'just joined' : 'joined ' + (tenure < 14 ? tenure + (tenure === 1 ? ' day' : ' days') : Math.floor(tenure / 7) + ' weeks') + ' ago')
        : !o.emailsPrev && !o.meetPrev ? 'nothing captured in the 4 weeks before'
        : tenure == null ? 'no start date in Salesforce'
        : firsts.length ? 'capture started ' + dayLbl(Math.min(...firsts)) : 'capture didn\'t cover the 4 weeks before';
      return { ...o, role, kind, userId: u.userId || null, region: TEAM[role] || 'Other', manager: u.manager || '(no manager)', active: u.isActive !== false && !!TEAM[role], inRoster: !!u.name,
        joined: u.startDate || u.createdDate || null, tenure, isNew: tenure != null && tenure < NEW_DAYS,
        emailsWk: o.emails / 4, meetWk: o.meetings / 4, custMeetWk: o.meetCust / 4, prosMeetWk: o.meetPros / 4,
        coreLabel, coreNow, corePrev, coreWk: coreNow / 4, cmpMail, cmpMeet,
        emailsChg: chg(o.emails, o.emailsPrev, cmpMail), meetChg: chg(o.meetings, o.meetPrev, cmpMeet), coreChg: chg(coreNow, corePrev, cmpMeet),
        dupes: o.events - o.meetings, lastTouch, lastEver, idle: idleBd(lastTouch), idleMail: idleBd(o.lastMail), idleMeet: idleBd(o.lastMeet), trendNote };
    });
    // what the viewer's access lets them see
    const sellers = rows.filter((r) => r.active && r.kind !== 'Leader' && !(r.tenure != null && r.tenure < NEW_DAYS));
    const anySeen = sellers.filter((r) => r.emails || r.meetings || r.emailsPrev || r.meetPrev).length;
    const limited = sellers.length >= 10 && anySeen < sellers.length / 2;
    const withMeet = sellers.filter((r) => r.meetings >= OFF_MEET), withMail = sellers.filter((r) => r.emails >= OFF_MAIL);
    const mailHidden = !limited && withMeet.length >= 10 && withMeet.filter((r) => r.emails > 0).length < withMeet.length / 2;
    const meetHidden = !limited && withMail.length >= 10 && withMail.filter((r) => r.meetings > 0).length < withMail.length / 2;
    // usual range per role: core meetings a week among active sellers past 28 days with something captured (none when meetings are hidden)
    const p25 = new Map();
    for (const k of ['AE', 'SMB', 'BDR', 'EM']) {
      const xs = sellers.filter((r) => r.kind === k && (r.emails || r.meetings)).map((r) => r.coreWk);
      p25.set(k, !meetHidden && xs.length >= MIN_PEERS ? { lo: pct(xs, 0.25), med: pct(xs, 0.5), hi: pct(xs, 0.75), n: xs.length } : null);
    }
    const RANK = ['No capture', 'Quiet', 'Slowing', 'Nothing booked', 'Below range', 'Capture gap'];
    return rows.map((r) => {
      const flags = [];
      let status, trigger = null, mailOff = false, calOff = false, quietSev = null;
      const rg = p25.get(r.kind) || null;
      if (!r.active) status = 'Left';
      else if (r.kind === 'Leader') status = 'Leader';
      else if (limited && !r.emails && !r.meetings && !r.emailsPrev && !r.meetPrev) status = 'Not visible';
      else if (r.isNew) status = 'New';
      else {
        const seenMail = !mailHidden, seenMeet = !meetHidden;
        const tenured = r.tenure == null || r.tenure >= NEW_DAYS;
        mailOff = seenMail && tenured && r.meetings >= OFF_MEET && (r.emails === 0 || (r.idleMail != null && r.idleMail >= GAP_BD && r.idleMeet != null && r.idleMeet <= RECENT_BD));
        calOff = seenMeet && tenured && r.kind !== 'BDR' && r.emails >= OFF_MAIL && (r.meetings === 0 ? true : r.idleMeet != null && r.idleMeet >= GAP_BD && r.idleMail != null && r.idleMail <= RECENT_BD && r.meetPrev >= OFF_MEET);
        const nothing = (r.emails === 0 || !seenMail) && (r.meetings === 0 || !seenMeet) && (seenMail || seenMeet);
        if (nothing) flags.push('No capture');
        else {
          // quiet needs both channels: with one hidden by the viewer's access, the other alone isn't silence
          if (seenMail && seenMeet && r.idle != null && r.idle >= QUIET_BD) { flags.push('Quiet'); quietSev = r.idle >= QUIET_LONG_BD ? 'high' : 'medium'; }
          if (seenMeet && !calOff && r.cmpMeet && drop(r.coreNow, r.corePrev, MIN_CORE)) { flags.push('Slowing'); trigger = 'meetings'; }
          else if (r.kind === 'BDR' && seenMail && !mailOff && r.cmpMail && drop(r.emails, r.emailsPrev, MIN_MAIL)) { flags.push('Slowing'); trigger = 'emails'; }
          if (seenMeet && !calOff && (r.kind === 'EM' ? r.bookedCust === 0 && r.meetCust >= BOOK_MIN : r.bookedPros === 0 && r.meetPros >= BOOK_MIN)) flags.push('Nothing booked');
          if (seenMeet && !calOff && rg && r.cmpMeet && r.coreWk < rg.lo && r.corePrev / 4 < rg.lo) flags.push('Below range');
          if (mailOff || calOff) flags.push('Capture gap');
        }
        status = flags.length ? flags.slice().sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0] : 'Active';
      }
      // like-for-like only for current sellers whose capture covers the last 4 weeks too, on a channel the viewer can see
      const capOk = !flags.includes('No capture');
      const cmpMeet = r.cmpMeet && r.active && !meetHidden && !calOff && capOk, cmpMail = r.cmpMail && r.active && !mailHidden && !mailOff && capOk;
      const lost = (r.cmpMeet || r.cmpMail) && !cmpMeet && !cmpMail;
      const blind = status === 'Not visible';
      const trendNote = blind ? 'not visible with your access' : !lost ? r.trendNote : !r.active ? 'left' : !capOk ? 'nothing captured in the last 4 weeks' : mailOff || calOff ? 'capture looks off in the last 4 weeks' : 'not visible with your access';
      // what the viewer's access can't see is blank, not zero: a hidden channel, or a seller whose activity is all hidden.
      // The last touch then comes from the channel that can be seen.
      const noMail = mailHidden || blind, noMeet = meetHidden || blind;
      const hide = (on, fs) => (on ? Object.fromEntries(fs.map((f) => [f, null])) : {});
      return { ...r, ...hide(noMail, ['emails', 'emailsCust', 'emailsPros', 'emailsWk', 'people', 'accounts', 'custEmailed', 'lastMail', 'idleMail', 'emailsPrev', 'emailsCustPrev', 'emailsProsPrev', 'peoplePrev', 'firstMailPrev', 'lastMailPrev']),
        ...hide(noMeet, ['events', 'meetings', 'meetCust', 'meetPros', 'meetWk', 'custMeetWk', 'prosMeetWk', 'accountsMet', 'custMet', 'peopleMet', 'booked', 'bookedCust', 'bookedPros', 'nextMeet', 'lastMeet', 'idleMeet', 'coreNow', 'coreWk', 'dupes',
          'eventsPrev', 'meetPrev', 'meetCustPrev', 'meetProsPrev', 'firstMeetPrev', 'lastMeetPrev', 'corePrev']),
        lastTouch: blind ? null : mailHidden ? r.lastMeet : meetHidden ? r.lastMail : r.lastTouch, idle: blind ? null : mailHidden ? r.idleMeet : meetHidden ? r.idleMail : r.idle,
        cmpMeet, cmpMail, meetChg: cmpMeet ? r.meetChg : null, coreChg: cmpMeet ? r.coreChg : null, emailsChg: cmpMail ? r.emailsChg : null, trendNote,
        flags, status, trigger, quietSev, mailOff, calOff, rangeLo: rg ? rg.lo : null, rangeMed: rg ? rg.med : null, rangeHi: rg ? rg.hi : null, rangeN: rg ? rg.n : 0,
        limited, mailHidden, meetHidden, visibleSellers: anySeen, sellers: sellers.length,
        rank: ['Quiet', 'Slowing', 'Nothing booked', 'Below range', 'No capture', 'Capture gap', 'Active', 'New', 'Leader', 'Not visible', 'Left'].indexOf(status) };
    }).filter((r) => r.active || r.emails || r.meetings || r.booked || r.emailsPrev || r.meetPrev)
      .sort((a, b) => a.rank - b.rank || (a.coreWk || 0) - (b.coreWk || 0) || String(a.name).localeCompare(String(b.name)));
  },
});

dash.calc('act_ranges', {
  title: 'Usual activity by role',
  description: 'For AEs, SMB, BDRs and Engagement Managers, all EMEA: the middle half (25th to 75th percentile) and median of meetings, the role\'s meetings (customer for Engagement Managers, prospect for BDRs, all external for AEs and SMB) and emails a week, and people emailed in 4 weeks, over active sellers past their first 28 days with something captured. It describes what peers do, not a target.',
  inputs: ['act_reps'],
  fn: (act_reps) => {
    const pct = (xs, p) => { const v = xs.slice().sort((a, b) => a - b); if (!v.length) return null; const i = (v.length - 1) * p, lo = Math.floor(i); return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (i - lo); };
    const LABEL = { AE: 'AEs', SMB: 'SMB', BDR: 'BDRs', EM: 'Engagement Managers' };
    const CORE = { AE: 'all external meetings', SMB: 'all external meetings', BDR: 'prospect meetings', EM: 'customer meetings' };
    return ['AE', 'SMB', 'BDR', 'EM'].map((kind) => {
      const rs = act_reps.filter((r) => r.kind === kind && r.active && !r.isNew && !['No capture', 'Not visible'].includes(r.status) && (r.emails || r.meetings));
      const o = { kind, label: LABEL[kind], coreLabel: CORE[kind], n: rs.length };
      for (const f of ['coreWk', 'meetWk', 'custMeetWk', 'prosMeetWk', 'emailsWk', 'people']) {
        const xs = rs.map((r) => r[f]).filter((x) => x != null);
        o[f + '25'] = xs.length >= 5 ? pct(xs, 0.25) : null; o[f + 'Med'] = xs.length >= 5 ? pct(xs, 0.5) : null; o[f + '75'] = xs.length >= 5 ? pct(xs, 0.75) : null;
      }
      return o;
    });
  },
});

dash.calc('act_kpi', {
  title: 'Selling activity headline',
  description: 'Per team, per manager ("M|<manager>", direct reports) and for all EMEA: external meetings and emails sent in the last 4 weeks (customer / prospect), meetings booked for the next 2 weeks, meetings and emails per seller a week, the like-for-like change on the 4 weeks before (only current sellers whose capture covered both windows, with how many were compared), how many sellers are quiet, slowing, have nothing booked, are below the usual range or have nothing captured, and for how many sellers your access shows no activity at all. A channel your access hides is blank.',
  inputs: ['act_reps'],
  fn: (act_reps) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(act_reps.map((r) => r.manager).filter((x) => x && x !== '(no manager)'))];
    const sum = (rs, f) => rs.reduce((s, r) => s + (+r[f] || 0), 0);
    const g = act_reps[0] || {};
    return regions.concat(managers.map((x) => 'M|' + x)).map((region) => {
      const rs = act_reps.filter((r) => (region.startsWith('M|') ? r.manager === region.slice(2) : region === 'All' || r.region === region));
      const sel = rs.filter((r) => r.active && r.kind !== 'Leader');
      const cap = sel.filter((r) => !r.isNew && (r.emails || r.meetings));
      const lm = rs.filter((r) => r.cmpMeet), le = rs.filter((r) => r.cmpMail);
      const pm = sum(lm, 'meetPrev'), pe = sum(le, 'emailsPrev');
      const has = (f) => sel.filter((r) => r.flags.includes(f)).length;
      const o = { region, sellers: sel.length, captured: cap.length, newSellers: sel.filter((r) => r.isNew).length };
      for (const f of ['meetings', 'meetCust', 'meetPros', 'events', 'booked', 'bookedCust', 'bookedPros', 'emails', 'emailsCust', 'emailsPros', 'people', 'accounts', 'custMet', 'meetPrev', 'emailsPrev']) o[f] = sum(rs, f);
      Object.assign(o, {
        meetWk: o.meetings / 4, emailsWk: g.mailHidden ? null : o.emails / 4, custShare: o.meetings ? o.meetCust / o.meetings : null,
        meetPerSellerWk: cap.length ? sum(cap, 'meetings') / cap.length / 4 : null, emailsPerSellerWk: cap.length && !g.mailHidden ? sum(cap, 'emails') / cap.length / 4 : null,
        lflMeetReps: lm.length, meetChg: pm >= 20 ? (sum(lm, 'meetings') - pm) / pm : null,
        lflMailReps: le.length, emailsChg: !g.mailHidden && pe >= 200 ? (sum(le, 'emails') - pe) / pe : null,
        notCompared: rs.filter((r) => (r.emails || r.meetings) && !r.cmpMeet && !r.cmpMail).length,
        quiet: has('Quiet'), quietLong: sel.filter((r) => r.quietSev === 'high').length, slowing: has('Slowing'), nothingBooked: has('Nothing booked'),
        belowRange: has('Below range'), noCapture: has('No capture'), captureGap: has('Capture gap'),
        needLook: sel.filter((r) => r.flags.some((f) => ['Quiet', 'Slowing', 'Nothing booked', 'Below range'].includes(f))).length,
        limited: !!g.limited, mailHidden: !!g.mailHidden, meetHidden: !!g.meetHidden, notVisible: sel.filter((r) => r.status === 'Not visible').length,
      });
      o.badge = o.needLook;
      o.checkCapture = o.noCapture + o.captureGap;
      // a channel the viewer's access hides is blank, not zero
      if (g.mailHidden) for (const f of ['emails', 'emailsCust', 'emailsPros', 'people', 'accounts', 'emailsPrev']) o[f] = null;
      if (g.meetHidden) for (const f of ['meetings', 'meetCust', 'meetPros', 'events', 'booked', 'bookedCust', 'bookedPros', 'custMet', 'meetPrev', 'meetWk', 'custShare', 'meetPerSellerWk', 'meetChg']) o[f] = null;
      return o;
    });
  },
});

dash.calc('act_trust', {
  title: 'How far to trust the activity numbers',
  description: 'All EMEA checks on the data behind activity: duplicate calendar records removed, people left out of the change on the 4 weeks before and why, sellers with nothing captured or a capture gap, what the viewer\'s access hides, and the row counts of the four activity queries against the 2,000-row limit (amber from 1,600, red at 2,000: the answer is cut).',
  inputs: ['act_reps', 'act_mail', 'act_mail_prev', 'act_meet', 'act_meet_prev'],
  fn: (act_reps, act_mail, act_mail_prev, act_meet, act_meet_prev) => {
    const num = (n) => Math.round(n).toLocaleString('en');
    const out = [];
    const past = act_meet.filter((r) => r.past !== false);
    const ev = past.reduce((s, r) => s + (+r.events || 0), 0), mt = past.reduce((s, r) => s + (+r.meetings || 0), 0);
    out.push({ id: 'dupes', measure: 'Duplicate calendar records removed', value: ev - mt, fmt: 'n', detail: num(ev - mt) + ' of ' + num(ev) + ' calendar records in the last 4 weeks repeat a meeting at the same start for the same person (calendar sync, Outreach, LeanData BookIt or an invite copy); each counts once. Repeats are found within one account status, so copies of a meeting on records with different statuses (say a BookIt copy on a lead and a calendar copy on a contact) still count once each: about 1–2% of meetings.', severity: ev && (ev - mt) / ev > 0.15 ? 'warn' : 'info' });
    const live = act_reps.filter((r) => r.active && (r.emails || r.meetings));
    const notCmp = live.filter((r) => !r.cmpMeet && !r.cmpMail);
    const joined = notCmp.filter((r) => r.tenure != null && r.tenure < 56).length;
    const offNow = notCmp.filter((r) => !(r.tenure != null && r.tenure < 56) && (r.mailOff || r.calOff)).length;
    out.push({ id: 'lfl', measure: 'Left out of the change on the 4 weeks before', value: notCmp.length, fmt: 'n', detail: num(joined) + ' joined in the last 8 weeks · ' + (offNow ? num(offNow) + ' with capture that looks off in the last 4 weeks · ' : '') + num(notCmp.length - joined - offNow) + ' had no capture in the first week of the earlier window or no start date · ' + num(live.length - notCmp.length) + ' compared. People who left are never compared. Mailbox and calendar capture were switched on for most sellers between May and October 2026, so longer comparisons measure the rollout, not selling.', severity: 'info' });
    const sel = act_reps.filter((r) => r.active && r.kind !== 'Leader');
    const g = act_reps[0] || {};
    const nc = sel.filter((r) => r.flags.includes('No capture')).length, gap = sel.filter((r) => r.flags.includes('Capture gap')).length;
    out.push({ id: 'capture', measure: 'Sellers with nothing captured or a capture gap', value: nc + gap, fmt: 'n', detail: num(nc) + (g.mailHidden ? ' with no meeting captured in 4 weeks (emails not visible with your access)' : g.meetHidden ? ' with no sent email captured in 4 weeks (meetings not visible with your access)' : ' with no sent email and no meeting captured in 4 weeks') + ' · ' + num(gap) + ' with mailbox or calendar capture that looks off. Their numbers read low for data reasons; see Data checks.', severity: nc + gap ? 'warn' : 'info' });
    out.push({ id: 'access', measure: 'Hidden by your access', value: g.limited || g.mailHidden || g.meetHidden ? 1 : 0, fmt: 'n', detail: g.limited ? 'Your Salesforce access shows activity for ' + num(g.visibleSellers) + ' of ' + num(g.sellers) + ' sellers; the others show Not visible.' : g.mailHidden ? 'Your access shows meetings but almost no captured emails, so emails show — and no one is flagged Quiet.' : g.meetHidden ? 'Your access shows emails but almost no meetings, so meetings show — and only email-based flags remain.' : 'Your access shows activity for ' + num(g.visibleSellers || 0) + ' of ' + num(g.sellers || 0) + ' sellers past their first 28 days.', severity: g.limited || g.mailHidden || g.meetHidden ? 'warn' : 'info' });
    // held and booked meetings are told apart by Activity_in_Past__c (start before now): check the split still holds
    const tsx = (x) => { const t = Date.parse(String(x || '').replace(/([+-]\d\d)(\d\d)$/, '$1:$2')); return Number.isNaN(t) ? null : t; };
    const nowT = Date.now();
    const badPast = act_meet.filter((r) => r.past === true && tsx(r.lastAt) != null && tsx(r.lastAt) > nowT).length;
    const badBooked = act_meet.filter((r) => r.past === false && tsx(r.firstAt) != null && tsx(r.firstAt) < nowT).length;
    out.push({ id: 'window', measure: 'Held and booked meetings kept apart', value: badPast + badBooked, fmt: 'n', detail: badPast + badBooked ? (badPast + badBooked) + ' rows mix held and booked meetings: the Activity in Past field may have changed, so held and booked counts are mixed up.' : 'Held meetings all started before today and booked ones start from tomorrow.', severity: badPast + badBooked ? 'bad' : 'info' });
    const caps = [['Emails', act_mail.length], ['Emails before', act_mail_prev.length], ['Meetings', act_meet.length], ['Meetings before', act_meet_prev.length]];
    out.push({ id: 'cap', measure: 'Activity data near the 2,000-row limit', value: caps.filter(([, n]) => n >= 1600).length, fmt: 'n', detail: caps.map(([k, n]) => k + ' ' + num(n) + ' rows' + (n >= 2000 ? ' (cut: totals too low)' : '')).join(' · '), severity: caps.some(([, n]) => n >= 2000) ? 'bad' : caps.some(([, n]) => n >= 1600) ? 'warn' : 'info' });
    return out;
  },
});

dash.calc('team_act', {
  title: 'Selling activity per team',
  description: 'For each person in team_tree, their whole team (them and everyone below them in the Salesforce manager chain): external meetings in the last 4 weeks (customer / prospect), booked for the next 2 weeks, emails sent, meetings per seller a week, the like-for-like change in meetings on the 4 weeks before, and how many people are quiet, slowing or have nothing booked. Blank for a team with sellers your access shows no activity for (and meetings blank when your access hides meetings), rather than a partial total. Its own calc, so the scorecard still loads when activity can\'t be read.',
  inputs: ['team_tree', 'act_reps'],
  fn: (team_tree, act_reps) => {
    const kids = new Map();
    for (const t of team_tree) if (t.manager) { if (!kids.has(t.manager)) kids.set(t.manager, []); kids.get(t.manager).push(t.name); }
    const by = new Map(act_reps.map((r) => [r.name, r]));
    const g = act_reps[0] || {};
    return team_tree.map((t) => {
      const s = new Set([t.name]); const q = [t.name];
      while (q.length) for (const k of kids.get(q.shift()) || []) if (!s.has(k)) { s.add(k); q.push(k); }
      const rs = [...s].map((n) => by.get(n)).filter(Boolean);
      const sum = (rr, f) => rr.reduce((a, r) => a + (+r[f] || 0), 0);
      const cap = rs.filter((r) => r.active && r.kind !== 'Leader' && !r.isNew && (r.emails || r.meetings));
      const lm = rs.filter((r) => r.cmpMeet), pm = sum(lm, 'meetPrev');
      const has = (f) => rs.filter((r) => r.active && r.flags.includes(f)).length;
      const o = { name: t.name, actMeetings: sum(rs, 'meetings'), actMeetCust: sum(rs, 'meetCust'), actMeetPros: sum(rs, 'meetPros'), actBooked: sum(rs, 'booked'), actBookedPros: sum(rs, 'bookedPros'),
        actEmails: g.mailHidden ? null : sum(rs, 'emails'), actMeetPerSellerWk: cap.length ? sum(cap, 'meetings') / cap.length / 4 : null,
        actMeetChg: pm >= 20 ? (sum(lm, 'meetings') - pm) / pm : null, actCompared: lm.length,
        actQuiet: has('Quiet'), actSlowing: has('Slowing'), actNothingBooked: has('Nothing booked'), actNoCapture: has('No capture'),
        actHidden: rs.filter((r) => r.status === 'Not visible').length };
      o.actFlags = o.actQuiet + o.actSlowing + o.actNothingBooked;
      // blank rather than a partial total: a team with sellers whose activity the viewer's access hides, or meetings hidden
      const blank = (fs) => { for (const f of fs) o[f] = null; };
      if (o.actHidden) blank(['actMeetings', 'actMeetCust', 'actMeetPros', 'actBooked', 'actBookedPros', 'actEmails', 'actMeetPerSellerWk', 'actMeetChg', 'actCompared', 'actQuiet', 'actSlowing', 'actNothingBooked', 'actNoCapture', 'actFlags']);
      else if (g.meetHidden) blank(['actMeetings', 'actMeetCust', 'actMeetPros', 'actBooked', 'actBookedPros', 'actMeetPerSellerWk', 'actMeetChg', 'actCompared', 'actFlags']);
      return o;
    });
  },
});

dash.calc('act_bdr', {
  title: 'BDR activity and sourcing',
  description: 'Per EMEA BDR (BDR-EMEA and DIR-BDR-EMEA): people and accounts emailed and emails sent in the last 4 weeks, prospect meetings held in the last 4 weeks and booked for the next 2, the like-for-like change on the 4 weeks before, prospect meetings per 100 people emailed (same 4 weeks, from 50 people emailed), and opportunities sourced this quarter and last (Originating BDR, as on Created opps). The activity window and the sourcing quarter differ, so no ratio mixes them.',
  inputs: ['act_reps', 'cr_bdrs'],
  fn: (act_reps, cr_bdrs) => {
    const src = new Map(cr_bdrs.map((b) => [b.bdr, b]));
    const rows = act_reps.filter((r) => r.role === 'BDR-EMEA' || r.role === 'DIR-BDR-EMEA');
    // a sourcing BDR with no BDR activity row: in another EMEA role now, or not in activity at all. No activity numbers
    // either way, so the BDR tiles stay BDR-only.
    for (const b of cr_bdrs) {
      if (rows.some((r) => r.name === b.bdr)) continue;
      const o = act_reps.find((r) => r.name === b.bdr);
      rows.push({ name: b.bdr, userId: o ? o.userId : null, role: o ? o.role : null, manager: o ? o.manager : b.manager, active: false, stub: true,
        status: o && o.active ? 'Now ' + (o.kind === 'EM' ? 'Engagement' : o.kind === 'Leader' ? 'a leader' : o.kind) : 'Not in activity', flags: [] });
    }
    const v = (x) => (x == null ? null : x);
    const g = act_reps[0] || {};
    return rows.map((r) => {
      const b = src.get(r.name) || {};
      const pc = r.cmpMeet && r.meetProsPrev > 0 ? (r.meetPros - r.meetProsPrev) / r.meetProsPrev : null;
      return { name: r.name, userId: r.userId || null, role: r.role, manager: r.manager, active: r.active, status: r.status, flags: r.flags || [], isNew: !!r.isNew,
        mailHidden: !!g.mailHidden, meetHidden: !!g.meetHidden, emails: v(r.emails), emailsWk: v(r.emailsWk), people: v(r.people), accounts: v(r.accounts), emailsChg: v(r.emailsChg), emailsPrev: r.emailsChg != null ? v(r.emailsPrev) : null,
        meetPros: v(r.meetPros), meetProsPrev: v(r.meetProsPrev), prosChg: pc, bookedPros: v(r.bookedPros), meetings: v(r.meetings),
        meetPer100: r.people != null && r.people >= 50 && r.meetPros != null ? r.meetPros / r.people * 100 : null, idle: v(r.idle), lastTouch: v(r.lastTouch),
        thisOpps: +b.thisOpps || 0, thisArr: +b.thisArr || 0, lastOpps: +b.lastOpps || 0, lastArr: +b.lastArr || 0 };
    }).sort((a, b) => b.thisOpps - a.thisOpps || (b.people || 0) - (a.people || 0));
  },
});

dash.calc('checks_act', {
  title: 'Data checks, activity',
  description: 'Activity capture problems to fix before reading the numbers: active sellers with no sent email and no meeting captured in 4 weeks, sellers whose mailbox or calendar capture looks off, activity your access hides, and an activity query cut at 2,000 rows. Leaders are left out.',
  inputs: ['act_reps', 'act_trust'],
  fn: (act_reps, act_trust) => {
    const day = (t) => (t == null ? '' : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }));
    const g = act_reps[0] || {};
    // with one channel hidden by the viewer's access, say only what can be seen
    const none = g.mailHidden ? 'No external meeting captured in 4 weeks (emails not visible with your access)' : g.meetHidden ? 'No sent email captured in 4 weeks (meetings not visible with your access)' : 'No sent email or external meeting captured in 4 weeks';
    const out = [];
    for (const r of act_reps) {
      if (!r.active || r.kind === 'Leader') continue;
      const base = { area: 'Activity', title: r.name, person: r.name, userId: r.userId, region: r.region, manager: r.manager, screen: 'oneonone', view: 'activity' };
      if (r.flags.includes('No capture')) out.push({ ...base, id: 'act:none:' + r.name, severity: r.tenure == null || r.tenure >= 56 ? 'medium' : 'low', what: none,
        meta: (r.lastEver ? 'last captured ' + day(r.lastEver) : 'nothing captured in 8 weeks') + ' · mailbox and calendar capture may be off, or they were away',
        how: ' Count their captured sent emails and external calendar events per week over the last 12 weeks and tell me when capture stopped or whether it ever started. If it looks off, draft a short note to RevOps with the facts.' });
      if (r.mailOff) out.push({ ...base, id: 'act:mail:' + r.name, severity: 'low', what: r.emails === 0 ? r.meetings + ' meetings but no sent email captured in 4 weeks' : 'No sent email captured since ' + day(r.lastMail) + ' while meetings continue',
        meta: 'mailbox capture (Einstein Activity Capture) looks off, so their emails read low', how: ' Count their captured sent emails per week over the last 8 weeks and tell me when mailbox capture stopped.' });
      if (r.calOff) out.push({ ...base, id: 'act:cal:' + r.name, severity: 'low', what: r.meetings === 0 ? r.emails + ' emails sent but no external meeting captured in 4 weeks' : 'No external meeting captured since ' + day(r.lastMeet) + ' while emails continue',
        meta: 'calendar capture looks off, so their meetings read low', how: ' Count their external calendar events per week over the last 8 weeks and tell me when calendar capture stopped.' });
    }
    const all = { area: 'Activity', person: null, region: 'All', manager: null, screen: 'oneonone', view: 'activity' };
    const acc = act_trust.find((t) => t.id === 'access');
    if (acc && acc.value) out.push({ ...all, id: 'act:vis', severity: 'medium', title: 'Activity hidden by your access', what: acc.detail, meta: 'activity follows Salesforce sharing; ask RevOps before reading these numbers', how: ' Count, per EMEA seller, the sent emails and external meetings my Salesforce access can read for the last 4 weeks, and tell me which sharing or permission setting would hide the rest, so I can ask RevOps.' });
    const win = act_trust.find((t) => t.id === 'window');
    if (win && win.value) out.push({ ...all, id: 'act:win', severity: 'low', title: 'Held and booked meetings mixed up', what: win.detail, meta: 'ask RevOps whether the Activity in Past field changed', how: ' Tell me how the Activity in Past field on Event is defined now and whether held and booked meetings can still be told apart.' });
    const cap = act_trust.find((t) => t.id === 'cap');
    if (cap && cap.severity === 'bad') out.push({ ...all, id: 'act:cap', severity: 'low', title: 'Activity data cut at 2,000 rows', what: cap.detail, meta: 'activity totals are too low until the query is split', how: ' Tell me which activity query hit the 2,000-row cap and how to split it.' });
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.title).localeCompare(String(b.title)));
  },
});

dash.calc('oo_points_act', {
  title: '1:1 numbers and talking points, activity',
  description: 'The activity lines of each 1:1 agenda (for a leader, their whole team): numbers (meetings, emails, booked, the like-for-like change and the usual range for their role) and up to 3 talking points, most urgent first: nothing captured for 5+ business days, the role\'s meetings (or a BDR\'s emails) well down on the 4 weeks before, nothing booked for the next 2 weeks, no prospect meetings, below the usual range for the role, and capture problems. People in their first 28 days get the numbers only. Its own calc, so agendas still build when activity can\'t be read; the agenda merges it in by severity, after the core and routing points.',
  inputs: ['team_tree', 'act_reps', 'act_ranges', 'books_owner'],
  fn: (team_tree, act_reps, act_ranges, books_owner) => {
    const MAX_TALK = 3;
    const num = (n) => Math.round(n).toLocaleString('en');
    const plural = (n, one, many) => num(n) + ' ' + (n === 1 ? one : many);
    const wk = (n) => (n == null ? '—' : (Math.round(n * 10) / 10).toLocaleString('en'));
    const sgn = (v) => (v < 0 ? '−' : '+') + Math.abs(Math.round(v * 100)) + '%';
    const day = (t) => (t == null ? '' : new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).replace(',', ''));
    const list = (rs, f) => rs.slice(0, 4).map(f).join(', ') + (rs.length > 4 ? ' and ' + (rs.length - 4) + ' more' : '');
    const CORE = { customer: 'customer meetings', prospect: 'prospect meetings', external: 'external meetings' };
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const rng = new Map(act_ranges.map((x) => [x.kind, x]));
    const book = new Map(books_owner.map((b) => [b.owner, b]));
    const kids = new Map();
    for (const t of team_tree) if (t.manager) { if (!kids.has(t.manager)) kids.set(t.manager, []); kids.get(t.manager).push(t.name); }
    const subtree = (n) => { const s = new Set([n]); const q = [n]; while (q.length) { for (const k of kids.get(q.shift()) || []) if (!s.has(k)) { s.add(k); q.push(k); } } return s; };
    const by = new Map(act_reps.map((r) => [r.name, r]));
    const g = act_reps[0] || {};
    const emailsTxt = (e, p, a) => (e == null ? 'emails not visible with your access' : plural(e, 'email', 'emails') + ' sent to ' + plural(p, 'person', 'people') + ' at ' + plural(a, 'account', 'accounts'));
    const out = [];
    for (const t of team_tree) {
      if (!t.email) continue;
      const lead = t.isLeader;
      const talk = [];
      let n = 0;
      const push = (section, sev, text, extra) => out.push({ key: t.email + '|' + section + '|act|' + out.length, email: t.email, name: t.name, section, sev, order: 2e6 + (n++), text, screen: 'oneonone', view: 'activity', act: true, ...(extra || {}) });
      const chk = { screen: 'actions', view: 'checks' };
      if (!lead) {
        const r = by.get(t.name);
        if (!r || !r.active || r.status === 'Not visible' || (r.kind === 'Leader' && !r.meetings && !r.emails)) continue;
        const meetTxt = r.meetings == null ? 'meetings not visible with your access' : plural(r.meetings, 'external meeting', 'external meetings') + ' (' + num(r.meetCust) + ' with customers, ' + num(r.meetPros) + ' with prospects)';
        push('numbers', '', 'Activity, last 4 weeks: ' + meetTxt + ' and ' + emailsTxt(r.emails, r.people, r.accounts) + (r.booked == null ? '' : '; ' + num(r.booked) + ' booked for the next 2 weeks') + '.');
        const bits = [];
        if (r.coreChg != null) bits.push(CORE[r.coreLabel] + ' ' + sgn(r.coreChg) + ' (' + num(r.coreNow) + ' vs ' + num(r.corePrev) + ')');
        if (r.emailsChg != null) bits.push('emails ' + sgn(r.emailsChg));
        const x = rng.get(r.kind);
        const usual = x && x.coreWk25 != null && r.kind !== 'Leader' ? ' Usual for ' + x.label + ': ' + wk(x.coreWk25) + '–' + wk(x.coreWk75) + ' ' + CORE[r.coreLabel] + ' a week; theirs ' + wk(r.coreWk) + '.' : '';
        const b = book.get(r.name);
        const em = r.kind === 'EM' && b && b.emCustomers && r.custMet != null ? ' Met ' + plural(r.custMet, 'customer account', 'customer accounts') + '; ' + num(b.emCustomers) + ' in their Engagement Manager book.' : '';
        push('numbers', '', (bits.length ? 'On the 4 weeks before: ' + bits.join(', ') + '.' : 'No comparison with the 4 weeks before' + (r.trendNote ? ': ' + r.trendNote : '') + '.') + usual + em);
        if (r.isNew || r.kind === 'Leader') continue;
        const f = (k) => r.flags.includes(k);
        if (f('Quiet')) talk.push([r.quietSev, 'No sent email or external meeting captured for ' + r.idle + ' business days (since ' + day(r.lastTouch) + '). Away, or is something blocking?']);
        if (f('Slowing')) talk.push(['medium', r.trigger === 'emails' ? 'Emails sent down ' + Math.abs(Math.round(r.emailsChg * 100)) + '% on the 4 weeks before (' + num(r.emails) + ' vs ' + num(r.emailsPrev) + ').' : cap(CORE[r.coreLabel]) + ' down ' + Math.abs(Math.round(r.coreChg * 100)) + '% on the 4 weeks before (' + num(r.coreNow) + ' vs ' + num(r.corePrev) + ').']);
        if (f('Nothing booked')) talk.push([r.kind === 'EM' ? 'low' : 'medium', r.kind === 'EM' ? 'No customer meetings booked for the next 2 weeks (' + num(r.meetCust) + ' held in the last 4).' : 'No prospect meetings booked for the next 2 weeks (' + num(r.meetPros) + ' held in the last 4).']);
        if ((r.kind === 'AE' || r.kind === 'SMB') && r.meetPros === 0 && r.meetCust >= 4 && r.tenure != null && r.tenure >= 56) talk.push(['low', 'No prospect meetings in the last 4 weeks (' + num(r.meetCust) + ' with customers; ' + num(r.meetProsPrev) + ' with prospects the 4 weeks before).']);
        if (f('Below range') && x) talk.push(['low', 'Below the usual range for ' + x.label + ' in both of the last two 4-week windows: ' + wk(r.coreWk) + ' ' + CORE[r.coreLabel] + ' a week now (the middle half of ' + x.label + ': ' + wk(x.coreWk25) + '–' + wk(x.coreWk75) + '). Peers, not a target.']);
        if (f('No capture')) talk.push(['low', (g.mailHidden ? 'No external meeting captured in 4 weeks (emails not visible with your access)' : g.meetHidden ? 'No sent email captured in 4 weeks (meetings not visible with your access)' : 'No sent email or external meeting captured in 4 weeks') + ': check their mailbox and calendar capture before reading their activity.', chk]);
        else if (f('Capture gap')) talk.push(['low', 'Their ' + (r.mailOff ? 'mailbox' : 'calendar') + ' capture looks off, so their ' + (r.mailOff ? 'emails' : 'meetings') + ' read low: check it before reading their activity.', chk]);
      } else {
        const rs = [...subtree(t.name)].map((x) => by.get(x)).filter(Boolean);
        if (!rs.some((r) => r.meetings || r.emails || r.booked || (r.active && r.kind !== 'Leader'))) continue;
        const sum = (f) => rs.reduce((s, r) => s + (+r[f] || 0), 0);
        const lm = rs.filter((r) => r.cmpMeet), pm = lm.reduce((s, r) => s + r.meetPrev, 0), nm = lm.reduce((s, r) => s + r.meetings, 0);
        const live = rs.filter((r) => r.active && (r.emails || r.meetings));
        const chg = pm >= 20 ? (nm - pm) / pm : null;
        const hid = rs.filter((r) => r.active && r.status === 'Not visible').length, sel = rs.filter((r) => r.active && r.kind !== 'Leader').length;
        push('numbers', '', 'Team activity, last 4 weeks: ' + (g.meetHidden ? 'meetings not visible with your access' : plural(sum('meetings'), 'external meeting', 'external meetings') + ' (' + num(sum('meetCust')) + ' with customers, ' + num(sum('meetPros')) + ' with prospects), ' + num(sum('booked')) + ' booked for the next 2 weeks') + '; ' + (g.mailHidden ? 'emails not visible with your access' : plural(sum('emails'), 'email', 'emails') + ' sent') + '.'
          + (chg != null ? ' Meetings ' + sgn(chg) + ' like-for-like on the 4 weeks before (' + num(lm.length) + ' of ' + num(live.length) + ' people compared).' : '')
          + (hid ? ' Your access shows no activity for ' + num(hid) + ' of the ' + plural(sel, 'seller', 'sellers') + ' in this team, so these totals may be partial.' : ''));
        const act = rs.filter((r) => r.active && r.kind !== 'Leader' && !r.isNew);
        const fl = (k) => act.filter((r) => r.flags.includes(k));
        const quiet = fl('Quiet').sort((a, b) => b.idle - a.idle);
        if (quiet.length) talk.push([quiet.some((r) => r.quietSev === 'high') ? 'high' : 'medium', plural(quiet.length, 'person has', 'people have') + ' nothing captured for 5+ business days: ' + list(quiet, (r) => r.name + ' (' + r.idle + ')') + '.']);
        if (chg != null && chg <= -0.25) talk.push(['medium', 'Team meetings down ' + Math.abs(Math.round(chg * 100)) + '% on the 4 weeks before, like-for-like (' + num(nm) + ' vs ' + num(pm) + ', ' + num(lm.length) + ' people compared).']);
        const slow = fl('Slowing');
        if (slow.length) talk.push(['medium', plural(slow.length, 'person is', 'people are') + ' well down on the 4 weeks before: ' + list(slow, (r) => r.name + ' ' + (r.trigger === 'emails' ? sgn(r.emailsChg) + ' emails' : sgn(r.coreChg) + ' ' + CORE[r.coreLabel])) + '.']);
        const nb = fl('Nothing booked');
        if (nb.length) talk.push([nb.some((r) => r.kind !== 'EM') ? 'medium' : 'low', plural(nb.length, 'person has', 'people have') + ' no prospect meetings booked for the next 2 weeks after 4 or more in the last 4 (customer meetings for Engagement Managers): ' + list(nb, (r) => r.name) + '.']);
        const below = fl('Below range');
        if (below.length) talk.push(['low', plural(below.length, 'person is', 'people are') + ' below the usual range for their role: ' + list(below, (r) => r.name + ' (' + wk(r.coreWk) + ' a week)') + '.']);
        const nc = act.filter((r) => r.flags.includes('No capture') || r.flags.includes('Capture gap'));
        if (nc.length) talk.push(['low', plural(nc.length, 'person has', 'people have') + ' no activity captured or a capture gap: ' + list(nc, (r) => r.name) + '. Check capture before reading their numbers.', chk]);
      }
      const rank = { high: 0, medium: 1, low: 2 };
      talk.map((x, i) => [...x, i]).sort((a, b) => rank[a[0]] - rank[b[0]] || a[3] - b[3]).slice(0, MAX_TALK).forEach(([sev, text, extra]) => push('talk', sev, text, extra));
    }
    return out;
  },
});
