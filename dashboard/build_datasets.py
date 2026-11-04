"""Builds datasets.json: every live query the EMEA RevOps OS dashboard runs.
Scope and field choices are documented in ../README.md."""
import json

ROLES = ("'AE-EMEA-FR','AE-EMEA-DACH','AE-EMEA-SOUTH','AE-EMEA-CEE','AE-EMEA-BENELUX',"
         "'AE-EMEA-MEA','AE-EMEA-IBERIA-LATAM','AE-EMEA-NORDICS','SMB-EMEA','EM-EMEA',"
         "'EM-EMEA-LATAM','BDR-EMEA','DIR-SALES-EMEA','MGR-SALES-EMEA','VP-SALES-EMEA',"
         "'DIR-EM-EMEA','DIR-BDR-EMEA'")
OWNER = f"Owner.UserRole.Name IN ({ROLES})"
# Closed deals count for the team that closed them: the owner's role stamped at close (Closed_Owner_Role__c, filled
# since about April 2026) when it is an EMEA sales role, else the current owner's. The queries read deals that either
# role puts in EMEA; the calcs decide which team each one counts for.
CLOSED_BY = f"(Closed_Owner_Role__c IN ({ROLES}) OR {OWNER})"
GEO = "Sales_Region__c IN ('Northern Europe','FME','DACH','Iberia','Southern Europe','MEA','LATAM')"
CREATED_NOT_FLOW = "(RecordType.Name != 'Renewal' OR Upsell_Renewal_Created_By__c != 'Flow')"
OPEN_WINDOW = "IsClosed = false AND (CloseDate = THIS_FISCAL_QUARTER OR CloseDate = NEXT_FISCAL_QUARTER)"
POOLS = ['%EMEA%', '%MEA%', '%Baltics%', '%Benelux%', '%CEE%', '%DACH%', '%Germany%', '%France%',
         '%Italy%', '%Iberia%', '%LATAM%', '%Nordics%', '%Southern Europe%', 'RR Gov:%']
def pool_filter(rel):
    return '(' + ' OR '.join(f"{rel}.LeanData__Grouping_Name__c LIKE '{p}'" for p in POOLS) + ')'

SF = lambda q: {"connector": "Salesforce", "tool": "soqlQuery", "args": {"q": " ".join(q.split())}}

D = {}
def ds(id, title, description, src):
    D[id] = {"title": title, "description": description, "source": {"kind": "query", **src}}

# ---------- Pipeline ----------
ds("pipe_stage", "Open pipeline by team",
   "Open EMEA opportunities closing this or next quarter, by owner role, manager, type, stage and rep forecast category, in incremental ARR (USD). Commit and best case come from the rep forecast category: the rep commit and best-case ARR fields stopped being maintained on 1 Sep 2026 and are being removed.",
   SF(f"""SELECT Owner.UserRole.Name role, Owner.Manager.Name manager, RecordType.Name recordType, StageName stage,
   Rep_Forecast_Category__c forecast, FISCAL_YEAR(CloseDate) fy, FISCAL_QUARTER(CloseDate) fq, COUNT(Id) opps,
   SUM(Finance_ARR_USD__c) arrUsd
   FROM Opportunity WHERE {OPEN_WINDOW} AND {OWNER}
   GROUP BY Owner.UserRole.Name, Owner.Manager.Name, RecordType.Name, StageName, Rep_Forecast_Category__c, FISCAL_YEAR(CloseDate), FISCAL_QUARTER(CloseDate)
   ORDER BY Owner.UserRole.Name, Owner.Manager.Name LIMIT 2000"""))
ds("pipe_partner", "Pipeline owned outside EMEA sales",
   "Open opportunities on EMEA-region accounts (the account's sales region) whose owner isn't in an EMEA sales role (the global partnership roles, strategic AEs, other regions' sellers, users with no role), so they are in no EMEA team's totals: by owner role, account region, type and close quarter, in incremental ARR (USD).",
   SF(f"""SELECT Owner.UserRole.Name role, Account.Sales_Region__c region, RecordType.Name rt, FISCAL_YEAR(CloseDate) fy,
   FISCAL_QUARTER(CloseDate) fq, COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd FROM Opportunity
   WHERE IsClosed = false AND (Owner.UserRole.Name = null OR Owner.UserRole.Name NOT IN ({ROLES})) AND Account.{GEO}
   GROUP BY Owner.UserRole.Name, Account.Sales_Region__c, RecordType.Name, FISCAL_YEAR(CloseDate), FISCAL_QUARTER(CloseDate) LIMIT 2000"""))
ds("pipe_rep", "Open pipeline by rep",
   "Open EMEA New Business and Upsell pipeline per rep for this and next quarter, in incremental ARR (USD).",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, FISCAL_YEAR(CloseDate) fy,
   FISCAL_QUARTER(CloseDate) fq, COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd
   FROM Opportunity WHERE {OPEN_WINDOW} AND RecordType.Name != 'Renewal' AND {OWNER}
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, FISCAL_YEAR(CloseDate), FISCAL_QUARTER(CloseDate) LIMIT 2000"""))
ds("pipe_pastdue", "Past-due opps by rep",
   "Open EMEA New Business and Upsell opportunities whose close date has passed, per rep.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, COUNT(Id) pastDueOpps,
   SUM(Finance_ARR_USD__c) pastDueArrUsd FROM Opportunity
   WHERE IsClosed = false AND CloseDate < TODAY AND RecordType.Name != 'Renewal' AND {OWNER}
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name LIMIT 2000"""))
ds("pipe_stale", "Stale opps by rep",
   "Open EMEA New Business and Upsell opportunities closing this or next quarter with no logged activity in 30 days, per rep.",
   SF(f"""SELECT Owner.Name owner, COUNT(Id) staleOpps, SUM(Finance_ARR_USD__c) staleArrUsd FROM Opportunity
   WHERE {OPEN_WINDOW} AND RecordType.Name != 'Renewal' AND (LastActivityDate = null OR LastActivityDate < LAST_N_DAYS:30) AND {OWNER}
   GROUP BY Owner.Name LIMIT 2000"""))
ds("won_q", "Closed won this quarter",
   "EMEA closed-won opportunities this quarter (by the date they were actually closed, as in Bookings) by type, with the owner's role and manager now and when the deal closed (a deal counts for the team that closed it), in incremental ARR (USD).",
   SF(f"""SELECT Owner.UserRole.Name role, Owner.Manager.Name manager, Closed_Owner_Role__c closedRole, Closed_Owner_Manager__c closedManager,
   RecordType.Name recordType, COUNT(Id) wonOpps, SUM(Finance_ARR_USD__c) wonArrUsd FROM Opportunity
   WHERE IsWon = true AND Actual_Close_Date__c = THIS_FISCAL_QUARTER AND {CLOSED_BY}
   GROUP BY Owner.UserRole.Name, Owner.Manager.Name, Closed_Owner_Role__c, Closed_Owner_Manager__c, RecordType.Name LIMIT 2000"""))
ds("renew_stake", "Renewals at stake",
   "Open EMEA renewals closing this or next quarter by owner role, manager and stage, with the renewing contract ARR (USD).",
   SF(f"""SELECT Owner.UserRole.Name role, Owner.Manager.Name manager, StageName stage, FISCAL_YEAR(CloseDate) fy,
   FISCAL_QUARTER(CloseDate) fq, COUNT(Id) renewals, SUM(Order_Form_ARR_USD__c) renewingArrUsd, SUM(Finance_ARR_USD__c) netChangeArrUsd
   FROM Opportunity WHERE {OPEN_WINDOW} AND RecordType.Name = 'Renewal' AND {OWNER}
   GROUP BY Owner.UserRole.Name, Owner.Manager.Name, StageName, FISCAL_YEAR(CloseDate), FISCAL_QUARTER(CloseDate) LIMIT 2000"""))

