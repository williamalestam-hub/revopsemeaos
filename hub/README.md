# RevOps Hub — the page

The operating surface for EMEA RevOps: one front door where everything is prepared before it is asked for and nothing
leaves without a click on the exact text and recipients. The contract is `docs/hub-spec.md`; this folder is §4 of it
(the page) and the tests in §7 that cover it. Plain HTML, no build step, no framework, no external scripts.

Published artifact URL: https://claude.ai/artifact/DBfeBDJhUg78LXARWBwSfU (title "RevOps Hub"; `settings/prefs.hubUrl` carries the same link).

## Files

| File | Role |
|---|---|
| `index.html` | The page: `<title>`, the colour and type tokens (light, and dark under both guards), the fixed copy and the section skeleton. Loads `hub.css`, then `hub-core.js`, then `hub-ui.js`. Starts with `<title>` and `<style>`: the publish wraps it in the document skeleton. |
| `hub.css` | Layout and components, built only from the tokens in `index.html`. 16 px safe-area gutters, works at 400 px, no horizontal scroll. |
| `hub-core.js` | Pure logic. No DOM, no network, no clock unless a time is passed in. UMD: `window.HubCore` in the page, `require('./hub-core.js')` in node. |
| `hub-ui.js` | Everything that touches the browser: capabilities, subscriptions, rendering, the confirm sheet, Generate, Settings, New item, the people picker, toasts. Uses only what `hub-core.js` exports (the tests check this). |
| `test/core.test.js` | The node suite for the core plus static checks on the page files. |
| `worker-prompt.md`, `test/worker-prompt.test.js` | The intake worker and its lint: another builder's part of the same spec (§5). |

## How the pieces fit

```
Hub artifact db ──onSnapshot──▶ state (S) ──render──▶ DOM (createElement + textContent only)
  items   (limit 500, updatedAt desc)        │
  runs    (limit 10,  startedAt desc)        │ click
  settings/prefs, briefs/<today>             ▼
  data/users/<id>/ui (per viewer)     HubCore.buildAction(item, action) ─▶ {server, tool, input, destination, text}
                                             │
                                      confirm sheet (tool · destination with ids · the full text · Cancel / Confirm)
                                             │ one click = approval
                      HubCore.beforeAction ─▶ db write (approved + log) ─▶ mcp.callTool(server, tool, input)
                      HubCore.afterSuccess ─▶ db write (done + link)    │  HubCore.afterFailure ─▶ db write (waiting + error)
```

`hub-core.js` groups:

