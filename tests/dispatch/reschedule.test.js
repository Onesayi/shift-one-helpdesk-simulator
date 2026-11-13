'use strict';

// Dragging a booked appointment on the dispatch board: where it lands, and that the move goes
// through the same booking dialog and checks as clicking a free slot.

const test = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./harness');

// Book #4501 later in the morning so it hasn't started when we move it.
const booked = () => game().triageRight('4501').schedule('4501', 'ana', 600, { dur: 90 });
const live = (g, id) => g.G.appts.filter(a => String(a.ticket) === String(id) && a.state !== 'cancelled');

test('the drop slot follows the appointment\'s left edge and snaps to 15 minutes', () => {
  const { dropSlot } = game().E;
  // A 600px track for 08:00–17:00 (540 min): 1 px = 0.9 min.
  assert.equal(dropSlot(0, 0, 600, 480, 540), 480);
  assert.equal(dropSlot(200, 0, 600, 480, 540), 660);         // 480 + 180
  assert.equal(dropSlot(205, 0, 600, 480, 540), 660);         // 664.5 snaps back to 660
  assert.equal(dropSlot(210, 0, 600, 480, 540), 675);         // 669 snaps on to 675
  assert.equal(dropSlot(250, 50, 600, 480, 540, 30), 630);    // grabbed 30 min into the block
  assert.equal(dropSlot(-80, 0, 600, 480, 540), 480);         // never before the board starts
  assert.equal(dropSlot(900, 0, 600, 480, 540), 1005);        // or after its last slot
});

test('dropping a booking on another tech and time opens the dialog with its length and work type kept', () => {
  const g = booked();
  const a = live(g, '4501')[0];
  assert.equal(g.E.rescheduleTo(a.id, 'maya', 660), true);
  assert.equal(String(g.G.pick), '4501');
  assert.equal(g.G.drafts['sc-tech'], 'maya');
  assert.equal(g.G.drafts['sc-start'], '660');
  assert.equal(g.G.drafts['sc-dur'], '90');
  assert.equal(g.G.drafts['sc-where'], a.onsite ? 'onsite' : 'remote');
  assert.notEqual(g.G.modal.onOk(), false);
  const now = live(g, '4501');
  assert.equal(now.length, 1);
  assert.equal([now[0].tech, now[0].start, now[0].dur].join(), 'maya,660,90');
  assert.equal(a.state, 'cancelled');
  assert.equal(g.G.pick, null);
});

test('a drop that the booking checks refuse leaves the original booking alone', () => {
  const g = booked().to(580);
  const a = live(g, '4501')[0];
  // 08:30 has already passed by 09:40.
  assert.equal(g.E.rescheduleTo(a.id, 'ana', 510), true);
  assert.equal(g.G.modal.onOk(), false);
  assert.equal(live(g, '4501').map(x => x.tech + '@' + x.start).join(), 'ana@600');
});

test('only booked appointments move, and dropping one back where it was does nothing', () => {
  const g = booked();
  const a = live(g, '4501')[0];
  assert.equal(g.E.rescheduleTo(a.id, 'ana', 600), false);
  assert.equal(g.G.modal, null);
  g.to(605);
  assert.equal(a.state, 'working');
  assert.equal(g.E.rescheduleTo(a.id, 'maya', 660), false);
});
