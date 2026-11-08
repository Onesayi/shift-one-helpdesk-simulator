'use strict';

// Major incident mode (shift code 'major', js/dispatch/major.js and PB-16).

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, game, has } = require('./harness');

const plain = x => JSON.parse(JSON.stringify(x));
const answer = g => () => { if (g.G.ring) g.answer(); };

// Ticket numbers, in arrival order.
const M = { hdg: '4801', kfl: '4802', bl: '4803', oak: '4804', printer: '4805', keller: '4806', teacher: '4807' };

// Runs the incident the way PB-16 says, from 08:05. Returns the game before it ends.
function cleanMajor({ cadence = true, pir = true } = {}) {
  const g = game('practice', 'major');
  const step = (m, fn) => { g.to(m, answer(g)); if (fn) fn(); };
  step(485, () => { g.triageRight(M.hdg); g.E.declareMajor(g.ticket(M.hdg)); g.send(M.hdg, 'ack').notify(M.hdg, 'sm').schedule(M.hdg, 'maya', 495); });
  step(488, () => g.merge(M.kfl, M.hdg));
  step(490, () => g.merge(M.bl, M.hdg));
  step(494, () => g.merge(M.oak, M.hdg));
  step(500, () => g.vendor(M.hdg, 'Microsoft').send(M.hdg, 'mi'));
  step(515, () => g.triageRight(M.printer).send(M.printer, 'ack').schedule(M.printer, 'ana', 525));
  step(525, () => g.merge(M.keller, M.hdg));
  if (cadence) step(528, () => g.send(M.hdg, 'mi'));
  step(556, () => { g.send(M.hdg, 'mi'); g.send(M.printer, 'resolved'); });
  step(560, () => g.bill(M.printer).close(M.printer, 'resolved', 'Reserved the printer\'s IP on the clinic router.'));
  step(585, () => g.send(M.hdg, 'mi'));
  step(592, () => g.send(M.hdg, 'resolved'));
  step(595, () => g.bill(M.hdg).close(M.hdg, 'resolved', 'Microsoft rolled back MO881204. All four tenants checked.'));
  if (pir) step(600, () => {
    for (const f of g.E.PIR) g.G.drafts['pir-' + f.id] = f.a;
    g.E.submitPir(g.ticket(M.hdg));
  });
  step(605, () => g.triageRight(M.teacher).send(M.teacher, 'ack').schedule(M.teacher, 'ana', 615));
  step(631, () => g.send(M.teacher, 'resolved'));
  step(635, () => g.bill(M.teacher).close(M.teacher, 'resolved', 'Reset Kwame\'s expired password.'));
  return g;
}

test('the major incident is its own fixed set of tickets, 08:00 to 11:00', () => {
  const { buildShift, MAJOR_SCENARIOS, CLIENTS } = load();
  const sh = buildShift('major');
  assert.equal(sh.drill.id, 'major');
  assert.deepEqual(plain(sh.tickets.map(t => t.id)), Object.values(M));
  const incident = MAJOR_SCENARIOS.filter(s => s.group === 'mi-m365');
  assert.equal(new Set(incident.map(s => s.client)).size, 4, 'four clients hit by the outage');
  for (const s of incident) assert.ok(CLIENTS[s.client].vendors.includes(s.vendor), `${s.id}: Microsoft is one of the client's vendors`);
  const g = game('practice', 'major');
  assert.equal(g.G.end, 660);
  assert.ok(!g.E.crew().includes('jordan'));
});

test('run by the playbook, every ticket scores 100', () => {
  const g = cleanMajor();
  const r = g.end();
  r.results.forEach((x, i) => assert.equal(x.score, 100, `#${g.G.shift[i].id}: ${x.ded.map(d => d[1]).join(' | ')}`));
  assert.equal(r.handover, null, 'no handover, like a drill');
});

