# Alert

A system notice with a 4px state edge on the matching soft tint: monitoring alerts in the server room and banners on the dispatch board.

- Markup: `<div class="alerts"><div class="alert crit">…</div><div class="alert warn">…</div></div>`; coordinator adds `info` (good).
- Text stays `text`; the edge and tint carry the severity. Lead with the device, then the fact.
