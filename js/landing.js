// Start-screen pieces shared by both desks: the live queue preview, the shift timeline
// and the example report. Each page passes in its own tickets, so the preview only ever
// shows tickets that are really in the game.

const Landing = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const SHOW = 5;
  let Q = null, timer = null;

  // key names the queue so re-renders keep its state; items: [{ id, pri: 'p1'..'p4', label, title, who }];
  // call: { who, sub } or null
  function queue({ key, heading, items, call, foot }) {
    if (!Q || Q.key !== key) {
      Q = { key, items, next: 0, live: [] };
      for (let i = 0; i < Math.min(4, items.length); i++) add(false);
    }
    return `<div class="lq" aria-label="Example ticket queue">
      <div class="lq-head"><span class="lq-led"></span>${esc(heading)}<span class="lq-count" id="lq-count">${Q.live.length} open</span></div>
      ${call ? `<div class="lq-call"><span class="lq-ring" aria-hidden="true">☎</span><div class="lq-who"><b>${esc(call.who)}</b><small>${esc(call.sub)}</small></div><span class="lq-answer">Ringing</span></div>` : ''}
      <ul class="lq-rows" id="lq-rows">${rows()}</ul>
      <div class="lq-foot">${esc(foot)}</div></div>`;
  }

  function add(fresh) {
    const t = Q.items[Q.next++ % Q.items.length];
    Q.live = [{ ...t, wait: 0, fresh }, ...Q.live.filter(x => x.id !== t.id)].slice(0, SHOW);
  }

  function rows() {
    const out = Q.live.map(t => `<li class="${t.pri}${t.fresh ? ' fresh' : ''}"><span class="lq-bar"></span><span class="lq-id">${esc(t.id)}</span>
      <span class="lq-t"><b><span class="lq-pri">${esc(t.label)}</span>${esc(t.title)}</b><small>${esc(t.who)}</small></span><span class="lq-wait">${t.wait}m</span></li>`).join('');
    Q.live.forEach(t => { t.fresh = false; });
    return out;
  }

  // Called after every render of the start screen. Keeps one timer, and stops it once the queue is gone.
  function mount() {
    if (timer || !Q || !document.getElementById('lq-rows')) return;
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch { /* no matchMedia */ }
    let n = 0;
    timer = setInterval(() => {
      const el = document.getElementById('lq-rows');
      if (!el) { clearInterval(timer); timer = null; return; }
      n++;
      Q.live.forEach(t => { t.wait++; });
      if (n % 3 === 0) add(true);
      el.innerHTML = rows();
      const c = document.getElementById('lq-count');
      if (c) c.textContent = `${Q.live.length} open`;
    }, 1200);
  }

  // items: [{ at: '0:00', text, alert }]
  const timeline = items => `<ol class="lt">${items.map(x => `<li class="${x.alert ? 'lt-alert' : ''}"><time>${esc(x.at)}</time><p>${x.text}</p></li>`).join('')}</ol>`;

  // lines: [[points or null, text]]
  const report = ({ grade, title, meta, lines }) => `<div class="lr"><div class="grade g-${esc(grade)}">${esc(grade)}</div>
    <div><div class="lr-tag">Example report</div><h3>${esc(title)}</h3><div class="lr-meta">${esc(meta)}</div>
    <ul class="lr-lines">${lines.map(([pts, text]) => `<li class="${pts ? 'b' : 'g'}"><span>${pts ? '−' + pts : '+'}</span><span>${esc(text)}</span></li>`).join('')}</ul></div></div>`;

  // The playable opening on both start pages: one ticket, one or more steps, real grader lines.
  // c: { id, line, initials, who, role, first, facts: [[k, v, bad]], says, note, live, done,
  //      steps: [{ ask, choices: [{ text, reply, from, good: [], bad: [[pts, text]], after }] }] }
  let C = null, picks = [];
  function call(c) {
    if (C && C.id !== c.id) picks = [];
    C = c;
    const done = picks.length === c.steps.length;
    const chosen = picks.map((n, i) => c.steps[i].choices[n]);
    const lines = done ? [...chosen.flatMap(x => x.good.map(t => `<li class="g"><span>+</span><span>${esc(t)}</span></li>`)),
      ...chosen.flatMap(x => x.bad.map(([p, t]) => `<li class="b"><span>−${p}</span><span>${esc(t)}</span></li>`))].join('') : '';
    const last = done ? chosen[chosen.length - 1] : null;
    const bubble = (who, text) => `<blockquote class="lc-say"><small>${esc(who)}</small>${esc(text)}</blockquote>`;
    const step = (st, i) => i > picks.length ? '' : `<div class="lc-step${i < picks.length ? ' set' : ''}">
          <p class="lc-q">${c.steps.length > 1 ? `<span class="lc-n">${i + 1}/${c.steps.length}</span>` : ''}${esc(st.ask)}</p>
          <div class="lc-choices">${st.choices.map((x, j) => `<button class="lc-choice${picks[i] === j ? ' on' : ''}" data-act="demoPick" data-c="${j}" data-step="${i}" aria-pressed="${picks[i] === j}"><kbd aria-hidden="true">${j + 1}</kbd><span>${esc(x.text)}</span></button>`).join('')}</div></div>`;
    return `<div class="lc${done ? ' done' : ''}" id="lc">
      <div class="lc-head"><span class="lc-led" aria-hidden="true"></span>${esc(done ? c.done : c.live)} · ${esc(c.line)}<span class="lc-id">${esc(c.id)}</span></div>
      <div class="lc-body">
        <div class="lc-caller">
          <div class="lc-who"><span class="lc-av" aria-hidden="true">${esc(c.initials)}</span><div><b>${esc(c.who)}</b><small>${esc(c.role)}</small></div></div>
          <dl class="lc-facts">${c.facts.map(([k, v, bad]) => `<dt>${esc(k)}</dt><dd${bad ? ' class="bad"' : ''}>${esc(v)}</dd>`).join('')}</dl>
          ${bubble(c.first, c.says)}
          ${last && last.reply ? bubble(last.from || c.first, last.reply) : ''}
        </div>
        <div class="lc-pick">
          ${c.steps.map(step).join('')}
          <div class="lc-result" aria-live="polite">${done ? `<div class="lr-tag">From the grader</div><ul class="lr-lines">${lines}</ul>
            ${last.after ? `<p class="lc-after">${esc(last.after)}</p>` : ''}
            <button class="kb-link" data-act="demoPick" data-c="">Try again</button>` : `<p class="lc-hint">${esc(c.note)}</p>`}</div>
        </div>
      </div></div>`;
  }
  // step defaults to the one waiting for an answer; picking an earlier step again clears the later ones.
  function pick(n, step) {
    if (!C) return;
    if (n === '' || n == null) picks = [];
    else {
      const i = step === '' || step == null ? Math.min(picks.length, C.steps.length - 1) : Math.min(+step, picks.length);
      picks = picks.slice(0, i);
      picks[i] = Math.max(0, Math.min(C.steps[i].choices.length - 1, +n));
    }
    const el = document.getElementById('lc');
    if (el) el.outerHTML = call(C);
  }
  // 1, 2, 3... answer the current step while a start page is open, unless you're typing somewhere.
  document.addEventListener('keydown', e => {
    if (!C || !document.getElementById('lc') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const st = C.steps[Math.min(picks.length, C.steps.length - 1)], n = +e.key;
    if (picks.length < C.steps.length && n >= 1 && n <= st.choices.length) pick(n - 1);
  });

  return { queue, mount, timeline, report, call, pick };
})();
