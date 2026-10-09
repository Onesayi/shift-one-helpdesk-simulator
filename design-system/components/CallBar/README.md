# CallBar

The call state strip inside the ticket panel, with the actions that state allows.

- Markup: `<div class="callbar live">{phone icon}<b>On the line</b><span class="grow"></span>buttons</div>`.
- States: `live` (good: Hold, Call back later, End call), `hold` (warn: time on hold and when the caller hangs up, Resume), `late` (bad: callback overdue, Call back), plain (call ended, Call back).
