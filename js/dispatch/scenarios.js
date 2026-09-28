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

const SCENARIOS = [
  {
    id: '4471', at: -1, channel: 'carry', client: 'kfl', contact: 'msantos', kb: 'PB-04',
    title: 'Outlook archive keeps failing',
    body: 'Hi, my Outlook archive fails halfway every time and my mailbox is almost full. Ben said he\'d connect at 11 tomorrow to fix it. Thanks, Maria',
    pre: { triage: { board: 'Help Desk', priority: 'P3', skill: 'M365', onsite: false, est: 60 }, appt: { tech: 'ben', start: 660, dur: 60 } },
    truth: { priority: 'P3', board: 'Help Desk', skill: 'M365', onsite: false, est: 60, dispatch: true, startBy: DAY + 960, closeAs: null },
    fixNote: 'Mailbox was at 49.6 of 50 GB, which made the archive job time out. Enabled the online archive and ran it: mailbox now at 21 GB.',
    evaluate(t, ded, good) {
      if (logged('client-msg', e => e.ticket === t.id && e.at >= 585 && ['update', 'sched'].includes(e.kind)).length) good.push('Told Maria her 11:00 appointment had changed.');
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
      if (logged('client-msg', e => e.ticket === t.id && e.at >= 585 && ['update', 'sched'].includes(e.kind)).length) good.push('Let Lena know the appointment had moved.');
      else ded.push([10, 'Lena was expecting Ben at 13:30. Tell the client when their appointment moves.']);
    },
  },
  {
    id: '4501', at: 0, channel: 'email', client: 'hdg', contact: 'lpark', kb: 'PB-03',
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
    id: '4502', at: 5, channel: 'alert', client: 'bl', contact: null, from: 'RMM monitoring', kb: 'PB-06',
    title: 'BL-FS01: disk C: 92% used (threshold 90%)',
    body: 'ALERT  BL-FS01  Disk C:\\ usage 92.4% (threshold 90%)\nFree space: 11.8 GB of 160 GB. Growth last 7 days: +9 GB.',
    truth: { priority: 'P3', board: 'Infrastructure', skill: 'Servers', onsite: false, est: 30, dispatch: true, startBy: 990, closeAs: 'resolved',
      why: 'A server filling up is real, but it isn\'t down yet: P3 on Infrastructure, fixed today.' },
    fixNote: 'Cleared 38 GB of old IIS logs and a stale WSUS download cache on BL-FS01. C: is now at 61%. Added a log-rotation task.',
  },
  {
    id: '4503', at: 10, channel: 'alert', client: 'oak', contact: null, from: 'RMM monitoring', kb: 'PB-06',
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
    id: '4504', at: 15, channel: 'phone', client: 'kfl', contact: 'msantos', kb: 'PB-04',
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
    id: '4505', at: 30, channel: 'email', client: 'kfl', contact: 'jmorrow', kb: 'PB-05',
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
    id: '4506', at: 40, channel: 'phone', client: 'hdg', contact: 'areyes', sm: true, workAt: 10,
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
    id: '4507', at: 60, channel: 'email', client: 'oak', contact: 'lrivera', group: 'oak-mail', kb: 'PB-09',
    title: 'Email keeps asking me to sign in',
    body: 'Good morning, my email isn\'t loading. It keeps asking me to sign in and then says my account "doesn\'t have a license"? Lucia, Room 4',
    truth: { priority: 'P2', board: 'Help Desk', skill: 'M365', onsite: false, est: 60, dispatch: true, startBy: 660, closeAs: 'resolved',
      why: 'Several staff can\'t use email: P2. One ticket, one tech, M365 skills.' },
    fixNote: '14 staff lost their Microsoft 365 licences when the school\'s subscription payment failed overnight. Reassigned licences from the spare pool so everyone\'s back in, and asked Carl to update the card on file.',
  },
  {
    id: '4508', at: 63, channel: 'email', client: 'oak', contact: 'kosei', group: 'oak-mail', kb: 'PB-09',
    title: 'Outlook says "Need password"',
    body: 'Outlook has a yellow bar saying "Need password" and it won\'t take mine. Webmail says something about a licence. Kwame, Room 7',
    truth: { priority: 'P2', board: 'Help Desk', skill: 'M365', onsite: false, est: 60, dispatch: true, startBy: 660, closeAs: 'resolved',
      why: 'Same fault as the other Oakridge email tickets.' },
    fixNote: 'Same fix as the parent ticket: licence reassigned.',
  },
  {
    id: '4509', at: 66, channel: 'email', client: 'oak', contact: 'alindgren', group: 'oak-mail', kb: 'PB-09',
    title: 'Nobody in the east wing has email',
    body: 'Hi, none of us in the east wing can get into email this morning. Is something down? Anna',
    truth: { priority: 'P2', board: 'Help Desk', skill: 'M365', onsite: false, est: 60, dispatch: true, startBy: 660, closeAs: 'resolved',
      why: 'Same fault as the other Oakridge email tickets.' },
    fixNote: 'Same fix as the parent ticket: licence reassigned.',
  },
  {
    id: '4510', at: 85, channel: 'phone', client: 'pp', contact: 'jalvarez', am: { reply: 'Just spoke to Jess. She\'s bought another 10-hour block, so you\'re clear to schedule it.' }, kb: 'PB-07',
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
    id: '4511', at: 135, channel: 'alert', client: 'hdg', contact: 'lpark', from: 'RMM monitoring', noResponseSla: true, kb: 'PB-06',
    title: 'HDG-DC01: backup job "Nightly-Full" failed (2nd in a row)',
    body: 'ALERT  HDG-DC01  Backup job Nightly-Full FAILED\nError: Target \\\\HDG-NAS01\\Backups not enough free space.\nPrevious run: FAILED (same error).',
    truth: { priority: 'P2', board: 'Infrastructure', skill: 'Backup', onsite: false, est: 60, dispatch: true, startBy: 990, closeAs: 'resolved',
      why: 'Two failed backups in a row on the server holding patient data: P2, fixed today so tonight\'s backup runs.' },
    fixNote: 'The NAS filled up after a retention change kept 90 days instead of 30. Fixed retention, pruned old restore points and ran a manual backup: success.',
  },
  {
    id: '4512', at: 160, channel: 'email', client: 'bl', contact: 'bldesk', kb: 'PB-03',
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
    id: '4513', at: 180, channel: 'phone', client: 'kfl', contact: 'tkeller', sm: true, kb: 'PB-01',
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
    id: '4514', at: 210, channel: 'phone', client: 'oak', contact: 'cjensen', kb: 'PB-04',
    title: 'Hall projector dead, assembly at 1pm',
    body: 'Hi, Carl at Oakridge. The projector in the main hall won\'t turn on at all. The light just blinks orange. We have the whole-school assembly at 1pm and Helen is presenting from it. Can someone come out?',
    truth: { priority: 'P2', okPri: ['P3'], board: 'Field Services', skill: 'Hardware', onsite: true, est: 30, dispatch: true, startBy: 750, closeAs: 'resolved',
      why: 'Hardware in a hall needs a field visit. It must be before 1pm, but Oakridge allows no visits 11:30–12:30. That leaves a 12:30 start.' },
    fixNote: 'The projector lamp had failed. Swapped in the spare lamp from the office store room and tested it with the hall laptop. Ready for the assembly.',
  },
  {
    id: '4515', at: 240, channel: 'vendor', client: 'hdg', contact: 'lpark', from: 'Dell Technologies (RMA)', noResponseSla: true, kb: 'PB-08',
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
    id: '4516', at: 300, channel: 'email', client: 'kfl', contact: 'tkeller', from: 'Tom Keller <tom.keller@kellerfinch-law.co>', noResponseSla: true, kb: 'PB-05',
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
];
