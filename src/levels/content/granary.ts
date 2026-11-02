import { arr, c, has, num, type LevelSpec } from '../spec';
import { squash } from '../terminal';

export const GRANARY: LevelSpec[] = [
  // ------------------------------------------------------------------ 1. Full Barn (disk full)
  {
    id: 'granary-1',
    type: 'config',
    alert: 'BARN FULL: NEW GRAIN REJECTED',
    board: { broken: ['barn: 100% full', 'new orders: rejected'], fixed: ['barn: 41% full', 'orders: accepted ✓'] },
    intro: {
      symptom: 'The barn is full to the rafters. Farmers arriving with today\'s harvest are being turned away, so orders can\'t be saved.',
      known: [
        'The barn holds grain (real data) and log sacks (records of every barn event).',
        'Nobody has ever thrown a log sack away.',
        'The auditor needs the last 30 days of logs.',
      ],
      goal: 'Free up space so it stays free, without losing grain or logs the auditor needs.',
    },
    evidence: [
      {
        kind: 'chart', id: 'space', icon: '📈', label: 'WHAT\'S IN THE BARN', hint: 'Share of barn space (%). Click each.',
        bars: [
          { label: 'grain', value: 16, note: 'Real data: 16%. Growing slowly and steadily.' },
          { label: 'logs <30d', value: 3, note: 'The last 30 days of logs: 3%. The auditor needs these.' },
          { label: 'logs >30d', value: 81, note: 'Logs older than 30 days: 81% of the barn! Never rotated, never compressed, kept forever.', evidence: true },
        ],
        unit: '%',
      },
      { kind: 'log', id: 'growth', icon: '📜', label: 'BARN NOTES', hint: 'Click lines.', lines: [{ text: 'logs grow 2% of the barn per week', note: 'Without rotation, the barn fills up again regardless of size.', evidence: true }, { text: 'quote: a barn twice the size, 4,000 coins', note: 'A bigger barn just postpones it: logs would fill it again in about 40 weeks.' }] },
    ],
    configTitle: 'BARN HOUSEKEEPING',
    fields: [
      { kind: 'toggle', key: 'rotate', label: 'rotate & compress logs', on: 'ON', off: 'OFF' },
      { kind: 'number', key: 'keep', label: 'keep logs for', min: 1, max: 3650, unit: 'days' },
      { kind: 'toggle', key: 'bigger', label: 'buy a bigger barn', on: 'BUY', off: 'NO' },
    ],
    start: { rotate: false, keep: 3650, bigger: false },
    solution: { rotate: true, keep: 30, bigger: false },
    applyLabel: 'RUN FOR A YEAR',
    verify: (x) => {
      const keep = num(x.keep);
      const ok = !!x.rotate && keep <= 90;
      return {
        cases: [
          c('barn has room today', ok || !!x.bigger),
          c('barn still has room in a year', ok),
          c(`auditor gets 30 days of logs (keeping ${keep})`, keep >= 30),
          c('no grain thrown away', true),
        ],
        hint: x.bigger && !ok ? 'A bigger barn fills up again. What keeps growing forever?' : keep < 30 ? 'The auditor needs 30 days.' : 'What\'s taking 81% of the space, and does it need to stay forever?',
        wasteful: x.bigger && ok ? 'with rotation on, the new barn isn\'t needed: 4,000 coins for empty space.' : undefined,
      };
    },
    recap: {
      headline: 'Old logs nobody needed filled 81% of the barn.',
      before: { lines: ['grain 16% · logs<30d 3%', 'logs>30d 81% (kept forever)'], outcome: 'disk 100%, writes fail' },
      after: (x) => ({ lines: [`rotate+compress: ${x.rotate ? 'on' : 'off'}`, `retain: ${num(x.keep)} days`], outcome: 'disk ~41%, stays flat ✓' }),
      why: 'Disks fill up from things that grow forever: logs, temp files, old backups. Find what\'s using the space first, then add a retention policy so it can\'t recur. A bigger disk only buys time.',
      real: `$ du -sh /var/log/* | sort -h | tail
81G  /var/log/granary
# /etc/logrotate.d/granary
/var/log/granary/*.log {
  daily
  rotate 30
  compress
}`,
      realCaption: 'Alert on disk usage trend ("full in 4 days"), not just on the current percentage.',
    },
  },

  // ------------------------------------------------------------------ 2. Lost Index
  {
    id: 'granary-2',
    type: 'config',
    alert: 'FINDING ONE SACK TAKES ALL DAY',
    board: { broken: ['find by customer:', 'scans 50,000 sacks'], fixed: ['find by customer:', '0.02s ✓'] },
    intro: {
      symptom: 'Every time a customer collects their order, Gus walks the entire barn looking for sacks with their name. The queue goes out the door.',
      known: [
        'The barn has a card index, but only by sack number.',
        'Customers ask by name, not number.',
        'Every index card must be updated whenever a sack arrives, so cards aren\'t free.',
      ],
      goal: 'Make customer pickups fast without slowing every delivery.',
    },
    evidence: [
      {
        kind: 'log', id: 'slow', icon: '🐢', label: 'SLOW QUERY LOG', hint: 'The slowest lookups today. Click.',
        lines: [
          { text: 'find sacks where customer = "Rosa": 42s, scanned 50,000', note: 'Every pickup reads every sack, because there\'s no index on customer.', evidence: true },
          { text: 'find sack where id = 1204: 0.01s, scanned 1', note: 'By sack number it\'s instant. That one has an index.' },
          { text: 'find sacks where colour = "red": 40s (run once, last year)', note: 'Rare. Not worth an index.' },
        ],
      },
      { kind: 'chart', id: 'freq', icon: '📈', label: 'LOOKUPS PER DAY', hint: 'How often each kind of lookup happens.', bars: [{ label: 'by id', value: 30, note: 'Already indexed.' }, { label: 'by cust', value: 400, note: '400 a day, and each takes 42s. This is the one to fix.', evidence: true }, { label: 'by colour', value: 0.01, note: 'Almost never.' }, { label: 'by weight', value: 0.1, note: 'Almost never.' }] },
    ],
    configTitle: 'CARD INDEXES',
    fields: [{ kind: 'set', key: 'idx', label: 'index on', options: [['id', 'sack id'], ['customer', 'customer name'], ['colour', 'sack colour'], ['weight', 'weight']] }],
    start: { idx: ['id'] },
    solution: { idx: ['id', 'customer'] },
    applyLabel: 'RUN A DAY OF PICKUPS',
    verify: (x) => {
      const i = arr(x.idx);
      return {
        cases: [c('pickups by name under 1s', has(i, 'customer')), c('lookups by sack id still instant', has(i, 'id')), c('deliveries not slowed by needless indexes', !has(i, 'colour') && !has(i, 'weight'))],
        hint: i.length > 2 ? 'Every index costs time on every delivery. Index what\'s queried often.' : 'Which lookup is slow AND frequent?',
      };
    },
    recap: {
      headline: 'Pickups searched by name, but the index was only on sack number.',
      before: { lines: ['index: (id)', 'WHERE customer = …', '→ full scan, 50,000 rows'], outcome: '42s per pickup' },
      after: (x) => ({ lines: [`indexes: ${arr(x.idx).map((v) => `(${v})`).join(' ')}`, 'WHERE customer = …', '→ index lookup'], outcome: '0.02s per pickup ✓' }),
      why: 'Without an index, a database reads every row to answer a query. Index the columns you filter on often, and skip the rarely-used ones, because each index slows down writes.',
      real: `EXPLAIN SELECT * FROM sacks WHERE customer = 'Rosa';
  Seq Scan on sacks (rows=50000)
CREATE INDEX CONCURRENTLY sacks_customer_idx ON sacks (customer);
  Index Scan using sacks_customer_idx (rows=12)`,
      realCaption: 'EXPLAIN shows the query plan. "Seq Scan" on a big table is the classic missing-index smell.',
    },
  },

  // ------------------------------------------------------------------ 3. The Untested Backup
  {
    id: 'granary-3',
    type: 'config',
    alert: 'RESTORE DRILL FAILED',
    board: { broken: ['backups: nightly ✓', 'restore drill: FAILED'], fixed: ['restore drill: PASSED', 'offsite ✓ weekly ✓'] },
    intro: {
      symptom: 'For the first time ever, Mayor Bo asked for a restore drill: pretend the ledger is lost and rebuild it from backup. It failed.',
      known: [
        'Backups have run every night for three years.',
        'Nobody has ever tried restoring one.',
        'A backup you can\'t restore isn\'t a backup.',
      ],
      goal: 'Fix the backups so a fire in the granary can\'t lose the ledger, and prove it.',
    },
    evidence: [
      {
        kind: 'inspect', id: 'drill', icon: '🔥', label: 'DRILL REPORT', hint: 'What went wrong in the drill. Click each.',
        items: [
          { title: 'Restored tables', summary: 'customers, sacks', detail: 'Two tables came back fine…' },
          { title: 'Missing table', summary: 'orders: not in backup', detail: 'The orders table was added two years ago, but the backup job lists tables by name and was never updated. Two years of orders were never backed up.', evidence: true },
          { title: 'Backup location', summary: 'same disk as the database', detail: 'Backups sit on the same disk in the same barn. A fire or disk failure takes the data AND the backups.', evidence: true },
          { title: 'Last restore test', summary: 'never', detail: 'Nobody found these problems because nobody tried.' },
        ],
      },
    ],
    configTitle: 'BACKUP JOB',
    fields: [
      { kind: 'set', key: 'tables', label: 'include', options: [['customers', 'customers'], ['sacks', 'sacks'], ['orders', 'orders'], ['all', 'ALL tables (incl. future ones)']] },
      { kind: 'choice', key: 'where', label: 'store in', options: [['same', 'same disk'], ['barn', 'another disk, same barn'], ['offsite', 'another town (offsite)']] },
      { kind: 'toggle', key: 'drill', label: 'automatic weekly restore test', on: 'ON', off: 'OFF' },
    ],
    start: { tables: ['customers', 'sacks'], where: 'same', drill: false },
    solution: { tables: ['all'], where: 'offsite', drill: true },
    applyLabel: 'SIMULATE A GRANARY FIRE',
    verify: (x) => {
      const t = arr(x.tables);
      const complete = has(t, 'all') || ['customers', 'sacks', 'orders'].every((n) => has(t, n));
      return {
        cases: [
          c('backups survive the fire', x.where === 'offsite'),
          c('every table is restored', complete),
          c('a table added next year will be backed up too', has(t, 'all')),
          c('next problem is caught within a week', !!x.drill),
        ],
        hint: 'Think about the fire, about tables nobody remembers to list, and about how you\'d find the next problem.',
      };
    },
    recap: {
      headline: 'Three years of backups, and they couldn\'t restore the most important table.',
      before: { lines: ['tables: customers, sacks', 'where: same disk', 'restore tests: never'], outcome: 'fire = orders lost forever' },
      after: (x) => ({ lines: [`tables: ${arr(x.tables).join(', ')}`, `where: ${x.where}`, `restore tests: ${x.drill ? 'weekly' : 'never'}`], outcome: 'drill passed: full ledger back ✓' }),
      why: 'Backups fail silently. Back up everything by default, keep copies somewhere a single disaster can\'t reach, and test restores regularly, since a restore test is the only proof a backup works.',
      real: `$ pg_dump --format=custom granary > /tmp/granary.dump   # all tables
$ aws s3 cp /tmp/granary.dump s3://backups-other-region/
# weekly CI job:
$ pg_restore -d granary_drill granary.dump && ./verify-row-counts.sh`,
      realCaption: '3-2-1 rule: 3 copies, 2 kinds of media, 1 offsite. Plus restore drills.',
    },
  },

  // ------------------------------------------------------------------ 4. Echo Delay (replication lag)
  {
    id: 'granary-4',
    type: 'config',
    alert: 'LEDGER COPY HOURS BEHIND',
    board: { broken: ['replica lag: 3h 12m', 'and growing'], fixed: ['replica lag: < 1s', 'stable ✓'] },
    intro: {
      symptom: 'Shops reading from the copy of the ledger (the replica) see stock that sold out hours ago. The copy is 3 hours behind the original and getting worse.',
      known: [
        'Every write to the original is replayed on the copy.',
        'The original handles 400 writes per second at peak.',
        'The nightly sales report also runs on the copy.',
      ],
      goal: 'Get the copy keeping up in real time, even during the nightly report.',
    },
    evidence: [
      {
        kind: 'chart', id: 'lag', icon: '📈', label: 'REPLICA LAG', hint: 'Lag in minutes over the day. Click.',
        bars: [
          { label: '18:00', value: 4, note: 'Small lag building up.' },
          { label: '21:00', value: 30, note: 'Growing as evening writes peak.' },
          { label: '00:00', value: 120, note: 'The nightly report starts on the copy and lag jumps.', evidence: true },
          { label: '03:00', value: 192, note: '3h12m behind. It never catches up.' },
        ],
        unit: 'm',
      },
      {
        kind: 'inspect', id: 'hw', icon: '💽', label: 'MACHINES', hint: 'Disk speed of each machine.',
        items: [
          { title: 'original', summary: 'SSD · 3000 writes/s', detail: 'Plenty of headroom for 400 writes/s.' },
          { title: 'copy (replica)', summary: 'standard disk · 300 writes/s', detail: 'The copy can only replay 300 writes/s, but the original sends 400 at peak. It falls further behind every busy second, and the report makes it worse.', evidence: true },
        ],
      },
    ],
    configTitle: 'REPLICA SETTINGS',
    fields: [
      { kind: 'choice', key: 'disk', label: 'replica disk', options: [['standard', 'standard (300/s)'], ['ssd', 'SSD (3000/s)']] },
      { kind: 'choice', key: 'report', label: 'nightly report runs on', options: [['replica', 'the replica'], ['analytics', 'a separate analytics copy']] },
    ],
    start: { disk: 'standard', report: 'replica' },
    solution: { disk: 'ssd', report: 'analytics' },
    applyLabel: 'SIMULATE A DAY',
    verify: (x) => {
      const cap = (x.disk === 'ssd' ? 3000 : 300) - (x.report === 'replica' ? 250 : 0);
      return {
        cases: [c(`replica replays ${cap}/s vs 400/s incoming`, cap >= 400), c('lag stays under 1 second all day', cap >= 600)],
        hint: x.disk === 'standard' ? 'Even with the report moved, can a 300/s disk keep up with 400/s?' : 'Check the margin during the report.',
      };
    },
    recap: {
      headline: 'The copy could only replay 300 writes/s while the original sent 400.',
      before: { lines: ['incoming: 400 writes/s', 'replica: 300/s − report'], outcome: 'lag grows to hours' },
      after: (x) => ({ lines: ['incoming: 400 writes/s', `replica: ${x.disk === 'ssd' ? 3000 : 300}/s${x.report === 'replica' ? ' − report' : ''}`], outcome: 'lag < 1s ✓' }),
      why: 'A replica must be at least as capable as the primary\'s write load, or lag grows without bound. Heavy reads on the replica compete with replay. Give it the same class of disk, and send big analytical jobs elsewhere.',
      real: `SELECT now() - pg_last_xact_replay_timestamp() AS lag;
  03:12:41
# move the replica to the same storage class as the primary (gp3, 3000 IOPS)
# point reporting at a separate read replica / warehouse`,
      realCaption: 'Alert on replication lag; stale reads cause very confusing bugs.',
    },
  },

  // ------------------------------------------------------------------ 5. Too Many Carts (connection pool, terminal)
  {
    id: 'granary-5',
    type: 'terminal',
    alert: 'TOO MANY CONNECTIONS',
    board: { broken: ['db: too many clients', 'orders failing'], fixed: ['connections: 160/200', 'orders OK ✓'] },
    intro: {
      symptom: 'Since the bakery app was scaled up to 8 copies this morning, about a third of orders fail with "sorry, too many clients already".',
      known: [
        'Each app copy opens a pool of database connections at start-up.',
        'The database accepts a limited number of connections.',
        'Each copy runs at most 12 queries at the same time.',
      ],
      goal: 'Find the mismatch, fix the pool size, restart the app, and confirm orders succeed.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'db show max_connections\ndb connections: who is connected\nkubectl get deploy bakery-app: replicas\ncat / edit app-config.yaml\nkubectl rollout restart deploy/bakery-app\ncurl http://bakery.town/order: place 20 test orders' }],
    term: {
      host: 'granary-db',
      motd: 'Postgres console · granary-db',
      files: {
        'app-config.yaml': `database:
  host: granary-db
  pool:
    min: 10
    max: 100`,
        'db.conf': `max_connections = 200
reserved_for_admins = 10`,
      },
      vars: { running: 100 },
      commands: [
        { match: /^db show max_connections$/, usage: 'db show max_connections', help: 'connection limit', run: () => ({ out: 'max_connections = 200 (10 reserved for admins → 190 for apps)' }) },
        { match: /^db connections$/, usage: 'db connections', help: 'current connections', run: (_m, s) => { const want = 8 * num(s.vars.running); return { out: `bakery-app (8 pods) wants ${want}\nconnected: ${Math.min(want, 190)} / 190${want > 190 ? `\nrejected: ${want - 190}  "too many clients already"` : ''}`, evidence: want > 190, verify: true }; } },
        { match: /^kubectl get deploy bakery-app$/, usage: 'kubectl get deploy bakery-app', help: 'replicas', run: () => ({ out: 'NAME        READY  UP-TO-DATE\nbakery-app  8/8    8   (scaled from 2 this morning)', evidence: true }) },
        { match: /^kubectl rollout restart deploy\/bakery-app$/, usage: 'kubectl rollout restart deploy/bakery-app', help: 'restart with new config', run: (_m, s) => { s.vars.running = poolMax(s.files['app-config.yaml']); return { out: `restarted 8 pods (pool max ${s.vars.running} each)`, changed: true }; } },
        { match: /^curl\s+(?:https?:\/\/)?bakery\.town\/order$/, usage: 'curl http://bakery.town/order', help: '20 test orders', run: (_m, s) => { const p = num(s.vars.running); const want = 8 * p; const fails = want > 190 ? 7 : p < 12 ? 4 : 0; return { out: `20 orders: ${20 - fails} OK, ${fails} failed${p < 12 && want <= 190 ? ' (waiting for a free connection: timeout)' : ''}`, verify: true }; } },
      ],
    },
    check: (s) => {
      const p = num(s.vars.running);
      return {
        cases: [c(`8 copies × ${p} = ${8 * p} connections fit in 190`, 8 * p <= 190), c(`each copy has enough for 12 parallel queries (${p})`, p >= 12), c('running app uses the new config', p === poolMax(s.files['app-config.yaml']) && p !== 100)],
        hint: 'Total connections = copies × pool max. It must fit the database, but each copy still needs enough. Edit, then restart.',
      };
    },
    solve: (s) => { s.files['app-config.yaml'] = s.files['app-config.yaml'].replace('max: 100', 'max: 20').replace('min: 10', 'min: 5'); s.vars.running = 20; },
    recap: {
      headline: '8 copies × 100 connections each = 800, against a limit of 190.',
      before: { lines: ['pool.max: 100 × 8 pods = 800', 'db limit: 190'], outcome: '"too many clients already"' },
      after: (s) => ({ lines: [`pool.max: ${s.vars.running} × 8 pods = ${8 * num(s.vars.running)}`, 'db limit: 190'], outcome: 'all orders succeed ✓' }),
      why: 'Connection limits are a shared budget. Scaling out multiplies every pool. Size pools from real concurrency (12 queries), check that copies × pool fits the database, and consider a pooler (PgBouncer) as you grow.',
      real: `# app-config.yaml
  pool:
-   max: 100
+   max: 20      # 8 pods × 20 = 160 ≤ 190
# or: put PgBouncer in front, transaction pooling`,
      realCaption: 'Remember this whenever an autoscaler can add copies.',
    },
  },

  // ------------------------------------------------------------------ 6. Failover Night (terminal)
  {
    id: 'granary-6',
    type: 'terminal',
    alert: 'PRIMARY DATABASE DOWN',
    board: { broken: ['granary-primary: DOWN', 'orders: failing'], fixed: ['replica promoted', 'old primary fenced ✓'] },
    intro: {
      symptom: 'The main granary database died at 02:14. Every order fails. The replica is healthy and up to date.',
      known: [
        'You can promote the replica so it becomes the new main database.',
        'The app has to be told about the new main.',
        'If the old primary comes back on its own, two databases might both accept writes ("split brain").',
      ],
      goal: 'Fail over safely: promote, repoint the app, prevent split brain, and confirm orders work.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'db status\ndb promote granary-replica\ndb fence granary-primary (stop it from ever accepting writes)\ncat / edit app-config.yaml\nkubectl rollout restart deploy/bakery-app\ncurl http://bakery.town/order' }],
    term: {
      host: 'ops',
      motd: '⚠ PAGE: granary-primary unreachable since 02:14',
      files: { 'app-config.yaml': 'database:\n  host: granary-primary\n  pool:\n    max: 20' },
      vars: { promoted: false, fenced: false, appHost: 'granary-primary' },
      commands: [
        { match: /^db status$/, usage: 'db status', help: 'cluster status', run: (_m, s) => ({ out: `granary-primary  ${s.vars.fenced ? 'FENCED' : 'DOWN (may restart: auto-recovery on)'}\ngranary-replica  ${s.vars.promoted ? 'PRIMARY, read-write' : 'replica, read-only, lag 0s'}`, evidence: true }) },
        { match: /^db promote granary-replica$/, usage: 'db promote granary-replica', help: 'make the replica the primary', run: (_m, s) => { s.vars.promoted = true; return { out: 'granary-replica promoted: now read-write', changed: true }; } },
        { match: /^db fence granary-primary$/, usage: 'db fence granary-primary', help: 'block old primary from writes', run: (_m, s) => { s.vars.fenced = true; return { out: 'granary-primary fenced: auto-recovery disabled, writes blocked', changed: true }; } },
        { match: /^kubectl rollout restart deploy\/bakery-app$/, usage: 'kubectl rollout restart deploy/bakery-app', help: 'reload config', run: (_m, s) => { s.vars.appHost = hostOf(s.files['app-config.yaml']); return { out: `bakery-app restarted → database ${s.vars.appHost}`, changed: true }; } },
        { match: /^curl\s+(?:https?:\/\/)?bakery\.town\/order$/, usage: 'curl http://bakery.town/order', help: 'test an order', run: (_m, s) => ({ out: s.vars.appHost === 'granary-replica' && s.vars.promoted ? 'HTTP 201 order saved' : s.vars.appHost === 'granary-replica' ? 'HTTP 500 cannot write: database is read-only' : 'HTTP 500 could not connect to granary-primary', verify: true }) },
      ],
    },
    check: (s) => ({
      cases: [c('replica promoted to primary', !!s.vars.promoted), c('app points at the new primary', s.vars.appHost === 'granary-replica'), c('old primary fenced (no split brain)', !!s.vars.fenced), c('orders save', !!s.vars.promoted && s.vars.appHost === 'granary-replica')],
      hint: 'Four parts: promote, fence, repoint the app (edit + restart), test.',
    }),
    solve: (s) => { s.vars.promoted = true; s.vars.fenced = true; s.files['app-config.yaml'] = s.files['app-config.yaml'].replace('granary-primary', 'granary-replica'); s.vars.appHost = 'granary-replica'; },
    recap: {
      headline: 'Promote, fence, repoint, verify.',
      before: { lines: ['primary: DOWN (auto-recovery on)', 'replica: read-only', 'app → granary-primary'], outcome: 'all orders fail' },
      after: () => ({ lines: ['replica: PRIMARY (read-write)', 'old primary: fenced', 'app → granary-replica'], outcome: 'orders saving ✓, no split brain' }),
      why: 'Failover is more than promotion. If the old primary returns and accepts writes, you get two diverging databases, which is far worse than downtime. Fence first or straight after, repoint clients, then verify writes.',
      real: `$ pg_ctl promote -D /var/lib/postgresql/data      # on the replica
$ # fence: stop + disable the old primary / revoke its IP
# better: use a DNS name or managed failover (RDS Multi-AZ, Patroni)
#         so clients don't need a config change`,
      realCaption: 'Rehearse this when it\'s calm, not first at 2am.',
    },
  },
];

function poolMax(yaml: string): number {
  return Number(squash(yaml).match(/max: (\d+)/)?.[1] ?? 0);
}

function hostOf(yaml: string): string {
  return squash(yaml).match(/host: ([\w-]+)/)?.[1] ?? '';
}
