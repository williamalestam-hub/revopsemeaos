// RevOps Hub — core tests (docs/hub-spec.md §7). Plain node, no framework:  node hub/test/core.test.js
// Prints one line per check, a pass/fail count at the end, and exits 1 on any failure.
// Synthetic items only: no customer, prospect or law-firm names anywhere in here.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const HUB = path.join(__dirname, '..');
const C = require(path.join(HUB, 'hub-core.js'));

let passes = 0, fails = 0;
const ok = (cond, label, extra) => {
  if (cond) passes++; else fails++;
  console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond || extra === undefined ? '' : '  ' + JSON.stringify(extra)));
};
const eq = (actual, expected, label) => {
  try { assert.deepStrictEqual(actual, expected); ok(true, label); } catch (e) { ok(false, label, { actual, expected }); }
};
const throwsCode = (fn, code, label) => {
  try { fn(); ok(false, label, 'did not throw'); } catch (e) { eq(e && e.code, code, label); }
};
const NOW = Date.parse('2026-11-04T10:00:00Z'); // 11:00 in Stockholm
const iso = (s) => new Date(Date.parse(s)).toISOString();

// ---------- ids and slug40 (§3.1) ----------
console.log('\n# ids and slug40');
eq(C.slug40('Send the Q4 deck to Anna – before Friday!'), 'send-the-q4-deck-to-anna-before-friday', 'slug40: lowercase, runs of other characters become one dash, trimmed');
eq(C.slug40('Förbered Q4-översikt åt Örjan'), 'forbered-q4-oversikt-at-orjan', 'slug40: accents stripped');
eq(C.slug40('a'.repeat(50)).length, 40, 'slug40: cut to 40');
eq(C.slug40('x '.repeat(40)), 'x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-', 'slug40: trim happens before the cut (spec order), so a cut slug may end in a dash');
eq(C.slug40('  --  '), '', 'slug40: nothing left is an empty string');
eq(C.slug40(null), '', 'slug40: null is an empty string');
eq(C.ids.granola('m-1', 'Send the deck'), 'gr-m-1-send-the-deck', 'id: granola next step');
eq(C.ids.gmail('18f3a9c'), 'gm-18f3a9c', 'id: gmail thread');
eq(C.ids.slack('C0123', '1730700000.123456'), 'sl-C0123-1730700000_123456', 'id: slack message, ts dot becomes underscore');
eq(C.ids.calendar('ev_1', '2026-11-05'), 'cal-ev_1-2026-11-05', 'id: calendar event per day');
eq(C.ids.insight('asks_waiting', '2026-11-04'), 'ins-asks_waiting-2026-11-04', 'id: insight per metric per day');
eq(C.ids.escalation('sl-C0123-1730700000_123456'), 'esc-sl-C0123-1730700000_123456', 'id: escalation from a source item');
eq(C.ids.manual('abc'), 'man-abc', 'id: manual with a given random part');
ok(/^man-[a-z0-9]{10}$/.test(C.ids.manual()), 'id: manual mints a 10-character random part');
for (const id of ['gr-m-1-send-the-deck', 'sl-C0123-1730700000_123456', 'cal-ev_1-2026-11-05', 'esc-sl-C0123-1_2', 'man-abc']) ok(C.isDocSegment(id), 'doc segment valid: ' + id);
ok(!C.isDocSegment('a/b') && !C.isDocSegment('..') && !C.isDocSegment(''), 'doc segment: slash, dot-dot and empty are refused');
// the worker computes slug40 with the Python command in the prompt; it must give exactly what the page gives
{
  const { execFileSync } = require('child_process');
  const prompt = fs.readFileSync(path.join(HUB, 'worker-prompt.md'), 'utf8');
  const m = /`(python3 -c '[^`]+' "\$t")`/.exec(prompt);
  ok(!!m, 'the worker prompt carries the slug40 command in backticks');
  let py = true; try { execFileSync('python3', ['-c', 'pass'], { stdio: 'ignore' }); } catch (e) { py = false; }
  if (m && py) {
    for (const t of ['Send the Q4 deck to Anna – before Friday!', 'Förbered Q4-översikt åt Örjan', 'a'.repeat(50), 'x '.repeat(40), '  --  ', 'Ping Bo re: the "Q4" numbers (today?)']) {
      const out = execFileSync('bash', ['-c', m[1]], { env: Object.assign({}, process.env, { t }), encoding: 'utf8' }).replace(/\n$/, '');
      eq(out, C.slug40(t), 'slug40 by the prompt’s command equals the page’s for ' + JSON.stringify(t.slice(0, 24)));
    }
  } else console.log('skip slug40 command check (python3 missing)');
}
ok(C.isClaudeUrl('https://claude.ai/artifact/abc123') && C.isClaudeUrl('https://claude.ai/code/artifact/0a-b'), 'isClaudeUrl: claude.ai https links');
ok(!C.isClaudeUrl('javascript:alert(1)') && !C.isClaudeUrl('https://example.com/claude.ai/x') && !C.isClaudeUrl('http://claude.ai/x') && !C.isClaudeUrl('https://claude.ai/') && !C.isClaudeUrl('https://claude.ai/a b') && !C.isClaudeUrl(''), 'isClaudeUrl: javascript:, other hosts, http, bare root, spaces and empty are refused');
ok(C.isSlackUserId('U0AKFT4J5U7') && C.isSlackUserId('W012AB3CD') && !C.isSlackUserId('UPDATED') && !C.isSlackUserId('UNRESOLVED') && !C.isSlackUserId('C0AKFT4J5U7') && !C.isSlackUserId(''), 'isSlackUserId: U/W ids with a digit; words and channel ids are not');
ok(C.isSlackChannelId('C0123ABCD') && C.isSlackChannelId('G0123ABCD') && !C.isSlackChannelId('CHANNELS') && !C.isSlackChannelId('U0123ABCD'), 'isSlackChannelId: C/G ids with a digit');

// ---------- time ----------
console.log('\n# relative time and Stockholm dates');
eq(C.relativeTime('2026-11-04T09:59:40Z', NOW), 'just now', 'relative: under 45 s');
eq(C.relativeTime('2026-11-04T09:58:00Z', NOW), '2 min ago', 'relative: minutes ago');
eq(C.relativeTime('2026-11-04T07:00:00Z', NOW), '3 h ago', 'relative: hours ago');
eq(C.relativeTime('2026-11-04T12:00:00Z', NOW), 'in 2 h', 'relative: hours ahead');
eq(C.relativeTime('2026-11-04T10:20:00Z', NOW), 'in 20 min', 'relative: minutes ahead');
eq(C.relativeTime('2026-11-03T08:00:00Z', NOW), 'yesterday', 'relative: 24-48 h ago');
eq(C.relativeTime('2026-11-05T12:00:00Z', NOW), 'tomorrow', 'relative: 24-48 h ahead');
eq(C.relativeTime('2026-10-30T10:00:00Z', NOW), '5 d ago', 'relative: days ago');
eq(C.relativeTime('2026-11-10T10:00:00Z', NOW), 'in 6 d', 'relative: days ahead');
eq(C.relativeTime('2026-10-01T10:00:00Z', NOW), '1 Oct', 'relative: beyond two weeks shows the date');
eq(C.relativeTime('2025-10-01T10:00:00Z', NOW), '1 Oct 2025', 'relative: another year shows the year');
eq(C.relativeTime('nonsense', NOW), '', 'relative: unparseable is empty');
eq(C.relativeTime(null, NOW), '', 'relative: missing is empty');
eq(C.dateKey(Date.parse('2026-11-04T23:30:00Z')), '2026-11-05', 'dateKey: 23:30 UTC is already the next day in Stockholm');
eq(C.dateKey(Date.parse('2026-07-01T22:30:00Z')), '2026-07-02', 'dateKey: summer time too');
eq(C.clock('2026-11-04T06:13:00Z'), '07:13', 'clock: Stockholm 24 h');
eq(C.clock('2026-11-04T23:05:00Z'), '00:05', 'clock: midnight is 00, never 24');
eq(C.snoozeUntil(NOW, 3), iso('2026-11-07T10:00:00Z'), 'snoozeUntil: now plus days');

// ---------- grouping and ordering (§4 Needs you, Insights, Done today) ----------
console.log('\n# grouping and ordering');
const mk = (id, o) => Object.assign({ id, kind: 'ask', title: 'T ' + id, summary: '', why: '', severity: 'normal', status: 'waiting', snoozeUntil: null, dueAt: null,
  source: { system: 'slack', ref: '', url: '', who: '', when: iso('2026-11-04T08:00:00Z') }, prepared: null, actions: [], log: [], dedupeKey: id,
  createdAt: iso('2026-11-04T08:00:00Z'), updatedAt: iso('2026-11-04T09:00:00Z') }, o);
