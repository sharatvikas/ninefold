import { disc, ellipse, pixelText, rect, shade, type Ctx } from './pixels';

export function tree(c: Ctx, x: number, y: number, sway = 0): void {
  rect(c, x + 6, y + 12, 4, 4, '#6b4423');
  rect(c, x + 6, y + 15, 4, 1, '#4a2e17');
  ellipse(c, x + 8, y + 14, 6, 2, 'rgba(0,0,0,0.18)');
  disc(c, x + 8 + sway, y + 7, 7, '#24502e');
  disc(c, x + 8 + sway, y + 6, 6, '#2f7a3d');
  disc(c, x + 6 + sway, y + 4, 3, '#4fa04f');
  rect(c, x + 5 + sway, y + 3, 1, 1, '#7cc46a');
}

export interface HouseStyle {
  roof: string;
  wall: string;
  label: string;
}

/** A cozy house that exactly fills the box (x, y, w, h). The door sits on the bottom edge at the centre. */
export function house(c: Ctx, x: number, y: number, w: number, h: number, s: HouseStyle): void {
  rect(c, x + 2, y + h - 1, w - 2, 3, 'rgba(0,0,0,0.2)');
  const wy = y + Math.floor(h * 0.45);
  rect(c, x + 2, wy, w - 4, y + h - wy, s.wall);
  for (let i = wy; i < y + h; i += 4) rect(c, x + 2, i, w - 4, 1, 'rgba(0,0,0,0.06)');
  const rh = Math.floor(h * 0.5);
  for (let j = 0; j < rh; j++) {
    const inset = j < 2 ? 2 - j : 0;
    rect(c, x + inset, y + j, w - inset * 2, 1, j % 3 === 0 ? shade(s.roof, -25) : s.roof);
  }
  rect(c, x, y + rh - 1, w, 2, shade(s.roof, -45));
  const dx = x + Math.floor(w / 2) - 4;
  rect(c, dx, y + h - 12, 8, 12, '#5a3a22');
  rect(c, dx + 1, y + h - 11, 6, 11, '#7a4f2e');
  rect(c, dx + 5, y + h - 6, 1, 1, '#ffd866');
  for (const wx of [x + 6, x + w - 16]) {
    rect(c, wx, y + h - 14, 10, 8, '#2a2a3a');
    rect(c, wx + 1, y + h - 13, 8, 6, '#8fd0ff');
    rect(c, wx + 1, y + h - 13, 3, 2, '#d8f0ff');
    rect(c, wx + 5, y + h - 13, 1, 6, '#2a2a3a');
    rect(c, wx - 1, y + h - 6, 12, 2, '#c8a070');
  }
  sign(c, x + w / 2, y + rh + 1, s.label);
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
  c.translate(Math.round(x), Math.round(y));
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
