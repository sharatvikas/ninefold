import { CharacterSheet, LOOKS, type Look } from './characters';
import { blit, disc, ellipse, Layer, makeCanvas, rect, rng, shade, type Ctx } from './pixels';
import { boat, bookshelf, container, crane, house, lampPost, plant, railCar, sack, tree, watchtower } from './scenery';
import { SceneFx, trainX } from './sceneFx';
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
  private fx: SceneFx;

  constructor(
    private district: string,
    vignette?: Vignette,
  ) {
    this.npc = new CharacterSheet(NPC_LOOK[district] ?? LOOKS.bo);
    this.bg = new Layer(() => staticLayer(district));
    if (vignette) this.vignette = new VignetteRenderer(vignette);
    this.fx = new SceneFx(district);
  }

  render(c: Ctx, t: number, status: Status, board: string[]): void {
    const shake = this.fx.step(t, status);
    c.save();
    c.translate(shake.dx, shake.dy);
    blit(c, this.bg.get(), 0, 0, W, 216);
    if (status === 'fixed' && this.lastStatus !== 'fixed') {
      for (let i = 0; i < 24; i++) this.sparkles.push({ x: 40 + Math.random() * 300, y: 30 + Math.random() * 90, a: 1 + Math.random() });
    }
    this.lastStatus = status;
    ANIMATE[this.district]?.(c, t, status);
    this.fx.drawUnder(c, t, status);
    drawBoard(c, t, status, board);
    this.vignette?.render(c, t, status);
    // district NPC
    const hop = status === 'fixed' ? Math.abs(Math.sin(t * 6)) * 3 : Math.floor(t * 2) % 2;
    const dir = status === 'broken' ? (Math.floor(t / 2) % 2 ? 'left' : 'right') : 'down';
    const blink = (t + 0.9) % 3.3 < 0.13 && status !== 'fixed';
    this.npc.draw(c, dir, blink ? 3 : 0, 196, 112 - hop);
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
    this.fx.drawOver(c, t, status);
    c.restore();
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
  // While checking, the text flickers like an old terminal refreshing.
  if (status === 'verifying' && Math.floor(t * 12) % 5 === 0) c.globalAlpha = 0.6;
  lines.forEach((l, i) => c.fillText(l.slice(0, 28), x + 5, y + 19 + i * 9));
  c.globalAlpha = 1;
  for (let yy = y + 1; yy < y + h; yy += 2) rect(c, x, yy, w, 0.5, 'rgba(0,0,0,0.12)');
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
  const R = rng(17);
  rect(c, 0, y, W, 216 - y, '#9a7448');
  for (let yy = y; yy < 216; yy += 6) {
    rect(c, 0, yy, W, 0.5, '#6a4a28');
    rect(c, 0, yy + 0.5, W, 0.5, '#b08a58');
    const off = ((yy / 6) % 2) * 16;
    for (let x = off; x < W; x += 32) {
      rect(c, x, yy, 0.5, 6, '#6a4a28');
      rect(c, x + 2, yy + 2.5, 0.5, 0.5, '#4a3018');
      rect(c, x + 29, yy + 2.5, 0.5, 0.5, '#4a3018');
      rect(c, x + 6, yy + 1.5, 10 + R() * 8, 0.5, 'rgba(0,0,0,0.08)');
    }
  }
}
function wall(c: Ctx, col: string, stripe: string, h: number): void {
  rect(c, 0, 0, W, h, col);
  for (let x = 0; x < W; x += 12) {
    rect(c, x, 0, 4, h, stripe);
    for (let yy = 4; yy < h - 8; yy += 10) rect(c, x + 7.5, yy, 1, 1, shade(col, -15));
  }
  rect(c, 0, 0, W, 3, shade(col, -30));
  rect(c, 0, 3, W, 0.5, shade(col, 20));
  rect(c, 0, h - 7, W, 0.5, shade(col, -25));
  rect(c, 0, h - 6.5, W, 4, '#d8c8a8');
  rect(c, 0, h - 4, W, 4, '#6b4a2a');
  rect(c, 0, h - 4, W, 0.5, '#8a6a42');
}
function windowPane(c: Ctx, x: number, y: number, w: number, h: number, night = false): void {
  rect(c, x - 3, y - 3, w + 6, h + 6, '#2a1e1a');
  rect(c, x - 2.5, y - 2.5, w + 5, h + 5, '#7a5030');
  rect(c, x, y, w, h, night ? '#1d2a4a' : '#8fd0ff');
  if (night) for (const [sx, sy] of [[0.2, 0.3], [0.7, 0.2], [0.5, 0.7]]) rect(c, x + w * sx, y + h * sy, 1, 1, '#ffffff');
  else {
    rect(c, x, y + h * 0.6, w, h * 0.4, '#bfe6ff');
    rect(c, x + 2, y + 2, 5, 1, '#ffffff');
    rect(c, x + 2, y + 4, 3, 1, '#ffffff');
  }
  rect(c, x + w / 2 - 1, y, 2, h, '#7a5030');
  rect(c, x, y + h / 2 - 1, w, 2, '#7a5030');
  rect(c, x - 4, y - 3, 5, h + 7, '#c0603a');
  rect(c, x + w - 1, y - 3, 5, h + 7, '#c0603a');
  for (let yy = y - 2; yy < y + h + 3; yy += 3) {
    rect(c, x - 3, yy, 0.5, 2, '#a04a2a');
    rect(c, x + w + 1, yy, 0.5, 2, '#a04a2a');
  }
  rect(c, x - 4, y + h + 2.5, w + 8, 2, '#8a5a30');
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
      lampPost(c, 90, 100);
      for (let x = 0; x < W; x += 8) rect(c, x + 0.5, 119, 7, 0.5, '#c9a466');
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
        rect(c, x - 0.5, 44, 5, 54, '#2a1e1a');
        rect(c, x, 44, 4, 54, '#7a5030');
        rect(c, x, 44, 1, 54, '#a07848');
      }
      rect(c, 0, 39.5, W, 7, '#2a1e1a');
      for (let x = 0; x < W; x += 4) rect(c, x, 40, 4, 6, (x / 4) % 2 ? '#946238' : '#8a5a30');
      rect(c, 0, 40, W, 1, '#b8844c');
      for (let x = 30; x < W; x += 90) lampPost(c, x, 96, false);
      rect(c, 0, 116, W, 1, '#f8d030');
      break;
    }
    case 'arch': {
      wall(c, '#e8dcc4', '#ddd0b4', 92);
      windowPane(c, 20, 18, 46, 36);
      floorboards(c, 92);
      bookshelf(c, 200, 20, 40, 66);
      plant(c, 6, 78);
      // pinned blueprints on the wall
      for (const [px, py] of [[260, 18], [300, 24]] as const) {
        rect(c, px - 0.5, py - 0.5, 29, 21, '#2a1e1a');
        rect(c, px, py, 28, 20, '#2a5a9a');
        for (let gx = px; gx < px + 28; gx += 4) rect(c, gx, py, 0.5, 20, '#3f70b0');
        rect(c, px + 4, py + 5, 12, 8, '#cfe0f8');
        rect(c, px + 4.5, py + 5.5, 11, 7, '#2a5a9a');
        disc(c, px + 14, py + 1, 1, '#c0392b');
      }
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
      for (let x = 0; x < W; x++) {
        const hh = 7 + Math.sin(x / 28) * 4 + Math.sin(x / 9) * 1.5;
        rect(c, x, 74 - hh, 1, hh, '#9cc48a');
        rect(c, x, 74 - hh, 1, 1, '#b4d8a0');
      }
      disc(c, 330, 30, 13, '#fff4c0');
      disc(c, 330, 30, 10, '#ffe680');
      container(c, 8, 92, 30, 18, '#c0392b');
      container(c, 8, 74, 30, 18, '#2b6cb0');
      container(c, 40, 100, 30, 18, '#e8a030');
      crane(c, 360, 30, 90, 70);
      for (let x = 0; x < W; x += 24) {
        rect(c, x + 10, 118, 3, 8, '#2a1e1a');
        rect(c, x + 10.5, 118, 2, 7.5, '#6a4a28');
      }
      break;
    }
    case 'watch': {
      sky(c, ['#1d2140', '#232a50', '#2a3360', '#323d70', '#3b4880'], 16);
      const R = rng(9);
      for (let i = 0; i < 60; i++) rect(c, (R() * W) | 0, (R() * 70) | 0, 1, 1, '#ffffff');
      rect(c, 0, 80, W, 40, '#3b4880'); // sky continues down to the hills (was a black gap)
      for (let x = 0; x < W; x++) {
        const hh = 30 + Math.sin(x / 40) * 10;
        rect(c, x, 120 - hh, 1, hh, '#2f5a3a');
      }
      rect(c, 0, 118, W, 98, '#3f6a3a');
      watchtower(c, 120, 30, 30, 90);
      const R2 = rng(4);
      for (let i = 0; i < 30; i++) rect(c, (R2() * W) | 0, 120 + ((R2() * 90) | 0), 1.5, 0.5, '#4f7a4a');
      disc(c, 330, 26, 9, '#f4f0d8');
      disc(c, 334, 23, 8, '#323d70');
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
      // vault door with rivets and handle
      disc(c, 160, 62, 27, '#2a1e1a');
      disc(c, 160, 62, 26, '#5a5a6a');
      disc(c, 160, 62, 22, '#7a7a8a');
      disc(c, 156, 58, 14, '#8a8a9a');
      for (let a = 0; a < 12; a++) disc(c, 160 + Math.cos((a / 12) * Math.PI * 2) * 24, 62 + Math.sin((a / 12) * Math.PI * 2) * 24, 1, '#3a3a4a');
      disc(c, 160, 62, 6, '#3a3a4a');
      disc(c, 159, 61, 2, '#9a9aaa');
      // workbench
      rect(c, 214, 70, 90, 6, '#2a1e1a');
      rect(c, 214.5, 70.5, 89, 5, '#946238');
      rect(c, 220, 76, 4, 16, '#6a4024');
      rect(c, 294, 76, 4, 16, '#6a4024');
      for (let i = 0; i < 4; i++) { disc(c, 236 + i * 14, 66, 3, ['#f8d030', '#c0c0c0', '#e08838', '#c0c0c0'][i]); rect(c, 235 + i * 14, 66, 2, 4, '#5a5a5a'); }
      plant(c, 330, 78);
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
      // silo with ladder
      rect(c, 149.5, 29.5, 31, 91, '#2a1e1a');
      rect(c, 150, 30, 30, 90, '#c0c4c8');
      rect(c, 150, 30, 6, 90, '#d8dce0');
      rect(c, 174, 30, 6, 90, '#a8acb0');
      for (let y = 36; y < 120; y += 8) rect(c, 150, y, 30, 0.5, '#9094a0');
      ellipse(c, 165, 30, 16, 9, '#2a1e1a');
      ellipse(c, 165, 30, 15, 8, '#a8acb0');
      ellipse(c, 162, 28, 8, 3, '#c8ccd0');
      rect(c, 176, 40, 0.5, 80, '#5a5a5a');
      rect(c, 179, 40, 0.5, 80, '#5a5a5a');
      for (let y = 42; y < 120; y += 3) rect(c, 176, y, 3.5, 0.5, '#5a5a5a');
      for (let i = 0; i < 4; i++) sack(c, 196 + i * 9, 110);
      sack(c, 200, 102);
      sack(c, 210, 102);
      break;
    }
    case 'hall':
    case 'big': {
      wall(c, '#efe0c8', '#e4d4b8', 92);
      windowPane(c, 24, 16, 40, 40, d === 'big');
      windowPane(c, 150, 16, 40, 40, d === 'big');
      floorboards(c, 92);
      // big wall clock with ticks
      disc(c, 107, 34, 15, '#2a1e1a');
      disc(c, 107, 34, 14, '#8a5a30');
      disc(c, 107, 34, 12, '#f8f0d8');
      for (let a = 0; a < 12; a++) rect(c, 107 + Math.cos((a / 12) * Math.PI * 2) * 10 - 0.5, 34 + Math.sin((a / 12) * Math.PI * 2) * 10 - 0.5, 1, 1, '#3a2a1a');
      // mayor's desk with drawers, papers and an inkpot
      rect(c, 59.5, 77.5, 101, 9, '#2a1e1a');
      rect(c, 60, 78, 100, 8, '#8a5a30');
      rect(c, 60, 78, 100, 1, '#a87444');
      rect(c, 64, 86, 92, 30, '#946238');
      for (const dx2 of [70, 128]) {
        rect(c, dx2, 90, 22, 8, '#7a4a24');
        rect(c, dx2 + 10, 93.5, 2, 1, '#e8c860');
        rect(c, dx2, 100, 22, 8, '#7a4a24');
        rect(c, dx2 + 10, 103.5, 2, 1, '#e8c860');
      }
      rect(c, 70, 72, 16, 6, '#f8f0d8');
      rect(c, 72, 73.5, 10, 0.5, '#9a8a7a');
      rect(c, 72, 75, 8, 0.5, '#9a8a7a');
      rect(c, 138, 72, 5, 6, '#2a2a3a');
      rect(c, 140, 66, 0.5, 7, '#f4f0e6');
      bookshelf(c, 230, 20, 46, 68);
      bookshelf(c, 282, 20, 46, 68);
      plant(c, 336, 78);
      // town banner
      rect(c, 196, 10, 24, 34, '#2a1e1a');
      rect(c, 196.5, 10.5, 23, 33, '#b5523b');
      rect(c, 200, 16, 16, 16, '#f8d030');
      rect(c, 204, 20, 8, 8, '#b5523b');
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
    rect(c, 359.5, 60, 7, 39, '#2a1e1a');
    rect(c, 360, 60, 6, 38, '#3a3a3a');
    rect(c, 355.5, 50.5, 15, 16, '#2a1e1a');
    rect(c, 356, 51, 14, 15, '#2a2a2a');
    disc(c, 363, 55, 3, s === 'broken' ? signal : '#4a2020');
    disc(c, 363, 62, 3, s === 'fixed' ? signal : '#204a20');
    if (s === 'verifying') disc(c, 363, 58.5, 2, signal);
    const x = trainX(t, s);
    const cars: [string, boolean][] = [['#2b6cb0', true], ['#b5523b', false], ['#e8a030', false], ['#27ae60', false]];
    cars.forEach(([col, loco], i) => {
      c.save();
      const cx = x + (cars.length - 1 - i) * 36;
      c.translate(cx + 16, 84 + 8);
      c.rotate(s === 'broken' && i === 2 ? 0.14 : 0);
      c.translate(-(cx + 16), -(84 + 8));
      railCar(c, cx, 84, 32, col, loco);
      c.restore();
    });
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
    const by = 104 + (s === 'broken' ? 3 : 0) + Math.sin(t * 2);
    const crates = s === 'broken' ? 4 : 6;
    const tilt = s === 'broken' ? 0.06 : 0;
    // reflection: the boat mirrored in the water, squashed and rippling
    c.save();
    c.beginPath();
    c.rect(0, 74, W, 46);
    c.clip();
    const axis = by + 13;
    c.globalAlpha = 0.22;
    for (let band = 0; band < 6; band++) {
      c.save();
      c.beginPath();
      c.rect(0, axis + band * 3, W, 3);
      c.clip();
      c.translate(Math.sin(t * 3 + band) * 1.5, axis * 1.6);
      c.scale(1, -0.6);
      boat(c, x, by, crates, tilt, 1.6);
      c.restore();
    }
    c.restore();
    boat(c, x, by, crates, tilt, 1.6);
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
    const x = s === 'fixed' ? ((t * 30) % 260) + 20 : 150 + Math.sin(t * 2) * 2;
    rect(c, x - 0.5, 107.5, 33, 9, '#2a1e1a');
    rect(c, x, 108, 32, 8, '#7a4f2e');
    for (let i = 0; i < 4; i++) rect(c, x + 1 + i * 8, 108, 0.5, 8, '#5a3418');
    rect(c, x, 108, 32, 1, '#9a6a3e');
    for (const wx of [x + 6, x + 26]) {
      disc(c, wx, 118, 4, '#2a1e1a');
      disc(c, wx, 118, 3, '#8a6a42');
      rect(c, wx - 0.25, 115, 0.5, 6, '#3a2a1a');
      rect(c, wx - 3, 117.75, 6, 0.5, '#3a2a1a');
    }
    for (let i = 0; i < 3; i++) sack(c, x + 2 + i * 9, 99);
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
    void s;
  },
};
