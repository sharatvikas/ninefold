import { c, num, type LevelSpec } from '../spec';
import { squash } from '../terminal';

export const BIG: LevelSpec[] = [
  // ------------------------------------------------------------------ Big 1: The Quiet Morning
  {
    id: 'big-1',
    type: 'config',
    alert: 'TOWN-WIDE ERRORS SINCE 08:56',
    board: { broken: ['errors: 14% of orders', 'since 08:56'], fixed: ['errors: 0.2%', 'one change, verified ✓'] },
    intro: {
      symptom: 'Since 08:56, 14% of orders across town fail. Every district lead is sure it\'s someone else\'s problem, and three of them want to "just restart everything".',
      known: [
        'Several things changed this morning in different districts.',
        'The Watchtower sees the errors; the Railyard, Harbor and Post Office logs say what changed.',
        'Changing things that aren\'t broken adds risk and confusion.',
      ],
      goal: 'Correlate the evidence across districts, make the one change that fixes it, and leave everything else alone.',
    },
    evidence: [
      { kind: 'chart', id: 'errors', icon: '📈', label: 'WATCHTOWER', hint: 'Error rate (%) by minute. Click.', bars: [{ label: '08:50', value: 0.2, note: 'Normal.' }, { label: '08:55', value: 0.2, note: 'Normal.' }, { label: '08:56', value: 13.8, note: 'Errors jump at 08:56 exactly. What changed just before?', evidence: true }, { label: '09:10', value: 14.1, note: 'Steady at ~14% since.' }], unit: '%' },
      {
        kind: 'log', id: 'changes', icon: '📜', label: 'CHANGE LOG', hint: 'Everything that changed this morning, all districts. Click lines.',
        lines: [
          { t: '07:30', text: 'post: TTL lowered on library.town', note: 'Library DNS change, an hour and a half before the errors. And orders don\'t use library.town.' },
          { t: '08:20', text: 'harbor: ship-7 hold raised to 10', note: 'Harbor change, 36 minutes earlier. Ships have sailed fine since.' },
          { t: '08:55', text: 'rail: menu-svc v5 deployed (100%)', note: 'One minute before the errors started. Prime suspect.', evidence: true },
          { t: '09:02', text: 'lock: Kit added to group locksmiths', note: 'After the errors began, so it can\'t be the cause.' },
        ],
      },
      { kind: 'search', id: 'logs', icon: '🔎', label: 'ERROR LOGS', hint: 'Search error logs from all services.', lines: ['08:56:01 ERROR checkout: price undefined for item seasonal-pie (menu-svc v5)', '08:56:03 ERROR checkout: price undefined for item seasonal-pie (menu-svc v5)', '08:57:10 WARN harbor: ship-9 slow to dock (wind)', '09:00:00 INFO post: cache refresh library.town', '08:58:44 ERROR checkout: price undefined for item seasonal-tart (menu-svc v5)'], evidence: /menu-svc v5/, placeholder: 'try: ERROR' },
    ],
    configTitle: 'INCIDENT ACTIONS',
    fields: [
      { kind: 'choice', key: 'rail', label: 'Railyard', options: [['none', 'leave as is'], ['rollback', 'roll menu-svc back to v4'], ['redeploy', 're-deploy v5']] },
      { kind: 'choice', key: 'harbor', label: 'Harbor', options: [['none', 'leave as is'], ['revert', 'revert ship-7 hold to 7'], ['restart', 'restart all ships']] },
      { kind: 'choice', key: 'post', label: 'Post Office', options: [['none', 'leave as is'], ['revert', 'revert library TTL']] },
    ],
    start: { rail: 'none', harbor: 'restart', post: 'revert' },
    solution: { rail: 'rollback', harbor: 'none', post: 'none' },
    applyLabel: 'EXECUTE & WATCH ERRORS',
    verify: (x) => ({
      cases: [
        c('error rate back to normal', x.rail === 'rollback'),
        c('no unrelated changes made during the incident', x.harbor === 'none' && x.post === 'none'),
        c('ships keep sailing', x.harbor !== 'revert'),
      ],
      hint: x.rail !== 'rollback' ? 'Line up the error spike with the change log. What changed one minute before?' : 'You found it! But every extra change during an incident is a new risk and muddies the picture.',
    }),
    recap: {
      headline: 'Errors started one minute after one change. Roll back that change, touch nothing else.',
      before: { lines: ['08:55 menu-svc v5 (100%)', '08:56 errors 0.2% → 14%', 'plan: restart everything'], outcome: '14% of orders failing' },
      after: () => ({ lines: ['rollback menu-svc → v4', 'harbor, post: untouched'], outcome: 'errors 0.2% within 2 min ✓' }),
      why: 'In an incident, ask "what changed?" and line it up with when the symptoms began. The closest preceding change, confirmed by the error logs, is the prime suspect. Mitigate with the smallest reversible action, and freeze other changes so cause and effect stay clear.',
      real: `$ kubectl rollout history deploy/menu-svc
$ kubectl rollout undo deploy/menu-svc --to-revision=41
# Incident tip: put deploy markers on your dashboards
# so "what changed?" is answered at a glance.`,
      realCaption: 'Most incidents are caused by changes. Your change log is your best detective.',
    },
  },

  // ------------------------------------------------------------------ Big 2: Festival Meltdown
  {
    id: 'big-2',
    type: 'config',
    alert: 'FESTIVAL: CASCADING FAILURE',
    board: { broken: ['traffic 6×', 'db refusing connections', 'retries ×3 storm'], fixed: ['festival: stable', 'p95 < 1s, 0.3% errors ✓'] },
    intro: {
      symptom: 'Festival traffic hit 6× normal. The autoscaler added app servers, then the database started refusing connections, then failed requests were retried three times each, and everything fell over.',
      known: [
        'Each app server opens a pool of database connections. The database accepts 300.',
        'Each server handles 200 req/s. Peak is 2,400 req/s.',
        'Instant retries multiply load exactly when the system is struggling.',
      ],
      goal: 'Tune the whole chain (servers, connections, retries, protection) so the festival peak is served without a meltdown.',
    },
    evidence: [
      {
        kind: 'log', id: 'timeline', icon: '📜', label: 'TIMELINE', hint: 'How it unravelled. Click lines.',
        lines: [
          { t: '14:00', text: 'traffic 2,400 req/s (6×)', note: 'The festival peak arrives.' },
          { t: '14:02', text: 'autoscaler: 6 → 30 app servers', note: 'More servers: good for capacity, but…' },
          { t: '14:03', text: 'db: 30 servers × 20 connections = 600 > 300 max', note: 'Every new server brings 20 more connections. The database limit is 300.', evidence: true },
          { t: '14:03', text: 'errors: "too many clients" → clients retry ×3 instantly', note: 'Instant retries triple the load on an already-full system: a retry storm.', evidence: true },
          { t: '14:05', text: 'total meltdown', note: 'Even healthy requests can\'t get through.' },
        ],
      },
      { kind: 'doc', id: 'math', icon: '🧮', label: 'THE MATH', text: 'servers needed = 2400 ÷ 200 = ?\nconnections = servers × pool size ≤ 300\nEach server needs a pool of at least 15 to serve 200 req/s.\nRetries: use exponential backoff with jitter, and cap them.\nShedding: a rate limit returns a fast "busy, try later" instead of melting down.' },
    ],
    configTitle: 'FESTIVAL CONFIG',
    fields: [
      { kind: 'number', key: 'max', label: 'max app servers', min: 1, max: 60 },
      { kind: 'number', key: 'pool', label: 'db pool per server', min: 1, max: 50 },
      { kind: 'choice', key: 'retry', label: 'retries', options: [['instant3', '3 instant retries'], ['backoff', 'up to 2 retries, exponential backoff + jitter'], ['none', 'never retry']] },
      { kind: 'toggle', key: 'limit', label: 'rate limit at 3,000 req/s', on: 'ON', off: 'OFF' },
    ],
    start: { max: 30, pool: 20, retry: 'instant3', limit: false },
    solution: { max: 14, pool: 20, retry: 'backoff', limit: true },
    applyLabel: 'REPLAY THE FESTIVAL',
    verify: (x) => {
      const max = num(x.max);
      const pool = num(x.pool);
      return {
        cases: [
          c(`capacity: ${max} × 200 = ${max * 200} req/s ≥ 2,400`, max * 200 >= 2400),
          c(`connections: ${max} × ${pool} = ${max * pool} ≤ 300`, max * pool <= 300),
          c(`each server has enough connections (pool ${pool} ≥ 15)`, pool >= 15),
          c('retries don\'t amplify failure', x.retry === 'backoff'),
          c('excess traffic gets a fast "busy" instead of a meltdown', !!x.limit),
        ],
        hint: x.retry === 'none' ? 'Never retrying turns every small blip into a customer-visible error. Retries are good when they back off.' : 'Every limit in the chain has to fit together: servers × pool ≤ database, servers × 200 ≥ peak.',
      };
    },
    recap: {
      headline: 'Every part scaled except the database, and retries turned a slowdown into a meltdown.',
      before: { lines: ['30 servers × 20 conns = 600 > 300', 'retries: 3 instant', 'no rate limit'], outcome: 'cascading failure' },
      after: (x) => ({ lines: [`${num(x.max)} servers × ${num(x.pool)} = ${num(x.max) * num(x.pool)} conns ≤ 300`, `capacity ${num(x.max) * 200} req/s`, 'retries: backoff + jitter · rate limit on'], outcome: 'festival served ✓' }),
      why: 'Systems fail at their tightest limit, here the database connection limit, which autoscaling ignored. Size every hop together, retry with exponential backoff and jitter so clients don\'t stampede, and shed excess load quickly rather than let everything time out.',
      real: `# HPA maxReplicas: 14 · pool.max: 20 → 280 ≤ 300
retry:
  attempts: 2
  backoff: exponential(base=100ms, max=2s) + full jitter
# ingress rate limit
nginx.ingress.kubernetes.io/limit-rps: "3000"`,
      realCaption: 'Cascading failures are the classic Big Incident. Look for multipliers: autoscaling × pools, retries × clients.',
    },
  },

  // ------------------------------------------------------------------ Big 3: The Long Night (terminal)
  {
    id: 'big-3',
    type: 'terminal',
    alert: 'BAKERY.TOWN DOWN · 3 PROBLEMS',
    board: { broken: ['DNS → old LB', 'cert expired', 'db primary down'], fixed: ['DNS ✓ cert ✓ db ✓', 'bakery.town: 200 OK'] },
    intro: {
      symptom: 'It\'s 2am. bakery.town is completely down. Three things went wrong at once, and fixing one just reveals the next.',
      known: [
        'Everything you\'ve learned applies: DNS, certificates, databases, verifying.',
        'Work from the outside in: can people find the site? Is it trusted? Can it save orders?',
        'curl https://bakery.town tells you what customers see right now.',
      ],
      goal: 'Get bakery.town fully working: correct DNS, a valid certificate, and a working database. Then verify end to end.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'curl https://bakery.town: what customers see\ndig bakery.town\nlb list: load balancers\ncat / edit town.zone, then dns reload\ncert show bakery.town / cert renew bakery.town\ndb status / db promote granary-replica / db fence granary-primary\ncat / edit app-config.yaml, then app restart' }],
    term: {
      host: 'ops',
      motd: '⚠ 02:00 PAGE: bakery.town unreachable\nOn call: you. Good luck.',
      files: {
        'town.zone': `bakery   300  IN  A  10.0.1.9   ; old LB (decommissioned)
library  300  IN  A  10.0.1.5`,
        'app-config.yaml': 'database:\n  host: granary-primary',
      },
      vars: { dns: '10.0.1.9', cert: false, promoted: false, fenced: false, appHost: 'granary-primary' },
      commands: [
        {
          match: /^curl\s+(?:-s\s+)?https?:\/\/bakery\.town\/?$/, usage: 'curl https://bakery.town', help: 'what customers see', run: (_m, s) => {
            if (s.vars.dns !== '10.0.1.5') return { out: 'curl: (7) Failed to connect to bakery.town (10.0.1.9): no route to host', evidence: true, verify: true };
            if (!s.vars.cert) return { out: 'curl: (60) SSL certificate problem: certificate has expired', evidence: true, verify: true };
            if (!(s.vars.promoted && s.vars.appHost === 'granary-replica')) return { out: 'HTTP 500 {"error":"could not connect to database granary-primary"}', evidence: true, verify: true };
            return { out: `HTTP 200 bakery ✓  (order test: saved)${s.vars.fenced ? '' : '\n⚠ warning: old primary not fenced'}`, verify: true };
          },
        },
        { match: /^dig\s+bakery\.town$/, usage: 'dig bakery.town', help: 'DNS lookup', run: (_m, s) => ({ out: `bakery.town. 300 IN A ${s.vars.dns}${s.vars.dns === '10.0.1.9' ? '   (old LB, decommissioned last week)' : ''}` }) },
        { match: /^lb list$/, usage: 'lb list', help: 'load balancers', run: () => ({ out: 'lb-old  10.0.1.9  DECOMMISSIONED\nlb-1    10.0.1.5  ACTIVE  (serves bakery, library)' }) },
        { match: /^dns reload$/, usage: 'dns reload', help: 'apply town.zone', run: (_m, s) => { const ip = squash(s.files['town.zone']).match(/bakery 300 in a (\d+\.\d+\.\d+\.\d+)/)?.[1] ?? s.files['town.zone'].match(/bakery\s+\d+\s+IN\s+A\s+(\S+)/i)?.[1] ?? ''; s.vars.dns = ip; return { out: `zone reloaded: bakery → ${ip || '(missing!)'}`, changed: true, bad: ip !== '10.0.1.5' && ip !== '10.0.1.9' }; } },
        { match: /^cert show bakery\.town$/, usage: 'cert show bakery.town', help: 'certificate info', run: (_m, s) => ({ out: s.vars.cert ? 'valid until: +90 days · auto-renew: on' : 'valid until: yesterday 23:59 (EXPIRED) · auto-renew: off', evidence: !s.vars.cert }) },
        { match: /^cert renew bakery\.town$/, usage: 'cert renew bakery.town', help: 'renew via Town CA', run: (_m, s) => { s.vars.cert = true; return { out: 'issued: bakery.town, www.bakery.town · valid 90 days · auto-renew enabled', changed: true }; } },
        { match: /^db status$/, usage: 'db status', help: 'database cluster', run: (_m, s) => ({ out: `granary-primary  ${s.vars.fenced ? 'FENCED' : 'DOWN (auto-recovery on)'}\ngranary-replica  ${s.vars.promoted ? 'PRIMARY' : 'replica, lag 0s'}`, evidence: true }) },
        { match: /^db promote granary-replica$/, usage: 'db promote granary-replica', help: 'promote replica', run: (_m, s) => { s.vars.promoted = true; return { out: 'promoted: read-write', changed: true }; } },
        { match: /^db fence granary-primary$/, usage: 'db fence granary-primary', help: 'fence old primary', run: (_m, s) => { s.vars.fenced = true; return { out: 'old primary fenced', changed: true }; } },
        { match: /^app restart$/, usage: 'app restart', help: 'restart app with config', run: (_m, s) => { s.vars.appHost = squash(s.files['app-config.yaml']).match(/host: ([\w-]+)/)?.[1] ?? ''; return { out: `app restarted → db ${s.vars.appHost}`, changed: true }; } },
      ],
    },
    check: (s) => ({
      cases: [
        c('bakery.town resolves to the live load balancer', s.vars.dns === '10.0.1.5'),
        c('certificate valid & auto-renewing', !!s.vars.cert),
        c('replica promoted and app repointed', !!s.vars.promoted && s.vars.appHost === 'granary-replica'),
        c('old primary fenced', !!s.vars.fenced),
      ],
      hint: 'Work outside in. Each curl tells you the next layer that\'s broken.',
    }),
    solve: (s) => { s.files['town.zone'] = s.files['town.zone'].replace('10.0.1.9', '10.0.1.5'); s.vars.dns = '10.0.1.5'; s.vars.cert = true; s.vars.promoted = true; s.vars.fenced = true; s.files['app-config.yaml'] = s.files['app-config.yaml'].replace('granary-primary', 'granary-replica'); s.vars.appHost = 'granary-replica'; },
    recap: {
      headline: 'Three failures stacked up. You peeled them back one layer at a time.',
      before: { lines: ['DNS → 10.0.1.9 (dead LB)', 'cert expired', 'db primary down, app → primary'], outcome: 'bakery.town: down' },
      after: () => ({ lines: ['DNS → 10.0.1.5', 'cert renewed + auto-renew', 'replica promoted, primary fenced'], outcome: 'bakery.town: 200 OK ✓' }),
      why: 'Real outages often have several causes, and each one hides the next. Work from the user inward (name → connection → trust → app → data), verify after every fix, and keep notes for the postmortem. That\'s the whole job, and you just did it.',
      real: `dig bakery.town            # DNS
curl -v https://bakery.town # TLS + HTTP
openssl s_client -connect bakery.town:443 | openssl x509 -noout -dates
kubectl logs deploy/bakery-app | grep database
# fix, verify, repeat, then write the postmortem`,
      realCaption: 'Congratulations, on-call engineer. Ninefold sleeps soundly tonight.',
    },
  },
];
