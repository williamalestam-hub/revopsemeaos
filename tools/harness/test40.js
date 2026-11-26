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
eq(Object.keys(C).sort(), ['ROOMS', 'ROSTER', 'TZ', 'derive', 'overdue', 'runsAround', 'when'], 'exports TZ, ROSTER, ROOMS, derive, runsAround, when and overdue');
ok(C.TZ === 'Europe/Stockholm', 'the schedule is kept in Europe/Stockholm', C.TZ);
eq(C.ROSTER, [
  { id: 'desk', name: 'Desk', look: 'headset', hue: 'teal', days: [1, 2, 3, 4, 5], at: ['07:13', '13:13'], graceMin: 45, idleWord: 'all clear' },
  { id: 'decide', name: 'Decide', look: 'gavel', hue: 'amber', days: [1, 2, 3, 4, 5], at: ['07:43'], graceMin: 30, idleWord: 'all clear' },
  { id: 'instinct', name: 'Instinct', look: 'antenna', hue: 'rose', days: [1, 2, 3, 4, 5], at: ['08:07'], also: ['10:07', '12:07', '14:07', '16:07'], graceMin: 60, idleWord: 'all clear' },
  { id: 'muse', name: 'Muse', look: 'bulb', hue: 'violet', days: [1, 2, 3, 4, 5], at: ['08:07'], graceMin: 60, idleWord: 'all clear' },
  { id: 'review', name: 'Review', look: 'clipboard', hue: 'blue', days: [1], at: ['07:37'], graceMin: 45, idleWord: 'posted' },
], 'the roster: five agents in desk order; Instinct also runs at 10:07, 12:07, 14:07 and 16:07; Instinct and Muse have an hour of grace');
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
eq(runs(muse, '2026-11-24T13:08:00Z'), ['2026-11-24T07:07Z', '2026-11-25T07:07Z'], 'winter, Tuesday 14:08: Muse ran at 08:07, next tomorrow');
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
// Instinct's other runs of the day (10:07, 12:07, 14:07, 16:07): each can be the next run, none is ever the latest one
eq(runs(instinct, '2026-11-24T13:08:00Z'), ['2026-11-24T07:07Z', '2026-11-24T15:07Z'], 'Tuesday 14:08: Instinct\'s latest run is 08:07 and its next 16:07');
eq([runs(instinct, '2026-11-24T07:20:00Z'), runs(instinct, T('2026-11-24T09:07:00Z') - 1), runs(instinct, '2026-11-24T09:07:00Z')],
  [['2026-11-24T07:07Z', '2026-11-24T09:07Z'], ['2026-11-24T07:07Z', '2026-11-24T09:07Z'], ['2026-11-24T07:07Z', '2026-11-24T11:07Z']], 'at 08:20 Instinct\'s next run is 10:07; at 10:07 itself it is 12:07, and the latest is still 08:07');
eq([runs(instinct, T('2026-11-24T15:07:00Z') - 1), runs(instinct, '2026-11-24T15:07:00Z'), runs(instinct, '2026-11-24T06:00:00Z')],
  [['2026-11-24T07:07Z', '2026-11-24T15:07Z'], ['2026-11-24T07:07Z', '2026-11-25T07:07Z'], ['2026-11-23T07:07Z', '2026-11-24T07:07Z']], 'from 16:07 the next run is tomorrow 08:07; before 08:07 the latest is yesterday 08:07, not yesterday 16:07');
eq([runs(instinct, '2026-11-27T16:00:00Z'), runs(instinct, '2026-11-28T10:00:00Z'), runs(instinct, '2026-07-01T07:00:00Z')],
  [['2026-11-27T07:07Z', '2026-11-30T07:07Z'], ['2026-11-27T07:07Z', '2026-11-30T07:07Z'], ['2026-07-01T06:07Z', '2026-07-01T08:07Z']], 'Friday 17:00 and Saturday: next on Monday 08:07; in summer the other runs are on Stockholm\'s clock too');
eq([runs({ days: [1, 2, 3, 4, 5], at: [], also: ['10:07'] }, '2026-11-24T08:00:00Z'), runs({ days: [1], at: ['07:37'], also: 'x' }, '2026-11-24T13:08:00Z'), runs({ days: [1], at: ['07:37'], also: [null, '25', 7] }, '2026-11-24T13:08:00Z')],
  [[null, '2026-11-24T09:07Z'], ['2026-11-23T06:37Z', '2026-11-30T06:37Z'], ['2026-11-23T06:37Z', '2026-11-30T06:37Z']], 'other runs alone give a next run and no latest one; other runs that are not times are passed over');
// two years, every 6 h 7 min: the runs either side of any moment are real scheduled times on Stockholm's clock, and the
// gap between them is one of the schedule's own, an hour longer or shorter only across a clock change
const stockholm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' });
const onClock = (ms) => { const p = Object.fromEntries(stockholm.formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1, hm: p.hour + ':' + p.minute }; };
const GAPS = { desk: [6, 18, 65, 66, 67], decide: [24, 71, 72, 73], instinct: [2, 4, 6, 8, 24, 71, 72, 73], muse: [24, 71, 72, 73], review: [167, 168, 169] };
for (const agent of C.ROSTER) {
  const seen = new Set(), wrong = [];
  const fits = (x, times) => Number.isInteger(x) && agent.days.includes(onClock(x).day) && times.includes(onClock(x).hm);
  for (let t = T('2026-01-01T00:00:00Z'); t < T('2028-01-01T00:00:00Z'); t += 367 * MIN) {
    const r = C.runsAround(agent, t);
    const good = fits(r.prev, agent.at) && fits(r.next, agent.at.concat(agent.also || [])) && r.prev <= t && t < r.next;
    if (!good && wrong.length < 3) wrong.push([iso(t), Z(r.prev), Z(r.next)]);
    seen.add((r.next - r.prev) / HOUR);
  }
  ok(!wrong.length, `${agent.id}: through 2026 and 2027 the latest run is one of its own times on one of its own days, and so is the next (its other runs included)`, wrong);
  eq([...seen].sort((a, b) => a - b), GAPS[agent.id], `${agent.id}: the hours from the latest run to the next are ${GAPS[agent.id].join(', ')} and nothing else`);
}

// ---------- the words for a time: the viewer's own clock ----------
const NOW = T('2026-11-24T13:08:00Z'); // Tuesday 14:08 here
eq([C.when(T('2026-11-24T12:15:58Z'), NOW), C.when(T('2026-11-24T23:00:00Z') - 1, NOW), C.when(T('2026-11-23T23:00:00Z'), NOW)], ['13:15', '23:59', '00:00'], 'today is the time alone, seconds dropped, from 00:00 to 23:59');
eq([C.when(T('2026-11-23T12:15:00Z'), NOW), C.when(T('2026-11-23T23:00:00Z') - 1, NOW)], ['yesterday 13:15', 'yesterday 23:59'], 'yesterday is "yesterday 13:15", up to the last millisecond before midnight');
eq(C.when(T('2026-11-25T06:13:00Z'), NOW), '07:13 tomorrow', 'tomorrow is "07:13 tomorrow"');
eq([C.when(T('2026-11-22T12:15:00Z'), NOW), C.when(T('2026-11-18T06:46:00Z'), NOW), C.when(T('2026-11-26T06:13:00Z'), NOW), C.when(T('2026-11-30T06:37:00Z'), NOW)], ['Sun 13:15', 'Wed 07:46', 'Thu 07:13', 'Mon 07:37'], 'two to six days away, either way, is the weekday and the time');
eq([C.when(T('2026-11-17T06:46:00Z'), NOW), C.when(T('2026-11-16T06:46:19Z'), NOW), C.when(T('2026-12-01T06:37:00Z'), NOW), C.when(T('2027-01-04T06:37:00Z'), NOW)], ['17 Nov 07:46', '16 Nov 07:46', '1 Dec 07:37', '4 Jan 07:37'], 'a week or more away is the date and the time (so a weekday never means today\'s own)');
eq([C.when(T('2026-11-23T06:46:19Z'), NOW, true), C.when(T('2026-11-25T06:13:00Z'), NOW, true), C.when(T('2026-11-24T12:15:58Z'), NOW, true), C.when(T('2026-11-16T06:46:19Z'), NOW, true)], ['Mon 07:46', 'Wed 07:13', '13:15', '16 Nov 07:46'], 'the short form (chips, bubbles, a time inside a sentence) names yesterday and tomorrow by their weekday; the rest is the same');
eq([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => C.when(new Date(2025, m, 5, 9, 4).getTime(), NOW)), ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => '5 ' + m + ' 09:04'), 'the twelve months, by the same short names in every browser');
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
eq(Object.keys(real), ['crew', 'lines', 'lead', 'brief', 'tips', 'aria', 'total'], 'derive returns crew, lines, lead, brief, tips, aria and total');
eq(real.crew.map((a) => a.state), ['needs', 'needs', 'needs', 'needs', 'idle'], 'real example: four agents wait on you, Review is idle');
eq(real.lines, { desk: '13:15 · 113 for you', decide: '07:44 · 10 decisions, 7 for Leo', instinct: '08:30 · 3 for you', muse: '08:30 · 2 for you', review: 'Mon 07:46 · posted' }, 'real example: the five chip lines; Decide\'s count is said in its parts');
eq([real.lead, real.brief], [{ desk: '13:15', decide: '07:44', instinct: '08:30', muse: '08:30', review: 'Mon 07:46' }, { desk: '113 for you', decide: '10 decisions, 7 for Leo', instinct: '3 for you', muse: '2 for you', review: 'posted' }], 'real example: each line as its leading time and the rest, for a narrow page');
ok(real.total === 135, 'real example: 135 waiting in all', real.total);
eq([real.tips.desk.next, real.tips.instinct.next, real.tips.review.next], ['Next run 07:13 tomorrow', 'Next run 16:07', 'Next run Mon 07:37'], 'real example: Desk runs next tomorrow 07:13, Instinct at 16:07, Review on Monday 07:37');
eq(real.crew[0], { id: 'desk', name: 'Desk', look: 'headset', hue: 'teal', state: 'needs', waiting: 113, step: '', bubble: '113 for you', fresh: 1795522558000 }, 'real example: Desk\'s crew entry is the contract\'s own example');
eq(real.crew.map((a) => [a.id, a.name, a.look, a.hue]), C.ROSTER.map((a) => [a.id, a.name, a.look, a.hue]), 'the crew is in desk order with the roster\'s names, looks and hues');
eq(real.tips, {
  desk: { state: '113 waiting on you', last: 'Last result 13:15', next: 'Next run 07:13 tomorrow' },
  decide: { state: '17 waiting on you: 10 decisions, 7 for Leo', last: 'Last result 07:44', next: 'Next run 07:43 tomorrow' },
  instinct: { state: '3 waiting on you', last: 'Last result 08:30', next: 'Next run 16:07' },
  muse: { state: '2 waiting on you', last: 'Last result 08:30', next: 'Next run 08:07 tomorrow' },
  review: { state: 'Nothing waiting on you', last: 'Last result yesterday 07:46', next: 'Next run Mon 07:37' },
}, 'real example: the tooltips (a tooltip has room for "yesterday", a chip has not)');
eq(real.aria, 'Desk: 113 waiting on you. Decide: 17 waiting on you. Instinct: 3 waiting on you. Muse: 2 waiting on you. Review: nothing waiting.', 'real example: the sentence read out for the picture');
eq(real.crew.map((a) => [a.bubble, a.step, a.fresh]), [['113 for you', '', T(REAL.desk.at)], ['17 for you', '', T(REAL.decide.at)], ['3 for you', '', T(REAL.instinct.at)], ['2 for you', '', T(REAL.muse.at)], ['', '', T(REAL.review.at)]], 'real example: bubbles say the count as a number, nobody has a step, fresh is the time of each result');
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
eq([due.crew[0].state, due.lines.desk, due.crew[0].bubble], ['due', 'due 13:13 · 113 for you', 'Run due 13:13'], 'at 13:20 with only the morning\'s result, Desk is due, and its 113 are still on the chip');
eq(due.tips.desk, { state: 'A run was due at 13:13. No result yet. 113 still waiting on you', last: 'Last result 07:15', next: 'Next run 07:13 tomorrow' }, 'and its tooltip says so');
eq([late.crew[0].state, late.lines.desk, late.crew[0].bubble, late.tips.desk.state], ['late', 'no result 13:13 · 113 for you', 'No result 13:13', 'No result from the 13:13 run. 113 still waiting on you'], 'at 14:05 it is late: "no result", not "missed"');
eq([due.total, late.total, due.lead.desk, due.brief.desk, due.aria.split('. ')[0]], [135, 135, '', 'due 13:13 · 113 for you', 'Desk: a run was due at 13:13, 113 still waiting on you'], 'what waits at an agent that is due or late is still in the total and in the sentence read out');

