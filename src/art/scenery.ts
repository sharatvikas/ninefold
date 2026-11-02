import { disc, ellipse, pixelText, rect, shade, snap, type Ctx } from './pixels';

const OUT = '#2a1e1a';

/** Filled circle on a half-pixel grid (cx, cy, r in half-pixel units, origin at x, y). */
function blobU(c: Ctx, x: number, y: number, cx: number, cy: number, r: number, col: string): void {
  for (let yy = -r; yy <= r; yy++) {
    const w = Math.round(Math.sqrt(r * r - yy * yy));
    rect(c, x + (cx - w) * 0.5, y + (cy + yy) * 0.5, (2 * w + 1) * 0.5, 0.5, col);
  }
}

/** A 16×16 tree drawn with double detail. `sway` nudges the canopy by half-pixels. */
export function tree(c: Ctx, x: number, y: number, sway = 0): void {
  const U = (px: number, py: number, w: number, h: number, col: string) => rect(c, x + px * 0.5, y + py * 0.5, w * 0.5, h * 0.5, col);
  ellipse(c, x + 8, y + 15, 6, 1, 'rgba(0,0,0,0.2)');
  // trunk
  U(12, 21, 8, 10, OUT);
  U(13, 21, 6, 9, '#7a4a28');
  U(14, 22, 1, 7, '#5a3418');
  U(17, 23, 1, 5, '#9a6438');
  U(11, 29, 10, 1, '#5a3418');
  // canopy
  const s = sway * 2;
  blobU(c, x, y, 16 + s, 12, 13, OUT);
  blobU(c, x, y, 16 + s, 12, 12, '#24602f');
  blobU(c, x, y, 15 + s, 11, 10, '#2f7a3d');
  blobU(c, x, y, 11 + s, 8, 6, '#3f9a4a');
  blobU(c, x, y, 20 + s, 9, 5, '#3f9a4a');
  blobU(c, x, y, 10 + s, 6, 3, '#58b45a');
  blobU(c, x, y, 19 + s, 7, 2, '#58b45a');
  for (const [px, py] of [[9, 4], [12, 6], [20, 6], [8, 9], [22, 10], [15, 3]]) U(px + s, py, 1, 1, '#8ad070');
  for (const [px, py] of [[13, 16], [18, 17], [9, 14], [23, 14], [16, 19]]) U(px + s, py, 2, 1, '#1d4a26');
}

export interface HouseStyle {
  roof: string;
  wall: string;
  label: string;
}