# ---------- Created ----------
ds("cr_daily", "Created opps per day",
   "EMEA-owned opportunities created per day this quarter and last, by type, excluding renewals auto-created by Flow.",
   SF(f"""SELECT DAY_ONLY(convertTimezone(CreatedDate)) day, RecordType.Name rt, COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd
   FROM Opportunity WHERE (CreatedDate = THIS_FISCAL_QUARTER OR CreatedDate = LAST_FISCAL_QUARTER) AND {OWNER} AND {CREATED_NOT_FLOW}
   GROUP BY DAY_ONLY(convertTimezone(CreatedDate)), RecordType.Name ORDER BY DAY_ONLY(convertTimezone(CreatedDate)) LIMIT 2000"""))
ds("cr_monthly", "Created opps per month",
   "EMEA-owned opportunities created per month over the last 12 months, by type, excluding renewals auto-created by Flow.",
   SF(f"""SELECT CALENDAR_YEAR(convertTimezone(CreatedDate)) yr, CALENDAR_MONTH(convertTimezone(CreatedDate)) mo, RecordType.Name rt,
   COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd FROM Opportunity
   WHERE (CreatedDate = LAST_N_MONTHS:12 OR CreatedDate = THIS_MONTH) AND {OWNER} AND {CREATED_NOT_FLOW}
   GROUP BY CALENDAR_YEAR(convertTimezone(CreatedDate)), CALENDAR_MONTH(convertTimezone(CreatedDate)), RecordType.Name LIMIT 2000"""))
ds("cr_source", "Created opps by source",
   "EMEA-owned opportunities created this and last quarter by type, lead source, creator role and originating BDR role.",
   SF(f"""SELECT CALENDAR_YEAR(convertTimezone(CreatedDate)) yr, CALENDAR_QUARTER(convertTimezone(CreatedDate)) qtr, RecordType.Name rt,
   LeadSource leadSource, CreatedBy.UserRole.Name creatorRole, Originating_BDR_Role__c bdrRole, COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd
   FROM Opportunity WHERE (CreatedDate = THIS_FISCAL_QUARTER OR CreatedDate = LAST_FISCAL_QUARTER) AND {OWNER} AND {CREATED_NOT_FLOW}
   GROUP BY CALENDAR_YEAR(convertTimezone(CreatedDate)), CALENDAR_QUARTER(convertTimezone(CreatedDate)), RecordType.Name, LeadSource,
   CreatedBy.UserRole.Name, Originating_BDR_Role__c LIMIT 2000"""))
ds("cr_owner_q", "Created opps by rep",
   "EMEA opportunities created this quarter per owner and type, with how many a BDR sourced.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, RecordType.Name rt, COUNT(Id) opps,
   SUM(Finance_ARR_USD__c) arrUsd, COUNT(Originating_BDR__c) bdrSourced FROM Opportunity
   WHERE CreatedDate = THIS_FISCAL_QUARTER AND {OWNER} AND {CREATED_NOT_FLOW}
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, RecordType.Name LIMIT 2000"""))
ds("cr_bdr", "BDR-sourced opps",
   "Opportunities sourced by EMEA BDRs (BDR-EMEA and DIR-BDR-EMEA roles) this and last quarter, per BDR, whoever owns them; by the role stamped on the deal, or the BDR's current role when none was stamped; renewals auto-created by Flow left out.",
   SF(f"""SELECT CALENDAR_YEAR(convertTimezone(CreatedDate)) yr, CALENDAR_QUARTER(convertTimezone(CreatedDate)) qtr,
   Originating_BDR__r.Name bdr, Originating_BDR__r.Manager.Name bdrManager, COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd
   FROM Opportunity WHERE (CreatedDate = THIS_FISCAL_QUARTER OR CreatedDate = LAST_FISCAL_QUARTER) AND (Originating_BDR_Role__c IN ('BDR-EMEA', 'DIR-BDR-EMEA')
   OR (Originating_BDR_Role__c = null AND Originating_BDR__r.UserRole.Name IN ('BDR-EMEA', 'DIR-BDR-EMEA')))
   AND {CREATED_NOT_FLOW}
   GROUP BY CALENDAR_YEAR(convertTimezone(CreatedDate)), CALENDAR_QUARTER(convertTimezone(CreatedDate)), Originating_BDR__r.Name,
   Originating_BDR__r.Manager.Name LIMIT 2000"""))

# ---------- Routing ----------
ds("rr_members", "Routing pool members",
   "Members of every EMEA LeanData round-robin pool, with the member's role, active flag, status and when they were added.",
   SF(f"""SELECT LeanData__Pool__r.LeanData__Grouping_Name__c poolName, LeanData__OwnerId__c userId,
   LeanData__User_Owner__r.Name userName, LeanData__User_Owner__r.UserRole.Name userRole, LeanData__User_Owner__r.IsActive userActive,
   LeanData__Status__c memberStatus, MIN(CreatedDate) addedOn FROM LeanData__Round_Robin_Setting__c
   WHERE {pool_filter('LeanData__Pool__r')}
   GROUP BY LeanData__Pool__r.LeanData__Grouping_Name__c, LeanData__OwnerId__c, LeanData__User_Owner__r.Name,
   LeanData__User_Owner__r.UserRole.Name, LeanData__User_Owner__r.IsActive, LeanData__Status__c LIMIT 2000"""))
ds("rr_assign", "Routing assignments, 90 days",
   "Leads and records LeanData assigned through each EMEA pool per member in the last 90 days (counts only).",
   SF(f"""SELECT LeanData__Round_Robin_Pool__r.LeanData__Grouping_Name__c poolName, LeanData__Round_Robin_Chosen_OwnerId__c userId,
   COUNT(Id) assignments, MAX(CreatedDate) lastAssigned FROM LeanData__Log__c
   WHERE LeanData__Round_Robin_Pool__c != null AND CreatedDate = LAST_N_DAYS:90 AND {pool_filter('LeanData__Round_Robin_Pool__r')}
   GROUP BY LeanData__Round_Robin_Pool__r.LeanData__Grouping_Name__c, LeanData__Round_Robin_Chosen_OwnerId__c LIMIT 2000"""))
ds("roster", "EMEA sales roster",
   "Every Salesforce user in an EMEA sales role (UK&I excluded), active or not, with manager and created date.",
   SF(f"""SELECT Id userId, Name name, UserRole.Name role, Title title, Manager.Name manager, IsActive isActive,
   Legora_Start_Date__c startDate, DAY_ONLY(CreatedDate) createdDate FROM User WHERE UserRole.Name IN ({ROLES})
   GROUP BY Id, Name, UserRole.Name, Title, Manager.Name, IsActive, Legora_Start_Date__c, DAY_ONLY(CreatedDate) LIMIT 2000"""))

ds("users_all", "Salesforce users",
   "Every active standard Salesforce user, any role, with email and manager. Used to match HiBob people to Salesforce by email.",
   SF("""SELECT Id userId, Name name, Email email, UserRole.Name role, Manager.Name manager FROM User
   WHERE IsActive = true AND UserType = 'Standard' GROUP BY Id, Name, Email, UserRole.Name, Manager.Name LIMIT 2000"""))

# ---------- Hiring ----------
D["hb_people"] = {"title": "EMEA GTM people (HiBob)",
  "description": "Everyone on headcount in HiBob's GTM EMEA, Engagement EMEA and Growth EMEA departments, with work email, title, team, site, manager and start date.",
  "source": {"kind": "query", "connector": "HiBob", "tool": "commons_searchEmployees", "args": {
    "fieldsPaths": ["/root/id", "/root/displayName", "/root/email", "/work/title", "/work/department", "/work/custom/field_1775721273768",
                    "/work/site", "/work/reportsTo", "/work/secondLevelManager", "/work/startDate"],
    "filter": [{"fieldPath": "/work/department", "operator": "equals", "values": ["GTM EMEA", "Engagement EMEA", "Growth EMEA"]}]}}}

# ---------- Books ----------
ds("bk_owner", "Account book per owner",
   "Accounts and customer ARR (USD) owned by each EMEA rep, by account status.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, Owner.IsActive active, Account_Status__c status,
   COUNT(Id) accounts, SUM(ARR_USD__c) arrUsd FROM Account WHERE {OWNER}
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, Owner.IsActive, Account_Status__c LIMIT 2000"""))
ds("bk_pipe", "Open pipeline per owner",
   "All open opportunities per EMEA owner and type, any close date, in incremental ARR (USD).",
   SF(f"""SELECT Owner.Name owner, RecordType.Name motion, COUNT(Id) openOpps, SUM(Finance_ARR_USD__c) openArrUsd FROM Opportunity
   WHERE IsClosed = false AND {OWNER} GROUP BY Owner.Name, RecordType.Name LIMIT 2000"""))
