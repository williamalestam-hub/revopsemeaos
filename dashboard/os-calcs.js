// EMEA RevOps OS — calculations. Each fn uses only its inputs and constants written inside it,
// so readers can check the arithmetic in Sources. "Today" is the reader's clock.

// ===================== PIPELINE =====================
dash.calc('pipe_team', {
  title: 'Pipeline by team and manager',
  description: 'Open New Business and Upsell pipeline, commit, best case and stage bands per team and manager for this and next quarter, with closed won this quarter and renewals at stake past stage 0. Team comes from the owner role; "M|<manager>" rows total each manager across teams.',
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
          o.thisCommit += +r.commitUsd || 0; o.thisBest += +r.bestCaseUsd || 0;
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
  description: 'Created opps and ARR per calendar month by type.',
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
    return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
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
  description: 'Active EMEA reps in a routed role (AE, SMB, BDR, EM) with their pools of that kind, 90-day assignments and a status. Missing: in no pool of their kind 7+ days after their start date (Legora start date in Salesforce, or when their Salesforce user was created).',
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
        : days != null && days < 7 ? 'New: add next week'
        : days != null && days < 45 ? 'New joiner: overdue'
        : 'Missing';
      out.push({ userId: u.userId, name: u.name, region: TEAM[u.role] || 'Other', role: u.role, kind, manager: u.manager || '(no manager)', createdDate: String(u.createdDate || '').slice(0, 10) || null, startDate: u.startDate || null, daysIn: days, pools: ofKind.length, poolNames: ofKind.join(', '), otherPools: mine.length - ofKind.length, assignments: n, status });
    }
    return out;
  },
});

dash.calc('rr_pools', {
  title: 'Pools and members',
  description: 'Each EMEA LeanData pool (name across object types) with its members, their teams and managers, inactive members, 90-day assignments and how evenly they were spread (members with none while the pool had 10 or more).',
  inputs: ['rr_members', 'rr_assign', 'roster'],
  fn: (rr_members, rr_assign, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const kindOfPool = (p) => /^RR BDR/i.test(p) ? 'BDR' : /^RR SMB/i.test(p) ? 'SMB' : /^EM/i.test(p) ? 'EM' : /^RR Gov/i.test(p) ? 'Gov (AE)' : /^RR:/i.test(p) ? 'AE' : 'Other';
    const mgr = new Map(roster.map((u) => [String(u.userId).slice(0, 15), u.manager || null]));
    const pools = new Map();
    for (const m of rr_members) {
      if (!pools.has(m.poolName)) pools.set(m.poolName, { pool: m.poolName, family: kindOfPool(m.poolName), users: new Map(), assignments: 0, lastAssigned: null, per: new Map() });
      const id = String(m.userId).slice(0, 15);
      pools.get(m.poolName).users.set(id, { id, name: m.userName, active: m.userActive !== false, region: TEAM[m.userRole] || 'Other', manager: mgr.get(id) || null });
    }
    for (const a of rr_assign) {
      const p = pools.get(a.poolName);
      if (!p) continue;
      p.assignments += +a.assignments || 0;
      const id = String(a.userId || '').slice(0, 15);
      if (id) p.per.set(id, (p.per.get(id) || 0) + (+a.assignments || 0));
      const d = String(a.lastAssigned || '').slice(0, 10);
      if (d && (!p.lastAssigned || d > p.lastAssigned)) p.lastAssigned = d;
    }
    return [...pools.values()].map((p) => {
      const us = [...p.users.values()];
      const inactive = us.filter((u) => !u.active).length;
      const counts = us.filter((u) => u.active).map((u) => p.per.get(u.id) || 0);
      const minA = counts.length ? Math.min(...counts) : 0;
      const maxA = counts.length ? Math.max(...counts) : 0;
      const starved = us.filter((u) => u.active && p.assignments >= 10 && !(p.per.get(u.id) || 0)).map((u) => u.name);
      const flag = inactive ? 'Inactive member' : !p.assignments ? 'No assignments in 90 days' : starved.length ? 'Member getting none' : us.length === 1 ? 'Single member' : 'OK';
      return { pool: p.pool, family: p.family, members: us.length, inactiveMembers: inactive, memberNames: us.map((u) => u.name + (u.active ? '' : ' (inactive)')).sort().join(', '), regions: [...new Set(us.map((u) => u.region))].join('|'), managers: [...new Set(us.map((u) => u.manager).filter(Boolean))].join('|'), assignments: p.assignments, lastAssigned: p.lastAssigned, balance: counts.length > 1 ? minA + '–' + maxA : null, starved: starved.join(', '), flag };
    });
  },
});