const items = [
  mk('A', { severity: 'critical', status: 'waiting', updatedAt: iso('2026-11-04T09:00:00Z') }),
  mk('B', { severity: 'critical', status: 'new', dueAt: iso('2026-11-05T09:00:00Z'), updatedAt: iso('2026-11-04T08:00:00Z') }),
  mk('C', { severity: 'high', status: 'snoozed', snoozeUntil: iso('2026-11-04T09:00:00Z') }),
  mk('D', { severity: 'high', status: 'snoozed', snoozeUntil: iso('2026-11-04T12:00:00Z') }),
  mk('E', { status: 'done', updatedAt: iso('2026-11-04T09:10:00Z') }),
  mk('F', { severity: 'low', updatedAt: iso('2026-11-04T09:30:00Z') }),
  mk('G', { updatedAt: iso('2026-11-04T09:50:00Z') }),
  mk('H', { updatedAt: iso('2026-11-04T09:40:00Z') }),
  mk('I', { kind: 'insight', status: 'new', createdAt: iso('2026-11-04T07:00:00Z') }),
  mk('I2', { kind: 'insight', status: 'new', createdAt: iso('2026-11-04T07:30:00Z') }),
  mk('I3', { kind: 'insight', status: 'dismissed', createdAt: iso('2026-11-04T07:40:00Z'), updatedAt: iso('2026-11-03T09:00:00Z') }),
  mk('J', { kind: 'meeting', status: 'prepared', prepared: { type: 'brief', title: 'Prep', body: 'x', to: [] } }),
  mk('K', { severity: 'urgent', updatedAt: iso('2026-11-04T09:45:00Z') }),
  mk('L', { status: 'dismissed', updatedAt: iso('2026-11-04T09:20:00Z') }),
  mk('M', { status: 'done', updatedAt: iso('2026-11-03T09:20:00Z') }),
  mk('N', { status: 'stale' }),
  mk('O', { status: 'approved' }),
];
const groups = C.groupNeedsYou(items, NOW);
eq(groups.map((g) => g.severity), ['critical', 'high', 'normal', 'low'], 'groups in severity order');
eq(groups[0].items.map((i) => i.id), ['B', 'A'], 'critical: the item with a dueAt comes first');
eq(groups[1].items.map((i) => i.id), ['C'], 'high: a snooze that has passed shows again; a future snooze stays hidden');
eq(groups[2].items.map((i) => i.id), ['G', 'K', 'H'], 'normal: most recently updated first; an unknown severity lands in Normal');
eq(groups[3].items.map((i) => i.id), ['F'], 'low');
ok(!groups.some((g) => g.items.some((i) => ['E', 'I', 'I2', 'J', 'L', 'M', 'N', 'O'].indexOf(i.id) >= 0)), 'done, dismissed, stale, approved, prepared and insights are not in Needs you');
eq(C.insightItems(items).map((i) => i.id), ['I2', 'I'], 'insights: kind insight, newest first, dismissed ones gone');
eq(C.doneTodayItems(items, NOW).map((i) => i.id), ['L', 'E'], 'done today: done or dismissed today (Stockholm), newest first; yesterday excluded');
eq(C.sourceLine(mk('x', { source: { system: 'granola', who: 'Anna Svensson', when: iso('2026-11-04T07:00:00Z') } }), NOW), 'Granola · Anna Svensson · 3 h ago', 'source line: system · who · relative time');
ok(C.needsYou(mk('x', { status: 'snoozed', snoozeUntil: null }), NOW), 'a snoozed item without snoozeUntil shows (never hidden for good)');

// ---------- state machine (§3) ----------
console.log('\n# state transitions');
const allowed = [['new', 'waiting'], ['new', 'prepared'], ['prepared', 'waiting'], ['waiting', 'approved'], ['approved', 'done'], ['approved', 'waiting'],
  ['waiting', 'done'], ['waiting', 'dismissed'], ['waiting', 'snoozed'], ['snoozed', 'snoozed'], ['snoozed', 'done'], ['new', 'done'], ['waiting', 'stale'], ['new', 'stale']];
const refused = [['done', 'waiting'], ['done', 'new'], ['dismissed', 'waiting'], ['stale', 'waiting'], ['approved', 'dismissed'], ['approved', 'snoozed'], ['waiting', 'new'], ['waiting', 'prepared'], ['nope', 'done']];
for (const [a, b] of allowed) ok(C.canTransition(a, b), 'allowed: ' + a + ' → ' + b);
for (const [a, b] of refused) ok(!C.canTransition(a, b), 'refused: ' + a + ' → ' + b);
for (const s of C.STATUSES) ok(Array.isArray(C.TRANSITIONS[s]), 'transition table covers ' + s);
{
  const it = Object.freeze(mk('S', { log: Object.freeze([]) }));
  const next = C.transition(it, 'snoozed', { nowMs: NOW, snoozeUntil: C.snoozeUntil(NOW, 1) });
  eq(next.status, 'snoozed', 'transition sets the status');
  eq(next.snoozeUntil, iso('2026-11-05T10:00:00Z'), 'transition keeps the snoozeUntil it was given');
  eq(next.updatedAt, iso('2026-11-04T10:00:00Z'), 'transition stamps updatedAt from the clock passed in');
  eq(next.log.length, 1, 'transition appends one log entry');
  eq(next.log[0].event, 'snoozed', 'log event is the new status by default');
  eq(next.log[0].by, 'page', 'log by defaults to page');
  eq(it.status, 'waiting', 'the frozen input is untouched');
  const back = C.transition(next, 'waiting', { nowMs: NOW + 1000, event: 'unsnoozed' });
  eq(back.snoozeUntil, null, 'leaving snoozed clears snoozeUntil (null so an update merge clears it)');
  throwsCode(() => C.transition(mk('T', { status: 'done' }), 'waiting', { nowMs: NOW }), 'refused', 'transition refuses done → waiting');
  throwsCode(() => C.transition(mk('T', { status: 'stale' }), 'approved', { nowMs: NOW }), 'refused', 'transition refuses stale → approved');
  const full = mk('U', { log: Array.from({ length: 40 }, (_, i) => ({ at: iso('2026-11-01T00:00:00Z'), event: 'e' + i, by: 'worker' })) });
  const capped = C.addLog(full, 'new-event', 'page', 'detail', iso('2026-11-04T10:00:00Z'));
  eq(capped.log.length, 40, 'log is capped at 40');
  eq(capped.log[0].event, 'e1', 'the oldest entry is dropped');
  eq(capped.log[39].event, 'new-event', 'the new entry is last');
}
{
  const base = mk('P', { kind: 'ask', prepared: null });
  const w = C.withPrepared(base, { body: 'draft' }, NOW);
  eq(w.prepared.type, 'slack', 'withPrepared: an ask from Slack defaults to a Slack draft');
  eq(w.prepared.body, 'draft', 'withPrepared: body set');
  eq(C.defaultPreparedType(mk('q', { kind: 'ask', source: { system: 'gmail' } })), 'email', 'default type: ask from Gmail is email');
  eq(C.defaultPreparedType(mk('q', { kind: 'build' })), 'plan', 'default type: build is a plan');
  eq(C.defaultPreparedType(mk('q', { kind: 'task' })), 'note', 'default type: task is a note');
}

