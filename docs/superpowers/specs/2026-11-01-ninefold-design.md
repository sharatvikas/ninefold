# Ninefold: design

*Status: living document. Started 2026-11-01. Things here are expected to change.*

## Intent

Ninefold is a cozy, pixel-art, light open-world web game that teaches the work of DevOps, SRE, and cloud engineering: networking, CI/CD, infrastructure as code, containers, observability, security, storage, and reliability practice (SLOs, capacity, cost, incidents).

The town *is* a running system. Each district is one area of the job, the people in it own services, and problems show up as things you can see in the world (sinking ships, misdelivered letters, derailed trains). You fix them with tools you unlock.

The name comes from "the nines" of uptime.

## Goals

- Teach real concepts through play: metaphor first, real tools later.
- Light open world: walk around a small town, talk to people, pick up tickets. No combat, no grinding.
- Short levels (2–5 minutes) with many per topic.
- Reward diagnosing before acting: investigating first earns more Trust than a lucky guess.
- Runs entirely in the browser with free static hosting.

## Non-goals (for now)

- Creature collecting or turn-based battles (tried in mockup v3, rejected).
- Real cloud sandboxes (actually creating cloud resources). Maybe much later.
- Accounts, leaderboards, multiplayer.

## Anti-goals

- Heavy or cluttered: big inventories, long cutscenes, a busy HUD.
- Quiz-in-a-costume: multiple-choice questions with a sprite stuck on top.
- Stick-figure or flat-vector art. The target is a cozy 16-bit look (Stardew Valley or GBA-era Pokémon towns), without copying any game's assets or maps.

## Look and feel (from mockup v4)

- Cozy 16-bit pixel art with warm palettes and soft outlines, scaled up crisp (pixel-perfect).
- Animated by default: walk cycles, water shimmer, smoke, swaying trees, a train on the CI/CD line, typewriter dialogue.
- UI uses a wooden-frame and parchment style: dialogue box, Trust meter, day clock, and a tool belt (hotbar) during incidents.
- v0.x uses procedurally drawn placeholder pixel art. Swapping in a licensed tileset (for example from itch.io) is a later task.

## Progression: three acts

| Act | Feel | Example (DNS) |
|---|---|---|
| 1 · Metaphor | Pure world logic, no jargon | Drag the bakery's sign to the right house |
| 2 · Bridge | Same scene, real labels shown | `bakery.town A 10.0.3.7`, TTL 300s |
| 3 · Real tools | A simulated in-game terminal running real commands against real file formats | `dig`, edit the zone file |

The terminal is simulated in the browser. Nothing touches a real cloud.

## Districts and levels

There are 8 districts with 6 levels each: levels 1–2 are Act 1, 3–4 are Act 2, and 5–6 are Act 3. On top of those come 3 cross-district "Big Incidents", one at the end of each act, for 51 levels total.

### Post Office: networking and DNS
1. **Wrong Address**: a name points to the wrong house (DNS A record).
2. **Old Maps**: you fixed it, but people still go the wrong way (caching, TTL).
3. **Nicknames**: a broken alias chain (CNAME).
4. **Closed Gate**: a port is blocked (firewall / security group).
5. **Traffic Jam**: the load balancer keeps sending people to a closed shop (health checks).
6. **Lost Letters**: follow the hops to find the drop (routing, `traceroute`).

### Railyard: CI/CD
1. **Derailed**: the build fails; read the stage log (missing dependency).
2. **Flaky Signal**: a test fails only sometimes; retry, quarantine, or fix it.
3. **Slow Line**: the pipeline takes forever (caching, parallel stages).
4. **Wrong Cargo**: the wrong build shipped (artifact versioning, immutable tags).
5. **Canary**: a small first release catches a bad deploy; roll it back.
6. **Blue-Green Junction**: switch tracks with zero downtime.

### Architect's Office: infrastructure as code
1. **Blueprint Basics**: read a plan before you apply it.
2. **The Hand-Built Shed**: someone changed things by hand (drift).
3. **The Destroy Line**: the plan quietly replaces a database; catch it.
4. **Shared Ledger**: two architects edit at once (state locking).
5. **Reusable Plans**: stop copy-pasting (modules).
6. **Secrets on the Blueprint**: a password committed to code.

### Harbor: containers and Kubernetes
1. **Sinking Ships**: crash loop from running out of memory (OOMKilled). *Built in mockup v4.*
2. **Wrong Label**: the image can't be pulled because of a tag typo (ImagePullBackOff).
3. **Never Ready**: the ship is fine but never gets passengers (readiness probe).
4. **No Berth**: ships wait forever for a spot (Pending, not enough resources).
5. **Noisy Neighbor**: one ship hogs the crane (CPU limits, throttling).
6. **Rolling Tide**: a rolling update gets stuck (rollout strategy).