// ---------- the rules, in order ----------
// one agent on its own: its crew entry, plus its line (whole, and as lead and brief), its tooltip, its phrase and the total
const see = (id, fact, now, pulse, names) => {
  const r = C.derive({ [id]: fact, pulse: pulse ? { [id]: pulse } : null }, now, names), i = IDS.indexOf(id);
  return { ...r.crew[i], line: r.lines[id], lead: r.lead[id], brief: r.brief[id], tip: r.tips[id], said: r.aria.split('. ')[i].replace(/\.$/, '').replace(/^.*?: /, ''), total: r.total };
};
const FRESH = REAL.desk, STALE = EARLY.desk;       // with, and without, a result for the 13:13 run
const DUE = T('2026-11-24T12:20:00Z');             // 13:20: seven minutes after that run
const beat = (state, startedMs, more) => ({ state, startedAt: iso(startedMs), finishedAt: null, step: 'Reading Slack', ...more });
const LIVE = beat('running', NOW - 2 * MIN);       // a run that started two minutes ago

// 1. the source
for (const [src, line, tip, say] of [['loading', '', 'No data yet', 'no data yet'], ['nodb', 'no data', 'Can\'t read the database here', 'no data'], ['error', 'no data', 'Can\'t read the database here', 'no data'], ['missing', 'not run yet', 'Has not run yet', 'has not run yet']]) {
  const a = see('desk', { ...FRESH, src }, NOW);
  ok(a.state === 'unknown' && a.line === line && a.lead === '' && a.brief === line && a.tip.state === tip && a.tip.last === '' && a.tip.next === 'Next run 07:13 tomorrow' && a.bubble === '' && a.said === say,
    `source ${src}: not in the room, line "${line}", tooltip "${tip}", read out as "${say}"`, a);
  ok(a.waiting === 113 && a.fresh === T(FRESH.at) && a.total === 0, `source ${src}: the count and the result's time are handed on as they came, but the count is not in the total`, [a.waiting, a.fresh, a.total]);
}
// 2. a heartbeat
const working = see('desk', FRESH, NOW, LIVE);
eq([working.state, working.line, working.lead, working.step, working.bubble, working.tip.state, working.said, working.total],
  ['working', 'working · Reading Slack', '', 'Reading Slack', 'Reading Slack', 'Working now: Reading Slack. 113 still waiting on you', 'working now, 113 still waiting on you', 113], 'a running heartbeat two minutes old: working, with its step; what waits is in the tooltip, the sentence and the total, not on the chip');
const quiet = see('desk', { ...FRESH, waiting: 0 }, NOW, { ...LIVE, step: '' });
eq([quiet.state, quiet.line, quiet.step, quiet.bubble, quiet.tip.state, quiet.said], ['working', 'working', '', '', 'Working now', 'working now'], 'a running heartbeat without a step, and nothing waiting: just working');
eq([0, 45 * MIN, 45 * MIN + 1, -1, -5 * MIN].map((ago) => see('desk', FRESH, NOW, beat('running', NOW - ago)).state), ['working', 'working', 'needs', 'needs', 'needs'], 'a heartbeat counts when it started 0 to 45 minutes ago: not a millisecond more, and not from the future');
each(['ok', 'done', 'RUNNING', ''], (s) => { const a = see('desk', FRESH, NOW, beat(s, NOW - 2 * MIN)); return [a.state, a.step]; }, ['needs', ''], 'a heartbeat that is not running is not work, and its step is not shown');
// once a result has landed the run is over, whether or not its heartbeat was cleared
const S = T('2026-11-24T12:13:05Z'); // when the 13:13 run's heartbeat started
eq([see('desk', STALE, DUE, beat('running', S)).state, see('desk', FRESH, DUE, beat('running', S)).state, see('desk', FRESH, DUE, beat('running', S)).line], ['working', 'needs', '13:15 · 113 for you'], 'a heartbeat still "running" after its run\'s result has landed is not work');
eq([see('desk', { ...FRESH, at: iso(S - 2 * MIN) }, DUE, beat('running', S)).state, see('desk', { ...FRESH, at: iso(S - 2 * MIN - 1) }, DUE, beat('running', S)).state], ['needs', 'working'], 'a result stamped up to two minutes before the heartbeat started is that run\'s; a millisecond more and the run is still on');
// 3. a scheduled run with no result
eq([see('desk', STALE, T('2026-11-24T12:12:59.999Z')).state, see('desk', STALE, T('2026-11-24T12:13:00Z')).state], ['needs', 'due'], 'Desk is due from the minute of its run, not a millisecond before');
eq([see('desk', STALE, T('2026-11-24T12:58:00Z')).state, see('desk', STALE, T('2026-11-24T12:58:00Z') + 1).state], ['due', 'late'], 'Desk is due for its 45 minutes of grace, then late');
const D = { src: 'ok', at: '2026-11-23T06:44:00Z', waiting: 4 }, I = { src: 'ok', at: '2026-11-23T07:30:00Z', waiting: 3 }; // Decide's and Instinct's results from Monday
eq([see('decide', D, T('2026-11-24T07:13:00Z')).state, see('decide', D, T('2026-11-24T07:13:00Z') + 1).state], ['due', 'late'], 'Decide has 30 minutes of grace');
eq([see('instinct', I, T('2026-11-24T08:07:00Z')).state, see('instinct', I, T('2026-11-24T08:07:00Z') + 1).state, see('muse', I, T('2026-11-24T08:07:00Z')).state, see('muse', I, T('2026-11-24T08:07:00Z') + 1).state], ['due', 'late', 'due', 'late'], 'Instinct and Muse have 60 minutes of grace');
const TODAY = { src: 'ok', at: '2026-11-24T07:30:00Z', waiting: 3 }; // Instinct's result from this morning's 08:07 run
each(['2026-11-24T09:08:00Z', '2026-11-24T11:30:00Z', '2026-11-24T13:30:00Z', '2026-11-24T15:30:00Z', '2026-11-24T20:00:00Z'], (t) => see('instinct', TODAY, T(t)).state, 'needs', 'Instinct\'s other runs are never waited for: with the morning\'s result it is not due or late at 10:08, 12:30, 14:30, 16:30 or in the evening');
eq([see('instinct', TODAY, T('2026-11-24T07:20:00Z')).tip.next, see('instinct', TODAY, T('2026-11-24T09:08:00Z')).tip.next, see('instinct', TODAY, T('2026-11-24T15:08:00Z')).tip.next], ['Next run 10:07', 'Next run 12:07', 'Next run 08:07 tomorrow'], 'but they are announced as its next run');
eq([see('desk', { ...FRESH, at: '2026-11-24T11:53:00.000Z' }, NOW).state, see('desk', { ...FRESH, at: '2026-11-24T11:52:59.999Z' }, NOW).state], ['needs', 'late'], 'a result stamped up to 20 minutes before the run is that run\'s result; a millisecond more and it is not');
eq([see('desk', { ...FRESH, at: null }, DUE).state, see('desk', { ...FRESH, at: null }, NOW).state, see('desk', { src: 'ok' }, NOW).state], ['due', 'late', 'late'], 'no result time at all: due, then late');
ok(see('desk', { ...FRESH, at: iso(NOW + 5 * MIN) }, NOW).state === 'needs', 'a result stamped a little ahead of this clock still counts');
// what waits on William does not vanish while its agent is due or late
const dueBusy = see('desk', STALE, DUE), lateBusy = see('desk', STALE, NOW), dueClear = see('desk', { ...STALE, waiting: 0 }, DUE), lateClear = see('desk', { ...STALE, waiting: 0 }, NOW);
eq([dueBusy.line, dueBusy.lead, dueBusy.brief, dueBusy.bubble, dueBusy.tip.state, dueBusy.said, dueBusy.waiting, dueBusy.total],
  ['due 13:13 · 113 for you', '', 'due 13:13 · 113 for you', 'Run due 13:13', 'A run was due at 13:13. No result yet. 113 still waiting on you', 'a run was due at 13:13, 113 still waiting on you', 113, 113], 'due with things waiting: the count on the chip, in the tooltip, in the sentence and in the total');
eq([lateBusy.line, lateBusy.lead, lateBusy.bubble, lateBusy.tip.state, lateBusy.said, lateBusy.total],
  ['no result 13:13 · 113 for you', '', 'No result 13:13', 'No result from the 13:13 run. 113 still waiting on you', 'no result from the 13:13 run, 113 still waiting on you', 113], 'late with things waiting: the same, after "no result"');
eq([dueClear.line, dueClear.bubble, dueClear.tip.state, dueClear.said, lateClear.line, lateClear.bubble, lateClear.tip.state, lateClear.said, lateClear.total],
  ['due 13:13', 'Run due 13:13', 'A run was due at 13:13. No result yet', 'a run was due at 13:13', 'no result 13:13', 'No result 13:13', 'No result from the 13:13 run', 'no result from the 13:13 run', 0], 'due or late with nothing waiting: nothing is added');