/** A cozy house that exactly fills the box (x, y, w, h). The door sits on the bottom edge at the centre. */
export function house(c: Ctx, x: number, y: number, w: number, h: number, s: HouseStyle): void {
  const H = 0.5;
  rect(c, x + 2, y + h - 1, w - 2, 3, 'rgba(0,0,0,0.2)');
  // walls
  const wy = y + Math.floor(h * 0.45);
  rect(c, x + 1.5, wy, w - 3, y + h - wy + H, OUT);
  rect(c, x + 2, wy, w - 4, y + h - wy, s.wall);
  for (let i = wy + 2.5; i < y + h - 1; i += 3) {
    rect(c, x + 2, i, w - 4, H, shade(s.wall, -18));
    rect(c, x + 2, i + H, w - 4, H, shade(s.wall, 10));
  }
  rect(c, x + 2, wy, 1.5, y + h - wy, shade(s.wall, -28));
  rect(c, x + w - 3.5, wy, 1.5, y + h - wy, shade(s.wall, -28));
  // roof: shingle rows with offset tiles
  const rh = Math.floor(h * 0.5);
  rect(c, x - H, y - H, w + 1, rh + 1, OUT);
  for (let j = 0; j < rh; j += 2) {
    const inset = j < 3 ? (3 - j) * 0.5 : 0;
    const rowCol = j % 4 === 0 ? s.roof : shade(s.roof, -10);
    rect(c, x + inset, y + j, w - inset * 2, 2, rowCol);
    rect(c, x + inset, y + j + 1.5, w - inset * 2, H, shade(s.roof, -38));
    for (let k = x + inset + (j % 4 === 0 ? 2 : 4); k < x + w - inset - 1; k += 4) rect(c, k, y + j, H, 1.5, shade(s.roof, -30));
  }
  rect(c, x + 1, y + H, w - 2, H, shade(s.roof, 35));
  rect(c, x - 1, y + rh - 1.5, w + 2, 2, shade(s.roof, -50));
  rect(c, x - 1, y + rh + H, w + 2, H, 'rgba(0,0,0,0.25)');
  // chimney
  rect(c, x + w - 13, y - 4, 5, 6, OUT);
  rect(c, x + w - 12.5, y - 3.5, 4, 5.5, '#a05040');
  rect(c, x + w - 12.5, y - 3.5, 4, H, '#c87060');
  // door with frame and step
  const dx = x + Math.floor(w / 2) - 4.5;
  rect(c, dx - H, y + h - 13, 10, 13, OUT);
  rect(c, dx, y + h - 12.5, 9, 12.5, '#6a4024');
  rect(c, dx + 1, y + h - 11.5, 3, 5, '#7e4f2e');
  rect(c, dx + 5, y + h - 11.5, 3, 5, '#7e4f2e');
  rect(c, dx + 1, y + h - 5.5, 7, 4.5, '#7e4f2e');
  rect(c, dx + 7, y + h - 6.5, 1, 1, '#ffd866');
  rect(c, dx - 1, y + h, 11, 1.5, '#b8a890');
  // windows: frame, glass, glint, curtains, sill and flower box
  for (const wx of [x + 5, x + w - 16]) {
    const wy2 = y + h - 15;
    rect(c, wx - H, wy2 - H, 12, 10, OUT);
    rect(c, wx, wy2, 11, 9, '#f4ead8');
    rect(c, wx + 1, wy2 + 1, 9, 7, '#7fbfe8');
    rect(c, wx + 1, wy2 + 1, 9, 2, '#a8d8f4');
    rect(c, wx + 2, wy2 + 3.5, 1, 1, '#ffffff');
    rect(c, wx + 3, wy2 + 2.5, 1, 1, '#ffffff');
    rect(c, wx + 1, wy2 + 1, 2, 7, '#e8a0a0');
    rect(c, wx + 8, wy2 + 1, 2, 7, '#e8a0a0');
    rect(c, wx + 5.25, wy2 + 1, H, 7, '#f4ead8');
    rect(c, wx - 1, wy2 + 9, 13, 1.5, '#8a5a30');
    rect(c, wx, wy2 + 10.5, 11, 1.5, '#6a4024');
    for (let f = 0; f < 5; f++) rect(c, wx + 0.5 + f * 2.25, wy2 + 9.5 - (f % 2) * H, 1, 1, ['#ff7aa8', '#ffe066', '#ffffff', '#b48cff', '#ff7aa8'][f]);
  }
  if (s.label) sign(c, x + w / 2, y + rh + 1, s.label);
}

export function sign(c: Ctx, cx: number, y: number, label: string): void {
  c.font = '5px "Press Start 2P"';
  const tw = Math.ceil(c.measureText(label).width) + 6;
  const sx = Math.round(cx - tw / 2);
  rect(c, sx, y, tw, 9, '#3a2a1a');
  rect(c, sx + 1, y + 1, tw - 2, 7, '#e8d2a0');
  pixelText(c, label, sx + 3, y + 7, '#3a2a1a');
}

/** Shingled roof band, shared by station/barn-like buildings. */
function shingles(c: Ctx, x: number, y: number, w: number, h: number, col: string, taper = 0): void {
  for (let j = 0; j < h; j += 2) {
    const inset = taper ? Math.max(0, ((h - j) / h) * taper) : 0;
    rect(c, x + inset - 0.5, y + j - (j === 0 ? 0.5 : 0), w - inset * 2 + 1, 2 + (j === 0 ? 0.5 : 0), OUT);
  }
  for (let j = 0; j < h; j += 2) {
    const inset = taper ? Math.max(0, ((h - j) / h) * taper) : 0;
    const rowCol = j % 4 === 0 ? col : shade(col, -10);
    rect(c, x + inset, y + j, w - inset * 2, 2, rowCol);
    rect(c, x + inset, y + j + 1.5, w - inset * 2, 0.5, shade(col, -38));
    for (let k = x + inset + (j % 4 === 0 ? 2 : 4); k < x + w - inset - 1; k += 4) rect(c, k, y + j, 0.5, 1.5, shade(col, -30));
  }
  rect(c, x + 1 + taper, y + 0.5, w - 2 - taper * 2, 0.5, shade(col, 35));
  rect(c, x - 1, y + h - 1.5, w + 2, 2, shade(col, -50));
}

