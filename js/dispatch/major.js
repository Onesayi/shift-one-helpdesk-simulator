// Major incident (shift code 'major'): Thursday 08:00 to 11:00. Microsoft 365 sign-ins fail for every
// client at once. The skill is running it as one incident (PB-16): declare it, link every client's
// ticket to it, page the Service Manager, open the Microsoft case, update every affected client at
// least every 30 minutes, then confirm the fix to all of them and write the post-incident review.
// Tickets that only look related stay separate.
//
// It plays like a drill: no carry-overs, no sick calls, no handover, and it isn't saved to progress.

const MAJOR_END = 660;        // 11:00
const MAJOR_FIRST = 485;      // the first call, 08:05
const MAJOR_RESTORE = 590;    // Microsoft fixes it at 09:50
const MAJOR_CADENCE = 30;     // minutes between updates to affected clients
const MAJOR_SM = 15;          // minutes from the first report to paging the Service Manager

const MAJOR = { id: 'major', title: 'Major incident', blurb: 'Microsoft 365 goes down for every client at once. Run it as one incident, keep everyone updated, and write the review.' };

// Every incident ticket shares these: the same fault, the same fix, and the same grading.
const MI_BASE = {
  group: 'mi-m365', sm: true, vendor: 'Microsoft', kb: 'PB-16', major: true, workAt: 10,
  p1Chase: 'Still nothing here. Is anyone actually working on this?',
  truth: { priority: 'P1', okPri: [], board: 'Infrastructure', skill: 'M365', onsite: false, est: 60, dispatch: true, startBy: 530, closeAs: 'resolved',
    why: 'Every client\'s staff locked out of email and Teams at once: one P1 on the Infrastructure board, run as a major incident (PB-16).' },
  work(t, appt, tech) {
    if (!tech.skills.includes('M365')) return null;
    if (t.flags.restored) return { kind: 'done', note: MI_FIXED };
    return { kind: 'vendor', note: 'It\'s not us: sign-ins are failing in all four tenants with the same Entra ID error, and nothing changed on our side. This is Microsoft\'s outage. Can you open a case with Microsoft? I\'ll check every tenant the moment they fix it.' };
  },
  onVendor(t, vendor) {
    if (vendor !== this.vendor || t.flags.vendorCase) return;
    t.flags.vendorCase = true;
    later(5, () => post(t, 'vendor', 'Microsoft: Your case is linked to incident MO881204. A recent change to the sign-in service is failing for some tenants. We\'re rolling it back and expect to restore service by 09:50.', 'vendor'));
  },
  evaluate(t, ded, good) { majorEvaluate(t, ded, good); },
};
const MI_FIXED = 'Microsoft rolled back their change. Signed in as a test user in all four tenants: Outlook, Teams and OneDrive all work, and there\'s nothing left to do on our side.';
const mi = x => Object.assign(Object.create(MI_BASE), x);

