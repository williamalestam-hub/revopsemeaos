const calcs = {};
global.dash = { loader: () => {}, calc: (id, o) => { calcs[id] = o; }, params: () => ({}), setParams: () => {}, onData: () => {}, draw: () => {}, colors: [], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.window = global; global.location = { hash: '' }; global.document = { querySelectorAll: () => [], addEventListener: () => {} };
require('/home/user/revopsemeaos/dashboard/os-calcs.js');
require('../pending/book_moves.js');
const bo = [
  ['A', 'AE-EMEA-FR', 40], ['B', 'AE-EMEA-FR', 12], ['C', 'AE-EMEA-FR', 10], ['D', 'AE-EMEA-FR', 3], ['E', 'AE-EMEA-FR', 2], ['F', 'AE-EMEA-FR', 11],
  ['G', 'SMB-EMEA', 100], ['H', 'SMB-EMEA', 50], ['I', 'SMB-EMEA', 45],
].map(([owner, role, active]) => ({ owner, role, manager: 'M', active: true, accounts: active, status: 'Customer' }));
const bk_owner = bo.map((r) => ({ owner: r.owner, role: r.role, manager: 'M', active: true, status: 'Customer', accounts: r.accounts, arrUsd: 0 }));
const books_owner = calcs.books_owner.fn(bk_owner, [], []);
console.log(books_owner.map((r) => r.owner + ':' + r.active + ':' + r.teamMedian + ':' + r.balance).join(' '));
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const moves = calcs.book_moves.fn(books_owner, [{ name: 'E', startDate: day(30), createdDate: day(35) }, { name: 'D', startDate: null, createdDate: day(400) }]);
for (const m of moves) console.log(m.region, m.from, '->', m.to, m.accounts, `${m.fromBefore}->${m.fromAfter}`, `${m.toBefore}->${m.toAfter}`, 'new', m.toNew);
