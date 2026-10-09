# DispatchBoard

The coordinator's schedule: one row per technician with skills, and a 36-slot track of blocks (lunch, meetings, travel) and booked appointments.

- Markup: `<div class="drow"><div class="dtech">…</div><div class="dtrack">cells, blocks and appts</div></div>`; wrap rows in `dboard` inside `dscroll`.
- Blocks: `k-lunch` (good), `k-meeting`/`k-project` (dashed), `k-travel` (hatched warn), `k-job`. Appointments: `appt` (accent fill), `s-working` (warn), `s-done` (good), `s-missed`/`conflict` (bad outline), `sel` (focus ring).
- Off-shift cells are hatched with `hatch`; the `nowline` is a 2px `bad` line.
- Skills are `sk` chips; `hit` when they match the ticket.