dash.calc('rr_kpi', {
  title: 'Routing headline',
  description: 'Per team, per manager ("M|<manager>") and for all EMEA: reps missing from routing, joiners to add next week, inactive users still in pools, pools and pools with no assignment in 90 days.',
  inputs: ['rr_people', 'rr_pools', 'rr_members'],
  fn: (rr_people, rr_pools, rr_members) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const regions = ['All', ...new Set(Object.values(TEAM))];
    const managers = [...new Set(rr_people.map((p) => p.manager).filter((m) => m && m !== '(no manager)'))];
    return regions.map((r) => ({ scope: r, isMgr: false })).concat(managers.map((m) => ({ scope: 'M|' + m, isMgr: true, m }))).map(({ scope, isMgr, m }) => {
      const region = scope;
      const inR = (r) => region === 'All' || r === region;
      const people = rr_people.filter((p) => (isMgr ? p.manager === m : inR(p.region)));
      const pools = rr_pools.filter((p) => (isMgr ? p.managers.split('|').includes(m) : region === 'All' || p.regions.split('|').includes(region)));
      const inactive = new Set(rr_members.filter((x) => x.userActive === false && (isMgr ? false : inR(TEAM[x.userRole] || 'Other'))).map((x) => x.userId));
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
dash.calc('people', {
  title: 'EMEA GTM people and routing',
  description: 'HiBob people matched by normalised name to an EMEA Salesforce user (name and id) and their LeanData pools, with days since start and a routing status. Routed roles: AE, SMB, BDR, EM.',
  inputs: ['hb_people', 'roster', 'rr_members'],
  fn: (hb_people, roster, rr_members) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const kindOfRole = (role) => /^AE-EMEA-/.test(role || '') ? 'AE' : role === 'SMB-EMEA' ? 'SMB' : role === 'BDR-EMEA' ? 'BDR' : /^EM-EMEA/.test(role || '') ? 'EM' : null;
    const kindOfPool = (p) => /^RR BDR/i.test(p) ? 'BDR' : /^RR SMB/i.test(p) ? 'SMB' : /^EM/i.test(p) ? 'EM' : /^RR(:| Gov)/i.test(p) ? 'AE' : 'Other';
    const toks = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
    const full = new Map(), firstLast = new Map();
    for (const u of roster.slice().sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? 1 : -1))) {
      const t = toks(u.name);
      if (!t.length) continue;
      full.set(t.join(' '), u);
      firstLast.set(t[0] + ' ' + t[t.length - 1], u);
    }
    const pools = new Map();
    for (const m of rr_members) {
      const k = String(m.userId).slice(0, 15);
      if (!pools.has(k)) pools.set(k, new Set());
      pools.get(k).add(m.poolName);
    }
    const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    return hb_people.map((p) => {
      const t = toks(p.name);
      const sf = full.get(t.join(' ')) || (t.length ? firstLast.get(t[0] + ' ' + t[t.length - 1]) : null) || null;
      const start = p.startDate ? String(p.startDate).slice(0, 10) : null;
      const daysIn = start ? Math.floor((today - Date.parse(start + 'T00:00:00Z')) / 864e5) : null;
      const kind = sf ? kindOfRole(sf.role) : null;
      const mine = sf ? [...(pools.get(String(sf.userId).slice(0, 15)) || [])].filter((x) => kindOfPool(x) === kind) : [];
      const status = daysIn != null && daysIn < 0 ? 'Not started'
        : !sf ? (daysIn != null && daysIn < 7 ? 'Week 1, no Salesforce user yet' : 'No Salesforce user')
        : !kind ? 'Not routed'
        : mine.length ? 'In routing'
        : daysIn != null && daysIn < 7 ? 'Add in week 2'
        : 'Overdue: add to pool';
      return { id: p.id, name: p.name, title: p.title, department: p.department, team: p.team || p.department, site: p.site, manager: p.manager, startDate: start, daysIn, sfName: sf ? sf.name : null, sfUserId: sf ? sf.userId : null, sfRole: sf ? sf.role : null, sfManager: sf ? sf.manager || null : null, region: sf ? (TEAM[sf.role] || 'Other') : 'Not matched', pools: mine.length, status };
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
      const recent = ps.filter((p) => p.daysIn != null && p.daysIn >= 0 && p.daysIn <= 90);
      return {
        region,
        headcount: ps.length,
        joined30: ps.filter((p) => p.daysIn != null && p.daysIn >= 0 && p.daysIn <= 30).length,
        joined90: recent.length,
        overdue: recent.filter((p) => p.status === 'Overdue: add to pool').length,
        noSf: recent.filter((p) => /Salesforce user/.test(p.status)).length,
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
  inputs: ['people'],
  fn: (people) => {
    const m = new Map();
    for (const p of people) {
      const t = p.team || '(no team)';
      if (!m.has(t)) m.set(t, { team: t, people: 0, joined90: 0 });
      const o = m.get(t);
      o.people += 1;
      if (p.daysIn != null && p.daysIn >= 0 && p.daysIn <= 90) o.joined90 += 1;
    }
    return [...m.values()].sort((a, b) => b.people - a.people);
  },
});

// ===================== BOOKS =====================
dash.calc('books_owner', {
  title: 'Book size per rep',
  description: 'Per EMEA rep: accounts owned, active accounts (customer, pipeline, engaging), customers and their ARR, customers where they are Engagement Manager, open New Business and Upsell pipeline and open renewals.',
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
    return [...m.values()].map(({ active_, ...o }) => ({ ...o, active: active_, ownerActive: o.active }));
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
      return { userId: u.userId, name: u.name, region: TEAM[u.role], books: bl.length, bookList: bl.join(', '), pools: pn, flag };
    });
  },
});

// ===================== PERSON =====================
dash.calc('person', {
  title: 'Person view',
  description: 'One row per Salesforce person (by name) joining their roster entry, pipeline, created opps, account book and routing.',
  inputs: ['roster', 'pipe_reps', 'cr_leader', 'books_owner', 'rr_people'],
  fn: (roster, pipe_reps, cr_leader, books_owner, rr_people) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const m = new Map();
    const get = (name) => {
      if (!m.has(name)) m.set(name, { name, userId: null, role: null, region: null, manager: null, isActive: null, title: null, createdDate: null, startDate: null, thisPipe: 0, thisOpps: 0, nextPipe: 0, pastDue: 0, stale: 0, crNb: 0, crUp: 0, crOpps: 0, crArr: 0, crBdr: 0, accounts: 0, activeAccts: 0, customers: 0, custArr: 0, emCustomers: 0, openPipe: 0, openRenewals: 0, pools: 0, poolNames: '', assignments: 0, routing: null, inRoster: false });
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
    for (const r of rr_people) Object.assign(get(r.name), { pools: r.pools, poolNames: r.poolNames, assignments: r.assignments, routing: r.status });
    return [...m.values()].map((o) => ({ ...o, region: o.region || 'Other' }));
  },
});

dash.calc('person_hb', {
  title: 'Person view, HiBob',
  description: 'HiBob details per person, keyed by their matched Salesforce name (or HiBob name when there is no match): title, team, site, manager, start date and hiring status.',
  inputs: ['people'],
  fn: (people) => {
    const m = new Map();
    for (const p of people) {
      m.set(p.sfName || p.name, { name: p.sfName || p.name, hbName: p.name, title: p.title, team: p.team, site: p.site, manager: p.manager, startDate: p.startDate, daysIn: p.daysIn, hiring: p.status, sfMatched: !!p.sfName });
    }
    return [...m.values()];
  },
});

// ===================== ACTION ITEMS =====================
dash.calc('gr_actions', {
  title: 'Action items from meetings',
  description: 'Items under a "Next steps", "Action items", "Follow-ups" or "To-dos" heading of your Granola summaries (a bullet and the indented lines under it), plus to-do lines in your private notes. The owner is the name in brackets after the item, before a colon, or the name a group of items sits under; it is yours when it matches your Granola name or email. "For you" is yours, or unassigned in a note you took. Placeholders such as "None" are left out.',
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
        shared: r.capturedByMe === false, participants: r.participants ?? null, oneOnOne: r.participants === 2, source: r.source, section: r.section, pos: r.pos, item, detail: '', owner, bucket, done,
        forYou: !done && (bucket === 'mine' || (bucket === 'unassigned' && r.capturedByMe !== false)),
        ageDays: date ? Math.max(0, Math.round((today - Date.parse(date + 'T00:00:00Z')) / 864e5)) : null,
      };
      out.push(o);
      return o;
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
    return out.sort((a, b) => String(b.meetingAt || '').localeCompare(String(a.meetingAt || '')) || String(a.meetingId).localeCompare(String(b.meetingId)) || (a.source === b.source ? 0 : a.source === 'summary' ? -1 : 1) || a.pos - b.pos);
  },
});

