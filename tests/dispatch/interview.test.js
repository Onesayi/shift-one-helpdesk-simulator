'use strict';

// Interview prep (PREP in js/dispatch/interview.js): every question links to real playbook articles and
// drills, its key points are reachable, and the model answer itself covers every point.

const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');

function memory() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
}

test('every question is well formed and links to real playbook articles and drills', () => {
  const { PREP, PLAYBOOK, DRILLS } = load();
  assert.ok(PREP.length >= 10, 'at least ten questions');
  assert.equal(new Set(PREP.map(q => q.id)).size, PREP.length, 'ids are unique');
  for (const q of PREP) {
    assert.ok(q.q.endsWith('?') || q.q.endsWith('.'), `${q.id}: question text`);
    assert.ok(q.points.length >= 3, `${q.id}: at least three key points`);
    for (const k of q.kb) assert.ok(PLAYBOOK.some(p => p.id === k), `${q.id}: unknown playbook article ${k}`);
    if (q.drill) assert.ok(DRILLS.some(d => d.id === q.drill), `${q.id}: unknown drill ${q.drill}`);
  }
});

test('each model answer covers every key point of its own question', () => {
  const { PREP, prepCovered } = load();
  for (const q of PREP) {
    const c = prepCovered(q, q.model);
    const missing = q.points.filter((_, i) => !c[i]).map(p => p.label);
    assert.deepEqual(Array.from(missing), [], `${q.id}: the model answer misses ${missing.join(', ')}`);
  }
});

test('an empty or off-topic answer covers nothing', () => {
  const { PREP, prepCovered } = load();
  for (const q of PREP) {
    assert.ok(prepCovered(q, '').every(x => !x), `${q.id}: empty`);
    assert.ok(prepCovered(q, 'I like pizza.').every(x => !x), `${q.id}: off-topic`);
  }
});

test('key points match however the answer is written', () => {
  const { PREP, prepCovered } = load();
  const q = PREP.find(x => x.id === 'vip-forward');
  assert.deepEqual(Array.from(prepCovered(q, 'I would CHECK THE DOMAIN, then call him on a known number. It could be phishing, so I don’t forward anything yet.')), [true, true, true, true]);
});

test('answers are saved in this browser and counted', () => {
  const E = load(memory());
  assert.equal(Object.keys(E.prepAnswers()).length, 0);
  E.savePrepAnswer('handover', 'Every open P1 and P2, anything waiting on a vendor, and a short summary with the next step.');
  E.savePrepAnswer('kpis', 'SLA');
  const st = E.prepStats();
  assert.equal(st.answered, 1, 'answers under 40 characters do not count as answered');
  assert.equal(st.total, E.PREP.length);
  assert.ok(st.hit >= 5);
  E.savePrepAnswer('kpis', '   ');
  assert.deepEqual(Array.from(Object.keys(E.prepAnswers())), ['handover'], 'clearing an answer removes it');
});
