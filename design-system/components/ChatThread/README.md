# ChatThread

The ticket conversation: requester bubbles on the left in `bubble`, the technician's on the right in `accent`, system events centred and dashed.

- Markup: `<div class="thread"><div class="msg"><div class="from">Priya Nair</div><div class="bubble">…</div></div><div class="msg me">…</div><div class="msg sys"><div class="bubble">…</div></div></div>`.
- `typing` shows three blinking dots while the requester replies.
- Coordinator mode adds `int` (internal note on `int`/`int-border`) and `alertmsg` (mono, on `warn-soft`).
- Suggested questions sit below as full-width `ask` buttons under an `asks .label`.
