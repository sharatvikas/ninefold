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

/** Railway station: open-fronted shed with a platform. */
export function station(c: Ctx, x: number, y: number, w: number, h: number): void {
  rect(c, x + 2, y + h - 1, w - 2, 3, 'rgba(0,0,0,0.2)');
  const rh = Math.floor(h * 0.45);
  for (let j = 0; j < rh; j++) rect(c, x, y + j, w, 1, j % 3 === 0 ? '#7a5030' : '#946238');
  rect(c, x, y + rh - 1, w, 2, '#5a3a1a');
  rect(c, x + 2, y + rh + 1, w - 4, h - rh - 1, '#d9c7a7');
  for (let px = x + 4; px < x + w - 4; px += 14) rect(c, px, y + rh + 1, 3, h - rh - 1, '#8a6a42');
  rect(c, x + 8, y + h - 14, 22, 9, '#3a2a1a');
  rect(c, x + 9, y + h - 13, 20, 7, '#f4f0e6');
  pixelText(c, '9:00', x + 10, y + h - 7, '#3a2a1a', 5);
  rect(c, x + w - 34, y + h - 13, 10, 8, '#c0392b');
  rect(c, x + w - 22, y + h - 13, 10, 8, '#2b6cb0');
  sign(c, x + w / 2, y + rh + 1, 'RAILYARD');
}

/** Barn for the Granary (storage & databases). */
export function barn(c: Ctx, x: number, y: number, w: number, h: number): void {
  rect(c, x + 2, y + h - 1, w - 2, 3, 'rgba(0,0,0,0.2)');
  const rh = Math.floor(h * 0.4);
  for (let j = 0; j < rh; j++) {
    const inset = Math.max(0, Math.floor((rh - j) / 2) - 2);
    rect(c, x + inset, y + j, w - inset * 2, 1, j % 3 === 0 ? '#6a3020' : '#8a3a28');
  }
  rect(c, x + 2, y + rh, w - 4, h - rh, '#b5432b');
  for (let px = x + 2; px < x + w - 2; px += 4) rect(c, px, y + rh, 1, h - rh, '#9a3524');
  const dw = 18;
  const dx = x + Math.floor(w / 2 - dw / 2);
  rect(c, dx, y + h - 16, dw, 16, '#f0e0c0');
  rect(c, dx + 2, y + h - 14, dw - 4, 14, '#7a4f2e');
  c.strokeStyle = '#f0e0c0';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(dx + 2.5, y + h - 13.5);
  c.lineTo(dx + dw - 2.5, y - 0.5 + h);
  c.moveTo(dx + dw - 2.5, y + h - 13.5);
  c.lineTo(dx + 2.5, y - 0.5 + h);
  c.stroke();
  sign(c, x + w / 2, y + rh + 1, 'GRANARY');
}

/** Watchtower for observability. The lamp is drawn by the animated layer. */
export function watchtower(c: Ctx, x: number, y: number, w: number, h: number): void {
  const tx = x + Math.floor(w / 2) - 7;
  rect(c, tx + 2, y + h - 1, 12, 3, 'rgba(0,0,0,0.2)');
  rect(c, tx, y + 14, 14, h - 14, '#a88a62');
  for (let ty = y + 16; ty < y + h; ty += 6) rect(c, tx, ty, 14, 1, '#8a6e48');
  rect(c, tx - 3, y + 8, 20, 7, '#5a3a22');
  disc(c, tx + 7, y + 6, 8, '#4a3a2a');
  rect(c, tx + 4, y + h - 10, 6, 10, '#5a3a22');
}

export function fountain(c: Ctx, cx: number, cy: number): void {
  ellipse(c, cx, cy + 2, 13, 7, 'rgba(0,0,0,0.15)');
  ellipse(c, cx, cy, 12, 7, '#7d8894');
  ellipse(c, cx, cy, 10, 5, '#4aa3e0');
  rect(c, cx - 1, cy - 8, 3, 8, '#9aa6b2');
}

export function flowers(c: Ctx, x: number, y: number, seed: number): void {
  const cols = ['#ff7aa8', '#ffe066', '#ffffff', '#b48cff'];
  for (let i = 0; i < 4; i++) {
    const fx = x + ((seed * 7 + i * 5) % 14) + 1;
    const fy = y + ((seed * 3 + i * 9) % 14) + 1;
    const col = cols[(seed + i) % cols.length];
    rect(c, fx - 1, fy, 3, 1, col);
    rect(c, fx, fy - 1, 1, 3, col);
    rect(c, fx, fy, 1, 1, '#f8f8a0');
  }
}

export function container(c: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  rect(c, x, y, w, h, '#2a1e1a');
  rect(c, x + 1, y + 1, w - 2, h - 2, col);
  rect(c, x + 1, y + 1, w - 2, 1, 'rgba(255,255,255,0.35)');
  for (let k = 3; k < w - 1; k += 3) rect(c, x + k, y + 2, 1, h - 3, 'rgba(0,0,0,0.18)');
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
  R(0, 0, 30, 6, '#2a1e1a');
  R(1, 0, 28, 5, '#8a5a2e');
  R(2, 4, 26, 2, '#5a3a1a');
  R(1, 1, 28, 1, '#a87444');
  R(4, -14, 1, 14, '#2a1e1a');
  R(5, -13, 9, 9, '#2a1e1a');
  R(5, -12, 8, 7, '#f4f0e6');
  R(5, -15, 4, 2, '#c0392b');
  const cols = ['#c0392b', '#2b6cb0', '#27ae60', '#e8a030'];
  for (let i = 0; i < crates; i++) {
    const cx = 16 + (i % 3) * 4;
    const cy = -4 - Math.floor(i / 3) * 4;
    R(cx, cy, 4, 4, '#2a1e1a');
    R(cx, cy, 3, 3, cols[i % 4]);
  }
  c.restore();
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
