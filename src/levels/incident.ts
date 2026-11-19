import { analytics, secsSince, type Step } from '../analytics/analytics';
import type { Ctx } from '../art/pixels';
import type { Game, Scene } from '../engine/game';
import { feedbackLink, feedbackUrl, h } from '../ui/ui';
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
  /** The beginner's guide line: what to do right now, in one plain sentence. */
  private coachEl = h('div', 'coach');
  protected activeTab = '';
  protected phase: Phase = 'intro';
  /** Pop-ups opened on top of play (e.g. the file editor). */
  private overlays = 0;
  private timers: number[] = [];
  /** When the player last pressed Esc mid-ticket; a second press soon after really leaves. */
  private escAt = -Infinity;
  /** Play tracking: when the ticket was opened / started, whether it was already solved, and whether we've reported how it ended. */
  private openedAt = 0;
  private startedAt = 0;
  private replay = false;
  private ended = false;
  private onPageHide = () => this.trackAbandon('closed_tab');
  /** Trust actually added when the solve was saved (0 on a replay). */
  private gained = 0;

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
    const right = h('div', 'level-btns');
    right.append(feedbackLink(`${this.meta.id} · ${this.meta.title}`, '💬'), leave);
    top.append(title, steps, right);

    const tray = h('div', 'tray');
    const bar = h('div', 'hotbar');
    this.tabs().forEach((tab, i) => {
      const b = h('button', 'slot');
      b.append(h('span', 'key', String(i + 1)), h('span', 'icon', tab.icon), h('small', /\S{9,}/.test(tab.label) ? 'long' : '', tab.label));
      b.addEventListener('click', () => this.openTab(tab.id));
      this.tabBtns.set(tab.id, b);
      bar.append(b);
    });
    const panel = h('div', 'panel notes');
    panel.append(this.coachEl, this.panelTitle, this.panelBody, this.feed);
    tray.append(bar, panel);
    this.root.append(top, this.alertEl, tray);
    this.game.ui.scene.append(this.root);
    this.replay = !!this.game.progress.completed[this.meta.id];
    this.openedAt = performance.now();
    analytics.track({ name: 'ticket_open', level: this.meta.id, replay: this.replay });
    window.addEventListener('pagehide', this.onPageHide);
    this.showIntro();
  }

  leave(): void {
    window.removeEventListener('pagehide', this.onPageHide);
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
    this.trackAbandon('left');
    this.exit({ levelId: this.meta.id, trust: 0, completed: false });
  }

  /** Handle shared keys. Call from subclass update(). */
  protected baseUpdate(t: number): void {
    this.now = t;
    const next = `👉 ${this.coach()}`;
    if (this.coachEl.textContent !== next) this.coachEl.textContent = next;
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

  /** What to do now, for players who have never done this job. Points the way, never gives the answer. */
  protected coach(): string {
    if (this.phase === 'resolving' || this.phase === 'recap') return 'Fixed and checked. Nice work!';
    if (!this.steps.cause) return `NEXT: find the cause. Open the tools below (keys 1–${this.tabs().length}) and click anything that looks wrong. Step 2 turns green when you spot it.`;
    if (!this.steps.fix) return 'NEXT: change the one thing your evidence points to, then apply it.';
    if (this.attempts.failedChanges > 0) return "That didn't fix it yet. Read the ✗ results and the hint, then try a different change.";
    return 'NEXT: check that it really works.';
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
    if (id === 'cause' || id === 'fix') analytics.track({ name: 'ticket_step', ...this.trackBase(), step: id, secs: this.secs() });
    const el = this.stepEls.get(id);
    el?.classList.add('done');
    el?.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 });
  }

  /** Call when a change didn't fix the problem: costs 1 Trust, and is tracked so we can see where players get stuck. */
  protected miss(): void {
    this.attempts.failedChanges++;
    analytics.track({ name: 'ticket_miss', ...this.trackBase(), misses: this.attempts.failedChanges, secs: this.secs() });
  }

  private trackBase(): { level: string; replay: boolean } {
    return { level: this.meta.id, replay: this.replay };
  }

  /** Seconds since START was pressed (or since the ticket opened, if it never was). */
  private secs(): number {
    return secsSince(this.startedAt || this.openedAt, performance.now());
  }

  /** Report a ticket left unsolved, once. Leaving after it's solved isn't abandoning it. */
  private trackAbandon(how: 'left' | 'closed_tab'): void {
    if (this.ended || (this.phase !== 'intro' && this.phase !== 'play')) return;
    this.ended = true;
    const reached: Step = this.phase === 'intro' ? 'intro' : this.steps.fix ? 'fix' : this.steps.cause ? 'cause' : 'understand';
    analytics.track({ name: 'ticket_abandon', ...this.trackBase(), secs: this.secs(), misses: this.attempts.failedChanges, reached, how });
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
      this.startedAt = performance.now();
      analytics.track({ name: 'ticket_start', ...this.trackBase() });
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
      h('div', 'howto', 'How every ticket works: ① read this card · ② find the cause with the tools at the bottom · ③ change one thing · ④ check it really works. Guessing costs Trust. Stuck? Follow the 👉 yellow line.'),
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
    this.ended = true;
    const { failedChanges: misses, guessedFirst, wasteful } = this.attempts;
    analytics.track({ name: 'ticket_solved', ...this.trackBase(), secs: this.secs(), misses, trust, guessedFirst, wasteful });
    // Save the solve now, not when the recap is closed, so closing the tab on the recap can't lose it.
    this.gained = this.game.finishLevel(this.meta.id, trust);
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
    real.append(h('div', 'sub', 'THE SAME FIX, FOR REAL'), codeBlock(r.realWorld), h('div', 'code-legend', 'Grey lines explain the code · − removed · + added · $ a command you type'), h('div', 'caption', r.realWorldCaption));
    lower.append(why, real);
    const notes: string[] = [];
    if (this.attempts.guessedFirst) notes.push('changed things before finding evidence (−1)');
    if (this.attempts.failedChanges) notes.push(`${this.attempts.failedChanges} change(s) that didn't fix it (−${this.attempts.failedChanges})`);
    if (this.attempts.wasteful) notes.push('fixed it with far more than needed (−1)');
    const btn = h('button', 'btn primary', `CLOSE TICKET · TRUST +${trust}`);
    btn.addEventListener('click', () => this.exit({ levelId: this.meta.id, trust, completed: true, gained: this.gained }));
    const foot = h('div', 'recap-foot');
    const fb = h('a', 'feedback-link', '💬 Was this ticket confusing or wrong? Tell me') as HTMLAnchorElement;
    fb.href = feedbackUrl(`${this.meta.id} · ${this.meta.title}`);
    fb.target = '_blank';
    fb.rel = 'noopener';
    foot.append(h('div', 'score', notes.length ? `Trust: ${notes.join(', ')}.` : 'Clean fix: evidence first, one change, verified. Full Trust!'), btn);
    card.append(h('div', 'title', '✓ TICKET SOLVED'), h('div', 'headline', r.headline), ba, lower, foot, fb);
    wrap.append(card);
    this.root.append(wrap);
    btn.focus();
  }
}

/** Whole-line and trailing comments, in the comment styles the snippets use (#, //, -- , ;, <!--). A line of `--flags` is code. */
const COMMENT = /^(\s*(?:#|\/\/|--(?=\s|$)|;|<!--).*)$|(\s{2,}(?:#|\/\/|--|;)\s.*)$/;

/** Where the explanation comment starts on a line (the line's length if it has none). */
export function commentStart(line: string): number {
  const m = line.match(COMMENT);
  return m ? (m[1] !== undefined ? 0 : line.length - m[2].length) : line.length;
}

/** A code snippet with its explanation comments dimmed, so the code and the words read apart. */
export function codeBlock(text: string): HTMLElement {
  const pre = h('pre', 'code');
  for (const line of text.split('\n')) {
    const at = commentStart(line);
    pre.append(line.slice(0, at));
    if (at < line.length) pre.append(h('span', 'cmt', line.slice(at)));
    pre.append('\n');
  }
  return pre;
}
