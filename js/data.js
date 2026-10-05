// World data for the fictional company "Brightline Logistics".
// Everything here is the *starting* state; the engine deep-clones it each shift.

const TIME_ZONES = [
  'Eastern Standard Time',
  'Central Standard Time',
  'Mountain Standard Time',
  'Pacific Standard Time',
  'GMT Standard Time',
  'UTC',
];

const CATEGORIES = [
  'Account & Access',
  'Hardware & Printing',
  'Software',
  'Network',
  'Security',
  'Email',
  'Server & Storage',
];

const ESCALATION_TEAMS = ['Security', 'Network Engineering', 'Server Team', 'Desktop Support (Tier 2)'];

const GROUPS = {
  'All-Staff': 'Everyone in the company. Intranet and company-wide mail lists.',
  'FS-Finance-RW': 'Read/write on \\\\FS01\\Finance',
  'FS-Finance-RO': 'Read-only on \\\\FS01\\Finance',
  'Finance-Managers': 'Approvers for finance workflows. Payroll folder access.',
  'FS-Marketing-RW': 'Read/write on \\\\FS01\\Marketing',
  'FS-HR-RW': 'Read/write on \\\\FS01\\HR (confidential)',
  'Sales-Team': 'Sales mailing list and CRM access',
  'Warehouse-Team': 'Warehouse scanners and shift rota',
  'VPN-Users': 'Allowed to connect with GlobalProtect VPN',
  'Print-Floor2': 'Printers on HQ floor 2',
  'Domain Admins': 'Full administrative control of every server and workstation in the domain.',
  'Workstation-Admins': 'Local administrator on every workstation. Members can install anything and switch off security tools.',
};

// Membership in these is never granted by the service desk.
const ADMIN_GROUPS = ['Domain Admins', 'Workstation-Admins'];

function baseApps() {
  return [
    { name: 'Microsoft 365 Apps for enterprise', publisher: 'Microsoft Corporation', installed: '2025-02-11', essential: true },
    { name: 'Microsoft Teams', publisher: 'Microsoft Corporation', installed: '2025-02-11', essential: true },
    { name: 'Google Chrome', publisher: 'Google LLC', installed: '2025-03-04' },
    { name: 'Adobe Acrobat Reader', publisher: 'Adobe Inc.', installed: '2025-03-04' },
    { name: 'GlobalProtect VPN', publisher: 'Palo Alto Networks', installed: '2025-02-11', essential: true },
    { name: 'Endpoint Protection Agent', publisher: 'Brightline IT Security', installed: '2025-02-11', essential: true, critical: true },
    { name: 'Dell Command | Update', publisher: 'Dell Inc.', installed: '2025-02-11' },
  ];
}

function baseServices() {
  return [
    { name: 'Spooler', display: 'Print Spooler', status: 'Running' },
    { name: 'Dnscache', display: 'DNS Client', status: 'Running', core: true },
    { name: 'Dhcp', display: 'DHCP Client', status: 'Running', core: true },
    { name: 'W32Time', display: 'Windows Time', status: 'Running' },
    { name: 'wuauserv', display: 'Windows Update', status: 'Running' },
    { name: 'WinDefend', display: 'Microsoft Defender Antivirus', status: 'Running', core: true },
  ];
}

function baseProcs() {
  return ['System', 'svchost.exe', 'explorer.exe', 'lsass.exe', 'chrome.exe', 'ms-teams.exe', 'OUTLOOK.EXE', 'epagent.exe'];
}

function device(id, owner, type, model, ip, extra = {}) {
  return Object.assign({
    id, owner, type, model,
    os: 'Windows 11 Pro 23H2',
    ip, mask: '255.255.255.0', gateway: ip.split('.').slice(0, 3).join('.') + '.1',
    dnsMode: 'dhcp', dnsManual: ['', ''],
    tz: 'Eastern Standard Time',
    online: true,
    uptime: '2 days, 4 hours',
    apps: baseApps(),
    services: baseServices(),
    procs: baseProcs(),
  }, extra);
}

function user(id, first, last, o) {
  return Object.assign({
    id, first, last, display: `${first} ${last}`,
    email: `${id}@brightline.com`,
    locked: false, disabled: false, pwdExpired: false,
    mfa: 'Enrolled', failedLogins: 0,
    lastLogin: 'Today 08:12',
    groups: ['All-Staff'],
    devices: [],
    location: 'HQ',
    lockoutSource: '',   // shown on the Authentication tab
    history: [],         // "Recent changes" audit entries on the Profile tab
    signins: [],         // recent sign-ins on the Authentication tab
  }, o);
}

