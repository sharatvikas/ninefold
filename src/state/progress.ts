import type { Look } from '../art/characters';
import { LEVELS, levelsIn, type DistrictId, type LevelMeta } from '../levels/catalog';
import { CURIO_IDS } from '../world/curios';
import { BUG_IDS, FISH_IDS } from '../world/pastimes';

export interface Avatar {
  name: string;
  look: Look;
}

export interface Progress {
  version: 1;
  trust: number;
  completed: Record<string, { trust: number }>;
  avatar?: Avatar;
  /** Curios found around town (side quest). */
  found?: string[];
  /** Fish landed, by kind: how many of each. */
  fish?: Record<string, number>;
  /** Bugs caught in the meadow, by kind: how many of each. */
  bugs?: Record<string, number>;
  /** Best Letter Run time, in seconds. */
  runBest?: number;
}

export const STORAGE_KEY = 'ninefold.save.v1';

export function newProgress(): Progress {
  return { version: 1, trust: 50, completed: {} };
}

/**
 * Start over: every ticket and all Trust are cleared, but the player keeps their avatar
 * and their pastime collections (fish, bugs and Letter Run best), which aren't tickets.
 */
export function resetProgress(p: Progress): Progress {
  return {
    ...newProgress(),
    ...(p.avatar ? { avatar: p.avatar } : {}),
    ...(p.fish ? { fish: p.fish } : {}),
    ...(p.bugs ? { bugs: p.bugs } : {}),
    ...(p.runBest !== undefined ? { runBest: p.runBest } : {}),
  };
}

export const clampTrust = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** Record a curio found around town. Finding one twice changes nothing. */
export function findCurio(p: Progress, id: string): Progress {
  return p.found?.includes(id) ? p : { ...p, found: [...(p.found ?? []), id] };
}

/** Add one to a pastime tally (fish or bugs). */
export function tally(p: Progress, key: 'fish' | 'bugs', id: string): Progress {
  const cur = p[key] ?? {};
  return { ...p, [key]: { ...cur, [id]: (cur[id] ?? 0) + 1 } };
}

/** Record a Letter Run time. Only a faster time replaces the best. */
export function recordRun(p: Progress, seconds: number): Progress {
  const s = Math.round(seconds * 10) / 10;
  return p.runBest !== undefined && p.runBest <= s ? p : { ...p, runBest: s };
}

/** Record a finished level. Replaying a level never earns its Trust twice. */
export function completeLevel(p: Progress, levelId: string, trustDelta: number): Progress {
  const already = p.completed[levelId];
  const gain = already ? 0 : trustDelta;
  return {
    ...p,
    trust: clampTrust(p.trust + gain),
    completed: { ...p.completed, [levelId]: { trust: already ? already.trust : trustDelta } },
  };
}

export type LevelStatus = 'done' | 'available' | 'locked' | 'soon';

/** Level 1 of each district is open from the start; each later level needs the previous one. */
export function levelStatus(p: Progress, l: LevelMeta): LevelStatus {
  if (p.completed[l.id]) return 'done';
  if (!l.built) return 'soon';
  if (l.district === 'big') return bigIncidentBlockers(p, l.act).length === 0 ? 'available' : 'locked';
  if (l.num === 1) return 'available';
  return p.completed[`${l.district}-${l.num - 1}`] ? 'available' : 'locked';
}

/** Big Incident N unlocks once every district ticket in acts 1..N is closed. Returns what's still open. */
export function bigIncidentBlockers(p: Progress, act: number): LevelMeta[] {
  return LEVELS.filter((l) => l.district !== 'big' && l.act <= act && !p.completed[l.id]);
}

/** The next ticket a district's NPC should offer (first not-done level), or undefined if all done. */
export function nextLevelIn(p: Progress, d: DistrictId): LevelMeta | undefined {
  return levelsIn(d).find((l) => !p.completed[l.id]);
}