/** Railway station: open-fronted shed with a platform, timetable, bench and lamp. */
export function station(c: Ctx, x: number, y: number, w: number, h: number): void {
  rect(c, x + 2, y + h - 1, w - 2, 3, 'rgba(0,0,0,0.2)');
  const rh = Math.floor(h * 0.45);
  shingles(c, x, y, w, rh, '#946238');
  // back wall and posts
  rect(c, x + 2, y + rh, w - 4, h - rh, OUT);
  rect(c, x + 2.5, y + rh, w - 5, h - rh - 0.5, '#e6d6b6');
  for (let yy = y + rh + 3; yy < y + h - 2; yy += 3) rect(c, x + 2.5, yy, w - 5, 0.5, '#d4c29e');
  for (let px = x + 4; px < x + w - 4; px += 14) {
    rect(c, px - 0.5, y + rh, 4, h - rh, OUT);
    rect(c, px, y + rh, 3, h - rh - 0.5, '#8a6a42');
    rect(c, px, y + rh, 1, h - rh - 0.5, '#a88a5a');
  }
  // platform edge
  rect(c, x, y + h - 2, w, 2, '#b8a888');
  rect(c, x, y + h - 2, w, 0.5, '#f8d030');
  // timetable board
  rect(c, x + 8.5, y + h - 15, 23, 10, OUT);
  rect(c, x + 9, y + h - 14.5, 22, 9, '#24313a');
  pixelText(c, '9:00 ✓', x + 10.5, y + h - 9, '#b8f0c8', 4);
  pixelText(c, '9:30', x + 10.5, y + h - 6, '#f8ecd0', 3);
  // luggage
  rect(c, x + w - 34.5, y + h - 12.5, 11, 9, OUT);
  rect(c, x + w - 34, y + h - 12, 10, 8, '#c0392b');
  rect(c, x + w - 30, y + h - 13.5, 2, 1.5, OUT);
  rect(c, x + w - 22.5, y + h - 11.5, 11, 8, OUT);
  rect(c, x + w - 22, y + h - 11, 10, 7, '#2b6cb0');
  rect(c, x + w - 22, y + h - 8, 10, 0.5, '#1a4a80');
  sign(c, x + w / 2, y + rh + 1, 'RAILYARD');
}

/** Barn for the Granary (storage & databases). */
export function barn(c: Ctx, x: number, y: number, w: number, h: number): void {
  rect(c, x + 2, y + h - 1, w - 2, 3, 'rgba(0,0,0,0.2)');
  const rh = Math.floor(h * 0.4);
  shingles(c, x, y, w, rh, '#7a3424', w * 0.18);
  rect(c, x + 1.5, y + rh, w - 3, h - rh, OUT);
  rect(c, x + 2, y + rh, w - 4, h - rh - 0.5, '#b5432b');
  for (let px = x + 2; px < x + w - 2; px += 3) {
    rect(c, px, y + rh, 0.5, h - rh - 0.5, '#8a2f1e');
    rect(c, px + 0.5, y + rh, 0.5, h - rh - 0.5, '#c8553a');
  }
  // hay loft window
  rect(c, x + w / 2 - 4.5, y + rh - 6, 9, 7, '#f0e0c0');
  rect(c, x + w / 2 - 3.5, y + rh - 5, 7, 5, '#3a2210');
  rect(c, x + w / 2 - 3, y + rh - 2, 6, 2, '#e8c860');
  // big door with white X trim
  const dw = 18;
  const dx = x + Math.floor(w / 2 - dw / 2);
  rect(c, dx - 0.5, y + h - 16.5, dw + 1, 16.5, OUT);
  rect(c, dx, y + h - 16, dw, 16, '#f0e0c0');
  rect(c, dx + 1.5, y + h - 14.5, dw - 3, 14.5, '#7a4f2e');
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    rect(c, dx + 1.5 + t * (dw - 4), y + h - 14.5 + t * 13.5, 1, 1, '#f0e0c0');
    rect(c, dx + dw - 2.5 - t * (dw - 4), y + h - 14.5 + t * 13.5, 1, 1, '#f0e0c0');
  }
  rect(c, dx + dw / 2 - 0.25, y + h - 14.5, 0.5, 14.5, '#5a3418');
  sign(c, x + w / 2, y + rh + 1, 'GRANARY');
}

