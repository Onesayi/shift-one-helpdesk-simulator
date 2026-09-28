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
| **Sim clock** | Thursday 08:00–17:00. At 1× that's about 18 minutes; 2× and 4× for quiet stretches. Practice mode adds pause. |
| **Service Board** | Every ticket with channel, status, assigned tech and a live first-response countdown. Filters: needs triage, open, ready to close, closed. |
| **Triage** | Impact × urgency suggests a priority (from the playbook matrix); you set board, skill, remote/onsite and estimate. |
| **Phone calls** | Calls ring for 10 sim minutes, then go to voicemail. Answering counts as the first response. A ringing call drops the speed back to 1×. |
| **Dispatch Board** | Five technicians across today and tomorrow, with lunch, meetings, a project block, travel and an existing job. Click a free slot to book. The booking dialog checks double-booking, working hours, site-visit ability, skills, client onsite windows, block hours and pending approvals. |
| **Technicians** | Booked work starts on its own. A tech with the wrong skills hands it back; a tech who can do it posts what they did; some tickets need a vendor case before they can finish. A P1 can pull a tech off lower-priority work that's in progress. |
| **Coordination** | Message templates (acknowledge, appointment confirmation, status update, resolution, declined), approvals from any client contact, Service Manager and Account Manager escalations, vendor cases, merging duplicates, and closing with a reason. |
| **Clients** | Premium, standard, co-managed and block-hours agreements, each with SLA targets, onsite windows, authorized approvers, VIPs, notes and vendors. |
| **Report** | Letter grade, KPIs (time to triage, first response in SLA, missed calls, client chasers, wrong-tech dispatches, closed) and technician utilization, then per-ticket feedback with the reasoning behind the right answer. |

## Scenario answer key (for tutors)

Times are when the ticket arrives.

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

A clean run scores in the high 90s. Doing nothing scores about 20.

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

The shift score is the average of all 18 tickets.

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

Useful events for graders: `triage`, `client-msg` (`kind`), `approval-req`, `approval` (`ok`, `auth`), `notify-sm`, `notify-am`, `am-approved`, `vendor-case`, `vendor-msg`, `schedule` (`tech`, `start`, `onsite`, `bumps`), `unschedule`, `interrupt`, `merge`, `close`, `call-answer`, `call-missed`, `chaser`, `work-start`, `work-done` (`kind`: done / bounce / vendor), `appt-missed`, `premature`.

Checklist: solvable with only the in-game information; at least one trap a new coordinator would fall into; the `why` explains the right call in one sentence; played once well and once badly.
