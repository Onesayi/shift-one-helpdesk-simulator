'use strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const SPEEDS = [0, 0.5, 1, 2];            // sim minutes per real second
const SPEED_LABEL = ['❚❚', '1×', '2×', '4×'];
const RING_MIN = 10;                       // a phone rings this many sim minutes before voicemail
const REASONS = { resolved: 'Resolved', noise: 'No action needed', declined: 'Declined by client' };
const SLOT = 15;

const hm = m => {
  m = Math.floor(m);
  const day = m < 0 ? 'Wed ' : m >= DAY ? 'Fri ' : '';
  const x = ((m % DAY) + DAY) % DAY;
  return day + String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
};
const mins = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`;
const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

let G = null;
let PAGE = 'start';

function newGame(mode, seed) {
  const shift = buildShift(seed);
  G = {
    phase: 'play', mode, clock: SHIFT_START, speed: 1,
    seed: shift.seed, shift: shift.tickets, events: shift.events,
    tickets: [], log: [], seq: 0, appts: [], apptSeq: 0, blocks: baseBlocks(),
    techs: Object.fromEntries(Object.keys(TECHS).map(k => [k, { sickAt: null }])),
    block: { pp: CLIENTS.pp.block },
    view: 'board', active: null, filter: 'open', pick: null, day: 0,
    client: 'hdg', pb: 'PB-01', teamSel: null,
    timers: [], calls: [], ring: null, news: [], spawned: new Set(), eventsDone: new Set(),
    drafts: {}, modal: null, dirty: false,
  };
  for (const s of G.shift.filter(x => x.at < 0)) spawnTicket(s);
  try { history.replaceState(null, '', '?seed=' + G.seed); } catch { /* file:// or sandboxed */ }
  onMinute(SHIFT_START);
  G.active = G.tickets[0]?.id ?? null;
  render();
}

const now = () => Math.floor(G.clock);
const ticket = id => G.tickets.find(t => t.id === id);
const isOpen = t => !t.closed && !t.parent;
const client = t => CLIENTS[t.client];
const contactOf = (t, id = t.contact) => id && client(t).contacts[id];
const greet = c => c.greet || (c.name.startsWith('Dr. ') ? 'Dr. ' + c.name.split(' ').pop() : c.name.split(' ')[0]);
const respTarget = t => SLA[client(t).sla][t.s.truth.priority || 'P3'];
const needsResponse = t => !!t.s.contact && !t.s.noResponseSla && t.s.channel !== 'carry';

function who(t, from) {
  if (from === 'me') return 'You';
  if (from === 'system') return 'System';
  if (from === 'rmm') return 'RMM monitoring';
  if (from === 'vendor') return t.s.vendor || t.s.from || 'Vendor';
  if (TECHS[from]) return TECHS[from].name + ' (tech)';
  if (INTERNAL[from]) return `${INTERNAL[from].name} (${INTERNAL[from].role})`;
  const c = contactOf(t, from);
  return c ? c.name : from;
}

// ---------------------------------------------------------------------------
// Event log: everything the coordinator does (and what the techs do) is graded from here.
// ---------------------------------------------------------------------------
function record(type, data = {}) {
  const e = Object.assign({ seq: ++G.seq, at: now(), type }, data);
  G.log.push(e);
  return e;
}
function logged(type, pred) { return G.log.filter(e => e.type === type && (!pred || pred(e))); }

// Run fn after `m` sim minutes. Uses the sim clock, so pausing pauses replies too.
function later(m, fn) { G.timers.push({ at: now() + m, fn }); }

function post(t, from, text, kind, label) {
  t.thread.push({ from, text, kind, at: now(), label });
  if (kind === 'vendor') { t.lastVendorMsg = text; record('vendor-msg', { ticket: t.id }); }
  if (G.active !== t.id) t.unread = true;
}

// ---------------------------------------------------------------------------
// Tickets, calls and the clock
// ---------------------------------------------------------------------------
function spawnTicket(s, opts = {}) {
  const carry = s.at < 0;
  const arrived = carry ? 900 - DAY : opts.arrived ?? now();
  const t = {
    id: s.id, s, client: s.client, contact: s.contact, channel: s.channel, title: s.title,
    arrived, status: 'New', triage: null, triagedAt: null, thread: [], flags: {}, parent: null, closed: null,
    firstResponseAt: null, lastUpdateAt: null, chasers: 0, missedCall: !!opts.missed, unread: true,
  };
  const from = s.contact && !s.from ? s.contact : s.channel === 'alert' ? 'rmm' : s.channel === 'vendor' ? 'vendor' : s.contact;
  if (s.channel === 'phone') {
    if (opts.missed) post(t, 'system', `Missed call at ${hm(arrived)}. Voicemail transcript:`, 'system');
    else post(t, 'system', `Call answered at ${hm(now())}. Notes from the call:`, 'system');
  }
  post(t, from, s.body, s.channel === 'alert' ? 'alert' : s.channel === 'vendor' ? 'vendor-in' : 'client', s.from);
  if (carry) {
    t.triage = Object.assign({}, s.pre.triage);
    t.triagedAt = arrived; t.firstResponseAt = arrived; t.lastUpdateAt = arrived;
    const a = s.pre.appt;
    addAppt({ tech: a.tech, start: a.start, dur: a.dur, ticket: t.id, onsite: false });
    t.status = 'Scheduled';
    post(t, 'system', `Carried over from yesterday. Booked with ${TECHS[a.tech].name}, today ${hm(a.start)}.`, 'system');
  }
  if (opts.answered) { t.firstResponseAt = now(); t.lastUpdateAt = now(); }
  G.tickets.push(t);
  if (!carry && !opts.answered) toast(`New ticket #${t.id} · ${client(t).name} · ${t.title}`, s.channel === 'alert' ? 'info' : '');
  return t;
}

function startRing() {
  const s = G.calls.shift();
  G.ring = { s, since: now(), until: now() + RING_MIN };
  if (G.speed > 1) G.speed = 1;
}

function answerCall() {
  const r = G.ring;
  if (!r) return;
  G.ring = null;
  const t = spawnTicket(r.s, { answered: true, arrived: r.since });
  record('call-answer', { ticket: t.id });
  G.active = t.id; G.view = 'board';
  toast(`On the phone with ${contactOf(t).name}. Ticket #${t.id} created.`, 'good');
  if (G.calls.length) startRing();
  render();
}

function missCall() {
  const r = G.ring;
  G.ring = null;
  const t = spawnTicket(r.s, { missed: true, arrived: r.since });
  record('call-missed', { ticket: t.id });
  toast(`Missed call from ${contactOf(t).name}. It went to voicemail (#${t.id}).`, 'bad');
  if (G.calls.length) startRing();
}

function tick() {
  if (!G || G.phase !== 'play') return;
  const sp = SPEEDS[G.speed];
  if (!sp) return;
  const prev = now();
  G.clock = Math.min(SHIFT_END, G.clock + sp * 0.25);
  let changed = false;
  for (let m = prev + 1; m <= now(); m++) {
    changed = onMinute(m) || changed;
    if (G.phase !== 'play') return;
  }
  if (changed) requestRender();
  else if (now() !== prev) liveUpdate();
}

function onMinute(m) {
  let changed = m % SLOT === 0;

  for (const ev of G.events) {
    if (G.eventsDone.has(ev) || m < ev.at) continue;
    G.eventsDone.add(ev);
    G.techs[ev.tech].sickAt = ev.at;
    G.news.push({ at: m, text: ev.text });
    toast(ev.text, 'bad');
    changed = true;
  }

  for (const s of G.shift) {
    if (s.at < 0 || G.spawned.has(s.id) || m < SHIFT_START + s.at) continue;
    G.spawned.add(s.id);
    if (s.channel === 'phone') G.calls.push(s);
    else spawnTicket(s);
    changed = true;
  }

  if (G.ring && m >= G.ring.until) { missCall(); changed = true; }
  if (!G.ring && G.calls.length) { startRing(); changed = true; }

  const due = G.timers.filter(x => x.at <= m);
  if (due.length) {
    G.timers = G.timers.filter(x => x.at > m);
    due.forEach(x => x.fn());
    changed = true;
  }

  for (const a of G.appts) {
    if (a.state === 'booked' && a.start <= m) {
      const t = ticket(a.ticket), sick = G.techs[a.tech].sickAt;
      if (sick != null && a.start >= sick) {
        a.state = 'missed';
        record('appt-missed', { ticket: t.id, tech: a.tech });
        t.status = 'Needs reassign';
        if (t.contact && isOpen(t)) chase(t, `It's ${hm(m)} and nobody has been in touch. I was told ${TECHS[a.tech].name.split(' ')[0]} would ${a.onsite ? 'come by' : 'connect'} at ${hm(a.start)}?`);
      } else {
        a.state = 'working'; a.startedAt = m;
        record('work-start', { ticket: t.id, tech: a.tech });
        t.status = a.onsite ? 'Onsite' : 'In progress';
        post(t, a.tech, a.onsite ? 'Arrived onsite, starting now.' : 'Starting on this now.', 'tech');
      }
      changed = true;
    }
    if (a.state === 'working') {
      const t = ticket(a.ticket), at = t.s.workAt ?? a.dur;
      if (m >= a.startedAt + Math.min(a.dur, at)) {
        a.state = 'done';
        const tech = TECHS[a.tech];
        const out = (t.s.work && t.s.work(t, a, tech)) || defaultWork(t, a, tech);
        workDone(t, a.tech, out);
        changed = true;
      }
    }
  }

  for (const t of G.tickets) {
    if (!isOpen(t) || !needsResponse(t)) continue;
    const sla = respTarget(t);
    if (t.firstResponseAt == null && !t.flags.chased && m - t.arrived >= sla + Math.max(15, sla / 2)) {
      t.flags.chased = true;
      chase(t, `Hi, just checking someone has seen this? It's been ${mins(m - t.arrived)}. (#${t.id})`);
      changed = true;
    }
    if (t.s.truth.priority === 'P1' && t.status !== 'Completed') {
      const last = Math.max(t.lastUpdateAt ?? t.arrived, t.lastChaseAt ?? 0);
      if (m - last >= 45) {
        chase(t, t.s.p1Chase || 'Any news on this? Nobody has updated me yet.');
        changed = true;
      }
    }
  }

  if (m >= SHIFT_END) { endShift(); return true; }
  return changed;
}

