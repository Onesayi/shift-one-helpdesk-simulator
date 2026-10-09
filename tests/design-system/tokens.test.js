'use strict';

// design-system/tokens.json is the source of every colour the app uses. These tests keep the
// compiled CSS in step with it and hold the text colours to WCAG AA (4.5:1) in both themes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { outputs } = require('../../tools/build-design-system.js');

const ROOT = path.join(__dirname, '..', '..');
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'design-system/tokens.json'), 'utf8'));
const byName = Object.fromEntries(tokens.color.tokens.map(t => [t.name, t]));
const THEMES = tokens.color.themes.map(t => t.id);

function resolve(name, theme, seen = new Set()) {
  assert.ok(byName[name], `unknown colour token ${name}`);
  assert.ok(!seen.has(name), `alias cycle at ${name}`);
  seen.add(name);
  const v = byName[name].value;
  const raw = typeof v === 'string' ? v : (v[theme] ?? v[THEMES[0]]);
  return /^\{.+\}$/.test(raw) ? resolve(raw.slice(1, -1), theme, seen) : raw;
}

function luminance(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('css/tokens.css and the design system bundle are built from the current sources', () => {
  for (const [file, text] of Object.entries(outputs())) {
    const current = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.equal(current, text, `${file} is out of date. Run: node tools/build-design-system.js`);
  }
});

test('token names are unique and every alias resolves', () => {
  const names = ['color', 'spacing', 'radius', 'shadow', 'layout'].flatMap(f => tokens[f].tokens.map(t => t.name));
  assert.equal(new Set(names).size, names.length, 'duplicate token name');
  for (const t of tokens.color.tokens) for (const theme of THEMES) resolve(t.name, theme);
});

test('every var(--x) the app CSS uses is defined', () => {
  const defined = new Set(fs.readFileSync(path.join(ROOT, 'css/tokens.css'), 'utf8').match(/--[\w-]+(?=:)/g));
  const css = ['css/styles.css', 'css/landing.css', 'css/dispatch.css'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  for (const m of css.match(/--[\w-]+(?=:)/g)) defined.add(m); // locally declared helpers (--mono, --display)
  const missing = [...new Set(css.match(/var\(--[\w-]+/g).map(v => v.slice(4)))].filter(v => !defined.has(v));
  assert.deepEqual(missing, []);
});

// [text, ground]: pairs the components actually paint
const PAIRS = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['text', 'bubble'], ['text', 'int'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'],
  ['accent', 'bg'], ['accent', 'surface'], ['accent', 'accent-soft'],
  ['on-accent', 'accent'], ['on-bad', 'bad'],
  ['good', 'good-soft'], ['warn', 'warn-soft'], ['bad', 'bad-soft'],
  ['crit', 'bad-soft'], ['high', 'warn-soft'], ['med', 'warn-soft'], ['low', 'good-soft'],
  ['console-fg', 'console-bg'], ['term-fg', 'term-bg'], ['popup-fg', 'popup-bg'], ['ransom-fg', 'ransom-bg'],
];

for (const theme of THEMES) {
  test(`text colours reach 4.5:1 in the ${theme} theme`, () => {
    const failing = PAIRS
      .map(([fg, bg]) => [fg, bg, contrast(resolve(fg, theme), resolve(bg, theme))])
      .filter(([, , r]) => r < 4.5)
      .map(([fg, bg, r]) => `${fg} on ${bg}: ${r.toFixed(2)}`);
    assert.deepEqual(failing, []);
  });
}
