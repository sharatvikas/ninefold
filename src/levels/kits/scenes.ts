import type { Ctx } from '../../art/pixels';
import type { Game, Scene } from '../../engine/game';
import { h } from '../../ui/ui';
import type { LevelResult } from '../../world/TownScene';
import type { InvestigateLevel, Lesson, SortLevel, SortStage, Stage, ToolDef } from '../types';
import { newInvestigateState, useTool, type InvestigateState } from './investigate';
import { moveItem, newSortState, sortTrust, type SortState } from './sort';
import type { LevelMeta } from '../catalog';

type Exit = (r: LevelResult) => void;

/** Shared chrome: title bar, leave button, lesson card. */
abstract class LevelScene implements Scene {
  protected root = h('div', 'level');
  protected notes = h('div', 'panel notes');
  private lessonShown = false;

  constructor(
    protected game: Game,
    protected meta: LevelMeta,
    protected exit: Exit,
  ) {}

  enter(): void {
    const top = h('div', 'level-top');
    const title = h('div', 'panel level-title');
    title.append(h('span', 'act', `ACT ${this.meta.act}`), h('span', '', `${this.meta.title.toUpperCase()}`), h('span', 'concept', this.meta.concept));
    const leave = h('button', 'btn leave', '✕ LEAVE');
    leave.addEventListener('click', () => this.exit({ levelId: this.meta.id, trust: 0, completed: false }));
    top.append(title, leave);
    this.root.append(top);
    this.game.ui.scene.append(this.root);
    this.game.ui.hud.el.classList.add('hidden');
  }

  leave(): void {
    this.game.ui.hud.el.classList.remove('hidden');
  }

  protected say(title: string, body: Node | string): void {
    this.notes.replaceChildren(h('div', 't', title));
    if (typeof body === 'string') this.notes.append(h('div', 'body', body));
    else this.notes.append(body);
  }

  protected showLesson(lesson: Lesson, trust: number): void {
    if (this.lessonShown) return;
    this.lessonShown = true;
    const wrap = h('div', 'modal');
    const card = h('div', 'panel lesson');
    card.append(h('div', 'title', '✓ TICKET SOLVED'), h('div', 'headline', lesson.headline));
    const table = h('div', 'mapping');
    for (const [a, b] of lesson.mapping) table.append(h('span', 'm', a), h('span', 'arrow', '→'), h('span', 'r', b));
    const code = h('pre', 'code', lesson.realWorld);
    const btn = h('button', 'btn primary', trust > 0 ? `CLOSE TICKET · TRUST +${trust}` : 'CLOSE TICKET');
    btn.addEventListener('click', () => this.exit({ levelId: this.meta.id, trust, completed: true }));
    const cols = h('div', 'lesson-cols');
    const left = h('div', '');
    left.append(h('div', 'sub', 'WHAT IT REALLY WAS'), table);
    const right = h('div', '');
    right.append(h('div', 'sub', 'HOW IT LOOKS FOR REAL'), code, h('div', 'caption', lesson.realWorldCaption));
    cols.append(left, right);
    card.append(cols, btn);
    wrap.append(card);
    this.root.append(wrap);
    btn.focus();
  }

  abstract update(dt: number, t: number): void;
  abstract render(c: Ctx, t: number): void;
}

// ------------------------------------------------------------------ Investigate & Fix
export class InvestigateScene extends LevelScene {
  private state: InvestigateState = newInvestigateState();
  private stage: Stage<{ resolved: boolean }>;
  private alert = h('div', 'alert');
  private slots: HTMLElement[] = [];
  private solvedAt = -1;
  private now = 0;
  private timers: number[] = [];

  constructor(
    game: Game,
    private level: InvestigateLevel,
    exit: Exit,
  ) {
    super(game, level.meta, exit);
    this.stage = level.makeStage();
  }

