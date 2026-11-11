/**
 * How a closed ticket is graded. The grade is counted in "nines", like uptime:
 * three nines for a clean fix, one fewer for each kind of misstep, never fewer than one.
 */

export interface Attempts {
  /** Changes that didn't fix the problem, or made it worse. */
  failedChanges: number;
  /** Changed something before finding any evidence. */
  guessedFirst: boolean;
  /** Fixed it, but with far more than was needed. */
  wasteful: boolean;
}

export type Nines = 1 | 2 | 3;
export const MAX_NINES: Nines = 3;

export function newAttempts(): Attempts {
  return { failedChanges: 0, guessedFirst: false, wasteful: false };
}

export function missteps(a: Attempts): number {
  return a.failedChanges + (a.guessedFirst ? 1 : 0) + (a.wasteful ? 1 : 0);
}

export function ninesFor(a: Attempts): Nines {
  const m = missteps(a);
  return m === 0 ? 3 : m === 1 ? 2 : 1;
}

/** The old 1–6 Trust figure, still reported to play tracking so old and new numbers compare. */
export function trustFor(a: Attempts): number {
  return Math.max(1, 6 - missteps(a));
}

/** Plain-language reasons a ticket fell short of three nines, for the recap. */
export function lessons(a: Attempts): string[] {
  const out: string[] = [];
  if (a.guessedFirst) out.push('You changed something before finding evidence. In production, a guess is an untested change during an outage.');
  if (a.failedChanges === 1) out.push('One change didn\'t fix it. Every failed change is more downtime, and one more thing to rule out afterwards.');
  if (a.failedChanges > 1) out.push(`${a.failedChanges} changes didn't fix it. Every failed change is more downtime, and one more thing to rule out afterwards.`);
  if (a.wasteful) out.push('The fix worked but was far bigger than needed. Oversized fixes cost money every month, long after the incident.');
  return out;
}