test('only a declared major incident takes tickets from other clients', () => {
  const g = game('practice', 'major');
  g.to(490, answer(g));
  assert.equal(g.ticket(M.hdg).major, undefined);
  g.E.declareMajor(g.ticket(M.hdg));
  assert.equal(g.ticket(M.hdg).major, true);
  g.E.declareMajor(g.ticket(M.kfl));
  assert.equal(g.ticket(M.kfl).major, undefined, 'one major incident at a time');
  g.merge(M.bl, M.hdg);
  assert.match(g.ticket(M.bl).thread.pop().text, /Linked to major incident #4801/);
});

test('an update from the incident reaches every linked client', () => {
  const g = game('practice', 'major');
  g.to(495, answer(g));
  g.E.declareMajor(g.ticket(M.hdg));
  g.merge(M.kfl, M.hdg).merge(M.bl, M.hdg).merge(M.oak, M.hdg);
  g.send(M.hdg, 'mi');
  for (const [id, name] of [[M.kfl, 'Maria'], [M.bl, 'Brightline team'], [M.oak, 'Carl']]) {
    const last = g.ticket(id).thread.filter(m => m.from === 'me').pop();
    assert.match(last.text, new RegExp(`^Hi ${name}, an update on the Microsoft 365 sign-in outage`));
    assert.match(last.text, /update you again by 08:45/);
  }
  assert.deepEqual(plain(g.E.logged('client-msg').pop().to), [M.kfl, M.bl, M.oak]);
});

test('the incident update is only offered on a major incident', () => {
  const g = game('practice', 'major');
  g.to(495, answer(g));
  assert.equal(g.E.TEMPLATES.mi.only(g.ticket(M.hdg)), undefined);
  g.E.declareMajor(g.ticket(M.hdg));
  assert.equal(g.E.TEMPLATES.mi.only(g.ticket(M.hdg)), true);
});

test('Microsoft fixes it at 09:50 and the engineer confirms', () => {
  const g = game('practice', 'major');
  g.to(485, answer(g)).triageRight(M.hdg).schedule(M.hdg, 'maya', 495);
  g.to(505, answer(g));
  assert.equal(g.ticket(M.hdg).status, 'Waiting on vendor');
  g.vendor(M.hdg, 'Microsoft');
  g.to(511, answer(g));
  assert.match(g.ticket(M.hdg).lastVendorMsg, /MO881204/);
  g.to(590, answer(g));
  assert.equal(g.ticket(M.hdg).status, 'Completed');
  assert.equal(g.G.majorRestored, 590);
});

test('a gap in updates, missing review and unlinked clients all cost points', () => {
  const g = cleanMajor({ cadence: false, pir: false });
  const r = g.grade(M.hdg);
  assert.ok(has(r, /One gap of more than 30 minutes/), r.ded.map(d => d[1]).join(' | '));
  assert.ok(has(r, /No post-incident review/));
  const lazy = game('practice', 'major');
  lazy.to(560, answer(lazy));
  const q = lazy.grade(M.kfl);
  assert.ok(has(q, /Same fault as/));
  assert.ok(has(lazy.grade(M.hdg), /Never declared a major incident/));
  assert.ok(has(lazy.grade(M.hdg), /Service Manager never heard/));
});

test('linking an unrelated ticket to the incident is graded as a mistake', () => {
  const g = game('practice', 'major');
  g.to(515, answer(g));
  g.E.declareMajor(g.ticket(M.hdg));
  g.merge(M.printer, M.hdg);
  assert.ok(has(g.grade(M.printer), /separate problem/));
});

test('a wrong answer in the review costs 5', () => {
  const g = cleanMajor({ pir: false });
  const { PIR } = g.E;
  for (const f of PIR) g.G.drafts['pir-' + f.id] = f.a;
  g.G.drafts['pir-action'] = 'none';
  g.E.submitPir(g.ticket(M.hdg));
  const r = g.grade(M.hdg);
  assert.equal(r.score, 95, r.ded.map(d => d[1]).join(' | '));
  assert.ok(has(r, /Review: "What should change/));
});
