import { disc, rect, type Ctx } from './pixels';

export type Status = 'broken' | 'verifying' | 'fixed';

/** A small animated diagram that shows THIS ticket's problem in the scene. */
export type Vignette =
  | { kind: 'flow'; label: string; nodes: string[]; breakAt: number; fixedNodes?: string[] }
  | { kind: 'meter'; label: string; broken: number; fixed: number; max: number; unit?: string; limit?: number; lowIsGood?: boolean }
  | { kind: 'tiles'; label: string; items: string[]; bad: number[]; fixedItems?: string[] };

const X = 10;
const Y = 42;
const W = 206;
const H = 58;
const RED = '#e05a48';
const GREEN = '#58d080';
const INK = '#f8ecd0';

export class VignetteRenderer {
  private shown: number | undefined;

  constructor(private v: Vignette) {}

  render(c: Ctx, t: number, status: Status): void {
    const fixed = status === 'fixed';
    rect(c, X + 2, Y + 2, W, H, 'rgba(0,0,0,0.25)');
    rect(c, X - 1, Y - 1, W + 2, H + 2, '#2a1e1a');
    rect(c, X, Y, W, H, 'rgba(36,49,58,0.92)');
    c.font = '5px "Press Start 2P"';
    c.fillStyle = '#9fb4c0';
    c.fillText(this.v.label.toUpperCase().slice(0, 34), X + 5, Y + 9);
    if (this.v.kind === 'flow') this.flow(c, t, fixed, this.v);
    else if (this.v.kind === 'meter') this.meter(c, status, this.v);
    else this.tiles(c, t, fixed, this.v);
  }

  private flow(c: Ctx, t: number, fixed: boolean, v: Extract<Vignette, { kind: 'flow' }>): void {
    const nodes = fixed && v.fixedNodes ? v.fixedNodes : v.nodes;
    const n = nodes.length;
    const gap = (W - 12) / n;
    const bw = Math.min(gap - 8, 56);
    const cy = Y + 34;
    const cx = (i: number) => X + 6 + gap * i + gap / 2;
    // edges
    for (let i = 0; i < n - 1; i++) {
      const broken = !fixed && i + 1 === v.breakAt;
      const a = cx(i) + bw / 2;
      const b = cx(i + 1) - bw / 2;
      for (let x = a; x < b; x += 3) rect(c, x, cy, 2, 1, broken ? '#7a4040' : '#6a8a9a');
      // packets
      const k = (t * 0.9 + i * 0.37) % 1;
      if (!broken && (fixed || i + 1 < v.breakAt)) disc(c, a + (b - a) * k, cy, 1.5, fixed ? GREEN : '#f8d030');
      if (broken) {
        const stop = a + (b - a) * Math.min(k * 2, 0.5);
        disc(c, stop, cy, 1.5, '#f8d030');
        if (Math.floor(t * 3) % 2) {
          const mx = (a + b) / 2;
          c.fillStyle = RED;
          c.font = '7px "Press Start 2P"';
          c.fillText('✗', mx - 3, cy + 3);
        }
      }
    }
    // boxes
    nodes.forEach((label, i) => {
      const bad = !fixed && i === v.breakAt;
      const x = cx(i) - bw / 2;
      rect(c, x - 1, cy - 9, bw + 2, 18, bad ? RED : fixed && i === n - 1 ? GREEN : '#6a8a9a');
      rect(c, x, cy - 8, bw, 16, '#1d2730');
      c.font = '4px "Press Start 2P"';
      c.fillStyle = INK;
      const [l1, l2] = wrap(label, Math.floor((bw - 3) / 4.2));
      if (l2) {
        c.fillText(l1, x + 2, cy - 1);
        c.fillText(l2, x + 2, cy + 5);
      } else c.fillText(l1, x + 2, cy + 2);
    });
  }

  private meter(c: Ctx, status: Status, v: Extract<Vignette, { kind: 'meter' }>): void {
    const target = status === 'fixed' ? v.fixed : v.broken;
    this.shown = this.shown === undefined ? v.broken : this.shown + (target - this.shown) * 0.06;
    const val = this.shown;
    const bx = X + 6;
    const by = Y + 22;
    const bw = W - 12;
    const frac = Math.max(0, Math.min(1, val / v.max));
    const bad = v.limit === undefined ? status !== 'fixed' : v.lowIsGood ? val > v.limit : val < v.limit;
    rect(c, bx - 1, by - 1, bw + 2, 12, '#000');
    rect(c, bx, by, bw, 10, '#1d2730');
    rect(c, bx, by, Math.max(1, bw * frac), 10, bad ? RED : GREEN);
    rect(c, bx, by, Math.max(1, bw * frac), 2, 'rgba(255,255,255,0.25)');
    if (v.limit !== undefined) {
      const lx = bx + bw * Math.min(1, v.limit / v.max);
      for (let y = by - 4; y < by + 14; y += 2) rect(c, lx, y, 1, 1, '#f8d030');
    }
    c.font = '6px "Press Start 2P"';
    c.fillStyle = bad ? '#ffb0a0' : '#b8f0c8';
    c.fillText(`${fmt(val)}${v.unit ?? ''}`, bx, by + 24);
    if (v.limit !== undefined) {
      c.font = '4px "Press Start 2P"';
      c.fillStyle = '#f8d030';
      const txt = `${v.lowIsGood ? 'limit' : 'need'} ${fmt(v.limit)}${v.unit ?? ''}`;
      c.fillText(txt, bx + bw - txt.length * 4.2, by + 24);
    }
  }

  private tiles(c: Ctx, t: number, fixed: boolean, v: Extract<Vignette, { kind: 'tiles' }>): void {
    const items = fixed && v.fixedItems ? v.fixedItems : v.items;
    const n = items.length;
    const cols = n > 4 ? 3 : n;
    const rows = Math.ceil(n / cols);
    const tw = (W - 12 - (cols - 1) * 4) / cols;
    const th = rows > 1 ? 16 : 22;
    items.forEach((label, i) => {
      const bad = !fixed && v.bad.includes(i);
      const x = X + 6 + (i % cols) * (tw + 4);
      const y = Y + 15 + Math.floor(i / cols) * (th + 3);
      const blink = bad && Math.floor(t * 2.5 + i) % 2 === 0;
      rect(c, x - 1, y - 1, tw + 2, th + 2, bad ? (blink ? RED : '#8a3030') : fixed ? GREEN : '#6a8a9a');
      rect(c, x, y, tw, th, '#1d2730');
      c.font = '4px "Press Start 2P"';
      c.fillStyle = bad ? '#ffb0a0' : INK;
      c.fillText(label.slice(0, Math.floor((tw - 4) / 4.2)), x + 2, y + th / 2 + 2);
    });
  }
}

/** Split a label into at most two lines of `max` chars, breaking at spaces, dots or dashes. */
function wrap(label: string, max: number): [string, string?] {
  if (label.length <= max) return [label];
  let cut = -1;
  for (let i = Math.min(max, label.length - 1); i > 0; i--) {
    if (label[i] === ' ') { cut = i; break; }
    if (label[i] === '.' || label[i] === '-') { cut = i; break; }
  }
  if (cut <= 0) cut = max;
  const a = label.slice(0, label[cut] === ' ' || label[cut] === '-' ? cut + (label[cut] === '-' ? 1 : 0) : cut).trim();
  const b = label.slice(a.length).trim();
  return [a.slice(0, max), b.slice(0, max)];
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en');
  if (Math.abs(n) >= 10) return String(Math.round(n));
  return n.toFixed(n < 1 ? 2 : 1).replace(/\.0+$/, '');
}
