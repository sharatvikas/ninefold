import { c, str, type LevelSpec } from '../spec';
import { squash } from '../terminal';

export const ARCH: LevelSpec[] = [
  // ------------------------------------------------------------------ 1. Blueprint Basics (plan before apply)
  {
    id: 'arch-1',
    type: 'config',
    alert: 'PLAN WANTS TO REMOVE A ROOF',
    board: { broken: ['plan: 1 add, 1 change', '      1 DESTROY'], fixed: ['plan: 1 add, 1 change', '      0 destroy ✓'] },
    intro: {
      symptom: 'Ada asked for two new windows on the library. Before building, the plan (a list of what will change) was printed, and something in it looks wrong.',
      known: [
        'The blueprint describes how the town should look. The builders make reality match it.',
        'The plan lists every change: + add, ~ change, - destroy.',
        'Ada also tidied up the library blueprint while she was editing it.',
      ],
      goal: 'Read the plan, fix the blueprint so only the intended change happens, and build.',
    },
    evidence: [
      {
        kind: 'log', id: 'plan', icon: '📋', label: 'THE PLAN', hint: 'What the builders will do if you apply. Click each line.', diff: true,
        lines: [
          { text: '+ library.window["east-1"]', note: 'A new window. Ada asked for this.' },
          { text: '+ library.window["east-2"]', note: 'The second new window. Also intended.' },
          { text: '~ library.door: colour "red" → "green"', note: 'A small change to the door colour. Harmless, and Ada meant it.' },
          { text: '- library.roof   (not in blueprint)', note: 'Danger: the plan will DESTROY the library roof, because the roof is missing from the blueprint. Reality will be made to match it.', evidence: true },
        ],
      },
      {
        kind: 'inspect', id: 'bp', icon: '📐', label: 'BLUEPRINT', hint: 'The library blueprint, section by section.',
        items: [
          { title: 'walls', summary: 'stone, 4', detail: 'Unchanged.' },
          { title: 'windows', summary: 'east-1, east-2 (new)', detail: 'The two new windows.' },
          { title: 'door', summary: 'green', detail: 'Changed from red.' },
          { title: 'roof', summary: '(section deleted)', detail: 'While "tidying", the roof section was deleted from the blueprint. The blueprint is the truth, so the builders will remove the real roof.', evidence: true },
        ],
      },
    ],
    configTitle: 'LIBRARY BLUEPRINT',
    fields: [
      { kind: 'toggle', key: 'windows', label: 'east windows ×2', on: 'IN', off: 'OUT' },
      { kind: 'choice', key: 'door', label: 'door colour', options: [['red', 'red'], ['green', 'green']] },
      { kind: 'toggle', key: 'roof', label: 'roof section', on: 'IN', off: 'OUT' },
    ],
    start: { windows: true, door: 'green', roof: false },
    solution: { windows: true, door: 'green', roof: true },
    applyLabel: 'PLAN & APPLY',
    verify: (x) => ({
      cases: [
        c('plan has 0 destroys', !!x.roof),
        c('the two new windows are built', !!x.windows),
        c('the door is green as Ada asked', x.door === 'green'),
      ],
      hint: 'Read the plan line by line. Anything with a "-" in front gets torn down.',
    }),
    recap: {
      headline: 'The blueprint is the truth. Delete something from it and it gets torn down.',
      before: { lines: ['+ window east-1', '+ window east-2', '~ door red → green', '- roof'], outcome: 'apply would destroy the roof' },
      after: () => ({ lines: ['+ window east-1', '+ window east-2', '~ door red → green'], outcome: 'Plan: 2 to add, 1 to change, 0 to destroy ✓' }),
      why: 'Infrastructure as code makes reality match the code, including deleting things that are no longer in it. Always read the plan before applying, especially lines that destroy. Your intent and the plan must match exactly.',
      real: `$ terraform plan
  + aws_instance.window_east_1
  + aws_instance.window_east_2
  ~ aws_s3_bucket.door  (tags.colour: "red" → "green")
  - aws_ebs_volume.roof      # !!
Plan: 2 to add, 1 to change, 1 to destroy.`,
      realCaption: 'Read every "-" and "-/+" before typing yes.',
    },
  },

  // ------------------------------------------------------------------ 2. The Hand-Built Shed (drift)
  {
    id: 'arch-2',
    type: 'config',
    alert: 'DRIFT: SHED NOT IN BLUEPRINT',
    board: { broken: ['drift detected:', 'shed (hand-built)'], fixed: ['blueprint = reality', 'no drift ✓'] },
    intro: {
      symptom: 'The nightly check found a shed behind the granary that isn\'t in any blueprint. The next plan wants to remove it.',
      known: [
        '"Drift" means reality no longer matches the blueprint.',
        'Someone built the shed by hand last week.',
        'Applying the plan as-is would knock it down.',
      ],
      goal: 'Find out what the shed is for, then resolve the drift so blueprint and reality match again.',
    },
    evidence: [
      {
        kind: 'log', id: 'plan', icon: '📋', label: 'NIGHTLY PLAN', hint: 'Click lines.', diff: true,
        lines: [
          { text: '- granary.shed   (exists, not in blueprint)', note: 'Applying would destroy the shed. But what\'s in it?' },
          { text: 'No other changes.', note: 'Only the shed differs.' },
        ],
      },
      {
        kind: 'inspect', id: 'town', icon: '🗒', label: 'TOWN NOTES', hint: 'Ask around about the shed.',
        items: [
          { title: 'Gus (granary)', summary: '"I built it Tuesday"', detail: 'Gus: "The festival lanterns were getting damp, so I built a shed in a hurry. Didn\'t have time for a blueprint."', evidence: true },
          { title: 'Mayor Bo', summary: '"Festival is Friday"', detail: 'Bo: "The harvest festival needs every one of those lanterns."' },
          { title: 'Ada (architect)', summary: '"Unmanaged = invisible"', detail: 'Ada: "If it\'s not in the blueprint, nobody maintains it, and the next apply removes it."' },
        ],
      },
    ],
    configTitle: 'RESOLVE THE DRIFT',
    fields: [
      { kind: 'choice', key: 'action', label: 'what to do', options: [['apply', 'apply the plan (remove the shed)'], ['import', 'add the shed to the blueprint (import it)'], ['ignore', 'tell the checker to ignore the granary area']] },
    ],
    start: { action: '' },
    solution: { action: 'import' },
    applyLabel: 'RUN NIGHTLY PLAN AGAIN',
    verify: (x) => ({
      cases: [
        c('festival lanterns are safe', x.action === 'import' || x.action === 'ignore'),
        c('blueprint matches reality (no drift)', x.action === 'import' || x.action === 'apply'),
        c('changes in that area are still checked', x.action !== 'ignore'),
      ],
      hint: x.action === 'apply' ? 'The shed holds the festival lanterns!' : x.action === 'ignore' ? 'Ignoring the area hides all future drift there too, so nobody notices the next surprise.' : 'Pick a way to make the blueprint and reality agree.',
    }),
    recap: {
      headline: 'The shed was important. It just wasn\'t written down.',
      before: { lines: ['reality:   shed (lanterns)', 'blueprint: (no shed)', 'plan:      - shed'], outcome: 'drift: next apply destroys it' },
      after: () => ({ lines: ['reality:   shed (lanterns)', 'blueprint: shed (imported)', 'plan:      no changes'], outcome: 'no drift, shed is managed ✓' }),
      why: 'Hand-made changes are invisible to the blueprint, so the next apply "fixes" them away. When drift is something you need, bring it under management (import); when it\'s a mistake, let the apply revert it. Ignoring drift just hides the next surprise.',
      real: `$ terraform plan
  - aws_instance.shed  # created outside Terraform
$ terraform import aws_instance.shed i-0abc123
# add the matching resource block to granary.tf
$ terraform plan
No changes. Your infrastructure matches the configuration.`,
      realCaption: 'Drift detection is a "plan" on a schedule. Treat its output as a ticket.',
    },
  },

  // ------------------------------------------------------------------ 3. The Destroy Line (forced replacement)
  {
    id: 'arch-3',
    type: 'config',
    alert: 'PLAN: REPLACE GRANARY DATABASE',
    board: { broken: ['granary_db', '-/+ must be replaced'], fixed: ['granary_db', 'no replacement ✓'] },
    intro: {
      symptom: 'A small "tidy-up" pull request renames the granary ledger database. The plan output is long, and buried in it is a line nobody noticed.',
      known: [
        'Some settings can be changed in place. Others can only change by destroying and recreating the thing.',
        'The granary ledger holds every grain sale since 1987.',
        'The tidy-up changed: tags, a description, and the database name.',
      ],
      goal: 'Make the tidy-up safe: no data loss, and protect the ledger from this mistake in future.',
    },
    evidence: [
      {
        kind: 'log', id: 'plan', icon: '📋', label: 'THE PLAN', hint: 'Click lines. Look carefully at the symbols.', diff: true,
        lines: [
          { text: '~ granary_db.tags.team: "grain" → "granary"', note: 'A tag change, done in place. Safe.' },
          { text: '~ granary_db.description: updated', note: 'Description change, in place. Safe.' },
          { text: '-/+ granary_db  (forces replacement)', note: '"-/+" means destroy, then create a new, EMPTY database. Why?', evidence: true },
          { text: '      name: "granary" → "granary-ledger"  # forces replacement', note: 'There: the database name can\'t be changed in place. Renaming it means destroying it, along with every record since 1987.', evidence: true },
        ],
      },
    ],
    configTitle: 'granary_db',
    fields: [
      { kind: 'text', key: 'name', label: 'name' },
      { kind: 'text', key: 'team', label: 'tags.team' },
      { kind: 'toggle', key: 'protect', label: 'prevent_destroy', on: 'ON', off: 'OFF' },
    ],
    start: { name: 'granary-ledger', team: 'granary', protect: false },
    solution: { name: 'granary', team: 'granary', protect: true },
    applyLabel: 'PLAN & APPLY',
    verify: (x) => {
      const name = str(x.name).trim();
      return {
        cases: [
          c('database is not replaced (name unchanged)', name === 'granary'),
          c('ledger data survives', name === 'granary'),
          c('tidy-up tag still applied', str(x.team).trim() === 'granary'),
          c('ledger protected from accidental destroy in future', !!x.protect),
        ],
        hint: !x.protect && str(x.name).trim() === 'granary' ? 'Safe today. What stops the next person from making the same mistake?' : x.protect && str(x.name).trim() !== 'granary' ? 'prevent_destroy makes the apply fail instead of deleting, which is good, but the tidy-up still can\'t ship. Which change forced the replacement?' : 'Which field forces the replacement?',
      };
    },
    recap: {
      headline: 'A "harmless" rename would have deleted the ledger.',
      before: { lines: ['name: granary → granary-ledger', '-/+ forces replacement', 'prevent_destroy: off'], outcome: 'every record since 1987 deleted' },
      after: (x) => ({ lines: [`name: ${str(x.name)}`, `~ tags.team: ${str(x.team)} (in place)`, `prevent_destroy: ${x.protect ? 'on' : 'off'}`], outcome: 'ledger intact, guarded ✓' }),
      why: 'Some attributes are immutable: changing them means destroy and recreate. "-/+" in a plan is the most dangerous symbol there is. Keep the name, ship the safe parts, and add prevent_destroy so stateful resources can\'t be removed by accident.',
      real: `resource "aws_db_instance" "granary" {
  identifier = "granary"           # changing this forces replacement
  tags       = { team = "granary" }

  lifecycle {
    prevent_destroy = true
  }
}`,
      realCaption: 'Also enable deletion protection on the database itself, and take backups.',
    },
  },

  // ------------------------------------------------------------------ 4. Shared Ledger (state locking)
  {
    id: 'arch-4',
    type: 'config',
    alert: 'STATE FILE CORRUPTED',
    board: { broken: ['state: conflicting writes', 'Ada + Ben @ 14:02'], fixed: ['state: shared + locked', 'one apply at a time ✓'] },
    intro: {
      symptom: 'Ada and Ben both applied changes at 14:02. Now the record of what exists (the state ledger) is a mess: it lists a bridge that doesn\'t exist and forgets a well that does.',
      known: [
        'The state ledger is how the builders know what already exists.',
        'Right now the ledger is a file on Ada\'s laptop, copied to Ben by chat.',
        'Two applies at once both read the old ledger, then both wrote their own version.',
      ],
      goal: 'Set up the ledger so two architects can never clobber each other again.',
    },
    evidence: [
      {
        kind: 'log', id: 'log', icon: '📜', label: 'APPLY LOG', hint: 'Click lines.',
        lines: [
          { t: '14:02:01', text: 'Ada: read state (v41)', note: 'Ada starts from version 41 of the ledger.' },
          { t: '14:02:03', text: 'Ben: read state (v41)', note: 'Ben also starts from v41. Neither knows about the other.', evidence: true },
          { t: '14:02:20', text: 'Ada: wrote state v42 (+ well)', note: 'Ada saved her version: v41 plus the new well.' },
          { t: '14:02:31', text: 'Ben: wrote state v42 (+ bridge)', note: 'Ben overwrote it with his own v42, which knows about the bridge but not Ada\'s well. Last writer wins; Ada\'s change is lost from the ledger.', evidence: true },
        ],
      },
    ],
    configTitle: 'STATE BACKEND',
    fields: [
      { kind: 'choice', key: 'where', label: 'ledger lives', options: [['laptop', 'Ada\'s laptop (copied by chat)'], ['git', 'committed to git'], ['remote', 'shared town vault (remote backend)']] },
      { kind: 'toggle', key: 'lock', label: 'locking', on: 'LOCK DURING APPLY', off: 'NO LOCK' },
      { kind: 'toggle', key: 'versioning', label: 'keep old versions', on: 'VERSIONED', off: 'NOT VERSIONED' },
    ],
    start: { where: 'laptop', lock: false, versioning: false },
    solution: { where: 'remote', lock: true, versioning: true },
    applyLabel: 'SIMULATE TWO APPLIES AT ONCE',
    verify: (x) => ({
      cases: [
        c('both architects read the same, latest ledger', x.where === 'remote'),
        c('second apply waits for the first (lock)', x.where === 'remote' && !!x.lock),
        c('a bad write can be rolled back', !!x.versioning),
        c('no secrets in the ledger end up in git', x.where !== 'git'),
      ],
      hint: x.where === 'git' ? 'Git is shared, but two people can still apply at once, and state files often contain secrets.' : 'Where should a shared ledger live, and how do you stop two people writing at once?',
    }),
    recap: {
      headline: 'Two applies read the same old ledger and the last one to write won.',
      before: { lines: ['state: laptop file', 'locking: none', '14:02 Ada & Ben both apply'], outcome: 'ledger lost the well' },
      after: () => ({ lines: ['state: remote, shared', 'locking: on', 'versioning: on'], outcome: 'Ben: "waiting for lock held by Ada…" ✓' }),
      why: 'State must be shared (one source of truth), locked (one writer at a time) and versioned (so mistakes can be undone). A remote backend with locking gives all three.',
      real: `terraform {
  backend "s3" {
    bucket       = "ninefold-tf-state"   # versioning enabled
    key          = "town/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true                  # state locking
  }
}`,
      realCaption: 'Error: "Error acquiring the state lock". That means it\'s working: wait your turn.',
    },
  },

  // ------------------------------------------------------------------ 5. Reusable Plans (modules, terminal)
  {
    id: 'arch-5',
    type: 'terminal',
    alert: 'COPY-PASTE HOUSES DRIFTING APART',
    board: { broken: ['3 houses, 3 copies', 'school: no smoke alarm'], fixed: ['3 houses, 1 module', 'all have alarms ✓'] },
    intro: {
      symptom: 'The fire inspector found the school has no smoke alarm. The three town houses were built from copy-pasted blueprints, and the alarm was added to only two.',
      known: [
        'A module is one blueprint you reuse, passing in what\'s different (like the name).',
        'There\'s already a house module in modules/house.',
        'You\'re in the blueprint repo.',
      ],
      goal: 'Replace the three copies in houses.tf with three uses of the module, plan, and check that every house gets an alarm.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'ls, cat houses.tf, cat modules/house/main.tf\nterraform plan: what would change\nedit houses.tf\n\nModule usage looks like:\nmodule "library" {\n  source = "./modules/house"\n  name   = "library"\n}' }],
    term: {
      host: 'blueprints',
      motd: 'Repo: town-blueprints (main)',
      files: {
        'houses.tf': `resource "house" "library" {
  name        = "library"
  walls       = "stone"
  smoke_alarm = true
}

resource "house" "bakery" {
  name        = "bakery"
  walls       = "stone"
  smoke_alarm = true
}

resource "house" "school" {
  name  = "school"
  walls = "stone"
}`,
        'modules/house/main.tf': `variable "name" {}

resource "house" "this" {
  name        = var.name
  walls       = "stone"
  smoke_alarm = true
}`,
      },
      commands: [
        {
          match: /^terraform plan$/, usage: 'terraform plan', help: 'show what would change',
          run: (_m, s) => {
            const r = analyseHouses(s.files['houses.tf']);
            if (r.modules.length === 0) return { out: 'house.school: smoke_alarm = (none)\nNo changes. (3 resources, 2 with alarms)', evidence: true, verify: true };
            return { out: `${r.modules.map((m) => `module.${m}: house "${m}" smoke_alarm = true`).join('\n')}${r.resources.length ? `\n${r.resources.length} copy-pasted resource(s) still present` : ''}\nPlan: ${r.modules.length} houses via module`, verify: true };
          },
        },
        { match: /^grep -r smoke_alarm \.?$/, usage: 'grep -r smoke_alarm .', help: 'find every smoke_alarm', run: (_m, s) => ({ out: s.files['houses.tf'].split('\n').filter((l) => l.includes('smoke_alarm')).map((l) => `houses.tf: ${l.trim()}`).join('\n') + '\nmodules/house/main.tf: smoke_alarm = true\n(school has none)', evidence: true }) },
      ],
    },
    check: (s) => {
      const r = analyseHouses(s.files['houses.tf']);
      return {
        cases: [
          c('library, bakery and school all use the house module', ['library', 'bakery', 'school'].every((n) => r.modules.includes(n))),
          c('no copy-pasted house resources left', r.resources.length === 0),
          c('every house gets a smoke alarm', ['library', 'bakery', 'school'].every((n) => r.modules.includes(n) || r.alarmed.includes(n))),
        ],
        hint: 'Each house becomes a module block with source = "./modules/house" and its own name. Then run terraform plan.',
      };
    },
    solve: (s) => {
      s.files['houses.tf'] = ['library', 'bakery', 'school'].map((n) => `module "${n}" {\n  source = "./modules/house"\n  name   = "${n}"\n}`).join('\n\n');
    },
    recap: {
      headline: 'Three copies drifted apart. One module can\'t.',
      before: { lines: ['resource "house" "library" {…alarm}', 'resource "house" "bakery"  {…alarm}', 'resource "house" "school"  {…}'], outcome: 'school: no smoke alarm' },
      after: () => ({ lines: ['module "library" { source = "./modules/house" }', 'module "bakery"  { … }', 'module "school"  { … }'], outcome: 'all 3 houses have alarms ✓' }),
      why: 'Copy-paste means every fix has to be made N times, and someone always misses one. A module puts the shared parts in one place, so a fix there reaches every house. Pass in only what\'s different.',
      real: `module "school" {
  source = "./modules/house"
  name   = "school"
}
# then: terraform state mv house.school module.school.house.this
# (or a "moved" block) so nothing is destroyed`,
      realCaption: 'When refactoring to modules, use "moved" blocks so Terraform moves resources instead of recreating them.',
    },
  },

  // ------------------------------------------------------------------ 6. Secrets on the Blueprint (terminal)
  {
    id: 'arch-6',
    type: 'terminal',
    alert: 'VAULT PASSWORD IN GIT',
    board: { broken: ['main.tf: password = "…"', 'pushed to git ✗'], fixed: ['password from vault', 'old one rotated ✓'] },
    intro: {
      symptom: 'Someone wrote the town vault\'s password straight into the blueprint, and it\'s been pushed to the shared repo for two weeks.',
      known: [
        'Anyone who can read the repo (or its history) can read the password.',
        'The town has a secret store; blueprints can read secrets from it at build time.',
        'Removing a line doesn\'t remove it from git history.',
      ],
      goal: 'Get the password out of the code, make the code read it from the secret store, and make the leaked password useless.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'grep -ri password . (find it)\ngit log -p main.tf (history)\nedit main.tf\nVariable reference syntax: var.vault_password\nsecrets rotate vault: issue a new password and revoke the old one\nterraform plan: check config' }],
    term: {
      host: 'blueprints',
      motd: 'Repo: town-blueprints (main) · secret store: town-secrets',
      files: {
        'main.tf': `resource "vault" "town" {
  name     = "town-vault"
  password = "hunter2-correct-horse"
}`,
        'variables.tf': `variable "vault_password" {
  type      = string
  sensitive = true
  # supplied from town-secrets at plan/apply time
}`,
      },
      vars: { rotated: false },
      commands: [
        { match: /^grep -ri? password \.?$/, usage: 'grep -ri password .', help: 'search the repo', run: (_m, s) => ({ out: Object.entries(s.files).flatMap(([f, t]) => t.split('\n').filter((l) => /password/i.test(l)).map((l) => `${f}: ${l.trim()}`)).join('\n'), evidence: /password\s*=\s*"/i.test(s.files['main.tf']) }) },
        { match: /^git log -p( main\.tf)?$/, usage: 'git log -p main.tf', help: 'history of the file', run: () => ({ out: 'commit 7f3a… (2 weeks ago) "add vault"\n+  password = "hunter2-correct-horse"\n\n(cloned by 14 people since)', evidence: true }) },
        { match: /^secrets rotate vault$/, usage: 'secrets rotate vault', help: 'new password, old one revoked', run: (_m, s) => { s.vars.rotated = true; return { out: 'town-secrets: vault_password rotated (v2)\nold password revoked: anyone using it is locked out', changed: true }; } },
        {
          match: /^terraform plan$/, usage: 'terraform plan', help: 'validate & plan', run: (_m, s) => {
            const f = squash(s.files['main.tf']);
            if (/password = [a-z0-9-]{4,}/.test(f) && !/password = var\./.test(f)) return { out: 'warning: literal secret in main.tf\nNo changes.', verify: true, evidence: true };
            if (/password = var\.vault_password/.test(f)) return { out: 'var.vault_password: (sensitive value from town-secrets)\nNo changes. Configuration is valid.', verify: true };
            return { out: 'Error: vault.town: argument "password" is required', verify: true };
          },
        },
      ],
    },
    check: (s) => {
      const f = squash(s.files['main.tf']);
      return {
        cases: [
          c('no password written in the code', !/hunter2/.test(f)),
          c('code reads the password from the secret store (var.vault_password)', /password = var\.vault_password/.test(f)),
          c('leaked password rotated (useless now)', !!s.vars.rotated),
        ],
        hint: 'Three parts: remove it from code, reference the secret instead, and assume the old one is compromised.',
      };
    },
    solve: (s) => {
      s.files['main.tf'] = s.files['main.tf'].replace('"hunter2-correct-horse"', 'var.vault_password');
      s.vars.rotated = true;
    },
    recap: {
      headline: 'A secret in git is a leaked secret. Rotate it, and keep secrets out of code.',
      before: { lines: ['password = "hunter2-correct-horse"', '(in git history, 14 clones)'], outcome: 'anyone with repo access can open the vault' },
      after: () => ({ lines: ['password = var.vault_password', '(from town-secrets, rotated)'], outcome: 'leaked value revoked ✓' }),
      why: 'Deleting the line isn\'t enough: it lives on in history and in every clone. Treat it as compromised and rotate it, then load secrets from a secret manager at deploy time so they never touch the repo.',
      real: `- password = "hunter2-correct-horse"
+ password = var.vault_password

$ aws secretsmanager rotate-secret --secret-id town/vault
# and add a pre-commit secret scanner (gitleaks, trufflehog)`,
      realCaption: 'Rewriting git history is optional clean-up. Rotating the secret is the actual fix.',
    },
  },
];

function analyseHouses(tf: string): { modules: string[]; resources: string[]; alarmed: string[] } {
  const modules: string[] = [];
  const resources: string[] = [];
  const alarmed: string[] = [];
  for (const m of tf.matchAll(/module\s+"(\w+)"\s*\{([^}]*)\}/g)) if (/source\s*=\s*"\.\/modules\/house"/.test(m[2])) modules.push(m[1]);
  for (const m of tf.matchAll(/resource\s+"house"\s+"(\w+)"\s*\{([^}]*)\}/g)) {
    resources.push(m[1]);
    if (/smoke_alarm\s*=\s*true/.test(m[2])) alarmed.push(m[1]);
  }
  return { modules, resources, alarmed };
}
