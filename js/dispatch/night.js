// The after-hours on-call shift (shift code 'night'): Thursday 17:00 to Friday 08:00.
// You cover the desk overnight with one engineer, Jordan Blake (TECHS.jordan). The skill is deciding
// what is worth waking Jordan for (PB-13) and what goes on Friday's board for the day team.
//
// Scenarios use the same fields as SCENARIOS (see scenarios.js), except:
//   at        minutes after 17:00
//   tonight   true: needs Jordan before 08:00. false: must wait for the day team, and booking Jordan
//             is a needless call-out. Leave it out for tickets that need no technician.

const NIGHT_START = 1020;       // Thu 17:00
const NIGHT_END = DAY + 480;    // Fri 08:00
const NIGHT_SPEED = 4;          // the night runs this many times faster than a day shift, except while a phone rings

// What the day coordinator left you at 17:00. Shown on the start page and the Team page.
const NIGHT_BRIEF = 'Day coordinator: "Quiet end to the day, nothing open for you. Ben Carter is off sick until Monday, so don\'t book him tomorrow. Sipho finishes at 14:00 our time. Jordan is on call until 08:00. I\'m back at 08:00 and I\'ll read your handover first."';
const NIGHT_HANDOVER_TO = { name: 'Priya Nair', role: 'Day service coordinator (08:00–17:00)' };

