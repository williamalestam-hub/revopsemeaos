// EMEA RevOps OS — calculations. Each fn uses only its inputs and constants written inside it,
// so readers can check the arithmetic in Sources. "Today" is the reader's clock.

// ===================== PIPELINE =====================
dash.calc('pipe_team', {
  title: 'Pipeline by team and manager',
  description: 'Open New Business and Upsell pipeline, commit, best case and stage bands per team and manager for this and next quarter, with closed won this quarter and renewals at stake past stage 0. Team comes from the owner role.',
  inputs: ['pipe_stage', 'won_q', 'renew_stake'],
  fn: (pipe_stage, won_q, renew_stake) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const thisQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const nextQ = thisQ % 10 === 4 ? (Math.floor(thisQ / 10) + 1) * 10 + 1 : thisQ + 1;
    const out = new Map();
    const get = (region, manager) => {
      const key = region + '|' + manager;
      if (!out.has(key)) out.set(key, { key, region, manager, level: region === 'All' ? 'all' : manager === 'All' ? 'region' : 'team', thisPipe: 0, thisOpps: 0, thisCommit: 0, thisBest: 0, thisEarly: 0, thisMid: 0, thisLate: 0, nextPipe: 0, nextOpps: 0, nextEarly: 0, nextMid: 0, nextLate: 0, won: 0, renewThis: 0, renewThisCount: 0 });
      return out.get(key);
    };
    const each = (r, f) => {
      const region = TEAM[r.role] || 'Other';
      const manager = r.manager || '(no manager)';
      [get('All', 'All'), get(region, 'All'), get(region, manager)].forEach(f);
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
  description: 'Per rep: New Business and Upsell pipeline this and next quarter, past-due opps and stale opps.',
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
    for (const r of pipe_pastdue) if (reps.has(r.owner)) get(r.owner).pastDue = +r.pastDueOpps || 0;
    for (const r of pipe_stale) if (reps.has(r.owner)) get(r.owner).stale = +r.staleOpps || 0;
    return [...reps.values()];
  },
});

// ===================== CREATED =====================
dash.calc('cr_weeks', {
  title: 'Created opps per week',
  description: 'Daily created opps summed into Monday-start weeks, with empty weeks as zero.',
  inputs: ['cr_daily'],
  fn: (cr_daily) => {
    const DAY = 864e5;
    const monday = (s) => { const d = new Date(s + 'T00:00:00Z'); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY); };
    if (!cr_daily.length) return [];
    const days = cr_daily.map((r) => String(r.day).slice(0, 10)).sort();
    const first = new Date(days[0] + 'T00:00:00Z');
    let start = monday(days[0]);
    if (start < first) start = new Date(start.getTime() + 7 * DAY);
    const end = monday(days[days.length - 1]);
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
    const qs = [...new Set(cr_source.map((r) => r.yr * 10 + r.qtr))].sort((a, b) => b - a);
    const ORDER = ['BDR-sourced', 'Inbound', 'Rep-sourced', 'Expansion (upsell)', 'Total'];
    const rows = new Map(ORDER.map((s) => [s, { source: s, thisOpps: 0, thisArr: 0, lastOpps: 0, lastArr: 0 }]));
    for (const r of cr_source) {
      const q = r.yr * 10 + r.qtr;
      const p = q === qs[0] ? 'this' : q === qs[1] ? 'last' : null;
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
    const w = cr_weeks[cr_weeks.length - 1] || {};
    const lw = cr_weeks[cr_weeks.length - 2] || {};
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
    const qs = [...new Set(cr_bdr.map((r) => r.yr * 10 + r.qtr))].sort((a, b) => b - a);
    const m = new Map();
    for (const r of cr_bdr) {
      if (!m.has(r.bdr)) m.set(r.bdr, { bdr: r.bdr, manager: r.bdrManager || '(no manager)', thisOpps: 0, thisArr: 0, lastOpps: 0, lastArr: 0 });
      const o = m.get(r.bdr);
      const q = r.yr * 10 + r.qtr;
      if (q === qs[0]) { o.thisOpps += +r.opps || 0; o.thisArr += +r.arrUsd || 0; }
      else if (q === qs[1]) { o.lastOpps += +r.opps || 0; o.lastArr += +r.arrUsd || 0; }
    }
    return [...m.values()].sort((a, b) => b.thisOpps - a.thisOpps || b.lastOpps - a.lastOpps);
  },
});

// ===================== ROUTING =====================
dash.calc('rr_people', {
  title: 'Who is in routing',
  description: 'Active EMEA reps in a routed role (AE, SMB, BDR, EM) with their pools of that kind, 90-day assignments and a status. Missing: in no pool of their kind 7+ days after their Salesforce user was created.',
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
        : days != null && days < 7 ? 'New: add next week'
        : days != null && days < 45 ? 'New joiner: overdue'
        : 'Missing';
      out.push({ userId: u.userId, name: u.name, region: TEAM[u.role] || 'Other', role: u.role, kind, manager: u.manager || '(no manager)', createdDate: since || null, daysIn: days, pools: ofKind.length, poolNames: ofKind.join(', '), otherPools: mine.length - ofKind.length, assignments: n, status });
    }
    return out;
  },
});

