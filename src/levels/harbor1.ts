import { CharacterSheet, LOOKS } from '../art/characters';
import { disc, rect, type Ctx } from '../art/pixels';
import { boat, container, Smoke } from '../art/scenery';
import type { Game } from '../engine/game';
import { h } from '../ui/ui';
import { getLevel } from './catalog';
import { IncidentScene, type Exit, type Intro, type Tab } from './incident';
import { HISTORY, PEAK, START_CONFIG, VERIFY_VOYAGES, clampHold, sinks, verdict, type ShipConfig } from './sims/harbor';

const W = 384;
const WATERLINE = 122;
const SC = 3;
const MI_PER_CRATE = 64;

// ------------------------------------------------------------------ stage
class HarborStage {
  hold = START_CONFIG.hold;
  policy = START_CONFIG.ifSunk;
  restarts = 3;
  stopped = false;
  private smoke = new Smoke('100,100,100');
  private finn = new CharacterSheet(LOOKS.finn);
  private p = 0; // progress through the current voyage, 0..1
  private period = 5;
  private demand = HISTORY[0];
  private histIdx = 0;
  private queue: number[] = [];
  private onVoyage: ((demand: number, sank: boolean) => void) | undefined;
  private onQueueDone: (() => void) | undefined;
  happy = false;

  /** Run specific voyages quickly (verification). */
  runVoyages(demands: number[], onVoyage: (d: number, sank: boolean) => void, onDone: () => void): void {
    this.stopped = false;
    this.queue = [...demands];
    this.demand = this.queue.shift()!;
    this.p = 0;
    this.period = 2.8;
    this.onVoyage = onVoyage;
    this.onQueueDone = onDone;
  }

  get verifying(): boolean {
    return !!this.onVoyage;
  }

  update(dt: number): void {
    this.smoke.step(dt);
    if (this.stopped) return;
    this.p += dt / this.period;
    if (this.p < 1) return;
    const sank = sinks({ ...START_CONFIG, hold: this.hold }, this.demand);
    if (sank) this.restarts++;
    const cb = this.onVoyage;
    cb?.(this.demand, sank);
    this.p = 0;
    if (sank && this.policy === 'give-up') {
      this.stopped = true;
      this.queue = []; // nothing else will sail, so verification ends here
    }
    if (this.queue.length) {
      this.demand = this.queue.shift()!;
    } else {
      if (cb) {
        this.onVoyage = undefined;
        this.period = 5;
        const done = this.onQueueDone;
        this.onQueueDone = undefined;
        done?.();
      }
      this.histIdx = (this.histIdx + 1) % HISTORY.length;
      this.demand = HISTORY[this.histIdx];
    }
  }

  render(c: Ctx, t: number): void {
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
    if (!this.stopped) this.drawShip(c, t);
    rect(c, 0, 136, W, 80, '#8a6a42');
    for (let y = 136; y < 216; y += 6) rect(c, 0, y, W, 1, '#6b4a2a');
    for (let x = 0; x < W; x += 40) rect(c, x + ((x / 40) % 2) * 20, 136, 1, 80, '#6b4a2a');
    rect(c, 0, 134, W, 3, '#5a3a1a');
    container(c, 8, 116, 30, 18, '#c0392b');
    container(c, 8, 98, 30, 18, '#2b6cb0');
    container(c, 8, 80, 30, 18, '#27ae60');
    container(c, 40, 116, 30, 18, '#e8a030');
    rect(c, 330, 40, 7, 96, '#e8a030');
    for (let y = 44; y < 136; y += 8) rect(c, 330, y, 7, 1, '#b07818');
    rect(c, 250, 40, 87, 5, '#e8a030');
    const sw = Math.sin(t) * 4;
    rect(c, 262, 45, 1, 26 + sw, '#2a1e1a');
    rect(c, 258, 71 + sw, 9, 6, '#2b6cb0');
    this.smoke.draw(c);
    const bob = Math.floor(t * 2) % 2;
    this.finn.draw(c, this.happy ? 'down' : 'right', 0, 180, 120 - bob);
    if (this.stopped) {
      c.font = '6px "Press Start 2P"';
      c.fillStyle = '#7a2a1a';
      c.fillText('NO SHIPS SAILING', 140, 100);
    }
  }

