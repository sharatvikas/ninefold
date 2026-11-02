import type { Ctx } from '../art/pixels';
import { Input } from './input';
import { UI } from '../ui/ui';
import { completeLevel, loadProgress, resetProgress, saveProgress, type Avatar, type Progress } from '../state/progress';

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
  }

  get current(): Scene | undefined {
    return this.scene;
  }

  setScene(s: Scene): void {
    this.scene?.leave?.();
    this.ui.clearScene();
    this.scene = s;
    s.enter?.();
  }

  resetProgress(): void {
    this.progress = resetProgress(this.progress);
    saveProgress(safeStorage(), this.progress);
  }

  setAvatar(a: Avatar): void {
    this.progress = { ...this.progress, avatar: a };
    saveProgress(safeStorage(), this.progress);
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
