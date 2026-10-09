Shift One is a browser simulator of an IT service desk. A player sits a Tier 1 shift at Brightline Logistics (or the dispatch desk at Northbound IT), works a live ticket queue, and is graded on what actually changed. The interface should feel like the real tools a technician uses all day: dense, calm, legible under time pressure, and honest about state. Colour signals state; everything else stays quiet.

## Content fundamentals

- **Write like a senior colleague on the desk.** Short, direct, second person: "Pick a ticket, assign it to yourself, then use the tools on the left to fix it." No hype, no exclamation marks.
- **Sentence case everywhere**: buttons, headings, tabs ("Assign to me", "Verify requester", "Call back later"). Uppercase only through the `label`, `table-head`, `badge` and `eyebrow` styles, which set it in CSS.
- **Name things the way a help desk does**: ticket, requester, SLA, escalate, lockout source, line test, runbook. Ticket IDs are real-looking (`INC-20114`), devices too (`BL-LT-1042`, `AP-CAFE-01`).
- **Buttons say exactly what happens.** "Hold & answer", "Resolve", "End call", "Clock in". Toasts confirm in past tense.
- **Feedback names the point and the reason.** Report lines read "−15 Unlocked without verifying the caller", never "Oops".
- **Copy is specific to the scenario.** "Priya in Finance is locked out on month-end close. Unlock her, but verify her first." Real names, departments and times from the game data, never lorem ipsum.
- **No emoji in the UI chrome.** The source uses a handful of glyphs functionally: ✓ and ✕ in feedback lists, ☎ on the ringing call, ☾/☀ on the theme toggle, 🔔/🔕 on the ringtone toggle, → on forward links. Don't add more.

## Visual foundations

### Colour

