import { describe, expect, it } from 'vitest';
import { LEVELS } from '../curriculum/catalog';
import { ALL_SPECS } from '../curriculum/content';
import { passed, type LevelSpec } from '../curriculum/spec';
import { applyChange, changedKeys, evidenceTotal, inspect, openCase, runCommand, saveEdit, search, setField, solveByTheBook, stepOf } from './case';
import {
  bigIncidentBlockers, closeTicket, decodeSave, districtTally, downtimePerMonth, encodeSave, hasSave, LEGACY_KEY, levelStatus, loadProgress,
  newProgress, nextOpenAfter, ninesEarned, parseProgress, resetProgress, saveProgress, STORAGE_KEY, TOTAL_NINES, townNines, uptimeLabel,
} from './progress';
import { lessons, newAttempts, ninesFor, trustFor } from './score';

const spec = (id: string): LevelSpec => ALL_SPECS.find((s) => s.id === id)!;
const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('grading', () => {
  it('gives three nines for a clean fix and takes one per misstep, never below one', () => {
    expect(ninesFor(newAttempts())).toBe(3);
    expect(ninesFor({ failedChanges: 1, guessedFirst: false, wasteful: false })).toBe(2);
    expect(ninesFor({ failedChanges: 0, guessedFirst: true, wasteful: false })).toBe(2);
    expect(ninesFor({ failedChanges: 1, guessedFirst: true, wasteful: false })).toBe(1);
    expect(ninesFor({ failedChanges: 9, guessedFirst: true, wasteful: true })).toBe(1);
  });
  it('keeps the old Trust figure for play tracking', () => {
    expect(trustFor(newAttempts())).toBe(6);
    expect(trustFor({ failedChanges: 2, guessedFirst: true, wasteful: false })).toBe(3);
    expect(trustFor({ failedChanges: 40, guessedFirst: true, wasteful: true })).toBe(1);
  });
  it('explains each lost nine', () => {
    expect(lessons(newAttempts())).toEqual([]);
    expect(lessons({ failedChanges: 2, guessedFirst: true, wasteful: true })).toHaveLength(3);
  });
});

describe('a config ticket (Sinking Ships)', () => {
  it('moves through the four steps', () => {
    const c = openCase(spec('harbor-1'));
    expect(stepOf(c)).toBe('understand');
    c.started = true;
    expect(stepOf(c)).toBe('cause');
    expect(inspect(c, 'log', 0)).toMatchObject({ evidence: false, pinned: false });
    expect(stepOf(c)).toBe('cause');
    expect(inspect(c, 'log', 2)).toMatchObject({ evidence: true, pinned: true });
    expect(stepOf(c)).toBe('change');
    setField(c, 'hold', 10);
    expect(changedKeys(c)).toEqual(['hold']);
    const r = applyChange(c);
    expect(r).toMatchObject({ kind: 'solved', nines: 3 });
    expect(stepOf(c)).toBe('verify');
  });

  it('pins a finding only once', () => {
    const c = openCase(spec('harbor-1'));
    expect(inspect(c, 'log', 2)?.pinned).toBe(true);
    expect(inspect(c, 'log', 2)?.pinned).toBe(false);
    expect(c.findings).toHaveLength(1);
    expect(inspect(c, 'nope', 0)).toBeUndefined();
    expect(inspect(c, 'log', 99)).toBeUndefined();
  });

  it('will not run a change that changes nothing', () => {
    const c = openCase(spec('harbor-1'));
    expect(applyChange(c)).toEqual({ kind: 'no-change' });
    setField(c, 'hold', 9);
    setField(c, 'hold', 7);
    expect(applyChange(c)).toEqual({ kind: 'no-change' });
    expect(c.attempts).toEqual(newAttempts());
  });

  it('costs a nine to guess before finding evidence', () => {
    const c = openCase(spec('harbor-1'));
    setField(c, 'hold', 10);
    expect(applyChange(c)).toMatchObject({ kind: 'solved', nines: 2 });
    expect(c.attempts.guessedFirst).toBe(true);
  });

  it('costs a nine per change that did not work, and the ship visibly still sinks', () => {
    const c = openCase(spec('harbor-1'));
    inspect(c, 'log', 2);
    setField(c, 'hold', 8);
    const miss = applyChange(c);
    expect(miss.kind).toBe('failed');
    if (miss.kind === 'failed') {
      expect(miss.verdict.cases.map((x) => x.pass)).toEqual([true, false, true, true]);
      expect(miss.verdict.hint).toMatch(/busiest/);
    }
    setField(c, 'hold', 9);
    expect(applyChange(c)).toMatchObject({ kind: 'solved', nines: 2 });
  });

  it('does not accept hiding the symptom', () => {
    const c = openCase(spec('harbor-1'));
    inspect(c, 'log', 2);
    setField(c, 'ifSunk', 'give-up');
    setField(c, 'hold', 10);
    expect(applyChange(c).kind).toBe('failed');
  });

  it('marks an oversized fix as wasteful', () => {
    const c = openCase(spec('harbor-1'));
    inspect(c, 'log', 2);
    setField(c, 'hold', 30);
    expect(applyChange(c)).toMatchObject({ kind: 'solved', nines: 2 });
    expect(c.attempts.wasteful).toBe(true);
  });

  it('freezes once solved', () => {
    const c = openCase(spec('harbor-1'));
    solveByTheBook(c);
    setField(c, 'hold', 1);
    expect(c.cfg.hold).toBe(10);
    expect(applyChange(c)).toEqual({ kind: 'no-change' });
  });
});

