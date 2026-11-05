# RevOps Hub intake worker — scheduling and operation

The intake worker is a **scheduled task** named **RevOps Hub intake**. Each firing
starts a fresh cloud session that carries the prompt in `hub/worker-prompt.md`
verbatim, reads Granola, Gmail, Slack and Google Calendar as William, and writes
only to the Hub artifact db (via ArtifactData) and the `hub/today` document of
the EMEA RevOps OS db. It never sends, posts or changes anything else
(spec §5 rules; the prompt ends with an explicit never-call list).

## Schedule

- Cron: `CRON_TZ=Europe/Stockholm 13 7,13 * * 1-5` — weekdays 07:13 and 13:13
  Stockholm time (the morning and midday slots of the brief).
- Connectors granted to every firing: Granola, Gmail, Slack, Google Calendar.
- Fresh session per firing (`create_new_session_on_fire: true`), so the prompt is
  standalone: it carries the time step, the db shapes, the ids and the rules.
- Push notification on: the worker's last message is counts only, so the phone
  shows "scanned 31, created 4 ..." and never a name or a subject.

## Creating the task

Before creating it, replace every `HUB_URL` in `hub/worker-prompt.md` with the
published Hub artifact URL (`settings/prefs.hubUrl`), run the lint, then pass the
file's whole content as `prompt`. The lint prints a warning while `HUB_URL` is still
the placeholder and fails when the Hub db line carries anything that is not an
`https://claude.ai/` link, so a task created from an unreplaced prompt is caught
here; the prompt itself also refuses to run (step 0: "misconfigured: no Hub URL",
nothing written) if the placeholder ever reaches a firing. The call (Claude Code
Remote `create_trigger`):

```json
{
  "name": "RevOps Hub intake",
  "cron_expression": "CRON_TZ=Europe/Stockholm 13 7,13 * * 1-5",
  "connectors": ["Granola", "Gmail", "Slack", "Google Calendar"],
  "create_new_session_on_fire": true,
  "notifications": { "push": true },
  "initiation": "human_request",
  "prompt": "<the full text of hub/worker-prompt.md, HUB_URL replaced>"
}
```

Notes on the fields:

- `connectors` names only the four the goal asked for; the fired session cannot
  reach anything else (no Salesforce, no Notion, no Drive), which is also a guard.
- `notifications` is accepted only for fresh-session tasks; `{ "push": true }` leaves
  email off.
- The result's `trigger.id` (`trig_...`) is written to `settings/prefs.triggerId` in
  the Hub db (ArtifactData `update` on `settings/prefs` with its `if_version`), so
  the Hub page's **Run now** button and Automations section know which task is the
  intake task.
- If the result warns that the task stores no connectors, the task is not usable:
  say so and follow the remedy the result names rather than reporting it created.

## Starting a run by hand

- **Dry run** (spec §5): `fire_trigger` with `{ "trigger_id": "<trig_...>", "text": "DRY RUN" }`.
  The text arrives as a message after the prompt, so the worker records
  `trigger: "dry-run"` in `runs/<runId>`; everything else runs as normal and, like
  every run, it sends nothing. A dry run is therefore a real run with a marker:
  its items are visible in the Hub db afterwards.
- **Run now** (the Hub page, spec §4): `fire_trigger` with `{ "trigger_id": "<trig_...>", "text": "RUN NOW" }`,
  which is exactly what the page's Run now button sends (`HubCore.buildAction('run_now')`).
  Any text that is not DRY RUN makes the run `trigger: "manual"`; a scheduled
  firing has no extra message and is `trigger: "schedule"`.
- Reading a run back: `list_triggers` (`{ "limit": 20 }`) shows `last_run`
  (`status`, `fired_at`, `finished_at`); the run's own doc is `runs/<runId>` in the
  Hub db (status, counts, sources, errors, note); the final counts-only message is
  the last assistant event of the fired session (`list_events` with
  `kinds: ["assistant", "result"]` on the session `last_run.session_id` names).

## Changing, pausing, removing

- New prompt text: `update_trigger` with `{ "trigger_id", "prompt" }` after the lint
  passes. Never delete and recreate for a prompt change (the run history goes).
- Pause: `update_trigger` with `{ "trigger_id", "enabled": false }`; resume with `true`.
- The session a firing creates must never delete the task (that deletes every
  session it started); it only writes its run doc.

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

- The fired session must be able to call ArtifactData and the connector read tools
  without a human approving each call; the first dry run shows whether it stalls
  on a permission prompt. If it does, the task needs a permission mode that does
  not prompt, which `create_trigger` does not expose today.
- William's Slack user id is not hard-coded: the worker reads it from the Slack
  tool description ("Current logged in user's user_id is ...") of the account the
  task runs as, and his email from Granola `get_account_info`.
- The prompt cites `HUB_URL` as a placeholder until the Hub artifact is published.