function chase(t, text) {
  post(t, t.contact, text, 'client');
  t.chasers++; t.lastChaseAt = now();
  record('chaser', { ticket: t.id });
  toast(`${contactOf(t).name} is chasing #${t.id}.`, 'bad');
}

function defaultWork(t, a, tech) {
  const T = t.s.truth;
  if (T.onsite && !a.onsite) return { kind: 'bounce', note: 'I can\'t fix this remotely. It needs someone onsite with the hardware. Handing it back to dispatch.' };
  if (T.skill && !tech.skills.includes(T.skill)) return { kind: 'bounce', note: `This isn't my area. It needs someone with ${T.skill} skills. Handing it back to dispatch.` };
  if (T.dispatch === false) return { kind: 'done', note: 'Looked into it. There was nothing to do here.' };
  return { kind: 'done', note: t.s.fixNote };
}

function workDone(t, techId, out) {
  if (!isOpen(t)) return;
  record('work-done', { ticket: t.id, tech: techId, kind: out.kind });
  post(t, techId, out.note, 'tech');
  t.status = { done: 'Completed', bounce: 'Needs reassign', vendor: 'Waiting on vendor' }[out.kind];
  const msg = { done: `${TECHS[techId].name} completed #${t.id}.`, bounce: `${TECHS[techId].name} handed #${t.id} back: wrong skills.`, vendor: `${TECHS[techId].name} needs a vendor case on #${t.id}.` }[out.kind];
  toast(msg, out.kind === 'done' ? 'good' : 'bad');
}

// ---------------------------------------------------------------------------
// Coordinator actions
// ---------------------------------------------------------------------------
function saveTriage(t) {
  const d = k => G.drafts[`tri-${t.id}-${k}`];
  const f = { board: d('board'), priority: d('pri'), skill: d('skill'), onsite: d('where') === 'onsite', est: Number(d('est')) };
  if (!f.board || !f.priority || !f.skill || !d('where') || !f.est) return toast('Fill in every triage field first.', 'bad');
  t.triage = f;
  if (t.triagedAt == null) t.triagedAt = now();
  record('triage', Object.assign({ ticket: t.id }, f));
  if (t.status === 'New') t.status = 'Triaged';
  G.drafts[`open-tri-${t.id}`] = false;
  toast(`#${t.id} triaged: ${f.priority} · ${f.board} · ${f.skill}.`, 'good');
  render();
}

const TEMPLATES = {
  ack: { label: 'Acknowledge', text: (t, c) => `Hi ${greet(c)}, thanks for getting in touch. We've logged this as ticket #${t.id}${t.triage ? ` (priority ${t.triage.priority})` : ''} and a technician will be assigned shortly. We'll confirm a time with you.` },
  sched: {
    label: 'Appointment confirmation',
    need: t => { const a = finalAppt(t); return a && ['booked', 'working'].includes(a.state) ? '' : 'Book a technician first.'; },
    text: (t, c) => { const a = finalAppt(t); return `Hi ${greet(c)}, ${TECHS[a.tech].name} will ${a.onsite ? 'be onsite' : 'connect remotely'} ${a.start >= DAY ? 'on Friday' : 'today'} at ${hm(a.start % DAY)} (about ${mins(a.dur)}) for ticket #${t.id}.` },
  },
  update: { label: 'Status update', text: (t, c) => `Hi ${greet(c)}, an update on #${t.id}: ${statusLine(t)}` },
  resolved: { label: 'Resolution confirmation', text: (t, c) => { const n = [...t.thread].reverse().find(m => m.kind === 'tech'); return `Hi ${greet(c)}, good news on #${t.id}. ${n ? n.text : 'The work is complete.'} If anything still isn't right, just reply and we'll pick it straight back up.`; } },
  declined: { label: 'Request declined', text: (t, c) => `Hi ${greet(c)}, we checked this request with an authorized approver at ${client(t).name} and it wasn't approved, so we're closing ticket #${t.id}. Please speak to them if you have questions.` },
};

function statusLine(t) {
  const a = finalAppt(t);
  if (t.status === 'Waiting on vendor') return `the fault is with the provider, not your equipment. ${t.lastVendorMsg ? t.lastVendorMsg.replace(/^[^:]+:\s*/, 'Their latest: ') : 'We\'ve raised it with them.'} We're standing by and will update you again within 30 minutes.`;
  if (t.status === 'Waiting on approval') return 'we\'re waiting for approval from an authorized contact before we can make this change.';
  if (t.s.notice) return t.s.notice;
  if (a && a.state === 'working') return `${TECHS[a.tech].name} is working on it right now.`;
  if (a && a.state === 'booked') return `it's booked with ${TECHS[a.tech].name} ${a.start >= DAY ? 'on Friday' : 'today'} at ${hm(a.start % DAY)}.`;
  if (t.lastVendorMsg && t.status !== 'Completed') return `we've raised it with ${t.s.vendor || 'the vendor'}. ${t.lastVendorMsg.replace(/^[^:]+:\s*/, 'Their latest: ')}`;
  return 'we\'re on it and will confirm a time with you shortly.';
}

function sendMessage(t) {
  const kind = G.drafts['tpl-' + t.id] || 'ack', tpl = TEMPLATES[kind], c = contactOf(t);
  if (!c) return toast('This ticket has no client contact to message.', 'bad');
  const block = tpl.need && tpl.need(t);
  if (block) return toast(block, 'bad');
  post(t, 'me', tpl.text(t, c), 'me');
  record('client-msg', { ticket: t.id, kind });
  if (t.firstResponseAt == null) t.firstResponseAt = now();
  t.lastUpdateAt = now();
  if (kind === 'resolved') {
    if (t.status === 'Completed') later(2, () => { t.flags.confirmed = true; post(t, t.contact, 'Confirmed, all working now. Thank you!', 'client'); });
    else { record('premature', { ticket: t.id }); later(2, () => post(t, t.contact, 'Umm, it\'s still not working here? Nobody has done anything yet as far as I can tell.', 'client')); }
  } else if (kind === 'sched') later(2, () => post(t, t.contact, 'Perfect, thanks.', 'client'));
  toast(`Sent to ${c.name}.`);
  render();
}

function requestApproval(t) {
  const cid = G.drafts['appr-' + t.id];
  if (!cid) return toast('Choose who to ask.', 'bad');
  const c = contactOf(t, cid);
  record('approval-req', { ticket: t.id, contact: cid });
  post(t, 'system', `Approval requested from ${c.name} (${c.role}).`, 'system');
  const before = t.status;
  t.status = 'Waiting on approval';
  later(3, () => {
    const a = t.s.approval && t.s.approval[cid];
    const ok = a ? a.ok : true;
    post(t, cid, a ? a.text : c.auth ? 'Yes, that\'s approved. Go ahead.' : 'Sure, fine by me!', 'client', c.name + ' (approval reply)');
    record('approval', { ticket: t.id, contact: cid, ok, auth: c.auth });
    if (isOpen(t)) t.status = a?.next || (ok ? (before === 'Waiting on approval' ? 'Triaged' : before) : 'Approval declined');
    toast(`${c.name} replied on #${t.id}.`, ok ? 'good' : 'info');
  });
  render();
}

function notify(t, who) {
  if (who === 'sm') {
    record('notify-sm', { ticket: t.id });
    post(t, 'system', 'Paged Dana Whitaker (Service Manager).', 'system');
    later(1, () => {
      if (t.s.sm) post(t, 'sm', 'Thanks, I\'m watching this one. Keep the client updated at least every 30 minutes and shout if you need more hands.', 'internal');
      else { post(t, 'sm', 'Thanks, but this one doesn\'t need me. Page me for P1s, security incidents and complaints.', 'internal'); record('sm-noise', { ticket: t.id }); }
    });
  } else {
    record('notify-am', { ticket: t.id });
    post(t, 'system', 'Escalated to Rob Hale (Account Manager).', 'system');
    later(4, () => {
      if (t.s.am) {
        post(t, 'am', t.s.am.reply, 'internal');
        record('am-approved', { ticket: t.id });
        G.block[t.client] = (G.block[t.client] || 0) + 10;
      } else { post(t, 'am', 'Nothing for me here. This is covered by their agreement.', 'internal'); record('am-noise', { ticket: t.id }); }
    });
  }
  render();
}

function vendorCase(t) {
  const v = G.drafts['vendor-' + t.id];
  if (!v) return toast('Choose a vendor.', 'bad');
  record('vendor-case', { ticket: t.id, vendor: v });
  post(t, 'system', `Vendor case logged with ${v}.`, 'system');
  if (t.s.onVendor && v === t.s.vendor) t.s.onVendor(t, v);
  else later(5, () => post(t, 'system', `${v}: Case opened. We have no fault or pending work on file for this account. Please send more details.`, 'system'));
  render();
}

function merge(t) {
  const pid = G.drafts['merge-' + t.id], p = ticket(pid);
  if (!p) return toast('Choose the parent ticket.', 'bad');
  cancelAppts(t);
  t.parent = p.id; t.status = 'Merged';
  record('merge', { ticket: t.id, parent: p.id });
  post(t, 'system', `Merged into #${p.id} as a duplicate.`, 'system');
  post(p, 'system', `#${t.id} (${contactOf(t)?.name || t.title}) merged into this ticket.`, 'system');
  G.active = p.id;
  toast(`#${t.id} merged into #${p.id}.`, 'good');
  render();
}

