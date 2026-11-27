import type { Ctx } from '../art/pixels';
import { Input } from './input';
import { UI } from '../ui/ui';
import { completeLevel, findCurio, loadProgress, recordRun, resetProgress, saveProgress, tally, type Avatar, type Progress } from '../state/progress';

export const VIEW_W = 384;
export const VIEW_H = 216;

export interface Scene {
  enter?(): void;
  leave?(): void;
  update(dt: number, t: number): void;
  render(c: Ctx, t: number): void;
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export class Game {
  readonly input = new Input();
  readonly ui: UI;
  progress: Progress;
  private scene: Scene | undefined;
  private last = 0;

  constructor(
    readonly ctx: Ctx,
    uiRoot: HTMLElement,
  ) {
    this.ui = new UI(uiRoot, this.input);
    this.progress = loadProgress(safeStorage());
    const cv = ctx.canvas;
    if (cv instanceof HTMLCanvasElement)
      this.input.watchPointer(cv, (e) => {
        const r = cv.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * VIEW_W, y: ((e.clientY - r.top) / r.height) * VIEW_H };
      });
  }

  get current(): Scene | undefined {
    return this.scene;
  }

  /** Where on screen the player is (fractions of the stage), so transitions can close on them. */
  focus = { x: 0.5, y: 0.5 };

  setScene(s: Scene): void {
    this.scene?.leave?.();
    this.ui.clearScene();
    this.ui.dialog.dismiss();
    this.scene = s;
    s.enter?.();
  }

  resetProgress(): void {
    this.progress = resetProgress(this.progress);
    saveProgress(safeStorage(), this.progress);
  }

  /** Swap in progress loaded from a save code. */
  replaceProgress(p: Progress): void {
    this.progress = p;
    saveProgress(safeStorage(), this.progress);
  }

  setAvatar(a: Avatar): void {
    this.progress = { ...this.progress, avatar: a };
    saveProgress(safeStorage(), this.progress);
  }

  /** Save a curio found around town. */
  foundCurio(id: string): void {
    this.progress = findCurio(this.progress, id);
    saveProgress(safeStorage(), this.progress);
  }

  /** Save a fish landed or a bug caught. Returns how many of that kind you now have. */
  caught(key: 'fish' | 'bugs', id: string): number {
    this.progress = tally(this.progress, key, id);
    saveProgress(safeStorage(), this.progress);
    return this.progress[key]?.[id] ?? 0;
  }

  /** Save a Letter Run time. Returns true if it's a new best. */
  finishRun(seconds: number): boolean {
    const before = this.progress.runBest;
    this.progress = recordRun(this.progress, seconds);
    saveProgress(safeStorage(), this.progress);
    return this.progress.runBest !== before;
  }

  /** Save a finished level and return the trust actually gained. */
  finishLevel(levelId: string, trust: number): number {
    const before = this.progress.trust;
    const wasDone = !!this.progress.completed[levelId];
    this.progress = completeLevel(this.progress, levelId, trust);
    saveProgress(safeStorage(), this.progress);
    return wasDone ? 0 : this.progress.trust - before;
  }

  start(): void {
    const frame = (now: number) => {
      const t = now / 1000;
      const dt = Math.min(0.05, this.last ? t - this.last : 0);
      this.last = t;
      if (this.scene) {
        this.scene.update(dt, t);
        this.ctx.clearRect(0, 0, VIEW_W, VIEW_H);
        this.scene.render(this.ctx, t);
      }
      this.ui.update(dt);
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