const MAJOR_SCENARIOS = [
  mi({ id: 'mi-hdg', at: 5, channel: 'phone', client: 'hdg', contact: 'lpark',
    title: 'Nobody can sign in to Outlook or Teams',
    body: 'Lena at Harbor Dental. None of us can get into Outlook or Teams. It keeps saying our password is wrong and then the account is "temporarily unavailable". We haven\'t changed anything. Patients are emailing us their forms. What\'s happening?' }),
  mi({ id: 'mi-kfl', at: 8, channel: 'email', client: 'kfl', contact: 'msantos',
    title: 'Outlook keeps asking for passwords',
    body: 'Hi, everyone in the office is getting password prompts in Outlook and then an error. Same on phones. Is this a phishing thing again? Maria' }),
  mi({ id: 'mi-bl', at: 10, channel: 'email', client: 'bl', contact: 'bldesk',
    title: 'Escalation: all HQ users signed out of Microsoft 365',
    body: 'Escalating from the Brightline service desk. Since about 08:05 every user at HQ and Denver has been signed out of Teams and Outlook and can\'t sign back in. Error AADSTS90033. Not a password problem: it\'s every account, including our admin accounts. Brightline IT' }),
  mi({ id: 'mi-oak', at: 14, channel: 'phone', client: 'oak', contact: 'cjensen',
    title: 'Teachers can\'t get into email',
    body: 'Carl at Oakridge. None of the teachers can get into their email, and the classroom Teams links don\'t work either. Registers are due at nine. Is it just us?' }),
  {
    id: 'mi-printer', at: 35, channel: 'email', client: 'hdg', contact: 'jfox', kb: 'PB-16',
    title: 'Front desk printer says offline',
    body: 'Hi, the printer at the Downtown front desk says offline and nothing prints. Everything else is fine. Jamie',
    truth: { priority: 'P3', okPri: ['P4'], board: 'Help Desk', skill: 'Printers', onsite: false, est: 30, dispatch: true, startBy: 1020, closeAs: 'resolved',
      why: 'One printer with a workaround, and nothing to do with Microsoft 365: a normal P3. Don\'t let the outage swallow it.' },
    fixNote: 'The printer had picked up a new IP address after a power cut. Set a reservation on the clinic router and re-added it. Test page printed.',
  },
  mi({ id: 'mi-keller', at: 45, channel: 'phone', client: 'kfl', contact: 'tkeller',
    title: 'Partner: can\'t get into email, court filings due',
    body: 'Tom Keller. I can\'t get into my email and the court portal sends its confirmations there. Maria says the whole office is down. I need to know what\'s going on and when it\'s back.' }),
  {
    id: 'mi-teacher', at: 125, channel: 'email', client: 'oak', contact: 'kosei', kb: 'PB-16',
    title: 'Still can\'t sign in to my email',
    body: 'Hi, Carl said email is back for everyone, but I still can\'t sign in. It says my password has expired and the reset page won\'t take my new one. Kwame',
    truth: { priority: 'P3', board: 'Help Desk', skill: 'M365', onsite: false, est: 15, dispatch: true, startBy: 1020, closeAs: 'resolved',
      why: 'Everyone else is back, and his error is an expired password: a separate P3, not part of the outage. Linking it to the closed incident would hide it.' },
    fixNote: 'Kwame\'s password had expired overnight and the new one didn\'t meet the length rule. Reset it with him on the phone. He\'s signed in.',
  },
];

// Microsoft's service health page, posted on the incident as it happens.
const MAJOR_EVENTS = [
  { at: 520, run: () => majorPost('Microsoft 365 service health: Investigating. Some users may be unable to sign in to Microsoft 365 services. More information will be provided within 30 minutes.') },
  { at: MAJOR_RESTORE, run: majorRestore },
];

// Every major-incident drill on the start page. Each one names its own outage, timings and review;
// the functions below read the one being played through incident(). outage.js adds the second.
const INCIDENTS = [];
const incidentOf = seed => INCIDENTS.find(i => i.drill.id === seed) || null;
const incident = () => incidentOf(G.drill?.id) || INCIDENTS[0];
const isMajorSeed = seed => !!incidentOf(seed);

function buildMajor(seed) {
  const inc = incidentOf(seed);
  const tickets = inc.scenarios.map(s => Object.assign(Object.create(s), { key: s.id })).sort((a, b) => a.at - b.at);
  tickets.forEach((t, i) => { t.id = String(inc.firstId + i); });
  return { seed, drill: inc.drill, major: true, end: inc.end, tickets, events: inc.events.map(e => Object.assign({}, e)) };
}

// A ticket of this shift by its scenario id, once it has arrived.
const majorTicket = key => G.tickets.find(t => t.s.key === key || t.s.id === key) || null;

// The ticket running the incident: the declared one, else the first unmerged ticket of the outage.
function majorParent() {
  const all = G.tickets.filter(t => t.s.group === incident().group);
  return all.find(t => t.major && !t.parent) || all.find(t => !t.parent) || null;
}
const majorChildren = p => G.tickets.filter(t => t.parent === p.id);

function majorPost(text) {
  const p = majorParent();
  if (p) post(p, 'vendor', text, 'vendor');
}

function majorRestore() {
  const inc = incident();
  for (const t of G.tickets.filter(x => x.s.group === inc.group)) t.flags.restored = true;
  G.majorRestored = now();
  majorPost(inc.restoreText);
  const p = majorParent();
  if (p && p.status === 'Waiting on vendor') {
    const a = finalAppt(p);
    workDone(p, a ? a.tech : 'maya', { kind: 'done', note: inc.fixed });
  }
  toast(inc.restoreToast, 'good');
}

