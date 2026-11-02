import { CharacterSheet, LOOKS } from '../../art/characters';
import { disc, rect, type Ctx } from '../../art/pixels';
import { boat, container, Smoke } from '../../art/scenery';
import { getLevel } from '../catalog';
import type { InvestigateLevel, Stage } from '../types';

const W = 384;
const WATERLINE = 122;
const PERIOD = 6.5;
const HOLD = 7; // crates the hold can take before the ship sinks
const SC = 3;

class HarborStage implements Stage<{ resolved: boolean }> {
  private smoke = new Smoke('100,100,100');
  private finn = new CharacterSheet(LOOKS.finn);
  private start = -1;
  private wasResolved = false;
  restarts = 3;

  alertDetail(): string {
    return `RESTART #${this.restarts}`;
  }

  update(dt: number, t: number, s: { resolved: boolean }): void {
    if (this.start < 0) this.start = t;
    if (s.resolved && !this.wasResolved) {
      this.wasResolved = true;
      this.start = t;
    }
    if (!s.resolved) {
      this.restarts = 3 + Math.floor((t - this.start) / PERIOD);
      this.smoke.spawn(290 + Math.random() * 30, 112, 0.35);
    }
    this.smoke.step(dt);
  }

  render(c: Ctx, t: number, s: { resolved: boolean }): void {
    ['#ffd9a0', '#ffe2b0', '#ffeac4', '#fff0d6', '#fdf4e2'].forEach((col, i) => rect(c, 0, i * 15, W, 15, col));
    disc(c, 300, 38, 15, '#fff4c0');
    disc(c, 300, 38, 12, '#ffe680');
    for (let x = 0; x < W; x++) {
      const hh = 8 + Math.sin(x / 30) * 5 + Math.sin(x / 11) * 2;
      rect(c, x, 74 - hh, 1, hh, '#9cc48a');
    }
    rect(c, 0, 74, W, 66, '#3d8fd1');
    for (let i = 0; i < 46; i++) {
      const oy = (i * 11) % 62;
      const sx = ((i * 53 + t * (8 + oy / 6)) % (W + 20)) - 10;
      rect(c, sx, 76 + oy, 6, 1, '#7fc2f0');
      if (i % 4 === 0) rect(c, sx + 2, 75 + oy, 2, 1, '#c8e8fa');
    }
    for (let i = 0; i < 3; i++) {
      const x = ((40 + i * 120 + t * 12) % (W + 20)) - 10;
      const y = 22 + i * 7 + Math.sin(t * 2 + i) * 3;
      const f = Math.floor(t * 4 + i) % 2;
      rect(c, x, y, 2, 1, '#3a3a3a');
      rect(c, x + 3, y, 2, 1, '#3a3a3a');
      rect(c, x + 2, y + (f ? 1 : -1), 1, 1, '#3a3a3a');
    }
    this.drawShip(c, t, s.resolved);
    // dock
    rect(c, 0, 136, W, 80, '#8a6a42');
    for (let y = 136; y < 216; y += 6) rect(c, 0, y, W, 1, '#6b4a2a');
    for (let x = 0; x < W; x += 40) rect(c, x + ((x / 40) % 2) * 20, 136, 1, 80, '#6b4a2a');
    rect(c, 0, 134, W, 3, '#5a3a1a');
    container(c, 8, 116, 30, 18, '#c0392b');
    container(c, 8, 98, 30, 18, '#2b6cb0');
    container(c, 8, 80, 30, 18, '#27ae60');
    container(c, 40, 116, 30, 18, '#e8a030');
    // crane
    rect(c, 330, 40, 7, 96, '#e8a030');
    for (let y = 44; y < 136; y += 8) rect(c, 330, y, 7, 1, '#b07818');
    rect(c, 250, 40, 87, 5, '#e8a030');
    const sw = Math.sin(t) * 4;
    rect(c, 262, 45, 1, 26 + sw, '#2a1e1a');
    rect(c, 258, 71 + sw, 9, 6, '#2b6cb0');
    this.smoke.draw(c);
    const bob = Math.floor(t * 2) % 2;
    this.finn.draw(c, s.resolved ? 'down' : 'right', 0, 180, 132 - bob);
    if (s.resolved) {
      c.font = '6px "Press Start 2P"';
      c.fillStyle = '#1e8a4a';
      c.fillText('✓ RESOLVED', 150, 120 + Math.sin(t * 4) * 2);
    }
  }

