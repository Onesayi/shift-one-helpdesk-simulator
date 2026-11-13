'use strict';

// Exchange Online outage (shift code 'outage', js/dispatch/outage.js and PB-16), modelled on the
// Microsoft 365 outage of 12–13 November 2026.

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, game, has } = require('./harness');

const plain = x => JSON.parse(JSON.stringify(x));
const answer = g => () => { if (g.G.ring) g.answer(); };

// Ticket numbers, in arrival order.
const X = { hdg: '4821', kfl: '4822', bl: '4823', oak: '4824', vish: '4825', blMail: '4826', offline: '4827' };

// Runs the outage the way PB-16 says. Returns the game before it ends.
function cleanOutage({ pir = true } = {}) {
  const g = game('practice', 'outage');
  const step = (m, fn) => { g.to(m, answer(g)); if (fn) fn(); };
  step(485, () => { g.triageRight(X.hdg); g.E.declareMajor(g.ticket(X.hdg)); g.send(X.hdg, 'ack').notify(X.hdg, 'sm').schedule(X.hdg, 'maya', 495); });
  step(492, () => g.merge(X.kfl, X.hdg));
  step(495, () => g.merge(X.bl, X.hdg));
  step(506, () => g.vendor(X.hdg, 'Microsoft').send(X.hdg, 'mi'));
  step(510, () => g.merge(X.oak, X.hdg));
  step(520, () => g.triageRight(X.vish).send(X.vish, 'ack').notify(X.vish, 'sm').schedule(X.vish, 'maya', 525));
  step(535, () => g.send(X.hdg, 'mi'));
  step(560, () => g.send(X.hdg, 'mi'));
  step(565, () => g.send(X.vish, 'resolved'));
  step(570, () => g.bill(X.vish).close(X.vish, 'resolved', 'No access given; sign-ins and MFA history clean. Caller reported.'));
  step(580, () => g.merge(X.blMail, X.hdg));
  step(589, () => g.send(X.hdg, 'mi'));
  step(615, () => g.send(X.hdg, 'mi'));
  step(622, () => g.send(X.hdg, 'resolved'));
  step(625, () => g.bill(X.hdg).close(X.hdg, 'resolved', 'Microsoft mitigated MO1550821. Mailboxes checked in all four tenants.'));
  if (pir) step(630, () => {
    for (const f of g.E.OUTAGE_PIR) g.G.drafts['pir-' + f.id] = f.a;
    g.E.submitPir(g.ticket(X.hdg));
  });
  step(641, () => g.triageRight(X.offline).send(X.offline, 'ack').schedule(X.offline, 'ana', 650));
  step(670, () => g.send(X.offline, 'resolved'));
  step(675, () => g.bill(X.offline).close(X.offline, 'resolved', 'Turned off Work Offline in Jamie\'s Outlook.'));
  return g;
}

test('the outage is its own fixed set of tickets, 08:00 to 11:30', () => {
  const { buildShift, OUTAGE_SCENARIOS, CLIENTS, INCIDENTS } = load();
  assert.deepEqual(plain(INCIDENTS.map(i => i.drill.id)), ['major', 'outage']);
  const sh = buildShift('outage');
  assert.equal(sh.drill.id, 'outage');
  assert.deepEqual(plain(sh.tickets.map(t => t.id)), Object.values(X));
  const incident = OUTAGE_SCENARIOS.filter(s => s.group === 'xo-exo');
  assert.equal(new Set(incident.map(s => s.client)).size, 4, 'four clients hit by the outage');
  for (const s of incident) assert.ok(CLIENTS[s.client].vendors.includes(s.vendor), `${s.id}: Microsoft is one of the client's vendors`);
  const g = game('practice', 'outage');
  assert.equal(g.G.end, 690);
});

test('run by the playbook, every ticket scores 100', () => {
  const g = cleanOutage();
  const r = g.end();
  r.results.forEach((x, i) => assert.equal(x.score, 100, `#${g.G.shift[i].id}: ${x.ded.map(d => d[1]).join(' | ')}`));
  assert.equal(r.handover, null, 'no handover, like a drill');
});

