import { describe, expect, it } from 'vitest';
import { LEVELS } from './catalog';
import { ALL_SPECS } from './content';
import { IN_REAL_LIFE } from './content/inRealLife';
import { GLOSSARY, textOf, wordsIn } from './glossary';

describe('glossary', () => {
  it('has one short, plain entry per term', () => {
    expect(new Set(GLOSSARY.map((w) => w.term)).size).toBe(GLOSSARY.length);
    for (const w of GLOSSARY) expect(w.plain.length, w.term).toBeLessThanOrEqual(130);
  });

  it('finds the words a text uses', () => {
    const terms = wordsIn('kubectl get pods shows the pod is OOMKilled on node-2').map((w) => w.term);
    expect(terms).toEqual(expect.arrayContaining(['pod', 'node', 'OOMKilled', 'kubectl']));
    expect(wordsIn('the bakery sells bread')).toEqual([]);
  });

  it('explains the real-world words of every ticket', () => {
    for (const s of ALL_SPECS) expect(wordsIn(`${textOf(s)} ${IN_REAL_LIFE[s.id]}`).length, s.id).toBeGreaterThanOrEqual(3);
  });
});

describe('in real life', () => {
  it('maps every ticket to the real job', () => {
    expect(LEVELS.filter((l) => !IN_REAL_LIFE[l.id]).map((l) => l.id)).toEqual([]);
    expect(Object.keys(IN_REAL_LIFE).filter((id) => !LEVELS.some((l) => l.id === id))).toEqual([]);
  });
});
