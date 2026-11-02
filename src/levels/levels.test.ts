import { describe, expect, it } from 'vitest';
import { DISTRICTS, LEVELS, getLevel, levelsIn } from './catalog';
import { newInvestigateState, useTool, REWARD_INVESTIGATED, REWARD_LUCKY, type ToolRule } from './kits/investigate';
import { moveItem, newSortState, sortTrust, type SortPuzzle } from './kits/sort';
import { completeLevel, levelStatus, loadProgress, newProgress, nextLevelIn, saveProgress, STORAGE_KEY } from '../state/progress';

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

  it('marks the two v0.1 levels as built', () => {
    expect(getLevel('harbor-1').built).toBe(true);
    expect(getLevel('post-1').built).toBe(true);
  });
});

describe('investigate kit', () => {
  const tools: ToolRule[] = [
    { id: 'logs', kind: 'investigate' },
    { id: 'rollback', kind: 'fix', resolves: false, penalty: 3 },
    { id: 'limits', kind: 'fix', resolves: true },
    { id: 'trace', kind: 'locked' },
  ];

  it('rewards investigating before fixing', () => {
    let s = newInvestigateState();
    s = useTool(tools, s, 'logs').state;
    const r = useTool(tools, s, 'limits');
    expect(r.outcome).toEqual({ type: 'resolved', trust: REWARD_INVESTIGATED, lucky: false });
    expect(r.state.trust).toBe(REWARD_INVESTIGATED);
  });

  it('gives only a small reward for a lucky guess', () => {
    const r = useTool(tools, newInvestigateState(), 'limits');
    expect(r.outcome).toMatchObject({ type: 'resolved', lucky: true, trust: REWARD_LUCKY });
  });

  it('costs trust for a wrong fix and counts the mistake', () => {
    const r = useTool(tools, newInvestigateState(), 'rollback');
    expect(r.outcome).toEqual({ type: 'wrong', trust: -3 });
    expect(r.state.mistakes).toBe(1);
  });

  it('ignores locked tools and fixes after resolution', () => {
    expect(useTool(tools, newInvestigateState(), 'trace').outcome.type).toBe('locked');
    const done = useTool(tools, newInvestigateState(), 'limits').state;
    expect(useTool(tools, done, 'rollback').outcome.type).toBe('already-resolved');
  });
});

describe('sort kit', () => {
  const p: SortPuzzle = {
    items: ['bakery', 'butcher'],
    slots: ['7', '12'],
    initial: { bakery: '7', butcher: '7' },
    answer: { bakery: '12', butcher: '7' },
  };

  it('starts unsolved and solves when everything matches', () => {
    const s = newSortState(p);
    expect(s.solved).toBe(false);
    const r = moveItem(p, s, 'bakery', '12');
    expect(r.correct).toBe(true);
    expect(r.state.solved).toBe(true);
    expect(sortTrust(r.state)).toBe(5);
  });

  it('counts wrong moves against the reward, never below 1', () => {
    let s = newSortState(p);
    for (let i = 0; i < 6; i++) s = moveItem(p, s, 'butcher', i % 2 ? '7' : '12').state;
    expect(s.wrongMoves).toBe(3);
    expect(sortTrust({ ...s, wrongMoves: 10 })).toBe(1);
  });
});

describe('progress', () => {
  it('opens level 1 everywhere, chains later levels, and shows unbuilt ones as soon', () => {
    const p = newProgress();
    expect(levelStatus(p, getLevel('harbor-1'))).toBe('available');
    expect(levelStatus(p, getLevel('rail-1'))).toBe('soon');
    const done = completeLevel(p, 'harbor-1', 5);
    expect(levelStatus(done, getLevel('harbor-1'))).toBe('done');
    expect(nextLevelIn(done, 'harbor')?.id).toBe('harbor-2');
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
});
