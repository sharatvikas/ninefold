/**
 * Pastimes: the open-world things to do around Ninefold when you're not on a ticket.
 * Fishing at the Lantern Meadow pond and off the harbor dock, catching bugs in the long grass,
 * and the Post office's Letter Run. Pure data and rules here, so they can be unit tested.
 */
import { BUILDINGS, doorOf } from './townMap';

export type FishWhere = 'pond' | 'sea';
export type Rarity = 'junk' | 'common' | 'uncommon' | 'rare';

export interface Fish {
  id: string;
  name: string;
  where: FishWhere;
  rarity: Rarity;
  /** Only bites after dark. */
  night?: boolean;
  /** Body and fin colours for the little catch sprite. */
  col: string;
  fin: string;
  /** One line, shown when you land it: the joke, and the real thing behind it. */
  note: string;
}

export const FISH: Fish[] = [
  { id: 'perch', name: 'Packet Perch', where: 'pond', rarity: 'common', col: '#7fb069', fin: '#e8a030', note: 'Swims in small schools, like data split into packets. Lose one and the whole message has to wait for it.' },
  { id: 'carp', name: 'Cache Carp', where: 'pond', rarity: 'common', col: '#e8a030', fin: '#c0392b', note: 'Always hangs around the same spot, so it is quick to find again. That is what a cache is for.' },
  { id: 'pike', name: 'Ping Pike', where: 'pond', rarity: 'uncommon', col: '#9aa6b2', fin: '#2b6cb0', note: 'Darts out and straight back. A ping does the same: is anyone there, and how long did the answer take?' },
  { id: 'eel', name: 'Latency Eel', where: 'pond', rarity: 'uncommon', col: '#5a6a3a', fin: '#3a4a2a', note: 'Took its time getting here. Engineers watch the slowest replies (the p99), not the average, because that is who waits.' },
  { id: 'koi', name: 'Golden Uptime Koi', where: 'pond', rarity: 'rare', col: '#ffd23f', fin: '#ff8a3a', note: 'Very rare and very lucky. Five nines of uptime means only about five minutes of downtime in a whole year.' },
  { id: 'glow', name: 'Glowfin Gopher', where: 'pond', rarity: 'uncommon', night: true, col: '#5ab4ff', fin: '#c8f0ff', note: 'Only bites after dark, like the jobs that run overnight while everyone sleeps. Someone still has to watch them.' },
  { id: 'boot', name: 'Legacy Boot', where: 'pond', rarity: 'junk', col: '#6b4a2a', fin: '#3a2a1a', note: 'Nobody knows who wrote it or why, but something might still depend on it. Every company has one of these.' },
  { id: 'bass', name: 'Load Balancer Bass', where: 'sea', rarity: 'common', col: '#4a7a9a', fin: '#2f4f6f', note: 'Swims back and forth sharing the work evenly, so no single fish gets tired. A load balancer spreads requests the same way.' },
  { id: 'snapper', name: 'Byte Snapper', where: 'sea', rarity: 'common', col: '#e05a48', fin: '#8a2a1a', note: 'Eight little stripes, like the eight bits in a byte.' },
  { id: 'crab', name: 'Container Crab', where: 'sea', rarity: 'uncommon', col: '#c0392b', fin: '#ffd8c8', note: 'Carries its whole home on its back and settles in anywhere, like an app packed in a container.' },
  { id: 'kraken', name: 'Midnight Kraken', where: 'sea', rarity: 'rare', night: true, col: '#7a4fa0', fin: '#c08aff', note: 'Rises only at night, like the outage that pages you at 3 a.m. You landed it. Have a coffee.' },
  { id: 'can', name: 'Rusty Tin Can', where: 'sea', rarity: 'junk', col: '#9aa0a8', fin: '#6b7078', note: 'Someone left it lying around years ago. Old, forgotten things are where trouble likes to hide.' },
];

export const FISH_IDS = new Set(FISH.map((f) => f.id));

const WEIGHT: Record<Rarity, number> = { junk: 1.2, common: 5, uncommon: 2.4, rare: 0.7 };

