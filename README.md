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
- **Scope pill**: pick a team or one manager (their direct reports); stats, tables and pipeline charts follow. Tiles
  that stay all EMEA (created opps, orphans, this week, hiring by team and month, the BDR leaderboard) say so. For
  a leader's whole organisation, use 1:1s › Team scorecard.
- **Act from the app**: the sparkle button on a next step, data check, talking point, deal or person hands a
  ready-made request to *your* Claude beside the dashboard (the platform asks you to confirm first); Claude then
  drafts the message, proposes the Salesforce or LeanData fix and waits for your OK before writing anything.
  Deals and people also open straight in Salesforce, and next steps owned by someone else get an email nudge.
  The dashboard itself never writes to Salesforce, LeanData, mail or calendars.
- **Search (Ctrl K or /)**: jump to any person, routing pool, account book or view. Keys 1–9 switch screens,
  and the link follows you (`#pipeline-deals` opens that view).
- **Tick off next steps**: the circle in front of an action item marks it done; it leaves your lists and
  counts, and "Show ticked off" brings it back to undo. Ticks are yours alone: they are kept in your own
  private part of the dashboard's database, and nobody else (the owner included) can read them. Each tick saves
  only its own change, so ticking in two tabs or on two devices doesn't undo the other.
- **Private notes stay private**: follow-ups from your private Granola notes show on the 1:1 screen marked
  Private note, for you only; they are left out of the agenda you copy, email or send to Claude.
- **Copy**: every table has a copy button (paste into Sheets or Slack, as shown, sorted and searched);
  Home has *Copy weekly summary*; action items and data checks copy as checklists.

## Screens

