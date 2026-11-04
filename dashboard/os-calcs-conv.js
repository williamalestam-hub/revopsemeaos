// EMEA RevOps OS — Conversion calcs: what becomes of the New Business (and Upsell) opps EMEA creates, for Created opps ›
// Conversion, leaders' 1:1 agendas, data checks and the weekly summary. Each fn uses only its inputs and constants
// written inside it, so readers can check the arithmetic in Sources; the shared rules are therefore written out in
// every calc that needs them:
// - Teams by Salesforce role (TEAM). SMB is its own segment, everything else is Field. The motion (CLASS) decides who
//   is compared with whom: an AE team with the other AE teams, a manager with the rest of their motion (AE teams or
//   SMB) when 80% or more of their deals are in it; BDR-, Engagement- and Leadership-owned deals with nobody. A manager
//   compared within a motion is shown on the deals compared (their deals in that motion), so a rate and its verdict
//   always describe the same deals; cmpWhat and allN say so when they hold other deals too.
// - A closed deal counts for the team that closed it: the owner's role at close when that is an EMEA sales role, else
//   the current owner's (not stamped, or a role at close such as another region's or RevOps). One that has since moved
//   to someone in another role also counts for its manager at close (no manager when that isn't stamped); otherwise for
//   today's manager, as in Bookings and Coverage. Open deals: the owner today.
// - Stages are read by number from the stage entry dates, never by name (stage 3 was renamed on 3 Nov 2026).
// - Quarters are fiscal quarters (calendar quarters here); "this quarter" is today's UTC date, as in Coverage.

dash.calc('conv_mgr', {
  title: 'Conversion: each manager\'s main team',
  description: 'For each manager of EMEA sellers, the team most of their active direct reports are in (by Salesforce role) and how many of them are. Win rate, losses and sources are measured per team, so with a manager picked they show this team and say so; leaks, cohorts and time in stage show the manager\'s direct reports.',
  inputs: ['roster'],
  fn: (roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const m = new Map();
    for (const u of roster) {
      const t = TEAM[u.role];
      if (u.isActive === false || !t || !u.manager || u.manager === '(no manager)') continue;
      const o = m.get(u.manager) || {};
      o[t] = (o[t] || 0) + 1;
      m.set(u.manager, o);
    }
    return [...m].map(([manager, o]) => {
      const reports = Object.values(o).reduce((a, b) => a + b, 0);
      const [team, inTeam] = Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      return { manager, team, reports, inTeam, share: inTeam / reports };
    }).sort((a, b) => a.manager.localeCompare(b.manager));
  },
});

dash.calc('conv_cohorts', {
  title: 'Conversion by cohort',
  description: 'New Business and Upsell opportunities created in each of the last 4 completed quarters and this one (in your Salesforce time zone), admin merges left out, for all EMEA, SMB, Field, each team and each manager (direct reports): how many were created, how many reached each stage (stage entry dates; a skipped stage is dated too, a later stage implies the earlier ones and a win passed every stage), how many are won, lost or still open, and the share won within 2 quarters: won by the end of the quarter after the one they were created in, the same age for every quarter, shown once that following quarter has ended and from 20 created, with the share still open at 2 quarters (Field deals take longer than SMB\'s, so each segment is compared with its own earlier quarters). An AE team is compared with the other AE teams, and a manager with the rest of their motion (AE teams or SMB) when 80% or more of the New Business they hold is in it, in the same quarter (30+ created on each side, 5+ points and twice the normal swing); BDR-, Engagement- and Leadership-owned deals are never compared and never part of anyone\'s peers. Such a manager\'s rows are their deals in that motion, the ones compared (cmpWhat names them when they hold other deals too; allN counts all of them); when those never reach 20 in a comparable quarter but all their deals do, their cohort rows and the scope show all their deals, not compared. Each is also compared with its own quarter before, except All EMEA and managers whose deals mix motions, whose totals move with the mix. A closed deal counts for the team that closed it: its owner\'s role at close when that is an EMEA sales role (also when the deal is owned outside EMEA today), else the current owner\'s; one since moved to someone in another role counts for its manager at close, otherwise for today\'s manager. Won of those closed so far is context only: wins come faster than losses, so it reads high for young quarters. Also open New Business created 3 or more quarters ago (older ones included) that never reached stage 2. Upsell shows outcomes only (its stages changed during 2026).',
  inputs: ['cv_open', 'cv_closed'],
  fn: (cv_open, cv_closed) => {
    const MIN_N = 20;
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const AE = ['France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA'];
    const SEG = (t) => (t === 'SMB' ? 'SMB' : 'Field');
    const CLASS = (t) => (AE.includes(t) ? 'AE' : t === 'SMB' ? 'SMB' : t === 'BDR' ? 'BDR' : t === 'Engagement' ? 'EM' : t === 'Leadership' ? 'Lead' : 'Other');
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
    const qi = (fy, fq) => (fy == null || fq == null ? null : +fy * 4 + (+fq - 1));
    const label = (i) => 'Q' + ((i % 4) + 1) + ' ' + Math.floor(i / 4);
    const MONTHS = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];
    const qStart = (i) => Date.UTC(Math.floor(i / 4), (i % 4) * 3, 1);
    const dayTxt = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    // who a closed deal counts for: the team that closed it (its role at close when that is an EMEA sales role, else the
    // owner's today); its manager at close when it has since moved to someone in another role, else today's manager
    const closedBy = (r) => (TEAM[r.closedRole] ? r.closedRole : null);
    const closeTeam = (r) => TEAM[closedBy(r) || r.role] || 'Other';
    const moved = (r) => !!(closedBy(r) && closedBy(r) !== r.role);
    const closeMgr = (r) => (moved(r) ? r.closedManager || null : r.manager || '(no manager)');
    // the scopes a row adds to, each once; 'S|AE' (the AE peer pool) and 'M|<manager>#<motion>' are internal
    const keysOf = (team, mgr) => { const ks = ['All', 'S|' + SEG(team), team]; if (CLASS(team) === 'AE') ks.push('S|AE'); if (mgr && mgr !== '(no manager)') ks.push('M|' + mgr, 'M|' + mgr + '#' + CLASS(team)); return [...new Set(ks)]; };
    const internal = (k) => k === 'S|AE' || k.includes('#');
    const z2 = (x1, n1, x2, n2) => { if (!(n1 > 0 && n2 > 0)) return null; const p = (x1 + x2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)); return se > 0 ? (x1 / n1 - x2 / n2) / se : 0; };
    const verdict = (x1, n1, x2, n2) => { if (!(n1 >= 30 && n2 >= 30)) return 'too few'; const g = x1 / n1 - x2 / n2, z = z2(x1, n1, x2, n2); return g <= -0.05 && z <= -2 ? 'below' : g >= 0.05 && z >= 2 ? 'above' : 'similar'; };
    const wilson = (x, n) => { const z = 1.96, p = x / n, d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
    // stage reached from the stage entry dates: every deal reached stage 0, a later stage implies the earlier ones, a win passed every stage
    const env = (r, won) => { const n = +r.n || 0, raw = [0, 1, 2, 3, 4, 5, 6].map((k) => +r['s' + k] || 0), s = new Array(7).fill(n); if (!won) for (let k = 6; k >= 1; k--) s[k] = Math.min(n, Math.max(raw[k], k < 6 ? s[k + 1] : 0)); return { n, raw, s, fix: won ? 0 : s.slice(1).reduce((a, v, i) => a + v - raw[i + 1], 0) }; };
    const cells = new Map(), stale = new Map(), tal = new Map();
    const fresh = (k, rt, q) => ({ k, rt, q, n: 0, arr: 0, open: 0, openArr: 0, won: 0, wonArr: 0, lost: 0, lostArr: 0, s: [0, 0, 0, 0, 0, 0, 0], y2qWon: 0, y2qLost: 0, y2qWonArr: 0, openWonBefore: 0, openLostBefore: 0, wonAfterLoss: 0, lostAfterWin: 0, backdated: 0, orderFixed: 0, noS0: 0 });
    const cell = (k, rt, q) => {
      const id = k + '|' + rt + '|' + q;
      if (!cells.has(id)) cells.set(id, fresh(k, rt, q));
      return cells.get(id);
    };
    const add = (r, team, mgr, st, age) => {
      const q = qi(r.fy, r.fq);
      if (q == null) return;
      const nb = r.rt === 'New Business', e = env(r, st === 'won'), arr = +r.arr || 0, keys = keysOf(team, mgr);
      if (nb && st === 'open' && q <= cur - 3) for (const k of keys) stale.set(k, (stale.get(k) || 0) + e.n - e.s[2]);
      if (q < cur - 4 || q > cur) return;
      if (nb && mgr && mgr !== '(no manager)') { const t = tal.get(mgr) || {}; t[CLASS(team)] = (t[CLASS(team)] || 0) + e.n; tal.set(mgr, t); }
      // closed before the quarter it was created in (logged after signing): counts as closed in that quarter
      const a = age == null ? null : Math.max(0, age);
      for (const k of keys) {
        const c = cell(k, r.rt, q);
        c.n += e.n; c.arr += arr;
        if (age != null && age < 0) c.backdated += e.n;
        if (st === 'open') { c.open += e.n; c.openArr += arr; c.openWonBefore += +r.cwStamp || 0; c.openLostBefore += +r.clStamp || 0; }
        else if (st === 'won') { c.won += e.n; c.wonArr += arr; c.wonAfterLoss += +r.clStamp || 0; if (a <= 1) { c.y2qWon += e.n; c.y2qWonArr += arr; } }
        else { c.lost += e.n; c.lostArr += arr; c.lostAfterWin += +r.cwStamp || 0; if (a <= 1) c.y2qLost += e.n; }
        if (nb) { for (let i = 0; i < 7; i++) c.s[i] += e.s[i]; c.orderFixed += e.fix; c.noS0 += e.n - e.raw[0]; }
      }
    };
    for (const r of cv_open) add(r, TEAM[r.role] || 'Other', r.manager || '(no manager)', 'open', null);
    for (const r of cv_closed) { const q = qi(r.fy, r.fq), cq = qi(r.cfy, r.cfq); add(r, closeTeam(r), closeMgr(r), r.won ? 'won' : 'lost', q == null || cq == null ? 99 : cq - q); }
    // a manager's motion: the one holding most of the New Business they hold in the five quarters; mixed under 80%
    const mot = new Map([...tal].map(([m, t]) => { const e = Object.entries(t).sort((a, b) => b[1] - a[1]), tot = e.reduce((s, x) => s + x[1], 0) || 1; return [m, { main: e[0][0], mainShare: e[0][1] / tot, mixed: e[0][1] / tot < 0.8 }]; }));
    const peerOf = (k) => {
      if (k.startsWith('M|')) { const m = mot.get(k.slice(2)); return m && !m.mixed && (m.main === 'AE' || m.main === 'SMB') ? [k + '#' + m.main, 'S|' + m.main, m.main === 'AE' ? 'the rest of the AE teams' : 'the rest of SMB'] : null; }
      return k !== 'All' && !k.startsWith('S|') && CLASS(k) === 'AE' ? [k, 'S|AE', 'other AE teams'] : null;
    };
    const noTrend = (k) => k === 'All' || (k.startsWith('M|') && (!mot.get(k.slice(2)) || mot.get(k.slice(2)).mixed));
    const levelOf = (k) => (k === 'All' ? 'all' : k.startsWith('S|') ? 'segment' : k.startsWith('M|') ? 'manager' : 'team');
    const segOf = (k) => (k === 'All' ? null : k.startsWith('S|') ? k.slice(2) : k.startsWith('M|') ? (mot.get(k.slice(2)) ? (mot.get(k.slice(2)).main === 'SMB' ? 'SMB' : 'Field') : null) : SEG(k));
    const get = (k, rt, q) => cells.get(k + '|' + rt + '|' + q) || null;
    const dayOfQ = Math.floor((now.getTime() - qStart(cur)) / 864e5) + 1, daysInQ = Math.round((qStart(cur + 1) - qStart(cur)) / 864e5);
    const cmpName = (k) => (mot.get(k.slice(2)) || {}).main === 'SMB' ? 'SMB deals' : 'AE-team deals';
    // a manager compared within a motion whose deals in it never reach 20 in a comparable quarter, while all their deals do
    // in one: the quarter whose share all their deals show (their cohort rows and scope row alike, not compared), else null
    const fewQ = (k, rt) => {
      const P = peerOf(k), Q = [cur - 2, cur - 3, cur - 4];
      if (!P || P[0] === k || Q.some((q) => (get(P[0], rt, q) || { n: 0 }).n >= MIN_N)) return null;
      const q = Q.find((x) => (get(k, rt, x) || { n: 0 }).n >= MIN_N);
      return q == null ? null : q;
    };
    const out = [];
    for (const c0 of cells.values()) {
      if (internal(c0.k)) continue;
      // a manager compared within one motion shows the deals compared ('M|<manager>#<motion>'): a rate of all their deals
      // would sit beside a verdict on part of them. allN keeps all their deals; cmpWhat names the part when it is smaller.
      // When those are too few to compare (fewQ), the rows are all their deals, with no peer or trend verdict.
      const few = fewQ(c0.k, c0.rt) != null, P = peerOf(c0.k), own = P && !few ? P[0] : c0.k, c = own === c0.k ? c0 : get(own, c0.rt, c0.q) || fresh(own, c0.rt, c0.q);
      const ageQ = cur - c.q, comparable = ageQ >= 2, nb = c.rt === 'New Business', ok = comparable && c.n >= MIN_N;
      let peerN = null, peerY2q = null, y2qZ = null, y2qVerdict = null;
      if (P && comparable && !few) {
        const mine = get(P[0], c.rt, c.q), pool = get(P[1], c.rt, c.q);
        const pn = (pool ? pool.n : 0) - (mine ? mine.n : 0), pw = (pool ? pool.y2qWon : 0) - (mine ? mine.y2qWon : 0);
        peerN = pn; peerY2q = pn >= MIN_N ? pw / pn : null;
        if (mine && mine.n > 0 && pn > 0) { y2qZ = z2(mine.y2qWon, mine.n, pw, pn); y2qVerdict = verdict(mine.y2qWon, mine.n, pw, pn); }
      }
      const mixed = noTrend(c0.k) || few;
      const prev = comparable ? get(own, c.rt, c.q - 1) : null;
      const prevY2q = prev && prev.n >= MIN_N ? prev.y2qWon / prev.n : null;
      const [y2qLo, y2qHi] = ok ? wilson(c.y2qWon, c.n) : [null, null];
      const o = {
        key: c0.k + '|' + c.rt + '|' + c.q, kind: 'cohort', scope: c0.k, level: levelOf(c0.k), segment: segOf(c0.k), peerLabel: P ? P[2] : '', rt: c.rt,
        allN: c0.n, cmpWhat: own !== c0.k && c.n !== c0.n ? cmpName(c0.k) : null,
        cohort: c.q, label: label(c.q), months: MONTHS[c.q % 4], ageQ, comparable, compAfter: dayTxt(qStart(c.q + 2) - 864e5),
        status: c.n < MIN_N ? 'Too few' : comparable ? 'Comparable' : ageQ === 0 ? 'This quarter' : 'So far', isCurrent: ageQ === 0,
        dayOfQ: ageQ === 0 ? dayOfQ : null, daysInQ: ageQ === 0 ? daysInQ : null,
        n: c.n, arr: c.arr, open: c.open, openArr: c.openArr, won: c.won, wonArr: c.wonArr, lost: c.lost, lostArr: c.lostArr,
        wonShare: c.n ? c.won / c.n : null, lostShare: c.n ? c.lost / c.n : null, openShare: c.n ? c.open / c.n : null,
        closedRate: c.won + c.lost >= MIN_N ? c.won / (c.won + c.lost) : null, noS0: nb ? c.noS0 : null,
        y2qWon: c.y2qWon, y2qLost: c.y2qLost, y2q: ok ? c.y2qWon / c.n : null, y2qLo, y2qHi, y2qArr: ok ? c.y2qWonArr / c.n : null,
        y2qOpen: ok ? (c.n - c.y2qWon - c.y2qLost) / c.n : null, peerN, peerY2q, y2qZ, y2qVerdict,
        prevCohort: prev ? label(c.q - 1) : null, prevY2q, trendZ: !mixed && ok && prevY2q != null ? z2(c.y2qWon, c.n, prev.y2qWon, prev.n) : null,
        trend: !mixed && ok && prevY2q != null ? verdict(c.y2qWon, c.n, prev.y2qWon, prev.n) : null, trendNote: few ? 'few' : mixed ? 'mix' : null,
        openWonBefore: c.openWonBefore, openLostBefore: c.openLostBefore, wonAfterLoss: c.wonAfterLoss, lostAfterWin: c.lostAfterWin, backdated: c.backdated, orderFixed: nb ? c.orderFixed : null,
      };
      for (let k = 1; k <= 6; k++) o['reach' + k] = nb && c.n ? c.s[k] / c.n : null;
      out.push(o);
    }
    out.sort((a, b) => b.cohort - a.cohort || a.key.localeCompare(b.key));
    const scopes = new Map();
    for (const o of out) { const id = o.scope + '|' + o.rt; if (!scopes.has(id)) scopes.set(id, []); scopes.get(id).push(o); }
    for (const k of stale.keys()) if (!internal(k) && !scopes.has(k + '|New Business')) scopes.set(k + '|New Business', []);
    const row = (scope, rt, q) => out.find((o) => o.scope === scope && o.rt === rt && o.cohort === q) || null;
    const rows = out.slice();
    for (const [id, list] of scopes) {
      const cut = id.lastIndexOf('|'), scope = id.slice(0, cut), rt = id.slice(cut + 1);
      const L = list.find((o) => o.comparable && o.n >= MIN_N) || null, cc = list.find((o) => o.cohort === cur) || null;
      const m = scope.startsWith('M|') ? mot.get(scope.slice(2)) || null : null, P = peerOf(scope);
      const o = {
        key: id, kind: 'scope', scope, level: levelOf(scope), segment: segOf(scope), peerLabel: P ? P[2] : '', rt,
        y2q: L ? L.y2q : null, y2qWon: L ? L.y2qWon : null, y2qN: L ? L.n : null, y2qLo: L ? L.y2qLo : null, y2qHi: L ? L.y2qHi : null,
        y2qArr: L ? L.y2qArr : null, y2qOpen: L ? L.y2qOpen : null, y2qLost: L ? L.y2qLost : null, y2qCohort: L ? L.label : null,
        y2qAllN: L ? L.allN : null, cmpWhat: L ? L.cmpWhat : P && P[0] !== scope && m && m.mainShare < 1 ? cmpName(scope) : null,
        peerY2q: L ? L.peerY2q : null, peerN: L ? L.peerN : null, y2qVerdict: L ? L.y2qVerdict : null, prevCohort: L ? L.prevCohort : null,
        prevY2q: L ? L.prevY2q : null, trend: L ? L.trend : null, trendNote: noTrend(scope) ? 'mix' : null,
        staleOpen: rt === 'New Business' ? stale.get(scope) || 0 : null, staleFrom: label(cur - 3),
        curCreated: cc ? cc.n : 0, curWon: cc ? cc.won : 0, curLost: cc ? cc.lost : 0, curOpen: cc ? cc.open : 0,
        mainClass: m ? m.main : null, mainShare: m ? m.mainShare : null, mixed: m ? m.mixed : null,
      };
      // a manager compared within a motion whose deals in it never reach 20 in a comparable quarter, while all their deals
      // do: all their deals, not compared (as their 1:1 agenda and their cohort rows), with how many were in the motion (fewN)
      const q0 = fewQ(scope, rt);
      if (q0 != null) {
        const a = get(scope, rt, q0), [lo, hi] = wilson(a.y2qWon, a.n);
        Object.assign(o, { y2q: a.y2qWon / a.n, y2qWon: a.y2qWon, y2qN: a.n, y2qLo: lo, y2qHi: hi, y2qArr: a.y2qWonArr / a.n, y2qOpen: (a.n - a.y2qWon - a.y2qLost) / a.n,
          y2qLost: a.y2qLost, y2qCohort: label(q0), y2qAllN: a.n, cmpWhat: null, peerY2q: null, peerN: null, y2qVerdict: null, prevCohort: null, prevY2q: null, trend: null,
          trendNote: 'few', fewWhat: cmpName(scope), fewN: (get(P[0], rt, q0) || { n: 0 }).n });
      }
      if (scope === 'All' && rt === 'New Business' && L) {
        const s = row('S|SMB', rt, L.cohort), f = row('S|Field', rt, L.cohort), sp = row('S|SMB', rt, L.cohort - 1), ap = row('All', rt, L.cohort - 1);
        Object.assign(o, { smbY2q: s ? s.y2q : null, fieldY2q: f ? f.y2q : null, smbArr: s ? s.y2qArr : null, fieldArr: f ? f.y2qArr : null,
          smbY2qOpen: s ? s.y2qOpen : null, fieldY2qOpen: f ? f.y2qOpen : null, smbPrevY2q: s ? s.prevY2q : null, fieldPrevY2q: f ? f.prevY2q : null,
          smbTrend: s ? s.trend : null, fieldTrend: f ? f.trend : null, smbShare: s && L.n ? s.n / L.n : 0, prevSmbShare: ap && ap.n ? (sp ? sp.n : 0) / ap.n : null });
      }
      rows.push(o);
    }
    return rows;
  },
});

