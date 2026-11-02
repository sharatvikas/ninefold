import { arr, c, has, num, str, type LevelSpec } from '../spec';
import { squash } from '../terminal';

export const POST: LevelSpec[] = [
  // ------------------------------------------------------------------ 2. Old Maps (TTL)
  {
    id: 'post-2',
    type: 'config',
    alert: 'BAKERY MOVES TOMORROW',
    board: { broken: ['bakery: No.12 → No.15', 'maps valid: 168 h', 'move: tomorrow 9am'], fixed: ['bakery → No.15', 'maps valid: short', 'visitors: right door'] },
    intro: {
      symptom: 'The bakery is moving from No. 12 to No. 15 tomorrow morning. Last time a shop moved, customers kept walking to the old address for a whole week.',
      known: [
        'People copy the sorting wall into pocket maps so they don\'t have to ask every time.',
        'Each pocket map says how long it\'s good for. Until then, people trust it without asking.',
        'You can change how long new pocket maps are good for, and where the wall points.',
      ],
      goal: 'Plan the move so customers find the new bakery quickly, without flooding the Post Office with questions.',
    },
    evidence: [
      {
        kind: 'log', id: 'log', icon: '📜', label: 'LAST MOVE', hint: 'Notes from when the butcher moved last spring. Click a line to read it.',
        lines: [
          { t: 'Mon 09:00', text: 'wall updated: butcher → No. 7', note: 'The wall was changed straight away, but that alone wasn\'t enough…' },
          { t: 'Mon 09:30', text: '41 customers arrived at the OLD butcher', note: 'They didn\'t ask the wall. They used their pocket maps.' },
          { t: 'Mon 10:00', text: 'pocket maps say: "good for 168 hours"', note: 'That\'s it: maps were trusted for 168 hours (7 days) after they were copied. Nobody re-checked the wall for a week.', evidence: true },
          { t: 'Thu 12:00', text: '18 customers still at the old address', note: 'Still going wrong days later, exactly as the 168-hour maps predict.' },
          { t: 'Mon+7', text: 'last stray customer seen', note: 'A week later the last old map expired.' },
        ],
      },
      {
        kind: 'chart', id: 'chart', icon: '📈', label: 'POST QUEUE', hint: 'How many people ask the Post Office per hour, depending on how long maps are good for. Click a bar.',
        bars: [
          { label: '168h', value: 2, note: 'Maps good for a week: almost nobody asks. Calm, but slow to notice changes.' },
          { label: '24h', value: 9, note: 'Good for a day: a few more questions.' },
          { label: '1h', value: 70, note: 'Good for an hour: the counter is busy but copes (it handles 200/hour).' },
          { label: '5min', value: 420, note: 'Five minutes: 420 questions an hour. The counter only handles 200. The queue would spill into the street.', evidence: true },
        ],
        limit: { value: 200, label: 'COUNTER LIMIT 200/h' },
      },
    ],
    configTitle: 'SORTING WALL · BAKERY ENTRY',
    fields: [
      { kind: 'number', key: 'ttl', label: 'maps good for', min: 0, max: 168, unit: 'hours', step: 1 },
      { kind: 'choice', key: 'when', label: 'change the address', options: [['now', 'right now'], ['move', 'at the move (tomorrow 9am)']] },
      { kind: 'number', key: 'house', label: 'bakery → No.', min: 1, max: 20 },
    ],
    start: { ttl: 168, when: 'move', house: 12 },
    solution: { ttl: 1, when: 'move', house: 15 },
    applyLabel: 'SIMULATE MOVE DAY',
    verify: (x) => {
      const ttl = num(x.ttl);
      return {
        cases: [
          c('Bakery entry points to the new shop (No. 15)', num(x.house) === 15),
          c('Nobody is sent to No. 15 before the bakery moves in', !(x.when === 'now' && num(x.house) === 15)),
          c(`Old maps expire within a few hours of the move (yours: ${ttl}h)`, ttl <= 6),
          c(`Post Office queue stays under 200/hour (${ttl < 1 ? 'over!' : 'ok'})`, ttl >= 1),
        ],
        hint: 'Think about two things: how long old maps keep sending people to No. 12, and how many questions the counter can handle. And when should the wall change?',
      };
    },
    recap: {
      headline: 'Lower how long maps are trusted before a move, then change the address.',
      before: { lines: ['bakery  168h  → No.12', '(move day)', 'old maps trusted for 7 days'], outcome: 'Customers at the old shop for a week' },
      after: (x) => ({ lines: [`bakery  ${num(x.ttl)}h  → No.${num(x.house)}`, '(changed at the move)', `old maps expire in ≤ ${num(x.ttl)}h`], outcome: `Right door within ${num(x.ttl)} hour(s)` }),
      why: 'Changing the wall only helps people who ask it. Everyone else trusts their copy until it expires. Short-lived copies mean changes spread fast, but too short floods the counter. Lower the time-to-live ahead of a planned change, then raise it again afterwards.',
      real: (x) => `# town.zone, the day before the move
- bakery  604800  IN  A  10.0.3.12   ; TTL 7 days
+ bakery  ${num(x.ttl) * 3600}  IN  A  10.0.3.12

# move day
- bakery  ${num(x.ttl) * 3600}  IN  A  10.0.3.12
+ bakery  ${num(x.ttl) * 3600}  IN  A  10.0.3.15`,
      realCaption: 'Pocket maps = DNS caches, "good for" = TTL. Lower the TTL before a migration, then raise it again afterwards.',
    },
  },

  // ------------------------------------------------------------------ 3. Nicknames (CNAME)
  {
    id: 'post-3',
    type: 'config',
    alert: 'BREAD.TOWN DOESN\'T RESOLVE',
    board: { broken: ['bread.town → ???', 'NXDOMAIN'], fixed: ['bread.town → bakery.town', '→ 10.0.3.15 ✓'] },
    intro: {
      symptom: 'The bakery\'s old nickname "bread.town" is printed on every flyer, but anyone who uses it now gets "no such address".',
      known: [
        'A nickname (alias) doesn\'t hold an address itself. It points to another name.',
        'The bakery was renamed from "bakery-old.town" to "bakery.town" last month.',
        'The bakery is at 10.0.3.15.',
      ],
      goal: 'Make bread.town reach the bakery again, without breaking anything else.',
    },
    evidence: [
      {
        kind: 'inspect', id: 'records', icon: '🗂', label: 'RECORDS', hint: 'Records on the wall. Click one to look it up.',
        items: [
          { title: 'bread.town', summary: 'CNAME → bakery-old.town', detail: 'bread.town is an alias for bakery-old.town. Follow it…', evidence: false },
          { title: 'bakery-old.town', summary: '(no record)', detail: 'Following the alias: bakery-old.town has no record at all. It was deleted in the rename. The alias points at a name that no longer exists, so the lookup fails (NXDOMAIN).', evidence: true },
          { title: 'bakery.town', summary: 'A → 10.0.3.15', detail: 'bakery.town is the bakery\'s current name, with its address 10.0.3.15.' },
          { title: 'www.bakery.town', summary: 'CNAME → bakery.town', detail: 'This alias works: it points to bakery.town, which exists.' },
        ],
      },
      {
        kind: 'log', id: 'dig', icon: '🔎', label: 'LOOKUPS', hint: 'Recent lookups. Click to read.', lines: [
          { text: 'dig bakery.town → 10.0.3.15', note: 'The real name works fine.' },
          { text: 'dig bread.town → CNAME bakery-old.town → NXDOMAIN', note: 'The chain breaks at bakery-old.town: "non-existent domain".', evidence: true },
          { text: 'dig www.bakery.town → CNAME bakery.town → 10.0.3.15', note: 'This alias works because its target exists.' },
        ],
      },
    ],
    configTitle: 'RECORD: bread.town',
    fields: [
      { kind: 'choice', key: 'type', label: 'type', options: [['CNAME', 'CNAME (alias)'], ['A', 'A (address)']] },
      { kind: 'text', key: 'target', label: 'points to', placeholder: 'a name or an address' },
    ],
    start: { type: 'CNAME', target: 'bakery-old.town' },
    solution: { type: 'CNAME', target: 'bakery.town' },
    applyLabel: 'LOOK UP bread.town',
    verify: (x) => {
      const t = str(x.target).trim().toLowerCase().replace(/\.$/, '');
      const ok = x.type === 'CNAME' ? t === 'bakery.town' || t === 'www.bakery.town' : t === '10.0.3.15';
      return {
        cases: [
          c('bread.town reaches the bakery (10.0.3.15)', ok),
          c('bread.town follows the bakery if it moves again', x.type === 'CNAME' && ok),
          c('no alias points at a missing name', !(x.type === 'CNAME' && t === 'bakery-old.town')),
        ],
        hint: x.type === 'A' && t === '10.0.3.15' ? 'It works today, but a fixed address breaks the next time the bakery moves. An alias that follows the current name is sturdier.' : 'Where should the nickname point so it lands on a name that actually exists?',
      };
    },
    recap: {
      headline: 'The nickname pointed at a name that had been deleted.',
      before: { lines: ['bread.town  CNAME  bakery-old.town', 'bakery-old.town  (deleted)'], outcome: 'NXDOMAIN: no such address' },
      after: (x) => ({ lines: [`bread.town  ${str(x.type)}  ${str(x.target)}`, 'bakery.town  A  10.0.3.15'], outcome: 'bread.town → 10.0.3.15 ✓' }),
      why: 'An alias is only as good as its target. When the bakery was renamed, the old name was deleted, and every alias pointing at it broke silently. Pointing the alias at the current name fixes it, and keeps working if the address changes later.',
      real: `$ dig bread.town
bread.town.  CNAME  bakery-old.town.
;; status: NXDOMAIN

# town.zone
- bread   IN  CNAME  bakery-old.town.
+ bread   IN  CNAME  bakery.town.`,
      realCaption: 'Tip: when you rename or delete a record, search for CNAMEs that point at it.',
    },
  },

  // ------------------------------------------------------------------ 4. Closed Gate (firewall)
  {
    id: 'post-4',
    type: 'config',
    alert: 'READING ROOM TIMING OUT',
    board: { broken: ['reading-room :8080', 'visitors: TIMEOUT'], fixed: ['reading-room :8080', 'via gate 10.0.1.5 ✓'] },
    intro: {
      symptom: 'The library opened a new Reading Room app on port 8080. Every visitor\'s request just hangs, then times out.',
      known: [
        'All visitors come through the town gate (load balancer) at 10.0.1.5.',
        'The library server has a guard list (firewall) of which doors open, and for whom.',
        'The app itself works: the librarian can open it from inside the server.',
      ],
      goal: 'Let visitors reach the Reading Room, opening as little as possible.',
    },
    evidence: [
      {
        kind: 'log', id: 'flow', icon: '📜', label: 'GATE LOG', hint: 'The guard\'s log of who was let in. Click lines.',
        lines: [
          { t: '10:01:02', text: 'ACCEPT 10.0.1.5 → 10.0.4.20:443', note: 'Normal website traffic on port 443 is allowed.' },
          { t: '10:01:04', text: 'REJECT 10.0.1.5 → 10.0.4.20:8080', note: 'There it is: the town gate tries to reach port 8080 and the guard turns it away. No rule allows 8080.', evidence: true },
          { t: '10:01:09', text: 'ACCEPT 10.0.2.9 → 10.0.4.20:22', note: 'An admin logging in from inside the town (10.x) on port 22.' },
          { t: '10:01:11', text: 'REJECT 203.0.113.50 → 10.0.4.20:22', note: 'A stranger from outside trying the admin door. Correctly blocked.' },
        ],
      },
      {
        kind: 'inspect', id: 'rules', icon: '🛡', label: 'GUARD LIST', hint: 'Current rules. Click to read.',
        items: [
          { title: 'port 80 from anywhere', summary: 'http', detail: 'Plain web traffic, redirected to 443.' },
          { title: 'port 443 from anywhere', summary: 'https', detail: 'The main website.' },
          { title: 'port 22 from 10.0.0.0/8', summary: 'admin (inside town only)', detail: 'Admin logins, only from inside the town network. Good practice.' },
          { title: '(nothing for 8080)', summary: 'no rule', detail: 'No rule mentions port 8080, so it\'s closed to everyone. That\'s why visitors time out.', evidence: true },
        ],
      },
    ],
    configTitle: 'GUARD LIST (INBOUND RULES)',
    fields: [
      {
        kind: 'set', key: 'rules', label: 'allow', options: [
          ['80-any', '80 from anywhere'],
          ['443-any', '443 from anywhere'],
          ['22-town', '22 from 10.0.0.0/8'],
          ['8080-gate', '8080 from gate 10.0.1.5'],
          ['8080-any', '8080 from anywhere'],
          ['22-any', '22 from anywhere'],
          ['all-any', 'ALL ports from anywhere'],
        ],
      },
    ],
    start: { rules: ['80-any', '443-any', '22-town'] },
    solution: { rules: ['80-any', '443-any', '22-town', '8080-gate'] },
    applyLabel: 'SEND TEST VISITORS',
    verify: (x) => {
      const r = arr(x.rules);
      const reach = has(r, '8080-gate') || has(r, '8080-any') || has(r, 'all-any');
      return {
        cases: [
          c('Visitors reach the Reading Room through the gate', reach),
          c('Main website still works (80 & 443)', has(r, '80-any') && has(r, '443-any') || has(r, 'all-any')),
          c('Admins can still log in from inside town', has(r, '22-town') || has(r, '22-any') || has(r, 'all-any')),
          c('Admin door (22) is not open to the whole world', !has(r, '22-any') && !has(r, 'all-any')),
          c('Not every port is open to everyone', !has(r, 'all-any')),
        ],
        hint: 'Which single door do visitors need, and who actually knocks on it?',
        wasteful: has(r, '8080-any') && !has(r, '8080-gate') ? 'port 8080 is open to the whole internet, though only the gate needs it. Anyone could skip the gate.' : undefined,
      };
    },
    recap: {
      headline: 'The guard had no rule for the new door, so it turned everyone away.',
      before: { lines: ['allow 80   from 0.0.0.0/0', 'allow 443  from 0.0.0.0/0', 'allow 22   from 10.0.0.0/8', '(no rule for 8080)'], outcome: 'Visitors time out' },
      after: (x) => ({ lines: arr(x.rules).map((r) => ({ '80-any': 'allow 80   from 0.0.0.0/0', '443-any': 'allow 443  from 0.0.0.0/0', '22-town': 'allow 22   from 10.0.0.0/8', '8080-gate': 'allow 8080 from 10.0.1.5/32', '8080-any': 'allow 8080 from 0.0.0.0/0', '22-any': 'allow 22   from 0.0.0.0/0', 'all-any': 'allow ALL  from 0.0.0.0/0' })[r] ?? r), outcome: 'Visitors reach the Reading Room ✓' }),
      why: 'Firewalls deny by default: a new port is closed until a rule opens it. The safest fix opens exactly the port that\'s needed, only to the source that needs it (the load balancer), and leaves everything else as it was. A timeout rather than an error is a classic sign of a firewall drop.',
      real: `$ aws ec2 authorize-security-group-ingress \\
    --group-id sg-library \\
    --protocol tcp --port 8080 \\
    --source-group sg-town-gate`,
      realCaption: 'Guard list = security group / firewall rules. Prefer referencing the load balancer\'s group over opening to 0.0.0.0/0.',
    },
  },

  // ------------------------------------------------------------------ 5. Traffic Jam (LB health checks)
  {
    id: 'post-5',
    type: 'terminal',
    alert: '1 IN 3 VISITORS GET AN ERROR',
    board: { broken: ['pool: 3 backends', 'errors: 33%'], fixed: ['pool: 2 healthy', 'errors: 0%'] },
    intro: {
      symptom: 'About one in three visitors to the bakery website gets a "502 Bad Gateway" error. Refreshing usually works.',
      known: [
        'The load balancer spreads visitors across three servers: bakery-a, bakery-b and bakery-c.',
        'It should stop sending people to a server that isn\'t healthy.',
        'You\'re at the load balancer\'s terminal.',
      ],
      goal: 'Find out why visitors still reach a broken server, fix the load balancer config, reload it, and confirm with curl.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'Start with "lb status" and "curl http://bakery.town".\nCheck each backend directly: curl http://bakery-a:3000/health (and b, c).\nRead the config: cat lb.conf\nEdit with: edit lb.conf, then apply with: lb reload' }],
    term: {
      host: 'lb-1',
      motd: 'Town gate load balancer (lb-1). 3 backends in pool "bakery".',
      files: {
        'lb.conf': `pool "bakery" {
  backends = ["bakery-a:3000", "bakery-b:3000", "bakery-c:3000"]

  health_check {
    enabled  = false
    path     = "/healthz"
    interval = 10s
  }
}`,
      },
      vars: { reloaded: false, conf: '' },
      commands: [
        {
          match: /^lb status$/, usage: 'lb status', help: 'show backends and what the LB thinks of them',
          run: (_m, s) => {
            const hc = healthConf(s.vars.conf ? String(s.vars.conf) : '');
            return { out: hc.enabled && hc.path === '/health' ? 'bakery-a  UP\nbakery-b  UP\nbakery-c  DOWN (health check failing, removed from pool)' : `bakery-a  in pool\nbakery-b  in pool\nbakery-c  in pool\nhealth checks: ${hc.enabled ? `on, path ${hc.path}` : 'OFF'}`, evidence: !hc.enabled };
          },
        },
        {
          match: /^curl\s+(?:-s\s+)?(?:https?:\/\/)?bakery-([abc])(?::3000)?(\/\S*)?$/, usage: 'curl http://bakery-a:3000/health', help: 'call one backend directly',
          run: (m) => {
            const path = m[2] ?? '/';
            if (m[1] === 'c') return { out: path === '/health' ? 'HTTP 503 {"status":"down","reason":"oven offline"}' : 'HTTP 502 upstream oven offline', evidence: true };
            if (path === '/health') return { out: 'HTTP 200 {"status":"ok"}' };
            if (path === '/healthz') return { out: 'HTTP 404 Not Found' };
            return { out: 'HTTP 200 <h1>Bakery</h1>' };
          },
        },
        {
          match: /^curl\s+(?:-s\s+)?(?:https?:\/\/)?bakery\.town\/?$/, usage: 'curl http://bakery.town', help: 'visit the site through the LB (10 tries)',
          run: (_m, s) => {
            const hc = healthConf(s.vars.conf ? String(s.vars.conf) : '');
            const good = hc.enabled && hc.path === '/health';
            const res = Array.from({ length: 10 }, (_, i) => (good || i % 3 !== 2 ? '200' : '502'));
            return { out: `10 requests: ${res.join(' ')}\n${res.filter((r) => r === '502').length} errors`, verify: true };
          },
        },
        {
          match: /^lb reload$/, usage: 'lb reload', help: 'apply lb.conf',
          run: (_m, s) => {
            const hc = healthConf(s.files['lb.conf']);
            s.vars.conf = s.files['lb.conf'];
            s.vars.reloaded = true;
            if (!hc.valid) return { out: 'lb.conf: could not read health_check. Check your syntax.' };
            const note = hc.enabled && hc.path !== '/health' ? `\nwarning: health check ${hc.path} returns 404 on every backend: ALL backends marked DOWN` : '';
            const bad = hc.enabled && hc.path !== '/health';
            return { out: `reloaded. health checks: ${hc.enabled ? `on (${hc.path} every ${hc.interval}s)` : 'off'}${note}`, changed: true, bad };
          },
        },
      ],
    },
    check: (s) => {
      const hc = healthConf(String(s.vars.conf ?? ''));
      return {
        cases: [
          c('health checks are switched on', hc.enabled),
          c('health check uses a path the app really serves (/health)', hc.enabled && hc.path === '/health'),
          c('config has been reloaded', !!s.vars.reloaded && s.vars.conf === s.files['lb.conf']),
          c('visitors get 0 errors', hc.enabled && hc.path === '/health'),
        ],
        hint: 'Did you reload after editing? And does the health check path exist on the backends? Try curling it.',
      };
    },
    solve: (s) => {
      s.files['lb.conf'] = s.files['lb.conf'].replace('enabled  = false', 'enabled  = true').replace('/healthz', '/health');
      s.vars.conf = s.files['lb.conf'];
      s.vars.reloaded = true;
    },
    recap: {
      headline: 'The load balancer had no working health check, so it kept sending visitors to a dead server.',
      before: { lines: ['health_check {', '  enabled = false', '  path    = "/healthz"  # 404!', '}'], outcome: '1 in 3 requests → 502' },
      after: () => ({ lines: ['health_check {', '  enabled = true', '  path    = "/health"', '}'], outcome: 'bakery-c removed · 0 errors ✓' }),
      why: 'A load balancer only avoids broken servers if it checks them, and the check has to hit an endpoint that really exists. Turning it on with a wrong path is even worse: every server fails the check and the whole site goes down.',
      real: `upstream bakery {
  server bakery-a:3000;
  server bakery-b:3000;
  server bakery-c:3000;
}
# + active health checks on GET /health every 10s
# AWS ALB: target group → health check path: /health`,
      realCaption: 'Always curl the health endpoint yourself before pointing a load balancer at it.',
    },
  },

  // ------------------------------------------------------------------ 6. Lost Letters (routing)
  {
    id: 'post-6',
    type: 'terminal',
    alert: 'EAST SIDE UNREACHABLE',
    board: { broken: ['10.0.9.0/24: unreachable', 'drops at r2'], fixed: ['10.0.9.0/24 via r2', 'east side ✓'] },
    intro: {
      symptom: 'Nothing on the east side of town (the 10.0.9.x houses) can be reached. Letters vanish somewhere on the way.',
      known: [
        'Traffic goes through routers r1 → r2 → r3 to reach the east side.',
        'A new router, r3 (10.0.7.1), was installed last night for the east side.',
        'You\'re on r2, and you can edit its routes.',
      ],
      goal: 'Find where the letters get lost, fix the route, and confirm with traceroute.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'traceroute 10.0.9.5: shows each hop.\nip route: shows r2\'s routing table.\nRoutes live in routes.conf. Format: <network> via <next hop>\nAfter editing: route reload' }],
    term: {
      host: 'r2',
      motd: 'Router r2 · interfaces: eth0 10.0.6.2 (to r1), eth1 10.0.7.2 (to r3), eth2 10.0.8.2 (old east link, decommissioned)',
      files: {
        'routes.conf': `# r2 static routes
10.0.5.0/24 via 10.0.6.1   # west side, through r1
10.0.9.0/24 via 10.0.8.1   # east side
default     via 10.0.6.1`,
      },
      vars: { active: '' },
      commands: [
        {
          match: /^traceroute\s+10\.0\.9\.\d+$/, usage: 'traceroute 10.0.9.5', help: 'trace the path to an east-side house',
          run: (_m, s) => {
            const ok = eastRoute(String(s.vars.active || s.files['routes.conf'])) === '10.0.7.1' && !!s.vars.active;
            return ok
              ? { out: ' 1  r1 10.0.6.1   1 ms\n 2  r2 10.0.7.2   2 ms\n 3  r3 10.0.7.1   3 ms\n 4  10.0.9.5       4 ms  ✓ reached', verify: true }
              : { out: ' 1  r1 10.0.6.1   1 ms\n 2  r2 10.0.6.2   2 ms\n 3  * * *  (no reply via 10.0.8.1)\n 4  * * *', evidence: true, verify: true };
          },
        },
        {
          match: /^ip route$/, usage: 'ip route', help: 'show active routes',
          run: (_m, s) => ({ out: String(s.vars.active || s.files['routes.conf']).split('\n').filter((l) => !l.startsWith('#')).join('\n') + '\n\nlink 10.0.8.0/24: DOWN (decommissioned)\nlink 10.0.7.0/24: UP (r3)', evidence: true }),
        },
        {
          match: /^ping\s+(10\.0\.\d+\.\d+)$/, usage: 'ping 10.0.7.1', help: 'check a neighbour is alive',
          run: (m) => ({ out: m[1] === '10.0.7.1' ? '64 bytes from 10.0.7.1: time=1 ms  (r3 is up)' : m[1] === '10.0.8.1' ? 'Request timeout (10.0.8.1 is the old, removed link)' : '64 bytes: time=2 ms' }),
        },
        {
          match: /^route reload$/, usage: 'route reload', help: 'apply routes.conf',
          run: (_m, s) => {
            s.vars.active = s.files['routes.conf'];
            const via = eastRoute(s.files['routes.conf']);
            const west = /10\.0\.5\.0\/24\s+via\s+10\.0\.6\.1/.test(s.files['routes.conf']);
            return { out: `routes reloaded. east side via ${via ?? '(none)'}${west ? '' : '\nwarning: west side route missing!'}`, changed: true, bad: !west };
          },
        },
      ],
    },
    check: (s) => {
      const active = String(s.vars.active || '');
      return {
        cases: [
          c('east side (10.0.9.0/24) routes via r3 (10.0.7.1)', eastRoute(active) === '10.0.7.1'),
          c('west side still reachable', /10\.0\.5\.0\/24\s+via\s+10\.0\.6\.1/.test(active)),
          c('routes reloaded', !!active),
        ],
        hint: 'Which link is actually up on r2, and who is the next hop on it? Remember to reload.',
      };
    },
    solve: (s) => {
      s.files['routes.conf'] = s.files['routes.conf'].replace('10.0.9.0/24 via 10.0.8.1', '10.0.9.0/24 via 10.0.7.1');
      s.vars.active = s.files['routes.conf'];
    },
    recap: {
      headline: 'r2 was still sending east-side traffic down a link that had been removed.',
      before: { lines: ['10.0.9.0/24 via 10.0.8.1', '(10.0.8.x link: DOWN)'], outcome: 'traceroute dies after r2' },
      after: () => ({ lines: ['10.0.9.0/24 via 10.0.7.1', '(r3, link UP)'], outcome: 'traceroute reaches 10.0.9.5 ✓' }),
      why: 'When new hardware replaces old, every router that pointed at the old path needs updating. traceroute showed exactly where packets stopped (after r2), and the routing table showed why (next hop on a dead link).',
      real: `$ traceroute 10.0.9.5
 3  * * *
$ ip route | grep 10.0.9
10.0.9.0/24 via 10.0.8.1 dev eth2
$ sudo ip route replace 10.0.9.0/24 via 10.0.7.1 dev eth1`,
      realCaption: 'In the cloud the same thing happens in VPC route tables after a gateway or peering change.',
    },
  },
];

function healthConf(conf: string): { valid: boolean; enabled: boolean; path: string; interval: number } {
  const q = squash(conf);
  const block = q.match(/health_check \{([^}]*)\}/);
  if (!block) return { valid: false, enabled: false, path: '', interval: 0 };
  const b = block[1];
  const enabled = /enabled = true/.test(b);
  const path = (b.match(/path = (\S+)/)?.[1] ?? '').replace(/[,;]$/, '');
  const interval = Number(b.match(/interval = (\d+)/)?.[1] ?? 10);
  return { valid: true, enabled, path, interval };
}

function eastRoute(conf: string): string | undefined {
  const line = conf.split('\n').find((l) => /^\s*10\.0\.9\.0\/24\s+via/.test(l));
  return line?.match(/via\s+(\S+)/)?.[1];
}
