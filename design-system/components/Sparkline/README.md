# Sparkline

A 96×24 line in `accent` with a dot on the latest value, used beside a trend on the coordinator's progress page.

- Markup: an inline `<svg class="spark" viewBox="0 0 96 24"><polyline points="…"/><circle cx cy r="2.5"/></svg>`.
- Pair with a `delta` of `up` (good) or `down` (bad) text; never show a sparkline without its number.