dash.calc('conv_steps', {
  title: 'Where deals leak',
  description: 'New Business created in the three most recent quarters whose following quarter has ended, pooled, for all EMEA, SMB, Field, each team and each manager (direct reports): how many reached each stage and what has happened to them since (won, lost, still open), and five steps: stage 0 → 1, 1 → 2, 2 → 3, 3 → 4 and stages 4–6 → won (most moves out of stages 5 and 6 are same-day paperwork, so the three are rated together). A step\'s rate counts only deals that have left the stage (moved on, or lost there), with the range if every deal still in it were lost or moved on; it shows from 20 such deals and is early while more than a quarter of the deals that reached the stage are still in it. An AE team is compared with the other AE teams, and a manager with the rest of their motion (AE teams or SMB) when 80% or more of the New Business they hold is in it, on the same created quarters (each quarter\'s peer rate, weighted by the team\'s own deals): a leak is a step 5 or more points below that, beyond twice the normal swing, with 3 or more deals behind; deals behind is how many more would have moved on at the peers\' rate. cmpSteps counts the steps that could be compared (a rate, settled, a peer rate): with none, nothing can be flagged. Such a manager is rated on their deals in that motion, the ones compared (cmpWhat names them when they hold other deals too; allCreated counts all of them). All EMEA, SMB, Field, the BDR, Engagement and Leadership teams (other motions, never anyone\'s peers) and managers whose deals mix motions have no peers and show their lowest step. A closed deal counts for the team that closed it (its owner\'s role at close when that is an EMEA sales role, else the current owner\'s); one since moved to someone in another role counts for its manager at close, otherwise for today\'s manager. Also the share won within 2 quarters, pooled, against the same peers.',
  inputs: ['cv_open', 'cv_closed'],
  fn: (cv_open, cv_closed) => {
    const MIN_DEC = 20, SETTLED = 0.25, GAP = 0.05, Z = 2, MIN_BEHIND = 3, MIN_PEER_Q = 10;
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const AE = ['France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA'];
    const SEG = (t) => (t === 'SMB' ? 'SMB' : 'Field');
    const CLASS = (t) => (AE.includes(t) ? 'AE' : t === 'SMB' ? 'SMB' : t === 'BDR' ? 'BDR' : t === 'Engagement' ? 'EM' : t === 'Leadership' ? 'Lead' : 'Other');
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
    const qi = (fy, fq) => (fy == null || fq == null ? null : +fy * 4 + (+fq - 1));
    const label = (i) => 'Q' + ((i % 4) + 1) + ' ' + Math.floor(i / 4);
    // the team that closed a deal: its role at close when that is an EMEA sales role, else the owner's today
    const closedBy = (r) => (TEAM[r.closedRole] ? r.closedRole : null);
    const closeTeam = (r) => TEAM[closedBy(r) || r.role] || 'Other';
    const moved = (r) => !!(closedBy(r) && closedBy(r) !== r.role);
    const closeMgr = (r) => (moved(r) ? r.closedManager || null : r.manager || '(no manager)');
    const keysOf = (team, mgr) => { const ks = ['All', 'S|' + SEG(team), team]; if (CLASS(team) === 'AE') ks.push('S|AE'); if (mgr && mgr !== '(no manager)') ks.push('M|' + mgr, 'M|' + mgr + '#' + CLASS(team)); return [...new Set(ks)]; };
    const internal = (k) => k === 'S|AE' || k.includes('#');
    const env = (r, won) => { const n = +r.n || 0, raw = [0, 1, 2, 3, 4, 5, 6].map((k) => +r['s' + k] || 0), s = new Array(7).fill(n); if (!won) for (let k = 6; k >= 1; k--) s[k] = Math.min(n, Math.max(raw[k], k < 6 ? s[k + 1] : 0)); return { n, raw, s, fix: won ? 0 : s.slice(1).reduce((a, v, i) => a + v - raw[i + 1], 0) }; };
    const BANDS = [['b0', 0, 'Stage 0 → 1', 'Qualification → Solution agreement'], ['b1', 1, 'Stage 1 → 2', 'Solution agreement → Scope agreement'], ['b2', 2, 'Stage 2 → 3', 'Scope agreement → Validation'],
      ['b3', 3, 'Stage 3 → 4', 'Validation → Commercial agreement'], ['b46', 4, 'Stages 4–6 → won', 'Commercial agreement, Vendor assessment and Opt-out → won']];
    const POOL = [cur - 4, cur - 3, cur - 2];
    const part = () => ({ n: 0, arr: 0, s: [0, 0, 0, 0, 0, 0, 0] });
    const blank = () => ({ won: part(), lost: part(), open: part(), y2qWon: 0, orderFixed: 0, noS0: 0 });
    const cells = new Map(), tal = new Map();
    const add = (r, team, mgr, st, age) => {
      if (r.rt !== 'New Business') return;
      const q = qi(r.fy, r.fq);
      if (q == null || q < cur - 4 || q > cur) return;
      const e = env(r, st === 'won');
      if (mgr && mgr !== '(no manager)') { const t = tal.get(mgr) || {}; t[CLASS(team)] = (t[CLASS(team)] || 0) + e.n; tal.set(mgr, t); }
      if (!POOL.includes(q)) return;
      for (const k of keysOf(team, mgr)) {
        if (!cells.has(k)) cells.set(k, new Map());
        const byQ = cells.get(k);
        if (!byQ.has(q)) byQ.set(q, blank());
        const c = byQ.get(q), x = c[st];
        x.n += e.n; x.arr += +r.arr || 0;
        for (let i = 0; i < 7; i++) x.s[i] += e.s[i];
        if (st === 'won' && age <= 1) c.y2qWon += e.n;
        c.orderFixed += e.fix; c.noS0 += e.n - e.raw[0];
      }
    };
    for (const r of cv_open) add(r, TEAM[r.role] || 'Other', r.manager || '(no manager)', 'open', null);
    for (const r of cv_closed) { const q = qi(r.fy, r.fq), cq = qi(r.cfy, r.cfq); add(r, closeTeam(r), closeMgr(r), r.won ? 'won' : 'lost', q == null || cq == null ? 99 : cq - q); }
    const mot = new Map([...tal].map(([m, t]) => { const e = Object.entries(t).sort((a, b) => b[1] - a[1]), tot = e.reduce((s, x) => s + x[1], 0) || 1; return [m, { main: e[0][0], mainShare: e[0][1] / tot, mixed: e[0][1] / tot < 0.8 }]; }));
    const peerOf = (k) => {
      if (k.startsWith('M|')) { const m = mot.get(k.slice(2)); return m && !m.mixed && (m.main === 'AE' || m.main === 'SMB') ? [k + '#' + m.main, 'S|' + m.main, m.main === 'AE' ? 'the rest of the AE teams' : 'the rest of SMB'] : null; }
      return k !== 'All' && !k.startsWith('S|') && CLASS(k) === 'AE' ? [k, 'S|AE', 'other AE teams'] : null;
    };
    const addC = (o, c, sign) => { if (!c) return o; for (const st of ['won', 'lost', 'open']) { o[st].n += sign * c[st].n; o[st].arr += sign * c[st].arr; for (let i = 0; i < 7; i++) o[st].s[i] += sign * c[st].s[i]; } o.y2qWon += sign * c.y2qWon; o.orderFixed += sign * c.orderFixed; o.noS0 += sign * c.noS0; return o; };
    const created = (c) => c.won.n + c.lost.n + c.open.n;
    // a step: moved on (got past the stage, whatever happened later; every win), lost there, still in it
    const band = (c, b) => {
      if (b === 4) { const moved = c.won.n, lost = c.lost.s[4], still = c.open.s[4]; return { reached: moved + lost + still, moved, lost, still }; }
      const moved = c.won.s[b + 1] + c.lost.s[b + 1] + c.open.s[b + 1];
      return { reached: c.won.s[b] + c.lost.s[b] + c.open.s[b], moved, lost: c.lost.s[b] - c.lost.s[b + 1], still: c.open.s[b] - c.open.s[b + 1] };
    };
    // against the peers on the same created quarters: each quarter's peer rate, weighted by the compared deals
    const cmp = (P, f) => {
      if (!P) return null;
      const mine = cells.get(P[0]) || new Map(), pool = cells.get(P[1]) || new Map();
      const peerQ = (q) => addC(addC(blank(), pool.get(q), 1), mine.get(q), -1);
      let pm = 0, pd = 0;
      for (const q of POOL) { const [a, b] = f(peerQ(q)); pm += a; pd += b; }
      let m = 0, d = 0, e = 0, v = 0;
      for (const q of POOL) {
        const c = mine.get(q);
        if (!c) continue;
        const [m1, d1] = f(c);
        if (!(d1 > 0)) continue;
        const [m2, d2] = f(peerQ(q));
        const p = d2 >= MIN_PEER_Q ? m2 / d2 : pd >= MIN_PEER_Q ? pm / pd : null;
        if (p == null) continue;
        m += m1; d += d1; e += d1 * p; v += d1 * p * (1 - p);
      }
      return d ? { exp: e / d, gap: (m - e) / d, z: v > 0 ? (m - e) / Math.sqrt(v) : 0, behind: e - m } : null;
    };
    const rank = { all: 0, segment: 1, team: 2, manager: 3 };
    const pooled = (byQ) => [...byQ.values()].reduce((o, c) => addC(o, c, 1), blank());
    const out = [];
    for (const [k, byQ] of cells) {
      if (internal(k)) continue;
      const level = k === 'All' ? 'all' : k.startsWith('S|') ? 'segment' : k.startsWith('M|') ? 'manager' : 'team';
      const m = level === 'manager' ? mot.get(k.slice(2)) || null : null, P = peerOf(k);
      // a manager compared within one motion is rated on the deals compared ('M|<manager>#<motion>'): rates, flags and
      // deals behind all describe the same deals. allCreated counts all their deals; cmpWhat names the part when smaller.
      const own = P ? P[0] : k, all = created(pooled(byQ)), T = own === k ? pooled(byQ) : pooled(cells.get(own) || new Map()), n = created(T);
      const o = {
        key: k, level, label: k === 'All' ? 'All EMEA' : level === 'segment' || level === 'manager' ? k.slice(2) : k,
        segment: level === 'all' ? null : level === 'segment' ? k.slice(2) : level === 'team' ? SEG(k) : m ? (m.main === 'SMB' ? 'SMB' : 'Field') : null,
        peerLabel: P ? P[2] : '', poolFrom: label(POOL[0]), poolTo: label(POOL[2]), created: n, won: T.won.n, lost: T.lost.n, open: T.open.n,
        allCreated: all, cmpWhat: own !== k && n !== all ? (m && m.main === 'SMB' ? 'SMB deals' : 'AE-team deals') : null,
        arr: T.won.arr + T.lost.arr + T.open.arr, wonArr: T.won.arr, y2q: n >= MIN_DEC ? T.y2qWon / n : null, orderFixed: T.orderFixed, noS0: T.noS0,
        mainClass: m ? m.main : null, mainShare: m ? m.mainShare : null, mixed: m ? m.mixed : null,
      };
      for (let i = 0; i < 7; i++) Object.assign(o, { ['reached' + i]: T.won.s[i] + T.lost.s[i] + T.open.s[i], ['sWon' + i]: T.won.s[i], ['sOpen' + i]: T.open.s[i], ['sLost' + i]: T.lost.s[i] });
      const yc = cmp(P, (c) => [c.y2qWon, created(c)]);
      Object.assign(o, { y2qExp: yc ? yc.exp : null, y2qZ: yc ? yc.z : null, y2qFlag: yc && n >= 30 && Math.abs(yc.gap) >= GAP && Math.abs(yc.z) >= Z ? (yc.gap < 0 ? 'below' : 'above') : '' });
      for (const [id, b] of BANDS) {
        const x = band(T, b), dec = x.moved + x.lost, settled = x.reached > 0 && x.still / x.reached <= SETTLED;
        const c = cmp(P, (cc) => { const y = band(cc, b); return [y.moved, y.moved + y.lost]; });
        const flag = c && dec >= MIN_DEC && settled ? (c.gap <= -GAP && c.z <= -Z && c.behind >= MIN_BEHIND ? 'leak' : c.gap >= GAP && c.z >= Z ? 'strong' : '') : '';
        Object.assign(o, { [id + 'Reached']: x.reached, [id + 'Moved']: x.moved, [id + 'Lost']: x.lost, [id + 'Still']: x.still, [id + 'Decided']: dec,
          [id + 'Rate']: dec >= MIN_DEC ? x.moved / dec : null, [id + 'Lower']: x.reached ? x.moved / x.reached : null, [id + 'Upper']: x.reached ? (x.moved + x.still) / x.reached : null,
          [id + 'Settled']: settled, [id + 'Exp']: c ? c.exp : null, [id + 'Gap']: c ? c.gap : null, [id + 'Z']: c ? c.z : null, [id + 'Behind']: c ? c.behind : null, [id + 'Flag']: flag });
      }
      const leaks = BANDS.filter(([id]) => o[id + 'Flag'] === 'leak').sort((a, b) => o[b[0] + 'Behind'] - o[a[0] + 'Behind']);
      const L = leaks[0] || null, S = BANDS.find(([id]) => o[id + 'Flag'] === 'strong') || null;
      const low = BANDS.filter(([id]) => o[id + 'Settled'] && o[id + 'Rate'] != null).sort((a, b) => o[a[0] + 'Rate'] - o[b[0] + 'Rate'])[0] || null;
      // the steps actually compared with the peers (a rate, settled and a peer rate): with none, nothing can be flagged
      const cmpSteps = BANDS.filter(([id]) => o[id + 'Rate'] != null && o[id + 'Settled'] && o[id + 'Exp'] != null).length;
      Object.assign(o, { leakBand: L ? L[0] : null, leakLabel: L ? L[2] : null, leakNames: L ? L[3] : null, leakRate: L ? o[L[0] + 'Rate'] : null, leakExp: L ? o[L[0] + 'Exp'] : null,
        leakBehind: L ? Math.round(o[L[0] + 'Behind']) : null, leakDecided: L ? o[L[0] + 'Decided'] : null, leaks: leaks.length, strongBand: S ? S[0] : null, cmpSteps: P ? cmpSteps : null,
        lowBand: low ? low[0] : null, lowLabel: low ? low[2] : null, lowNames: low ? low[3] : null, lowRate: low ? o[low[0] + 'Rate'] : null });
      out.push(o);
    }
    return out.sort((a, b) => rank[a.level] - rank[b.level] || (a.level === 'segment' ? (a.key === 'S|SMB' ? -1 : 1) : b.created - a.created) || a.key.localeCompare(b.key));
  },
});

