/**
 * The town of Ninefold at night, drawn as a small isometric model.
 * It is also the status page: windows light up as a district's tickets are closed,
 * and a beacon pulses over any district with a ticket waiting.
 */
import type { DistrictId } from '../curriculum/catalog';
import { rng } from '../game/rng';
import { Pen, fitView, focusView, mix, project, shade, tint, type Ctx, type P2, type View } from './iso';

export const SIZE = 12;
const MID = SIZE / 2;

export interface Site {
  id: DistrictId;
  /** Centre of the district on the grid. */
  x: number;
  y: number;
  /** Height of the label above the ground. */
  top: number;
}

export const SITES: Site[] = [
  { id: 'watch', x: 1.9, y: 2.9, top: 3.9 },
  { id: 'hall', x: 6.1, y: 2.0, top: 3.0 },
  { id: 'rail', x: 9.7, y: 2.9, top: 2.0 },
  { id: 'post', x: 2.2, y: 6.0, top: 2.3 },
  { id: 'big', x: 6.0, y: 6.0, top: 4.1 },
  { id: 'arch', x: 9.8, y: 6.2, top: 2.7 },
  { id: 'lock', x: 2.8, y: 9.6, top: 2.2 },
  { id: 'granary', x: 6.2, y: 9.8, top: 3.0 },
  { id: 'harbor', x: 9.9, y: 9.9, top: 2.3 },
];

export const siteOf = (id: DistrictId): Site => SITES.find((s) => s.id === id)!;

export interface DistrictLight {
  /** Share of this district's tickets that are closed, 0..1. */
  lit: number;
  /** A ticket is waiting here. */
  open: boolean;
}

export interface TownState {
  districts: Record<DistrictId, DistrictLight>;
  selected?: DistrictId;
  /** The town's nines, 1..9. Drives the bell tower's glow. */
  nines: number;
}

export interface Focus {
  id: DistrictId;
  mood: 'broken' | 'fixed';
}

export interface DrawOptions {
  /** Seconds since the scene started. */
  t: number;
  /** Draw a single still frame worth of motion (no drifting parts). */
  calm: boolean;
  focus?: Focus;
}

const C = {
  waterDeep: '#081120',
  water: '#0e1c33',
  waterLit: '#1b3558',
  grass: '#1d3b3a',
  grassLit: '#27504a',
  grassDark: '#16302f',
  cliff: '#3b3350',
  cliffDark: '#211c33',
  path: '#565072',
  plaza: '#6a6385',
  lamp: '#ffc96b',
  window: '#ffd58a',
  dark: '#141b2e',
  beacon: '#ff6f5e',
  ok: '#7fe6b6',
  pine: '#17393a',
  pineLit: '#24564f',
  trunk: '#3a2c2a',
};

const WALL: Record<DistrictId, string> = {
  post: '#a25a52',
  rail: '#6d7591',
  arch: '#7f7fb0',
  harbor: '#4c8291',
  watch: '#8d86a0',
  lock: '#a88a4e',
  granary: '#a56f47',
  hall: '#a9a394',
  big: '#7a6796',
};
const ROOF = '#2c3557';
const ROOF_WARM = '#7a3f44';

/** Is a grid point on the island? */
export function onIsland(x: number, y: number, margin = 0): boolean {
  const n = 3.4;
  const r = 6.55 - margin;
  return Math.abs(x - MID) ** n + Math.abs(y - MID) ** n < r ** n;
}

function islandOutline(): P2[] {
  const pts: P2[] = [];
  const n = 3.4;
  const r = 6.55;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const k = r / (Math.abs(ca) ** n + Math.abs(sa) ** n) ** (1 / n);
    pts.push([MID + ca * k, MID + sa * k]);
  }
  return pts;
}
const OUTLINE = islandOutline();

interface Tree {
  x: number;
  y: number;
  s: number;
}

function plantTrees(): Tree[] {
  const R = rng(9);
  const out: Tree[] = [];
  let guard = 0;
  while (out.length < 46 && guard++ < 4000) {
    const x = R() * SIZE;
    const y = R() * SIZE;
    if (!onIsland(x, y, 0.7)) continue;
    if (SITES.some((s) => Math.hypot(s.x - x, s.y - y) < (s.id === 'big' ? 1.7 : 1.75))) continue;
    if (nearPath(x, y, 0.5) || (y < 1.6 && x > 4.6)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.y - y) < 0.55)) continue;
    out.push({ x, y, s: 0.75 + R() * 0.55 });
  }
  return out;
}

/** Paths run from each district to the plaza with one right-angle turn. */
function pathOf(s: Site): P2[] {
  if (s.id === 'big') return [];
  const horizontalFirst = Math.abs(s.x - MID) < Math.abs(s.y - MID);
  return horizontalFirst ? [[s.x, s.y], [MID, s.y], [MID, MID]] : [[s.x, s.y], [s.x, MID], [MID, MID]];
}

function nearPath(x: number, y: number, r: number): boolean {
  for (const s of SITES) {
    const p = pathOf(s);
    for (let i = 0; i + 1 < p.length; i++) {
      const [ax, ay] = p[i];
      const [bx, by] = p[i + 1];
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
      if (Math.hypot(ax + (bx - ax) * t - x, ay + (by - ay) * t - y) < r) return true;
    }
  }
  return false;
}

