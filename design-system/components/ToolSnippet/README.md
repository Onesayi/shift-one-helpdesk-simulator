# ToolSnippet

A small framed excerpt of a real tool on the start screen: a terminal, a directory list or a server rack, with a title and one line below.

- Markup: `<div class="l-tools"><div class="l-tool"><pre class="snip term">…</pre><h3>…</h3><p>…</p></div></div>` inside `.landing`.
- Variants: `snip term` (fixed `term-*` colours, `pr`/`ok`/`err` spans), `snip dir` (name + chip grid), `snip rack` (`unit` rows with LEDs).
