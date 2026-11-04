import { disc, Layer, makeCanvas, rect, RENDER, rng, snap, type Ctx } from './pixels';

// ------------------------------------------------------------------ time of day

/** Lighting for one moment of the day. */
export interface Sky {
  /** Colour multiplied over the world (white = untouched). */
  tint: [number, number, number];
  /** 0 = broad daylight, 1 = deep night: drives lamps, windows and fireflies. */
  night: number;
}

// minute of day → [r, g, b] multiply colour, night amount
const KEYS: [number, [number, number, number], number][] = [
  [0, [92, 104, 168], 1],
  [5 * 60, [92, 104, 168], 1],
  [6 * 60 + 30, [255, 196, 168], 0.35], // dawn
  [8 * 60, [255, 255, 255], 0],
  [17 * 60, [255, 255, 255], 0],
  [18 * 60 + 30, [255, 214, 160], 0.1], // golden hour
  [19 * 60 + 45, [196, 150, 196], 0.6], // dusk
  [21 * 60, [92, 104, 168], 1],
  [24 * 60, [92, 104, 168], 1],
];

export function skyAt(minute: number): Sky {
  const m = ((minute % 1440) + 1440) % 1440;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [m0, c0, n0] = KEYS[i];
    const [m1, c1, n1] = KEYS[i + 1];
    if (m >= m0 && m <= m1) {
      const k = m1 === m0 ? 0 : (m - m0) / (m1 - m0);
      const s = k * k * (3 - 2 * k); // ease
      return {
        tint: [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * s)) as [number, number, number],
        night: n0 + (n1 - n0) * s,
      };
    }
  }
  return { tint: [255, 255, 255], night: 0 };
}

/** Multiply the whole view by the sky colour. */
export function applySky(c: Ctx, sky: Sky, x: number, y: number, w: number, h: number): void {
  if (sky.tint.every((v) => v >= 255)) return;
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = `rgb(${sky.tint.join(',')})`;
  c.fillRect(x, y, w, h);
  c.restore();
}

