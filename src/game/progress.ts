/**
 * What the browser remembers: which tickets are closed and how cleanly, plus a few settings.
 * Everything read from storage or a pasted save code is treated as untrusted.
 */
import { LEVELS, levelsIn, type DistrictId, type LevelMeta } from '../curriculum/catalog';
import { MAX_NINES, type Nines } from './score';

export interface Settings {
  sound: boolean;
  /** Fewer moving things on screen. Also follows the system "reduce motion" setting. */
  calm: boolean;
}

export interface Progress {
  version: 2;
  solved: Record<string, { nines: Nines }>;
  settings: Settings;
}

export const STORAGE_KEY = 'ninefold.save.v2';
/** Saves from the first version of the game. Read once and carried over; never deleted. */
export const LEGACY_KEY = 'ninefold.save.v1';

export function newProgress(): Progress {
  return { version: 2, solved: {}, settings: { sound: true, calm: false } };
}

/** Start over: every ticket reopens, settings stay. */
export function resetProgress(p: Progress): Progress {
  return { ...newProgress(), settings: { ...p.settings } };
}

/** Close a ticket. Replaying can raise its grade but never lowers it. */
export function closeTicket(p: Progress, levelId: string, nines: Nines): Progress {
  const before = p.solved[levelId]?.nines ?? 0;
  if (before >= nines) return p;
  return { ...p, solved: { ...p.solved, [levelId]: { nines } } };
}

export type LevelStatus = 'done' | 'open' | 'locked';

/** Ticket 1 of each district is open from the start; each later ticket needs the one before it. */
export function levelStatus(p: Progress, l: LevelMeta): LevelStatus {
  if (p.solved[l.id]) return 'done';
  if (l.district === 'big') return bigIncidentBlockers(p, l.act).length === 0 ? 'open' : 'locked';
  if (l.num === 1) return 'open';
  return p.solved[`${l.district}-${l.num - 1}`] ? 'open' : 'locked';
}

/** Big Incident N opens once every district ticket in acts 1..N is closed. Returns what is still open. */
export function bigIncidentBlockers(p: Progress, act: number): LevelMeta[] {
  return LEVELS.filter((l) => l.district !== 'big' && l.act <= act && !p.solved[l.id]);
}

/** The next ticket a district has for you: the first one not closed yet. */
export function nextLevelIn(p: Progress, d: DistrictId): LevelMeta | undefined {
  return levelsIn(d).find((l) => !p.solved[l.id]);
}

/** The ticket to suggest after closing one: next in the district, else any open ticket. */
export function nextOpenAfter(p: Progress, levelId: string): LevelMeta | undefined {
  const cur = LEVELS.find((l) => l.id === levelId);
  const inDistrict = cur ? nextLevelIn(p, cur.district) : undefined;
  if (inDistrict && levelStatus(p, inDistrict) === 'open') return inDistrict;
  return LEVELS.find((l) => levelStatus(p, l) === 'open');
}

export interface DistrictTally {
  done: number;
  total: number;
  nines: number;
  /** A ticket is waiting here. */
  open: boolean;
}

export function districtTally(p: Progress, d: DistrictId): DistrictTally {
  const ls = levelsIn(d);
  return {
    done: ls.filter((l) => p.solved[l.id]).length,
    total: ls.length,
    nines: ls.reduce((n, l) => n + (p.solved[l.id]?.nines ?? 0), 0),
    open: ls.some((l) => levelStatus(p, l) === 'open'),
  };
}

// ---------------------------------------------------------------- the town's nines

export const TOTAL_NINES = LEVELS.length * MAX_NINES;

export function ninesEarned(p: Progress): number {
  return Object.values(p.solved).reduce((n, s) => n + s.nines, 0);
}

/**
 * The town's reliability, counted in nines of uptime. It starts at one nine (90%)
 * and reaches nine nines when every ticket is closed cleanly.
 */
export function townNines(p: Progress): number {
  return 1 + 8 * Math.min(1, ninesEarned(p) / TOTAL_NINES);
}

