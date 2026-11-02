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
- Two playable levels:
  - **Harbor 1, Sinking Ships**: a crash loop from running out of memory (Investigate & Fix kit)
  - **Post Office 1, Wrong Address**: a wrong DNS record (Sort & Match kit)
- Trust (the in-game error budget) and progress saved in your browser

## Project layout

```
src/
  engine/      game loop, input, scenes
  art/         procedural pixel art (placeholder until a real tileset)
  world/       town map, collision, TownScene
  levels/      catalog of all 51 levels, kits (pure rules + scenes), per-level stages
  state/       progress & saving
  ui/          DOM overlay: dialogue, HUD, ticket list
docs/superpowers/specs/   design doc
```

Adding a level means writing a level definition and a stage in `src/levels/stages/`, flipping `built` in the catalog, and registering it in `src/main.ts`.

## Scripts

`npm test` runs the unit tests for the rules, map and saves. `npm run build` type-checks and builds to `dist/`. Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
