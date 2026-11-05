# RevOps Hub intake worker — scheduling and operation

The intake worker is a **scheduled task** named **RevOps Hub intake**
(`trig_01WtUWRbwYp4NmcKpi188YuN`) that fires into one persistent cloud session,
**RevOps Hub worker** (`session_01JdNo5HNDfLH8RUuFNC5KV7`). Each firing delivers
the prompt in `hub/worker-prompt.md` verbatim as a new turn of that session; the
worker reads Granola, Gmail, Slack and Google Calendar as William and writes only
to the Hub artifact db (via ArtifactData) and the `hub/today` document of the
EMEA RevOps OS db. It never sends, posts or changes anything else (spec §5 rules;
the prompt ends with an explicit never-call list).

## Schedule

- Cron: `CRON_TZ=Europe/Stockholm 13 7,13 * * 1-5` — weekdays 07:13 and 13:13
  Stockholm time (the morning and midday slots of the brief).
- Connectors: the worker session was created from William's Claude Code session
  on 5 Nov 2026 and holds the account's connectors (Slack, Granola, Gmail, Google
  Calendar and the rest) in auto mode, so no call stops for a permission prompt.
  Tool names there carry the connector id (`mcp__<connector id>__<tool>`), which
  is why the prompt finds tools with ToolSearch keyword searches, not exact names.
- Why a persistent session rather than a fresh one per firing (the spec's first
  choice): in this organisation `create_trigger` rejects the `connectors`
  parameter, and a fresh-session task created from a session stores none
  (`mcp_connections: []`). Its first dry run (5 Nov 2026, 01:14 UTC) found no
  Granola, Gmail, Slack or Calendar tools and ended `partial` with every source
  failed. A session created with `create_session` from the same place does hold
  them (checked with a probe session the same minute), so the task is bound to
  one. Verified the same night: a one-off scheduled fire (`run_once_at`) bound to
  the worker session started a turn there within a minute, with the connectors. The fresh-session task is kept, disabled, as *RevOps Hub intake (fresh
  session; attach connectors in the UI before enabling)*
  (`trig_013FH87zjevHwac4QetLRaun`, push notifications on). If its connectors can
  be attached in the claude.ai scheduled-tasks UI, enable it, disable the bound
  one and put its id in `settings/prefs.triggerId`.
- Notifications: a task bound to a session cannot carry push notifications (the
  API rejects them), so run health is read in the Hub (top-bar chip, Automations)
  and on the OS Today tab, both from `runs/` and `hub/today`.
- Context: the worker session keeps its history across runs (auto-compaction
  trims it). The prompt says each delivery is one run and earlier runs are
  history, never a reason to skip work.

## Recreating the task

If the worker session is ever archived or deleted, the task has nothing to fire
into. Recreate both from a Claude Code session that holds the connectors:

1. `create_session` with `{ "title": "RevOps Hub worker" }` (no prompt; it inherits
   the connectors, auto mode and the model of the creating session).
2. Run `node hub/test/worker-prompt.test.js`, then `create_trigger` with

```json
{
  "name": "RevOps Hub intake",
  "cron_expression": "CRON_TZ=Europe/Stockholm 13 7,13 * * 1-5",
  "persistent_session_id": "<the new session id>",
  "initiation": "human_request",
  "prompt": "<the full text of hub/worker-prompt.md>"
}
```

