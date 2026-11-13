# Service Coordinator mode

A second simulator in the same repo. The help desk mode puts you in the technician's chair. This one puts you in the **dispatcher's chair at a managed service provider (MSP)**. That's the role MSP staffing firms such as Support Adventure place with MSPs as remote "service coordinators" or "dispatchers".

Open it at [`dispatch.html`](../dispatch.html), or use the link on the help desk start page.

## What the job actually is

The design is built from how MSPs and MSP staffing firms describe the role:

- **Intake and triage.** Tickets arrive by phone, email, client portal and RMM alerts. The coordinator logs, categorizes and prioritizes them, and decides what is real and what is noise.
- **Matching work to people.** The right ticket goes to the right technician at the right time, based on availability, workload, skills, tier and familiarity with the client. A mismatch comes straight back, and the client has waited for nothing.
- **Scheduling.** Coordinators run the technicians' calendars in the PSA's dispatch board (ConnectWise, Autotask, HaloPSA). That covers appointments, onsite visits, travel time, reshuffling when someone is out, and not burning project time on routine work.
- **SLA monitoring and client communication.** Coordinators acknowledge inside the response SLA, confirm appointments and send updates, especially on P1s. A client who has to chase has already had a bad experience.
- **Chasing.** Coordinators get approvals from the client's authorized contacts, open vendor, ISP, RMA and warranty cases, and escalate to the Service Manager or Account Manager.
- **Enforcing process without owning it.** The Service Manager sets the rules; the dispatcher applies them ticket by ticket.

Real-world tools with the same shape: the ConnectWise PSA Dispatch Portal and schedule board, Autotask and HaloPSA dispatch calendars, and TimeZest-style client self-scheduling. Service Desk Sim is a similar training game, but it's aimed at analysts, not coordinators.

## How it plays

