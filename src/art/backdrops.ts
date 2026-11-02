import { CharacterSheet, LOOKS, type Look } from './characters';
import { blit, disc, ellipse, Layer, makeCanvas, rect, rng, type Ctx } from './pixels';
import { boat, container, house, tree, watchtower } from './scenery';
import { VignetteRenderer, type Vignette } from './vignette';

export type Status = 'broken' | 'verifying' | 'fixed';
const W = 384;

const NPC_LOOK: Record<string, Look> = {
  post: LOOKS.rosa,
  rail: LOOKS.ines,
  arch: LOOKS.ada,
  harbor: LOOKS.finn,
  watch: LOOKS.lin,
  lock: LOOKS.kit,
  granary: LOOKS.gus,
  hall: LOOKS.bo,
  big: LOOKS.bo,
};

/** Draws a district scene for a hands-on level. The top ~135px is what the player sees above the tool tray. */
export class Backdrop {
  private npc: CharacterSheet;
  private bg: Layer;
  private sparkles: { x: number; y: number; a: number }[] = [];
  private lastStatus: Status = 'broken';

  private vignette: VignetteRenderer | undefined;

  constructor(
    private district: string,
    vignette?: Vignette,
  ) {
    this.npc = new CharacterSheet(NPC_LOOK[district] ?? LOOKS.bo);
    this.bg = new Layer(() => staticLayer(district));
    if (vignette) this.vignette = new VignetteRenderer(vignette);
  }

  render(c: Ctx, t: number, status: Status, board: string[]): void {
    blit(c, this.bg.get(), 0, 0, W, 216);
    if (status === 'fixed' && this.lastStatus !== 'fixed') {
      for (let i = 0; i < 24; i++) this.sparkles.push({ x: 40 + Math.random() * 300, y: 30 + Math.random() * 90, a: 1 + Math.random() });
    }
    this.lastStatus = status;
    ANIMATE[this.district]?.(c, t, status);
    drawBoard(c, t, status, board);
    this.vignette?.render(c, t, status);
    // district NPC
    const hop = status === 'fixed' ? Math.abs(Math.sin(t * 6)) * 3 : Math.floor(t * 2) % 2;
    this.npc.draw(c, status === 'broken' ? (Math.floor(t / 2) % 2 ? 'left' : 'right') : 'down', 0, 196, 112 - hop);
    if (status === 'broken') {
      // worried sweat drop
      const dy = (t * 6) % 6;
      rect(c, 210, 108 + dy, 2, 3, '#7fc2f0');
    }
    for (const s of this.sparkles) {
      s.a -= 0.012;
      s.y -= 0.2;
      if (s.a <= 0) continue;
      c.globalAlpha = Math.min(1, s.a);
      rect(c, s.x, s.y, 1, 3, '#ffe680');
      rect(c, s.x - 1, s.y + 1, 3, 1, '#ffe680');
      c.globalAlpha = 1;
    }
    this.sparkles = this.sparkles.filter((s) => s.a > 0);
  }
}

function drawBoard(c: Ctx, t: number, status: Status, lines: string[]): void {
  const x = 222;
  const y = 40;
  const w = 152;
  const h = 14 + lines.length * 9;
  rect(c, x + 2, y + 2, w, h, 'rgba(0,0,0,0.25)');
  rect(c, x - 1, y - 1, w + 2, h + 2, '#2a1e1a');
  rect(c, x, y, w, h, '#24313a');
  const lamp = status === 'fixed' ? '#58d080' : status === 'verifying' ? (Math.floor(t * 4) % 2 ? '#f8d030' : '#a08020') : Math.floor(t * 2.5) % 2 ? '#e05a48' : '#7a2a1a';
  disc(c, x + 7, y + 7, 3, lamp);
  c.font = '5px "Press Start 2P"';
  c.fillStyle = '#9fb4c0';
  c.fillText(status === 'fixed' ? 'ALL GOOD' : status === 'verifying' ? 'CHECKING…' : 'PROBLEM', x + 14, y + 9);
  c.fillStyle = status === 'fixed' ? '#b8f0c8' : '#f8ecd0';
  lines.forEach((l, i) => c.fillText(l.slice(0, 28), x + 5, y + 19 + i * 9));
}

