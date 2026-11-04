const loaders = {}, calcs = {};
global.dash = { loader: (id, o) => { loaders[id] = o; }, calc: (id, o) => { calcs[id] = o; }, params: () => ({}), setParams: () => {}, onData: () => {}, draw: () => {}, colors: [], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.window = global; global.location = { hash: '' }; global.document = { querySelectorAll: () => [], addEventListener: () => {} };
global.d3 = { format: () => (v) => String(v), utcFormat: () => (d) => String(d) }; global.requestAnimationFrame = (f) => f();
require('/home/user/revopsemeaos/dashboard/os-core.js'); require('/home/user/revopsemeaos/dashboard/os-calcs.js');
const list = `<meetings_data connected_user_email="jo.doe@example.com" count="1"><meeting id="m1" title="T" meeting_at="2026-11-03T10:00:00.000+01:00" captured_by_me="true" url="https://notes.granola.ai/d/m1"><known_participants>
    Jo Doe (note creator) from Org (jo.doe@example.com)
    </known_participants></meeting></meetings_data><pagination has_more="false" />`;
const sum = `**Next Steps**\n\n**Jo Doe**\n- Send the deck\n\n**Sam**\n- Book the call\n\n# Other\n\nAction Items:\nJo Doe:\n- Chase legal\nSam:\n- Share notes\n\n# Next steps\n- Me: send the recap\n- **Send pricing** (Me)`;
const notes = `<meetings_data count="1"><meeting id="m1" title="T" meeting_at="2026-11-03T10:00:00.000+01:00" url="u"><private_notes>TODO: Me to chase finance</private_notes><summary>\n${sum}\n</summary></meeting></meetings_data>`;
(async () => {
  const res = await loaders.gr_notes.fn({ answer: list, call: async () => notes, args: {} });
  for (const r of res.rows) console.log('  row', r.section.padEnd(12), '|', r.parentSection.padEnd(24), '|', r.text);
  for (const a of calcs.gr_actions.fn(res.rows)) console.log((a.bucket + (a.forYou ? '*' : '')).padEnd(12), a.item.padEnd(22), String(a.owner));
})();
