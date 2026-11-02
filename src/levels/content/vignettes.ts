import type { Vignette } from '../../art/vignette';

/** One animated diagram per ticket, so every ticket's scene shows its own problem. */
export const VIGNETTES: Record<string, Vignette> = {
  // Post Office
  'post-2': { kind: 'meter', label: 'old maps trusted for', broken: 168, fixed: 1, max: 168, unit: 'h', limit: 6, lowIsGood: true },
  'post-3': { kind: 'flow', label: 'looking up bread.town', nodes: ['bread.town', 'bakery-old.town', '???'], breakAt: 1, fixedNodes: ['bread.town', 'bakery.town', '10.0.3.15'] },
  'post-4': { kind: 'flow', label: 'visitor → reading room', nodes: ['visitor', 'town gate', 'guard', 'room :8080'], breakAt: 2 },
  'post-5': { kind: 'tiles', label: 'load balancer pool', items: ['bakery-a ok', 'bakery-b ok', 'bakery-c DEAD'], bad: [2], fixedItems: ['bakery-a ok', 'bakery-b ok', 'c: removed'] },
  'post-6': { kind: 'flow', label: 'path to 10.0.9.5', nodes: ['r1', 'r2', '10.0.8.1 (gone)', 'east'], breakAt: 2, fixedNodes: ['r1', 'r2', 'r3 10.0.7.1', 'east'] },
  // Railyard
  'rail-1': { kind: 'flow', label: 'build train stations', nodes: ['fetch', 'build', 'test', 'ship'], breakAt: 1 },
  'rail-2': { kind: 'tiles', label: 'last 6 test runs', items: ['#1 pass', '#2 FAIL', '#3 pass', '#4 FAIL', '#5 pass', '#6 pass'], bad: [1, 3], fixedItems: ['#1 pass', '#2 pass', '#3 pass', '#4 pass', '#5 pass', '#6 pass'] },
  'rail-3': { kind: 'meter', label: 'pipeline duration', broken: 40, fixed: 15, max: 40, unit: 'min', limit: 15, lowIsGood: true },
  'rail-4': { kind: 'flow', label: 'what production runs', nodes: ['built v2.4.1', 'latest → v2.3.0', 'prod'], breakAt: 1, fixedNodes: ['built v2.4.1', 'pinned v2.4.1', 'prod v2.4.1'] },
  'rail-5': { kind: 'tiles', label: 'canary split', items: ['v2 90% 0.2% err', 'v3 10% 7.9% err'], bad: [1], fixedItems: ['v2 100% healthy', 'v3 aborted'] },
  'rail-6': { kind: 'flow', label: 'junction', nodes: ['customers', 'junction', 'green v2 (503)'], breakAt: 2, fixedNodes: ['customers', 'junction', 'green v2 ok'] },
  // Architect
  'arch-1': { kind: 'tiles', label: 'the plan', items: ['+ window', '+ window', '~ door', '- ROOF'], bad: [3], fixedItems: ['+ window', '+ window', '~ door', 'roof kept'] },
  'arch-2': { kind: 'tiles', label: 'reality vs blueprint', items: ['granary', 'shed ??', 'well'], bad: [1], fixedItems: ['granary', 'shed (managed)', 'well'] },
  'arch-3': { kind: 'tiles', label: 'the plan', items: ['~ tags', '~ description', '-/+ DATABASE'], bad: [2], fixedItems: ['~ tags', '~ description', 'db protected'] },
  'arch-4': { kind: 'flow', label: 'two applies at once', nodes: ['Ada', 'ledger', 'Ben'], breakAt: 1, fixedNodes: ['Ada', 'locked ledger', 'Ben waits'] },
  'arch-5': { kind: 'tiles', label: 'smoke alarms', items: ['library ok', 'bakery ok', 'school NONE'], bad: [2], fixedItems: ['library ok', 'bakery ok', 'school ok'] },
  'arch-6': { kind: 'tiles', label: 'vault password', items: ['in code', 'in git', 'old pw works'], bad: [0, 1, 2], fixedItems: ['var.vault', 'secret store', 'rotated'] },
  // Harbor
  'harbor-2': { kind: 'flow', label: 'crane fetching cargo', nodes: ['order', 'crane', 'v2.4.l ???'], breakAt: 2, fixedNodes: ['order', 'crane', 'v2.4.1'] },
  'harbor-3': { kind: 'flow', label: 'readiness check', nodes: ['harbor', ':8080 /healthz', 'ship :3000'], breakAt: 1, fixedNodes: ['harbor', ':3000 /health', 'ready'] },
  'harbor-4': { kind: 'meter', label: 'cpu reserved per ship', broken: 4000, fixed: 500, max: 4000, unit: 'm', limit: 2000, lowIsGood: true },
  'harbor-5': { kind: 'meter', label: 'node-2 cpu', broken: 100, fixed: 55, max: 100, unit: '%', limit: 80, lowIsGood: true },
  'harbor-6': { kind: 'tiles', label: 'rollout', items: ['v2 ok', 'v2 ok', 'v3 CRASH'], bad: [2], fixedItems: ['v3 ok', 'v3 ok', 'v3 ok'] },
  // Watchtower
  'watch-1': { kind: 'tiles', label: 'lamps lit', items: ['latency', 'traffic', 'errors', 'saturation'], bad: [0, 1, 2, 3] },
  'watch-2': { kind: 'meter', label: 'failed checkouts', broken: 2, fixed: 0, max: 3, unit: '%', limit: 0.5, lowIsGood: true },
  'watch-3': { kind: 'meter', label: 'menu page p95', broken: 2.4, fixed: 0.18, max: 2.5, unit: 's', limit: 1, lowIsGood: true },
  'watch-4': { kind: 'meter', label: 'pages last week', broken: 286, fixed: 3, max: 286, limit: 5, lowIsGood: true },
  'watch-5': { kind: 'flow', label: 'metrics pipeline', nodes: ['granary-svc', '/metrics', 'watchtower'], breakAt: 1 },
  'watch-6': { kind: 'tiles', label: 'dashboard panels', items: ['availability: --', 'p95 latency: --'], bad: [0, 1], fixedItems: ['availability 99.7%', 'p95 310ms'] },
  // Locksmith
  'lock-1': { kind: 'tiles', label: 'rosa\'s keyring', items: ['bakery', 'flour', 'ledger', 'vault', 'archive', 'library'], bad: [2, 3, 4, 5], fixedItems: ['bakery', 'flour', '-', '-', '-', '-'] },
  'lock-2': { kind: 'tiles', label: 'vault', items: ['old key OPENS', 'Bo', 'Gus'], bad: [0], fixedItems: ['old key ✗', 'Bo new key', 'Gus new key'] },
  'lock-3': { kind: 'meter', label: 'certificate days left', broken: 0, fixed: 90, max: 90, unit: 'd', limit: 14 },
  'lock-4': { kind: 'tiles', label: 'contractor access', items: ['ada\'s login', 'vault access', 'never expires'], bad: [0, 1, 2], fixedItems: ['own badge', 'blueprints only', 'expires 8h'] },
  'lock-5': { kind: 'tiles', label: 'svc-backup keys', items: ['AKIA7BKP 02:00', 'AKIA2LEAK 03:07'], bad: [1], fixedItems: ['AKIA7BKP ok', 'LEAK disabled'] },
  'lock-6': { kind: 'flow', label: 'kit → granary ledger', nodes: ['kit', 'DENY contractors', 'ledger'], breakAt: 1, fixedNodes: ['kit', 'allow read', 'ledger'] },
  // Granary
  'granary-1': { kind: 'meter', label: 'barn space used', broken: 100, fixed: 41, max: 100, unit: '%', limit: 90, lowIsGood: true },
  'granary-2': { kind: 'meter', label: 'time to find a sack', broken: 42, fixed: 0.02, max: 42, unit: 's', limit: 1, lowIsGood: true },
  'granary-3': { kind: 'flow', label: 'restore drill', nodes: ['ledger', 'backup', 'restore'], breakAt: 2 },
  'granary-4': { kind: 'meter', label: 'replica lag', broken: 192, fixed: 0, max: 192, unit: 'm', limit: 1, lowIsGood: true },
  'granary-5': { kind: 'meter', label: 'db connections wanted', broken: 800, fixed: 160, max: 800, limit: 190, lowIsGood: true },
  'granary-6': { kind: 'flow', label: 'orders → database', nodes: ['app', 'primary DOWN', 'replica'], breakAt: 1, fixedNodes: ['app', 'new primary', 'saved'] },
  // Town Hall
  'hall-1': { kind: 'tiles', label: 'bakery promise', items: ['SLI ?', 'SLO ?'], bad: [0, 1], fixedItems: ['orders < 2s', 'target 99.5%'] },
  'hall-2': { kind: 'tiles', label: 'error budget (216 min)', items: ['day1 -70', 'day2 -50', 'day3 -60', '36 left!'], bad: [3], fixedItems: ['day1 -70', 'day2 -50', 'day3 -60', 'freeze'] },
  'hall-3': { kind: 'meter', label: 'capacity req/s', broken: 1000, fixed: 2400, max: 2600, limit: 2000 },
  'hall-4': { kind: 'meter', label: 'monthly bill', broken: 12400, fixed: 6900, max: 12400, limit: 7440, lowIsGood: true },
  'hall-5': { kind: 'tiles', label: 'postmortem #212', items: ['timeline ?', 'factors ?', 'summary ?'], bad: [0, 1, 2], fixedItems: ['timeline', '3 factors', 'blameless'] },
  'hall-6': { kind: 'meter', label: 'cache memory at 2am', broken: 8, fixed: 2, max: 8, unit: 'GB', limit: 7, lowIsGood: true },
  // Big Incidents
  'big-1': { kind: 'meter', label: 'town-wide error rate', broken: 14, fixed: 0.2, max: 15, unit: '%', limit: 1, lowIsGood: true },
  'big-2': { kind: 'flow', label: 'festival request path', nodes: ['crowd 6x', 'app x30', 'db 300 max', 'retry storm'], breakAt: 2, fixedNodes: ['crowd 6x', 'app x14', 'db 280/300', 'backoff'] },
  'big-3': { kind: 'flow', label: 'outside → in', nodes: ['DNS', 'TLS', 'app', 'database'], breakAt: 0, fixedNodes: ['DNS ok', 'TLS ok', 'app ok', 'db ok'] },
};
