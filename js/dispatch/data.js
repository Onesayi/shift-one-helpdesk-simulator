// World data for the Service Coordinator mode: the fictional MSP "Northbound IT",
// its technicians, its client companies and the dispatch playbook.
// Times are minutes from Thursday 00:00 (480 = Thu 08:00, 1440 + 480 = Fri 08:00).

const DAY = 1440;
const SHIFT_START = 480;  // 08:00
const SHIFT_END = 1020;   // 17:00
const TRAVEL_MIN = 30;    // every onsite visit gets a travel block before it

const SKILLS = ['M365', 'Windows', 'Mac', 'Printers', 'Hardware', 'Network', 'Firewall', 'Servers', 'Backup', 'Security', 'Onboarding'];
const BOARDS = ['Help Desk', 'Infrastructure', 'Field Services', 'Security', 'Projects & Onboarding'];
const IMPACTS = ['One user', 'Several users or a VIP', 'Whole site or business'];
const URGENCIES = ['Low: can keep working', 'Medium: slowed down', 'High: can\'t work, or deadline today'];
// Suggested priority = MATRIX[impact][urgency]
const MATRIX = [['P4', 'P3', 'P3'], ['P4', 'P3', 'P2'], ['P3', 'P2', 'P1']];
const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];
const ESTIMATES = [15, 30, 45, 60, 90, 120];

// First-response targets in minutes, by agreement
const SLA = {
  premium: { P1: 15, P2: 30, P3: 60, P4: 240 },
  standard: { P1: 30, P2: 60, P3: 120, P4: 480 },
  block: { P1: 60, P2: 120, P3: 240, P4: 480 },
};

const TECHS = {
  sipho: {
    name: 'Sipho Dlamini', role: 'Tier 3 · Network engineer', skills: ['Network', 'Firewall', 'Servers'], onsite: false,
    start: 480, end: 840,
    note: 'Works remotely from Cape Town, so his day ends at 14:00 our time. The only engineer Harbor Dental allows on their firewall.',
  },
  maya: {
    name: 'Maya Chen', role: 'Tier 2 · Systems engineer', skills: ['M365', 'Windows', 'Servers', 'Backup', 'Security'], onsite: false,
    start: 480, end: 1020,
    note: 'Our security lead. Spends Thursday afternoons on the Keller & Finch server migration project.',
  },
  ana: {
    name: 'Ana Ribeiro', role: 'Tier 1 · Service desk', skills: ['M365', 'Windows', 'Mac', 'Printers', 'Onboarding'], onsite: false,
    start: 480, end: 1020,
    note: 'Runs most new-starter setups. Happy on Macs.',
  },
  ben: {
    name: 'Ben Carter', role: 'Tier 1 · Service desk', skills: ['M365', 'Windows', 'Mac', 'Printers'], onsite: false,
    start: 480, end: 1020,
    note: 'Picked up two of yesterday\'s tickets for today.',
  },
  luis: {
    name: 'Luis Romero', role: 'Field technician', skills: ['Hardware', 'Printers', 'Network', 'Windows'], onsite: true,
    start: 480, end: 1020,
    note: 'Our only field tech. Drives between sites, so every visit needs travel time.',
  },
};

// Calendar blocks that exist before the shift starts. soft = can be bumped for urgent work (at a cost).
function baseBlocks() {
  const b = [];
  for (const d of [0, DAY]) {
    b.push({ tech: 'maya', start: d + 570, dur: 30, kind: 'meeting', label: 'Team stand-up', soft: true });
    b.push({ tech: 'maya', start: d + 720, dur: 30, kind: 'lunch', label: 'Lunch', soft: true });
    b.push({ tech: 'ana', start: d + 750, dur: 30, kind: 'lunch', label: 'Lunch', soft: true });
    b.push({ tech: 'ben', start: d + 720, dur: 30, kind: 'lunch', label: 'Lunch', soft: true });
    b.push({ tech: 'luis', start: d + 780, dur: 30, kind: 'lunch', label: 'Lunch', soft: true });
  }
  b.push({ tech: 'maya', start: 840, dur: 120, kind: 'project', label: 'Project: KFL server migration', soft: true });
  b.push({ tech: 'ana', start: 900, dur: 60, kind: 'meeting', label: 'Training: Intune', soft: true });
  b.push({ tech: 'luis', start: 480, dur: 30, kind: 'travel', label: 'Travel', soft: false });
  b.push({ tech: 'luis', start: 510, dur: 90, kind: 'job', label: 'Brightline: dock swap (booked yesterday)', soft: false });
  return b;
}