function closeTicket(t) {
  const reason = G.drafts['reason-' + t.id], note = (G.drafts['cnote-' + t.id] || '').trim();
  if (!reason) return toast('Choose a close reason.', 'bad');
  if (!note) return toast('Write a closing note.', 'bad');
  cancelAppts(t);
  t.closed = { reason, note, at: now() };
  t.status = 'Closed';
  record('close', { ticket: t.id, reason });
  post(t, 'system', `Closed: ${REASONS[reason]}. ${note}`, 'system');
  toast(`#${t.id} closed.`, 'good');
  render();
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------
function addAppt(o) {
  const a = Object.assign({ id: ++G.apptSeq, state: 'booked' }, o);
  G.appts.push(a);
  return a;
}
function finalAppt(t) { return [...G.appts].reverse().find(a => a.ticket === t.id && a.state !== 'cancelled'); }
function cancelAppts(t) {
  G.appts.filter(a => a.ticket === t.id && a.state === 'booked').forEach(a => { a.state = 'cancelled'; record('unschedule', { ticket: t.id, tech: a.tech }); });
}
const busyRange = a => [a.onsite ? a.start - TRAVEL_MIN : a.start, a.start + a.dur];
const inWindow = (c, a) => c.onsite.some(([s, e]) => { const st = a.start % DAY; return st >= s && st + a.dur <= e; });

function checkSlot(t, techId, start, dur, onsite) {
  const tech = TECHS[techId], R = { errors: [], warns: [], infos: [], bumps: [] };
  const from = onsite ? start - TRAVEL_MIN : start, to = start + dur, day = start >= DAY ? DAY : 0;
  const sick = G.techs[techId].sickAt;
  if (sick != null && to > sick) R.errors.push(`${tech.name} has gone home sick.`);
  if (start < Math.floor(now() / SLOT) * SLOT) R.errors.push('That time has already passed.');
  if (from < day + tech.start || to > day + tech.end) R.errors.push(`${tech.name} works ${hm(tech.start)}–${hm(tech.end)}${onsite ? ', and the visit needs 30 min of travel first' : ''}.`);
  if (onsite && !tech.onsite) R.errors.push(`${tech.name} works remotely and doesn't do site visits.`);
  R.interrupt = [];
  for (const a of G.appts) {
    if (a.tech !== techId || a.ticket === t.id || !['booked', 'working'].includes(a.state)) continue;
    const [s, e] = busyRange(a);
    if (!overlaps(from, to, s, e)) continue;
    if (a.state === 'booked') R.errors.push(`Double-booked with #${a.ticket} (${hm(a.start)}). Move that one first.`);
    else if (t.triage?.priority === 'P1' && ticket(a.ticket).triage?.priority !== 'P1') { R.warns.push(`Pulls ${tech.name.split(' ')[0]} off #${a.ticket}, which goes back to you for rebooking.`); R.interrupt.push(a); }
    else R.errors.push(`${tech.name} is working on #${a.ticket} until ${hm(a.start + a.dur)}. Only a P1 can pull them off it.`);
  }
  for (const b of G.blocks) {
    if (b.tech !== techId || !overlaps(from, to, b.start, b.start + b.dur)) continue;
    if (!b.soft) R.errors.push(`Clashes with "${b.label}" (${hm(b.start)}).`);
    else { R.warns.push(`Bumps ${tech.name.split(' ')[0]}'s ${b.kind === 'lunch' ? 'lunch' : `"${b.label}"`}.`); R.bumps.push(b.kind); }
  }
  if (!t.triage) R.warns.push('This ticket isn\'t triaged yet.');
  else if (!tech.skills.includes(t.triage.skill)) R.warns.push(`Your triage says ${t.triage.skill}; ${tech.name} doesn't list that skill.`);
  else R.infos.push(`${tech.name} has ${t.triage.skill} skills.`);
  const c = client(t);
  if (onsite && !inWindow(c, { start, dur })) R.warns.push(`${c.name} allows visits ${c.onsiteText}.`);
  if (onsite) R.infos.push('30 min travel is added before the visit.');
  if (c.block != null && !logged('am-approved', e => e.ticket === t.id).length && dur / 60 > G.block[t.client]) R.warns.push(`${c.name} has ${G.block[t.client]} h left in their block; this booking is ${mins(dur)}.`);
  if (t.status === 'Waiting on approval') R.warns.push('Approval hasn\'t come back yet.');
  if (t.status === 'Approval declined') R.warns.push('The approver declined this request.');
  return R;
}

function openSchedule(techId, start) {
  const t = ticket(G.pick);
  if (!t) return toast('Pick a ticket to schedule first: open it and press "Schedule".', 'bad');
  Object.assign(G.drafts, {
    'sc-tech': techId, 'sc-start': String(start),
    'sc-dur': String(t.triage?.est || 60),
    'sc-where': (t.triage?.onsite ?? TECHS[techId].onsite) ? 'onsite' : 'remote',
  });
  modal({
    title: `Schedule #${t.id}`,
    body: () => {
      const tid = G.drafts['sc-tech'], st = Number(G.drafts['sc-start']), du = Number(G.drafts['sc-dur']), on = G.drafts['sc-where'] === 'onsite';
      const R = checkSlot(t, tid, st, du, on);
      const day = st >= DAY ? DAY : 0;
      const slots = [];
      for (let m = day + SHIFT_START; m < day + SHIFT_END; m += SLOT) slots.push(m);
      return `<p><b>${esc(t.title)}</b><br><span class="muted small">${esc(client(t).name)}${t.triage ? ` · ${t.triage.priority} · ${esc(t.triage.skill)}` : ''}</span></p>
        <div class="grid2">
          <label class="field"><span>Technician</span><select id="d-sc-tech" data-draft="sc-tech" data-live="1">${Object.entries(TECHS).map(([k, x]) => `<option value="${k}" ${k === tid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Start</span><select id="d-sc-start" data-draft="sc-start" data-live="1">${slots.map(m => `<option value="${m}" ${m === st ? 'selected' : ''}>${hm(m)}</option>`).join('')}</select></label>
          <label class="field"><span>Duration</span><select id="d-sc-dur" data-draft="sc-dur" data-live="1">${ESTIMATES.map(x => `<option value="${x}" ${x === du ? 'selected' : ''}>${mins(x)}</option>`).join('')}</select></label>
          <label class="field"><span>Work type</span><select id="d-sc-where" data-draft="sc-where" data-live="1"><option value="remote" ${!on ? 'selected' : ''}>Remote</option><option value="onsite" ${on ? 'selected' : ''}>Onsite visit</option></select></label>
        </div>
        <ul class="checks">${R.errors.map(x => `<li class="b">${esc(x)}</li>`).join('')}${R.warns.map(x => `<li class="w">${esc(x)}</li>`).join('')}${R.infos.map(x => `<li class="g">${esc(x)}</li>`).join('')}</ul>`;
    },
    ok: 'Book it',
    onOk() {
      const tid = G.drafts['sc-tech'], st = Number(G.drafts['sc-start']), du = Number(G.drafts['sc-dur']), on = G.drafts['sc-where'] === 'onsite';
      const R = checkSlot(t, tid, st, du, on);
      if (R.errors.length) { toast(R.errors[0], 'bad'); return false; }
      cancelAppts(t);
      R.interrupt.forEach(x => {
        const o = ticket(x.ticket);
        x.state = 'cancelled';
        record('interrupt', { ticket: o.id, tech: x.tech, by: t.id });
        o.status = 'Needs reassign';
        post(o, x.tech, `Pulled off this for P1 #${t.id}. It needs rebooking so I can finish.`, 'tech');
      });
      const a = addAppt({ tech: tid, start: Math.max(st, now()), dur: du, ticket: t.id, onsite: on });
      record('schedule', { ticket: t.id, tech: tid, start: a.start, dur: du, onsite: on, bumps: R.bumps });
      t.status = 'Scheduled';
      post(t, 'system', `Booked with ${TECHS[tid].name}, ${hm(a.start)} for ${mins(du)}${on ? ' (onsite)' : ''}.`, 'system');
      G.pick = null;
      toast(`#${t.id} booked with ${TECHS[tid].name} at ${hm(a.start)}.`, 'good');
    },
  });
}

function unschedule(t) {
  const a = finalAppt(t);
  if (!a || a.state !== 'booked') return;
  a.state = 'cancelled';
  record('unschedule', { ticket: t.id, tech: a.tech });
  t.status = t.triage ? 'Triaged' : 'New';
  post(t, 'system', `Unbooked from ${TECHS[a.tech].name}.`, 'system');
  render();
}

function techStatus(id, m = now()) {
  const x = TECHS[id], d = m >= DAY ? DAY : 0, st = G.techs[id];
  if (st.sickAt != null && m >= st.sickAt) return ['bad', 'Out sick'];
  if (m < d + x.start || m >= d + x.end) return ['muted', 'Off shift'];
  const a = G.appts.find(a => a.tech === id && a.state === 'working');
  if (a) return ['warn', a.onsite ? `Onsite · #${a.ticket}` : `On #${a.ticket}`];
  const tr = G.appts.find(a => a.tech === id && a.state === 'booked' && a.onsite && m >= a.start - TRAVEL_MIN && m < a.start);
  if (tr) return ['warn', 'Driving'];
  const b = G.blocks.find(b => b.tech === id && m >= b.start && m < b.start + b.dur);
  if (b) return ['warn', b.kind === 'travel' ? 'Driving' : b.label];
  return ['ok', 'Available'];
}

