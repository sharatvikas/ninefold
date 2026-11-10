/**
 * Building interiors. Pure layout data plus helpers, so it can be unit tested.
 *
 * Every room shares one floor plan, 24×13 tiles, filling the screen:
 *
 *   rows 0-3   back wall (each district decorates it differently)
 *   row 4      behind the counter, where the resident stands
 *   row 5      the counter (its ends turn back to the wall, so nobody walks behind it)
 *   rows 6-11  the shop floor, with a few props per district
 *   row 12     front wall, with the door in the middle (cols 11-12)
 */
import { TILE } from './townMap';

export const ROOM_W = 24;
export const ROOM_H = 13;
/** Rooms are 208px tall; this centres them in the 216px view. */
export const ROOM_Y = 4;

export const DOOR_COLS = [11, 12] as const;
export const COUNTER = { x0: 8, x1: 15, y: 5 };

/** Where the resident stands (their feet), in room pixels. */
export const NPC_SPOT = { x: 12 * TILE, y: 4 * TILE + 14 };
/** Where the player appears after walking in (centre of their feet). */
export const SPAWN = { x: 12 * TILE, y: 11 * TILE + 8 };
/** Talking works from the shop floor right in front of the counter. */
export const TALK_RANGE = 44;

export type PropKind =
  | 'pigeonholes'
  | 'parcels'
  | 'mailbag'
  | 'plant'
  | 'bench'
  | 'trolley'
  | 'drafting'
  | 'plans'
  | 'bookshelf'
  | 'telescope'
  | 'stairs'
  | 'crate'
  | 'safe'
  | 'workbench'
  | 'sacks'
  | 'barrels'
  | 'hay'
  | 'bin'
  | 'scale'
  | 'wheelbarrow'
  | 'apples';

/** A solid piece of furniture. x, y, w, h are its footprint in tiles; art may rise above it. */
export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type WallDecor = 'post' | 'rail' | 'arch' | 'hall' | 'watch' | 'lock' | 'granary';

export interface Room {
  /** Same id as the building outside. */
  id: string;
  label: string;
  wall: string;
  stripe: string;
  floor: 'boards' | 'tiles' | 'planks' | 'straw';
  decor: WallDecor;
  props: Prop[];
}

const p = (kind: PropKind, x: number, y: number, w = 1, h = 1): Prop => ({ kind, x, y, w, h });

export const ROOMS: Record<string, Room> = {
  post: {
    id: 'post', label: 'POST OFFICE', wall: '#f0d6a8', stripe: '#e8cc9a', floor: 'tiles', decor: 'post',
    props: [p('pigeonholes', 1, 4, 4, 2), p('parcels', 18, 5, 3, 2), p('mailbag', 3, 9), p('mailbag', 4, 10), p('plant', 21, 10)],
  },
  rail: {
    id: 'rail', label: 'RAILYARD', wall: '#d9c7a7', stripe: '#cdb998', floor: 'planks', decor: 'rail',
    props: [p('bench', 2, 8, 4, 1), p('trolley', 18, 8, 3, 1), p('plant', 1, 4), p('crate', 21, 4, 2, 1)],
  },
  arch: {
    id: 'arch', label: 'ARCHITECT', wall: '#e2e6ee', stripe: '#d6dbe6', floor: 'boards', decor: 'arch',
    props: [p('drafting', 2, 7, 4, 2), p('plans', 19, 5, 2, 1), p('bookshelf', 20, 8, 3, 1), p('plant', 1, 10)],
  },
  hall: {
    id: 'hall', label: 'TOWN HALL', wall: '#efe6d2', stripe: '#e4d8c0', floor: 'tiles', decor: 'hall',
    props: [p('bookshelf', 1, 4, 3, 1), p('bookshelf', 20, 4, 3, 1), p('bench', 2, 9, 4, 1), p('bench', 18, 9, 4, 1), p('plant', 6, 4), p('plant', 17, 4)],
  },
  watch: {
    id: 'watch', label: 'WATCHTOWER', wall: '#a88a62', stripe: '#9a7c56', floor: 'planks', decor: 'watch',
    props: [p('stairs', 1, 4, 3, 3), p('telescope', 19, 6, 2, 2), p('crate', 4, 10)],
  },
  lock: {
    id: 'lock', label: 'LOCKSMITH', wall: '#e9d6d6', stripe: '#dec8c8', floor: 'boards', decor: 'lock',
    props: [p('workbench', 2, 8, 4, 1), p('safe', 19, 4, 3, 2), p('plant', 21, 10), p('crate', 1, 4)],
  },
  granary: {
    id: 'granary', label: 'GRANARY', wall: '#b5432b', stripe: '#a33a24', floor: 'straw', decor: 'granary',
    props: [
      p('sacks', 1, 4, 3, 2), p('bin', 5, 4, 2, 2), p('barrels', 19, 4, 3, 2), p('apples', 20, 7, 2, 1),
      p('hay', 2, 9, 3, 1), p('scale', 6, 8), p('wheelbarrow', 15, 10, 2, 1), p('sacks', 19, 9, 2, 1),
    ],
  },
};

/** 'W' wall, 'C' counter, 'P' prop, 'D' doorway, '.' floor. */
function buildGrid(room: Room): string[][] {
  const g: string[][] = Array.from({ length: ROOM_H }, () => Array<string>(ROOM_W).fill('.'));
  for (let y = 0; y < ROOM_H; y++)
    for (let x = 0; x < ROOM_W; x++) {
      if (y < 4 || x === 0 || x === ROOM_W - 1) g[y][x] = 'W';
      else if (y === ROOM_H - 1) g[y][x] = (DOOR_COLS as readonly number[]).includes(x) ? 'D' : 'W';
    }
  for (let x = COUNTER.x0; x <= COUNTER.x1; x++) g[COUNTER.y][x] = 'C';
  g[COUNTER.y - 1][COUNTER.x0] = 'C';
  g[COUNTER.y - 1][COUNTER.x1] = 'C';
  for (const pr of room.props) for (let y = pr.y; y < pr.y + pr.h; y++) for (let x = pr.x; x < pr.x + pr.w; x++) g[y][x] = 'P';
  return g;
}

const grids = new Map<string, string[][]>();

export function roomGrid(room: Room): readonly (readonly string[])[] {
  let g = grids.get(room.id);
  if (!g) grids.set(room.id, (g = buildGrid(room)));
  return g;
}

export function roomTile(room: Room, tx: number, ty: number): string {
  if (tx < 0 || tx >= ROOM_W || ty < 0) return 'W';
  if (ty >= ROOM_H) return 'D'; // below the doorway is the way out
  return roomGrid(room)[ty][tx];
}

/** Solid for walking. The space below the doorway is open, so the player can walk out. */
export function roomSolid(room: Room, tx: number, ty: number): boolean {
  if (ty >= ROOM_H) return !(DOOR_COLS as readonly number[]).includes(tx);
  const t = roomTile(room, tx, ty);
  return t === 'W' || t === 'C' || t === 'P';
}

/** True once the player's feet are past the doorway: time to go back outside. */
export function leftRoom(feetY: number): boolean {
  return feetY > ROOM_H * TILE - 2;
}
