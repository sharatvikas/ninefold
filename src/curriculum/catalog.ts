export type DistrictId = 'post' | 'rail' | 'arch' | 'harbor' | 'watch' | 'lock' | 'granary' | 'hall' | 'big';
export type Kit = 'investigate' | 'sort' | 'build' | 'review' | 'terminal';
export type Act = 1 | 2 | 3;

export interface District {
  id: DistrictId;
  name: string;
  topic: string;
  /** Who hands out the tickets here. */
  keeper: string;
}

export interface LevelMeta {
  id: string;
  district: DistrictId;
  num: number;
  act: Act;
  title: string;
  concept: string;
  /** One line the district's NPC says when this ticket is up next. */
  ticket: string;
  kit: Kit;
  built: boolean;
}

export const DISTRICTS: District[] = [
  { id: 'post', name: 'Post Office', topic: 'Networking & DNS', keeper: 'Rosa' },
  { id: 'rail', name: 'Railyard', topic: 'CI/CD', keeper: 'Ines' },
  { id: 'arch', name: "Architect's Office", topic: 'Infrastructure as code', keeper: 'Ada' },
  { id: 'harbor', name: 'Harbor', topic: 'Containers & Kubernetes', keeper: 'Finn' },
  { id: 'watch', name: 'Watchtower', topic: 'Observability', keeper: 'Lin' },
  { id: 'lock', name: 'Locksmith', topic: 'Identity & security', keeper: 'Kit' },
  { id: 'granary', name: 'Granary', topic: 'Storage & databases', keeper: 'Gus' },
  { id: 'hall', name: 'Town Hall', topic: 'SLOs, capacity & cost', keeper: 'Mayor Bo' },
  { id: 'big', name: 'Bell Tower', topic: 'Big incidents: everything at once', keeper: 'Chief Juno' },
];

type Row = [title: string, concept: string, ticket: string, kit: Kit, built?: boolean];

