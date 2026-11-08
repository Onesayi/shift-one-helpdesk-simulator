'use strict';

// The after-hours on-call shift (shift code 'night', js/dispatch/night.js and PB-13).

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, game, has } = require('./harness');

const plain = x => JSON.parse(JSON.stringify(x));
const DAY = 1440, NIGHT_START = 1020, NIGHT_END = DAY + 480;

// Ticket numbers on the night shift, in arrival order.
const N = { dc01: '4601', printer: '4602', keller: '4603', mac: '4604', warehouse: '4605', lab: '4606', maint: '4607', monitor: '4608', phish: '4609' };

// Plays the night the way PB-13 says. Returns the game before it ends.
function cleanNight(mode = 'timed') {
  const g = game(mode, 'night');
  const answer = () => { if (g.G.ring) g.answer(); };
  g.to(NIGHT_START + 45, answer).triageRight(N.dc01).schedule(N.dc01, 'jordan', 1080);
  g.to(1090, answer).triageRight(N.printer).send(N.printer, 'ack').schedule(N.printer, 'luis', DAY + 510, { onsite: true });
  g.to(1125, answer).bill(N.dc01).close(N.dc01, 'resolved');
  g.to(1171, answer).triageRight(N.keller).schedule(N.keller, 'jordan', 1185).send(N.keller, 'sched');
  g.to(1216, answer).send(N.keller, 'resolved');
  g.to(1220, answer).bill(N.keller).close(N.keller, 'resolved');
  g.to(1245, answer).triageRight(N.mac).send(N.mac, 'ack').notify(N.mac, 'am');
  g.to(1250, answer).schedule(N.mac, 'ana', DAY + 480).send(N.mac, 'sched');
  g.to(1351, answer).triageRight(N.warehouse).notify(N.warehouse, 'sm').schedule(N.warehouse, 'jordan', 1365);
  g.to(1380, answer).send(N.warehouse, 'update');
  g.to(1411, answer).send(N.warehouse, 'resolved');
  g.to(1415, answer).bill(N.warehouse).close(N.warehouse, 'resolved');
  g.to(1420, answer).close(N.lab, 'noise', 'Lab VMs shut down every night, per Oakridge notes.');
  g.to(DAY + 60, answer).send(N.maint, 'update').close(N.maint, 'noise', 'Passed the Comcast maintenance notice on to Lena.');
  g.to(DAY + 180, answer).triageRight(N.monitor).send(N.monitor, 'ack').schedule(N.monitor, 'luis', DAY + 720, { onsite: true, dur: 30 });
  g.to(DAY + 330, answer).triageRight(N.phish).send(N.phish, 'ack').notify(N.phish, 'sm').schedule(N.phish, 'jordan', DAY + 345);
  g.to(DAY + 360, answer).send(N.phish, 'update');
  g.to(DAY + 376, answer).send(N.phish, 'resolved');
  g.to(DAY + 380, answer).bill(N.phish).close(N.phish, 'resolved');
  g.to(NIGHT_END, answer);
  g.handover({ [N.mac]: 'Jess\'s Mac login loop: Ana at 08:00, top-up approved. She presents at 10:00.' },
    'Busy night: warehouse P1 fixed by Jordan, Maria\'s phish locked down, two jobs for Luis on Friday.');
  return g;
}

