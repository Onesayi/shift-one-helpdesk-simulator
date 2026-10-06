'use strict';

// Scenario data sanity, and the scenario-specific traps from the answer key in docs/COORDINATOR.md.

const test = require('node:test');
const assert = require('node:assert/strict');
const { load, game, has } = require('./harness');

function deducts(r, pts, re) {
  const d = has(r, re);
  assert.ok(d, `expected a deduction matching ${re}; got: ${r.ded.map(x => `-${x[0]} ${x[1]}`).join(' | ') || 'none'}`);
  assert.equal(d[0], pts, `"${d[1]}"`);
}
const praises = (r, re) => assert.ok(r.good.some(x => re.test(x)), `expected praise matching ${re}; got: ${r.good.join(' | ')}`);
const answering = g => () => { if (g.G.ring) g.answer(); };

test('scenario data is consistent with the world data', () => {
  const { SCENARIOS, CLIENTS, TECHS, SKILLS, BOARDS, PRIORITIES, REASONS } = load();
  assert.equal(SCENARIOS.length, 25);
  assert.equal(SCENARIOS.filter(s => !s.extra).length, 18, 'the classic shift has 18 tickets');
  assert.equal(new Set(SCENARIOS.map(s => s.id)).size, SCENARIOS.length, 'ticket ids are unique');
  for (const s of SCENARIOS) {
    const T = s.truth, c = CLIENTS[s.client], at = `#${s.id}`;
    assert.ok(c, `${at}: unknown client ${s.client}`);
    if (s.contact) assert.ok(c.contacts[s.contact], `${at}: ${s.contact} isn't a ${s.client} contact`);
    for (const id of Object.keys(s.approval || {})) assert.ok(c.contacts[id], `${at}: approver ${id} isn't a contact`);
    if (s.vendor) assert.ok(c.vendors.includes(s.vendor), `${at}: ${s.vendor} isn't one of the client's vendors`);
    if (T.closeAs) assert.ok(REASONS[T.closeAs], `${at}: unknown close reason ${T.closeAs}`);
    if (!T.priority) { assert.equal(T.dispatch, false, `${at}: untriaged tickets can't need a tech`); continue; }
    assert.ok(PRIORITIES.includes(T.priority), `${at}: priority ${T.priority}`);
    for (const p of T.okPri || []) assert.ok(PRIORITIES.includes(p), `${at}: okPri ${p}`);
    for (const b of [].concat(T.board)) assert.ok(BOARDS.includes(b), `${at}: board ${b}`);
    assert.ok(SKILLS.includes(T.skill), `${at}: skill ${T.skill}`);
    if (T.dispatch) {
      const able = Object.values(TECHS).filter(x => x.skills.includes(T.skill) && (!T.onsite || x.onsite));
      assert.ok(able.length, `${at}: no technician can do ${T.skill}${T.onsite ? ' onsite' : ''}`);
    }
    if (T.priority === 'P1') assert.ok(s.sm, `${at}: every P1 should expect a Service Manager page`);
  }
});

test('#4471/#4476: rebooking without telling the client costs 10', () => {
  const g = game().to(600).schedule('4471', 'ana', 690);
  deducts(g.grade('4471'), 10, /Tell the client when their appointment moves/);
  g.send('4471', 'sched');
  praises(g.grade('4471'), /Told Maria/);
});

test('#4501: a field visit for a remote fix costs 10', () => {
  const g = game().triageRight('4501').schedule('4501', 'luis', 750, { onsite: true });
  deducts(g.grade('4501'), 10, /Sent a field visit for a remote fix/);
});

test('#4503: clearing known noise fast is praised; slowly costs 5', () => {
  praises(game().to(495).close('4503', 'noise').grade('4503'), /cleared the noise quickly/);
  deducts(game().to(560).close('4503', 'noise').grade('4503'), 5, /to clear a known-noise alert/);
});

test('#4504: booking the new starter for Friday is praised', () => {
  const g = game();
  g.to(495, answering(g)).triageRight('4504').schedule('4504', 'ana', g.E.DAY + 480);
  praises(g.grade('4504'), /Booked the setup for Friday/);
});

