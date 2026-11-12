// Interview prep for the Help Desk mode: common Tier 1 service desk interview questions, each tied
// to the knowledge base article and the ticket that shows the answer in the sim. It reuses
// prepCovered and the support assessment (ASSESS) from js/dispatch/interview.js, which loads first.
//
//   points    what a strong answer covers. Each point is ticked when the player's answer matches
//             one of its patterns (case-insensitive). It's a nudge, not a grade: wording varies.
//   model     one good answer, in the first person, built from the sim's own knowledge base
//   practise  { shift, ticket }: the shift and ticket (SCENARIOS in scenarios.js) that practises it
//   kb        knowledge base article ids (KB in data.js)
//
// Answers are saved in the same browser store as the coordinator prep, keyed 'hd-<id>'.

const HD_PREP = [
  {
    id: 'reset', q: 'A caller says they\'re locked out and need a password reset. What do you do before you touch the account?',
    kb: ['KB-101'], practise: { shift: 1, ticket: 'INC-20114' },
    points: [
      { label: 'Verify who they are before any change', re: [/verif/, /identity/, /prove/] },
      { label: 'Use something an attacker can\'t look up: a code to their registered phone', re: [/code/, /registered/, /mfa/, /known number/, /call (them )?back/] },
      { label: 'Not job title, manager or employee ID', re: [/employee id/, /job title/, /manager/, /look up/, /public/, /linkedin/] },
      { label: 'Unlock only if they know the password', re: [/unlock/, /know (their|the|it)/, /caps lock/] },
      { label: 'A reset forces a change at next sign-in', re: [/next sign-?in/, /next log-?in/, /change (it|their password)/, /temporary/] },
    ],
    model: 'Before I change anything I verify who they are. I send a code to the mobile number we already have registered for them and have them read it back, because job title, manager or employee ID are things an attacker can look up on LinkedIn. Then I ask if they know their password: most lockouts are caps lock or an old password saved on a phone, so if they know it I unlock only. If they don\'t, I reset it with "must change at next sign-in" ticked so I never know their real password.',
  },
  {
    id: 'phish', q: 'A user tells you they typed their password into a fake Microsoft page ten minutes ago. What are your first steps?',
    kb: ['KB-401', 'KB-403'], practise: { shift: 1, ticket: 'INC-20122' },
    points: [
      { label: 'Treat the account as compromised, and move fast', re: [/compromis/, /straight away/, /immediately/, /urgent/, /fast/, /quickly/] },
      { label: 'Verify the user first', re: [/verif/, /identity/] },
      { label: 'Reset the password', re: [/reset/, /new password/, /change (the|their) password/] },
      { label: 'Sign out all sessions so the attacker is kicked out', re: [/sign (them |it )?out/, /sessions/, /revoke/, /kick/] },
      { label: 'Escalate to Security with the details', re: [/secur/, /escalat/, /soc\b/] },
    ],
    model: 'I treat the account as compromised and move straight away, because ten minutes is plenty for an attacker. I verify the user, reset the password with a forced change at next sign-in, and sign out all sessions, since a reset alone doesn\'t end a session the attacker already has. Then I escalate to Security with the link, the time and anything they saw, and I leave the investigation to them rather than closing it myself.',
  },
  {
    id: 'exec', q: 'An urgent email from the CFO\'s personal Gmail asks you to reset his password and send it to that address. What do you do?',
    kb: ['KB-402'], practise: { shift: 1, ticket: 'INC-20124' },
    points: [
      { label: 'Urgency and rank are red flags, not reasons to skip checks', re: [/red flag/, /urgen/, /pressure/, /rank/, /social engineer/, /suspicious/] },
      { label: 'Verify him the same way as anyone else', re: [/verif/, /same (way|process|as anyone)/, /registered/] },
      { label: 'Never send a password to a personal address', re: [/personal/, /gmail/, /never send/, /won't send/, /not send/] },
      { label: 'If it can\'t be verified, change nothing and escalate to Security', re: [/secur/, /escalat/] },
      { label: 'Stay polite', re: [/polite/, /respectful/, /explain/, /apolog/, /calm/] },
    ],
    model: 'Urgency plus a senior title plus a personal address is the classic social engineering pattern, so I slow down. I verify him exactly the same way as anyone else, with a code to his registered phone, and I never send a password to a personal Gmail address however senior the sender is. If he can\'t be verified I change nothing on the account and escalate to Security. I stay polite and explain it\'s there to protect him: a real CFO would rather wait two minutes than have his account stolen.',
  },
  {
    id: 'printer', q: 'A user says printing doesn\'t work. How do you troubleshoot it?',
    kb: ['KB-201'], practise: { shift: 1, ticket: 'INC-20119' },
    points: [
      { label: 'Find out if it\'s one person or many', re: [/just (you|them|one)/, /one (user|person)/, /anyone else/, /others/, /many/, /whole floor/, /scope/] },
      { label: 'One user: check their PC, local spooler and stuck jobs', re: [/their (pc|laptop|machine)/, /local/, /stuck/, /queue/] },
      { label: 'Many users: check the print server', re: [/print server/, /print01/, /server/] },
      { label: 'Restart the spooler, not everything', re: [/spooler/, /restart the (right|one)/, /not (everything|the whole)/] },
      { label: 'Confirm it works with the user before closing', re: [/test page/, /confirm/, /check with/, /print something/, /before (i )?clos/] },
    ],
    model: 'My first question is whether it\'s just them or others too, because that tells me where the fault is. If it\'s one user, I look at their PC: stuck jobs in the queue, the local Print Spooler, the right printer selected. If a whole floor can\'t print, it\'s shared, so I check the print server, where a stopped Spooler stops everyone. I restart the one service that\'s broken rather than rebooting everything, then ask the user to print a test page to confirm before I close the ticket.',
  },
  {
    id: 'dns', q: 'A user can browse the internet but the intranet and shared drives won\'t open. Where do you start?',
    kb: ['KB-203'], practise: { shift: 1, ticket: 'INC-20120' },
    points: [
      { label: 'Suspect DNS: internal names only resolve on our DNS servers', re: [/dns/, /name resolution/, /resolv/] },
      { label: 'Test it: nslookup, ipconfig /all', re: [/nslookup/, /ipconfig/, /ping/] },
      { label: 'Look for hard-coded public DNS like 8.8.8.8', re: [/8\.8\.8\.8/, /public dns/, /hard-?coded/, /manual/, /google dns/] },
      { label: 'Set it back to automatic (DHCP) and flush the cache', re: [/automatic/, /dhcp/, /flushdns/, /flush/] },
      { label: 'Confirm the internal sites open', re: [/confirm/, /test again/, /check (it|the intranet)/, /works/, /opens?\b/] },
    ],
    model: 'Internet working but internal names failing is almost always DNS, because names like intranet and fs01 only resolve on our own DNS servers. I remote in and run nslookup intranet and ipconfig /all. If the adapter has public DNS such as 8.8.8.8 hard-coded, someone set it manually, so I set it back to obtain DNS automatically through DHCP, run ipconfig /flushdns, and confirm with the user that the intranet opens before closing.',
  },
  {
    id: 'access', q: 'Someone asks to be added to the Finance shared folder. What do you check before you do it?',
    kb: ['KB-102'], practise: { shift: 1, ticket: 'INC-20117' },
    points: [
      { label: 'Written approval from the data owner, recorded in the ticket', re: [/approv/, /data owner/, /manager/, /sign-?off/] },
      { label: 'Use the security group, not the individual account', re: [/group/, /not (the|an) individual/] },
      { label: 'Least access that does the job (read-only if that\'s enough)', re: [/least/, /read-?only/, /only what/, /minimum/] },
      { label: 'Never use admin groups to "make it work"', re: [/admin/, /never/, /shortcut/] },
      { label: 'They sign out and back in to pick it up', re: [/sign (out|back)/, /log (off|out|back)/, /lock and unlock/, /re-?log/] },
    ],
    model: 'I get written approval from the data owner, usually their manager, and put it in the ticket before anything changes. Then I add them to the matching security group rather than giving the individual account permissions, and I pick the least access that does the job, read-only if they only need to read. I never drop someone into an admin group to make it work faster. Finally I tell them to sign out and back in so the new membership applies.',
  },
  {
    id: 'leaver', q: 'HR asks you to disable a leaver, effective immediately. What steps do you follow?',
    kb: ['KB-104'], practise: { shift: 1, ticket: 'INC-20123' },
    points: [
      { label: 'Confirm it really came from HR', re: [/from hr/, /hr (sent|raised|confirm|request)/, /confirm (the request|with hr)/, /genuine/] },
      { label: 'Match the employee ID: names aren\'t unique', re: [/employee id/, /emp(loyee)? ?id/, /same name/, /two people/, /not unique/, /right (person|account)/] },
      { label: 'Disable, don\'t delete', re: [/disable/, /not delete/, /don't delete/, /retention/] },
      { label: 'Sign out all sessions', re: [/sessions/, /sign (them |it )?out/] },
      { label: 'Remove group memberships', re: [/group/, /membership/, /access/] },
    ],
    model: 'I confirm the request came from HR, then I match the employee ID, because names aren\'t unique and disabling the wrong Kevin is a very bad morning for someone. I disable the account rather than deleting it, since the mailbox and files are kept for retention. Then I sign out all sessions so nothing stays logged in, remove the group memberships, and note each step in the ticket.',
  },
  {
    id: 'upset', q: 'An upset caller demands admin rights right now so he can install software before a client demo. How do you handle it?',
    kb: ['KB-108'], practise: { shift: 2, ticket: 'INC-20208' },
    points: [
      { label: 'Acknowledge the pressure first (never "calm down")', re: [/acknowledg/, /stressful/, /understand/, /empath/, /listen/] },
      { label: 'Don\'t grant admin rights', re: [/don't (grant|give)/, /not (grant|give)/, /can't (grant|give)/, /won't (grant|give)/, /no admin/, /never (grant|give)/] },
      { label: 'Explain why briefly: malware and security tools', re: [/malware/, /secur/, /risk/, /why/] },
      { label: 'Solve the real need: join from the browser', re: [/browser/, /web (version|app)/, /real need/, /without install/, /no install/] },
      { label: 'Raise a software request for the permanent fix', re: [/software request/, /package/, /request/, /approved/] },
    ],
    model: 'I acknowledge it first: a demo in ten minutes is stressful, and I never tell anyone to calm down. I don\'t grant admin rights, and I explain briefly why: admin rights let malware switch off our security tools. Then I solve the real need, which is the demo, not the install. Meeting apps like Zoom or Teams can almost always be joined from the browser with nothing installed. If he needs the app for good, I raise a software request so it gets packaged and approved.',
  },
  {
    id: 'phones', q: 'You\'re working a critical ticket when the phone rings with a routine request. What do you do?',
    kb: ['KB-501'], practise: { shift: 2, ticket: 'INC-20201' },
    points: [
      { label: 'Answer before it goes to voicemail', re: [/answer/, /pick (it )?up/, /voicemail/] },
      { label: 'Take their name and the problem', re: [/name/, /details/, /log (it|a ticket)/, /what the problem/, /take down/] },
      { label: 'Offer a callback instead of a long hold', re: [/call (them |you )?back/, /callback/, /hold/] },
      { label: 'Give a time and keep the promise', re: [/within/, /minutes/, /promise/, /keep/, /on time/] },
      { label: 'Keep working the critical ticket first', re: [/critical/, /priorit/, /urgent/] },
    ],
    model: 'I answer it before it goes to voicemail, because a missed call becomes a callback and they\'ve already waited. I take their name and the problem, and since I\'m in the middle of something critical I offer to call back within five minutes rather than leaving them on hold, where people hang up. Then I finish the urgent work first and keep the promise: a broken callback costs more trust than the original wait.',
  },
  {
    id: 'outage', q: 'Five people from the same office call in a few minutes: nothing works. How do you handle it?',
    kb: ['KB-204'], practise: { shift: 2, ticket: 'INC-20205' },
    points: [
      { label: 'Confirm the scope: one person or the whole site', re: [/scope/, /whole (office|site)/, /everyone/, /one person/, /how many/] },
      { label: 'Check the site link before touching anything', re: [/wan/, /circuit/, /line test/, /link/, /monitor/] },
      { label: 'Escalate once, to the team that owns it', re: [/escalat/, /network (engineering|team)/, /carrier/] },
      { label: 'Link the other tickets to the first one', re: [/link/, /duplicate/, /parent/, /one (ticket|incident)/] },
      { label: 'Don\'t restart core equipment to "try something"', re: [/not restart/, /don't restart/, /never restart/, /core/, /try something/] },
      { label: 'Keep callers updated', re: [/update/, /let (them|callers) know/, /inform/, /status/] },
    ],
    model: 'First I confirm the scope: is it one person or the whole office? Everyone at one site is a site problem, so I check that site\'s WAN circuit and run a line test before I touch anything. Loss of signal means a carrier fault, so I escalate once to Network Engineering, who open the case with the carrier. Every other caller about it gets their ticket linked to the first one as a duplicate, not a second escalation. I never restart core routers to try something, and I keep callers updated so they aren\'t all ringing again.',
  },
  {
    id: 'ransom', q: 'A user calls: all her files end in .locked and there\'s a ransom note on the screen. What are your first five minutes?',
    kb: ['KB-404'], practise: { shift: 2, ticket: 'INC-20202' },
    points: [
      { label: 'Tell her not to switch it off or open anything', re: [/not to (switch|turn|power|unplug|open)/, /don't (switch|turn|power|unplug|open)/, /not (switch|turn|power|unplug|open)/, /leave it on/] },
      { label: 'Isolate it from the network', re: [/isolat/, /off the network/, /disconnect/, /quarantin/] },
      { label: 'Don\'t restart, clean or restore it: keep the evidence', re: [/evidence/, /restore/, /clean/, /wipe/, /restart/] },
      { label: 'Escalate to Security straight away', re: [/secur/, /escalat/, /incident response/] },
      { label: 'Find out what she opened and which shares were mapped', re: [/what (she|they) opened/, /attachment/, /shares/, /mapped/, /drives/] },
    ],
    model: 'Speed matters most, because encryption spreads to every share that laptop can reach. I tell her not to switch it off, unplug it or open anything. I isolate the device from the network through the security agent, which stops the spread but keeps the agent working. I don\'t restart, clean or restore it, because that destroys the evidence Security needs. Then I escalate to Security straight away with what she opened and which shares were mapped.',
  },
];
