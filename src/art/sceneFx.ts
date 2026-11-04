import { Birds, Fireflies, glow, gust, Particles, prefersReducedMotion } from './atmosphere';
import { Layer, makeCanvas, rect, rng, type Ctx } from './pixels';
import type { Status } from './backdrops';

const W = 384;
/** The part of a ticket scene the player sees above the tool tray. */
const VIS_H = 136;
/** Centre of the status board: where the "fixed" shockwave starts. */
const BOARD = { x: 298, y: 56 };

/** A light shaft falling from a window to the floor (polygon corners, top two then bottom two). */
type Beam = [number, number, number, number, number, number, number, number];

interface DistrictFx {
  /** Particles to emit this frame (smoke, steam, dust, chaff…). */
  emit?: (fx: SceneFx, t: number, dt: number, s: Status) => void;
  /** Extra drawing behind the board and character (light shafts, glints, stars…). */
  under?: (c: Ctx, t: number, s: Status, fx: SceneFx) => void;
  /** Light drawn on top of everything (glows). */
  over?: (c: Ctx, t: number, s: Status, fx: SceneFx) => void;
  beams?: Beam[];
}

/**
 * Atmosphere and feedback for ticket scenes: mood lighting that follows the ticket's state,
 * a flash and shockwave when a fix lands, a shake when a check fails, and ambient life per district.
 */
export class SceneFx {
  readonly parts = new Particles();
  readonly sparks = new Particles();
  readonly birds = new Birds();
  readonly reduced = prefersReducedMotion();
  private flies: Fireflies | undefined;
  private last: Status = 'broken';
  private lastT = -1;
  /** 0 = broken mood, 1 = fixed mood: eased so lighting changes feel like a sunrise, not a switch. */
  private warmth = 0;
  private flash = 0;
  private flashCol = '255,255,255';
  private ring = -1;
  private shake = 0;
  private scanFrom = -1;
  private shooting: { x: number; y: number; life: number } | undefined;
  private nextShoot = 4;
  private edges = new Layer(() => edgeShade());
  private def: DistrictFx;

  constructor(private district: string) {
    this.def = DISTRICT_FX[district] ?? {};
    if (district === 'watch') {
      const R = rng(12);
      const spots: [number, number][] = [];
      for (let i = 0; i < 14; i++) spots.push([R() * W, 96 + R() * 30]);
      this.flies = new Fireflies(spots);
    }
  }

  /** Advance time and react to status changes. Returns the shake offset to apply to the whole scene. */
  step(t: number, s: Status): { dx: number; dy: number } {
    const dt = this.lastT < 0 ? 0 : Math.min(0.05, t - this.lastT);
    this.lastT = t;
    if (s !== this.last) {
      if (s === 'fixed') {
        this.flash = 0.55;
        this.flashCol = '255,250,220';
        this.ring = 0;
        if (!this.reduced) {
          this.parts.confetti(204, 108);
          for (let i = 0; i < 3; i++) this.sparks.firework(80 + i * 110 + Math.random() * 30, 26 + Math.random() * 20, ['#ffd23f', '#5ee08a', '#5ab4ff'][i]);
        }
      } else if (s === 'verifying') this.scanFrom = t;
      else if (s === 'broken' && this.last === 'verifying') {
        // A check failed: a jolt and a red flash, so it registers.
        this.flash = 0.3;
        this.flashCol = '255,70,50';
        if (!this.reduced) this.shake = 0.35;
      }
      this.last = s;
    }
    const target = s === 'fixed' ? 1 : 0;
    this.warmth += (target - this.warmth) * (1 - Math.exp(-dt * 1.6));
    this.flash = Math.max(0, this.flash - dt * 1.8);
    if (this.ring >= 0) this.ring = this.ring > 1 ? -1 : this.ring + dt * 1.4;
    this.shake = Math.max(0, this.shake - dt);
    if (!this.reduced) this.def.emit?.(this, t, dt, s);
    this.parts.step(dt, gust(t) * 0.6);
    this.sparks.step(dt);
    this.birds.step(dt, { x: 0, y: 0, w: W, h: 30 }, this.district === 'watch' ? 1 : 0);
    if (this.district === 'watch' && !this.reduced) {
      this.nextShoot -= dt;
      if (this.nextShoot <= 0) {
        this.nextShoot = 6 + Math.random() * 8;
        this.shooting = { x: 40 + Math.random() * 200, y: 6 + Math.random() * 20, life: 0.7 };
      }
      if (this.shooting) {
        this.shooting.life -= dt;
        this.shooting.x += 170 * dt;
        this.shooting.y += 60 * dt;
        if (this.shooting.life <= 0) this.shooting = undefined;
      }
    }
    if (this.shake <= 0) return { dx: 0, dy: 0 };
    const k = this.shake / 0.35;
    return { dx: Math.round(Math.sin(t * 90) * 2 * k), dy: Math.round(Math.cos(t * 70) * k) };
  }