function utilization(id) {
  const x = TECHS[id], sick = G.techs[id].sickAt, until = Math.min(DAY, sick ?? DAY);
  const booked = G.appts.filter(a => a.tech === id && a.start < until && !['cancelled', 'missed'].includes(a.state)).reduce((s, a) => s + a.dur, 0)
    + G.blocks.filter(b => b.tech === id && b.kind === 'job' && b.start < until).reduce((s, b) => s + b.dur, 0);
  const avail = (sick != null ? Math.max(0, sick - x.start) : x.end - x.start) || 1;
  return Math.min(100, Math.round(booked / avail * 100));
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------
function grade(t) {
  const s = t.s, T = s.truth, ded = [], good = [];
  const pr = p => PRIORITIES.indexOf(p);

  if (s.group) {
    if (t.parent) {
      const p = ticket(t.parent);
      if (p.s.group === s.group) return { score: 100, good: [`Merged into #${p.id}: same incident, handled once.`], ded: [] };
    }
    const all = G.tickets.filter(x => x.s.group === s.group);
    const others = all.filter(x => x !== t && !x.parent);
    if (!t.parent && others.length) ded.push([20, `Same fault as #${others.map(x => x.id).join(', #')}. Merge duplicates into one parent ticket.`]);
    else if (!t.parent && all.length > 1) good.push('Merged the duplicates: one incident, one technician, one set of updates.');
  }
  if (t.parent && !(s.group && ticket(t.parent).s.group === s.group)) ded.push([40, `Merged into #${t.parent}, but this was a separate problem.`]);

  const tri = t.triage;
  if (T.priority && !t.parent) {
    if (!tri) ded.push([25, 'Never triaged: no priority, board or skill set.']);
    else {
      if (!s.pre) {
        const tt = t.triagedAt - t.arrived;
        if (tt > 30) ded.push([10, `Took ${tt} minutes to triage.`]);
        else if (tt > 15) ded.push([5, `Took ${tt} minutes to triage. Aim for 15.`]);
        else good.push(`Triaged in ${tt} min.`);
      }
      if (tri.priority === T.priority || (T.okPri || []).includes(tri.priority)) { if (!s.pre) good.push(`Priority ${tri.priority}.`); }
      else ded.push([Math.abs(pr(tri.priority) - pr(T.priority)) > 1 ? 20 : 10, `Priority ${tri.priority}; should be ${T.priority}. ${T.why || ''}`.trim()]);
      const boards = [].concat(T.board);
      if (!boards.includes(tri.board)) ded.push([5, `Put on ${tri.board}; this belongs on ${boards.join(' or ')}.`]);
      if (T.skill && tri.skill !== T.skill) ded.push([5, `Skill set to ${tri.skill}; the work needs ${T.skill}.`]);
      if (T.onsite != null && tri.onsite !== T.onsite) ded.push([5, T.onsite ? 'This needs an onsite visit.' : 'This is remote work. No site visit needed.']);
    }
  }

  if (needsResponse(t) && !t.parent) {
    const sla = respTarget(t);
    if (t.missedCall) ded.push([10, 'Missed the call. The client got voicemail.']);
    if (t.firstResponseAt == null) ded.push([20, 'The client never heard from us.']);
    else {
      const r = t.firstResponseAt - t.arrived;
      if (r > sla) ded.push([10, `First response after ${r} min. The ${T.priority || 'P3'} target for this client is ${sla} min.`]);
      else if (!t.missedCall) good.push(s.channel === 'phone' ? 'Answered the call live.' : `First response in ${r} min (target ${sla}).`);
    }
  }
  if (t.chasers) ded.push([Math.min(20, 10 * t.chasers), t.chasers > 1 ? `The client had to chase us ${t.chasers} times.` : 'The client had to chase us.']);
  if (logged('premature', e => e.ticket === t.id).length) ded.push([15, 'Told the client it was fixed before the technician had finished.']);
  if (logged('sm-noise', e => e.ticket === t.id).length) ded.push([5, 'Paged the Service Manager for a routine ticket.']);
  if (logged('am-noise', e => e.ticket === t.id).length) ded.push([5, 'Sent a covered ticket to the Account Manager.']);

  const scheds = logged('schedule', e => e.ticket === t.id);
  const a = finalAppt(t);
  const worked = logged('work-start', e => e.ticket === t.id).length > 0;
  const completed = logged('work-done', e => e.ticket === t.id && e.kind === 'done').length > 0;
  if (T.dispatch && !t.parent) {
    const wrong = new Map();
    scheds.forEach(e => {
      const x = TECHS[e.tech];
      if (T.skill && !x.skills.includes(T.skill)) wrong.set(e.tech, `Sent to ${x.name}, who can't do this: it needs ${T.skill} skills.`);
      else if (T.onsite && !e.onsite && !wrong.has(e.tech)) wrong.set(e.tech, `Sent ${x.name} remotely: this needs a site visit.`);
    });
    wrong.forEach(text => ded.push([15, text]));
    if (!a) ded.push([30, logged('interrupt', e => e.ticket === t.id).length ? 'Pulled off for a P1 and never rebooked.' : 'Never scheduled a technician.']);
    else {
      const x = TECHS[a.tech], sick = G.techs[a.tech].sickAt;
      if (sick != null && a.start >= sick && ['booked', 'missed'].includes(a.state)) ded.push([30, `Still booked with ${x.name}, who went home sick. Nobody turned up.`]);
      else if (T.startBy && a.start > T.startBy) ded.push([10, `Booked for ${hm(a.start)}. It needed to start by ${hm(T.startBy)}.`]);
      else if (!wrong.has(a.tech)) good.push(`Booked ${x.name} for ${hm(a.start)}: right skills, in time.`);
      if (a.onsite && T.priority !== 'P1' && !inWindow(client(t), a)) ded.push([10, `${client(t).name} only allows visits ${client(t).onsiteText}.`]);
    }
    const seen = new Set();
    scheds.forEach(e => {
      if ((e.bumps.includes('project') || e.bumps.includes('meeting')) && ['P3', 'P4'].includes(T.priority) && !seen.has('p')) { seen.add('p'); ded.push([5, `Bumped project or meeting time for a ${T.priority}. Save that for P1 and P2.`]); }
      if (e.bumps.includes('lunch') && T.priority !== 'P1' && !seen.has('l')) { seen.add('l'); ded.push([5, `Booked over ${TECHS[e.tech].name}'s lunch for a ${T.priority}.`]); }
    });
  } else if (T.dispatch === false) {
    if (worked) ded.push([25, 'A technician spent time on a ticket that needed no work.']);
    else if (scheds.length) ded.push([5, 'Booked a technician for a ticket that needed none (cancelled in time).']);
    else if (t.closed) good.push('No technician time wasted.');
  }

  if (t.closed) {
    const r = t.closed.reason;
    if (T.closeAs && r !== T.closeAs) ded.push([10, `Closed as "${REASONS[r]}"; should be "${REASONS[T.closeAs]}".`]);
    else if (T.closeAs) good.push(`Closed as ${REASONS[r]}.`);
    if (!T.closeAs && !(r === 'resolved' && completed)) ded.push([20, 'Closed a ticket that still had work to do.']);
    if (r === 'resolved' && !completed) ded.push([25, 'Closed as resolved before the technician finished.']);
    if (r === 'resolved' && t.contact && !logged('client-msg', e => e.ticket === t.id && e.kind === 'resolved').length && !s.noResponseSla) ded.push([5, 'Closed without sending the client a resolution confirmation.']);
    if (r === 'declined' && !logged('client-msg', e => e.ticket === t.id && ['declined', 'update'].includes(e.kind)).length) ded.push([5, 'Never told the requester their request was declined.']);
    if (t.closed.note.length < 20) ded.push([5, 'The closing note is too thin to be useful.']);
  } else if (T.closeAs && !t.parent) {
    if (t.flags.harm) { /* the scenario's own grader covers what went wrong */ }
    else if (t.status === 'Completed') ded.push([10, 'The tech finished, but you never confirmed with the client and closed it.']);
    else if (T.closeAs !== 'resolved') ded.push([25, `Still open. It should have been closed as "${REASONS[T.closeAs]}".`]);
    else if (!completed) ded.push([10, 'Still not fixed at the end of the shift.']);
  }

  if (s.evaluate) s.evaluate(t, ded, good);
  return { score: Math.max(0, 100 - ded.reduce((x, d) => x + d[0], 0)), ded, good };
}

function kpis() {
  const ts = G.tickets.filter(t => !t.s.pre);
  const tri = ts.filter(t => t.triagedAt != null);
  const resp = G.tickets.filter(t => needsResponse(t) && !t.parent);
  const met = resp.filter(t => t.firstResponseAt != null && t.firstResponseAt - t.arrived <= respTarget(t));
  return {
    triage: tri.length ? Math.round(tri.reduce((x, t) => x + t.triagedAt - t.arrived, 0) / tri.length) : null,
    resp: resp.length ? Math.round(met.length / resp.length * 100) : null,
    missed: logged('call-missed').length,
    chasers: logged('chaser').length,
    bounces: logged('work-done', e => e.kind === 'bounce').length,
    closed: G.tickets.filter(t => t.closed || t.parent).length,
  };
}

function endShift() {
  const results = G.shift.map(s => { const t = ticket(s.id); return t ? grade(t) : { score: 0, ded: [[100, 'Never arrived: the shift ended first.']], good: [] }; });
  const final = Math.round(results.reduce((x, r) => x + r.score, 0) / results.length);
  const grade_ = final >= 90 ? 'A' : final >= 80 ? 'B' : final >= 70 ? 'C' : final >= 60 ? 'D' : 'F';
  G.report = { final, grade: grade_, results, kpi: kpis(), time: now() };
  G.phase = 'report'; G.modal = null; G.ring = null;
  const best = Number(store.get('shiftone-dispatch-best') || 0);
  if (final > best) store.set('shiftone-dispatch-best', String(final));
  render();
}

// ---------------------------------------------------------------------------
// Modal + toast
// ---------------------------------------------------------------------------
function modal(m) { G.modal = m; render(); }
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  const box = $('#toasts');
  box.appendChild(el);
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4700);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const I = {
  board: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  dispatch: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h4M13 17h4"/></svg>',
  clients: '<svg viewBox="0 0 24 24"><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M3 21h18M8 8h3M8 12h3M8 16h3"/></svg>',
  team: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2"/></svg>',
  pb: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/></svg>',
};
const CHANNEL = { email: 'Email', phone: 'Phone', alert: 'Alert', vendor: 'Vendor', carry: 'Carried over' };

function requestRender() {
  const a = document.activeElement;
  if (a && a.tagName === 'SELECT') { G.dirty = true; liveUpdate(); return; }
  render();
}

function render() {
  const app = $('#app');
  app.dataset.phase = G ? G.phase : 'start';
  G && (G.dirty = false);
  const a = document.activeElement, fid = a && a.id, s1 = a && a.selectionStart, s2 = a && a.selectionEnd;
  const mainScroll = $('#main').scrollTop, dScroll = $('.dscroll')?.scrollLeft;

  if (!G || G.phase === 'start') { $('#main').innerHTML = renderStart(); $('#topbar').innerHTML = topbarStart(); $('#sidebar').innerHTML = ''; $('#ticketpanel').innerHTML = ''; $('#modal-root').innerHTML = ''; $('#call-root').innerHTML = ''; return; }
  if (G.phase === 'report') { $('#main').innerHTML = renderReport(); $('#topbar').innerHTML = topbarStart(); $('#sidebar').innerHTML = ''; $('#ticketpanel').innerHTML = ''; $('#modal-root').innerHTML = renderModal(); $('#call-root').innerHTML = ''; return; }

  $('#topbar').innerHTML = renderTopbar();
  $('#sidebar').innerHTML = renderSidebar();
  $('#main').innerHTML = ({ board: renderBoard, dispatch: renderDispatch, clients: renderClients, team: renderTeam, pb: renderPlaybook })[G.view]();
  $('#ticketpanel').innerHTML = renderTicketPanel();
  $('#modal-root').innerHTML = renderModal();
  $('#call-root').innerHTML = renderCall();
  $('#main').scrollTop = mainScroll;
  if (dScroll != null && $('.dscroll')) $('.dscroll').scrollLeft = dScroll;
  const th = $('#thread');
  if (th) th.scrollTop = th.scrollHeight;
  // Selects aren't refocused: a focused select would hold back live updates until the user clicks away.
  if (fid && a.tagName !== 'SELECT') {
    const el = document.getElementById(fid);
    if (el) { el.focus(); try { el.setSelectionRange(s1, s2); } catch { /* not a text input */ } }
  }
}

