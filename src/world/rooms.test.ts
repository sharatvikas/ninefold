import { describe, expect, it } from 'vitest';
import { COUNTER, DOOR_COLS, NPC_SPOT, ROOM_H, ROOM_W, ROOMS, SPAWN, TALK_RANGE, leftRoom, roomGrid, roomSolid } from './rooms';
import { NPCS, TILE } from './townMap';

/** Tiles the player can reach from the spawn point, walking on the room grid. */
function reachable(id: string): Set<string> {
  const room = ROOMS[id];
  const seen = new Set<string>();
  const q: [number, number][] = [[Math.floor(SPAWN.x / TILE), Math.floor(SPAWN.y / TILE)]];
  while (q.length) {
    const [x, y] = q.pop()!;
    const k = `${x},${y}`;
    if (seen.has(k) || y >= ROOM_H || roomSolid(room, x, y)) continue;
    seen.add(k);
    q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

describe('rooms', () => {
  it('has a room for every building someone works in', () => {
    for (const n of NPCS) if (n.home) expect(ROOMS[n.home], n.id).toBeDefined();
  });

  it('has the declared size', () => {
    for (const room of Object.values(ROOMS)) {
      const g = roomGrid(room);
      expect(g.length).toBe(ROOM_H);
      g.forEach((row) => expect(row.length).toBe(ROOM_W));
    }
  });

  for (const id of Object.keys(ROOMS)) {
    describe(id, () => {
      const seen = reachable(id);

      it('starts the player on open floor', () => {
        expect(roomSolid(ROOMS[id], Math.floor(SPAWN.x / TILE), Math.floor(SPAWN.y / TILE))).toBe(false);
      });

      it('lets the player walk from the door to talking range of the counter', () => {
        for (const x of DOOR_COLS) expect(seen.has(`${x},${ROOM_H - 1}`)).toBe(true);
        const talkable = [...seen].some((k) => {
          const [x, y] = k.split(',').map(Number);
          return Math.hypot(x * TILE + 8 - NPC_SPOT.x, y * TILE + 8 - NPC_SPOT.y) < TALK_RANGE;
        });
        expect(talkable).toBe(true);
      });

      it('keeps the player out from behind the counter', () => {
        for (let x = COUNTER.x0 + 1; x < COUNTER.x1; x++) expect(seen.has(`${x},${COUNTER.y - 1}`)).toBe(false);
      });

      it('keeps props inside the walls and out of the walk from the door', () => {
        for (const p of ROOMS[id].props) {
          expect(p.x).toBeGreaterThanOrEqual(1);
          expect(p.x + p.w).toBeLessThanOrEqual(ROOM_W - 1);
          expect(p.y).toBeGreaterThanOrEqual(4);
          expect(p.y + p.h).toBeLessThanOrEqual(ROOM_H - 1);
          // The middle aisle from the door to the counter stays clear.
          const hitsAisle = p.x <= DOOR_COLS[1] && p.x + p.w > DOOR_COLS[0] - 1 && p.y + p.h > COUNTER.y + 1;
          expect(hitsAisle, `${p.kind} at ${p.x},${p.y}`).toBe(false);
        }
      });
    });
  }

  it('opens only the doorway in the front wall', () => {
    const room = ROOMS.post;
    for (let x = 0; x < ROOM_W; x++) expect(roomSolid(room, x, ROOM_H - 1), `col ${x}`).toBe(!(DOOR_COLS as readonly number[]).includes(x));
    for (let x = 0; x < ROOM_W; x++) expect(roomSolid(room, x, ROOM_H), `below, col ${x}`).toBe(!(DOOR_COLS as readonly number[]).includes(x));
  });

  it('knows when the player has walked out', () => {
    expect(leftRoom(SPAWN.y)).toBe(false);
    expect(leftRoom(ROOM_H * TILE)).toBe(true);
  });
});