/** Which fish bites, given where you're fishing and whether it's night. `r` is a random number in [0, 1). */
export function pickCatch(r: number, where: FishWhere, night: boolean): Fish {
  const pool = FISH.filter((f) => f.where === where && (!f.night || night));
  const total = pool.reduce((s, f) => s + WEIGHT[f.rarity] * (f.night ? 1.6 : 1), 0);
  let x = r * total;
  for (const f of pool) {
    x -= WEIGHT[f.rarity] * (f.night ? 1.6 : 1);
    if (x < 0) return f;
  }
  return pool[pool.length - 1];
}

/** How wide the green "reel" window is (fraction of the bar). Rarer fish are harder to land. */
export function reelWindow(f: Fish): number {
  return { junk: 0.36, common: 0.3, uncommon: 0.22, rare: 0.14 }[f.rarity];
}

/** How fast the reel needle sweeps (bar widths per second). */
export function reelSpeed(f: Fish): number {
  return { junk: 0.7, common: 0.85, uncommon: 1.05, rare: 1.3 }[f.rarity];
}

/** The needle bounces between 0 and 1. */
export function needleAt(t: number, speed: number): number {
  const ph = (t * speed) % 2;
  return ph < 1 ? ph : 2 - ph;
}

/** Is the needle inside the window centred at `centre`? */
export function inWindow(needle: number, centre: number, width: number): boolean {
  return Math.abs(needle - centre) <= width / 2;
}

// ---------------------------------------------------------------- bugs

export type BugKind = 'slug' | 'beetle' | 'roach' | 'moth' | 'firefly';

export interface BugType {
  id: BugKind;
  name: string;
  /** How it moves, said plainly so players learn to catch it. */
  tip: string;
  note: string;
  night?: boolean;
}

export const BUGS: BugType[] = [
  { id: 'slug', name: 'Memory Leak Slug', tip: 'Slow and easy. Follow the shiny trail.', note: 'Leaves a trail that never gets cleaned up. A memory leak does the same: the app keeps a little more each time until it runs out.' },
  { id: 'beetle', name: 'Off-by-one Beetle', tip: 'Always hops exactly one step away. Corner it.', note: 'Always one step from where you expect. Counting from 0 or 1, < or <=: the classic slip of loops everywhere.' },
  { id: 'roach', name: 'Race Condition Roach', tip: 'Darts about, then stops to rest. Swing while it rests.', note: 'Whether you catch it depends on timing. A race condition is a bug that only shows up when two things happen in an unlucky order.' },
  { id: 'moth', name: 'Heisenbug Moth', tip: 'Vanishes while you move. Stand still and let it come.', note: 'Disappears the moment you look for it. Heisenbugs vanish when you add logging or a debugger, which makes them maddening.' },
  { id: 'firefly', name: 'Null Pointer Firefly', tip: 'Only out at night. Catch it while it glows.', note: 'Sometimes there, sometimes nothing at all. Code that forgets "nothing" is possible crashes with a null pointer error.', night: true },
];

export const BUG_IDS = new Set<string>(BUGS.map((b) => b.id));

// ---------------------------------------------------------------- letter run

/** Doors you can be sent to on the Letter Run (every building except the Post office itself). */
export const RUN_DOORS = BUILDINGS.filter((b) => b.id !== 'post').map((b) => ({ id: b.id, label: b.label, ...doorOf(b) }));

/** Letters per run. */
export const RUN_LETTERS = 4;

/** Pick a run's route: `n` different doors, in order. `rand` returns numbers in [0, 1). */
export function pickRoute(rand: () => number, n = RUN_LETTERS): typeof RUN_DOORS {
  const pool = [...RUN_DOORS];
  const out: typeof RUN_DOORS = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

export type Medal = 'gold' | 'silver' | 'bronze';

/** Medal for a finished run, by time in seconds. */
export function medalFor(seconds: number): Medal {
  return seconds <= 38 ? 'gold' : seconds <= 52 ? 'silver' : 'bronze';
}

export const MEDAL_ICON: Record<Medal, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };

/** Format seconds as 0:42.3 */
export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
}

// ---------------------------------------------------------------- fountain wishes

export const WISHES = [
  'May your deploys be boring.',
  'May every alert you get be a real one.',
  'May your on-call week be quiet.',
  'May your backups restore on the first try.',
  'May your logs always say what went wrong.',
  'May Friday afternoons hold no releases.',
  'May your dashboards stay green.',
  'May every rollback be one click away.',
];