- The ground is `bg`; panels, cards and inputs sit on `surface`; second-level fills (row hover, stat tiles, suggestion buttons) use `surface-2`. Every divider is a 1px `border`.
- Text is `text`; secondary text, labels and resting icons are `muted`.
- `accent` is the only interactive hue: primary buttons, links, active nav and tabs, selection, focus. Pair it with `accent-soft` as a tint behind accent text (active nav, selected row, count badges).
- State colours always come as a pair: `good`/`good-soft`, `warn`/`warn-soft`, `bad`/`bad-soft`. Use the strong colour as text or a 4px edge and the soft colour as the fill. Never put a strong state fill behind body text.
- Priority has its own four-step ramp: `crit` (P1), `high` (P2), `med` (P3), `low` (P4). Badges put the priority colour on the matching soft tint (critical on `bad-soft`, high and medium on `warn-soft`, low on `good-soft`). On the start screens the same ramp appears as `p1`–`p4` and as the 4px brand stripe across the top of the topbar (40 / 30 / 20 / 10%).
- Coordinator mode adds `int` and `int-border` for internal notes and `hatch` for off-shift cells.
- Simulated machines use fixed colours that don't follow the theme: `console-*` (in-game command prompt), `term-*` (landing snippets), `desktop-1..3`, `taskbar`, `popup-*`, `ransom-*`. The toast is always dark (`toast-bg`) with a 4px tone edge (`toast-info`, `toast-good`, `toast-bad`, `toast-warn`). Grade tiles use `grade-a`…`grade-f` with a white letter.
- Both themes are first-class. Dark is a cool blue-black (`bg` #0e131a) with lifted state colours; it is not an inversion.
- Every text colour reaches 4.5:1 on the grounds its usage note names, in both themes; `tests/design-system/tokens.test.js` checks it. Labels on an `accent` or `bad` fill use `on-accent` and `on-bad`, which are white in light and dark ink in dark, never a literal white.
- The `focus-ring` halo is `accent-soft` (1.2:1), so the focus cue is the `accent` border it is paired with, not the halo. Never use the halo alone.

### Type

- The app runs on the platform UI face (`sans`: Segoe UI, system-ui) at 14px/1.5 (`body`). View titles are `view-title` (20px), the ticket title `panel-title` (16px), controls `control` (13px/600).
- Small caps-style labels are `label` (12px/700, .06em) and `table-head` (11px/600, .06em). Priority and channel tags are `badge` (10.5px/800).
- The start screens add a display face, **Archivo** (Google Fonts, variable width and weight): `hero` at 62px/800 with `font-stretch: 118%`, `section` at 36px/800 and 112%, `desk-title` at 22px/750 and 108%. Headings there use `text-wrap: balance`. Keep Archivo to the start screens.
- Mono (`mono`: Cascadia Mono, Consolas, SF Mono) carries ticket IDs, SLA timers, terminals, audit logs and the landing's uppercase eyebrows (`eyebrow`, .1em).
- Every number that updates (clock, SLA, queue waits, scores) uses `font-variant-numeric: tabular-nums`.

### Spacing and layout

- There is no spacing scale in the code; the steps it repeats are `space-2` through `space-44`. The workhorses: `space-8` (default flex gap), `space-12` (table cells, grids), `space-16` (card and panel padding).
- The app is a three-column grid: `sidebar-width` (208px) nav, the main tool view, and the `panel-width` (400px) ticket panel, under a `topbar-height` (56px) bar. Under 1180px the sidebar becomes a 64px icon rail and the panel 360px; under 860px everything stacks and the sidebar becomes a sticky horizontal strip. Start and pricing screens cap at `page-max`.
- Lay sibling groups out with flex or grid and `gap`; grids collapse 4 → 2 → 1 columns at 860px and 520px.

### Shape, borders and elevation

- Corners are small and squared-off: `radius-8` for controls, `radius` (10px) for cards, `radius-12` for modals and pills, `radius-14` for the large start-screen and pricing cards. Small tags use `radius-4`/`radius-5`.
- Borders do the separating. Cards get one resting `shadow`; only floating things get heavier ones (`shadow-call`, `shadow-toast`, `shadow-modal`, `shadow-queue`).
- Alerts use a 4px left edge in the state colour on its soft tint. That edge belongs to alerts, the coaching call-to-action and toasts only; don't put it on ordinary cards.
- Emphasis on a card is a 2px `accent` border (the highlighted plan, the harder shift). The primary desk card inverts to a `text` fill.

### Motion and states

- Motion is functional and short: the ringing phone wobbles, typing dots blink, new queue rows drop in, the "End shift" button pulses when everything is closed. All of it stops under `prefers-reduced-motion`.
- Hover: buttons take an `accent` border and text; list rows and nav take `surface-2`. Selected: `accent-soft` fill with `accent` text. Disabled: 55% opacity, `not-allowed` cursor.
- Focus: inputs show an `accent` border plus the `focus-ring` halo.

## Iconography

- Line icons on a 24px grid, stroke 1.8, round caps and joins, no fill, drawn in `currentColor` (inline SVG in the source). In the sidebar they rest in `muted` and turn `accent` when active. Buttons size them at 15px, the call bar at 16px, nav at 19px.
- The set is small and fixed: queue, directory, remote desktop, server room, knowledge base, phone, plus dispatch (calendar) and clients (building) in Coordinator mode. They live in `assets/Icons/`.
- The marks are stroked outlines in `accent` at 2.2: a monitor with a prompt for the Help Desk, a calendar for the Service Coordinator. App icons are the same glyphs in white on an `accent` rounded square. They live in `assets/Logos/`.
- No icon font and no third-party set. If you need a new icon, draw it to the same 24px grid and stroke.

## Using this system

- Load the tokens (`css/tokens.css` in this repository), the Archivo face (start screens only), then `components/bundle.css`. Components are plain HTML with the source's class names (`btn primary`, `prio p-high`, `status s-resolved`, `tbl clickable`); there is no JavaScript bundle.
- Theme by setting `data-theme="light"` or `data-theme="dark"` on the root element.
- Every component's README lists its markup and variants. Copy the markup; don't restyle it inline.

## In this repository

This folder is a copy of the published design system (https://claude.ai/artifact/CTDxLdRgRaC9qDJuDn95pJ).

- `tokens.json` is the one place the app's colours, shadows, spacing, radii and font stacks are defined. Change a value here, then run `node tools/build-design-system.js`.
- That script writes `css/tokens.css` (light on `:root`, dark under `prefers-color-scheme` and `[data-theme="dark"]`), which the app loads before `css/styles.css`, and `components/bundle.css`, which is the app's three stylesheets plus `components/preview-helpers.css`. Don't edit either output by hand; the tests fail if they drift.
- `components/<Name>/preview.html` previews expect the tokens and `bundle.css` to be loaded first, as the published page does.
- `assets/` holds the marks and sidebar icons as SVG; `assets/Images.md` points to the screenshots in `docs/`.
