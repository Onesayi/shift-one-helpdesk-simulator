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

// ---------------------------------------------------------------------------
// Support assessment practice: the kind of skills test SaaS support desks (Zendesk-based, L1 technical
// support) send candidates. Reworded practice versions, not any company's real test.
//
//   kind 'mcq'    pick one option. `a` is the right key, `why` explains every option.
//   kind 'write'  a written task. `points` work like PREP points. `traps` are things a strong answer
//                 never does (each matching pattern shows a warning). `limits` are shape rules:
//                 maxQuestions (question marks), maxMessages (non-empty paragraphs), words [min, max].
// ---------------------------------------------------------------------------
const ASSESS = [
  {
    id: 'pending', kind: 'mcq', topic: 'Zendesk statuses',
    q: 'You\'ve asked a client for a screenshot of the error and the time it appeared. You can\'t go further until they reply. Which status do you set the ticket to?',
    opts: {
      A: 'Open, so the rest of the team keeps seeing it in the queue until it\'s fixed',
      B: 'Pending, because you\'re waiting on the requester, and it goes back to Open by itself when they reply',
      C: 'On-hold, because you\'re waiting, and it drops out of the team\'s views until the client answers',
      D: 'Solved, because the client can reopen it by replying, and it keeps the queue clean meanwhile',
    },
    a: 'B',
    why: {
      A: 'Open means you have the next action. Here the client does.',
      B: 'Pending is "waiting on the requester". Their reply sets it back to Open automatically.',
      C: 'On-hold is for waiting on a third party or another team (a vendor, engineering), not the requester.',
      D: 'Solved hides a problem that isn\'t fixed and makes the resolution numbers lie.',
    },
  },
  {
    id: 'automation', kind: 'mcq', topic: 'Zendesk business rules',
    q: 'Your team wants clients nudged when a ticket has been Pending for 2 days, and the ticket solved after 5 days with no reply. What do you set up?',
    opts: {
      A: 'A trigger, because triggers check every ticket once an hour for conditions like "hours since Pending"',
      B: 'A macro, scheduled to apply itself to Pending tickets after a set number of days',
      C: 'An automation, because automations run on a schedule and act on time conditions like "hours since Pending"',
      D: 'An SLA policy, because SLA policies email the requester and close the ticket once a target is breached',
    },
    a: 'C',
    why: {
      A: 'Triggers fire on events (a ticket created or updated), not on a schedule. This option describes an automation and calls it a trigger.',
      B: 'Macros only run when an agent clicks them.',
      C: 'Time-based means automation. Two of them: a reminder at 48 hours and Solved at 120 hours, each with a tag so it only fires once.',
      D: 'SLA policies measure targets and show breaches. They don\'t email anyone or change status.',
    },
  },
  {
    id: 'http403', kind: 'mcq', topic: 'HTTP status codes',
    q: 'A client connected their Microsoft 365 tenant. The scan reads every SharePoint site except one, where the log says "403 Forbidden". What does that most likely mean?',
    opts: {
      A: 'The password or token is wrong, so Microsoft rejected the sign-in at that site',
      B: 'The sign-in worked, but the account the platform uses has no permission on that one site',
      C: 'Microsoft had a server error at that site, so a retry will fix it',
      D: 'The site holds too many files, so the request timed out',
    },
    a: 'B',
    why: {
      A: 'A bad credential is 401, and it would fail everywhere, not on one site.',
      B: '403 means "I know who you are, and you can\'t come in." Add the scanning account to that site, or check a policy that restricts it.',
      C: 'Server errors are 5xx (500, 503).',
      D: 'A timeout is a timeout or 504, never 403.',
    },
  },
  {
    id: 'outbound', kind: 'mcq', topic: 'Networking',
    q: 'A client\'s file server has no access from the internet. Why does the platform ask them to install an agent inside their network?',
    opts: {
      A: 'The agent opens port 445 on their firewall so the cloud can reach the server directly',
      B: 'The agent copies every file to the cloud first, because the platform can only read its own storage',
      C: 'The agent reaches the server locally and sends results out over HTTPS, so no inbound firewall rule is needed',
      D: 'The agent only makes scans faster; the cloud can already reach the server on its own',
    },
    a: 'C',
    why: {
      A: 'Opening SMB (445) to the internet is how ransomware like WannaCry spread. Never.',
      B: 'Agents usually process locally and send results, not whole files.',
      C: 'Outbound HTTPS (443) is almost always allowed, so nothing on the client\'s firewall has to open.',
      D: 'The question says the server has no internet access, so the cloud can\'t reach it.',
    },
  },
  {
    id: 'http5xx', kind: 'mcq', topic: 'HTTP status codes',
    q: 'A large CSV export fails with "504 Gateway Timeout" in two different browsers. What\'s the most likely cause?',
    opts: {
      A: 'The client\'s browser is out of date',
      B: 'The client isn\'t signed in any more',
      C: 'The server behind the gateway took too long to build the file, so the gateway gave up waiting',
      D: 'The export is blocked by the client\'s permissions',
    },
    a: 'C',
    why: {
      A: 'Two browsers failing the same way rules the browser out.',
      B: 'A signed-out user gets 401 or a login page.',
      C: '504 is a timeout between our own servers. It\'s on our side, usually with large exports.',
      D: 'Missing permissions is 403.',
    },
  },
  {
    id: 'chat', kind: 'write', topic: 'Chat reply',
    q: 'In chat: "Hi, I\'m trying to connect our Microsoft 365 and it says \'Need admin approval: this app needs permission that only an admin can grant.\' I\'m the office manager, not the admin. My boss wants this working before our 2 PM meeting." Write your chat replies: 2 to 4 short messages, no more than 2 questions in total.',
    limits: { maxQuestions: 2, maxMessages: 4 },
    points: [
      { label: 'Acknowledge the request and the 2 PM deadline', re: [/2 ?pm/, /meeting/, /deadline/, /before (your|the)/] },
      { label: 'Explain plainly that Microsoft needs an admin to approve it', re: [/admin/, /approv/, /consent/] },
      { label: 'Say it isn\'t something they did wrong', re: [/nothing (you|wrong)/, /not (your|something you)/, /expected/, /normal/, /by design/, /security/] },
      { label: 'One clear next step for the admin, with how long it takes', re: [/minute/, /guide/, /step/, /link/, /forward/, /send (it|this) to/] },
      { label: 'A fallback for the meeting', re: [/if (they|your admin|the admin) can'?t/, /meantime/, /meanwhile/, /status/, /ready (except|apart)/, /in the meeting/] },
    ],
    traps: [
      { label: 'Suggests borrowing the admin\'s login or sharing a password', re: [/(admin'?s|their) (login|password|credentials)/, /log ?in as/, /share (the|their|your) password/] },
      { label: 'Jargon a non-admin won\'t know (OAuth, delegation, tenant-wide consent)', re: [/oauth/, /delegation/, /tenant-wide/, /service principal/] },
    ],
    model: 'Hi! Thanks for the heads-up about 2 PM. I\'ll help you get there.\n\nThat message comes from Microsoft, not from anything you did: connecting a company account needs a Microsoft 365 admin to approve it once. Nobody else can approve it for them, for security reasons.\n\nIt takes your admin about 5 minutes. I\'ll send you a short step-by-step guide you can forward, and once they approve, you can manage everything else yourself. Can you reach them before 2?\n\nIf not, I can write you a two-line status for the meeting: what\'s set up, and the one approval still waiting.',
  },
  {
    id: 'triage', kind: 'write', topic: 'Ticket triage',
    q: 'Five new tickets at the start of your shift. List them in the order you\'d handle them, one line each: the letter, priority (Urgent, High, Normal or Low), handle or route (to whom), and your first action.\nA. "How do I change the date format on my reports?"\nB. An enterprise client: "Since 8:30 nobody in our company can sign in." Two other clients opened the same ticket in the last 15 minutes.\nC. "Our nightly sync of the HR folder has said \'Running\' since Monday. It normally takes 2 hours. Our payroll run is Friday."\nD. "We\'d like a quote for 30 more seats."\nE. "Our new admin, Priya, can\'t see the Billing page. The other admins can."',
    limits: { words: [40, 220] },
    points: [
      { label: 'B first, as Urgent: an incident hitting several clients', re: [/^\s*(1[.)]?\s*)?b\b[^\n]*urgent/m, /b[^\n]{0,20}urgent/] },
      { label: 'Link B\'s tickets to one incident and escalate to engineering', re: [/link/, /incident/, /engineer/, /on-?call/, /escalat/] },
      { label: 'C next, High, because of the Friday deadline', re: [/c[^\n]{0,20}high/, /friday/, /payroll/] },
      { label: 'D goes to the account manager or sales', re: [/account manager/, /sales/] },
      { label: 'A last, Low: send the steps or a help article', re: [/a[^\n]{0,20}low/, /help (centre|center|article)/, /article/] },
      { label: 'E handled yourself: compare Priya\'s role with the other admins', re: [/role/, /permission/] },
    ],
    traps: [
      { label: 'Puts a how-to or sales question first', re: [/^\s*(1[.)]?\s*)?(a|d)\b[^\n]*(urgent|high)/m] },
    ],
    model: '1. B: Urgent. Route to on-call engineering as an incident. First: three clients in 15 minutes means it\'s us, so link the tickets to one incident, escalate, and tell all three when the next update is.\n2. C: High. Handle it, escalate if needed. First: read the sync job log and test the connection, then give the client a plan that finishes before Friday\'s payroll.\n3. E: Normal. Handle it. First: compare Priya\'s role and permissions with another admin\'s, fix it, and ask her to sign out and back in.\n4. D: Normal. Route to the account manager. First: thank them and tell them who will contact them and when.\n5. A: Low. Handle it. First: reply with the steps or the help article.',
  },
  {
    id: 'checks', kind: 'write', topic: 'Troubleshooting',
    q: 'A client installed your agent on a VM inside their network. It can reach their file servers, but it can\'t talk to your cloud platform. List up to 5 checks, in order, one line each, with the command or tool for each.',
    limits: { words: [30, 200] },
    points: [
      { label: 'The agent service is running, and its log', re: [/service/, /systemctl/, /get-service/, /event viewer/, /journalctl/, /\blogs?\b/] },
      { label: 'DNS: can it resolve the platform\'s hostname?', re: [/dns/, /nslookup/, /\bdig\b/, /resolve/] },
      { label: 'Outbound HTTPS on port 443', re: [/443/, /test-netconnection/, /curl/, /\bnc\b/, /telnet/] },
      { label: 'A proxy the agent must use', re: [/proxy/] },
      { label: 'TLS inspection, certificates or the clock', re: [/tls/, /ssl/, /cert/, /openssl/, /clock/, /time sync/, /ntp/, /w32tm/, /timedatectl/] },
    ],
    traps: [
      { label: 'Checks the internal network first, though that already works', re: [/ping (the )?file server/, /check (the )?lan/] },
      { label: 'Opens an inbound port on the client\'s firewall', re: [/open (an )?inbound/, /port ?forward/, /allow inbound/] },
    ],
    model: '1. Agent service and log: is it running, and what\'s the last error? systemctl status / journalctl, or Get-Service and Event Viewer on Windows.\n2. DNS: nslookup <platform host>. Can the VM resolve our name?\n3. Outbound 443: Test-NetConnection <host> -Port 443, or curl -v https://<host>.\n4. Proxy: does their traffic have to go through one, and does the agent know? netsh winhttp show proxy, env | grep -i proxy, the agent config.\n5. TLS and clock: openssl s_client -connect <host>:443 to see if a firewall swaps the certificate, and check the VM\'s time with w32tm or timedatectl.\nInternal access works, so I start at the agent and work outwards.',
  },
  {
    id: 'docs', kind: 'write', topic: 'Client email from the docs',
    q: 'The docs say: "Each file gets one of four labels: Restricted, Confidential, Internal or Public. Files over 100 MB are labelled from their metadata only (name, folder, owner, type) unless Full Content Scan is on for that source. Full Content Scan needs the scanning account to read file content, and makes scans about 3 times longer."\nThe client\'s privacy lead emails: "Our 180 MB customer contract is labelled Internal. It\'s full of personal data. We have a compliance audit in two weeks. Is your tool even working?" Write your reply.',
    limits: { words: [80, 260] },
    points: [
      { label: 'Agree the label is wrong for that content, and note the audit', re: [/audit/, /two weeks/, /right to/, /you'?re right/, /should(n'?t| not) be internal/] },
      { label: 'Explain: over 100 MB, so labelled from metadata only', re: [/100 ?mb/, /metadata/, /name.{0,20}(folder|owner)/, /didn'?t read/, /content (was|wasn'?t)/] },
      { label: 'The fix: turn on Full Content Scan and give the account read access', re: [/full content scan/, /read access/, /permission/] },
      { label: 'Mention it takes about 3 times longer, so start now', re: [/3 ?(x|times)/, /three times/, /longer/] },
      { label: 'Check the other large files too', re: [/other (large )?files/, /other files over/, /everything over/, /all files (over|above)/] },
      { label: 'Offer a call or to confirm after the rescan', re: [/call/, /confirm/, /check (it|back)/, /follow up/] },
    ],
    traps: [
      { label: 'Defensive or blames the client', re: [/you should have/, /your fault/, /you didn'?t (enable|turn on|set)/, /as documented/] },
    ],
    model: 'Subject: Your contract\'s label, and making sure it\'s right before the audit\n\nHi Sam,\n\nYou\'re right: a contract full of personal data shouldn\'t be labelled Internal, and with an audit in two weeks I understand the worry. The tool is working, but this source is set up in a way that missed it. Files over 100 MB are labelled from their name, folder, owner and type only, unless Full Content Scan is on, so the contract\'s content was never read.\n\nTo fix it:\n1. Turn on Full Content Scan for this source.\n2. Give the scanning account read access to file content, not just metadata.\n3. Run a new scan.\n\nScans take about three times longer with it on, so I\'d start this week. Other files over 100 MB on this source may be under-labelled too, and I\'m happy to go through that list with you.\n\nI can join a short call with your admin to switch it on, and I\'ll confirm the contract\'s new label once the scan finishes.',
  },
  {
    id: 'escalate', kind: 'write', topic: 'Internal escalation note',
    q: 'You\'re escalating ticket C from the triage task to L2. You know: client Contoso (Enterprise). Source: the Azure storage account contoso-hr. The nightly sync started Monday 01:00 and has been stuck at 55% (8,800 of 16,000 files) since 03:20. Their other sources ran fine. The client changed nothing. The connection test passes. Since 03:20 the log repeats every few minutes: "Retrying request: 503 Server Busy". Payroll runs Friday. Write the internal note.',
    limits: { words: [70, 260] },
    points: [
      { label: 'A headline: client, source, symptom, deadline, priority', re: [/contoso/, /high/, /priority/] },
      { label: 'Exact facts: times, counts and the log message', re: [/55 ?%/, /8,?800/, /03:20/, /503/] },
      { label: 'What\'s ruled out: connection, other sources, client changes', re: [/connection test/, /other sources/, /no changes/, /nothing changed/, /ruled out/] },
      { label: 'Your read: throttling, stuck retrying instead of backing off', re: [/throttl/, /back ?off/, /retry loop/, /rate/] },
      { label: 'Specific asks for L2', re: [/can you/, /please/, /\bask\b/, /need (you|l2)/, /resume/, /checkpoint/] },
      { label: 'Deadline, impact and the client update', re: [/friday/, /7,?200/, /remaining/, /told the client/, /client (has been|was) (told|updated)/, /update the client/] },
    ],
    traps: [
      { label: 'Vague ("sync broken, please look")', re: [/^\s*(sync|scan) (is )?broken[\s.!]*$/m, /please look\s*\.?$/] },
    ],
    model: 'ESCALATION, High: Contoso (Enterprise) · contoso-hr · nightly sync stuck at 55% since Mon 03:20 · payroll Friday\n\nFacts: started Mon 01:00, stuck at 8,800 of 16,000 files since 03:20. The log repeats "Retrying request: 503 Server Busy" every few minutes.\nRuled out: the connection test passes (credentials, permissions and network are fine). Contoso\'s other sources ran normally this week, so it\'s this storage account. The client says nothing changed.\nMy read: 503 Server Busy is Azure throttling us. The job looks stuck retrying at the same rate instead of backing off. Either our request rate is too high for this account, or something else is loading it.\nAsks: 1) check our retry and backoff for this source; 2) lower the request rate or concurrency; 3) resume from the 55% checkpoint, not from zero; 4) anything changed on our side (version, settings)? 5) should Contoso check their storage metrics?\nImpact: about 7,200 files left. We need it done by Thursday for margin.\nClient: told we\'ve escalated, next update promised by 15:00 today.',
  },
  {
    id: 'improve', kind: 'write', topic: 'Process improvement',
    q: 'In two weeks your team got about 30 tickets asking how to connect Microsoft Teams. Every agent writes the answer from scratch, so replies are slow. What would you do, in Zendesk and with other teams, to answer faster and get fewer of these? Up to 4 actions, one line each, and who you\'d work with.',
    limits: { words: [30, 200] },
    points: [
      { label: 'A macro with the checked answer', re: [/macro/, /canned/, /saved repl/] },
      { label: 'A help-centre article, written with docs and checked by L2', re: [/article/, /help (centre|center)/, /knowledge base/, /\bkb\b/, /documentation/] },
      { label: 'Deflection: suggest the article before a ticket is raised', re: [/deflect/, /widget/, /suggest/, /auto-?repl/, /trigger/] },
      { label: 'Fix the cause with product or customer success', re: [/product/, /root cause/, /in-?app/, /onboarding/, /customer success/] },
      { label: 'A tag to measure whether it worked', re: [/tag/, /measure/, /track/, /volume/, /report/] },
    ],
    traps: [],
    model: '1. A macro with the Teams setup answer, checked by an L2 engineer. It adds a teams_setup tag so we can count these. (Support team, L2.)\n2. A help-centre article with screenshots and the common errors, written with the docs team and linked from the macro. (Docs, L2.)\n3. Deflection: suggest the article in the web widget and on the ticket form, and a trigger that auto-replies with it when a new ticket mentions Teams. (Zendesk admin.)\n4. The cause: use the tag to see where people get stuck, and take it to product (clearer in-app setup) and customer success (add it to onboarding). Track volume and reply time for a month.',
  },
  {
    id: 'locked', kind: 'write', topic: 'Customer email: frustrated',
    q: 'Email from Dana Reid, subject "Can\'t log in!!": "I\'ve been trying to get in all morning. My username and password are right, I\'ve checked them over and over. I have a client presentation at noon and I\'m getting really stressed. Fix this now please. Username: danareid88." Write your reply: acknowledge, apologise, give clear steps, and ask her to confirm it worked.',
    limits: { words: [70, 230] },
    points: [
      { label: 'Acknowledge the stress and the noon deadline', re: [/noon/, /presentation/, /stress/, /frustrat/, /understand/] },
      { label: 'One apology', re: [/sorry/, /apolog/] },
      { label: 'Numbered reset steps, including the spam folder and the link expiring', re: [/forgot (your )?password/, /reset/] },
      { label: 'Quick checks: Caps Lock, saved passwords, a private window', re: [/caps lock/, /autofill/, /saved password/, /private/, /incognito/, /cache/] },
      { label: 'Offer to check for a lockout if the reset doesn\'t work', re: [/lock(ed)? ?out/, /lockout/, /been locked/, /check (your|the) account/] },
      { label: 'Ask her to confirm it\'s working', re: [/let me know/, /confirm/, /reply/] },
    ],
    traps: [
      { label: 'Asks for her password', re: [/(send|tell|share|give) (me |us )?(your )?(current |old )?password/, /what is your password/] },
      { label: 'Apologises over and over', re: [/sorry[\s\S]*sorry[\s\S]*sorry/] },
    ],
    model: 'Hi Dana,\n\nI\'m sorry you\'ve lost the morning to this, especially with a presentation at noon. Let\'s get you in quickly.\n\n1. Go to the sign-in page and click "Forgot password".\n2. Enter danareid88 or your email address.\n3. Open the reset email (check spam too) and use the link straight away, because it expires.\n4. Set a new password and sign in.\n\nIf it still fails, check Caps Lock, turn off any saved or autofilled password, and try a private window.\n\nIf the reset doesn\'t work either, reply here and I\'ll check right away whether your account has been locked after the failed attempts.\n\nCould you let me know once you\'re in?\n\nBest,\nAlistair',
  },
  {
    id: 'knownbug', kind: 'write', topic: 'Customer email: known bug',
    q: 'Email from Leo Park, subject "Export error": "Every time I export my data to Excel I get \'Error 504: Gateway Timeout\'. Same in Chrome and Edge. I need it for my monthly report. Thanks, Leo." Engineering knows about this bug. Write your reply: confirm, explain it\'s known, apologise, give an estimate, and offer to run the export for him.',
    limits: { words: [60, 220] },
    points: [
      { label: 'Confirm you got it, and thank him for trying two browsers', re: [/thank/, /two browsers/, /both browsers/, /chrome and edge/] },
      { label: 'Say it\'s a known issue on our side', re: [/known/, /aware/, /our side/, /our end/, /engineering/] },
      { label: 'Apologise for the bug and the report', re: [/sorry/, /apolog/] },
      { label: 'A realistic estimate and a promise to update', re: [/expect/, /estimate/, /by (mon|tues|wednes|thurs|fri|satur|sun)day/, /within/, /update you/, /let you know/] },
      { label: 'Offer to run it for him and ask exactly what he needs', re: [/run (the|it|this) (export )?for you/, /send (you )?the file/, /manually/, /date range/, /which (data|fields|columns)/, /filters/] },
    ],
    traps: [
      { label: 'Blames his browser or connection', re: [/(update|upgrade|change|switch) (your )?browser/, /clear (your )?cache/, /your (internet|connection) (is|might|may|could)/] },
    ],
    model: 'Hi Leo,\n\nThanks for the clear report, and for trying both Chrome and Edge: that tells us it isn\'t your browser.\n\nThis is a known issue on our side. Large exports take longer than our gateway waits, so it gives up with a 504. Our engineers are working on it, and I\'m sorry it\'s getting in the way of your monthly report.\n\nWe expect a fix by Friday, and I\'ll update you as soon as it\'s out.\n\nIn the meantime I can run the export for you and send you the file. Which data do you need, for which date range, and with any filters?\n\nBest,\nAlistair',
  },
  {
    id: 'explain', kind: 'write', topic: 'Explain it simply (spoken)',
    q: 'Write what you\'d say in a 60 to 90 second voice message, explaining a technical problem to a customer who isn\'t technical (for example, why their export fails with a 504). About 150 to 200 words.',
    limits: { words: [130, 220] },
    points: [
      { label: 'An everyday comparison', re: [/like a/, /imagine/, /think of/, /as if/, /similar to/] },
      { label: 'Say it isn\'t their fault', re: [/not your fault/, /nothing you did/, /not something you/, /on our side/, /our end/] },
      { label: 'What we\'re doing to fix it', re: [/working on/, /engineers/, /fix/] },
      { label: 'A workaround meanwhile', re: [/meantime/, /meanwhile/, /for now/, /until then/, /in the meantime/, /smaller/] },
      { label: 'Warm, plain close', re: [/any questions/, /here to help/, /reach out/, /get back to/, /let me know/] },
    ],
    traps: [
      { label: 'Jargon left unexplained (gateway, upstream, latency, server-side timeout)', re: [/upstream/, /latency/, /server-side timeout/, /reverse proxy/] },
    ],
    model: 'Hi Leo, it\'s Alistair from support, following up on the export error.\n\nThink of it like ordering at a busy restaurant. Your waiter takes the order to the kitchen, but only waits at the counter for a set time. When the order is very large, the kitchen takes longer than that, so the waiter comes back and says "sorry, it timed out". That\'s what the 504 message means: our system took too long to prepare a big file, and the part that waits for it gave up.\n\nIt isn\'t anything you did, and it isn\'t your computer or your internet. It\'s on our side, and our engineers are already working on making large exports faster.\n\nIn the meantime, two things will get you your report: you can export a shorter date range at a time, or I can run the full export for you and email you the file today.\n\nI\'ll let you know as soon as the fix is out. If you have any questions, just reply to my email. Thanks for your patience.',
  },
];

// Shape checks for a written task: question marks, separate messages (paragraphs) and words.
function assessShape(item, text) {
  const t = String(text || '').trim(), L = item.limits || {}, out = [];
  if (!t) return out;
  const words = t.split(/\s+/).filter(Boolean).length;
  const questions = (t.match(/\?/g) || []).length;
  const messages = t.split(/\n\s*\n/).filter(x => x.trim()).length;
  if (L.maxQuestions != null) out.push({ ok: questions <= L.maxQuestions, label: `${questions} question${questions === 1 ? '' : 's'} (no more than ${L.maxQuestions})` });
  if (L.maxMessages != null) out.push({ ok: messages >= 2 && messages <= L.maxMessages, label: `${messages} message${messages === 1 ? '' : 's'} (2 to ${L.maxMessages}, one per paragraph)` });
  if (L.words) out.push({ ok: words >= L.words[0] && words <= L.words[1], label: `${words} words (aim for ${L.words[0]} to ${L.words[1]})` });
  return out;
}
// Which traps a written answer falls into.
function assessTraps(item, text) {
  const t = String(text || '').toLowerCase().replace(/[’‘]/g, "'");
  return (item.traps || []).filter(x => x.re.some(r => r.test(t)));
}

// The cheat sheet shown above the assessment tasks.
const ASSESS_REF = `
<h4>Zendesk statuses</h4><table class="tbl compact"><tbody>
<tr><td><b>New</b></td><td>Nobody has worked it yet</td></tr>
<tr><td><b>Open</b></td><td>You have the next action</td></tr>
<tr><td><b>Pending</b></td><td>Waiting on the requester. Goes back to Open when they reply</td></tr>
<tr><td><b>On-hold</b></td><td>Waiting on a third party or another team</td></tr>
<tr><td><b>Solved</b></td><td>Believed fixed. The requester can reopen it for a while</td></tr>
<tr><td><b>Closed</b></td><td>Locked by the system after Solved</td></tr></tbody></table>
<h4>Business rules</h4><table class="tbl compact"><tbody>
<tr><td><b>Trigger</b></td><td>Runs when a ticket is created or updated: acknowledgements, routing, notifications</td></tr>
<tr><td><b>Automation</b></td><td>Runs on a schedule, about hourly: Pending reminders, auto-solve, stale tickets</td></tr>
<tr><td><b>Macro</b></td><td>An agent clicks it: a canned reply plus field changes</td></tr>
<tr><td><b>View</b></td><td>A saved filter: an agent's queue</td></tr>
<tr><td><b>SLA policy</b></td><td>Measures first-reply and resolution targets</td></tr></tbody></table>
<h4>HTTP status codes</h4><table class="tbl compact"><tbody>
<tr><td><b>401</b></td><td>Not signed in: bad or expired credentials</td></tr>
<tr><td><b>403</b></td><td>Signed in, but not allowed</td></tr>
<tr><td><b>404</b></td><td>Not found</td></tr>
<tr><td><b>429</b></td><td>Too many requests: back off and retry</td></tr>
<tr><td><b>500</b></td><td>Server error</td></tr>
<tr><td><b>502</b></td><td>Bad gateway: the server behind it answered badly</td></tr>
<tr><td><b>503</b></td><td>Unavailable or throttled</td></tr>
<tr><td><b>504</b></td><td>Gateway timeout: the server behind it was too slow</td></tr></tbody></table>`;