dash.calc('gr_kpi', {
  title: 'Action items headline',
  description: 'Open action items from your meetings: for you (yours, or unassigned in notes you took), assigned to you, unassigned, with others, and the meetings they came from.',
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
    }];
  },
});

// ===================== DATA CHECKS =====================
dash.calc('checks', {
  title: 'Data checks',
  description: 'Problems to act on in Salesforce and LeanData: reps missing from routing or due next week, inactive users in pools, reps with past-due opps, orphan accounts by reason and split books.',
  inputs: ['rr_people', 'rr_pools', 'pipe_reps', 'orphans', 'books'],
  fn: (rr_people, rr_pools, pipe_reps, orphans, books) => {
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    const money = (v) => { const a = Math.abs(+v || 0); const s = a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? Math.round(a / 1e3) + 'K' : String(Math.round(a)); return (v < 0 ? '−$' : '$') + s; };
    const out = [];
    for (const p of rr_people) {
      const since = p.daysIn != null && p.daysIn >= 0 && p.daysIn < 60 ? 'Started ' + plural(p.daysIn, 'day', 'days') + ' ago' : '';
      if (p.status === 'Missing' || p.status === 'New joiner: overdue') out.push({ id: 'rr:' + p.userId, area: 'Routing', severity: 'high', title: p.name, person: p.name, region: p.region, manager: p.manager, what: 'Not in any ' + p.kind + ' pool', meta: since, screen: 'routing' });
      else if (p.status === 'New: add next week') out.push({ id: 'rr:' + p.userId, area: 'Routing', severity: 'low', title: p.name, person: p.name, region: p.region, manager: p.manager, what: 'Add to a ' + p.kind + ' pool next week', meta: since, screen: 'routing' });
    }
    for (const pool of rr_pools) {
      if (pool.inactiveMembers) out.push({ id: 'pool:' + pool.pool, area: 'Routing', severity: 'high', title: pool.pool, person: null, region: 'All', manager: null, what: plural(pool.inactiveMembers, 'inactive user', 'inactive users') + ' still in the pool', meta: '', screen: 'routing' });
      if (pool.starved) out.push({ id: 'starved:' + pool.pool, area: 'Routing', severity: 'low', title: pool.pool, person: null, region: 'All', manager: null, what: 'No assignments in 90 days for ' + pool.starved, meta: plural(pool.assignments, 'assignment', 'assignments') + ' went to the others', screen: 'routing' });
    }
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
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.area).localeCompare(String(b.area)) || String(a.title).localeCompare(String(b.title)));
  },
});

