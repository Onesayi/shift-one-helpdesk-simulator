// Service Coordinator scenarios. The coordinator never fixes anything: they triage, communicate,
// schedule the right technician at the right time, and chase approvals and vendors.
// Technicians then do the work in the simulation, and the outcome depends on who you sent and when.
//
//   at        minutes after 08:00 the ticket arrives (-1 = carried over from yesterday)
//   channel   email | phone | alert | vendor | carry   (phone tickets ring first and can be missed)
//   truth     what a good coordinator would decide:
//               priority, okPri (other accepted priorities), board (string or list), skill, onsite, est,
//               dispatch (true: needs a tech, false: must not get one), startBy (latest start, absolute minute),
//               closeAs ('resolved' | 'noise' | 'declined' | null = may stay open at end of shift), why (feedback)
//   pre       carried-over tickets: triage and appointment already set
//   group     tickets that are really one incident (should be merged)
//   sm        the Service Manager must be notified
//   approval  replies from authorized contacts to "Request approval": { contactId: { text, ok } }
//   am        Account Manager must approve before work: { reply }
//   work(t, appt, tech)   optional custom outcome when the tech finishes; return null for the default
//   onVendor(t, vendor)   optional: what happens when a vendor case is logged
//   evaluate(t, ded, good) scenario-specific grading on top of the engine's standard checks
//
// Shift variation (see buildShift below). Each run draws its tickets from this pool with a seed:
//   id        the scenario's key. The ticket number the player sees is assigned per run, in arrival order
//             (the 'classic' seed keeps these ids as they are).
//   window    [earliest, latest] arrival in minutes after 08:00, in which the truth still holds. Without one,
//             the ticket always arrives at `at`. A group moves together, using its first ticket's window.
//   slide     startBy moves with the arrival time (urgent work: "start within an hour", not "by 11:00").
//   pick      a category every shift must include at least one of: p1 | noise | approval | onsite
//   avoid     scenario ids this one never shares a shift with (e.g. two urgent jobs only one tech can do)

