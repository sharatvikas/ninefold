import { describe, expect, it } from 'vitest';
import { decodeSave, encodeSave, newProgress, parseProgress, recordRun, resetProgress, tally } from '../state/progress';
import { BUGS, FISH, RUN_DOORS, RUN_LETTERS, formatTime, inWindow, medalFor, needleAt, pickCatch, pickRoute, reelWindow } from './pastimes';
import { BENCH, BUILDINGS, MAP_H, MAP_W, PLAYER_START, POSTBOX, isPondTile, isSolidTile, tileAt } from './townMap';

function reachable(): Set<string> {
  const seen = new Set([`${PLAYER_START.x},${PLAYER_START.y}`]);
  const queue = [[PLAYER_START.x, PLAYER_START.y]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || seen.has(k) || isSolidTile(nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

describe('Lantern Meadow and the town map', () => {
  const open = reachable();

  it('lets you walk to the meadow, its long grass and the jetty', () => {
    for (let y = 17; y <= 23; y++) for (let x = 41; x <= 52; x++) if (tileAt(x, y) === 'G') expect(open.has(`${x},${y}`), `${x},${y}`).toBe(true);
    expect(open.has('47,8'), 'end of the jetty').toBe(true);
    expect(tileAt(47, 8)).toBe('d');
  });

  it('has fishing spots on both the pond and the sea', () => {
    const spots = { pond: 0, sea: 0 };
    for (const k of open) {
      const [x, y] = k.split(',').map(Number);
      if (tileAt(x, y) !== 'd') continue;
      for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (tileAt(x + sx, y + sy) === 'w' && tileAt(x + sx * 2, y + sy * 2) === 'w') spots[isPondTile(x + sx, y + sy) ? 'pond' : 'sea']++;
    }
    expect(spots.pond).toBeGreaterThan(0);
    expect(spots.sea).toBeGreaterThan(0);
  });

  it('puts the postbox and bench beside walkable ground', () => {
    for (const p of [POSTBOX, BENCH]) {
      expect(isSolidTile(p.x, p.y)).toBe(true);
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => open.has(`${p.x + dx},${p.y + dy}`));
      expect(near).toBe(true);
    }
  });

  it('can reach every Letter Run door', () => {
    for (const d of RUN_DOORS) expect(open.has(`${d.x},${d.y}`), d.id).toBe(true);
    expect(RUN_DOORS.length).toBe(BUILDINGS.length - 1);
  });
});

describe('fishing', () => {
  it('only lands fish from the right water, and night fish only at night', () => {
    for (let i = 0; i < 200; i++) {
      const r = i / 200;
      const day = pickCatch(r, 'pond', false);
      expect(day.where).toBe('pond');
      expect(day.night).toBeFalsy();
      expect(pickCatch(r, 'sea', true).where).toBe('sea');
    }
    const nightPond = new Set(Array.from({ length: 400 }, (_, i) => pickCatch(i / 400, 'pond', true).id));
    expect(nightPond.has('glow')).toBe(true);
  });

  it('makes rare fish harder to reel in', () => {
    const koi = FISH.find((f) => f.id === 'koi')!;
    const perch = FISH.find((f) => f.id === 'perch')!;
    expect(reelWindow(koi)).toBeLessThan(reelWindow(perch));
  });

  it('bounces the reel needle between 0 and 1', () => {
    for (let t = 0; t < 10; t += 0.07) {
      const n = needleAt(t, 1.1);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
    expect(inWindow(0.5, 0.5, 0.2)).toBe(true);
    expect(inWindow(0.7, 0.5, 0.2)).toBe(false);
  });

  it('has a lesson line for every fish and bug', () => {
    for (const f of FISH) expect(f.note.length).toBeGreaterThan(20);
    for (const b of BUGS) expect(b.note.length + b.tip.length).toBeGreaterThan(30);
  });
});

describe('Letter Run', () => {
  it('picks different doors each time', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 30; i++) {
      const route = pickRoute(rand);
      expect(route.length).toBe(RUN_LETTERS);
      expect(new Set(route.map((d) => d.id)).size).toBe(RUN_LETTERS);
      expect(route.some((d) => d.id === 'post')).toBe(false);
    }
  });

  it('gives medals and formats times', () => {
    expect(medalFor(30)).toBe('gold');
    expect(medalFor(45)).toBe('silver');
    expect(medalFor(80)).toBe('bronze');
    expect(formatTime(42.34)).toBe('0:42.3');
    expect(formatTime(65)).toBe('1:05.0');
  });
});

describe('pastime progress', () => {
  it('counts catches and keeps only the best run', () => {
    let p = tally(tally(newProgress(), 'fish', 'koi'), 'fish', 'koi');
    p = tally(p, 'bugs', 'moth');
    expect(p.fish).toEqual({ koi: 2 });
    expect(p.bugs).toEqual({ moth: 1 });
    p = recordRun(p, 44.44);
    p = recordRun(p, 50);
    expect(p.runBest).toBe(44.4);
  });

  it('survives save codes and a progress reset', () => {
    const p = recordRun(tally(tally(newProgress(), 'fish', 'perch'), 'bugs', 'slug'), 39.9);
    expect(decodeSave(encodeSave(p))).toEqual(p);
    const r = resetProgress(p);
    expect(r.fish).toEqual({ perch: 1 });
    expect(r.bugs).toEqual({ slug: 1 });
    expect(r.runBest).toBe(39.9);
  });

  it('drops unknown or bad entries from untrusted saves', () => {
    const base = JSON.parse(JSON.stringify(newProgress()));
    const p = parseProgress({ ...base, fish: { koi: 3, shark: 2, perch: -1, carp: 'x' }, bugs: { moth: 1e9 }, runBest: -5 })!;
    expect(p.fish).toEqual({ koi: 3 });
    expect(p.bugs).toEqual({ moth: 9999 });
    expect(p.runBest).toBeUndefined();
  });
});
