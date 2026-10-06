'use strict';

const { game } = require('./harness');

// Plays the scenario answer key in docs/COORDINATOR.md.
function cleanRun() {
  const g = game();
  const { DAY } = g.E;
  const seen = new Set();

  const onArrive = {
    4501: () => g.triageRight('4501').send('4501', 'ack').schedule('4501', 'ana', 480),
    4502: () => g.triageRight('4502').schedule('4502', 'maya', 495),
    4503: () => g.close('4503', 'noise', 'Oakridge lab VMs shut down every night. Expected alert.'),
    4504: () => g.triageRight('4504').schedule('4504', 'ana', DAY + 480),
    4505: () => g.triageRight('4505').send('4505', 'ack').approval('4505', 'msantos'),
    4506: () => g.triageRight('4506').notify('4506', 'sm').schedule('4506', 'sipho', 510),
    4507: () => g.triageRight('4507').send('4507', 'ack').schedule('4507', 'maya', 600),
    4508: () => g.merge('4508', '4507'),
    4509: () => g.merge('4509', '4507'),
    4510: () => g.triageRight('4510').notify('4510', 'am'),
    4511: () => g.triageRight('4511').schedule('4511', 'maya', 750),
    4512: () => g.triageRight('4512').send('4512', 'ack').schedule('4512', 'sipho', 645),
    4513: () => g.triageRight('4513').notify('4513', 'sm').schedule('4513', 'maya', 660),
    4514: () => g.triageRight('4514').schedule('4514', 'luis', 750, { onsite: true }),
    4515: () => g.triageRight('4515').schedule('4515', 'luis', DAY + 720, { onsite: true }).send('4515', 'sched'),
    4516: () => g.triageRight('4516').approval('4516', 'msantos').schedule('4516', 'maya', 960),
  };
  const at = {
    514: () => g.send('4505', 'declined').close('4505', 'declined', 'Maria declined access to the Partners folder.'),
    531: () => g.vendor('4506', 'Comcast Business (ISP)'),
    537: () => g.send('4506', 'update'),
    560: () => g.send('4506', 'update'),
    570: () => g.schedule('4510', 'ana', 600),
    // Ben goes home sick at 09:45: re-home his two carried-over jobs and tell both clients.
    586: () => g.schedule('4471', 'ana', 690).send('4471', 'sched').schedule('4476', 'ana', 780).send('4476', 'sched'),
    690: () => g.send('4513', 'update'),
  };

  g.to(g.E.SHIFT_END, m => {
    if (g.G.ring) g.answer();
    for (const t of g.G.tickets) if (!seen.has(t.id)) { seen.add(t.id); onArrive[t.id]?.(); }
    at[m]?.();
    // Close everything the techs have finished, confirming with the client first.
    for (const t of g.G.tickets) {
      if (t.closed || t.parent || t.status !== 'Completed') continue;
      if (t.contact && !t.s.noResponseSla) g.send(t.id, 'resolved');
      g.close(t.id, 'resolved', 'Technician completed the work and the client was told.');
    }
  });
  return g;
}

module.exports = { cleanRun };