/** Watchtower for observability: braced wooden legs, a lookout cabin and a ladder. */
export function watchtower(c: Ctx, x: number, y: number, w: number, h: number): void {
  const tx = x + Math.floor(w / 2) - 7;
  rect(c, tx + 1, y + h - 1, 14, 3, 'rgba(0,0,0,0.2)');
  // legs
  for (const lx of [tx, tx + 12]) {
    rect(c, lx - 0.5, y + 14, 3, h - 14, OUT);
    rect(c, lx, y + 14, 2, h - 14.5, '#8a6a42');
    rect(c, lx, y + 14, 0.5, h - 14.5, '#a88a5a');
  }
  // cross braces
  for (let yy = y + 17; yy < y + h - 4; yy += 9) {
    for (let i = 0; i < 10; i++) {
      rect(c, tx + 2 + i, yy + i * 0.7, 1, 0.5, '#6a4a2a');
      rect(c, tx + 11 - i, yy + i * 0.7, 1, 0.5, '#6a4a2a');
    }
  }
  // ladder
  rect(c, tx + 5, y + 14, 0.5, h - 14, '#5a3418');
  rect(c, tx + 8.5, y + 14, 0.5, h - 14, '#5a3418');
  for (let yy = y + 16; yy < y + h; yy += 2.5) rect(c, tx + 5, yy, 4, 0.5, '#7a5030');
  // cabin + railing
  rect(c, tx - 3.5, y + 7.5, 21, 8, OUT);
  rect(c, tx - 3, y + 8, 20, 7, '#7a5030');
  for (let px = tx - 2; px < tx + 17; px += 2) rect(c, px, y + 8, 0.5, 7, '#5a3418');
  rect(c, tx - 3, y + 8, 20, 0.5, '#a88a5a');
  // roof
  for (let j = 0; j < 8; j++) rect(c, tx + 7 - j * 1.5 - 1, y + j, j * 3 + 2, 1, j % 2 ? '#4a3a2a' : '#5a4a3a');
  rect(c, tx - 4, y + 7, 22, 1, OUT);
}

/** Town fountain: stone ring, rippling water, central column and basin. */
export function fountain(c: Ctx, cx: number, cy: number): void {
  ellipse(c, cx, cy + 2, 13, 7, 'rgba(0,0,0,0.15)');
  ellipse(c, cx, cy, 13, 8, OUT);
  ellipse(c, cx, cy, 12, 7, '#9aa6b2');
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    rect(c, cx + Math.cos(ang) * 11.5, cy + Math.sin(ang) * 6.5, 0.5, 0.5, '#7d8894');
  }
  ellipse(c, cx, cy, 10, 5, '#3f8fd0');
  ellipse(c, cx, cy - 0.5, 9, 4, '#4aa3e0');
  ellipse(c, cx - 3, cy - 1, 4, 1, '#7fc2f0');
  rect(c, cx - 1.5, cy - 8, 4, 9, OUT);
  rect(c, cx - 1, cy - 8, 3, 8.5, '#b8c2cc');
  rect(c, cx - 1, cy - 8, 1, 8.5, '#d8e0e8');
  ellipse(c, cx + 0.5, cy - 8, 4, 1, '#9aa6b2');
}