- **Ids**: `slug40`, `ids.granola/gmail/slack/calendar/insight/escalation/manual`, `isDocSegment`, `isClaudeUrl` (the only hrefs taken from a shared document), `isSlackUserId`, `isSlackChannelId`.
- **Time**: `dateKey`, `clock`, `longDate`, `relativeTime`, `snoozeUntil` (all Europe/Stockholm).
- **Grouping**: `needsYou`, `groupNeedsYou` (Critical → High → Normal → Low; within a group soonest `dueAt` first, no `dueAt` last, then most recently updated), `insightItems`, `doneTodayItems`, `sourceLine`.
- **State machine**: `TRANSITIONS`, `canTransition`, `transition` (refuses with `{code: 'refused'}`), `addLog` (≤ 40 entries), `withPrepared`.
- **Actions**: `ACTIONS`, `availableActions` (by `prepared.type` and by what `mcp.listTools()` shows), `buildAction` (the exact call and the words for the sheet), `beforeAction` / `afterSuccess` / `afterFailure`, `failureCopy`, `isAmbiguous`.
- **Connectors**: `connectorStatus`, `connectorCopy` (reconnect copy for `needs_reauth`, add copy for `server_not_connected`, and so on by code), `toolSets`, `extractLink`, `parseSlackList` (Find person / Find channel answers in any shape: JSON or text, with the raw text kept when nothing parses).
- **Escalation and manual items**: `buildEscalation` (creates `esc-<id>` with a drafted Slack note to `prefs.escalateTo`), `newManualItem`.
- **Generate**: `generatePrompt` (voice from prefs, the item's words, recipient names, the current body, the instruction; never ids, addresses, links, channel or thread ids, or other prefs), `sampleFailureCopy`.
- **Markdown**: `escapeHtml`, `renderMarkdown` (escapes first; only http(s) links become anchors, and emphasis never rewrites the inside of one; both flavours are standard markdown, `**bold**` and `_italic_`, which is what the Slack tools accept; `{slack: true}` only adds `~strike~`).
- **Worker**: `workerHealth` (ok / partial / failed / never / stale > 8 h, plus running), `runCounts`, `triggerRows`, `buildToday` (the `hub/today` summary the OS reads).

## Rules the page enforces

- Nothing is sent, created or posted without the confirm sheet, and the sheet shows the tool, the destination in words with ids, and the full text. Reads (`listTools`, `list_triggers`, `slack_search_users` for Find person, `slack_search_channels` for Find channel in Settings) run on load or on a click without it. The manifest lists exactly these calls and nothing else (the core test checks both directions).
- Run now fires the intake task with `text: "RUN NOW"`, so the worker logs the run as `manual`; the sheet shows that message.
- `sample` runs only on a click (Generate / Refine), streams into the textarea, has a Stop button, and `not_granted` (and the other hide codes) removes the feature for the view.
- Every connector has its own tile under Automations → Connections with its own copy; a failed call also disables that connector's buttons with the same words. Never one generic banner.
- One db write at a time per document (a queue per id); `onSnapshot` once per query; `items` limited to 500, `runs` to 10.
- Everything is rendered with `textContent`; the only `innerHTML` is the escaping Markdown renderer.
- `server_unavailable`, `upstream_error` and `cancelled` on a write are reported as "may have been sent; check <connector>" and never retried by the page.
- Works with every capability `null`: empty states render, New item keeps items in memory for the visit, and the page says so.

## Running the tests

```
node hub/test/core.test.js
```

Prints one line per check and a pass/fail count; exit code 1 on any failure. Covers ids and `slug40`, relative time and
Stockholm dates, grouping and ordering, allowed and refused transitions, the confirm-sheet builders for every action
(exact server, tool and input, all inside the manifest), the Generate prompt (includes the voice, excludes every id,
address and link), the Markdown escaper, worker health, `triggerRows`, `hub/today`, prefs, and static checks on the page
files (script order, no external scripts, theme blocks, gutters, `hub-ui.js` uses only `HubCore` exports, no `sample` on
a timer, no Gmail `send_message`, each file under 60 KB).

## Publishing

Publish `hub/index.html` with the three other files alongside it and the manifest below. Title "RevOps Hub".

```
files: { "hub.css": "hub/hub.css", "hub-core.js": "hub/hub-core.js", "hub-ui.js": "hub/hub-ui.js" }
```

Capabilities manifest (also `HubCore.CAPABILITIES`; every tool the page calls is listed, nothing else):

```json
{
  "db": {},
  "user": {},
  "sample": {},
  "downloads": true,
  "mcp": {
    "servers": [
      { "server": "Slack", "tools": ["slack_send_message", "slack_send_message_draft", "slack_search_users", "slack_search_channels"] },
      { "server": "Gmail", "tools": ["create_draft"] },
      { "server": "Google Drive", "tools": ["create_file"] },
      { "server": "Notion", "tools": ["notion-create-pages"] },
      { "server": "Claude Code Remote", "tools": ["list_triggers", "fire_trigger"] }
    ]
  }
}
```

After the first publish: write the URL into this file, seed `settings/prefs` through ArtifactData (the defaults are
`HubCore.DEFAULT_PREFS`; `escalateTo` is an assumption until it is confirmed in Settings), and once the scheduled task
exists put its id in `settings/prefs.triggerId` so Run now lights up.

## What the page reads and writes

| Path | Read | Written by the page |
|---|---|---|
| `items/{id}` | `onSnapshot`, limit 500, `updatedAt` desc | `update` of `status`, `snoozeUntil`, `updatedAt`, `log`, `prepared`; `set` for new `man-` and `esc-` documents |
| `runs/{runId}` | `onSnapshot`, limit 10, `startedAt` desc | never |
| `settings/prefs` | `onSnapshot` | `set` from Settings (one save at a time; `osUrl` and `hubUrl` are accepted only as `https://claude.ai/` links, because both become hrefs) |
| `briefs/{YYYY-MM-DD}` | `onSnapshot` on today's key (re-subscribed when the day changes) | never |
| `data/users/{id}/ui` | `get` once | `set` (collapsed Done today) |

## Decisions worth knowing

- Needs you shows `waiting`, `new` and expired `snoozed` items, except kind `insight`, which has its own section (so an insight is never something to dismiss twice).
- Download .md goes through the confirm sheet and writes a `downloaded` log line but leaves the status alone: a file on his device is not the item being handled.
- `stale` is literal: a last run older than 8 h, including evenings and weekends. A `running` run older than 2 h also reads as stale.
- `slug40` trims dashes before cutting to 40, in the spec's order, so a cut slug can end in a dash; the worker must do the same for ids to match.
- Additive prefs fields: `escalateToConfirmed` (the "assumed, confirm" flag) and `osUrl` (the link in the top bar). The worker ignores both. The top-bar href follows `osUrl` only when it is an `https://claude.ai/` link (anyone with write access to the db could otherwise plant a `javascript:` or foreign URL); otherwise the default OS link is used.
- A Gmail draft never carries a `cc`: the spec's `prepared` shape has none, and a cc the sheet does not show must not reach the draft.
- Slack drafts are written and previewed in standard markdown (`**bold**`, `_italic_`, `-` bullets): both Slack tools the page calls document their `message` as standard markdown, so single-star `*bold*` would land as italic. The spec's §3 still says "Slack markdown"; the tool contract wins and the spec owner has been told.
- Find person and Find channel parse whatever shape Slack answers in (the connector declares no output schema). When nothing parses, the card shows the raw answer as text and a field to paste an id, so a recipient is never unresolvable.
- A passive render (an items snapshot, the minute tick, a return to the tab) waits while a card's textarea, instruction box or id field has focus and runs shortly after the blur, so typing a draft never loses the caret; a render after a click is immediate. The minute tick re-renders the lists too, so an expired snooze and a "was due" flag appear without a reload.
- Escalate checks the database for an older `esc-` document before creating one (the loaded window is the last 500 items), and Settings Save and the per-viewer `ui` document go through the same one-write-at-a-time rule as item writes.
- The page keeps the Google Fonts stylesheet (IBM Plex) from `index.html`: the design contract allows that one stylesheet host, the spec's "prefer none" applies to scripts, and the system stack is the fallback. The trade is one request to Google per load; drop the `<link>` if that is not wanted.
- Generate always drafts "on behalf of William Alestam": the Hub is a single-user surface. If the artifact is ever shared with other writers, the prompt builder should take the viewer's name instead.
- The `cal-` prep items (status `prepared`) are reached from the brief's meetings list ("Open prep" renders the card inline) rather than from Needs you.
- The intake task (`trig_01WtUWRbwYp4NmcKpi188YuN`, `settings/prefs.triggerId`) fires into a persistent worker session rather than a fresh session per run, because tasks created from a session in this organisation store no connectors; `hub/worker.md` has the why, the parked fresh-session task and how to recreate both.