dash.calc('conv_close', {
  title: 'Win rate and where losses leave',
  description: 'New Business closed in the last 4 completed quarters (by the date actually closed; admin merges left out), for all EMEA, SMB, Field and each team (the team that closed the deal: the owner\'s role at close when that is an EMEA sales role, also when the deal is owned outside EMEA today; the current owner\'s role when that wasn\'t stamped or is another region\'s, RevOps or the like): won, lost, the win rate by count and by ARR, per quarter; the win rate after qualification (losses at stage 0 left out); where losses left from (the last stage before Closed Lost, by number: 0, 1, 2, 3, 4–6) and their ARR; wins closed straight from stage 0; and this quarter so far. An AE team is compared with the other AE teams on the win rate and the share lost at stage 4–6 (30+ deals each side, 5+ points and twice the normal swing); SMB, BDR, Engagement and Leadership aren\'t compared. The same figures without a clean-up quarter are in conv_closeout.',
  inputs: ['cv_window'],
  fn: (cv_window) => {
    const MIN_N = 20;
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const AE = ['France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA'];
    const SEG = (t) => (t === 'SMB' ? 'SMB' : 'Field');
    const CLASS = (t) => (AE.includes(t) ? 'AE' : t === 'SMB' ? 'SMB' : t === 'BDR' ? 'BDR' : t === 'Engagement' ? 'EM' : t === 'Leadership' ? 'Lead' : 'Other');
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
    const qi = (fy, fq) => (fy == null || fq == null ? null : +fy * 4 + (+fq - 1));
    const label = (i) => 'Q' + ((i % 4) + 1) + ' ' + Math.floor(i / 4);
    // the team that closed a deal: its role at close when that is an EMEA sales role, else the owner's today
    const closedBy = (r) => (TEAM[r.closedRole] ? r.closedRole : null);
    const closeTeam = (r) => TEAM[closedBy(r) || r.role] || 'Other';
    const moved = (r) => !!(closedBy(r) && closedBy(r) !== r.role);
    const ADMIN = /^(merged with global pilot|record cleanup)$/i;
    // the last stage before close by its number: '3 - Pilot Validation' and '3 - Validation' are both 3
    const stageNo = (v) => { if (!v) return null; if (/^closed won/i.test(v)) return 'W'; const n = parseInt(v, 10); return n >= 0 && n <= 6 ? n : null; };
    const z2 = (x1, n1, x2, n2) => { if (!(n1 > 0 && n2 > 0)) return null; const p = (x1 + x2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)); return se > 0 ? (x1 / n1 - x2 / n2) / se : 0; };
    const verdict = (x1, n1, x2, n2) => { if (!(n1 >= 30 && n2 >= 30)) return 'too few'; const g = x1 / n1 - x2 / n2, z = z2(x1, n1, x2, n2); return g <= -0.05 && z <= -2 ? 'below' : g >= 0.05 && z >= 2 ? 'above' : 'similar'; };
    const wilson = (x, n) => { const z = 1.96, p = x / n, d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
    const last4 = [cur - 4, cur - 3, cur - 2, cur - 1];
    const m = new Map();
    const get = (k) => {
      if (!m.has(k)) m.set(k, { key: k, won4: 0, lost4: 0, wonArr4: 0, lostArr4: 0, byQ: last4.map(() => [0, 0]), lost0: 0, lost1: 0, lost2: 0, lost3: 0, lost46: 0, lostArr46: 0, lostAfterWin: 0, lostUnknown: 0, wonFrom0: 0, thisWon: 0, thisLost: 0, admin: 0, adminArr: 0, adminByQ: {}, attrClosing: 0, attrMoved: 0, attrLeft: 0, attrBlank: 0, attrOutside: 0 });
      return m.get(k);
    };
    for (const k of ['All', 'S|SMB', 'S|Field']) get(k);
    for (const r of cv_window) {
      const q = qi(r.fy, r.fq), qx = last4.indexOf(q), isThis = q === cur;
      if (qx < 0 && !isThis) continue;
      const won = r.won === true, n = +r.n || 0, arr = +r.arr || 0, team = closeTeam(r);
      const keys = [...new Set(['All', 'S|' + SEG(team), team].concat(CLASS(team) === 'AE' ? ['S|AE'] : []))];
      if (!won && ADMIN.test(r.reason || '')) { for (const k of keys) { const o = get(k); o.admin += n; o.adminArr += arr; o.adminByQ[label(q)] = (o.adminByQ[label(q)] || 0) + n; } continue; }
      // who closed it, on All: the role that owns it today, another role since (outside EMEA sales too), not stamped, or a
      // role at close outside EMEA sales (another region's, RevOps), which counts for the owner today
      const a = get('All');
      if (moved(r) && !TEAM[r.role]) a.attrLeft += n;
      if (qx >= 0) { if (!r.closedRole) a.attrBlank += n; else if (!TEAM[r.closedRole]) a.attrOutside += n; else if (!moved(r)) a.attrClosing += n; else a.attrMoved += n; }
      const s = stageNo(r.lastStage);
      for (const k of keys) {
        const o = get(k);
        if (isThis) { if (won) o.thisWon += n; else o.thisLost += n; continue; }
        if (won) { o.won4 += n; o.wonArr4 += arr; o.byQ[qx][0] += n; if (s === 0) o.wonFrom0 += n; continue; }
        o.lost4 += n; o.lostArr4 += arr; o.byQ[qx][1] += n;
        if (s === 'W') o.lostAfterWin += n; else if (s == null) o.lostUnknown += n; else if (s >= 4) { o.lost46 += n; o.lostArr46 += arr; } else o['lost' + s] += n;
      }
    }
    const known = (o) => o.lost4 - o.lostAfterWin - o.lostUnknown;
    const ae = get('S|AE');
    const out = [];
    for (const o of m.values()) {
      if (o.key === 'S|AE') continue;
      const closed4 = o.won4 + o.lost4, kn = known(o), qual = closed4 - o.lost0;
      const [wrLo, wrHi] = closed4 >= MIN_N ? wilson(o.won4, closed4) : [null, null];
      const level = o.key === 'All' ? 'all' : o.key.startsWith('S|') ? 'segment' : 'team';
      const peer = level === 'team' && CLASS(o.key) === 'AE';
      const r = { ...o, level, segment: level === 'all' ? null : level === 'segment' ? o.key.slice(2) : SEG(o.key), peerLabel: peer ? 'other AE teams' : '',
        closed4, winRate: closed4 >= MIN_N ? o.won4 / closed4 : null, wrLo, wrHi, arrWinRate: closed4 >= MIN_N && o.wonArr4 + o.lostArr4 > 0 ? o.wonArr4 / (o.wonArr4 + o.lostArr4) : null,
        qualWinRate: qual >= MIN_N ? o.won4 / qual : null, quarters: last4.map((q, i) => ({ label: label(q), won: o.byQ[i][0], lost: o.byQ[i][1], rate: o.byQ[i][0] + o.byQ[i][1] >= MIN_N ? o.byQ[i][0] / (o.byQ[i][0] + o.byQ[i][1]) : null })),
        known: kn, thisRate: o.thisWon + o.thisLost >= MIN_N ? o.thisWon / (o.thisWon + o.thisLost) : null,
        peerWinRate: null, winZ: null, winVerdict: null, peerLateShare: null, lateZ: null, lateVerdict: null, peerEarlyShare: null };
      delete r.byQ;
      for (const x of ['0', '1', '2', '3', '46']) r['share' + x] = kn >= MIN_N ? o['lost' + x] / kn : null;
      r.earlyShare = kn >= MIN_N ? (o.lost0 + o.lost1) / kn : null;
      r.lateShare = kn >= MIN_N ? o.lost46 / kn : null;
      if (peer) {
        const pw = ae.won4 - o.won4, pc = ae.won4 + ae.lost4 - closed4, pk = known(ae) - kn, pl = ae.lost46 - o.lost46, pe = ae.lost0 + ae.lost1 - o.lost0 - o.lost1;
        Object.assign(r, { peerWinRate: pc >= MIN_N ? pw / pc : null, winZ: z2(o.won4, closed4, pw, pc), winVerdict: verdict(o.won4, closed4, pw, pc),
          peerLateShare: pk >= MIN_N ? pl / pk : null, lateZ: z2(o.lost46, kn, pl, pk), lateVerdict: verdict(o.lost46, kn, pl, pk), peerEarlyShare: pk >= MIN_N ? pe / pk : null });
      }
      out.push(r);
    }
    const all = out.find((r) => r.key === 'All'), smb = out.find((r) => r.key === 'S|SMB'), field = out.find((r) => r.key === 'S|Field');
    if (all) Object.assign(all, { smbWinRate: smb ? smb.winRate : null, fieldWinRate: field ? field.winRate : null });
    const rank = { all: 0, segment: 1, team: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level] || b.closed4 - a.closed4 || a.key.localeCompare(b.key));
  },
});

dash.calc('conv_reasons', {
  title: 'Why deals are lost',
  description: 'New Business lost in the last 4 completed quarters (by the date actually closed; admin merges left out), for all EMEA, SMB, Field and each team (who closed them), by lost reason on the list used since 3 Nov 2026. Older reasons count under their new name, as in Pipeline › Bookings: Qualified Out as Not a fit, Timing as Deferred, Technical/Functional Gap as Product fit, Lost to Competitor as Chose an alternative, No Champion as Buyer engagement, Budget as Price and budget; Value not perceived has no clear new equivalent and keeps its name, as in Bookings. A value on neither list shows as Unlisted. Per reason: losses and their ARR, the share of the team\'s losses against the other AE teams, at which stage they left (0–1, 2–3, 4–6), each completed quarter and this one, and the older values it gathers. Whether a reason rose last quarter, and the figures without a clean-up quarter, are in conv_closeout.',
  inputs: ['cv_window'],
  fn: (cv_window) => {
    const MIN_PEER = 20;
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const AE = ['France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA'];
    const SEG = (t) => (t === 'SMB' ? 'SMB' : 'Field');
    const CLASS = (t) => (AE.includes(t) ? 'AE' : t === 'SMB' ? 'SMB' : t === 'BDR' ? 'BDR' : t === 'Engagement' ? 'EM' : t === 'Leadership' ? 'Lead' : 'Other');
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
    const qi = (fy, fq) => (fy == null || fq == null ? null : +fy * 4 + (+fq - 1));
    // the team that closed a deal: its role at close when that is an EMEA sales role, else the owner's today
    const closeTeam = (r) => TEAM[(TEAM[r.closedRole] ? r.closedRole : null) || r.role] || 'Other';
    const ADMIN = /^(merged with global pilot|record cleanup)$/i;
    const stageNo = (v) => { if (!v) return null; if (/^closed won/i.test(v)) return 'W'; const n = parseInt(v, 10); return n >= 0 && n <= 6 ? n : null; };
    // the reason list changed on 3 Nov 2026: the same map as lost_reasons (Pipeline › Bookings)
    const REASON = { 'Qualified Out': 'Not a fit', 'Timing': 'Deferred', 'Technical/Functional Gap': 'Product fit', 'Lost to Competitor': 'Chose an alternative',
      'No Champion': 'Buyer engagement', 'Budget': 'Price and budget', 'Value not perceived': 'Value not perceived' };
    const NEW = ['Chose an alternative', 'Product fit', 'Price and budget', 'Buyer engagement', 'Deferred', 'Not a fit', 'Customer experience and support', 'Other'];
    const group = (v) => (!v ? 'No reason given' : REASON[v] || (NEW.includes(v) ? v : 'Unlisted: ' + v));
    const last4 = [cur - 4, cur - 3, cur - 2, cur - 1];
    const scopes = new Map(), reasons = new Map();
    const sc = (k) => { if (!scopes.has(k)) scopes.set(k, { key: k + '|*', kind: 'scope', scope: k, lost4: 0, lostArr4: 0, thisQLost: 0, lostByQ: [0, 0, 0, 0], oldN: 0, newN: 0, blank: 0, unlisted: 0, earlyN: 0, midN: 0, lateN: 0 }); return scopes.get(k); };
    const rs = (k, g) => { const id = k + '|' + g; if (!reasons.has(id)) reasons.set(id, { key: id, kind: 'reason', scope: k, group: g, olds: {}, n: 0, arr: 0, early: 0, mid: 0, late: 0, other: 0, byQ: [0, 0, 0, 0], thisQ: 0 }); return reasons.get(id); };
    for (const k of ['All', 'S|SMB', 'S|Field']) sc(k);
    for (const r of cv_window) {
      if (r.won === true || ADMIN.test(r.reason || '')) continue;
      const q = qi(r.fy, r.fq), qx = last4.indexOf(q), isThis = q === cur;
      if (qx < 0 && !isThis) continue;
      const n = +r.n || 0, arr = +r.arr || 0, team = closeTeam(r), raw = r.reason || '', g = group(raw);
      const s = stageNo(r.lastStage), band = s === 'W' || s == null ? 'other' : s <= 1 ? 'early' : s <= 3 ? 'mid' : 'late';
      for (const k of [...new Set(['All', 'S|' + SEG(team), team].concat(CLASS(team) === 'AE' ? ['S|AE'] : []))]) {
        const o = sc(k), x = rs(k, g);
        if (!raw) o.blank += n; else if (REASON[raw]) o.oldN += n; else if (NEW.includes(raw)) o.newN += n; else o.unlisted += n;
        if (isThis) { o.thisQLost += n; x.thisQ += n; continue; }
        o.lost4 += n; o.lostArr4 += arr; o.lostByQ[qx] += n; if (band !== 'other') o[band + 'N'] += n;
        x.n += n; x.arr += arr; x[band] += n; x.byQ[qx] += n;
        if (raw && REASON[raw] && REASON[raw] !== raw) x.olds[raw] = (x.olds[raw] || 0) + n;
      }
    }
    const out = [];
    for (const o of scopes.values()) {
      if (o.scope === 'S|AE') continue;
      const L = o.lost4;
      // fields named as the losses table's columns, so the total row reads like a reason row
      Object.assign(o, { group: 'All losses', n: L, arr: o.lostArr4, share: L ? 1 : null, early: o.earlyN, mid: o.midN, late: o.lateN,
        earlyShare: L ? o.earlyN / L : null, midShare: L ? o.midN / L : null, lateShare: L ? o.lateN / L : null });
      const peer = o.scope !== 'All' && !o.scope.startsWith('S|') && CLASS(o.scope) === 'AE', ae = scopes.get('S|AE');
      const list = [...reasons.values()].filter((x) => x.scope === o.scope).map((x) => {
        const pN = peer && ae ? ae.lost4 - L : 0, pX = peer ? ((reasons.get('S|AE|' + x.group) || { n: 0 }).n - x.n) : 0;
        const olds = Object.entries(x.olds).sort((a, b) => b[1] - a[1]);
        return { ...x, olds: Object.fromEntries(olds), oldsTxt: olds.map(([k, v]) => k + ' ' + v.toLocaleString('en')).join(' and ') || null, share: L ? x.n / L : null, peerShare: peer && pN >= MIN_PEER ? pX / pN : null };
      }).sort((a, b) => (a.group === 'No reason given') - (b.group === 'No reason given') || b.n - a.n || b.thisQ - a.thisQ || a.group.localeCompare(b.group));
      out.push(...list, o);
    }
    return out;
  },
});