export function flowers(c: Ctx, x: number, y: number, seed: number): void {
  const cols = ['#ff7aa8', '#ffe066', '#ffffff', '#b48cff'];
  for (let i = 0; i < 4; i++) {
    const fx = x + ((seed * 7 + i * 5) % 14) + 1;
    const fy = y + ((seed * 3 + i * 9) % 14) + 1;
    const col = cols[(seed + i) % cols.length];
    rect(c, fx + 0.25, fy + 1.5, 0.5, 2, '#3f8a36');
    rect(c, fx - 0.75, fy + 2.5, 1, 0.5, '#4fa04f');
    rect(c, fx - 1, fy, 2.5, 1.5, col);
    rect(c, fx - 0.25, fy - 0.75, 1, 3, col);
    rect(c, fx, fy + 0.25, 0.5, 0.5, '#f8e070');
  }
}

/** Shipping container: corrugated sides, highlight, door bars and lock handles. */
export function container(c: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  rect(c, x, y, w, h, OUT);
  rect(c, x + 0.5, y + 0.5, w - 1, h - 1, col);
  for (let k = 1.5; k < w - 1; k += 2) {
    rect(c, x + k, y + 1.5, 0.5, h - 3, shade(col, -28));
    rect(c, x + k + 0.5, y + 1.5, 0.5, h - 3, shade(col, 18));
  }
  rect(c, x + 0.5, y + 0.5, w - 1, 1, shade(col, 40));
  rect(c, x + 0.5, y + h - 1.5, w - 1, 1, shade(col, -40));
  rect(c, x + w - 4, y + 1.5, 0.5, h - 3, '#2a1e1a');
  rect(c, x + w - 2.5, y + 1.5, 0.5, h - 3, '#2a1e1a');
  rect(c, x + w - 4.5, y + h / 2 - 0.5, 1.5, 1, '#d8d8d8');
  rect(c, x + w - 3, y + h / 2 + 0.5, 1.5, 1, '#d8d8d8');
}

/** A cargo ship. (x, y) is the hull's top-left. Crates stack on deck; sc scales everything. */
export function boat(c: Ctx, x: number, y: number, crates: number, tilt = 0, sc = 1): void {
  c.save();
  c.translate(snap(x), snap(y));
  c.rotate(tilt);
  const R = (a: number, b: number, w: number, h: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(a * sc, b * sc, w * sc, h * sc);
  };
  // hull: tapered bow, planks, waterline stripe, portholes
  R(-0.5, -0.5, 31.5, 7, OUT);
  R(30, 0, 1.5, 3, OUT);
  for (let j = 0; j < 6; j += 0.5) {
    const inset = j > 3 ? (j - 3) * 0.8 : 0;
    R(inset, j, 30 - inset * 1.5, 0.5, j < 1 ? '#b8804c' : j > 4.5 ? '#9a2a1e' : j % 1.5 === 0 ? '#7a4a24' : '#8a5a2e');
  }
  R(0, 4.5, 29, 0.5, '#e8e0d0');
  for (const px of [6, 12, 18, 24]) {
    R(px, 2, 1.5, 1.5, OUT);
    R(px + 0.25, 2.25, 1, 1, '#8fd0ff');
  }
  // wheelhouse at the stern
  R(1, -5.5, 8, 5.5, OUT);
  R(1.5, -5, 7, 5, '#f4f0e6');
  R(1.5, -5, 7, 0.5, '#ffffff');
  R(2.5, -4, 2, 1.5, '#5aaee0');
  R(5.5, -4, 2, 1.5, '#5aaee0');
  R(1, -6.5, 8, 1, '#c0392b');
  // mast, sail and flag
  R(10, -15, 1, 15, OUT);
  R(11, -14, 8.5, 9.5, OUT);
  R(11.5, -13.5, 7.5, 8.5, '#f4f0e6');
  R(11.5, -13.5, 0.5, 8.5, '#d8d0c0');
  for (let k = 0; k < 4; k++) R(12.5 + k * 1.8, -13.5, 0.25, 8.5, '#e0d8c8');
  R(10.5, -16.5, 4.5, 2, '#c0392b');
  R(15, -16, 1, 1, '#c0392b');
  // crates with plank lines and highlights
  const cols = ['#c0392b', '#2b6cb0', '#27ae60', '#e8a030'];
  for (let i = 0; i < crates; i++) {
    const cx = 18 + (i % 3) * 4;
    const cy = -4 - Math.floor(i / 3) * 4;
    R(cx, cy, 4, 4, OUT);
    R(cx + 0.5, cy + 0.5, 3, 3, cols[i % 4]);
    R(cx + 0.5, cy + 0.5, 3, 0.5, 'rgba(255,255,255,0.35)');
    R(cx + 0.5, cy + 2, 3, 0.5, 'rgba(0,0,0,0.25)');
  }
  c.restore();
}

