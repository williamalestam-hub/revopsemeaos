# EMEA RevOps OS

A live operating app for EMEA RevOps, published as a claude.ai Dashboard artifact:
**https://claude.ai/artifact/TEF8CuQXmPS6rEY3yLVN92**

Every number is a live connector call made with the reader's own access when the app opens.
Data comes from **Salesforce** (including LeanData's round-robin objects, which live in Salesforce),
**HiBob** and **Granola**. Nothing is copied into the page.

The app has a header (Ctrl K search and one scope pill that opens team chips and a manager search), a
glass tab strip across the top with live count badges, a Home hero (greeting, your next 1:1, what needs you), screens with view tabs, and a person panel: click any name to see that person's
pipeline, open deals with risk flags, created opps, book, routing pools, HiBob details and, for a
manager, their team (with a "Prep a 1:1" button).

**Working with it**
- **Scope pill**: pick a team or one manager; stats, tables and charts follow (Created trends stay all EMEA).
- **Act from the app**: the sparkle button on a next step, data check, talking point, deal or person hands a
  ready-made request to *your* Claude beside the dashboard (the platform asks you to confirm first); Claude then
  drafts the message, proposes the Salesforce or LeanData fix and waits for your OK before writing anything.
  Deals and people also open straight in Salesforce, and next steps owned by someone else get an email nudge.
  The dashboard itself never writes to Salesforce, LeanData, mail or calendars.
- **Search (Ctrl K or /)**: jump to any person, routing pool, account book or view. Keys 1–8 switch screens,
  and the link follows you (`#pipeline-deals` opens that view).
- **Tick off next steps**: the circle in front of an action item marks it done; it leaves your lists and
  counts, and "Show ticked off" brings it back to undo. Ticks are yours alone: they are kept in your own
  private part of the dashboard's database, and nobody else (the owner included) can read them.
- **Copy**: every table has a copy button (paste into Sheets or Slack, as shown, sorted and searched);
  Home has *Copy weekly summary*; action items and data checks copy as checklists.

## Screens

| Screen | What it answers | Sources |
|---|---|---|
| Home | Headline numbers, your next steps from meetings, the most urgent data checks, pipeline by team, created per week | all of the below |
| 1:1s | An agenda for each 1:1 with a colleague in the next 14 days (from your calendar), or for anyone you pick: open follow-ups from your Granola notes with them (tick them off as you go), the last 1:1 note, their numbers (for a leader, their whole team's) and talking points (past-due and pushed-out deals, early-stage deals closing this quarter, missing next steps, risky large deals and renewals, routing gaps, book balance, data checks). Copy the agenda into the invite or your notes. **Team scorecard**: each direct report with their whole team's numbers, starting from you, or from the top EMEA leader when no EMEA people report to you | Google Calendar `list_events`, Salesforce `getUserInfo` and `User`, Granola, the Salesforce sources |
| Action items | Next steps from your Granola notes (yours / unassigned / with others, with a link to each note, copy as checklist), with due dates read from the wording (overdue / due soon), plus data checks: routing gaps, joiners with no Salesforce user, selling titles outside EMEA sales roles, manager differences, past-due opps, orphan accounts, split books | Granola `list_meetings` + `get_meetings`; the Salesforce and HiBob sources |
| Pipeline | Open NB + Upsell pipeline by team → manager → rep; **Forecast** roll-up (won, won + commit, won + commit + best case); **Top deals**: the 300 largest open deals with risk flags (past due, Commit at early stage, early stage closing this quarter, stale 30d+, no next step) and a risk score; renewals at stake | `Opportunity` |
| Created opps | Created this week/quarter, 13-week and 12-month trends, source mix (BDR / Inbound / Rep / Expansion), rep and BDR leaderboards | `Opportunity` |
| Hiring & new joiners | HiBob headcount for GTM / Engagement / Growth EMEA, joiners in the last 90 days, matched to their Salesforce user (by work email, then name) and routing pools; ramp of recent joiners; selling titles without an EMEA sales role and HiBob vs Salesforce manager differences are flagged | HiBob `commons_searchEmployees`, `User`, LeanData pools |
| Routing pools | Every EMEA LeanData pool and its members, 90-day assignments and how evenly they're spread, reps missing from routing, joiners due in week 2, inactive members, members getting none | `LeanData__Round_Robin_Setting__c`, `LeanData__Log__c` (counts only), `User` |
| Account books | Book size per rep (incl. EM book), territory coverage by Sales Region, orphan accounts with reason, split books, routing vs book mismatches, and **Plan moves**: suggested account moves from Heavy to Light books within each team | `Account`, `Opportunity`, LeanData pools |

A **Team** filter (France, DACH, Southern Europe, Iberia & LATAM, Benelux, Nordics, CEE, MEA, SMB,
Engagement, BDR, Leadership) in the sidebar applies across screens. It is worked out from the owner's Salesforce role
and never re-runs a query.

## Scope and definitions

- **EMEA roles** (UK&I excluded): `AE-EMEA-FR, -DACH, -SOUTH, -CEE, -BENELUX, -MEA, -IBERIA-LATAM, -NORDICS`,
  `SMB-EMEA`, `EM-EMEA`, `EM-EMEA-LATAM`, `BDR-EMEA`, `DIR-SALES-EMEA`, `MGR-SALES-EMEA`, `VP-SALES-EMEA`,
  `DIR-EM-EMEA`, `DIR-BDR-EMEA`. `AE-EMEA-NORDICS` is included: it is a real EMEA region that was missing
  from the original brief. Legal Engineering roles (`LE-EMEA`, …) are excluded.
- **ARR**: `Finance_ARR_USD__c` (incremental ARR, USD) for pipeline, created and won;
  `Incremental_Rep_Commit/Best_Case_ARR_USD__c` for forecast; `Order_Form_ARR_USD__c` for renewals at stake;
  `Account.ARR_USD__c` for books. Never `Amount` (TCV).
- **Renewals**: incremental ARR on renewals is roughly zero, so pipeline views are New Business + Upsell.
  Renewals show separately as contract ARR at stake (stage 1+; stage 0 renewals are Flow auto-created).
- **Created**: owner-scoped; renewals auto-created by Flow (`Upsell_Renewal_Created_By__c = 'Flow'`) excluded.
- **Missing from routing**: an active AE / SMB / BDR / EM user in no pool of their kind
  (`RR:` or `RR Gov:` for AEs, `RR SMB*`, `RR BDR:`, `EM*`) 7+ days after their Salesforce user was created.
  Users in their first 7 days show as "add next week", matching the add-in-week-2 practice.
- **Orphan accounts**: active accounts (Customer / Pipeline / Engaging or ARR > 0) in an EMEA Sales Region
  (LATAM included) whose owner is inactive, has no role, is RevOps or sits outside EMEA. Strategic and
  partnership owners are marked "review", not counted.
- **Territory**: Salesforce Territory2 is not enabled. Books come from `Account.Territory_ID__c`.
- **1:1s**: a calendar event is a 1:1 when you and exactly one other person with your email domain are
  invited (meeting rooms aside), it isn't all-day, cancelled or declined by you. Follow-ups for a colleague
  are open items from Granola meetings of up to three people they attended, plus items they own by full name.
  A leader's numbers add up everyone below them in Salesforce's manager chain, their own included.
- **Book moves**: per AE team and SMB, active accounts to move from books at 2× the team median or more to
  books at half or less, largest gaps first, each move stopping at the median for both reps.
- **People matching**: a HiBob person is matched to an active Salesforce user by work email (any role;
  when two users share an address, the EMEA-role one wins), then by normalised name against the EMEA
  roster (full name, then first + last). A selling HiBob title (GTM Manager / Associate / Team Lead,
  Business Development Representative, Engagement Manager) whose Salesforce user has no role or a role
  outside EMEA sales is flagged, because their pipeline, book and routing don't count here. Managers are
  compared by normalised name; a difference is a low-severity check.

## Action items from Granola

- The app lists your Granola meetings in the chosen window (7, 30 or 90 days; notes you took or were
  invited to), reads each note ten at a time, and keeps the bullets under a "Next steps", "Action items",
  "Follow-ups" or "To-dos" heading, plus to-dos in your private notes.
- Owner is the name in brackets after the item (Granola's format, `**Task** (Name)`), before a colon,
  or the name a group of items sits under. It counts as yours when it matches your Granola name or
  email (or says "me" in a note you took). A bracket inside the bold title is context, not the owner.
  "For you" = yours, or unassigned in notes you took. Placeholders like "None" are left out.
- Each viewer sees **their own** notes: Granola runs with each reader's own connection, and no note
  content is stored in the dashboard. The loader only splits notes into lines; the rules for what
  counts as an action item are the `gr_actions` calculation, visible in the dashboard's Sources.
- A due date is read from the wording relative to the meeting date ("today", "tomorrow", "by Friday",
  "next week", "in two weeks", "end of month", "by 30 Oct", "by 30/10"). Past it is overdue; within
  3 days is due soon.
- Ticking an item off in the app doesn't change the note in Granola. "Copy as checklist" still moves
  the open ones into your task tool.

## Known gaps

- No quota or target data in Salesforce, so there's no coverage-to-target ratio yet.
- HiBob hides people in the Hired state from this connection, so signed-but-not-started joiners
  and open requisitions aren't visible. Both need an ATS connector or wider HiBob access.
- LeanData vacation schedules live in a long-text JSON field; out-of-office isn't shown.

## Repo layout

```
dashboard/
  build_datasets.py   # every live query (SOQL / HiBob / Granola call) -> datasets.json
  datasets.json       # generated
  index.html          # page markup (all fixed text lives here)
  os-core.js          # loaders (Salesforce, HiBob, Granola), helpers, app shell, person panel, copy
  os-calcs.js         # dash.calc derivations (visible to readers in Sources)
  os-draw.js          # charts, stats, tables, lists, badges, person panel
  build_store.py      # writes store/ JSON docs for the artifact's store
```

To change a query, edit `build_datasets.py`, run `python3 build_datasets.py && python3 build_store.py`,
and write the changed `store/` documents to the artifact (or ask Claude to).