  private drawShip(c: Ctx, t: number, resolved: boolean): void {
    const ph = ((t - this.start) % PERIOD) / PERIOD;
    c.save();
    c.beginPath();
    c.rect(0, 0, W, WATERLINE + 1);
    c.clip();
    if (ph < 0.15) {
      boat(c, 40, WATERLINE - 15, Math.floor((ph / 0.15) * 2), 0, SC);
    } else {
      const k = (ph - 0.15) / 0.85;
      const crates = Math.min(10, 2 + Math.floor(k * 10));
      const bx = 40 + k * (resolved ? 380 : 220);
      const sink = !resolved && crates > HOLD ? Math.min(1, (k - (HOLD - 1) / 10) / 0.25) : 0;
      boat(c, bx, WATERLINE - 15 + crates * 0.6 + sink * 40 + Math.sin(t * 3), crates, sink * 0.5, SC);
      if (sink > 0 && sink < 1) for (let i = 0; i < 5; i++) disc(c, bx + 40 + i * 8, WATERLINE - ((t * 30 + i * 9) % 16), 1.5, '#c8e8fa');
    }
    c.restore();
  }
}

export const harbor1: InvestigateLevel = {
  meta: getLevel('harbor-1'),
  alert: 'SHIPS KEEP SINKING',
  briefing: {
    title: "DOCKMASTER'S NOTES",
    text: 'Ships load cargo as they sail. Something keeps sending them to the bottom, and the harbor just relaunches them. Pick a tool from your belt (keys 1–6).',
  },
  tools: [
    {
      id: 'logs',
      kind: 'investigate',
      icon: '📜',
      label: 'LOG READER',
      output: {
        title: '📜 SHIP-7 · LOGBOOK',
        lines: [
          '08:58 ship-7 launched',
          '08:59 loading cargo… 4/7 crates',
          '09:00 loading cargo… 7/7 crates',
          '!09:00 HOLD OVERFLOW: ship sank (OOMKilled)',
          '09:00 harbor relaunching ship-7',
        ],
      },
    },
    {
      id: 'metrics',
      kind: 'investigate',
      icon: '📈',
      label: 'METRICS LENS',
      output: {
        title: '📈 CARGO IN HOLD · LAST 10 MIN',
        chart: { values: [2, 3, 4, 5, 6, 7, 7.6, 1, 3, 5, 7, 7.6], limit: 7, caption: 'Climbs every voyage, hits the limit, drops to zero when the ship sinks.' },
      },
    },
    {
      id: 'rollback',
      kind: 'fix',
      resolves: false,
      penalty: 3,
      icon: '⏪',
      label: 'ROLL BACK',
      output: {
        title: '⏪ ROLLED BACK TO MANIFEST v41',
        text: 'The ships are the same as before, and they still sink. The cargo rules didn\'t change; demand grew. A rollback only helps when a recent change caused the problem.',
      },
    },
    {
      id: 'limits',
      kind: 'fix',
      resolves: true,
      icon: '🔧',
      label: 'RAISE LIMITS',
      output: { title: '🔧 HOLD SIZE 7 → 10 CRATES', text: '' },
    },
    { id: 'trace', kind: 'locked', icon: '🔒', label: 'TRACE', output: { title: 'Locked', text: 'You\'ll unlock tracing at the Watchtower.' } },
    { id: 'terminal', kind: 'locked', icon: '🔒', label: 'TERMINAL', output: { title: 'Locked', text: 'The terminal unlocks in Act 3.' } },
  ],
  resolvedText: {
    investigated: 'Ships now carry their full load and sail clear. You checked the evidence before changing anything. That\'s the job.',
    lucky: 'It worked! But you changed things without checking why. Next time, read the logs or metrics first.',
  },
  lesson: {
    headline: 'You fixed a crash loop caused by running out of memory.',
    mapping: [
      ['A ship', 'A container (pod)'],
      ['Cargo in the hold', 'Memory the app is using'],
      ['Hold size', 'The memory limit'],
      ['Sinks & relaunches', 'OOMKilled → CrashLoopBackOff'],
      ['Logbook', 'kubectl logs / events'],
    ],
    realWorld: `$ kubectl get pods
ship-7   0/1   CrashLoopBackOff   5   3m

$ kubectl describe pod ship-7 | grep -A2 "Last State"
Last State:  Terminated
  Reason:    OOMKilled

# deployment.yaml
resources:
  limits:
-   memory: "512Mi"
+   memory: "768Mi"`,
    realWorldCaption: 'In Act 3 you\'ll type this yourself at the harbor terminal.',
  },
  makeStage: () => new HarborStage(),
};