// 4. a failure
const failed = see('desk', { ...FRESH, status: 'failed' }, NOW), failedClear = see('desk', { ...FRESH, status: 'failed', waiting: 0 }, NOW);
eq([failed.state, failed.line, failed.lead, failed.bubble, failed.tip.state, failed.said, failed.total], ['error', 'failed 13:15 · 113 for you', '', 'Run failed', 'The last run failed. 113 still waiting on you', 'the last run failed, 113 still waiting on you', 113], 'a result that says failed: error, with the time of that result and what still waits');
eq([failedClear.line, failedClear.tip.state, failedClear.said], ['failed 13:15', 'The last run failed', 'the last run failed'], 'a failure with nothing waiting: nothing is added');
// a heartbeat that ended in an error: its time is its end, or else its start
const E = (finishedAt, more) => beat('error', S, { finishedAt, ...more });
const crashed = see('desk', FRESH, NOW, E('2026-11-24T12:16:40Z'));
eq([crashed.state, crashed.line, crashed.tip.last], ['error', 'failed 13:16 · 113 for you', 'Last result 13:15'], 'a heartbeat that ended in an error after the last result: error, with the time it ended');
eq([see('desk', STALE, DUE, E('2026-11-24T12:16:40Z')).line, see('desk', STALE, NOW, E('2026-11-24T12:16:40Z')).line, see('desk', STALE, NOW, E(null)).line, see('desk', { ...STALE, at: null }, NOW, E(null)).line],
  ['failed 13:16 · 113 for you', 'failed 13:16 · 113 for you', 'failed 13:13 · 113 for you', 'failed 13:13 · 113 for you'], 'a run that died without writing a result is an error at once, not due and then late; with no end it is timed by its start');
eq([see('desk', FRESH, NOW, E('2026-11-24T12:15:58.000Z')).state, see('desk', FRESH, NOW, E('2026-11-24T12:15:58.001Z')).state, see('desk', FRESH, NOW, E('2026-11-24T06:16:00Z')).state], ['needs', 'error', 'needs'], 'an error heartbeat counts only when it is later than the latest result: one as old, or older, is passed over');
eq([see('desk', FRESH, NOW, E(iso(NOW + 2 * MIN))).state, see('desk', FRESH, NOW, E(iso(NOW + 2 * MIN + 1))).state], ['error', 'needs'], 'an error heartbeat up to two minutes ahead of this clock counts; one further in the future does not');
eq([see('desk', STALE, NOW, E('2026-11-24T11:53:00.000Z')).state, see('desk', STALE, NOW, E('2026-11-24T11:52:59.999Z')).state, see('desk', STALE, DUE, E('2026-11-24T11:52:59.999Z')).state], ['error', 'late', 'due'], 'it speaks for the latest scheduled run from 20 minutes before that run; earlier, that run is still awaited');
ok(see('desk', FRESH, NOW, { state: 'error' }).state === 'needs' && see('desk', FRESH, NOW, { state: 'error', startedAt: 'earlier', finishedAt: 7 }).state === 'needs', 'an error heartbeat with no readable time is not believed');
eq(see('desk', { ...FRESH, status: 'failed' }, NOW, E('2026-11-24T12:40:00Z')).line, 'failed 13:40 · 113 for you', 'a failed result and a later run that died: the later time is the one shown');
// 5 and 6. waiting on you, or not
const needs = see('desk', FRESH, NOW), idle = see('desk', { ...FRESH, waiting: 0 }, NOW);
eq([needs.state, needs.line, needs.lead, needs.brief, needs.bubble, needs.tip.state, needs.said, needs.total], ['needs', '13:15 · 113 for you', '13:15', '113 for you', '113 for you', '113 waiting on you', '113 waiting on you', 113], 'something waiting: needs you');
eq([idle.state, idle.line, idle.lead, idle.brief, idle.bubble, idle.tip.state, idle.said, idle.total], ['idle', '13:15 · all clear', '13:15', 'all clear', '', 'Nothing waiting on you', 'nothing waiting', 0], 'nothing waiting: idle, with the roster\'s word');
eq(see('review', { src: 'ok', at: '2026-11-23T06:46:19Z', waiting: 0 }, NOW).line, 'Mon 07:46 · posted', 'Review\'s idle word is "posted"');
// a partial run (one of its sources failed) is not an error, but it is said where the last result is shown
const partial = see('desk', { ...FRESH, status: 'partial' }, NOW), partialClear = see('desk', { ...FRESH, status: 'partial', waiting: 0 }, NOW);
eq([partial.state, partial.line, partial.lead, partial.brief, partial.bubble, partial.tip, partial.said],
  ['needs', '13:15 · partial · 113 for you', '13:15', 'partial · 113 for you', '113 for you', { state: '113 waiting on you', last: 'Last result 13:15, partial: a source failed', next: 'Next run 07:13 tomorrow' }, '113 waiting on you, last run partial'], 'a partial run with things waiting: needs, "partial" before the count, and the tooltip says what partial means');
eq([partialClear.state, partialClear.line, partialClear.lead, partialClear.brief, partialClear.bubble, partialClear.tip.state, partialClear.tip.last, partialClear.said],
  ['idle', '13:15 · partial', '13:15', 'partial', '', 'Nothing waiting on you', 'Last result 13:15, partial: a source failed', 'nothing waiting, last run partial'], 'a partial run with nothing waiting: idle, "partial" in place of "all clear"');
eq(see('review', { src: 'ok', at: '2026-11-23T06:46:19Z', status: 'partial', waiting: 0 }, NOW).line, 'Mon 07:46 · partial', 'and in place of Review\'s "posted"');
const partialDue = see('desk', { ...STALE, status: 'partial' }, DUE), partialBusy = see('desk', { ...FRESH, status: 'partial' }, NOW, LIVE);
eq([partialDue.line, partialDue.tip.last, partialDue.said, partialBusy.line, partialBusy.tip.last, partialBusy.said],
  ['due 13:13 · 113 for you', 'Last result 07:15, partial: a source failed', 'a run was due at 13:13, 113 still waiting on you', 'working · Reading Slack', 'Last result 13:15, partial: a source failed', 'working now, 113 still waiting on you'], 'while a later run is due or under way, only the tooltip\'s last result still says partial');
each(['Partial', 'PARTIAL', ' partial', ['partial'], true, 'ok', ''], (status) => see('desk', { ...FRESH, status }, NOW).line, '13:15 · 113 for you', 'only the word "partial" itself marks a partial run');

// ---------- when two rules could both apply, the earlier one wins ----------
const RUN = beat('running', DUE - 2 * MIN);
each(['loading', 'nodb', 'error', 'missing'], (src) => see('desk', { ...STALE, src, status: 'failed' }, DUE, RUN).state, 'unknown', 'an unread source beats a heartbeat, a run that is due, a failure and things waiting');
each(['loading', 'nodb', 'error', 'missing'], (src) => see('desk', { ...STALE, src }, DUE, E('2026-11-24T12:16:40Z')).state, 'unknown', 'and a run that died');
eq([see('desk', STALE, DUE, RUN).state, see('desk', STALE, NOW, LIVE).state], ['working', 'working'], 'a heartbeat while a run is due, or late: working');
eq([see('desk', STALE, DUE, beat('running', DUE - 46 * MIN)).state, see('desk', STALE, NOW, beat('running', NOW - 46 * MIN)).state], ['due', 'late'], 'a heartbeat that has gone stale while a run is due, or late: due, late');
ok(see('desk', { ...FRESH, status: 'failed' }, NOW, LIVE).state === 'working', 'a heartbeat after a failed result: working');
eq([see('desk', FRESH, NOW, LIVE).state, see('desk', FRESH, NOW, LIVE).total], ['working', 113], 'a heartbeat with things waiting: working, and they stay in the total');
eq([see('desk', FRESH, DUE, beat('running', S)).state, see('desk', { ...FRESH, waiting: 0 }, DUE, beat('running', S)).state, see('desk', { ...FRESH, status: 'failed' }, DUE, beat('running', S)).state], ['needs', 'idle', 'error'], 'a heartbeat left "running" after the result landed: the result decides (needs, idle, error)');
eq([see('desk', { ...STALE, status: 'failed' }, DUE).state, see('desk', { ...STALE, status: 'failed' }, NOW).state], ['due', 'late'], 'a failed result from the run before, with a scheduled run since that left nothing: due, then late (not error)');
eq([see('desk', STALE, DUE, E('2026-11-24T12:16:40Z')).state, see('desk', STALE, NOW, E('2026-11-24T12:16:40Z')).state], ['error', 'error'], 'an error heartbeat for the scheduled run that left no result: error, during its grace and after');
const OLD = E('2026-11-24T06:16:00Z', { startedAt: '2026-11-24T06:13:05Z' }); // the morning run's heartbeat, ended in an error
eq([see('desk', { ...STALE, at: null }, DUE, OLD).line, see('desk', { ...STALE, at: null }, NOW, OLD).line, see('desk', { ...STALE, at: '2026-11-23T12:15:00Z' }, NOW, OLD).line],
  ['due 13:13 · 113 for you', 'no result 13:13 · 113 for you', 'no result 13:13 · 113 for you'], 'an error heartbeat from the run before, and a scheduled run since that left nothing: due, then late (the old error is history)');
eq([see('desk', { ...FRESH, status: 'failed' }, NOW).state, see('desk', FRESH, NOW, E(iso(NOW - MIN))).state], ['error', 'error'], 'a failure with things waiting: error');
ok(see('desk', FRESH, NOW, OLD).state === 'needs', 'an error heartbeat from before the last result is history: needs');
eq([see('desk', { ...FRESH, status: 'partial', waiting: 0 }, NOW).line, see('desk', { ...FRESH, status: 'partial', waiting: 0 }, NOW).state], ['13:15 · partial', 'idle'], 'a partial run with nothing waiting: idle, and still said');
eq([see('desk', { ...FRESH, at: '2026-11-24T13:15:58' }, NOW).line, see('desk', FRESH, NOW, { ...LIVE, startedAt: '2026-11-24T14:06:00' }).state, see('desk', FRESH, NOW, E('2026-11-24T13:16:40', { startedAt: '2026-11-24T13:13:05' })).state],
  ['no result 13:13 · 113 for you', 'needs', 'needs'], 'a time without a zone is not a time: no result, no heartbeat, no error');

