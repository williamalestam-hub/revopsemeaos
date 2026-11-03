# EMEA RevOps OS

A live operating app for EMEA RevOps, published as a claude.ai Dashboard artifact:
**https://claude.ai/artifact/TEF8CuQXmPS6rEY3yLVN92**

Every number is a live connector call made with the reader's own access when the app opens.
Data comes from **Salesforce** (including LeanData's round-robin objects, which live in Salesforce),
**HiBob** and **Granola**. Nothing is copied into the page.

The app has a sidebar (team switcher, screens with live count badges), a Home screen, screens with
view tabs, and a person panel: click any name to see that person's pipeline, created opps, book,
routing pools and HiBob details in one place.

## Screens

| Screen | What it answers | Sources |
|---|---|---|
| Home | Headline numbers, your next steps from meetings, the most urgent data checks, pipeline by team, created per week | all of the below |
| Action items | Next steps from your Granola notes (yours / unassigned / with others, with a link to each note, copy as checklist), plus data checks: routing gaps, joiners with no Salesforce user, past-due opps, orphan accounts, split books | Granola `list_meetings` + `get_meetings`; the Salesforce and HiBob sources |
| Pipeline | Open NB + Upsell pipeline, commit and best case this/next quarter by team → manager → rep; closed won this quarter; renewals at stake; past-due and stale opps | `Opportunity` |
| Created opps | Created this week/quarter, 13-week and 12-month trends, source mix (BDR / Inbound / Rep / Expansion), rep and BDR leaderboards | `Opportunity` |
| Hiring & new joiners | HiBob headcount for GTM / Engagement / Growth EMEA, joiners in the last 90 days, matched to Salesforce user and routing pools | HiBob `commons_searchEmployees`, `User`, LeanData pools |
| Routing pools | Every EMEA LeanData pool and its members, 90-day assignments, reps missing from routing, joiners due in week 2, inactive members | `LeanData__Round_Robin_Setting__c`, `LeanData__Log__c` (counts only), `User` |
| Account books | Book size per rep (incl. EM book), territory coverage by Sales Region, orphan accounts with reason, split books, routing vs book mismatches | `Account`, `Opportunity`, LeanData pools |

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
- Items can't be ticked off in the app yet (the dashboard has no storage for that). Use
  "Copy as checklist" to move them into your task tool.

## Known gaps

- No quota or target data in Salesforce, so there's no coverage-to-target ratio yet.
- HiBob hides people in the Hired state from this connection, so signed-but-not-started joiners
  and open requisitions aren't visible. Both need an ATS connector or wider HiBob access.
- HiBob → Salesforce matching is by normalised name (email is not used).
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
