'use strict';

// Loads the Service Coordinator engine (js/dispatch/*.js) into a Node VM with a do-nothing DOM,
// so tests can play a shift minute by minute and call the real grader. No dependencies.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const FILES = ['js/config.js', 'js/landing.js', 'js/dispatch/data.js', 'js/dispatch/scenarios.js', 'js/dispatch/app.js'];

// Any property, call or string conversion works and does nothing.
function inert() {
  const fn = function () {};
  const p = new Proxy(fn, {
    get: (_, k) => (k === Symbol.toPrimitive ? () => '' : k === Symbol.iterator ? [][Symbol.iterator] : p),
    set: () => true,
    apply: () => p,
  });
  return p;
}

// `storage` stands in for localStorage; by default nothing is saved.
function load(storage = { getItem: () => null, setItem() {} }) {
  const ctx = vm.createContext({
    console,
    document: inert(),
    localStorage: storage,
    matchMedia: () => ({ matches: false }),
    setInterval() {}, setTimeout() {},
  });
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  // The UI isn't under test: rendering and toasts become no-ops.
  vm.runInContext('render = () => {}; toast = () => {}; requestRender = () => {}; liveUpdate = () => {};', ctx);
  return vm.runInContext(`({
    get G() { return G; },
    SCENARIOS, CLIENTS, TECHS, SKILLS, BOARDS, PRIORITIES, SLA, DAY, SHIFT_START, SHIFT_END, REASONS,
    buildShift, newGame, onMinute, now, ticket, grade, endShift, logged, finalAppt, checkSlot,
    loadHistory, saveShift, bestScore,
    answerCall, saveTriage, sendMessage, requestApproval, notify, vendorCase, merge, closeTicket, openSchedule, unschedule,
  })`, ctx);
}

// A fresh game with a small driver API. Every action goes through the same functions the UI calls.
// The default seed is the fixed 'classic' shift that the answer key in docs/COORDINATOR.md describes.
function game(mode = 'timed', seed = 'classic') {
  const E = load();
  E.newGame(mode, seed);
  const t = id => {
    const x = E.ticket(id);
    if (!x) throw new Error(`Ticket #${id} hasn't arrived (it's ${E.now()})`);
    return x;
  };
  const sim = {
    E,
    get G() { return E.G; },
    now: () => E.now(),
    ticket: t,
    // Advance the clock to absolute minute m, running every minute's events on the way.
    // `each(m)` runs after each minute, e.g. to answer calls or react to new tickets.
    to(m, each) {
      for (let x = E.now() + 1; x <= m && E.G.phase === 'play'; x++) {
        E.G.clock = x;
        E.onMinute(x);
        if (each && E.G.phase === 'play') each(x);
      }
      return sim;
    },
    answer() { E.answerCall(); return sim; },
    triage(id, f) {
      Object.assign(E.G.drafts, {
        [`tri-${id}-board`]: f.board, [`tri-${id}-pri`]: f.priority, [`tri-${id}-skill`]: f.skill,
        [`tri-${id}-where`]: f.onsite ? 'onsite' : 'remote', [`tri-${id}-est`]: String(f.est ?? 60),
      });
      E.saveTriage(t(id));
      return sim;
    },
    // Triage exactly as the scenario's answer key says.
    triageRight(id, over = {}) {
      const T = t(id).s.truth;
      return sim.triage(id, Object.assign({ priority: T.priority, board: [].concat(T.board)[0], skill: T.skill, onsite: !!T.onsite, est: T.est }, over));
    },
    send(id, kind) { E.G.drafts['tpl-' + id] = kind; E.sendMessage(t(id)); return sim; },
    approval(id, contact) { E.G.drafts['appr-' + id] = contact; E.requestApproval(t(id)); return sim; },
    notify(id, who) { E.notify(t(id), who); return sim; },
    vendor(id, v) { E.G.drafts['vendor-' + id] = v; E.vendorCase(t(id)); return sim; },
    merge(id, parent) { E.G.drafts['merge-' + id] = parent; E.merge(t(id)); return sim; },
    close(id, reason, note = 'Closing note with enough detail to be useful.') {
      Object.assign(E.G.drafts, { ['reason-' + id]: reason, ['cnote-' + id]: note });
      E.closeTicket(t(id));
      return sim;
    },
    // Book through the scheduling dialog. Throws with the dialog's first error if the booking is refused.
    schedule(id, tech, start, opts = {}) {
      const x = t(id);
      E.G.pick = id;
      E.openSchedule(tech, start);
      if (opts.dur) E.G.drafts['sc-dur'] = String(opts.dur);
      if (opts.onsite != null) E.G.drafts['sc-where'] = opts.onsite ? 'onsite' : 'remote';
      const dur = Number(E.G.drafts['sc-dur']), onsite = E.G.drafts['sc-where'] === 'onsite';
      const R = E.checkSlot(x, tech, start, dur, onsite);
      const ok = E.G.modal.onOk();
      E.G.modal = null;
      if (ok === false) throw new Error(`Booking #${id} with ${tech} at ${start} refused: ${R.errors[0]}`);
      return sim;
    },
    grade: id => E.grade(t(id)),
    end() { E.endShift(); return E.G.report; },
  };
  return sim;
}

// Total points deducted, and whether any deduction's text matches.
const lost = r => r.ded.reduce((s, d) => s + d[0], 0);
const has = (r, re) => r.ded.find(d => re.test(d[1]));

module.exports = { load, game, lost, has };
