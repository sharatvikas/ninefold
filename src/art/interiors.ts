/**
 * Art for building interiors: the room shell and wall decor (cached), plus props and the counter,
 * which are drawn every frame so people can stand in front of or behind them.
 * All coordinates are room pixels (the room is 384×208, see world/rooms.ts).
 */
import { disc, ellipse, makeCanvas, pixelText, rect, rng, shade, type Ctx } from './pixels';
import { bookshelf, plant, sack, sign } from './scenery';
import { COUNTER, DOOR_COLS, ROOM_H, ROOM_W, type Prop, type Room } from '../world/rooms';

const T = 16;
const OUT = '#2a1e1a';
const W = ROOM_W * T;
const H = ROOM_H * T;
const WALL_H = 4 * T;

// ------------------------------------------------------------------ the static shell

export function roomShell(room: Room): HTMLCanvasElement {
  const [cv, c] = makeCanvas(W, H);
  floor(c, room);
  backWall(c, room);
  DECOR[room.decor](c, room);
  sideWalls(c, room);
  frontWall(c, room);
  return cv;
}

function floor(c: Ctx, room: Room): void {
  const R = rng(room.id.length * 31 + 7);
  const y0 = WALL_H;
  if (room.floor === 'tiles') {
    for (let y = y0; y < H; y += 8)
      for (let x = 0; x < W; x += 8) rect(c, x, y, 8, 8, ((x + y) / 8) % 2 ? '#e8dcc0' : '#d4c4a0');
    for (let y = y0; y < H; y += 8) rect(c, 0, y, W, 0.5, 'rgba(0,0,0,0.08)');
  } else {
    const [base, line, light] =
      room.floor === 'boards' ? ['#9a7448', '#6a4a28', '#b08a58'] : room.floor === 'planks' ? ['#8a6a42', '#5a4024', '#a07a4c'] : ['#a8844c', '#7a5a30', '#c09a5c'];
    rect(c, 0, y0, W, H - y0, base);
    for (let y = y0; y < H; y += 6) {
      rect(c, 0, y, W, 0.5, line);
      rect(c, 0, y + 0.5, W, 0.5, light);
      const off = ((y / 6) % 2) * 20;
      for (let x = off; x < W; x += 40) {
        rect(c, x, y, 0.5, 6, line);
        rect(c, x + 8, y + 2.5, 12 + R() * 10, 0.5, 'rgba(0,0,0,0.07)');
      }
    }
    if (room.floor === 'straw')
      for (let i = 0; i < 260; i++) {
        const x = R() * W;
        const y = y0 + R() * (H - y0);
        rect(c, x, y, 2 + R() * 2, 0.5, R() < 0.5 ? '#e8c860' : '#d8b048');
      }
  }
  // soft shadow where the floor meets the back wall
  rect(c, 0, y0, W, 3, 'rgba(0,0,0,0.12)');
  // a rug from the door to the counter
  const rx = DOOR_COLS[0] * T - 4;
  rect(c, rx - 0.5, 7 * T - 0.5, 2 * T + 9, 4.5 * T + 1, OUT);
  rect(c, rx, 7 * T, 2 * T + 8, 4.5 * T, '#a8443a');
  rect(c, rx + 2, 7 * T + 2, 2 * T + 4, 4.5 * T - 4, '#c0584a');
  for (let y = 7 * T + 6; y < 11.5 * T - 4; y += 8) rect(c, rx + 6, y, 2 * T - 4, 1, '#e8b048');
}

function backWall(c: Ctx, room: Room): void {
  rect(c, 0, 0, W, WALL_H, room.wall);
  for (let x = 0; x < W; x += 12) {
    rect(c, x, 0, 4, WALL_H, room.stripe);
    for (let y = 6; y < WALL_H - 10; y += 10) rect(c, x + 7.5, y, 1, 1, shade(room.wall, -15));
  }
  // crown moulding and skirting board
  rect(c, 0, 0, W, 4, shade(room.wall, -40));
  rect(c, 0, 4, W, 0.5, shade(room.wall, 20));
  rect(c, 0, WALL_H - 6, W, 0.5, shade(room.wall, -30));
  rect(c, 0, WALL_H - 5.5, W, 5.5, '#7a5030');
  rect(c, 0, WALL_H - 5.5, W, 1, '#a07848');
}

/** Left and right walls seen from above: a thick top edge running down the room. */
function sideWalls(c: Ctx, room: Room): void {
  for (const x of [0, W - T]) {
    rect(c, x, 0, T, H, shade(room.wall, -55));
    rect(c, x + (x ? 0 : T - 3), WALL_H - 6, 3, H - WALL_H + 6, shade(room.wall, -20));
    rect(c, x + (x ? 3 : 0), 0, T - 3, H, shade(room.wall, -70));
    for (let y = 6; y < H; y += 10) rect(c, x + (x ? 5 : 2), y, T - 7, 0.5, shade(room.wall, -80));
  }
}