/** A dockside crane: lattice tower, boom, operator cab, cable and hook. */
export function crane(c: Ctx, x: number, y: number, height: number, boom: number, sway = 0): void {
  const Y = '#e8a030';
  const D = '#b07818';
  rect(c, x - 0.5, y - 0.5, 8, height + 1, OUT);
  rect(c, x, y, 7, height, Y);
  rect(c, x, y, 1, height, '#f8c860');
  for (let yy = y + 2; yy < y + height - 2; yy += 6) {
    for (let i = 0; i < 6; i++) {
      rect(c, x + 1 + i, yy + i, 0.5, 0.5, D);
      rect(c, x + 6 - i, yy + i, 0.5, 0.5, D);
    }
    rect(c, x, yy, 7, 0.5, D);
  }
  // boom
  rect(c, x - boom - 0.5, y - 0.5, boom + 8, 6, OUT);
  rect(c, x - boom, y, boom + 7, 5, Y);
  rect(c, x - boom, y, boom + 7, 0.5, '#f8c860');
  for (let bx = x - boom + 1; bx < x; bx += 4) {
    rect(c, bx, y + 1, 0.5, 3, D);
    for (let i = 0; i < 4; i++) rect(c, bx + i, y + 1 + i * 0.75, 0.5, 0.5, D);
  }
  // cab
  rect(c, x - 3.5, y + 5.5, 9, 7, OUT);
  rect(c, x - 3, y + 6, 8, 6, '#d88020');
  rect(c, x - 2, y + 7, 6, 3, '#8fd0ff');
  // cable + hook + hanging container
  const hx = x - boom + 8;
  const len = 22 + sway;
  rect(c, hx, y + 5, 0.5, len, '#3a3a3a');
  container(c, hx - 5, y + 5 + len, 11, 7, '#2b6cb0');
}

/** A railway carriage (or a locomotive). (x, y) is the top-left; w wide, 16 tall. */
export function railCar(c: Ctx, x: number, y: number, w: number, col: string, loco = false): void {
  rect(c, x - 0.5, y - 0.5, w + 1, 15, OUT);
  rect(c, x, y, w, 14, col);
  rect(c, x, y, w, 1, shade(col, 40));
  rect(c, x, y + 11, w, 3, shade(col, -35));
  rect(c, x, y - 1.5, w, 1.5, OUT);
  rect(c, x + 0.5, y - 1, w - 1, 1, shade(col, -20));
  if (loco) {
    rect(c, x + w - 9, y + 2, 7, 5, OUT);
    rect(c, x + w - 8.5, y + 2.5, 6, 4, '#8fd0ff');
    rect(c, x + 3, y - 7, 5, 6, OUT);
    rect(c, x + 3.5, y - 6.5, 4, 5.5, '#3a3a3a');
    rect(c, x + w - 1, y + 9, 2, 3, '#f8e070');
  } else {
    for (let wx = x + 2; wx < x + w - 5; wx += 6) {
      rect(c, wx - 0.5, y + 2.5, 5, 5, OUT);
      rect(c, wx, y + 3, 4, 4, '#8fd0ff');
      rect(c, wx, y + 3, 1.5, 1, '#d8f0ff');
    }
  }
  for (const wx of [x + 4, x + w - 4]) {
    disc(c, wx, y + 15, 3, OUT);
    disc(c, wx, y + 15, 2, '#5a5a5a');
    rect(c, wx - 0.25, y + 13, 0.5, 4, '#2a2a2a');
    rect(c, wx - 2, y + 14.75, 4, 0.5, '#2a2a2a');
  }
}