describe('Wrong Address', () => {
  it('fails when a second name is broken while fixing the first', () => {
    const c = openCase(spec('post-1'));
    inspect(c, 'deliveries', 1);
    setField(c, 'bakery', '12');
    setField(c, 'school', '3');
    const r = applyChange(c);
    expect(r.kind).toBe('failed');
    setField(c, 'school', '9');
    expect(applyChange(c).kind).toBe('solved');
  });
});

describe('searching logs', () => {
  const big = spec('big-1');
  it('shows a sample without a query and finds nothing by doing so', () => {
    const c = openCase(big);
    const r = search(c, 'logs', '  ');
    expect(r.found).toBe(false);
    expect(r.hits.length).toBeGreaterThan(0);
  });
  it('pins the telling line when the search is narrow enough', () => {
    const c = openCase(big);
    expect(search(c, 'logs', 'zzz')).toMatchObject({ hits: [], found: false });
    const r = search(c, 'logs', 'seasonal-tart');
    expect(r).toMatchObject({ found: true, pinned: true });
    expect(search(c, 'logs', 'seasonal-tart').pinned).toBe(false);
    expect(c.findings[0].text).toMatch(/menu-svc v5/);
  });
  it('does not count a search that matches nearly everything', () => {
    const c = openCase(big);
    expect(search(c, 'logs', '0').found).toBe(false);
  });
});

describe('a terminal ticket (Traffic Jam)', () => {
  const lb = spec('post-5');
  it('pins evidence from command output and solves through the shell', () => {
    expect(lb.type).toBe('terminal');
    if (lb.type !== 'terminal') return;
    const c = openCase(lb);
    c.started = true;
    let found = false;
    for (const cmd of lb.term.commands) {
      const r = runCommand(c, cmd.usage);
      if (r.kind === 'output' && r.evidence) found = true;
    }
    expect(found).toBe(true);
    expect(c.findings.length).toBeGreaterThan(0);
    const again = openCase(lb);
    expect(solveByTheBook(again).kind).toBe('solved');
  });
  it('opens the editor and saves files', () => {
    const c = openCase(lb);
    const e = runCommand(c, 'edit lb.conf');
    expect(e.kind).toBe('edit');
    expect(saveEdit(c, 'lb.conf', e.kind === 'edit' ? e.content : '')).toBe(false);
    expect(c.changed).toBe(false);
    expect(saveEdit(c, 'lb.conf', '# emptied')).toBe(true);
    expect(c.changed).toBe(true);
    expect(c.attempts.guessedFirst).toBe(true);
    expect(runCommand(c, 'clear')).toEqual({ kind: 'clear' });
  });
});

describe.each(ALL_SPECS.map((s) => [s.id, s] as const))('%s through the case engine', (_id, s) => {
  it('is solved by the book for three nines', () => {
    const c = openCase(s);
    // Find evidence first, the way a careful player would.
    for (const e of s.evidence) {
      const n = e.kind === 'log' ? e.lines.length : e.kind === 'chart' ? e.bars.length : e.kind === 'inspect' ? e.items.length : 0;
      for (let i = 0; i < n; i++) inspect(c, e.id, i);
    }
    if (s.type === 'terminal') for (const cmd of s.term.commands) {
      const probe = openCase(s);
      const r = runCommand(probe, cmd.usage);
      if (r.kind === 'output' && r.evidence && !probe.changed) runCommand(c, cmd.usage);
    }
    for (const e of s.evidence) if (e.kind === 'search') {
      const telling = e.lines.find((l) => e.evidence.test(l))!;
      search(c, e.id, telling.slice(0, 24));
    }
    expect(c.findings.length, 'evidence found').toBeGreaterThan(0);
    expect(c.changed).toBe(false);
    const r = solveByTheBook(c);
    expect(r.kind).toBe('solved');
    if (r.kind === 'solved') {
      expect(passed(r.verdict)).toBe(true);
      expect(r.nines).toBe(3);
    }
    expect(evidenceTotal(s) + (s.type === 'terminal' ? 1 : 0)).toBeGreaterThan(0);
  });
});

