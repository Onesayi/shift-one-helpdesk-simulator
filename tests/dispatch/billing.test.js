'use strict';

// Time entries and billing codes (PB-12, "Time entries and billing" in docs/COORDINATOR.md).

const test = require('node:test');
const assert = require('node:assert/strict');
const { game, has } = require('./harness');

function deducts(r, pts, re) {
  const d = has(r, re);
  assert.ok(d, `expected a deduction matching ${re}; got: ${r.ded.map(x => `-${x[0]} ${x[1]}`).join(' | ') || 'none'}`);
  assert.equal(d[0], pts, `"${d[1]}"`);
}
const clean = (r, re) => assert.ok(!has(r, re), `unexpected deduction matching ${re}`);
const answering = g => () => { if (g.G.ring) g.answer(); };

// #4501: Harbor Dental (premium), remote printer fix, 30 min with Ana from 08:00.
const fixed4501 = () => game().triageRight('4501').schedule('4501', 'ana', 480).to(515);

test('finished work leaves one time entry with the booked time', () => {
  const g = fixed4501();
  const e = g.G.time.filter(x => x.ticket === '4501');
  assert.equal(e.length, 1);
  assert.equal(e[0].tech, 'ana');
  assert.equal(e[0].mins, 30);
  assert.equal(e[0].onsite, false);
  assert.equal(e[0].code, null);
});

test('PB-12: block hours, then projects, then standard onsite are billed; the rest is covered', () => {
  const g = game();
  g.to(1020, answering(g));
  const { billingFor } = g.E, tk = id => g.ticket(id);
  assert.equal(billingFor(tk('4501'), { onsite: false }).code, 'covered', 'premium, remote');
  assert.equal(billingFor(tk('4515'), { onsite: true }).code, 'covered', 'premium covers onsite too');
  assert.equal(billingFor(tk('4514'), { onsite: true }).code, 'billable', 'standard agreement, onsite visit');
  assert.equal(billingFor(tk('4512'), { onsite: false }).code, 'covered', 'standard agreement, remote');
  assert.equal(billingFor(tk('4504'), { onsite: false }).code, 'billable', 'onboarding is project work');
  assert.equal(billingFor(tk('4510'), { onsite: false }).code, 'block', 'block-hours client');
});

test('an uncoded entry costs 5, a wrong code 10, the right code is praised', () => {
  deducts(fixed4501().grade('4501'), 5, /never coded/);
  deducts(fixed4501().bill('4501', 'billable').grade('4501'), 10, /coded "Billable"; it should be "Covered by agreement"/);
  const r = fixed4501().bill('4501').grade('4501');
  clean(r, /coded/);
  assert.ok(r.good.includes('Time coded as Covered by agreement.'));
});

test('a posted code is final, and the ticket records it', () => {
  const g = fixed4501().bill('4501');
  assert.equal(g.G.time[0].code, 'covered');
  assert.match(g.ticket('4501').thread.at(-1).text, /Time entry posted: Ana Ribeiro, 30 min, Covered by agreement/);
});

test('block hours come off the client\'s balance', () => {
  const g = game();
  g.to(1020, m => {
    if (g.G.ring) g.answer();
    if (m === 566) g.triageRight('4510').notify('4510', 'am');
    if (m === 570) g.schedule('4510', 'ana', 600);
  });
  // 0.5 h left + a 10 h top-up − 90 min of work
  g.bill('4510');
  assert.equal(g.G.block.pp, 9);
});

test('the report counts how many entries were coded right', () => {
  const g = fixed4501();
  g.triageRight('4502').schedule('4502', 'maya', 525).to(560).bill('4501').bill('4502', 'billable');
  assert.equal(g.end().kpi.billing, 50);
});
