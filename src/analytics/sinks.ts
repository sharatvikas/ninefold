import { timeBucket, type PlayEvent, type Sink } from './analytics';

/** Prints each event to the browser console. Handy with the dev server. */
export function consoleSink(log: (...a: unknown[]) => void = (...a) => console.debug(...a)): Sink {
  return { send: (e) => log('[ninefold]', e.name, e) };
}

// ---------------------------------------------------------------- local debug log

export const LOG_KEY = 'ninefold.analytics.log';
const LOG_MAX = 200;

export interface LoggedEvent {
  at: string;
  event: PlayEvent;
}

type KV = Pick<Storage, 'getItem' | 'setItem'>;

export function readLog(storage: Pick<Storage, 'getItem'> | undefined): LoggedEvent[] {
  try {
    const raw = storage?.getItem(LOG_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as LoggedEvent[]) : [];
  } catch {
    return [];
  }
}

/**
 * Keeps the last 200 events in this browser's localStorage, for checking what would be sent.
 * Nothing here ever leaves the device.
 */
export function localLogSink(storage: KV | undefined, now: () => Date = () => new Date(), onChange?: () => void): Sink {
  return {
    send(event) {
      if (!storage) return;
      const list = readLog(storage);
      list.push({ at: now().toISOString(), event });
      try {
        storage.setItem(LOG_KEY, JSON.stringify(list.slice(-LOG_MAX)));
      } catch {
        // Storage full or blocked: the debug log is best-effort.
      }
      onChange?.();
    },
  };
}

// ---------------------------------------------------------------- GoatCounter

/** A GoatCounter site code is the subdomain of <code>.goatcounter.com. */
export const GOAT_CODE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * GoatCounter counts paths, with no extra properties, so each event becomes a readable path.
 * Reading the dashboard then gives a funnel per ticket:
 *   ticket/harbor-1/open → /start → /cause → /fix → /solved/2-5m
 *   ticket/harbor-1/quit/at-cause, ticket/harbor-1/miss
 * Replays of finished tickets go under replay/… so they don't muddy the first-time funnel.
 */
export function goatPath(e: PlayEvent): string {
  switch (e.name) {
    case 'session_start':
      return e.returning ? 'start/returning' : 'start/new';
    case 'avatar_created':
      return 'avatar/created';
  }
  const root = `${e.replay ? 'replay' : 'ticket'}/${e.level}`;
  switch (e.name) {
    case 'ticket_open':
      return `${root}/open`;
    case 'ticket_start':
      return `${root}/start`;
    case 'ticket_step':
      return `${root}/${e.step}`;
    case 'ticket_miss':
      return `${root}/miss`;
    case 'ticket_solved':
      return `${root}/solved/${timeBucket(e.secs)}`;
    case 'ticket_abandon':
      return `${root}/quit/at-${e.reached}`;
  }
}

/** A short human title shown next to the path in GoatCounter. Coarse on purpose. */
export function goatTitle(e: PlayEvent): string {
  switch (e.name) {
    case 'ticket_solved':
      return `solved in ${timeBucket(e.secs)}, ${e.misses} miss(es), trust ${e.trust}${e.guessedFirst ? ', guessed first' : ''}`;
    case 'ticket_abandon':
      return `${e.how === 'closed_tab' ? 'closed the tab' : 'left'} after ${timeBucket(e.secs)}, ${e.misses} miss(es)`;
    case 'ticket_miss':
      return `miss #${e.misses}`;
    default:
      return e.name.replace(/_/g, ' ');
  }
}

export function goatCounterUrl(code: string, e: PlayEvent, referrerHost = '', rnd = Math.random().toString(36).slice(2, 7)): string {
  const q = new URLSearchParams({ p: goatPath(e), t: goatTitle(e), e: 'true', r: referrerHost, rnd });
  return `https://${code}.goatcounter.com/count?${q}`;
}

/**
 * Sends each event to GoatCounter the same way its own count.js does: a beacon to /count
 * (which survives the tab closing), falling back to an image request. No cookies, no script tag.
 */
export function goatCounterSink(code: string, referrerHost = ''): Sink {
  if (!GOAT_CODE.test(code)) throw new Error(`Not a GoatCounter site code: ${code}`);
  return {
    send(e) {
      const url = goatCounterUrl(code, e, e.name === 'session_start' ? referrerHost : '');
      if (typeof navigator !== 'undefined' && navigator.sendBeacon?.(url)) return;
      if (typeof Image !== 'undefined') new Image().src = url;
    },
  };
}

/** Only the referring site's host (e.g. "www.linkedin.com"), never its full address. */
export function referrerHost(referrer: string, ownHost: string): string {
  try {
    const host = new URL(referrer).hostname;
    return host && host !== ownHost ? host : '';
  } catch {
    return '';
  }
}
