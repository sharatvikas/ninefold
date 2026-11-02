export type Ctx = CanvasRenderingContext2D;
export type Palette = Record<string, string>;

/**
 * The game is laid out in a 384x216 "logical" space, but drawn at the screen's real
 * resolution: RENDER.scale device pixels per logical pixel. Everything snaps to device
 * pixels, so art stays sharp, text is crisp, and motion is smooth on big displays.
 */
export const RENDER = { scale: 1 };

/** Snap a logical coordinate to the nearest device pixel. */
export function snap(v: number): number {
  const k = RENDER.scale;
  return Math.round(v * k) / k;
}

type ScaledCanvas = HTMLCanvasElement & { renderScale?: number };

/** An offscreen canvas sized in logical pixels, drawn at the current render scale. */
export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const k = RENDER.scale;
  const cv = document.createElement('canvas') as ScaledCanvas;
  cv.width = Math.ceil(w * k);
  cv.height = Math.ceil(h * k);
  cv.renderScale = k;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('2D canvas not supported');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return [cv, ctx];
}

/** Draw a makeCanvas() canvas at logical position/size. */
export function blit(c: Ctx, cv: HTMLCanvasElement, x: number, y: number, w: number, h: number): void {
  c.drawImage(cv, 0, 0, cv.width, cv.height, snap(x), snap(y), w, h);
}

/** Rebuilds a cached offscreen layer whenever the render scale changes. */
export class Layer {
  private cv: ScaledCanvas | undefined;
  constructor(private build: () => HTMLCanvasElement) {}
  get(): HTMLCanvasElement {
    if (!this.cv || this.cv.renderScale !== RENDER.scale) this.cv = this.build() as ScaledCanvas;
    return this.cv;
  }
}

export function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  c.fillStyle = col;
  const x0 = snap(x);
  const y0 = snap(y);
  c.fillRect(x0, y0, snap(x + w) - x0, snap(y + h) - y0);
}

/** Filled pixel circle (no anti-aliasing). */
export function disc(c: Ctx, cx: number, cy: number, r: number, col: string): void {
  c.fillStyle = col;
  cx = snap(cx);
  cy = snap(cy);
  r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    c.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

/** Filled pixel ellipse. */
export function ellipse(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: string): void {
  c.fillStyle = col;
  cx = snap(cx);
  cy = snap(cy);
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    c.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, v + amt));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Small deterministic PRNG so static art looks the same every load. */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822519) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

/** Draw a sprite described as rows of palette characters ('.' = transparent). */
export function sprite(c: Ctx, rows: readonly string[], x: number, y: number, pal: Palette, scale = 1, flip = false): void {
  x = snap(x);
  y = snap(y);
  rows.forEach((row, j) => {
    const w = row.length;
    for (let i = 0; i < w; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const col = pal[ch];
      if (!col) continue;
      c.fillStyle = col;
      const px = flip ? w - 1 - i : i;
      c.fillRect(x + px * scale, y + j * scale, scale, scale);
    }
  });
}

/** Pixel text using the loaded pixel font. */
export function pixelText(c: Ctx, text: string, x: number, y: number, col: string, size = 5): void {
  c.font = `${size}px "Press Start 2P"`;
  c.fillStyle = col;
  c.fillText(text, snap(x), snap(y));
}
