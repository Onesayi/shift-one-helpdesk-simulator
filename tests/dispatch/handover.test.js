'use strict';

// The end-of-shift handover to the on-call engineer (PB-11, "Shift handover" in docs/COORDINATOR.md).

const test = require('node:test');
const assert = require('node:assert/strict');
const { game, has } = require('./harness');

function deducts(r, pts, re) {
  const d = has(r, re);
  assert.ok(d, `expected a deduction matching ${re}; got: ${r.ded.map(x => `-${x[0]} ${x[1]}`).join(' | ') || 'none'}`);
  assert.equal(d[0], pts, `"${d[1]}"`);
}
const clean = (r, re) => assert.ok(!has(r, re), `unexpected deduction matching ${re}`);
const SUMMARY = 'Busy morning, quiet afternoon. Two items for tonight.';

test('at 17:00 the clock stops and the shift waits for the handover', () => {
  const g = game().to(1020);
  assert.equal(g.G.phase, 'handover');
  assert.equal(g.G.report, undefined, 'nothing is graded until the handover is in');
  g.to(1030);
  assert.equal(g.now(), 1020, 'the clock does not move during the handover');
});

test('an open P1 or P2 left out of the handover costs 20; flagged with a note it is praised', () => {
  const g = game().to(620); // #4511, the P2 backup failure, arrived at 10:15
  deducts(g.handover({}, SUMMARY).E.gradeHandover(), 20, /#4511 is a P2 that's still open/);
  const r = g.handover({ 4511: 'Maya is on it tomorrow first thing.' }, SUMMARY).E.gradeHandover();
  clean(r, /#4511/);
  assert.ok(r.good.some(x => /Handed over #4511/.test(x)));
});

test('a ticket waiting on an approval or a vendor costs 10 if it is left out', () => {
  const g = game().to(510).triageRight('4505').approval('4505', 'msantos');
  assert.equal(g.ticket('4505').status, 'Waiting on approval');
  deducts(g.handover({}, SUMMARY).E.gradeHandover(), 10, /#4505 is waiting on an approval/);
});

test('work nobody can do overnight costs 10: not booked, or still booked with the sick tech', () => {
  const g = game().to(600); // Ben went home sick at 09:45 with #4471 and #4476 still on his calendar
  const r = g.handover({}, SUMMARY).E.gradeHandover();
  deducts(r, 10, /#4471 is not booked with anyone who can work it/);
  deducts(r, 10, /#4501 is not booked/);
});

test('work already booked for tomorrow with someone who will be in needs no flag', () => {
  const g = game().to(496).answer();
  g.triageRight('4504').schedule('4504', 'ana', g.E.DAY + 480);
  assert.equal(g.E.handoverNeed(g.ticket('4504')), null);
});

test('a flag without a note costs 5; a missing summary costs 10', () => {
  const g = game().to(620).handover({ 4511: 'see' }, '');
  const r = g.E.gradeHandover();
  deducts(r, 5, /Flagged #4511 without a note/);
  deducts(r, 10, /No summary/);
});

test('the handover counts like one more ticket in the shift score', () => {
  const g = game().to(1020).handover({}, SUMMARY);
  const r = g.end();
  const sum = r.results.reduce((x, y) => x + y.score, 0);
  assert.equal(r.final, Math.round((sum + r.handover.score) / (r.results.length + 1)));
  assert.equal(r.kpi.handover, r.handover.score, 'saved with the KPIs for the progress card');
});
