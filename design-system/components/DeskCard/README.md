# DeskCard

The "clock in" choice on the start screen: one card per desk with a mono role line, an Archivo title, a blurb, mono tags and its actions.

- Markup: `<div class="desks"><div class="desk primary">…</div><div class="desk">…</div><a class="desk alt" href="…">…</a></div>` inside `.landing`.
- `primary` inverts to a `text` fill (the recommended first shift); `alt` is a dashed link card to the other desk that firms up and lifts on hover.
- Shift cards (`shiftcard`, `hard`) are the in-app equivalent with a 2px `accent` border on the harder shift.
