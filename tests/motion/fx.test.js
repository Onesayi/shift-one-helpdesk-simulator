'use strict';

// js/fx.js only decorates what's already drawn. These checks hold it to that: it spots new tickets
// once per shift, shakes a breach once, and when Anime.js is missing or the device asks for reduced
// motion it still finishes a drag straight away.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function load({ reduced = false, anime } = {}) {
  const ctx = vm.createContext({ matchMedia: () => ({ matches: reduced }), setTimeout() {}, anime });
  vm.runInContext(read('js/fx.js') + '\n;globalThis.FX = FX;', ctx, { filename: 'js/fx.js' });
  return ctx.FX;
}

const el = (data = {}) => ({ dataset: data, removed: false, remove() { this.removed = true; }, classList: { add() {}, remove() {} } });

test('a shift\'s opening tickets are taken as read; later ones count as new, once', () => {
  const FX = load(), g = {};
  assert.deepEqual([...FX.fresh(g, [1, 2, 3])], []);
  assert.deepEqual([...FX.fresh(g, [1, 2, 3, 4])], ['4']);
  assert.deepEqual([...FX.fresh(g, [1, 2, 3, 4])], []);
  assert.deepEqual([...FX.fresh({}, [1, 2])], [], 'a new shift starts clean');
});

test('a breach shakes once per ticket', () => {
  const calls = [];
  const FX = load({ anime: { animate: (t, p) => calls.push(t), stagger: () => 0, spring: () => 0 } }), g = {};
  const a = el({ resp: '7' });
  FX.breach(g, [a]); FX.breach(g, [a]); FX.breach(g, [el({ sla: 'INC-2' })]);
  assert.equal(calls.length, 2);
});

test('with reduced motion nothing animates and a drop still goes ahead', () => {
  let animated = 0, done = 0;
  const FX = load({ reduced: true, anime: { animate: () => { animated++; }, stagger: () => 0, spring: () => 0 } });
  const ghost = el();
  FX.arrive([el()]); FX.breach({}, [el({ resp: '1' })]); FX.lift(ghost);
  FX.settle(ghost, { left: 0, top: 0, width: 10 }, () => { done++; });
  assert.equal(animated, 0);
  assert.equal(done, 1);
  assert.ok(ghost.removed);
});

test('without Anime.js a drop still goes ahead', () => {
  let done = 0;
  const FX = load(), ghost = el();
  FX.settle(ghost, { left: 0, top: 0, width: 10 }, () => { done++; });
  assert.equal(done, 1);
  assert.ok(ghost.removed);
});

test('both pages load Anime.js from this site, before js/fx.js and the app', () => {
  for (const p of ['index.html', 'dispatch.html']) {
    const srcs = [...read(p).matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
    const v = srcs.indexOf('js/vendor/anime.umd.min.js'), f = srcs.indexOf('js/fx.js');
    assert.ok(v >= 0 && f > v, `${p}: vendor then fx`);
    assert.ok(f < srcs.findIndex(s => /\/app\.js$|^js\/app\.js$/.test(s)), `${p}: fx before the app`);
  }
  assert.match(read('js/vendor/anime.umd.min.js'), /@license MIT/);
});