const WORLD = {
  company: 'Brightline Logistics',
  domain: 'brightline.local',
  outageUntil: 0,
  users: {
    pnair: user('pnair', 'Priya', 'Nair', { empId: 'EMP-1024', title: 'Accountant', dept: 'Finance', manager: 'tbecker', phone: 'ext. 4102', location: 'HQ Floor 3', locked: true, failedLogins: 5, lastLogin: 'Yesterday 17:42', groups: ['All-Staff', 'FS-Finance-RW', 'VPN-Users'], devices: ['BL-LT-1042'] }),
    jmorales: user('jmorales', 'Jordan', 'Morales', { empId: 'EMP-1311', title: 'Financial Analyst', dept: 'Finance', manager: 'tbecker', phone: 'ext. 4117', location: 'HQ Floor 3', lastLogin: 'Today 08:31', devices: ['BL-LT-1051'] }),
    tbecker: user('tbecker', 'Tom', 'Becker', { empId: 'EMP-0877', title: 'Finance Manager', dept: 'Finance', manager: 'dokafor', phone: 'ext. 4100', location: 'HQ Floor 3', groups: ['All-Staff', 'FS-Finance-RW', 'Finance-Managers', 'VPN-Users'], devices: ['BL-LT-0990'] }),
    dokafor: user('dokafor', 'Daniel', 'Okafor', { empId: 'EMP-0102', title: 'Chief Financial Officer', dept: 'Executive', manager: '', phone: 'ext. 4001', location: 'HQ Floor 4', lastLogin: 'Today 07:55', groups: ['All-Staff', 'FS-Finance-RW', 'Finance-Managers', 'VPN-Users'], devices: ['BL-LT-0101'] }),
    hkowalski: user('hkowalski', 'Hana', 'Kowalski', { empId: 'EMP-1190', title: 'Marketing Coordinator', dept: 'Marketing', manager: 'gfoster', phone: 'ext. 4230', location: 'HQ Floor 2', groups: ['All-Staff', 'FS-Marketing-RW', 'Print-Floor2'], devices: ['BL-LT-1077'] }),
    gfoster: user('gfoster', 'Grace', 'Foster', { empId: 'EMP-0655', title: 'Marketing Manager', dept: 'Marketing', manager: '', phone: 'ext. 4200', location: 'HQ Floor 2', groups: ['All-Staff', 'FS-Marketing-RW', 'Print-Floor2'], devices: ['BL-LT-0660'] }),
    rpatel: user('rpatel', 'Ravi', 'Patel', { empId: 'EMP-1142', title: 'Account Executive', dept: 'Sales', manager: '', phone: 'ext. 4310', location: 'HQ Floor 1', groups: ['All-Staff', 'Sales-Team', 'VPN-Users'], devices: ['BL-LT-1033'] }),
    sortiz: user('sortiz', 'Samuel', 'Ortiz', { empId: 'EMP-1208', title: 'Operations Planner', dept: 'Operations', manager: '', phone: 'ext. 7120', location: 'Denver Office', groups: ['All-Staff', 'VPN-Users'], devices: ['BL-DT-2210'] }),
    akim: user('akim', 'Alex', 'Kim', { empId: 'EMP-0931', title: 'Warehouse Supervisor', dept: 'Warehouse', manager: '', phone: 'ext. 5502', location: 'Warehouse Office', groups: ['All-Staff', 'Warehouse-Team'], devices: ['BL-DT-2304'] }),
    badeyemi: user('badeyemi', 'Bola', 'Adeyemi', { empId: 'EMP-0720', title: 'HR Generalist', dept: 'Human Resources', manager: '', phone: 'ext. 4250', location: 'HQ Floor 2', groups: ['All-Staff', 'FS-HR-RW', 'Print-Floor2'], devices: ['BL-LT-0721'] }),
    mwebb: user('mwebb', 'Marcus', 'Webb', { empId: 'EMP-0544', title: 'Facilities Coordinator', dept: 'Facilities', manager: '', phone: 'ext. 4020', location: 'HQ Floor 1', devices: ['BL-LT-0545'] }),
    nlindqvist: user('nlindqvist', 'Nora', 'Lindqvist', { empId: 'EMP-1256', title: 'Customer Service Agent', dept: 'Customer Service', manager: '', phone: 'ext. 4410', location: 'HQ Floor 1', groups: ['All-Staff'], devices: ['BL-DT-2150'] }),
    kdoyle: user('kdoyle', 'Kevin', 'Doyle', { empId: 'EMP-1187', title: 'Sales Representative', dept: 'Sales', manager: '', phone: 'ext. 4322', location: 'HQ Floor 1', groups: ['All-Staff', 'Sales-Team', 'VPN-Users'], devices: ['BL-LT-1188'] }),
    kdoyle2: user('kdoyle2', 'Kevin', 'Doyle', { empId: 'EMP-1302', title: 'Forklift Operator', dept: 'Warehouse', manager: 'akim', phone: 'ext. 5519', location: 'Warehouse', email: 'kevin.doyle@brightline.com', groups: ['All-Staff', 'Warehouse-Team'], devices: [] }),
    cnguyen: user('cnguyen', 'Chris', 'Nguyen', { empId: 'EMP-0998', title: 'Sales Manager', dept: 'Sales', manager: '', phone: 'ext. 4305', location: 'HQ Floor 1', groups: ['All-Staff', 'Sales-Team', 'VPN-Users'], devices: ['BL-LT-1201'] }),
    tnakamura: user('tnakamura', 'Tara', 'Nakamura', { empId: 'EMP-1275', title: 'Payroll Specialist', dept: 'Finance', manager: 'tbecker', phone: 'ext. 4125', location: 'HQ Floor 3', groups: ['All-Staff', 'FS-Finance-RW'], devices: ['BL-LT-1202'] }),
    ndlamini: user('ndlamini', 'Nandi', 'Dlamini', { empId: 'EMP-1318', title: 'Talent Acquisition Partner', dept: 'Human Resources', manager: 'badeyemi', phone: 'ext. 4262', location: 'Remote (works from home)', groups: ['All-Staff', 'FS-HR-RW', 'VPN-Users'], devices: ['BL-LT-1120'] }),
    mreyes: user('mreyes', 'Maya', 'Reyes', { empId: 'EMP-1066', title: 'Office Manager', dept: 'Operations', manager: '', phone: 'ext. 7101', location: 'Denver Office', groups: ['All-Staff'], devices: ['BL-DT-2212'] }),
  },
  devices: {
    'BL-LT-1042': device('BL-LT-1042', 'pnair', 'Laptop', 'Dell Latitude 5440', '10.20.3.42'),
    'BL-LT-1051': device('BL-LT-1051', 'jmorales', 'Laptop', 'Dell Latitude 5440', '10.20.3.51'),
    'BL-LT-1033': device('BL-LT-1033', 'rpatel', 'Laptop', 'Dell Latitude 7440', '10.20.1.33', {
      apps: baseApps().concat([
        { name: 'DealFinder Pro', publisher: 'DF Media Ltd', installed: '2 days ago', adware: true },
        { name: 'QuickSearch Toolbar', publisher: '(unknown)', installed: '2 days ago', adware: true },
        { name: 'Free PDF Merge', publisher: 'PDFTools Online', installed: '2 days ago' },
      ]),
      procs: baseProcs().concat(['dealfinder.exe', 'qsupdate.exe']),
    }),
    'BL-DT-2210': device('BL-DT-2210', 'sortiz', 'Desktop', 'Dell OptiPlex 7010', '10.40.1.10', { tz: 'Pacific Standard Time' }),
    'BL-DT-2304': device('BL-DT-2304', 'akim', 'Desktop', 'Dell OptiPlex 7010', '10.30.1.4', { dnsMode: 'manual', dnsManual: ['8.8.8.8', '8.8.4.4'] }),
    'BL-LT-1077': device('BL-LT-1077', 'hkowalski', 'Laptop', 'Dell Latitude 5440', '10.20.2.77'),
    'BL-LT-0721': device('BL-LT-0721', 'badeyemi', 'Laptop', 'Dell Latitude 5440', '10.20.2.21'),
    'BL-LT-0545': device('BL-LT-0545', 'mwebb', 'Laptop', 'Dell Latitude 5440', '10.20.1.45'),
    'BL-DT-2150': device('BL-DT-2150', 'nlindqvist', 'Desktop', 'Dell OptiPlex 7010', '10.20.1.150'),
    'BL-LT-1188': device('BL-LT-1188', 'kdoyle', 'Laptop', 'Dell Latitude 5440', '10.20.1.88'),
    'BL-LT-0990': device('BL-LT-0990', 'tbecker', 'Laptop', 'Dell Latitude 7440', '10.20.3.90'),
    'BL-LT-0101': device('BL-LT-0101', 'dokafor', 'Laptop', 'Dell Latitude 9440', '10.20.4.11'),
    'BL-LT-0660': device('BL-LT-0660', 'gfoster', 'Laptop', 'Dell Latitude 5440', '10.20.2.60'),
    'BL-LT-1201': device('BL-LT-1201', 'cnguyen', 'Laptop', 'Dell Latitude 7440', '10.20.1.21'),
    'BL-LT-1202': device('BL-LT-1202', 'tnakamura', 'Laptop', 'Dell Latitude 5440', '10.20.3.22'),
    'BL-LT-1120': device('BL-LT-1120', 'ndlamini', 'Laptop', 'Dell Latitude 5440', '10.99.0.20'),
    'BL-DT-2212': device('BL-DT-2212', 'mreyes', 'Desktop', 'Dell OptiPlex 7010', '10.40.1.12', { tz: 'Mountain Standard Time' }),
  },
  network: [
    { id: 'FW-01', type: 'Firewall', location: 'Server Room A', status: 'online', role: 'core', note: 'Internet edge' },
    { id: 'CORE-RTR-01', type: 'Router', location: 'Server Room A', status: 'online', role: 'core', note: 'Routes between all floors and sites' },
    { id: 'CORE-SW-01', type: 'Core Switch', location: 'Server Room A', status: 'online', role: 'core', note: 'Every floor switch uplinks here' },
    { id: 'FL1-SW-01', type: 'Floor Switch', location: 'HQ Floor 1 closet', status: 'online', role: 'floor', note: 'Floor 1 + cafeteria. PoE for APs.' },
    { id: 'FL2-SW-01', type: 'Floor Switch', location: 'HQ Floor 2 closet', status: 'online', role: 'floor', note: 'Floor 2. PoE for APs.' },
    { id: 'FL3-SW-01', type: 'Floor Switch', location: 'HQ Floor 3 closet', status: 'online', role: 'floor', note: 'Floor 3. PoE for APs.' },
    { id: 'WAN-DEN-01', type: 'WAN circuit', location: 'HQ ↔ Denver Office', status: 'online', role: 'wan', note: 'Carrier-managed fibre circuit. Lumenline Fiber, circuit LF-88213-DEN.' },
    { id: 'AP-FL1-01', type: 'Access Point', location: 'HQ Floor 1 open office', status: 'online', role: 'ap', uplink: 'FL1-SW-01 port 22', clients: 38 },
    { id: 'AP-CAFE-01', type: 'Access Point', location: 'Cafeteria (Floor 1)', status: 'offline', role: 'ap', uplink: 'FL1-SW-01 port 24', clients: 0 },
    { id: 'AP-FL2-01', type: 'Access Point', location: 'HQ Floor 2', status: 'online', role: 'ap', uplink: 'FL2-SW-01 port 22', clients: 41 },
    { id: 'AP-FL3-01', type: 'Access Point', location: 'HQ Floor 3', status: 'online', role: 'ap', uplink: 'FL3-SW-01 port 22', clients: 29 },
  ],
  servers: {
    DC01: { role: 'Domain Controller + DNS', ip: '10.20.0.10', cpu: 22, mem: 58, disk: 41, services: [
      { name: 'NTDS', display: 'Active Directory Domain Services', status: 'Running', critical: true },
      { name: 'DNS', display: 'DNS Server', status: 'Running', critical: true },
      { name: 'Netlogon', display: 'Netlogon', status: 'Running', critical: true },
    ] },
    FS01: { role: 'File Server', ip: '10.20.0.20', cpu: 31, mem: 62, disk: 78, services: [
      { name: 'LanmanServer', display: 'Server (SMB file sharing)', status: 'Running', critical: true },
      { name: 'DFSR', display: 'DFS Replication', status: 'Running' },
    ] },
    PRINT01: { role: 'Print Server', ip: '10.20.0.30', cpu: 3, mem: 34, disk: 55, queued: 23, services: [
      { name: 'Spooler', display: 'Print Spooler', status: 'Stopped' },
      { name: 'LanmanServer', display: 'Server (SMB file sharing)', status: 'Running' },
    ], events: ['Error 7034: The Print Spooler service terminated unexpectedly. It has done this 1 time(s).'] },
    APP01: { role: 'Intranet web server', ip: '10.20.0.40', cpu: 18, mem: 47, disk: 36, services: [
      { name: 'W3SVC', display: 'World Wide Web Publishing Service', status: 'Running' },
    ] },
  },
};

