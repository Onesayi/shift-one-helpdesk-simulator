# SimDesktop

The remote-desktop screen preview: a fixed blue wallpaper gradient, a translucent taskbar, and whatever the scenario puts on screen (adware pop-ups, a ransom note).

- Markup: `<div class="desktop"><span class="desk-label">…</span><div class="popup p1">…</div><div class="taskbar">…</div></div>`; `ransom` covers the screen.
- Uses the fixed `desktop-*`, `taskbar`, `popup-*` and `ransom-*` colours; it imitates a machine, so it ignores the theme.
- `session-pill` (good) labels a live consent-based session.
