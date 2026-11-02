import { LEVELS, levelsIn, type DistrictId, type LevelMeta } from '../levels/catalog';

export interface Progress {
  version: 1;
  trust: number;
  completed: Record<string, { trust: number }>;
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
  if (l.num === 1) return 'available';
  return p.completed[`${l.district}-${l.num - 1}`] ? 'available' : 'locked';
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
    return { version: 1, trust: clampTrust(data.trust), completed };
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
