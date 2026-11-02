import { describe, expect, it } from 'vitest';
import { PEAK, START_CONFIG, VERIFY_VOYAGES, WASTEFUL_ABOVE, clampHold, sinks, verdict } from './harbor';
import { CORRECT_WALL, START_WALL, deliver, lookup, parseHouse, wrongEntries } from './post';
import { MAX_TRUST, newAttempts, trustFor } from './score';

describe('harbor sim', () => {
  it('starts broken: the busiest voyage overflows the hold', () => {
    expect(sinks(START_CONFIG, PEAK)).toBe(true);
    expect(VERIFY_VOYAGES).toContain(PEAK);
  });

  it('is fixed once the hold fits the busiest voyage', () => {
    expect(verdict(START_CONFIG, { ...START_CONFIG, hold: PEAK })).toEqual({ kind: 'fixed', wasteful: false, spare: 0 });
    expect(verdict(START_CONFIG, { ...START_CONFIG, hold: 11 })).toMatchObject({ kind: 'fixed', spare: 2 });
  });

  it('still sinks if the hold is bigger but not big enough', () => {
    expect(verdict(START_CONFIG, { ...START_CONFIG, hold: 8 })).toEqual({ kind: 'still-sinking', failedOn: 9 });
  });

  it('flags a hold far bigger than needed as wasteful', () => {
    expect(verdict(START_CONFIG, { ...START_CONFIG, hold: WASTEFUL_ABOVE + 1 })).toMatchObject({ kind: 'fixed', wasteful: true });
  });

  it('treats "give up after sinking" as hiding the problem, not fixing it', () => {
    expect(verdict(START_CONFIG, { ...START_CONFIG, ifSunk: 'give-up' })).toEqual({ kind: 'hidden' });
  });

  it('does not count red herrings or no change as a fix', () => {
    expect(verdict(START_CONFIG, { ...START_CONFIG, crew: 9 })).toMatchObject({ kind: 'still-sinking' });
    expect(verdict(START_CONFIG, START_CONFIG)).toEqual({ kind: 'no-change' });
  });

  it('keeps the hold within sensible bounds', () => {
    expect(clampHold(0)).toBe(1);
    expect(clampHold(99)).toBe(30);
  });
});

describe('post sim', () => {
  it('sends the bakery\'s letters to the butcher at the start', () => {
    expect(lookup(START_WALL, 'Bakery.town')).toBe('7');
    expect(deliver(START_WALL, 'bakery')).toEqual({ name: 'bakery', house: '7', receivedBy: 'butcher', correct: false });
    expect(wrongEntries(START_WALL)).toEqual(['bakery']);
  });

  it('delivers correctly once the wall is right', () => {
    expect(deliver(CORRECT_WALL, ' bakery ').correct).toBe(true);
    expect(wrongEntries(CORRECT_WALL)).toEqual([]);
  });

  it('handles unknown names and messy house numbers', () => {
    expect(deliver(START_WALL, 'florist')).toMatchObject({ house: undefined, correct: false });
    expect(parseHouse('No. 12')).toBe('12');
    expect(parseHouse('012')).toBe('12');
    expect(parseHouse('twelve')).toBeUndefined();
  });
});

describe('score', () => {
  it('gives full trust for a clean, evidence-first fix', () => {
    expect(trustFor(newAttempts())).toBe(MAX_TRUST);
  });

  it('takes trust away for guessing, failed changes and waste, but never below 1', () => {
    expect(trustFor({ failedChanges: 1, guessedFirst: true, wasteful: false })).toBe(MAX_TRUST - 2);
    expect(trustFor({ failedChanges: 9, guessedFirst: true, wasteful: true })).toBe(1);
  });
});
