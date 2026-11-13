// Exchange Online outage (shift code 'outage'): Thursday 08:00 to 11:30, practice mode. Modelled on the
// real Microsoft 365 outage of 12–13 November 2026, when Outlook couldn't reach mailboxes worldwide
// (Microsoft incidents EX1550543 and MO1550821). Timings are squeezed into one morning, and the clients,
// people and wording are the simulator's own.
//
// It runs like the major incident in major.js (PB-16), with the lessons that outage taught:
//   - the fault is Microsoft's, in every Outlook app at once, so nobody fixes it from a client's PC;
//   - Microsoft gives no ETA, and its first recovery doesn't hold, so "it's back" isn't "it's fixed";
//   - mail sent during it is queued, not lost;
//   - scammers ring people offering to "fix" it, and that call is a separate security ticket;
//   - once it's over, a mailbox that still looks empty is usually a local problem again.

const OUTAGE_FIRST = 485;      // the first call, 08:05
const OUTAGE_BLIP = 545;       // 09:05: Microsoft returns some servers to service...
const OUTAGE_RELAPSE = 565;    // 09:25: ...and they fall over again
const OUTAGE_RESTORE = 620;    // 10:20: mitigated, the mail queue is draining
const OUTAGE_END = 690;        // 11:30

const OUTAGE = { id: 'outage', title: 'Exchange Online outage', blurb: 'Outlook can\'t reach anyone\'s mailbox, Microsoft has no ETA, and its first fix falls over. Based on the real outage of 12–13 November 2026.' };

const XO_FIXED = 'Microsoft has mitigated it. Opened Outlook on the web, desktop and phone as a test user in all four tenants: mailboxes load, and the mail queued during the outage is arriving. Nothing to fix on our side, and nobody needs to reinstall anything.';

const XO_BASE = {
  group: 'xo-exo', sm: true, vendor: 'Microsoft', kb: 'PB-16', major: true, workAt: 10,
  p1Chase: 'It\'s still down here. Has anyone heard from Microsoft?',
  truth: { priority: 'P1', okPri: [], board: 'Infrastructure', skill: 'M365', onsite: false, est: 60, dispatch: true, startBy: 530, closeAs: 'resolved',
    why: 'No mailbox access for every client at once: one P1 on the Infrastructure board, run as a major incident (PB-16). It\'s Microsoft\'s fault, so the work is remote: confirm it, open the case, keep everyone told.' },
  work(t, appt, tech) {
    if (!tech.skills.includes('M365')) return null;
    if (t.flags.restored) return { kind: 'done', note: XO_FIXED };
    return { kind: 'vendor', note: 'Not us. Outlook can\'t reach the mailbox in all four tenants, on the web, on desktops and on phones, and sign-in itself works. Microsoft\'s status page shows an Exchange Online incident. Please make sure nobody reinstalls Office or deletes their Outlook profile: the cached copy on their PC is the only mail they can read right now. Can you open a case with Microsoft?' };
  },
  onVendor(t, vendor) {
    if (vendor !== this.vendor || t.flags.vendorCase) return;
    t.flags.vendorCase = true;
    later(5, () => post(t, 'vendor', 'Microsoft: Your case is linked to our active incident EX1550543, which is also tracked as MO1550821 for the wider Microsoft 365 impact. Some mailbox servers are dropping out of service and the rest are overloaded. We don\'t have an ETA yet. Mail sent to your users is being queued, not rejected.', 'vendor'));
  },
  evaluate(t, ded, good) { majorEvaluate(t, ded, good); },
};
const xo = x => Object.assign(Object.create(XO_BASE), x);