test('the engineer says it is Microsoft, and warns against reinstalling Office', () => {
  const g = game('practice', 'outage');
  g.to(485, answer(g)).triageRight(X.hdg).schedule(X.hdg, 'maya', 495);
  g.to(506, answer(g));
  const t = g.ticket(X.hdg);
  assert.equal(t.status, 'Waiting on vendor');
  assert.match(t.thread.filter(m => m.kind === 'tech').pop().text, /reinstalls Office/);
  g.vendor(X.hdg, 'Microsoft');
  g.to(512, answer(g));
  assert.match(t.lastVendorMsg, /EX1550543/);
});

test('the first recovery does not hold: calling it fixed then is premature', () => {
  const g = game('practice', 'outage');
  g.to(485, answer(g)).triageRight(X.hdg);
  g.E.declareMajor(g.ticket(X.hdg));
  g.schedule(X.hdg, 'maya', 495);
  g.to(510, answer(g)).merge(X.oak, X.hdg);
  g.to(g.E.OUTAGE_BLIP + 3, answer(g));
  assert.match(g.ticket(X.oak).thread.pop().text, /It's back!/);
  assert.equal(g.ticket(X.hdg).status, 'Waiting on vendor', 'nothing is fixed yet');
  g.send(X.hdg, 'resolved');
  assert.ok(has(g.grade(X.hdg), /before the technician had finished/));
  g.to(g.E.OUTAGE_RELAPSE + 3, answer(g));
  assert.match(g.ticket(X.oak).thread.pop().text, /gone again/);
  g.to(g.E.OUTAGE_RESTORE, answer(g));
  assert.equal(g.ticket(X.hdg).status, 'Completed');
  assert.equal(g.G.majorRestored, g.E.OUTAGE_RESTORE);
});

test('the incident update names this outage', () => {
  const g = game('practice', 'outage');
  g.to(495, answer(g));
  g.E.declareMajor(g.ticket(X.hdg));
  g.merge(X.kfl, X.hdg).merge(X.bl, X.hdg);
  g.send(X.hdg, 'mi');
  const last = g.ticket(X.kfl).thread.filter(m => m.from === 'me').pop();
  assert.match(last.text, /^Hi Maria, an update on the Microsoft 365 email outage/);
});

test('the scam call is a separate security ticket, not part of the outage', () => {
  const g = game('practice', 'outage');
  g.to(525, answer(g));
  g.E.declareMajor(g.ticket(X.hdg));
  g.merge(X.vish, X.hdg);
  assert.ok(has(g.grade(X.vish), /separate problem/));
  const h = game('practice', 'outage');
  h.to(525, answer(h)).triage(X.vish, { priority: 'P4', board: 'Help Desk', skill: 'M365', onsite: false, est: 30 });
  const r = h.grade(X.vish);
  assert.ok(has(r, /Priority P4; should be P2/));
  assert.ok(has(r, /belongs on Security/));
});

test('a mailbox still empty after the fix is its own ticket', () => {
  const g = cleanOutage();
  const h = game('practice', 'outage');
  h.to(645, answer(h));
  h.E.declareMajor(h.ticket(X.hdg));
  h.merge(X.offline, X.hdg);
  assert.ok(has(h.grade(X.offline), /separate problem/));
  assert.equal(g.grade(X.offline).score, 100);
});

test('the review asks about lost mail and the false recovery', () => {
  const g = cleanOutage({ pir: false });
  const { OUTAGE_PIR } = g.E;
  for (const f of OUTAGE_PIR) g.G.drafts['pir-' + f.id] = f.a;
  g.G.drafts['pir-blip'] = 'fixed';
  g.G.drafts['pir-end'] = String(g.E.OUTAGE_BLIP);
  g.E.submitPir(g.ticket(X.hdg));
  const r = g.grade(X.hdg);
  assert.equal(r.score, 90, r.ded.map(d => d[1]).join(' | '));
  assert.ok(has(r, /Review: "At 09:05/));
  assert.ok(has(r, /Review: "When was service restored\?" should be "10:20"/));
});

test('the classic major incident still uses its own review', () => {
  const g = game('practice', 'major');
  assert.equal(g.E.INCIDENTS[0].pir, g.E.PIR);
  const o = game('practice', 'outage');
  assert.notEqual(o.E.OUTAGE_PIR.length, o.E.PIR.length);
});