/** Front wall seen from above, with the doorway and a doormat. */
function frontWall(c: Ctx, room: Room): void {
  const y = H - T;
  const d0 = DOOR_COLS[0] * T;
  const d1 = (DOOR_COLS[DOOR_COLS.length - 1] + 1) * T;
  for (const [x0, x1] of [[0, d0], [d1, W]]) {
    rect(c, x0, y, x1 - x0, T, shade(room.wall, -70));
    rect(c, x0, y, x1 - x0, 3, shade(room.wall, -20));
    for (let x = x0 + 4; x < x1; x += 10) rect(c, x, y + 5, 0.5, T - 6, shade(room.wall, -80));
  }
  // door frame posts and threshold
  rect(c, d0 - 2, y - 2, 3, T + 2, '#5a3418');
  rect(c, d1 - 1, y - 2, 3, T + 2, '#5a3418');
  rect(c, d0, y, d1 - d0, T, '#b8a888');
  rect(c, d0, y, d1 - d0, 1, '#d8c8a8');
  // light spilling in from outside
  for (let i = 0; i < 6; i++) rect(c, d0 + 1, y + 4 + i * 2, d1 - d0 - 2, 2, `rgba(255,240,200,${0.08 + i * 0.05})`);
  // doormat
  rect(c, d0 + 3.5, y - 9.5, d1 - d0 - 7, 8, OUT);
  rect(c, d0 + 4, y - 9, d1 - d0 - 8, 7, '#8a6a3a');
  for (let x = d0 + 5; x < d1 - 5; x += 2) rect(c, x, y - 8, 0.5, 5, '#6a4a28');
}

function windowPane(c: Ctx, x: number, y: number, w: number, h: number, night = false): void {
  rect(c, x - 2.5, y - 2.5, w + 5, h + 5, OUT);
  rect(c, x - 2, y - 2, w + 4, h + 4, '#7a5030');
  rect(c, x, y, w, h, night ? '#1d2a4a' : '#8fd0ff');
  if (night) for (const [sx, sy] of [[0.2, 0.3], [0.7, 0.2], [0.5, 0.7], [0.85, 0.6]]) rect(c, x + w * sx, y + h * sy, 1, 1, '#ffffff');
  else {
    rect(c, x, y + h * 0.65, w, h * 0.35, '#bfe6ff');
    rect(c, x + 2, y + 2, 4, 1, '#ffffff');
    rect(c, x + 2, y + 4, 2, 1, '#ffffff');
  }
  rect(c, x + w / 2 - 0.75, y, 1.5, h, '#7a5030');
  rect(c, x, y + h / 2 - 0.75, w, 1.5, '#7a5030');
  rect(c, x - 3, y + h + 2, w + 6, 2, '#8a5a30');
}

function clock(c: Ctx, cx: number, cy: number): void {
  disc(c, cx, cy, 8, OUT);
  disc(c, cx, cy, 7, '#8a5a30');
  disc(c, cx, cy, 6, '#f8f0d8');
  for (let a = 0; a < 12; a += 3) rect(c, cx + Math.cos((a / 12) * Math.PI * 2) * 5 - 0.5, cy + Math.sin((a / 12) * Math.PI * 2) * 5 - 0.5, 1, 1, '#3a2a1a');
  rect(c, cx - 0.5, cy - 4, 1, 4, '#3a2a1a');
  rect(c, cx, cy - 0.5, 3, 1, '#3a2a1a');
}

function frame(c: Ctx, x: number, y: number, w: number, h: number, fill: string): void {
  rect(c, x - 1.5, y - 1.5, w + 3, h + 3, OUT);
  rect(c, x - 1, y - 1, w + 2, h + 2, '#8a5a30');
  rect(c, x, y, w, h, fill);
}

const CX = W / 2;

