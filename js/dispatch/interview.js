// Interview prep for the Service Coordinator mode: common MSP coordinator / dispatcher interview
// questions, each tied to the playbook article and the drill that shows the answer in the sim.
//
//   points   what a strong answer covers. Each point is ticked when the player's answer matches
//            one of its patterns (case-insensitive). It's a nudge, not a grade: wording varies.
//   model    one good answer, in the first person, built from the sim's own playbook
//   drill    the skill drill (DRILLS in scenarios.js) that practises it, or null for a full shift
//   kb       playbook article ids (PLAYBOOK in data.js)

const PREP = [
  {
    id: 'prioritise', q: 'Five tickets land at once. How do you decide what gets worked first?',
    kb: ['PB-01', 'PB-02'], drill: 'triage',
    points: [
      { label: 'Impact and urgency, not who shouts loudest', re: [/impact/, /urgen/, /how many (people|users)/] },
      { label: 'The SLA clock for each client', re: [/sla/, /response (time|target)/, /contract/] },
      { label: 'Overrides: security incidents and failed backups go up', re: [/secur/, /phish/, /compromis/, /backup/, /override/] },
      { label: 'A VIP alone doesn\'t make it urgent', re: [/vip/, /loud/, /title/, /senior/] },
      { label: 'Acknowledge everyone quickly, even before it\'s worked', re: [/acknowledg/, /let them know/, /first response/, /logged/] },
    ],
    model: 'I triage before I work anything. For each ticket I ask how many people it affects and how badly it stops them, and that gives me the priority from our matrix. Then I check two overrides: anything that looks like compromised credentials is a P1 on the Security board, and a second backup failure on a server with client data is at least a P2. A VIP gets care, but their title alone doesn\'t make a slow laptop urgent. Meanwhile everyone gets a quick acknowledgement inside their SLA, so nobody is left wondering if we saw it.',
  },
  {
    id: 'sick', q: 'A technician calls in sick with three appointments booked today. Walk me through it.',
    kb: ['PB-04', 'PB-02'], drill: null,
    points: [
      { label: 'Pull up their calendar straight away', re: [/calendar/, /schedule/, /board/, /appointment/] },
      { label: 'Rebook with someone who has the right skills', re: [/skill/, /rebook/, /reassign/, /re-?home/, /another tech/] },
      { label: 'Tell each client before they notice', re: [/tell the client/, /let the client/, /inform/, /notify the client/, /call the client/, /email the client/, /client know/, /before they notice/, /contact (each|the) client/] },
      { label: 'Urgent work first; move planned work to another day', re: [/priorit/, /urgent/, /tomorrow/, /another day/, /planned/] },
      { label: 'Raise it if there isn\'t enough capacity', re: [/service manager/, /escalat/, /capacity/, /manager/] },
    ],
    model: 'First I open their calendar and list every appointment they still had. I rebook the urgent ones first, with technicians who have the right skills and are free, and I push planned work to tomorrow if that\'s what it takes to keep today for today\'s problems. Then I contact each client before their original time, so nobody waits for a tech who isn\'t coming. If there isn\'t enough capacity to cover it, I tell the Service Manager early rather than quietly letting SLAs slip.',
  },
  {
    id: 'angry', q: 'A client calls, angry that their issue still isn\'t fixed. What do you do?',
    kb: ['PB-02'], drill: 'p1',
    points: [
      { label: 'Listen and acknowledge first', re: [/listen/, /acknowledg/, /apolog/, /understand/, /empath/] },
      { label: 'Find out where the ticket really stands', re: [/check the ticket/, /status/, /find out/, /look at the ticket/, /history/, /where (it|the ticket) (really )?(is|stands)/] },
      { label: 'A concrete next step and a time', re: [/next step/, /by \d/, /eta/, /time/, /when/] },
      { label: 'Agree when you\'ll update them, then do it', re: [/update/, /call (them )?back/, /follow up/, /every \d+/, /hear from/] },
      { label: 'Escalate if it\'s stuck', re: [/escalat/, /service manager/, /manager/] },
    ],
    model: 'I let them finish and I acknowledge it plainly: they\'ve had to chase us, and that\'s on us. While they\'re on the line I check where the ticket really is: who has it, what\'s been done, and whether we\'re waiting on anything. Then I give them one concrete next step with a time, and I tell them when they\'ll next hear from me, and I keep to it. If it\'s stuck, I escalate to the Service Manager rather than make a promise I can\'t keep.',
  },
  {
    id: 'match', q: 'How do you decide which technician gets a ticket?',
    kb: ['PB-03', 'PB-04'], drill: 'scheduling',
    points: [
      { label: 'Skills and tier for the work', re: [/skill/, /tier/, /experience/, /expert/] },
      { label: 'Availability and workload', re: [/availab/, /workload/, /free/, /capacity/, /calendar/] },
      { label: 'Remote or onsite (and travel time)', re: [/onsite/, /on-site/, /remote/, /travel/, /field/] },
      { label: 'Client rules: named engineers, visit windows', re: [/client (notes|rules)/, /named/, /window/, /only allow/, /preference/] },
      { label: 'A mismatch costs the client time', re: [/bounce/, /wrong tech/, /hand(ed)? back/, /waste/, /waited/] },
    ],
    model: 'I match the work to the person. First the skill the ticket needs and the tier it belongs at, then who\'s actually free given lunches, meetings and travel. Onsite work can only go to someone who goes onsite, with travel time in front of it. Then I check the client notes, because some clients name the engineer they allow on certain systems or only allow visits at certain hours. Getting it wrong just bounces back to me, and the client has waited for nothing.',
  },
  {
    id: 'access', q: 'A user emails asking for access to a restricted shared folder. What do you check?',
    kb: ['PB-05'], drill: 'approvals',
    points: [
      { label: 'Who is authorised to approve for that client', re: [/authori[sz]ed/, /approver/, /approval/] },
      { label: 'Ask the approver directly, not through the requester', re: [/directly/, /not the requester/, /not through/, /myself/] },
      { label: 'Nothing is dispatched until it\'s approved', re: [/until/, /before (any|we|i)/, /wait/, /hold/] },
      { label: 'Tell the requester the outcome, even a no', re: [/tell the (user|requester)/, /let the (user|requester)/, /declin/, /outcome/, /inform/] },
      { label: 'Close it with the right reason', re: [/close/, /record/, /note/, /document/] },
    ],
    model: 'I check the client\'s list of authorised approvers, and I send the request to one of them myself rather than asking the user to get permission, because a user can\'t approve their own access. No technician touches it until the approval comes back. If it\'s declined, I tell the user politely and close the ticket as declined by the client, with a note saying who declined it.',
  },
  {
    id: 'vip-forward', q: 'An email from the managing partner asks you to forward all his mail to a Gmail address. What do you do?',
    kb: ['PB-05', 'PB-03'], drill: 'approvals',
    points: [
      { label: 'Check the sender\'s address and domain', re: [/domain/, /sender/, /address/, /lookalike/, /spoof/] },
      { label: 'Verify through a known contact, not by replying', re: [/verify/, /known (contact|number)/, /call/, /confirm/] },
      { label: 'Treat it as possible fraud: Security board', re: [/secur/, /phish/, /fraud/, /impersonat/, /social engineer/] },
      { label: 'Don\'t action it in the meantime', re: [/don't/, /do not/, /hold/, /not (forward|action)/, /until/] },
    ],
    model: 'That\'s a classic red flag, so I slow down. First I check the sender\'s domain, because lookalike domains are common. I don\'t reply to the email to confirm. I verify through a contact I already know, by calling the partner or the office manager on the number we hold. Until it\'s verified I treat it as possible impersonation on the Security board and send it to our security lead, and nobody sets up any forwarding.',
  },
  {
    id: 'p1', q: 'A whole clinic is down: no internet, no phones. Talk me through the first 30 minutes.',
    kb: ['PB-09', 'PB-02', 'PB-08'], drill: 'p1',
    points: [
      { label: 'P1, and the Service Manager is told', re: [/p1/, /priority 1/, /critical/, /service manager/, /major incident/] },
      { label: 'The right engineer, now (pull them off lower work)', re: [/engineer/, /straight away/, /immediately/, /pull/, /now/] },
      { label: 'Log the vendor or ISP case and get an ETA', re: [/isp/, /vendor/, /carrier/, /eta/, /case/] },
      { label: 'Update the client every 30 minutes', re: [/30 min/, /thirty/, /update/, /cadence/] },
      { label: 'Merge the duplicate calls into one incident', re: [/duplicat/, /merge/, /parent/, /one incident/] },
    ],
    model: 'It\'s a P1, so I page the Service Manager and get the right engineer on it immediately, pulling them off lower-priority work if I have to, and checking the client notes for any named engineer. When the engineer points at the ISP, I open the carrier case myself and pass the reference and ETA to the client. From then on the client gets an update at least every 30 minutes, even if it\'s "still waiting on the ISP". Other calls from the same site get merged into the one incident.',
  },
  {
    id: 'alerts', q: 'Monitoring throws dozens of alerts a day. How do you decide which ones matter?',
    kb: ['PB-06'], drill: 'noise',
    points: [
      { label: 'Check the client notes for expected noise', re: [/client notes/, /expected/, /known/, /notes/] },
      { label: 'Close noise with a note saying why', re: [/close/, /no action/, /note/] },
      { label: 'Real thresholds: disks over 90%, repeated backup failures', re: [/disk/, /backup/, /threshold/, /twice/, /in a row/] },
      { label: 'Don\'t burn tech time on noise', re: [/don't (send|dispatch)/, /not (send|dispatch)/, /waste/, /tech time/, /time on noise/] },
    ],
    model: 'For each alert I decide whether it\'s actionable or noise, and the client notes usually tell me. A lab VM that shuts down every night, or a laptop whose owner is on leave, is expected, so I close it as no action needed with a note. Real signals get triaged like any ticket: a server disk past 90% is a P3 for today, and a backup that has failed twice in a row on a server with client data is a P2. The aim is that no technician spends time on noise.',
  },
  {
    id: 'billing', q: 'What\'s the difference between billable and covered work, and why does it matter to a dispatcher?',
    kb: ['PB-12', 'PB-07'], drill: 'approvals',
    points: [
      { label: 'The client\'s agreement decides what\'s covered', re: [/agreement/, /contract/, /managed/, /covered/] },
      { label: 'Block hours: check the balance before booking', re: [/block/, /prepaid/, /balance/, /hours left/] },
      { label: 'Projects and onboarding are billed separately', re: [/project/, /onboard/, /new starter/] },
      { label: 'Get Account Manager approval when it\'s over', re: [/account manager/, /top.?up/, /quote/, /approv/] },
      { label: 'Code time entries correctly', re: [/time entr/, /cod(e|ing)/, /invoice/] },
    ],
    model: 'The agreement decides it. Managed agreements cover support, though onsite visits can be extra on a standard agreement, and project or onboarding work is billed separately. Block-hours clients pay for every minute out of a prepaid balance, so before I book I compare the estimate to the hours left, and if it won\'t fit I get the Account Manager to arrange a top-up first. Then I code each time entry correctly, because billing covered work annoys the client and giving away billable work costs us revenue.',
  },
  {
    id: 'handover', q: 'What goes into your end-of-shift handover?',
    kb: ['PB-11'], drill: null,
    points: [
      { label: 'Open P1s and P2s', re: [/p1/, /p2/, /high priority/, /critical/, /major/] },
      { label: 'Anything waiting on a vendor or an approval', re: [/vendor/, /isp/, /approval/, /waiting/] },
      { label: 'Work nobody owns yet', re: [/nobody/, /unassigned/, /not booked/, /unowned/, /owner/] },
      { label: 'A next step for each item', re: [/next step/, /what('s| is) next/, /action/] },
      { label: 'A short summary, kept to what matters tonight', re: [/summary/, /short/, /brief/, /only what/] },
    ],
    model: 'On-call only knows what I tell them, so I keep it short and specific. I list every P1 or P2 still open, anything waiting on a vendor or an approval in case they call back overnight, and any work that nobody is booked for. Each item gets the next step and who owns it. I leave off work that\'s already booked for tomorrow with someone who\'ll be in, and I finish with one line on how the shift went.',
  },
  {
    id: 'kpis', q: 'Which numbers would you watch to know you\'re doing the job well?',
    kb: ['PB-02'], drill: null,
    points: [
      { label: 'First response inside SLA', re: [/first response/, /sla/, /response time/] },
      { label: 'Time to triage', re: [/triage/] },
      { label: 'Missed calls and client chasers', re: [/missed call/, /chase/, /abandon/, /voicemail/] },
      { label: 'Wrong-tech dispatches or reopened tickets', re: [/wrong tech/, /bounce/, /reassign/, /reopen/, /first.?time fix/] },
      { label: 'Technician utilisation', re: [/utili[sz]/, /capacity/, /billable hours/] },
    ],
    model: 'First response inside SLA and time to triage, because they show whether clients feel heard. Missed calls and how often clients chase us, because each chase means we went quiet. Wrong-tech dispatches or reopened tickets, because they mean the client waited for nothing. And technician utilisation: around 70 to 85 percent is healthy, and nobody should sit at zero while tickets wait.',
  },
];

// Which of a question's key points an answer covers. Returns one boolean per point.
function prepCovered(q, text) {
  const t = String(text || '').toLowerCase().replace(/[’‘]/g, "'");
  return q.points.map(p => p.re.some(r => r.test(t)));
}