/** Old-fashioned street lamp; `lit` adds a warm glow. */
export function lampPost(c: Ctx, x: number, y: number, lit = true): void {
  rect(c, x - 0.5, y, 2, 18, OUT);
  rect(c, x, y, 1, 17.5, '#3a3a4a');
  rect(c, x - 2, y + 16.5, 5, 1.5, '#3a3a4a');
  rect(c, x - 2.5, y - 4.5, 6, 5, OUT);
  rect(c, x - 2, y - 4, 5, 4, lit ? '#ffe680' : '#a8a080');
  rect(c, x - 3, y - 5.5, 7, 1.5, '#3a3a4a');
  if (lit) disc(c, x + 0.5, y - 2, 6, 'rgba(255,230,128,0.18)');
}

/** A tied grain sack. */
export function sack(c: Ctx, x: number, y: number): void {
  ellipse(c, x + 4, y + 6, 4, 4, OUT);
  ellipse(c, x + 4, y + 6, 3, 3, '#e8d098');
  rect(c, x + 2.5, y + 5, 1.5, 3, '#f4e0b0');
  rect(c, x + 3, y + 1, 2, 2.5, '#d8b878');
  rect(c, x + 2.5, y + 2.5, 3, 0.5, '#8a6a30');
  rect(c, x + 3, y + 7.5, 3, 0.5, '#c8a868');
}

/** Bookshelf for interiors. */
export function bookshelf(c: Ctx, x: number, y: number, w: number, h: number): void {
  rect(c, x - 0.5, y - 0.5, w + 1, h + 1, OUT);
  rect(c, x, y, w, h, '#6a4024');
  const cols = ['#c0392b', '#2b6cb0', '#27ae60', '#e8a030', '#7a4fa0', '#f4f0e6'];
  for (let sy = y + 1; sy < y + h - 4; sy += 7) {
    rect(c, x + 1, sy + 5, w - 2, 1, '#4a2a14');
    let bx = x + 1.5;
    let i = Math.floor(sy);
    while (bx < x + w - 2) {
      const bw = 1.5 + (i % 3) * 0.5;
      const bh = 4 + (i % 2) * 0.5;
      rect(c, bx, sy + 5 - bh, bw, bh, cols[i % cols.length]);
      rect(c, bx, sy + 5 - bh + 1, bw, 0.5, 'rgba(255,255,255,0.3)');
      bx += bw + 0.5;
      i += 7;
    }
  }
}

/** Potted plant for interiors. */
export function plant(c: Ctx, x: number, y: number): void {
  for (const [dx, dy, r] of [[3, 3, 3], [6, 2, 3], [4.5, 0, 2.5]] as const) disc(c, x + dx, y + dy, r, '#2f7a3d');
  rect(c, x + 3, y - 1, 1, 1, '#58b45a');
  rect(c, x + 6, y + 1, 1, 1, '#58b45a');
  rect(c, x + 1.5, y + 5.5, 7, 6, OUT);
  rect(c, x + 2, y + 6, 6, 5, '#c0603a');
  rect(c, x + 2, y + 6, 6, 1, '#d87a50');
}

export interface Particle {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
}

/** Simple rising smoke. Call spawn+step every frame. */
export class Smoke {
  private ps: Particle[] = [];
  constructor(private color = '110,110,110') {}
  spawn(x: number, y: number, chance: number): void {
    if (Math.random() < chance) {
      this.ps.push({ x: x + Math.random() * 6, y, r: 2, a: 0.7, vx: -2 - Math.random() * 3, vy: -9 - Math.random() * 4 });
    }
  }
  step(dt: number): void {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += 3 * dt;
      p.a -= 0.25 * dt;
      if (p.a <= 0) this.ps.splice(i, 1);
    }
  }
  draw(c: Ctx): void {
    for (const p of this.ps) disc(c, p.x, p.y, p.r, `rgba(${this.color},${p.a.toFixed(2)})`);
  }
}