const DECOR: Record<Room['decor'], (c: Ctx, room: Room) => void> = {
  post(c, room) {
    windowPane(c, 40, 14, 30, 24);
    windowPane(c, W - 70, 14, 30, 24);
    sign(c, CX, 8, room.label);
    clock(c, CX, 34);
    // stamp poster
    frame(c, 92, 14, 22, 28, '#f4f0e6');
    for (let i = 0; i < 4; i++) {
      const sx = 94 + (i % 2) * 10;
      const sy = 17 + Math.floor(i / 2) * 12;
      rect(c, sx, sy, 8, 9, ['#c0392b', '#2b6cb0', '#27ae60', '#e8a030'][i]);
      for (let k = 0; k < 8; k += 2) rect(c, sx + k, sy - 0.5, 1, 0.5, '#f4f0e6');
    }
    // "letters this way" arrow
    frame(c, 270, 18, 30, 12, '#3b6fb5');
    pixelText(c, 'MAIL', 274, 27, '#f8f0d8', 5);
  },
  rail(c, room) {
    sign(c, CX, 6, room.label);
    // departures board
    const bx = 120;
    const bw = 144;
    rect(c, bx - 2.5, 16.5, bw + 5, 34, OUT);
    rect(c, bx - 2, 17, bw + 4, 33, '#5a3418');
    rect(c, bx, 19, bw, 29, '#1d2630');
    pixelText(c, 'DEPARTURES', bx + 4, 26, '#f8d030', 5);
    // Staging always leaves first; prod waits until staging has arrived safely.
    const rows: [string, string, string][] = [['09:00', 'STAGING', 'ON TIME'], ['09:30', 'PROD', 'WAITING']];
    rows.forEach(([tm, to, st], i) => {
      const y = 35 + i * 8;
      pixelText(c, tm, bx + 4, y, '#f8ecd0', 4);
      pixelText(c, to, bx + 32, y, '#f8ecd0', 4);
      pixelText(c, st, bx + 88, y, st === 'ON TIME' ? '#b8f0c8' : '#ffd23f', 4);
    });
    clock(c, 92, 28);
    windowPane(c, W - 80, 14, 34, 24);
    // route map: two lines and their stations
    frame(c, 26, 14, 44, 30, '#f4f0e6');
    for (let i = 0; i < 36; i++) rect(c, 30 + i, 24 + Math.round(Math.sin(i / 6) * 3), 1, 1.5, '#c0392b');
    for (let i = 0; i < 30; i++) rect(c, 34 + i * 0.4, 16 + i * 0.85, 1.5, 1, '#2b6cb0');
    for (const [sx, sy] of [[31, 24], [46, 27], [64, 22], [40, 33]] as const) {
      disc(c, sx, sy, 1.5, OUT);
      disc(c, sx, sy, 1, '#f4f0e6');
    }
  },
  arch(c, room) {
    windowPane(c, 30, 14, 32, 26);
    sign(c, CX, 8, room.label);
    // pinned blueprints
    for (const [px, py, pw] of [[100, 16, 30], [140, 22, 24], [250, 16, 34], [292, 20, 26]] as const) {
      rect(c, px - 0.5, py - 0.5, pw + 1, 23, OUT);
      rect(c, px, py, pw, 22, '#2a5a9a');
      for (let gx = px; gx < px + pw; gx += 4) rect(c, gx, py, 0.5, 22, '#3f70b0');
      rect(c, px + 4, py + 5, pw / 2, 9, '#cfe0f8');
      rect(c, px + 4.5, py + 5.5, pw / 2 - 1, 8, '#2a5a9a');
      rect(c, px + pw / 2 + 6, py + 9, pw / 2 - 9, 1, '#cfe0f8');
      disc(c, px + pw / 2, py + 1, 1, '#c0392b');
    }
    clock(c, 212, 30);
  },
  hall(c, room) {
    windowPane(c, 28, 12, 30, 30);
    windowPane(c, W - 58, 12, 30, 30);
    // town banner with a crest
    rect(c, CX - 22.5, 5.5, 45, 44, OUT);
    rect(c, CX - 22, 6, 44, 40, '#b5523b');
    for (let i = 0; i < 4; i++) rect(c, CX - 22 + i * 11, 46, 11, 3 - (i % 2) * 2, '#b5523b');
    rect(c, CX - 22, 6, 44, 2, '#e8b048');
    disc(c, CX, 26, 11, '#e8b048');
    disc(c, CX, 26, 9, '#f8e0a0');
    // a little house in the crest
    rect(c, CX - 5, 25, 10, 7, '#b5523b');
    for (let j = 0; j < 5; j++) rect(c, CX - 6 + j, 24 - j, 12 - j * 2, 1, '#3b6fb5');
    rect(c, CX - 1, 28, 2, 4, '#f8e0a0');
    sign(c, 100, 10, room.label);
    clock(c, 100, 36);
    // portrait of the founders
    frame(c, 270, 14, 22, 26, '#d8c8a0');
    disc(c, 278, 24, 3, '#e8b48a');
    disc(c, 286, 25, 3, '#c68a5a');
    rect(c, 274, 29, 16, 11, '#5a4a6a');
  },
  watch(c, room) {
    windowPane(c, 30, 12, 46, 32, true);
    sign(c, 300, 14, room.label);
    // a wall of dashboards: the golden signals
    const sx = 120;
    for (let i = 0; i < 4; i++) {
      const x = sx + (i % 2) * 74;
      const y = 15 + Math.floor(i / 2) * 20;
      rect(c, x - 1.5, y - 1.5, 71, 18, OUT);
      rect(c, x - 1, y - 1, 70, 17, '#3a3a4a');
      rect(c, x, y, 68, 15, '#0f1a24');
      pixelText(c, ['LATENCY', 'TRAFFIC', 'ERRORS', 'SATURATION'][i], x + 2, y + 5, '#9fb4c0', 3);
      const col = ['#5ab4ff', '#5ee08a', '#ff6a6a', '#ffd23f'][i];
      const R = rng(i + 3);
      let v = 9;
      for (let k = 0; k < 30; k++) {
        v = Math.max(6, Math.min(13, v + (R() - 0.5) * 3));
        rect(c, x + 3 + k * 2.1, y + v, 2, 1, col);
      }
    }
    // lantern
    rect(c, W - 34, 26, 1, 8, '#3a2a1a');
    rect(c, W - 37, 34, 7, 9, OUT);
    rect(c, W - 36, 35, 5, 7, '#ffe680');
  },
  lock(c, room) {
    sign(c, CX, 8, room.label);
    // key wall
    frame(c, 30, 14, 80, 36, '#7a5030');
    for (let i = 0; i < 10; i++) {
      const x = 36 + (i % 5) * 15;
      const y = 17 + Math.floor(i / 5) * 17;
      const col = ['#f8d030', '#c0c0c0', '#e08838'][i % 3];
      rect(c, x + 3, y, 1.5, 3, '#3a2a1a');
      disc(c, x + 4, y + 5, 2, col);
      rect(c, x + 3.5, y + 7, 1.5, 6, col);
      rect(c, x + 5, y + 10, 1.5, 1, col);
    }
    // round vault door behind the safe
    const vx = W - 52;
    disc(c, vx, 30, 22, OUT);
    disc(c, vx, 30, 21, '#5a5a6a');
    disc(c, vx, 30, 17, '#7a7a8a');
    for (let a = 0; a < 12; a++) disc(c, vx + Math.cos((a / 12) * Math.PI * 2) * 19, 30 + Math.sin((a / 12) * Math.PI * 2) * 19, 0.5, '#3a3a4a');
    disc(c, vx, 30, 5, '#3a3a4a');
    rect(c, vx - 8, 29.5, 16, 1, '#9a9aaa');
    rect(c, vx - 0.5, 22, 1, 16, '#9a9aaa');
    windowPane(c, 250, 16, 26, 22);
  },
  granary(c, room) {
    // plank wall instead of stripes
    rect(c, 0, 4, W, WALL_H - 10, room.wall);
    for (let x = 0; x < W; x += 6) {
      rect(c, x, 4, 0.5, WALL_H - 10, '#8a2f1e');
      rect(c, x + 0.5, 4, 0.5, WALL_H - 10, '#c8553a');
    }
    // knots in the planks
    const R = rng(11);
    for (let i = 0; i < 26; i++) ellipse(c, R() * W, 14 + R() * 38, 1.2, 0.8, '#8a2f1e');
    // posts, a roof beam and corner braces
    for (const x of [24, W - 28]) {
      rect(c, x - 0.5, 4, 5, WALL_H - 9, OUT);
      rect(c, x, 4, 4, WALL_H - 10, '#7a4a24');
      rect(c, x, 4, 1, WALL_H - 10, '#9a6634');
    }
    rect(c, 0, 4, W, 6, OUT);
    rect(c, 0, 4.5, W, 5, '#7a4a24');
    rect(c, 0, 4.5, W, 1, '#9a6634');
    for (const [x, d] of [[28, 1], [W - 28, -1]] as const)
      for (let i = 0; i < 14; i++) rect(c, x + d * i - (d < 0 ? 2 : 0), 10 + i, 2, 1.5, '#7a4a24');
    // hay loft window with hay, and a hoist rope with its hook
    rect(c, CX - 22.5, 11.5, 45, 30, '#f0e0c0');
    rect(c, CX - 20, 14, 40, 25, '#3a2210');
    rect(c, CX - 20, 30, 40, 9, '#e8c860');
    for (let i = 0; i < 18; i++) rect(c, CX - 19 + i * 2.2, 28 + (i % 3), 0.5, 3, '#c8a040');
    disc(c, CX + 30, 12, 2.5, '#5a5a6a');
    rect(c, CX + 30, 12, 0.75, 22, '#c8a868');
    rect(c, CX + 32, 12, 0.75, 14, '#c8a868');
    rect(c, CX + 29, 34, 3, 1, '#7a7a8a');
    rect(c, CX + 31, 35, 1, 2, '#7a7a8a');
    sack(c, CX + 27.5, 36);
    sign(c, 124, 13, room.label);
    // hanging tools
    for (const [x, kind] of [[52, 'rake'], [70, 'fork'], [352, 'scythe']] as const) {
      rect(c, x - 0.5, 12, 1, 1, '#3a2a1a');
      rect(c, x, 13, 1, 30, '#a07848');
      if (kind === 'rake') rect(c, x - 5, 42, 11, 1.5, '#7a7a8a');
      else if (kind === 'fork') for (let k = -3; k <= 3; k += 3) rect(c, x + k, 41, 0.75, 6, '#7a7a8a');
      else for (let k = 0; k < 10; k++) rect(c, x - k, 13 + k * 0.4, 1, 1.5, '#9a9aaa');
    }
    // a lantern on the beam
    rect(c, 152, 10, 0.75, 6, '#3a2a1a');
    rect(c, 149.5, 15.5, 6, 8, OUT);
    rect(c, 150, 16, 5, 7, '#ffe680');
    rect(c, 150, 16, 5, 1, '#c89a30');
    // the stock board: today's count and its two backup copies, all ticked
    frame(c, 268, 16, 52, 30, '#2a3a2e');
    pixelText(c, 'STOCK', 272, 23, '#f4f0e6', 4);
    for (let i = 0; i < 3; i++) {
      const y = 28 + i * 6;
      pixelText(c, ['BARN', 'COPY', 'COPY'][i], 272, y + 3.5, '#cfd8c8', 3);
      for (let k = 0; k < 4; k++) rect(c, 290 + k * 2, y, 0.75, 4, '#f4f0e6');
      rect(c, 289, y + 2, 8, 0.75, '#f4f0e6');
      rect(c, 306, y + 2, 1, 1, '#5ee08a');
      rect(c, 307, y + 3, 1, 1, '#5ee08a');
      for (let k = 0; k < 4; k++) rect(c, 308 + k, y + 2 - k, 1, 1, '#5ee08a');
    }
    rect(c, 272, 45, 8, 1.5, '#f4f0e6');
    windowPane(c, 236, 18, 22, 18);
  },
};

