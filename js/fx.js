'use strict';

// Motion that tells the player something: a ticket arriving, an SLA breaching, a job being moved.
// Built on Anime.js (js/vendor/anime.umd.min.js, MIT). Every effect is skipped when the device asks
// for reduced motion, or when Anime.js didn't load, and the app works the same either way.
// Nothing here changes game state; it only moves elements that are already drawn.

const FX = (() => {
  const A = () => (typeof anime !== 'undefined' ? anime : null);
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const on = () => !!A() && !reduced();
  // What each shift has already shown, keyed by the game object so a new shift starts clean.
  const seen = new WeakMap();
  const state = g => { let s = seen.get(g); if (!s) seen.set(g, s = { ids: null, breached: new Set() }); return s; };

  // Ids in `ids` that weren't there last time. The first call for a shift only takes note, so the
  // tickets already waiting at the start don't all animate in at once.
  function fresh(g, ids) {
    const s = state(g), now = new Set(ids.map(String));
    const out = s.ids ? [...now].filter(id => !s.ids.has(id)) : [];
    s.ids = now;
    return new Set(out);
  }

  // New queue rows drop in from just above and carry a short highlight.
  function arrive(rows) {
    rows = [...rows];
    if (!rows.length) return;
    rows.forEach(r => { r.classList.add('fx-new'); setTimeout(() => r.classList.remove('fx-new'), 1600); });
    if (!on()) return;
    A().animate(rows, { opacity: [0, 1], translateY: [-10, 0], duration: 320, delay: A().stagger(60), ease: 'outCubic' });
  }

  // One small shake the first time a ticket's timer goes into breach. Later redraws stay still.
  function breach(g, els) {
    const s = state(g);
    for (const el of els) {
      const id = el.dataset.resp || el.dataset.sla;
      if (!id || s.breached.has(id)) continue;
      s.breached.add(id);
      if (on()) A().animate(el, { translateX: [0, -4, 4, -3, 3, 0], duration: 420, ease: 'inOutSine' });
    }
  }

  // Dispatch board drag. The dragged copy lifts when picked up...
  function lift(ghost) {
    if (on()) A().animate(ghost, { scale: [1, 1.04], duration: 160, ease: 'outQuad' });
  }
  // ...and the drop outline glides between slots instead of jumping.
  function glide(mark, left) {
    if (!on() || !mark.style.left || mark.dataset.at === left) { mark.style.left = left; mark.dataset.at = left; return; }
    mark.dataset.at = left;
    A().animate(mark, { left, duration: 120, ease: 'outQuad' });
  }
  // On release the copy snaps (with a slight overshoot) into the slot it was dropped on, or back where it came from.
  // `done` runs once it lands (straight away when motion is off).
  function settle(ghost, rect, done) {
    const finish = () => { ghost.remove(); done && done(); };
    if (!ghost || !rect || !on()) { finish(); return; }
    A().animate(ghost, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', scale: 1, duration: 260, ease: 'outBack', onComplete: finish });
  }

  return { fresh, arrive, breach, lift, glide, settle, reduced };
})();
