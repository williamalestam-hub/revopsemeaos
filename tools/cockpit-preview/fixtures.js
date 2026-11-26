// Synthetic crews for the cockpit preview and tests. No real data: names, counts and times are made up.
// A fixture is { clock: local wall-clock time the scene should show (ms since epoch), crew: [...], script?: [{ at: ms into the run, crew: [...] }] }.
// A crew member is what OSCrew.derive() hands the scene (see dashboard/os-cockpit-model.js).
(function (root) {
  const at = (h, m, day) => new Date(2026, 10, day || 24, h, m, 0).getTime(); // local time, Tue 24 Nov 2026 unless a day is given
  const A = (id, name, look, hue, state, extra) => Object.assign({ id, name, look, hue, state, waiting: 0, step: '', bubble: '', fresh: 0 }, extra || {});
  const five = (s) => [
    A('desk', 'Desk', 'headset', 'teal', s[0][0], s[0][1]),
    A('decide', 'Decide', 'gavel', 'amber', s[1][0], s[1][1]),
    A('instinct', 'Instinct', 'antenna', 'rose', s[2][0], s[2][1]),
    A('muse', 'Muse', 'bulb', 'violet', s[3][0], s[3][1]),
    A('review', 'Review', 'clipboard', 'blue', s[4][0], s[4][1]),
  ];
  const F = {
    // an ordinary morning: four agents wait on you, one is done
    morning: { clock: at(8, 31), crew: five([['needs', { waiting: 113 }], ['needs', { waiting: 17 }], ['needs', { waiting: 3 }], ['needs', { waiting: 2 }], ['idle', {}]]) },
    // a run in progress (heartbeat), one run due, the rest done
    running: { clock: at(7, 14), crew: five([['working', { step: 'Reading Slack' }], ['due', { bubble: 'Run due 07:43' }], ['idle', {}], ['idle', {}], ['idle', {}]]) },
    // nothing needs you
    clear: { clock: at(15, 0), crew: five([['idle', {}], ['idle', {}], ['idle', {}], ['idle', {}], ['idle', {}]]) },
    // things going wrong
    trouble: { clock: at(13, 50), crew: five([['late', { bubble: 'No result 13:13' }], ['error', { bubble: 'Run failed' }], ['unknown', {}], ['idle', {}], ['needs', { waiting: 1 }]]) },
    // late evening
    night: { clock: at(22, 30), crew: five([['needs', { waiting: 4 }], ['idle', {}], ['idle', {}], ['idle', {}], ['idle', {}]]) },
    // the smaller crew of three
    three: { clock: at(11, 40), crew: [A('desk', 'Desk', 'headset', 'teal', 'needs', { waiting: 4 }), A('instinct', 'Instinct', 'antenna', 'rose', 'working', { step: 'Asking Salesforce' }), A('muse', 'Muse', 'bulb', 'violet', 'idle', {})] },
    // eight agents, to stress the layout
    eight: { clock: at(10, 5), crew: ['teal', 'amber', 'rose', 'violet', 'blue', 'green', 'teal', 'amber'].map((hue, i) => A('a' + i, ['Desk', 'Decide', 'Instinct', 'Muse', 'Review', 'Scout', 'Ledger', 'Relay'][i], ['headset', 'gavel', 'antenna', 'bulb', 'clipboard', 'plain', 'headset', 'antenna'][i], hue, ['needs', 'working', 'idle', 'needs', 'due', 'idle', 'late', 'needs'][i], { waiting: [12, 0, 0, 3, 0, 0, 0, 120][i], step: i === 1 ? 'Writing lines' : '' })) },
    // nobody home: the database can't be read
    empty: { clock: at(9, 0), crew: five([['unknown', {}], ['unknown', {}], ['unknown', {}], ['unknown', {}], ['unknown', {}]]) },
  };
  // a morning that gets cleared: after 3 s everything is handled and the agents leave your desk
  F.cleared = { clock: at(8, 31), crew: F.morning.crew, script: [{ at: 3000, crew: F.clear.crew }] };
  // a run finishing while you watch: Desk works, then comes over with 5 new items
  F.handover = { clock: at(13, 14), crew: five([['working', { step: 'Writing lines' }], ['idle', {}], ['idle', {}], ['idle', {}], ['idle', {}]]),
    script: [{ at: 2500, crew: five([['needs', { waiting: 5, fresh: at(13, 15), bubble: '5 for you' }], ['idle', {}], ['idle', {}], ['idle', {}], ['idle', {}]]) }] };
  // The departments' rooms, as a door of the cockpit shows them on the same canvas (the agents of ROOMS in
  // dashboard/os-cockpit-model.js). An agent that has not run yet is an empty chair.
  const hygiene = (s) => [A('sweeper', 'Sweeper', 'plain', 'green', s[0][0], s[0][1]), A('accounts', 'Accounts', 'headset', 'violet', s[1][0], s[1][1])];
  const arr = (s) => [A('pacing', 'Pacing', 'gavel', 'teal', s[0][0], s[0][1]), A('forecast', 'Forecast', 'bulb', 'rose', s[1][0], s[1][1]), A('renewals', 'Renewals', 'clipboard', 'amber', s[2][0], s[2][1])];
  const exec = (s) => [A('rundown', 'Rundown', 'antenna', 'green', s[0][0], s[0][1]), A('prep', 'Prep', 'plain', 'blue', s[1][0], s[1][1])];
  // Data Hygiene in its first week (Monday 30 Nov): Sweeper on trial with its ask, Accounts not started
  F.hygiene = { clock: at(9, 12, 30), crew: hygiene([['needs', { waiting: 1 }], ['unknown', {}]]) };
  // ARR once all three run (Friday 27 Nov, after Forecast's run): Forecast has something for you
  F.arr = { clock: at(12, 22, 27), crew: arr([['idle', {}], ['needs', { waiting: 1 }], ['idle', {}]]) };
  // Executive in the evening: Rundown is writing its post, Prep not started
  F.exec = { clock: at(20, 2), crew: exec([['working', { step: 'Writing the post' }], ['unknown', {}]]) };
  // the doors: his five, then a click on each door in turn (a whole new crew each time), and back to his five
  F.doors = { clock: at(9, 12, 30), crew: F.morning.crew, script: [{ at: 3000, crew: F.hygiene.crew }, { at: 6000, crew: F.arr.crew }, { at: 9000, crew: F.exec.crew }, { at: 12000, crew: F.morning.crew }] };
  if (typeof module !== 'undefined' && module.exports) module.exports = F; else root.CK_FIXTURES = F;
})(typeof window !== 'undefined' ? window : globalThis);
