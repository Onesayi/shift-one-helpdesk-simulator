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
// Outside the day team's 08:00–17:00 (the on-call shift's hours).
const isAfterHours = m => { const x = ((m % DAY) + DAY) % DAY; return x >= SHIFT_END || x < SHIFT_START; };

let G = null;
let PAGE = 'start';
let PREP_OPEN = false; // the interview prep page (dispatch.html#prep)

// The campaign's three legs, on one clock from Thursday 08:00 to Friday 17:00.
const CAMPAIGN_LEGS = [
  { id: 'thu', title: 'Thursday, day shift' },
  { id: 'night', title: 'Thursday night, on call' },
  { id: 'fri', title: 'Friday, day shift' },
];

function newGame(mode, seed) {
  const camp = campaignOf(normSeed(seed));
  if (camp !== undefined) seed = camp || newSeed();
  const shift = buildShift(seed), night = !!shift.night;
  const start = night ? NIGHT_START : SHIFT_START;
  G = {
    phase: 'play', mode, clock: start, speed: 1, night, start, end: night ? NIGHT_END : SHIFT_END,
    seed: camp !== undefined ? 'campaign-' + shift.seed : shift.seed, drill: shift.drill, shift: shift.tickets, events: shift.events, time: [], timeSeq: 0,
    campaign: camp !== undefined ? { leg: 0, graded: new Set(), done: [], used: new Set(shift.tickets.map(t => t.key)) } : null,
    tickets: [], log: [], seq: 0, appts: [], apptSeq: 0, blocks: baseBlocks(),
    techs: Object.fromEntries(Object.keys(TECHS).map(k => [k, { sickAt: null }])),
    block: { pp: CLIENTS.pp.block },
    view: 'board', active: null, filter: 'open', pick: null, day: 0,
    client: 'hdg', pb: 'PB-01', teamSel: null,
    timers: [], calls: [], ring: null, news: [], spawned: new Set(), eventsDone: new Set(), disrupted: {},
    drafts: {}, modal: null, dirty: false,
  };
  for (const s of G.shift.filter(x => x.at < 0)) spawnTicket(s);
  if (night) {
    // Ben went home sick on Thursday morning and is off until Monday (TEAM_EVENTS).
    G.techs.ben.sickAt = start;
    G.news.push({ at: start, text: NIGHT_BRIEF });
  }
  try { history.replaceState(null, '', '?seed=' + G.seed); } catch { /* file:// or sandboxed */ }
  onMinute(start);
  G.active = G.tickets[0]?.id ?? null;
  render();
}