export function loadProgress(storage: Pick<Storage, 'getItem'> | undefined): Progress {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return newProgress();
    return parseProgress(JSON.parse(raw)) ?? newProgress();
  } catch {
    return newProgress();
  }
}

/** Turn untrusted data (storage or a pasted save code) into a valid Progress, or undefined. */
export function parseProgress(raw: unknown): Progress | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Partial<Progress>;
  if (data.version !== 1 || typeof data.trust !== 'number' || !Number.isFinite(data.trust)) return undefined;
  if (typeof data.completed !== 'object' || !data.completed || Array.isArray(data.completed)) return undefined;
  const known = new Set(LEVELS.map((l) => l.id));
  const completed: Progress['completed'] = {};
  for (const [id, v] of Object.entries(data.completed)) {
    const t = (v as { trust?: unknown } | null)?.trust;
    if (known.has(id) && typeof t === 'number' && Number.isFinite(t)) completed[id] = { trust: Math.round(t) };
  }
  const avatar = validAvatar(data.avatar);
  const found = Array.isArray(data.found) ? [...new Set(data.found.filter((id): id is string => typeof id === 'string' && CURIO_IDS.has(id)))] : [];
  const fish = validTally(data.fish, FISH_IDS);
  const bugs = validTally(data.bugs, BUG_IDS);
  const runBest = typeof data.runBest === 'number' && Number.isFinite(data.runBest) && data.runBest > 0 && data.runBest < 3600 ? Math.round(data.runBest * 10) / 10 : undefined;
  return {
    version: 1,
    trust: clampTrust(data.trust),
    completed,
    ...(avatar ? { avatar } : {}),
    ...(found.length ? { found } : {}),
    ...(fish ? { fish } : {}),
    ...(bugs ? { bugs } : {}),
    ...(runBest !== undefined ? { runBest } : {}),
  };
}

/** Keep only known ids with sensible whole-number counts. */
function validTally(raw: unknown, known: Set<string>): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(raw as Record<string, unknown>))
    if (known.has(id) && typeof n === 'number' && Number.isFinite(n) && n >= 1) out[id] = Math.min(9999, Math.floor(n));
  return Object.keys(out).length ? out : undefined;
}

const CODE_PREFIX = 'NF1-';

/** A copy-pasteable save code, so progress can move between browsers and devices. */
export function encodeSave(p: Progress): string {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Read a save code back. Whitespace and line breaks from copy-paste are ignored. */
export function decodeSave(code: string): Progress | undefined {
  const c = code.replace(/\s+/g, '');
  if (!c.startsWith(CODE_PREFIX)) return undefined;
  try {
    const b64 = c.slice(CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return parseProgress(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return undefined;
  }
}

export function saveProgress(storage: Pick<Storage, 'setItem'> | undefined, p: Progress): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Private mode or blocked storage: the game still works, it just won't remember.
  }
}

const HAIR_STYLES = ['short', 'long', 'bun', 'curly', 'spiky', 'bald'];
const HATS = ['none', 'cap', 'beanie', 'hardhat', 'chef', 'beret'];
const COLOR = /^#[0-9a-f]{6}$/i;

/** Accept a saved avatar only if every field is something the game can draw. */
export function validAvatar(a: unknown): Avatar | undefined {
  if (!a || typeof a !== 'object') return undefined;
  const { name, look } = a as Partial<Avatar>;
  if (typeof name !== 'string' || !look || typeof look !== 'object') return undefined;
  const l = look as unknown as Record<string, unknown>;
  const colors = ['skin', 'hair', 'hatColor', 'shirt', 'accent', 'pants'];
  if (!colors.every((k) => typeof l[k] === 'string' && COLOR.test(l[k] as string))) return undefined;
  if (!HAIR_STYLES.includes(l.hairStyle as string) || !HATS.includes(l.hat as string)) return undefined;
  return { name: name.trim().slice(0, 16) || 'On-call', look: { ...(look as Look) } };
}
