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
    const data = JSON.parse(raw) as Partial<Progress>;
    if (data.version !== 1 || typeof data.trust !== 'number' || typeof data.completed !== 'object' || !data.completed) {
      return newProgress();
    }
    const known = new Set(LEVELS.map((l) => l.id));
    const completed = Object.fromEntries(Object.entries(data.completed).filter(([id]) => known.has(id)));
    const avatar = validAvatar(data.avatar);
    return { version: 1, trust: clampTrust(data.trust), completed, ...(avatar ? { avatar } : {}) };
  } catch {
    return newProgress();
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
