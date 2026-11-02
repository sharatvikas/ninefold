/** How a level's Trust reward is worked out. Same rules for every hands-on level. */

export interface Attempts {
  /** Changes that didn't fix the problem (or made it worse). */
  failedChanges: number;
  /** Changed something before finding any evidence. */
  guessedFirst: boolean;
  /** Fixed it, but with a lot more than needed. */
  wasteful: boolean;
}

export const MAX_TRUST = 6;

export function newAttempts(): Attempts {
  return { failedChanges: 0, guessedFirst: false, wasteful: false };
}

export function trustFor(a: Attempts): number {
  const t = MAX_TRUST - a.failedChanges - (a.guessedFirst ? 1 : 0) - (a.wasteful ? 1 : 0);
  return Math.max(1, Math.min(MAX_TRUST, t));
}