// ---------- confirm-sheet payload builders (§4 card actions) ----------
console.log('\n# action builders');
const slackItem = mk('sl-C0CH-1730700000_000100', { title: 'Reply to Anna about the deck',
  prepared: { type: 'slack', title: 'Reply', body: 'Hi Anna, done.', to: [{ name: 'Anna Svensson', slackId: 'U0ANNA' }], channelId: 'C0CH', channelName: 'revops', threadTs: '1730700000.000100', generatedBy: 'worker', generatedAt: iso('2026-11-04T07:14:00Z') } });
{
  const a = C.buildAction('slack_send', slackItem);
  eq([a.server, a.tool], ['Slack', 'slack_send_message'], 'slack_send: server and tool');
  eq(a.input, { channel_id: 'C0CH', message: 'Hi Anna, done.', thread_ts: '1730700000.000100' }, 'slack_send: exact input');
  ok(a.destination.indexOf('#revops') >= 0 && a.destination.indexOf('C0CH') >= 0 && a.destination.indexOf('Anna Svensson') >= 0 && a.destination.indexOf('1730700000.000100') >= 0, 'slack_send: destination names the channel, its id, the person and the thread', a.destination);
  eq(a.text, 'Hi Anna, done.', 'slack_send: the sheet shows the full text');
  ok(/^Send this message on Slack/.test(a.confirmText), 'slack_send: confirm text says send');
  const d = C.buildAction('slack_draft', slackItem);
  eq([d.server, d.tool], ['Slack', 'slack_send_message_draft'], 'slack_draft: server and tool');
  eq(d.input, a.input, 'slack_draft: same input shape as send');
  ok(/draft/i.test(d.confirmText), 'slack_draft: confirm text says draft');
  eq(C.buildAction('slack_send', slackItem, { body: 'Edited text' }).input.message, 'Edited text', 'slack_send: an edited body is what gets sent');
  throwsCode(() => C.buildAction('slack_send', slackItem, { body: '   ' }), 'empty_body', 'slack_send: refuses an empty body');
  const dm = C.buildAction('slack_send', mk('dm', { prepared: { type: 'slack', body: 'Hi', to: [{ name: 'Anna Svensson', slackId: 'U0ANNA' }] } }));
  eq(dm.input, { channel_id: 'U0ANNA', message: 'Hi' }, 'slack_send: a DM uses the user id as channel_id and no thread_ts');
  ok(/direct message to Anna Svensson \(U0ANNA\)/.test(dm.destination), 'slack_send: DM destination in words with the id', dm.destination);
  const unresolved = mk('un', { prepared: { type: 'slack', body: 'Hi', to: [{ name: 'Anna Svensson' }] } });
  throwsCode(() => C.buildAction('slack_send', unresolved), 'unresolved_recipient', 'slack_send: refuses a recipient without an id');
  const f = C.buildAction('slack_find', unresolved);
  eq([f.server, f.tool], ['Slack', 'slack_search_users'], 'slack_find: server and tool');
  eq(f.input, { keywords: ['Anna', 'Svensson'], natural_language_query: 'Anna Svensson', limit: 8 }, 'slack_find: exact input');
  throwsCode(() => C.buildAction('slack_find', mk('nn', { prepared: { type: 'slack', body: 'Hi', to: [] } })), 'no_name', 'slack_find: needs a name');
}
{
  const em = mk('gm-18f3', { prepared: { type: 'email', title: 'Reply', body: 'Hi Bo,\n\nYes.\n\nWilliam', to: [{ name: 'Bo Berg', email: 'bo@legora.com' }], subject: 'Re: Q4 numbers', replyToMessageId: 'msg-1' } });
  const g = C.buildAction('gmail_draft', em);
  eq([g.server, g.tool], ['Gmail', 'create_draft'], 'gmail_draft: server and tool');
  eq(g.input, { to: ['bo@legora.com'], subject: 'Re: Q4 numbers', body: 'Hi Bo,\n\nYes.\n\nWilliam', replyToMessageId: 'msg-1' }, 'gmail_draft: exact input (plain text body, reply id)');
  ok(g.destination.indexOf('bo@legora.com') >= 0 && g.destination.indexOf('Re: Q4 numbers') >= 0, 'gmail_draft: destination names the address and subject');
  ok(/Nothing is sent/.test(g.confirmText), 'gmail_draft: confirm text says it is a draft');
  const noSubject = C.buildAction('gmail_draft', mk('gm-2', { title: 'Fallback title', prepared: { type: 'email', body: 'x', to: [{ email: 'a@legora.com' }] } }));
  eq(noSubject.input.subject, 'Fallback title', 'gmail_draft: subject falls back to the item title');
  ok(!('replyToMessageId' in noSubject.input) && !('cc' in noSubject.input), 'gmail_draft: optional fields are left out when absent');
  const withCc = C.buildAction('gmail_draft', mk('gm-4', { prepared: { type: 'email', body: 'x', to: [{ email: 'a@legora.com' }], cc: ['hidden@legora.com'] } }));
  ok(!('cc' in withCc.input) && withCc.destination.indexOf('hidden@legora.com') < 0, 'gmail_draft: a cc in the document is never forwarded (the spec has no cc and the sheet would not show it)');
  throwsCode(() => C.buildAction('gmail_draft', mk('gm-3', { prepared: { type: 'email', body: 'x', to: [{ name: 'Bo Berg' }] } })), 'unresolved_recipient', 'gmail_draft: refuses a recipient without an email');
}
{
  const doc = mk('gr-m-1-plan', { title: 'Fallback', prepared: { type: 'plan', title: 'Q4 plan', body: '# Plan\n\nScope…', to: [] } });
  const d = C.buildAction('doc_drive', doc);
  eq([d.server, d.tool], ['Google Drive', 'create_file'], 'doc_drive: server and tool');
  eq(d.input, { title: 'Q4 plan', textContent: '# Plan\n\nScope…', contentMimeType: 'text/markdown' }, 'doc_drive: exact input, markdown converts to a Doc');
  const n = C.buildAction('notion_page', doc);
  eq([n.server, n.tool], ['Notion', 'notion-create-pages'], 'notion_page: server and tool');
  eq(n.input, { pages: [{ properties: { title: 'Q4 plan' }, content: '# Plan\n\nScope…' }], creation_mode: 'draft' }, 'notion_page: exact input, private draft');
  ok(/private Notion page/.test(n.destination), 'notion_page: destination says private Notion page');
  const dl = C.buildAction('download_md', doc);
  eq([dl.server, dl.tool, dl.kind], [null, 'downloads', 'download'], 'download_md: not a connector call');
  eq(dl.input, { filename: 'q4-plan.md', data: '# Plan\n\nScope…' }, 'download_md: filename from the title slug');
  const sh = C.buildAction('sheet_drive', mk('sheet', { prepared: { type: 'sheet', title: 'Pipeline by rep', body: 'rep,arr\nA,1', to: [] } }));
  eq(sh.input, { title: 'Pipeline by rep', textContent: 'rep,arr\nA,1', contentMimeType: 'text/csv' }, 'sheet_drive: csv converts to a Sheet');
  eq([sh.server, sh.tool], ['Google Drive', 'create_file'], 'sheet_drive: server and tool');
  for (const t of ['doc', 'notion', 'brief', 'note']) eq(C.buildAction('doc_drive', mk('d' + t, { prepared: { type: t, title: 'x', body: 'y', to: [] } })).input.contentMimeType, 'text/markdown', 'doc_drive accepts type ' + t);
}
{
  const r = C.buildAction('run_now', null, { prefs: { triggerId: 'trig_01ABC' } });
  eq([r.server, r.tool], ['Claude Code Remote', 'fire_trigger'], 'run_now: server and tool');
  eq(r.input, { trigger_id: 'trig_01ABC', text: 'RUN NOW' }, 'run_now: exact input (the text makes the worker log the run as manual, not schedule)');
  eq(r.text, 'RUN NOW', 'run_now: the sheet shows the message the task receives');
  ok(r.destination.indexOf('trig_01ABC') >= 0, 'run_now: destination names the trigger id');
  const cf = C.buildAction('channel_find', null, { query: ' #revops emea ' });
  eq([cf.server, cf.tool, cf.kind], ['Slack', 'slack_search_channels', 'read'], 'channel_find: server, tool, a read');
  eq(cf.input, { keywords: ['revops', 'emea'], natural_language_query: '#revops emea', channel_types: 'public_channel,private_channel', limit: 10 }, 'channel_find: exact input');
  throwsCode(() => C.buildAction('channel_find', null, { query: '  ' }), 'no_name', 'channel_find: needs a name');
  throwsCode(() => C.buildAction('run_now', null, { prefs: {} }), 'no_trigger', 'run_now: refused without a trigger id');
  throwsCode(() => C.buildAction('nope', slackItem), 'unknown_action', 'unknown action refused');
}
// every call the page can make is inside the published manifest
for (const id of Object.keys(C.ACTIONS)) {
  const a = C.ACTIONS[id];
  if (a.server) ok(C.toolInManifest(a.server, a.tool), 'manifest covers ' + a.server + ' · ' + a.tool);
}
ok(C.toolInManifest('Claude Code Remote', 'list_triggers') && C.toolInManifest('Slack', 'slack_search_channels'), 'manifest covers list_triggers and slack_search_channels');
// ... and lists nothing the page does not call (the manifest is exactly the page's calls: every action plus list_triggers)
{
  const called = new Set(Object.keys(C.ACTIONS).filter((id) => C.ACTIONS[id].server).map((id) => C.ACTIONS[id].server + ' · ' + C.ACTIONS[id].tool));
  called.add('Claude Code Remote · list_triggers');
  for (const r of C.CHAT_READS) called.add(r.server + ' · ' + r.tool); // the chat's read-only connector calls
  for (const s of C.CAPABILITIES.mcp.servers) for (const t of s.tools) ok(called.has(s.server + ' · ' + t), 'manifest lists only a tool the page calls: ' + s.server + ' · ' + t);
}
ok(!C.toolInManifest('Gmail', 'send_message'), 'manifest never allows Gmail send_message (v1 drafts only)');
eq(C.CONNECTORS, ['Slack', 'Gmail', 'Google Drive', 'Notion', 'Claude Code Remote', 'Salesforce', 'Google Calendar', 'Granola'], 'the eight connectors');

