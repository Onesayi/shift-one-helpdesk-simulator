'use strict';

// Security checks for a static site (see docs/SECURITY.md): the Content-Security-Policy is in place and
// the same everywhere, nothing runs inline, no eval-style code, external links can't reach back
// through window.opener, and no secrets are committed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PAGES = ['index.html', 'dispatch.html'];
const JS = fs.readdirSync(path.join(ROOT, 'js'), { recursive: true }).filter(f => f.endsWith('.js')).map(f => path.join('js', f));

const metaCsp = html => (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1];
const directives = csp => Object.fromEntries(csp.split(';').map(s => s.trim()).filter(Boolean).map(d => { const [k, ...v] = d.split(/\s+/); return [k, v.join(' ')]; }));

test('both pages carry the same Content-Security-Policy', () => {
  const [a, b] = PAGES.map(p => metaCsp(read(p)));
  assert.ok(a, 'index.html has a CSP meta tag');
  assert.equal(b, a, 'dispatch.html has the same policy');
});

test('the policy only lets this site\'s own scripts run', () => {
  const d = directives(metaCsp(read('index.html')));
  assert.equal(d['script-src'], "'self'");
  assert.equal(d['object-src'], "'none'");
  assert.equal(d['base-uri'], "'self'");
});

test('the nginx header policy matches the meta tag, plus frame-ancestors', () => {
  const conf = read('tools/deploy/security-headers.conf');
  const header = (conf.match(/add_header Content-Security-Policy "([^"]+)" always;/) || [])[1];
  assert.ok(header, 'security-headers.conf sets a CSP');
  const h = directives(header), m = directives(metaCsp(read('index.html')));
  assert.equal(h['frame-ancestors'], "'none'");
  delete h['frame-ancestors'];
  assert.deepEqual(h, m);
  for (const name of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Strict-Transport-Security'])
    assert.match(conf, new RegExp(`add_header ${name} "[^"]+" always;`));
});

test('every nginx location that sets its own headers includes the security headers again', () => {
  const conf = read('tools/deploy/shift-one.nginx.conf');
  const locs = conf.split('\n').filter(l => /^\s*location .*add_header/.test(l));
  assert.ok(locs.length > 0);
  for (const l of locs) assert.match(l, /include snippets\/shift-one-security\.conf;/, l.trim());
  assert.match(conf, /^\s{4}include snippets\/shift-one-security\.conf;/m, 'server level too');
});

test('pages have no inline scripts or inline event handlers', () => {
  for (const p of PAGES) {
    const html = read(p);
    for (const tag of html.match(/<script\b[^>]*>/g) || []) assert.match(tag, /\ssrc="/, `${p}: ${tag}`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, `${p} has an inline on* handler`);
  }
});

test('no eval-style code in the scripts', () => {
  for (const f of JS) {
    const src = read(f);
    assert.doesNotMatch(src, /\beval\s*\(|new Function\s*\(|document\.write\s*\(|set(Timeout|Interval)\s*\(\s*['"`]/, f);
    assert.doesNotMatch(src, /\bon[a-z]+="/, `${f} renders an inline on* handler (blocked by the CSP)`);
  }
});

test('links that open a new tab use rel="noopener"', () => {
  for (const f of [...PAGES, ...JS]) {
    for (const a of read(f).match(/<a\b[^>]*target="_blank"[^>]*>/g) || []) assert.match(a, /rel="[^"]*noopener/, `${f}: ${a}`);
  }
});

test('no secrets are committed', () => {
  let files;
  try { files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean); }
  catch { files = [...PAGES, ...JS]; }
  const PATTERNS = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\b(sk|rk)_live_[0-9a-zA-Z]{10,}/, /\bghp_[0-9A-Za-z]{30,}/, /\bgithub_pat_[0-9A-Za-z_]{20,}/,
    /\bAKIA[0-9A-Z]{16}\b/, /\bxox[abpr]-[0-9A-Za-z-]{10,}/, /\bAIza[0-9A-Za-z_-]{35}\b/, /\bsk-ant-[0-9A-Za-z_-]{20,}/,
  ];
  for (const f of files) {
    assert.doesNotMatch(f, /(^|\/)\.env($|\.)|\.pem$|(^|\/)id_(rsa|ed25519)$/, `${f} looks like a secrets file`);
    if (/\.(png|gif|jpe?g|pdf|woff2?)$/i.test(f)) continue;
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const p of PATTERNS) assert.doesNotMatch(src, p, `${f} matches ${p}`);
  }
});