// ---------- a Tuesday at Desk, and a Monday at Review ----------
const MON = { src: 'ok', at: '2026-11-23T12:15:00Z', status: 'ok', waiting: 40 }, AM = { src: 'ok', at: '2026-11-24T06:15:10Z', status: 'ok', waiting: 113 };
const MORNING = T('2026-11-24T06:13:20Z'); // when the 07:13 run's heartbeat started
eq([
  see('desk', MON, T('2026-11-24T05:00:00Z')), see('desk', MON, T('2026-11-24T06:13:00Z')), see('desk', MON, T('2026-11-24T06:14:00Z'), beat('running', MORNING)),
  see('desk', AM, T('2026-11-24T06:16:00Z'), beat('running', MORNING)), see('desk', AM, T('2026-11-24T06:17:00Z'), beat('ok', MORNING, { finishedAt: '2026-11-24T06:15:30Z' })), see('desk', AM, T('2026-11-24T12:12:00Z')),
  see('desk', AM, T('2026-11-24T12:13:00Z')), see('desk', AM, T('2026-11-24T12:59:00Z')), see('desk', FRESH, NOW),
].map((a) => a.line), ['Mon 13:15 · 40 for you', 'due 07:13 · 40 for you', 'working · Reading Slack', '07:15 · 113 for you', '07:15 · 113 for you', '07:15 · 113 for you', 'due 13:13 · 113 for you', 'no result 13:13 · 113 for you', '13:15 · 113 for you'],
'Desk through a Tuesday: yesterday\'s count, due, working, the morning\'s count (heartbeat cleared or not), due again, no result, the afternoon\'s count');
const LAST_WEEK = { src: 'ok', at: '2026-11-16T06:46:19Z', waiting: 0 }, THIS_WEEK = { src: 'ok', at: '2026-11-23T06:46:19Z', waiting: 0 };
const before = see('review', LAST_WEEK, T('2026-11-23T06:36:00Z')), after = see('review', THIS_WEEK, T('2026-11-23T06:47:00Z'));
eq([before.state, before.line, before.lead, before.tip.last, before.tip.next], ['idle', '16 Nov 07:46 · posted', '16 Nov 07:46', 'Last result 16 Nov 07:46', 'Next run 07:37'], 'Review on Monday 07:36: last week\'s post, by its date and time, and a run today');
eq([see('review', LAST_WEEK, T('2026-11-23T06:37:00Z')).line, see('review', LAST_WEEK, T('2026-11-23T07:22:00Z')).line, see('review', LAST_WEEK, T('2026-11-23T07:22:00Z') + 1).line], ['due 07:37', 'due 07:37', 'no result 07:37'], 'Review on Monday from 07:37: due for 45 minutes, then late');
eq([after.state, after.line, after.tip.last, after.tip.next], ['idle', '07:46 · posted', 'Last result 07:46', 'Next run 30 Nov 07:37'], 'Review on Monday once it has posted: idle, next run a week away, by its date and time');
eq([see('review', LAST_WEEK, T('2026-11-27T19:00:00Z')).line, see('review', LAST_WEEK, T('2026-11-29T10:00:00Z')).line, see('review', LAST_WEEK, T('2026-11-30T06:30:00Z')).line, see('review', LAST_WEEK, T('2026-11-30T06:30:00Z')).bubble], ['no result Mon 07:37', 'no result Mon 07:37', 'no result 23 Nov 07:37', 'No result 23 Nov 07:37'], 'a Monday run that left nothing stays so all week, named by its day');
// evenings, weekends and midnight, in words
const FRI = { src: 'ok', at: '2026-11-27T12:15:00Z', status: 'ok', waiting: 9 };
const fri = see('desk', FRI, T('2026-11-27T19:00:00Z')), sat = see('desk', FRI, T('2026-11-28T10:00:00Z')), sun = see('desk', FRI, T('2026-11-29T10:00:00Z'));
eq([fri.line, fri.tip.last, fri.tip.next], ['13:15 · 9 for you', 'Last result 13:15', 'Next run Mon 07:13'], 'Friday evening: today\'s result, next run on Monday');
eq([sat.line, sat.tip.last, sat.tip.next], ['Fri 13:15 · 9 for you', 'Last result yesterday 13:15', 'Next run Mon 07:13'], 'Saturday: Friday\'s result still stands (nothing is due at a weekend)');
eq([sun.line, sun.tip.last, sun.tip.next], ['Fri 13:15 · 9 for you', 'Last result Fri 13:15', 'Next run 07:13 tomorrow'], 'Sunday: the same, and the next run is tomorrow');
const friLate = { ...FRI, at: '2026-11-27T06:15:00Z' };
eq([see('desk', friLate, T('2026-11-28T10:00:00Z')).line, see('desk', friLate, T('2026-11-29T10:00:00Z')).tip.state, see('desk', friLate, T('2026-11-29T10:00:00Z')).said], ['no result Fri 13:13 · 9 for you', 'No result from the Fri 13:13 run. 9 still waiting on you', 'no result from the Fri 13:13 run, 9 still waiting on you'], 'a Friday afternoon run that left nothing is still awaited at the weekend, named by its day');
const eve = see('desk', FRESH, T('2026-11-24T23:00:00Z') - 1), midnight = see('desk', FRESH, T('2026-11-24T23:00:00Z'));
eq([eve.state, eve.line, eve.tip.last, eve.tip.next], ['needs', '13:15 · 113 for you', 'Last result 13:15', 'Next run 07:13 tomorrow'], 'a millisecond before midnight: today\'s result, a run tomorrow');
eq([midnight.state, midnight.line, midnight.lead, midnight.tip.last, midnight.tip.next], ['needs', 'Tue 13:15 · 113 for you', 'Tue 13:15', 'Last result yesterday 13:15', 'Next run 07:13'], 'at midnight: yesterday\'s result, a run today');
// the Mondays after the clocks change: a fixed offset would be an hour out here
const OCT = { src: 'ok', at: '2026-10-23T11:15:00Z', waiting: 1 }, MAR = { src: 'ok', at: '2027-03-26T12:15:00Z', waiting: 1 };
eq([see('desk', OCT, T('2026-10-26T06:12:00Z')).state, see('desk', OCT, T('2026-10-26T06:20:00Z')).line, see('desk', OCT, T('2026-10-26T06:59:00Z')).line], ['needs', 'due 07:13 · 1 for you', 'no result 07:13 · 1 for you'], 'Monday after the clocks went back: due from 07:13 Stockholm time (06:13 UTC), not an hour early');
eq([see('desk', MAR, T('2027-03-29T05:12:00Z')).state, see('desk', MAR, T('2027-03-29T05:20:00Z')).line, see('desk', MAR, T('2027-03-29T05:59:00Z')).line], ['needs', 'due 07:13 · 1 for you', 'no result 07:13 · 1 for you'], 'Monday after the clocks went forward: due from 07:13 Stockholm time (05:13 UTC), not an hour late');

// ---------- the words in every state ----------
const MIXED = {
  desk: AM, decide: D, instinct: I, muse: { src: 'ok', at: '2026-11-24T07:09:00Z', status: 'failed', waiting: 2 }, review: { src: 'missing', at: null, waiting: 5 },
  pulse: { desk: beat('running', T('2026-11-24T07:18:00Z'), { step: 'Asking Salesforce' }) },
};
const mixed = C.derive(MIXED, T('2026-11-24T07:20:00Z'), { desk: '  Front  desk ', decide: 'A very long name indeed', muse: 42, review: '' });
eq(mixed.crew.map((a) => a.state), ['working', 'late', 'due', 'error', 'unknown'], 'a morning with one of each: working, late, due, error, unknown');
eq(mixed.lines, { desk: 'working · Asking Salesforce', decide: 'no result 07:43 · 4 for you', instinct: 'due 08:07 · 3 for you', muse: 'failed 08:09 · 2 for you', review: 'not run yet' }, 'their chip lines');
eq([mixed.lead, mixed.brief], [{ desk: '', decide: '', instinct: '', muse: '', review: '' }, mixed.lines], 'none of these lines opens with a time: each is its own brief');
eq(mixed.crew.map((a) => a.bubble), ['Asking Salesforce', 'No result 07:43', 'Run due 08:07', 'Run failed', ''], 'their bubbles');
eq(IDS.map((id) => mixed.tips[id].state), ['Working now: Asking Salesforce. 113 still waiting on you', 'No result from the 07:43 run. 4 still waiting on you', 'A run was due at 08:07. No result yet. 3 still waiting on you', 'The last run failed. 2 still waiting on you', 'Has not run yet'], 'their tooltip sentences');
eq(IDS.map((id) => mixed.tips[id].last), ['Last result 07:15', 'Last result yesterday 07:44', 'Last result yesterday 08:30', 'Last result 08:09', ''], 'their last results');
eq(IDS.map((id) => mixed.tips[id].next), ['Next run 13:13', 'Next run 07:43 tomorrow', 'Next run 10:07', 'Next run 08:07 tomorrow', 'Next run Mon 07:37'], 'their next runs');
eq(mixed.crew.map((a) => a.name), ['Front desk', 'A very long', 'Instinct', 'Muse', 'Review'], 'a name from the page wins: one line, trimmed, cut at 12; anything else falls back to the roster\'s');
eq(mixed.aria, 'Front desk: working now, 113 still waiting on you. A very long: no result from the 07:43 run, 4 still waiting on you. Instinct: a run was due at 08:07, 3 still waiting on you. Muse: the last run failed, 2 still waiting on you. Review: has not run yet.', 'one sentence each for the picture, with the names shown');
ok(mixed.total === 113 + 4 + 3 + 2 && mixed.crew[0].step === 'Asking Salesforce' && mixed.crew.slice(1).every((a) => a.step === ''), 'only the working agent has a step; the total is everything that waits at an agent that could be read (122, without the 5 of the unread one)', mixed.total);
eq(C.derive({}, NOW).aria, 'Desk: no data yet. Decide: no data yet. Instinct: no data yet. Muse: no data yet. Review: no data yet.', 'nothing known yet: said so for each');
ok([...Object.values(real.lines), ...Object.values(mixed.lines), due.lines.desk, late.lines.desk, partial.line].every((l) => !l.includes('.')), 'no full stops in chip lines');
// a count said in its parts
const DEC = { src: 'ok', at: '2026-11-24T06:44:12Z', waiting: 17 }, BOTH = [{ n: 10, word: 'decisions' }, { n: 7, word: 'for Leo' }];
const P = (parts, more) => see('decide', { ...DEC, parts, ...more }, NOW);
eq([P(BOTH).line, P(BOTH).lead, P(BOTH).brief, P(BOTH).tip.state, P(BOTH).bubble, P(BOTH).said], ['07:44 · 10 decisions, 7 for Leo', '07:44', '10 decisions, 7 for Leo', '17 waiting on you: 10 decisions, 7 for Leo', '17 for you', '17 waiting on you'], 'with parts, the chip says the parts; the tooltip the number and the parts; the bubble and the sentence the number');
eq([P([{ n: 0, word: 'decisions' }, { n: 7, word: 'for Leo' }], { waiting: 7 }).line, P([{ n: 0, word: 'decisions' }, { n: 7, word: 'for Leo' }], { waiting: 7 }).tip.state, P([{ n: 1, word: 'decision' }, { n: 0, word: 'for Leo' }], { waiting: 1 }).line], ['07:44 · 7 for Leo', '7 waiting on you: 7 for Leo', '07:44 · 1 decision'], 'a part with nothing in it is left out');
each([undefined, null, 'x', 7, {}, [], [null], [3], ['x'], [{}], [{ n: 3 }], [{ word: 'decisions' }], [{ n: '3', word: 'decisions' }], [{ n: -1, word: 'x' }], [{ n: 2, word: 9 }], [{ n: 0, word: 'decisions' }, { n: 0, word: 'for Leo' }]],
  (parts) => [P(parts).line, P(parts).tip.state], ['07:44 · 17 for you', '17 waiting on you'], 'no parts, parts that are not parts, or parts with nothing in them: the number alone');
const DM = { ...DEC, at: '2026-11-23T06:44:12Z', parts: BOTH }; // Decide's result from Monday, still waiting on Tuesday morning
const dueParts = see('decide', DM, T('2026-11-24T06:50:00Z'));
eq([dueParts.line, see('decide', DM, T('2026-11-24T07:20:00Z')).line, P(BOTH, { status: 'failed' }).line, dueParts.tip.state, dueParts.bubble, dueParts.said],
  ['due 07:43 · 10 decisions, 7 for Leo', 'no result 07:43 · 10 decisions, 7 for Leo', 'failed 07:44 · 10 decisions, 7 for Leo', 'A run was due at 07:43. No result yet. 17 still waiting on you', 'Run due 07:43', 'a run was due at 07:43, 17 still waiting on you'], 'the parts are said after due, no result and failed too; the tooltip and the sentence keep the number');
