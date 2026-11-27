/**
 * The open world's things to do, live in the town: fishing, the bug net, the Letter Run,
 * a cat to pet and a fountain to wish on. TownScene owns the player; this owns everything else
 * about the pastimes and draws them.
 */
import type { Dir } from '../art/characters';
import { glow, type Particles } from '../art/atmosphere';
import { disc, ellipse, pixelText, rect, type Ctx } from '../art/pixels';
import { VIEW_H, VIEW_W, type Game } from '../engine/game';
import type { Box } from './collision';
import {
  BUGS,
  FISH,
  MEDAL_ICON,
  WISHES,
  formatTime,
  inWindow,
  medalFor,
  needleAt,
  pickCatch,
  pickRoute,
  reelSpeed,
  reelWindow,
  type BugKind,
  type Fish,
  type FishWhere,
  RUN_DOORS,
} from './pastimes';
import { FOUNTAIN, POSTBOX, TILE, isPondTile, isSolidTile, tileAt } from './townMap';

const OUT = '#2a1e1a';

/** What pressing E would do right now, and where to show the hint. */
export interface Prompt {
  label: string;
  x: number;
  y: number;
  act: () => void;
}

export interface PastimeHost {
  game: Game;
  player(): { box: Box; dir: Dir; moving: boolean };
  face(d: Dir): void;
  /** 0 = day, 1 = deep night. */
  night(): number;
  reduced: boolean;
  fx: Particles;
  sparks: Particles;
}

// ---------------------------------------------------------------- fishing

type FishState =
  | { k: 'cast'; t: number }
  | { k: 'wait'; t: number; bite: number }
  | { k: 'bite'; t: number; fish: Fish }
  | { k: 'reel'; t: number; fish: Fish; centre: number; tries: number }
  | { k: 'landed'; t: number; fish: Fish }
  | { k: 'missed'; t: number; why: string };

interface Fishing {
  where: FishWhere;
  dir: Dir;
  /** Where the bobber floats (world px). */
  bx: number;
  by: number;
  s: FishState;
}

const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// ---------------------------------------------------------------- bugs

/** The long grass of Lantern Meadow, where bugs roam (world px). */
const MEADOW = { x0: 41 * TILE + 4, y0: 17 * TILE + 4, x1: 53 * TILE - 4, y1: 24 * TILE - 4 };

interface Bug {
  kind: BugKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds into its current behaviour. */
  t: number;
  /** Beetle: hops so far. Roach: 1 while dashing, 0 resting. */
  n: number;
  /** Beetle: dizzy seconds left. */
  dizzy: number;
  /** A hop in progress: from/to. */
  hop?: { fx: number; fy: number; tx: number; ty: number; t: number };
  /** Moth: how visible it is (0-1). */
  seen: number;
  trail: { x: number; y: number; life: number }[];
  /** Flies off after being let go. */
  freed?: number;
}

// ---------------------------------------------------------------- cat

/** Where the town cat likes to wander (world px): the square below Town Hall. */
const CAT_AREA = { x0: 21 * TILE + 2, y0: 13 * TILE + 4, x1: 29 * TILE - 2, y1: 14 * TILE + 10 };

export class Pastimes {
  fishing: Fishing | undefined;
  private bugs: Bug[] = [];
  private respawn = 2;
  private swing = 0;
  private swingDir: Dir = 'down';
  private pops: { x: number; y: number; text: string; life: number; col: string }[] = [];
  run: { route: typeof RUN_DOORS; at: number; t: number; countdown: number } | undefined;
  private cat = { x: 24 * TILE, y: 14 * TILE + 6, tx: 24 * TILE, ty: 14 * TILE + 6, wait: 2, dir: 1, petted: 0, purrs: 0 };
  private wishIdx = 0;

  constructor(private host: PastimeHost) {}

  /** True while the player is busy with a pastime and shouldn't walk (fishing, run countdown). */
  get holdsPlayer(): boolean {
    return !!this.fishing || (!!this.run && this.run.countdown > 0);
  }

  /** True during a Letter Run: doors take letters instead of letting you in. */
  get running(): boolean {
    return !!this.run;
  }

  // ---------------------------------------------------------------- prompts

  /** The pastime under the player's feet, if any (shown as an "E" hint with a label). */
  prompt(): Prompt | undefined {
    if (this.fishing || this.run) return undefined;
    const { box } = this.host.player();
    const px = box.x + box.w / 2;
    const py = box.y + box.h / 2;
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);

    const water = this.waterBeside(tx, ty);
    if (tileAt(tx, ty) === 'd' && water) return { label: 'FISH', x: box.x, y: box.y - 30, act: () => this.cast(water.dir, water.where) };

