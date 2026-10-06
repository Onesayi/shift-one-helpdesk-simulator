'use strict';

// Seeded shifts (buildShift in js/dispatch/scenarios.js): variety, replayability and windows that keep each truth valid.

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, game } = require('./harness');

const SEEDS = Array.from({ length: 200 }, (_, i) => 's' + i);
// Values built inside the VM have its own Array/Object prototypes; compare plain copies.
const plain = x => JSON.parse(JSON.stringify(x));
const lineup = sh => sh.tickets.map(t => `${t.id}:${t.key}@${t.at}/${t.truth.startBy ?? '-'}`).join(' ') + ` ben@${sh.events[0].at}`;

test('classic is the original 18-ticket shift, unchanged', () => {
  const { buildShift, SCENARIOS } = load();
  const sh = buildShift('classic');
  const orig = SCENARIOS.filter(s => !s.extra);
  assert.deepEqual(plain(sh.tickets.map(t => [t.id, t.at, t.truth])), plain(orig.map(s => [s.id, s.at, s.truth])));
  assert.equal(sh.events[0].at, 585);
});

test('the same seed always builds the same shift; different seeds differ', () => {
  const { buildShift } = load();
  const other = load().buildShift;
  const seen = new Set();
  for (const s of SEEDS) {
    assert.equal(lineup(buildShift(s)), lineup(other(s)), `seed ${s}`);
    seen.add(lineup(buildShift(s)));
  }
  assert.ok(seen.size > SEEDS.length * 0.95, `only ${seen.size} distinct shifts from ${SEEDS.length} seeds`);
});

test('every seeded shift is well formed', () => {
  const { buildShift, SCENARIOS, TECHS } = load();
  const base = id => SCENARIOS.find(s => s.id === id);
  for (const seed of SEEDS) {
    const sh = buildShift(seed), today = sh.tickets.filter(t => t.at >= 0);
    const keys = today.map(t => t.key), at = `seed ${seed}`;
    assert.deepEqual(plain(sh.tickets.filter(t => t.at < 0).map(t => t.id)), ['4471', '4476'], `${at}: carry-overs`);
    assert.deepEqual(plain(today.map(t => t.id)), plain(today.map((_, i) => String(4501 + i))), `${at}: numbered in arrival order`);
    for (let i = 1; i < today.length; i++) assert.ok(today[i].at >= today[i - 1].at, `${at}: sorted by arrival`);
    for (const tag of ['p1', 'noise', 'approval', 'onsite']) assert.ok(today.some(t => t.pick === tag), `${at}: has a ${tag} ticket`);
    const groups = new Set(today.filter(t => t.group).map(t => t.group));
    assert.equal(new Set(keys).size, keys.length, `${at}: no duplicates`);
    assert.equal(today.length - today.filter(t => t.group).length + groups.size, 14, `${at}: 14 incidents`);
    for (const g of groups) assert.equal(SCENARIOS.filter(s => s.group === g).length, today.filter(t => t.group === g).length, `${at}: group ${g} arrives whole`);
    for (const t of today) for (const x of t.avoid || []) assert.ok(!keys.includes(x), `${at}: ${t.key} shares a shift with ${x}`);
    for (const t of today) {
      const s = base(t.key), lead = s.group ? SCENARIOS.find(x => x.group === s.group) : s;
      const delta = t.at - s.at;
      if (lead.window) assert.ok(lead.at + delta >= lead.window[0] && lead.at + delta <= lead.window[1], `${at}: ${t.key} arrives outside its window`);
      else assert.equal(delta, 0, `${at}: ${t.key} has no window but moved`);
      if (s.truth.startBy != null) assert.equal(t.truth.startBy, s.truth.startBy + (s.slide ? delta : 0), `${at}: ${t.key} startBy`);
      if (s.slide && t.truth.startBy != null && t.truth.startBy < 1440) {
        const able = Object.values(TECHS).filter(x => x.skills.includes(t.truth.skill));
        assert.ok(able.some(x => t.truth.startBy + t.truth.est <= x.end), `${at}: ${t.key} can't finish inside anyone's day`);
      }
    }
    const ben = sh.events[0].at;
    assert.ok(ben >= 555 && ben <= 630 && ben < 660, `${at}: Ben goes home at ${ben}, before his 11:00 appointment`);
  }
});

test('a seeded shift plays and grades the same way twice', () => {
  const play = () => {
    const g = game('timed', 'k7m2qp');
    g.to(g.E.SHIFT_END, () => { if (g.G.ring) g.answer(); });
    return plain({ final: g.G.report.final, rows: g.G.report.results.map(r => [r.score, r.ded.map(d => d.join(' '))]) });
  };
  const a = play();
  assert.deepEqual(play(), a);
  assert.equal(a.rows.length, game('timed', 'k7m2qp').G.shift.length);
  assert.ok(a.final > 0 && a.final < 60, `idle-ish shift scored ${a.final}`);
});
