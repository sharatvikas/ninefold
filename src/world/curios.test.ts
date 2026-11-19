import { describe, expect, it } from 'vitest';
import { decodeSave, encodeSave, findCurio, newProgress, parseProgress, resetProgress } from '../state/progress';
import { CURIOS, curioAt } from './curios';
import { BUILDINGS, MAP_H, MAP_W, NPCS, PLAYER_START, TILE, doorOf, isSolidTile } from './townMap';

/** Every tile the player can walk to from the start. */
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

describe('curios', () => {
  it('sit on unique tiles the player can reach, clear of doors and townsfolk', () => {
    const open = reachable();
    const taken = new Set([...BUILDINGS.map((b) => `${doorOf(b).x},${doorOf(b).y}`), ...NPCS.map((n) => `${n.x},${n.y}`)]);
    const spots = CURIOS.map((c) => `${c.x},${c.y}`);
    expect(new Set(spots).size).toBe(CURIOS.length);
    expect(new Set(CURIOS.map((c) => c.id)).size).toBe(CURIOS.length);
    for (const s of spots) {
      expect(open.has(s), s).toBe(true);
      expect(taken.has(s), s).toBe(false);
    }
  });

  it('are picked up only when standing on them, and only once', () => {
    const c = CURIOS[0];
    const cx = (c.x + 0.5) * TILE;
    const cy = (c.y + 0.5) * TILE;
    expect(curioAt(cx, cy, [], TILE)?.id).toBe(c.id);
    expect(curioAt(cx + TILE, cy, [], TILE)).toBeUndefined();
    expect(curioAt(cx, cy, [c.id], TILE)).toBeUndefined();
  });

  it('are saved, survive a save code, drop junk, and clear on reset', () => {
    let p = findCurio(findCurio(newProgress(), 'duck'), 'duck');
    expect(p.found).toEqual(['duck']);
    p = findCurio(p, 'moth');
    expect(decodeSave(encodeSave(p))?.found).toEqual(['duck', 'moth']);
    expect(parseProgress({ ...p, found: ['duck', 'nope', 7, 'duck'] })?.found).toEqual(['duck']);
    expect(parseProgress({ ...p, found: 'duck' })?.found).toBeUndefined();
    expect(resetProgress(p).found).toBeUndefined();
  });
});
