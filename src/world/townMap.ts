/**
 * Ninefold town layout. Pure data plus helpers, so it can be unit tested.
 *
 * Tile codes:
 *   g grass   p path   w water   d dock planks   r rail   T tree   F flowers   B building / solid object
 */
export const TILE = 16;
export const MAP_W = 40;
export const MAP_H = 28;

export type BuildingKind = 'house' | 'station' | 'barn' | 'tower';

export interface Building {
  id: string;
  kind: BuildingKind;
  x: number; // tiles
  y: number;
  w: number;
  h: number;
  label: string;
  roof: string;
  wall: string;
}

export interface NpcSpawn {
  id: string;
  name: string;
  look: string;
  x: number; // tiles
  y: number;
  district: string;
}

export const BUILDINGS: Building[] = [
  { id: 'rail', kind: 'station', x: 4, y: 5, w: 7, h: 4, label: 'RAILYARD', roof: '#946238', wall: '#d9c7a7' },
  { id: 'hall', kind: 'house', x: 17, y: 5, w: 6, h: 5, label: 'TOWN HALL', roof: '#b5523b', wall: '#efe6d2' },
  { id: 'arch', kind: 'house', x: 28, y: 5, w: 6, h: 4, label: 'ARCHITECT', roof: '#2f8f8a', wall: '#e2e6ee' },
  { id: 'post', kind: 'house', x: 10, y: 10, w: 6, h: 4, label: 'POST', roof: '#3b6fb5', wall: '#f0d6a8' },
  { id: 'watch', kind: 'tower', x: 34, y: 9, w: 2, h: 5, label: 'WATCH', roof: '#4a3a2a', wall: '#a88a62' },
  { id: 'lock', kind: 'house', x: 4, y: 19, w: 5, h: 4, label: 'LOCKS', roof: '#7a4fa0', wall: '#e9d6d6' },
  { id: 'granary', kind: 'barn', x: 12, y: 18, w: 6, h: 5, label: 'GRANARY', roof: '#8a3a28', wall: '#b5432b' },
];

export const NPCS: NpcSpawn[] = [
  { id: 'rosa', name: 'Rosa', look: 'rosa', x: 15, y: 14, district: 'post' },
  { id: 'finn', name: 'Finn', look: 'finn', x: 30, y: 19, district: 'harbor' },
  { id: 'ines', name: 'Ines', look: 'ines', x: 9, y: 9, district: 'rail' },
  { id: 'ada', name: 'Ada', look: 'ada', x: 33, y: 9, district: 'arch' },
  { id: 'bo', name: 'Mayor Bo', look: 'bo', x: 22, y: 10, district: 'hall' },
  { id: 'lin', name: 'Lin', look: 'lin', x: 33, y: 14, district: 'watch' },
  { id: 'kit', name: 'Kit', look: 'kit', x: 8, y: 23, district: 'lock' },
  { id: 'gus', name: 'Gus', look: 'gus', x: 18, y: 23, district: 'granary' },
];

export const PLAYER_START = { x: 20, y: 17 };
export const FOUNTAIN = { x: 24, y: 12 }; // tile whose centre holds the fountain (occupies 2x2 from x-1,y-1)
export const CRANE = { x: 37, y: 17 };

function buildGrid(): string[][] {
  const g: string[][] = Array.from({ length: MAP_H }, () => Array<string>(MAP_W).fill('g'));
  const set = (x: number, y: number, t: string) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) g[y][x] = t;
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, t: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
  };

  // Water & harbor (south-east)
  fill(28, 21, 39, 27, 'w');
  fill(27, 19, 37, 20, 'd');
  // Border trees
  fill(0, 0, 39, 1, 'T');
  fill(0, 0, 1, 27, 'T');
  fill(38, 0, 39, 20, 'T');
  fill(0, 26, 27, 27, 'T');
  // Rail line
  fill(2, 2, 37, 3, 'r');
  // Roads
  fill(2, 15, 37, 16, 'p'); // main street
  fill(19, 10, 20, 14, 'p'); // town hall to main street
  fill(19, 17, 20, 24, 'p'); // south road
  fill(2, 24, 26, 24, 'p'); // lower street
  fill(7, 9, 7, 14, 'p'); // railyard
  fill(13, 14, 13, 14, 'p'); // post office
  fill(31, 9, 31, 14, 'p'); // architect
  fill(6, 23, 6, 23, 'p'); // locksmith
  fill(15, 23, 15, 23, 'p'); // granary
  fill(27, 17, 28, 18, 'p'); // to the dock
  // Scattered trees
  for (const [x, y] of [
    [24, 6], [25, 7], [3, 11], [3, 17], [9, 21], [23, 20], [24, 21], [25, 18], [35, 6], [36, 7], [2, 22], [14, 7], [26, 12], [10, 17], [33, 23 - 6],
  ]) set(x, y, 'T');
  // Flowers
  for (const [x, y] of [
    [16, 12], [9, 12], [22, 12], [26, 9], [11, 22], [21, 20], [30, 12], [35, 16 - 2], [5, 13], [24, 23],
  ]) if (g[y][x] === 'g') set(x, y, 'F');
  // Buildings & big objects are solid
  for (const b of BUILDINGS) fill(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, 'B');
  fill(FOUNTAIN.x - 1, FOUNTAIN.y - 1, FOUNTAIN.x, FOUNTAIN.y, 'B');
  fill(33, 19, 36, 19, 'B'); // containers on the dock
  fill(CRANE.x, CRANE.y - 1, CRANE.x, CRANE.y + 3, 'B');
  return g;
}

export const GRID: readonly (readonly string[])[] = buildGrid();

const SOLID = new Set(['w', 'r', 'T', 'B']);

export function tileAt(tx: number, ty: number): string {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 'T';
  return GRID[ty][tx];
}

export function isSolidTile(tx: number, ty: number): boolean {
  return SOLID.has(tileAt(tx, ty));
}

/** Door tile (just below the building's bottom-centre). */
export function doorOf(b: Building): { x: number; y: number } {
  return { x: b.x + Math.floor(b.w / 2), y: b.y + b.h };
}