// Events that happen to the team during the shift
const TEAM_EVENTS = [
  { at: 585, window: [555, 630], tech: 'ben', text: 'Ben Carter: "Sorry, I\'ve been sick all morning. I\'m heading home, and the doctor has signed me off until Monday."' },
];

const INTERNAL = {
  sm: { name: 'Dana Whitaker', role: 'Service Manager' },
  am: { name: 'Rob Hale', role: 'Account Manager' },
};

const CLIENTS = {
  hdg: {
    name: 'Harbor Dental Group', agreement: 'Premium managed', sla: 'premium',
    sites: 'Downtown, Northside and Eastgate clinics',
    contacts: {
      areyes: { name: 'Dr. Amara Reyes', role: 'Owner & lead dentist', auth: true, vip: true },
      lpark: { name: 'Lena Park', role: 'Practice manager', auth: true },
      jfox: { name: 'Jamie Fox', role: 'Front desk, Downtown', auth: false },
    },
    notes: [
      'Onsite visits only 12:00–13:00 (clinic lunch) or after 17:00, unless it\'s a P1. Patients are in the chairs the rest of the day.',
      'Firewall and network changes: Sipho Dlamini only. The client asked for one named engineer after an outage last year.',
      'Patient data lives on HDG-DC01. A failed backup is never "just an alert".',
    ],
    onsite: [[720, 780]], onsiteText: '12:00–13:00',
    vendors: ['Comcast Business (ISP)', 'Dell (hardware warranty)', 'Microsoft'],
  },
  kfl: {
    name: 'Keller & Finch LLP', agreement: 'Premium managed', sla: 'premium',
    sites: 'One office, downtown',
    contacts: {
      tkeller: { name: 'Tom Keller', role: 'Managing partner', auth: true, vip: true },
      msantos: { name: 'Maria Santos', role: 'Office manager (IT contact)', auth: true },
      jmorrow: { name: 'Jake Morrow', role: 'Paralegal', auth: false },
    },
    notes: [
      'Access to shares, new users and mailbox changes need approval from Maria Santos or a partner. Ask them directly, never through the requester.',
      'Their email domain is kellerfinch.com. Watch for lookalike domains.',
      'Client matters are confidential. Don\'t discuss one person\'s request with another staff member.',
      'The office copier is leased from Ricoh, and Ricoh services it under the lease. Copier faults go to Ricoh, not to our technicians.',
    ],
    onsite: [[480, 1020]], onsiteText: 'office hours',
    vendors: ['Spectrum Business (ISP)', 'Lenovo (hardware warranty)', 'Ricoh (copier lease)', 'Microsoft'],
  },
  bl: {
    name: 'Brightline Logistics', agreement: 'Standard, co-managed', sla: 'standard',
    sites: 'HQ (4 floors), Denver office, warehouse',
    contacts: {
      bldesk: { name: 'Brightline IT Service Desk', role: 'Client\'s own Tier 1 desk', auth: true, greet: 'Brightline team' },
      dokafor: { name: 'Daniel Okafor', role: 'CFO (owns the IT budget)', auth: true, vip: true },
    },
    notes: [
      'Co-managed: Brightline runs its own Tier 1 service desk. When they escalate, the basics are already done. Don\'t bounce it back to Tier 1.',
      'We look after their servers (DC01, FS01, PRINT01) and core network.',
    ],
    onsite: [[480, 1020]], onsiteText: 'office hours',
    vendors: ['AT&T Business (ISP)', 'Dell (hardware warranty)', 'Microsoft'],
  },
  oak: {
    name: 'Oakridge Montessori School', agreement: 'Standard managed', sla: 'standard',
    sites: 'One campus, north side',
    contacts: {
      hmoore: { name: 'Helen Moore', role: 'Principal', auth: true, vip: true },
      cjensen: { name: 'Carl Jensen', role: 'Office administrator', auth: true },
      lrivera: { name: 'Lucia Rivera', role: 'Teacher, Room 4', auth: false },
      kosei: { name: 'Kwame Osei', role: 'Teacher, Room 7', auth: false },
      alindgren: { name: 'Anna Lindgren', role: 'Teacher, east wing', auth: false },
    },
    notes: [
      'School hours 07:30–15:30. No onsite visits 11:30–12:30 (lunch and recess). Sign in at the front office.',
      'OAK-LAB-VM01 to VM04 are classroom lab VMs that shut down every night. "Offline" alerts for them are expected: close as no action needed.',
      'The school office pays for Microsoft 365 by card. Renewals have lapsed before.',
    ],
    onsite: [[450, 690], [750, 930]], onsiteText: '07:30–11:30 and 12:30–15:30',
    vendors: ['Verizon Fios (ISP)', 'Epson (projector warranty)', 'Microsoft'],
  },
  pp: {
    name: 'Pixel & Pine Studio', agreement: 'Block hours (prepaid)', sla: 'block', block: 0.5,
    sites: 'Studio loft, arts district',
    contacts: {
      jalvarez: { name: 'Jess Alvarez', role: 'Owner', auth: true, vip: true },
      rkaur: { name: 'Rhea Kaur', role: 'Designer', auth: false },
    },
    notes: [
      'No managed agreement: they buy prepaid blocks of hours.',
      'If the estimate is more than the hours left, get Account Manager approval (a top-up) before any non-emergency work.',
      'All Macs.',
      'Theo Grant (designer) is on leave until the 20th. His MacBook, PP-MBP-03, is switched off at home.',
    ],
    onsite: [[540, 1020]], onsiteText: '09:00–17:00',
    vendors: ['Apple (AppleCare)', 'Comcast Business (ISP)'],
  },
};