const SCENARIOS = [
  {
    id: '4471', at: -1, channel: 'carry', client: 'kfl', contact: 'msantos', kb: 'PB-04',
    title: 'Outlook archive keeps failing',
    body: 'Hi, my Outlook archive fails halfway every time and my mailbox is almost full. Ben said he\'d connect at 11 tomorrow to fix it. Thanks, Maria',
    pre: { triage: { board: 'Help Desk', priority: 'P3', skill: 'M365', onsite: false, est: 60 }, appt: { tech: 'ben', start: 660, dur: 60 } },
    truth: { priority: 'P3', board: 'Help Desk', skill: 'M365', onsite: false, est: 60, dispatch: true, startBy: DAY + 960, closeAs: null },
    fixNote: 'Mailbox was at 49.6 of 50 GB, which made the archive job time out. Enabled the online archive and ran it: mailbox now at 21 GB.',
    evaluate(t, ded, good) {
      if (logged('client-msg', e => e.ticket === t.id && e.at >= (G.techs.ben.sickAt ?? DAY) && ['update', 'sched'].includes(e.kind)).length) good.push('Told Maria her 11:00 appointment had changed.');
      else ded.push([10, 'Maria was expecting Ben at 11:00. Tell the client when their appointment moves.']);
    },
  },
  {
    id: '4476', at: -1, channel: 'carry', client: 'hdg', contact: 'lpark', kb: 'PB-04',
    title: 'Set up scan-to-email on the Eastgate copier',
    body: 'Our Eastgate front desk needs scan-to-email on the copier so they can send X-ray referrals. Booked with Ben for 13:30 tomorrow. Lena',
    pre: { triage: { board: 'Help Desk', priority: 'P3', skill: 'Printers', onsite: false, est: 45 }, appt: { tech: 'ben', start: 810, dur: 45 } },
    truth: { priority: 'P3', board: 'Help Desk', skill: 'Printers', onsite: false, est: 45, dispatch: true, startBy: DAY + 960, closeAs: null },
    fixNote: 'Configured scan-to-email on the Eastgate copier with an SMTP relay account and address book for the three referral partners. Test scan received.',
    evaluate(t, ded, good) {
      if (logged('client-msg', e => e.ticket === t.id && e.at >= (G.techs.ben.sickAt ?? DAY) && ['update', 'sched'].includes(e.kind)).length) good.push('Let Lena know the appointment had moved.');
      else ded.push([10, 'Lena was expecting Ben at 13:30. Tell the client when their appointment moves.']);
    },
  },
  {
    id: '4501', at: 0, window: [0, 120], channel: 'email', client: 'hdg', contact: 'lpark', kb: 'PB-03',
    title: 'Downtown front desk PC can\'t print claim forms',
    body: 'Hi team, the second front desk PC at our Downtown clinic won\'t print. Jobs just sit in the queue. The other front desk PC prints fine for now. We batch our insurance claims at 3pm, so we\'d love it sorted before then. Thanks, Lena',
    truth: { priority: 'P3', board: 'Help Desk', skill: 'Printers', onsite: false, est: 30, dispatch: true, startBy: 870, closeAs: 'resolved',
      why: 'One PC, one user, and a workaround exists: P3 on the Help Desk, done remotely before the 3pm claims run.' },
    fixNote: 'The PC was pointed at an old print queue after a driver update. Re-added the correct queue and set it as default. Test page printed.',
    evaluate(t, ded) {
      if (logged('schedule', e => e.ticket === t.id && e.onsite).length) ded.push([10, 'Sent a field visit for a remote fix. Harbor Dental only allows visits at lunch, and it costs a drive.']);
    },
  },
  {
    id: '4502', at: 5, window: [0, 240], channel: 'alert', client: 'bl', contact: null, from: 'RMM monitoring', kb: 'PB-06',
    title: 'BL-FS01: disk C: 92% used (threshold 90%)',
    body: 'ALERT  BL-FS01  Disk C:\\ usage 92.4% (threshold 90%)\nFree space: 11.8 GB of 160 GB. Growth last 7 days: +9 GB.',
    truth: { priority: 'P3', board: 'Infrastructure', skill: 'Servers', onsite: false, est: 30, dispatch: true, startBy: 990, closeAs: 'resolved',
      why: 'A server filling up is real, but it isn\'t down yet: P3 on Infrastructure, fixed today.' },
    fixNote: 'Cleared 38 GB of old IIS logs and a stale WSUS download cache on BL-FS01. C: is now at 61%. Added a log-rotation task.',
  },
  {
    id: '4503', at: 10, window: [5, 40], pick: 'noise', channel: 'alert', client: 'oak', contact: null, from: 'RMM monitoring', kb: 'PB-06',
    title: 'OAK-LAB-VM02 offline: no heartbeat for 8 hours',
    body: 'ALERT  OAK-LAB-VM02  Agent heartbeat missed for 8h 04m. Last seen 23:52.',
    truth: { priority: null, board: null, skill: null, dispatch: false, closeAs: 'noise',
      why: 'Oakridge\'s notes say the lab VMs shut down every night. This alert is expected.' },
    evaluate(t, ded, good) {
      if (t.closed && t.closed.reason === 'noise') {
        if (t.closed.at - t.arrived <= 30) good.push('Checked the client notes and cleared the noise quickly.');
        else ded.push([5, `Took ${t.closed.at - t.arrived} minutes to clear a known-noise alert. It sat on the board all that time.`]);
      }
    },
  },
  {
    id: '4504', at: 15, window: [10, 300], channel: 'phone', client: 'kfl', contact: 'msantos', kb: 'PB-04',
    title: 'New associate starting Monday',
    body: 'Hi, it\'s Maria at Keller & Finch. We have a new associate, Daniel Cho, starting Monday. He\'ll need an account and email, a laptop set up, and access to the Litigation share like the other associates. There\'s a spare laptop in our store room you can use.',
    truth: { priority: 'P4', board: 'Projects & Onboarding', skill: 'Onboarding', onsite: false, est: 120, dispatch: true, startBy: DAY + 900, closeAs: null,
      why: 'A new starter is planned work: P4 on Projects & Onboarding, booked before Monday.' },
    fixNote: 'Created Daniel Cho\'s account and mailbox, added him to Litigation-RW and All-Staff, and enrolled laptop KFL-LT-22 remotely. Ready for Monday.',
    evaluate(t, ded, good) {
      const a = finalAppt(t);
      if (a && a.start >= DAY) good.push('Booked the setup for Friday and kept today\'s capacity for today\'s problems.');
      if (logged('approval-req', e => e.ticket === t.id).length) good.push('Double-checked the request, though Maria is an authorized contact herself.');
    },
  },
  {
    id: '4505', at: 30, window: [15, 300], pick: 'approval', channel: 'email', client: 'kfl', contact: 'jmorrow', kb: 'PB-05',
    title: 'Access to the Partners folder please',
    body: 'Hi! Could you give me access to the Partners folder on the S: drive? I need to grab a letter template from there. Thanks, Jake',
    truth: { priority: 'P4', okPri: ['P3'], board: 'Help Desk', skill: 'M365', onsite: false, est: 15, dispatch: false, closeAs: 'declined',
      why: 'Share access at Keller & Finch needs Maria or a partner to approve. Maria said no, so nobody should be dispatched.' },
    approval: {
      msantos: { ok: false, text: 'No. Jake doesn\'t need the Partners folder, it has partner compensation files in it. I\'ll send him the template myself. Please close the ticket.' },
      tkeller: { ok: false, text: 'Please check with Maria, she handles access. But no, the Partners folder is partners only.' },
    },
    work(t, appt, tech) {
      t.flags.harm = true;
      return { kind: 'done', note: `Added Jake Morrow to Partners-RW as requested. (${tech.name})` };
    },
    evaluate(t, ded, good) {
      const reqs = logged('approval-req', e => e.ticket === t.id);
      if (reqs.some(e => CLIENTS.kfl.contacts[e.contact].auth)) good.push('Asked an authorized contact directly, not the requester.');
      if (reqs.some(e => !CLIENTS.kfl.contacts[e.contact].auth)) ded.push([15, 'Asked someone who can\'t approve access (they aren\'t an authorized contact).']);
      if (t.flags.harm) ded.push([40, 'A technician gave a paralegal access to partner compensation files. Nobody authorized it.']);
      else if (!reqs.length && !logged('work-start', e => e.ticket === t.id).length) ded.push([10, 'Never asked Maria or a partner. The request just sat there.']);
    },
  },
  {
    id: '4506', at: 40, window: [40, 200], slide: true, pick: 'p1', channel: 'phone', client: 'hdg', contact: 'areyes', sm: true, workAt: 10,
    p1Chase: 'Any news? We\'re still completely down here and nobody has told us anything.', vendor: 'Comcast Business (ISP)', kb: 'PB-09',
    title: 'Northside clinic: no internet, no phones, no schedule',
    body: 'This is Dr. Reyes. Nothing works at the Northside clinic. No internet, we can\'t see the patient schedule, and the phones are dead too. I have a waiting room full of patients. What is going on?',
    truth: { priority: 'P1', board: 'Infrastructure', skill: 'Firewall', onsite: false, est: 60, dispatch: true, startBy: 540, closeAs: 'resolved',
      why: 'A whole clinic down with patients waiting: P1, Infrastructure. Harbor Dental allows only Sipho on their firewall.' },
    work(t, appt, tech) {
      if (!tech.skills.includes('Firewall')) return null;
      if (t.flags.restored) return { kind: 'done', note: 'Circuit is back and the firewall re-established the VPN to the other clinics. Phones and the schedule are working. Dr. Reyes confirmed.' };
      t.flags.diagnosed = true;
      return { kind: 'vendor', note: 'Firewall is healthy, but the WAN port has no signal from the ISP. This is a Comcast circuit fault. Can you open a case with Comcast Business? I\'ll stay on it and bring it up the moment the line is back.' };
    },
    onVendor(t, vendor) {
      if (vendor !== this.vendor || t.flags.vendorCase) return;
      t.flags.vendorCase = true;
      later(5, () => {
        t.flags.eta = true;
        post(t, 'vendor', 'Comcast Business: Case CB-88213 opened. A fibre cut near Northside is affecting several customers. Crew onsite, estimated restoration in about 45 minutes.', 'vendor');
      });
      later(50, () => {
        t.flags.restored = true;
        post(t, 'vendor', 'Comcast Business: CB-88213 restored. Please confirm service.', 'vendor');
        if (t.status === 'Waiting on vendor') {
          const a = finalAppt(t);
          workDone(t, a ? a.tech : 'sipho', { kind: 'done', note: 'Circuit is back and the firewall re-established the VPN to the other clinics. Phones and the schedule are working. Dr. Reyes confirmed.' });
        }
      });
    },
    evaluate(t, ded, good) {
      if (logged('notify-sm', e => e.ticket === t.id).length) good.push('Paged the Service Manager for a P1.');
      else ded.push([15, 'A P1 with a clinic full of patients, and the Service Manager never heard about it.']);
      const cases = logged('vendor-case', e => e.ticket === t.id);
      if (cases.some(e => e.vendor === this.vendor)) good.push('Opened the ISP case as soon as Sipho asked.');
      else if (t.flags.diagnosed) ded.push([20, 'Sipho asked for a Comcast case and nobody opened one. The clinic stayed down.']);
      if (cases.some(e => e.vendor !== this.vendor)) ded.push([5, 'Opened a case with the wrong vendor.']);
      if (t.flags.eta) {
        const eta = logged('vendor-msg', e => e.ticket === t.id)[0];
        if (logged('client-msg', e => e.ticket === t.id && e.kind === 'update' && eta && e.seq > eta.seq).length) good.push('Passed the ISP\'s ETA to Dr. Reyes.');
        else ded.push([10, 'Comcast gave an ETA and Dr. Reyes never heard it.']);
      }
      if (logged('schedule', e => e.ticket === t.id && e.tech !== 'sipho').length) ded.push([10, 'Harbor Dental\'s notes say only Sipho touches their firewall.']);
    },
  },
  {
    id: '4507', at: 60, window: [45, 150], slide: true, channel: 'email', client: 'oak', contact: 'lrivera', group: 'oak-mail', kb: 'PB-09',
    title: 'Email keeps asking me to sign in',
    body: 'Good morning, my email isn\'t loading. It keeps asking me to sign in and then says my account "doesn\'t have a license"? Lucia, Room 4',
    truth: { priority: 'P2', board: 'Help Desk', skill: 'M365', onsite: false, est: 60, dispatch: true, startBy: 660, closeAs: 'resolved',
      why: 'Several staff can\'t use email: P2. One ticket, one tech, M365 skills.' },
    fixNote: '14 staff lost their Microsoft 365 licences when the school\'s subscription payment failed overnight. Reassigned licences from the spare pool so everyone\'s back in, and asked Carl to update the card on file.',
  },
  {
    id: '4508', at: 63, slide: true, channel: 'email', client: 'oak', contact: 'kosei', group: 'oak-mail', kb: 'PB-09',
    title: 'Outlook says "Need password"',
    body: 'Outlook has a yellow bar saying "Need password" and it won\'t take mine. Webmail says something about a licence. Kwame, Room 7',
    truth: { priority: 'P2', board: 'Help Desk', skill: 'M365', onsite: false, est: 60, dispatch: true, startBy: 660, closeAs: 'resolved',
      why: 'Same fault as the other Oakridge email tickets.' },
    fixNote: 'Same fix as the parent ticket: licence reassigned.',
  },
  {
    id: '4509', at: 66, slide: true, channel: 'email', client: 'oak', contact: 'alindgren', group: 'oak-mail', kb: 'PB-09',
    title: 'Nobody in the east wing has email',
    body: 'Hi, none of us in the east wing can get into email this morning. Is something down? Anna',
    truth: { priority: 'P2', board: 'Help Desk', skill: 'M365', onsite: false, est: 60, dispatch: true, startBy: 660, closeAs: 'resolved',
      why: 'Same fault as the other Oakridge email tickets.' },
    fixNote: 'Same fix as the parent ticket: licence reassigned.',
  },
  {
    id: '4510', at: 85, window: [60, 330], channel: 'phone', client: 'pp', contact: 'jalvarez', am: { reply: 'Just spoke to Jess. She\'s bought another 10-hour block, so you\'re clear to schedule it.' }, kb: 'PB-07',
    title: 'MacBook crawling, spinning wheel everywhere',
    body: 'Hey, it\'s Jess from Pixel & Pine. My MacBook has been crawling since yesterday, spinning wheel on everything. I\'ve got a client presentation tomorrow afternoon. Can someone take a look?',
    truth: { priority: 'P3', board: 'Help Desk', skill: 'Mac', onsite: false, est: 90, dispatch: true, startBy: DAY + 780, closeAs: 'resolved',
      why: 'One user (the owner) slowed down, with a deadline tomorrow: P3. 90 minutes of work against 0.5 hours left in the block means the Account Manager has to approve a top-up first.' },
    fixNote: 'Startup disk was 98% full from Premiere render caches. Cleared 180 GB and set the cache to purge weekly. Much faster now.',
    evaluate(t, ded, good) {
      const ok = logged('am-approved', e => e.ticket === t.id)[0];
      const firstSched = logged('schedule', e => e.ticket === t.id)[0];
      if (firstSched && (!ok || firstSched.seq < ok.seq)) ded.push([20, 'Scheduled 90 minutes of work with 0.5 hours left in the block, before the Account Manager approved a top-up.']);
      else if (ok) good.push('Checked the block balance and got the top-up approved before dispatching.');
      else ded.push([10, 'The block had 0.5 hours left. Escalate to the Account Manager so the work can go ahead.']);
    },
  },
  {
    id: '4511', at: 135, window: [90, 300], channel: 'alert', client: 'hdg', contact: 'lpark', from: 'RMM monitoring', noResponseSla: true, kb: 'PB-06',
    title: 'HDG-DC01: backup job "Nightly-Full" failed (2nd in a row)',
    body: 'ALERT  HDG-DC01  Backup job Nightly-Full FAILED\nError: Target \\\\HDG-NAS01\\Backups not enough free space.\nPrevious run: FAILED (same error).',
    truth: { priority: 'P2', board: 'Infrastructure', skill: 'Backup', onsite: false, est: 60, dispatch: true, startBy: 990, closeAs: 'resolved',
      why: 'Two failed backups in a row on the server holding patient data: P2, fixed today so tonight\'s backup runs.' },
    fixNote: 'The NAS filled up after a retention change kept 90 days instead of 30. Fixed retention, pruned old restore points and ran a manual backup: success.',
  },
  {
    id: '4512', at: 160, window: [120, 260], slide: true, channel: 'email', client: 'bl', contact: 'bldesk', kb: 'PB-03',
    title: 'Escalation: PRINT01 spooler keeps crashing',
    body: 'Escalating from the Brightline service desk. The Print Spooler on PRINT01 stops about 10 minutes after we start it. All of HQ floor 2 can\'t print. We\'ve restarted it twice and checked the queue. Event log shows a fault in a printer driver DLL. Can your server team take it? Brightline IT',
    truth: { priority: 'P2', board: 'Infrastructure', skill: 'Servers', onsite: false, est: 60, dispatch: true, startBy: 780, closeAs: 'resolved',
      why: 'A whole floor can\'t print: P2. Brightline\'s own Tier 1 already did the basics, so it goes to a server engineer, not back to Tier 1.' },
    fixNote: 'A driver for a newly added label printer was crashing the spooler. Removed the driver, installed the vendor\'s v4 driver, and the spooler has been stable for 20 minutes.',
    evaluate(t, ded) {
      if (logged('schedule', e => e.ticket === t.id && ['ana', 'ben'].includes(e.tech)).length) ded.push([5, 'Brightline\'s own Tier 1 escalated this. Sending it to our Tier 1 repeats their work.']);
    },
  },
  {
    id: '4513', at: 180, window: [150, 330], slide: true, pick: 'p1', channel: 'phone', client: 'kfl', contact: 'tkeller', sm: true, kb: 'PB-01',
    title: 'Typed my password into a fake DocuSign page',
    body: 'Tom Keller here. I clicked a DocuSign link in an email about a settlement, and it asked me to sign in, so I did. Then it just went to a blank page. My assistant says those emails are fake. Did I just do something stupid?',
    truth: { priority: 'P1', board: 'Security', skill: 'Security', onsite: false, est: 60, dispatch: true, startBy: 675, closeAs: 'resolved',
      why: 'Suspected compromised credentials are always P1 on the Security board, whatever the matrix says.' },
    fixNote: 'Reset Tom\'s password, revoked all sessions and tokens, and removed a malicious inbox rule that forwarded mail externally. MFA methods confirmed. No other access found.',
    evaluate(t, ded, good) {
      if (logged('notify-sm', e => e.ticket === t.id).length) good.push('Paged the Service Manager for a security incident.');
      else ded.push([15, 'A managing partner\'s account may be compromised, and the Service Manager never heard about it.']);
    },
  },
  {
    id: '4514', at: 210, window: [200, 220], pick: 'onsite', channel: 'phone', client: 'oak', contact: 'cjensen', kb: 'PB-04',
    title: 'Hall projector dead, assembly at 1pm',
    body: 'Hi, Carl at Oakridge. The projector in the main hall won\'t turn on at all. The light just blinks orange. We have the whole-school assembly at 1pm and Helen is presenting from it. Can someone come out?',
    truth: { priority: 'P2', okPri: ['P3'], board: 'Field Services', skill: 'Hardware', onsite: true, est: 30, dispatch: true, startBy: 750, closeAs: 'resolved',
      why: 'Hardware in a hall needs a field visit. It must be before 1pm, but Oakridge allows no visits 11:30–12:30. That leaves a 12:30 start.' },
    fixNote: 'The projector lamp had failed. Swapped in the spare lamp from the office store room and tested it with the hall laptop. Ready for the assembly.',
  },
  {
    id: '4515', at: 240, window: [240, 270], pick: 'onsite', channel: 'vendor', client: 'hdg', contact: 'lpark', from: 'Dell Technologies (RMA)', noResponseSla: true, kb: 'PB-08',
    title: 'RMA part delivered: HDG-LT-07 motherboard',
    body: 'Dell Technologies: Replacement motherboard for Service Tag 7QX2L93 (HDG-LT-07) was delivered to Harbor Dental, Eastgate clinic, at 11:52. A technician is required to install it. Please return the faulty part in the box provided.',
    truth: { priority: 'P3', okPri: ['P4'], board: 'Field Services', skill: 'Hardware', onsite: true, est: 60, dispatch: true, startBy: DAY + 720, closeAs: null,
      why: 'Install needs an onsite visit inside Harbor Dental\'s 12:00–13:00 window. Today\'s window has gone, so Friday at 12:00.' },
    fixNote: 'Replaced the motherboard in HDG-LT-07, updated BIOS, and returned the faulty board to Dell.',
    evaluate(t, ded, good) {
      if (logged('client-msg', e => e.ticket === t.id && e.kind === 'sched').length) good.push('Told Lena when the install is booked.');
      else ded.push([5, 'Lena doesn\'t know when a tech is coming to Eastgate. Send an appointment confirmation.']);
    },
  },
  {
    id: '4516', at: 300, window: [240, 420], pick: 'approval', channel: 'email', client: 'kfl', contact: 'tkeller', from: 'Tom Keller <tom.keller@kellerfinch-law.co>', noResponseSla: true, kb: 'PB-05',
    approval: {
      msantos: { ok: false, next: 'Triaged', text: 'Tom\'s in court all day and he would never ask for that. And that isn\'t our domain. We\'re kellerfinch.com, not kellerfinch-law.co. Please treat it as phishing.' },
      tkeller: { ok: false, next: 'Triaged', text: '(Replying from the number on file) I didn\'t send that. Our domain is kellerfinch.com. Treat it as phishing, please.' },
    },
    title: 'Forward all my email to my personal address',
    body: 'I\'m travelling and can\'t get into Outlook. Please set up forwarding of all my email to tkeller.personal@gmail.com today. Urgent, I\'m waiting on a settlement document. Don\'t call, I\'m in meetings. Tom',
    truth: { priority: 'P2', okPri: ['P1'], board: 'Security', skill: 'Security', onsite: false, est: 45, dispatch: true, startBy: 960, closeAs: 'resolved',
      why: 'An unusual request, a VIP, a lookalike domain (kellerfinch-law.co) and "don\'t call me": this is impersonation. Security board, verify through a known contact, and send Maya to investigate, not to set up forwarding.' },
    fixNote: 'Confirmed kellerfinch-law.co is a lookalike domain. Blocked it tenant-wide, purged the message from 6 mailboxes, and checked that no forwarding rules exist on Tom\'s mailbox.',
    work(t, appt, tech) {
      if (tech.skills.includes('Security')) return null;
      t.flags.harm = true;
      return { kind: 'done', note: `Set up forwarding of all of Tom Keller's mail to tkeller.personal@gmail.com as requested. (${tech.name})` };
    },
    evaluate(t, ded, good) {
      const reqs = logged('approval-req', e => e.ticket === t.id && CLIENTS.kfl.contacts[e.contact].auth);
      if (reqs.length) good.push('Verified the request through a known contact instead of replying to the sender.');
      else ded.push([10, 'Never checked with Maria or Tom through a known contact.']);
      if (t.flags.harm) ded.push([50, 'A technician forwarded the managing partner\'s mailbox to an attacker\'s Gmail.']);
    },
  },

  // Extra pool: these never appear in the 'classic' shift, only in seeded ones.
  {
    id: 'oak-wifi', extra: true, at: 120, window: [60, 330], pick: 'onsite', channel: 'email', client: 'oak', contact: 'cjensen', kb: 'PB-04',
    title: 'Wi-Fi drops in the library',
    body: 'Hi, the library Wi-Fi keeps dropping every few minutes. Everywhere else in the school is fine. The kids can still use the wired PCs in there, it\'s just the iPads. No rush today, but could someone look at it before the end of the week? Carl',
    truth: { priority: 'P3', okPri: ['P4'], board: 'Field Services', skill: 'Network', onsite: true, est: 60, dispatch: true, startBy: DAY + 900, closeAs: null,
      why: 'One room, degraded, with a workaround: P3. The access point needs hands on it, so Luis onsite, outside Oakridge\'s 11:30–12:30 lunch ban.' },
    fixNote: 'The library access point\'s PoE injector was failing under load. Replaced it and moved the AP to a clear channel. iPads have stayed connected for 30 minutes.',
  },
  {
    id: 'pp-offline', extra: true, at: 20, window: [0, 180], pick: 'noise', channel: 'alert', client: 'pp', contact: null, from: 'RMM monitoring', kb: 'PB-06',
    title: 'PP-MBP-03 offline: no check-in for 3 days',
    body: 'ALERT  PP-MBP-03  Agent has not checked in for 3d 02h. Last seen Monday 17:41.',
    truth: { priority: null, board: null, skill: null, dispatch: false, closeAs: 'noise',
      why: 'Pixel & Pine\'s notes say Theo is on leave with his MacBook switched off. Expected, and a tech would burn their prepaid hours for nothing.' },
    evaluate(t, ded, good) {
      if (t.closed && t.closed.reason === 'noise') {
        if (t.closed.at - t.arrived <= 30) good.push('Checked the client notes and cleared the noise quickly.');
        else ded.push([5, `Took ${t.closed.at - t.arrived} minutes to clear a known-noise alert.`]);
      }
    },
  },
  {
    id: 'bl-maint', extra: true, at: 150, window: [30, 360], pick: 'noise', channel: 'vendor', client: 'bl', contact: 'bldesk', from: 'AT&T Business', noResponseSla: true, kb: 'PB-08',
    notice: 'AT&T has planned maintenance on your HQ internet circuit tonight from 23:00 to 02:00, with up to 20 minutes of outage. Nothing is needed from you, but anyone working late should expect a short drop.',
    title: 'Planned maintenance tonight: Brightline HQ circuit',
    body: 'AT&T Business: Planned network maintenance on circuit DEN-HQ-77310 (Brightline Logistics HQ) tonight from 23:00 to 02:00. Expect up to 20 minutes of outage during this window. No action is required.',
    truth: { priority: null, board: null, skill: null, dispatch: false, closeAs: 'noise',
      why: 'A provider notice needs no technician, but Brightline needs to know their HQ internet drops tonight. Pass it on, then close as no action needed.' },
    evaluate(t, ded, good) {
      if (logged('client-msg', e => e.ticket === t.id && e.kind === 'update').length) good.push('Passed the maintenance notice on to Brightline.');
      else ded.push([10, 'Brightline never heard that their HQ internet goes down tonight. Send them a status update.']);
    },
  },
  {
    id: 'bl-vpn', extra: true, at: 100, window: [60, 270], slide: true, avoid: ['4506'], channel: 'phone', client: 'bl', contact: 'dokafor', sm: true, kb: 'PB-03',
    title: 'Denver office can\'t reach the warehouse system',
    body: 'Daniel Okafor, Brightline. Our Denver office lost its connection to HQ about twenty minutes ago. Internet, email and Teams work, but nobody there can open the warehouse system, so they\'re picking orders off paper. Our desk says the site-to-site VPN is down. Can your network people get on it?',
    truth: { priority: 'P2', okPri: ['P1'], board: 'Infrastructure', skill: 'Firewall', onsite: false, est: 60, dispatch: true, startBy: 640, closeAs: 'resolved',
      why: 'A whole office slowed down, but still working on paper: P2. A site-to-site VPN lives on the firewall, which is Sipho\'s skill, not general networking.' },
    fixNote: 'The Denver firewall\'s VPN tunnel failed after the ISP changed their public IP overnight. Updated the peer address on both ends; the tunnel is up and the warehouse system is reachable.',
  },
  {
    id: 'kfl-copier', extra: true, at: 200, window: [90, 390], channel: 'phone', client: 'kfl', contact: 'msantos', vendor: 'Ricoh (copier lease)', kb: 'PB-08',
    title: 'Main copier jammed, error SC542',
    body: 'Hi, Maria again. The big copier on our floor has stopped with error SC542 on the screen and it smells a bit hot. People are using the small printer in the back for now, but we need the copier for court bundles by tomorrow.',
    truth: { priority: 'P3', board: ['Help Desk', 'Field Services'], skill: 'Printers', onsite: null, est: 30, dispatch: false, closeAs: null,
      why: 'The copier is leased and Ricoh services it, so this is a vendor case, not a tech visit. Pass Ricoh\'s visit time on to Maria.' },
    work(t, appt, tech) {
      return { kind: 'bounce', note: 'This is the leased Ricoh. Opening it up would void their service agreement, and SC542 is a fuser fault anyway. It needs a Ricoh case.' };
    },
    onVendor(t, vendor) {
      if (vendor !== this.vendor || t.flags.vendorCase) return;
      t.flags.vendorCase = true;
      later(10, () => {
        t.flags.eta = true;
        post(t, 'vendor', 'Ricoh: Case R-55120 opened for the Keller & Finch MP 6055. An engineer will be onsite tomorrow at 09:00 with a replacement fuser unit.', 'vendor');
      });
    },
    evaluate(t, ded, good) {
      const cases = logged('vendor-case', e => e.ticket === t.id);
      if (cases.some(e => e.vendor === this.vendor)) good.push('Sent the leased copier straight to Ricoh.');
      else ded.push([20, 'Keller & Finch\'s notes say Ricoh services the copier. Nobody opened a case with them.']);
      if (cases.some(e => e.vendor !== this.vendor)) ded.push([5, 'Opened a case with the wrong vendor.']);
      if (t.flags.eta) {
        const eta = logged('vendor-msg', e => e.ticket === t.id)[0];
        if (logged('client-msg', e => e.ticket === t.id && e.kind === 'update' && eta && e.seq > eta.seq).length) good.push('Told Maria when Ricoh is coming.');
        else ded.push([10, 'Ricoh booked an engineer and Maria never heard when.']);
      }
    },
  },
  {
    id: 'hdg-iphone', extra: true, at: 110, window: [30, 360], channel: 'email', client: 'hdg', contact: 'areyes', kb: 'PB-01',
    title: 'Work email stopped on my iPhone',
    body: 'Hello, my work email stopped updating on my iPhone this morning. It\'s fine on my office PC, so it\'s not urgent, but I\'d like it back before I leave today. Dr. Reyes',
    truth: { priority: 'P3', board: 'Help Desk', skill: 'M365', onsite: false, est: 30, dispatch: true, startBy: 990, closeAs: 'resolved',
      why: 'A VIP raises the impact, but she can work on her PC: P3, not a P1 because of who is asking. A remote M365 fix today.' },
    fixNote: 'Dr. Reyes\'s phone was still signed in with her old password. Removed and re-added the account in Outlook for iOS. Mail is syncing again.',
  },
  {
    id: 'pp-adobe', extra: true, at: 170, window: [60, 360], channel: 'email', client: 'pp', contact: 'rkaur', kb: 'PB-07',
    title: 'Adobe says I\'m not licensed any more',
    body: 'Hi! Photoshop and Illustrator both say my Creative Cloud licence was removed and I can\'t open anything. I think it happened when Jess was sorting out seats yesterday. I\'m stuck until it\'s back. Rhea',
    truth: { priority: 'P3', board: 'Help Desk', skill: 'Mac', onsite: false, est: 15, dispatch: true, startBy: 990, closeAs: 'resolved',
      why: 'One user who can\'t work: P3. A 15-minute fix fits in the 0.5 hours left on Pixel & Pine\'s block, so just book it.' },
    fixNote: 'Rhea\'s seat had been unassigned in the Adobe Admin Console during yesterday\'s clean-up. Reassigned it and signed her back in on her Mac.',
    evaluate(t, ded, good) {
      const a = finalAppt(t);
      if (a && a.dur <= 30 && !logged('notify-am', e => e.ticket === t.id).length) good.push('Checked the block balance: a short fix fits in what\'s left, no top-up needed.');
    },
  },
];

