'use strict';

// One test per row of the "Grading" table in docs/COORDINATOR.md, driven through the real engine.

const test = require('node:test');
const assert = require('node:assert/strict');
const { game, has } = require('./harness');

// Asserts a deduction of `pts` whose text matches `re`.
function deducts(r, pts, re) {
  const d = has(r, re);
  assert.ok(d, `expected a deduction matching ${re}; got: ${r.ded.map(x => `-${x[0]} ${x[1]}`).join(' | ') || 'none'}`);
  assert.equal(d[0], pts, `"${d[1]}"`);
}
const clean = (r, re) => assert.ok(!has(r, re), `unexpected deduction matching ${re}`);
const answering = g => () => { if (g.G.ring) g.answer(); };

// #4501 arrives at 08:00: Harbor Dental (premium SLA), P3 Help Desk / Printers / remote, start by 14:30.

test('triage: never triaged costs 25', () => {
  deducts(game().to(600).grade('4501'), 25, /Never triaged/);
});

test('triage: within 15 minutes is free, over 15 costs 5, over 30 costs 10', () => {
  clean(game().to(495).triageRight('4501').grade('4501'), /to triage/);
  deducts(game().to(500).triageRight('4501').grade('4501'), 5, /Took 20 minutes to triage/);
  deducts(game().to(515).triageRight('4501').grade('4501'), 10, /Took 35 minutes to triage/);
});

test('triage: priority off by one costs 10, off by two or more costs 20', () => {
  clean(game().triageRight('4501').grade('4501'), /^Priority/);
  deducts(game().triageRight('4501', { priority: 'P2' }).grade('4501'), 10, /Priority P2; should be P3/);
  deducts(game().triageRight('4501', { priority: 'P4' }).grade('4501'), 10, /Priority P4; should be P3/);
  deducts(game().triageRight('4501', { priority: 'P1' }).grade('4501'), 20, /Priority P1; should be P3/);
});

test('triage: a priority listed in okPri is accepted', () => {
  // #4505 is P4, but P3 is also fine.
  clean(game().to(510).triageRight('4505', { priority: 'P3' }).grade('4505'), /^Priority/);
});

test('triage: wrong board, skill and work type cost 5 each', () => {
  const r = game().triageRight('4501', { board: 'Infrastructure', skill: 'M365', onsite: true }).grade('4501');
  deducts(r, 5, /Put on Infrastructure/);
  deducts(r, 5, /Skill set to M365/);
  deducts(r, 5, /This is remote work/);
});

test('response: no first response costs 20, a late one costs 10', () => {
  clean(game().send('4501', 'ack').grade('4501'), /First response|never heard/);
  deducts(game().to(530).grade('4501'), 20, /never heard from us/);
  deducts(game().to(560).send('4501', 'ack').grade('4501'), 10, /First response after 80 min/);
});

test('response: a missed call costs 10 on top of the missing response', () => {
  // #4504 rings at 08:15 and goes to voicemail after 10 minutes.
  const g = game().to(510);
  assert.ok(g.ticket('4504').missedCall);
  const r = g.grade('4504');
  deducts(r, 10, /Missed the call/);
  deducts(r, 20, /never heard from us/);
});

test('response: answering the call counts as the first response', () => {
  const g = game();
  const r = g.to(510, answering(g)).grade('4504');
  clean(r, /Missed the call|never heard|First response after/);
});

test('chasers: 10 each, capped at 20', () => {
  // Never acknowledged: Lena chases once after the SLA plus a grace period.
  deducts(game().to(600).grade('4501'), 10, /had to chase us\.$/);
  // A P1 with no updates gets chased every 45 minutes; the cost stops at 20.
  const g = game();
  g.to(530, answering(g)).to(800);
  assert.ok(g.ticket('4506').chasers >= 3);
  deducts(g.grade('4506'), 20, /had to chase us \d+ times/);
});

test('telling the client it is fixed before the tech finished costs 15', () => {
  deducts(game().triageRight('4501').send('4501', 'resolved').grade('4501'), 15, /before the technician had finished/);
});