const TREES = plantTrees();
const LAMPS: P2[] = [[6.9, 4.1], [4.1, 5.1], [5.1, 8.0], [7.9, 6.9], [8.0, 3.6], [3.4, 7.9], [8.3, 8.9], [4.4, 3.2]];
const RIPPLES = (() => {
  const R = rng(4);
  return Array.from({ length: 64 }, () => ({ x: R(), y: R(), w: 0.02 + R() * 0.05, sp: 0.3 + R() * 0.7, ph: R() * 6.28 }));
})();
const FLIES = (() => {
  const R = rng(21);
  return Array.from({ length: 14 }, (_, i) => ({ t: TREES[(i * 3) % TREES.length], ph: R() * 6.28, sp: 0.4 + R() * 0.5 }));
})();

/** Where the ticket scene looks, relative to the district's centre (the harbor's ship sits out on the water). */
const FOCUS_SHIFT: Partial<Record<DistrictId, P2>> = { harbor: [0.5, 1.0], rail: [-0.3, -0.6] };

type Item = { depth: number; draw: () => void };

export class Town {
  private view: View = { ox: 0, oy: 0, hw: 10 };
  private w = 0;
  private h = 0;

  /** Lay the scene out for a canvas of this CSS size. */
  layout(w: number, h: number, focus?: Focus): View {
    this.w = w;
    this.h = h;
    if (focus) {
      const s = siteOf(focus.id);
      const [dx, dy] = FOCUS_SHIFT[s.id] ?? [0, 0];
      this.view = focusView(w, h, s.x + dx, s.y + dy, Math.min(w / 10.5, h / 5.2), s.top * 0.4);
    } else {
      this.view = fitView(w, h, SIZE);
    }
    return this.view;
  }

  /** Where a district's label sits, and where its feet are, in CSS pixels. */
  anchor(id: DistrictId): { label: P2; base: P2 } {
    const s = siteOf(id);
    return { label: project(this.view, s.x, s.y, s.top), base: project(this.view, s.x, s.y, 0) };
  }

  /** The district under a point, if any. */
  districtAt(px: number, py: number): DistrictId | undefined {
    let best: DistrictId | undefined;
    let bestD = this.view.hw * 2.3;
    for (const s of SITES) {
      const [bx, by] = project(this.view, s.x, s.y, s.top * 0.4);
      const d = Math.hypot((bx - px) * 0.9, by - py);
      if (d < bestD) [best, bestD] = [s.id, d];
    }
    return best;
  }

  draw(c: Ctx, st: TownState, o: DrawOptions): void {
    const pen = new Pen(c, this.view);
    const t = o.calm ? 0 : o.t;
    this.water(c, pen, t, o);
    this.island(c, pen);
    this.groundLayer(pen, st, t, o);

    const items: Item[] = [];
    for (const tr of TREES) items.push({ depth: tr.x + tr.y, draw: () => tree(pen, tr, t) });
    for (const [x, y] of LAMPS) items.push({ depth: x + y, draw: () => lamp(pen, x, y, t) });
    for (const s of SITES) {
      const light = lightFor(st, s.id, o.focus);
      items.push({ depth: s.x + s.y + (s.id === 'harbor' ? 0.6 : 0), draw: () => BUILD[s.id](pen, s, light, t, st) });
    }
    items.push({ depth: 1.2 + trainX(t), draw: () => train(pen, t, lightFor(st, 'rail', o.focus)) });
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();

    if (!o.focus) {
      beam(pen, t, lightFor(st, 'watch').lit);
      for (const s of SITES) {
        const d = st.districts[s.id];
        if (d.open) beacon(pen, s, t, st.selected === s.id);
        else if (d.lit >= 1) pen.glow(s.x, s.y, s.top - 0.5, 1.6, C.ok, 0.1);
      }
      for (const f of FLIES) {
        const a = t * f.sp + f.ph;
        pen.glow(f.t.x + Math.cos(a) * 0.5, f.t.y + Math.sin(a * 1.3) * 0.5, 0.5 + Math.sin(a * 2.1) * 0.25, 0.16, '#d9ff9a', 0.5 + 0.4 * Math.sin(a * 3));
      }
    } else if (o.focus.mood === 'broken') {
      const s = siteOf(o.focus.id);
      const pulse = o.calm ? 0.7 : 0.55 + 0.45 * Math.sin(o.t * 4.2);
      pen.glow(s.x, s.y, s.top * 0.55, 3.6, C.beacon, 0.2 + 0.16 * pulse);
      beacon(pen, s, t, true);
    } else {
      const s = siteOf(o.focus.id);
      pen.glow(s.x, s.y, s.top * 0.5, 3.8, C.lamp, 0.22);
      pen.glow(s.x, s.y, s.top - 0.4, 1.4, C.ok, 0.25);
    }
    this.vignette(c, o);
  }