  /** Behind the board and character: light shafts, glints, the scan sweep. */
  drawUnder(c: Ctx, t: number, s: Status): void {
    for (const b of this.def.beams ?? []) beam(c, b, t, 0.1 + this.warmth * 0.08);
    this.def.under?.(c, t, s, this);
    if (this.shooting) {
      const sh = this.shooting;
      for (let i = 0; i < 10; i++) {
        c.globalAlpha = (1 - i / 10) * Math.min(1, sh.life * 3);
        rect(c, sh.x - i * 2.8, sh.y - i * 1, 1.5, 1, '#ffffff');
      }
      c.globalAlpha = 1;
    }
    this.flies?.draw(c, t, 1, { x: 0, y: 0, w: W, h: VIS_H });
    this.birds.draw(c, t);
    this.parts.draw(c);
    if (s === 'verifying' && this.scanFrom >= 0) {
      // A band of light sweeping across: "checking everything…"
      const k = ((t - this.scanFrom) % 1.4) / 1.4;
      const x = -40 + k * (W + 80);
      c.save();
      c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(x - 30, 0, x + 30, 0);
      g.addColorStop(0, 'rgba(255,230,140,0)');
      g.addColorStop(0.5, 'rgba(255,230,140,0.16)');
      g.addColorStop(1, 'rgba(255,230,140,0)');
      c.fillStyle = g;
      c.fillRect(x - 30, 0, 60, VIS_H);
      c.restore();
    }
  }

