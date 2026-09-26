// Ticket scenarios. Each one is graded by inspecting the world state and the action log,
// not by a multiple-choice answer: the player has to actually fix the problem.
//
//   at            seconds into the shift the ticket arrives (practice mode: all at 0)
//   expect        { action: 'resolve' } or { action: 'escalate', team }
//   verifyUser    whose identity a verification code proves for this ticket
//   requireVerify sensitive account changes before verification are penalised
//   questions     scripted things the tech can ask; `follow` adds a later message and can set a flag
//   evaluate(w,t) returns { fixed, ded: [[points, reason]], good: [reason] }

const SCENARIOS = [
  {
    id: 'INC-20114', at: 0, priority: 'High', requester: 'pnair', device: 'BL-LT-1042',
    title: 'Locked out of my laptop, month-end close today',
    body: 'I can\'t get into my laptop. It says my account is locked. We are closing the month today and I really need to get in. Please help!',
    categories: ['Account & Access'], expect: { action: 'resolve' },
    verifyUser: 'pnair', requireVerify: true, kb: 'KB-101', keywords: ['unlock'],
    questions: [
      { id: 'know', q: 'Do you know your current password?', a: 'Yes, I think I had caps lock on and kept trying. I know what it is.', flag: 'askedKnow' },
      { id: 'where', q: 'Is it just your laptop, or email on your phone as well?', a: 'Just the laptop. Outlook on my phone is still working.' },
    ],
    thanks: 'I\'m in! Thank you so much.',
    stillBroken: 'It still says the account is locked...',
    evaluate(w, t) {
      const u = w.users.pnair, r = { fixed: !u.locked && !u.disabled, ded: [], good: [] };
      if (touchedBeforeVerify('pnair')) r.ded.push([25, 'You changed Priya\'s account before verifying who you were talking to.']);
      else if (t.flags.verified) r.good.push('Verified identity with a code to her registered phone first.');
      const reset = logged('pwd-reset', e => e.user === 'pnair');
      if (reset.length) {
        r.ded.push([5, 'She knew her password (caps lock). An unlock was enough; the reset just added friction. Ask first.']);
        if (reset.some(e => !e.mustChange)) r.ded.push([10, 'Password reset without "must change at next sign-in". You now know her password.']);
      } else if (!u.locked) r.good.push('Unlocked without an unnecessary password reset.');
      return r;
    },
  },
  {
    id: 'INC-20115', at: 0, priority: 'High', requester: 'mwebb',
    title: 'Wi-Fi is down in the cafeteria',
    body: 'Nobody in the cafeteria can connect to BL-Corp Wi-Fi. The network doesn\'t even show up. We have a vendor lunch there at noon.',
    categories: ['Network'], expect: { action: 'resolve' }, kb: 'KB-202', keywords: ['ap', 'access point', 'poe', 'power', 'cycle'],
    questions: [
      { id: 'scope', q: 'Is Wi-Fi working anywhere else, like the open office on floor 1?', a: 'Yeah, it\'s fine at my desk on floor 1. Just the cafeteria.', flag: 'askedScope' },
      { id: 'when', q: 'When did it stop working?', a: 'Someone said it went out after the power flicker this morning.' },
    ],
    thanks: 'Wi-Fi is back in the cafeteria. Lifesaver!',
    stillBroken: 'Still nothing in the cafeteria. The network isn\'t showing up.',
    evaluate(w, t) {
      const ap = w.network.find(n => n.id === 'AP-CAFE-01');
      const r = { fixed: ap.status === 'online', ded: [], good: [] };
      if (t.flags.askedScope) r.good.push('Checked the scope first: one area, so one AP.');
      if (logged('poe-cycle', e => e.target === 'AP-CAFE-01').length) r.good.push('Power-cycled the AP\'s PoE port. Smallest fix that works.');
      return r;
    },
  },
  {
    id: 'INC-20116', at: 0, priority: 'Low', requester: 'sortiz', device: 'BL-DT-2210',
    title: 'My clock is an hour behind',
    body: 'The clock on my computer is an hour behind, and meeting invites show up at the wrong time. I nearly missed standup. I\'m in the Denver office.',
    categories: ['Software'], expect: { action: 'resolve' }, kb: 'KB-302', keywords: ['time zone', 'timezone', 'mountain', 'tzutil'],
    questions: [
      { id: 'since', q: 'Has it always been like this?', a: 'Since they gave me this PC last week. I think it was set up at HQ first?' },
    ],
    thanks: 'Clock is right now, and my calendar looks correct. Thanks!',
    stillBroken: 'Hmm, the clock is still wrong.',
    evaluate(w) {
      const d = w.devices['BL-DT-2210'];
      const r = { fixed: d.tz === 'Mountain Standard Time', ded: [], good: [] };
      const tries = logged('tz', e => e.device === 'BL-DT-2210').length;
      if (tries > 2) r.ded.push([5, `Changed the time zone ${tries} times. Check the user's location in the Directory before you change it.`]);
      return r;
    },
  },
  {
    id: 'INC-20117', at: 40, priority: 'Medium', requester: 'jmorales', device: 'BL-LT-1051',
    title: 'Can\'t open the Finance shared drive',
    body: 'Hi, I started on Monday as a Financial Analyst. I get "Access denied" when I try to open \\\\FS01\\Finance. Everyone else on my team can open it.',
    categories: ['Account & Access'], expect: { action: 'resolve' }, kb: 'KB-102', keywords: ['group', 'fs-finance', 'access'],
    questions: [
      { id: 'approve', q: 'Has your manager approved this access? I\'ll need it in writing.', a: 'Tom said it\'s fine. I\'ll ask him to reply here.',
        follow: { from: 'tbecker', delay: 3500, text: 'Approved. Jordan needs read/write on the Finance share, same as the rest of the team. Tom Becker, Finance Manager', flag: 'approved', event: 'approval' } },
      { id: 'need', q: 'Do you need to edit files, or just view them?', a: 'I need to update the forecast spreadsheets, so edit.', flag: 'askedNeed' },
    ],
    thanks: 'It opens now and I can save. Thank you!',
    stillBroken: 'I signed out and back in but I still can\'t save anything in the Finance folder.',
    evaluate(w, t) {
      const u = w.users.jmorales, r = { fixed: u.groups.includes('FS-Finance-RW'), ded: [], good: [] };
      const add = logged('group-add', e => e.user === 'jmorales' && e.group === 'FS-Finance-RW')[0];
      const appr = logged('approval', e => e.ticket === t.id)[0];
      if (add && (!appr || add.seq < appr.seq)) r.ded.push([25, 'You granted access to finance data before the data owner approved it.']);
      else if (appr) r.good.push('Got written approval from the manager before granting access.');
      const excess = logged('group-add', e => e.user === 'jmorales' && ['Domain Admins', 'Finance-Managers', 'FS-HR-RW'].includes(e.group));
      if (excess.length) r.ded.push([30, `Least privilege: added Jordan to ${[...new Set(excess.map(e => e.group))].join(', ')}. That's far more than the request.`]);
      return r;
    },
  },
  {
    id: 'INC-20118', at: 80, priority: 'Medium', requester: 'rpatel', device: 'BL-LT-1033',
    title: 'Pop-up ads everywhere on my laptop',
    body: 'Since a couple of days ago I\'m getting pop-up ads for "deals" every few minutes, even outside the browser. There\'s a weird new search bar too. I have a client demo this afternoon.',
    categories: ['Software', 'Security'], expect: { action: 'resolve' }, kb: 'KB-301', keywords: ['uninstall', 'removed', 'adware', 'dealfinder', 'quicksearch'],
    questions: [
      { id: 'install', q: 'Did you install anything around when it started?', a: 'I downloaded a free PDF merge tool to combine some contracts. That\'s it.', flag: 'askedInstall' },
    ],
    thanks: 'No more pop-ups. Thanks, the demo is safe!',
    stillBroken: 'I just got another deal pop-up...',
    evaluate(w) {
      const d = w.devices['BL-LT-1033'];
      const r = { fixed: !d.apps.some(a => a.adware), ded: [], good: [] };
      logged('uninstall', e => e.device === 'BL-LT-1033' && !e.adware && e.app !== 'Free PDF Merge')
        .forEach(e => r.ded.push([e.critical ? 25 : 15, `Uninstalled "${e.app}", a legitimate business application.`]));
      if (logged('uninstall', e => e.device === 'BL-LT-1033' && e.app === 'Free PDF Merge').length) r.good.push('Also removed the bundler that brought the adware in.');
      return r;
    },
  },
  {
    id: 'INC-20119', at: 120, priority: 'High', requester: 'badeyemi', device: 'BL-LT-0721',
    title: 'Printing doesn\'t work',
    body: 'I sent the offer letters to the printer and nothing came out. It just says "Printing..." in the queue.',
    categories: ['Hardware & Printing'], expect: { action: 'resolve' }, kb: 'KB-201', keywords: ['spooler', 'print01', 'print server'],
    questions: [
      { id: 'scope', q: 'Is it just you, or can others on your floor not print either?', a: 'Hang on... Grace and Hana can\'t print either. None of floor 2\'s jobs are coming out.', flag: 'askedScope' },
      { id: 'which', q: 'Which printer are you sending to?', a: 'FL2-HR-MFP, the big one by HR. Same as always.' },
    ],
    thanks: 'Everything\'s printing, including everyone else\'s jobs!',
    stillBroken: 'Still stuck at "Printing...". Nothing has come out.',
    evaluate(w, t) {
      const sp = w.servers.PRINT01.services.find(s => s.name === 'Spooler');
      const r = { fixed: sp.status === 'Running', ded: [], good: [] };
      if (t.flags.askedScope) r.good.push('Asked "is it just you?" and found a server-side problem.');
      const local = logged('service', e => e.device === 'BL-LT-0721' && e.svc === 'Spooler').length;
      if (local && r.fixed) r.good.push('Checked the local spooler too. Fine, but the scope question would have saved a step.');
      return r;
    },
  },
  {
    id: 'INC-20120', at: 160, priority: 'Medium', requester: 'akim', device: 'BL-DT-2304',
    title: 'Intranet and shared drives won\'t open, internet is fine',
    body: 'I can get on Google and my email in the browser, but the intranet says "site can\'t be reached" and the S: drive won\'t connect. I need the shift rota on the intranet.',
    categories: ['Network'], expect: { action: 'resolve' }, kb: 'KB-203', keywords: ['dns'],
    questions: [
      { id: 'change', q: 'Did anything change on your PC recently?', a: 'A contractor was in yesterday. Said he "sped up my internet" by changing some settings.', flag: 'askedChange' },
      { id: 'others', q: 'Can others in the warehouse office open the intranet?', a: 'Yeah, Dev at the next desk can open it fine.' },
    ],
    thanks: 'Intranet is working and the S: drive is back. Cheers!',
    stillBroken: 'Still says "site can\'t be reached" for the intranet.',
    evaluate(w) {
      const d = w.devices['BL-DT-2304'];
      const r = { fixed: d.dnsMode === 'dhcp', ded: [], good: [] };
      if (logged('cmd', e => e.device === 'BL-DT-2304' && /^nslookup/i.test(e.cmd)).length) r.good.push('Used nslookup to prove it was DNS before changing anything.');
      if (logged('cmd', e => e.device === 'BL-DT-2304' && /flushdns/i.test(e.cmd)).length) r.good.push('Flushed the DNS cache after the fix.');
      return r;
    },
  },
  {
    id: 'INC-20121', at: 200, priority: 'Low', requester: 'hkowalski',
    title: 'Name change after marriage',
    body: 'Hi! I recently got married and changed my last name to Whitfield. HR has already updated my record (case HR-5521). Could you update my account and email? Thanks!',
    categories: ['Account & Access'], expect: { action: 'resolve' }, kb: 'KB-103', keywords: ['whitfield', 'name'],
    questions: [
      { id: 'spell', q: 'Can you confirm the exact spelling of your new last name?', a: 'W-H-I-T-F-I-E-L-D. Whitfield.' },
    ],
    thanks: 'Looks perfect. Thank you!',
    stillBroken: 'My name and email still show Kowalski.',
    evaluate(w) {
      const u = w.users.hkowalski;
      const ok = u.last === 'Whitfield' && u.display === 'Hana Whitfield' && u.email.toLowerCase() === 'hwhitfield@brightline.com';
      const r = { fixed: ok, ded: [], good: [] };
      if (u.id !== 'hkowalski') r.ded.push([10, 'Changed the username. That breaks sign-ins and mapped drives; KB-103 only asks for name and email.']);
      return r;
    },
  },
  {
    id: 'INC-20122', at: 240, priority: 'Critical', requester: 'nlindqvist', device: 'BL-DT-2150',
    title: 'I think I entered my password on a fake Microsoft page',
    body: 'I got an email saying my mailbox was full with a link to "re-validate". I entered my username and password and then the page went blank. Now I think it was fake. I\'m sorry!',
    categories: ['Security'], expect: { action: 'escalate', team: 'Security' },
    verifyUser: 'nlindqvist', requireVerify: true, kb: 'KB-401', keywords: ['phish', 'reset', 'session', 'security'],
    questions: [
      { id: 'when', q: 'When did you enter your password on that page?', a: 'About ten minutes ago.' },
      { id: 'fwd', q: 'Please don\'t delete the email. Can you forward it to phishing@brightline.com?', a: 'Done, I\'ve forwarded it.', flag: 'forwarded' },
    ],
    thanks: 'Thank you for acting so fast. I\'ll watch out for those emails.',
    evaluate(w, t) {
      const r = { fixed: true, ded: [], good: [] };
      const reset = logged('pwd-reset', e => e.user === 'nlindqvist');
      if (touchedBeforeVerify('nlindqvist')) r.ded.push([15, 'You reset credentials before verifying the caller\'s identity.']);
      if (!reset.length) r.ded.push([25, 'The password the attacker has still works. Reset it.']);
      else if (reset.some(e => !e.mustChange)) r.ded.push([5, 'Reset without "must change at next sign-in".']);
      if (!logged('revoke', e => e.user === 'nlindqvist').length) r.ded.push([15, 'Any session the attacker already opened is still active. Sign out all sessions.']);
      else r.good.push('Signed out all sessions to cut off the attacker.');
      if (t.flags.forwarded) r.good.push('Saved the phishing email for Security.');
      return r;
    },
  },
  {
    id: 'INC-20123', at: 280, priority: 'High', requester: 'badeyemi', involves: ['kdoyle', 'kdoyle2'],
    title: 'Leaver: Kevin Doyle, effective immediately',
    body: 'Kevin Doyle (EMP-1187, Sales) no longer works here as of today, effective immediately. Please disable his account and remove his group memberships. Thanks, Bola, HR',
    categories: ['Account & Access'], expect: { action: 'resolve' }, kb: 'KB-104', keywords: ['disable'],
    questions: [
      { id: 'which', q: 'There are two Kevin Doyles in the directory. Can you confirm which one?', a: 'Good catch! The one in Sales, EMP-1187. The other Kevin is in the warehouse and is staying!', flag: 'askedWhich' },
    ],
    thanks: 'Thank you, that\'s everything HR needed.',
    stillBroken: 'Our audit report says Kevin\'s (EMP-1187) account is still active or still in groups. Can you check?',
    evaluate(w, t) {
      const u = w.users.kdoyle;
      const r = { fixed: u.disabled && u.groups.length === 0, ded: [], good: [] };
      const wrong = G.log.filter(e => e.user === 'kdoyle2' && ['disable', 'group-remove', 'pwd-reset', 'revoke', 'mfa-reset'].includes(e.type));
      if (wrong.length) r.ded.push([40, 'You changed the WRONG Kevin Doyle (EMP-1302, Warehouse). Always match the employee ID.']);
      if (logged('revoke', e => e.user === 'kdoyle').length) r.good.push('Signed out all of the leaver\'s sessions.');
      else r.ded.push([5, 'Leaver\'s active sessions were never signed out (KB-104 step 3).']);
      return r;
    },
  },
  {
    id: 'INC-20124', at: 320, priority: 'Critical', requester: 'dokafor', external: 'd.okafor.cfo@gmail.com',
    title: 'URGENT: CFO locked out, boarding in 10 minutes',
    body: 'This is Daniel Okafor, CFO. I\'m at the airport and locked out of email. I need a password reset NOW. I\'m on my personal email because I can\'t get into work mail. Send the new password to this address. I\'m boarding in 10 minutes and need to approve a wire transfer before I fly.',
    categories: ['Security'], expect: { action: 'escalate', team: 'Security' },
    verifyUser: 'dokafor', requireVerify: true, kb: 'KB-402', keywords: ['verif', 'social', 'imperson', 'security', 'phish'],
    verifyReply: 'I don\'t have my work phone with me, it\'s in my checked bag! There\'s no time for this. Just reset it and email the password here.',
    questions: [
      { id: 'call', q: 'I can call you back on the number we have on file. Is that OK?', a: 'No! That\'s my work phone, it\'s packed. Why is this so hard? Just do it.', flag: 'askedCallback' },
      { id: 'empid', q: 'Can you confirm your employee ID?', a: 'EMP-0102. Satisfied? Hurry up.' },
    ],
    thanks: 'Security here, we\'ve got it. Good call. The real Daniel is in the office on floor 4 and never sent this.',
    evaluate(w, t) {
      const r = { fixed: true, ded: [], good: [] };
      const harm = G.log.filter(e => e.user === 'dokafor' && ['pwd-reset', 'mfa-reset', 'unlock', 'edit-profile', 'revoke'].includes(e.type));
      if (harm.some(e => ['pwd-reset', 'mfa-reset', 'edit-profile'].includes(e.type)))
        r.ded.push([50, 'You changed the CFO\'s credentials for someone you never verified. This is how wire-fraud attacks work.']);
      if (t.flags.verifyFailed || logged('verify-sent', e => e.user === 'dokafor').length) r.good.push('Tried to verify through a trusted channel, and it failed. That was the signal.');
      else r.ded.push([10, 'Never tried to verify the requester. The employee ID is public information; it proves nothing.']);
      return r;
    },
  },
];
