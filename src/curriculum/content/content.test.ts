import { describe, expect, it } from 'vitest';
import { LEVELS } from '../catalog';
import { MEANS } from '../glossary';
import { passed, type LevelSpec } from '../spec';
import { newTermState, run } from '../terminal';
import { ALL_SPECS } from './index';

function hasEvidence(spec: LevelSpec): boolean {
  const inEvidence = spec.evidence.some((e) =>
    e.kind === 'log' ? e.lines.some((l) => l.evidence) : e.kind === 'chart' ? e.bars.some((b) => b.evidence) : e.kind === 'inspect' ? e.items.some((i) => i.evidence) : e.kind === 'search' ? e.lines.some((l) => e.evidence.test(l)) : false,
  );
  if (inEvidence) return true;
  if (spec.type !== 'terminal') return false;
  const s = newTermState(spec.term);
  return spec.term.commands.some((cmd) => {
    const o = run(spec.term, s, cmd.usage);
    return o.kind === 'output' && !!o.result.evidence;
  });
}

describe.each(ALL_SPECS.map((s) => [s.id, s] as const))('%s', (_id, spec) => {
  it('is in the catalog', () => {
    expect(LEVELS.some((l) => l.id === spec.id)).toBe(true);
  });

  it('has evidence to find', () => {
    expect(hasEvidence(spec)).toBe(true);
  });

  if (spec.type === 'config') {
    it('starts broken', () => {
      expect(passed(spec.verify(structuredClone(spec.start)))).toBe(false);
    });
    it('is solved by its solution, without waste', () => {
      const v = spec.verify(structuredClone(spec.solution));
      expect(v.cases.filter((c) => !c.pass).map((c) => c.label)).toEqual([]);
      expect(v.wasteful).toBeUndefined();
    });
    it('has a starting value for every field', () => {
      for (const f of spec.fields) expect(spec.start[f.key], f.key).toBeDefined();
    });
  } else {
    it('starts broken', () => {
      expect(passed(spec.check(newTermState(spec.term)))).toBe(false);
    });
    it('is solved by its solution', () => {
      const s = newTermState(spec.term);
      spec.solve(s);
      const v = spec.check(s);
      expect(v.cases.filter((c) => !c.pass).map((c) => c.label)).toEqual([]);
    });
    it('runs every documented command without crashing', () => {
      const s = newTermState(spec.term);
      for (const cmd of spec.term.commands) {
        const o = run(spec.term, s, cmd.usage);
        expect(o.kind, cmd.usage).toBe('output');
      }
    });
  }
});

describe('coverage', () => {
  it('has exactly one spec for every catalog ticket', () => {
    expect(ALL_SPECS.map((s) => s.id).sort()).toEqual(LEVELS.map((l) => l.id).sort());
  });
  it('explains every concept in the runbook', () => {
    expect(LEVELS.filter((l) => !MEANS[l.id]).map((l) => l.id)).toEqual([]);
  });
});
