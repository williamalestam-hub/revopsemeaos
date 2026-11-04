# RevOps Hub — v1 specification

Owner: William Alestam (EMEA RevOps, Legora). Written 2026-11-04. This is the
contract every builder follows. Change it before you change the behaviour.

## 1. Why

William already has the EMEA RevOps OS (analytics) and had WilliamOS (a cockpit
whose brief he switched off) and a Board (whose Slack intake he switched off).
The Hub must still be in use in March 2027, so:

- one front door, with the OS one click away and linked both ways;
- everything is **prepared** before he asks, nothing is **sent** or **written
  outside the Hub** without his click on the exact text and recipients;
- generation and actions happen **inside the page** (Claude via `sample`,
  connectors via `mcp` as the viewer), never by bouncing a message to a
  Claude chat;
- few moving parts: one worker, one inbox, visible worker health, no second
  system he must maintain by hand;
- very low noise: no item he has to dismiss every day; duplicates impossible by
  construction (stable ids); handled things stay handled.

## 2. The pieces

| Piece | Where | Runs when |
|---|---|---|
| **Hub page** (`hub/`) | its own claude.ai artifact (plain HTML, capabilities `db`, `user`, `sample`, `mcp`, `downloads`) | while open |
| **Today tab** in the EMEA RevOps OS (`dashboard/`) | the existing Dashboard-type artifact | while open; reads `hub/today` from the OS's own db |
| **Intake worker** | scheduled task → fresh cloud session with Granola, Gmail, Slack, Google Calendar | weekdays 07:13 and 13:13 Stockholm, and on "Run now" |
| **Harness tests** (`tools/harness`, `hub/test`) | node, no browser | every change |

The Dashboard type does not expose `sample`, which is why the Hub is its own
artifact. The OS keeps every analytics screen; the Hub is the operating
surface.

## 3. Data model (Hub artifact db)

Default db rules (owner and editors write, viewers read). The worker writes as
William through ArtifactData. Every write to an existing document is pinned
with `if_version` (worker) or is a user action (page).

### `items/{id}` — one thing for William

```
id            stable, see §3.1
kind          task | ask | meeting | insight | decision | escalation | build
title         ≤ 90 chars, plain, specific
summary       ≤ 400 chars, what it is and the current state
why           ≤ 120 chars, why it matters now
severity      critical | high | normal | low
status        new | prepared | waiting | approved | done | dismissed | snoozed | stale
snoozeUntil   ISO, only when snoozed
dueAt         ISO or null
source        { system: granola|gmail|slack|calendar|salesforce|os|manual|worker,
                ref: <id in that system>, url: <deep link or ''>,
                who: <internal person's name or ''>, when: <ISO> }
prepared      null, or {
                type: slack | email | doc | sheet | notion | plan | brief | note,
                title, body (Markdown for doc/notion/plan/brief/note; Slack
                markdown for slack; plain text for email),
                to: [{ name, slackId?, email? }],   // recipients, resolved when known
                channelId?, threadTs?, subject?, replyToMessageId?,
                generatedBy: 'worker' | 'page', generatedAt: ISO }
actions       [{ type, label, payload }]  // offered buttons, see §5
log           [{ at, event, by, detail? }]   // ≤ 40 entries, oldest dropped
dedupeKey     the key the worker used (see §3.1)
createdAt, updatedAt   ISO (worker: real clock from `date -u`; page: Date.now ISO)
```

States: the worker creates `new` and, once it has drafted, `prepared`. A
prepared item William must act on is `waiting`. The page moves items to
`approved` (an action is in flight), `done` (the action succeeded or he ticked
it), `dismissed`, `snoozed` (with `snoozeUntil`; the page shows it again after
that time). The worker sets `stale` when the cause is gone (he answered the
thread himself, the meeting passed) and never reopens `done`, `dismissed` or
`stale`.

### 3.1 Stable ids (dedupe)

The doc id IS the dedupe key. The worker never creates a second document for
the same underlying thing; it `update`s the existing one only if the source
changed (new reply, new owner), and never changes `status` of a document
William touched.

```
gr-<meetingId>-<slug40>     Granola next step (slug of the task text)
gm-<threadId>                Gmail thread
sl-<channelId>-<ts with . as _>   Slack message
cal-<eventId>-<YYYY-MM-DD>   calendar event (meeting prep)
ins-<metric>-<YYYY-MM-DD>    insight
esc-<sourceId>               escalation created from another item
man-<random>                 created by William in the page
```