// ------------------------------------------------------------------ the counter

/** The counter, drawn after the resident so it hides their legs. */
export function drawCounter(c: Ctx, room: Room): void {
  const x0 = COUNTER.x0 * T;
  const x1 = (COUNTER.x1 + 1) * T;
  // The top sits low enough that the resident shows from the waist up.
  const top = COUNTER.y * T - 5;
  const wood = room.id === 'granary' ? '#8a5a30' : room.id === 'watch' ? '#6a4a2a' : '#946238';
  // side returns running back to the wall
  for (const x of [x0, x1 - T]) {
    rect(c, x - 0.5, WALL_H - 4.5, T + 1, top - WALL_H + 5, OUT);
    rect(c, x, WALL_H - 4, T, top - WALL_H + 4, shade(wood, 25));
    rect(c, x + 1, WALL_H - 3, T - 2, top - WALL_H + 2, shade(wood, 12));
  }
  // top surface and front face
  const face = 16;
  rect(c, x0 - 0.5, top - 0.5, x1 - x0 + 1, 8 + face + 1, OUT);
  rect(c, x0, top, x1 - x0, 7, shade(wood, 25));
  rect(c, x0, top, x1 - x0, 1, shade(wood, 45));
  rect(c, x0, top + 7, x1 - x0, face + 1, wood);
  rect(c, x0, top + 7, x1 - x0, 1, shade(wood, -35));
  const panels = Math.floor((x1 - x0 - 4) / 16);
  const px0 = x0 + (x1 - x0 - panels * 16 + 4) / 2;
  for (let i = 0; i < panels; i++) {
    const x = px0 + i * 16;
    rect(c, x, top + 10, 12, face - 6, shade(wood, -12));
    rect(c, x + 0.5, top + 10.5, 11, 0.5, shade(wood, 15));
  }
  rect(c, x0, top + 7 + face, x1 - x0, 1, 'rgba(0,0,0,0.25)');
  COUNTER_TOP[room.decor]?.(c, x0, x1, top);
}

