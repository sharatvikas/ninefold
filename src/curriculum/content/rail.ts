import { arr, c, has, num, type LevelSpec } from '../spec';

/** Oven warm-up times (seconds) for 20 simulated test runs: realistic spread. */
const WARMUPS = [1.2, 2.8, 1.9, 2.6, 1.1, 1.5, 1.4, 1.8, 1.7, 1.3, 3.4, 1.4, 1.6, 1.9, 1.8, 3.1, 1.2, 1.6, 2.3, 1.5];
/** 5 of the 20 runs take longer than the test's 2s sleep: the "one in four" in the story. */
const WARM_AVG = (WARMUPS.reduce((a, b) => a + b, 0) / WARMUPS.length).toFixed(1);

export const RAIL: LevelSpec[] = [
  // ------------------------------------------------------------------ 1. Derailed (missing dependency)
  {
    id: 'rail-1',
    type: 'config',
    alert: 'BUILD TRAIN DERAILED',
    board: { broken: ['build #482', 'FAILED at: build', 'parts: 3 of 4'], fixed: ['build #483', 'PASSED ✓', 'parts: 4 of 4'] },
    intro: {
      symptom: 'Every morning a build train assembles the bakery\'s app from parts and runs it through the stations. This morning it came off the rails and nothing shipped.',
      known: [
        'Each carriage is built from the parts list (the app\'s manifest).',
        'Yesterday Rosa added a "date-utils" part to the code to show opening hours.',
        'The stations are: fetch parts → build → test → ship.',
      ],
      goal: 'Read the build log, fix what the train is missing, and get a clean build through every station.',
    },
    evidence: [
      {
        kind: 'log', id: 'log', icon: '📜', label: 'BUILD LOG', hint: 'Output from this morning\'s build. Click the line that explains the failure.',
        lines: [
          { t: '06:00:01', text: 'fetch parts: wheels, boiler, whistle (3 parts)', note: 'Only the parts on the list get fetched. Three parts.' },
          { t: '06:00:12', text: 'build: compiling opening-hours.js', note: 'The new opening-hours code from yesterday.' },
          { t: '06:00:13', text: 'ERROR cannot find part "date-utils"', note: 'There it is: the code needs date-utils, but it\'s not on the parts list, so it was never fetched.', evidence: true },
          { t: '06:00:13', text: 'build failed (exit 1)', note: 'The build station failed because of the missing part above.' },
          { t: '06:00:14', text: 'test, ship: skipped', note: 'Later stations didn\'t run because the build failed.' },
        ],
      },
      {
        kind: 'inspect', id: 'diff', icon: '🔀', label: 'YESTERDAY\'S CHANGE', hint: 'What Rosa changed yesterday.',
        items: [
          { title: 'opening-hours.js', summary: '+ import date-utils', detail: 'The code now imports date-utils… but the manifest (parts list) wasn\'t updated in the same change.', evidence: true },
          { title: 'manifest', summary: '(unchanged)', detail: 'The parts list still says: wheels, boiler, whistle.' },
        ],
      },
    ],
    configTitle: 'TRAIN SETUP',
    fields: [
      { kind: 'set', key: 'parts', label: 'parts list', options: [['wheels', 'wheels'], ['boiler', 'boiler'], ['whistle', 'whistle'], ['date-utils', 'date-utils'], ['everything', 'every part in the depot']] },
      { kind: 'toggle', key: 'skipBuild', label: 'skip failing stations', on: 'SKIP', off: 'RUN ALL' },
    ],
    start: { parts: ['wheels', 'boiler', 'whistle'], skipBuild: false },
    solution: { parts: ['wheels', 'boiler', 'whistle', 'date-utils'], skipBuild: false },
    applyLabel: 'RUN THE BUILD TRAIN',
    verify: (x) => {
      const p = arr(x.parts);
      const everything = has(p, 'everything');
      const needed = ['wheels', 'boiler', 'whistle', 'date-utils'].every((n) => has(p, n)) || everything;
      return {
        cases: [
          c('fetch parts', true),
          c('build: every part the code imports is present', needed),
          c('test: all stations actually ran', !x.skipBuild),
          c('ship', needed && !x.skipBuild),
        ],
        hint: x.skipBuild ? 'Skipping stations ships an untested train. That hides the problem, it doesn\'t fix it.' : 'What does the code need that the train never fetched?',
        wasteful: everything ? 'pulling every part in the depot makes every build slow and huge. List only what the code uses.' : undefined,
      };
    },
    recap: {
      headline: 'The code used a new part that was never added to the parts list.',
      before: { lines: ['manifest: wheels, boiler, whistle', 'code:     + import date-utils'], outcome: 'build ✗ cannot find "date-utils"' },
      after: (x) => ({ lines: [`manifest: ${arr(x.parts).join(', ')}`, 'code:     import date-utils'], outcome: 'build ✓ test ✓ ship ✓' }),
      why: 'A build only has what\'s declared. The code and the dependency list must change together. The build log said exactly what was missing; skipping stations would have shipped broken code.',
      real: `// package.json
  "dependencies": {
    "wheels": "^2.0.0",
    "boiler": "^1.4.0",
    "whistle": "^0.9.0",
+   "date-utils": "^3.1.0"
  }

$ npm ci && npm run build   # ✓`,
      realCaption: 'Builds should run "npm ci" from the lockfile, so a missing dependency fails loudly in CI rather than in production.',
    },
  },

  // ------------------------------------------------------------------ 2. Flaky Signal
  {
    id: 'rail-2',
    type: 'config',
    alert: 'SIGNAL FLICKERS RED/GREEN',
    board: { broken: ['oven test: flaky', 'fails ~25% of runs'], fixed: ['oven test: stable', '20/20 passed'] },
    intro: {
      symptom: 'The "bread is baked" test fails about one run in four, then passes when re-run. Everyone has stopped trusting the red signal.',
      known: [
        'The test puts dough in the oven, waits, then checks the bread.',
        'Nobody changed the oven or the recipe.',
        'A test that fails at random teaches people to ignore real failures.',
      ],
      goal: 'Find why the test is flaky and make it reliable, without just hiding the failures.',
    },
    evidence: [
      {
        kind: 'chart', id: 'warm', icon: '📈', label: 'OVEN WARM-UP', hint: 'How long the oven took to warm up in recent runs (seconds). The line is how long the test waits.',
        bars: WARMUPS.slice(0, 10).map((v, i) => ({ label: `#${i + 1}`, value: v, note: v > 2 ? `Run #${i + 1}: oven took ${v}s, but the test only waited 2s. The bread wasn't ready → test failed.` : `Run #${i + 1}: oven warmed in ${v}s, within the 2s wait → passed.`, evidence: v > 2 })),
        unit: 's',
        limit: { value: 2, label: 'TEST WAITS 2s' },
      },
      {
        kind: 'log', id: 'test', icon: '📜', label: 'TEST CODE', hint: 'The test, line by line.',
        lines: [
          { text: 'put dough in oven', note: 'Fine.' },
          { text: 'sleep(2 seconds)', note: 'A fixed wait. Ovens take 1 to 4 seconds to warm. Sometimes 2s is enough, sometimes not. That\'s the flakiness.', evidence: true },
          { text: 'check bread is golden', note: 'The real check. Correct when the oven had time.' },
        ],
      },
    ],
    configTitle: 'OVEN TEST',
    fields: [
      { kind: 'choice', key: 'wait', label: 'how the test waits', options: [['fixed2', 'sleep 2s'], ['fixed10', 'sleep 10s'], ['poll', 'check every 0.2s until ready (give up at 15s)']] },
      { kind: 'toggle', key: 'retry', label: 'auto-retry failures', on: 'RETRY ×3', off: 'NO RETRY' },
    ],
    start: { wait: 'fixed2', retry: false },
    solution: { wait: 'poll', retry: false },
    applyLabel: 'RUN THE TEST 20 TIMES',
    verify: (x) => {
      const pass = (w: number) => (x.wait === 'fixed2' ? w <= 2 : true);
      const fails = WARMUPS.filter((w) => !pass(w)).length;
      const avg = x.wait === 'fixed10' ? 10 : x.wait === 'poll' ? WARMUPS.reduce((a, b) => a + b, 0) / WARMUPS.length : 2;
      return {
        cases: [
          c(`20 runs: ${20 - fails} passed`, fails === 0),
          c('real failures are still reported (no hiding)', !x.retry),
          c(`average test time ${avg.toFixed(1)}s (under 5s)`, avg < 5),
        ],
        hint: x.retry ? 'Retrying hides flakiness: a genuinely broken oven would also pass on retry #3. Fix the cause.' : x.wait === 'fixed10' ? 'Reliable, but every run now waits 10 seconds even when the oven is ready in 1.' : 'The oven doesn\'t always take the same time. Should the test wait a fixed time?',
      };
    },
    recap: {
      headline: 'The test guessed how long the oven takes. Now it checks.',
      before: { lines: ['sleep(2)', 'expect(bread).golden()'], outcome: 'fails whenever the oven takes > 2s (~25%)' },
      after: () => ({ lines: ['waitUntil(oven.ready,', '  { every: 0.2s, timeout: 15s })', 'expect(bread).golden()'], outcome: `20/20 passed, ~${WARM_AVG}s avg ✓` }),
      why: 'Fixed sleeps are the most common cause of flaky tests: the wait is either too short (flaky) or too long (slow). Waiting for the condition itself is both reliable and fast. Retries just hide the flakiness, and real bugs with it.',
      real: `- await sleep(2000);
+ await waitFor(() => oven.isReady(), { interval: 200, timeout: 15000 });
  expect(await bread.color()).toBe('golden');`,
      realCaption: 'Playwright, Cypress and testing-library all have "wait for condition" helpers for exactly this.',
    },
  },

  // ------------------------------------------------------------------ 3. Slow Line (pipeline speed)
  {
    id: 'rail-3',
    type: 'config',
    alert: 'PIPELINE TAKES 40 MINUTES',
    board: { broken: ['pipeline: 40 min', 'deploys/day: 3'], fixed: ['pipeline: fast', 'deploys/day: lots'] },
    intro: {
      symptom: 'The deploy pipeline takes 40 minutes. Engineers batch up changes to avoid waiting, which makes every release bigger and riskier.',
      known: [
        'Stages run one after another: install → lint → unit tests → integration tests → build.',
        'Lint and unit tests don\'t depend on each other.',
        'Integration tests can be split across several runners (shards), each with ~1 minute of setup.',
      ],
      goal: 'Get the pipeline to 15 minutes or less without paying for a fleet of runners.',
    },
    evidence: [
      {
        kind: 'chart', id: 'stages', icon: '📈', label: 'STAGE TIMES', hint: 'Minutes per stage in the last run. Click the bars.',
        bars: [
          { label: 'install', value: 12, note: 'Install: 12 min downloading the same dependencies every time. They rarely change. A cache would skip this.', evidence: true },
          { label: 'lint', value: 3, note: 'Lint: 3 min. Independent of unit tests.' },
          { label: 'unit', value: 6, note: 'Unit tests: 6 min. Could run at the same time as lint.' },
          { label: 'integ', value: 16, note: 'Integration tests: 16 min, the biggest stage. Splitting it across runners would help.', evidence: true },
          { label: 'build', value: 3, note: 'Build: 3 min.' },
        ],
        unit: 'm',
      },
    ],
    configTitle: 'PIPELINE SETTINGS',
    fields: [
      { kind: 'toggle', key: 'cache', label: 'cache dependencies', on: 'CACHE', off: 'NO CACHE' },
      { kind: 'toggle', key: 'parallel', label: 'lint + unit together', on: 'PARALLEL', off: 'ONE BY ONE' },
      { kind: 'number', key: 'shards', label: 'integration shards', min: 1, max: 16, unit: 'runners' },
    ],
    start: { cache: false, parallel: false, shards: 1 },
    solution: { cache: true, parallel: true, shards: 4 },
    applyLabel: 'RUN PIPELINE',
    verify: (x) => {
      const install = x.cache ? 1 : 12;
      const mid = x.parallel ? 6 : 9;
      const s = num(x.shards);
      const integ = 16 / s + (s > 1 ? 1 : 0);
      const total = install + mid + integ + 3;
      return {
        cases: [
          c(`total time ${total.toFixed(0)} min (target ≤ 15)`, total <= 15.01),
          c('all tests still run', true),
        ],
        hint: 'Look at where the minutes go. What repeats needlessly, what could overlap, what could be split?',
        wasteful: s > 8 ? `${s} runners for one pipeline is expensive, and past 4–6 the setup overhead eats the gains.` : undefined,
      };
    },
    recap: {
      headline: 'Most of the 40 minutes was repeated or waiting work.',
      before: { lines: ['install 12 → lint 3 → unit 6', '→ integ 16 → build 3'], outcome: '40 minutes' },
      after: (x) => {
        const s = num(x.shards);
        const total = (x.cache ? 1 : 12) + (x.parallel ? 6 : 9) + 16 / s + (s > 1 ? 1 : 0) + 3;
        return { lines: [`install ${x.cache ? '1 (cached)' : 12}`, `lint ‖ unit ${x.parallel ? 6 : 9}`, `integ ${(16 / s + (s > 1 ? 1 : 0)).toFixed(0)} (${s} shards) → build 3`], outcome: `${total.toFixed(0)} minutes ✓` };
      },
      why: 'Fast pipelines come from three moves: don\'t redo work (caching), don\'t wait for unrelated work (parallel jobs), and split the long pole (sharding). Each has a cost, so measure stage times first and attack the biggest.',
      real: `# .github/workflows/ci.yml
jobs:
  lint:                 # lint, unit and integ jobs run in parallel
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }   # cached deps
      - run: npm ci && npm run lint
  integ:
    runs-on: ubuntu-latest
    strategy:
      matrix: { shard: [1, 2, 3, 4] }
    steps:              # same checkout + setup-node, then:
      - run: npm ci && npm run test:integ -- --shard=\${{ matrix.shard }}/4`,
      realCaption: 'Speeding up CI means more frequent, smaller releases, which are much safer.',
    },
  },

  // ------------------------------------------------------------------ 4. Wrong Cargo (artifact versioning)
  {
    id: 'rail-4',
    type: 'config',
    alert: 'PROD IS RUNNING LAST WEEK\'S BUILD',
    board: { broken: ['expected: v2.4.1', 'running: v2.3.0 ?!'], fixed: ['running: v2.4.1', 'pinned ✓'] },
    intro: {
      symptom: 'The release notes say v2.4.1 shipped this morning, but production is clearly running last week\'s menu.',
      known: [
        'Builds are pushed to the registry with a label (tag), and production pulls by label.',
        'Production pulls "bakery-app:latest".',
        'An old branch\'s nightly job still runs, and it also pushes images.',
      ],
      goal: 'Make sure production runs exactly the build you meant to ship, every time.',
    },
    evidence: [
      {
        kind: 'log', id: 'registry', icon: '📜', label: 'REGISTRY LOG', hint: 'Pushes and pulls this morning. Click lines.',
        lines: [
          { t: '08:10', text: 'push bakery-app:v2.4.1   sha256:bb22…  (main)', note: 'The new release was built and pushed.' },
          { t: '08:10', text: 'push bakery-app:latest   sha256:bb22…  (main)', note: '"latest" pointed at the new build… for now.' },
          { t: '08:40', text: 'push bakery-app:latest   sha256:aa11…  (old-branch nightly)', note: 'Here it is: the old branch\'s nightly job re-pushed "latest", moving the label back to last week\'s build.', evidence: true },
          { t: '09:00', text: 'pull bakery-app:latest → sha256:aa11…  (prod)', note: 'Production pulled "latest", which now meant the old build. Labels that move can\'t be trusted for deploys.', evidence: true },
        ],
      },
    ],
    configTitle: 'DEPLOY SETTINGS',
    fields: [
      { kind: 'choice', key: 'ref', label: 'production pulls', options: [['latest', 'bakery-app:latest'], ['tag', 'bakery-app:v2.4.1'], ['digest', 'bakery-app@sha256:bb22…']] },
      { kind: 'toggle', key: 'immutable', label: 'registry tags', on: 'IMMUTABLE', off: 'OVERWRITABLE' },
    ],
    start: { ref: 'latest', immutable: false },
    solution: { ref: 'tag', immutable: true },
    applyLabel: 'DEPLOY (NIGHTLY JOB STILL RUNS)',
    verify: (x) => {
      const correct = x.ref === 'digest' || (x.ref === 'tag' && !!x.immutable);
      return {
        cases: [
          c('production runs v2.4.1 right after deploy', x.ref !== 'latest' || !x.immutable),
          c('still v2.4.1 after the old nightly job pushes again', correct),
          c('the old job can\'t silently overwrite release labels', !!x.immutable || x.ref === 'digest'),
        ],
        hint: x.ref === 'tag' ? 'A version label helps, but if labels can be overwritten, someone can still move v2.4.1.' : x.ref === 'latest' ? '"latest" is whatever was pushed last, by anyone. Is that what you want in production?' : 'Close! Is there anything left that can move a label under you?',
      };
    },
    recap: {
      headline: 'Production trusted a label that anyone could move.',
      before: { lines: ['image: bakery-app:latest', 'tags: overwritable'], outcome: 'old nightly re-tags → prod runs v2.3.0' },
      after: (x) => ({ lines: [`image: ${x.ref === 'digest' ? 'bakery-app@sha256:bb22…' : x.ref === 'tag' ? 'bakery-app:v2.4.1' : 'bakery-app:latest'}`, `tags: ${x.immutable ? 'immutable' : 'overwritable'}`], outcome: 'prod runs exactly v2.4.1 ✓' }),
      why: '"latest" means "whatever was pushed last", which isn\'t necessarily what you released. Deploy a specific version, and make release tags immutable (or deploy by digest, which can never change) so the artifact you tested is the one that runs.',
      real: `# deployment.yaml
-   image: bakery-app:latest
+   image: bakery-app:v2.4.1

$ aws ecr put-image-tag-mutability \\
    --repository-name bakery-app --image-tag-mutability IMMUTABLE`,
      realCaption: 'Build once, promote the same artifact through every environment.',
    },
  },

  // ------------------------------------------------------------------ 5. Canary (terminal)
  {
    id: 'rail-5',
    type: 'terminal',
    alert: 'CANARY RELEASE IN PROGRESS',
    board: { broken: ['v3: 10% of traffic', 'decision needed'], fixed: ['v3 rolled back', 'v2: 100% healthy'] },
    intro: {
      symptom: 'Version 3 of the bakery app is being released as a canary: 10% of customers get v3, 90% still get v2. The pipeline is waiting for someone to promote or abort.',
      known: [
        'A canary is a small first release to catch problems before everyone sees them.',
        'Promoting sends 100% of customers to v3. Aborting sends everyone back to v2.',
        'You\'re at the release terminal.',
      ],
      goal: 'Compare v3 against v2, make the right call, and confirm customers are healthy.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'rollout status: current split\nmetrics compare: error rate & latency, v2 vs v3\nlogs v3: recent v3 errors\nrollout promote / rollout abort: decide\ncurl http://bakery.town: sample 20 requests' }],
    term: {
      host: 'release',
      motd: 'Release console · rollout "bakery-app" · canary step 1/3 (10%) · paused for analysis',
      files: {},
      vars: { state: 'canary' },
      commands: [
        { match: /^rollout status$/, usage: 'rollout status', help: 'current traffic split', run: (_m, s) => ({ out: s.vars.state === 'canary' ? 'stable v2: 90%\ncanary v3: 10%\nstatus: PAUSED (waiting for promote/abort)' : s.vars.state === 'aborted' ? 'stable v2: 100%\ncanary v3: 0% (aborted)\nstatus: HEALTHY' : 'v3: 100%\nstatus: DEGRADED' }) },
        { match: /^metrics compare$/, usage: 'metrics compare', help: 'v2 vs v3 errors & latency', run: () => ({ out: '            v2 (stable)   v3 (canary)\nerror rate     0.2%          7.9%   ⚠\np95 latency    180ms         210ms\norders/min     54            5.8', evidence: true }) },
        { match: /^logs v3$/, usage: 'logs v3', help: 'recent canary errors', run: () => ({ out: 'ERROR checkout: price is undefined for item "seasonal-pie"\nERROR checkout: price is undefined for item "seasonal-pie"\nERROR checkout: price is undefined for item "seasonal-pie"', evidence: true }) },
        {
          match: /^rollout promote$/, usage: 'rollout promote', help: 'send 100% to v3', run: (_m, s) => {
            if (s.vars.state === 'aborted') return { out: 'nothing to promote: canary was aborted' };
            s.vars.state = 'promoted';
            return { out: 'promoted v3 to 100%…\n⚠ error rate now 7.9% for ALL customers. Checkout failing for seasonal pie.', changed: true, bad: true };
          },
        },
        { match: /^rollout abort$/, usage: 'rollout abort', help: 'send everyone back to v2', run: (_m, s) => { s.vars.state = 'aborted'; return { out: 'aborting canary… traffic 100% → v2 (stable)\ncanary pods scaled to 0', changed: true }; } },
        { match: /^rollout undo$/, usage: 'rollout undo', help: 'roll back a full promotion', run: (_m, s) => { if (s.vars.state !== 'promoted') return { out: 'nothing to undo' }; s.vars.state = 'aborted'; return { out: 'rolled back to v2: 100%', changed: true }; } },
        { match: /^curl\s+(?:https?:\/\/)?bakery\.town\/?$/, usage: 'curl http://bakery.town', help: 'sample 20 requests', run: (_m, s) => { const errs = s.vars.state === 'aborted' ? 0 : s.vars.state === 'promoted' ? 2 : 0; return { out: `20 requests: ${20 - errs} OK, ${errs} errors${s.vars.state === 'canary' ? ' (but 10% of real traffic is on v3)' : ''}`, verify: true }; } },
      ],
    },
    check: (s) => ({
      cases: [c('everyone is on the healthy version (v2)', s.vars.state === 'aborted'), c('error rate back to 0.2%', s.vars.state === 'aborted')],
      hint: 'Compare the canary against stable. Would you send everyone to it?',
    }),
    solve: (s) => { s.vars.state = 'aborted'; },
    recap: {
      headline: 'The canary did its job: it caught a bad release while only 10% saw it.',
      before: { lines: ['v2 90%  errors 0.2%', 'v3 10%  errors 7.9%'], outcome: 'waiting for a decision' },
      after: (s) => ({ lines: ['v2 100%  errors 0.2%', `v3 ${s.vars.state === 'aborted' ? 'aborted' : '?'}`], outcome: 'customers healthy ✓' }),
      why: 'A canary is only useful if someone compares it to the baseline and is willing to abort. v3 had 40× the error rate of v2, and the logs showed why (missing price for a new item). Aborting limited the damage to 10% of traffic for a few minutes.',
      real: `$ kubectl argo rollouts get rollout bakery-app
  canary  10%  ✖ errors 7.9%
$ kubectl argo rollouts abort bakery-app
# Better: automate it with an AnalysisTemplate that aborts
# when error rate > 1% for 2 minutes.`,
      realCaption: 'Argo Rollouts and Flagger can make this call for you, using metrics.',
    },
  },

  // ------------------------------------------------------------------ 6. Blue-Green Junction (terminal)
  {
    id: 'rail-6',
    type: 'terminal',
    alert: 'SWITCH TO GREEN WITHOUT DOWNTIME',
    board: { broken: ['live: blue (v1)', 'green (v2): not ready'], fixed: ['live: green (v2)', 'downtime: 0s ✓'] },
    intro: {
      symptom: 'The new bakery app (v2) is deployed to the "green" environment, next to the live "blue" one (v1). The plan is to switch the junction to green tonight, with zero downtime.',
      known: [
        'The junction (router) sends all customers to either blue or green.',
        'You can switch back instantly if green misbehaves.',
        'Never switch customers onto something you haven\'t checked.',
      ],
      goal: 'Get green healthy, switch the junction, and confirm customers are on v2.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'env status: blue & green\ncurl http://green.internal/health: check green directly\nlogs green: green\'s startup log\nmigrate --env green: run database migrations\nswitch --to green|blue: move the junction\ncurl http://bakery.town: what customers see' }],
    term: {
      host: 'deploy',
      motd: 'Deploy console · live: BLUE (v1) · standby: GREEN (v2)',
      files: {},
      vars: { migrated: false, live: 'blue', outage: false },
      commands: [
        { match: /^env status$/, usage: 'env status', help: 'blue & green state', run: (_m, s) => ({ out: `blue  v1  ${s.vars.live === 'blue' ? 'LIVE' : 'standby'}  healthy\ngreen v2  ${s.vars.live === 'green' ? 'LIVE' : 'standby'}  ${s.vars.migrated ? 'healthy' : 'UNHEALTHY'}` }) },
        { match: /^curl\s+(?:https?:\/\/)?green\.internal\/health$/, usage: 'curl http://green.internal/health', help: 'check green', run: (_m, s) => (s.vars.migrated ? { out: 'HTTP 200 {"status":"ok","version":"v2"}' } : { out: 'HTTP 503 {"status":"starting","error":"database schema is v1, app needs v2: migrations pending"}', evidence: true }) },
        { match: /^logs green$/, usage: 'logs green', help: 'green startup log', run: (_m, s) => (s.vars.migrated ? { out: 'ready on :3000' } : { out: 'checking schema… found v1, need v2\nERROR pending migration 0042_add_seasonal_menu\nnot ready', evidence: true }) },
        { match: /^migrate --env green$/, usage: 'migrate --env green', help: 'run DB migrations for v2', run: (_m, s) => { s.vars.migrated = true; return { out: 'applying 0042_add_seasonal_menu (adds column, backward compatible)… done\nschema v2 (v1 app still works with it)', changed: true }; } },
        {
          match: /^switch --to (blue|green)$/, usage: 'switch --to green', help: 'move the junction', run: (m, s) => {
            s.vars.live = m[1];
            if (m[1] === 'green' && !s.vars.migrated) { s.vars.outage = true; return { out: 'junction → green\n⚠ customers getting HTTP 503 from green!', changed: true, bad: true }; }
            return { out: `junction → ${m[1]} (instant, no dropped connections)`, changed: true };
          },
        },
        { match: /^curl\s+(?:https?:\/\/)?bakery\.town\/?$/, usage: 'curl http://bakery.town', help: 'what customers see', run: (_m, s) => ({ out: s.vars.live === 'green' ? (s.vars.migrated ? 'HTTP 200 bakery v2 ✓' : 'HTTP 503') : 'HTTP 200 bakery v1', verify: true }) },
      ],
    },
    check: (s) => ({
      cases: [c('green is healthy (migrations done)', !!s.vars.migrated), c('customers are on green (v2)', s.vars.live === 'green'), c('customers get HTTP 200', s.vars.live === 'green' && !!s.vars.migrated)],
      hint: 'Is green actually healthy? Check it directly before customers do.',
    }),
    solve: (s) => { s.vars.migrated = true; s.vars.live = 'green'; },
    recap: {
      headline: 'Green wasn\'t ready: its database migration hadn\'t run. Check first, then switch.',
      before: { lines: ['live:  blue  v1', 'green: v2  503 (schema v1)'], outcome: 'switching now = outage' },
      after: () => ({ lines: ['migrate green (backward-compatible)', 'live:  green v2  200'], outcome: 'switched, zero downtime ✓' }),
      why: 'Blue-green gives instant, reversible switches, but only for an environment that\'s actually healthy. Run migrations that both versions can live with, verify green directly, then flip. If anything goes wrong, flip back.',
      real: `$ curl -s green.internal/health
{"error":"migrations pending"}
$ ./migrate up --env green
$ aws elbv2 modify-listener --listener-arn $L \\
    --default-actions Type=forward,TargetGroupArn=$GREEN_TG`,
      realCaption: 'Backward-compatible ("expand then contract") migrations let blue and green share one database.',
    },
  },
];