dash.calc('conv_closeout', {
  title: 'Clean-up quarters',
  description: 'Finds a one-month burst of New Business losses, like September 2026\'s against July and August: a completed month with at least 2.5 times the average of the other two months of its quarter and 100 more, likely a pipeline clean-up. Its quarter is a clean-up quarter (there can be more than one); a month of this quarter isn\'t tested, because its other months aren\'t over. Testing a month against its own quarter means growth from one quarter to the next never looks like a clean-up. Gives the win rate, where losses left and the lost reasons without the clean-up quarters, for all EMEA, SMB, Field and each team (who closed the deal), and whether each reason\'s share rose last quarter (8+ points above the three quarters before, a clean-up quarter among them left out, from 10 losses); that isn\'t compared when last quarter was itself a clean-up quarter. Its own calc, so the rest of Conversion works when the losses by month can\'t be read.',
  inputs: ['cv_lost_month', 'cv_window'],
  fn: (cv_lost_month, cv_window) => {
    const MIN_N = 20, MIN_PEER = 20;
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const AE = ['France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA'];
    const SEG = (t) => (t === 'SMB' ? 'SMB' : 'Field');
    const CLASS = (t) => (AE.includes(t) ? 'AE' : t === 'SMB' ? 'SMB' : t === 'BDR' ? 'BDR' : t === 'Engagement' ? 'EM' : t === 'Leadership' ? 'Lead' : 'Other');
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
    const qi = (fy, fq) => (fy == null || fq == null ? null : +fy * 4 + (+fq - 1));
    const label = (i) => 'Q' + ((i % 4) + 1) + ' ' + Math.floor(i / 4);
    // the team that closed a deal: its role at close when that is an EMEA sales role, else the owner's today
    const closeTeam = (r) => TEAM[(TEAM[r.closedRole] ? r.closedRole : null) || r.role] || 'Other';
    const ADMIN = /^(merged with global pilot|record cleanup)$/i;
    const stageNo = (v) => { if (!v) return null; if (/^closed won/i.test(v)) return 'W'; const n = parseInt(v, 10); return n >= 0 && n <= 6 ? n : null; };
    const REASON = { 'Qualified Out': 'Not a fit', 'Timing': 'Deferred', 'Technical/Functional Gap': 'Product fit', 'Lost to Competitor': 'Chose an alternative',
      'No Champion': 'Buyer engagement', 'Budget': 'Price and budget', 'Value not perceived': 'Value not perceived' };
    const NEW = ['Chose an alternative', 'Product fit', 'Price and budget', 'Buyer engagement', 'Deferred', 'Not a fit', 'Customer experience and support', 'Other'];
    const group = (v) => (!v ? 'No reason given' : REASON[v] || (NEW.includes(v) ? v : 'Unlisted: ' + v));
    const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const num = (v) => Math.round(v).toLocaleString('en');
    const last4 = [cur - 4, cur - 3, cur - 2, cur - 1];
    // 1) burst months, all EMEA: each month of a completed quarter against the other two months of that quarter
    const byM = new Map();
    for (const r of cv_lost_month) { const yr = +r.yr, mo = +r.mo; if (!yr || !mo) continue; const q = yr * 4 + Math.floor((mo - 1) / 3); if (!byM.has(q)) byM.set(q, [0, 0, 0]); byM.get(q)[(mo - 1) % 3] += +r.n || 0; }
    const bursts = [];
    let maxRatio = null;
    for (const q of last4) {
      const mm = byM.get(q) || [0, 0, 0];
      let best = null;
      for (let i = 0; i < 3; i++) {
        const o = [0, 1, 2].filter((j) => j !== i), base = (mm[o[0]] + mm[o[1]]) / 2, ratio = base > 0 ? mm[i] / base : null;
        if (ratio != null && (maxRatio == null || ratio > maxRatio)) maxRatio = ratio;
        const y = Math.floor(q / 4), m0 = (q % 4) * 3;
        if (mm[i] >= 2.5 * base && mm[i] - base >= 100 && (!best || mm[i] > best.monthLost)) best = { q, label: label(q), month: MONTH[m0 + i] + ' ' + y, others: MONTH[m0 + o[0]] + ' and ' + MONTH[m0 + o[1]], monthLost: mm[i], monthBase: base, monthRatio: ratio };
      }
      if (best) bursts.push(best);
    }
    const cq = new Set(bursts.map((b) => b.q)), lastQCleanup = cq.has(cur - 1);
    // 2) and 3) per scope over the 4 completed quarters, without the clean-up quarters, and per reason
    const agg = new Map();
    const get = (k) => { if (!agg.has(k)) agg.set(k, { key: k, wonC: 0, lostC: 0, arrC: 0, bC: { 0: 0, 1: 0, 2: 0, 3: 0, 46: 0, W: 0, U: 0 }, lostByQ: [0, 0, 0, 0], g: new Map() }); return agg.get(k); };
    for (const k of ['All', 'S|SMB', 'S|Field']) get(k);
    const qLost = last4.map(() => ({ lost: 0, known: 0, mid: 0 }));
    for (const r of cv_window) {
      const q = qi(r.fy, r.fq), qx = last4.indexOf(q);
      if (qx < 0) continue;
      const won = r.won === true, n = +r.n || 0, arr = +r.arr || 0;
      if (!won && ADMIN.test(r.reason || '')) continue;
      const team = closeTeam(r), clean = !cq.has(q), s = stageNo(r.lastStage);
      const bk = s === 'W' ? 'W' : s == null ? 'U' : s >= 4 ? 46 : s, band = s === 'W' || s == null ? 'other' : s <= 1 ? 'early' : s <= 3 ? 'mid' : 'late';
      if (!won) { qLost[qx].lost += n; if (bk !== 'W' && bk !== 'U') { qLost[qx].known += n; if (bk === 2 || bk === 3) qLost[qx].mid += n; } }
      const raw = r.reason || '', g = group(raw);
      for (const k of [...new Set(['All', 'S|' + SEG(team), team].concat(CLASS(team) === 'AE' ? ['S|AE'] : []))]) {
        const o = get(k);
        if (won) { if (clean) o.wonC += n; continue; }
        o.lostByQ[qx] += n;
        if (!o.g.has(g)) o.g.set(g, { group: g, byQ: [0, 0, 0, 0], nClean: 0, earlyClean: 0, midClean: 0, lateClean: 0, otherClean: 0, arrClean: 0, olds: {} });
        const x = o.g.get(g);
        x.byQ[qx] += n;
        if (!clean) continue;
        o.lostC += n; o.arrC += arr; o.bC[bk] += n;
        x.nClean += n; x[band + 'Clean'] += n; x.arrClean += arr;
        if (raw && REASON[raw] && REASON[raw] !== raw) x.olds[raw] = (x.olds[raw] || 0) + n;
      }
    }
    const share = (a, b) => (b > 0 ? a / b : null);
    const first = bursts[0] || null;
    const midOf = (qs) => { const k = qs.reduce((a, i) => a + qLost[i].known, 0), mid = qs.reduce((a, i) => a + qLost[i].mid, 0); return k ? mid / k : null; };
    const closeout = bursts.map((b) => { const qx = last4.indexOf(b.q); return { ...b, quarterLost: qLost[qx].lost, midShare: midOf([qx]), otherMid: midOf([0, 1, 2, 3].filter((i) => !cq.has(last4[i]))) }; });
    const out = [];
    const ae = agg.get('S|AE');
    for (const o of agg.values()) {
      if (o.key === 'S|AE') continue;
      const kn = o.lostC - o.bC.W - o.bC.U, closed = o.wonC + o.lostC, fc = first ? closeout[0] : null;
      const row = { key: o.key, kind: 'scope', scope: o.key, closeoutQs: closeout.map((b) => b.label), closeoutLabel: closeout.map((b) => b.label).join(' and ') || null,
        closeoutMonths: fc ? fc.month : null, closeoutOthers: fc ? fc.others : null, monthLost: fc ? fc.monthLost : null, monthBase: fc ? fc.monthBase : null, monthRatio: fc ? fc.monthRatio : null,
        quarterLost: fc ? fc.quarterLost : null, closeoutMid: fc ? fc.midShare : null, otherMid: fc ? fc.otherMid : null, lastQCleanup,
        wonClean: o.wonC, lostClean: o.lostC, winRateClean: closed >= MIN_N ? o.wonC / closed : null, knownClean: kn,
        earlyShareClean: kn >= MIN_N ? (o.bC[0] + o.bC[1]) / kn : null, lateShareClean: kn >= MIN_N ? o.bC[46] / kn : null };
      for (const x of ['0', '1', '2', '3', '46']) row['share' + x + 'Clean'] = kn >= MIN_N ? o.bC[x] / kn : null;
      out.push(row);
      const peer = o.key !== 'All' && !o.key.startsWith('S|') && CLASS(o.key) === 'AE' && ae;
      const groups = [...o.g.values()].sort((a, b) => (a.group === 'No reason given') - (b.group === 'No reason given') || b.nClean - a.nClean || a.group.localeCompare(b.group));
      for (const x of groups) {
        let lastQShare = null, prevShare = null, rising = null;
        if (!lastQCleanup) {
          lastQShare = share(x.byQ[3], o.lostByQ[3]);
          const prevQ = [0, 1, 2].filter((i) => !cq.has(last4[i]));
          prevShare = share(prevQ.reduce((a, i) => a + x.byQ[i], 0), prevQ.reduce((a, i) => a + o.lostByQ[i], 0));
          rising = lastQShare != null && prevShare != null ? lastQShare - prevShare >= 0.08 && x.byQ[3] >= 10 : null;
        }
        const base = { scope: o.key, group: x.group, byQ: x.byQ, lostByQ: o.lostByQ, lastQCleanup, lastQShare, prevShare, rising };
        out.push({ key: o.key + '|' + x.group, kind: 'reason', ...base, nClean: x.nClean, earlyClean: x.earlyClean, midClean: x.midClean, lateClean: x.lateClean, shareClean: share(x.nClean, o.lostC) });
        // the same figures named as the losses table's columns, for its "Leave out the clean-up quarter" view
        const pg = peer ? ae.g.get(x.group) : null, pN = peer ? ae.lostC - o.lostC : 0;
        const olds = Object.entries(x.olds).sort((a, b) => b[1] - a[1]);
        out.push({ key: 'clean|' + o.key + '|' + x.group, kind: 'clean', ...base, n: x.nClean, share: share(x.nClean, o.lostC), peerShare: peer && pN >= MIN_PEER ? ((pg ? pg.nClean : 0) - x.nClean) / pN : null,
          early: x.earlyClean, mid: x.midClean, late: x.lateClean, other: x.otherClean, arr: x.arrClean, oldsTxt: olds.map(([k, v]) => k + ' ' + num(v)).join(' and ') || null });
      }
      out.push({ key: 'clean|' + o.key + '|*', kind: 'clean', scope: o.key, group: 'All losses', n: o.lostC, share: o.lostC ? 1 : null, peerShare: null, early: o.bC[0] + o.bC[1], mid: o.bC[2] + o.bC[3], late: o.bC[46], arr: o.arrC, lastQShare: null, rising: null, lastQCleanup });
    }
    // 4) the trust row
    const ratio = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('en'));
    out.push(closeout.length
      ? { key: 'trust|closeout', kind: 'trust', id: 'closeout', measure: 'A clean-up month', value: Math.max(...closeout.map((b) => b.monthRatio || 0)) || null, fmt: 'x', severity: 'warn',
        detail: closeout.map((b) => b.month + ': ' + num(b.monthLost) + ' New Business losses against ' + num(b.monthBase) + ' a month in ' + b.others + ', a one-month burst of losses, likely a pipeline clean-up; ' + b.label + ' had ' + num(b.quarterLost) + ' in all' + (b.midShare != null && b.otherMid != null ? ', ' + Math.round(b.midShare * 100) + '% from stages 2–3 against ' + Math.round(b.otherMid * 100) + '% in the other quarters' : '') + '.').join(' ')
          + ' They are real losses and count everywhere; Why deals are lost can leave ' + (closeout.length > 1 ? 'those quarters' : 'that quarter') + ' out, and the win-rate tile gives the rate without it. It also turned still-open deals into losses, so the step rates of the quarters they were created in moved.' }
      : { key: 'trust|closeout', kind: 'trust', id: 'closeout', measure: 'A clean-up month', value: maxRatio, fmt: 'x', severity: 'info',
        detail: maxRatio == null ? 'No losses by month to compare yet.' : 'No month stands out (the largest is ' + ratio(maxRatio) + '× the other two months of its quarter). A month of this quarter is tested once the quarter has ended.' });
    return out;
  },
});