// ------------------------------------------------------------------ static layers
function sky(c: Ctx, cols: string[], band: number): void {
  cols.forEach((col, i) => rect(c, 0, i * band, W, band, col));
}
function grass(c: Ctx, y: number, h: number, seed: number): void {
  const R = rng(seed);
  rect(c, 0, y, W, h, '#5fae4a');
  for (let i = 0; i < 900; i++) rect(c, (R() * W) | 0, y + ((R() * h) | 0), 1, 1, R() < 0.5 ? '#55a042' : '#6dbd55');
}
function floorboards(c: Ctx, y: number): void {
  rect(c, 0, y, W, 216 - y, '#9a7448');
  for (let yy = y; yy < 216; yy += 6) rect(c, 0, yy, W, 1, '#7a5530');
  for (let x = 0; x < W; x += 32) rect(c, x + ((x / 32) % 2) * 16, y, 1, 216 - y, '#7a5530');
}
function wall(c: Ctx, col: string, stripe: string, h: number): void {
  rect(c, 0, 0, W, h, col);
  for (let x = 0; x < W; x += 12) rect(c, x, 0, 1, h, stripe);
  rect(c, 0, h - 4, W, 4, '#6b4a2a');
}
function windowPane(c: Ctx, x: number, y: number, w: number, h: number, night = false): void {
  rect(c, x - 2, y - 2, w + 4, h + 4, '#5a3a22');
  rect(c, x, y, w, h, night ? '#1d2a4a' : '#8fd0ff');
  rect(c, x + w / 2 - 1, y, 2, h, '#5a3a22');
  rect(c, x, y + h / 2 - 1, w, 2, '#5a3a22');
  if (!night) rect(c, x + 2, y + 2, 5, 3, '#d8f0ff');
}

function staticLayer(d: string): HTMLCanvasElement {
  const [cv, c] = makeCanvas(W, 216);
  switch (d) {
    case 'post': {
      sky(c, ['#bfe6ff', '#c9ebff', '#d4efff', '#def3ff'], 7);
      grass(c, 28, 100, 3);
      rect(c, 0, 118, W, 98, '#d9b77a');
      house(c, 10, 46, 72, 72, { roof: '#3b6fb5', wall: '#f0d6a8', label: 'POST' });
      house(c, 100, 52, 60, 66, { roof: '#e07a9a', wall: '#fbeede', label: 'BAKERY' });
      tree(c, 168, 96);
      break;
    }
    case 'rail': {
      sky(c, ['#ffe2b0', '#ffeac4', '#fff0d6', '#fdf4e2'], 10);
      grass(c, 40, 50, 5);
      rect(c, 0, 90, W, 126, '#b8a888');
      for (let x = 0; x < W; x += 6) rect(c, x, 98, 4, 14, '#6b4a2a');
      rect(c, 0, 100, W, 2, '#9aa0a8');
      rect(c, 0, 108, W, 2, '#9aa0a8');
      rect(c, 0, 116, W, 100, '#d9c7a7');
      for (let x = 0; x < W; x += 24) rect(c, x, 116, 1, 100, '#b8a888');
      for (let x = 10; x < W; x += 90) {
        rect(c, x, 44, 4, 54, '#7a5030');
      }
      rect(c, 0, 40, W, 6, '#946238');
      break;
    }
    case 'arch': {
      wall(c, '#e8dcc4', '#ddd0b4', 92);
      windowPane(c, 20, 18, 46, 36);
      floorboards(c, 92);
      // drafting table with blueprint
      rect(c, 70, 70, 120, 6, '#6b4a2a');
      rect(c, 78, 76, 4, 40, '#5a3a22');
      rect(c, 178, 76, 4, 40, '#5a3a22');
      rect(c, 74, 46, 112, 26, '#2a5a9a');
      for (let x = 74; x < 186; x += 8) rect(c, x, 46, 1, 26, '#3f70b0');
      for (let y = 46; y < 72; y += 8) rect(c, 74, y, 112, 1, '#3f70b0');
      rect(c, 92, 52, 30, 14, '#cfe0f8');
      rect(c, 93, 53, 28, 12, '#2a5a9a');
      rect(c, 130, 50, 40, 18, '#cfe0f8');
      rect(c, 131, 51, 38, 16, '#2a5a9a');
      break;
    }
    case 'harbor': {
      sky(c, ['#ffd9a0', '#ffe2b0', '#ffeac4', '#fff0d6', '#fdf4e2'], 15);
      rect(c, 0, 74, W, 46, '#3d8fd1');
      floorboards(c, 120);
      container(c, 8, 92, 30, 18, '#c0392b');
      container(c, 8, 74, 30, 18, '#2b6cb0');
      container(c, 40, 100, 30, 18, '#e8a030');
      break;
    }
    case 'watch': {
      sky(c, ['#1d2140', '#232a50', '#2a3360', '#323d70', '#3b4880'], 16);
      const R = rng(9);
      for (let i = 0; i < 60; i++) rect(c, (R() * W) | 0, (R() * 70) | 0, 1, 1, '#ffffff');
      for (let x = 0; x < W; x++) {
        const hh = 30 + Math.sin(x / 40) * 10;
        rect(c, x, 120 - hh, 1, hh, '#2f5a3a');
      }
      rect(c, 0, 118, W, 98, '#3f6a3a');
      watchtower(c, 120, 30, 30, 90);
      break;
    }
    case 'lock': {
      wall(c, '#d8c8d8', '#cbb8cb', 92);
      floorboards(c, 92);
      // key wall
      rect(c, 14, 14, 110, 60, '#7a5030');
      for (let i = 0; i < 12; i++) {
        const x = 22 + (i % 6) * 17;
        const y = 22 + Math.floor(i / 6) * 26;
        rect(c, x + 3, y, 2, 4, '#3a2a1a');
        disc(c, x + 4, y + 7, 3, ['#f8d030', '#c0c0c0', '#e08838'][i % 3]);
        rect(c, x + 3, y + 10, 2, 8, ['#f8d030', '#c0c0c0', '#e08838'][i % 3]);
      }
      // vault door
      disc(c, 160, 62, 26, '#5a5a6a');
      disc(c, 160, 62, 22, '#7a7a8a');
      disc(c, 160, 62, 6, '#3a3a4a');
      break;
    }
    case 'granary': {
      sky(c, ['#cfe8ff', '#d8edff', '#e2f2ff'], 12);
      grass(c, 36, 84, 11);
      rect(c, 0, 120, W, 96, '#c9a466');
      // barn
      rect(c, 20, 40, 120, 80, '#b5432b');
      for (let x = 20; x < 140; x += 5) rect(c, x, 40, 1, 80, '#9a3524');
      for (let j = 0; j < 22; j++) rect(c, 14 + j, 40 - j, 132 - j * 2, 1, '#6a3020');
      rect(c, 62, 80, 36, 40, '#f0e0c0');
      rect(c, 64, 82, 32, 38, '#7a4f2e');
      // silo
      rect(c, 150, 30, 30, 90, '#c0c4c8');
      ellipse(c, 165, 30, 15, 8, '#a8acb0');
      for (let y = 36; y < 120; y += 8) rect(c, 150, y, 30, 1, '#a0a4a8');
      break;
    }
    case 'hall':
    case 'big': {
      wall(c, '#efe0c8', '#e4d4b8', 92);
      windowPane(c, 24, 16, 40, 40, d === 'big');
      windowPane(c, 150, 16, 40, 40, d === 'big');
      floorboards(c, 92);
      // big wall clock
      disc(c, 107, 34, 14, '#5a3a22');
      disc(c, 107, 34, 12, '#f8f0d8');
      // mayor's desk
      rect(c, 60, 78, 100, 8, '#7a4f2e');
      rect(c, 64, 86, 92, 30, '#946238');
      rect(c, 70, 72, 16, 6, '#f8f0d8');
      break;
    }
  }
  return cv;
}

