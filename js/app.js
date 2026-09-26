'use strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLA_SEC = { Critical: 180, High: 300, Medium: 480, Low: 720 };
const PRIO_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const fmt = s => { const neg = s < 0; s = Math.abs(s); return (neg ? '-' : '') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

let G = null;       // the whole game state
let PAGE = 'start'; // which non-game page shows when no game is running

function newGame(mode) {
  G = {
    phase: 'play', mode, t0: Date.now(),
    w: structuredClone(WORLD),
    tickets: [], log: [], seq: 0,
    view: 'queue', active: null, queueFilter: 'open',
    dir: { user: null, tab: 'profile' },
    remote: { device: null, tab: 'overview', term: [], hist: [], hi: -1 },
    server: { tab: 'overview' },
    kb: { article: null },
    drafts: {}, modal: null, penalties: [], lastThreadLen: {},
  };
  spawnDue();
  G.active = G.tickets[0]?.id ?? null;
  render();
}

const now = () => Math.floor((Date.now() - G.t0) / 1000);
const W = () => G.w;
const who = id => id === 'tech' ? 'You' : id === 'system' ? 'System' : (G.w.users[id]?.display ?? id);
const ticket = id => G.tickets.find(t => t.id === id);
const openTickets = () => G.tickets.filter(t => !t.result);
const slaLeft = t => t.arrived + SLA_SEC[t.priority] - (t.closedAt ?? now());

// ---------------------------------------------------------------------------
// Action log: every change the player makes is recorded here and graded later.
// ---------------------------------------------------------------------------
function record(type, data = {}) {
  const e = Object.assign({ seq: ++G.seq, at: now(), type }, data);
  G.log.push(e);
  return e;
}
function logged(type, pred) { return G.log.filter(e => e.type === type && (!pred || pred(e))); }
function touchedBeforeVerify(uid) {
  const v = logged('verified', e => e.user === uid)[0];
  return G.log.some(e => e.user === uid && ['pwd-reset', 'unlock', 'mfa-reset'].includes(e.type) && (!v || e.seq < v.seq));
}
function penalize(key, pts, msg) {
  if (G.penalties.some(p => p.key === key)) return;
  G.penalties.push({ key, pts, msg });
  toast(`−${pts} · ${msg}`, 'bad');
}
// Users that some arrived ticket legitimately concerns
function involvedUsers() {
  const s = new Set();
  G.tickets.forEach(t => { s.add(t.requester); s.add(t.verifyUser); (t.involves || []).forEach(u => s.add(u)); });
  return s;
}
function guardUserChange(uid, what) {
  if (!involvedUsers().has(uid)) penalize(`nt-${what}-${uid}`, 15, `${what} for ${who(uid)}, and no ticket asked for it.`);
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------
function spawnDue() {
  let spawned = false;
  for (const s of SCENARIOS) {
    if (G.tickets.some(t => t.id === s.id)) continue;
    if (G.mode === 'practice' || now() >= s.at) {
      const t = Object.assign({}, s, {
        verifyUser: s.verifyUser || s.requester,
        status: 'New', assigned: false, arrived: now(), flags: {}, asked: [], reopens: 0, result: null, unread: true,
        thread: [{ from: s.requester, text: s.body, at: now() }],
      });
      G.tickets.push(t);
      spawned = true;
      if (G.tickets.length > 3 && G.mode === 'shift') toast(`New ticket ${t.id} · ${t.priority} · ${t.title}`, 'info');
    }
  }
  return spawned;
}

function say(t, from, text, delay = 0, then) {
  const g = G;
  const push = () => {
    if (G !== g) return;
    t.typing = null;
    t.thread.push({ from, text, at: now() });
    if (G.active !== t.id) t.unread = true;
    then && then();
    render();
  };
  if (!delay) return push();
  t.typing = from;
  render();
  setTimeout(push, delay);
}

function ask(t, qid) {
  const q = t.questions.find(x => x.id === qid);
  if (!q || t.asked.includes(qid)) return;
  t.asked.push(qid);
  say(t, 'tech', q.q);
  say(t, t.requester, q.a, 1400, () => {
    if (q.flag) t.flags[q.flag] = true;
    if (q.follow) say(t, q.follow.from, q.follow.text, q.follow.delay, () => {
      if (q.follow.flag) t.flags[q.follow.flag] = true;
      if (q.follow.event) record(q.follow.event, { ticket: t.id });
    });
  });
}

function sendVerification(uid) {
  const u = W().users[uid];
  record('verify-sent', { user: uid });
  const waiting = openTickets().filter(t => t.verifyUser === uid);
  const tail = u.empId.slice(-4);
  if (!waiting.length) { toast(`Code sent to ${u.display}'s registered mobile (••• ${tail}). No open ticket is waiting on it.`); render(); return; }
  for (const t of waiting) {
    say(t, 'system', `Verification code sent to ${u.display}'s registered mobile (••• ${tail}). Ask the requester to read it back.`);
    if (t.verifyReply) {
      say(t, t.requester, t.verifyReply, 2200, () => { t.flags.verifyFailed = true; });
    } else {
      const code = String(100000 + Math.floor(Math.random() * 900000));
      say(t, t.requester, `Got it. The code is ${code.slice(0, 3)} ${code.slice(3)}.`, 2200, () => {
        t.flags.verified = true;
        record('verified', { user: uid, ticket: t.id });
        say(t, 'system', `Code ${code} matches. Identity verified for ${u.display}.`);
      });
    }
  }
  toast(`Verification code sent to ${u.display}.`);
}

function closeTicket(t, action, team) {
  const note = (G.drafts['note-' + t.id] || '').trim();
  const cat = G.drafts['cat-' + t.id] || '';
  if (!t.assigned) return toast('Assign the ticket to yourself first.', 'bad');
  if (!cat) return toast('Pick a category before closing.', 'bad');
  if (!note) return toast('Write a resolution note. The next tech will thank you.', 'bad');

  const r = t.evaluate(W(), t);
  if (action === 'resolve' && t.expect.action === 'resolve' && !r.fixed) {
    t.reopens++;
    t.status = 'Reopened';
    say(t, 'tech', `Marked resolved: ${note}`);
    say(t, t.requester, t.stillBroken || 'It\'s still not working.', 1500);
    toast(`${t.id} reopened: the requester says it's still broken.`, 'bad');
    return;
  }

  const ded = r.ded.slice(), good = r.good.slice();
  if (action === 'resolve' && t.expect.action === 'escalate')
    ded.push([30, `This needed to go to ${t.expect.team}. Tier 1 shouldn't close it alone.`]);
  if (action === 'escalate') {
    if (t.expect.action === 'resolve') ded.push(r.fixed ? [10, 'You fixed it, then escalated anyway. Just resolve it.'] : [25, 'This was within Tier 1 scope. Escalating costs the user hours.']);
    else if (team !== t.expect.team) ded.push([15, `Escalated to ${team}. This belongs with ${t.expect.team}.`]);
    else good.push(`Escalated to the right team (${team}).`);
  }
  if (!t.categories.includes(cat)) ded.push([5, `Category "${cat}" doesn't fit. Expected ${t.categories.join(' or ')}.`]);
  if (note.length < 25) ded.push([10, 'Resolution note is too thin for the next tech to learn from.']);
  else if (t.keywords && !t.keywords.some(k => note.toLowerCase().includes(k))) ded.push([5, 'The note doesn\'t say what you actually did.']);
  else good.push('Clear resolution note.');
  if (t.reopens) ded.push([15 * t.reopens, `Reopened ${t.reopens}×. The requester had to come back.`]);
  if (G.mode === 'shift') {
    if (slaLeft(t) < 0) ded.push([15, `Breached the ${t.priority} SLA (${SLA_SEC[t.priority] / 60} min).`]);
    else good.push('Closed within SLA.');
  }

  const score = Math.max(0, 100 - ded.reduce((a, d) => a + d[0], 0));
  t.result = { score, ded, good, action, team };
  t.closedAt = now();
  t.status = action === 'escalate' ? 'Escalated' : 'Resolved';
  say(t, 'tech', action === 'escalate' ? `Escalated to ${team}: ${note}` : `Resolved: ${note}`);
  const matched = action === t.expect.action;
  say(t, t.id === 'INC-20124' && matched ? 'Security team' : t.requester, matched ? t.thanks : 'OK, thanks.', 1500);
  toast(`${t.id} closed · ${score}/100`, score >= 80 ? 'good' : score >= 50 ? 'info' : 'bad');
  if (G.tickets.length === SCENARIOS.length && !openTickets().length) setTimeout(() => toast('Queue clear! Press "End shift" to see your report.', 'good'), 2000);
}

// ---------------------------------------------------------------------------
// Directory actions
// ---------------------------------------------------------------------------
function dirAction(kind, uid) {
  const u = W().users[uid];
  if (kind === 'unlock') {
    if (!u.locked) return toast(`${u.display}'s account isn't locked.`);
    u.locked = false; u.failedLogins = 0;
    record('unlock', { user: uid }); guardUserChange(uid, 'Unlocked account');
    toast(`Unlocked ${u.display}.`, 'good');
  } else if (kind === 'reset') {
    G.drafts['m-must'] = true; G.drafts['m-unlock'] = false;
    return modal({
      title: `Reset password · ${u.display}`,
      body: `<label class="field"><span>New password</span><input type="password" value="Temp-${Math.random().toString(36).slice(2, 8)}!" readonly></label>
        ${check('m-must', 'User must change password at next sign-in')}
        ${check('m-unlock', 'Unlock the account')}`,
      ok: 'Reset password',
      onOk() {
        const must = !!G.drafts['m-must'];
        record('pwd-reset', { user: uid, mustChange: must });
        if (G.drafts['m-unlock'] && u.locked) { u.locked = false; u.failedLogins = 0; record('unlock', { user: uid }); }
        u.pwdExpired = must;
        guardUserChange(uid, 'Reset password');
        toast(`Password reset for ${u.display}.`, 'good');
      },
    });
  } else if (kind === 'mfa') {
    u.mfa = 'Re-registration required';
    record('mfa-reset', { user: uid }); guardUserChange(uid, 'Reset MFA');
    toast(`MFA reset for ${u.display}. They'll re-register at next sign-in.`);
  } else if (kind === 'revoke') {
    record('revoke', { user: uid });
    toast(`Signed ${u.display} out of all sessions.`, 'good');
  } else if (kind === 'disable') {
    return modal({
      title: u.disabled ? `Enable ${u.display}?` : `Disable ${u.display}?`,
      body: `<p>${esc(u.display)} · ${esc(u.empId)} · ${esc(u.dept)}</p><p class="muted">${u.disabled ? 'They will be able to sign in again.' : 'They will be unable to sign in anywhere.'}</p>`,
      ok: u.disabled ? 'Enable' : 'Disable', danger: !u.disabled,
      onOk() {
        u.disabled = !u.disabled;
        record(u.disabled ? 'disable' : 'enable', { user: uid });
        if (u.disabled && !['kdoyle', 'kdoyle2'].includes(uid)) penalize(`dis-${uid}`, 20, `Disabled ${u.display}, and no ticket asked for it.`);
        toast(`${u.display} ${u.disabled ? 'disabled' : 'enabled'}.`);
      },
    });
  } else if (kind === 'verify') {
    sendVerification(uid);
  } else if (kind === 'edit') {
    Object.assign(G.drafts, { 'm-first': u.first, 'm-last': u.last, 'm-display': u.display, 'm-email': u.email });
    return modal({
      title: `Edit name & email · ${u.id}`,
      body: ['first', 'last', 'display', 'email'].map(f => `<label class="field"><span>${{ first: 'First name', last: 'Last name', display: 'Display name', email: 'Primary email' }[f]}</span>
        <input id="d-m-${f}" data-draft="m-${f}" value="${esc(G.drafts['m-' + f])}"></label>`).join('') +
        `<p class="muted small">Old email addresses are kept as aliases.</p>`,
      ok: 'Save',
      onOk() {
        const changes = {};
        ['first', 'last', 'display', 'email'].forEach(f => { const v = (G.drafts['m-' + f] || '').trim(); if (v && v !== u[f]) { changes[f] = v; u[f] = v; } });
        if (!Object.keys(changes).length) return;
        record('edit-profile', { user: uid, changes }); guardUserChange(uid, 'Edited profile');
        toast(`Updated ${u.display}.`, 'good');
      },
    });
  } else if (kind === 'addgroup') {
    const avail = Object.keys(GROUPS).filter(g => !u.groups.includes(g));
    G.drafts['m-group'] = avail[0];
    return modal({
      title: `Add ${u.display} to a group`,
      body: `<label class="field"><span>Group</span><select id="d-m-group" data-draft="m-group" data-live="1">${avail.map(g => `<option ${g === G.drafts['m-group'] ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
        <p class="muted small" id="group-desc">${esc(GROUPS[G.drafts['m-group']] || '')}</p>`,
      ok: 'Add',
      onOk() {
        const g = G.drafts['m-group'];
        u.groups.push(g);
        record('group-add', { user: uid, group: g });
        if (g === 'Domain Admins' && uid !== 'jmorales') penalize(`da-${uid}`, 25, `Added ${u.display} to Domain Admins. Tier 1 never does this.`);
        else guardUserChange(uid, `Added to ${g}`);
        toast(`Added ${u.display} to ${g}.`, 'good');
      },
    });
  }
  render();
}

function removeGroup(uid, g) {
  const u = W().users[uid];
  u.groups = u.groups.filter(x => x !== g);
  record('group-remove', { user: uid, group: g });
  if (!['kdoyle', 'kdoyle2'].includes(uid)) guardUserChange(uid, `Removed from ${g}`);
  toast(`Removed ${u.display} from ${g}.`);
  render();
}

// ---------------------------------------------------------------------------
// Remote desktop
// ---------------------------------------------------------------------------
const dev = () => W().devices[G.remote.device];
const outage = () => W().outageUntil > Date.now();

function connect(id) {
  const d = W().devices[id];
  if (outage()) return toast('Connection failed: network unreachable.', 'bad');
  modal({ title: `Remote session · ${id}`, body: `<p>Asking ${esc(who(d.owner))} to accept the remote session…</p><div class="spinner"></div>`, noButtons: true });
  const g = G;
  setTimeout(() => {
    if (G !== g) return;
    G.modal = null;
    G.remote = { device: id, tab: 'overview', term: [{ text: `Microsoft Windows [Version 10.0.22631]\n(c) Microsoft Corporation. All rights reserved.\nType "help" for the commands this simulator supports.\n` }], hist: [], hi: -1 };
    G.view = 'remote';
    record('remote-connect', { device: id, owner: d.owner });
    const legit = openTickets().some(t => t.requester === d.owner || t.device === id || (t.involves || []).includes(d.owner));
    if (!legit) penalize(`rc-${id}`, 10, `Remoted into ${who(d.owner)}'s ${d.type.toLowerCase()} with no open ticket from them.`);
    toast(`${who(d.owner)} accepted. Connected to ${id}.`, 'good');
    render();
  }, 1300);
}

function uninstall(name) {
  const d = dev(), app = d.apps.find(a => a.name === name);
  modal({
    title: `Uninstall ${name}?`, body: `<p>Publisher: ${esc(app.publisher)}<br>Installed: ${esc(app.installed)}</p>`, ok: 'Uninstall', danger: true,
    onOk() {
      d.apps = d.apps.filter(a => a !== app);
      if (app.adware) d.procs = d.procs.filter(p => !['dealfinder.exe', 'qsupdate.exe'].includes(p) || d.apps.some(a => a.adware));
      if (app.critical) d.procs = d.procs.filter(p => p !== 'epagent.exe');
      record('uninstall', { device: d.id, app: name, adware: !!app.adware, critical: !!app.critical });
      if (!app.adware && d.id !== 'BL-LT-1033') penalize(`un-${d.id}-${name}`, 15, `Uninstalled ${name} from ${d.id}, and nothing asked for that.`);
      toast(`${name} uninstalled from ${d.id}.`);
    },
  });
}

function svcAction(name, action) {
  const d = dev(), s = d.services.find(x => x.name === name);
  if (action === 'stop') s.status = 'Stopped';
  else s.status = 'Running';
  record('service', { device: d.id, svc: name, action });
  if (s.core && action === 'stop') penalize(`svc-${d.id}-${name}`, 10, `Stopped ${s.display} on ${d.id}. That breaks core functionality.`);
  toast(`${s.display}: ${action === 'stop' ? 'stopped' : action === 'restart' ? 'restarted' : 'started'}.`);
  render();
}

function setTz(tz) {
  const d = dev();
  d.tz = tz;
  record('tz', { device: d.id, tz });
}

function setDns(mode, a, b) {
  const d = dev();
  d.dnsMode = mode;
  if (mode === 'manual') d.dnsManual = [a || '', b || ''];
  record('dns-mode', { device: d.id, mode });
}

function resolveHost(name, d) {
  if (outage()) return { err: 'timeout' };
  let n = name.toLowerCase().replace(/\.brightline\.local$/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(n)) return { ip: n };
  if (HOSTS.internal[n]) return d.dnsMode === 'dhcp' ? { ip: HOSTS.internal[n], fqdn: n + '.brightline.local' } : { err: 'nx', fqdn: n };
  const devHit = Object.values(W().devices).find(x => x.id.toLowerCase() === n);
  if (devHit) return d.dnsMode === 'dhcp' ? { ip: devHit.ip, fqdn: n + '.brightline.local' } : { err: 'nx', fqdn: n };
  if (HOSTS.external[n]) return { ip: HOSTS.external[n], fqdn: n };
  return { err: 'nx', fqdn: n };
}

function runCmd(raw) {
  const d = dev(), cmd = raw.trim(), lc = cmd.toLowerCase(), p = lc.split(/\s+/);
  const out = [];
  const o = s => out.push(s);
  G.remote.term.push({ prompt: `C:\\Users\\${d.owner}>`, text: cmd });
  if (!cmd) return;
  G.remote.hist.unshift(cmd); G.remote.hi = -1;
  record('cmd', { device: d.id, cmd });
  const dnsServers = d.dnsMode === 'dhcp' ? ['10.20.0.10', '10.20.0.11'] : d.dnsManual.filter(Boolean);

  if (p[0] === 'help') {
    o(`Supported commands:
  hostname, whoami, systeminfo
  ipconfig [/all | /flushdns | /release | /renew]
  ping <host>          nslookup <host>
  tzutil /g            tzutil /s "<Time Zone Name>"
  tasklist             taskkill /im <name> /f
  sc query <service>   net start|stop <service>
  gpupdate /force
  netsh interface ip set dns "Ethernet" dhcp
  cls`);
  } else if (p[0] === 'cls' || p[0] === 'clear') {
    G.remote.term = []; render(); return;
  } else if (p[0] === 'hostname') o(d.id);
  else if (p[0] === 'whoami') o(`brightline\\${d.owner}`);
  else if (p[0] === 'systeminfo') o(`Host Name:        ${d.id}\nOS Name:          Microsoft ${d.os}\nSystem Model:     ${d.model}\nTime Zone:        ${d.tz}\nDomain:           brightline.local\nNetwork Card(s):  Ethernet, ${d.ip}`);
  else if (p[0] === 'ipconfig') {
    if (p[1] === '/flushdns') o('Windows IP Configuration\n\nSuccessfully flushed the DNS Resolver Cache.');
    else if (p[1] === '/release') o('Windows IP Configuration\n\nEthernet adapter Ethernet:\n   IPv4 Address released.');
    else if (p[1] === '/renew') o(`Windows IP Configuration\n\nEthernet adapter Ethernet:\n   IPv4 Address. . . . . . . . . . . : ${d.ip}`);
    else {
      let s = `Windows IP Configuration\n\nEthernet adapter Ethernet:\n\n   Connection-specific DNS Suffix  . : brightline.local\n   IPv4 Address. . . . . . . . . . . : ${d.ip}\n   Subnet Mask . . . . . . . . . . . : ${d.mask}\n   Default Gateway . . . . . . . . . : ${d.gateway}`;
      if (p[1] === '/all') s += `\n   DHCP Enabled. . . . . . . . . . . : Yes\n   DNS Servers . . . . . . . . . . . : ${dnsServers.join('\n                                       ')}`;
      o(s);
    }
  } else if (p[0] === 'ping') {
    if (!p[1]) o('Usage: ping <host>');
    else {
      const r = resolveHost(p[1], d);
      if (r.err === 'nx') o(`Ping request could not find host ${p[1]}. Please check the name and try again.`);
      else if (r.err) o(`Pinging ${p[1]}:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.`);
      else o(`Pinging ${r.fqdn || r.ip} [${r.ip}] with 32 bytes of data:\n` + [1, 2, 3, 4].map(() => `Reply from ${r.ip}: bytes=32 time=${1 + Math.floor(Math.random() * (r.ip.startsWith('10.') ? 3 : 25))}ms TTL=${r.ip.startsWith('10.') ? 128 : 117}`).join('\n'));
    }
  } else if (p[0] === 'nslookup') {
    if (!p[1]) o('Usage: nslookup <host>');
    else {
      const srvName = d.dnsMode === 'dhcp' ? 'dc01.brightline.local' : (dnsServers[0] === '8.8.8.8' ? 'dns.google' : 'UnKnown');
      const head = `Server:  ${srvName}\nAddress:  ${dnsServers[0] || '(none)'}\n\n`;
      const r = resolveHost(p[1], d);
      if (r.err === 'timeout') o('DNS request timed out.');
      else if (r.err) o(head + `*** ${srvName} can't find ${p[1]}: Non-existent domain`);
      else o(head + `Name:    ${r.fqdn || p[1]}\nAddress:  ${r.ip}`);
    }
  } else if (p[0] === 'tzutil') {
    if (p[1] === '/g') o(d.tz);
    else if (p[1] === '/s') {
      const m = cmd.match(/\/s\s+"?([^"]+)"?/i);
      const tz = m && TIME_ZONES.find(z => z.toLowerCase() === m[1].trim().toLowerCase());
      if (!tz) o(`Error: Invalid time zone identifier. Known: ${TIME_ZONES.join(', ')}`);
      else { setTz(tz); o(''); }
    } else o('Usage: tzutil /g | tzutil /s "<Time Zone Name>"');
  } else if (p[0] === 'tasklist') {
    o('Image Name                     PID Session Name\n========================= ======== ============\n' + d.procs.map((x, i) => x.padEnd(26) + String(400 + i * 212).padStart(8) + ' Console').join('\n'));
  } else if (p[0] === 'taskkill') {
    const m = cmd.match(/\/im\s+(\S+)/i);
    const name = m && d.procs.find(x => x.toLowerCase() === m[1].toLowerCase());
    if (!name) o(`ERROR: The process "${m ? m[1] : ''}" not found.`);
    else {
      d.procs = d.procs.filter(x => x !== name);
      o(`SUCCESS: The process "${name}" has been terminated.`);
      if (['dealfinder.exe', 'qsupdate.exe'].includes(name) && d.apps.some(a => a.adware)) {
        const g = G;
        setTimeout(() => { if (G === g && d.apps.some(a => a.adware) && !d.procs.includes(name)) { d.procs.push(name); } }, 15000);
      }
    }
  } else if (p[0] === 'sc' && p[1] === 'query') {
    const s = d.services.find(x => x.name.toLowerCase() === (p[2] || '').toLowerCase());
    o(s ? `SERVICE_NAME: ${s.name}\n        DISPLAY_NAME       : ${s.display}\n        STATE              : ${s.status === 'Running' ? '4  RUNNING' : '1  STOPPED'}` : `[SC] EnumQueryServicesStatus:OpenService FAILED 1060:\n\nThe specified service does not exist as an installed service.`);
  } else if (p[0] === 'net' && (p[1] === 'start' || p[1] === 'stop')) {
    const arg = cmd.split(/\s+/).slice(2).join(' ').replace(/"/g, '').toLowerCase();
    const s = d.services.find(x => x.name.toLowerCase() === arg || x.display.toLowerCase() === arg);
    if (!s) o('The service name is invalid.');
    else if (p[1] === 'start' && s.status === 'Running') o('The requested service has already been started.');
    else if (p[1] === 'stop' && s.status === 'Stopped') o(`The ${s.display} service is not started.`);
    else { svcAction(s.name, p[1]); o(`The ${s.display} service ${p[1] === 'start' ? 'was started' : 'was stopped'} successfully.`); }
  } else if (p[0] === 'gpupdate') {
    o('Updating policy...\n\nComputer Policy update has completed successfully.\nUser Policy update has completed successfully.');
    record('gpupdate', { device: d.id });
  } else if (p[0] === 'netsh' && /set dns/.test(lc)) {
    if (/dhcp/.test(lc)) { setDns('dhcp'); o('Ok.'); }
    else { const ip = cmd.match(/(\d+\.\d+\.\d+\.\d+)/); if (ip) { setDns('manual', ip[1], ''); o('Ok.'); } else o('The syntax supplied for this command is not valid.'); }
  } else {
    o(`'${cmd.split(/\s+/)[0]}' is not recognized as an internal or external command,\noperable program or batch file.`);
  }
  if (out.length) G.remote.term.push({ text: out.join('\n') });
  render();
}

// ---------------------------------------------------------------------------
// Server room
// ---------------------------------------------------------------------------
function netAction(id, kind) {
  const w = W(), n = w.network.find(x => x.id === id);
  const bootAfter = (nodes, ms) => {
    const g = G;
    nodes.forEach(x => { x.status = 'booting'; });
    render();
    setTimeout(() => { if (G !== g) return; nodes.forEach(x => { x.status = 'online'; }); toast(`${nodes.map(x => x.id).join(', ')} back online.`, 'good'); render(); }, ms);
  };
  if (kind === 'poe') {
    record('poe-cycle', { target: id });
    toast(`Power-cycling ${n.uplink}…`);
    return bootAfter([n], 5000);
  }
  if (kind === 'reboot' && n.role === 'ap') {
    if (n.status === 'offline') { record('ap-reboot-fail', { target: id }); return toast(`${id} did not respond to the management request (timeout).`, 'bad'); }
    record('net-reboot', { target: id });
    penalize(`apr-${id}`, 5, `Rebooted ${id}, a healthy AP. ${n.clients} people just lost Wi-Fi.`);
    return bootAfter([n], 5000);
  }
  modal({
    title: `Restart ${id}?`, body: `<p>${esc(n.type)} · ${esc(n.location)}</p><p class="muted">${esc(n.note)}</p>`, ok: 'Restart', danger: true,
    onOk() {
      record('net-reboot', { target: id });
      if (n.role === 'core') {
        w.outageUntil = Date.now() + 12000;
        penalize(`core-${id}`, 30, `Restarted ${id}. The whole company lost the network for several minutes to fix one problem.`);
        bootAfter([n], 12000);
      } else {
        const floor = id.slice(0, 3);
        const aps = w.network.filter(x => x.role === 'ap' && x.uplink && x.uplink.startsWith(id));
        penalize(`floor-${id}`, 15, `Restarted ${id}. Everyone wired on ${floor === 'FL1' ? 'floor 1' : floor} went offline. Cycle a single port next time.`);
        bootAfter([n, ...aps], 8000);
      }
    },
  });
}

function serverSvc(host, name, action) {
  const srv = W().servers[host], s = srv.services.find(x => x.name === name);
  s.status = action === 'stop' ? 'Stopped' : 'Running';
  record('server-service', { host, svc: name, action });
  if (s.critical && action !== 'start') penalize(`ss-${host}-${name}`, 20, `${action === 'stop' ? 'Stopped' : 'Restarted'} ${s.display} on ${host}. Company-wide services were disrupted.`);
  if (host === 'PRINT01' && name === 'Spooler' && s.status === 'Running' && srv.queued) {
    const g = G;
    setTimeout(() => { if (G !== g) return; srv.queued = 0; toast('PRINT01: 23 queued jobs printed.', 'good'); render(); }, 3000);
  }
  toast(`${host} · ${s.display}: ${s.status.toLowerCase()}.`);
  render();
}

function alerts() {
  const w = W(), a = [];
  if (outage()) a.push({ sev: 'crit', text: 'Core network restarting: all floors unreachable.' });
  w.network.filter(n => n.status === 'offline').forEach(n => a.push({ sev: 'warn', text: `${n.id} (${n.location}) is not responding.` }));
  Object.entries(w.servers).forEach(([h, s]) => s.services.filter(x => x.status !== 'Running').forEach(x => a.push({ sev: 'crit', text: `${h}: ${x.display} is stopped.` })));
  return a;
}

// ---------------------------------------------------------------------------
// Modal + toast
// ---------------------------------------------------------------------------
function modal(m) { G.modal = m; render(); }
function check(key, label) {
  return `<label class="check"><input type="checkbox" id="d-${key}" data-draft="${key}" ${G.drafts[key] ? 'checked' : ''}> ${esc(label)}</label>`;
}
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4700);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const I = {
  queue: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  dir: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2"/></svg>',
  remote: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>',
  server: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="7" rx="1.5"/><rect x="4" y="14" width="16" height="7" rx="1.5"/><path d="M8 6.5h.01M8 17.5h.01"/></svg>',
  kb: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
};

function render() {
  const app = $('#app');
  app.dataset.phase = G ? G.phase : PAGE;
  const a = document.activeElement, fid = a && a.id, s1 = a && a.selectionStart, s2 = a && a.selectionEnd;
  const mainScroll = $('#main').scrollTop;

  if (!G && PAGE === 'pricing') { $('#main').innerHTML = renderPricing(); $('#topbar').innerHTML = topbarStart(); $('#sidebar').innerHTML = ''; $('#ticketpanel').innerHTML = ''; $('#modal-root').innerHTML = ''; return; }

  if (!G || G.phase === 'start') { $('#main').innerHTML = renderStart(); $('#topbar').innerHTML = topbarStart(); $('#sidebar').innerHTML = ''; $('#ticketpanel').innerHTML = ''; $('#modal-root').innerHTML = ''; return; }
  if (G.phase === 'report') { $('#main').innerHTML = renderReport(); $('#topbar').innerHTML = topbarStart(); $('#sidebar').innerHTML = ''; $('#ticketpanel').innerHTML = ''; $('#modal-root').innerHTML = renderModal(); return; }

  $('#topbar').innerHTML = renderTopbar();
  $('#sidebar').innerHTML = renderSidebar();
  $('#main').innerHTML = ({ queue: renderQueue, dir: renderDirectory, remote: renderRemote, server: renderServer, kb: renderKB })[G.view]();
  $('#ticketpanel').innerHTML = renderTicketPanel();
  $('#modal-root').innerHTML = renderModal();
  $('#main').scrollTop = mainScroll;

  const th = $('#thread');
  if (th) th.scrollTop = th.scrollHeight;
  const term = $('#term-out');
  if (term) term.scrollTop = term.scrollHeight;
  if (fid) {
    const el = document.getElementById(fid);
    if (el) { el.focus(); try { el.setSelectionRange(s1, s2); } catch { /* not a text input */ } }
  } else if (G.view === 'remote' && G.remote.tab === 'terminal' && !G.modal) {
    $('#term-input')?.focus();
  }
}

function topbarStart() {
  return `<button class="brand as-link" data-act="home">${logo()}<span>Shift One</span><small>Help Desk Simulator</small></button><div class="grow"></div>
    <nav class="top-links"><button class="${!G && PAGE === 'pricing' ? 'on' : ''}" data-act="pricing">Tutoring &amp; Pricing</button>${CONFIG.repoUrl ? `<a href="${esc(CONFIG.repoUrl)}" target="_blank" rel="noopener">GitHub</a>` : ''}</nav>${themeBtn()}`;
}

function planHref(p) {
  if (p.paymentLink) return p.paymentLink;
  if (p.action === 'contact' || p.price) return CONFIG.contactEmail ? `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent('Shift One: ' + p.name)}` : CONFIG.bookingUrl || '';
  return '';
}

function renderPricing() {
  return `<div class="pricing">
    <div class="hero center-hero"><div class="kicker">Tutoring &amp; pricing</div>
      <h1>Practise alone for free.<br>Get coached when you're ready.</h1>
      <p>The simulator is free for everyone. Paid options add a tutor who watches you work a shift, explains every point on your report, and gets you ready for a Tier 1 interview.</p></div>
    <div class="plans">${CONFIG.plans.map(p => {
      const href = planHref(p);
      const btn = p.action === 'play'
        ? `<button class="btn ${p.highlight ? 'primary' : ''} lg block" data-act="start" data-m="practice">${esc(p.cta)}</button>`
        : href ? `<a class="btn ${p.highlight ? 'primary' : ''} lg block" href="${esc(href)}" target="_blank" rel="noopener">${esc(p.cta)}</a>`
        : `<button class="btn lg block" disabled title="Add a payment link in js/config.js">Coming soon</button>`;
      return `<div class="plan ${p.highlight ? 'hl' : ''}">${p.highlight ? '<span class="ribbon">Most popular</span>' : ''}
        <h3>${esc(p.name)}</h3><p class="muted">${esc(p.blurb)}</p>
        <div class="price">${p.price === null ? '<b>Let\'s talk</b>' : p.price === 0 ? '<b>Free</b>' : `<b>${esc(CONFIG.currency)}${p.price.toLocaleString('en-US')}</b>`}<span>${esc(p.per)}</span></div>
        <ul>${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>${btn}</div>`;
    }).join('')}</div>
    <p class="muted small center">Payments are handled by a secure hosted checkout. Card details never touch this site.${CONFIG.bookingUrl ? ` Prefer to pick a time first? <a href="${esc(CONFIG.bookingUrl)}" target="_blank" rel="noopener">See availability</a>.` : ''}</p>
  </div>`;
}
function logo() { return '<svg class="logo" viewBox="0 0 32 32"><rect x="2" y="5" width="28" height="19" rx="3"/><path d="M8 12l4 3-4 3M15 18h7" /><path d="M11 28h10"/></svg>'; }
function themeBtn() { return `<button class="icon-btn" data-act="theme" title="Toggle light/dark">${document.documentElement.dataset.theme === 'dark' ? '☀' : '☾'}</button>`; }

function renderTopbar() {
  const closed = G.tickets.filter(t => t.result);
  const avg = closed.length ? Math.round(closed.reduce((a, t) => a + t.result.score, 0) / closed.length) : null;
  const pen = G.penalties.reduce((a, p) => a + p.pts, 0);
  return `<div class="brand">${logo()}<span>Shift One</span><small>${G.mode === 'practice' ? 'Practice mode' : 'Timed shift'}</small></div>
    <div class="stats">
      <div><small>Shift time</small><b id="clock">${fmt(now())}</b></div>
      <div><small>Open</small><b>${openTickets().length}</b></div>
      <div><small>Closed</small><b>${closed.length}/${SCENARIOS.length}</b></div>
      <div><small>Avg score</small><b>${avg ?? '–'}</b></div>
      ${pen ? `<div class="pen"><small>Penalties</small><b>−${pen}</b></div>` : ''}
    </div>
    <div class="grow"></div>
    ${themeBtn()}
    <button class="btn ${G.tickets.length === SCENARIOS.length && !openTickets().length ? 'primary pulse' : ''}" data-act="endShift">End shift</button>`;
}

function renderSidebar() {
  const nav = [['queue', 'Ticket Queue', openTickets().length], ['dir', 'Directory'], ['remote', 'Remote Desktop', G.remote.device ? '●' : ''], ['server', 'Server Room', alerts().length], ['kb', 'Knowledge Base']];
  return nav.map(([v, label, badge]) => `<button class="nav ${G.view === v ? 'on' : ''}" data-act="view" data-v="${v}">${I[v]}<span>${label}</span>${badge ? `<em class="${v === 'server' ? 'warn' : ''}">${badge}</em>` : ''}</button>`).join('') +
    `<div class="sidebar-foot"><div class="muted small">Brightline Logistics<br>Tier 1 Service Desk</div></div>`;
}

const prioBadge = p => `<span class="prio p-${p.toLowerCase()}">${p}</span>`;
const statusBadge = s => `<span class="status s-${s.toLowerCase()}">${s}</span>`;
function slaCell(t) {
  if (t.result) return `<span class="muted">${t.result.score}/100</span>`;
  if (G.mode === 'practice') return '<span class="muted">–</span>';
  const l = slaLeft(t);
  return `<span data-sla="${t.id}" class="sla ${l < 0 ? 'breach' : l < 60 ? 'soon' : ''}">${fmt(l)}</span>`;
}

function renderQueue() {
  const list = G.tickets.filter(t => G.queueFilter === 'all' ? true : G.queueFilter === 'open' ? !t.result : !!t.result)
    .sort((a, b) => (!!a.result - !!b.result) || PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority] || a.arrived - b.arrived);
  const pending = SCENARIOS.length - G.tickets.length;
  return `<div class="view-head"><h2>Ticket Queue</h2>
      <div class="seg">${['open', 'closed', 'all'].map(f => `<button class="${G.queueFilter === f ? 'on' : ''}" data-act="qf" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div></div>
    <p class="hint">Pick a ticket, assign it to yourself, then use the tools on the left to fix it. Tickets are graded on the state of the systems, not on what you say you did.</p>
    <div class="card"><table class="tbl clickable">
      <thead><tr><th>Priority</th><th>Ticket</th><th>Requester</th><th>Status</th><th>${G.mode === 'practice' ? 'Score' : 'SLA left'}</th></tr></thead>
      <tbody>${list.map(t => `<tr class="${G.active === t.id ? 'sel' : ''} ${t.unread && !t.result ? 'unread' : ''}" data-act="open" data-id="${t.id}">
        <td>${prioBadge(t.priority)}</td>
        <td><div class="tid">${t.id}</div><div class="ttl">${esc(t.title)}</div></td>
        <td>${esc(t.external ? t.external : who(t.requester))}</td>
        <td class="nowrap">${statusBadge(t.status)}${t.assigned && !t.result ? ' <span class="mine" title="Assigned to you">you</span>' : ''}</td>
        <td>${slaCell(t)}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Nothing here.</td></tr>`}
      </tbody></table></div>
    ${pending && G.mode === 'shift' ? `<p class="muted small center">${pending} more ticket${pending > 1 ? 's' : ''} will arrive during the shift.</p>` : ''}`;
}

function renderTicketPanel() {
  const t = ticket(G.active);
  if (!t) return `<div class="panel-empty">${I.queue}<p>Select a ticket from the queue.</p></div>`;
  t.unread = false;
  const u = W().users[t.requester];
  const closed = !!t.result;
  const qs = t.questions.filter(q => !t.asked.includes(q.id));
  const kb = KB.find(k => k.id === t.kb);
  return `<div class="tp-head">
      <div class="row">${prioBadge(t.priority)}<span class="tid">${t.id}</span>${statusBadge(t.status)}<div class="grow"></div>${G.mode === 'shift' && !closed ? `<span class="muted small">SLA</span> ${slaCell(t)}` : ''}</div>
      <h3>${esc(t.title)}</h3>
      <div class="requester" data-act="gotoUser" data-u="${t.requester}" title="Open in Directory">
        <div class="avatar">${esc(u.first[0] + u.last[0])}</div>
        <div><b>${esc(u.display)}</b>${t.external ? ` <span class="ext">EXTERNAL · ${esc(t.external)}</span>` : ''}<div class="muted small">${esc(u.title)} · ${esc(u.dept)} · ${esc(u.location)}</div></div>
      </div>
      <div class="row gap">
        ${t.assigned ? '<span class="assigned">Assigned to you</span>' : closed ? '' : '<button class="btn primary sm" data-act="assign">Assign to me</button>'}
        ${!closed ? `<button class="btn sm" data-act="verify" data-u="${t.verifyUser}">Verify requester</button>` : ''}
        ${t.device ? `<button class="btn sm ghost" data-act="gotoDevice" data-d="${t.device}">${I.remote}${t.device}</button>` : ''}
      </div>
    </div>
    <div class="thread" id="thread">
      ${t.thread.map(m => `<div class="msg ${m.from === 'tech' ? 'me' : m.from === 'system' ? 'sys' : ''}">
        ${m.from !== 'system' ? `<div class="from">${esc(m.from === t.requester && t.external ? who(m.from) + ' (' + t.external + ')' : who(m.from))} <span class="muted">· ${fmt(m.at)}</span></div>` : ''}
        <div class="bubble">${esc(m.text)}</div></div>`).join('')}
      ${t.typing ? `<div class="msg"><div class="from">${esc(who(t.typing))}</div><div class="bubble typing"><i></i><i></i><i></i></div></div>` : ''}
    </div>
    ${closed ? renderResult(t) : `
    <div class="tp-actions">
      ${qs.length ? `<div class="asks"><div class="label">Ask the requester</div>${qs.map(q => `<button class="ask" data-act="ask" data-q="${q.id}">${esc(q.q)}</button>`).join('')}</div>` : ''}
      <div class="reply"><input id="reply-input" data-draft="reply-${t.id}" placeholder="Reply to requester…" value="${esc(G.drafts['reply-' + t.id] || '')}"><button class="btn sm" data-act="reply">Send</button></div>
      <details class="close-box" ${G.drafts['open-close-' + t.id] ? 'open' : ''}>
        <summary>Close ticket</summary>
        <label class="field"><span>Category</span><select id="d-cat-${t.id}" data-draft="cat-${t.id}"><option value="">Choose…</option>${CATEGORIES.map(c => `<option ${G.drafts['cat-' + t.id] === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="field"><span>Resolution notes (what did you do?)</span><textarea id="d-note-${t.id}" data-draft="note-${t.id}" rows="3" placeholder="e.g. Verified identity via code, unlocked account…">${esc(G.drafts['note-' + t.id] || '')}</textarea></label>
        <div class="row gap"><button class="btn primary" data-act="resolve">Resolve</button>
          <select id="d-team-${t.id}" data-draft="team-${t.id}" class="sm"><option value="">Escalate to…</option>${ESCALATION_TEAMS.map(x => `<option ${G.drafts['team-' + t.id] === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
          <button class="btn" data-act="escalate">Escalate</button></div>
      </details>
      ${kb ? `<button class="kb-link" data-act="gotoKb" data-k="${kb.id}">${I.kb} Related: ${kb.id} ${esc(kb.title)}</button>` : ''}
    </div>`}`;
}

function renderResult(t) {
  const r = t.result;
  return `<div class="result"><div class="score-ring ${r.score >= 80 ? 'good' : r.score >= 50 ? 'ok' : 'bad'}">${r.score}</div>
    <div><b>${r.action === 'escalate' ? 'Escalated to ' + esc(r.team) : 'Resolved'}</b>
    <ul class="fb">${r.good.map(g => `<li class="g">${esc(g)}</li>`).join('')}${r.ded.map(d => `<li class="b"><b>−${d[0]}</b> ${esc(d[1])}</li>`).join('')}</ul></div></div>`;
}

function userChips(u) {
  return [u.locked && '<span class="chip bad">Locked</span>', u.disabled && '<span class="chip muted">Disabled</span>', u.pwdExpired && '<span class="chip warn">Must change pwd</span>'].filter(Boolean).join('');
}

function renderDirectory() {
  const q = (G.drafts.dirq || '').toLowerCase();
  const users = Object.values(W().users).filter(u => !q || [u.display, u.id, u.empId, u.dept, u.email].some(x => x.toLowerCase().includes(q))).sort((a, b) => a.last.localeCompare(b.last));
  const u = W().users[G.dir.user];
  const tabs = ['profile', 'groups', 'devices', 'authentication'];
  let content = '<div class="panel-empty"><p>Select a user.</p></div>';
  if (u) {
    const f = (k, v) => `<div class="kv"><small>${k}</small><div>${esc(v || '—')}</div></div>`;
    const body = {
      profile: () => `<div class="sec-head"><h4>Identity</h4><button class="btn sm" data-act="dir" data-k="edit">Edit name &amp; email</button></div>
        <div class="grid3">${f('Display name', u.display)}${f('First name', u.first)}${f('Last name', u.last)}${f('Username', u.id)}${f('Email', u.email)}${f('Employee ID', u.empId)}</div>
        <h4>Organization</h4><div class="grid3">${f('Title', u.title)}${f('Department', u.dept)}${f('Manager', u.manager ? who(u.manager) : '')}${f('Location', u.location)}${f('Phone', u.phone)}${f('Last sign-in', u.lastLogin)}</div>`,
      groups: () => `<div class="sec-head"><h4>Member of (${u.groups.length})</h4><button class="btn sm" data-act="dir" data-k="addgroup">Add to group</button></div>
        <table class="tbl"><tbody>${u.groups.map(g => `<tr><td><b>${esc(g)}</b><div class="muted small">${esc(GROUPS[g])}</div></td><td class="right"><button class="btn sm ghost" data-act="rmgroup" data-g="${esc(g)}">Remove</button></td></tr>`).join('') || '<tr><td class="empty">No group memberships.</td></tr>'}</tbody></table>`,
      devices: () => `<h4>Assigned devices</h4><table class="tbl"><tbody>${u.devices.map(id => { const d = W().devices[id]; return `<tr><td><b>${id}</b><div class="muted small">${d.model} · ${d.os}</div></td><td class="right"><button class="btn sm" data-act="gotoDevice" data-d="${id}">Remote in</button></td></tr>`; }).join('') || '<tr><td class="empty">No devices assigned.</td></tr>'}</tbody></table>`,
      authentication: () => `<h4>Status</h4><div class="grid3">
          ${f('Account', u.disabled ? 'Disabled' : u.locked ? `Locked (${u.failedLogins} failed attempts)` : 'Active')}${f('Password', u.pwdExpired ? 'Must change at next sign-in' : 'OK')}${f('MFA', u.mfa)}</div>
        <h4>Actions</h4><div class="btn-grid">
          <button class="btn" data-act="dir" data-k="reset">Reset password</button>
          <button class="btn" data-act="dir" data-k="unlock">Unlock account</button>
          <button class="btn" data-act="dir" data-k="mfa">Reset MFA</button>
          <button class="btn" data-act="dir" data-k="revoke">Sign out all sessions</button>
          <button class="btn ${u.disabled ? '' : 'danger-ghost'}" data-act="dir" data-k="disable">${u.disabled ? 'Enable account' : 'Disable account'}</button></div>
        <h4>Identity verification</h4><p class="muted small">Sends a one-time code to the registered mobile (••• ${u.empId.slice(-4)}). The person should read it back to you.</p>
        <button class="btn" data-act="dir" data-k="verify">Send verification code</button>`,
    }[G.dir.tab]();
    content = `<div class="dir-user"><div class="avatar lg">${esc(u.first[0] + u.last[0])}</div><div><h3>${esc(u.display)} ${userChips(u)}</h3><div class="muted">${esc(u.email)} · ${esc(u.empId)}</div></div></div>
      <div class="tabs">${tabs.map(x => `<button class="${G.dir.tab === x ? 'on' : ''}" data-act="dirTab" data-t="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div>
      <div class="tab-body">${body}</div>`;
  }
  return `<div class="view-head"><h2>Directory</h2><span class="muted">brightline.local · ${Object.keys(W().users).length} users</span></div>
    <div class="split card">
      <div class="list"><input class="search" id="dirq" data-draft="dirq" data-live="1" placeholder="Search name, username, ID…" value="${esc(G.drafts.dirq || '')}">
        ${users.map(x => `<button class="li ${x.id === G.dir.user ? 'on' : ''}" data-act="pickUser" data-u="${x.id}"><b>${esc(x.display)}</b> ${userChips(x)}<div class="muted small">${x.id} · ${esc(x.dept)}</div></button>`).join('')}</div>
      <div class="detail">${content}</div></div>`;
}

function renderRemote() {
  const d = dev();
  if (!d) {
    const q = (G.drafts.devq || '').toLowerCase();
    const list = Object.values(W().devices).filter(x => !q || [x.id, who(x.owner), x.ip].some(s => s.toLowerCase().includes(q)));
    return `<div class="view-head"><h2>Remote Desktop</h2></div>
      <p class="hint">Remote sessions need the user's consent and should always be tied to a ticket.</p>
      <div class="card"><input class="search" id="devq" data-draft="devq" data-live="1" placeholder="Search by hostname, owner or IP…" value="${esc(G.drafts.devq || '')}">
      <table class="tbl"><thead><tr><th>Hostname</th><th>Owner</th><th>Type</th><th>IP</th><th></th></tr></thead><tbody>
      ${list.map(x => `<tr><td><b>${x.id}</b></td><td>${esc(who(x.owner))}</td><td>${x.type}</td><td class="mono">${x.ip}</td><td class="right"><button class="btn sm" data-act="connect" data-d="${x.id}">Connect</button></td></tr>`).join('')}
      </tbody></table></div>`;
  }
  const tabs = [['overview', 'Overview'], ['apps', 'Apps & features'], ['services', 'Services'], ['settings', 'Settings'], ['terminal', 'Command Prompt']];
  const tab = G.remote.tab;
  let body = '';
  if (tab === 'overview') {
    const adware = d.apps.some(a => a.adware);
    body = `<div class="rd-overview"><div class="grid2">
        ${[['Hostname', d.id], ['Signed-in user', `brightline\\${d.owner}`], ['Model', d.model], ['OS', d.os], ['IPv4', d.ip], ['DNS', d.dnsMode === 'dhcp' ? 'Automatic (DHCP)' : 'Manual: ' + d.dnsManual.filter(Boolean).join(', ')], ['Time zone', d.tz], ['Uptime', d.uptime]].map(([k, v]) => `<div class="kv"><small>${k}</small><div>${esc(v)}</div></div>`).join('')}</div>
      <div class="desktop"><div class="taskbar"><span>⊞</span><span class="grow"></span><span>${deskClock(d.tz)}</span></div>
        ${adware ? '<div class="popup p1"><b>DealFinder</b> 🔥 90% OFF laptops, today only! <u>Claim now</u></div><div class="popup p2"><b>QuickSearch</b> Make QuickSearch your homepage?</div>' : ''}
        <div class="desk-label">Live screen preview</div></div></div>`;
  } else if (tab === 'apps') {
    body = `<table class="tbl"><thead><tr><th>Name</th><th>Publisher</th><th>Installed</th><th></th></tr></thead><tbody>
      ${d.apps.map(a => `<tr><td><b>${esc(a.name)}</b></td><td>${esc(a.publisher)}</td><td>${esc(a.installed)}</td><td class="right"><button class="btn sm ghost" data-act="uninstall" data-a="${esc(a.name)}">Uninstall</button></td></tr>`).join('')}</tbody></table>`;
  } else if (tab === 'services') {
    body = `<table class="tbl"><thead><tr><th>Service</th><th>Name</th><th>Status</th><th></th></tr></thead><tbody>
      ${d.services.map(s => `<tr><td><b>${s.display}</b></td><td class="mono">${s.name}</td><td>${s.status === 'Running' ? '<span class="dot ok"></span>Running' : '<span class="dot bad"></span>Stopped'}</td>
        <td class="right">${s.status === 'Running' ? `<button class="btn sm ghost" data-act="svc" data-s="${s.name}" data-x="restart">Restart</button><button class="btn sm ghost" data-act="svc" data-s="${s.name}" data-x="stop">Stop</button>` : `<button class="btn sm" data-act="svc" data-s="${s.name}" data-x="start">Start</button>`}</td></tr>`).join('')}</tbody></table>`;
  } else if (tab === 'settings') {
    const tzDraft = G.drafts['tz-' + d.id] ?? d.tz;
    const dnsMode = G.drafts['dnsmode-' + d.id] ?? d.dnsMode;
    body = `<div class="settings">
      <section><h4>Date &amp; time</h4><label class="field"><span>Time zone</span><select id="d-tz" data-draft="tz-${d.id}">${TIME_ZONES.map(z => `<option ${z === tzDraft ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
        <button class="btn" data-act="applyTz">Apply</button></section>
      <section><h4>Ethernet · IPv4 DNS settings</h4>
        <label class="check"><input type="radio" name="dns" data-act="dnsMode" data-m="dhcp" ${dnsMode === 'dhcp' ? 'checked' : ''}> Obtain DNS server address automatically</label>
        <label class="check"><input type="radio" name="dns" data-act="dnsMode" data-m="manual" ${dnsMode === 'manual' ? 'checked' : ''}> Use the following DNS server addresses:</label>
        <div class="grid2 ${dnsMode === 'manual' ? '' : 'disabled'}">
          <label class="field"><span>Preferred</span><input id="d-dns1" data-draft="dns1-${d.id}" value="${esc(G.drafts['dns1-' + d.id] ?? d.dnsManual[0])}"></label>
          <label class="field"><span>Alternate</span><input id="d-dns2" data-draft="dns2-${d.id}" value="${esc(G.drafts['dns2-' + d.id] ?? d.dnsManual[1])}"></label></div>
        <button class="btn" data-act="applyDns">Apply</button></section></div>`;
  } else {
    body = `<div class="terminal"><pre id="term-out">${G.remote.term.map(l => l.prompt ? `<span class="pr">${esc(l.prompt)}</span>${esc(l.text)}` : esc(l.text)).join('\n')}</pre>
      <div class="term-line"><span class="pr">C:\\Users\\${esc(d.owner)}&gt;</span><input id="term-input" autocomplete="off" spellcheck="false" value="${esc(G.drafts.term || '')}" data-draft="term"></div></div>`;
  }
  return `<div class="view-head"><h2>Remote Desktop</h2><div class="grow"></div><span class="session-pill"><span class="dot ok"></span>Connected to ${d.id} · ${esc(who(d.owner))}</span><button class="btn sm" data-act="disconnect">Disconnect</button></div>
    <div class="card rd"><div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="rdTab" data-t="${k}">${l}</button>`).join('')}</div><div class="tab-body">${body}</div></div>`;
}

function deskClock(tz) {
  const off = { 'Eastern Standard Time': 0, 'Central Standard Time': -1, 'Mountain Standard Time': -2, 'Pacific Standard Time': -3, 'GMT Standard Time': 5, 'UTC': 4 }[tz] ?? 0;
  const mins = 9 * 60 + 15 + Math.floor(now() / 10) + off * 60;
  const h = ((Math.floor(mins / 60) % 24) + 24) % 24;
  return `${h % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function renderServer() {
  const w = W(), tab = G.server.tab, al = alerts();
  const netOnline = w.network.filter(n => n.status === 'online').length;
  const svcDown = Object.values(w.servers).reduce((a, s) => a + s.services.filter(x => x.status !== 'Running').length, 0);
  const stColor = s => s === 'online' ? 'ok' : s === 'booting' ? 'warn' : 'bad';
  let body;
  if (tab === 'overview') {
    body = `<div class="cards4">
        <div class="stat"><small>Network devices</small><b>${netOnline}/${w.network.length}</b><span>online</span></div>
        <div class="stat"><small>Servers</small><b>${Object.keys(w.servers).length}</b><span>reachable</span></div>
        <div class="stat ${svcDown ? 'bad' : ''}"><small>Stopped services</small><b>${svcDown}</b><span>on servers</span></div>
        <div class="stat ${al.length ? 'warn' : ''}"><small>Active alerts</small><b>${al.length}</b><span>open</span></div></div>
      <h4>Alerts</h4><div class="alerts">${al.map(a => `<div class="alert ${a.sev}">${esc(a.text)}</div>`).join('') || '<div class="muted">All clear.</div>'}</div>
      <h4>Topology</h4><div class="topo">
        <div class="tier">${w.network.filter(n => n.role === 'core').map(n => `<span class="node ${stColor(n.status)}">${n.id}</span>`).join('')}</div>
        <div class="tier">${w.network.filter(n => n.role === 'floor').map(n => `<span class="node ${stColor(n.status)}">${n.id}</span>`).join('')}</div>
        <div class="tier">${w.network.filter(n => n.role === 'ap').map(n => `<span class="node ${stColor(n.status)}">${n.id}</span>`).join('')}</div></div>`;
  } else if (tab === 'network') {
    body = `<table class="tbl"><thead><tr><th>Device</th><th>Type</th><th>Location</th><th>Status</th><th></th></tr></thead><tbody>
      ${w.network.map(n => `<tr><td><b>${n.id}</b>${n.uplink ? `<div class="muted small">Uplink: ${n.uplink}</div>` : ''}</td><td>${n.type}</td><td>${esc(n.location)}</td>
        <td><span class="dot ${stColor(n.status)}"></span>${n.status}${n.role === 'ap' && n.status === 'online' ? ` <span class="muted small">· ${n.clients} clients</span>` : ''}</td>
        <td class="right">${n.status === 'booting' ? '' : n.role === 'ap' ? `<button class="btn sm ghost" data-act="net" data-n="${n.id}" data-k="reboot">Reboot</button><button class="btn sm ghost" data-act="net" data-n="${n.id}" data-k="poe">Power-cycle PoE port</button>` : `<button class="btn sm ghost" data-act="net" data-n="${n.id}" data-k="restart">Restart</button>`}</td></tr>`).join('')}</tbody></table>`;
  } else {
    body = `<div class="servers">${Object.entries(w.servers).map(([h, s]) => `<div class="srv">
      <div class="sec-head"><div><b>${h}</b> <span class="muted small">${s.ip}</span><div class="muted small">${s.role}</div></div>${s.queued ? `<span class="chip warn">${s.queued} jobs queued</span>` : ''}</div>
      ${['cpu', 'mem', 'disk'].map(k => `<div class="meter"><small>${k.toUpperCase()}</small><div><i style="width:${s[k]}%" class="${s[k] > 75 ? 'hi' : ''}"></i></div><span>${s[k]}%</span></div>`).join('')}
      <table class="tbl compact"><tbody>${s.services.map(x => `<tr><td>${x.status === 'Running' ? '<span class="dot ok"></span>' : '<span class="dot bad"></span>'}${x.display}</td>
        <td class="right">${x.status === 'Running' ? `<button class="btn xs ghost" data-act="ssvc" data-h="${h}" data-s="${x.name}" data-x="restart">Restart</button><button class="btn xs ghost" data-act="ssvc" data-h="${h}" data-s="${x.name}" data-x="stop">Stop</button>` : `<button class="btn xs" data-act="ssvc" data-h="${h}" data-s="${x.name}" data-x="start">Start</button>`}</td></tr>`).join('')}</tbody></table>
      ${s.events && s.services.some(x => x.status !== 'Running') ? `<div class="events">${s.events.map(e => `<div>⚠ ${esc(e)}</div>`).join('')}</div>` : ''}
      </div>`).join('')}</div>`;
  }
  return `<div class="view-head"><h2>Server Room</h2>${outage() ? '<span class="chip bad">NETWORK OUTAGE</span>' : ''}</div>
    <div class="card"><div class="tabs">${[['overview', 'Overview'], ['network', 'Network'], ['servers', 'Servers']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="srvTab" data-t="${k}">${l}</button>`).join('')}</div><div class="tab-body">${body}</div></div>`;
}

function renderKB() {
  const q = (G.drafts.kbq || '').toLowerCase();
  const list = KB.filter(k => !q || (k.title + ' ' + k.tags + ' ' + k.id).toLowerCase().includes(q));
  const a = KB.find(k => k.id === G.kb.article);
  return `<div class="view-head"><h2>Knowledge Base</h2><span class="muted">${KB.length} articles</span></div>
    <div class="split card"><div class="list"><input class="search" id="kbq" data-draft="kbq" data-live="1" placeholder="Search articles…" value="${esc(G.drafts.kbq || '')}">
      ${list.map(k => `<button class="li ${a && a.id === k.id ? 'on' : ''}" data-act="kb" data-k="${k.id}"><span class="muted small">${k.id}</span><div>${esc(k.title)}</div></button>`).join('')}</div>
    <div class="detail article">${a ? `<span class="muted small">${a.id}</span><h3>${esc(a.title)}</h3>${a.body}` : '<div class="panel-empty"><p>Pick an article.</p></div>'}</div></div>`;
}

function renderModal() {
  const m = G.modal;
  if (!m) return '';
  return `<div class="overlay"><div class="modal"><h3>${esc(m.title)}</h3><div class="modal-body">${m.body}</div>
    ${m.noButtons ? '' : `<div class="row gap end"><button class="btn" data-act="modalCancel">Cancel</button><button class="btn ${m.danger ? 'danger' : 'primary'}" data-act="modalOk">${esc(m.ok || 'OK')}</button></div>`}</div></div>`;
}

function renderStart() {
  const best = store.get('shiftone-best');
  return `<div class="start">
    <div class="hero"><div class="kicker">Tier 1 service desk training</div>
      <h1>Learn the service desk<br>by working one.</h1>
      <p>You're the new service desk technician at <b>Brightline Logistics</b>. Tickets arrive. Users are waiting. Work them with real tools: a directory, remote desktop, a command prompt, and a server room. You're graded on what actually changed, how safely you did it, and how fast.</p>
      <div class="row gap wrap"><button class="btn primary lg" data-act="start" data-m="shift">Start timed shift</button><button class="btn lg" data-act="start" data-m="practice">Practice mode (no timer)</button></div>
      ${best ? `<p class="muted small">Best shift score: <b>${esc(best)}</b></p>` : ''}
      <button class="kb-link" data-act="pricing">Want a coach while you play? See tutoring options →</button></div>
    <div class="features">
      ${[['Ticket Queue', 'Prioritise by impact, ask the right questions, write notes the next tech can use.'],
        ['Directory', 'Unlock, reset, verify identity, manage groups, and don\'t hand an attacker the CFO\'s account.'],
        ['Remote Desktop', 'Uninstall adware, fix time zones and DNS, and use a working command prompt.'],
        ['Server Room', 'Tell one broken laptop from one broken floor. Restart the right thing, not everything.'],
        ['Knowledge Base', 'SOPs for every scenario. Reading them first is the cheapest skill there is.'],
        ['Honest grading', 'Every action is logged. Shortcuts that would get you in trouble at a real desk cost points here.']]
        .map(([h, p]) => `<div class="feature"><h4>${h}</h4><p>${p}</p></div>`).join('')}
    </div>
    <footer class="site-foot">Built by ${esc(CONFIG.author)}${CONFIG.repoUrl ? ` · <a href="${esc(CONFIG.repoUrl)}" target="_blank" rel="noopener">Source on GitHub</a>` : ''} · Brightline Logistics is a fictional company.</footer></div>`;
}

function renderReport() {
  const R = G.report;
  return `<div class="report">
    <div class="report-head"><div class="grade g-${R.grade}">${R.grade}</div>
      <div><h1>Shift report</h1><p class="muted">${R.closed}/${SCENARIOS.length} tickets closed · ${fmt(R.time)} on shift · ${G.mode === 'practice' ? 'practice mode' : 'timed shift'}</p>
      <div class="big-score">${R.final}<small>/100</small></div></div>
      <div class="grow"></div><div class="col gap"><button class="btn primary lg" data-act="start" data-m="${G.mode}">Play again</button><button class="btn" data-act="home">Main menu</button></div></div>
    <div class="card pad coach-cta"><div><b>Want someone to walk you through this report?</b><div class="muted">A tutor can replay your shift with you and turn every lost point into an interview answer.</div></div><button class="btn" data-act="pricing">See tutoring</button></div>
    ${G.penalties.length ? `<div class="card pad"><h3>Collateral damage</h3><ul class="fb">${G.penalties.map(p => `<li class="b"><b>−${p.pts}</b> ${esc(p.msg)}</li>`).join('')}</ul></div>` : ''}
    <div class="report-grid">${SCENARIOS.map(s => {
      const t = ticket(s.id);
      if (!t || !t.result) return `<div class="card pad"><div class="row">${prioBadge(s.priority)}<span class="tid">${s.id}</span><div class="grow"></div><b class="bad-t">0</b></div><h4>${esc(s.title)}</h4><p class="muted">${t ? 'Not closed by end of shift.' : 'Never arrived. The shift ended first.'}</p></div>`;
      return `<div class="card pad"><div class="row">${prioBadge(t.priority)}<span class="tid">${t.id}</span>${statusBadge(t.status)}<div class="grow"></div><b class="${t.result.score >= 80 ? 'good-t' : t.result.score >= 50 ? '' : 'bad-t'}">${t.result.score}</b></div>
        <h4>${esc(t.title)}</h4><ul class="fb">${t.result.good.map(g => `<li class="g">${esc(g)}</li>`).join('')}${t.result.ded.map(d => `<li class="b"><b>−${d[0]}</b> ${esc(d[1])}</li>`).join('')}</ul>
        <button class="kb-link" data-act="reportKb" data-k="${t.kb}">${I.kb} Read ${t.kb}</button></div>`;
    }).join('')}</div></div>`;
}

function endShift() {
  const scores = SCENARIOS.map(s => ticket(s.id)?.result?.score ?? 0);
  const pen = G.penalties.reduce((a, p) => a + p.pts, 0);
  const final = Math.max(0, Math.round(scores.reduce((a, b) => a + b, 0) / SCENARIOS.length - pen / 2));
  const grade = final >= 90 ? 'A' : final >= 80 ? 'B' : final >= 70 ? 'C' : final >= 60 ? 'D' : 'F';
  G.report = { final, grade, closed: G.tickets.filter(t => t.result).length, time: now() };
  G.phase = 'report';
  const best = Number(store.get('shiftone-best') || 0);
  if (final > best) store.set('shiftone-best', String(final));
  render();
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
const ACT = {
  start: d => newGame(d.m),
  home: () => { G = null; PAGE = 'start'; render(); },
  pricing: () => { G = null; PAGE = 'pricing'; render(); $('#main').scrollTop = 0; },
  theme: () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('shiftone-theme', r.dataset.theme); render(); },
  endShift: () => {
    if (openTickets().length || G.tickets.length < SCENARIOS.length) modal({ title: 'End the shift now?', body: '<p>Open and not-yet-arrived tickets score 0.</p>', ok: 'End shift', danger: true, onOk: () => setTimeout(endShift) });
    else endShift();
  },
  view: d => { G.view = d.v; render(); },
  qf: d => { G.queueFilter = d.f; render(); },
  open: d => { G.active = d.id; render(); },
  assign: () => { const t = ticket(G.active); t.assigned = true; if (t.status === 'New') t.status = 'In Progress'; record('assign', { ticket: t.id }); say(t, 'system', 'Assigned to you.'); },
  ask: d => ask(ticket(G.active), d.q),
  reply: () => {
    const t = ticket(G.active), k = 'reply-' + t.id, txt = (G.drafts[k] || '').trim();
    if (!txt) return;
    G.drafts[k] = '';
    say(t, 'tech', txt);
    say(t, t.requester, 'OK, thanks. Let me know when I should try again.', 1500);
  },
  verify: d => sendVerification(d.u),
  resolve: () => closeTicket(ticket(G.active), 'resolve'),
  escalate: () => { const t = ticket(G.active), team = G.drafts['team-' + t.id]; if (!team) return toast('Choose a team to escalate to.', 'bad'); closeTicket(t, 'escalate', team); },
  gotoUser: d => { G.view = 'dir'; G.dir.user = d.u; G.dir.tab = 'profile'; render(); },
  gotoDevice: d => { G.view = 'remote'; if (G.remote.device !== d.d) connect(d.d); else render(); },
  gotoKb: d => { G.view = 'kb'; G.kb.article = d.k; render(); },
  reportKb: d => { const a = KB.find(k => k.id === d.k); modal({ title: `${a.id} · ${a.title}`, body: `<div class="article">${a.body}</div>`, ok: 'Close', onOk() {} }); },
  pickUser: d => { G.dir.user = d.u; render(); },
  dirTab: d => { G.dir.tab = d.t; render(); },
  dir: d => dirAction(d.k, G.dir.user),
  rmgroup: d => removeGroup(G.dir.user, d.g),
  connect: d => connect(d.d),
  disconnect: () => { G.remote.device = null; render(); },
  rdTab: d => { G.remote.tab = d.t; render(); },
  uninstall: d => uninstall(d.a),
  svc: d => svcAction(d.s, d.x),
  applyTz: () => { const d = dev(), tz = G.drafts['tz-' + d.id] ?? d.tz; setTz(tz); toast(`Time zone set to ${tz}.`, 'good'); render(); },
  dnsMode: d => { G.drafts['dnsmode-' + dev().id] = d.m; render(); },
  applyDns: () => { const d = dev(), m = G.drafts['dnsmode-' + d.id] ?? d.dnsMode; setDns(m, G.drafts['dns1-' + d.id] ?? d.dnsManual[0], G.drafts['dns2-' + d.id] ?? d.dnsManual[1]); toast(`DNS set to ${m === 'dhcp' ? 'automatic' : 'manual'}.`, 'good'); render(); },
  srvTab: d => { G.server.tab = d.t; render(); },
  net: d => netAction(d.n, d.k),
  ssvc: d => serverSvc(d.h, d.s, d.x),
  kb: d => { G.kb.article = d.k; render(); },
  modalOk: () => { const m = G.modal; G.modal = null; m.onOk && m.onOk(); render(); },
  modalCancel: () => { G.modal = null; render(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.tagName === 'DETAILS') return; // toggle handled below
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  fn(el.dataset, el, e);
});
document.addEventListener('toggle', e => {
  if (e.target.classList?.contains('close-box') && G?.active) G.drafts['open-close-' + G.active] = e.target.open;
}, true);
const onDraft = e => {
  const k = e.target.dataset?.draft;
  if (k == null || !G) return;
  G.drafts[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (e.target.dataset.live) {
    if (k === 'm-group') { const gd = $('#group-desc'); if (gd) gd.textContent = GROUPS[e.target.value] || ''; return; }
    render();
  }
};
document.addEventListener('input', onDraft);
document.addEventListener('change', onDraft);
document.addEventListener('keydown', e => {
  if (!G) return;
  if (e.target.id === 'term-input') {
    if (e.key === 'Enter') { const v = e.target.value; G.drafts.term = ''; runCmd(v); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const r = G.remote;
      r.hi = Math.max(-1, Math.min(r.hist.length - 1, r.hi + (e.key === 'ArrowUp' ? 1 : -1)));
      e.target.value = G.drafts.term = r.hi >= 0 ? r.hist[r.hi] : '';
    }
  } else if (e.target.id === 'reply-input' && e.key === 'Enter') ACT.reply();
  else if (e.key === 'Escape' && G.modal && !G.modal.noButtons) ACT.modalCancel();
});

setInterval(() => {
  if (!G || G.phase !== 'play') return;
  if (spawnDue()) { render(); return; }
  const c = $('#clock');
  if (c) c.textContent = fmt(now());
  document.querySelectorAll('[data-sla]').forEach(el => {
    const t = ticket(el.dataset.sla);
    const l = slaLeft(t);
    el.textContent = fmt(l);
    el.className = 'sla ' + (l < 0 ? 'breach' : l < 60 ? 'soon' : '');
  });
  if (G.w.outageUntil && !outage()) { G.w.outageUntil = 0; render(); }
}, 1000);

(function init() {
  const saved = store.get('shiftone-theme');
  document.documentElement.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (location.hash === '#pricing') PAGE = 'pricing';
  render();
})();