ds("bk_em", "Engagement manager books",
   "Customer accounts and ARR (USD) per EMEA engagement manager (the account's Engagement Manager field).",
   SF(f"""SELECT CSM__r.Name em, CSM__r.UserRole.Name emRole, CSM__r.Manager.Name emManager, CSM__r.IsActive emActive, COUNT(Id) accounts,
   SUM(ARR_USD__c) arrUsd FROM Account WHERE CSM__r.UserRole.Name IN ({ROLES}) AND Account_Status__c = 'Customer'
   GROUP BY CSM__r.Name, CSM__r.UserRole.Name, CSM__r.Manager.Name, CSM__r.IsActive LIMIT 2000"""))
ds("bk_terr", "Territory coverage",
   "Accounts and ARR (USD) in each EMEA sales region (incl. LATAM) by owner role and account status.",
   SF(f"""SELECT Sales_Region__c salesRegion, Owner.UserRole.Name ownerRole, Account_Status__c status, COUNT(Id) accounts, SUM(ARR_USD__c) arrUsd
   FROM Account WHERE {GEO} GROUP BY Sales_Region__c, Owner.UserRole.Name, Account_Status__c LIMIT 2000"""))
ds("bk_orphans", "Orphan accounts",
   "Active accounts (customer, pipeline, engaging, or with ARR) in EMEA regions whose owner is inactive, has no role, is RevOps or sits outside EMEA.",
   SF(f"""SELECT Id accountId, Name account, Owner.Name owner, Owner.IsActive ownerActive, Owner.UserRole.Name ownerRole,
   BillingCountryCode country, Sales_Region__c salesRegion, Account_Status__c status, SUM(ARR_USD__c) arrUsd FROM Account
   WHERE {GEO} AND (Account_Status__c IN ('Customer','Pipeline','Engaging') OR ARR_USD__c > 0)
   AND (Owner.IsActive = false OR Owner.UserRoleId = null OR Owner.UserRole.Name = 'REVOPS' OR (NOT Owner.UserRole.Name LIKE '%EMEA%'))
   GROUP BY Id, Name, Owner.Name, Owner.IsActive, Owner.UserRole.Name, BillingCountryCode, Sales_Region__c, Account_Status__c
   ORDER BY SUM(ARR_USD__c) DESC NULLS LAST LIMIT 1500"""))
ds("bk_books", "Account books by owner",
   "Accounts per account book (Territory ID) and owner, for accounts in an EMEA sales region (LATAM included).",
   SF(f"""SELECT Territory_ID__c book, Owner.Name owner, Owner.UserRole.Name ownerRole, Owner.IsActive ownerActive, COUNT(Id) accounts,
   SUM(ARR_USD__c) arrUsd FROM Account WHERE Territory_ID__c != null AND {GEO}
   GROUP BY Territory_ID__c, Owner.Name, Owner.UserRole.Name, Owner.IsActive LIMIT 2000"""))


# ---------- Bookings, win rate and lost reasons ----------
ds("closed_rep", "Closed won and lost",
   "EMEA New Business and Upsell opportunities closed won or lost this quarter and last (by the date they were actually closed), per owner, type and lost reason, with the owner, role and manager now and when the deal closed (a deal counts for the team that closed it).",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, Closed_Owner__c closedOwner,
   Closed_Owner_Role__c closedRole, Closed_Owner_Manager__c closedManager, RecordType.Name rt, IsWon won,
   Closed_Reason__c lostReason, FISCAL_YEAR(Actual_Close_Date__c) fy, FISCAL_QUARTER(Actual_Close_Date__c) fq, COUNT(Id) opps,
   SUM(Finance_ARR_USD__c) arrUsd FROM Opportunity WHERE IsClosed = true
   AND (Actual_Close_Date__c = THIS_FISCAL_QUARTER OR Actual_Close_Date__c = LAST_FISCAL_QUARTER) AND RecordType.Name != 'Renewal' AND {CLOSED_BY}
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, Closed_Owner__c, Closed_Owner_Role__c, Closed_Owner_Manager__c,
   RecordType.Name, IsWon, Closed_Reason__c, FISCAL_YEAR(Actual_Close_Date__c), FISCAL_QUARTER(Actual_Close_Date__c) LIMIT 2000"""))
ds("cr_owner_m", "Created opps per rep per month",
   "EMEA-owned opportunities created per owner per month over the last 6 months and this one, with the first one each month (Flow renewals excluded).",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, CALENDAR_YEAR(convertTimezone(CreatedDate)) yr,
   CALENDAR_MONTH(convertTimezone(CreatedDate)) mo, RecordType.Name rt, COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd,
   MIN(CreatedDate) firstCreated FROM Opportunity WHERE (CreatedDate = LAST_N_MONTHS:6 OR CreatedDate = THIS_MONTH) AND {OWNER}
   AND {CREATED_NOT_FLOW} GROUP BY Owner.Name, Owner.UserRole.Name, CALENDAR_YEAR(convertTimezone(CreatedDate)),
   CALENDAR_MONTH(convertTimezone(CreatedDate)), RecordType.Name LIMIT 2000"""))
ds("pipe_nextstep", "Next-step dates",
   "Open EMEA New Business and Upsell opportunities closing this or next quarter with no next step at all (neither a note nor a date) or an overdue next-step date, per owner and quarter.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, FISCAL_YEAR(CloseDate) fy, FISCAL_QUARTER(CloseDate) fq,
   COUNT(Id) flaggedOpps, COUNT(Next_Steps_Date__c) overdueOpps, SUM(Finance_ARR_USD__c) flaggedArrUsd, MIN(Next_Steps_Date__c) oldestOverdue
   FROM Opportunity WHERE {OPEN_WINDOW} AND RecordType.Name != 'Renewal' AND (Next_Steps_Date__c < TODAY OR (Next_Steps_Date__c = null AND NextStep = null)) AND {OWNER}
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, FISCAL_YEAR(CloseDate), FISCAL_QUARTER(CloseDate) LIMIT 2000"""))

# ---------- Deal risk per rep ----------
ds("pipe_slips", "Close-date moves, 30 days",
   "Open EMEA New Business and Upsell opportunities whose latest close-date change was in the last 30 days, per owner, by the quarter the date moved from and to.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager,
   FISCAL_YEAR(LastCloseDateChangedHistory.PrevCloseDate) fromFy, FISCAL_QUARTER(LastCloseDateChangedHistory.PrevCloseDate) fromFq,
   FISCAL_YEAR(CloseDate) toFy, FISCAL_QUARTER(CloseDate) toFq, COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd,
   SUM(Close_Quarter_Push_Count__c) quarterPushes FROM Opportunity
   WHERE IsClosed = false AND RecordType.Name != 'Renewal' AND {OWNER}
   AND LastCloseDateChangedHistory.CreatedDate = LAST_N_DAYS:30 AND LastCloseDateChangedHistory.PrevCloseDate != null
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, FISCAL_YEAR(LastCloseDateChangedHistory.PrevCloseDate),
   FISCAL_QUARTER(LastCloseDateChangedHistory.PrevCloseDate), FISCAL_YEAR(CloseDate), FISCAL_QUARTER(CloseDate) LIMIT 2000"""))
