# Contributing

Thanks for your interest! The most valuable contributions are **realistic scenarios**: problems you've actually seen on a help desk.

## Ways to help

- **Suggest a scenario:** open a [scenario request](../../issues/new?template=scenario_request.md). Describe the symptom the user reports, the real cause, the fix, and the mistake a new technician would make.
- **Report a bug:** use the [bug report](../../issues/new?template=bug_report.md) template.
- **Improve a KB article:** small, focused pull requests are welcome.

## Development

No build tools are needed.

```bash
python -m http.server 8765
# open http://localhost:8765
```

- Scenarios: `js/scenarios.js` (see [docs/AUTHORING.md](docs/AUTHORING.md))
- World data and KB: `js/data.js`
- Engine and UI: `js/app.js`
- Styles: `css/styles.css` (use the CSS variables and check both themes)

Before opening a PR:

1. Play the affected tickets once correctly and once badly, and check the scores make sense.
2. Check light and dark mode, and a narrow (phone) window.
3. If the UI changed, regenerate images: `python tools/screenshots.py`.

## Style

- Plain JavaScript, no dependencies.
- Match the surrounding code: small functions, template-string rendering, `data-act` event delegation.
- User-facing text is plain and specific, like a real colleague would write it.

By contributing you agree to the terms in [LICENSE](LICENSE).
