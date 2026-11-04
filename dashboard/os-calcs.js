// EMEA RevOps OS — calculations. Each fn uses only its inputs and constants written inside it,
// so readers can check the arithmetic in Sources. "Today" is the reader's clock.

// ===================== PIPELINE =====================
dash.calc('pipe_team', {
  title: 'Pipeline by team and manager Closed won counts for the team that closed it (the owner\'s role at close; a deal since moved to someone in another role also for the manager at close).',
  description: 'Open New Business and Upsell pipeline, rep commit, rep best case and stage bands per team and manager for this and next quarter, with closed won this quarter (by the date actually closed) and renewals at stake past stage 0. Commit is the ARR of deals the rep has put in the Commit forecast category; best case adds the Best Case category, so it already includes commit. Deals with no category count as pipeline only. Team comes from the owner role; "M|<manager>" rows total each manager\'s direct reports across teams.',
  inputs: ['pipe_stage', 'won_q', 'renew_stake'],
  fn: (pipe_stage, won_q, renew_stake) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const SELL = /^(AE|AD|SMB|EM|BDR|DIR-SALES|MGR-SALES|VP-SALES|DIR-EM|DIR-BDR|DIR-BD|HEAD-GTM)(-|$)|Partnerships$/;
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
          // by the rep forecast category: the rep commit and best-case ARR fields stopped being maintained on 1 Sep 2026
          if (r.forecast === 'Commit') o.thisCommit += +r.arrUsd || 0;
          if (r.forecast === 'Commit' || r.forecast === 'Best Case') o.thisBest += +r.arrUsd || 0;
          o['this' + band] += +r.arrUsd || 0;
        } else if (q === nextQ) {
          o.nextPipe += +r.arrUsd || 0; o.nextOpps += +r.opps || 0;
          o['next' + band] += +r.arrUsd || 0;
        }
      });
    }
    for (const r of won_q) {
      if (r.recordType === 'Renewal') continue;
      // the team that closed it: the owner's role at close when that is a selling role (else the current one); a deal
      // closed by another region counts for them; one since moved to someone in another role also counts for the
      // manager at close (none when that isn't stamped)
      const c = r.closedRole && SELL.test(r.closedRole) ? r.closedRole : null, role = c || r.role, moved = !!(c && c !== r.role);
      if (!TEAM[role]) continue;
      each({ role, manager: moved ? r.closedManager || null : r.manager }, (o) => { o.won += +r.wonArrUsd || 0; });
    }
    for (const r of renew_stake) {
      if (r.fy * 10 + r.fq !== thisQ || String(r.stage).startsWith('0')) continue;
      each(r, (o) => { o.renewThis += +r.renewingArrUsd || 0; o.renewThisCount += +r.renewals || 0; });
    }
    return [...out.values()];
  },
});

