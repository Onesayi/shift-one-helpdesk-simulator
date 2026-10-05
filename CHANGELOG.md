# Changelog

## 1.2.2 (2026-10-05)

- Requesters recognise far more ways of being asked to test: "retry", "are you connected?", "see if you can…", "any luck?", "does it work?", "try reconnecting"…
- "I'm working on it" and "give me a minute" now get a polite "I'll wait" instead of a test result.
- Error, computer name and close requests are matched before testing, so "what's the error when you try?" gets the error.
- Access points show clients reconnecting after they come back online (the cafeteria AP showed 0 clients after a power cycle).

## 1.2.1 (2026-10-05)

- **Typed replies are understood** in both shifts. Typed questions that match a scripted one get its answer and credit. "Try again", restart, sign out and back in, computer name, error message and "OK to close?" get answers based on whether the problem is really fixed. Every ticket has its own confirmation and error wording, and other messages get varied fallbacks.
- Having the user test the fix before closing is credited on the report.
- Asking a user for their password costs 10 points. Telling the ransomware victim to restart counts as a restart.
- Fixed: the reply box (and the remote command prompt) could refill with the previous message after sending.

## 1.2.0 (2026-10-05)

New: **Shift 2: Phones On**, a harder help desk shift. Shift 1 (*Day One*) is unchanged.

- 9 new tickets, 7 arriving as live phone calls: repeat lockouts from a phone, ransomware, a VPN group removed by a script, MFA fatigue, a Denver site outage reported twice, a full file server, an angry caller demanding admin rights, and a request to reset a colleague's password
- Phone calls: ringing with a ringtone (mutable), voicemail after 20 s, hold & answer, hang-ups after 45 s on hold, call back; questions and verification need the caller on the line
- Grading for root cause (accounts re-lock if the source isn't fixed), time pressure (ransomware spreads after 90 s), tone (badly worded questions cost points) and first-contact resolution
- Link duplicate tickets to a parent incident
- Directory: last lockout source, recent sign-ins, recent-changes audit trail; new `Workstation-Admins` group
- Remote desktop: offline devices, network isolation, restart
- Server room: carrier WAN circuit with line test, file-server disk contents with a cleanup runbook
- 9 new knowledge-base articles (20 total), a "Server & Storage" category, per-shift best scores, call stats on the report
- The incoming-call widget is now shared with Service Coordinator mode

## 1.1.0 (2026-09-28)

New: **Service Coordinator mode** (`dispatch.html`), an MSP dispatch desk simulator.

- Fictional MSP "Northbound IT" with 5 technicians and 5 clients on premium, standard, co-managed and block-hours agreements
- Sim clock (08:00–17:00) with 1×/2×/4× speed and pause in practice mode
- Live phone calls that go to voicemail if missed
- Triage with an impact × urgency matrix, boards, skills, remote/onsite and estimates
- Dispatch Board for today and tomorrow: lunches, meetings, project time, travel, existing jobs, double-booking protection, P1 interrupts
- Simulated technicians who complete, bounce (wrong skills) or wait on vendors; a technician goes home sick mid-shift
- Client message templates, authorized-contact approvals, Service Manager and Account Manager escalations, vendor cases, duplicate merging
- 18 graded tickets, KPI report with technician utilization, and a 10-article dispatch playbook
- Docs: `docs/COORDINATOR.md` (design notes, answer key, authoring)

## 1.0.0 (2026-09-26)

First public release.

- 11 scenarios covering accounts, access, networking, printing, software, phishing, offboarding and social engineering
- Tools: ticket queue, directory, remote desktop with command prompt, server room, knowledge base
- Event-sourced grading with reopen-on-false-resolve, process checks and collateral-damage penalties
- Timed shift and practice modes, end-of-shift report card
- Light/dark theme and mobile layout
- Tutoring & Pricing page driven by `js/config.js`, with hosted payment links
- Automated screenshot, GIF and banner generation (`tools/screenshots.py`)
- GitHub Pages deployment workflow
