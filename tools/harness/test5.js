const calcs = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, params: () => ({}), setParams: () => {}, onData: () => {}, draw: () => {}, colors: [], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.window = global; global.location = { hash: '' }; global.document = { querySelectorAll: () => [], addEventListener: () => {} };
global.d3 = { format: () => (v) => String(v), utcFormat: () => (d) => String(d) }; global.requestAnimationFrame = (f) => f();
require('/home/user/revopsemeaos/dashboard/os-calcs.js');
const mk = (pos, text, kind = 'bullet', depth = 0, gap = false) => ({ id: 'm:' + pos, meetingId: 'm', meeting: 'T', meetingAt: '2026-10-28T10:00:00.000+01:00', url: 'u', capturedByMe: true, participants: 2, me: 'jo.doe@x.com', myName: 'Jo Doe', source: 'summary', section: 'Next Steps', parentSection: '', pos, kind, depth, gap, text });
const rows = [
  mk(0, '**Send the deck by Friday** (Jo)'), mk(1, '**Share plan next week**'), mk(2, '**Book QBR**'), mk(3, '  Do it by 30 Oct', 'text', 1, true),
  mk(4, 'Chase legal in two weeks'), mk(5, '**Close out** EOM'), mk(6, '**Pricing review** today'), mk(7, '**Update deck by 5/11**'), mk(8, '**Plan for Dec 15**'),
];
for (const a of calcs.gr_actions.fn(rows)) console.log(a.item.padEnd(28), '| due', String(a.due).padEnd(10), '| left', String(a.daysLeft).padEnd(4), '|', a.dueStatus, '| 1:1', a.oneOnOne);
console.log(calcs.gr_kpi.fn(calcs.gr_actions.fn(rows)));
