import type { Ctx } from '../art/pixels';
import type { Game, Scene } from '../engine/game';
import { h } from '../ui/ui';
import type { LevelResult } from '../world/TownScene';
import type { LevelMeta } from './catalog';
import { newAttempts, trustFor, type Attempts } from './sims/score';

export type Exit = (r: LevelResult) => void;
export type StepId = 'understand' | 'cause' | 'fix' | 'verify';

const STEPS: [StepId, string][] = [
  ['understand', 'UNDERSTAND'],
  ['cause', 'FIND CAUSE'],
  ['fix', 'CHANGE'],
  ['verify', 'VERIFY'],
];

export interface Intro {
  symptom: string;
  known: string[];
  goal: string;
}

export interface Tab {
  id: string;
  icon: string;
  label: string;
}

export interface Side {
  label: string;
  visual: HTMLElement;
  caption: string;
}

export interface Recap {
  headline: string;
  before: Side;
  after: Side;
  why: string;
  realWorld: string;
  realWorldCaption: string;
}

/**
 * A hands-on incident: understand → find the cause → change something → verify.
 * Subclasses provide the stage, tabs (tools) and the rules.
 */
/** Where the player is in a ticket. Keys and clicks on the stage only act during 'play'. */
export type Phase = 'intro' | 'play' | 'resolving' | 'recap';

export abstract class IncidentScene implements Scene {
  protected root = h('div', 'level');
  protected steps: Record<StepId, boolean> = { understand: false, cause: false, fix: false, verify: false };
  protected attempts: Attempts = newAttempts();
  protected now = 0;
  private stepEls = new Map<StepId, HTMLElement>();
  private tabBtns = new Map<string, HTMLElement>();
  private panelTitle = h('div', 't');
  private panelBody = h('div', 'pbody');
  private feed = h('div', 'feed hidden');
  private alertEl = h('div', 'alert hidden');
  protected activeTab = '';
  protected phase: Phase = 'intro';
  /** Pop-ups opened on top of play (e.g. the file editor). */
  private overlays = 0;
  private timers: number[] = [];
  /** When the player last pressed Esc mid-ticket; a second press soon after really leaves. */
  private escAt = -Infinity;

  constructor(
    protected game: Game,
    protected meta: LevelMeta,
    private exit: Exit,
  ) {}

  protected abstract intro(): Intro;
  protected abstract tabs(): Tab[];
  protected abstract renderTab(id: string): Node;
  abstract update(dt: number, t: number): void;
  abstract render(c: Ctx, t: number): void;

  enter(): void {
    this.game.ui.touch.classList.add('hidden');
    this.game.ui.hud.el.classList.add('hidden');
    const top = h('div', 'level-top');
    const title = h('div', 'panel level-title');
    title.append(h('span', 'act', `ACT ${this.meta.act}`), h('span', '', this.meta.title.toUpperCase()));
    const steps = h('div', 'panel steps');
    STEPS.forEach(([id, label], i) => {
      const el = h('span', 'step', `${i + 1} ${label}`);
      this.stepEls.set(id, el);
      steps.append(el);
    });
    const leave = h('button', 'btn leave', '✕');
    leave.title = 'Leave (Esc)';
    leave.addEventListener('click', () => this.leaveLevel());
    top.append(title, steps, leave);

    const tray = h('div', 'tray');
    const bar = h('div', 'hotbar');
    this.tabs().forEach((tab, i) => {
      const b = h('button', 'slot');
      b.append(h('span', 'key', String(i + 1)), h('span', 'icon', tab.icon), h('small', '', tab.label));
      b.addEventListener('click', () => this.openTab(tab.id));
      this.tabBtns.set(tab.id, b);
      bar.append(b);
    });
    const panel = h('div', 'panel notes');
    panel.append(this.panelTitle, this.panelBody, this.feed);
    tray.append(bar, panel);
    this.root.append(top, this.alertEl, tray);
    this.game.ui.scene.append(this.root);
    this.showIntro();
  }

  leave(): void {
    this.game.ui.touch.classList.remove('hidden');
    this.timers.forEach((id) => clearTimeout(id));
    this.timers = [];
    this.game.ui.hud.el.classList.remove('hidden');
  }

  /** A timer that is cancelled if the player leaves the level first. */
  protected later(fn: () => void, ms: number): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  protected leaveLevel(): void {
    this.exit({ levelId: this.meta.id, trust: 0, completed: false });
  }

  /** Handle shared keys. Call from subclass update(). */
  protected baseUpdate(t: number): void {
    this.now = t;
    const { input } = this.game;
    if (input.wasPressed('escape') && !this.blocked) {
      // Leaving throws away work on this ticket, so once something has happened, ask for a second press.
      const started = this.steps.cause || this.steps.fix;
      if (!started || t - this.escAt < 2.5) this.leaveLevel();
      else {
        this.escAt = t;
        this.game.ui.toast('PRESS ESC AGAIN TO LEAVE · THIS TICKET RESTARTS', 'info');
      }
    }
    this.tabs().forEach((tab, i) => {
      if (input.wasPressed(String(i + 1)) && !this.blocked) this.openTab(tab.id);
    });
  }

  protected setAlert(text: string | undefined): void {
    this.alertEl.textContent = text ? `⚠ ${text}` : '';
    this.alertEl.classList.toggle('hidden', !text);
  }

  protected openTab(id: string): void {
    const tab = this.tabs().find((t) => t.id === id);
    if (!tab) return;
    this.activeTab = id;
    this.tabBtns.forEach((b, k) => b.classList.toggle('sel', k === id));
    this.panelTitle.textContent = `${tab.icon} ${tab.label}`;
    this.panelBody.replaceChildren(this.renderTab(id));
  }

