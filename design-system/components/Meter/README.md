# Meter

A label, a 6px bar and a percentage: CPU, memory and disk on a server card, or a technician's utilisation.

- Markup: `<div class="meter"><small>CPU</small><div><i style="width:22%"></i></div><span>22%</span></div>`.
- The fill is `accent`; add `hi` above 75% to turn it `warn`. `meter wide` gives the label 130px.
- Server cards (`srv`) stack a name, role and three meters on `surface-2`; a stopped service shows as an `events` line in mono `bad` on `bad-soft`.
