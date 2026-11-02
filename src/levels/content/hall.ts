import { arr, c, has, num, type LevelSpec } from '../spec';

const TIMELINE: Record<string, string> = {
  deploy: '14:00 menu v5 deployed',
  alert: '14:06 error-rate alert pages Lin',
  ack: '14:09 Lin acknowledges, opens incident',
  find: '14:21 trace shows price-svc failing for seasonal items',
  rollback: '14:24 rollback to menu v4',
  recover: '14:27 error rate back to normal',
};

export const HALL: LevelSpec[] = [
  // ------------------------------------------------------------------ 1. Promises (SLI/SLO)
  {
    id: 'hall-1',
    type: 'config',
    alert: 'NOBODY AGREES WHAT "WORKING" MEANS',
    board: { broken: ['SLO: (none)', 'arguments: daily'], fixed: ['SLI: fast orders', 'SLO: target set ✓'] },
    intro: {
      symptom: 'The ovens team says the bakery is "up". Customers say it\'s "useless". Every incident turns into an argument about whether anything is actually wrong.',
      known: [
        'An SLI is a measurement of what customers experience.',
        'An SLO is the target for it: how good is good enough.',
        '100% is impossible, and chasing it stops all change.',
      ],
      goal: 'Choose what to measure and set a sensible target the whole town can agree on.',
    },
    evidence: [
      {
        kind: 'inspect', id: 'voices', icon: '🗣', label: 'WHAT PEOPLE SAY', hint: 'Click each.',
        items: [
          { title: 'Customer', summary: '"If checkout takes >2s I give up"', detail: 'Slow counts as broken. Speed and success both matter, and 2 seconds is the line.', evidence: true },
          { title: 'Customer', summary: '"It\'s fine if it fails once in a while"', detail: 'Customers tolerate the occasional failure. They don\'t need perfection.', evidence: true },
          { title: 'Ovens team', summary: '"The servers are up 100%!"', detail: 'Servers being up doesn\'t mean orders work. That measures machines, not customers.' },
          { title: 'Mayor Bo', summary: '"99.99% would need 3 extra bakers"', detail: 'Each extra nine costs a lot. Below about 99%, customers start leaving.', evidence: true },
        ],
      },
    ],
    configTitle: 'BAKERY SLO',
    fields: [
      { kind: 'choice', key: 'sli', label: 'measure (SLI)', options: [['up', 'servers up (%)'], ['cpu', 'CPU below 80%'], ['orders', 'orders that succeed in under 2s (%)'], ['temp', 'oven temperature ok']] },
      { kind: 'number', key: 'target', label: 'target (SLO)', min: 90, max: 100, unit: '% over 30 days', step: 0.1 },
    ],
    start: { sli: 'up', target: 100 },
    solution: { sli: 'orders', target: 99.5 },
    applyLabel: 'CHECK AGAINST LAST QUARTER',
    verify: (x) => {
      const t = num(x.target);
      return {
        cases: [
          c('measures what customers experience', x.sli === 'orders'),
          c('leaves room to change things (target < 100%)', t < 100),
          c('customers stay happy (target ≥ 99%)', t >= 99),
          c('affordable (target ≤ 99.9%)', t <= 99.9),
        ],
        hint: x.sli !== 'orders' ? 'Would that number have warned you when customers were unhappy?' : 'Look at what customers tolerate and what each extra nine costs.',
      };
    },
    recap: {
      headline: 'Measure what customers feel, and aim for good enough, not perfect.',
      before: { lines: ['SLI: servers up', 'SLO: 100%'], outcome: 'up 100% while customers suffer' },
      after: (x) => ({ lines: ['SLI: orders OK in < 2s', `SLO: ${num(x.target)}% / 30 days`], outcome: `error budget: ${(100 - num(x.target)).toFixed(1)}% to spend ✓` }),
      why: 'An SLI must reflect user experience: success AND speed. The SLO is a deliberate trade-off: the gap to 100% is the error budget you can "spend" on releases and experiments. It ends the arguments, because the number decides.',
      real: `# SLI (PromQL)
sum(rate(orders_total{status="ok", le="2"}[30d]))
  / sum(rate(orders_total[30d]))
# SLO: 99.5% over 30 days → error budget 0.5% ≈ 216 minutes`,
      realCaption: 'Tools like Sloth or Pyrra generate SLO alert rules from a spec like this.',
    },
  },

  // ------------------------------------------------------------------ 2. Budget Burn (error budget)
  {
    id: 'hall-2',
    type: 'config',
    alert: 'ERROR BUDGET 83% GONE IN 3 DAYS',
    board: { broken: ['SLO 99.5% / 30d', 'budget used: 180 min'], fixed: ['policy: freeze risky changes', 'budget recovering ✓'] },
    intro: {
      symptom: 'Three risky releases in three days caused 180 minutes of bad service. It\'s day 3 of the 30-day window.',
      known: [
        'SLO: 99.5% of minutes good over 30 days.',
        'A 30-day month has 43,200 minutes.',
        'The team wants to ship a big new menu feature tomorrow.',
      ],
      goal: 'Work out how much budget is left, and decide what the team does next.',
    },
    evidence: [
      { kind: 'chart', id: 'burn', icon: '📈', label: 'BUDGET BURN', hint: 'Bad minutes by day. Click.', bars: [{ label: 'day 1', value: 70, note: 'Release A: 70 bad minutes.', evidence: true }, { label: 'day 2', value: 50, note: 'Release B: 50 bad minutes.', evidence: true }, { label: 'day 3', value: 60, note: 'Release C: 60 bad minutes. Total so far: 180.', evidence: true }], unit: 'm' },
      { kind: 'doc', id: 'math', icon: '🧮', label: 'THE MATH', text: 'Error budget = (100% − SLO) × minutes in window\n= 0.5% × 43,200\n= ? minutes\n\nRemaining = budget − used' },
    ],
    configTitle: 'BUDGET REVIEW',
    fields: [
      { kind: 'number', key: 'left', label: 'budget left', min: 0, max: 500, unit: 'minutes' },
      { kind: 'choice', key: 'policy', label: 'next 27 days', options: [['ship', 'ship features as usual'], ['freeze', 'pause risky releases, fix what caused the 3 incidents'], ['lower', 'lower the SLO to 95% so we\'re "fine"'], ['oncall', 'add a second on-call person and carry on']] },
    ],
    start: { left: 0, policy: 'ship' },
    solution: { left: 36, policy: 'freeze' },
    applyLabel: 'PRESENT TO THE MAYOR',
    verify: (x) => ({
      cases: [
        c(`budget left: ${num(x.left)} min (216 − 180)`, num(x.left) === 36),
        c('next big release won\'t blow the SLO', x.policy === 'freeze'),
        c('the promise to customers stays the same', x.policy !== 'lower'),
      ],
      hint: num(x.left) !== 36 ? 'Work it out: 0.5% of 43,200 minutes, minus what\'s been used.' : x.policy === 'lower' ? 'Moving the goalposts doesn\'t make customers happier.' : 'With 36 minutes left, what happens if tomorrow\'s release goes like the last three?',
    }),
    recap: {
      headline: '216 minutes of budget, 180 spent in 3 days: time to slow down.',
      before: { lines: ['budget: 216 min', 'used:   180 min (day 3)', 'plan:   keep shipping'], outcome: 'next bad release breaks the SLO' },
      after: (x) => ({ lines: ['budget: 216 min', `left:   ${num(x.left)} min`, 'plan:   freeze risky changes, fix causes'], outcome: 'SLO kept, team learns ✓' }),
      why: 'The error budget turns reliability into an objective decision. While there\'s budget, ship. When it\'s nearly gone, slow down and invest in reliability. Lowering the target to dodge the decision breaks the promise to customers.',
      real: `error budget = (1 − 0.995) × 30 × 24 × 60 = 216 min
burn rate    = 180 / (216 × 3/30) ≈ 8.3×   # 8× faster than sustainable
# multi-window burn-rate alert:
# page if burn rate > 14.4 over 1h AND over 5m`,
      realCaption: 'Agree on the error-budget policy before you need it.',
    },
  },

  // ------------------------------------------------------------------ 3. Festival Day (capacity)
  {
    id: 'hall-3',
    type: 'config',
    alert: 'HARVEST FESTIVAL NEXT WEEK',
    board: { broken: ['expected: 2000 req/s', 'capacity: 600 req/s'], fixed: ['festival: handled', 'p95 < 1s ✓'] },
    intro: {
      symptom: 'Last year\'s festival took the bakery site down for four hours. This year 2,000 requests per second are expected at peak, five times normal.',
      known: [
        'Each server handles 200 req/s comfortably (at about 60% CPU), and about 330 req/s flat out.',
        'Normally 3 servers serve about 400 req/s.',
        'The autoscaler adds servers when average CPU goes above its target.',
      ],
      goal: 'Set up autoscaling so the festival is handled, without paying for festival-size capacity all year.',
    },
    evidence: [
      { kind: 'chart', id: 'last', icon: '📈', label: 'LAST FESTIVAL', hint: 'Requests/s last year by hour. Click.', bars: [{ label: '10:00', value: 500, note: 'Normal-ish.' }, { label: '12:00', value: 1400, note: 'Climbing fast.' }, { label: '14:00', value: 1900, note: 'Peak around 1900/s. Max was 3 servers = ~1000/s flat out. Everything fell over.', evidence: true }, { label: '16:00', value: 900, note: 'Coming down.' }], unit: '/s' },
      { kind: 'doc', id: 'math', icon: '🧮', label: 'THE MATH', text: 'Servers needed = peak ÷ requests per server at your CPU target.\nAt 60% CPU a server does ~200 req/s.\nAt 90% CPU: ~300 req/s, but no room for spikes and latency suffers.\n\nKeep at least 2 servers for redundancy.' },
    ],
    configTitle: 'AUTOSCALER',
    fields: [
      { kind: 'number', key: 'min', label: 'min servers', min: 1, max: 30 },
      { kind: 'number', key: 'max', label: 'max servers', min: 1, max: 40 },
      { kind: 'number', key: 'cpu', label: 'target CPU', min: 20, max: 95, unit: '%', step: 5 },
    ],
    start: { min: 3, max: 3, cpu: 60 },
    solution: { min: 3, max: 12, cpu: 60 },
    applyLabel: 'SIMULATE FESTIVAL DAY',
    verify: (x) => {
      const per = 330 * (num(x.cpu) / 100);
      const need = Math.ceil(2000 / per);
      return {
        cases: [
          c(`festival peak needs ${need} servers at ${num(x.cpu)}% CPU; max is ${num(x.max)}`, num(x.max) >= need),
          c('room for sudden spikes (target ≤ 75%)', num(x.cpu) <= 75),
          c('survives one server failing (min ≥ 2)', num(x.min) >= 2),
          c('min ≤ max', num(x.min) <= num(x.max)),
        ],
        hint: 'Work out servers needed from the peak and per-server capacity at your target.',
        wasteful: num(x.min) > 5 ? `${num(x.min)} servers all year round when normal days need 3: you pay festival prices every day.` : num(x.cpu) < 40 ? 'such a low CPU target means running lots of half-idle servers.' : undefined,
      };
    },
    recap: {
      headline: 'Capacity planning is arithmetic: peak ÷ per-server capacity, plus headroom.',
      before: { lines: ['min 3 · max 3', '3 × ~330/s = ~1000/s'], outcome: 'festival 2000/s → outage' },
      after: (x) => ({ lines: [`min ${num(x.min)} · max ${num(x.max)} · target ${num(x.cpu)}%`, `up to ${num(x.max)} × ${Math.round(330 * num(x.cpu) / 100)}/s`], outcome: 'festival handled, normal days cheap ✓' }),
      why: 'Use last year\'s peak to size the max, keep a CPU target that leaves room for spikes and slow scale-up, and keep the minimum low so you only pay for the festival on festival day. Load-test before the big day.',
      real: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 3
  maxReplicas: 12
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }`,
      realCaption: 'Check the database and other dependencies can take 4× too. That\'s the Big Incident in Act 2.',
    },
  },

  // ------------------------------------------------------------------ 4. The Treasury (cost)
  {
    id: 'hall-4',
    type: 'config',
    alert: 'TOWN BILL DOUBLED',
    board: { broken: ['monthly bill: 12,400', 'last year: 6,100'], fixed: ['monthly bill: lower', 'nothing broken ✓'] },
    intro: {
      symptom: 'The town\'s cloud bill doubled in a year, and nobody can say why. Bo wants it cut by at least 40%, without breaking anything.',
      known: [
        'Bills hide in things that are on but unused.',
        'Some expensive things are expensive for a reason.',
        'Check each item before you cut it.',
      ],
      goal: 'Cut the bill by 40% or more without hurting production or breaking any rules.',
    },
    evidence: [
      {
        kind: 'inspect', id: 'bill', icon: '🧾', label: 'BILL BREAKDOWN', hint: 'Click each line item.',
        items: [
          { title: 'dev servers ×12', summary: '4,800/month · 5% avg CPU', detail: 'Twelve large dev servers running 24/7, but used only in office hours, and barely then. Scheduling them off nights and weekends saves ~70%; smaller sizes save more.', evidence: true },
          { title: 'unattached disks ×31', summary: '1,100/month', detail: 'Disks left behind by deleted servers. Attached to nothing, used by nothing.', evidence: true },
          { title: '2019 tax snapshot (5 TB)', summary: '900/month', detail: 'Legal note: "Keep until 2029. Only copy of 2019 tax records." Expensive, but required.', evidence: true },
          { title: 'production database', summary: '3,200/month · 70% CPU', detail: 'Busy and appropriately sized. Shrinking it would slow the bakery down.' },
          { title: 'production servers', summary: '2,400/month · 55% CPU', detail: 'Well used.' },
        ],
      },
    ],
    configTitle: 'COST ACTIONS',
    fields: [{ kind: 'set', key: 'acts', label: 'do', options: [['schedule', 'turn dev servers off nights & weekends'], ['rightsize', 'shrink dev servers to small'], ['disks', 'delete unattached disks'], ['snapshot', 'delete the 2019 snapshot'], ['prodDb', 'shrink production database'], ['prodSrv', 'remove 2 production servers']] }],
    start: { acts: [] },
    solution: { acts: ['schedule', 'rightsize', 'disks'] },
    applyLabel: 'SIMULATE NEXT MONTH',
    verify: (x) => {
      const a = arr(x.acts);
      let dev = 4800;
      if (has(a, 'rightsize')) dev *= 0.5;
      if (has(a, 'schedule')) dev *= 0.3;
      const bill = dev + (has(a, 'disks') ? 0 : 1100) + (has(a, 'snapshot') ? 0 : 900) + (has(a, 'prodDb') ? 1600 : 3200) + (has(a, 'prodSrv') ? 1600 : 2400);
      const cut = Math.round((1 - bill / 12400) * 100);
      return {
        cases: [
          c(`bill ${Math.round(bill)} (${cut}% lower; target ≥ 40%)`, cut >= 40),
          c('legal records kept', !has(a, 'snapshot')),
          c('production stays fast', !has(a, 'prodDb') && !has(a, 'prodSrv')),
        ],
        hint: has(a, 'snapshot') ? 'Read the legal note on the snapshot.' : has(a, 'prodDb') || has(a, 'prodSrv') ? 'Production is busy. Cutting it would hurt customers.' : 'Which items are big AND unused?',
      };
    },
    recap: {
      headline: 'Most of the increase was idle dev servers and forgotten disks.',
      before: { lines: ['dev 4,800 (5% CPU, 24/7)', 'orphan disks 1,100', 'snapshot 900 · prod 5,600'], outcome: '12,400 / month' },
      after: (x) => {
        const a = arr(x.acts);
        let dev = 4800;
        if (has(a, 'rightsize')) dev *= 0.5;
        if (has(a, 'schedule')) dev *= 0.3;
        const bill = dev + (has(a, 'disks') ? 0 : 1100) + 900 + 5600;
        return { lines: [`dev ${Math.round(dev)}`, `orphan disks ${has(a, 'disks') ? 0 : 1100}`, 'snapshot 900 (legal) · prod 5,600'], outcome: `${Math.round(bill)} / month ✓` };
      },
      why: 'Cost work is investigation: find spend with no value (idle, orphaned, oversized), and check each item\'s purpose before deleting. Production that\'s busy and records that are required are worth their price.',
      real: `$ aws ec2 describe-volumes --filters Name=status,Values=available   # orphan disks
$ aws ce get-cost-and-usage --group-by Type=TAG,Key=env
# Instance Scheduler: stop env=dev 19:00–08:00 and weekends`,
      realCaption: 'Tag everything with owner and environment, or you\'ll never know what\'s safe to cut.',
    },
  },

  // ------------------------------------------------------------------ 5. The Postmortem
  {
    id: 'hall-5',
    type: 'config',
    alert: 'POSTMORTEM DUE TODAY',
    board: { broken: ['incident #212', 'postmortem: draft'], fixed: ['postmortem published', 'action items ✓'] },
    intro: {
      symptom: 'Yesterday\'s 27-minute menu outage needs a postmortem by tonight. The notes are a jumble and the first draft blames Ben by name.',
      known: [
        'A postmortem explains what happened, why, and what changes so it can\'t recur.',
        'Blameless means focusing on systems, not on people.',
        'The real postmortem template has: timeline, contributing factors, action items.',
      ],
      goal: 'Put the timeline in order, identify the real contributing factors, and choose a blameless summary.',
    },
    evidence: [
      {
        kind: 'log', id: 'notes', icon: '🗒', label: 'INCIDENT NOTES', hint: 'Raw notes from the chat. Click lines.',
        lines: [
          { text: 'Ben: "I deployed v5 at 14:00, tests were green"', note: 'Tests passed, but there was no test with a seasonal item without a price.', evidence: true },
          { text: 'Lin: "alert took 6 minutes to fire"', note: 'The alert waits 5 minutes before paging. Reasonable to avoid noise.' },
          { text: 'Lin: "rollback took 3 minutes, but finding the cause took 12"', note: 'There was no dashboard for errors by item type; Lin had to dig through traces.', evidence: true },
          { text: 'Ada: "v5 was deployed to 100% at once"', note: 'No canary: everyone got v5 at the same time. A 10% canary would have caught this.', evidence: true },
        ],
      },
    ],
    configTitle: 'POSTMORTEM #212',
    fields: [
      { kind: 'order', key: 'timeline', label: 'timeline (oldest first)', labels: TIMELINE },
      { kind: 'set', key: 'factors', label: 'contributing factors', options: [['notest', 'no test for items without a price'], ['nocanary', 'released to 100% at once (no canary)'], ['nodash', 'no dashboard for errors by item'], ['ben', 'Ben was careless'], ['friday', 'it was a Thursday']] },
      { kind: 'choice', key: 'summary', label: 'summary', options: [['blame', '"Ben broke the menu. Ben will be more careful."'], ['vague', '"Things went wrong. We will try harder."'], ['blameless', '"A missing price for a new item reached all customers at once. We\'ll add a test, canary releases, and an errors-by-item panel."']] },
    ],
    start: { timeline: ['rollback', 'alert', 'deploy', 'recover', 'find', 'ack'], factors: ['ben'], summary: 'blame' },
    solution: { timeline: ['deploy', 'alert', 'ack', 'find', 'rollback', 'recover'], factors: ['notest', 'nocanary', 'nodash'], summary: 'blameless' },
    applyLabel: 'PUBLISH',
    verify: (x) => {
      const t = arr(x.timeline);
      const f = arr(x.factors);
      return {
        cases: [
          c('timeline in order', t.join() === 'deploy,alert,ack,find,rollback,recover'),
          c('all three system factors found', has(f, 'notest') && has(f, 'nocanary') && has(f, 'nodash')),
          c('no blame on a person, no red herrings', !has(f, 'ben') && !has(f, 'friday')),
          c('summary is blameless and actionable', x.summary === 'blameless'),
        ],
        hint: 'Each contributing factor should be something you can change in the system. Order by time.',
      };
    },
    recap: {
      headline: 'Not "who broke it?" but "what let it break, and what will we change?"',
      before: { lines: ['timeline: jumbled', 'cause: "Ben was careless"', 'action: "be more careful"'], outcome: 'nothing changes, it happens again' },
      after: () => ({ lines: ['timeline: 14:00 → 14:27', 'factors: no test, no canary, no dashboard', 'actions: 3 concrete fixes'], outcome: 'the system gets safer ✓' }),
      why: 'Blame makes people hide mistakes; blameless reviews surface them. Look for the conditions that let a normal action cause harm, and turn each one into an action item with an owner.',
      real: `## Incident #212: Menu errors (27 min)
**Impact:** 12% of orders failed 14:00–14:27
**Contributing factors:** missing test case; 100% rollout; no per-item error panel
**Action items:**
- [ ] Test: items without price (owner: Ben, due Fri)
- [ ] Canary 10% → 50% → 100% (owner: Ines)
- [ ] Dashboard: errors by item type (owner: Lin)`,
      realCaption: 'Track action items to completion, or the postmortem was just a story.',
    },
  },

  // ------------------------------------------------------------------ 6. The Rota (toil, terminal)
  {
    id: 'hall-6',
    type: 'terminal',
    alert: 'NIGHTLY MANUAL RESTART (AGAIN)',
    board: { broken: ['cache restarted by hand', '47 nights in a row'], fixed: ['cache: bounded', 'no restarts needed ✓'] },
    intro: {
      symptom: 'Every night around 2am someone is woken to restart the menu cache, because it slowly eats all the memory. It\'s happened 47 nights in a row.',
      known: [
        'Repetitive manual work like this is called toil.',
        'Automating the restart would stop the pages, but the cache would still be broken.',
        'You\'re on the cache server.',
      ],
      goal: 'Find why the cache grows forever and fix the cause, so nobody has to restart it.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'history: what on-call has been doing\ncache info memory\ncat / edit cache.conf\ncache restart\ncache simulate-week: watch memory over a week\nedit crontab: schedule a command (cron)' }],
    term: {
      host: 'cache-1',
      motd: 'menu cache (redis-like) · 8 GB RAM',
      files: { 'cache.conf': `port 6379
# memory
maxmemory 0            # 0 = unlimited
maxmemory-policy noeviction`, crontab: '# m h dom mon dow command' },
      vars: { running: '' },
      commands: [
        { match: /^history$/, usage: 'history', help: 'recent on-call commands', run: () => ({ out: ' 2:04  cache restart   (Lin)\n 2:11  cache restart   (Ben)\n 2:02  cache restart   (Lin)\n … 47 nights', evidence: true }) },
        { match: /^cache info memory$/, usage: 'cache info memory', help: 'memory stats', run: (_m, s) => { const c2 = cacheConf(String(s.vars.running || s.files['cache.conf'])); return { out: `used_memory: 7.6 GB / 8 GB\nmaxmemory: ${c2.max || '0 (unlimited)'}\npolicy: ${c2.policy}\nevicted_keys: ${c2.ok ? 'thousands (old menus removed) ✓' : '0 (nothing is ever removed)'}`, evidence: !c2.ok }; } },
        { match: /^cache restart$/, usage: 'cache restart', help: 'restart with cache.conf', run: (_m, s) => { s.vars.running = s.files['cache.conf']; return { out: 'cache restarted (memory freed)', changed: true }; } },
        { match: /^cache simulate-week$/, usage: 'cache simulate-week', help: 'fast-forward a week', run: (_m, s) => { const c2 = cacheConf(String(s.vars.running || '')); const cron = /cache restart/.test(s.files.crontab); return { out: c2.ok ? 'memory stays at ~2 GB all week, old entries evicted, 0 restarts ✓' : cron ? 'memory hits 8 GB nightly → cron restarts it at 2:00 → cache empty, menu slow for 10 min each morning' : 'memory hits 8 GB on night 1 → OOM → page', verify: true }; } },
      ],
    },
    check: (s) => {
      const c2 = cacheConf(String(s.vars.running || ''));
      return {
        cases: [c('cache has a memory limit', c2.max !== ''), c('old entries are evicted when full (LRU)', c2.policy.includes('lru')), c('running cache uses the new settings', !!s.vars.running && c2.ok), c('no restart cron hiding the problem', !/cache restart/.test(s.files.crontab))],
        hint: /cache restart/.test(s.files.crontab) ? 'Automating the restart makes the toil invisible but keeps the bug. Fix why it grows.' : 'Set maxmemory (e.g. 2gb) and an eviction policy like allkeys-lru, then restart.',
      };
    },
    solve: (s) => { s.files['cache.conf'] = s.files['cache.conf'].replace('maxmemory 0            # 0 = unlimited', 'maxmemory 2gb').replace('noeviction', 'allkeys-lru'); s.vars.running = s.files['cache.conf']; },
    recap: {
      headline: 'The cache never forgot anything, so it filled memory every night.',
      before: { lines: ['maxmemory 0 (unlimited)', 'policy noeviction', 'fix: human restarts at 2am'], outcome: '47 pages, 47 nights' },
      after: (s) => { const c2 = cacheConf(String(s.vars.running)); return { lines: [`maxmemory ${c2.max}`, `policy ${c2.policy}`], outcome: 'flat memory, 0 restarts ✓' }; },
      why: 'Toil is manual, repetitive work that scales with the system. The best automation removes the need for the work entirely: here, a cache with a size limit and an eviction policy. A cron restart would have hidden the bug.',
      real: `# redis.conf
- maxmemory 0
- maxmemory-policy noeviction
+ maxmemory 2gb
+ maxmemory-policy allkeys-lru`,
      realCaption: 'Rule of thumb: keep toil under 50% of on-call time. Fix causes, not symptoms.',
    },
  },
];

function cacheConf(conf: string): { max: string; policy: string; ok: boolean } {
  const lines = conf.split('\n').map((l) => l.replace(/#.*$/, '').trim());
  const max = lines.find((l) => l.startsWith('maxmemory '))?.split(/\s+/)[1] ?? '';
  const policy = lines.find((l) => l.startsWith('maxmemory-policy'))?.split(/\s+/)[1] ?? 'noeviction';
  const maxOk = /^\d+(mb|gb|kb)?$/i.test(max) && max !== '0';
  return { max: maxOk ? max : '', policy, ok: maxOk && /lru|lfu/.test(policy) };
}

