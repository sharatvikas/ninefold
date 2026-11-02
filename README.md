# Ninefold

A cozy pixel-art town where you learn DevOps, SRE and cloud engineering by fixing things. Ships sink because they run out of memory, letters go to the wrong house because a DNS record is wrong, and you investigate with tools before you fix.

Named after "the nines" of uptime.

**▶ Play it now: https://sharatvikas.github.io/ninefold/** (free, runs in your browser, nothing to install)

## Play it on your own computer

Ninefold runs entirely in your browser. There's no server, database or account, so playing locally needs nothing beyond Node.js.

### 1. Install the prerequisites (one time)

| Tool | Why | Get it |
|---|---|---|
| **Node.js 20.19 or newer** (22 LTS recommended) | builds and serves the game | [nodejs.org](https://nodejs.org) (LTS installer), or `brew install node` on macOS, or `nvm install 22` |
| **Git** (optional) | to clone the repo | [git-scm.com](https://git-scm.com), or download the ZIP from GitHub instead |

Check it worked:

```sh
node -v    # v20.19.0 or higher
npm -v
```

### 2. Get the code

```sh
git clone https://github.com/sharatvikas/ninefold.git
cd ninefold
```

No Git? On the GitHub page click **Code → Download ZIP**, unzip it, and open a terminal in that folder.

### 3. Install and play

```sh
npm install      # first time only, ~30 seconds
npm run play     # builds the game and opens it at http://localhost:4173
```

That's it. `npm run play` serves the optimised build, just as players would get it online. Stop it with **Ctrl+C**.

If you want to change the game, use the dev server instead. It reloads instantly when you edit code:

```sh
npm run dev      # http://localhost:5173
```

### Controls

Arrows/WASD to walk · **E** to talk · **Q** for the ticket list · **👤 AVATAR** to change your look · **1–6** to switch tools inside a ticket · **Esc** to leave a ticket. Touch screens get an on-screen pad.

### Good to know

- **Saves** live in your browser (localStorage) for that address. Using a different browser or port starts a fresh game. To start over, open the browser dev tools console and run `localStorage.removeItem('ninefold.save.v1')`, then refresh.
- **Offline:** after `npm install`, the game itself works without internet. Only the pixel font is loaded from Google Fonts, and it falls back to a monospace font if that's unavailable.
- **Opening `dist/index.html` directly doesn't work.** Browsers block modules on `file://`, so always use `npm run play` (or any static file server, such as `npx serve dist`).

### Troubleshooting

| Problem | Fix |
|---|---|
| `npm: command not found` | Node.js isn't installed or the terminal needs reopening after install |
| Errors mentioning `node:` or `engine` | Node is too old: install 20.19+ or 22 LTS |
| `Port 4173 is in use` | Something else is on that port: `npx vite preview --port 4200` |
| Blank page | Hard-refresh (Cmd/Ctrl+Shift+R); check the browser console for errors |

## Sharing it online for free

The build is ~300 KB of static files (about 100 KB compressed), so hosting is free on any static host and can't run up a bill: there's no server or database to pay for.

| Option | Cost | Notes |
|---|---|---|
| **GitHub Pages** (in use) | free for public repos | Live at https://sharatvikas.github.io/ninefold/. Every push to `main` runs the tests and redeploys (`.github/workflows/deploy.yml`). Forks: enable *Settings → Pages → Source: GitHub Actions*. |
| **Cloudflare Pages** | free plan | Connect the repo, build command `npm run build`, output folder `dist`. |
| **Netlify** | free plan | Same settings as Cloudflare. |
| **itch.io** | free | Upload a ZIP of `dist/` as an HTML5 game; good for reaching players. |

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
