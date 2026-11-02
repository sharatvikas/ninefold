import { CharacterSheet, LOOKS, type Dir, type Look } from '../art/characters';
import { blit, Layer, makeCanvas, rect, rng, disc, snap, type Ctx } from '../art/pixels';
import { barn, boat, container, crane, flowers, fountain, house, lampPost, railCar, Smoke, station, tree, watchtower } from '../art/scenery';
import { VIEW_H, VIEW_W, type Game, type Scene } from '../engine/game';
import { getLevel } from '../levels/catalog';
import { bigIncidentBlockers, levelStatus, nextLevelIn } from '../state/progress';
import { moveBox, type Box } from './collision';
import { BUILDINGS, CRANE, FOUNTAIN, GRID, MAP_H, MAP_W, NPCS, PLAYER_START, TILE, isSolidTile, tileAt, type NpcSpawn } from './townMap';

const SPEED = 72; // px per second
const TALK_RANGE = 22;

interface Npc extends NpcSpawn {
  sheet: CharacterSheet;
  dir: Dir;
  box: Box;
  lookTimer: number;
}

export interface LevelResult {
  levelId: string;
  trust: number;
  completed: boolean;
}

export class TownScene implements Scene {
  private ground = new Layer(() => this.buildGround());
  private player = { box: { x: PLAYER_START.x * TILE + 3, y: PLAYER_START.y * TILE + 10, w: 10, h: 6 }, dir: 'down' as Dir, walk: 0, moving: false };
  private playerSheet: CharacterSheet;
  private npcs: Npc[];
  private cam = { x: 0, y: 0 };
  private trees: [number, number][] = [];
  private water: [number, number][] = [];
  private smoke = new Smoke();
  private nearby: Npc | undefined;
  private greeted = false;

