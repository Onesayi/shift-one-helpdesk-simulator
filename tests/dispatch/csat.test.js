'use strict';

// Client satisfaction surveys (PB-14): resolved tickets get a 1–5 rating that follows from how they were
// handled, and anything 3 or under needs a reply from the coordinator.

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, game, has } = require('./harness');
const { cleanRun } = require('./answer-key');

// #4501 (Harbor Dental, premium P3, 60-minute response target) arrives at 08:00 in the classic shift.
function front(g, { wait = 0, confirm = true } = {}) {
  g.to(480 + wait);
  g.triageRight('4501').send('4501', 'ack').schedule('4501', 'ana', Math.ceil((g.now() + 1) / 15) * 15);
  g.to(g.now() + 45);
  if (confirm) g.send('4501', 'resolved');
  g.bill('4501').close('4501', 'resolved');
  return g;
}

test('a clean shift gets five stars on every survey', () => {
  const g = cleanRun();
  const rated = g.G.tickets.filter(t => t.csat);
  assert.ok(rated.length >= 5, `${rated.length} surveys came back`);
  for (const t of rated) assert.equal(t.csat.rating, 5, `#${t.id}: ${t.csat.why.join(' ')}`);
  assert.equal(g.G.report.kpi.csat, 100);
});

test('the survey arrives five minutes after closing, in the ticket thread', () => {
  const g = front(game());
  const t = g.ticket('4501'), closed = t.closed.at;
  assert.equal(t.csat, undefined);
  g.to(closed + 5);
  assert.equal(t.csat.rating, 5);
  const last = t.thread[t.thread.length - 1];
  assert.match(last.text, /^★★★★★ 5\/5\./);
  assert.match(last.label, /Lena Park \(satisfaction survey\)/);
});

test('only resolved tickets with a client contact are surveyed', () => {
  const g = game();
  g.to(500).close('4503', 'noise', 'Oakridge lab VMs shut down every night.');
  g.to(520);
  assert.equal(g.ticket('4503').csat, undefined, 'an alert has nobody to ask');
  g.triageRight('4505').approval('4505', 'msantos');
  g.to(530).send('4505', 'declined').close('4505', 'declined', 'Maria declined access to the Partners folder.');
  g.to(540);
  assert.equal(g.ticket('4505').csat, undefined, 'a declined request is not surveyed');
});

test('a slow, chased ticket scores low, and the grader wants a reply', () => {
  const g = front(game(), { wait: 95 });
  const t = g.ticket('4501');
  assert.equal(t.chasers, 1);
  g.to(g.now() + 5);
  assert.equal(t.csat.rating, 3);
  assert.deepEqual(Array.from(t.csat.why), ['I had to chase you for an update.', 'It took a while for anyone to get back to me.']);
  g.to(g.now() + 30);
  assert.ok(has(g.grade('4501'), /rated it 3\/5 and nobody replied/));
});

test('replying to a low score clears the deduction', () => {
  const g = front(game(), { wait: 95 });
  g.to(g.now() + 5);
  g.E.followUpCsat(g.ticket('4501'));
  const t = g.ticket('4501');
  assert.match(t.thread[t.thread.length - 1].text, /sorry we fell short\. I had to chase you for an update\./);
  g.to(g.now() + 60);
  const r = g.grade('4501');
  assert.ok(!has(r, /nobody replied/));
  assert.ok(r.good.some(x => /3\/5, and you followed up quickly/.test(x)));
  g.E.followUpCsat(t);
  assert.equal(g.E.logged('csat-follow').length, 1, 'only one follow-up');
});

test('closing without a resolution message costs a star, but 4/5 needs no reply', () => {
  const g = front(game(), { confirm: false });
  g.to(g.now() + 40);
  const t = g.ticket('4501');
  assert.equal(t.csat.rating, 4);
  assert.match(t.csat.comment, /Nobody told me it was done/);
  assert.ok(!has(g.grade('4501'), /nobody replied/));
});

test('a low score that lands at the very end of the shift is not held against you', () => {
  const g = game();
  g.to(g.E.SHIFT_END - 20);
  const t = g.ticket('4501');
  t.csat = { rating: 2, at: g.now(), why: ['x'], comment: 'x', followed: null };
  g.to(g.E.SHIFT_END - 1);
  assert.ok(!has(g.grade('4501'), /nobody replied/));
});

test('CSAT is a KPI and a progress row', () => {
  const saved = {};
  const E = load({ getItem: k => saved[k] ?? null, setItem: (k, v) => { saved[k] = v; } });
  E.newGame('timed', 'classic');
  E.startHandover(); E.endShift();
  const h = JSON.parse(saved['shiftone-dispatch-history']);
  assert.ok('csat' in h[0].kpi);
  assert.equal(h[0].kpi.csat, null, 'no surveys, no score');
  assert.equal(cleanRun().G.report.kpi.csat, 100);
});