### Watchtower: observability
1. **Lamps On**: choose what to watch (the golden signals).
2. **Needle in the Haystack**: search and filter logs (structured logging).
3. **Following the Courier**: a trace shows the slow hop (distributed tracing).
4. **Crying Wolf**: too many alerts (alert on symptoms, tune thresholds).
5. **The Dark Corner**: something has no instrumentation; add a metric.
6. **Dashboard Day**: build a dashboard that answers a real question.

### Locksmith: identity and security
1. **Master Key**: someone has far too much access (least privilege).
2. **Key Under the Mat**: a leaked secret (rotation).
3. **Expired Seal**: a certificate expired (TLS).
4. **Borrowed Badge**: temporary credentials and role assumption.
5. **Who Opened the Door?**: audit logs.
6. **Locked Out**: an explicit deny wins (policy evaluation).

### Granary: storage and databases
1. **Full Barn**: the disk is full (log rotation, cleanup).
2. **Lost Index**: finding anything takes forever (query index).
3. **The Untested Backup**: a restore drill fails (test your backups).
4. **Echo Delay**: the copy lags behind the original (replication lag).
5. **Too Many Carts**: the connection pool is exhausted.
6. **Failover Night**: promote the replica.

### Town Hall: SLOs, capacity, cost, and practice
1. **Promises**: define what "working" means for the bakery (SLI / SLO).
2. **Budget Burn**: the error budget is burning fast; what now?
3. **Festival Day**: the traffic spike is coming (capacity, autoscaling).
4. **The Treasury**: the bill is huge (idle resources, rightsizing).
5. **The Postmortem**: order the timeline and find the contributing factors, blamelessly.
6. **The Rota**: cut toil and automate the runbook.

### Big Incidents (end of each act)
- **Act 1, The Quiet Morning**: a bad deploy (Railyard) shows up as errors in the Watchtower.
- **Act 2, Festival Meltdown**: a traffic spike leads to exhausted connections, then a cascading failure.
- **Act 3, The Long Night**: a DNS change, an expired certificate, and a failover, all at once, at the terminal.

## How a level plays (hands-on, not multiple choice)

*Changed 2026-11-01 after playtesting v0.1: clicking the "right tool" felt like a quiz. Every level now follows the same four steps, shown as a tracker at the top of the screen.*

1. **Understand**: a ticket card says what people are seeing, what you know, and the goal.
2. **Find the cause**: tools show evidence you have to read and interpret. Click the log line that explains it, read the chart, knock on doors, run a lookup. Nothing tells you the answer.
3. **Change**: edit the actual setting with your own values (a manifest field, a line on the sorting wall). There's no "fix" button. Red herrings exist (crew size, "give up after sinking").
4. **Verify**: your change runs in the live simulation (the next voyages, a test letter). A wrong value visibly fails, and you adjust and try again.

At the end, a **before/after card** shows the old and new state side by side, explains why the change worked, and gives the same fix with real tools (`kubectl`, `dig`, YAML, zone files).

**Trust scoring** (`src/levels/sims/score.ts`): start at 6; −1 for changing things before finding evidence; −1 per change that didn't fix it; −1 for a fix far bigger than needed; never below 1.

Each level is a scene (`IncidentScene` subclass) plus pure, unit-tested rules in `src/levels/sims/`. Common shapes we expect to reuse: logs and charts to read, a config to edit, a live simulation to verify against, and a terminal for Act 3.

## Core systems

- **Trust** (0–100): the player's reputation and error budget. Correct fixes raise it; wrong actions and slow responses lower it.
- **Tickets**: NPCs with available levels show a "!" above their heads. A quest log lists districts and levels as done, available, or locked.
- **Unlocks**: finishing levels opens new districts and tools.
- **Saves** live in the browser (localStorage).

## Tech (my call; open to change)

- TypeScript + Vite, using plain Canvas 2D (no game engine) so the mockups' procedural pixel art ports directly. Vitest covers the pure game logic: level kits, map, saves and Trust. A small DOM overlay handles the UI so text stays crisp. Phaser was considered; it's worth revisiting if we need tilemap editors or physics.
- Pixel-perfect rendering at 384×216, scaled up by whole-number multiples.
- Static hosting on GitHub Pages via GitHub Actions. Cloudflare Pages is a fine alternative.

## First slice (v0.1)

1. A walkable town with collisions, a following camera, NPCs, a dialogue box, and the HUD.
2. A data-driven level registry with all 51 levels listed. Unbuilt ones show "coming soon".
3. Two playable levels: **Harbor 1, Sinking Ships** and **Post Office 1, Wrong Address**, both hands-on (see above).
4. Trust and progress saved in the browser.
5. A Pages deploy workflow. Creating the GitHub repo waits for the user's go-ahead.

## Left to the builder

Exact map layout, dialogue wording, palette tweaks, and the internals of each kit.