ds("pipe_edits", "Close-date edits, 30 days",
   "Close-date edits on open EMEA New Business and Upsell opportunities in the last 30 days, per owner, including repeat edits of the same deal.",
   SF(f"""SELECT Opportunity.Owner.Name owner, COUNT(Id) closeDateEdits, COUNT_DISTINCT(OpportunityId) oppsEdited, MAX(CreatedDate) lastEdit
   FROM OpportunityFieldHistory WHERE Field = 'CloseDate' AND CreatedDate = LAST_N_DAYS:30 AND Opportunity.IsClosed = false
   AND Opportunity.RecordType.Name != 'Renewal' AND Opportunity.{OWNER} GROUP BY Opportunity.Owner.Name LIMIT 2000"""))
ds("pipe_early", "Early-stage deals this quarter",
   "Open EMEA New Business and Upsell opportunities closing this quarter that are still at stage 0 or 1, per owner.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd
   FROM Opportunity WHERE IsClosed = false AND CloseDate = THIS_FISCAL_QUARTER AND RecordType.Name != 'Renewal'
   AND (StageName LIKE '0%' OR StageName LIKE '1%') AND {OWNER} GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name LIMIT 2000"""))
ds("pipe_nocontact", "Deals with no contact role",
   "Open EMEA New Business and Upsell opportunities closing this quarter with no contact role, per owner.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, COUNT(Id) noContactOpps,
   SUM(Finance_ARR_USD__c) noContactArrUsd FROM Opportunity WHERE IsClosed = false AND CloseDate = THIS_FISCAL_QUARTER
   AND RecordType.Name != 'Renewal' AND {OWNER} AND Id NOT IN (SELECT OpportunityId FROM OpportunityContactRole)
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name LIMIT 2000"""))

# ---------- Deals (record level, for inspection) ----------
ds("top_deals", "Largest open deals",
   "The 300 largest open EMEA New Business and Upsell opportunities closing this or next quarter, with owner, stage, close date, forecast category, next step and its date, last activity, days in the current stage and age.",
   SF(f"""SELECT Id oppId, Name opp, Account.Name account, Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager,
   StageName stage, RecordType.Name rt, CloseDate closeDate, Rep_Forecast_Category__c forecast, NextStep nextStep,
   Next_Steps_Date__c nextStepDate, LastActivityDate lastActivity, DAY_ONLY(CreatedDate) createdDate, MAX(LastStageChangeInDays) daysInStage,
   MAX(AgeInDays) ageDays, SUM(Finance_ARR_USD__c) arrUsd FROM Opportunity
   WHERE {OPEN_WINDOW} AND RecordType.Name != 'Renewal' AND {OWNER}
   GROUP BY Id, Name, Account.Name, Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, StageName, RecordType.Name, CloseDate,
   Rep_Forecast_Category__c, NextStep, Next_Steps_Date__c, LastActivityDate, DAY_ONLY(CreatedDate)
   ORDER BY SUM(Finance_ARR_USD__c) DESC NULLS LAST LIMIT 300"""))
ds("top_renewals", "Largest open renewals",
   "The 300 largest open EMEA renewals closing this or next quarter by renewing contract ARR, with prior ARR, net change, stage, forecast, next step and last activity.",
   SF(f"""SELECT Id oppId, Name opp, Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, StageName stage,
   CloseDate closeDate, Rep_Forecast_Category__c forecast, NextStep nextStep, LastActivityDate lastActivity,
   SUM(Order_Form_ARR_USD__c) renewingArrUsd, SUM(Existing_ARR_USD__c) existingArrUsd, SUM(Finance_ARR_USD__c) netChangeArrUsd
   FROM Opportunity WHERE {OPEN_WINDOW} AND RecordType.Name = 'Renewal' AND {OWNER}
   GROUP BY Id, Name, Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, StageName, CloseDate, Rep_Forecast_Category__c,
   NextStep, LastActivityDate ORDER BY SUM(Order_Form_ARR_USD__c) DESC NULLS LAST LIMIT 300"""))
D["deals"] = {"title": "Open deals of one person",
  "description": "Every open opportunity (any type and close date, up to 200) owned by the person open in the person panel.",
  "source": {"kind": "query", **SF("""SELECT Id oppId, Name opp, Account.Name account, StageName stage, RecordType.Name rt, CloseDate closeDate,
   Rep_Forecast_Category__c forecast, NextStep nextStep, Next_Steps_Date__c nextStepDate, LastActivityDate lastActivity, MAX(LastStageChangeInDays) daysInStage,
   SUM(Finance_ARR_USD__c) arrUsd, SUM(Order_Form_ARR_USD__c) contractArrUsd FROM Opportunity WHERE IsClosed = false AND OwnerId = {{dealOwnerId}}
   GROUP BY Id, Name, Account.Name, StageName, RecordType.Name, CloseDate, Rep_Forecast_Category__c, NextStep, Next_Steps_Date__c, LastActivityDate
   ORDER BY CloseDate ASC LIMIT 200"""),
   "rules": {"dealOwnerId": {"type": "string", "pattern": "^005[A-Za-z0-9]{12}([A-Za-z0-9]{3})?$"}}}}

# ---------- Granola (each viewer's own notes) ----------
DATE = "^20[0-9]{2}-[01][0-9]-[0-3][0-9]$"
D["gr_notes"] = {"title": "Granola meeting notes",
  "description": "Your Granola meetings in the chosen window (notes you took or were invited to), with up to three attendees' emails; the page then reads each note and keeps every line of its summary and private notes, with the headings above it.",
  "source": {"kind": "query", "connector": "Granola", "tool": "list_meetings",
    "args": {"from_date": "{{gr_since}}", "to_date": "{{gr_until}}",
             "involvement": {"captured_by_me": True, "listed_as_participant": True},
             "max_participants": 3, "limit": 200},
    "rules": {"gr_since": {"type": "string", "pattern": DATE}, "gr_until": {"type": "string", "pattern": DATE}}}}


# ---------- Movement, aging, coverage, engagement ----------
NB_UP = "RecordType.Name IN ('New Business','Upsell')"
# days in stage past which an open deal counts as stuck: about 2x the open-deal median per stage, rounded to 5, at least 30
# by the stage number, not its name: stage 3 was renamed from '3 - Pilot Validation' to '3 - Validation' on 3 Nov 2026
STUCK = ("((StageName LIKE '0%' AND LastStageChangeInDays > 35) OR (StageName LIKE '1%' AND LastStageChangeInDays > 55)"
         " OR (StageName LIKE '2%' AND LastStageChangeInDays > 60) OR (StageName LIKE '3%' AND LastStageChangeInDays > 40)"
         " OR (StageName LIKE '4%' AND LastStageChangeInDays > 30) OR (StageName LIKE '5%' AND LastStageChangeInDays > 45)"
         " OR (StageName LIKE '6%' AND LastStageChangeInDays > 40))")