// Cheap per-minute refresh of clocks and countdowns without rebuilding the DOM.
function liveUpdate() {
  const c = $('#clock');
  if (c) c.textContent = hm(now());
  document.querySelectorAll('[data-resp]').forEach(el => { const t = ticket(el.dataset.resp); if (t) el.outerHTML = respCell(t); });
  document.querySelectorAll('.nowline').forEach(el => { el.style.left = nowPct() + '%'; });
  const r = $('#ring-left');
  if (r && G.ring) r.textContent = `${G.ring.until - now()} min to voicemail`;
}

function topbarStart() {
  return `<a class="brand as-link" href="index.html">${logo()}<span>Shift One</span><small>Service Coordinator</small></a><div class="grow"></div>
    <nav class="top-links"><a href="index.html">Help desk mode</a><a href="index.html#pricing">Tutoring &amp; Pricing</a>${CONFIG.repoUrl ? `<a href="${esc(CONFIG.repoUrl)}" target="_blank" rel="noopener">GitHub</a>` : ''}</nav>${themeBtn()}`;
}
function urlSeed() { try { return normSeed(new URLSearchParams(location.search).get('seed')); } catch { return ''; } }
function logo() { return '<svg class="logo" viewBox="0 0 32 32"><rect x="3" y="6" width="26" height="22" rx="3"/><path d="M3 12h26M10 3v6M22 3v6M9 18h5M17 22h6"/></svg>'; }
function themeBtn() { return `<button class="icon-btn" data-act="theme" title="Toggle light/dark">${document.documentElement.dataset.theme === 'dark' ? '☀' : '☾'}</button>`; }

function renderTopbar() {
  const k = kpis(), open = G.tickets.filter(isOpen);
  const speeds = SPEED_LABEL.map((l, i) => (i === 0 && G.mode !== 'practice') ? '' : `<button class="${G.speed === i ? 'on' : ''}" data-act="speed" data-s="${i}" title="${i ? `${SPEEDS[i]} sim min per second` : 'Pause'}">${l}</button>`).join('');
  return `<div class="brand">${logo()}<span>Shift One</span><small>${G.mode === 'practice' ? 'Practice' : 'Timed shift'} · shift ${esc(G.seed)}</small></div>
    <div class="stats">
      <div><small>Thursday</small><b id="clock">${hm(now())}</b></div>
      <div><small>Open</small><b>${open.length}</b></div>
      <div><small>Untriaged</small><b class="${open.some(t => !t.triage) ? 'warn-t' : ''}">${open.filter(t => !t.triage).length}</b></div>
      <div><small>Resp. SLA</small><b>${k.resp ?? '–'}${k.resp != null ? '%' : ''}</b></div>
      ${k.missed ? `<div class="pen"><small>Missed calls</small><b>${k.missed}</b></div>` : ''}
    </div>
    <div class="grow"></div>
    <div class="seg speed" aria-label="Simulation speed">${speeds}</div>
    ${themeBtn()}
    <button class="btn" data-act="endShift">End shift</button>`;
}

function renderSidebar() {
  const open = G.tickets.filter(isOpen);
  const needs = open.filter(t => needsScheduling(t)).length;
  const nav = [['board', 'Service Board', open.length], ['dispatch', 'Dispatch Board', needs], ['clients', 'Clients'], ['team', 'Team', Object.values(G.techs).some(x => x.sickAt != null) ? '!' : ''], ['pb', 'Playbook']];
  return nav.map(([v, label, badge]) => `<button class="nav ${G.view === v ? 'on' : ''}" data-act="view" data-v="${v}">${I[v]}<span>${label}</span>${badge ? `<em class="${v === 'team' ? 'warn' : ''}">${badge}</em>` : ''}</button>`).join('') +
    `<div class="sidebar-foot"><div class="muted small">Northbound IT<br>Service coordination</div></div>`;
}

const prioBadge = p => p ? `<span class="prio p-${{ P1: 'critical', P2: 'high', P3: 'medium', P4: 'low' }[p]}">${p}</span>` : '<span class="prio p-new">New</span>';
const statusBadge = s => `<span class="status s-${s.toLowerCase().replace(/[^a-z]+/g, '-')}">${esc(s)}</span>`;
const chan = c => `<span class="chan c-${c}">${CHANNEL[c]}</span>`;

function respCell(t) {
  if (!needsResponse(t) || t.parent) return '<span class="muted" data-resp="' + t.id + '">–</span>';
  if (t.firstResponseAt != null) return `<span class="ok-t" data-resp="${t.id}">✓ ${Math.max(0, t.firstResponseAt - t.arrived)}m</span>`;
  if (t.closed) return '<span class="bad-t" data-resp="' + t.id + '">none</span>';
  const age = now() - t.arrived;
  if (!t.triage) return `<span class="sla ${age > 15 ? 'soon' : ''}" data-resp="${t.id}" title="Waiting for a first response">${age}m</span>`;
  const left = t.arrived + SLA[client(t).sla][t.triage.priority] - now();
  return `<span class="sla ${left < 0 ? 'breach' : left < 10 ? 'soon' : ''}" data-resp="${t.id}" title="Minutes left to respond">${left}m</span>`;
}

function needsScheduling(t) {
  if (!isOpen(t) || !t.triage) return false;
  if (['Waiting on approval', 'Approval declined', 'Completed', 'Waiting on vendor'].includes(t.status)) return false;
  const a = finalAppt(t);
  if (!a || a.state === 'missed' || a.state === 'done') return true;
  const sick = G.techs[a.tech].sickAt;
  return a.state === 'booked' && sick != null && a.start >= sick;
}

function banners() {
  const out = [];
  for (const [id, st] of Object.entries(G.techs)) {
    if (st.sickAt == null) continue;
    const left = G.appts.filter(a => a.tech === id && a.state === 'booked' && a.start >= st.sickAt);
    if (left.length) out.push(`<div class="alert crit">${esc(TECHS[id].name)} went home sick at ${hm(st.sickAt)}. ${left.length} appointment${left.length > 1 ? 's are' : ' is'} still on their calendar: ${left.map(a => '#' + a.ticket).join(', ')}.</div>`);
  }
  const done = G.tickets.filter(t => isOpen(t) && t.status === 'Completed');
  if (done.length) out.push(`<div class="alert info">Completed by technicians, waiting for you to confirm and close: ${done.map(t => '#' + t.id).join(', ')}.</div>`);
  const back = G.tickets.filter(t => isOpen(t) && t.status === 'Needs reassign');
  if (back.length) out.push(`<div class="alert warn">Handed back to dispatch: ${back.map(t => '#' + t.id).join(', ')}.</div>`);
  return out.length ? `<div class="alerts banners">${out.join('')}</div>` : '';
}

