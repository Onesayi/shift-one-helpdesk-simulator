'use strict';

// Shift history in localStorage: every finished shift is saved and feeds the report's progress card.

const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');

function memory(init = {}) {
  const m = { ...init };
  return { data: m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
}

function play(E, mode = 'timed', seed = 'classic') {
  E.newGame(mode, seed);
  E.endShift();
  return E.G.report;
}

test('each finished shift is saved with its score, mode, seed and KPIs', () => {
  const s = memory(), E = load(s);
  const r1 = play(E), r2 = play(E, 'practice', 'abc');
  const h = JSON.parse(s.data['shiftone-dispatch-history']);
  assert.equal(h.length, 2);
  assert.deepEqual(h.map(e => [e.mode, e.seed, e.final]), [['timed', 'classic', r1.final], ['practice', 'abc', r2.final]]);
  for (const k of ['triage', 'resp', 'missed', 'chasers', 'bounces', 'closed']) assert.ok(k in h[1].kpi, `kpi.${k} saved`);
  assert.equal(r2.history.length, 2, 'the report sees the whole history');
});

test('history keeps the last 50 shifts', () => {
  const old = Array.from({ length: 50 }, (_, i) => ({ at: i, final: i, kpi: {} }));
  const s = memory({ 'shiftone-dispatch-history': JSON.stringify(old) }), E = load(s);
  play(E);
  const h = JSON.parse(s.data['shiftone-dispatch-history']);
  assert.equal(h.length, 50);
  assert.equal(h[0].at, 1, 'the oldest shift is dropped');
});

test('best score counts history and the old best-only save', () => {
  assert.equal(load(memory()).bestScore(), null);
  assert.equal(load(memory({ 'shiftone-dispatch-best': '73' })).bestScore(), 73);
  const h = JSON.stringify([{ final: 40, kpi: {} }, { final: 81, kpi: {} }]);
  assert.equal(load(memory({ 'shiftone-dispatch-best': '73', 'shiftone-dispatch-history': h })).bestScore(), 81);
});

test('corrupt or missing history is ignored, not fatal', () => {
  assert.deepEqual([...load(memory({ 'shiftone-dispatch-history': '{nope' })).loadHistory()], []);
  assert.deepEqual([...load(memory({ 'shiftone-dispatch-history': '{"a":1}' })).loadHistory()], []);
  const s = memory({ 'shiftone-dispatch-history': '{nope' });
  play(load(s));
  assert.equal(JSON.parse(s.data['shiftone-dispatch-history']).length, 1);
});
