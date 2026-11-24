process.env.TZ = 'Europe/Stockholm';
// The cockpit's model (dashboard/os-cockpit-model.js): which state each agent is in, and the few words the page shows.
// The line above fixes this process's own zone, so the expected words are Stockholm's on any machine. The last section
// runs the same facts in other zones (child processes): the schedule must not move, the words must follow the viewer.
//   node tools/harness/test40.js [path/to/model.js]
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '../../dashboard/os-cockpit-model.js'));
let fails = 0, passes = 0;
const ok = (c, l, x) => { if (!c) fails++; else passes++; console.log(c ? 'ok  ' : 'FAIL', l, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
const done = () => { console.log(`\n${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0); };
let C = null;
try { C = require(FILE); } catch (e) { ok(false, 'the model loads under node, where there is no window', String(e && e.stack).slice(0, 400)); done(); }
const eq = (got, want, l) => ok(JSON.stringify(got) === JSON.stringify(want), l, { got, want });
// every value in a list must give the same outcome
const each = (values, outcome, want, l) => eq(values.map(outcome), values.map(() => want), l);
const T = (iso) => Date.parse(iso);
const iso = (ms) => new Date(ms).toISOString();
const Z = (ms) => (ms === null ? null : iso(ms).replace(':00.000Z', 'Z')); // 2026-11-24T12:13Z when it is on a whole minute
const MIN = 60000, HOUR = 3600000;

ok(new Date(2026, 10, 24, 14, 8).getTime() === T('2026-11-24T13:08:00Z') && new Date(2026, 6, 1, 14, 0).getTime() === T('2026-07-01T12:00:00Z'),
  'this process tells Stockholm time, winter and summer', iso(new Date(2026, 10, 24, 14, 8).getTime()));

// ---------- what it exports ----------
eq(Object.keys(C).sort(), ['ROSTER', 'TZ', 'derive', 'runsAround', 'when'], 'exports TZ, ROSTER, derive, runsAround and when');
ok(C.TZ === 'Europe/Stockholm', 'the schedule is kept in Europe/Stockholm', C.TZ);
eq(C.ROSTER, [
  { id: 'desk', name: 'Desk', look: 'headset', hue: 'teal', days: [1, 2, 3, 4, 5], at: ['07:13', '13:13'], graceMin: 45, idleWord: 'all clear' },
  { id: 'decide', name: 'Decide', look: 'gavel', hue: 'amber', days: [1, 2, 3, 4, 5], at: ['07:43'], graceMin: 30, idleWord: 'all clear' },
  { id: 'instinct', name: 'Instinct', look: 'antenna', hue: 'rose', days: [1, 2, 3, 4, 5], at: ['08:07'], graceMin: 30, idleWord: 'all clear' },
  { id: 'muse', name: 'Muse', look: 'bulb', hue: 'violet', days: [1, 2, 3, 4, 5], at: ['08:07'], graceMin: 30, idleWord: 'all clear' },
  { id: 'review', name: 'Review', look: 'clipboard', hue: 'blue', days: [1], at: ['07:37'], graceMin: 45, idleWord: 'posted' },
], 'the roster is the contract\'s: five agents in desk order');
ok(globalThis.OSCrew === C, 'without a window it is globalThis.OSCrew');
const TEXT = fs.readFileSync(FILE, 'utf8'), CODE = TEXT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
ok(!/\bdocument\b|\bnavigator\b|Storage\b|\bfetch\b|innerHTML|setTimeout|setInterval|EventListener|\bdash\b|\bOS\./.test(CODE), 'pure logic: no DOM, storage, network, timer, listener, dash or OS in the code');

const IDS = C.ROSTER.map((a) => a.id);
const [desk, decide, instinct, muse, review] = C.ROSTER;

// ---------- the schedule is Stockholm's wall clock, in every season ----------
const runs = (agent, now) => { const r = C.runsAround(agent, typeof now === 'string' ? T(now) : now); return [Z(r.prev), Z(r.next)]; };
// Tuesday 24 November 2026, 14:08 in Stockholm (winter: one hour ahead of UTC)
eq(runs(desk, '2026-11-24T13:08:00Z'), ['2026-11-24T12:13Z', '2026-11-25T06:13Z'], 'winter, Tuesday 14:08: Desk last ran at 13:13 (12:13 UTC), next tomorrow 07:13');
eq(runs(decide, '2026-11-24T13:08:00Z'), ['2026-11-24T06:43Z', '2026-11-25T06:43Z'], 'winter, Tuesday 14:08: Decide ran at 07:43, next tomorrow');
eq([runs(instinct, '2026-11-24T13:08:00Z'), runs(muse, '2026-11-24T13:08:00Z')], [['2026-11-24T07:07Z', '2026-11-25T07:07Z'], ['2026-11-24T07:07Z', '2026-11-25T07:07Z']], 'winter, Tuesday 14:08: Instinct and Muse ran at 08:07');
eq(runs(review, '2026-11-24T13:08:00Z'), ['2026-11-23T06:37Z', '2026-11-30T06:37Z'], 'winter, Tuesday 14:08: Review ran on Monday 07:37, next on Monday');
eq(runs(desk, '2026-11-24T12:13:00.000Z'), ['2026-11-24T12:13Z', '2026-11-25T06:13Z'], 'on the minute of a run, that run is the latest one ("at or before now")');
eq(runs(desk, '2026-11-24T12:12:59.999Z'), ['2026-11-24T06:13Z', '2026-11-24T12:13Z'], 'a millisecond earlier it is still the next one');
// summer: two hours ahead of UTC
eq(runs(desk, '2026-07-01T12:00:00Z'), ['2026-07-01T11:13Z', '2026-07-02T05:13Z'], 'summer, Wednesday 14:00: 13:13 is 11:13 UTC and 07:13 is 05:13 UTC');
// the clocks go back on Sunday 25 October 2026 at 01:00 UTC
eq(runs(desk, '2026-10-23T12:00:00Z'), ['2026-10-23T11:13Z', '2026-10-26T06:13Z'], 'Friday before the clocks go back: 13:13 in summer time, then Monday 07:13 in winter time');
eq([runs(desk, '2026-10-25T00:30:00Z'), runs(desk, '2026-10-25T01:30:00Z')], [['2026-10-23T11:13Z', '2026-10-26T06:13Z'], ['2026-10-23T11:13Z', '2026-10-26T06:13Z']], 'the same on that Sunday, on both sides of the change (02:30 comes twice)');
eq(runs(desk, '2026-10-26T07:00:00Z'), ['2026-10-26T06:13Z', '2026-10-26T12:13Z'], 'Monday after the clocks went back: 07:13 and 13:13 one hour ahead of UTC');
eq(runs(review, '2026-10-22T12:00:00Z'), ['2026-10-19T05:37Z', '2026-10-26T06:37Z'], 'Review across the autumn change: Monday 07:37 both times, 169 hours apart');
// the clocks go forward on Sunday 28 March 2027 at 01:00 UTC
eq(runs(desk, '2027-03-26T13:00:00Z'), ['2027-03-26T12:13Z', '2027-03-29T05:13Z'], 'Friday before the clocks go forward: 13:13 in winter time, then Monday 07:13 in summer time');
eq([runs(desk, '2027-03-28T00:30:00Z'), runs(desk, '2027-03-28T01:30:00Z')], [['2027-03-26T12:13Z', '2027-03-29T05:13Z'], ['2027-03-26T12:13Z', '2027-03-29T05:13Z']], 'the same on that Sunday, on both sides of the change');
eq(runs(desk, '2027-03-29T06:00:00Z'), ['2027-03-29T05:13Z', '2027-03-29T11:13Z'], 'Monday after the clocks went forward: 07:13 and 13:13 two hours ahead of UTC');
eq(runs(review, '2027-03-25T12:00:00Z'), ['2027-03-22T06:37Z', '2027-03-29T05:37Z'], 'Review across the spring change: Monday 07:37 both times, 167 hours apart');
// runs on the very day of a change, either side of it: the zone's offset has to be read at the answer, not at a guess
const sunday = { days: [7], at: ['01:30', '03:30'] };
eq(runs(sunday, '2026-10-25T00:00:00Z'), ['2026-10-24T23:30Z', '2026-10-25T02:30Z'], 'the day the clocks go back: 01:30 is still summer time, 03:30 already winter time');
eq(runs(sunday, '2027-03-28T01:00:00Z'), ['2027-03-28T00:30Z', '2027-03-28T01:30Z'], 'the day the clocks go forward: 01:30 is still winter time, 03:30 already summer time');
// evenings, weekends, midnight
eq(runs(desk, '2026-11-27T19:00:00Z'), ['2026-11-27T12:13Z', '2026-11-30T06:13Z'], 'Friday 20:00: Desk ran at 13:13, next on Monday 07:13');
eq([runs(decide, '2026-11-27T19:00:00Z'), runs(review, '2026-11-27T19:00:00Z')], [['2026-11-27T06:43Z', '2026-11-30T06:43Z'], ['2026-11-23T06:37Z', '2026-11-30T06:37Z']], 'Friday 20:00: Decide next on Monday 07:43, Review on Monday 07:37');
eq([runs(desk, '2026-11-28T10:00:00Z'), runs(desk, '2026-11-29T22:59:59Z')], [['2026-11-27T12:13Z', '2026-11-30T06:13Z'], ['2026-11-27T12:13Z', '2026-11-30T06:13Z']], 'Saturday morning and Sunday 23:59:59: the latest run is Friday\'s, the next Monday\'s');
eq([runs(desk, T('2026-11-23T23:00:00Z') - 1), runs(desk, '2026-11-23T23:00:00Z')], [['2026-11-23T12:13Z', '2026-11-24T06:13Z'], ['2026-11-23T12:13Z', '2026-11-24T06:13Z']], 'midnight Monday to Tuesday (23:00 UTC): the same runs a millisecond before and at 00:00');
eq([runs(desk, T('2026-11-22T23:00:00Z') - 1), runs(desk, '2026-11-22T23:00:00Z')], [['2026-11-20T12:13Z', '2026-11-23T06:13Z'], ['2026-11-20T12:13Z', '2026-11-23T06:13Z']], 'midnight Sunday to Monday: Friday\'s run behind, Monday\'s ahead');
eq(runs(desk, '2026-11-27T23:00:00Z'), ['2026-11-27T12:13Z', '2026-11-30T06:13Z'], 'midnight Friday to Saturday: nothing until Monday');
eq(runs(desk, '2026-06-30T22:00:00Z'), ['2026-06-30T11:13Z', '2026-07-01T05:13Z'], 'a summer midnight (22:00 UTC)');
// the Monday-only agent
eq(runs(review, T('2026-11-23T06:37:00Z') - 1), ['2026-11-16T06:37Z', '2026-11-23T06:37Z'], 'Review on Monday just before 07:37: last Monday\'s run behind, today\'s ahead');
eq(runs(review, '2026-11-23T06:37:00Z'), ['2026-11-23T06:37Z', '2026-11-30T06:37Z'], 'Review on Monday at 07:37: today\'s run is the latest, the next is a week away');
eq(runs(review, '2026-11-22T23:00:00Z'), ['2026-11-16T06:37Z', '2026-11-23T06:37Z'], 'Review at midnight Sunday to Monday');
eq(runs(review, '2026-11-29T22:59:59Z'), ['2026-11-23T06:37Z', '2026-11-30T06:37Z'], 'Review on Sunday night: six days and a bit after its run');
eq([runs({ days: [5, 4, 3, 2, 1], at: ['13:13', '07:13'] }, '2026-11-24T05:00:00Z'), runs({ days: [5, 4, 3, 2, 1], at: ['13:13', '07:13'] }, '2026-11-24T07:00:00Z')], [['2026-11-23T12:13Z', '2026-11-24T06:13Z'], ['2026-11-24T06:13Z', '2026-11-24T12:13Z']], 'the order the days and times are listed in does not matter');
eq([runs({ days: [1], at: ['18:00'] }, '2026-11-23T13:00:00Z'), runs({ days: [1], at: ['18:00'] }, '2026-11-23T17:00:00Z')], [['2026-11-16T17:00Z', '2026-11-23T17:00Z'], ['2026-11-23T17:00Z', '2026-11-30T17:00Z']], 'a weekly evening run: a full week back in the afternoon, a full week ahead once it has run');
each([null, {}, { days: [], at: ['07:13'] }, { days: [1], at: ['7.13', 713, null] }], (agent) => C.runsAround(agent, 0), { prev: null, next: null }, 'an agent with no readable schedule has no runs');
// two years, every 6 h 7 min: the runs either side of any moment are real scheduled times on Stockholm's clock, and the
// gap between them is one of the schedule's own, an hour longer or shorter only across a clock change
const stockholm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' });
const onClock = (ms) => { const p = Object.fromEntries(stockholm.formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1, hm: p.hour + ':' + p.minute }; };
const GAPS = { desk: [6, 18, 65, 66, 67], decide: [24, 71, 72, 73], instinct: [24, 71, 72, 73], muse: [24, 71, 72, 73], review: [167, 168, 169] };
for (const agent of C.ROSTER) {
  const seen = new Set(), wrong = [];
  for (let t = T('2026-01-01T00:00:00Z'); t < T('2028-01-01T00:00:00Z'); t += 367 * MIN) {
    const r = C.runsAround(agent, t);
    const good = [r.prev, r.next].every((x) => Number.isInteger(x) && agent.days.includes(onClock(x).day) && agent.at.includes(onClock(x).hm)) && r.prev <= t && t < r.next;
    if (!good && wrong.length < 3) wrong.push([iso(t), Z(r.prev), Z(r.next)]);
    seen.add((r.next - r.prev) / HOUR);
  }
  ok(!wrong.length, `${agent.id}: through 2026 and 2027 the runs either side of now are its own times on its own days`, wrong);
  eq([...seen].sort((a, b) => a - b), GAPS[agent.id], `${agent.id}: the hours between two runs are ${GAPS[agent.id].join(', ')} and nothing else`);
}

// ---------- the words for a time: the viewer's own clock ----------
const NOW = T('2026-11-24T13:08:00Z'); // Tuesday 14:08 here
eq([C.when(T('2026-11-24T12:15:58Z'), NOW), C.when(T('2026-11-24T23:00:00Z') - 1, NOW), C.when(T('2026-11-23T23:00:00Z'), NOW)], ['13:15', '23:59', '00:00'], 'today is the time alone, seconds dropped, from 00:00 to 23:59');
eq([C.when(T('2026-11-23T12:15:00Z'), NOW), C.when(T('2026-11-23T23:00:00Z') - 1, NOW)], ['yesterday 13:15', 'yesterday 23:59'], 'yesterday is "yesterday 13:15", up to the last millisecond before midnight');
eq(C.when(T('2026-11-25T06:13:00Z'), NOW), '07:13 tomorrow', 'tomorrow is "07:13 tomorrow"');
eq([C.when(T('2026-11-22T12:15:00Z'), NOW), C.when(T('2026-11-18T06:46:00Z'), NOW), C.when(T('2026-11-26T06:13:00Z'), NOW), C.when(T('2026-11-30T06:37:00Z'), NOW)], ['Sun 13:15', 'Wed 07:46', 'Thu 07:13', 'Mon 07:37'], 'two to six days away, either way, is the weekday and the time');
eq([C.when(T('2026-11-17T06:46:00Z'), NOW), C.when(T('2026-11-16T06:46:19Z'), NOW), C.when(T('2026-12-01T06:37:00Z'), NOW), C.when(T('2027-01-04T06:37:00Z'), NOW)], ['17 Nov', '16 Nov', '1 Dec', '4 Jan'], 'a week or more away is the date (so a weekday never means today\'s own)');
eq([C.when(T('2026-11-23T06:46:19Z'), NOW, true), C.when(T('2026-11-25T06:13:00Z'), NOW, true), C.when(T('2026-11-24T12:15:58Z'), NOW, true), C.when(T('2026-11-16T06:46:19Z'), NOW, true)], ['Mon 07:46', 'Wed 07:13', '13:15', '16 Nov'], 'the brief form (chips and bubbles) names yesterday and tomorrow by their weekday; the rest is the same');
eq([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => C.when(new Date(2025, m, 5, 9, 4).getTime(), NOW)), ['5 Jan', '5 Feb', '5 Mar', '5 Apr', '5 May', '5 Jun', '5 Jul', '5 Aug', '5 Sep', '5 Oct', '5 Nov', '5 Dec'], 'the twelve months, by the same short names in every browser');
// a calendar day is 25 or 23 hours long when the clocks change
eq([C.when(T('2026-10-24T22:30:00Z'), T('2026-10-25T23:30:00Z')), C.when(T('2026-10-24T21:30:00Z'), T('2026-10-25T23:30:00Z'))], ['yesterday 00:30', 'Sat 23:30'], 'Monday 00:30 after the clocks went back: 25 hours ago is yesterday, 26 hours ago is Saturday');
eq([C.when(T('2027-03-27T23:30:00Z'), T('2027-03-28T22:30:00Z')), C.when(T('2027-03-28T21:45:00Z'), T('2027-03-28T22:30:00Z'))], ['yesterday 00:30', 'yesterday 23:45'], 'Monday 00:30 after the clocks went forward: 23 hours ago and 45 minutes ago are both yesterday');
each([NaN, null, undefined, '2026-11-24T12:15:58Z', 1e20, Infinity, {}], (v) => C.when(v, NOW), '', 'a time that is not a time has no words');
ok(/^(yesterday )?\d\d:\d\d$/.test(C.when(Date.now(), NaN)) && /^(yesterday )?\d\d:\d\d$/.test(C.when(Date.now())), 'without a clock the machine\'s own is used', C.when(Date.now(), NaN));

// ---------- the real example, as written ----------
const REAL = {
  desk: { src: 'ok', at: '2026-11-24T12:15:58Z', status: 'ok', waiting: 113 },
  decide: { src: 'ok', at: '2026-11-24T06:44:12Z', waiting: 17, parts: [{ n: 10, word: 'decisions' }, { n: 7, word: 'for Leo' }] },
  instinct: { src: 'ok', at: '2026-11-24T07:30:00Z', waiting: 3 },
  muse: { src: 'ok', at: '2026-11-24T07:30:00Z', waiting: 2 },
  review: { src: 'ok', at: '2026-11-23T06:46:19Z', waiting: 0 },
};
const real = C.derive(REAL, NOW);
eq(real.crew.map((a) => a.state), ['needs', 'needs', 'needs', 'needs', 'idle'], 'real example: four agents wait on you, Review is idle');
eq(real.lines, { desk: '13:15 · 113 for you', decide: '07:44 · 17 for you', instinct: '08:30 · 3 for you', muse: '08:30 · 2 for you', review: 'Mon 07:46 · posted' }, 'real example: the five chip lines');
ok(real.total === 135, 'real example: 135 waiting in all', real.total);
eq([real.tips.desk.next, real.tips.review.next], ['Next run 07:13 tomorrow', 'Next run Mon 07:37'], 'real example: Desk runs next tomorrow 07:13, Review on Monday 07:37');
eq(real.crew[0], { id: 'desk', name: 'Desk', look: 'headset', hue: 'teal', state: 'needs', waiting: 113, step: '', bubble: '113 for you', fresh: 1795522558000 }, 'real example: Desk\'s crew entry is the contract\'s own example');
eq(real.crew.map((a) => [a.id, a.name, a.look, a.hue]), C.ROSTER.map((a) => [a.id, a.name, a.look, a.hue]), 'the crew is in desk order with the roster\'s names, looks and hues');
eq(real.tips, {
  desk: { state: '113 waiting on you', last: 'Last result 13:15', next: 'Next run 07:13 tomorrow' },
  decide: { state: '17 waiting on you: 10 decisions, 7 for Leo', last: 'Last result 07:44', next: 'Next run 07:43 tomorrow' },
  instinct: { state: '3 waiting on you', last: 'Last result 08:30', next: 'Next run 08:07 tomorrow' },
  muse: { state: '2 waiting on you', last: 'Last result 08:30', next: 'Next run 08:07 tomorrow' },
  review: { state: 'Nothing waiting on you', last: 'Last result yesterday 07:46', next: 'Next run Mon 07:37' },
}, 'real example: the tooltips (a tooltip has room for "yesterday", a chip has not)');
eq(real.aria, 'Desk: 113 waiting on you. Decide: 17 waiting on you. Instinct: 3 waiting on you. Muse: 2 waiting on you. Review: nothing waiting.', 'real example: the sentence read out for the picture');
eq(real.crew.map((a) => [a.bubble, a.step, a.fresh]), [['113 for you', '', T(REAL.desk.at)], ['17 for you', '', T(REAL.decide.at)], ['3 for you', '', T(REAL.instinct.at)], ['2 for you', '', T(REAL.muse.at)], ['', '', T(REAL.review.at)]], 'real example: bubbles say the count, nobody has a step, fresh is the time of each result');
// in a page it is a plain script: a window, and no module, require or process. The dashboard runs it again in the
// same window when a file changes, so a second run must be as good as the first
const page = { window: {} };
let inPage = null;
try { vm.runInNewContext(TEXT, page, { filename: FILE }); vm.runInContext(TEXT, page, { filename: FILE }); inPage = page.window.OSCrew.derive(REAL, NOW); } catch (e) { inPage = String(e && e.message); }
eq(inPage, real, 'run twice as a plain script in a page, it is window.OSCrew and gives the same answer');
ok(!('OSCrew' in page), 'and it is put on the window it is given, nowhere else');
// the same facts before Desk's afternoon result came in
const EARLY = { ...REAL, desk: { ...REAL.desk, at: '2026-11-24T06:15:10Z' } };
const due = C.derive(EARLY, T('2026-11-24T12:20:00Z')), late = C.derive(EARLY, T('2026-11-24T13:05:00Z'));
eq([due.crew[0].state, due.lines.desk, due.crew[0].bubble], ['due', 'due 13:13', 'Run due 13:13'], 'at 13:20 with only the morning\'s result, Desk is due');
eq(due.tips.desk, { state: 'A run was due at 13:13. No result yet', last: 'Last result 07:15', next: 'Next run 07:13 tomorrow' }, 'and its tooltip says so');
eq([late.crew[0].state, late.lines.desk, late.crew[0].bubble, late.tips.desk.state], ['late', 'missed 13:13', 'Missed 13:13', 'Missed the 13:13 run'], 'at 14:05 it is late');
ok(due.total === 22 && late.total === 22 && due.crew[0].waiting === 113, 'what waits at an agent that is not at your desk is not in the total', [due.total, late.total]);

// ---------- the rules, in order ----------
// one agent on its own: its crew entry, plus its line, its tooltip and the total
const see = (id, fact, now, pulse, names) => {
  const r = C.derive({ [id]: fact, pulse: pulse ? { [id]: pulse } : null }, now, names);
  return { ...r.crew[IDS.indexOf(id)], line: r.lines[id], tip: r.tips[id], total: r.total, aria: r.aria };
};
const FRESH = REAL.desk, STALE = EARLY.desk;       // with, and without, a result for the 13:13 run
const DUE = T('2026-11-24T12:20:00Z');             // 13:20: seven minutes after that run
const beat = (state, startedMs, more) => ({ state, startedAt: iso(startedMs), finishedAt: null, step: 'Reading Slack', ...more });

// 1. the source
for (const [src, line, tip, say] of [['loading', '', 'No data yet', 'no data yet'], ['nodb', 'no data', 'Can\'t read the database here', 'no data'], ['error', 'no data', 'Can\'t read the database here', 'no data'], ['missing', 'not run yet', 'Has not run yet', 'has not run yet']]) {
  const a = see('desk', { ...FRESH, src }, NOW);
  ok(a.state === 'unknown' && a.line === line && a.tip.state === tip && a.tip.last === '' && a.tip.next === 'Next run 07:13 tomorrow' && a.bubble === '' && a.total === 0 && a.aria.startsWith('Desk: ' + say + '. '),
    `source ${src}: not in the room, line "${line}", tooltip "${tip}", read out as "${say}"`, a);
  ok(a.waiting === 113 && a.fresh === T(FRESH.at), `source ${src}: the count and the result's time are handed on as they came`, [a.waiting, a.fresh]);
}
// 2. a heartbeat
const working = see('desk', FRESH, NOW, beat('running', NOW - 2 * MIN));
eq([working.state, working.line, working.step, working.bubble, working.tip.state], ['working', 'working · Reading Slack', 'Reading Slack', 'Reading Slack', 'Working now: Reading Slack'], 'a running heartbeat two minutes old: working, with its step');
const quiet = see('desk', FRESH, NOW, beat('running', NOW - 2 * MIN, { step: '' }));
eq([quiet.state, quiet.line, quiet.step, quiet.bubble, quiet.tip.state], ['working', 'working', '', '', 'Working now'], 'a running heartbeat without a step: just working');
eq([0, 45 * MIN, 45 * MIN + 1, -1, -5 * MIN].map((ago) => see('desk', FRESH, NOW, beat('running', NOW - ago)).state), ['working', 'working', 'needs', 'needs', 'needs'], 'a heartbeat counts when it started 0 to 45 minutes ago: not a millisecond more, and not from the future');
each(['ok', 'done', 'RUNNING', ''], (s) => { const a = see('desk', FRESH, NOW, beat(s, NOW - 2 * MIN)); return [a.state, a.step]; }, ['needs', ''], 'a heartbeat that is not running is not work, and its step is not shown');
// 3. a scheduled run with no result
eq([see('desk', STALE, T('2026-11-24T12:12:59.999Z')).state, see('desk', STALE, T('2026-11-24T12:13:00Z')).state], ['needs', 'due'], 'Desk is due from the minute of its run, not a millisecond before');
eq([see('desk', STALE, T('2026-11-24T12:58:00Z')).state, see('desk', STALE, T('2026-11-24T12:58:00Z') + 1).state], ['due', 'late'], 'Desk is due for its 45 minutes of grace, then late');
const D = { src: 'ok', at: '2026-11-23T06:44:00Z', waiting: 4 }; // Decide's result from Monday
eq([see('decide', D, T('2026-11-24T07:13:00Z')).state, see('decide', D, T('2026-11-24T07:13:00Z') + 1).state], ['due', 'late'], 'Decide has 30 minutes of grace');
eq([see('desk', { ...FRESH, at: '2026-11-24T11:53:00.000Z' }, NOW).state, see('desk', { ...FRESH, at: '2026-11-24T11:52:59.999Z' }, NOW).state], ['needs', 'late'], 'a result stamped up to 20 minutes before the run is that run\'s result; a millisecond more and it is not');
eq([see('desk', { ...FRESH, at: null }, DUE).state, see('desk', { ...FRESH, at: null }, NOW).state, see('desk', { src: 'ok' }, NOW).state], ['due', 'late', 'late'], 'no result time at all: due, then late');
ok(see('desk', { ...FRESH, at: iso(NOW + 5 * MIN) }, NOW).state === 'needs', 'a result stamped a little ahead of this clock still counts');
// 4. a failure
const failed = see('desk', { ...FRESH, status: 'failed' }, NOW);
eq([failed.state, failed.line, failed.bubble, failed.tip.state, failed.total], ['error', 'failed 13:15', 'Run failed', 'The last run failed', 0], 'a result that says failed: error, with the time of that result');
ok(see('desk', { ...FRESH, status: 'partial' }, NOW).state === 'needs' && see('desk', { ...FRESH, status: '' }, NOW).state === 'needs', 'partial, or no status, is not a failure');
const crashed = see('desk', FRESH, NOW, beat('error', T('2026-11-24T12:13:05Z'), { finishedAt: '2026-11-24T12:16:40Z' }));
eq([crashed.state, crashed.line, crashed.tip.last], ['error', 'failed 13:16', 'Last result 13:15'], 'a heartbeat that ended in an error after the last result: error, with the time it ended');
eq(see('desk', FRESH, NOW, beat('error', T('2026-11-24T12:13:05Z'))).line, 'failed 13:13', 'an error heartbeat with no end is timed by its start');
eq([see('desk', FRESH, NOW, beat('error', T('2026-11-24T11:55:58.000Z'))).state, see('desk', FRESH, NOW, beat('error', T('2026-11-24T11:55:57.999Z'))).state], ['error', 'needs'], 'an error heartbeat counts when it is no more than 20 minutes older than the last result');
ok(see('desk', FRESH, NOW, { state: 'error' }).state === 'needs' && see('desk', FRESH, NOW, { state: 'error', startedAt: 'earlier', finishedAt: 7 }).state === 'needs', 'an error heartbeat with no readable time is not believed');
// 5 and 6. waiting on you, or not
const needs = see('desk', FRESH, NOW), idle = see('desk', { ...FRESH, waiting: 0 }, NOW);
eq([needs.state, needs.line, needs.bubble, needs.tip.state, needs.total], ['needs', '13:15 · 113 for you', '113 for you', '113 waiting on you', 113], 'something waiting: needs you');
eq([idle.state, idle.line, idle.bubble, idle.tip.state, idle.total], ['idle', '13:15 · all clear', '', 'Nothing waiting on you', 0], 'nothing waiting: idle, with the roster\'s word');
eq(see('review', { src: 'ok', at: '2026-11-23T06:46:19Z', waiting: 0 }, NOW).line, 'Mon 07:46 · posted', 'Review\'s idle word is "posted"');

// ---------- when two rules could both apply, the earlier one wins ----------
const RUN = beat('running', DUE - 2 * MIN);
each(['loading', 'nodb', 'error', 'missing'], (src) => see('desk', { ...STALE, src, status: 'failed' }, DUE, RUN).state, 'unknown', 'an unread source beats a heartbeat, a run that is due, a failure and things waiting');
eq([see('desk', STALE, DUE, RUN).state, see('desk', STALE, NOW, beat('running', NOW - 2 * MIN)).state], ['working', 'working'], 'a heartbeat while a run is due, or late: working');
eq([see('desk', STALE, DUE, beat('running', DUE - 46 * MIN)).state, see('desk', STALE, NOW, beat('running', NOW - 46 * MIN)).state], ['due', 'late'], 'a heartbeat that has gone stale while a run is due, or late: due, late');
ok(see('desk', { ...FRESH, status: 'failed' }, NOW, beat('running', NOW - 2 * MIN)).state === 'working', 'a heartbeat after a failed result: working');
ok(see('desk', FRESH, NOW, beat('running', NOW - 2 * MIN)).state === 'working' && see('desk', FRESH, NOW, beat('running', NOW - 2 * MIN)).total === 0, 'a heartbeat with things waiting: working, and they are not in the total');
eq([see('desk', { ...STALE, status: 'failed' }, DUE).state, see('desk', { ...STALE, status: 'failed' }, NOW).state], ['due', 'late'], 'a failed result from the run before, with a missed run since: due, then late (not error)');
eq([see('desk', STALE, DUE, beat('error', DUE - 5 * MIN)).state, see('desk', STALE, NOW, beat('error', DUE - 5 * MIN)).state], ['due', 'late'], 'an error heartbeat for a run that left no result: due, then late');
const dueBusy = see('desk', STALE, DUE);
eq([dueBusy.state, dueBusy.waiting, dueBusy.total, dueBusy.line], ['due', 113, 0, 'due 13:13'], 'things waiting while a run is due: due, the count kept but not in the total');
eq([see('desk', { ...FRESH, status: 'failed' }, NOW).state, see('desk', FRESH, NOW, beat('error', NOW - MIN)).state], ['error', 'error'], 'a failure with things waiting: error');
ok(see('desk', FRESH, NOW, beat('error', T('2026-11-24T06:16:00Z'))).state === 'needs', 'an error heartbeat from before the last result is history: needs');

// ---------- a Tuesday at Desk, and a Monday at Review ----------
const MON = { src: 'ok', at: '2026-11-23T12:15:00Z', status: 'ok', waiting: 40 }, AM = { src: 'ok', at: '2026-11-24T06:15:10Z', status: 'ok', waiting: 113 };
eq([
  see('desk', MON, T('2026-11-24T05:00:00Z')), see('desk', MON, T('2026-11-24T06:13:00Z')), see('desk', MON, T('2026-11-24T06:14:00Z'), beat('running', T('2026-11-24T06:13:20Z'))),
  see('desk', AM, T('2026-11-24T06:16:00Z'), beat('ok', T('2026-11-24T06:13:20Z'), { finishedAt: '2026-11-24T06:15:30Z' })), see('desk', AM, T('2026-11-24T12:12:00Z')),
  see('desk', AM, T('2026-11-24T12:13:00Z')), see('desk', AM, T('2026-11-24T12:59:00Z')), see('desk', FRESH, NOW),
].map((a) => a.line), ['Mon 13:15 · 40 for you', 'due 07:13', 'working · Reading Slack', '07:15 · 113 for you', '07:15 · 113 for you', 'due 13:13', 'missed 13:13', '13:15 · 113 for you'],
'Desk through a Tuesday: yesterday\'s count, due, working, the morning\'s count, due again, late, the afternoon\'s count');
const LAST_WEEK = { src: 'ok', at: '2026-11-16T06:46:19Z', waiting: 0 }, THIS_WEEK = { src: 'ok', at: '2026-11-23T06:46:19Z', waiting: 0 };
const before = see('review', LAST_WEEK, T('2026-11-23T06:36:00Z')), after = see('review', THIS_WEEK, T('2026-11-23T06:47:00Z'));
eq([before.state, before.line, before.tip.last, before.tip.next], ['idle', '16 Nov · posted', 'Last result 16 Nov', 'Next run 07:37'], 'Review on Monday 07:36: last week\'s post, by its date, and a run today');
eq([see('review', LAST_WEEK, T('2026-11-23T06:37:00Z')).line, see('review', LAST_WEEK, T('2026-11-23T07:22:00Z')).line, see('review', LAST_WEEK, T('2026-11-23T07:22:00Z') + 1).line], ['due 07:37', 'due 07:37', 'missed 07:37'], 'Review on Monday from 07:37: due for 45 minutes, then late');
eq([after.state, after.line, after.tip.last, after.tip.next], ['idle', '07:46 · posted', 'Last result 07:46', 'Next run 30 Nov'], 'Review on Monday once it has posted: idle, next run a week away, by its date');
eq([see('review', LAST_WEEK, T('2026-11-27T19:00:00Z')).line, see('review', LAST_WEEK, T('2026-11-29T10:00:00Z')).line, see('review', LAST_WEEK, T('2026-11-30T06:30:00Z')).line], ['missed Mon 07:37', 'missed Mon 07:37', 'missed 23 Nov'], 'a missed Monday run stays missed all week, named by its day');
// evenings, weekends and midnight, in words
const FRI = { src: 'ok', at: '2026-11-27T12:15:00Z', status: 'ok', waiting: 9 };
const fri = see('desk', FRI, T('2026-11-27T19:00:00Z')), sat = see('desk', FRI, T('2026-11-28T10:00:00Z')), sun = see('desk', FRI, T('2026-11-29T10:00:00Z'));
eq([fri.line, fri.tip.last, fri.tip.next], ['13:15 · 9 for you', 'Last result 13:15', 'Next run Mon 07:13'], 'Friday evening: today\'s result, next run on Monday');
eq([sat.line, sat.tip.last, sat.tip.next], ['Fri 13:15 · 9 for you', 'Last result yesterday 13:15', 'Next run Mon 07:13'], 'Saturday: Friday\'s result still stands (nothing is due at a weekend)');
eq([sun.line, sun.tip.last, sun.tip.next], ['Fri 13:15 · 9 for you', 'Last result Fri 13:15', 'Next run 07:13 tomorrow'], 'Sunday: the same, and the next run is tomorrow');
eq([see('desk', { ...FRI, at: '2026-11-27T06:15:00Z' }, T('2026-11-28T10:00:00Z')).line, see('desk', { ...FRI, at: '2026-11-27T06:15:00Z' }, T('2026-11-29T10:00:00Z')).tip.state], ['missed Fri 13:13', 'Missed the Fri 13:13 run'], 'a Friday afternoon run that never came is still missed at the weekend');
const eve = see('desk', FRESH, T('2026-11-24T23:00:00Z') - 1), midnight = see('desk', FRESH, T('2026-11-24T23:00:00Z'));
eq([eve.state, eve.line, eve.tip.last, eve.tip.next], ['needs', '13:15 · 113 for you', 'Last result 13:15', 'Next run 07:13 tomorrow'], 'a millisecond before midnight: today\'s result, a run tomorrow');
eq([midnight.state, midnight.line, midnight.tip.last, midnight.tip.next], ['needs', 'Tue 13:15 · 113 for you', 'Last result yesterday 13:15', 'Next run 07:13'], 'at midnight: yesterday\'s result, a run today');
// the Mondays after the clocks change: a fixed offset would be an hour out here
const OCT = { src: 'ok', at: '2026-10-23T11:15:00Z', waiting: 1 }, MAR = { src: 'ok', at: '2027-03-26T12:15:00Z', waiting: 1 };
eq([see('desk', OCT, T('2026-10-26T06:12:00Z')).state, see('desk', OCT, T('2026-10-26T06:20:00Z')).line, see('desk', OCT, T('2026-10-26T06:59:00Z')).line], ['needs', 'due 07:13', 'missed 07:13'], 'Monday after the clocks went back: due from 07:13 Stockholm time (06:13 UTC), not an hour early');
eq([see('desk', MAR, T('2027-03-29T05:12:00Z')).state, see('desk', MAR, T('2027-03-29T05:20:00Z')).line, see('desk', MAR, T('2027-03-29T05:59:00Z')).line], ['needs', 'due 07:13', 'missed 07:13'], 'Monday after the clocks went forward: due from 07:13 Stockholm time (05:13 UTC), not an hour late');

// ---------- the words in every state ----------
const MIXED = {
  desk: AM, decide: D, instinct: { src: 'ok', at: '2026-11-23T07:30:00Z', waiting: 3 }, muse: { src: 'ok', at: '2026-11-24T07:09:00Z', status: 'failed', waiting: 2 }, review: { src: 'missing', at: null, waiting: 0 },
  pulse: { desk: beat('running', T('2026-11-24T07:18:00Z'), { step: 'Asking Salesforce' }) },
};
const mixed = C.derive(MIXED, T('2026-11-24T07:20:00Z'), { desk: '  Front  desk ', decide: 'A very long name indeed', muse: 42, review: '' });
eq(mixed.crew.map((a) => a.state), ['working', 'late', 'due', 'error', 'unknown'], 'a morning with one of each: working, late, due, error, unknown');
eq(mixed.lines, { desk: 'working · Asking Salesforce', decide: 'missed 07:43', instinct: 'due 08:07', muse: 'failed 08:09', review: 'not run yet' }, 'their chip lines');
eq(mixed.crew.map((a) => a.bubble), ['Asking Salesforce', 'Missed 07:43', 'Run due 08:07', 'Run failed', ''], 'their bubbles');
eq(IDS.map((id) => mixed.tips[id].state), ['Working now: Asking Salesforce', 'Missed the 07:43 run', 'A run was due at 08:07. No result yet', 'The last run failed', 'Has not run yet'], 'their tooltip sentences');
eq(IDS.map((id) => mixed.tips[id].last), ['Last result 07:15', 'Last result yesterday 07:44', 'Last result yesterday 08:30', 'Last result 08:09', ''], 'their last results');
eq(IDS.map((id) => mixed.tips[id].next), ['Next run 13:13', 'Next run 07:43 tomorrow', 'Next run 08:07 tomorrow', 'Next run 08:07 tomorrow', 'Next run Mon 07:37'], 'their next runs');
eq(mixed.crew.map((a) => a.name), ['Front desk', 'A very long', 'Instinct', 'Muse', 'Review'], 'a name from the page wins: one line, trimmed, cut at 12; anything else falls back to the roster\'s');
eq(mixed.aria, 'Front desk: working now. A very long: missed the 07:43 run. Instinct: a run was due at 08:07. Muse: the last run failed. Review: has not run yet.', 'one sentence each for the picture, with the names shown');
ok(mixed.total === 0 && mixed.crew[0].step === 'Asking Salesforce' && mixed.crew.slice(1).every((a) => a.step === ''), 'only the working agent has a step; nobody is at your desk, so the total is 0');
eq(C.derive({}, NOW).aria, 'Desk: no data yet. Decide: no data yet. Instinct: no data yet. Muse: no data yet. Review: no data yet.', 'nothing known yet: said so for each');
ok([...Object.values(real.lines), ...Object.values(mixed.lines), due.lines.desk, late.lines.desk].every((l) => !l.includes('.')), 'no full stops in chip lines');
// the breakdown in the tooltip
const P = (parts) => see('decide', { src: 'ok', at: '2026-11-24T06:44:12Z', waiting: 17, parts }, NOW).tip.state;
eq(P([{ n: 10, word: 'decisions' }, { n: 7, word: 'for Leo' }]), '17 waiting on you: 10 decisions, 7 for Leo', 'parts are listed after the count');
eq(P([{ n: 17, word: 'decisions' }, { n: 0, word: 'for Leo' }]), '17 waiting on you: 17 decisions', 'a part with nothing in it is left out');
each([undefined, null, 'x', 7, {}, [], [null], [3], ['x'], [{}], [{ n: 3 }], [{ word: 'decisions' }], [{ n: '3', word: 'decisions' }], [{ n: -1, word: 'x' }], [{ n: 2, word: 9 }]], P, '17 waiting on you', 'no parts, or parts that are not parts: just the count');
eq(P([{ n: 2.9, word: '  for\n Leo ' }, { n: 1e9, word: 'x'.repeat(99) }, { n: 1, word: 'c' }, { n: 1, word: 'd' }, { n: 1, word: 'e' }]), '17 waiting on you: 2 for Leo, 9999 ' + 'x'.repeat(16) + ', 1 c, 1 d', 'parts are cleaned like everything else: whole numbers, short one-line words, four at most');

// ---------- garbage in: nothing thrown, nothing leaked ----------
const STATES = ['working', 'due', 'late', 'error', 'needs', 'idle', 'unknown'];
const LEAK = /NaN|undefined|null|Invalid|\[object|Infinity|function|=>|\de\+\d|-\d|[\u0000-\u001f\u007f]/;
const text = (v, max) => typeof v === 'string' && v.length <= max && !LEAK.test(v);
// everything the contract promises about a result, whatever went in; returns what is wrong with it
const flaws = (r) => {
  const bad = [], no = (c, what) => { if (!c) bad.push(what); };
  if (!r || typeof r !== 'object') return ['no result'];
  no(Object.keys(r).sort().join() === 'aria,crew,lines,tips,total', 'result fields');
  no(Array.isArray(r.crew) && r.crew.length === C.ROSTER.length, 'crew size');
  (Array.isArray(r.crew) ? r.crew : []).forEach((a, i) => {
    const want = C.ROSTER[i];
    if (!a || typeof a !== 'object') { bad.push('crew entry ' + i); return; }
    no(Object.keys(a).sort().join() === 'bubble,fresh,hue,id,look,name,state,step,waiting', want.id + ' fields');
    no(a.id === want.id && a.look === want.look && a.hue === want.hue, want.id + ' id, look, hue');
    no(text(a.name, 12) && a.name.length > 0 && a.name === a.name.trim(), want.id + ' name');
    no(STATES.includes(a.state), want.id + ' state');
    no(Number.isInteger(a.waiting) && a.waiting >= 0 && a.waiting <= 9999, want.id + ' waiting');
    no(text(a.step, 24) && (a.state === 'working' || a.step === ''), want.id + ' step');
    no(text(a.bubble, 24), want.id + ' bubble');
    no(Number.isInteger(a.fresh) && a.fresh >= 0, want.id + ' fresh');
  });
  IDS.forEach((id) => {
    const t = (r.tips && r.tips[id]) || {};
    no(text(r.lines && r.lines[id], 40), id + ' line');
    no(Object.keys(t).join() === 'state,last,next' && text(t.state, 120) && t.state.length > 0 && text(t.last, 40) && text(t.next, 40), id + ' tooltip');
  });
  no(r.lines && r.tips && Object.keys(r.lines).join() === IDS.join() && Object.keys(r.tips).join() === IDS.join(), 'lines and tips ids');
  no(text(r.aria, 400) && r.aria.split('. ').length === IDS.length && r.aria.endsWith('.'), 'aria');
  no(Number.isInteger(r.total) && Array.isArray(r.crew) && r.total === r.crew.filter((a) => a && a.state === 'needs').reduce((s, a) => s + a.waiting, 0), 'total');
  return bad;
};
eq([flaws(real), flaws(due), flaws(late), flaws(mixed), flaws(C.derive())], [[], [], [], [], []], 'the checker itself passes the results above');
const spoilt = JSON.parse(JSON.stringify(real));
Object.assign(spoilt, { total: 134.5 }); spoilt.crew[1].extra = 1; spoilt.crew[2].waiting = '3'; spoilt.lines.desk = 'NaN:NaN · 113 for you'; spoilt.tips.muse.next = 7;
eq(flaws(spoilt), ['decide fields', 'instinct waiting', 'desk line', 'muse tooltip', 'total'], 'and it does see an extra field, a count that is text, a stray word, a sentence that is not text and a broken total');
const JUNK = [undefined, null, NaN, Infinity, -Infinity, -1, -0.5, 0, 0.5, 1, 2.9, 1e21, 2 ** 53, '', ' ', 'x', '17', 'ok', 'running', 'x'.repeat(5000), 'a\nb\tc\u0000d', '<b>x</b>', 'constructor', '__proto__', 'toString',
  true, false, [], {}, [1, 2], ['ok'], { n: 1 }, { desk: 1 }, () => 1, Symbol('s'), 10n, new Date(NaN), new Date(0), Object.create(null)];
const show = (v) => (typeof v === 'string' ? JSON.stringify(v.slice(0, 24)) : typeof v === 'object' && v ? Object.prototype.toString.call(v) + JSON.stringify(v) : typeof v === 'symbol' ? 'symbol' : String(v));
const LIVE = beat('running', NOW - 2 * MIN);
// each place a value can come in from, filled with each piece of junk in turn
const SLOTS = {
  'facts': (v) => [v, NOW],
  'facts, with no clock or names either': (v) => [v, v, v],
  'an agent\'s entry': (v) => [{ ...REAL, desk: v, review: v }, NOW],
  'src': (v) => [{ ...REAL, desk: { ...REAL.desk, src: v } }, NOW],
  'at': (v) => [{ ...REAL, desk: { ...REAL.desk, at: v } }, NOW],
  'status': (v) => [{ ...REAL, desk: { ...REAL.desk, status: v } }, NOW],
  'waiting': (v) => [{ ...REAL, desk: { ...REAL.desk, waiting: v }, decide: { ...REAL.decide, waiting: v } }, NOW],
  'parts': (v) => [{ ...REAL, decide: { ...REAL.decide, parts: v } }, NOW],
  'a part': (v) => [{ ...REAL, decide: { ...REAL.decide, parts: [v, { n: v, word: 'decisions' }, { n: 7, word: v }] } }, NOW],
  'pulse': (v) => [{ ...REAL, pulse: v }, NOW],
  'a heartbeat': (v) => [{ ...REAL, pulse: { desk: v, muse: v } }, NOW],
  'a heartbeat\'s state': (v) => [{ ...REAL, pulse: { desk: { ...LIVE, state: v } } }, NOW],
  'a heartbeat\'s start': (v) => [{ ...REAL, pulse: { desk: { ...LIVE, startedAt: v }, muse: { ...LIVE, state: 'error', startedAt: v } } }, NOW],
  'a heartbeat\'s end': (v) => [{ ...REAL, pulse: { desk: { ...LIVE, finishedAt: v }, muse: { ...LIVE, state: 'error', finishedAt: v } } }, NOW],
  'a step': (v) => [{ ...REAL, pulse: { desk: { ...LIVE, step: v } } }, NOW],
  'the clock': (v) => [REAL, v],
  'names': (v) => [REAL, NOW, v],
  'a name': (v) => [REAL, NOW, { desk: v, review: v }],
};
for (const [slot, build] of Object.entries(SLOTS)) {
  const wrong = [];
  for (const v of JUNK) {
    let found;
    try { found = flaws(C.derive(...build(v))); } catch (e) { found = ['threw ' + String(e && e.message)]; }
    if (found.length && wrong.length < 3) wrong.push([show(v), found]);
  }
  ok(!wrong.length, `junk for ${slot}: nothing thrown, every field in place, no stray word`, wrong);
}
ok([[null, NaN], [REAL, 8.64e15], [REAL, -8.64e15], [REAL, 0], [REAL, 1e300], [EARLY, '2026-11-24T12:20:00Z']].every((a) => flaws(C.derive(...a)).length === 0), 'clocks at the ends of time, or written as text, do no harm');
// what the junk turns into
each([undefined, null, 42, 'x', [], () => 1], (v) => { const r = C.derive(v, NOW); return [r.crew.map((a) => a.state).join(), Object.values(r.lines).join(''), r.tips.desk.state, r.total]; },
  ['unknown,unknown,unknown,unknown,unknown', '', 'No data yet', 0], 'facts that are not facts: nobody in the room, nothing said');
each([undefined, null, 42, 'ok', []], (v) => { const r = C.derive({ ...REAL, desk: v }, NOW); return [r.crew[0].state, r.lines.desk, r.crew[1].state, r.total]; },
  ['unknown', '', 'needs', 22], 'one missing entry: that agent is unknown, the others are untouched');
each([undefined, null, 42, 'OK', 'ready', 'constructor', '__proto__', ['ok']], (v) => { const a = see('desk', { ...FRESH, src: v }, NOW); return [a.state, a.line, a.tip.state]; },
  ['unknown', '', 'No data yet'], 'a source it does not know is read as still loading');
each([undefined, null, '', 'yesterday', 'run 1', '2026-11-24', '2026-11-24 12:15:58Z', '2026-13-45T25:61:00Z', 1795522558000, {}, new Date(NOW)],
  (v) => { const a = see('desk', { ...FRESH, at: v }, NOW); return [a.state, a.line, a.tip.last, a.fresh]; }, ['late', 'missed 13:13', '', 0],
  'an `at` that is not an ISO time (a date alone, a space for the T, a number, loose text) is no result: the run counts as missed, fresh is 0');
each(['2026-11-24T12:15:58Z', '2026-11-24T12:15:58.250Z', '2026-11-24T13:15:58+01:00', '2026-11-24T12:15Z'], (v) => see('desk', { ...FRESH, at: v }, NOW).line,
  '13:15 · 113 for you', 'ISO times are read with or without milliseconds, seconds or an offset');
each([-5, -0.5, 0, 0.5, NaN, Infinity, -Infinity, '17', '', null, undefined, [3], true, {}], (v) => { const a = see('desk', { ...FRESH, waiting: v }, NOW); return [a.state, a.waiting, a.total]; },
  ['idle', 0, 0], 'a count that is negative, below one, not finite or not a number is nothing waiting');
eq([1, 2.9, 99.999, 9999, 10000, 1e21, Number.MAX_VALUE].map((v) => see('desk', { ...FRESH, waiting: v }, NOW)).map((a) => [a.state, a.waiting, a.total, a.bubble]),
  [1, 2, 99, 9999, 9999, 9999, 9999].map((n) => ['needs', n, n, n + ' for you']), 'a count is a whole number, capped at 9999');
ok(C.derive({ ...REAL, desk: { ...REAL.desk, waiting: 1e21 }, decide: { ...REAL.decide, waiting: 2.5 } }, NOW).total === 9999 + 2 + 3 + 2, 'the total stays a whole number');
const stepOf = (v) => { const a = see('desk', FRESH, NOW, { ...LIVE, step: v }); return [a.step, a.line, a.bubble]; };
eq([stepOf('Reading every Slack channel there is, twice over'), stepOf('  Reading\n\tSlack  ')],
  [['Reading every Slack chan', 'working · Reading every Slack chan', 'Reading every Slack chan'], ['Reading Slack', 'working · Reading Slack', 'Reading Slack']], 'a step is put on one line and cut at 24 characters');
each([42, null, {}, ['Reading Slack'], '', ' \n '], stepOf, ['', 'working', ''], 'a step that is empty or not text is no step');
const nameOf = (v) => see('desk', FRESH, NOW, null, { desk: v }).name;
eq(['Scout', 'x'.repeat(40), '  Night   desk  ', 'Ålder 🤖🤖🤖🤖🤖🤖🤖🤖'].map(nameOf), ['Scout', 'x'.repeat(12), 'Night desk', 'Ålder 🤖🤖🤖🤖🤖🤖'], 'a name is put on one line and cut at 12 characters (whole characters, not halves)');
each(['', '   ', 7, null, {}, ['Desk']], nameOf, 'Desk', 'a name that is empty or not text is the roster\'s');
each(['running', 42, [], [LIVE], { desk: 'running' }, { desk: null }, { desk: [LIVE] }, { desk: { state: 'running' } }, { desk: { state: 'running', startedAt: NOW } }, { desk: { state: ['running'], startedAt: iso(NOW) } }, { other: LIVE }],
  (v) => C.derive({ ...REAL, pulse: v }, NOW).crew[0].state, 'needs', 'a pulse of the wrong shape is no heartbeat');
// derive keeps nothing and changes nothing
const frozen = JSON.stringify(MIXED), roster = JSON.stringify(C.ROSTER);
const first = JSON.stringify(C.derive(MIXED, T('2026-11-24T07:20:00Z')));
ok(first === JSON.stringify(C.derive(MIXED, T('2026-11-24T07:20:00Z'))) && JSON.stringify(MIXED) === frozen && JSON.stringify(C.ROSTER) === roster, 'the same facts and clock give the same answer, and neither the facts nor the roster are changed');

// ---------- browsers that are not this one ----------
// a fresh copy of the model, loaded and used while Intl.DateTimeFormat is replaced by a stand-in
const RealFormat = Intl.DateTimeFormat;
const withIntl = (standIn, use) => {
  Intl.DateTimeFormat = standIn;
  delete require.cache[require.resolve(FILE)];
  try { return use(require(FILE)); } catch (e) { return 'threw ' + String(e && e.message); } finally { Intl.DateTimeFormat = RealFormat; globalThis.OSCrew = C; }
};
// one that knows no time zones: there is no schedule, so nothing is due or late, and everything else still works
const blind = withIntl(function () { throw new RangeError('Invalid time zone specified: Europe/Stockholm'); }, (M) => ({
  runs: M.runsAround(M.ROSTER[0], NOW),
  early: M.derive(EARLY, T('2026-11-24T13:05:00Z')),
  bare: M.derive({ desk: { src: 'ok', at: null, status: 'failed', waiting: 3 }, decide: { src: 'ok', at: null, waiting: 3 }, instinct: { src: 'ok', at: null, waiting: 0 } }, NOW),
}));
eq(blind.runs, { prev: null, next: null }, 'a browser with no time zones: no scheduled runs, and nothing thrown');
eq([flaws(blind.early), blind.early.crew.map((a) => a.state), blind.early.lines.desk, blind.early.tips.desk], [[], ['needs', 'needs', 'needs', 'needs', 'idle'], '07:15 · 113 for you', { state: '113 waiting on you', last: 'Last result 07:15', next: '' }], 'there, nobody is due or late and no next run is promised; the rest reads as usual');
eq([flaws(blind.bare), blind.bare.lines], [[], { desk: 'failed', decide: '3 for you', instinct: 'all clear', muse: '', review: '' }], 'with no time to show, a line is its words alone');
// one that writes midnight as 24:00 (some have, when asked for a 24-hour clock): the hour after midnight must not land on the next day
const NIGHTS = ['2026-11-23T23:00:00Z', '2026-11-23T23:30:00Z', '2026-11-22T23:59:00Z', '2026-06-30T22:15:00Z', '2026-11-24T13:08:00Z'].map(T);
const twentyFour = function (locale, options) { const f = new RealFormat(locale, options); return { formatToParts: (d) => f.formatToParts(d).map((x) => (x.type === 'hour' && +x.value === 0 ? { type: 'hour', value: '24' } : x)) }; };
eq(withIntl(twentyFour, (M) => NIGHTS.map((t) => M.ROSTER.map((a) => M.runsAround(a, t)))), NIGHTS.map((t) => C.ROSTER.map((a) => C.runsAround(a, t))), 'a browser that calls midnight 24:00 finds the same runs, in the hour after midnight too');

// ---------- other viewers: the schedule stays in Stockholm, the words follow the viewer ----------
const MOMENTS = ['2026-11-24T13:08:00Z', '2026-11-24T03:00:00Z', '2026-07-01T12:00:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-10-27T12:20:00Z', '2027-03-28T00:30:00Z', '2027-03-29T06:00:00Z', '2026-11-22T23:00:00Z', '2026-11-29T22:59:59Z'];
const PROBE = `
  const C = require(${JSON.stringify(FILE)}), T = Date.parse, REAL = ${JSON.stringify(REAL)}, EARLY = ${JSON.stringify(EARLY)}, YESTERDAY = { desk: { src: 'ok', at: '2026-11-23T12:15:58Z', status: 'ok', waiting: 113 } };
  const brief = (r) => ({ states: r.crew.map((a) => a.state), lines: r.lines, bubble: r.crew[0].bubble, last: r.tips.desk.last, next: r.tips.desk.next, reviewLast: r.tips.review.last, reviewNext: r.tips.review.next, total: r.total, fresh: r.crew.map((a) => a.fresh) });
  process.stdout.write(JSON.stringify({
    clock: new Date(2026, 10, 24, 12, 0).toISOString(),
    runs: ${JSON.stringify(MOMENTS)}.map((m) => C.ROSTER.map((a) => C.runsAround(a, T(m)))),
    real: brief(C.derive(REAL, T('2026-11-24T13:08:00Z'))),
    due: brief(C.derive(EARLY, T('2026-11-24T12:20:00Z'))),
    late: brief(C.derive(EARLY, T('2026-11-24T13:05:00Z'))),
    night: brief(C.derive(YESTERDAY, T('2026-11-24T03:00:00Z'))),
    october: brief(C.derive({ desk: { src: 'ok', at: '2026-10-27T06:15:10Z', waiting: 1 } }, T('2026-10-27T12:20:00Z'))),
  }));`;
const viewer = (tz) => {
  try { return JSON.parse(execFileSync(process.execPath, ['-e', PROBE], { env: { ...process.env, TZ: tz }, encoding: 'utf8' })); } catch (e) { ok(false, `a child process in ${tz} ran the model`, String(e && e.message).slice(0, 400)); return done(); }
};
const here = viewer('Europe/Stockholm'), ny = viewer('America/New_York'), india = viewer('Asia/Kolkata');
eq([here.clock, ny.clock, india.clock], ['2026-11-24T11:00:00.000Z', '2026-11-24T17:00:00.000Z', '2026-11-24T06:30:00.000Z'], 'the child processes really are in Stockholm, New York and Kolkata');
eq(here.runs, MOMENTS.map((m) => C.ROSTER.map((a) => C.runsAround(a, T(m)))), 'a child process in Stockholm finds the same runs as this one');
eq(ny.runs, here.runs, 'New York: every scheduled run is at the same instant as seen from Stockholm (ten moments, both clock changes)');
eq(india.runs, here.runs, 'Kolkata: the same');
eq([ny.real.states, ny.real.total, ny.real.fresh, india.real.states, india.real.total], [here.real.states, 135, here.real.fresh, here.real.states, 135], 'real example elsewhere: the same states, total and times');
eq(ny.real.lines, { desk: '07:15 · 113 for you', decide: '01:44 · 17 for you', instinct: '02:30 · 3 for you', muse: '02:30 · 2 for you', review: 'Mon 01:46 · posted' }, 'New York: the chip lines are on New York\'s clock, six hours behind');
eq([ny.real.last, ny.real.next, ny.real.reviewLast, ny.real.reviewNext], ['Last result 07:15', 'Next run 01:13 tomorrow', 'Last result yesterday 01:46', 'Next run Mon 01:37'], 'New York: and so are the tooltips');
eq(india.real.lines, { desk: '17:45 · 113 for you', decide: '12:14 · 17 for you', instinct: '13:00 · 3 for you', muse: '13:00 · 2 for you', review: 'Mon 12:16 · posted' }, 'Kolkata: four and a half hours ahead');
eq([india.real.next, india.real.reviewNext], ['Next run 11:43 tomorrow', 'Next run Mon 12:07'], 'Kolkata: the next runs');
eq([here.due.states[0], here.due.lines.desk, ny.due.states[0], ny.due.lines.desk, ny.due.bubble, india.due.states[0], india.due.lines.desk], ['due', 'due 13:13', 'due', 'due 07:13', 'Run due 07:13', 'due', 'due 17:43'], 'Desk is due at the same moment for everyone; the 13:13 run reads 07:13 in New York and 17:43 in Kolkata');
eq([here.late.lines.desk, ny.late.lines.desk, india.late.lines.desk], ['missed 13:13', 'missed 07:13', 'missed 17:43'], 'and late at the same moment');
eq([here.night.lines.desk, here.night.last, here.night.next], ['Mon 13:15 · 113 for you', 'Last result yesterday 13:15', 'Next run 07:13'], 'Tuesday 04:00 in Stockholm: the result is yesterday\'s, the run is today');
eq([ny.night.lines.desk, ny.night.last, ny.night.next, ny.night.states[0]], ['07:15 · 113 for you', 'Last result 07:15', 'Next run 01:13 tomorrow', 'needs'], 'the same moment is still Monday in New York: the result is today\'s, the run tomorrow');
eq([here.october.lines.desk, ny.october.lines.desk, ny.october.states[0]], ['due 13:13', 'due 08:13', 'due'], 'the week Europe has changed its clocks and America has not: five hours apart, same run');

done();
