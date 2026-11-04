// EMEA RevOps OS — calculations, selling activity. Each fn uses only its inputs and constants written inside it,
// so readers can check the arithmetic in Sources. "Today" is the reader's clock. Loaded after os-calcs.js
// (its own file to keep each file well under the 256 KB limit).

// ===================== ACTIVITY =====================
// Emails sent and external meetings of EMEA sellers (act_mail, act_mail_prev, act_meet, act_meet_prev), joined to the roster
// by name. Counts only: no subject, email text, name of a person or company outside Legora, or record Id is read anywhere.

dash.calc('act_reps', {
  title: 'Selling activity per person',
  description: 'One row per EMEA seller: emails sent (captured from their mailbox) and external meetings in the last 4 weeks (28 days to yesterday) and the 4 weeks before, meetings booked for the next 2 weeks, split customer / prospect by the account status today; the change on the 4 weeks before for current sellers and leaders whose capture covered both windows; business days since the last email or meeting (Paris calendar, up to yesterday in Paris or your browser\'s time zone, whichever is earlier); and flags. Leaders are shown but never flagged; people in their first 28 days are New. When your access shows activity for fewer than half the sellers, or almost none of one channel, what it hides is blank, not zero; below that, hidden activity reads as nothing captured.',
  inputs: ['act_mail', 'act_mail_prev', 'act_meet', 'act_meet_prev', 'roster'],
  fn: (act_mail, act_mail_prev, act_meet, act_meet_prev, roster) => {
    const TEAM = { 'AE-EMEA-FR': 'France', 'AE-EMEA-DACH': 'DACH', 'AE-EMEA-SOUTH': 'Southern Europe', 'AE-EMEA-IBERIA-LATAM': 'Iberia & LATAM', 'AE-EMEA-BENELUX': 'Benelux', 'AE-EMEA-NORDICS': 'Nordics', 'AE-EMEA-CEE': 'CEE', 'AE-EMEA-MEA': 'MEA', 'SMB-EMEA': 'SMB', 'EM-EMEA': 'Engagement', 'EM-EMEA-LATAM': 'Engagement', 'DIR-EM-EMEA': 'Engagement', 'BDR-EMEA': 'BDR', 'DIR-BDR-EMEA': 'BDR', 'DIR-SALES-EMEA': 'Leadership', 'MGR-SALES-EMEA': 'Leadership', 'VP-SALES-EMEA': 'Leadership' };
    const kindOf = (role) => (/^AE-EMEA-/.test(role || '') ? 'AE' : role === 'SMB-EMEA' ? 'SMB' : role === 'BDR-EMEA' ? 'BDR' : role === 'EM-EMEA' || role === 'EM-EMEA-LATAM' ? 'EM' : 'Leader');
    const NEW_DAYS = 28, CMP_DAYS = 56, QUIET_BD = 5, QUIET_LONG_BD = 10, GAP_BD = 10, RECENT_BD = 3;
    const SLOW = 0.7, MIN_CORE = 8, MIN_MAIL = 40, BOOK_MIN = 4, OFF_MEET = 4, OFF_MAIL = 40, MIN_PEERS = 5;
    const ts = (x) => { if (!x) return null; const t = Date.parse(String(x).replace(/([+-]\d\d)(\d\d)$/, '$1:$2')); return Number.isNaN(t) ? null : t; };
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
    const dayIn = (f, t) => { const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value])); return Date.UTC(+p.year, +p.month - 1, +p.day) / 864e5; };
    const dayN = (t) => dayIn(fmt, t);
    const dayLbl = (n) => new Date(n * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    // the queries' "yesterday" is in the viewer's Salesforce time zone, normally where their browser is: never count a
    // Paris day it hasn't reached (a browser behind Paris is still on the day before until its own midnight). A
    // Salesforce zone set behind the browser's can still count one day early in the morning: the Activity view says so.
    const here = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const today = Math.min(dayN(Date.now()), dayIn(here, Date.now()));
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
    // a channel hidden for the sellers the viewer can see (with limited access too: these are only sellers with activity)
    const mailHidden = withMeet.length >= 10 && withMeet.filter((r) => r.emails > 0).length < withMeet.length / 2;
    const meetHidden = withMail.length >= 10 && withMail.filter((r) => r.meetings > 0).length < withMail.length / 2;
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
        // each gap is read off the other channel, so both must be visible
        mailOff = seenMail && seenMeet && tenured && r.meetings >= OFF_MEET && (r.emails === 0 || (r.idleMail != null && r.idleMail >= GAP_BD && r.idleMeet != null && r.idleMeet <= RECENT_BD));
        calOff = seenMeet && seenMail && tenured && r.kind !== 'BDR' && r.emails >= OFF_MAIL && (r.meetings === 0 ? true : r.idleMeet != null && r.idleMeet >= GAP_BD && r.idleMail != null && r.idleMail <= RECENT_BD && r.meetPrev >= OFF_MEET);
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
      // like-for-like only for current sellers and leaders whose capture covers the last 4 weeks too, on a channel the
      // viewer can see (leaders are never flagged, so their nothing-captured test is here)
      const capOk = !flags.includes('No capture') && !(r.kind === 'Leader' && r.active && (r.emails === 0 || mailHidden) && (r.meetings === 0 || meetHidden));
      const cmpMeet = r.cmpMeet && r.active && !meetHidden && !calOff && capOk, cmpMail = r.cmpMail && r.active && !mailHidden && !mailOff && capOk;
      const lost = (r.cmpMeet || r.cmpMail) && !cmpMeet && !cmpMail;
      const blind = status === 'Not visible';
      // a comparison lost to a hidden channel: give the visible channel's own reason, since its line is the one shown
      const visPrev = mailHidden ? r.meetPrev : r.emailsPrev, visFirst = mailHidden ? r.firstMeetPrev : r.firstMailPrev;
      const visNote = mailHidden && meetHidden ? 'not visible with your access' : !visPrev ? 'nothing captured in the 4 weeks before' : visFirst != null ? 'capture started ' + dayLbl(dayN(visFirst)) : 'capture didn\'t cover the 4 weeks before';
      const trendNote = blind ? 'not visible with your access' : !lost ? r.trendNote : !r.active ? 'left' : !capOk ? 'nothing captured in the last 4 weeks' : mailOff || calOff ? 'capture looks off in the last 4 weeks' : visNote;
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
  description: 'Per team, per manager ("M|<manager>", direct reports) and for all EMEA: external meetings and emails sent in the last 4 weeks (customer / prospect), meetings booked for the next 2 weeks, meetings and emails per seller a week, the like-for-like change on the 4 weeks before (only current sellers and leaders whose capture covered both windows, with how many were compared), and how many sellers are quiet, slowing, have nothing booked, are below the usual range or have nothing captured. When your access shows activity for fewer than half the sellers, it also gives for how many in the scope it shows none, and a scope where it shows none at all is blank; a channel your access hides is blank.',
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
      // flags that can't fire with a channel hidden: Quiet needs both, Nothing booked needs meetings
      if (g.mailHidden || g.meetHidden) o.quiet = o.quietLong = null;
      if (g.meetHidden) o.nothingBooked = null;
      // a scope where the viewer's access shows no seller's activity: blank, not a row of zeros
      if (o.sellers && o.notVisible >= o.sellers) for (const f of ['captured', 'meetings', 'meetCust', 'meetPros', 'events', 'booked', 'bookedCust', 'bookedPros', 'emails', 'emailsCust', 'emailsPros', 'people', 'accounts', 'custMet', 'meetPrev', 'emailsPrev',
        'meetWk', 'emailsWk', 'custShare', 'meetPerSellerWk', 'emailsPerSellerWk', 'lflMeetReps', 'meetChg', 'lflMailReps', 'emailsChg', 'notCompared', 'quiet', 'quietLong', 'slowing', 'nothingBooked', 'belowRange', 'noCapture', 'captureGap', 'needLook', 'badge', 'checkCapture']) o[f] = null;
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
    out.push({ id: 'access', measure: 'Hidden by your access', value: g.limited || g.mailHidden || g.meetHidden ? 1 : 0, fmt: 'n', detail: !(g.limited || g.mailHidden || g.meetHidden) ? 'Your access shows activity for ' + num(g.visibleSellers || 0) + ' of ' + num(g.sellers || 0) + ' sellers past their first 28 days.'
      : (g.limited ? 'Your Salesforce access shows activity for ' + num(g.visibleSellers) + ' of ' + num(g.sellers) + ' sellers; the others show Not visible.' + (g.mailHidden || g.meetHidden ? ' For those it shows, it' : '') : 'Your access')
        + (g.mailHidden ? ' shows meetings but almost no captured emails, so emails show — and no one is flagged Quiet.' : g.meetHidden ? ' shows emails but almost no meetings, so meetings show — and only email-based flags remain.' : ''), severity: g.limited || g.mailHidden || g.meetHidden ? 'warn' : 'info' });
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
  description: 'For each person in team_tree, their whole team (them and everyone below them in the Salesforce manager chain): external meetings in the last 4 weeks (customer / prospect), booked for the next 2 weeks, emails sent, meetings per seller a week, the like-for-like change in meetings on the 4 weeks before, and how many people are quiet, slowing or have nothing booked. When your access shows activity for fewer than half the sellers, a team with sellers it shows none for is blank rather than a partial total; meetings are blank when it hides meetings, and flags that can\'t fire with a channel hidden are blank too. Its own calc, so the scorecard still loads when activity can\'t be read.',
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
        actHidden: rs.filter((r) => r.status === 'Not visible').length, actMailHidden: !!g.mailHidden, actMeetHidden: !!g.meetHidden };
      // flags that can't fire with a channel hidden are blank, not 0: Quiet needs both channels, Nothing booked needs meetings
      if (g.mailHidden || g.meetHidden) o.actQuiet = null;
      if (g.meetHidden) o.actNothingBooked = null;
      o.actFlags = (o.actQuiet || 0) + o.actSlowing + (o.actNothingBooked || 0);
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
  description: 'The activity lines of each 1:1 agenda (for a leader, their whole team): numbers (meetings, emails, booked, the like-for-like change and the usual range for their role) and up to 3 talking points, most urgent first: nothing captured for 5+ business days, the role\'s meetings (or a BDR\'s emails) well down on the 4 weeks before, nothing booked for the next 2 weeks, no prospect meetings, below the usual range for the role, and capture problems. People in their first 28 days get the numbers only; a person, or a team, whose activity the viewer\'s access doesn\'t show gets a line saying so instead of zeros. Its own calc, so agendas still build when activity can\'t be read; the agenda merges it in by severity, after the core and routing points.',
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
        if (!r || !r.active || (r.kind === 'Leader' && !r.meetings && !r.emails)) continue;
        // say so rather than leave activity out: the agenda is copied, emailed and sent to Claude
        if (r.status === 'Not visible') { push('numbers', '', 'Activity: your Salesforce access shows no sent email or meeting of theirs in the last 8 weeks.', { actHidden: true }); continue; }
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
        // no seller's activity visible: say so instead of a line of zeros (the weekly summary does the same)
        if (sel && hid >= sel) push('numbers', '', 'Team activity, last 4 weeks: not visible with your Salesforce access (it shows no activity for any of the ' + plural(sel, 'seller', 'sellers') + ' in this team).', { actHidden: true });
        else push('numbers', '', 'Team activity, last 4 weeks: ' + (g.meetHidden ? 'meetings not visible with your access' : plural(sum('meetings'), 'external meeting', 'external meetings') + ' (' + num(sum('meetCust')) + ' with customers, ' + num(sum('meetPros')) + ' with prospects), ' + num(sum('booked')) + ' booked for the next 2 weeks') + '; ' + (g.mailHidden ? 'emails not visible with your access' : plural(sum('emails'), 'email', 'emails') + ' sent') + '.'
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
        if (nc.length) talk.push(['low', plural(nc.length, 'person has', 'people have') + (g.mailHidden ? ' no meeting captured (emails not visible with your access): ' : g.meetHidden ? ' no sent email captured (meetings not visible with your access): ' : ' no activity captured or a capture gap: ') + list(nc, (r) => r.name) + '. Check capture before reading their numbers.', chk]);
      }
      const rank = { high: 0, medium: 1, low: 2 };
      talk.map((x, i) => [...x, i]).sort((a, b) => rank[a[0]] - rank[b[0]] || a[3] - b[3]).slice(0, MAX_TALK).forEach(([sev, text, extra]) => push('talk', sev, text, extra));
    }
    return out;
  },
});
