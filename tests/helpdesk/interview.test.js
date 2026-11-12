'use strict';

// Help desk interview prep (HD_PREP in js/interview.js): every question links to real knowledge base
// articles and tickets, and each model answer covers every key point of its own question.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const FILES = ['js/data.js', 'js/scenarios.js', 'js/dispatch/interview.js', 'js/interview.js'];

function load() {
  const ctx = vm.createContext({ console });
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return vm.runInContext('({ HD_PREP, KB, SCENARIOS, prepCovered, ASSESS })', ctx);
}

test('every question is well formed and links to real articles and tickets', () => {
  const { HD_PREP, KB, SCENARIOS } = load();
  assert.ok(HD_PREP.length >= 10, 'at least ten questions');
  assert.equal(new Set(HD_PREP.map(q => q.id)).size, HD_PREP.length, 'ids are unique');
  for (const q of HD_PREP) {
    assert.ok(q.q.endsWith('?'), `${q.id}: question text`);
    assert.ok(q.points.length >= 3, `${q.id}: at least three key points`);
    assert.ok(q.kb.length, `${q.id}: at least one article`);
    for (const k of q.kb) assert.ok(KB.some(a => a.id === k), `${q.id}: unknown article ${k}`);
    const s = SCENARIOS.find(x => x.id === q.practise.ticket);
    assert.ok(s, `${q.id}: unknown ticket ${q.practise.ticket}`);
    assert.equal(s.shift || 1, q.practise.shift, `${q.id}: ${s.id} is in another shift`);
  }
});

test('each model answer covers every key point of its own question', () => {
  const { HD_PREP, prepCovered } = load();
  for (const q of HD_PREP) {
    const c = prepCovered(q, q.model);
    const missing = q.points.filter((_, i) => !c[i]).map(p => p.label);
    assert.deepEqual(Array.from(missing), [], `${q.id}: the model answer misses ${missing.join(', ')}`);
  }
});

test('an empty or off-topic answer covers nothing', () => {
  const { HD_PREP, prepCovered } = load();
  for (const q of HD_PREP) {
    assert.ok(prepCovered(q, '').every(x => !x), `${q.id}: empty`);
    assert.ok(prepCovered(q, 'I like pizza.').every(x => !x), `${q.id}: off-topic`);
  }
});

test('the help desk page loads the shared prep code before its own questions', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const shared = html.indexOf('js/dispatch/interview.js'), own = html.indexOf('js/interview.js"'), app = html.indexOf('js/app.js');
  assert.ok(shared > 0 && own > shared && app > own, 'index.html loads js/dispatch/interview.js, then js/interview.js, then js/app.js');
});