  enter(): void {
    super.enter();
    const tray = h('div', 'tray');
    const bar = h('div', 'hotbar');
    this.level.tools.forEach((tool, i) => {
      const slot = h('button', `slot ${tool.kind === 'locked' ? 'locked' : ''}`);
      slot.append(h('span', 'key', String(i + 1)), h('span', 'icon', tool.icon), h('small', '', tool.label));
      slot.addEventListener('click', () => this.use(tool));
      bar.append(slot);
      this.slots.push(slot);
    });
    tray.append(bar, this.notes);
    this.root.append(this.alert, tray);
    this.say(this.level.briefing.title, this.level.briefing.text);
  }

  leave(): void {
    super.leave();
    this.timers.forEach((id) => clearInterval(id));
  }

  private use(tool: ToolDef): void {
    this.slots.forEach((s, i) => s.classList.toggle('sel', this.level.tools[i] === tool));
    const r = useTool(this.level.tools, this.state, tool.id);
    this.state = r.state;
    const o = tool.output;
    switch (r.outcome.type) {
      case 'locked':
        this.say(o.title, o.text ?? 'Not yet.');
        break;
      case 'info':
        this.showOutput(tool);
        break;
      case 'wrong':
        this.say(o.title, this.withNote(o.text ?? '', `TRUST ${r.outcome.trust}`, 'bad'));
        this.game.ui.toast(`TRUST ${r.outcome.trust}`, 'bad');
        break;
      case 'already-resolved':
        this.say('ALL CLEAR', 'Everything is running smoothly. Nothing left to fix here.');
        break;
      case 'resolved': {
        const lucky = r.outcome.lucky;
        this.say(o.title, this.withNote(lucky ? this.level.resolvedText.lucky : this.level.resolvedText.investigated, lucky ? 'LUCKY FIX' : 'RESOLVED', lucky ? 'warn' : 'good'));
        this.solvedAt = this.now;
        break;
      }
    }
  }

  private withNote(text: string, note: string, kind: 'good' | 'bad' | 'warn'): HTMLElement {
    const d = h('div', 'body', text);
    d.append(h('div', `note ${kind}`, note));
    return d;
  }

  private showOutput(tool: ToolDef): void {
    const o = tool.output;
    if (o.lines) {
      const log = h('div', 'log');
      this.say(o.title, log);
      let i = 0;
      const id = window.setInterval(() => {
        if (i >= o.lines!.length || !log.isConnected) return clearInterval(id);
        const line = o.lines![i++];
        log.append(h('div', line.startsWith('!') ? 'err' : '', line.replace(/^!/, '')));
      }, 380);
      this.timers.push(id);
    } else if (o.chart) {
      const ch = o.chart;
      const max = Math.max(ch.limit + 1, ...ch.values);
      const box = h('div', 'chart');
      const bars = ch.values.map(() => box.appendChild(h('i')));
      const lim = h('div', 'lim', `LIMIT ${ch.limit}`);
      lim.style.bottom = `${(ch.limit / max) * 100}%`;
      box.append(lim);
      const wrap = h('div', '');
      wrap.append(box, h('div', 'caption', ch.caption));
      this.say(o.title, wrap);
      ch.values.forEach((v, i) =>
        this.timers.push(
          window.setTimeout(() => {
            bars[i].style.height = `${(v / max) * 100}%`;
            if (v >= ch.limit) bars[i].classList.add('hot');
          }, 90 * i),
        ),
      );
    } else {
      this.say(o.title, o.text ?? '');
    }
  }

  update(dt: number, t: number): void {
    this.now = t;
    this.stage.update(dt, t, { resolved: this.state.resolved });
    const { input } = this.game;
    for (let i = 0; i < this.level.tools.length; i++) if (input.wasPressed(String(i + 1))) this.use(this.level.tools[i]);
    if (input.wasPressed('escape')) this.exit({ levelId: this.meta.id, trust: 0, completed: false });
    this.alert.textContent = this.state.resolved ? '' : `⚠ ${this.level.alert}${this.stage.alertDetail ? ' · ' + this.stage.alertDetail() : ''}`;
    this.alert.classList.toggle('hidden', this.state.resolved);
    if (this.solvedAt >= 0 && t - this.solvedAt > 3.2) this.showLesson(this.level.lesson, Math.max(1, this.state.trust));
  }

