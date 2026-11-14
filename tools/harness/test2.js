const loaders = {}, calcs = {};
global.dash = { loader: (id, o) => { loaders[id] = o; }, calc: (id, o) => { calcs[id] = o; }, params: () => ({}), setParams: () => {}, onData: () => {}, draw: () => {}, colors: [], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.window = global; global.location = { hash: '' };
global.document = { querySelectorAll: () => [], addEventListener: () => {} };
global.d3 = { format: () => (v) => String(v), utcFormat: () => (d) => d.toISOString() };
global.requestAnimationFrame = (f) => f();
require('/home/user/revopsemeaos/dashboard/os-core.js');
require('/home/user/revopsemeaos/dashboard/os-calcs.js');
const listPage = (ms, more) => `<requested_range time_range="custom">x</requested_range>
<meetings_data connected_user_email="jo.doe@example.com" workspace_name="W" count="${ms.length}">
${ms.map((m) => `<meeting id="${m.id}" title="${m.title}" date="x" meeting_at="${m.at}" captured_by_me="${m.mine}" listed_as_participant="true" url="https://notes.granola.ai/d/${m.id}">
    <known_participants total="2" omitted="1">
    ${m.mine ? 'Jo Doe (note creator) from Org (jo.doe@example.com)' : 'Sam Smith (note creator) from Org (sam@example.com)'}
    </known_participants>
    <folders />
  </meeting>`).join('\n')}
</meetings_data>
<pagination has_more="${more ? 'true' : 'false'}" total_count="9" remaining_count="0"${more ? ' next_cursor="CUR"' : ''} />`;
const notesFor = (ms) => `<connected_user_email>jo.doe@example.com</connected_user_email>
<meetings_data from="x" to="y" count="${ms.length}">
${ms.map((m) => `<meeting id="${m.id}" title="${m.title}" meeting_at="${m.at}" url="https://notes.granola.ai/d/${m.id}">
  ${m.priv ? `<private_notes>${m.priv}</private_notes>` : '<private_notes status="empty" />'}
  <transcript available="true">The summary below is a condensed overview</transcript>
  ${m.sum != null ? `<summary>\n${m.sum}\n</summary>` : ''}
</meeting>`).join('\n')}
</meetings_data>`;
const M = [
  { id: 'm1', title: 'Jo / Sam &lt;&gt; Weekly &#x27;26', at: '2026-11-03T14:00:00.000+01:00', mine: true,
    sum: `# Topic A\n\n- Plan to move to pods\n  - sub bullet\n\n# Next Steps\n\n- **Share EMEA SMB ARR breakdown**\n\n  Pull together the TAM figures and send them over.\n\n  Second paragraph of detail.\n- **Create pools and enable booking** (Sam Smith)\n\n  Create pools, toggle &quot;direct booking&quot;.\n- **Get clarity on forecast app status (Jillian)**\n\n  1:1 with Jillian today will clarify.\n- **Review forecast app** (Jo Doe, Sam)\n- Jo: follow up with finance\n- **Sam Smith**: book the call\n- **Jillian:** send the deck\n- **Update pricing page** (by Friday)\n- **Send contract** (TBD)\n- Pricing: send the updated quote (Sam)\n- Update the routing sheet (Alex).\n- Send deck (Šimon Novák)\n- Prepare the EMEA forecast (Q4)\n- Richard to create pools\n- Review [the deck](https://x.y/z) *before* Friday`,
    priv: `TODO: chase legal\n[ ] book QBR\n- [x] done thing\nFollow up with finance\njust a thought` },
  { id: 'm2', title: 'Team sync', at: '2026-10-30T10:00:00.000+01:00', mine: false,
    sum: `## Action Items\n- Update the routing sheet (Alex)\n- Confirm budget\n\n**Next Steps**\n\n- Send deck (Sam)\n\nAction Items:\n- Book QBR (W. Doe)` },
  { id: 'm3', title: 'Grouped owners', at: '2026-10-29T10:00:00.000+01:00', mine: true,
    sum: `### Next Steps\n\n- Jo:\n  - Share EMEA SMB ARR breakdown\n  - Send the deck to Sam\n- **Richard Grant**\n  - Create pools\n- Owners:\n  - Alex: share deck\n- **Book QBR Prep**\n- Pricing follow-ups\n  - Send updated quote (Jo)\n  - Confirm discount\n\n## Next Steps\n\n### Barnabas\n\n- Shut off workflow\n\n### Salesforce Setup\n\n- Build sandbox mockup\n\n# Next steps\n\nThe team will reconvene next week.\n\n# Decisions & Next Steps\n- None\n- No specific next steps were discussed` },
  { id: 'm4', title: 'In progress', at: '2026-11-03T16:00:00.000+01:00', mine: true, sum: null },
];
(async () => {
  let n = 0;
  const call = async (tool, args) => {
    n++;
    if (tool === 'search_meetings') return listPage(M.slice(2), false);
    if (n === 2) return '{"error":"rate_limit","retry_after_seconds":1}';  // first get_meetings call is rate-limited once
    return notesFor(M.filter((m) => args.meeting_ids.includes(m.id)));
  };
  const res = await loaders.gr_notes.fn({ answer: listPage(M.slice(0, 2), true), call, args: { from_date: 'a', to_date: 'b' } });
  console.log('rows', res.rows.length, 'cut', res.cut, 'me', res.rows[0].me, 'myName', res.rows[0].myName, 'title', res.rows[0].meeting);
  const acts = calcs.gr_actions.fn(res.rows);
  for (const a of acts) console.log((a.bucket + (a.forYou ? '*' : ' ')).padEnd(12), '|', a.item.slice(0, 55).padEnd(55), '|', String(a.owner).padEnd(14), '|', a.meeting.slice(0, 18), '|', a.detail.slice(0, 60));
  console.log(calcs.gr_kpi.fn(acts));
  // failure modes
  const bad = async () => 'Too many requests. Please retry later.';
  try { await loaders.gr_notes.fn({ answer: listPage(M.slice(0, 1), false), call: bad, args: {} }); } catch (e) { console.log('all batches failed ->', e.message.slice(0, 70)); }
  let k = 0; const many = Array.from({ length: 15 }, (_, i) => ({ id: 'x' + i, title: 'T' + i, at: '2026-10-01T10:00:00.000+01:00', mine: true, sum: '# Next Steps\n- Do thing ' + i }));
  const half = async (tool, args) => (++k === 1 ? notesFor(many.filter((m) => args.meeting_ids.includes(m.id))) : 'oops');

  const r2 = await loaders.gr_notes.fn({ answer: listPage(many, false), call: half, args: {} });
  console.log('partial: rows', r2.rows.length, 'cut', r2.cut);
  const r3 = await loaders.gr_notes.fn({ answer: listPage([], false).replace('count="0"', 'count="0"'), call, args: {} });
  console.log('empty window rows', r3.rows.length);
})();