describe('progress', () => {
  it('opens ticket 1 everywhere and unlocks in order', () => {
    let p = newProgress();
    const [h1, h2] = LEVELS.filter((l) => l.district === 'harbor');
    expect(levelStatus(p, h1)).toBe('open');
    expect(levelStatus(p, h2)).toBe('locked');
    p = closeTicket(p, h1.id, 2);
    expect(levelStatus(p, h1)).toBe('done');
    expect(levelStatus(p, h2)).toBe('open');
    expect(districtTally(p, 'harbor')).toEqual({ done: 1, total: 6, nines: 2, open: true });
    expect(nextOpenAfter(p, h1.id)?.id).toBe(h2.id);
  });

  it('lets a replay raise a grade but never lower it', () => {
    let p = closeTicket(newProgress(), 'harbor-1', 2);
    expect(closeTicket(p, 'harbor-1', 1)).toBe(p);
    p = closeTicket(p, 'harbor-1', 3);
    expect(p.solved['harbor-1'].nines).toBe(3);
  });

  it('opens each big incident when its act is closed', () => {
    let p = newProgress();
    const big1 = LEVELS.find((l) => l.id === 'big-1')!;
    expect(levelStatus(p, big1)).toBe('locked');
    for (const l of LEVELS) if (l.district !== 'big' && l.act === 1) p = closeTicket(p, l.id, 3);
    expect(bigIncidentBlockers(p, 1)).toEqual([]);
    expect(levelStatus(p, big1)).toBe('open');
    expect(levelStatus(p, LEVELS.find((l) => l.id === 'big-2')!)).toBe('locked');
  });

  it('counts the town in nines', () => {
    let p = newProgress();
    expect(townNines(p)).toBe(1);
    expect(uptimeLabel(townNines(p))).toBe('90.0%');
    for (const l of LEVELS) p = closeTicket(p, l.id, 3);
    expect(ninesEarned(p)).toBe(TOTAL_NINES);
    expect(townNines(p)).toBe(9);
    expect(uptimeLabel(9)).toBe('99.9999999%');
    expect(uptimeLabel(2)).toBe('99.0%');
    expect(uptimeLabel(3)).toBe('99.9%');
    expect(uptimeLabel(3.5)).toBe('99.96%');
    expect(downtimePerMonth(3)).toBe('43 minutes');
    expect(downtimePerMonth(1)).toBe('3 days');
    expect(downtimePerMonth(9)).toBe('3 milliseconds');
  });

  it('survives a round trip through storage and ignores junk', () => {
    const s = memory();
    expect(hasSave(s)).toBe(false);
    const p = closeTicket(newProgress(), 'post-1', 3);
    p.settings.sound = false;
    saveProgress(s, p);
    expect(hasSave(s)).toBe(true);
    expect(loadProgress(s)).toEqual(p);
    expect(loadProgress(memory({ [STORAGE_KEY]: '{not json' }))).toEqual(newProgress());
    expect(loadProgress(undefined)).toEqual(newProgress());
    expect(parseProgress({ version: 2, solved: { 'post-1': { nines: 7 }, 'nope-1': { nines: 3 }, 'rail-1': { nines: 1 } } })?.solved).toEqual({ 'rail-1': { nines: 1 } });
    expect(parseProgress({ version: 3 })).toBeUndefined();
    expect(parseProgress([])).toBeUndefined();
  });

  it('carries a first-version save over', () => {
    const legacy = JSON.stringify({ version: 1, trust: 61, completed: { 'harbor-1': { trust: 6 }, 'post-1': { trust: 5 }, 'rail-1': { trust: 2 }, 'gone-9': { trust: 6 } }, avatar: { name: 'x' } });
    const p = loadProgress(memory({ [LEGACY_KEY]: legacy }));
    expect(p.solved).toEqual({ 'harbor-1': { nines: 3 }, 'post-1': { nines: 2 }, 'rail-1': { nines: 1 } });
    // A newer save wins over the old one.
    const both = memory({ [LEGACY_KEY]: legacy, [STORAGE_KEY]: JSON.stringify(newProgress()) });
    expect(loadProgress(both).solved).toEqual({});
  });

  it('moves between devices with a save code', () => {
    const p = closeTicket(closeTicket(newProgress(), 'post-1', 3), 'lock-1', 1);
    const code = encodeSave(p);
    expect(code.startsWith('NF2-')).toBe(true);
    expect(decodeSave(`  ${code.slice(0, 9)}\n${code.slice(9)} `)?.solved).toEqual(p.solved);
    expect(decodeSave('NF2-!!!')).toBeUndefined();
    expect(decodeSave('hello')).toBeUndefined();
    const old = 'NF1-' + btoa(JSON.stringify({ version: 1, trust: 50, completed: { 'post-1': { trust: 6 } } }));
    expect(decodeSave(old)?.solved).toEqual({ 'post-1': { nines: 3 } });
  });

  it('resets tickets but keeps settings', () => {
    const p = closeTicket(newProgress(), 'post-1', 3);
    p.settings.calm = true;
    expect(resetProgress(p)).toEqual({ version: 2, solved: {}, settings: { sound: true, calm: true } });
  });
});
