'use strict';

// Support assessment practice (ASSESS in js/dispatch/interview.js): a quiz and written tasks in the
// style of an L1 technical support skills test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');

test('every quiz question has one right option and explains every option', () => {
  const { ASSESS } = load();
  assert.equal(new Set(ASSESS.map(x => x.id)).size, ASSESS.length, 'unique ids');
  const mcq = ASSESS.filter(x => x.kind === 'mcq');
  assert.ok(mcq.length >= 4);
  for (const x of mcq) {
    assert.ok(x.opts[x.a], `${x.id}: the answer is one of the options`);
    assert.deepEqual(Object.keys(x.why).sort(), Object.keys(x.opts).sort(), `${x.id}: every option is explained`);
  }
});

test('every written task\'s model answer covers its points, fits its shape and falls into no trap', () => {
  const { ASSESS, prepCovered, assessShape, assessTraps } = load();
  for (const x of ASSESS.filter(q => q.kind === 'write')) {
    const c = prepCovered(x, x.model);
    x.points.forEach((p, i) => assert.ok(c[i], `${x.id}: model misses "${p.label}"`));
    for (const s of assessShape(x, x.model)) assert.ok(s.ok, `${x.id}: ${s.label}`);
    assert.deepEqual(Array.from(assessTraps(x, x.model), t => t.label), [], `${x.id}: model falls into a trap`);
    assert.ok(prepCovered(x, '').every(v => !v), `${x.id}: an empty answer covers nothing`);
  }
});

test('the traps catch the classic mistakes', () => {
  const { ASSESS, assessTraps, assessShape } = load();
  const item = id => ASSESS.find(x => x.id === id);
  assert.ok(assessTraps(item('locked'), 'Hi Dana, please send me your password so I can check.').length);
  assert.ok(assessTraps(item('chat'), 'Just log in as your admin and approve it yourself.').length);
  assert.ok(assessTraps(item('docs'), 'You should have enabled Full Content Scan.').length);
  const tooMany = assessShape(item('chat'), 'Hi?\n\nIs it urgent?\n\nWho is your admin?');
  assert.ok(tooMany.some(s => !s.ok && /3 questions/.test(s.label)));
});

test('quiz answers and written work count towards the assessment summary', () => {
  const saved = {};
  const E = load({ getItem: k => saved[k] ?? null, setItem: (k, v) => { saved[k] = v; } });
  E.savePrepAnswer('as-pending', 'B');
  E.savePrepAnswer('as-automation', 'A');
  E.savePrepAnswer('as-chat', E.ASSESS.find(x => x.id === 'chat').model);
  const st = E.assessStats();
  assert.equal(st.tried, 2);
  assert.equal(st.right, 1);
  assert.equal(st.written, 1);
  assert.equal(st.hit, E.ASSESS.find(x => x.id === 'chat').points.length);
});