test('the night shift is its own fixed set of tickets, numbered in arrival order', () => {
  const { buildShift, NIGHT_SCENARIOS, CLIENTS, TECHS, SKILLS, BOARDS, PRIORITIES, REASONS, PLAYBOOK } = load();
  const sh = buildShift('night'), again = buildShift('NIGHT');
  assert.equal(sh.night, true);
  assert.equal(sh.events.length, 0);
  assert.deepEqual(plain(sh.tickets.map(t => [t.id, t.key, t.at])), plain(again.tickets.map(t => [t.id, t.key, t.at])), 'same every time');
  assert.deepEqual(plain(sh.tickets.map(t => t.id)), plain(sh.tickets.map((_, i) => String(4601 + i))));
  assert.deepEqual(Object.fromEntries(sh.tickets.map(t => [t.key.replace(/^n-[a-z0-9]+-/, ''), t.id])), {
    backup: N.dc01, printer: N.printer, phone: N.keller, mac: N.mac, warehouse: N.warehouse, lab: N.lab, maint: N.maint, monitor: N.monitor, phish: N.phish,
  });
  for (const s of NIGHT_SCENARIOS) {
    const T = s.truth, c = CLIENTS[s.client], at = s.id;
    assert.ok(c, `${at}: client`);
    assert.ok(s.contact == null || c.contacts[s.contact], `${at}: contact`);
    assert.ok(PLAYBOOK.some(k => k.id === s.kb), `${at}: playbook article`);
    assert.ok(s.at >= 0 && NIGHT_START + s.at < NIGHT_END, `${at}: arrives during the night`);
    assert.ok(T.closeAs === null || REASONS[T.closeAs], `${at}: closeAs`);
    if (!T.dispatch) continue;
    assert.ok(PRIORITIES.includes(T.priority) && BOARDS.includes(T.board) && SKILLS.includes(T.skill), `${at}: triage truth`);
    assert.equal(typeof T.tonight, 'boolean', `${at}: says whether it needs Jordan tonight`);
    const able = Object.entries(TECHS).filter(([, x]) => x.skills.includes(T.skill) && (!T.onsite || x.onsite) && !!x.night === T.tonight);
    assert.ok(able.length, `${at}: someone ${T.tonight ? 'on call' : 'on the day team'} can do it`);
    if (T.tonight) assert.ok(T.startBy < NIGHT_END, `${at}: has to start before 08:00`);
    else assert.ok(T.startBy >= NIGHT_END, `${at}: can wait for the morning`);
    // PB-13: tonight is for P1s, and P2s on premium agreements.
    assert.equal(T.tonight, T.priority === 'P1' || (T.priority === 'P2' && c.sla === 'premium'), `${at}: follows PB-13`);
  }
});

test('the night runs 17:00 to 08:00, with Jordan on call and Ben still off sick', () => {
  const g = game('timed', 'night');
  assert.equal(g.now(), NIGHT_START);
  assert.equal(g.G.night, true);
  assert.deepEqual(plain(g.E.crew()), ['sipho', 'maya', 'ana', 'ben', 'luis', 'jordan']);
  assert.equal(g.G.techs.ben.sickAt, NIGHT_START);
  assert.equal(g.G.news.length, 1, 'the day coordinator left a note');
  g.to(NIGHT_START + 44);
  assert.equal(g.G.tickets.length, 0);
  g.to(NIGHT_START + 45);
  assert.equal(g.ticket(N.dc01).title, 'HDG-DC01: backup failed, 2nd in a row');
  g.to(NIGHT_END - 1, () => { if (g.G.ring) g.answer(); });
  assert.equal(g.G.phase, 'play');
  g.to(NIGHT_END);
  assert.equal(g.G.phase, 'handover', 'hands over to the day coordinator at 08:00');
});

test('the day shift never shows Jordan', () => {
  const g = game();
  assert.equal(g.G.night, false);
  assert.ok(!g.E.crew().includes('jordan'));
  assert.equal(g.G.end, g.E.SHIFT_END);
});

