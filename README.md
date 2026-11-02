# Ninefold

A cozy pixel-art town where you learn DevOps, SRE and cloud engineering by fixing things. Ships sink because they run out of memory, letters go to the wrong house because a DNS record is wrong, and you investigate with tools before you fix.

Named after "the nines" of uptime.

## Play locally

```sh
npm install
npm run dev     # http://localhost:5173
```

Controls: arrows/WASD to walk, **E** to talk, **Q** for the ticket list, **1–6** for tools inside an incident. Touch screens get an on-screen pad.

## What's in v0.1

- A walkable town with 8 districts, each teaching one area of the job
- 51 levels catalogued (6 per district plus 3 Big Incidents), in three acts: metaphor → real labels → real tools
- Two hands-on levels. Each one is: understand the ticket → find the cause in the evidence → change the real setting yourself → verify it in the live simulation → before/after recap:
  - **Harbor 1, Sinking Ships**: read the logbook and cargo chart, then size the ship's hold in its manifest (OOMKilled / CrashLoopBackOff)
  - **Post Office 1, Wrong Address**: look up names, knock on doors, edit the sorting wall, and send a test letter (DNS A record)
- Trust (the in-game error budget) and progress saved in your browser

## Project layout

```
src/
  engine/      game loop, input, scenes
  art/         procedural pixel art (placeholder until a real tileset)
  world/       town map, collision, TownScene
  levels/      catalog of all 51 levels, IncidentScene framework, one file per level, sims/ (pure rules)
  state/       progress & saving
  ui/          DOM overlay: dialogue, HUD, ticket list
docs/superpowers/specs/   design doc
```

Adding a level means writing its rules in `src/levels/sims/` (with tests), adding an `IncidentScene` subclass in `src/levels/`, flipping `built` in the catalog, and registering it in `src/main.ts`.

## Scripts

`npm test` runs the unit tests for the rules, map and saves. `npm run build` type-checks and builds to `dist/`. Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