const OUTAGE_SCENARIOS = [
  xo({ id: 'xo-hdg', at: 5, channel: 'phone', client: 'hdg', contact: 'lpark',
    title: 'Outlook won\'t load anyone\'s mailbox',
    body: 'Lena at Harbor Dental. Outlook has been spinning on "Trying to connect" since about eight, on every PC. I tried it on my phone and on the web and it\'s the same. Teams chat is working. We get our appointment confirmations by email. What\'s going on?' }),
  xo({ id: 'xo-kfl', at: 12, channel: 'email', client: 'kfl', contact: 'msantos',
    title: 'Outlook disconnected: should we reinstall Office?',
    body: 'Hi, nobody here can get into their mailbox. Outlook just says disconnected. Jake found a guide that says to delete the Outlook profile and reinstall Office. Should he go ahead on all the PCs? Sending this from my personal account. Maria' }),
  xo({ id: 'xo-bl', at: 15, channel: 'email', client: 'bl', contact: 'bldesk',
    title: 'Escalation: Exchange Online mailboxes unreachable, HQ and Denver',
    body: 'Escalating from the Brightline service desk. Since about 08:05 no one at HQ or Denver can open their mailbox in Outlook desktop, Outlook on the web or the mobile app. Sign-in works and Teams is mostly fine. We\'ve ruled out the network: it fails off-site too. Brightline IT' }),
  xo({ id: 'xo-oak', at: 30, channel: 'phone', client: 'oak', contact: 'cjensen',
    title: 'Some teachers have email, some don\'t',
    body: 'Carl at Oakridge. About half the teachers can\'t open their email and the other half can, but it\'s really slow. Is it our Wi-Fi? Should I restart the router?' }),
  {
    id: 'xo-vish', at: 40, channel: 'phone', client: 'kfl', contact: 'tkeller', kb: 'PB-16', sm: true,
    title: 'Caller claiming to be Microsoft wants remote access',
    body: 'Tom Keller. A man just rang my mobile saying he\'s from Microsoft 365 support and can get my mailbox back today. He wants me to install a remote access app and read him the code that pops up on my phone. He\'s calling back in ten minutes. Is he one of yours? I haven\'t installed anything.',
    smReply: 'Good catch, and thanks for paging me. Tell Tom to ignore the callback. Microsoft never rings people to fix an outage. Get Maya to check his sign-ins, and put a scam warning in the next incident update to everyone.',
    truth: { priority: 'P2', okPri: ['P1'], board: 'Security', skill: 'Security', onsite: false, est: 30, dispatch: true, startBy: 600, closeAs: 'resolved',
      why: 'A scammer using the outage to target a VIP: a security ticket, separate from the outage. Nothing was installed and no code was read out, so it\'s a P2 rather than a compromise (a P1 is fine too). Tell Tom not to take the call, and get Maya to check his account. Linking it to the incident would bury it.' },
    fixNote: 'Spoke to Tom: he didn\'t install anything or read out a code. Checked his sign-in log and MFA history: no new devices, no unknown sign-ins, no new inbox rules. Reported the caller\'s number to Microsoft, and added a scam-call warning to our client notes.',
  },
  xo({ id: 'xo-bl-mail', at: 100, channel: 'email', client: 'bl', contact: 'bldesk',
    title: 'Customers say their emails to us are "delayed"',
    body: 'Second one from Brightline. Customers are forwarding us notices saying their emails to us are "delayed". Sales are worried orders sent this morning are gone for good. Can you confirm whether mail is being lost? Brightline IT' }),
  {
    id: 'xo-offline', at: 160, channel: 'email', client: 'hdg', contact: 'jfox', kb: 'PB-16',
    title: 'Everyone\'s email is back except mine',
    body: 'Hi, Lena says email is working again, and it is on the other front desk PC. On mine, Outlook opens but there\'s nothing new since this morning, and the bar at the bottom says "Working offline". Jamie',
    truth: { priority: 'P3', board: 'Help Desk', skill: 'M365', onsite: false, est: 15, dispatch: true, startBy: 1020, closeAs: 'resolved',
      why: 'Everyone else is back and his PC says "Working offline": one user, a local setting, a P3. Not part of the outage, so linking it to the closed incident would hide it.' },
    fixNote: 'Someone had clicked "Work Offline" in Outlook while it kept failing this morning. Turned it back off with Jamie on the phone. His mailbox caught up in a couple of minutes.',
  },
];

