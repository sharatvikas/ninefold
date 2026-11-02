import type { Input } from '../engine/input';
import { DISTRICTS, levelsIn } from '../levels/catalog';
import { levelStatus, type Progress } from '../state/progress';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

const ADVANCE_KEYS = ['e', ' ', 'enter'];
const CHARS_PER_SEC = 45;

class Dialog {
  readonly el = h('div', 'dialog panel hidden');
  private nameEl = h('span', 'name');
  private textEl = h('span', 'text');
  private lines: string[] = [];
  private idx = 0;
  private shown = 0;
  private onDone: (() => void) | undefined;
  private freshFrames = 0;
  open = false;

  constructor() {
    this.el.append(this.nameEl, this.textEl, h('span', 'arrow', '▼'));
    this.el.addEventListener('pointerdown', () => this.advance());
  }

  show(name: string, lines: string[], onDone?: () => void): void {
    this.lines = lines;
    this.idx = 0;
    this.shown = 0;
    this.onDone = onDone;
    this.open = true;
    this.freshFrames = 2;
    this.nameEl.textContent = name ? `${name.toUpperCase()}: ` : '';
    this.el.classList.remove('hidden');
    this.render();
  }

  update(dt: number, input: Input): void {
    if (!this.open) return;
    const line = this.lines[this.idx] ?? '';
    if (this.shown < line.length) {
      this.shown = Math.min(line.length, this.shown + dt * CHARS_PER_SEC);
      this.render();
    }
    if (this.freshFrames > 0) this.freshFrames--;
    else if (input.wasPressed(...ADVANCE_KEYS)) this.advance();
  }

  advance(): void {
    if (!this.open) return;
    const line = this.lines[this.idx] ?? '';
    if (this.shown < line.length) {
      this.shown = line.length;
      this.render();
      return;
    }
    this.idx++;
    this.shown = 0;
    if (this.idx >= this.lines.length) {
      this.open = false;
      this.el.classList.add('hidden');
      const cb = this.onDone;
      this.onDone = undefined;
      cb?.();
      return;
    }
    this.render();
  }

  private render(): void {
    this.textEl.textContent = (this.lines[this.idx] ?? '').slice(0, Math.floor(this.shown));
    this.el.classList.toggle('done', this.shown >= (this.lines[this.idx] ?? '').length);
  }
}

class Hud {
  readonly el = h('div', 'hud');
  private trustFill = h('i');
  private trustNum = h('span', 'num');
  private clock = h('div', 'clock panel');
  readonly ticketsBtn = h('button', 'btn tickets', 'Q · TICKETS');
  private minutes = 9 * 60;
  private acc = 0;

  constructor() {
    const trust = h('div', 'trust panel');
    const bar = h('span', 'bar');
    bar.append(this.trustFill);
    trust.append(h('span', 'label', 'TRUST'), bar, this.trustNum);
    this.el.append(trust, this.clock, this.ticketsBtn);
    this.renderClock();
  }

  setTrust(n: number): void {
    this.trustFill.style.width = `${n}%`;
    this.trustFill.classList.toggle('low', n < 30);
    this.trustNum.textContent = String(n);
  }

  update(dt: number): void {
    this.acc += dt;
    if (this.acc >= 7) {
      this.acc -= 7;
      this.minutes = (this.minutes + 10) % (24 * 60);
      this.renderClock();
    }
  }

  private renderClock(): void {
    const hr = Math.floor(this.minutes / 60);
    const mm = String(this.minutes % 60).padStart(2, '0');
    const icon = hr >= 6 && hr < 19 ? '☀' : '☾';
    this.clock.textContent = `${icon} ${hr % 12 || 12}:${mm}${hr < 12 ? 'am' : 'pm'}`;
  }
}

const STATUS_ICON = { done: '✓', available: '!', locked: '·', soon: '…' } as const;
const STATUS_TEXT = { done: 'Done', available: 'Ready', locked: 'Locked', soon: 'Coming soon' } as const;

