export type Ctx = CanvasRenderingContext2D;
export type Palette = Record<string, string>;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('2D canvas not supported');
  ctx.imageSmoothingEnabled = false;
  return [cv, ctx];
}

export function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Filled pixel circle (no anti-aliasing). */
export function disc(c: Ctx, cx: number, cy: number, r: number, col: string): void {
  c.fillStyle = col;
  cx = Math.round(cx);
  cy = Math.round(cy);
  r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    c.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

/** Filled pixel ellipse. */
export function ellipse(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: string): void {
  c.fillStyle = col;
  cx = Math.round(cx);
  cy = Math.round(cy);
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
  x = Math.round(x);
  y = Math.round(y);
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
  c.fillText(text, Math.round(x), Math.round(y));
}
