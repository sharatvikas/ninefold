/**
 * Harbor 1, "Sinking Ships": pure rules.
 * Each voyage a ship takes on `demand` crates while sailing. If the cargo goes over
 * the hold size it sinks (OOMKilled), and the harbor relaunches it (CrashLoopBackOff).
 */

export type RestartPolicy = 'relaunch' | 'give-up';

export interface ShipConfig {
  hold: number;
  crew: number;
  ifSunk: RestartPolicy;
}

export const START_CONFIG: ShipConfig = { hold: 7, crew: 4, ifSunk: 'relaunch' };
export const HOLD_MIN = 1;
export const HOLD_MAX = 30;

/** Peak cargo of recent voyages (what the cargo chart shows). */
export const HISTORY = [6, 9, 8, 6, 9, 7, 9, 8];
export const PEAK = Math.max(...HISTORY);
/** Voyages run when you apply a change. Always includes the busiest load. */
export const VERIFY_VOYAGES = [8, 9, 7];
/** Above this, it works but you're paying for a lot of empty hold. */
export const WASTEFUL_ABOVE = PEAK + 5;

export function sinks(cfg: ShipConfig, demand: number): boolean {
  return demand > cfg.hold;
}

export type Verdict =
  | { kind: 'fixed'; wasteful: boolean; spare: number }
  | { kind: 'still-sinking'; failedOn: number }
  | { kind: 'hidden' } // stopped relaunching: no sinking, but no ships either
  | { kind: 'no-change' };

export function verdict(before: ShipConfig, after: ShipConfig): Verdict {
  if (before.hold === after.hold && before.crew === after.crew && before.ifSunk === after.ifSunk) return { kind: 'no-change' };
  const failedOn = VERIFY_VOYAGES.find((d) => sinks(after, d));
  if (failedOn !== undefined) return after.ifSunk === 'give-up' ? { kind: 'hidden' } : { kind: 'still-sinking', failedOn };
  return { kind: 'fixed', wasteful: after.hold > WASTEFUL_ABOVE, spare: after.hold - PEAK };
}

export function clampHold(n: number): number {
  return Math.max(HOLD_MIN, Math.min(HOLD_MAX, Math.round(n)));
}
