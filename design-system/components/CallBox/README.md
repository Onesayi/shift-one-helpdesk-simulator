# CallBox

The incoming-call card that drops in at the top of the work area: a wobbling `accent` ringer, the caller, a countdown to voicemail and Answer.

- Markup: `<div class="callbox" role="alertdialog"><div class="ringer">{phone icon}</div><div class="grow">…</div><button class="btn primary">Answer</button></div>`.
- When already on a call the button reads "Hold & answer". The ringer stops wobbling under reduced motion.
- The topbar shows the live call as an `oncall` pill.