/** A soft additive pool of light. */
export function glow(c: Ctx, x: number, y: number, r: number, col: string, a: number): void {
  if (a <= 0.01) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${col},${a})`);
  g.addColorStop(0.45, `rgba(${col},${a * 0.45})`);
  g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

// ------------------------------------------------------------------ wind

/** How hard the wind blows right now, 0..1. Gusts come and go every few seconds. */
export function gust(t: number): number {
  const v = Math.sin(t * 0.37) * 0.55 + Math.sin(t * 0.93 + 1.7) * 0.3 + Math.sin(t * 2.1 + 0.4) * 0.15;
  return Math.max(0, Math.min(1, v));
}

// ------------------------------------------------------------------ particles

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  col: string;
  /** Downward pull, px/s². */
  grav?: number;
  /** Sideways flutter amplitude (petals). */
  flutter?: number;
  /** Additive glow (fireworks, sparks). */
  bright?: boolean;
  phase?: number;
  /** Round puff that swells as it fades (smoke, steam). Value = extra radius at end of life. */
  grow?: number;
}

/** A pool of short-lived pixels: dust, petals, sparks, confetti. */
export class Particles {
  readonly list: Particle[] = [];

  add(p: Particle): void {
    if (this.list.length < 600) this.list.push(p);
  }

  step(dt: number, wind = 0): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += (p.grav ?? 0) * dt;
      p.x += (p.vx + (p.flutter ? wind * 18 : 0)) * dt;
      p.y += p.vy * dt;
      if (p.flutter) p.x += Math.sin((p.phase ?? 0) + p.life * 5) * p.flutter * dt;
    }
  }

  draw(c: Ctx): void {
    for (const p of this.list) {
      const a = p.grow !== undefined ? p.life / p.max : Math.min(1, p.life / Math.min(0.5, p.max * 0.5));
      c.globalAlpha = a;
      if (p.grow !== undefined) {
        const k = 1 - p.life / p.max;
        disc(c, p.x, p.y, p.size + k * p.grow, p.col);
      } else if (p.bright) {
        c.globalCompositeOperation = 'lighter';
        rect(c, p.x - p.size, p.y - p.size, p.size * 2 + 1, p.size * 2 + 1, p.col);
        c.globalCompositeOperation = 'source-over';
      } else rect(c, p.x, p.y, p.size, p.size, p.col);
    }
    c.globalAlpha = 1;
  }

  /** A little puff of dust at someone's feet. */
  dust(x: number, y: number): void {
    for (let i = 0; i < 3; i++)
      this.add({ x: x + (Math.random() - 0.5) * 4, y, vx: (Math.random() - 0.5) * 10, vy: -4 - Math.random() * 5, life: 0.45, max: 0.45, size: 1, col: 'rgba(214,190,140,0.9)' });
  }

  /** A firework: a rising spark that bursts into a ring of colour. */
  firework(x: number, y: number, col: string): void {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const sp = 26 + Math.random() * 18;
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1 + Math.random() * 0.4, max: 1.5, size: 1, col, grav: 22, bright: true });
    }
    for (let i = 0; i < 6; i++) this.add({ x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 0.35, max: 0.35, size: 2, col: '#fff8d0', bright: true });
  }

  /** Paper confetti that tumbles down. */
  confetti(x: number, y: number): void {
    const cols = ['#ff6a8a', '#ffd23f', '#5ee08a', '#5ab4ff', '#c08aff', '#ffffff'];
    for (let i = 0; i < 40; i++)
      this.add({ x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 10, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 40, life: 2 + Math.random(), max: 3, size: 1 + (Math.random() < 0.3 ? 1 : 0), col: cols[i % cols.length], grav: 60, flutter: 14, phase: Math.random() * 6 });
  }
}

// ------------------------------------------------------------------ cloud shadows

interface Cloud {
  x: number;
  y: number;
  speed: number;
  layer: Layer;
  w: number;
  h: number;
}

/** Soft shadows of clouds drifting over the town. */
export class CloudShadows {
  private clouds: Cloud[] = [];

  constructor(private worldW: number, private worldH: number) {
    const R = rng(91);
    for (let i = 0; i < 5; i++) {
      const w = 70 + Math.floor(R() * 60);
      const h = 34 + Math.floor(R() * 20);
      const seed = 100 + i * 17;
      this.clouds.push({ x: R() * worldW, y: R() * worldH, speed: 5 + R() * 4, w, h, layer: new Layer(() => CloudShadows.blob(w, h, seed)) });
    }
  }

  private static blob(w: number, h: number, seed: number): HTMLCanvasElement {
    const [shape, c] = makeCanvas(w, h);
    const R = rng(seed);
    c.fillStyle = '#000';
    // A cluster of overlapping stepped ovals: reads as a pixel-art cloud from above.
    for (let i = 0; i < 9; i++) {
      const rx = 10 + R() * (w / 4);
      const ry = 6 + R() * (h / 4);
      const cx = rx + R() * (w - rx * 2);
      const cy = ry + R() * (h - ry * 2);
      for (let y = -ry; y <= ry; y += 2) {
        const hw = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
        c.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 2);
      }
    }
    // Soften the edge: a cloud's shadow on the ground is fuzzy, not a hard stain.
    const pad = 8;
    const [cv, out] = makeCanvas(w + pad * 2, h + pad * 2);
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.filter = `blur(${Math.round(5 * RENDER.scale)}px)`;
    out.drawImage(shape, pad * RENDER.scale, pad * RENDER.scale);
    return cv;
  }

  step(dt: number, wind: number): void {
    for (const cl of this.clouds) {
      cl.x += cl.speed * (0.6 + wind) * dt;
      if (cl.x > this.worldW + 20) {
        cl.x = -cl.w - 20;
        cl.y = Math.random() * this.worldH;
      }
    }
  }

  draw(c: Ctx, alpha: number): void {
    if (alpha <= 0.005) return;
    c.save();
    c.globalAlpha = alpha;
    for (const cl of this.clouds) c.drawImage(cl.layer.get(), snap(cl.x - 8), snap(cl.y - 8), cl.w + 16, cl.h + 16);
    c.restore();
  }
}

// ------------------------------------------------------------------ birds

interface Flock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  birds: [number, number, number][]; // dx, dy, flap phase
}

/** Now and then a small flock crosses the sky, with shadows sliding over the ground below. */
export class Birds {
  private flock: Flock | undefined;
  private wait = 6;

  step(dt: number, view: { x: number; y: number; w: number; h: number }, night: number): void {
    if (this.flock) {
      const f = this.flock;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x > view.x + view.w + 80 || f.x < view.x - 120) this.flock = undefined;
      return;
    }
    this.wait -= dt;
    if (this.wait > 0 || night > 0.6) return;
    this.wait = 18 + Math.random() * 20;
    const n = 3 + Math.floor(Math.random() * 3);
    const birds: [number, number, number][] = [];
    for (let i = 0; i < n; i++) birds.push([-i * 9 - Math.random() * 3, (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 6, Math.random() * 6]);
    this.flock = { x: view.x - 30, y: view.y + 20 + Math.random() * (view.h - 60), vx: 40 + Math.random() * 12, vy: -4 + Math.random() * 8, birds };
  }

  draw(c: Ctx, t: number): void {
    const f = this.flock;
    if (!f) return;
    for (const [dx, dy, ph] of f.birds) {
      const x = f.x + dx;
      const y = f.y + dy + Math.sin(t * 3 + ph) * 1.5;
      // shadow on the ground, offset as if the sun is high in the south-west
      rect(c, x + 16, y + 34, 3, 1, 'rgba(0,0,0,0.16)');
      const up = Math.floor(t * 9 + ph) % 2 === 0;
      const col = '#2a2430';
      rect(c, x, y, 1, 1, col);
      if (up) {
        rect(c, x - 2, y - 1, 2, 1, col);
        rect(c, x + 1, y - 1, 2, 1, col);
        rect(c, x - 3, y - 2, 1, 1, col);
        rect(c, x + 3, y - 2, 1, 1, col);
      } else {
        rect(c, x - 2, y, 2, 1, col);
        rect(c, x + 1, y, 2, 1, col);
        rect(c, x - 3, y + 1, 1, 1, col);
        rect(c, x + 3, y + 1, 1, 1, col);
      }
    }
  }
}

// ------------------------------------------------------------------ fireflies

/** Fireflies drifting over grass and flowers after dark. */
export class Fireflies {
  private flies: { x: number; y: number; ph: number; sp: number }[] = [];

  constructor(spots: [number, number][]) {
    const R = rng(55);
    for (const [x, y] of spots) this.flies.push({ x: x + R() * 16, y: y + R() * 16, ph: R() * 10, sp: 0.5 + R() * 0.8 });
  }

  draw(c: Ctx, t: number, night: number, view: { x: number; y: number; w: number; h: number }): void {
    if (night < 0.25) return;
    for (const f of this.flies) {
      const x = f.x + Math.sin(t * f.sp + f.ph) * 10;
      const y = f.y + Math.sin(t * f.sp * 1.3 + f.ph * 2) * 6;
      if (x < view.x - 10 || x > view.x + view.w + 10 || y < view.y - 10 || y > view.y + view.h + 10) continue;
      const blink = Math.max(0, Math.sin(t * 2.2 + f.ph * 3));
      const a = blink * (night - 0.25) / 0.75;
      if (a < 0.05) continue;
      glow(c, x, y, 6, '255,240,140', 0.5 * a);
      c.globalAlpha = a;
      rect(c, x, y, 1, 1, '#fff6b0');
      c.globalAlpha = 1;
    }
  }
}

/** True when the player has asked their system for less motion. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