const NIGHT_SCENARIOS = [
  {
    id: 'n-dc01-backup', at: 45, channel: 'alert', client: 'hdg', contact: null, from: 'RMM monitoring', kb: 'PB-13',
    title: 'HDG-DC01: backup failed, 2nd in a row',
    body: 'ALERT  HDG-DC01  Backup job "DC01-Nightly" failed: VSS writer timed out.\nConsecutive failures: 2. Last good backup: Tue 23:00. Next scheduled run: tonight 23:00.',
    truth: { priority: 'P2', board: 'Infrastructure', skill: 'Backup', onsite: false, est: 45, dispatch: true, startBy: 1320, closeAs: 'resolved', tonight: true,
      why: 'Two failed backups in a row on the server with patient data is a P2 (PB-06). Harbor Dental is premium, so a P2 gets Jordan tonight, before the 23:00 run fails a third time.' },
    fixNote: 'The VSS writer for the SQL instance was hung after Windows updates. Restarted the writer service, ran a manual backup (completed, verified) and confirmed tonight\'s 23:00 job is queued.',
  },
  {
    id: 'n-oak-printer', at: 70, channel: 'email', client: 'oak', contact: 'cjensen', kb: 'PB-13',
    title: 'Office printer says paper jam, but nothing is stuck',
    body: 'Hi, the office printer is showing a paper jam and won\'t print, but there\'s no paper stuck anywhere. We\'ve turned it off and on. We need it for the parent newsletter tomorrow morning if possible. Carl',
    truth: { priority: 'P3', okPri: ['P4'], board: 'Field Services', skill: 'Printers', onsite: true, est: 45, dispatch: true, startBy: DAY + 645, closeAs: null, tonight: false,
      why: 'One printer, and the school is closed until 07:30: P3. It needs hands on the jam sensor, so it\'s Luis on Friday morning, inside Oakridge\'s 07:30–11:30 window. Not worth waking Jordan.' },
    fixNote: 'A torn label was stuck over the paper-path sensor. Removed it and cleaned the sensor. Printed a test page and the newsletter.',
  },
  {
    id: 'n-oak-assembly', at: 90, channel: 'email', client: 'oak', contact: 'hmoore', kb: 'PB-13',
    title: 'Hall laptop won\'t take my password, assembly at 9',
    body: 'Hi, the laptop in the hall won\'t accept my password. It just says "Your account or password is incorrect". Our 09:00 assembly runs off it tomorrow. Could someone please fix it tonight? I\'m happy to stay late. Helen Moore, Principal',
    truth: { priority: 'P3', board: 'Help Desk', skill: 'M365', onsite: false, est: 30, dispatch: true, startBy: DAY + 510, closeAs: null, tonight: false,
      why: 'One device, and the deadline is 09:00 tomorrow: P3. Being the principal doesn\'t raise it. Oakridge is on a standard agreement, so PB-13 says only a P1 wakes Jordan. Acknowledge tonight, then book the day team for 08:00. Ana has Jess\'s Mac at 08:00, so it\'s Maya, and she\'s finished well before assembly.' },
    fixNote: 'Helen\'s password had expired, and the hall laptop only showed "incorrect password". Reset it with her on the phone, signed her in on the hall laptop, and opened the assembly slides to check.',
  },
  {
    id: 'n-keller-phone', at: 150, channel: 'phone', client: 'kfl', contact: 'tkeller', kb: 'PB-13',
    title: 'Partner\'s phone stopped getting email',
    body: 'Tom Keller. I changed my password this afternoon like your team asked, and now my phone won\'t get email at all. I\'m in court at nine tomorrow and I need the filing confirmations tonight. Can someone sort it now?',
    truth: { priority: 'P2', okPri: ['P1'], board: 'Help Desk', skill: 'M365', onsite: false, est: 30, dispatch: true, startBy: 1260, closeAs: 'resolved', tonight: true,
      why: 'One VIP who can\'t work, with a deadline: P2. Keller & Finch is premium, so Jordan fixes it tonight.' },
    fixNote: 'The phone was still signing in with the old password and had locked the account. Unlocked it, removed and re-added the account on Tom\'s iPhone with him on the phone. Mail is syncing.',
  },
  {
    id: 'n-pp-mac', at: 225, channel: 'email', client: 'pp', contact: 'jalvarez', kb: 'PB-13',
    title: 'MacBook stuck in a login loop after an update',
    body: 'Hi, my MacBook installed an update tonight and now it just goes back to the login screen every time I sign in. My client deck for 10am tomorrow is on it. Can someone fix it first thing in the morning? Jess',
    truth: { priority: 'P2', okPri: ['P3'], board: 'Help Desk', skill: 'Mac', onsite: false, est: 60, dispatch: true, startBy: DAY + 540, closeAs: null, tonight: false,
      why: 'The owner can\'t work and has a 10am deadline: P2. Pixel & Pine buys block hours, so after hours is P1 only. Book Ana for 08:00, and since an hour is more than the 0.5 left on the block, get Rob\'s approval first.' },
    am: { reply: 'Saw this. I texted Jess and she\'s approved a 10-hour top-up. Book it for first thing.' },
    fixNote: 'The update had left a corrupted login item. Booted to recovery with Jess on a call, removed it and reset the keychain. She\'s signed in and her deck opens.',
    evaluate(t, ded, good) {
      const booked = logged('schedule', e => e.ticket === t.id), am = logged('am-approved', e => e.ticket === t.id).length;
      if (booked.length && !am && booked.some(e => e.dur / 60 > CLIENTS.pp.block)) ded.push([15, 'Booked an hour for a block-hours client with 0.5 hours left, without the Account Manager\'s approval (PB-07).']);
      else if (am) good.push('Got the top-up approved before booking.');
    },
  },
  {
    id: 'n-bl-warehouse', at: 330, channel: 'phone', client: 'bl', contact: 'mwebb', sm: true, kb: 'PB-13',
    p1Chase: 'It\'s still down here. Twenty people are standing around and the trucks leave at five. Is anyone actually on this?',
    title: 'Warehouse scanners can\'t connect: night shift stopped',
    body: 'Marcus Webb, night supervisor at the Brightline warehouse. Since about ten none of the handheld scanners can connect, so we can\'t pick a single order. I\'ve got twenty pickers standing around and the trucks leave at five. Who can look at this now?',
    truth: { priority: 'P1', board: 'Infrastructure', skill: 'Network', onsite: false, est: 45, dispatch: true, startBy: 1380, closeAs: 'resolved', tonight: true,
      why: 'The whole warehouse shift is stopped with trucks due at 05:00: P1. On a standard agreement a P1 still gets Jordan tonight, billed at the after-hours rate.' },
    fixNote: 'A power blip at 21:50 restarted the warehouse switch, and the scanner VLAN came back without its DHCP relay. Re-applied the relay config remotely. All 24 scanners have addresses and are picking again.',
    evaluate(t, ded, good) {
      if (logged('notify-sm', e => e.ticket === t.id).length) good.push('Paged the Service Manager for the P1, even overnight.');
      else ded.push([15, 'A whole site stopped overnight and the Service Manager never heard. P1s get paged at any hour.']);
    },
  },
  {
    id: 'n-oak-lab', at: 400, channel: 'alert', client: 'oak', contact: null, from: 'RMM monitoring', kb: 'PB-06',
    title: 'OAK-LAB-VM03 offline: no heartbeat',
    body: 'ALERT  OAK-LAB-VM03  Agent heartbeat missed for 6h 10m. Last seen 17:32.',
    truth: { priority: null, board: null, skill: null, dispatch: false, closeAs: 'noise',
      why: 'Oakridge\'s lab VMs shut down every night. Close it as no action needed, and definitely don\'t wake anyone.' },
  },
  {
    id: 'n-hdg-maint', at: 480, channel: 'vendor', client: 'hdg', contact: 'lpark', from: 'Comcast Business', noResponseSla: true, kb: 'PB-08',
    notice: 'Comcast has planned maintenance on the Northside clinic\'s internet this Saturday from 06:00 to 08:00, with up to 30 minutes of outage. Nothing is needed from you, but anyone opening early should expect a short drop.',
    title: 'Planned maintenance Saturday: Northside circuit',
    body: 'Comcast Business: Planned maintenance on circuit NTH-44187 (Harbor Dental Group, Northside) on Saturday from 06:00 to 08:00. Expect up to 30 minutes of outage. No action is required.',
    truth: { priority: null, board: null, skill: null, dispatch: false, closeAs: 'noise',
      why: 'A provider notice needs no technician, but Harbor Dental should know. Pass it on, then close as no action needed.' },
    evaluate(t, ded, good) {
      if (logged('client-msg', e => e.ticket === t.id && e.kind === 'update').length) good.push('Passed the maintenance notice on to Lena.');
      else ded.push([10, 'Harbor Dental never heard that Northside\'s internet drops on Saturday. Send them a status update.']);
    },
  },
  {
    id: 'n-hdg-monitor', at: 600, channel: 'email', client: 'hdg', contact: 'jfox', kb: 'PB-13',
    title: 'Front desk second monitor flickers',
    body: 'Hi, just logging this before I forget: the second monitor at the Downtown front desk keeps flickering. Not urgent, the main screen is fine. Jamie',
    truth: { priority: 'P4', okPri: ['P3'], board: 'Field Services', skill: 'Hardware', onsite: true, est: 30, dispatch: true, startBy: DAY + 750, closeAs: null, tonight: false,
      why: 'One user, a workaround, and they said it isn\'t urgent: P4. Premium cover doesn\'t mean everything happens tonight. It\'s Luis on Friday, in Harbor Dental\'s 12:00–13:00 visit window.' },
    fixNote: 'The monitor cable was loose and kinked behind the desk. Replaced it. No more flicker.',
  },
  {
    id: 'n-kfl-phish', at: 750, channel: 'email', client: 'kfl', contact: 'msantos', sm: true, kb: 'PB-13',
    title: 'Entered my password on a "mailbox full" page',
    body: 'Hi, sorry for the early email. I couldn\'t sleep, checked my inbox, and clicked a "your mailbox is full" email from Microsoft. I typed in my password before I noticed the address looked wrong. Maria',
    truth: { priority: 'P1', board: 'Security', skill: 'Security', onsite: false, est: 30, dispatch: true, startBy: DAY + 360, closeAs: 'resolved', tonight: true,
      why: 'Suspected compromised credentials are always P1 on the Security board (PB-01), at 05:30 too. Keller & Finch is premium, so Jordan locks it down now, not at 08:00.' },
    fixNote: 'Reset Maria\'s password, revoked all sessions and checked sign-ins: one failed sign-in from abroad at 05:41, nothing got in. No new inbox rules. MFA confirmed.',
    evaluate(t, ded, good) {
      if (logged('notify-sm', e => e.ticket === t.id).length) good.push('Paged the Service Manager for a security incident.');
      else ded.push([15, 'The office manager\'s account may be compromised, and the Service Manager never heard about it.']);
    },
  },
];

const isNightSeed = seed => seed === 'night';

function buildNight(seed) {
  const copy = s => Object.assign(Object.create(s), { key: s.id });
  const tickets = NIGHT_SCENARIOS.map(copy).sort((a, b) => a.at - b.at);
  tickets.forEach((t, i) => { t.id = String(4601 + i); });
  return { seed, drill: null, night: true, tickets, events: [] };
}