test('booking rules: Jordan works through midnight, the day team only from Friday 08:00, Ben not at all', () => {
  const g = game('timed', 'night').to(NIGHT_START + 70);
  g.triageRight(N.printer);
  const slot = (tech, start, onsite = false) => g.E.checkSlot(g.ticket(N.printer), tech, start, 45, onsite);
  assert.deepEqual(plain(slot('jordan', DAY + 60).errors), [], 'Jordan at 01:00');
  assert.ok(slot('jordan', DAY + 60).warns.some(w => /wakes Jordan/.test(w)), 'warns that it wakes Jordan up');
  assert.ok(slot('jordan', DAY + 480).errors.length, 'Jordan is off at 08:00');
  assert.ok(slot('luis', 1200, true).errors.length, 'Luis is off tonight');
  assert.deepEqual(plain(slot('luis', DAY + 510, true).errors), [], 'Luis on Friday morning');
  assert.ok(slot('ben', DAY + 540).errors.some(e => /sick/.test(e)), 'Ben is off until Monday');
});

test('a clean night scores 100 on every ticket and the handover', () => {
  const g = cleanNight();
  const r = g.end();
  r.results.forEach((x, i) => assert.equal(x.score, 100, `#${g.G.shift[i].id}: ${x.ded.map(d => d[1]).join(' | ')}`));
  assert.equal(r.handover.score, 100, r.handover.ded.map(d => d[1]).join(' | '));
  assert.equal(r.final, 100);
  assert.equal(r.suggest, null);
});

test('waking Jordan for work that could wait costs points', () => {
  const g = game('timed', 'night').to(NIGHT_START + 70);
  g.triageRight(N.printer).schedule(N.printer, 'jordan', 1110, { onsite: true });
  assert.ok(has(g.grade(N.printer), /Woke Jordan Blake at 18:10 for a P3 that could wait/));
  g.to(DAY + 180, () => { if (g.G.ring) g.answer(); });
  g.triageRight(N.monitor).schedule(N.monitor, 'luis', DAY + 720, { onsite: true, dur: 30 });
  const r = g.grade(N.monitor);
  assert.ok(!has(r, /Woke/));
  assert.ok(r.good.some(x => /day team/.test(x)), 'praised for leaving it to the day team');
});

test('leaving urgent work for the morning costs more than booking it late', () => {
  const g = game('timed', 'night').to(NIGHT_START + 45);
  g.triageRight(N.dc01).schedule(N.dc01, 'maya', DAY + 480);
  assert.ok(has(g.grade(N.dc01), /Left for the day team at Fri 08:00\. This couldn't wait/));
});

test('PB-13 billing: standard after-hours work is billable, premium is covered', () => {
  const g = cleanNight();
  const entry = id => g.G.time.find(e => e.ticket === id);
  assert.equal(entry(N.warehouse).after, true);
  assert.equal(entry(N.warehouse).code, 'billable');
  assert.match(g.E.billingFor(g.ticket(N.warehouse), entry(N.warehouse)).why, /after-hours rate/);
  assert.equal(entry(N.keller).code, 'covered');
  assert.equal(g.E.isAfterHours(1020), true);
  assert.equal(g.E.isAfterHours(DAY + 479), true);
  assert.equal(g.E.isAfterHours(DAY + 480), false);
  assert.equal(g.E.isAfterHours(1019), false);
});

test('the morning handover wants the open P2, not the work already booked for the day team', () => {
  const g = cleanNight();
  g.handover({}, 'Busy night: warehouse P1 fixed by Jordan, Maria locked down.');
  g.G.drafts['ho-flag-' + N.mac] = false;
  const h = g.E.gradeHandover();
  assert.ok(h.ded.some(d => d[1].startsWith(`#${N.mac} is a P2`) && /day coordinator/.test(d[1])));
  assert.equal(h.ded.length, 1, 'the printer and monitor jobs are booked with Luis, so they need no flag');
});

test('the night is saved to progress like any timed shift', () => {
  const saved = {};
  const E = load({ getItem: k => saved[k] ?? null, setItem: (k, v) => { saved[k] = v; } });
  E.newGame('timed', 'night');
  E.startHandover(); E.endShift();
  const h = JSON.parse(saved['shiftone-dispatch-history']);
  assert.equal(h.length, 1);
  assert.equal(h[0].seed, 'night');
});
