# ShiftTimeline

A horizontal timeline of real arrival times in the shift: mono times on ringed dots over a hairline, one sentence each. The order is the content.

- Markup: `<ol class="lt"><li><time>0:00</time><p>…</p></li><li class="lt-alert">…</li></ol>` inside `.landing`.
- `lt-alert` rings the dot in `p1` for the trap tickets. Stacks vertically under 960px.
- Introduce it with an `l-eyebrow` and a `section` heading.