  /** On top of everything: mood, glows, flash, shockwave, fireworks. */
  drawOver(c: Ctx, t: number, s: Status): void {
    this.def.over?.(c, t, s, this);
    // board lamp glow
    const lampCol = s === 'fixed' ? '88,208,128' : s === 'verifying' ? '248,208,48' : '224,90,72';
    const pulse = s === 'broken' ? 0.5 + Math.sin(t * 5) * 0.3 : s === 'verifying' ? 0.6 : 0.45;
    glow(c, 229, 47, 16, lampCol, 0.5 * pulse);

    // mood: cold, darker edges while broken; warm light once fixed
    c.save();
    c.globalAlpha = 0.55 - this.warmth * 0.35;
    c.drawImage(this.edges.get(), 0, 0, W, 216);
    c.restore();
    if (this.warmth > 0.02) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = this.warmth;
      for (let i = 0; i < 4; i++) {
        const sway = Math.sin(t * 0.4 + i * 1.7) * 10;
        const x0 = 20 + i * 70 + sway;
        const g = c.createLinearGradient(x0, 0, x0 + 60, VIS_H);
        g.addColorStop(0, 'rgba(255,230,160,0.13)');
        g.addColorStop(1, 'rgba(255,230,160,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x0, 0);
        c.lineTo(x0 + 18, 0);
        c.lineTo(x0 + 78, VIS_H);
        c.lineTo(x0 + 44, VIS_H);
        c.fill();
      }
      c.restore();
    }

    this.sparks.draw(c);
    if (this.ring >= 0) {
      const r = this.ring * 260;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(200,255,210,${0.6 * (1 - this.ring)})`;
      c.lineWidth = 3 * (1 - this.ring) + 0.5;
      c.beginPath();
      c.arc(BOARD.x, BOARD.y, r, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    if (this.flash > 0.01) {
      c.fillStyle = `rgba(${this.flashCol},${this.flash})`;
      c.fillRect(0, 0, W, 216);
    }
  }
}

/** Dark, soft corners: a cinematic frame that also pulls the eye to the middle. */
function edgeShade(): HTMLCanvasElement {
  const [cv, c] = makeCanvas(W, 216);
  const g = c.createRadialGradient(W / 2, 70, 60, W / 2, 70, 240);
  g.addColorStop(0, 'rgba(10,14,40,0)');
  g.addColorStop(1, 'rgba(10,14,40,0.6)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, 216);
  return cv;
}

function beam(c: Ctx, b: Beam, t: number, a: number): void {
  const [x1, y1, x2, y2, x3, y3, x4, y4] = b;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(x1, y1, x4, y4);
  const breathe = a * (0.85 + Math.sin(t * 0.7) * 0.15);
  g.addColorStop(0, `rgba(255,240,190,${breathe})`);
  g.addColorStop(1, 'rgba(255,240,190,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.lineTo(x3, y3);
  c.lineTo(x4, y4);
  c.fill();
  c.restore();
}

/** Tiny bright specks floating lazily inside a light shaft. */
function motes(fx: SceneFx, dt: number, x: number, y: number, w: number, h: number): void {
  if (Math.random() < dt * 3)
    fx.parts.add({ x: x + Math.random() * w, y: y + Math.random() * h, vx: 2 + Math.random() * 3, vy: -1 + Math.random() * 2, life: 3 + Math.random() * 2, max: 5, size: 0.5, col: 'rgba(255,248,220,0.9)', flutter: 3, phase: Math.random() * 6 });
}

function smoke(fx: SceneFx, x: number, y: number, col = 'rgba(220,220,225,0.55)'): void {
  fx.parts.add({ x: x + (Math.random() - 0.5) * 2, y, vx: 4 + Math.random() * 4, vy: -9 - Math.random() * 4, life: 2.2, max: 2.2, size: 1, grow: 4, col });
}

/** x of the rail scene's train, matching ANIMATE.rail in backdrops.ts. */
export function trainX(t: number, s: Status): number {
  return s === 'fixed' ? ((t * 60) % (W + 180)) - 180 : 40;
}

const STARS = (() => {
  const R = rng(33);
  return Array.from({ length: 24 }, () => ({ x: R() * W, y: R() * 70, ph: R() * 6, sp: 1 + R() * 2 }));
})();

const DISTRICT_FX: Record<string, DistrictFx> = {
  post: {
    emit(fx, _t, dt) {
      if (Math.random() < dt * 2.5) smoke(fx, 71.5, 41);
      if (Math.random() < dt * 2) smoke(fx, 149.5, 47);
    },
    under(c, t) {
      // two small clouds drifting along the sky band
      for (const [k, y, w] of [[0, 6, 26], [0.55, 12, 18]] as const) {
        const x = ((t * 4 + k * W) % (W + 60)) - 40;
        rect(c, x, y, w, 4, 'rgba(255,255,255,0.85)');
        rect(c, x + 4, y - 2, w - 10, 3, 'rgba(255,255,255,0.85)');
      }
    },
  },
  rail: {
    emit(fx, t, dt, s) {
      const x = trainX(t, s) + 3 * 36 + 6;
      if (Math.random() < dt * (s === 'fixed' ? 10 : 3)) {
        fx.parts.add({ x, y: 72, vx: s === 'fixed' ? -30 : 2 + Math.random() * 3, vy: -14 - Math.random() * 6, life: 1.6, max: 1.6, size: 1.5, grow: 5, col: 'rgba(244,244,244,0.7)' });
      }
      if (s === 'fixed' && Math.random() < dt * 14) {
        // sparks from the wheels as the train pulls away
        const wx = x - 6 - Math.random() * 120;
        fx.sparks.add({ x: wx, y: 99, vx: -20 - Math.random() * 30, vy: -10 - Math.random() * 14, life: 0.35, max: 0.35, size: 0, col: '#ffb040', grav: 80, bright: true });
      }
      if (s === 'broken' && Math.random() < dt * 3) {
        // dust and smoke around the derailed car
        fx.parts.add({ x: 40 + 36 + 16 + (Math.random() - 0.5) * 20, y: 96, vx: (Math.random() - 0.5) * 6, vy: -6, life: 1.4, max: 1.4, size: 1, grow: 3, col: 'rgba(160,150,140,0.45)' });
      }
    },
    over(c, _t, s) {
      const col = s === 'fixed' ? '88,208,128' : s === 'verifying' ? '248,208,48' : '224,90,72';
      glow(c, 363, s === 'fixed' ? 62 : 55, 12, col, 0.5);
    },
  },
  arch: {
    beams: [[20, 54, 66, 54, 130, 92, 84, 92]],
    emit(fx, _t, dt) {
      motes(fx, dt, 40, 56, 70, 34);
    },
    over(c, t) {
      glow(c, 200, 30, 22, '255,236,170', 0.3 + Math.sin(t * 9) * 0.02);
    },
  },
  harbor: {
    under(c, t, s, fx) {
      // glints on the water
      for (let i = 0; i < 14; i++) {
        const ph = (t * 1.3 + i * 0.77) % 3;
        if (ph > 0.5) continue;
        const x = (i * 97 + 31) % W;
        const y = 78 + ((i * 29) % 38);
        c.globalAlpha = Math.sin((ph / 0.5) * Math.PI);
        rect(c, x - 1, y, 3, 0.5, '#ffffff');
        rect(c, x, y - 0.5, 1, 1.5, '#ffffff');
        c.globalAlpha = 1;
      }
      // sunlight path on the water under the sun
      for (let y = 76; y < 118; y += 3) {
        const w = 4 + ((y * 7) % 9) + Math.sin(t * 2 + y) * 2;
        c.globalAlpha = 0.35;
        rect(c, 330 - w / 2 + Math.sin(t * 1.5 + y * 0.3) * 3, y, w, 1, '#fff4c0');
        c.globalAlpha = 1;
      }
      void s;
      void fx;
    },
    over(c, t) {
      glow(c, 330, 30, 40, '255,236,160', 0.25 + Math.sin(t * 0.8) * 0.03);
    },
  },
  watch: {
    under(c, t) {
      for (const st of STARS) {
        const tw = Math.sin(t * st.sp + st.ph);
        if (tw < 0.3) continue;
        c.globalAlpha = tw;
        rect(c, st.x, st.y, 1, 1, '#ffffff');
        if (tw > 0.85) {
          rect(c, st.x - 1, st.y, 3, 0.5, '#ffffff');
          rect(c, st.x, st.y - 1, 0.5, 3, '#ffffff');
        }
        c.globalAlpha = 1;
      }
    },
    over(c, t, s) {
      glow(c, 135, 37, 26, s === 'broken' ? '255,128,96' : '255,230,128', s === 'fixed' || Math.floor(t * 2) % 2 === 0 ? 0.5 : 0.15);
      glow(c, 330, 26, 30, '220,230,255', 0.18);
    },
  },
  lock: {
    emit(fx, _t, dt) {
      motes(fx, dt, 220, 20, 80, 60);
    },
    under(c) {
      // a hanging lamp over the workbench
      rect(c, 258.75, 0, 0.5, 12, '#2a1e1a');
      rect(c, 254, 12, 10, 4, '#3a3a4a');
      rect(c, 256, 16, 6, 2, '#fff2b0');
    },
    over(c, t, s) {
      const flick = 0.42 + Math.sin(t * 11) * 0.03 + Math.sin(t * 23) * 0.03;
      glow(c, 259, 18, 40, '255,214,140', flick);
      glow(c, 160, 62, 34, s === 'fixed' ? '88,208,128' : '224,90,72', s === 'fixed' ? 0.35 : 0.12 + Math.sin(t * 3) * 0.06);
    },
  },
  granary: {
    emit(fx, t, dt) {
      if (Math.random() < dt * 5)
        fx.parts.add({ x: 64 + Math.random() * 32, y: 86 + Math.random() * 30, vx: 6 + Math.random() * 10, vy: -3 - Math.random() * 3, life: 3, max: 3, size: 1, col: Math.random() < 0.5 ? '#f0d890' : '#d8b860', flutter: 8, phase: Math.random() * 6 });
      void t;
    },
    under(c, t) {
      for (const [k, y, w] of [[0.2, 8, 30], [0.7, 16, 20]] as const) {
        const x = ((t * 5 + k * W) % (W + 60)) - 40;
        rect(c, x, y, w, 4, 'rgba(255,255,255,0.9)');
        rect(c, x + 5, y - 2, w - 12, 3, 'rgba(255,255,255,0.9)');
      }
    },
  },
  hall: {
    beams: [
      [24, 56, 64, 56, 110, 92, 66, 92],
      [150, 56, 190, 56, 236, 92, 192, 92],
    ],
    emit(fx, _t, dt) {
      motes(fx, dt, 40, 58, 50, 32);
      motes(fx, dt, 166, 58, 50, 32);
    },
  },
  big: {
    emit(fx, t, dt, s) {
      // rain streaking past the night windows
      if (s !== 'fixed')
        for (const wx of [24, 150])
          if (Math.random() < dt * 30) fx.parts.add({ x: wx + Math.random() * 40, y: 16, vx: -6, vy: 90, life: 0.4, max: 0.4, size: 0.5, col: 'rgba(170,200,255,0.8)' });
      void t;
    },
    over(c, t, s) {
      if (s === 'fixed') return;
      // a rotating siren light instead of a flat red flash
      const a = t * 4;
      const x = W / 2 + Math.cos(a) * 160;
      glow(c, x, 40 + Math.sin(a) * 20, 120, '255,50,40', 0.18);
      glow(c, 192, 0, 18, '255,60,50', 0.6);
      rect(c, 188, 0, 8, 4, Math.floor(t * 4) % 2 ? '#ff4030' : '#a02018');
    },
  },
};

