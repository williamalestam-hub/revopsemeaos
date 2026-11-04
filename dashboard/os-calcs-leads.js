// EMEA RevOps OS — calculations, leads. Each fn uses only its inputs and constants written inside it,
// so readers can check the arithmetic in Sources. "Today" is the reader's clock. Loaded after os-calcs.js
// (its own file to keep each file well under the 256 KB limit).

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
      // LATAM is EMEA's, though LeanData files it under Rest of World or North America
      if (r.routingRegion && r.routingRegion !== 'EMEA' && r.routingSub !== 'LATAM') { o.elsewhere += n; o.regions[r.routingRegion] = (o.regions[r.routingRegion] || 0) + n; }
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
