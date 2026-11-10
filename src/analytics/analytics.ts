/**
 * Privacy-friendly play tracking.
 *
 * What it records: anonymous game moments (a ticket was opened, solved or abandoned, how long it took,
 * how many changes didn't work). What it never records: names, avatars, save codes, IP-derived ids,
 * cookies, or anything that could tell two players apart. Events have no player or session id at all.
 *
 * Where events go is up to the sinks: nowhere (the default), a local debug log, or a privacy-friendly
 * counter such as GoatCounter once a site code is configured at build time.
 */

export type Step = 'intro' | 'understand' | 'cause' | 'fix' | 'verify';

export type PlayEvent =
  /** The game loaded. `returning` is true when this browser already has a save. */
  | { name: 'session_start'; returning: boolean; solved: number }
  /** A new player finished making their character. */
  | { name: 'avatar_created' }
  /** The ticket's intro card was shown. */
  | { name: 'ticket_open'; level: string; replay: boolean }
  /** The player pressed START on the intro card. */
  | { name: 'ticket_start'; level: string; replay: boolean }
  /** The player reached a step: found the cause, or made a change. */
  | { name: 'ticket_step'; level: string; replay: boolean; step: 'cause' | 'fix'; secs: number }
  /** A change didn't fix it (the game shows a hint and takes 1 Trust). */
  | { name: 'ticket_miss'; level: string; replay: boolean; misses: number; secs: number }
  /** Fixed and verified. */
  | {
      name: 'ticket_solved';
      level: string;
      replay: boolean;
      secs: number;
      misses: number;
      trust: number;
      guessedFirst: boolean;
      wasteful: boolean;
    }
  /** The player left a ticket before solving it, by the ✕ / Esc, or by closing the tab. */
  | {
      name: 'ticket_abandon';
      level: string;
      replay: boolean;
      secs: number;
      misses: number;
      reached: Step;
      how: 'left' | 'closed_tab';
    };

export interface Sink {
  send(e: PlayEvent): void;
}

export interface Analytics {
  track(e: PlayEvent): void;
  readonly sinks: readonly Sink[];
}

export function createAnalytics(sinks: Sink[]): Analytics {
  return {
    sinks,
    track(e) {
      for (const s of sinks) {
        try {
          s.send(e);
        } catch {
          // Tracking must never break the game.
        }
      }
    },
  };
}

/** The shared instance. Does nothing until main() calls setAnalytics(). */
let current: Analytics = createAnalytics([]);

export const analytics: Analytics = {
  get sinks() {
    return current.sinks;
  },
  track: (e) => current.track(e),
};

export function setAnalytics(a: Analytics): void {
  current = a;
}

/** What we need to know about the browser to decide whether to track. Passed in so it can be tested. */
export interface PrivacySignals {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}

/** Do Not Track or Global Privacy Control means: send nothing anywhere. */
export function trackingRefused(s: PrivacySignals): boolean {
  return s.globalPrivacyControl === true || s.doNotTrack === '1' || s.doNotTrack === 'yes';
}

export function browserPrivacySignals(): PrivacySignals {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = (typeof window !== 'undefined' ? window : {}) as { doNotTrack?: string };
  return { doNotTrack: nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack ?? null, globalPrivacyControl: nav.globalPrivacyControl };
}

/** Local and private-network hosts never send to a remote counter, so playtesting doesn't pollute the numbers. */
export function isLocalHost(hostname: string, protocol = 'https:'): boolean {
  if (protocol === 'file:') return true;
  return /(^localhost$|\.localhost$|^127\.|^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\.|^0\.0\.0\.0$|^\[?::1\]?$)/.test(hostname);
}

/** Coarse time buckets, so a reported duration can't single anyone out. */
const BUCKETS: [maxSecs: number, label: string][] = [
  [60, 'under-1m'],
  [120, '1-2m'],
  [300, '2-5m'],
  [600, '5-10m'],
  [1200, '10-20m'],
];

export function timeBucket(secs: number): string {
  for (const [max, label] of BUCKETS) if (secs < max) return label;
  return '20m-plus';
}

/** Whole seconds, never negative. */
export function secsSince(startMs: number, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - startMs) / 1000));
}
