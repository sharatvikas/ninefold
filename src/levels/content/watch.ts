import { rng } from '../../art/pixels';
import { arr, c, has, num, type LevelSpec } from '../spec';

/** ~300 lines of realistic noise with a handful of real errors. */
function bigLog(): string[] {
  const R = rng(42);
  const svc = ['menu-svc', 'checkout', 'auth', 'oven-ctl', 'stock'];
  const msgs = ['GET /menu 200 12ms', 'cache hit menu:today', 'POST /cart 200 31ms', 'session refreshed', 'oven temp 182C ok', 'stock check flour=OK', 'GET /health 200 1ms', 'order queued', 'WARN slow query 210ms (stock.list)', 'payment authorised'];
  const out: string[] = [];
  for (let i = 0; i < 300; i++) {
    const t = `09:${String(Math.floor(i / 6)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`;
    if (i % 53 === 17) {
      out.push(`${t} ERROR checkout: till timed out after 2.0s waiting for card reader (reader responded in ${(2.6 + R() * 1.2).toFixed(1)}s) order=${1000 + i}`);
      continue;
    }
    if (i % 71 === 40) {
      out.push(`${t} ERROR auth: token expired for user=guest (retried OK)`);
      continue;
    }
    out.push(`${t} INFO ${svc[Math.floor(R() * svc.length)]}: ${msgs[Math.floor(R() * msgs.length)]}`);
  }
  return out;
}