const PLAYBOOK = [
  { id: 'PB-01', title: 'Setting priority', tags: 'priority impact urgency matrix p1 p2 p3 p4 vip', body: `
<p>Priority comes from <b>impact</b> (how many people) and <b>urgency</b> (how badly it stops them). Set it from the facts, not from how loud the caller is.</p>
<table class="tbl compact"><thead><tr><th>Impact \\ Urgency</th><th>Low</th><th>Medium</th><th>High</th></tr></thead><tbody>
<tr><td><b>Whole site or business</b></td><td>P3</td><td>P2</td><td>P1</td></tr>
<tr><td><b>Several users or a VIP</b></td><td>P4</td><td>P3</td><td>P2</td></tr>
<tr><td><b>One user</b></td><td>P4</td><td>P3</td><td>P3</td></tr></tbody></table>
<h4>Overrides</h4><ul>
<li><b>Suspected compromised credentials</b> (someone typed a password into a fake page): always <b>P1</b> on the Security board.</li>
<li><b>Two backup failures in a row</b> on a server with client data: <b>P2</b> at least.</li>
<li>Planned requests (new starters, installs next week) are <b>P4</b>. Planned doesn't mean unimportant, it means scheduled.</li></ul>` },
  { id: 'PB-02', title: 'Response SLAs and client updates', tags: 'sla response first acknowledge update cadence', body: `
<p>The SLA clock starts when the ticket arrives and stops at our <b>first human response</b>: answering the call, or a message to the client. Auto-replies don't count.</p>
<table class="tbl compact"><thead><tr><th>Agreement</th><th>P1</th><th>P2</th><th>P3</th><th>P4</th></tr></thead><tbody>
<tr><td>Premium</td><td>15 min</td><td>30 min</td><td>1 h</td><td>4 h</td></tr>
<tr><td>Standard</td><td>30 min</td><td>1 h</td><td>2 h</td><td>8 h</td></tr>
<tr><td>Block hours</td><td>1 h</td><td>2 h</td><td>4 h</td><td>8 h</td></tr></tbody></table>
<ul><li><b>P1s: update the client at least every 30 minutes</b>, even if the update is "still waiting on the ISP".</li>
<li>When an appointment moves, tell the client before they notice.</li>
<li>If a client has to chase us, we've already failed that ticket.</li></ul>` },
  { id: 'PB-03', title: 'Boards and routing', tags: 'board routing skills tier help desk infrastructure field security projects', body: `
<ul><li><b>Help Desk</b>: one user or a few users, fixable remotely. Tier 1 first.</li>
<li><b>Infrastructure</b>: servers, backups, firewalls, internet circuits and monitoring alerts that need work.</li>
<li><b>Field Services</b>: anything that needs hands on hardware. Only Luis goes onsite.</li>
<li><b>Security</b>: phishing, compromised accounts, impersonation. Maya handles these.</li>
<li><b>Projects & Onboarding</b>: new starters and planned work.</li></ul>
<p>Match the <b>skill</b> to the technician (see Team). A ticket sent to the wrong person comes back to you, and the client has waited for nothing.</p>
<p>Always check the client's notes before you dispatch. Some clients name the engineer they allow on certain systems.</p>` },
  { id: 'PB-04', title: 'Scheduling rules', tags: 'schedule dispatch board calendar travel lunch bump double book sick onsite window', body: `
<ol><li><b>Never double-book.</b> Move the other appointment first.</li>
<li><b>Onsite visits need 30 minutes of travel</b> before them. The board adds it for you; it has to fit too.</li>
<li><b>Respect each client's onsite windows</b> (see Clients). Harbor Dental patients are in the chair; Oakridge children are at lunch.</li>
<li><b>Project time and meetings can be bumped for P1 and P2 work only.</b> Don't eat into a tech's lunch unless it's a P1.</li>
<li><b>When a tech goes home sick, re-home every appointment they had left</b> and tell those clients.</li>
<li>Planned work (like a Monday new starter) can go on tomorrow's board. Keep today for today's problems.</li></ol>` },
  { id: 'PB-05', title: 'Approvals and authorized contacts', tags: 'approval authorized contact access share mailbox forwarding verify impersonation', body: `
<p>Each client lists who can approve changes (<b>✓ Authorized</b> in Clients). Access to shared folders, new users, mailbox forwarding and admin rights all need that approval.</p>
<ol><li>Ask the authorized contact <b>directly</b>, using "Request approval". Never let the requester approve their own request.</li>
<li>Don't dispatch until the approval arrives. If it's declined, tell the requester and close the ticket as <b>Declined by client</b>.</li>
<li>Unusual requests from a VIP (forward all my mail, send money, reset my MFA) get verified through a <b>known contact</b> first. Check the sender's domain.</li></ol>` },
  { id: 'PB-06', title: 'Monitoring alerts', tags: 'alert rmm noise disk backup offline heartbeat', body: `
<p>Alerts from our RMM land on the board automatically. For each one, decide: <b>actionable</b> or <b>noise</b>.</p>
<ul><li>Check the client notes first. Some devices are expected to go offline (lab VMs, laptops that go home).</li>
<li>Noise: close as <b>No action needed</b>, with a note saying why. Don't send a tech.</li>
<li>Disk space above 90% on a server: P3, Infrastructure. Fix it before it hits 100%.</li>
<li>Backups: one failure, watch it. <b>Two in a row: P2</b>, Infrastructure, fix it today.</li></ul>` },
  { id: 'PB-07', title: 'Block hours and billing', tags: 'block hours billing account manager top up quote prepaid', body: `
<p>Block-hours clients prepay for time. Before you schedule work, compare the <b>estimate</b> to the <b>hours left</b> (Clients page).</p>
<ul><li>Enough hours: schedule as normal.</li>
<li>Not enough: <b>escalate to the Account Manager</b> first. They'll call the client about a top-up. Don't dispatch until they say go.</li>
<li>Work done without approval is usually written off, and the client is surprised by the bill.</li></ul>` },
  { id: 'PB-08', title: 'Vendors, ISPs and RMAs', tags: 'vendor isp rma warranty case eta dell comcast', body: `
<ul><li>When a tech says the fault is with a vendor (ISP, hardware warranty), <b>you</b> open the vendor case with "Log vendor case". The tech keeps working the problem.</li>
<li>Pass the vendor's reference and ETA to the client straight away with a status update.</li>
<li>When an RMA part arrives, schedule the install inside the client's onsite window and send them an appointment confirmation.</li>
<li>Equipment that's leased or under a service contract (a client's copier, say) goes straight to that vendor. Our techs don't touch it, and the client hears the vendor's ETA from you.</li>
<li>Provider notices (planned maintenance, outages elsewhere) need no tech. Pass them on to the client and close as <b>No action needed</b>.</li></ul>` },
  { id: 'PB-09', title: 'Duplicates and major incidents', tags: 'duplicate merge parent child major incident service manager p1', body: `
<ul><li>Several people reporting the same fault is <b>one incident</b>. Pick one ticket as the parent and <b>merge</b> the rest into it. One tech, one fix, one set of updates.</li>
<li>Raise the parent's priority to match the real impact.</li>
<li><b>Notify the Service Manager for every P1</b> and for security incidents. Don't page them for routine tickets.</li></ul>` },
  { id: 'PB-10', title: 'Closing tickets', tags: 'close resolved confirm noise declined', body: `
<ol><li>When the tech marks the work <b>Completed</b>, send the client a <b>resolution confirmation</b>.</li>
<li>Close with the right reason: <b>Resolved</b>, <b>No action needed</b> (noise), or <b>Declined by client</b>.</li>
<li>Write a note the next person can use. "Done" isn't a note.</li>
<li>Never tell a client it's fixed before the tech says so.</li></ol>` },
];
