import { arr, c, has, num, str, type LevelSpec } from '../spec';

export const LOCK: LevelSpec[] = [
  // ------------------------------------------------------------------ 1. Master Key (least privilege)
  {
    id: 'lock-1',
    type: 'config',
    alert: 'BAKER HAS EVERY KEY IN TOWN',
    board: { broken: ['rosa\'s keyring: 6 keys', 'used last 90 days: 2'], fixed: ['rosa\'s keyring: 2 keys', 'least privilege ✓'] },
    intro: {
      symptom: 'An audit found that Rosa the baker carries keys to every door in town, including the vault and the town hall archive. If her keyring were lost, anyone could get in anywhere.',
      known: [
        'Rosa was given "all keys" years ago because it was easier.',
        'The key log records which doors each key actually opened.',
        'Rosa must still be able to do her job every day.',
      ],
      goal: 'Give Rosa exactly the keys she needs, and no more.',
    },
    evidence: [
      {
        kind: 'log', id: 'keylog', icon: '📜', label: 'KEY LOG (90 days)', hint: 'Which doors Rosa\'s keys opened. Click lines.',
        lines: [
          { text: 'bakery front door: 90 times', note: 'Every day. She clearly needs this.', evidence: true },
          { text: 'granary flour store (read only): 13 times', note: 'Weekly, to collect flour. She only takes, never changes the ledger.', evidence: true },
          { text: 'granary ledger (write): 0 times', note: 'Never used.' },
          { text: 'vault: 0 times', note: 'Never used. A baker has no reason to open the town vault.' },
          { text: 'town hall archive: 0 times', note: 'Never used.' },
          { text: 'library: 0 times', note: 'Never used.' },
        ],
      },
    ],
    configTitle: 'ROSA\'S KEYRING',
    fields: [{ kind: 'set', key: 'keys', label: 'keys', options: [['bakery', 'bakery front door'], ['flour-read', 'granary flour store (read)'], ['granary-write', 'granary ledger (write)'], ['vault', 'town vault'], ['archive', 'town hall archive'], ['library', 'library']] }],
    start: { keys: ['bakery', 'flour-read', 'granary-write', 'vault', 'archive', 'library'] },
    solution: { keys: ['bakery', 'flour-read'] },
    applyLabel: 'SIMULATE A WEEK',
    verify: (x) => {
      const k = arr(x.keys);
      const extra = k.filter((v) => !['bakery', 'flour-read'].includes(v));
      return {
        cases: [
          c('Rosa can open the bakery every morning', has(k, 'bakery')),
          c('Rosa can collect flour', has(k, 'flour-read')),
          c(`no keys she doesn't use (${extra.length} extra)`, extra.length === 0),
          c('a lost keyring can\'t open the vault', !has(k, 'vault')),
        ],
        hint: 'Use the key log: what did Rosa actually open in 90 days?',
      };
    },
    recap: {
      headline: 'Six keys, two used. Least privilege means keeping only those two.',
      before: { lines: ['bakery, flour (read), ledger (write)', 'vault, archive, library'], outcome: 'lost keyring = whole town exposed' },
      after: (x) => ({ lines: [arr(x.keys).join(', ')], outcome: 'lost keyring = one bakery ✓' }),
      why: 'Grant only what\'s needed for the job, based on what is actually used. Access logs make it evidence-based. Unused permissions are pure risk: they help no one until the day they help an attacker.',
      real: `{
  "Effect": "Allow",
  "Action": ["s3:GetObject"],
  "Resource": "arn:aws:s3:::granary-flour/*"
}
# + IAM Access Analyzer → "unused permissions" findings`,
      realCaption: 'Review access regularly; cloud providers can generate policies from real usage.',
    },
  },

  // ------------------------------------------------------------------ 2. Key Under the Mat (rotation)
  {
    id: 'lock-2',
    type: 'config',
    alert: 'VAULT KEY FOUND UNDER A DOORMAT',
    board: { broken: ['vault key: LEAKED', 'old key still works'], fixed: ['vault lock changed', 'old key useless ✓'] },
    intro: {
      symptom: 'A copy of the vault key was found under the town hall doormat. Nobody knows how long it was there or who else saw it.',
      known: [
        'Anyone could have copied it.',
        'Bo and Gus need vault access for their work. Nobody else does.',
        'Hiding the key better doesn\'t undo copies already made.',
      ],
      goal: 'Make the leaked key useless, while the people who need access keep it.',
    },
    evidence: [
      {
        kind: 'log', id: 'vault', icon: '📜', label: 'VAULT LOG', hint: 'Who opened the vault recently. Click lines.',
        lines: [
          { t: 'Mon', text: 'opened by Bo', note: 'Expected.' },
          { t: 'Tue', text: 'opened by Gus', note: 'Expected.' },
          { t: 'Wed 03:12', text: 'opened by ??? (key #1)', note: 'A 3am opening by someone unknown, using the same key. The leaked copy has been used. It must stop working.', evidence: true },
        ],
      },
    ],
    configTitle: 'VAULT ACCESS',
    fields: [
      { kind: 'choice', key: 'action', label: 'do what', options: [['hide', 'hide the key somewhere better'], ['sign', 'put up a "do not copy" sign'], ['rekey', 'change the lock (new key, old key stops working)']] },
      { kind: 'set', key: 'holders', label: 'new keys to', options: [['bo', 'Bo'], ['gus', 'Gus'], ['rosa', 'Rosa'], ['everyone', 'everyone, to be safe']] },
    ],
    start: { action: '', holders: [] },
    solution: { action: 'rekey', holders: ['bo', 'gus'] },
    applyLabel: 'TRY THE OLD KEY',
    verify: (x) => {
      const h = arr(x.holders);
      return {
        cases: [
          c('leaked key no longer opens the vault', x.action === 'rekey'),
          c('Bo and Gus can still open it', x.action !== 'rekey' || (has(h, 'bo') && has(h, 'gus')) || has(h, 'everyone')),
          c('nobody else gets a key', !has(h, 'rosa') && !has(h, 'everyone')),
        ],
        hint: x.action === 'hide' || x.action === 'sign' ? 'The copy is already out there. What makes a copied key worthless?' : 'Who actually needs the new key?',
      };
    },
    recap: {
      headline: 'Once a key leaks, assume it\'s copied. Change the lock.',
      before: { lines: ['key #1: under doormat', 'used Wed 03:12 by ???'], outcome: 'leaked key opens the vault' },
      after: (x) => ({ lines: ['lock changed → key #2', `holders: ${arr(x.holders).join(', ')}`], outcome: 'key #1 rejected ✓' }),
      why: 'A leaked secret can\'t be un-leaked. Rotation (new secret, old one revoked) is the only real fix. Hiding it better does nothing about copies. Hand the new secret only to those who need it.',
      real: `$ aws iam create-access-key --user-name vault-ops
$ aws iam update-access-key --access-key-id AKIA…OLD --status Inactive
$ aws iam delete-access-key --access-key-id AKIA…OLD`,
      realCaption: 'Rotate on any suspicion of exposure, and on a schedule anyway.',
    },
  },

  // ------------------------------------------------------------------ 3. Expired Seal (TLS)
  {
    id: 'lock-3',
    type: 'config',
    alert: 'SCARY WARNING AT THE LIBRARY',
    board: { broken: ['library.town cert', 'EXPIRED yesterday'], fixed: ['cert valid 90 days', 'auto-renew ✓'] },
    intro: {
      symptom: 'Visitors to library.town get a full-screen warning: "Your connection is not private". Some click through anyway, which is worse.',
      known: [
        'The library\'s seal (TLS certificate) proves to visitors that they reached the real library.',
        'Seals have an expiry date, and must name every address they cover.',
        'Visitors use both library.town and www.library.town.',
      ],
      goal: 'Get a valid seal covering both addresses, and stop this from happening again.',
    },
    evidence: [
      {
        kind: 'inspect', id: 'cert', icon: '🔏', label: 'CURRENT SEAL', hint: 'Details of the certificate. Click each.',
        items: [
          { title: 'Valid until', summary: 'yesterday 23:59', detail: 'It expired yesterday. That\'s the warning.', evidence: true },
          { title: 'Covers', summary: 'library.town, www.library.town', detail: 'Both names are listed. The new seal must keep both.' },
          { title: 'Issued by', summary: 'Town CA (trusted)', detail: 'Browsers trust the Town CA. A self-made seal would trigger the same warning.' },
          { title: 'Renewal', summary: 'manual (calendar reminder)', detail: 'Renewed by hand from a calendar reminder… which went to someone who left last year.', evidence: true },
        ],
      },
    ],
    configTitle: 'NEW CERTIFICATE',
    fields: [
      { kind: 'set', key: 'names', label: 'covers', options: [['apex', 'library.town'], ['www', 'www.library.town'], ['wild', '*.town (every shop)']] },
      { kind: 'choice', key: 'issuer', label: 'issuer', options: [['ca', 'Town CA (trusted)'], ['self', 'self-signed']] },
      { kind: 'toggle', key: 'auto', label: 'renewal', on: 'AUTO-RENEW', off: 'MANUAL' },
    ],
    start: { names: ['apex', 'www'], issuer: '', auto: false },
    solution: { names: ['apex', 'www'], issuer: 'ca', auto: true },
    applyLabel: 'VISIT BOTH ADDRESSES',
    verify: (x) => {
      const n = arr(x.names);
      return {
        cases: [
          c('library.town: no warning', x.issuer === 'ca' && (has(n, 'apex'))),
          c('www.library.town: no warning', x.issuer === 'ca' && (has(n, 'www') || has(n, 'wild'))),
          c('still valid in 91 days', !!x.auto),
          c('a leaked library key can\'t impersonate other shops', !has(n, 'wild')),
        ],
        hint: x.issuer === 'self' ? 'Browsers don\'t trust a seal you made yourself.' : !x.auto ? 'It works today. What happens in 90 days?' : 'Check which names visitors use, and who browsers trust.',
      };
    },
    recap: {
      headline: 'The seal expired because renewal depended on a calendar reminder.',
      before: { lines: ['valid until: yesterday', 'names: library.town, www…', 'renewal: manual'], outcome: '"Your connection is not private"' },
      after: (x) => ({ lines: [`names: ${arr(x.names).join(', ')}`, `issuer: ${str(x.issuer) === 'ca' ? 'Town CA' : 'self'}`, `renewal: ${x.auto ? 'automatic' : 'manual'}`], outcome: 'padlock ✓, renews itself' }),
      why: 'Certificate outages are almost always forgotten renewals. Automate renewal (ACME / Let\'s Encrypt / cert-manager), cover exactly the names you serve, and monitor expiry dates as a backstop.',
      real: `# cert-manager Certificate
spec:
  secretName: library-tls
  dnsNames: [library.town, www.library.town]
  issuerRef: { name: town-ca, kind: ClusterIssuer }
  renewBefore: 720h   # 30 days`,
      realCaption: 'Alert when any cert is under 14 days from expiry: cheap insurance.',
    },
  },

  // ------------------------------------------------------------------ 4. Borrowed Badge (temporary credentials)
  {
    id: 'lock-4',
    type: 'config',
    alert: 'CONTRACTORS NEED ACCESS TODAY',
    board: { broken: ['contractors: no access', 'Ada: "use my login?"'], fixed: ['role session: 8h', 'blueprints only ✓'] },
    intro: {
      symptom: 'Two contractors arrive today to review blueprints. Ada suggests they just use her login. Her login can also open the vault.',
      known: [
        'They need to read blueprints and write review notes, today only.',
        'Shared logins make it impossible to tell who did what.',
        'The town can issue temporary badges that expire on their own.',
      ],
      goal: 'Give the contractors exactly the access they need, for exactly as long as they need it.',
    },
    evidence: [
      { kind: 'inspect', id: 'req', icon: '📝', label: 'REQUEST', hint: 'The contractors\' request.', items: [{ title: 'What', summary: 'read blueprints, add review notes', detail: 'Two permissions: blueprints:read and notes:write. Nothing else.', evidence: true }, { title: 'When', summary: 'today 9:00–17:00', detail: 'One working day: 8 hours.', evidence: true }, { title: 'Who', summary: 'two named contractors', detail: 'Each should be identifiable in the logs.' }] },
    ],
    configTitle: 'ACCESS FOR CONTRACTORS',
    fields: [
      { kind: 'choice', key: 'how', label: 'credential', options: [['share', 'share Ada\'s login'], ['user', 'permanent user accounts'], ['role', 'temporary role session (badge)']] },
      { kind: 'number', key: 'hours', label: 'expires after', min: 1, max: 720, unit: 'hours' },
      { kind: 'set', key: 'perms', label: 'permissions', options: [['bp-read', 'blueprints:read'], ['notes-write', 'notes:write'], ['bp-write', 'blueprints:write'], ['vault', 'vault:open'], ['admin', 'admin:*']] },
    ],
    start: { how: 'share', hours: 720, perms: ['bp-read', 'notes-write', 'bp-write', 'vault', 'admin'] },
    solution: { how: 'role', hours: 8, perms: ['bp-read', 'notes-write'] },
    applyLabel: 'SIMULATE TODAY & TOMORROW',
    verify: (x) => {
      const p = arr(x.perms);
      const extra = p.filter((v) => !['bp-read', 'notes-write'].includes(v));
      return {
        cases: [
          c('contractors can do their review today', has(p, 'bp-read') && has(p, 'notes-write')),
          c('access is gone by tomorrow morning', x.how === 'role' && num(x.hours) <= 12),
          c('logs show which contractor did what', x.how !== 'share'),
          c(`no extra permissions (${extra.length} extra)`, extra.length === 0),
        ],
        hint: x.how === 'share' ? 'With a shared login, you can\'t tell who did what, and they get everything Ada has.' : x.how === 'user' ? 'Permanent accounts tend to outlive the job by years.' : 'Check the duration and the permission list against the request.',
      };
    },
    recap: {
      headline: 'Temporary, scoped, named. Never a borrowed login.',
      before: { lines: ['Ada\'s login (shared)', 'expires: never', 'perms: everything incl. vault'], outcome: 'untraceable, over-powered' },
      after: (x) => ({ lines: ['role session per contractor', `expires: ${num(x.hours)}h`, `perms: ${arr(x.perms).join(', ')}`], outcome: 'gone by tomorrow ✓' }),
      why: 'Temporary credentials expire on their own, so there\'s nothing to remember to revoke. Scope them to the task and issue them per person so the audit log stays meaningful.',
      real: `$ aws sts assume-role \\
    --role-arn arn:aws:iam::123:role/blueprint-reviewer \\
    --role-session-name contractor-jane \\
    --duration-seconds 28800`,
      realCaption: 'Short-lived credentials beat long-lived keys almost every time.',
    },
  },

  // ------------------------------------------------------------------ 5. Who Opened the Door? (audit, terminal)
  {
    id: 'lock-5',
    type: 'terminal',
    alert: 'VAULT OPENED AT 3AM',
    board: { broken: ['vault opened 03:07', 'by: unknown key'], fixed: ['culprit key disabled', 'backups unaffected ✓'] },
    intro: {
      symptom: 'The vault was opened at 03:07 last night. Nobody admits to it. The bell didn\'t ring because a valid key was used.',
      known: [
        'Every access is written to the audit log, with key ID and source address.',
        'The nightly backup job (svc-backup) uses the vault at 02:00, from 10.0.3.40.',
        'You can disable a key without deleting the account.',
      ],
      goal: 'Find which key opened the vault, disable exactly that key, and confirm the backup job still works.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'audit search vault: vault events\naudit search key <KEYID>: everything a key did\niam list-keys svc-backup\niam disable-key <KEYID>\nbackup test: run the backup job now' }],
    term: {
      host: 'security',
      motd: 'Security console · audit log retention 90 days',
      files: {},
      vars: { disabled: '' },
      commands: [
        { match: /^audit search vault$/, usage: 'audit search vault', help: 'vault events', run: () => ({ out: '02:00:04  vault.open  svc-backup  key AKIA7BKP  from 10.0.3.40   (nightly backup)\n03:07:51  vault.open  svc-backup  key AKIA2LEAK from 185.220.101.4  ⚠ outside town\n03:08:30  vault.list  svc-backup  key AKIA2LEAK from 185.220.101.4', evidence: true }) },
        { match: /^audit search key (\w+)$/, usage: 'audit search key AKIA2LEAK', help: 'events for one key', run: (m) => ({ out: m[1] === 'AKIA2LEAK' ? 'key AKIA2LEAK: created 2021 for "old backup script", last rotated: never\n03:07 vault.open from 185.220.101.4\n03:08 vault.list from 185.220.101.4' : m[1] === 'AKIA7BKP' ? 'key AKIA7BKP: created last month, used nightly at 02:00 from 10.0.3.40' : 'no events', evidence: m[1] === 'AKIA2LEAK' }) },
        { match: /^iam list-keys svc-backup$/, usage: 'iam list-keys svc-backup', help: 'keys for the backup account', run: (_m, s) => ({ out: `AKIA7BKP   ${s.vars.disabled === 'AKIA7BKP' ? 'Inactive' : 'Active'}  created 32 days ago\nAKIA2LEAK  ${s.vars.disabled === 'AKIA2LEAK' ? 'Inactive' : 'Active'}  created 2021 (old script)` }) },
        { match: /^iam disable-key (\w+)$/, usage: 'iam disable-key <KEYID>', help: 'deactivate a key', run: (m, s) => { s.vars.disabled = m[1]; return { out: `key ${m[1]} → Inactive`, changed: true, bad: m[1] === 'AKIA7BKP' }; } },
        { match: /^iam delete-user svc-backup$/, usage: 'iam delete-user svc-backup', help: 'delete the whole account', run: (_m, s) => { s.vars.disabled = 'ALL'; return { out: 'user svc-backup deleted\n⚠ tonight\'s backup will fail', changed: true, bad: true }; } },
        { match: /^backup test$/, usage: 'backup test', help: 'run the backup job now', run: (_m, s) => ({ out: s.vars.disabled === 'AKIA7BKP' || s.vars.disabled === 'ALL' ? 'backup FAILED: access denied' : 'backup OK (key AKIA7BKP)', verify: true }) },
      ],
    },
    check: (s) => ({
      cases: [c('the 3am key (AKIA2LEAK) is disabled', s.vars.disabled === 'AKIA2LEAK'), c('nightly backup still works', s.vars.disabled !== 'AKIA7BKP' && s.vars.disabled !== 'ALL')],
      hint: 'Both keys belong to the same account. Which one was used from outside town at 3am?',
    }),
    solve: (s) => { s.vars.disabled = 'AKIA2LEAK'; },
    recap: {
      headline: 'An old, never-rotated key from a retired script was used from outside town.',
      before: { lines: ['svc-backup: AKIA7BKP (current)', '            AKIA2LEAK (2021, never rotated)'], outcome: 'vault opened from 185.220.101.4' },
      after: () => ({ lines: ['AKIA7BKP   Active', 'AKIA2LEAK  Inactive'], outcome: 'attacker locked out, backups OK ✓' }),
      why: 'Audit logs answer who, what, when and from where. Same account, two keys: the source address and history told them apart. Disable precisely the compromised credential, then verify the legitimate job still works. Next step: find out how the old key leaked.',
      real: `$ aws cloudtrail lookup-events \\
    --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIA2LEAK
$ aws iam update-access-key --user-name svc-backup \\
    --access-key-id AKIA2LEAK --status Inactive`,
      realCaption: 'Alert on access keys used from unusual locations, and on keys older than 90 days.',
    },
  },

  // ------------------------------------------------------------------ 6. Locked Out (explicit deny, terminal)
  {
    id: 'lock-6',
    type: 'terminal',
    alert: 'KIT CAN\'T READ THE LEDGER',
    board: { broken: ['kit → granary-ledger', 'AccessDenied'], fixed: ['kit → granary-ledger', 'Allowed ✓'] },
    intro: {
      symptom: 'Kit was given permission to read the granary ledger yesterday, but still gets "Access Denied".',
      known: [
        'Permissions come from policies attached directly and through groups.',
        'An explicit Deny anywhere beats every Allow.',
        'The "contractors" group denies all access to the granary, on purpose.',
      ],
      goal: 'Find what\'s denying Kit, fix the real cause without weakening anyone else\'s protections, and confirm.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'iam simulate kit read granary-ledger\niam groups kit\niam policy <name>\niam remove-from-group <user> <group>\niam delete-policy <name>' }],
    term: {
      host: 'security',
      motd: 'Security console',
      files: {},
      vars: { inContractors: true, denyPolicy: true },
      commands: [
        { match: /^iam simulate kit read granary-ledger$/, usage: 'iam simulate kit read granary-ledger', help: 'evaluate permissions', run: (_m, s) => (s.vars.inContractors && s.vars.denyPolicy ? { out: 'Allow: kit-granary-read (attached to user)\nDeny:  deny-contractors-granary (via group contractors)\nResult: DENIED (explicit deny wins)', evidence: true, verify: true } : { out: 'Allow: kit-granary-read\nResult: ALLOWED', verify: true }) },
        { match: /^iam groups kit$/, usage: 'iam groups kit', help: 'Kit\'s groups', run: (_m, s) => ({ out: `staff\nlocksmiths${s.vars.inContractors ? '\ncontractors   (added 2 days ago by onboarding script, "temp")' : ''}`, evidence: !!s.vars.inContractors }) },
        { match: /^iam policy (\S+)$/, usage: 'iam policy deny-contractors-granary', help: 'show a policy', run: (m) => ({ out: m[1] === 'deny-contractors-granary' ? 'Deny  granary:*  for group contractors\n(protects the ledger from outside contractors)' : m[1] === 'kit-granary-read' ? 'Allow granary:read on granary-ledger' : 'no such policy' }) },
        { match: /^iam remove-from-group kit contractors$/, usage: 'iam remove-from-group kit contractors', help: 'take Kit out of contractors', run: (_m, s) => { s.vars.inContractors = false; return { out: 'kit removed from group contractors', changed: true }; } },
        { match: /^iam delete-policy deny-contractors-granary$/, usage: 'iam delete-policy deny-contractors-granary', help: 'delete the deny policy', run: (_m, s) => { s.vars.denyPolicy = false; return { out: 'policy deleted\n⚠ all 12 contractors can now read and write the granary ledger', changed: true, bad: true }; } },
      ],
    },
    check: (s) => ({
      cases: [c('Kit can read the ledger', !s.vars.inContractors || !s.vars.denyPolicy), c('contractors are still blocked from the granary', !!s.vars.denyPolicy)],
      hint: 'The deny is doing its job for contractors. Is Kit supposed to be one?',
    }),
    solve: (s) => { s.vars.inContractors = false; },
    recap: {
      headline: 'Kit was accidentally in the contractors group, and its explicit Deny beat Kit\'s Allow.',
      before: { lines: ['allow: kit-granary-read', 'deny:  contractors → granary:*', 'kit ∈ contractors (by mistake)'], outcome: 'AccessDenied' },
      after: () => ({ lines: ['allow: kit-granary-read', 'deny still protects contractors', 'kit ∉ contractors'], outcome: 'Allowed ✓, protection intact' }),
      why: 'Policy evaluation: explicit Deny > Allow > implicit deny. When an Allow "doesn\'t work", look for a Deny. The simulator shows which policy decided. Fix the wrong membership instead of deleting a guardrail that protects everyone else.',
      real: `$ aws iam simulate-principal-policy \\
    --policy-source-arn arn:aws:iam::123:user/kit \\
    --action-names s3:GetObject --resource-arns arn:aws:s3:::granary-ledger/*
  EvalDecision: explicitDeny
$ aws iam remove-user-from-group --user-name kit --group-name contractors`,
      realCaption: 'Explicit denies are guardrails. Fix the input, not the guardrail.',
    },
  },
];