dash.calc('checks_hb', {
  title: 'Data checks, HiBob',
  description: 'People who joined in the last 90 days (past their first week) with no Salesforce user found by name.',
  inputs: ['people'],
  fn: (people) => {
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    return people.filter((h) => h.status === 'No Salesforce user' && h.daysIn != null && h.daysIn >= 0 && h.daysIn <= 90)
      .map((h) => ({ id: 'hb:' + h.id, area: 'Hiring', severity: 'medium', title: h.name, person: h.name, region: h.region, manager: h.sfManager || null, what: 'No Salesforce user found', meta: 'Started ' + plural(h.daysIn, 'day', 'days') + ' ago', screen: 'hiring' }));
  },
});

dash.calc('checks_kpi', {
  title: 'Data checks headline',
  description: 'Number of Salesforce and LeanData data checks and urgent ones, per team and for all EMEA.',
  inputs: ['checks'],
  fn: (checks) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(checks.map((c) => c.manager).filter((m) => m && m !== '(no manager)'))];
    return regions.concat(managers.map((m) => 'M|' + m)).map((region) => {
      const cs = checks.filter((c) => (region.startsWith('M|') ? c.manager === region.slice(2) : region === 'All' || c.region === region));
      return { region, total: cs.length, high: cs.filter((c) => c.severity === 'high').length };
    });
  },
});

dash.calc('checks_hb_kpi', {
  title: 'HiBob checks headline',
  description: 'Number of HiBob data checks (recent joiners with no Salesforce user), per team and for all EMEA.',
  inputs: ['checks_hb'],
  fn: (checks_hb) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    const managers = [...new Set(checks_hb.map((c) => c.manager).filter(Boolean))];
    return regions.concat(managers.map((m) => 'M|' + m)).map((region) => ({ region, total: checks_hb.filter((c) => (region.startsWith('M|') ? c.manager === region.slice(2) : region === 'All' || c.region === region)).length }));
  },
});
