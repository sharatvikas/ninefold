/**
 * One building's inside: the player walks in through the door, talks to the resident across the
 * counter, and walks back out the same way. TownScene owns this and hands it the input each frame.
 */
import { Particles } from '../art/atmosphere';
import type { CharacterSheet, Dir } from '../art/characters';
import { drawCounter, drawProp, roomShell } from '../art/interiors';
import { blit, rect, type Ctx } from '../art/pixels';
import { moveBox, type Box } from './collision';
import { leftRoom, NPC_SPOT, ROOM_H, ROOM_W, ROOM_Y, roomSolid, SPAWN, TALK_RANGE, type Room } from './rooms';
import { TILE } from './townMap';

/** The person who works here, as TownScene keeps them. */
export interface Resident {
  name: string;
  sheet: CharacterSheet;
  dir: Dir;
  blinkPhase: number;
  lookTimer: number;
}

const shells = new Map<string, HTMLCanvasElement>();

export class Interior {
  /** The player's feet, in room pixels. */
  box: Box = { x: SPAWN.x - 5, y: SPAWN.y - 3, w: 10, h: 6 };
  readonly fx = new Particles();

  constructor(
    readonly room: Room,
    readonly resident: Resident | undefined,
  ) {}

  solidAt = (px: number, py: number): boolean => roomSolid(this.room, Math.floor(px / TILE), Math.floor(py / TILE));

  move(dx: number, dy: number): void {
    this.box = moveBox(this.box, dx, dy, this.solidAt);
  }

  /** Close enough to the counter to talk to whoever is behind it. */
  canTalk(): boolean {
    if (!this.resident) return false;
    const b = this.box;
    return Math.hypot(b.x + b.w / 2 - NPC_SPOT.x, b.y + b.h / 2 - NPC_SPOT.y) < TALK_RANGE;
  }

  /** The player has walked back out through the door. */
  get left(): boolean {
    return leftRoom(this.box.y + this.box.h);
  }

  /** Where the player is on screen, as fractions, for the iris wipe. */
  focus(): { x: number; y: number } {
    const b = this.box;
    return { x: (b.x + b.w / 2) / (ROOM_W * TILE), y: (b.y - 4 + ROOM_Y) / (ROOM_H * TILE + 2 * ROOM_Y) };
  }

  celebrate(): void {
    const b = this.box;
    this.fx.confetti(b.x + b.w / 2, b.y - 12);
    this.fx.confetti(NPC_SPOT.x, NPC_SPOT.y - 20);
  }

  update(dt: number, busy: boolean): void {
    this.fx.step(dt);
    const r = this.resident;
    if (!r || busy) return;
    r.lookTimer -= dt;
    if (r.lookTimer <= 0) {
      r.lookTimer = 2 + Math.random() * 5;
      r.dir = (['down', 'down', 'down', 'left', 'right'] as Dir[])[Math.floor(Math.random() * 5)];
    }
  }

  /**
   * Draw the room. `drawPlayer` draws the player with their feet box at the given room position;
   * `bubble` draws a speech bubble ('!' or 'E') at a room position.
   */
  render(
    c: Ctx,
    t: number,
    o: { drawPlayer: (box: Box) => void; bubble: (x: number, y: number, ch: string, col: string) => void; ticket: boolean; busy: boolean },
  ): void {
    rect(c, 0, 0, ROOM_W * TILE, ROOM_H * TILE + 2 * ROOM_Y, '#140d0b');
    c.save();
    c.translate(0, ROOM_Y);
    let shell = shells.get(this.room.id);
    if (!shell) shells.set(this.room.id, (shell = roomShell(this.room)));
    blit(c, shell, 0, 0, ROOM_W * TILE, ROOM_H * TILE);

    // Back to front: props and the player sorted by where their feet are.
    type D = { y: number; draw: () => void };
    const ds: D[] = this.room.props.map((pr) => ({ y: (pr.y + pr.h) * TILE, draw: () => drawProp(c, pr) }));
    const r = this.resident;
    if (r) {
      const f = (t + r.blinkPhase) % 3.6 < 0.13 ? 3 : 0;
      const bob = Math.sin(t * 2 + r.blinkPhase) > 0.6 ? 1 : 0;
      // The counter is drawn right after the resident, so it hides their legs.
      ds.push({
        y: NPC_SPOT.y,
        draw: () => {
          r.sheet.draw(c, r.dir, f, NPC_SPOT.x - 8, NPC_SPOT.y - 16 - bob);
          drawCounter(c, this.room);
        },
      });
    } else ds.push({ y: NPC_SPOT.y, draw: () => drawCounter(c, this.room) });
    ds.push({ y: this.box.y + this.box.h, draw: () => o.drawPlayer(this.box) });
    ds.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    this.fx.draw(c);
    if (r && o.ticket) o.bubble(NPC_SPOT.x - 5, NPC_SPOT.y - 36 - hop(t), '!', '#d04040');
    if (this.canTalk() && !o.busy) o.bubble(NPC_SPOT.x - 5, NPC_SPOT.y - (o.ticket ? 50 : 36), 'E', '#2b6cb0');
    c.restore();
  }
}

function hop(t: number): number {
  const ph = (t * 1.4) % 1;
  return ph < 0.4 ? Math.sin((ph / 0.4) * Math.PI) * 4 : 0;
}