| | |
|---|---|
| **Shifts** | Each shift draws 16–18 tickets from a pool of 25, at different times, and Ben goes home at a different time. The shift code (top bar and report) replays the exact same shift; `classic` is the original 18-ticket shift. See [Shift variation](#shift-variation). |
| **Sim clock** | Thursday 08:00–17:00. At 1× that's about 18 minutes; 2× and 4× for quiet stretches. Practice mode adds pause. |
| **Service Board** | Every ticket with channel, status, assigned tech and a live first-response countdown. Filters: needs triage, open, ready to close, closed. |
| **Triage** | Impact × urgency suggests a priority (from the playbook matrix); you set board, skill, remote/onsite and estimate. |
| **Phone calls** | Calls ring for 10 sim minutes, then go to voicemail. Answering counts as the first response. A ringing call drops the speed back to 1×. |
| **Dispatch Board** | Five technicians across today and tomorrow, with lunch, meetings, a project block, travel and an existing job. Click a free slot to book. The booking dialog checks double-booking, working hours, site-visit ability, skills, client onsite windows, block hours and pending approvals. |
| **Technicians** | Booked work starts on its own. A tech with the wrong skills hands it back; a tech who can do it posts what they did; some tickets need a vendor case before they can finish. A P1 can pull a tech off lower-priority work that's in progress. |
| **Coordination** | Message templates (acknowledge, appointment confirmation, status update, resolution, declined), approvals from any client contact, Service Manager and Account Manager escalations, vendor cases, merging duplicates, and closing with a reason. |
| **Clients** | Premium, standard, co-managed and block-hours agreements, each with SLA targets, onsite windows, authorized approvers, VIPs, notes and vendors. |
| **Disruptions** | Ben goes home sick every shift. Seeded shifts add one or two more: Luis's van breaks down, or Maya is pulled onto an internal outage, and they're off the board for an hour or more; or Lena asks to move the Eastgate scan-to-email to tomorrow. Bookings in the gap can't go ahead, so move them and tell the client. See [Shift variation](#shift-variation). |
| **Handover** | At 17:00 the clock stops and you hand over to Jordan Blake, the on-call engineer. Tick the open tickets Jordan needs to know about, give each a next step, and write a one-line summary. See [Shift handover](#shift-handover). |
| **Time entries** | Every finished job leaves a time entry on the ticket. Code it *Covered by agreement*, *Billable* or *Block hours* before you close. See [Time entries and billing](#time-entries-and-billing). |
| **Campaign** | Shift code `campaign` or `campaign-<seed>`: Thursday's day shift, the on-call night, then Friday, on one clock. Open work carries over. See [Campaign](#campaign). |
| **After-hours on-call** | Shift code `night`: Thursday 17:00 to Friday 08:00 with one engineer, Jordan Blake. Decide what's worth waking Jordan for and book the rest on Friday's board, then hand over to the day coordinator. See [After-hours on-call shift](#after-hours-on-call-shift). |
| **Client satisfaction** | Closing a ticket as resolved sends the client a 1–5 survey. The rating follows from how you handled it, and a 3 or lower needs a reply. See [Client satisfaction (CSAT)](#client-satisfaction-csat). |
| **Skill drills** | Seven short practice shifts, one area each, from the start page or suggested by your report. See [Skill drills](#skill-drills). |
| **Interview prep** | `dispatch.html#prep`, or *Interview prep* in the top bar. See [Interview prep](#interview-prep). |
| **Report** | Letter grade, KPIs (time to triage, first response in SLA, missed calls, client chasers, wrong-tech dispatches, closed) and technician utilization, then per-ticket feedback with the reasoning behind the right answer. |

## Scenario answer key (for tutors)

This is the **`classic`** shift: type `classic` into *Replay a shift* on the start page, or open `dispatch.html?seed=classic`. Times are when the ticket arrives. In other shifts the same tickets arrive at other times and get numbered in arrival order, but the right call is the same.

| # | Arrives | Ticket | Right call | The trap |
|---|---|---|---|---|
| 4471 | carried over | KFL Outlook archive (booked with Ben at 11:00) | Rebook with another M365 tech and send Maria an update | Ben goes home sick at 09:45. Nobody notices, nobody shows up |
| 4476 | carried over | HDG scan-to-email (Ben at 13:30) | Rebook with another Printers tech and tell Lena | Same |
| 4501 | 08:00 | HDG front desk PC can't print | P3 Help Desk, Printers, remote, start before 14:30 | Sending Luis onsite. HDG only allows visits at lunch, and it's a remote fix |
| 4502 | 08:05 | Alert: BL-FS01 disk 92% | P3 Infrastructure, Servers (Maya or Sipho) today | |
| 4503 | 08:10 | Alert: OAK-LAB-VM02 offline | Close as **No action needed**. The client notes say lab VMs shut down nightly | Dispatching a tech |
| 4504 | 08:15 📞 | KFL new associate Monday | P4 Projects & Onboarding, Ana, **tomorrow** | Burning today's capacity, or inflating the priority |
| 4505 | 08:30 | KFL paralegal wants Partners folder | Request approval from **Maria or Tom**; Maria declines, so tell Jake and close as **Declined** | Dispatching without approval, or asking Jake himself |
| 4506 | 08:40 📞 | HDG Northside clinic totally down | **P1**, page the Service Manager, **Sipho only** (client rule) straight away. When Sipho asks, log a **Comcast** case, pass the ETA to Dr. Reyes, update every 30 min, then confirm and close | Any other tech bounces; no vendor case means the clinic stays down; silence means chasers |
| 4507–4509 | 09:00 | Three Oakridge teachers: email broken | **Merge** into one parent, **P2**, one M365 tech | Three separate tickets and three techs |
| 4510 | 09:25 📞 | Pixel & Pine MacBook slow | P3, Mac skills. The block has 0.5 h left against a 90 min estimate, so **escalate to the Account Manager first**, then book Ana | Booking before the top-up is approved |
| (event) | 09:45 | Ben goes home sick until Monday | Re-home #4471 and #4476 and tell both clients | |
| 4511 | 10:15 | Alert: HDG-DC01 backup failed twice | **P2** Infrastructure, Backup (Maya), today | Treating it as "just an alert" |
| 4512 | 10:40 | Brightline desk escalates PRINT01 spooler | P2 Infrastructure, **Servers**. Brightline's own Tier 1 already did the basics | Sending it to our Tier 1 |
| 4513 | 11:00 📞 | KFL managing partner typed password into fake DocuSign | **P1 Security**, page the Service Manager, **Maya** now (pull her off lower-priority work if needed) | Matrix says P2; the override says P1 |
| 4514 | 11:30 📞 | Oakridge hall projector, assembly at 13:00 | Field Services, Luis onsite at **12:30**. Oakridge bans visits 11:30–12:30 and travel takes 30 min | Booking inside the school's lunch window, or after 13:00 |
| 4515 | 12:00 | Dell RMA motherboard delivered to HDG Eastgate | Luis onsite **Friday 12:00** (today's 12:00–13:00 window can't fit travel plus an hour), then send Lena the appointment | Booking outside HDG's window |
| 4516 | 13:00 | "Tom Keller" asks to forward all mail to Gmail | Unknown sender on a lookalike domain (`kellerfinch-law.co`). **Security** board; verify with Maria or Tom through a known contact; send **Maya** to investigate | A Help Desk tech does the forwarding, and the attacker gets the partner's mail |

At 17:00, everything still open is booked for Friday with techs who'll be in, so the handover needs no flags, just a summary line.

A clean run scores in the high 90s. Doing nothing scores about 20–35, depending on the shift.

### Extra tickets in the pool

These never appear in the classic shift.

| Ticket | Right call | The trap |
|---|---|---|
| Oakridge library Wi-Fi drops | P3 Field Services, Network, **Luis onsite** before Friday 15:00, outside 11:30–12:30 | Sending Sipho remotely, or visiting during the school's lunch ban |
| Alert: PP-MBP-03 offline for 3 days | Close as **No action needed**. Pixel & Pine's notes say Theo is on leave with it switched off | Dispatching a tech and burning prepaid hours |
| AT&T planned maintenance on Brightline HQ | No tech. Send Brightline a **status update**, then close as **No action needed** | Closing it without telling the client, or dispatching |
| 📞 Brightline Denver can't reach the warehouse system | **P2** (P1 accepted) Infrastructure, **Firewall**: Sipho within the hour, while he is still on shift | "Network" sounds right, but the site-to-site VPN is on the firewall; Luis bounces |
| 📞 KFL copier error SC542 | Log a case with **Ricoh (copier lease)**, pass Ricoh's visit time to Maria, leave it open for Ricoh | Sending a tech to a leased copier |
| Dr. Reyes: work email stopped on iPhone | **P3** Help Desk, M365, remote today | Inflating it to P1/P2 because she's a VIP |
| Rhea: Adobe licence removed | P3 Help Desk, Mac. 15 minutes fits in the 0.5 h block, so just book it | Escalating to the Account Manager for nothing |
| Alert: KFL backup, 403 Forbidden on one SharePoint site | **P2** (P1 accepted) Infrastructure, **Backup**, Maya remote. Sign-in worked for 41 sites, so 403 is a missing permission on that one site | Treating it as a password problem, or as alert noise |
| Brightline: new server shows offline in RMM | P3 Infrastructure, **Network**, remote. It works on the LAN, so the fault is outbound: DNS, 443 or the proxy | Sending it to our Tier 1 after Brightline's desk already restarted the agent (−5) |
| Kwame: "It's not working again" | Send **Ask for details** first, then triage from his answer: P3 Infrastructure, Network, remote (a web filter blocking one site) | Triaging before asking (−10) or never asking (−15) |

## Shift variation

A shift is built from a seed (the shift code), in [`buildShift()`](../js/dispatch/scenarios.js):

- **Which tickets.** 14 incidents are drawn from 21 (the three Oakridge email duplicates count as one). Every shift has at least one P1, one noise alert, one approval and one onsite job. The two carried-over tickets are always there.
- **When.** Each ticket arrives somewhere in its own `window`, in 5-minute steps, chosen so the right answer still holds. The projector has to come in late morning to keep its 12:30 trap; the clinic outage can come any time up to 11:20. For urgent tickets (`slide`), the start-by deadline moves with the arrival time.
- **Ben's sick call** lands between 09:15 and 10:30.
- **One or two more disruptions** are drawn from `DISRUPTIONS` in [`data.js`](../js/dispatch/data.js), each at a time inside its window. The classic shift has none.

| Disruption | When | What happens | Right call |
|---|---|---|---|
| Luis's van breaks down | 10:00–13:00 | Luis is off the board for 90 min | Rebook anything in the gap (travel counts) and tell the client |
| Internal VPN outage | 09:15–13:00 | Maya is off the board for 60 min | Same |
| Lena moves the Eastgate scan-to-email | 11:00–12:30 | Lena asks to do it tomorrow instead. Skipped if the work has started | Book it for Friday and confirm the new time with Lena |

Nothing can be booked with a tech while they're off the board, and a booking left in the gap is missed when its time comes: the client chases, just as with Ben.
- **Numbering.** Tickets are numbered #4501 upward in arrival order.

All randomness happens when the shift is built. Technicians, clients and the grader are deterministic, so the same shift code with the same actions always gives the same score.

## Time entries and billing

When a technician finishes, their booked time lands on the ticket as a time entry. Playbook article PB-12 sets the code, checked in this order:

| Work | Code |
|---|---|
| Anything for a block-hours client (Pixel & Pine) | Block hours. It comes off the client's balance on the Clients page |
| Projects & Onboarding work, any client | Billable |
| An onsite visit on a standard agreement (Oakridge, Brightline) | Billable. Standard covers remote support only |
| After-hours work (17:00–08:00) on a standard agreement | Billable, at the after-hours rate (PB-13) |
| Everything else on a managed agreement (premium covers onsite too) | Covered by agreement |

An entry left uncoded costs 5 and a wrong code costs 10, on that ticket. The report shows the share of entries coded right, and it's tracked in your progress.

## Client satisfaction (CSAT)

When you close a ticket as *Resolved* and it has a client contact, the client answers a 1–5 survey five minutes later, in the ticket thread. Playbook article PB-14 covers it. Nothing random decides the score: it starts at 5 and loses a star for each thing the client noticed.

| The client noticed | Stars lost |
|---|---|
| Told it was fixed when it wasn't | 1 |
| Had to chase for an update | 1 per chaser, up to 2 |
| Their call went to voicemail | 1 |
| First response was later than the SLA | 1 |
| Their appointment moved and nobody told them | 1 |
| The work started later than it needed to | 1 |
| Nobody sent a resolution confirmation | 1 |

A rating of 3 or lower is a complaint. It shows on the Service Board until you open the closed ticket and press *Reply*, and leaving it unanswered costs 10 on that ticket. If it's still unanswered an hour after the survey, the client writes to Dana, Dana tells you to reply, and the ticket loses another 10. A survey that lands in the last 30 minutes of the shift isn't held against you. The report shows CSAT as the share of surveys rated 4 or 5, and it's tracked in your progress. The answer key gets 5/5 on every survey.

## Major incident

Shift code `major`, from the start page: Thursday 08:00 to 11:00, practice mode, no handover, not saved to progress. Microsoft 365 sign-ins fail for Harbor Dental, Keller & Finch, Brightline and Oakridge from 08:05, and Microsoft fixes it at 09:50. Playbook article PB-16 covers it.

| # | Arrives | Ticket | Right answer |
|---|---|---|---|
| 4801 | 08:05 📞 | Harbor Dental: nobody can sign in | Declare a major incident, P1 Infrastructure M365 remote. Page Dana, open a Microsoft case, book Maya |
| 4802 | 08:08 ✉️ | Keller & Finch: password prompts | Link to the incident |
| 4803 | 08:10 ✉️ | Brightline: all users signed out | Link to the incident |
| 4804 | 08:14 📞 | Oakridge: teachers can't get email | Link to the incident |
| 4805 | 08:35 ✉️ | Harbor Dental: front desk printer offline | Separate P3, Help Desk, Printers, Ana |
| 4806 | 08:45 📞 | Tom Keller: court filings due | Link to the incident |
| 4807 | 10:05 ✉️ | Oakridge teacher still can't sign in | Separate P3: an expired password. Don't link it |

*Declare major incident* is in a ticket's *Approvals, escalations & vendors* section. Once one is declared, any client's ticket can be merged into it, and the *Major incident update*, *Status update* and *Resolution confirmation* messages sent from it reach every linked client.

| On the incident | Or lose |
|---|---|
| Declared as a major incident | 10 |
| Service Manager paged within 15 minutes of 08:05 | 15 if never, 5 if late |
| Microsoft case opened | 10 |
| An incident update at least every 30 minutes until 09:50 | 10 per gap (max 20), 25 if none |
| Every linked client told it's fixed | 5 each |
| Post-incident review written after closing | 20 if missing, 5 per wrong answer |

The review's answers: Microsoft's change to their sign-in service, four clients, first report 08:05, restored 09:50, and alert us from Microsoft's service health feed next time. Unlinked incident tickets lose 20 each as duplicates, and linking the printer or the expired password loses 40.

## Exchange Online outage

Shift code `outage`, from the start page: Thursday 08:00 to 11:30, practice mode, no handover, not saved to progress. It's modelled on the real Microsoft 365 outage of 12–13 November 2026 (Microsoft incidents EX1550543 and MO1550821), squeezed into one morning, with the simulator's own clients and wording. Outlook can't reach mailboxes for Harbor Dental, Keller & Finch, Brightline and Oakridge from 08:05. Sign-in works and Teams mostly does. It runs and grades exactly like the major incident above (PB-16), with its own review.

What happens on Microsoft's side, posted on the incident ticket:

| Time | Microsoft 365 status |
|---|---|
| 08:20 | Investigating EX1550543: some users can't reach their mailboxes from any Outlook app |
| 08:50 | Now MO1550821, any region, servers unavailable and the rest overloaded. Check status.cloud.microsoft if the admin center won't load |
| 09:05 | Some servers back and some users regaining access. Carl at Oakridge writes "It's back! Can we close this?" |
| 09:25 | The restored servers fall over again. No ETA. Carl: "Spoke too soon" |
| 09:55 | Steady recovery; queued mail is held and retried for up to 48 hours, not lost |
| 10:20 | Mitigated: mailboxes load and queued mail is arriving. Maya confirms all four tenants |

| # | Arrives | Ticket | Right answer |
|---|---|---|---|
| 4821 | 08:05 📞 | Harbor Dental: Outlook won't load any mailbox | Declare a major incident, P1 Infrastructure M365 remote. Page Dana, book Maya, open a Microsoft case |
| 4822 | 08:12 ✉️ | Keller & Finch: should we reinstall Office? | Link to the incident (and no, they shouldn't) |
| 4823 | 08:15 ✉️ | Brightline: mailboxes unreachable at HQ and Denver | Link to the incident |
| 4824 | 08:30 📞 | Oakridge: some teachers have email, some don't | Link to the incident. It isn't their Wi-Fi |
| 4825 | 08:40 📞 | Tom Keller: a "Microsoft" caller wants remote access | Separate P2 (P1 accepted), Security board, Security, remote. Maya checks his sign-ins. Paging Dana is fine. Don't link it |
| 4826 | 09:40 ✉️ | Brightline: customers' emails to us are "delayed" | Link to the incident: queued, not lost |
| 4827 | 10:40 ✉️ | Harbor Dental: everyone's email is back except Jamie's | Separate P3, Help Desk, M365, Ana. Outlook was left on "Work Offline". Don't link it |

The trap is 09:05. Sending the *Resolution confirmation* or closing the incident before 10:20 costs the usual 15 (told it was fixed too early) or 25 (closed before the technician finished). Grading on the incident is the same table as the major incident above, with 10:20 as the restore time. The review adds two questions to the usual five: was any email lost (no: it was queued and delivered late), and what clients should have heard at 09:05 (recovery has started, but it isn't fixed until Microsoft confirms). The other answers: Microsoft's mailbox servers dropping out and overloading the rest, four clients, first report 08:05, restored 10:20, and keep a phone and text contact list for every client next time.

## Complaints

Every seeded day shift (not `classic`, not the night) has one extra call on top of its 14 incidents: Helen Moore, Oakridge's principal, complaining that teachers' OneDrive keeps failing after two quick fixes. It arrives between 09:00 and 12:00, and its start-by time moves with it. It's also in the `drill-complaint` drill. Playbook article PB-15 covers it.

| Do this | Or lose |
|---|---|
| Send the *Apology and plan* message | 15 if never sent, 5 if a different message went first |
| Page the Service Manager within 30 minutes | 15 if never, 5 if late |
| Escalate to the Account Manager | 5 |
| Book a Tier 2 engineer (Maya) for the root cause | 10 if Ana or Ben is booked |

The right triage is P2, Help Desk, M365, remote, an hour. Dana and Rob both answer in their own words, and Rob's reply doesn't add block hours.

## Campaign

Shift code `campaign` starts a new one, and `campaign-<seed>` replays one. There are three legs on one continuous clock: Thursday's day shift (the seeded shift for `<seed>`), the after-hours night, then Friday's day shift. Nothing resets between legs. Open tickets, bookings, vendor cases and approvals all carry on, and a call that's ringing at a changeover is still ringing when the next leg starts. Your handover is your only briefing: each flagged ticket gets your note in its thread, and your summary is on the Team page.

- **Friday** draws up to 8 scenarios that Thursday didn't use, moved forward a day, plus one team disruption. Ben is still off sick. Scenarios that are always due "tomorrow" are left out, because Friday has no tomorrow, so Thursday's Friday bookings are the only Friday-dated work.
- **Grading:** each ticket is graded once, at the end of the leg where it's closed or merged. A resolved ticket waits for its survey before it's graded. Anything still open at Friday 17:00 is graded then. Each leg's score averages the tickets graded in it plus that leg's handover. The overall score averages every ticket and all three handovers.
- **Ending a leg early** grades what's finished. The rest of that shift still plays out before the next leg starts.
- Night tickets keep their on-call rules (PB-13) even when they're graded on Friday. Campaigns aren't saved to your progress.

## After-hours on-call shift

Shift code `night`, from the start page. You cover the desk from Thursday 17:00 to Friday 08:00. Jordan Blake is the only engineer, and every booking wakes them up. Playbook article PB-13 sets the rule: book Jordan tonight for P1s on any agreement and P2s on premium agreements. Everything else gets acknowledged tonight and booked on Friday's board with the day team. Ben is still off sick, so he can't take Friday work. The night runs 4× faster than a day shift, except while a phone rings. At 08:00 you hand over to Priya Nair, the day coordinator. Flag what's still open and urgent and anything waiting on someone. Work already booked with a day tech needs no flag. The night is the same every time, and it's saved to your progress.

| # | Arrives | Ticket | Right call |
|---|---|---|---|
| 4601 | 17:45 | HDG-DC01 backup failed twice | P2 premium: Jordan tonight, before the 23:00 run |
| 4602 | 18:10 | Oakridge printer jam sensor | P3: Luis on Friday morning, inside 07:30–11:30 |
| 4603 | 18:30 | Oakridge principal: hall laptop won't sign in, assembly at 09:00 | P3 on standard: acknowledge tonight, Maya at 08:00 Friday (Ana has Jess's Mac). Don't wake Jordan for a VIP |
| 4604 | 19:30 (call) | Tom Keller's phone mail | P2 premium VIP: Jordan tonight |
| 4605 | 20:45 | Jess's MacBook login loop | P2 on block hours: Ana at 08:00, after Rob approves a top-up. Flag it in the handover |
| 4606 | 22:30 (call) | Brightline warehouse scanners down | P1 on standard: Jordan now, page Dana, update every 30 min, code the time Billable |
| 4607 | 23:40 | Oakridge lab VM offline | Noise: close it |
| 4608 | Fri 01:00 | Comcast maintenance notice | Pass it on to Lena, close as no action needed |
| 4609 | Fri 03:00 | Front desk monitor flickers | P4: Luis on Friday at Harbor Dental's 12:00 window |
| 4610 | Fri 05:30 | Maria typed her password into a phish | P1 Security: Jordan now, page Dana |

Booking Jordan for work that could wait costs 15 on that ticket. Leaving work that needed Jordan until the morning costs 20.

## Skill drills

A drill is a short practice shift built from one area's tickets, with no carry-overs, no sick calls, no disruptions and no handover. Each ticket arrives at the start of its window, so the right answer is the same as in a full shift. Shift codes are `drill-<id>`. The start page lists them all. After a full shift, the report suggests the drill whose tickets averaged lowest, if any averaged under 90. Drills aren't saved to your progress.

| Code | Drill | Tickets |
|---|---|---|
| `drill-triage` | Priority and routing | New starter, file server disk, backup failures, co-managed spooler, DocuSign phish |
| `drill-noise` | Alerts and noise | Lab VM, Theo's MacBook, AT&T maintenance, file server disk, backup failures |
| `drill-approvals` | Approvals and block hours | Partners folder, Jess's MacBook, Rhea's Adobe licence, mail forwarding |
| `drill-scheduling` | Onsite windows | Front desk printing, new starter, library Wi-Fi, hall projector, RMA motherboard |
| `drill-p1` | P1s, vendors and duplicates | Clinic outage, the three Oakridge email tickets, KFL copier |
| `drill-complaint` | Complaints | Helen Moore's complaint, new starter, Jess's MacBook |
| `drill-support` | Technical support | KFL backup 403, Brightline agent offline, Kwame's vague ticket, co-managed spooler |

## Interview prep

Eleven questions MSPs ask service coordinators and dispatchers live in [`js/dispatch/interview.js`](../js/dispatch/interview.js): prioritising, a sick technician, an angry client, matching techs to work, access requests, a suspicious VIP request, a P1 outage, monitoring noise, billing, handover and KPIs. For each one the player writes the answer they'd give out loud. A checklist under it ticks off the key points as the answer covers them; it matches on wording, so it's a nudge, not a grade. Then they can open a model answer built from the playbook, read the linked playbook articles, and start the drill that practises the skill. Answers are saved in the browser (`shiftone-prep`).

To add a question, give it `points` with a few patterns each, a `model` answer, the `kb` articles and a `drill`. The tests in [`tests/dispatch/interview.test.js`](../tests/dispatch/interview.test.js) check that every link is real and that the model answer covers all of its own points.

### Support assessment practice

The *Support assessment* tab (`dispatch.html#assess`) practises the skills test SaaS support desks send for L1 technical support roles. The questions are reworded practice versions, not any company's real test. It's `ASSESS` in `interview.js`:

- **Quiz** (`kind: 'mcq'`): Zendesk statuses (Pending vs On-hold), triggers vs automations, 401 vs 403, why an on-premises agent only needs outbound HTTPS, and what a 504 means. Picking an option shows whether it's right and explains every option.
- **Written tasks** (`kind: 'write'`): a chat reply with no more than 2 questions, triaging five tickets, troubleshooting an agent that can't reach the cloud, a client email built from a docs excerpt, an L2 escalation note, a process fix for repeat tickets, a frustrated login email, a known-bug email, and a spoken explanation for a non-technical customer. Each has key `points`, `traps` (like asking for a password, or opening an inbound port) and `limits` on questions, messages and words.

A quick-reference sheet (statuses, business rules, HTTP codes) sits at the top. Answers share the prep store, keyed `as-<id>`. [`tests/dispatch/assess.test.js`](../tests/dispatch/assess.test.js) checks that every model answer covers its points, fits its limits and falls into none of its traps.

## Shift handover

At 17:00 (or when you press *End shift*) the clock stops and you hand over to the on-call engineer. The screen lists every open ticket with a checkbox and a note, plus a summary box. Playbook article PB-11 sets the rule:

| Open ticket | Left out of the handover |
|---|---|
| A P1 or P2 that isn't completed | −20 |
| Waiting on a vendor or an approval | −10 |
| Needs a tech and isn't booked with anyone who can work it (never booked, handed back, or still with someone off sick or off the board) | −10 |
| Booked for later with a tech who'll be in, or completed and waiting to close | no flag needed |

A flag with a note shorter than 15 characters costs 5, and a missing summary costs 10. The handover scores out of 100 and counts like one more ticket in the shift score.

## Grading

Each ticket starts at 100. The engine applies standard checks, then the scenario's own `evaluate()`:

| Check | Points |
|---|---|
| Never triaged / slow triage (>15, >30 min) | −25 / −5 / −10 |
| Priority off by one / by two or more | −10 / −20 |
| Wrong board, skill or work type | −5 each |
| Missed call / no first response / late first response | −10 / −20 / −10 |
| Client chased us | −10 each (max −20) |
| Told the client it was fixed before the tech finished | −15 |
| Sent to a tech without the skill (or remote for onsite work) | −15 per tech |
| Never scheduled / still booked with the sick tech | −30 |
| Booked too late for the deadline | −10 |
| Onsite outside the client's window (non-P1) | −10 |
| Bumped a meeting/project for P3/P4, or a lunch for non-P1 | −5 |
| Tech time on a ticket that needed none | −25 |
| Wrong close reason / closed before the work was done / completed but never closed | −10 / −25 / −10 |
| Paged the Service Manager or Account Manager for nothing | −5 |
| Still booked with a tech while they were off the board | −30 |
| Didn't tell the client their appointment moved after a disruption | −10 |
| Client asked to move it to tomorrow, and it stayed booked for today | −15 |
| Time entry never coded / coded wrong | −5 / −10 |

The shift score is the average over every ticket in the shift (18 in classic) plus the handover. A ticket that never arrived because the shift ended early scores 0.

The tests in [`tests/dispatch/`](../tests/dispatch/) check each row of this table, the scenario traps above, and both ends of the scale: the answer key scores 100 and doing nothing scores about 20. If you change a rule, change its test.

## Authoring a coordinator scenario

Scenarios live in [`js/dispatch/scenarios.js`](../js/dispatch/scenarios.js); clients, technicians and the playbook in [`js/dispatch/data.js`](../js/dispatch/data.js). The header comment in `scenarios.js` documents every field. The short version:

```js
{
  id: '4517', at: 330, channel: 'email', client: 'oak', contact: 'cjensen', kb: 'PB-04',
  title: 'Wi-Fi drops in the library',
  body: 'Hi, the library Wi-Fi keeps dropping every few minutes…',
  truth: { priority: 'P3', board: 'Field Services', skill: 'Network', onsite: true, est: 60,
           dispatch: true, startBy: DAY + 900, closeAs: null,
           why: 'One area, degraded: P3, and the AP needs hands on it.' },
  fixNote: 'Replaced the library AP\'s failing PoE injector.',
  evaluate(t, ded, good) { /* extra checks with logged(type, pred) */ },
}
```

Useful events for graders: `triage`, `client-msg` (`kind`), `approval-req`, `approval` (`ok`, `auth`), `notify-sm`, `notify-am`, `am-approved`, `vendor-case`, `vendor-msg`, `schedule` (`tech`, `start`, `onsite`, `bumps`), `unschedule`, `interrupt`, `merge`, `close`, `call-answer`, `call-missed`, `chaser`, `work-start`, `work-done` (`kind`: done / bounce / vendor), `appt-missed`, `premature`, `move-request`. Tickets a disruption knocked on are in `G.disrupted`.

For shift variation, give it a `window: [earliest, latest]` in which the `truth` still holds, `slide: true` if its `startBy` is relative to arrival, and `pick` if it fills a must-have category. Use `avoid` for scenarios that can't share a shift. New tickets that shouldn't change the classic shift get `extra: true`.

Checklist: solvable with only the in-game information; at least one trap a new coordinator would fall into; the `why` explains the right call in one sentence; played once well and once badly; added to the answer-key run in [`tests/dispatch/answer-key.js`](../tests/dispatch/answer-key.js) with a test for its trap.