  /** Re-render the open tab (after state changes). */
  protected refreshTab(): void {
    if (this.activeTab) this.panelBody.replaceChildren(this.renderTab(this.activeTab));
  }

  protected say(msg: string, kind: 'good' | 'bad' | 'info' | 'warn' = 'info'): void {
    this.feed.textContent = msg;
    this.feed.className = `feed ${kind}`;
  }

  protected complete(id: StepId): void {
    if (this.steps[id]) return;
    this.steps[id] = true;
    const el = this.stepEls.get(id);
    el?.classList.add('done');
    el?.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 });
  }

  /** Call when the player changes something. Records guessing before evidence. */
  protected noteChange(): void {
    if (!this.steps.cause) this.attempts.guessedFirst = true;
  }

  /** True when shared keys and stage clicks should do nothing: intro, solving, recap, or a pop-up is open. */
  protected get blocked(): boolean {
    return this.phase !== 'play' || this.overlays > 0;
  }

  /** Show a pop-up over the level. Returns a function that closes it. */
  protected openOverlay(el: HTMLElement): () => void {
    this.overlays++;
    this.root.append(el);
    let open = true;
    return () => {
      if (!open) return;
      open = false;
      this.overlays--;
      el.remove();
    };
  }

  /** Dev/testing only: dismiss the intro card as if START was pressed. */
  protected devSkipIntro(): void {
    this.introClose?.();
    this.introClose = undefined;
    this.phase = 'play';
    this.complete('understand');
  }

  private introClose: (() => void) | undefined;

  private showIntro(): void {
    const i = this.intro();
    const wrap = h('div', 'modal');
    const card = h('div', 'panel intro');
    const known = h('ul', 'known');
    for (const k of i.known) known.append(h('li', '', k));
    const btn = h('button', 'btn primary', 'START INVESTIGATING ▶');
    btn.addEventListener('click', () => {
      this.introClose?.();
      this.introClose = undefined;
      this.phase = 'play';
      this.complete('understand');
      this.openTab(this.tabs()[0].id);
    });
    card.append(
      h('div', 'title', `TICKET · ${this.meta.title.toUpperCase()}`),
      h('div', 'sub', 'WHAT PEOPLE ARE SEEING'),
      h('div', 'symptom', i.symptom),
      h('div', 'sub', 'WHAT YOU KNOW'),
      known,
      h('div', 'sub', 'YOUR GOAL'),
      h('div', 'goal', i.goal),
      h('div', 'howto', 'Find the cause with your tools, change what needs changing, then check that it really works. Guessing costs Trust.'),
      btn,
    );
    wrap.append(card);
    this.phase = 'intro';
    this.introClose = this.openOverlay(wrap);
    setTimeout(() => btn.focus(), 50);
  }

  protected finish(r: Recap): void {
    if (this.phase === 'resolving' || this.phase === 'recap') return;
    this.phase = 'resolving';
    this.complete('verify');
    const trust = trustFor(this.attempts);
    this.later(() => this.showRecap(r, trust), 1800);
  }

  private showRecap(r: Recap, trust: number): void {
    this.phase = 'recap';
    const wrap = h('div', 'modal');
    const card = h('div', 'panel recap');
    const ba = h('div', 'ba');
    const side = (s: Side, cls: string) => {
      const d = h('div', `side ${cls}`);
      d.append(h('div', 'label', s.label), s.visual, h('div', 'cap', s.caption));
      return d;
    };
    ba.append(side(r.before, 'before'), h('div', 'ba-arrow', '➜'), side(r.after, 'after'));
    const lower = h('div', 'recap-lower');
    const why = h('div', 'why');
    why.append(h('div', 'sub', 'WHY IT WORKED'), h('div', '', r.why));
    const real = h('div', '');
    real.append(h('div', 'sub', 'THE SAME FIX, FOR REAL'), h('pre', 'code', r.realWorld), h('div', 'caption', r.realWorldCaption));
    lower.append(why, real);
    const notes: string[] = [];
    if (this.attempts.guessedFirst) notes.push('changed things before finding evidence (−1)');
    if (this.attempts.failedChanges) notes.push(`${this.attempts.failedChanges} change(s) that didn't fix it (−${this.attempts.failedChanges})`);
    if (this.attempts.wasteful) notes.push('fixed it with far more than needed (−1)');
    const btn = h('button', 'btn primary', `CLOSE TICKET · TRUST +${trust}`);
    btn.addEventListener('click', () => this.exit({ levelId: this.meta.id, trust, completed: true }));
    const foot = h('div', 'recap-foot');
    const fb = h('a', 'feedback-link', '💬 Was this ticket confusing or wrong? Tell me') as HTMLAnchorElement;
    fb.href = feedbackUrl(this.meta.id, this.meta.title);
    fb.target = '_blank';
    fb.rel = 'noopener';
    foot.append(h('div', 'score', notes.length ? `Trust: ${notes.join(', ')}.` : 'Clean fix: evidence first, one change, verified. Full Trust!'), btn);
    card.append(h('div', 'title', '✓ TICKET SOLVED'), h('div', 'headline', r.headline), ba, lower, foot, fb);
    wrap.append(card);
    this.root.append(wrap);
    btn.focus();
  }
}

/** A pre-filled GitHub issue for one ticket. Only the ticket's id and title go in; nothing about the player. */
export function feedbackUrl(id: string, title: string): string {
  const body = [
    `**Ticket:** ${id} · ${title}`,
    '',
    '**What was confusing, wrong or broken?**',
    '',
    '',
    '**What did you expect instead?**',
    '',
  ].join('\n');
  const q = new URLSearchParams({ title: `Ticket feedback: ${id} · ${title}`, body });
  return `https://github.com/sharatvikas/ninefold/issues/new?${q}`;
}
