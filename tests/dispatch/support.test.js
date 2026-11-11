'use strict';

// Tickets in the style of an L1 technical support test (the 'support' drill): a 403 on one site, an agent
// that can't get out, and a ticket that says nothing until you ask.

const test = require('node:test');
const assert = require('node:assert/strict');
const { game, has } = require('./harness');

const answer = g => () => { if (g.G.ring) g.answer(); };
const idOf = (g, key) => g.G.shift.find(s => s.key === key).id;

test('the drill has the three support tickets and the co-managed escalation', () => {
  const g = game('practice', 'drill-support');
  assert.deepEqual(JSON.parse(JSON.stringify(g.G.shift.map(s => s.key).sort())), ['4512', 'bl-agent', 'kfl-backup403', 'oak-vague']);
});

test('asking for details waits on the client, and the answer comes back', () => {
  const g = game('practice', 'drill-support');
  const id = idOf(g, 'oak-vague');
  g.to(480 + 60, answer(g));
  g.send(id, 'info');
  const t = g.ticket(id);
  assert.equal(t.status, 'Waiting on client');
  assert.equal(t.firstResponseAt, 540, 'the question counts as the first response');
  g.to(548, answer(g));
  assert.equal(t.status, 'New');
  assert.match(t.thread.pop().text, /Lexia reading program on the Room 7 laptops/);
});

test('ask, then triage: the vague ticket scores 100', () => {
  const g = game('practice', 'drill-support');
  const id = idOf(g, 'oak-vague');
  g.to(540, answer(g)).send(id, 'info');
  g.to(550, answer(g)).triageRight(id).schedule(id, 'sipho', 600).send(id, 'sched');
  g.to(631, answer(g)).send(id, 'resolved');
  g.to(635, answer(g)).bill(id).close(id, 'resolved', 'Allowed Lexia in the classroom web filter policy.');
  const r = g.grade(id);
  assert.equal(r.score, 100, r.ded.map(d => d[1]).join(' | '));
  assert.ok(r.good.some(x => /Asked what, where and since when/.test(x)));
});

test('triaging before asking, or never asking, costs points', () => {
  const g = game('practice', 'drill-support');
  const id = idOf(g, 'oak-vague');
  g.to(540, answer(g)).triageRight(id);
  g.to(542, answer(g)).send(id, 'info');
  assert.ok(has(g.grade(id), /Triaged before you knew what was wrong/));
  const h = game('practice', 'drill-support');
  h.to(545, answer(h)).triageRight(idOf(h, 'oak-vague'));
  assert.ok(has(h.grade(idOf(h, 'oak-vague')), /Never asked Kwame/));
});

test('asking for details the ticket already has costs 5', () => {
  const g = game('practice', 'drill-support');
  const id = idOf(g, 'bl-agent');
  g.to(570, answer(g)).send(id, 'info');
  g.to(580, answer(g));
  assert.match(g.ticket(id).thread.pop().text, /Everything I know is in my first message/);
  assert.ok(has(g.grade(id), /already given/));
});

test('the agent escalation goes to a network engineer, not Tier 1', () => {
  const g = game('practice', 'drill-support');
  const id = idOf(g, 'bl-agent');
  g.to(570, answer(g)).triageRight(id).schedule(id, 'ana', 600);
  assert.ok(has(g.grade(id), /repeats their work/));
});

test('the 403 is a permissions fix for a Backup engineer', () => {
  const g = game('practice', 'drill-support');
  const id = idOf(g, 'kfl-backup403');
  g.to(540, answer(g)).triageRight(id).schedule(id, 'maya', 600);
  g.to(631, answer(g)).bill(id).close(id, 'resolved', 'Added the backup account to the Litigation-2026 site.');
  const r = g.grade(id);
  assert.equal(r.score, 100, r.ded.map(d => d[1]).join(' | '));
});