/** Small things on the counter, one set per district. */
const COUNTER_TOP: Partial<Record<Room['decor'], (c: Ctx, x0: number, x1: number, top: number) => void>> = {
  post(c, x0, _x1, top) {
    rect(c, x0 + 14, top - 2, 10, 6, '#f4f0e6');
    rect(c, x0 + 15, top - 1, 8, 0.5, '#c0392b');
    rect(c, x0 + 26, top - 1, 8, 5, '#f4f0e6');
    // brass bell
    ellipse(c, x0 + 100, top + 2, 4, 2, '#c89a30');
    disc(c, x0 + 100, top, 1, '#e8c060');
  },
  rail(c, x0, x1, top) {
    rect(c, x0 + 16, top - 1, 14, 5, '#f8f0d8');
    rect(c, x0 + 18, top, 10, 0.5, '#2b6cb0');
    rect(c, x1 - 30, top - 6, 2, 8, '#3a2a1a');
    rect(c, x1 - 33, top - 9, 8, 4, '#c0392b');
  },
  arch(c, x0, _x1, top) {
    rect(c, x0 + 12, top - 1, 30, 7, '#2a5a9a');
    rect(c, x0 + 14, top + 1, 12, 3, '#cfe0f8');
    rect(c, x0 + 60, top - 3, 18, 2, '#c8a060');
  },
  hall(c, x0, _x1, top) {
    rect(c, x0 + 16, top - 1, 14, 6, '#f8f0d8');
    rect(c, x0 + 18, top + 1, 9, 0.5, '#9a8a7a');
    rect(c, x0 + 90, top - 4, 5, 6, '#2a2a3a');
    rect(c, x0 + 92, top - 9, 0.5, 6, '#f4f0e6');
  },
  watch(c, x0, _x1, top) {
    // a little terminal
    rect(c, x0 + 14, top - 10, 22, 14, OUT);
    rect(c, x0 + 15, top - 9, 20, 11, '#0f1a24');
    for (let i = 0; i < 4; i++) rect(c, x0 + 17, top - 7 + i * 2.5, 6 + ((i * 5) % 11), 1, '#5ee08a');
  },
  lock(c, x0, _x1, top) {
    for (let i = 0; i < 3; i++) {
      disc(c, x0 + 20 + i * 12, top + 1, 2, ['#f8d030', '#c0c0c0', '#e08838'][i]);
      rect(c, x0 + 22 + i * 12, top + 0.5, 5, 1, ['#f8d030', '#c0c0c0', '#e08838'][i]);
    }
  },
  granary(c, x0, _x1, top) {
    sack(c, x0 + 14, top - 8);
    rect(c, x0 + 90, top - 2, 10, 5, '#d8b878');
  },
};