export const WATCH: LevelSpec[] = [
  // ------------------------------------------------------------------ 1. Lamps On (golden signals)
  {
    id: 'watch-1',
    type: 'config',
    alert: 'WATCHTOWER HAS NO LAMPS LIT',
    board: { broken: ['lamps lit: 0', 'outages noticed: late'], fixed: ['lamps: 4 golden signals', 'outages: seen early ✓'] },
    intro: {
      symptom: 'The Watchtower has eight lamp sockets but only budget to light four. Last month three outages were noticed by customers before anyone in the tower.',
      known: [
        'Each lamp watches one thing about the bakery\'s service.',
        'Good lamps tell you when customers are having a bad time.',
        'Read the last outages to see what would have warned you.',
      ],
      goal: 'Choose the four lamps that would have caught every recent outage.',
    },
    evidence: [
      {
        kind: 'inspect', id: 'outages', icon: '🗒', label: 'LAST OUTAGES', hint: 'What happened in recent outages. Click each.',
        items: [
          { title: 'Mar 3: "the site is so slow"', summary: 'pages took 9s', detail: 'Nothing was broken; everything was just slow. A lamp on how LONG requests take (latency) would have lit up.', evidence: true },
          { title: 'Mar 11: checkout errors', summary: '12% of orders failed', detail: 'Orders were failing with errors. A lamp on the share of requests that FAIL (errors) would have caught it.', evidence: true },
          { title: 'Mar 19: festival rush', summary: '5× normal visitors', detail: 'Demand spiked. A lamp on how MUCH is being asked (traffic) would have warned you before things slowed.', evidence: true },
          { title: 'Mar 27: ovens full', summary: 'queue grew for 2h', detail: 'The ovens were at capacity and orders queued. A lamp on how FULL the system is (saturation) would have shown it filling up.', evidence: true },
        ],
      },
    ],
    configTitle: 'LIGHT FOUR LAMPS',
    fields: [
      { kind: 'set', key: 'lamps', label: 'lamps', options: [['latency', 'how long requests take'], ['traffic', 'how many requests'], ['errors', 'share of requests failing'], ['saturation', 'how full ovens/queues are'], ['staff', 'number of bakers on shift'], ['laptop', 'mayor\'s laptop temperature'], ['door', 'colour of the shop door'], ['loc', 'lines of code written']] },
    ],
    start: { lamps: [] },
    solution: { lamps: ['latency', 'traffic', 'errors', 'saturation'] },
    applyLabel: 'REPLAY LAST MONTH',
    verify: (x) => {
      const l = arr(x.lamps);
      return {
        cases: [
          c('only four lamps (budget)', l.length <= 4),
          c('Mar 3 slow site caught', has(l, 'latency')),
          c('Mar 11 checkout errors caught', has(l, 'errors')),
          c('Mar 19 festival rush caught', has(l, 'traffic')),
          c('Mar 27 full ovens caught', has(l, 'saturation')),
        ],
        hint: 'For each outage, which signal would have changed first?',
      };
    },
    recap: {
      headline: 'Latency, traffic, errors, saturation: the four golden signals.',
      before: { lines: ['lamps: (none)'], outcome: '3 outages found by customers first' },
      after: (x) => ({ lines: arr(x.lamps).map((l) => `lamp: ${l}`), outcome: 'all 4 outages would have been caught ✓' }),
      why: 'These four signals describe what users feel (slow, failing) and what\'s coming (load, fullness). Measure them for every user-facing service before anything else. Most other metrics are for debugging, not alerting.',
      real: `# PromQL, one per golden signal
latency:    histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
traffic:    sum(rate(http_requests_total[5m]))
errors:     sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
saturation: avg(queue_depth) / avg(queue_capacity)`,
      realCaption: 'From the Google SRE book, chapter "Monitoring Distributed Systems".',
    },
  },

  // ------------------------------------------------------------------ 2. Needle in the Haystack (search logs)
  {
    id: 'watch-2',
    type: 'config',
    alert: 'SOME CHECKOUTS FAIL',
    board: { broken: ['checkout failures: ~2%', 'cause: unknown'], fixed: ['checkout failures: 0', 'till waits long enough ✓'] },
    intro: {
      symptom: 'About 2% of checkouts fail. Customers say the till just "gives up". The log has hundreds of lines a minute.',
      known: [
        'Almost every log line is normal noise.',
        'Searching is faster than scrolling: try words like ERROR or the service name.',
        'The till waits a fixed time for the card reader.',
      ],
      goal: 'Find the error that matters, then change the till setting so checkouts stop failing.',
    },
    evidence: [{ kind: 'search', id: 'logs', icon: '🔎', label: 'LOG SEARCH', hint: 'Search the logs. Matches are shown below.', lines: bigLog(), evidence: /till timed out/, placeholder: 'try: ERROR, checkout, timeout…' }],
    configTitle: 'TILL SETTINGS',
    fields: [
      { kind: 'number', key: 'timeout', label: 'wait for card reader', min: 0.5, max: 30, unit: 'seconds', step: 0.5 },
      { kind: 'toggle', key: 'retry', label: 'retry declined cards', on: 'RETRY', off: 'NO RETRY' },
    ],
    start: { timeout: 2, retry: false },
    solution: { timeout: 5, retry: false },
    applyLabel: 'REPLAY YESTERDAY\'S CHECKOUTS',
    verify: (x) => {
      const t = num(x.timeout);
      return {
        cases: [
          c(`card reader answers within ${t}s (slowest seen: 3.8s)`, t >= 4),
          c('a truly dead reader still fails fast enough (≤ 10s)', t <= 10),
          c('declined cards aren\'t charged twice', !x.retry),
        ],
        hint: x.retry ? 'Retrying a declined card doesn\'t help a timeout, and risks a double charge.' : t > 10 ? 'Customers would stare at the till for ages when the reader really is broken.' : 'What did the error say about how long the reader actually took?',
      };
    },
    recap: {
      headline: 'The till gave up at 2s, but the card reader sometimes needs nearly 4.',
      before: { lines: ['till timeout: 2.0s', 'reader: 2.6–3.8s sometimes'], outcome: '~2% of checkouts time out' },
      after: (x) => ({ lines: [`till timeout: ${num(x.timeout)}s`, 'reader: ≤ 3.8s'], outcome: '0 timeouts ✓' }),
      why: 'In noisy logs, search for the level (ERROR) and the symptom (checkout), not by scrolling. The error line had everything: what timed out, the limit, and the real duration. Timeouts should sit just above real worst-case latency, not at a guess.',
      real: `$ logcli query '{app="checkout"} |= "ERROR"'
ERROR till timed out after 2.0s … reader responded in 3.4s
# config
- CARD_READER_TIMEOUT=2s
+ CARD_READER_TIMEOUT=${'5s'}`,
      realCaption: 'Structured logs (JSON with fields like service, level, order_id) make these searches instant.',
    },
  },

  // ------------------------------------------------------------------ 3. Following the Courier (tracing)
  {
    id: 'watch-3',
    type: 'config',
    alert: 'MENU PAGE TAKES 2.4s',
    board: { broken: ['GET /menu p95: 2.4s', 'target: < 1s'], fixed: ['GET /menu p95: fast', 'target met ✓'] },
    intro: {
      symptom: 'The menu page takes 2.4 seconds to load. Each part of the system says it\'s "fine".',
      known: [
        'One page view travels through several services, like a courier with several stops.',
        'A trace records how long each stop took.',
        'The target is under 1 second.',
      ],
      goal: 'Find the slow stop in the trace and change it so the menu loads in under a second.',
    },
    evidence: [
      {
        kind: 'chart', id: 'trace', icon: '🧵', label: 'TRACE', hint: 'One request, stop by stop (milliseconds). Click each.',
        bars: [
          { label: 'gateway', value: 20, note: 'Gateway: 20ms. Fine.' },
          { label: 'menu-svc', value: 60, note: 'menu-svc: 60ms of its own work. Fine.' },
          { label: 'price-svc', value: 2150, note: 'price-svc: 2150ms. This is the slow stop. Look inside it…', evidence: true },
          { label: '└ tax ×3', value: 2100, note: 'Inside price-svc: three calls to the tax office, one after another, 700ms each. Tax rates change once a year.', evidence: true },
          { label: 'render', value: 40, note: 'Render: 40ms.' },
        ],
        unit: 'ms',
        limit: { value: 1000, label: 'TARGET 1s' },
      },
    ],
    configTitle: 'price-svc',
    fields: [{ kind: 'choice', key: 'fix', label: 'change', options: [['replicas', 'run 3× more price-svc copies'], ['timeout', 'raise tax call timeout to 5s'], ['parallel', 'make the 3 tax calls at the same time'], ['cache', 'cache tax rates for 1 hour']] }],
    start: { fix: '' },
    solution: { fix: 'cache' },
    applyLabel: 'LOAD THE MENU 100 TIMES',
    verify: (x) => {
      const p95 = x.fix === 'cache' ? 180 : x.fix === 'parallel' ? 870 : 2270;
      return {
        cases: [c(`p95 ${p95}ms (target < 1000ms)`, p95 < 1000), c('menu still shows correct prices', true)],
        hint: x.fix === 'replicas' ? 'More copies help when they\'re busy. These are just waiting on the tax office.' : x.fix === 'timeout' ? 'A longer timeout doesn\'t make the tax office faster.' : 'Where is the time going, and does that work need to happen on every request?',
        wasteful: x.fix === 'parallel' ? 'it works, but you still call the tax office 3 times per page view for data that changes once a year.' : undefined,
      };
    },
    recap: {
      headline: 'Every page view called the tax office three times, one after another, for data that changes yearly.',
      before: { lines: ['price-svc → tax (700ms)', '         → tax (700ms)', '         → tax (700ms)'], outcome: 'p95 2.4s' },
      after: (x) => ({ lines: x.fix === 'cache' ? ['price-svc → cache (1ms)', '(tax refreshed hourly)'] : ['price-svc → tax ×3 in parallel (700ms)'], outcome: x.fix === 'cache' ? 'p95 0.18s ✓' : 'p95 0.87s ✓' }),
      why: 'Metrics said "slow", but only a trace showed where: one stop, making repeated sequential calls. Adding copies or timeouts treats symptoms. Remove the repeated work (cache) or at least stop waiting in series (parallel).',
      real: `# trace (Tempo/Jaeger)
GET /menu ─────────────────────── 2.4s
  price-svc ──────────────────── 2.15s
    tax-api ───── 700ms
           tax-api ───── 700ms
                  tax-api ───── 700ms   ← N+1 pattern`,
      realCaption: 'Sequential repeated calls inside one span are the classic "N+1" shape in a trace.',
    },
  },

  // ------------------------------------------------------------------ 4. Crying Wolf (alert fatigue)
  {
    id: 'watch-4',
    type: 'config',
    alert: 'BELL RINGS 40× A NIGHT',
    board: { broken: ['pages last week: 286', 'real incidents: 2 (missed)'], fixed: ['pages: few', 'real incidents: caught ✓'] },
    intro: {
      symptom: 'The Watchtower bell rang 286 times last week, mostly at night, mostly for nothing. During one real outage, nobody looked because they assumed it was noise.',
      known: [
        'A page wakes someone up. It should mean "a customer is hurting, act now".',
        'Some things deserve a ticket for the morning instead.',
        'Last week had exactly two real incidents.',
      ],
      goal: 'Choose which alerts page, so real incidents are caught and nights are quiet.',
    },
    evidence: [
      {
        kind: 'chart', id: 'pages', icon: '📈', label: 'PAGES BY RULE', hint: 'Pages per rule last week. Click each.',
        bars: [
          { label: 'CPU>70%', value: 190, note: 'CPU over 70%: 190 pages. Customers were fine every single time. High CPU is the system working, not a customer problem.', evidence: true },
          { label: 'disk>80%', value: 64, note: 'Disk over 80%: 64 pages. The disk fills over weeks. Worth fixing, but in office hours.', evidence: true },
          { label: 'any 500', value: 30, note: 'Every single error: 30 pages. One error isn\'t an outage; a rising error RATE is.' },
          { label: 'err rate', value: 2, note: 'Error rate over 2% for 5 minutes: 2 pages, both real incidents. Not even enabled for paging yet, these were emails!', evidence: true },
        ],
      },
    ],
    configTitle: 'ALERT ROUTING',
    fields: [
      { kind: 'set', key: 'page', label: 'PAGE (wake someone)', options: [['cpu', 'CPU > 70%'], ['disk', 'disk > 80%'], ['any500', 'any single 500 error'], ['errrate', 'error rate > 2% for 5 min'], ['latency', 'p95 latency > 1s for 10 min']] },
      { kind: 'set', key: 'ticket', label: 'TICKET (next morning)', options: [['cpu', 'CPU > 70%'], ['disk', 'disk > 80%'], ['any500', 'any single 500 error']] },
    ],
    start: { page: ['cpu', 'disk', 'any500'], ticket: [] },
    solution: { page: ['errrate', 'latency'], ticket: ['disk'] },
    applyLabel: 'REPLAY LAST WEEK',
    verify: (x) => {
      const p = arr(x.page);
      const t = arr(x.ticket);
      const pages = (has(p, 'cpu') ? 190 : 0) + (has(p, 'disk') ? 64 : 0) + (has(p, 'any500') ? 30 : 0) + (has(p, 'errrate') ? 2 : 0) + (has(p, 'latency') ? 1 : 0);
      return {
        cases: [
          c('both real incidents page someone', has(p, 'errrate')),
          c('slow-site incidents would page too', has(p, 'latency')),
          c(`pages last week: ${pages} (target ≤ 5)`, pages <= 5),
          c('disk filling up still gets looked at', has(t, 'disk') || has(p, 'disk')),
        ],
        hint: 'Page on what customers feel (symptoms), not on what machines are doing (causes). Slow problems can wait until morning.',
      };
    },
    recap: {
      headline: 'Page on customer pain, ticket the rest.',
      before: { lines: ['page: CPU>70%, disk>80%, any 500', 'email: error rate'], outcome: '286 pages, real incidents ignored' },
      after: (x) => ({ lines: [`page: ${arr(x.page).join(', ')}`, `ticket: ${arr(x.ticket).join(', ') || '(none)'}`], outcome: '3 pages, both incidents caught ✓' }),
      why: 'Every non-actionable page trains people to ignore the bell. Alert on symptoms (error rate, latency) that mean users are hurting, with a duration so blips don\'t page. Slow-burn causes like a filling disk become tickets.',
      real: `- alert: HighErrorRate
  expr: sum(rate(http_requests_total{code=~"5.."}[5m]))
        / sum(rate(http_requests_total[5m])) > 0.02
  for: 5m
  labels: { severity: page }
- alert: DiskFillingUp
  expr: disk_used_ratio > 0.8
  labels: { severity: ticket }`,
      realCaption: 'Every page should be urgent, actionable and user-visible. If it isn\'t, change it.',
    },
  },

  // ------------------------------------------------------------------ 5. The Dark Corner (instrumentation, terminal)
  {
    id: 'watch-5',
    type: 'terminal',
    alert: 'GRANARY SERVICE IS INVISIBLE',
    board: { broken: ['granary-svc metrics:', '(none)'], fixed: ['orders_total ✓', '/metrics exposed ✓'] },
    intro: {
      symptom: 'Gus says granary orders "felt slow yesterday", but the Watchtower can\'t see anything. The granary service has no metrics at all.',
      known: [
        'A service is instrumented by counting things in its code and exposing the numbers on /metrics.',
        'The town\'s metrics library is already installed (const metrics = require("metrics")).',
        'You\'re in the granary service\'s repo.',
      ],
      goal: 'Count every order the service handles, expose /metrics, and confirm the Watchtower can read it.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'cat app.js · edit app.js\nnpm start: run the service\ncurl localhost:3000/metrics\n\nLibrary usage:\nconst orders = metrics.counter("orders_total");\norders.inc();   // inside the handler\napp.get("/metrics", metrics.handler);' }],
    term: {
      host: 'granary-svc',
      motd: 'Repo: granary-svc · node app',
      files: {
        'app.js': `const express = require("express");
const metrics = require("metrics");
const app = express();

app.post("/orders", (req, res) => {
  saveOrder(req.body);
  res.send("ok");
});

app.listen(3000);`,
      },
      vars: { started: '' },
      commands: [
        { match: /^npm start$/, usage: 'npm start', help: 'run the service', run: (_m, s) => { s.vars.started = s.files['app.js']; return { out: 'granary-svc listening on :3000', changed: false }; } },
        {
          match: /^curl\s+(?:https?:\/\/)?localhost:3000\/metrics$/, usage: 'curl localhost:3000/metrics', help: 'what the Watchtower sees', run: (_m, s) => {
            const a = instr(String(s.vars.started));
            if (!s.vars.started) return { out: 'curl: connection refused (is the service running? npm start)' };
            if (!a.endpoint) return { out: 'HTTP 404 Cannot GET /metrics', evidence: true, verify: true };
            return { out: a.counter && a.inc ? '# TYPE orders_total counter\norders_total 1284' : '# (no metrics registered)', verify: true };
          },
        },
        { match: /^grep -r metrics \.?$/, usage: 'grep -r metrics .', help: 'where metrics are used', run: (_m, s) => ({ out: s.files['app.js'].split('\n').filter((l) => l.includes('metrics')).join('\n') + '\n(imported, never used)', evidence: true }) },
      ],
    },
    check: (s) => {
      const a = instr(String(s.vars.started));
      return {
        cases: [
          c('an orders_total counter exists', a.counter),
          c('it is incremented in the /orders handler', a.inc),
          c('/metrics is exposed', a.endpoint),
          c('the running service has your changes (npm start)', !!s.vars.started && s.vars.started === s.files['app.js']),
        ],
        hint: 'Edit app.js, then restart with npm start, then curl /metrics.',
      };
    },
    solve: (s) => {
      s.files['app.js'] = s.files['app.js']
        .replace('const app = express();', 'const app = express();\nconst orders = metrics.counter("orders_total");')
        .replace('saveOrder(req.body);', 'saveOrder(req.body);\n  orders.inc();')
        .replace('app.listen(3000);', 'app.get("/metrics", metrics.handler);\napp.listen(3000);');
      s.vars.started = s.files['app.js'];
    },
    recap: {
      headline: 'You can\'t see what you don\'t count.',
      before: { lines: ['app.post("/orders", …)', '(no counters, no /metrics)'], outcome: 'Watchtower: no data' },
      after: () => ({ lines: ['orders = metrics.counter("orders_total")', 'orders.inc() per order', 'GET /metrics'], outcome: 'orders_total 1284 ✓' }),
      why: 'Instrumentation is code: count the events that matter, expose them, and the monitoring system scrapes them. Start with request counts, errors and durations for every handler.',
      real: `const client = require('prom-client');
const orders = new client.Counter({ name: 'orders_total', help: 'Orders received' });
app.post('/orders', (req, res) => { orders.inc(); /* … */ });
app.get('/metrics', async (_req, res) => res.send(await client.register.metrics()));`,
      realCaption: 'OpenTelemetry auto-instrumentation can add most HTTP metrics for you.',
    },
  },

  // ------------------------------------------------------------------ 6. Dashboard Day (PromQL, terminal)
  {
    id: 'watch-6',
    type: 'terminal',
    alert: 'MAYOR WANTS ONE SCREEN',
    board: { broken: ['dashboard: empty panels'], fixed: ['availability 99.7%', 'p95 latency 310ms ✓'] },
    intro: {
      symptom: 'Mayor Bo wants one screen that answers "are customers OK?" The dashboard file has two empty panels.',
      known: [
        'Metrics available: http_requests_total{code="200"|"500"|…} and http_request_duration_seconds_bucket.',
        'Availability = successful requests ÷ all requests.',
        'You can test a query with: promql "<query>"',
      ],
      goal: 'Write the two queries (availability and p95 latency) into dashboard.yaml and load it.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'promql "sum(rate(http_requests_total[5m]))": try a query\ncat / edit dashboard.yaml\ndashboard load\n\nUseful pieces:\nrate(x[5m]): per-second rate over 5 minutes\nsum(...): add up across servers\ncode!~"5..": codes that are NOT 5xx\nhistogram_quantile(0.95, sum by (le) (rate(..._bucket[5m])))' }],
    term: {
      host: 'grafana',
      motd: 'Dashboard repo · datasource: town-prometheus',
      files: {
        'dashboard.yaml': `title: Are customers OK?
panels:
  - title: Availability (%)
    query: ""
  - title: p95 latency (s)
    query: ""`,
      },
      vars: { loaded: '' },
      commands: [
        {
          match: /^promql\s+["'](.+)["']$/, usage: 'promql "sum(rate(http_requests_total[5m]))"', help: 'run a query', run: (m) => {
            const q = m[1].replace(/\s+/g, '');
            if (isAvail(q)) return { out: '0.9971  (99.7% of requests succeed)' };
            if (isP95(q)) return { out: '0.31  (95% of requests finish within 310ms)' };
            if (/http_requests_total/.test(q)) return { out: q.includes('rate') ? 'per-server series… (try sum() and a ratio)' : '1849302  (a counter only goes up; use rate())', evidence: true };
            if (/duration/.test(q)) return { out: 'many bucket series… (use histogram_quantile)', evidence: true };
            return { out: 'no data' };
          },
        },
        { match: /^dashboard load$/, usage: 'dashboard load', help: 'load dashboard.yaml', run: (_m, s) => { s.vars.loaded = s.files['dashboard.yaml']; const p = panels(s.files['dashboard.yaml']); return { out: `Availability: ${isAvail(p[0]) ? '99.7% ✓' : 'invalid / empty'}\np95 latency: ${isP95(p[1]) ? '0.31s ✓' : 'invalid / empty'}`, changed: true, verify: true }; } },
      ],
    },
    check: (s) => {
      const p = panels(String(s.vars.loaded));
      return {
        cases: [c('availability = good requests ÷ all requests', isAvail(p[0])), c('p95 latency from the duration histogram', isP95(p[1])), c('dashboard loaded', !!s.vars.loaded)],
        hint: 'Test each query with promql first, then paste it into dashboard.yaml and run dashboard load.',
      };
    },
    solve: (s) => {
      s.files['dashboard.yaml'] = s.files['dashboard.yaml']
        .replace('query: ""', 'query: sum(rate(http_requests_total{code!~"5.."}[5m])) / sum(rate(http_requests_total[5m]))')
        .replace('query: ""', 'query: histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))');
      s.vars.loaded = s.files['dashboard.yaml'];
    },
    recap: {
      headline: 'Two queries that answer "are customers OK?"',
      before: { lines: ['Availability: query ""', 'p95 latency:  query ""'], outcome: 'empty dashboard' },
      after: () => ({ lines: ['good ÷ all over 5m', 'histogram_quantile(0.95, …)'], outcome: '99.7% · 310ms ✓' }),
      why: 'Counters only go up, so use rate() to see change per second, sum() to combine servers, and a ratio for availability. Latency needs a percentile from the histogram, since averages hide the slow requests customers notice.',
      real: `sum(rate(http_requests_total{code!~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))

histogram_quantile(0.95,
  sum by (le) (rate(http_request_duration_seconds_bucket[5m])))`,
      realCaption: 'These two lines are the start of almost every service dashboard and SLO.',
    },
  },
];

function instr(js: string): { counter: boolean; inc: boolean; endpoint: boolean } {
  const q = js.replace(/\s+/g, '');
  const counterVar = q.match(/(?:const|let|var)(\w+)=metrics\.counter\(["']orders_total["']\)/)?.[1];
  const handler = q.match(/app\.post\(["']\/orders["'],\(req,res\)=>\{(.*?)\}\);/)?.[1] ?? '';
  return {
    counter: !!counterVar,
    inc: !!counterVar && handler.includes(`${counterVar}.inc()`),
    endpoint: /app\.get\(["']\/metrics["'],metrics\.handler\)/.test(q),
  };
}

function panels(yaml: string): string[] {
  return [...yaml.matchAll(/query:\s*(.*)/g)].map((m) => m[1].trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ''));
}

function isAvail(q = ''): boolean {
  q = q.replace(/\s+/g, '');
  return /sum\(rate\(http_requests_total\{code(!~"5\.\."|=~"[24]\.\.")\}\[\d+m\]\)\)\/sum\(rate\(http_requests_total(\{\})?\[\d+m\]\)\)/.test(q.replace(/'/g, '"'));
}

function isP95(q = ''): boolean {
  q = q.replace(/\s+/g, '');
  return /histogram_quantile\(0\.95,sum(by\(le\))?\(rate\(http_request_duration_seconds_bucket\[\d+m\]\)\)(by\(le\))?\)/.test(q);
}