// ------------------------------------------------------------------ animated layers
const ANIMATE: Record<string, (c: Ctx, t: number, s: Status) => void> = {
  post(c, t, s) {
    // letters flying toward the bakery when fixed, bouncing back when broken
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.4 + i / 3) % 1);
      const x = 70 + k * 60;
      const y = 80 - Math.sin(k * Math.PI) * 30;
      if (s === 'broken' && k > 0.6) continue;
      rect(c, x, y, 6, 4, '#fff8e8');
      rect(c, x + 2, y + 1, 2, 1, '#c0392b');
    }
    if (s === 'broken') {
      c.font = '6px "Press Start 2P"';
      c.fillStyle = '#c0392b';
      c.fillText('?', 128, 70 + Math.sin(t * 4) * 2);
    }
  },
  rail(c, t, s) {
    const signal = s === 'fixed' ? '#58d080' : s === 'verifying' ? '#f8d030' : '#e05a48';
    rect(c, 360, 60, 6, 38, '#3a3a3a');
    rect(c, 356, 54, 14, 12, '#2a2a2a');
    disc(c, 363, 60, 3, signal);
    const x = s === 'fixed' ? ((t * 60) % (W + 160)) - 160 : 40;
    const tilt = s === 'broken' ? 0.12 : 0;
    const cars = ['#2b6cb0', '#b5523b', '#e8a030', '#27ae60'];
    cars.forEach((col, i) => {
      c.save();
      c.translate(x + i * 34, 84);
      c.rotate(i === 2 ? tilt : 0);
      rect(c, 0, 0, 30, 16, '#2a1e1a');
      rect(c, 1, 1, 28, 13, col);
      rect(c, 4, 3, 8, 5, '#8fd0ff');
      disc(c, 6, 17, 3, '#222');
      disc(c, 24, 17, 3, '#222');
      c.restore();
    });
    if (s !== 'fixed' && Math.floor(t * 3) % 2) disc(c, x + 6, 76, 3, 'rgba(230,230,230,0.6)');
  },
  arch(c, t, s) {
    // lamp light and a red stamp on the blueprint when something's wrong
    disc(c, 200, 30, 10, s === 'fixed' ? 'rgba(255,240,150,0.35)' : 'rgba(255,240,150,0.2)');
    rect(c, 196, 20, 8, 10, '#3a3a3a');
    if (s === 'broken') {
      c.font = '6px "Press Start 2P"';
      c.fillStyle = Math.floor(t * 2) % 2 ? '#e05a48' : '#a03020';
      c.fillText('! REVIEW', 100, 62);
    } else if (s === 'fixed') {
      c.font = '6px "Press Start 2P"';
      c.fillStyle = '#58d080';
      c.fillText('APPROVED', 98, 62);
    }
  },
  harbor(c, t, s) {
    for (let i = 0; i < 30; i++) {
      const oy = (i * 7) % 44;
      const sx = ((i * 53 + t * 10) % (W + 20)) - 10;
      rect(c, sx, 76 + oy, 5, 1, '#7fc2f0');
    }
    const x = s === 'fixed' ? ((t * 40) % (W + 120)) - 100 : 90 + Math.sin(t) * 3;
    boat(c, x, 104 + (s === 'broken' ? 3 : 0) + Math.sin(t * 2), s === 'broken' ? 4 : 6, s === 'broken' ? 0.06 : 0, 1.6);
  },
  watch(c, t, s) {
    const on = s === 'fixed' || Math.floor(t * 2) % 2 === 0;
    if (on) {
      c.globalAlpha = 0.18;
      c.fillStyle = s === 'broken' ? '#ff8060' : '#ffe680';
      c.beginPath();
      const a = Math.sin(t * 0.8) * 0.6;
      c.moveTo(135, 40);
      c.lineTo(135 + Math.cos(a - 0.15) * 260, 40 + Math.sin(a - 0.15) * 260);
      c.lineTo(135 + Math.cos(a + 0.15) * 260, 40 + Math.sin(a + 0.15) * 260);
      c.fill();
      c.globalAlpha = 1;
    }
    rect(c, 131, 34, 8, 6, s === 'broken' ? '#ff8060' : '#ffe680');
  },
  lock(c, t, s) {
    // vault wheel turns while checking, glows green when fixed
    const a = s === 'verifying' ? t * 4 : s === 'fixed' ? 0 : Math.sin(t * 3) * 0.2;
    for (let i = 0; i < 4; i++) {
      const ang = a + (i * Math.PI) / 2;
      rect(c, 160 + Math.cos(ang) * 14 - 1, 62 + Math.sin(ang) * 14 - 1, 3, 3, s === 'fixed' ? '#58d080' : '#c0c0c0');
    }
    if (s === 'broken') {
      c.font = '6px "Press Start 2P"';
      c.fillStyle = '#e05a48';
      c.fillText('!', 157, 34 + Math.sin(t * 5) * 2);
    }
  },
  granary(c, t, s) {
    // sacks moving in on a cart
    const x = s === 'fixed' ? ((t * 30) % 260) + 20 : 150 + Math.sin(t * 2) * 2;
    rect(c, x, 108, 28, 8, '#7a4f2e');
    disc(c, x + 5, 118, 3, '#3a2a1a');
    disc(c, x + 23, 118, 3, '#3a2a1a');
    for (let i = 0; i < 3; i++) {
      disc(c, x + 6 + i * 8, 104, 4, '#e8d098');
      rect(c, x + 5 + i * 8, 99, 2, 2, '#a08040');
    }
    if (s === 'broken') {
      for (let i = 0; i < 4; i++) disc(c, 172 + i * 3, 26 - ((t * 10 + i * 4) % 14), 2, 'rgba(200,170,110,0.7)');
    }
  },
  hall(c, t, s) {
    const a = t * 0.5;
    rect(c, 107, 34, 1, 1, '#2a1e1a');
    c.strokeStyle = '#2a1e1a';
    c.beginPath();
    c.moveTo(107.5, 34.5);
    c.lineTo(107.5 + Math.cos(a) * 9, 34.5 + Math.sin(a) * 9);
    c.stroke();
    if (s === 'broken') {
      // papers flapping
      for (let i = 0; i < 3; i++) rect(c, 72 + i * 10, 70 - Math.abs(Math.sin(t * 3 + i)) * 4, 8, 5, '#fff');
    }
  },
  big(c, t, s) {
    ANIMATE.hall(c, t, s);
    if (s !== 'fixed') {
      const on = Math.floor(t * 3) % 2;
      c.globalAlpha = on ? 0.15 : 0.05;
      rect(c, 0, 0, W, 130, '#ff3020');
      c.globalAlpha = 1;
    }
  },
};
