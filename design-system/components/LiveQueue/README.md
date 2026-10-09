# LiveQueue

The start-screen hero piece: a live-looking queue whose rows drop in and age, with a 4px priority bar, a ringing call row, mono IDs and waits.

- Markup: `<div class="lq"><div class="lq-head">…</div><div class="lq-call">…</div><ul class="lq-rows"><li class="p1">…</li></ul><div class="lq-foot">…</div></div>` inside `.landing`.
- Rows take `p1`–`p4`. Every ticket shown must be one that is really in the game.
- New rows animate (`fresh`); motion stops under reduced motion.
