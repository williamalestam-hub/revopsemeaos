const calcs = {};
global.dash = { calc: (id, o) => { calcs[id] = o; }, loader: () => {}, params: () => ({}), setParams: () => {}, onData: () => {}, draw: () => {}, colors: [], setLink: () => {}, data: () => ({ status: 'loading', data: [] }) };
global.window = global; global.location = { hash: '' }; global.document = { querySelectorAll: () => [], addEventListener: () => {} }; global.d3 = { format: () => (v) => String(v), utcFormat: () => (d) => String(d) }; global.requestAnimationFrame = (f) => f();
require('/home/user/revopsemeaos/dashboard/os-core.js');
require('/home/user/revopsemeaos/dashboard/os-calcs.js');
const today = new Date(); const iso = (d) => d.toISOString().slice(0,10);
const y = today.getUTCFullYear(), q = Math.floor(today.getUTCMonth()/3)+1;
const nq = q===4?{fy:y+1,fq:1}:{fy:y,fq:q+1};
const data = {
  pipe_stage: [{role:'AE-EMEA-DACH',manager:'M1',recordType:'New Business',stage:'4 - Commercial agreement',forecast:'Commit',fy:y,fq:q,opps:3,arrUsd:300,commitUsd:200,bestCaseUsd:250},
               {role:'AE-EMEA-FR',manager:null,recordType:'Upsell',stage:'1 - Solution agreement',forecast:null,...nq,opps:1,arrUsd:50,commitUsd:0,bestCaseUsd:0},
               {role:'EM-EMEA',manager:'M2',recordType:'Renewal',stage:'0 - Qualification',fy:y,fq:q,opps:9,arrUsd:-5}],
  won_q: [{role:'AE-EMEA-DACH',manager:'M1',recordType:'New Business',wonOpps:1,wonArrUsd:100}],
  renew_stake: [{role:'EM-EMEA',manager:'M2',stage:'4 - Commercial agreement',fy:y,fq:q,renewals:2,renewingArrUsd:1000,netChangeArrUsd:0},{role:'EM-EMEA',manager:'M2',stage:'0 - Qualification',fy:y,fq:q,renewals:5,renewingArrUsd:9999}],
  pipe_rep: [{owner:'A',role:'AE-EMEA-DACH',manager:'M1',fy:y,fq:q,opps:3,arrUsd:300}], pipe_pastdue:[{owner:'A',role:'AE-EMEA-DACH',manager:'M1',pastDueOpps:2},{owner:'B',role:'AE-EMEA-FR',manager:'M9',pastDueOpps:7}], pipe_stale:[{owner:'A',staleOpps:1}],
  cr_daily: [{day:'2026-07-02',rt:'New Business',opps:3,arrUsd:30},{day:'2026-08-09',rt:'New Business',opps:1,arrUsd:5},{day:'2026-08-10',rt:'New Business',opps:2,arrUsd:10},{day:'2026-11-03',rt:'Upsell',opps:4,arrUsd:20}],
  cr_monthly: [{yr:2026,mo:11,rt:'Upsell',opps:2,arrUsd:3},{yr:2025,mo:11,rt:'New Business',opps:1,arrUsd:1}],
  cr_source: [{yr:2026,qtr:4,rt:'New Business',leadSource:'Outbound',creatorRole:'BDR-EMEA',bdrRole:'BDR-EMEA',opps:5,arrUsd:50},{yr:2026,qtr:4,rt:'New Business',leadSource:'Inbound',creatorRole:'REVOPS',bdrRole:null,opps:5,arrUsd:50},{yr:2026,qtr:3,rt:'Upsell',leadSource:null,creatorRole:'EM-EMEA',bdrRole:null,opps:3,arrUsd:9}],
  cr_owner_q: [{owner:'A',role:'AE-EMEA-DACH',manager:'M1',rt:'New Business',opps:3,arrUsd:30,bdrSourced:1}],
  cr_bdr: [{yr:2026,qtr:4,bdr:'B',bdrManager:'BM',opps:3,arrUsd:4},{yr:2026,qtr:3,bdr:'B',bdrManager:'BM',opps:1,arrUsd:4}],
  roster: [{userId:'005AAAAAAAAAAAAAAA',name:'Anna Müller',role:'AE-EMEA-DACH',manager:'M1',isActive:true,startDate:null,createdDate:'2025-01-01'},
           {userId:'005BBBBBBBBBBBBBBB',name:'New Person',role:'SMB-EMEA',manager:'M3',isActive:true,startDate:null,createdDate:iso(new Date(Date.now()-3*864e5))},
           {userId:'005CCCCCCCCCCCCCCC',name:'Lost Rep',role:'BDR-EMEA',manager:'M4',isActive:true,startDate:null,createdDate:'2024-01-01'}],
  rr_members: [{poolName:'RR: DACH Corp',userId:'005AAAAAAAAAAAAAAA',userName:'Anna Müller',userRole:'AE-EMEA-DACH',userActive:true,memberStatus:null,addedOn:new Date().toISOString().replace('Z','+0000')},{poolName:'RR: DACH Corp',userId:'005ZZZZZZZZZZZZZZZ',userName:'Zed',userRole:'AE-EMEA-DACH',userActive:true,memberStatus:null,addedOn:'2026-01-01T00:00:00.000+0000'}],
  rr_assign: [{poolName:'RR: DACH Corp',userId:'005AAAAAAAAAAAA',assignments:7,lastAssigned:'2026-11-01T10:00:00.000+0000'}],
  hb_people: [{id:'1',name:'Anna Muller',title:'GTM Manager',department:'GTM EMEA',team:'GTM EMEA',site:'DE - Munich',manager:'M1',startDate:'2025-01-01'},
              {id:'2',name:'New Person',title:'SMB',department:'GTM EMEA',team:'SMB/BD EMEA',site:'SE - Stockholm',manager:'M3',startDate:iso(new Date(Date.now()-3*864e5))},
              {id:'3',name:'Ghost',title:'EM',department:'Engagement EMEA',team:null,site:'SE - Stockholm',manager:'x',startDate:iso(new Date(Date.now()-20*864e5))}],
  bk_owner: [{owner:'Anna Müller',role:'AE-EMEA-DACH',manager:'M1',active:true,status:'Customer',accounts:3,arrUsd:900},{owner:'Anna Müller',role:'AE-EMEA-DACH',manager:'M1',active:true,status:'New',accounts:10,arrUsd:0}],
  bk_pipe: [{owner:'Anna Müller',motion:'Renewal',openOpps:2,openArrUsd:0},{owner:'Anna Müller',motion:'New Business',openOpps:2,openArrUsd:500}],
  bk_em: [{em:'Eva EM',emRole:'EM-EMEA',emManager:'M2',emActive:true,accounts:4,arrUsd:4000}],
  bk_terr: [{salesRegion:'DACH',ownerRole:'AE-EMEA-DACH',status:'Customer',accounts:3,arrUsd:900},{salesRegion:'DACH',ownerRole:null,status:'Pipeline',accounts:1,arrUsd:0},{salesRegion:'MEA',ownerRole:'AE-STRAT',status:'Engaging',accounts:2,arrUsd:0}],
  bk_orphans: [{accountId:'001',account:'X',owner:'Sys',ownerActive:true,ownerRole:null,country:'DE',salesRegion:'DACH',status:'Pipeline',arrUsd:0},{accountId:'002',account:'Y',owner:'Strat',ownerActive:true,ownerRole:'AE-STRAT',country:'AE',salesRegion:'MEA',status:'Customer',arrUsd:500}],
  gr_notes: [],
  closed_rep: [{owner:'A',role:'AE-EMEA-DACH',manager:'M1',rt:'New Business',won:true,lostReason:null,fy:y,fq:q,opps:3,arrUsd:300},
               {owner:'A',role:'AE-EMEA-DACH',manager:'M1',rt:'New Business',won:false,lostReason:'Timing',fy:y,fq:q,opps:2,arrUsd:100},
               {owner:'A',role:'AE-EMEA-DACH',manager:'M1',rt:'New Business',won:false,lostReason:'Merged with Global Pilot',fy:y,fq:q,opps:5,arrUsd:0},
               {owner:'A',role:'AE-EMEA-DACH',manager:'M1',rt:'Upsell',won:true,lostReason:null,fy:(q===1?y-1:y),fq:(q===1?4:q-1),opps:1,arrUsd:50}],
  cr_owner_m: [{owner:'New Person',role:'SMB-EMEA',yr:today.getUTCFullYear(),mo:today.getUTCMonth()+1,rt:'New Business',opps:2,arrUsd:20,firstCreated:iso(new Date(Date.now()-864e5))+'T10:00:00.000+0000'}],
  pipe_nextstep: [{owner:'A',role:'AE-EMEA-DACH',manager:'M1',fy:y,fq:q,flaggedOpps:3,overdueOpps:1,flaggedArrUsd:10,oldestOverdue:'2026-10-01'}],
  pipe_slips: [{owner:'A',role:'AE-EMEA-DACH',manager:'M1',fromFy:y,fromFq:q,toFy:nq.fy,toFq:nq.fq,opps:2,arrUsd:80,quarterPushes:3}],
  pipe_edits: [{owner:'A',closeDateEdits:5,oppsEdited:2,lastEdit:'2026-11-01T10:00:00.000+0000'}],
  pipe_early: [{owner:'A',role:'AE-EMEA-DACH',manager:'M1',opps:1,arrUsd:100}],
  pipe_nocontact: [{owner:'A',role:'AE-EMEA-DACH',manager:'M1',noContactOpps:1,noContactArrUsd:40}],
  top_renewals: [{oppId:'006R',opp:'R - Renewal',owner:'Eva EM',role:'EM-EMEA',manager:'M2',stage:'4 - Commercial agreement',closeDate:'2026-12-01',forecast:'Best Case',nextStep:'Renewal Risk Rating: HIGH; budget cut',lastActivity:null,renewingArrUsd:1000,existingArrUsd:1200,netChangeArrUsd:-200}],
  top_deals: [{oppId:'006A',opp:'X - NB',account:'X',owner:'Anna Müller',role:'AE-EMEA-DACH',manager:'M1',stage:'1 - Solution agreement',rt:'New Business',closeDate:'2026-11-01',forecast:'Commit',nextStep:null,lastActivity:'2026-09-01',createdDate:'2026-05-01',arrUsd:500},
              {oppId:'006B',opp:'Y - NB',account:'Y',owner:'Anna Müller',role:'AE-EMEA-DACH',manager:'M1',stage:'4 - Commercial agreement',rt:'New Business',closeDate:'2027-02-01',forecast:'Best Case',nextStep:'sign',lastActivity:new Date().toISOString().slice(0,10),createdDate:'2026-05-01',arrUsd:900}],
  deals: [{oppId:'006C',opp:'Z - Renewal',account:'Z',stage:'0 - Qualification',rt:'Renewal',closeDate:'2026-12-01',forecast:null,nextStep:null,lastActivity:null,arrUsd:0,contractArrUsd:12000}],
  bk_books: [{book:'DE-LF-ENT-1',owner:'Anna Müller',ownerRole:'AE-EMEA-DACH',ownerActive:true,accounts:7,arrUsd:1},{book:'DE-LF-ENT-1',owner:'Eva EM',ownerRole:'EM-EMEA',ownerActive:true,accounts:3,arrUsd:1}],
};
const order = Object.keys(calcs); const done = new Set();
// datasets added in later builds that this fixture doesn't provide: no rows (so the loop can't wait on them forever)
for (const c of Object.values(calcs)) for (const i of c.inputs) if (!calcs[i] && !data[i]) data[i] = [];
for (let progress = true; progress && done.size < order.length;) { progress = false; for (const id of order) { if (done.has(id)) continue; const c = calcs[id]; if (!c.inputs.every(i => data[i])) continue; data[id] = c.fn(...c.inputs.map(i => data[i])); done.add(id); progress = true; } }
if (done.size < order.length) console.log('NOT RUN', order.filter((id) => !done.has(id)).join(' '));
for (const id of ['cr_pace','bookings','bookings_kpi','lost_reasons','ramp','rep_risk','risk_kpi','renewal_list','forecast','deal_list','person_deals','pool_adds','rr_pools','rr_kpi','books_kpi','hire_kpi','pipe_team','pipe_reps','cr_weeks','cr_kpi','cr_mix','cr_bdrs','rr_people','person','person_hb','checks','checks_hb','checks_kpi','hire_kpi','gr_actions','gr_kpi']) console.log(id, id in calcs ? JSON.stringify(data[id]).slice(0, 700) : '(not a calc now: renamed or folded into another in a later build)');
console.log('pipe_team keys', data.pipe_team.map(r => r.key).join(' / '));