/** 1 → "90.0%", 3 → "99.9%", 3.5 → "99.97%", 9 → "99.9999999%". Truncated, never rounded up. */
export function uptimeLabel(nines: number): string {
  const n = Math.max(0, Math.min(9, nines));
  const decimals = Math.max(1, Math.ceil(n - 1e-9) - 2);
  const pct = 100 * (1 - 10 ** -n);
  const scale = 10 ** decimals;
  return `${(Math.floor(pct * scale + 1e-6) / scale).toFixed(decimals)}%`;
}

/** Roughly how long a service at this many nines is down in a 30-day month. */
export function downtimePerMonth(nines: number): string {
  const secs = 30 * 24 * 3600 * 10 ** -nines;
  if (secs >= 2 * 86400) return `${Math.round(secs / 86400)} days`;
  if (secs >= 2 * 3600) return `${Math.round(secs / 3600)} hours`;
  if (secs >= 120) return `${Math.round(secs / 60)} minutes`;
  if (secs >= 2) return `${Math.round(secs)} seconds`;
  if (secs >= 0.002) return `${Math.round(secs * 1000)} milliseconds`;
  return 'under 2 milliseconds';
}

// ---------------------------------------------------------------- reading and writing saves

const isNines = (n: unknown): n is Nines => n === 1 || n === 2 || n === 3;
const known = (): Set<string> => new Set(LEVELS.map((l) => l.id));

/** Turn untrusted data into a valid Progress, or undefined. Accepts current saves and first-version saves. */
export function parseProgress(raw: unknown): Progress | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const data = raw as Record<string, unknown>;
  if (data.version === 1) return fromLegacy(data);
  if (data.version !== 2) return undefined;
  const src = data.solved;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return undefined;
  const ids = known();
  const solved: Progress['solved'] = {};
  for (const [id, v] of Object.entries(src as Record<string, unknown>)) {
    const n = (v as { nines?: unknown } | null)?.nines;
    if (ids.has(id) && isNines(n)) solved[id] = { nines: n };
  }
  const st = (data.settings ?? {}) as Record<string, unknown>;
  return { version: 2, solved, settings: { sound: st.sound !== false, calm: st.calm === true } };
}

/** First-version saves graded tickets in Trust (1–6). Six was a clean fix. */
function fromLegacy(data: Record<string, unknown>): Progress | undefined {
  const src = data.completed;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return undefined;
  const ids = known();
  const p = newProgress();
  for (const [id, v] of Object.entries(src as Record<string, unknown>)) {
    const t = (v as { trust?: unknown } | null)?.trust;
    if (!ids.has(id) || typeof t !== 'number' || !Number.isFinite(t)) continue;
    p.solved[id] = { nines: t >= 6 ? 3 : t >= 5 ? 2 : 1 };
  }
  return p;
}

type Reader = Pick<Storage, 'getItem'>;

export function loadProgress(storage: Reader | undefined): Progress {
  for (const key of [STORAGE_KEY, LEGACY_KEY]) {
    try {
      const raw = storage?.getItem(key);
      const p = raw ? parseProgress(JSON.parse(raw)) : undefined;
      if (p) return p;
    } catch {
      // Unreadable save: try the next one, then start fresh.
    }
  }
  return newProgress();
}

/** True when this browser has played before (either version). */
export function hasSave(storage: Reader | undefined): boolean {
  try {
    return !!(storage?.getItem(STORAGE_KEY) || storage?.getItem(LEGACY_KEY));
  } catch {
    return false;
  }
}

export function saveProgress(storage: Pick<Storage, 'setItem'> | undefined, p: Progress): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Private mode or blocked storage: the game still works, it just won't remember.
  }
}

const CODE_PREFIX = 'NF2-';
const LEGACY_PREFIX = 'NF1-';

/** A copy-pasteable save code, so progress can move between browsers and devices. */
export function encodeSave(p: Progress): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 2, solved: p.solved }));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Read a save code back (new or first-version). Whitespace from copy-paste is ignored. */
export function decodeSave(code: string): Progress | undefined {
  const c = code.replace(/\s+/g, '');
  const prefix = [CODE_PREFIX, LEGACY_PREFIX].find((x) => c.startsWith(x));
  if (!prefix) return undefined;
  try {
    const b64 = c.slice(prefix.length).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return parseProgress(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return undefined;
  }
}