dash.calc('conv_sources', {
  title: 'How sources convert',
  description: 'New Business closed won or lost in the last 4 completed quarters (by the date actually closed; admin merges left out), plus what is open today, for all EMEA, SMB, Field and each team (the team that closed a deal: its owner\'s role at close when that is an EMEA sales role, also when it is owned outside EMEA today, else the current owner\'s; the owner\'s team for open deals), by source four ways: as in Created opps › Sources (BDR-sourced: an originating BDR is set or a BDR created it; Inbound: lead source Inbound; Rep-sourced: the rest), by lead source (retired Inbound Webform and Apollo counted as Inbound and Outbound), by origin (an EMEA BDR originated it, by the role stamped on the deal or, when none was stamped, the BDR\'s role today, as on Created opps › BDRs) and by who created it (the creator\'s role today; a deal closed in an EMEA sales role and now owned outside EMEA sales by someone in its creator\'s role today counts under its role at close, since its creator most likely closed it and has changed roles since). Per source: closed, won, the win rate by count and by ARR, the average won deal, won ARR per closed deal, the average days from creation to the win over all wins, how many are open now and the share still open, with the same source\'s win rate within SMB and within Field beside it. A source is marked when its win rate is 10+ points from the rest of the team, beyond twice the normal swing, with 20+ closed on each side; never at All EMEA, which mixes SMB and Field. Also the checks on source data for How far to trust.',
  inputs: ['cv_source'],
  fn: (cv_source) => {
    const MIN_N = 20;
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const SEG = (t) => (t === 'SMB' ? 'SMB' : 'Field');
    // the team that closed a deal: its role at close when that is an EMEA sales role, else the owner's today
    const closeTeam = (r) => TEAM[(TEAM[r.closedRole] ? r.closedRole : null) || r.role] || 'Other';
    const z2 = (x1, n1, x2, n2) => { if (!(n1 > 0 && n2 > 0)) return null; const p = (x1 + x2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)); return se > 0 ? (x1 / n1 - x2 / n2) / se : 0; };
    const BDRS = ['BDR-EMEA', 'DIR-BDR-EMEA'];
    // the creator's role is today's: a deal closed in an EMEA sales role and now owned outside EMEA sales by someone in
    // the creator's role today was created by the person who closed it, who has changed roles since; it counts under
    // the role at close, not as Other or system
    const creatorAt = (r) => (r.closed === true && TEAM[r.closedRole] && !TEAM[r.role] && r.creatorRole && r.creatorRole === r.role ? r.closedRole : r.creatorRole || '');
    const GROUPS = [
      ['As in Sources', ['BDR-sourced', 'Inbound', 'Rep-sourced'], (r) => (r.bdrRole || /^(BDR-|DIR-BDR-)/.test(r.creatorRole || '') ? 'BDR-sourced' : r.src === 'Inbound' ? 'Inbound' : 'Rep-sourced')],
      ['Lead source', ['Inbound', 'Referral', 'Event', 'Outbound', 'Other', 'Not set'], (r) => (!r.src ? 'Not set' : r.src === 'Inbound' || r.src === 'Inbound Webform' ? 'Inbound' : r.src === 'Outbound' || r.src === 'Apollo' ? 'Outbound' : r.src === 'Referral' || r.src === 'Event' ? r.src : 'Other')],
      ['Origin', ['BDR-originated', 'Not BDR-originated'], (r) => (BDRS.includes(r.bdrRole) || (!r.bdrRole && BDRS.includes(r.bdrNow)) ? 'BDR-originated' : 'Not BDR-originated')],
      ['Created by', ['BDR', 'SMB rep', 'Field AE or sales leader', 'Engagement', 'Other or system'], (r) => { const v = creatorAt(r); return /^(BDR-|DIR-BDR-)/.test(v) ? 'BDR' : /^SMB-/.test(v) ? 'SMB rep' : /^(AE-|AD-|MGR-SALES-|DIR-SALES-|VP-SALES-|HEAD-STRAT-)/.test(v) ? 'Field AE or sales leader' : /^(EM-|DIR-EM-)/.test(v) ? 'Engagement' : 'Other or system'; }],
    ];
    const sums = new Map();
    const blank = () => ({ won: 0, lost: 0, wonArr: 0, lostArr: 0, cyc: 0, cycN: 0, open: 0, openArr: 0 });
    const S = (k, g, v) => { const id = k + '|' + g + '|' + v; if (!sums.has(id)) sums.set(id, blank()); return sums.get(id); };
    const t = { blank: 0, blankOpen: 0, retired: 0, bdrSet: 0, noCreator: 0, creatorMoved: 0, closed: 0 };
    for (const r of cv_source) {
      const closed = r.closed === true, won = r.won === true, n = +r.n || 0, arr = +r.arr || 0;
      const team = closed ? closeTeam(r) : TEAM[r.role] || 'Other';
      if (closed) { t.closed += n; if (!r.src) t.blank += n; if (r.bdrRole || BDRS.includes(r.bdrNow)) t.bdrSet += n; if (!r.creatorRole) t.noCreator += n; if (creatorAt(r) !== (r.creatorRole || '')) t.creatorMoved += n; } else if (!r.src) t.blankOpen += n;
      if (r.src === 'Inbound Webform' || r.src === 'Apollo') t.retired += n;
      for (const k of [...new Set(['All', 'S|' + SEG(team), team])]) {
        for (const [g, , f] of GROUPS.concat([['All', null, () => 'All closed']])) {
          const o = S(k, g, f(r));
          if (!closed) { o.open += n; o.openArr += arr; } else if (won) { o.won += n; o.wonArr += arr; o.cyc += +r.cycleDays || 0; o.cycN += +r.cycleN || 0; } else { o.lost += n; o.lostArr += arr; }
        }
      }
    }
    const keys = [...new Set([...sums.keys()].map((id) => id.split('|').slice(0, -2).join('|')))];
    const derive = (o) => {
      const closed = o.won + o.lost;
      return { closed, won: o.won, lost: o.lost, wonArr: o.wonArr, lostArr: o.lostArr, winRate: closed >= MIN_N ? o.won / closed : null,
        arrWinRate: closed >= MIN_N && o.wonArr + o.lostArr > 0 ? o.wonArr / (o.wonArr + o.lostArr) : null, avgWon: o.won >= 5 ? o.wonArr / o.won : null,
        wonArrPerClosed: closed >= MIN_N ? o.wonArr / closed : null, daysToWin: o.cycN >= 10 ? o.cyc / o.cycN : null, open: o.open, openArr: o.openArr,
        openShare: o.open + closed ? o.open / (o.open + closed) : null, young: o.open + closed > 0 && o.open / (o.open + closed) >= 0.5 && o.open >= 10 };
    };
    const out = [];
    for (const k of keys) {
      const tot = sums.get(k + '|All|All closed') || blank(), T = derive(tot);
      const total = { key: k + '|All|All closed', kind: 'total', scope: k, group: 'All', value: 'All closed', groupHead: 'All', order: 0, ...T, share: T.closed ? 1 : null, smbWinRate: null, fieldWinRate: null, gap: null, z: null, mark: '' };
      let order = 1;
      const list = [];
      for (const [g, vals] of GROUPS) {
        let head = true;
        for (const v of vals) {
          const o = sums.get(k + '|' + g + '|' + v);
          if (!o) continue;
          const d = derive(o), rest = { won: tot.won - o.won, lost: tot.lost - o.lost }, restN = rest.won + rest.lost;
          const sm = sums.get('S|SMB|' + g + '|' + v), fi = sums.get('S|Field|' + g + '|' + v);
          const gap = d.winRate != null && restN >= MIN_N ? d.winRate - rest.won / restN : null, z = d.closed && restN ? z2(o.won, d.closed, rest.won, restN) : null;
          const mark = k !== 'All' && d.closed >= MIN_N && restN >= MIN_N && gap != null && z != null ? (gap <= -0.1 && z <= -2 ? 'low' : gap >= 0.1 && z >= 2 ? 'high' : '') : '';
          list.push({ key: k + '|' + g + '|' + v, kind: 'source', scope: k, group: g, value: v, groupHead: head ? g : '', order: order++, ...d, share: T.closed ? d.closed / T.closed : null,
            smbWinRate: sm ? derive(sm).winRate : null, fieldWinRate: fi ? derive(fi).winRate : null, gap, z, mark });
          head = false;
        }
      }
      // the best and worst lead source by win rate (30+ closed; Not set and Other left out), BDR-sourced against the rest
      const ls = list.filter((x) => x.group === 'Lead source' && x.closed >= 30 && x.value !== 'Not set' && x.value !== 'Other').sort((a, b) => b.winRate - a.winRate);
      const two = ls.length >= 2, bdr = list.find((x) => x.group === 'As in Sources' && x.value === 'BDR-sourced');
      const restS = list.filter((x) => x.group === 'As in Sources' && x.value !== 'BDR-sourced'), rw = restS.reduce((a, x) => a + x.won, 0), rc = restS.reduce((a, x) => a + x.closed, 0);
      Object.assign(total, { bestSrc: two ? ls[0].value : null, bestWr: two ? ls[0].winRate : null, bestYield: two ? ls[0].wonArrPerClosed : null,
        worstSrc: two ? ls[ls.length - 1].value : null, worstWr: two ? ls[ls.length - 1].winRate : null, worstYield: two ? ls[ls.length - 1].wonArrPerClosed : null,
        bdrWr: bdr ? bdr.winRate : null, bdrYield: bdr ? bdr.wonArrPerClosed : null, restWr: rc >= MIN_N ? rw / rc : null });
      out.push(total, ...list);
    }
    const pct = (v) => Math.round(v * 100) + '%', num = (v) => Math.round(v).toLocaleString('en'), rows = cv_source.length;
    out.push(
      { key: 'trust|leadsource', kind: 'trust', id: 'leadsource', measure: 'Lead source not set or retired', value: t.blank, fmt: 'n', severity: t.closed && t.blank / t.closed >= 0.05 ? 'warn' : 'info',
        detail: num(t.blank) + ' closed and ' + num(t.blankOpen) + ' open New Business deals have no lead source; ' + num(t.retired) + ' use a retired value (Inbound Webform, Apollo), counted as Inbound and Outbound.' },
      { key: 'trust|bdr', kind: 'trust', id: 'bdr', measure: 'Originating BDR', value: t.closed ? t.bdrSet / t.closed : null, fmt: 'pct', severity: 'info',
        detail: (t.closed ? pct(t.bdrSet / t.closed) : '—') + ' of closed New Business deals have an Originating BDR role stamped or an EMEA BDR set (about 11% of those closed in Q4 2025 and 26% in Q3 2026 when this was built), so older BDR deals sit under Rep-sourced or Inbound unless a BDR created them. BDR-originated counts EMEA BDRs only, as the BDR leaderboard does; BDR-sourced also counts deals a BDR created and any originating BDR, as in Created opps › Sources.' },
      { key: 'trust|creator', kind: 'trust', id: 'creator', measure: 'Created by users with no role', value: t.noCreator, fmt: 'n', severity: 'info',
        detail: num(t.noCreator) + ' closed deals were created by users with no role (system or integration users); they show under Other or system.'
          + (t.creatorMoved ? ' ' + num(t.creatorMoved) + ' were closed in an EMEA sales role and are now owned outside EMEA sales by someone in their creator\'s role today: most likely the person who created and closed them has changed roles since, so Created by counts them under the role at close.' : '') },
      { key: 'trust|srcCap', kind: 'trust', id: 'srcCap', measure: 'Sources data near the 2,000-row limit', value: rows, fmt: 'n', severity: rows >= 2000 ? 'bad' : rows >= 1600 ? 'warn' : 'info',
        detail: 'Sources ' + num(rows) + ' rows' + (rows >= 2000 ? ' (cut: totals too low)' : '') + '.' });
    return out;
  },
});

dash.calc('conv_time', {
  title: 'Time in stage',
  description: 'New Business won in the last 90 days (SMB: the last 30 days, to stay well under the row limit as SMB grows), for all EMEA, SMB, Field, each team (who closed it) and each manager (the manager at close for a deal since moved to someone in another role, otherwise today\'s): for stages 0–3 one by one and stages 4–6 together, how many wins passed through, the share that left on the day they entered (stage walking, a skipped stage, or a deal logged in one go), and the median and 75th percentile of the days the others spent there (from 10 such moves); then, from creation to the win, the median and 75th percentile of the wins that took a day or more, and the share created and won within a day. SMB and Field medians are beside each, and Pipeline\'s stuck threshold for stages 0–3 (about twice the usual time an open deal sits there). Stage dates keep the latest pass, so a reopened deal\'s earlier pass counts in the stage before the one it re-entered: stages 4–6 are timed together, so a re-entry inside them moves no days, and a deal whose stage 0–3 dates go backwards is left out of those stages and counted. Also the checks on timing data for How far to trust.',
  inputs: ['cv_days'],
  fn: (cv_days) => {
    const MIN = 10, MIN_SHARE = 20;
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const SEG = (t) => (t === 'SMB' ? 'SMB' : 'Field');
    // the team that closed a deal: its role at close when that is an EMEA sales role, else the owner's today
    const closedBy = (r) => (TEAM[r.closedRole] ? r.closedRole : null);
    const closeTeam = (r) => TEAM[closedBy(r) || r.role] || 'Other';
    const moved = (r) => !!(closedBy(r) && closedBy(r) !== r.role);
    const closeMgr = (r) => (moved(r) ? r.closedManager || null : r.manager || '(no manager)');
    const NAME = ['Qualification', 'Solution agreement', 'Scope agreement', 'Validation', 'Commercial agreement', 'Vendor assessment', 'Opt-out'];
    const SLOTS = ['0', '1', '2', '3', '46'];
    const STUCK = [35, 55, 60, 40];
    const pct = (xs, p) => { const v = xs.slice().sort((a, b) => a - b); if (!v.length) return null; const i = (v.length - 1) * p, lo = Math.floor(i); return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (i - lo); };
    const since30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const agg = new Map();
    const get = (k) => { if (!agg.has(k)) agg.set(k, { same: { 0: 0, 1: 0, 2: 0, 3: 0, 46: 0 }, worked: { 0: [], 1: [], 2: [], 3: [], 46: [] }, oneGo: 0, winN: 0, winDays: [] }); return agg.get(k); };
    for (const k of ['All', 'S|SMB', 'S|Field']) get(k);
    let outOfOrder = 0, reopened = 0, wins = 0;
    for (const r of cv_days) {
      const team = closeTeam(r), mgr = closeMgr(r);
      // a deal an SMB rep closed that someone else owns today is read for 90 days: SMB is timed on its last 30
      if (team === 'SMB' && r.closeAt && String(r.closeAt).slice(0, 10) < since30) continue;
      wins += 1;
      const keys = [...new Set(['All', 'S|' + SEG(team), team].concat(mgr && mgr !== '(no manager)' ? ['M|' + mgr] : []))];
      const d = [0, 1, 2, 3, 4, 5, 6].map((k) => (r['d' + k] == null ? null : +r['d' + k]));
      const early = d.slice(0, 4), back = early.some((x) => x != null && x < 0);
      const bandSet = d[4] != null && d[5] != null && d[6] != null, band = bandSet ? d[4] + d[5] + d[6] : null;
      if (back || (band != null && band < 0)) outOfOrder += 1;
      if (r.cwAt && r.closeAt && String(r.cwAt).slice(0, 10) > String(r.closeAt).slice(0, 10)) reopened += 1;
      const win = r.daysToWin == null ? null : +r.daysToWin;
      for (const k of keys) {
        const o = get(k);
        if (!back) early.forEach((x, i) => { if (x == null) return; if (x < 1) o.same[i] += 1; else o.worked[i].push(x); });
        if (band != null && band >= 0) { if (band < 1) o.same[46] += 1; else o.worked[46].push(band); }
        if (win != null) { o.winN += 1; if (win < 1) o.oneGo += 1; else o.winDays.push(win); }
      }
    }
    const med = (k, slot) => { const o = agg.get(k); if (!o) return null; const w = slot === 'win' ? o.winDays : o.worked[slot]; return w.length >= MIN ? pct(w, 0.5) : null; };
    const out = [];
    for (const [k, o] of agg) {
      for (const slot of SLOTS) {
        const w = o.worked[slot], n = o.same[slot] + w.length, i = slot === '46' ? null : +slot;
        out.push({ key: k + '|' + slot, kind: 'stage', scope: k, stage: slot, label: slot === '46' ? 'Stages 4–6 · Commercial agreement to won' : 'Stage ' + slot + ' · ' + NAME[i],
          n, sameDay: o.same[slot], sameShare: n >= MIN_SHARE ? o.same[slot] / n : null, n1: w.length, median: w.length >= MIN ? pct(w, 0.5) : null, p75: w.length >= MIN ? pct(w, 0.75) : null,
          stuckAfter: i == null ? null : STUCK[i], smbMedian: med('S|SMB', slot), fieldMedian: med('S|Field', slot) });
      }
      // the win row's same-day share sits in the same column as the stages'
      out.push({ key: k + '|win', kind: 'win', scope: k, stage: 'win', label: 'Created to won, wins that took a day or more', n: o.winN, oneGo: o.oneGo,
        oneGoShare: o.winN >= MIN_SHARE ? o.oneGo / o.winN : null, sameDay: o.oneGo, sameShare: o.winN >= MIN_SHARE ? o.oneGo / o.winN : null, n1: o.winDays.length,
        median: o.winDays.length >= MIN ? pct(o.winDays, 0.5) : null, p75: o.winDays.length >= MIN ? pct(o.winDays, 0.75) : null, stuckAfter: null, smbMedian: med('S|SMB', 'win'), fieldMedian: med('S|Field', 'win') });
    }
    const A = agg.get('All'), sm = agg.get('S|SMB'), fi = agg.get('S|Field');
    const sameAll = (o) => { const s = SLOTS.reduce((a, x) => a + o.same[x], 0), n = SLOTS.reduce((a, x) => a + o.same[x] + o.worked[x].length, 0); return n ? s / n : null; };
    const p = (v) => (v == null ? '—' : Math.round(v * 100) + '%'), num = (v) => Math.round(v).toLocaleString('en');
    const walk = sameAll(A), sig = A.winN ? A.oneGo / A.winN : null, sigF = fi.winN ? fi.oneGo / fi.winN : null, rows = cv_days.length;
    const p75 = (slot) => { const w = A.worked[slot]; return w.length >= MIN ? num(pct(w, 0.75)) : '—'; };
    out.push(
      { key: 'trust|walk', kind: 'trust', id: 'walk', measure: 'Stage moves made the same day', value: walk, fmt: 'pct', severity: walk != null && walk >= 0.5 ? 'warn' : 'info',
        detail: p(walk) + ' of the moves out of a stage by New Business won in the last 90 days (SMB: 30) happened on the day the stage was entered (SMB ' + p(sameAll(sm)) + ', Field ' + p(sameAll(fi)) + '). They are counted, not timed: the days shown are for moves that took a day or more. Stage reached counts them as passing the stage.' },
      { key: 'trust|signature', kind: 'trust', id: 'signature', measure: 'Wins created and won within a day', value: sig, fmt: 'pct', severity: sigF != null && sigF >= 0.2 ? 'warn' : 'info',
        detail: num(A.oneGo) + ' of ' + num(A.winN) + ' wins (SMB ' + p(sm.winN ? sm.oneGo / sm.winN : null) + ', Field ' + p(sigF) + ') were created and won within a day: logged at signature, they never showed in pipeline or forecast. They count as wins and as passing every stage; days to win is the median of the other wins.' },
      { key: 'trust|order', kind: 'trust', id: 'order', measure: 'Stage dates and reopened wins', value: outOfOrder, fmt: 'n', severity: wins && (outOfOrder > 0.05 * wins || reopened > 0.05 * wins) ? 'warn' : 'info',
        detail: 'Stage dates keep the latest pass, so a reopened deal\'s earlier pass counts in the stage before the one it re-entered. Stages 4–6 are timed together, so a re-entry inside them moves no days; ' + num(outOfOrder) + ' wins whose stage dates go backwards are left out of those stages. At least ' + num(reopened) + ' wins entered Closed Won after their close date (reopened and won again): their stages 4–6 time includes the days between.' },
      { key: 'trust|stuck', kind: 'trust', id: 'stuck', measure: 'Stuck-in-stage thresholds', value: null, fmt: 'n', severity: 'info',
        detail: 'Pipeline › Rep risk calls an open deal stuck after 35, 55, 60, 40, 30, 45 and 40 days in stages 0–6. The 75th percentile of wins\' moves that took a day or more now: stages 0–3 ' + ['0', '1', '2', '3'].map(p75).join(', ') + ' days; stages 4–6 together ' + p75('46') + '. Different deals (open against won), so a guide for RevOps, not a rule.' },
      { key: 'trust|daysCap', kind: 'trust', id: 'daysCap', measure: 'Time-in-stage data near the 2,000-row limit', value: rows, fmt: 'n', severity: rows >= 2000 ? 'bad' : rows >= 1200 ? 'warn' : 'info',
        detail: 'Recent wins ' + num(rows) + ' rows' + (rows >= 2000 ? ' (cut: medians from part of the wins)' : '') + '; SMB is read for 30 days to keep it low.' });
    return out;
  },
});

