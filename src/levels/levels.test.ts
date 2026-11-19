import { describe, expect, it } from 'vitest';
import { applySnippet } from './spec';
import { commentStart } from './incident';
import { explain, newTermState, run, runnableIn } from './terminal';
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

describe('terminal', () => {
  it('treats built-in object names as missing files', () => {
    const spec = { host: 'h', motd: '', files: { 'a.txt': 'hi' }, commands: [] };
    const s = newTermState(spec);
    expect(run(spec, s, 'cat a.txt')).toEqual({ kind: 'output', result: { out: 'hi' } });
    for (const name of ['constructor', 'toString', '__proto__']) {
      expect(run(spec, s, `cat ${name}`)).toEqual({ kind: 'output', result: { out: `cat: ${name}: No such file` } });
      expect(run(spec, s, `edit ${name}`).kind).toBe('output');
    }
  });
});

describe('terminal explanations', () => {
  it('explains level commands from their help text and the built-ins in plain words', () => {
    const spec = { host: 'h', motd: '', files: {}, commands: [{ match: /^rollout abort$/, usage: 'rollout abort', help: 'send everyone back to v2', run: () => ({ out: '' }) }] };
    expect(explain(spec, 'rollout abort')).toBe('send everyone back to v2');
    expect(explain(spec, 'cat notes.txt')).toMatch(/prints a whole file/);
    expect(explain(spec, 'rm -rf /')).toBeUndefined();
  });
});

describe('recap code comments', () => {
  it('dims explanations but never real code', () => {
    const at = (l: string) => l.slice(commentStart(l));
    expect(at('# Preview first:')).toBe('# Preview first:');
    expect(at('-- Ask the database')).toBe('-- Ask the database');
    expect(at('    --role-arn arn:aws:iam::123:role/x \\')).toBe('');
    expect(at('  --lookup-attributes AttributeKey=AccessKeyId')).toBe('');
    expect(at('$ npm run test -- --shard=1/4')).toBe('');
    expect(at('  cpu: 500m    # the most it may use')).toBe('    # the most it may use');
    expect(at('url: "https://a.town/#top"')).toBe('');
  });
});

describe('handbook commands', () => {
  const spec = { host: 'h', motd: '', files: { 'a.yaml': '' }, commands: [{ match: /^kubectl top pods$/, usage: 'kubectl top pods', help: '', run: () => ({ out: '' }) }] };
  it('finds the runnable command in a handbook line', () => {
    expect(runnableIn(spec, 'kubectl top pods: CPU per pod')).toBe('kubectl top pods');
    expect(runnableIn(spec, '   kubectl top pods')).toBe('kubectl top pods');
    expect(runnableIn(spec, '2. edit a.yaml')).toBe('edit a.yaml');
    expect(runnableIn(spec, 'kubectl top pods (last resort)')).toBe('kubectl top pods');
    expect(runnableIn(spec, 'edit missing.yaml')).toBeUndefined();
    expect(runnableIn(spec, 'Limits look like:')).toBeUndefined();
  });
});

describe('editor snippets', () => {
  it('only write into their own spot, once', () => {
    expect(applySnippet('a\nOLD\nc', { label: '', text: 'NEW', replace: 'OLD' })?.text).toBe('a\nNEW\nc');
    expect(applySnippet('a\n// here\nc', { label: '', text: '  x();', after: '// here' })?.text).toBe('a\n// here\n  x();\nc');
    // spot gone (already used, or the player rewrote it): nothing happens
    expect(applySnippet('abc', { label: '', text: 'X', replace: 'zzz' })).toBeUndefined();
    // already there: no duplicate
    expect(applySnippet('a\n// here\n  x();\nc', { label: '', text: '  x();', after: '// here' })).toBeUndefined();
  });
});
