'use strict';

// Whole-shift checks against the claims in docs/COORDINATOR.md:
// "A clean run scores in the high 90s. Doing nothing scores about 20."

const test = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./harness');
const { cleanRun } = require('./answer-key');

test('doing nothing scores about 20 and gets an F', () => {
  const g = game();
  g.to(g.E.SHIFT_END);
  const r = g.G.report;
  assert.equal(g.G.phase, 'report');
  assert.equal(r.results.length, 18);
  assert.ok(r.final >= 10 && r.final <= 30, `expected about 20, got ${r.final}`);
  assert.equal(r.grade, 'F');
  assert.equal(r.kpi.missed, 5, 'all five phone calls go to voicemail');
});

test('playing the answer key scores 100 on every ticket', () => {
  const g = cleanRun();
  const r = g.G.report;
  const lines = r.results.map((x, i) => x.ded.length ? `#${g.G.shift[i].id} ${x.score}: ${x.ded.map(d => `-${d[0]} ${d[1]}`).join(' | ')}` : null).filter(Boolean);
  assert.equal(lines.join('\n'), '', 'every ticket should score 100 when played by the answer key');
  assert.equal(r.final, 100);
  assert.equal(r.grade, 'A');
  assert.equal(r.kpi.missed, 0);
  assert.equal(r.kpi.chasers, 0);
  assert.equal(r.kpi.bounces, 0);
});