// ------------------------------------------------------------------ props

export function drawProp(c: Ctx, pr: Prop): void {
  const x = pr.x * T;
  const y = pr.y * T;
  const w = pr.w * T;
  const h = pr.h * T;
  // contact shadow
  rect(c, x + 1, y + h - 2, w - 2, 3, 'rgba(0,0,0,0.18)');
  PROPS[pr.kind](c, x, y, w, h);
}

/** A box seen from the front and a little above: lid of height `lid`, front face to the footprint's bottom. */
function box(c: Ctx, x: number, y: number, w: number, h: number, lid: number, col: string): void {
  rect(c, x - 0.5, y - 0.5, w + 1, h + 1, OUT);
  rect(c, x, y, w, lid, shade(col, 22));
  rect(c, x, y + lid, w, h - lid, col);
  rect(c, x, y + lid, w, 0.5, shade(col, -35));
}

const PROPS: Record<Prop['kind'], (c: Ctx, x: number, y: number, w: number, h: number) => void> = {
  pigeonholes(c, x, y, w, h) {
    // tall cabinet of mail slots against the wall
    box(c, x + 2, y - 14, w - 4, h + 12, 4, '#7a4f2e');
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 7; k++) {
        const sx = x + 6 + k * 7.6;
        const sy = y - 6 + r * 8;
        rect(c, sx, sy, 6, 6, '#4a2a14');
        if ((r * 7 + k) % 3) rect(c, sx + 0.5, sy + 2, 5, 3.5, (r + k) % 2 ? '#f4f0e6' : '#f8e0b0');
      }
  },
  parcels(c, x, y, w) {
    const cols = ['#c8a060', '#b8904c', '#d8b070'];
    for (const [dx, dy, bw, bh, i] of [[2, 8, 20, 14, 0], [24, 12, 18, 12, 1], [8, -4, 16, 12, 2], [26, 0, 14, 12, 0]] as const) {
      if (dx + bw > w) continue;
      box(c, x + dx, y + dy, bw, bh, 3, cols[i]);
      rect(c, x + dx + bw / 2 - 0.5, y + dy, 1, bh, '#8a5a30');
      rect(c, x + dx, y + dy + 1, bw, 0.5, '#8a5a30');
    }
  },
  mailbag(c, x, y) {
    ellipse(c, x + 8, y + 9, 6, 6, OUT);
    ellipse(c, x + 8, y + 9, 5, 5, '#8a7a5a');
    rect(c, x + 6, y + 1, 4, 4, '#6a5a3a');
    rect(c, x + 4, y + 8, 8, 2, '#3b6fb5');
    rect(c, x + 7, y + 12, 3, 0.5, '#5a4a30');
  },
  plant(c, x, y) {
    plant(c, x + 3, y + 3);
  },
  bench(c, x, y, w) {
    rect(c, x + 1.5, y - 7.5, w - 3, 5, OUT);
    rect(c, x + 2, y - 7, w - 4, 4, '#946238');
    rect(c, x + 2, y - 7, w - 4, 1, '#b07a44');
    rect(c, x + 0.5, y - 0.5, w - 1, 6, OUT);
    rect(c, x + 1, y, w - 2, 5, '#a8744a');
    rect(c, x + 1, y + 2.5, w - 2, 0.5, '#7a5030');
    for (const lx of [x + 3, x + w - 6]) rect(c, lx, y + 5, 3, 8, '#5a3418');
  },
  trolley(c, x, y, w) {
    rect(c, x + 2, y + 9, w - 4, 2, '#5a5a6a');
    for (const wx of [x + 6, x + w - 6]) disc(c, wx, y + 13, 2, '#2a2a3a');
    rect(c, x + w - 4, y - 8, 1.5, 18, '#5a5a6a');
    box(c, x + 4, y - 1, 18, 10, 3, '#c0392b');
    box(c, x + 22, y + 1, 14, 8, 3, '#2b6cb0');
    box(c, x + 8, y - 9, 14, 8, 3, '#27ae60');
  },
  drafting(c, x, y, w, h) {
    // tilted drawing board with a blueprint and a lamp
    for (const lx of [x + 6, x + w - 9]) rect(c, lx, y + 8, 3, h - 8, '#5a3418');
    rect(c, x + 1.5, y - 6.5, w - 3, 16, OUT);
    rect(c, x + 2, y - 6, w - 4, 15, '#8a5a30');
    rect(c, x + 6, y - 4, w - 12, 11, '#2a5a9a');
    for (let gx = x + 6; gx < x + w - 6; gx += 4) rect(c, gx, y - 4, 0.5, 11, '#3f70b0');
    rect(c, x + 12, y - 2, 18, 6, '#cfe0f8');
    rect(c, x + 12.5, y - 1.5, 17, 5, '#2a5a9a');
    rect(c, x + w - 14, y - 16, 1, 12, '#3a3a4a');
    rect(c, x + w - 19, y - 18, 9, 3, '#e8a030');
  },
  plans(c, x, y, w) {
    box(c, x + 4, y - 2, w - 8, 14, 3, '#7a4f2e');
    for (let i = 0; i < 5; i++) {
      const rx = x + 7 + i * 4.5;
      rect(c, rx, y - 10 - (i % 2) * 3, 3, 10, i % 2 ? '#cfe0f8' : '#f4f0e6');
      disc(c, rx + 1.5, y - 10 - (i % 2) * 3, 1, '#2a5a9a');
    }
  },
  bookshelf(c, x, y, w, h) {
    bookshelf(c, x + 2, y - 22, w - 4, h + 20);
  },
  telescope(c, x, y, w, h) {
    // tripod
    for (const [a, b] of [[x + 8, x + 16], [x + 24, x + 16], [x + 16, x + 16]] as const)
      for (let i = 0; i <= 10; i++) rect(c, a + ((b - a) * i) / 10, y + h - 2 - i * 1.6, 1.5, 1.5, '#5a3418');
    // tube pointing at the window
    for (let i = 0; i < 18; i++) rect(c, x + 16 - i * 0.9, y + h - 20 - i * 0.6, 4, 4, i < 3 ? '#c89a30' : '#3b4a6a');
    disc(c, x + w / 2, y + h - 18, 2, '#c89a30');
  },
  stairs(c, x, y, w, h) {
    // a ladder-stair climbing to the lookout
    rect(c, x + 1.5, y - 2.5, w - 3, h + 1, OUT);
    for (let i = 0; i < 7; i++) {
      const sy = y - 2 + i * ((h + 1) / 7);
      rect(c, x + 2, sy, w - 4, (h + 1) / 7 - 1, shade('#8a6a42', -i * 4));
      rect(c, x + 2, sy, w - 4, 1, shade('#a88a5a', -i * 4));
    }
    rect(c, x + 2, y - 2, 2, h, '#5a3418');
    rect(c, x + w - 4, y - 2, 2, h, '#5a3418');
  },
  crate(c, x, y, w) {
    box(c, x + 2, y - 2, w - 4, 14, 3, '#b8864c');
    rect(c, x + 2, y + 4, w - 4, 1, '#8a5a30');
    for (let i = 0; i < 10; i++) rect(c, x + 3 + i * ((w - 8) / 10), y + 1 + i * 1.1, 1.5, 1, '#8a5a30');
  },
  safe(c, x, y, w, h) {
    box(c, x + 6, y - 4, w - 12, h + 2, 4, '#4a4a5a');
    disc(c, x + w / 2, y + h / 2 + 2, 5, '#2a2a3a');
    disc(c, x + w / 2, y + h / 2 + 2, 3, '#9a9aaa');
    rect(c, x + w / 2 + 6, y + h / 2, 2, 6, '#c0c0c0');
  },
  workbench(c, x, y, w) {
    rect(c, x + 0.5, y - 4.5, w - 1, 6, OUT);
    rect(c, x + 1, y - 4, w - 2, 5, '#946238');
    rect(c, x + 1, y - 4, w - 2, 1, '#b07a44');
    for (const lx of [x + 3, x + w - 6]) rect(c, lx, y + 1, 3, 12, '#5a3418');
    // vice and a few keys being cut
    rect(c, x + 6, y - 9, 8, 5, '#5a5a6a');
    rect(c, x + 8, y - 11, 4, 2, '#7a7a8a');
    for (let i = 0; i < 3; i++) disc(c, x + 26 + i * 8, y - 5, 1.5, ['#f8d030', '#c0c0c0', '#e08838'][i]);
    rect(c, x + w - 18, y - 7, 10, 3, '#c0392b');
  },
  sacks(c, x, y, w, h) {
    // a pile of sacks, a row lower for each tile of depth, the back rows peeking over the front
    const rows = Math.max(1, Math.round(h / 10));
    for (let r = rows - 1; r >= 0; r--)
      for (let k = 0; k < Math.floor((w - 4 - (r % 2) * 4) / 9); k++) sack(c, x + 2 + k * 9 + (r % 2) * 4, y + h - 11 - r * 7);
  },
  barrels(c, x, y, w) {
    for (let k = 0; k < Math.floor(w / 14); k++) {
      const bx = x + 2 + k * 15;
      for (const dy of [8, -6]) {
        if (dy < 0 && k % 2) continue;
        rect(c, bx - 0.5, y + dy - 0.5, 13, 15, OUT);
        rect(c, bx, y + dy, 12, 14, '#8a5a30');
        rect(c, bx + 1, y + dy, 2, 14, '#a07040');
        for (const by of [3, 10]) rect(c, bx, y + dy + by, 12, 1, '#4a4a5a');
        ellipse(c, bx + 6, y + dy, 6, 2, '#6a4024');
      }
    }
  },
  hay(c, x, y, w) {
    box(c, x + 1, y - 4, w - 2, 16, 4, '#d8b048');
    const R = rng(x + y);
    for (let i = 0; i < 40; i++) rect(c, x + 2 + R() * (w - 6), y - 3 + R() * 14, 2 + R() * 2, 0.5, R() < 0.5 ? '#e8c860' : '#b8902c');
    rect(c, x + 1, y + 3, w - 2, 1, '#8a6a30');
    rect(c, x + 1, y + 8, w - 2, 1, '#8a6a30');
    // a ginger cat asleep on top
    const cx = x + w - 16;
    ellipse(c, cx + 5, y - 5, 6, 3.5, OUT);
    ellipse(c, cx + 5, y - 5, 5, 2.8, '#e08838');
    rect(c, cx + 2, y - 6, 1, 2, '#b86020');
    rect(c, cx + 5, y - 7, 1, 2, '#b86020');
    disc(c, cx + 10, y - 6, 2.6, OUT);
    disc(c, cx + 10, y - 6, 2, '#e08838');
    rect(c, cx + 8.5, y - 9, 1, 1.5, '#e08838');
    rect(c, cx + 11, y - 9, 1, 1.5, '#e08838');
    rect(c, cx + 9, y - 6, 1, 0.5, '#3a2a1a');
    rect(c, cx + 11, y - 6, 1, 0.5, '#3a2a1a');
    rect(c, cx - 2, y - 4, 4, 1, '#e08838');
  },
  bin(c, x, y, w, h) {
    // an open grain bin, heaped, with a scoop stuck in it
    box(c, x + 2, y - 6, w - 4, h + 4, 4, '#8a5a30');
    for (let i = 0; i < 3; i++) rect(c, x + 2, y + 2 + i * 7, w - 4, 1, '#6a4024');
    ellipse(c, x + w / 2, y - 6, w / 2 - 4, 4, '#e8c860');
    ellipse(c, x + w / 2, y - 7, w / 2 - 8, 2.5, '#f4d878');
    rect(c, x + w - 12, y - 16, 1.5, 10, '#a07848');
    rect(c, x + w - 14, y - 8, 5, 3, '#9a9aaa');
  },
  scale(c, x, y) {
    // a sack scale: a stand, a dial and a weighing pan
    rect(c, x + 7, y - 10, 2, 22, '#4a4a5a');
    disc(c, x + 8, y - 10, 4.5, OUT);
    disc(c, x + 8, y - 10, 3.8, '#f4f0e6');
    rect(c, x + 8, y - 12, 0.75, 2.5, '#c0392b');
    rect(c, x + 2, y + 6, 12, 2, '#7a7a8a');
    rect(c, x + 3, y + 8, 10, 1, '#5a5a6a');
    sack(c, x + 4, y - 3);
  },
  wheelbarrow(c, x, y, w) {
    // handles, the tray full of grain, one wheel
    rect(c, x + 2, y + 4, 9, 1.5, '#7a4a24');
    rect(c, x + 2, y + 8, 9, 1.5, '#7a4a24');
    for (let i = 0; i < 6; i++) rect(c, x + 8 + i * 3.4, y - 1 + i * 0.3, 4, 12 - i * 0.6, OUT);
    rect(c, x + 9, y, w - 12, 10, '#3b7a5a');
    rect(c, x + 9, y, w - 12, 2, '#4f9a72');
    ellipse(c, x + 9 + (w - 12) / 2, y, (w - 12) / 2 - 1, 2.5, '#e8c860');
    disc(c, x + w - 4, y + 11, 3.5, OUT);
    disc(c, x + w - 4, y + 11, 2.5, '#5a5a6a');
    rect(c, x + 12, y + 10, 1.5, 4, '#3a3a4a');
  },
  apples(c, x, y, w) {
    box(c, x + 2, y - 2, w - 4, 14, 3, '#b8864c');
    rect(c, x + 2, y + 5, w - 4, 1, '#8a5a30');
    const R = rng(x * 3 + y);
    for (let i = 0; i < 9; i++) {
      const ax = x + 5 + (i % 5) * 5 + (Math.floor(i / 5) % 2) * 2.5;
      const ay = y - 3 - Math.floor(i / 5) * 2.5;
      disc(c, ax, ay, 2.2, OUT);
      disc(c, ax, ay, 1.7, R() < 0.7 ? '#c0392b' : '#8ab83a');
      rect(c, ax - 0.5, ay - 1, 0.75, 0.75, '#f8c0b0');
    }
  },
};