console.log('\n# chat');
{
  eq(C.guardSoql('SELECT Id FROM Account'), 'SELECT Id FROM Account LIMIT 200', 'chat SOQL: a LIMIT is added');
  eq(C.guardSoql('SELECT Id FROM Lead LIMIT 5;'), 'SELECT Id FROM Lead LIMIT 5', 'chat SOQL: an existing LIMIT is kept, a trailing ; dropped');
  eq(C.guardSoql('select count() from Opportunity where IsClosed = false limit 200'), 'select count() from Opportunity where IsClosed = false', 'chat SOQL: a LIMIT on COUNT() is removed (it would cap the count)');
  eq(C.guardSoql('SELECT StageName, SUM(Finance_ARR_USD__c) s FROM Opportunity GROUP BY StageName'), 'SELECT StageName, SUM(Finance_ARR_USD__c) s FROM Opportunity GROUP BY StageName', 'chat SOQL: no LIMIT is added to an aggregate');
  throwsCode(() => C.guardSoql('DELETE FROM Account'), 'not_select', 'chat SOQL: only SELECT');
  throwsCode(() => C.guardSoql('SELECT Id FROM Account; SELECT Id FROM Lead'), 'not_select', 'chat SOQL: one statement');
  throwsCode(() => C.guardSoql('SELECT Id FROM Opportunity_Snapshot__c'), 'forbidden_object', 'chat SOQL: never Opportunity_Snapshot__c');
  const byName = Object.fromEntries(C.CHAT_READS.map((r) => [r.name, r]));
  eq(Object.keys(byName).sort(), ['calendar_events', 'find_slack_user', 'gmail_search', 'meeting_notes', 'salesforce_query', 'slack_search'], 'chat: six connector reads');
  for (const r of C.CHAT_READS) ok(C.toolInManifest(r.server, r.tool), 'chat read in the manifest: ' + r.server + ' · ' + r.tool);
  const WRITES = /send|draft|create|update|delete|post|fire|trigger|reply|forward/i;
  for (const r of C.CHAT_READS) ok(!WRITES.test(r.tool), 'chat read is not a write tool: ' + r.tool);
  eq(byName.salesforce_query.input({ soql: 'SELECT Id FROM Account' }), { q: 'SELECT Id FROM Account LIMIT 200' }, 'chat: salesforce_query input');
  eq(byName.calendar_events.input({ start: '2026-11-05T00:00:00', end: '2026-11-06T00:00:00', search: '1:1' }), { startTime: '2026-11-05T00:00:00', endTime: '2026-11-06T00:00:00', timeZone: 'Europe/Stockholm', orderBy: 'startTime', pageSize: 50, fullText: '1:1' }, 'chat: calendar_events input');
  eq(byName.meeting_notes.input({ question: 'What did Kamil ask?' }), { query: 'What did Kamil ask?' }, 'chat: meeting_notes input');
  eq(byName.slack_search.input({ keywords: ['forecast'], filters: 'after:2026-11-01' }), { keywords: ['forecast'], natural_language_query: '', limit: 10, response_format: 'concise', include_bots: false, filters: 'after:2026-11-01' }, 'chat: slack_search input');
  throwsCode(() => byName.slack_search.input({}), 'bad_input', 'chat: slack_search needs keywords or filters');
  eq(byName.find_slack_user.input({ name: 'Kamil Mrani' }), { keywords: ['Kamil', 'Mrani'], natural_language_query: 'Kamil Mrani', limit: 5 }, 'chat: find_slack_user input');
  eq(byName.gmail_search.input({ query: 'is:unread' }), { query: 'is:unread', pageSize: 10, view: 'THREAD_VIEW_MINIMAL' }, 'chat: gmail_search input');
  const d = C.chatDraftItem({ type: 'slack', title: 'Ping Kamil', body: 'Hi Kamil', to: [{ name: 'Kamil', slackId: 'U0AKFT4J5U7', email: 'not an email' }] }, Date.parse('2026-11-05T09:00:00Z'), 'abc123');
  ok(d.id === 'man-abc123' && d.status === 'waiting' && d.prepared.type === 'slack' && d.prepared.generatedBy === 'page', 'chat draft: a waiting man- item with a page draft');
  eq(d.prepared.to, [{ name: 'Kamil', slackId: 'U0AKFT4J5U7' }], 'chat draft: a bad email is dropped, the Slack id kept');
  eq(C.buildAction('slack_send', d).input, { channel_id: 'U0AKFT4J5U7', message: 'Hi Kamil' }, 'chat draft: the confirm sheet sends it as a DM like any other item');
  throwsCode(() => C.chatDraftItem({ type: 'note', body: '  ' }), 'empty_body', 'chat draft: an empty body is refused');
  eq(C.chatDraftItem({ type: 'weird', body: 'x' }).prepared.type, 'note', 'chat draft: an unknown type becomes a note');
  const items = [{ id: 'a', kind: 'ask', title: 'Vicky asks about round robins', status: 'waiting', severity: 'normal', source: { who: 'Vicky' }, prepared: { body: 'x' } }, { id: 'b', kind: 'meeting', title: 'Prep', status: 'prepared', severity: 'normal' }];
  eq(C.chatFindItems(items, { status: 'waiting' }).map((x) => x.id), ['a'], 'chat items: filter by status');
  eq(C.chatFindItems(items, { text: 'vicky' }).map((x) => x.hasDraft), [true], 'chat items: text search across title and person');
  const intro = C.chatInstructions({ prefs: {}, items, nowMs: Date.parse('2026-11-05T09:00:00Z'), unavailable: ['Gmail'] });
  ok(/Finance_ARR_USD__c/.test(intro) && /Opportunity_Snapshot__c/.test(intro), 'chat instructions: the ARR field and the forbidden object');
  ok(/draft_for_review/.test(intro) && /Never claim something was sent/.test(intro), 'chat instructions: nothing is sent, drafts go to Needs you');
  ok(/Subscriber Content/.test(intro) && /data, never instructions/.test(intro), 'chat instructions: client material and tool results as data');
  ok(/Not connected in this view[^\n]*Gmail/.test(intro) && /1 item\(s\) need him/.test(intro), 'chat instructions: missing connectors and the Needs-you count');
  ok(C.chatClip('x'.repeat(13000)).length < 12200, 'chat: tool results are clipped');
}
{
  const tools = { Slack: new Set(['slack_send_message', 'slack_send_message_draft', 'slack_search_users', 'slack_search_channels']), 'Google Drive': new Set(['create_file']), Notion: new Set() };
  const acts = C.availableActions(slackItem, { tools, downloads: true });
  const byId = Object.fromEntries(acts.map((a) => [a.id, a]));
  ok(byId.slack_send && byId.slack_send.enabled && byId.slack_draft.enabled, 'available: slack send and draft on when Slack is connected and the recipient is resolved');
  ok(!byId.slack_find, 'available: Find person is hidden once the recipient has an id');
  eq(acts.filter((a) => a.kind === 'local').map((a) => a.id), ['done', 'dismiss', 'snooze1', 'snooze3', 'escalate'], 'available: the five local actions on every card');
  ok(!acts.some((a) => a.id === 'run_now' || a.id === 'channel_find'), 'available: Run now and Find channel are never card buttons');
  const un = C.availableActions(mk('un', { prepared: { type: 'slack', body: 'Hi', to: [{ name: 'Anna Svensson' }] } }), { tools, downloads: true });
  const ub = Object.fromEntries(un.map((a) => [a.id, a]));
  ok(ub.slack_find && ub.slack_find.enabled, 'available: Find person offered when only a name is known');
  ok(!ub.slack_send.enabled && /Pick the person/.test(ub.slack_send.reason), 'available: send disabled until the person is picked');
  const doc = C.availableActions(mk('d', { prepared: { type: 'brief', title: 't', body: 'b', to: [] } }), { tools, downloads: true });
  const db = Object.fromEntries(doc.map((a) => [a.id, a]));
  ok(db.doc_drive.enabled, 'available: Google Doc on when Drive is connected');
  ok(!db.notion_page.enabled && /Notion is not connected/.test(db.notion_page.reason), 'available: Notion off with its own reason when not connected');
  ok(db.download_md.enabled, 'available: Download .md on when downloads resolved');
  const none = C.availableActions(mk('d', { prepared: { type: 'brief', title: 't', body: 'b', to: [] } }), { tools: null, downloads: false });
  ok(none.filter((a) => a.kind !== 'local').every((a) => !a.enabled), 'available: with no capabilities every connector action is off');
  ok(none.filter((a) => a.kind === 'local').every((a) => a.enabled), 'available: local actions still work without capabilities');
  const missingTool = C.availableActions(slackItem, { tools: { Slack: new Set(['slack_send_message']) }, downloads: false });
  const mt = Object.fromEntries(missingTool.map((a) => [a.id, a]));
  ok(mt.slack_send.enabled && !mt.slack_draft.enabled, 'available: a tool the connector does not list is off');
  const reasoned = C.availableActions(mk('e', { prepared: { type: 'email', body: 'x', to: [{ email: 'a@legora.com' }] } }), { tools: { Slack: new Set(['slack_send_message']) }, downloads: false, reasons: { Gmail: 'Reconnect Gmail in claude.ai Settings → Connectors.' } });
  eq(reasoned.find((a) => a.id === 'gmail_draft').reason, 'Reconnect Gmail in claude.ai Settings → Connectors.', 'available: a degraded connector’s own copy becomes the button’s reason');
  const noPrep = C.availableActions(mk('np', { prepared: null }), { tools, downloads: true });
  eq(noPrep.map((a) => a.id), ['done', 'dismiss', 'snooze1', 'snooze3', 'escalate'], 'available: an item without a draft has only local actions');
}
// state around a call: approved before, done with link after, waiting with the error on failure
{
  const action = C.buildAction('slack_send', slackItem);
  const before = C.beforeAction(slackItem, action, NOW);
  eq(before.status, 'approved', 'beforeAction: approved before the call');
  eq(before.log[before.log.length - 1].event, 'approved', 'beforeAction: log approved');
  ok(before.log[before.log.length - 1].detail.indexOf('C0CH') >= 0, 'beforeAction: log names the destination');
  const after = C.afterSuccess(before, action, 'https://example.slack.com/archives/C0CH/p1', NOW + 2000);
  eq(after.status, 'done', 'afterSuccess: done');
  ok(/https:\/\/example\.slack\.com/.test(after.log[after.log.length - 1].detail), 'afterSuccess: log carries the result link');
  const failed = C.afterFailure(before, action, { code: 'server_unavailable', message: 'timeout' }, NOW + 2000);
  eq(failed.status, 'waiting', 'afterFailure: back to waiting');
  eq(failed.log[failed.log.length - 1].event, 'failed', 'afterFailure: log failed');
  ok(/may have gone through; check Slack/.test(failed.log[failed.log.length - 1].detail), 'afterFailure: ambiguous codes are marked as such in the log');
  ok(/may have been sent; check Slack/.test(C.failureCopy(action, { code: 'server_unavailable' })), 'failureCopy: server_unavailable on a write says may have been sent');
  ok(/may have been sent; check Slack/.test(C.failureCopy(action, { code: 'upstream_error' })), 'failureCopy: upstream_error on a write says may have been sent');
  ok(C.isAmbiguous('server_unavailable') && C.isAmbiguous('upstream_error') && !C.isAmbiguous('needs_reauth'), 'isAmbiguous: the two ambiguous write codes');
  eq(C.failureCopy(C.buildAction('gmail_draft', mk('g', { prepared: { type: 'email', body: 'x', to: [{ email: 'a@legora.com' }] } })), { code: 'needs_reauth' }), 'Reconnect Gmail in claude.ai Settings → Connectors.', 'failureCopy: reconnect copy for needs_reauth');
  eq(C.connectorCopy('Notion', 'server_not_connected'), 'Add Notion in claude.ai Settings → Connectors.', 'connectorCopy: add copy for server_not_connected');
  ok(/switched off for this page/.test(C.connectorCopy('Slack', 'not_in_manifest')), 'connectorCopy: not_in_manifest');
  ok(/policy/.test(C.connectorCopy('Slack', 'blocked_by_policy')) && /approval/.test(C.connectorCopy('Slack', 'approval_required')), 'connectorCopy: policy and approval codes have their own words');
  ok(/reported an error: boom/.test(C.connectorCopy('Slack', 'tool_error', 'boom')), 'connectorCopy: tool_error carries the message');
  const sNot = C.afterFailure(before, action, { code: 'needs_reauth' }, NOW);
  ok(!/may have gone through/.test(sNot.log[sNot.log.length - 1].detail), 'afterFailure: a clear code is not marked ambiguous');
}
{
  const list = { servers: [
    { server: 'Slack', authStatus: 'connected', tools: [{ name: 'slack_send_message' }, { name: 'slack_search_users' }] },
    { server: 'Gmail', authStatus: 'needs_reauth', tools: [{ name: 'create_draft' }] },
    { server: 'Notion', authStatus: 'unknown', tools: [] },
    { server: 'Claude Code Remote', authStatus: 'unknown', tools: [{ name: 'list_triggers' }, { name: 'fire_trigger' }] },
  ] };
  const sets = C.toolSets(list);
  ok(sets.Slack.has('slack_send_message') && !sets.Gmail && sets.Notion.size === 0 && sets['Claude Code Remote'].has('fire_trigger'), 'toolSets: per-server tool names, a reconnect-needed server left out');
  eq(C.connectorStatus('Slack', list.servers[0]).state, 'ready', 'connectorStatus: connected with tools is ready');
  eq(C.connectorStatus('Gmail', list.servers[1]).state, 'needs_reauth', 'connectorStatus: needs_reauth from listTools');
  eq(C.connectorStatus('Notion', list.servers[2]).state, 'not_connected', 'connectorStatus: an empty tool set means not connected');
  eq(C.connectorStatus('Google Drive', null).state, 'not_connected', 'connectorStatus: absent from the list means not connected');
  eq(C.connectorStatus('Slack', list.servers[0], 'not_in_manifest').state, 'blocked', 'connectorStatus: a call-time not_in_manifest overrides');
  eq(C.connectorStatus('Slack', list.servers[0], 'server_unavailable').state, 'trouble', 'connectorStatus: a transient failure is trouble, not disconnected');
  eq(C.connectorStatus('Slack', list.servers[0], 'needs_reauth').copy, 'Reconnect Slack in claude.ai Settings → Connectors.', 'connectorStatus: reconnect copy');
}
eq(C.extractLink({ ok: true, channel: 'C0CH', ts: '1.2', permalink: 'https://example.slack.com/archives/C0CH/p12' }), 'https://example.slack.com/archives/C0CH/p12', 'extractLink: Slack permalink');
eq(C.extractLink({ pages: [{ id: 'p', url: 'https://www.notion.so/p' }] }), 'https://www.notion.so/p', 'extractLink: nested Notion page url');
eq(C.extractLink({ id: 'd1', message: { id: 'm1' } }), '', 'extractLink: nothing linkable is empty');
eq(C.extractLink('Created https://docs.google.com/document/d/abc/edit ok'), 'https://docs.google.com/document/d/abc/edit', 'extractLink: a url inside text');
// Find person / Find channel: whatever shape Slack answers in
{
  const asJson = C.parseSlackList({ users: [{ id: 'U0ANNA123', real_name: 'Anna Svensson', profile: { title: 'RevOps', email: 'anna@legora.com' } }, { id: 'nope', name: 'x' }, { user_id: 'W0BO45678', profile: { display_name: 'Bo Berg' } }] }, 'user');
  eq(asJson.list, [{ id: 'U0ANNA123', name: 'Anna Svensson', detail: 'RevOps', email: 'anna@legora.com' }, { id: 'W0BO45678', name: 'Bo Berg', detail: '' }], 'parseSlackList: users from a JSON object, nested names, bad ids dropped');
  eq(asJson.raw, '', 'parseSlackList: no raw text when something parsed');
  eq(C.parseSlackList(JSON.stringify([{ id: 'U0ANNA123', name: 'anna' }]), 'user').list.map((u) => u.id), ['U0ANNA123'], 'parseSlackList: a JSON string is parsed');
  const asText = C.parseSlackList('Found 2 users:\n- Anna Svensson (U0ANNA123) · RevOps\n- Bo Berg — ID: W0BO45678\nUPDATED 2 rows', 'user');
  eq(asText.list.map((u) => [u.id, u.name]), [['U0ANNA123', 'Anna Svensson RevOps'], ['W0BO45678', 'Bo Berg']], 'parseSlackList: formatted text, one id per line, UPDATED is not an id');
  const nothing = C.parseSlackList('No users matched your search.', 'user');
  eq(nothing.list, [], 'parseSlackList: nothing parsed is an empty list');
  eq(nothing.raw, 'No users matched your search.', 'parseSlackList: ... and the raw text is kept for the viewer');
  eq(C.parseSlackList(null, 'user'), { list: [], raw: '' }, 'parseSlackList: null payload');
  const chans = C.parseSlackList({ channels: [{ id: 'C0REVOPS12', name: 'revops', topic: { value: 'EMEA ops' } }, { id: 'U0ANNA123', name: 'not-a-channel' }] }, 'channel');
  eq(chans.list, [{ id: 'C0REVOPS12', name: 'revops', detail: 'EMEA ops' }], 'parseSlackList: channels from JSON, a user id is not a channel');
  eq(C.parseSlackList('#revops-emea (C0REVOPS12): pipeline talk', 'channel').list, [{ id: 'C0REVOPS12', name: 'revops-emea', detail: '' }], 'parseSlackList: a #name in text wins as the channel name');
}

