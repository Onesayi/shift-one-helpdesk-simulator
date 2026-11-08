'use strict';

// Skill drills: short practice shifts from one area's tickets (DRILLS in js/dispatch/scenarios.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, game } = require('./harness');
const { cleanRun } = require('./answer-key');

const plain = x => JSON.parse(JSON.stringify(x));

test('every drill builds its own tickets, numbered in arrival order, with nothing else', () => {
  const { DRILLS, SCENARIOS, COMPLAINT, buildShift } = load();
  assert.equal(new Set(DRILLS.map(d => d.id)).size, DRILLS.length);
  for (const d of DRILLS) {
    const sh = buildShift('drill-' + d.id), at = `drill ${d.id}`;
    assert.equal(sh.drill.id, d.id);
    assert.equal(sh.events.length, 0, `${at}: no sick calls or disruptions`);
    assert.deepEqual(plain(sh.tickets.map(t => t.key).sort()), [...d.keys].sort(), `${at}: exactly its tickets`);
    assert.deepEqual(plain(sh.tickets.map(t => t.id)), plain(sh.tickets.map((_, i) => String(4501 + i))), `${at}: numbered`);
    for (let i = 1; i < sh.tickets.length; i++) assert.ok(sh.tickets[i].at >= sh.tickets[i - 1].at, `${at}: sorted`);
    for (const t of sh.tickets) {
      const s = SCENARIOS.find(x => x.id === t.key) || (t.key === COMPLAINT.id ? COMPLAINT : null), lead = s.group ? SCENARIOS.find(x => x.group === s.group) : s;
      assert.ok(s, `${at}: unknown ticket ${t.key}`);
      const delta = t.at - s.at;
      if (lead.window) assert.equal(lead.at + delta, lead.window[0], `${at}: ${t.key} arrives at the start of its window`);
      if (s.truth.startBy != null) assert.equal(t.truth.startBy, s.truth.startBy + (s.slide ? delta : 0), `${at}: ${t.key} startBy`);
    }
  }
  assert.equal(buildShift('drill-nope').drill, null, 'an unknown drill code is just a seeded shift');
});

test('a drill ends straight into the report: no handover, and it is not saved to progress', () => {
  const saved = [];
  const E = load({ getItem: () => null, setItem: (k, v) => saved.push(k) });
  E.newGame('practice', 'drill-approvals');
  for (let m = E.now() + 1; m <= E.SHIFT_END && E.G.phase === 'play'; m++) { E.G.clock = m; if (E.G.ring) E.answerCall(); E.onMinute(m); }
  assert.equal(E.G.phase, 'report');
  assert.equal(E.G.report.handover, null);
  assert.equal(E.G.report.results.length, 4);
  assert.equal(E.G.report.suggest, null, 'a drill does not suggest another drill');
  assert.ok(!saved.includes('shiftone-dispatch-history'), 'history untouched');
});

test('the report suggests the drill for the weakest area, and none after a clean shift', () => {
  const g = game().to(1020);
  const r = g.end();
  assert.ok(r.suggest, 'doing nothing should suggest a drill');
  assert.ok(r.suggest.avg < 90);
  for (const d of g.E.DRILLS) {
    const rs = g.G.shift.map((s, i) => d.keys.includes(s.key) ? r.results[i].score : null).filter(x => x != null);
    if (rs.length) assert.ok(Math.round(rs.reduce((a, b) => a + b, 0) / rs.length) >= r.suggest.avg, `${d.id} was worse than the suggestion`);
  }
  assert.equal(cleanRun().G.report.suggest, null);
});
