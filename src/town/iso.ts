/**
 * Isometric projection and a few solid shapes, drawn with plain Canvas 2D.
 * Grid space: x runs down-right, y runs down-left, z is up. One grid unit is one "tile".
 */

export interface View {
  /** Screen position of grid (0, 0, 0). */
  ox: number;
  oy: number;
  /** Half a tile's width on screen, in CSS pixels. A tile is 2·hw wide and hw tall. */
  hw: number;
}

export type P2 = [number, number];
export type P3 = [number, number, number];

export const Z_SCALE = 1.05;

export function project(v: View, x: number, y: number, z = 0): P2 {
  return [v.ox + (x - y) * v.hw, v.oy + (x + y) * v.hw * 0.5 - z * v.hw * Z_SCALE];
}

/** The ground point under a screen position. */
export function unproject(v: View, sx: number, sy: number): P2 {
  const a = (sx - v.ox) / v.hw;
  const b = (sy - v.oy) / (v.hw * 0.5);
  return [(a + b) / 2, (b - a) / 2];
}

/** A view that fits a size×size island into a w×h canvas, leaving room for tall buildings and labels. */
export function fitView(w: number, h: number, size: number, pad = { top: 0.16, bottom: 0.1, side: 0.04 }): View {
  const usableW = w * (1 - pad.side * 2);
  const usableH = h * (1 - pad.top - pad.bottom);
  // The island's corners are rounded, so it can be drawn a little larger than its bounding diamond allows.
  const hw = Math.max(4, Math.min((usableW / (size * 2)) * 1.12, usableH / size));
  return { hw, ox: w / 2, oy: h * pad.top + (usableH - size * hw) / 2 };
}

/** A view centred on one grid point. */
export function focusView(w: number, h: number, cx: number, cy: number, hw: number, lift = 1): View {
  const [px, py] = project({ ox: 0, oy: 0, hw }, cx, cy, lift);
  return { hw, ox: w / 2 - px, oy: h / 2 - py };
}

// ---------------------------------------------------------------- colour