test('#4505: asking the requester costs 15; dispatching without approval costs 40', () => {
  deducts(game().to(510).approval('4505', 'jmorrow').grade('4505'), 15, /can't approve access/);
  deducts(game().to(600).grade('4505'), 10, /Never asked Maria or a partner/);
  const g = game().to(510).triageRight('4505').schedule('4505', 'ana', 510).to(530);
  deducts(g.grade('4505'), 40, /partner compensation files/);
});

test('#4505: Maria declines, so tell Jake and close as declined', () => {
  const g = game().to(510).triageRight('4505').send('4505', 'ack').approval('4505', 'msantos').to(514);
  assert.equal(g.ticket('4505').status, 'Approval declined');
  g.send('4505', 'declined').close('4505', 'declined', 'Maria declined access to the Partners folder.');
  assert.equal(g.grade('4505').score, 100);
});

// #4506 rings at 08:40. Sipho finds a Comcast fault 10 minutes into the job.
function northside() {
  const g = game();
  g.to(520, answering(g)).triageRight('4506');
  return g;
}

test('#4506: no Service Manager page on the P1 costs 15', () => {
  deducts(northside().schedule('4506', 'sipho', 510).grade('4506'), 15, /Service Manager never heard/);
});

test('#4506: not opening the Comcast case Sipho asks for costs 20; the wrong vendor costs 5', () => {
  deducts(northside().schedule('4506', 'sipho', 510).to(560).grade('4506'), 20, /nobody opened one/);
  const g = northside().schedule('4506', 'sipho', 510).to(531).vendor('4506', 'Dell (hardware warranty)');
  deducts(g.grade('4506'), 5, /wrong vendor/);
});

test('#4506: the ISP ETA must reach Dr. Reyes', () => {
  const g = northside().notify('4506', 'sm').schedule('4506', 'sipho', 510).to(531).vendor('4506', 'Comcast Business (ISP)').to(537);
  deducts(g.grade('4506'), 10, /Dr\. Reyes never heard it/);
  praises(g.send('4506', 'update').grade('4506'), /Passed the ISP's ETA/);
});

test('#4506: the vendor fix completes the job once the circuit is restored', () => {
  const g = northside().schedule('4506', 'sipho', 510).to(531).vendor('4506', 'Comcast Business (ISP)');
  assert.equal(g.ticket('4506').status, 'Waiting on vendor');
  g.to(585);
  assert.equal(g.ticket('4506').status, 'Completed');
});

test('#4506: anyone but Sipho on the firewall costs 10', () => {
  deducts(northside().schedule('4506', 'maya', 510).grade('4506'), 10, /only Sipho touches their firewall/);
});

test('#4510: booking past the block balance before the Account Manager approves costs 20', () => {
  const g = game();
  g.to(565, answering(g)).triageRight('4510').schedule('4510', 'ana', 600);
  deducts(g.grade('4510'), 20, /before the Account Manager approved a top-up/);
  const h = game();
  h.to(565, answering(h)).triageRight('4510');
  deducts(h.grade('4510'), 10, /Escalate to the Account Manager/);
  h.notify('4510', 'am').to(570).schedule('4510', 'ana', 600);
  praises(h.grade('4510'), /top-up approved before dispatching/);
});

test('#4512: sending a co-managed escalation to our Tier 1 costs 5', () => {
  const g = game().to(640).triageRight('4512').schedule('4512', 'ana', 645);
  deducts(g.grade('4512'), 5, /repeats their work/);
});

test('#4513: no Service Manager page on a security incident costs 15', () => {
  const g = game();
  g.to(660, answering(g)).triageRight('4513').schedule('4513', 'maya', 660);
  deducts(g.grade('4513'), 15, /Service Manager never heard/);
});

test('#4513: a P1 can pull Maya off lower-priority work', () => {
  const g = game();
  g.to(615).triageRight('4511').schedule('4511', 'maya', 660).to(661, answering(g)).triageRight('4513').schedule('4513', 'maya', 660);
  assert.equal(g.ticket('4511').status, 'Needs reassign');
  deducts(g.grade('4511'), 30, /Pulled off for a P1 and never rebooked/);
});

test('#4515: not sending Lena the appointment costs 5', () => {
  const g = game().to(720).triageRight('4515').schedule('4515', 'luis', 1440 + 720, { onsite: true });
  deducts(g.grade('4515'), 5, /Send an appointment confirmation/);
});

test('#4516: an unverified request sent to the Help Desk forwards the mail to the attacker', () => {
  const g = game().to(780).triageRight('4516', { board: 'Help Desk', skill: 'M365' }).schedule('4516', 'ana', 780).to(830);
  const r = g.grade('4516');
  deducts(r, 50, /forwarded the managing partner's mailbox/);
  deducts(r, 10, /Never checked with Maria or Tom/);
});