const now = () => Math.floor(G.clock);
// Technicians on the board this shift: Jordan only exists on the after-hours shift.
const crew = () => Object.keys(TECHS).filter(k => !TECHS[k].night || G?.night);
// A tech's working hours [from, to) on the day of minute m. On-call hours are absolute (they cross midnight).
function hoursOf(id, m) {
  const x = TECHS[id], d = m >= DAY ? DAY : 0;
  return x.abs ? [x.start, x.end] : [d + x.start, d + x.end];
}
// When an appointment happens, in words a client would use.
const whenSaid = a => G.night && isAfterHours(a.start) && a.start < G.end ? 'tonight' : Math.floor(a.start / DAY) > Math.floor(now() / DAY) ? 'on Friday' : 'today';
const dayName = () => G.night ? 'After hours' : G.start >= DAY ? 'Friday' : 'Thursday';
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
  G.clock = Math.min(G.end, G.clock + sp * 0.25 * (G.night && !G.ring ? NIGHT_SPEED : 1));
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
    changed = teamEvent(ev, m) || changed;
  }

  for (const s of G.shift) {
    if (s.at < 0 || G.spawned.has(s.id) || m < G.start + s.at) continue;
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
      if ((sick != null && a.start >= sick) || a.atRisk) {
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

  if (m >= G.end) { if (G.drill) endShift(); else startHandover(); return true; }
  return changed;
}

// Something happens to the team or a client mid-shift (TEAM_EVENTS and DISRUPTIONS in data.js).
// Every ticket it knocks on is remembered in G.disrupted, and the grader checks the client was told.
function teamEvent(ev, m) {
  if (ev.kind === 'move') {
    const t = ticket(ev.ticket), a = t && finalAppt(t);
    if (!t || !isOpen(t) || t.status === 'Completed' || (a && ['working', 'done'].includes(a.state))) return false;
    G.disrupted[t.id] = { kind: 'move', at: m };
    post(t, ev.contact, ev.text, 'client');
    record('move-request', { ticket: t.id });
    toast(`${contactOf(t, ev.contact).name} asked to move #${t.id} to tomorrow.`, 'bad');
    return true;
  }
  let text = ev.text;
  if (ev.kind === 'out') {
    const until = m + ev.dur;
    text = text.replace('{until}', hm(until));
    G.blocks.push({ tech: ev.tech, start: m, dur: ev.dur, kind: 'out', label: ev.label, soft: false });
    for (const a of G.appts) {
      if (a.tech !== ev.tech || a.state !== 'booked' || !overlaps(m, until, ...busyRange(a))) continue;
      a.atRisk = true;
      G.disrupted[a.ticket] = { kind: 'out', at: m, tech: ev.tech };
    }
  } else G.techs[ev.tech].sickAt = ev.at;
  G.news.push({ at: m, text });
  toast(text, 'bad');
  return true;
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
  if (out.kind === 'done') {
    const a = [...G.appts].reverse().find(x => x.ticket === t.id && x.tech === techId && x.state === 'done');
    G.time.push({ id: ++G.timeSeq, ticket: t.id, tech: techId, mins: a ? a.dur : (t.triage?.est || 30), onsite: !!a?.onsite, after: !!a && isAfterHours(a.startedAt ?? a.start), at: now(), code: null });
  }
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
    text: (t, c) => { const a = finalAppt(t); return `Hi ${greet(c)}, ${TECHS[a.tech].name} will ${a.onsite ? 'be onsite' : 'connect remotely'} ${whenSaid(a)} at ${hm(a.start % DAY)} (about ${mins(a.dur)}) for ticket #${t.id}.` },
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
  if (a && a.state === 'booked') return `it's booked with ${TECHS[a.tech].name} ${whenSaid(a)} at ${hm(a.start % DAY)}.`;
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
  if (reason === 'resolved' && t.contact && !t.s.noResponseSla) later(CSAT_DELAY, () => survey(t));
  render();
}

// ---------------------------------------------------------------------------
// Client satisfaction (PB-14). Closing a ticket as resolved sends the client a 1–5 survey, and they
// answer a few minutes later. The rating follows from how the ticket was handled, not from luck.
// Anything 3 or under is a complaint: the coordinator replies to it.
// ---------------------------------------------------------------------------
const CSAT_DELAY = 5;      // sim minutes from closing to the client's answer
const CSAT_LOW = 3;        // this rating or lower needs a follow-up
const CSAT_GRACE = 30;     // a survey that lands this close to the end of the shift isn't graded on follow-up

// What the client noticed, worst first. Each reason costs a star; being chased twice costs two.
function csatFor(t) {
  const T = t.s.truth, why = [];
  let lost = 0;
  const say = (text, n = 1) => { why.push(text); lost += n; };
  if (logged('premature', e => e.ticket === t.id).length) say('I was told it was fixed when it wasn\'t.');
  if (t.chasers) say(t.chasers > 1 ? 'I had to chase you more than once for an update.' : 'I had to chase you for an update.', Math.min(2, t.chasers));
  if (t.missedCall) say('My call went to voicemail.');
  if (needsResponse(t) && (t.firstResponseAt == null || t.firstResponseAt - t.arrived > respTarget(t))) say('It took a while for anyone to get back to me.');
  const hit = G.disrupted[t.id];
  if (hit && !logged('client-msg', e => e.ticket === t.id && e.at >= hit.at && ['update', 'sched'].includes(e.kind)).length) say('Nobody told me the appointment had changed.');
  const a = finalAppt(t);
  if (a && T.startBy && a.start > T.startBy) say('It took longer to sort out than it should have.');
  if (!logged('client-msg', e => e.ticket === t.id && e.kind === 'resolved').length) say('Nobody told me it was done. I found out by trying it myself.');
  const rating = Math.max(1, 5 - lost);
  const comment = rating === 5 ? 'Quick, and you kept me in the loop the whole way. Thank you!'
    : rating === 4 ? `Sorted in the end, thanks. ${why[0]}`
    : `Not a great experience. ${why.join(' ')}`;
  return { rating, why, comment };
}

const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

function survey(t) {
  const c = contactOf(t), r = csatFor(t);
  t.csat = Object.assign({ at: now(), followed: null }, r);
  record('csat', { ticket: t.id, rating: r.rating });
  post(t, t.contact, `${stars(r.rating)} ${r.rating}/5. ${r.comment}`, 'client', `${c.name} (satisfaction survey)`);
  toast(`${c.name} rated #${t.id} ${r.rating}/5.`, r.rating <= CSAT_LOW ? 'bad' : 'good');
}

function followUpCsat(t) {
  if (!t.csat || t.csat.rating > CSAT_LOW || t.csat.followed != null) return;
  const c = contactOf(t);
  t.csat.followed = now();
  record('csat-follow', { ticket: t.id });
  post(t, 'me', `Hi ${greet(c)}, thank you for the honest feedback on #${t.id}, and I'm sorry we fell short. ${t.csat.why[0]} That shouldn't have happened. I've shared this with our Service Manager, Dana Whitaker, so we can fix how it went wrong. If anything still isn't right, reply here and I'll pick it up straight away.`, 'me');
  later(3, () => post(t, t.contact, 'Thanks for coming back to me. I appreciate it.', 'client'));
  toast(`Followed up with ${c.name}.`, 'good');
  render();
}

// Time entries (PB-12). Each finished job leaves one; the coordinator codes it before closing.
const BILL = { covered: 'Covered by agreement', billable: 'Billable', block: 'Block hours' };

function billingFor(t, e) {
  const c = client(t), T = t.s.truth;
  if (c.block != null) return { code: 'block', why: `${c.name} buys prepaid blocks, so every minute comes off the block.` };
  if ([].concat(T.board)[0] === 'Projects & Onboarding') return { code: 'billable', why: 'Project and onboarding work is billed separately, even on a managed agreement.' };
  if (c.sla === 'standard' && e.onsite) return { code: 'billable', why: `${c.name}'s standard agreement covers remote support only. Onsite visits are billed.` };
  if (c.sla === 'standard' && e.after) return { code: 'billable', why: `${c.name}'s standard agreement covers business hours. After-hours call-outs are billed at the after-hours rate (PB-13).` };
  return { code: 'covered', why: `${c.name}'s ${c.agreement.toLowerCase()} agreement covers this work.` };
}

function postTime(t) {
  const open = G.time.filter(e => e.ticket === t.id && !e.code);
  const ready = open.filter(e => BILL[G.drafts['bill-' + e.id]]);
  if (!ready.length) return toast('Choose a billing code for the time entry.', 'bad');
  for (const e of ready) {
    e.code = G.drafts['bill-' + e.id];
    record('time-code', { ticket: t.id, entry: e.id, code: e.code });
    if (e.code === 'block' && G.block[t.client] != null) G.block[t.client] = Math.round((G.block[t.client] - e.mins / 60) * 100) / 100;
    post(t, 'system', `Time entry posted: ${TECHS[e.tech].name}, ${mins(e.mins)}, ${BILL[e.code]}.`, 'system');
  }
  toast(`Posted ${ready.length} time entr${ready.length > 1 ? 'ies' : 'y'} on #${t.id}.`, 'good');
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
  const from = onsite ? start - TRAVEL_MIN : start, to = start + dur;
  const sick = G.techs[techId].sickAt;
  if (sick != null && to > sick) R.errors.push(`${tech.name} has gone home sick.`);
  if (start < Math.floor(now() / SLOT) * SLOT) R.errors.push('That time has already passed.');
  const [h0, h1] = hoursOf(techId, start);
  if (from < h0 || to > h1) R.errors.push(`${tech.name} works ${hm(tech.start)}–${hm(tech.end)}${onsite ? ', and the visit needs 30 min of travel first' : ''}.`);
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
  if (onsite && !inWindow(c, { start, dur }) && !(G.night && isAfterHours(start))) R.warns.push(`${c.name} allows visits ${c.onsiteText}.`);
  if (G.night && tech.night) R.warns.push(`This wakes ${tech.name.split(' ')[0]} up. Tonight is for P1s, and P2s on premium agreements (PB-13).`);
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
      if (G.night) for (let m = G.start; m < DAY + SHIFT_END; m += SLOT) slots.push(m);
      else for (let m = day + SHIFT_START; m < day + SHIFT_END; m += SLOT) slots.push(m);
      return `<p><b>${esc(t.title)}</b><br><span class="muted small">${esc(client(t).name)}${t.triage ? ` · ${t.triage.priority} · ${esc(t.triage.skill)}` : ''}</span></p>
        <div class="grid2">
          <label class="field"><span>Technician</span><select id="d-sc-tech" data-draft="sc-tech" data-live="1">${crew().map(k => `<option value="${k}" ${k === tid ? 'selected' : ''}>${esc(TECHS[k].name)}</option>`).join('')}</select></label>
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
  const st = G.techs[id], [h0, h1] = hoursOf(id, m);
  if (st.sickAt != null && m >= st.sickAt) return ['bad', 'Out sick'];
  if (m < h0 || m >= h1) return ['muted', 'Off shift'];
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
  if (x.abs) return Math.min(100, Math.round(G.appts.filter(a => a.tech === id && a.start >= x.start && a.start < x.end && !['cancelled', 'missed'].includes(a.state)).reduce((s, a) => s + a.dur, 0) / (x.end - x.start) * 100));
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
      else if (a.atRisk && ['booked', 'missed'].includes(a.state)) ded.push([30, `Still booked with ${x.name} while they were off the board. Nobody turned up.`]);
      else if (T.tonight && a.start >= NIGHT_END) ded.push([20, `Left for the day team at ${hm(a.start)}. This couldn't wait: it needed Jordan tonight, by ${hm(T.startBy)} (PB-13).`]);
      else if (T.startBy && a.start > T.startBy) ded.push([10, `Booked for ${hm(a.start)}. It needed to start by ${hm(T.startBy)}.`]);
      else if (!wrong.has(a.tech)) good.push(`Booked ${x.name} for ${hm(a.start)}: right skills, in time.`);
      if (T.tonight === false) {
        const call = scheds.find(e => TECHS[e.tech].night);
        if (call) ded.push([15, `Woke ${TECHS[call.tech].name} at ${hm(call.at)} for a ${T.priority} that could wait for the day team (PB-13).`]);
        else if (a.start >= NIGHT_END) good.push('Left it for the day team, so nobody was woken up for it.');
      }
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

  const hit = G.disrupted[t.id];
  if (hit && !t.parent) {
    if (hit.kind === 'move' && a && a.start < DAY) ded.push([15, `${greet(contactOf(t))} asked to move this to tomorrow, but it stayed booked for today.`]);
    else if (hit.kind === 'move' && a) good.push('Moved the appointment to tomorrow, as the client asked.');
    if (t.contact && logged('client-msg', e => e.ticket === t.id && e.at >= hit.at && ['update', 'sched'].includes(e.kind)).length) good.push(`Told ${greet(contactOf(t))} about the new appointment.`);
    else if (t.contact) ded.push([10, hit.kind === 'move' ? `Never confirmed the new time with ${greet(contactOf(t))}.` : `${TECHS[hit.tech].name.split(' ')[0]} was off the board at ${hm(hit.at)}, and ${greet(contactOf(t))} never heard the appointment had moved.`]);
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

  for (const e of G.time.filter(e => e.ticket === t.id)) {
    const want = billingFor(t, e), who = `${TECHS[e.tech].name.split(' ')[0]}'s ${mins(e.mins)}`;
    if (!e.code) ded.push([5, `${who} time entry was never coded, so it can't be invoiced or reported.`]);
    else if (e.code !== want.code) ded.push([10, `${who} was coded "${BILL[e.code]}"; it should be "${BILL[want.code]}". ${want.why}`]);
    else good.push(`Time coded as ${BILL[e.code]}.`);
  }

  if (t.csat) {
    const r = t.csat, who = greet(contactOf(t));
    if (r.rating > CSAT_LOW) good.push(`${who} rated it ${r.rating}/5.`);
    else if (r.followed != null) good.push(`${who} rated it ${r.rating}/5, and you followed up ${r.followed - r.at <= 30 ? 'quickly' : `after ${mins(r.followed - r.at)}`}.`);
    else if (now() - r.at >= CSAT_GRACE) ded.push([10, `${who} rated it ${r.rating}/5 and nobody replied. A low score is a complaint: apologise and say what happens next (PB-14).`]);
  }

  if (s.evaluate) s.evaluate(t, ded, good);
  return { score: Math.max(0, 100 - ded.reduce((x, d) => x + d[0], 0)), ded, good };
}

function kpis() {
  // Only this shift's tickets (in a campaign, the ones that arrived during this leg).
  const ids = new Set(G.shift.map(s => s.id)), mine = e => ids.has(e.ticket);
  const tks = G.tickets.filter(t => ids.has(t.id)), time = G.time.filter(mine);
  const ts = tks.filter(t => !t.s.pre);
  const tri = ts.filter(t => t.triagedAt != null);
  const resp = tks.filter(t => needsResponse(t) && !t.parent);
  const met = resp.filter(t => t.firstResponseAt != null && t.firstResponseAt - t.arrived <= respTarget(t));
  return {
    triage: tri.length ? Math.round(tri.reduce((x, t) => x + t.triagedAt - t.arrived, 0) / tri.length) : null,
    resp: resp.length ? Math.round(met.length / resp.length * 100) : null,
    missed: logged('call-missed', mine).length,
    chasers: logged('chaser', mine).length,
    bounces: logged('work-done', e => mine(e) && e.kind === 'bounce').length,
    closed: tks.filter(t => t.closed || t.parent).length, total: tks.length,
    csat: (() => { const rs = tks.filter(t => t.csat); return rs.length ? Math.round(rs.filter(t => t.csat.rating >= 4).length / rs.length * 100) : null; })(),
    billing: time.length ? Math.round(time.filter(e => e.code && e.code === billingFor(ticket(e.ticket), e).code).length / time.length * 100) : null,
  };
}

// ---------------------------------------------------------------------------
// Shift handover (PB-11): at the end of the shift the coordinator briefs the on-call engineer.
// ---------------------------------------------------------------------------
function startHandover() {
  if (G.phase !== 'play') return;
  // In a campaign the phone keeps ringing into the next leg; otherwise the shift is over.
  if (G.campaign) { if (G.ring) G.calls.unshift(G.ring.s); } else G.calls = [];
  G.phase = 'handover'; G.modal = null; G.ring = null;
  render();
}

// Why an open ticket has to be in the handover, and what leaving it out costs. null = it doesn't.
function handoverNeed(t) {
  const T = t.s.truth, a = finalAppt(t);
  if (!isOpen(t) || t.status === 'Completed') return null;
  if (T.priority === 'P1' || T.priority === 'P2') return { pts: 20, why: `a ${T.priority} that's still open` };
  if (t.status === 'Waiting on vendor') return { pts: 10, why: 'waiting on a vendor' };
  if (t.status === 'Waiting on approval') return { pts: 10, why: 'waiting on an approval' };
  const owned = a && ['booked', 'working'].includes(a.state) && !a.atRisk && G.techs[a.tech].sickAt == null;
  if (T.dispatch && !owned) return { pts: 10, why: 'not booked with anyone who can work it' };
  return null;
}

function gradeHandover() {
  const d = k => G.drafts[k], ded = [], good = [];
  for (const t of G.tickets.filter(isOpen)) {
    const need = handoverNeed(t), flag = !!d('ho-flag-' + t.id), note = String(d('ho-note-' + t.id) || '').trim();
    if (need && !flag) ded.push([need.pts, `#${t.id} is ${need.why}, and it wasn't in the handover. ${G.night ? 'The day coordinator doesn\'t know it exists.' : 'Overnight, nobody owns it.'}`]);
    else if (need) good.push(`Handed over #${t.id}: ${need.why}.`);
    if (flag && note.length < 15) ded.push([5, `Flagged #${t.id} without a note saying what happens next.`]);
  }
  if (String(d('ho-summary') || '').trim().length < 20) ded.push([10, `No summary for ${G.night ? 'the day coordinator' : 'the on-call engineer'}. Even a quiet shift needs one line.`]);
  else good.push(G.night ? 'Left the day coordinator a summary of the night.' : 'Left on-call a summary of the shift.');
  return { score: Math.max(0, 100 - ded.reduce((x, e) => x + e[0], 0)), ded, good };
}

// The drill whose tickets went worst this shift (average under 90), to suggest on the report.
function weakestDrill(results) {
  let worst = null;
  for (const d of DRILLS) {
    const rs = G.shift.map((s, i) => d.keys.includes(s.key) ? results[i].score : null).filter(x => x != null);
    if (!rs.length) continue;
    const avg = Math.round(rs.reduce((x, y) => x + y, 0) / rs.length);
    if (avg < 90 && (!worst || avg < worst.avg)) worst = { drill: d, avg, n: rs.length };
  }
  return worst;
}

const letter = n => n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 70 ? 'C' : n >= 60 ? 'D' : 'F';
const avg = xs => xs.length ? Math.round(xs.reduce((x, y) => x + y, 0) / xs.length) : 0;

// Campaign: each ticket is graded once, at the end of the leg where it was finished (closed or merged),
// or at the end of Friday if it's still open then. A resolved ticket waits a leg for its survey.
function endLeg() {
  const C = G.campaign, last = C.leg === CAMPAIGN_LEGS.length - 1;
  const settled = t => t.closed || t.parent;
  const surveyDue = t => t.closed && t.closed.reason === 'resolved' && t.contact && !t.s.noResponseSla && !t.csat;
  const due = G.tickets.filter(t => !C.graded.has(t.id) && (last || (settled(t) && !surveyDue(t))));
  const items = due.map(t => ({ s: t.s, r: grade(t) }));
  due.forEach(t => C.graded.add(t.id));
  const handover = gradeHandover();
  const final = avg(items.map(x => x.r.score).concat(handover.score));
  const leg = { id: CAMPAIGN_LEGS[C.leg].id, title: CAMPAIGN_LEGS[C.leg].title, final, grade: letter(final), n: items.length, scores: items.map(x => x.r.score), handover: handover.score };
  C.done.push(leg);
  const all = C.done.flatMap(l => l.scores.concat(l.handover));
  const overall = last ? avg(all) : null;
  G.report = {
    final, grade: leg.grade, items, results: items.map(x => x.r), handover, kpi: Object.assign(kpis(), { handover: handover.score }), time: now(), drill: null, suggest: null,
    campaign: { leg: C.leg, last, legs: C.done.slice(), overall, overallGrade: last ? letter(overall) : null, open: G.tickets.filter(t => !C.graded.has(t.id)).length },
  };
  G.phase = 'report'; G.modal = null; G.ring = null;
  render();
}

// Start the next leg where the last one ended. If the leg was ended early, the clock runs on to its end first.
function nextLeg() {
  const C = G.campaign, def = CAMPAIGN_LEGS[++C.leg];
  for (let m = now() + 1; m < G.end; m++) { G.clock = m; onMinute(m); }
  G.clock = G.end;
  const flagged = G.tickets.filter(t => isOpen(t) && G.drafts['ho-flag-' + t.id]);
  const summary = String(G.drafts['ho-summary'] || '').trim(), from = hm(G.end);
  for (const t of flagged) post(t, 'system', `Your handover note (${from}): ${String(G.drafts['ho-note-' + t.id] || '').trim() || '(no note)'}`, 'system');
  for (const k of Object.keys(G.drafts)) if (k.startsWith('ho-')) delete G.drafts[k];
  const sh = def.id === 'night' ? buildNight('night') : buildFriday(G.seed, C.used);
  sh.tickets.forEach(t => C.used.add(t.key));
  Object.assign(G, {
    phase: 'play', night: def.id === 'night', start: G.end, end: def.id === 'night' ? NIGHT_END : DAY + SHIFT_END,
    shift: sh.tickets, events: sh.events, eventsDone: new Set(), report: null, modal: null, view: 'board', day: 0, pick: null, speed: 1,
  });
  G.news.push({ at: G.start, text: `Your handover at ${from}: "${summary || 'no summary'}"${flagged.length ? `, with ${flagged.length} ticket${flagged.length > 1 ? 's' : ''} flagged` : ''}.` });
  toast(`${def.title} starts. ${flagged.length ? `Your handover flagged ${flagged.map(t => '#' + t.id).join(', ')}.` : 'Nothing was flagged in your handover.'}`, 'info');
  onMinute(G.start);
  G.active = G.tickets.find(isOpen)?.id ?? null;
  render();
}

function endShift() {
  if (G.campaign) return endLeg();
  const results = G.shift.map(s => { const t = ticket(s.id); return t ? grade(t) : { score: 0, ded: [[100, 'Never arrived: the shift ended first.']], good: [] }; });
  // The handover counts like one more ticket. Drills have no handover and aren't saved to progress.
  const handover = G.drill ? null : gradeHandover();
  const scores = results.map(r => r.score).concat(handover ? [handover.score] : []);
  const final = Math.round(scores.reduce((x, y) => x + y, 0) / scores.length);
  const grade_ = final >= 90 ? 'A' : final >= 80 ? 'B' : final >= 70 ? 'C' : final >= 60 ? 'D' : 'F';
  const kpi = Object.assign(kpis(), { handover: handover ? handover.score : null });
  G.report = { final, grade: grade_, results, handover, kpi, time: now(), drill: G.drill, suggest: G.drill ? null : weakestDrill(results) };
  G.report.history = G.drill ? loadHistory() : saveShift({ at: Date.now(), mode: G.mode, seed: G.seed, final, grade: grade_, kpi: G.report.kpi });
  G.phase = 'report'; G.modal = null; G.ring = null;
  render();
}

// ---------------------------------------------------------------------------
// Progress across shifts (kept in localStorage)
// ---------------------------------------------------------------------------
const HISTORY_KEY = 'shiftone-dispatch-history';
const HISTORY_MAX = 50;
// Coordinator skills tracked from shift to shift. `up` is true when a higher number is better.
const PROGRESS = [
  { label: 'Shift score', sub: 'out of 100', up: true, get: e => e.final },
  { label: 'Triage', sub: 'avg minutes to triage', unit: ' min', up: false, get: e => e.kpi.triage },
  { label: 'Response SLA', sub: 'first response in SLA', unit: '%', up: true, get: e => e.kpi.resp },
  { label: 'Phones', sub: 'missed calls', up: false, get: e => e.kpi.missed },
  { label: 'Follow-up', sub: 'client chasers', up: false, get: e => e.kpi.chasers },
  { label: 'Dispatch', sub: 'wrong-tech dispatches', up: false, get: e => e.kpi.bounces },
  { label: 'Handover', sub: 'handover score', up: true, get: e => e.kpi.handover },
  { label: 'Billing', sub: 'time entries coded right', unit: '%', up: true, get: e => e.kpi.billing },
  { label: 'CSAT', sub: 'surveys rated 4 or 5', unit: '%', up: true, get: e => e.kpi.csat },
];

function loadHistory() {
  try { const h = JSON.parse(store.get(HISTORY_KEY) || '[]'); return Array.isArray(h) ? h.filter(e => e && e.kpi) : []; } catch { return []; }
}
function saveShift(entry) {
  const h = [...loadHistory(), entry].slice(-HISTORY_MAX);
  store.set(HISTORY_KEY, JSON.stringify(h));
  return h;
}
// Older versions only saved the best score, so it still counts.
function bestScore() {
  const scores = loadHistory().map(e => e.final);
  const legacy = store.get('shiftone-dispatch-best');
  if (legacy != null) scores.push(Number(legacy) || 0);
  return scores.length ? Math.max(...scores) : null;
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
  const refocus = Focus.keep();
  renderDom();
  refocus();
}

function renderDom() {
  const app = $('#app');
  app.dataset.phase = G ? G.phase : PREP_OPEN ? 'prep' : 'start';
  G && (G.dirty = false);
  const a = document.activeElement, fid = a && a.id, s1 = a && a.selectionStart, s2 = a && a.selectionEnd;
  const mainScroll = $('#main').scrollTop, dScroll = $('.dscroll')?.scrollLeft;

  if (!G && PREP_OPEN) { $('#main').innerHTML = renderPrep(); $('#topbar').innerHTML = topbarStart(); $('#sidebar').innerHTML = ''; $('#ticketpanel').innerHTML = ''; $('#modal-root').innerHTML = ''; $('#call-root').innerHTML = ''; return; }
  if (!G || G.phase === 'start') { $('#main').innerHTML = renderStart(); $('#topbar').innerHTML = topbarStart(); $('#sidebar').innerHTML = ''; $('#ticketpanel').innerHTML = ''; $('#modal-root').innerHTML = ''; $('#call-root').innerHTML = ''; Landing.mount(); return; }
  if (G.phase === 'handover') { $('#main').innerHTML = renderHandover(); $('#topbar').innerHTML = topbarStart(); $('#sidebar').innerHTML = ''; $('#ticketpanel').innerHTML = ''; $('#modal-root').innerHTML = renderModal(); $('#call-root').innerHTML = ''; return; }
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
    <nav class="top-links"><a href="#prep" data-act="prep">Interview prep</a><a href="index.html">Help desk mode</a><a href="index.html#pricing">Tutoring &amp; Pricing</a>${CONFIG.repoUrl ? `<a href="${esc(CONFIG.repoUrl)}" target="_blank" rel="noopener">GitHub</a>` : ''}</nav>${themeBtn()}`;
}
function urlSeed() { try { return normSeed(new URLSearchParams(location.search).get('seed')); } catch { return ''; } }
function logo() { return '<svg class="logo" viewBox="0 0 32 32"><rect x="3" y="6" width="26" height="22" rx="3"/><path d="M3 12h26M10 3v6M22 3v6M9 18h5M17 22h6"/></svg>'; }
function themeBtn() { return `<button class="icon-btn" data-act="theme" title="Toggle light/dark">${document.documentElement.dataset.theme === 'dark' ? '☀' : '☾'}</button>`; }

function renderTopbar() {
  const k = kpis(), open = G.tickets.filter(isOpen);
  const speeds = SPEED_LABEL.map((l, i) => (i === 0 && G.mode !== 'practice') ? '' : `<button class="${G.speed === i ? 'on' : ''}" data-act="speed" data-s="${i}" title="${i ? `${SPEEDS[i]} sim min per second` : 'Pause'}">${l}</button>`).join('');
  return `<div class="brand">${logo()}<span>Shift One</span><small>${G.campaign ? `Campaign · ${esc(CAMPAIGN_LEGS[G.campaign.leg].title)}` : G.drill ? `Drill · ${esc(G.drill.title)}` : G.night ? `On call · ${G.mode === 'practice' ? 'practice' : 'timed'}` : `${G.mode === 'practice' ? 'Practice' : 'Timed shift'} · shift ${esc(G.seed)}`}</small></div>
    <div class="stats">
      <div><small>${dayName()}</small><b id="clock">${hm(now())}</b></div>
      <div><small>Open</small><b>${open.length}</b></div>
      <div><small>Untriaged</small><b class="${open.some(t => !t.triage) ? 'warn-t' : ''}">${open.filter(t => !t.triage).length}</b></div>
      <div><small>Resp. SLA</small><b>${k.resp ?? '–'}${k.resp != null ? '%' : ''}</b></div>
      ${k.missed ? `<div class="pen"><small>Missed calls</small><b>${k.missed}</b></div>` : ''}
    </div>
    <div class="grow"></div>
    <div class="seg speed" aria-label="Simulation speed">${speeds}</div>
    ${themeBtn()}
    <button class="btn" data-act="endShift">${G.drill ? 'End drill' : 'End shift'}</button>`;
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
  for (const b of G.blocks.filter(b => b.kind === 'out')) {
    const hit = G.appts.filter(a => a.tech === b.tech && a.state === 'booked' && a.atRisk);
    if (hit.length) out.push(`<div class="alert crit">${esc(TECHS[b.tech].name)} is off the board ${hm(b.start)}–${hm(b.start + b.dur)} (${esc(b.label.toLowerCase())}). ${hit.length} appointment${hit.length > 1 ? 's' : ''} in that time can't go ahead: ${hit.map(a => '#' + a.ticket).join(', ')}.</div>`);
  }
  const done = G.tickets.filter(t => isOpen(t) && t.status === 'Completed');
  if (done.length) out.push(`<div class="alert info">Completed by technicians, waiting for you to confirm and close: ${done.map(t => '#' + t.id).join(', ')}.</div>`);
  const low = G.tickets.filter(t => t.csat && t.csat.rating <= CSAT_LOW && t.csat.followed == null);
  if (low.length) out.push(`<div class="alert warn">Low satisfaction scores waiting for your reply: ${low.map(t => `<button class="kb-link" data-act="open" data-id="${t.id}">#${t.id} (${t.csat.rating}/5)</button>`).join(', ')}.</div>`);
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
      <tbody>${list.map(t => { const a = finalAppt(t); return `<tr class="${G.active === t.id ? 'sel' : ''} ${t.unread && isOpen(t) ? 'unread' : ''}" tabindex="0" data-act="open" data-id="${t.id}">
        <td>${prioBadge(t.triage?.priority)}</td>
        <td><div class="tid">#${t.id} ${chan(t.channel)}</div><div class="ttl">${esc(t.title)}</div></td>
        <td>${esc(client(t).name)}</td>
        <td class="nowrap">${statusBadge(t.status)}</td>
        <td class="nowrap">${a && !['cancelled'].includes(a.state) ? `${esc(TECHS[a.tech].name.split(' ')[0])} <span class="muted small">${hm(a.start)}</span>` : '<span class="muted">–</span>'}</td>
        <td>${respCell(t)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Nothing here.</td></tr>'}
      </tbody></table></div>`;
}

// The dispatch board's time span for a tab: the shift itself (day 0), or Friday's day board (DAY).
const boardSpan = (day = G.day) => day ? [DAY + SHIFT_START, DAY + SHIFT_END] : [G.start, G.end];
const nowPct = () => { const [a, b] = boardSpan(0); return Math.max(0, Math.min(100, (now() - a) / (b - a) * 100)); };

function renderDispatch() {
  const day = G.day, t = ticket(G.pick), [from, to] = boardSpan(), span = to - from;
  const pos = (s, d) => `left:${(s - from) / span * 100}%;width:${d / span * 100}%`;
  const slots = [];
  for (let m = from; m < to; m += SLOT) slots.push(m);
  const pastEdge = Math.floor(now() / SLOT) * SLOT;
  // On the night shift, tonight's board is Jordan alone and Friday's is the day team.
  const ids = crew().filter(id => !G.night || !!TECHS[id].night === !day);
  const rows = ids.map(id => [id, TECHS[id]]).map(([id, x]) => {
    const [cls, label] = techStatus(id, day ? from : now());
    const sick = G.techs[id].sickAt;
    const cells = slots.map(m => {
      const [h0, h1] = hoursOf(id, m);
      const off = m < h0 || m >= h1 || (sick != null && m >= sick), past = m < pastEdge;
      return `<button class="cell ${off ? 'off' : past ? 'past' : ''} ${m % 60 === 0 ? 'hr' : ''}" data-act="slot" data-tech="${id}" data-m="${m}" ${off || past ? 'disabled' : ''} aria-label="${esc(x.name)} ${hm(m)}"></button>`;
    }).join('');
    const blocks = G.blocks.filter(b => b.tech === id && b.start >= from && b.start < to)
      .map(b => `<div class="blk k-${b.kind}" style="${pos(b.start, b.dur)}" title="${esc(b.label)} · ${hm(b.start)}–${hm(b.start + b.dur)}"><span>${esc(b.label)}</span></div>`).join('');
    const appts = G.appts.filter(a => a.tech === id && a.start >= from && a.start < to && a.state !== 'cancelled').map(a => {
      const tk = ticket(a.ticket), bad = a.state === 'missed' || (a.state === 'booked' && (a.atRisk || (sick != null && a.start >= sick)));
      return (a.onsite ? `<div class="blk k-travel" style="${pos(a.start - TRAVEL_MIN, TRAVEL_MIN)}" title="Travel"><span>Travel</span></div>` : '') +
        `<button class="appt s-${a.state} ${bad ? 'conflict' : ''} ${tk.id === G.active ? 'sel' : ''}" style="${pos(a.start, a.dur)}" data-act="appt" data-a="${a.id}" title="#${tk.id} ${esc(tk.title)} · ${hm(a.start)}–${hm((a.start + a.dur) % DAY)}">
          <b>#${tk.id}</b> <span>${esc(client(tk).name)}</span></button>`;
    }).join('');
    return `<div class="drow"><div class="dtech"><b>${esc(x.name)}</b><div class="muted small">${esc(x.role)}</div><div class="small"><span class="dot ${cls}"></span>${esc(label)}</div>
        <div class="skills">${x.skills.map(s => `<span class="sk ${t && t.triage?.skill === s ? 'hit' : ''}">${s}</span>`).join('')}</div></div>
      <div class="dtrack">${cells}${blocks}${appts}${!day ? `<div class="nowline" style="left:${nowPct()}%"></div>` : ''}</div></div>`;
  }).join('');
  const hours = [];
  // A 15-hour night gets a label every two hours, without the day prefix, so they don't collide.
  const step = span > 600 ? 120 : 60;
  for (let m = from; m < to; m += step) hours.push(`<span style="left:${(m - from) / span * 100}%">${hm(m).replace(/^\w+ /, '')}</span>`);
  const waiting = G.tickets.filter(needsScheduling);
  return `<div class="view-head"><h2>Dispatch Board</h2>
      <div class="seg">${(G.night ? [[0, 'Tonight (on call)'], [DAY, 'Friday (day team)']] : G.start >= DAY ? [[0, 'Today (Fri)']] : [[0, 'Today (Thu)'], [DAY, 'Tomorrow (Fri)']]).map(([d, l]) => `<button class="${G.day === d ? 'on' : ''}" data-act="day" data-d="${d}">${l}</button>`).join('')}</div></div>
    ${t ? `<div class="picking"><div><b>Scheduling #${t.id}</b> · ${esc(t.title)}<div class="muted small">${esc(client(t).name)}${t.triage ? ` · ${t.triage.priority} · needs ${esc(t.triage.skill)} · ${t.triage.onsite ? 'onsite' : 'remote'} · ${mins(t.triage.est)}` : ' · not triaged yet'}. Click a free slot on the board.</div></div><button class="btn sm" data-act="unpick">Cancel</button></div>`
      : `<p class="hint">Pick a ticket below (or press "Schedule" on a ticket), then click a free slot. Grey hatching is outside working hours. Soft blocks (lunch, meetings, projects) can be bumped at a cost; jobs and travel can't.</p>`}
    ${banners()}
    <div class="card dscroll"><div class="dboard">
      <div class="drow dhead"><div class="dtech"></div><div class="dtrack hours">${hours.join('')}</div></div>
      ${rows}</div></div>
    <div class="legend muted small"><span><i class="swatch k-ticket"></i>Ticket</span><span><i class="swatch k-lunch"></i>Lunch</span><span><i class="swatch k-meeting"></i>Meeting / project</span><span><i class="swatch k-travel"></i>Travel</span><span><i class="swatch k-job"></i>Existing job</span><span><i class="swatch k-out"></i>Off the board</span><span><i class="swatch k-conflict"></i>Conflict</span></div>
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
      <div class="requester" role="button" tabindex="0" data-act="gotoClient" data-c="${t.client}" title="Open client notes">
        <div class="avatar">${esc(name.replace(/^Dr\. /, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</div>
        <div><b>${esc(name)}</b> ${chips}<div class="muted small">${esc(role)} · ${esc(c.name)} · ${esc(c.agreement)}</div></div>
      </div>
      <div class="appt-line">${a && a.state !== 'cancelled' ? `${I.dispatch}<span><b>${esc(TECHS[a.tech].name)}</b> · ${hm(a.start)}–${hm((a.start + a.dur) % DAY)} · ${a.onsite ? 'onsite' : 'remote'} <span class="muted">(${a.state})</span></span>` : `${I.dispatch}<span class="muted">No technician booked</span>`}
        <div class="grow"></div>
        ${open ? `<button class="btn sm ${needsScheduling(t) ? 'primary' : ''}" data-act="pick" data-id="${t.id}">Schedule</button>${a && a.state === 'booked' ? '<button class="btn sm ghost" data-act="unschedule">Unbook</button>' : ''}` : ''}</div>
    </div>
    <div class="thread" id="thread">${t.thread.map(renderMsg.bind(null, t)).join('')}</div>
    ${open ? renderActions(t) : `<div class="tp-actions">${renderCsat(t)}<p class="muted small">${t.parent ? `Merged into <button class="kb-link" data-act="open" data-id="${t.parent}">#${t.parent}</button>.` : `Closed at ${hm(t.closed.at)} as <b>${REASONS[t.closed.reason]}</b>.`} You'll see how it was graded in the shift report.</p></div>`}`;
}

function renderCsat(t) {
  const r = t.csat;
  if (!t.closed || t.closed.reason !== 'resolved' || !t.contact || t.s.noResponseSla) return '';
  if (!r) return '<p class="muted small">Satisfaction survey sent. The client usually answers within a few minutes.</p>';
  const low = r.rating <= CSAT_LOW;
  return `<div class="card pad csat ${low ? 'low' : ''}"><div class="row"><b class="stars" aria-label="${r.rating} out of 5">${'★'.repeat(r.rating)}<span class="off">${'☆'.repeat(5 - r.rating)}</span></b><span class="muted small">${r.rating}/5 · ${hm(r.at)}</span></div>
    ${low ? (r.followed == null ? `<p class="small">A low score is a complaint. Reply now: apologise, own what went wrong, and say what happens next.</p><button class="btn primary sm" data-act="csatFollow">Reply to ${esc(greet(contactOf(t)))}</button>`
      : `<p class="muted small">You followed up at ${hm(r.followed)}.</p>`) : ''}
    <button class="kb-link" data-act="gotoPb" data-k="PB-14">${I.pb} PB-14 Client satisfaction</button></div>`;
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

  const entries = G.time.filter(e => e.ticket === t.id);
  const time = entries.length ? section(t, 'time', `Time entries${entries.some(e => !e.code) ? ' <span class="chip warn">To code</span>' : ''}`, `
      <table class="tbl compact"><tbody>${entries.map(e => `<tr><td><b>${esc(TECHS[e.tech].name)}</b><div class="muted small">${hm(e.at)} · ${mins(e.mins)}${e.onsite ? ' · onsite' : ' · remote'}</div></td>
        <td class="right">${e.code ? `<span class="chip ${e.code === 'covered' ? 'muted' : 'ok'}">${BILL[e.code]}</span>` : `<select id="d-bill-${e.id}" data-draft="bill-${e.id}" aria-label="Billing code"><option value="">Code as…</option>${Object.entries(BILL).map(([k, l]) => `<option value="${k}" ${G.drafts['bill-' + e.id] === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`}</td></tr>`).join('')}</tbody></table>
      ${entries.some(e => !e.code) ? '<button class="btn primary sm" data-act="bill">Post time</button>' : ''}
      <button class="kb-link" data-act="gotoPb" data-k="PB-12">${I.pb} PB-12 Time entries and billing</button>`, entries.some(e => !e.code)) : '';

  const pb = PLAYBOOK.find(p => p.id === t.s.kb);
  return `<div class="tp-actions">
    ${section(t, 'tri', t.triage ? `Triage <span class="muted small">· ${t.triage.priority} · ${esc(t.triage.board)}</span>` : 'Triage', triage, !t.triage)}
    ${msg}${coord}${time}${close}
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
  return `<div class="view-head"><h2>Team</h2><span class="muted">Northbound IT · ${crew().length} technicians</span></div>
    ${G.news.map(n => `<div class="alert crit">${hm(n.at)} · ${esc(n.text)}</div>`).join('')}
    <div class="team">${crew().map(id => [id, TECHS[id]]).map(([id, x]) => {
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
  const best = bestScore(), runs = loadHistory().length;
  const sc = id => SCENARIOS.find(s => s.id === id);
  const who = s => { const c = CLIENTS[s.client]; return `${s.from || c.contacts[s.contact]?.name || ''} · ${c.name}`; };
  const CH = { email: 'Email', phone: 'Call', alert: 'Alert', vendor: 'Vendor' };
  // Tickets arrive untriaged, so the preview shows the channel, not the answer.
  const items = SCENARIOS.filter(s => !s.extra && s.at >= 0).sort((a, b) => a.at - b.at)
    .map(s => ({ id: '#' + s.id, pri: 'p0', label: CH[s.channel] || s.channel, title: s.title, who: who(s) }));
  const call = SCENARIOS.find(s => s.channel === 'phone' && s.truth.priority === 'P1');
  const at = id => hm(SHIFT_START + sc(id).at);
  const span = SHIFT_END - SHIFT_START, pct = m => ((m - SHIFT_START) / span * 100).toFixed(1);
  const blocks = baseBlocks().filter(b => b.start < DAY);
  const board = Object.entries(TECHS).filter(([, x]) => !x.night).map(([id, x]) => {
    const bars = blocks.filter(b => b.tech === id).map(b => `<i class="${b.kind === 'lunch' ? 'lunch' : ''}" style="left:${pct(b.start)}%;width:${(b.dur / span * 100).toFixed(1)}%" title="${esc(b.label)}"></i>`);
    if (x.end < SHIFT_END) bars.push(`<i class="sick" style="left:${pct(x.end)}%;right:0" title="Off shift"></i>`);
    return `<div class="board-row"><small>${esc(x.name.split(' ')[0])}</small><div class="board-track">${bars.join('')}</div></div>`;
  }).join('');
  const hdg = CLIENTS.hdg, approvers = Object.values(hdg.contacts).filter(c => c.auth).map(c => c.name);
  return `<div class="start landing">
    <div class="l-hero">
      <div class="l-pitch"><div class="l-badge"><span>Dispatch desk</span>Northbound IT · Managed services</div>
        <h1>Five techs. Five clients. <em>One</em> of you.</h1>
        <p class="l-lede">You're the service coordinator at <b>Northbound IT</b>. Calls ring, alerts fire and clients email. You triage every ticket, keep clients updated, chase approvals and vendors, and put the <b>right technician on the right job</b> at the right time. The technicians do the work. How it goes depends on who you sent.</p></div>
      ${Landing.queue({ key: 'dispatch', heading: 'Service board · New', items, foot: 'Every ticket here is in the game. Triage is up to you.',
        call: call && { who: `Incoming call: ${who(call)}`, sub: call.title } })}
    </div>
    <div class="desks">
      <div class="desk primary"><span class="desk-role">Service coordinator · timed</span><h3>Thursday, ${hm(SHIFT_START)}–${hm(SHIFT_END)}</h3>
        <p>About 18 minutes at 1×; speed up when it's quiet. Every shift draws different tickets at different times.</p>
        <div class="desk-go"><button class="btn primary" data-act="start" data-m="shift">Clock in</button></div>
        ${best != null ? `<div class="desk-best">Your best: <b>${best}</b>${runs > 1 ? ` across ${runs} shifts` : ''}</div>` : ''}</div>
      <div class="desk"><span class="desk-role">Service coordinator · practice</span><h3>Practice mode</h3>
        <p>Pause any time and read the playbooks. Enter a shift code to replay the same tickets and compare scores.</p>
        <label class="field seed-field"><span>Replay a shift (optional)</span><input id="seed-in" maxlength="24" spellcheck="false" autocomplete="off" placeholder="Shift code, e.g. classic" value="${esc(urlSeed())}"></label>
        <div class="desk-go"><button class="btn" data-act="start" data-m="practice">Start practice</button></div></div>
      <a class="desk alt" href="index.html"><span class="desk-role">Tier 1 · Brightline Logistics</span><h3>Help desk technician</h3>
        <p>Rather fix tickets yourself? Work them with a directory, remote desktop, command prompt and server room.</p>
        <span class="desk-link">Go to the help desk →</span></a>
    </div>

    <section class="l-sec campaign"><div class="l-eyebrow">Campaign · two days, three shifts</div>
      <h2>Thursday, Thursday night, Friday. One clock.</h2>
      <p class="muted">Play Thursday's day shift, cover the night on call, then run Friday. Nothing resets: open tickets, bookings and vendor cases carry on, and the only briefing you get at each change is the handover you wrote. Work you booked for "tomorrow" turns up on Friday, finished, waiting for you to close it.</p>
      <div class="row gap"><button class="btn primary" data-act="start" data-m="shift" data-seed="campaign">Start a campaign</button><button class="btn" data-act="start" data-m="practice" data-seed="campaign">Practice (pause any time)</button></div></section>

    <section class="l-sec night"><div class="l-eyebrow">After hours · on call</div>
      <h2>Cover the desk overnight, 17:00 to 08:00.</h2>
      <p class="muted">${NIGHT_SCENARIOS.length} tickets across fifteen hours, and one engineer. Every booking wakes <b>${esc(TECHS.jordan.name)}</b> up, so decide what really can't wait and put the rest on Friday's board for the day team. At 08:00 you hand over to the day coordinator. The night runs ${NIGHT_SPEED}× faster than a day shift, and slows down when the phone rings.</p>
      <p class="muted small"><i>${esc(NIGHT_BRIEF)}</i></p>
      <div class="row gap"><button class="btn primary" data-act="start" data-m="shift" data-seed="night">Start the night shift</button><button class="btn" data-act="start" data-m="practice" data-seed="night">Practice (pause any time)</button></div></section>

    <section class="l-sec drills"><div class="l-eyebrow">Skill drills · practice mode</div>
      <h2>Short on time? Drill one skill.</h2>
      <p class="muted">Four or five tickets from one area, with no sick calls and no handover. Run it at 4× until the techs finish, then end the drill. Drills don't count towards your progress.</p>
      <div class="drill-grid">${DRILLS.map(d => `<div class="desk"><span class="desk-role">${d.keys.length} tickets</span><h3>${esc(d.title)}</h3><p>${esc(d.blurb)}</p>
        <div class="desk-go"><button class="btn" data-act="start" data-m="practice" data-seed="drill-${d.id}">Start drill</button></div></div>`).join('')}</div></section>

    <section class="l-sec"><div class="l-eyebrow">Interview prep</div>
      <h2>Got an interview coming up?</h2>
      <p class="muted">${PREP.length} questions MSPs ask service coordinators, from "how do you prioritise?" to "what goes in a handover?". Write your answer, see which key points it covers, compare it with a model answer, then practise that skill in a drill.</p>
      <div class="row gap"><button class="btn primary" data-act="prep">Start interview prep</button>${(() => { const st = prepStats(); return st.answered ? `<span class="muted small">${st.answered} of ${st.total} answered so far</span>` : ''; })()}</div></section>

    <section class="l-sec"><div class="l-eyebrow">The classic shift, in the order tickets arrive</div>
      <h2>Nine hours of dispatch in about eighteen minutes.</h2>
      ${Landing.timeline([
        { at: at('4502'), text: 'An RMM alert: a client file server is past its disk threshold. Who gets it, and how soon?' },
        { at: at('4506'), text: 'A dental clinic has no internet, no phones and no schedule. Their VIP owner is on the line.', alert: true },
        { at: at('4507'), text: 'Three emails from one school in six minutes, all about email. One incident or three?' },
        { at: at('4513'), text: 'A managing partner typed his password into a fake DocuSign page.', alert: true },
        { at: at('4516'), text: '"Forward all my email to my personal address." Does that need an approval?' },
      ])}</section>

    <section class="l-sec"><div class="l-eyebrow">What's on your screen</div>
      <h2>The schedule, the contracts and the clock are all real constraints.</h2>
      <div class="l-tools">
        <div class="l-tool"><div class="snip board">${board}</div>
          <h3>Dispatch board at ${hm(SHIFT_START)}</h3><p>Lunches, a project, a training session, and an engineer whose day ends at ${hm(TECHS.sipho.end)}.</p></div>
        <div class="l-tool"><div class="snip dir">
            <span>${esc(hdg.name)}</span><span class="chip ok">${esc(hdg.agreement)}</span>
            ${PRIORITIES.map(p => `<span>First response, ${p}</span><span>${SLA[hdg.sla][p]} min</span>`).join('')}
            <span class="dir-note">Onsite ${esc(hdg.onsiteText)} · approvers: ${esc(approvers.join(', '))}</span></div>
          <h3>Clients &amp; contracts</h3><p>Every client has its own SLA, visit window and people who can approve work.</p></div>
        <div class="l-tool"><div class="snip rack">
            <div class="unit"><span class="led off"></span>Line 1 ringing · voicemail if missed</div>
            <div class="unit"><span class="led warn"></span>Approval sent · waiting on client</div>
            <div class="unit"><span class="led warn"></span>Vendor case open · chase for an ETA</div>
            <div class="unit"><span class="led"></span>Tech on site · update the client</div></div>
          <h3>Calls, approvals &amp; vendors</h3><p>Miss a call and it becomes a voicemail. Go quiet on a client and they chase you.</p></div>
      </div></section>

    <section class="l-sec"><div class="l-eyebrow">Graded like a service manager would</div>
      <h2>Your shift report says exactly where the points went.</h2>
      ${Landing.report({ grade: 'C', title: 'Service coordinator shift', meta: 'Timed shift · these lines come straight from the grader', lines: [
        [null, 'Merged the duplicates: one incident, one technician, one set of updates.'],
        [null, 'Answered the call live.'],
        [15, 'Told the client it was fixed before the technician had finished.'],
        [30, 'Still booked with Ben Carter, who went home sick. Nobody turned up.'],
      ] })}</section>
    <footer class="site-foot">Built by ${esc(CONFIG.author)}${CONFIG.repoUrl ? ` · <a href="${esc(CONFIG.repoUrl)}" target="_blank" rel="noopener">Source on GitHub</a>` : ''} · Northbound IT and its clients are fictional.</footer></div>`;
}

function renderHandover() {
  const oc = G.night ? NIGHT_HANDOVER_TO : INTERNAL.oncall, open = G.tickets.filter(isOpen), d = k => G.drafts[k];
  const booking = t => {
    const a = finalAppt(t);
    if (!a || !['booked', 'working'].includes(a.state)) return '<span class="muted">Not booked</span>';
    return `${esc(TECHS[a.tech].name.split(' ')[0])} · ${hm(a.start)}${a.state === 'working' ? ' (working)' : ''}`;
  };
  const rows = open.map(t => `<tr class="${d('ho-flag-' + t.id) ? 'sel' : ''}">
      <td><input type="checkbox" id="d-ho-flag-${t.id}" data-draft="ho-flag-${t.id}" data-live="1" ${d('ho-flag-' + t.id) ? 'checked' : ''} aria-label="Hand over #${t.id}"></td>
      <td>${prioBadge(t.triage?.priority)}</td>
      <td><div class="tid">#${t.id}</div><div class="ttl">${esc(t.title)}</div><div class="muted small">${esc(client(t).name)}</div></td>
      <td>${statusBadge(t.status)}</td><td class="small">${booking(t)}</td>
      <td class="ho-note"><input id="d-ho-note-${t.id}" data-draft="ho-note-${t.id}" value="${esc(d('ho-note-' + t.id) || '')}" placeholder="Next step, and who owns it" aria-label="Handover note for #${t.id}"></td></tr>`).join('');
  return `<div class="report handover">
    <div class="view-head"><h2>${G.night ? 'Hand over to the day team' : 'Hand over to on-call'}</h2><span class="muted">${G.night ? '' : 'Thursday '}${hm(now())}</span></div>
    <div class="card pad"><p>${G.night ? `<b>${esc(oc.name)}</b>, the day coordinator, starts at 08:00 and only knows what you tell them. Tick what's still open and needs them, and add the next step. Work already booked with a day tech doesn't need a flag.`
      : `<b>${esc(oc.name)}</b> is on call tonight, 17:00–08:00, and only knows what you tell them. Tick the tickets they need to know about and add the next step. Leave the rest off: on-call needs the short list, not the whole board.`}</p>
      <button class="kb-link" data-act="reportPb" data-k="${G.night ? 'PB-13' : 'PB-11'}">${I.pb} ${G.night ? 'Read PB-13 · After hours and on-call' : 'Read PB-11 · Shift handover'}</button></div>
    <h4>Open tickets (${open.length})</h4>
    <div class="card">${open.length ? `<table class="tbl ho-table"><thead><tr><th>Flag</th><th>Pri</th><th>Ticket</th><th>Status</th><th>Booked</th><th>Note for ${esc(oc.name.split(' ')[0])}</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty muted pad">Nothing is open. Say so in the summary.</div>'}</div>
    <label class="field"><span>Summary for ${esc(oc.name.split(' ')[0])}</span><textarea id="d-ho-summary" data-draft="ho-summary" rows="3" placeholder="${G.night ? 'How the night went, and what the day team should pick up first' : 'How the shift went, and anything to watch overnight'}">${esc(d('ho-summary') || '')}</textarea></label>
    <div class="row gap"><div class="grow"></div><button class="btn primary lg" data-act="submitHandover">Submit handover and see the report</button></div></div>`;
}

// ---------------------------------------------------------------------------
// Interview prep (PREP in interview.js). Answers are kept in this browser only.
// ---------------------------------------------------------------------------
const PREP_KEY = 'shiftone-prep';
function prepAnswers() {
  try { const a = JSON.parse(store.get(PREP_KEY) || '{}'); return a && typeof a === 'object' && !Array.isArray(a) ? a : {}; } catch { return {}; }
}
function savePrepAnswer(id, text) {
  const a = prepAnswers();
  if (text.trim()) a[id] = text; else delete a[id];
  store.set(PREP_KEY, JSON.stringify(a));
}
function prepStats(a = prepAnswers()) {
  const done = PREP.filter(q => (a[q.id] || '').trim().length >= 40);
  const hit = PREP.reduce((x, q) => x + prepCovered(q, a[q.id]).filter(Boolean).length, 0);
  const all = PREP.reduce((x, q) => x + q.points.length, 0);
  return { answered: done.length, total: PREP.length, hit, all };
}
const prepPoints = (q, text) => {
  const c = prepCovered(q, text);
  return q.points.map((p, i) => `<li class="${c[i] ? 'g' : 'todo'}">${esc(p.label)}</li>`).join('');
};
const prepSummary = st => `<b>${st.answered}</b> of ${st.total} questions answered · <b>${st.hit}</b> of ${st.all} key points covered`;

function renderPrep() {
  const a = prepAnswers();
  const cards = PREP.map((q, i) => {
    const d = q.drill && DRILLS.find(x => x.id === q.drill);
    const arts = q.kb.map(k => PLAYBOOK.find(p => p.id === k)).filter(Boolean);
    return `<div class="card pad prep-q" id="q-${q.id}">
      <div class="row"><span class="tid">Q${i + 1}</span><h3 class="grow">${esc(q.q)}</h3></div>
      <label class="field"><span>Your answer, as you'd say it out loud</span><textarea id="prep-${q.id}" data-prep="${q.id}" rows="4" placeholder="Talk it through: what you'd check, what you'd do, and why.">${esc(a[q.id] || '')}</textarea></label>
      <div class="muted small">A strong answer covers:</div>
      <ul class="fb prep-points" id="prep-pts-${q.id}">${prepPoints(q, a[q.id])}</ul>
      <details class="close-box"><summary>Model answer</summary><p>${esc(q.model)}</p></details>
      ${arts.map(p => `<details class="close-box"><summary>${p.id} · ${esc(p.title)}</summary><div class="article">${p.body}</div></details>`).join('')}
      <div class="row gap"><button class="btn sm" data-act="start" data-m="practice" data-seed="${d ? 'drill-' + d.id : 'classic'}">${d ? `Practise it: ${esc(d.title)} drill` : 'Practise it in the classic shift'}</button></div>
    </div>`;
  }).join('');
  return `<div class="report prep">
    <div class="view-head"><h2>Interview prep</h2><span class="muted">Service coordinator · MSP dispatcher</span></div>
    <div class="card pad"><p>These are the questions MSPs ask service coordinators and dispatchers. Write your answer the way you'd say it, and the checklist under it ticks off the key points as you cover them. Then compare with the model answer and practise the skill in the sim. Your answers stay in this browser.</p>
      <p class="small" id="prep-sum">${prepSummary(prepStats(a))}</p>
      <div class="row gap"><button class="btn" data-act="home">Back to the start page</button></div></div>
    ${cards}</div>`;
}

function renderReport() {
  const R = G.report, k = R.kpi;
  const tile = (label, v, sub, bad) => `<div class="stat ${bad ? 'bad' : ''}"><small>${label}</small><b>${v}</b><span>${sub}</span></div>`;
  return `<div class="report">
    <div class="report-head"><div class="grade g-${R.grade}">${R.grade}</div>
      <div><h1>${R.campaign ? esc(CAMPAIGN_LEGS[R.campaign.leg].title) : R.drill ? 'Drill report' : G.night ? 'On-call report' : 'Shift report'}</h1><p class="muted">Northbound IT · ${R.campaign ? `campaign <b>${esc(G.seed)}</b> · leg ${R.campaign.leg + 1} of ${CAMPAIGN_LEGS.length} · ended ${hm(R.time)}` : G.night ? `Thursday 17:00 – ${hm(R.time)} · after hours · ${G.mode === 'practice' ? 'practice mode' : 'timed shift'}` : `Thursday 08:00–${hm(R.time)} · ${R.drill ? `drill: <b>${esc(R.drill.title)}</b>` : `${G.mode === 'practice' ? 'practice mode' : 'timed shift'} · shift <b>${esc(G.seed)}</b>`}`}</p>
      <div class="big-score">${R.final}<small>/100</small></div></div>
      <div class="grow"></div><div class="col gap">${R.campaign ? (R.campaign.last ? `<button class="btn primary lg" data-act="start" data-m="${G.mode}" data-seed="campaign">New campaign</button><button class="btn" data-act="start" data-m="${G.mode}" data-seed="${esc(G.seed)}">Replay ${esc(G.seed)}</button>`
        : `<button class="btn primary lg" data-act="nextLeg">Continue: ${esc(CAMPAIGN_LEGS[R.campaign.leg + 1].title)}</button>`) : G.night ? `<button class="btn primary lg" data-act="start" data-m="${G.mode}" data-seed="night">Replay the night</button><button class="btn" data-act="start" data-m="shift" data-seed="">Day shift</button>` : R.drill ? `<button class="btn primary lg" data-act="start" data-m="practice" data-seed="${esc(G.seed)}">Retry the drill</button><button class="btn" data-act="start" data-m="shift" data-seed="">Full shift</button>`
        : `<button class="btn primary lg" data-act="start" data-m="${G.mode}" data-seed="">New shift</button><button class="btn" data-act="start" data-m="${G.mode}" data-seed="${esc(G.seed)}" title="Same tickets, same times: compare your score">Replay shift ${esc(G.seed)}</button>`}<button class="btn" data-act="home">Main menu</button></div></div>
    <div class="cards4 kpis">
      ${tile('Avg time to triage', k.triage ?? '–', 'minutes', k.triage > 15)}
      ${tile('First response in SLA', (k.resp ?? '–') + (k.resp != null ? '%' : ''), 'of tickets', k.resp != null && k.resp < 80)}
      ${tile('Missed calls', k.missed, 'went to voicemail', k.missed > 0)}
      ${tile('Client chasers', k.chasers, '"any update?"', k.chasers > 0)}
      ${tile('Wrong-tech dispatches', k.bounces, 'handed back', k.bounces > 0)}
      ${tile('Closed or merged', k.closed, `of ${k.total ?? G.tickets.length} tickets`)}
      ${tile('Time coded right', (k.billing ?? '–') + (k.billing != null ? '%' : ''), 'of time entries', k.billing != null && k.billing < 100)}
      ${tile('CSAT', (k.csat ?? '–') + (k.csat != null ? '%' : ''), 'of surveys rated 4 or 5', k.csat != null && k.csat < 80)}
    </div>
    ${R.suggest ? `<div class="card pad coach-cta drill-cta"><div><b>Practise next: ${esc(R.suggest.drill.title)}</b><div class="muted">Your ${R.suggest.n === 1 ? 'ticket' : `${R.suggest.n} tickets`} in this area averaged ${R.suggest.avg}. ${esc(R.suggest.drill.blurb)}</div></div><button class="btn primary" data-act="start" data-m="practice" data-seed="drill-${R.suggest.drill.id}">Start the drill</button></div>` : ''}
    ${R.campaign ? renderCampaign(R.campaign) : R.drill ? '<div class="card pad"><p class="muted small">Drills aren\'t saved to your progress, so practise as often as you like.</p></div>' : renderProgress(R.history || [])}
    ${G.start >= DAY && !G.night ? '' : `<div class="card pad">${G.night ? `<h3>On-call time used</h3><p class="muted small">Call-out time booked with ${esc(TECHS.jordan.name)} as a share of the night. Low is good overnight, as long as nothing urgent waited for the morning.</p>`
      : '<h3>Technician utilization (today)</h3><p class="muted small">Booked ticket time as a share of each person\'s working day. 70–85% is healthy; nobody should be at 0% while tickets wait.</p>'}
      ${(G.night ? ['jordan'] : crew()).map(id => [id, TECHS[id]]).map(([id, x]) => { const u = utilization(id); return `<div class="meter wide"><small>${esc(x.name)}</small><div><i style="width:${u}%" class="${u > 85 ? 'hi' : ''}"></i></div><span>${u}%</span></div>`; }).join('')}</div>`}
    <div class="card pad coach-cta"><div><b>Want someone to walk you through this report?</b><div class="muted">A tutor can replay the shift with you and turn every lost point into an interview answer.</div></div><a class="btn" href="index.html#pricing">See tutoring</a></div>
    ${R.handover ? `<div class="card pad"><div class="row"><h3 class="grow">Shift handover</h3><b class="${R.handover.score >= 80 ? 'good-t' : R.handover.score >= 50 ? '' : 'bad-t'}">${R.handover.score}</b></div>
      <p class="muted small">Counts like one more ticket. What ${G.night ? 'the day coordinator' : 'on-call'} needed from you at ${hm(R.time)}.</p>
      <ul class="fb">${R.handover.good.map(g => `<li class="g">${esc(g)}</li>`).join('')}${R.handover.ded.map(d => `<li class="b"><b>−${d[0]}</b> ${esc(d[1])}</li>`).join('')}</ul>
      <button class="kb-link" data-act="reportPb" data-k="${G.night ? 'PB-13' : 'PB-11'}">${I.pb} Read ${G.night ? 'PB-13' : 'PB-11'}</button></div>` : ''}
    ${R.campaign && !R.items.length ? '<div class="card pad"><p class="muted">No tickets were finished this leg, so only the handover is graded. Open work carries on into the next leg.</p></div>' : ''}
    <div class="report-grid">${(R.items || G.shift.map((s, i) => ({ s, r: R.results[i] }))).map(({ s, r }) => {
      const t = ticket(s.id);
      return `<div class="card pad"><div class="row">${prioBadge(t?.triage?.priority)}<span class="tid">#${s.id}</span>${t ? statusBadge(t.status) : ''}<div class="grow"></div><b class="${r.score >= 80 ? 'good-t' : r.score >= 50 ? '' : 'bad-t'}">${r.score}</b></div>
        <h4>${esc(s.title)}</h4><div class="muted small">${esc(CLIENTS[s.client].name)}${s.truth.why ? ` · <i>${esc(s.truth.why)}</i>` : ''}</div>
        <ul class="fb">${r.good.map(g => `<li class="g">${esc(g)}</li>`).join('')}${r.ded.map(d => `<li class="b"><b>−${d[0]}</b> ${esc(d[1])}</li>`).join('')}</ul>
        <button class="kb-link" data-act="reportPb" data-k="${s.kb}">${I.pb} Read ${s.kb}</button></div>`;
    }).join('')}</div></div>`;
}

// A tiny trend line where up always means better, whichever way the skill is measured.
function renderCampaign(c) {
  const rows = CAMPAIGN_LEGS.map((l, i) => {
    const d = c.legs[i];
    return `<tr class="${i === c.leg ? 'sel' : ''}"><td><b>${esc(l.title)}</b></td><td>${d ? `<span class="grade-chip g-${d.grade}">${d.grade}</span> <b>${d.final}</b>` : '<span class="muted">to come</span>'}</td>
      <td class="small">${d ? `${d.n} ticket${d.n === 1 ? '' : 's'} graded · handover ${d.handover}` : ''}</td></tr>`;
  }).join('');
  return `<div class="card pad campaign"><div class="row"><h3 class="grow">Campaign</h3>${c.last ? `<span class="grade-chip g-${c.overallGrade}">${c.overallGrade}</span> <b class="big">${c.overall}</b>` : ''}</div>
    <p class="muted small">${c.last ? 'Overall: every ticket from the two days, each graded once when it was finished, plus your three handovers.'
      : `Each ticket is graded once, in the leg where it's finished. ${c.open} open ticket${c.open === 1 ? '' : 's'} carry on into the next leg, with your handover notes on them.`} Campaigns aren't saved to your progress.</p>
    <table class="tbl compact"><tbody>${rows}</tbody></table></div>`;
}

function sparkline(vals, up) {
  const pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
  if (pts.length < 2) return '';
  const ys = pts.map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), W = 96, H = 24, n = vals.length - 1;
  const xy = ([i, v]) => { const f = hi === lo ? .5 : (v - lo) / (hi - lo); return [(i / n * (W - 4) + 2).toFixed(1), (H - 2 - (up ? f : 1 - f) * (H - 4)).toFixed(1)]; };
  const last = xy(pts[pts.length - 1]);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts.map(p => xy(p).join(',')).join(' ')}"/><circle cx="${last[0]}" cy="${last[1]}" r="2.5"/></svg>`;
}

function renderProgress(h) {
  const head = `<h3>Your progress</h3>`;
  if (h.length < 2) return `<div class="card pad">${head}<p class="muted small">This is your first recorded shift. Play again to see how each skill moves from shift to shift.</p></div>`;
  const cur = h[h.length - 1], prev = h[h.length - 2], recent = h.slice(-10);
  const fmt = (v, s) => v == null ? '–' : v + (s.unit || '');
  const rows = PROGRESS.map(s => {
    const v = s.get(cur), p = s.get(prev), all = h.map(s.get).filter(x => x != null);
    const best = all.length ? (s.up ? Math.max(...all) : Math.min(...all)) : null;
    let change = '<span class="muted">–</span>';
    if (v != null && p != null) {
      const d = v - p, better = s.up ? d > 0 : d < 0;
      change = d === 0 ? '<span class="muted">same</span>' : `<span class="${better ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${s.unit || ''}</span>`;
    }
    return `<tr><td><b>${s.label}</b><div class="muted small">${s.sub}</div></td><td><b>${fmt(v, s)}</b></td><td class="delta">${change}</td><td class="hide-sm">${fmt(best, s)}</td><td>${sparkline(recent.map(s.get), s.up)}</td></tr>`;
  }).join('');
  return `<div class="card pad progress">${head}<p class="muted small">${h.length} shifts recorded in this browser. Trend lines show your last ${recent.length} shifts and rise when you improve.</p>
    <table class="tbl compact"><thead><tr><th>Skill</th><th>This shift</th><th>vs last</th><th class="hide-sm">Best</th><th>Trend</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
const ACT = {
  start: d => { if (PREP_OPEN) { PREP_OPEN = false; try { history.replaceState(null, '', location.pathname); } catch { /* ignore */ } } newGame(d.m, d.seed ?? $('#seed-in')?.value); },
  prep: () => { G = null; PREP_OPEN = true; try { history.replaceState(null, '', location.pathname + '#prep'); } catch { /* ignore */ } render(); $('#main').scrollTop = 0; window.scrollTo(0, 0); },
  home: () => { G = null; PREP_OPEN = false; try { history.replaceState(null, '', location.pathname); } catch { /* ignore */ } render(); },
  theme: () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('shiftone-theme', r.dataset.theme); render(); },
  endShift: () => G.drill ? modal({ title: 'End the drill now?', body: '<p>Tickets are graded as they stand, so work that isn\'t finished or closed loses points.</p>', ok: 'End drill', danger: true, onOk: () => setTimeout(endShift) }) : modal({ title: 'End the shift now?', body: '<p>You\'ll write the handover for the ' + (G.night ? 'day coordinator' : 'on-call engineer') + ' next. ' + (G.campaign ? 'Finished tickets are graded now. The rest of this shift still happens before the next one starts, and open work carries over.' : 'Tickets are graded as they stand, and anything that hasn\'t arrived yet scores 0.') + '</p>', ok: 'End shift', danger: true, onOk: () => setTimeout(startHandover) }),
  submitHandover: () => endShift(),
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
  bill: () => postTime(ticket(G.active)),
  csatFollow: () => followUpCsat(ticket(G.active)),
  pick: d => { G.pick = d.id; G.active = d.id; G.view = 'dispatch'; const a = finalAppt(ticket(d.id)); G.day = a && a.start >= DAY && G.start < DAY ? DAY : G.day; render(); },
  nextLeg: () => nextLeg(),
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
// Prep answers save as you type and update their own checklist, without a full re-render.
document.addEventListener('input', e => {
  const id = e.target.dataset?.prep, q = id && PREP.find(x => x.id === id);
  if (!q) return;
  savePrepAnswer(id, e.target.value);
  const pts = document.getElementById('prep-pts-' + id), sum = document.getElementById('prep-sum');
  if (pts) pts.innerHTML = prepPoints(q, e.target.value);
  if (sum) sum.innerHTML = prepSummary(prepStats());
});
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
  try { PREP_OPEN = location.hash === '#prep'; } catch { /* ignore */ }
  render();
})();