dash.calc('oo_points_conv', {
  title: '1:1 numbers and talking points, conversion',
  description: 'For each leader (someone with EMEA sales people below them), the conversion lines of their 1:1 agenda over the New Business their team holds (everyone below them; a closed deal counts for the team that closed it, by its owner\'s role at close when that is an EMEA sales role, else the current owner\'s, and for its manager at close when it has since moved to someone in another role): one numbers line (the share of their latest comparable quarter won within 2 quarters, against the quarter before and their peers) and up to 2 talking points: a step where the team\'s deals leak against its peers on the same created quarters, a share won within 2 quarters below the peers, old open deals still at stage 0–1, a drop on the quarter before, and for the top EMEA leader SMB against its own quarter before. Comparisons stay within one motion: the team\'s deals in AE teams against the other AE teams, or its SMB deals against the rest of SMB, and only when 80% or more of its deals are in that motion; a team that mixes motions, or whose deals in its motion never reach 20 in a comparable quarter, gets its numbers without comparisons (old open deals still count); a team whose deals are mostly Engagement- or Leadership-owned gets all its deals, against its own quarter before only; and a leader whose deals are mostly BDR-owned gets no conversion lines (BDR-sourced deals are in How sources convert). Teams with fewer than 20 deals created in a finished quarter get nothing; nobody who isn\'t a leader gets conversion lines. Its own calc, so agendas still build when conversion can\'t be read, and then say so; the agenda merges it in after the core, routing and activity points of the same severity.',
  inputs: ['team_tree', 'cv_open', 'cv_closed'],
  fn: (team_tree, cv_open, cv_closed) => {
    const MIN_N = 20, MIN_CMP = 30, GAP = 0.05, Z = 2, MAX_TALK = 2, MIXED = 0.8, MIN_PEER_Q = 10;
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const AE = ['France', 'DACH', 'Southern Europe', 'Iberia & LATAM', 'Benelux', 'Nordics', 'CEE', 'MEA'];
    const CLASS = (t) => (AE.includes(t) ? 'AE' : t === 'SMB' ? 'SMB' : t === 'BDR' ? 'BDR' : t === 'Engagement' ? 'EM' : t === 'Leadership' ? 'Lead' : 'Other');
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
    const qi = (fy, fq) => (fy == null || fq == null ? null : +fy * 4 + (+fq - 1));
    const label = (i) => 'Q' + ((i % 4) + 1) + ' ' + Math.floor(i / 4);
    // the team that closed a deal: its role at close when that is an EMEA sales role, else the owner's today
    const closedBy = (r) => (TEAM[r.closedRole] ? r.closedRole : null);
    const closeTeam = (r) => TEAM[closedBy(r) || r.role] || 'Other';
    const moved = (r) => !!(closedBy(r) && closedBy(r) !== r.role);
    const closeMgr = (r) => (moved(r) ? r.closedManager || null : r.manager || '(no manager)');
    const env = (r, won) => { const n = +r.n || 0, raw = [0, 1, 2, 3, 4, 5, 6].map((k) => +r['s' + k] || 0), s = new Array(7).fill(n); if (!won) for (let k = 6; k >= 1; k--) s[k] = Math.min(n, Math.max(raw[k], k < 6 ? s[k + 1] : 0)); return { n, s }; };
    const z2 = (x1, n1, x2, n2) => { if (!(n1 > 0 && n2 > 0)) return null; const p = (x1 + x2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)); return se > 0 ? (x1 / n1 - x2 / n2) / se : 0; };
    const verdict = (x1, n1, x2, n2) => { if (!(n1 >= MIN_CMP && n2 >= MIN_CMP)) return 'too few'; const g = x1 / n1 - x2 / n2, z = z2(x1, n1, x2, n2); return g <= -GAP && z <= -Z ? 'below' : g >= GAP && z >= Z ? 'above' : 'similar'; };
    const usd = (v) => { const n = +v || 0, a = Math.abs(n); if (a < 0.5) return '$0'; const s = a >= 999500 ? (a / 1e6).toFixed(a >= 9.95e6 ? 0 : 1) + 'M' : a >= 999.5 ? Math.round(a / 1e3) + 'K' : String(Math.round(a)); return (n < 0 ? '-$' : '$') + s; };
    const pc = (v) => Math.round(v * 100) + '%', num = (v) => Math.round(v).toLocaleString('en');
    const BANDS = [['b0', 0, 'stage 0 → 1', 'Qualification → Solution agreement'], ['b1', 1, 'stage 1 → 2', 'Solution agreement → Scope agreement'], ['b2', 2, 'stage 2 → 3', 'Scope agreement → Validation'],
      ['b3', 3, 'stage 3 → 4', 'Validation → Commercial agreement'], ['b46', 4, 'stages 4–6 → won', 'Commercial agreement, Vendor assessment and Opt-out → won']];
    const POOL = [cur - 4, cur - 3, cur - 2];
    // 1) one record per row: its manager by attribution, team, motion, cohort, status, stage reached, won or lost within 2 quarters
    const recs = [], old = [];
    for (const r of cv_open) {
      if (r.rt !== 'New Business') continue;
      const q = qi(r.fy, r.fq), team = TEAM[r.role] || 'Other', e = env(r, false);
      if (q == null) continue;
      if (q <= cur - 3) old.push({ mgr: r.manager || null, n: e.n - e.s[2] });
      if (q >= cur - 4 && q <= cur) recs.push({ mgr: r.manager || null, team, cls: CLASS(team), q, st: 'open', n: e.n, s: e.s, y2qWon: 0, y2qLost: 0, arrW: 0 });
    }
    for (const r of cv_closed) {
      if (r.rt !== 'New Business') continue;
      const q = qi(r.fy, r.fq), cq = qi(r.cfy, r.cfq);
      if (q == null || q < cur - 4 || q > cur) continue;
      const team = closeTeam(r), won = r.won === true, e = env(r, won), early = cq != null && cq - q <= 1, mgr = closeMgr(r);
      recs.push({ mgr: mgr === '(no manager)' ? null : mgr, team, cls: CLASS(team), q, st: won ? 'won' : 'lost', n: e.n, s: e.s, y2qWon: won && early ? e.n : 0, y2qLost: !won && early ? e.n : 0, arrW: won && early ? +r.arr || 0 : 0 });
    }
    const kids = new Map();
    for (const t of team_tree) if (t.manager) { if (!kids.has(t.manager)) kids.set(t.manager, []); kids.get(t.manager).push(t.name); }
    const subtree = (n) => { const s = new Set([n]); const q = [n]; while (q.length) { for (const k of kids.get(q.shift()) || []) if (!s.has(k)) { s.add(k); q.push(k); } } return s; };
    const byQ = (rs) => { const m = new Map(); for (const r of rs) { const c = m.get(r.q) || { n: 0, y2qWon: 0, y2qLost: 0, arrW: 0, won: { n: 0, s: [0, 0, 0, 0, 0, 0, 0] }, lost: { n: 0, s: [0, 0, 0, 0, 0, 0, 0] }, open: { n: 0, s: [0, 0, 0, 0, 0, 0, 0] } }; c.n += r.n; c.y2qWon += r.y2qWon; c.y2qLost += r.y2qLost; c.arrW += r.arrW; c[r.st].n += r.n; for (let i = 0; i < 7; i++) c[r.st].s[i] += r.s[i]; m.set(r.q, c); } return m; };
    const band = (c, b) => (b === 4 ? { moved: c.won.n, lost: c.lost.s[4], still: c.open.s[4] } : { moved: c.won.s[b + 1] + c.lost.s[b + 1] + c.open.s[b + 1], lost: c.lost.s[b] - c.lost.s[b + 1], still: c.open.s[b] - c.open.s[b + 1] });
    const pool = (m) => { const o = { n: 0, y2qWon: 0, won: { n: 0, s: [0, 0, 0, 0, 0, 0, 0] }, lost: { n: 0, s: [0, 0, 0, 0, 0, 0, 0] }, open: { n: 0, s: [0, 0, 0, 0, 0, 0, 0] } }; for (const q of POOL) { const c = m.get(q); if (!c) continue; o.n += c.n; o.y2qWon += c.y2qWon; for (const st of ['won', 'lost', 'open']) { o[st].n += c[st].n; for (let i = 0; i < 7; i++) o[st].s[i] += c[st].s[i]; } } return o; };
    const latest = (m) => { for (let q = cur - 2; q >= cur - 4; q--) { const c = m.get(q); if (c && c.n >= MIN_N) return [q, c]; } return [null, null]; };
    const all = byQ(recs), allSmb = byQ(recs.filter((r) => r.cls === 'SMB')), allField = byQ(recs.filter((r) => r.cls !== 'SMB'));
    const out = [];
    for (const L of team_tree) {
      if (!L.email || !L.isLeader) continue;
      const sub = subtree(L.name);
      const mine = recs.filter((r) => r.mgr && sub.has(r.mgr));
      // 2) the team's motion
      const tal = {};
      for (const r of mine) tal[r.cls] = (tal[r.cls] || 0) + r.n;
      const tot = Object.values(tal).reduce((a, b) => a + b, 0);
      if (!tot) continue;
      const [main, mainN] = Object.entries(tal).sort((a, b) => b[1] - a[1])[0], mixed = mainN / tot < MIXED;
      if (main === 'BDR') continue;
      const M = byQ(mine), [lq, lc] = latest(M);
      if (lq == null) continue;
      const lines = [];
      let n = 0;
      const push = (section, sev, text, extra) => out.push({ key: L.email + '|' + section + '|conv|' + n, email: L.email, name: L.name, section, sev, order: 3e6 + n++, text, screen: 'created', view: 'conversion', conv: true, ...(extra || {}) });
      const stale = old.filter((r) => r.mgr && sub.has(r.mgr)).reduce((a, r) => a + r.n, 0);
      // old open deals are worth closing whatever the motion, so every leader with lines can get this point
      // (its arrow opens Data checks › Conversion for all of EMEA: the point counts the leader's whole team)
      const staleLine = stale >= 5 ? [stale >= 20 ? 'medium' : 'low', num(stale) + ' open New Business deals created in ' + label(cur - 3) + ' or before are still at stage 0–1: progress or close them, so conversion and pipeline read true.', { screen: 'actions', view: 'checks', area: 'Conversion' }] : null;
      // 3) comparisons, within one motion only: the team's AE-team or SMB deals; a team mostly in another motion
      // (Engagement, Leadership) is never compared, so it keeps all its deals, as the Conversion view shows them
      const comp = main === 'AE' || main === 'SMB' ? mine.filter((r) => r.cls === main) : mine, C = byQ(comp), peersRecs = recs.filter((r) => r.cls === main && !(r.mgr && sub.has(r.mgr))), PQ = byQ(peersRecs);
      const peerPool = pool(PQ).n, canCmp = !L.isTop && !mixed && (main === 'AE' || main === 'SMB') && peerPool >= MIN_CMP;
      const peerLabel = main === 'AE' ? 'the rest of the AE teams' : 'the rest of SMB';
      const all1 = comp.length === mine.length;
      const what = all1 ? "the team's deals" : main === 'AE' ? "the team's AE-team deals" : "the team's SMB deals";
      if (L.isTop || mixed) {
        // the whole team (all EMEA for the top EMEA leader), SMB and Field side by side, never compared: the total moves with the mix
        const T = L.isTop ? all : M, S = L.isTop ? allSmb : byQ(mine.filter((r) => r.cls === 'SMB')), F = L.isTop ? allField : byQ(mine.filter((r) => r.cls !== 'SMB'));
        const [tq, tc] = latest(T);
        if (tq == null) continue;
        const seg = (m, nm, withPrev) => { const c = m.get(tq), p = m.get(tq - 1); return c && c.n >= MIN_N ? nm + ' ' + pc(c.y2qWon / c.n) + (withPrev && p && p.n >= MIN_N && tq - 1 >= cur - 4 ? ' (' + label(tq - 1) + ' ' + pc(p.y2qWon / p.n) + ')' : '') : null; };
        const open2 = (m) => { const c = m.get(tq); return c && c.n >= MIN_N ? pc((c.n - c.y2qWon - c.y2qLost) / c.n) : null; };
        const s = seg(S, 'SMB', L.isTop), f = seg(F, 'Field', L.isTop), so = open2(S), fo = open2(F);
        const segs = [s, f].filter(Boolean).join(' and '), opens = [s ? so : null, f ? fo : null].filter(Boolean).join(' and ');
        if (L.isTop) push('numbers', '', 'Conversion, all EMEA New Business created in ' + label(tq) + ': ' + pc(tc.y2qWon / tc.n) + ' won within 2 quarters' + (segs ? '; ' + segs + ', ' + opens + ' still open at 2 quarters. Field deals take longer: compare each segment with its own earlier quarters.' : '.') + ' Win rate and losses are on Created opps › Conversion.');
        else push('numbers', '', 'Team conversion, New Business created in ' + label(tq) + ': ' + pc(tc.y2qWon / tc.n) + ' won within 2 quarters (' + num(tc.y2qWon) + ' of ' + num(tc.n) + ')' + (segs ? '; ' + segs + ', ' + opens + ' still open at 2 quarters' : '') + '. Not compared: the team\'s deals mix motions, and Field deals take longer, so compare each with its own earlier quarters.');
      } else if (latest(C)[0] == null) {
        // the team has a comparable quarter with 20+ created, but its deals in its motion never reach 20 in one: the whole
        // team's share, not compared (as the Conversion view shows a manager in this case)
        push('numbers', '', 'Team conversion, New Business created in ' + label(lq) + ': ' + pc(lc.y2qWon / lc.n) + ' won within 2 quarters (' + num(lc.y2qWon) + ' of ' + num(lc.n) + '). Not compared: too few of '
          + what + ' (' + num((C.get(lq) || { n: 0 }).n) + ' created in ' + label(lq) + ').');
        if (staleLine) lines.push(staleLine);
      } else {
        const [cq, cc] = latest(C);
        const prev = C.get(cq - 1), prevOk = prev && prev.n >= MIN_N && cq - 1 >= cur - 4;
        const peer = PQ.get(cq), peerN = peer ? peer.n : 0;
        const cnt = all1 ? '' : ' (' + num(cc.n) + ' of ' + num((M.get(cq) || { n: cc.n }).n) + ' created)';
        push('numbers', '', 'Team conversion, New Business created in ' + label(cq) + ': ' + pc(cc.y2qWon / cc.n) + ' of ' + what + cnt + ' won within 2 quarters (' + num(cc.y2qWon) + ' of ' + num(cc.n)
          + (prevOk ? '; ' + label(cq - 1) + ' ' + pc(prev.y2qWon / prev.n) : '') + (canCmp && peerN >= MIN_N ? '; ' + peerLabel + ' ' + pc(peer.y2qWon / peerN) : '') + '). Deals count for who closed them.');
        // talking points, in rule order; the cap keeps medium before low
        if (canCmp) {
          let best = null;
          for (const [id, b, lbl, names] of BANDS) {
            let m = 0, d = 0, e = 0, v = 0, pm = 0, pd = 0, still = 0, reached = 0;
            for (const q of POOL) { const p = PQ.get(q); if (!p) continue; const y = band(p, b); pm += y.moved; pd += y.moved + y.lost; }
            for (const q of POOL) {
              const c = C.get(q);
              if (!c) continue;
              const x = band(c, b), d1 = x.moved + x.lost;
              still += x.still; reached += x.moved + x.lost + x.still;
              if (!(d1 > 0)) continue;
              const p = PQ.get(q), y = p ? band(p, b) : { moved: 0, lost: 0 }, d2 = y.moved + y.lost;
              const rate = d2 >= MIN_PEER_Q ? y.moved / d2 : pd >= MIN_PEER_Q ? pm / pd : null;
              if (rate == null) continue;
              m += x.moved; d += d1; e += d1 * rate; v += d1 * rate * (1 - rate);
            }
            const settled = reached > 0 && still / reached <= 0.25, gap = d ? (m - e) / d : 0, z = v > 0 ? (m - e) / Math.sqrt(v) : 0, behind = e - m;
            if (d >= MIN_N && settled && gap <= -GAP && z <= -Z && behind >= 3 && (!best || behind > best.behind)) best = { lbl, names, rate: m / d, exp: e / d, behind };
          }
          if (best) lines.push([best.behind >= 10 ? 'medium' : 'low', 'Deals leak at ' + best.lbl + ' (' + best.names + '): ' + pc(best.rate) + ' of ' + what + ' that left the stage moved on, against ' + pc(best.exp) + ' for ' + peerLabel + ' on the same created quarters, about ' + num(best.behind) + ' deals behind (' + label(POOL[0]) + '–' + label(POOL[2]) + '). What stops them there?']);
          if (peerN && verdict(cc.y2qWon, cc.n, peer.y2qWon, peerN) === 'below') lines.push(['medium', pc(cc.y2qWon / cc.n) + ' of ' + what + ' created in ' + label(cq) + ' was won within 2 quarters, against ' + pc(peer.y2qWon / peerN) + ' for ' + peerLabel + ' (' + num(cc.n) + ' created).']);
        }
        if (staleLine) lines.push(staleLine);
        if (prevOk && verdict(cc.y2qWon, cc.n, prev.y2qWon, prev.n) === 'below') lines.push(['low', 'Won within 2 quarters fell from ' + pc(prev.y2qWon / prev.n) + ' (' + label(cq - 1) + ') to ' + pc(cc.y2qWon / cc.n) + ' (' + label(cq) + ') for ' + what + '.']);
      }
      if ((L.isTop || mixed) && staleLine) lines.push(staleLine);
      if (L.isTop) {
        // SMB against its own quarter before, never against Field
        const [sq, sc] = latest(allSmb), sp = sq != null ? allSmb.get(sq - 1) : null;
        if (sq != null && sp && sp.n >= MIN_N && sq - 1 >= cur - 4) {
          const last = allSmb.get(cur - 1), drop = verdict(sc.y2qWon, sc.n, sp.y2qWon, sp.n) === 'below';
          lines.push(['low', 'SMB: ' + pc(sc.y2qWon / sc.n) + ' of New Business created in ' + label(sq) + ' won within 2 quarters, against ' + pc(sp.y2qWon / sp.n) + ' for ' + label(sq - 1) + ' (' + usd(sc.arrW / sc.n) + ' and ' + usd(sp.arrW / sp.n) + ' won ARR per deal created)' + (drop ? '; a drop beyond the normal swing' : '') + '.' + (last ? ' SMB created ' + num(last.n) + ' in ' + label(cur - 1) + '.' : '')]);
        }
      }
      const rank = { high: 0, medium: 1, low: 2 };
      lines.map((x, i) => [...x, i]).sort((a, b) => rank[a[0]] - rank[b[0]] || a[3] - b[3]).slice(0, MAX_TALK).forEach(([sev, text, extra]) => push('talk', sev, text, extra));
    }
    return out;
  },
});

