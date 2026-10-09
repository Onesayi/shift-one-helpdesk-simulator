# StatusDot

An 8px coloured circle before a service, device or line: green running, amber degraded, red stopped.

- Markup: `<span class="dot ok"></span>Running`; tones `ok`, `warn`, `bad`.
- On the start screens the same idea is `led` (with `warn` and a blinking `off`) inside `.landing`; the blink stops under reduced motion.
- Never rely on the colour alone: always follow the dot with the status word.
