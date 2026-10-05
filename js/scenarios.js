// Ticket scenarios. Each one is graded by inspecting the world state and the action log,
// not by a multiple-choice answer: the player has to actually fix the problem.
//
//   at            seconds into the shift the ticket arrives (practice mode: all at 0)
//   expect        { action: 'resolve' } or { action: 'escalate', team }
//   verifyUser    whose identity a verification code proves for this ticket
//   requireVerify sensitive account changes before verification are penalised
//   questions     scripted things the tech can ask; `follow` adds a later message and can set a flag;
//                 `bad: [points, reason]` marks a poorly worded question that costs points when asked
//   evaluate(w,t) returns { fixed, ded: [[points, reason]], good: [reason] }
//
// Shift 2 adds:
//   shift         which shift the ticket belongs to (default 1)
//   channel       'phone' rings as a live call first and becomes a voicemail if missed (default: portal)
//   voicemail     what the caller leaves on voicemail when the call is missed
//   group         tickets that are really one incident: escalate one, link the others to it
//   involves      other users this ticket legitimately touches (stops "no ticket asked" penalties)
//   thanksFrom    who sends the closing message, if not the requester
//   tick(w, t)    runs every second while the ticket is open, for things that change over time

const SHIFTS = {
  1: {
    name: 'Day One',
    blurb: 'Eleven tickets through the portal. Learn the tools, the process and the traps.',
    setup: null,
  },
  2: {
    name: 'Phones On',
    blurb: 'Nine harder tickets. Most arrive as live calls: answer them, juggle holds, and find the real root cause.',
    // Shift 2 starts from a healthy company (Day One's faults are fixed), then breaks new things.
    setup(w) {
      Object.assign(w.users.pnair, { locked: false, failedLogins: 0 });
      Object.assign(w.network.find(n => n.id === 'AP-CAFE-01'), { status: 'online', clients: 22 });
      w.servers.PRINT01.services.find(s => s.name === 'Spooler').status = 'Running';
      w.servers.PRINT01.queued = 0;
      w.devices['BL-DT-2304'].dnsMode = 'dhcp';
      w.devices['BL-DT-2210'].tz = 'Mountain Standard Time';
      const lt = w.devices['BL-LT-1033'];
      lt.apps = lt.apps.filter(a => !a.adware);
      lt.procs = lt.procs.filter(p => !['dealfinder.exe', 'qsupdate.exe'].includes(p));

      Object.assign(w.users.cnguyen, {
        locked: true, failedLogins: 10, lastLogin: 'Today 08:04',
        lockoutSource: 'ActiveSync: "Chris\'s iPhone" (Mail app)',
        history: ['Today 08:03 · Password changed by user (expiry reminder)', 'Today 09:12 · Account locked (source: ActiveSync)', 'Today 09:40 · Unlocked by service desk (J. Price)', 'Today 10:05 · Account locked (source: ActiveSync)'],
      });
      Object.assign(w.users.tnakamura, {
        history: ['Today 09:57 · MFA push approved (Microsoft Authenticator)', 'Today 09:59 · New MFA method registered: phone +44 7••• ••4471', 'Today 10:06 · Inbox rule created: "Move messages from \'bank\' to RSS Feeds"'],
        signins: [
          { when: 'Today 08:31', where: 'HQ, Brightline network', app: 'Outlook', result: 'Success' },
          { when: 'Today 09:51–09:57', where: 'Unknown, VPS hosting provider (NL)', app: 'Exchange Online', result: '14 × MFA denied' },
          { when: 'Today 09:57', where: 'Unknown, VPS hosting provider (NL)', app: 'Exchange Online', result: 'Success (MFA approved)' },
        ],
      });
      Object.assign(w.users.ndlamini, {
        groups: w.users.ndlamini.groups.filter(g => g !== 'VPN-Users'),
        history: ['Yesterday 18:30 · Removed from VPN-Users by svc-groupcleanup (stale-membership script)', 'Yesterday 16:12 · VPN sign-in from home (Success)'],
      });
      w.devices['BL-LT-1120'].online = false;

      const gl = w.devices['BL-LT-0660'];
      gl.ransom = true;
      gl.procs = gl.procs.concat(['svch0st.exe']);

      Object.assign(w.network.find(n => n.id === 'WAN-DEN-01'), { status: 'offline' });
      w.devices['BL-DT-2210'].online = false;
      w.devices['BL-DT-2212'].online = false;

      Object.assign(w.servers.FS01, {
        disk: 99,
        storage: [
          { id: 'temp', path: 'D:\\Temp', what: 'Installer leftovers and temp files', size: '9 GB', pct: 1, kind: 'temp' },
          { id: 'logs', path: 'D:\\Logs\\Archive', what: 'Rotated application logs older than 30 days', size: '61 GB', pct: 12, kind: 'logs' },
          { id: 'shadow', path: 'D:\\System Volume Information', what: 'Shadow copies (Previous Versions for every share)', size: '74 GB', pct: 15, kind: 'shadow' },
          { id: 'mkt', path: 'D:\\Shares\\Marketing', what: 'Marketing team files', size: '188 GB', pct: 37, kind: 'user' },
          { id: 'fin', path: 'D:\\Shares\\Finance', what: 'Finance team files', size: '121 GB', pct: 24, kind: 'user' },
          { id: 'hr', path: 'D:\\Shares\\HR', what: 'HR files (confidential)', size: '44 GB', pct: 9, kind: 'user' },
        ],
        events: ['Warning 2013: The D: disk is at or near capacity. You may need to delete some files.'],
      });
    },
  },
};

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
    id: 'INC-20117', at: 40, priority: 'Medium', requester: 'jmorales', device: 'BL-LT-1051', adminCheck: 'jmorales',
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
    thanks: 'Security here, we\'ve got it. Good call. The real Daniel is in the office on floor 4 and never sent this.', thanksFrom: 'Security team',
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

  // =========================================================================
  // Shift 2: Phones On
  // =========================================================================
  {
    id: 'INC-20201', shift: 2, at: 0, channel: 'phone', priority: 'High', requester: 'cnguyen', device: 'BL-LT-1201',
    title: 'Locked out for the third time today',
    body: 'This is the THIRD time today I\'ve been locked out! I changed my password this morning like the reminder told me to, and it keeps locking me out every twenty minutes. I\'ve got a client call at eleven.',
    voicemail: 'Hi, Chris Nguyen in Sales. I\'m locked out AGAIN, third time today. Please call me back on 4305, I have a client call at eleven.',
    categories: ['Account & Access'], expect: { action: 'resolve' },
    verifyUser: 'cnguyen', requireVerify: true, kb: 'KB-105', keywords: ['phone', 'iphone', 'activesync', 'mobile', 'mail app'],
    questions: [
      { id: 'when', q: 'When did the lockouts start?', a: 'Right after I changed my password at about eight this morning.' },
      { id: 'typing', q: 'You need to be more careful typing your password.', a: 'I am NOT typing it wrong! That\'s the whole point!', bad: [5, 'Blamed the caller. The failed sign-ins weren\'t coming from his typing at all.'] },
      { id: 'phone', q: 'Do you get work email on your phone? Has the new password been entered there?', a: 'Oh... the Mail app on my iPhone has been asking for a password since this morning and I kept dismissing it. Hang on... OK, I\'ve put the new password in. It\'s syncing now.', flag: 'phoneFixed' },
    ],
    thanks: 'I\'m in, and my phone\'s syncing. Thank you, finally!',
    stillBroken: 'I\'m locked out AGAIN. That\'s four times now!',
    tick(w, t) {
      const u = w.users.cnguyen;
      const last = logged('unlock', e => e.user === 'cnguyen').pop();
      if (u.locked || t.flags.phoneFixed || !last || t.flags['relock' + last.seq] || now() - last.at < 20) return;
      t.flags['relock' + last.seq] = true;
      Object.assign(u, { locked: true, failedLogins: 10 });
      u.history.push('Just now · Account locked (source: ActiveSync)');
      say(t, 'system', 'Account locked again. Source: ActiveSync ("Chris\'s iPhone").');
      toast('Chris Nguyen is locked out again.', 'bad');
    },
    evaluate(w, t) {
      const u = w.users.cnguyen, r = { fixed: !u.locked && !!t.flags.phoneFixed, ded: [], good: [] };
      if (touchedBeforeVerify('cnguyen')) r.ded.push([25, 'Changed Chris\'s account before verifying the caller.']);
      else if (t.flags.verified) r.good.push('Verified the caller before touching the account.');
      if (t.flags.phoneFixed) r.good.push('Found the root cause: the old password saved in the iPhone Mail app.');
      const relocks = Object.keys(t.flags).filter(k => k.startsWith('relock')).length;
      if (relocks) r.ded.push([Math.min(relocks, 2) * 10, `Unlocked without fixing the source, so the account locked again${relocks > 1 ? ` (${relocks}×)` : ''}.`]);
      if (logged('pwd-reset', e => e.user === 'cnguyen').length) r.ded.push([10, 'Reset the password again. That doesn\'t stop the phone failing, and now Chris has a password he didn\'t choose.']);
      return r;
    },
  },
  {
    id: 'INC-20202', shift: 2, at: 25, priority: 'Critical', requester: 'gfoster', device: 'BL-LT-0660',
    title: 'All my files end in .locked and there\'s a ransom note',
    body: 'Every file on my laptop has a weird name ending in .locked and there\'s a file on my desktop called HOW_TO_RECOVER_FILES.txt asking for bitcoin. I can\'t open anything. What do I do?? I\'m still at my desk.',
    categories: ['Security'], expect: { action: 'escalate', team: 'Security' }, kb: 'KB-404', keywords: ['isolat', 'ransom', 'security'],
    questions: [
      { id: 'source', q: 'Please don\'t switch the laptop off or unplug anything. Did you open an attachment or link today?', a: 'OK, I won\'t touch it. I opened a zip file from a supplier, an "overdue invoice", about twenty minutes ago.', flag: 'askedSource' },
      { id: 'share', q: 'Do you have any shared drives mapped on this laptop?', a: 'Yes, the Marketing drive on FS01. Oh no.', flag: 'askedShare' },
    ],
    thanks: 'Security here. The laptop is contained and we\'re taking it from here. Fast work.', thanksFrom: 'Security team',
    tick(w, t) {
      const d = w.devices['BL-LT-0660'];
      if (G.mode !== 'shift' || d.isolated || t.flags.spread || now() - t.arrived < 90) return;
      t.flags.spread = true;
      w.servers.FS01.events = (w.servers.FS01.events || []).concat(['EDR: mass file renames on \\\\FS01\\Marketing from BL-LT-0660']);
      say(t, 'system', 'EDR: encryption has spread from BL-LT-0660 to \\\\FS01\\Marketing.');
      toast('Ransomware is now encrypting the Marketing share on FS01.', 'bad');
    },
    evaluate(w, t) {
      const d = w.devices['BL-LT-0660'], r = { fixed: true, ded: [], good: [] };
      const iso = logged('isolate', e => e.device === d.id)[0];
      if (!d.isolated) r.ded.push([30, 'Never isolated the laptop. The ransomware could keep reaching every share it had mapped.']);
      else r.good.push(iso.at - t.arrived <= 90 ? 'Isolated the laptop within 90 seconds.' : 'Isolated the laptop from the network.');
      if (t.flags.spread) r.ded.push([15, 'Encryption reached \\\\FS01\\Marketing before the laptop was isolated.']);
      if (logged('restart', e => e.device === d.id).length) r.ded.push([20, 'Restarted the infected laptop. That wipes the evidence in memory and can let encryption finish on boot.']);
      if (logged('uninstall', e => e.device === d.id).length) r.ded.push([10, 'Tried to clean the device yourself. Leave ransomware to Security.']);
      if (t.flags.askedSource) r.good.push('Found out what she opened, which Security needs first.');
      return r;
    },
  },
  {
    id: 'INC-20203', shift: 2, at: 60, channel: 'phone', priority: 'High', requester: 'ndlamini', device: 'BL-LT-1120',
    title: 'VPN won\'t connect from home',
    body: 'Hi, it\'s Nandi from HR, I work from home. The VPN won\'t connect this morning. It worked perfectly yesterday, and I\'ve got candidate interviews all afternoon.',
    voicemail: 'Hi, Nandi Dlamini, HR. I can\'t get on the VPN from home and I have interviews this afternoon. Could you call me back? Thanks.',
    categories: ['Account & Access', 'Network'], expect: { action: 'resolve' },
    verifyUser: 'ndlamini', requireVerify: true, kb: 'KB-106', keywords: ['vpn'],
    questions: [
      { id: 'error', q: 'What exactly does the error message say?', a: '"Authentication failed: user is not authorized for this gateway (GP-HQ)."', flag: 'askedError' },
      { id: 'changed', q: 'Has anything changed since yesterday? New laptop, new password?', a: 'Nothing at all. Same laptop, same password, same Wi-Fi.' },
    ],
    thanks: 'Connected! Thank you so much, I\'m ready for my interviews.',
    stillBroken: 'Still says I\'m not authorized for the gateway.',
    evaluate(w, t) {
      const u = w.users.ndlamini, r = { fixed: u.groups.includes('VPN-Users'), ded: [], good: [] };
      const add = logged('group-add', e => e.user === 'ndlamini' && e.group === 'VPN-Users')[0];
      const v = logged('verified', e => e.user === 'ndlamini')[0];
      if (add && (!v || add.seq < v.seq)) r.ded.push([20, 'Restored network access for a caller you hadn\'t verified.']);
      else if (add) r.good.push('Verified Nandi before restoring her access.');
      const extra = logged('group-add', e => e.user === 'ndlamini' && e.group !== 'VPN-Users');
      if (extra.length) r.ded.push([15, `Added ${[...new Set(extra.map(e => e.group))].join(', ')}. She only lost VPN-Users.`]);
      if (t.flags.askedError) r.good.push('Asked for the exact error message. It pointed straight at group membership.');
      return r;
    },
  },
  {
    id: 'INC-20204', shift: 2, at: 105, channel: 'phone', priority: 'Critical', requester: 'tnakamura', device: 'BL-LT-1202',
    title: '"IT" called and asked me to approve a sign-in',
    body: 'Something weird happened. I got loads of "Approve sign-in?" pop-ups on my phone this morning. Then a man rang, said he was from IT fixing my mailbox, and asked me to press Approve, so I did. Now I can see emails in my Sent folder to our bank that I never wrote.',
    voicemail: 'Hi, Tara in Payroll. Something strange: someone from IT asked me to approve a sign-in and now there are emails to our bank I didn\'t send. Please call me back urgently.',
    categories: ['Security'], expect: { action: 'escalate', team: 'Security' },
    verifyUser: 'tnakamura', requireVerify: true, kb: 'KB-403', keywords: ['mfa', 'session', 'reset', 'security'],
    questions: [
      { id: 'caller', q: 'What number did the "IT" caller ring from, and what name did he give?', a: 'A mobile number, not our office line. He said he was "Kevin from IT".', flag: 'askedCaller' },
      { id: 'pwd', q: 'Did you give him your password or any codes?', a: 'No, he seemed to already know my password. I just pressed Approve.', flag: 'askedPwd' },
    ],
    thanks: 'Security here. We\'ve pulled the bank emails and blocked the payment. Good containment.', thanksFrom: 'Security team',
    evaluate(w, t) {
      const r = { fixed: true, ded: [], good: [] };
      if (touchedBeforeVerify('tnakamura')) r.ded.push([15, 'Changed credentials before verifying the caller.']);
      const reset = logged('pwd-reset', e => e.user === 'tnakamura');
      if (!reset.length) r.ded.push([20, 'The attacker knows her password. Reset it.']);
      else if (reset.some(e => !e.mustChange)) r.ded.push([5, 'Reset without "must change at next sign-in".']);
      if (!logged('revoke', e => e.user === 'tnakamura').length) r.ded.push([15, 'The attacker is still signed in. Sign out all sessions.']);
      if (!logged('mfa-reset', e => e.user === 'tnakamura').length) r.ded.push([15, 'The attacker registered his own phone for MFA. Until MFA is reset he can approve his own sign-ins.']);
      else r.good.push('Reset MFA, removing the attacker\'s phone.');
      if (t.flags.askedCaller) r.good.push('Got the fake caller\'s details for Security.');
      return r;
    },
  },
  {
    id: 'INC-20205', shift: 2, at: 150, channel: 'phone', priority: 'High', requester: 'sortiz', device: 'BL-DT-2210', group: 'den-wan',
    title: 'Nothing works at the Denver office',
    body: 'Hi, Samuel in Denver. Nothing is working here: email, the shared drives, the intranet, even the internet. It\'s not just me.',
    voicemail: 'Samuel Ortiz in Denver. Our whole network is down: no email, no files, nothing. Please call back.',
    categories: ['Network'], expect: { action: 'escalate', team: 'Network Engineering' }, kb: 'KB-204', keywords: ['wan', 'circuit', 'carrier', 'denver', 'outage', 'line test'],
    questions: [
      { id: 'scope', q: 'Is it everyone in the Denver office, or just you?', a: 'Everyone. All fourteen of us.', flag: 'askedScope' },
      { id: 'lights', q: 'Can you see the lights on the network box in the comms cupboard?', a: 'The box labelled Lumenline has a red light marked LOS. Everything else looks green.', flag: 'askedLights' },
    ],
    thanks: 'Thanks. Network Engineering just called to say the carrier is on it. We\'ll sit tight.',
    evaluate: denverOutage,
  },
  {
    id: 'INC-20206', shift: 2, at: 162, channel: 'phone', priority: 'High', requester: 'mreyes', device: 'BL-DT-2212', group: 'den-wan',
    title: 'Denver office network down',
    body: 'Hi, Maya, office manager in Denver. Our network\'s completely down: no email, no files, and the visitor sign-in tablet won\'t load either.',
    voicemail: 'Maya Reyes, Denver office. Our network is completely down. Can someone call me back?',
    categories: ['Network'], expect: { action: 'escalate', team: 'Network Engineering' }, kb: 'KB-204', keywords: ['wan', 'circuit', 'carrier', 'denver', 'outage', 'duplicate', 'link'],
    questions: [
      { id: 'scope', q: 'Is anyone else in the office affected?', a: 'Everyone. Samuel said he already called you.', flag: 'askedScope' },
    ],
    thanks: 'Thanks for letting me know it\'s already being worked on.',
    evaluate: denverOutage,
  },
  {
    id: 'INC-20207', shift: 2, at: 200, priority: 'High', requester: 'hkowalski',
    title: '"Not enough space" on the Marketing drive',
    body: 'I can\'t save anything to the Marketing drive. It says "There is not enough space on \\\\FS01\\Marketing". Grace and the others get the same error. We have a campaign going out at 2.',
    categories: ['Server & Storage'], expect: { action: 'resolve' }, kb: 'KB-205', keywords: ['log', 'temp', 'space', 'disk'],
    questions: [
      { id: 'others', q: 'Is it only the Marketing drive, or other shares too?', a: 'I just checked: Finance can\'t save either, Tom says.', flag: 'askedScope' },
    ],
    thanks: 'Saving works again. Campaign files are up. Thanks!',
    stillBroken: 'Still "not enough space" when I save.',
    evaluate(w, t) {
      const s = w.servers.FS01, r = { fixed: s.disk < 95, ded: [], good: [] };
      const del = logged('storage-delete', e => e.host === 'FS01');
      del.filter(e => e.kind === 'user').forEach(e => r.ded.push([40, `Deleted ${e.path}. That was a team's files.`]));
      if (del.some(e => e.kind === 'shadow')) r.ded.push([25, 'Deleted the shadow copies. Every user just lost Previous Versions, and your fastest restore point is gone.']);
      if (del.some(e => e.kind === 'logs')) r.good.push('Cleared the archived logs, exactly what the runbook allows.');
      return r;
    },
  },
  {
    id: 'INC-20208', shift: 2, at: 240, channel: 'phone', priority: 'Medium', requester: 'rpatel', device: 'BL-LT-1033', adminCheck: 'rpatel',
    title: 'Needs admin rights NOW for a client demo',
    body: 'I need admin rights on my laptop RIGHT NOW. I\'ve got a demo with Halvorsen Freight in ten minutes and their meeting software won\'t install because it wants an administrator. This is ridiculous, I\'m going to lose this deal!',
    voicemail: 'Ravi Patel. I need admin rights on my laptop immediately, I have a client demo in ten minutes. Call me back NOW.',
    categories: ['Software', 'Account & Access'], expect: { action: 'resolve' }, kb: 'KB-108', keywords: ['admin', 'browser', 'web'],
    questions: [
      { id: 'calm', q: 'Calm down. You know the rules: no admin rights.', a: 'Don\'t tell me to calm down! Do you know what this deal is worth?', bad: [10, 'Told an upset caller to calm down. Acknowledge the problem first; it gets you to the fix faster.'] },
      { id: 'empathy', q: 'I hear you, a demo in ten minutes is stressful. Let\'s get you into that meeting. What software is it?', a: 'It\'s Webex. The installer says it needs an administrator to continue.', flag: 'empathy' },
      { id: 'browser', q: 'Webex can be joined from the browser without installing anything. Click "Join from your browser" on the invite.', a: '...Oh. That works. OK, I\'m in the lobby. Thanks.', flag: 'alternative' },
      { id: 'request', q: 'If you need it installed permanently, I can raise a software request so it gets packaged for everyone.', a: 'Yes please, a few clients use Webex.', flag: 'request' },
    ],
    thanks: 'Demo went fine. Sorry for shouting earlier.',
    evaluate(w, t) {
      const r = { fixed: true, ded: [], good: [] };
      const adm = logged('group-add', e => e.user === 'rpatel' && ADMIN_GROUPS.includes(e.group));
      if (adm.length) r.ded.push([40, `Gave Ravi ${[...new Set(adm.map(e => e.group))].join(' and ')}. Admin rights let malware switch off security tools.`]);
      if (t.flags.alternative) r.good.push('Got him into the demo with the browser join. That was the real need.');
      else r.ded.push([15, 'Ravi still couldn\'t join his demo. Offer the browser join.']);
      if (t.flags.empathy) r.good.push('Acknowledged the pressure before problem-solving.');
      if (t.flags.request) r.good.push('Offered a proper software request for the long term.');
      return r;
    },
  },
  {
    id: 'INC-20209', shift: 2, at: 290, channel: 'phone', priority: 'Medium', requester: 'jmorales', involves: ['pnair'],
    title: 'Reset a colleague\'s password so I can read her email',
    body: 'Hi, Jordan in Finance. Priya\'s off sick today and there\'s an invoice in her inbox we have to pay before three. Tom said to just call you and get her password reset so I can log in as her. Can you give me a temporary one?',
    voicemail: 'Jordan Morales, Finance. I need Priya Nair\'s password reset so I can get into her email, she\'s off sick. Call me back please.',
    categories: ['Account & Access'], expect: { action: 'resolve' }, kb: 'KB-107', keywords: ['declin', 'delegat', 'manager', 'approv', 'refus'],
    questions: [
      { id: 'policy', q: 'I can\'t reset someone else\'s password or let you sign in as her. Her manager can request delegated access to her mailbox, approved by HR.', a: 'Fair enough, I\'ll ask Tom to put the request in.', flag: 'explained' },
      { id: 'other', q: 'Which invoice is it? Is there another copy, like the accounts mailbox or the supplier?', a: 'It\'s from Atlas Packaging. Actually... they always CC accounts@. Let me look. Yes, it\'s there! Never mind then.', flag: 'workaround' },
    ],
    thanks: 'Found it in the accounts mailbox. All paid, thanks.',
    evaluate(w, t) {
      const r = { fixed: true, ded: [], good: [] };
      if (G.log.some(e => e.user === 'pnair' && ['pwd-reset', 'unlock', 'mfa-reset'].includes(e.type)))
        r.ded.push([40, 'Changed Priya\'s credentials for a colleague. Now someone else can act as her, and the logs will say it was her.']);
      if (t.flags.workaround) r.good.push('Found the invoice another way: it was in the accounts mailbox.');
      if (t.flags.explained) r.good.push('Explained the delegated-access process instead of just saying no.');
      else r.ded.push([5, 'Tell Jordan what to do instead: delegated access via the manager and HR.']);
      return r;
    },
  },
];

// Both Denver callers are the same outage. The engine checks that one ticket is escalated
// and the other is linked to it; this adds the investigation feedback.
function denverOutage(w, t) {
  const r = { fixed: true, ded: [], good: [] };
  if (logged('line-test', e => e.target === 'WAN-DEN-01').length) r.good.push('Ran a line test: loss of signal from the carrier.');
  if (t.flags.askedScope) r.good.push('Confirmed the whole office was affected.');
  return r;
}
