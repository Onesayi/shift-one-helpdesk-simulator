'use strict';

// "Needed by" at triage, the at-risk warnings it drives, and the dispatch board's capacity strip.
// None of it changes the score: it's the coordinator's own note, shown back to them.

const test = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./harness');

// Triage #4501 the right way, noting the client's 15:00 claims run as the needed-by time.
function noted(due = 900) {
  const g = game();
  g.G.drafts['tri-4501-due'] = String(due);
  return g.triageRight('4501');
}
const live = (g, id) => g.G.appts.find(a => String(a.ticket) === String(id) && a.state !== 'cancelled');

test('needed-by is optional, and saved with the triage when given', () => {
  const g = game().triageRight('4501');
  assert.equal(g.ticket('4501').triage.due, undefined);
  assert.equal(noted(900).ticket('4501').triage.due, 900);
});

test('the triage form offers half-hour times inside working hours, today and tomorrow', () => {
  const opts = game().E.dueOptions().map(o => o[0]);
  assert.ok(opts.length > 0);
  assert.ok(opts.every(m => m % 30 === 0 && m % 1440 >= 480 && m % 1440 <= 1020));
  assert.ok(opts.some(m => m >= 1440), 'Friday times too');
});

test('a booking that ends after the needed-by time is at risk, and the dialog says so', () => {
  const g = noted(900);
  const t = g.ticket('4501');
  const R = g.E.checkSlot(t, 'ana', 885, 30, false);
  assert.ok(R.warns.some(w => /after the .*15:00.* needed by/.test(w)), R.warns.join(' | '));
  assert.equal(R.errors.length, 0, 'a warning, not a block');
  g.schedule('4501', 'ana', 885, { dur: 30 });
  assert.equal(g.E.lateFor(t, live(g, '4501')), true);
});

test('a booking that finishes in time is not at risk', () => {
  const g = noted(900).schedule('4501', 'ana', 600, { dur: 30 });
  const t = g.ticket('4501');
  assert.equal(g.E.lateFor(t, live(g, '4501')), false);
  assert.ok(!g.E.checkSlot(t, 'ana', 600, 30, false).warns.some(w => /needed by/.test(w)));
});

test('noting a needed-by time doesn\'t change the grade', () => {
  const a = game().triageRight('4501').schedule('4501', 'ana', 600, { dur: 30 }).grade('4501');
  const b = noted(900).schedule('4501', 'ana', 600, { dur: 30 }).grade('4501');
  assert.equal(JSON.stringify(b), JSON.stringify(a));
});

test('capacity adds up to the technician\'s hours on the board, and a booking moves time from free to jobs', () => {
  const g = game();
  const [from, to] = [g.G.start, g.G.end];
  const before = g.E.capacity('ana', from, to);
  assert.equal(before.jobs + before.other + before.past + before.free, before.total);
  g.triageRight('4501').schedule('4501', 'ana', 600, { dur: 60 });
  const after = g.E.capacity('ana', from, to);
  assert.equal(after.jobs - before.jobs, 60);
  assert.equal(before.free - after.free, 60);
});
