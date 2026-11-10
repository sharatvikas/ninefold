import { describe, expect, it } from 'vitest';
import { moveBox } from './collision';
import { BUILDINGS, GRID, MAP_H, MAP_W, NPCS, PLAYER_START, buildingAtDoor, doorOf, isSolidTile, residentOf, tileAt } from './townMap';

describe('moveBox', () => {
  const wallAtX10: (x: number, y: number) => boolean = (x) => x >= 10;

  it('moves freely when nothing is in the way', () => {
    expect(moveBox({ x: 0, y: 0, w: 4, h: 4 }, 2, 3, () => false)).toEqual({ x: 2, y: 3, w: 4, h: 4 });
  });

  it('stops at a wall but still slides along the other axis', () => {
    const out = moveBox({ x: 5, y: 0, w: 4, h: 4 }, 3, 2, wallAtX10);
    expect(out.x).toBe(5);
    expect(out.y).toBe(2);
  });
});

describe('town map', () => {
  it('has the declared size', () => {
    expect(GRID.length).toBe(MAP_H);
    GRID.forEach((row) => expect(row.length).toBe(MAP_W));
  });

  it('treats outside the map as solid', () => {
    expect(isSolidTile(-1, 5)).toBe(true);
    expect(isSolidTile(MAP_W, 5)).toBe(true);
  });

  it('starts the player on a walkable tile', () => {
    expect(isSolidTile(PLAYER_START.x, PLAYER_START.y)).toBe(false);
  });

  it('places every NPC on a walkable tile', () => {
    for (const n of NPCS) expect(isSolidTile(n.x, n.y), n.id).toBe(false);
  });

  it('gives every building a path in front of its door', () => {
    for (const b of BUILDINGS) {
      const d = doorOf(b);
      expect(tileAt(d.x, d.y), b.id).toBe('p');
    }
  });

  it('can reach every NPC from the start (flood fill)', () => {
    const seen = new Set<string>();
    const q: [number, number][] = [[PLAYER_START.x, PLAYER_START.y]];
    while (q.length) {
      const [x, y] = q.pop()!;
      const k = `${x},${y}`;
      if (seen.has(k) || isSolidTile(x, y)) continue;
      seen.add(k);
      q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    // Outdoor people are reached where they stand; indoor people through their building's door.
    for (const n of NPCS) {
      const b = n.home ? BUILDINGS.find((x) => x.id === n.home) : undefined;
      const at = b ? doorOf(b) : n;
      expect(seen.has(`${at.x},${at.y}`), n.id).toBe(true);
    }
  });

  it('finds buildings by their door and people by their building', () => {
    for (const b of BUILDINGS) {
      const d = doorOf(b);
      expect(buildingAtDoor(d.x, d.y)?.id).toBe(b.id);
    }
    expect(buildingAtDoor(PLAYER_START.x, PLAYER_START.y)).toBeUndefined();
    expect(residentOf('post')?.id).toBe('rosa');
    expect(residentOf('watch')?.id).toBe('lin');
  });

  it('keeps Finn and Chief Juno outdoors and everyone else at work inside', () => {
    expect(NPCS.filter((n) => !n.home).map((n) => n.id).sort()).toEqual(['finn', 'juno']);
    for (const n of NPCS) if (n.home) expect(BUILDINGS.some((b) => b.id === n.home), n.id).toBe(true);
  });
});
