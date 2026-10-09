# Button

The one button: a bordered `surface` chip that takes an `accent` border and text on hover, with variants for weight and size.

- Markup: `<button class="btn">Label</button>`; add an inline 24px line icon before the label if useful (sized to 15px).
- Variants: `primary` (accent fill, `on-accent` label; one per area), `ghost` (no border, accent text, e.g. a device link), `danger` (bad fill, destructive and final), `danger-ghost` (bad text, e.g. "End call"), `pulse` (the End shift button when every ticket is closed).
- Sizes: `xs`, `sm` (ticket-panel actions), default, `lg` (start and pricing CTAs), `block` for full width.
- Labels are sentence-case verbs that say what happens: "Assign to me", "Hold & answer", "Escalate".
- Disabled uses the `disabled` attribute: 55% opacity, no hover.
- Known gap: in dark, white on `accent` is 2.85:1 and white on `bad` is 2.77:1 (source values).