| Screen | What it answers | Sources |
|---|---|---|
| Home | Headline numbers, your next steps from meetings, the most urgent data checks, pipeline by team, created per week | all of the below |
| 1:1s | An agenda for each 1:1 with a colleague in the next 14 days (from your calendar), or for anyone you pick: open follow-ups from your Granola notes with them (tick them off as you go), the last 1:1 note, their numbers (for a leader, their whole team's) and talking points (past-due and pushed-out deals, early-stage deals closing this quarter, missing next steps, risky large deals and renewals, routing gaps, book balance, data checks). Activity numbers and up to 3 activity talking points join each agenda once they load. Copy the agenda into the invite or your notes. **Team scorecard**: each direct report with their whole team's numbers, selling activity included, starting from you, or from the top EMEA leader when no EMEA people report to you. **Activity**: per seller, emails sent and external meetings in the last 4 weeks against the 4 weeks before (like-for-like), meetings booked for the next 2 weeks, last activity and flags (quiet, slowing, nothing booked, below the usual range for the role, check capture), the usual range by role, and how far to trust the numbers | Google Calendar `list_events`, Salesforce `getUserInfo` and `User`, Granola, the Salesforce sources, `Task` + `EmailMessage` and `Event` (counts only) |
| Action items | Next steps from your Granola notes (yours / unassigned / with others, with a link to each note, copy as checklist), with due dates read from the wording (overdue / due soon), plus data checks: routing gaps, joiners with no Salesforce user, selling titles outside EMEA sales roles, manager differences, past-due opps, orphan accounts, split books, people who left who still own deals or leads | Granola `list_meetings` + `get_meetings`; the Salesforce and HiBob sources |
| Pipeline | Open NB + Upsell pipeline by team → manager → rep; **Forecast** roll-up (won, won + commit, won + best case); **Top deals**: the 300 largest open deals with risk flags (past due, Commit at early stage, early stage closing this quarter, stale 30d+, no next step, next step overdue, stuck in stage) and a risk score; **Rep risk** with stuck deals; renewals at stake; **This week**: what moved in the last 7 days per rep (created, won, lost, close dates pushed out of or pulled into this quarter, stage up or down, into or out of Commit); **Coverage**: open pipeline against what the team usually books, win rate, expected close and sales cycle | `Opportunity`, `OpportunityHistory`, `OpportunityFieldHistory` |
| Created opps | Created this week/quarter, 13-week and 12-month trends, source mix (BDR / Inbound / Rep / Expansion), rep and BDR leaderboards, and **BDR activity**: people emailed, prospect meetings held and booked, meetings per 100 people emailed, next to what each BDR sourced | `Opportunity`, `Task` + `EmailMessage`, `Event` (counts only) |
| Hiring & new joiners | HiBob headcount for GTM / Engagement / Growth EMEA, joiners in the last 90 days, matched to their Salesforce user (by work email, then name) and routing pools; ramp of recent joiners; selling titles without an EMEA sales role and HiBob vs Salesforce manager differences are flagged; **Leavers**: people whose Salesforce user is inactive but who still own deals, renewals, leads or accounts or keep a pool seat, with a hand-over request for your Claude | HiBob `commons_searchEmployees`, `User`, `Lead` (counts), LeanData pools |
| Routing pools | Every EMEA LeanData pool and its members, 90-day assignments and how evenly they're spread, reps missing from routing, joiners due in week 2, inactive members, members getting none | `LeanData__Round_Robin_Setting__c`, `LeanData__Log__c` (counts only), `User` |
| Account books | Book size per rep (incl. EM book), territory coverage by Sales Region, orphan accounts with reason, split books, routing vs book mismatches, **Engagement**: active accounts nobody has touched in 90 days (or ever) and customers without an active Engagement Manager, and **Plan moves**: suggested account moves from Heavy to Light books within each team, untouched accounts first | `Account`, `Opportunity`, LeanData pools |
| Leads | **Speed to lead**: how fast hand-offs (Ready) to EMEA sellers except SMB were worked in the last 30 days, per team and rep, in business hours, with what was left out and how far to trust it; **Ready now**: who holds Ready leads, how old they are, demo requests waiting, leads routed to another region, the queue, and the next step for each owner (nudge, clean up, check region, reassign, route); **Routing**: leads stuck in LeanData routing or held by the wrong owner, LeanData speed to a person, and each source's inflow, hand-offs and backlog. Every row hands your Claude a counts-only request | `Lead` (counts and anonymous per-lead times, no names, emails, companies or Ids) |

The **scope pill** (a team: France, DACH, Southern Europe, Iberia & LATAM, Benelux, Nordics, CEE, MEA, SMB,
Engagement, BDR, Leadership; or one manager) applies across screens. Teams are worked out from the owner's
Salesforce role and changing scope never re-runs a query.

## Scope and definitions

- **EMEA roles** (UK&I excluded): `AE-EMEA-FR, -DACH, -SOUTH, -CEE, -BENELUX, -MEA, -IBERIA-LATAM, -NORDICS`,
  `SMB-EMEA`, `EM-EMEA`, `EM-EMEA-LATAM`, `BDR-EMEA`, `DIR-SALES-EMEA`, `MGR-SALES-EMEA`, `VP-SALES-EMEA`,
  `DIR-EM-EMEA`, `DIR-BDR-EMEA`. `AE-EMEA-NORDICS` is included: it is a real EMEA region that was missing
  from the original brief. Legal Engineering roles (`LE-EMEA`, …) are excluded.
- **ARR**: `Finance_ARR_USD__c` (incremental ARR, USD) for pipeline, created and won;
  `Incremental_Rep_Commit/Best_Case_ARR_USD__c` for forecast (best case is never below commit on the same deals,
  so the upside call is won + best case, not won + commit + best case); `Order_Form_ARR_USD__c` for renewals at stake;
  `Account.ARR_USD__c` for books. Never `Amount` (TCV).
- **Renewals**: incremental ARR on renewals is roughly zero, so pipeline views are New Business + Upsell.
  Renewals show separately as contract ARR at stake (stage 1+; stage 0 renewals are Flow auto-created).
- **Won**: by the date actually closed (`Actual_Close_Date__c`) everywhere: Pipeline, Forecast, Bookings, Home.
- **Created**: owner-scoped; renewals auto-created by Flow (`Upsell_Renewal_Created_By__c = 'Flow'`) excluded.
  BDR-sourced counts only `BDR-EMEA` / `DIR-BDR-EMEA` originating BDRs.
- **Missing from routing**: an active AE / SMB / BDR / EM user in no pool of their kind
  (`RR:` or `RR Gov:` for AEs, `RR SMB*`, `RR BDR:`, `EM*`) 7+ days after their Salesforce user was created.
  Users in their first 7 days show as "add next week", matching the add-in-week-2 practice. Without a Legora start
  date the anchor is the Salesforce user's creation, which usually comes before day 1, so it gets 14 days.
- **Orphan accounts**: active accounts (Customer / Pipeline / Engaging or ARR > 0) in an EMEA Sales Region
  (LATAM included) whose owner is inactive, has no role, is RevOps or sits outside EMEA. Strategic and
  partnership owners are marked "review", not counted.
- **Territory**: Salesforce Territory2 is not enabled. Books come from `Account.Territory_ID__c`.
- **1:1s**: a calendar event is a 1:1 when you and exactly one other person with your email domain are
  invited (meeting rooms aside), it isn't all-day, cancelled or declined by you. Follow-ups for a colleague
  are open items from Granola meetings of up to three people they attended, plus items they own by full name.
  A leader's numbers add up everyone below them in Salesforce's manager chain, their own included.
- **This week (movement)**: the last 7 days, New Business and Upsell, per current owner and at the deal's current
  ARR. Won and lost count by the date actually closed; admin merges and record clean-ups are left out of lost.
  Created counts opportunities created in the window (and they still count as won or lost if they closed). Pushed is
  an open deal that was in this quarter before its first close-date change of the week and is outside it after the
  last; pulled is the reverse, so a push that was pulled back doesn't count. Stage and Commit compare the first value
  of the week with the last. Close-date, stage and Commit changes on deals created this week are left out.
- **Coverage**: there are no quotas in Salesforce, so coverage compares open pipeline with what the team usually
  books: the average won per quarter over the last 4 completed quarters (a quarter with nothing won counts as 0).
  Coverage this quarter = open closing this quarter ÷ what is still to win to reach a usual quarter; next quarter =
  open closing next quarter ÷ a usual quarter. Deals past due from earlier quarters are left out, as on Pipeline. Win rate is by ARR over the same 4 quarters, admin merges left out, and falls back
  to all EMEA when a team has fewer than 10 closed deals. Expected close = won so far + open × win rate, an upper
  bound because deals that slip out are not removed. Sales cycle is the average days from creation to win.
- **Stuck in stage**: an open deal closing this or next quarter that has sat in its stage longer than about twice
  the usual time: stage 0 35 days, 1 55, 2 60, 3 40, 4 30, 5 45, 6 40. It adds 1 to the rep's risk score.
- **Untouched accounts**: active accounts (customer, pipeline, engaging) with no logged activity in 90 days
  (`LastActivityDate`), or ever. An untouched book is 3 or more of them, or 20% or more of an active book of 10+.
  Customers without an Engagement Manager include those whose Engagement Manager is inactive.
- **Leavers**: a Salesforce user with an EMEA role who is no longer active but still owns open opportunities
  (any type), open leads (neither converted nor disqualified), active accounts, customers as Engagement Manager, or
  a seat in an EMEA LeanData pool. Open deals and renewals are urgent data checks; leads are urgent at 10 or more
  Ready or New. Leads and pool seats come from their own sources, so a viewer without Lead or LeanData access still
  sees the deals, renewals and accounts (leads and pools then show —).
- **Leads in scope**: leads an EMEA seller owns (any country), plus leads that are EMEA by country (`Region__c`) or
  by LeanData routing region (`Routing_Region__c`), whoever owns them. They count for their current owner's team and
  manager; the Marketing Queue and owners outside EMEA sales show under All EMEA only. By source is always all EMEA.
- **Hand-off and speed**: a hand-off is a lead becoming Ready (`Ready_Since__c`); it ends when the lead first leaves
  Ready (`First_Response_Timestamp__c`). Speed is business time between the two, Mon–Fri 09:00–18:00 Paris time, no
  holidays. Demo requests (Inbound: Demo Request or Contact Us Email Demo Request) are due within 1 business day,
  other hand-offs within 5. A lead still in Ready counts as missed once past due; younger ones are pending. Left out:
  SMB-owned leads (automation moves them out of Ready), leads answered before this Ready stamp, exits within
  2 minutes, exits with no stamp and leads with no EMEA seller. Rates and medians on fewer than 5 leads show —.
  Checked on 3 Nov 2026: for AE and BDR owners the stamp matched the first logged rep touch on 96–98% of hand-offs.
- **Ready now**: leads in Ready today; ages are Monday-to-Friday days since the Ready Since date (UTC), a lower
  bound. A demo request is waiting from 2 business days; stale is over 20. No Ready date means Ready since before
  19 May 2026 (when the field was added) or a stamping gap. `LastActivityDate` isn't used, because automation sets it.
- **Lead routing problems**: open leads in LeanData error or not processed, Ready or New MQL leads in a queue,
  worked leads back in a queue, and open leads of inactive users or of users outside EMEA sales (strategic and
  partnership owners are marked review, not counted). Reached a person: LeanData's Last Routed Date at or after
  Ready Since, within 5 minutes counts as fast.
- **Activity** (1:1s › Activity, Team scorecard, agendas, person panel, Created opps › BDRs): emails sent and
  external meetings of EMEA sellers, from what Salesforce captures. Counts only: no subject, email text, name of a
  person or company outside Legora, or record Id is read. *Last 4 weeks* = the 28 days to yesterday; *the 4 weeks
  before* = days 29–56 ago; *next 2 weeks* = the 14 days from tomorrow, all in your Salesforce time zone.
  - *Emails sent*: email tasks with a sent `EmailMessage` (Einstein Activity Capture's copy of the seller's
    mailbox, Outreach sends included), dated by the email's date. Received mail, Outreach's own email log (it
    repeats the mailbox copy and logs prospect replies as outbound), automation emails with no captured message and
    RevOps admin tasks are left out. The direction comes from `EmailMessage.Incoming`, because `Task.Inbound_Email__c`
    is hidden from EMEA profiles. People and accounts emailed are distinct per seller; team figures add them up.
  - *External meetings*: `Event`s with a contact, lead or account (not Legora's own), not all-day, owned by the
    seller, whoever created them; one per start time per person (found within one account status, so a copy of the
    same meeting on a record with another status, about 1–2% of meetings, counts again); LeanData BookIt meetings
    marked Canceled or Rescheduled left out. Held = started in the last 4 weeks, booked = starts in the next 2 (`Activity_in_Past__c`,
    checked on every load). A meeting on the calendar counts as held; one with two of our people counts for each.
  - *Customers and prospects*: by the account's status today; Customer is a customer, everything else a prospect.
  - *The role's meetings*: customer meetings for Engagement Managers, prospect meetings for BDRs, all external
    meetings for AEs, SMB and leaders.
  - *Changes* are like-for-like: only current sellers who joined 8+ weeks ago, whose capture was on in the first week
    of the earlier window and still looks on (people who left, nothing captured or a capture gap are left out); team
    changes add up those people, say how many, and need 20+ meetings (200+ emails) before.
    Capture was switched on during 2026 (people with captured sent mail: 32 in March, 98 in September, 123 in
    October), so longer comparisons would measure the rollout, not selling.
  - *Flags* (active AEs, SMB reps, BDRs and Engagement Managers past their first 28 days; leaders and new joiners
    are shown, never flagged): **Quiet** = nothing captured for 5+ business days (Mon–Fri on the Paris calendar, up
    to the last day the queries read: yesterday, or the day before while your Salesforce time zone is still on an
    earlier date than Paris; 10+ is urgent; time off can't be seen; never flagged while your access hides emails or
    meetings); **Slowing** = the role's meetings down 30%+ on the 4 weeks before, from
    at least 8 and by more than twice the square root of the earlier count (for BDRs, emails the same way from 40);
    **Nothing booked** = no prospect meetings booked for the next 2 weeks after 4+ in the last 4 (customer meetings
    for Engagement Managers); **Below range** = under the 25th percentile of the role's meetings in both 4-week
    windows, with 5+ peers; **No capture** / **Capture gap** = mailbox or calendar capture looks off (a data check,
    not performance).
  - *Usual range*: the middle half (25th–75th percentile) of EMEA sellers in the same role over the last 4 weeks.
    It describes peers, not a target.
  - *Access*: activity follows Salesforce sharing (Account, Opportunity and Lead are Public Read Only). If your
    access shows activity for fewer than half the sellers, empty rows read Not visible with blank numbers, a team
    with such sellers shows no scorecard total, and summaries and agendas say for how many sellers it shows nothing; if it
    shows meetings but almost no emails, emails show — (and the reverse for meetings, with no usual range).
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

## When a source can't be read

Each optional source is its own calculation, so a viewer whose access can't read one still gets the rest:
without LeanData, routing pools, routing checks, routing gaps and pool seats show — or "not available", while the
person panel, data checks, team scorecard, 1:1 agendas and Leavers (deals, renewals, accounts) keep working;
without Lead access, the Leads screen and leavers' leads are missing; without HiBob, the Hiring screen and HiBob
checks; without email message or event access, Activity and its scorecard columns show —, and agendas leave out
the activity lines (saying so when nothing else is flagged), while the rest of each screen keeps working. Data checks list whatever loaded and say when some couldn't. A connector that isn't connected says
"Connect … in your claude.ai connectors" (naming the one that is actually missing) rather than "Failed to load", and
one turned off for the dashboard says so. The weekly summary waits for its sources and says "not available" for one
that failed instead of leaving it out.

## Known gaps

- No quota or target data in Salesforce, so coverage is against usual bookings rather than target. A quota
  object (or a sheet of targets) would turn it into true attainment and coverage-to-target.
- Movement uses the deal's current ARR and owner, not the values at the time of the change.
- HiBob hides people in the Hired state from this connection, so signed-but-not-started joiners
  and open requisitions aren't visible. Both need an ATS connector or wider HiBob access.
- LeanData vacation schedules live in a long-text JSON field; out-of-office isn't shown.
- **Activity** doesn't count calls (about 175 in 4 weeks, nearly all Outreach dials, mostly unanswered; call
  result, type and duration are hidden from EMEA profiles), LinkedIn beyond Outreach steps (about 700 in 4 weeks,
  4 BDRs), replies, meetings that aren't on the Salesforce calendar or are with people who aren't in Salesforce,
  what happened in a meeting, or who booked a meeting for whom. About 1 in 8 of the people Outreach emailed had no
  mailbox copy, so emails read somewhat low. Activity is joined to people by name and counts for the record's
  current owner. One business calendar (Paris, no holidays), so a national holiday can make a country look quiet.
  The windows follow each viewer's Salesforce time zone, so viewers in different zones differ by a few records at
  the edges; a Salesforce user left on a zone far from where they work (say Los Angeles for someone in Europe) gets
  windows that end at that zone's midnight, so set your Salesforce time zone to where you work.
  It was built and checked with RevOps access: before rollout, have one EMEA director compare 1:1s › Activity with
  RevOps totals. **Per-person activity shown to managers needs a check with HR and, where they exist, works councils
  (for example in Germany and France) before rollout.** What ships: Slowing compares the role's meetings with the
  person's own past (a BDR's emails too), Below range uses the role's middle half, and Quiet and Nothing booked are
  fixed thresholds; per-person email counts are shown and can be sorted, and only BDR Slowing uses them; a person's
  Quiet talking point is worded as a question, while leader agendas and the Monday summary name quiet people;
  nothing messages a rep automatically: a Quiet check-in is a Slack draft that Claude sends only after the
  manager's OK.