eq([P(BOTH, { status: 'partial' }).line, P(BOTH, { waiting: 0 }).line], ['07:44 · partial · 10 decisions, 7 for Leo', '07:44 · all clear'], 'the parts follow "partial" as well; with nothing waiting they are not said');
const CLEANED = P([{ n: 2.9, word: '  for\n Leo ' }, { n: 1e9, word: 'x'.repeat(99) }, { n: 1, word: 'c' }, { n: 1, word: 'd' }, { n: 1, word: 'e' }]);
eq([CLEANED.tip.state, CLEANED.line], ['17 waiting on you: 2 for Leo, 9999 ' + 'x'.repeat(16) + ', 1 c, 1 d', '07:44 · 2 for Leo, 9999 ' + 'x'.repeat(16) + ', 1 c, 1 d'], 'parts are cleaned like everything else: whole numbers, short one-line words, four at most');

// ---------- overdue: the latest scheduled run that left no result, once its grace is over ----------
const RUN13 = T('2026-11-24T12:13:00Z');
eq([C.overdue('desk', STALE.at, T('2026-11-24T12:58:00Z')), C.overdue('desk', STALE.at, T('2026-11-24T12:58:00Z') + 1), C.overdue('desk', STALE.at, NOW), C.overdue('desk', STALE.at, T('2026-11-24T12:12:00Z'))], [null, RUN13, RUN13, null], 'Desk with the morning\'s result only: nothing overdue before the run or during its 45 minutes of grace, then the 13:13 run');
eq([C.overdue('desk', FRESH.at, NOW), C.overdue('desk', '2026-11-24T11:53:00.000Z', NOW), C.overdue('desk', '2026-11-24T11:52:59.999Z', NOW)], [null, null, RUN13], 'not overdue with a result for that run, stamped up to 20 minutes before it');
each([null, undefined, '', 'x', '2026-11-24T12:15:58', 1795522558000], (at) => C.overdue('desk', at, NOW), RUN13, 'no result, or a stamp that is not a time with its zone: overdue');
eq([C.overdue('instinct', TODAY.at, T('2026-11-24T15:30:00Z')), C.overdue('instinct', I.at, T('2026-11-24T08:07:00Z')), C.overdue('instinct', I.at, T('2026-11-24T08:07:00Z') + 1), C.overdue('instinct', I.at, T('2026-11-24T15:30:00Z'))], [null, null, T('2026-11-24T07:07:00Z'), T('2026-11-24T07:07:00Z')], 'Instinct: its other runs are never overdue; its 08:07 run is, after an hour, and stays the one named');
eq([C.overdue('review', LAST_WEEK.at, T('2026-11-27T19:00:00Z')), C.overdue('desk', FRI.at, T('2026-11-28T10:00:00Z')), C.overdue('desk', friLate.at, T('2026-11-29T10:00:00Z'))], [T('2026-11-23T06:37:00Z'), null, T('2026-11-27T12:13:00Z')], 'Review\'s Monday run is overdue all week; at a weekend only what Friday left undone is');
each(['nobody', '', null, undefined, 7, {}, 'constructor'], (id) => C.overdue(id, null, NOW), null, 'an agent that is not on the roster is never overdue');
let apart = 0;
for (let t = T('2026-11-20T00:00:00Z'); t < T('2026-12-01T00:00:00Z'); t += 37 * MIN) {
  for (const [id, at] of [['desk', '2026-11-24T06:15:10Z'], ['decide', '2026-11-23T06:44:12Z'], ['instinct', '2026-11-25T07:30:00Z'], ['review', '2026-11-23T06:46:19Z']]) if ((see(id, { src: 'ok', at, waiting: 1 }, t).state === 'late') !== (C.overdue(id, at, t) !== null)) apart++;
}
ok(apart === 0, 'through eleven days, a run is overdue exactly when its agent stands as late', apart);

// ---------- garbage in: nothing thrown, nothing leaked ----------
const STATES = ['working', 'due', 'late', 'error', 'needs', 'idle', 'unknown'];
const LEAK = /NaN|undefined|null|Invalid|\[object|Infinity|function|=>|\de\+\d|-\d|[\u0000-\u001f\u007f]/;
const text = (v, max) => typeof v === 'string' && v.length <= max && !LEAK.test(v);
// everything the contract promises about a result, whatever went in; returns what is wrong with it
const flaws = (r) => {
  const bad = [], no = (c, what) => { if (!c) bad.push(what); };
  if (!r || typeof r !== 'object') return ['no result'];
  no(Object.keys(r).sort().join() === 'aria,brief,crew,lead,lines,tips,total', 'result fields');
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
    const t = (r.tips && r.tips[id]) || {}, line = r.lines && r.lines[id], lead = r.lead && r.lead[id], brief = r.brief && r.brief[id];
    no(text(line, 120), id + ' line');
    no(text(lead, 12) && text(brief, 120) && line === (lead ? lead + ' · ' : '') + brief, id + ' lead and brief');
    no(Object.keys(t).join() === 'state,last,next' && text(t.state, 120) && t.state.length > 0 && text(t.last, 60) && text(t.next, 40), id + ' tooltip');
  });
  no(['lines', 'lead', 'brief', 'tips'].every((k) => r[k] && typeof r[k] === 'object' && Object.keys(r[k]).join() === IDS.join()), 'ids of lines, lead, brief and tips');
  no(text(r.aria, 420) && r.aria.split('. ').length === IDS.length && r.aria.endsWith('.'), 'aria');
  no(Number.isInteger(r.total) && Array.isArray(r.crew) && r.total === r.crew.filter((a) => a && a.state !== 'unknown').reduce((s, a) => s + a.waiting, 0), 'total');
  return bad;
};
eq([flaws(real), flaws(due), flaws(late), flaws(mixed), flaws(C.derive())], [[], [], [], [], []], 'the checker itself passes the results above');
const spoilt = JSON.parse(JSON.stringify(real));
Object.assign(spoilt, { total: 134.5 }); spoilt.crew[1].extra = 1; spoilt.crew[2].waiting = '3'; spoilt.lines.desk = 'NaN:NaN · 113 for you'; spoilt.brief.decide = '17 for you'; spoilt.tips.muse.next = 7;
eq(flaws(spoilt), ['decide fields', 'instinct waiting', 'desk line', 'desk lead and brief', 'decide lead and brief', 'muse tooltip', 'total'], 'and it does see an extra field, a count that is text, a stray word, a line that is not its lead and brief, a sentence that is not text and a broken total');
const JUNK = [undefined, null, NaN, Infinity, -Infinity, -1, -0.5, 0, 0.5, 1, 2.9, 1e21, 2 ** 53, '', ' ', 'x', '17', 'ok', 'partial', 'failed', 'running', 'error', 'x'.repeat(5000), 'a\nb\tc\u0000d', '<b>x</b>', 'constructor', '__proto__', 'toString',
  true, false, [], {}, [1, 2], ['ok'], { n: 1 }, { desk: 1 }, () => 1, Symbol('s'), 10n, new Date(NaN), new Date(0), Object.create(null)];