function renderBoard() {
  const f = G.filter;
  const list = G.tickets.filter(t => f === 'all' ? true : f === 'triage' ? isOpen(t) && !t.triage : f === 'open' ? isOpen(t) : f === 'done' ? isOpen(t) && t.status === 'Completed' : !isOpen(t))
    .sort((a, b) => (!isOpen(a) - !isOpen(b)) || (a.triage ? PRIORITIES.indexOf(a.triage.priority) + 1 : 0) - (b.triage ? PRIORITIES.indexOf(b.triage.priority) + 1 : 0) || a.arrived - b.arrived);
  const counts = { triage: G.tickets.filter(t => isOpen(t) && !t.triage).length, done: G.tickets.filter(t => isOpen(t) && t.status === 'Completed').length };
  return `<div class="view-head"><h2>Service Board</h2>
      <div class="seg">${[['triage', 'Needs triage'], ['open', 'Open'], ['done', 'Ready to close'], ['closed', 'Closed'], ['all', 'All']].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l}${counts[k] ? ` <em>${counts[k]}</em>` : ''}</button>`).join('')}</div></div>
    <p class="hint">You don't fix tickets here. You triage them, keep clients informed, and put the right technician on each one at the right time. Technicians do the work, and what happens depends on who you sent.</p>
    ${banners()}
    <div class="card"><table class="tbl clickable board-tbl">
      <thead><tr><th>Priority</th><th>Ticket</th><th>Client</th><th>Status</th><th>Technician</th><th title="First response">Resp.</th></tr></thead>
      <tbody>${list.map(t => { const a = finalAppt(t); return `<tr class="${G.active === t.id ? 'sel' : ''} ${t.unread && isOpen(t) ? 'unread' : ''}" data-act="open" data-id="${t.id}">
        <td>${prioBadge(t.triage?.priority)}</td>
        <td><div class="tid">#${t.id} ${chan(t.channel)}</div><div class="ttl">${esc(t.title)}</div></td>
        <td>${esc(client(t).name)}</td>
        <td class="nowrap">${statusBadge(t.status)}</td>
        <td class="nowrap">${a && !['cancelled'].includes(a.state) ? `${esc(TECHS[a.tech].name.split(' ')[0])} <span class="muted small">${hm(a.start)}</span>` : '<span class="muted">–</span>'}</td>
        <td>${respCell(t)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Nothing here.</td></tr>'}
      </tbody></table></div>`;
}

const nowPct = () => Math.max(0, Math.min(100, (now() - SHIFT_START) / (SHIFT_END - SHIFT_START) * 100));

function renderDispatch() {
  const day = G.day, t = ticket(G.pick), span = SHIFT_END - SHIFT_START;
  const pos = (s, d) => `left:${(s - day - SHIFT_START) / span * 100}%;width:${d / span * 100}%`;
  const slots = [];
  for (let m = SHIFT_START; m < SHIFT_END; m += SLOT) slots.push(day + m);
  const pastEdge = Math.floor(now() / SLOT) * SLOT;
  const rows = Object.entries(TECHS).map(([id, x]) => {
    const [cls, label] = techStatus(id, day ? day + SHIFT_START : now());
    const sick = G.techs[id].sickAt;
    const cells = slots.map(m => {
      const off = m < day + x.start || m >= day + x.end || (sick != null && m >= sick), past = m < pastEdge;
      return `<button class="cell ${off ? 'off' : past ? 'past' : ''} ${m % 60 === 0 ? 'hr' : ''}" data-act="slot" data-tech="${id}" data-m="${m}" ${off || past ? 'disabled' : ''} aria-label="${esc(x.name)} ${hm(m)}"></button>`;
    }).join('');
    const blocks = G.blocks.filter(b => b.tech === id && b.start >= day && b.start < day + DAY)
      .map(b => `<div class="blk k-${b.kind}" style="${pos(b.start, b.dur)}" title="${esc(b.label)} · ${hm(b.start)}–${hm(b.start + b.dur)}"><span>${esc(b.label)}</span></div>`).join('');
    const appts = G.appts.filter(a => a.tech === id && a.start >= day && a.start < day + DAY && a.state !== 'cancelled').map(a => {
      const tk = ticket(a.ticket), bad = a.state === 'missed' || (a.state === 'booked' && sick != null && a.start >= sick);
      return (a.onsite ? `<div class="blk k-travel" style="${pos(a.start - TRAVEL_MIN, TRAVEL_MIN)}" title="Travel"><span>Travel</span></div>` : '') +
        `<button class="appt s-${a.state} ${bad ? 'conflict' : ''} ${tk.id === G.active ? 'sel' : ''}" style="${pos(a.start, a.dur)}" data-act="appt" data-a="${a.id}" title="#${tk.id} ${esc(tk.title)} · ${hm(a.start)}–${hm((a.start + a.dur) % DAY)}">
          <b>#${tk.id}</b> <span>${esc(client(tk).name)}</span></button>`;
    }).join('');
    return `<div class="drow"><div class="dtech"><b>${esc(x.name)}</b><div class="muted small">${esc(x.role)}</div><div class="small"><span class="dot ${cls}"></span>${esc(label)}</div>
        <div class="skills">${x.skills.map(s => `<span class="sk ${t && t.triage?.skill === s ? 'hit' : ''}">${s}</span>`).join('')}</div></div>
      <div class="dtrack">${cells}${blocks}${appts}${!day ? `<div class="nowline" style="left:${nowPct()}%"></div>` : ''}</div></div>`;
  }).join('');
  const hours = [];
  for (let m = SHIFT_START; m < SHIFT_END; m += 60) hours.push(`<span style="left:${(m - SHIFT_START) / span * 100}%">${hm(m)}</span>`);
  const waiting = G.tickets.filter(needsScheduling);
  return `<div class="view-head"><h2>Dispatch Board</h2>
      <div class="seg">${[[0, 'Today (Thu)'], [DAY, 'Tomorrow (Fri)']].map(([d, l]) => `<button class="${G.day === d ? 'on' : ''}" data-act="day" data-d="${d}">${l}</button>`).join('')}</div></div>
    ${t ? `<div class="picking"><div><b>Scheduling #${t.id}</b> · ${esc(t.title)}<div class="muted small">${esc(client(t).name)}${t.triage ? ` · ${t.triage.priority} · needs ${esc(t.triage.skill)} · ${t.triage.onsite ? 'onsite' : 'remote'} · ${mins(t.triage.est)}` : ' · not triaged yet'}. Click a free slot on the board.</div></div><button class="btn sm" data-act="unpick">Cancel</button></div>`
      : `<p class="hint">Pick a ticket below (or press "Schedule" on a ticket), then click a free slot. Grey hatching is outside working hours. Soft blocks (lunch, meetings, projects) can be bumped at a cost; jobs and travel can't.</p>`}
    ${banners()}
    <div class="card dscroll"><div class="dboard">
      <div class="drow dhead"><div class="dtech"></div><div class="dtrack hours">${hours.join('')}</div></div>
      ${rows}</div></div>
    <div class="legend muted small"><span><i class="swatch k-ticket"></i>Ticket</span><span><i class="swatch k-lunch"></i>Lunch</span><span><i class="swatch k-meeting"></i>Meeting / project</span><span><i class="swatch k-travel"></i>Travel</span><span><i class="swatch k-job"></i>Existing job</span><span><i class="swatch k-conflict"></i>Conflict</span></div>
    <h4>Needs scheduling (${waiting.length})</h4>
    <div class="card">${waiting.length ? `<table class="tbl"><tbody>${waiting.map(w => `<tr class="${G.pick === w.id ? 'sel' : ''}"><td>${prioBadge(w.triage.priority)}</td><td><div class="tid">#${w.id}</div><div class="ttl">${esc(w.title)}</div></td><td>${esc(client(w).name)}</td><td class="small">${esc(w.triage.skill)} · ${w.triage.onsite ? 'onsite' : 'remote'} · ${mins(w.triage.est)}</td><td class="right"><button class="btn sm ${G.pick === w.id ? 'primary' : ''}" data-act="pick" data-id="${w.id}">${G.pick === w.id ? 'Picked' : 'Pick'}</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty muted pad">Nothing waiting. Tickets appear here once they\'re triaged and need a technician.</div>'}</div>`;
}

function renderTicketPanel() {
  const t = ticket(G.active);
  if (!t) return `<div class="panel-empty">${I.board}<p>Select a ticket from the Service Board.</p></div>`;
  t.unread = false;
  const c = client(t), ct = contactOf(t), a = finalAppt(t), open = isOpen(t);
  const unknown = t.s.from && t.s.from.includes('<');
  const name = t.s.from || (ct ? ct.name : 'RMM monitoring');
  const direct = ct && !t.s.from;
  const chips = unknown ? '<span class="ext">UNKNOWN SENDER</span>' : direct ? `${ct.vip ? '<span class="chip warn">VIP</span>' : ''}${ct.auth ? '<span class="chip ok">✓ Authorized</span>' : '<span class="chip muted">Not an approver</span>'}` : '';
  const role = unknown ? 'No matching contact in the PSA' : direct ? ct.role : t.channel === 'alert' ? 'Automated alert' : 'External';
  return `<div class="tp-head">
      <div class="row">${prioBadge(t.triage?.priority)}<span class="tid">#${t.id}</span>${statusBadge(t.status)}${chan(t.channel)}<div class="grow"></div>${open && needsResponse(t) ? `<span class="muted small">Resp.</span> ${respCell(t)}` : ''}</div>
      <h3>${esc(t.title)}</h3>
      <div class="requester" data-act="gotoClient" data-c="${t.client}" title="Open client notes">
        <div class="avatar">${esc(name.replace(/^Dr\. /, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</div>
        <div><b>${esc(name)}</b> ${chips}<div class="muted small">${esc(role)} · ${esc(c.name)} · ${esc(c.agreement)}</div></div>
      </div>
      <div class="appt-line">${a && a.state !== 'cancelled' ? `${I.dispatch}<span><b>${esc(TECHS[a.tech].name)}</b> · ${hm(a.start)}–${hm((a.start + a.dur) % DAY)} · ${a.onsite ? 'onsite' : 'remote'} <span class="muted">(${a.state})</span></span>` : `${I.dispatch}<span class="muted">No technician booked</span>`}
        <div class="grow"></div>
        ${open ? `<button class="btn sm ${needsScheduling(t) ? 'primary' : ''}" data-act="pick" data-id="${t.id}">Schedule</button>${a && a.state === 'booked' ? '<button class="btn sm ghost" data-act="unschedule">Unbook</button>' : ''}` : ''}</div>
    </div>
    <div class="thread" id="thread">${t.thread.map(renderMsg.bind(null, t)).join('')}</div>
    ${open ? renderActions(t) : `<div class="tp-actions"><p class="muted small">${t.parent ? `Merged into <button class="kb-link" data-act="open" data-id="${t.parent}">#${t.parent}</button>.` : `Closed at ${hm(t.closed.at)} as <b>${REASONS[t.closed.reason]}</b>.`} You'll see how it was graded in the shift report.</p></div>`}`;
}

function renderMsg(t, m) {
  if (m.kind === 'system') return `<div class="msg sys"><div class="bubble">${esc(m.text)}</div></div>`;
  const internal = ['tech', 'internal'].includes(m.kind);
  return `<div class="msg ${m.kind === 'me' ? 'me' : ''} ${internal ? 'int' : ''} ${m.kind === 'alert' ? 'alertmsg' : ''}">
    <div class="from">${esc(m.label || who(t, m.from))}${internal ? ' <span class="tag">Internal</span>' : ''} <span class="muted">· ${hm(m.at)}</span></div>
    <div class="bubble">${esc(m.text)}</div></div>`;
}

function section(t, key, title, body, openDefault) {
  const k = `open-${key}-${t.id}`, open = G.drafts[k] ?? openDefault;
  return `<details class="close-box" data-k="${k}" ${open ? 'open' : ''}><summary>${title}</summary>${body}</details>`;
}

function renderActions(t) {
  const c = client(t), d = k => G.drafts[`tri-${t.id}-${k}`];
  if (d('board') === undefined) {
    const tr = t.triage || {};
    Object.assign(G.drafts, { [`tri-${t.id}-board`]: tr.board || '', [`tri-${t.id}-imp`]: '', [`tri-${t.id}-urg`]: '', [`tri-${t.id}-pri`]: tr.priority || '', [`tri-${t.id}-skill`]: tr.skill || '', [`tri-${t.id}-where`]: tr.onsite == null ? '' : tr.onsite ? 'onsite' : 'remote', [`tri-${t.id}-est`]: tr.est ? String(tr.est) : '' });
  }
  const sel = (k, opts, ph, live) => `<select id="d-tri-${t.id}-${k}" data-draft="tri-${t.id}-${k}" ${live ? 'data-live="1"' : ''}><option value="">${ph}</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(d(k)) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const opt = xs => xs.map(x => [x, x]);
  const triage = `<div class="grid2">
      <label class="field"><span>Impact</span>${sel('imp', IMPACTS.map((x, i) => [i, x]), 'Choose…', true)}</label>
      <label class="field"><span>Urgency</span>${sel('urg', URGENCIES.map((x, i) => [i, x]), 'Choose…', true)}</label>
      <label class="field"><span>Priority${MATRIX[d('imp')]?.[d('urg')] ? ` <em class="muted">(matrix: ${MATRIX[d('imp')][d('urg')]})</em>` : ''}</span>${sel('pri', opt(PRIORITIES), 'Choose…')}</label>
      <label class="field"><span>Board</span>${sel('board', opt(BOARDS), 'Choose…')}</label>
      <label class="field"><span>Skill needed</span>${sel('skill', opt(SKILLS), 'Choose…')}</label>
      <label class="field"><span>Work type</span>${sel('where', [['remote', 'Remote'], ['onsite', 'Onsite visit']], 'Choose…')}</label>
      <label class="field"><span>Estimate</span>${sel('est', ESTIMATES.map(x => [x, mins(x)]), 'Choose…')}</label>
    </div><button class="btn primary sm" data-act="triage">${t.triage ? 'Update triage' : 'Save triage'}</button>`;

  const tpl = G.drafts['tpl-' + t.id] || 'ack';
  const ct = contactOf(t);
  const msg = t.contact ? section(t, 'msg', `Message ${esc(greet(ct))}`, `<label class="field"><span>Template</span><select id="d-tpl-${t.id}" data-draft="tpl-${t.id}" data-live="1">${Object.entries(TEMPLATES).map(([k, x]) => `<option value="${k}" ${tpl === k ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
      <div class="preview">${TEMPLATES[tpl].need && TEMPLATES[tpl].need(t) ? `<span class="muted">${esc(TEMPLATES[tpl].need(t))}</span>` : esc(TEMPLATES[tpl].text(t, ct))}</div>
      <button class="btn sm primary" data-act="send">Send to ${esc(ct.name)}</button>`, false) : '';

  const others = G.tickets.filter(x => x !== t && isOpen(x) && x.client === t.client && !G.tickets.some(y => y.parent === t.id));
  const coord = section(t, 'coord', 'Approvals, escalations &amp; vendors', `
      <label class="field"><span>Request approval from</span><div class="reply"><select id="d-appr-${t.id}" data-draft="appr-${t.id}"><option value="">Choose a contact…</option>${Object.entries(c.contacts).map(([k, x]) => `<option value="${k}" ${G.drafts['appr-' + t.id] === k ? 'selected' : ''}>${esc(x.name)} · ${esc(x.role)}${x.auth ? ' ✓' : ''}</option>`).join('')}</select><button class="btn sm" data-act="approval">Ask</button></div></label>
      <div class="btn-grid"><button class="btn sm" data-act="notify" data-w="sm">Notify Service Manager</button><button class="btn sm" data-act="notify" data-w="am">Escalate to Account Manager</button></div>
      <label class="field"><span>Log vendor case</span><div class="reply"><select id="d-vendor-${t.id}" data-draft="vendor-${t.id}"><option value="">Choose a vendor…</option>${c.vendors.map(v => `<option ${G.drafts['vendor-' + t.id] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select><button class="btn sm" data-act="vendor">Log</button></div></label>
      ${others.length ? `<label class="field"><span>Merge into (duplicate of)</span><div class="reply"><select id="d-merge-${t.id}" data-draft="merge-${t.id}"><option value="">Choose the parent ticket…</option>${others.map(x => `<option value="${x.id}" ${G.drafts['merge-' + t.id] === x.id ? 'selected' : ''}>#${x.id} ${esc(x.title)}</option>`).join('')}</select><button class="btn sm" data-act="merge">Merge</button></div></label>` : ''}`, false);

  const close = section(t, 'close', 'Close ticket', `
      <label class="field"><span>Reason</span><select id="d-reason-${t.id}" data-draft="reason-${t.id}"><option value="">Choose…</option>${Object.entries(REASONS).map(([k, l]) => `<option value="${k}" ${G.drafts['reason-' + t.id] === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Closing note</span><textarea id="d-cnote-${t.id}" data-draft="cnote-${t.id}" rows="2" placeholder="What happened, and why it's closed">${esc(G.drafts['cnote-' + t.id] || '')}</textarea></label>
      <button class="btn primary sm" data-act="close">Close ticket</button>`, false);

  const pb = PLAYBOOK.find(p => p.id === t.s.kb);
  return `<div class="tp-actions">
    ${section(t, 'tri', t.triage ? `Triage <span class="muted small">· ${t.triage.priority} · ${esc(t.triage.board)}</span>` : 'Triage', triage, !t.triage)}
    ${msg}${coord}${close}
    ${pb ? `<button class="kb-link" data-act="gotoPb" data-k="${pb.id}">${I.pb} Playbook: ${pb.id} ${esc(pb.title)}</button>` : ''}
  </div>`;
}

function renderCall() {
  const r = G.ring;
  if (!r) return '';
  const c = CLIENTS[r.s.client], ct = c.contacts[r.s.contact];
  return `<div class="callbox" role="alertdialog" aria-label="Incoming call"><div class="ringer">${I.phone}</div>
    <div class="grow"><small>Incoming call${G.calls.length ? ` · ${G.calls.length} waiting` : ''}</small><b>${esc(ct.name)}</b><div class="muted small">${esc(ct.role)} · ${esc(c.name)}</div><div class="small" id="ring-left">${r.until - now()} min to voicemail</div></div>
    <button class="btn primary" data-act="answer">Answer</button></div>`;
}

function renderClients() {
  const c = CLIENTS[G.client];
  const blk = c.block != null ? G.block[G.client] : null;
  return `<div class="view-head"><h2>Clients</h2><span class="muted">${Object.keys(CLIENTS).length} companies</span></div>
    <div class="split card"><div class="list">${Object.entries(CLIENTS).map(([k, x]) => `<button class="li ${k === G.client ? 'on' : ''}" data-act="client" data-c="${k}"><b>${esc(x.name)}</b><div class="muted small">${esc(x.agreement)}</div></button>`).join('')}</div>
    <div class="detail"><div class="dir-user"><div class="avatar lg">${esc(c.name.split(' ').map(w => w[0]).join('').slice(0, 2))}</div><div><h3>${esc(c.name)}</h3><div class="muted">${esc(c.sites)}</div></div></div>
      <div class="tab-body">
        <div class="grid3"><div class="kv"><small>Agreement</small><div>${esc(c.agreement)}</div></div><div class="kv"><small>Onsite visits</small><div>${esc(c.onsiteText)}</div></div>${blk != null ? `<div class="kv"><small>Hours left in block</small><div class="${blk < 1 ? 'bad-t' : ''}">${blk} h</div></div>` : ''}</div>
        <h4>First-response targets</h4><div class="grid3">${PRIORITIES.map(p => `<div class="kv"><small>${p}</small><div>${mins(SLA[c.sla][p])}</div></div>`).join('')}</div>
        <h4>Client notes</h4><ul class="notes">${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        <h4>Contacts</h4><table class="tbl"><tbody>${Object.values(c.contacts).map(x => `<tr><td><b>${esc(x.name)}</b>${x.vip ? '<span class="chip warn">VIP</span>' : ''}<div class="muted small">${esc(x.role)}</div></td><td class="right">${x.auth ? '<span class="chip ok">✓ Authorized</span>' : '<span class="chip muted">Not an approver</span>'}</td></tr>`).join('')}</tbody></table>
        <h4>Vendors</h4><p>${c.vendors.map(esc).join(' · ')}</p>
      </div></div></div>`;
}

function renderTeam() {
  return `<div class="view-head"><h2>Team</h2><span class="muted">Northbound IT · ${Object.keys(TECHS).length} technicians</span></div>
    ${G.news.map(n => `<div class="alert crit">${hm(n.at)} · ${esc(n.text)}</div>`).join('')}
    <div class="team">${Object.entries(TECHS).map(([id, x]) => {
      const [cls, label] = techStatus(id), u = utilization(id);
      return `<div class="card pad tech"><div class="row"><div class="avatar">${x.name.split(' ').map(w => w[0]).join('')}</div><div class="grow"><b>${esc(x.name)}</b><div class="muted small">${esc(x.role)}</div></div><span class="small"><span class="dot ${cls}"></span>${esc(label)}</span></div>
        <div class="skills">${x.skills.map(s => `<span class="sk">${s}</span>`).join('')}${x.onsite ? '<span class="sk hit">Onsite</span>' : '<span class="sk">Remote only</span>'}</div>
        <div class="kv"><small>Hours (our time)</small><div>${hm(x.start)}–${hm(x.end)}</div></div>
        <div class="meter"><small>BOOKED</small><div><i style="width:${u}%" class="${u > 85 ? 'hi' : ''}"></i></div><span>${u}%</span></div>
        <p class="muted small">${esc(x.note)}</p></div>`;
    }).join('')}</div>
    <h4>Escalation contacts</h4><div class="card"><table class="tbl"><tbody>${Object.values(INTERNAL).map(x => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.role)}</td><td class="muted small">${x.role === 'Service Manager' ? 'P1s, security incidents, complaints' : 'Billing, block hours, out-of-scope work'}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderPlaybook() {
  const q = (G.drafts.pbq || '').toLowerCase();
  const list = PLAYBOOK.filter(k => !q || (k.title + ' ' + k.tags + ' ' + k.id).toLowerCase().includes(q));
  const a = PLAYBOOK.find(k => k.id === G.pb);
  return `<div class="view-head"><h2>Dispatch Playbook</h2><span class="muted">${PLAYBOOK.length} articles</span></div>
    <div class="split card"><div class="list"><input class="search" id="pbq" data-draft="pbq" data-live="1" placeholder="Search the playbook…" value="${esc(G.drafts.pbq || '')}">
      ${list.map(k => `<button class="li ${a && a.id === k.id ? 'on' : ''}" data-act="pb" data-k="${k.id}"><span class="muted small">${k.id}</span><div>${esc(k.title)}</div></button>`).join('')}</div>
    <div class="detail article">${a ? `<span class="muted small">${a.id}</span><h3>${esc(a.title)}</h3>${a.body}` : '<div class="panel-empty"><p>Pick an article.</p></div>'}</div></div>`;
}

function renderModal() {
  const m = G && G.modal;
  if (!m) return '';
  const body = typeof m.body === 'function' ? m.body() : m.body;
  return `<div class="overlay"><div class="modal"><h3>${esc(m.title)}</h3><div class="modal-body">${body}</div>
    <div class="row gap end">${m.noCancel ? '' : '<button class="btn" data-act="modalCancel">Cancel</button>'}<button class="btn ${m.danger ? 'danger' : 'primary'}" data-act="modalOk">${esc(m.ok || 'OK')}</button></div></div></div>`;
}

function renderStart() {
  const best = store.get('shiftone-dispatch-best');
  return `<div class="start">
    <div class="hero"><div class="kicker">MSP service coordinator training</div>
      <h1>Run the dispatch desk<br>at a managed service provider.</h1>
      <p>You're the remote service coordinator for <b>Northbound IT</b>, an MSP with five technicians and five client companies. Calls ring, alerts fire, and clients email. You triage every ticket, keep clients updated, chase approvals and vendors, and put the right technician on the right job at the right time. The technicians do the work. How it goes depends on who you sent.</p>
      <div class="row gap wrap"><button class="btn primary lg" data-act="start" data-m="shift">Start timed shift</button><button class="btn lg" data-act="start" data-m="practice">Practice mode (pausable)</button></div>
      <p class="muted small">The shift runs from 08:00 to 17:00 on a sim clock. At 1× that takes about 18 minutes; speed up when it's quiet. Every shift draws different tickets at different times.${best ? ` Best shift score: <b>${esc(best)}</b>.` : ''}</p>
      <label class="field seed-field"><span>Replay a shift (optional)</span><input id="seed-in" maxlength="24" spellcheck="false" autocomplete="off" placeholder="Shift code, e.g. classic" value="${esc(urlSeed())}"></label>
      <a class="kb-link" href="index.html">Prefer to fix tickets yourself? Play the Tier 1 help desk simulator →</a></div>
    <div class="features">
      ${[['Service Board', 'Triage by impact and urgency, pick the board and skill, and respond inside each client\'s SLA.'],
        ['Phone calls', 'Calls ring in real time. Miss one and it becomes a voicemail and an unhappy client.'],
        ['Dispatch Board', 'A live calendar of five technicians with skills, lunch, projects, travel time and a sick day.'],
        ['Clients & contracts', 'Premium, standard and block-hours clients, onsite windows, authorized approvers and VIPs.'],
        ['Approvals & vendors', 'Get sign-off from the right person, page the Service Manager, and chase the ISP for an ETA.'],
        ['Honest grading', 'Graded on what you did: time to triage, first response, right tech, client updates and closure.']]
        .map(([h, p]) => `<div class="feature"><h4>${h}</h4><p>${p}</p></div>`).join('')}
    </div>
    <footer class="site-foot">Built by ${esc(CONFIG.author)}${CONFIG.repoUrl ? ` · <a href="${esc(CONFIG.repoUrl)}" target="_blank" rel="noopener">Source on GitHub</a>` : ''} · Northbound IT and its clients are fictional.</footer></div>`;
}

function renderReport() {
  const R = G.report, k = R.kpi;
  const tile = (label, v, sub, bad) => `<div class="stat ${bad ? 'bad' : ''}"><small>${label}</small><b>${v}</b><span>${sub}</span></div>`;
  return `<div class="report">
    <div class="report-head"><div class="grade g-${R.grade}">${R.grade}</div>
      <div><h1>Shift report</h1><p class="muted">Northbound IT · Thursday 08:00–${hm(R.time)} · ${G.mode === 'practice' ? 'practice mode' : 'timed shift'} · shift <b>${esc(G.seed)}</b></p>
      <div class="big-score">${R.final}<small>/100</small></div></div>
      <div class="grow"></div><div class="col gap"><button class="btn primary lg" data-act="start" data-m="${G.mode}" data-seed="">New shift</button><button class="btn" data-act="start" data-m="${G.mode}" data-seed="${esc(G.seed)}" title="Same tickets, same times: compare your score">Replay shift ${esc(G.seed)}</button><button class="btn" data-act="home">Main menu</button></div></div>
    <div class="cards4 kpis">
      ${tile('Avg time to triage', k.triage ?? '–', 'minutes', k.triage > 15)}
      ${tile('First response in SLA', (k.resp ?? '–') + (k.resp != null ? '%' : ''), 'of tickets', k.resp != null && k.resp < 80)}
      ${tile('Missed calls', k.missed, 'went to voicemail', k.missed > 0)}
      ${tile('Client chasers', k.chasers, '"any update?"', k.chasers > 0)}
      ${tile('Wrong-tech dispatches', k.bounces, 'handed back', k.bounces > 0)}
      ${tile('Closed or merged', k.closed, `of ${G.tickets.length} tickets`)}
    </div>
    <div class="card pad"><h3>Technician utilization (today)</h3><p class="muted small">Booked ticket time as a share of each person's working day. 70–85% is healthy; nobody should be at 0% while tickets wait.</p>
      ${Object.entries(TECHS).map(([id, x]) => { const u = utilization(id); return `<div class="meter wide"><small>${esc(x.name)}</small><div><i style="width:${u}%" class="${u > 85 ? 'hi' : ''}"></i></div><span>${u}%</span></div>`; }).join('')}</div>
    <div class="card pad coach-cta"><div><b>Want someone to walk you through this report?</b><div class="muted">A tutor can replay the shift with you and turn every lost point into an interview answer.</div></div><a class="btn" href="index.html#pricing">See tutoring</a></div>
    <div class="report-grid">${G.shift.map((s, i) => {
      const r = R.results[i], t = ticket(s.id);
      return `<div class="card pad"><div class="row">${prioBadge(t?.triage?.priority)}<span class="tid">#${s.id}</span>${t ? statusBadge(t.status) : ''}<div class="grow"></div><b class="${r.score >= 80 ? 'good-t' : r.score >= 50 ? '' : 'bad-t'}">${r.score}</b></div>
        <h4>${esc(s.title)}</h4><div class="muted small">${esc(CLIENTS[s.client].name)}${s.truth.why ? ` · <i>${esc(s.truth.why)}</i>` : ''}</div>
        <ul class="fb">${r.good.map(g => `<li class="g">${esc(g)}</li>`).join('')}${r.ded.map(d => `<li class="b"><b>−${d[0]}</b> ${esc(d[1])}</li>`).join('')}</ul>
        <button class="kb-link" data-act="reportPb" data-k="${s.kb}">${I.pb} Read ${s.kb}</button></div>`;
    }).join('')}</div></div>`;
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
const ACT = {
  start: d => newGame(d.m, d.seed ?? $('#seed-in')?.value),
  home: () => { G = null; try { history.replaceState(null, '', location.pathname); } catch { /* ignore */ } render(); },
  theme: () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('shiftone-theme', r.dataset.theme); render(); },
  endShift: () => modal({ title: 'End the shift now?', body: '<p>Tickets are graded as they stand. Anything that hasn\'t arrived yet scores 0.</p>', ok: 'End shift', danger: true, onOk: () => setTimeout(endShift) }),
  speed: d => { G.speed = Number(d.s); render(); },
  view: d => { G.view = d.v; render(); },
  filter: d => { G.filter = d.f; render(); },
  open: d => { G.active = d.id; if (G.view !== 'dispatch') G.view = 'board'; render(); },
  answer: () => answerCall(),
  triage: () => saveTriage(ticket(G.active)),
  send: () => sendMessage(ticket(G.active)),
  approval: () => requestApproval(ticket(G.active)),
  notify: d => notify(ticket(G.active), d.w),
  vendor: () => vendorCase(ticket(G.active)),
  merge: () => merge(ticket(G.active)),
  close: () => closeTicket(ticket(G.active)),
  pick: d => { G.pick = d.id; G.active = d.id; G.view = 'dispatch'; const a = finalAppt(ticket(d.id)); G.day = a && a.start >= DAY ? DAY : G.day; render(); },
  unpick: () => { G.pick = null; render(); },
  unschedule: () => unschedule(ticket(G.active)),
  day: d => { G.day = Number(d.d); render(); },
  slot: d => openSchedule(d.tech, Number(d.m)),
  appt: d => {
    const a = G.appts.find(x => x.id === Number(d.a)), t = ticket(a.ticket);
    G.active = t.id;
    modal({
      title: `#${t.id} · ${t.title}`,
      body: `<p>${esc(client(t).name)}<br>${esc(TECHS[a.tech].name)} · ${hm(a.start)}–${hm((a.start + a.dur) % DAY)} · ${a.onsite ? 'onsite' : 'remote'}<br><span class="muted">Status: ${a.state}</span></p>`,
      ok: a.state === 'booked' ? 'Reschedule' : 'Close',
      onOk() { if (a.state === 'booked') { G.pick = t.id; toast('Click a new slot for this ticket.'); } },
    });
  },
  gotoClient: d => { G.view = 'clients'; G.client = d.c; render(); },
  client: d => { G.client = d.c; render(); },
  gotoPb: d => { G.view = 'pb'; G.pb = d.k; render(); },
  pb: d => { G.pb = d.k; render(); },
  reportPb: d => { const a = PLAYBOOK.find(k => k.id === d.k); modal({ title: `${a.id} · ${a.title}`, body: `<div class="article">${a.body}</div>`, ok: 'Close', noCancel: true, onOk() {} }); },
  modalOk: () => { const m = G.modal; if (m.onOk && m.onOk() === false) return render(); G.modal = null; render(); },
  modalCancel: () => { G.modal = null; render(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  if (el.tagName !== 'INPUT' && el.tagName !== 'A') e.preventDefault();
  fn(el.dataset, el, e);
});
document.addEventListener('toggle', e => {
  const k = e.target.dataset?.k;
  if (k && G) G.drafts[k] = e.target.open;
}, true);
const onDraft = e => {
  const k = e.target.dataset?.draft;
  if (k == null || !G) return;
  G.drafts[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  const m = k.match(/^tri-(.+)-(imp|urg)$/);
  if (m) {
    const i = G.drafts[`tri-${m[1]}-imp`], u = G.drafts[`tri-${m[1]}-urg`];
    if (MATRIX[i]?.[u]) G.drafts[`tri-${m[1]}-pri`] = MATRIX[i][u];
  }
  if (e.target.dataset.live && e.type === 'change' || (e.target.dataset.live && e.target.tagName === 'INPUT')) render();
  else if (G.dirty && e.type === 'change') render();
};
document.addEventListener('input', onDraft);
document.addEventListener('change', onDraft);
document.addEventListener('focusout', () => { if (G && G.dirty) setTimeout(() => { if (G?.dirty && document.activeElement?.tagName !== 'SELECT') render(); }); });
document.addEventListener('keydown', e => {
  if (!G) return;
  if (e.key === 'Escape' && G.modal && !G.modal.noCancel) ACT.modalCancel();
});

setInterval(tick, 250);

(function init() {
  const saved = store.get('shiftone-theme');
  document.documentElement.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  render();
})();