test('dispatch: a tech without the skill costs 15, and they hand it back', () => {
  const g = game().triageRight('4501').schedule('4501', 'maya', 480).to(520);
  deducts(g.grade('4501'), 15, /Sent to Maya Chen, who can't do this: it needs Printers skills/);
  assert.equal(g.ticket('4501').status, 'Needs reassign');
});

test('dispatch: remote booking for onsite work costs 15', () => {
  // #4514 (hall projector) rings at 11:30 and needs Luis onsite.
  const g = game();
  g.to(690, answering(g)).triageRight('4514').schedule('4514', 'luis', 750, { onsite: false });
  deducts(g.grade('4514'), 15, /Sent Luis Romero remotely: this needs a site visit/);
});

test('dispatch: never scheduling costs 30', () => {
  deducts(game().triageRight('4501').to(600).grade('4501'), 30, /Never scheduled a technician/);
});

test('dispatch: leaving a job with the sick tech costs 30', () => {
  // #4471 is carried over with Ben at 11:00; Ben goes home at 09:45.
  deducts(game().to(700).grade('4471'), 30, /Still booked with Ben Carter/);
  clean(game().to(600).schedule('4471', 'ana', 690).grade('4471'), /Still booked/);
});

test('dispatch: booking after the deadline costs 10', () => {
  deducts(game().triageRight('4501').schedule('4501', 'ana', 900).grade('4501'), 10, /needed to start by 14:30/);
});

test('dispatch: onsite outside the client window costs 10 (non-P1)', () => {
  // #4515 arrives at 12:00; Harbor Dental only allows visits 12:00–13:00.
  const g = game().to(720).triageRight('4515');
  deducts(g.schedule('4515', 'luis', 900, { onsite: true }).grade('4515'), 10, /only allows visits 12:00–13:00/);
  const ok = game().to(720).triageRight('4515').schedule('4515', 'luis', 1440 + 720, { onsite: true });
  clean(ok.grade('4515'), /only allows visits/);
});

test('dispatch: bumping lunch or project time for a P3 costs 5', () => {
  // #4502 (P3 disk alert) arrives at 08:05. Maya has lunch at 12:00 and a project at 14:00.
  deducts(game().to(485).triageRight('4502').schedule('4502', 'maya', 720).grade('4502'), 5, /over Maya Chen's lunch/);
  deducts(game().to(485).triageRight('4502').schedule('4502', 'maya', 840).grade('4502'), 5, /Bumped project or meeting time/);
});

test('dispatch: tech time on a ticket that needed none costs 25 (5 if cancelled in time)', () => {
  // #4503 is expected noise.
  const g = game().to(490).schedule('4503', 'maya', 495).to(500);
  deducts(g.grade('4503'), 25, /spent time on a ticket that needed no work/);
  const h = game().to(490).schedule('4503', 'maya', 495);
  h.G.active = '4503';
  h.E.unschedule(h.ticket('4503'));
  deducts(h.grade('4503'), 5, /cancelled in time/);
});

test('closing: wrong reason costs 10', () => {
  deducts(game().to(490).close('4503', 'resolved').grade('4503'), 10, /should be "No action needed"/);
});

test('closing: closing as resolved before the work was done costs 25', () => {
  deducts(game().triageRight('4501').close('4501', 'resolved').grade('4501'), 25, /before the technician finished/);
});

test('closing: completed but never closed costs 10', () => {
  const g = game().triageRight('4501').send('4501', 'ack').schedule('4501', 'ana', 480).to(520);
  assert.equal(g.ticket('4501').status, 'Completed');
  deducts(g.grade('4501'), 10, /never confirmed with the client and closed it/);
});

test('closing: no resolution confirmation or a thin note costs 5 each', () => {
  const g = game().triageRight('4501').send('4501', 'ack').schedule('4501', 'ana', 480).to(520).close('4501', 'resolved', 'Done.');
  const r = g.grade('4501');
  deducts(r, 5, /without sending the client a resolution confirmation/);
  deducts(r, 5, /closing note is too thin/);
});

test('paging the Service Manager or Account Manager for nothing costs 5', () => {
  deducts(game().notify('4501', 'sm').to(482).grade('4501'), 5, /Paged the Service Manager for a routine ticket/);
  deducts(game().notify('4501', 'am').to(485).grade('4501'), 5, /covered ticket to the Account Manager/);
});

test('duplicates: unmerged copies cost 20 each; merged ones score 100', () => {
  const g = game().to(546);
  deducts(g.grade('4507'), 20, /Merge duplicates/);
  g.merge('4508', '4507').merge('4509', '4507');
  assert.equal(g.grade('4508').score, 100);
  assert.equal(g.grade('4509').score, 100);
  clean(g.grade('4507'), /Merge duplicates/);
});

test('duplicates: merging an unrelated ticket costs 40', () => {
  deducts(game().to(485).merge('4501', '4502').grade('4501'), 40, /separate problem/);
});

test('scores never go below 0', () => {
  const r = game().to(1020).G.report;
  assert.ok(r.results.every(x => x.score >= 0 && x.score <= 100));
  assert.ok(r.results.some(x => x.score === 0), 'doing nothing should floor at least one ticket at 0');
});