    const near = (x: number, y: number, r: number) => Math.hypot(px - x, py - y) < r;
    if (near((POSTBOX.x + 0.5) * TILE, (POSTBOX.y + 0.5) * TILE, 20)) return { label: 'LETTER RUN', x: box.x, y: box.y - 30, act: () => this.startRun() };
    if (near(this.cat.x, this.cat.y, 18)) return { label: 'PET', x: this.cat.x - 5, y: this.cat.y - 24, act: () => this.pet() };
    if (near(FOUNTAIN.x * TILE, FOUNTAIN.y * TILE + 4, 24)) return { label: 'WISH', x: box.x, y: box.y - 30, act: () => this.wish() };
    if (this.inMeadow(px, py) && this.bugs.some((b) => !b.freed && Math.hypot(b.x - px, b.y - py) < 44 && this.visible(b) > 0.3))
      return { label: 'NET', x: box.x, y: box.y - 30, act: () => this.swingNet() };
    return undefined;
  }

  /** Is there something to do at this spot (for tap-to-move: walk there, then do it)? */
  interactiveAt(x: number, y: number): boolean {
    const near = (ax: number, ay: number, r: number) => Math.hypot(x - ax, y - ay) < r;
    if (near((POSTBOX.x + 0.5) * TILE, (POSTBOX.y + 0.5) * TILE, 14)) return true;
    if (near(this.cat.x, this.cat.y - 4, 12)) return true;
    if (near(FOUNTAIN.x * TILE, FOUNTAIN.y * TILE, 18)) return true;
    if (tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) === 'd' && this.waterBesideAny(Math.floor(x / TILE), Math.floor(y / TILE))) return true;
    return this.bugs.some((b) => !b.freed && near(b.x, b.y - 4, 12));
  }

  /** Where to stand to use the thing at (x, y): beside the postbox and fountain, not on them. */
  standFor(x: number, y: number): { x: number; y: number } {
    if (Math.hypot(x - (POSTBOX.x + 0.5) * TILE, y - (POSTBOX.y + 0.5) * TILE) < 14) return { x: (POSTBOX.x + 0.5) * TILE, y: (POSTBOX.y + 1.4) * TILE };
    if (Math.hypot(x - FOUNTAIN.x * TILE, y - FOUNTAIN.y * TILE) < 18) return { x: FOUNTAIN.x * TILE, y: (FOUNTAIN.y + 1.5) * TILE };
    return { x, y };
  }

  private waterBesideAny(tx: number, ty: number): boolean {
    return (['up', 'down', 'left', 'right'] as Dir[]).some((d) => {
      const [sx, sy] = STEP[d];
      return tileAt(tx + sx, ty + sy) === 'w' && tileAt(tx + sx * 2, ty + sy * 2) === 'w';
    });
  }

  /** Where the bobber is, so a tap near it reels. */
  get bobber(): { x: number; y: number } | undefined {
    return this.fishing ? { x: this.fishing.bx, y: this.fishing.by } : undefined;
  }

  private inMeadow(x: number, y: number): boolean {
    return x > MEADOW.x0 - 24 && x < MEADOW.x1 + 24 && y > MEADOW.y0 - 24 && y < MEADOW.y1 + 24;
  }

  /** Open water next to a dock tile, preferring the way the player faces. */
  private waterBeside(tx: number, ty: number): { dir: Dir; where: FishWhere } | undefined {
    const facing = this.host.player().dir;
    const dirs: Dir[] = [facing, 'up', 'down', 'left', 'right'];
    for (const d of dirs) {
      const [sx, sy] = STEP[d];
      if (tileAt(tx + sx, ty + sy) === 'w' && tileAt(tx + sx * 2, ty + sy * 2) === 'w')
        return { dir: d, where: isPondTile(tx + sx, ty + sy) ? 'pond' : 'sea' };
    }
    return undefined;
  }

  // ---------------------------------------------------------------- fishing

  private cast(dir: Dir, where: FishWhere): void {
    const { box } = this.host.player();
    this.host.face(dir);
    const [sx, sy] = STEP[dir];
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    this.fishing = { where, dir, bx: cx + sx * 28 + (sy ? 3 : 0), by: cy + sy * 30 + (sx ? 2 : 0), s: { k: 'cast', t: 0 } };
  }

  /** Stop fishing (walked away, or a menu opened). */
  reelIn(): void {
    this.fishing = undefined;
  }

  private updateFishing(dt: number, pressed: boolean): void {
    const f = this.fishing!;
    const s = f.s;
    s.t += dt;
    const ui = this.host.game.ui;
    const night = this.host.night() > 0.5;
    switch (s.k) {
      case 'cast':
        if (s.t > 0.45) {
          f.s = { k: 'wait', t: 0, bite: 1.4 + Math.random() * 3.6 };
          this.splash(f.bx, f.by, 4);
        }
        break;
      case 'wait':
        if (pressed) f.s = { k: 'missed', t: 0, why: 'TOO SOON · NOTHING ON THE HOOK' };
        else if (s.t > s.bite) {
          f.s = { k: 'bite', t: 0, fish: pickCatch(Math.random(), f.where, night) };
          this.splash(f.bx, f.by, 7);
        }
        break;
      case 'bite':
        if (pressed) f.s = { k: 'reel', t: 0, fish: s.fish, centre: 0.25 + Math.random() * 0.5, tries: s.fish.rarity === 'rare' ? 1 : 2 };
        else if (s.t > 0.95) f.s = { k: 'missed', t: 0, why: 'IT NIBBLED AND SWAM OFF' };
        break;
      case 'reel':
        if (pressed) {
          const needle = needleAt(s.t, reelSpeed(s.fish));
          if (inWindow(needle, s.centre, reelWindow(s.fish))) {
            f.s = { k: 'landed', t: 0, fish: s.fish };
            this.land(s.fish);
          } else if (s.tries > 1) {
            s.tries--;
            this.pop(f.bx, f.by - 10, 'NEARLY!', '#ffd23f');
          } else f.s = { k: 'missed', t: 0, why: 'IT SLIPPED OFF THE HOOK' };
        } else if (s.t > 7) f.s = { k: 'missed', t: 0, why: 'IT GOT TIRED OF WAITING' };
        break;
      case 'landed':
        if (s.t > 0.2 && !ui.dialog.open) this.fishing = undefined;
        break;
      case 'missed':
        if (s.t < dt * 1.5) ui.toast(s.why, 'info');
        if (s.t > 0.6) this.fishing = undefined;
        break;
    }
  }

  private land(fish: Fish): void {
    const { game, reduced } = this.host;
    const n = game.caught('fish', fish.id);
    const f = this.fishing!;
    if (!reduced) this.host.sparks.firework(f.bx, f.by - 14, fish.rarity === 'rare' ? '#ffd23f' : '#7fc2f0');
    const total = FISH.length;
    const kinds = Object.keys(game.progress.fish ?? {}).length;
    game.ui.toast(n === 1 ? `NEW FISH · ${kinds}/${total} IN YOUR JOURNAL` : `${fish.name.toUpperCase()} · ×${n}`, 'good');
    if (n === 1) game.ui.dialog.show(`🎣 ${fish.name}`, [fish.note, ...(kinds === total ? ['That\'s every fish in Ninefold. The harbor master would be proud!'] : [])]);
  }

  private splash(x: number, y: number, n: number): void {
    if (this.host.reduced) return;
    for (let i = 0; i < n; i++)
      this.host.fx.add({ x, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 25, grav: 120, life: 0.5, max: 0.5, size: 1, col: '#c8e8fa' });
  }

  // ---------------------------------------------------------------- bugs

  private spawnBug(night: boolean): void {
    const have = new Set(this.bugs.filter((b) => !b.freed).map((b) => b.kind));
    const kinds = BUGS.filter((b) => (b.night ? night : true) && !have.has(b.id)).map((b) => b.id);
    if (!kinds.length) return;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const { box } = this.host.player();
    let x = 0;
    let y = 0;
    for (let i = 0; i < 12; i++) {
      x = MEADOW.x0 + Math.random() * (MEADOW.x1 - MEADOW.x0);
      y = MEADOW.y0 + Math.random() * (MEADOW.y1 - MEADOW.y0);
      if (Math.hypot(x - box.x, y - box.y) > 60) break;
    }
    this.bugs.push({ kind, x, y, vx: 0, vy: 0, t: 0, n: 0, dizzy: 0, seen: kind === 'moth' ? 0 : 1, trail: [] });
  }

  private updateBugs(dt: number, t: number): void {
    const { box, moving } = this.host.player();
    const px = box.x + box.w / 2;
    const py = box.y + box.h / 2;
    const night = this.host.night() > 0.5;
    this.respawn -= dt;
    if (this.respawn <= 0) {
      this.respawn = 4 + Math.random() * 4;
      if (this.bugs.filter((b) => !b.freed).length < 5) this.spawnBug(night);
    }
    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const b = this.bugs[i];
      b.t += dt;
      if (b.freed !== undefined) {
        b.freed -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy -= 20 * dt;
        if (b.freed <= 0) this.bugs.splice(i, 1);
        continue;
      }
      // Fireflies go to bed at sunrise.
      if (b.kind === 'firefly' && !night) {
        this.bugs.splice(i, 1);
        continue;
      }
      const d = Math.hypot(b.x - px, b.y - py);
      switch (b.kind) {
        case 'slug': {
          this.wander(b, dt, 4, 3);
          if (b.t % 0.5 < dt) b.trail.push({ x: b.x, y: b.y + 1, life: 8 });
          break;
        }
        case 'beetle': {
          if (b.hop) {
            b.hop.t += dt;
            const k = Math.min(1, b.hop.t / 0.28);
            b.x = b.hop.fx + (b.hop.tx - b.hop.fx) * k;
            b.y = b.hop.fy + (b.hop.ty - b.hop.fy) * k;
            if (k >= 1) b.hop = undefined;
          } else if (b.dizzy > 0) b.dizzy -= dt;
          else if (d < 24) this.hopAway(b, px, py);
          else this.wander(b, dt, 8, 2);
          break;
        }
        case 'roach': {
          // Dash, rest, dash: catchable only while resting.
          const len = b.n ? 1.1 : 1.0;
          if (b.t > len) {
            b.t = 0;
            b.n = b.n ? 0 : 1;
            if (b.n) {
              const a = Math.random() * Math.PI * 2;
              b.vx = Math.cos(a) * 62;
              b.vy = Math.sin(a) * 62;
            }
          }
          if (b.n) this.moveIn(b, b.vx * dt, b.vy * dt);
          break;
        }
        case 'moth': {
          // Only shows itself when you stand still; then drifts closer, curious.
          const still = !moving;
          b.seen = Math.max(0, Math.min(1, b.seen + (still ? 0.9 : -3) * dt));
          if (still && d > 14 && d < 110) this.moveIn(b, ((px - b.x) / d) * 9 * dt, ((py - 6 - b.y) / d) * 9 * dt);
          else this.wander(b, dt, 14, 1.5);
          break;
        }
        case 'firefly': {
          this.wander(b, dt, 10, 1.2);
          break;
        }
      }
      for (let j = b.trail.length - 1; j >= 0; j--) if ((b.trail[j].life -= dt) <= 0) b.trail.splice(j, 1);
    }
    void t;
  }

  /** Amble about inside the meadow, changing heading now and then. */
  private wander(b: Bug, dt: number, speed: number, every: number): void {
    if (b.t > every || (b.vx === 0 && b.vy === 0)) {
      b.t = 0;
      const a = Math.random() * Math.PI * 2;
      b.vx = Math.cos(a) * speed;
      b.vy = Math.sin(a) * speed;
    }
    this.moveIn(b, b.vx * dt, b.vy * dt);
  }

  private moveIn(b: Bug, dx: number, dy: number): void {
    b.x += dx;
    b.y += dy;
    if (b.x < MEADOW.x0 || b.x > MEADOW.x1) {
      b.vx = -b.vx;
      b.x = Math.max(MEADOW.x0, Math.min(MEADOW.x1, b.x));
    }
    if (b.y < MEADOW.y0 || b.y > MEADOW.y1) {
      b.vy = -b.vy;
      b.y = Math.max(MEADOW.y0, Math.min(MEADOW.y1, b.y));
    }
  }

  /** The Off-by-one Beetle hops exactly one tile away from you. Trapped against an edge, it gets dizzy. */
  private hopAway(b: Bug, px: number, py: number): void {
    const dx = b.x - px;
    const dy = b.y - py;
    const [sx, sy] = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
    const tx = b.x + sx * TILE;
    const ty = b.y + sy * TILE;
    const blocked = tx < MEADOW.x0 || tx > MEADOW.x1 || ty < MEADOW.y0 || ty > MEADOW.y1;
    if (blocked || b.n >= 3) {
      b.dizzy = 3.2;
      b.n = 0;
      this.pop(b.x, b.y - 8, blocked ? 'CORNERED!' : 'DIZZY!', '#ffd23f');
      return;
    }
    b.n++;
    b.hop = { fx: b.x, fy: b.y, tx, ty, t: 0 };
  }

  /** Can this bug be netted right now? */
  private catchable(b: Bug): boolean {
    switch (b.kind) {
      case 'beetle':
        return !b.hop && b.dizzy > 0;
      case 'roach':
        return !b.n;
      case 'moth':
        return b.seen > 0.6;
      case 'firefly':
        return this.lit(b);
      default:
        return true;
    }
  }

  private lit(b: Bug): boolean {
    return (b.t * 0.7 + b.x * 0.01) % 2.4 < 1.5;
  }

  private visible(b: Bug): number {
    return b.kind === 'moth' ? b.seen : 1;
  }

  private swingNet(): void {
    if (this.swing > 0) return;
    const { box, dir } = this.host.player();
    const px = box.x + box.w / 2;
    const py = box.y + box.h / 2;
    // Turn toward the closest bug, then swing.
    const target = this.bugs.filter((b) => !b.freed).sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
    let d = dir;
    if (target && Math.hypot(target.x - px, target.y - py) < 44) {
      const dx = target.x - px;
      const dy = target.y - py;
      d = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      this.host.face(d);
    }
    this.swing = 0.3;
    this.swingDir = d;
    const [sx, sy] = STEP[d];
    const hx = px + sx * 12;
    const hy = py - 4 + sy * 10;
    const hit = this.bugs.find((b) => !b.freed && Math.hypot(b.x - hx, b.y - hy) < 17);
    const ui = this.host.game.ui;
    if (!hit) {
      this.pop(hx, hy - 6, 'SWISH', '#ffffff');
      return;
    }
    if (!this.catchable(hit)) {
      const why: Record<BugKind, string> = { slug: '', beetle: 'IT HOPPED!', roach: 'TOO QUICK!', moth: 'IT VANISHED!', firefly: 'IT WENT DARK!' };
      this.pop(hit.x, hit.y - 10, why[hit.kind], '#ffd23f');
      if (hit.kind === 'beetle') this.hopAway(hit, px, py);
      if (hit.kind === 'moth') hit.seen = 0;
      return;
    }
    const type = BUGS.find((x) => x.id === hit.kind)!;
    const n = this.host.game.caught('bugs', hit.kind);
    if (!this.host.reduced) this.host.sparks.firework(hit.x, hit.y - 8, '#c08aff');
    // Let it go again: the meadow stays lively and you keep the entry in your journal.
    hit.freed = 1.2;
    hit.vx = (Math.random() - 0.5) * 20;
    hit.vy = -18;
    const kinds = Object.keys(this.host.game.progress.bugs ?? {}).length;
    if (n === 1) {
      ui.toast(`NEW BUG · ${kinds}/${BUGS.length} IN YOUR JOURNAL`, 'good');
      ui.dialog.show(`🦋 ${type.name}`, [type.note, `You note it down and let it go. ${kinds === BUGS.length ? 'That\'s every bug in the meadow!' : 'Press J to see your journal.'}`]);
    } else ui.toast(`${type.name.toUpperCase()} · CAUGHT ×${n} · LET GO`, 'good');
  }

  // ---------------------------------------------------------------- letter run

  private startRun(): void {
    const ui = this.host.game.ui;
    const best = this.host.game.progress.runBest;
    ui.dialog.show('Rosa', [
      `Letter Run! Four letters, four doors. Read the address, find the door, walk up to it. ${best ? `Your best is ${formatTime(best)}.` : 'Gold is under 0:38.'}`,
    ], () => {
      this.run = { route: pickRoute(Math.random), at: 0, t: 0, countdown: 2.4 };
    });
  }

  private updateRun(dt: number): void {
    const r = this.run!;
    const ui = this.host.game.ui;
    if (r.countdown > 0) {
      const before = Math.ceil(r.countdown);
      r.countdown -= dt;
      if (Math.ceil(r.countdown) !== before && r.countdown > 0) ui.toast(`${Math.ceil(r.countdown)}…`, 'info');
      if (r.countdown <= 0) ui.toast('GO!', 'good');
      return;
    }
    if (ui.busy) return;
    r.t += dt;
    const door = r.route[r.at];
    const { box } = this.host.player();
    const px = box.x + box.w / 2;
    const py = box.y + box.h / 2;
    if (Math.hypot(px - (door.x + 0.5) * TILE, py - (door.y + 0.3) * TILE) < 11) {
      r.at++;
      if (!this.host.reduced) this.host.sparks.firework((door.x + 0.5) * TILE, door.y * TILE - 8, '#ffd23f');
      if (r.at >= r.route.length) {
        const best = this.host.game.finishRun(r.t);
        const medal = medalFor(r.t);
        this.run = undefined;
        ui.toast(`${MEDAL_ICON[medal]} ${formatTime(r.t)}${best ? ' · NEW BEST!' : ''}`, 'good');
        ui.dialog.show('Rosa', [
          `All delivered in ${formatTime(r.t)}. That's ${medal}! ${best ? 'A new best time.' : `Your best is still ${formatTime(this.host.game.progress.runBest ?? r.t)}.`}`,
          'Fun fact: real mail and real internet traffic both get routed: each hop only needs to know the next step toward the address.',
        ]);
      } else ui.toast(`DELIVERED ${r.at}/${r.route.length}`, 'good');
    }
  }

  /** Give up on a run (e.g. the quest log opened). */
  cancelRun(): void {
    this.run = undefined;
  }

  // ---------------------------------------------------------------- cat and fountain

  private pet(): void {
    const c = this.cat;
    c.petted = 1.6;
    c.wait = 3;
    c.purrs++;
    for (let i = 0; i < 4; i++)
      this.host.fx.add({ x: c.x + (Math.random() - 0.5) * 8, y: c.y - 8, vx: (Math.random() - 0.5) * 10, vy: -14 - Math.random() * 8, life: 1.2, max: 1.2, size: 1, col: '#ff6a8a' });
    const lines = ['Purrrr…', 'Patch leans into your hand.', 'Patch slow-blinks at you. That means trust.', 'Patch flops over for belly rubs. It is a trap.'];
    this.host.game.ui.toast(lines[(c.purrs - 1) % lines.length].toUpperCase(), 'good');
  }

  private wish(): void {
    const w = WISHES[this.wishIdx++ % WISHES.length];
    const x = FOUNTAIN.x * TILE;
    const y = FOUNTAIN.y * TILE - 2;
    if (!this.host.reduced) {
      this.host.sparks.firework(x, y - 10, '#ffd23f');
      for (let i = 0; i < 5; i++) this.host.fx.add({ x, y, vx: (Math.random() - 0.5) * 20, vy: -25, grav: 80, life: 0.6, max: 0.6, size: 1, col: '#c8e8fa' });
    }
    this.host.game.ui.dialog.show('', [`You toss a coin into the fountain. Plink! ${w}`]);
  }

  private updateCat(dt: number): void {
    const c = this.cat;
    if (c.petted > 0) {
      c.petted -= dt;
      return;
    }
    if (this.host.night() > 0.6) return; // asleep
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      c.x += (dx / d) * 11 * dt;
      c.y += (dy / d) * 11 * dt;
      if (Math.abs(dx) > 0.5) c.dir = dx < 0 ? -1 : 1;
    } else if ((c.wait -= dt) <= 0) {
      c.wait = 2 + Math.random() * 5;
      c.tx = CAT_AREA.x0 + Math.random() * (CAT_AREA.x1 - CAT_AREA.x0);
      c.ty = CAT_AREA.y0 + Math.random() * (CAT_AREA.y1 - CAT_AREA.y0);
      if (isSolidTile(Math.floor(c.tx / TILE), Math.floor(c.ty / TILE))) {
        c.tx = c.x;
        c.ty = c.y;
      }
    }
  }

  // ---------------------------------------------------------------- update

  /** One frame. `pressed` = E was pressed and nothing else took it. */
  update(dt: number, t: number, pressed: boolean): void {
    const busy = this.host.game.ui.busy;
    if (this.fishing && (!busy || this.fishing.s.k === 'landed')) this.updateFishing(dt, pressed);
    if (this.run) this.updateRun(dt);
    this.updateBugs(dt, t);
    this.updateCat(dt);
    if (this.swing > 0) this.swing -= dt;
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.life -= dt;
      p.y -= 10 * dt;
      if (p.life <= 0) this.pops.splice(i, 1);
    }
  }

  private pop(x: number, y: number, text: string, col: string): void {
    this.pops.push({ x, y, text, life: 1, col });
  }

  // ---------------------------------------------------------------- drawing (world space)

  /** Things that sort with people by their feet: the cat and the bugs. */
  drawables(c: Ctx, t: number): { y: number; draw: () => void }[] {
    const out: { y: number; draw: () => void }[] = [];
    const cat = this.cat;
    out.push({ y: cat.y + 2, draw: () => drawCat(c, cat.x, cat.y, cat.dir, t, cat.petted > 0, this.host.night() > 0.6) });
    for (const b of this.bugs) out.push({ y: b.y + 2, draw: () => this.drawBug(c, b, t) });
    return out;
  }

  /** Drawn flat on the ground, before people: slug trails, the fishing line and bobber, run markers. */
  drawGround(c: Ctx): void {
    for (const b of this.bugs)
      for (const p of b.trail) {
        c.globalAlpha = Math.min(0.55, p.life / 8);
        rect(c, p.x - 1, p.y, 2, 1, '#d8f0ff');
        c.globalAlpha = 1;
      }
  }

  /** Drawn over the world: the rod and line, the net swing, run targets, little pop-up words. */
  drawOver(c: Ctx, t: number): void {
    // Firefly glows go on top of the night, so they light up the dark.
    for (const b of this.bugs)
      if (b.kind === 'firefly' && !b.freed && this.lit(b)) {
        const fy = b.y - 7 + Math.sin(t * 2.4 + b.y) * 2;
        glow(c, b.x, fy + 2, 10, '220,255,120', 0.55);
        rect(c, b.x - 0.5, fy + 1.5, 1.5, 1, '#f0ff90');
      }
    const f = this.fishing;
    if (f) this.drawLine(c, f, t);
    if (this.swing > 0) this.drawNet(c);
    if (this.run && this.run.countdown <= 0) {
      const door = this.run.route[this.run.at];
      const x = (door.x + 0.5) * TILE;
      const y = door.y * TILE - 14 - (this.host.reduced ? 0 : Math.abs(Math.sin(t * 4)) * 4);
      drawEnvelope(c, x - 5, y);
      glow(c, x, door.y * TILE + 8, 14, '255,210,80', 0.35);
    }
    for (const p of this.pops) {
      c.globalAlpha = Math.min(1, p.life * 2);
      const w = p.text.length * 4 + 4;
      rect(c, p.x - w / 2, p.y - 6, w, 8, 'rgba(42,30,26,0.75)');
      pixelText(c, p.text, p.x - w / 2 + 2, p.y, p.col, 4);
      c.globalAlpha = 1;
    }
  }

  private drawLine(c: Ctx, f: Fishing, t: number): void {
    const { box } = this.host.player();
    const [sx, sy] = STEP[f.dir];
    const hx = box.x + box.w / 2 + sx * 6 + (sy ? 5 : 0);
    const hy = box.y - 4 + (sy > 0 ? 2 : 0);
    // Rod
    const tipX = hx + sx * 9 + (sy ? 2 : 0);
    const tipY = hy - 8 + sy * 4;
    for (let i = 0; i <= 8; i++) rect(c, hx + ((tipX - hx) * i) / 8, hy + ((tipY - hy) * i) / 8, 1, 1, i > 5 ? '#d9a35a' : '#6b4a2a');
    const s = f.s;
    // Bobber flies out during the cast.
    const k = s.k === 'cast' ? Math.min(1, s.t / 0.45) : 1;
    const bob = s.k === 'wait' ? Math.sin(t * 3) * 0.6 : 0;
    const dip = s.k === 'bite' ? 2 + Math.sin(t * 30) : s.k === 'reel' ? 1 + Math.sin(t * 18) : 0;
    const bx = tipX + (f.bx - tipX) * k;
    const by = tipY + (f.by - tipY) * k - Math.sin(k * Math.PI) * 14 + bob + dip;
    if (s.k === 'missed' || s.k === 'landed') return;
    // Line: a gentle sag between rod tip and bobber.
    c.globalAlpha = 0.85;
    for (let i = 0; i <= 18; i++) {
      const u = i / 18;
      rect(c, tipX + (bx - tipX) * u, tipY + (by - tipY) * u + Math.sin(u * Math.PI) * 4 * k, 0.5, 0.5, '#f8f8f0');
    }
    c.globalAlpha = 1;
    if (k >= 1) {
      // Ripples around the bobber.
      const r = (t * 6) % 6;
      c.globalAlpha = 0.5 * (1 - r / 6);
      ellipse(c, bx, by + 2, 3 + r, 1 + r / 3, '#c8e8fa');
      c.globalAlpha = 1;
      ellipse(c, bx, by + 2, 3 + r * 0.6, 1, '#3d8fd1');
    }
    rect(c, bx - 1.5, by - 2, 3, 2, '#e04040');
    rect(c, bx - 1.5, by, 3, 1.5, '#f8f8f8');
    rect(c, bx - 0.5, by - 3, 1, 1, '#2a1e1a');
    if (s.k === 'bite') {
      const y = by - 18 - Math.abs(Math.sin(t * 12)) * 2;
      rect(c, bx - 4, y, 9, 11, OUT);
      rect(c, bx - 3, y + 1, 7, 9, '#fff');
      pixelText(c, '!', bx - 2, y + 9, '#d04040', 7);
    }
  }

  private drawNet(c: Ctx): void {
    const { box } = this.host.player();
    const [sx, sy] = STEP[this.swingDir];
    const k = 1 - this.swing / 0.3; // 0..1 through the swing
    const cx = box.x + box.w / 2;
    const cy = box.y - 2;
    // The arc sweeps across the facing direction.
    const base = Math.atan2(sy, sx);
    const a = base - 1.1 + k * 2.2;
    const hx = cx + Math.cos(a) * 14;
    const hy = cy + Math.sin(a) * 11;
    for (let i = 0; i <= 6; i++) rect(c, cx + (hx - cx) * (i / 6), cy + (hy - cy) * (i / 6), 1, 1, '#8b5a2b');
    disc(c, hx, hy, 4, 'rgba(255,255,255,0.35)');
    disc(c, hx, hy, 3, 'rgba(240,240,255,0.25)');
    rect(c, hx - 4, hy, 8, 0.5, '#f8f8f0');
    rect(c, hx, hy - 4, 0.5, 8, '#f8f8f0');
  }

  private drawBug(c: Ctx, b: Bug, t: number): void {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const flap = Math.floor(t * 10 + b.x) % 2;
    if (b.freed !== undefined) c.globalAlpha = Math.max(0, b.freed / 1.2);
    switch (b.kind) {
      case 'slug':
        ellipse(c, x, y + 1, 3, 1, 'rgba(0,0,0,0.15)');
        rect(c, x - 3, y - 1, 6, 2, '#8ac04a');
        rect(c, x - 2, y - 2, 4, 1, '#a8d860');
        rect(c, x + (b.vx < 0 ? -4 : 2), y - 3, 0.5, 2, '#8ac04a');
        rect(c, x + (b.vx < 0 ? -3 : 3), y - 3, 0.5, 2, '#8ac04a');
        break;
      case 'beetle': {
        const air = b.hop ? Math.sin((b.hop.t / 0.28) * Math.PI) * 5 : 0;
        ellipse(c, x, y + 1, 3, 1, 'rgba(0,0,0,0.18)');
        disc(c, x, y - 1 - air, 2, '#2f6f4a');
        rect(c, x - 0.25, y - 3 - air, 0.5, 4, '#1d4a30');
        rect(c, x - 1, y - 2 - air, 0.5, 0.5, '#8ad0a0');
        if (b.dizzy > 0) for (let i = 0; i < 3; i++) {
          const a = t * 6 + i * 2.1;
          rect(c, x + Math.cos(a) * 4, y - 6 + Math.sin(a) * 1.5, 1, 1, '#ffd23f');
        }
        break;
      }
      case 'roach':
        ellipse(c, x, y + 1, 3, 1, 'rgba(0,0,0,0.18)');
        rect(c, x - 2, y - 2, 4, 2.5, '#7a4a28');
        rect(c, x - 1, y - 2, 2, 1, '#a86a38');
        if (b.n) {
          rect(c, x - 4 * Math.sign(b.vx || 1), y - 1, 1, 0.5, 'rgba(255,255,255,0.6)');
          rect(c, x - 6 * Math.sign(b.vx || 1), y, 1.5, 0.5, 'rgba(255,255,255,0.4)');
        } else if (Math.floor(t * 3) % 2) pixelText(c, 'z', x + 2, y - 4, '#ffffff', 4);
        break;
      case 'moth': {
        c.globalAlpha *= b.seen;
        const fy = y - 6 + Math.sin(t * 3 + b.x) * 1.5;
        ellipse(c, x, y + 1, 2, 0.5, 'rgba(0,0,0,0.12)');
        rect(c, x - 3, fy - flap, 2.5, 2, '#e8e0f8');
        rect(c, x + 0.5, fy - flap, 2.5, 2, '#e8e0f8');
        rect(c, x - 0.5, fy - 1, 1, 3, '#7a6a9a');
        break;
      }
      case 'firefly': {
        const on = this.lit(b);
        const fy = y - 7 + Math.sin(t * 2.4 + b.y) * 2;
        rect(c, x - 1, fy, 2, 1.5, '#4a3a2a');
        if (on) rect(c, x - 0.5, fy + 1.5, 1.5, 1, '#e8ff70');
        break;
      }
    }
    c.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- drawing (screen space)

  /** Overlays fixed to the screen: the reel bar and the Letter Run card. */
  drawScreen(c: Ctx, t: number): void {
    const f = this.fishing;
    if (f && f.s.k === 'reel') {
      const s = f.s;
      const w = 120;
      const x = (VIEW_W - w) / 2;
      const y = VIEW_H - 46;
      rect(c, x - 6, y - 14, w + 12, 26, OUT);
      rect(c, x - 5, y - 13, w + 10, 24, '#f8ecd0');
      pixelText(c, `${this.touch ? 'TAP' : 'PRESS E'} IN THE GREEN${s.tries > 1 ? ' · 2 TRIES' : ''}`, x - 2, y - 5, '#5a3a1a', 4);
      rect(c, x, y, w, 7, '#5a3a1a');
      const win = reelWindow(s.fish);
      rect(c, x + (s.centre - win / 2) * w, y, win * w, 7, '#5ee08a');
      rect(c, x + (s.centre - win / 2) * w, y, win * w, 2, '#9af0b8');
      const n = needleAt(s.t, reelSpeed(s.fish));
      rect(c, x + n * w - 1, y - 2, 2, 11, '#ffffff');
      rect(c, x + n * w - 0.5, y - 2, 1, 11, OUT);
    } else if (f && (f.s.k === 'wait' || f.s.k === 'cast')) {
      this.hint(c, this.touch ? 'WAIT FOR THE BOBBER TO DIP · TAP AWAY TO STOP' : 'WAIT FOR THE BOBBER TO DIP · ARROWS TO STOP');
    } else if (f && f.s.k === 'bite') {
      this.hint(c, this.touch ? 'A BITE! TAP NOW!' : 'A BITE! PRESS E NOW!', '#ffd23f');
    }
    const r = this.run;
    if (r) {
      const door = r.route[r.at];
      const w = 128;
      const x = (VIEW_W - w) / 2;
      const y = 6;
      rect(c, x - 1, y - 1, w + 2, 22, OUT);
      rect(c, x, y, w, 20, '#f8ecd0');
      rect(c, x, y, w, 1, '#ffffff');
      drawEnvelope(c, x + 4, y + 5);
      pixelText(c, r.countdown > 0 ? 'GET READY…' : `TO: ${door.label}`, x + 17, y + 9, '#5a3a1a', 5);
      pixelText(c, `${r.at + 1}/${r.route.length}`, x + 17, y + 17, '#9a8a7a', 4);
      pixelText(c, formatTime(r.t), x + w - 34, y + 17, '#b5523b', 5);
      if (r.countdown <= 0) this.pointer(c, t, (door.x + 0.5) * TILE, door.y * TILE);
    }
  }

  private hint(c: Ctx, text: string, col = '#ffffff'): void {
    const w = text.length * 4 + 10;
    const x = (VIEW_W - w) / 2;
    const y = VIEW_H - 22;
    rect(c, x, y - 7, w, 10, 'rgba(42,30,26,0.78)');
    pixelText(c, text, x + 5, y, col, 4);
  }

  /** When the next door is off screen, an arrow at the edge points the way. */
  private pointer(c: Ctx, t: number, wx: number, wy: number): void {
    const cam = this.cam;
    const sx = wx - cam.x;
    const sy = wy - cam.y;
    const m = 14;
    if (sx > m && sx < VIEW_W - m && sy > m + 26 && sy < VIEW_H - m) return;
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const a = Math.atan2(sy - cy, sx - cx);
    const k = Math.min((VIEW_W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (VIEW_H / 2 - m - 8) / Math.abs(Math.sin(a) || 1e-6));
    const ax = cx + Math.cos(a) * k;
    const ay = cy + Math.sin(a) * k + 6;
    const pulse = this.host.reduced ? 0 : Math.sin(t * 8) * 1.5;
    disc(c, ax, ay, 7, OUT);
    disc(c, ax, ay, 6, '#ffd23f');
    for (let i = 0; i < 5; i++) {
      const u = (i - 2) * 1.2;
      rect(c, ax + Math.cos(a) * (u + pulse) - 0.5, ay + Math.sin(a) * (u + pulse) - 0.5, 2, 2, '#5a3a1a');
    }
    rect(c, ax + Math.cos(a) * (4 + pulse) - 1, ay + Math.sin(a) * (4 + pulse) - 1, 2.5, 2.5, '#5a3a1a');
  }

  /** True on touch screens, so hints say "tap" instead of "press E". */
  touch = false;

  /** The camera (set by TownScene each frame), for screen-edge arrows. */
  cam = { x: 0, y: 0 };
}

function drawEnvelope(c: Ctx, x: number, y: number): void {
  rect(c, x - 0.5, y - 0.5, 11, 8, OUT);
  rect(c, x, y, 10, 7, '#fff8e8');
  for (let i = 0; i < 5; i++) {
    rect(c, x + i, y + i * 0.7, 1, 1, '#c8a060');
    rect(c, x + 9 - i, y + i * 0.7, 1, 1, '#c8a060');
  }
  rect(c, x + 4, y + 3, 2, 2, '#c0392b');
}

/** Patch, the town cat: orange tabby, white socks. Sits, walks, purrs, sleeps at night. */
function drawCat(c: Ctx, x: number, y: number, dir: number, t: number, happy: boolean, asleep: boolean): void {
  const X = (px: number, py: number, w: number, h: number, col: string) => rect(c, x + (dir < 0 ? -px - w : px), y + py, w, h, col);
  ellipse(c, x, y + 1, 5, 1, 'rgba(0,0,0,0.2)');
  if (asleep) {
    ellipse(c, x, y - 2, 5, 3, OUT);
    ellipse(c, x, y - 2, 4, 2, '#e8913a');
    X(-4, -3, 3, 2, '#e8913a');
    X(1, -4, 2, 1, '#b8641e');
    X(-1, -3, 2, 1, '#b8641e');
    if (Math.floor(t * 1.5) % 2) pixelText(c, 'z', x + 4, y - 7, '#ffffff', 4);
    return;
  }
  const walk = Math.floor(t * 8) % 2;
  // body
  X(-4, -5, 8, 4, OUT);
  X(-3.5, -4.5, 7, 3, '#e8913a');
  X(-2, -4.5, 1, 3, '#b8641e');
  X(0, -4.5, 1, 3, '#b8641e');
  // legs
  X(-3, -1.5, 1, 2 - walk * 0.5, '#fff4e0');
  X(2, -1.5, 1, 1.5 + walk * 0.5, '#fff4e0');
  // tail
  const wag = happy ? Math.sin(t * 14) * 1.5 : Math.sin(t * 2) * 1;
  X(-6, -7 + wag, 1.5, 4, '#e8913a');
  X(-6, -8 + wag, 1.5, 1, '#b8641e');
  // head
  X(2, -9, 5, 5, OUT);
  X(2.5, -8.5, 4, 4, '#e8913a');
  X(2.5, -10, 1, 1.5, '#e8913a');
  X(5.5, -10, 1, 1.5, '#e8913a');
  if (happy) {
    X(3, -7, 1, 0.5, OUT);
    X(5, -7, 1, 0.5, OUT);
  } else {
    X(3, -7.5, 1, 1, OUT);
    X(5, -7.5, 1, 1, OUT);
  }
  X(4, -6, 1, 0.5, '#ff8aa8');
}