  render(c: Ctx, t: number): void {
    this.stage.render(c, t, { resolved: this.state.resolved });
  }
}

// ------------------------------------------------------------------ Sort & Match
export class SortScene extends LevelScene {
  private state: SortState;
  private stage: SortStage;
  private wall = h('div', 'panel wall');
  private picked: string | undefined;
  private solvedAt = -1;
  private now = 0;

  constructor(
    game: Game,
    private level: SortLevel,
    exit: Exit,
  ) {
    super(game, level.meta, exit);
    this.state = newSortState(level.puzzle);
    this.stage = level.makeStage();
  }

  enter(): void {
    super.enter();
    const zones = h('div', 'zones');
    for (const slot of this.level.puzzle.slots) {
      const r = this.stage.slotRects[slot];
      const z = h('div', 'zone');
      z.dataset.slot = slot;
      Object.assign(z.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
      z.addEventListener('click', () => {
        if (this.picked) this.place(this.picked, slot);
      });
      zones.append(z);
    }
    const tray = h('div', 'tray');
    tray.append(this.wall, this.notes);
    this.root.append(zones, tray);
    this.renderWall();
    this.say(this.level.briefing.title, this.level.briefing.text);
  }

  private renderWall(): void {
    this.wall.replaceChildren(h('div', 't', 'SORTING WALL'));
    const list = h('div', 'chips');
    for (const item of this.level.puzzle.items) {
      const chip = h('div', `chip ${this.picked === item ? 'picked' : ''}`);
      chip.append(h('span', 'name', this.level.itemLabel[item]), h('span', 'arrow', '→'), h('span', 'num', this.level.slotLabel[this.state.assign[item]]));
      chip.addEventListener('pointerdown', (e) => this.startDrag(e, item, chip));
      list.append(chip);
    }
    this.wall.append(list);
  }

  private startDrag(e: PointerEvent, item: string, chip: HTMLElement): void {
    if (this.state.solved) return;
    e.preventDefault();
    const ghost = chip.cloneNode(true) as HTMLElement;
    ghost.classList.add('ghost');
    document.body.append(ghost);
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) moved = true;
      ghost.style.left = `${ev.clientX}px`;
      ghost.style.top = `${ev.clientY}px`;
      document.querySelectorAll('.zone').forEach((z) => z.classList.remove('over'));
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.zone');
      under?.classList.add('over');
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.remove();
      document.querySelectorAll('.zone').forEach((z) => z.classList.remove('over'));
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.zone');
      if (moved && under?.dataset.slot) this.place(item, under.dataset.slot);
      else if (!moved) {
        this.picked = this.picked === item ? undefined : item;
        this.renderWall();
        if (this.picked) this.say('PICKED UP', `Now tap the house that ${this.level.itemLabel[item]} should point to.`);
      }
    };
    move(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  private place(item: string, slot: string): void {
    this.picked = undefined;
    const r = moveItem(this.level.puzzle, this.state, item, slot);
    const changed = r.state !== this.state;
    this.state = r.state;
    this.renderWall();
    if (!changed) return;
    if (!r.correct) {
      this.say('NOT QUITE', this.level.wrongHint);
      this.game.ui.toast('WRONG HOUSE · −1 TRUST', 'bad');
    } else if (this.state.solved) {
      this.say('FIXED!', 'The wall is right again. Watch the next delivery…');
      this.solvedAt = this.now;
    } else {
      this.say('GOOD', 'That one\'s right. Is anything else still wrong?');
    }
  }

  update(dt: number, t: number): void {
    this.now = t;
    this.stage.update(dt, t, this.state);
    if (this.game.input.wasPressed('escape')) this.exit({ levelId: this.meta.id, trust: 0, completed: false });
    if (this.solvedAt >= 0 && t - this.solvedAt > 6) this.showLesson(this.level.lesson, sortTrust(this.state));
  }

  render(c: Ctx, t: number): void {
    this.stage.render(c, t, this.state);
  }
}
