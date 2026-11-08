'use strict';

// The campaign (shift code 'campaign-<seed>'): Thursday day, Thursday night, Friday day on one clock.

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, game, has } = require('./harness');

const plain = x => JSON.parse(JSON.stringify(x));
const DAY = 1440;
const answer = g => () => { if (g.G.ring) g.answer(); };

// Ends the current leg at its natural end with a summary, and returns its report.
function finishLeg(g, flags = {}, pickUp = true) {
  g.to(g.G.end, pickUp ? answer(g) : undefined);
  g.handover(flags, 'Summary of the shift for whoever is next.');
  g.E.endShift();
  return g.G.report;
}

test('shift codes: campaign, campaign-<seed>, and nothing else', () => {
  const { campaignOf } = load();
  assert.equal(campaignOf('campaign'), null);
  assert.equal(campaignOf('campaign-abc123'), 'abc123');
  assert.equal(campaignOf('classic'), undefined);
  assert.equal(campaignOf('campaigner'), undefined);
  const g = game('timed', 'campaign');
  assert.match(g.G.seed, /^campaign-[a-z0-9]{6}$/);
  assert.equal(g.G.campaign.leg, 0);
  assert.equal(game('timed', 'campaign-abc123').G.shift.map(t => t.key).join(), load().buildShift('abc123').tickets.map(t => t.key).join(), 'Thursday is the seeded day shift');
});

test('Friday draws only scenarios Thursday did not use, moved a day on', () => {
  const { buildShift, buildFriday, SCENARIOS } = load();
  for (const seed of ['abc123', 'classic', 'zz9', 'q']) {
    const thu = buildShift(seed), used = new Set(thu.tickets.map(t => t.key));
    const fri = buildFriday(seed, used), again = buildFriday(seed, used);
    assert.ok(fri.tickets.length >= 4, `${seed}: ${fri.tickets.length} Friday tickets`);
    assert.deepEqual(plain(fri.tickets.map(t => [t.id, t.key, t.at])), plain(again.tickets.map(t => [t.id, t.key, t.at])), 'same seed, same Friday');
    fri.tickets.forEach((t, i) => {
      assert.equal(t.id, String(4701 + i));
      assert.ok(!used.has(t.key), `${seed}: ${t.key} was already used on Thursday`);
      const s = SCENARIOS.find(x => x.id === t.key);
      if (s.truth.startBy != null) {
        assert.ok(s.truth.startBy < DAY, `${t.key}: Friday has no tomorrow`);
        assert.ok(t.truth.startBy >= DAY + 480 && t.truth.startBy < 2 * DAY, `${t.key}: due on Friday`);
      }
    });
    assert.equal(fri.events.length, 1);
    assert.ok(fri.events[0].at > DAY + 480 && fri.events[0].at < DAY + 1020, 'one disruption on Friday');
  }
});

test('three legs on one clock, each ticket graded exactly once', () => {
  const g = game('timed', 'campaign-abc123');
  const r1 = finishLeg(g);
  assert.equal(g.G.phase, 'report');
  assert.equal(r1.campaign.leg, 0);
  assert.equal(r1.campaign.last, false);
  assert.ok(r1.campaign.open > 0, 'untouched work carries over');

  g.E.nextLeg();
  assert.equal(g.G.phase, 'play');
  assert.equal(g.now(), 1020);
  assert.equal(g.G.night, true);
  assert.ok(g.E.crew().includes('jordan'));
  const r2 = finishLeg(g);
  assert.equal(r2.campaign.leg, 1);

  g.E.nextLeg();
  assert.equal(g.now(), DAY + 480);
  assert.equal(g.G.night, false);
  assert.ok(!g.E.crew().includes('jordan'));
  const r3 = finishLeg(g);
  assert.equal(r3.campaign.last, true);
  assert.equal(r3.campaign.open, 0, 'everything is graded by the end of Friday');

  const graded = r1.items.concat(r2.items, r3.items).map(x => x.s.id);
  assert.equal(new Set(graded).size, graded.length, 'nobody graded twice');
  assert.deepEqual(plain(graded.slice().sort()), plain(g.G.tickets.map(t => t.id).sort()), 'and nobody missed');
  const legs = r3.campaign.legs;
  assert.equal(legs.length, 3);
  const all = legs.flatMap(l => l.scores.concat(l.handover));
  assert.equal(r3.campaign.overall, Math.round(all.reduce((a, b) => a + b, 0) / all.length));
});

test('a job booked on Thursday for Friday happens on Friday and is graded when it is closed', () => {
  const g = game('timed', 'campaign-classic');
  g.to(495, answer(g)).triageRight('4504').schedule('4504', 'ana', DAY + 480);
  const r1 = finishLeg(g);
  assert.ok(!r1.items.some(x => x.s.id === '4504'), 'still open at 17:00, so not graded yet');
  g.E.nextLeg(); finishLeg(g);
  g.E.nextLeg();
  g.to(DAY + 480 + 121, answer(g));
  assert.equal(g.ticket('4504').status, 'Completed', 'Ana did it on Friday morning');
  g.send('4504', 'resolved').bill('4504').close('4504', 'resolved');
  g.to(DAY + 480 + 130, answer(g));
  assert.equal(g.ticket('4504').csat.rating, 5);
  const r3 = finishLeg(g);
  const x = r3.items.find(i => i.s.id === '4504');
  assert.ok(x, 'graded on Friday');
  assert.ok(x.r.good.some(s => /Booked the setup for Friday/.test(s)));
});

test('the handover notes you write appear on the next leg\'s tickets', () => {
  const g = game('timed', 'campaign-classic');
  g.to(1020, answer(g));
  finishLeg(g, { 4504: 'New starter for Monday: needs booking with Ana on Friday.' });
  g.E.nextLeg();
  const t = g.ticket('4504');
  assert.match(t.thread[t.thread.length - 1].text, /^Your handover note \(17:00\): New starter for Monday/);
  assert.match(g.G.news[g.G.news.length - 1].text, /Your handover at 17:00: "Summary of the shift/);
  assert.equal(Object.keys(g.G.drafts).filter(k => k.startsWith('ho-')).length, 0, 'a fresh handover form');
});

test('ending a leg early still plays out the rest of it before the next leg', () => {
  const g = game('timed', 'campaign-classic');
  g.to(600, answer(g));
  g.E.startHandover(); g.E.endShift();
  g.E.nextLeg();
  assert.equal(g.G.start, 1020);
  assert.ok(g.G.tickets.some(t => t.id === '4516'), 'the 13:00 ticket still arrived');
});

test('night tickets keep their on-call rules when graded on Friday', () => {
  const g = game('timed', 'campaign-classic');
  finishLeg(g);
  g.E.nextLeg();
  g.to(1090, answer(g)).triageRight('4602').schedule('4602', 'jordan', 1110, { onsite: true });
  finishLeg(g); g.E.nextLeg();
  const r3 = finishLeg(g);
  assert.ok(has(r3.items.find(x => x.s.id === '4602').r, /Woke Jordan Blake/));
});

test('a leg\'s KPIs cover only the tickets that arrived in it', () => {
  const g = game('timed', 'campaign-classic');
  const r1 = finishLeg(g, {}, false);
  g.E.nextLeg();
  const r2 = finishLeg(g, {}, false);
  assert.equal(r1.kpi.missed, 5, 'Thursday\'s five calls went to voicemail');
  assert.equal(r2.kpi.missed, 2, 'the night has its own two calls');
});