// ---------------------------------------------------------------------------
// Building a shift. The seed decides which tickets come in, when they arrive, and when Ben goes home,
// so the same seed always plays out (and grades) the same way. 'classic' is the original fixed shift.
// ---------------------------------------------------------------------------
const SHIFT_SIZE = 14;                                    // incidents per seeded shift (duplicates count once), plus carry-overs
const SHIFT_MUST = ['p1', 'noise', 'approval', 'onsite'];  // every seeded shift has at least one of each

const normSeed = x => String(x ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
const newSeed = () => Array.from({ length: 6 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

// Small seeded PRNG (cyrb-style string hash into mulberry32): same seed, same sequence, in every browser.
function seedRng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  let a = h >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildShift(seed) {
  seed = normSeed(seed) || newSeed();
  const classic = seed === 'classic', rnd = seedRng(seed);
  const take = list => list.splice(Math.floor(rnd() * list.length), 1)[0];
  const when = ([lo, hi]) => lo + 5 * Math.floor(rnd() * (Math.floor((hi - lo) / 5) + 1));

  // Incidents: duplicates of one fault arrive together as one unit.
  const units = [];
  for (const s of SCENARIOS) {
    if (s.at < 0 || (classic && s.extra)) continue;
    const u = s.group && units.find(x => x[0].group === s.group);
    if (u) u.push(s); else units.push([s]);
  }
  let chosen = units;
  if (!classic) {
    let pool = units.slice();
    chosen = [];
    const add = u => {
      if (!u) return;
      chosen.push(u);
      pool = pool.filter(x => x !== u && !(x[0].avoid || []).includes(u[0].id) && !(u[0].avoid || []).includes(x[0].id));
    };
    SHIFT_MUST.forEach(tag => add(take(pool.filter(u => u[0].pick === tag))));
    while (chosen.length < SHIFT_SIZE && pool.length) add(take(pool));
  }

  // Each ticket is a thin copy of its scenario, so methods and `this` keep working.
  const copy = (s, extra) => Object.assign(Object.create(s), { key: s.id }, extra);
  const carried = SCENARIOS.filter(s => s.at < 0).map(s => copy(s));
  const today = [];
  for (const u of chosen) {
    const delta = classic || !u[0].window ? 0 : when(u[0].window) - u[0].at;
    for (const s of u) {
      const truth = s.slide && s.truth.startBy != null ? Object.assign({}, s.truth, { startBy: s.truth.startBy + delta }) : s.truth;
      today.push(copy(s, { at: s.at + delta, truth }));
    }
  }
  // The day's tickets are numbered in the order they arrive.
  today.sort((a, b) => a.at - b.at || SCENARIOS.indexOf(Object.getPrototypeOf(a)) - SCENARIOS.indexOf(Object.getPrototypeOf(b)));
  if (!classic) today.forEach((t, i) => { t.id = String(4501 + i); });

  const events = TEAM_EVENTS.map(ev => Object.assign({}, ev, { at: classic || !ev.window ? ev.at : when(ev.window) }));
  return { seed, tickets: carried.concat(today), events };
}
