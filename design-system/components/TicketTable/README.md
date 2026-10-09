# TicketTable

The queue: a full-width table in a card with uppercase heads, hairline rows and clickable rows that highlight on hover and select in `accent-soft`.

- Markup: `<div class="card"><table class="tbl clickable">…</table></div>`. Columns: Priority (PriorityBadge), Ticket (mono `tid` + ChannelTag over a `ttl` title), Requester, Status (StatusPill), SLA left.
- Row classes: `sel` (the open ticket), `unread` (bold title). Empty state: one `empty` cell, "Nothing here."
- SLA cells are mono and tabular: `sla`, `sla soon` (warn), `sla breach` (bad).
- `tbl compact` is the dense variant for detail panes. Under 860px the table scrolls sideways; under 520px the requester column hides.
