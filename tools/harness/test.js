const loaders = {}, calcs = {};
global.dash = { loader: (id, o) => { loaders[id] = o; }, calc: (id, o) => { calcs[id] = o; }, params: () => ({}), setParams: () => {}, onData: () => {}, draw: () => {}, colors: [], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.window = global; global.location = { hash: '' };
global.document = { querySelectorAll: () => [], addEventListener: () => {} };
global.d3 = { format: () => (v) => String(v), utcFormat: () => (d) => d.toISOString() };
require('/home/user/revopsemeaos/dashboard/os-core.js');
require('/home/user/revopsemeaos/dashboard/os-calcs.js');
const list1 = `<requested_range time_range="custom">x</requested_range>
<meetings_data connected_user_email="jo.doe@example.com" count="2">
<meeting id="m1" title="Jo / Sam &lt;&gt; Weekly" date="Nov 3" meeting_at="2026-11-03T14:00:00.000+01:00" captured_by_me="true" listed_as_participant="true" url="https://notes.granola.ai/d/m1">
  <known_participants>x</known_participants><folders /></meeting>
</meetings_data>
<pagination has_more="true" total_count="2" remaining_count="1" next_cursor="CUR1" />`;
const list2 = `<meetings_data count="1">
<meeting id="m2" title="Team sync" date="Oct 30" meeting_at="2026-10-30T10:00:00.000+01:00" captured_by_me="false" listed_as_participant="true" url="https://notes.granola.ai/d/m2"><folders /></meeting>
</meetings_data>
<pagination has_more="false" total_count="2" remaining_count="0" />`;
const notes = `<connected_user_email>jo.doe@example.com</connected_user_email>
<meetings_data from="Oct 30" to="Nov 3" count="2">
<meeting id="m1" title="Jo / Sam &lt;&gt; Weekly" meeting_at="2026-11-03T14:00:00.000+01:00" url="https://notes.granola.ai/d/m1">
  <private_notes>- [ ] Send the deck to Sam
- normal private bullet
- TODO: chase legal</private_notes>
  <transcript available="true">The summary below is a condensed overview</transcript>
  <summary>
# Topic A

- Plan to move to pods
  - sub bullet
- Cost is \\~20 accounts

# Next Steps

- **Share EMEA SMB ARR breakdown**

  Pull together the TAM figures and send them over.
- **Create pools and enable booking** (Sam Smith)

  Create pools, add members, toggle &quot;direct booking&quot;.
- **Raise restructure with US directors (Jo)**

  Raise as an agenda point.
- **Review forecast app** (Jo Doe, Sam)
- Jo: follow up with finance
</summary>
</meeting>
<meeting id="m2" title="Team sync" meeting_at="2026-10-30T10:00:00.000+01:00" url="https://notes.granola.ai/d/m2">
  <private_notes status="empty" />
  <summary>
## Action Items
- Update the routing sheet (Alex)
- Confirm budget
</summary>
</meeting>
</meetings_data>`;
(async () => {
  const calls = [];
  const call = async (tool, args) => { calls.push([tool, JSON.stringify(args)]); return tool === 'search_meetings' ? list2 : notes; };
  const res = await loaders.gr_notes.fn({ answer: list1, call, args: { from_date: '2026-10-04', to_date: '2026-11-03' } });
  console.log('calls', calls.map((c) => c[0] + ' ' + c[1].slice(0, 80)));
  console.log('rows', res.rows.length);
  for (const r of res.rows) console.log(' ', r.id, '|', r.section, '|', String(r.text == null ? '' : r.text).slice(0, 50), '|', String(r.detail == null ? '' : r.detail).slice(0, 40));
  // gr_me was folded into gr_notes in a later build; gr_actions reads gr_notes only
  const me = loaders.gr_me ? loaders.gr_me.fn({ answer: JSON.stringify({ email: 'jo.doe@example.com', workspaces: [] }) }) : { rows: [] };
  const acts = calcs.gr_actions.fn(res.rows, me.rows);
  console.log('actions');
  for (const a of acts) console.log(' ', a.bucket, a.forYou ? 'FORYOU' : '', '|', a.item, '|', a.owner, '|', a.meeting, a.date, a.shared ? 'shared' : '', a.done ? 'done' : '');
  console.log(calcs.gr_kpi.fn(acts));
  // empty window
  const empty = await loaders.gr_notes.fn({ answer: '<meetings_data count="0"></meetings_data><pagination has_more="false" />', call, args: {} });
  console.log('empty rows', empty.rows.length);
  try { await loaders.gr_notes.fn({ answer: 'Error: unauthorized', call, args: {} }); } catch (e) { console.log('error ok:', e.message); }
})();
