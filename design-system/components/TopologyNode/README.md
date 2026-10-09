# TopologyNode

A mono device label with a 1.5px status border, stacked in tiers to draw the network: WAN, core, floor switches, access points.

- Markup: `<div class="topo"><div class="tier"><span class="node ok">FW-01</span>…</div>…</div>`.
- Tones: `ok` (good border), `warn` (warn border and text), `bad` (bad text and a dashed border: down). A `<small>` adds context, e.g. (Denver).