const ROWS: Record<Exclude<DistrictId, 'big'>, Row[]> = {
  post: [
    ['Wrong Address', 'DNS A record', 'Customers looking for the bakery keep ending up at the butcher\'s!', 'sort', true],
    ['Old Maps', 'Caching & TTL', 'We fixed the sign, but folks are still going the wrong way…', 'sort'],
    ['Nicknames', 'CNAME aliases', 'Nobody can find "bread.town" any more. It used to go to the bakery.', 'sort'],
    ['Closed Gate', 'Firewalls & security groups', 'The library\'s side gate is locked and nobody knows why.', 'investigate'],
    ['Traffic Jam', 'Load balancers & health checks', 'Half the visitors get sent to a shop that\'s closed.', 'terminal'],
    ['Lost Letters', 'Routing & traceroute', 'Letters to the east side vanish somewhere along the way.', 'terminal'],
  ],
  rail: [
    ['Derailed', 'Reading build logs', 'The morning build train came off the rails at the test stage!', 'investigate'],
    ['Flaky Signal', 'Flaky tests', 'The signal goes red sometimes, then green again. Drives me mad.', 'investigate'],
    ['Slow Line', 'Pipeline caching & parallelism', 'The pipeline takes forty minutes. Can we speed it up?', 'build'],
    ['Wrong Cargo', 'Artifact versioning', 'We delivered last week\'s cargo to production. Again.', 'investigate'],
    ['Canary', 'Canary releases & rollback', 'Send one carriage ahead before the whole train?', 'terminal'],
    ['Blue-Green Junction', 'Zero-downtime deploys', 'Switch tracks without stopping a single passenger.', 'terminal'],
  ],
  arch: [
    ['Blueprint Basics', 'Plan before apply', 'Always read the plan before you build. Want to learn how?', 'review'],
    ['The Hand-Built Shed', 'Configuration drift', 'Someone built a shed that isn\'t on any blueprint.', 'review'],
    ['The Destroy Line', 'Forced replacement', 'This harmless-looking change wants to knock down the granary.', 'review'],
    ['Shared Ledger', 'State locking', 'Two architects edited the ledger at once. Now it\'s a mess.', 'investigate'],
    ['Reusable Plans', 'Modules', 'I\'ve copied this house blueprint twelve times. There must be a better way.', 'terminal'],
    ['Secrets on the Blueprint', 'Secrets in code', 'Someone wrote the vault password on a blueprint…', 'terminal'],
  ],
  harbor: [
    ['Sinking Ships', 'CrashLoopBackOff / OOMKilled', 'Our ships keep sinking right after launch. The harbor just relaunches them!', 'investigate', true],
    ['Wrong Label', 'ImagePullBackOff', 'The crane can\'t find the cargo it was told to load.', 'investigate'],
    ['Never Ready', 'Readiness probes', 'The ship is fine, but no passengers ever board.', 'investigate'],
    ['No Berth', 'Pending pods & scheduling', 'Ships are waiting at sea. Every berth is "full".', 'investigate'],
    ['Noisy Neighbor', 'CPU limits & throttling', 'One ship is hogging the crane and everyone else crawls.', 'terminal'],
    ['Rolling Tide', 'Rollout strategy', 'We\'re swapping the fleet, and it got stuck halfway.', 'terminal'],
  ],
  watch: [
    ['Lamps On', 'Golden signals', 'Which lamps should we light to know the town is healthy?', 'sort'],
    ['Needle in the Haystack', 'Searching logs', 'Somewhere in a million lines is the one error that matters.', 'investigate'],
    ['Following the Courier', 'Distributed tracing', 'Deliveries are slow. Which stop is holding them up?', 'investigate'],
    ['Crying Wolf', 'Alert fatigue', 'The bell rings forty times a night. Nobody listens any more.', 'review'],
    ['The Dark Corner', 'Instrumentation', 'We can\'t see anything happening at the granary.', 'build'],
    ['Dashboard Day', 'Dashboards', 'The mayor wants one screen that says if we\'re OK.', 'build'],
  ],
  lock: [
    ['Master Key', 'Least privilege', 'The baker has a key to every door in town. Is that… fine?', 'sort'],
    ['Key Under the Mat', 'Secret rotation', 'Someone found the vault key under a doormat.', 'investigate'],
    ['Expired Seal', 'TLS certificates', 'Visitors get a scary warning at the library door.', 'investigate'],
    ['Borrowed Badge', 'Temporary credentials', 'Contractors need access, but only for today.', 'review'],
    ['Who Opened the Door?', 'Audit logs', 'The vault was opened at 3am. By whom?', 'terminal'],
    ['Locked Out', 'Explicit deny', 'I have permission, but I still can\'t get in!', 'terminal'],
  ],
  granary: [
    ['Full Barn', 'Disk full', 'The barn is full to the rafters and nothing new fits.', 'investigate'],
    ['Lost Index', 'Database indexes', 'Finding a single sack takes all afternoon.', 'investigate'],
    ['The Untested Backup', 'Restore drills', 'We have backups. We\'ve never tried restoring one.', 'build'],
    ['Echo Delay', 'Replication lag', 'The copy of the ledger is hours behind the original.', 'investigate'],
    ['Too Many Carts', 'Connection pools', 'Carts are queued all the way down the road.', 'terminal'],
    ['Failover Night', 'Replica promotion', 'The main barn is on fire. Promote the spare!', 'terminal'],
  ],
  hall: [
    ['Promises', 'SLIs & SLOs', 'What does "the bakery is working" actually mean?', 'build'],
    ['Budget Burn', 'Error budgets', 'We\'ve used a month of mistakes in three days.', 'review'],
    ['Festival Day', 'Capacity & autoscaling', 'The harvest festival is next week. Will we cope?', 'build'],
    ['The Treasury', 'Cost & rightsizing', 'The town bill doubled and nobody knows why.', 'investigate'],
    ['The Postmortem', 'Blameless postmortems', 'Let\'s write down what happened, without blame.', 'sort'],
    ['The Rota', 'Toil & automation', 'Every night someone restarts the same thing by hand.', 'terminal'],
  ],
};

const actFor = (num: number): Act => (num <= 2 ? 1 : num <= 4 ? 2 : 3);

export const LEVELS: LevelMeta[] = [
  ...(Object.keys(ROWS) as Exclude<DistrictId, 'big'>[]).flatMap((d) =>
    ROWS[d].map(([title, concept, ticket, kit, built], i): LevelMeta => ({
      id: `${d}-${i + 1}`,
      district: d,
      num: i + 1,
      act: actFor(i + 1),
      title,
      concept,
      ticket,
      kit,
      built: built ?? true,
    })),
  ),
  { id: 'big-1', district: 'big', num: 1, act: 1, title: 'The Quiet Morning', concept: 'Cross-district incident', ticket: 'Everything was fine until it wasn\'t.', kit: 'investigate', built: true },
  { id: 'big-2', district: 'big', num: 2, act: 2, title: 'Festival Meltdown', concept: 'Cascading failure', ticket: 'The festival crowd broke three districts at once.', kit: 'investigate', built: true },
  { id: 'big-3', district: 'big', num: 3, act: 3, title: 'The Long Night', concept: 'Multi-system outage at the terminal', ticket: 'DNS, certificates and a failover, all before dawn.', kit: 'terminal', built: true },
];

export function getLevel(id: string): LevelMeta {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown level ${id}`);
  return l;
}

export function levelsIn(d: DistrictId): LevelMeta[] {
  return LEVELS.filter((l) => l.district === d).sort((a, b) => a.num - b.num);
}
