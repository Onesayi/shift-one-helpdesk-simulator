'use strict';

// Complaints (PB-15): the VIP complaint call on seeded day shifts and in the complaint drill, and low
// survey scores that are left unanswered until the client complains to the Service Manager.

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, game, has } = require('./harness');

const plain = x => JSON.parse(JSON.stringify(x));
const answer = g => () => { if (g.G.ring) g.answer(); };
const byKey = (g, key) => g.G.shift.find(s => s.key === key);

// The complaint drill: the call rings at 09:00. Returns the game and the complaint's ticket id.
function complaintCall() {
  const g = game('timed', 'drill-complaint');
  g.to(540, answer(g));
  return { g, id: byKey(g, 'oak-complaint').id };
}

// Handled the way PB-15 says, from the moment the call is answered.
function handled({ first = 'apology', smAt = 0, am = true, tech = 'maya' } = {}) {
  const { g, id } = complaintCall();
  g.triageRight(id);
  if (first !== 'apology') g.send(id, first);
  g.to(540 + smAt, answer(g)).notify(id, 'sm');
  if (am) g.notify(id, 'am');
  g.schedule(id, tech, 600).send(id, 'apology');
  g.to(665, answer(g)).send(id, 'resolved');
  g.to(670, answer(g)).bill(id).close(id, 'resolved', 'Root cause fixed: Teachers library split by year group.');
  return { g, id };
}

test('every seeded day shift gets one complaint call, the classic shift and the night do not', () => {
  const { buildShift, COMPLAINT, TECHS } = load();
  for (const seed of ['a1', 'b2', 'k7m2qp', 'zz9']) {
    const c = buildShift(seed).tickets.filter(t => t.key === COMPLAINT.id);
    assert.equal(c.length, 1, seed);
    assert.equal(c[0].channel, 'phone');
    assert.ok(TECHS.maya.skills.includes(c[0].truth.skill), 'a Tier 2 engineer can do it');
  }
  assert.ok(!buildShift('classic').tickets.some(t => t.complaint));
  assert.ok(!buildShift('night').tickets.some(t => t.complaint));
});

test('handled by the playbook, the complaint scores 100', () => {
  const { g, id } = handled();
  const r = g.grade(id);
  assert.equal(r.score, 100, r.ded.map(d => d[1]).join(' | '));
  assert.ok(r.good.some(x => /Apologised/.test(x)));
  assert.ok(r.good.some(x => /Service Manager in straight away/.test(x)));
});

test('the apology says sorry, gives the plan and names Dana', () => {
  const { g, id } = complaintCall();
  g.triageRight(id).schedule(id, 'maya', 600).send(id, 'apology');
  const t = g.ticket(id), msg = t.thread.filter(m => m.kind === 'me').pop().text;
  assert.match(msg, /^Hi Helen, I'm sorry about #\d+/);
  assert.match(msg, /booked with Maya Chen/);
  assert.match(msg, /Dana Whitaker/);
  assert.equal(t.firstResponseAt, 540, 'counts as the first response');
});

test('Dana and Rob answer a complaint in their own words, and Rob adds no block hours', () => {
  const { g, id } = complaintCall();
  g.notify(id, 'sm').notify(id, 'am');
  g.to(550, answer(g));
  const t = g.ticket(id), said = who => t.thread.filter(m => m.from === who).map(m => m.text).join(' ');
  assert.match(said('sm'), /call Helen myself/);
  assert.match(said('am'), /renewal is in January/);
  assert.equal(g.G.block.oak || 0, 0);
  assert.ok(!has(g.grade(id), /doesn't need me/));
});

test('a logged-your-ticket reply, no managers and a Tier 1 booking all cost points', () => {
  const { g, id } = complaintCall();
  g.triageRight(id).send(id, 'ack').schedule(id, 'ana', 600);
  g.to(700, answer(g));
  const r = g.grade(id);
  assert.ok(has(r, /never got an apology/));
  assert.ok(has(r, /Service Manager never heard/));
  assert.ok(has(r, /Account Manager never heard/));
  assert.ok(has(r, /repeat fault to Tier 1/));
});

test('apologising second, or paging Dana late, costs a little', () => {
  const late = handled({ first: 'ack', smAt: 45 });
  const r = late.g.grade(late.id);
  assert.ok(has(r, /Opened with a "logged your ticket" message/));
  assert.ok(has(r, /Took 45 min to tell the Service Manager/));
  assert.ok(!has(r, /never got an apology/));
});

test('the complaint drill has the call and two ordinary tickets', () => {
  const { DRILLS } = load();
  const d = DRILLS.find(x => x.id === 'complaint');
  assert.deepEqual(plain(d.keys), ['oak-complaint', '4504', '4510']);
});

// #4501 (Harbor Dental) handled slowly in the classic shift, so Lena's survey comes back 3/5.
function lowScore() {
  const g = game();
  g.to(575).triageRight('4501').send('4501', 'ack').schedule('4501', 'ana', 585);
  g.to(630).send('4501', 'resolved').bill('4501').close('4501', 'resolved');
  g.to(g.now() + 5);
  assert.equal(g.ticket('4501').csat.rating, 3);
  return g;
}

test('a low score left for an hour turns into a complaint to the Service Manager', () => {
  const g = lowScore(), t = g.ticket('4501'), at = t.csat.at;
  g.to(at + g.E.CSAT_ESCALATE - 1);
  assert.equal(t.csat.escalated, undefined);
  g.to(at + g.E.CSAT_ESCALATE + 2);
  assert.equal(t.csat.escalated, at + g.E.CSAT_ESCALATE);
  assert.equal(g.E.logged('complaint').length, 1);
  assert.ok(t.thread.some(m => /written to your Service Manager/.test(m.text)));
  assert.ok(t.thread.some(m => m.from === 'sm' && /within the hour/.test(m.text)));
  const r = g.grade('4501');
  assert.ok(has(r, /then complained to the Service Manager/));
  assert.ok(has(r, /nobody replied/));
  g.to(g.now() + 120);
  assert.equal(g.E.logged('complaint').length, 1, 'only once');
});

test('replying inside the hour stops the complaint', () => {
  const g = lowScore(), t = g.ticket('4501');
  g.to(t.csat.at + 20);
  g.E.followUpCsat(t);
  g.to(t.csat.at + 120);
  assert.equal(t.csat.escalated, undefined);
  assert.ok(!has(g.grade('4501'), /complained/));
});