  private drawShip(c: Ctx, t: number): void {
    const k = this.p;
    const d = this.demand;
    const loadK = Math.max(0, Math.min(1, (k - 0.1) / 0.6));
    const crates = Math.floor(loadK * d + 0.0001);
    const over = crates > this.hold;
    const overAt = 0.1 + (0.6 * (this.hold + 1)) / d;
    const sink = over ? Math.min(1, (k - overAt) / 0.2) : 0;
    const bx = 40 + Math.max(0, k - 0.1) * (over ? 220 : 380);
    c.save();
    c.beginPath();
    c.rect(0, 0, W, WATERLINE + 1);
    c.clip();
    boat(c, bx, WATERLINE - 15 + Math.min(crates, 12) * 0.5 + sink * 44 + Math.sin(t * 3), Math.min(crates, 12), sink * 0.5, SC);
    if (sink > 0 && sink < 1) for (let i = 0; i < 5; i++) disc(c, bx + 40 + i * 8, WATERLINE - ((t * 30 + i * 9) % 16), 1.5, '#c8e8fa');
    c.restore();
    if (sink < 0.6) {
      // cargo / hold gauge above the ship: the thing to notice
      const label = `${crates}/${this.hold}`;
      c.font = '6px "Press Start 2P"';
      const w = c.measureText(label).width + 6;
      const lx = Math.round(bx + 40);
      rect(c, lx - 1, 50, w + 2, 11, '#2a1e1a');
      rect(c, lx, 51, w, 9, over ? '#e05a48' : crates === this.hold ? '#f8d030' : '#f8ecd0');
      c.fillStyle = over ? '#fff' : '#2a1e1a';
      c.fillText(label, lx + 3, 58);
    }
  }
}

// ------------------------------------------------------------------ log & chart data
interface LogLine {
  time: string;
  text: string;
  err?: boolean;
  evidence?: boolean;
  note: string;
}
const LOG: LogLine[] = [
  { time: '08:41', text: 'ship-7 launched · hold: 7 crates', note: 'Each ship\'s hold fits 7 crates. Worth remembering.' },
  { time: '08:42', text: 'voyage done · carried 6 crates', note: '6 crates fit in a hold of 7. That voyage was fine.' },
  { time: '08:44', text: 'ship-7 launched', note: 'Just a launch, nothing unusual.' },
  { time: '08:45', text: 'loading crate 8 of 9…', note: 'This voyage needed 9 crates. More than usual. Keep reading…' },
  { time: '08:45', text: 'HOLD OVERFLOW · ship sank', err: true, evidence: true, note: 'There it is: the ship sank the moment its cargo went over the hold size. It isn\'t broken, it\'s too small for its load.' },
  { time: '08:45', text: 'harbor: relaunching ship-7 (restart #1)', note: 'The harbor relaunches sunk ships automatically, so the same thing happens again and again.' },
  { time: '08:46', text: 'weather: calm · sea: normal', note: 'The weather is fine. Not the cause.' },
  { time: '08:47', text: 'manifest v41: no changes for 6 days', note: 'Nothing changed recently, so undoing a recent change won\'t help.' },
  { time: '08:48', text: 'voyage: 8 crates · HOLD OVERFLOW · sank', err: true, evidence: true, note: 'Again: 8 crates in a 7-crate hold. Busy voyages sink; quiet ones don\'t.' },
  { time: '08:48', text: 'harbor: relaunching ship-7 (restart #2)', note: 'Relaunching doesn\'t change the ship, so it can\'t fix this.' },
  { time: '08:50', text: 'crew: 4 sailors on board, all well', note: 'The crew is fine. They don\'t change how much the hold fits.' },
];

// ------------------------------------------------------------------ scene
export class HarborScene extends IncidentScene {
  private stage = new HarborStage();
  private cfg: ShipConfig = { ...START_CONFIG };
  private draft: ShipConfig = { ...START_CONFIG };
  private pinned = new Set<number>();
  private seenBars = new Set<number>();
  private verifyLog: string[] = [];

  constructor(game: Game, exit: Exit) {
    super(game, getLevel('harbor-1'), exit);
  }

  protected intro(): Intro {
    return {
      symptom: 'Cargo ships leave the harbor, and some of them sink partway out. The harbor relaunches each one, and it happens again. Deliveries keep failing.',
      known: [
        'Ships take on cargo while they sail.',
        'Not every voyage sinks. Some arrive fine.',
        'Nobody has changed the ships recently.',
      ],
      goal: 'Find out why ships sink, change the ship manifest so they stop, and watch them sail to prove it.',
    };
  }

  protected tabs(): Tab[] {
    return [
      { id: 'log', icon: '📜', label: 'LOGBOOK' },
      { id: 'chart', icon: '📈', label: 'CARGO CHART' },
      { id: 'manifest', icon: '⚙️', label: 'MANIFEST' },
    ];
  }

  protected renderTab(id: string): Node {
    if (id === 'log') return this.logTab();
    if (id === 'chart') return this.chartTab();
    return this.manifestTab();
  }

