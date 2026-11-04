const calcs = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, params: () => ({}), setParams: () => {}, onData: () => {}, draw: () => {}, colors: [], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.window = global; global.location = { hash: '' }; global.document = { querySelectorAll: () => [], addEventListener: () => {} };
require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js');
const mk = (pos, text) => ({ id: 'm:' + pos, meetingId: 'm', meeting: 'T', meetingAt: '2026-10-30T10:00:00.000+01:00', url: 'u', capturedByMe: true, participants: 2, emails: '', me: 'jo@x.com', myName: 'Jo Doe', source: 'summary', section: 'Next Steps', parentSection: '', pos, kind: 'bullet', depth: 0, gap: false, text });
const items = ['**Prepare 2 decks for the board**', '**Decrease 10 seats on the renewal**', '**Mark 3 accounts as churned**', '**Agree margin 15% floor**', '**Send by 30 Oct**', '**Send by Dec 5**', '**Review by Friday**', '**Wrap this week**', '**Call on 3 March**', '**May 5 kickoff**', '**top 5 marketing assets**', '**Junior 2 onboarding**'];
for (const a of calcs.gr_actions.fn(items.map((t, i) => mk(i, t)))) console.log(a.item.padEnd(34), '| due', a.due);