dash.calc('rr_pools', {
  title: 'Pools and members',
  description: 'Each EMEA LeanData pool (name across object types) with its members, member teams, inactive members and 90-day assignments.',
  inputs: ['rr_members', 'rr_assign'],
  fn: (rr_members, rr_assign) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const kindOfPool = (p) => /^RR BDR/i.test(p) ? 'BDR' : /^RR SMB/i.test(p) ? 'SMB' : /^EM/i.test(p) ? 'EM' : /^RR Gov/i.test(p) ? 'Gov (AE)' : /^RR:/i.test(p) ? 'AE' : 'Other';
    const pools = new Map();
    for (const m of rr_members) {
      if (!pools.has(m.poolName)) pools.set(m.poolName, { pool: m.poolName, family: kindOfPool(m.poolName), users: new Map(), assignments: 0, lastAssigned: null });
      pools.get(m.poolName).users.set(String(m.userId).slice(0, 15), { name: m.userName, active: m.userActive !== false, region: TEAM[m.userRole] || 'Other' });
    }
    for (const a of rr_assign) {
      const p = pools.get(a.poolName);
      if (!p) continue;
      p.assignments += +a.assignments || 0;
      const d = String(a.lastAssigned || '').slice(0, 10);
      if (d && (!p.lastAssigned || d > p.lastAssigned)) p.lastAssigned = d;
    }
    return [...pools.values()].map((p) => {
      const us = [...p.users.values()];
      const inactive = us.filter((u) => !u.active).length;
      const flag = inactive ? 'Inactive member' : !p.assignments ? 'No assignments in 90 days' : us.length === 1 ? 'Single member' : 'OK';
      return { pool: p.pool, family: p.family, members: us.length, inactiveMembers: inactive, memberNames: us.map((u) => u.name + (u.active ? '' : ' (inactive)')).sort().join(', '), regions: [...new Set(us.map((u) => u.region))].join('|'), assignments: p.assignments, lastAssigned: p.lastAssigned, flag };
    });
  },
});

dash.calc('rr_kpi', {
  title: 'Routing headline',
  description: 'Per team and for all EMEA: reps missing from routing, joiners to add next week, inactive users still in pools, pools and pools with no assignment in 90 days.',
  inputs: ['rr_people', 'rr_pools', 'rr_members'],
  fn: (rr_people, rr_pools, rr_members) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const regions = ['All', ...new Set(Object.values(TEAM))];
    return regions.map((region) => {
      const inR = (r) => region === 'All' || r === region;
      const people = rr_people.filter((p) => inR(p.region));
      const pools = rr_pools.filter((p) => region === 'All' || p.regions.split('|').includes(region));
      const inactive = new Set(rr_members.filter((m) => m.userActive === false && inR(TEAM[m.userRole] || 'Other')).map((m) => m.userId));
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
  description: 'HiBob people matched by normalised name to an EMEA Salesforce user and their LeanData pools, with days since start and a routing status. Routed roles: AE, SMB, BDR, EM.',
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
      return { id: p.id, name: p.name, title: p.title, department: p.department, team: p.team || p.department, site: p.site, manager: p.manager, startDate: start, daysIn, sfRole: sf ? sf.role : null, region: sf ? (TEAM[sf.role] || 'Other') : 'Not matched', pools: mine.length, status };
    });
  },
});

dash.calc('hire_kpi', {
  title: 'Hiring headline',
  description: 'Per team (matched Salesforce role) and for all EMEA: people on headcount, joined in 30 and 90 days, joiners overdue for a pool, and recent joiners with no Salesforce user.',
  inputs: ['people'],
  fn: (people) => {
    const regions = ['All', 'France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA', 'SMB', 'Engagement', 'BDR', 'Leadership'];
    return regions.map((region) => {
      const ps = people.filter((p) => region === 'All' || p.region === region);
      const recent = ps.filter((p) => p.daysIn != null && p.daysIn >= 0 && p.daysIn <= 90);
      return {
        region,
        headcount: ps.length,
        joined30: ps.filter((p) => p.daysIn != null && p.daysIn >= 0 && p.daysIn <= 30).length,
        joined90: recent.length,
        overdue: ps.filter((p) => p.status === 'Overdue: add to pool').length,
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
    return regions.map((region) => {
      const rs = books_owner.filter((r) => region === 'All' || r.region === region);
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
  inputs: ['bk_books'],
  fn: (bk_books) => {
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
      return { book: b.book, mainOwner: main.owner, mainRole: main.ownerRole, region: TEAM[main.ownerRole] || 'Other', mainShare: share, owners: b.owners.length, accounts: b.accounts, arr: b.arr, flag };
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