/** Read "#rrggbb" or "rgb(r,g,b)". */
export function hex(c: string): [number, number, number] {
  if (c.startsWith('rgb')) {
    const [r, g, b] = c.slice(c.indexOf('(') + 1).split(',').map((x) => parseInt(x, 10));
    return [r, g, b];
  }
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix two hex colours. t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(ar, br)},${m(ag, bg)},${m(ab, bb)})`;
}

export const shade = (c: string, t: number): string => mix(c, '#070a14', t);
export const tint = (c: string, t: number): string => mix(c, '#cfd8ff', t);

// ---------------------------------------------------------------- shapes

export type Ctx = CanvasRenderingContext2D;

export class Pen {
  constructor(
    readonly c: Ctx,
    readonly v: View,
  ) {}

  p(x: number, y: number, z = 0): P2 {
    return project(this.v, x, y, z);
  }

  poly(pts: P3[], fill: string, stroke?: string): void {
    const c = this.c;
    c.beginPath();
    pts.forEach(([x, y, z], i) => {
      const [sx, sy] = this.p(x, y, z);
      if (i === 0) c.moveTo(sx, sy);
      else c.lineTo(sx, sy);
    });
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 1;
      c.stroke();
    }
  }

  /** A box standing on z, with its footprint from (x, y) to (x+w, y+d). */
  box(x: number, y: number, w: number, d: number, z: number, h: number, color: string, top?: string): void {
    const edge = shade(color, 0.55);
    this.poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], shade(color, 0.34), edge);
    this.poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], shade(color, 0.12), edge);
    this.poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], top ?? tint(color, 0.12), edge);
  }

  /** A pitched roof over the same footprint. `along` is the direction the ridge runs. */
  gable(x: number, y: number, w: number, d: number, z: number, rise: number, along: 'x' | 'y', roof: string, wall: string): void {
    const edge = shade(roof, 0.5);
    if (along === 'x') {
      const m = y + d / 2;
      this.poly([[x, y, z], [x + w, y, z], [x + w, m, z + rise], [x, m, z + rise]], tint(roof, 0.1), edge);
      this.poly([[x + w, y, z], [x + w, y + d, z], [x + w, m, z + rise]], shade(wall, 0.12), edge);
      this.poly([[x, y + d, z], [x + w, y + d, z], [x + w, m, z + rise], [x, m, z + rise]], shade(roof, 0.22), edge);
    } else {
      const m = x + w / 2;
      this.poly([[x, y, z], [x, y + d, z], [m, y + d, z + rise], [m, y, z + rise]], tint(roof, 0.1), edge);
      this.poly([[x, y + d, z], [x + w, y + d, z], [m, y + d, z + rise]], shade(wall, 0.34), edge);
      this.poly([[x + w, y, z], [x + w, y + d, z], [m, y + d, z + rise], [m, y, z + rise]], shade(roof, 0.06), edge);
    }
  }

  /** A four-sided pointed roof. */
  pyramid(x: number, y: number, w: number, d: number, z: number, rise: number, roof: string): void {
    const apex: P3 = [x + w / 2, y + d / 2, z + rise];
    const edge = shade(roof, 0.5);
    this.poly([[x, y + d, z], [x + w, y + d, z], apex], shade(roof, 0.26), edge);
    this.poly([[x + w, y, z], [x + w, y + d, z], apex], shade(roof, 0.04), edge);
  }

  /** An upright cylinder (or a cone when topR is 0). */
  cyl(cx: number, cy: number, r: number, z: number, h: number, color: string, topR = r, top?: string): void {
    const c = this.c;
    const k = Math.SQRT2 * this.v.hw;
    const [bx, by] = this.p(cx, cy, z);
    const [tx, ty] = this.p(cx, cy, z + h);
    const g = c.createLinearGradient(bx - r * k, 0, bx + r * k, 0);
    g.addColorStop(0, shade(color, 0.42));
    g.addColorStop(0.55, shade(color, 0.14));
    g.addColorStop(1, shade(color, 0.02));
    c.beginPath();
    c.ellipse(bx, by, r * k, r * k * 0.5, 0, 0, Math.PI);
    if (topR > 0) c.ellipse(tx, ty, topR * k, topR * k * 0.5, 0, Math.PI, 0, true);
    else c.lineTo(tx, ty);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = shade(color, 0.55);
    c.lineWidth = 1;
    c.stroke();
    if (topR > 0) {
      c.beginPath();
      c.ellipse(tx, ty, topR * k, topR * k * 0.5, 0, 0, Math.PI * 2);
      c.fillStyle = top ?? tint(color, 0.14);
      c.fill();
      c.stroke();
    }
  }

  /**
   * A window (or door) on one of a box's two visible faces.
   * face 'L' is the y+d wall, 'R' is the x+w wall. u0..u1 run along the wall (0..1), z0..z1 are heights.
   */
  pane(face: 'L' | 'R', x: number, y: number, w: number, d: number, u0: number, u1: number, z0: number, z1: number, fill: string): void {
    const pts: P3[] =
      face === 'L'
        ? [[x + w * u0, y + d, z0], [x + w * u1, y + d, z0], [x + w * u1, y + d, z1], [x + w * u0, y + d, z1]]
        : [[x + w, y + d * (1 - u0), z0], [x + w, y + d * (1 - u1), z0], [x + w, y + d * (1 - u1), z1], [x + w, y + d * (1 - u0), z1]];
    this.poly(pts, fill);
  }

  /** A soft additive glow at a point. */
  glow(x: number, y: number, z: number, radius: number, color: string, alpha: number): void {
    if (alpha <= 0.003) return;
    const c = this.c;
    const [sx, sy] = this.p(x, y, z);
    const r = radius * this.v.hw;
    const [cr, cg, cb] = hex(color);
    const g = c.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
    g.addColorStop(0.4, `rgba(${cr},${cg},${cb},${alpha * 0.35})`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = g;
    c.fillRect(sx - r, sy - r, r * 2, r * 2);
    c.restore();
  }

  /** Run drawing code in ground-plane coordinates: circles become ellipses, lines follow the grid. */
  ground(fn: (c: Ctx) => void): void {
    const c = this.c;
    const { hw, ox, oy } = this.v;
    c.save();
    c.transform(hw, hw * 0.5, -hw, hw * 0.5, ox, oy);
    fn(c);
    c.restore();
  }
}
