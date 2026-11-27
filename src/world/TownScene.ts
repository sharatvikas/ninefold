import { CharacterSheet, LOOKS, type Dir, type Look } from '../art/characters';
import { applySky, Birds, CloudShadows, Fireflies, glow, gust, Particles, prefersReducedMotion, skyAt, type Sky } from '../art/atmosphere';
import { blit, ellipse, Layer, makeCanvas, pixelText, rect, rng, disc, snap, type Ctx } from '../art/pixels';
import { barn, boat, container, crane, flowers, fountain, house, lampPost, railCar, Smoke, station, tree, watchtower } from '../art/scenery';
import { VIEW_H, VIEW_W, type Game, type Scene } from '../engine/game';
import { getLevel } from '../levels/catalog';
import { bigIncidentBlockers, levelStatus, nextLevelIn, type Progress } from '../state/progress';
import { moveBox, type Box } from './collision';
import { CURIOS, curioAt, type Curio } from './curios';
import { Interior } from './Interior';
import { DOOR_COLS, NPC_SPOT, ROOM_H, ROOMS, ROOM_Y } from './rooms';
import { BENCH, BUILDINGS, CRANE, FOUNTAIN, GRID, MAP_H, MAP_W, NPCS, PLAYER_START, POSTBOX, TILE, buildingAtDoor, doorOf, isPondTile, isSolidTile, tileAt, type Building, type NpcSpawn } from './townMap';
import { Pastimes, type Prompt } from './PastimeRuntime';

const SPEED = 72; // px per second
const TALK_RANGE = 22;

interface Npc extends NpcSpawn {
  sheet: CharacterSheet;
  dir: Dir;
  box: Box;
  lookTimer: number;
  /** Seconds offset so NPCs don't all blink together. */
  blinkPhase: number;
}

/** Where lamp posts stand (tile coords). Their heads glow after dark. */
const LAMPS: [number, number][] = [[18, 13], [21, 13], [11, 14], [26, 14], [16, 25], [23, 25], [45, 12], [49, 12], [42, 16], [53, 16]];
/** Lily pads on the meadow pond (tile coords). */
const LILIES: [number, number][] = [[45, 6], [49, 8], [44, 9], [50, 5]];
/** Walk cycle: step, stand, other step, stand. */
const WALK = [1, 0, 2, 0];
const FIREWORK_COLS = ['#ff6a8a', '#ffd23f', '#5ee08a', '#5ab4ff', '#c08aff'];

