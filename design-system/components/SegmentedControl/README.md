# SegmentedControl

A joined row of filter buttons inside one `radius-8` border; the active segment is `accent` on `accent-soft`.

- Markup: `<div class="seg"><button class="on">Open</button><button>Closed</button><button>All</button></div>`.
- Sits at the right end of a view head (`margin-left: auto`). Add `speed` for the coordinator's 1× / 2× / 4× clock, which drops the auto margin.
- A count can ride inside a segment as `<em>`, tinted `bad-soft`.