ds("mv_outcomes", "Won and lost, last 7 days",
   "EMEA New Business and Upsell deals closed won or lost in the last 7 days (by the date actually closed; admin merges and record clean-ups left out of lost), per owner, with the owner, role and manager now and when the deal closed (a deal counts for the team that closed it), in incremental ARR (USD).",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, Closed_Owner__c closedOwner,
   Closed_Owner_Role__c closedRole, Closed_Owner_Manager__c closedManager, IsWon won, COUNT(Id) n, SUM(Finance_ARR_USD__c) arr
   FROM Opportunity WHERE {NB_UP} AND {CLOSED_BY} AND IsClosed = true AND Actual_Close_Date__c = LAST_N_DAYS:7
   AND (IsWon = true OR Closed_Reason__c NOT IN ('Merged with Global Pilot','Record cleanup'))
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, Closed_Owner__c, Closed_Owner_Role__c, Closed_Owner_Manager__c, IsWon LIMIT 2000"""))
ds("mv_created", "Created, last 7 days",
   "EMEA New Business and Upsell opportunities created in the last 7 days, per owner and the fiscal quarter they close in, in incremental ARR (USD).",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, FISCAL_YEAR(CloseDate) toFY, FISCAL_QUARTER(CloseDate) toFQ,
   COUNT(Id) opps, SUM(Finance_ARR_USD__c) arr FROM Opportunity WHERE CreatedDate = LAST_N_DAYS:7 AND {NB_UP} AND {OWNER}
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, FISCAL_YEAR(CloseDate), FISCAL_QUARTER(CloseDate) LIMIT 2000"""))
ds("mv_close", "Close dates moved across this quarter, last 7 days",
   "Close-date changes in the last 7 days on open EMEA New Business and Upsell deals created before the window that moved a deal out of this quarter or into it, one row per deal and from/to fiscal quarter with the first and last time it happened, the current owner and the deal's current incremental ARR (USD).",
   SF(f"""SELECT OpportunityId oppId, Opportunity.Owner.Name owner, Opportunity.Owner.UserRole.Name role, Opportunity.Owner.Manager.Name manager,
   FISCAL_YEAR(PrevCloseDate) fromFY, FISCAL_QUARTER(PrevCloseDate) fromFQ, FISCAL_YEAR(CloseDate) toFY, FISCAL_QUARTER(CloseDate) toFQ,
   MIN(CreatedDate) firstAt, MAX(CreatedDate) lastAt, MAX(Opportunity.Finance_ARR_USD__c) arr FROM OpportunityHistory
   WHERE CreatedDate = LAST_N_DAYS:7 AND Opportunity.{NB_UP} AND Opportunity.{OWNER}
   AND Opportunity.IsClosed = false AND Opportunity.CreatedDate < LAST_N_DAYS:7
   AND ((PrevCloseDate = THIS_FISCAL_QUARTER AND (CloseDate > THIS_FISCAL_QUARTER OR CloseDate < THIS_FISCAL_QUARTER))
   OR ((PrevCloseDate > THIS_FISCAL_QUARTER OR PrevCloseDate < THIS_FISCAL_QUARTER) AND CloseDate = THIS_FISCAL_QUARTER))
   GROUP BY OpportunityId, Opportunity.Owner.Name, Opportunity.Owner.UserRole.Name, Opportunity.Owner.Manager.Name,
   FISCAL_YEAR(PrevCloseDate), FISCAL_QUARTER(PrevCloseDate), FISCAL_YEAR(CloseDate), FISCAL_QUARTER(CloseDate) LIMIT 2000"""))
ds("mv_fields", "Stage and Commit changes, last 7 days",
   "Stage and rep forecast category changes in the last 7 days on open EMEA New Business and Upsell deals created before the window, one row per change, with the deal's owner and current incremental ARR (USD).",
   SF(f"""SELECT OpportunityId, Opportunity.OwnerId, Opportunity.Finance_ARR_USD__c, Field, OldValue, NewValue, CreatedDate
   FROM OpportunityFieldHistory WHERE CreatedDate = LAST_N_DAYS:7 AND Field IN ('StageName','Rep_Forecast_Category__c')
   AND Opportunity.IsClosed = false AND Opportunity.CreatedDate < LAST_N_DAYS:7 AND Opportunity.{NB_UP} AND Opportunity.{OWNER}
   ORDER BY OpportunityId, CreatedDate, Id LIMIT 2000"""))
