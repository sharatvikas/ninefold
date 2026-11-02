export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SolidAt = (px: number, py: number) => boolean;

function boxHits(b: Box, solidAt: SolidAt): boolean {
  // Sample the corners plus midpoints (boxes are smaller than a tile, so this is enough).
  const xs = [b.x, b.x + b.w / 2, b.x + b.w - 0.01];
  const ys = [b.y, b.y + b.h - 0.01];
  for (const x of xs) for (const y of ys) if (solidAt(x, y)) return true;
  return false;
}

/** Move a box by (dx, dy), sliding along walls. Each axis is resolved separately. */
export function moveBox(b: Box, dx: number, dy: number, solidAt: SolidAt): Box {
  let out = { ...b };
  if (dx !== 0) {
    const tryX = { ...out, x: out.x + dx };
    if (!boxHits(tryX, solidAt)) out = tryX;
  }
  if (dy !== 0) {
    const tryY = { ...out, y: out.y + dy };
    if (!boxHits(tryY, solidAt)) out = tryY;
  }
  return out;
}