  private logTab(): Node {
    const wrap = h('div', 'logbook');
    wrap.append(h('div', 'hint', 'Click the line that explains why ships sink.'));
    LOG.forEach((l, i) => {
      const row = h('div', `logline ${l.err ? 'err' : ''} ${this.pinned.has(i) ? 'pinned' : ''}`);
      row.append(h('span', 'time', l.time), h('span', '', l.text));
      row.addEventListener('click', () => {
        this.pinned.add(i);
        row.classList.add('pinned');
        if (l.evidence) {
          this.foundCause();
          this.say(l.note, 'good');
        } else this.say(l.note);
      });
      wrap.append(row);
    });
    return wrap;
  }

  private chartTab(): Node {
    const wrap = h('div', '');
    wrap.append(h('div', 'hint', 'Peak cargo on each recent voyage. The dashed line is the hold size. Click a bar to read it.'));
    const max = Math.max(...HISTORY, this.cfg.hold) + 2;
    const chart = h('div', 'chart big');
    HISTORY.forEach((v, i) => {
      const over = v > this.cfg.hold;
      const bar = h('button', `bar-btn ${over ? 'hot' : ''} ${this.seenBars.has(i) ? 'seen' : ''}`);
      bar.style.height = `${(v / max) * 100}%`;
      bar.append(h('span', 'v', this.seenBars.has(i) ? String(v) : ''));
      bar.addEventListener('click', () => {
        this.seenBars.add(i);
        bar.classList.add('seen');
        (bar.firstChild as HTMLElement).textContent = String(v);
        if (over) {
          this.foundCause();
          this.say(`Voyage ${i + 1} needed ${v} crates, but the hold fits ${this.cfg.hold}. It sank.`, 'good');
        } else this.say(`Voyage ${i + 1} needed ${v} crates. It fits in a hold of ${this.cfg.hold}, so it sailed fine.`);
      });
      chart.append(bar);
    });
    const lim = h('div', 'lim', `HOLD ${this.cfg.hold}`);
    lim.style.bottom = `${(this.cfg.hold / max) * 100}%`;
    chart.append(lim);
    wrap.append(chart);
    return wrap;
  }

