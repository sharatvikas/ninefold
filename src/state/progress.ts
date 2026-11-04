import type { Look } from '../art/characters';
import { LEVELS, levelsIn, type DistrictId, type LevelMeta } from '../levels/catalog';

export interface Avatar {
  name: string;
  look: Look;
}

export interface Progress {
  version: 1;
  trust: number;
  completed: Record<string, { trust: number }>;
  avatar?: Avatar;
}

export const STORAGE_KEY = 'ninefold.save.v1';

export function newProgress(): Progress {
  return { version: 1, trust: 50, completed: {} };
}

/** Start over: every ticket and all Trust are cleared, but the player keeps their avatar. */
export function resetProgress(p: Progress): Progress {
  return { ...newProgress(), ...(p.avatar ? { avatar: p.avatar } : {}) };
}

export const clampTrust = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

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
  return { version: 1, trust: clampTrust(data.trust), completed, ...(avatar ? { avatar } : {}) };
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
