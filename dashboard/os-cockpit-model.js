// The cockpit's model. It turns a few facts about each scheduled agent (could its document be read, when did it last
// write, how much is waiting on William, is a run under way) and the clock into where its robot belongs in the
// picture, and writes the few words the page shows beside it. Pure logic: no DOM, no network, nothing kept between
// calls. Sets window.OSCrew (module.exports under node). Its test is tools/harness/test40.js.
(function (root) {
  const TZ = 'Europe/Stockholm';
  // days: 1 = Monday ... 7 = Sunday. `at` is wall-clock time in TZ, so the runs follow summer time. `also` lists runs
  // that are announced as the next run but never waited for: they are not known to leave a new result behind.
  const ROSTER = [
    { id: 'desk', name: 'Desk', look: 'headset', hue: 'teal', days: [1, 2, 3, 4, 5], at: ['07:13', '13:13'], graceMin: 45, idleWord: 'all clear' },
    { id: 'decide', name: 'Decide', look: 'gavel', hue: 'amber', days: [1, 2, 3, 4, 5], at: ['07:43'], graceMin: 30, idleWord: 'all clear' },
    { id: 'instinct', name: 'Instinct', look: 'antenna', hue: 'rose', days: [1, 2, 3, 4, 5], at: ['08:07'], also: ['10:07', '12:07', '14:07', '16:07'], graceMin: 60, idleWord: 'all clear' },
    { id: 'muse', name: 'Muse', look: 'bulb', hue: 'violet', days: [1, 2, 3, 4, 5], at: ['08:07'], graceMin: 60, idleWord: 'all clear' },
    { id: 'review', name: 'Review', look: 'clipboard', hue: 'blue', days: [1], at: ['07:37'], graceMin: 45, idleWord: 'posted' },
  ];
  // The rooms of the cockpit: his own five, then one room per department. A door on the page opens each. An agent's id
  // is its own in every room, no look or hue comes twice in a room, and no department robot looks like one of his
  // five. At most five agents a room: a sixth makes the picture taller on a phone. `missing` is what an agent says
  // instead of "not run yet" while nothing of it can be read: [the chip's words, the tooltip's sentence]. Neither
  // says that the agent runs: that is not so on every day (Pacing rests at the weekend), and what the agent does is
  // the page's to say, in the sentence above this one in the tooltip. `until` is the moment the agent's task stops
  // by its own instructions (a time with its zone): from then on its tooltip entry is marked `stopped`, so that the
  // page leaves out that sentence, which reads as if the agent still ran.
  // Pacing and Rundown are tasks for the last quarter of 2026: they run in November and December, and their own
  // instructions tell them to post nothing after 31 December.
  const LINK = ['not linked yet', 'Not linked to the cockpit yet'];
  const YEAR_END = '2027-01-01T00:00+01:00'; // the first moment of 2027 in Stockholm
  const ROOMS = [
    { id: 'mine', name: 'Your agents', agents: ROSTER },
    { id: 'hygiene', name: 'Data Hygiene', agents: [
      { id: 'sweeper', name: 'Sweeper', look: 'plain', hue: 'green', days: [1, 5], at: ['06:50'], graceMin: 45, idleWord: 'all clear' },
      { id: 'accounts', name: 'Accounts', look: 'headset', hue: 'violet', days: [3], at: ['06:50'], graceMin: 45, idleWord: 'all clear' },
    ] },
    { id: 'arr', name: 'ARR', agents: [
      { id: 'pacing', name: 'Pacing', look: 'gavel', hue: 'teal', days: [1, 2, 3, 4, 5], at: ['07:45'], graceMin: 45, idleWord: 'posted', missing: LINK, until: YEAR_END },
      { id: 'forecast', name: 'Forecast', look: 'bulb', hue: 'rose', days: [5], at: ['12:10'], graceMin: 45, idleWord: 'all clear' },
      { id: 'renewals', name: 'Renewals', look: 'clipboard', hue: 'amber', days: [4], at: ['06:50'], graceMin: 45, idleWord: 'all clear' },
    ] },
    { id: 'exec', name: 'Executive', agents: [
      { id: 'rundown', name: 'Rundown', look: 'antenna', hue: 'green', days: [1, 2, 3, 4, 5, 6, 7], at: ['20:01'], graceMin: 45, idleWord: 'posted', missing: LINK, until: YEAR_END },
      { id: 'prep', name: 'Prep', look: 'plain', hue: 'blue', days: [5], at: ['12:40'], graceMin: 45, idleWord: 'all clear' },
    ] },
  ];
  const MIN = 6e4, DAY = 864e5;
  const TOL = 20 * MIN;     // agents write their `at` roughly: a result stamped up to 20 minutes before a run is still that run's
  const RUN_MAX = 45 * MIN; // a "running" heartbeat older than this is a run that stopped without saying so
  const SLACK = 2 * MIN;    // how far a heartbeat's clock may be from a result's stamp, or from the viewer's clock
  const SRC = ['ok', 'loading', 'nodb', 'error', 'missing']; // what the page can say about an agent's document

  // ---------- What comes from outside, made safe ----------
  const isObj = (v) => !!v && typeof v === 'object';
  // a real point in time: a number a Date can hold
  const real = (ms) => typeof ms === 'number' && Math.abs(ms) <= 8.64e15;
  // the clock that was handed in, or the machine's when that is not a time
  const clock = (ms) => (real(ms) ? ms : Date.now());
  // An ISO time as ms, or NaN. It has to name its zone (Z, +01:00 or +0100): without one it would be read on the
  // viewer's own clock, so it is no time at all. Only ISO text is read (Date.parse alone takes "run 1" for the year
  // 2001), and it is handed on in the one spelling every browser reads alike.
  const ISO = /^(\d{4}-\d\d-\d\dT\d\d:\d\d)(?::(\d\d)(?:\.(\d+))?)?(Z|[+-]\d\d:?\d\d)$/;
  const time = (iso) => {
    const m = typeof iso === 'string' ? ISO.exec(iso) : null;
    return m ? Date.parse(m[1] + ':' + (m[2] || '00') + '.' + ((m[3] || '') + '000').slice(0, 3) + m[4].replace(/^(.\d\d):?(\d\d)$/, '$1:$2')) : NaN;
  };
  // text as one trimmed line of at most n characters, and '' for anything that is not text
  const cut = (v, n) => (typeof v === 'string' ? Array.from(v.replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim()).slice(0, n).join('').trim() : '');
  // a count as a whole number from 0 to 9999, and 0 for anything that is not a number
  const count = (v) => (typeof v === 'number' && v > 0 && v < Infinity ? Math.min(9999, Math.floor(v)) : 0);
  // what a count is made of ("10 decisions, 7 for Leo"): the first four parts, empty ones left out
  const breakdown = (parts) => (Array.isArray(parts) ? parts.slice(0, 4) : [])
    .filter((x) => isObj(x) && count(x.n) && cut(x.word, 16)).map((x) => count(x.n) + ' ' + cut(x.word, 16)).join(', ');

  // ---------- The schedule ----------
  // TZ's wall clock at an instant, written as if it were UTC, so that plain arithmetic gives its date and weekday.
  let fmt = null;
  const wall = (ms) => {
    fmt = fmt || new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    const p = {};
    for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = +x.value;
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  };
  // The instant at which TZ's clock shows a wall time (given as if UTC, on a whole minute). The zone's offset is read
  // at a first guess and again at the answer: the second reading is what keeps the days around a clock change right.
  const instant = (asUtc) => {
    const guess = asUtc - (wall(asUtc) - asUtc);
    return asUtc - (wall(guess) - guess);
  };
  // The scheduled runs on either side of now, in ms: prev is the latest at or before it, next the first after it
  // (null when there is none). Today's runs first, then back a day at a time to the latest one and forward to the
  // next one; a week each way is enough for an agent that runs once a week. The `also` runs can be the next run,
  // never the latest one: nothing is ever due or late because of them.
  const runsAround = (agent, nowMs) => {
    const now = clock(nowMs), out = { prev: null, next: null };
    if (!isObj(agent) || !Array.isArray(agent.days) || !Array.isArray(agent.at)) return out;
    try {
      const today = Math.floor(wall(now) / DAY) * DAY;
      // a list of HH:MM times as instants on the day k days from today on TZ's calendar; none when the agent is off that day
      const on = (k, times) => {
        const day = today + k * DAY;
        if (!Array.isArray(times) || !agent.days.includes(((new Date(day).getUTCDay() + 6) % 7) + 1)) return [];
        return times.map((hm) => /^(\d\d):(\d\d)$/.exec(hm)).filter(Boolean).map((m) => instant(day + (m[1] * 60 + +m[2]) * MIN));
      };
      // a day's runs, each put on its side of now; the `also` runs only ever on the far side
      const look = (k) => {
        for (const t of on(k, agent.at)) { if (t <= now) out.prev = Math.max(out.prev ?? t, t); else out.next = Math.min(out.next ?? t, t); }
        if (k >= 0) for (const t of on(k, agent.also)) if (t > now) out.next = Math.min(out.next ?? t, t);
      };
      look(0);
      for (let k = -1; k >= -7 && out.prev === null; k--) look(k);
      for (let k = 1; k <= 7 && out.next === null; k++) look(k);
    } catch (e) { /* a browser without time zones: no schedule, so nothing is ever due or late */ }
    return out;
  };
  // A scheduled run with no result: nothing stamped at all, or the last stamp is from before that run, less the
  // tolerance. "Not at or after" rather than "before", so that a missing `at` counts too.
  const unanswered = (prev, last) => prev !== null && !(last >= prev - TOL);
  // The latest scheduled run of a roster agent, in ms, when it has left no result and its grace has passed (the test
  // behind the `late` state); else null.
  const overdue = (id, atIso, nowMs) => {
    const agent = ROSTER.find((a) => a.id === id), now = clock(nowMs);
    const prev = agent ? runsAround(agent, now).prev : null;
    return unanswered(prev, time(atIso)) && now - prev > agent.graceMin * MIN ? prev : null;
  };

  // ---------- The words ----------
  const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // A time in words, on the viewer's own clock: 13:15 today, yesterday 13:15, 07:13 tomorrow, Mon 07:46 for any other
  // day less than a week away, 16 Nov 07:46 from a week away on (so a weekday never means today's own). With `short`,
  // for the chip, the bubble and a time inside a sentence, yesterday and tomorrow are named by their weekday too.
  const when = (ms, nowMs, short) => {
    if (!real(ms)) return '';
    const d = new Date(ms), n = new Date(clock(nowMs));
    // whole calendar days from today: counted in dates, not in hours, because a day is 23 or 25 hours when the clocks change
    const date = (x) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
    const days = (date(d) - date(n)) / DAY;
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (days === 0) return hm;
    if (days === -1 && !short) return 'yesterday ' + hm;
    if (days === 1 && !short) return hm + ' tomorrow';
    return (Math.abs(days) < 7 ? WEEKDAY[d.getDay()] : d.getDate() + ' ' + MONTH[d.getMonth()]) + ' ' + hm;
  };
  // Why an agent is not in the room: its document is still loading, can't be read here, or was never written.
  const NO_DATA = { brief: 'no data', tip: "Can't read the database here", say: 'no data' };
  const UNREAD = { loading: { brief: '', tip: 'No data yet', say: 'no data yet' }, nodb: NO_DATA, error: NO_DATA, missing: { brief: 'not run yet', tip: 'Has not run yet', say: 'has not run yet' } };
  // What each state says. A chip's line is `lead` (the time it opens with: only a line about the last result has one)
  // and `brief` (the rest). `bubble` is shown once when the state changes, `tip` is the tooltip's sentence, `say` the
  // phrase read out for the picture. In w, `run` is the time of the scheduled run and `at` the time of the last
  // result (of the failure, for an error), both in words; `count` is what waits, in words.
  const WORDS = {
    working: (w) => ({ brief: 'working' + (w.step ? ' · ' + w.step : ''), bubble: w.step, tip: 'Working now' + (w.step ? ': ' + w.step : ''), say: 'working now' }),
    due: (w) => ({ brief: 'due ' + w.run, bubble: 'Run due ' + w.run, tip: 'A run was due at ' + w.run + '. No result yet', say: 'a run was due at ' + w.run }),
    // "no result", not "missed": all that is known is that nothing has arrived
    late: (w) => ({ brief: 'no result ' + w.run, bubble: 'No result ' + w.run, tip: 'No result from the ' + w.run + ' run', say: 'no result from the ' + w.run + ' run' }),
    error: (w) => ({ brief: w.at ? 'failed ' + w.at : 'failed', bubble: 'Run failed', tip: 'The last run failed', say: 'the last run failed' }),
    // a partial result (one of its sources failed) is not an error, but it is said where the last result is shown; so
    // is the trial of an agent whose prepared messages cannot be sent yet (w.marks: "partial", "trial", or both)
    needs: (w) => ({ lead: w.at, brief: w.marks.concat(w.count).join(' · '), bubble: w.n + ' for you', tip: w.n + ' waiting on you' + (w.parts ? ': ' + w.parts : ''), say: w.n + ' waiting on you' + w.also }),
    idle: (w) => ({ lead: w.at, brief: w.marks.join(' · ') || w.idle, bubble: '', tip: 'Nothing waiting on you', say: 'nothing waiting' + w.also }),
    // an agent that says for itself why nothing of it can be read (the roster's `missing`) says that, not "not run yet"
    unknown: (w) => ({ bubble: '', ...(w.src === 'missing' && w.own ? w.own : UNREAD[w.src]) }),
  };

  // ---------- The crew ----------
  // `roster` is the room to work on (a list of agents like ROSTER); without one it is his own five.
  const derive = (facts, nowMs, names, roster) => {
    const now = clock(nowMs), all = isObj(facts) ? facts : {}, pulse = isObj(all.pulse) ? all.pulse : {};
    const out = { crew: [], lines: {}, lead: {}, brief: {}, tips: {}, aria: '', total: 0 }, said = [];
    const mine = !Array.isArray(roster) || roster === ROSTER;
    const list = mine ? ROSTER : roster.filter((a) => isObj(a) && typeof a.id === 'string' && a.id);
    for (const agent of list) {
      const f = isObj(all[agent.id]) ? all[agent.id] : {}, p = isObj(pulse[agent.id]) ? pulse[agent.id] : {};
      // no entry, or a source this does not know, is treated as still loading
      const src = SRC.includes(f.src) ? f.src : 'loading';
      const name = cut(isObj(names) ? names[agent.id] : '', 12) || agent.name;
      const last = time(f.at), n = count(f.waiting), partial = f.status === 'partial';
      // on trial: only a result that could be read says so, and only with the word true
      const trial = src === 'ok' && f.trial === true;
      // from its `until` on its task has stopped, by its own instructions (an `until` that is no time ends nothing)
      const stopped = now >= time(agent.until);
      // its own words for a result that does not exist: the chip's, then the tooltip's sentence (the same before and after `until`)
      const mis = Array.isArray(agent.missing) ? agent.missing.map((t, i) => cut(t, i ? 90 : 24)) : [];
      const own = mis[0] && mis[1] ? { brief: mis[0], tip: mis[1], say: mis[0] } : null;
      // a step ends without full stops: sentences are built around it
      const step = cut(p.step, 24).replace(/[.\u2026\s]+$/, '');
      const { prev, next } = runsAround(agent, now);
      // its heartbeat: when it started, and the time it speaks of (its end, or else its start)
      const started = time(p.startedAt), pulseAt = real(time(p.finishedAt)) ? time(p.finishedAt) : started;
      // a run under way: it started within the last 45 minutes (not in the future) and no result has landed since.
      // A result ends the run, whether or not the heartbeat was cleared
      const running = p.state === 'running' && now - started >= 0 && now - started <= RUN_MAX && !(last >= started - SLACK);
      // a run that died: its heartbeat says so, has a time that is not in the future, and is later than the last result,
      // if there is one. An error from before that result is history
      const died = p.state === 'error' && pulseAt <= now + SLACK && !(pulseAt <= last);

      // The rules. The first that matches wins.
      let state = 'idle';
      // 1. its document could not be read
      if (src !== 'ok') state = 'unknown';
      // 2. a run under way
      else if (running) state = 'working';
      // a run that died at or after the latest scheduled time is an error, not a run still awaited
      else if (died && (prev === null || pulseAt >= prev - TOL)) state = 'error';
      // 3. no result for the latest scheduled run: due while its grace lasts, then late
      else if (unanswered(prev, last)) state = now - prev <= agent.graceMin * MIN ? 'due' : 'late';
      // 4. the last result says it failed   5. something is waiting on William   6. otherwise idle
      else if (f.status === 'failed') state = 'error';
      else if (n > 0) state = 'needs';

      // what waits, in words: its parts when it has any, else the number
      const parts = breakdown(f.parts), waits = n > 0 ? parts || n + ' for you' : '';
      // times inside a line or a sentence are short; "Last result" and "Next run" have room for yesterday and tomorrow
      const marks = (partial ? ['partial'] : []).concat(trial ? ['trial'] : []);
      const w = WORDS[state]({ src, own, step, n, parts, marks, also: (partial ? ', last run partial' : '') + (trial ? ', on trial' : ''), count: waits, idle: agent.idleWord, run: when(prev, now, true), at: when(state === 'error' && died ? pulseAt : last, now, true) });
      // what waits on William does not vanish while its agent is working, due, late or failed (a working chip stays short)
      const still = n > 0 && ['working', 'due', 'late', 'error'].includes(state);
      const lead = w.lead || '', brief = w.brief + (still && state !== 'working' ? ' · ' + waits : '');
      out.crew.push({ id: agent.id, name, look: agent.look, hue: agent.hue, state, waiting: n, step: state === 'working' ? step : '', bubble: w.bubble, fresh: last > 0 ? last : 0 });
      out.lines[agent.id] = (lead ? lead + ' · ' : '') + brief;
      out.lead[agent.id] = lead;
      out.brief[agent.id] = brief;
      out.tips[agent.id] = {
        state: w.tip + (still ? '. ' + n + ' still waiting on you' : '') + (trial ? '. Trial: nothing can be sent' : ''),
        last: src === 'ok' && real(last) ? 'Last result ' + when(last, now) + (partial ? ', partial: a source failed' : '') : '',
        // a department's agent is promised a next run only once a result of it has been read: until then nothing says
        // that its schedule is real (his own five have run for as long as the cockpit has stood)
        next: next === null || (src !== 'ok' && !mine) ? '' : 'Next run ' + when(next, now),
        // said only of an agent whose task has stopped: the page then leaves out its sentence on what the agent
        // does, which reads as if it still ran
        ...(stopped ? { stopped: true } : {}),
      };
      said.push(name + ': ' + w.say + (still ? ', ' + n + ' still waiting on you' : '') + '.');
      // everything that waits on William is counted, wherever its agent stands; an agent that can't be read has no count
      if (state !== 'unknown') out.total += n;
    }
    out.aria = said.join(' ');
    return out;
  };

  const api = { TZ, ROSTER, ROOMS, derive, runsAround, when, overdue };
  root.OSCrew = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