ds("age_stuck", "Stuck deals by rep",
   "Open EMEA New Business and Upsell deals closing this or next quarter that have sat in their stage longer than about twice the usual time (stage 0: 35 days, 1: 55, 2: 60, 3: 40, 4: 30, 5: 45, 6: 40), per owner and stage.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, StageName stage, COUNT(Id) stuckOpps,
   SUM(Finance_ARR_USD__c) stuckArrUsd, AVG(LastStageChangeInDays) avgDaysInStage, MAX(LastStageChangeInDays) maxDaysInStage FROM Opportunity
   WHERE {OPEN_WINDOW} AND {NB_UP} AND {STUCK} AND {OWNER}
   GROUP BY Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, StageName LIMIT 2000"""))
ds("cycle_team", "Sales cycle by team",
   "EMEA New Business and Upsell deals won in the last 4 completed quarters per type, with the owner's role and manager now and when the deal closed (a deal counts for the team that closed it), and the average and longest days from creation to close.",
   SF(f"""SELECT Owner.UserRole.Name role, Owner.Manager.Name manager, Closed_Owner_Role__c closedRole, Closed_Owner_Manager__c closedManager,
   RecordType.Name rt, COUNT(Id) wonOpps, AVG(Days_from_Created_to_Close_Date__c) avgCycleDays,
   MAX(Days_from_Created_to_Close_Date__c) maxCycleDays, SUM(Finance_ARR_USD__c) wonArrUsd FROM Opportunity
   WHERE IsWon = true AND {NB_UP} AND Actual_Close_Date__c = LAST_N_FISCAL_QUARTERS:4 AND {CLOSED_BY}
   GROUP BY Owner.UserRole.Name, Owner.Manager.Name, Closed_Owner_Role__c, Closed_Owner_Manager__c, RecordType.Name LIMIT 2000"""))
ds("coverage_base", "Bookings history and open pipeline",
   "EMEA New Business and Upsell won and lost in the last 4 completed quarters and this one (admin merges left out of lost; a closed deal counts for the team that closed it), and open pipeline closing this and next quarter (deals past due from earlier quarters left out, as on Pipeline), per owner role and manager now and when the deal closed, and fiscal quarter, in incremental ARR (USD).",
   SF(f"""SELECT Owner.UserRole.Name role, Owner.Manager.Name manager, Closed_Owner_Role__c closedRole, Closed_Owner_Manager__c closedManager,
   IsClosed closed, IsWon won, FISCAL_YEAR(Actual_Close_Date__c) fy,
   FISCAL_QUARTER(Actual_Close_Date__c) fq, SUM(Finance_ARR_USD__c) arr, COUNT(Id) n FROM Opportunity
   WHERE {NB_UP} AND (IsClosed = false OR IsWon = true OR Closed_Reason__c NOT IN ('Merged with Global Pilot','Record cleanup'))
   AND ((IsClosed = true AND {CLOSED_BY} AND (Actual_Close_Date__c = LAST_N_FISCAL_QUARTERS:4 OR Actual_Close_Date__c = THIS_FISCAL_QUARTER))
   OR (IsClosed = false AND {OWNER} AND (CloseDate = THIS_FISCAL_QUARTER OR CloseDate = NEXT_FISCAL_QUARTER)))
   GROUP BY Owner.UserRole.Name, Owner.Manager.Name, Closed_Owner_Role__c, Closed_Owner_Manager__c, IsClosed, IsWon,
   FISCAL_YEAR(Actual_Close_Date__c), FISCAL_QUARTER(Actual_Close_Date__c) LIMIT 2000"""))
ds("bk_stale", "Untouched active accounts",
   "Active accounts (customer, pipeline, engaging) of EMEA owners with no logged activity in 90 days or ever, per owner and status, with how many were ever touched and how many have an Engagement Manager.",
   SF(f"""SELECT Owner.Name owner, Account_Status__c status, COUNT(Id) accounts, COUNT(LastActivityDate) everTouched, COUNT(CSM__c) withEm,
   SUM(ARR_USD__c) arrUsd FROM Account WHERE {OWNER} AND Account_Status__c IN ('Customer','Pipeline','Engaging')
   AND (LastActivityDate < LAST_N_DAYS:90 OR LastActivityDate = null) GROUP BY Owner.Name, Account_Status__c LIMIT 2000"""))
ds("bk_em_cover", "Engagement Manager coverage",
   "Customers of EMEA owners grouped by their Engagement Manager's role and whether that user is active (blank when there is none), with customer ARR (USD).",
   SF(f"""SELECT Owner.Name owner, CSM__r.UserRole.Name emRole, CSM__r.IsActive emActive, COUNT(Id) customers, COUNT(CSM__c) withEm,
   SUM(ARR_USD__c) arrUsd FROM Account WHERE {OWNER} AND Account_Status__c = 'Customer'
   GROUP BY Owner.Name, CSM__r.UserRole.Name, CSM__r.IsActive LIMIT 2000"""))

# ---------- Leavers ----------
ds("lv_opps", "Open deals owned by people who left",
   "Open opportunities of every type whose owner is an inactive Salesforce user with an EMEA role, per owner and type: how many, incremental ARR and contract ARR (USD), and the next close date.",
   SF(f"""SELECT OwnerId ownerId, Owner.Name owner, Owner.UserRole.Name role, Owner.Manager.Name manager, RecordType.Name rt,
   COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd, SUM(Order_Form_ARR_USD__c) contractArrUsd, MIN(CloseDate) nextClose
   FROM Opportunity WHERE IsClosed = false AND Owner.IsActive = false AND {OWNER}
   GROUP BY OwnerId, Owner.Name, Owner.UserRole.Name, Owner.Manager.Name, RecordType.Name LIMIT 2000"""))
ds("lv_leads", "Open leads owned by people who left",
   "Leads that are neither converted nor disqualified whose owner is an inactive Salesforce user with an EMEA role, counted per owner and status.",
   SF(f"""SELECT OwnerId ownerId, Status status, COUNT(Id) leads FROM Lead
   WHERE IsConverted = false AND Status NOT IN ('Disqualified','Converted')
   AND OwnerId IN (SELECT Id FROM User WHERE IsActive = false AND UserRole.Name IN ({ROLES}))
   GROUP BY OwnerId, Status LIMIT 2000"""))

# ---------- Leads ----------
# In scope: owned by an EMEA seller (any country), or EMEA by country (Region__c, a formula: filter only, never group)
# or by LeanData routing region, whoever owns it (the Marketing Queue included). The owner filter uses
# Owner.UserRole.Name IN because a semi-join inside an OR fails. No lead names, emails, phones, companies or Ids are read.
# LATAM is EMEA's (accounts, pools and roles already are), but LeanData files LATAM leads under the routing region
# 'Rest of World' or 'North America' with the sub-region 'LATAM'
LEAD_SCOPE = f"({OWNER} OR Region__c = 'EMEA' OR Routing_Region__c = 'EMEA' OR Routing_Sub_Region__c = 'LATAM')"
LEAD_OPEN = "IsConverted = false AND Status NOT IN ('Disqualified','Converted')"
ds("ld_ready", "Ready leads now",
   "Leads in Ready now (not converted) that an EMEA seller owns, or that are EMEA by country or LeanData routing region (LATAM included) whoever owns them (the Marketing Queue, other teams). Grouped per owner, LeanData routing region and sub-region, lead source and detail, and the UTC day they became Ready, with the earliest created date. Counts only.",
   SF(f"""SELECT OwnerId ownerId, Owner.Name owner, Owner.Type ownerType, Owner.UserRole.Name ownerRole, Owner.IsActive ownerActive,
   Routing_Region__c routingRegion, Routing_Sub_Region__c routingSub, LeadSource src, Lead_Source_Details__c detail, DAY_ONLY(Ready_Since__c) readyDay, COUNT(Id) leads,
   MIN(CreatedDate) firstCreated FROM Lead WHERE Status = 'Ready' AND IsConverted = false AND {LEAD_SCOPE}
   GROUP BY OwnerId, Owner.Name, Owner.Type, Owner.UserRole.Name, Owner.IsActive, Routing_Region__c, Routing_Sub_Region__c, LeadSource, Lead_Source_Details__c,
   DAY_ONLY(Ready_Since__c) LIMIT 2000"""))
# one row per lead (GROUP BY Id without selecting it): exact times for business-hour speed, but no Id or prospect detail
ds("ld_handoffs", "Lead hand-offs, last 30 days",
   "Leads in scope whose Ready Since stamp is in the last 30 days, one row per lead but without its Id or any prospect detail: current owner (type, role, active), lead source and detail, status, converted flag, and the exact Ready Since, First Response and Last Routed (LeanData, to a person) times.",
   SF(f"""SELECT OwnerId ownerId, Owner.Type ownerType, Owner.Name owner, Owner.UserRole.Name ownerRole, Owner.IsActive ownerActive,
   LeadSource src, Lead_Source_Details__c detail, Status status, IsConverted converted, MIN(Ready_Since__c) readyAt,
   MIN(First_Response_Timestamp__c) respAt, MIN(Last_Assigned_Date__c) routedAt FROM Lead
   WHERE Ready_Since__c = LAST_N_DAYS:30 AND {LEAD_SCOPE}
   GROUP BY Id, OwnerId, Owner.Type, Owner.Name, Owner.UserRole.Name, Owner.IsActive, LeadSource, Lead_Source_Details__c, Status, IsConverted
   ORDER BY MIN(Ready_Since__c) DESC LIMIT 2000"""))
ds("ld_inflow", "Leads created, last 30 days",
   "Leads in scope created in the last 30 days, by lead source and detail, owner type and role, LeanData routing sub-region, status and LeanData routing action, with how many were stamped Ready and how many LeanData routed to a person (Last Routed Date). Counts only.",
   SF(f"""SELECT LeadSource src, Lead_Source_Details__c detail, Owner.Type ownerType, Owner.UserRole.Name ownerRole,
   Routing_Sub_Region__c subRegion, Status status, LeanData__Routing_Action__c routing, COUNT(Id) leads,
   COUNT(Ready_Since__c) readyStamped, COUNT(Last_Assigned_Date__c) routedToPerson FROM Lead
   WHERE CreatedDate = LAST_N_DAYS:30 AND {LEAD_SCOPE}
   GROUP BY LeadSource, Lead_Source_Details__c, Owner.Type, Owner.UserRole.Name, Routing_Sub_Region__c, Status,
   LeanData__Routing_Action__c LIMIT 2000"""))
ds("ld_open", "Open leads per owner",
   "Open leads in scope (neither converted nor disqualified) per owner (a person or a queue), owner role and active flag, status, lifecycle stage and LeanData routing status and action, with how many and when LeanData last processed one of them. Counts only.",
   SF(f"""SELECT OwnerId ownerId, Owner.Type ownerType, Owner.Name owner, Owner.UserRole.Name ownerRole, Owner.IsActive ownerActive,
   Status status, Lifecycle_Stage__c lifecycle, LeanData__Routing_Status__c ldStatus, LeanData__Routing_Action__c ldAction,
   COUNT(Id) leads, MAX(LeanData__Reporting_Timestamp__c) lastProcessed FROM Lead WHERE {LEAD_OPEN} AND {LEAD_SCOPE}
   GROUP BY OwnerId, Owner.Type, Owner.Name, Owner.UserRole.Name, Owner.IsActive, Status, Lifecycle_Stage__c,
   LeanData__Routing_Status__c, LeanData__Routing_Action__c LIMIT 2000"""))

# ---------- Activity ----------
# Counts only: no subject, description, email text, person or account name or record Id is read.
# Emails: an email task with a sent Email Message (Einstein Activity Capture's copy of the owner's mailbox, which includes
# emails sent through Outreach). The direction comes from EmailMessage.Incoming because Task.Inbound_Email__c is hidden
# from 139 of 140 EMEA users. The semi-join must stay at the top level of WHERE (never inside an OR).
SENT = "TaskSubtype = 'Email' AND Id IN (SELECT ActivityId FROM EmailMessage WHERE Incoming = false AND CreatedDate = LAST_N_DAYS:{d})"
# Meetings: calendar records with a contact, lead or account (not Legora's own), not all-day; LeanData BookIt
# copies marked Canceled or Rescheduled left out. Duplicates are removed in the count (one meeting per start time).
EXT = ("IsAllDayEvent = false AND (WhoId != null OR AccountId != null) AND (NOT Account.Name LIKE 'Legora%') "
       "AND (BookIt_Meeting_Status__c = null OR BookIt_Meeting_Status__c NOT IN ('Canceled','Rescheduled'))")
ds("act_mail", "Emails sent, last 4 weeks",
   "Emails EMEA sellers sent in the 28 days to yesterday (by the email's date), as Einstein Activity Capture copied them from their mailbox (Outreach sends included): email tasks with a sent, not incoming, Email Message. Per owner and the account's status today: emails, distinct people and accounts emailed, and when the last one was captured. Received mail, Outreach's own email log (it repeats the mailbox copy and logs prospect replies as outbound), automation emails with no captured message and RevOps admin tasks are left out. Counts only.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Account.Account_Status__c acct, COUNT(Id) emails, COUNT_DISTINCT(WhoId) people,
   COUNT_DISTINCT(AccountId) accounts, MAX(CreatedDate) lastAt FROM Task WHERE {SENT.format(d=35)}
   AND ActivityDate = LAST_N_DAYS:28 AND ActivityDate < TODAY AND {OWNER}
   GROUP BY Owner.Name, Owner.UserRole.Name, Account.Account_Status__c LIMIT 2000"""))
