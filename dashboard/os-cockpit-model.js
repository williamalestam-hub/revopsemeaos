// The cockpit's model. It turns a few facts about each scheduled agent (could its document be read, when did it last
// write, how much is waiting on William, is a run under way) and the clock into where its robot belongs in the
// picture, and writes the few words the page shows beside it. Pure logic: no DOM, no network, nothing kept between
// calls. Sets window.OSCrew (module.exports under node). Its test is tools/harness/test40.js.
(function (root) {
  const TZ = 'Europe/Stockholm';
  // days: 1 = Monday ... 7 = Sunday. `at` is wall-clock time in TZ, so the runs follow summer time.
  const ROSTER = [
    { id: 'desk', name: 'Desk', look: 'headset', hue: 'teal', days: [1, 2, 3, 4, 5], at: ['07:13', '13:13'], graceMin: 45, idleWord: 'all clear' },
    { id: 'decide', name: 'Decide', look: 'gavel', hue: 'amber', days: [1, 2, 3, 4, 5], at: ['07:43'], graceMin: 30, idleWord: 'all clear' },
    { id: 'instinct', name: 'Instinct', look: 'antenna', hue: 'rose', days: [1, 2, 3, 4, 5], at: ['08:07'], graceMin: 30, idleWord: 'all clear' },
    { id: 'muse', name: 'Muse', look: 'bulb', hue: 'violet', days: [1, 2, 3, 4, 5], at: ['08:07'], graceMin: 30, idleWord: 'all clear' },
    { id: 'review', name: 'Review', look: 'clipboard', hue: 'blue', days: [1], at: ['07:37'], graceMin: 45, idleWord: 'posted' },
  ];
  const MIN = 6e4, DAY = 864e5;
  const TOL = 20 * MIN;     // agents write their `at` roughly: a result stamped up to 20 minutes before a run is still that run's
  const RUN_MAX = 45 * MIN; // a "running" heartbeat older than this is a run that stopped without saying so
  const SRC = ['ok', 'loading', 'nodb', 'error', 'missing']; // what the page can say about an agent's document

  // ---------- What comes from outside, made safe ----------
  const isObj = (v) => !!v && typeof v === 'object';
  // a real point in time: a number a Date can hold
  const real = (ms) => typeof ms === 'number' && Math.abs(ms) <= 8.64e15;
  // the clock that was handed in, or the machine's when that is not a time
  const clock = (ms) => (real(ms) ? ms : Date.now());
  // an ISO time as ms, or NaN. Only ISO text is read: Date.parse alone takes "run 1" for the year 2001
  const time = (iso) => (typeof iso === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(iso) ? Date.parse(iso) : NaN);
  // text as one trimmed line of at most n characters, and '' for anything that is not text
  const cut = (v, n) => (typeof v === 'string' ? Array.from(v.replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim()).slice(0, n).join('').trim() : '');
  // a count as a whole number from 0 to 9999, and 0 for anything that is not a number
  const count = (v) => (typeof v === 'number' && v > 0 && v < Infinity ? Math.min(9999, Math.floor(v)) : 0);
  // what a count is made of, for the tooltip ("10 decisions, 7 for Leo"): the first four parts, empty ones left out
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
  // next one; a week each way is enough for an agent that runs once a week.
  const runsAround = (agent, nowMs) => {
    const now = clock(nowMs), out = { prev: null, next: null };
    if (!isObj(agent) || !Array.isArray(agent.days) || !Array.isArray(agent.at)) return out;
    try {
      const today = Math.floor(wall(now) / DAY) * DAY;
      // the runs of the day k days from today on TZ's calendar, each put on its side of now
      const look = (k) => {
        const day = today + k * DAY;
        if (!agent.days.includes(((new Date(day).getUTCDay() + 6) % 7) + 1)) return;
        for (const hm of agent.at) {
          const m = /^(\d\d):(\d\d)$/.exec(hm);
          if (!m) continue;
          const t = instant(day + (m[1] * 60 + +m[2]) * MIN);
          if (t <= now) out.prev = Math.max(out.prev ?? t, t); else out.next = Math.min(out.next ?? t, t);
        }
      };
      look(0);
      for (let k = -1; k >= -7 && out.prev === null; k--) look(k);
      for (let k = 1; k <= 7 && out.next === null; k++) look(k);
    } catch (e) { /* a browser without time zones: no schedule, so nothing is ever due or late */ }
    return out;
  };

  // ---------- The words ----------
  const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // A time in words, on the viewer's own clock: 13:15 today, yesterday 13:15, 07:13 tomorrow, Mon 07:46 for any other
  // day less than a week away, 16 Nov from a week away on (so a weekday never means today's own). With `brief`, for
  // the chip, the bubble and a time inside a sentence, yesterday and tomorrow are named by their weekday too.
  const when = (ms, nowMs, brief) => {
    if (!real(ms)) return '';
    const d = new Date(ms), n = new Date(clock(nowMs));
    // whole calendar days from today: counted in dates, not in hours, because a day is 23 or 25 hours when the clocks change
    const date = (x) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
    const days = (date(d) - date(n)) / DAY;
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (days === 0) return hm;
    if (days === -1 && !brief) return 'yesterday ' + hm;
    if (days === 1 && !brief) return hm + ' tomorrow';
    return Math.abs(days) < 7 ? WEEKDAY[d.getDay()] + ' ' + hm : d.getDate() + ' ' + MONTH[d.getMonth()];
  };
  // Why an agent is not in the room: its document is still loading, can't be read here, or was never written.
  const NO_DATA = { line: 'no data', tip: "Can't read the database here", say: 'no data' };
  const UNREAD = { loading: { line: '', tip: 'No data yet', say: 'no data yet' }, nodb: NO_DATA, error: NO_DATA, missing: { line: 'not run yet', tip: 'Has not run yet', say: 'has not run yet' } };
  // What each state says: the chip's line, the bubble shown once when the state changes, the tooltip's sentence and
  // the phrase read out for the picture. In w, `run` is the time of the scheduled run and `at` the time of the last
  // result (of the failure, for an error), both already in words.
  const WORDS = {
    working: (w) => ({ line: 'working' + (w.step ? ' · ' + w.step : ''), bubble: w.step, tip: 'Working now' + (w.step ? ': ' + w.step : ''), say: 'working now' }),
    due: (w) => ({ line: 'due ' + w.run, bubble: 'Run due ' + w.run, tip: 'A run was due at ' + w.run + '. No result yet', say: 'a run was due at ' + w.run }),
    late: (w) => ({ line: 'missed ' + w.run, bubble: 'Missed ' + w.run, tip: 'Missed the ' + w.run + ' run', say: 'missed the ' + w.run + ' run' }),
    error: (w) => ({ line: w.at ? 'failed ' + w.at : 'failed', bubble: 'Run failed', tip: 'The last run failed', say: 'the last run failed' }),
    needs: (w) => ({ line: (w.at ? w.at + ' · ' : '') + w.n + ' for you', bubble: w.n + ' for you', tip: w.n + ' waiting on you' + (w.parts ? ': ' + w.parts : ''), say: w.n + ' waiting on you' }),
    idle: (w) => ({ line: (w.at ? w.at + ' · ' : '') + w.idle, bubble: '', tip: 'Nothing waiting on you', say: 'nothing waiting' }),
    unknown: (w) => ({ bubble: '', ...UNREAD[w.src] }),
  };

  // ---------- The crew ----------
  const derive = (facts, nowMs, names) => {
    const now = clock(nowMs), all = isObj(facts) ? facts : {}, pulse = isObj(all.pulse) ? all.pulse : {};
    const out = { crew: [], lines: {}, tips: {}, aria: '', total: 0 }, said = [];
    for (const agent of ROSTER) {
      const f = isObj(all[agent.id]) ? all[agent.id] : {}, p = isObj(pulse[agent.id]) ? pulse[agent.id] : {};
      // no entry, or a source this does not know, is treated as still loading
      const src = SRC.includes(f.src) ? f.src : 'loading';
      const name = cut(isObj(names) ? names[agent.id] : '', 12) || agent.name;
      const last = time(f.at), n = count(f.waiting), step = cut(p.step, 24);
      const { prev, next } = runsAround(agent, now);
      // its heartbeat: how long ago it started, and the time it speaks of (its end, or else its start)
      const since = now - time(p.startedAt);
      const pulseAt = real(time(p.finishedAt)) ? time(p.finishedAt) : time(p.startedAt);
      // when the last run failed, if it did: the heartbeat says so and is no older than the last result, or the result says so itself
      const failedAt = p.state === 'error' && real(pulseAt) && !(pulseAt < last - TOL) ? pulseAt : f.status === 'failed' ? last : null;

      // The rules. The first that matches wins.
      let state = 'idle';
      // 1. its document could not be read
      if (src !== 'ok') state = 'unknown';
      // 2. a heartbeat that started within the last 45 minutes (and not in the future)
      else if (p.state === 'running' && since >= 0 && since <= RUN_MAX) state = 'working';
      // 3. no result for the latest scheduled run. "Not at or after" rather than "before", so that a missing `at` counts too
      else if (prev !== null && !(last >= prev - TOL)) state = now - prev <= agent.graceMin * MIN ? 'due' : 'late';
      // 4. the last run failed   5. something is waiting on William   6. otherwise idle
      else if (failedAt !== null) state = 'error';
      else if (n > 0) state = 'needs';

      // times inside a line or a sentence are brief; "Last result" and "Next run" have room for yesterday and tomorrow
      const w = WORDS[state]({ src, step, n, parts: breakdown(f.parts), idle: agent.idleWord, run: when(prev, now, true), at: when(state === 'error' ? failedAt : last, now, true) });
      out.crew.push({ id: agent.id, name, look: agent.look, hue: agent.hue, state, waiting: n, step: state === 'working' ? step : '', bubble: w.bubble, fresh: last > 0 ? last : 0 });
      out.lines[agent.id] = w.line;
      out.tips[agent.id] = { state: w.tip, last: src === 'ok' && real(last) ? 'Last result ' + when(last, now) : '', next: next === null ? '' : 'Next run ' + when(next, now) };
      said.push(name + ': ' + w.say + '.');
      // only what stands at William's desk is counted
      if (state === 'needs') out.total += n;
    }
    out.aria = said.join(' ');
    return out;
  };

  const api = { TZ, ROSTER, derive, runsAround, when };
  root.OSCrew = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
