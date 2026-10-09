# StatusPill

A rounded 12px/600 pill for a ticket's workflow status. Neutral by default; tinted only when the status is a result or needs attention.

- Markup: `<span class="status s-resolved">Resolved</span>`.
- Help desk: `s-resolved` (good), `s-escalated` (accent), `s-reopened` (bad); New, Open and In progress stay neutral.
- Coordinator: `s-triaged`, `s-scheduled` (accent), `s-in-progress`, `s-onsite` (warn), `s-completed` (good), `s-needs-reassign`, `s-approval-declined` (bad), `s-waiting-on-approval`, `s-waiting-on-vendor` (med), `s-closed`, `s-merged` (muted).
- Pair with `<span class="mine">you</span>` when assigned to the player.