dash.calc('partner_pipe', {
  title: 'Pipeline owned outside EMEA sales',
  description: 'Open deals on EMEA-region accounts whose owner isn\'t in an EMEA sales role (the global partnership roles, strategic AEs, other regions\' sellers, users with no role), per owner role and in total ("All"): New Business and Upsell ARR and deals closing this quarter, next quarter and in all (later quarters and past-due deals included), open renewals, and the account regions holding the most. None of it is in any EMEA team\'s totals, which follow the owner\'s role.',
  inputs: ['pipe_partner'],
  fn: (pipe_partner) => {
    const now = new Date();
    const thisQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const nextQ = thisQ % 10 === 4 ? (Math.floor(thisQ / 10) + 1) * 10 + 1 : thisQ + 1;
    const usd = (v) => { const a = Math.abs(+v || 0); return '$' + (a >= 999500 ? (a / 1e6).toFixed(a >= 9.95e6 ? 0 : 1) + 'M' : a >= 999.5 ? Math.round(a / 1e3) + 'K' : String(Math.round(a))); };
    const m = new Map();
    const get = (role) => { if (!m.has(role)) m.set(role, { key: role, role, thisArr: 0, thisOpps: 0, nextArr: 0, nextOpps: 0, allArr: 0, allOpps: 0, renewals: 0, byRegion: {} }); return m.get(role); };
    for (const r of pipe_partner) {
      for (const o of [get('All'), get(r.role || '(no role)')]) {
        if (r.rt === 'Renewal') { o.renewals += +r.opps || 0; continue; }
        const q = r.fy * 10 + r.fq, arr = +r.arrUsd || 0, n = +r.opps || 0;
        o.allArr += arr; o.allOpps += n;
        if (q === thisQ) { o.thisArr += arr; o.thisOpps += n; } else if (q === nextQ) { o.nextArr += arr; o.nextOpps += n; }
        const reg = r.region || '(no region)';
        o.byRegion[reg] = (o.byRegion[reg] || 0) + arr;
      }
    }
    return [...m.values()].map(({ byRegion, ...o }) => ({ ...o,
      regions: Object.entries(byRegion).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + usd(v)).join(', ') || null }))
      .sort((a, b) => (a.role === 'All') - (b.role === 'All') || b.allArr - a.allArr);
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
  description: 'Per rep, by name: won this quarter and last (ARR and count), lost this quarter, win rate and average won deal, from Bookings, adding up the teams they closed under.',
  inputs: ['bookings'],
  fn: (bookings) => {
    const m = new Map();
    for (const r of bookings) {
      if (!m.has(r.owner)) m.set(r.owner, { name: r.owner, wonThisArr: 0, wonThis: 0, lostThis: 0, wonLastArr: 0 });
      const o = m.get(r.owner);
      o.wonThisArr += +r.wonThisArr || 0; o.wonThis += +r.wonThis || 0; o.lostThis += +r.lostThis || 0; o.wonLastArr += +r.wonLastArr || 0;
    }
    return [...m.values()].map((o) => ({ ...o, winRateThis: o.wonThis + o.lostThis ? o.wonThis / (o.wonThis + o.lostThis) : null, avgDealThis: o.wonThis ? o.wonThisArr / o.wonThis : null }));
  },
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

// Salesforce values the pipeline logic depends on, checked against the open pipeline the app already loads (pipe_stage):
// a stage renamed without its number, or a new forecast category or record type, would otherwise drop deals silently,
// as the stage-3 rename did on 3 Nov 2026. Plus, per manager, deals closing this quarter that nobody has forecast.
dash.calc('checks_cfg', {
  title: 'Data checks, Salesforce values',
  description: 'Open New Business and Upsell deals closing this or next quarter whose stage doesn\'t start with its number (0-6), whose rep forecast category isn\'t Commit, Best Case or Pipeline, or whose record type isn\'t New Business, Upsell or Renewal, with how many and their ARR: the dashboard would leave them out of stage bands, stuck and early-stage checks, the forecast or the pipeline. Also, per manager, New Business and Upsell deals closing this quarter with no rep forecast category, which the forecast counts as pipeline only.',
  inputs: ['pipe_stage'],
  fn: (pipe_stage) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const STAGES = /^[0-6]\D/, FORECAST = ['Commit', 'Best Case', 'Pipeline'], TYPES = ['New Business', 'Upsell', 'Renewal'];
    const now = new Date();
    const thisQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const usd = (v) => '$' + (v >= 1e6 ? (Math.round(v / 1e5) / 10).toLocaleString('en') + 'M' : v >= 1e3 ? Math.round(v / 1e3).toLocaleString('en') + 'K' : Math.round(v).toLocaleString('en'));
    const plural = (n, one, many) => n.toLocaleString('en') + ' ' + (n === 1 ? one : many);
    const all = { area: 'Pipeline', person: null, region: 'All', manager: null, screen: 'pipeline', view: 'teams' };
    const group = (test, key) => {
      const m = new Map();
      for (const r of pipe_stage) {
        if (!test(r)) continue;
        const k = key(r), o = m.get(k) || { n: 0, arr: 0 };
        o.n += +r.opps || 0; o.arr += +r.arrUsd || 0; m.set(k, o);
      }
      return m;
    };
    const out = [];
    for (const [v, o] of group((r) => !STAGES.test(String(r.stage || '')), (r) => String(r.stage || '(blank)'))) out.push({ ...all, id: 'cfg:stage:' + v, severity: 'high', title: 'Stage "' + v + '"',
      what: plural(o.n, 'open deal', 'open deals') + ' (' + usd(o.arr) + ' ARR) in a stage that doesn\'t start with its number', meta: 'renamed or added in Salesforce? Stage bands, stuck and early-stage checks match stages by their number, so these deals drop out of them',
      how: ' Tell me when the opportunity stage "' + v + '" was added or renamed, which numbered stage (0-6) it stands for, and how many open EMEA deals are in it (counts only). Change nothing.' });
    for (const [v, o] of group((r) => r.recordType !== 'Renewal' && r.forecast && !FORECAST.includes(r.forecast), (r) => r.forecast)) out.push({ ...all, view: 'forecast', id: 'cfg:fc:' + v, severity: 'high', title: 'Forecast category "' + v + '"',
      what: plural(o.n, 'open deal', 'open deals') + ' (' + usd(o.arr) + ' ARR) in a rep forecast category the dashboard doesn\'t know', meta: 'the forecast counts only Commit and Best Case, so these count as pipeline only',
      how: ' Tell me when the Rep Forecast Category value "' + v + '" was added or renamed, what it replaced, and whether the forecast should count it as commit, best case or pipeline (counts only). Change nothing.' });
    for (const [v, o] of group((r) => !TYPES.includes(r.recordType), (r) => String(r.recordType || '(blank)'))) out.push({ ...all, id: 'cfg:rt:' + v, severity: 'medium', title: 'Record type "' + v + '"',
      what: plural(o.n, 'open deal', 'open deals') + ' (' + usd(o.arr) + ' ARR) with a record type the dashboard doesn\'t know', meta: 'pipeline and forecast count New Business and Upsell only',
      how: ' Tell me when the opportunity record type "' + v + '" was added or renamed and what kind of deal it is (counts only). Change nothing.' });
    // deals closing this quarter that no one has forecast: per manager (the owner's manager), so each manager can fix theirs
    for (const o of group((r) => r.recordType !== 'Renewal' && !r.forecast && r.fy * 10 + r.fq === thisQ, (r) => (r.manager || '') + '|' + (TEAM[r.role] || 'Other')).entries()) {
      const [k, x] = o, [manager, region] = k.split('|');
      out.push({ id: 'cfg:nofc:' + k, area: 'Pipeline', severity: x.arr >= 250000 ? 'medium' : 'low', title: manager || '(no manager)', person: manager || null, region, manager: manager || null, screen: 'pipeline', view: 'forecast',
        what: plural(x.n, 'deal', 'deals') + ' closing this quarter (' + usd(x.arr) + ' ARR) in their team with no rep forecast category', meta: 'the forecast counts them as pipeline only',
        how: ' List the EMEA New Business and Upsell opportunities closing this quarter that have no Rep Forecast Category and whose owner reports to ' + (manager || 'no manager') + ', and draft a short note to each owner asking them to set it. Show me the notes and wait for my OK before sending; change no records.' });
    }
    return out;
  },
});

dash.calc('checks_closed', {
  title: 'Data checks, role at close',
  description: 'People whose New Business and Upsell deals closed this quarter and last carry two or more different roles at close (Closed Owner Role) in each of the two quarters. A role change produces two roles in one quarter at most, so this points to a role that switched back and forth or a stamp that read the wrong role; Bookings, win rates and Coverage split their deals between those teams.',
  inputs: ['closed_rep'],
  fn: (closed_rep) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const SELL = /^(AE|AD|SMB|EM|BDR|DIR-SALES|MGR-SALES|VP-SALES|DIR-EM|DIR-BDR|DIR-BD|HEAD-GTM)(-|$)|Partnerships$/;
    const usd = (v) => '$' + (v >= 1e6 ? (Math.round(v / 1e5) / 10).toLocaleString('en') + 'M' : v >= 1e3 ? Math.round(v / 1e3).toLocaleString('en') + 'K' : Math.round(v).toLocaleString('en'));
    const qName = (q) => 'Q' + (q % 10) + ' ' + Math.floor(q / 10);
    const by = new Map();
    for (const r of closed_rep) {
      const c = r.closedRole && SELL.test(r.closedRole) ? r.closedRole : null;
      if (!c || !TEAM[c]) continue;
      const who = (c !== r.role ? r.closedOwner : r.owner) || r.owner;
      if (!by.has(who)) by.set(who, { quarters: new Map(), arr: 0, manager: r.manager || null, role: r.role || null });
      const p = by.get(who), q = r.fy * 10 + r.fq;
      if (!p.quarters.has(q)) p.quarters.set(q, new Map());
      const roles = p.quarters.get(q);
      roles.set(c, (roles.get(c) || 0) + (+r.opps || 0));
      p.arr += +r.arrUsd || 0;
    }
    const out = [];
    for (const [who, p] of by) {
      const qs = [...p.quarters.entries()].sort((a, b) => a[0] - b[0]);
      if (qs.length < 2 || !qs.every(([, roles]) => roles.size >= 2)) continue;
      const txt = qs.map(([q, roles]) => qName(q) + ': ' + [...roles.entries()].sort((a, b) => b[1] - a[1]).map(([role, n]) => role + ' ' + n).join(', ')).join('; ');
      const teams = [...new Set(qs.flatMap(([, roles]) => [...roles.keys()].map((role) => TEAM[role])))];
      out.push({ id: 'clr:' + who, area: 'Pipeline', severity: p.arr >= 250000 ? 'medium' : 'low', title: who, person: who, region: TEAM[p.role] || teams[0], manager: p.manager, screen: 'pipeline', view: 'bookings',
        what: 'Deals they closed carry different roles at close in both quarters (' + txt + ')',
        meta: 'their ' + usd(p.arr) + ' closed this quarter and last is split between ' + teams.join(' and ') + '; one role change can\'t do this',
        how: ' Check in Setup Audit Trail whether the Salesforce role of ' + who + ' changed more than once since the start of last quarter, and how the Closed Owner Role field on Opportunity is filled (which user\'s role it reads, and when). Tell me which (counts and dates only). Change nothing.' });
    }
    return out;
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
  description: 'Per team, per team and manager, per manager and for all EMEA, this quarter: closed won, commit and best case on open deals (the ARR of deals in the rep forecast categories Commit, and Commit plus Best Case), open pipeline, and the two calls: won + commit, and won + best case (best case already includes commit, so it is not added on top). The upside is best case above commit. New Business and Upsell, incremental ARR.',
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
  description: 'Per rep and the team and manager they closed under, New Business and Upsell closed this quarter and last (by the date actually closed): won count and ARR, lost count, win rate by count, and average won deal. A deal counts for the team of its owner\'s role at close when that is a selling role (the current role otherwise, and before it was stamped, about April 2026), so a deal another region closed counts for them and one closed by RevOps or Legal Engineering for its current owner\'s team; one that has since moved to someone in another role counts for its owner and manager at close, so someone who changed roles can have a row per team. Losses marked "Merged with Global Pilot" or "Record cleanup" are admin merges and are left out of win rates.',
  inputs: ['closed_rep'],
  fn: (closed_rep) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const SELL = /^(AE|AD|SMB|EM|BDR|DIR-SALES|MGR-SALES|VP-SALES|DIR-EM|DIR-BDR|DIR-BD|HEAD-GTM)(-|$)|Partnerships$/;
    const ADMIN = /^(merged with global pilot|record cleanup)$/i;
    const now = new Date();
    const thisQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const m = new Map();
    for (const r of closed_rep) {
      // who closed it, in which team and under which manager: the owner's role at close when that is a selling role
      // (else the current one; a deal closed by another region counts for them); a deal since moved to someone in
      // another role counts for its owner and manager at close
      const c = r.closedRole && SELL.test(r.closedRole) ? r.closedRole : null, role = c || r.role, moved = !!(c && c !== r.role);
      if (!TEAM[role]) continue;
      const owner = moved ? r.closedOwner || r.owner : r.owner;
      const manager = (moved ? r.closedManager : r.manager) || '(no manager)', region = TEAM[role];
      const key = owner + '|' + region + '|' + manager;
      if (!m.has(key)) m.set(key, { key, owner, role, region, manager, wonThis: 0, wonThisArr: 0, wonNbArr: 0, wonUpArr: 0, lostThis: 0, wonLast: 0, wonLastArr: 0, lostLast: 0 });
      const o = m.get(key);
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
  description: 'Lost New Business and Upsell deals by lost reason, this quarter and last, per team, per manager and for all EMEA (the team and manager that closed them, as in Bookings). Reasons follow the list used since 3 Nov 2026; older values are grouped under their new name (Qualified Out as Not a fit, Timing as Deferred, Technical/Functional Gap as Product fit, Lost to Competitor as Chose an alternative, No Champion as Buyer engagement, Budget as Price and budget), and "was" names the older values in each group. Value not perceived has no clear new equivalent and stays apart. Admin merges ("Merged with Global Pilot", "Record cleanup") are shown but marked.',
  inputs: ['closed_rep'],
  fn: (closed_rep) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const SELL = /^(AE|AD|SMB|EM|BDR|DIR-SALES|MGR-SALES|VP-SALES|DIR-EM|DIR-BDR|DIR-BD|HEAD-GTM)(-|$)|Partnerships$/;
    const ADMIN = /^(merged with global pilot|record cleanup)$/i;
    const now = new Date();
    const thisQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    // the reason list changed on 3 Nov 2026: older values are grouped under their new name (a mapping RevOps agreed);
    // Value not perceived has no clear new equivalent and stays apart; admin values and unknown ones keep their name
    const REASON = { 'Qualified Out': 'Not a fit', 'Timing': 'Deferred', 'Technical/Functional Gap': 'Product fit', 'Lost to Competitor': 'Chose an alternative',
      'No Champion': 'Buyer engagement', 'Budget': 'Price and budget', 'Value not perceived': 'Value not perceived (old list)' };
    const out = new Map();
    for (const r of closed_rep) {
      if (r.won) continue;
      const raw = r.lostReason || '';
      const reason = !raw ? 'No reason given' : REASON[raw] || raw;
      // the team that closed it (see Bookings): role at close, and the manager at close for a deal moved to another role
      const c = r.closedRole && SELL.test(r.closedRole) ? r.closedRole : null, moved = !!(c && c !== r.role);
      if (!TEAM[c || r.role]) continue;
      const region = TEAM[c || r.role], manager = moved ? r.closedManager : r.manager;
      for (const scope of ['All', region].concat(manager ? ['M|' + manager] : [])) {
        const key = scope + '|' + reason;
        if (!out.has(key)) out.set(key, { key, scope, reason, admin: ADMIN.test(reason), thisOpps: 0, lastOpps: 0, thisArr: 0, olds: {} });
        const o = out.get(key);
        if (r.fy * 10 + r.fq === thisQ) { o.thisOpps += +r.opps || 0; o.thisArr += +r.arrUsd || 0; } else o.lastOpps += +r.opps || 0;
        if (raw && REASON[raw] && REASON[raw] !== raw + ' (old list)') o.olds[raw] = (o.olds[raw] || 0) + (+r.opps || 0);
      }
    }
    // was: the older values a group holds, e.g. 'Qualified Out' (both quarters together)
    return [...out.values()].map(({ olds, ...o }) => ({ ...o, was: Object.keys(olds).sort((a, b) => olds[b] - olds[a]).join(', ') || null }));
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
    for (const b of bookings) if (own.has(b.owner)) { const o = own.get(b.owner); o.wonThisArr += +b.wonThisArr || 0; o.wonThis += +b.wonThis || 0; o.lostThis += +b.lostThis || 0; }
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
  description: 'Events in your calendar from now to 14 days ahead that are a 1:1: one colleague with your email domain besides you (meeting rooms aside), with you invited or organising, not all-day or cancelled, and declined by neither of you. The colleague is matched to an active Salesforce user by email; a user whose name says it isn\'t a person (integration, API, sync, bot) is never a match, and when several users share the email the one whose name matches the email or calendar name wins, then one with a role or manager.',
  inputs: ['cal_events', 'users_all'],
  fn: (cal_events, users_all) => {
    // the user behind an email: of the active users with it, not one whose name says it isn't a person (integration,
    // API, sync); prefer a name matching the email or the calendar name, then one with a role or a manager
    const fold = (x) => String(x || '').replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/ß/g, 'ss').replace(/[łŁ]/g, 'l').replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const toks = (x) => fold(x).split(/[^a-z]+/).filter(Boolean);
    const SYSTEM = /\b(integration|api|sync|bot|automation|service|system)\b/i;
    const byEmail = new Map();
    for (const u of users_all) {
      const e = String(u.email || '').toLowerCase();
      if (!e || SYSTEM.test(u.name || '')) continue;
      if (!byEmail.has(e)) byEmail.set(e, []);
      byEmail.get(e).push(u);
    }
    const userOf = (email, display) => {
      const rows = byEmail.get(email) || [];
      if (rows.length <= 1) return rows[0] || null;
      const known = toks(email.split('@')[0]).concat(toks(display));
      const score = (u) => (toks(u.name).some((w) => known.includes(w)) ? 2 : 0) + (u.role || u.manager ? 1 : 0);
      return rows.slice().sort((a, b) => score(b) - score(a) || String(a.userId || '').localeCompare(String(b.userId || '')))[0];
    };
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
      const guess = o.email.split('@')[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      const u = userOf(o.email, o.name);
      out.push({ key: e.id, start: e.start, end: e.end, at: Date.parse(e.start || '') || null, title: e.title, email: o.email, name: u ? u.name : (String(o.name || '').trim() || guess), sfName: u ? u.name : null, role: u ? u.role || null : null, recurring: !!e.recurring, link: e.link });
    }
    return out.sort((a, b) => (a.at || 0) - (b.at || 0));
  },
});

dash.calc('oo_followups', {
  title: 'Follow-ups per colleague',
  description: 'Open action items from your Granola notes for each colleague: items from meetings of up to three people they attended, and items they own from any meeting (by full name, or by first name when they were one of the meeting\'s listed attendees), marked when they come from your private notes. Also the latest meeting of two or three people with them, as "last time", with the headings of its summary as the topics it covered (up to six; generic headings, action headings such as Next steps or Action points and the owner groups under them left out, private notes never read for this).',
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
    // what the last meeting covered: the headings of its summary (not private notes), in order, generic ones left out
    const GENERIC = /^(summary|overview|notes?|key (takeaways|points)|takeaways|attendees|participants|agenda|private notes)$/i;
    // action headings (and the owner groups under them) are follow-ups, read the way gr_actions reads them
    const ACTION = /\b(next steps?|action items?|action points?|actions?|follow[- ]?ups?|to[- ]?dos?|tasks?)\b/i;
    const NOT_ACTION = /\b(questions?|taken|completed|done|force|discussed)\b/i;
    const isAction = (x) => !!x && ACTION.test(x) && !NOT_ACTION.test(x);
    const topics = new Map();
    for (const r of gr_notes) {
      const h = String(r.section || '').trim();
      if (r.source !== 'summary' || !h || GENERIC.test(h) || isAction(h) || isAction(r.parentSection)) continue;
      if (!topics.has(r.meetingId)) topics.set(r.meetingId, []);
      const t = topics.get(r.meetingId);
      if (!t.includes(h)) t.push(h);
    }
    for (const [email, m] of last) {
      const t = topics.get(m.meetingId) || [];
      out.push({ key: email + '|last', email, kind: 'last', id: null, item: m.meeting || 'Untitled meeting', owner: null, bucket: null, due: null, dueStatus: null, meeting: m.meeting, meetingId: m.meetingId, date: String(m.meetingAt || '').slice(0, 10) || null, url: m.url, topics: t.slice(0, 6).join('\n'), topicsMore: Math.max(0, t.length - 6) });
    }
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
  title: 'Pipeline movement, last 7 days Won and lost count for who closed them: a deal that has since moved to someone in another role counts for its owner, team and manager at close.',
  description: 'Per EMEA rep, New Business and Upsell in the last 7 days: opportunities created, won and lost (by the date actually closed; admin merges and record clean-ups left out of lost), close dates pushed out of this quarter or pulled into it, stage moved up or down, and moved into or out of Commit. Each deal counts once per measure, at its current ARR, for its current owner, comparing where it was at the start of the week with where it is now, so a push that was pulled back, or a stage moved and moved back, does not count. Deals created this week count as created (and as won or lost if they closed); their close-date, stage and Commit changes are left out.',
  inputs: ['mv_outcomes', 'mv_created', 'mv_close', 'mv_fields', 'roster'],
  fn: (mv_outcomes, mv_created, mv_close, mv_fields, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const SELL = /^(AE|AD|SMB|EM|BDR|DIR-SALES|MGR-SALES|VP-SALES|DIR-EM|DIR-BDR|DIR-BD|HEAD-GTM)(-|$)|Partnerships$/;
    const now = new Date();
    const curQ = now.getUTCFullYear() * 10 + Math.floor(now.getUTCMonth() / 3) + 1;
    const byId = new Map(roster.map((u) => [String(u.userId).slice(0, 15), u]));
    const m = new Map();
    const get = (owner, role, manager) => {
      if (!m.has(owner)) m.set(owner, { owner, role: role || null, region: TEAM[role] || 'Other', manager: manager || '(no manager)', created: 0, createdArr: 0, createdThisQ: 0, won: 0, wonArr: 0, lost: 0, lostArr: 0, pushed: 0, pushedArr: 0, pulled: 0, pulledArr: 0, up: 0, upArr: 0, down: 0, downArr: 0, intoCommit: 0, intoCommitArr: 0, outCommit: 0, outCommitArr: 0 });
      return m.get(owner);
    };
    for (const r of mv_outcomes) {
      // who closed it (see Bookings): a deal that has since moved to someone in another role counts at close
      const c = r.closedRole && SELL.test(r.closedRole) ? r.closedRole : null, moved = !!(c && c !== r.role);
      if (!TEAM[c || r.role]) continue;
      const o = moved ? get(r.closedOwner || r.owner, c, r.closedManager) : get(r.owner, r.role, r.manager);
      if (r.won) { o.won += +r.n || 0; o.wonArr += +r.arr || 0; } else { o.lost += +r.n || 0; o.lostArr += +r.arr || 0; }
    }
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
  description: 'Per team, team and manager, manager ("M|<manager>", direct reports) and all EMEA, New Business and Upsell: average quarterly bookings over the last 4 completed quarters (missing quarters count as 0), won so far this quarter, open pipeline closing this and next quarter (past-due deals from earlier quarters left out, as on Pipeline), coverage (open this quarter over what is still to win to reach the usual quarter, open next quarter over a usual quarter), the win rate by ARR over those 4 quarters (admin merges left out; falls back to all EMEA under 10 closed deals), expected close at that win rate, and the average days from creation to win. Won, lost and days to win count for the team that closed each deal (its owner\'s role at close; a deal since moved to someone in another role also for the manager at close); open pipeline for its current owner.',
  inputs: ['coverage_base', 'cycle_team'],
  fn: (coverage_base, cycle_team) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const SELL = /^(AE|AD|SMB|EM|BDR|DIR-SALES|MGR-SALES|VP-SALES|DIR-EM|DIR-BDR|DIR-BD|HEAD-GTM)(-|$)|Partnerships$/;
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
      // a closed deal counts for the team that closed it (see Bookings); open pipeline for its current owner
      const c = r.closed && r.closedRole && SELL.test(r.closedRole) ? r.closedRole : null, moved = !!(c && c !== r.role);
      if (!TEAM[c || r.role]) continue;
      each(c || r.role, moved ? r.closedManager : r.manager, (o) => {
        if (r.closed) {
          if (q >= cur - 4 && q < cur) { if (r.won) { o.wonHist += arr; if (arr > 0) o.histQs.add(q); } else o.lostHist += arr; o.closedN += n; }
          else if (q === cur && r.won) o.wonSoFar += arr;
        } else if (q === cur) o.openThis += arr;
        else if (q === cur + 1) o.openNext += arr;
      });
    }
    for (const r of cycle_team) {
      const c = r.closedRole && SELL.test(r.closedRole) ? r.closedRole : null, moved = !!(c && c !== r.role);
      if (!TEAM[c || r.role]) continue;
      each(c || r.role, moved ? r.closedManager : r.manager, (o) => { o.cyc += (+r.avgCycleDays || 0) * (+r.wonOpps || 0); o.cycN += +r.wonOpps || 0; });
    }
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
