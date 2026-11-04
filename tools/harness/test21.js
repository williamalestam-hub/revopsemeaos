// Which calcs fail when an optional source fails (the runtime fails a calc when any input fails).
const calcs = {};
global.dash = { calc: (id, o) => { calcs[id] = o.inputs; }, loader: () => {} };
require('/home/user/revopsemeaos/dashboard/os-calcs.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-leads.js'); require('/home/user/revopsemeaos/dashboard/os-calcs-act.js');
const memo = {};
const deep = (id) => { if (memo[id]) return memo[id]; if (!calcs[id]) return (memo[id] = new Set([id])); const s = new Set(); for (const i of calcs[id]) for (const x of deep(i)) s.add(x); return (memo[id] = s); };
const CASES = { 'LeanData': ['rr_members', 'rr_assign'], 'Lead': ['lv_leads', 'ld_ready', 'ld_handoffs', 'ld_inflow', 'ld_open'], 'HiBob': ['hb_people'], 'Granola': ['gr_notes'], 'Calendar': ['cal_events'] };
const CORE = ['person', 'checks', 'team_tree', 'oo_points', 'leavers_core', 'person_hb', 'checks_hb', 'people_core', 'pipe_team', 'deal_list', 'bookings'];
let fails = 0;
for (const [k, ds] of Object.entries(CASES)) {
  const down = Object.keys(calcs).filter((c) => ds.some((d) => deep(c).has(d)));
  const hitCore = CORE.filter((c) => down.includes(c) && !(k === 'HiBob' && /hb|people_core/.test(c)));
  console.log(k.padEnd(9), 'takes down', down.length, 'calcs:', down.join(', '));
  if (hitCore.length) { fails++; console.log('  FAIL core calcs down:', hitCore.join(', ')); }
}
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