dash.calc('conv_trust_cohort', {
  title: 'How far to trust the cohort numbers',
  description: 'All EMEA checks on the data behind cohorts, leaks and agendas: the quarters used and which are not yet comparable, closed deals counted for the team that closed them, stage dates (deals created past stage 0, stage counts raised so the funnel never widens), reopened deals, and the row counts of the two cohort queries against the 2,000-row limit (amber from 1,600, red at 2,000: the answer is cut).',
  inputs: ['cv_open', 'cv_closed'],
  fn: (cv_open, cv_closed) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
    const qi = (fy, fq) => (fy == null || fq == null ? null : +fy * 4 + (+fq - 1));
    const label = (i) => 'Q' + ((i % 4) + 1) + ' ' + Math.floor(i / 4);
    const qStart = (i) => Date.UTC(Math.floor(i / 4), (i % 4) * 3, 1);
    const dayTxt = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const env = (r, won) => { const n = +r.n || 0, raw = [0, 1, 2, 3, 4, 5, 6].map((k) => +r['s' + k] || 0), s = new Array(7).fill(n); if (!won) for (let k = 6; k >= 1; k--) s[k] = Math.min(n, Math.max(raw[k], k < 6 ? s[k + 1] : 0)); return { n, raw, fix: won ? 0 : s.slice(1).reduce((a, v, i) => a + v - raw[i + 1], 0) }; };
    const num = (v) => Math.round(v).toLocaleString('en'), pct = (v) => Math.round(v * 100) + '%';
    const inWin = (r) => { const q = qi(r.fy, r.fq); return q != null && q >= cur - 4 && q <= cur; };
    const NB = (r) => r.rt === 'New Business';
    const byQ = new Map();
    const Q = (q) => { if (!byQ.has(q)) byQ.set(q, { n: 0, open: 0 }); return byQ.get(q); };
    let created = 0, fixed = 0, noS0 = 0, openWonBefore = 0, wonAfterLoss = 0, lostAfterWin = 0, closed = 0, movedN = 0, left = 0, noMgr = 0, blank = 0, outside = 0;
    for (const r of cv_open) {
      if (!NB(r) || !inWin(r)) continue;
      const e = env(r, false);
      created += e.n; fixed += e.fix; noS0 += e.n - e.raw[0]; openWonBefore += +r.cwStamp || 0;
      const c = Q(qi(r.fy, r.fq)); c.n += e.n; c.open += e.n;
    }
    for (const r of cv_closed) {
      if (!NB(r) || !inWin(r)) continue;
      const won = r.won === true, e = env(r, won);
      created += e.n; fixed += e.fix; noS0 += e.n - e.raw[0]; closed += e.n;
      if (won) wonAfterLoss += +r.clStamp || 0; else lostAfterWin += +r.cwStamp || 0;
      Q(qi(r.fy, r.fq)).n += e.n;
      // the team that closed it: the role at close when that is an EMEA sales role, else the owner's today
      if (!r.closedRole) blank += e.n;
      else if (!TEAM[r.closedRole]) outside += e.n;
      else if (r.closedRole !== r.role) { movedN += e.n; if (!TEAM[r.role]) left += e.n; if (!r.closedManager) noMgr += e.n; }
    }
    const young = [cur - 1, cur].map((q) => {
      const c = byQ.get(q) || { n: 0, open: 0 }, sh = c.n ? pct(c.open / c.n) : '—';
      return q === cur ? label(q) + ': this quarter, day ' + (Math.floor((now.getTime() - qStart(q)) / 864e5) + 1) + ' of ' + Math.round((qStart(q + 1) - qStart(q)) / 864e5) + ', ' + sh + ' open'
        : label(q) + ': comparable after ' + dayTxt(qStart(q + 2) - 864e5) + ', ' + sh + ' still open';
    });
    const rows = [['Open by quarter', cv_open.length], ['Closed by quarter', cv_closed.length]];
    const sev = (id, s) => ({ key: 'trust|' + id, id, severity: s });
    return [
      { ...sev('window', 'info'), measure: 'Quarters used', value: null, fmt: 'n',
        detail: 'Cohorts: deals created ' + label(cur - 4) + '–' + label(cur) + ' in your Salesforce time zone. Rates and steps compare the quarters whose following quarter has ended (' + label(cur - 4) + '–' + label(cur - 2) + '); younger ones show so far. Deals created before October 2025 were migrated into Salesforce (stage history starts in August 2025) and never enter the window; they still count in the old-deals check.' },
      { ...sev('young', 'info'), measure: 'Quarters not yet comparable', value: 2, fmt: 'n', detail: young.join('; ') + '. Their won so far is shown, never compared.' },
      { ...sev('owner', closed && movedN / closed > 0.05 ? 'warn' : 'info'), measure: 'Closed deals counted for the team that closed them', value: movedN, fmt: 'n',
        detail: num(movedN) + ' of ' + num(closed) + ' closed New Business deals in these quarters now sit with someone in another role (' + num(left) + ' of them outside EMEA sales) and count for the team that closed them and its manager at close (' + num(noMgr) + ' with no closing manager stamped count for no manager); ' + num(blank) + ' closed before about April 2026 have no closing role and count for the owner\'s team today' + (outside ? '; ' + num(outside) + ' carry a role at close outside EMEA sales (another region\'s, RevOps or the like), which moves no deal: they count for the owner\'s team today too' : '') + '. A closed deal still in the same role counts for today\'s manager, so a re-org moves a team\'s history to its new manager. Bookings and Coverage count closed deals the same way.' },
      { ...sev('stamps', created && fixed > 0.02 * created ? 'warn' : 'info'), measure: 'Stage reached comes from stage entry dates', value: fixed, fmt: 'n',
        detail: 'Stages are matched by number (stage 3 was renamed on 3 Nov 2026). A skipped stage is dated too, so a deal walked through every stage in an hour reaches each one; a won deal counts as passing every stage. ' + num(noS0) + ' deals were created past stage 0 and count there anyway; ' + num(fixed) + ' stage counts were raised so the funnel never widens (if this grows, the stamping automation may have changed). The stage history is not used: it doesn\'t narrow, keeps the old stage-3 name and starts in August 2025.' },
      { ...sev('reopen', 'info'), measure: 'Reopened deals', value: openWonBefore, fmt: 'n',
        detail: num(openWonBefore) + ' open deals were Closed Won before and reopened; ' + num(wonAfterLoss) + ' won deals were Closed Lost before; ' + num(lostAfterWin) + ' lost deals were won before. Each counts by what it is today, at its latest close date; stage dates keep the latest pass.' },
      { ...sev('cap', rows.some(([, x]) => x >= 2000) ? 'bad' : rows.some(([, x]) => x >= 1600) ? 'warn' : 'info'), measure: 'Cohort data near the 2,000-row limit', value: rows.filter(([, x]) => x >= 1600).length, fmt: 'n',
        detail: rows.map(([k, x]) => k + ' ' + num(x) + ' rows' + (x >= 2000 ? ' (cut: totals too low)' : '')).join(' · ') },
    ];
  },
});

dash.calc('conv_trust_close', {
  title: 'How far to trust the win-rate and loss numbers',
  description: 'All EMEA checks on New Business closed in the last 4 quarters and this one: admin merges left out, the old and new lost-reason lists, the stage-3 label on older losses, deals lost after a win or won straight from Qualification, closed deals counted for the team that closed them (deals EMEA closed that are owned outside EMEA today included), and the row count of the query against the 2,000-row limit. The clean-up month is checked by conv_closeout.',
  inputs: ['cv_window'],
  fn: (cv_window) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
    const qi = (fy, fq) => (fy == null || fq == null ? null : +fy * 4 + (+fq - 1));
    const label = (i) => 'Q' + ((i % 4) + 1) + ' ' + Math.floor(i / 4);
    const ADMIN = /^(merged with global pilot|record cleanup)$/i;
    const REASON = { 'Qualified Out': 'Not a fit', 'Timing': 'Deferred', 'Technical/Functional Gap': 'Product fit', 'Lost to Competitor': 'Chose an alternative',
      'No Champion': 'Buyer engagement', 'Budget': 'Price and budget', 'Value not perceived': 'Value not perceived' };
    const NEW = ['Chose an alternative', 'Product fit', 'Price and budget', 'Buyer engagement', 'Deferred', 'Not a fit', 'Customer experience and support', 'Other'];
    const usd = (v) => { const a = Math.abs(+v || 0); return '$' + (a >= 999500 ? (a / 1e6).toFixed(a >= 9.95e6 ? 0 : 1) + 'M' : a >= 999.5 ? Math.round(a / 1e3) + 'K' : String(Math.round(a))); };
    const num = (v) => Math.round(v).toLocaleString('en');
    let merges = 0, mergesArr = 0, old = 0, nw = 0, blank = 0, unl = 0, vnp = 0, s3old = 0, s3new = 0, atWin = 0, from0 = 0, closed4 = 0, moved4 = 0, blank4 = 0, outside4 = 0, closedAll = 0, left = 0, lost = 0;
    const mq = {};
    for (const r of cv_window) {
      const q = qi(r.fy, r.fq);
      if (q == null || q < cur - 4 || q > cur) continue;
      const n = +r.n || 0, won = r.won === true, raw = r.reason || '';
      if (!won && ADMIN.test(raw)) { merges += n; mergesArr += +r.arr || 0; mq[label(q)] = (mq[label(q)] || 0) + n; continue; }
      closedAll += n;
      // the team that closed it: the role at close when that is an EMEA sales role, else the owner's today
      const c = TEAM[r.closedRole] ? r.closedRole : null;
      if (c && c !== r.role && !TEAM[r.role]) left += n;
      if (q < cur) { closed4 += n; if (!r.closedRole) blank4 += n; else if (!c) outside4 += n; else if (c !== r.role) moved4 += n; }
      if (won) { if (/^0/.test(r.lastStage || '')) from0 += n; continue; }
      lost += n;
      if (!raw) blank += n; else if (REASON[raw]) old += n; else if (NEW.includes(raw)) nw += n; else unl += n;
      if (raw === 'Value not perceived') vnp += n;
      if (/^3\s*-\s*Pilot Validation/i.test(r.lastStage || '')) s3old += n; else if (/^3\s*-\s*Validation/i.test(r.lastStage || '')) s3new += n;
      if (/^closed won/i.test(r.lastStage || '')) atWin += n;
    }
    const peak = Object.entries(mq).sort((a, b) => b[1] - a[1])[0];
    const rows = cv_window.length;
    const T = (id, measure, value, severity, detail, fmt) => ({ key: 'trust|' + id, id, measure, value, fmt: fmt || 'n', detail, severity });
    return [
      T('merges', 'Admin merges left out', merges, 'info', num(merges) + ' New Business deals closed as Merged with Global Pilot or Record cleanup in the last 4 quarters and this one' + (peak ? ' (' + peak[0] + ': ' + num(peak[1]) + '; ' + usd(mergesArr) + ' ARR in all)' : '') + '; left out of every number here, still counted in Created opps\' totals.'),
      T('reasons', 'Lost reasons on two lists', old, unl > 0 || (lost && blank / lost >= 0.05) ? 'warn' : 'info', 'In the last 4 quarters and this one, ' + num(old) + ' New Business losses use the list retired on 3 Nov 2026: ' + num(old - vnp) + ' are counted under their new name, and Value not perceived (' + num(vnp) + ') has no clear new equivalent and keeps its name, as in Bookings; ' + num(nw) + ' use the new list; ' + num(blank) + ' have no reason; ' + num(unl) + ' use a value on neither list. Why deals are lost shows the 4 completed quarters.'),
      T('stage3', 'Stage 3 renamed', s3old + s3new, 'info', 'In the last 4 quarters and this one, Last Stage Before Close keeps "3 - Pilot Validation" on ' + num(s3old) + ' losses and says "3 - Validation" on ' + num(s3new) + '; both count as stage 3.'),
      T('atwin', 'Lost after a win, won from Qualification', atWin + from0, 'info', 'In the last 4 quarters and this one, ' + num(atWin) + ' losses had Closed Won as their last stage (won, reopened, then lost); ' + num(from0) + ' wins had stage 0 as their last stage, often logged at signature. They count as losses and wins.'),
      T('owner', 'Counted for the team that closed the deal', moved4, 'info', num(moved4) + ' of ' + num(closed4) + ' deals closed in the last 4 quarters now sit with someone in another role and count for the team that closed them; ' + num(blank4) + ' closed before about April 2026 count for the owner\'s team today' + (outside4 ? '; so do ' + num(outside4) + ' whose role at close is outside EMEA sales (another region\'s, RevOps or the like)' : '') + '.'),
      T('left', 'Closed by EMEA, owned outside EMEA today', left, closedAll && left / closedAll > 0.02 ? 'warn' : 'info', num(left) + ' New Business deals an EMEA seller closed in the last 4 quarters and this one now sit with an owner outside EMEA sales (strategic, another region, partnerships, RevOps or no role); they count for the team that closed them. Deals that moved outside EMEA after closing before about April 2026, when no closing role was stamped, can\'t be seen.'),
      T('windowCap', 'Win-rate data near the 2,000-row limit', rows, rows >= 2000 ? 'bad' : rows >= 1600 ? 'warn' : 'info', 'Last 4 quarters and this one: ' + num(rows) + ' rows' + (rows >= 2000 ? ' (cut: totals too low)' : '') + '.'),
    ];
  },
});