const show = (v) => (typeof v === 'string' ? JSON.stringify(v.slice(0, 24)) : typeof v === 'object' && v ? Object.prototype.toString.call(v) + JSON.stringify(v) : typeof v === 'symbol' ? 'symbol' : String(v));
// each place a value can come in from, filled with each piece of junk in turn
const SLOTS = {
  'facts': (v) => [v, NOW],
  'facts, with no clock or names either': (v) => [v, v, v],
  'an agent\'s entry': (v) => [{ ...REAL, desk: v, review: v }, NOW],
  'src': (v) => [{ ...REAL, desk: { ...REAL.desk, src: v } }, NOW],
  'at': (v) => [{ ...REAL, desk: { ...REAL.desk, at: v } }, NOW],
  'status': (v) => [{ ...REAL, desk: { ...REAL.desk, status: v } }, NOW],
  'trial': (v) => [{ ...REAL, desk: { ...REAL.desk, trial: v }, review: { ...REAL.review, trial: v } }, NOW],
  'waiting': (v) => [{ ...REAL, desk: { ...REAL.desk, waiting: v }, decide: { ...REAL.decide, waiting: v } }, NOW],
  'waiting, while a run is due': (v) => [{ ...EARLY, desk: { ...EARLY.desk, waiting: v } }, DUE],
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
const tame = (f) => { try { const r = f(); return r === null || Number.isInteger(r); } catch (e) { return false; } };
ok(JUNK.every((v) => tame(() => C.overdue(v, v, v)) && tame(() => C.overdue('desk', v, NOW)) && tame(() => C.overdue('desk', STALE.at, v))), 'overdue with junk for an agent, a stamp or a clock: null or a time, nothing thrown');
// what the junk turns into
each([undefined, null, 42, 'x', [], () => 1], (v) => { const r = C.derive(v, NOW); return [r.crew.map((a) => a.state).join(), Object.values(r.lines).join(''), r.tips.desk.state, r.total]; },
  ['unknown,unknown,unknown,unknown,unknown', '', 'No data yet', 0], 'facts that are not facts: nobody in the room, nothing said');
each([undefined, null, 42, 'ok', []], (v) => { const r = C.derive({ ...REAL, desk: v }, NOW); return [r.crew[0].state, r.lines.desk, r.crew[1].state, r.total]; },
  ['unknown', '', 'needs', 22], 'one missing entry: that agent is unknown, the others are untouched');
each([undefined, null, 42, 'OK', 'ready', 'constructor', '__proto__', ['ok']], (v) => { const a = see('desk', { ...FRESH, src: v }, NOW); return [a.state, a.line, a.tip.state]; },
  ['unknown', '', 'No data yet'], 'a source it does not know is read as still loading');
each([undefined, null, '', 'yesterday', 'run 1', '2026-11-24', '2026-11-24 12:15:58Z', '2026-13-45T25:61:00Z', '2026-11-24T12:15:58', '2026-11-24T12:15', '2026-11-24T12:15:58.000', '2026-11-24T12:15:58 Z', '2026-11-24T12:15:58+01', 1795522558000, {}, new Date(NOW)],
  (v) => { const a = see('desk', { ...FRESH, at: v }, NOW); return [a.state, a.line, a.tip.last, a.fresh]; }, ['late', 'no result 13:13 · 113 for you', '', 0],
  'an `at` that is not an ISO time with its zone (a date alone, a space for the T, no Z or offset, a number, loose text) is no result: fresh is 0');
each(['2026-11-24T12:15:58Z', '2026-11-24T12:15:58.250Z', '2026-11-24T13:15:58+01:00', '2026-11-24T13:15:58+0100', '2026-11-24T07:15:58-05:00', '2026-11-24T07:15:58.123456-0500', '2026-11-24T12:15Z'], (v) => { const a = see('desk', { ...FRESH, at: v }, NOW); return [a.line, Math.floor(a.fresh / MIN)]; },
  ['13:15 · 113 for you', Math.floor(T(FRESH.at) / MIN)], 'ISO times are read with Z, +01:00 or +0100, with or without seconds and fractions, and all mean the same minute');
each([-5, -0.5, 0, 0.5, NaN, Infinity, -Infinity, '17', '', null, undefined, [3], true, {}], (v) => { const a = see('desk', { ...FRESH, waiting: v }, NOW); return [a.state, a.waiting, a.total]; },
  ['idle', 0, 0], 'a count that is negative, below one, not finite or not a number is nothing waiting');
eq([1, 2.9, 99.999, 9999, 10000, 1e21, Number.MAX_VALUE].map((v) => see('desk', { ...FRESH, waiting: v }, NOW)).map((a) => [a.state, a.waiting, a.total, a.bubble]),
  [1, 2, 99, 9999, 9999, 9999, 9999].map((n) => ['needs', n, n, n + ' for you']), 'a count is a whole number, capped at 9999');
ok(C.derive({ ...REAL, desk: { ...REAL.desk, waiting: 1e21 }, decide: { ...REAL.decide, waiting: 2.5 } }, NOW).total === 9999 + 2 + 3 + 2, 'the total stays a whole number');
const stepOf = (v) => { const a = see('desk', FRESH, NOW, { ...LIVE, step: v }); return [a.step, a.line, a.bubble]; };
eq([stepOf('Reading every Slack channel there is, twice over'), stepOf('  Reading\n\tSlack  ')],
  [['Reading every Slack chan', 'working · Reading every Slack chan', 'Reading every Slack chan'], ['Reading Slack', 'working · Reading Slack', 'Reading Slack']], 'a step is put on one line and cut at 24 characters');
each(['Reading Slack.', 'Reading Slack...', 'Reading Slack\u2026', 'Reading Slack . '], (v) => [stepOf(v)[0], see('desk', FRESH, NOW, { ...LIVE, step: v }).tip.state], ['Reading Slack', 'Working now: Reading Slack. 113 still waiting on you'], 'a step loses its closing full stops, so the sentences around it read well');
each([42, null, {}, ['Reading Slack'], '', ' \n ', '...'], stepOf, ['', 'working', ''], 'a step that is empty or not text is no step');
const nameOf = (v) => see('desk', FRESH, NOW, null, { desk: v }).name;
eq(['Scout', 'x'.repeat(40), '  Night   desk  ', 'Ålder 🤖🤖🤖🤖🤖🤖🤖🤖'].map(nameOf), ['Scout', 'x'.repeat(12), 'Night desk', 'Ålder 🤖🤖🤖🤖🤖🤖'], 'a name is put on one line and cut at 12 characters (whole characters, not halves)');
each(['', '   ', 7, null, {}, ['Desk']], nameOf, 'Desk', 'a name that is empty or not text is the roster\'s');
each(['running', 42, [], [LIVE], { desk: 'running' }, { desk: null }, { desk: [LIVE] }, { desk: { state: 'running' } }, { desk: { state: 'running', startedAt: NOW } }, { desk: { state: ['running'], startedAt: iso(NOW) } }, { other: LIVE }],
  (v) => C.derive({ ...REAL, pulse: v }, NOW).crew[0].state, 'needs', 'a pulse of the wrong shape is no heartbeat');
// derive keeps nothing and changes nothing
const frozen = JSON.stringify(MIXED), roster = JSON.stringify(C.ROSTER);
const first = JSON.stringify(C.derive(MIXED, T('2026-11-24T07:20:00Z')));
ok(first === JSON.stringify(C.derive(MIXED, T('2026-11-24T07:20:00Z'))) && JSON.stringify(MIXED) === frozen && JSON.stringify(C.ROSTER) === roster, 'the same facts and clock give the same answer, and neither the facts nor the roster are changed');

// ---------- the rooms: his five, and one room per department ----------
eq(C.ROOMS.map((r) => [r.id, r.name, r.agents.map((a) => a.id)]), [['mine', 'Your agents', IDS], ['hygiene', 'Data Hygiene', ['sweeper', 'accounts']], ['arr', 'ARR', ['pacing', 'forecast', 'renewals']], ['exec', 'Executive', ['rundown', 'prep']]], 'four rooms: his own five, Data Hygiene, ARR and Executive, each with its agents in desk order');
ok(C.ROOMS[0].agents === C.ROSTER, 'the first room is the roster itself, not a copy of it');
const LINK = ['not linked yet', 'Runs today and posts by itself. Not linked to the cockpit yet', 'Not linked to the cockpit yet'], YEAR_END = '2027-01-01T00:00+01:00';
eq(C.ROOMS.slice(1).flatMap((r) => r.agents), [
  { id: 'sweeper', name: 'Sweeper', look: 'plain', hue: 'green', days: [1, 5], at: ['06:50'], graceMin: 45, idleWord: 'all clear' },
  { id: 'accounts', name: 'Accounts', look: 'headset', hue: 'violet', days: [3], at: ['06:50'], graceMin: 45, idleWord: 'all clear' },
  { id: 'pacing', name: 'Pacing', look: 'gavel', hue: 'teal', days: [1, 2, 3, 4, 5], at: ['07:45'], graceMin: 45, idleWord: 'posted', missing: LINK, until: YEAR_END },
  { id: 'forecast', name: 'Forecast', look: 'bulb', hue: 'rose', days: [5], at: ['12:10'], graceMin: 45, idleWord: 'all clear' },
  { id: 'renewals', name: 'Renewals', look: 'clipboard', hue: 'amber', days: [4], at: ['06:50'], graceMin: 45, idleWord: 'all clear' },
  { id: 'rundown', name: 'Rundown', look: 'antenna', hue: 'green', days: [1, 2, 3, 4, 5, 6, 7], at: ['20:01'], graceMin: 45, idleWord: 'posted', missing: LINK, until: YEAR_END },
  { id: 'prep', name: 'Prep', look: 'plain', hue: 'blue', days: [5], at: ['12:40'], graceMin: 45, idleWord: 'all clear' },
], 'the seven department agents: Sweeper Monday and Friday 06:50, Accounts Wednesday, Pacing on weekdays 07:45, Forecast Friday 12:10, Renewals Thursday, Rundown every day 20:01, Prep Friday 12:40; 45 minutes of grace each; Pacing and Rundown say for themselves why nothing of them can be read, until the year ends');
const EVERY = C.ROOMS.flatMap((r) => r.agents), DEPT = C.ROOMS.slice(1), SEVEN = DEPT.flatMap((r) => r.agents);
const twice = (list) => list.filter((x, i) => list.indexOf(x) !== i);
eq([twice(EVERY.map((a) => a.id)), twice(C.ROOMS.map((r) => r.id))], [[], []], 'an agent\'s id is its own in every room, and so is a room\'s');
eq(C.ROOMS.map((r) => [twice(r.agents.map((a) => a.look)), twice(r.agents.map((a) => a.hue))]), C.ROOMS.map(() => [[], []]), 'no look and no hue comes twice in a room');
eq(SEVEN.filter((a) => C.ROSTER.some((b) => b.look === a.look && b.hue === a.hue)).map((a) => a.id), [], 'no department robot has the look and the hue of one of his five');
ok(EVERY.every((a) => ['headset', 'gavel', 'antenna', 'bulb', 'clipboard', 'plain'].includes(a.look) && ['teal', 'amber', 'rose', 'violet', 'blue', 'green'].includes(a.hue)), 'every look and hue is one the scene can draw');
ok(C.ROOMS.every((r) => r.agents.length >= 1 && r.agents.length <= 5) && EVERY.every((a) => a.name.length <= 12 && /^[a-z]+$/.test(a.id)), 'a room has one to five agents (a sixth makes the picture taller on a phone); names fit in 12 characters');
// their schedules, on Stockholm's clock
eq(SEVEN.map((a) => runs(a, '2026-11-24T13:08:00Z')), [['2026-11-23T05:50Z', '2026-11-27T05:50Z'], ['2026-11-18T05:50Z', '2026-11-25T05:50Z'], ['2026-11-24T06:45Z', '2026-11-25T06:45Z'], ['2026-11-20T11:10Z', '2026-11-27T11:10Z'], ['2026-11-19T05:50Z', '2026-11-26T05:50Z'], ['2026-11-23T19:01Z', '2026-11-24T19:01Z'], ['2026-11-20T11:40Z', '2026-11-27T11:40Z']],
  'Tuesday 14:08: Sweeper ran on Monday and runs next on Friday, Accounts tomorrow, Pacing this morning, Forecast and Prep last Friday, Renewals last Thursday, Rundown last night');
const DEPT_GAPS = { sweeper: [71, 72, 73, 96], accounts: [167, 168, 169], pacing: [24, 71, 72, 73], forecast: [167, 168, 169], renewals: [167, 168, 169], rundown: [23, 24, 25], prep: [167, 168, 169] };
for (const agent of SEVEN) {
  const seen = new Set();
  for (let t = T('2026-01-01T00:00:00Z'); t < T('2028-01-01T00:00:00Z'); t += 367 * MIN) { const r = C.runsAround(agent, t); seen.add(agent.days.includes(onClock(r.prev).day) && agent.at.includes(onClock(r.prev).hm) && r.prev <= t && t < r.next ? (r.next - r.prev) / HOUR : 'wrong'); }
  eq([...seen].sort((a, b) => a - b), DEPT_GAPS[agent.id], `${agent.id}: through 2026 and 2027 its runs are its own times on its own days, ${DEPT_GAPS[agent.id].join(', ')} hours apart`);
}
// derive for a room: the same rules, for that room's agents only
const [MINE, HYG, ARR, EXEC] = C.ROOMS;
eq([C.derive(REAL, NOW, undefined, C.ROSTER), C.derive(MIXED, T('2026-11-24T07:20:00Z'), { desk: '  Front  desk ' }, MINE.agents)], [real, C.derive(MIXED, T('2026-11-24T07:20:00Z'), { desk: '  Front  desk ' })], 'handed the roster itself, derive gives what it gives without one');
each([undefined, null, 0, 'x', {}, 7, true, () => 1], (v) => C.derive(REAL, NOW, undefined, v), real, 'a roster that is not a list is his five');
eq([[], [null, 3, 'x', {}, { id: 7 }, { id: '' }]].map((v) => C.derive(REAL, NOW, undefined, v)), [1, 2].map(() => ({ crew: [], lines: {}, lead: {}, brief: {}, tips: {}, aria: '', total: 0 })), 'an empty room, or a list with no agent in it, is nobody: nothing thrown');
// one department agent on its own, as `see` does for his five
const seeIn = (room, id, fact, now, pulse) => {
  const r = C.derive({ [id]: fact, pulse: pulse ? { [id]: pulse } : null }, now, null, room.agents), i = room.agents.findIndex((a) => a.id === id);
  return { ...r.crew[i], line: r.lines[id], lead: r.lead[id], brief: r.brief[id], tip: r.tips[id], said: r.aria.split('. ')[i].replace(/\.$/, '').replace(/^.*?: /, ''), total: r.total };
};
const MONDAY = T('2026-11-30T08:12:00Z'); // Monday 30 November, 09:12 here
const SW = { src: 'ok', at: '2026-11-30T05:50:40Z', status: 'ok', waiting: 1, trial: true }; // Sweeper's first run, on trial
const firstWeek = C.derive({ sweeper: SW, accounts: { src: 'missing', at: null, status: '', waiting: 0 }, desk: REAL.desk }, MONDAY, null, HYG.agents);
eq(firstWeek, {
  crew: [{ id: 'sweeper', name: 'Sweeper', look: 'plain', hue: 'green', state: 'needs', waiting: 1, step: '', bubble: '1 for you', fresh: T(SW.at) }, { id: 'accounts', name: 'Accounts', look: 'headset', hue: 'violet', state: 'unknown', waiting: 0, step: '', bubble: '', fresh: 0 }],
  lines: { sweeper: '06:50 · trial · 1 for you', accounts: 'not run yet' }, lead: { sweeper: '06:50', accounts: '' }, brief: { sweeper: 'trial · 1 for you', accounts: 'not run yet' },
  tips: { sweeper: { state: '1 waiting on you. On trial: nothing it prepared can be sent', last: 'Last result 06:50', next: 'Next run Fri 06:50' }, accounts: { state: 'Has not run yet', last: '', next: '' } },
  aria: 'Sweeper: 1 waiting on you, on trial. Accounts: has not run yet.', total: 1,
}, 'Data Hygiene in the first week: Sweeper on trial with one thing for you, Accounts an empty chair that has not run yet; his own Desk is not in this room, nor in its total');
eq(C.derive({ sweeper: SW }, MONDAY, { sweeper: '  The  sweeper ', accounts: 7 }, HYG.agents).crew.map((a) => a.name), ['The sweeper', 'Accounts'], 'a name from the page wins in a room too');
// an agent whose result does not exist: an empty chair, in its own words, and never a word from its schedule
const NONE = { src: 'missing', at: null, status: '', waiting: 3 };
eq(SEVEN.map((a) => { const x = seeIn(C.ROOMS.find((r) => r.agents.includes(a)), a.id, NONE, NOW); return [x.state, x.line, x.lead, x.tip.state, x.tip.last, x.tip.next, x.said, x.bubble, x.total].join('|'); }),
  SEVEN.map((a) => (a.missing ? 'unknown|not linked yet||Runs today and posts by itself. Not linked to the cockpit yet|||not linked yet||0' : 'unknown|not run yet||Has not run yet|||has not run yet||0')),
  'nothing written yet: "not run yet", and for Pacing and Rundown, which run and post by themselves, "not linked yet"; no last result, no next run, nothing counted');
// Pacing's and Rundown's tasks stop with the year, by their own instructions: from then on nothing says that they run
const EVE = T('2026-12-31T22:59:59Z'), NEW_YEAR = T('2026-12-31T23:00:00Z'); // 23:59:59 on 31 December and the midnight after it, in Stockholm
eq(['pacing', 'rundown'].map((id) => [EVE, NEW_YEAR, T('2027-06-01T10:00:00Z')].map((t) => { const x = seeIn(C.ROOMS.find((r) => r.agents.some((a) => a.id === id)), id, NONE, t); return [x.state, x.line, x.tip.state, x.tip.next, x.said].join('|'); })),
  [1, 2].map(() => ['unknown|not linked yet|Runs today and posts by itself. Not linked to the cockpit yet||not linked yet', 'unknown|not linked yet|Not linked to the cockpit yet||not linked yet', 'unknown|not linked yet|Not linked to the cockpit yet||not linked yet']),
  'Pacing and Rundown up to the last second of 31 December 2026: "Runs today and posts by itself"; from midnight on only "Not linked to the cockpit yet", on the chip as before');
const tipOf = (missing, until, t) => seeIn({ agents: [{ id: 'x', name: 'X', look: 'plain', hue: 'green', days: [1], at: ['06:50'], graceMin: 45, idleWord: 'all clear', missing, until }] }, 'x', NONE, t).tip.state;
eq([tipOf(['a', 'B. C', 'C'], YEAR_END, EVE), tipOf(['a', 'B. C', 'C'], YEAR_END, NEW_YEAR), tipOf(['a', 'B. C'], YEAR_END, NEW_YEAR), tipOf(['a', 'B. C', 'C'], undefined, NEW_YEAR), tipOf(['a', 'B. C', '  '], YEAR_END, NEW_YEAR), tipOf(undefined, YEAR_END, NEW_YEAR), tipOf(['a'], YEAR_END, NEW_YEAR)],
  ['B. C', 'C', 'B. C', 'B. C', 'B. C', 'Has not run yet', 'Has not run yet'], 'the sentence changes only from `until` on and only when the entry has a third one; without own words an agent has not run yet, whatever its `until`');
each(['2027-01-01', '2027-01-01T00:00', 'soon', 0, 1, NEW_YEAR, null, {}, [], true, NaN], (v) => tipOf(['a', 'B. C', 'C'], v, T('2030-01-01T00:00:00Z')), 'B. C', 'an `until` that is not a time with its zone ends nothing');
// from `until` on the agent's tooltip entry is marked as stopped: the page then leaves out its sentence on what the
// agent does, which reads as if it still ran (Pacing's and Rundown's say that they post)
const roomWith = (id) => C.ROOMS.find((r) => r.agents.some((a) => a.id === id)), YEARS_ON = T('2030-01-01T00:00:00Z');
eq(['pacing', 'rundown'].map((id) => [EVE, NEW_YEAR].map((t) => seeIn(roomWith(id), id, NONE, t).tip)),
  [1, 2].map(() => [{ state: 'Runs today and posts by itself. Not linked to the cockpit yet', last: '', next: '' }, { state: 'Not linked to the cockpit yet', last: '', next: '', stopped: true }]),
  'up to the last second of 31 December 2026 the tooltip entry of Pacing and of Rundown has its three lines and no more; from midnight on it is marked as stopped');
each(['loading', 'nodb', 'error', 'missing', 'ok'], (src) => [EVE, NEW_YEAR].map((t) => seeIn(ARR, 'pacing', { src, at: '2026-12-30T06:47:00Z', waiting: 0 }, t).tip.stopped), [undefined, true], 'stopped is said from `until` on whatever can be read of the agent, and is not there at all before');
eq(C.ROOMS.map((r) => { const o = C.derive({}, YEARS_ON, null, r.agents); return r.agents.filter((a) => Object.keys(o.tips[a.id]).join() !== 'state,last,next').map((a) => a.id + ': ' + Object.keys(o.tips[a.id]).join()); }), [[], [], ['pacing: state,last,next,stopped'], ['rundown: state,last,next,stopped']],
  'years on, only the two agents with an `until` are marked as stopped: every other agent\'s entry is its three lines, his five\'s among them');
each(['2027-01-01', '2027-01-01T00:00', 'soon', 0, 1, NEW_YEAR, null, {}, [], true, NaN, undefined], (v) => Object.keys(seeIn({ agents: [{ id: 'x', name: 'X', look: 'plain', hue: 'green', days: [1], at: ['06:50'], graceMin: 45, idleWord: 'all clear', missing: ['a', 'B. C', 'C'], until: v }] }, 'x', NONE, YEARS_ON).tip).join(), 'state,last,next', 'an `until` that is not a time with its zone stops nothing');
let schedWords = 0, looked = 0;
for (let t = T('2026-11-20T00:00:00Z'); t < T('2026-12-05T00:00:00Z'); t += 37 * MIN) {
  for (const r of DEPT) { const o = C.derive(Object.fromEntries(r.agents.map((a) => [a.id, NONE])), t, null, r.agents); looked++; if (o.crew.some((a) => a.state !== 'unknown') || /due|no result|Next run|failed/.test(JSON.stringify(o)) || o.total !== 0) schedWords++; }
}
ok(schedWords === 0 && looked > 1500, 'through fifteen days, an agent with nothing written is never due, late or failed, and is promised no run', [schedWords, looked]);
for (const [src, line, tip] of [['loading', '', 'No data yet'], ['nodb', 'no data', 'Can\'t read the database here'], ['error', 'no data', 'Can\'t read the database here']]) {
  const p = seeIn(ARR, 'pacing', { src }, NOW), f = seeIn(ARR, 'forecast', { src }, NOW);
  eq([p.state, p.line, p.tip, f.line, f.tip], ['unknown', line, { state: tip, last: '', next: '' }, line, { state: tip, last: '', next: '' }], `source ${src} in a department: the usual words (an agent's own words are for "missing" only), and no next run either`);
}
eq([see('review', { src: 'missing' }, NOW).tip.next, see('desk', { src: 'nodb' }, NOW).tip.next], ['Next run Mon 07:37', 'Next run 07:13 tomorrow'], 'his own five are still told their next run when nothing can be read: they have run for as long as the cockpit has stood');
const linked = seeIn(ARR, 'pacing', { src: 'ok', at: '2026-11-24T06:47:00Z', waiting: 0 }, NOW);
eq([linked.state, linked.line, linked.tip], ['idle', '07:47 · posted', { state: 'Nothing waiting on you', last: 'Last result 07:47', next: 'Next run 07:45 tomorrow' }], 'once Pacing can be read it is an agent like any other: idle, "posted", and its next run');
// on trial: said where the last result is shown, as "partial" is
const trial = seeIn(HYG, 'sweeper', SW, MONDAY), trialClear = seeIn(HYG, 'sweeper', { ...SW, waiting: 0 }, MONDAY);
eq([trial.state, trial.line, trial.lead, trial.brief, trial.bubble, trial.tip, trial.said], ['needs', '06:50 · trial · 1 for you', '06:50', 'trial · 1 for you', '1 for you', { state: '1 waiting on you. On trial: nothing it prepared can be sent', last: 'Last result 06:50', next: 'Next run Fri 06:50' }, '1 waiting on you, on trial'], 'on trial with something waiting: "trial" before the count, and the tooltip says what the trial means');
eq([trialClear.state, trialClear.line, trialClear.brief, trialClear.tip.state, trialClear.said], ['idle', '06:50 · trial', 'trial', 'Nothing waiting on you. On trial: nothing it prepared can be sent', 'nothing waiting, on trial'], 'on trial with nothing waiting: "trial" in place of "all clear"');
eq([seeIn(HYG, 'sweeper', { ...SW, status: 'partial' }, MONDAY).line, seeIn(HYG, 'sweeper', { ...SW, status: 'partial', waiting: 0 }, MONDAY).line, seeIn(HYG, 'sweeper', { ...SW, status: 'partial' }, MONDAY).said], ['06:50 · partial · trial · 1 for you', '06:50 · partial · trial', '1 waiting on you, last run partial, on trial'], 'partial and on trial: both are said, partial first');
const trialDue = seeIn(HYG, 'sweeper', SW, T('2026-12-04T05:55:00Z')), trialLate = seeIn(HYG, 'sweeper', SW, T('2026-12-04T07:00:00Z')), trialBusy = seeIn(HYG, 'sweeper', SW, MONDAY, beat('running', MONDAY - 2 * MIN, { step: 'Counting deals' })), trialFailed = seeIn(HYG, 'sweeper', { ...SW, status: 'failed' }, MONDAY);
eq([trialDue.line, trialDue.tip.state, trialLate.line, trialLate.tip.state, trialBusy.line, trialBusy.tip.state, trialFailed.line, trialFailed.tip.state],
  ['due 06:50 · 1 for you', 'A run was due at 06:50. No result yet. 1 still waiting on you. On trial: nothing it prepared can be sent', 'no result 06:50 · 1 for you', 'No result from the 06:50 run. 1 still waiting on you. On trial: nothing it prepared can be sent',
    'working · Counting deals', 'Working now: Counting deals. 1 still waiting on you. On trial: nothing it prepared can be sent', 'failed 06:50 · 1 for you', 'The last run failed. 1 still waiting on you. On trial: nothing it prepared can be sent'],
  'Friday 06:55 and 08:00 with Monday\'s result only: Sweeper is due, then has no result, like any agent whose result exists; while due, late, working or failed the chip does not say "trial", the tooltip still does');
each(['true', 1, 'yes', {}, [true], null, undefined, false], (v) => { const a = seeIn(HYG, 'sweeper', { ...SW, trial: v }, MONDAY); return [a.line, a.tip.state, a.said]; }, ['06:50 · 1 for you', '1 waiting on you', '1 waiting on you'], 'only the value true itself marks a trial');
each(['loading', 'nodb', 'error', 'missing'], (src) => /trial/i.test(JSON.stringify(seeIn(HYG, 'sweeper', { ...SW, src }, MONDAY))), false, 'a result that could not be read says nothing of a trial');
const deskTrial = see('desk', { ...FRESH, trial: true }, NOW);
eq([deskTrial.line, deskTrial.tip.state, flaws(C.derive({ ...REAL, desk: { ...REAL.desk, trial: true } }, NOW))], ['13:15 · trial · 113 for you', '113 waiting on you. On trial: nothing it prepared can be sent', []], 'the rule is the same for any agent: one of his five on trial would say so too');
// a room's total is its own; nothing is kept or changed
const everything = { ...REAL, sweeper: SW, forecast: { src: 'ok', at: '2026-11-27T11:10:30Z', waiting: 2 }, prep: { src: 'ok', at: '2026-11-27T11:40:30Z', waiting: 4 } };
eq(C.ROOMS.map((r) => C.derive(everything, MONDAY, null, r.agents).total), [135, 1, 2, 4], 'each room counts what waits at its own agents');
eq(C.ROOMS.map((r) => { const o = C.derive(everything, MONDAY, null, r.agents); return [o.crew.map((a) => a.id), Object.keys(o.lines), Object.keys(o.lead), Object.keys(o.brief), Object.keys(o.tips), o.aria.split('. ').length]; }), C.ROOMS.map((r) => { const ids = r.agents.map((a) => a.id); return [ids, ids, ids, ids, ids, ids.length]; }), 'a room\'s crew, lines, tooltips and sentence are its own agents\', in desk order');
const rooms = JSON.stringify(C.ROOMS);
C.ROOMS.forEach((r) => C.derive(everything, MONDAY, { sweeper: 'x' }, r.agents));
ok(JSON.stringify(C.ROOMS) === rooms, 'derive leaves the rooms as they are');
each(SEVEN.map((a) => a.id), (id) => C.overdue(id, null, NOW), null, 'overdue stays his five\'s: it is what the Hub pane\'s run line asks about Desk');
ok(page.window.OSCrew.ROOMS.length === 4 && page.window.OSCrew.ROOMS[0].agents === page.window.OSCrew.ROSTER, 'as a plain script in a page it has the rooms too');
// junk for a department's facts: the same promise as for his five
const tameRoom = (r, v) => {
  try {
    const o = C.derive({ [r.agents[0].id]: v, [r.agents[1].id]: { src: v, at: v, status: v, waiting: v, trial: v, parts: v }, pulse: { [r.agents[0].id]: v } }, NOW, v, r.agents);
    return o.crew.length === r.agents.length && o.crew.every((a, i) => a.id === r.agents[i].id && STATES.includes(a.state) && Number.isInteger(a.waiting)) && Number.isInteger(o.total) && !LEAK.test(JSON.stringify([o.lines, o.lead, o.brief, o.tips, o.aria]));
  } catch (e) { return false; }
};
eq(DEPT.map((r) => JUNK.filter((v) => !tameRoom(r, v)).map(show)), [[], [], []], 'junk for a department agent\'s entry, for each of its fields, its heartbeat and the names: nothing thrown, every agent in place, no stray word');

// ---------- browsers that are not this one ----------
// a fresh copy of the model, loaded and used while Intl.DateTimeFormat is replaced by a stand-in
const RealFormat = Intl.DateTimeFormat;
const withIntl = (standIn, use) => {
  Intl.DateTimeFormat = standIn;
  delete require.cache[require.resolve(FILE)];
  try { return use(require(FILE)); } catch (e) { return 'threw ' + String(e && e.message); } finally { Intl.DateTimeFormat = RealFormat; globalThis.OSCrew = C; }
};
// one that knows no time zones: there is no schedule, so nothing is due, late or overdue, and everything else still works
const blind = withIntl(function () { throw new RangeError('Invalid time zone specified: Europe/Stockholm'); }, (M) => ({
  runs: M.runsAround(M.ROSTER[0], NOW),
  overdue: M.overdue('desk', null, NOW),
  early: M.derive(EARLY, T('2026-11-24T13:05:00Z')),
  bare: M.derive({ desk: { src: 'ok', at: null, status: 'failed', waiting: 3 }, decide: { src: 'ok', at: null, waiting: 3 }, instinct: { src: 'ok', at: null, waiting: 0 }, muse: { src: 'ok', at: null, waiting: 0 }, pulse: { muse: beat('error', NOW - 5 * MIN, { finishedAt: iso(NOW - MIN) }) } }, NOW),
}));
eq([blind.runs, blind.overdue], [{ prev: null, next: null }, null], 'a browser with no time zones: no scheduled runs, nothing overdue, and nothing thrown');
eq([flaws(blind.early), blind.early.crew.map((a) => a.state), blind.early.lines.desk, blind.early.tips.desk], [[], ['needs', 'needs', 'needs', 'needs', 'idle'], '07:15 · 113 for you', { state: '113 waiting on you', last: 'Last result 07:15', next: '' }], 'there, nobody is due or late and no next run is promised; the rest reads as usual');
eq([flaws(blind.bare), blind.bare.lines, blind.bare.lead], [[], { desk: 'failed · 3 for you', decide: '3 for you', instinct: 'all clear', muse: 'failed 14:07', review: '' }, { desk: '', decide: '', instinct: '', muse: '', review: '' }], 'with no time to show, a line is its words alone; a run that died is still an error');
// one that writes midnight as 24:00 (some have, when asked for a 24-hour clock): the hour after midnight must not land on the next day
const NIGHTS = ['2026-11-23T23:00:00Z', '2026-11-23T23:30:00Z', '2026-11-22T23:59:00Z', '2026-06-30T22:15:00Z', '2026-11-24T13:08:00Z'].map(T);
const twentyFour = function (locale, options) { const f = new RealFormat(locale, options); return { formatToParts: (d) => f.formatToParts(d).map((x) => (x.type === 'hour' && +x.value === 0 ? { type: 'hour', value: '24' } : x)) }; };
eq(withIntl(twentyFour, (M) => NIGHTS.map((t) => M.ROSTER.map((a) => M.runsAround(a, t)))), NIGHTS.map((t) => C.ROSTER.map((a) => C.runsAround(a, t))), 'a browser that calls midnight 24:00 finds the same runs, in the hour after midnight too');

// ---------- other viewers: the schedule stays in Stockholm, the words follow the viewer ----------
const MOMENTS = ['2026-11-24T13:08:00Z', '2026-11-24T03:00:00Z', '2026-07-01T12:00:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-10-27T12:20:00Z', '2027-03-28T00:30:00Z', '2027-03-29T06:00:00Z', '2026-11-22T23:00:00Z', '2026-11-29T22:59:59Z'];
const PROBE = `
  const C = require(${JSON.stringify(FILE)}), T = Date.parse, REAL = ${JSON.stringify(REAL)}, EARLY = ${JSON.stringify(EARLY)}, YESTERDAY = { desk: { src: 'ok', at: '2026-11-23T12:15:58Z', status: 'ok', waiting: 113 } };
  const brief = (r) => ({ states: r.crew.map((a) => a.state), lines: r.lines, bubble: r.crew[0].bubble, last: r.tips.desk.last, next: r.tips.desk.next, instinctNext: r.tips.instinct.next, reviewLast: r.tips.review.last, reviewNext: r.tips.review.next, total: r.total, fresh: r.crew.map((a) => a.fresh) });
  process.stdout.write(JSON.stringify({
    clock: new Date(2026, 10, 24, 12, 0).toISOString(),
    runs: ${JSON.stringify(MOMENTS)}.map((m) => C.ROSTER.map((a) => C.runsAround(a, T(m)))),
    overdue: C.overdue('desk', EARLY.desk.at, T('2026-11-24T13:05:00Z')),
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
eq([here.overdue, ny.overdue, india.overdue], [RUN13, RUN13, RUN13], 'and the same run is overdue for everyone');
eq([ny.real.states, ny.real.total, ny.real.fresh, india.real.states, india.real.total], [here.real.states, 135, here.real.fresh, here.real.states, 135], 'real example elsewhere: the same states, total and times');
eq(ny.real.lines, { desk: '07:15 · 113 for you', decide: '01:44 · 10 decisions, 7 for Leo', instinct: '02:30 · 3 for you', muse: '02:30 · 2 for you', review: 'Mon 01:46 · posted' }, 'New York: the chip lines are on New York\'s clock, six hours behind');
eq([ny.real.last, ny.real.next, ny.real.instinctNext, ny.real.reviewLast, ny.real.reviewNext], ['Last result 07:15', 'Next run 01:13 tomorrow', 'Next run 10:07', 'Last result yesterday 01:46', 'Next run Mon 01:37'], 'New York: and so are the tooltips (Instinct\'s 16:07 run reads 10:07 there)');
eq(india.real.lines, { desk: '17:45 · 113 for you', decide: '12:14 · 10 decisions, 7 for Leo', instinct: '13:00 · 3 for you', muse: '13:00 · 2 for you', review: 'Mon 12:16 · posted' }, 'Kolkata: four and a half hours ahead');
eq([india.real.next, india.real.instinctNext, india.real.reviewNext], ['Next run 11:43 tomorrow', 'Next run 20:37', 'Next run Mon 12:07'], 'Kolkata: the next runs');
eq([here.due.states[0], here.due.lines.desk, ny.due.states[0], ny.due.lines.desk, ny.due.bubble, india.due.states[0], india.due.lines.desk], ['due', 'due 13:13 · 113 for you', 'due', 'due 07:13 · 113 for you', 'Run due 07:13', 'due', 'due 17:43 · 113 for you'], 'Desk is due at the same moment for everyone; the 13:13 run reads 07:13 in New York and 17:43 in Kolkata');
eq([here.late.lines.desk, ny.late.lines.desk, india.late.lines.desk], ['no result 13:13 · 113 for you', 'no result 07:13 · 113 for you', 'no result 17:43 · 113 for you'], 'and late at the same moment');
eq([here.night.lines.desk, here.night.last, here.night.next], ['Mon 13:15 · 113 for you', 'Last result yesterday 13:15', 'Next run 07:13'], 'Tuesday 04:00 in Stockholm: the result is yesterday\'s, the run is today');
eq([ny.night.lines.desk, ny.night.last, ny.night.next, ny.night.states[0]], ['07:15 · 113 for you', 'Last result 07:15', 'Next run 01:13 tomorrow', 'needs'], 'the same moment is still Monday in New York: the result is today\'s, the run tomorrow');
eq([here.october.lines.desk, ny.october.lines.desk, ny.october.states[0]], ['due 13:13 · 1 for you', 'due 08:13 · 1 for you', 'due'], 'the week Europe has changed its clocks and America has not: five hours apart, same run');

done();
