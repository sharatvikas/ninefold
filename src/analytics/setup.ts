import {
  browserPrivacySignals,
  createAnalytics,
  isLocalHost,
  setAnalytics,
  trackingRefused,
  type Analytics,
  type PrivacySignals,
  type Sink,
} from './analytics';
import { consoleSink, GOAT_CODE, goatCounterSink, LOG_KEY, localLogSink, readLog, referrerHost } from './sinks';

export const DEBUG_KEY = 'ninefold.analytics.debug';

export interface SetupInput {
  /** GoatCounter site code from the build (VITE_GOATCOUNTER). Empty means remote tracking is off. */
  goatCode: string;
  dev: boolean;
  hostname: string;
  protocol: string;
  /** location.search, for ?analytics=debug / ?analytics=off */
  search: string;
  referrer: string;
  privacy: PrivacySignals;
  storage: Storage | undefined;
}

export interface SetupPlan {
  remote: 'goatcounter' | 'off';
  /** Why remote tracking is off, for the debug panel. */
  reason?: 'no site code' | 'bad site code' | 'do not track' | 'local host';
  debug: boolean;
}

/** Decide what to turn on. Pure, so the rules can be tested. */
export function plan(i: Omit<SetupInput, 'storage' | 'referrer'> & { debugFlag: boolean }): SetupPlan {
  const debug = i.dev || i.debugFlag;
  if (trackingRefused(i.privacy)) return { remote: 'off', reason: 'do not track', debug };
  if (!i.goatCode) return { remote: 'off', reason: 'no site code', debug };
  if (!GOAT_CODE.test(i.goatCode)) return { remote: 'off', reason: 'bad site code', debug };
  if (i.dev || isLocalHost(i.hostname, i.protocol)) return { remote: 'off', reason: 'local host', debug };
  return { remote: 'goatcounter', debug };
}

/** ?analytics=debug turns the local debug view on (remembered); ?analytics=off turns it off and clears the log. */
function debugFlag(search: string, storage: Storage | undefined): boolean {
  const mode = new URLSearchParams(search).get('analytics');
  try {
    if (mode === 'debug') storage?.setItem(DEBUG_KEY, '1');
    if (mode === 'off') {
      storage?.removeItem(DEBUG_KEY);
      storage?.removeItem(LOG_KEY);
    }
    return storage?.getItem(DEBUG_KEY) === '1';
  } catch {
    return mode === 'debug';
  }
}

export function setupAnalytics(i: SetupInput): { analytics: Analytics; plan: SetupPlan } {
  const p = plan({ ...i, debugFlag: debugFlag(i.search, i.storage) });
  const sinks: Sink[] = [];
  if (p.remote === 'goatcounter') sinks.push(goatCounterSink(i.goatCode, referrerHost(i.referrer, i.hostname)));
  if (p.debug) {
    const panel = debugPanel(i.storage, p);
    sinks.push(consoleSink(), localLogSink(i.storage, undefined, panel.refresh));
  }
  const analytics = createAnalytics(sinks);
  setAnalytics(analytics);
  return { analytics, plan: p };
}

export function setupFromBrowser(): SetupPlan {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  return setupAnalytics({
    goatCode: String(import.meta.env.VITE_GOATCOUNTER ?? '').trim().toLowerCase(),
    dev: import.meta.env.DEV,
    hostname: location.hostname,
    protocol: location.protocol,
    search: location.search,
    referrer: document.referrer,
    privacy: browserPrivacySignals(),
    storage,
  }).plan;
}

/** A small corner panel listing the latest events. Only shown in debug mode. */
function debugPanel(storage: Storage | undefined, p: SetupPlan): { refresh: () => void } {
  if (typeof document === 'undefined') return { refresh: () => {} };
  const el = document.createElement('div');
  el.id = 'analytics-debug';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'position:fixed;left:6px;bottom:6px;z-index:100;max-width:46ch;max-height:40vh;overflow:auto;' +
    'background:rgba(0,0,0,.78);color:#cfe;font:11px/1.35 ui-monospace,monospace;padding:6px 8px;border-radius:4px;' +
    'pointer-events:auto;opacity:.85';
  const head = document.createElement('div');
  head.style.cssText = 'color:#ffd23f;margin-bottom:4px;cursor:pointer';
  head.title = 'Click to collapse';
  const list = document.createElement('div');
  head.addEventListener('click', () => (list.hidden = !list.hidden));
  el.append(head, list);
  document.body.append(el);
  const refresh = () => {
    const log = readLog(storage);
    head.textContent = `ANALYTICS (debug) · remote: ${p.remote}${p.reason ? ` (${p.reason})` : ''} · ${log.length} logged`;
    list.replaceChildren(
      ...log
        .slice(-12)
        .reverse()
        .map(({ at, event }) => {
          const { name, ...rest } = event;
          const row = document.createElement('div');
          row.textContent = `${at.slice(11, 19)} ${name} ${JSON.stringify(rest)}`;
          return row;
        }),
    );
  };
  refresh();
  (window as unknown as Record<string, unknown>).__ninefoldAnalytics = {
    events: () => readLog(storage),
    clear: () => {
      storage?.removeItem(LOG_KEY);
      refresh();
    },
  };
  return { refresh };
}
