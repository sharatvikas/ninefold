import { describe, expect, it } from 'vitest';
import { DISTRICTS, LEVELS, getLevel, levelsIn } from './catalog';
import { PRESETS } from '../ui/avatar';
import { resetProgress, completeLevel, levelStatus, loadProgress, newProgress, nextLevelIn, saveProgress, STORAGE_KEY } from '../state/progress';

describe('catalog', () => {
  it('has 6 levels for each of the 8 districts plus 3 big incidents', () => {
    expect(LEVELS).toHaveLength(51);
    for (const d of DISTRICTS.filter((d) => d.id !== 'big')) expect(levelsIn(d.id), d.id).toHaveLength(6);
    expect(levelsIn('big')).toHaveLength(3);
  });

  it('has unique ids and splits each district into acts 1,1,2,2,3,3', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    expect(levelsIn('harbor').map((l) => l.act)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('marks every level as built', () => {
    expect(LEVELS.filter((l) => !l.built).map((l) => l.id)).toEqual([]);
  });
});

describe('progress', () => {
  it('opens level 1 everywhere and chains later levels', () => {
    const p = newProgress();
    expect(levelStatus(p, getLevel('harbor-1'))).toBe('available');
    expect(levelStatus(p, getLevel('rail-1'))).toBe('available');
    expect(levelStatus(p, getLevel('rail-2'))).toBe('locked');
    const done = completeLevel(p, 'harbor-1', 5);
    expect(levelStatus(done, getLevel('harbor-1'))).toBe('done');
    expect(nextLevelIn(done, 'harbor')?.id).toBe('harbor-2');
  });

  it('unlocks a Big Incident only when every ticket in its acts is closed', () => {
    let p = newProgress();
    expect(levelStatus(p, getLevel('big-1'))).toBe('locked');
    for (const l of LEVELS.filter((l) => l.district !== 'big' && l.act === 1)) p = completeLevel(p, l.id, 1);
    expect(levelStatus(p, getLevel('big-1'))).toBe('available');
    expect(levelStatus(p, getLevel('big-2'))).toBe('locked');
  });

  it('never awards a level twice and clamps trust', () => {
    let p = completeLevel(newProgress(), 'post-1', 5);
    p = completeLevel(p, 'post-1', 5);
    expect(p.trust).toBe(55);
    expect(completeLevel({ ...newProgress(), trust: 98 }, 'harbor-1', 5).trust).toBe(100);
  });

  it('round-trips through storage and survives junk', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const p = completeLevel(newProgress(), 'harbor-1', 5);
    saveProgress(storage, p);
    expect(loadProgress(storage)).toEqual(p);
    mem.set(STORAGE_KEY, '{not json');
    expect(loadProgress(storage)).toEqual(newProgress());
    mem.set(STORAGE_KEY, JSON.stringify({ version: 1, trust: 70, completed: { 'gone-9': { trust: 1 } } }));
    expect(loadProgress(storage).completed).toEqual({});
  });

  it('resets tickets and trust but keeps the avatar', () => {
    const p = { ...completeLevel(newProgress(), 'harbor-1', 5), avatar: PRESETS[2] };
    const r = resetProgress(p);
    expect(r.completed).toEqual({});
    expect(r.trust).toBe(newProgress().trust);
    expect(r.avatar).toEqual(PRESETS[2]);
    expect(resetProgress(newProgress()).avatar).toBeUndefined();
  });

  it('has six valid presets', () => {
    expect(PRESETS).toHaveLength(6);
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    for (const p of PRESETS) {
      saveProgress(storage, { ...newProgress(), avatar: p });
      expect(loadProgress(storage).avatar, p.name).toEqual(p);
    }
  });

  it('keeps a valid avatar and drops a broken one', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const avatar = { name: 'Sarat', look: { skin: '#f1c27d', hair: '#5a3a22', hairStyle: 'curly' as const, hat: 'beanie' as const, hatColor: '#c0392b', shirt: '#2b6cb0', accent: '#ffffff', pants: '#2d3748' } };
    saveProgress(storage, { ...newProgress(), avatar });
    expect(loadProgress(storage).avatar).toEqual(avatar);
    mem.set(STORAGE_KEY, JSON.stringify({ ...newProgress(), avatar: { name: 'x', look: { ...avatar.look, hat: 'crown' } } }));
    expect(loadProgress(storage).avatar).toBeUndefined();
    mem.set(STORAGE_KEY, JSON.stringify({ ...newProgress(), avatar: { name: 'x', look: { ...avatar.look, skin: 'red;}' } } }));
    expect(loadProgress(storage).avatar).toBeUndefined();
  });
});