export interface LevelResult {
  levelId: string;
  trust: number;
  completed: boolean;
  /** Set when the level already saved the solve itself: the Trust that save actually added. */
  gained?: number;
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
  /** Short-lived pixels in the world: dust, petals, confetti. */
  private fx = new Particles();
  /** Additive sparks drawn after the night tint so they glow. */
  private sparks = new Particles();
  private clouds = new CloudShadows(MAP_W * TILE, MAP_H * TILE);
  private birds = new Birds();
  private flies: Fireflies;
  private camReady = false;
  private walkStep = -1;
  private reduced = prefersReducedMotion();
  private sky: Sky = skyAt(9 * 60);
  /** A celebration in progress over a district whose ticket was just closed. */
  private party: { x: number; y: number; left: number; next: number } | undefined;
  /** The building the player is inside, if any. */
  private inside: Interior | undefined;
  /** The building whose door the player is standing at, if any. */
  private atDoor: Building | undefined;
  /** Fishing, bugs, the Letter Run, the cat and the fountain. */
  private play: Pastimes;
  /** The pastime the player could start right here. */
  private prompt: Prompt | undefined;
  /** Tap-to-move: where the player is walking to, and whether to act on arrival. */
  private walkTo: { x: number; y: number; act: boolean; thing?: boolean } | undefined;
  private stuck = 0;
  /** True on touch screens: tap to walk, and hints say "tap". */
  private touch = matchMedia?.('(pointer: coarse)').matches ?? false;

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
      blinkPhase: Math.random() * 4,
    }));
    const spots: [number, number][] = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if ((GRID[y][x] === 'F' || GRID[y][x] === 'T') && (x * 7 + y * 13) % 3 === 0) spots.push([x * TILE, y * TILE]);
    this.flies = new Fireflies(spots);
    this.play = new Pastimes({
      game,
      player: () => ({ box: this.player.box, dir: this.player.dir, moving: this.player.moving }),
      face: (d) => {
        this.player.dir = d;
      },
      night: () => this.sky.night,
      reduced: this.reduced,
      fx: this.fx,
      sparks: this.sparks,
    });
    this.play.cam = this.cam;
    this.play.touch = this.touch;
  }

  enter(): void {
    const ui = this.game.ui;
    ui.hud.setTrust(this.game.progress.trust);
    ui.hud.el.classList.remove('hidden');
    ui.hud.ticketsBtn.onclick = () => ui.openQuestLog(this.game.progress, this.startLevel, this.reset, this.importSave);
    ui.hud.avatarBtn.onclick = () => this.editAvatar();
    ui.hud.journalBtn.onclick = () => this.openJournal();
    if (!this.greeted) {
      this.greeted = true;
      const first = Object.keys(this.game.progress.completed).length === 0;
      ui.dialog.show(
        '',
        first
          ? [
              `Welcome to Ninefold, ${this.game.progress.avatar?.name ?? 'our new on-call engineer'}! You're our new on-call engineer.`,
              this.touch
                ? 'Tap where you want to walk, or drag your finger to steer. Tap a door to go inside, and tap people to talk.'
                : 'Walk with the arrow keys or WASD, or click where to go. Walk up to a door to go inside, and talk to people with E.',
              'A "!" over a person or a door means someone has a ticket for you. Press Q any time to see every ticket in town.',
              'Every district has six tickets, from friendly puzzles to real terminals. Start with anyone showing a "!"…',
            ]
          : [`Welcome back, ${this.game.progress.avatar?.name ?? 'on-call'}. Press Q to see your tickets.`],
      );
    }
  }

  /** Wipe tickets and Trust (keeping the avatar) and start the town tour again. */
  private reset = (): void => {
    const ui = this.game.ui;
    this.game.resetProgress();
    this.inside = undefined;
    this.player.box = { ...this.player.box, x: PLAYER_START.x * TILE + 3, y: PLAYER_START.y * TILE + 10 };
    this.player.dir = 'down';
    this.camReady = false;
    ui.hud.setTrust(this.game.progress.trust);
    ui.toast('PROGRESS RESET · FRESH START', 'info');
    this.greeted = false;
    this.enter();
  };

  /** Load progress from a save code pasted in from another browser or device. */
  private importSave = (p: Progress): void => {
    const ui = this.game.ui;
    // A code with no character in it keeps the one this browser already has.
    const avatar = p.avatar ?? this.game.progress.avatar;
    const cur = this.game.progress;
    const found = p.found ?? cur.found;
    const fish = p.fish ?? cur.fish;
    const bugs = p.bugs ?? cur.bugs;
    const runBest = p.runBest ?? cur.runBest;
    this.game.replaceProgress({ ...p, ...(avatar ? { avatar } : {}), ...(found ? { found } : {}), ...(fish ? { fish } : {}), ...(bugs ? { bugs } : {}), ...(runBest !== undefined ? { runBest } : {}) });
    this.playerSheet.setLook(avatar?.look ?? LOOKS.player);
    ui.hud.setTrust(p.trust);
    const n = Object.keys(p.completed).length;
    ui.toast(`SAVE LOADED · ${n} TICKET${n === 1 ? '' : 'S'} CLOSED`, 'good');
  };

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
    if (this.inside) {
      if (!this.reduced) this.inside.celebrate();
    } else if (!this.reduced) {
      // Celebrate where the player can see it: fireworks over them, confetti at their feet.
      const pb = this.player.box;
      this.party = { x: pb.x + pb.w / 2, y: pb.y - 10, left: 3, next: 0.15 };
      this.fx.confetti(pb.x + pb.w / 2, pb.y - 12);
    }
    if (npc) ui.dialog.show(npc.name, [THANKS[lvl.district] ?? 'Thank you so much!']);
  }

  // ---------------------------------------------------------------- update
  update(dt: number, t: number): void {
    if (this.inside) {
      this.updateInside(dt, this.inside);
      return;
    }
    const { input, ui } = this.game;
    const p = this.player;

    for (const n of this.npcs) {
      if (n.home) continue;
      n.lookTimer -= dt;
      if (n.lookTimer <= 0 && !ui.dialog.open) {
        n.lookTimer = 2 + Math.random() * 5;
        n.dir = (['down', 'down', 'left', 'right'] as Dir[])[Math.floor(Math.random() * 4)];
      }
    }

    p.moving = false;
    let fishE = false;
    this.prompt = undefined;
    if (!ui.busy && input.enabled) {
      let dx = 0;
      let dy = 0;
      if (input.isDown('arrowleft', 'a')) dx -= 1;
      if (input.isDown('arrowright', 'd')) dx += 1;
      if (input.isDown('arrowup', 'w')) dy -= 1;
      if (input.isDown('arrowdown', 's')) dy += 1;
      let e = input.wasPressed('e', ' ', 'enter');
      if (dx || dy) this.walkTo = undefined;
      else if (input.tapAt) e = this.onTap(this.cam.x + input.tapAt.x, this.cam.y + input.tapAt.y) || e;
      else if (input.holdAt) this.walkTo = { x: this.cam.x + input.holdAt.x, y: this.cam.y + input.holdAt.y, act: false };
      const fx = p.box.x + p.box.w / 2;
      const fy = p.box.y + p.box.h / 2;
      const w = this.walkTo;
      if (w && !dx && !dy) {
        const d = Math.hypot(w.x - fx, w.y - fy);
        if (d < 2.5) this.walkTo = undefined;
        else {
          dx = (w.x - fx) / d;
          dy = (w.y - fy) / d;
        }
      }
      // Walking away puts the rod down.
      if ((dx || dy) && this.play.fishing) this.play.reelIn();
      if ((dx || dy) && !this.play.holdsPlayer) {
        const len = Math.hypot(dx, dy);
        const before = p.box;
        p.box = moveBox(p.box, (dx / len) * SPEED * dt, (dy / len) * SPEED * dt, this.solidAt);
        this.stepPlayer(dx, dy, dt, (x, y) => this.fx.dust(x, y));
        // Walking into a wall: give up after a moment rather than pushing forever.
        const moved = Math.hypot(p.box.x - before.x, p.box.y - before.y);
        this.stuck = moved < SPEED * dt * 0.25 ? this.stuck + dt : 0;
        if (this.walkTo && this.stuck > 0.25) {
          this.walkTo = undefined;
          this.stuck = 0;
        }
      } else this.walkStep = -1;

      if (this.play.fishing) {
        fishE = e;
        this.nearby = undefined;
        this.atDoor = undefined;
      } else {
        this.nearby = this.findNearby();
        // During the Letter Run, doors take letters instead of letting you in.
        this.atDoor = this.nearby || this.play.running ? undefined : this.doorUnderPlayer();
        this.prompt = this.nearby || this.atDoor ? undefined : this.play.prompt();
        // Tapped something from afar: walk there, then do it.
        const w = this.walkTo;
        if (w?.act && Math.hypot(w.x - (p.box.x + p.box.w / 2), w.y - (p.box.y + p.box.h / 2)) < 22) {
          // You tapped the fountain or the cat, not the person standing beside it.
          const thing = w.thing ? this.play.prompt() : undefined;
          if (thing) {
            this.nearby = undefined;
            this.atDoor = undefined;
            this.prompt = thing;
          }
          if (this.nearby || this.atDoor || this.prompt) {
            this.walkTo = undefined;
            e = true;
          }
        }
        const curio = curioAt(p.box.x + p.box.w / 2, p.box.y + p.box.h / 2, this.game.progress.found ?? [], TILE);
        if (curio) this.collect(curio);
        else if (this.nearby && e) this.talk(this.nearby);
        else if (this.atDoor && (e || (dy < 0 && dx === 0 && !this.walkTo))) this.goIn(this.atDoor);
        else if (this.prompt && e) this.prompt.act();
        else if (input.wasPressed('q')) {
          this.play.cancelRun();
          ui.openQuestLog(this.game.progress, this.startLevel, this.reset, this.importSave);
        } else if (input.wasPressed('j')) this.openJournal();
      }
    } else {
      this.atDoor = undefined;
      this.walkTo = undefined;
    }
    this.play.update(dt, t, fishE);

    this.smoke.step(dt);
    if (!this.game.progress.completed['harbor-1']) this.smoke.spawn(33 * TILE, 18 * TILE, 0.3);

    // Camera glides after the player and looks a little ahead of where they're walking.
    const ahead = p.moving ? 14 : 0;
    const lx = p.dir === 'left' ? -ahead : p.dir === 'right' ? ahead : 0;
    const ly = p.dir === 'up' ? -ahead * 0.6 : p.dir === 'down' ? ahead * 0.6 : 0;
    const tx = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, p.box.x + p.box.w / 2 - VIEW_W / 2 + lx));
    const ty = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, p.box.y - VIEW_H / 2 + ly));
    if (!this.camReady || this.reduced) {
      this.cam.x = tx;
      this.cam.y = ty;
      this.camReady = true;
    } else {
      const k = 1 - Math.exp(-dt * 6);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }

    this.game.focus = { x: (p.box.x + p.box.w / 2 - this.cam.x) / VIEW_W, y: (p.box.y - 4 - this.cam.y) / VIEW_H };

    // Weather, light and celebrations.
    this.sky = skyAt(ui.hud.timeOfDay);
    const wind = gust(t);
    this.clouds.step(dt, wind);
    this.birds.step(dt, { x: this.cam.x, y: this.cam.y, w: VIEW_W, h: VIEW_H }, this.sky.night);
    if (!this.reduced && wind > 0.4 && Math.random() < dt * wind * 7) {
      const leaf = Math.random() < 0.35;
      this.fx.add({
        x: this.cam.x - 4 + Math.random() * VIEW_W * 0.6,
        y: this.cam.y + Math.random() * VIEW_H,
        vx: 18 + wind * 26,
        vy: 3 + Math.random() * 6,
        life: 4 + Math.random() * 2,
        max: 6,
        size: 1,
        col: leaf ? '#4f9a3c' : Math.random() < 0.5 ? '#ffc0d8' : '#fff4f8',
        flutter: 14,
        phase: Math.random() * 6,
      });
    }
    this.fx.step(dt, wind);
    this.sparks.step(dt);
    if (this.party) {
      const pt = this.party;
      pt.left -= dt;
      pt.next -= dt;
      if (pt.next <= 0 && pt.left > 0.6) {
        pt.next = 0.38;
        this.sparks.firework(pt.x + (Math.random() - 0.5) * 70, pt.y - 30 - Math.random() * 40, FIREWORK_COLS[Math.floor(Math.random() * FIREWORK_COLS.length)]);
      }
      if (pt.left <= 0) this.party = undefined;
    }
  }

  /** Facing, walk cycle and footstep dust, shared by the town and the rooms. */
  private stepPlayer(dx: number, dy: number, dt: number, dust: (x: number, y: number) => void): void {
    const p = this.player;
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    p.moving = true;
    p.walk += dt;
    const step = Math.floor(p.walk * 9) % 4;
    const box = this.inside ? this.inside.box : p.box;
    if (step !== this.walkStep && WALK[step] !== 0 && !this.reduced) dust(box.x + box.w / 2, box.y + box.h);
    this.walkStep = step;
  }

  // ---------------------------------------------------------------- doors and rooms
  /** The building whose door the player is standing on, if it has a room to go into. */
  private doorUnderPlayer(): Building | undefined {
    const b = this.player.box;
    const d = buildingAtDoor(Math.floor((b.x + b.w / 2) / TILE), Math.floor((b.y + b.h / 2) / TILE));
    return d && ROOMS[d.id] ? d : undefined;
  }

  private goIn(b: Building): void {
    this.game.ui.iris(
      () => {
        if (this.inside) return;
        this.inside = new Interior(ROOMS[b.id], this.npcs.find((n) => n.home === b.id));
        this.walkTo = undefined;
        this.player.dir = 'up';
        this.player.moving = false;
        this.atDoor = undefined;
        this.nearby = undefined;
        this.game.focus = this.inside.focus();
      },
      this.game.focus.x,
      this.game.focus.y,
    );
  }

  private goOut(room: Interior): void {
    this.game.ui.iris(
      () => {
        if (this.inside !== room) return;
        this.inside = undefined;
        this.walkTo = undefined;
        const b = BUILDINGS.find((x) => x.id === room.room.id)!;
        const d = doorOf(b);
        this.player.box = { ...this.player.box, x: d.x * TILE + 3, y: d.y * TILE + 5 };
        this.player.dir = 'down';
        this.player.moving = false;
        this.camReady = false;
      },
      this.game.focus.x,
      this.game.focus.y,
    );
  }

  private updateInside(dt: number, room: Interior): void {
    const { input, ui } = this.game;
    const p = this.player;
    room.update(dt, ui.busy);
    p.moving = false;
    // Once through the doorway, stop and wait for the wipe back outside.
    if (room.left) {
      this.goOut(room);
      return;
    }
    if (!ui.busy && input.enabled) {
      let dx = 0;
      let dy = 0;
      if (input.isDown('arrowleft', 'a')) dx -= 1;
      if (input.isDown('arrowright', 'd')) dx += 1;
      if (input.isDown('arrowup', 'w')) dy -= 1;
      if (input.isDown('arrowdown', 's')) dy += 1;
      let e = input.wasPressed('e', ' ', 'enter');
      const b = room.box;
      const fx = b.x + b.w / 2;
      const fy = b.y + b.h / 2;
      if (dx || dy) this.walkTo = undefined;
      else if (input.tapAt || input.holdAt) {
        const at = (input.tapAt ?? input.holdAt)!;
        const x = at.x;
        const y = at.y - ROOM_Y;
        const atCounter = !!room.resident && Math.hypot(x - NPC_SPOT.x, y - (NPC_SPOT.y - 10)) < 22;
        // Tapping anywhere around the doorway means "leave": walk right on through it.
        const atDoorway = x >= (DOOR_COLS[0] - 1) * TILE && x < (DOOR_COLS[DOOR_COLS.length - 1] + 2) * TILE && y >= (ROOM_H - 2) * TILE;
        if (atCounter && room.canTalk() && input.tapAt) e = true;
        else if (atDoorway) this.walkTo = { x: ((DOOR_COLS[0] + DOOR_COLS[DOOR_COLS.length - 1] + 1) / 2) * TILE, y: ROOM_H * TILE + 10, act: false };
        else this.walkTo = atCounter ? { x: NPC_SPOT.x, y: NPC_SPOT.y + 12, act: true } : { x, y, act: false };
      }
      const w = this.walkTo;
      if (w && !dx && !dy) {
        const d = Math.hypot(w.x - fx, w.y - fy);
        if (d < 2.5) this.walkTo = undefined;
        else {
          dx = (w.x - fx) / d;
          dy = (w.y - fy) / d;
        }
      }
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        const before = room.box;
        room.move((dx / len) * SPEED * dt, (dy / len) * SPEED * dt);
        this.stepPlayer(dx, dy, dt, (x, y) => room.fx.dust(x, y));
        const moved = Math.hypot(room.box.x - before.x, room.box.y - before.y);
        this.stuck = moved < SPEED * dt * 0.25 ? this.stuck + dt : 0;
        if (this.walkTo && this.stuck > 0.25) {
          this.walkTo = undefined;
          this.stuck = 0;
        }
      } else this.walkStep = -1;
      if (this.walkTo?.act && room.canTalk()) {
        this.walkTo = undefined;
        e = true;
      }
      const r = room.resident as Npc | undefined;
      if (r && room.canTalk() && e) {
        r.dir = 'down';
        this.talk(r);
      } else if (input.wasPressed('q')) ui.openQuestLog(this.game.progress, this.startLevel, this.reset, this.importSave);
    }
    this.game.focus = room.focus();
  }

  private solidAt = (px: number, py: number): boolean => {
    if (isSolidTile(Math.floor(px / TILE), Math.floor(py / TILE))) return true;
    for (const n of this.npcs) {
      if (n.home) continue;
      const b = n.box;
      if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) return true;
    }
    return false;
  };

  /** Pick up a curio: save it, celebrate, and tell its story. */
  private collect(k: Curio): void {
    const ui = this.game.ui;
    this.game.foundCurio(k.id);
    const n = this.game.progress.found?.length ?? 0;
    if (!this.reduced) this.sparks.firework((k.x + 0.5) * TILE, k.y * TILE - 4, '#ffd23f');
    ui.toast(`FOUND: ${k.name.toUpperCase()} · ${n}/${CURIOS.length} CURIOS`, 'good');
    const done = n === CURIOS.length ? ["That's every curio in Ninefold. You know this town inside out!"] : [];
    ui.dialog.show(`✦ ${k.name}`, [k.story, ...done]);
  }

  /** Unfound curios glint on the ground, so exploring is rewarded. */
  private drawCurios(c: Ctx, t: number, night = 0): void {
    const found = this.game.progress.found ?? [];
    for (const k of CURIOS) {
      if (found.includes(k.id)) continue;
      const x = Math.round((k.x + 0.5) * TILE);
      const y = Math.round((k.y + 0.5) * TILE);
      if (night) {
        glow(c, x, y - 1, 9, '255,230,140', 0.45 * night);
        continue;
      }
      const bob = this.reduced ? 0 : Math.round(Math.sin(t * 3 + k.x) * 1.5);
      rect(c, x - 2, y + 4, 5, 1, 'rgba(0,0,0,0.18)');
      rect(c, x, y - 4 + bob, 1, 7, '#fff3b0');
      rect(c, x - 3, y - 1 + bob, 7, 1, '#fff3b0');
      rect(c, x - 1, y - 2 + bob, 3, 3, '#ffd23f');
      rect(c, x, y - 1 + bob, 1, 1, '#ffffff');
      if ((t * 1.5 + k.y) % 2 < 0.5) rect(c, x + 3, y - 5 + bob, 1, 1, '#ffffff');
    }
  }

  private findNearby(): Npc | undefined {
    const p = this.player.box;
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    let best: Npc | undefined;
    let bestD = TALK_RANGE;
    for (const n of this.npcs) {
      if (n.home) continue;
      const d = Math.hypot(n.box.x + n.box.w / 2 - px, n.box.y + n.box.h / 2 - py);
      if (d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  private talk(n: Npc): void {
    if (!this.inside) {
      const p = this.player.box;
      const dx = p.x + p.w / 2 - (n.box.x + n.box.w / 2);
      const dy = p.y - n.box.y;
      n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    }

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
    if (this.inside) {
      this.renderInside(c, t, this.inside);
      return;
    }
    c.save();
    c.translate(-snap(this.cam.x), -snap(this.cam.y));
    blit(c, this.ground.get(), 0, 0, MAP_W * TILE, MAP_H * TILE);
    this.drawWater(c, t);
    this.drawHarborBoat(c, t);
    this.drawDockTop(c);
    this.play.drawGround(c);
    this.drawWalkMarker(c, t);

    this.drawCurios(c, t);

    type D = { y: number; draw: () => void };
    const ds: D[] = [];
    const vis = (x: number, y: number) => x > this.cam.x - 32 && x < this.cam.x + VIEW_W + 16 && y > this.cam.y - 32 && y < this.cam.y + VIEW_H + 32;
    this.trees.forEach(([tx, ty], i) => {
      const x = tx * TILE;
      const y = ty * TILE;
      if (!vis(x, y)) return;
      // Gusts roll across town as a wave, so neighbouring trees bend one after another.
      const wind = gust(t - x / 160);
      const sway = this.reduced ? 0 : wind > 0.3 && Math.sin(t * (4 + wind * 4) + i * 0.9) > 0.1 ? 1 : Math.sin(t * 1.3 + i * 0.7) > 0.85 ? 1 : 0;
      ds.push({ y: y + 15, draw: () => tree(c, x, y, sway) });
    });
    const blinking = (phase: number) => (t + phase) % 3.6 < 0.13;
    for (const n of this.npcs) {
      if (n.home) continue;
      const bob = Math.sin(t * 2 + n.x) > 0.6 ? 1 : 0;
      const f = blinking(n.blinkPhase) ? 3 : 0;
      ds.push({ y: n.box.y + n.box.h, draw: () => n.sheet.draw(c, n.dir, f, n.box.x - 2, n.box.y - 6 - bob) });
    }
    const p = this.player;
    ds.push({ y: p.box.y + p.box.h, draw: () => this.drawPlayer(c, t, p.box) });
    for (const d of this.play.drawables(c, t)) if (vis(this.cam.x + 40, d.y)) ds.push(d);
    ds.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
    this.drawTallGrassOver(c, t);

    this.smoke.draw(c);
    this.drawTrain(c, t);
    this.drawFountainSparkle(c, t);
    if (this.sky.night < 0.5) this.drawButterflies(c, t);
    this.fx.draw(c);
    this.clouds.draw(c, 0.13 * (1 - this.sky.night));
    this.birds.draw(c, t);

    // Evening and night: tint the world, then light it back up.
    applySky(c, this.sky, this.cam.x - 1, this.cam.y - 1, VIEW_W + 2, VIEW_H + 2);
    this.drawLights(c, t);
    this.drawLamp(c, t);
    this.drawCurios(c, t, this.sky.night);
    this.flies.draw(c, t, this.sky.night, { x: this.cam.x, y: this.cam.y, w: VIEW_W, h: VIEW_H });
    this.sparks.draw(c);
    this.play.drawOver(c, t);

    for (const n of this.npcs) {
      if (!this.hasTicket(n)) continue;
      if (!n.home) this.bubble(c, n.box.x + 6, n.box.y - 22 - this.hop(t, n.x), '!', '#d04040');
      else {
        // People who work indoors show their "!" just beside their door.
        // Low enough to clear the shop sign; hidden while the player stands at that door.
        const b = BUILDINGS.find((x) => x.id === n.home);
        if (b && b !== this.atDoor) this.bubble(c, b.x * TILE + (b.w * TILE) / 2 + 7, (b.y + b.h) * TILE - 19 - this.hop(t, n.x), '!', '#d04040');
      }
    }
    const pb = this.player.box;
    const busy = this.game.ui.busy;
    if (this.nearby && !busy) this.bubble(c, this.nearby.box.x + 6, this.nearby.box.y - (this.hasTicket(this.nearby) ? 36 : 22), 'E', '#2b6cb0', 'TALK');
    // At a door, the "E" floats over the player.
    else if (this.atDoor && !busy) this.bubble(c, pb.x, pb.y - 30, 'E', '#2b6cb0', 'ENTER');
    else if (this.prompt && !busy) this.bubble(c, this.prompt.x, this.prompt.y, 'E', '#2b6cb0', this.prompt.label);
    c.restore();
    this.play.drawScreen(c, t);
  }

  /**
   * A tap or click on the town at world point (x, y). Tapping yourself does whatever "E" would;
   * tapping a person, a door or a pastime walks you there and does it; anywhere else, you walk there.
   * Returns true when the tap should count as pressing E right now.
   */
  private onTap(x: number, y: number): boolean {
    const p = this.player.box;
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    const onMe = Math.hypot(x - px, y - (py - 8)) < 14;
    const f = this.play.bobber;
    // While fishing, tapping near you or the bobber reels; tapping further away walks off.
    if (f) {
      if (onMe || Math.hypot(x - f.x, y - f.y) < 40) return true;
      this.walkTo = { x, y, act: false };
      return false;
    }
    if (this.play.holdsPlayer) return false;
    if (onMe && (this.nearby || this.atDoor || this.prompt)) return true;
    // A person: walk up to them and talk.
    for (const n of this.npcs) {
      if (n.home) continue;
      const cx = n.box.x + n.box.w / 2;
      if (Math.abs(x - cx) < 10 && y > n.box.y - 22 && y < n.box.y + n.box.h + 2) {
        if (this.nearby === n) return true;
        this.walkTo = { x: cx, y: n.box.y + n.box.h + 6, act: true };
        return false;
      }
    }
    // A door with a room behind it: walk onto the doorstep and go in.
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    for (const b of BUILDINGS) {
      if (!ROOMS[b.id]) continue;
      const d = doorOf(b);
      const onBuilding = tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h;
      if ((tx === d.x && ty === d.y) || (onBuilding && Math.abs(tx - d.x) <= 1 && ty >= b.y + b.h - 2) || (onBuilding && !this.play.running)) {
        if (this.play.running) break;
        if (this.atDoor === b) return true;
        this.walkTo = { x: (d.x + 0.5) * TILE, y: (d.y + 0.5) * TILE, act: true };
        return false;
      }
    }
    if (this.play.interactiveAt(x, y)) {
      const s = this.play.standFor(x, y);
      if (this.prompt && Math.hypot(s.x - px, s.y - py) < 22) return true;
      this.walkTo = { x: s.x, y: s.y, act: true, thing: true };
      return false;
    }
    this.walkTo = { x, y, act: false };
    return false;
  }

  /** A little ring where you tapped, so you can see where you're headed. */
  private drawWalkMarker(c: Ctx, t: number): void {
    const w = this.walkTo;
    if (!w) return;
    const r = this.reduced ? 3 : 3 + Math.sin(t * 8) * 0.8;
    c.globalAlpha = 0.7;
    ellipse(c, w.x, w.y + 2, r + 1, (r + 1) * 0.5, '#2a1e1a');
    ellipse(c, w.x, w.y + 2, r, r * 0.5, '#fff8d0');
    ellipse(c, w.x, w.y + 2, r - 1.2, (r - 1.2) * 0.5, 'rgba(0,0,0,0)');
    c.globalAlpha = 1;
  }

  /** Walking through the meadow's long grass, the blades close over your feet. */
  private drawTallGrassOver(c: Ctx, t: number): void {
    const b = this.player.box;
    const cx = b.x + b.w / 2;
    if (tileAt(Math.floor(cx / TILE), Math.floor((b.y + b.h) / TILE)) !== 'G') return;
    const sway = this.reduced ? 0 : Math.round(Math.sin(t * 3) * 0.6);
    for (let i = -3; i <= 3; i++) {
      const x = Math.round(cx + i * 2 + (i % 2));
      const hgt = 3 + ((i * 7 + 9) % 3);
      rect(c, x + sway, b.y + b.h - hgt + 1, 1, hgt, i % 2 ? '#3f8a36' : '#4f9a3c');
    }
  }

  /** The journal: what you've caught, your best Letter Run, curios found. */
  private openJournal(): void {
    this.play.cancelRun();
    this.game.ui.openJournal(this.game.progress);
  }

  private drawPlayer(c: Ctx, t: number, box: Box): void {
    const p = this.player;
    const frame = p.moving ? WALK[Math.floor(p.walk * 9) % 4] : (t + 1.7) % 3.6 < 0.13 ? 3 : 0;
    const lift = frame === 1 || frame === 2 ? 1 : 0;
    this.playerSheet.draw(c, p.dir, frame, box.x - 3, box.y - 10 - lift);
  }

  private renderInside(c: Ctx, t: number, room: Interior): void {
    const r = room.resident as Npc | undefined;
    room.render(c, t, {
      drawPlayer: (box) => this.drawPlayer(c, t, box),
      bubble: (x, y, ch, col) => this.bubble(c, x, y, ch, col),
      ticket: !!r && this.hasTicket(r),
      busy: this.game.ui.busy,
    });
  }

  /** A bouncy hop: quick rise, a beat in the air, a landing. */
  private hop(t: number, seed: number): number {
    const ph = (t * 1.4 + seed * 0.37) % 1;
    return ph < 0.4 ? Math.sin((ph / 0.4) * Math.PI) * 4 : 0;
  }

  /** Lit windows, door light and lamp-post pools after dark. */
  private drawLights(c: Ctx, t: number): void {
    const n = this.sky.night;
    if (n < 0.05) return;
    const flicker = (seed: number) => 0.92 + Math.sin(t * 7 + seed) * 0.04 + Math.sin(t * 13 + seed * 2) * 0.04;
    for (const b of BUILDINGS) {
      const x = b.x * TILE;
      const y = b.y * TILE;
      const w = b.w * TILE;
      const h = b.h * TILE;
      if (x > this.cam.x + VIEW_W + 40 || x + w < this.cam.x - 40 || y > this.cam.y + VIEW_H + 40 || y + h < this.cam.y - 40) continue;
      if (b.kind === 'house') {
        for (const wx of [x + 5, x + w - 16]) {
          const wy = y + h - 15;
          c.globalAlpha = Math.min(1, n * 1.2);
          rect(c, wx + 1, wy + 1, 9, 7, '#ffd877');
          rect(c, wx + 1, wy + 1, 9, 2, '#fff0b0');
          rect(c, wx + 5.25, wy + 1, 0.5, 7, '#c89a48');
          c.globalAlpha = 1;
          glow(c, wx + 5.5, wy + 8, 16, '255,200,110', 0.32 * n * flicker(wx));
        }
      }
      if (b.kind === 'tower') {
        // Lookout windows and the door lantern light up at night.
        c.globalAlpha = Math.min(1, n * 1.2);
        for (const wx of [x + w / 2 - 10, x + w / 2 + 3]) rect(c, wx, y + 11, 7, 5, '#ffd877');
        c.globalAlpha = 1;
        glow(c, x + w / 2, y + 14, 22, '255,200,110', 0.3 * n * flicker(x));
        glow(c, x + w / 2 + 9.5, y + h - 13, 10, '255,200,110', 0.35 * n * flicker(y));
      }
      if (b.kind === 'station') glow(c, x + w / 2, y + h - 10, 16, '255,200,110', 0.3 * n * flicker(y));
      glow(c, x + w / 2, y + h + 2, 14, '255,190,100', 0.22 * n * flicker(x));
    }
    for (const [lx, ly] of LAMPS) {
      const hx = lx * TILE + 7.5;
      const hy = ly * TILE - 4;
      rect(c, hx - 2.5, hy - 2, 5, 4, '#fff2b0');
      glow(c, hx, hy + 1, 26, '255,214,128', 0.42 * n * flicker(lx * 3));
      glow(c, hx, hy + 18, 18, '255,214,128', 0.16 * n);
    }
    // a soft circle of light around the player so you never lose them in the dark
    const p = this.player.box;
    glow(c, p.x + p.w / 2, p.y - 2, 30, '255,236,200', 0.14 * n);
  }

  private bubble(c: Ctx, x: number, y: number, ch: string, col: string, label?: string): void {
    if (label) {
      // A small tag beside the key says what it will do.
      const w = label.length * 4 + 5;
      rect(c, x + 9, y + 2, w + 2, 9, '#2a1e1a');
      rect(c, x + 10, y + 3, w, 7, '#2b6cb0');
      pixelText(c, label, x + 13, y + 9, '#ffffff', 4);
    }
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
    const wet = (x: number, y: number) => tileAt(x, y) === 'w';
    for (const [tx, ty] of this.water) {
      const x = tx * TILE;
      const y = ty * TILE;
      if (x > this.cam.x + VIEW_W || x + TILE < this.cam.x || y > this.cam.y + VIEW_H || y + TILE < this.cam.y) continue;
      const pond = isPondTile(tx, ty);
      const deep = wet(tx - 1, ty) && wet(tx + 1, ty) && wet(tx, ty - 1) && wet(tx, ty + 1);
      rect(c, x, y, TILE, TILE, pond ? (deep ? '#2f78ba' : '#3a86c8') : deep ? '#3584c6' : '#3d8fd1');
      const o = Math.floor((t * 4 + tx * 3 + ty * 5) % 16);
      rect(c, x + ((o + 2) % 12), y + 4, 4, 1, '#7fc2f0');
      rect(c, x + ((o + 9) % 12), y + 11, 3, 1, '#7fc2f0');
      if ((tx + ty + Math.floor(t * 2)) % 7 === 0) rect(c, x + 7, y + 7, 2, 1, '#c8e8fa');
      // Shorelines on every side that meets land: sand on top, a shaded bank below, lips at the sides.
      const shore = (nx: number, ny: number) => !wet(nx, ny) && tileAt(nx, ny) !== 'd';
      const foam = Math.floor(t * 2 + tx) % 2;
      if (shore(tx, ty - 1)) {
        rect(c, x, y, TILE, 3, '#e6d7a8');
        rect(c, x, y + 3, TILE, 1, foam ? '#a8d8f8' : '#d8f0ff');
      }
      if (shore(tx, ty + 1)) {
        rect(c, x, y + 13, TILE, 3, '#2a6aa0');
        rect(c, x, y + 12, TILE, 1, '#5aa8e0');
      }
      if (shore(tx - 1, ty)) {
        rect(c, x, y, 2, TILE, '#e6d7a8');
        rect(c, x + 2, y, 1, TILE, foam ? '#a8d8f8' : '#d8f0ff');
      }
      if (shore(tx + 1, ty)) {
        rect(c, x + 14, y, 2, TILE, '#e6d7a8');
        rect(c, x + 13, y, 1, TILE, foam ? '#a8d8f8' : '#d8f0ff');
      }
    }
    // Lily pads drift a little on the meadow pond.
    for (const [lx, ly] of LILIES) {
      const x = lx * TILE + 8 + (this.reduced ? 0 : Math.round(Math.sin(t * 0.6 + lx) * 1));
      const y = ly * TILE + 8;
      ellipse(c, x, y, 4, 2.5, '#3f8a36');
      ellipse(c, x, y - 0.5, 3.5, 2, '#5fae4a');
      rect(c, x, y - 2, 3, 2, ly % 2 ? '#3a86c8' : '#2f78ba');
      if (lx % 2) {
        rect(c, x - 2, y - 2, 2, 2, '#ffb8d8');
        rect(c, x - 1.5, y - 2.5, 1, 1, '#ffffff');
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
    if (on) {
      disc(c, x + 3, y + 2, 7, 'rgba(255,230,128,0.18)');
      glow(c, x + 3, y + 2, 34, '255,220,120', 0.3 * this.sky.night);
    }
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
    const W = MAP_W * TILE;
    const H = MAP_H * TILE;
    const [cv, c] = makeCanvas(W, H);
    const R = rng(7);
    rect(c, 0, 0, W, H, '#5fae4a');
    // Soft lighter and darker patches so the grass doesn't read as one flat sheet.
    for (let i = 0; i < 90; i++) {
      const x = R() * W;
      const y = R() * H;
      ellipse(c, x, y, 10 + R() * 22, 5 + R() * 10, R() < 0.5 ? 'rgba(120,200,90,0.18)' : 'rgba(40,110,40,0.14)');
    }
    for (let i = 0; i < 4500; i++) rect(c, (R() * W) | 0, (R() * H) | 0, 1, 1, R() < 0.5 ? '#55a042' : '#6dbd55');
    // Pebbles.
    for (let i = 0; i < 70; i++) {
      const x = (R() * W) | 0;
      const y = (R() * H) | 0;
      rect(c, x, y, 2, 1, '#c8c0a8');
      rect(c, x, y + 1, 2, 1, '#8a8270');
    }
    for (let i = 0; i < 260; i++) {
      const x = (R() * W) | 0;
      const y = (R() * H) | 0;
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
          if (R() < 0.35) rect(c, x + ((R() * 13) | 0), y + ((R() * 13) | 0), 2, 1, '#b89c6a');
          const edge = '#b8955c';
          const up = tileAt(tx, ty - 1) !== 'p';
          const dn = tileAt(tx, ty + 1) !== 'p';
          const lf = tileAt(tx - 1, ty) !== 'p';
          const rt = tileAt(tx + 1, ty) !== 'p';
          if (up) rect(c, x, y, TILE, 1, edge);
          if (dn) rect(c, x, y + 15, TILE, 1, edge);
          if (lf) rect(c, x, y, 1, TILE, edge);
          if (rt) rect(c, x + 15, y, 1, TILE, edge);
          // Rounded outer corners, with grass tufts nibbling at the edges.
          const g = '#5fae4a';
          if (up && lf) rect(c, x, y, 2, 2, g), rect(c, x + 2, y + 1, 1, 1, edge), rect(c, x + 1, y + 2, 1, 1, edge);
          if (up && rt) rect(c, x + 14, y, 2, 2, g), rect(c, x + 13, y + 1, 1, 1, edge), rect(c, x + 14, y + 2, 1, 1, edge);
          if (dn && lf) rect(c, x, y + 14, 2, 2, g), rect(c, x + 2, y + 14, 1, 1, edge), rect(c, x + 1, y + 13, 1, 1, edge);
          if (dn && rt) rect(c, x + 14, y + 14, 2, 2, g), rect(c, x + 13, y + 14, 1, 1, edge), rect(c, x + 14, y + 13, 1, 1, edge);
          if (up && R() < 0.5) rect(c, x + 3 + ((R() * 9) | 0), y, 2, 1, '#4f9a3c');
          if (dn && R() < 0.5) rect(c, x + 3 + ((R() * 9) | 0), y + 15, 2, 1, '#4f9a3c');
        } else if (t === 'G') {
          // Long meadow grass: darker, in tufts.
          rect(c, x, y, TILE, TILE, '#559e40');
          for (let i = 0; i < 9; i++) {
            const gx = x + ((R() * 14) | 0);
            const gy = y + 3 + ((R() * 12) | 0);
            rect(c, gx, gy - 3, 1, 4, '#3f8a36');
            rect(c, gx + 1, gy - 4, 1, 5, '#4f9a3c');
            rect(c, gx + 2, gy - 2, 1, 3, '#6dbd55');
          }
          if (R() < 0.2) rect(c, x + ((R() * 13) | 0), y + ((R() * 13) | 0), 1, 1, '#fff4a0');
        } else if (t === 'o') {
          // Reeds and cattails at the water's edge.
          rect(c, x, y, TILE, TILE, '#5a9a48');
          for (let i = 0; i < 6; i++) {
            const rx = x + 1 + i * 2.5 + ((R() * 2) | 0);
            const hgt = 7 + ((R() * 6) | 0);
            rect(c, rx, y + 15 - hgt, 1, hgt, i % 2 ? '#6a8a3a' : '#7aa048');
            if (i % 2 === 0) rect(c, rx - 0.5, y + 15 - hgt - 2, 2, 3, '#7a4a2a');
          }
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
    // Soft shadows to the lower right of every building, so they sit on the ground.
    for (const b of BUILDINGS) {
      c.globalAlpha = 0.16;
      rect(c, b.x * TILE + 4, (b.y + b.h) * TILE - 4, b.w * TILE - 2, 5, '#1a2a10');
      rect(c, (b.x + b.w) * TILE - 2, b.y * TILE + 10, 4, b.h * TILE - 9, '#1a2a10');
      c.globalAlpha = 1;
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
    for (const [lx, ly] of LAMPS) lampPost(c, lx * TILE + 7, ly * TILE - 2);
    this.drawPostbox(c);
    this.drawBench(c);
    this.drawSignpost(c, 40 * TILE + 2, 13 * TILE + 2);
    container(c, 33 * TILE, 19 * TILE + 3, 20, 13, '#c0392b');
    container(c, 34 * TILE + 6, 19 * TILE + 3, 20, 13, '#2b6cb0');
    container(c, 36 * TILE - 4, 19 * TILE + 3, 18, 13, '#27ae60');
    container(c, 34 * TILE - 2, 19 * TILE - 8, 20, 12, '#e8a030');
    return cv;
  }

  /** The red postbox outside the Post office: start of the Letter Run. */
  private drawPostbox(c: Ctx): void {
    const x = POSTBOX.x * TILE + 3;
    const y = POSTBOX.y * TILE - 4;
    ellipse(c, x + 5, y + 19, 7, 2, 'rgba(0,0,0,0.2)');
    rect(c, x - 1, y - 1, 12, 21, '#2a1e1a');
    rect(c, x, y, 10, 19, '#c0392b');
    rect(c, x, y, 10, 3, '#e05a48');
    rect(c, x + 2, y + 5, 6, 1.5, '#2a1e1a');
    rect(c, x + 1, y + 16, 8, 3, '#8a2a1a');
    rect(c, x + 3, y + 9, 4, 3, '#ffd23f');
    rect(c, x + 4, y + 10, 2, 1, '#c0392b');
  }

  /** A bench looking out over the meadow pond. */
  private drawBench(c: Ctx): void {
    const x = BENCH.x * TILE;
    const y = BENCH.y * TILE + 4;
    ellipse(c, x + 8, y + 11, 9, 2, 'rgba(0,0,0,0.18)');
    rect(c, x, y, 16, 3, '#2a1e1a');
    rect(c, x + 1, y + 0.5, 14, 2, '#a07a4a');
    rect(c, x, y + 4, 16, 3, '#2a1e1a');
    rect(c, x + 1, y + 4.5, 14, 2, '#c89a5a');
    rect(c, x + 2, y + 7, 2, 4, '#5a3a1a');
    rect(c, x + 12, y + 7, 2, 4, '#5a3a1a');
  }

  /** A wooden signpost at the edge of town pointing the way to the meadow. */
  private drawSignpost(c: Ctx, x: number, y: number): void {
    rect(c, x + 5, y + 4, 2, 12, '#5a3a1a');
    rect(c, x - 3, y - 1, 20, 8, '#2a1e1a');
    rect(c, x - 2, y, 18, 6, '#c89a5a');
    rect(c, x + 17, y + 1, 2, 4, '#2a1e1a');
    pixelText(c, 'POND', x - 1, y + 5, '#5a3a1a', 4);
  }
}

const MAYOR_INTRO = [
  'Ah, our new on-call! I\'m Mayor Bo. Every shop and service in Ninefold runs on trust.',
  'Fix things well and Trust goes up. Guess wildly and it goes down. Look before you leap!',
  'And keep an eye out for little sparkles around town. Curious things turn up in Ninefold.',
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