dash.calc('conv_trust_timing', {
  title: 'Time each cohort had',
  description: 'For each New Business cohort whose following quarter has ended, the average months its deals had until the end of that following quarter, from Created opps per month: a quarter whose deals came late in it had less time to win, so its share won within 2 quarters reads lower. Flags a quarter half a month or more from the average.',
  inputs: ['cr_monthly'],
  fn: (cr_monthly) => {
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3), curM = now.getUTCFullYear() * 12 + now.getUTCMonth();
    const label = (i) => 'Q' + ((i % 4) + 1) + ' ' + Math.floor(i / 4);
    const by = new Map();
    for (const r of cr_monthly) if (r.rt === 'New Business') { const k = +r.yr * 12 + (+r.mo - 1); by.set(k, (by.get(k) || 0) + (+r.opps || 0)); }
    const covered = [];
    for (const q of [cur - 4, cur - 3, cur - 2]) {
      const m0 = Math.floor(q / 4) * 12 + (q % 4) * 3, ms = [m0, m0 + 1, m0 + 2];
      if (ms.some((m) => m < curM - 12 || m > curM)) continue;
      const n = ms.map((m) => by.get(m) || 0), tot = n[0] + n[1] + n[2];
      if (!tot) continue;
      covered.push({ q, avg: n.reduce((a, v, i) => a + (v / tot) * (6.5 - (i + 1)), 0) });
    }
    const f = (v) => (Math.round(v * 10) / 10).toLocaleString('en');
    if (covered.length < 2) return [{ key: 'trust|timing', id: 'timing', measure: 'Time each quarter\'s deals had', value: null, fmt: 'months', severity: 'info', detail: 'Too few quarters covered by Created opps per month to compare.' }];
    const mean = covered.reduce((a, c) => a + c.avg, 0) / covered.length, off = Math.max(...covered.map((c) => Math.abs(c.avg - mean)));
    return [{ key: 'trust|timing', id: 'timing', measure: 'Time each quarter\'s deals had', value: off, fmt: 'months', severity: off >= 0.5 ? 'warn' : 'info',
      detail: covered.slice().reverse().map((c, i) => label(c.q) + ': ' + f(c.avg) + ' months on average' + (i === 0 ? ' to the end of ' + label(c.q + 1) : '')).join('; ') + '. A quarter whose deals came late in it had less time to win, so its share won within 2 quarters reads lower.' }];
  },
});

dash.calc('checks_conv', {
  title: 'Data checks, conversion cohorts',
  description: 'Conversion problems to fix: open New Business created 3 or more quarters ago that never reached stage 2, per team and manager (5 or more: they make conversion and pipeline read wrong), stage entry dates out of order (stage counts raised for more than 2% of the deals created), and a cohort query cut at 2,000 rows.',
  inputs: ['cv_open', 'cv_closed'],
  fn: (cv_open, cv_closed) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
    const qi = (fy, fq) => (fy == null || fq == null ? null : +fy * 4 + (+fq - 1));
    const label = (i) => 'Q' + ((i % 4) + 1) + ' ' + Math.floor(i / 4);
    const env = (r, won) => { const n = +r.n || 0, raw = [0, 1, 2, 3, 4, 5, 6].map((k) => +r['s' + k] || 0), s = new Array(7).fill(n); if (!won) for (let k = 6; k >= 1; k--) s[k] = Math.min(n, Math.max(raw[k], k < 6 ? s[k + 1] : 0)); return { n, s, fix: won ? 0 : s.slice(1).reduce((a, v, i) => a + v - raw[i + 1], 0) }; };
    const num = (v) => Math.round(v).toLocaleString('en');
    const old = new Map();
    let created = 0, fixed = 0;
    for (const r of cv_open) {
      if (r.rt !== 'New Business') continue;
      const q = qi(r.fy, r.fq), e = env(r, false);
      if (q == null) continue;
      if (q >= cur - 4 && q <= cur) { created += e.n; fixed += e.fix; }
      if (q <= cur - 3 && e.n - e.s[2] > 0) { const team = TEAM[r.role] || 'Other', mgr = r.manager || '(no manager)', k = team + '|' + mgr; const o = old.get(k) || { team, mgr, n: 0 }; o.n += e.n - e.s[2]; old.set(k, o); }
    }
    for (const r of cv_closed) {
      const q = qi(r.fy, r.fq);
      if (r.rt !== 'New Business' || q == null || q < cur - 4 || q > cur) continue;
      const e = env(r, r.won === true);
      created += e.n; fixed += e.fix;
    }
    const since = label(cur - 3), out = [];
    for (const o of old.values()) {
      if (o.n < 5) continue;
      const who = o.mgr === '(no manager)' ? 'the ' + o.team + ' team (no manager in Salesforce)' : o.mgr + '\'s team';
      out.push({ id: 'conv:old:' + o.team + '|' + o.mgr, area: 'Conversion', severity: o.n >= 20 ? 'medium' : 'low', title: o.mgr === '(no manager)' ? o.team + ' (no manager)' : o.mgr,
        person: o.mgr === '(no manager)' ? null : o.mgr, region: o.team, manager: o.mgr === '(no manager)' ? null : o.mgr,
        what: num(o.n) + ' open New Business deals created in ' + since + ' or before are still at stage 0–1', meta: 'they make conversion and pipeline read wrong · progress or close them', screen: 'created', view: 'conversion',
        how: ' Count the open New Business deals of ' + who + ' created in ' + since + ' or before that never reached stage 2, by owner (our own people may be named), stage and quarter created, then draft a short note to ' + (o.mgr === '(no manager)' ? 'the team\'s leader' : o.mgr) + ' asking for them to be progressed or closed. Show me the note and wait for my OK; change no records.' });
    }
    const base = { area: 'Conversion', severity: 'low', person: null, region: 'All', manager: null, screen: 'created', view: 'conversion' };
    if (created && fixed > 0.02 * created) out.push({ ...base, id: 'conv:stamps', title: 'Stage entry dates out of order', what: num(fixed) + ' stage counts were raised: a later stage had more deals than an earlier one', meta: 'the stage-stamping automation may have changed; the funnel may read wrong',
      how: ' Tell me how the IRO stage entry dates are stamped now, whether skipped stages are still filled in, and since when (counts only); change nothing.' });
    if (cv_open.length >= 2000 || cv_closed.length >= 2000) out.push({ ...base, id: 'conv:cap', title: 'Conversion data cut at 2,000 rows', what: 'Open by quarter ' + num(cv_open.length) + ' rows · Closed by quarter ' + num(cv_closed.length) + ' rows', meta: 'cohort totals are too low until the query is split',
      how: ' Tell me which conversion query hit the 2,000-row cap and how to split it; change nothing.' });
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title));
  },
});

dash.calc('checks_conv_lost', {
  title: 'Data checks, lost reasons',
  description: 'Lost-deal records to fix: per team (who closed them), New Business lost with no lost reason in the last 4 quarters and this one; lost with a reason from the list retired on 3 Nov 2026 in a quarter that starts after the switch; for all EMEA, a reason on neither list; and the query cut at 2,000 rows. Admin merges are left out.',
  inputs: ['cv_window'],
  fn: (cv_window) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const now = new Date();
    const cur = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
    const qi = (fy, fq) => (fy == null || fq == null ? null : +fy * 4 + (+fq - 1));
    const qStart = (i) => Date.UTC(Math.floor(i / 4), (i % 4) * 3, 1);
    const dayTxt = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    // the team that closed a deal: its role at close when that is an EMEA sales role, else the owner's today
    const closeTeam = (r) => TEAM[(TEAM[r.closedRole] ? r.closedRole : null) || r.role] || 'Other';
    const ADMIN = /^(merged with global pilot|record cleanup)$/i;
    const OLD = ['Qualified Out', 'Timing', 'Technical/Functional Gap', 'Lost to Competitor', 'No Champion', 'Budget', 'Value not perceived'];
    const NEW = ['Chose an alternative', 'Product fit', 'Price and budget', 'Buyer engagement', 'Deferred', 'Not a fit', 'Customer experience and support', 'Other'];
    const num = (v) => Math.round(v).toLocaleString('en'), plural = (n, one, many) => num(n) + ' ' + (n === 1 ? one : many);
    const SWITCH = 2027 * 4; // Q1 2027, the first quarter that starts after the list changed on 3 Nov 2026
    const none = new Map(), retired = new Map(), unlisted = new Map();
    for (const r of cv_window) {
      const q = qi(r.fy, r.fq), raw = r.reason || '';
      if (r.won === true || q == null || q < cur - 4 || q > cur || ADMIN.test(raw)) continue;
      const n = +r.n || 0, team = closeTeam(r);
      if (!raw) none.set(team, (none.get(team) || 0) + n);
      else if (OLD.includes(raw)) { if (q >= SWITCH) retired.set(team, (retired.get(team) || 0) + n); }
      else if (!NEW.includes(raw)) unlisted.set(raw, (unlisted.get(raw) || 0) + n);
    }
    const out = [];
    const base = (team) => ({ area: 'Conversion', person: null, region: team, manager: null, screen: 'created', view: 'conversion', title: team });
    for (const [team, n] of none) if (n >= 3) out.push({ ...base(team), id: 'conv:noreason:' + team, severity: n >= 10 ? 'medium' : 'low', what: plural(n, 'New Business deal', 'New Business deals') + ' lost with no lost reason', meta: 'last 4 quarters and this one · Why deals are lost misses them',
      how: ' Count, per owner (our own people may be named), the ' + team + ' New Business deals closed lost since ' + dayTxt(qStart(cur - 4)) + ' with no Lost Reason, then draft a short Slack note to the team\'s manager asking owners to pick one from the new list. Show me the note and wait for my OK; change no records.' });
    for (const [team, n] of retired) out.push({ ...base(team), id: 'conv:retired:' + team, severity: 'low', what: plural(n, 'New Business deal', 'New Business deals') + ' lost since 1 Jan 2027 with a reason from the list retired on 3 Nov 2026', meta: 'an automation, import or re-coding may still set the old values',
      how: ' Count the ' + team + ' New Business deals closed lost since 1 Jan 2027 with a retired Lost Reason, by owner (our own people may be named) and by who or what set it (user, flow, import), and tell me; change nothing.' });
    if (unlisted.size) { const tot = [...unlisted.values()].reduce((a, b) => a + b, 0); out.push({ ...base('All'), id: 'conv:unlisted', severity: 'low', title: 'Lost reasons the dashboard doesn\'t know', what: plural(tot, 'New Business loss uses', 'New Business losses use') + ' ' + [...unlisted.keys()].slice(0, 5).join(', '), meta: 'they show as Unlisted in Why deals are lost until the mapping is updated',
      how: ' Tell me when these Lost Reason values were added and which value of the new list each stands for (counts only); change nothing.' }); }
    if (cv_window.length >= 2000) out.push({ ...base('All'), id: 'conv:windowcap', severity: 'low', title: 'Win-rate data cut at 2,000 rows', what: 'Last 4 quarters ' + num(cv_window.length) + ' rows', meta: 'win rates and reasons read low until the query is split', how: ' Tell me how to split the win-rate query so it stays under 2,000 rows; change nothing.' });
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title));
  },
});

dash.calc('checks_conv_days', {
  title: 'Data checks, deals logged at signature',
  description: 'Field teams and Engagement with 10 or more New Business wins in the last 90 days (by the team that closed them) where a quarter or more were created and won within a day: logged at signature, so they never showed in pipeline or forecast. SMB is left out: its motion can close in days.',
  inputs: ['cv_days'],
  fn: (cv_days) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    // the team that closed a deal: its role at close when that is an EMEA sales role, else the owner's today
    const closeTeam = (r) => TEAM[(TEAM[r.closedRole] ? r.closedRole : null) || r.role] || 'Other';
    const num = (v) => Math.round(v).toLocaleString('en');
    const m = new Map();
    for (const r of cv_days) {
      const team = closeTeam(r);
      if (team === 'SMB' || r.daysToWin == null) continue;
      const o = m.get(team) || { wins: 0, oneGo: 0 };
      o.wins += 1; if (+r.daysToWin < 1) o.oneGo += 1;
      m.set(team, o);
    }
    const out = [];
    for (const [team, o] of m) if (o.wins >= 10 && o.oneGo / o.wins >= 0.25) out.push({ id: 'conv:signed:' + team, area: 'Conversion', severity: 'low', title: team, person: null, region: team, manager: null, screen: 'created', view: 'conversion',
      what: num(o.oneGo) + ' of ' + num(o.wins) + ' New Business wins in the last 90 days were created and won within a day', meta: 'logged at signature: they never showed in pipeline or forecast',
      how: ' Count, per owner (our own people may be named), the ' + team + ' New Business deals won within a day of being created in the last 90 days, then draft a short note to the team\'s manager asking reps to create deals when they start working them. Show me the note and wait for my OK; change no records.' });
    if (cv_days.length >= 2000) out.push({ id: 'conv:dayscap', area: 'Conversion', severity: 'low', title: 'Time-in-stage data cut at 2,000 rows', person: null, region: 'All', manager: null, screen: 'created', view: 'conversion', what: 'Recent wins ' + num(cv_days.length) + ' rows', meta: 'medians come from part of the wins until the window is shortened', how: ' Tell me how to shorten the recent-wins window so it stays under 2,000 rows; change nothing.' });
    return out.sort((a, b) => a.title.localeCompare(b.title));
  },
});
