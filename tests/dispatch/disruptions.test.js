'use strict';

// Mid-shift disruptions on top of Ben's sick call (DISRUPTIONS in js/dispatch/data.js). Seeded shifts
// draw one or two; classic has none. Each knocks on bookings that have to move, and the client has to hear.

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, game, has } = require('./harness');

function deducts(r, pts, re) {
  const d = has(r, re);
  assert.ok(d, `expected a deduction matching ${re}; got: ${r.ded.map(x => `-${x[0]} ${x[1]}`).join(' | ') || 'none'}`);
  assert.equal(d[0], pts, `"${d[1]}"`);
}
const clean = (r, re) => assert.ok(!has(r, re), `unexpected deduction matching ${re}`);
const praises = (r, re) => assert.ok(r.good.some(x => re.test(x)), `expected praise matching ${re}; got: ${r.good.join(' | ')}`);
const plain = x => JSON.parse(JSON.stringify(x));

// Make a disruption happen now, the way onMinute does.
const fire = (g, id) => {
  const ev = Object.assign({}, g.E.DISRUPTIONS.find(d => d.id === id), { at: g.now() });
  return g.E.teamEvent(ev, g.now());
};

test('classic has only Ben; seeded shifts add one or two disruptions inside their windows', () => {
  const { buildShift, DISRUPTIONS } = load();
  assert.deepEqual(plain(buildShift('classic').events.map(e => e.tech)), ['ben']);
  const counts = new Set();
  for (let i = 0; i < 200; i++) {
    const ev = buildShift('s' + i).events, extra = ev.slice(1), at = `seed s${i}`;
    assert.equal(ev[0].tech, 'ben', `${at}: Ben's sick call comes first`);
    assert.ok(extra.length === 1 || extra.length === 2, `${at}: ${extra.length} extra disruptions`);
    assert.equal(new Set(extra.map(e => e.id)).size, extra.length, `${at}: no repeats`);
    for (const e of extra) {
      const d = DISRUPTIONS.find(x => x.id === e.id);
      assert.ok(e.at >= d.window[0] && e.at <= d.window[1], `${at}: ${e.id} at ${e.at}`);
    }
    counts.add(extra.length);
  }
  assert.deepEqual([...counts].sort(), [1, 2], 'some shifts get one, some get two');
});

test('a tech off the board: the booking in that time is missed, costs 30, and the client chases', () => {
  const g = game().to(600).triageRight('4501').send('4501', 'ack').schedule('4501', 'luis', 660);
  g.to(630);
  fire(g, 'van'); // Luis is out 10:30–12:00
  assert.ok(g.G.blocks.some(b => b.tech === 'luis' && b.kind === 'out' && b.start === 630 && b.dur === 90));
  g.to(661);
  assert.equal(g.ticket('4501').status, 'Needs reassign');
  assert.ok(g.ticket('4501').chasers >= 1, 'Lena chases when nobody connects');
  const r = g.grade('4501');
  deducts(r, 30, /while they were off the board/);
  deducts(r, 10, /never heard the appointment had moved/);
});

test('a tech off the board: rebook with someone else and tell the client, and nothing is lost', () => {
  const g = game().to(600).triageRight('4501').send('4501', 'ack').schedule('4501', 'luis', 660);
  g.to(630);
  fire(g, 'van');
  g.schedule('4501', 'ana', 660).send('4501', 'sched');
  const r = g.grade('4501');
  clean(r, /off the board|moved/);
  praises(r, /Told Lena about the new appointment/);
});

test('nothing can be booked with a tech while they are off the board', () => {
  const g = game().to(600).triageRight('4501');
  g.to(630);
  fire(g, 'vpn'); // Maya is out 10:30–11:30
  assert.throws(() => g.schedule('4501', 'maya', 660), /Clashes with "Internal outage"/);
  assert.doesNotThrow(() => g.schedule('4501', 'maya', 690));
});

test('a client moves an appointment: still booked for today costs 15, no confirmation costs 10', () => {
  const g = game().to(586).schedule('4476', 'ana', 780).send('4476', 'sched'); // Ben's job re-homed at 13:00
  g.to(660);
  assert.equal(fire(g, 'move'), true);
  assert.match(g.ticket('4476').thread.at(-1).text, /move the scan-to-email setup to tomorrow/);
  const r = g.grade('4476');
  deducts(r, 15, /asked to move this to tomorrow/);
  deducts(r, 10, /Never confirmed the new time with Lena/);
});

test('a client moves an appointment: booking it for Friday and confirming is praised', () => {
  const g = game().to(586).schedule('4476', 'ana', 780).send('4476', 'sched');
  g.to(660);
  fire(g, 'move');
  g.schedule('4476', 'ana', g.E.DAY + 600).send('4476', 'sched');
  const r = g.grade('4476');
  clean(r, /tomorrow|confirmed/);
  praises(r, /Moved the appointment to tomorrow/);
});

test('a move request never arrives once the work has started', () => {
  const g = game().to(586).schedule('4476', 'ana', 600);
  g.to(620);
  assert.equal(fire(g, 'move'), false);
  assert.equal(g.G.disrupted['4476'], undefined);
});

test('in a seeded shift, disruptions happen on the clock', () => {
  const { buildShift } = load();
  const seed = Array.from({ length: 200 }, (_, i) => 's' + i).find(s => buildShift(s).events.some(e => e.id === 'van'));
  const g = game('timed', seed), at = g.G.events.find(e => e.id === 'van').at;
  g.to(at - 1, () => { if (g.G.ring) g.answer(); });
  assert.ok(!g.G.blocks.some(b => b.kind === 'out'));
  g.to(at, () => { if (g.G.ring) g.answer(); });
  assert.ok(g.G.blocks.some(b => b.kind === 'out' && b.tech === 'luis' && b.start === at));
  assert.match(g.G.news.at(-1).text, /until \d\d:\d\d/);
});