`slug40`: lowercase, strip accents, every run of characters other than a-z 0-9
becomes `-`, trim `-`, cut to 40.

### `briefs/{YYYY-MM-DD}` — the day's brief (worker)

`{ dateKey, slot: morning|midday, headline, markdown (≤ 350 words), moves:
[{title, why, itemId?}] (≤ 3), meetings: [{eventId, title, at, internal: bool,
itemId}], createdAt }`.

### `runs/{runId}` — worker run log (worker)

`runId` = UTC start time as `YYYYMMDDTHHMMSSZ`. `{ startedAt, finishedAt,
status: running|ok|partial|failed, trigger: schedule|manual|dry-run, counts:
{ scanned, created, updated, stale, skipped }, sources: { granola: ok|failed|
off, gmail: ..., slack: ..., calendar: ... }, errors: [string], note }`. The
page shows the last 10.

### `settings/prefs` — what counts (page-editable, worker-read)

```
escalateTo        { name: 'Leonard Schreij', slackId: '' }   // assumption; William confirms
quietHours        { start: '18:00', end: '07:00', tz: 'Europe/Stockholm' }
sources           { granola: true, gmail: true, slack: true, calendar: true }
slackWatch        { mentions: true, dms: true, channels: [] }   // channel ids to also scan
keyPeople         [{ name, slackId?, email? }]   // VIPs: their asks are high severity
internalDomains   ['legora.com']
voice             'Clear, direct, friendly, no filler. Short sentences. British spelling.'
```

### Per viewer: `data/users/me/ui` — UI preferences only (collapsed sections, filters).

### OS artifact db: `hub/today` (worker-written, OS-read)

`{ at, hubUrl, counts: { waiting, critical, prepared, doneToday }, top:
[{ id, title, kind, severity, status, dueAt }] (≤ 8), lastRun: { at, status },
brief: { headline } }`. Small on purpose.

## 4. The Hub page

Files: `hub/index.html`, `hub/hub.css`, `hub/hub-core.js` (pure logic, no DOM,
also loads in node for tests), `hub/hub-ui.js` (DOM, capabilities). Published
with `files` so the scripts are separate files. No external scripts except
allowed CDNs; prefer none.

Capabilities declared at publish:

```
db: {}                        // default rules
user: {}
sample: {}
downloads: true
mcp: { servers: [
  { server: 'Slack', tools: ['slack_send_message', 'slack_send_message_draft', 'slack_search_users', 'slack_search_channels'] },
  { server: 'Gmail', tools: ['create_draft'] },
  { server: 'Google Drive', tools: ['create_file'] },
  { server: 'Notion', tools: ['notion-create-pages'] },
  { server: 'Claude Code Remote', tools: ['list_triggers', 'fire_trigger'] }
] }
```

Every capability may resolve `null`: the page renders without it and lights
features up when it resolves. Errors branch on `code`.

### Sections (one screen, in this order)

1. **Top bar**: date, "Prepared at <time>" (from the latest `runs` doc),
   worker health chip (ok / partial / failed / never ran / stale > 8 h), **Run
   now** (Claude Code Remote `fire_trigger` on the intake task, with the
   trigger id stored in `settings/prefs.triggerId`; disabled when the
   connector is unavailable), link to the EMEA RevOps OS, Settings.
2. **Needs you**: items with status `waiting` or `new` (and `snoozed` past
   `snoozeUntil`), grouped Critical → High → Normal → Low, within a group by
   `dueAt` then `updatedAt`. Card: kind chip, title, why, source line (system ·
   who · relative time · link), prepared preview (first 2 lines), buttons.
3. **Today's brief**: `briefs/<today>` headline and markdown; the meetings
   list with "Open prep" (the `cal-` item).