// What the post-incident review asks, and the right answers (PB-16).
const PIR = [
  { id: 'cause', q: 'What caused it?', a: 'ms', opts: { ms: 'A change Microsoft made to their sign-in service', fw: 'A firewall change on our side', pw: 'Clients\' passwords expiring', phish: 'A phishing attack' } },
  { id: 'clients', q: 'How many clients were affected?', a: '4', opts: { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' } },
  { id: 'start', q: 'When did the first client report it?', a: '485', opts: { 480: '08:00', 485: '08:05', 520: '08:40', 535: '08:55' } },
  { id: 'end', q: 'When was service restored?', a: String(MAJOR_RESTORE), opts: { 545: '09:05', [MAJOR_RESTORE]: '09:50', 615: '10:15' } },
  { id: 'action', q: 'What should change so it goes better next time?', a: 'feed', opts: { feed: 'Alert us from Microsoft\'s service health feed, so we know before clients call', move: 'Move every client off Microsoft 365', reset: 'Reset everyone\'s password', none: 'Nothing: it was Microsoft\'s fault' } },
];

function submitPir(t) {
  const inc = incident(), pir = inc.pir;
  const ans = Object.fromEntries(pir.map(f => [f.id, G.drafts[`pir-${f.id}`]]));
  if (pir.some(f => !ans[f.id])) return toast('Answer every question in the review.', 'bad');
  t.pir = Object.assign({ at: now() }, ans);
  record('pir', { ticket: t.id });
  post(t, 'system', 'Post-incident review sent to Dana Whitaker (Service Manager).', 'system');
  later(2, () => post(t, 'sm', inc.pirThanks, 'internal'));
  toast('Post-incident review submitted.', 'good');
  render();
}

function majorEvaluate(t, ded, good) {
  const inc = incident();
  const kids = majorChildren(t), mine = e => e.ticket === t.id;
  if (t.major) good.push('Declared a major incident.');
  else ded.push([10, 'Never declared a major incident, so the clients\' tickets couldn\'t be linked as one (PB-16).']);

  const sm = logged('notify-sm', mine)[0];
  if (!sm) ded.push([15, 'Every client was down and the Service Manager never heard.']);
  else if (sm.at - inc.first > MAJOR_SM) ded.push([5, `Paged the Service Manager ${mins(sm.at - inc.first)} after the first call. Do it within ${MAJOR_SM} minutes.`]);
  else good.push('Paged the Service Manager straight away.');

  if (!t.flags.vendorCase) ded.push([10, inc.noCase || 'Never opened a case with Microsoft, so you had no incident number or ETA to give clients.']);

  // Updates to everyone affected, at least every 30 minutes until it was fixed.
  const ups = logged('client-msg', e => mine(e) && e.kind === 'mi').map(e => e.at);
  const from = t.majorAt ?? t.arrived, to = Math.min(G.majorRestored ?? now(), now());
  if (!ups.length) ded.push([25, 'Never sent an incident update to the affected clients.']);
  else {
    const marks = [from, ...ups.filter(x => x <= to), to];
    const gaps = marks.slice(1).map((x, i) => x - marks[i]).filter(g => g > MAJOR_CADENCE).length;
    if (gaps) ded.push([Math.min(20, 10 * gaps), `${gaps === 1 ? 'One gap' : `${gaps} gaps`} of more than ${MAJOR_CADENCE} minutes between incident updates.`]);
    else good.push(`Updated every affected client at least every ${MAJOR_CADENCE} minutes.`);
  }
  const told = c => logged('client-msg', e => e.kind === 'resolved' && (e.ticket === c.id || (e.ticket === t.id && (e.to || []).includes(c.id)))).length;
  const untold = kids.filter(c => c.contact && !told(c));
  if (untold.length) ded.push([5 * untold.length, `${untold.map(c => greet(contactOf(c))).join(', ')} never heard it was fixed.`]);

  if (!t.pir) ded.push([20, 'No post-incident review. Write it once the incident is closed (PB-16).']);
  else {
    const wrong = inc.pir.filter(f => t.pir[f.id] !== f.a);
    wrong.forEach(f => ded.push([5, `Review: "${f.q}" should be "${f.opts[f.a]}".`]));
    if (!wrong.length) good.push('Wrote an accurate post-incident review.');
  }
}

INCIDENTS.push({
  drill: MAJOR, scenarios: MAJOR_SCENARIOS, events: MAJOR_EVENTS, end: MAJOR_END, firstId: 4801,
  group: MI_BASE.group, first: MAJOR_FIRST, restore: MAJOR_RESTORE, pir: PIR, fixed: MI_FIXED,
  label: 'Microsoft 365 sign-in outage', restoreToast: 'Microsoft 365 is back.',
  restoreText: 'Microsoft 365 service health: Resolved. We rolled back the change that caused sign-in failures (MO881204). Users can sign in again.',
  pirThanks: 'Thanks for the review. I\'ll take the service health alert to Friday\'s team meeting.',
});
