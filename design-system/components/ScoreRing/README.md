# ScoreRing

The per-ticket grade shown when a ticket closes: a 54px ring with the score, the outcome, and a ✓ / ✕ list of what scored and what cost points.

- Markup: `<div class="result"><div class="score-ring good">92</div><div><b>Resolved</b><ul class="fb"><li class="g">…</li><li class="b"><b>−8</b> …</li></ul></div></div>`.
- Ring tone: `good` ≥ 80, `ok` 50–79 (warn), `bad` < 50.
- Penalties name the points and the reason.