// Microsoft's status page and the clients, posted as the morning unfolds. Every line is in our own words.
function outageClient(key, text) {
  const t = majorTicket(key);
  if (!t || t.closed) return;  // linked to the incident still counts: Carl writes on his own ticket
  post(t, t.contact, text, 'client');
  toast(`${contactOf(t).name} wrote on #${t.id}.`);
}
const OUTAGE_EVENTS = [
  { at: 500, run: () => majorPost('Microsoft 365 status: Investigating EX1550543. Some users can\'t reach their Exchange Online mailboxes from any Outlook app. More information within 30 minutes.') },
  { at: 530, run: () => majorPost('Microsoft 365 status: Now tracked as MO1550821. Users in any region may be affected, and some Teams and SharePoint features too. A number of servers became unavailable, overloading the rest. We\'re moving traffic and restarting servers. If the admin center won\'t load for you, check status.cloud.microsoft.') },
  { at: OUTAGE_BLIP, run: () => majorPost('Microsoft 365 status: Some affected servers are back in service and some users are regaining access. We\'re watching to make sure the recovery holds.') },
  { at: OUTAGE_BLIP + 3, run: () => outageClient('xo-oak', 'It\'s back! All the teachers have their email again. Can we close this?') },
  { at: OUTAGE_RELAPSE, run: () => majorPost('Microsoft 365 status: The servers we returned to service are becoming unresponsive again as traffic reaches them. Our earlier steps haven\'t given the relief we expected. We\'re working on a different fix. No ETA yet.') },
  { at: OUTAGE_RELAPSE + 3, run: () => outageClient('xo-oak', 'Spoke too soon. It\'s gone again for most of them.') },
  { at: 595, run: () => majorPost('Microsoft 365 status: We\'re seeing steady recovery after spreading traffic across more infrastructure. We\'re working through the backlog of queued email. Messages are held and retried for up to 48 hours, so delayed mail is not lost.') },
  { at: OUTAGE_RESTORE, run: majorRestore },
];

// The review: the first five questions match the classic incident's, plus two this outage added.
const OUTAGE_PIR = [
  { id: 'cause', q: 'What caused it?', a: 'ms', opts: { update: 'An Outlook update on our clients\' PCs', ms: 'Microsoft\'s mailbox servers dropping out of service and overloading the rest', isp: 'Our clients\' internet connections', attack: 'A cyberattack on our clients' } },
  { id: 'clients', q: 'How many clients were affected?', a: '4', opts: { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' } },
  { id: 'start', q: 'When did the first client report it?', a: String(OUTAGE_FIRST), opts: { 480: '08:00', [OUTAGE_FIRST]: '08:05', 500: '08:20', 530: '08:50' } },
  { id: 'end', q: 'When was service restored?', a: String(OUTAGE_RESTORE), opts: { [OUTAGE_BLIP]: '09:05', [OUTAGE_RELAPSE]: '09:25', [OUTAGE_RESTORE]: '10:20' } },
  { id: 'mail', q: 'Was any email lost?', a: 'queued', opts: { queued: 'No: Microsoft queued it and delivered it late', all: 'Yes: everything sent during the outage', ext: 'Only email from outside the company' } },
  { id: 'blip', q: 'At 09:05 Microsoft said some users were getting access back. What should clients have heard?', a: 'wait', opts: { wait: 'That recovery had started, but it wasn\'t fixed until Microsoft confirmed it', fixed: 'That it was fixed, so we could close the incident', none: 'Nothing until the next update was due' } },
  { id: 'action', q: 'What should change so it goes better next time?', a: 'oob', opts: { oob: 'Keep a phone and text contact list for every client, since email can go down with Microsoft', move: 'Move every client off Microsoft 365', reinstall: 'Reinstall Office for everyone affected', none: 'Nothing: it was Microsoft\'s fault' } },
];

INCIDENTS.push({
  drill: OUTAGE, scenarios: OUTAGE_SCENARIOS, events: OUTAGE_EVENTS, end: OUTAGE_END, firstId: 4821,
  group: XO_BASE.group, first: OUTAGE_FIRST, restore: OUTAGE_RESTORE, pir: OUTAGE_PIR, fixed: XO_FIXED,
  label: 'Microsoft 365 email outage', restoreToast: 'Microsoft has mitigated the email outage.',
  restoreText: 'Microsoft 365 status: Mitigated. Mailbox access is restored across the affected infrastructure and queued email is being delivered. A few users may still see brief interruptions while it settles.',
  pirThanks: 'Thanks for the review. I\'ll get the out-of-hours phone list on Friday\'s agenda, and I\'ll keep an eye on Microsoft\'s final report for the real root cause.',
  noCase: 'Never opened a case with Microsoft, so you had no incident number to give clients and no proof for a service credit claim.',
});
