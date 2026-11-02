# Ninefold

A cozy pixel-art town where you learn DevOps, SRE and cloud engineering by fixing things. Ships sink because they run out of memory, letters go to the wrong house because a DNS record is wrong, and you investigate with tools before you fix.

Named after "the nines" of uptime.

## Play locally

```sh
npm install
npm run dev     # http://localhost:5173
```

Controls: arrows/WASD to walk, **E** to talk, **Q** for the ticket list, **1–6** for tools inside an incident. Touch screens get an on-screen pad.

## What's in the game

- A walkable town with 8 districts, each teaching one area of the job, plus a dispatcher (Chief Juno) for town-wide incidents
- **51 playable tickets**: 6 per district, in three acts (metaphor → real labels → real terminal), plus 3 Big Incidents that unlock when every ticket in an act is closed
- Every ticket is hands-on: understand the problem → find the cause in the evidence (logs, charts, traces, search, records) → change the real setting yourself (forms in Acts 1–2, files and commands in a simulated terminal in Act 3) → verify it in the live simulation → before/after recap with the real-world fix
- Trust (the in-game error budget) and progress saved in your browser; replay any finished ticket from the ticket list (Q)

| District | Topic | Tickets |
|---|---|---|
| Post Office | Networking & DNS | Wrong Address · Old Maps (TTL) · Nicknames (CNAME) · Closed Gate (firewall) · Traffic Jam (LB health checks) · Lost Letters (routing) |
| Railyard | CI/CD | Derailed · Flaky Signal · Slow Line · Wrong Cargo · Canary · Blue-Green Junction |
| Architect's Office | Infrastructure as code | Blueprint Basics · Hand-Built Shed (drift) · Destroy Line · Shared Ledger (state locking) · Reusable Plans (modules) · Secrets on the Blueprint |
| Harbor | Containers & Kubernetes | Sinking Ships (OOM) · Wrong Label · Never Ready · No Berth · Noisy Neighbor · Rolling Tide |
| Watchtower | Observability | Lamps On (golden signals) · Needle in the Haystack · Following the Courier (tracing) · Crying Wolf · Dark Corner (instrumentation) · Dashboard Day (PromQL) |
| Locksmith | Identity & security | Master Key · Key Under the Mat · Expired Seal (TLS) · Borrowed Badge · Who Opened the Door? · Locked Out (explicit deny) |
| Granary | Storage & databases | Full Barn · Lost Index · Untested Backup · Echo Delay (replication) · Too Many Carts (connection pools) · Failover Night |
| Town Hall | SLOs, capacity & cost | Promises (SLOs) · Budget Burn · Festival Day · The Treasury · The Postmortem · The Rota (toil) |
| Big Incidents | Everything at once | The Quiet Morning · Festival Meltdown · The Long Night |

## Project layout

```
src/
  engine/      game loop, input, scenes
  art/         procedural pixel art (placeholder until a real tileset)
  world/       town map, collision, TownScene
  levels/      catalog, IncidentScene + SpecScene (data-driven levels), terminal engine,
               content/ (all ticket specs by district), sims/ (rules for the two bespoke levels)
  state/       progress & saving
  ui/          DOM overlay: dialogue, HUD, ticket list
docs/superpowers/specs/   design doc
```

Most tickets are data: a `LevelSpec` in `src/levels/content/<district>.ts` with evidence, the editable settings (or terminal files and commands), a pure `verify`/`check`, a `solution`, and a recap. `content.test.ts` automatically proves every ticket starts broken and is solved by its solution.

## Scripts

`npm test` runs the unit tests for the rules, map and saves. `npm run build` type-checks and builds to `dist/`. Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
