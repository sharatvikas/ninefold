import { c, num, str, type LevelSpec } from '../spec';
import { squash } from '../terminal';

const LABELS = ['bakery-app:v2.4.0', 'bakery-app:v2.4.1', 'bakery-app:v2.3.9', 'library-app:v1.2.0', 'menu-svc:v5.0.2'];

export const HARBOR: LevelSpec[] = [
  // ------------------------------------------------------------------ 2. Wrong Label (ImagePullBackOff)
  {
    id: 'harbor-2',
    type: 'config',
    alert: 'CRANE CAN\'T FIND THE CARGO',
    board: { broken: ['ship-9: waiting', 'cargo not found'], fixed: ['ship-9: loaded', 'sailing ✓'] },
    intro: {
      symptom: 'Ship-9 has been waiting at the dock for an hour. The crane keeps going to the warehouse, coming back empty, and trying again, slower each time.',
      known: [
        'The ship\'s order says which cargo label to load.',
        'The warehouse stores cargo by exact label.',
        'The order was typed by hand this morning.',
      ],
      goal: 'Find out why the crane comes back empty, fix the order, and get ship-9 loaded.',
    },
    evidence: [
      {
        kind: 'log', id: 'crane', icon: '📜', label: 'CRANE LOG', hint: 'Click lines.',
        lines: [
          { t: '09:00', text: 'order: load "bakery-app:v2.4.l"', note: 'The order this morning. Look very closely at the label.' },
          { t: '09:00', text: 'warehouse: no cargo labeled "bakery-app:v2.4.l"', note: 'The warehouse has nothing with that exact label. Compare it with the warehouse list: that last character is a lowercase L, not a one.', evidence: true },
          { t: '09:02', text: 'retrying in 10s… 20s… 40s… (back-off)', note: 'The crane retries, waiting longer each time. That\'s the "back-off" part.' },
        ],
      },
      { kind: 'inspect', id: 'wh', icon: '📦', label: 'WAREHOUSE', hint: 'Labels in the warehouse.', items: LABELS.map((l) => ({ title: l, summary: l.startsWith('bakery') ? 'bakery' : 'other', detail: l === 'bakery-app:v2.4.1' ? `"${l}": the newest bakery release, ending in the digit one.` : `"${l}" is in stock.`, evidence: l === 'bakery-app:v2.4.1' })) },
    ],
    configTitle: 'SHIP-9 ORDER',
    fields: [{ kind: 'text', key: 'image', label: 'load cargo' }],
    start: { image: 'bakery-app:v2.4.l' },
    solution: { image: 'bakery-app:v2.4.1' },
    applyLabel: 'SEND THE CRANE',
    verify: (x) => {
      const i = str(x.image).trim();
      return {
        cases: [c(`warehouse has "${i}"`, LABELS.includes(i)), c('it\'s the newest bakery release (v2.4.1)', i === 'bakery-app:v2.4.1')],
        hint: LABELS.includes(i) ? 'That label exists, but is it the release ship-9 is supposed to carry?' : 'Labels must match exactly, character for character. Compare with the warehouse list.',
      };
    },
    recap: {
      headline: 'One wrong character in the label, so the cargo could never be found.',
      before: { lines: ['image: bakery-app:v2.4.l', '          (lowercase L) ^'], outcome: 'ErrImagePull → ImagePullBackOff' },
      after: (x) => ({ lines: [`image: ${str(x.image)}`], outcome: 'pulled, running ✓' }),
      why: 'ImagePullBackOff means the node couldn\'t download the image: a typo, a tag that was never pushed, or missing registry credentials. The events say which. Retries back off because repeating instantly won\'t help.',
      real: `$ kubectl describe pod ship-9
  Failed to pull image "bakery-app:v2.4.l": not found
  Back-off pulling image
# deployment.yaml
-   image: bakery-app:v2.4.l
+   image: bakery-app:v2.4.1`,
      realCaption: 'Generate image tags in CI instead of typing them, and this whole class of typo goes away.',
    },
  },

  // ------------------------------------------------------------------ 3. Never Ready (readiness probe)
  {
    id: 'harbor-3',
    type: 'config',
    alert: 'SHIP RUNNING, NO PASSENGERS',
    board: { broken: ['ship-4: Running', 'Ready: 0/1'], fixed: ['ship-4: Running', 'Ready: 1/1 ✓'] },
    intro: {
      symptom: 'Ship-4 is running fine, but the harbor never lets passengers board. It\'s marked "not ready", forever.',
      known: [
        'Before boarding, the harbor master knocks on a door on the ship to ask "ready?" (the readiness probe).',
        'Only ships that answer "yes" get passengers (traffic).',
        'The ship\'s crew says everything on board is working.',
      ],
      goal: 'Get ship-4 marked ready so passengers can board.',
    },
    evidence: [
      {
        kind: 'log', id: 'events', icon: '📜', label: 'HARBOR EVENTS', hint: 'Click lines.',
        lines: [
          { t: '10:00', text: 'Started ship-4', note: 'The ship started fine.' },
          { t: '10:00', text: 'Readiness probe failed: GET :8080/healthz → connection refused', note: 'The harbor master knocks on port 8080, path /healthz. Nobody answers on 8080 at all.', evidence: true },
          { t: '10:05', text: 'Readiness probe failed (x60)', note: 'Every 5 seconds since. The ship stays out of service.' },
        ],
      },
      {
        kind: 'log', id: 'app', icon: '🚢', label: 'SHIP\'S LOG', hint: 'What the ship itself says.',
        lines: [
          { text: 'menu loaded (42 items)', note: 'The app works.' },
          { text: 'listening on port 3000', note: 'The ship answers on port 3000, not 8080.', evidence: true },
          { text: 'routes: GET /  GET /menu  GET /health', note: 'Its health door is /health (no "z").', evidence: true },
        ],
      },
    ],
    configTitle: 'readinessProbe.httpGet',
    fields: [
      { kind: 'text', key: 'path', label: 'path' },
      { kind: 'number', key: 'port', label: 'port', min: 1, max: 65535 },
      { kind: 'toggle', key: 'probe', label: 'readiness probe', on: 'ENABLED', off: 'REMOVED' },
    ],
    start: { path: '/healthz', port: 8080, probe: true },
    solution: { path: '/health', port: 3000, probe: true },
    applyLabel: 'ROLL OUT',
    verify: (x) => {
      const ok = !!x.probe && str(x.path).trim() === '/health' && num(x.port) === 3000;
      return {
        cases: [
          c('probe reaches the ship (right port)', !x.probe || num(x.port) === 3000),
          c('probe asks the right door (right path)', !x.probe || str(x.path).trim() === '/health'),
          c('ship marked Ready', ok || !x.probe),
          c('a broken ship would still be kept out of service', !!x.probe),
        ],
        hint: !x.probe ? 'Removing the probe makes it "ready" instantly, even when it isn\'t. Next time a broken ship would get passengers.' : 'Compare where the harbor knocks with where the ship actually answers.',
      };
    },
    recap: {
      headline: 'The harbor was knocking on the wrong door.',
      before: { lines: ['readinessProbe:', '  path: /healthz', '  port: 8080'], outcome: 'connection refused → Ready 0/1' },
      after: (x) => ({ lines: ['readinessProbe:', `  path: ${str(x.path)}`, `  port: ${num(x.port)}`], outcome: 'Ready 1/1 · receiving traffic ✓' }),
      why: 'A readiness probe decides if a pod gets traffic. If it points at the wrong port or path, a perfectly healthy app is never used. Removing the probe "works" but loses the protection: a broken pod would then receive traffic.',
      real: `readinessProbe:
  httpGet:
-   path: /healthz
-   port: 8080
+   path: /health
+   port: 3000
  periodSeconds: 5`,
      realCaption: 'kubectl describe pod shows probe failures in Events. Always read Events first.',
    },
  },

  // ------------------------------------------------------------------ 4. No Berth (Pending pods)
  {
    id: 'harbor-4',
    type: 'config',
    alert: 'SHIPS WAITING AT SEA',
    board: { broken: ['ship-5,6,7: Pending', 'berths: "full"'], fixed: ['ship-5,6,7: Running', 'berths fit ✓'] },
    intro: {
      symptom: 'Three new ships are stuck waiting at sea. Every berth says it\'s full, but the harbor looks half empty.',
      known: [
        'Each ship reserves berth space (a CPU request) before it\'s allowed in.',
        'Each berth (node) has 2000 units of space (2 CPU).',
        'Reservations are promises: space is held even if unused.',
      ],
      goal: 'Get the waiting ships berthed with reservations that match what they really use.',
    },
    evidence: [
      { kind: 'log', id: 'events', icon: '📜', label: 'HARBOR EVENTS', hint: 'Click lines.', lines: [{ text: 'ship-5: 0/3 berths available: 3 Insufficient cpu', note: 'No berth has 4000 units free, and none ever will: they only have 2000 each.', evidence: true }, { text: 'ship-5 requests cpu: 4000m', note: 'Each ship asks to reserve 4000m (4 whole CPUs).', evidence: true }] },
      {
        kind: 'chart', id: 'usage', icon: '📈', label: 'ACTUAL CPU USE', hint: 'What similar ships really use (millicores), busiest hour.',
        bars: [
          { label: 'ship-1', value: 280, note: 'Ship-1 peaks at 280m.' },
          { label: 'ship-2', value: 350, note: 'Ship-2 peaks at 350m, the highest.', evidence: true },
          { label: 'ship-3', value: 300, note: 'Ship-3 peaks at 300m.' },
        ],
        unit: 'm',
        limit: { value: 2000, label: 'ONE BERTH = 2000m' },
      },
    ],
    configTitle: 'resources.requests',
    fields: [{ kind: 'number', key: 'cpu', label: 'cpu', min: 50, max: 4000, unit: 'm (millicores)', step: 50 }],
    start: { cpu: 4000 },
    solution: { cpu: 500 },
    applyLabel: 'SCHEDULE SHIPS',
    verify: (x) => {
      const cpu = num(x.cpu);
      return {
        cases: [
          c(`a ${cpu}m ship fits in a 2000m berth`, cpu <= 2000),
          c('all 3 waiting ships get a berth', cpu <= 1000),
          c(`reservation covers the busiest real use (350m)`, cpu >= 350),
        ],
        hint: cpu < 350 ? 'Too small: ships would be squeezed onto berths and slow down at their busiest.' : 'How much do ships like these actually use at their busiest? Reserve that, plus a little room.',
        wasteful: cpu > 700 && cpu <= 1000 ? `${cpu}m is about double the real peak. That space sits idle.` : undefined,
      };
    },
    recap: {
      headline: 'Ships reserved 4 CPUs each but use about a third of one.',
      before: { lines: ['requests.cpu: 4000m', 'node capacity: 2000m', 'real peak: 350m'], outcome: 'Pending: Insufficient cpu' },
      after: (x) => ({ lines: [`requests.cpu: ${num(x.cpu)}m`, 'node capacity: 2000m', 'real peak: 350m'], outcome: 'all 3 scheduled ✓' }),
      why: 'The scheduler places pods by their requests, not their real usage. A request bigger than any node means Pending forever; an inflated request wastes capacity. Size requests from measured peak usage plus headroom.',
      real: `$ kubectl describe pod ship-5
  0/3 nodes are available: 3 Insufficient cpu.
resources:
  requests:
-   cpu: "4"
+   cpu: "500m"`,
      realCaption: 'Tools like VPA recommendations or Goldilocks suggest requests from real usage.',
    },
  },

  // ------------------------------------------------------------------ 5. Noisy Neighbor (terminal)
  {
    id: 'harbor-5',
    type: 'terminal',
    alert: 'EVERYTHING ON NODE-2 IS SLOW',
    board: { broken: ['node-2 CPU: 100%', 'bakery-app: slow'], fixed: ['batch-report: capped', 'bakery-app: fast ✓'] },
    intro: {
      symptom: 'The bakery website is slow, but only the copies running on node-2. Their own CPU use looks normal.',
      known: [
        'Several apps share node-2.',
        'A container with no limit can use every spare CPU on its node.',
        'bakery-app was deployed with a tiny CPU request (50m), so it\'s only guaranteed a sliver when the node is busy.',
        'You have kubectl access to the cluster.',
      ],
      goal: 'Find the noisy neighbour, cap it with a limit, apply, and check node-2 recovers.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'kubectl top pods: CPU per pod\nkubectl top nodes\nkubectl describe deploy <name>\ncat / edit batch-report.yaml\nkubectl apply -f batch-report.yaml\n\nLimits look like:\n  resources:\n    limits:\n      cpu: 500m' }],
    term: {
      host: 'kubectl',
      motd: 'Context: ninefold-prod · namespace: town',
      files: {
        'batch-report.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: batch-report
spec:
  template:
    spec:
      containers:
        - name: report
          image: batch-report:v1.0
          resources:
            requests:
              cpu: 200m`,
      },
      vars: { applied: '' },
      commands: [
        { match: /^kubectl top nodes$/, usage: 'kubectl top nodes', help: 'CPU per node', run: (_m, s) => ({ out: limitOf(String(s.vars.applied)) ? 'node-1  42%\nnode-2  55%\nnode-3  38%' : 'node-1  42%\nnode-2  100%  ⚠\nnode-3  38%' }) },
        {
          match: /^kubectl top pods$/, usage: 'kubectl top pods', help: 'CPU per pod', run: (_m, s) => {
            const lim = limitOf(String(s.vars.applied));
            return { out: `NAME                NODE    CPU\nbakery-app-7d9      node-2  180m  (throttled, slow)\nbakery-app-2k1      node-1  170m\nbatch-report-x1     node-2  ${lim ? `${lim}m` : '1920m ⚠ no limit'}\nmenu-svc-p0         node-2  90m`.replace('(throttled, slow)', lim ? '' : '(starved, slow)'), evidence: !lim, verify: true };
          },
        },
        { match: /^kubectl describe deploy batch-report$/, usage: 'kubectl describe deploy batch-report', help: 'details', run: () => ({ out: 'Requests: cpu 200m\nLimits:   <none>\nRuns: nightly report… started 3 days ago and never finished (loops over all orders)', evidence: true }) },
        {
          match: /^kubectl apply -f batch-report\.yaml$/, usage: 'kubectl apply -f batch-report.yaml', help: 'apply changes',
          run: (_m, s) => {
            s.vars.applied = s.files['batch-report.yaml'];
            const lim = limitOf(s.files['batch-report.yaml']);
            return { out: `deployment.apps/batch-report configured${lim ? ` (cpu limit ${lim}m)` : ' (no limit set)'}`, changed: true };
          },
        },
        { match: /^kubectl delete deploy batch-report$/, usage: 'kubectl delete deploy batch-report', help: 'delete it (careful!)', run: () => ({ out: 'deployment "batch-report" deleted\n⚠ finance: "where are tonight\'s sales reports?!"', changed: true, bad: true }) },
      ],
    },
    check: (s) => {
      const lim = limitOf(String(s.vars.applied));
      return {
        cases: [
          c('batch-report has a CPU limit', lim > 0),
          c('limit leaves room for neighbours (≤ 1000m)', lim > 0 && lim <= 1000),
          c('limit is at least its request (200m)', lim >= 200),
          c('change applied to the cluster', !!s.vars.applied),
        ],
        hint: 'Add resources.limits.cpu under the container\'s resources, then kubectl apply.',
      };
    },
    solve: (s) => {
      s.files['batch-report.yaml'] = s.files['batch-report.yaml'] + '\n            limits:\n              cpu: 500m';
      s.vars.applied = s.files['batch-report.yaml'];
    },
    recap: {
      headline: 'A runaway batch job with no limit ate the whole node.',
      before: { lines: ['batch-report: requests 200m, limits <none>', 'using 1920m on node-2'], outcome: 'bakery-app starved & slow' },
      after: (s) => ({ lines: [`batch-report: limits cpu ${limitOf(String(s.vars.applied))}m`, 'node-2: 55%'], outcome: 'bakery-app fast again ✓' }),
      why: 'Requests decide where pods go and guarantee each pod its share when the node is busy; limits cap how far a pod can burst above that. With no limit, batch-report soaked up all the spare CPU, and bakery-app had requested too little to be protected. Cap the burster, and give important apps honest requests. Cap it, don\'t delete it: the report is still needed, and the loop bug goes into the backlog.',
      real: `resources:
  requests:
    cpu: 200m
  limits:
    cpu: 500m
# Namespace-wide safety net: a LimitRange with default limits.`,
      realCaption: 'A LimitRange gives every container a default limit, so one missing line can\'t hurt a whole node.',
    },
  },

  // ------------------------------------------------------------------ 6. Rolling Tide (terminal)
  {
    id: 'harbor-6',
    type: 'terminal',
    alert: 'ROLLOUT STUCK AT 1 OF 3',
    board: { broken: ['rollout: 1/3 new', 'new pods: not ready'], fixed: ['rollout complete', '3/3 ready ✓'] },
    intro: {
      symptom: 'The bakery app is mid-update from v2 to v3. One new copy started, it never became ready, and the rollout has stalled for 20 minutes.',
      known: [
        'A rolling update replaces copies a few at a time, and only continues while new ones become ready.',
        'Old copies keep serving customers while it\'s stuck, so it\'s not an outage yet.',
        'v3 was reviewed and is wanted: a rollback is a last resort.',
      ],
      goal: 'Find out why v3 isn\'t ready, fix the deployment, apply it, and see the rollout finish.',
    },
    evidence: [{ kind: 'doc', id: 'tips', icon: '📘', label: 'HANDBOOK', text: 'kubectl rollout status deploy/bakery-app\nkubectl get pods\nkubectl logs bakery-app-v3-0\ncat / edit deploy.yaml\nkubectl apply -f deploy.yaml\nkubectl rollout undo deploy/bakery-app (last resort)' }],
    term: {
      host: 'kubectl',
      motd: 'Context: ninefold-prod · namespace: town',
      files: {
        'deploy.yaml': `kind: Deployment
metadata:
  name: bakery-app
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: app
          image: bakery-app:v3.0.0
          env:
            - name: MENU_URL
              value: http://menu-svc`,
        'config-notes.md': `v3 changes:
- orders now saved directly to the granary database
- needs DB_HOST (granary-db.town) set in the environment`,
      },
      vars: { applied: '', undone: false },
      commands: [
        { match: /^kubectl rollout status deploy\/bakery-app$/, usage: 'kubectl rollout status deploy/bakery-app', help: 'progress', run: (_m, s) => ({ out: dbHostSet(String(s.vars.applied)) ? 'deployment "bakery-app" successfully rolled out (3/3 v3)' : s.vars.undone ? 'rolled back: 3/3 v2' : 'Waiting for deployment "bakery-app" rollout to finish: 1 out of 3 new replicas have been updated...\n(stuck: the new replica never becomes ready)', verify: true }) },
        { match: /^kubectl get pods$/, usage: 'kubectl get pods', help: 'list pods', run: (_m, s) => ({ out: dbHostSet(String(s.vars.applied)) ? 'bakery-app-v3-0  1/1 Running\nbakery-app-v3-1  1/1 Running\nbakery-app-v3-2  1/1 Running' : 'bakery-app-v2-a  1/1 Running\nbakery-app-v2-b  1/1 Running\nbakery-app-v3-0  0/1 CrashLoopBackOff (restarts 9)' }) },
        { match: /^kubectl logs bakery-app-v3-0$/, usage: 'kubectl logs bakery-app-v3-0', help: 'new pod\'s logs', run: () => ({ out: 'starting bakery-app v3.0.0\nFATAL: environment variable DB_HOST is not set\nexit 1', evidence: true }) },
        { match: /^kubectl apply -f deploy\.yaml$/, usage: 'kubectl apply -f deploy.yaml', help: 'apply changes', run: (_m, s) => { s.vars.applied = s.files['deploy.yaml']; return { out: `deployment.apps/bakery-app configured${dbHostSet(s.files['deploy.yaml']) ? '' : '\n(new pods still failing)'}`, changed: true }; } },
        { match: /^kubectl rollout undo deploy\/bakery-app$/, usage: 'kubectl rollout undo deploy/bakery-app', help: 'go back to v2', run: (_m, s) => { s.vars.undone = true; return { out: 'rolled back to v2. Customers are fine, but v3 still isn\'t shipped.', changed: true }; } },
      ],
    },
    check: (s) => ({
      cases: [
        c('new v3 pods start (DB_HOST provided)', dbHostSet(String(s.vars.applied))),
        c('rollout completes: 3/3 on v3', dbHostSet(String(s.vars.applied))),
      ],
      hint: s.vars.undone ? 'Rolling back stopped the bleeding, but v3 is still not shipped. What does v3 need to start?' : 'Read the new pod\'s logs. Then add what it needs to the env list and apply.',
    }),
    solve: (s) => {
      s.files['deploy.yaml'] += '\n            - name: DB_HOST\n              value: granary-db.town';
      s.vars.applied = s.files['deploy.yaml'];
    },
    recap: {
      headline: 'v3 needed a setting that v2 didn\'t, so the new pods crashed and the rollout paused.',
      before: { lines: ['env: MENU_URL', '(no DB_HOST)'], outcome: 'v3 pods: FATAL DB_HOST not set' },
      after: () => ({ lines: ['env: MENU_URL', '     DB_HOST=granary-db.town'], outcome: 'rollout complete 3/3 ✓' }),
      why: 'Rolling updates protect you: they stop when new pods aren\'t ready, and old pods keep serving. The fix is usually in the new pod\'s logs. Rollback is the safe fallback, but fixing forward ships what you meant to ship.',
      real: `$ kubectl logs bakery-app-v3-0
FATAL: environment variable DB_HOST is not set
# deploy.yaml
          env:
+           - name: DB_HOST
+             value: granary-db.town`,
      realCaption: 'Settings that new versions need should ship in the same change as the code that needs them.',
    },
  },
];

function limitOf(yaml: string): number {
  const m = yaml.match(/limits:\s*\n\s*cpu:\s*["']?(\d+(?:\.\d+)?)(m?)["']?/);
  if (!m) return 0;
  return m[2] === 'm' ? Number(m[1]) : Number(m[1]) * 1000;
}

function dbHostSet(yaml: string): boolean {
  const q = squash(yaml);
  return /- name: db_host value: \S+/.test(q);
}