4. **Insights**: items with kind `insight`, newest first (empty state: "The
   worker has not found anything worth your time yet").
5. **Automations**: last 10 runs (status, counts, errors) and, when Claude
   Code Remote resolves, the live list of William's scheduled tasks
   (`list_triggers`): name, enabled, next run, last run status. Mark the intake
   task. A failed last run shows red.
6. **Done today** (collapsed): items set to `done` or `dismissed` today.

### Card actions (all in-page)

- **Open**: expands the card: full prepared body in a `textarea` (editable),
  recipients, source.
- **Generate / Refine** (`sample`): an instruction box ("shorter", "add the
  numbers", "make it Swedish"); builds a prompt from the item (title, summary,
  source text, the current body, William's voice from prefs) and asks for the
  new body; streams into the textarea; Stop button; never automatic; errors by
  code (`not_granted` hides the feature).
- **Actions** by `prepared.type` and by what `mcp.listTools()` shows as
  connected:
  - slack → **Send on Slack** (`slack_send_message`), **Save as Slack draft**
    (`slack_send_message_draft`). Recipient must be resolved to an id; if only
    a name is known, **Find person** runs `slack_search_users` and William
    picks.
  - email → **Create Gmail draft** (`create_draft`; never `send_message` in v1).
  - doc / plan / brief / note → **Create Google Doc** (`create_file`, `title`,
    `textContent`, `contentMimeType: 'text/markdown'`; Drive converts to a
    Doc), **Create Notion page** (`notion-create-pages`, `creation_mode:
    'draft'`, `properties.title`, `content`), **Download .md** (`downloads`).
  - sheet → **Create Google Sheet** (`create_file` with `contentMimeType:
    'text/csv'`, body is CSV).
  - any → **Done**, **Dismiss**, **Snooze 1 d / 3 d**, **Escalate**
    (creates `esc-<id>` with a drafted Slack note to `prefs.escalateTo`, kind
    `escalation`, status `waiting`).
- **Confirm sheet** before anything leaves the page: tool and destination in
  words (channel or person name + id, email addresses, "private Notion page",
  Drive title), the full text as it will be sent, Cancel / Confirm. One click
  = approval. The page writes `log` and sets `approved` before the call,
  `done` with the result link after, back to `waiting` with the error on
  failure (`server_unavailable` and `upstream_error` are ambiguous for writes:
  say "may have been sent; check Slack" and do not auto-retry).
- A manual **New item** button (title, kind, note) for things he wants the Hub
  to hold.

### Rules the page enforces

- Never sends, creates or posts without the confirm sheet.
- Never calls `sample` on a timer or at load; only on a click.
- Shows every connector's degraded state in its own section (reconnect copy
  for `needs_reauth`, add copy for `server_not_connected`); never one generic
  banner.
- One db write at a time per document; subscribe once (`onSnapshot` on
  `items` with a limit of 500 and on `runs` with a limit of 10).
- All content rendered with `textContent`; Markdown preview is a minimal
  renderer that escapes HTML first.
- Works at 400 px wide; light and dark via `prefers-color-scheme`; tokens on
  `:root`; body background explicit.

## 5. The intake worker (scheduled task)

Name: **RevOps Hub intake**. Schedule `CRON_TZ=Europe/Stockholm 13 7,13 * * 1-5`.
Connectors: Granola, Gmail, Slack, Google Calendar (William named these in the
goal). Push notification on. Prompt is standalone (fresh session), lives in
`hub/worker-prompt.md` and is pasted verbatim into the task.

Steps, in order:

0. Real time: `date -u +%Y-%m-%dT%H:%M:%SZ`. Load ArtifactData with ToolSearch.
   Read `settings/prefs`, the last `runs` doc, and all `items` with status in
   `new, prepared, waiting, snoozed` (query, limit 500) from the Hub db.
   Write `runs/<runId>` with `status: running`.
1. **Calendar** (Google Calendar `list_events`, today from now and tomorrow,
   Europe/Stockholm): for each meeting with ≥ 1 other attendee, create or
   update `cal-<eventId>-<date>` (kind `meeting`): a prep brief (who, what the
   last Granola notes with these people said, open items between you, three
   things to raise). External attendees → the brief says "external attendees:
   keep to Legora-internal context" and uses no customer content.
2. **Granola** (`list_meetings` / `search_meetings` last 2 days with William
   as participant, `get_meetings`): every next step under "Next Steps" that
   William owns (named, or "I/we will" in his notes; unclear owner →
   `summary` says so and severity `low`) → `gr-…` (kind `task`), prepared
   according to what it takes (a message → Slack draft; a doc → doc outline;
   a bigger build → `plan` with scope, data, screens, risks, effort).
3. **Slack** (`slack_search_public_and_private`, since last run minus 2 h or
   36 h): @mentions of William not written by him; DMs and group DMs whose
   last message is not his. Internal only: skip channels named `ext-*`,
   results marked external, authors without an @legora.com email (bots
   excepted). Skip anything he answered (his own later reply in the thread or
   DM). → `sl-…` (kind `ask`), prepared Slack reply draft, `to` = the author
   with `slackId`, `channelId`, `threadTs`.
4. **Gmail** (`search_threads` `in:inbox is:unread newer_than:2d`, metadata
   view): a thread is internal only when every sender and recipient is
   @legora.com; every other thread is skipped completely, never opened. →
   `gm-…` (kind `ask`), prepared email reply (plain text), `to` = sender email,
   `replyToMessageId`.
5. **Insights** (no Salesforce in v1): patterns across the above, e.g. "3 asks
   waiting > 2 days", "tomorrow has 5 meetings and no focus time", "the same
   person asked twice". At most 2 per run. `ins-…`.
6. **Stale check**: for open `sl-` items, if William has replied since, set
   `stale`; for `cal-` items whose meeting has passed, set `done` with
   `log` event `meeting passed`.
7. **Brief**: `briefs/<date>` for the slot (morning or midday).
8. **OS summary**: write `hub/today` to the EMEA RevOps OS artifact db.
9. **Finish**: `runs/<runId>` with counts and `status` (`partial` when a
   connector failed), then the final message: counts only, no names, no
   subjects (it becomes the phone notification).

Rules: suggest, never act (no sends, no Salesforce, no Slack posts, no
calendar changes, no Notion); internal content only; no Subscriber Content
(law-firm client material) copied into the Hub — write "contains client
material, see source" instead; names of colleagues are fine; firm or client
names only when William needs them to act, never in the final message; batch
writes ≤ 50 with `if_version` on existing documents; on a version conflict
re-read once and redo; if a connector fails, carry on and record it.

Dry run: the same prompt with a first line "DRY RUN: write items with
`trigger: dry-run` in the run doc; everything else as normal" — it still never
sends, so a dry run is a real run with a marker.

## 6. The Today tab in the EMEA RevOps OS

A first tab "Today" before the current first tab. It reads `hub/today` with
the page's db capability (`claude.use('db')`, doc `hub/today`, `onSnapshot`):
counts tiles (Needs you, Critical, Prepared, Done today), the top items as a
list with severity dots, the brief headline, the worker's last run status, and
one button **Open the Hub** (the hub URL from the doc). No connector calls, no
`sample`. Empty state: "The Hub has not run yet" with the Open button. Keep
the existing summary hero below it on the same tab, so Today = Hub summary +
OS severity lines.

## 7. Tests (must pass before publish)

- `hub/test/core.test.js` (node): id and slug builders; grouping and ordering;
  state transitions (allowed and refused); confirm-sheet payload builders for
  each action (exact tool, server, input); prompt builder for Generate
  (includes voice, excludes nothing confidential); Markdown escaper; `hub/
  today` summary builder; relative time; worker health classifier.
- `tools/harness`: the existing OS suites plus `test35.js`: the Today tab
  draws from a fake `hub/today` doc (counts, list, empty state, Open button
  href) and the tab order.
- Worker prompt lint (`hub/test/worker-prompt.test.js`): the prompt contains
  every step and every rule in §5 (string checks), and no customer names.

## 8. Done when (checkable in the session)

1. Hub artifact published with the capabilities above; URL recorded in
   `README.md` and in `settings/prefs.hubUrl` (and the OS's `hub/today`).
2. The OS republished with the Today tab (store docs written, `data/users/me/
   check` read).
3. `settings/prefs` seeded (escalateTo assumption flagged), `runs` empty is
   fine.
4. Scheduled task **RevOps Hub intake** created with the four connectors,
   push notifications on, and its id written to `settings/prefs.triggerId`.
5. A dry run executed and its output shown in the session: either an
   in-session run of the worker steps or `fire_trigger` + the run's final
   message read back. Items visible in the Hub db afterwards.
6. All tests pass (`node hub/test/core.test.js`, harness suites, prompt lint).
7. Committed and pushed on `claude/clever-mayer-nuuli6` with the trailer.
8. Nothing was sent, posted or written to Salesforce, Slack, Gmail, Drive or
   Notion by any of this.

## 9. Later (not v1)

Phase 2: insight watch from the OS calcs (headless harness in a worker,
snapshots, diffs); Salesforce updates from the Hub with before/after and
rollback (stamping `Last_Modified_By_Claude__c`); calendar blocks; weekly
review draft; hand-offs to Dag and Victor with drafted Slack notes. Phase 3:
switch off the three Notion recaps and the Board intake; absorb the event
scanner's and org-chart's run health into Automations.