3. Write the result's `trigger.id` to `settings/prefs.intakeTriggerId` in the Hub
   db (ArtifactData `update` with the document's `if_version`) and the session id
   to `settings/prefs.workerSessionId`. Leave `settings/prefs.triggerId` empty
   unless a task exists whose fired sessions hold the connectors (see Starting a
   run by hand): that field drives the page's Run now button.

Notes on the fields:

- `connectors` must be omitted (rejected here) and `notifications` is rejected
  for a session-bound task.
- The prompt is sent as one string. The slug40 command in it contains two
  combining characters (U+0300 and U+036F) that must survive the copy; when the
  text travels as JSON, `\u0300-\u036f` decodes to them. The lint and
  `node hub/test/core.test.js` check that the command still matches
  `HubCore.slug40`.
- The prompt refuses to run (step 0: "misconfigured: no Hub URL", nothing
  written) if the Hub db line ever carries something that is not an
  `https://claude.ai/` link.

## Starting a run by hand

- A **force run** (`fire_trigger`) does not reach the worker session, even for the
  bound task: it starts a fresh session with no connectors (observed 5 Nov 2026,
  01:22 UTC, session titled "⚡ RevOps Hub intake"), so it only proves the plumbing
  and ends `partial` with every source failed. Do not use it for a real run.
- A **real run by hand** delivers the prompt into the worker session: either a
  one-off task bound to it (`create_trigger` with `run_once_at` a minute ahead,
  `persistent_session_id`, `initiation`, and the prompt with `DRY RUN` or
  `RUN NOW` appended as its last line), or `send_message` to the worker session
  from a Claude Code session. Scheduled fires of the bound task take the same
  path as the one-off.
- The text `DRY RUN` makes the run record `trigger: "dry-run"`, `RUN NOW` makes it
  `manual`; a plain scheduled firing is `schedule`. When such a text arrives as a
  separate turn after a run has finished (what a force run with `text` does), the
  prompt's trigger rule relabels the finished run instead of running again.
- The Hub page's **Run now** button calls `fire_trigger` with `RUN NOW`, which is
  the force-run path above; it stays disabled while `settings/prefs.triggerId` is
  empty, and should only be pointed at a task whose fired sessions hold the
  connectors (the parked fresh-session task once its connectors are attached in
  the claude.ai scheduled-tasks UI).
- Reading a run back: `list_triggers` (`{ "limit": 20 }`) shows `last_run`
  (`status`, `fired_at`, `finished_at`); the run's own doc is `runs/<runId>` in the
  Hub db (status, counts, sources, errors, note); the final counts-only message
  is the last assistant event of the worker session (`list_events` with
  `kinds: ["assistant", "result"]` on `session_01JdNo5HNDfLH8RUuFNC5KV7`).

## Changing, pausing, removing

- New prompt text: `update_trigger` with `{ "trigger_id", "prompt" }` after the lint
  passes. Never delete and recreate for a prompt change (the run history goes).
- Pause: `update_trigger` with `{ "trigger_id", "enabled": false }`; resume with `true`.
- The worker session must never delete or change the task; it only writes its
  run doc.

## Checks before every change to the prompt

```
node hub/test/worker-prompt.test.js
```

The lint asserts every step and rule of spec §5 by distinctive phrases, forbids
write-tool names outside the prompt's `Never call:` line (the Slack, Gmail,
Calendar, Salesforce, Drive and Notion writes, and the task, session, publish and
git tools a fired cloud session also carries), keeps the prompt under 15,000
characters (a readability cap, raised from 12,000 when the review fixes went in;
the platform's own bound on a message is far higher) and fails on any proper noun
that is not on its allowlist (a customer or firm name would fail until someone
knowingly adds it, so nobody adds one by accident). `node hub/test/core.test.js`
additionally runs the prompt's slug40 command and checks it against the page's
`HubCore.slug40`, so the two sides can never derive different `gr-` ids.

## What a firing looks like

1. `date -u` → runId; ArtifactData loaded; prefs, last run and open items read.
2. `runs/<runId>` written as `running`, with `startedAt` and `trigger` from the start,
   so the Hub's health chip shows "Running…" (and "Stale · a run never finished" if
   the session dies) instead of the previous run.
3. Calendar → `cal-` preps; Granola → `gr-` tasks; Slack → `sl-` asks; Gmail → `gm-` asks; up to 2 `ins-` insights.
   Before the first batch the worker reads every candidate id it did not load in
   step 1 (ids recur: a `gr-` id while the meeting is within two days, a `gm-` id
   while the thread is unread), and an id that exists as done, dismissed, stale or
   with a page log entry is skipped, never set again.
4. Stale check; `briefs/<date>`; `hub/today` in the OS db (its `lastRun.status` is
   the status this run ends with, never `running`); `runs/<runId>` closed with counts.
5. Final message: counts only (the push notification), also after a crash
   ("failed: " plus the counts so far and the connector that failed).

Every write to an existing document carries `if_version`; batches hold at most 50
writes; a refused or conflicting write is re-read once and redone only while the
document is still the worker's (an open status, no page log entry), otherwise
dropped and counted as skipped; a failed connector is recorded in `sources` and
the run ends `partial`, never silently.

## Known limits (v1)

- One long-lived worker session: if it is archived or deleted the task fires
  into nothing; recreate both as above and update `settings/prefs.triggerId`.
- No push notification from the bound task (see Schedule); the parked
  fresh-session task has one but needs its connectors attached in the UI first.
- The worker session runs on the model it was created with (`claude-fable-5-1`);
  to change it, recreate the session and rebind the task.
- William's Slack user id is not hard-coded: the worker reads it from the Slack
  tool description ("Current logged in user's user_id is ...") of the account the
  session runs as, and his email from Granola `get_account_info`.
