"""Builds datasets.json: every live query the EMEA RevOps OS dashboard runs.
Scope and field choices are documented in ../README.md."""
import json

ROLES = ("'AE-EMEA-FR','AE-EMEA-DACH','AE-EMEA-SOUTH','AE-EMEA-CEE','AE-EMEA-BENELUX',"
         "'AE-EMEA-MEA','AE-EMEA-IBERIA-LATAM','AE-EMEA-NORDICS','SMB-EMEA','EM-EMEA',"
         "'EM-EMEA-LATAM','BDR-EMEA','DIR-SALES-EMEA','MGR-SALES-EMEA','VP-SALES-EMEA',"
         "'DIR-EM-EMEA','DIR-BDR-EMEA'")
OWNER = f"Owner.UserRole.Name IN ({ROLES})"
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
   "Open EMEA opportunities closing this or next quarter, by owner role, manager, type, stage and rep forecast category, in incremental ARR (USD).",
   SF(f"""SELECT Owner.UserRole.Name role, Owner.Manager.Name manager, RecordType.Name recordType, StageName stage,
   Rep_Forecast_Category__c forecast, FISCAL_YEAR(CloseDate) fy, FISCAL_QUARTER(CloseDate) fq, COUNT(Id) opps,
   SUM(Finance_ARR_USD__c) arrUsd, SUM(Incremental_Rep_Commit_ARR_USD__c) commitUsd, SUM(Incremental_Rep_Best_Case_ARR_USD__c) bestCaseUsd
   FROM Opportunity WHERE {OPEN_WINDOW} AND {OWNER}
   GROUP BY Owner.UserRole.Name, Owner.Manager.Name, RecordType.Name, StageName, Rep_Forecast_Category__c, FISCAL_YEAR(CloseDate), FISCAL_QUARTER(CloseDate)
   ORDER BY Owner.UserRole.Name, Owner.Manager.Name LIMIT 2000"""))
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
   "EMEA closed-won opportunities this quarter by owner role, manager and type, in incremental ARR (USD).",
   SF(f"""SELECT Owner.UserRole.Name role, Owner.Manager.Name manager, RecordType.Name recordType, COUNT(Id) wonOpps,
   SUM(Finance_ARR_USD__c) wonArrUsd FROM Opportunity WHERE IsWon = true AND CloseDate = THIS_FISCAL_QUARTER AND {OWNER}
   GROUP BY Owner.UserRole.Name, Owner.Manager.Name, RecordType.Name LIMIT 2000"""))
ds("renew_stake", "Renewals at stake",
   "Open EMEA renewals closing this or next quarter by owner role, manager and stage, with the renewing contract ARR (USD).",
   SF(f"""SELECT Owner.UserRole.Name role, Owner.Manager.Name manager, StageName stage, FISCAL_YEAR(CloseDate) fy,
   FISCAL_QUARTER(CloseDate) fq, COUNT(Id) renewals, SUM(Order_Form_ARR_USD__c) renewingArrUsd, SUM(Finance_ARR_USD__c) netChangeArrUsd
   FROM Opportunity WHERE {OPEN_WINDOW} AND RecordType.Name = 'Renewal' AND {OWNER}
   GROUP BY Owner.UserRole.Name, Owner.Manager.Name, StageName, FISCAL_YEAR(CloseDate), FISCAL_QUARTER(CloseDate) LIMIT 2000"""))

# ---------- Created ----------
ds("cr_daily", "Created opps per day",
   "EMEA-owned opportunities created per day over the last 13 weeks, by type, excluding renewals auto-created by Flow.",
   SF(f"""SELECT DAY_ONLY(convertTimezone(CreatedDate)) day, RecordType.Name rt, COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd
   FROM Opportunity WHERE (CreatedDate = LAST_N_WEEKS:12 OR CreatedDate = THIS_WEEK) AND {OWNER} AND {CREATED_NOT_FLOW}
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
   "Opportunities sourced by EMEA BDRs this and last quarter, per BDR, whoever owns them.",
   SF("""SELECT CALENDAR_YEAR(convertTimezone(CreatedDate)) yr, CALENDAR_QUARTER(convertTimezone(CreatedDate)) qtr,
   Originating_BDR__r.Name bdr, Originating_BDR__r.Manager.Name bdrManager, COUNT(Id) opps, SUM(Finance_ARR_USD__c) arrUsd
   FROM Opportunity WHERE (CreatedDate = THIS_FISCAL_QUARTER OR CreatedDate = LAST_FISCAL_QUARTER) AND Originating_BDR_Role__c LIKE '%EMEA%'
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

# ---------- Hiring ----------
D["hb_people"] = {"title": "EMEA GTM people (HiBob)",
  "description": "Everyone on headcount in HiBob's GTM EMEA, Engagement EMEA and Growth EMEA departments, with title, team, site, manager and start date.",
  "source": {"kind": "query", "connector": "HiBob", "tool": "commons_searchEmployees", "args": {
    "fieldsPaths": ["/root/id", "/root/displayName", "/work/title", "/work/department", "/work/custom/field_1775721273768",
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
   "Accounts per account book (Territory ID) and owner, for EMEA owners or EMEA regions.",
   SF(f"""SELECT Territory_ID__c book, Owner.Name owner, Owner.UserRole.Name ownerRole, Owner.IsActive ownerActive, COUNT(Id) accounts,
   SUM(ARR_USD__c) arrUsd FROM Account WHERE Territory_ID__c != null AND ({OWNER} OR {GEO})
   GROUP BY Territory_ID__c, Owner.Name, Owner.UserRole.Name, Owner.IsActive LIMIT 2000"""))


# ---------- Granola (each viewer's own notes) ----------
DATE = "^20[0-9]{2}-[01][0-9]-[0-3][0-9]$"
D["gr_notes"] = {"title": "Granola meeting notes",
  "description": "Your Granola meetings in the chosen window (notes you took or were invited to); the page then reads each note and keeps every line of its summary and private notes, with the headings above it.",
  "source": {"kind": "query", "connector": "Granola", "tool": "list_meetings",
    "args": {"from_date": "{{gr_since}}", "to_date": "{{gr_until}}",
             "involvement": {"captured_by_me": True, "listed_as_participant": True},
             "max_participants": 0, "limit": 200},
    "rules": {"gr_since": {"type": "string", "pattern": DATE}, "gr_until": {"type": "string", "pattern": DATE}}}}


json.dump(D, open('datasets.json', 'w'), indent=1)
print(len(D), 'datasets')
