# Authoring scenarios

A ticket is one object in [`js/scenarios.js`](../js/scenarios.js). If it needs something broken, set up that state in [`js/data.js`](../js/data.js).

## 1. Break something in the world

Examples of starting state you can edit in `WORLD`:

```js
// a user whose password has expired
pnair: user('pnair', 'Priya', 'Nair', { pwdExpired: true, ... }),

// a device with a wrong setting
'BL-DT-2210': device('BL-DT-2210', 'sortiz', 'Desktop', 'Dell OptiPlex 7010', '10.40.1.10', { tz: 'Pacific Standard Time' }),

// a stopped server service
PRINT01: { services: [{ name: 'Spooler', display: 'Print Spooler', status: 'Stopped' }], ... }
```

## 2. Write the ticket

```js
{
  id: 'INC-20125',            // unique
  at: 360,                    // seconds into a timed shift it arrives
  priority: 'Medium',         // Critical | High | Medium | Low (sets the SLA)
  requester: 'gfoster',       // user id from data.js
  device: 'BL-LT-0660',       // optional: adds a "remote in" shortcut
  title: 'Outlook keeps asking for my password',
  body: 'Since this morning Outlook pops up a password box every few minutes…',

  categories: ['Email'],      // accepted categories
  expect: { action: 'resolve' },            // or { action: 'escalate', team: 'Security' }
  requireVerify: false,       // true = sensitive changes before verification are penalised
  kb: 'KB-501',               // related article
  keywords: ['credential', 'profile'],      // a good note mentions at least one

  questions: [
    { id: 'when', q: 'When did it start?', a: 'Right after I changed my password yesterday.', flag: 'askedWhen' },
    // follow-ups let another person reply later and set a flag / log an event:
    // follow: { from: 'tbecker', delay: 3500, text: 'Approved.', flag: 'approved', event: 'approval' }
  ],

  thanks: 'No more prompts, thank you!',
  stillBroken: 'It just asked again…',

  evaluate(w, t) {
    const r = { fixed: /* inspect w */ false, ded: [], good: [] };
    if (t.flags.askedWhen) r.good.push('Asked when it started. That pointed straight at the password change.');
    return r;
  },
}
```

### Calls, shifts and other options

```js
{
  shift: 2,                    // which shift the ticket belongs to (default 1)
  channel: 'phone',            // rings as a live call; missed calls become voicemails (default: portal)
  voicemail: 'Hi, it\'s Maya…', // what the caller leaves if the call is missed
  group: 'den-wan',            // tickets that are one incident: escalate one, link the rest
  involves: ['pnair'],         // other users this ticket legitimately touches
  adminCheck: 'rpatel',        // this ticket grades admin-group changes for that user itself
  thanksFrom: 'Security team', // who sends the closing message
  questions: [
    { id: 'calm', q: 'Calm down.', a: 'Don\'t tell me to calm down!', bad: [10, 'Told an upset caller to calm down.'] },
  ],
  tick(w, t) { /* runs every second while open, e.g. re-lock an account or spread malware */ },
}
```

### Free-text replies

Players can type anything in the reply box. The engine answers in this order:

1. **A scripted question's `keys`.** Typed text matching a question's regex counts as asking that question (same answer, same flag, same `bad` deduction).
2. **Common intents** (`INTENTS` in `app.js`): "try again" / "can you save now?", restart, sign out and back in, computer name, error message, "OK to close?", thanks, apologies, hello. Answers depend on the real state: "try again" checks `evaluate().fixed`.
3. **Asking for the user's password** always costs 10 points.
4. **Rotating fallbacks** for anything else.

Per-ticket wording lives in `CONVERSATION` at the bottom of `scenarios.js`:

```js
'INC-20207': {
  keys: { others: /\b(other shares|finance|just you)\b/i },   // question id -> regex
  confirm: 'Saved! The campaign files are uploading now.',      // "try again" when fixed
  notYet: 'Still "not enough space".',                          // "try again" when not (default: stillBroken)
  errorText: '"There is not enough space on \\\\FS01\\Marketing…"',
  testReply: (w, t) => '…',                                     // full override for "try again"
},
```

Keep `keys` specific. A broad word like "save" or "know" will hijack ordinary messages like "can you save now?".

New shifts go in `SHIFTS` at the top of `scenarios.js`. A shift's `setup(w)` receives a fresh copy of the world before the shift starts, so it can break things (lock an account, stop a service, take a circuit down) without affecting other shifts.

## 3. Grading helpers

| Helper | Use |
|---|---|
| `w` | The live world (users, devices, network, servers) |
| `t.flags` | Flags set by questions, `verified`, `verifyFailed` |
| `logged(type, pred)` | Events of a type, e.g. `logged('uninstall', e => e.device === 'BL-LT-1033')` |
| `touchedBeforeVerify(userId)` | True if a reset/unlock/MFA reset happened before verification |
| `G.log` | Every event, in order (`seq` field) |

**Event types:** `assign`, `verify-sent`, `verified`, `approval`, `pwd-reset` (`mustChange`), `unlock`, `mfa-reset`, `revoke`, `disable`, `enable`, `edit-profile`, `group-add`, `group-remove`, `remote-connect`, `remote-fail`, `uninstall`, `service`, `tz`, `dns-mode`, `cmd`, `gpupdate`, `poe-cycle`, `net-reboot`, `line-test`, `server-service`, `storage-delete` (`kind`), `isolate`, `restart`, `call-answer`, `call-missed`, `call-hold`, `call-dropped`, `callback`, `call-end`.

`ded` entries are `[points, reason]`. The engine adds the standard checks automatically: category, note quality, reopens, SLA, resolve vs escalate vs link, missed calls, hold hang-ups, `bad` questions, and first-contact resolution.

## 4. Add a KB article

Append to `KB` in `data.js`. Write it like a real internal SOP: short, numbered, and specific about what *not* to do.

## Checklist

- [ ] Solvable using only the in-game tools
- [ ] The requester's text describes symptoms, not the fix
- [ ] At least one realistic trap
- [ ] The grader rewards good process, not just the end state
- [ ] A KB article exists
- [ ] Played through once correctly and once badly
