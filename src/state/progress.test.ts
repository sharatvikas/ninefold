import { describe, expect, it } from 'vitest';
import { PRESETS } from '../ui/avatar';
import { completeLevel, decodeSave, encodeSave, newProgress, parseProgress } from './progress';

describe('save codes', () => {
  const p = { ...completeLevel(completeLevel(newProgress(), 'post-1', 6), 'rail-1', 4), avatar: { ...PRESETS[1], name: 'Zoë 🚀' } };

  it('round-trips progress, including a unicode avatar name', () => {
    const code = encodeSave(p);
    expect(code.startsWith('NF1-')).toBe(true);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSave(code)).toEqual(p);
  });

  it('ignores whitespace and line breaks from copy-paste', () => {
    const code = encodeSave(p);
    const messy = `  ${code.slice(0, 20)}\n ${code.slice(20)}  `;
    expect(decodeSave(messy)).toEqual(p);
  });

  it('rejects garbage, wrong prefixes and tampered codes', () => {
    expect(decodeSave('')).toBeUndefined();
    expect(decodeSave('hello')).toBeUndefined();
    expect(decodeSave('NF1-!!!!')).toBeUndefined();
    expect(decodeSave(encodeSave(p).replace('NF1-', 'NF2-'))).toBeUndefined();
    expect(decodeSave('NF1-' + btoa('{"version":2}'))).toBeUndefined();
  });

  it('drops unknown levels and bad trust values and clamps trust', () => {
    const r = parseProgress({ version: 1, trust: 999, completed: { 'post-1': { trust: 5 }, 'nope-9': { trust: 1 }, 'rail-1': { trust: 'x' } } });
    expect(r).toEqual({ version: 1, trust: 100, completed: { 'post-1': { trust: 5 } } });
    expect(parseProgress({ version: 1, trust: NaN, completed: {} })).toBeUndefined();
    expect(parseProgress({ version: 1, trust: 5, completed: [] })).toBeUndefined();
  });
});