ds("act_mail_prev", "Emails sent, the 4 weeks before",
   "The same sent emails dated 29 to 56 days ago, per owner and account status, with the first and last capture time, so the page can tell whether capture covered the whole earlier window. Counts only.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Account.Account_Status__c acct, COUNT(Id) emails, COUNT_DISTINCT(WhoId) people,
   COUNT_DISTINCT(AccountId) accounts, MIN(CreatedDate) firstAt, MAX(CreatedDate) lastAt FROM Task WHERE {SENT.format(d=63)}
   AND ActivityDate = LAST_N_DAYS:56 AND ActivityDate < LAST_N_DAYS:28 AND {OWNER}
   GROUP BY Owner.Name, Owner.UserRole.Name, Account.Account_Status__c LIMIT 2000"""))
ds("act_meet", "Meetings, last 4 weeks and next 2",
   "Calendar records of EMEA sellers with a contact, lead or account (not Legora's own), not all-day, that started in the 28 days to yesterday (past = true) or start in the 14 days from tomorrow (past = false). Per owner, past or booked, and the account's status: records, meetings (distinct start times), distinct accounts and people, and the first and last start. LeanData BookIt meetings marked Canceled or Rescheduled are left out. Counts only.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Activity_in_Past__c past, Account.Account_Status__c acct, COUNT(Id) events,
   COUNT_DISTINCT(StartDateTime) meetings, COUNT_DISTINCT(AccountId) accounts, COUNT_DISTINCT(WhoId) people, MIN(StartDateTime) firstAt,
   MAX(StartDateTime) lastAt FROM Event WHERE ((StartDateTime = LAST_N_DAYS:28 AND StartDateTime < TODAY) OR StartDateTime = NEXT_N_DAYS:14)
   AND {EXT} AND {OWNER}
   GROUP BY Owner.Name, Owner.UserRole.Name, Activity_in_Past__c, Account.Account_Status__c LIMIT 2000"""))
ds("act_meet_prev", "Meetings, the 4 weeks before",
   "The same meetings that started 29 to 56 days ago, per owner and account status, with the first and last start, so the page can tell whether calendar capture covered the whole earlier window. Counts only.",
   SF(f"""SELECT Owner.Name owner, Owner.UserRole.Name role, Account.Account_Status__c acct, COUNT(Id) events,
   COUNT_DISTINCT(StartDateTime) meetings, COUNT_DISTINCT(AccountId) accounts, COUNT_DISTINCT(WhoId) people, MIN(StartDateTime) firstAt,
   MAX(StartDateTime) lastAt FROM Event WHERE StartDateTime = LAST_N_DAYS:56 AND StartDateTime < LAST_N_DAYS:28
   AND {EXT} AND {OWNER}
   GROUP BY Owner.Name, Owner.UserRole.Name, Account.Account_Status__c LIMIT 2000"""))

# ---------- Conversion ----------
# What happens to the New Business (and Upsell) opps EMEA creates. Counts and sums only: no opportunity, account or
# person name outside Legora and no record Id is read (cv_days groups by Id without selecting it, like ld_handoffs).
# Stages are read by number from the IRO stage entry dates, so the 3 Nov 2026 rename of stage 3 doesn't matter.
# Admin merges ('Merged with Global Pilot', 'Record cleanup') are left out, except in cv_window, which counts them.
# Closed deals count for the team that closed them (CLOSED_BY, as in Bookings and Coverage): a deal an EMEA seller
# closed that now sits outside EMEA still counts for them. Open deals follow the owner today (OWNER).
CV_COHORTS = "(CreatedDate = LAST_N_FISCAL_QUARTERS:4 OR CreatedDate = THIS_FISCAL_QUARTER)"
CV_CREATED = "FISCAL_YEAR(convertTimezone(CreatedDate)), FISCAL_QUARTER(convertTimezone(CreatedDate))"
CV_STAMPS = ", ".join([f"COUNT(IRO_Stage_{k}_Date_Stamp__c) s{k}" for k in range(7)]
                      + ["COUNT(IRO_Closed_Won_Date_Stamp__c) cwStamp", "COUNT(IRO_Closed_Lost_Date_Stamp__c) clStamp"])
CV_REAL = "(IsWon = true OR Closed_Reason__c = null OR Closed_Reason__c NOT IN ('Merged with Global Pilot','Record cleanup'))"
CV_DAYS = ", ".join(f"MAX(Days_in_Stage_{k}__c) d{k}" for k in range(7))
CV_CLOSE_WINDOW = "(Actual_Close_Date__c = LAST_N_FISCAL_QUARTERS:4 OR Actual_Close_Date__c = THIS_FISCAL_QUARTER)"
# the team that closed a deal is SMB: its role at close when that is an EMEA sales role, else the owner's role today
# (none stamped, or a role at close outside EMEA sales such as another region's or RevOps), as the calcs read it
CV_NOT_SMB = f"(Closed_Owner_Role__c != 'SMB-EMEA' AND (Closed_Owner_Role__c IN ({ROLES}) OR Owner.UserRole.Name != 'SMB-EMEA'))"
ds("cv_open", "Open opps by created quarter",
   "Open EMEA New Business and Upsell opportunities of any age, by type, the quarter they were created in (in your Salesforce time zone), owner role and the owner's manager: how many, their incremental ARR (USD), how many carry each stage entry date (stage 0 to 6; a skipped stage is dated too) and how many were marked Closed Won or Closed Lost before and reopened. Counts and sums only.",
   SF(f"""SELECT RecordType.Name rt, FISCAL_YEAR(convertTimezone(CreatedDate)) fy, FISCAL_QUARTER(convertTimezone(CreatedDate)) fq,
   Owner.UserRole.Name role, Owner.Manager.Name manager, COUNT(Id) n, SUM(Finance_ARR_USD__c) arr, {CV_STAMPS}
   FROM Opportunity WHERE {NB_UP} AND {OWNER} AND IsClosed = false
   GROUP BY RecordType.Name, {CV_CREATED}, Owner.UserRole.Name, Owner.Manager.Name LIMIT 2000"""))
