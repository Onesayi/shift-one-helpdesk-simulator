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

  // The playable first call on the Help Desk start page. c: { id, who, role, facts: [[k, v, bad]],
  // says, ask, choices: [{ text, reply, good: [], bad: [[pts, text]], after }], note }
  let C = null, pickN = null;
  function call(c) {
    C = c;
    const ch = pickN == null ? null : c.choices[pickN];
    const lines = ch ? [...ch.good.map(t => `<li class="g"><span>+</span><span>${esc(t)}</span></li>`),
      ...ch.bad.map(([p, t]) => `<li class="b"><span>−${p}</span><span>${esc(t)}</span></li>`)].join('') : '';
    return `<div class="lc${ch ? ' done' : ''}" id="lc">
      <div class="lc-head"><span class="lc-led" aria-hidden="true"></span>${ch ? 'Connected' : 'Incoming call'} · ${esc(c.line)}<span class="lc-id">${esc(c.id)}</span></div>
      <div class="lc-body">
        <div class="lc-caller">
          <div class="lc-who"><span class="lc-av" aria-hidden="true">${esc(c.initials)}</span><div><b>${esc(c.who)}</b><small>${esc(c.role)}</small></div></div>
          <dl class="lc-facts">${c.facts.map(([k, v, bad]) => `<dt>${esc(k)}</dt><dd${bad ? ' class="bad"' : ''}>${esc(v)}</dd>`).join('')}</dl>
          <blockquote class="lc-say"><small>${esc(c.first)}</small>${esc(c.says)}</blockquote>
          ${ch ? `<blockquote class="lc-say"><small>${esc(c.first)}</small>${esc(ch.reply)}</blockquote>` : ''}
        </div>
        <div class="lc-pick">
          <p class="lc-q">${esc(c.ask)}</p>
          <div class="lc-choices">${c.choices.map((x, i) => `<button class="lc-choice${pickN === i ? ' on' : ''}" data-act="demoPick" data-c="${i}" aria-pressed="${pickN === i}"><kbd aria-hidden="true">${i + 1}</kbd><span>${esc(x.text)}</span></button>`).join('')}</div>
          <div class="lc-result" aria-live="polite">${ch ? `<div class="lr-tag">From the grader</div><ul class="lr-lines">${lines}</ul>
            ${ch.after ? `<p class="lc-after">${esc(ch.after)}</p>` : ''}
            <button class="kb-link" data-act="demoPick" data-c="">Try a different move</button>` : `<p class="lc-hint">${esc(c.note)}</p>`}</div>
        </div>
      </div></div>`;
  }
  function pick(i) {
    pickN = i === '' || i == null ? null : Math.max(0, Math.min(C.choices.length - 1, +i));
    const el = document.getElementById('lc');
    if (el) el.outerHTML = call(C);
  }
  // 1, 2, 3 answer the call while the start page is open, unless you're typing somewhere.
  document.addEventListener('keydown', e => {
    if (!C || !document.getElementById('lc') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const n = +e.key;
    if (n >= 1 && n <= C.choices.length) pick(n - 1);
  });

  return { queue, mount, timeline, report, call, pick };
})();