- **Last activity on accounts and deals** (`LastActivityDate`, behind Untouched accounts on Account books ›
  Engagement and stale deals) moves with automation and received mail: in 4 weeks a RevOps admin flow logged about
  20,000 Task/Other rows on EMEA owners' records, roughly one per received email, touching about 2,500 accounts. So
  Untouched and stale counts are lower bounds. Per-account rep touches can't be read from Account, because Task
  can't be the inner object of a semi-join.
- Lead speed covers EMEA sellers except SMB: demo requests LeanData converts to a contact on arrival are followed
  up on the contact, and SMB leads are moved out of Ready by automation, so neither is timed. One business calendar
  (Paris, no holidays) for all of EMEA, so MEA and holiday weeks look slower than they are. Leads count for their
  current owner, so a reassignment moves their history. The SLA thresholds (1 and 5 business days, 2 and 20 for the
  backlog) are proposals to confirm with Sales and Marketing leadership.

## Repo layout

```
dashboard/
  build_datasets.py   # every live query (SOQL / HiBob / Granola call) -> datasets.json
  datasets.json       # generated
  index.html          # page markup (all fixed text lives here)
  os.css              # the look: tokens, header, tabs, hero, tables, panel
  os-core.js          # loaders (Salesforce, HiBob, Granola), helpers, app shell, person panel, copy
  os-calcs.js         # dash.calc derivations (visible to readers in Sources)
  os-draw.js          # charts, stats, tables, lists, badges, person panel
  build_store.py      # writes store/ JSON docs for the artifact's store
```

To change a query, edit `build_datasets.py`, run `python3 build_datasets.py && python3 build_store.py`,
and write the changed `store/` documents to the artifact (or ask Claude to).