ds("cv_closed", "Won and lost opps by created quarter",
   "EMEA New Business and Upsell opportunities created in the last 4 completed quarters and this one (in your Salesforce time zone) that are now closed won or lost, admin merges ('Merged with Global Pilot', 'Record cleanup') left out, with the owner's role and manager now and when the deal closed (a deal counts for the team that closed it, also when it is owned outside EMEA today), won or lost, and the quarter it was actually closed (Actual Close Date): how many, their incremental ARR (USD), how many carry each stage entry date (0 to 6) and the Closed Won and Closed Lost entry dates. Counts and sums only.",
   SF(f"""SELECT RecordType.Name rt, FISCAL_YEAR(convertTimezone(CreatedDate)) fy, FISCAL_QUARTER(convertTimezone(CreatedDate)) fq,
   Owner.UserRole.Name role, Owner.Manager.Name manager, Closed_Owner_Role__c closedRole, Closed_Owner_Manager__c closedManager, IsWon won,
   FISCAL_YEAR(Actual_Close_Date__c) cfy, FISCAL_QUARTER(Actual_Close_Date__c) cfq, COUNT(Id) n, SUM(Finance_ARR_USD__c) arr, {CV_STAMPS}
   FROM Opportunity WHERE {NB_UP} AND {CLOSED_BY} AND IsClosed = true AND {CV_COHORTS} AND {CV_REAL}
   GROUP BY RecordType.Name, {CV_CREATED}, Owner.UserRole.Name, Owner.Manager.Name, Closed_Owner_Role__c, Closed_Owner_Manager__c, IsWon,
   FISCAL_YEAR(Actual_Close_Date__c), FISCAL_QUARTER(Actual_Close_Date__c) LIMIT 2000"""))
ds("cv_window", "New Business closed, last 4 quarters",
   "EMEA New Business closed won or lost in the last 4 completed quarters and this one, by the date it was actually closed, for the team that closed it (also when it is owned outside EMEA today): by close quarter, owner role now and when the deal closed, won or lost, the last stage before close and the lost reason (the list retired on 3 Nov 2026 and the new one): how many and their incremental ARR (USD). Admin merges are kept so they can be counted, and left out of every figure. Counts and sums only.",
   SF(f"""SELECT FISCAL_YEAR(Actual_Close_Date__c) fy, FISCAL_QUARTER(Actual_Close_Date__c) fq, Owner.UserRole.Name role,
   Closed_Owner_Role__c closedRole, IsWon won, IRO_Last_Stage_Before_Close__c lastStage, Closed_Reason__c reason, COUNT(Id) n,
   SUM(Finance_ARR_USD__c) arr FROM Opportunity WHERE RecordType.Name = 'New Business' AND {CLOSED_BY} AND IsClosed = true
   AND {CV_CLOSE_WINDOW}
   GROUP BY FISCAL_YEAR(Actual_Close_Date__c), FISCAL_QUARTER(Actual_Close_Date__c), Owner.UserRole.Name, Closed_Owner_Role__c,
   IsWon, IRO_Last_Stage_Before_Close__c, Closed_Reason__c LIMIT 2000"""))
ds("cv_lost_month", "New Business lost by month",
   "EMEA New Business closed lost in the last 4 completed quarters and this one, for the team that closed it, admin merges left out: how many per calendar month of the date actually closed. It finds a one-month burst of losses, such as a pipeline clean-up. Counts only.",
   SF(f"""SELECT CALENDAR_YEAR(Actual_Close_Date__c) yr, CALENDAR_MONTH(Actual_Close_Date__c) mo, COUNT(Id) n FROM Opportunity
   WHERE RecordType.Name = 'New Business' AND {CLOSED_BY} AND IsClosed = true AND IsWon = false AND {CV_CLOSE_WINDOW}
   AND (Closed_Reason__c = null OR Closed_Reason__c NOT IN ('Merged with Global Pilot','Record cleanup'))
   GROUP BY CALENDAR_YEAR(Actual_Close_Date__c), CALENDAR_MONTH(Actual_Close_Date__c) LIMIT 2000"""))
ds("cv_source", "New Business by source",
   "EMEA New Business closed won or lost in the last 4 completed quarters (by the date actually closed; admin merges left out; for the team that closed it), plus every open one an EMEA role owns, by lead source, the originating BDR's role (stamped on the deal, and the BDR's role today), the creator's role, owner role now and when the deal closed, open or closed, and won or lost: how many, incremental ARR (USD), and the days from creation to the close date added up, with how many deals had them. Counts and sums only.",
   SF(f"""SELECT LeadSource src, Originating_BDR_Role__c bdrRole, Originating_BDR__r.UserRole.Name bdrNow, CreatedBy.UserRole.Name creatorRole,
   Owner.UserRole.Name role, Closed_Owner_Role__c closedRole, IsClosed closed, IsWon won, COUNT(Id) n, SUM(Finance_ARR_USD__c) arr,
   SUM(Days_from_Created_to_Close_Date__c) cycleDays, COUNT(Days_from_Created_to_Close_Date__c) cycleN FROM Opportunity
   WHERE RecordType.Name = 'New Business' AND ((IsClosed = false AND {OWNER}) OR (IsClosed = true AND {CLOSED_BY}
   AND Actual_Close_Date__c = LAST_N_FISCAL_QUARTERS:4 AND {CV_REAL}))
   GROUP BY LeadSource, Originating_BDR_Role__c, Originating_BDR__r.UserRole.Name, CreatedBy.UserRole.Name, Owner.UserRole.Name,
   Closed_Owner_Role__c, IsClosed, IsWon LIMIT 2000"""))
ds("cv_days", "Days in each stage of recent wins",
   "EMEA New Business won in the last 90 days (deals SMB closed: the last 30 days), for the team that closed it, one row per deal but without its Id, name, account or ARR: owner role and the owner's manager now and when the deal closed, the days the deal spent in each stage 0 to 6 (from one stage entry date to the next; 0 for a stage passed the same day or skipped), the days from creation to the win, and its Closed Won entry date and close date (to spot wins reopened and won again).",
   SF(f"""SELECT Owner.UserRole.Name role, Owner.Manager.Name manager, Closed_Owner_Role__c closedRole, Closed_Owner_Manager__c closedManager,
   {CV_DAYS}, MAX(Days_from_Created_to_Close_Date__c) daysToWin, MAX(IRO_Closed_Won_Date_Stamp__c) cwAt, MAX(Actual_Close_Date__c) closeAt
   FROM Opportunity WHERE RecordType.Name = 'New Business' AND {CLOSED_BY} AND IsWon = true AND Actual_Close_Date__c = LAST_N_DAYS:90
   AND ({CV_NOT_SMB} OR Actual_Close_Date__c = LAST_N_DAYS:30)
   GROUP BY Id, Owner.UserRole.Name, Owner.Manager.Name, Closed_Owner_Role__c, Closed_Owner_Manager__c LIMIT 2000"""))

# ---------- 1:1s ----------
CAL_DAY = r"^\d{4}-\d{2}-\d{2}T00:00:00$"
D["cal_events"] = {"title": "Your calendar, next 14 days",
  "description": "Your Google Calendar events from today for the next 14 days (regular events only), with who is invited; the page keeps the 1:1s with a colleague.",
  "source": {"kind": "query", "connector": "Google Calendar", "tool": "list_events",
    "args": {"startTime": "{{cal_from}}", "endTime": "{{cal_to}}", "orderBy": "startTime", "pageSize": 250, "eventType": ["DEFAULT"]},
    "rules": {"cal_from": {"type": "string", "pattern": CAL_DAY}, "cal_to": {"type": "string", "pattern": CAL_DAY}}}}
D["sf_me"] = {"title": "You in Salesforce",
  "description": "Who you are in Salesforce (user, role, title, manager and time zone), so the Home greeting has your name, the team scorecard can start from your own direct reports and the Activity view can say when your Salesforce time zone shifts its days.",
  "source": {"kind": "query", "connector": "Salesforce", "tool": "getUserInfo", "args": {}}}

json.dump(D, open('datasets.json', 'w'), indent=1)
print(len(D), 'datasets')
