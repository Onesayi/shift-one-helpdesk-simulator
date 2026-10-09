# Changelog

## Unreleased

New: **Keyboard focus you can see, everywhere.**

- Every button, link, tab, sidebar item, queue row and card shows a solid 2px focus ring when you reach it with the keyboard (mouse clicks don't). The ring is a design token, `focus`, and reaches 5:1 or better on every background in both themes.
- Queue rows and the requester card are now reachable with Tab, and Enter or Space opens them.
- Focus stays on the control you used after the screen updates, so you no longer land back at the top of the page. Dialogs take focus when they open and hand it back to the button that opened them when they close.
- A test checks the ring's contrast on every background.
- README images regenerated. They show the redesigned start screens and the new dark-mode button labels. The screenshot harnesses now load the start-screen styles and scripts they were missing.

New: **One design system for both desks.**

- `design-system/` holds the brand book, the tokens, guidelines and previews for 37 components, and the marks and icons. It is also published as a browsable design system.
- `design-system/tokens.json` is now the one place colours, shadows, spacing, radii and font stacks are defined. `node tools/build-design-system.js` compiles it to `css/tokens.css`, which both pages load; the colour blocks and hard-coded colours are gone from the stylesheets.
- Better contrast. In dark mode, primary and danger buttons and your own chat bubbles use dark text on the lighter fills (6.5:1, was 2.8:1). In light mode, the High, Medium and Low priority badges and green status text are a shade darker so they pass WCAG AA.
- Tests check that `css/tokens.css` matches the tokens, that every colour the CSS uses exists, and that text colours reach 4.5:1 in both themes.

New: **Redesigned start screens** for both desks.

- The hero shows the game: a live queue preview of real tickets from that mode, with an incoming call ringing.
- Shifts and modes are laid out as desks to clock in at, and each page links to the other desk as a third card.
- New sections: the order tickets arrive in, snippets of the real tools (command prompt, directory, server room, dispatch board, client contracts), and an example report built from real grader lines.
- The priority colours become a stripe across the top bar, with Archivo for headings and the monospace face for ticket data. Works in light and dark mode and at phone width; the queue stays still when reduced motion is on.

New: **Progress across shifts** in Service Coordinator mode.

- Every finished shift is saved in this browser (last 50): score, grade, mode, shift code, and the KPIs (triage time, response SLA, missed calls, chasers, wrong-tech dispatches).
- The shift report has a **Your progress** card: each coordinator skill with this shift, change since last shift, your best, and a trend line over the last 10 shifts.
- The start screen's best score now comes from that history. Best scores saved by older versions still count.
- Tests cover saving, the 50-shift cap, the best score and corrupt storage.

## 1.4.0 (2026-10-06)

New: **Every coordinator shift is different.**

- Service Coordinator shifts draw 16–18 tickets from a pool of 25, with arrival times shuffled inside windows that keep each ticket's right answer valid. Ben's sick call moves too, and tickets are numbered in arrival order.
- Each shift has a code, shown in the top bar and on the report. Type it into *Replay a shift*, open `dispatch.html?seed=<code>`, or press *Replay shift* on the report to play the same tickets at the same times. The same code and the same actions always grade the same.
- `classic` replays the original 18-ticket shift, matching the tutor answer key.
- Seven new tickets: a library Wi-Fi visit, a known-offline Mac, an ISP maintenance notice, a Denver VPN outage that needs the firewall engineer, a leased copier that goes to Ricoh, a VIP's phone email and a block-hours licence fix.
- PB-08 covers leased equipment and provider notices.

Also in this release:

- **Grader tests.** `node --test 'tests/**/*.test.js'` runs the Service Coordinator engine headlessly: one test per grading rule, the scenario traps, and a full shift played from the answer key (100) and left alone (about 20). No dependencies; CI runs them on every pull request.
- Booking a field tech remotely for onsite work now says "this needs a site visit" instead of wrongly saying they lack the skill.

## 1.3.0 (2026-10-05)

New: **Call back later.** For when a call interrupts a critical ticket.

- On a live call, *Call back later* (or typing "Can I call you back in 5 minutes?") promises a callback and ends the call politely, with no hold timer.
- The ticket shows **Callback due** with a countdown, then **Callback overdue** in red. Questions need you to call back first.
- Grading: calling back within 5 minutes earns credit; missing the deadline costs −10 (and the caller lets you know); closing without the promised callback costs −5. A deferred call no longer counts as first-contact resolution.
- Callers react in character (Ravi's demo is in ten minutes…). No deadline in practice mode. The report shows callbacks kept on time.
- KB-501 now covers handling calls while you're busy with something urgent.

## 1.2.3 (2026-10-05)

- Every ticket has a **topic** (time/clock, Wi-Fi/network, printer, VPN…). Asking about it, as in "is the time fine now?" or "check the printer", counts as asking the user to test. Information questions (what/which/who…) don't.
- More generic status phrases: "check the…", "fine now", "right now", "looks OK?".
- The first fallback now hints at what to do: "Do you want me to try it again?"

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