  constructor(
    private game: Game,
    private startLevel: (id: string) => void,
  ) {
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        if (GRID[y][x] === 'T') this.trees.push([x, y]);
        if (GRID[y][x] === 'w') this.water.push([x, y]);
      }
    this.playerSheet = new CharacterSheet(game.progress.avatar?.look ?? LOOKS.player);
    this.npcs = NPCS.map((n) => ({
      ...n,
      sheet: new CharacterSheet(LOOKS[n.look as keyof typeof LOOKS]),
      dir: 'down' as Dir,
      box: { x: n.x * TILE + 2, y: n.y * TILE + 6, w: 12, h: 10 },
      lookTimer: 2 + Math.random() * 4,
    }));
  }

  enter(): void {
    const ui = this.game.ui;
    ui.hud.setTrust(this.game.progress.trust);
    ui.hud.el.classList.remove('hidden');
    ui.hud.ticketsBtn.onclick = () => ui.openQuestLog(this.game.progress, this.startLevel);
    ui.hud.avatarBtn.onclick = () => this.editAvatar();
    if (!this.greeted) {
      this.greeted = true;
      const first = Object.keys(this.game.progress.completed).length === 0;
      ui.dialog.show(
        '',
        first
          ? [
              `Welcome to Ninefold, ${this.game.progress.avatar?.name ?? 'our new on-call engineer'}! You're our new on-call engineer.`,
              'Walk with the arrow keys or WASD. Talk to people with E.',
              'A "!" means someone has a ticket for you. Press Q any time to see every ticket in town.',
              'Every district has six tickets, from friendly puzzles to real terminals. Start with anyone showing a "!"…',
            ]
          : [`Welcome back, ${this.game.progress.avatar?.name ?? 'on-call'}. Press Q to see your tickets.`],
      );
    }
  }

  setPlayerLook(look: Look): void {
    this.playerSheet.setLook(look);
  }

  editAvatar(): void {
    const ui = this.game.ui;
    if (ui.busy) return;
    ui.avatar.show(this.game.progress.avatar, (a) => {
      this.game.setAvatar(a);
      this.playerSheet.setLook(a.look);
      ui.toast(`LOOKING GOOD, ${a.name.toUpperCase()}!`, 'good');
    });
  }

  /** Called by main when a level scene hands control back. */
  returnFrom(r: LevelResult): void {
    const ui = this.game.ui;
    ui.hud.setTrust(this.game.progress.trust);
    if (!r.completed) return;
    const lvl = getLevel(r.levelId);
    const npc = this.npcs.find((n) => n.district === lvl.district);
    ui.toast(r.trust > 0 ? `TICKET CLOSED · TRUST +${r.trust}` : 'TICKET CLOSED', 'good');
    if (npc) ui.dialog.show(npc.name, [THANKS[lvl.district] ?? 'Thank you so much!']);
  }

  // ---------------------------------------------------------------- update
  update(dt: number, t: number): void {
    const { input, ui } = this.game;
    const p = this.player;

    for (const n of this.npcs) {
      n.lookTimer -= dt;
      if (n.lookTimer <= 0 && !ui.dialog.open) {
        n.lookTimer = 2 + Math.random() * 5;
        n.dir = (['down', 'down', 'left', 'right'] as Dir[])[Math.floor(Math.random() * 4)];
      }
    }

    p.moving = false;
    if (!ui.busy && input.enabled) {
      let dx = 0;
      let dy = 0;
      if (input.isDown('arrowleft', 'a')) dx -= 1;
      if (input.isDown('arrowright', 'd')) dx += 1;
      if (input.isDown('arrowup', 'w')) dy -= 1;
      if (input.isDown('arrowdown', 's')) dy += 1;
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        p.box = moveBox(p.box, (dx / len) * SPEED * dt, (dy / len) * SPEED * dt, this.solidAt);
        p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        p.moving = true;
        p.walk += dt;
      }

      this.nearby = this.findNearby();
      if (this.nearby && input.wasPressed('e', ' ', 'enter')) this.talk(this.nearby);
      else if (input.wasPressed('q')) ui.openQuestLog(this.game.progress, this.startLevel);
    }

    this.smoke.step(dt);
    if (!this.game.progress.completed['harbor-1']) this.smoke.spawn(33 * TILE, 18 * TILE, 0.3);

    const cx = p.box.x + p.box.w / 2 - VIEW_W / 2;
    const cy = p.box.y - VIEW_H / 2;
    this.cam.x = snap(Math.max(0, Math.min(MAP_W * TILE - VIEW_W, cx)));
    this.cam.y = snap(Math.max(0, Math.min(MAP_H * TILE - VIEW_H, cy)));
    void t;
  }

  private solidAt = (px: number, py: number): boolean => {
    if (isSolidTile(Math.floor(px / TILE), Math.floor(py / TILE))) return true;
    for (const n of this.npcs) {
      const b = n.box;
      if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) return true;
    }
    return false;
  };

  private findNearby(): Npc | undefined {
    const p = this.player.box;
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    let best: Npc | undefined;
    let bestD = TALK_RANGE;
    for (const n of this.npcs) {
      const d = Math.hypot(n.box.x + n.box.w / 2 - px, n.box.y + n.box.h / 2 - py);
      if (d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  private talk(n: Npc): void {
    const p = this.player.box;
    const dx = p.x + p.w / 2 - (n.box.x + n.box.w / 2);
    const dy = p.y - n.box.y;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';

    const prog = this.game.progress;
    const next = nextLevelIn(prog, n.district as Parameters<typeof nextLevelIn>[1]);
    const ui = this.game.ui;
    if (!next) {
      ui.dialog.show(n.name, ['Every ticket here is closed. You\'re a natural!']);
      return;
    }
    const st = levelStatus(prog, next);
    const intro = n.id === 'bo' && !prog.completed['hall-1'] ? MAYOR_INTRO : [];
    if (st === 'available') {
      ui.dialog.show(n.name, [...intro, next.ticket, `TICKET ${next.num}: "${next.title.toUpperCase()}". Let's go!`], () => this.startLevel(next.id));
    } else if (next.district === 'big') {
      const left = bigIncidentBlockers(prog, next.act).length;
      ui.dialog.show(n.name, [
        'I coordinate the Big Incidents: the ones that span the whole town.',
        `The next one is "${next.title}". I'll call you once every Act ${next.act} ticket in town is closed. ${left} to go.`,
      ]);
    } else {
      ui.dialog.show(n.name, [...intro, `Finish my earlier ticket first, then come back for "${next.title}".`]);
    }
  }

  private hasTicket(n: Npc): boolean {
    const next = nextLevelIn(this.game.progress, n.district as Parameters<typeof nextLevelIn>[1]);
    return !!next && levelStatus(this.game.progress, next) === 'available';
  }

  // ---------------------------------------------------------------- render
  render(c: Ctx, t: number): void {
    c.save();
    c.translate(-this.cam.x, -this.cam.y);
    blit(c, this.ground.get(), 0, 0, MAP_W * TILE, MAP_H * TILE);
    this.drawWater(c, t);
    this.drawHarborBoat(c, t);
    this.drawDockTop(c);

    type D = { y: number; draw: () => void };
    const ds: D[] = [];
    const vis = (x: number, y: number) => x > this.cam.x - 32 && x < this.cam.x + VIEW_W + 16 && y > this.cam.y - 32 && y < this.cam.y + VIEW_H + 32;
    this.trees.forEach(([tx, ty], i) => {
      const x = tx * TILE;
      const y = ty * TILE;
      if (!vis(x, y)) return;
      const sway = Math.sin(t * 1.3 + i * 0.7) > 0.75 ? 1 : 0;
      ds.push({ y: y + 15, draw: () => tree(c, x, y, sway) });
    });
    for (const n of this.npcs) {
      const bob = Math.sin(t * 2 + n.x) > 0.6 ? 1 : 0;
      ds.push({ y: n.box.y + n.box.h, draw: () => n.sheet.draw(c, n.dir, 0, n.box.x - 2, n.box.y - 6 - bob) });
    }
    const p = this.player;
    const frame = p.moving ? 1 + (Math.floor(p.walk * 8) % 2) : 0;
    ds.push({ y: p.box.y + p.box.h, draw: () => this.playerSheet.draw(c, p.dir, frame, p.box.x - 3, p.box.y - 10 - (frame ? 1 : 0)) });
    ds.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    this.smoke.draw(c);
    this.drawTrain(c, t);
    this.drawLamp(c, t);
    this.drawFountainSparkle(c, t);
    this.drawButterflies(c, t);

    for (const n of this.npcs) if (this.hasTicket(n)) this.bubble(c, n.box.x + 6, n.box.y - 22 - Math.abs(Math.sin(t * 5)) * 3, '!', '#d04040');
    if (this.nearby && !this.game.ui.busy) this.bubble(c, this.nearby.box.x + 6, this.nearby.box.y - (this.hasTicket(this.nearby) ? 36 : 22), 'E', '#2b6cb0');
    c.restore();
  }

  private bubble(c: Ctx, x: number, y: number, ch: string, col: string): void {
    rect(c, x - 1, y, 12, 12, '#2a1e1a');
    rect(c, x, y - 1, 10, 14, '#2a1e1a');
    rect(c, x, y + 1, 10, 10, '#fff');
    rect(c, x + 1, y, 8, 12, '#fff');
    rect(c, x + 4, y + 12, 2, 2, '#fff');
    c.font = '7px "Press Start 2P"';
    c.fillStyle = col;
    c.fillText(ch, Math.round(x + 2), Math.round(y + 10));
  }

  private drawWater(c: Ctx, t: number): void {
    for (const [tx, ty] of this.water) {
      const x = tx * TILE;
      const y = ty * TILE;
      if (x > this.cam.x + VIEW_W || x + TILE < this.cam.x || y > this.cam.y + VIEW_H || y + TILE < this.cam.y) continue;
      rect(c, x, y, TILE, TILE, '#3d8fd1');
      const o = Math.floor((t * 4 + tx * 3 + ty * 5) % 16);
      rect(c, x + ((o + 2) % 12), y + 4, 4, 1, '#7fc2f0');
      rect(c, x + ((o + 9) % 12), y + 11, 3, 1, '#7fc2f0');
      if ((tx + ty + Math.floor(t * 2)) % 7 === 0) rect(c, x + 7, y + 7, 2, 1, '#c8e8fa');
      if (tileAt(tx, ty - 1) !== 'w') {
        rect(c, x, y, TILE, 3, '#e6d7a8');
        rect(c, x, y + 3, TILE, 1, '#a8d8f8');
      }
    }
  }

  /** In town, the Harbor's crash-loop is visible until you fix it. */
  private drawHarborBoat(c: Ctx, t: number): void {
    const fixed = !!this.game.progress.completed['harbor-1'];
    const waterline = 22 * TILE + 10;
    c.save();
    c.beginPath();
    c.rect(28 * TILE, 21 * TILE, 12 * TILE, waterline - 21 * TILE + 1);
    c.clip();
    if (fixed) {
      const x = 28 * TILE + ((t * 14) % (12 * TILE + 40)) - 30;
      boat(c, x, waterline - 5 + Math.sin(t * 2), 6);
    } else {
      const cyc = (t % 7) / 7;
      if (cyc < 0.7) {
        const crates = Math.min(9, Math.floor((cyc / 0.7) * 9));
        boat(c, 29 * TILE + (cyc / 0.7) * 100, waterline - 5 + crates * 0.3 + Math.sin(t * 3), crates);
      } else {
        const k = (cyc - 0.7) / 0.3;
        boat(c, 29 * TILE + 100, waterline - 2 + k * 14, 9, k * 0.5);
        if (k < 0.8) for (let i = 0; i < 3; i++) disc(c, 29 * TILE + 112 + i * 4, waterline - 2 - ((t * 20 + i * 7) % 10), 1, '#c8e8fa');
      }
    }
    c.restore();
  }

  private drawDockTop(c: Ctx): void {
    crane(c, CRANE.x * TILE + 5, (CRANE.y - 2) * TILE, 5 * TILE + 8, 70);
  }

  private drawTrain(c: Ctx, t: number): void {
    const x = ((t * 46) % (MAP_W * TILE + 240)) - 120;
    const y = 2 * TILE + 3;
    const cars: [string, boolean][] = [['#2b6cb0', true], ['#b5523b', false], ['#e8a030', false], ['#27ae60', false]];
    cars.forEach(([col, loco], i) => railCar(c, x - i * 30, y, 28, col, loco));
    if (Math.floor(t * 4) % 2) disc(c, x + 6, y - 10, 3, 'rgba(240,240,240,0.7)');
  }

  private drawLamp(c: Ctx, t: number): void {
    const b = BUILDINGS.find((b) => b.id === 'watch')!;
    const x = b.x * TILE + b.w * 8 - 3;
    const y = b.y * TILE + 3;
    const on = Math.floor(t * 1.5) % 2 === 0;
    rect(c, x, y, 6, 5, on ? '#ffe680' : '#b89838');
    if (on) disc(c, x + 3, y + 2, 7, 'rgba(255,230,128,0.18)');
  }

  private drawFountainSparkle(c: Ctx, t: number): void {
    const cx = FOUNTAIN.x * TILE;
    const cy = FOUNTAIN.y * TILE;
    for (let i = 0; i < 5; i++) {
      const a = t * 2 + i * 1.25;
      rect(c, cx + Math.cos(a) * 6, cy - 9 + Math.sin(a) * 2 - Math.abs(Math.sin(t * 3 + i)) * 4, 1, 1, '#d8f0ff');
    }
  }

  private drawButterflies(c: Ctx, t: number): void {
    const spots = [
      [9 * TILE, 12 * TILE, '#ff9ad0'],
      [25 * TILE, 9 * TILE, '#ffe066'],
      [12 * TILE, 21 * TILE, '#b48cff'],
    ] as const;
    spots.forEach(([bx0, by0, col], i) => {
      const bx = bx0 + Math.sin(t * 0.7 + i) * 30;
      const by = by0 + Math.sin(t * 1.9 + i * 2) * 8;
      const f = Math.floor(t * 8 + i) % 2;
      rect(c, bx, by, 1, 1, '#2a1e1a');
      rect(c, bx - 1 - f, by - 1 + f, 1 + f, 1, col);
      rect(c, bx + 1, by - 1 + f, 1 + f, 1, col);
    });
  }

  // ---------------------------------------------------------------- static ground
  private buildGround(): HTMLCanvasElement {
    const [cv, c] = makeCanvas(MAP_W * TILE, MAP_H * TILE);
    const R = rng(7);
    rect(c, 0, 0, cv.width, cv.height, '#5fae4a');
    for (let i = 0; i < 3500; i++) rect(c, (R() * cv.width) | 0, (R() * cv.height) | 0, 1, 1, R() < 0.5 ? '#55a042' : '#6dbd55');
    for (let i = 0; i < 260; i++) {
      const x = (R() * cv.width) | 0;
      const y = (R() * cv.height) | 0;
      rect(c, x, y, 1, 2, '#3f8a36');
      rect(c, x + 2, y, 1, 2, '#3f8a36');
      rect(c, x + 1, y - 1, 1, 2, '#4a9a3e');
    }
    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++) {
        const t = GRID[ty][tx];
        const x = tx * TILE;
        const y = ty * TILE;
        if (t === 'p') {
          rect(c, x, y, TILE, TILE, '#d9b77a');
          for (let i = 0; i < 18; i++) rect(c, x + ((R() * 16) | 0), y + ((R() * 16) | 0), 1, 1, R() < 0.5 ? '#c9a466' : '#e6c890');
          const edge = '#b8955c';
          if (tileAt(tx, ty - 1) !== 'p') rect(c, x, y, TILE, 1, edge);
          if (tileAt(tx, ty + 1) !== 'p') rect(c, x, y + 15, TILE, 1, edge);
          if (tileAt(tx - 1, ty) !== 'p') rect(c, x, y, 1, TILE, edge);
          if (tileAt(tx + 1, ty) !== 'p') rect(c, x + 15, y, 1, TILE, edge);
        } else if (t === 'r') {
          if (ty === 2) {
            for (let k = 0; k < TILE; k += 5) rect(c, x + k, y + 8, 3, 20, '#6b4a2a');
            rect(c, x, y + 11, TILE, 2, '#9aa0a8');
            rect(c, x, y + 21, TILE, 2, '#9aa0a8');
          }
        } else if (t === 'd') {
          rect(c, x, y, TILE, TILE, '#a07a4a');
          for (let k = 0; k < TILE; k += 4) rect(c, x, y + k, TILE, 1, '#7a5530');
          rect(c, x + ((tx * 5) % 12), y, 1, TILE, '#7a5530');
          if (tileAt(tx, ty + 1) === 'w') {
            rect(c, x + 2, y + 16, 2, 6, '#6b4a2a');
            rect(c, x + 12, y + 16, 2, 6, '#6b4a2a');
          }
        } else if (t === 'F') {
          flowers(c, x, y, tx * 31 + ty * 17);
        }
      }
    for (const b of BUILDINGS) {
      const x = b.x * TILE;
      const y = b.y * TILE;
      const w = b.w * TILE;
      const hgt = b.h * TILE;
      if (b.kind === 'house') house(c, x, y, w, hgt, { roof: b.roof, wall: b.wall, label: b.label });
      else if (b.kind === 'station') station(c, x, y, w, hgt);
      else if (b.kind === 'barn') barn(c, x, y, w, hgt);
      else watchtower(c, x, y, w, hgt);
    }
    fountain(c, FOUNTAIN.x * TILE, FOUNTAIN.y * TILE);
    for (const [lx, ly] of [[18, 13], [21, 13], [11, 14], [26, 14], [16, 25], [23, 25]] as const) lampPost(c, lx * TILE + 7, ly * TILE - 2);
    container(c, 33 * TILE, 19 * TILE + 3, 20, 13, '#c0392b');
    container(c, 34 * TILE + 6, 19 * TILE + 3, 20, 13, '#2b6cb0');
    container(c, 36 * TILE - 4, 19 * TILE + 3, 18, 13, '#27ae60');
    container(c, 34 * TILE - 2, 19 * TILE - 8, 20, 12, '#e8a030');
    return cv;
  }
}

const MAYOR_INTRO = [
  'Ah, our new on-call! I\'m Mayor Bo. Every shop and service in Ninefold runs on trust.',
  'Fix things well and Trust goes up. Guess wildly and it goes down. Look before you leap!',
];

const THANKS: Record<string, string> = {
  harbor: 'The ships are sailing clear! Every crate gets where it\'s going now. Thank you!',
  post: 'Letters are reaching the right doors again. Thank you!',
  rail: 'The trains are running on time again. The whole yard owes you one!',
  arch: 'Blueprint and town match again. That\'s how it should be.',
  watch: 'I can see so much more from up here now. Thank you!',
  lock: 'Every lock in town is a little safer tonight.',
  granary: 'The granary\'s running smoothly. Have a loaf on me!',
  hall: 'Splendid work. The town council is impressed.',
  big: 'That was a big one. The whole town is back on its feet thanks to you.',
};