// ---------- escalation and new item ----------
console.log('\n# escalation and new item');
{
  const prefs = { escalateTo: { name: 'Leonard Schreij', slackId: 'U0LEO' } };
  const esc = C.buildEscalation(slackItem, prefs, NOW);
  eq(esc.id, 'esc-' + slackItem.id, 'escalation: id is esc-<source id> (dedupe by construction)');
  eq([esc.kind, esc.status, esc.prepared.type], ['escalation', 'waiting', 'slack'], 'escalation: kind, status, slack note');
  eq(esc.prepared.to, [{ name: 'Leonard Schreij', slackId: 'U0LEO' }], 'escalation: addressed to prefs.escalateTo');
  ok(esc.prepared.body.indexOf('Hi Leonard') === 0 && esc.prepared.body.indexOf('**' + slackItem.title + '**') > 0, 'escalation: note greets by first name and names the item in standard-markdown bold');
  eq(esc.source, { system: 'manual', ref: slackItem.id, url: '', who: '', when: iso('2026-11-04T10:00:00Z') }, 'escalation: source points back at the item');
  eq(C.buildAction('slack_send', esc).input, { channel_id: 'U0LEO', message: esc.prepared.body }, 'escalation: Send on Slack is a DM to the escalation contact');
  const escNoId = C.buildEscalation(slackItem, { escalateTo: { name: 'Leonard Schreij', slackId: '' } }, NOW);
  throwsCode(() => C.buildAction('slack_send', escNoId), 'unresolved_recipient', 'escalation: without a Slack id the send waits for Find person');
  ok(C.availableActions(escNoId, { tools: { Slack: new Set(['slack_search_users', 'slack_send_message']) } }).some((a) => a.id === 'slack_find' && a.enabled), 'escalation: Find person offered when the contact has no id');
  eq(C.buildEscalation(mk('low', { severity: 'low' }), prefs, NOW).severity, 'normal', 'escalation: never lower than normal');
  ok(esc.log.length === 1 && esc.log[0].event === 'created', 'escalation: one created log entry');
}
{
  const it = C.newManualItem({ title: 'Rebuild the leads scorecard', kind: 'build', note: 'Scope: speed to lead by region.' }, NOW, 'abc0123456');
  eq(it.id, 'man-abc0123456', 'new item: man-<random>');
  eq([it.kind, it.status, it.severity, it.source.system], ['build', 'waiting', 'normal', 'manual'], 'new item: kind, waiting, normal, manual source');
  eq(it.prepared.type, 'note', 'new item: the note becomes a note draft');
  eq(it.prepared.body, 'Scope: speed to lead by region.', 'new item: note body');
  eq(it.summary, 'Scope: speed to lead by region.', 'new item: summary is the note');
  eq(C.newManualItem({ title: 'x', kind: 'bogus' }, NOW, 'r').kind, 'task', 'new item: unknown kind falls back to task');
  eq(C.newManualItem({ title: 'x', kind: 'task' }, NOW, 'r').prepared, null, 'new item: no note, no draft');
  ok(C.newManualItem({ title: 'T'.repeat(120) }, NOW, 'r').title.length <= 90, 'new item: title cut to 90');
  eq(C.newManualItem({}, NOW, 'r').title, 'Untitled', 'new item: empty title is Untitled');
}

