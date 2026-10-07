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

  return { queue, mount, timeline, report };
})();