// Hostnames the simulated DNS knows about.
const HOSTS = {
  internal: {
    'dc01': '10.20.0.10', 'fs01': '10.20.0.20', 'print01': '10.20.0.30', 'app01': '10.20.0.40', 'intranet': '10.20.0.40',
  },
  external: {
    'google.com': '142.250.72.14', 'microsoft.com': '20.70.246.20', 'bing.com': '13.107.21.200', 'dns.google': '8.8.8.8',
  },
};

const KB = [
  { id: 'KB-101', title: 'Account lockouts and identity verification', tags: 'password unlock locked verify identity', body: `
<p>Accounts lock after <b>5 failed sign-ins</b> and stay locked until someone at the desk unlocks them.</p>
<h4>Before you change anything</h4>
<ol><li>Verify the caller: send a verification code to their <b>registered</b> mobile from Directory → Authentication and have them read it back.</li>
<li>Never verify with information an attacker could find (job title, manager, employee ID).</li></ol>
<h4>Then</h4>
<ol><li>Ask if they know their password. Most lockouts are caps lock or an old password saved on a phone.</li>
<li>If they know it: <b>unlock only</b>. If they don't: reset with "must change at next sign-in" ticked.</li></ol>` },
  { id: 'KB-102', title: 'Granting access to a shared folder', tags: 'file share group access permission finance', body: `
<p>Access to <code>\\\\FS01</code> folders is controlled by security groups. Never grant permissions to an individual account.</p>
<ol><li>Get <b>written approval from the data owner</b> (usually the requester's manager). Put it in the ticket.</li>
<li>Add the user to the matching <code>FS-&lt;Dept&gt;-RW</code> or <code>-RO</code> group. Choose the least access that does the job.</li>
<li>Never add anyone to admin or manager groups to "make it work".</li>
<li>The user needs to sign out and back in (or lock and unlock) to get the new membership.</li></ol>` },
  { id: 'KB-103', title: 'Legal name changes', tags: 'name change marriage email alias', body: `
<p>A name change needs an HR case reference. With that:</p>
<ol><li>Directory → Profile → Edit name &amp; email.</li>
<li>Update first/last name, display name and primary email (<code>firstinitial+lastname@brightline.com</code>).</li>
<li>The old address stays as an alias automatically, so mail sent to it still arrives.</li></ol>` },
  { id: 'KB-104', title: 'Offboarding a leaver', tags: 'termination leaver disable offboard', body: `
<ol><li>Confirm the request came from HR and <b>match the employee ID</b>. Names are not unique.</li>
<li><b>Disable</b> the account. Do not delete it; mailbox and file retention depend on it.</li>
<li>Sign out all active sessions.</li>
<li>Remove all group memberships.</li></ol>` },
  { id: 'KB-201', title: 'Printing problems: one user or many?', tags: 'printer print spooler queue', body: `
<p>First question: <b>is it just you?</b></p>
<ul><li><b>One user:</b> check their PC. Restart the local Print Spooler and look for stuck jobs.</li>
<li><b>Many users / a whole floor:</b> the problem is shared. Check the print server (<code>PRINT01</code>) in the Server Room. A stopped Print Spooler there stops printing for everyone.</li></ul>` },
  { id: 'KB-202', title: 'Wi-Fi access point down', tags: 'wifi wireless ap access point poe', body: `
<ol><li>Server Room → Network: find the AP for the area and check its status.</li>
<li>An offline AP can't be rebooted through its own management interface. <b>Power-cycle its PoE port</b> on the floor switch it uplinks to.</li>
<li>Never restart a core device or a whole floor switch to fix one AP. That takes down everyone.</li></ol>` },
  { id: 'KB-203', title: 'Internal sites don\'t load but the internet works', tags: 'dns intranet nslookup resolve', body: `
<p>This is almost always <b>DNS</b>. Internal names (<code>intranet</code>, <code>fs01</code>) only resolve through our DNS servers on DC01.</p>
<ol><li>Remote in and run <code>nslookup intranet</code>. Also check <code>ipconfig /all</code>.</li>
<li>If DNS servers are public (e.g. 8.8.8.8), someone hard-coded them. Set the adapter back to <b>obtain DNS automatically</b>.</li>
<li><code>ipconfig /flushdns</code> clears any cached bad answers.</li></ol>` },
  { id: 'KB-301', title: 'Pop-ups and adware', tags: 'popup ads adware malware toolbar uninstall', body: `
<ol><li>Remote in (with the user's consent) and check installed programs sorted by install date.</li>
<li>Remove unrecognised programs installed around the time the pop-ups started. Look at the publisher.</li>
<li><b>Never remove</b> security software, the VPN client, or Microsoft 365.</li>
<li>Check running processes (<code>tasklist</code>) afterwards.</li></ol>` },
  { id: 'KB-302', title: 'Clock or meeting times are wrong', tags: 'time zone clock tzutil', body: `
<p>If the clock is off by whole hours, the <b>time zone</b> is wrong, not the time.</p>
<ol><li>Check where the user actually works (Directory → Profile → Location).</li>
<li>Remote in → Settings → Time zone, or run <code>tzutil /s "Mountain Standard Time"</code>.</li>
<li>Offices: HQ = Eastern, Denver = Mountain, Warehouse = Eastern.</li></ol>` },
  { id: 'KB-401', title: 'User entered their password on a phishing page', tags: 'phishing credential compromise security', body: `
<p>Treat the account as <b>compromised</b>. Tier 1 contains it; Security investigates.</p>
<ol><li>Verify the user's identity.</li>
<li>Reset the password (must change at next sign-in).</li>
<li><b>Sign out all sessions</b> so the attacker's session ends.</li>
<li>Escalate to <b>Security</b> with the phishing details. Don't close it yourself.</li></ol>` },
  { id: 'KB-402', title: 'Urgent requests from executives (social engineering)', tags: 'social engineering ceo cfo urgent impersonation', body: `
<p>Attackers pose as executives because urgency and rank make people skip checks.</p>
<ul><li>Verify <b>every</b> requester the same way: a code to the registered device.</li>
<li>Never send passwords to personal email addresses, or change contact details, on request.</li>
<li>If verification fails, do nothing to the account and <b>escalate to Security</b>.</li></ul>` },

  // ---- Shift 2: Phones On ----
  { id: 'KB-105', title: 'An account keeps locking again after you unlock it', tags: 'lockout locked again repeated activesync phone mobile source', body: `
<p>If an account locks again minutes after an unlock, something is still signing in with the <b>old password</b>. Unlocking again won't help, and neither will another reset.</p>
<ol><li>Directory → Authentication → <b>Last lockout source</b> tells you what is failing.</li>
<li>Common sources: the Mail app on a phone (ActiveSync), a mapped drive with saved credentials, a second laptop still signed in.</li>
<li>Have the user update or remove the account on that device <b>first</b>, then unlock.</li>
<li>Don't reset the password again. Now the phone is wrong twice.</li></ol>` },
  { id: 'KB-106', title: 'VPN says "not authorized for this gateway"', tags: 'vpn globalprotect remote home not authorized gateway', body: `
<p>That error means the account isn't in <code>VPN-Users</code>. Password and laptop are fine.</p>
<ol><li>Check Directory → Profile → <b>Recent changes</b>. The nightly <code>svc-groupcleanup</code> script sometimes removes remote workers by mistake.</li>
<li>Verify the caller's identity, then restore <code>VPN-Users</code>. Restoring access removed in error doesn't need a new approval; quote the audit entry in your note.</li>
<li>You <b>can't remote into</b> a laptop that is off the VPN. Fix the access first.</li></ol>` },
  { id: 'KB-107', title: 'Someone asks for access to a colleague\'s account', tags: 'password colleague another user share mailbox delegate sick leave', body: `
<p>Never reset or share another person's password, even if a manager asked. Account sharing destroys the audit trail: everything done "as" that person is now on their name.</p>
<ul><li>Mailbox access goes through <b>delegated access</b>, requested by the person's manager and approved by HR.</li>
<li>Help with the real need. Is the email also in a shared mailbox, or can the sender resend it?</li>
<li>Close the ticket as declined, and say what the requester should do instead.</li></ul>` },
  { id: 'KB-108', title: 'Admin rights requests and upset callers', tags: 'admin rights local administrator install software angry upset caller de-escalation', body: `
<p>The service desk <b>never</b> grants <code>Workstation-Admins</code> or <code>Domain Admins</code>. Admin rights let malware switch off security tools.</p>
<ol><li><b>Acknowledge</b> the problem first ("a demo in 10 minutes is stressful"). Never say "calm down".</li>
<li>Find the real need. Meeting apps (Webex, Zoom, Teams) can almost always be <b>joined from the browser</b> with no install.</li>
<li>For permanent installs, raise a software request so the app is packaged and approved for everyone.</li></ol>` },
  { id: 'KB-204', title: 'A whole site is down, and everyone is calling', tags: 'site outage denver wan circuit carrier major incident duplicate link', body: `
<ol><li>Confirm the scope with the caller: one person, or the whole office?</li>
<li>Server Room → Network: check the site's <b>WAN circuit</b> and run a <b>line test</b>. "Loss of signal" means a carrier fault.</li>
<li>Carrier circuits are managed by <b>Network Engineering</b>, who open the case with the carrier. Escalate once.</li>
<li>Every other caller about the same outage: <b>link their ticket to the first one</b> as a duplicate. Don't open a second escalation.</li>
<li>Never restart core routers or switches to "try something".</li></ol>` },
  { id: 'KB-205', title: 'Runbook: FS01 is running out of disk space', tags: 'disk full space fs01 storage not enough space file server', body: `
<p>Tier 1 is allowed to free space on FS01, but only from two places:</p>
<ul><li><code>D:\\Temp</code>: installer leftovers.</li>
<li><code>D:\\Logs\\Archive</code>: rotated application logs older than 30 days.</li></ul>
<p><b>Never delete:</b> anything under <code>D:\\Shares</code> (that's user data), or <code>System Volume Information</code> (shadow copies: every user's Previous Versions and your fastest restore point).</p>
<p>If the drive is still above 90% afterwards, escalate to the <b>Server Team</b>.</p>` },
  { id: 'KB-403', title: 'MFA fatigue: a user approved a sign-in they didn\'t make', tags: 'mfa push approve fatigue bombing authenticator compromise', body: `
<p>A flood of "Approve sign-in?" prompts means an attacker <b>already has the password</b>. If the user approved one, the attacker is signed in.</p>
<ol><li>Verify the user.</li>
<li>Reset the password (must change at next sign-in).</li>
<li><b>Sign out all sessions</b>.</li>
<li><b>Reset MFA.</b> Attackers usually register their own phone straight away (check Recent changes and Recent sign-ins).</li>
<li>Escalate to <b>Security</b>. Mention any emails sent from the account.</li></ol>` },
  { id: 'KB-404', title: 'Ransomware: the first five minutes', tags: 'ransomware encrypted locked files bitcoin recover isolate', body: `
<p>Speed matters more than anything else. Encryption spreads to every share the laptop can reach.</p>
<ol><li>Tell the user: <b>don't switch it off, unplug it or open anything</b>.</li>
<li>Remote Desktop → Overview → <b>Isolate from network</b>. The security agent keeps working, but the malware can't reach anything else.</li>
<li>Do <b>not</b> restart, "clean" or restore the device. That destroys the evidence Security needs.</li>
<li>Escalate to <b>Security</b> immediately: what the user opened, and which shares were mapped.</li></ol>` },
  { id: 'KB-501', title: 'Handling phone calls', tags: 'phone call hold voicemail callback answer', body: `
<ul><li>Answer before the call goes to voicemail. A missed call becomes a callback, and the user has already waited.</li>
<li>Answering another call puts the current caller <b>on hold</b>. Keep it under 45 seconds; after that people hang up.</li>
<li>You can only ask questions or read back a verification code while the caller is <b>on the line</b>. Call voicemails back.</li>
<li>Aim to resolve on the first call: fix it while they're still on the line.</li></ul>` },
];