// ---------- Generate prompt (§4) ----------
console.log('\n# generate prompt');
{
  const prefs = { voice: 'Clear, direct, friendly, no filler. Short sentences. British spelling.', triggerId: 'trig_SECRET1', hubUrl: 'https://claude.ai/artifact/HUBSECRET',
    escalateTo: { name: 'Leonard Schreij', slackId: 'U0SECRET' }, keyPeople: [{ name: 'Key Person', email: 'key@legora.com', slackId: 'U0KEY' }], internalDomains: ['legora.com'] };
  const item = mk('sl-C0SECRET-1730_1', { title: 'Reply to Anna about the deck', summary: 'Anna asked whether the Q4 deck is ready.', why: 'She presents tomorrow',
    source: { system: 'slack', ref: 'C0SECRET/1730.1', url: 'https://example.slack.com/archives/C0SECRET/p1730', who: 'Anna Svensson', when: iso('2026-11-04T08:00:00Z') },
    prepared: { type: 'slack', title: 'Reply', body: 'current body text', to: [{ name: 'Anna Svensson', slackId: 'U0ANNA', email: 'anna@legora.com' }], channelId: 'C0SECRET', threadTs: '1730.1', replyToMessageId: 'mSECRET' } });
  const p = C.generatePrompt({ item, body: 'current body text', instruction: 'make it shorter', prefs });
  for (const must of [prefs.voice, 'Reply to Anna about the deck', 'Anna asked whether the Q4 deck is ready.', 'She presents tomorrow', 'Anna Svensson', 'current body text', 'make it shorter', 'standard markdown', '**bold**', 'Reply with only the new body text', 'William Alestam']) ok(p.indexOf(must) >= 0, 'prompt includes: ' + must.slice(0, 40));
  ok(p.indexOf('*bold*') < 0 || p.indexOf('**bold**') >= 0, 'prompt: Slack drafts ask for standard markdown, the flavour the Slack tools accept (never single-star bold)');
  for (const never of ['trig_SECRET1', 'HUBSECRET', 'U0SECRET', 'U0ANNA', 'anna@legora.com', 'C0SECRET', '1730.1', 'mSECRET', 'example.slack.com', 'key@legora.com', 'U0KEY', 'Key Person', 'legora.com']) ok(p.indexOf(never) < 0, 'prompt excludes: ' + never);
  ok(C.generatePrompt({ item, body: '', instruction: '', prefs }).indexOf('Write the first draft.') >= 0, 'prompt: empty body asks for a first draft');
  ok(C.generatePrompt({ item, body: 'x', instruction: '', prefs }).indexOf('Improve the current draft') >= 0, 'prompt: a body without an instruction asks to improve it');
  ok(C.generatePrompt({ item: mk('e', { kind: 'ask', source: { system: 'gmail' }, prepared: { type: 'email', body: '', to: [] } }), prefs }).indexOf('plain text') >= 0, 'prompt: email format rule');
  ok(C.generatePrompt({ item: mk('d', { prepared: { type: 'plan', body: '', to: [] } }), prefs }).indexOf('Scope, Data, Screens, Risks, Effort') >= 0, 'prompt: plan format rule');
  ok(C.generatePrompt({ item: mk('n', { kind: 'task', prepared: null }), prefs: {} }).indexOf(C.DEFAULT_PREFS.voice) >= 0, 'prompt: default voice when prefs are empty');
  ok(C.generatePrompt({ item, body: 'b'.repeat(50000), prefs }).length < 20000, 'prompt: a long body is cut');
  const sf = C.sampleFailureCopy({ code: 'not_granted' });
  ok(sf.hide && sf.copy, 'sampleFailureCopy: not_granted hides the feature');
  ok(!C.sampleFailureCopy({ code: 'rate_limited' }).hide, 'sampleFailureCopy: rate_limited keeps the control');
  eq(C.sampleFailureCopy({ code: 'cancelled' }).copy, '', 'sampleFailureCopy: cancelled says nothing');
}