  private manifestTab(): Node {
    const d = this.draft;
    const wrap = h('div', 'manifest');
        const row = (label: string, ctrl: HTMLElement, unit = '') => {
      const r = h('div', 'mrow');
      r.append(h('span', 'k', label), ctrl, h('span', 'unit', unit));
      return r;
    };
    const stepper = (get: () => number, set: (n: number) => void) => {
      const s = h('span', 'stepper');
      const minus = h('button', 'btn sm', '−');
      const input = h('input', 'num') as HTMLInputElement;
      input.type = 'text';
      input.inputMode = 'numeric';
      input.value = String(get());
      const plus = h('button', 'btn sm', '+');
      const commit = () => {
        const n = parseInt(input.value, 10);
        set(Number.isFinite(n) ? n : get());
        input.value = String(get());
      };
      minus.addEventListener('click', () => {
        set(get() - 1);
        input.value = String(get());
      });
      plus.addEventListener('click', () => {
        set(get() + 1);
        input.value = String(get());
      });
      input.addEventListener('change', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
      });
      s.append(minus, input, plus);
      return s;
    };
    const policy = h('span', 'seg');
    for (const [val, label] of [
      ['relaunch', 'RELAUNCH'],
      ['give-up', 'GIVE UP'],
    ] as const) {
      const b = h('button', `btn sm ${d.ifSunk === val ? 'on' : ''}`, label);
      b.addEventListener('click', () => {
        d.ifSunk = val;
        policy.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      });
      policy.append(b);
    }
    const apply = h('button', 'btn primary', this.stage.verifying ? 'WATCHING…' : '⚓ APPLY & WATCH 3 VOYAGES');
    apply.disabled = this.stage.verifying;
    apply.addEventListener('click', () => this.apply());
    const left = h('div', 'mcol');
    left.append(
      h('div', 'mtitle', 'SHIP-7 MANIFEST'),
      row('hold_size:', stepper(() => d.hold, (n) => (d.hold = clampHold(n))), 'crates'),
      row('crew:', stepper(() => d.crew, (n) => (d.crew = Math.max(1, Math.min(12, n)))), 'sailors'),
      row('if_sunk:', policy),
    );
    const right = h('div', 'mcol');
    right.append(apply);
    const vl = h('div', 'vlog');
    for (const line of this.verifyLog) vl.append(h('div', line.includes('sank') ? 'err' : 'ok', line));
    if (!this.verifyLog.length) vl.append(h('div', 'muted', 'Voyage results appear here.'));
    right.append(vl);
    const cols = h('div', 'mgrid');
    cols.append(left, right);
    wrap.append(cols);
    return wrap;
  }

  private foundCause(): void {
    if (!this.steps.cause) {
      this.complete('cause');
      this.game.ui.toast('CAUSE FOUND', 'good');
    }
  }

  private apply(): void {
    if (this.stage.verifying) return;
    const v = verdict(this.cfg, this.draft);
    if (v.kind === 'no-change') {
      this.say('Nothing changed. Adjust a setting first.', 'warn');
      return;
    }
    this.noteChange();
    this.complete('fix');
    const before = { ...this.cfg };
    this.cfg = { ...this.draft };
    this.stage.hold = this.cfg.hold;
    this.stage.policy = this.cfg.ifSunk;
    this.verifyLog = [];
    this.say('Change applied. Watch the next three voyages…');
    let n = 0;
    this.stage.runVoyages(
      VERIFY_VOYAGES,
      (demand, sank) => {
        n++;
        this.verifyLog.push(`Voyage ${n}: ${demand} crates, hold ${this.cfg.hold} → ${sank ? 'sank ✗' : 'sailed ✓'}`);
        if (this.activeTab === 'manifest') this.refreshTab();
      },
      () => this.judge(before, v),
    );
    this.openTab('manifest');
  }

  private judge(before: ShipConfig, v: ReturnType<typeof verdict>): void {
    if (v.kind === 'fixed') {
      this.stage.happy = true;
      this.attempts.wasteful = v.wasteful;
      this.say(
        v.wasteful
          ? `All three voyages sailed. But a hold of ${this.cfg.hold} is far more than the busiest voyage (${PEAK}) needs. You're paying for empty space.`
          : `All three voyages sailed, even the busiest one (${PEAK} crates). Fixed!`,
        v.wasteful ? 'warn' : 'good',
      );
      this.finish(this.recap());
      return;
    }
    this.attempts.failedChanges++;
    if (v.kind === 'hidden') {
      this.say('No more sinking… because no ships sail at all now. The cargo never arrives. That hides the problem instead of fixing it.', 'bad');
    } else if (this.cfg.hold === before.hold) {
      this.say(`Still sinking. ${this.cfg.crew !== before.crew ? 'The crew size doesn\'t change how much cargo fits. ' : ''}What decides whether a ship sinks?`, 'bad');
    } else {
      this.say(`Better, but a voyage with ${v.kind === 'still-sinking' ? v.failedOn : PEAK} crates still sank in a hold of ${this.cfg.hold}. How much does the busiest voyage need?`, 'bad');
    }
    this.game.ui.toast('NOT FIXED YET · TRUST −1', 'bad');
  }

  private recap() {
    return {
      headline: 'The ships weren\'t broken. They were too small for their busiest load.',
      before: { label: 'BEFORE', visual: holdViz(START_CONFIG.hold, PEAK), caption: `Hold ${START_CONFIG.hold} · busiest voyage ${PEAK} crates → overflows, sinks, relaunches, sinks again. Restarted ${this.stage.restarts}× while you investigated.` },
      after: { label: 'AFTER', visual: holdViz(this.cfg.hold, PEAK), caption: `Hold ${this.cfg.hold} · busiest voyage ${PEAK} crates → fits${this.cfg.hold > PEAK ? ` with ${this.cfg.hold - PEAK} spare` : ', just'}. Ships sail; 0 restarts.` },
      why: 'Relaunching a ship that\'s too small just repeats the crash. The fix was to give it room for its peak load, and you sized it from evidence (the busiest voyage), not a guess. A little headroom is good; a lot is wasted money.',
      realWorld: `$ kubectl get pods
ship-7   0/1   CrashLoopBackOff   ${this.stage.restarts}   5m
$ kubectl describe pod ship-7 | grep Reason
    Reason:   OOMKilled

# deployment.yaml → resources.limits
-   memory: "${START_CONFIG.hold * MI_PER_CRATE}Mi"
+   memory: "${this.cfg.hold * MI_PER_CRATE}Mi"`,
      realWorldCaption: 'Crates = memory, hold size = memory limit, sinking = OOMKilled, relaunching = CrashLoopBackOff. In Act 3 you\'ll do this at the terminal.',
    };
  }

  update(dt: number, t: number): void {
    this.baseUpdate(t);
    this.stage.update(dt);
    this.setAlert(this.stage.happy ? undefined : this.stage.stopped ? 'HARBOR IDLE · NO DELIVERIES' : `SHIPS SINKING · RESTART #${this.stage.restarts}`);
  }

  render(c: Ctx, t: number): void {
    this.stage.render(c, t);
  }
}

/** A row of hold slots with crates in them; overflow crates spill out in red. */
function holdViz(hold: number, cargo: number): HTMLElement {
  const wrap = h('div', 'holdviz');
  const box = h('div', 'hold');
  for (let i = 0; i < hold; i++) box.append(h('i', i < cargo ? 'crate' : 'empty'));
  wrap.append(box);
  if (cargo > hold) {
    const spill = h('div', 'spill');
    for (let i = hold; i < cargo; i++) spill.append(h('i', 'crate over'));
    wrap.append(spill);
  }
  return wrap;
}
