# Changelog

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
