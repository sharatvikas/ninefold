import { describe, expect, it } from 'vitest';
import { LEVELS } from '../catalog';
import { applySnippet, passed, type LevelSpec } from '../spec';
import { newTermState, run, runnableIn } from '../terminal';
import { ALL_SPECS } from './index';
import { VIGNETTES } from './vignettes';

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

  it('has its own scene diagram', () => {
    expect(VIGNETTES[spec.id]).toBeDefined();
  });

  it('explains its real-world code with comments, for players new to code', () => {
    const state = spec.type === 'config' ? structuredClone(spec.solution) : (() => { const t = newTermState(spec.term); spec.solve(t); return t; })();
    const real = typeof spec.recap.real === 'function' ? (spec.recap.real as (s: unknown) => string)(state) : spec.recap.real;
    expect(real).toMatch(/(^|\s)(#|\/\/|--|;|<!--)\s/m);
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
    it('has handbook commands a player can click to run', () => {
      const docs = spec.evidence.filter((e) => e.kind === 'doc');
      for (const d of docs) if (d.kind === 'doc' && d.label === 'HANDBOOK') expect(d.text.split('\n').some((l) => runnableIn(spec.term, l)), d.id).toBe(true);
    });
    it('only lists handbook steps that really run', () => {
      // A step's command line is indented 3 spaces; indented guidance ends in ":" or a word and "." (not " ." as in grep … .).
      for (const d of spec.evidence) {
        if (d.kind !== 'doc' || d.label !== 'HANDBOOK') continue;
        const lines = d.text.split('\n');
        const steps = lines.filter((l) => /^ {3}\S/.test(l) && !/(:|\S\.)$/.test(l.trim()));
        expect(steps.filter((l) => !runnableIn(spec.term, l))).toEqual([]);
        // and nothing else in the handbook turns into a button by accident
        expect(lines.filter((l) => !/^ {3}\S/.test(l) && runnableIn(spec.term, l))).toEqual([]);
      }
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
  it('has a spec or bespoke scene for every catalog level', () => {
    const bespoke = ['harbor-1', 'post-1'];
    const ids = new Set([...ALL_SPECS.map((s) => s.id), ...bespoke]);
    expect(LEVELS.filter((l) => !ids.has(l.id)).map((l) => l.id)).toEqual([]);
  });
});

describe('harbor-5 one-line limit', () => {
  it('is solved by kubectl set resources, without editing YAML', async () => {
    const spec = ALL_SPECS.find((s) => s.id === 'harbor-5');
    if (spec?.type !== 'terminal') throw new Error('harbor-5 should be a terminal level');
    const s = newTermState(spec.term);
    expect(passed(spec.check(s))).toBe(false);
    run(spec.term, s, 'kubectl set resources deploy batch-report --limits=cpu=500m');
    expect(passed(spec.check(s))).toBe(true);
    run(spec.term, s, 'kubectl set resources deploy batch-report --limits=cpu=2');
    expect(passed(spec.check(s))).toBe(false);
  });
});

describe('harbor-6 one-line env', () => {
  it('is solved by kubectl set env with the right database, not any value', () => {
    const spec = ALL_SPECS.find((s) => s.id === 'harbor-6');
    if (spec?.type !== 'terminal') throw new Error('harbor-6 should be a terminal level');
    const s = newTermState(spec.term);
    run(spec.term, s, 'kubectl set env deploy/bakery-app DB_HOST=localhost');
    const wrong = spec.check(s);
    expect(passed(wrong)).toBe(false);
    expect(wrong.hint).toMatch(/config-notes/);
    run(spec.term, s, 'kubectl set env deploy/bakery-app DB_HOST=granary-db.town');
    expect(passed(spec.check(s))).toBe(true);
  });
});

describe('editor insert buttons', () => {
  const terminal = ALL_SPECS.filter((s) => s.type === 'terminal');
  const clickAll = (id: string, order?: number[]) => {
    const spec = ALL_SPECS.find((s) => s.id === id);
    if (spec?.type !== 'terminal' || !spec.snippets) throw new Error(`${id} has no snippets`);
    const s = newTermState(spec.term);
    for (const [path, list] of Object.entries(spec.snippets)) for (const i of order ?? list.map((_, k) => k)) s.files[path] = applySnippet(s.files[path], list[i]).text;
    return { spec, s };
  };

  it('always find their spot in the starting file', () => {
    for (const spec of terminal) {
      if (spec.type !== 'terminal') continue;
      for (const [path, list] of Object.entries(spec.snippets ?? {}))
        for (const sn of list) expect(spec.term.files[path].includes(sn.replace ?? sn.after ?? ''), `${spec.id} ${sn.label}`).toBe(true);
    }
  });

  it('turn every house into a module (arch-5)', () => {
    const { spec, s } = clickAll('arch-5');
    expect(spec.check(s).cases.filter((c) => !c.pass)).toEqual([]);
  });

  it('instrument the app, which then works after npm start (watch-5)', () => {
    const { spec, s } = clickAll('watch-5');
    run(spec.term, s, 'npm start');
    expect(spec.check(s).cases.filter((c) => !c.pass)).toEqual([]);
  });

  it('fill each dashboard panel, and the wrong order fails (watch-6)', () => {
    const right = clickAll('watch-6');
    run(right.spec.term, right.s, 'dashboard load');
    expect(right.spec.check(right.s).cases.filter((c) => !c.pass)).toEqual([]);
    const wrong = clickAll('watch-6', [1, 0]);
    run(wrong.spec.term, wrong.s, 'dashboard load');
    expect(passed(wrong.spec.check(wrong.s))).toBe(false);
  });
});
