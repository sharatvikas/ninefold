/**
 * Real-world words, explained in one plain sentence each, for players new to the job.
 * Each ticket lists the ones its own text uses (the 📖 WORDS tool and the recap).
 */
export interface Word {
  term: string;
  plain: string;
  /** How the word shows up in text. Defaults to the term itself, whole word, any case. */
  match?: RegExp;
}

export const GLOSSARY: Word[] = [
  // networking
  { term: 'DNS', plain: "The internet's address book: it turns names like bakery.town into number addresses.", match: /\bDNS\b/ },
  { term: 'IP address', plain: "A computer's number address, like 10.0.3.12.", match: /\bIP\b|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
  { term: 'A record', plain: 'A DNS line that says "this name lives at this IP address".', match: /\bA record|\bIN\s+A\b|\bA →/ },
  { term: 'CNAME', plain: 'A DNS nickname: one name that points to another name.', match: /\bCNAME\b/ },
  { term: 'TTL', plain: 'Time to live: how long a copy (a DNS answer, a cached item) may be kept before it is refreshed.', match: /\bTTL\b|time-to-live/i },
  { term: 'NXDOMAIN', plain: 'DNS\'s answer for "no such name exists".', match: /NXDOMAIN/ },
  { term: 'port', plain: 'A numbered door on a server. Each app listens on its own port (websites use 443).', match: /\bports?\b/i },
  { term: 'firewall', plain: 'A guard list of which ports are open, and to whom. In the cloud: a security group.', match: /\bfirewall|security group/i },
  { term: 'address range (CIDR)', plain: '10.0.0.0/8 means every address starting 10.; /32 means exactly one address.', match: /\/(8|16|24|32)\b/ },
  { term: 'load balancer', plain: 'Shares visitors between several servers, and skips the broken ones.', match: /load balancer|\bLB\b/i },
  { term: 'health check', plain: 'A regular "are you OK?" request sent to an app, to decide if it gets visitors.', match: /health ?check|\/health\b/i },
  { term: '502 Bad Gateway', plain: 'The load balancer reached a server, but got a broken answer or none.', match: /\b502\b/ },
  { term: 'router', plain: 'A box that passes network traffic on towards where it is going.', match: /\brouters?\b/i },
  { term: 'routing table', plain: "A router's list of which road (next hop) each address range takes.", match: /routing table|\bip route\b|next hop/i },
  { term: 'traceroute', plain: 'Shows every hop a message passes through, so you see where it stops.' },
  { term: 'HTTPS', plain: 'The secure version of a web address: the connection is encrypted and checked with a certificate.', match: /https/i },
  { term: 'curl', plain: 'A command that fetches a web address, like a browser without the screen.' },
  { term: 'dig', plain: 'A command that asks DNS what a name points to.', match: /\bdig (\+short )?\S+\.town/i },
  { term: 'timeout', plain: 'How long something waits for an answer before giving up.', match: /time(d)? ?out/i },
  // building and shipping
  { term: 'build', plain: 'Turning source code into something that can run.', match: /\bbuild(s|ing)?\b/i },
  { term: 'CI pipeline', plain: 'Automatic build-and-test steps that run on every code change.', match: /\bCI\b|pipeline/i },
  { term: 'dependency', plain: 'A ready-made package your code uses, listed in a file like package.json.', match: /dependenc|package\.json/i },
  { term: 'lockfile', plain: 'Records exact dependency versions, so every build installs the same thing.', match: /package-lock|npm ci\b|lockfile(?! ?=)/i },
  { term: 'flaky test', plain: 'A test that sometimes passes and sometimes fails, with no code change.', match: /flak/i },
  { term: 'shard', plain: 'One slice of a big job, run at the same time as the other slices.', match: /\bshard/i },
  { term: 'container image', plain: 'An app packed with everything it needs to run, stored in a registry.', match: /\bimages?\b|container/i },
  { term: 'registry', plain: 'A warehouse for container images (Docker Hub, ECR).', match: /registry/i },
  { term: 'tag', plain: 'A label. On images: a version name like v2.4.1 or latest. On cloud resources: owner or environment.', match: /\btags?\b|:latest\b/i },
  { term: 'digest', plain: "An image's fingerprint (sha256:…). Unlike a tag, it can never point at different contents.", match: /digest|sha256/i },
  { term: 'deploy', plain: 'Put a new version where customers use it.', match: /\bdeploy/i },
  { term: 'canary', plain: 'Release to a small share of users first, to catch problems early.', match: /canary/i },
  { term: 'blue-green', plain: 'Two copies of the app: switch all traffic from the live one to the new one at once.', match: /blue-green|blue and green|\bgreen (environment|copy|track)|env green|--to green/i },
  { term: 'rollback', plain: 'Going back to the previous working version.', match: /roll ?back|rollout undo/i },
  { term: 'database migration', plain: "A change to the database's layout that a new version of the app needs.", match: /database migration|migrations? (pending|up)|migrate (up|--env)/i },
  // Kubernetes
  { term: 'Kubernetes', plain: 'A system that runs, restarts and spreads app containers across many machines.', match: /kubernetes|kubectl|\bk8s\b/i },
  { term: 'pod', plain: 'One running copy of an app in Kubernetes.', match: /\bpods?\b/i },
  { term: 'node', plain: 'One machine in a Kubernetes cluster. Pods run on nodes.', match: /\bnodes?\b(?![-.]?js|-version)|node-\d/i },
  { term: 'kubectl', plain: 'The command-line tool for talking to Kubernetes.' },
  { term: 'deployment', plain: "Kubernetes' description of an app: which image, how many copies, which settings.", match: /deployment|deploy\//i },
  { term: 'rolling update', plain: 'Replacing app copies a few at a time, so the app stays up throughout.', match: /rolling|rollout/i },
  { term: 'readiness probe', plain: 'Kubernetes asks "ready for customers?". Pods that fail it get no traffic.', match: /readiness/i },
  { term: 'CPU request', plain: 'CPU a pod reserves. Kubernetes uses it to choose a node with room.', match: /requests?\.cpu|cpu request|requests:/i },
  { term: 'CPU limit', plain: 'The most CPU a pod is allowed to use.', match: /limits?\b.*cpu|cpu limit|--limits/i },
  { term: 'millicore (m)', plain: 'A thousandth of a CPU: 500m is half a CPU, 2000m is two.', match: /millicore|cpu:? ?"?\d+m\b|\b\d{3,4}m\b/i },
  { term: 'OOMKilled', plain: 'Stopped for running out of memory: it used more than its memory limit.', match: /\bOOM/ },
  { term: 'CrashLoopBackOff', plain: 'A pod keeps crashing, and Kubernetes waits longer before each restart.', match: /CrashLoop|relaunch/i },
  { term: 'ImagePullBackOff', plain: "Kubernetes can't download the image (often a typo in the tag) and retries more and more slowly.", match: /ImagePull|ErrImagePull|back-?off pulling/i },
  { term: 'Pending', plain: 'A pod waiting for a node with enough free room.', match: /\bPending\b|Insufficient cpu/ },
  { term: 'environment variable', plain: 'A named setting given to an app when it starts, like DB_HOST.', match: /environment variable|DB_HOST|set env/i },
  // infrastructure as code
  { term: 'Terraform', plain: 'A tool that builds cloud resources from code files, and keeps them matching the code.', match: /terraform|\.tf\b/i },
  { term: 'plan', plain: "Terraform's preview of what it would add (+), change (~) or destroy (-).", match: /terraform plan|plan output|the plan (lists|is printed|says)/i },
  { term: 'apply', plain: 'Make the real system match your saved changes (terraform apply, kubectl apply).', match: /\bappl(y|ied|ies)\b/i },
  { term: 'state', plain: "Terraform's record of what it has already built.", match: /\bstate (ledger|file|lock)|tfstate/i },
  { term: 'state lock', plain: 'Stops two people changing the same infrastructure at the same moment.', match: /state lock|lockfile = true|use_lockfile/i },
  { term: 'module', plain: 'A reusable building block of infrastructure code.', match: /\bmodules?\b/i },
  { term: 'drift', plain: 'When the real setup no longer matches the code.', match: /drift|hand-built|built by hand|made by hand/i },
  { term: 'import', plain: 'Telling Terraform to take charge of something that was built by hand.', match: /terraform import|\bimport \{/i },
  // security
  { term: 'secret', plain: 'A password, key or token. It must never be written into code.', match: /\bsecrets?\b|password/i },
  { term: 'git history', plain: "Every past version of the code. Deleting a line today doesn't remove it from history.", match: /git (log|history)|history of the file/i },
  { term: 'rotate', plain: 'Replace a password or key with a new one, and switch the old one off.', match: /(secret|key|password).{0,40}rotat|rotat(e|ion|ed)\b.{0,30}(secret|key|password)|secrets rotate/i },
  { term: 'least privilege', plain: 'Give people and programs only the access they really need.', match: /least privilege|exactly the (keys|access)/i },
  { term: 'IAM', plain: 'Identity and access management: who is allowed to do what.', match: /\bIAM\b|\biam\b/ },
  { term: 'IAM group', plain: 'A set of users who share the same permissions.', match: /\bgroups?\b/i },
  { term: 'policy', plain: 'A written rule that allows or denies actions.', match: /(?<![-\w])polic(y|ies)\b/i },
  { term: 'explicit deny', plain: 'A rule that says no. It beats any rule that says yes.', match: /deny|denied/i },
  { term: 'access key', plain: 'A password for programs, with an ID like AKIA….', match: /access key|AKIA/i },
  { term: 'audit log', plain: 'The record of who did what, and when.', match: /\baudit\b|cloudtrail/i },
  { term: 'TLS certificate', plain: 'The padlock in the browser: it proves a site is real and encrypts the connection.', match: /\bTLS\b|certificate|\bcert\b|\bseal\b/i },
  { term: 'certificate authority', plain: 'An organisation that signs certificates, so browsers can trust them.', match: /certificate authority|\bCA\b|issuer/ },
  { term: 'temporary credentials', plain: 'Access that expires on its own, for example after 8 hours.', match: /temporary (badge|access|credential)|assume-role|short-lived (credential|access|token|key)/i },
  // observability
  { term: 'metrics', plain: 'Numbers a service reports over time, like requests per second.', match: /metric/i },
  { term: 'logs', plain: 'Lines of text a service writes as it works.', match: /\blogs\b|logcli|\blogging\b|log search/i },
  { term: 'trace', plain: 'The journey of one request through every service, with how long each step took.', match: /\btraces?\b|\bspan\b/i },
  { term: 'golden signals', plain: 'Latency, traffic, errors and saturation: four numbers that show if a service is healthy.', match: /golden signal/i },
  { term: 'latency', plain: 'How long a request takes.', match: /latency/i },
  { term: 'saturation', plain: 'How full something is: CPU, memory, a queue or a disk.', match: /saturation/i },
  { term: 'p95', plain: '95% of requests are faster than this. It describes the slowest 5%.', match: /\bp95\b|0\.95/i },
  { term: 'alert / page', plain: 'An automatic warning. A page wakes someone up; a ticket waits for the morning.', match: /\balerts?\b|\bpag(ed|ing)\b|severity: page|pages? (someone|you|on-call)|PAGES BY/i },
  { term: 'PromQL', plain: 'The language for asking Prometheus (a metrics database) questions.', match: /promql|prometheus/i },
  { term: 'dashboard', plain: 'A screen of charts showing how things are going.', match: /dashboard/i },
  { term: 'instrument', plain: 'Add code that counts and times what a service does, so it can be watched.', match: /instrument/i },
  // reliability
  { term: 'SLI', plain: 'A measurement of what customers experience, like "share of orders under 2 seconds".', match: /\bSLI\b/ },
  { term: 'SLO', plain: 'The target for an SLI, like "99.5% of minutes good".', match: /\bSLOs?\b/ },
  { term: 'error budget', plain: 'How much bad service the SLO allows, for example 216 minutes a month.', match: /error[ -]budget/i },
  { term: 'burn rate', plain: 'How fast the error budget is being used up. 1× is exactly on budget.', match: /burn/i },
  { term: 'autoscaler', plain: 'Adds or removes servers automatically as the load changes.', match: /autoscal|HorizontalPodAutoscaler/i },
  { term: 'capacity planning', plain: 'Working out how many servers you need for the expected load, plus room to spare.', match: /capacity plan|peak ÷|servers needed/i },
  { term: 'toil', plain: 'Repetitive manual work that a machine could do.', match: /\btoil\b/i },
  { term: 'postmortem', plain: 'A write-up after an incident: what happened, why, and what will change.', match: /postmortem/i },
  { term: 'blameless', plain: 'Looking at systems and processes, not blaming people.', match: /blame/i },
  { term: 'incident', plain: 'Something broken that is hurting users and needs a response now.', match: /incident/i },
  { term: 'on-call', plain: 'Being the person who responds when something breaks.', match: /on-call/i },
  { term: 'cost tags', plain: 'Labels on cloud resources (owner, environment) so you can see who pays for what.', match: /cloud bill|\bbill\b|cost (allocation|tag)|tag everything/i },
  // data
  { term: 'database', plain: 'Where an app stores its data.', match: /database|\bdb\b/i },
  { term: 'index', plain: 'A lookup table that lets a database find rows without reading them all.', match: /\bindex/i },
  { term: 'full table scan', plain: 'Reading every row to answer a question: slow on big tables. An index avoids it.', match: /seq scan|full (table )?scan|entire barn|walks? the (entire|whole) barn/i },
  { term: 'query', plain: 'A question you ask a database or a metrics system.', match: /\bquer(y|ies)\b/i },
  { term: 'backup', plain: 'A copy of data kept so it can be rebuilt if lost.', match: /backup/i },
  { term: 'restore', plain: 'Rebuilding data from a backup. Untested backups often fail to restore.', match: /\brestor(e|ing)\b(?!-)|pg_restore/i },
  { term: 'replica', plain: 'A copy: of a database that follows the main one, or of an app (Kubernetes runs several replicas).', match: /replica/i },
  { term: 'primary', plain: 'The main database: the one that accepts writes.', match: /primary/i },
  { term: 'replication lag', plain: 'How far behind the replica is.', match: /replication lag|\blag\b|\d+ hours? behind/i },
  { term: 'failover', plain: 'Switching to the replica when the primary dies.', match: /fail ?over|promote (the )?replica|db promote|pg_ctl promote/i },
  { term: 'split brain', plain: 'Two databases both accepting writes, so their data drifts apart.', match: /split brain/i },
  { term: 'fence', plain: 'Lock the old primary so it can never accept writes again.', match: /\bfenc/i },
  { term: 'connection pool', plain: 'A set of database connections an app keeps open and reuses.', match: /connection pool|pool size|pool\.max|pool:\s*\n\s*(min|max)|too many clients|max_connections/i },
  { term: 'log rotation', plain: 'Starting new log files regularly and deleting the oldest.', match: /logrotate|log rotation/i },
  { term: 'disk', plain: 'Where a server stores files. When it is full, nothing new can be saved.', match: /\bdisk|\bvolume|du -sh/i },
  { term: 'cache', plain: 'A fast store that keeps copies of things to avoid redoing slow work.', match: /\bcach/i },
  { term: 'eviction (LRU)', plain: 'A full cache drops old items to make room. LRU drops what was used longest ago.', match: /evict|\blru\b|lfu/i },
  { term: 'retry with backoff', plain: 'Trying again, waiting longer each time, so a struggling system gets room to recover.', match: /retr(y|ies)|backoff/i },
  { term: 'jitter', plain: 'A random extra wait, so clients don\'t all retry at the same instant.', match: /jitter/i },
  { term: 'rate limit', plain: 'A cap on how many requests a client can make per second.', match: /rate limit|limit-rps/i },
  { term: 'load shedding', plain: 'Refusing extra work quickly when overloaded, instead of falling over.', match: /shedding|shed load|load shed/i },
  { term: 'cascading failure', plain: 'One overloaded part makes the next one fail, and so on.', match: /cascad|meltdown/i },
];

/** The glossary words a piece of text uses, in glossary order. */
export function wordsIn(text: string): Word[] {
  return GLOSSARY.filter((w) => (w.match ?? new RegExp(`\\b${w.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')).test(text));
}

/** Every piece of text inside a value (strings in objects and arrays), without field names or code. */
export function textOf(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(textOf).join(' ');
  if (v && typeof v === 'object' && !(v instanceof RegExp)) return Object.values(v).map(textOf).join(' ');
  return '';
}
