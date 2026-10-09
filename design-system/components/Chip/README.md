# Chip

A small rounded flag after a name or count: Locked, Disabled, Active, MFA reset, the external-sender marker.

- Markup: `<span class="chip bad">Locked</span>`; tones `bad`, `warn`, `ok`, `muted`; landing snippets use `lock`, `ok`, `dis`.
- `ext` is the EXTERNAL tag on a requester from outside the company: `warn` on `warn-soft`, radius-4.
- `tag` is the coordinator's uppercase warn tag (e.g. VIP).
