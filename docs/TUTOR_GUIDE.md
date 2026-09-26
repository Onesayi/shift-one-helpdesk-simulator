# Tutor Guide

How to run tutoring sessions, workshops and classes with Shift One, plus a full answer key.

> ⚠️ **Spoilers.** The answer key at the bottom solves every ticket. Students should play first.

---

## Session formats

### 1:1 coached shift (60 min)

| Time | Activity |
|---|---|
| 0–5 | Goals: what role is the student applying for? What do they find hardest? |
| 5–10 | Tour: queue, directory, remote desktop, server room, KB. Show *Verify requester*. |
| 10–40 | **Timed shift**, screen-shared. The student thinks out loud. You only intervene if they're stuck for more than 2 minutes. |
| 40–55 | **Report debrief.** Take each lost point in turn: what happened, what a real desk would expect, how they'd explain it in an interview. |
| 55–60 | Homework: replay in practice mode and aim for 90+; read the KB articles for their weakest tickets. |

**Coaching prompts that work**
- "Before you click that, who is this ticket really from?"
- "How many people are affected? How do you know?"
- "What is the *smallest* change that fixes it?"
- "If you got hit by a bus now, could the next tech continue from your notes?"

### Interview Prep Pack (4 × 60 min)

1. **Baseline shift** with a full debrief (as above).
2. **Process drills** in practice mode: identity verification, least privilege, escalation. Replay tickets 1, 4, 9, 11 until they're automatic.
3. **Troubleshooting out loud**: tickets 2, 6, 7. The student explains the scope → hypothesis → test → fix loop as they go. Record it if they agree.
4. **Mock interview**: 30 min of the questions below, then a final timed shift. Compare with session 1.

### Classroom workshop (90–120 min, 5–30 students)

1. **10 min:** what a service desk is; priority vs urgency; why process matters (show the CFO ticket).
2. **30 min:** everyone plays a **timed shift** individually.
3. **20 min:** "Worst mistakes" round-table: students volunteer their collateral-damage lines.
4. **20 min:** pairs replay in practice mode; one drives, one reads the KB.
5. **10 min:** leaderboard of final scores (students call out their grade) and takeaways.

---

## Mock interview questions (mapped to tickets)

| Question | Ticket to reference |
|---|---|
| A user calls saying they're locked out. Walk me through it. | 1 |
| How do you verify someone's identity over the phone? | 1, 11 |
| A new starter needs access to a shared folder. What do you do? | 4 |
| Users on one floor can't print. Where do you start? | 6 |
| Someone can reach Google but not internal sites. What's wrong? | 7 |
| A user says they entered their password on a phishing page. | 9 |
| An executive demands an urgent password reset to a personal email. | 11 |
| Tell me about a time you had to escalate. | 9, 11 |
| What makes a good ticket note? | any |
| What's least privilege? | 4 |

---

## Answer key

<details>
<summary><b>Click to reveal all solutions</b></summary>

### 1 · INC-20114: Locked out (Priya Nair)
1. Assign → **Verify requester** (code to registered mobile) → she reads it back.
2. Ask *"Do you know your current password?"* She does (caps lock).
3. Directory → Priya → Authentication → **Unlock account**. Don't reset.
4. Category *Account & Access*; note mentions *unlock*.

**Traps:** changing the account before verification (−25); an unnecessary reset (−5); a reset without *must change* (−10).

### 2 · INC-20115: Cafeteria Wi-Fi (Marcus Webb)
1. Ask about scope: only the cafeteria.
2. Server Room → Network → `AP-CAFE-01` is offline. *Reboot* times out (it's unreachable).
3. **Power-cycle PoE port** → AP boots and comes back online.

**Traps:** restarting `CORE-SW-01` (−30, company-wide outage) or `FL1-SW-01` (−15). Both "work" but cause collateral damage.

### 3 · INC-20116: Clock an hour behind (Samuel Ortiz)
1. Directory shows his location: **Denver Office** → Mountain time.
2. Remote into `BL-DT-2210` → Settings → Time zone **Mountain Standard Time**, or `tzutil /s "Mountain Standard Time"`.

**Trap:** guessing Eastern (HQ). More than two changes costs −5.

### 4 · INC-20117: Finance share access (Jordan Morales)
1. Ask *"Has your manager approved this access?"* Tom Becker replies with written approval.
2. Directory → Jordan → Groups → **Add to FS-Finance-RW**. He needs to edit, so read-only isn't enough.

**Traps:** adding the group before approval (−25); `Domain Admins`, `Finance-Managers` or `FS-HR-RW` (−30); only `FS-Finance-RO` (ticket reopens).

### 5 · INC-20118: Pop-up ads (Ravi Patel)
1. Remote into `BL-LT-1033` → Apps & features.
2. Uninstall **DealFinder Pro** and **QuickSearch Toolbar**. Bonus: **Free PDF Merge**, the bundler.

**Traps:** uninstalling Endpoint Protection Agent (−25) or other business apps (−15). `taskkill` alone doesn't help: the process respawns.

### 6 · INC-20119: Printing (Bola Adeyemi)
1. Ask *"Is it just you?"* The whole floor is affected.
2. Server Room → Servers → **PRINT01 → Print Spooler → Start**. 23 queued jobs print.

**Trap:** restarting the spooler on her laptop does nothing (no penalty, just wasted time).

### 7 · INC-20120: Intranet down, internet fine (Alex Kim)
1. Remote into `BL-DT-2304` → Command Prompt: `nslookup intranet` fails via `dns.google`; `ping 10.20.0.40` works → it's DNS.
2. Settings → DNS → **Obtain automatically** → Apply (or `netsh interface ip set dns "Ethernet" dhcp`).
3. Optional: `ipconfig /flushdns`.

### 8 · INC-20121: Name change (Hana Kowalski)
Directory → Hana → Profile → **Edit name & email**: last name *Whitfield*, display *Hana Whitfield*, email *hwhitfield@brightline.com*.

### 9 · INC-20122: Phishing (Nora Lindqvist)
1. **Verify** her identity.
2. **Reset password** (must change) and **Sign out all sessions**.
3. Optional: ask her to forward the email to phishing@.
4. **Escalate → Security**, category *Security*.

**Traps:** resolving it yourself (−30); no reset (−25); no session sign-out (−15).

### 10 · INC-20123: Leaver (Kevin Doyle)
1. There are **two** Kevin Doyles. The leaver is **EMP-1187, Sales** (`kdoyle`), not `kdoyle2` in the warehouse.
2. Disable the account, remove **all** groups, and sign out all sessions.

**Trap:** touching `kdoyle2` (−40).

### 11 · INC-20124: "CFO" urgent reset
1. Red flags: external Gmail address, extreme urgency, a wire transfer, and a request to email the password.
2. **Verify requester**: they can't produce the code.
3. Make **no changes** to Daniel Okafor's account. **Escalate → Security**.

**Traps:** any reset or profile change on `dokafor` (−50); resolving instead of escalating (−30); never trying to verify (−10).

</details>