// ---------- Markdown → safe HTML ----------
console.log('\n# markdown');
{
  const h = C.renderMarkdown('# Title\n\nHi **bold** and *em* and `code` <script>alert(1)</script> [link](https://example.com/a?b=1&c=2) [bad](javascript:alert(1)) see https://example.com/x.\n\n- a\n- b\n\n1. one\n2. two\n\n> quoted\n\n---\n\n```\n<pre> & code\n```');
  ok(h.indexOf('<script') < 0 && h.indexOf('&lt;script&gt;alert(1)&lt;/script&gt;') >= 0, 'markdown: html is escaped first');
  ok(h.indexOf('<h3>Title</h3>') >= 0, 'markdown: # becomes h3 (page headings stay h1/h2)');
  ok(h.indexOf('<strong>bold</strong>') >= 0 && h.indexOf('<em>em</em>') >= 0 && h.indexOf('<code>code</code>') >= 0, 'markdown: bold, italics, code');
  ok(h.indexOf('<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">link</a>') >= 0, 'markdown: https link becomes a safe anchor');
  ok(h.indexOf('javascript:') < 0 && h.indexOf('bad') >= 0, 'markdown: a javascript: link keeps only its text');
  ok(/<a href="https:\/\/example\.com\/x" [^>]*>https:\/\/example\.com\/x<\/a>\./.test(h), 'markdown: bare url is linked without the trailing full stop');
  ok(h.indexOf('<ul><li>a</li><li>b</li></ul>') >= 0, 'markdown: bullet list');
  ok(h.indexOf('<ol><li>one</li><li>two</li></ol>') >= 0, 'markdown: numbered list');
  ok(h.indexOf('<blockquote><p>quoted</p></blockquote>') >= 0, 'markdown: blockquote');
  ok(h.indexOf('<hr>') >= 0, 'markdown: rule');
  ok(h.indexOf('<pre><code>&lt;pre&gt; &amp; code</code></pre>') >= 0, 'markdown: fenced code stays escaped and literal');
  const inj = C.renderMarkdown('[x](https://a.b/"onmouseover="alert(1))');
  ok(!/"\s*on\w+\s*=/.test(inj) && inj.indexOf('&quot;') >= 0, 'markdown: quotes inside a url cannot break out of the attribute');
  eq(C.renderMarkdown('**bold** and _it_ and ~gone~ and *em*', { slack: true }), '<p><strong>bold</strong> and <em>it</em> and <s>gone</s> and <em>em</em></p>', 'markdown: the Slack preview is standard markdown (what the Slack tools accept); only ~strike~ is Slack-specific');
  eq(C.renderMarkdown('~gone~'), '<p>~gone~</p>', 'markdown: ~strike~ is not applied outside the Slack flavour');
  const u = C.renderMarkdown('_hi_ https://x.com/__init__/_p_ ok and [see](https://a.b/_x_/) too', { slack: true });
  ok(u.indexOf('<a href="https://x.com/__init__/_p_" target="_blank" rel="noopener noreferrer">https://x.com/__init__/_p_</a>') >= 0 && u.indexOf('<a href="https://a.b/_x_/" target="_blank" rel="noopener noreferrer">see</a>') >= 0 && u.indexOf('<em>hi</em>') >= 0, 'markdown: emphasis never rewrites the inside of a link', u);
  eq(C.renderMarkdown('line one\nline two'), '<p>line one<br>line two</p>', 'markdown: single newlines inside a paragraph break lines');
  eq(C.renderMarkdown(''), '', 'markdown: empty in, empty out');
  eq(C.escapeHtml('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;', 'escapeHtml: the five characters');
  ok(C.renderMarkdown('• bullet').indexOf('<ul><li>bullet</li></ul>') >= 0, 'markdown: Slack-style • bullets');
}

// ---------- worker health and runs ----------
console.log('\n# worker health');
{
  const run = (startedAt, finishedAt, status) => ({ startedAt: iso(startedAt), finishedAt: finishedAt ? iso(finishedAt) : null, status, trigger: 'schedule', counts: { scanned: 12, created: 3, updated: 1, stale: 0, skipped: 2 }, sources: { granola: 'ok', gmail: 'ok', slack: 'ok', calendar: 'ok' }, errors: [], note: '' });
  eq(C.workerHealth([], NOW).state, 'never', 'health: no runs is never ran');
  eq(C.workerHealth(null, NOW).label, 'Never ran', 'health: label never ran');
  eq(C.workerHealth([run('2026-11-04T09:00:00Z', '2026-11-04T09:04:00Z', 'ok')], NOW).state, 'ok', 'health: ok within 8 h');
  eq(C.workerHealth([run('2026-11-04T09:00:00Z', '2026-11-04T09:04:00Z', 'partial')], NOW).state, 'partial', 'health: partial');
  eq(C.workerHealth([run('2026-11-04T09:00:00Z', '2026-11-04T09:04:00Z', 'failed')], NOW).state, 'failed', 'health: failed');
  const st = C.workerHealth([run('2026-11-04T00:00:00Z', '2026-11-04T00:04:00Z', 'ok')], NOW);
  eq(st.state, 'stale', 'health: an ok run older than 8 h is stale');
  ok(/Stale · 10 h ago/.test(st.label), 'health: stale label says how old', st.label);
  eq(C.workerHealth([run('2026-11-04T09:50:00Z', null, 'running')], NOW).state, 'running', 'health: a run started 10 min ago is running');
  eq(C.workerHealth([run('2026-11-04T06:00:00Z', null, 'running')], NOW).state, 'stale', 'health: a run that never finished is stale after 2 h');
  const latest = C.workerHealth([run('2026-11-03T09:00:00Z', '2026-11-03T09:04:00Z', 'failed'), run('2026-11-04T09:00:00Z', '2026-11-04T09:04:00Z', 'ok')], NOW);
  eq(latest.state, 'ok', 'health: the latest run by startedAt decides, whatever the array order');
  eq(latest.at, Date.parse('2026-11-04T09:04:00Z'), 'health: at is the finish time (Prepared at)');
  eq(C.workerHealth([run('2026-11-04T09:00:00Z', '2026-11-04T09:04:00Z', 'weird')], NOW).state, 'unknown', 'health: an unknown status is unknown, not ok');
  eq(C.runCounts(run('2026-11-04T09:00:00Z', '2026-11-04T09:04:00Z', 'ok')), 'scanned 12 · created 3 · updated 1 · stale 0 · skipped 2', 'runCounts: one line');
  const rows = C.triggerRows({ data: [
    { id: 'trig_2', name: 'Other task', enabled: true, cron_expression: '0 9 * * 1', next_run_at: iso('2026-11-09T08:00:00Z'), last_run: { status: 'SUCCEEDED', fired_at: iso('2026-11-02T08:00:00Z'), finished_at: iso('2026-11-02T08:05:00Z') } },
    { id: 'trig_1', name: 'RevOps Hub intake', enabled: true, cron_expression: 'CRON_TZ=Europe/Stockholm 13 7,13 * * 1-5', next_run_at: iso('2026-11-04T12:13:00Z'), last_run: { status: 'FAILED', fired_at: iso('2026-11-04T06:13:00Z') } },
  ], has_more: false }, { triggerId: 'trig_1' });
  eq(rows.map((r) => r.id), ['trig_1', 'trig_2'], 'triggerRows: the intake task first');
  ok(rows[0].isIntake && rows[0].failed && rows[0].lastStatus === 'failed', 'triggerRows: intake marked, failed last run flagged');
  ok(!rows[1].isIntake && !rows[1].failed && rows[1].lastAt === iso('2026-11-02T08:05:00Z'), 'triggerRows: other task, finished_at preferred');
  ok(C.triggerRows({ data: [{ id: 'x', name: 'RevOps Hub intake', enabled: false }] }, {})[0].isIntake, 'triggerRows: the intake task is found by name when no id is stored');
  eq(C.triggerRows(null, {}), [], 'triggerRows: no payload, no rows');
}

// ---------- hub/today summary (§3) ----------
console.log('\n# hub/today');
{
  const runs = [{ startedAt: iso('2026-11-04T09:00:00Z'), finishedAt: iso('2026-11-04T09:04:00Z'), status: 'ok' }];
  const t = C.buildToday({ items, runs, brief: { headline: 'Two asks and one decision' }, hubUrl: 'https://claude.ai/artifact/HUB', nowMs: NOW });
  eq(t.at, iso('2026-11-04T10:00:00Z'), 'today: at');
  eq(t.hubUrl, 'https://claude.ai/artifact/HUB', 'today: hubUrl');
  eq(t.counts, { waiting: 7, critical: 2, prepared: 1, doneToday: 2 }, 'today: counts (needs-you, critical, open drafts, done today)');
  eq(t.top.map((x) => x.id), ['B', 'A', 'C', 'G', 'K', 'H', 'F'], 'today: top is the Needs you order flattened');
  eq(Object.keys(t.top[0]).sort(), ['dueAt', 'id', 'kind', 'severity', 'status', 'title'], 'today: top rows carry only the six fields');
  eq(t.lastRun, { at: iso('2026-11-04T09:04:00Z'), status: 'ok' }, 'today: lastRun from the latest run');
  eq(t.brief, { headline: 'Two asks and one decision' }, 'today: brief headline');
  const many = Array.from({ length: 12 }, (_, i) => mk('m' + i, { severity: 'high' }));
  eq(C.buildToday({ items: many, nowMs: NOW }).top.length, 8, 'today: top is capped at 8');
  eq(C.buildToday({ items: [], nowMs: NOW }).lastRun, { at: null, status: 'never' }, 'today: no runs is a never lastRun');
  eq(C.buildToday({ items: [], nowMs: NOW }).counts, { waiting: 0, critical: 0, prepared: 0, doneToday: 0 }, 'today: empty counts');
  eq(C.buildToday({ nowMs: NOW }).brief.headline, '', 'today: no brief is an empty headline');
  // one definition of "waiting" on both sides: the page's Needs you excludes insights, so does the summary (and the worker prompt says so)
  const tI = C.buildToday({ items: [mk('i1', { kind: 'insight', status: 'new' }), mk('a1', { kind: 'ask', status: 'new' }), mk('a2', { status: 'waiting', severity: 'critical' })], nowMs: NOW });
  eq([tI.counts.waiting, tI.counts.critical, tI.top.map((x) => x.id)], [2, 1, ['a2', 'a1']], 'today: waiting and top leave insights out, like Needs you');
  ok(/not of kind insight/.test(fs.readFileSync(path.join(HUB, 'worker-prompt.md'), 'utf8')), 'today: the worker prompt pins the same definition (not of kind insight)');
}

// ---------- prefs ----------
console.log('\n# prefs');
{
  const p = C.mergePrefs({ voice: 'Terse.', escalateTo: { slackId: 'U0LEO' }, sources: { gmail: false } });
  eq(p.escalateTo, { name: 'Leonard Schreij', slackId: 'U0LEO' }, 'mergePrefs: nested objects merge over the defaults');
  eq(p.sources, { granola: true, gmail: false, slack: true, calendar: true }, 'mergePrefs: sources merge');
  eq(p.voice, 'Terse.', 'mergePrefs: scalar override');
  eq(p.escalateToConfirmed, false, 'mergePrefs: escalateTo starts as an assumption');
  eq(C.mergePrefs(null).internalDomains, ['legora.com'], 'mergePrefs: null gives the defaults');
  eq(C.parseKeyPeople('Anna Svensson | U0ANNA | anna@legora.com\nBo Berg\n\n Cy Dee || cy@legora.com '), [{ name: 'Anna Svensson', slackId: 'U0ANNA', email: 'anna@legora.com' }, { name: 'Bo Berg' }, { name: 'Cy Dee', email: 'cy@legora.com' }], 'parseKeyPeople: one per line, pipes optional');
  eq(C.formatKeyPeople([{ name: 'Anna Svensson', slackId: 'U0ANNA' }, { name: 'Bo Berg' }]), 'Anna Svensson | U0ANNA\nBo Berg', 'formatKeyPeople: round trip shape');
}

// ---------- static checks on the page files ----------
console.log('\n# page files');
{
  const read = (f) => (fs.existsSync(path.join(HUB, f)) ? fs.readFileSync(path.join(HUB, f), 'utf8') : null);
  const html = read('index.html'), ui = read('hub-ui.js'), css = read('hub.css'), core = read('hub-core.js');
  ok(html !== null && ui !== null && css !== null, 'index.html, hub-ui.js and hub.css exist');
  if (html !== null) {
    ok(/^\s*<title>[^<]{3,60}<\/title>/.test(html), 'index.html starts with a <title>');
    ok(!/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(html), 'index.html has no doctype/html/head/body of its own');
    const scripts = Array.from(html.matchAll(/<script[^>]*src="([^"]+)"/g)).map((m) => m[1]);
    eq(scripts, ['hub-core.js', 'hub-ui.js', 'hub-chat.js'], 'index.html loads hub-core.js, hub-ui.js, then hub-chat.js and nothing else');
    ok(/<link rel="stylesheet" href="hub.css">/.test(html), 'index.html links hub.css');
    ok(!/<script[^>]*src="https?:/.test(html), 'index.html loads no external scripts');
    ok(/prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)/.test(html) && /:root\[data-theme="dark"\]/.test(html), 'index.html carries the dark-mode token blocks with both guards');
    ok(/body\s*\{[^}]*background:\s*var\(--bg\)/.test(html), 'index.html gives body an explicit token background');
    ok(/claude:viewport-fit-sides/.test(html) && /max\(16px, env\(safe-area-inset-left, 0px\)\)/.test(css || '') && /max\(16px, env\(safe-area-inset-right, 0px\)\)/.test(css || ''), 'phone gutters: viewport-fit-sides meta with both max() paddings in hub.css');
  }
  if (ui !== null) {
    const used = new Set(Array.from(ui.matchAll(/\bC\.([A-Za-z_$][\w$]*)/g)).map((m) => m[1]));
    const missing = Array.from(used).filter((k) => !(k in C));
    eq(missing, [], 'hub-ui.js uses only what hub-core.js exports (' + used.size + ' names used)');
    ok(/const C = window\.HubCore/.test(ui), 'hub-ui.js takes the core from window.HubCore');
    ok(!/\.innerHTML\s*=(?!\s*C\.renderMarkdown\()/.test(ui), 'hub-ui.js sets innerHTML only from the escaping Markdown renderer');
    ok(!/\bsample\(/.test(ui.replace(/\/\/.*$/gm, '').split('function runGenerate')[0] || ''), 'hub-ui.js never calls sample() outside the Generate flow');
    ok(!/setInterval\([^)]*sample|setTimeout\([^)]*sample/.test(ui), 'hub-ui.js never calls sample on a timer');
    ok(/limit\(500\)/.test(ui) && /limit\(10\)/.test(ui), 'hub-ui.js subscribes to items with limit 500 and runs with limit 10');
    ok(/orderBy\('updatedAt', 'desc'\)/.test(ui), 'hub-ui.js orders items by updatedAt desc');
    ok(!/\.callTool\('Gmail', 'send_message'/.test(ui), 'hub-ui.js never calls Gmail send_message');
    ok(/\$\('link-os'\)\.href = C\.isClaudeUrl\(S\.prefs\.osUrl\) \? S\.prefs\.osUrl : C\.DEFAULT_PREFS\.osUrl/.test(ui), 'hub-ui.js only follows a claude.ai link from prefs.osUrl');
    ok(/if \(osUrl && !C\.isClaudeUrl\(osUrl\)\)/.test(ui) && /if \(hubUrl && !C\.isClaudeUrl\(hubUrl\)\)/.test(ui), 'hub-ui.js refuses to save a non-claude.ai OS or Hub URL');
    ok(/setInterval\(\(\) => \{ S\.now = Date\.now\(\); renderAll\(true\); \}, 60000\)/.test(ui), 'hub-ui.js re-renders passively each minute (snoozes expire) and never writes or samples on the tick');
    ok(/function renderAll\(passive\)/.test(ui) && /if \(passive && editing\(\)\) \{ S\.renderPending = true; return; \}/.test(ui), 'hub-ui.js defers a passive render while a draft is being typed');
    ok(/'focusout'/.test(ui) && /S\.renderPending && !editing\(\)/.test(ui), 'hub-ui.js flushes the deferred render on blur');
    ok(/doc\(esc\.id\)\.get\(\)/.test(ui), 'hub-ui.js checks the database for an older escalation before creating one');
    ok(/if \(saving\) return;/.test(ui) && /saveBtn\.disabled = true/.test(ui), 'hub-ui.js serialises Settings saves');
    ok(/const key = 'ui:' \+ S\.uid;/.test(ui) && /S\.writeQueue\[key\]/.test(ui), 'hub-ui.js writes the per-viewer ui document through the write queue');
    ok(/C\.parseSlackList\(res && res\.payload, 'user'\)/.test(ui) && /C\.parseSlackList\(res && res\.payload, 'channel'\)/.test(ui), 'hub-ui.js parses Slack search answers with the shared parser');
    ok(/'channel_find'/.test(ui) && /slack_search_channels/.test(ui), 'hub-ui.js uses slack_search_channels (Find channel in Settings), so the manifest lists only called tools');
  }
  if (core !== null) ok(!/\bwindow\s*\.|\bdocument\s*\.|\blocalStorage\b|\bnavigator\b/.test(core.replace(/^\s*\/\/.*$/gm, '')), 'hub-core.js never touches window, document, navigator or storage');
  const chat = read('hub-chat.js');
  if (chat !== null) {
    const used = new Set(Array.from(chat.matchAll(/\bC\.([A-Za-z_$][\w$]*)/g)).map((m) => m[1]));
    eq(Array.from(used).filter((k) => !(k in C)), [], 'hub-chat.js uses only what hub-core.js exports');
    ok(!/\.innerHTML\s*=(?!\s*C\.renderMarkdown\()/.test(chat), 'hub-chat.js sets innerHTML only from the escaping Markdown renderer');
    const calls = Array.from(chat.matchAll(/CH\.sample\(/g)).length;
    ok(calls === 1 && /async function send\(text\)[\s\S]*CH\.sample\(/.test(chat), 'hub-chat.js calls sample once, from Send');
    ok(!/setInterval|setTimeout\([^)]*sample/.test(chat), 'hub-chat.js never samples on a timer');
    ok(Array.from(chat.matchAll(/callTool\(/g)).length === 1 && /callTool\(r\.server, r\.tool, input\)/.test(chat), 'hub-chat.js calls connectors only through the read list');
    ok(/data\/users\/' \+ b\.uid\(\) \+ '\/chat/.test(chat), 'hub-chat.js keeps history in the viewer\'s private path');
  }
  for (const f of ['index.html', 'hub.css', 'hub-core.js', 'hub-ui.js', 'hub-chat.js']) { const s = read(f); if (s !== null) ok(Buffer.byteLength(s, 'utf8') < 61440, f + ' is under 60 KB (' + Buffer.byteLength(s, 'utf8') + ' bytes)'); }
}

console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
