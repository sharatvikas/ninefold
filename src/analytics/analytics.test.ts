import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, isLocalHost, secsSince, timeBucket, trackingRefused, type PlayEvent } from './analytics';
import { plan, setupAnalytics } from './setup';
import { GOAT_CODE, goatCounterUrl, goatPath, localLogSink, readLog, referrerHost } from './sinks';

const solved: PlayEvent = { name: 'ticket_solved', level: 'harbor-1', replay: false, secs: 200, misses: 1, trust: 5, guessedFirst: false, wasteful: false };

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe('privacy signals', () => {
  it('honours Do Not Track and Global Privacy Control', () => {
    expect(trackingRefused({ doNotTrack: '1' })).toBe(true);
    expect(trackingRefused({ doNotTrack: 'yes' })).toBe(true);
    expect(trackingRefused({ globalPrivacyControl: true })).toBe(true);
    expect(trackingRefused({ doNotTrack: '0', globalPrivacyControl: false })).toBe(false);
    expect(trackingRefused({})).toBe(false);
  });

  it('treats local and private hosts as local', () => {
    for (const h of ['localhost', '127.0.0.1', '192.168.1.20', '10.0.0.4', '172.20.1.1', 'game.localhost']) expect(isLocalHost(h)).toBe(true);
    expect(isLocalHost('anything', 'file:')).toBe(true);
    expect(isLocalHost('sharatvikas.github.io')).toBe(false);
    expect(isLocalHost('172.32.0.1')).toBe(false);
  });
});

describe('what gets turned on', () => {
  const base = { goatCode: 'ninefold', dev: false, hostname: 'sharatvikas.github.io', protocol: 'https:', search: '', privacy: {}, debugFlag: false };

  it('sends to GoatCounter only with a valid code, on the real site, without DNT', () => {
    expect(plan(base)).toEqual({ remote: 'goatcounter', debug: false });
    expect(plan({ ...base, goatCode: '' })).toMatchObject({ remote: 'off', reason: 'no site code' });
    expect(plan({ ...base, goatCode: 'evil.com/x' })).toMatchObject({ remote: 'off', reason: 'bad site code' });
    expect(plan({ ...base, privacy: { globalPrivacyControl: true } })).toMatchObject({ remote: 'off', reason: 'do not track' });
    expect(plan({ ...base, hostname: 'localhost' })).toMatchObject({ remote: 'off', reason: 'local host' });
    expect(plan({ ...base, dev: true })).toMatchObject({ remote: 'off', debug: true });
  });

  it('?analytics=debug turns on the local log and remembers it; ?analytics=off clears it', () => {
    const storage = memoryStorage();
    const input = { ...base, goatCode: '', referrer: '', storage };
    const { analytics, plan: p } = setupAnalytics({ ...input, search: '?analytics=debug' });
    expect(p.debug).toBe(true);
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    analytics.track({ name: 'avatar_created' });
    expect(readLog(storage).map((l) => l.event.name)).toEqual(['avatar_created']);
    expect(setupAnalytics(input).plan.debug).toBe(true);
    expect(setupAnalytics({ ...input, search: '?analytics=off' }).plan.debug).toBe(false);
    expect(readLog(storage)).toEqual([]);
  });
});

describe('events', () => {
  it('a broken sink never breaks the game or the other sinks', () => {
    const got: PlayEvent[] = [];
    const a = createAnalytics([{ send: () => { throw new Error('boom'); } }, { send: (e) => got.push(e) }]);
    expect(() => a.track(solved)).not.toThrow();
    expect(got).toEqual([solved]);
  });

  it('buckets durations coarsely', () => {
    expect(timeBucket(0)).toBe('under-1m');
    expect(timeBucket(59)).toBe('under-1m');
    expect(timeBucket(60)).toBe('1-2m');
    expect(timeBucket(299)).toBe('2-5m');
    expect(timeBucket(3600)).toBe('20m-plus');
    expect(secsSince(5000, 1000)).toBe(0);
    expect(secsSince(0, 61_400)).toBe(61);
  });

  it('keeps only the last 200 events in the local log', () => {
    const storage = memoryStorage();
    const sink = localLogSink(storage, () => new Date(0));
    for (let i = 0; i < 205; i++) sink.send({ name: 'ticket_miss', level: 'post-1', replay: false, misses: i, secs: 1 });
    const log = readLog(storage);
    expect(log).toHaveLength(200);
    expect(log[0].event).toMatchObject({ misses: 5 });
  });
});

describe('GoatCounter adapter', () => {
  it('turns events into a readable per-ticket funnel', () => {
    expect(goatPath({ name: 'session_start', returning: false, solved: 0 })).toBe('start/new');
    expect(goatPath({ name: 'ticket_open', level: 'post-1', replay: false })).toBe('ticket/post-1/open');
    expect(goatPath({ name: 'ticket_step', level: 'post-1', replay: false, step: 'cause', secs: 30 })).toBe('ticket/post-1/cause');
    expect(goatPath(solved)).toBe('ticket/harbor-1/solved/2-5m');
    expect(goatPath({ ...solved, replay: true })).toBe('replay/harbor-1/solved/2-5m');
    expect(
      goatPath({ name: 'ticket_abandon', level: 'rail-2', replay: false, secs: 10, misses: 0, reached: 'intro', how: 'closed_tab' }),
    ).toBe('ticket/rail-2/quit/at-intro');
  });

  it('builds a count URL with only the event, a coarse title and the referring host', () => {
    const url = new URL(goatCounterUrl('ninefold', solved, 'www.linkedin.com', 'abcde'));
    expect(url.origin).toBe('https://ninefold.goatcounter.com');
    expect(url.pathname).toBe('/count');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      p: 'ticket/harbor-1/solved/2-5m',
      t: 'solved in 2-5m, 1 miss(es), trust 5',
      e: 'true',
      r: 'www.linkedin.com',
      rnd: 'abcde',
    });
  });

  it('accepts only plain site codes and only the referrer host', () => {
    expect(GOAT_CODE.test('ninefold')).toBe(true);
    expect(GOAT_CODE.test('Ninefold')).toBe(false);
    expect(GOAT_CODE.test('a.b')).toBe(false);
    expect(referrerHost('https://www.linkedin.com/feed/?trk=abc', 'sharatvikas.github.io')).toBe('www.linkedin.com');
    expect(referrerHost('https://sharatvikas.github.io/ninefold/', 'sharatvikas.github.io')).toBe('');
    expect(referrerHost('', 'x')).toBe('');
  });
});