class QuestLog {
  readonly el = h('div', 'modal hidden');
  open = false;
  /** Ignore the key press that opened the log, so it doesn't close in the same frame. */
  fresh = false;

  constructor(private onClose: () => void) {
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target === this.el) this.close();
    });
  }

  show(p: Progress): void {
    this.el.replaceChildren();
    const box = h('div', 'panel questlog');
    const head = h('div', 'ql-head');
    const close = h('button', 'btn', '✕');
    close.addEventListener('click', () => this.close());
    const total = Object.keys(p.completed).length;
    head.append(h('div', 'title', `TICKETS · ${total} CLOSED`), close);
    const grid = h('div', 'ql-grid');
    for (const d of DISTRICTS) {
      const col = h('div', 'ql-district');
      col.append(h('div', 'ql-name', d.name), h('div', 'ql-topic', d.topic));
      for (const l of levelsIn(d.id)) {
        const st = levelStatus(p, l);
        const row = h('div', `ql-level ${st}`);
        row.title = `${l.concept} · Act ${l.act} · ${STATUS_TEXT[st]}`;
        row.append(h('span', 'ic', STATUS_ICON[st]), h('span', '', `${l.num}. ${l.title}`));
        col.append(row);
      }
      grid.append(col);
    }
    box.append(head, grid, h('div', 'ql-foot', '! ready   ✓ done   … coming soon   · finish the previous ticket first'));
    this.el.append(box);
    this.el.classList.remove('hidden');
    this.open = true;
    this.fresh = true;
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    this.onClose();
  }
}

/** All DOM UI that sits on top of the canvas. */
export class UI {
  readonly hud = new Hud();
  readonly dialog = new Dialog();
  readonly questLog: QuestLog;
  /** Per-scene layer, emptied on every scene change. */
  readonly scene = h('div', 'scene-layer');
  private toastEl = h('div', 'toast hidden');
  private toastTimer = 0;

  constructor(
    readonly root: HTMLElement,
    private input: Input,
  ) {
    this.questLog = new QuestLog(() => (this.input.enabled = true));
    root.append(this.scene, this.hud.el, this.dialog.el, this.toastEl, this.questLog.el, this.touchControls());
  }

  /** True while something modal is on screen and the world should not move. */
  get busy(): boolean {
    return this.dialog.open || this.questLog.open;
  }

  clearScene(): void {
    this.scene.replaceChildren();
  }

  openQuestLog(p: Progress): void {
    this.input.enabled = false;
    this.questLog.show(p);
  }

  toast(msg: string, kind: 'good' | 'bad' | 'info' = 'info'): void {
    this.toastEl.textContent = msg;
    this.toastEl.className = `toast ${kind}`;
    this.toastTimer = 3.2;
  }

  update(dt: number): void {
    this.dialog.update(dt, this.input);
    this.hud.update(dt);
    if (this.questLog.open) {
      if (this.questLog.fresh) this.questLog.fresh = false;
      else if (this.input.wasPressed('q', 'escape')) this.questLog.close();
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.add('hidden');
    }
  }

  private touchControls(): HTMLElement {
    const wrap = h('div', 'touch');
    const pad = h('div', 'dpad');
    const mk = (cls: string, key: string, label: string) => {
      const b = h('button', `tbtn ${cls}`, label);
      const on = (e: Event) => {
        e.preventDefault();
        this.input.hold(key, true);
      };
      const off = () => this.input.hold(key, false);
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
      return b;
    };
    pad.append(mk('up', 'arrowup', '▲'), mk('left', 'arrowleft', '◀'), mk('right', 'arrowright', '▶'), mk('down', 'arrowdown', '▼'));
    const a = h('button', 'tbtn act', 'E');
    a.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.tap('e');
    });
    wrap.append(pad, a);
    return wrap;
  }
}