  private water(c: Ctx, pen: Pen, t: number, o: DrawOptions): void {
    const { w, h } = this;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, C.waterDeep);
    g.addColorStop(0.55, C.water);
    g.addColorStop(1, '#0a1628');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // Moonlight on the water, upper left.
    const [mx, my] = o.focus ? [w * 0.2, h * 0.1] : pen.p(-1.5, 3.5);
    const m = c.createRadialGradient(mx, my, 0, mx, my, Math.max(w, h) * 0.55);
    m.addColorStop(0, 'rgba(96,140,200,0.28)');
    m.addColorStop(1, 'rgba(96,140,200,0)');
    c.fillStyle = m;
    c.fillRect(0, 0, w, h);
    c.lineCap = 'round';
    for (const r of RIPPLES) {
      const x = ((r.x + t * 0.004 * r.sp) % 1) * w;
      const y = r.y * h;
      const a = 0.05 + 0.07 * (0.5 + 0.5 * Math.sin(t * r.sp + r.ph));
      c.strokeStyle = `rgba(150,190,235,${a})`;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + r.w * w, y);
      c.stroke();
    }
  }

  private island(c: Ctx, pen: Pen): void {
    const drop = 0.8;
    // Soft shadow on the water.
    c.save();
    c.filter = 'none';
    c.beginPath();
    OUTLINE.forEach(([x, y], i) => {
      const [sx, sy] = pen.p(x, y, -drop - 0.25);
      if (i === 0) c.moveTo(sx, sy);
      else c.lineTo(sx, sy);
    });
    c.closePath();
    c.fillStyle = 'rgba(3,6,14,0.55)';
    c.fill();
    c.restore();
    // Cliff: the outline pushed down, joined to the top.
    const cliff = c.createLinearGradient(0, pen.p(0, 0)[1], 0, pen.p(SIZE, SIZE, -drop)[1]);
    cliff.addColorStop(0, C.cliff);
    cliff.addColorStop(1, C.cliffDark);
    c.beginPath();
    OUTLINE.forEach(([x, y], i) => {
      const [sx, sy] = pen.p(x, y, -drop);
      if (i === 0) c.moveTo(sx, sy);
      else c.lineTo(sx, sy);
    });
    c.closePath();
    c.fillStyle = cliff;
    c.fill();
    c.beginPath();
    OUTLINE.forEach(([x, y], i) => {
      const [sx, sy] = pen.p(x, y, 0);
      if (i === 0) c.moveTo(sx, sy);
      else c.lineTo(sx, sy);
    });
    c.closePath();
    c.fillStyle = cliff;
    c.fill();
    // Foam where rock meets water.
    c.strokeStyle = 'rgba(170,205,240,0.22)';
    c.lineWidth = 1.5;
    c.beginPath();
    OUTLINE.forEach(([x, y], i) => {
      if (x + y < MID * 2 - 2) return;
      const [sx, sy] = pen.p(x, y, -drop);
      if (i === 0 || OUTLINE[i - 1][0] + OUTLINE[i - 1][1] < MID * 2 - 2) c.moveTo(sx, sy);
      else c.lineTo(sx, sy);
    });
    c.stroke();
    // Grass.
    const [gx0, gy0] = pen.p(0, 0);
    const [, gy1] = pen.p(SIZE, SIZE);
    const grass = c.createLinearGradient(gx0, gy0, gx0, gy1);
    grass.addColorStop(0, C.grassLit);
    grass.addColorStop(1, C.grassDark);
    c.beginPath();
    OUTLINE.forEach(([x, y], i) => {
      const [sx, sy] = pen.p(x, y, 0);
      if (i === 0) c.moveTo(sx, sy);
      else c.lineTo(sx, sy);
    });
    c.closePath();
    c.fillStyle = grass;
    c.fill();
    c.strokeStyle = 'rgba(120,190,170,0.25)';
    c.lineWidth = 1;
    c.stroke();
  }

  private groundLayer(pen: Pen, st: TownState, t: number, o: DrawOptions): void {
    pen.ground((c) => {
      // Meadow patches.
      const R = rng(3);
      for (let i = 0; i < 26; i++) {
        const x = R() * SIZE;
        const y = R() * SIZE;
        const r = 0.5 + R() * 0.9;
        if (!onIsland(x, y, r + 0.2)) continue;
        c.fillStyle = i % 2 ? 'rgba(60,120,105,0.16)' : 'rgba(10,25,30,0.18)';
        c.beginPath();
        c.arc(x, y, r, 0, 6.3);
        c.fill();
      }
      // Paths.
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const pass of [0, 1]) {
        c.strokeStyle = pass ? C.path : 'rgba(8,12,24,0.45)';
        c.lineWidth = pass ? 0.34 : 0.5;
        for (const s of SITES) {
          const p = pathOf(s);
          if (!p.length) continue;
          c.beginPath();
          p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
          c.stroke();
        }
      }
      // Plaza.
      c.fillStyle = C.plaza;
      c.beginPath();
      c.arc(MID, MID, 1.25, 0, 6.3);
      c.fill();
      c.strokeStyle = 'rgba(20,18,40,0.5)';
      c.lineWidth = 0.05;
      for (const r of [0.55, 0.9, 1.25]) {
        c.beginPath();
        c.arc(MID, MID, r, 0, 6.3);
        c.stroke();
      }
      // Yards under each district.
      for (const s of SITES) {
        if (s.id === 'big') continue;
        c.fillStyle = 'rgba(86,80,114,0.55)';
        c.beginPath();
        c.arc(s.x, s.y, s.id === 'hall' ? 1.75 : 1.4, 0, 6.3);
        c.fill();
      }
      // Railway along the back edge.
      c.strokeStyle = '#2a2740';
      c.lineWidth = 0.42;
      c.lineCap = 'butt';
      c.beginPath();
      c.moveTo(5.2, 0.95);
      c.lineTo(11.2, 0.95);
      c.stroke();
      c.strokeStyle = '#9a93b8';
      c.lineWidth = 0.035;
      for (const dy of [-0.12, 0.12]) {
        c.beginPath();
        c.moveTo(5.2, 0.95 + dy);
        c.lineTo(11.2, 0.95 + dy);
        c.stroke();
      }
      c.strokeStyle = '#5b4a46';
      c.lineWidth = 0.06;
      for (let x = 5.35; x < 11.2; x += 0.3) {
        c.beginPath();
        c.moveTo(x, 0.74);
        c.lineTo(x, 1.16);
        c.stroke();
      }
      // The selected district gets a ring on the ground.
      if (st.selected && !o.focus) {
        const s = siteOf(st.selected);
        c.strokeStyle = 'rgba(255,201,107,0.9)';
        c.lineWidth = 0.07;
        c.setLineDash([0.22, 0.16]);
        c.lineDashOffset = -t * 0.35;
        c.beginPath();
        c.arc(s.x, s.y, s.id === 'hall' ? 1.9 : 1.55, 0, 6.3);
        c.stroke();
        c.setLineDash([]);
      }
    });
  }

  private vignette(c: Ctx, o: DrawOptions): void {
    const { w, h } = this;
    const g = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(5,8,18,0)');
    g.addColorStop(1, o.focus ? 'rgba(5,8,18,0.72)' : 'rgba(5,8,18,0.6)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
}

function lightFor(st: TownState, id: DistrictId, focus?: Focus): DistrictLight & { mood?: 'broken' | 'fixed' } {
  if (focus) return focus.id === id ? { lit: focus.mood === 'fixed' ? 1 : 0, open: false, mood: focus.mood } : { lit: 0.35, open: false };
  return st.districts[id];
}

type Light = ReturnType<typeof lightFor>;

/** Windows come on in a fixed scattered order as `lit` rises. */
class Windows {
  private n = 0;
  constructor(
    private pen: Pen,
    private light: Light,
    private t: number,
  ) {}

  pane(face: 'L' | 'R', x: number, y: number, w: number, d: number, u0: number, u1: number, z0: number, z1: number): void {
    const slot = this.n++;
    const rank = (slot * 0.618034 + 0.31) % 1;
    const on = rank < this.light.lit;
    const alarm = this.light.mood === 'broken' && slot % 3 === 0;
    const flick = 0.9 + 0.1 * Math.sin(this.t * (1.3 + (slot % 5) * 0.4) + slot);
    const fill = on ? mix('#b8782f', C.window, flick) : alarm ? mix(C.dark, C.beacon, 0.45 + 0.3 * Math.sin(this.t * 4.2 + slot)) : C.dark;
    this.pen.pane(face, x, y, w, d, u0, u1, z0, z1, fill);
    if (on) {
      const mx = face === 'L' ? x + w * (u0 + u1) * 0.5 : x + w + 0.05;
      const my = face === 'L' ? y + d + 0.05 : y + d * (1 - (u0 + u1) * 0.5);
      this.pen.glow(mx, my, (z0 + z1) / 2, 0.55, C.lamp, 0.2 * flick);
    }
  }

  /** A row of evenly spaced windows along a wall. */
  row(face: 'L' | 'R', x: number, y: number, w: number, d: number, count: number, z0: number, z1: number, margin = 0.12): void {
    const span = (1 - margin * 2) / count;
    for (let i = 0; i < count; i++) {
      const u = margin + span * i;
      this.pane(face, x, y, w, d, u + span * 0.2, u + span * 0.8, z0, z1);
    }
  }
}

function smoke(pen: Pen, x: number, y: number, z: number, t: number, strength = 1): void {
  if (strength <= 0) return;
  const c = pen.c;
  for (let i = 0; i < 5; i++) {
    const k = (t * 0.22 + i / 5) % 1;
    const [sx, sy] = pen.p(x + k * 0.5, y - k * 0.2, z + k * 1.6);
    c.fillStyle = `rgba(190,200,225,${0.2 * (1 - k) * strength})`;
    c.beginPath();
    c.arc(sx, sy, pen.v.hw * (0.1 + k * 0.22), 0, 6.3);
    c.fill();
  }
}

function tree(pen: Pen, tr: Tree, t: number): void {
  const c = pen.c;
  const sway = Math.sin(t * 0.8 + tr.x * 2 + tr.y) * 0.02;
  pen.ground((g) => {
    g.fillStyle = 'rgba(5,10,18,0.35)';
    g.beginPath();
    g.arc(tr.x + 0.08, tr.y + 0.08, 0.26 * tr.s, 0, 6.3);
    g.fill();
  });
  const [bx, by] = pen.p(tr.x, tr.y, 0);
  const u = pen.v.hw * tr.s;
  c.fillStyle = C.trunk;
  c.fillRect(bx - u * 0.05, by - u * 0.3, u * 0.1, u * 0.3);
  for (let i = 0; i < 3; i++) {
    const base = by - u * (0.22 + i * 0.36);
    const half = u * (0.42 - i * 0.1);
    const tip = base - u * 0.62;
    const lean = sway * u * (i + 1);
    c.beginPath();
    c.moveTo(bx - half, base);
    c.lineTo(bx + lean, tip);
    c.lineTo(bx + half, base);
    c.closePath();
    c.fillStyle = C.pine;
    c.fill();
    c.beginPath();
    c.moveTo(bx - half, base);
    c.lineTo(bx + lean, tip);
    c.lineTo(bx - half * 0.1, base);
    c.closePath();
    c.fillStyle = C.pineLit;
    c.fill();
  }
}

function lamp(pen: Pen, x: number, y: number, t: number): void {
  const c = pen.c;
  const [bx, by] = pen.p(x, y, 0);
  const [tx, ty] = pen.p(x, y, 0.62);
  c.strokeStyle = '#1a1830';
  c.lineWidth = Math.max(1, pen.v.hw * 0.05);
  c.beginPath();
  c.moveTo(bx, by);
  c.lineTo(tx, ty);
  c.stroke();
  c.fillStyle = C.lamp;
  c.beginPath();
  c.arc(tx, ty, Math.max(1.2, pen.v.hw * 0.07), 0, 6.3);
  c.fill();
  pen.glow(x, y, 0.62, 0.9, C.lamp, 0.26 + 0.03 * Math.sin(t * 2 + x));
  pen.glow(x, y, 0, 0.8, C.lamp, 0.1);
}

function beacon(pen: Pen, s: Site, t: number, selected: boolean): void {
  const c = pen.c;
  const [sx, sy] = pen.p(s.x, s.y, s.top - 0.35);
  const k = (t * 0.7 + s.x * 0.13) % 1;
  const u = pen.v.hw;
  c.strokeStyle = `rgba(255,111,94,${0.7 * (1 - k)})`;
  c.lineWidth = 1.5;
  c.beginPath();
  c.ellipse(sx, sy, u * (0.2 + k * 0.9), u * (0.1 + k * 0.45), 0, 0, 6.3);
  c.stroke();
  pen.glow(s.x, s.y, s.top - 0.35, selected ? 1.5 : 1.2, C.beacon, 0.3 + 0.2 * Math.sin(t * 4));
  c.fillStyle = C.beacon;
  c.beginPath();
  c.arc(sx, sy, Math.max(2, u * 0.11), 0, 6.3);
  c.fill();
}

/** The Watchtower's lamp sweeps the bay once its district has any light at all. */
function beam(pen: Pen, t: number, lit: number): void {
  if (lit <= 0) return;
  const c = pen.c;
  const s = siteOf('watch');
  const [sx, sy] = pen.p(s.x, s.y, 3.15);
  const a = t * 0.35;
  const len = pen.v.hw * 9;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const off of [0, Math.PI]) {
    const dx = Math.cos(a + off);
    const dy = Math.sin(a + off) * 0.5;
    const g = c.createLinearGradient(sx, sy, sx + dx * len, sy + dy * len);
    g.addColorStop(0, `rgba(255,214,140,${0.1 + 0.16 * lit})`);
    g.addColorStop(1, 'rgba(255,214,140,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(sx + Math.cos(a + off - 0.11) * len, sy + Math.sin(a + off - 0.11) * 0.5 * len);
    c.lineTo(sx + Math.cos(a + off + 0.11) * len, sy + Math.sin(a + off + 0.11) * 0.5 * len);
    c.closePath();
    c.fill();
  }
  c.restore();
}

const trainX = (t: number): number => 8.2 + Math.sin(t * 0.22) * 2.1;

function train(pen: Pen, t: number, light: Light): void {
  const x = trainX(t);
  const y = 0.72;
  const cars: [number, string, number][] = [[0, '#b5523b', 0.42], [-0.62, '#4f6f8f', 0.34], [-1.24, '#8a7a3c', 0.34]];
  for (const [dx, color, h] of [...cars].reverse()) {
    pen.box(x + dx, y, 0.52, 0.42, 0.08, h, color, shade(color, 0.3));
    if (light.lit > 0 || light.mood === 'fixed') pen.pane('L', x + dx, y, 0.52, 0.42, 0.2, 0.8, 0.22, 0.34, C.window);
  }
  pen.cyl(x + 0.38, y + 0.21, 0.07, 0.5, 0.2, '#2a2740');
  if (light.mood !== 'broken') smoke(pen, x + 0.38, y + 0.21, 0.7, t, 0.9);
  pen.glow(x + 0.6, y + 0.21, 0.3, 0.6, C.lamp, 0.3);
}

type Builder = (pen: Pen, s: Site, light: Light, t: number, st: TownState) => void;

const BUILD: Record<DistrictId, Builder> = {
  post(pen, s, light, t) {
    const col = WALL.post;
    const [x, y] = [s.x - 1.0, s.y - 0.75];
    const w = new Windows(pen, light, t);
    pen.box(x, y, 2.0, 1.5, 0, 1.0, col);
    w.row('L', x, y, 2.0, 1.5, 4, 0.4, 0.78);
    w.row('R', x, y, 2.0, 1.5, 2, 0.4, 0.78, 0.2);
    pen.pane('R', x, y, 2.0, 1.5, 0.42, 0.58, 0, 0.5, '#3a2622');
    pen.box(x + 1.35, y + 0.25, 0.26, 0.26, 1.0, 0.75, shade(col, 0.2));
    pen.gable(x - 0.08, y - 0.08, 2.16, 1.66, 1.0, 0.62, 'x', ROOF_WARM, col);
    if (light.lit > 0) smoke(pen, x + 1.48, y + 0.38, 1.8, t);
    // Post box and its little flag.
    pen.box(s.x + 1.2, s.y + 0.9, 0.16, 0.16, 0, 0.36, '#c9473d');
    pen.box(s.x + 1.17, s.y + 0.87, 0.22, 0.22, 0.36, 0.12, '#e25a4c');
  },

  rail(pen, s, light, t) {
    const col = WALL.rail;
    const [x, y] = [s.x - 1.3, s.y - 0.6];
    const w = new Windows(pen, light, t);
    pen.box(x - 0.15, y - 0.85, 2.9, 0.5, 0, 0.1, '#5d5876');
    pen.box(x, y, 2.6, 1.1, 0, 0.8, col);
    w.row('L', x, y, 2.6, 1.1, 5, 0.3, 0.62);
    w.row('R', x, y, 2.6, 1.1, 2, 0.3, 0.62, 0.18);
    pen.gable(x - 0.1, y - 0.1, 2.8, 1.3, 0.8, 0.5, 'x', ROOF, col);
    // Clock gable in the middle.
    pen.box(x + 1.0, y + 0.55, 0.6, 0.6, 0.8, 0.55, col);
    pen.gable(x + 0.95, y + 0.5, 0.7, 0.7, 1.35, 0.32, 'y', ROOF, col);
    const [cx, cy] = pen.p(x + 1.3, y + 1.16, 1.1);
    pen.c.fillStyle = light.lit > 0 ? '#ffe9bd' : '#3b4260';
    pen.c.beginPath();
    pen.c.ellipse(cx, cy, pen.v.hw * 0.13, pen.v.hw * 0.15, 0, 0, 6.3);
    pen.c.fill();
    // Signal post.
    pen.box(s.x + 1.55, s.y - 1.2, 0.07, 0.07, 0, 1.1, '#23213a');
    const sig = light.mood === 'broken' ? C.beacon : light.lit > 0 ? C.ok : '#59607e';
    pen.glow(s.x + 1.58, s.y - 1.17, 1.12, 0.45, sig, light.lit > 0 || light.mood ? 0.55 : 0.12);
  },

  arch(pen, s, light, t) {
    const col = WALL.arch;
    const w = new Windows(pen, light, t);
    const [x, y] = [s.x - 0.95, s.y - 0.9];
    pen.box(x + 1.0, y + 0.9, 0.95, 0.95, 0, 0.75, tint(col, 0.1));
    w.row('L', x + 1.0, y + 0.9, 0.95, 0.95, 2, 0.25, 0.6);
    w.row('R', x + 1.0, y + 0.9, 0.95, 0.95, 2, 0.25, 0.6);
    pen.box(x, y, 1.55, 1.55, 0, 1.55, col, '#3c4168');
    w.row('L', x, y, 1.55, 1.55, 3, 0.25, 0.6);
    w.row('L', x, y, 1.55, 1.55, 3, 0.85, 1.25);
    w.row('R', x, y, 1.55, 1.55, 3, 0.85, 1.25);
    // Drafting-room skylight and a rooftop frame, like a building still being drawn.
    pen.poly([[x + 0.3, y + 0.3, 1.56], [x + 1.25, y + 0.3, 1.56], [x + 1.25, y + 1.25, 1.56], [x + 0.3, y + 1.25, 1.56]], light.lit > 0.5 ? '#f3d9a0' : '#252b4a', '#151a33');
    if (light.lit > 0.5) pen.glow(x + 0.78, y + 0.78, 1.7, 1.0, C.lamp, 0.22);
    const c = pen.c;
    c.strokeStyle = '#c9c4ee';
    c.lineWidth = 1;
    const fr = (a: [number, number, number], b: [number, number, number]) => {
      const [ax, ay] = pen.p(...a);
      const [bx, by] = pen.p(...b);
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.stroke();
    };
    const [fx, fy, fz] = [x + 1.0, y + 0.9, 0.76];
    for (const [dx, dy] of [[0, 0], [0.95, 0], [0.95, 0.95], [0, 0.95]]) fr([fx + dx, fy + dy, fz], [fx + dx, fy + dy, fz + 0.55]);
    fr([fx, fy + 0.95, fz + 0.55], [fx + 0.95, fy + 0.95, fz + 0.55]);
    fr([fx + 0.95, fy, fz + 0.55], [fx + 0.95, fy + 0.95, fz + 0.55]);
    fr([fx, fy, fz + 0.55], [fx + 0.95, fy, fz + 0.55]);
    fr([fx, fy, fz + 0.55], [fx, fy + 0.95, fz + 0.55]);
  },

  harbor(pen, s, light, t) {
    const col = WALL.harbor;
    const w = new Windows(pen, light, t);
    const [x, y] = [s.x - 1.2, s.y - 1.1];
    pen.box(x, y, 1.7, 1.2, 0, 0.75, col);
    w.row('L', x, y, 1.7, 1.2, 3, 0.28, 0.58);
    w.row('R', x, y, 1.7, 1.2, 2, 0.28, 0.58);
    pen.gable(x - 0.08, y - 0.08, 1.86, 1.36, 0.75, 0.45, 'x', ROOF, col);
    // Containers on the quay.
    const crates: [number, number, number, string][] = [[0.75, -0.2, 0, '#c9634a'], [0.75, 0.25, 0, '#d9a441'], [0.75, -0.2, 0.3, '#5d8fb0'], [0.2, 0.75, 0, '#6aa68a']];
    for (const [dx, dy, dz, cc] of crates) pen.box(s.x + dx, s.y + dy, 0.62, 0.38, dz, 0.3, cc, shade(cc, 0.25));
    // Pier out over the water, and a ship riding beside it.
    pen.box(s.x + 0.3, s.y + 1.3, 0.5, 2.4, -0.25, 0.25, '#6b5446', '#8b705c');
    for (const py of [1.7, 2.6, 3.5]) pen.box(s.x + 0.25, s.y + py, 0.1, 0.1, -0.55, 0.45, '#3b2d2a');
    const sinking = light.mood === 'broken';
    const bob = Math.sin(t * 1.4) * 0.04 - (sinking ? 0.16 + 0.05 * Math.sin(t * 2.3) : 0);
    const [sx, sy] = [s.x + 1.0, s.y + 2.2];
    pen.ground((g) => {
      g.strokeStyle = 'rgba(170,205,240,0.25)';
      g.lineWidth = 0.04;
      g.beginPath();
      g.ellipse(sx + 0.3, sy + 0.55, 0.62 + 0.05 * Math.sin(t * 1.4), 0.95, 0, 0, 6.3);
      g.stroke();
    });
    pen.box(sx, sy, 0.6, 1.2, -0.2 + bob, 0.34, '#3c4a6b', '#7b6a58');
    pen.box(sx + 0.1, sy + 0.1, 0.4, 0.42, 0.14 + bob, 0.3, '#d8d2c4');
    w.pane('L', sx + 0.1, sy + 0.1, 0.4, 0.42, 0.2, 0.8, 0.24 + bob, 0.36 + bob);
    pen.box(sx + 0.12, sy + 0.62, 0.36, 0.22, 0.14 + bob, 0.2, '#c9634a');
    pen.box(sx + 0.12, sy + 0.88, 0.36, 0.22, 0.14 + bob, 0.2, '#d9a441');
    pen.box(sx + 0.27, sy + 0.27, 0.05, 0.05, 0.44 + bob, 0.5, '#23213a');
    pen.glow(sx + 0.3, sy + 0.3, 0.98 + bob, 0.4, sinking ? C.beacon : C.lamp, 0.5);
    // Crane.
    pen.box(s.x - 0.25, s.y + 0.95, 0.12, 0.12, 0, 1.5, '#d9a441');
    pen.box(s.x - 0.25, s.y + 0.95, 0.12, 1.1, 1.5, 0.1, '#d9a441');
    pen.glow(s.x - 0.19, s.y + 2.0, 1.5, 0.35, C.beacon, 0.35 + 0.25 * Math.sin(t * 3));
  },

  watch(pen, s, light, t) {
    const col = WALL.watch;
    const w = new Windows(pen, light, t);
    pen.cyl(s.x, s.y, 1.25, 0, 0.28, '#2d4f4a', 1.05, '#2f5a52');
    pen.box(s.x + 0.35, s.y + 0.1, 0.8, 0.7, 0.28, 0.55, shade(col, 0.1));
    w.row('L', s.x + 0.35, s.y + 0.1, 0.8, 0.7, 2, 0.48, 0.7);
    pen.gable(s.x + 0.3, s.y + 0.05, 0.9, 0.8, 0.83, 0.3, 'x', ROOF, col);
    pen.cyl(s.x, s.y, 0.46, 0.28, 2.45, col, 0.36);
    for (const [u, z] of [[0.25, 0.9], [-0.1, 1.6], [0.2, 2.2]] as const) {
      const [px, py] = pen.p(s.x + u * 0.5, s.y + 0.4, z);
      const on = ((z * 0.37) % 1) < light.lit;
      pen.c.fillStyle = on ? C.window : C.dark;
      pen.c.fillRect(px - pen.v.hw * 0.05, py - pen.v.hw * 0.1, pen.v.hw * 0.1, pen.v.hw * 0.2);
    }
    pen.cyl(s.x, s.y, 0.56, 2.73, 0.1, shade(col, 0.25));
    const lampOn = light.lit > 0 || light.mood === 'fixed';
    const glass = light.mood === 'broken' ? mix(C.dark, C.beacon, 0.6 + 0.3 * Math.sin(t * 4.2)) : lampOn ? '#ffe2a6' : '#2a3350';
    pen.cyl(s.x, s.y, 0.3, 2.83, 0.38, glass, 0.3, glass);
    pen.cyl(s.x, s.y, 0.42, 3.21, 0.5, ROOF_WARM, 0);
    if (lampOn) pen.glow(s.x, s.y, 3.02, 1.5, C.lamp, 0.45);
  },

  lock(pen, s, light, t) {
    const col = WALL.lock;
    const w = new Windows(pen, light, t);
    const [x, y] = [s.x - 0.75, s.y - 0.75];
    pen.box(x, y, 1.5, 1.5, 0, 1.0, col);
    w.row('L', x, y, 1.5, 1.5, 2, 0.38, 0.75, 0.16);
    w.pane('R', x, y, 1.5, 1.5, 0.12, 0.4, 0.38, 0.75);
    pen.pane('R', x, y, 1.5, 1.5, 0.56, 0.8, 0, 0.62, '#2b2030');
    pen.pyramid(x - 0.1, y - 0.1, 1.7, 1.7, 1.0, 0.85, ROOF);
    // Hanging key sign.
    const c = pen.c;
    const [kx, ky] = pen.p(x + 1.62, y + 0.42, 0.95);
    const u = pen.v.hw;
    c.strokeStyle = '#23213a';
    c.lineWidth = Math.max(1, u * 0.04);
    c.beginPath();
    c.moveTo(...pen.p(x + 1.5, y + 0.42, 0.98));
    c.lineTo(kx, ky);
    c.stroke();
    c.strokeStyle = light.lit > 0 || light.mood === 'fixed' ? C.lamp : '#8d7b4a';
    c.lineWidth = Math.max(1.2, u * 0.05);
    c.beginPath();
    c.arc(kx, ky + u * 0.12, u * 0.08, 0, 6.3);
    c.moveTo(kx, ky + u * 0.2);
    c.lineTo(kx, ky + u * 0.42);
    c.lineTo(kx + u * 0.08, ky + u * 0.42);
    c.moveTo(kx, ky + u * 0.33);
    c.lineTo(kx + u * 0.06, ky + u * 0.33);
    c.stroke();
    if (light.lit > 0) pen.glow(x + 1.62, y + 0.42, 0.7, 0.5, C.lamp, 0.3);
  },

  granary(pen, s, light, t) {
    const col = WALL.granary;
    const w = new Windows(pen, light, t);
    const [x, y] = [s.x - 0.1, s.y - 0.7];
    pen.cyl(s.x - 0.75, s.y - 0.2, 0.52, 0, 1.75, '#b8a98c', 0.52);
    pen.cyl(s.x - 0.75, s.y - 0.2, 0.56, 1.75, 0.55, ROOF_WARM, 0);
    pen.box(x, y, 1.3, 1.5, 0, 0.9, col);
    w.row('L', x, y, 1.3, 1.5, 2, 0.35, 0.65, 0.15);
    pen.pane('R', x, y, 1.3, 1.5, 0.3, 0.7, 0, 0.62, '#4a2f22');
    w.pane('R', x, y, 1.3, 1.5, 0.42, 0.58, 0.72, 0.86);
    pen.gable(x - 0.08, y - 0.08, 1.46, 1.66, 0.9, 0.62, 'y', ROOF_WARM, col);
    // Sacks by the door.
    pen.cyl(s.x + 1.45, s.y + 0.55, 0.14, 0, 0.22, '#c8b48a');
    pen.cyl(s.x + 1.5, s.y + 0.2, 0.14, 0, 0.22, '#bfa97c');
  },

  hall(pen, s, light, t) {
    const col = WALL.hall;
    const w = new Windows(pen, light, t);
    const [x, y] = [s.x - 1.25, s.y - 0.8];
    pen.box(x - 0.2, y - 0.2, 2.9, 2.0, 0, 0.16, '#77728a');
    pen.box(x - 0.1, y - 0.1, 2.7, 1.8, 0.16, 0.12, '#8a859c');
    pen.box(x, y, 2.5, 1.6, 0.28, 1.1, col);
    w.row('L', x, y, 2.5, 1.6, 5, 0.6, 1.1, 0.08);
    w.row('R', x, y, 2.5, 1.6, 3, 0.6, 1.1, 0.1);
    // Columns across the front.
    for (let i = 0; i <= 5; i++) {
      const u = 0.06 + i * 0.176;
      pen.pane('L', x, y + 0.03, 2.5, 1.6, u - 0.022, u + 0.022, 0.28, 1.34, tint(col, 0.35));
    }
    pen.gable(x - 0.1, y - 0.1, 2.7, 1.8, 1.38, 0.5, 'x', ROOF, col);
    // Clock tower.
    pen.box(s.x - 0.32, s.y - 0.32, 0.64, 0.64, 1.6, 0.8, tint(col, 0.08));
    const lit = light.lit > 0 || light.mood === 'fixed';
    const [cx, cy] = pen.p(s.x, s.y + 0.33, 2.05);
    pen.c.fillStyle = lit ? '#ffe9bd' : '#3b4260';
    pen.c.beginPath();
    pen.c.ellipse(cx, cy, pen.v.hw * 0.15, pen.v.hw * 0.17, 0, 0, 6.3);
    pen.c.fill();
    if (lit) pen.glow(s.x, s.y + 0.36, 2.05, 0.7, C.lamp, 0.35);
    pen.pyramid(s.x - 0.4, s.y - 0.4, 0.8, 0.8, 2.4, 0.6, ROOF);
  },

  big(pen, s, light, t, st) {
    const col = WALL.big;
    const w = new Windows(pen, light, t);
    const [x, y] = [s.x - 0.45, s.y - 0.45];
    pen.box(x - 0.15, y - 0.15, 1.2, 1.2, 0, 0.18, '#5c5578');
    pen.box(x, y, 0.9, 0.9, 0.18, 2.3, col);
    w.pane('L', x, y, 0.9, 0.9, 0.36, 0.64, 0.6, 1.0);
    w.pane('L', x, y, 0.9, 0.9, 0.36, 0.64, 1.35, 1.75);
    w.pane('R', x, y, 0.9, 0.9, 0.36, 0.64, 1.0, 1.4);
    pen.pane('R', x, y, 0.9, 0.9, 0.34, 0.66, 0.18, 0.72, '#2b2030');
    // Open belfry: the bell glows brighter as the town earns its nines.
    const k = light.mood === 'fixed' ? 1 : light.mood === 'broken' ? 0 : (st.nines - 1) / 8;
    pen.box(x + 0.05, y + 0.05, 0.8, 0.8, 2.48, 0.5, '#241f3a', '#241f3a');
    const bell = light.mood === 'broken' ? mix('#3a2a3a', C.beacon, 0.5 + 0.4 * Math.sin(t * 4.2)) : mix('#6b5a3a', '#ffd98a', 0.25 + 0.75 * k);
    pen.pane('L', x + 0.05, y + 0.05, 0.8, 0.8, 0.25, 0.75, 2.5, 2.9, bell);
    pen.pane('R', x + 0.05, y + 0.05, 0.8, 0.8, 0.25, 0.75, 2.5, 2.9, bell);
    pen.glow(s.x, s.y, 2.75, 1.2 + k, light.mood === 'broken' ? C.beacon : C.lamp, 0.18 + 0.4 * k);
    pen.box(x - 0.04, y - 0.04, 0.98, 0.98, 2.98, 0.08, shade(col, 0.2));
    pen.pyramid(x - 0.08, y - 0.08, 1.06, 1.06, 3.06, 0.8, ROOF_WARM);
  },
};
